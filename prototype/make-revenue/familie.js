// MAKE Revenue · die Adressen der Familie an genau EINER Stelle.
// Kevin kauft die Domains erst noch: Bis dahin stehen hier die lokalen Vorschau-Adressen.
// Für die Freigabe die echten Adressen eintragen (https, Schrägstrich am Ende ist egal) und danach „node seo.mjs“ ausführen:
// Das Skript schreibt Canonical, Vorschaubild, strukturierte Daten und den Rückfall aller Familien-Links im HTML neu.
// Links im HTML tragen data-familie="innovation|studios|revenue|check" (dazu wahlweise data-pfad="events/");
// verweise.js setzt ihr href im Browser aus dieser Datei. Ohne JavaScript gilt der Rückfall im HTML.
export const FAMILIE = {
  innovation: 'http://localhost:3019/',
  studios: 'http://localhost:3022/',
  revenue: 'http://localhost:3023/',
  // Der kostenlose Vertriebs-Check läuft bei MAKE Innovation (Thema „vertrieb“, siehe lib/check/katalog.ts).
  check: 'http://localhost:3019/check?thema=vertrieb',
};
