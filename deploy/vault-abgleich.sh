#!/usr/bin/env bash
# ─── MAKE OS · Obsidian-Hirn abgleichen (Mac UND Server, alle 10 Minuten) ───
# Kevins Entscheidung 24.09.: Vault als privates Git-Repo. Beide Seiten
# schreiben (Kevin in Obsidian, Jarvis ins Log) — deshalb: eigene Änderungen
# festhalten, fremde mit rebase holen, dann schieben. Bei einem echten
# Konflikt bricht es ab und meldet ihn, statt etwas zu überschreiben.
# Aufruf:  bash vault-abgleich.sh <pfad-zum-vault>
set -uo pipefail
VAULT="${1:?Pfad zum Vault fehlt}"
cd "$VAULT" || exit 1
[ -d .git ] || { echo "Kein Git-Repo: $VAULT"; exit 1; }
# Sperre über mkdir — flock gibt es auf dem Mac nicht. Älter als 30 Min. = verwaist.
SPERRE=.git/abgleich.sperre
find "$SPERRE" -maxdepth 0 -mmin +30 -exec rmdir {} \; 2>/dev/null
mkdir "$SPERRE" 2>/dev/null || exit 0   # läuft schon
trap 'rmdir "$SPERRE"' EXIT
git add -A
git diff --cached --quiet || git commit -qm "Abgleich $(hostname -s) $(date '+%F %H:%M')"
if ! git pull -q --rebase --autostash; then
  git rebase --abort 2>/dev/null
  echo "$(date '+%F %T') KONFLIKT im Vault — bitte von Hand lösen (git status in $VAULT)"
  exit 1
fi
git push -q || echo "$(date '+%F %T') Push fehlgeschlagen — nächster Versuch in 10 Minuten"
