# MAKE-Logo (Landingpage, Stand 01.10.2026)

Erzeugt von `scripts/website-logo.mjs` — **nicht von Hand ändern**, sondern dort und neu erzeugen:
`node scripts/website-logo.mjs` (schreibt alle Dateien hier, `website/favicon.svg` und `website/logo-entwuerfe.html`).
Diese Datei wird nie ausgeliefert (Caddy `@intern`, `hide LOGO.md`).

## Idee
Das M aus der Software (Logo F), sauber konstruiert: zwei Züge — **MA** (Malin, Rot) und **KE** (Kevin, Grün) —
laufen von ihren Stämmen nach innen und treffen sich in der **Fuge**. Die Naht liegt genau auf der Mittelachse.
Daneben die Wortmarke **MAKE** mit zwei Personenstrichen (Rot unter MA, Grün unter KE) und der Zusatz **INNOVATION**.
Alles ist Linie, keine Schrift: das Logo sieht überall gleich aus und lädt nichts nach.

## Konstruktion
| Teil | Raster |
|---|---|
| Bildmarke | Feld 240 × 240, Modul 24 = Strichstärke. Stämme x 48 / 192, oben y 64, unten y 184. Diagonalen exakt 45° bis zur Fuge (120 / 136) — V-Tiefe 60 % der Stammhöhe. Runde Enden und Ecken (Radius = halbe Strichstärke). Sichtbare Fläche 168 × 144. |
| Naht | Jeder Zug ist auf seine Hälfte beschnitten (`clipPath` bei x 120): unten ein Halbkreis je Farbe, innen eine scharfe Kerbe bei y 119. |
| Wortmarke | Versalhöhe 72, Strich **12** (halbe Bildmarke). M wie die Bildmarke (45°, 60 %). Außenkanten-Abstände M–A 16, A–K 18, K–E 16. Personenstriche 4 hoch, 12 unter der Grundlinie, Lücke wie zwischen A und K. |
| Zusatz | INNOVATION, Versalhöhe 20, Strich **4** (ein Sechstel der Bildmarke). In „groß“ im Blocksatz auf Breite der Wortmarke, in „quer“ auf derselben Grundlinie wie MAKE (Faktor 1,5). |

**Optische Korrekturen:** Bildmarke 4 Einheiten unter der geometrischen Mitte (das M ist oben schwerer) · E-Mittelstrich
leicht über der Mitte und kürzer als die Außenstriche · A-Querstrich auf 7/10 · O im Zusatz mit 0,5 Überhang ·
Strichstärken stehen 6 : 3 : 1 (Bildmarke : Wortmarke : Zusatz).

## Farben
| Rolle | auf dunklem Grund | auf hellem Grund |
|---|---|---|
| MA (Malin) | `#D13A55` | `#B12E46` |
| KE (Kevin) | `#22B577` | `#1A8F5E` |
| Wortmarke | `#E8ECEA` | `#0B0E10` |
| Zusatz | `#A2ADB0` | `#4F5A5D` |
| Kachel-Grund | `#0B0E10` | — |

Rot und Grün gehören den Personen — nie für Zustände oder Knöpfe (die sind Türkis `#58D9CD`).

## Dateien
| Datei | Einsatz |
|---|---|
| `bildmarke.svg` / `bildmarke-hell.svg` | Bildmarke allein (dunkler / heller Grund) |
| `kachel.svg` (= `website/favicon.svg`) | App-Kachel und Favicon (dunkles, abgerundetes Quadrat, Schutzzone eingebaut) |
| `favicon-32.png`, `apple-touch-icon.png` (180, ohne Rundung — iOS rundet selbst), `icon-512.png` | Raster-Fassungen der Kachel |
| `quer.svg` / `quer-hell.svg` | Kopf und Fuß: Bildmarke · MAKE · INNOVATION |
| `kompakt.svg` / `kompakt-hell.svg` | Kopf am Handy (≤ 560 px): ohne INNOVATION |
| `gross.svg` / `gross-hell.svg` | Titel, Bühne, Druck: Bildmarke über Wortmarke |

Die Bühne der Startseite trägt die Bildmarke **inline** (für die Zeichen-Animation: beide Züge zeichnen sich von den
Stämmen zur Fuge, dort ein kurzer türkiser Funke; bei `prefers-reduced-motion` steht sie sofort). Den Block liefert
`node scripts/website-logo.mjs --buehne`; `website/pruefen.mjs` prüft, dass seine Pfade mit `bildmarke.svg` übereinstimmen.

## Schutzzone und Mindestgröße
- **Schutzzone:** rundum eine Strichstärke der Bildmarke (bei „quer“ in 32 px Höhe ≈ 5 px, bei „groß“ ≈ 1/7 der Markenbreite). Nichts ragt hinein.
- **Mindestgröße:** Bildmarke 16 px (Favicon), „kompakt“ 20 px hoch, „quer“ 28 px hoch (darunter wird INNOVATION unleserlich → „kompakt“ nehmen), „groß“ 120 px breit.
- Nicht verzerren, nicht umfärben (außer hell/dunkel), keine Schatten oder Konturen, MA links und KE rechts nie tauschen.

## Entwürfe
`website/logo-entwuerfe.html` (lokal öffnen, wird nie ausgeliefert): **A „Fuge“** (im Einsatz), **B „Funke“** (Spalt in der Fuge,
türkiser Punkt darunter), **C „Kante“** (gerade Enden, gefaste Ecken, bündig beschnitten). Wechsel: in `schreiben()` von
`scripts/website-logo.mjs` den Buchstaben ändern, neu erzeugen, Bühnen-Block übernehmen.
