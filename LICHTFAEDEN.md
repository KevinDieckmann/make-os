# Lichtfäden v2 — alle Stränge, eine Sicht auf den Fokus

Kevin (03.10.2026): „Das ist ein Werkzeug, was nachher Fokus anzeigt, weil extrem viele Stränge zusammenlaufen in der
Planung. Alle Stränge sollen nachher darein laufen, damit man so effizient wie möglich ist. Es gibt es auf jeder Ebene und
nachher übergreifend für alles.“ — „Alles läuft immer auf das größte Ziel zusammen.“ — „Business und Privat laufen zusammen
in einem großen Strang. Dann in Privat alle Themen wie Gesundheit, Planung, Finanzen, Beziehung, und jeweils in den Themen
gibt es wieder extrem viele Stränge.“

Darstellung und Regeln für die Oberfläche: `DESIGN_STANDARD.md` › „Lichtfäden“. Dieses Dokument beschreibt die Technik.

## Architektur in einem Bild

```
Bestände (Planung, Kalender, CRM, Finanzen, Familie, Gesundheit)
   │  vorhandene Lesefunktionen, nur lesen          lib/lichtfaeden/sammeln-server.ts
   ▼
Quellen-Adapter (rein, je Bereich eine Datei)      lib/lichtfaeden/quellen/*.ts   →  Strang[] (+ Knoten der Planung)
   │  Personen-/Privat-Regel für den Betrachter     modell.ts  fuerBetrachter
   ▼
Baum gesamt → space → thema → ziel → meilenstein    baum.ts    baueBaum
   │  Ansicht = Wurzel + Zeitraum + Person          baum.ts    rechneAnsicht (Bündel, Dichte, Fäden, Markierungen)
   │  Engstellen                                    fokus.ts   engstellen
   ▼
GET /api/lichtfaeden  (Haushalts-Tor, gemerkt)     app/api/lichtfaeden/route.ts
   ▼
<Lichtfaeden wurzel=…/>  (Karte: Brotkrumen, Person, Zeitraum, Band, Legende, Engstellen)   components/os/lichtfaeden/
   └─ <Faedenband/> → faedenband.ts (Canvas 2D) → band.ts + zeichnen.ts (dieselben Dateien wie die Website)
```

1. **Modell** (`lib/lichtfaeden/modell.ts`): Ein **Strang** ist EIN Ding, das Zeit oder Aufmerksamkeit bindet — `{ id, quelle,
   titel, pfad, person, zeit, gewicht, status, link?, privat? }`. `pfad` sind Knoten-Kennungen von oben nach unten
   (`['gesamt','space:privat','thema:privat:gesundheit','ziel:z-1','ms:m-4']`). Ein **Knoten** ist eine Ebene mit Name und Farbe.
2. **Quellen-Adapter** (`lib/lichtfaeden/quellen/*.ts`): je Bereich eine reine Funktion `(daten) => Strang[]`, ohne Server-Importe,
   getestet mit erfundenen Daten (`tests/lichtfaeden-quelle-*.test.ts`). Der Server (`sammeln-server.ts`) lädt nur und reicht durch.
3. **Baum & Dichte** (`baum.ts`): sammelt die Stränge an ihren Knoten, rechnet je Bündel und Woche die Dichte (Gauß σ = 2 Wochen,
   gesättigt je Ansicht) und liefert für eine Ansicht die Bündel — **LOD**: oben wenige dicke Bündel, unten viele feine Fäden
   (an einem Meilenstein ist jeder Strang ein Faden).
4. **Engstellen** (`fokus.ts`): Wochen ab heute, in denen die Last deutlich über dem eigenen Mittel liegt oder viele Bündel
   zugleich fällig sind — „KW 44: 3 Ziele · 9 Fristen · 4 Termine“ mit den schwersten Strängen dahinter.
5. **Route** (`GET /api/lichtfaeden`): Haushalts-Tor, Person aus der Sitzung, Privat-Regel, gemerkt, gzip.
6. **Ein Zeichner, eine Komponente** (`faedenband.ts`, `components/os/lichtfaeden/Lichtfaeden.tsx`): Tippen auf ein Bündel = eine
   Ebene tiefer (die Kinder fächern aus ihm auf), Brotkrume = zurück (sie fließen zusammen).

## Der Baum

| Ebene | Kennung | Name / Farbe |
|---|---|---|
| Gesamt | `gesamt` | „Gesamt“ |
| Space | `space:business`, `space:privat` | Business orange, Privat grün (= erstes Ziel-Bündel; Gelb gehört den Engstellen) |
| Thema | `thema:<space>:<thema>` | Privat: Ziele & Planung · Gesundheit · Familie & Beziehung · Finanzen; Business: Ziele & Planung · Markttraktion · Mandate · Finanzen (`THEMEN`) |
| Ziel | `ziel:<id>` | Titel; Farbe je Space in Rang-Reihenfolge aus `FADEN_FARBEN` — gerechnet NUR vom Server über ALLE Ziele des Haushalts (`lib/planung/ziel-farben-server.ts`), dieselbe wie an Ziel-Chips und Ziel-Bezug (Feld `farbe` in `GET /api/state/ziele`) |
| Meilenstein | `ms:<id>` | Titel; Farbe = Ziel-Farbe leicht abgestuft |

