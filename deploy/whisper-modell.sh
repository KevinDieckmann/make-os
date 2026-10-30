#!/usr/bin/env bash
# ─── MAKE OS · Sprachmodell für Untertitel laden (auf dem Server, 28.10.2026, Malin-Paket) ───────────────────────────────────────────
# Einmal ausführen — vom Mac aus, im Terminal:
#   ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/whisper-modell.sh            (Vorgabe: small, ≈ 466 MB, Deutsch gut)
#   ssh -t make@<SERVER> sudo bash /srv/make-os/app/deploy/whisper-modell.sh base       (kleiner/schneller, schlechter)
# Lädt das whisper.cpp-Modell (MIT-Lizenz) von Hugging Face (Repository ggerganov/whisper.cpp) nach /srv/make-os/modelle/whisper/ — im
# Container /modelle/whisper/ggml-<name>.bin (MAKE_OS_MODELLE_DIR). Die Prüfsumme (SHA-256) kommt aus der Dateiliste des Repositorys und
# wird vor dem Ablegen verglichen; stimmt sie nicht, wird nichts abgelegt. Nicht „small“? Dann in der .env setzen:
#   MAKE_OS_WHISPER_MODELL=/modelle/whisper/ggml-<name>.bin
# Die Spracherkennung läuft danach NUR auf dem Server (Reel-Werkstatt › „Untertitel erkennen“) — es geht kein Ton an einen Dienst.
# Größere Modelle brauchen mehr Arbeitsspeicher (small ≈ 1 GB im Lauf): erst den Server vergrößern (UPDATES.md 28.10.).
set -euo pipefail
NAME="${1:-small}"
case "$NAME" in tiny|base|small|medium) ;; *) echo "Modell: tiny, base, small oder medium."; exit 1;; esac
ZIEL_DIR=/srv/make-os/modelle/whisper
DATEI="ggml-$NAME.bin"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$DATEI"
LISTE="https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/main"
command -v curl >/dev/null || { echo "curl fehlt."; exit 1; }
command -v python3 >/dev/null || { echo "python3 fehlt (für die Prüfsumme)."; exit 1; }

ERWARTET="$(curl -fsSL "$LISTE" | python3 -c "
import json,sys
for e in json.load(sys.stdin):
    if e.get('path')=='$DATEI' and isinstance(e.get('lfs'),dict): print(e['lfs'].get('oid','')); break
")"
[[ "$ERWARTET" =~ ^[0-9a-f]{64}$ ]] || { echo "Abbruch: keine Prüfsumme für $DATEI in der Dateiliste gefunden."; exit 1; }

mkdir -p "$ZIEL_DIR"
TMP="$(mktemp "$ZIEL_DIR/.laden.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
echo "Lade $DATEI … (das dauert je nach Leitung ein paar Minuten)"
curl -fL --retry 3 --progress-bar -o "$TMP" "$URL"
IST="$(sha256sum "$TMP" | cut -d' ' -f1)"
if [[ "$IST" != "$ERWARTET" ]]; then echo "Abbruch: Prüfsumme stimmt nicht (erwartet $ERWARTET, bekommen $IST) — nichts abgelegt."; exit 1; fi
chmod 644 "$TMP"
mv "$TMP" "$ZIEL_DIR/$DATEI"
trap - EXIT
chown -R make:make /srv/make-os/modelle 2>/dev/null || true
echo "Fertig: $ZIEL_DIR/$DATEI (SHA-256 $IST)."
[[ "$NAME" != "small" ]] && echo "Nicht vergessen: MAKE_OS_WHISPER_MODELL=/modelle/whisper/$DATEI in /srv/make-os/app/.env, dann: docker compose up -d app"
exit 0
