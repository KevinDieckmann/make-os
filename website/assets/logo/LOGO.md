# MAKE-Logo (Landingpage v3, Stand 01.10.2026)

Erzeugt von `scripts/website-logo.mjs` — **nicht von Hand ändern**, sondern dort und neu erzeugen:
`node scripts/website-logo.mjs` (schreibt alle Dateien hier, `website/favicon.svg` und `website/logo-entwuerfe.html`).
Diese Datei wird nie ausgeliefert (Caddy `@intern`, `hide LOGO.md`).

## Idee (Kevin 01.10.: „nicht lange rumdoktern“)
- **Bildmarke:** das M aus v2 (Entwurf A „Fuge“): zwei Züge — **MA** (Malin, Rot) links und **KE** (Kevin, Grün)
  rechts — treffen sich in der Fuge, die Naht liegt genau auf der Mittelachse. **In der Mitte ein Punkt, geteilt:
  linke Hälfte Grün, rechte Hälfte Rot** — über Kreuz zu den Zügen: jeder trägt ein Stück vom anderen.
- **Wortmarke:** **MAKE**, darunter **ein roter und ein grüner Punkt** nebeneinander (linksbündig), darunter
  **INNOVATION** im Blocksatz auf Breite von MAKE.

Alles ist Linie bzw. Fläche, keine Schrift: das Logo sieht überall gleich aus und lädt nichts nach.

## Konstruktion
| Teil | Raster |
|---|---|
| Bildmarke | Feld 240 × 240, Modul 24 = Strichstärke. Stämme x 48 / 192, oben y 64, unten y 184. Diagonalen exakt 45° bis zur Fuge (120 / 136). Runde Enden und Ecken. Sichtbare Fläche 168 × 144. |
| Naht | Jeder Zug ist auf seine Hälfte beschnitten (`clipPath` bei x 120): unten ein Halbkreis je Farbe, innen eine scharfe Kerbe bei y 119. |
| Punkt | Mitte (120 / 92), Radius 12 (Durchmesser = Strichstärke). Frei im V: Abstand zu den Diagonalen und zur Kerbe je ≈ 15 — in 16 px noch ein eigener Punkt. Gebaut als grüner Kreis + rote rechte Hälfte darüber (keine Haarlinie in der Mitte). |
| Wortmarke MAKE | Versalhöhe 72, Strich **12** (halbe Bildmarke). M wie die Bildmarke (45°, 60 %). Außenkanten-Abstände M–A 16, A–K 18, K–E 16. |
| Punkte | Radius 6 (Durchmesser = Strich der Wortmarke), Lücke 8, linksbündig mit dem M-Stamm, Mitte 21 unter der Grundlinie. Rot links, Grün rechts. |
| INNOVATION | Versalhöhe 30, Strich 6 (Grundmaß 20/4 × 1,5), Blocksatz auf 332 (= Breite MAKE). |
| Block | MAKE 0–72 · Punkte 87–99 · INNOVATION 114–144 → genau so hoch wie die Bildmarke (144). |

**Optische Korrekturen:** E-Mittelstrich leicht über der Mitte und kürzer · A-Querstrich auf 7/10 · O mit 0,5 Überhang.

## Farben
| Rolle | auf dunklem Grund | auf hellem Grund |
|---|---|---|
| Rot (MA, rechte Punkthälfte, linker Wortmarken-Punkt) | `#D13A55` | `#B12E46` |
| Grün (KE, linke Punkthälfte, rechter Wortmarken-Punkt) | `#22B577` | `#1A8F5E` |
| MAKE | `#E8ECEA` | `#0B0E10` |
| INNOVATION | `#A2ADB0` | `#4F5A5D` |
| Kachel-Grund | `#0B0E10` | — |

Rot und Grün gehören den Personen — nie für Zustände oder Knöpfe (die sind Türkis `#58D9CD`).

## Dateien
| Datei | Einsatz |
|---|---|
| `bildmarke.svg` / `bildmarke-hell.svg` | Bildmarke allein |
| `wortmarke.svg` / `wortmarke-hell.svg` | Wortmarke allein (MAKE · Punkte · INNOVATION) |
| `kachel.svg` (= `website/favicon.svg`) | App-Kachel und Favicon (dunkles, abgerundetes Quadrat, Schutzzone eingebaut) |
| `favicon-32.png`, `apple-touch-icon.png` (180, ohne Rundung — iOS rundet selbst), `icon-512.png` | Raster-Fassungen der Kachel |
| `quer.svg` / `quer-hell.svg` | Kopf und Fuß: Bildmarke + Wortmarke (540 × 144) |
| `kompakt.svg` / `kompakt-hell.svg` | Kopf am Handy (≤ 560 px): ohne INNOVATION |
| `gross.svg` / `gross-hell.svg` | Titel, Druck: Bildmarke mittig über der Wortmarke |

Die Bühne der Startseite trägt die Bildmarke **inline** (Einzeichnen-Animation: beide Züge zeichnen sich von den
Stämmen zur Fuge, danach erscheint der Punkt; bei `prefers-reduced-motion` steht alles sofort). Den Block liefert
`node scripts/website-logo.mjs --buehne`; `website/pruefen.mjs` prüft, dass seine Formen mit `bildmarke.svg` übereinstimmen.

## Schutzzone und Mindestgröße
- **Schutzzone:** rundum eine Strichstärke der Bildmarke (bei „quer“ in 40 px Höhe ≈ 7 px). Nichts ragt hinein.
- **Mindestgröße:** Bildmarke 16 px (Favicon), „kompakt“ 24 px hoch, „quer“ 36 px hoch (darunter wird INNOVATION
  unleserlich → „kompakt“ nehmen), „groß“ 120 px breit.
- Nicht verzerren, nicht umfärben (außer hell/dunkel), keine Schatten oder Konturen; MA links und KE rechts nie
  tauschen, die Punkthälften nie tauschen (links Grün, rechts Rot).

## Übersicht
`website/logo-entwuerfe.html` (lokal öffnen, wird nie ausgeliefert) zeigt alle Fassungen dunkel und hell. Die
früheren Entwürfe B „Funke“ und C „Kante“ sind entfallen (Stand v2 im Git-Verlauf, Commit ca28282).
