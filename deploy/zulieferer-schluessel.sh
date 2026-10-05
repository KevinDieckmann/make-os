#!/usr/bin/env bash
# ─── MAKE OS · Eigener Schlüssel für den Mac-Zulieferer (05.10.) ─────────────
# Bis 05.10. schickte der Mac den Dienstschlüssel des Servers (MAKE_OS_KEY) über das Internet — wer ihn abfing,
# kam an jede Route. Jetzt bekommt der Zulieferer einen EIGENEN Schlüssel, der am Server NUR die Zulieferung öffnet.
# Der Schlüssel erscheint nirgends: nicht auf dem Bildschirm, nicht in der Prozessliste, nicht im Chat, nicht im Repo.
#
# Drei Schritte (Reihenfolge egal — der Zulieferer probiert erst den neuen, dann den alten Schlüssel):
#   1. Am Mac:      bash deploy/zulieferer-schluessel.sh mac
#                   → erzeugt den Schlüssel, schreibt ihn in ~/.make-os/zulieferer.env (600), legt ihn für 90 Sekunden
#                     in die Zwischenablage (für Passwort-Manager und Server) und startet den Zulieferer neu.
#   2. Am Server:   ssh -t make@<server> bash /srv/make-os/app/deploy/zulieferer-schluessel.sh server
#                   → fragt den Schlüssel verdeckt ab (Einfügen), schreibt ihn in /srv/make-os/app/.env, startet die App neu.
#                     Ab jetzt nimmt der Server MAKE_OS_KEY von außen nicht mehr an — auch nicht für die Zulieferung.
#   3. Am Mac:      bash deploy/zulieferer-schluessel.sh aufraeumen
#                   → entfernt MAKE_OS_SERVER_KEY (den Generalschlüssel des Servers) vom Mac.
# Zurück: am Server die Zeile MAKE_OS_ZULIEFERER_KEY aus der .env nehmen + `docker compose up -d app` (dann gilt wieder
# der Übergang); am Mac MAKE_OS_SERVER_KEY wieder eintragen, falls schon aufgeräumt.
set -euo pipefail

MAC_ENV="${HOME}/.make-os/zulieferer.env"
SERVER_ENV=/srv/make-os/app/.env

zulieferer_neu_starten() {
  if launchctl print "gui/$(id -u)/de.makeos.zulieferer" >/dev/null 2>&1; then
    launchctl kickstart -k "gui/$(id -u)/de.makeos.zulieferer" && echo "Zulieferer neu gestartet (Log: ~/.make-os/zulieferer.log)."
  else
    echo "Zulieferer läuft nicht als Dienst — beim nächsten Start gilt der neue Schlüssel."
  fi
}

# Eine Zeile NAME=… in einer env-Datei setzen oder entfernen, ohne den Wert auf die Kommandozeile zu bringen
# (der Wert kommt über die Umgebung WERT, nicht als Argument). $1 Datei, $2 Name, WERT leer = entfernen.
zeile_setzen() {
  local datei="$1" name="$2" tmp
  tmp="$(mktemp "$(dirname "$datei")/.env-neu.XXXXXX")"
  chmod 600 "$tmp"
  { grep -v -E "^${name}=" "$datei" 2>/dev/null || true; } > "$tmp"
  if [[ -n "${WERT:-}" ]]; then printf '%s=%s\n' "$name" "$WERT" >> "$tmp"; fi
  if [[ -f "$datei" ]]; then chown --reference="$datei" "$tmp" 2>/dev/null || true; fi
  mv "$tmp" "$datei"
}

case "${1:-}" in
  mac)
    [[ "$(uname)" == "Darwin" ]] || { echo "„mac“ läuft nur am Mac."; exit 1; }
    install -d -m 700 "${HOME}/.make-os"
    touch "$MAC_ENV" && chmod 600 "$MAC_ENV"
    if grep -q '^MAKE_OS_ZULIEFERER_KEY=.\{32,\}' "$MAC_ENV" && [[ "${2:-}" != "--neu" ]]; then
      echo "Am Mac ist schon ein Zulieferer-Schlüssel eingetragen — er wird wiederverwendet (neu erzeugen: … mac --neu)."
      WERT="$(grep '^MAKE_OS_ZULIEFERER_KEY=' "$MAC_ENV" | head -1 | cut -d= -f2-)"
    else
      WERT="$(openssl rand -hex 32)"
      WERT="$WERT" zeile_setzen "$MAC_ENV" MAKE_OS_ZULIEFERER_KEY
      echo "Neuer Zulieferer-Schlüssel steht in ~/.make-os/zulieferer.env (nur für dich lesbar)."
    fi
    printf '%s' "$WERT" | pbcopy
    unset WERT
    ( sleep 90; pbcopy </dev/null ) >/dev/null 2>&1 &
    echo "Er liegt jetzt 90 Sekunden in der Zwischenablage:"
    echo "  1) in den Passwort-Manager (Eintrag „MAKE OS · Zulieferer-Schlüssel“),"
    echo "  2) am Server einfügen:  ssh -t make@<server> bash /srv/make-os/app/deploy/zulieferer-schluessel.sh server"
    zulieferer_neu_starten
    ;;
  server)
    [[ -f "$SERVER_ENV" ]] || { echo "Keine $SERVER_ENV gefunden — ist das der MAKE-OS-Server?"; exit 1; }
    for _ in 1 2 3; do
      read -rs -p "Zulieferer-Schlüssel einfügen (verdeckt): " WERT; echo
      WERT="$(printf '%s' "$WERT" | tr -d '[:space:]')"
      if [[ ${#WERT} -ge 32 && "$WERT" =~ ^[A-Za-z0-9_-]+$ ]]; then break; fi
      echo "Das sieht nicht nach dem Schlüssel aus (mindestens 32 Zeichen, nur Buchstaben/Ziffern) — noch einmal."
      WERT=""
    done
    [[ -n "$WERT" ]] || { echo "Abgebrochen — nichts geändert."; exit 1; }
    WERT="$WERT" zeile_setzen "$SERVER_ENV" MAKE_OS_ZULIEFERER_KEY
    unset WERT
    echo "Eingetragen (letzte vier Zeichen zur Kontrolle: $(grep '^MAKE_OS_ZULIEFERER_KEY=' "$SERVER_ENV" | tail -c 5))."
    cd /srv/make-os/app
    echo "Starte die App neu (etwa eine halbe Minute) …"
    docker compose up -d app >/dev/null
    echo "Fertig. Im Head of IT steht „Zulieferer“ jetzt auf grün (eigener Schlüssel)."
    echo "Danach am Mac:  bash deploy/zulieferer-schluessel.sh aufraeumen"
    ;;
  aufraeumen)
    [[ -f "$MAC_ENV" ]] || { echo "Keine ~/.make-os/zulieferer.env — nichts zu tun."; exit 0; }
    grep -q '^MAKE_OS_ZULIEFERER_KEY=.\{32,\}' "$MAC_ENV" || { echo "Erst „mac“ ausführen — ohne Zulieferer-Schlüssel bliebe der Mac stumm."; exit 1; }
    WERT="" zeile_setzen "$MAC_ENV" MAKE_OS_SERVER_KEY
    echo "MAKE_OS_SERVER_KEY ist vom Mac entfernt — der Mac kennt den Generalschlüssel des Servers nicht mehr."
    zulieferer_neu_starten
    ;;
  *)
    echo "Aufruf: bash deploy/zulieferer-schluessel.sh mac [--neu] | server | aufraeumen   (Anleitung oben im Skript)"
    exit 1
    ;;
esac
