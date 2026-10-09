// ─── Business-Index — Speicher und Laden (Server) ───────────────────────────
// Liest die Business-Speicher (nie Haushalt/Privat) zu einem Bestand je Sicht,
// hält Monatsabschlüsse und Einstellungen und schreibt einmal am Tag einen
// Schnappschuss (Verlauf für Trends, Ampel-Wechsel und den MRR für die NRR).

import type { ZeitBild } from '@/lib/zeitmessung/modell';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import type { FinanceState } from '@/lib/make-one/finance-data';
import type { Firma, Rechnung, Zahlung, Merkposten, Planposten } from '@/lib/make-one/liquiditaet';
import { lesen, monatsBild, type MalinExport } from '@/lib/make-one/grundlage';
import { ladeCrm } from '@/lib/crm/speicher';
import { traktionsIndex, alsTraktion, ersterLauf } from '@/lib/crm/traktion-index';
import { ladeIndexDatei } from '@/lib/kennzahlen/speicher';
import type { Kontakt } from '@/lib/make-one/crm';
import { planBloeckeLesen } from '@/lib/planung/bloecke-server';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { kapaKennzahlenFuerIndex } from '@/lib/kapazitaet/server';
import { meilensteinSpace } from '@/lib/planung/meilensteine';
import { tagPlus } from '@/lib/kalender/zeit';
import { localDay } from '@/lib/zeit';
import { SCOPES, schwelleSauber, type Scope, type Schwelle } from './register';
import { mrrJeKunde, type Bestand, type Monatsabschluss } from './messen';
import { berechne, type Ampel, type BusinessIndex } from './index';
import { abEroeffnung, abschlussVor, gesamtAbMonat, geltendeEroeffnungen, type Geltende } from './eroeffnung';
import { ladeEroeffnungen } from './eroeffnung-server';
import { ABSCHLUSS_FELDER } from './abschluss-tabelle';
import { firmenMitRegister } from '@/lib/finanzen/konten/register';
import { registerKasseLaden } from '@/lib/finanzen/konten/server';
import { verborgeneMeilensteineFuer } from '@/lib/planung/eigene-ziele-sicht-server';
import { BUSINESS_GESELLSCHAFTEN, PRIVAT_GESELLSCHAFTEN, KERN_EINHEITEN, GEHOERT_ZU_PRIVAT, bereichVon, bereichVonFirma, bereichVonGesellschaft, finanzOrtName, istBusinessGesellschaft, istGesellschaft, type Bereich, type Gesellschaftskennung } from '@/lib/einheiten';

export const EINSTELLUNGEN = 'business-einstellungen';
export const ABSCHLUESSE = 'business-abschluesse';
export const VERLAUF = 'business-verlauf';

export interface BusinessEinstellungen {
  fte: Partial<Record<Gesellschaftskennung, number>>;
  /** Jahresumsatzziel je Firma (gesamt: Controlling). */
  ziele?: Partial<Record<Gesellschaftskennung, number>>;
  /** Verfügbare Beratertage je Monat und Firma — Grundlage der Auslastung. */
  kapazitaet?: Partial<Record<Gesellschaftskennung, number>>;
  /** Eigene Schwellen: „alle“ gilt überall, eine Sicht überschreibt „alle“. */
  schwellen?: Partial<Record<'alle' | Scope, Record<string, Schwelle>>>;
}
export interface Tagesstand { index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null>; ampeln: Record<string, Ampel> }
export interface BusinessVerlauf {
  /** Datum → Sicht → Stand */
  tage: Record<string, Partial<Record<Scope, Tagesstand>>>;
  /** Monat → Sicht → Kunde → MRR (letzter Stand im Monat) */
  mrr: Record<string, Partial<Record<Scope, Record<string, number>>>>;
}

/**
 * Die Firmen mit Einstellungen und Monatsabschluss — die eine Einheitenliste (28.09.: auch die MAKE Innovation GmbH), seit 05.10. nur
 * der Business-Bereich (`BUSINESS_GESELLSCHAFTEN`; die Selbstständigkeit gehört zu Privat). Gespeicherte Werte einer Privat-Einheit
 * bleiben im Speicher (nichts wird gelöscht), werden hier aber weder geschrieben noch ausgeliefert noch gerechnet.
 */
