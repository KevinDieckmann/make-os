// ─── Welche Gesellschaften und Einheiten sieht eine Person? — die EINE Regel (15.10., Abnahme 2 A1) ──────────────────────────────────────
// Kevin (CLAUDE.md, Plattform-Regel „Trennung serverseitig, nie nur versteckt“): ein Konto „nur Business“ (`finanzRecht: 'business'`) bekommt in
// keiner Antwort etwas aus Privat, aus der Selbstständigkeit (Privat-Einheit, `gehoertZuPrivat`) oder aus Gesellschaften des Registers, für die
// ihm die Firmen-Akte „nicht freigegeben“ sagt. Die zweite Abnahme (15.10.) fand die Selbstständigkeit und die Gesellschaft in Gründung noch in
// der Brain-Kugel, der Postfach-Verwaltung und bei den Visitenkarten — jede Stelle hatte ihre eigene Liste der Bereiche.
// Rein (Server und Browser): WAS sichtbar ist. WER was sieht, lädt ./sicht-server.ts (`einheitenSichtFuer`) aus den zwei vorhandenen Regeln:
//   · `privat`   — Privat-Bereich des Haushalts (`privatAusgeblendetFuer`, EINE Konto-Sicht): `privat` und jede Privat-Einheit.
//   · `register` — Gesellschafts-Register (Firmen-Akte, `firmenAkteAusgeblendetFuer` → `rechtZugangFuer`): Register-Gesellschaften `g-…`.
// Die festen Business-Gesellschaften (lib/einheiten.ts, `BUSINESS_GESELLSCHAFTEN`) und Kunden-Bereiche (`m-…`) sieht jede Business-Sicht.
// Wächter: tests/nur-business-sicht.test.ts (alle lesenden Routen mit der Sitzung „nur Business“).

import { gehoertZuPrivat, istRegisterKennung } from '@/lib/einheiten';

export interface EinheitenSicht {
  /** Privat und die Privat-Einheiten (Selbstständigkeit). */
  privat: boolean;
  /** Register-Gesellschaften (`g-…`) — nur mit Zugang zur Firmen-Akte. */
  register: boolean;
}

/** Systemlauf bzw. volles Mitglied: alles. */
export const EINHEITEN_ALLES: EinheitenSicht = Object.freeze({ privat: true, register: true });
/** Konten unlesbar (fail-closed): nur Business ohne Register. */
export const EINHEITEN_NUR_BUSINESS: EinheitenSicht = Object.freeze({ privat: false, register: false });

/** Darf diese Sicht die Kennung sehen (`privat`, feste Gesellschaft, `g-…`, `m-…`, sonst Unbekanntes)? */
export function kennungSichtbar(id: unknown, s: EinheitenSicht): boolean {
  if (gehoertZuPrivat(id)) return s.privat;
  if (istRegisterKennung(id)) return s.register;
  return true;
}

/** Nur die Einträge, deren Kennung (`id`) die Sicht sehen darf (dieselben Objekte, Reihenfolge bleibt). */
export const nurSichtbareKennungen = <E extends { id: string }>(l: readonly E[], s: EinheitenSicht): E[] =>
  s.privat && s.register ? [...l] : l.filter(e => kennungSichtbar(e.id, s));

/**
 * Einheiten, die als NAME gespeichert sind (Ziele, Meilensteine, Routinen tragen `einheit` = Anzeigename): verborgen, wenn der Name einer
 * Privat-Einheit oder — ohne Register-Zugang — einer Register-Gesellschaft gehört. `namen` = Name → Kennung (lib/einheiten.ts + Register).
 */
export function einheitNameSichtbar(einheit: unknown, s: EinheitenSicht, namen: ReadonlyMap<string, string>): boolean {
  if (typeof einheit !== 'string' || !einheit) return true;
  const id = namen.get(einheit) ?? einheit;
  return kennungSichtbar(id, s);
}
