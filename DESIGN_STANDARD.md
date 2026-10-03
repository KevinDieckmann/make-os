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

Stand 03.10.: Muster **Markttraktion** (alle Reiter) und **Netzwerken** umgestellt. Zweiter Bereich: **Zahlen & Finanzen**, dritter: **Kern** (globale Shell, Aufgaben, Kalender, Inbox — siehe unten). Dazu **Planung** (Jahr/Monat/Quartal, Ziel- und Meilenstein-Seite, Meilenstein-Fenster) und **Fokus** — Leitidee „immer der Fokus auf die Ziele, visualisiert durch die Lichtfäden“. Folgt: der Rest. Dann **Privat · ZOE · System** (Gesundheit, Familie, Brain, Konto, ZOE — siehe „Umgestellt: Privat · ZOE · System“).

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

## Umgestellt: Privat · ZOE · System (03.10.)
Kevins Leitidee: **„immer der Fokus auf die Ziele“.** Wo ein Bereich Ziele hat, steht der Bezug ruhig unter dem Seitenkopf — Funktion und Daten unverändert, reine Darstellung und Struktur.

**Umgestellt (alle über `components/os/ui`, kein `schlank`-Import mehr):** Gesundheit (Heute · Index · Verlauf · Ernährung · Körper), Journal, Energie, Routinen-Planer, Sport (Plan · Hyrox · Running · Gym · Erholung), Säulen-Seite, Familie & Partnerschaft (Wir zwei · Familie · Rahmen · Paar-Gespräch), Kontakte privat, Kompass, Brain (Fragen · Stöbern · Regeln · Inbox), Privat-Übersicht, Home, Wachstum, die Flächen (`flaeche/`), ZOE (Empfang, Aufträge & Freigaben schlank und voll, Agenten, Loops, Head of IT) und System (Konto, System-Übersicht, Verbindungen, Datenbasis, Stammdaten). Nicht berührt: Heute, Planung (Ziele/Meilensteine/Fokus), Aufgaben, Kalender, Inbox, Kopfzeile/Leiste/Shell, ZoePanel.

**Neu im Standard:**
| Baustein | Zweck |
|---|---|
| `ZielBezug bereich=…` | Ruhiger Chip „ZAHLT EIN AUF · <Jahresziel> · 40 %“ unter dem Kopf (44 px, Link ins Ziel der Planung). Auswahl rein in `lib/make-one/ziel-bezug.ts`: 1. Meilensteine des Bereichs mit `zielId` · 2. Stichwort im Zieltitel · 3. oberstes offenes privates Jahresziel (dann ehrlich „OBERSTES ZIEL“). Farbe nach der EINEN Farbregel für Ziele (`zielFarben`, lib/lichtfaeden/modell.ts) — dieselbe wie im Zeitstrahl und an den Ziel-Chips der Aufgaben (`ZielChip`, je Aufgabe; `ZielBezug` ist der Bezug je Bereich). Ohne Ziel steht ein leiser Weg in die Planung; keine Schreibwege. Bereiche: `gesundheit` · `training` · `beziehung` · `wissen` · `privat`. Einsatz: Gesundheit, Journal, Sport, Säule Gesundheit/Familie, Familie & Partnerschaft, Kompass, Wachstum, Privat-Übersicht. |
| `Schalter` | Ein/Aus (Rolle `switch`): sichtbar 40 × 24, Tippfläche 56 × 44 — Routinen, Streak, Routinen-Planer. |