const FIRMEN = BUSINESS_GESELLSCHAFTEN;
/** Nur die Werte der Business-Firmen eines Schlüssel-Objekts (fte, Ziele, Kapazität …). */
const nurBusinessWerte = <T>(o: Partial<Record<Gesellschaftskennung, T>> | undefined): Partial<Record<Gesellschaftskennung, T>> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => istBusinessGesellschaft(k))) as Partial<Record<Gesellschaftskennung, T>>;

/** Zählt eigene Schreibvorgänge — Zwischenspeicher (ZOE, Head of Finance) wissen so, wann sie neu rechnen müssen. */
let schreibStand = 0;
export const businessSchreibStand = () => schreibStand;
/** Eine Schreibung außerhalb dieses Moduls (Eröffnung, 05.10.) — Zwischenspeicher rechnen neu. */
export const businessGeaendert = () => { schreibStand++; };
const zahlOder = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : undefined);

/** Einstellungen des Business-Bereichs — nur die Business-Firmen (05.10.: Werte der Selbstständigkeit bleiben gespeichert, gehen aber nicht hinaus). */
export async function ladeEinstellungen(): Promise<BusinessEinstellungen> {
  const e = await loadJson<BusinessEinstellungen>(EINSTELLUNGEN);
  const schwellen = Object.fromEntries(Object.entries(e?.schwellen ?? {}).filter(([k]) => k === 'alle' || k === 'gesamt' || istBusinessGesellschaft(k)));
  return { fte: nurBusinessWerte(e?.fte), ziele: nurBusinessWerte(e?.ziele), kapazitaet: nurBusinessWerte(e?.kapazitaet), schwellen };
}

/** Die geltenden eigenen Schwellen einer Sicht: „alle“, überschrieben von der Sicht selbst. */
export const schwellenFuer = (e: BusinessEinstellungen, scope: Scope): Record<string, Schwelle> => ({ ...(e.schwellen?.alle ?? {}), ...(e.schwellen?.[scope] ?? {}) });

/**
 * Einstellungen ändern — Köpfe, Jahresziele und Kapazität (Beratertage/Monat) je Firma, eigene Schwellen
 * ({ schwelle: { id, sicht: 'alle'|Sicht, gruen, rot } } oder { …, zuruecksetzen: true }).
 */
export async function speichereEinstellungen(roh: Record<string, unknown>): Promise<{ ok: true; einstellungen: BusinessEinstellungen } | { ok: false; fehler: string }> {
  let fehler: string | null = null;
  const e = await updateJson<BusinessEinstellungen>(EINSTELLUNGEN, alt => {
    const neu: BusinessEinstellungen = { fte: { ...(alt?.fte ?? {}) }, ziele: { ...(alt?.ziele ?? {}) }, kapazitaet: { ...(alt?.kapazitaet ?? {}) }, schwellen: { ...(alt?.schwellen ?? {}) } };
    const zahlen = (quelle: unknown, ziel: Partial<Record<Gesellschaftskennung, number>>, max: number, stellen: number) => {
      const r = (quelle ?? {}) as Record<string, unknown>;
      for (const f of FIRMEN) if (f in r) { const n = zahlOder(r[f]); if (n == null || n <= 0) delete ziel[f]; else ziel[f] = Math.min(max, Math.round(n * stellen) / stellen); }
    };
    if (roh.fte) zahlen(roh.fte, neu.fte, 500, 10);
    if (roh.ziele) zahlen(roh.ziele, neu.ziele!, 1e9, 1);
    if (roh.kapazitaet) zahlen(roh.kapazitaet, neu.kapazitaet!, 31 * 20, 2);
    if (roh.schwelle && typeof roh.schwelle === 'object') {
      const s = roh.schwelle as Record<string, unknown>;
      const sicht = (['alle', ...SCOPES.map(x => x.id)] as const).find(x => x === s.sicht);
      const id = String(s.id ?? '');
      if (!sicht) { fehler = `Sicht fehlt (alle, ${SCOPES.map(x => x.id).join(', ')}).`; return alt ?? neu; }
      const liste = { ...(neu.schwellen![sicht] ?? {}) };
      if (s.zuruecksetzen === true) delete liste[id];
      else {
        const r = schwelleSauber(id, s as { gruen?: unknown; rot?: unknown });
        if (!r.ok) { fehler = r.fehler; return alt ?? neu; }
        liste[id] = r.schwelle;
      }
      neu.schwellen![sicht] = liste;
    }
    return neu;
  });
  if (!fehler) schreibStand++;
  return fehler ? { ok: false, fehler } : { ok: true, einstellungen: { ...e, fte: nurBusinessWerte(e.fte), ziele: nurBusinessWerte(e.ziele), kapazitaet: nurBusinessWerte(e.kapazitaet), schwellen: Object.fromEntries(Object.entries(e.schwellen ?? {}).filter(([k]) => k === 'alle' || k === 'gesamt' || istBusinessGesellschaft(k))) } };
}

