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
| `Klappbar` | Abschnitt einer Seite zum Auf- und Zuklappen (08.10.): Kopfzeile = Knopf (Anzeigeschrift 18, Pfeil, optional Zähler), zugeklappt wird der Inhalt NICHT gerendert, Anker `#<id>`; keine Karte (der Inhalt trägt seine Karten) — Finanzen › Planung |
| `ZeileAktionen` | Aktionen an jeder Listenzeile: „⋯“ in eigener Spalte → Menü (Öffnen · Link · neuer Tab · `mehr` · Archivieren · Löschen); Handy wischen nach Einstellung (siehe „Zeilen-Aktionen“) |
| `EinfuegeTabelle` | Daten-Assistent (09.10., B9 a–c): aus Excel einfügen (Tab-getrennt) oder CSV wählen → Spalten/Positionen zuordnen (Vorschlag, je Quelle eine Auswahl 44/16) → Vorschau vom Server (neu · geändert · gleich · entfällt · Fehler je Zeile, abwählbar per `HakenZiel`) → EINE Hauptaktion „n übernehmen“ → „Rückgängig“ im Hinweis. Liste statt breiter Tabelle (Handy). Leser: `lib/tabelle/einfuegen.ts` — kein zweiter CSV-Leser |
| `Lage` | „Antwort zuerst“ (11.10.): höchstens fünf Kacheln oben in einer Ansicht — Zahl (Farbe = Bedeutung), ein Wort, ein Zusatz, optional Balken, Weg dorthin (`href`/`onClick`). Rechnet nichts; die Seite gibt fertige Werte (siehe „Übersichtlichkeit“) |
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
| Website | — (seit „Klar 2“, 07.10., tragen die Websites keine Lichtfäden mehr) | — |

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
anderen Person nur als „Belegt“ (grau, ohne Titel/Link). 7. `band.ts`/`zeichnen.ts` gehören nur der App
(die Website-Kopie ist seit „Klar 2“, 07.10., entfernt; Wächter `tests/lichtfaeden.test.ts`). 8. Nie im Zeichner Daten rechnen.
9. Ziel-Farben rechnet nur der Server (`lib/planung/ziel-farben-server.ts`, Feld `farbe` an jedem Ziel) — Oberflächen nehmen sie, wie sie kommen.

**Seil (07.10., LICHTFAEDEN.md › Seil):** Stränge laufen je Ziel als Fasern in ein Seil. Wie ein Gantt: links eine feste **Beschriftungs-Spalte**
(je Spur eine Zeile über die ganze Spur-Höhe — Marke in Strang-Farbe, gefüllt = erledigt, Schloss = blockiert; Titel `TYP.bedien`; Prozent;
überfällig in `LEUCHT.achtung`), rechts die Zeit; Kopf „STRÄNGE“ in `TYP.mikro`, Trennung `RAND.haar`, Hervorhebung `TIEF.flaeche(farbe)`, aktiver
Fokus-Knopf `TIEF.knopf(farbe)` — keine Farb-Literale. Breite NUR über `seilSpalte` (`SEIL_FORM.spalte`); Blättern verschiebt nur die Zeit. Handy
(bis 720 px) ohne Querlauf (`SeilHandy`). „Bewegung reduzieren“ und verborgener Tab = sofort das fertige Bild. Wächter `tests/seil-oberflaeche.test.ts`.

## Umgestellt: Kern — Shell · Aufgaben · Kalender · Inbox (03.10.)
Reine Darstellung und Struktur; Funktion, Daten und Abgleich (iCloud/Google/Gmail) unverändert. Wächter: `tests/design-kern.test.ts`.

**Globale Shell (wirkt auf jeder Seite):**
1. **Kopf:** runde Knöpfe sind `.kopf-rund` (40 px Rechner, 44 px Handy; vorher 34). Am Handy passen sieben 44-px-Ziele (Wachstum, Suche, Heute, Inbox, Kalender, Meldungen, Fokus) in eine Zeile; der **Index-Schalter** („Business-Index … ↗“) steht dort in einer eigenen Zeile darunter (früher war er aus der wischbaren Kopfzeile geschoben und unsichtbar). Die Lupe gibt es nur am Handy, das Suchfeld nur am Rechner.
2. **Leiste links** (232 px): Kasten 15 px/700 (`TYP.body`), Punkte und Zeilen 13 px (`TYP.bedien`), alles ≥ 40 px; Einklapp-Knopf 40 px. **Unten (Handy):** Kasten ≥ 48 px, aktiver Eintrag fett; ein Space leuchtet nur auf Seiten, die zu ihm gehören (N3: nicht mehr auf Konto, Heute, Kalender), solange sein Blatt offen ist ebenfalls. Blatt-Zeilen 44 px, Schrift 15 px.
3. **ZOE-Fenster** am Handy: 8 px Rand links und rechts (`.zoe-fenster` in globals.css; vorher 6 px links abgeschnitten); Breite/Höhe ziehen den eingestellten Abstand ab.

**Neue Bausteine (`components/os/ui`):** `HakenZiel` (sichtbar 24 px, tippbar 44 px als echter Knopf, kein Pseudoelement), `SymbolKnopf` (✕, Stift, ⋯: 40/44 px, `gefahr` rot, `eingebettet` in Pillen; Zweitaktionen stehen mit Abstand in `.ui-symbole`), `ZielChip` + `useZielBezug` (siehe Ziel-Bezug), Klassen `.ui-haken-ziel`, `.ui-symbol`, `.ui-mini-monat`, `.ui-monat-*`.

**Ziel-Bezug (Kevins Leitidee „immer der Fokus auf die Ziele“):** Wo eine Aufgabe in der Liste eines Meilensteins liegt, zeigt Zeile (Aufgaben-Baum) und Detail einen ruhigen Chip „Ziel · Titel“ in der **Ziel-Farbe der Lichtfäden** (je Space nach Rang durch `FADEN_FARBEN`, `lib/aufgaben/ziel-bezug.ts`). Nichts wird gespeichert, kein Feld kommt dazu — gelesen wird die vorhandene Kette Aufgabe → Meilenstein (`meilensteinVonAufgabe`) → Ziel (`zielVonMeilenstein`); Abfragen nur, wenn überhaupt eine Aufgabe in einer Meilenstein-Liste liegt.

