#!/usr/bin/env bash
# ─── MAKE OS · Medienspeicher (Hetzner Object Storage) einrichten (auf dem Server, 09.10.2026, Paket 5 „Medien unterwegs“) ─────
# Einmal ausführen — vom Mac aus, im Terminal:
#   ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/medien-speicher-verbinden.sh
# Es fragt Endpunkt, Bucket, Zugangsschlüssel und Geheimnis (das Geheimnis bleibt unsichtbar), schreibt sie in /srv/make-os/app/.env (nur für
# den Nutzer make lesbar) und startet MAKE OS neu. Ohne diese Einrichtung liegen Fotos und Videos im Ordner daten/medien auf dem Server
# (außerhalb der Nachtsicherung, Grenze MAKE_OS_MEDIEN_ORDNER_MB) — der Head of IT meldet das gelb.
#
# Vorher in der Hetzner Cloud Console (UPDATES.md › 09.10. Medien unterwegs):
#   1. Object Storage → Bucket anlegen: Standort Nürnberg (nbg1) oder Falkenstein (fsn1), Sichtbarkeit PRIVAT, Versionierung AUS.
#   2. Lebenszyklus-Regel: „abgebrochene Multipart-Uploads nach 2 Tagen löschen“.
#   3. S3-Zugangsdaten erzeugen (Access Key + Secret Key) — das Secret zeigt Hetzner nur einmal.
# Der Bucket sieht nur Chiffrat (je Segment verschlüsselt, Schlüssel je Medium bleibt auf dem Server) unter zufälligen Namen.
#
# Die Werte NIE in den Chat, NIE ins Repo. Das Geheimnis erscheint nirgends: nicht auf dem Bildschirm, nicht in der Prozessliste, nicht im Log.
# Entfernen: dieses Skript mit --entfernen (löscht die Zeilen; neue Medien gehen dann wieder in den Ordner — vorhandene im Bucket sind ohne
# die Zeilen NICHT lesbar: erst umziehen, dann entfernen).
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = zusätzliche Zeilen (leer beim Entfernen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E '^MAKE_OS_MEDIEN_S3_(ENDPUNKT|BUCKET|ZUGANG|GEHEIMNIS|REGION|STIL)=' "$ENV_DATEI" > "$tmp" || true
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

if [[ "${1:-}" == "--entfernen" ]]; then
  schreibe_env ""
  neu_starten
  echo "Entfernt. Neue Medien gehen wieder in den Ordner daten/medien."
  exit 0
fi

read -rp "Endpunkt (z. B. https://nbg1.your-objectstorage.com), dann Enter: " ENDPUNKT
ENDPUNKT="$(printf '%s' "$ENDPUNKT" | tr -d '[:space:]')"; ENDPUNKT="${ENDPUNKT%/}"
if [[ ! "$ENDPUNKT" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{2,5})?$ ]]; then echo "Abbruch: der Endpunkt muss mit https:// beginnen (ohne Pfad)."; exit 1; fi
read -rp "Bucket-Name, dann Enter: " BUCKET
BUCKET="$(printf '%s' "$BUCKET" | tr -d '[:space:]')"
if [[ ! "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,62}$ ]]; then echo "Abbruch: das sieht nicht wie ein Bucket-Name aus."; exit 1; fi
read -rp "Zugangsschlüssel (Access Key), dann Enter: " ZUGANG
ZUGANG="$(printf '%s' "$ZUGANG" | tr -d '[:space:]')"
if [[ ! "$ZUGANG" =~ ^[A-Za-z0-9]{12,128}$ ]]; then echo "Abbruch: das sieht nicht wie ein Zugangsschlüssel aus."; exit 1; fi
echo "Zugangsschlüssel: ${ZUGANG:0:4}…${ZUGANG: -2}"

GEHEIM=""
for versuch in 1 2 3; do
  read -rsp "Geheimnis (Secret Key) einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
  if [[ "$ROH" =~ ^[A-Za-z0-9+/=_-]{20,200}$ ]]; then
    HALB=$(( ${#ROH} / 2 ))
    if (( ${#ROH} % 2 == 0 )) && [[ "${ROH:0:$HALB}" == "${ROH:$HALB}" ]]; then echo "Da kam das Geheimnis zweimal hintereinander an — bitte nur EINMAL einfügen."; continue; fi
    GEHEIM="$ROH"; echo "Erkannt: ${#GEHEIM} Zeichen."; break
  fi
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte einfügen (Cmd+V), dann Enter."; else echo "Das sieht nicht wie ein Geheimnis aus."; fi
done
unset ROH HALB
if [[ -z "$GEHEIM" ]]; then echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

read -rp "Adress-Stil [Enter = pfad, sonst „host“]: " STIL
STIL="$(printf '%s' "$STIL" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
ZEILEN="MAKE_OS_MEDIEN_S3_ENDPUNKT=$ENDPUNKT
MAKE_OS_MEDIEN_S3_BUCKET=$BUCKET
MAKE_OS_MEDIEN_S3_ZUGANG=$ZUGANG
MAKE_OS_MEDIEN_S3_GEHEIMNIS=$GEHEIM"
[[ "$STIL" == "host" ]] && ZEILEN="$ZEILEN
MAKE_OS_MEDIEN_S3_STIL=host"

schreibe_env "$ZEILEN"
unset GEHEIM ZEILEN
neu_starten
echo
echo "Fertig. Prüfen: MAKE OS › Fotos & Videos › ein Foto hochladen; Head of IT ohne gelben Befund „Medienspeicher“."
