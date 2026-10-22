# Fulfillment in die Werkstatt — Bauplan (Weg A, Kevins Klickrunde 22.10.)

Stand: Worktree `prozesse-ff-werkstatt` (Basis 451bd6fd). Grundlage: E3 aus `ANALYSE_100.md` und Kevins Antworten vom 22.10. Keine echten Namen oder Beträge.

## Kevins Entscheidungen

| Nr | Frage | Antwort |
|---|---|---|
| F1 | Weg | **A** — Die Werkstatt wird DER Editor für die Fulfillment-Pakete. Ausgeführt wird weiter im Fall (`fall-server`, `ausfuehrungSoll` …). Wahrheit bleibt der Bestand `fulfillment--<h>`: kein zweiter Speicher, keine Kopie in `prozesse--<h>`. |
| F2 | Laufende Kunden | Eine neue Fassung erreicht einen laufenden Fall **nur per Klick je Kunde**. Dafür wird das vorhandene „übernehmen?“ genutzt (`vorlagenDiff`/`vorlageUebernehmen`, `zusatzDiff`/`zusatzUebernehmen`), nie automatisch. |
| F3 | Mandat mit Werkstatt-Prozess (Motor) | Bekommt beim Start des Laufs automatisch seine Akte (Onboarding, Wert-Konto, Kunden-Link, Report …). Es erscheint im Fulfillment genau einmal und nie doppelt als Kandidat. Das ersetzt die Regel „ausblenden“ vom 22.10. |
| F4 | Alter Editor | Pakete, die in der Werkstatt bearbeitet werden, kann er nur noch lesen. Er fällt weg, wenn alle Pakete drüben sind. |

## Bestand (kurz)

- **EIN Typ für beide Seiten:** `lib/prozesse/definition.ts`. Pakete sind `ProzessVorlage<KnotenForm>` mit den sechs Formen Schritt · Nachricht · Entscheidung · Erinnerung · Termin · Abstimmung.
- **Fulfillment-Editor:** `components/os/fulfillment/editor/*`, Regeln `lib/fulfillment/prozesse/editor.ts` (`editorAnwenden`). Er schreibt sofort eine neue Fassung über `fulfillmentAendern('vorlagen')` mit dem Stand der ganzen Vorlage (409).
- **Ausführung:** `fall.ts` (Start = Kopie der `STRUKTUR_FELDER`), `ausfuehrung(-server).ts`, `fall-server.ts`. Der Fall-Status `wartet_kunde` ist eine Fulfillment-Eigenheit.
- **Wie die Werkstatt Pakete heute zeigt:** Die Liste läuft über `app/api/prozesse/werkstatt/route.ts:56-62` und `fulfillment-bruecke.ts` (nur lesen). Die Ansicht „Werkstatt“ zeigt nur einen Hinweis (`ProzesseSeite.tsx` `WerkstattBereich`).
- **Zwei Befunde aus Phase 1:**
  1. Der Werkstatt-Säuberer (`bestand.ts` `definitionAus`/`knotenAus`) verwirft Abstimmungspunkte (`freigaben`), Übergänge, Rollen, Zusatzmodul, Phasen-Reihenfolge, Papierkorb, Hinweise, Ablauf-Form, Herkunft (Datei, Importlauf, freie Quellen) und an den Knoten `zone`, `kreislauf`, `ort`, `verweis`, `art`, `optional`, `ausgang`, `original`, `beleg`.
  2. Die freie Lage (`pos`) bedeutet in den zwei Welten Verschiedenes: im Fulfillment relativ zum Rahmen, in der Werkstatt x relativ zum Rahmen und y relativ zur Bahn.

## Regeln des Fulfillment-Modus (gelten ab E1, durchgesetzt ab E2)

- **Palette = nur, was der Fall ausführen kann:**
  - die sechs Formen
  - Bausteine der Bibliothek auf Ebene 5, mit der EINEN Kunden-Regel `fuerKundenFrei` sichtbar
  - Abstimmungspunkt je Phase (Raute am Ende der Phase, `freigaben`)
  - Zusatzmodul
  - Frist (Tage) und Versuche
  - Zuständig (Bahn Kunde = `zustaendig: 'kunde'`, Bahn Team = intern bzw. beide)
  - „Kunde sieht es“
