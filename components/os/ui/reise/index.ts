// ─── Standard · Reise + Fluss (17.10., Kevins Miro-Standard für das ganze System — DESIGN_STANDARD.md › Prozess-Visualisierung) ─────────────────────
// EIN Ort für die Zeichnung jedes Ablaufs: die Reise als Zeile (`ReiseBild`), der Fluss einer Stufe (`Fluss`, Knoten `KnotenKnopf`), die Legende
// (`FormenLegende`) und die kleinsten Zeichen (`FreigabeRaute`, `FormZeichen`, `JETZT`, `FORM_FARBE`). Genutzt von Fulfillment (Fall, Kunden-Seite, Editor),
// Markttraktion › Kreislauf, Einrichtung und Planung › Ziel. Die Typen und die Fenster-Regel stehen in lib/reise/bild.ts; jeder Bereich rechnet seine
// Zeile in seinem Modell. Neue Formen oder Zustände nur hier — nie in einem Bereich nachbauen (Wächter tests/reise-ueberall.test.ts).
export { ReiseBild, FormZeichen, type BildSpalte, type BildKaestchen } from './ReiseBild';
export { Fluss, KnotenKnopf, Pfeil, SeitenPfeil, Erinnerung, FormenLegende, formName, knotenLabel } from './Fluss';
export { JETZT, FORM_FARBE, FreigabeRaute } from './formen';