**Aufgaben:** alle Dateien über `../ui`; Abhaken-Kreise `HakenZiel`; ✕/Schließen/Entfernen `SymbolKnopf`; Wahl-Chips (`crm/Wahl`) 32/36 px statt 26/30; Kopf am Handy: Umschalter Kalender|Aufgaben neben dem Titel, Darstellung (Liste · Board · Tabelle · Kalender · ZOE) und „Zeitstrahl ›“ als eigene Zeile im Inhalt (`ui-nur-breit`/`ui-nur-schmal`); Schnellzeile: kurzer Platzhalter + Kürzel-Hinweis darunter, der Ort (Space › Projekt › Liste) am Handy als EINE Zeile mit „ändern“; Platzhalter der Zeilen kurz („+ Aufgabe (Enter)“); Eigenschaften im Detail stehen am Handy übereinander (`ui-eigenschaft`, kein Überlauf der Datumsfelder).
**Kalender:** Mini-Monat: Vor-/Folgemonat 44 px (vorher 4 × 24), Tage 40/44 px mit Beschriftung („3. Oktober, heute, mit Terminen“); Monatsblatt am Handy: ganze Tage antippen, Termine als Punkte (die Pillen gehören dem Rechner); die sechs Ansichten (Tag … Termine) seit 10.10. als `Segmente` (breite Kopfzeile) bzw. Menü „Woche ▾“ (schmal) — Abschnitt „Kalender — Ansicht wie Google“; Einstellungen: freie Tage entfernen 44 px; Kalenderliste mit 44-px-Zeilen. **Rasterzellen** (Zeitraster, Monat, Jahr, 4 Tage, Balken der Aufgaben-Kalenderansicht): der Block/die Zelle ist das Ziel (`.ui-kein-ziel` an Unterknöpfen), Schrift mindestens 12 px — die einzige Ausnahme von der 13-px-Regel.
**Inbox:** Liste, Gmail-Thread, Antwort-Editor (`feld`, 180 px), Meldungen als `Hinweis`; Thread bricht lange Adressen um (kein seitlicher Überlauf), das Mehr-Menü ist eine Fläche mit ganzen Knöpfen, Einzug unter der Zeile am Handy 4 px statt 22.

**Messung (Sandbox, erfundene Daten, 375 px, 42 Ansichten, vorher → nachher):** Tippziele < 44 px — Aufgaben (11 Ansichten) **777 → 0**, Kalender (10) **1.290 → 3**, Inbox (5) **147 → 0**, Shell-Seiten (6) 158 → 75 (Rest: Inhalt von Home/Konto/Heute und das ZOE-Fenster, die anderen Paketen gehören), Regression (10 fremde Seiten) 196 → 106 (nur Shell-Teile besser, nichts schlechter); Eingaben < 16 px Aufgaben 104 → 0, Kalender 23 → 0; seitlicher Überlauf 0 → 0; Konsolenfehler 0 → 0. Vergleich mit Fotos: `scratchpad/design-kern/vergleich.html`.

## Kalender — Ansicht wie Google (10.10.)
Kevin 10.10.: „Den Kalender überall in der Ansicht anpassen — nicht gut zu sehen, nicht gut zu scrollen, man sieht einfach nichts, im Vergleich zu Google.“
Befund am Bildschirm (Woche, Business): dieselben mehrtägigen Aufgaben an JEDEM Tag einzeln in der Ganztags-Zeile, vom Raster blieben 2–3 Stunden, oben
stapelten sich Seitenkopf, „letzter Abgleich …“-Texte je Kalender und zwei Schalterreihen, „Business-frei“ kräftig rot. Gilt für Tag · 4 Tage · Woche · Monat ·
Planen · Aufgaben-Modus (`components/os/kalender/*`). Termine, Aufgaben und Verhalten (Aufziehen, Ziehen, Rückgängig, Gäste-Rückfrage) sind unverändert.

1. **Volle Höhe:** der Kalender reicht bis zum unteren Fensterrand (`useVolleHoehe` in `components/os/kalender/darstellung.tsx`, Regel `volleHoehe` in
   `lib/kalender/darstellung.ts`: Fenster − was darüber steht − Handy-Leiste). Raster und linke Spalte rollen JE IN SICH, nie die Seite; Tageskopf und
   Ganztags-Bereich stehen oben fest (eigene Zeilen mit `scrollbarGutter: 'stable'`, damit die Spalten genau übereinander liegen). Beim Öffnen rollt das Raster
   auf eine Stunde vor jetzt bzw. auf den Arbeitsbeginn (Ende der eigenen Business-freien Nacht, `arbeitsbeginnAus`, sonst 7:00) — wer selbst rollt, wird nicht
   zurückgeholt. Monat und Jahr füllen die Höhe ebenso und rollen in sich, wenn sie nicht reicht.
2. **EINE Kopfzeile, kein sichtbarer Seitenkopf** (`.kalender-seite`: der Titel bleibt für Vorleser): Heute ‹ › · Zeitraum in einer Zeile („5.–11. Okt. 2026 · KW 41“,
   `zeitraumText`; am Handy kurz „5.–11. Okt.“) · Abgleich als PUNKT je Quelle (`AbgleichPunkte`: grün/gelb/rot nach `abgleichAmpel`, Tooltip, Klick zeigt
   Einzelheiten + „Jetzt abgleichen“) · Suche als Symbol (Klick oder „/“) · Ansicht · Kalender/Planen · Kalender|Aufgaben · Darstellung. `.kalender-kopf` ist ein
   Container: ab 1180 px stehen Ansicht und Kalender/Planen als `Segmente`, schmaler als Menü „Woche ▾“ (mit Tasten) bzw. Symbol. Am Handy zwei Zeilen; „Erstellen“
   ist dort nur „+“. Verbunden steht über dem Raster nichts mehr (`BereichVerbindungen ohneHinweis`) — nur die Karte zum Verbinden, solange es nötig ist.
3. **Ganztags-Bereich als Bahnen** (`components/os/kalender/Ganztags.tsx`, Lage rein in `lib/kalender/layout.ts` `ganztagsLegen`/`ganztagsSicht`, Tage einer
   Aufgabe `ganztagsSpanne`): ein mehrtägiger Termin bzw. eine Aufgabe vom Start bis zur Deadline ist EIN durchgehender Balken; höchstens zwei Bahnen
   (`GANZTAGS_ZEILEN`), darunter „+n“ je Tag; ▾/▴ in der linken Spalte klappt auf (dann rollt der Bereich in sich). Über den Zeitraum hinaus: ‹ bzw. ›. Im Monat sind
   mehrtägige ganztägige Termine je Woche ebenso ein Balken (am Handy ein schmaler Farbstreifen). „Aufgaben ohne Uhrzeit anzeigen“ ist ein Schalter je Gerät.
4. **Lesbare Blöcke:** Fläche in der Farbe des Kalenders mit `BLOCK_ALPHA` (0x33 — Titel und Zeitzeile ≥ 4.5:1, Rand ≥ 3:1, Wächter in
   `tests/kalender-ansicht.test.ts`), Titel 12,5 px/650 und Uhrzeit; kurze Blöcke in EINER Zeile „Titel, 10:00“, hohe dürfen den Titel umbrechen. Ein Block füllt
   nach rechts, solange dort zur selben Zeit niemand liegt (`spanne` in `spaltenLegen`), Rand im Grundton trennt Nachbarn; Mindesthöhe 24 px bleibt. Jetzt wie Google:
   roter Punkt + Linie über den heutigen Tag, die Uhrzeit rot in der Stundenspalte.
5. **Ruhiger:** Business-frei ist eine leise graue Schraffur (`FREI_SCHRAFFUR`), keine Farbe. **Darstellung je Gerät** (Merker `make-kalender-darstellung`, Regeln
   `lib/kalender/darstellung.ts`, Felder `DarstellungFelder` im Knopf „Darstellung“ der Kopfzeile und unter Einstellungen › Bedienung): Zeilenhöhe Kompakt · Normal ·
   Groß (`ZEILEN_PX`, Normal = der bisherige Wert), Zoom mit Strg/⌘ + Mausrad bzw. zwei Fingern NUR über dem Raster (die Minute unter dem Zeiger bleibt stehen,
   `rollAnker`; außerhalb zoomt der Browser wie immer), „Aufgaben ohne Uhrzeit anzeigen“, Bedienungshilfe unter dem Raster (auch über das „?“ oben links).
