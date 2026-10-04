# Go-Live-Checkliste — Update vom 04.10.2026 (online läuft `f0c5526`)

**Urteil: Ja, mit Bedingungen.** Im Code blockiert nichts: tsc, Build und alle Tests (4606) sind grün; Code-Review und
Praxis-Prüfung sind abgearbeitet. Hochgeladen wird `f0c5526..entwicklung`: Lichtfäden v2 (Fokus-Baum, Planung/Ziel/Meilenstein/Fokus),
Design-Standard Kern (Shell, Aufgaben, Kalender, Inbox) und Privat/ZOE/System, Fokus Innovation (`Event.reihe`, Seite `fokus/`
noch NICHT ausgeliefert), Review-Fixes (eine Quelle für Ziel-Farbe/Space/Schalter) und **Datenschutz-Fixes, die schon online
offen waren** (Familie „nur ich“-Tage, Routinen der Partnerin im Gesundheits-Index, „nur ich“-Unteraufgaben in den Lichtfäden).
Der Online-Stand `f0c5526` enthält alles bis zum großen Update vom 03.10.; diese Punkte stehen unten nur noch als „früher“.

**Rückweg ist möglich (Kompatibilitätsmodus).** Ohne `MAKE_OS_FORMAT` schreibt die neue Version im Format des Online-Stands
(v1-Hülle, `MKOSDAT1`, kein `_v`). Beim Zurückgehen auf `f0c5526` fallen nur Dinge weg, die dieser Stand nicht kennt (Liste
unten unter „Rückweg“). Erst `MAKE_OS_FORMAT=v2` macht den Upload zur Einbahnstraße (dann nur noch über die Sicherung zurück).

Alle Befehle auf dem Server als `make`, im Ordner `/srv/make-os/app`, außer wo „am Mac“ steht. Werte (Schlüssel, Passwörter)
nie in Chat oder Repo.

## Vor dem Upload
1. `git status --short` → leer, und `git status -sb` → erste Zeile ohne „ahead“ (sonst bricht das Ausrollen ab).
2. **Platz:** `df -h /` und `docker system df` → auf `/` mindestens **5 GB frei**. Sonst zuerst `docker builder prune -af`
   (löscht nur den Bau-Zwischenspeicher, keine Bilder mit Namen, keine Daten) und noch einmal prüfen.
3. **Format:** `grep '^MAKE_OS_FORMAT=' .env` → **leer** (keine Zeile). Steht dort `v2`, gibt es keinen Rückweg — dann erst klären.
4. Seit den früheren Uploads eingerichtet — nur prüfen, nichts ändern:
   `id -u make` → `1000` · `test -d /srv/make-os/grabsteine && test -d /srv/make-os/schluessel && echo ORDNER-OK` ·
   Datenschlüssel liegt, wo er lag (`.env` oder Schlüssel-Datei — der Online-Stand kennt beide) · age/Pepper wie gehabt.
5. **Kevin und Malin schließen alle MAKE-OS-Tabs auf allen Geräten** und geben bis nach „Direkt nach dem Upload“ 4 nichts ein.
6. **Sicherung und altes Bild merken (Pflicht)** — das alte Bild bekommt den Tag `make-os:f0c5526` — Zeile für Zeile, jede Ausgabe prüfen:
   ```
   docker compose stop app arbeiter
   sudo tar -C /srv/make-os --exclude='daten/brain-index.sqlite*' -czf /srv/make-os/sicherungen/vor-upload-$(date +%F-%H%M).tar.gz daten grabsteine; echo "tar-Ergebnis: $?"
   docker tag make-os:aktuell make-os:f0c5526
   docker compose start app arbeiter
   docker image ls make-os
   docker run --rm --entrypoint sh make-os:f0c5526 -c 'test -e lib/crm/scoring.ts && test ! -e lib/lichtfaeden/modell.ts && echo ALTES-BILD-OK'
   sudo chown make:make /srv/make-os/sicherungen/vor-upload-*.tar.gz && chmod 600 /srv/make-os/sicherungen/vor-upload-*.tar.gz
   ```
   Nur bei `tar-Ergebnis: 0`, gleicher Image-ID für `f0c5526` und `aktuell` und `ALTES-BILD-OK` weitermachen (die Probe
   passt nur auf f0c5526: `lib/crm/scoring.ts` gibt es dort, `lib/lichtfaeden/modell.ts` erst im neuen Stand — am Mac
   gegenprüfbar mit `git cat-file -e f0c5526:lib/crm/scoring.ts` (ok) und `git cat-file -e f0c5526:lib/lichtfaeden/modell.ts` (muss „not in“ melden), `HEAD` kennt beide). Kopie auf den Mac nur
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
3. **Caddy:** seit `f0c5526` unverändert — nichts neu zu laden (neu in `deploy/` sind nur `env.server.beispiel` und `google-verbinden.sh`). Am Mac vorab: `git diff --stat f0c5526 HEAD -- deploy/caddy compose.yml Dockerfile`
   → leer (sonst die Schritte aus der alten Fassung dieser Liste nachholen: `caddy validate` + `caddy reload`). Neu ist nur die
   Abhängigkeit `qrcode-generator` (Dev: `jsqr`): das Image-Bauen läuft dafür `npm ci` — die Action macht das von selbst.
