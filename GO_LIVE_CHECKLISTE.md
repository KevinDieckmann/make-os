# Go-Live-Checkliste — Stand `entwicklung` mit Paket U1 (29.09.2026 spät; online läuft af4679a)

**Urteil: Ja, mit Bedingungen.** Im Code blockiert nichts: tsc, Lint und alle Tests sind grün. Die Funde der Upload-Prüfung
`af4679a..entwicklung` sind behoben (Paket U1): Familien-Daten bringen den alten Stand nicht mehr zum Absturz, der Kalender
schreibt beim ersten Takt nichts ungefragt nach iCloud, die Kalender-Sicherung startet nie gleich nach dem Upload und bleibt
wirklich nur 14 Tage, Caddy lässt die strengen Köpfe der Buchungsseite stehen.

**Rückweg ist möglich (Kompatibilitätsmodus).** Ohne `MAKE_OS_FORMAT` schreibt die neue Version im Format des Online-Stands
af4679a (v1-Hülle, `MKOSDAT1`, kein `_v`). Beim Zurückgehen fallen nur Dinge weg, die af4679a nicht kennt (Liste unten unter
„Rückweg“). **Die Wochenplan-Übernahme macht den Rückweg aufwendiger** — deshalb erst nach ein paar stabilen Tagen (siehe
„Am ersten Tag“). Erst `MAKE_OS_FORMAT=v2` macht den Upload zur Einbahnstraße (dann nur noch über die Sicherung zurück).

Alle Befehle auf dem Server als `make`, im Ordner `/srv/make-os/app`, außer wo „am Mac“ steht. Werte (Schlüssel, Passwörter)
nie in Chat oder Repo.

## Vor dem Upload
1. `git status --short` → leer, und `git status -sb` → erste Zeile ohne „ahead“ (sonst bricht das Ausrollen ab).
2. **Platz:** `df -h /` und `docker system df` → auf `/` mindestens **5 GB frei**. Sonst zuerst `docker builder prune -af`
   (löscht nur den Bau-Zwischenspeicher, keine Bilder mit Namen, keine Daten) und noch einmal prüfen.
3. **Format:** `grep '^MAKE_OS_FORMAT=' .env` → **leer** (keine Zeile). Steht dort `v2`, gibt es keinen Rückweg — dann erst klären.
4. Seit dem Upload von af4679a eingerichtet — nur prüfen, nichts ändern:
   `id -u make` → `1000` · `test -d /srv/make-os/grabsteine && test -d /srv/make-os/schluessel && echo ORDNER-OK` ·
   Datenschlüssel liegt, wo er lag (`.env` oder Schlüssel-Datei — af4679a kennt beide) · age/Pepper wie gehabt.
5. **Kevin und Malin schließen alle MAKE-OS-Tabs auf allen Geräten** und geben bis nach „Direkt nach dem Upload“ 4 nichts ein.
6. **Sicherung und altes Bild merken (Pflicht)** — Zeile für Zeile, jede Ausgabe prüfen:
   ```
   docker compose stop app arbeiter
   sudo tar -C /srv/make-os --exclude='daten/brain-index.sqlite*' -czf /srv/make-os/sicherungen/vor-upload-$(date +%F-%H%M).tar.gz daten grabsteine; echo "tar-Ergebnis: $?"
   docker tag make-os:aktuell make-os:af4679a
   docker compose start app arbeiter
   docker image ls make-os
   docker run --rm --entrypoint sh make-os:af4679a -c 'test -e lib/store/huelle.mjs && test ! -e lib/kalender/bezug.ts && echo ALTES-BILD-OK'
   sudo chown make:make /srv/make-os/sicherungen/vor-upload-*.tar.gz && chmod 600 /srv/make-os/sicherungen/vor-upload-*.tar.gz
   ```
   Nur bei `tar-Ergebnis: 0`, gleicher Image-ID für `af4679a` und `aktuell` und `ALTES-BILD-OK` weitermachen (die Probe
   passt nur auf af4679a: `huelle.mjs` gibt es dort, `lib/kalender/bezug.ts` erst im neuen Stand). Kopie auf den Mac nur
   verschlüsselt: `age -R /srv/make-os/sicherung.pub -o <datei>.age <datei>`, dann die `.age`-Datei per `scp` holen.
7. Auf GitHub: Repo-Variable `AUSROLLEN` ist nicht `aus`; im letzten Ausroll-Log stehen `ausrollen-v2` und „Bild zum Server schicken“.

