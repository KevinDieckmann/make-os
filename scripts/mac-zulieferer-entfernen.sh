#!/usr/bin/env bash
# ─── MAKE OS · Mac-Zulieferer am Mac entfernen (08.10., Lücke 10 der Roadmap, Kevin R6) ─────────────────────────────────────
# Kevin 08.10.: „alles nur auf dem Server führen; wir brauchen nachher im Mac nur noch die API zur Mail.“ Erinnerungen sind als
# Aufgaben übernommen (Einstellungen › Verbindungen › Mac-Zulieferer), der Server antwortet dem Zulieferer mit 410 — jetzt geht der
# Hintergrunddienst vom Mac.
#
# Was das Skript tut (und NUR das):
#   1. den launchd-Dienst `de.makeos.zulieferer` entladen (falls geladen),
#   2. die Datei ~/Library/LaunchAgents/de.makeos.zulieferer.plist entfernen (falls vorhanden).
# Nichts anderes wird gelöscht: ~/.make-os/zulieferer.env, das Log, das Repo, andere Dienste (Vault-Abgleich, Sicherungs-Abholung)
# bleiben. Die Ausgabe nennt nur Namen — nie Werte aus Dateien.
#
#   bash scripts/mac-zulieferer-entfernen.sh               # Trockenlauf: zeigt nur, was passieren würde
#   bash scripts/mac-zulieferer-entfernen.sh --ausfuehren  # entlädt und entfernt
#
# Zurück: deploy/de.makeos.zulieferer.plist nach ~/Library/LaunchAgents/ kopieren und mit launchctl laden (Kopf der Datei) — und am
# Server den Zulieferer wieder einschalten (sonst antwortet er weiter mit 410).
# Nur für Tests: MAKE_OS_LAUNCHCTL, MAKE_OS_PGREP, MAKE_OS_UNAME ersetzen die Systembefehle.
set -euo pipefail

LABEL=de.makeos.zulieferer
AGENTEN="${HOME}/Library/LaunchAgents"
PLIST="${AGENTEN}/${LABEL}.plist"
LAUNCHCTL="${MAKE_OS_LAUNCHCTL:-launchctl}"
PGREP="${MAKE_OS_PGREP:-pgrep}"
SYSTEM="${MAKE_OS_UNAME:-$(uname)}"

AUSFUEHREN=0
case "${1:-}" in
  --ausfuehren) AUSFUEHREN=1 ;;
  ""|--trocken) ;;
  *) echo "Aufruf: bash scripts/mac-zulieferer-entfernen.sh [--ausfuehren]   (ohne Argument: Trockenlauf)"; exit 1 ;;
esac

if [[ "$SYSTEM" != "Darwin" ]]; then
  echo "Dieses Skript läuft nur am Mac."
  exit 1
fi

DOMAIN="gui/$(id -u)"
geladen=0
if "$LAUNCHCTL" print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then geladen=1; fi
datei=0
if [[ -f "$PLIST" ]]; then datei=1; fi

if [[ $AUSFUEHREN -eq 1 ]]; then echo "Mac-Zulieferer entfernen:"; else echo "Trockenlauf — es wird nichts geändert (mit --ausfuehren wirklich):"; fi

if [[ $geladen -eq 1 ]]; then
  if [[ $AUSFUEHREN -eq 1 ]]; then
    if "$LAUNCHCTL" bootout "${DOMAIN}/${LABEL}" >/dev/null 2>&1 || "$LAUNCHCTL" unload "$PLIST" >/dev/null 2>&1; then
      echo "  ✓ Dienst ${LABEL} entladen"
    else
      echo "  ✗ Dienst ${LABEL} ließ sich nicht entladen — bitte von Hand: launchctl bootout ${DOMAIN}/${LABEL}"
      exit 1
    fi
  else
    echo "  · würde den Dienst ${LABEL} entladen"
  fi
else
  echo "  · Dienst ${LABEL} ist nicht geladen"
fi

if [[ $datei -eq 1 ]]; then
  if [[ $AUSFUEHREN -eq 1 ]]; then
    rm -f -- "$PLIST"
    echo "  ✓ ~/Library/LaunchAgents/${LABEL}.plist entfernt"
  else
    echo "  · würde ~/Library/LaunchAgents/${LABEL}.plist entfernen"
  fi
else
  echo "  · keine ~/Library/LaunchAgents/${LABEL}.plist"
fi

# ── Nur Hinweise (nichts davon wird angefasst) ──
echo ""
echo "Bleibt, wie es ist:"
# Ein Zulieferer, der von Hand (nicht über launchd) gestartet wurde, läuft weiter, bis sein Fenster zu ist — nur zählen, nie beenden.
# (Solange der Dienst geladen ist, zählt sein eigener Prozess mit — dann erst nach dem Entladen nachsehen.)
if [[ $geladen -eq 0 || $AUSFUEHREN -eq 1 ]]; then
  if [[ $geladen -eq 1 ]]; then sleep 1; fi
  von_hand=$("$PGREP" -f 'node .*zulieferer\.mjs' 2>/dev/null | wc -l | tr -d ' ' || true)
  if [[ "${von_hand:-0}" != "0" ]]; then echo "  ! zulieferer.mjs läuft noch ${von_hand}× außerhalb von launchd — das Terminal-Fenster schließen"; fi
fi
ENV_DATEI="${HOME}/.make-os/zulieferer.env"
if [[ -f "$ENV_DATEI" ]]; then
  namen=""
  for n in MAKE_OS_SERVER_KEY MAKE_OS_ZULIEFERER_KEY MAKE_OS_SERVER; do
    if grep -q "^${n}=" "$ENV_DATEI" 2>/dev/null; then namen="${namen} ${n}"; fi
  done
  echo "  · ~/.make-os/zulieferer.env (enthält:${namen:- nichts Bekanntes}) — wird nicht mehr gebraucht; von Hand löschen, wenn du willst"
fi
if [[ -f "${HOME}/.make-os/zulieferer.log" ]]; then echo "  · ~/.make-os/zulieferer.log"; fi
for anderer in de.makeos.vault-abgleich de.makeos.sicherung; do
  if "$LAUNCHCTL" print "${DOMAIN}/${anderer}" >/dev/null 2>&1; then echo "  · Dienst ${anderer} (läuft weiter)"; fi
done
echo "  · der Mail-Zugang am Mac (Mail-App) — MAKE OS holt die Mail ohnehin auf dem Server (IMAP/Gmail)"
