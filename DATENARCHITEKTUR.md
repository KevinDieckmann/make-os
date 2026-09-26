# MAKE OS — Datenarchitektur: Befund und Plan (Stand 26.09.2026, spät)

Kevin (26.09.): „Die ganze Datenarchitektur verbessern, sodass es sehr gut läuft, z. B. das ganze
Kundenmanagement / Markttraktion.“ Entscheidung am selben Abend: **morgen als dringend einplanen**,
die Speicherfrage (JSON oder SQLite) **morgen entscheiden**, die Bereinigung des Datenmodells **später**.

Dieses Dokument ist die Arbeitsgrundlage für den 27.09. Nichts davon ist gebaut.

## 1. Befund in einem Satz

Jeder Bestand ist eine JSON-Datei unter `.data/`, die bei jedem Zugriff ganz gelesen und bei jeder
Änderung ganz neu geschrieben wird. Für das CRM sind das `kontakte.json` (877 KB) und `crm.json` (307 KB).
Das läuft heute, wird aber mit mehr Kontakten und zu zweit zum Engpass — und hat eine echte Datenverlust-Lücke.

## 2. Zahlen

| Messpunkt | Heute |
|---|---|
| `kontakte.json` | 877 KB · 34 Lesestellen · 21 Schreibstellen |
| `crm.json` | 307 KB (25.09. von 30 KB gewachsen, Brain-Übernahme) |
| `grundlage.json` | 1,55 MB, wird bei jeder Business-Index-Berechnung ganz gelesen |
| Öffnen von `/os/markttraktion` | ≈ 5 volle Lesevorgänge der Kartei + bis zu 1 voller Schreibvorgang (`POST /api/crm/signale`) |
| Eine Kontakt-Änderung (`PATCH /api/state/kontakte`) | Datei 3× gelesen, 1× ganz geschrieben; danach laden alle offenen Fenster `kontakte` **und** `bestand` neu |
| Hochrechnung 5.000 Kontakte | 6–8 MB je Klick (formatiert + verschlüsselt + Base64) auf 1 vCPU |
| Sicherung | 1 Kopie je Bestand und Tag unter `.data/backup/`, 14 behalten, gleiche Platte |

## 3. Schwachstellen (Reihenfolge = Dringlichkeit)

1. **Lesefehler wird zu „leer“ → Datenverlust möglich.** `loadJson` (lib/store/local-db.ts:137) gibt bei
   *jedem* Lesefehler `null`; Schreiber wie `crm/signale/route.ts:48` und `crm/aktivitaet/route.ts:43` machen
   daraus `cur ?? { kontakte: [] }` und schreiben das zurück. Schrumpf-Schutz hat nur der CSV-Import
   (`updateGeschuetzt`), `listePatchen` prüft nur Massenlöschungen.
2. **Schreiben ohne Änderung.** `updateJson` schreibt immer. GETs schreiben: `/api/microsoft`, `/api/crm/traktion`,
   `/api/crm/stammdaten`, `/api/apple-calendar`, `/api/kemaris-calendar`, Apple-Routen via `merke()`.
   Folge: ETag springt, alle Fenster laden neu, Zwischenspeicher weg.
3. **Zwischenspeicher praktisch nie warm.** `lib/store/memo.ts` hat *einen* globalen Zähler; `anwesenheit`
   schreibt alle 30 s je offenem Fenster (`components/os/Mitarbeit.tsx:39`), dazu `nutzung`, `aenderungen`.
   `/api/crm/traktion` schreibt selbst und macht seinen eigenen Eintrag ungültig.
4. **Lesen außerhalb der Sperre, dann schreiben.** `crm/import/route.ts:55`, `patch-liste.ts:63`,
   `state/kontakte/route.ts:43`, `crm/lead/route.ts:63/101` (Doppelklick → doppeltes Mandat), Kampagnen, Heads.
5. **Keine Transaktion über mehrere Bestände.** Lead→Mandat, Dubletten zusammenführen, Art.-17-Löschung,
   Kampagnen-Ergebnis: bricht es dazwischen ab, bleibt ein halber Stand.
6. **Zu zweit gewinnt der Letzte.** Kontakte werden als Ganzes gesendet (`kontaktSetzen`), der Server vereint nur
   Verlauf/letzterKontakt/LinkedIn/privatNotiz (lib/make-one/crm.ts:522). Kein 409, kein `teil` für Kontakte.
   Vorbild mit echten Zeilenversionen: `lib/finanzen/haushalt/speicher.ts:152–189`.
7. **Stellen, die quadratisch wachsen:** `firmenDubletten` (lib/crm/firmen.ts:82), `terminSignale` (signale.ts:56,
   *innerhalb* der Sperre), `eventZahlen` (events.ts:45), `dealVon` (leads.ts:87); Kennzahlen je Traktion-Anfrage
   doppelt gerechnet (traktion-index.ts:206); keine dauerhafte Zuordnung Kennung→Kontakt.
