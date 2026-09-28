#!/usr/bin/env bash
# ─── MAKE OS · Nächtliche verschlüsselte Sicherung (Cron auf dem Server, 03:15, als make) ────
# Stand 29.09. (Paket D-A #60/#61/#62/#64/#79/#88):
#   1. Schreibpause (≤ 30 s) über den Dienstweg der App (POST /api/intern/schreibpause, im Container) —
#      der Schnappschuss ist in sich stimmig (CRM-Verweise und Kartei aus demselben Moment).
#   2. Schnappschuss nach daten/.sicherung-stage (tar über tar, ohne backup/, ohne Brain-Index, ohne .tmp) —
#      die Tageskopien in backup/ sind redundant zum Nachtarchiv und ließen es quadratisch wachsen (#79).
#   3. Pause aufheben (die App wartet höchstens Sekunden).
#   4. Schnappschuss PRÜFEN: jeden Bestand entschlüsseln/parsen/zählen, Archiv und Dateiablage
#      (scripts/sicherung-pruefen.mjs im App-Container — nur dort liegt der Datenschlüssel).
#   5. tar.gz → age (öffentlicher Schlüssel /srv/make-os/sicherung.pub). age ist PFLICHT: ohne age oder
#      ohne sicherung.pub bricht das Skript ab (kein openssl-Rückfall mehr, #62) — entschlüsseln kann
#      nur, wer die age-Identität hat (Passwort-Manager Kevin + Malin, Papier im Tresor; NOTFALL.md).
#   6. Archiv-Kopf und Dateizahl prüfen, 0600, Generationen 14 täglich / 8 wöchentlich / 12 monatlich (#64).
#   7. IMMER (auch nach Fehlern, trap): Ergebnis nach daten/system/sicherung.json (nur Zahlen, für den
#      Head of IT) und Dead-Man-Ping an Healthchecks (Erfolg bzw. /fail). Ohne Ping-Adresse zeigt der
#      HOI eine Pflicht-Warnung (#60).
# Zurückholen (am Mac): deploy/sicherung-probe.sh <archiv> <age-identität> (NOTFALL.md).
#
# Für einen Probelauf ohne Server (Tests): MAKE_OS_BASIS=<ordner> MAKE_OS_OHNE_APP=1 — dann ohne
# Schreibpause, Prüfung mit dem lokalen node und MAKE_OS_DATEN_SCHLUESSEL aus der Umgebung.
set -Eeuo pipefail
umask 077

BASIS=${MAKE_OS_BASIS:-/srv/make-os}
APP=${MAKE_OS_APP:-$BASIS/app}
SKRIPTE="$(cd "$(dirname "$0")" && pwd)"
ZIELORDNER="$BASIS/sicherungen"
STATUS_DIR="$BASIS/daten/system"
STAGE="$BASIS/daten/.sicherung-stage"
PUB="$BASIS/sicherung.pub"
HC_DATEI="$BASIS/.healthchecks-sicherung"
TAG=$(date +%F)
ZIEL="$ZIELORDNER/make-os-$TAG.tar.gz.age"
START=$(date +%s)
# shellcheck source=deploy/generationen.sh
source "$SKRIPTE/generationen.sh"

ERGEBNIS=fehler; GRUND="abgebrochen"; PAUSE=aus; SCHNAPPSCHUSS=ohne; PRUEFUNG='null'; DATEIEN=0; GROESSE_MB=0; PING=fehlt

app_js() {
  # Einen Dienstweg-Aufruf IM App-Container machen (dort liegt MAKE_OS_KEY; der Schlüssel steht nie auf der Kommandozeile).
  docker compose -f "$APP/compose.yml" exec -T app node -e "$1"
}
pause_an() {
  [ "${MAKE_OS_OHNE_APP:-}" = 1 ] && return 1
  # Nicht still geworden (eine Schreibung läuft länger als 10 s)? Dann Pause sofort wieder aufheben und ohne Pause sichern.
  app_js "const u='http://localhost:3000/api/intern/schreibpause',h={'content-type':'application/json','x-make-key':process.env.MAKE_OS_KEY};fetch(u,{method:'POST',headers:h,body:JSON.stringify({an:true,sekunden:30})}).then(r=>r.json()).then(j=>j.ok&&j.still?process.exit(0):fetch(u,{method:'POST',headers:h,body:JSON.stringify({aus:true})}).finally(()=>process.exit(1))).catch(()=>process.exit(1))" </dev/null
}
pause_aus() {
  [ "$PAUSE" = an ] || return 0
  app_js "fetch('http://localhost:3000/api/intern/schreibpause',{method:'POST',headers:{'content-type':'application/json','x-make-key':process.env.MAKE_OS_KEY},body:JSON.stringify({aus:true})}).then(()=>process.exit(0)).catch(()=>process.exit(1))" </dev/null || true
  PAUSE=aufgehoben
}
pruefen() {
  if [ "${MAKE_OS_OHNE_APP:-}" = 1 ]; then node "$SKRIPTE/../scripts/sicherung-pruefen.mjs" "$STAGE/daten" --json
  else docker compose -f "$APP/compose.yml" exec -T app node scripts/sicherung-pruefen.mjs /app/.data/.sicherung-stage/daten --json </dev/null
  fi
}
json_text() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n' | cut -c1-200; }

