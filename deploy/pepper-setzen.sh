#!/usr/bin/env bash
# ─── MAKE OS · Pepper einmal setzen (09.10.2026, Neustart) ──────────────────────────────────────────────────────────────────────
# Der Pepper macht die Fingerabdrücke von Sperrliste, Protokoll-Kennungen und Grabsteinen unumkehrbar (HMAC, lib/datenschutz/pepper.ts).
# Er wird EINMAL gesetzt und NIE gewechselt — ein anderer Pepper ließe gesperrte Personen wieder durch. Deshalb weigert sich dieses
# Skript, einen vorhandenen Pepper zu ersetzen. Vom Mac aus, im Terminal:
#   ssh -t make@<server> sudo bash /srv/make-os/app/deploy/pepper-setzen.sh
# Fragt den Pepper verdeckt (64 Hex-Zeichen, erzeugt mit `openssl rand -hex 32`, liegt im Passwort-Manager) und setzt zusätzlich
# MAKE_OS_START_RIEGEL=streng (Vorgabe neuer Instanzen: startet nicht ohne Pepper und ohne lange Schlüssel). Startet NICHT neu —
# im Neustart-Ablauf startet die App danach ohnehin (Schritt „Nur die App starten“). Wert nie in den Chat, nie ins Repo, nie ins Log.
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

if grep -qE '^MAKE_OS_PEPPER(_DATEI)?=.+' "$ENV_DATEI"; then
  echo "Abbruch: In der .env steht schon ein Pepper. Er wird nie gewechselt — nichts geändert."
  exit 1
fi

PEPPER=""
for versuch in 1 2 3; do
  read -rsp "Pepper EINMAL einfügen (64 Zeichen 0-9/a-f), dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte einfügen (Cmd+V), dann Enter."; continue; fi
  if [[ ${#ROH} -eq 128 && "${ROH:0:64}" == "${ROH:64}" ]]; then echo "Der Pepper kam doppelt an — bitte genau EINMAL einfügen."; continue; fi
  if [[ "$ROH" =~ ^[0-9a-f]{64}$ ]]; then PEPPER="$ROH"; echo "Erkannt: 64 Zeichen, endet auf ••••${PEPPER: -4} — bitte mit dem Passwort-Manager vergleichen."; break; fi
  echo "Das sind ${#ROH} Zeichen bzw. nicht nur 0-9/a-f — erwartet sind genau 64 (openssl rand -hex 32)."
done
unset ROH
[[ -n "$PEPPER" ]] || { echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; }

tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
chmod 600 "$tmp"
grep -v -E '^(MAKE_OS_PEPPER|MAKE_OS_PEPPER_DATEI|MAKE_OS_START_RIEGEL)=' "$ENV_DATEI" > "$tmp" || true
printf 'MAKE_OS_PEPPER=%s\nMAKE_OS_START_RIEGEL=streng\n' "$PEPPER" >> "$tmp"
unset PEPPER
chown --reference="$ENV_DATEI" "$tmp"
mv "$tmp" "$ENV_DATEI"
echo "Gespeichert (nur für den Nutzer make lesbar): MAKE_OS_PEPPER und MAKE_OS_START_RIEGEL=streng."
echo "Die App liest beides beim nächsten Start (docker compose up -d app)."
