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
#      Ist dabei eine einzelne Datei nicht lesbar (oder läuft die Prüfung gar nicht), wird das Archiv
#      TROTZDEM geschrieben (Go-Live-Prüfung 29.09.: die Nachtsicherung fällt nie ganz aus) — Status
#      „teilweise“ mit den Dateinamen (nie Inhalten), HOI rot, Ping an …/fail.
#   5. tar.gz → age (öffentlicher Schlüssel /srv/make-os/sicherung.pub) — der Normalweg: entschlüsseln kann
#      nur, wer die age-Identität hat (Passwort-Manager Kevin + Malin, Papier im Tresor; NOTFALL.md).
#      Fehlt age oder sicherung.pub (oder scheitert age), sichert das Skript mit dem bisherigen openssl-Weg
#      und dem Passwort aus /srv/make-os/.sicherung-passwort (.tar.gz.enc, wie der Stand vor dem 29.09.) —
#      laut im Protokoll, HOI rot „age fehlt — Sicherung nur mit Übergangs-Verschlüsselung“, Ping an …/fail.
#      Fehlt auch das Passwort: Abbruch. NIE unverschlüsselt.
#   6. Archiv-Kopf und Dateizahl prüfen, 0600, Generationen 14 täglich / 8 wöchentlich / 12 monatlich (#64).
#   7. IMMER (auch nach Fehlern, trap): Ergebnis nach daten/system/sicherung.json (nur Zahlen und Dateinamen,
#      für den Head of IT: stufe ok|warnung|fehler, archiv ja/nein, verfahren age|openssl) und Dead-Man-Ping an
#      Healthchecks (nur bei „ok“ Erfolg, sonst /fail). Ohne Ping-Adresse zeigt der HOI eine Pflicht-Warnung (#60).
# Zurückholen (am Mac): deploy/sicherung-probe.sh <archiv> <age-identität | passwort-datei bei .enc> (NOTFALL.md).
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
PASSWORT="$BASIS/.sicherung-passwort"
HC_DATEI="$BASIS/.healthchecks-sicherung"
TAG=$(date +%F)
ZIEL="$ZIELORDNER/make-os-$TAG.tar.gz.age"
START=$(date +%s)
# shellcheck source=deploy/generationen.sh
source "$SKRIPTE/generationen.sh"

