// ─── Produkte · Leistungstreppe — die Rechnungen (rein, client-sicher, getestet) ────────────────────────────────────
// Aus dem Bestand der Treppe (lib/crm/treppe-daten.ts) und den VORHANDENEN CRM-Daten (Mandate, Produkte, Deals) — nichts davon wird doppelt
// gespeichert:
//   ebenenVon        die Treppe in Ebenen (gleiche Ebene = Alternativen nebeneinander)
//   stufeVonMandat   in welcher Stufe ein Kunde steht: gewählt (Fortschritt) vor abgeleitet (Produkt des Mandats ∈ Leistungen der Stufe)
//   kundenZeilen     je aktivem Mandat: Stufe, aktueller Schritt (= Phase des Mandats), Lieferobjekte, nächster Schritt, Health-Ampel
//                    (Termine · Lieferungen · Zahlungen · Zufriedenheit — Zahlung/Stimmung aus der vorhandenen Mandat-Health), „nächste Stufe“
//                    nach Regel und ob ein Fortschritts-Report fällig ist (alle zwei Wochen)
//   zielbild         Ziel gegen Ist je Stufe im Zieljahr (Umsatz, Kunden) und die Übergänge zwischen den Stufen
//   kundenreise      die Stationen des Kreislaufs mit Ist (aus der verknüpften Stufe bzw. von Hand)
//   kapaBedarf       Aufwand der Kunden in den Stufen je Woche (→ Kapazität) und die Plätze je Stufe (Kapazitätsgrenze)

import type { CrmBestand, Mandat, Leistung } from './typen';
import { mandatLage } from './kunden';
import { mandatPhase } from './produkte';
import { tagPlus } from '@/lib/kalender/zeit';
import { tagVon } from '@/lib/zeit';
import { bereichVonGesellschaft } from '@/lib/einheiten';

/**
 * Nur Business (Prüf-Fund 11.10.): Mandate und Deals einer Privat-Einheit (z. B. der Selbstständigkeit, je Instanz) zählen nicht in der
 * Leistungstreppe, im Zielbild und im Kreislauf der Planung — die Treppe ist ein Business-Bestand. EINE Filterstelle (Server rechnet hiermit).
 */
export const imBusiness = (x: { gesellschaft?: string | null }): boolean => bereichVonGesellschaft(x.gesellschaft) === 'business';
import type { TreppeDatei, TreppenStufe, KundenFortschritt, ReportStand } from './treppe-daten';

/** Alle so viele Tage je aktivem Mandat ein Vorschlag „Fortschritts-Report“ (Entscheidung 10.10.). */
export const REPORT_TAGE = 14;
/** Ein neues Mandat bekommt den ersten Vorschlag frühestens nach so vielen Tagen. */
export const REPORT_ERSTER_NACH = 7;