4. Auf allen Geräten neu laden (Handy: Tab bzw. Home-Screen-App schließen und neu öffnen).
5. Kurztest: anmelden · Aufgabe anlegen, abhaken, „Rückgängig“ · CRM Kontakt öffnen, ein Feld ändern · Mandat öffnen, Titel
   ändern · Angebot nur Entwurf und Vorschau · Glocke · eine ZOE-Frage · Finanzplanung öffnen (Steuerprofil, Business-Blatt je
   Gesellschaft, Zahlen plausibel) · Ziel öffnen (Kette „wartet auf“) · Netzwerken › Meine Visitenkarte (QR) und Erfassen auf
   einer Veranstaltung (Handy; Erfassung mit Flugmodus ablegen, danach „n warten“ leer senden) · Kalender öffnen · Familie öffnen
   (Wichtige Tage laden) · `/os/hoi`: kein „Klartext-Bestand abgelehnt“, „Abgebrochene Vorgänge: keine“, gelb „Kompatibilitätsmodus“ ist erwartet.
6. Sicherung einmal von Hand, vorher die heutige Nachtsicherung schützen:
   `for f in /srv/make-os/sicherungen/make-os-$(date +%F).tar.gz.*; do [ -e "$f" ] && mv "$f" "$(dirname "$f")/vor-upload-nacht-$(basename "$f")"; done`
   dann `bash /srv/make-os/app/deploy/sicherung.sh` (als make, ohne sudo) → letzte Zeile endet auf `: ok (Ping: …)` bzw. ohne
   age auf `: warnung — age fehlt — Sicherung nur mit Übergangs-Verschlüsselung …`. Die Kalender-Tagesdateien
   (`archiv/kalender-export-*`) sind bewusst NICHT im Archiv.

## Rückweg, falls nötig (solange `MAKE_OS_FORMAT` nicht `v2` ist) — Ziel: Online-Stand `f0c5526`
**Vorher prüfen:**
1. Offene Vorgänge: als Kevin im Browser `/api/intern/absichten` öffnen (oder am Server
   `docker compose exec -T app node -e "fetch('http://localhost:3000/api/intern/absichten',{headers:{'x-make-key':process.env.MAKE_OS_KEY}}).then(r=>r.text()).then(console.log)"`)
   → keine offene oder unvollständige Absicht. Offene zuerst fertig werden lassen.
2. **Alle Handys mit „n warten“ leer senden lassen** (Abzeichen im Netzwerken-Bereich). Der alte Stand hat keine Seite, die die
   IndexedDB-Warteschlange (`make-os-netzwerken`) sendet; was dort liegt, wäre verloren.
3. Offene Buchungsanfragen: `f0c5526` kennt die Buchungsseite — nichts zu tun. (Nur ein Rückweg auf `af4679a` hätte die Links
   getötet; siehe „Früher“.)

**Dann:**
```
docker compose stop app arbeiter
docker tag make-os:f0c5526 make-os:aktuell
docker compose up -d --no-build
```
Danach am Mac `main` zurückdrehen, sonst rollt die nächste Action wieder aus:
```
git switch -c rueckweg origin/main && git revert --no-edit --no-commit f0c5526..HEAD && git commit -m "Rückweg: Stand f0c5526"
git diff --stat f0c5526 HEAD      # muss leer sein
git push origin rueckweg:main
```
Dieser Push rollt den alten Code erneut aus (gewollt). Wer das nicht will: vorher die Repo-Variable `AUSROLLEN=aus` setzen.
Die Caddyfile ist unverändert (kein Reload nötig).
Nur im Notfall auf die Sicherung aus „Vor dem Upload“ 6 zurück (dann ist alles seit dem Upload weg).

**Vor dem Rückweg zusätzlich (neu seit 03.10.):** Anmelde-Adressen — gewünschte Adresse zur Hauptadresse machen (der alte Stand
kennt nur die Hauptadresse); Firmen-Zusammenführungen, die rückgängig sollen, VORHER im neuen Stand wiederherstellen
(`/api/crm/firma-archiv`); Google Kalender/Gmail trennen ist nicht nötig (der alte Stand ignoriert die Bestände `google-verbindung--*`,
`gmail-*`, Business-Termine liegen dann nur in Google); Bestand `events-geloescht` (gelöschte Event-Kennungen, 90 Tage) ist
additiv, der alte Stand ignoriert ihn.

**Lichtfäden v2 (03.10., Branch `faeden2`):** nur Darstellung und die Lese-Route `GET /api/lichtfaeden` — kein Bestand, kein Feld; beim Rückweg fällt die
Ansicht weg (Planung › Jahr zeigt dann wieder den alten Zeitstrahl), Daten bleiben unberührt. Kachel „Lichtfäden“ auf Fokus: gespeicherte Flächen-Layouts
kennen sie im alten Stand nicht — ohne Folgen.

