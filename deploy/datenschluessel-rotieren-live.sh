#!/usr/bin/env bash
# ─── MAKE OS · Datenschlüssel rotieren OHNE Unterbrechung (als make auf dem Server — 29.09., Paket D-A #52) ─
# Neben deploy/datenschluessel-rotieren.sh (Notweg mit Anhalten, bleibt unverändert). Dieser Weg:
#   · App und Arbeiter laufen weiter; nie Klartext auf der Platte;
#   · alter + neuer Schlüssel sind gleichzeitig lesbar (Schlüsselring), die App stellt Bestand für Bestand
#     in dessen Schreibsperre auf den neuen um (POST /api/intern/umschluesseln, Dienstweg im Container);
#   · der alte Schlüssel verschwindet erst vom Server, wenn ALLES umgestellt ist (fehler = 0).
# Voraussetzung (einmalig, NOTFALL.md › „Schlüssel als Datei“): der Schlüssel liegt als Datei
#   /srv/make-os/schluessel/daten (0400, Besitzer make) und NICHT mehr als MAKE_OS_DATEN_SCHLUESSEL in der .env
#   (die Umgebung ginge der Datei vor); compose.yml bindet /srv/make-os/schluessel nur lesend ein.
# Der neue Schlüssel wird nie ausgegeben — danach in der EIGENEN Terminal-App auslesen und in beide
# Passwort-Manager + Papier (NOTFALL.md):   sudo cat /srv/make-os/schluessel/daten
# Den ALTEN Schlüssel im Passwort-Manager behalten („… ALT — rotiert am …“): Sicherungen von vor heute
# (Server 14/8/12 Generationen, Mac, Hetzner-Abbilder) brauchen ihn.
set -euo pipefail
BASIS=${MAKE_OS_BASIS:-/srv/make-os}
APP="$BASIS/app"
DIR="$BASIS/schluessel"
cd "$APP"

[ -s "$DIR/daten" ] || { echo "Kein Schlüssel als Datei ($DIR/daten) — erst umstellen (NOTFALL.md). Sonst: deploy/datenschluessel-rotieren.sh"; exit 1; }
if grep -q '^MAKE_OS_DATEN_SCHLUESSEL=.' .env 2>/dev/null; then echo "In der .env steht noch MAKE_OS_DATEN_SCHLUESSEL — die Umgebung ginge der Datei vor. Erst entfernen (NOTFALL.md)."; exit 1; fi
WEITER=0; [ "${1:-}" = "--weiter" ] && WEITER=1
if [ "$WEITER" = 0 ]; then [ ! -e "$DIR/daten-alt" ] || { echo "$DIR/daten-alt liegt schon — lief eine Rotation nicht zu Ende? Dann: $0 --weiter"; exit 1; }
else [ -s "$DIR/daten-alt" ] || { echo "--weiter: kein daten-alt — nichts fortzusetzen."; exit 1; }; fi

rufe() {
  docker compose exec -T app node -e "fetch('http://localhost:3000/api/intern/umschluesseln',{method:'POST',headers:{'content-type':'application/json','x-make-key':process.env.MAKE_OS_KEY},body:JSON.stringify($1)}).then(r=>r.json()).then(j=>{const{fehler,...rest}=j;console.log(JSON.stringify(rest));if(fehler&&fehler.length)console.log('Fehler:',fehler.length);process.exit(j.ok?0:1)}).catch(e=>{console.error(String(e));process.exit(1)})" </dev/null
}

umask 077
if [ "$WEITER" = 0 ]; then
  echo "▸ alter Schlüssel → daten-alt (nur lesen), neuer Schlüssel → daten (wird nicht angezeigt)"
  install -m 400 "$DIR/daten" "$DIR/daten-alt"
  openssl rand -hex 32 > "$DIR/daten.neu" && chmod 400 "$DIR/daten.neu" && mv -f "$DIR/daten.neu" "$DIR/daten"
fi

echo "▸ App stellt Bestand für Bestand um (läuft weiter)"
if ! rufe '{}'; then
  echo "✗ Nicht alles umgestellt. daten-alt BLEIBT (sonst wären Reste unlesbar). Fehler ansehen:"
  echo "  docker compose logs app --since 10m | tail -50 — dann erneut:  $0 --weiter"
  exit 1
fi

echo "▸ alles umgestellt — alten Schlüssel vom Server nehmen"
rm -f "$DIR/daten-alt"
rufe '{"nurLaden":true}' || true
cat <<HINWEIS

════════════════════════════════════════════════════════════════════════════
  Fertig. Jetzt (in der EIGENEN Terminal-App, nie über Claude oder einen Chat):
    sudo cat $DIR/daten      → neuer Schlüssel in beide Passwort-Manager + Papier
  Den ALTEN Eintrag im Passwort-Manager umbenennen („… ALT — rotiert am $(date +%F)“),
  NICHT löschen: ältere Sicherungen (auch am Mac) brauchen ihn.
════════════════════════════════════════════════════════════════════════════
HINWEIS