## Upload (nur auf Kevins Wort)
Am Mac: `cd ~/Claude/Projects/MakeOS && git push origin entwicklung:main && git push origin entwicklung` → GitHub-Action
(~10–12 Min.): „pruefen“ grün, im Ausroll-Log „fertig: <neuester Commit> …“.

## Direkt nach dem Upload
1. `docker compose ps` → app healthy (bis ~30 s „starting“ ist normal), arbeiter läuft.
2. `docker compose logs --since 10m app | grep -iE "local-db|MAKE OS\]|klartext|schluessel fehlt|entschlüsselung|nicht lesbar|beschädigt|gescheitert|lockfile|⨯|\[spiegel\]|\[wochenplan-uebernahme\]|\[kalender-sicherung\]"`
   Erwartet und in Ordnung:
   - `[MAKE OS] Absichten beim Start: … 0 gescheitert.`
   - `[spiegel] n abgesagte(s) Event(s) mit Termin im Kalender gemeldet: …` (nur Kennungen; die Glocke sagt, was zu tun ist)
   - `[wochenplan-uebernahme] …` — sollte am ersten Tag gar nicht erscheinen (die Übernahme startet nur auf Klick).
   - `[kalender-sicherung] n Kalender gesichert, 0 Fehler` — erst nachts zwischen 03:00 und 05:00, nie direkt nach dem Start.
   Ansehen, aber kein Grund zum Rückweg: `[spiegel] n Termin(e) nicht nachgezogen: …` (Serie/Gäste/nur lesbar — Kennung +
   Grund stehen dabei). **Anhalten, nichts eingeben, Rückweg prüfen** bei jeder anderen Zeile, besonders
   `nicht lesbar`, `entschlüsselung`, `schluessel fehlt`, `[kalender-sicherung] Stand nicht lesbar`.
3. **Caddy neu laden** (die Caddyfile hat sich geändert — Buchungsseite behält ihre strengen Köpfe; der Container lädt sie nicht von selbst):
   ```
   docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
   curl -sI https://2-28-108-162.sslip.io/buchen/probe-000000000000000000000000 | grep -iE 'referrer-policy|permissions-policy'
   ```
   → `referrer-policy: no-referrer` und `permissions-policy: camera=(), microphone=(), …`. Eine andere Seite (z. B. `/anmelden`)
   zeigt weiter `strict-origin-when-cross-origin`.
4. Auf allen Geräten neu laden (Handy: Tab bzw. Home-Screen-App schließen und neu öffnen).
5. Kurztest: anmelden · Aufgabe anlegen, abhaken, „Rückgängig“ · CRM Kontakt öffnen, ein Feld ändern · Mandat öffnen, Titel
   ändern · Angebot nur Entwurf und Vorschau · Glocke · eine ZOE-Frage · Finanzplan öffnen · Kalender öffnen (Woche, Modus
   „Planen“: die Karte „Alter Wochenplan“ zeigt den gelben Hinweis — **nicht** übernehmen) · Familie öffnen (Wichtige Tage
   laden) · `/os/hoi`: kein „Klartext-Bestand abgelehnt“, „Abgebrochene Vorgänge: keine“, gelb „Kompatibilitätsmodus“ ist erwartet.
6. Sicherung einmal von Hand, vorher die heutige Nachtsicherung schützen:
   `for f in /srv/make-os/sicherungen/make-os-$(date +%F).tar.gz.*; do [ -e "$f" ] && mv "$f" "$(dirname "$f")/vor-upload-nacht-$(basename "$f")"; done`
   dann `bash /srv/make-os/app/deploy/sicherung.sh` (als make, ohne sudo) → letzte Zeile endet auf `: ok (Ping: …)` bzw. ohne
   age auf `: warnung — age fehlt — Sicherung nur mit Übergangs-Verschlüsselung …`. Die Kalender-Tagesdateien
   (`archiv/kalender-export-*`) sind bewusst NICHT im Archiv.

