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

## 3 · Zulieferer-Schlüssel (Entscheidung 3/10)
1. Am Mac: `bash deploy/zulieferer-schluessel.sh mac`
2. Am Server: `ssh -t make@2.28.108.162 bash /srv/make-os/app/deploy/zulieferer-schluessel.sh server` (Schlüssel aus der Zwischenablage, verdeckt)
3. HOI „Mac-Zulieferer“ grün. Nach ein paar stabilen Tagen am Mac: `bash deploy/zulieferer-schluessel.sh aufraeumen`.

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