// ── Monatsabschlüsse je Bereich (05.10. abends, Kevin: „Privat › Selbstständigkeit bekommt den Monatsabschluss“) ──
// EIN Bestand (`business-abschluesse`, wie bisher) — jede Zeile gehört über ihre Firma zu einem Bereich (`bereichVon`). Der Business-Index
// liest und schreibt nur die Business-Gesellschaften, Privat (Route /api/privat/abschluss, Privatzugang) nur die Privat-Einheiten (unsere
// Instanz: die Selbstständigkeit). Die vor dem 05.10. im Business-Cockpit eingetragenen Abschlüsse der Selbstständigkeit sind damit unter
// Privat wieder sichtbar und bearbeitbar — ohne Umzug, gleiche Kennungen. Ein Bereich schreibt nie in den anderen (400).

/** Die Firmen mit Monatsabschluss in einem Bereich. */
export const abschlussFirmen = (bereich: Bereich): readonly Gesellschaftskennung[] => (bereich === 'business' ? FIRMEN : PRIVAT_GESELLSCHAFTEN);
/** Gehört die Zeile (Firma) zu diesem Bereich? */
const imBereich = (firma: unknown, bereich: Bereich): boolean => istGesellschaft(firma) && bereichVon(firma) === bereich;
/** Satz, wenn eine Firma im falschen Bereich angefragt wird. */
const falscherBereich = (firma: Gesellschaftskennung, bereich: Bereich): string =>
  bereich === 'business' ? GEHOERT_ZU_PRIVAT(firma) : `${finanzOrtName(firma)} gehört zum Business — ihr Monatsabschluss steht im Business-Cockpit, nicht unter Privat.`;

/** Monatsabschlüsse eines Bereichs (Vorgabe Business; die des anderen Bereichs bleiben gespeichert, gehen aber nicht hinaus). */
export async function ladeAbschluesse(bereich: Bereich = 'business'): Promise<Monatsabschluss[]> {
  return ((await loadJson<{ eintraege: Monatsabschluss[] }>(ABSCHLUESSE))?.eintraege ?? []).filter(a => imBereich(a.firma, bereich));
}

// Die Felder stehen EINMAL in lib/business/abschluss-tabelle.ts (rein — auch die Tabelle zum Einfügen, 09.10.).
export { ABSCHLUSS_FELDER };

/** Monatsabschluss eintragen oder ändern (je Firma und Monat) — nur für eine Firma des Bereichs (Vorgabe Business). Leeres Feld = entfernen. */
export async function speichereAbschluss(roh: Record<string, unknown>, von: string, bereich: Bereich = 'business'): Promise<{ ok: true; eintrag: Monatsabschluss } | { ok: false; fehler: string }> {
  const firma = abschlussFirmen(bereich).find(f => f === roh.firma);
  const monat = typeof roh.monat === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(roh.monat) ? roh.monat : null;
  if (!firma && istGesellschaft(roh.firma)) return { ok: false, fehler: falscherBereich(roh.firma, bereich) };
  if (!firma) return { ok: false, fehler: `Firma fehlt (${KERN_EINHEITEN.filter(e => imBereich(e.id, bereich)).map(e => e.label).join(' oder ') || 'keine im Bereich'}).` };
  if (!monat) return { ok: false, fehler: 'Monat im Format JJJJ-MM fehlt.' };
  if (monat > localDay().slice(0, 7)) return { ok: false, fehler: 'Ein Abschluss für die Zukunft geht nicht.' };
  let eintrag!: Monatsabschluss;
  await updateJson<{ eintraege: Monatsabschluss[] }>(ABSCHLUESSE, alt => {
    const liste = alt?.eintraege ?? [];
    const vorher = liste.find(x => x.firma === firma && x.monat === monat);
    const neu: Monatsabschluss = { ...(vorher ?? {}), firma, monat, von, am: new Date().toISOString() };
    for (const f of ABSCHLUSS_FELDER) if (f in roh) { const n = zahlOder(roh[f]); if (n == null) delete neu[f]; else neu[f] = Math.round(n * 100) / 100; }
    if ('notiz' in roh) { const t = String(roh.notiz ?? '').trim().slice(0, 300); if (t) neu.notiz = t; else delete neu.notiz; }
    eintrag = neu;
    schreibStand++;
    return { eintraege: [...liste.filter(x => !(x.firma === firma && x.monat === monat)), neu].sort((a, b) => b.monat.localeCompare(a.monat) || a.firma.localeCompare(b.firma)) };
  });
  return { ok: true, eintrag };
}

