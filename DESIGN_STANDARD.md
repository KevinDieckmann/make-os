# MAKE OS — Design-Standard (03.10.2026)

Kevin: „Du hast bei dem Netzwerken das Ganze noch ein bisschen edler gebaut von der Darstellung. Ich möchte, dass du den Standard überall
reinbringst.“ Dieses Dokument ist verbindlich für jede neue oder umgebaute Seite. Bausteine: `components/os/ui` (ein Import:
`import { Seite, Karte, Knopf, … } from '../ui'`). Token: `lib/make-one/design.ts` — **nie ein Farb-, Radius- oder Größen-Literal in einer Seite**;
fehlt ein Wert, kommt er als Token nach `design.ts`.

## Warum Netzwerken edler wirkt (Befund)
1. **Eine Rangordnung statt vieler Größen:** Titel 24–30 (Anzeigeschrift) → Kartentitel 19–20 → Fließtext 15 → Bedienung 13 → Beschriftung 11 (nur GROSSBUCHSTABEN).
   Markttraktion stand auf 11–12,5 px (rund 1.200 Stellen) mit grauer Schrift auf grauem Grund.
2. **Flächen mit Tiefe in drei Stufen** (Grund → flache Fläche → gehobene Karte); die **Bereichsfarbe tönt nur die eine Karte, die zählt** („Heute bei“:
   Verlauf, farbiger Rand, weicher Schein). Markttraktion hatte eine Sorte Karte für alles.
3. **Ziele für den Daumen:** Hauptaktion 48–52 px, Chips 44–48 px, Radius 14. Markttraktion: Knöpfe ~34 px, Pillen ~27 px.
4. **Eine Hauptaktion je Ansicht**, getönt mit farbiger Kontur (TIEF.knopf), unten mitlaufend am Handy; alles andere leise.
5. **Hinweise sind Karten nach Bedeutung** (gut · achtung · kritisch · info) mit Symbol und ganzen Sätzen — statt einer grauen Zeile.
6. **Leerzustand = Symbol + ein Satz + ein Weg** in gestrichelter Karte — statt grauem Text in der Karte.
7. **Eingaben:** 48 px, 16 px Schrift, Radius 12, kräftiger Rand (kein Zoom am iPhone). Markttraktion: ~40 px, 13–15 px.
8. **Ruhige Rückmeldung:** Haken zeichnet sich, Chip fährt ein, Ring/Balken füllen sich — je unter einer Sekunde, bei „Bewegung reduzieren“ sofort fertig.
9. **Kopf kompakt am Handy, Inhalt zuerst:** ein Satz statt eines Absatzes, Aktionen neben dem Titel, EINE wischbare Reiterleiste.
10. **Eine Spalte, klare Breite** bei Arbeitsabläufen (640–700 px) statt Kachelwand; Listen in Zeilen mit Tippziel und Pfeil.

## Token (design.ts)
| Token | Inhalt |
|---|---|
| `TYP` | held 56 · zahl 26 · titel 20 · body 15 · bedien 13 · mikro 11 (nur Beschriftung in Großbuchstaben) |
| `FARBE`, `LEUCHT`, `TIEF` | Flächen/Text; Zustandsfarben; tiefe Akzente (`flaeche`, `rand`, `knopf`, `verlauf`) |
| `ZIEL` | haupt 48 · handy 44 · rechner 40 |
| `ECKE` | eingabe 12 · knopf 14 · flach 16 · karte 20 (Pillen: `RADIUS.pille`) |
| `RAND` | haar · flaeche · stark · leer (gestrichelt) |
| `FLAECHE_STIL` | `eingabe`, `flach`, `leise`, `gehoben`, `getoent(farbe)` |
| `BEDEUTUNG_FARBE` | gut · achtung · kritisch · info · neutral |