ERGEBNIS=fehler; GRUND="abgebrochen"; PAUSE=aus; SCHNAPPSCHUSS=ohne; PRUEFUNG='null'; DATEIEN=0; GROESSE_MB=0; PING=fehlt
VERFAHREN=age; ARCHIV=false; WARNUNGEN=()
warnung() { WARNUNGEN+=("$1"); echo "WARNUNG: $1" >&2; }

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
  [ $rc -eq 0 ] && { [ "$ERGEBNIS" = ok ] || [ "$ERGEBNIS" = warnung ]; } || ERGEBNIS=fehler
  if [ "$ERGEBNIS" = warnung ] && [ ${#WARNUNGEN[@]} -gt 0 ]; then
    GRUND=""; local w; for w in "${WARNUNGEN[@]}"; do GRUND="${GRUND:+$GRUND; }$w"; done
  fi
  # Dead-Man-Ping: Erfolg an die Adresse, sonst …/fail (Healthchecks.io-Schema) — auch bei „warnung“ (Archiv liegt,
  # aber nur mit Übergangs-Verschlüsselung oder nicht vollständig geprüft): das soll jemand merken.
  if [ -s "$HC_DATEI" ]; then
    local url; url=$(head -1 "$HC_DATEI")
    if [ "$ERGEBNIS" = ok ]; then curl -fsS -m 10 --retry 3 -o /dev/null "$url" && PING=ok || PING=fehler
    else curl -fsS -m 10 --retry 3 -o /dev/null "$url/fail" && PING=ok || PING=fehler; fi
  fi
  mkdir -p "$STATUS_DIR"
  cat >"$STATUS_DIR/sicherung.json.tmp" <<JSON
{"zeit":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","ok":$([ "$ERGEBNIS" = ok ] && echo true || echo false),"stufe":"$ERGEBNIS","archiv":$ARCHIV,"verfahren":"$VERFAHREN","grund":"$(json_text "$GRUND")","datei":"$(basename "$ZIEL")","groesse_mb":$GROESSE_MB,"dateien":$DATEIEN,"dauer_s":$(( $(date +%s) - START )),"schnappschuss":"$SCHNAPPSCHUSS","ping":"$PING","pruefung":$PRUEFUNG}
JSON
  chmod 640 "$STATUS_DIR/sicherung.json.tmp" && mv "$STATUS_DIR/sicherung.json.tmp" "$STATUS_DIR/sicherung.json"
  echo "$(date '+%F %T') Sicherung $(basename "$ZIEL"): $ERGEBNIS${GRUND:+ — $GRUND} (Ping: $PING)"
  exit $rc
}
trap ende EXIT
fehlschlag() { GRUND="$1"; echo "FEHLER: $1" >&2; exit 1; }

# ── 0 · Verschlüsselung wählen: age (Normalweg), sonst openssl mit Passwort — nie unverschlüsselt ──────────
auf_openssl() {
  # $1 = Grund. Nur mit Sicherungspasswort; sonst Abbruch (lieber keine Sicherung als eine unverschlüsselte).
  [ -s "$PASSWORT" ] || fehlschlag "$1 und kein Sicherungspasswort ($PASSWORT) — keine Sicherung (nie unverschlüsselt). age einrichten: NOTFALL.md"
  command -v openssl >/dev/null || fehlschlag "$1 und openssl fehlt — keine Sicherung"
  VERFAHREN=openssl; ZIEL="$ZIELORDNER/make-os-$TAG.tar.gz.enc"
  warnung "age fehlt — Sicherung nur mit Übergangs-Verschlüsselung ($1)"
  echo "  → Archiv wird mit openssl und $PASSWORT verschlüsselt (.tar.gz.enc). age einrichten: DEPLOY.md › Sicherung, NOTFALL.md" >&2
}
if [ ! -s "$PUB" ]; then auf_openssl "sicherung.pub fehlt"
elif ! command -v age >/dev/null; then auf_openssl "age ist nicht installiert"
fi
mkdir -p "$ZIELORDNER"

# ── 1–3 · Schreibpause, Schnappschuss, Pause aufheben ────────────────────────
rm -rf "$STAGE"; mkdir -p "$STAGE"
if pause_an; then PAUSE=an; SCHNAPPSCHUSS=mit-pause; else SCHNAPPSCHUSS=ohne-pause; fi
tar -C "$BASIS" --exclude='daten/backup' --exclude='daten/.sicherung-stage' --exclude='daten/.schreiber' --exclude='*.tmp' \
    --exclude='daten/brain-index.sqlite*' -cf - daten | tar -C "$STAGE" -xf - || fehlschlag "Schnappschuss (tar) gescheitert"
pause_aus
# Grabsteine gelöschter Personen (29.09., Paket D-B #70) — liegen AUSSERHALB von daten und gehen mit ins Archiv.
TEILE=(daten)
if [ -d "$BASIS/grabsteine" ]; then cp -a "$BASIS/grabsteine" "$STAGE/grabsteine" || fehlschlag "Grabsteine nicht kopierbar"; TEILE+=(grabsteine); fi
DATEIEN=$(find "${TEILE[@]/#/$STAGE/}" -type f | wc -l | tr -d ' ')

# ── 4 · Schnappschuss prüfen (entschlüsseln, parsen, zählen) ──────────────────
# Einzelne unlesbare Dateien (oder eine Prüfung, die gar nicht läuft) verhindern das Archiv NICHT: lieber ein Archiv
# mit bekannten Lücken als gar keins. Der Status nennt die Dateinamen (sicherung-pruefen.mjs, höchstens 25 je Liste).
PRUEF_RC=0; PRUEF_TEXT=$(pruefen) || PRUEF_RC=$?
if [ "$PRUEF_RC" = 0 ] || { [ "$PRUEF_RC" = 2 ] && printf '%s' "$PRUEF_TEXT" | grep -q '^{.*"ok":false}$'; }; then
  PRUEFUNG="$PRUEF_TEXT"
  if [ "$PRUEF_RC" = 2 ]; then
    NAMEN=$(printf '%s' "$PRUEF_TEXT" | grep -oE '"(fehlerNamen|archivFehlerNamen|ablageFehlerNamen)":\[[^]]*\]' | sed 's/^[^[]*\[//; s/\]$//; s/"//g' | tr '\n' ',' | sed 's/,,*/,/g; s/^,//; s/,$//' || true)
    warnung "Prüfung teilweise — nicht lesbar: ${NAMEN:-?} (Archiv trotzdem geschrieben)"
  fi
else
  PRUEFUNG=null
  warnung "Prüfung des Schnappschusses nicht gelaufen (Exit $PRUEF_RC) — Archiv ungeprüft geschrieben"
fi

# ── 5 · packen und verschlüsseln (age; openssl nur als Übergang, siehe 0) ─────
tar -C "$STAGE" -czf "$STAGE/archiv.tar.gz" "${TEILE[@]}" || fehlschlag "Packen gescheitert"
IM_ARCHIV=$(tar -tzf "$STAGE/archiv.tar.gz" | grep -vc '/$' || true)
[ "$IM_ARCHIV" = "$DATEIEN" ] || fehlschlag "Archiv unvollständig ($IM_ARCHIV von $DATEIEN Dateien)"
if [ "$VERFAHREN" = age ] && ! age -R "$PUB" -o "$ZIEL.tmp" "$STAGE/archiv.tar.gz"; then
  rm -f "$ZIEL.tmp"; auf_openssl "age-Verschlüsselung gescheitert (sicherung.pub prüfen)"
fi
if [ "$VERFAHREN" = openssl ]; then
  openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$PASSWORT" -in "$STAGE/archiv.tar.gz" -out "$ZIEL.tmp" || fehlschlag "openssl-Verschlüsselung gescheitert"
fi

# ── 6 · Archiv prüfen, ablegen, Generationen ─────────────────────────────────
if [ "$VERFAHREN" = age ]; then [ "$(head -c 21 "$ZIEL.tmp")" = "age-encryption.org/v1" ] || fehlschlag "Archiv hat keinen age-Kopf"
else [ "$(head -c 8 "$ZIEL.tmp")" = "Salted__" ] || fehlschlag "Archiv hat keinen openssl-Kopf"; fi
[ "$(wc -c <"$ZIEL.tmp" | tr -d ' ')" -gt 200 ] || fehlschlag "Archiv verdächtig klein"
chmod 600 "$ZIEL.tmp" && mv "$ZIEL.tmp" "$ZIEL"
ARCHIV=true
GROESSE_MB=$(du -m "$ZIEL" | cut -f1)
generationen_aufraeumen "$ZIELORDNER" 14 8 12
if [ ${#WARNUNGEN[@]} -gt 0 ]; then ERGEBNIS=warnung; else ERGEBNIS=ok; GRUND=""; fi
