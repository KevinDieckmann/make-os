// ─── Business-Index — Speicher und Laden (Server) ───────────────────────────
// Liest die Business-Speicher (nie Haushalt/Privat) zu einem Bestand je Sicht,
// hält Monatsabschlüsse und Einstellungen und schreibt einmal am Tag einen
// Schnappschuss (Verlauf für Trends, Ampel-Wechsel und den MRR für die NRR).

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { FinanceState } from '@/lib/make-one/finance-data';
import type { Firma, Rechnung, Zahlung, Merkposten, Planposten } from '@/lib/make-one/liquiditaet';
import { lesen, monatsBild, type MalinExport } from '@/lib/make-one/grundlage';
import { ladeCrm } from '@/lib/crm/speicher';
import { kennzahlen } from '@/lib/crm/kennzahlen';
import { marketingKennzahlen } from '@/lib/crm/marketing';
import { eventKennzahlen, traktion } from '@/lib/crm/traktion';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PlanBlock } from '@/types/planer';
import { localDay } from '@/lib/zeit';
import { SCOPES, schwelleSauber, type Scope, type Schwelle } from './register';
import { mrrJeKunde, type Bestand, type Monatsabschluss } from './messen';
import { berechne, type Ampel, type BusinessIndex } from './index';

export const EINSTELLUNGEN = 'business-einstellungen';
export const ABSCHLUESSE = 'business-abschluesse';
export const VERLAUF = 'business-verlauf';

export interface BusinessEinstellungen {
  fte: Partial<Record<'kdc' | 'kdv', number>>;
  /** Jahresumsatzziel je Firma (gesamt: Controlling). */
  ziele?: Partial<Record<'kdc' | 'kdv', number>>;
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

const FIRMEN = ['kdc', 'kdv'] as const;

/** Zählt eigene Schreibvorgänge — Zwischenspeicher (Jarvis, Head of Finance) wissen so, wann sie neu rechnen müssen. */
let schreibStand = 0;
export const businessSchreibStand = () => schreibStand;
const zahlOder = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : undefined);

export async function ladeEinstellungen(): Promise<BusinessEinstellungen> {
  const e = await loadJson<BusinessEinstellungen>(EINSTELLUNGEN);
  return { fte: e?.fte ?? {}, ziele: e?.ziele ?? {}, schwellen: e?.schwellen ?? {} };
}

/** Die geltenden eigenen Schwellen einer Sicht: „alle“, überschrieben von der Sicht selbst. */
export const schwellenFuer = (e: BusinessEinstellungen, scope: Scope): Record<string, Schwelle> => ({ ...(e.schwellen?.alle ?? {}), ...(e.schwellen?.[scope] ?? {}) });

/**
 * Einstellungen ändern — Köpfe, Jahresziele je Firma, eigene Schwellen
 * ({ schwelle: { id, sicht: 'alle'|Sicht, gruen, rot } } oder { …, zuruecksetzen: true }).
 */
