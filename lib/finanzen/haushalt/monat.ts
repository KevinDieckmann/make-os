// ─── Monate ohne Zeitzonen-Falle ────────────────────────────────────────────
// Malins Cockpit rechnete Monate über `new Date(j, m, 1).toISOString()`. Das
// ist Mitternacht in Berlin = 22 bzw. 23 Uhr am Vortag in UTC — jede
// Monatsliste verrutschte um einen Monat („Letzter Monat“ zeigte am 24.09. den
// Juli). Hier wird mit Monaten als Text gerechnet („2026-08“), und „heute“
// kommt ausdrücklich aus Europe/Berlin — auch auf einem Server in UTC.

export type Monat = string; // „JJJJ-MM“

const ZONE = 'Europe/Berlin';

/** Heute als JJJJ-MM-TT in Berliner Zeit. */
export function heuteBerlin(jetzt: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(jetzt);
}

export function monatVon(datum: string): Monat { return String(datum).slice(0, 7); }

function zerlege(m: Monat): [number, number] { return [Number(m.slice(0, 4)), Number(m.slice(5, 7))]; }

/** Monat um n verschieben (n darf negativ sein). */
export function monatPlus(m: Monat, n: number): Monat {
  const [j, mo] = zerlege(m);
  const gesamt = j * 12 + (mo - 1) + n;
  const nj = Math.floor(gesamt / 12), nm = (gesamt % 12 + 12) % 12 + 1;
  return `${nj}-${String(nm).padStart(2, '0')}`;
}

/** Abstand in Monaten von a nach b. */
export function monatsAbstand(a: Monat, b: Monat): number {
  const [ja, ma] = zerlege(a), [jb, mb] = zerlege(b);
  return (jb - ja) * 12 + (mb - ma);
}

/**
 * Volle Monate rückwärts ab dem letzten abgeschlossenen Monat — der laufende
 * bleibt draußen, er ist unvollständig. Neuester zuerst (wie bei Malin).
 * `versatz` schiebt das Fenster weiter zurück (für den Vergleichszeitraum).
 */
export function vollMonate(anzahl: number, versatz = 0, heute: string = heuteBerlin()): Monat[] {
  const laufend = monatVon(heute);
  const raus: Monat[] = [];
  for (let i = 1; i <= anzahl; i++) raus.push(monatPlus(laufend, -(i + versatz)));
  return raus;
}

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function monatName(m: Monat, mitJahr = true): string {
  const [j, mo] = zerlege(m);
  return mitJahr ? `${MONATSNAMEN[mo - 1]} ${j}` : MONATSNAMEN[mo - 1];
}

export function monatKurz(m: Monat): string {
  const [j, mo] = zerlege(m);
  return `${MONATSNAMEN[mo - 1].slice(0, 3)} ${String(j).slice(2)}`;
}

/** Tage von a bis b (JJJJ-MM-TT), ganzzahlig. */
export function tageZwischen(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
}

export function tagPlus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function datumDe(tag: string | null | undefined): string {
  if (!tag) return '–';
  const m = String(tag).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(tag);
}

/** Tage im Monat. */
export function tageImMonat(m: Monat): number {
  const [j, mo] = zerlege(m);
  return new Date(Date.UTC(j, mo, 0)).getUTCDate();
}
