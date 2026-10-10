// ─── MAKE OS — Fokus: „Unser Fokus“ und „Mein Fokus“ je Bereich und Horizont (09.10.) — rein, Server und Browser ─────────────
// Kevin 09.10. spät: „Bau die Fokus-Seite auch nochmal ein wenig um, dass wir selber alle immer Fokusse einstellen können — sonst macht das
// ja alles keinen Sinn. Muss ja auch wieder individuell sein.“ Und (09.10. spät, CLAUDE.md): „Firma und Privat müssen immer getrennt liegen —
// auch von den Daten.“ Deshalb liegt der Fokus seit heute in GETRENNTEN Beständen (der bisherige Fokus im gemischten Bestand `ziele` bleibt
// unangetastet — er wird nur noch gelesen, als Altbestand):
//   · Unser Fokus · Privat     → `fokus-privat--<haushalt>`        Schlüssel `<h>` bzw. `jahr:<JJJJ>`
//   · Unser Fokus · Business   → `fokus-business--<haushalt>`      Schlüssel `<einheit>:<h>` (`gesamt` oder eine Business-Gesellschaft)
//   · Mein Fokus · Privat      → `fokus-eigen--<person>`           Schlüssel wie Privat, dazu `geteilt` (Schlüssel, die die Person teilt)
//   · Mein Fokus · Business    → `fokus-eigen-business--<person>`  Schlüssel wie Privat (je Person, nicht je Gesellschaft), `geteilt`
// Lesen: der neue Bestand gewinnt, sobald er den Schlüssel trägt (auch leer = bewusst gelöscht); sonst der Altbestand — Privat
// `privat:<h>`, dann der gemeinsame Satz `<h>` (im Zweifel privat, wie bereich-sicht.ts), Business `business:<h>` (nur `gesamt`), Mein
// Fokus aus `ziele-eigen--<person>`. Der Altbestand wird nie geschrieben.
// „Mit <Name> teilen“ gilt je Schlüssel (`geteilt`), Vorgabe nur ich — gefiltert NUR auf dem Server (lib/planung/fokus-server.ts).

import { fokusImJahr } from './jahr-fokus';

export type FokusBereich = 'privat' | 'business';
export type FokusHorizont = 'tag' | 'woche' | 'monat' | 'quartal' | 'jahr';
export type FokusWessen = 'unser' | 'mein';

/** Reihenfolge auf der Fokus-Seite: vom Jahr zum Tag. */
export const FOKUS_HORIZONTE: readonly FokusHorizont[] = ['jahr', 'quartal', 'monat', 'woche', 'tag'];
export const istFokusHorizont = (v: unknown): v is FokusHorizont => (FOKUS_HORIZONTE as readonly unknown[]).includes(v);
export const istFokusBereich = (v: unknown): v is FokusBereich => v === 'privat' || v === 'business';
/** Länge eines Fokus-Satzes — darüber 413 (nie gekürzt). */
export const FOKUS_MAX = 300;
/** Business ohne bestimmte Gesellschaft. */
export const FOKUS_GESAMT = 'gesamt';
const EINHEIT = /^[a-z0-9-]{1,40}$/;

/** Die Frage je Horizont — als Text über dem Feld bzw. als Platzhalter (Heute-Karte). */
export const FOKUS_FRAGE: Record<FokusHorizont, string> = {
  jahr: 'Woran richtet sich dieses Jahr alles aus?',
  quartal: 'Welche Etappe muss in diesem Quartal stehen?',
  monat: 'Worauf kommt es diesen Monat an?',
  woche: 'Worauf zahlt diese Woche ein?',
  tag: 'Was muss heute passieren, damit der Tag gut war?',
};
export const FOKUS_LABEL: Record<FokusHorizont, string> = { jahr: 'Jahr', quartal: 'Quartal', monat: 'Monat', woche: 'Woche', tag: 'Heute' };

/** Was ein Fokus-Bestand trägt (Privat, Business, je Person). */
export interface FokusDatei {
  fokus?: Record<string, string>;
  /** Nur „Mein Fokus“: die Schlüssel, die die Person mit den anderen vollen Mitgliedern des Haushalts teilt. */
  geteilt?: string[];
}

/** Die vier Bestandsnamen — je einzeln, damit der Register-Wächter (tests/datenschutz-register.test.ts) jeden Namen sieht. */
export const fokusPrivatName = (haushalt: string) => `fokus-privat--${haushalt}`;
export const fokusBusinessName = (haushalt: string) => `fokus-business--${haushalt}`;
export const fokusEigenName = (person: string) => `fokus-eigen--${person}`;
export const fokusEigenBusinessName = (person: string) => `fokus-eigen-business--${person}`;

/** Bestandsname je Bereich/wessen (Haushalt bzw. Person) — Privat und Business nie im selben Bestand. */
export function fokusBestand(bereich: FokusBereich, wessen: FokusWessen, haushaltOderPerson: string): string {
  if (wessen === 'unser') return bereich === 'privat' ? fokusPrivatName(haushaltOderPerson) : fokusBusinessName(haushaltOderPerson);
  return bereich === 'privat' ? fokusEigenName(haushaltOderPerson) : fokusEigenBusinessName(haushaltOderPerson);
}

/** Schlüssel im Bestand: `<h>` bzw. `jahr:<JJJJ>`; „Unser Fokus · Business“ mit Einheit davor. */
export function fokusSchluesselNeu(h: FokusHorizont, o: { jahr: number; bereich: FokusBereich; wessen: FokusWessen; einheit?: string }): string {
  const basis = h === 'jahr' ? `jahr:${o.jahr}` : h;
  return o.bereich === 'business' && o.wessen === 'unser' ? `${o.einheit && EINHEIT.test(o.einheit) ? o.einheit : FOKUS_GESAMT}:${basis}` : basis;
}