ende() {
  local rc=$?
  set +e
  pause_aus
  rm -rf "$STAGE" "$ZIEL.tmp"
  [ $rc -eq 0 ] && [ "$ERGEBNIS" = ok ] || ERGEBNIS=fehler
  # Dead-Man-Ping: Erfolg an die Adresse, Fehlschlag an …/fail (Healthchecks.io-Schema).
  if [ -s "$HC_DATEI" ]; then
    local url; url=$(head -1 "$HC_DATEI")
    if [ "$ERGEBNIS" = ok ]; then curl -fsS -m 10 --retry 3 -o /dev/null "$url" && PING=ok || PING=fehler
    else curl -fsS -m 10 --retry 3 -o /dev/null "$url/fail" && PING=ok || PING=fehler; fi
  fi
  mkdir -p "$STATUS_DIR"
  cat >"$STATUS_DIR/sicherung.json.tmp" <<JSON
{"zeit":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","ok":$([ "$ERGEBNIS" = ok ] && echo true || echo false),"grund":"$(json_text "$GRUND")","datei":"$(basename "$ZIEL")","groesse_mb":$GROESSE_MB,"dateien":$DATEIEN,"dauer_s":$(( $(date +%s) - START )),"schnappschuss":"$SCHNAPPSCHUSS","ping":"$PING","pruefung":$PRUEFUNG}
JSON
  chmod 640 "$STATUS_DIR/sicherung.json.tmp" && mv "$STATUS_DIR/sicherung.json.tmp" "$STATUS_DIR/sicherung.json"
  echo "$(date '+%F %T') Sicherung $(basename "$ZIEL"): $ERGEBNIS${GRUND:+ — $GRUND} (Ping: $PING)"
  exit $rc
}
trap ende EXIT
fehlschlag() { GRUND="$1"; echo "FEHLER: $1" >&2; exit 1; }

# ── 0 · age erzwingen ────────────────────────────────────────────────────────
[ -s "$PUB" ] || fehlschlag "sicherung.pub fehlt — ohne age-Empfänger keine Sicherung (NOTFALL.md: age-keygen am Mac, Zeile age1… nach $PUB)"
command -v age >/dev/null || fehlschlag "age ist nicht installiert (sudo apt-get install age)"
mkdir -p "$ZIELORDNER"

# ── 1–3 · Schreibpause, Schnappschuss, Pause aufheben ────────────────────────
rm -rf "$STAGE"; mkdir -p "$STAGE"
if pause_an; then PAUSE=an; SCHNAPPSCHUSS=mit-pause; else SCHNAPPSCHUSS=ohne-pause; fi
tar -C "$BASIS" --exclude='daten/backup' --exclude='daten/.sicherung-stage' --exclude='daten/.schreiber' --exclude='*.tmp' \
    --exclude='daten/brain-index.sqlite*' -cf - daten | tar -C "$STAGE" -xf - || fehlschlag "Schnappschuss (tar) gescheitert"
pause_aus
DATEIEN=$(find "$STAGE/daten" -type f | wc -l | tr -d ' ')

# ── 4 · Schnappschuss prüfen (entschlüsseln, parsen, zählen) ──────────────────
PRUEF_TEXT=$(pruefen) || { PRUEFUNG=$( [ -n "$PRUEF_TEXT" ] && printf '%s' "$PRUEF_TEXT" | sed 's/"je":{[^}]*},\{0,1\}//' || echo null ); fehlschlag "Prüfung des Schnappschusses fehlgeschlagen (Bestände nicht lesbar)"; }
# Nur die Summen in den Status (keine Liste je Bestand — die Durchsicht der App zählt je Bestand).
PRUEFUNG=$(printf '%s' "$PRUEF_TEXT" | sed 's/"je":{[^}]*},\{0,1\}//')

# ── 5 · packen und mit age verschlüsseln ─────────────────────────────────────
tar -C "$STAGE" -czf "$STAGE/archiv.tar.gz" daten || fehlschlag "Packen gescheitert"
IM_ARCHIV=$(tar -tzf "$STAGE/archiv.tar.gz" | grep -vc '/$' || true)
[ "$IM_ARCHIV" = "$DATEIEN" ] || fehlschlag "Archiv unvollständig ($IM_ARCHIV von $DATEIEN Dateien)"
age -R "$PUB" -o "$ZIEL.tmp" "$STAGE/archiv.tar.gz" || fehlschlag "age-Verschlüsselung gescheitert"

# ── 6 · Archiv prüfen, ablegen, Generationen ─────────────────────────────────
[ "$(head -c 21 "$ZIEL.tmp")" = "age-encryption.org/v1" ] || fehlschlag "Archiv hat keinen age-Kopf"
[ "$(wc -c <"$ZIEL.tmp" | tr -d ' ')" -gt 200 ] || fehlschlag "Archiv verdächtig klein"
chmod 600 "$ZIEL.tmp" && mv "$ZIEL.tmp" "$ZIEL"
GROESSE_MB=$(du -m "$ZIEL" | cut -f1)
generationen_aufraeumen "$ZIELORDNER" 14 8 12
ERGEBNIS=ok; GRUND=""