- **Was die Werkstatt zusätzlich kann, gibt es dort nicht:** Agent, Auslöser, Warten, Schleife, CRM-Abfrage, Teilprozess, Freigabe-Schloss, Ende, Raute nach Regel oder Score, Webhook, Zettel, Steckbrief, Bahn-Personen. Diese Arten sind nicht wählbar, und die Prüfung `fulfillmentModusBefunde` lehnt sie als **Fehler** ab (`lib/prozesse/fulfillment-modus.ts`).
- **Nie still verlieren:** Gespeichert wird nur, wenn der Rundweg Werkstatt → `vorlageAus` (der Säuberer des Fulfillments) nichts verliert (`feldVerluste`). Sonst kommt 400 mit dem Pfad.
- **Keine freie Lage im Paket-Modus:** Die Werkstatt ordnet automatisch. `pos` und `pfeilText` des alten Editors bleiben unberührt im Paket.
- **Keine Freigabe-Schlösser:** `schlossSetzen` läuft nie für Pakete. Die Nachricht ist im Fall ohnehin ein Vorschlag im Stapel.

## Etappen — jede einzeln auslieferbar, jede mit Gold-Test

Vorgeschlagene Reihenfolge, Summe rund 12–16 Tage:

| Etappe | Inhalt | Aufwand |
|---|---|---|
| **E1** | Öffnen und Rundweg | gebaut |
| **B1** | Fall-Ereignisse | 1,5–2 Tage |
| **E2** | Bearbeiten | 2–3 Tage |
| **E3** | Veröffentlichen und je Kunde übernehmen | 1,5–2 Tage |
| **B2** | Galerie Kunden-Begleitung | 2,5–3 Tage |
| **B3** | Eine Fläche | 1,5–2 Tage |
| **E4** | Alter Editor nur lesen | 1 Tag |
| **E5** | Akte für Motor-Mandate | 1,5–2 Tage |

Abhängigkeiten:
- B1 und B2 brauchen nur den Motor und können neben E2–E4 laufen.
- B3 braucht E1 und B2.
- E5 ist unabhängig.

### E1 · Öffnen und Rundweg (0,5–1 Tag, schreibt nichts ins Fulfillment) — GEBAUT

- **`lib/fulfillment/lesen.ts`:** reicht seine Säuberer-Teile weiter (`vorlagenKnotenAus`, `uebergangAus`, `freigabepunktAus`, `rolleAus`, `papierkorbEintragAus`). Das Verhalten bleibt unverändert.
- **`lib/prozesse/bestand.ts`:** Der Werkstatt-Säuberer behält alle Fulfillment-Felder und nutzt dafür dieselben Säuberer-Teile, also eine Regel. Für Werkstatt-Prozesse ändert sich nichts.
- **`lib/prozesse/fulfillment-modus.ts`** (rein, client-sicher):
  - `FULFILLMENT_FORMEN` und `fulfillmentModusBefunde`
  - `paketAlsDefinition` / `paketAusDefinition` (Rundweg über `vorlageAus` mit Verlust-Wächter) und `feldVerluste`
  - `paketAnsicht`: Bahnen Kunde/Team aus `zustaendig`, Abstimmungspunkt als Raute am Phasenende, Lage automatisch
  - `paketUnterzeile` und `paketKnotenInfo`
- **`lib/prozesse/fulfillment-modus-server.ts` und `GET /api/prozesse/werkstatt?paket=<fp-…>`** (nur lesen, Tor `werkstattZugang`, nur Business). Die Antwort enthält:
  - das Paket mit seinem Stand
  - die Befunde (Modus und Struktur `vorlageStrukturPruefen`)
  - die Bibliothek in Kürze mit `fuerKundenFrei`
  - die Zahl der laufenden Kunden (nur Business-Mandate)
  - die Produkte und den Editor-Link
