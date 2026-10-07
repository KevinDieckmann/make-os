// ─── Inbox 2 — eine neue Mail von woanders vorbereiten (Browser, 06.10.2026) ───────────────────────────────────
// Ersetzt „In Apple Mail öffnen“ (osascript, nur auf Kevins Mac): Kontaktakte und Prospecting legen den Entwurf in den
// Sitzungsspeicher DIESES Tabs und öffnen `/os/inbox?neu=1` — dort wählt die Person das Postfach (Absender je Bereich), prüft und
// sendet per Einzelklick (§ 7 UWG-Prüfung wie bei jeder Antwort). Keine Adresse und kein Text in der Adresszeile.

export interface NeueMail { an?: string; name?: string; betreff?: string; text?: string }

const KEY = 'make-inbox-neu';
export const NEUE_MAIL_PFAD = '/os/inbox?neu=1';

export function neueMailVorbereiten(m: NeueMail): string {
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ an: m.an ?? '', name: m.name ?? '', betreff: (m.betreff ?? '').slice(0, 300), text: (m.text ?? '').slice(0, 20_000) })); } catch { /* voll/privat — dann leer */ }
  return NEUE_MAIL_PFAD;
}

/** Den vorbereiteten Entwurf holen (und aus dem Speicher nehmen). */
export function neueMailHolen(): NeueMail | null {
  try {
    const roh = window.sessionStorage.getItem(KEY);
    if (!roh) return null;
    window.sessionStorage.removeItem(KEY);
    const d = JSON.parse(roh) as NeueMail;
    return d && typeof d === 'object' ? d : null;
  } catch { return null; }
}