## Rückweg, falls nötig (solange `MAKE_OS_FORMAT` nicht `v2` ist)
**Vorher prüfen:**
1. Offene Vorgänge: als Kevin im Browser `/api/intern/absichten` öffnen (oder am Server
   `docker compose exec -T app node -e "fetch('http://localhost:3000/api/intern/absichten',{headers:{'x-make-key':process.env.MAKE_OS_KEY}}).then(r=>r.text()).then(console.log)"`)
   → keine Absicht der Art `buchung` oder `wochenplan-uebernahme` mit Status `offen`/`unvollstaendig`. af4679a kennt diese
   Arten nicht, setzt sie nicht fort und meldet sie nach drei Versuchen als „gescheitert“. Offene zuerst fertig werden lassen
   (bzw. „Erneut versuchen“ in der Planen-Karte).
2. **War die Wochenplan-Übernahme schon?** Dann zuerst Kalender › Planen › „Übernahme zurücknehmen …“ (Probelauf mit Zahlen,
   dann Rückfrage). Das löscht in iCloud genau die Termine mit der Kennung `makeos-wochenplan-…` und setzt den Übernahme-Stand
   zurück; Termine mit Gästen/Serien bleiben stehen (Teilnehmer-Sperre, die Zahl steht in der Rückfrage — in Apple von Hand
   löschen). Änderungen, die ihr seitdem an diesen Blöcken gemacht habt, gehen dabei verloren. Apple-Kopien, die zum Block
   wurden, bleiben (af4679a kennt sie). Blöcke, die nach dem Upload neu in „Planen“ entstanden, bleiben als normale Termine.
3. Offene Buchungsanfragen beantworten oder ablehnen — **die Buchungslinks sind nach dem Rückweg tot** (af4679a hat keine
   Buchungsseite).

**Dann:**
```
docker compose stop app arbeiter
docker tag make-os:af4679a make-os:aktuell
docker compose up -d --no-build
```
Danach am Mac `main` zurückdrehen, sonst rollt die nächste Action wieder aus:
```
git switch -c rueckweg origin/main && git revert --no-edit --no-commit af4679a..HEAD && git commit -m "Rückweg: Stand af4679a"
git diff --stat af4679a HEAD      # muss leer sein
git push origin rueckweg:main
```
Dieser Push rollt den alten Code erneut aus (gewollt). Wer das nicht will: vorher die Repo-Variable `AUSROLLEN=aus` setzen.
Danach auf dem Server einmal `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` (die alte Caddyfile gilt
wieder; ohne Buchungsseite ist das unkritisch).
Nur im Notfall auf die Sicherung aus „Vor dem Upload“ 6 zurück (dann ist alles seit dem Upload weg).

**Nach dem Rückweg zusätzlich (Art. 17 / 14-Tage-Zusage):** af4679a räumt die Kalender-Tagesdateien nicht auf und nimmt sie ins Nachtarchiv — deshalb direkt nach dem Rückweg `rm -f /srv/make-os/daten/archiv/kalender-export-*` (als make).

**Was beim Rückweg wegfällt oder später doppelt kommen kann** (af4679a verwirft beim nächsten Schreiben, was er nicht kennt):
- Aufgaben: Uhrzeit der Deadline (`dueTime`), Anlass „Geschenk“ (→ Heute bietet „Geschenk vormerken“ evtl. noch einmal an).
- CRM: Geburtstag am Kontakt; Meeting-Aktivitäten verlieren den Verweis auf ihren Termin (`terminUid`), Follow-ups ebenso.
- Kalender-Einstellungen: belegte Kalender, freie Tage, Steuertermin-Vorlage, Kündigungs-Vorlauf → Standardwerte.
- Glocke: Meldungen der Arten „buchung“ und „kalender“ verschwinden.
- Event- und Familien-Termine, die die neue Version angelegt hat, bleiben in Apple, ziehen aber nicht mehr nach.
- Art. 17 in der Rückweg-Zeit: af4679a kennt `kalender-bezug` und `buchung--…` nicht — wer in der Zeit gelöscht wird, dessen
  Einträge dort bleiben. Nach dem nächsten Upload die Löschung dieser Personen noch einmal auslösen.
- **Umbenennung MAKE OS UG → MAKE Innovation GmbH (30.09.):** af4679a/677400e kennen den neuen Namen nicht. Nichts geht
  verloren (keine feste Namensliste verwirft ihn), aber: Aufgaben, Ziele, Wochenplan-Blöcke und Zeit-Blöcke, die inzwischen
  „MAKE Innovation GmbH“ tragen, erscheinen dort als **eigene Einheit** (grau, eigene Filter-Pille bzw. eigene Zeile in „Zeit je
  Einheit“) neben „MAKE OS UG“ — der Space `ug` bleibt richtig. Das Finanzplan-Konto und eine geänderte Firmierung zeigen den
  neuen Text. Eine Widget-Einstellung „nur MAKE Innovation GmbH“ zeigt im alten Stand nur die Aufgaben mit dem neuen Namen.
  ZOE im alten Stand ordnet eine freie Angabe „MAKE Innovation“ der Selbstständigkeit zu (nur neue Eingaben). Nach einem
  erneuten Upload fügt sich alles wieder zusammen (die Altnamen werden erkannt).
