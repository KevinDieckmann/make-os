// MAKE Revenue · die Adressen von MAKE Innovation und MAKE Studios an genau EINER Stelle.
// Nach einer Änderung „node seo.mjs“ ausführen: Das Skript schreibt Canonical, Vorschaubild, strukturierte Daten und den
// Rückfall aller Familien-Links im HTML neu.
// Links im HTML tragen data-familie="innovation|studios|revenue|check" (dazu wahlweise data-pfad="events/");
// verweise.js setzt ihr href im Browser aus dieser Datei. Ohne JavaScript gilt der Rückfall im HTML.
// Auf dem eigenen Rechner führt verweise.js stattdessen zu den lokalen Vorschauen.
export const FAMILIE = {
  innovation: 'https://makeinnovation.de/',
  studios: 'https://makestudios.de/',
  revenue: 'https://makerevenue.de/',
  // Der kostenlose Sichtbarkeits- und Vertriebs-Check läuft bei MAKE Innovation (siehe lib/check/katalog.ts).
  check: 'https://makeinnovation.de/check?thema=sichtbarkeit-vertrieb&q=revenue',
};
