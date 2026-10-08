# Fakten: WHOOP-API für MAKE OS (Verbindung je Person)

Stand: 08.10.2026 · alle Quellen abgerufen am 08.10.2026 · keine Rechtsberatung.
Kennzeichnung: **belegt** = offizielle Doku (developer.whoop.com) · **Annahme** = dort nicht ausdrücklich belegt.

---

## 1. API-Version
**Befund:** Die v1-API wird „no longer supported“; neue Funktionen kommen nur noch in v2. v1-Webhooks sind laut Banner entfernt
(„no longer published“). Ein Abschaltdatum für v1-Endpunkte nennt die Seite nicht.
- v2 nutzt dieselben Ressourcen mit `/v2/`-Präfix. Schlaf- und Workout-IDs sind jetzt **UUIDs** (vorher Ganzzahlen; `v1_id` bleibt als Feld).
- Recovery-Webhooks tragen in v2 die **UUID des zugehörigen Schlafs** (nicht mehr die Zyklus-ID).
**Quelle:** https://developer.whoop.com/docs/developing/v1-v2-migration
**Folge für MAKE OS:** Der alte Rohbau (`/api/whoop/sync`, `…/developer/v1`) ist abgelöst; gebaut wird nur gegen v2. **belegt**

## 2. OAuth 2.0
- Autorisierung: `https://api.prod.whoop.com/oauth/oauth2/auth` · Token (auch Erneuern): `https://api.prod.whoop.com/oauth/oauth2/token` **belegt**
- Redirect-URL muss im WHOOP Developer Dashboard eingetragen sein. **belegt**
- `state` ist Pflicht (CSRF): „The state parameter must be eight characters long if you need to generate it yourself.“ → MAKE OS erzeugt
  genau 8 Zeichen [A-Za-z0-9] (crypto.randomInt), einmalig, 15 Minuten, an die Person der Sitzung gebunden. **belegt** (Länge) / Bindung = eigene Regel
- Refresh-Token nur mit Scope `offline` („You must request the offline scope to receive a refresh token“). **belegt**
- **Rotation:** Mit dem Erneuern werden bestehende Zugriffstoken ungültig; das neue Refresh-Token aus der Antwort muss für das nächste Erneuern
  benutzt werden. Zwei gleichzeitige Erneuerungen: die erste gelingt, die zweite scheitert. → MAKE OS erneuert höchstens einmal gleichzeitig
  je Person und speichert das neue Refresh-Token sofort. **belegt**
- Erneuern: POST an den Token-Endpunkt mit `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`, `scope` (Beispiel: `offline`). **belegt**
- `expires_in` in Sekunden (Beispiel 3600, keine feste Zusage). **belegt**
- Ungültiges/abgelaufenes Token → `401 Unauthorized`. **belegt**
- **PKCE:** auf der Seite nicht erwähnt → MAKE OS nutzt kein PKCE (vertraulicher Client mit Secret + `state`). **Annahme** (nicht belegt, ob unterstützt)
- Widerruf: `DELETE /v2/user/access` (revokeUserOAuthAccess) mit dem Bearer-Token der Person. **belegt**
**Quellen:** https://developer.whoop.com/docs/developing/oauth · https://developer.whoop.com/api

## 3. Scopes
`read:recovery`, `read:cycles`, `read:workout`, `read:sleep`, `read:profile`, `read:body_measurement` (+ `offline`). **belegt**
**MAKE OS fordert an:** `offline read:recovery read:cycles read:workout read:sleep read:profile` — bewusst **nicht** `read:body_measurement`
(Größe/Gewicht braucht MAKE OS nicht; Datenminimierung). `read:profile` nur für `user_id` (Zuordnung der Webhooks) und die Adresse (nur maskiert angezeigt).
**Quelle:** https://developer.whoop.com/api

## 4. Endpunkte (Basis `https://api.prod.whoop.com/developer`) **belegt**
| Zweck | Pfad | Parameter |
|---|---|---|
| Zyklen (Strain) | `GET /v2/cycle` | `limit` (≤ 25, Standard 10), `start`, `end`, `nextToken` |
| Recovery | `GET /v2/recovery` | wie oben |
| Schlaf | `GET /v2/activity/sleep` | wie oben |
| Workouts | `GET /v2/activity/workout` | wie oben |
| Einzelabruf | `GET /v2/activity/sleep/{sleepId}`, `GET /v2/activity/workout/{workoutId}`, `GET /v2/cycle/{cycleId}/recovery` | — |
| Profil | `GET /v2/user/profile/basic` | → `user_id`, `email`, `first_name`, `last_name` |
| Körper | `GET /v2/user/measurement/body` | (nicht genutzt) |
| Widerruf | `DELETE /v2/user/access` | — |

- **Pagination:** Antwort `{ records: [...], next_token }`; `next_token` als `nextToken` an die nächste Anfrage. **belegt**
- Hinweis: Die Recovery-Seite der Doku sagt „über die Cycle-Endpunkte“; die API-Referenz führt `GET /v2/recovery` als Sammlung. MAKE OS nutzt
  `GET /v2/recovery` (API-Referenz). **belegt** (beide Stellen) — Widerspruch in der Doku vermerkt.
