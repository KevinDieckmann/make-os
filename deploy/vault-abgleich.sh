#!/usr/bin/env bash
# ─── MAKE OS · Obsidian-Hirn abgleichen (Mac UND Server, alle 5–10 Minuten) ───
# Kevins Entscheidung 24.09.: Vault als privates Git-Repo. Beide Seiten
# schreiben (Kevin in Obsidian, ZOE ins Log) — deshalb: eigene Änderungen
# festhalten, fremde mit rebase holen, dann schieben. Bei einem echten
# Konflikt bricht es ab und meldet ihn, statt etwas zu überschreiben.
# Aufruf:  bash vault-abgleich.sh <pfad-zum-vault>
#
# 29.09. (Paket D-B #97): Der Zustand steht als Markerdatei in .git (wird nie eingecheckt) — so sieht der Head of IT
# (deploy/lage-sammeln.sh) einen Konflikt auch NACH dem Rebase-Abbruch, und „letzter erfolgreicher Push“ statt
# „letzter Commit“ (lokal wird weiter committet, auch wenn der Push seit Tagen scheitert):
#   .git/make-os-konflikt       Rebase abgebrochen (Zeitpunkt) — bleibt, bis ein Abgleich wieder durchläuft
#   .git/make-os-push-fehler    Push gescheitert (Zeitpunkt)
#   .git/make-os-letzter-push   Zeitpunkt des letzten erfolgreichen Push (Dateizeit zählt)
# Auf dem Mac (launchd, deploy/de.makeos.vault-abgleich.plist) zusätzlich eine Mitteilung bei Konflikt/Push-Fehler.
set -uo pipefail
VAULT="${1:?Pfad zum Vault fehlt}"
cd "$VAULT" || exit 1
[ -d .git ] || { echo "Kein Git-Repo: $VAULT"; exit 1; }
# Sperre über mkdir — flock gibt es auf dem Mac nicht. Älter als 30 Min. = verwaist.
SPERRE=.git/abgleich.sperre
find "$SPERRE" -maxdepth 0 -mmin +30 -exec rmdir {} \; 2>/dev/null
mkdir "$SPERRE" 2>/dev/null || exit 0   # läuft schon
trap 'rmdir "$SPERRE"' EXIT
jetzt() { date '+%F %T'; }
melden() {  # Mitteilung am Mac (auf dem Server gibt es osascript nicht — dort meldet der HOI)
  [ "${MAKE_OS_VAULT_MITTEILUNG:-an}" = "aus" ] && return 0   # Tests: keine Mitteilung
  if [ "$(uname)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$1\" with title \"MAKE Vault\"" >/dev/null 2>&1 || true
  fi
}
git add -A
git diff --cached --quiet || git commit -qm "Abgleich $(hostname -s) $(date '+%F %H:%M')"
if ! git pull -q --rebase --autostash; then
  git rebase --abort 2>/dev/null
  jetzt > .git/make-os-konflikt
  echo "$(jetzt) KONFLIKT im Vault — bitte von Hand lösen (git status in $VAULT)"
  melden "Konflikt im Vault — bitte von Hand lösen (git status)"
  exit 1
fi
rm -f .git/make-os-konflikt
if git push -q; then
  rm -f .git/make-os-push-fehler
  jetzt > .git/make-os-letzter-push
else
  jetzt > .git/make-os-push-fehler
  echo "$(jetzt) Push fehlgeschlagen — nächster Versuch beim nächsten Lauf"
  melden "Vault: Push fehlgeschlagen — nächster Versuch gleich"
fi
# Dead-Man-Meldung (27.09.): optionale Ping-Adresse neben dem Vault (…/.healthchecks-vault) — nur auf dem Server sinnvoll.
HC="$(dirname "$VAULT")/.healthchecks-vault"; [ -s "$HC" ] && curl -fsS -m 10 --retry 3 -o /dev/null "$(cat "$HC")" || true