Was keinem Ziel gehört, hängt am Thema und erscheint dort als Bündel „Ohne Ziel“ (am Ziel: „Ohne Meilenstein“). Mehr als
7 Bündel → die schwersten bleiben, der Rest fließt in „Weitere (n)“ (Blatt-Ebene: 24). Fäden je Bündel ∝ √Last (3 … 26),
höchstens 160 je Leinwand (Handy 80).

**Ziel → Thema** (es gibt kein Thema-Feld am Ziel): Mandat/Firma am Ziel → Mandate (Business); ein Gesundheits-Meilenstein
(`bereich: 'gesundheit'`) → Gesundheit (Privat); sonst Ziele & Planung. Ziele ohne Space gelten als Business. Je EINE Regel in
`modell.ts`: `zielThema`, `meilensteinThema`, `spaceVonZiel`, `zielWurzeln` — dieselben nutzt der Ziel-Bezug der Seiten
(`lib/make-one/ziel-bezug.ts`, „zahlt ein auf“ nur aus dieser Zuordnung, keine Stichworte). Wächter `tests/ziele-eine-quelle.test.ts`.
Abgeleitete Ziele (Kaskade, auch „angepasst“) werden kein eigener Knoten, ihre Meilensteine laufen in das Jahresziel; die Route
rechnet `ziel:<abgeleitet>` auf das Jahresziel um (`wurzelAufloesen`, nur dort).

## Quellen und Gewichte

Die Tabelle steht EINMAL im Code: `QUELLEN` in `modell.ts` (Faktoren `FAKTOR`). Erledigtes zählt als leise Spur (× ⅓),
ein überfälliger offener Strang zählt in der Woche von HEUTE (er bindet jetzt), eine Spanne in jeder berührten Woche (≤ 12).

| Quelle | Gewicht | Art | Markierung | Woher (Adapter) | Pfad |
|---|---|---|---|---|---|
| Ziel-Frist | 3 | Frist | ◎ ja | `planung.ts` — nur ohne Kaskaden-Meilenstein | Ziel |
| Meilenstein | 3 (erledigt 1) | Frist | ◇ ja | `planung.ts` | Ziel › Meilenstein (ohne Ziel: Thema) |
| Aufgabe | 1 (dringend 1,5) | Frist | – | `planung.ts` — offen, mit Datum; „nur ich“ = privat | Meilenstein über die Liste, sonst Thema |
| Projekt-Ende | 2 | Frist | ▣ ja | `planung.ts` — offen, nicht archiviert | Thema |
| Termin | 0,5 (lang 1) | Termin | – | `kalender.ts` — ohne Fokus/Planen-Blöcke, Arbeitsort, Abgesagtes | Thema nach Bezug/Gesundheit |
| Belegt | 0,5 | Termin | – | anonymisierter privater Strang der anderen Person | Space |
| Follow-up | 1 | Frist | – | `markttraktion.ts` (`faellige`, echte + abgeleitete) | Markttraktion bzw. Ziel mit gleicher Firma/Mandat |
| Deal-Abschluss | 2 | Frist | – | `markttraktion.ts` — offene Deals, `erwartetAm` | dto. |
| Event | 2 | Termin | ✦ ja | `markttraktion.ts` — geplant/Einladung/durchgeführt | dto. |
| Zahlung | 1 | Frist | – | `finanzen.ts` — Finanzplan, Finanzplanung jetzt, Haushalts-Belege | Finanzen des Space der Einheit |
| Rechnung | 1,5 | Frist | – | `finanzen.ts` — gestellt (Eingang), geplant (stellen) | Finanzen bzw. Ziel mit gleichem Mandat |
| Frist (Steuer) | 2,5 | Frist | ▣ ja | `finanzen.ts` — lib/steuern, −30 … +365 Tage | Finanzen |
| Wichtiger Tag | 1 | Termin | ♥ ja | `beziehung.ts` — Geburtstage (Familie), Jahrestage | Familie & Beziehung |
| Date | 1,5 | Termin | – | `beziehung.ts` | Familie & Beziehung |
| Vereinbarung | 1 | Frist | – | `beziehung.ts` | Familie & Beziehung |
| Routine | 0,5 | Termin | – | `gesundheit.ts` — ab wöchentlich, mit `naechstesMal` | Gesundheit / Ziele & Planung |
| Wettkampf | 2,5 | Termin | ◆ ja | `gesundheit.ts` — Sport-Ziele mit Datum (privat) | Gesundheit |

Nicht angeschlossen (bewusst): Liquiditäts-Planposten (wiederkehrende Prognose, keine Handlung), tägliche Routinen
(gleichmäßiges Rauschen), Fokus- und Planen-Blöcke im Kalender (sie sind die geplante Arbeit an Aufgaben — sonst doppelt).

## Personen- und Privat-Regel

