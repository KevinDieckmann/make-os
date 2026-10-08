# Upload nach Kevins Entscheidungen vom 08.10.2026 — Schritt für Schritt

> Erst ausführen, wenn Kevin den Stand gesehen und „hochladen“ gesagt hat. Nie Werte (Schlüssel, Pepper, Passwörter) in den Chat.
> Grundlage: BAUSTAND.md › „Kevins Entscheidungen 08.10.“; die Einzelanleitungen stehen in UPDATES.md, DEPLOY.md, VAULT_UMZUG_ANLEITUNG.md.
> Server: `ssh make@2.28.108.162`, App-Ordner `/srv/make-os/app`.

## 0 · Vorher (Mac)
- Website: `node website/pruefen.mjs` muss „freigabefähig“ sagen. Solange Kevins Gründer-Satz fehlt, geht der Upload **ohne neue
  Websites** — dann `website/` und `fokus/` im Upload auf dem Online-Stand lassen (Claude baut dafür einen eigenen Upload-Stand).
- Volle Suite grün, `tsc` 0, Lint 0 — steht im Bericht von Claude.
- Sicherung am Server vor dem Upload wie beim letzten Mal (`vor-upload-…tar.gz`), Rückweg-Bild `make-os:6b10a5ba` bleibt.

## 1 · Hochladen
`entwicklung` → `main` zusammenführen und pushen (macht Kevin oder Claude auf Kevins Wort). Die GitHub-Action prüft und rollt aus (~5 Min.).
Danach am Server Caddy neu laden (UPDATES.md „Vor dem Upload (zentral)“):
```
cd /srv/make-os/app && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
cd /srv/make-os/app && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## 2 · Pepper + strenger Start-Riegel (Entscheidung 2/10)
1. Am Mac: `openssl rand -hex 32` → Wert in beide Passwort-Manager + Papier. **Nie wechseln.**
2. Am Server in `/srv/make-os/app/.env`: `MAKE_OS_PEPPER=<Wert>` und `MAKE_OS_START_RIEGEL=streng` ergänzen.
3. `cd /srv/make-os/app && docker compose up -d` → im HOI (`/os/hoi`) „Start-Riegel“ und „Fingerabdrücke … HMAC mit Pepper (v2)“ grün.
   Bei 502: `docker compose logs app | grep START-RIEGEL` nennt, was fehlt oder zu kurz ist.

## 3 · ~~Zulieferer-Schlüssel~~ — entfällt (Kevin 08.10. spät, R6)
Der Mac-Zulieferer wird abgeschaltet („alles nur auf dem Server, auf dem Mac brauchen wir nur noch die Mail-API, der Rest ist in MAKE OS“).
Kein eigener Zulieferer-Schlüssel mehr einrichten. Später (eigener Bau): die Apple-Erinnerungen einmal als Aufgaben übernehmen, dann den
Zulieferer ausschalten. Bis dahin bleibt am Mac alles, wie es ist.

## 3a · Altbestand übernehmen — VOR dem Update am 16.10.
Nur, wenn dieser Upload die Übernahme enthält (Branch `privat-raus-koerper` bzw. `privat-raus-nordstern` gemergt — sonst entfällt der Abschnitt).
Bisherige persönliche Inhalte aus dem Code wandern genau einmal in die Daten des Inhabers (`lib/altbestand/uebernahme.ts`).
1. **Zuerst die Einwilligung (a) des Inhabers:** Kevin in MAKE OS › Einstellungen › Datenschutz › Gesundheit „(a) Verarbeiten“ erklären.
   Ohne (a) überspringt die Übernahme die Körper-Inhalte (Log „ohne-einwilligung“).
2. Am Server in `/srv/make-os/app/.env`: `MAKE_OS_ALTBESTAND_PERSON=<Speichername des Inhabers>` ergänzen (nie in Demo- oder Kunden-Instanzen).
3. App neu starten: `cd /srv/make-os/app && docker compose up -d`
4. Übernahme prüfen (nach etwa 10 Sekunden): `docker compose logs app | grep Altbestand` → je Teil „uebernommen“ (oder „schon-uebernommen“).
   „ohne-einwilligung“ → Schritt 1 nachholen, dann Schritt 3 wiederholen. „kein Konto“/„Variable ungültig“ → Speichername prüfen.
5. Erst danach eigene Körper-Inhalte anlegen. Die Variable darf danach wieder aus der `.env`; mit dem Update am 16.10. verschwindet das
   Übernahme-Modul aus dem Code — bis dahin MUSS „uebernommen“ im Log gestanden haben.

## 4 · 2FA-Pflicht (Entscheidung 1/10)
1. Kevin richtet zuerst selbst den zweiten Faktor ein: Konto › Zweiter Faktor.
2. Konto › „Zugang der Instanz“ › 2FA-Pflicht an. Malin wird beim nächsten Anmelden zur Einrichtung geführt.

## 5 · Vault-Abgleich per Git (Entscheidung 8/10)
1. Mac: Vault aus iCloud holen und umziehen — genau nach `VAULT_UMZUG_ANLEITUNG.md` (Obsidian dabei geschlossen, ~20 Min.).
   Private Ordner (Gesundheit, Malins Privates) gehen nicht auf den Server — die Anleitung und `deploy/vault-abgleich.sh` regeln das.
2. Am Ende läuft der Abgleich alle 5 Minuten; Konflikte und gescheiterte Pushes zeigt der HOI rot.

## 6 · `_App`-Spiegel an (Entscheidung 9/10)
In `/srv/make-os/app/.env`: `MAKE_OS_APP_SPIEGEL=an` → `docker compose up -d app`. Erster Lauf nachts oder sofort über Brain › App-Brücke „Jetzt“.

## 7 · Alte Bilder löschen (Entscheidung 10/10)
Erst wenn der neue Stand läuft und das Rückweg-Bild `make-os:6b10a5ba` noch da ist:
```
docker image ls make-os
docker image rm 70603154 db93e88 5aca6f5
df -h /
```

## 8 · Danach (erst nach stabilen Tagen)
Format v2 umstellen: DEPLOY.md › „Schreibformat“ (zusammen mit `MAKE_OS_KDF=stark`). Rückweg danach nur noch per Sicherung.

## 9 · Onboarding starten (Paket B0, Kevins Entscheidungen 08.10. spät)
Nach dem Upload führt MAKE OS selbst durch die Einrichtung: **Einstellungen › Onboarding** (`/os/onboarding`). Auf **Heute** steht vorne die Karte
„Einrichtung · x von y“ mit dem nächsten Schritt; sie verschwindet, wenn alles steht.
1. **Freitag 09.10., nach dem Upload (Kevin, ≈ 2 h):** Etappe 0 am Server — Update, Pepper, Altbestand (3a), Sicherung mit age, Vault, Adresse,
   WHOOP- und Google-Anwendung. Jeder Schritt zeigt nur den Befehl, nie einen Wert. Vieles hakt die Software selbst ab (grüner Befund).
2. **Samstag 10.10. (≈ 8 h):** vormittags jede Person ihre Etappen 1 und 2 (eigene Spur: Kevin = „Inhaber“, Malin = „Zweite Person“),
   danach gemeinsam Etappen 3–8 von oben nach unten. Stichtag des 0-Punkts = 01.10.2026 für jede Business-Gesellschaft (Jan–Sep bleibt
   archiviert); Verantwortlicher (Datenschutz) = MAKE Innovation GmbH unter Datenschutz › Verantwortlicher eintragen.
3. **Danach einzeln:** zweite Kopie am Mac + Probe (frühestens Sonntag, nach der ersten Nachtsicherung), Mail-Umzug und WhatsApp als eigene
   Termine, erster Monatsabschluss (Oktober) Anfang November.
4. Hinweise in den Etappen (kein Schritt): ZOE über eine zweite WhatsApp-Nummer (Phase 1), Bank-Anbindung (Phase 1), Brücke Haushalt →
   Finanzplanung (Phase 1), Malin als gleichwertige zweite Inhaberin mit Server-Zugang (Update 2), Mac-Zulieferer aus (später).
