// ─── Gmail — die Liste der Inbox (rein, client-sicher, 03.10.2026) ───────────
// Aus den Nachrichten des Spiegels (GET /api/gmail) werden Threads (eine Zeile je Thread, die jüngste Nachricht vorn), mit einer
// Einstufung OHNE Modell: Gmail-Kategorien und Listen-Mails sind „Rauschen“, zugeordnete Personen und markierte Mails „Wichtig“.
// (Die ZOE-Einstufung der übrigen Postfächer läuft über einen gemeinsamen Zwischenspeicher — für Gmail gehen Betreff und Absender
// nie dorthin: das andere Konto würde sie sonst im Schlüssel sehen. Deshalb hier nur lokale Regeln.)
import type { Adr, Zuordnung } from './typen';

/** Eine Nachricht, wie die Liste sie bekommt (schlank, ohne Text). */
export interface ListeNachricht {
  id: string; threadId: string; am: string; von: Adr; an: Adr[]; betreff: string; ausschnitt: string; labels: string[];
  ungelesen: boolean; posteingang: boolean; gesendet: boolean; anhaenge: number; liste?: boolean; zuordnung?: Zuordnung;
}

export type Stufe = 'wichtig' | 'normal' | 'rauschen';

export interface ThreadZeile {
  /** Kennung der Zeile = Kennung der jüngsten Nachricht (`gmail-<id>` in der Inbox). */
  id: string;
  threadId: string;
  /** Alle Nachrichten des Threads, jüngste zuerst. */
  nachrichten: ListeNachricht[];
  juengste: ListeNachricht;
  /** Absender der Zeile: bei gesendeten Mails der Empfänger. */
  gegenueber: Adr;
  ungelesen: boolean;
  /** Mindestens eine Nachricht liegt im Posteingang (= offen). */
  offen: boolean;
  zuordnung?: Zuordnung;
  stufe: Stufe;
  anzahl: number;
}

const RAUSCHEN = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'CATEGORY_UPDATES'];

/** Einstufung eines Threads (rein): Rauschen vor Wichtig vor Normal; eine zugeordnete Person ist nie Rauschen. */
export function stufeVon(nachrichten: readonly ListeNachricht[]): Stufe {
  const zugeordnet = nachrichten.some(n => !!n.zuordnung);
  const markiert = nachrichten.some(n => n.labels.includes('STARRED') || n.labels.includes('IMPORTANT'));
  if (!zugeordnet && nachrichten.every(n => n.liste || n.labels.some(l => RAUSCHEN.includes(l)))) return 'rauschen';
  if (zugeordnet || markiert) return 'wichtig';
  return 'normal';
}

/** Nachrichten → Thread-Zeilen, jüngster Thread zuerst. */
export function threadsAus(nachrichten: readonly ListeNachricht[]): ThreadZeile[] {
  const je = new Map<string, ListeNachricht[]>();
  for (const n of nachrichten) { const l = je.get(n.threadId); if (l) l.push(n); else je.set(n.threadId, [n]); }
  const zeilen: ThreadZeile[] = [];
  for (const [threadId, l] of je) {
    const sortiert = [...l].sort((a, b) => b.am.localeCompare(a.am));
    const juengste = sortiert[0];
    const gegenueber = juengste.gesendet && juengste.an[0] ? juengste.an[0] : juengste.von;
    const z = sortiert.find(n => n.zuordnung)?.zuordnung;
    zeilen.push({
      id: juengste.id, threadId, nachrichten: sortiert, juengste, gegenueber, ungelesen: sortiert.some(n => n.ungelesen), offen: sortiert.some(n => n.posteingang),
      ...(z ? { zuordnung: z } : {}), stufe: stufeVon(sortiert), anzahl: sortiert.length,
    });
  }
  return zeilen.sort((a, b) => b.juengste.am.localeCompare(a.juengste.am));
}

/** Die Thread-Zeile, in der eine Nachricht steht (für den Link `?offen=gmail-<Nachrichten-Kennung>` aus dem Verlauf). */
export const zeileMitNachricht = (zeilen: readonly ThreadZeile[], nachrichtId: string): ThreadZeile | undefined =>
  zeilen.find(z => z.id === nachrichtId || z.nachrichten.some(n => n.id === nachrichtId));

export const GMAIL_PRAEFIX = 'gmail-';
/** `gmail-<id>` → `<id>`; alles andere → null. */
export const gmailIdAus = (v: string | null | undefined): string | null => (v && v.startsWith(GMAIL_PRAEFIX) && /^[A-Za-z0-9]{6,40}$/.test(v.slice(GMAIL_PRAEFIX.length)) ? v.slice(GMAIL_PRAEFIX.length) : null);

/** Wie lang ist es her — „vor 5 Min.“, „vor 2 Std.“, „3 Tage“ (für die Statuszeile). */
export function vorText(min: number | null | undefined): string {
  if (min === null || min === undefined) return 'noch nie';
  if (min < 1) return 'gerade eben';
  if (min < 120) return `vor ${min} Min.`;
  if (min < 48 * 60) return `vor ${Math.round(min / 60)} Std.`;
  return `vor ${Math.round(min / 1440)} Tagen`;
}
