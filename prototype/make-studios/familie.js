/* MAKE Studios · die Adressen der Familie an genau EINER Stelle (Vorgabe STRUKTUR-MARKEN.md).
   Bis die echten Domains stehen, gelten die lokalen Vorschau-Adressen. Ohne Schrägstrich am Ende.
   Links im HTML tragen data-familie="innovation|studios|revenue|check" (optional data-pfad="/impressum/") und bekommen ihr
   href von hier. Im HTML steht derselbe Wert als Rückfall; seo.mjs schreibt ihn bei jedem Bau neu aus dieser Datei. */
export const FAMILIE = {
  innovation: 'http://localhost:3019',
  studios: 'http://localhost:3022',
  revenue: 'http://localhost:3023',
  check: 'http://localhost:3019'
};

if (typeof document !== 'undefined') {
  document.querySelectorAll('a[data-familie]').forEach((a) => {
    const basis = FAMILIE[a.dataset.familie];
    if (basis) a.href = basis.replace(/\/+$/, '') + (a.dataset.pfad || '/');
  });
}