- **`components/os/prozesse/PaketWerkstatt.tsx`:** dieselbe Fläche (`WerkstattFlaeche`) zum Ansehen, rechts die Felder des gewählten Schritts. Eingehängt in `WerkstattBereich` statt des Hinweises. Der Knopf „Im Fulfillment-Editor bearbeiten ›“ bleibt bis E2.
- **Gold und Wächter** (`tests/prozesse-ff-werkstatt-e1.test.ts`):
  - Werkstatt-Säuberer vorher = nachher, Fixture `tests/fixtures/prozesse-saeuberer-vorher.json` aus 451bd6fd: alle Vorlagen der Kundengewinnung, `definitionAus` und `prozesseAus`
  - **Paket vorher = Paket nachher** nach Öffnen und Speichern ohne Änderung: Muster-Pakete, ein Paket aus dem Editor (Gruppen, Abstimmung, Papierkorb, Lage) und ein Voll-Paket mit jedem Feld. Der Weg ist JSON → Werkstatt-Säuberer → `paketAusDefinition` und muss bit-gleich bei gleichem Stand ankommen.
  - der Fulfillment-Modus lehnt jede Werkstatt-Art ab
  - Ansicht: Bahnen, Raute, Kanten
  - die Route: Rechte, Privat 403, 404/400, und das **Lesen schreibt nie** (Bytes aller `fulfillment-*`-Bestände und der Fälle bleiben gleich, also Fall vorher = Fall nachher)
  - Client-Wächter

### Begleit-Prozesse am Fall (Kevins Ergänzung 22.10.) — B1 bis B3

Kevin: „die ganzen vorgefertigten Nachrichten für den Kunden, Follow-ups, wenn sie die Sachen nicht schicken etc. — das kann auch alles aufgebaut werden.“

Die Pakete bleiben im Fulfillment-Ausführer. Auslöser, Bots (Agent-Knoten) und Entscheidungen (Rauten) hängen als **Werkstatt-Prozesse im Lauf-Motor** daneben. Sie starten auf Fall-Ereignisse; Fall-Art ist das Mandat. Die Begleit-Prozesse ändern den Fall nie, sie wirken nur über ihre eigenen Wege: Aufgaben `pl-…`, Stapel, nach der Freigabe senden, Glocke.

#### B1 · Fall-Ereignisse als Auslöser — GEBAUT (22.10.)

Gebaut wie unten beschrieben, mit zwei Abweichungen (nichts doppelt):
- **Kein Datumsfeld „Report fällig“:** Der Report läuft über `fall-haengt`/report (Hänger mit `REPORT_ALT_TAGE`).
- **Datumsfeld `fall.termin`** kommt aus `faelleFuerProzesse`, also aus dem Cockpit (`naechsterFallTermin`). Dazu die Fall-Felder `fall.paket` und `fall.status`.

Weitere Punkte:
- Fall-Start meldet die erste Phase „begonnen“.
- Gold: `tests/prozesse-ff-begleitung-b1.test.ts`.


Allgemeine Regeln:
- Nur über die vorhandene Ereignis-Stelle (`lib/ereignisse/quellen.ts` `ereignis()`), wie schon `fall-schritt-erledigt` und `ziel-erreicht`.
- Nur ergänzend, idempotent über eine feste Kennung, im Ereignis stehen nur Kennungen.
- **Keine zweite Fristenrechnung:** Alles hängt an den vorhandenen Lesern und Uhren.

| Ereignis (neu, `SkillEreignis` + `lib/ereignisse/arten.ts`) | Quelle (vorhanden) | Kennung |
|---|---|---|
| `fall-phase` (Stufe `begonnen` · `abgeschlossen`) | `fallDiff` nach jedem Schreiben des Falls (`fall-server.ts` → `fallEreignisse`) — Phasenstand aus `phasenStaende`/`fallStelle` | Fall · Phase · Stufe · Tag |
| `fall-wartet-kunde` (Stufe `begonnen`) | `fallDiff`: ein Knoten mit `zustaendig: 'kunde'` bzw. `wartet_kunde` wird aktuell (`aktiveKnoten`) | Fall · Knoten · Tag |
| `abstimmung-bestaetigt` | `fallDiff`: neuer Eintrag in `Fall.freigaben` | Fall · Freigabe |
| `fall-haengt` (Stufe = `HaengerArt`: willkommen · freigabe · wartet · faellig · puls · report) | Morgenlauf (`prozesseMorgenlauf`) über die vorhandene `wasHaengt` (Cockpit — dieselbe Rechnung wie „Heute im Fulfillment“, Willkommen-Uhr, `WARTET_ALT_TAGE`, Puls-Schwelle, `REPORT_ALT_TAGE`) | Fall · Art · Knoten · `seit` (je Hänger einmal) |
| `kunde-geliefert` (Stufe `formular` · `unterlage` · `puls`) | öffentliche Kunden-Link-Wege nach dem Schreiben (`formularPruefen`, `unterlageAblegen`, Puls) — nie Inhalte | Fall · Art · Eintrag |

