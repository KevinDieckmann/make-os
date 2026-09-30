// ─── MAKE OS — Planung: Zeitstrahl, Planungsjahr, Forecast (30.09.) ─────────
// Kevin (30.09.): „Ich muss immer in die Zukunft gucken und dann auch einen
// Zeitstrahl haben, damit ich bis Ende nächsten Jahres gucken und planen kann.“
// Und: „einzeln nach vorne und einzeln nach hinten scrollen“.
//
// Hier liegt alles, was sich daran rechnen lässt — rein, auf einem gegebenen
// „heute“, ohne Ansicht und ohne Speicher (Tests: tests/planung-zeitstrahl.test.ts):
//   · Zeitraum-Wahl (`raum`): Dieses Jahr · Bis Ende nächsten Jahres (Standard) ·
//     Ab heute 18 Monate — daraus ein FENSTER aus ganzen Monaten (`ab` = YYYY-MM,
//     `monate`), das sich monatsweise verschieben lässt, ohne feste Grenze.
//     Das Fenster steht in der Adresse (`?ab=2026-10`), die Wahl in `?raum=`.
//   · Monatsachse mit Jahreswechsel, Quartale als Bänder, Tag ↔ Position.
//   · Planungsjahr: Jahresziele tragen seit 30.09. optional `jahr` (fehlt = Jahr
//     der Frist, sonst das laufende Jahr), Meilensteine leiten ihr Jahr aus dem
//     Datum ab — nichts wird doppelt gespeichert.
//   · Forecast je Jahr: läuft · beginnt in n Monaten · abgeschlossen.
//   · Stapeln der Marker in Reihen, Überlauf gebündelt („+3“) — nie überlappend.

const p2 = (n: number) => String(n).padStart(2, '0');
export const MONAT_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;

// ── Zeitraum-Wahl ──────────────────────────────────────────────────────────

export type StrahlRaum = 'jahr' | 'bis-naechstes-jahr' | '18-monate';
export const STRAHL_RAEUME: readonly { id: StrahlRaum; label: string; monate: number }[] = [
  { id: 'jahr', label: 'Dieses Jahr', monate: 12 },
  { id: 'bis-naechstes-jahr', label: 'Bis Ende nächsten Jahres', monate: 24 },
  { id: '18-monate', label: 'Ab heute 18 Monate', monate: 18 },
];
/** Standard (Kevin 30.09.): Januar dieses Jahres bis Dezember des nächsten. */
export const STRAHL_STANDARD: StrahlRaum = 'bis-naechstes-jahr';
/** Merker je Gerät/Person (wie `make-aufgaben-raum`, `make-os:kalender-ansicht`). */
export const RAUM_MERKER = 'make-planung-raum';
export const istStrahlRaum = (v: unknown): v is StrahlRaum => STRAHL_RAEUME.some(r => r.id === v);
export const raumMonate = (r: StrahlRaum): number => STRAHL_RAEUME.find(x => x.id === r)!.monate;

/** Monate im sichtbaren Fenster: die Wahl — am Handy (schmal) höchstens 6, sonst mindestens 40 px je Monat. */
export function fensterMonate(raum: StrahlRaum, breite: number): number {
  const soll = raumMonate(raum);
  if (!(breite > 0)) return soll;
  if (breite < 520) return Math.min(soll, 6);
  return Math.min(soll, Math.max(6, Math.floor(breite / 40)));
}

// ── Monate rechnen (YYYY-MM) ───────────────────────────────────────────────

