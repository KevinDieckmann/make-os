// ─── Pegel: die Rechenregeln hinter der Lautstärke ──────────────────────────
// In einer .ts, nicht im Hook: vitest übersetzt in diesem Projekt kein JSX,
// und diese drei Regeln sind der Unterschied zwischen „zappelt" und „atmet".

/**
 * Welche Frequenzfächer die Stimme tragen.
 *
 * Der Gesamtmittelwert über alle Fächer wäre falsch: unten sitzt der Lüfter
 * des Rechners und das Brummen des Raums, oben Zischlaute und Rauschen. Die
 * Sprachgrundfrequenz eines Erwachsenen liegt zwischen etwa 85 Hz und —
 * mitsamt der ersten Formanten — 1,4 kHz. Nur dieses Band wird gemessen,
 * deshalb schlägt der Kranz bei Stille nicht aus.
 */
export function sprachBereich(abtastrate: number, faecher: number): { von: number; bis: number } {
  // Ein Fach deckt (Abtastrate / 2) / Fächerzahl Hertz ab.
  const proFach = abtastrate / 2 / faecher;
  const von = Math.max(1, Math.floor(85 / proFach));
  const bis = Math.min(faecher - 1, Math.ceil(1400 / proFach));
  // Bei absurden Werten (Testumgebungen ohne echte Audiokarte) lieber ein
  // schmales gültiges Band als ein leeres.
  return bis > von ? { von, bis } : { von: 1, bis: Math.min(faecher - 1, 2) };
}

/**
 * Hüllkurve: schnell hoch, langsam runter.
 *
 * Ohne sie folgt der Ausschlag jedem einzelnen Stimmbandschlag und flackert.
 * Mit ihr steigt er sofort an, wenn jemand anfängt zu sprechen, und fällt
 * über eine knappe Sekunde ab — so, wie ein Pegelmesser sich anfühlt.
 */
export const ANSTIEG = 0.35;
export const ABFALL = 0.08;

export function huelle(jetzt: number, ziel: number): number {
  const k = ziel > jetzt ? ANSTIEG : ABFALL;
  return jetzt + (ziel - jetzt) * k;
}

/**
 * Rohwert auf 0..1 spreizen. Normale Sprechlautstärke landet im Mittelband
 * bei etwa 0,08–0,35 des Messbereichs — ohne Spreizung bliebe der Kranz
 * immer flach.
 */
export function spreize(roh: number): number {
  return Math.min(1, Math.max(0, roh * 3.2));
}