- Jede Ansicht zeigt die Stränge einer Person (+ was beiden gehört) oder alle („Ich · Partner/in · Beide“).
- **Privat** sind: private Kalendertermine und Gesundheitstermine einer Person, „nur ich“-Aufgaben SAMT allen Unteraufgaben
  darunter (dieselbe Kette wie `darfSehen`: `nurIchBesitzer` in `lib/aufgaben/sicht.ts` — „nur ich“ ohne bestimmbare Anlegerin
  sieht niemand, der Strang fällt weg), „nur ich“-Einträge der Familie (Tage, Dates, Vereinbarungen), Gesundheit (terminierte
  Routinen einer Person, Sport-Ziele). Für die ANDERE Person werden sie in `fuerBetrachter`
  zu einem anonymen „belegt“-Gewicht: Titel „Belegt“, kein Link, Pfad nur bis zum Space (kein Thema, kein Ziel), verdeckte
  Kennung. Die Last bleibt sichtbar (Fokus!), der Inhalt nicht. Der Kalender maskiert zusätzlich schon an der Quelle
  (`termineFuerZoe`), „nur ich“ der Familie filtert `sichtFuer`.
- **Eigene Ziele** (`ziele-eigen--<person>`) gehören ihrer Person: ihr Knoten (und die Knoten ihrer Meilensteine) tragen
  `person` und fallen für die andere Person weg (`knotenFuerBetrachter`); Ziel-Frist und Meilensteine sind privat und kommen
  dort nur als „Belegt“ an (Praxis-Fund 04.10.). `ziel:<eigenes Ziel der anderen>` antwortet 404.
- Finanzen und gemeinsame Ziele gehören dem Haushalt (beide haben vollen Zugriff).

## Route

`GET /api/lichtfaeden?wurzel=…&person=ich|alle|<speicher>&von=YYYY-MM-DD&bis=YYYY-MM-DD` → `{ ok, heute, sicht, personen,
ansicht, engstellen, text }`. Zugang `imHaushaltDesInhabers` (Sitzung); der **Dienstweg ist gesperrt** (403) — kein Hintergrundlauf
braucht die Sicht heute (ZOE liest die Quellen über ihre eigenen Werkzeuge). Gesammelt wird je Betrachter und Fenster über
`merken` (60 s, ungültig bei jeder Schreibung in einen Bestand; Kalender-Abgleiche sind „Rauschen“ — dort greift nur die Zeit),
die Ansicht ist reine Rechnung (≈ 1 ms). Kein neuer Bestand (nichts im Speicher-Register), keine Personendaten in Logs.
`heute` der Antwort ist DER Tag der Oberfläche (Engstellen-Überschrift, HEUTE-Linie). Ein Ebenen-Übergang gehört zu genau einer
Antwort (Schlüssel Ebene|Person|Zeitraum, `lichtSchluessel`) und wird nach dem Abspielen verworfen.

## Wo man es sieht

- **Planung › Jahr** (`HorizontView`): Wurzel = der gewählte Space (Alle → Gesamt). Blättern, Heute, Zeitraum, „+ Meilenstein“
  und Anlegen per Klick auf eine freie Stelle bleiben.
- **Ziel-Seite** (`ZielDetail`): Wurzel = das Ziel (immer die eigene Kennung; abgeleitete Ziele zeigt die Route als ihr Jahresziel).
- **Meilenstein-Seite** (`MeilensteinDetail`): Wurzel = der Meilenstein — jeder Strang ein Faden.
- **Fokus** (`/os/fokus`, Kachel „Lichtfäden“): Wurzel = Gesamt, zuerst die eigenen Stränge, Engstellen.

## Eine neue Quelle anschließen — Schritt für Schritt

1. **Gewicht festlegen:** in `modell.ts` die Quelle zu `StrangQuelle` hinzufügen und eine Zeile in `QUELLEN` (Gewicht, `art`
   Frist/Termin, `marke`, Name, Symbol). Die Tabelle oben ergänzen.
2. **Adapter schreiben:** `lib/lichtfaeden/quellen/<bereich>.ts` — eine reine Funktion `(daten) => Strang[]`, die Eingangs-Typen
   schmal und eigen (nur die Felder, die gebraucht werden; keine Server-Importe). Je Strang: `id` = `<quelle>:<kennung>`
   (eindeutig), `pfad` über `themaPfad(space, thema)` bzw. einen Ziel-Pfad aus `ZielBezuege`, `person` (Speichername oder
   `BEIDE`), `zeit.tag` (+ `bis` bei Spannen), `gewicht` über `gewichtVon`, `status` über `statusVon`, `link` über `WEG`,
   `privat: true`, wenn die andere Person den Inhalt nicht sehen darf.
3. **Test schreiben:** `tests/lichtfaeden-quelle-<bereich>.test.ts` mit erfundenen Daten — Pfad, Person, Status, Gewicht,
   Privat, was NICHT zählt.