**Was beim Rückweg auf `f0c5526` wegfällt oder später doppelt kommen kann** (der Online-Stand verwirft beim nächsten Schreiben, was er nicht kennt).
Punkte, die schon mit `f0c5526` online kamen (alles bis einschließlich Events/Make.One, Netzwerken-Recht, Qualifizierung & Scoring,
Anmelde-Adressen, Google-Kalender/Gmail-Code, Design Markttraktion/Finanzen, Landingpage v4), sind beim Rückweg auf `f0c5526` NICHT betroffen.
Neu seit 04.10. (Lichtfäden v2, Design Kern/Privat, Fokus Innovation `Event.reihe`, Review-/Datenschutz-Fixes) siehe die eigenen Abschnitte; neue Felder sind optional — sie stehen hier nur noch zur Geschichte:
- **Finanzplanung: Kern-Umbau (02.10., Steuern einzeln · Selbstständigkeit eigene Achse · Einkommensteuer · zwei Felder gelöscht):**
  keine Formänderung am Dokument, nur optionale Zusatzfelder — geprüft am Säuberer von 1818c5c (`pruefeDokument`, `pruefePlanszenarien`). Der alte Stand **stürzt nicht ab** und liest das neue Dokument weiter:
  - `steuern` (Rechtsform, Sätze, Hebesatz, Verlustvortrag, Zahlweise, Tarif-Eckwerte je Gesellschaft) und `schwellen` stehen nicht in seiner
    Wurzelliste → **verworfen beim nächsten Lesen/Schreiben**; ebenso `planszenarien[].annahmen.steuern/exitSteuer/entnahme` (seine
    Szenario-Annahmen kennen nur Gehälter, `steuerUG`, Zahlungsziel, Ausschüttung + deren Steuer). Nach einem erneuten Upload sind die Felder
    leer und der Plan rechnet mit den Vorgaben — wer sie eingestellt hat, trägt sie neu ein (vor dem Rückweg notieren: Hebesatz, Zahlweise,
    Entnahme-Regel, Steuer auf den Ausstieg je Szenario).
  - `annahmen` reicht er unverändert durch (`steuerUG` bleibt, `ruecklage5a` fehlt — nicht Pflicht), `einstellungen.notgroschenMonate` setzt er auf 3
    (ohne Wirkung), Bausteine mit `einheit: 'kdc'` kennt er.
  - **Die Zahlen springen zurück:** der alte Kern rechnet wieder EINE Ertragsteuer-Quote (`steuerUG` auf den Gewinn des Vorjahres), die Bausteine der
    Selbstständigkeit und ihre Sachkosten-Zeilen laufen in den MAKE-Zahlen, KD Ventures zahlt nur die Steuer auf den Ausstieg, die Einkommensteuer der
    Selbstständigkeit steht nur im Abschluss 2026. „Frei verfügbar gesamt“ enthält das Konto der Selbstständigkeit dann nicht mehr; eine Entnahme-Regel
    wirkt nicht mehr. Keine Daten gehen verloren (Pläne, Bausteine, Buchungen, Ziele bleiben).
  - Hin und zurück ist verlustfrei, solange nichts im alten Stand an `steuern`/Entnahme geändert wurde (er kennt die Felder nicht).
- **Ziel ↔ Meilenstein (01.10.):** nur optionale Zusatzfelder, keine Formänderung. Der Säuberer des Online-Stands (1818c5c) verwirft sie beim
  nächsten Speichern des jeweiligen Eintrags — und sonst nichts (geprüft mit dem wörtlich kopierten alten Säuberer, `tests/ziel-kette-0110.test.ts`):
  - `wartetAuf` am Meilenstein („wartet auf“, die Kette im Ziel-Detail): die Abhängigkeiten sind weg, die Meilensteine bleiben mit Titel,
    Datum, Rang, Einheit, Aufgaben und Verlauf; die Kette ist dort einfach flach (nichts wartet mehr, kein „wartet“-Hinweis in Glocke/Kalender).
    Vor dem Rückweg die Abhängigkeiten wichtiger Ziele notieren, wenn sie nach dem nächsten Upload wieder gebraucht werden;
  - `messlatte` am Ziel (Ziel-Detail): fällt weg; die Beschreibung (`notiz`) bleibt (bis 400 Zeichen, dieselbe Grenze wie im alten Stand);
  - `zielId` am Meilenstein kennt `1818c5c` schon (30.09.) — der Ziel-Bezug bleibt.
  Die neue Seite `/os/planung/ziel/<id>` gibt es im alten Stand nicht (Links aus der Liste fehlen dort ohnehin). Kein neuer Bestand, kein
  Eintrag im Speicher-Register (Art. 17 unverändert: die Felder liegen in `ziele`/`meilensteine`). Nach einem erneuten Upload: Ziel-Zuordnung
  und Abhängigkeiten neu setzen — die Verbindungsprüfung meldet nur tote Verweise, keine fehlenden.
- **Finanzplanung: Steuerprofil, Schwellen, Monats-Überschreibung (02.10.):** keine Formänderung, nur optionale Zusatzfelder im Plan-Dokument. 1818c5c
  bauen das Dokument beim Lesen aus festen Schlüsseln neu (`pruefeDokument`) und kennt daher folgendes nicht — es geht beim nächsten Speichern im alten Stand verloren:
  `steuern` (Rechtsform, abgeschaltete Steuerzeilen, Aufschlüsselung in KSt/Soli/Gewerbesteuer), `schwellen` (eigene Ampel-Grenzen → wieder die festen Vorgaben) und `ueber` am Baustein
  (von Hand überschriebene Monate eines Produkts → der Baustein rechnet wieder nach Preis × Anzahl). **Zahlen bleiben:** `annahmen.steuerUG`, USt-Satz, Ausstieg und Netto-Tabelle liegen
  im bekannten Annahmen-Feld; ein Gesamtsatz, der aus der Aufschlüsselung entstand, bleibt dort stehen. Abgeschaltete Zeilen mit Satz 0 (Einzel-Ertragsteuer, Ausstieg) bleiben im alten Stand
  auf 0 — dort von Hand wieder eintragen (der gemerkte Satz steht nur im verworfenen Profil). Vor dem Rückweg: abgeschaltete Steuerzeilen und überschriebene Produkt-Monate notieren.
