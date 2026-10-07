#!/usr/bin/env bash
# ─── MAKE OS · WhatsApp Business (Cloud API von Meta) einrichten (auf dem Server) ────────────────────────────────────
# Einmal ausführen — vom Mac aus, im Terminal (vorher bei Meta alles anlegen: UPDATES.md › 07.10. „WhatsApp Business“):
#   ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/whatsapp-verbinden.sh
# Es fragt:
#   · Telefonnummer-ID und WhatsApp-Business-Konto-ID (WABA-ID) — Ziffern aus dem App-Dashboard bei Meta (WhatsApp › API-Einrichtung)
#   · den DAUERHAFTEN Zugriffsschlüssel des System-Users (Rechte whatsapp_business_messaging + whatsapp_business_management) —
#     verdeckt, genau EINMAL einfügen (doppelt Eingefügtes wird erkannt)
#   · das App-Geheimnis (App-Dashboard › App-Einstellungen › Allgemeines) — verdeckt; damit prüft MAKE OS jede Meldung von Meta
#   · den Bereich (Vorgabe ug = MAKE Innovation) und optional, welche Konten die Nummer sehen
# Den Verify-Token erzeugt das Skript selbst (Zufall) und zeigt ihn an — Kevin trägt ihn bei Meta beim Webhook ein (zusammen mit der
# Webhook-Adresse https://app.makeinnovation.de/api/whatsapp/webhook). Ein schon vorhandener Verify-Token bleibt auf Wunsch.
# Schreibt alles in /srv/make-os/app/.env (nur für den Nutzer make lesbar) und startet MAKE OS neu.
#
# Werte NIE in den Chat, NIE ins Repo. Schlüssel und Geheimnis erscheinen nirgends: nicht auf dem Bildschirm (nur die letzten vier
# Zeichen), nicht in der Prozessliste, nicht im Log.
#
# Entfernen: dieses Skript mit --entfernen (löscht die Zeilen; die Nummer bleibt bei Meta registriert — dort im WhatsApp Manager
# verwalten, den System-User-Schlüssel im Business Manager widerrufen).
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = zusätzliche Zeilen (leer beim Entfernen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E '^WHATSAPP_(TELEFONNUMMER_ID|WABA_ID|ZUGRIFFSSCHLUESSEL|APP_GEHEIMNIS|VERIFY_TOKEN|BEREICH|PERSONEN)=' "$ENV_DATEI" > "$tmp" || true
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
  echo "Entfernt. Der Webhook nimmt nichts mehr an (404). Bei Meta: System-User-Schlüssel widerrufen, Webhook-Abo prüfen."
  exit 0
fi

ziffern() { # $1 = Frage, $2 = Name — liest eine ID aus Ziffern
  local wert
  read -rp "$1, dann Enter: " wert
  wert="$(printf '%s' "$wert" | tr -d '[:space:]')"
  if [[ ! "$wert" =~ ^[0-9]{5,25}$ ]]; then echo "Abbruch: „$wert“ ist keine $2 (nur Ziffern)." >&2; exit 1; fi
  printf '%s' "$wert"
}

NUMMER_ID="$(ziffern 'Telefonnummer-ID (Phone number ID, nur Ziffern)' 'Telefonnummer-ID')"
echo "Telefonnummer-ID: $NUMMER_ID"
WABA_ID="$(ziffern 'WhatsApp-Business-Konto-ID (WABA-ID, nur Ziffern)' 'WABA-ID')"
echo "WABA-ID: $WABA_ID"
if [[ "$NUMMER_ID" == "$WABA_ID" ]]; then echo "Abbruch: Telefonnummer-ID und WABA-ID sind gleich — bitte beide im App-Dashboard nachsehen."; exit 1; fi

ZUGRIFF=""
for versuch in 1 2 3; do
  read -rsp "Dauerhaften Zugriffsschlüssel des System-Users EINMAL einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
  HAELFTE=$(( ${#ROH} / 2 ))
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte den Schlüssel einfügen (Cmd+V), dann Enter."; continue; fi
  if (( ${#ROH} % 2 == 0 )) && [[ "${ROH:0:$HAELFTE}" == "${ROH:$HAELFTE}" ]]; then echo "Der Schlüssel kam doppelt an (zweimal eingefügt) — bitte genau EINMAL einfügen."; continue; fi
  if [[ "$ROH" =~ ^[A-Za-z0-9_.-]{50,}$ ]] && (( ${#ROH} <= 1024 )); then ZUGRIFF="$ROH"; echo "Erkannt: ${#ZUGRIFF} Zeichen, endet auf ••••${ZUGRIFF: -4}"; break; fi
  echo "Das sieht nicht wie ein Zugriffsschlüssel von Meta aus (mindestens 50 Zeichen, Buchstaben/Ziffern)."
done
unset ROH
if [[ -z "$ZUGRIFF" ]]; then echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

GEHEIMNIS=""
for versuch in 1 2 3; do
  read -rsp "App-Geheimnis (App Secret) einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
  if [[ "$ROH" =~ ^[A-Za-z0-9]{16,128}$ ]]; then GEHEIMNIS="$ROH"; echo "Erkannt: ••••${GEHEIMNIS: -4}"; break; fi
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte das App-Geheimnis einfügen, dann Enter."
  else echo "Das sieht nicht wie ein App-Geheimnis aus (Buchstaben und Ziffern)."; fi
done
unset ROH
if [[ -z "$GEHEIMNIS" ]]; then unset ZUGRIFF; echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

read -rp "Bereich der Nummer (ug = MAKE Innovation, kdv = KD Ventures, g-… aus dem Register) [ug]: " BEREICH
BEREICH="$(printf '%s' "${BEREICH:-ug}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
if [[ ! "$BEREICH" =~ ^(kdv|ug|g-[a-z0-9][a-z0-9-]{3,62})$ ]]; then unset ZUGRIFF GEHEIMNIS; echo "Abbruch: „$BEREICH“ ist kein Business-Bereich (WhatsApp Business gehört nie zu Privat)."; exit 1; fi

read -rp "Welche Konten sehen die Nummer? Speichernamen mit Komma (z. B. kevin,malin) [Enter = alle im Haushalt]: " PERSONEN
PERSONEN="$(printf '%s' "$PERSONEN" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
if [[ -n "$PERSONEN" && ! "$PERSONEN" =~ ^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40})*$ ]]; then unset ZUGRIFF GEHEIMNIS; echo "Abbruch: „$PERSONEN“ — bitte Speichernamen mit Komma."; exit 1; fi

ALT_TOKEN="$(grep -E '^WHATSAPP_VERIFY_TOKEN=' "$ENV_DATEI" | head -1 | cut -d= -f2- || true)"
VERIFY=""
if [[ "$ALT_TOKEN" =~ ^[A-Za-z0-9_-]{24,128}$ ]]; then
  read -rp "Es gibt schon einen Verify-Token (bei Meta eingetragen?). Behalten? [J/n]: " BEHALTEN
  if [[ ! "${BEHALTEN:-j}" =~ ^[nN] ]]; then VERIFY="$ALT_TOKEN"; fi
fi
if [[ -z "$VERIFY" ]]; then VERIFY="$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n')"; fi
unset ALT_TOKEN

PERSONEN_ZEILE=""
if [[ -n "$PERSONEN" ]]; then PERSONEN_ZEILE="
WHATSAPP_PERSONEN=${PERSONEN}"; fi

schreibe_env "WHATSAPP_TELEFONNUMMER_ID=${NUMMER_ID}
WHATSAPP_WABA_ID=${WABA_ID}
WHATSAPP_ZUGRIFFSSCHLUESSEL=${ZUGRIFF}
WHATSAPP_APP_GEHEIMNIS=${GEHEIMNIS}
WHATSAPP_VERIFY_TOKEN=${VERIFY}
WHATSAPP_BEREICH=${BEREICH}${PERSONEN_ZEILE}"
unset ZUGRIFF GEHEIMNIS
echo "Gespeichert (nur für den Nutzer make lesbar)."
neu_starten
echo
echo "Jetzt bei Meta (App-Dashboard › WhatsApp › Konfiguration › Webhook › Bearbeiten) eintragen:"
echo "  Rückruf-URL:      https://app.makeinnovation.de/api/whatsapp/webhook"
echo "  Verify-Token:     ${VERIFY}"
echo "Dann „Überprüfen und speichern“ und unter Webhook-Felder „messages“ abonnieren."
echo "Danach in MAKE OS: Verbindungen › WhatsApp Business › „Verbindung prüfen“."
