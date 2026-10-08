#!/usr/bin/env bash
# ─── MAKE OS · Weiteren SSH-Schlüssel für den Admin-Nutzer `make` eintragen (09.10.2026, R9) ─────────────────────
# Kevin 08.10. (R9): „Malin wird gleichwertige zweite Inhaberin · Server-Zugang (SSH) auch für Malin.“ Jede weitere Inhaberin bzw.
# jeder weitere Inhaber bekommt einen EIGENEN Schlüssel (nie einen geteilten): fällt einer aus oder geht ein Gerät verloren, wird
# genau dieser Schlüssel entfernt, die anderen bleiben.
#
# 1. Die neue Person erzeugt am eigenen Rechner einen Schlüssel (privat bleibt dort, am besten mit Passphrase):
#       ssh-keygen -t ed25519 -C "<vorname>-make-os"
#    und gibt NUR den öffentlichen Teil weiter (Datei ~/.ssh/id_ed25519.pub — eine Zeile „ssh-ed25519 AAAA… <vorname>-make-os“).
# 2. Eine Person, die schon Zugang hat, trägt ihn ein (vom Mac aus, im Terminal):
#       ssh -t make@<SERVER> bash /srv/make-os/app/deploy/ssh-schluessel-hinzufuegen.sh
#    und fügt die Zeile ein, wenn gefragt — oder gibt sie als Argument mit:
#       ssh make@<SERVER> bash /srv/make-os/app/deploy/ssh-schluessel-hinzufuegen.sh "'ssh-ed25519 AAAA… <vorname>-make-os'"
# 3. Die neue Person prüft:  ssh make@<SERVER> 'sudo -n true && echo ok'   (make darf sudo — server-einrichten.sh)
#
# Weitere Aufrufe:
#   --liste                  zeigt die Fingerabdrücke der eingetragenen Admin-Schlüssel (nie die Schlüssel selbst)
#   --entfernen "<Schlüssel>" nimmt genau diesen Schlüssel wieder heraus (nie den letzten Admin-Schlüssel, nie den Ausroll-Schlüssel)
#
# Regeln: nur ein öffentlicher Schlüssel je Aufruf, ohne Optionen davor (kein command=…, kein from=…); kein Doppel (gleicher
# Schlüssel = schon eingetragen, die Datei bleibt, wie sie ist). Zeilen mit Optionen (der Ausroll-Schlüssel mit
# command="…/ausrollen.sh",restrict) bleiben unangetastet. Geschrieben wird atomar (neue Datei, dann umbenennen), Rechte 600.
# Im Repo stehen keine Schlüssel und keine Adressen. Der Pfad lässt sich für Tests über AUTHORIZED_KEYS umbiegen.
set -euo pipefail

DATEI="${AUTHORIZED_KEYS:-/home/make/.ssh/authorized_keys}"
TYPEN='ssh-ed25519|sk-ssh-ed25519@openssh\.com|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|sk-ecdsa-sha2-nistp256@openssh\.com|ssh-rsa'

fehler() { echo "Abbruch: $1" >&2; exit 1; }