4. **Anschließen:** in `sammeln-server.ts` eine Funktion, die mit den vorhandenen Lesefunktionen lädt (nie eine Kopie, nie ein
   Netzaufruf, Kartei nur über `kontakteFuerVerarbeitung`), normalisiert und den Adapter ruft; in `straengeSammeln` in die
   Liste `teile` aufnehmen (mit `sicher()` — eine fehlende Quelle fehlt einfach). Liest sie einen neuen Bestand, prüft
   `tests/datenschutz-register.test.ts` das Speicher-Register.
5. **Prüfen:** `npx vitest run tests/lichtfaeden` (Route-Test: Privat-Regel), dann einmal in der Sandbox ansehen.

## Zeichner

`faedenband.ts` (`faedenband(canvas, beobachte, ruhig)` → `setze(bild, übergang?)`, `treffer(x, y)`, `fortschritt()`): Leitkurven
und Fäden aus `band.ts`, Striche gebündelt aus `zeichnen.ts` (Path2D-Eimer, additiv). Übergang 720 ms (`UEBERGANG_MS`,
sanftes Ein-/Ausschwingen); bei „Bewegung reduzieren“ kein Übergang und keine Eigenbewegung (Standbild). Der Lauf pausiert
außerhalb des Bildes und im verborgenen Tab. Die Websites nutzen die Lichtfäden seit „Klar 2“ (07.10., Kevin: „keine Spielereien“) nicht
mehr — die übersetzte Kopie `website/js/lichtfaeden.js` und `scripts/lichtfaeden-website.mjs` sind entfernt (Wächter `tests/lichtfaeden.test.ts`). Der Messpunkt am Band (`data-bilder`, `data-mittel-ms` …) läuft nur außerhalb der Produktion oder
mit `data-messen` an der Seite.

## Strahl v3 (04.10.) und FadenLinie

Kevin: „Der Strahl läuft im Grunde genommen immer von links nach rechts — guck dir den Verlauf an.“
- **band.ts:** `versatz` und `buendelMitte` wandern in Zeitrichtung (sin(k·s − ω·t)), `fadenSaaten` immer mit positivem Tempo (dieselben Lagen wie
  vorher), neu `fransen` (Ausfransen) und die Parameter `aufbau`, `aufbauVerzug`, `aufbauSpitze`, `punkte`, `frans`, `glanz`.
- **zeichnen.ts:** `Probe.frans` (0 … 1) und `Probe.hub` (Ausschlag an einer Spitze), `BuendelStil.front` (Aufbau, die Spitze leuchtet) und `punkte`
  (Partikel, ein Path2D je Deckkraft-Stufe, ein `fill`), `glanzPuffer()` (Glühen: verkleinert + weichgezeichnet additiv zurück), `zeichneNetz` (Netz-Motiv),
  `starteLauf({ intervall })` (Mindestabstand der Bilder für kleine Leinwände).
- **baum.ts:** `Buendel.spitze` je Woche = gesättigte UNgeglättete Last hoch `SPITZE_EXPONENT` (1,6) — die scharfen Ausschläge; Fäden-Deckel 300/120.
- **faedenband.ts:** Aufbau (`aufbau()` für Prüfungen, Messpunkt `data-aufbau`), `fransBei` (ab HEUTE), `spitzeRichtung` (meist nach oben), `wocheBei`
  (linear, mit Vorzeichen), Hilfslinien, Mittellinie, Netz, Glühen.
- **v3.1 (größeres Band):** `BAND_MASSE` 300/220 px mit `abstand` zur Markierungszone, `BAND_FORM` (Spreizung höchstens 72 % der halben Höhe,
  Spitzen 0,86/0,7), `SPREIZ_EXPONENT` 1,35 (ruhig eng, voll voluminös), `randBei` (weiche Grenze der Leitkurve), `SPITZE_SCHWELLE` 0,3.
- **fadenlinie.ts (FadenLinie, Mini-Strahl):** `fadenLinienProben` (rein: Leitkurve aus normalisierten Werten, Normale aus der Steigung, Spreizung/Helligkeit
  aus dem Wert, Ausfransen ab `heute`), `fadenlinie(canvas, beobachte, ruhig)` mit 12 Fäden (Handy 8), ~30 Bilder je Sekunde, Aufbau 1,4 s.
- **reihen.ts:** `jeTag`, `jeWoche`, `summeJeMonat`, `summeJeTagZurueck`, `normalisiere`, `reiheGueltig`, `reiheText` + Beschriftungen — rein, `heute` vom Aufrufer.
- (Bis 06.10. bekam die Website dieselbe Fließrichtung über eine übersetzte Kopie — seit „Klar 2“, 07.10., tragen die Websites keine Lichtfäden mehr.)

## Strahl ruhig (04.10. abends) — gegliederte Stränge, Ausschlag nur bei Abweichung

