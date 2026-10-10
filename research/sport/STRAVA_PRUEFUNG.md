# Strava zusätzlich zu WHOOP? — Prüfung für MAKE OS

Stand: 09.10.2026 · alle Quellen am 09.10.2026 abgerufen · keine Rechtsberatung.
Kennzeichnung: **belegt** = offizielle Bedingungen bzw. Doku des Anbieters (URL dabei) · **Annahme** = dort nicht ausdrücklich belegt.

Anlass: Kevin 09.10. „Kannst du checken, ob wir WHOOP brauchen bzw. Strava?“ — die trainierende Person nutzt Strava aktiv (Läufe, Einzelzeiten).

---

## Empfehlung in fünf Sätzen

1. Für Hyrox- und Lauftraining liefert WHOOP schon jede Einheit mit Sportart, Dauer, Strain, kcal, Ø/max Puls, Minuten je Herzfrequenz-Zone
   und — wenn die Einheit mit GPS aufgezeichnet wurde — Distanz und Höhenmetern; Strava ergänzt vor allem GPS-Strecke, Kilometer-Splits und
   Pace-Verlauf, Runden, Segmente, Trittfrequenz/Leistung und Ausrüstung — für die Rennvorbereitung nett, für Plan ↔ Ist und Belastung nicht nötig.
2. Die Strava-Bedingungen 2026 (API Policy, gültig ab 01.06.2026) verbieten aber, Strava-Daten länger als **7 Tage** zu halten (§ 6.2), sie oder
   daraus Abgeleitetes in einem dauerhaften Index/Archiv zu speichern (§ 5.5) und sie **in irgendeiner KI-Anwendung** zu nutzen — ausdrücklich auch
   „ingestion into a context window or working memory“ (§ 5.3); dazu Abo-Pflicht im Standard-Tier (§ 3.3) und Löschen binnen 48 Stunden bzw. 30 Tagen.
3. Damit ist „Strava je Person nach Vorbild WHOOP“ (Spiegel, Abbildung in Läufe/Trainings, Dedupe, Auswertung über Wochen, ZOE) **nicht zulässig**;
   erlaubt wäre nur eine Live-Anzeige der eigenen Aktivitäten der letzten sieben Tage ohne ZOE — kaum Mehrwert gegenüber der Strava-App.
4. Empfehlung: **Strava-API nicht anbinden.** Pace und Splits kommen über eigene Daten der Person — WHOOP (GPS-Läufe) und, wenn gewünscht, ein
   Datei-Import einzelner Läufe (GPX/TCX/FIT, den die Person selbst aus Strava oder ihrer Uhr exportiert) bzw. später Apple Health per Kurzbefehl —
   beides ohne Strava-API-Bedingungen (Bauplan unten).
5. ZOE und der Gesundheits-Agent dürfen Strava-API-Daten gar nicht nutzen (auch nicht für einen einzelnen Tagesvorschlag); WHOOP-Daten dürfen mit
   Einwilligung (b) in den Prompt (WHOOP verbietet nur, damit Modelle zu bauen oder zu trainieren) — **neu ist aber WHOOP § 4.2 (gültig ab 06.10.2026):
   keine dauerhaften Kopien/Datenbanken „unless authorized by the data owner“** → die Einwilligung beim WHOOP-Verbinden sollte das Speichern
   ausdrücklich umfassen (Befund für das WHOOP-Paket, siehe Abschnitt 4).

---

## 1. Was WHOOP für Training liefert (heute in MAKE OS)

Quelle: https://developer.whoop.com/api · https://developer.whoop.com/docs/developing/user-data/workout · Abbildung `lib/whoop/abbilden.ts`. **belegt**

| Größe | WHOOP-Feld | in MAKE OS |
|---|---|---|
| Sportart | `sport_name` (Liste mit ~120 Sportarten, keine eigene „Hyrox“) | Sparte über EINE Tabelle (`lib/sport/training.ts`), je Person umstellbar |
| Start, Ende, Ortszeit | `start`, `end`, `timezone_offset` | Datum + Uhrzeit, Dauer |
| Belastung | `score.strain` (0–21), `kilojoule` | Strain, kcal |
| Puls | `average_heart_rate`, `max_heart_rate` | Ø/max |
| Zonen | `zone_durations` (Zone 0–5, ms) | Minuten je Zone |
| Distanz | `distance_meter` (nur mit Aufzeichnung) | Lauf mit Distanz → Lauf, sonst Training |
| Höhe | `altitude_gain_meter` | Höhenmeter |
| Aufgezeichnet | `percent_recorded` | (Spiegel) |

