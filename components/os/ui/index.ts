// ─── MAKE OS — Der Standard: gemeinsame Bausteine (03.10.) ───────────────────
// EIN Ort für das, was Netzwerken edel macht (DESIGN_STANDARD.md). Seiten importieren von hier, nicht aus netzwerken/ oder schlank.tsx.
// Was kein Standard-Baustein ist (Ring, Balken, Haken, Punkt, Raster/Spalten), wird aus schlank.tsx unverändert weitergereicht — Importe laufen so über EINE Stelle.

export { Seite, Karte, Ueberschrift, Abschnitt, Titel, Beschriftung, Kennzahl, Zahl, Raster, Liste, Zeile, Eigenschaft, Initialen, Fortschritt, SEITE_BREIT } from './flaechen';
export { Knopf, Gross, Wahl, Pillen, MehrfachPillen, Chip, Segmente, Reiter, Schalter, Aktionsleiste, type KnopfProps, type KnopfTon, type ReiterEintrag } from './knoepfe';
export { Hinweis, Leerzustand, Leer, Erfolg, Schritte } from './rueckmeldung';
export { eingabe, feld, auswahl, Feldzeile } from './felder';
export { ZielBezug } from './ziel-bezug';
export { Ring, Balken, Punkt, Haken, Spalten, Spalte, aufZwei, useBreit, useHochzaehlen, LEUCHT, SPALTEN_AB, zoneFarbe, prioFarbe } from '../schlank';