Kevin: „Oben die Symbole genial, aber das sieht zu spacig aus.“ — „Gliedere einfach mehr. Die einzelnen Farben von den einzelnen Themen
müssen immer gebündelt sein und zusammenlaufen. Es darf nur ausgeschlagen werden, wenn etwas Unvorhergesehenes kommt oder etwas
schiefgelaufen ist. Ziel ist, dass alle Linien immer ruhig laufen — nach Ziel, Plan und Meilenstein.“ Löst Strahl v3/v3.1 (oben) im
Planungsband ab; FadenLinie und Website bleiben unverändert.
- **`strahl.ts` (rein, alle Parameter in `STRAHL`, eine Stelle):** Band 200/150 px (v3.1: 300/220), Fäden je Strang 3 … 8 (Blatt 1 … 3), höchstens
  56 je Leinwand (Handy 32; v3: 300/120), Deckkraft 0,17 normal gemischt (keine additiven Mischtöne), Strich 0,6, Kern 0,05, Strangbreite 1,2 … 3,2 px,
  Spuren höchstens 22 px (Handy 16) auseinander, ab HEUTE Zusammenlauf auf 35 % am rechten Rand (zum großen Ziel), Ausschlag bei Abweichung 1:
  34 px (Handy 24) nach außen, Strang fächert dort bis × 2,4, Fließen × 0,5. Geometrie: `spurAbstand`, `zusammenlauf`, `spurVersatz`,
  `strangMitte`, `strangBreite`, `wocheWeich` (Smoothstep zwischen Wochen — kein Zacken), `strahlHell` (kein Lichtschnitt am HEUTE-Punkt).
- **`abweichung.ts` (rein):** `Abweichung { id, art, pfad, person, von, bis?, staerke 0…1, verlauf 'anstieg'|'gleich', titel, strang?, privat? }`,
  Arten `ueberfaellig · verschoben · frist-gerissen · ziel-gekippt · ueberlastet · ungeplant`. Aus den Strängen (`abweichungenAusStraengen`):
  offener Meilenstein überfällig (1), Ziel-Frist überschritten (1), Steuerfrist (1), Projekt-Ende (0,6), gestellte Rechnung (0,5) — Aufgaben,
  Termine, Follow-ups, „Belegt“ nie. Stärke `abweichungsStaerke(Tage, Gewicht)` = Gewicht · (1 − 2^(−Tage/14)); `ausschlagJeWoche`: steigt von
  `von` bis `bis` an, klingt in 14 Tagen aus, mehrere = 1 − Π(1 − v). Privat-Regel `abweichungFuerBetrachter` (private der anderen Person:
  Titel „Belegt“, nur bis zum Space, kein Strang).
- **Schnittstelle für weitere Quellen:** `AbweichungsQuelle = (k: { heute, von, bis, straenge }) => Abweichung[]` (rein). Lader in
  `abweichung-quellen-server.ts` (`LADER`), die Route sammelt mit `abweichungenSammeln(k, betrachter, quellen)` (gekapselt, ungültige fallen weg).
  Angedockt: Deal-Entscheidung ≥ 2× verschoben (`dealsVerschoben`, Art `verschoben`, Gewicht 0,6). **Kapazität „überlastet“** dockt genauso an:
  reine Funktion → Abweichungen (Art `ueberlastet`, Pfad bis Space/Ziel, Woche als von/bis, `verlauf: 'gleich'`, Stärke = Überlast) + Zeile in `LADER`.
  Ohne Datengrundlage: `verschoben` für Meilensteine (kein ursprünglicher Termin gespeichert), `ungeplant`.
- **`baum.ts`:** `Buendel.ausschlag` je Woche (ersetzt `spitze`), `Ansicht.abweichungen` (Text, schwerste zuerst, höchstens 8), `AnsichtOptionen.abweichungen`;
  ein Thema trägt die Farbe seines ersten Ziels (`zielFarben`, Server) — „Farben nur je Ziel“; Blatt-Ebene höchstens 12 Spuren.
- **Zeichner/Oberfläche:** keine Partikel, kein Glühen, kein Netz, keine Hilfs-/Mittellinie, kein Puls-Punkt und kein Schein am HEUTE-Punkt (eine
  ruhige 1-px-Linie); Aufbau von links ohne leuchtende Spitze; Marker mit Stiel laufen weiter in ihren Strang. Unter der Legende ein Satz:
  „Alle Stränge laufen ruhig — im Plan.“ bzw. „Ausschlag = Abweichung vom Plan“ mit den Gründen.
- **Website:** (bis 06.10.) `scripts/lichtfaeden-website.mjs` übersetzte nur `band.ts` + `zeichnen.ts`; seit „Klar 2“ (07.10.) tragen die
  Websites keine Lichtfäden mehr (`strahl.ts`/`abweichung.ts` gehören ohnehin nur der App).
- Wächter: `tests/strahl-ruhig.test.ts` (Höchstwerte, glatt ohne Abweichung, Spuren, Zusammenlauf, Ausschlag nur aus Abweichungen, Privat-Regel,
  angedockte Quelle, Deal verschoben, Zeichner ohne `lighter`/Partikel/Weichzeichner/Radialschein, Website-Quellen).

## Seil (07.10.) — Stränge, die ineinandergreifen

