// ─── Essen nach WHOOP — Orientierung, Belastungstage, Ergänzungen (09.10.2026, rein, getestet) ─────────────────────────
// Wunsch (Sport-Fragebogen, 09.10.): „gesund & einfach“ essen — NUR Plan, kein Tracking; das Essen soll sich nach den WHOOP-Kalorien
// richten; im Blick: Ergänzungen und Trinken. Alltagsbewegung zählt mit, wenn WHOOP-Schritte bzw. der laufende Strain da sind.
//
// Drei reine Teile:
//   1. `essenOrientierung` — „heute eher mehr / wie sonst / eher leichter“ aus den EIGENEN Werten: Ø Energie (kcal) der 7 Tage davor,
//      Strain gestern und bisher heute gegen den eigenen Ø, Schritte bisher heute gegen den eigenen Ø, Trainingsplan des Wochentags.
//      Keine Kalorienzählerei (keine Ziel-Zahl, kein Soll), keine Ernährungsberatung — ein Satz und die Gründe.
//   2. `belastungsTage` — welche Wochentage für den Haushalt harte Belastungstage sind (Trainingsplan, sonst die Strain-Geschichte),
//      OHNE Personen: der Wochenplan-Vorschlag bekommt nur Wochentage, nie Namen (lib/ernaehrung/neutral.ts gilt weiter).
//   3. `ERGAENZUNG_VORLAGEN` — Vorlagen für eigene Routinen (Protein, Kreatin, Elektrolyte, Trinkziel) OHNE Mengenempfehlung: die
//      Person trägt ihre eigene Menge ein, die Routine gehört ihr (owner = sie), andere sehen nur „Belegt“.

import type { VitalsLog } from '@/lib/vitals';
import { tagePlus } from '@/lib/zeit';

export type Belastung = 'hart' | 'training' | 'ruhe' | 'frei';
export type WTag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
export const W_TAGE: readonly WTag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
const W_LABEL: Record<WTag, string> = { mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag', so: 'Sonntag' };

/** Ein Trainingstag gilt ab dieser Dauer (Minuten) als hart — auch ohne Hyrox. */
export const HART_AB_MIN = 75;
/** Strain-Ø eines Wochentags (4 Wochen), ab dem er ohne Plan als harter Tag gilt. */
export const STRAIN_HART = 14;
/** Abstände für „mehr“: Strain bisher heute ≥ Ø + 2, Strain gestern ≥ Ø + 3, Schritte bisher ≥ Ø × 1,3. */
export const STRAIN_MEHR = 2;
export const STRAIN_GESTERN_MEHR = 3;
export const SCHRITTE_FAKTOR = 1.3;
export const SCHRITTE_MIN = 1000;
/** Ø-Werte erst ab so vielen Tagen. */
export const ORIENTIERUNG_MIN_TAGE = 3;

export const ESSEN_HINWEIS = 'Orientierung aus deinen WHOOP-Werten — kein Kalorienzählen, keine Ernährungsberatung.';

/** Wochentag eines Kalendertags (UTC-Mittag, zeitzonenfest). */
export function wTagVon(tag: string): WTag {
  return (['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'] as const)[new Date(`${tag}T12:00:00Z`).getUTCDay()];
}

/** Belastung eines Plan-Tags (Sport-Wochenplan: Art + Dauer). Unbekannt → null. */
export function planBelastung(t: { art?: unknown; dauerMin?: unknown } | null | undefined): Belastung | null {
  if (!t) return null;
  const dauer = typeof t.dauerMin === 'number' ? t.dauerMin : 0;
  if (t.art === 'hyrox') return 'hart';
  if (t.art === 'lauf' || t.art === 'gym') return dauer >= HART_AB_MIN ? 'hart' : 'training';
  if (t.art === 'ruhe') return 'ruhe';
  if (t.art === 'frei') return 'frei';
  return null;
}

const mittel = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : undefined);
const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export interface EssenEingabe {
  log: VitalsLog | null | undefined;
  heute: string;
  /** Trainingsplan heute (Sport-Wochenplan), falls es einen gibt. */
  plan?: Belastung | null;
  /** Ist heute ein Lauf geplant oder schon erfasst? (Trinken-Hinweis) */
  lauftag?: boolean;
}