- **Netzwerken › Meine Visitenkarte (02.10., Paket B):** eigener Bestand `visitenkarten--<person>` — `1818c5c` kennt ihn nicht und liest/schreibt ihn nie, er
  bleibt unverändert liegen (nichts geht verloren, nach einem erneuten Upload sind die Profile wieder da). Im alten Stand fehlen die Seite `/os/netzwerken/karte`, der
  Knopf „Netzwerken“ in der Handy-Leiste (dort steht wieder „Melden“) und die Schnellaktions-Leiste in der Kontaktakte am Handy; „Problem oder Idee melden“ geht dort
  wie früher über die Leiste. Das Offline-Abbild der Karte im Browser (`make-karten-cache`) bleibt harmlos liegen. Keine Formänderung bestehender Bestände.
  Die neue Abhängigkeit `qrcode-generator` (Dev: `jsqr`) braucht auf dem Server `npm ci` beim Bauen des Images; die Schrift Urbanist liegt in `public/schriften/`.
- **Netzwerken — Erfassen (02.10.):** keine Formänderung, nur optionale Zusatzfelder, eine neue Meldungsart und ein neuer Speicher. 1818c5c:
  - verwirft `Teilnahme.netzwerken` (Schritt, Zuständigkeit, Info, Danke-Mail-Stand) beim nächsten Speichern der Teilnahme — Abendbericht und Danke-Mail-Entwürfe sind dort leer; Teilnahme „da“, Notiz, `einladenDurch`, Verlauf („Kennengelernt bei …“),
    Follow-ups, Aufgaben, Deals (Vermittlung), Gast-Vormerkungen, Termine, Labels und Dateien bleiben;
  - kennt die Meldungsart `netzwerken` nicht → diese Meldungen (Termin gebucht/zugeteilt) verschwinden aus der Glocke; „n Danke-Mails bereit“ (abgeleitet) und das Pop-up gibt es dort nicht;
  - liest/schreibt `netzwerken-erfassungen--<haushalt>` nie (liegt ungenutzt; nach einem erneuten Upload gilt dieselbe Erfassungs-Kennung weiter → nichts doppelt);
  - Sprachnotizen (`audio/*`) liegen als Datei am Kontakt; der alte Stand zeigt sie in der Dateiliste, kann sie aber nicht abspielen (Download geht).
  Nach einem erneuten Upload: nichts nachzuziehen (Teilnahmen ohne `netzwerken` erscheinen nicht im Bericht — selten, nur für Erfassungen aus der Rückweg-Zeit).
- **Netzwerken ↔ Events ↔ Make.One (03.10., Branch `netz-verbind`):** keine Formänderung, nur optionale Zusatzfelder; 5202a69 verwirft sie beim nächsten Speichern des jeweiligen Eintrags:
  - `Teilnahme.herkunft` (Make.One-Gast „kam von <Event>“): weg — der Gast bleibt mit Status, Einladungsweg und `einladenDurch`; nur der Chip und der Link in die Event-Akte fehlen;
  - `Teilnahme.netzwerken.makeone` (Ziel der Vormerkung) und `.vorher` (frühere Begegnungen): weg — der Abendbericht zeigt „Make.One-Einladung offen“ dann nicht mehr aus dem echten Stand; die ältere Angabe einer zweiten Begegnung ist nicht mehr nachlesbar (die Verlauf-Einträge an der Person bleiben);
  - `Event.bisDatum` (mehrtägige Messe): weg — der Kalender-Spiegel läuft wieder eintägig; vor dem Rückweg die Enddaten wichtiger Messen notieren;
  - Journal `netzwerken-erfassungen--<haushalt>`: das optionale Feld `eventId` (Event, an das die Erfassung gehängt wurde) ignoriert der alte Stand — eine Wiederholung nach dem Rückweg legt das Event bei Bedarf aus `eventNeu` neu an, nie doppelt (gleicher Titel + Tag wird wiederverwendet);
  - der alte Stand kennt `eventNeu` immer im Körper (sendet der Browser mit) — ältere Browser-Warteschlangen ohne `eventNeu` enden bei gelöschtem Event wie bisher mit 404 („Anderes Event wählen“ gibt es dort nicht);
  - `Event löschen` räumt im neuen Stand Kalender-Termin, Planposten und Deal-Verweis ab — der alte nicht (einmal von Hand nachsehen: Kalender „Gemeinsam“, Zahlen › Planung);
  - ZOE `besuche_lage` und die Schnellsuche nach Events fehlen dort.
- **Netzwerken — Korrekturen (03.10., Branch `netz-fix` — schon online mit 5202a69):** keine Formänderung; 1818c5c ignoriert oder verwerfen die neuen Zusätze:
  - `Teilnahme.netzwerken.terminId` (Termin-Sprung im Bericht): der alte Stand verwirft sie beim nächsten Speichern der Teilnahme (nur der Link „Termin öffnen“ fehlt); `followUpAm` aus Netzwerken-Schritten ist ein altes Feld und bleibt;
  - Labels `Netzwerken`/`Dublette prüfen`/`Lead prüfen` und `rechtsgrundlage: 'berechtigt'` sind alte Felder — bleiben, der alte Stand zeigt sie nur als gewöhnliche Labels. Das Event-Kennzeichen `marke: Netzwerken` kennt der alte Stand nur als Marken-Text: **dort zählen fremde Netzwerken-Events wieder in Erscheinensquote und Folgegespräche** (die Trennung ist neuer Code);
  - Lead-Status „Kontaktiert“ an Firma/Person und Follow-ups „Termin vereinbaren“ bleiben (alte Felder);
  - globaler Sender, Abzeichen „n warten“ und Abmelden-Warnung sind reiner Browser-Code und verschwinden mit dem Rückweg. **Vor dem Rückweg alle Handys mit „n warten“ leer senden lassen** — der alte Stand hat keine Seite, die die IndexedDB-Warteschlange sendet;
  - `/api/netzwerken/karten` verweigert dem Dienstweg (403) — es gab nie einen Aufrufer, der den Schlüssel dafür nutzte.
  Nach einem erneuten Upload: nichts nachzuziehen.