**Quellen:** https://developer.whoop.com/api · https://developer.whoop.com/docs/developing/user-data/recovery

## 5. Felder (v2) **belegt**
- **Recovery:** `cycle_id`, `sleep_id`, `user_id`, `created_at`, `updated_at`, `score_state`, `score` = `recovery_score`, `resting_heart_rate`,
  `hrv_rmssd_milli`, `spo2_percentage`, `skin_temp_celsius`, `user_calibrating`.
- **score_state:** `SCORED` (Werte vorhanden, `score` nur dann), `PENDING_SCORE` (wird noch bewertet), `UNSCORABLE` (zu wenig Daten).
- Recovery wird beim Aufwachen berechnet; Zuordnung zu einem Kalendertag ist **nicht** dokumentiert → MAKE OS nimmt den Tag des Schlaf-Endes
  (Ortszeit über `timezone_offset`), ohne bekannten Schlaf den Berliner Tag von `created_at`. **Annahme**
- **Schlaf:** `id` (UUID), `cycle_id`, `v1_id`, `user_id`, `start`, `end`, `timezone_offset`, `nap`, `score_state`, `score.stage_summary`
  (`total_in_bed_time_milli`, `total_awake_time_milli`, `total_light_sleep_time_milli`, `total_slow_wave_sleep_time_milli`,
  `total_rem_sleep_time_milli`, `sleep_cycle_count`, `disturbance_count` …), `respiratory_rate`, `sleep_performance_percentage`,
  `sleep_consistency_percentage`, `sleep_efficiency_percentage`. Schlafdauer in MAKE OS = leicht + Tiefschlaf + REM (wie der alte Rohbau).
- **Zyklus:** `id`, `start`, `end`, `timezone_offset`, `score_state`, `score` = `strain`, `kilojoule`, `average_heart_rate`, `max_heart_rate`.
- **Workout:** `id` (UUID), `v1_id`, `start`, `end`, `timezone_offset`, `sport_name`, `sport_id`, `score_state`, `score` = `strain`,
  `average_heart_rate`, `max_heart_rate`, `kilojoule`, `percent_recorded`, `distance_meter`, `altitude_gain_meter`, `zone_durations`.
- Welche `sport_name`-Werte es gibt, steht nicht auf den gelesenen Seiten → „Lauf“ = `sport_name` „running“ (Groß/klein egal) mit Distanz. **Annahme**
**Quelle:** https://developer.whoop.com/api

## 6. Rate-Limits **belegt**
100 Anfragen/Minute und 10.000/Tag (anhebbar). Köpfe `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Sekunden bis
zum Zurücksetzen). Überschritten → `429`. Ein `Retry-After` nennt die Seite nicht → MAKE OS pausiert nach `X-RateLimit-Reset` (sonst Backoff).
**Quelle:** https://developer.whoop.com/docs/developing/rate-limiting

## 7. Webhooks **belegt**
- Ereignisse: `workout.updated`, `workout.deleted`, `sleep.updated`, `sleep.deleted`, `recovery.updated`, `recovery.deleted`
  (Anlegen kommt als „updated“). **Kein Ereignis für Zyklen (Strain)** → die kommen über den Takt.
- Körper (JSON): `user_id` (int64), `id` (v2: UUID; bei Recovery die UUID des Schlafs), `type`, `trace_id` (zum Erkennen von Doppelten).
- Signatur: `X-WHOOP-Signature` = `base64(HMAC-SHA256(X-WHOOP-Signature-Timestamp + rawBody, client_secret))`; Zeitstempel in ms.
  Geheimnis ist das **Client Secret** der App (kein eigenes Webhook-Geheimnis).
- Antwort: 2XX, „within a second“ — langsame Arbeit in den Hintergrund. Fehlgeschlagen (nicht 2XX oder Zeitüberschreitung) → bis zu
  5 Wiederholungen über etwa eine Stunde.
- Version je Webhook-URL im Dashboard („Model Version“): **v2** wählen (v1 entfernt).
- Ein Höchstalter für den Zeitstempel (Replay-Fenster) nennt die Doku nicht → MAKE OS prüft kein Alter; doppelte `trace_id` wirken nicht
  zweimal, und eine gültige Meldung löst ohnehin nur einen Abgleich aus. **Annahme**
**Quelle:** https://developer.whoop.com/docs/developing/webhooks

## 8. Was nicht belegt ist (offen)
- PKCE-Unterstützung (siehe 2).
- Ob v1-Token für v2 gelten: der alte gemeinsame Token des Inhabers wird beim Übergang einmal übernommen; scheitert er (401/Scope), muss
  der Inhaber neu verbinden. **Annahme**
- DPF-Zertifizierung von WHOOP (Drittland USA) — im Empfänger-Register als „zu prüfen“ geführt, nicht behauptet.
