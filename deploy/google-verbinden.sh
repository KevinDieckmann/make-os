#!/usr/bin/env bash
# ─── MAKE OS · Google (Kalender + Gmail) einrichten (auf dem Server) ─────────
# Einmal ausführen — vom Mac aus, im Terminal:
#   ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/google-verbinden.sh
# Es fragt Client-ID und Client-Geheimnis der Google-Anwendung (Einfügen, das Geheimnis bleibt unsichtbar) und die
# erlaubte Domain (Vorgabe: makeinnovation.de), schreibt sie in /srv/make-os/app/.env (nur für den Nutzer make lesbar)
# und startet MAKE OS neu. Danach verbindet sich jede Person selbst: MAKE OS › Kalender › Einstellungen › „Google
# Kalender verbinden“ bzw. in der Inbox „Gmail verbinden“.
# Optional (Gmail-Echtzeit per Pub/Sub, GOOGLE_GMAIL_EINRICHTEN.md Teil B): Thema, Dienstkonto und Zielgruppe der Push-Subscription —
# Enter überspringt; ohne sie fragt MAKE OS Gmail alle 2 Minuten ab (nichts geht verloren).
#
# Die Werte stammen aus der Google Cloud Console (GOOGLE_KALENDER_EINRICHTEN.md, Schritt 5) — NIE in den Chat, NIE ins
# Repo. Das Geheimnis erscheint nirgends: nicht auf dem Bildschirm, nicht in der Prozessliste, nicht im Log.
#
# Entfernen: dieses Skript mit --entfernen (löscht die Zeilen; verbundene Konten sollten vorher in MAKE OS getrennt
# werden, sonst bleibt der Zugriff bei Google bestehen — dort unter myaccount.google.com › Sicherheit widerrufbar).
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = zusätzliche Zeilen (leer beim Entfernen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E '^(GOOGLE_(CLIENT_ID|CLIENT_SECRET|ERLAUBTE_DOMAIN)|GMAIL_(PUBSUB_THEMA|PUSH_DIENSTKONTO|PUSH_AUDIENCE))=' "$ENV_DATEI" > "$tmp" || true
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
  echo "Entfernt. Verbundene Konten bitte in MAKE OS trennen bzw. bei Google den Zugriff widerrufen."
  exit 0
fi

read -rp "Client-ID (endet auf .apps.googleusercontent.com), dann Enter: " CLIENT_ID
CLIENT_ID="$(printf '%s' "$CLIENT_ID" | tr -d '[:space:]')"
if [[ ! "$CLIENT_ID" =~ ^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$ ]]; then echo "Abbruch: „$CLIENT_ID“ sieht nicht wie eine Google-Client-ID aus (…apps.googleusercontent.com)."; exit 1; fi
echo "Client-ID: $CLIENT_ID"

SECRET=""
for versuch in 1 2 3; do
  read -rsp "Client-Geheimnis einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
  # 06.10.: Im unsichtbaren Feld wurde mehrfach eingefügt → sechs Geheimnisse aneinander, Google lehnte die Anmeldung ab.
  # Darum: genau EIN Geheimnis (heutige Google-Form „GOCSPX-…“, sonst plausible Länge 16–64), sonst neu fragen.
  ANZ="$(printf '%s' "$ROH" | grep -o 'GOCSPX-' | wc -l | tr -d ' ')"
  if [[ "$ANZ" -gt 1 ]]; then echo "Da kam das Geheimnis ${ANZ}× hintereinander an — bitte nur EINMAL einfügen (Cmd+V), dann Enter."; continue; fi
  if [[ "$ROH" =~ ^[A-Za-z0-9_-]{16,64}$ ]]; then SECRET="$ROH"; echo "Erkannt: ${#SECRET} Zeichen, endet auf ••••${SECRET: -4}"; break; fi
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte das Geheimnis einfügen (Cmd+V), dann Enter."
  else echo "Das sieht nicht wie ein Client-Geheimnis aus (Buchstaben, Ziffern, - und _)."; fi
done
unset ROH ANZ
if [[ -z "$SECRET" ]]; then echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

read -rp "Erlaubte Domain für die Google-Konten [makeinnovation.de]: " DOMAIN
DOMAIN="$(printf '%s' "${DOMAIN:-makeinnovation.de}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
if [[ ! "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$ ]]; then unset SECRET; echo "Abbruch: „$DOMAIN“ sieht nicht wie eine Domain aus."; exit 1; fi

echo
echo "Gmail-Echtzeit (Pub/Sub) — optional, Enter überspringt (dann Abfrage alle 2 Minuten):"
read -rp "Pub/Sub-Thema (projects/<Projekt-ID>/topics/<Name>) [überspringen]: " THEMA
THEMA="$(printf '%s' "$THEMA" | tr -d '[:space:]')"
PUSH_ZEILEN=""
if [[ -n "$THEMA" ]]; then
  if [[ ! "$THEMA" =~ ^projects/[a-z][a-z0-9-]{4,60}/topics/[A-Za-z][A-Za-z0-9._~%+-]{2,254}$ ]]; then unset SECRET; echo "Abbruch: „$THEMA“ sieht nicht wie ein Pub/Sub-Thema aus (projects/…/topics/…)."; exit 1; fi
  read -rp "Dienstkonto der Push-Subscription (…@….iam.gserviceaccount.com): " PUSHKONTO
  PUSHKONTO="$(printf '%s' "$PUSHKONTO" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  if [[ ! "$PUSHKONTO" =~ ^[a-z0-9._-]+@[a-z0-9.-]+\.gserviceaccount\.com$ ]]; then unset SECRET; echo "Abbruch: „$PUSHKONTO“ sieht nicht wie ein Dienstkonto aus."; exit 1; fi
  read -rp "Zielgruppe/Audience der Subscription [Enter = die Webhook-Adresse]: " AUDIENCE
  AUDIENCE="$(printf '%s' "$AUDIENCE" | tr -d '[:space:]')"
  PUSH_ZEILEN="
GMAIL_PUBSUB_THEMA=${THEMA}
GMAIL_PUSH_DIENSTKONTO=${PUSHKONTO}"
  if [[ -n "$AUDIENCE" ]]; then PUSH_ZEILEN="${PUSH_ZEILEN}
GMAIL_PUSH_AUDIENCE=${AUDIENCE}"; fi
fi

schreibe_env "GOOGLE_CLIENT_ID=${CLIENT_ID}
GOOGLE_CLIENT_SECRET=${SECRET}
GOOGLE_ERLAUBTE_DOMAIN=${DOMAIN}${PUSH_ZEILEN}"
unset SECRET
echo "Gespeichert (nur für den Nutzer make lesbar)."
neu_starten
echo "Fertig. Jede Person verbindet sich jetzt selbst: MAKE OS › Kalender › Einstellungen › „Google Kalender verbinden“ bzw. Inbox › „Gmail verbinden“."
