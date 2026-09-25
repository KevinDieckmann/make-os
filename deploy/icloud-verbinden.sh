#!/usr/bin/env bash
# ─── MAKE OS · iCloud-Kalender verbinden (auf dem Server) ───────────────────
# Einmal ausführen — vom Mac aus, im Terminal (Apple-ID gleich mitgeben):
#   ssh -t root@2.28.108.162 bash /srv/make-os/app/deploy/icloud-verbinden.sh <apple-id>
# Dann fragt es nur noch das App-Passwort (Einfügen reicht, mit oder ohne
# Bindestriche) und zeigt zur Kontrolle die letzten vier Zeichen. Falsches
# oder leeres Passwort → es fragt noch einmal, statt abzubrechen.
#
# Vorher bei Apple ein app-spezifisches Passwort anlegen:
#   appleid.apple.com → Anmelden & Sicherheit → App-spezifische Passwörter → „MAKE OS“
# (NIE das normale Apple-Passwort — das app-spezifische lässt sich jederzeit
# einzeln widerrufen und öffnet weder Fotos noch iCloud Drive.)
#
# Das Skript fragt Apple-ID und Passwort (verdeckt), prüft die Anmeldung bei
# iCloud, schreibt beides in /srv/make-os/app/.env (nur für den Nutzer make
# lesbar), startet MAKE OS neu und holt die Kalender einmal. Das Passwort
# erscheint nirgends: nicht auf dem Bildschirm, nicht in der Prozessliste,
# nicht im Log, nicht im Repo.
#
# Trennen: das Passwort bei Apple widerrufen und dieses Skript mit --trennen.
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = zusätzliche Zeilen (leer beim Trennen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E '^ICLOUD_(APPLE_ID|APP_PASSWORT)=' "$ENV_DATEI" > "$tmp" || true
  [[ -n "$1" ]] && printf '%s\n' "$1" >> "$tmp"
  chown --reference="$ENV_DATEI" "$tmp"
  mv "$tmp" "$ENV_DATEI"
}

neu_starten() {
  echo "Starte MAKE OS neu (etwa eine halbe Minute) …"
  docker compose up -d --force-recreate app arbeiter >/dev/null 2>&1
  for _ in $(seq 1 40); do
    [[ "$(docker compose ps app --format '{{.Status}}')" == *"(healthy)"* ]] && return 0
    sleep 3
  done
  echo "MAKE OS braucht länger als sonst — bitte in ein paar Minuten die Seite öffnen."
}

if [[ "${1:-}" == "--trennen" ]]; then
  schreibe_env ""
  neu_starten
  echo "Getrennt. Bitte das app-spezifische Passwort auch bei Apple widerrufen."
  exit 0
fi

# Apple-ID: aus dem Befehl (empfohlen) oder abgefragt.
APPLE_ID="$(printf '%s' "${1:-}" | tr -d '[:space:]')"
if [[ -z "$APPLE_ID" ]]; then read -rp "Apple-ID (E-Mail-Adresse), dann Enter: " APPLE_ID; APPLE_ID="$(printf '%s' "$APPLE_ID" | tr -d '[:space:]')"; fi
if [[ ! "$APPLE_ID" =~ ^[^@[:space:]\"\\]+@[^@[:space:]\"\\]+\.[a-z]{2,}$ ]]; then echo "Abbruch: „$APPLE_ID“ sieht nicht wie eine Apple-ID (E-Mail-Adresse) aus."; exit 1; fi
echo "Apple-ID: $APPLE_ID"

# App-Passwort: verdeckt, bis zu drei Versuche. Einfügen genügt — Leerzeichen,
# Großbuchstaben und fehlende Bindestriche werden ausgeglichen.
PASSWORT=""
for versuch in 1 2 3; do
  read -rsp "App-spezifisches Passwort einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]-' | tr '[:upper:]' '[:lower:]')"
  if [[ "$ROH" =~ ^[a-z]{16}$ ]]; then
    PASSWORT="${ROH:0:4}-${ROH:4:4}-${ROH:8:4}-${ROH:12:4}"
    echo "Erkannt: ••••-••••-••••-${PASSWORT:15:4}"
    break
  fi
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte das Passwort einfügen (Cmd+V), dann Enter."
  else echo "Das sieht nicht wie ein app-spezifisches Passwort aus (16 Buchstaben, xxxx-xxxx-xxxx-xxxx). NICHT das normale Apple-Passwort."; fi
done
unset ROH
if [[ -z "$PASSWORT" ]]; then echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

echo "Prüfe die Anmeldung bei iCloud …"
# Zugang über die Standardeingabe an curl (-K -): printf ist eingebaut — nichts davon steht in der Prozessliste.
CODE="$(printf 'user = "%s:%s"\n' "$APPLE_ID" "$PASSWORT" | curl -s -o /dev/null -w '%{http_code}' -K - \
  -X PROPFIND -H 'Depth: 0' -H 'Content-Type: application/xml; charset=utf-8' \
  --data '<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>' \
  https://caldav.icloud.com/ || true)"
if [[ "$CODE" != "207" ]]; then
  unset PASSWORT
  echo "iCloud lehnt ab (HTTP ${CODE:-keine Antwort}) — nichts gespeichert."
  echo "Prüfen: stimmt die Apple-ID ($APPLE_ID)? Ist das App-Passwort bei Apple noch aktiv (nicht gelöscht)?"
  exit 1
fi
echo "Anmeldung klappt."

schreibe_env "ICLOUD_APPLE_ID=${APPLE_ID}
ICLOUD_APP_PASSWORT=${PASSWORT}"
unset PASSWORT
echo "Gespeichert (nur für den Nutzer make lesbar)."
neu_starten

echo "Hole die Kalender …"
docker compose exec -T app node -e "fetch('http://localhost:3000/api/kalender',{method:'POST',headers:{'Content-Type':'application/json','x-make-key':process.env.MAKE_OS_KEY},body:JSON.stringify({aktion:'abgleichen'})}).then(r=>r.json()).then(d=>console.log(d.ok?('Verbunden: '+d.kalender+' Kalender. Öffnet in MAKE OS oben „Kalender“.'):('Noch nicht: '+d.fehler))).catch(e=>console.log('Noch nicht erreichbar: '+e.message))"
