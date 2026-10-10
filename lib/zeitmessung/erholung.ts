// ─── Zeit & Fokus — Erholung als eigener Zeitbereich (10.10.) ──────────────────────────────────────────────────────────────────
// Auftrag 10.10.: Erholung „überall einstellbar“ — auch in der Zeit. Bewusste Erholung (Fokus-Zähler, gestartet im Reiter Erholung oder an
// einem Erholungs-Block im Kalender) läuft unter EINEM Schlüssel im Privat-Bereich: `privat:erholung`. Business sieht ihn nie (Zeit je
// Einheit zählt nur Business-Blöcke). Rein, Server und Browser.

import { schluesselFuer } from './modell';

export const ERHOLUNG_ZEIT_BEREICH = 'erholung';
export const ERHOLUNG_ZEIT_SCHLUESSEL = schluesselFuer('privat', ERHOLUNG_ZEIT_BEREICH);