**Nicht** bei WHOOP: GPS-Strecke, Kilometer-Splits/Pace-Verlauf, Runden, Trittfrequenz, Leistung (Rad), Segmente, Bestleistungen je Distanz.
Lauf-Bestzeiten rechnet MAKE OS aus Läufen mit Distanz (`lib/sport/pace.ts`) — mit WHOOP-GPS-Läufen und Läufen von Hand.

## 2. Was Strava zusätzlich liefert

Quelle: https://developers.strava.com/docs/reference/ **belegt** (Felder im Modell DetailedActivity sichtbar): `sport_type`, `distance`, `moving_time`,
`elapsed_time`, `total_elevation_gain`, `average_speed`, `max_speed`, `average_cadence`, `average_watts`, `kilojoules`, `calories`,
`splits_metric`, `laps`, `segment_efforts`, `map.summary_polyline`, `gear`, `device_name`; dazu Streams (Zeit, Distanz, Höhe, Herzfrequenz,
Geschwindigkeit, Trittfrequenz, Leistung, GPS). Herzfrequenz-Mittelwerte im Modell: in der gelesenen Teilseite nicht sichtbar — **Annahme** (vorhanden,
wenn ein Pulsgurt/eine Uhr aufzeichnet).

## 3. Strava-Bedingungen (API Agreement 2026 + API Policy 2026)

Quellen: https://www.strava.com/legal/api (API Agreement, „Effective Date: June 1, 2026“) · https://www.strava.com/legal/api_policy (API Policy,
„Effective Date: June 1, 2026“) · https://developers.strava.com/docs/authentication/ · https://developers.strava.com/docs/rate-limits/ ·
https://developers.strava.com/docs/webhooks/ · https://developers.strava.com/guidelines/ — **belegt** (Wortlaut-Ausschnitte, Abschnittsnummern).

| Thema | Regel | Folge für MAKE OS |
|---|---|---|
| **KI** | Policy § 5.3: keine Nutzung „in connection with the development, training, evaluation, or operation of any AI Application“ — ausdrücklich auch „ingestion into a context window or working memory“, RAG, Embeddings; gilt auch für abgeleitete, aggregierte, anonymisierte Daten. Ausnahme nur die Strava-eigene MCP (§ 3.5). | ZOE, Gesundheits-Agent, Brain-Suche: **nie** Strava-Daten — auch kein Tagesvorschlag aus einem Strava-Lauf. |
| **Speichern** | § 6.2: „You may not retain Strava Data in your cache for longer than seven (7) days“; außerhalb dieses Caches kein Speichern. § 5.5: kein „Persistent Index“ (auch Suchindex, Archiv, Datenbank) für Strava-Daten oder Abgeleitetes. | Kein Spiegel, keine Abbildung in `laeufe`/`training`, keine Bestzeiten/Wochenkilometer über Wochen. |
| **Anzeige** | Agreement-Highlights + Policy § 2.3/§ 6.1: Strava-Daten eines Nutzers nur diesem Nutzer zeigen; nie Daten anderer Nutzer. | Kein Teilen mit dem Partner/Coach — auch nicht mit „teilt.gesundheit“. |
| **Löschen** | § 6.3: in Strava gelöschte Daten binnen 48 h entfernen; § 7.4: bei Widerruf/Wunsch/Konto-Löschung alles binnen 30 Tagen löschen, auf Anfrage schriftlich bestätigen. | Webhook + Löschlauf nötig. |
| **Zugang** | Policy § 3.3: Standard-Tier (bis 10 bzw. 9.999 Nutzer) mit Abo-Pflicht „the developer or specified end users maintain an active Strava subscription“. Rate-Limits-Seite: neue Apps „athlete capacity of 1“ („Single Player Mode“), bis 10 über das Dashboard, darüber Prüfung. | Je Instanz eigene App (keine Weitergabe von Token, § 5.16(c)); Abo bei Strava; für ein verkauftes Produkt (viele Instanzen) unpraktisch. |
| **Vermittler/Agenten** | § 5.16: kein Abstraktions-/Vermittler-Dienst, kein „MCP Server, agent-mediated interface“, das die Strava-API zugänglich macht. | MAKE OS darf keine Strava-Brücke für ZOE bauen. |
| **Gebühren** | § 5.8: Nutzern nichts für den Zugang zu Strava-Daten berechnen. | Für das Produkt (AI-CEO-Instanzen) heikel. |
| **Marke** | Guidelines: „View on Strava“-Link, „Powered by/Compatible with Strava“ nur zur Beschreibung, Connect-Knopf 48 px auf `oauth/authorize`. | Nur bei einer Live-Anzeige relevant. |
| **Technik** | Scopes `activity:read` (nötig für Webhooks) bzw. `activity:read_all`; Zugriffstoken 6 h, Refresh-Token rotiert („the older refresh token is invalidated immediately“); Webhook: Objekte `activity`/`athlete`, `create`/`update`/`delete`, Widerruf als `"authorized": "false"`, Antwort binnen 2 s, bis 3 Versuche; Limits 200 Anfragen/15 min, 2.000/Tag (Lesen 100/1.000). | Wie WHOOP gut machbar — scheitert an den Regeln oben, nicht an der Technik. |

