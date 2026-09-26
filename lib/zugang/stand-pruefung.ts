// ─── MAKE OS — Gilt ein Sitzungszettel noch? (26.09.) ───────────────────────
// Die Middleware läuft am Rand (kein Dateizugriff). Sie fragt deshalb den
// Server nach dem Stand des Kontos — mit dem Dienstschlüssel, höchstens einmal
// je Minute je Konto (bei einem unpassenden Zettel einmal sofort). Drei Dinge
// machen einen signierten Zettel ungültig: ein neues Passwort (Stand), „alle
// anderen Geräte abmelden“ (ausgestellt vor `ab`) und Abmelden (Widerruf der
// Kennung). Ist der Server gerade nicht erreichbar (Start), gilt der signierte
// Zettel weiter: die Rücknahme ist Bestreben, die Signatur die Schranke.

import { innenAdresse } from '@/lib/innen';
import type { Sitzung } from '@/lib/zugang/sitzung';

const TTL_MS = 60_000;
/** Ein schon abgelehnter Zettel wird frühestens nach so vielen ms erneut beim Server nachgefragt. */
const NACHFRAGE_MS = 5_000;
interface Stand { stand: string; ab: number; widerrufen: string[]; bis: number; abgelehnt: Map<string, number> }
/** speicher → Stand laut Server (stand '' = Konto gibt es nicht mehr). */
const gemerkt = new Map<string, Stand>();

const passt = (m: Stand, s: Sitzung) => m.stand === s.stand && s.ausgestellt >= m.ab && !m.widerrufen.includes(s.sid);

export async function standGueltig(req: Request, s: Sitzung, schluessel: string): Promise<boolean> {
  const jetzt = Date.now();
  const alt = gemerkt.get(s.speicher);
  const kennung = `${s.stand}.${s.sid}`;
  if (alt && alt.bis > jetzt) {
    if (passt(alt, s)) return true;
    // Unpassend: ein noch nie gesehener Zettel (gerade Passwort geändert / neu angemeldet) wird sofort
    // nachgefragt, ein schon abgelehnter (altes Gerät) frühestens nach fünf Sekunden wieder.
    const zuletzt = alt.abgelehnt.get(kennung);
    if (zuletzt && zuletzt + NACHFRAGE_MS > jetzt) return false;
  }
  try {
    const r = await fetch(`${innenAdresse(req)}/api/konto/stand?speicher=${encodeURIComponent(s.speicher)}`, { headers: { 'x-make-key': schluessel }, cache: 'no-store' });
    if (!r.ok && r.status !== 404) throw new Error(`Stand: ${r.status}`);
    const d = r.status === 404 ? { stand: '', ab: 0, widerrufen: [] } : ((await r.json()) as { stand?: unknown; ab?: unknown; widerrufen?: unknown });
    if (typeof d.stand !== 'string') throw new Error('Stand: keine Antwort');
    const neu: Stand = {
      stand: d.stand, ab: typeof d.ab === 'number' ? d.ab : 0,
      widerrufen: Array.isArray(d.widerrufen) ? d.widerrufen.filter((x): x is string => typeof x === 'string') : [],
      bis: jetzt + TTL_MS, abgelehnt: alt?.abgelehnt ?? new Map<string, number>(),
    };
    const ok = passt(neu, s);
    if (!ok) neu.abgelehnt.set(kennung, jetzt);
    neu.abgelehnt.forEach((t, k) => { if (t + TTL_MS < jetzt) neu.abgelehnt.delete(k); });
    gemerkt.set(s.speicher, neu);
    return ok;
  } catch {
    return alt ? passt(alt, s) : true;
  }
}

/** Für Tests: den gemerkten Stand vergessen. */
export function standVergessen(speicher?: string) {
  if (speicher) gemerkt.delete(speicher); else gemerkt.clear();
}