Weitere Teile von B1:
- **Termin und Fristen:** Für „Termin in n Werktagen“ und „Report fällig am …“ kommen nur zusätzliche `DatumsFeld`-Glieder `fall.naechster-termin` und `fall.report-faellig` für den vorhandenen Datum-Auslöser bzw. das Warten. Die Werte stammen aus `naechsteFallTermine` und der Report-Achse (`reportAchse`); es gibt keinen neuen Takt.
- **Felder für Bedingungen** (`lib/prozesse/ausloeser.ts` `EREIGNIS_FELDER`): `ereignis.vorlageId` (Paket des Falls), `ereignis.knotenId`, `ereignis.stufe`, `ereignis.tage`. Dafür wird der Bezug der Ereignisse um die optionale `vorlageId` ergänzt.
- **Gold:**
  - Fall vorher = Fall nachher: Ereignisse lesen nur.
  - Der Morgenlauf ohne Begleit-Prozess ist bit-gleich (nur der Ereignis-Bestand wächst, Frist „ereignisse“).
  - Ein zweiter Lauf erzeugt nichts.
  - Ein Kennungs-Umzug erzeugt keine Ereignisse (vorhandener Wächter).

#### B2 · Vorlagen-Galerie „Fulfillment · Kunden-Begleitung“ — GEBAUT (22.10.)

**Stand 22.10.:** `lib/prozesse/begleitung/vorlagen.ts` (FB1–FB9), Sammlung in Galerie und Route (`&gruppe=`), Lage-Felder des Falls aus `faelleFuerProzesse`,
Platzhalter `kunde.gruss`/`fall.phase`/`fall.termin`. Abweichungen vom Plan (nichts doppelt, nichts am Fall vorbei):
- FB4/FB5 ohne Agenten-Schritt: vorgefertigte Nachricht, im Stapel anpassbar (ein Agent kann heute keinen Text in den Entwurf geben).
- FB6 wie FB3: nur erinnern — der Report geht aus dem Fall (sonst zählt „letzter Report“ nicht).
- FB7 nur Glückwunsch — die Empfehlung fragt V14 (hört selbst auf „Ziel erreicht“).
- FB9: Auslöser „letzte Etappe abgeschlossen“ (`fall.phase` leer) → Übergabe an V15.
- Platzhalter `kunde.gruss` statt `kunde.anrede`; Texte neutral ohne Sie/ihr.
- Gold: `tests/prozesse-ff-begleitung-b2.test.ts` (Probelauf aller neun mit Beispiel und echtem Fall: kein Lauf geschrieben, Fall und Paket Byte für Byte gleich).


- **Daten wie die 18 Vorlagen der Kundengewinnung** (`lib/prozesse/begleitung/*`; dieselbe Galerie, dieselbe Übernahme `ausVorlageAnwenden`), ohne Namen und Beträge.
- **Texte:** mit Platzhaltern; die Anrede Sie/Du kommt aus der Akte (`KundenAnrede` → Platzhalter `kunde.anrede`).
- **Grundregeln jeder Vorlage:**
  - startet im Probelauf
  - alles nach außen über den Stapel (Mail/WhatsApp hinter dem Schloss, nach der Freigabe direkt senden)
  - Empfänger aus der Akte (dieselbe Regel wie `nachrichtEmpfaenger`)
  - Kanal-Ampel, Art. 18 und Werbesperre wie im Motor
  - KI-Text nur als Vorschlag mit `KiMarke`
  - Ende-Bedingung: `kunde-geliefert` bzw. `abstimmung-bestaetigt` beendet die Erinnerungskette (Warten auf das Ereignis mit Obergrenze)