**Regeln für diesen Bereich (zusätzlich zu den 13):**
1. **Ziel-Bezug** nur dort, wo ein Bereich auf ein Jahresziel einzahlt — höchstens ein Chip je Ansicht, nie als Schmuck in Karten.
2. **Umschalter im Inhalt, nicht im Kopf:** Gesundheit (5 Segmente), Familie (3), Sport (5), Paar-Gespräch (Schritte als `Reiter`) stehen als EINE wischbare Leiste unter dem Kopf; im Kopf bleibt höchstens eine Aktion (`ui-nur-breit`/`ui-nur-schmal`, wenn sie lang ist).
3. **Formulare mit sichtbarer Beschriftung** (`Feldzeile`), Platzhalter nur als Beispiel — nie als einzige Beschriftung. Konto: Felder untereinander (`.konto-feldreihe`), Enter schickt ab (Formular), nichts wird abgeschnitten (Praxis-Fund: „altes Passw…“, „neues, min…“).
4. **Speichern mit Enter:** Ein einzelnes Eingabefeld mit Speichern-Knopf ist ein `<form onSubmit>` mit `Knopf typ="submit"` (Praxis-Fund N7: Privat › Rücklage).
5. **Hero-Karte je Ansicht getönt (`ton`):** Gesundheit der Morgen-Check (Zonenfarbe), Familie das Pflege-Rhythmus-Paar-Gespräch, Konto der Zweite Faktor, Brain der Chat, ZOE die Freigaben, HOI die Gesamtampel, Wachstum der Score.
6. **Fehler und Meldungen als `Hinweis`** (kritisch mit `role=alert`, Rückmeldung `gut`/`info` mit `role=status`), mit „Noch einmal versuchen“ wo es einen Weg gibt.

## Lichtfäden (03.10., v2 „alle Stränge“)
Kevin: „Hier bei der Planung wäre geil, wenn das so reinkommt mit mehreren Elektro-Fäden … das kann sich auch mit durch die Homepage ziehen.“ —
„Das ist ein Werkzeug, was nachher Fokus anzeigt, weil extrem viele Stränge zusammenlaufen … Es gibt es auf jeder Ebene und nachher übergreifend.“
Feine, halbtransparente Fäden auf Canvas 2D, zu Bündeln verflochten; dicht = breit und hell, ruhig = eng. **Ein Zeichner für App und Website.**
Technik, Modell, Gewichte und „neue Quelle anschließen“: `LICHTFAEDEN.md`.

**Wann einsetzen:** nur als *Hauptbild einer Zeitachse* (die Lichtfäden-Karte) oder als *roter Faden* (Website) — höchstens einmal je Ansicht,
nie als Schmuck in Karten, Listen oder Kennzahlen. Jede Aussage steht zusätzlich als Text (Leinwand `aria-hidden`, Textäquivalent je Ebene),
Bedienung in echten Knöpfen (Markierungen, Legende, Brotkrumen, Engstellen).

**Die Karte (`<Lichtfaeden wurzel=… />`, components/os/lichtfaeden):** Kopf = Brotkrumen „Gesamt › Privat › Gesundheit › …“ + Person (Ich · Partner/in ·
Beide), Zeitraum wie die Planung (Dieses Jahr · Bis Ende nächsten Jahres · 18 Monate, Blättern, Heute, optional eine Aktion), das Band, darunter die
Legende (je Bündel ein Knopf „eine Ebene tiefer“), Engstellen als aufklappbare Zeilen. Eingebaut: Planung › Jahr (Wurzel Space bzw. Gesamt), Ziel-Seite
(Wurzel Ziel), Meilenstein-Seite (Wurzel Meilenstein), Fokus (Wurzel Gesamt, zuerst „Ich“).

| Teil | Datei | Inhalt |
|---|---|---|
| Mathematik (rein) | `lib/lichtfaeden/band.ts` | `LICHTFAEDEN` (Parameter), Saaten, `versatz`, `buendelMitte`, `spreizung`, `gauss`, `saettigen`, `kurve` |
| Striche | `lib/lichtfaeden/zeichnen.ts` | `zeichneBuendel` (Path2D-Eimer, additiv), `leinwand` (dpr ≤ 2), `starteLauf` (pausiert außerhalb, reduzierte Bewegung = Standbild) |
| Band (App) | `lib/lichtfaeden/faedenband.ts`, `components/os/lichtfaeden/Faedenband.tsx` | Bündel einer Ansicht, Auf-/Zufächern, HEUTE, Engstellen-Säulen, Verbinder, `treffer`; Maße `BAND_MASSE` |
| Daten | `lib/lichtfaeden/{modell,baum,fokus}.ts`, `quellen/*`, `GET /api/lichtfaeden` | Stränge → Baum → Ansicht (LOD) + Engstellen |
| Farben | `FADEN_FARBEN`, `LICHT_GLAS` (design.ts), `THEMEN` (modell.ts) | Ziel je Space fortlaufend (Business gelb → orange → lila → pink, Privat grün → türkis → violett), Themen in Bereichsfarben, „ohne Ziel“ Zeit-Cyan, „Belegt“ Grau |
| Website | `website/js/lichtfaeden.js` (erzeugt), `website/js/faden.js` | Granat/Smaragd, Charakter je Kapitel |