export const jahrVon = (tag: string): number => Number(tag.slice(0, 4));
export const monatVon = (tag: string): string => tag.slice(0, 7);
/** Monat verschieben — auch rückwärts und über Jahreswechsel. */
export function monatPlus(m: string, n: number): string {
  const idx = Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1) + n;
  return `${Math.floor(idx / 12)}-${p2((idx % 12 + 12) % 12 + 1)}`;
}
/** Wie viele Monate von `a` bis `b` (b − a). */
export const monateZwischen = (a: string, b: string): number =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
const tageImMonat = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();
/** Letzter Tag eines Monats (29.02. im Schaltjahr). */
export const letzterTag = (m: string): string => `${m}-${p2(tageImMonat(Number(m.slice(0, 4)), Number(m.slice(5, 7))))}`;
/** Einen Tag um n Monate verschieben; der Monatsletzte wird geklemmt (31.08. + 6 → 28./29.02.). */
export function tagPlusMonate(tag: string, n: number): string {
  const m = monatPlus(monatVon(tag), n);
  const t = Math.min(Number(tag.slice(8, 10)), Number(letzterTag(m).slice(8, 10)));
  return `${m}-${p2(t)}`;
}
const tagMs = (tag: string) => Date.parse(`${tag}T00:00:00Z`);
export const tageZwischen = (a: string, b: string): number => Math.round((tagMs(b) - tagMs(a)) / 864e5);

// ── Adresse ────────────────────────────────────────────────────────────────

/** Wie weit die Adresse vom laufenden Jahr weg zeigen darf — dahinter gilt sie als kaputt (Standard statt Unsinn). */
export const AB_SPANNE_JAHRE = 50;
/** `?ab=2026-10` lesen: nur echte Monate in ±50 Jahren um heute, sonst null (→ Standard). */
export function abAus(v: unknown, heute: string): string | null {
  if (typeof v !== 'string') return null;
  const t = /^(\d{4})-(\d{2})$/.exec(v.trim());
  if (!t) return null;
  const y = Number(t[1]), m = Number(t[2]);
  if (m < 1 || m > 12 || Math.abs(y - jahrVon(heute)) > AB_SPANNE_JAHRE) return null;
  return `${t[1]}-${t[2]}`;
}
/** `?raum=` lesen — unbekannt → null (dann Merker, sonst Standard). */
export const raumAus = (v: unknown): StrahlRaum | null => (istStrahlRaum(v) ? v : null);

// ── Fenster ────────────────────────────────────────────────────────────────

/** Das natürliche Fenster einer Wahl: Dieses Jahr = das Planungsjahr, sonst ab Januar bzw. ab dem laufenden Monat. */
export function raumSpanne(raum: StrahlRaum, heute: string, planJahr = jahrVon(heute)): { ab: string; monate: number } {
  if (raum === '18-monate') return { ab: monatVon(heute), monate: 18 };
  if (raum === 'jahr') return { ab: `${planJahr}-01`, monate: 12 };
  return { ab: `${jahrVon(heute)}-01`, monate: 24 };
}

/**
 * Wo das Fenster ohne Adresse beginnt. Ist es schmaler als die Wahl (Handy), rückt es so, dass HEUTE mit einem
 * Monat davor sichtbar ist — aber nie aus der natürlichen Spanne heraus.
 */
export function standardAb(raum: StrahlRaum, heute: string, monate: number, planJahr = jahrVon(heute)): string {
  const s = raumSpanne(raum, heute, planJahr);
  if (monate >= s.monate) return s.ab;
  const hm = monatVon(heute);
  const drin = monateZwischen(s.ab, hm) >= 0 && monateZwischen(s.ab, hm) < s.monate;
  if (!drin) return s.ab;
  const ab = monatPlus(hm, -1);
  const spaetestens = monatPlus(s.ab, s.monate - monate);
  return monateZwischen(s.ab, ab) < 0 ? s.ab : monateZwischen(ab, spaetestens) < 0 ? spaetestens : ab;
}
/** Der Knopf „Heute“: das Fenster der Wahl im laufenden Jahr (HEUTE sichtbar). */
export const heuteAb = (raum: StrahlRaum, heute: string, monate: number): string => standardAb(raum, heute, monate, jahrVon(heute));

