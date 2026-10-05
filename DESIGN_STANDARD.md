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
| `ZeileAktionen` | Archivieren & Löschen an jeder Listenzeile: Handy nach links wischen, Rechner Knöpfe am Rand (siehe „Löschen & Archivieren“) |
| `Rueckfrage`/`useRueckfrage`, `RueckgaengigLeiste`/`useRueckgaengig` | Rückfrage statt `window.confirm` (Abbrechen hat den Fokus) · Hinweis unten mit „Rückgängig“ (10 s) |

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
13. **Nichts global verbiegen:** Der Standard wirkt, wo ein Baustein benutzt wird. Seit 04.10. (Aufräumen) holt keine Seite mehr etwas aus `schlank.tsx` — nur `components/os/ui` reicht dessen Nicht-Standard-Teile (Ring, Balken, Punkt, Haken, Spalten, `useHochzaehlen`, `LEUCHT`) durch. Neue Seiten importieren ausschließlich `from '../ui'` (Wächter `tests/design-standard.test.ts` › Aufräumen).

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
| `ZielBezug bereich=…` | Ruhiger Chip „ZAHLT EIN AUF · <Jahresziel> · 40 %“ unter dem Kopf (44 px, Link ins Ziel der Planung). Auswahl rein in `lib/make-one/ziel-bezug.ts`: 1. das Thema der Meilensteine des Ziels — dieselbe Zuordnung wie die Lichtfäden (`zielThema`; Meilensteine über `zielVonMeilenstein`, abgeleitete Ziele aufs Jahresziel) · 2. sonst das oberste offene private Jahresziel (dann ehrlich „OBERSTES ZIEL“). Keine Stichworte im Titel, keine Namen im Code. Space ohne Angabe = Business (`spaceVonZiel`). Farbe kommt vom Server (`farbe` je Ziel, `lib/planung/ziel-farben-server.ts`) — dieselbe wie in den Lichtfäden und an den Ziel-Chips der Aufgaben (`ZielChip`, je Aufgabe; `ZielBezug` ist der Bezug je Bereich). Daten im Browser nur über `useZieleUndMeilensteine` (`lib/planung/ziele-client.ts`, ein Zwischenspeicher); der Chip ist der Baustein `Chip`. Ohne Ziel steht ein leiser Weg in die Planung; keine Schreibwege. Bereiche: `gesundheit` · `training` · `beziehung` · `wissen` · `privat`. Einsatz: Gesundheit, Journal, Sport, Säule Gesundheit/Familie, Familie & Partnerschaft, Kompass, Wachstum, Privat-Übersicht. |
| `Schalter` | DER Ein/Aus-Schalter (Rolle `switch`), der einzige: sichtbar 40 × 24, Tippfläche ≥ 44. `onChange(v)` bekommt den neuen Zustand. Ohne Beschriftung ist `ariaLabel` Pflicht (Typ erzwingt es); mit `children` steht die Beschriftung rechts; `karte` = ganze Entscheidungszeile mit `beschreibung`/`symbol` (Netzwerken). Kein `role="switch"` außerhalb von `components/os/ui` (Wächter `tests/schalter-eine-quelle.test.ts`); die Finanzplanung reicht ihn nur durch. |
| `useHandy` · `useBreit` · `useMedien` | EIN Hook für die Bildschirmbreite (`components/os/ui/medien.ts`, Grenzen `HANDY_BIS` 720 / `SPALTEN_AB` 1180 wie globals.css) — kein eigenes `matchMedia` für die Breite. |

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
| Farben | `FADEN_FARBEN`, `LICHT_GLAS` (design.ts), `THEMEN` (modell.ts) | Ziel je Space fortlaufend (Business orange → lila → pink, Privat grün → türkis → violett — nie Gelb/Rot, die gehören Engstellen und Zuständen; feste Töne `FADEN_TOENE`), Themen in Bereichsfarben, „ohne Ziel“ Zeit-Cyan, „Belegt“ Grau |
| Website | `website/js/lichtfaeden.js` (erzeugt), `website/js/faden.js` | Granat/Smaragd, Charakter je Kapitel |

