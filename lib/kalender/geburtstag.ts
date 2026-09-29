// ─── Geburtstag: EIN Format für CRM-Kontakt und Familien-Person (29.09., Paket K2, rein) ─
// Gespeichert wird genau eine von zwei Formen:
//   „TT.MM.“       — Tag und Monat ohne Jahr (Alter unbekannt)
//   „JJJJ-MM-TT“   — mit Jahr (das Alter lässt sich rechnen)
// Gelesen wird tolerant: „3.10.“, „03.10“, „3.10.1990“, „1990-10-03“, „10-03“ / „--10-03“ (vCard, Altbestand „MM-TT“).
// Die Säuberung prüft den Kalender (31.04. gibt es nicht; 29.02. ohne Jahr ja, mit Jahr nur im Schaltjahr) und lässt
// kein Jahr in der Zukunft oder vor 1900 zu. Genutzt von `saeubereKontakt` (lib/make-one/crm.ts), der Familie
// (lib/familie/speicher.ts) und den Kalender-Quellen (quellen-geburtstage.ts).

export interface GeburtstagTeile { monat: number; tag: number; jahr?: number }

const TAGE_IM_MONAT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const schaltjahr = (j: number) => (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0;

function gueltig(t: GeburtstagTeile): boolean {
  if (!Number.isInteger(t.monat) || t.monat < 1 || t.monat > 12) return false;
  if (!Number.isInteger(t.tag) || t.tag < 1 || t.tag > TAGE_IM_MONAT[t.monat - 1]) return false;
  if (t.jahr !== undefined) {
    if (!Number.isInteger(t.jahr) || t.jahr < 1900 || t.jahr > 2200) return false;
    if (t.monat === 2 && t.tag === 29 && !schaltjahr(t.jahr)) return false;
  }
  return true;
}

/** Tolerant lesen — null, wenn es kein gültiger Geburtstag ist. */
export function geburtstagLesen(roh: unknown): GeburtstagTeile | null {
  if (typeof roh !== 'string') return null;
  const s = roh.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let t: GeburtstagTeile | null = null;
  if (m) t = { jahr: +m[1], monat: +m[2], tag: +m[3] };
  else if ((m = /^(\d{1,2})\.\s?(\d{1,2})\.?(?:\s?(\d{4}))?$/.exec(s))) t = { tag: +m[1], monat: +m[2], ...(m[3] ? { jahr: +m[3] } : {}) };
  else if ((m = /^-{0,2}(\d{2})-(\d{2})$/.exec(s))) t = { monat: +m[1], tag: +m[2] };
  return t && gueltig(t) ? t : null;
}

const zwei = (n: number) => String(n).padStart(2, '0');

/** In die gespeicherte Form bringen — „TT.MM.“ oder „JJJJ-MM-TT“; undefined bei leer/ungültig. */
export function geburtstagSaeubern(roh: unknown, heute?: string): string | undefined {
  const t = geburtstagLesen(roh);
  if (!t) return undefined;
  if (t.jahr !== undefined) {
    const s = `${t.jahr}-${zwei(t.monat)}-${zwei(t.tag)}`;
    // Ein Geburtstag in der Zukunft ist ein Tippfehler — dann lieber nichts speichern.
    if (heute && s > heute) return undefined;
    return s;
  }
  return `${zwei(t.tag)}.${zwei(t.monat)}.`;
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** „3. Oktober“ bzw. „3. Oktober 1990“ — für Akte und Familie. Leer bei ungültig. */
export function geburtstagText(roh: unknown): string {
  const t = geburtstagLesen(roh);
  return t ? `${t.tag}. ${MONATE[t.monat - 1]}${t.jahr ? ` ${t.jahr}` : ''}` : '';
}

/** Als „MM-TT“ bzw. „JJJJ-MM-TT“ (das Format der „Wichtigen Tage“ der Familie) — null bei ungültig. */
export function alsTagesSchluessel(roh: unknown): string | null {
  const t = geburtstagLesen(roh);
  return t ? `${t.jahr ? `${t.jahr}-` : ''}${zwei(t.monat)}-${zwei(t.tag)}` : null;
}

/** Der Tag des Geburtstags in einem Jahr „JJJJ-MM-TT“ — der 29.02. fällt außerhalb von Schaltjahren auf den 28.02. */
export function geburtstagImJahr(t: GeburtstagTeile, jahr: number): string {
  const tag = t.monat === 2 && t.tag === 29 && !schaltjahr(jahr) ? 28 : t.tag;
  return `${jahr}-${zwei(t.monat)}-${zwei(tag)}`;
}

/** Der nächste Geburtstag ab `heute` (heute eingeschlossen) und in wie vielen Tagen. */
export function naechsterGeburtstag(roh: unknown, heute: string): { tag: string; inTagen: number; alter?: number } | null {
  const t = geburtstagLesen(roh);
  if (!t) return null;
  const j = Number(heute.slice(0, 4));
  let tag = geburtstagImJahr(t, j);
  if (tag < heute) tag = geburtstagImJahr(t, j + 1);
  const inTagen = Math.round((Date.parse(`${tag}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5);
  return { tag, inTagen, ...(t.jahr ? { alter: Number(tag.slice(0, 4)) - t.jahr } : {}) };
}

// ── Anzeige (client-sicher, ohne CRM-Abhängigkeit — die Quellen-Rechnung liegt in quellen-geburtstage.ts) ──

export const GEBURTSTAGE_KALENDER = 'Geburtstage';
export const GEBURTSTAG_FARBE = '#FF7EB6';

export type GeburtstagHerkunft = 'familie' | 'wichtiger-tag' | 'crm';

/** Ein Geburtstag im Zeitraum. */
export interface Geburtstag {
  id: string;
  name: string;
  /** Der Tag „JJJJ-MM-TT“ in diesem Jahr. */
  tag: string;
  /** Alter an diesem Tag, wenn das Geburtsjahr bekannt ist. */
  alter?: number;
  herkunft: GeburtstagHerkunft;
  space: 'privat' | 'business';
  href: string;
  kontaktId?: string;
  zustaendig?: string;
  /** Familien-Person dahinter (`fam-<id>`) — für „Geschenk vormerken“ (legt einen Wichtigen Tag mit `menschId` an). */
  menschId?: string;
  /**
   * Der „Wichtige Tag“ der Familie zu diesem Geburtstag (F2 M2) — DIE Quelle für Vorlauf, Aktion und „erledigt“ (je Jahr,
   * lib/familie/logik.ts). Heute rechnet damit, nicht mit einer eigenen Frist.
   */
  anlass?: GeburtstagAnlass;
}

export type AnlassAktion = 'geschenk' | 'karte' | 'anruf' | 'feier';
export interface GeburtstagAnlass { tagId: string; aktion: AnlassAktion; vorlaufTage: number; erledigt: boolean }

/** Sieht `person` diesen Geburtstag in Glocke und Heute? — EINE Regel (F2 M2): Familie = wer den Eintrag sieht (ohne
 * `zustaendig` bzw. die Person selbst), CRM = wer die Beziehung hält, „beide“ = beide. */
export const geburtstagFuer = (g: { zustaendig?: string }, person: string): boolean => !g.zustaendig || g.zustaendig === person || g.zustaendig === 'beide';

/** „Malin (40)“ bzw. „Malin“ — für Pillen und Listen. */
export const geburtstagTitel = (g: Pick<Geburtstag, 'name' | 'alter'>): string => `${g.name}${g.alter !== undefined && g.alter > 0 ? ` (${g.alter})` : ''}`;

/** „Malin hat heute Geburtstag (wird 40)“ / „… hat morgen Geburtstag“ — für Glocke und Heute. */
export function geburtstagSatz(g: Pick<Geburtstag, 'name' | 'alter'>, wann: 'heute' | 'morgen' | string): string {
  const w = wann === 'heute' ? 'heute' : wann === 'morgen' ? 'morgen' : `am ${wann.slice(8, 10)}.${wann.slice(5, 7)}.`;
  return `${g.name} hat ${w} Geburtstag${g.alter !== undefined && g.alter > 0 ? ` (wird ${g.alter})` : ''}`;
}
