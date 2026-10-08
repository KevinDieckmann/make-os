#!/usr/bin/env bash
# ─── MAKE OS · ZOE auf WhatsApp — die eigene ZOE-Nummer einrichten (auf dem Server) ──────────────────────────────────────────
# Kevin 08.10. (R5): „Zweite Business-Nummer nur für ZOE.“ Eine EIGENE Nummer in einer EIGENEN Meta-App (eigenes App-Geheimnis, eigene
# Webhook-Adresse) — nie dieselbe Nummer wie die Business-Nummer (WHATSAPP_TELEFONNUMMER_ID). Vorher bei Meta alles anlegen und die Vorlage
# „briefing_bereit“ (UTILITY) einreichen: UPDATES.md › 08.10. „ZOE auf WhatsApp“.
# Einmal ausführen — vom Mac aus, im Terminal:
#   ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/zoe-whatsapp-verbinden.sh
# Es fragt:
#   · Telefonnummer-ID und WABA-ID der ZOE-Nummer (Ziffern aus dem App-Dashboard der ZOE-App › WhatsApp › API-Einrichtung)
#   · den DAUERHAFTEN Zugriffsschlüssel des System-Users — verdeckt, genau EINMAL einfügen (doppelt Eingefügtes wird erkannt)
#   · das App-Geheimnis der ZOE-App — verdeckt; damit prüft MAKE OS jede Meldung der ZOE-Nummer
#   · optional Name und Sprache der Vorlage (Vorgabe briefing_bereit · de)
# Den Verify-Token erzeugt das Skript selbst (Zufall) und zeigt ihn an — Kevin trägt ihn bei Meta am Webhook ein (zusammen mit der
# Adresse https://app.makeinnovation.de/api/zoe/whatsapp/webhook). Ein schon vorhandener Verify-Token bleibt auf Wunsch.
# Schreibt alles in /srv/make-os/app/.env (nur für den Nutzer make lesbar) und startet MAKE OS neu. Die Werte der Business-Nummer
# (WHATSAPP_TELEFONNUMMER_ID …) fasst es nicht an.
#
# Werte NIE in den Chat, NIE ins Repo. Schlüssel und Geheimnis erscheinen nirgends: nicht auf dem Bildschirm (nur die letzten vier
# Zeichen), nicht in der Prozessliste, nicht im Log.
#
# Entfernen: dieses Skript mit --entfernen (löscht nur die WHATSAPP_ZOE_*-Zeilen; die Nummer bleibt bei Meta registriert — dort im
# WhatsApp Manager verwalten, den System-User-Schlüssel im Business Manager widerrufen).
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = zusätzliche Zeilen (leer beim Entfernen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E '^WHATSAPP_ZOE_(TELEFONNUMMER_ID|WABA_ID|ZUGRIFFSSCHLUESSEL|APP_GEHEIMNIS|VERIFY_TOKEN|VORLAGE|VORLAGE_SPRACHE)=' "$ENV_DATEI" > "$tmp" || true
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
  echo "Entfernt. Der Webhook der ZOE-Nummer nimmt nichts mehr an (404); Hinweise laufen wieder über Telegram bzw. gar nicht."
  echo "Bei Meta: System-User-Schlüssel der ZOE-App widerrufen, Webhook-Abo prüfen."
  exit 0
fi

ziffern() { # $1 = Frage, $2 = Name — liest eine ID aus Ziffern
  local wert
  read -rp "$1, dann Enter: " wert
  wert="$(printf '%s' "$wert" | tr -d '[:space:]')"
  if [[ ! "$wert" =~ ^[0-9]{5,25}$ ]]; then echo "Abbruch: „$wert“ ist keine $2 (nur Ziffern)." >&2; exit 1; fi
  printf '%s' "$wert"
}

NUMMER_ID="$(ziffern 'Telefonnummer-ID der ZOE-Nummer (Phone number ID, nur Ziffern)' 'Telefonnummer-ID')"
echo "Telefonnummer-ID: $NUMMER_ID"
# Nie dieselbe Nummer wie die Business-Nummer (die ZOE-Nummer bliebe sonst aus — MAKE OS prüft das beim Start ebenfalls).
BUSINESS_ID="$(grep -E '^WHATSAPP_TELEFONNUMMER_ID=' "$ENV_DATEI" | head -1 | cut -d= -f2- | tr -d '[:space:]' || true)"
if [[ -n "$BUSINESS_ID" && "$NUMMER_ID" == "$BUSINESS_ID" ]]; then echo "Abbruch: Das ist die Telefonnummer-ID der Business-Nummer. ZOE braucht eine EIGENE Nummer."; exit 1; fi
WABA_ID="$(ziffern 'WhatsApp-Business-Konto-ID der ZOE-Nummer (WABA-ID, nur Ziffern)' 'WABA-ID')"
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
  read -rsp "App-Geheimnis (App Secret) der ZOE-App einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
  if [[ "$ROH" =~ ^[A-Za-z0-9]{16,128}$ ]]; then GEHEIMNIS="$ROH"; echo "Erkannt: ••••${GEHEIMNIS: -4}"; break; fi
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte das App-Geheimnis einfügen, dann Enter."
  else echo "Das sieht nicht wie ein App-Geheimnis aus (Buchstaben und Ziffern)."; fi
done
unset ROH
if [[ -z "$GEHEIMNIS" ]]; then unset ZUGRIFF; echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

read -rp "Name der Vorlage außerhalb des 24-h-Fensters [briefing_bereit]: " VORLAGE
VORLAGE="$(printf '%s' "${VORLAGE:-briefing_bereit}" | tr -d '[:space:]')"
if [[ ! "$VORLAGE" =~ ^[a-z0-9_]{1,512}$ ]]; then unset ZUGRIFF GEHEIMNIS; echo "Abbruch: „$VORLAGE“ ist kein Vorlagen-Name (Kleinbuchstaben, Ziffern, _)."; exit 1; fi
read -rp "Sprache der Vorlage [de]: " SPRACHE
SPRACHE="$(printf '%s' "${SPRACHE:-de}" | tr -d '[:space:]')"
if [[ ! "$SPRACHE" =~ ^[a-z]{2,3}(_[A-Za-z]{2,4})?$ ]]; then unset ZUGRIFF GEHEIMNIS; echo "Abbruch: „$SPRACHE“ ist kein Sprach-Code (z. B. de oder de_DE)."; exit 1; fi

ALT_TOKEN="$(grep -E '^WHATSAPP_ZOE_VERIFY_TOKEN=' "$ENV_DATEI" | head -1 | cut -d= -f2- || true)"
VERIFY=""
if [[ "$ALT_TOKEN" =~ ^[A-Za-z0-9_-]{24,128}$ ]]; then
  read -rp "Es gibt schon einen Verify-Token der ZOE-Nummer (bei Meta eingetragen?). Behalten? [J/n]: " BEHALTEN
  if [[ ! "${BEHALTEN:-j}" =~ ^[nN] ]]; then VERIFY="$ALT_TOKEN"; fi
fi
if [[ -z "$VERIFY" ]]; then VERIFY="$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n')"; fi
unset ALT_TOKEN

schreibe_env "WHATSAPP_ZOE_TELEFONNUMMER_ID=${NUMMER_ID}
WHATSAPP_ZOE_WABA_ID=${WABA_ID}
WHATSAPP_ZOE_ZUGRIFFSSCHLUESSEL=${ZUGRIFF}
WHATSAPP_ZOE_APP_GEHEIMNIS=${GEHEIMNIS}
WHATSAPP_ZOE_VERIFY_TOKEN=${VERIFY}
WHATSAPP_ZOE_VORLAGE=${VORLAGE}
WHATSAPP_ZOE_VORLAGE_SPRACHE=${SPRACHE}"
unset ZUGRIFF GEHEIMNIS
echo "Gespeichert (nur für den Nutzer make lesbar)."
neu_starten
echo
echo "Jetzt bei Meta (App-Dashboard der ZOE-App › WhatsApp › Konfiguration › Webhook › Bearbeiten) eintragen:"
echo "  Rückruf-URL:      https://app.makeinnovation.de/api/zoe/whatsapp/webhook"
echo "  Verify-Token:     ${VERIFY}"
echo "Dann „Überprüfen und speichern“ und unter Webhook-Felder „messages“ abonnieren."
echo "Danach in MAKE OS: Konto › ZOE auf WhatsApp — Nummer eingeben, Code holen, den Code von deinem Handy an die ZOE-Nummer schicken."
