/* MAKE Studios · die Adressen von MAKE Innovation und MAKE Revenue an genau EINER Stelle. Ohne Schrägstrich am Ende.
   Links im HTML tragen data-familie="innovation|studios|revenue|check" (optional data-pfad="/impressum/") und bekommen ihr
   href von hier. Im HTML steht derselbe Wert als Rückfall; seo.mjs schreibt ihn bei jedem Bau neu aus dieser Datei.
   seo.mjs liest die Zeilen der Liste FAMILIE (je Adresse eine Zeile); die lokale Liste steht deshalb in EINER Zeile. */
export const FAMILIE = {
  innovation: 'https://makeinnovation.de',
  studios: 'https://makestudios.de',
  revenue: 'https://makerevenue.de',
  check: 'https://makeinnovation.de'
};

/* Lokale Vorschau: Läuft die Seite auf dem eigenen Rechner, führen die Familien-Links zu den lokalen Vorschauen. */
const LOKAL = { innovation: 'http://localhost:3019', studios: 'http://localhost:3022', revenue: 'http://localhost:3023', check: 'http://localhost:3019' };

if (typeof document !== 'undefined') {
  const lokal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const liste = lokal ? LOKAL : FAMILIE;
  document.querySelectorAll('a[data-familie]').forEach((a) => {
    const basis = liste[a.dataset.familie];
    if (basis) a.href = basis.replace(/\/+$/, '') + (a.dataset.pfad || '/');
  });
}
