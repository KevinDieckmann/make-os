#!/usr/bin/env bash
# ─── MAKE OS · KI-Anbieter einrichten: Google Vertex (Claude in der EU, Bilder/Video/Tiefenbericht), Mistral, Anbieter-Tor, Budget ─
# Paket 6a (09.10.2026, Kevin 08.10. Antworten 19–25). Einmal je Anbieter ausführen — vom Mac aus, im Terminal (vorher die Schritte in
# UPDATES.md › 09.10. „KI-Anbieter“ erledigen: Google-Cloud-Projekt, Dienstkonto in EU-Region, AVV/ZDR, Mistral-Opt-out):
#   ssh -t make@<server> sudo bash /srv/make-os/app/deploy/ki-anbieter-verbinden.sh vertex
#   ssh -t make@<server> sudo bash /srv/make-os/app/deploy/ki-anbieter-verbinden.sh mistral
#   ssh -t make@<server> sudo bash /srv/make-os/app/deploy/ki-anbieter-verbinden.sh tor        # aus | an | streng
#   ssh -t make@<server> sudo bash /srv/make-os/app/deploy/ki-anbieter-verbinden.sh budget     # Instanz-Budget je Monat in Euro
#   ssh -t make@<server> sudo bash /srv/make-os/app/deploy/ki-anbieter-verbinden.sh anthropic  # Anthropic-Schlüssel tauschen (09.10.)
#   … --entfernen vertex|mistral|tor|budget                                                     # Zeilen löschen
#
# vertex  fragt: Projekt-ID, den PFAD zur Schlüsseldatei des Dienstkontos AUF DEM SERVER (vorher per scp hochladen, z. B. nach
#         /tmp/vertex.json — das Skript liest sie, prüft sie, legt sie Base64 in die .env und bietet an, die Datei sicher zu löschen),
#         ob Claude in der EU freigeschaltet ist (Model Garden), die Region (eu oder europe-…), ob Bilder/Video/Tiefenbericht erlaubt sind,
#         und ob Zero Data Retention bei Google bestätigt ist.
# anthropic fragt: den API-Schlüssel (verdeckt, genau EINMAL einfügen), prüft ihn mit EINEM Mini-Aufruf (1 Token, Bruchteil eines
#         Cents) bei api.anthropic.com — erkennt „falscher Schlüssel“ und „kein Guthaben“ VOR dem Speichern — und ersetzt ANTHROPIC_API_KEY.
# mistral fragt: den API-Schlüssel (verdeckt, genau EINMAL einfügen) und ob Training-Opt-out + ZDR bei Mistral gesetzt sind.
# Schreibt in /srv/make-os/app/.env (nur für make lesbar) und startet MAKE OS neu. Werte NIE in den Chat, NIE ins Repo; Schlüssel
# erscheinen nirgends (nicht auf dem Bildschirm außer den letzten vier Zeichen, nicht in der Prozessliste, nicht im Log).
# Danach in MAKE OS: System › Empfänger „Google Cloud Vertex AI“ bzw. „Mistral AI“ → „Zurückholen“ + AVV bestätigen (sonst sperrt das Tor),
# System › Datenschutz › KI: Fähigkeiten einschalten.
set -euo pipefail
cd /srv/make-os/app
ENV_DATEI=/srv/make-os/app/.env
[[ -f "$ENV_DATEI" ]] || { echo "Keine $ENV_DATEI gefunden — ist das der MAKE-OS-Server?"; exit 1; }