| Nr | Vorlage | Ablauf (≤ 10 Schritte je Phase) |
|---|---|---|
| FB1 | Unterlagen fehlen | `fall-haengt`(wartet) → Erinnerung 1 (Mail-Entwurf) → Warten 3 Werktage auf `kunde-geliefert` → Erinnerung 2 → Warten → Anruf-Aufgabe → Glocke an die Zuständige (Eskalation) |
| FB2 | Bestätigung offen | `fall-haengt`(freigabe) → Erinnerung (Hinweis auf den Kunden-Link) → Warten auf `abstimmung-bestaetigt` → Terminvorschlag (Einladung hinter Schloss) |
| FB3 | Willkommen in 24 h | `fall-haengt`(willkommen) → Glocke + Aufgabe „Willkommensmail im Fall senden“ — die Mail selbst bleibt im Fall (sonst stimmt `willkommenGesendetAm` nicht) |
| FB4 | Phase abgeschlossen | `fall-phase`(abgeschlossen) → Agent-Entwurf „Zusammenfassung + nächste Schritte“ (nur aus der Kunden-Positivliste `kundenSicht`) → Freigabe → senden |
| FB5 | Termin-Vorbereitung | Datum `fall.naechster-termin` −2 Werktage → Agenda-Entwurf (Agent, Vorschlag) → Freigabe → senden |
| FB6 | Report fällig | `fall-haengt`(report) → Entwurf über die vorhandene Report-Grundlage (`treppe-server`, Anhang über den vorhandenen Weg) → Freigabe → senden |
| FB7 | Ziel erreicht | `ziel-erreicht` → Glückwunsch + Wirkungsbericht (vorhanden) + Empfehlungsfrage → Follow-up „Empfehlung“ |
| FB8 | Puls niedrig | `fall-haengt`(puls) → Check-in-Aufgabe — nur, wenn kein Puls-Gespräch-Vorschlag `k:puls:` offen ist (nichts doppelt) |
| FB9 | Verlängerung | Übergabe an die vorhandene Vorlage V15 (Ende `uebergabe`) — nichts doppelt |

- **Gold und Wächter:**
  - keine Namen oder Beträge (`repo-sauber`)
  - Gliederung ≤ 10 Schritte je Phase
  - jede Außenwirkung hinter dem Schloss
  - der Probelauf schreibt nichts
  - die Kette endet bei `kunde-geliefert`
  - Fall vorher = Fall nachher (ein Begleit-Lauf schreibt nie in den Fall)

#### B3 · Eine Fläche — 1,5–2 Tage

- **Andocken ohne zweites Feld:** Ein Begleit-Prozess gehört zu einem Paket bzw. Schritt über die Bedingungen seines Auslösers (`ereignis.vorlageId`, `ereignis.knotenId`). Rein `begleitFuer(paket, prozesse)`.
- **Werkstatt-Ansicht des Pakets** (`PaketWerkstatt`): angedockte Begleit-Prozesse als Kacheln neben Schritt bzw. Phase, mit gestricheltem Lichtfaden zum Auslöser. „+ Begleit-Prozess“ öffnet die Galerie mit Vorbelegung (Paket, Schritt). Ein Klick öffnet den Prozess in der Werkstatt.
- **Fall-Ansicht (Akte):** Karte „Begleitung läuft“ — die Läufe mit Fall = Mandat (Titel, Status, wartet auf …, Link). Gelesen nur über die vorhandenen Läufe-Leser, nur Business.
- **Gold:** Paket und Fall bit-gleich (die Anzeige liest nur), Sicht Privat 403.

**Offene Punkte für Kevin (mit Empfehlung):**
- Erinnerungen „mit Link“: Je Mandat gilt höchstens EIN Kunden-Link, und ein neuer widerruft den alten. (Empfehlung: Die Erinnerung verweist auf den Link aus der Willkommensmail; „neuen Link senden“ nur als eigener Freigabe-Schritt.)
- Soll FB3 die Willkommensmail selbst senden? (Empfehlung: nein — sie bleibt im Fall, der Begleit-Prozess erinnert nur.)

### E2 · Bearbeiten im Fulfillment-Modus (Entwurf) — GEBAUT (22.10.)

Gebaut so:
- Regeln rein in `lib/prozesse/fulfillment-entwurf.ts` (Speichern und Verwerfen) und in `fulfillment-bearbeiten.ts`, das die Ops des Fulfillment-Editors im Browser anwendet.
- Oberfläche: `PaketWerkstatt` und `PaketPanel`.
- Gold: `tests/prozesse-ff-werkstatt-e2.test.ts`.

Bewusst nicht gebaut:
- Freies Ziehen auf der Fläche — geändert wird über das Seitenfeld.
- Gruppen umbenennen.

