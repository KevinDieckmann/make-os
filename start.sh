#!/bin/bash
# ─── MAKE OS starten ────────────────────────────────────────────────────────
# Richtet beim allerersten Start alles selbst ein und öffnet danach nur noch.
# Läuft auf Kevins Rechner (Node liegt dort in /tmp) genauso wie auf Malins.

set -u
cd "$(dirname "$0")" || exit 1

# Node suchen — in dieser Reihenfolge:
#   1. normal installiert (PATH) — der Zielzustand
#   2. ~/.local/node22 — von uns abgelegt, überlebt Neustarts (04.08.)
#   3. /tmp — der alte Ort; macOS räumt ihn weg, nur noch Notnagel
# Hintergrund: der /tmp-Stand wurde zweimal von der System-Bereinigung
# gelöscht und die Software war „kaputt", obwohl nur Node fehlte.
for N in "$HOME/.local/node22/bin" "/tmp/node-v22.16.0-darwin-arm64/bin"; do
  [ -x "$N/node" ] && export PATH="$N:$PATH" && break
done

echo ""
echo "  MAKE OS"
echo "  ───────"
echo ""

# ── 1 · Node vorhanden? ─────────────────────────────────────────────────────
# Geprüft wird NODE, nicht npm: auf Kevins Rechner liegt Node in /tmp, und die
# Systembereinigung löscht dort einzelne Dateien — zuletzt npm-cli.js. Node
# selbst reicht aber, um die Software zu starten.
if ! command -v node >/dev/null 2>&1; then
  echo "  Node fehlt noch."
  echo "  Hol es dir von https://nodejs.org (die große grüne LTS-Schaltfläche),"
  echo "  installiere es, schließe dieses Fenster und starte hier neu."
  echo ""
  read -r -p "  [Enter] zum Schließen " _ || true
  exit 1
fi

# npm braucht es nur für den allerersten Start (Bausteine holen).
NPM_DA=0
command -v npm >/dev/null 2>&1 && npm -v >/dev/null 2>&1 && NPM_DA=1

# ── 2 · Bausteine ───────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  if [ "$NPM_DA" -eq 0 ]; then
    echo "  Die Bausteine fehlen und npm ist nicht da."
    echo "  Node von https://nodejs.org neu installieren, dann noch einmal starten."
    echo ""
    read -r -p "  [Enter] zum Schließen " _ || true
    exit 1
  fi
  echo "  Erster Start: ich hole einmalig die Bausteine."
  echo "  Das dauert zwei bis drei Minuten und braucht Internet."
  echo ""
  npm install || { echo ""; echo "  Das hat nicht geklappt. Zeig Kevin diese Meldung."; read -r -p "  [Enter] " _ || true; exit 1; }
  echo ""
fi

# ── 3 · Zugangsdaten ────────────────────────────────────────────────────────
# Entscheidend ist nicht, OB die Datei existiert, sondern ob ein brauchbarer
# Schlüssel drinsteht. Eine leere Zeile MAKE_OS_KEY= (etwa aus einer Vorlage)
# würde die Middleware sonst jede Seite sperren lassen — mit einer Maske, die
# durch keine Eingabe zu öffnen ist. Deshalb hier prüfen und notfalls heilen.
[ -f .env.local ] && SCHLUESSEL=$(grep '^MAKE_OS_KEY=' .env.local | head -1 | cut -d= -f2- | tr -d ' "'"'"'') || SCHLUESSEL=""