**Strahl ruhig (04.10. abends, ersetzt die Parameter unten im Planungsband):** je Bündel EIN Strang auf eigener Spur, ab HEUTE zum Ziel zusammenlaufend, ausschlagen NUR bei echter Abweichung (Meilenstein überfällig, Ziel-Frist überschritten, Frist gerissen, Deal ≥ 2× verschoben; Kapazität dockt an) — Parameter `STRAHL` (`lib/lichtfaeden/strahl.ts`), Gründe `lib/lichtfaeden/abweichung.ts`, Details `LICHTFAEDEN.md` › Strahl ruhig. Keine Partikel, kein Glühen, kein Netz, kein Licht am HEUTE-Punkt; Themen in der Farbe ihres ersten Ziels.

**Parameter (Strahl v3, 04.10.):** Fäden je Bündel ∝ √Last (5 … 44; Blatt-Ebene 2 … 6), höchstens 300 je Leinwand (Handy 120) · Stützpunkt alle 6 px (Handy 8) ·
Strich 0,6 px · Deckkraft 0,2 (additiv) · Tempo 0,00028/ms · Ruhe-Spreizung 12 % · Auffächern 720 ms · Aufbau 1,9 s · Partikel alle 10 px (jeder 2. Faden; Handy
14 px, jeder 3.) · Glühen über einen Schein-Puffer (¼ Größe, Weichzeichner 3 px, Stärke 0,7; Handy 0,6) · je Faden leiser ab 150 Fäden je Leinwand (√150/n) · höchstens 7 Bündel je Ebene (+ „Weitere“). Band 300 px
(Handy 220), Markierungen 28 px (Handy 44 px) in höchstens 4 (Handy 2) Reihen. Dichte: Gauß σ = 2 Wochen, gesättigt je Ansicht; Spitzen: ungeglättete Last,
gesättigt, hoch 1,6, erst über der Schwelle 0,4 (`spitze` je Woche — nur deutlich volle Wochen schlagen aus).

**Strahl v3 (04.10., Kevin: „Der Strahl läuft im Grunde genommen immer von links nach rechts — guck dir den Verlauf an. Ich will diese Klarheit überall drin
haben.“)** — Vorbild: Data-Viz-Strahl mit hunderten feiner Fäden.
1. **Fließrichtung links → rechts:** jede Welle (Fäden und Leitkurven) wandert in Zeitrichtung; Partikel laufen entlang der Fäden nach rechts.
2. **Aufbau:** beim Öffnen wachsen die Fäden in 1,9 s von links ein, jeder etwas versetzt, ihre Spitzen leuchten; ein leises Licht läuft der Front voraus;
   Verbinder, HEUTE und Engstellen erscheinen, wenn die Front sie erreicht.
3. **Zukunft unsicher:** rechts von HEUTE fransen die Fäden aus (außen stärker, eigene Welle) und werden blasser; die ferne Zukunft wird leiser, die Vergangenheit
   bleibt gedämpft, HEUTE leuchtet.
4. **Spitzen aus der echten Last:** volle Wochen schlagen als scharfe Ausschläge aus (linear zwischen den Wochenmitten — kein Gauß), meist nach oben; die Fäden
   fächern um die Spitze auf.
5. **Bühne wie im Vorbild:** Punkt-Textur entlang der Fäden, Glühen an dichten Stellen, dünne helle Mittellinie, gestrichelte Hilfslinien, Markierungen mit
   abgerundetem Quadrat (Frist/Ziel) bzw. Raute (Meilenstein) + Label, leises Netz-Motiv oben rechts (nur Rechner), das langsam treibt. Perspektive bewusst aus
   (Lesbarkeit, Trefferflächen der Bündel). 60 fps am Rechner, Handy leichter; „Bewegung reduzieren“ = Standbild; pausiert außer Sicht.