Kevin (07.10.): „Der Zeitstrahl muss in der Software auch noch viel besser gemacht werden. Die einzelnen Strahle sind nicht
wirklich sichtbar. Am Ende müssen sie irgendwo alle ineinander greifen, wie ein Kabel oder ein Seil. Erst dann kommt Fokus und
Momentum … Es braucht einfach Effekte. Die Karten und Ziele brauchen Abhängigkeiten.“ — „Verbindungen fehlen.“ Leitplanke
bleibt 80/20: Effekte nur mit Bedeutung (Verknüpfung, Fortschritt, Zusammenlauf), keine Spielereien.

Befund: Das Planungsjahr zeigt Bündel je Space › Thema › Ziel als je EINEN ruhigen Strang aus 3–8 Fäden mit Deckkraft 0,17 —
ohne Fortschritt, ohne Abhängigkeiten, Ziele laufen nicht sichtbar zusammen. Der Aufgaben-Zeitstrahl (`/os/aufgaben/board`,
Ansicht „Zeitstrahl“) ist eine Karte je Thema mit Pillen — ohne Bezug zu Zielen, ohne „wartet auf“. Die Bezüge selbst gibt es
großteils schon (siehe Tabelle), sie wurden nur nirgends gezeichnet.

### Datenmodell — additiv, je Bezug EINE Quelle

| Bezug | Feld | Bestand | Stand |
|---|---|---|---|
| Aufgabe wartet auf Aufgabe | `Task.abhaengigVon[]` (≤ 200) | `tasks` | vorhanden (28.09.) |
| Aufgabe gehört zu Meilenstein | Liste `lm-<ms>` (kein Feld) | `tasks` | vorhanden (30.09.) |
| **Aufgabe zahlt ein auf Ziel** | `Task.zielId` | `tasks` | **neu** |
| **Projekt zahlt ein auf Ziel** | `Project.zielId` | `tasks` | **neu** |
| Meilenstein wartet auf Meilenstein | `Meilenstein.wartetAuf[]` (≤ 10) | `meilensteine` | vorhanden (01.10.) |
| Meilenstein zahlt ein auf Ziel | `Meilenstein.zielId` | `meilensteine` | vorhanden (30.09.) |
| **Ziel zahlt ein auf Oberziel** | `Ziel.oberzielId` | `ziele` (geteilt) | **neu** |
| Kaskade (abgeleitet) | `Ziel.abgeleitetVon` | `ziele` | vorhanden, bleibt automatisch |

- **Wirksames Ziel einer Aufgabe** — EINE Regel `zielVonAufgabe` (lib/aufgaben/ziel-bezug.ts), alle Leser nur darüber:
  1. Liste eines Meilensteins → dessen Ziel · 2. eigenes `zielId` · 3. nächster Vorfahre mit Ziel (Unteraufgaben erben) ·
  4. `Project.zielId`. Ein unbekanntes oder gelöschtes Ziel ist kein Ziel. Gespeichert wird nur, was jemand ausdrücklich wählt.
- **Wurzel eines Ziels im Seil:** `oberzielId` (von Hand, Kette bis oben) bzw. `abgeleitetVon` (Kaskade → Jahresziel) —
  `seilWurzel` (lib/planung/bezuege.ts), kreisfest. Die Lichtfäden-Regel `zielWurzeln` (nur Kaskade) bleibt unverändert.
- Neue Felder nur im Schreibweg gesäubert (`taskSauber`, `projektSauber`, `sauberZiel`), alles optional. **Rückweg:** der alte
  Stand verwirft `zielId`/`oberzielId` beim nächsten Speichern genau dieses Eintrags (UPDATES.md 07.10.); nichts anderes geht verloren.

### Regeln — serverseitig, nur NEU gesetzte Bezüge (ein alter Verweis blockiert keine andere Änderung)

- **Kreise:** Ziel-Kette (`oberzielId` + `abgeleitetVon`) → 409; Aufgaben (`kreisBei`, vorhanden) → 409; Meilensteine
  (`kettePruefen`, vorhanden) → 409. Ziel-Kette höchstens 8 Ebenen (`ZIEL_KETTE_MAX`).
- **Bereiche getrennt:** Bezüge nur innerhalb eines Bereichs — Privat ↔ Privat, Business ↔ Business (Aufgabe: `bereichVonSpace`,
  Ziel/Meilenstein: `wirksamerSpace`). Ein Ziel ohne Space ist gemeinsam und passt zu beiden. Sonst 400 „Bereiche bleiben getrennt“.
- **„nur ich“:** Eine für den Haushalt sichtbare Aufgabe wartet nie auf eine „nur ich“-Aufgabe (ihr Titel stünde sonst bei der
  anderen Person) → 400. „Nur ich“ auf die eigene „nur ich“ geht.
- **Existenz:** `zielId`/`oberzielId` nennen ein Ziel des geteilten Bestands (alle Horizonte, nicht archiviert) → sonst 400.
- **Löschen räumt auf:** Ziel gelöscht → `oberzielId` der anderen Ziele, `Meilenstein.zielId` (vorhanden), `Task.zielId`,
  `Project.zielId` werden im selben Durchgang gelöst; die Antwort nennt die Kennungen (`bezuegeGeloest`). „Rückgängig“ legt das Ziel
  wieder an und setzt die Bezüge über `POST /api/planung/bezuege` zurück — nur dort, wo das Feld noch leer ist. Aufgabe im Papierkorb
  blockiert niemanden mehr (das Seil zählt sie nicht), endgültig gelöscht → `abhaengigVon` geräumt (vorhanden). Meilenstein gelöscht
  → `wartetAuf` geräumt (vorhanden).
