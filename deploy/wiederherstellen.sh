#!/usr/bin/env bash
# ─── MAKE OS · Sicherung auf dem Server zurückspielen — MIT Grabsteinen (29.09., Paket D-B #70) ───
# Holt ein Nachtarchiv (deploy/sicherung.sh) zurück nach /srv/make-os/daten und wendet danach ZWINGEND die Grabsteine
# gelöschter Personen an (lib/datenschutz/grabsteine.ts): wer nach dem Stand des Archivs gelöscht wurde (Art. 17), wird
# sofort erneut aus allen Speichern entfernt und steht wieder auf der Sperrliste. Scheitert das, bricht das Skript laut ab
# und der Arbeiter (Takt, Versand an Dritte) bleibt aus.
#
#   1. Archiv entschlüsseln (age-Schlüssel oder — alte .enc — Passwort-Datei) in einen Temp-Ordner
#   2. App + Arbeiter anhalten, aktuellen Datenordner beiseitelegen (daten.vor-restore-<zeit>, NICHT gelöscht)
#   3. Zurückgespielten Datenordner einsetzen — den Grabstein-Ordner NIE überschreiben (nur anlegen, wenn er fehlt:
#      Totalverlust des Servers)
#   4. App starten, auf „gesund“ warten, Grabsteine anwenden (POST /api/crm/datenschutz { aktion: 'grabsteine' },
#      Dienstschlüssel aus dem Container), erst dann den Arbeiter starten
#
# Aufruf (als make, im App-Ordner):  bash deploy/wiederherstellen.sh /srv/make-os/sicherungen/make-os-JJJJ-MM-TT.tar.gz.age ~/age-schluessel.txt
# Nie ohne Kevins Wort — und vorher DEPLOY.md › Probe-Restore lesen.
set -euo pipefail
ARCHIV="${1:-}"; SCHLUESSEL="${2:-}"
BASIS=${MAKE_OS_BASIS:-/srv/make-os}
APP="$BASIS/app"
[ -f "$ARCHIV" ] && [ -f "$SCHLUESSEL" ] || { echo "Aufruf: $0 <archiv.tar.gz.age|.enc> <age-schluessel|passwort-datei>"; exit 1; }
ZEIT=$(date +%Y%m%d-%H%M%S)
TMP="$BASIS/wiederherstellen.$ZEIT"
mkdir -m 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

echo "1/4 entschlüsseln und entpacken …"
case "$ARCHIV" in
  *.age) age -d -i "$SCHLUESSEL" "$ARCHIV" | tar xzf - -C "$TMP" ;;
  *.enc) openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$SCHLUESSEL" -in "$ARCHIV" | tar xzf - -C "$TMP" ;;
  *) echo "Unbekanntes Archiv (erwartet .age oder .enc)."; exit 1 ;;
esac
[ -d "$TMP/daten" ] || { echo "Im Archiv fehlt der Ordner daten — abgebrochen, nichts geändert."; exit 1; }

echo "2/4 App und Arbeiter anhalten, aktuellen Stand beiseitelegen …"
cd "$APP"
docker compose stop arbeiter app
[ -d "$BASIS/daten" ] && mv "$BASIS/daten" "$BASIS/daten.vor-restore-$ZEIT"
mv "$TMP/daten" "$BASIS/daten"
# Grabsteine: der AKTUELLE Ordner gewinnt immer (er kennt die jüngsten Löschungen). Nur bei Totalverlust aus dem Archiv.
if [ ! -d "$BASIS/grabsteine" ] && [ -d "$TMP/grabsteine" ]; then mv "$TMP/grabsteine" "$BASIS/grabsteine"; echo "   Grabstein-Ordner fehlte — aus dem Archiv übernommen."; fi

echo "3/4 App starten …"
docker compose up -d app
for i in $(seq 1 40); do
  [ "$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null)" = "healthy" ] && break
  sleep 3
done

echo "4/4 Grabsteine anwenden (zwingend) …"
if ! docker compose exec -T app node -e "fetch('http://localhost:3000/api/crm/datenschutz',{method:'POST',headers:{'content-type':'application/json','x-make-key':process.env.MAKE_OS_KEY||''},body:JSON.stringify({aktion:'grabsteine'})}).then(async r=>{const t=await r.text();console.log('   '+t);process.exit(r.ok&&JSON.parse(t).ok?0:1)}).catch(e=>{console.error(e.message);process.exit(1)})"; then
  echo "ABGEBROCHEN: Grabsteine NICHT angewendet — gelöschte Personen können wieder im Bestand sein."
  echo "Die App läuft, der Arbeiter bleibt AUS (kein Takt, kein Versand). Fehler beheben und diesen Schritt wiederholen."
  exit 1
fi
docker compose up -d arbeiter
echo "Fertig. Vorheriger Stand liegt in $BASIS/daten.vor-restore-$ZEIT (nach Prüfung von Hand löschen)."