6. **v3.1 (04.10., Kevin: „Band deutlich größer, kräftige Wellen“):** Band 300 px (Handy 220) ≈ die Hälfte des Zeichenbereichs; Spreizung mit Kontrast
   (Dichte hoch 1,35, höchstens 72 % der halben Höhe), Spitzen 0,86 der halben Höhe (Handy 0,7) ab Schwelle 0,3, breiterer Schein entlang der
   Leitkurve, Glühen 0,7. Die Leitkurve ist weich begrenzt (`randBei`, tanh), das ganze Bündel bleibt im Band; die Markierungen haben ihre
   eigene Zone darüber (+ 18 px Luft, Handy 14), Stapeln und „+n“ wie bisher (Rechner 4, Handy 2 Reihen). Farben bunt nach Zielen.

**Regeln:** 1. Bewegung nur als ruhiges Fließen und beim Ebenenwechsel; bei `prefers-reduced-motion` ein Standbild ohne Übergang. 2. Lauf pausiert
außerhalb des Bildes und im verborgenen Tab. 3. Zeichnen < 4 ms je Bild am Rechner. 4. Vergangenes gedämpft, HEUTE leuchtet, Engstellen als ruhige
Säule + KW-Knopf (Bedeutung „achtung“, nie Alarmrot). 5. Farben nur aus `FADEN_FARBEN`/`THEMEN` (App) bzw. den Logo-Farben (Website). 6. Private Stränge der
anderen Person nur als „Belegt“ (grau, ohne Titel/Link). 7. Wer `band.ts`/`zeichnen.ts` ändert, ruft `node scripts/lichtfaeden-website.mjs`
— es schreibt `website/js/lichtfaeden.js` UND `fokus/js/lichtfaeden.js` (Liste `ZIELE`; Wächter `tests/lichtfaeden.test.ts`). 8. Nie im Zeichner Daten rechnen.
9. Ziel-Farben rechnet nur der Server (`lib/planung/ziel-farben-server.ts`, Feld `farbe` an jedem Ziel) — Oberflächen nehmen sie, wie sie kommen.

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

## Fokus-Signatur (04.10.)
Kevin: „Diese Akzente will ich überall drauf haben, wo Fokus ist. Mache das Ganze offline, damit wir da nochmal den Standard heben. Dezent, aber immer
wichtig. Und der Strahl läuft im Grunde genommen immer von links nach rechts.“ Die Fokus-Signatur ist das Licht der Lichtfäden im Kleinen — eine Sprache für
alles, worauf es gerade ankommt. Bausteine in `components/os/ui/fokus.tsx` (Import wie immer `from '../ui'`), Token `FOKUS_LICHT`/`FOKUS_STIL` in
`lib/make-one/design.ts`, Zeichner `lib/lichtfaeden/fadenlinie.ts`, reine Reihen `lib/lichtfaeden/reihen.ts`, Wächter `tests/fokus-signatur.test.ts`.