- **Events (besuchte Veranstaltungen) und Make.One getrennt (03.10., Branch `events`):** keine Formänderung, nur optionale Felder am Event
  (`fuer`, `anmeldung`, `wer`, `link`, `zielpersonen`, `uebergaben`; Euro-Kosten wie bisher in `kostenEuro`). **Der alte Stand verwirft sie beim nächsten
  Schreiben desselben Events** — sein Säuberer (`zusatz('events')`) kennt nur `kalenderUid` und `marke`. Das trifft nur Events, die nach dem Rückweg im alten Stand
  gespeichert werden (Teil-Änderung, Erfassen setzt „durchgeführt“, Kalender-Spiegel); alle anderen bleiben unverändert in der Datei und sind nach einem erneuten
  Upload wieder da. **Vor dem Rückweg notieren:** für welche Kunden Events laufen (`für wen`), die Zielpersonen offener Events und das Übergabe-Protokoll
  (Events › Event-Akte › „An Kunden übergeben“ — Tag, Person, Anzahl); wer nach dem Rückweg ein solches Event im alten Stand ändert, trägt es nach dem nächsten Upload neu ein.
  Sichtbar nach dem Rückweg: der Reiter „Events“ ist weg, besuchte Events (`marke: Netzwerken`) stehen wieder in der Make.One-Liste, und die 48-h-Kennzahl der Make.One-Abende
  rechnet ihre Gäste wieder mit (wie vor dieser Änderung). Die CSV-Übergabe selbst liegt nur im Browser-Download — nichts davon im Bestand. Nach einem erneuten Upload: nichts nachzuziehen.
- **Netzwerken — Recht (03.10., Branch `netz-recht`):** keine Formänderung, nur optionale Felder; der alte Stand (5202a69) verwirft sie beim nächsten Schreiben desselben Eintrags:
  - am Kontakt `rechtsgrundlageNotiz`, `kennengelerntFuer`, `datenschutzInformiertAm` (der Säuberer des alten Stands kennt sie nicht) — **vor dem Rückweg notieren:** Personen mit „kennengelernt für <Kunde>“ (Kontakte › Label „Netzwerken“, Akte › Recht);
  - an der Teilnahme `netzwerken.neuAngelegt`, `kartenfoto`, `keinGespraech`, `danke.verzichtetAm` — sie fehlen dann; **ein späterer Export wüsste nicht mehr, wer neu angelegt war** (alles gälte als Bestand, nur mit Haken). Vor dem Rückweg offene Kunden-Übergaben erledigen;
  - am Event das erweiterte Übergabe-Protokoll (`empfaengerFirmaId`, `dateiname`, `kontaktIds`, Haken) — der alte Stand kennt `uebergaben` ohnehin nicht (siehe Events);
  - neuer Bestand `uebergabe-journal--<haushalt>` (Nachweis gelöschter Events): der alte Stand ignoriert die Datei, sie bleibt liegen; Art. 17/15 des alten Stands kennt sie nicht → **vor dem Rückweg keine Art.-17-Löschung durchführen, die mit Übergaben zu tun hat**, oder die Datei danach prüfen; nach einem erneuten Upload gilt sie wieder (Register: „tilgen“);
  - **Browser-Warteschlange:** IndexedDB wird auf Version 2 gehoben (Speicher `schluessel`), der Körper liegt dort verschlüsselt — der alte Browser-Code öffnet Version 1 und scheitert an der höheren Version (Rückfall: Arbeitsspeicher), kann die Einträge nicht lesen. **Vor dem Rückweg alle Handys leer senden lassen** (Abzeichen „n warten“ muss weg sein); Reste verwirft das Abmelden;
  - neue Löschfrist-Arten (`netzwerken-*`, `uebergabe-protokolle`) in `crm-loeschfristen`: der alte Stand ignoriert unbekannte Schlüssel; die Prüf-Aufgabe „Kontakte über der Löschfrist“ zählt dort wieder nur die 24-Monats-Fälle;
  - VVT: die drei nachgetragenen Verarbeitungen (`vv-netzwerken`, `vv-besuche-kunde`, `vv-kunden-export`) bleiben im Verzeichnis stehen (gewöhnliche Einträge) — nichts nachzuziehen;
  - Kampagnen-Ampel, Danke-Hinweis, Telegram-Text, Fotos ohne Exif und `TRANSKRIPTION_AN` sind Code ohne Daten — verschwinden mit dem Rückweg (Fotos, die schon ohne Exif abgelegt sind, bleiben es).
  Nach einem erneuten Upload: nichts nachzuziehen (fehlende `neuAngelegt`-Angaben gelten als Bestand — konservativ).
