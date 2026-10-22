# Paket „Werkstatt bau-fertig“ (n8n-Niveau) — Bauplan aus dem Abgleich vom 22.10.

Kevin: „Ich will darin sauber bauen können — das geht gerade noch nicht wirklich.“ Alle vier Felder hakeln:
hinzufügen & verbinden · einstellen je Baustein · testen & sehen · Platz/Übersicht/Bedienung.

Kürzel (Basis Worktree): W = components/os/prozesse/Werkstatt.tsx · FL = WerkstattFlaeche.tsx · PA = WerkstattPanel.tsx ·
MA = WerkstattMaske.tsx · FA = WerkstattFormauswahl.tsx · KN = WerkstattKnoten.tsx · LA = WerkstattLaeufe.tsx ·
AK = lib/prozesse/werkstatt-aktionen.ts · LG = werkstatt-lage.ts · TA = werkstatt-tastatur.ts · FLU = fluss.ts ·
LR = lauf-regeln.ts · LS = lauf-server.ts · BK = baustein-katalog.ts · CSS = app/globals.css

**Grundbefund:** Das Modell ist „Strang je Phase + Abzweige“ (FLU:1-12, 47-51), kein freier Graph: Fäden nur innerhalb einer Phase
(AK:141 „erst den Schritt in die Phase ziehen“), ein Schritt zweigt nur von EINEM Knoten ab (AK:146), Strang nicht lösbar (AK:169),
kein Switch/Parallel (FLU:17). Der Motor hängt am Modell → **Modell NICHT umbauen, die Oberfläche nachgiebig machen.**

## Bau-Reihenfolge
1. Vollbild-/Werkzeug-Muster einziehen (Branch `werkzeuge`); zusätzlich Hinweise/Meldungen schwebend statt die Fläche zu verschieben (W:610-638).
2. Doppelklick auf Knoten = Titel direkt auf der Fläche ändern; zweiter Doppelklick/Enter = großes Einstellungsfenster.
3. „+“ mitten auf jedem Faden → dazwischen einfügen (vorhandenes `anlegen({vor})`, AK:59).
4. Verbinden ohne Phasen-Fehler: automatisch `inPhase` (AK:220) mit Ansage; Kantenende greifen und umhängen.
5. Knoten-Auswahl als Seitenleiste in voller Höhe (heute Fenster 420 px, Liste ≤ 320 px, FA:37-43): Suche, Gruppen nach `anbindung` (BK:76), „Zuletzt benutzt“, Gruppe „Daten“.
6. Befundtext am Knoten beim Überfahren (heute nur Symbol KN:147), Klick springt ins betroffene Feld.
7. Großes Einstellungsfenster, drei Spalten: links Eingabe (Platzhalter mit Test-/Fallwerten, LS:1872-1895), Mitte Maske (MaskenEingabe wiederverwenden), rechts Ausgabe „würde …“ (gefüllter Text, Empfänger).
8. Platzhalter per Klick/Ziehen an den Cursor (`{{feld}}`), Live-Vorschau mit `textvorlageFuellen` (BK:572), Prüfung beim Tippen mit `textvorlagePruefen` (BK:557).
9. Testdaten je Prozess („Beispiel bearbeiten“, optionales Feld) + „Weg annehmen“ je Raute/Freigabe/Warten (heute nimmt der Schatten immer den Hauptweg, LR:407/420/433/638-650) — Probelauf-Route bekommt `annahmen`.
10. „Bis hier testen“ / „Nur diesen Schritt testen“ (Route-Parameter `bis` bzw. `nur`), Ausgabe als Tabelle (JSON nur mit Kennungen).
11. Lauf → „Als Testdaten in Bauen“ (echtes „Copy to editor“; heute „Als Testfall übernehmen“ LA:143/158).
12. Mini-Map in der Werkstatt (aus Buehne.tsx der Landkarte übernehmen), unten rechts.
13. Kopieren/Einfügen zwischen Prozessen (heute nur `useRef` W:135) über den Browser-Speicher, durch `ohnePersonen` (lib/prozesse/kopie.ts).
14. Deaktivieren eines Knotens als optionales Feld (Säuberer bestand.ts, Motor wertet „übersprungen“; ein Freigabe-Schloss wird mit übersprungen, fällt nie still weg).
15. (optional, L) „Mehrfach-Entscheidung“ (Switch) als Bau-Hilfe: wird beim Speichern zu einer Kaskade aus Regel-Rauten — Modell unverändert.
Dazu klein: Duplizieren-Knopf im Panel (⌘D gibt es), Mausrad verschiebt im Vollbild die Fläche, Kürzel Zoom +/−/0, Zettelgröße ziehen, Verbindungsstand („Läuft als“, Postfach) direkt am Feld.

## Leitplanken (Projektregeln)
- „Schritt testen“ sendet NIE (Mail/WhatsApp/Angebot/Einladung): Ausgabe „würde senden: … an …“, Schloss bleibt sichtbar; Beispiel-Empfänger `example.invalid` (LS:1896).
- KI nur über askText: Probelauf ruft heute kein Modell (LS:1902). Echter Agent-Test nur per eigenem Klick „Modell wirklich fragen (ca. x ct)“ über den vorhandenen Agenten-Weg mit Budget je Prozess; Ergebnis nur Vorschlag in der Ansicht. Echter Fall nur mit KI-Kategorien- und Art.-18-Prüfung; `nurOeffentlich` = nur Firmenname/Domain/Branche.
- Gespeicherte Testwerte immer erfunden (Prüfung: nur `*.invalid`-Mails, Platzhalter-Telefon). Echter Fall nur im Schatten, Inhalte live mit den Rechten der Person, gespeichert nur Kennungen.
- Webhook-Eingänge sind fremder Text → nie als Testdatensatz; Beispiel aus dem Felder-Schema erzeugen.
- Client-Wächter: Vorschau/Ausgabe nur mit reinen Modulen (BK, LR); „Schritt testen“ serverseitig über die erweiterte Route `/api/prozesse/probelauf`.
- Rückweg/Bit-Gleichheit: Deaktivieren und Testdaten nur als optionale Felder; Säuberer bestand.ts + Masken-/Gold-Wächter ergänzen.
- Keine Personen in Vorlagen/Ablage (`ohnePersonen`).