- **Zeitstrahl & Planen im nächsten Jahr (30.09.):** keine Formänderung, nur optionale Zusatzfelder. af4679a/677400e
  - verwerfen `jahr` am Jahresziel beim nächsten Speichern dieses Ziels — im alten Stand stehen Ziele fürs nächste Jahr
    zwischen denen des laufenden, und ein **Zahlenziel fürs nächste Jahr kaskadiert dort sofort** in Quartal/Monat/Woche/Tag des
    laufenden Jahres (vor dem Rückweg solche Zahlenziele notieren oder die Zahl kurz herausnehmen);
  - verwerfen `zielId` (Ziel-Bezug am Meilenstein) beim nächsten Speichern des Meilensteins — Datum, Bereich, Einheit bleiben;
  - zeigen Meilensteine des nächsten Jahres in der Jahresliste des laufenden Jahres (alter Filter „ab 1. Januar“) und nur bis
    Dezember auf dem Zeitstrahl; der Business-/Gesundheits-Index zählt sie wieder mit 0 % in den Kurs;
  - kennen den **Fokus je Jahr** nicht: `…jahr:<Jahr>`-Schlüssel bleiben gespeichert, werden aber nicht gezeigt; der Fokus des
    laufenden Jahres steht wie bisher unter `jahr`/`privat:jahr`/`business:jahr` (die neue Version schreibt ihn doppelt).
    Wird der Fokus im alten Stand geändert und danach wieder die neue Version eingespielt, gilt der zuletzt in der NEUEN
    Version gespeicherte Satz (`…jahr:<Jahr>`) — dann einmal auf der Jahresseite prüfen.
- **Meilensteine im Detail (30.09.):** Projekt „Meilensteine“ und die Listen `lm-…` bleiben (af4679a kennt Projekte/Listen), die
  Aufgaben darin auch — nur die Detailseite, der Verlauf/die Notizen/Links (`meilenstein-raum--<haushalt>`, af4679a liest ihn nie
  und schreibt ihn nie) und die Rechenregel fehlen; der Fortschritt bleibt auf dem zuletzt errechneten Wert stehen (dann wieder von
  Hand). `zielId` am Meilenstein fällt beim nächsten Speichern eines Meilensteins weg. Dateien an der Liste (`listeId`) erscheinen
  als Dateien des Projekts „Meilensteine“. Nach einem erneuten Upload stimmt alles wieder (Verweise nur per Kennung).
- **Mehrstufige Unteraufgaben (bis 5 Ebenen, 01.10.):** keine Formänderung — `parentId` gab es schon, es darf jetzt auf eine
  Unteraufgabe zeigen. af4679a/6111e71 kennt nur zwei Ebenen: seine Übernahme (`uebernehmen`, läuft bei jedem Lesen) hängt jede
  tiefere Unteraufgabe beim nächsten Speichern an die **oberste** Aufgabe (Ebene 2) und gibt ihr deren Space/Projekt/Liste —
  Titel, Beschreibung, Notiz, Status, Zuständige, Dateien, Kommentare, Verlauf und Papierkorb-Stand (`geloeschtMit`) bleiben
  erhalten, **nur die Zwischenebene geht verloren** (die Reihenfolge der Kinder bleibt über `sortOrder`). Fortschritt am
  Meilenstein und „n/m“ zählen dort nur die flachen Unteraufgaben (der Meilenstein-Wert steht ohnehin auf dem zuletzt
  errechneten Stand, siehe oben). Vor dem Rückweg: Aufgaben mit Ebene 3+ in der Aufgaben-Seite kurz notieren, wenn die Gliederung
  wichtig ist; nach einem erneuten Upload bleibt es flach (nichts wird von selbst wieder tief). Kreise können im alten Stand
  nicht entstehen; die neue Version lehnt sie ab (Meldung „Abgelehnt: … kann nicht unter ihrer eigenen Unteraufgabe liegen“).