export async function loescheAbschluss(firma: string, monat: string, bereich: Bereich = 'business'): Promise<void> {
  // Nur der eigene Bereich (05.10.): ein Abschluss des anderen Bereichs wird von hier nie gelöscht.
  if (!imBereich(firma, bereich)) return;
  schreibStand++;
  await updateJson<{ eintraege: Monatsabschluss[] }>(ABSCHLUESSE, alt => ({ eintraege: (alt?.eintraege ?? []).filter(x => !(x.firma === firma && x.monat === monat)) }));
}

const monatlich = (f: { brutto: number; rhythmus: string }) => (f.rhythmus === 'yearly' ? f.brutto / 12 : f.rhythmus === 'quarterly' ? f.brutto / 3 : f.brutto);

/** Alles, was der Index braucht — einmal geladen, für alle drei Sichten. */
export async function ladeRoh(heute = localDay()) {
  // Tempo (26.09.): vierzehn Bestände lesen und aufbereiten — zwei Minuten merken (jede Schreibung setzt zurück).
  return merken(`business-roh:${heute}`, 2 * 60_000, () => ladeRohFrisch(heute));
}
async function ladeRohFrisch(heute: string) {
  const [fp, lp, fin, grund, abschluesseAlle, crm, kartei, cal, plan, auftraege, ms, einst, verlauf, traktionDatei, eroeffnungen, registerKasse] = await Promise.all([
    loadJson<{ firmen?: Firma[]; rechnungen?: (Rechnung & { firmaId?: string })[]; zahlungen?: Zahlung[]; merkposten?: Merkposten[] }>('finanzplan'),
    loadJson<{ posten?: Planposten[] }>('liquiplan'),
    loadJson<FinanceState>('finance'),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
    ladeAbschluesse(),
    ladeCrm(),
    loadJson<{ kontakte: Kontakt[] }>('kontakte'),
    loadJson<{ events?: { startDate?: string; endDate?: string; allDay?: boolean; owner?: string }[]; quelle?: string }>('calendar-cache'),
    // Fokus-Blöcke (K5: Kalender-Termine der Art Fokus/Block + Archiv) — der Plan des Inhabers (Rolle, keine feste Person im Code).
    inhaberSpeicher().then(p => (p ? planBloeckeLesen({ person: p, von: tagPlus(heute, -42), bis: tagPlus(heute, 1) }) : [])).catch(() => []),
    loadJson<{ auftraege?: { status: string; beendet?: string; zeit?: string; anlass?: string; name?: string; auftrag?: string }[] }>('zoe-auftraege'),
    loadJson<{ meilensteine?: { id?: string; titel?: string; bereich: string; space?: string; einheit?: string; faellig?: string; fortschritt: number; erledigt: boolean; zielId?: string; abgeleitetVon?: string }[] }>('meilensteine'),
    ladeEinstellungen(),
    loadJson<BusinessVerlauf>(VERLAUF),
    ladeIndexDatei('traktion-index'),
    ladeEroeffnungen(),
    // Konten-Register (08.10.): je Gesellschaft, die das Register führt, gilt dessen Kasse als Kontostand (ohne Register: bisherige Quelle).
    registerKasseLaden(),
  ]);
  // 0-Punkt (05.10.): je Business-Gesellschaft mit Eröffnung rechnet alles ab dem Stichtag (lib/business/eroeffnung.ts) — Konten starten beim
  // Anfangsbestand, Posten/Abschlüsse davor sind archiviert (gespeichert, nicht gezählt), offene Posten der Eröffnung kommen dazu.
  const eroeffnung: Geltende = geltendeEroeffnungen(eroeffnungen);
  // Fail-closed: kann die Regel nicht gelesen werden, tragen alle Meilensteine mit Ziel-Bezug keinen Titel.
  const msOhneTitel = await verborgeneMeilensteineFuer(null, (ms?.meilensteine ?? []).filter((m): m is typeof m & { id: string } => !!m.id))
    .catch(() => new Set((ms?.meilensteine ?? []).filter(m => m.id && (m.zielId || m.abgeleitetVon)).map(m => m.id!)));
  const abschluesse = abschluesseAlle.filter(a => !abschlussVor(a, eroeffnung));
  // Kapazität (04.10.): nur die Team-Summen — eigener Lesefehler darf den Index nie kippen (null = Säule zählt nicht).
  const kapa = await kapaKennzahlenFuerIndex(heute);
  // V1-Export: nur die Business-Teile. Umsatz/Kosten = Selbständigkeit (Consulting);
  // Fixkosten getrennt: s = Selbständigkeit, u = „KD Management UG“ = Gründungsname der
  // KD Ventures UG (CLAUDE.md) → kdv, NICHT die MAKE Innovation GmbH. Private Kredite (p.sch) bleiben draußen.
  const g = grund?.roh ? lesen(grund.roh, grund.stand) : null;
  const fixS = (grund?.roh?.s?.fixk ?? []).length, fixU = (grund?.roh?.u?.fixk ?? []).length;
  const fixListe = g?.fixkosten ?? [];
  // Seit 05.10. nur der Business-Bereich: die Teile der Selbstständigkeit (Umsatz/Kosten, Fixkosten) zählen nur, wenn sie dort steht.
  const selbstImBusiness = bereichVon('kdc') === 'business';
  const grundlageFixkosten: Partial<Record<Gesellschaftskennung, number>> = {
    ...(selbstImBusiness ? { kdc: fixListe.slice(fixU, fixU + fixS).reduce((s, f) => s + monatlich(f), 0) } : {}),
    ...(istBusinessGesellschaft('kdv') ? { kdv: fixListe.slice(0, fixU).reduce((s, f) => s + monatlich(f), 0) } : {}),
  };
  const kontakte = kartei?.kontakte ?? [];
  // Traktions-Index (26.09.): dieselbe Zahl wie im Markttraktion-Überblick — eine Wahrheit.
  const ti = traktionsIndex({ kontakte, crm, heute, schwellen: traktionDatei.schwellen, ersterLauf: ersterLauf(traktionDatei, heute) });
  const tr = alsTraktion(ti);
  const ab = new Date(`${heute}T12:00:00`); ab.setDate(ab.getDate() - 35);
  const abTag = localDay(ab);
  // Serverseitige Grenze des Business-Bereichs (05.10.): Konten, Rechnungen, Zahlungen, Merk- und Planposten (Liquiplan) einer
  // Privat-Einheit — ohne Firma ist das der bisherige Rückfall Selbstständigkeit (`bereichVonFirma`) — und ihre Deals/Mandate kommen
  // hier gar nicht erst an. Nichts wird gelöscht; Privat sieht sie weiter.
  const imBusiness = <T extends { firmaId?: string }>(l: T[]): T[] => l.filter(x => bereichVonFirma(x.firmaId) === 'business');
  const ab0 = abEroeffnung({
    firmen: (firmenMitRegister(fp?.firmen, registerKasse) ?? []).filter(f => bereichVonFirma(f.id) === 'business'), rechnungen: imBusiness(fp?.rechnungen ?? []), zahlungen: imBusiness(fp?.zahlungen ?? []),
    planposten: imBusiness(lp?.posten ?? []),
  }, eroeffnung);
  // Controlling (Gesamt-Ist ohne Firma): Monate vor dem 0-Punkt zählen nur dann nicht mehr, wenn JEDE Business-Gesellschaft eröffnet ist.
  const gesamtAb = gesamtAbMonat(eroeffnung);
  const finance = fin && gesamtAb && Array.isArray(fin.months) ? { ...fin, months: fin.months.map((m, i) => (`${fin.jahr}-${String(i + 1).padStart(2, '0')}` < gesamtAb ? { ...m, umsatz: 0, kosten: 0 } : m)) } : fin;
  return {
    heute,
    firmen: ab0.firmen, rechnungen: ab0.rechnungen, zahlungen: ab0.zahlungen, merkposten: imBusiness(fp?.merkposten ?? []),
    planposten: ab0.planposten, finance: finance ?? null,
    // Grundlage = Ist der Selbstständigkeit (nur im Business, wenn sie dort steht) — mit ihrem 0-Punkt, falls sie einen hat.
    grundlageMonate: g && selbstImBusiness ? monatsBild(g).filter(m => !abschlussVor({ firma: 'kdc', monat: m.monat }, eroeffnung)).map(m => ({ monat: m.monat, umsatzNetto: m.umsatzNetto, kostenNetto: m.kostenNetto })) : [],
    grundlageFixkosten,
    abschluesse,
    /** Monatsabschlüsse vor dem 0-Punkt (archiviert, nicht gezählt) — die Karte zeigt sie weiter. */
    abschluesseArchiv: abschluesseAlle.filter(a => abschlussVor(a, eroeffnung)),
    eroeffnung,
    mandate: crm.mandate.filter(m => bereichVonGesellschaft(m.gesellschaft) === 'business'),
    chancen: crm.chancen.filter(c => bereichVonGesellschaft(c.gesellschaft) === 'business'),
    leistungen: crm.leistungen,
    traktion: { score: tr.score, text: tr.score != null ? `${tr.welten.map(w => `${w.label} ${w.score ?? '—'}`).join(' · ')}${tr.vorlaeufig ? ' (vorläufig)' : ''}` : tr.hinweis, welten: tr.welten.map(w => ({ id: w.id, label: w.label, score: w.score })) },
    termine: (cal?.events ?? []).filter(e => !e.allDay && e.startDate && e.endDate).map(e => ({ start: e.startDate!, ende: e.endDate!, owner: e.owner })),
    // Meeting-Last des Inhabers (09.10., Plattform-Regel): Speichername aus den Konten statt eines festen Namens im Rechenweg.
    meetingVon: await inhaberSpeicher().catch(() => null),
    termineVollstaendig: cal?.quelle === 'icloud',
    bloecke: plan.filter(x => x.date >= abTag).map(x => ({ date: x.date, dauerMin: x.dauerMin, art: x.art })),
    // Nur die Felder, die der Index braucht (Auftragstexte können lang sein).
    auftraege: (auftraege?.auftraege ?? []).map(a => ({ status: a.status, beendet: a.beendet, zeit: a.zeit, anlass: a.anlass, name: a.name, auftrag: typeof a.auftrag === 'string' ? a.auftrag.slice(0, 120) : undefined })),
    // Meilensteine einer Privat-Einheit (05.10. abends: gespeichert Business + Einheit „Selbstständigkeit“) gehören zu Privat — serverseitig
    // heraus (`meilensteinSpace`, abgeleitet). Das Altfeld `bereich` bleibt im Speicher „business“ (für den alten Stand).
    // Eigene Ziele nur geteilt (08.10., Gegenprüfung): der Index geht an alle im Haushalt (und an ZOE) — ein Meilenstein an einem eigenen
    // Ziel (Altbestand) zählt im Kurs mit, aber ohne Titel und Kennung (Systemsicht `verborgeneMeilensteineFuer(null)`).
    meilensteine: (ms?.meilensteine ?? []).filter(m => !(m.bereich === 'business' && meilensteinSpace(m) === 'privat'))
      .map(m => (m.id && msOhneTitel.has(m.id) ? { bereich: m.bereich, ...(m.space ? { space: m.space } : {}), ...(m.einheit ? { einheit: m.einheit } : {}), ...(m.faellig ? { faellig: m.faellig } : {}), fortschritt: m.fortschritt, erledigt: m.erledigt } : m)),
    kapa,
    fte: einst.fte,
    ziele: einst.ziele ?? {},
    kapazitaet: einst.kapazitaet ?? {},
    einstellungen: einst,
    verlauf: verlauf ?? { tage: {}, mrr: {} },
    holdings: await holdingsAusRegister(),
  };
}