export interface EssenSicht {
  /** Ø Energie der 7 Tage vor heute (kcal, auf 50 gerundet) und wie viele Tage zählten. */
  kcal7?: number;
  kcalTage: number;
  kcalGestern?: number;
  tendenz: 'mehr' | 'normal' | 'weniger';
  gruende: string[];
  satz: string;
  /** Hinweis zum Trinken (Lauftag, viel Belastung). */
  trinken?: string;
}

/** Die Orientierung für heute (rein) — siehe Kopf. */
export function essenOrientierung(e: EssenEingabe): EssenSicht {
  const log = e.log ?? {};
  const vorher = Array.from({ length: 7 }, (_, i) => tagePlus(e.heute, -(i + 1)));
  const werte = (feld: 'kcal' | 'strain' | 'schritte') => vorher.map(t => zahl(log[t]?.[feld])).filter((x): x is number => x !== undefined && x > 0);
  const kcal = werte('kcal'), strain = werte('strain'), schritte = werte('schritte');
  const kcal7 = kcal.length >= ORIENTIERUNG_MIN_TAGE ? Math.round(mittel(kcal)! / 50) * 50 : undefined;
  const strain7 = strain.length >= ORIENTIERUNG_MIN_TAGE ? mittel(strain)! : undefined;
  const schritte7 = schritte.length >= ORIENTIERUNG_MIN_TAGE ? mittel(schritte)! : undefined;
  const gestern = log[tagePlus(e.heute, -1)] ?? {};
  const heute = log[e.heute] ?? {};
  const kcalGestern = zahl(gestern.kcal);
  const strainGestern = zahl(gestern.strain), strainHeute = zahl(heute.strain), schritteHeute = zahl(heute.schritte);

  const gruende: string[] = [];
  if (e.plan === 'hart') gruende.push('harter Trainingstag geplant');
  if (strainHeute !== undefined && strain7 !== undefined && strainHeute >= strain7 + STRAIN_MEHR) gruende.push('heute schon mehr Belastung als sonst');
  if (schritteHeute !== undefined && schritte7 !== undefined && schritte7 >= SCHRITTE_MIN && schritteHeute >= schritte7 * SCHRITTE_FAKTOR) gruende.push('viel Alltagsbewegung');
  if (strainGestern !== undefined && strain7 !== undefined && strainGestern >= strain7 + STRAIN_GESTERN_MEHR) gruende.push('gestern ein harter Tag');
  let tendenz: EssenSicht['tendenz'] = gruende.length ? 'mehr' : 'normal';
  if (!gruende.length && e.plan === 'ruhe' && !(strainGestern !== undefined && strain7 !== undefined && strainGestern > strain7)) {
    tendenz = 'weniger'; gruende.push('Ruhetag');
  }
  if (!gruende.length && e.plan === 'training') gruende.push('Training geplant');
  const satz = tendenz === 'mehr'
    ? 'Heute eher etwas mehr essen als sonst — vor allem rund ums Training.'
    : tendenz === 'weniger' ? 'Ruhetag — eher etwas leichter essen, ohne zu hungern.' : 'Ein normaler Tag — iss wie gewohnt.';
  const viel = gruende.includes('harter Trainingstag geplant') || gruende.includes('heute schon mehr Belastung als sonst');
  const trinken = e.lauftag ? 'Lauftag: genug trinken und an Elektrolyte denken.' : viel ? 'Viel Belastung: Trinken und Elektrolyte nicht vergessen.' : undefined;
  return { ...(kcal7 !== undefined ? { kcal7 } : {}), kcalTage: kcal.length, ...(kcalGestern !== undefined ? { kcalGestern } : {}), tendenz, gruende, satz, ...(trinken ? { trinken } : {}) };
}

