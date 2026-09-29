// ─── Kalender-Quelle „Feiertage NRW“ (29.09., Paket K2, rein, client-sicher) ─
// Kevin 29.09.: Feiertage NRW als eigener, einzeln schaltbarer Kalender — wie Googles „Feiertage in Deutschland“
// (grün), ganztägig, schreibgeschützt, in allen Ansichten (components/os/kalender/quellen.tsx).
//
// KEINE zweite Liste: gerechnet wird NUR in lib/aufgaben/feiertage.ts, die Tür für alle ist lib/zeit/kalender-kern.ts
// (`feiertageIm`, `feiertagsHinweis`, `istFeiertag`, `istWerktag`). Hier nur Name und Farbe des Kalenders.

export { feiertageIm, feiertagsHinweis, feiertag, istFeiertag, istWerktag, werktagAbOder, werktagePlus, type Feiertag } from '@/lib/zeit/kalender-kern';

/** Name des Kalenders in der Seitenleiste — auch der Schlüssel zum Ein-/Ausblenden. */
export const FEIERTAGE_KALENDER = 'Feiertage NRW';
/** Grün wie Googles „Feiertage in Deutschland“ (Salbei) — auf dem dunklen Grund lesbar. */
export const FEIERTAG_FARBE = '#33B679';