/** Holding-Sichten aus dem Gesellschafts-Register des Inhaber-Haushalts (04.10.) — null = keine Rolle gepflegt (Vorgabe gilt). */
async function holdingsAusRegister(): Promise<Scope[] | null> {
  try {
    const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    const h = await haushaltDesInhabers();
    if (!h) return null;
    const { ladeRegister } = await import('@/lib/gesellschaften/server');
    const { holdingSichten } = await import('@/lib/gesellschaften/modell');
    return holdingSichten(await ladeRegister(h));
  } catch { return null; }
}

export type Roh = Awaited<ReturnType<typeof ladeRoh>>;

export function bestandFuer(r: Roh, scope: Scope, zeit?: ZeitBild | null): Bestand {
  const mrrVerlauf: Record<string, Record<string, number>> = {};
  for (const [m, je] of Object.entries(r.verlauf.mrr ?? {})) if (je[scope]) mrrVerlauf[m] = je[scope]!;
  // Der laufende Monat immer aus dem aktuellen Stand.
  mrrVerlauf[r.heute.slice(0, 7)] = mrrJeKunde(r.mandate, scope);
  const { verlauf: _v, einstellungen, leistungen: _l, ...rest } = r;
  return { ...rest, scope, mrrVerlauf, schwellen: schwellenFuer(einstellungen, scope), zeit: zeit ?? null };
}