| Baustein | Zweck |
|---|---|
| `Karte ton="fokus"` | Die Fokus-Karte: gläserner, minimal hellerer Grund, feine Kante, über die ein Lichtfaden (1 px) alle ~11 s langsam von links nach rechts läuft, weicher Schein. `licht` = Bereichsfarbe (Standard: Fokus-Cyan `FOKUS_LICHT`), `netz` = kleines Netz-Motiv in der Ecke (nur Rechner). |
| `FadenLinie` | Mini-Strahl (32–56 px) über EINER echten Zeitreihe: Leitkurve = die Werte (linear, Spitzen bleiben spitz), darum ein Bündel feiner Fäden aus demselben Zeichner wie das Band — Aufbau von links, Fließen nach rechts, Ausfransen rechts von `heute`, Partikel. `reihe` + `label` sind Pflicht; der ganze Wert steht im `aria-label` („Fällige Follow-ups, nächste 14 Tage: heute 3, morgen 0, … — zusammen 7, höchstens 3.“). Negative Werte: gestrichelte Nulllinie. `spalten` = Hinweis je Feld beim Zeigen. Höher (110 px) als Band für Verläufe (Liquidität). |
| `Segmentbalken` | Anteil/Fortschritt als schräge Segmente („//////“ wie im Vorbild), Rolle `progressbar`, füllt sich gestaffelt; `zahl` zeigt die Prozent. |
| `FokusKante`, `NetzMotiv` | Einzelteile der Fokus-Karte — z. B. die Kante an der aufgeklappten Engstelle (gelb). |

**Regeln:**
1. **Nur wo Fokus ist** — die Karte oder Zahl, auf die es in dieser Ansicht ankommt (Für dich, Qualifizierungsrunde, Power Hour, Prognose, das Ziel, Unser
   Fokus). Nie als Schmuck in Listen oder auf jeder Karte.
2. **Höchstens EINE Fokus-Karte und ZWEI FadenLinien je Ansicht** (Wächter je Datei). Die Fokus-Karte ersetzt dort die getönte Hero-Karte (`ton={farbe}`).
3. **Nie ohne Daten:** eine FadenLinie zeigt immer eine echte Reihe aus einem vorhandenen Bestand (keine fest eingetippte Zahlenliste, Wächter); ohne gültige
   Reihe (≥ 2 Werte) zeigt sie nichts; ist die Reihe ganz leer (nur Nullen), blenden die Einbaustellen sie aus.
4. **Bewegung sehr langsam** (Kante ~11 s, Netz 26 s, Fäden 0,00028/ms, FadenLinie ~30 Bilder je Sekunde), nur `transform`/`opacity` in CSS;
   „Bewegung reduzieren“ = still (Kante als leise Linie, Fäden als Standbild, Segmente sofort da). Pausiert außer Sicht.
5. **Farbe:** Fokus-Cyan oder die Bereichsfarbe der Karte; Zustandsfarben (grün/gelb/rot) nur, wenn die Reihe einen Zustand trägt (Liquidität, Index).
   Kein Farb-Literal in Seiten — `FOKUS_LICHT`, `LEUCHT.*`.
6. **Daten unverändert:** Reihen kommen aus dem, was die Seite schon lädt (Kartei, Prognose, Zeit, Index-Verlauf, Liquiditäts-Vorschau) — keine neue Route,
   kein neuer Bestand; private Daten der anderen Person nie in einer Reihe (die Quellen sind schon je Person gefiltert).

**Eingebaut (04.10.):** Markttraktion › Überblick „Für dich“ (Fokus-Karte, FadenLinie fällige Follow-ups 14 Tage) und Traktions-Index (Verlauf 30 Tage) ·
Qualifizierungsrunde (Fokus-Karte orange, qualifizierte Leads je Woche) · Power Hour (Fokus-Karte, fällig 14 Tage; laufend: Segmentbalken Gespräche) ·
Deals › Prognose (Fokus-Karte, erwartete Abschlüsse gewichtet je Monat) · Planung › Ziel-Seite (Fokus-Karte in der Ziel-Farbe, Segmentbalken Fortschritt),
Ziel-Zeilen (Segmentbalken), aufgeklappte Engstelle (Kante) · Zahlen › Liquidität (Verlauf als Lichtfäden-Band), Business- und Privat-Index (Verlauf) ·
Fokus (Schaufenster: „Unser Fokus“ mit Netz, Regler als Segmentbalken, Fokus-Minuten je Tag, darunter der Strahl v3).


## Überblick „Für dich“ je Bereich (04.10. abends)
Kevin: „Lass uns so immer den Überblick gestalten und dann den Flow so anzeigen, wie es die letzten 3 Monate war, wie es jetzt ist und wie der
Forecast ist … für jeden einzelnen Bereich.“ Baustein `FlussKarte` (`components/os/ui/fluss.tsx`, Import `from '../ui'`), Modell `lib/fluss/modell.ts`,
Reihen je Bereich `lib/fluss/bereiche.ts` (rein), Laden + Sicht `lib/fluss/server.ts`, Route `GET /api/fluss?bereich=…&space=…`, Wächter `tests/fluss.test.ts`.

| Teil | Inhalt |
|---|---|
| Karte | `Karte ton="fokus"` (sie IST die eine Fokus-Karte der Ansicht), Überschrift „Für dich“, rechts optional die Person |
| Linie | Ist der letzten 3 Monate durchgezogen mit leiser Fläche → HEUTE (ruhige senkrechte Linie, Mitte) → Prognose gestrichelt und leiser; Legende „Ist · erledigt“ / „Prognose · fällig“, Achse „−3 M · heute · +3 M“, darunter „Prognose aus …“ (die Grundlage) |
| Ohne Grundlage | rechts ein gestrichelter Leerzustand „Keine Prognose — es liegt nichts Terminiertes vor.“ — nie geschätzt |
| Zeilen | höchstens 4, priorisiert (Punkt in Bedeutungsfarbe · Titel · Unterzeile mit Bereich und Handlung · Zahl-Pille), Link zum Ort; Markttraktion gibt ihre „Für dich“-Zeilen als Kinder |
| Text | `role="img"` + `aria-label` mit Ist und Prognose (`flussText`) |

| Bereich | Raster | Ist | Prognose (nur aus echten Daten) | Sicht (Server) |
|---|---|---|---|---|
| Markttraktion | Monat | gewonnener Umsatz | offene Deals × Wahrscheinlichkeit nach erwartetem Abschluss | Haushalt, Business |
| Finanzen Privat | Monat | Ausgaben (Einheit privat) | Raten, offene Rechnungen, erkannte feste Kosten | nur Einheit `privat` |
| Finanzen Business | Woche | Saldo der Firmen-Buchungen | Liquiditäts-Vorschau (ein − aus) | nur Gesellschaften (`istGesellschaft`, `ohnePrivat`) |
| Planung | Woche | erreichte Meilensteine/Ziele | fällige Meilensteine/Ziel-Fristen | ohne eigene Ziele der anderen Person; `space` filtert |
| Aufgaben | Woche | erledigt | fällig (offen) | `ladeAufgabenSicht(person)` — fremde „nur ich“ samt Kette nie |
| Kalender | Woche | Termin-Stunden | eingetragene Termine | `termineFuerZoe`, nur eigene/gemeinsame, nie „Belegt“ |
| Gesundheit | Woche | Trainingseinheiten | Wochenplan + Sport-Ziele/Routinen mit Datum | nur die eigene Person |
| Familie | Woche | Dates, Gespräche, Wertschätzungen | Geplantes (Dates, Gespräche, Vereinbarungen, Tage) | `sichtFuer` — „nur ich“ der anderen nie |
| Netzwerken | Woche | erfasste Kontakte | fälliges Nachfassen | Haushalt; eingeschränkte Kontakte ohne Namen |
| Inbox | Woche | eingegangene Mails | Wiedervorlagen | nur das eigene Postfach |

Wissen/Brain: keine sinnvolle Zeitreihe — bewusst ohne. **Regeln:** 1. Jede Bereichsseite nutzt den Baustein (Wächter), daneben keine zweite
Fokus-Karte. 2. Reihen kommen nur vom Server, gefiltert nach Person/Haushalt/Sicht — keine Seite rechnet oder tippt Reihen. 3. 80/20: die Linie ist
der Akzent (Bereichsfarbe), alles andere ruhig.

## Löschen & Archivieren (04.10.)
Kevin: „Wenn man auf Produkte geht, kann man keine Produkte löschen — das macht das Ganze wieder ein bisschen wild. Für die Usability können wir auch
immer Tasks, Produkte etc. einfach löschen bzw. den Button, der kommt, wenn man z. B. nach links swiped: dann kommt da Löschen oder Archivieren.
Alles andere macht da keinen Sinn.“ Baustein `components/os/ui/zeile-aktionen.tsx`, Regeln `lib/eintraege/sicher.ts`, Wächter `tests/zeile-aktionen.test.ts`.

**Regel: Jede Liste mit Einträgen nutzt `ZeileAktionen`** — keine eigenen Löschen-Knöpfe, kein `window.confirm`, kein endgültiges Löschen mit dem ersten Klick.

| Teil | Verhalten |
|---|---|
| Handy | Zeile nach links wischen → „Archivieren“ (ruhig, Fläche) und „Löschen“ (Achtung-Farbe `BEDEUTUNG_FARBE.kritisch`), je 88 px breit. Ab 40 % der Breite bleibt sie offen; zurückwischen, Tippen daneben, Tippen auf die Zeile oder Escape schließt. Immer nur EINE Zeile offen. Senkrechtes Scrollen bleibt frei: `touch-action: pan-y` + Richtungs-Erkennung ab 10 px (waagerecht erst, wenn \|dx\| > 1,2 · \|dy\|). Der Klick nach dem Wischen öffnet die Zeile nicht. Pointer-Events, keine Bibliothek. |
| Rechner | Dieselben zwei Aktionen als Symbol-Knöpfe (40 px) am rechten Rand der Zeile, sichtbar beim Überfahren und beim Tastatur-Fokus (Tab erreicht sie, Fokus-Rahmen sichtbar). Beschriftung für Vorleser: „„Titel“ archivieren“ / „„Titel“ löschen (Papierkorb)“; im Archiv „… aus dem Archiv zurückholen“. Ohne Zeiger (Handy) sind die Rand-Knöpfe nur für Vorleser/Tastatur da. |
| Rechte | **Entschieden wird auf dem Server** (Plattform-Regel: Sicht/Rolle/Haushalt nie nur in der Oberfläche): Produkte nur im Haushalt des Inhabers (`/api/crm/bestand`, fremder Haushalt/Testkunde/Partner 403 — auch beim Lesen des Papierkorbs); Aufgaben: fremde „nur ich“ gibt es für andere nicht (Papierkorb-/Archiv-Liste serverseitig gefiltert, `sichtFuer`; löschen, endgültig löschen, archivieren, wiederherstellen → 404). `darf={false}` blendet die Aktion zusätzlich aus, ersetzt die Prüfung aber nie. Wächter: `tests/zeile-aktionen.test.ts` › Server. |
| Bewegung | `transform` + Breite, 0,24 s; „Bewegung reduzieren“ = sofort (Regel in globals.css). Nur Token-Farben. |

**Sicher statt endgültig (eine Logik):** Archivieren = ausblenden, jederzeit zurückholbar (Ansicht „Archiv“). Löschen = Papierkorb (`geloeschtAm`, Marke setzt
der Server, Frist `PAPIERKORB_TAGE` = 30, nicht verschiebbar), danach unten „Rückgängig“ für 10 s (`useRueckgaengig`). Endgültig erst nach Ablauf
(Morgenlauf) oder als eigener Schritt aus dem Papierkorb mit Rückfrage. Hängt etwas daran (laufende Mandate, offene Deals, Unteraufgaben), nennt die
`Rueckfrage` es vorher — nie still.

**Einsatz in einer neuen Liste (2–3 Zeilen):**
```tsx
<ZeileAktionen titel={x.name} onArchivieren={() => archivieren(x)} onLoeschen={() => loeschen(x)} darf={darf}>
  <Zeile titel={x.name} … />
</ZeileAktionen>
// archivieren/loeschen: Bestand ändern + melden(`„${x.name}“ im Papierkorb`, () => zurück(x)) aus useRueckgaengig()
```

**Eingebaut (04.10.):** Produkte (Reiter Produkte · Archiv · Papierkorb; Archiv = Status „eingestellt“, Zurückholen = „Entwurf“; Papierkorb bleibt über
die Frist hinaus, solange Mandate/Deals daran hängen; Morgenlauf-Schritt „Produkte-Papierkorb“) · Aufgaben (Baum: jede Ebene; Archiv › „Archiviert“
mit Zurückholen; Einzel-Archiv = dieselbe Marke wie „Neu anfangen“ mit Kennung `ea-<Aufgabe>`, nimmt den Teilbaum mit, Serien ruhen; Löschen wie bisher in
den Papierkorb, die Rückfrage nennt Unteraufgaben/Notiz/Dateien). Planung und Aufgaben-Hinweise hängen am selben `useRueckgaengig`.
**Alle übrigen Listen (04.10. abends, Kevin: „Mach weiter mit allen … wir müssen alles anpassbar haben“)** — Wächter `tests/listen-aktionen.test.ts`
(Liste aller Komponenten; kommt eine Liste dazu, gehört sie dort hinein). Was „Archiv“ je Liste heißt:

| Liste | Archivieren | Löschen |
|---|---|---|
| Mandate | Status „beendet“ (aktives erst nach Rückfrage); Zurückholen = aktiv bzw. Verhandlung | Papierkorb, nur ohne Rechnungen/Dateien/offene Follow-ups (Server-Sperre) |
| Deals | Rückfrage: parken (Wiedervorlage) oder verloren (Grund) — Zurückholen = letzte offene Stufe | nur Fehlanlage (ohne Geschichte/Wert/Notiz), endgültig nach Rückfrage |
| Angebote | `archiviertAm`, jeder Status (Filter „Archiv“) | Papierkorb nur für Entwürfe — gestellte sind Geschäftsunterlage |
| Kontakte | `archiviertAm` = nur aus der Kartei ausgeblendet (Ansicht „Archiv“) | Art.-17-Weg (Rückfrage + Grund fürs Löschprotokoll, `crm/kontakt/art17.tsx`) |
| Firmen, Events, Kampagnen, Segmente, Beiträge, Newsletter | `archiviertAm` (Reiter/Ansicht „Archiv“) | Papierkorb 30 Tage (`lib/crm/ablage.ts`); Firmen nur leer; Events: Gäste/Termin bleiben bis „endgültig“ (Serverweg mit Kaskade) |
| Ziele & Meilensteine | `archiviertAm` (Bereich „Archiv“ unten; löst Abgeleitetes vom Jahresziel) | mit Rückgängig; Abgeleitetes → Rückfrage (käme sonst wieder) |
| Aufgaben-Baum | Projekt: `archived` | Projekt: Papierkorb; Gruppe/Liste: mit Rückgängig, Inhalt bleibt |
| Stammdaten-Kartei | `archiviertAm` am Satz | Papierkorb am Satz, endgültig nach Rückfrage |
| Familie (Tage, Menschen, Traditionen, Themen, Wünsche, Ideen) | `archiviertAm` (Erinnerungen/Agenda rechnen ohne) | mit Rückgängig; Karten: Archiv = „betrifft uns nicht“ |
| Brain-Regeln · Bauplan-Karten | ablösen (`_abgeloest`) · verwerfen | — (Geschichte bleibt) |
| Visitenkarten-Profile | — | mit Rückgängig |

CRM-Papierkorb: `ladeCrm()` und `/api/crm/bestand` blenden ihn für ALLE Leser aus (Zahlen, Suche, ZOE, Kalender) und liefern ihn getrennt (`papierkorb`);
Oberfläche `components/os/crm/ablage.tsx` (`useCrmAblage`, `AblageReiter`, `PapierkorbKarte`). **Rückfragen:** `useRueckfrage().bestaetigen({ titel, text, ja, gefahr })`
ist der Ersatz für `window.confirm` (Promise, „Abbrechen“ immer dabei) — im Repo gibt es kein `window.confirm` mehr (Ausnahme: Stammdaten › Gesellschaften, Register-Paket).
Kalender-Verschieben nutzt `useRueckgaengig` (10 s statt eigener 8-s-Leiste); `planung/Rueckgaengig.tsx` ist aufgegangen.

## Aufräumen: der Rest am Standard (04.10.)
Kevin: „Dann ist die Software fast fertig.“ Die letzten 28 Dateien hingen noch an `schlank.tsx`: Board-Pack, Content, Meeting, Prospecting, Research, Roadmap,
Ritual, Onboarding, Tageslauf, Zusammenarbeit, Heute, Abhängigkeiten, Fälligkeit, Schnellsuche, Taktgeber, Willkommen, Bauplan (Board, Planung, Karte, Erfassen),
Zeit (je Einheit, je Mandat, Mandat-Wahl), Anstehend, Meine Visitenkarten, Produkte & Mandate, Beitragsverlauf — und die Anmeldung (Eingabe 48/16 aus `ui/felder`).
Rein Darstellung (80/20), Funktion und Daten unverändert:
1. Fließtext 11,5–12,5 px → `TYP.bedien`, Beschriftungen in Großbuchstaben → `TYP.mikro`, Erklärungssätze in `inkDim`.
2. Die eine Hauptaktion je Ansicht ist `Knopf haupt` (Board-Pack erstellen, Entwurf schreiben, Meeting auswerten, Alle qualifizieren, Recherchieren, Lauf starten,
   + Karte); die Hero-Karte ist getönt (`ton`) statt `akzent`.
3. Fehler und Meldungen als `Hinweis` (kritisch/gut/info, „Noch einmal versuchen“ wo es einen Weg gibt) statt roter Textzeile.
4. `Leerzustand` (Symbol + Satz + Weg) dort, wo der leere Zustand eine Handlung hat: Board-Pack, Zielliste. Ladezustände und Zeilen bleiben `Leer`.
5. ✕ an Abhängigkeiten ist `SymbolKnopf eingebettet` (Tippziel 44 px).
Nicht angefasst: `window.confirm` und Löschen in Listen (eigenes Paket `ZeileAktionen`/`useRueckfrage`).

## Kugeln — ZOE und Brain (05.10.)
Kevin (04.10.): ZOE tritt als Lichtkugel auf (Vorlage „Solaris“, Wirkung statt Code), das Brain wird eine Kugel aus allen Datensätzen. Kern
`components/os/kugel/*`, Token `KUGEL`, `KUGEL_BEREICH_FARBE`, `mischHex` (design.ts), Wächter `tests/kugeln.test.ts`, `tests/brain-kugel.test.ts`.

| Ort | Kugel | Regeln |
|---|---|---|
| Empfang `/zoe` | `ZoeKugel groesse="gross"` | Punktwolke Smaragd → Granat, hohle Mitte, heller Rand, Einstieg 2,4 s, Ausbruch unter dem Zeiger (nur Rechner); Zustände über Tempo/Farbgewicht; Hof und Zustandszeile in `ZOE_KUGEL_TON` |
| ZoePanel | `ZoeKugel groesse="symbol"` | 900 Punkte, 24 Bilder/s, kein Zeiger |
| Brain › „Dein Brain“ | `BrainKugel` | Punkt = Datensatz, Farbe = Bereich (Legende), Größe/Helligkeit = Aktualität; Zeiger zeigt Titel + Linien zu Verbindungen, Klick öffnet über `WEG`, am Handy erst zeigen, dann „Öffnen ›“; darunter die Liste (Tastatur, Vorleser) |

**Regeln:** 1. 80/20 — die Kugel ist der eine Akzent der Ansicht; ruhiges Atmen, keine Effektfeuerwerke, kein Bloom. 2. Nur Token-Farben (kein Hex/rgb im
Ordner). 3. Leinwand `aria-hidden`, alles Gezeigte steht auch als Text (Zustandszeile, Liste, Legende). 4. „Bewegung reduzieren“ = Standbild, ohne WebGL der
Rückfall (ZoeHirn, Orb, Liste). 5. Daten der Brain-Kugel nur aus `/api/brain/punkte` — die Oberfläche filtert nichts selbst.