- **Qualifizierung & Scoring (03.10., Branch `quali`):** keine Formänderung, nur optionale Felder und ein neuer Bestand; der alte Stand (5202a69) verwirft sie beim nächsten Schreiben desselben Eintrags:
  - am Lead (Firma bzw. Person) `stufen`, `wiedervorlage`, `grundArt`, `hauptKontaktId`; `antworten` darf jetzt beliebige Frage-Kennungen tragen (der alte Säuberer behält nur die sechs Kernfragen). Die alten Felder `kriterien` und `fit` werden mitgeschrieben — **Fragen, die nur über Stufen des Vorschlags beantwortet sind, bleiben als ja/nein/unklar erhalten, die Stufe selbst geht verloren**;
  - **geparkte Leads** (Status „ruht“ mit Wiedervorlage) bleiben im alten Stand „ruht“ ohne Rückkehr in die Runde — **vor dem Rückweg notieren:** Wiedervorlagen (Qualifizierung › Auswertung › „Geparkt“); das Follow-up „Wiedervorlage Qualifizierung“ bleibt ein gewöhnliches Follow-up;
  - neuer Bestand `crm-scoring` (Einstellungen + 10 frühere Fassungen): der alte Stand ignoriert die Datei, sie bleibt liegen; der alte Stand (5202a69) rechnet mit seiner eigenen festen Formel (= bisherige Rechnung, Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10) — **vor dem Rückweg notieren:** die eigenen Werte (Schwellen, Muss-Regeln, Temperatur-Stufen), falls ein späterer Upload sie wieder braucht;
  - Absichtsprotokoll-Art `firma-umhaengen`: der alte Stand kennt sie nicht und ließe eine **offene** Absicht liegen (HOI zeigt sie) — **vor dem Rückweg in Stammdaten › Datenqualität bzw. HOI prüfen, dass keine offen ist** (sie wird sonst nicht fertiggestellt);
  - zusammengeführte Firmen sind weg (Vermerk in der Notiz der behaltenen Firma nennt den Namen) — der Rückweg bringt sie nicht zurück. **Seit 03.10. legt jedes Firmen-Zusammenführen vorher eine verschlüsselte Sicherung an** (`archiv/crm-vor-firmen-zusammenfuehren-<zeit>.json`, 30 Tage, dann räumt die Löschfrist `archiv-umzug` sie weg; der alte Stand kennt denselben Präfix `crm-vor-` und räumt sie ebenfalls, ignoriert sie sonst). **Vor dem Rückweg:** wer eine Zusammenführung zurückhaben will, nimmt sie im NEUEN Stand zurück — als Inhaber `POST /api/crm/firma-archiv` mit `{ "aktion": "liste" }` und danach `{ "aktion": "wiederherstellen", "datei": "…" }` (nur, was seitdem unverändert ist; die Antwort nennt, was bleibt). Im alten Stand gibt es diese Route nicht; die Sicherungsdatei bliebe nur bis zum Fristende lesbar (mit dem Datenschlüssel), nie von Hand zu öffnen;
  - **Standard und MQL-Begriff (Kevin 03.10.):** der Standard ist jetzt der geschärfte Vorschlag (Marketing 8, Sales 28, Muss-Regeln, Temperatur 5/12/25), die alte Rechnung nur noch als Fassung „Bisherige Rechnung (bis 03.10.)“ wählbar; MQL gibt es nur für Leads mit Marketing-Herkunft (Kampagne, Newsletter mit Double-Opt-in, Anfrage, Content, eigenes Event). Das sind Rechenregeln, **keine Daten** — nichts davon wird gespeichert (Lifecycle-Phasen bleiben nur Vorschläge, von Hand gesetzte Phasen ändern sich nicht). Der Rückweg rechnet wieder mit der alten Formel; nichts nachzuziehen. Wer vorher eigene Einstellungen gespeichert hatte (Datei `crm-scoring`), behält sie in beiden Richtungen;
  - Oberfläche, Editor, Gesprächsmodus, Herkunft sind Code ohne Daten.
  Nach einem erneuten Upload: nichts nachzuziehen (fehlende Stufen = „noch offen“, es gilt der neue Standard, bis `crm-scoring` gelesen wird).
- **Mehrere Anmelde-Adressen (03.10., Branch `konto-mail`):** keine Formänderung, nur optionale Felder; der alte Stand (5202a69) liest am Konto nur `email` und behält Zusatzfelder beim Schreiben (`...k`):
  - Konto `weitereEmails` (höchstens drei): der alte Stand ignoriert sie — **dort meldet sich nur die Hauptadresse (`email`) an.** **Vor dem Rückweg** (System › Konto › Anmelde-Adressen) die **Hauptadresse auf die gewünschte stellen** („Als Hauptadresse“), sonst geht beim alten Bild nur die bisherige Hauptadresse. Die Konten selbst bleiben unversehrt (Passwort, zweiter Faktor, Speichername ändern sich nicht).
  - Einladung `email` (reservierte Adresse): der alte Stand ignoriert sie — die Einladung gilt dort für jede Adresse.
  - Sicherheitsprotokoll `anmeldungen`: neue Arten `adresse-hinzu`/`adresse-haupt`/`adresse-weg` mit `detail` (maskierte Adresse) — der alte Stand zeigt sie roh an, nichts bricht.
  - Glocke: Meldungsart `sicherheit` — der alte Säuberer verwirft Meldungen unbekannter Art beim nächsten Schreiben (nur die Hinweise „Anmelde-Adresse geändert“ gehen verloren, das Protokoll bleibt).
  Nach einem erneuten Upload: nichts nachzuziehen (die weiteren Adressen stehen noch in `konten.json`, solange das alte Bild sie nicht überschrieben hat; sonst unter Konto neu eintragen).