function tagesstand(bi: BusinessIndex): Tagesstand {
  const werte: Record<string, number | null> = {}, ampeln: Record<string, Ampel> = {};
  for (const s of bi.saeulen) for (const k of s.kennzahlen) { werte[k.id] = k.wert; ampeln[k.id] = k.ampel; }
  return { index: bi.index, saeulen: Object.fromEntries(bi.saeulen.map(s => [s.id, s.score])), werte, ampeln };
}

/** Einmal am Tag je Sicht festhalten (und den MRR des Monats). Hält 400 Tage. */
export async function schnappschuss(r: Roh, alle: Record<Scope, BusinessIndex>): Promise<void> {
  const tag = r.heute, monat = tag.slice(0, 7);
  await updateJson<BusinessVerlauf>(VERLAUF, alt => {
    const v: BusinessVerlauf = { tage: { ...(alt?.tage ?? {}) }, mrr: { ...(alt?.mrr ?? {}) } };
    v.tage[tag] = Object.fromEntries(SCOPES.map(s => [s.id, tagesstand(alle[s.id])]));
    v.mrr[monat] = Object.fromEntries(SCOPES.map(s => [s.id, mrrJeKunde(r.mandate, s.id)]));
    const tage = Object.keys(v.tage).sort();
    for (const t of tage.slice(0, Math.max(0, tage.length - 400))) delete v.tage[t];
    return v;
  });
}