**Einordnung:** Für eine einzelne Person, die ihre eigenen Daten in MAKE OS nur ANSEHEN will, wäre ein schmaler Weg zulässig (7-Tage-Cache,
nur die Person, kein ZOE). Alles, was das Paket „Training sichtbar“ und den Plan-Baukasten wertvoll macht (dauerhaft zählen, Plan ↔ Ist über
Wochen, Prognose aus Bestzeiten, ZOE-Tagesvorschlag), ist mit Strava-API-Daten **nicht** erlaubt.

## 4. Befund am Rande: WHOOP-Bedingungen (gültig ab 06.10.2026)

Quelle: https://developer.whoop.com/api-terms-of-use/ („Effective Date: October 6, 2026“) — **belegt**:
- § 4.2: „Unless authorized by the data owner or by law“ darf die App u. a. nicht „Scrape, build databases, or otherwise create permanent copies of
  WHOOP Data“, Caches nicht länger halten, als der Cache-Header erlaubt, und keine abgeleiteten Werke erstellen.
- § 4.2: kein Modell damit bauen/trainieren („create, develop, test, train, fine-tune or improve any large language model …“) — **Inferenz**
  (Werte im Prompt eines Gesprächs) ist dort nicht genannt → mit Einwilligung (b) wie heute zulässig. **Annahme** (nicht ausdrücklich erlaubt).
- § 2.1/§ 4.2(1): ausdrückliche Zustimmung jedes Nutzers; Weitergabe an andere nur mit „explicit opt-in consent“ (passt zu „teilt.gesundheit“).
- § 2.4: verschlüsselt in Übertragung und Ruhe (MAKE OS: Hülle `MAKE_OS_DATEN_SCHLUESSEL`), Sicherheitsvorfälle binnen 48 h an WHOOP.

**Folge (nicht in diesem Paket geändert, Vorschlag):** MAKE OS speichert WHOOP-Werte dauerhaft (Spiegel `whoop-stand--<person>` bis 400 Tage,
Vitalwerte, Sport-Bestand). Das ist nur mit Zustimmung der „data owner“ gedeckt — die Person ist Inhaberin ihrer Daten. Vorschlag: beim
WHOOP-Verbinden (Karte + Einwilligungstext) ausdrücklich „Ich erlaube MAKE OS, meine WHOOP-Daten in meinem Bereich dauerhaft zu speichern und
auszuwerten (bis ich trenne)“ abfragen und nachweisen; im Empfänger-Register `whoop` vermerken. Einmal anwaltlich gegenlesen.

## 5. Apple Health und Garmin (kurz)