export interface EbeneGruppe<T extends TreppenStufe = TreppenStufe> { ebene: number; stufen: T[] }
/** Die Treppe in Ebenen (aufsteigend), darin nach Name — gleiche Ebene = Alternativen. */
export function ebenenVon<T extends TreppenStufe>(stufen: readonly T[]): EbeneGruppe<T>[] {
  const je = new Map<number, T[]>();
  for (const s of stufen) je.set(s.ebene, [...(je.get(s.ebene) ?? []), s]);
  return Array.from(je.entries()).sort(([a], [b]) => a - b).map(([ebene, l]) => ({ ebene, stufen: [...l].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** Die Stufe eines Kunden: gewählt (Fortschritt) vor abgeleitet (das Produkt des Mandats ist eine Leistung der Stufe, die niedrigste Ebene). */
export function stufeVonMandat(m: Pick<Mandat, 'id' | 'leistungId'>, d: Pick<TreppeDatei, 'stufen' | 'kunden'>): { stufe: TreppenStufe; quelle: 'hand' | 'produkt' } | null {
  const gewaehlt = d.kunden[m.id]?.stufeId;
  const s = gewaehlt ? d.stufen.find(x => x.id === gewaehlt) : undefined;
  if (s) return { stufe: s, quelle: 'hand' };
  if (!m.leistungId) return null;
  const passend = d.stufen.filter(x => x.leistungIds.includes(m.leistungId!)).sort((a, b) => a.ebene - b.ebene || a.name.localeCompare(b.name));
  return passend[0] ? { stufe: passend[0], quelle: 'produkt' } : null;
}

/** Die Stufen der nächsthöheren Ebene (Alternativen) — leer auf der obersten Ebene. */
export function naechsteStufen(s: Pick<TreppenStufe, 'ebene'>, stufen: readonly TreppenStufe[]): TreppenStufe[] {
  const hoeher = stufen.filter(x => x.ebene > s.ebene);
  if (!hoeher.length) return [];
  const e = Math.min(...hoeher.map(x => x.ebene));
  return hoeher.filter(x => x.ebene === e).sort((a, b) => a.name.localeCompare(b.name));
}

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type AmpelTeilId = 'termine' | 'lieferungen' | 'zahlungen' | 'zufriedenheit';
export interface AmpelTeil { id: AmpelTeilId; label: string; farbe: Ampel | null; text: string }
const RANG: Record<Ampel, number> = { gruen: 0, gelb: 1, rot: 2 };
/** Die schlechteste Farbe — null, wenn keine bewertet ist. */
export const schlechteste = (l: readonly (Ampel | null | undefined)[]): Ampel | null => l.reduce<Ampel | null>((a, x) => (x && (!a || RANG[x] > RANG[a]) ? x : a), null);
const ausWert = (v: number | null | undefined): Ampel | null => (typeof v === 'number' ? (v > 75 ? 'gruen' : v >= 60 ? 'gelb' : 'rot') : null);
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

/** Seit wann steht der Kunde in seiner Stufe? Letzter Eintrag im Verlauf für diese Stufe, sonst der Start des Mandats. */
export function stufeSeit(m: Pick<Mandat, 'start'>, f: KundenFortschritt | undefined, stufeId: string): string | undefined {
  const v = [...(f?.verlauf ?? [])].reverse().find(x => x.stufeId === stufeId);
  return v?.ab ?? m.start?.slice(0, 10);
}

export interface Reife { stufen: { id: string; name: string }[]; grund: string }
/**
 * Regel „nächste Stufe vorschlagen“: die Stufe ist erreicht, wenn (a) alle Lieferobjekte erledigt sind, (b) das Mandat in der letzten Phase
 * seines Produkts steht oder (c) die Dauer der Stufe um ist — und es eine höhere Ebene gibt. Sonst null.
 */
export function stufeReif(e: { stufe: TreppenStufe; stufen: readonly TreppenStufe[]; erledigt: readonly string[]; phase: { nr: number; von: number } | null; seit?: string; heute: string }): Reife | null {
  const naechste = naechsteStufen(e.stufe, e.stufen);
  if (!naechste.length) return null;
  const l = e.stufe.lieferobjekte;
  const grund = l.length && l.every(x => e.erledigt.includes(x)) ? 'alle Lieferobjekte erledigt'
    : e.phase && e.phase.von >= 2 && e.phase.nr === e.phase.von ? 'letzte Phase des Produkts erreicht'
    : e.stufe.dauerTage && e.seit && tageZwischen(e.seit, e.heute) >= e.stufe.dauerTage ? `Dauer der Stufe (${e.stufe.dauerTage} Tage) ist um`
    : null;
  return grund ? { stufen: naechste.map(s => ({ id: s.id, name: s.name })), grund } : null;
}

const tagDes = (x: string) => (x.length > 10 ? tagVon(x) : x);
/**
 * EINE Regel „wann ist der nächste Report fällig“ (17.10., Gesamtprüfung L2 A1 — vorher rechneten Treppe/Hänger und die Report-Zeitachse im Fall
 * verschieden): letzter erstellter bzw. gesendeter Report + `REPORT_TAGE`, ohne Report der Start + `REPORT_ERSTER_NACH`. Treppe, Hänger im Fall-Kopf,
 * Report-Zeitachse (lib/fulfillment/prozesse/ansichten.ts `reportAchse`) und Kennzahl lesen nur sie. Ohne Start und ohne Report: null.
 */
export function reportNaechsterFaellig(start: string | undefined, letzter: string | undefined): string | null {
  if (letzter) return tagPlus(tagDes(letzter), REPORT_TAGE);
  return start ? tagPlus(tagDes(start), REPORT_ERSTER_NACH) : null;
}

/**
 * Ist ein Fortschritts-Report fällig? Nach `reportNaechsterFaellig`. Ein VORSCHLAG zählt nicht als Report (17.10., L2 A1: vorher setzte der Vorschlag
 * die Marke `report:<m>` und der Hänger verschwand für 14 Tage, obwohl kein Report entstand) — die Marke bremst nur das erneute Vorschlagen (treppe-server).
 */
export function reportFaellig(m: Pick<Mandat, 'status' | 'start'>, r: ReportStand | undefined, heute: string): { faellig: boolean; letzter?: string } {
  if (m.status !== 'aktiv') return { faellig: false };
  const letzter = [r?.erstelltAm, r?.gesendetAm].filter((x): x is string => !!x).map(tagDes).sort().pop();
  const n = reportNaechsterFaellig(m.start, letzter);
  return { faellig: !n || n <= heute, ...(letzter ? { letzter } : {}) };
}

export interface KundenZeile {
  mandatId: string;
  kunde: string;
  titel: string;
  status: Mandat['status'];
  zustaendig?: string;
  stufe: { id: string; name: string; ebene: number } | null;
  stufeQuelle: 'hand' | 'produkt' | null;
  stufeSeit?: string;
  /** Aktueller Schritt = Phase des Mandats im Ablauf seines Produkts. */
  schritt: { nr: number; von: number; name: string; naechste?: string } | null;
  lieferobjekte: { was: string; erledigt: boolean; am?: string }[];
  naechster?: { text: string; datum: string; ueberfaellig: boolean };
  ampel: { gesamt: Ampel | null; teile: AmpelTeil[] };
  naechsteStufe: Reife | null;
  report: { faellig: boolean; letzter?: string; erstelltAm?: string; dateiId?: string; gesendetAm?: string };
}

/** Health-Ampel eines Kunden: Termine · Lieferungen · Zahlungen · Zufriedenheit — dazu die Ampel der Mandat-Health (Laufzeit, Health). */
export function kundenAmpel(e: {
  m: Mandat; stufe: TreppenStufe | null; f: KundenFortschritt | undefined; seit?: string; heute: string; zahlung?: number | null;
  /** Der nächste Termin im Kalender (Fulfillment `naechsterFallTermin`, 14.10.) — sonst wie bisher nur nächster Schritt und Review. */
  termin?: string;
}): { gesamt: Ampel | null; teile: AmpelTeil[] } {
  const { m, stufe, f, heute } = e;
  // Termine: der nächste Termin im Kalender (Rituale des Falls), der nächste Schritt (Fortschritt) bzw. das nächste Review am Mandat — der früheste zählt.
  const termine = [e.termin, f?.naechster?.datum, m.naechstesReview?.slice(0, 10)].filter((x): x is string => !!x).sort();
  const ueber = termine.find(t => t < heute);
  const kommend = termine.find(t => t >= heute);
  const t: AmpelTeil = ueber ? { id: 'termine', label: 'Termine', farbe: 'rot', text: `überfällig seit ${kurz(ueber)}` }
    : kommend ? { id: 'termine', label: 'Termine', farbe: 'gruen', text: `nächster am ${kurz(kommend)}` }
    // Ein neues Mandat (die ersten 14 Tage) startet grün: den ersten Termin legt das Onboarding (Kick-off) fest — „kein Termin“ ist dann kein Warnzeichen
    // (17.10., Gesamtprüfung — maximal einfach: ein frisch gestarteter Fall stand sonst gleich gelb da).
    : m.start && tageZwischen(m.start.slice(0, 10), heute) <= 14 ? { id: 'termine', label: 'Termine', farbe: null, text: 'erster Termin kommt mit dem Kick-off' }
    : { id: 'termine', label: 'Termine', farbe: 'gelb', text: 'kein nächster Termin' };
  // Lieferungen: erledigte Lieferobjekte gegen den Anteil der Dauer, der schon vergangen ist.
  let l: AmpelTeil = { id: 'lieferungen', label: 'Lieferungen', farbe: null, text: 'keine Lieferobjekte in der Stufe' };
  if (stufe?.lieferobjekte.length) {
    const n = stufe.lieferobjekte.length;
    const erledigt = stufe.lieferobjekte.filter(x => f?.erledigt.some(y => y.was === x)).length;
    if (stufe.dauerTage && e.seit) {
      const soll = Math.ceil(n * Math.min(1, Math.max(0, tageZwischen(e.seit, heute)) / stufe.dauerTage) - 1e-9);
      l = { id: 'lieferungen', label: 'Lieferungen', farbe: erledigt >= soll ? 'gruen' : erledigt >= soll - 1 ? 'gelb' : 'rot', text: `${erledigt} von ${n} geliefert (fällig: ${soll})` };
    } else l = { id: 'lieferungen', label: 'Lieferungen', farbe: erledigt === n ? 'gruen' : null, text: `${erledigt} von ${n} geliefert` };
  }
  const zw = m.health.zahlung ?? e.zahlung ?? null;
  const z: AmpelTeil = { id: 'zahlungen', label: 'Zahlungen', farbe: ausWert(zw), text: zw == null ? 'noch nicht bewertet' : `Gesundheit ${zw}` };
  const s: AmpelTeil = { id: 'zufriedenheit', label: 'Zufriedenheit', farbe: ausWert(m.health.stimmung), text: m.health.stimmung == null ? 'noch nicht bewertet' : `Stimmung ${m.health.stimmung}` };
  const teile = [t, l, z, s];
  const lage = mandatLage(m, heute);
  return { gesamt: schlechteste([...teile.map(x => x.farbe), lage.ampel]), teile };
}

/** Je aktivem (bzw. pausiertem) Mandat die Zeile „Fortschritt im Paket“. */
export function kundenZeilen(e: { datei: TreppeDatei; crm: Pick<CrmBestand, 'mandate' | 'leistungen'>; heute: string; zahlung?: Record<string, { wert: number } | undefined>; termine?: Readonly<Record<string, string | undefined>> }): KundenZeile[] {
  const { datei, crm, heute } = e;
  const leistung = new Map<string, Leistung>(crm.leistungen.map(l => [l.id, l]));
  return crm.mandate.filter(m => !m.geloeschtAm && (m.status === 'aktiv' || m.status === 'pausiert') && imBusiness(m)).map(m => {
    const f = datei.kunden[m.id];
    const st = stufeVonMandat(m, datei);
    const stufe = st?.stufe ?? null;
    const seit = stufe ? stufeSeit(m, f, stufe.id) : undefined;
    const l = m.leistungId ? leistung.get(m.leistungId) : undefined;
    const schritt = mandatPhase(m, l);
    const erledigt = (f?.erledigt ?? []).map(x => x.was);
    const r = datei.reports[m.id];
    const rep = reportFaellig(m, r, heute);
    return {
      mandatId: m.id, kunde: m.kunde, titel: m.titel, status: m.status, ...(m.zustaendig ? { zustaendig: m.zustaendig } : {}),
      stufe: stufe ? { id: stufe.id, name: stufe.name, ebene: stufe.ebene } : null, stufeQuelle: st?.quelle ?? null, ...(seit ? { stufeSeit: seit } : {}),
      schritt,
      lieferobjekte: (stufe?.lieferobjekte ?? []).map(was => { const x = f?.erledigt.find(y => y.was === was); return { was, erledigt: !!x, ...(x ? { am: x.am } : {}) }; }),
      ...(f?.naechster ? { naechster: { ...f.naechster, ueberfaellig: f.naechster.datum < heute } } : {}),
      ampel: kundenAmpel({ m, stufe, f, seit, heute, zahlung: e.zahlung?.[m.id]?.wert ?? null, ...(e.termine?.[m.id] ? { termin: e.termine[m.id] } : {}) }),
      naechsteStufe: stufe ? stufeReif({ stufe, stufen: datei.stufen, erledigt, phase: schritt, seit, heute }) : null,
      report: { ...rep, ...(r?.erstelltAm ? { erstelltAm: r.erstelltAm } : {}), ...(r?.dateiId ? { dateiId: r.dateiId } : {}), ...(r?.gesendetAm ? { gesendetAm: r.gesendetAm } : {}) },
    };
  }).sort((a, b) => (a.stufe?.ebene ?? 99) - (b.stufe?.ebene ?? 99) || a.kunde.localeCompare(b.kunde));
}

// ── Zielbild ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Monate (JJJJ-MM), die zwischen zwei Tagen liegen (beide eingeschlossen). */
function monateZwischen(von: string, bis: string): number {
  if (bis < von) return 0;
  return (Number(bis.slice(0, 4)) - Number(von.slice(0, 4))) * 12 + Number(bis.slice(5, 7)) - Number(von.slice(5, 7)) + 1;
}

/** Umsatz eines Mandats im Jahr bis heute (netto): Monatshonorar × aktive Monate; einmalig im Startjahr; Tagessätze zählen hier nicht. */
export function umsatzImJahr(m: Pick<Mandat, 'status' | 'start' | 'ende' | 'honorar'>, jahr: number, heute: string): number {
  if (!['aktiv', 'pausiert', 'beendet'].includes(m.status) || !m.start) return 0;
  const start = m.start.slice(0, 10);
  if (m.honorar.basis === 'einmalig') return start.slice(0, 4) === String(jahr) && start <= heute ? m.honorar.betrag : 0;
  if (m.honorar.basis !== 'monat') return 0;
  const von = start > `${jahr}-01-01` ? start : `${jahr}-01-01`;
  const bis = [m.ende?.slice(0, 10), heute, `${jahr}-12-31`].filter((x): x is string => !!x).sort()[0];
  return Math.round(m.honorar.betrag * monateZwischen(von, bis) * 100) / 100;
}
const imJahr = (m: Pick<Mandat, 'status' | 'start' | 'ende'>, jahr: number) =>
  ['aktiv', 'pausiert', 'beendet'].includes(m.status) && (!m.start || m.start.slice(0, 4) <= String(jahr)) && (!m.ende || m.ende.slice(0, 4) >= String(jahr));

export interface ZielbildZeile { stufeId: string; name: string; ebene: number; ziel: { umsatz?: number; kunden?: number }; ist: { umsatz: number; kunden: number } }
export interface Zielbild {
  jahr: number;
  zeilen: ZielbildZeile[];
  summe: { zielUmsatz: number; istUmsatz: number; zielKunden: number; istKunden: number };
  /** Übergänge zwischen Stufen im Zieljahr (aus dem Verlauf je Kunde). */
  uebergaenge: { von: string; nach: string; anzahl: number }[];
}
/** Ziel gegen Ist je Stufe (Zieljahr): Umsatz aus den Mandaten der Stufe, Kunden aus Mandaten + Deals auf den Leistungen der Stufe. */
export function zielbild(e: { datei: TreppeDatei; crm: Pick<CrmBestand, 'mandate' | 'chancen'>; heute: string }): Zielbild {
  const { datei, crm, heute } = e;
  const jahr = datei.zielJahr;
  const zeilen: ZielbildZeile[] = datei.stufen.map(s => ({ stufeId: s.id, name: s.name, ebene: s.ebene, ziel: s.ziel ?? {}, ist: { umsatz: 0, kunden: 0 } }));
  const nach = new Map(zeilen.map(z => [z.stufeId, z]));
  const gezaehlt = new Map<string, Set<string>>(zeilen.map(z => [z.stufeId, new Set<string>()]));
  for (const m of crm.mandate) {
    if (m.geloeschtAm || !imJahr(m, jahr) || !imBusiness(m)) continue;
    const st = stufeVonMandat(m, datei);
    if (!st) continue;
    const z = nach.get(st.stufe.id)!;
    z.ist.umsatz = Math.round((z.ist.umsatz + umsatzImJahr(m, jahr, heute)) * 100) / 100;
    const key = m.firmaId ?? `m:${m.id}`;
    if (!gezaehlt.get(z.stufeId)!.has(key)) { gezaehlt.get(z.stufeId)!.add(key); z.ist.kunden++; }
  }
  // Deals auf den Leistungen einer Stufe (z. B. kostenlose Einstiegsstufen ohne Mandat) — angelegt im Zieljahr, je Firma einmal.
  for (const c of crm.chancen) {
    if (!c.leistungId || (c.angelegt ?? '').slice(0, 4) !== String(jahr) || !imBusiness(c)) continue;
    for (const s of datei.stufen) {
      if (!s.leistungIds.includes(c.leistungId)) continue;
      const key = c.firmaId ?? `c:${c.id}`;
      const g = gezaehlt.get(s.id)!;
      if (!g.has(key)) { g.add(key); nach.get(s.id)!.ist.kunden++; }
    }
  }
  const name = new Map(datei.stufen.map(s => [s.id, s.name]));
  const ue = new Map<string, number>();
  for (const f of Object.values(datei.kunden)) {
    for (let i = 1; i < f.verlauf.length; i++) {
      const a = f.verlauf[i - 1], b = f.verlauf[i];
      if (b.ab.slice(0, 4) !== String(jahr) || !name.has(a.stufeId) || !name.has(b.stufeId) || a.stufeId === b.stufeId) continue;
      const k = `${a.stufeId}>${b.stufeId}`;
      ue.set(k, (ue.get(k) ?? 0) + 1);
    }
  }
  const summe = zeilen.reduce((a, z) => ({ zielUmsatz: a.zielUmsatz + (z.ziel.umsatz ?? 0), istUmsatz: a.istUmsatz + z.ist.umsatz, zielKunden: a.zielKunden + (z.ziel.kunden ?? 0), istKunden: a.istKunden + z.ist.kunden }), { zielUmsatz: 0, istUmsatz: 0, zielKunden: 0, istKunden: 0 });
  return {
    jahr, zeilen: zeilen.sort((a, b) => a.ebene - b.ebene || a.name.localeCompare(b.name)), summe: { ...summe, istUmsatz: Math.round(summe.istUmsatz * 100) / 100 },
    uebergaenge: Array.from(ue.entries()).map(([k, anzahl]) => { const [a, b] = k.split('>'); return { von: name.get(a)!, nach: name.get(b)!, anzahl }; }).sort((x, y) => y.anzahl - x.anzahl),
  };
}

/** Die Kundenreise: jede Station mit Ziel und Ist — Ist aus der verknüpften Stufe (Kunden im Zieljahr), sonst von Hand. */
export function kundenreise(datei: TreppeDatei, z: Zielbild): { id: string; name: string; messgroesse?: string; ziel?: number; ist: number | null; istQuelle: 'stufe' | 'hand' | null; stufe?: string }[] {
  const zeile = new Map(z.zeilen.map(x => [x.stufeId, x]));
  return datei.kreislauf.map(s => {
    const st = s.stufeId ? zeile.get(s.stufeId) : undefined;
    return {
      id: s.id, name: s.name, ...(s.messgroesse ? { messgroesse: s.messgroesse } : {}), ...(s.ziel !== undefined ? { ziel: s.ziel } : {}),
      ist: st ? st.ist.kunden : s.ist ?? null, istQuelle: st ? 'stufe' as const : s.ist !== undefined ? 'hand' as const : null, ...(st ? { stufe: st.name } : {}),
    };
  });
}

// ── Kapazität ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KapaBedarf {
  jeStufe: { stufeId: string; name: string; kunden: number; stundenWoche: number; max?: number; voll: boolean; ueber: boolean }[];
  stundenWoche: number;
  /** Stufen mit Kunden, aber ohne Aufwand bzw. ohne Dauer (Annahme vier Wochen) — offen gesagt. */
  ohneAufwand: string[];
  annahmeDauer: string[];
}
/**
 * Aufwand der Kunden in ihren Stufen je Woche: Monats-Pakete Aufwand × 12 ÷ 52, Jahres-Pakete ÷ 52, sonst über die Dauer der Stufe verteilt
 * (ohne Dauer: Annahme vier Wochen). Dazu die belegten Plätze gegen „höchstens N gleichzeitig“.
 */
/**
 * Stunden je Woche, die EIN Kunde in dieser Stufe bindet (aus `aufwandStunden`: je Monat ×12/52, je Jahr /52, sonst über die Dauer; ohne Dauer /4 — Annahme).
 * EINE Rechnung für die Treppe (`kapaBedarf`) und den Kapazitäts-Vorschlag am Fall (18.10.). Ohne Aufwand: 0.
 */
export function stufeStundenWoche(s: Pick<TreppenStufe, 'aufwandStunden' | 'preis' | 'dauerTage'>): { stunden: number; annahme: boolean } {
  if (!s.aufwandStunden) return { stunden: 0, annahme: false };
  if (s.preis.art === 'monat') return { stunden: (s.aufwandStunden * 12) / 52, annahme: false };
  if (s.preis.art === 'jahr') return { stunden: s.aufwandStunden / 52, annahme: false };
  if (s.dauerTage) return { stunden: s.aufwandStunden / Math.max(1, s.dauerTage / 7), annahme: false };
  return { stunden: s.aufwandStunden / 4, annahme: true };
}

export function kapaBedarf(datei: TreppeDatei, zeilen: readonly KundenZeile[]): KapaBedarf {
  const jeStufe: KapaBedarf['jeStufe'] = [];
  const ohneAufwand: string[] = [], annahmeDauer: string[] = [];
  for (const s of [...datei.stufen].sort((a, b) => a.ebene - b.ebene)) {
    const kunden = zeilen.filter(z => z.stufe?.id === s.id && z.status === 'aktiv').length;
    const w = stufeStundenWoche(s);
    const je = w.stunden;
    if (s.aufwandStunden) { if (w.annahme && kunden) annahmeDauer.push(s.name); } else if (kunden) ohneAufwand.push(s.name);
    const max = s.regeln.maxGleichzeitig;
    jeStufe.push({ stufeId: s.id, name: s.name, kunden, stundenWoche: Math.round(je * kunden * 10) / 10, ...(max ? { max } : {}), voll: !!max && kunden >= max, ueber: !!max && kunden > max });
  }
  return { jeStufe, stundenWoche: Math.round(jeStufe.reduce((a, x) => a + x.stundenWoche, 0) * 10) / 10, ohneAufwand, annahmeDauer };
}

/** Wie der Preis einer Stufe heißt: „kostenlos“, „4.800 € fest“, „3.500 € je Monat“ … */
export function preisText(p: TreppenStufe['preis']): string {
  if (p.art === 'kostenlos') return 'kostenlos';
  if (!p.betrag) return p.art === 'fest' ? 'Festpreis offen' : p.art === 'monat' ? 'je Monat, Preis offen' : 'je Jahr, Preis offen';
  const b = `${p.betrag.toLocaleString('de-DE')} €`;
  return p.art === 'fest' ? `${b} Festpreis` : p.art === 'monat' ? `${b} je Monat` : `${b} je Jahr`;
}