export interface Wechsel { id: string; von: Ampel; nach: Ampel; seit: string }

/** Trend (Index vor ~30 Tagen) und Ampel-Wechsel seit dem letzten Tag davor. */
export function vergleich(v: BusinessVerlauf, scope: Scope, heute: string, jetzt: BusinessIndex): { vor30: number | null; wechsel: Wechsel[] } {
  const tage = Object.keys(v.tage ?? {}).filter(t => t < heute && v.tage[t]?.[scope]).sort();
  const vorher = tage.at(-1);
  const grenze = new Date(`${heute}T12:00:00`); grenze.setDate(grenze.getDate() - 30);
  const t30 = tage.filter(t => t <= localDay(grenze)).at(-1) ?? tage[0];
  const wechsel: Wechsel[] = [];
  if (vorher) {
    const alt = v.tage[vorher][scope]!.ampeln;
    for (const s of jetzt.saeulen) for (const k of s.kennzahlen) {
      const a = alt[k.id];
      if (a && a !== k.ampel && k.ampel !== 'grau' && a !== 'grau') wechsel.push({ id: k.id, von: a, nach: k.ampel, seit: vorher });
    }
  }
  return { vor30: t30 ? v.tage[t30][scope]?.index ?? null : null, wechsel };
}

/** Alle drei Sichten auf einmal (und der Schnappschuss des Tages, falls noch keiner da ist). */
export async function alleSichten(heute = localDay(), zeit?: ZeitBild | null): Promise<{ roh: Roh; ergebnis: Record<Scope, BusinessIndex> }> {
  const roh = await ladeRoh(heute);
  const ergebnis = Object.fromEntries(SCOPES.map(s => [s.id, berechne(bestandFuer(roh, s.id, zeit))])) as Record<Scope, BusinessIndex>;
  if (!roh.verlauf.tage?.[heute]) await schnappschuss(roh, ergebnis).catch(() => {});
  return { roh, ergebnis };
}
