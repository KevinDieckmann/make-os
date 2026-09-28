// ─── Aktivitäten: Anker und Löschmarken (rein, ohne Importe, 28.09., Paket H4) ─
// Der Verlauf eines Kontakts ist ein Anhänge-Log: `kontaktVereinen` (lib/make-one/crm.ts)
// holt beim Speichern alles zurück, was ein älterer Stand nicht kennt. Damit eine
// gelöschte oder geänderte Notiz dabei nicht wieder aufersteht (ZOE, Import, ein altes
// Fenster ohne Stand), hält der Kontakt eine LÖSCHMARKE je entfernter Fassung:
//   Marke = `<anker>~<texthash>`  — anker = `akt-<FNV(am|art|von|bezug)>` (wie im Reiter
//   Aktivitäten, ohne die Folgenummer), texthash = FNV über den Text.
// Eine Marke trifft also genau EINE Fassung eines Eintrags: Löschen markiert die
// Fassung, Ändern markiert die alte Fassung (die neue hat einen anderen Text).
// Marken setzt nur der Server (POST /api/crm/aktivitaet, aktion aendern|loeschen);
// beim Vereinen gelten die gespeicherten Marken, nie die aus dem Browser.
// Ohne Importe, damit das Modell (lib/make-one/crm.ts) und lib/crm/aktivitaeten.ts
// beide darauf bauen können, ohne Kreis.

/** Höchstens so viele Löschmarken je Kontakt — die ältesten fallen zuerst heraus. */
export const MARKEN_MAX = 500;
const MARKE = /^akt-[a-z0-9]{1,13}~[a-z0-9]{1,13}$/;

/** FNV-1a, 32 Bit, base36 — kurz und stabil. */
export function kurzHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

type Kern = { am: string; art: string; von: string; bezug?: string; text?: string };

/** Anker ohne Folgenummer: stabil gegen Textänderung und Umsortieren. */
export const grundAnker = (a: Pick<Kern, 'am' | 'art' | 'von' | 'bezug'>): string => `akt-${kurzHash(`${a.am}|${a.art}|${a.von}|${a.bezug ?? ''}`)}`;

/** Die Löschmarke genau dieser Fassung eines Eintrags. */
export const aktivitaetMarke = (a: Kern): string => `${grundAnker(a)}~${kurzHash(a.text ?? '')}`;

export const istMarke = (v: unknown): v is string => typeof v === 'string' && MARKE.test(v);

/** Marken aus dem Netz: nur gültige, ohne Doppelte, die jüngsten MARKEN_MAX. */
export function markenSaeubern(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const l = Array.from(new Set(v.filter(istMarke)));
  return l.length ? l.slice(-MARKEN_MAX) : undefined;
}

/** Verlauf ohne die markierten Fassungen. */
export function ohneMarkierte<A extends Kern>(liste: readonly A[], marken: readonly string[] | undefined): A[] {
  if (!marken?.length) return [...liste];
  const m = new Set(marken);
  return liste.filter(a => !m.has(aktivitaetMarke(a)));
}

/** Marken ergänzen (ans Ende, ohne Doppelte), eine Fassung, die wieder gilt, herausnehmen; höchstens MARKEN_MAX. */
export function markenMit(alt: readonly string[] | undefined, dazu: readonly string[], weg: readonly string[] = []): string[] | undefined {
  const raus = new Set([...dazu, ...weg]);
  const l = [...(alt ?? []).filter(x => !raus.has(x)), ...dazu.filter(x => !weg.includes(x))];
  return l.length ? l.slice(-MARKEN_MAX) : undefined;
}
