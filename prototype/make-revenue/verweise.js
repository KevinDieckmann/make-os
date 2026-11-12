// MAKE Revenue · Verweise zur Familie: jedes <a data-familie="…"> bekommt sein href aus familie.js.
// data-pfad hängt einen Pfad an (z. B. „events/“). Scheitert das Laden, bleibt der Rückfall aus dem HTML stehen.
import { FAMILIE } from './familie.js';

for (const a of document.querySelectorAll('a[data-familie]')) {
  const basis = FAMILIE[a.dataset.familie];
  if (!basis) continue;
  try {
    const ziel = a.dataset.pfad ? new URL(a.dataset.pfad, basis.endsWith('/') ? basis : basis + '/') : new URL(basis);
    a.href = ziel.href;
  } catch (_) { /* Rückfall im HTML bleibt */ }
}