schreibe_env() { # $1 = Muster der zu ersetzenden Variablen, $2 = neue Zeilen (leer beim Entfernen)
  local tmp; tmp="$(mktemp /srv/make-os/.env-neu.XXXXXX)"   # außerhalb des Git-Ordners, gleiches Laufwerk
  chmod 600 "$tmp"
  grep -v -E "^($1)=" "$ENV_DATEI" > "$tmp" || true
  [[ -n "$2" ]] && printf '%s\n' "$2" >> "$tmp"
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

ja_nein() { # $1 = Frage, $2 = Vorgabe j|n → gibt 0 für ja
  local a; read -rp "$1 [$( [[ "$2" == j ]] && echo J/n || echo j/N )]: " a
  a="${a:-$2}"; [[ "$a" =~ ^[jJyY] ]]
}

VERTEX_MUSTER='GOOGLE_VERTEX_PROJEKT|GOOGLE_VERTEX_DIENSTKONTO|GOOGLE_VERTEX_CLAUDE|GOOGLE_VERTEX_CLAUDE_REGION|GOOGLE_VERTEX_MEDIEN|GOOGLE_VERTEX_ZDR'
MISTRAL_MUSTER='MISTRAL_API_KEY|MISTRAL_ZDR|MISTRAL_TRANSKRIPTION_MODELL'
TOR_MUSTER='MAKE_OS_KI_ANBIETER_TOR'
BUDGET_MUSTER='MAKE_OS_KI_BUDGET_MONAT_EURO|MAKE_OS_KI_BUDGET_EURO|MAKE_OS_KI_GRENZE_AUFTRAG_EURO'

if [[ "${1:-}" == "--entfernen" ]]; then
  case "${2:-}" in
    vertex) schreibe_env "$VERTEX_MUSTER" "" ;;
    mistral) schreibe_env "$MISTRAL_MUSTER" "" ;;
    tor) schreibe_env "$TOR_MUSTER" "" ;;
    budget) schreibe_env "$BUDGET_MUSTER" "" ;;
    anthropic) schreibe_env 'ANTHROPIC_API_KEY' "" ;;
    *) echo "Was entfernen? vertex | mistral | tor | budget | anthropic"; exit 1 ;;
  esac
  neu_starten
  echo "Entfernt. Den Schlüssel bitte zusätzlich beim Anbieter widerrufen (Google: Dienstkonto-Schlüssel löschen; Mistral: API-Schlüssel löschen)."
  exit 0
fi