## Bausteine (components/os/ui)
| Baustein | Zweck |
|---|---|
| `Seite` | Titel, ein Satz, Aktionen rechts; Anker der Handy-Regeln (`.ui-seite`). Kopf am Handy kompakt. |
| `Karte` | gehoben (Standard) · `flach` (Karte in der Karte) · `ton={farbe}` (die EINE wichtige Karte) · `akzent` (leiser Rand) |
| `Ueberschrift`/`Abschnitt` | Beschriftung einer Karte in Großbuchstaben, optional Bereichspunkt und Zusatz rechts |
| `Titel` | Titel in Anzeigeschrift (20 px) mit Satz darunter |
| `Kennzahl` | Kachel mit Zahl (zählt hoch), Beschriftung, optional anklickbar |
| `Liste`/`Zeile` | Zeile ≥ 56 px, Titel + Zusatz, Pfeil bei Klick; `umbrechen` in Dialogen |
| `Eigenschaft` | „Beschriftung · Wert“, am Handy übereinander |
| `Knopf` | `haupt` (48, die EINE Hauptaktion) · Standard (40/44) · `leise` · `voll`; `href` für Links; async `onClick` sperrt Doppelklick |
| `Gross` | Netzwerken-Name: ganzer Knopf, 48/52 px |
| `Wahl`/`Pillen`/`MehrfachPillen` | Auswahl-Chips (44 px am Handy), `einzeilig` wischt seitwärts |
| `Segmente`, `Reiter` | Umschalter / Reiterleiste (wischbar, aktiver Reiter bleibt im Bild) |
| `Chip` | Anzeige-Pille in Kennzahlfarbe (nicht anklickbar) |
| `Hinweis` | Karte nach Bedeutung (`art`), mit `titel` und `aktion` |
| `Leerzustand`, `Leer` | großer / kleiner leerer Zustand mit Symbol, Satz, Weg |
| `Erfolg`, `Schritte`, `Fortschritt` | Haken, Schrittanzeige, Balken |
| `eingabe`, `feld`, `auswahl`, `Feldzeile` | Formularfeld 48/16 · kompakt 44 · Auswahlliste 40/44 · Feld mit Beschriftung und Fehlertext |
| `Aktionsleiste` | die Hauptaktion unten mitlaufend am Handy, über der Tastatur beim Tippen |

## Regeln
1. **Eine Hauptaktion je Ansicht** (`Knopf haupt`). Alles andere `leise` oder normal.
2. **Tippziele:** Hauptaktion 48 px, alles andere am Handy ≥ 44 px (Rechner ≥ 40). Die Bausteine halten das selbst ein; `.ui-seite` fängt Altbausteine am Handy ab.
3. **Eingaben 16 px am Handy** (iOS zoomt sonst). Nie `fontSize: 12`/`13` an einem `input` ohne `.ui-seite` darüber.
4. **Flächen-Hierarchie:** Grund → `Karte flach` → `Karte` (gehoben). Höchstens EINE `ton`-Karte je Ansicht.
5. **Bereichsfarbe sparsam:** Akzent für Auswahl, Punkt und die eine Hero-Karte; Farbe bedeutet sonst Zustand (grün/gelb/rot).
6. **Hinweise als Karten nach Bedeutung**, Text in ganzen Sätzen, nie ein Kürzel; Fehler `kritisch` (mit `role=alert`), Erfolg `gut`.
7. **Leerzustand** nennt, was fehlt, und den Weg weiter (`Leerzustand` mit `aktion`; `Leer` für Zeilen).
8. **Bewegung dezent:** < 1 s, nur `transform`/`opacity`, bei `prefers-reduced-motion` steht das Ergebnis sofort (allgemeine Regel in `globals.css`).
9. **Zahlen** `fontVariantNumeric: 'tabular-nums'` (in `Kennzahl`/`Zahl` schon drin).
10. **Text:** nie heller als `inkLeise` (≥ 5:1); Erklärungen in `inkDim`; Beschriftungen in `inkLeise` nur in Großbuchstaben (11 px). Sätze ab 13 px.
11. **Am Handy zuerst der Inhalt:** Kopf ≤ 2 Zeilen Satz, Aktionen neben dem Titel, EINE Reiterleiste, Listen als Zeilen statt Tabellen.
12. **Neutral bauen:** keine Namen, Firmen, Gesundheit im Code; Werte aus Einstellungen (Plattform-Regel).
13. **Nichts global verbiegen:** Der Standard wirkt, wo ein Baustein benutzt wird. Altseiten (`schlank.tsx`) bleiben unverändert, bis sie umgestellt werden: Import von `../schlank` auf `../ui` tauschen (gleiche Namen), danach auf Hierarchie, Hinweise und Leerzustände prüfen.

