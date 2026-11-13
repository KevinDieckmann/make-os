// MAKE Revenue · Verweise zur Familie: jedes <a data-familie="…"> bekommt sein href aus familie.js.
// data-pfad hängt einen Pfad an (z. B. „events/“). Scheitert das Laden, bleibt der Rückfall aus dem HTML stehen.
// Lokale Vorschau: Läuft die Seite auf dem eigenen Rechner, führen die Verweise zu den lokalen Vorschauen der Familie.
import { FAMILIE } from './familie.js';

const LOKAL = { innovation: 'http://localhost:3019/', studios: 'http://localhost:3022/', revenue: 'http://localhost:3023/', check: 'http://localhost:3019/check?thema=sichtbarkeit-vertrieb&q=revenue' };
const liste = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? LOKAL : FAMILIE;

for (const a of document.querySelectorAll('a[data-familie]')) {
  const basis = liste[a.dataset.familie];
  if (!basis) continue;
  try {
    const ziel = a.dataset.pfad ? new URL(a.dataset.pfad, basis.endsWith('/') ? basis : basis + '/') : new URL(basis);
    a.href = ziel.href;
  } catch (_) { /* Rückfall im HTML bleibt */ }
}
