#!/usr/bin/env bash
# ─── MAKE OS · Probe-Restore einer Sicherung (am Mac, quartalsweise — 28.09., K1 #109/#110) ───
# Eine Sicherung, die nie zurückgeholt wurde, ist keine. Dieses Skript holt ein Tagesarchiv
# vollständig zurück — aber nur in einen Temp-Ordner, der am Ende gelöscht wird — und zählt:
#   1. Archiv mit age entschlüsseln (privater age-Schlüssel aus dem Passwort-Manager)
#   2. tar in einen Temp-Ordner entpacken
#   3. jeden Bestand (daten/*.json) mit dem Datenschlüssel entschlüsseln
#      (MAKE_OS_DATEN_SCHLUESSEL aus der Umgebung — wird nie ausgegeben)
#   4. Anzahl Bestände und Datensätze je Bestand ausgeben — NUR Zahlen, nie Inhalte
#   5. Temp-Ordner löschen (auch bei Abbruch)
#
# Aufruf (Archiv vorher vom Server holen, z. B. scp make@…:/srv/make-os/sicherungen/make-os-JJJJ-MM-TT.tar.gz.age .):
#   read -rs MAKE_OS_DATEN_SCHLUESSEL && export MAKE_OS_DATEN_SCHLUESSEL
#   deploy/sicherung-probe.sh make-os-JJJJ-MM-TT.tar.gz.age ~/pfad/age-schluessel.txt
# Ältere .enc-Archive (openssl, vor dem 26.09.): statt des age-Schlüssels die Passwort-Datei angeben.
# Archive von vor einer Schlüsselrotation brauchen den ALTEN Datenschlüssel (deploy/datenschluessel-rotieren.sh).
# Ergebnis eintragen: DEPLOY.md › Probe-Restore (Datum, Archiv, Anzahl Bestände, Auffälligkeiten).
set -euo pipefail

ARCHIV="${1:-}"
SCHLUESSEL_DATEI="${2:-}"
[ -n "$ARCHIV" ] && [ -f "$ARCHIV" ] || { echo "Aufruf: $0 <archiv.tar.gz.age|.enc> <age-schluessel.txt|passwort-datei>"; exit 1; }
[ -n "$SCHLUESSEL_DATEI" ] && [ -f "$SCHLUESSEL_DATEI" ] || { echo "age-Schlüssel bzw. Passwort-Datei fehlt (2. Argument)."; exit 1; }
[ -n "${MAKE_OS_DATEN_SCHLUESSEL:-}" ] || { echo "MAKE_OS_DATEN_SCHLUESSEL fehlt in der Umgebung (read -rs … && export …)."; exit 1; }
export PATH="$HOME/.local/node22/bin:$PATH"
command -v node >/dev/null || { echo "node fehlt (~/.local/node22/bin)."; exit 1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/make-os-probe.XXXXXX")"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT INT TERM

echo "▸ entschlüsseln und entpacken (Temp-Ordner, wird am Ende gelöscht)"
case "$ARCHIV" in
  *.age)
    command -v age >/dev/null || { echo "age fehlt (brew install age)."; exit 1; }
    age -d -i "$SCHLUESSEL_DATEI" "$ARCHIV" | tar xzf - -C "$TMP" ;;
  *.enc)
    openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$SCHLUESSEL_DATEI" -in "$ARCHIV" | tar xzf - -C "$TMP" ;;
  *) echo "Unbekanntes Archiv (erwartet .tar.gz.age oder .tar.gz.enc)."; exit 1 ;;
esac
[ -d "$TMP/daten" ] || { echo "Im Archiv fehlt der Ordner daten/ — Archiv unvollständig?"; exit 1; }

echo "▸ Bestände entschlüsseln und zählen (nur Zahlen)"
MAKE_OS_PROBE_ORDNER="$TMP/daten" node --input-type=module <<'JS'
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createDecipheriv, createHash } from 'node:crypto';
const ordner = process.env.MAKE_OS_PROBE_ORDNER;
const key = createHash('sha256').update(`make-os-daten:${(process.env.MAKE_OS_DATEN_SCHLUESSEL ?? '').trim()}`).digest();
const ent = o => { const d = createDecipheriv('aes-256-gcm', key, Buffer.from(o.iv, 'base64')); d.setAuthTag(Buffer.from(o.tag, 'base64')); return Buffer.concat([d.update(Buffer.from(o.daten, 'base64')), d.final()]).toString('utf8'); };
/** Datensätze: Liste → Länge; Objekt → Summe seiner Listen (sonst 1). */
const zaehle = x => Array.isArray(x) ? x.length : (x && typeof x === 'object' ? (Object.values(x).filter(Array.isArray).reduce((s, l) => s + l.length, 0) || 1) : 1);
const zeilen = []; let klar = 0, verschluesselt = 0, kaputt = 0, summe = 0;
for (const n of (await fs.readdir(ordner)).filter(n => n.endsWith('.json')).sort()) {
  try {
    let o = JSON.parse(await fs.readFile(path.join(ordner, n), 'utf8'));
    if (o && o.__verschluesselt === 1) { o = JSON.parse(ent(o)); verschluesselt++; } else klar++;
    const z = zaehle(o); summe += z;
    zeilen.push(`  ${n.replace(/\.json$/, '').padEnd(48)} ${String(z).padStart(7)}`);
  } catch { kaputt++; zeilen.push(`  ${n.replace(/\.json$/, '').padEnd(48)}  FEHLER (Schlüssel passt nicht oder Datei defekt)`); }
}
// Dateiablage (dateien/<haushalt>/<id>.bin, Hülle MKOSDAT1): nur zählen und die Entschlüsselung prüfen.
let ablage = 0, ablageFehler = 0;
const MAGIE = Buffer.from('MKOSDAT1', 'ascii');
for (const h of await fs.readdir(path.join(ordner, 'dateien')).catch(() => [])) {
  for (const n of await fs.readdir(path.join(ordner, 'dateien', h)).catch(() => [])) {
    if (!n.endsWith('.bin')) continue;
    ablage++;
    const b = await fs.readFile(path.join(ordner, 'dateien', h, n));
    if (!b.subarray(0, 8).equals(MAGIE)) continue;
    try { const d = createDecipheriv('aes-256-gcm', key, b.subarray(8, 20)); d.setAuthTag(b.subarray(20, 36)); d.update(b.subarray(36)); d.final(); } catch { ablageFehler++; }
  }
}
console.log(zeilen.join('\n'));
console.log(`\n  Bestände: ${zeilen.length} (verschlüsselt ${verschluesselt}, Klartext ${klar}, Fehler ${kaputt}) · Datensätze gesamt: ${summe}`);
console.log(`  Dateiablage: ${ablage} Dateien, ${ablageFehler} nicht entschlüsselbar`);
if (kaputt || ablageFehler) { console.log('\n  ✗ Probe NICHT bestanden — falscher Schlüssel (Archiv von vor einer Rotation?) oder defekte Dateien.'); process.exit(2); }
console.log('\n  ✓ Probe bestanden — alles lesbar.');
JS
echo "▸ Temp-Ordner wird gelöscht."
