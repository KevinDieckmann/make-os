// ─── Grafiken führen weiter — die Liste der Grafik-Bausteine (16.10., Abnahme 2 · B7, rein) ─────────────────────────────
// Kevin: „Einfach zu verstehen über die Visualisierungen … keine losen Enden — jede Grafik führt weiter.“ Jeder Baustein, der eine Grafik
// zeichnet (Linie, Band, Ring, Balken, Organigramm), steht hier mit seinem Klick-Weg. Das klickbare Element trägt `data-grafik-weiter`;
// Schmuck ohne Daten (`NetzMotiv`) trägt `data-deko` und ist keine Grafik. Wächter: tests/grafik-weiter.test.ts — eine neue Grafik kommt in
// diese Liste, sonst wird er rot (er sucht `<svg`/`<canvas` mit Daten in den Bausteinen unter components/os/ui und den Fach-Grafiken unten).

export interface GrafikBaustein {
  /** Wie man sie sieht. */
  name: string;
  /** Die Datei, die zeichnet. */
  datei: string;
  /** Wohin ein Klick führt — in einem Satz. */
  weg: string;
}

export const GRAFIK_BAUSTEINE: readonly GrafikBaustein[] = [
  { name: 'Für dich (Ist · heute · Prognose)', datei: 'components/os/ui/fluss.tsx', weg: 'Jede Woche bzw. jeder Monat öffnet die Ansicht genau dieser Zeit (lib/fluss/wege.ts) — Kalender, Aufgaben-Modus, Planen, Buchungen, Liquidität …' },
  { name: 'Lichtfäden-Band', datei: 'components/os/lichtfaeden/Faedenband.tsx', weg: 'Ein Bündel geht eine Ebene tiefer, ein Strang öffnet sein Ziel, eine freie Stelle die Woche dieses Tages im Kalender.' },
  { name: 'Ring (Index, Kurs aufs Jahresziel)', datei: 'components/os/schlank.tsx', weg: 'Mit `href` ein Link — Verlauf des Index bzw. die Ist-Monate im Monatsabschluss.' },
  { name: 'Index-Verlauf', datei: 'components/os/business/Verlauf.tsx', weg: 'Klick nahe einer Linie (oder auf die Legende) öffnet diese Säule.' },
  { name: 'Finanzplan-Linie und -Stapel', datei: 'components/os/finanzplan/diagramme.tsx', weg: 'Ein Monat öffnet das Blatt „Monat“ an genau diesem Monat.' },
  { name: 'FadenLinie (Liquidität · Verlauf)', datei: 'components/os/ui/fokus.tsx', weg: 'Mit `onSpalte` öffnet jede Woche ihre Posten (Rechnung, Zahlung, Planposten).' },
  { name: 'Liquidität · 12 Wochen (Controlling)', datei: 'components/os/ControllingView.tsx', weg: 'Jeder Balken öffnet die Liquidität an dieser Woche (`WEG.liquiditaet(woche)`).' },
  { name: 'Wer hält wen (Organigramm)', datei: 'components/os/unternehmen/schild/Struktur.tsx', weg: 'Eine eigene Gesellschaft öffnet ihren Steckbrief.' },
];

/** Welche Verwender einer Grafik den Klick-Weg auch WIRKLICH geben müssen (Ring nur mit `href`, FadenLinie nur mit `onSpalte`). */
export const GRAFIK_VERWENDER: readonly { datei: string; muss: string; warum: string }[] = [
  { datei: 'components/os/business/BusinessCockpit.tsx', muss: 'href={', warum: 'Ring des Business-Index → Verlauf' },
  { datei: 'components/os/kennzahlen/IndexAnsicht.tsx', muss: 'href={', warum: 'Ring der Indizes (Privat, Gesundheit) → Verlauf' },
  { datei: 'components/os/ControllingView.tsx', muss: 'hinweis="Ist-Monate im Monatsabschluss öffnen"', warum: 'Kurs aufs Jahresziel → Ist-Monate' },
  { datei: 'components/os/LiquiditaetView.tsx', muss: 'onSpalte={', warum: 'Liquidität · Verlauf → Woche mit Posten' },
];
