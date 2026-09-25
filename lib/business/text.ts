// ─── Business-Index — Zahlen und Schwellen als Text (rein) ──────────────────
// Oberfläche, Jarvis und Head of Finance sagen es gleich.

import type { KennzahlStand } from './index';

const z = (n: number, s = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: s });
/** Eine Schwelle in der Einheit der Kennzahl. */
export function schwelle(n: number, e: KennzahlStand['einheit']): string {
  switch (e) {
    case 'eur': return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    case 'prozent': return `${z(n)} %`;
    case 'monate': return `${z(n)} Monate`;
    case 'tage': return `${z(n, 0)} Tage`;
    case 'faktor': return z(n, 2);
    case 'stunden': return `${z(n)} h`;
    case 'anzahl': return z(n);
    case 'punkte': return `${z(n, 0)} Punkte`;
  }
}
export const schwellenText = (k: Pick<KennzahlStand, 'richtung' | 'gruen' | 'rot' | 'einheit'>) =>
  k.richtung === 'hoch' ? `grün ab ${schwelle(k.gruen, k.einheit)} · rot unter ${schwelle(k.rot, k.einheit)}` : `grün bis ${schwelle(k.gruen, k.einheit)} · rot über ${schwelle(k.rot, k.einheit)}`;