**Parameter:** Fäden je Bündel ∝ √Last (3 … 26; Blatt-Ebene 1 … 4), höchstens 160 je Leinwand (Handy 80) · Stützpunkt alle 6 px (Handy 8) · Strich 0,8 px ·
Deckkraft 0,24 (additiv) · Tempo 0,00028/ms · Ruhe-Spreizung 12 % · Auffächern 720 ms · höchstens 7 Bündel je Ebene (+ „Weitere“). Band 150 px (Handy 120),
Markierungen 28 px (Handy 44 px) in höchstens 4 (Handy 2) Reihen. Dichte: Gauß σ = 2 Wochen, gesättigt je Ansicht.

**Regeln:** 1. Bewegung nur als ruhiges Fließen und beim Ebenenwechsel; bei `prefers-reduced-motion` ein Standbild ohne Übergang. 2. Lauf pausiert
außerhalb des Bildes und im verborgenen Tab. 3. Zeichnen < 4 ms je Bild am Rechner. 4. Vergangenes gedämpft, HEUTE leuchtet, Engstellen als ruhige
Säule + KW-Knopf (Bedeutung „achtung“, nie Alarmrot). 5. Farben nur aus `FADEN_FARBEN`/`THEMEN` (App) bzw. den Logo-Farben (Website). 6. Private Stränge der
anderen Person nur als „Belegt“ (grau, ohne Titel/Link). 7. Wer `band.ts`/`zeichnen.ts` ändert, ruft `node scripts/lichtfaeden-website.mjs`
(Wächter `tests/lichtfaeden.test.ts`). 8. Nie im Zeichner Daten rechnen.

**Regeln:** 1. Bewegung nur als ruhiges Fließen; bei `prefers-reduced-motion` ein Standbild (t = 0). 2. Lauf pausiert außerhalb des Bildes und im verborgenen Tab.
3. Höchstens ~160 Fäden je Leinwand am Rechner, ~80 am Handy; Zeichnen < 4 ms je Bild. 4. Vergangenes gedämpft, HEUTE leuchtet. 5. Farben nur aus `FADEN_FARBEN`
(App) bzw. den Logo-Farben (Website). 6. Wer `band.ts`/`zeichnen.ts` ändert, ruft `node scripts/lichtfaeden-website.mjs` (Wächter `tests/lichtfaeden.test.ts`).

## Umgestellt: Kern — Shell · Aufgaben · Kalender · Inbox (03.10.)
Reine Darstellung und Struktur; Funktion, Daten und Abgleich (iCloud/Google/Gmail) unverändert. Wächter: `tests/design-kern.test.ts`.

**Globale Shell (wirkt auf jeder Seite):**
1. **Kopf:** runde Knöpfe sind `.kopf-rund` (40 px Rechner, 44 px Handy; vorher 34). Am Handy passen sieben 44-px-Ziele (Wachstum, Suche, Heute, Inbox, Kalender, Meldungen, Fokus) in eine Zeile; der **Index-Schalter** („Business-Index … ↗“) steht dort in einer eigenen Zeile darunter (früher war er aus der wischbaren Kopfzeile geschoben und unsichtbar). Die Lupe gibt es nur am Handy, das Suchfeld nur am Rechner.
2. **Leiste links** (232 px): Kasten 15 px/700 (`TYP.body`), Punkte und Zeilen 13 px (`TYP.bedien`), alles ≥ 40 px; Einklapp-Knopf 40 px. **Unten (Handy):** Kasten ≥ 48 px, aktiver Eintrag fett; ein Space leuchtet nur auf Seiten, die zu ihm gehören (N3: nicht mehr auf Konto, Heute, Kalender), solange sein Blatt offen ist ebenfalls. Blatt-Zeilen 44 px, Schrift 15 px.
3. **ZOE-Fenster** am Handy: 8 px Rand links und rechts (`.zoe-fenster` in globals.css; vorher 6 px links abgeschnitten); Breite/Höhe ziehen den eingestellten Abstand ab.