6. **Handy:** Vorgabe Tag; „4 Tage“ zeigt am Handy drei Tage (`mehrereTage`, Kennung `vier` und Taste x bleiben), volle Höhe, Wischen wie bisher.

Neue Stellen im Kalender: Farben/Flächen über `BLOCK_HEX`, Lage nur über `lib/kalender/layout.ts`, Gerät-Einstellungen nur über `kalenderDarstellungAendern`.

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

Der Faden unter Reise, Fluss und Fläche ist das **Markenzeichen** (nächster Abschnitt) — er zählt nicht gegen „eine Fokus-Karte, zwei FadenLinien“.

## Markenzeichen: der Flow (17.10.)
Kevin 17.10. (Bild aus der Markttraktion, „Verlauf · 20 Tage“ unter dem Traktions-Index): „Denke dir auch immer den Flow, diese Linie, mit — das ist unser
Markenzeichen nachher bzw. soll es werden.“ — „Das war damit gemeint — dass alles immer nach und nach in den Flow kommt.“

**Leitsatz: Nach und nach kommt alles in den Flow.** Jede Ansicht mit einem Weg, einem Verlauf, einer Reihenfolge oder einem Fortschritt bekommt den Lichtfaden —
derselbe Faden überall, aus demselben Zeichner, mit derselben Bedeutung.

- **EIN Zeichner:** `lib/lichtfaeden/flow.ts` — rein `flowProben` (Stützpunkte aus Weg, „Hier“, Stellen, Farbabschnitten), `zeichneFaden` (Kern + Fäden + Partikel,
  additiv), `zeichneFlow` (dazu Leuchtpunkt „Hier“ und Glühen), `taktLauf` (EIN gemeinsamer requestAnimationFrame für alle Faden-Ebenen der Seite), `flowEbene`
  (eine Leinwand, viele Fäden, optional Kamera). Die FadenLinie der Index-Verläufe (`lib/lichtfaeden/fadenlinie.ts`) zeichnet mit `zeichneFaden` im selben Takt —
  der Traktions-Index sieht genau aus wie die Reise. Parameter nur in `FLOW`. Nie eine zweite Linien-Logik (Wächter `tests/flow-linie.test.ts`).
- **Der Baustein `FlowLinie`** (`components/os/ui/flow.tsx`, Import `from '../ui'`) — die ganze Schnittstelle, ein paar Zeilen:

  ```tsx
  <FlowLinie punkte={[[0, 12], [480, 12]]} bisHier={0.4} ton={JETZT} hier frans />   // ein Weg in Pixeln der Leinwand
  <FlowLinie faeden={[…]} />                                                          // mehrere Fäden (FlowFaden)
  <FlowLinie messen={(eltern, leinwand) => […]} />                                    // die Fäden aus dem Bild messen (Reise, Fluss)
  ```
  Ein `FlowFaden` ist: `punkte` (Weg), `farbe`, `bisHier` (0 … 1, erreicht bis hier), `hier` (Leuchtpunkt), `frans` (Zukunft ausgefranst), `gluehen` (Ende glüht),
  `stellen` (`stau` = offen, `durch` = gegeben), `farben` (Abschnitte in eigener Farbe), `staerke` (fein · mittel · breit), `aufbau` (wächst von links ein).
  Die Leinwand liegt `position: absolute` im Eltern-Element (Lage per CSS, Klasse `ff-flow-ebene`), ist `aria-hidden`, nimmt keine Zeiger; solange sie läuft,
  trägt das Eltern-Element `data-flow="an"` (dort blendet CSS die ruhige Ersatz-Linie aus).
- **Bedeutung (immer gleich):** hell und fließend bis „Hier“ (erreicht), dahinter ruhig und gedämpft; wo der Weg in die Zukunft geht, franst er aus (wie Strahl v3
  nach HEUTE). An einem offenen Abstimmungspunkt bzw. einer offenen Abhängigkeit **staut** er sich (das Bündel weitet sich und leuchtet, dahinter ein schmaler
  Hals), an einem gegebenen fließt er hindurch. Der Pfeil in den aktuellen Knoten glüht sanft. Er fließt immer in Laufrichtung.
- **Farbe:** der Akzent der Instanz (`FLOW_TON.basis` = „Hier“, Petrol), der Nein-Pfad zur Erinnerung im Ton der Erinnerung (Orange), **Rot bzw. Gelb nur, wo
  wirklich etwas hängt**; im Kreislauf (`laeuft`) jede Stufe in ihrer Farbe. Nur Token (`FLOW_TON` in `components/os/ui/reise/formen.tsx`), nie ein Literal.
- **Eingebaut:** Reise (`ReiseBild`: der Faden läuft an der Unterkante, das Band „Kunde“ sitzt darauf — seine untere Linie entfällt; ohne Band unter den Kästchen;
  am Handy links an der senkrechten Liste) · Fluss (`Fluss` + Editor-Fluss: jeder Pfeil ein feiner Faden, `FlussFaden` in `components/os/ui/reise/faden.tsx`) ·
  Fläche (Prozess-Editor: eine Ebene UNTER dem SVG, Kamera und Wege direkt — beim Ziehen nur die betroffenen, der neue Pfeil zieht einen Faden mit; „Als Bild
  speichern“ zeichnet die Fäden als ruhiges Standbild ins SVG, `FlaechePfeil faden`). Dadurch automatisch: Fulfillment (Fall, Editor), Markttraktion › Kreislauf,
  Einrichtung, Planung › Ziel.

**Regeln:**
1. **Nie ohne echten Weg:** ohne Weg zeigt `FlowLinie` nichts, eine Reise ohne Stufen hat keinen Faden, ein Fluss ohne Pfeile auch nicht — kein Schmuck-Faden über
   leeren Ansichten.
2. **Stand nur aus dem Modell:** die Fadenlage rechnet `lib/reise/flow.ts` aus denselben Daten wie die Zeichnung — `reiseFlow` aus den Spalten (die Stufe `jetzt` IST
   „Hier“, also dieselbe Stelle wie `fallStelle` im Fall-Kopf), `pfeilZustand` aus den Knoten davor/danach, `flaecheFaden` aus den Pfeilen der Fläche. Die
   Zeichnung misst nur Lagen.
3. **Bewegung:** sehr ruhig (~30 Bilder je Sekunde im gemeinsamen Takt), pausiert außer Sicht und im verborgenen Tab. `prefers-reduced-motion` = Standbild ohne
   Takt. Kunden-Ansicht und Präsentation: `flow="still"` (Standbild). Druck: die Ebene ist aus, die ruhigen Linien stehen wieder da; Report-PDFs zeichnen weiter die
   ruhige Zeile.
4. **Leistung:** eine Leinwand je Weg-Ansicht, Stützpunkte nur bei neuen Daten, neuer Größe oder neuer Kamera; Fläche: außerhalb des Bildes wird nichts gerechnet,
   bis ~300 Knoten flüssig; kein React-Zustand je Bild.
5. **Markenzeichen statt Fokus-Signatur:** der Faden einer Reise, eines Flusses oder einer Fläche zählt nicht gegen die Grenzen der Fokus-Signatur (eine Fokus-Karte,
   zwei FadenLinien). Dafür gilt: **je Weg genau EIN Faden** — kein zweiter Faden, kein Strahl neben derselben Reise.