if [ -z "$SCHLUESSEL" ]; then
  NEU=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)

  if [ ! -f .env.local ]; then
    echo "  Ich lege deine Zugangsdaten an."
    echo ""
    echo "  Damit Jarvis (die KI) mitdenkt, braucht es einen Anthropic-Schlüssel."
    echo "  Den gibt dir Kevin. Ohne ihn läuft alles andere trotzdem."
    echo ""
    read -r -p "  Anthropic-Schlüssel (oder einfach [Enter] zum Überspringen): " AKEY || AKEY=""
    {
      echo "# Von start.sh angelegt. Diese Datei gehört nie in eine Cloud oder einen Chat."
      echo "MAKE_OS_KEY=$NEU"
      echo "ANTHROPIC_API_KEY=${AKEY:-}"
    } > .env.local
    echo ""
    [ -z "${AKEY:-}" ] && echo "  Ohne KI-Schlüssel gestartet. Nachtragen: Datei .env.local öffnen." && echo ""
  else
    # Datei da, aber ohne brauchbaren Schlüssel — Zeile ersetzen statt anhängen,
    # sonst gewinnt beim Einlesen weiterhin die leere erste Zeile.
    echo "  In .env.local stand kein Zugangsschlüssel. Ich habe einen erzeugt."
    echo ""
    grep -v '^MAKE_OS_KEY=' .env.local > .env.local.neu 2>/dev/null || : > .env.local.neu
    echo "MAKE_OS_KEY=$NEU" >> .env.local.neu
    mv .env.local.neu .env.local
  fi

  chmod 600 .env.local
  SCHLUESSEL="$NEU"
fi

# ── 4 · Datenstand ──────────────────────────────────────────────────────────
# Ohne diesen Schritt schaut man in ein leeres System. Der Startbestand liegt
# im Ordner darüber und wird genau einmal übernommen.
if [ ! -d .data ] && [ -d ../startbestand ]; then
  echo "  Ich übernehme den Datenstand von Kevin (einmalig)."
  cp -R ../startbestand .data
  DATEIEN=$(find .data -maxdepth 1 -name '*.json' | wc -l | tr -d ' ')
  echo "  $DATEIEN Dateien übernommen — Aufgaben, Finanzen, Kontakte, alles."
  echo ""
fi

# ── 5 · Los ─────────────────────────────────────────────────────────────────
# Der Empfang zuerst: Jarvis begrüßt, danach geht es zur Startfläche.
ADRESSE="http://localhost:3001/anmelden"
echo "  Alles bereit. Ich öffne gleich den Browser."
echo ""
echo "  Anmelden mit deinem Konto. Beim allerersten Mal: Erstes Konto einrichten —"
echo "  dafür braucht es einmal den Schlüssel aus .env.local (MAKE_OS_KEY)."
echo ""
echo "  Falls sich nichts öffnet, diese Adresse einfügen:"
echo "  $ADRESSE"
echo ""
echo "  Zum Beenden: dieses Fenster schließen oder Strg+C."
echo "  ───────"
echo ""

# Browser öffnen, sobald der Server antwortet.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null -m 2 "http://localhost:3001/jarvis"; then
      open "$ADRESSE" 2>/dev/null
      break
    fi
    sleep 1
  done
) &

# Next direkt über node starten, wenn npm fehlt — „npm run dev" ist nur ein
# Umweg zu genau diesem Aufruf, und der Umweg ist der Teil, der kaputtgeht.
# ── Der Arbeiter ────────────────────────────────────────────────────────────
# Erledigt Jarvis' Aufträge im Hintergrund — auch wenn kein Fenster offen ist.
# Er wartet, bis die App steht, und beendet sich von selbst, wenn sie weg ist.
mkdir -p .data
# caffeinate hält den Rechner wach, solange der Arbeiter läuft — ohne -d, der
# Bildschirm darf also schlafen. Nichts wird dauerhaft umgestellt: endet der
# Arbeiter, endet auch caffeinate, und der Mac schläft wie vorher.
if command -v caffeinate >/dev/null 2>&1; then
  ( sleep 10; caffeinate -i -s node worker.mjs ) >> .data/worker.log 2>&1 &
else
  ( sleep 10; node worker.mjs ) >> .data/worker.log 2>&1 &
fi

# ── Der Bote ────────────────────────────────────────────────────────────────
# Holt Telegram-Nachrichten ab und bringt Jarvis' Antworten aufs Handy. Läuft
# nur, wenn ein Bot-Token in .env.local steht — sonst bleibt er einfach aus.
if grep -q '^TELEGRAM_BOT_TOKEN=..*' .env.local 2>/dev/null; then
  ( sleep 12; node bote.mjs ) >> .data/bote.log 2>&1 &
fi

if [ "$NPM_DA" -eq 1 ]; then
  exec npm run dev -- -p 3001
else
  exec node node_modules/next/dist/bin/next dev -p 3001
fi
