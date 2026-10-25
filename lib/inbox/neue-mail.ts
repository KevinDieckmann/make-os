// ─── Inbox 2 — eine neue Mail von woanders vorbereiten (Browser, 06.10.2026) ───────────────────────────────────
// Ersetzt „In Apple Mail öffnen“ (osascript, nur auf Kevins Mac): Kontaktakte und Prospecting legen den Entwurf in den
// Sitzungsspeicher DIESES Tabs und öffnen `/os/inbox?neu=1` — dort wählt die Person das Postfach (Absender je Bereich), prüft und
// sendet per Einzelklick (§ 7 UWG-Prüfung wie bei jeder Antwort). Keine Adresse und kein Text in der Adresszeile.

/**
 * `anhaenge` (25.10., „Über <Postfach> senden (mit PDF)“): Kennungen eigener Ablage-Dateien (nur Kennung + Name zur Anzeige, nie Bytes) — der Server lädt
 * und prüft sie. `beleg`: das Angebot bzw. die Rechnung dazu — der Server prüft, dass der Anhang GENAU dessen PDF ist, und vermerkt „versendet am … über …“.
 */
export interface NeueMail { an?: string; name?: string; betreff?: string; text?: string; anhaenge?: { datei: string; name: string }[]; beleg?: { art: 'angebot' | 'rechnung'; id: string } }

const KEY = 'make-inbox-neu';
export const NEUE_MAIL_PFAD = '/os/inbox?neu=1';

export function neueMailVorbereiten(m: NeueMail): string {
  const anhaenge = (m.anhaenge ?? []).filter(a => /^d-[a-z0-9-]{4,60}$/.test(a.datei)).slice(0, 3).map(a => ({ datei: a.datei, name: String(a.name ?? '').slice(0, 120) }));
  const beleg = m.beleg && (m.beleg.art === 'angebot' || m.beleg.art === 'rechnung') && /^[a-z0-9][a-z0-9-]{2,79}$/.test(m.beleg.id) ? m.beleg : undefined;
  try { window.sessionStorage.setItem(KEY, JSON.stringify({ an: m.an ?? '', name: m.name ?? '', betreff: (m.betreff ?? '').slice(0, 300), text: (m.text ?? '').slice(0, 20_000), ...(anhaenge.length ? { anhaenge } : {}), ...(beleg ? { beleg } : {}) })); } catch { /* voll/privat — dann leer */ }
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
