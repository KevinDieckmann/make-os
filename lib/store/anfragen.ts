// ─── Einmal-Wirkung je Anfrage (Idempotenz, 29.09., Paket D-A #19) ─────────────
// Ein Netz-Retry beim Übernehmen eines Belegs legte die Rechnung doppelt an — die Liquiditätsvorschau zählte
// den Eingang zweimal. Jetzt schickt der Browser je Aktion eine `anfrageId` (einmal erzeugt, bei Wiederholung
// dieselbe). Der Server reserviert sie VOR der Wirkung (in der Sperre des Bestands `anfragen-ergebnis`),
// merkt sich das Ergebnis 24 h und liefert es bei einer Wiederholung zurück, statt noch einmal zu schreiben.
// Läuft dieselbe Anfrage gerade noch (Doppelklick), gibt es 409 — nie zwei Wirkungen.

import { updateJson } from './local-db';

export const ANFRAGEN_SPEICHER = 'anfragen-ergebnis';
const HALTEN_MS = 24 * 3_600_000;
/** Hängt eine Reservierung länger (Absturz mitten in der Wirkung), darf ein neuer Versuch laufen. */
const LAEUFT_HOECHSTENS_MS = 5 * 60_000;
export const ANFRAGE_ID_OK = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/;

interface Eintrag { zeit: string; art: string; status: 'laeuft' | 'fertig'; antwortStatus?: number; antwort?: unknown }
interface Speicher { anfragen: Record<string, Eintrag> }

export interface Antwort<T> { status: number; body: T; wiederholt?: boolean }

/**
 * `fn` höchstens einmal je (art, anfrageId) wirken lassen. Ohne gültige anfrageId läuft `fn` wie bisher.
 * Wirft `fn`, wird die Reservierung freigegeben (ein neuer Versuch darf laufen).
 */
export async function einmalig<T>(art: string, anfrageId: unknown, fn: () => Promise<Antwort<T>>, jetzt = () => Date.now()): Promise<Antwort<T | { ok: false; error: string }>> {
  if (typeof anfrageId !== 'string' || !ANFRAGE_ID_OK.test(anfrageId)) return fn();
  const schluessel = `${art}:${anfrageId}`;
  let vorher: Eintrag | undefined;
  await updateJson<Speicher>(ANFRAGEN_SPEICHER, cur => {
    const t = jetzt();
    const anfragen = Object.fromEntries(Object.entries(cur?.anfragen ?? {}).filter(([, e]) => t - Date.parse(e.zeit) < HALTEN_MS));
    const e = anfragen[schluessel];
    if (e && (e.status === 'fertig' || t - Date.parse(e.zeit) < LAEUFT_HOECHSTENS_MS)) { vorher = e; return { anfragen }; }
    anfragen[schluessel] = { zeit: new Date(t).toISOString(), art, status: 'laeuft' };
    return { anfragen };
  });
  const v = vorher as Eintrag | undefined;
  if (v?.status === 'fertig') return { status: v.antwortStatus ?? 200, body: v.antwort as T, wiederholt: true };
  if (v) return { status: 409, body: { ok: false, error: 'Diese Anfrage läuft gerade schon — gleich noch einmal ansehen, nichts doppelt angelegt.' } };
  let r: Antwort<T>;
  try { r = await fn(); }
  catch (e) {
    await updateJson<Speicher>(ANFRAGEN_SPEICHER, cur => { const a = { ...(cur?.anfragen ?? {}) }; delete a[schluessel]; return { anfragen: a }; });
    throw e;
  }
  // Nur eine Wirkung wird gemerkt (2xx). Eine Ablehnung (4xx) hat nichts angelegt — ein neuer Versuch darf laufen.
  await updateJson<Speicher>(ANFRAGEN_SPEICHER, cur => {
    const a = { ...(cur?.anfragen ?? {}) };
    if (r.status >= 200 && r.status < 300) a[schluessel] = { zeit: new Date(jetzt()).toISOString(), art, status: 'fertig', antwortStatus: r.status, antwort: r.body };
    else delete a[schluessel];
    return { anfragen: a };
  });
  return r;
}
