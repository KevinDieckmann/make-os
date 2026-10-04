// ─── Fokus-Signatur — Zeitreihen für die FadenLinie (04.10.2026, rein, client-sicher) ─
// Kevin (04.10.): „Diese Akzente will ich überall drauf haben, wo Fokus ist. Dezent, aber immer wichtig.“ Eine FadenLinie
// (components/os/ui/fokus.tsx) zeigt IMMER eine echte Reihe — nie Schmuck ohne Daten (DESIGN_STANDARD.md › Fokus-Signatur).
// Diese Datei macht aus vorhandenen Beständen Reihen: Fälliges je Tag (Follow-ups der nächsten 14 Tage), Ereignisse je Woche
// (qualifizierte Leads), Summen je Monat (erwartete Abschlüsse) — plus Normalisieren für den Zeichner und den Text für
// Screenreader. Keine Server-Importe, kein Datum aus `toISOString()` des Geräts: `heute` kommt immer vom Aufrufer
// (Berliner Tag, `localDay()` bzw. vom Server).
// Tests: tests/fokus-signatur.test.ts.

const TAG_MS = 864e5;
const ms = (tag: string) => Date.parse(`${tag.slice(0, 10)}T12:00:00Z`);
const tagAus = (m: number) => new Date(m).toISOString().slice(0, 10);

/** Tag + n Tage (YYYY-MM-DD, kalendarisch, ohne Zeitzonen-Sprung). */
export function tagPlus(tag: string, n: number): string {
  return tagAus(ms(tag) + n * TAG_MS);
}
/** Ganze Tage von `von` bis `bis` (positiv = später). */
export function tageZwischen(von: string, bis: string): number {
  return Math.round((ms(bis) - ms(von)) / TAG_MS);
}
/** Montag der Woche eines Tages. */
export function wocheMontag(tag: string): string {
  const m = ms(tag);
  return tagAus(m - ((new Date(m).getUTCDay() + 6) % 7) * TAG_MS);
}
const gueltigerTag = (t: unknown): t is string => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t) && Number.isFinite(ms(t));

/**
 * Wie viel ist an jedem der nächsten `anzahl` Tage fällig? Index 0 = heute. Überfälliges zählt (Standard) auf heute — es
 * bindet JETZT Aufmerksamkeit (dieselbe Regel wie die Lichtfäden). Was nach dem Fenster liegt, zählt nicht.
 */
export function jeTag(tage: readonly (string | null | undefined)[], heute: string, anzahl = 14, o: { ueberfaelligHeute?: boolean } = {}): number[] {
  const aus = new Array<number>(Math.max(0, anzahl)).fill(0);
  const mitUeberfaellig = o.ueberfaelligHeute !== false;
  for (const t of tage) {
    if (!gueltigerTag(t)) continue;
    let i = tageZwischen(heute, t);
    if (i < 0) { if (!mitUeberfaellig) continue; i = 0; }
    if (i < aus.length) aus[i]++;
  }
  return aus;
}

/** Wie viele Ereignisse je Woche — die letzten `anzahl` Wochen bis einschließlich der laufenden (älteste zuerst). */
export function jeWoche(tage: readonly (string | null | undefined)[], heute: string, anzahl = 8): number[] {
  const aus = new Array<number>(Math.max(0, anzahl)).fill(0);
  const diese = wocheMontag(heute);
  for (const t of tage) {
    if (!gueltigerTag(t)) continue;
    const w = Math.round(tageZwischen(wocheMontag(t), diese) / 7);
    if (w >= 0 && w < anzahl) aus[anzahl - 1 - w]++;
  }
  return aus;
}

/** Summe je Monat ab dem laufenden Monat (`anzahl` Monate, laufender zuerst); Überfälliges zählt in den laufenden Monat. */
export function summeJeMonat(eintraege: readonly { tag?: string | null; wert: number }[], heute: string, anzahl = 6): number[] {
  const aus = new Array<number>(Math.max(0, anzahl)).fill(0);
  const j0 = Number(heute.slice(0, 4)), m0 = Number(heute.slice(5, 7));
  for (const e of eintraege) {
    if (!gueltigerTag(e.tag) || !Number.isFinite(e.wert)) continue;
    const i = Math.max(0, (Number(e.tag.slice(0, 4)) - j0) * 12 + Number(e.tag.slice(5, 7)) - m0);
    if (i < anzahl) aus[i] += e.wert;
  }
  return aus.map(v => Math.round(v * 100) / 100);
}

