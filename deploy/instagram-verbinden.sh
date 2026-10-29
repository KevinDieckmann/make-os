#!/usr/bin/env bash
# ─── MAKE OS · Instagram für Social einrichten (auf dem Server, 28.10.2026) ────
# Einmal ausführen — vom Mac aus, im Terminal:
#   ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/instagram-verbinden.sh
# Es fragt App-ID und App-Secret der Instagram-App (developers.facebook.com › App › Instagram › „API setup with Instagram login“; das Secret bleibt unsichtbar), schreibt sie in
# /srv/make-os/app/.env (nur für den Nutzer make lesbar) und startet MAKE OS neu. Danach verbindet JEDE Person ihren Kanal selbst:
# Markttraktion › Marketing › Social › Kanal › Automatik › „Mit Instagram verbinden“ (Personenmarke: nur die Person selbst).
#
# In der Meta-App (UPDATES.md 28.10.):
#   Produkt         „Instagram“ › „API setup with Instagram login“ (Standard Access reicht für EIGENE Professional-Konten, ohne App Review)
#   Redirect URL    <MAKE_OS_ADRESSE>/api/social/instagram/rueckruf
#   Rollen          jede Person, die ihr Konto verbindet, als Tester/Instagram-Tester eintragen und die Einladung in Instagram annehmen
# Konto: Instagram-Professional-Konto (Business oder Creator). Die Anmeldung gilt 60 Tage, MAKE OS verlängert sie selbst (ab 7 Tagen Rest).
#
# Die Werte NIE in den Chat, NIE ins Repo. Das Secret erscheint nirgends: nicht auf dem Bildschirm, nicht in der Prozessliste,
# nicht im Log. Optional fragt das Skript eine abweichende Redirect-URL (sonst MAKE_OS_ADRESSE + /api/social/instagram/rueckruf).
#
# Entfernen: dieses Skript mit --entfernen (löscht die Zeilen). Ohne die Zeilen postet MAKE OS nichts mehr auf Instagram; den Zugang
# selbst widerruft jede Person in Instagram (Einstellungen › Apps und Websites).
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = zusätzliche Zeilen (leer beim Entfernen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E '^INSTAGRAM_(APP_ID|APP_SECRET|RUECKRUF_URL)=' "$ENV_DATEI" > "$tmp" || true
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
  echo "Entfernt. MAKE OS postet nichts mehr auf Instagram; den Zugang widerruft jede Person in Instagram selbst (Einstellungen › Apps und Websites)."
  exit 0
fi

read -rp "Instagram-App-ID, dann Enter: " CLIENT_ID
CLIENT_ID="$(printf '%s' "$CLIENT_ID" | tr -d '[:space:]')"
# App-IDs von Meta sind Ziffern (Annahme aus der Oberfläche der App-Einstellungen) — nur grob prüfen.
if [[ ! "$CLIENT_ID" =~ ^[0-9]{6,30}$ ]]; then echo "Abbruch: das sieht nicht wie eine App-ID aus."; exit 1; fi
echo "App-ID: $CLIENT_ID"

SECRET=""
for versuch in 1 2 3; do
  read -rsp "App-Secret einfügen, dann Enter (man sieht nichts): " ROH; echo
  ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
  if [[ "$ROH" =~ ^[A-Za-z0-9._~+/=-]{16,300}$ ]]; then
    # Doppelt eingefügt? (06.10. bei Google passiert) — gleiche Hälften sind fast sicher ein Fehler.
    HALB=$(( ${#ROH} / 2 ))
    if (( ${#ROH} % 2 == 0 )) && [[ "${ROH:0:$HALB}" == "${ROH:$HALB}" ]]; then echo "Da kam das Secret zweimal hintereinander an — bitte nur EINMAL einfügen."; continue; fi
    SECRET="$ROH"; echo "Erkannt: ${#SECRET} Zeichen, endet auf ••••${SECRET: -4}"; break
  fi
  if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte das Secret einfügen (Cmd+V), dann Enter."
  else echo "Das sieht nicht wie ein App-Secret aus."; fi
done
unset ROH HALB
if [[ -z "$SECRET" ]]; then echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; fi

read -rp "Abweichende Redirect-URL (https://…/api/social/instagram/rueckruf) [Enter = aus MAKE_OS_ADRESSE]: " RUECKRUF
RUECKRUF="$(printf '%s' "$RUECKRUF" | tr -d '[:space:]')"
ZEILEN="INSTAGRAM_APP_ID=$CLIENT_ID
INSTAGRAM_APP_SECRET=$SECRET"
if [[ -n "$RUECKRUF" ]]; then
  if [[ ! "$RUECKRUF" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{2,5})?/api/social/instagram/rueckruf$ ]]; then unset SECRET ZEILEN; echo "Abbruch: die Redirect-URL muss https://<adresse>/api/social/instagram/rueckruf sein."; exit 1; fi
  ZEILEN="$ZEILEN
INSTAGRAM_RUECKRUF_URL=$RUECKRUF"
elif ! grep -q -E '^MAKE_OS_ADRESSE=https://' "$ENV_DATEI"; then
  unset SECRET ZEILEN; echo "Abbruch: MAKE_OS_ADRESSE fehlt in $ENV_DATEI — bitte eine Redirect-URL angeben."; exit 1
fi

schreibe_env "$ZEILEN"
unset SECRET ZEILEN
neu_starten
echo
echo "Fertig. Jeder Kanal verbindet sich jetzt selbst: Social › Kanal › Automatik › „Mit Instagram verbinden“."
