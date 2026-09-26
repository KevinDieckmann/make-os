// ─── MAKE OS — Gilt der Passwort-Stand einer Sitzung noch? (26.09.) ─────────
// Die Middleware läuft am Rand (kein Dateizugriff). Sie fragt deshalb den
// Server nach dem aktuellen Stand des Kontos — mit dem Dienstschlüssel, höchstens
// einmal je Minute je Konto (bei einem unpassenden Zettel einmal sofort). Ändert
// jemand sein Passwort, ist das eigene Gerät sofort wieder drin, alle anderen
// sind ab dem nächsten Klick draußen. Ist der Server gerade nicht erreichbar
// (Start), gilt der signierte Zettel weiter: die Rücknahme ist Bestreben, die
// Signatur die Schranke.

import { innenAdresse } from '@/lib/innen';

const TTL_MS = 60_000;
/** Ein schon abgelehnter Zettel wird frühestens nach so vielen ms erneut beim Server nachgefragt. */
const NACHFRAGE_MS = 5_000;
/** speicher → Stand laut Server ('' = Konto gibt es nicht mehr) + zuletzt abgelehnte Zettel-Stände. */
const gemerkt = new Map<string, { stand: string; bis: number; abgelehnt: Map<string, number> }>();

export async function standGueltig(req: Request, speicher: string, stand: string, schluessel: string): Promise<boolean> {
  const jetzt = Date.now();
  const alt = gemerkt.get(speicher);
  if (alt && alt.bis > jetzt) {
    if (alt.stand === stand) return true;
    // Unpassend: ein noch nie gesehener Stand (gerade Passwort geändert) wird sofort nachgefragt,
    // ein schon abgelehnter (altes Gerät) frühestens nach fünf Sekunden wieder.
    const zuletzt = alt.abgelehnt.get(stand);
    if (zuletzt && zuletzt + NACHFRAGE_MS > jetzt) return false;
  }
  try {
    const r = await fetch(`${innenAdresse(req)}/api/konto/stand?speicher=${encodeURIComponent(speicher)}`, { headers: { 'x-make-key': schluessel }, cache: 'no-store' });
    if (!r.ok && r.status !== 404) throw new Error(`Stand: ${r.status}`);
    const d = r.status === 404 ? { stand: '' } : ((await r.json()) as { stand?: unknown });
    if (typeof d.stand !== 'string') throw new Error('Stand: keine Antwort');
    const abgelehnt = alt?.abgelehnt ?? new Map<string, number>();
    if (d.stand !== stand) abgelehnt.set(stand, jetzt);
    abgelehnt.forEach((t, k) => { if (t + TTL_MS < jetzt) abgelehnt.delete(k); });
    gemerkt.set(speicher, { stand: d.stand, bis: jetzt + TTL_MS, abgelehnt });
    return d.stand === stand;
  } catch {
    return alt ? alt.stand === stand : true;
  }
}

/** Für Tests und den Passwortwechsel: den gemerkten Stand vergessen. */
export function standVergessen(speicher?: string) {
  if (speicher) gemerkt.delete(speicher); else gemerkt.clear();
}