## Umstellen einer Seite (Rezept)
1. `import … from '../schlank'` → `from '../ui'` (Namen sind gleich: `Karte`, `Knopf`, `Chip`, `Zeile`, `Leer`, `Ueberschrift`, `Zahl`, `feld` …).
2. Seitenkopf mit `Seite` (Titel + ein Satz + Aktionen), nicht mit eigenem `h1`.
3. Die eine wichtige Karte `ton`, Hinweise → `Hinweis art=…`, graue Leerzeilen → `Leer` bzw. `Leerzustand`, Auswahl → `Pillen`/`Segmente`/`Reiter`.
4. Schriftgrößen 11–12,5 px in Fließtext → `TYP.bedien` (13); Eingaben → `eingabe`/`feld`.
5. Foto Handy (375) + Rechner (1280) vorher/nachher, Messung: keine Tippziele < 44 px, keine Eingaben < 16 px am Handy, kein seitlicher Überlauf, Konsole sauber.

Stand 03.10.: Muster **Markttraktion** (alle Reiter) und **Netzwerken** umgestellt. Zweiter Bereich: **Zahlen & Finanzen** (siehe unten). Folgt: der Rest.

## Umgestellt: Zahlen & Finanzen (03.10.)
Alle 51 Dateien des Bereichs hängen an `components/os/ui` (keine Bausteine mehr aus `schlank.tsx`): **Zahlen** (Privat · Business · Steuern · Gesamt · Head of Finance, mit Haushalt-Reitern Übersicht bis Schulden), **Grundlage**, **Liquidität**, **Buchungen**, **Rechnungen & Zahlungen**, **Controlling & Ziele**, **Business-Altbestand** und die **Finanzplanung jetzt** (Lage · Planen · Privat · Business · Gesamt · Buchungen & Check · Ziele & Töpfe · Protokoll, alle 19 Unterseiten). Rechnung, Felder und Funktionen sind unverändert — jedes Feld bleibt anpassbar.

Was für Zahlen gilt (zusätzlich zu den 13 Regeln):
1. **Zahlen** stehen mit `tabular-nums` rechtsbündig (Tabellen, Kennzahlen, Beträge in `Geld`/`Betrag`); Tabellen laufen in eigenem wischbarem Container (`.ui-tabelle`, Rolle `region`) — am Handy wischt die Tabelle, nie die Seite. Das Blatt der Finanzplanung (Monate als Spalten) hat sticky Namensspalte und Kopf im selben Container.
2. **Negative Werte** tragen das Minuszeichen UND die Bedeutungsfarbe (rot unter null, gelb für Ausgaben) — nie nur Farbe.
3. **Kennzahl-Kacheln** = flache Fläche (`FLAECHE_STIL.flach`, Ecke 16), je Ansicht höchstens eine getönte Hero-Karte (`ton`): Lage-Entscheidungen, Index, Saldo, Kurs aufs Jahresziel, Verlauf der Liquidität, Ergebnis der Grundlage, Fristen.
4. **Diagramme** nutzen Theme-Farben (Kupfer = Geld, Lila = IST, Zustandsfarben); Achsenbeschriftung 12 px, auf schmalem Bildschirm jede zweite/dritte Marke (nie enger als 64 px).
5. **Eingaben** in Formularen: `feld` (44 px) bzw. `eingabeStil` der Finanzplanung (40 px am Rechner, am Handy erzwingt `.ui-seite` 44 px/16 px); Auswahllisten über `auswahl` (ui/felder.tsx). Ausnahme: der Zellen-Editor im Blatt bleibt 32 px hoch (Tabellenkalkulation) — am Handy ebenfalls 44 px.
6. **Kopf am Handy:** breite Umschalter (Wochen, Sicht, Bereiche) stehen im Inhalt als EINE wischbare Leiste (`Reiter`/`Segmente`), nicht im Kopf neben dem Titel; Aktionen im Kopf sind Symbole mit Text nur am Rechner (`ui-nur-breit`), eine lange Aktion steht am Handy darunter (`ui-nur-schmal`).
7. **Fehler** sind `Hinweis art="kritisch"` mit Weg zurück (z. B. „Noch einmal versuchen“), Erfolg `gut`, Erklärungen unter einer Karte bleiben Notiz in `inkDim` (13 px).

Gemeinsame Teile der Finanzplanung (`finanzplan/teile.tsx`: `Kachel`, `Etikett`, `StatusPille`, `Tabelle`, `KnopfKlein`, `Pillen`, `Hinweis`, `Nichts`) und der Haushaltsfinanzen (`haushalt/gemeinsam.tsx`) reichen jetzt die Standard-Bausteine durch — gleiche Namen, damit die Seiten unverändert bleiben. Wächter: `tests/design-finanzen.test.ts`.