export interface Fenster { ab: string; monate: number; von: string; bis: string; label: string }
export const monatLabel = (m: string): string => `${MONAT_KURZ[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** Das sichtbare Fenster: ganze Monate ab `ab`. */
export function fenster(ab: string, monate: number): Fenster {
  const n = Math.max(1, Math.round(monate));
  const ende = monatPlus(ab, n - 1);
  return { ab, monate: n, von: `${ab}-01`, bis: letzterTag(ende), label: `${monatLabel(ab)} – ${monatLabel(ende)}` };
}
/** Um n Monate blättern (Pfeil = 1, Umschalt = 3 = ein Quartal). Keine feste Grenze. */
export const blaettern = (ab: string, n: number): string => monatPlus(ab, n);
/** Liegt heute im Fenster? (für den Knopf „Heute“) */
export const heuteIm = (f: Fenster, heute: string): boolean => heute >= f.von && heute <= f.bis;

// ── Achse ──────────────────────────────────────────────────────────────────

export interface MonatsTick {
  date: string;
  label: string;
  /** Jahreszahl an diesem Tick — am Januar (Jahreswechsel) und am ersten Monat des Fensters (bis Oktober). */
  jahr?: string;
  /** Januar: der Jahreswechsel, als Trennlinie sichtbar. */
  wechsel?: boolean;
}
export function monatsTicks(von: string, bis: string): MonatsTick[] {
  const aus: MonatsTick[] = [];
  for (let m = monatVon(von), i = 0; `${m}-01` <= bis && i < 600; m = monatPlus(m, 1), i++) {
    if (`${m}-01` < von) continue;
    const jan = m.endsWith('-01');
    // Der erste Monat trägt sein Jahr — außer im November/Dezember: dort steht gleich die Jahreszahl des Januars daneben.
    const erstesJahr = !aus.length && Number(m.slice(5, 7)) <= 10;
    aus.push({ date: `${m}-01`, label: MONAT_KURZ[Number(m.slice(5, 7)) - 1], ...(jan || erstesJahr ? { jahr: m.slice(0, 4) } : {}), ...(jan ? { wechsel: true } : {}) });
  }
  return aus;
}

export interface QuartalsBand { von: string; bis: string; label: string; jahr: number }
/** Quartale im Fenster (an den Rändern abgeschnitten). */
export function quartale(von: string, bis: string): QuartalsBand[] {
  const aus: QuartalsBand[] = [];
  let m = monatVon(von);
  m = monatPlus(m, -((Number(m.slice(5, 7)) - 1) % 3));
  for (let i = 0; `${m}-01` <= bis && i < 200; m = monatPlus(m, 3), i++) {
    const q = Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1;
    const qv = `${m}-01`, qb = letzterTag(monatPlus(m, 2));
    aus.push({ von: qv < von ? von : qv, bis: qb > bis ? bis : qb, label: `Q${q}`, jahr: Number(m.slice(0, 4)) });
  }
  return aus;
}

/** Position eines Tages im Fenster (0 = Beginn des ersten Tages, 1 = Ende des letzten), Tagesmitte. */
export function anteilIm(tag: string, von: string, bis: string): number {
  const gesamt = tageZwischen(von, bis) + 1;
  return (tageZwischen(von, tag) + 0.5) / gesamt;
}
/** Welcher Tag liegt an dieser Position? (Klick auf den Zeitstrahl → Datum) */
export function tagBeiAnteil(von: string, bis: string, f: number): string {
  const gesamt = tageZwischen(von, bis) + 1;
  const i = Math.max(0, Math.min(gesamt - 1, Math.floor(f * gesamt)));
  const d = new Date(tagMs(von) + i * 864e5);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}
/** Liegt ein Tag im Fenster? */
export const imFenster = (tag: string | undefined, f: { von: string; bis: string }): boolean => !!tag && tag >= f.von && tag <= f.bis;

// ── Planungsjahr ───────────────────────────────────────────────────────────

/**
 * Zählt ein offener Meilenstein im „Kurs“ der Indizes (Business: Meilenstein-Kurs, Gesundheit: Etappen)? Nur bis
 * Ende des laufenden Jahres (und ohne Datum) — was schon fürs nächste Jahr geplant ist, steht bei 0 % und ist
 * trotzdem nicht im Rückstand (30.09.). Ab Januar zählt es von selbst mit.
 */
export const zaehltImKurs = (m: { faellig?: string }, heute: string): boolean => !m.faellig || m.faellig <= `${heute.slice(0, 4)}-12-31`;

export const JAHR_MIN = 2000;
export const JAHR_MAX = 2100;
export const istPlanJahr = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= JAHR_MIN && (v as number) <= JAHR_MAX;
const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Das Jahr eines Jahresziels: `jahr`, sonst das Jahr der Frist, sonst das laufende. */
export function zielJahr(z: { jahr?: unknown; termin?: unknown }, laufend: number): number {
  if (istPlanJahr(z.jahr)) return z.jahr;
  if (typeof z.termin === 'string' && TAG.test(z.termin)) return jahrVon(z.termin);
  return laufend;
}

/** Das Jahr eines Meilensteins aus seinem Datum (oder einem Zeitfenster wie „2028“, „Q3 2027“) — ohne beides null. */
export function meilensteinJahr(m: { faellig?: unknown; zeitfenster?: unknown; erledigt?: unknown; erledigtAm?: unknown }): number | null {
  if (typeof m.faellig === 'string' && TAG.test(m.faellig)) return jahrVon(m.faellig);
  const z = typeof m.zeitfenster === 'string' ? /\b(20\d\d)\b/.exec(m.zeitfenster) : null;
  if (z) return Number(z[1]);
  if (m.erledigt === true && typeof m.erledigtAm === 'string' && TAG.test(m.erledigtAm)) return jahrVon(m.erledigtAm);
  return null;
}

/**
 * Gehört ein Meilenstein in die Liste des Planungsjahres? Sein Jahr — ohne Jahr steht er im laufenden; offene aus
 * früheren Jahren (überfällig) stehen ebenfalls im laufenden, damit nichts verschwindet.
 */
export function meilensteinImJahr(m: { faellig?: unknown; zeitfenster?: unknown; erledigt?: unknown; erledigtAm?: unknown }, planJahr: number, laufend: number): boolean {
  const j = meilensteinJahr(m);
  if (j == null) return planJahr === laufend;
  if (j === planJahr) return true;
  return planJahr === laufend && j < laufend && m.erledigt !== true;
}

/** Die Jahre der Auswahl: mindestens das laufende und das nächste, dazu belegte Jahre (drei zurück, fünf voraus). */
export function planJahre(laufend: number, belegt: readonly (number | null | undefined)[] = []): number[] {
  const s = new Set<number>([laufend, laufend + 1]);
  for (const j of belegt) if (j != null && Number.isInteger(j) && j >= laufend - 3 && j <= laufend + 5) s.add(j);
  return Array.from(s).sort((a, b) => a - b);
}
/**
 * Ein Plan-Datum prüfen (ZOE, Anlegen): echter Kalendertag YYYY-MM-DD, höchstens 10 Jahre um heute — ausdrücklich
 * auch im nächsten Jahr (30.09.). Sonst null.
 */
export function planTag(v: unknown, heute: string): string | null {
  if (typeof v !== 'string' || !TAG.test(v.trim())) return null;
  const t = v.trim();
  if (Number(t.slice(8, 10)) < 1 || Number(t.slice(5, 7)) < 1 || Number(t.slice(5, 7)) > 12 || t > letzterTag(t.slice(0, 7))) return null;
  return Math.abs(jahrVon(t) - jahrVon(heute)) <= 10 ? t : null;
}

/** `?jahr=` lesen: nur plausible Jahre (±10 um das laufende). */
export function jahrAus(v: unknown, laufend: number): number | null {
  const n = typeof v === 'string' && /^\d{4}$/.test(v) ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isInteger(n) && Math.abs(n - laufend) <= 10 ? n : null;
}

// ── Forecast je Jahr ───────────────────────────────────────────────────────

export type JahrLage =
  | { art: 'laeuft'; verstrichen: number; schnitt: number | null; prognose: number | null }
  | { art: 'zukunft'; monate: number; tage: number }
  | { art: 'vorbei'; schnitt: number | null };

/** Bis zum Beginn: ganze Monate (Tag geklemmt) und Resttage. */
export function bisBeginn(heute: string, beginn: string): { monate: number; tage: number } {
  if (heute >= beginn) return { monate: 0, tage: 0 };
  let monate = 0;
  while (monate < 1200 && tagPlusMonate(heute, monate + 1) <= beginn) monate++;
  return { monate, tage: tageZwischen(tagPlusMonate(heute, monate), beginn) };
}

/**
 * Wo steht das Planungsjahr? Läuft es: Anteil der verstrichenen Zeit und die Prognose (Ø Ziele ÷ Zeit, erst ab 5 %);
 * liegt es vorn: wann es beginnt — NIE 0 % „Zeit vorbei“, das läse sich wie Rückstand; ist es vorbei: das Ergebnis.
 */
export function jahrLage(jahr: number, heute: string, schnitt: number | null): JahrLage {
  const von = `${jahr}-01-01`, bis = `${jahr}-12-31`;
  if (heute < von) return { art: 'zukunft', ...bisBeginn(heute, von) };
  if (heute > bis) return { art: 'vorbei', schnitt };
  const verstrichen = Math.round(((tageZwischen(von, heute) + 1) / (tageZwischen(von, bis) + 1)) * 100);
  const prognose = schnitt != null && verstrichen > 5 ? Math.min(150, Math.round((schnitt / verstrichen) * 100)) : null;
  return { art: 'laeuft', verstrichen, schnitt, prognose };
}
/** „beginnt in 3 Monaten“, „beginnt in 12 Tagen“, „beginnt morgen“. */
export function beginntText(b: { monate: number; tage: number }): string {
  if (b.monate >= 1) return `beginnt in ${b.monate} ${b.monate === 1 ? 'Monat' : 'Monaten'}`;
  if (b.tage <= 1) return 'beginnt morgen';
  return `beginnt in ${b.tage} Tagen`;
}

// ── Stapeln (Linear-/Gantt-Muster) ─────────────────────────────────────────

export interface StapelEingabe { x: number; w: number }
export interface StapelErgebnis {
  /** Je Eingabe: Reihe (0 = an der Achse) und linke Kante — oder `buendel` (Index in `buendel`). */
  lagen: ({ reihe: number; links: number } | { buendel: number })[];
  /** Überlauf, nach Nähe zusammengefasst: ein „+n“ je Stelle, untereinander nie näher als `buendelAbstand`. */
  buendel: { x: number; idx: number[] }[];
  reihen: number;
}
/**
 * Pills in Reihen legen: jede nimmt die unterste Reihe, in der sie nicht mit dem Nachbarn kollidiert. Über `maxReihen`
 * hinaus wird gebündelt statt überlappt. Eingaben müssen nach x sortiert sein.
 */
export function stapeln(items: readonly StapelEingabe[], breite: number, maxReihen: number, abstand = 8, buendelAbstand = 34): StapelErgebnis {
  const ende: number[] = [];
  const lagen: StapelErgebnis['lagen'] = [];
  const ueber: number[] = [];
  items.forEach((it, i) => {
    const w = Math.min(it.w, Math.max(0, breite));
    const links = Math.max(0, Math.min(breite - w, it.x - w / 2));
    let reihe = ende.findIndex(e => links >= e + abstand);
    if (reihe === -1) reihe = ende.length;
    if (reihe >= maxReihen) { ueber.push(i); lagen.push({ buendel: -1 }); return; }
    ende[reihe] = links + w;
    lagen.push({ reihe, links });
  });
  const buendel: StapelErgebnis['buendel'] = [];
  for (const i of ueber) {
    const letztes = buendel[buendel.length - 1];
    const x = items[i].x;
    if (letztes && x - items[letztes.idx[letztes.idx.length - 1]].x < buendelAbstand) letztes.idx.push(i);
    else buendel.push({ x, idx: [i] });
  }
  buendel.forEach((b, k) => {
    b.x = b.idx.reduce((s, i) => s + items[i].x, 0) / b.idx.length;
    for (const i of b.idx) lagen[i] = { buendel: k };
  });
  // Nachbar-Bündel nach dem Mitteln wieder auseinander (von links nach rechts), in der Breite gehalten.
  for (let k = 1; k < buendel.length; k++) if (buendel[k].x - buendel[k - 1].x < buendelAbstand) buendel[k].x = buendel[k - 1].x + buendelAbstand;
  for (const b of buendel) b.x = Math.max(12, Math.min(breite - 12, b.x));
  return { lagen, buendel, reihen: ende.length };
}