/** Der Altbestand für diese Zelle (nur lesen): `ziele.fokus` (Unser) bzw. `ziele-eigen--<person>.fokus` (Mein). */
export function fokusAlt(alt: Record<string, string> | null | undefined, h: FokusHorizont, o: { jahr: number; laufend: number; bereich: FokusBereich; einheit?: string }): string {
  // Nur „Business gesamt“ hat einen Altbestand — eine Gesellschaft gab es bisher nicht.
  if (o.bereich === 'business' && o.einheit && o.einheit !== FOKUS_GESAMT) return '';
  const basen = o.bereich === 'business' ? [`business:${h}`] : [`privat:${h}`, h];
  for (const b of basen) {
    const t = h === 'jahr' ? fokusImJahr(alt, b, o.jahr, o.laufend) : (alt?.[b] ?? '');
    if (typeof t === 'string' && t.trim()) return t;
  }
  return '';
}

export type FokusQuelle = 'neu' | 'alt' | 'leer';
export interface FokusZelle { text: string; quelle: FokusQuelle; /** Der Stand, den der Browser beim Schreiben mitschickt (sonst 409). */ stand: string }

/** Stand einer Zelle: FNV-1a über Quelle und Text (gleicher Text aus dem Altbestand ≠ neu gesetzt) — rein, auch im Browser. */
export function fokusZellenStand(text: string, quelle: FokusQuelle): string {
  let h = 0x811c9dc5;
  for (const c of `${quelle}\u0000${text}`) { h ^= c.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return `f${h.toString(36)}${text.length.toString(36)}`;
}

/** Die wirksame Zelle: der neue Bestand, sobald er den Schlüssel trägt (auch leer), sonst der Altbestand. */
export function fokusZelle(neu: FokusDatei | null | undefined, schluessel: string, alt: string): FokusZelle {
  const n = neu?.fokus;
  if (n && Object.prototype.hasOwnProperty.call(n, schluessel) && typeof n[schluessel] === 'string') {
    const text = n[schluessel];
    return { text, quelle: text ? 'neu' : 'leer', stand: fokusZellenStand(text, text ? 'neu' : 'leer') };
  }
  return alt ? { text: alt, quelle: 'alt', stand: fokusZellenStand(alt, 'alt') } : { text: '', quelle: 'leer', stand: fokusZellenStand('', 'leer') };
}

/** Teilt die Person diesen Schlüssel? */
export const fokusGeteilt = (d: FokusDatei | null | undefined, schluessel: string): boolean => Array.isArray(d?.geteilt) && d!.geteilt!.includes(schluessel);

/** Eingabe prüfen: Text (getrimmt, ≤ FOKUS_MAX, sonst 413) — nie gekürzt. */
export function fokusTextPruefen(v: unknown): { ok: true; text: string } | { ok: false; status: 400 | 413; fehler: string } {
  if (typeof v !== 'string') return { ok: false, status: 400, fehler: 'text fehlt.' };
  const text = v.trim();
  if (text.length > FOKUS_MAX) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${FOKUS_MAX} Zeichen je Fokus-Satz. Nichts gespeichert.` };
  return { ok: true, text };
}

/** Ein Schreibschritt im Bestand (rein): Text setzen (leer = bewusst leer) und/oder Teilen umschalten. */
export function fokusAnwenden(d: FokusDatei | null | undefined, schluessel: string, o: { text?: string; geteilt?: boolean }): FokusDatei {
  const aus: FokusDatei = { ...(d ?? {}), fokus: { ...(d?.fokus ?? {}) } };
  if (typeof o.text === 'string') aus.fokus![schluessel] = o.text;
  if (typeof o.geteilt === 'boolean') {
    const l = new Set(Array.isArray(d?.geteilt) ? d!.geteilt! : []);
    if (o.geteilt) l.add(schluessel); else l.delete(schluessel);
    aus.geteilt = [...l].sort();
  }
  return aus;
}

/** Eine Zeile für ZOE/Agenten — der Text Dritter (beide Personen schreiben frei) steht im `<daten>`-Rahmen, nie als Anweisung. */
export interface FokusZeile { bereich: FokusBereich; horizont: FokusHorizont; wer: string; einheit?: string; text: string }
/** Die Zeilen ohne Rahmen (spitze Klammern im Text fallen weg — der Text kann keinen Rahmen schließen). */
export function fokusZeilenText(zeilen: readonly FokusZeile[]): string {
  return zeilen.map(x => `- ${FOKUS_LABEL[x.horizont]} · ${x.bereich === 'privat' ? 'Privat' : `Business${x.einheit && x.einheit !== FOKUS_GESAMT ? ` (${x.einheit})` : ''}`} · ${x.wer}: ${x.text.replace(/[<>]/g, ' ')}`).join('\n');
}
export const FOKUS_KOPF = 'FOKUS (Unser = gemeinsam, Mein = die Person, für die du arbeitest — dagegen planst du)';
export function fokusSatz(zeilen: readonly FokusZeile[]): string {
  if (!zeilen.length) return `${FOKUS_KOPF}: keiner gesetzt.`;
  return `${FOKUS_KOPF}:\n<daten quelle="fokus">\n${fokusZeilenText(zeilen)}\n</daten>`;
}