- **Ziel ↔ Meilenstein (01.10.):** nur optionale Zusatzfelder, keine Formänderung. Der Säuberer des Online-Stands (af4679a) verwirft sie beim
  nächsten Speichern des jeweiligen Eintrags — und sonst nichts (geprüft mit dem wörtlich kopierten alten Säuberer, `tests/ziel-kette-0110.test.ts`):
  - `wartetAuf` am Meilenstein („wartet auf“, die Kette im Ziel-Detail): die Abhängigkeiten sind weg, die Meilensteine bleiben mit Titel,
    Datum, Rang, Einheit, Aufgaben und Verlauf; die Kette ist dort einfach flach (nichts wartet mehr, kein „wartet“-Hinweis in Glocke/Kalender).
    Vor dem Rückweg die Abhängigkeiten wichtiger Ziele notieren, wenn sie nach dem nächsten Upload wieder gebraucht werden;
  - `messlatte` am Ziel (Ziel-Detail): fällt weg; die Beschreibung (`notiz`) bleibt (bis 400 Zeichen, dieselbe Grenze wie im alten Stand);
  - `zielId` am Meilenstein (30.09., siehe oben): der Ziel-Bezug fällt weg — dann stehen die Meilensteine dort ohne Ziel.
  Die neue Seite `/os/planung/ziel/<id>` gibt es im alten Stand nicht (Links aus der Liste fehlen dort ohnehin). Kein neuer Bestand, kein
  Eintrag im Speicher-Register (Art. 17 unverändert: die Felder liegen in `ziele`/`meilensteine`). Nach einem erneuten Upload: Ziel-Zuordnung
  und Abhängigkeiten neu setzen — die Verbindungsprüfung meldet nur tote Verweise, keine fehlenden.
- **Nach einem erneuten Upload** können Meetings (Kalender-Signal) und Geschenk-Vorschläge doppelt erscheinen →
  CRM › Verbindungsprüfung laufen lassen und Doppelte entfernen.

## Am ersten Tag
1. **Wochenplan-Übernahme NICHT am ersten Tag.** Erst nach ein paar stabilen Tagen: Kalender › Planen › Karte „Alter
   Wochenplan“ → Vorschau → „Jetzt übernehmen“ (die Rückfrage wiederholt den Hinweis). Bis dahin stehen die alten Blöcke
   gestrichelt „wartet auf Übernahme“ im Raster — nichts geht verloren. Scheitert etwas an iCloud (Netz, Überlast), macht die
   Übernahme später von selbst weiter; übersprungene Blöcke zeigt die Karte mit „Erneut versuchen“.
2. Alte Make.One-Events mit Termin (Kennung `mac-…`): die Verbindungsprüfung nennt sie („alte Kalender-Marke“). Verknüpft wird
   NUR per Klick auf der Event-Seite („Mit dem Kalender verknüpfen“) — nie von selbst.
3. **Nicht** in den ersten Tagen: `MAKE_OS_FORMAT=v2`, Kennungs-Umzug der Kontakte, `MAKE_OS_APP_SPIEGEL=an`.
4. Aufgaben › Überblick › „Neu anfangen …“ nur, wenn ihr es wollt — ein Rückweg würde die neue Planung (Listen, Gruppen,
   Serien) nicht kennen.

## Nächster Morgen
- Tagesstart gelaufen, Durchsicht ab 4 Uhr erledigt.
- `/os/hoi`: **„Kalender-Sicherung“ grün** (lief zwischen 03:00 und 05:00; war der Server da kürzer als 30 Minuten wach, kommt
  sie erst in der Nacht darauf). „Sicherung geprüft“ ist nur mit age grün. Gelb erwartet: Kompatibilitätsmodus, Pepper,
  Schlüssel in der Umgebung, Healthcheck, Abholung.
- `du -sh /srv/make-os/daten/archiv` → notieren; die Kalender-Tagesdateien bleiben 14 Tage je Kalender (Fenster −400 …
  +800 Tage), das Archiv wächst danach nicht mehr.
- Glocke: meldet sie ein abgesagtes Event mit Termin, auf der Event-Seite „Termin im Kalender löschen“ (der Takt löscht nie selbst).

## Hinweis zum Healthcheck
Solange age fehlt, meldet die Nachtsicherung bewusst `/fail` an Healthchecks (Erinnerung). Wer das nicht will: age zuerst einrichten.