- **Fokus Innovation — Reihe unter Make.One (03.10., Branch `fokus-innovation`):** nur ein neues optionales Feld `Event.reihe` (Kennung, z. B. `fokus-innovation`), keine Formänderung.
  - der Säuberer des alten Stands (`zusatz('events')`) kennt `reihe` nicht — **beim ersten Schreiben eines Events im alten Stand fällt die Reihe weg**; Events, die nur gelesen werden, behalten sie. **Vor dem Rückweg notieren:** welche Make.One-Events zu Fokus Innovation gehören (Make.One › Filter „Fokus Innovation“); nach einem erneuten Upload dort im Überblick „Reihe“ wieder wählen.
  - Kennzahlen je Reihe, Abzeichen, Filter, Herkunftstext („Make.One · Fokus Innovation …“) und `dealsVerursacht` in den Event-Zahlen sind Rechnung/Code ohne Daten — verschwinden mit dem Rückweg.
  - Die Event-Seite `fokus/` liegt nur im Repo; ohne Caddy-Block und DNS (fokus/LIESMICH.md) wird sie nirgends ausgeliefert.
  Nach einem erneuten Upload: nichts nachzuziehen außer der notierten Reihen.
- **Nach einem erneuten Upload** können Meetings (Kalender-Signal) und Geschenk-Vorschläge doppelt erscheinen →
  CRM › Verbindungsprüfung laufen lassen und Doppelte entfernen.

## Gmail in der Inbox (03.10.2026, Branch `gmail`) — Umgebung, Einrichtung, Rückweg
**Ohne Zutun ändert sich beim Upload nichts:** solange niemand in der Inbox „Gmail verbinden“ klickt, gibt es keine Gmail-Bestände und keinen Aufruf bei Google. Voraussetzung ist die Google-Verbindung aus „Google Kalender“ (`GOOGLE_CLIENT_ID`/`SECRET`).
- **Reihenfolge bei Google (Details `GOOGLE_GMAIL_EINRICHTEN.md`):** Gmail API aktivieren → im Zustimmungsbildschirm den Bereich `gmail.modify` ergänzen (App bleibt „Intern“) → in der Admin-Konsole prüfen, dass die App Gmail darf → je Person in der Inbox „Gmail verbinden“. **Erst danach** die Mail-Adresse umstellen: Konten + `hello@` (Alias/Gruppe) anlegen und testen, **MX zuletzt** (SPF, DKIM, DMARC davor).
- **Neue Umgebungsvariablen (alle optional, nur Server-`.env`, nie ins Repo):** `GMAIL_PUBSUB_THEMA`, `GMAIL_PUSH_DIENSTKONTO`, `GMAIL_PUSH_AUDIENCE` (Echtzeit per Pub/Sub-Push; ohne sie Abfrage alle 2 Minuten). Setzen per `deploy/google-verbinden.sh` (fragt optional). Fehlt etwas, antwortet der Webhook IMMER 403 (nie offen).
- **Nach dem Upload prüfen (nichts eingeben, nur ansehen):** `docker compose logs app --since 10m | grep -i "\[gmail\]"` → leer oder einzelne Zeilen (`watch: …` ohne Pub/Sub ist erwartbar). Verdächtig: wiederholte `Abgleich: …`-Zeilen. HOI zeigt den Befund „Gmail (Inbox)“.
- **Geänderte Formen:** nur neue Bestände (`gmail-stand--<person>`, `gmail-text--<person>`, im Speicher-Register) und optional `Aktivitaet.mailLink` (Verlauf der Kontaktakte); neue Löschfrist `mail-spiegel` (180 Tage, einstellbar unter System › Datenschutz). Im Kompatibilitätsmodus sind sie wie jeder Bestand verschlüsselt und für den alten Stand unsichtbar.
- **Rückweg auf den Online-Stand:**
  1. **Vorher je Person „Gmail ausschalten“** (Inbox, unten) bzw. Kalender › Einstellungen › Google › **Trennen**: beendet die Überwachung (`users.stop`), löscht den Spiegel, widerruft (beim Trennen) den Zugriff bei Google. Ohne das läuft eine Pub/Sub-Überwachung bis zu ~7 Tage weiter und ruft die dann unbekannte Adresse auf (harmlos, Google gibt auf).
  2. Was der alte Stand nicht kennt, fällt weg: die Gmail-Quelle in der Inbox, die Spiegel-Bestände (bleiben ungenutzt liegen), `Aktivitaet.mailLink` (der alte Säuberer verwirft das Feld; die Verlaufszeile „Betreff: …“ bleibt ohne Link).
  3. **Mails selbst sind nie verloren:** das Original liegt in Gmail. Gesendete Antworten stehen in Gmail unter „Gesendet“.
  4. **DNS-Rückweg** (falls die Mail-Adresse wieder zu IONOS soll): MX/SPF auf die alten IONOS-Werte (Abschrift aus Teil D der Anleitung) — Mails, die in der Zwischenzeit bei Google ankamen, bleiben in Gmail.
- **Datenschutz:** AVV (Datenverarbeitungszusatz) in der Workspace-Admin-Konsole bestätigen (gilt auch für Gmail); Verzeichnis nach Art. 30 bekommt „E-Mail (Google Workspace)“ automatisch, sobald Google eingerichtet ist (System › Datenschutz öffnen). Art. 17: der Löschlauf zählt „n Einträge in … Gmail nennen die Person — bitte dort löschen“.

