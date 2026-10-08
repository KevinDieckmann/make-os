// ─── MAKE OS — Nordstern des Haushalts (rein, Server UND Browser) — 08.10. abends, Fragebogen Teil 3 ─────────────────────
// Kevin 08.10.: „Nordstern als gemeinsames Ziel von uns beiden pflegbar (Planung › Jahr)“ — „alles als eigene Daten“. Bis dahin
// stand der Nordstern als Konstante im Code (lib/make-one/nordstern-data.ts, entfernt) und galt für JEDE Instanz gleich.
//
// Warum ein eigener kleiner Bestand je Haushalt (`nordstern--<haushalt>`) und nicht der „Fokus des Jahres“ (lib/planung/jahr-fokus.ts):
//   · Der Nordstern gilt über Jahre — der Fokus ist ein Satz JE Jahr (und wird zum Jahreswechsel bewusst leer).
//   · Der Ziele-Bestand `ziele` (samt Fokus) liegt NICHT je Haushalt — eine Instanz mit mehreren Haushalten bekäme sonst einen
//     gemeinsamen Nordstern über Haushaltsgrenzen hinweg (Plattform-Regel: Trennung serverseitig).
//   · Der Fokus-Schreibweg hat keinen Stand (zu zweit gewinnt still der Letzte) und kürzt auf 300 Zeichen — hier gilt Stand/409
//     und „ablehnen statt kürzen“ (413).
// Der Bestand trägt keinen Personennamen (wer geändert hat, steht nur im Änderungsprotokoll) — Art. 15/17 betreffen ihn nicht.

/** Höchstlänge des Nordsterns — darüber wird abgelehnt (413), nie gekürzt. */
export const NORDSTERN_MAX = 1000;

/** Der gespeicherte Nordstern. Ohne Text gilt „kein Nordstern hinterlegt“. */
export interface Nordstern {
  text: string;
  /** Zeitpunkt der letzten Änderung (ISO) — setzt nur der Server. */
  geaendertAm?: string;
}

/** Datei `nordstern--<haushalt>`. `altbestand` = Marken der einmaligen Übernahme (lib/altbestand/nordstern-uebernahme.ts, nur Tage). */
export interface NordsternDatei {
  nordstern?: Nordstern | null;
  altbestand?: { nordstern?: string; kernziel?: string };
}

/** Was der Browser bekommt: Text (leer = keiner), Stand (Fingerabdruck), darf die Person schreiben. */
export interface NordsternAntwort {
  ok: true;
  text: string;
  geaendertAm: string | null;
  stand: string;
  darfSchreiben: boolean;
}

/** Eingabe säubern (rein): Zeilenenden vereinheitlichen, außen trimmen. Zu lang → Fehler mit Satz (nie gekürzt). */
export function nordsternEingabe(roh: unknown): { ok: true; text: string } | { ok: false; status: 400 | 413; fehler: string } {
  if (roh !== null && roh !== undefined && typeof roh !== 'string') return { ok: false, status: 400, fehler: 'Der Nordstern ist ein Text.' };
  const text = String(roh ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > NORDSTERN_MAX) return { ok: false, status: 413, fehler: `Abgelehnt: der Nordstern hat höchstens ${NORDSTERN_MAX} Zeichen (jetzt ${text.length}) — nichts gespeichert.` };
  return { ok: true, text };
}

/** Text des gespeicherten Nordsterns (rein) — leer, wenn keiner hinterlegt ist. */
export const nordsternTextVon = (d: NordsternDatei | null | undefined): string => (typeof d?.nordstern?.text === 'string' ? d.nordstern.text.trim() : '');

/** Der Satz für Prompts (rein): eine Zeile, ohne Zeilenumbrüche. `null`/leer → ehrlich „keiner hinterlegt“ (nie etwas Erfundenes). */
export function nordsternSatz(text: string | null | undefined): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t ? `Nordstern des Haushalts: ${t}` : 'Nordstern: keiner hinterlegt (pflegbar unter Planung › Jahr).';
}