- **Bedienung:** Aufgabe (Detail) „Wartet auf …“ und „Zahlt ein auf …“ per Suche, Projekt (Projektseite) „Zahlt ein auf …“, Ziel
  (Ziel-Seite) „Zahlt ein auf …“, Meilenstein (Fenster, vorhanden) — Kandidaten nur aus dem eigenen Bereich, ohne Kreise; setzen
  und lösen mit „Rückgängig“ (10 s, `useHandlung().verknuepfen` bzw. `useRueckgaengig`).
- **ZOE schlägt nur vor:** Werkzeug `verknuepfe` (Register: freigabepflichtig → Stapel). Erst der Klick schreibt — über denselben
  Schreibweg mit denselben Prüfungen.

### Das Bild

```
 ◎ Umsatz 2027 · 62 % · 3 von 5 Strängen fertig                                   (Fokus: Ziel antippen)
   Vertrag ━━━━━━━━━━━━━━━━━━━━━━━●╮
   Website ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
   Launch  ┄┄🔒┄┄┄┄┄┄┄┄━━━━━━━━──────────────────── ╲         (wartet auf „Vertrag“ — unterbrochen, gedämpft)
   Team    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━────────────╲
                                   ╰╮ ╰╮               ╲ ╲
                                    ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈▶ ◎  (Seil: je erledigter Faser dichter/heller)
        ‿ ‿  Abhängigkeiten als ruhige Kurven zwischen Karten/Meilensteinen;   ○ Termin  € Deal  ◇ Meilenstein  am Strang
```

- **Strang** = Meilenstein, Unterziel, Projekt mit Ziel, „lose Karten“ eines Ziels (Jahr) bzw. Projekt/Meilenstein-Liste
  (Aufgaben). Eigene Spur, Ziel-Farbe (vom Server), Röhre mit Kontur; erledigter Anteil gefüllt, offener Rest nur Kontur.
  Beschriftung in einer festen **Spalte links (wie ein Gantt)**, je Spur eine Zeile — siehe „Beschriftungs-Spalte“. Karten als Punkte
  am Strang (erledigt gefüllt, offen Ring).
- **Einmündung:** Am Ende eines Strangs (frühestens HEUTE, spätestens am Anker) biegt er in einer S-Kurve ins Seil seines Ziels.
- **Seil** = je Ziel die eingemündeten Stränge als verdrillte Fasern bis zum Anker (Ziel-Frist, sonst Fensterende ▶). Je mehr
  erledigt ist, desto dichter und heller das Seil (Momentum), je mehr in den letzten 14 Tagen erledigt wurde, desto straffer der
  Drall (Schwung). Unterziele münden als Faser ins Seil ihres Oberziels.
- **Blockiert:** gestrichelt und gedämpft bis zum Ende des Vorgängers, Schloss an der Stelle; Zeigen/Fokus nennt den Grund.
- **Abhängigkeiten** als ruhige Bézier-Kurven vom Vorgänger zum Nachfolger (offen in Achtung-Gelb, erfüllt leise grau).
- **Fokus-Modus:** Ziel antippen → nur seine Stränge, Karten und Abhängigkeiten voll, alles andere zurückgenommen (25 %); der
  **kritische Pfad** (längste Kette offener Abhängigkeiten bis zum Ziel) kräftig nachgezogen und als Text genannt, dazu der
  **Engpass** (offene Karte, auf die am meisten wartet).
- **Beschriftungs-Spalte (07.10. abends):** links steht jeder Strang auf einen Blick benannt, rechts läuft die Zeit. Je Spur eine Zeile
  über die ganze Spur-Höhe (Tippfläche): Marke in Strang-Farbe (gefüllt = erledigt, Schloss in Achtung-Gelb = blockiert), Titel
  (Unterziel-Fasern mit „›“), Fortschritt in Prozent (überfällig in Achtung-Gelb). Link zum Meilenstein/Projekt/Ziel, der volle Name
  (Art, Titel, Fortschritt, Ende, Grund) steht für Vorleser und als Hinweis. Zeigen auf die Zeile hebt den Strang auf der Leinwand hervor
  und umgekehrt. Eine leise gepunktete Führungslinie läuft vom linken Rand der Zeit bis zum Beginn des Strangs (wächst mit dem Aufbau).
  Kopf „STRÄNGE“ über der Spalte, Monate nur über der Zeit, eine Haarlinie trennt beide; Blättern verschiebt nur die Zeit. Breite nach
  EINER Regel `seilSpalte` (Maße `SEIL_FORM.spalte`: breit ab 980 px, mittel ab 720 px, sonst schmal — schmal ohne Prozent-Zahl; die
  Zeit behält mindestens 200 px). Die Ziel-Köpfe laufen über die ganze Breite.