case "${1:-}" in
anthropic)
  KEY=""
  for versuch in 1 2 3; do
    read -rsp "Anthropic-API-Schlüssel EINMAL einfügen, dann Enter (man sieht nichts): " ROH; echo
    ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
    HAELFTE=$(( ${#ROH} / 2 ))
    if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte einfügen (Cmd+V), dann Enter."; continue; fi
    if (( ${#ROH} % 2 == 0 )) && [[ "${ROH:0:$HAELFTE}" == "${ROH:$HAELFTE}" ]]; then echo "Der Schlüssel kam doppelt an — bitte genau EINMAL einfügen."; continue; fi
    if [[ "$ROH" =~ ^sk-ant-[A-Za-z0-9_-]{20,300}$ ]]; then KEY="$ROH"; echo "Erkannt: ${#KEY} Zeichen, endet auf ••••${KEY: -4}"; break; fi
    echo "Das sieht nicht wie ein Anthropic-Schlüssel aus (beginnt mit sk-ant-)."
  done
  unset ROH
  [[ -n "$KEY" ]] || { echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; }
  # Probe: EIN Aufruf mit 1 Ausgabe-Token. Der Schlüssel geht über die Standardeingabe an curl (nie in die Prozessliste).
  ANTWORT="$(mktemp)"; chmod 600 "$ANTWORT"
  CODE="$(printf 'header = "x-api-key: %s"\n' "$KEY" | curl -sS -m 30 -o "$ANTWORT" -w '%{http_code}' -K - \
    -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"ok"}]}' \
    https://api.anthropic.com/v1/messages || echo 000)"
  if grep -qi 'credit balance' "$ANTWORT"; then FEHLER="kein Guthaben in der Organisation dieses Schlüssels — in der Console die Organisation mit Guthaben wählen bzw. aufladen"
  elif [[ "$CODE" == "401" ]]; then FEHLER="Anthropic kennt den Schlüssel nicht (401) — gelöscht oder falsch kopiert?"
  elif [[ "$CODE" == "403" ]]; then FEHLER="der Schlüssel darf keine Nachrichten senden (403) — Rechte/Workspace in der Console prüfen"
  elif [[ "$CODE" == "200" ]]; then FEHLER=""
  else FEHLER="unerwartete Antwort (HTTP $CODE) — später noch einmal"
  fi
  rm -f "$ANTWORT"
  if [[ -n "$FEHLER" ]]; then unset KEY; echo "Abbruch, nichts gespeichert: $FEHLER."; exit 1; fi
  echo "Probe bestanden: Schlüssel gültig, Guthaben vorhanden."
  schreibe_env 'ANTHROPIC_API_KEY' "ANTHROPIC_API_KEY=${KEY}"
  unset KEY
  echo "Gespeichert (nur für den Nutzer make lesbar). Den alten Schlüssel bitte in der Anthropic-Console löschen."
  ;;
vertex)
  read -rp "Projekt-ID in Google Cloud (z. B. make-os-123456), dann Enter: " PROJEKT
  PROJEKT="$(printf '%s' "$PROJEKT" | tr -d '[:space:]')"
  [[ "$PROJEKT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || { echo "Abbruch: „$PROJEKT“ ist keine Projekt-ID."; exit 1; }
  read -rp "Pfad zur Schlüsseldatei des Dienstkontos auf DIESEM Server (z. B. /tmp/vertex.json): " DATEI
  [[ -f "$DATEI" ]] || { echo "Abbruch: keine Datei unter $DATEI."; exit 1; }
  # Prüfen ohne Werte auszugeben: Typ, Adresse des Dienstkontos, privater Schlüssel, Token-Adresse bei Google.
  python3 - "$DATEI" <<'PRUEF' || { echo "Abbruch: die Datei ist kein Dienstkonto-Schlüssel (type service_account, client_email …iam.gserviceaccount.com, private_key, token_uri bei oauth2.googleapis.com)."; exit 1; }
import json, re, sys
j = json.load(open(sys.argv[1]))
ok = j.get('type') == 'service_account' and re.match(r'^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$', j.get('client_email', '')) \
  and 'PRIVATE KEY' in j.get('private_key', '') and j.get('token_uri', 'https://oauth2.googleapis.com/token') == 'https://oauth2.googleapis.com/token'
sys.exit(0 if ok else 1)
PRUEF
  KONTO_B64="$(base64 -w0 < "$DATEI")"
  echo "Dienstkonto erkannt (Inhalt wird nicht angezeigt)."
  CLAUDE="aus"; REGION="eu"
  if ja_nein "Ist Claude im Model Garden für dieses Projekt freigeschaltet (EU-Region)?" n; then
    CLAUDE="an"
    read -rp "Region für Claude (eu oder europe-…) [eu]: " REGION
    REGION="$(printf '%s' "${REGION:-eu}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
    [[ "$REGION" == "eu" || "$REGION" =~ ^europe-[a-z]+[0-9]{1,2}$ ]] || { unset KONTO_B64; echo "Abbruch: „$REGION“ ist keine EU-Region — Claude über Vertex nur in der EU."; exit 1; }
  fi
  MEDIEN="aus"; ja_nein "Bilder, Video und Tiefenberichte über Vertex erlauben (Gemini; global bzw. USA)?" n && MEDIEN="an"
  ZDR=""; ja_nein "Ist Zero Data Retention für Vertex bei Google beantragt UND bestätigt (und der 24-h-Cache aus)? Nur dann gehen Gesundheitsdaten dorthin." n && ZDR="bestaetigt"
  schreibe_env "$VERTEX_MUSTER" "GOOGLE_VERTEX_PROJEKT=${PROJEKT}
GOOGLE_VERTEX_DIENSTKONTO=${KONTO_B64}
GOOGLE_VERTEX_CLAUDE=${CLAUDE}
GOOGLE_VERTEX_CLAUDE_REGION=${REGION}
GOOGLE_VERTEX_MEDIEN=${MEDIEN}${ZDR:+
GOOGLE_VERTEX_ZDR=${ZDR}}"
  unset KONTO_B64
  echo "Gespeichert (nur für den Nutzer make lesbar)."
  if ja_nein "Die hochgeladene Schlüsseldatei $DATEI jetzt sicher löschen?" j; then shred -u "$DATEI" 2>/dev/null || rm -f "$DATEI"; echo "Gelöscht."; fi
  ;;
mistral)
  KEY=""
  for versuch in 1 2 3; do
    read -rsp "Mistral-API-Schlüssel EINMAL einfügen, dann Enter (man sieht nichts): " ROH; echo
    ROH="$(printf '%s' "$ROH" | tr -d '[:space:]')"
    HAELFTE=$(( ${#ROH} / 2 ))
    if [[ -z "$ROH" ]]; then echo "Da kam nichts an — bitte einfügen (Cmd+V), dann Enter."; continue; fi
    if (( ${#ROH} % 2 == 0 )) && [[ "${ROH:0:$HAELFTE}" == "${ROH:$HAELFTE}" ]]; then echo "Der Schlüssel kam doppelt an — bitte genau EINMAL einfügen."; continue; fi
    if [[ "$ROH" =~ ^[A-Za-z0-9]{16,128}$ ]]; then KEY="$ROH"; echo "Erkannt: ${#KEY} Zeichen, endet auf ••••${KEY: -4}"; break; fi
    echo "Das sieht nicht wie ein Mistral-Schlüssel aus (Buchstaben und Ziffern)."
  done
  unset ROH
  [[ -n "$KEY" ]] || { echo "Abbruch nach drei Versuchen — nichts gespeichert."; exit 1; }
  ja_nein "Ist im Mistral-Admin-Panel das Training mit Ein-/Ausgaben ABGESCHALTET (Opt-out)? Ohne das keine echten Aufnahmen." n || { unset KEY; echo "Abbruch: erst das Training-Opt-out setzen (UPDATES.md)."; exit 1; }
  ZDR=""; ja_nein "Ist Zero Data Retention bei Mistral bestätigt?" n && ZDR="bestaetigt"
  schreibe_env "$MISTRAL_MUSTER" "MISTRAL_API_KEY=${KEY}${ZDR:+
MISTRAL_ZDR=${ZDR}}"
  unset KEY
  echo "Gespeichert. Die Transkription bleibt AUS (TRANSKRIPTION_AN) — erst den deutschen Vergleich (scripts/voxtral-vergleich.mjs) machen."
  ;;
tor)
  read -rp "Anbieter-Tor: aus (wie bisher, alles Anthropic direkt) | an (Gesundheit/Familie/Privat-Finanzen nur EU) | streng (zusätzlich AVV-Pflicht für Anthropic) [an]: " MODUS
  MODUS="$(printf '%s' "${MODUS:-an}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  [[ "$MODUS" =~ ^(aus|an|streng)$ ]] || { echo "Abbruch: aus, an oder streng."; exit 1; }
  if [[ "$MODUS" != "aus" ]]; then echo "Hinweis: Ohne Claude über Vertex EU (mit ZDR) sind KI-Aufrufe mit Gesundheitsdaten danach GESPERRT (nie Rückfall in die USA)."; fi
  schreibe_env "$TOR_MUSTER" "MAKE_OS_KI_ANBIETER_TOR=${MODUS}"
  ;;
budget)
  read -rp "Instanz-Budget je Kalendermonat in Euro (z. B. 50; leer = nur messen): " EURO
  EURO="$(printf '%s' "$EURO" | tr -d '[:space:]' | tr ',' '.')"
  read -rp "Grenze je Auftrag (Bild/Video/Tiefenbericht) in Euro [10]: " AUFTRAG
  AUFTRAG="$(printf '%s' "${AUFTRAG:-10}" | tr -d '[:space:]' | tr ',' '.')"
  [[ -z "$EURO" || "$EURO" =~ ^[0-9]{1,6}(\.[0-9]{1,2})?$ ]] || { echo "Abbruch: Betrag wie 50 oder 49.90."; exit 1; }
  [[ "$AUFTRAG" =~ ^[0-9]{1,6}(\.[0-9]{1,2})?$ ]] || { echo "Abbruch: Betrag wie 10 oder 7.50."; exit 1; }
  schreibe_env "$BUDGET_MUSTER" "${EURO:+MAKE_OS_KI_BUDGET_MONAT_EURO=${EURO}
}MAKE_OS_KI_GRENZE_AUFTRAG_EURO=${AUFTRAG}"
  echo "Hinweis: Eine Inhaber-Einstellung in MAKE OS (System › Datenschutz › KI) geht der Umgebung vor."
  ;;
*)
  echo "Aufruf: ki-anbieter-verbinden.sh anthropic | vertex | mistral | tor | budget   (oder --entfernen <dasselbe>)"; exit 1 ;;
esac
neu_starten
echo "Fertig. Prüfen: docker compose exec app node scripts/ki-anbieter-pruefen.mjs"