# Typ + Schlüsselteil einer Zeile (ohne Optionen davor, ohne Kommentar dahinter) — leer bei Kommentar/Leerzeile.
kern() {
  local zeile="$1"
  [[ -z "${zeile// }" || "$zeile" =~ ^[[:space:]]*# ]] && return 0
  printf '%s\n' "$zeile" | grep -o -E "(${TYPEN}) [A-Za-z0-9+/]+={0,3}" | head -n 1 || true
}
# Hat die Zeile Optionen vor dem Typ (z. B. command=…,restrict)? Dann ist sie ein eingeschränkter Schlüssel, kein Admin-Schlüssel.
eingeschraenkt() { [[ ! "$1" =~ ^[[:space:]]*(${TYPEN})[[:space:]] ]]; }

fingerabdruck() { # $1 = Schlüsselzeile
  if command -v ssh-keygen >/dev/null 2>&1; then printf '%s\n' "$1" | ssh-keygen -l -f - 2>/dev/null | awk '{print $1, $2, $4}'; else echo "(ssh-keygen fehlt — Fingerabdruck nicht berechnet)"; fi
}

pruefe_schluessel() { # $1 = Eingabe → gibt die saubere Zeile aus oder bricht ab
  local s="$1"
  s="$(printf '%s' "$s" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ "$s" == *$'\n'* ]] && fehler "bitte genau EINE Zeile (einen Schlüssel) eingeben."
  [[ ${#s} -le 16384 ]] || fehler "die Zeile ist zu lang."
  [[ "$s" =~ ^(${TYPEN})\ [A-Za-z0-9+/]+={0,3}(\ [^[:cntrl:]]{0,200})?$ ]] || fehler "das ist kein öffentlicher SSH-Schlüssel (erwartet: „ssh-ed25519 AAAA… name“ — ohne Optionen davor, nie der private Schlüssel)."
  if command -v ssh-keygen >/dev/null 2>&1; then
    printf '%s\n' "$s" | ssh-keygen -l -f - >/dev/null 2>&1 || fehler "ssh-keygen erkennt den Schlüssel nicht — ist er vollständig kopiert?"
  fi
  [[ "$s" == ssh-rsa* ]] && echo "Hinweis: RSA-Schlüssel gehen, besser ist ssh-ed25519 (ssh-keygen -t ed25519)." >&2
  printf '%s' "$s"
}

datei_vorbereiten() {
  local ordner; ordner="$(dirname "$DATEI")"
  mkdir -p "$ordner" && chmod 700 "$ordner"
  [[ -f "$DATEI" ]] || { : > "$DATEI"; chmod 600 "$DATEI"; }
}

schreibe_atomar() { # stdin → $DATEI
  local tmp; tmp="$(mktemp "$(dirname "$DATEI")/.authorized_keys-neu.XXXXXX")"
  chmod 600 "$tmp"
  cat > "$tmp"
  if [[ -n "$(stat -c %U "$DATEI" 2>/dev/null || true)" ]]; then chown --reference="$DATEI" "$tmp" 2>/dev/null || true; fi
  mv "$tmp" "$DATEI"
}

admin_kerne() { # Kerne aller Admin-Schlüssel (ohne Optionen)
  [[ -f "$DATEI" ]] || return 0
  while IFS= read -r z || [[ -n "$z" ]]; do
    local k; k="$(kern "$z")"
    [[ -n "$k" ]] && ! eingeschraenkt "$z" && printf '%s\n' "$k"
  done < "$DATEI"
}

case "${1:-}" in
  --liste)
    [[ -f "$DATEI" ]] || { echo "Noch keine Schlüssel eingetragen."; exit 0; }
    n=0
    while IFS= read -r k; do [[ -n "$k" ]] && { fingerabdruck "$k"; n=$((n + 1)); }; done < <(admin_kerne)
    echo "$n Admin-Schlüssel (eingeschränkte Schlüssel wie der Ausroll-Schlüssel sind nicht mitgezählt)."
    exit 0 ;;
  --entfernen)
    [[ -n "${2:-}" ]] || fehler "welcher Schlüssel? --entfernen \"ssh-ed25519 AAAA…\""
    ziel="$(kern "$(pruefe_schluessel "$2")")"
    [[ -f "$DATEI" ]] || fehler "es gibt noch keine $DATEI."
    gefunden=0; uebrig=0
    while IFS= read -r z || [[ -n "$z" ]]; do
      k="$(kern "$z")"
      if [[ -n "$k" && "$k" == "$ziel" ]]; then
        eingeschraenkt "$z" && fehler "das ist ein eingeschränkter Schlüssel (z. B. der Ausroll-Schlüssel) — den nimmt dieses Skript nie heraus."
        gefunden=1
      elif [[ -n "$k" ]] && ! eingeschraenkt "$z"; then uebrig=$((uebrig + 1)); fi
    done < "$DATEI"
    [[ $gefunden -eq 1 ]] || { echo "Dieser Schlüssel ist nicht eingetragen — nichts geändert."; exit 0; }
    [[ $uebrig -ge 1 ]] || fehler "das ist der letzte Admin-Schlüssel — danach käme niemand mehr auf den Server. Erst einen anderen eintragen."
    while IFS= read -r z || [[ -n "$z" ]]; do [[ "$(kern "$z")" == "$ziel" ]] || printf '%s\n' "$z"; done < "$DATEI" | schreibe_atomar
    echo "Entfernt: $(fingerabdruck "$ziel")"
    exit 0 ;;
  --hilfe|-h)
    sed -n '2,24p' "$0"; exit 0 ;;
esac

eingabe="${1:-}"
if [[ -z "$eingabe" ]]; then
  read -rp "Öffentlichen Schlüssel einfügen (eine Zeile „ssh-ed25519 AAAA… name“), dann Enter: " eingabe
fi
schluessel="$(pruefe_schluessel "$eingabe")"
neu="$(kern "$schluessel")"
datei_vorbereiten
# Kein Doppel: derselbe Schlüssel (Typ + Schlüsselteil, Kommentar egal) steht schon da → nichts ändern. Steht er als eingeschränkter
# Eintrag da (z. B. Ausroll-Schlüssel), wird er nicht zusätzlich zum Admin-Schlüssel.
while IFS= read -r z || [[ -n "$z" ]]; do
  [[ "$(kern "$z")" == "$neu" ]] || continue
  eingeschraenkt "$z" && fehler "dieser Schlüssel steht schon als eingeschränkter Schlüssel in der Datei (z. B. Ausroll-Schlüssel) — für den Admin-Zugang bitte einen eigenen erzeugen."
  echo "Schon eingetragen — nichts geändert: $(fingerabdruck "$schluessel")"
  exit 0
done < "$DATEI"
{ cat "$DATEI"; [[ -s "$DATEI" && -n "$(tail -c 1 "$DATEI")" ]] && echo; printf '%s\n' "$schluessel"; } | schreibe_atomar
echo "Eingetragen: $(fingerabdruck "$schluessel")"
echo "Die neue Person prüft jetzt:  ssh make@<SERVER> 'sudo -n true && echo ok'"
