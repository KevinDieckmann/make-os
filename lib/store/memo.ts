// ─── MAKE OS — Zwischenspeicher für teure Berechnungen (26.09., Tempo) ──────
// Die Indizes (Wachstums-Score, Business-, Privat-, Gesundheits-Index,
// Traktion) rechnen über viele Bestände — auf dem 1-CPU-Server bei jedem
// Seitenwechsel neu. Hier: einmal rechnen, kurz behalten. Jede Schreibung in
// einen Bestand (local-db) erhöht den Stand → alles Gemerkte ist ungültig.
// Schlüssel tragen Person/Haushalt, damit nie jemand fremde Werte sieht.

const stand = { v: 0 };
const ablage = new Map<string, { v: number; t: number; wert: unknown; laeuft?: Promise<unknown> }>();

/** local-db ruft das nach jedem Schreiben — dann rechnet der nächste Aufruf neu. */
export function standErhoehen(): void { stand.v++; if (ablage.size > 200) ablage.clear(); }

/** In Tests aus (die Prüfungen schreiben über Attrappen, die den Stand nicht erhöhen) — außer ein Test schaltet ihn an. */
export const memoAktiv = (): boolean => process.env.MAKE_OS_MEMO === 'an' || (process.env.NODE_ENV !== 'test' && process.env.MAKE_OS_MEMO !== 'aus');

/** Ergebnis von `rechne` höchstens `ttlMs` lang und nur bis zur nächsten Schreibung wiederverwenden. Gleichzeitige Aufrufe teilen sich EINE Berechnung. */
export async function merken<T>(schluessel: string, ttlMs: number, rechne: () => Promise<T>): Promise<T> {
  if (!memoAktiv()) return rechne();
  const e = ablage.get(schluessel);
  if (e && e.v === stand.v && Date.now() - e.t < ttlMs) {
    if (e.laeuft) return e.laeuft as Promise<T>;
    return e.wert as T;
  }
  const v = stand.v;
  const laeuft = rechne().then(wert => { if (stand.v === v) ablage.set(schluessel, { v, t: Date.now(), wert }); else ablage.delete(schluessel); return wert; }, err => { ablage.delete(schluessel); throw err; });
  ablage.set(schluessel, { v, t: Date.now(), wert: undefined, laeuft });
  return laeuft;
}

export function memoLeeren(): void { ablage.clear(); }