**Neue Bausteine (`components/os/ui`):** `HakenZiel` (sichtbar 24 px, tippbar 44 px als echter Knopf, kein Pseudoelement), `SymbolKnopf` (✕, Stift, ⋯: 40/44 px, `gefahr` rot, `eingebettet` in Pillen; Zweitaktionen stehen mit Abstand in `.ui-symbole`), `ZielChip` + `useZielBezug` (siehe Ziel-Bezug), Klassen `.ui-haken-ziel`, `.ui-symbol`, `.ui-mini-monat`, `.ui-monat-*`.

**Ziel-Bezug (Kevins Leitidee „immer der Fokus auf die Ziele“):** Wo eine Aufgabe in der Liste eines Meilensteins liegt, zeigt Zeile (Aufgaben-Baum) und Detail einen ruhigen Chip „Ziel · Titel“ in der **Ziel-Farbe der Lichtfäden** (je Space nach Rang durch `FADEN_FARBEN`, `lib/aufgaben/ziel-bezug.ts`). Nichts wird gespeichert, kein Feld kommt dazu — gelesen wird die vorhandene Kette Aufgabe → Meilenstein (`meilensteinVonAufgabe`) → Ziel (`zielVonMeilenstein`); Abfragen nur, wenn überhaupt eine Aufgabe in einer Meilenstein-Liste liegt.

**Aufgaben:** alle Dateien über `../ui`; Abhaken-Kreise `HakenZiel`; ✕/Schließen/Entfernen `SymbolKnopf`; Wahl-Chips (`crm/Wahl`) 32/36 px statt 26/30; Kopf am Handy: Umschalter Kalender|Aufgaben neben dem Titel, Darstellung (Liste · Board · Tabelle · Kalender · ZOE) und „Zeitstrahl ›“ als eigene Zeile im Inhalt (`ui-nur-breit`/`ui-nur-schmal`); Schnellzeile: kurzer Platzhalter + Kürzel-Hinweis darunter, der Ort (Space › Projekt › Liste) am Handy als EINE Zeile mit „ändern“; Platzhalter der Zeilen kurz („+ Aufgabe (Enter)“); Eigenschaften im Detail stehen am Handy übereinander (`ui-eigenschaft`, kein Überlauf der Datumsfelder).
**Kalender:** Mini-Monat: Vor-/Folgemonat 44 px (vorher 4 × 24), Tage 40/44 px mit Beschriftung („3. Oktober, heute, mit Terminen“); Monatsblatt am Handy: ganze Tage antippen, Termine als Punkte (die Pillen gehören dem Rechner); die sechs Ansichten (Tag … Termine) als wischbare `Reiter`; Einstellungen: freie Tage entfernen 44 px; Kalenderliste mit 44-px-Zeilen. **Rasterzellen** (Zeitraster, Monat, Jahr, 4 Tage, Balken der Aufgaben-Kalenderansicht): der Block/die Zelle ist das Ziel (`.ui-kein-ziel` an Unterknöpfen), Schrift mindestens 12 px — die einzige Ausnahme von der 13-px-Regel.
**Inbox:** Liste, Gmail-Thread, Antwort-Editor (`feld`, 180 px), Meldungen als `Hinweis`; Thread bricht lange Adressen um (kein seitlicher Überlauf), das Mehr-Menü ist eine Fläche mit ganzen Knöpfen, Einzug unter der Zeile am Handy 4 px statt 22.

**Messung (Sandbox, erfundene Daten, 375 px, 42 Ansichten, vorher → nachher):** Tippziele < 44 px — Aufgaben (11 Ansichten) **777 → 0**, Kalender (10) **1.290 → 3**, Inbox (5) **147 → 0**, Shell-Seiten (6) 158 → 75 (Rest: Inhalt von Home/Konto/Heute und das ZOE-Fenster, die anderen Paketen gehören), Regression (10 fremde Seiten) 196 → 106 (nur Shell-Teile besser, nichts schlechter); Eingaben < 16 px Aufgaben 104 → 0, Kalender 23 → 0; seitlicher Überlauf 0 → 0; Konsolenfehler 0 → 0. Vergleich mit Fotos: `scratchpad/design-kern/vergleich.html`.