- **Apple Health (HealthKit):** Die Daten liegen auf dem iPhone; es gibt keine Web-/Server-API — eine App liest sie auf dem Gerät und lädt sie
  selbst hoch. **Annahme** (allgemein bekannt; die gelesene Seite https://developer.apple.com/documentation/healthkit/about-the-healthkit-framework
  zeigte keinen Text). Weg für MAKE OS: ein Kurzbefehl (Kurzbefehle-App) „Workouts der letzten Tage → JSON → POST an MAKE OS“ mit eigenem,
  eingeschränkten Schlüssel je Person (Vorbild Zulieferer-Schlüssel). Health sammelt auch Läufe aus Strava/Uhr — das sind dann Daten der Person
  aus Health, nicht aus der Strava-API (**Annahme**, rechtlich gegenlesen).
- **Garmin Connect Developer Program:** Cloud-zu-Cloud-APIs (Health API, Activity API „Full activity data for over 30 activity types“, Training
  API für Pläne aufs Gerät). Zugang/Prüfung/Kosten nennt die Übersichtsseite nicht — https://developer.garmin.com/gc-developer-program/overview/.
  Nur relevant, wenn eine Person eine Garmin-Uhr nutzt; die **Training API** wäre später interessant (Plan aus dem Baukasten auf die Uhr).

## 6. Bauplan (nicht gebaut — erst auf Kevins Wort)

### A — „Lauf aus Datei“ (empfohlen, ohne Strava-API)
- Ein Feld in Sport › Running/Training: Datei wählen (GPX, TCX, FIT; ≤ 10 MB; Typ am Inhalt erkannt, Magic Bytes wie bei Netzwerken).
- Rein `lib/sport/datei-import.ts`: Punkte → Distanz, Dauer, bewegte Zeit, Höhenmeter, Kilometer-Splits, Ø/max Puls (wenn in der Datei);
  Abbildung auf `Lauf` mit `quelle: 'datei'` (neue Quelle) + `externeId: 'datei:<sha256>'` (idempotent), Splits als optionales Feld `splitsSek[]`.
- Doppelte: dieselbe Regel wie heute (`lib/sport/training.ts` — gleicher Tag, gleiche Sparte, Distanz ±10 % = dieselbe Einheit; die Datei liefert
  dann Splits zum WHOOP-Lauf dazu).
- Recht: eigene Daten der Person (Art. 9: Einwilligung (a) zum Speichern, (b) für ZOE wie bei WHOOP); die Datei selbst nicht aufheben (nur die Werte).
- Tests: Fixtures erfunden (synthetische GPX), Splits/Distanz gegen Hand-Rechnung, Idempotenz, Doppel mit WHOOP-Lauf.

### B — „Strava nur ansehen“ (zulässig, aber wenig Wert — nicht empfohlen)
- Eigene Strava-App je Instanz (Kevin: https://www.strava.com/settings/api anlegen; Standard-Tier, Abo-Pflicht beachten; Kapazität 1 → 10).
- Verbindung je Person nach Vorbild `lib/whoop/verbindung.ts` (Scope `activity:read_all`, Token-Rotation streng hintereinander, Widerruf über
  `oauth/revoke`), Webhook `POST /api/strava/webhook` (Abo-Prüfung `hub.challenge`, Antwort < 2 s, `authorized: false` → alles löschen).
- **Nur** ein Cache je Person mit Ablauf 7 Tage (Löschlauf im Takt), nie in `laeufe`/`training`, nie im Brain-Index, nie an ZOE (eigene
  KI-Kategorie „strava“, im KI-Tor immer gesperrt), nie geteilt; Anzeige „Letzte 7 Tage auf Strava“ mit „View on Strava“-Link.
- Wächter: kein Weg von Strava-Daten in `askText`, in den Sport-Bestand, in Suchindex/Brain, an eine andere Person.

### C — Apple Health per Kurzbefehl (später)
- Route `POST /api/sport/health-import` mit eigenem Schlüssel je Person (nie der Dienstschlüssel), Workouts → `TrainingEinheit` mit
  `quelle: 'apple-health'` + `externeId`, gleiche Doppel-Regel. Anleitung für den Kurzbefehl in UPDATES.md.