6. **Barrierefrei:** die Leinwand ist `aria-hidden`; die Bedeutung steht in Text und Zeichen (✓, „Hier“, Raute, „hängt“) — nie nur im Faden.

**Neue Ansicht einhängen (Rezept):** Weg und Stand im Modell des Bereichs rechnen (wie `reiseFlow`) → `FlowFaden` bauen → `<FlowLinie … />` in ein
`position: relative`-Element legen (CSS für die Lage der Leinwand) → Wächter-Zeile in `tests/flow-linie.test.ts` → Zeile unten von „Als Nächstes“ nach „Hat den Flow“.

| Hat den Flow (17.10.) | Als Nächstes |
|---|---|
| Index-Verläufe als FadenLinie (Traktions-, Business-, Privat-Index, Liquidität, Zeit je Einheit) — derselbe Zeichner | Liquidität: Engstellen als Stau im Verlauf |
| Fulfillment › Fall: Reise + Fluss · Prozess-Editor: Reise, Fluss, Fläche | Markttraktion › Deals: die Pipeline-Stufen als Weg (Board) |
| Markttraktion › Planung › Kreislauf (jede Stufe in ihrer Farbe) | Follow-up: Kadenz als Weg je Kontakt |
| Einrichtung (Etappen + Schritte) | Planung › Jahr: Meilenstein-Kette im Seil mit Stau an „wartet auf“ |
| Planung › Ziel (Meilensteine + Aufgaben) | Aufgaben: Abhängigkeiten (`abhaengigVon`) als Kette |
| Lichtfäden / Seil im Planungsjahr (eigener Zeichner, gleiche Sprache) | Bauplan-Board: Ideen → Fertig · Angebot: Entwurf → gestellt → angenommen |


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
| Handy | **Seit 10.10. (Abschnitt „Zeilen-Aktionen“):** nach LINKS wischen = Archivieren, nach RECHTS = Löschen (je Gerät umstellbar), ab der Schwelle ausgelöst, darunter schnappt die Zeile zurück. Senkrechtes Scrollen bleibt frei: `touch-action: pan-y` + Richtungs-Erkennung ab 10 px (waagerecht erst, wenn \|dx\| > 1,2 · \|dy\|). Der Klick nach dem Wischen öffnet die Zeile nicht. Pointer-Events, keine Bibliothek. |
| Rechner | **Seit 10.10.:** „⋯“ in einer eigenen Spalte rechts → Menü mit Archivieren/Zurückholen und Löschen unten (die Rand-Knöpfe über dem Inhalt sind weg). |
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

## Zeilen-Aktionen (10.10.)
Kevin 10.10. (Bildschirmfoto Mandate & Unternehmen › Mandate): beim Überfahren lagen Archivieren/Löschen als Knöpfe ÜBER dem Inhalt (verdeckten den
Chip „Pa…“). „Löschen und Archivieren muss anders laufen — z. B. nach links wischen oder rechts mit drei Punkten und Einstellungen. Denk drauf rum,
was für Einstellungen zusätzlich Sinn machen. Bau den Standard überall mit ein.“ Baustein `components/os/ui/zeile-aktionen.tsx` (+ Menü
`zeilen-menue.tsx`, Einstellungen `bedienung.tsx`), Regeln rein in `lib/make-one/bedienung.ts`, Wächter `tests/zeilen-menue.test.ts` und
`tests/zeile-aktionen.test.ts`.

**Regel: nichts liegt über dem Inhalt.** Jede Listenzeile mit Aktionen hängt an `ZeileAktionen`; die Aktionen stehen hinter „⋯“ in einer eigenen,
reservierten Spalte (44 px, `ZEILE_MEHR_BREITE` — Tabellenköpfe darüber rücken rechts um so viel ein). Kein eigener Löschen-/Archiv-Knopf in der Zeile.

| Teil | Verhalten |
|---|---|
| Rechner | Rechts ein ruhiges „⋯“ (44 × 44) in eigener Spalte — sichtbar beim Überfahren, beim Tastatur-Fokus und solange das Menü offen ist; mit der Einstellung „⋯ immer sichtbar“ immer. `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, Beschriftung „Aktionen für „Titel““. Enter/Leertaste/Pfeil runter öffnet. |
| Menü | Portal, Rolle `menu`/`menuitem`, Punkte ≥ 44 px. **Reihenfolge fest:** 1. Allgemeines, das der Baustein selbst kann — „Öffnen“ (`onOeffnen`, sonst `href`), „Link kopieren“, „In neuem Tab öffnen“ (nur interne Wege `/os…` über `WEG`); 2. die Einträge der Liste (`mehr`: Bearbeiten, Umbenennen, Firma öffnen, Parken, Verloren, Verschieben nach … — mit `auswahl` eine Unterliste mit Suche ab 7 Einträgen, `deaktiviert` + `grund` grau); ── Trennlinie ── 3. „Archivieren“ bzw. „Zurückholen“ und „Löschen“ (Achtung-Farbe, immer zuletzt). Pfeiltasten/Pos1/Ende wandern, Escape/Tab schließt, „⋯“ bekommt den Fokus zurück. Rechner: am Knopf (oben, wenn unten kein Platz); Handy: Blatt von unten über dunklem Grund, mit Titel und „Schließen“. |
| Handy | Wischen nach LINKS = Archivieren, nach RECHTS = Löschen (Vorgabe). Hinter der Zeile steht, was passiert (Symbol + Wort, Farbe nach Bedeutung, Rezept `TIEF`); ab der Schwelle (≈ ⅓ der Zeile, 72–140 px, `wischSchwelle`) wird es kräftiger und löst beim Loslassen aus, darunter schnappt die Zeile zurück. Senkrecht scrollen hat Vorrang. Hat die Liste die Aktion nicht (kein Archiv), gibt es in diese Richtung kein Wischen. „⋯“ steht am Handy immer. |
| Löschen | Wie bisher sicher statt endgültig (Papierkorb + 10 s „Rückgängig“ über `useRueckgaengig`). Mit der Einstellung „Vor dem Löschen nachfragen“ fragt der Baustein vorher (`useRueckfrage`) — außer die Liste fragt selbst (`loeschenFragt`: Sperren, Grund, was mitgeht; z. B. Kontakte Art. 17, Deals, Pannen). |
| Rechte | `darf={false}` = nur die Zeile: kein „⋯“, kein Wischen, kein Eintrag. Entschieden wird weiter auf dem Server. |

**Einstellungen › Bedienung** (`/os/system/bedienung`, `WEG.bedienung()`, Gruppe „Bedienung“ in `lib/make-one/einstellungen.ts`) — **je Gerät**
(Merker `make-bedienung` im Browser, nur Abweichungen von der Vorgabe; ohne Speicher gilt die Vorgabe): Wischen nach links/rechts (Archivieren ·
Löschen · Aktionen zeigen · Aus), „Vor dem Löschen nachfragen“ (aus), „⋯ immer sichtbar“ (aus), Dichte der Listen (Normal · Kompakt — Tippziel
bleibt ≥ 44 px), „Kurz vibrieren beim Wischen“ (aus; nur wo der Browser `navigator.vibrate` kann). Warum je Gerät: Wischen, Vibrieren und Dichte
sind Eigenschaften des Geräts — keine Personendaten, kein Server-Bestand. `BedienungAnwenden` im /os-Rahmen setzt `data-za-mehr`/`data-dichte`
am `<html>`; Zeilen lesen die Einstellung über EIN Abo (`useBedienung`).

**Einsatz:**
```tsx
<ZeileAktionen titel={x.name} href={WEG.x(x.id)} onOeffnen={() => oeffne(x.id)}
  onArchivieren={() => archivieren(x)} onLoeschen={() => loeschen(x)} loeschenFragt={hatVerweise(x)} darf={darf}
  mehr={[{ id: 'bearbeiten', label: 'Bearbeiten', tun: () => bearbeiten(x) }]}>
  <Zeile titel={x.name} … />
