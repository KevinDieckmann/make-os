#!/usr/bin/env bash
# ─── MAKE OS · Das Hirn (Obsidian-Vault) als privates Git-Repo hochladen ────
# Einmalig auf Kevins Mac. Danach gleicht der Server das Repo alle 10 Minuten
# ab (deploy/vault-abgleich.sh), und Obsidian (Git-Plugin) auf den Macs ebenso.
# Aufruf:  bash ~/Claude/Projects/MakeOS/deploy/vault-hochladen.sh [vault-ordner] [repo]
# Standard: ~/Vaults/MAKE/Make.Claude (seit 29.09., VAULT_UMZUG_ANLEITUNG.md), sonst ~/Desktop/MAKE/Make.Claude
#   →  git@github.com:KevinDieckmann/make-vault.git
# Was nicht hochgeht, steht in deploy/vault.gitignore (Arbeitsbereich von
# Obsidian, Papierkorb, iCloud-Platzhalter).
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"
STANDARD="$HOME/Vaults/MAKE/Make.Claude"; [ -d "$STANDARD" ] || STANDARD="$HOME/Desktop/MAKE/Make.Claude"
VAULT="${1:-$STANDARD}"
# Ziel-Repo je Instanz (30.10., neutral — vorher fest im Skript): zweites Argument oder MAKE_VAULT_REPO.
REPO="${2:-${MAKE_VAULT_REPO:-}}"
[ -n "$REPO" ] || { echo "Kein Ziel-Repo: zweites Argument oder MAKE_VAULT_REPO setzen (z. B. git@github.com:<konto>/<vault>.git)."; exit 1; }
[ -d "$VAULT" ] || { echo "Vault nicht gefunden: $VAULT"; exit 1; }
cd "$VAULT"

[ -f .gitignore ] || cp "$HIER/vault.gitignore" .gitignore
[ -d .git ] || git init -q -b main
git add -A
git diff --cached --quiet || git commit -q -m "Hirn: Stand vom $(date +%d.%m.%Y)"
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$REPO" || git remote add origin "$REPO"
git push -u origin main

echo ""
echo "  Hirn hochgeladen: $(git ls-files | wc -l | tr -d ' ') Dateien → $REPO"