/** Summe je Tag der letzten `anzahl` Tage bis einschließlich heute (älteste zuerst) — z. B. bewusste Fokus-Minuten. */
export function summeJeTagZurueck(eintraege: readonly { tag?: string | null; wert: number }[], heute: string, anzahl = 7): number[] {
  const aus = new Array<number>(Math.max(0, anzahl)).fill(0);
  for (const e of eintraege) {
    if (!gueltigerTag(e.tag) || !Number.isFinite(e.wert)) continue;
    const zurueck = tageZwischen(e.tag, heute);
    if (zurueck >= 0 && zurueck < anzahl) aus[anzahl - 1 - zurueck] += e.wert;
  }
  return aus.map(v => Math.round(v * 100) / 100);
}

/** Eine Reihe taugt für eine FadenLinie: mindestens zwei endliche Werte. Sonst zeigt die FadenLinie nichts (nie Schmuck). */
export function reiheGueltig(reihe: readonly number[] | null | undefined): reihe is readonly number[] {
  return !!reihe && reihe.length >= 2 && reihe.every(v => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Für den Zeichner: Werte auf 0 … 1 (0 = unten). Ohne negative Werte ist 0 der Boden; mit negativen Werten liegt die
 * Nulllinie bei `null0` (Anteil von unten) — die Liquidität zeigt so, wo sie unter null fällt. Eine flache Reihe liegt mittig
 * bzw. (alles 0) am Boden.
 */
export function normalisiere(reihe: readonly number[]): { werte: number[]; null0: number | null } {
  if (!reihe.length) return { werte: [], null0: null };
  const min = Math.min(0, ...reihe), max = Math.max(0, ...reihe);
  const spanne = max - min;
  if (!(spanne > 0)) return { werte: reihe.map(() => 0), null0: null };
  const werte = reihe.map(v => Math.round(((v - min) / spanne) * 1000) / 1000);
  return { werte, null0: min < 0 ? Math.round((-min / spanne) * 1000) / 1000 : null };
}

const zahlText = (v: number) => (Number.isInteger(v) ? String(v) : v.toLocaleString('de-DE', { maximumFractionDigits: 1 }));

/**
 * Der Text der Reihe für Screenreader (`aria-label` der FadenLinie): Titel, jeder Wert mit seiner Beschriftung, dann Summe
 * und Höchstwert. Beispiel: „Fällige Follow-ups, nächste 14 Tage: heute 3, morgen 0, … — zusammen 7, höchstens 3.“
 */
export function reiheText(titel: string, reihe: readonly number[], beschrift: (i: number) => string, format: (v: number) => string = zahlText): string {
  if (!reihe.length) return `${titel}: keine Werte.`;
  const teile = reihe.map((v, i) => `${beschrift(i)} ${format(v)}`);
  const summe = reihe.reduce((s, v) => s + v, 0);
  const hoch = Math.max(...reihe);
  return `${titel}: ${teile.join(', ')} — zusammen ${format(Math.round(summe * 100) / 100)}, höchstens ${format(hoch)}.`;
}

const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** Beschriftung eines Tages ab heute: „heute“, „morgen“, sonst „Mi 8.10.“. */
export function tagBeschriftung(heute: string): (i: number) => string {
  return i => {
    if (i === 0) return 'heute';
    if (i === 1) return 'morgen';
    const t = tagPlus(heute, i), d = new Date(ms(t));
    return `${WT[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  };
}
/** Beschriftung der letzten `anzahl` Tage (älteste zuerst, der letzte ist heute): „Mi 1.10.“ … „heute“. */
export function tageZurueckBeschriftung(heute: string, anzahl: number): (i: number) => string {
  return i => {
    if (i === anzahl - 1) return 'heute';
    if (i === anzahl - 2) return 'gestern';
    const t = tagPlus(heute, -(anzahl - 1 - i)), d = new Date(ms(t));
    return `${WT[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  };
}
/** Beschriftung der Wochen (älteste zuerst, die letzte ist die laufende): „KW-Montag 29.9.“ bzw. „diese Woche“. */
export function wochenBeschriftung(heute: string, anzahl: number): (i: number) => string {
  const diese = wocheMontag(heute);
  return i => {
    if (i === anzahl - 1) return 'diese Woche';
    const t = tagPlus(diese, -7 * (anzahl - 1 - i)), d = new Date(ms(t));
    return `Woche ab ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  };
}
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
/** Beschriftung der Monate ab dem laufenden: „Okt“, „Nov“ … */
export function monatBeschriftung(heute: string): (i: number) => string {
  const m0 = Number(heute.slice(5, 7)) - 1;
  return i => MONATE[(m0 + i) % 12];
}
