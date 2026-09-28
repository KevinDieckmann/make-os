#!/usr/bin/env bash
# ─── MAKE OS · Sicherung an den Mac ausgeben (Forced Command, nur lesend — 29.09., Paket D-A #57/#58/#64) ─
# Kevin: „Auf euren Mac ziehen.“ Der Mac holt jede Nacht das neueste verschlüsselte Archiv ab (Pull). Der
# Server kann den Mac nicht erreichen und nichts dort löschen; der Mac-Schlüssel kann auf dem Server NUR
# dieses Skript ausführen — keine Shell, kein Weiterleiten, kein Schreiben außer der Abhol-Marke.
#
# Einrichten (einmalig, als make auf dem Server) — eine Zeile in /home/make/.ssh/authorized_keys:
#   command="/srv/make-os/app/deploy/sicherung-ausgeben.sh",restrict ssh-ed25519 AAAA… make-os-abholung
# (den öffentlichen Schlüssel erzeugt deploy/sicherung-abholen.sh --einrichten am Mac).
#
# Befehle (SSH_ORIGINAL_COMMAND):
#   liste                         → „<name> <bytes> <sha256>“ des neuesten Archivs
#   holen <name>                  → das Archiv als Datenstrom (nur make-os-JJJJ-MM-TT.tar.gz.age|enc)
#   bestaetigen <name> <sha256>   → der Mac hat es vollständig: Marke daten/system/abholung.json
#                                   (Zeit, Datei, Größe — für den Head of IT „letzte Abholung“)
set -euo pipefail
BASIS=${MAKE_OS_BASIS:-/srv/make-os}
ORDNER="$BASIS/sicherungen"
MARKE="$BASIS/daten/system/abholung.json"
NAME_OK='^make-os-[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.(age|enc)$'

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
groesse() { wc -c <"$1" | tr -d ' '; }

read -r BEFEHL ARG1 ARG2 REST <<<"${SSH_ORIGINAL_COMMAND:-}"
[ -z "${REST:-}" ] || { echo "zu viele Angaben" >&2; exit 2; }
case "${BEFEHL:-}" in
  liste)
    N=$(ls -1 "$ORDNER" 2>/dev/null | grep -E "$NAME_OK" | sort | tail -1)
    [ -n "$N" ] || { echo "keine Sicherung vorhanden" >&2; exit 1; }
    echo "$N $(groesse "$ORDNER/$N") $(sha "$ORDNER/$N")" ;;
  holen)
    [[ "${ARG1:-}" =~ $NAME_OK ]] && [ -f "$ORDNER/$ARG1" ] || { echo "unbekanntes Archiv" >&2; exit 2; }
    cat -- "$ORDNER/$ARG1" ;;
  bestaetigen)
    [[ "${ARG1:-}" =~ $NAME_OK ]] && [ -f "$ORDNER/$ARG1" ] || { echo "unbekanntes Archiv" >&2; exit 2; }
    [[ "${ARG2:-}" =~ ^[0-9a-f]{64}$ ]] || { echo "Prüfsumme fehlt" >&2; exit 2; }
    [ "$(sha "$ORDNER/$ARG1")" = "$ARG2" ] || { echo "Prüfsumme passt nicht — nicht bestätigt" >&2; exit 3; }
    mkdir -p "$(dirname "$MARKE")"
    printf '{"zeit":"%s","datei":"%s","bytes":%s,"bestaetigt":true}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARG1" "$(groesse "$ORDNER/$ARG1")" >"$MARKE.tmp"
    chmod 640 "$MARKE.tmp" && mv "$MARKE.tmp" "$MARKE"
    echo "bestätigt" ;;
  *) echo "Befehle: liste | holen <name> | bestaetigen <name> <sha256>" >&2; exit 2 ;;
esac