export async function speichereEinstellungen(roh: Record<string, unknown>): Promise<{ ok: true; einstellungen: BusinessEinstellungen } | { ok: false; fehler: string }> {
  let fehler: string | null = null;
  const e = await updateJson<BusinessEinstellungen>(EINSTELLUNGEN, alt => {
    const neu: BusinessEinstellungen = { fte: { ...(alt?.fte ?? {}) }, ziele: { ...(alt?.ziele ?? {}) }, schwellen: { ...(alt?.schwellen ?? {}) } };
    const zahlen = (quelle: unknown, ziel: Partial<Record<'kdc' | 'kdv', number>>, max: number, stellen: number) => {
      const r = (quelle ?? {}) as Record<string, unknown>;
      for (const f of FIRMEN) if (f in r) { const n = zahlOder(r[f]); if (n == null || n <= 0) delete ziel[f]; else ziel[f] = Math.min(max, Math.round(n * stellen) / stellen); }
    };
    if (roh.fte) zahlen(roh.fte, neu.fte, 500, 10);
    if (roh.ziele) zahlen(roh.ziele, neu.ziele!, 1e9, 1);
    if (roh.schwelle && typeof roh.schwelle === 'object') {
      const s = roh.schwelle as Record<string, unknown>;
      const sicht = (['alle', ...SCOPES.map(x => x.id)] as const).find(x => x === s.sicht);
      const id = String(s.id ?? '');
      if (!sicht) { fehler = 'Sicht fehlt (alle, gesamt, kdc oder kdv).'; return alt ?? neu; }
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
  return fehler ? { ok: false, fehler } : { ok: true, einstellungen: e };
}

export async function ladeAbschluesse(): Promise<Monatsabschluss[]> {
  return (await loadJson<{ eintraege: Monatsabschluss[] }>(ABSCHLUESSE))?.eintraege ?? [];
}

export const ABSCHLUSS_FELDER = ['umsatz', 'kosten', 'personal', 'marketingVertrieb', 'afa', 'eigenkapital', 'bilanzsumme', 'kurzfrVerbindlichkeiten', 'bankschulden'] as const;

/** Monatsabschluss eintragen oder ändern (je Firma und Monat). Leeres Feld = entfernen. */
export async function speichereAbschluss(roh: Record<string, unknown>, von: string): Promise<{ ok: true; eintrag: Monatsabschluss } | { ok: false; fehler: string }> {
  const firma = FIRMEN.find(f => f === roh.firma);
  const monat = typeof roh.monat === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(roh.monat) ? roh.monat : null;
  if (!firma) return { ok: false, fehler: 'Firma fehlt (Consulting oder KD Ventures).' };
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

export async function loescheAbschluss(firma: string, monat: string): Promise<void> {
  schreibStand++;
  await updateJson<{ eintraege: Monatsabschluss[] }>(ABSCHLUESSE, alt => ({ eintraege: (alt?.eintraege ?? []).filter(x => !(x.firma === firma && x.monat === monat)) }));
}

const monatlich = (f: { brutto: number; rhythmus: string }) => (f.rhythmus === 'yearly' ? f.brutto / 12 : f.rhythmus === 'quarterly' ? f.brutto / 3 : f.brutto);

/** Alles, was der Index braucht — einmal geladen, für alle drei Sichten. */
export async function ladeRoh(heute = localDay()) {
  const [fp, lp, fin, grund, abschluesse, crm, kartei, cal, plan, auftraege, ms, einst, verlauf] = await Promise.all([
    loadJson<{ firmen?: Firma[]; rechnungen?: (Rechnung & { firmaId?: string })[]; zahlungen?: Zahlung[]; merkposten?: Merkposten[] }>('finanzplan'),
    loadJson<{ posten?: Planposten[] }>('liquiplan'),
    loadJson<FinanceState>('finance'),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
    ladeAbschluesse(),
    ladeCrm(),
    loadJson<{ kontakte: Kontakt[] }>('kontakte'),
    loadJson<{ events?: { startDate?: string; endDate?: string; allDay?: boolean; owner?: string }[]; quelle?: string }>('calendar-cache'),
    loadJson<Record<string, PlanBlock[]>>('wochenplan'),
    loadJson<{ auftraege?: { status: string; beendet?: string; zeit?: string; anlass?: string }[] }>('jarvis-auftraege'),
    loadJson<{ meilensteine?: { bereich: string; faellig?: string; fortschritt: number; erledigt: boolean }[] }>('meilensteine'),
    ladeEinstellungen(),
    loadJson<BusinessVerlauf>(VERLAUF),
  ]);
  // V1-Export: nur die Business-Teile. Umsatz/Kosten = Selbständigkeit (Consulting);
  // Fixkosten getrennt: s = Selbständigkeit, u = UG. Private Kredite (p.sch) bleiben draußen.
  const g = grund?.roh ? lesen(grund.roh, grund.stand) : null;
  const fixS = (grund?.roh?.s?.fixk ?? []).length, fixU = (grund?.roh?.u?.fixk ?? []).length;
  const fixListe = g?.fixkosten ?? [];
  const grundlageFixkosten = {
    kdc: fixListe.slice(fixU, fixU + fixS).reduce((s, f) => s + monatlich(f), 0),
    kdv: fixListe.slice(0, fixU).reduce((s, f) => s + monatlich(f), 0),
  };
  const kontakte = kartei?.kontakte ?? [];
  const tr = traktion({ sales: kennzahlen(kontakte, crm, heute), marketing: marketingKennzahlen(kontakte, crm, heute), event: eventKennzahlen(kontakte, crm, heute) });
  const ab = new Date(`${heute}T12:00:00`); ab.setDate(ab.getDate() - 35);
  const abTag = localDay(ab);
  return {
    heute,
    firmen: fp?.firmen ?? [], rechnungen: fp?.rechnungen ?? [], zahlungen: fp?.zahlungen ?? [], merkposten: fp?.merkposten ?? [],
    planposten: lp?.posten ?? [], finance: fin ?? null,
    grundlageMonate: g ? monatsBild(g).map(m => ({ monat: m.monat, umsatzNetto: m.umsatzNetto, kostenNetto: m.kostenNetto })) : [],
    grundlageFixkosten,
    abschluesse, mandate: crm.mandate, chancen: crm.chancen,
    traktion: { score: tr.score, text: tr.score != null ? `${tr.welten.map(w => `${w.label} ${w.score ?? '—'}`).join(' · ')}${tr.vorlaeufig ? ' (vorläufig)' : ''}` : tr.hinweis },
    termine: (cal?.events ?? []).filter(e => !e.allDay && e.startDate && e.endDate).map(e => ({ start: e.startDate!, ende: e.endDate!, owner: e.owner })),
    termineVollstaendig: cal?.quelle === 'icloud',
    bloecke: Object.entries(plan ?? {}).filter(([woche]) => woche >= localDay(new Date(ab.getTime() - 7 * 86_400_000))).flatMap(([, l]) => (l ?? []).filter(x => x.date >= abTag)).map(x => ({ date: x.date, dauerMin: x.dauerMin, art: x.art })),
    auftraege: auftraege?.auftraege ?? [],
    meilensteine: ms?.meilensteine ?? [],
    fte: einst.fte,
    ziele: einst.ziele ?? {},
    einstellungen: einst,
    verlauf: verlauf ?? { tage: {}, mrr: {} },
  };
}

export type Roh = Awaited<ReturnType<typeof ladeRoh>>;

export function bestandFuer(r: Roh, scope: Scope): Bestand {
  const mrrVerlauf: Record<string, Record<string, number>> = {};
  for (const [m, je] of Object.entries(r.verlauf.mrr ?? {})) if (je[scope]) mrrVerlauf[m] = je[scope]!;
  // Der laufende Monat immer aus dem aktuellen Stand.
  mrrVerlauf[r.heute.slice(0, 7)] = mrrJeKunde(r.mandate, scope);
  const { verlauf: _v, einstellungen, ...rest } = r;
  return { ...rest, scope, mrrVerlauf, schwellen: schwellenFuer(einstellungen, scope) };
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
export async function alleSichten(heute = localDay()): Promise<{ roh: Roh; ergebnis: Record<Scope, BusinessIndex> }> {
  const roh = await ladeRoh(heute);
  const ergebnis = Object.fromEntries(SCOPES.map(s => [s.id, berechne(bestandFuer(roh, s.id))])) as Record<Scope, BusinessIndex>;
  if (!roh.verlauf.tage?.[heute]) await schnappschuss(roh, ergebnis).catch(() => {});
  return { roh, ergebnis };
}