8. **Datenmodell verzettelt (später):** Chance/Mandat verweisen per **Firmenname**, 11 Firmenfelder im Kontakt
   kopiert, Lead an Firma *oder* Person, drei Statusmodelle (Kontakt `stufe`, Lead `status`, Chance `stufe` + `lebensphase/
   rollen/typ/kategorie/lifecycle`), Kampagnenergebnisse dreifach, „Kunden“ dreifach (`kundenAusMandaten`,
   `kunden.json`, `Firma.rolle`). Löschen räumt Verweise nicht auf (Art. 17 vergisst `sitzungen.karten`, `head-*`,
   `heads-replay-*` mit vollständigen Datenpaketen, Sicherungen, `archiv/`).
9. **Altbestände parallel:** `netzwerk.json` (190 KB, 731 Kontakte, zweites Modell; noch von `startflaeche`,
   `onboarding-status` gelesen), `kunden.json`, `prospects.json`; `haushalt-*-probe` gleich groß wie echt.
10. **Wachstum ohne Deckel:** `Kontakt.aktivitaeten` (jedes Signal hängt an), `agent-log`-Eintragsgröße,
    `worker.log`/`bau.log` ohne Rotation.
11. **Externe Quellen:** HubSpot ist **nicht** angebunden (nur `hubspotId`, CSV-Import) — passt zur Regel „nur eigene
    Daten“. M365-Stand vom 03.08. ist tot (7-Tage-Grenze). Apple-Mail kommt über `zulieferer.mjs` → `/api/zulieferung`.

## 4. Stufenplan (Aufwand in Stunden, jede Stufe einzeln klickbar und einzeln hochladbar)

| Stufe | Inhalt | Aufwand |
|---|---|---|
| **1 · Absichern & beschleunigen** | Lesefehler nie als leer (Fehler werfen, Schreiber brechen ab); unveränderte Stände nicht schreiben; Lesecache je Bestand im Prozess (ungültig bei Schreibung desselben Bestands); Zwischenspeicher **je Bestand** statt global; Schreibungen aus GET entfernen; `anwesenheit`/`nutzung`/`aenderungen` außerhalb des Stand-Zählers; Dateien ohne Einrückung schreiben | 6–10 h |
| **2 · Zu zweit sicher** | Versionsnummer je Datensatz + 409 (wie Haushalt); `teil`-Änderungen auch für Kontakte; jedes Lesen-Ändern-Schreiben innerhalb der Sperre (Import, Lead, Patch-Prüfungen); Abgleich überträgt nur Änderungen seit Stand statt 877 KB | 10–16 h |
| **3 · SQLite für Kontakte + CRM** (Entscheidung morgen) | Aktivitäten als eigene Tabelle (nur anhängen), Indizes auf Kennung/`firmaId`/Mail/`bezug`, Transaktionen über Kontakt/CRM/Aufgaben; Verschlüsselung im Ruhezustand neu lösen (heute AES-GCM-Hülle je Datei — für SQLite z. B. `better-sqlite3-multiple-ciphers` oder Feldverschlüsselung); Datenübernahme mit Abgleich auf Zeilenzahl | 24–40 h |
| **4 · Datenmodell bereinigen** (später) | `firmaId` statt Name, Firmenfelder raus aus dem Kontakt, ein Statusmodell, Ergebnisse einmal, zentrales Löschen/Umbiegen von Kontakt-Kennungen (auch Art. 17), Altbestände stilllegen | 16–24 h |
| **5 · Kennzahlen & Tests** | Ein Aufbereitungsschritt je Stand für bestand/traktion/stammdaten/lead; Dubletten über Zuordnungstabelle; Signale außerhalb der Sperre; Tests: Gleichzeitigkeit, 5.000 Kontakte, Art.-17-Vollständigkeit | 14–20 h |

Alternative zu Stufe 3, falls JSON bleiben soll: **eine Datei je Kontakt** (kleine Schreibungen, passt zur heutigen
Verschlüsselung, skaliert begrenzt). Beides braucht Stufe 1 und 2 vorher.

## 5. Offene Entscheidungen für den 27.09.

- Speicher: JSON optimiert · JSON je Kontakt · SQLite (mit Verschlüsselungskonzept).
- Reihenfolge: Stufe 1 → 2 → (3) → 5, Stufe 4 später (Kevins Entscheidung 26.09.).
- Messen vor/nach jeder Stufe: Öffnen Markttraktion (Zahl der Lesevorgänge, ms), Kontakt-Änderung (ms, Bytes),
  Trefferquote Zwischenspeicher; Testkonto + Prod-Bau (`make-os-pruefbau`, Port 3011) wie bei der Durchsicht am 26.09.

## 6. Regeln, die dabei gelten

- Daten liegen nur auf dem Server; lokal nie Echtdaten ändern oder hochladen (`deploy/daten-hochladen.sh` nie).
- Jede Datenübernahme zuerst als Vorschau, dann mit Bestätigung; vorher Voll-Export nach `.data/archiv`.
- Hochladen nur auf Kevins ausdrückliches Wort; bauen und zeigen lokal.
- Tests, die fehlen und mit Stufe 1/2 kommen: gleichzeitige `updateJson`-Aufrufe, `listePatchen`, „Lesefehler wird leer“,
  Routen-Tests für gleichzeitige PATCHes auf `bestand`/`kontakte`.
