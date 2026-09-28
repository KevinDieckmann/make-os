#!/usr/bin/env bash
# ─── MAKE OS · Generationen der Sicherungen (29.09., Paket D-A #64) ───────────
# Wird von deploy/sicherung.sh (Server) und deploy/sicherung-abholen.sh (Mac) eingebunden:
#   source deploy/generationen.sh; generationen_aufraeumen <ordner> [täglich=14] [wöchentlich=8] [monatlich=12]
# Behalten wird (Großvater-Vater-Sohn, eine Datei je Generation, keine Kopien):
#   · die neuesten 14 Tagesarchive,
#   · je Kalenderwoche (Montag–Sonntag) das neueste Archiv der letzten 8 Wochen, in denen es eins gibt,
#   · je Monat das neueste Archiv der letzten 12 Monate, in denen es eins gibt.
# Alles andere mit dem Namen make-os-JJJJ-MM-TT.tar.gz.(age|enc) wird gelöscht. Reines Bash + awk
# (macOS und Linux gleich, kein GNU-date nötig). Schleichende Korruption, die erst nach Wochen auffällt,
# lässt sich so noch aus einer Monatsgeneration heilen.

generationen_weg() {
  # stdin: Dateinamen; stdout: die zu löschenden
  grep -E '^make-os-[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.(age|enc)$' | sort -r | awk -v T="${1:-14}" -v W="${2:-8}" -v M="${3:-12}" '
    function tage(y, m, d,   era, yoe, doy, doe) {
      y -= (m <= 2); era = int((y >= 0 ? y : y - 399) / 400); yoe = y - era * 400
      doy = int((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
      doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
      return era * 146097 + doe - 719468
    }
    {
      y = substr($0, 9, 4) + 0; m = substr($0, 14, 2) + 0; d = substr($0, 17, 2) + 0
      woche = int((tage(y, m, d) + 3) / 7); monat = y * 12 + m
      behalten = (NR <= T)
      if (!(woche in wochen)) { wochen[woche] = 1; nw++; if (nw <= W) behalten = 1 }
      if (!(monat in monate)) { monate[monat] = 1; nm++; if (nm <= M) behalten = 1 }
      if (!behalten) print $0
    }'
}

generationen_aufraeumen() {
  local ordner="$1" f
  [ -d "$ordner" ] || return 0
  ls -1 "$ordner" | generationen_weg "${2:-14}" "${3:-8}" "${4:-12}" | while IFS= read -r f; do
    [ -n "$f" ] && rm -f -- "$ordner/$f"
  done
}