## Google Kalender (03.10.2026, Branch `google-kal`) — Umgebung, Einrichtung, Rückweg
**Ohne Zutun ändert sich beim Upload nichts:** solange `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` fehlen, ist Google sichtbar aus („noch nicht eingerichtet“), iCloud läuft wie bisher.
- **Neue Umgebungsvariablen (nur Server-`.env`, nie ins Repo):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ERLAUBTE_DOMAIN` (z. B. `makeinnovation.de`), optional `GOOGLE_RUECKRUF_URL`
  (sonst `MAKE_OS_ADRESSE` + `/api/google/rueckruf`). Setzen: `ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/google-verbinden.sh` (fragt verdeckt, startet neu). Komplett in `GOOGLE_KALENDER_EINRICHTEN.md`.
- **Nach dem Upload prüfen (nichts eingeben, nur ansehen):** `docker compose logs app --since 5m | grep -i "kalender-google"` → leer oder nur `Push-Kanal …` (ohne bestätigte Domain bei Google ist das erwartbar, Rückfall = Abfrage alle 5 Min.).
  Verdächtig: `Google-Überlagerung nicht lesbar` oder wiederholte `Abgleich: …`-Zeilen.
- **Neue Bestände (nur dieser Stand schreibt sie, der alte ignoriert sie):** `google-verbindung--<person>`, `google-oauth-zustand`, `kalender-google--<person>`, `kalender-umzug-sicherung--<person>`.
  Geänderte Formen: nur optionale Felder (`Termin.link`, `KalenderEintrag.quelle/person/ich` — nie gespeichert; `kalender-einstellungen` trägt nie etwas von Google). Der iCloud-Bestand `kalender-icloud` hat dieselbe Form wie vorher.
- **Rückweg auf den Online-Stand (`5202a69`), wenn Google schon benutzt wurde:**
  1. **Vorher je Person in MAKE OS „Trennen“** (Kalender › Einstellungen › Google Kalender): widerruft den Zugriff bei Google, stoppt den Push-Kanal. (Ohne das läuft der Kanal bis zu ~7 Tage weiter und ruft die dann unbekannte Adresse auf — harmlos, Google gibt auf; das Token bliebe aber gültig, bis es bei <https://myaccount.google.com/permissions> entzogen ist.)
  2. Was der alte Stand nicht kennt, fällt weg: die Google-Termine verschwinden aus der Oberfläche (sie bleiben in Google), der Kalender „MAKE … (Google)“ ist weg, `kalender-bezug`-Einträge `google-<person>|…` bleiben ungenutzt liegen (kommen nach erneutem Upload + Verbinden zurück, die UIDs sind dieselben).
  3. **Umgezogene Termine** (iCloud → Google) fehlen im alten Stand in iCloud — sie stehen nur noch in Google; Meetings/Follow-ups zeigen im alten Stand auf einen Termin, den es dort nicht gibt (Verbindungsprüfung „Termin fehlt“, harmlos). Die Sicherung des Umzugs (`kalender-umzug-sicherung--<person>`, 30 Tage) hält den iCloud-Text jedes Termins; zurückgespielt wird er nur auf Anweisung (Entwickler: `objektWiederherstellen`, `lib/kalender/icloud.ts`).
  4. Neue Business-Termine, die ab dem Upload in Google angelegt wurden, stehen nur in Google; der alte Stand legt wieder alles in iCloud an.
- **Datenschutz:** AVV (Datenverarbeitungszusatz) in der Workspace-Admin-Konsole bestätigen; Verzeichnis nach Art. 30 bekommt „Kalender (Google Workspace)“ automatisch, sobald Google eingerichtet ist (System › Datenschutz öffnen).

## DSGVO-Prüfung S2 (04.10.) — nach dem Upload kurz prüfen
- **Kapazität:** Kopf & Energie zählt jetzt erst nach eigener Einwilligung — Kevin und Malin schalten in Planung › Kapazität
  (eigene Personenkarte) „Erholung berücksichtigen“ selbst ein, wenn gewünscht. Der Business-Index zeigt keine Kennzahl „Kopf & Energie“ mehr.
- **Inbox:** als Malin angemeldet zeigt die Inbox nur Malins Gmail-Status; Apple/M365-Status nur bei Kevin.
- **Stammdaten › Datenschutz:** Verzeichnis enthält „Gesellschafts-Register“ und „Kapazitätsplanung“; Löschkonzept „Papierkorb“.
- Rückweg: nur neue, optionale Felder (`erholungAm` in `kapazitaet--*`) und neue Verzeichnis-Einträge — der Online-Stand liest sie nicht und stört sich nicht daran.

## Am ersten Tag
1. **Wochenplan-Übernahme** (falls sie noch nicht gemacht wurde; mit diesem Upload hat sie nichts zu tun): erst nach ein paar stabilen Tagen: Kalender › Planen › Karte „Alter
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

## Früher (Rückweg auf `af4679a`, seit dem Upload von `1818c5c` gegenstandslos)
Bis zum Upload von `1818c5c` war `af4679a` der Online-Stand; seine Rückweg-Hinweise stehen hier nur zur Nachvollziehbarkeit
(der Tag `make-os:af4679a` und der Rückweg-Block mit `af4679a..HEAD` gelten **nicht mehr**). Der heutige Rückweg geht auf `1818c5c`.
**Rückweg-Vorabprüfungen von damals:** Absichten der Art `buchung`/`wochenplan-uebernahme` abwarten, Wochenplan-Übernahme zurücknehmen,
Buchungslinks wären tot gewesen; danach `rm -f /srv/make-os/daten/archiv/kalender-export-*` (Art. 17 / 14-Tage-Zusage).

**Was beim Rückweg auf `af4679a` wegfiel oder später doppelt kommen konnte** (af4679a verwarf beim nächsten Schreiben, was er nicht kennt):
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
