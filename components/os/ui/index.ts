// ─── MAKE OS — Der Standard: gemeinsame Bausteine (03.10.) ───────────────────
// EIN Ort für das, was Netzwerken edel macht (DESIGN_STANDARD.md). Seiten importieren von hier, nicht aus netzwerken/ oder schlank.tsx.
// Was kein Standard-Baustein ist (Ring, Balken, Haken, Punkt, Raster/Spalten), wird aus schlank.tsx unverändert weitergereicht — Importe laufen so über EINE Stelle.

export { Seite, Karte, Ueberschrift, Abschnitt, Titel, Beschriftung, Kennzahl, Zahl, Raster, Liste, Zeile, Eigenschaft, Initialen, Fortschritt, SEITE_BREIT } from './flaechen';
export { Knopf, Gross, Wahl, Pillen, MehrfachPillen, Chip, Segmente, Reiter, Schalter, Aktionsleiste, HakenZiel, SymbolKnopf, type KnopfProps, type KnopfTon, type ReiterEintrag } from './knoepfe';
export { Hinweis, Leerzustand, Leer, Erfolg, Schritte } from './rueckmeldung';
export { eingabe, feld, auswahl, Feldzeile } from './felder';
// Ziel-Bezug: `ZielChip`/`useZielBezug` = je Aufgabe (Kern), `ZielBezug` = je Bereich/Seite (Privat: Gesundheit, Familie, Kompass …).
export { ZielChip, useZielBezug } from './ziel';
export { ZielBezug } from './ziel-bezug';
export { useHandy, useBreit, useMedien, HANDY_BIS, SPALTEN_AB } from './medien';
// Fokus-Signatur (04.10., DESIGN_STANDARD.md › Fokus-Signatur): Mini-Strahl über einer echten Reihe, Segmentbalken, Kante, Netz.
export { FadenLinie, Segmentbalken, FokusKante, NetzMotiv, type FadenLinieProps } from './fokus';
export { Ring, Balken, Punkt, Haken, Spalten, Spalte, aufZwei, useHochzaehlen, LEUCHT, zoneFarbe, prioFarbe } from '../schlank';