/** Ø Strain je Wochentag über die letzten `wochen` Wochen (vor heute) — nur Tage mit Wert; ein Wochentag braucht 2 Werte. */
export function strainJeWochentag(log: VitalsLog | null | undefined, heute: string, wochen = 4): Partial<Record<WTag, number>> {
  const je: Partial<Record<WTag, number[]>> = {};
  for (let i = 1; i <= wochen * 7; i++) {
    const t = tagePlus(heute, -i);
    const s = zahl(log?.[t]?.strain);
    if (s === undefined) continue;
    (je[wTagVon(t)] ??= []).push(s);
  }
  const raus: Partial<Record<WTag, number>> = {};
  for (const w of W_TAGE) { const l = je[w]; if (l && l.length >= 2) raus[w] = Math.round(mittel(l)! * 10) / 10; }
  return raus;
}

/**
 * Belastungstage einer Person (rein): mit Trainingsplan dessen harte Tage; ohne Plan (kein Tag geplant) die Wochentage, deren
 * Strain-Ø ≥ `STRAIN_HART` ist. Dann für den Haushalt vereinigt (`belastungsTageHaushalt`) — ohne Personen.
 */
export function belastungsTage(plan: Partial<Record<WTag, Belastung | null>> | null | undefined, strain: Partial<Record<WTag, number>> = {}): WTag[] {
  const geplant = W_TAGE.filter(w => plan?.[w] && plan[w] !== 'frei');
  if (geplant.length) return W_TAGE.filter(w => plan?.[w] === 'hart');
  return W_TAGE.filter(w => (strain[w] ?? 0) >= STRAIN_HART);
}
export function belastungsTageHaushalt(je: readonly WTag[][]): WTag[] {
  const alle = new Set(je.flat());
  return W_TAGE.filter(w => alle.has(w));
}

/** Die Zeile für den Prompt des Wochenvorschlags — ohne Personen, nur Wochentage. Leer, wenn es keine gibt. */
export function belastungsZeile(tage: readonly WTag[]): string {
  if (!tage.length) return '';
  return `BELASTUNGSTAGE (Training im Haushalt, ohne Personen): ${tage.map(t => W_LABEL[t]).join(', ')} — an diesen Tagen Mittag und Abend etwas kohlenhydratreicher und reichlicher planen, an den übrigen Tagen normal. Nenne keine Person und keine Gründe aus Profilen.`;
}

// ── Ergänzungen und Trinken als eigene Routinen ──────────────────────────────────────────────────────────────────────

export type ErgaenzungId = 'protein' | 'kreatin' | 'elektrolyte' | 'trinken';
export interface ErgaenzungVorlage { id: ErgaenzungId; label: string; hinweis: string }
/** Vorlagen OHNE Mengenempfehlung — die Person trägt ihre eigene Menge ein (z. B. aus Absprache mit Arzt oder Coach). */
export const ERGAENZUNG_VORLAGEN: readonly ErgaenzungVorlage[] = [
  { id: 'protein', label: 'Protein', hinweis: 'deine Menge, z. B. aus deinem Plan' },
  { id: 'kreatin', label: 'Kreatin', hinweis: 'deine Menge' },
  { id: 'elektrolyte', label: 'Elektrolyte', hinweis: 'z. B. an Lauf- und harten Tagen' },
  { id: 'trinken', label: 'Trinkziel', hinweis: 'dein Ziel, z. B. in Litern' },
];
export const istErgaenzung = (x: unknown): x is ErgaenzungId => typeof x === 'string' && ERGAENZUNG_VORLAGEN.some(v => v.id === x);

/** Längste eigene Menge (Zeichen) — länger lehnt die Oberfläche ab, nie gekürzt. */
export const MENGE_MAX = 40;
/** Name der Routine aus Vorlage + eigener Menge („Kreatin · 5 g“); ohne Menge nur der Name. */
export function ergaenzungLabel(id: ErgaenzungId, menge?: string): string {
  const v = ERGAENZUNG_VORLAGEN.find(x => x.id === id)!;
  const m = String(menge ?? '').replace(/\s+/g, ' ').trim();
  return m ? `${v.label} · ${m}` : v.label;
}