- **Entwurf im Fulfillment-Bestand:** neues optionales Feld `VorlagenDatei.entwuerfe?: Record<paketId, { knoten, freigaben, zusatz?, titel, basisFassung, basisStand, am, von }>`. Dazu gehören der Säuberer `vorlagenAus`, Grenzen (413), Art. 15/17 (keine Personendaten außer `von` → Konto löschen tilgt es) und das Speicher-Register (vorhandener Eintrag `fulfillment--*`). Es ist kein zweiter Speicher.
- **Route `POST /api/prozesse/werkstatt`:** `paket-entwurf` mit Stand des Entwurfs (409 mit „Deine Fassung“), Bau-Kennung, nur per Sitzung, nur volle Mitglieder und Business. Geschrieben wird über `fulfillmentAendern('vorlagen')`.
- **Werkstatt-Modus `fulfillment`:**
  - Palette und Panel nur mit den Feldern oben
  - Bahn Kunde/Team setzt `zustaendig`
  - Baustein hinzufügen legt einen Ebene-5-Knoten an, bei Bedarf einen Sammel-Teilprozess. Diese Regel wird aus `editor.ts` übernommen (`schritt-neu`/`baustein-dazu`), nicht nachgebaut.
  - Abstimmungspunkt je Phase an/aus mit Titel und „wer“
  - Zusatzmodul-Schalter; Phasen ziehen setzt `phasenVonHand`
- **Die Werkstatt-Aktionen bleiben, wo sie sind:** Rückgängig/Wiederholen, Kopieren, Tastatur (`werkstatt-aktionen.ts`). Wo eine Aktion Werkstatt-Arten erzeugen würde, sperrt sie der Modus.
- **Gold:** Entwurf speichern lässt Paket, Fassung, Fälle und Aufgaben `ff-ab-…` bit-gleich (Fall vorher = Fall nachher). Zweimal speichern ohne Änderung schreibt nichts. Ein Werkstatt-Feld im Körper ergibt 400 mit Pfad.

### E3 · Veröffentlichen ins Paket und Übernehmen je Kunde (F2) — GEBAUT (22.10.)

Gebaut so:
- Rein: `paketVeroeffentlichen` in `fulfillment-entwurf.ts`.
- Die Liste `kunden` kommt aus `paketFuerWerkstatt` (mit Lese-Protokoll).
- Oberfläche: `PaketKunden.tsx` ruft den vorhandenen Weg `vorlage-uebernehmen` auf.
- Gold: `tests/prozesse-ff-werkstatt-e3.test.ts`.

- **„Veröffentlichen“** (Name und Notiz) schreibt den Entwurf als neue Fassung des Pakets, über die vorhandene Schreibstelle (`fulfillmentAendern('vorlagen')`, Stand des Pakets → 409, `vorlageStrukturPruefen`, `fulfillmentModusBefunde`, `feldVerluste` hart). Die Notiz kommt als Marke `fassung-notiz:<paket>:<n>`. Danach ist der Entwurf leer.
- **Hinweis danach:** „n laufende Kunden — Änderung je Kunde übernehmen“. Die Liste zeigt je Fall die vorhandenen `vorlagenDiff`/`diffVorschau`, der Knopf ruft das vorhandene `POST /api/fulfillment/fall { aktion: 'vorlage-uebernehmen' }` auf (Zusatzmodul: `zusatzDiff`/`zusatzUebernehmen`). Nie automatisch.
- **Gold:**
  - Veröffentlichen ändert keinen Fall, bis zum Klick (Fall vorher = Fall nachher).
  - Übernehmen über die Werkstatt = bit-gleich mit dem Weg des alten Editors (dieselbe Funktion, derselbe Fall danach, dieselben Aufgaben).
  - Ein neuer Fall startet mit der neuen Fassung.

### E4 · Alter Editor nur lesen (F4) und Wege — 1 Tag

- **Marke `werkstatt:<paket>`** (gesetzt beim ersten Entwurf in der Werkstatt): `PATCH /api/fulfillment/editor` antwortet 409 „Wird in der Werkstatt bearbeitet“. Der alte Editor zeigt nur Ansehen und den Link „In der Werkstatt öffnen ›“.
- **Links:** Produktkarte, Landkarte, Fulfillment › Prozesse und die Werkstatt-Liste (`nurLesen: false` im Modus) führen in die Werkstatt.
- **„Neuer Ablauf“** legt aus der Werkstatt ein Paket über `neuerAblauf` an, mit Marke. Sind alle Pakete markiert, leitet die Editor-Seite um (Weiterleitung nur in `next.config.mjs`).
- **Import und Muster** bleiben im Fulfillment. Für markierte Pakete legt der Import nur einen Entwurf an.
- **Gold:** Der Editor ist für markierte Pakete nur lesbar; unmarkierte bleiben unverändert bedienbar.