</ZeileAktionen>
```
**Eingebaut mit Weg/`mehr` (10.10.):** Mandate (Firma/Ansprechpartner öffnen), Kontakte (Firma öffnen), Firmen, Deals (Parken, Verloren …, Kontakt),
Angebote (Markttraktion jeweils mit „Mit ZOE besprechen“ = `zoeFragen` mit Bezug), Ziele (Umbenennen) & Meilensteine (Bearbeiten, Umbenennen), Bauplan (Verschieben nach …), Aufgaben (das frühere eigene Menü „…“ —
Verschieben nach, Umwandeln, Umhängen — ist jetzt `mehr`; die CSS-Sonderregel ist weg), Produkte, Kampagnen, Segmente, Newsletter, Beiträge,
Events, Datenschutz (Pannen, Empfänger). Neu am Baustein: Routinen (Pausieren) und die Einkaufsliste (Abhaken) — vorher ein ✕ ohne Rückweg.

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

**Überarbeitung „Solaris“ (05.10., Kevin: „das muss sehr geil aussehen“):** Hier IST der Effekt der Akzent — er darf leuchten, bleibt aber ruhig.
Glühen (Bloom) nur auf der Kugel, schaltet sich auf schwachen Geräten selbst ab; ZOE dichter (80 k) mit hellem Ring, hohler Mitte und weißglühenden
Spitzen, Aurora nur in den Ecken des Empfangs; Brain als eigene Bühne: Galaxie aus leisen Formpunkten, Datensätze als Sterne mit Halo, Cluster-
Beschriftung mit Kamerafahrt, Bögen statt Striche, Legende als Filter. Schilder und Legende sind Knöpfe (≥ 44 px), Titelkarte im Glas-Stil (`LICHT_GLAS`).

## Erklärung — antippen, verstehen, Fallbeispiel (10.10.)
Kevin (10.10.): „Wenn man auf die einzelnen Sachen klickt, möchte ich, dass die Erklärung dahinter ist und was es bedeutet — mit Fallbeispiel. Das will ich überall.“
EIN Baustein (`components/os/ui/erklaerung.tsx`, Export `from '../ui'`), EINE Stelle für die Texte (`lib/erklaerungen/` — Daten, damit eine Instanz sie anpassen
kann), ein Wächter (`tests/erklaerungen.test.ts`).

| Baustein | Zweck |
|---|---|
| `erklaerung`-Prop | An `Schalter`, `Zeile`, `Ueberschrift`, `Beschriftung`, `Feldzeile`, `Klappbar`, `Kennzahl`, `Zahl`: ein Schlüssel aus `EINSTELLUNGEN` (Typ prüft ihn) **oder** fertige Abschnitte (`kennzahlAbschnitte`, `headAbschnitte`, `mitarbeiterAbschnitte`, `kennzahlTextVon`). |
| `ErklaerKnopf` | Das kleine „i“ (Tippfläche 44 × 44, `aria-expanded`/`aria-controls`, Name im `aria-label`). In Überschriften und Beschriftungen schiebt `.ui-erkl-knopf` (globals.css) die Fläche mit negativem Rand zurück. |
| `ErklaerPanel` | Die aufgeklappte Erklärung: Abschnitte „Beschriftung · Text“; das Beispiel trägt eine leise Kante. |
| `Erklaert` | Hülle um ein beliebiges Bedienelement: Element + „i“, die Erklärung klappt darunter über die ganze Breite auf. |

**Regeln:** 1. Aufgebaut ist sie nach dem, was sie erklärt: **Einstellung** = Was es bedeutet · Beispiel · Wenn an · Wenn aus (· Kosten und Datenweg, wenn Daten hinausgehen
oder Guthaben kostet) — **Kennzahl** = Wie gerechnet · Beispiel · Was ihr tun könnt — **Head/Mitarbeiter** = Was er tut · Was er nie tut · Beispiel-Vorschlag — **Onboarding-Schritt**
= Warum/Wie (vorhanden) + Beispiel. 2. **Jeder `Schalter` verlangt `erklaerung`** (Typ) — oder `erklaerungOhne="Grund"` für Erledigt-Haken und Tabellenzellen; der Wächter zählt
die Ausnahmen (höchstens 14, Grund ≥ 25 Zeichen) und lässt die Einstellungsseiten ausnahmefrei. 3. In einer `Zeile` meldet der Schalter seine Erklärung an die Zeile: der **Titel der
Zeile** klappt sie auf („die Zeile antippen, nicht den Schalter“). Ist die Zeile selbst ein Tippziel (`onClick`), steht ein „i“ davor. 4. `Kennzahl`/`Zahl` mit Erklärung sind
antippbar, die geöffnete Kachel nimmt die ganze Rasterzeile ein. 5. **Index-Kennzahlen erfindet niemand neu:** „Wie gerechnet“ ist die `formel` des Registers plus Schwellen, das
„Beispiel“ rechnet die Mitte zwischen roter und grüner Schwelle mit denselben Funktionen wie der Index durch (`punkte`/`ampel`), „Was ihr tun könnt“ ist der Pflege-Weg des Registers
(`lib/erklaerungen/kennzahlen.ts`). 6. Beispiele sind **erfunden und neutral** („Beispiel GmbH“, „Mira“) — keine echten Namen, Firmen, Beträge, keine Gesundheitsangaben einer Person
(Wächter). Abschnitte ≤ 560 Zeichen, ganze Sätze. 7. Neuer Schalter/neue Einstellung = ein Eintrag in `lib/erklaerungen/einstellungen-*.ts`; neuer Head oder neue Vorlage im
Katalog = ein Eintrag in `lib/erklaerungen/agenten.ts`; neuer Onboarding-Schritt = ein Eintrag in `lib/erklaerungen/schritte.ts` — sonst wird der Wächter rot.

## Übersichtlichkeit — Antwort zuerst (11.10.)
Kevin 11.10.: „Bitte alles nochmal überarbeiten, das geht besser … es muss einfach zu verstehen sein, über die Visualisierungen; so ist es sehr
unübersichtlich.“ Fünf Grundsätze für jede Ansicht (Wächter `tests/design-oberflaeche.test.ts`):
1. **Antwort zuerst:** oben „Wo stehen wir · was kommt als Nächstes · was hängt“ als Bild — `Lage` (höchstens fünf Kacheln), Ring, Balken, Ampel oder
   Zeitstrahl; Einzelheiten eingeklappt oder einen Klick tiefer. Listen zeigen 3–5 Einträge, der Rest über „Alle n ansehen ›“.
2. **Eine Hauptaktion je Ansicht**, Nebenaktionen leise oder hinter „⋯“; ein seltener Schritt („Neu anfangen …“) ist leise, die Gefahr steht im Fenster.
3. **Ruhe:** keine doppelten Überschriften oder Erklärsätze (was ein Balken schon zeigt, steht nicht noch als Satz daneben); Rot nur für echte
   Dringlichkeit (überfällig, kritisch, abgelehnt) — ein Risiko oder ein offener Planungs-Punkt ist gelb; Text ≥ 13 px; Ziele ≥ 44 px; am Handy kein
   Querscrollen. Der Handy-Kopf bricht nie einen Titel Buchstabe für Buchstabe: breite Aktionen rutschen in eine eigene Zeile unter den Titel.
4. **Klare Sprache:** jede Zahl trägt ihr Wort („4 offen“, „0 fällig“), Kürzel in Klartext; Technik (Umgebungswerte, Skripte) nie im Fließtext — für den
   Inhaber aufklappbar („Was fehlt“).
5. **Felder erst bei Bedarf:** ein Anlege-Feld zeigt seine Zusatzfelder (Datum, Einheit, Mandat …) erst, wenn ein Titel getippt ist; leere Horizonte
   (Fokus) stehen als eine Zeile mit „eintragen“.

| Stelle | Antwort zuerst |
|---|---|
| Heute | Tages-Briefing: `Lage` (Termine · Top 3 · Überfällig · Freigaben · im Business Follow-ups) über dem Text — dieselben Zahlen vom Server (`/api/heute/briefing` → `zahlen`); Business-frei als Pille im Kopf statt eigener Zeile |
| Indizes (Business, Privat, Gesundheit, Traktion) | je Säule erst die gemessenen Kennzahlen, die Messlücken als EINE aufklappbare Zeile mit Namen (`components/os/kennzahlen/SaeuleKacheln.tsx`, eine Stelle für IndexAnsicht und Cockpit) |
| Markttraktion › Planung | Ring und gewählte Stufe nebeneinander, Wort unter jeder Zahl (`KREISLAUF_EINHEIT`), Plan und Ist als zwei Kacheln, Kanal-Filter als Auswahl-Chip im Kopf |
| Produkte & Mandate | Überblick mit „Als Nächstes“/„Worauf achten“ (Hinweis-Karten) und Liste zuerst, Index-Streifen darunter; Leistungstreppe sichtbar, Kundenreise · Zielbild · Roadmap · Positionierung aufklappbar |

## Prozess-Visualisierung (Reise + Fluss, 17.10.)
Rückmeldung 17.10. zum Fulfillment: „Nicht überladen, sondern sehr klar. Lieber wenig und klar — es dupliziert sich.“ Vorbild ist ein Miro-Board
(nur der STIL, nie Inhalte). Gilt für jeden Ablauf, der als Prozess gezeigt wird — seit 17.10. im ganzen System (Kevin: „Markttraktion-Kreislauf,
Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung. Dann sieht das ganze System gleich klar aus.“).
- **EIN Baustein für alle Bereiche:** `components/os/ui/reise/` (`ReiseBild`, `Fluss`, `KnotenKnopf`, `FormenLegende`, `FreigabeRaute`, `FormZeichen`,
  `JETZT`, `FORM_FARBE`), Typen und die Fenster-Regel `sichtbareKaestchen` in `lib/reise/bild.ts`. Jeder Bereich rechnet seine Zeile in SEINEM Modell aus den
  vorhandenen Regeln — die Zeichnung rechnet nichts. Neue Formen/Zustände nur dort, nie in einem Bereich nachbauen (Wächter `tests/reise-ueberall.test.ts`).

  | Bereich | Reise (Zeile) | Fluss / Liste beim Tipp | Modell |
  |---|---|---|---|
  | Fulfillment › Fall, Kunden-Seite, Report-PDF, Prozess-Editor | Phasen, Abstimmungspunkte als Raute, Band „Kunde“ | Fluss der Phase, Detail daneben | `lib/fulfillment/prozesse/reise-bild.ts`, `kundenReise` |
  | Markttraktion › Planung › Kreislauf | sieben Stufen (`laeuft`, Farbe der Welt, kein „Hier“), Zahl mit Wort + Sätze als Kästchen, Band „Kunde“ gestrichelt bis Fulfillment, „↺ in die Deals“ am Ende | die Liste der Stufe (Plan/Ist, Produkte, Kunden) und der Weg in ihre Ansicht | `lib/crm/kreislauf-bild.ts` (aus `kreislauf`) |
  | Einrichtung (`/os/onboarding`) | Etappen mit „Hier“ (Etappe des nächsten Schritts), ohne Band | Schritte der Etappe als Fluss, daneben Haken + Anleitung (der nächste vorgewählt; im Stand nur die Zeile „Als Nächstes: … ›“); Schalter „Liste“ = die ganze Liste | `lib/make-one/onboarding-bild.ts` (über `schritteFuer`, `istFertig`, `fortschrittVon`, `einrichtungStand`) |
  | Planung › Ziel (`WEG.ziel`) | Meilensteine in der Reihenfolge der Kette, „Hier“ = erster offener, Raute = der nächste wartet darauf, sonst „›“; ohne Band | Aufgaben des Meilensteins bis zur Raute „erreicht?“, daneben seine Karte (Haken, ▲▼, „+ danach“, bearbeiten); Meilensteine in der Reise ziehen (Bedienung des Editors, `ziehInReise` → `zieheInKette`, Alt+←/→); Schalter „Liste“ = alle Karten | `lib/planung/kette-bild.ts` (über `ketteOrdnen`, `aufgabenVonMeilenstein`) |

  Das Seil bleibt im Jahr. Optionen des Bausteins: `wort` („Phase“, „Stufe“, „Etappe“, „Meilenstein“), `band={false}`, `mehrWort`, Zustand `laeuft` (+ `farbe`),
  `raute.gegebenText`; `Fluss` mit `label`/`leer`, `FormenLegende` mit `formen` (nur, was die Ansicht zeigt). Ziehen in einer Reise bzw. einem Fluss nur über
  `useReiseZiehen` (components/os/ui/reise/ziehen.tsx — Maus ab 5 px, Finger 0,45 s, Escape; Stufen-Ziel `stufenZielBei`), nie eine zweite Zieh-Bedienung.
- **Reise** = EINE Zeile der Phasen (`components/os/ui/reise/ReiseBild.tsx`): je Phase eine Pille, darunter höchstens vier kurze Kästchen
  (`KAESTCHEN_MAX`, Rest „+n“), zwischen den Phasen die Raute des Abstimmungspunkts, unten ein durchgehendes Band (intern „Kunde“, beim Kunden „Bei
  Ihnen/euch“) für das, was beim Kunden liegt; „Läuft immer mit“ (Rituale, Report) als EIN Satz darunter. Klick auf eine Phase zeigt ihren Fluss, Klick
  auf ein Kästchen das Detail.
- **Fluss** = eine Phase von oben nach unten (`components/os/ui/reise/Fluss.tsx`): Start als Kreis/Pille → Schritte → Raute „ja/nein“ → nächste Phase. Mehrere Teilprozesse
  stehen als Karten nebeneinander (am Handy untereinander); lange Stränge zeigen ein Fenster um „Hier“ (höchstens sechs) und „+n weitere Schritte“.
- **Formen tragen die Bedeutung (nie nur Farbe):** Schritt = Kasten (grün `LEUCHT.gut`), Nachricht = Kasten mit Brief (gelb `LEUCHT.achtung`),
  Abstimmungspunkt/Entscheidung = Raute mit „ja“/„nein“, Erinnerung = abgerundeter Kasten mit Glocke (orange `LEUCHT.business`, nur auf dem Nein-Pfad bzw.
  wenn ein Schritt wirklich beim Kunden wartet), Termin = große Beschriftung mit Linie. Zustände: ✓ erledigt · „Hier“ in Petrol (`C.aktiv`, dieselbe Farbe
  wie „hier stehen wir“ beim Kunden) · ! hängt. Farben nur aus `FORM_FARBE`/Token (`reise/bilder.tsx`).
- **Legende einmal, klein** (`FormenLegende`, `data-formen-legende`) unter dem Fluss — nie je Karte.
- **Rechnen nur in den Modellen:** `lib/fulfillment/prozesse/reise-bild.ts` (`reiseZeile`, `phasenFluss`, Hänger = dieselben Regeln wie `wasHaengt`) und
  beim Kunden `kundenReise` (lib/fulfillment/kunde/bild.ts, nur aus der Positivliste). Die Zeichnung rechnet nichts; die PDFs zeichnen dieselbe Zeile
  (`pdf-bild.ts` `reise`).
- **Wenig und klar:** keine Zahlenwände, keine zweite Darstellung derselben Größe (kein Strahl neben der Reise, keine Lage-Kacheln im Kopf), höchstens
  vier Reiter je Fall, höchstens fünf Unter-Reiter auf der Startseite; alte Adressen leiten in EINER Tabelle um (`ALTE_REITER`, `ALTE_BEREICHE`).
- **Handy (≤ 720 px):** die Reise wird eine senkrechte Liste der Phasen; nur die laufende zeigt ihre Kästchen, die Raute steht als Zeile darunter, ein Band
  nur mit Text (mit eigener Beschriftung); der Fluss bleibt senkrecht, der Nein-Pfad rückt unter die Raute — nichts läuft quer aus dem Bild. Im Kreislauf
  (`laeuft`) zeigt am Handy nur die gewählte Stufe ihre Kästchen; ohne Band entfällt die Band-Zeile.
- Wächter: `tests/fulfillment-miro.test.ts` (vier Reiter, Umleitungen, Kopf ohne Doppel, Legende, ≤ 4 Kästchen, Hänger = Cockpit, Kunden-Reise).
- **Titel in Kästchen, Pillen und Knoten** (17.10. Feinschliff): höchstens zwei Zeilen mit „…“ und dem ganzen Titel im Tooltip (`.ff-titel`/`.ff-reise-text`);
  lange Wörter trennt die Silbentrennung (`hyphens: auto`, die Seite hat `lang="de"`) — nie `overflow-wrap: anywhere` (das brach „Diagnoseberic ht“).
- **Band „Kunde“ mit Satz** (`bandTexte`, lib/fulfillment/prozesse/reise-bild.ts): „wartet: …“ · „beim Kunden: …“ · „Abstimmungspunkt n offen“ — sonst „nichts
  offen beim Kunden“ unter der laufenden Phase. **Lage-Zeile** der Startseite nur mit Zahlen (Kunden in Lieferung, „n Punkte hängen“) — Einzelheiten in der Karte.

### Editor (Prozess-Editor im Miro-Stil, 17.10.)
Rückmeldung 17.10.: „Jeder baut seine Abläufe selbst in der App: Schritte, Nachrichten, Entscheidungen und Erinnerungen per Ziehen anlegen.“ Fulfillment ›
Landkarte › Paket-Vorlage „Bearbeiten“ bzw. „+ Neuer Ablauf“ öffnet `?e=<Ablauf>` (`components/os/fulfillment/editor/*`).
- **Dieselbe Zeichnung wie die Ansicht — kein zweites Darstellungs-Bauteil:** die Reise-Zeile ist `ReiseBild` (mit `griff` auf den Phasen-Pillen, `rauteSchalter`
  zwischen jeder Phase und hinter der letzten, `ende` = „+ Phase“), die Knoten sind `KnotenKnopf` aus `components/os/ui/reise/Fluss.tsx` (mit `editor` und `griff`), dazu `Pfeil` und
  `SeitenPfeil`. Neue Formen/Zustände immer dort, nie im Editor nachbauen.
- **Aufbau (Rechner ≥ 1180 px):** oben die Reise (Phasen ziehen = umsortieren, Raute = Abstimmungspunkt an/aus bzw. bearbeiten), darunter links die Palette
  (Schritt · Nachricht · Entscheidung · Erinnerung · Termin · Baustein — ziehen ODER antippen = nach dem gewählten Knoten bzw. ans Ende der Phase), in der Mitte
  der Fluss der gewählten Phase, rechts das kleine Seitenfeld. 721–1179 px: Palette als wischbare Zeile, Seitenfeld darunter. **Handy (≤ 720 px):** eine
  Liste mit ▲ ▼ statt Ziehen (`EditorListe`), „Hinzufügen“ mit denselben Formen.
- **Entscheidung = Raute mit ja/nein:** „ja“ geht weiter (bzw. zu ihrem Ja-Zweig), der Nein-Zweig steht als Knoten DANEBEN (nicht noch einmal im Strang) —
  typisch eine Erinnerung, die „danach zurück“ zur Entscheidung läuft (oder weitergeht). Freier Nein-Platz: „+ Erinnerung“ (antippen oder Erinnerung
  darauf ziehen). Im Fall gilt „erledigt“ an der Entscheidung als „ja“ — ihr offener Nein-Zweig entfällt dann.
- **Seitenfeld:** Titel (2–6 Wörter, Hinweis außerhalb), Art (die Form), Frist in Tagen (nach dem Schritt davor; im Fall die Fälligkeit), Verantwortung
  (intern · Kunde · beide), für den Kunden sichtbar, Bausteine aus der Bibliothek, Zweige, „Mehr Angaben …“ (das vorhandene Knoten-Formular) — und die
  Tastatur-Alternativen.
- **Bedienung:** Maus/Trackpad ziehen ab 5 px (darunter ein Klick), Finger lange drücken 0,45 s (vorher scrollt die Seite), Escape bricht ab; Ziel = Linie
  (davor/dahinter) bzw. Rahmen, Ungültiges rot mit Satz. Tastatur für alles: ↑/↓ wandert, Alt+↑/↓ verschiebt, Entf löscht, Enter bearbeitet (Titel im
  Seitenfeld), Einfg/+ fügt ein; Phasen ←/→ und Alt+←/→; im Seitenfeld „Nach oben/unten“, „Einfügen nach …“, „Verschieben nach Phase …“. ⌘Z/⇧⌘Z
  (Strg+Z/Strg+Y) = Rückgängig/Wiederholen in der Sitzung. Jedes Ziel ≥ 44 px.
- **Sicher statt endgültig:** Löschen legt in den Papierkorb des Ablaufs (30 Tage, „Zurückholen“ an derselben Stelle, Zweige kommen mit); Phasen und Teilprozesse
  fragen vorher. Endgültig nur „Endgültig löschen“ mit Rückfrage.
- **Rechte:** bearbeiten nur volle Mitglieder; „nur Business“ sieht den Editor ohne Palette und Ziehen (der Server lehnt mit 403 ab).
- **Wirkung:** Änderungen gelten für neue Fälle; laufende zeigen „Vorlage geändert — übernehmen?“ mit Vorschau (neu, geändert, neue Reihenfolge, entfernt) —
  erst der Klick schreibt, erledigte Schritte bleiben erledigt.
- **Ausführung im Fall (17.10. abends):** am gewählten Knoten EINE Karte (`components/os/fulfillment/reise/AblaufKarte.tsx`) — Entscheidung: die Frage mit „Ja“
  (Hauptaktion) und „Nein“, darunter was danach passiert und die Runde („Versuch 2 von 5“), „eskaliert“ als Hinweis-Karte; Nachricht: „Entwurf öffnen“ (Hauptaktion,
  gesendet nur im Fenster per Klick) und „In der Inbox öffnen“; Schritt/Erinnerung: die Aufgabe mit Stand als Link. Ist die Karte die Hauptaktion, verzichtet das
  Schritt-Detail darauf (eine Hauptaktion je Ansicht). Die Reise markiert „hier“ (auch auf dem Nein-Pfad) und „hängt“ (eskaliert = rot); die Kunden-Karten der
  Landkarte sagen „wartet auf …“ mit Frist. Gerechnet nur in `lib/fulfillment/prozesse/ausfuehrung.ts` bzw. `naechsterPunkt`.
- Wächter: `tests/fulfillment-editor-oberflaeche.test.ts` (Palette, Ablage-Stellen, Tastatur, Ziele ≥ 44 px, Handy-Liste, nur ansehen, EIN Bauteil),
  `tests/fulfillment-editor-modell.test.ts`, `tests/fulfillment-editor-route.test.ts`, `tests/fulfillment-editor-update.test.ts`, `tests/fulfillment-feinschliff.test.ts`.

### Fläche (Prozess-Editor › frei zeichnen wie in Miro, 17.10.)
Rückmeldung 17.10.: „Zeichnen wie in Miro: freie Fläche, Kästen frei platzieren, Pfeile ziehen, zoomen und schieben, Rahmen für Phasen.“ Im Editor der Umschalter
„Fluss · Fläche“ (`components/os/fulfillment/editor/Flaeche.tsx`); beide Ansichten schreiben über denselben Weg — der Wechsel verliert nichts.
- **EINE Wahrheit:** die Fläche zeigt dieselbe Vorlage. Lage (`pos`) und Pfeil-Texte (`pfeilText`) sind optional; **Pfeile = Reihenfolge + Zweige** (keine zweite
  Verbindungsliste). Regel „Reihenfolge aus Pfeilen“: topologisch (`reiheAusPfeilen`, lib/fulfillment/prozesse/flaeche.ts) — ein neuer Pfeil A → B hängt B direkt
  hinter A ein (nur vorwärts; zurück = Kreis, nur Erinnerung → Entscheidung), an einer Entscheidung ist er „ja“ oder „nein“. **Reihenfolge der Phasen = Reise-Zeile**;
  auf der Fläche stehen die Rahmen von links nach rechts in dieser Reihe (vorbeigezogen = umgestellt, sonst rücken sie nach — `rahmenOrdnen`).
- **Ohne Lage automatisch** (lib/fulfillment/prozesse/flaeche-lage.ts): Rahmen nebeneinander (wie die Kundenjourney), darin Start, Schritte untereinander, Nein-Zweig
  rechts neben seiner Entscheidung, Abstimmungspunkt am Ende; ein Rahmen ist nie kleiner als sein Inhalt. Rechnen nur dort und in `flaeche.ts` (gewinkelte Wege mit
  Ausweichen, `pfeilWeg`) — die Zeichnung rechnet nichts.
- **Formen** als SVG an EINER Stelle: `components/os/ui/reise/flaeche-formen.tsx` (`FlaecheForm`, `FlaecheStart`, `FlaecheRahmen`, `FlaecheGruppe`, `FlaechePfeil`,
  `FlaecheSpitze`, `FlaecheLegende`) — dieselben Formen und Farben wie der Fluss (`FORM_FARBE`), Schrift ≥ 13 (wächst beim Zoomen), Rahmen = Phase („PHASE n“ + Titel,
  „INTERN“, wenn der Kunde sie nicht sieht), gestrichelt = Gruppe bzw. Schleife zurück. Neue Formen dort, nie im Bereich.
- **Zoom und Schieben** (`components/os/ui/flaeche/{kamera,eingabe}.ts`, Rad-/Pinch-Erkennung der Brain-Kugel): Pinch bzw. ⌘/Strg + Scrollen zum Zeiger (15–250 %),
  zwei Finger bzw. Leertaste + Ziehen (auch mittlere Maustaste) schiebt; Lauscher NUR am SVG (Rad, Geste, Touch `passive: false`), ein Mausrad ohne ⌘ lässt die Seite
  rollen (+ kurzer Hinweis). Knöpfe − / + / „Alles zeigen“ / „Zurücksetzen“, Raster mit Einrasten (20 px, abschaltbar, je Browser gemerkt).
- **Bearbeiten:** Palette ziehen oder antippen (Start · Phase = neuer Rahmen), Knoten verschieben (in einen anderen Rahmen = andere Phase), Aufziehen/⇧-Klick/⌘A,
  ⌘C/⌘V, Entf (Papierkorb), Doppelklick bzw. Enter = Text direkt am Knoten/Rahmen/Pfeil; Anfasser an vier Seiten → Pfeil ziehen; Rahmen am Titel verschieben, an der
  Ecke unten rechts größer/kleiner. Tastatur: Tab wandert durch die Knoten, Pfeiltasten verschieben (⇧ = weiter), + − 0 1 zoomen, „Verbinden mit …“ als Menü. Ziele
  ≥ 44 px (Anfasser-Trefferkreis r = 22, Größen-Ecke 44 × 44). Bei reduzierter Bewegung springt die Kamera ohne Animation.
- **Leistung:** keine React-Zustände je Mausbewegung — Kamera und Ziehen in Refs, gezeichnet per `requestAnimationFrame` direkt am SVG; beim Ziehen werden nur die
  betroffenen Pfeile neu gelegt. Bis ~300 Knoten flüssig (Wächter misst das Bild).
- **Handy:** Fläche nur ansehen (ein Finger rollt die Seite, zwei Finger zoomen/schieben, Tipp zeigt den Knoten + „In der Liste bearbeiten ›“); bearbeitet wird in der Liste.
- **Als Bild speichern:** PNG oder SVG — nur die Fläche mit Titel und Legende, ohne Auswahl/Anfasser (`flaeche-export.ts`; entsteht im Browser).
- Wächter: `tests/fulfillment-flaeche-modell.test.ts` (Ableitung, Auto-Layout, Kreise/Zweige, Grenzen/Stand, Fluss ↔ Fläche, Rückgängig, Update-Probe),
  `tests/fulfillment-flaeche-oberflaeche.test.ts` (Eingabe nur am SVG, Kamera, Ziele ≥ 44 px, Handy, nur ansehen, keine Zustände je Bewegung).