- **Handy (`useHandy`, bis 720 px):** ohne Querlauf — je Ziel eine Zeile mit Seil-Balken (Fasern, Momentum) und darunter die Stränge als
  Zeilen (Fortschritt, Ende, „wartet auf …“); Fokus = Ziel antippen.

### Rechenregeln — rein in `lib/` (der Zeichner rechnet nichts)

- `lib/planung/bezuege.ts` — Bezugsregeln (Bereich, Kreis, Ziel-Kette, „nur ich“, Aufräumen/Zurück) für Schreibwege und Auswahl.
- `lib/lichtfaeden/seil.ts` — das Modell: Strang-Zeitraum (Start = spätestes Ende der Vorgänger, sonst früheste Karte, sonst
  Ende − 6 Wochen), Fortschritt, Status/Grund, Seil je Ziel (Fasern, Einmündung, Anker, Momentum = Mittel des Strang-Fortschritts,
  Schwung = 1 − 2^(−n/3) mit n = Erledigtes der letzten 14 Tage), kritischer Pfad, Engpass, Spuren/Lage (Ziele nach Rang).
- `lib/lichtfaeden/seil-geometrie.ts` — Spur-Höhen, Einmündungs-Kurve, Fasern des Seils (Helix), Abhängigkeits-Kurve — rein, getestet.
- `lib/lichtfaeden/seil-quellen.ts` — Adapter: Planungsjahr und Aufgaben-Zeitstrahl → neutrales Modell.
- `lib/lichtfaeden/seil-server.ts` + `GET /api/seil` — sammelt mit den vorhandenen Lesefunktionen (Ziele mit Farbe, Meilensteine,
  `ladeAufgabenSicht(person)`, Kalender `termineFuerZoe`, CRM-Deals), filtert den Bereich SERVERSEITIG (`space=privat|business|alle`;
  Konten mit `finanzRecht: 'business'` immer nur Business), nur geteilte Ziele, Dienstweg 403. Kein neuer Bestand.
- Zeichner `lib/lichtfaeden/seilband.ts` auf `zeichnen.ts` (`leinwand`, `starteLauf`, `rgb`) — Canvas 2D, Path2D-Eimer; die
  Bedienung steckt in echten Knöpfen darüber (Ziel-Köpfe, Strang-Beschriftungen, Legende), Text-Äquivalent für Vorleser.
- **Bewegung mit Bedeutung:** Aufbau von links (wie die Lichtfäden), Strang füllt sich bis zu seinem Fortschritt (0,7 s), Seil zieht
  sich an, wenn sich das Momentum ändert (0,9 s), Fasern fließen sehr ruhig zum Anker. `prefers-reduced-motion` = Standbild.

### Was bleibt, was entfällt

- **Bleibt:** Lichtfäden-Modell, Route und Karte (Ziel- und Meilenstein-Seite, Fokus; im Jahr als zweite Ansicht „Alle Stränge“),
  `band.ts`/`zeichnen.ts` unverändert (Website), Kaskade, Meilenstein-Kette, schlichter `Zeitstrahl` (Monat, Quartal, Bauplan).
- **Neu:** Seil als Standard-Ansicht im Planungsjahr, Seil im Aufgaben-Zeitstrahl, Fokus-Modus, Auswahl „zahlt ein auf …“.
- **Entfällt:** im Aufgaben-Zeitstrahl die Karte je Thema mit Pillen (sie zeigte keine Bezüge).

## Tests

`tests/lichtfaeden-modell.test.ts` · `-quelle-{planung,kalender,markttraktion,finanzen,beziehung,gesundheit}.test.ts` ·
`-baum.test.ts` (Pfade, Summen, LOD-Deckel, Dichte deterministisch, Navigation) · `-fokus.test.ts` (Engstellen) ·
`-route.test.ts` (Haushalts-Tor, Dienstweg 403, Privat-Regel, abgeleitetes Ziel) · Seil: `seil-modell.test.ts` (Modell, Geometrie, Maße an
einer Stelle) · `seil-bezuege.test.ts` (Bezüge, Kreise, Bereiche) · `seil-route.test.ts` (Wächter „Sicht Business bekommt nichts aus Privat“,
`finanzRecht` business, „nur ich“) · `seil-oberflaeche.test.ts` (Beschriftungs-Spalte, Token statt Literale, Zeichner bei reduzierter Bewegung) · `fokus-signatur.test.ts` (Strahl v3: Fließrichtung, Aufbau,
Partikel, Ausfransen, Spitzen; FadenLinie, Reihen, Fokus-Karte, Segmentbalken, Wächter) · `-datenschutz.test.ts` („nur ich“ über die
Kette, Altaufgabe, Familie, Engstellen-top, Zwischenspeicher an) · `-oberflaeche.test.ts` (Render, Brotkrumen, Legende,
Engstellen, Zeichner mit/ohne Bewegung, Übergang-Schlüssel) · `lichtfaeden.test.ts` (Mathematik, Markierungen, Lauf, Website-
und Fokus-Kopie) · `ziele-eine-quelle.test.ts` (Farbe, Space-Regel, Planungsdaten im Browser).