### E5 · Akte für Mandate mit Werkstatt-Prozess (F3) — 1,5–2 Tage (unabhängig von E2–E4)

- **Beim Start eines scharfen Laufs** über die Produkt-Bindung (`produktLaeufeStarten`) legt der Server die Akte an: `fallStartenServer` mit dem neuen optionalen Feld `Fall.ablauf = { art: 'prozess', prozessId }`, dem Onboarding-Teil und ohne Paket-Knoten. Das ist idempotent, ein Fall je Mandat.
- **Kandidaten-Regel:** `onboardingKandidaten(…, mitProzessLauf)` bleibt die EINE Regel. Ein Mandat ist entweder Kandidat oder hat einen Fall, nie beides. Ein Schatten-Lauf legt keine Akte an; er bleibt wie bisher kein Kandidat.
- **Kunden-Sicht:** Für einen Fall mit `ablauf.art === 'prozess'` kommen Zeitstrahl, Erledigt und Nächstes aus `kundenEtappen`; alles andere kommt aus der Akte. Die Positivliste bleibt unverändert.
- **Gold:**
  - Fälle mit Paket bit-gleich durch alle Leser: `fallWirksam`, `faelleKurz`, `cockpitDaten`, `heuteImFulfillment`, `kundenSicht`, `reportZusatzFuer`, `ffKennzahlenFuerIndex`, `kundenJeKnoten`, `ausfuehrungSoll`.
  - Kandidat XOR Fall.
  - Rückweg: Der alte Säuberer verliert `ablauf`; die Ableitung über den Lauf findet ihn wieder.

## Risiken und Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| Zwei Säuberer weichen auseinander, Felder gehen verloren | Die Werkstatt nutzt die Säuberer-Teile des Fulfillments; `feldVerluste` als harte Sperre; Gold-Rundweg mit Voll-Paket (`satisfies Required<…>`: ein neues Feld ohne Test wird bei tsc rot). |
| `pos` bedeutet Verschiedenes | Paket-Modus ohne freie Lage; `pos`/`pfeilText` bleiben unberührt. |
| Schlösser oder Werkstatt-Arten rutschen ins Paket | Der Modus sperrt die Palette; die Prüfung lehnt ab (Fehler); Route-Test mit jeder Werkstatt-Art. |
| Gleichzeitige Arbeit im alten Editor und in der Werkstatt | Ein Stand für das ganze Paket (409) ab E2; Marke `werkstatt:` ab E4. |
| Phasen-Reihenfolge springt (`phasenOrdnen` beim Lesen) | Jede Änderung in der Werkstatt setzt `phasenVonHand` wie der Editor; der Rundweg ohne Änderung ist bit-gleich (Gold). |
| Abstimmungs-Kennungen F0–F7 tragen Bedeutung | Werden nie neu vergeben; neue nach `EDITOR_ABSTIMMUNG`. |
| Live-Fälle | Fälle werden nur über `fall-server` geschrieben. E1–E4 schreiben keinen Fall; das Übernehmen bleibt die vorhandene Funktion. Update-Probe mit Altbestand vor jedem Upload. |

## Rückweg

Alles kommt nur dazu: neue optionale Felder (`entwuerfe`, `Fall.ablauf`), Marken, Exporte und eine Lese-Route. Ein älterer Stand
- verwirft beim nächsten Schreiben nur offene Entwürfe; veröffentlichte Fassungen sind normale Pakete,
- ignoriert die Marke `werkstatt:`, sodass der alte Editor wieder schreibt,
- liest Akten aus E5 als Fälle ohne Paket-Knoten.

E1 allein ist ohne Datenwirkung: Lesen schreibt nie, und der Werkstatt-Säuberer liefert für alle Werkstatt-Prozesse dieselben Bytes (Gold).

## Offene kleine Frage für E5 (Empfehlung in Klammern)

- Legt auch ein Probelauf (Schatten) die Akte an? (Nein — erst der scharfe Lauf. Der Schatten ist eine Rechnung.)
