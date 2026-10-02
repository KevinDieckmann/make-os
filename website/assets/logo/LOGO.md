# MAKE-Logo (Landingpage v4, Stand 02.10.2026)

Erzeugt von `scripts/website-logo.mjs` — **nicht von Hand ändern**, sondern dort und neu erzeugen:
`node scripts/website-logo.mjs` (schreibt alle Dateien hier, `website/favicon.svg` und `website/logo-entwuerfe.html`).
Diese Datei wird nie ausgeliefert (Caddy `@intern`, `hide LOGO.md`).

> **Vorläufig — das Logo wird später überarbeitet** (Kevin 02.10.: „Wir haben noch kein gutes Logo, da müssen wir
> später nochmal ran“). Bis dahin zeigt die Seite nur die Wortmarke. Favicon und App-Kachel behalten vorläufig die
> M-Bildmarke aus v3 (zu klein für eine Wortmarke).

## Idee (Kevin 02.10.)
**MAKE**, darunter zwei **Personenstriche** — **Rot unter MA** (Malin), **Grün unter KE** (Kevin), mit kleiner Lücke
zwischen A und K —, darunter **INNOVATION** im Blocksatz auf Breite von MAKE. Die zwei Punkte aus v3 entfallen.
Alles ist Linie bzw. Fläche, keine Schrift: das Logo sieht überall gleich aus und lädt nichts nach.

## Konstruktion
| Teil | Raster |
|---|---|
| MAKE | Versalhöhe 72, Strich **12**, runde Enden und Ecken. M mit 45°-V (Tiefe 60 %). Außenkanten-Abstände M–A 16, A–K 18, K–E 16. Breite 332. |
| Personenstriche | 4 hoch, abgerundet, **12 unter der Grundlinie** (y 84–88). Rot x 0–176 (unter MA), Grün x 194–332 (unter KE); die Lücke von 18 liegt zwischen A und K. |
| INNOVATION | Versalhöhe 30, Strich 6 (Grundmaß 20/4 × 1,5), Blocksatz auf 332 (= Breite MAKE), y 100–130 (Lücke 12 unter den Strichen). |
| Block | 332 × 130 (kompakt ohne INNOVATION: 332 × 88). |
| Bildmarke (vorläufig) | Feld 240 × 240, Modul 24. Zwei Züge (MA rot links, KE grün rechts) treffen sich in der Fuge, in der Mitte ein geteilter Punkt (links grün, rechts rot). Nur noch Favicon und Kachel. |

**Optische Korrekturen:** E-Mittelstrich leicht über der Mitte und kürzer · A-Querstrich auf 7/10 · O mit 0,5 Überhang.

## Farben
| Rolle | auf dunklem Grund | auf hellem Grund |
|---|---|---|
| Rot (Strich unter MA; Bildmarke: MA-Zug) | `#D13A55` | `#B12E46` |
| Grün (Strich unter KE; Bildmarke: KE-Zug, linke Punkthälfte) | `#22B577` | `#1A8F5E` |
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

## Dateien
| Datei | Einsatz |
|---|---|
| `wortmarke.svg` / `wortmarke-hell.svg` | Wortmarke allein (MAKE · Striche · INNOVATION), 332 × 130 |
| `quer.svg` / `quer-hell.svg` | Kopf und Fuß (gleiche Form wie die Wortmarke; Kopf 46 px hoch, Fuß 64 px) |
| `kompakt.svg` / `kompakt-hell.svg` | Kopf am Handy (≤ 560 px): ohne INNOVATION, 332 × 88 |
| `gross.svg` / `gross-hell.svg` | Titel, Druck, Bühne: Wortmarke mit Schutzzone (rundum 40) |
| `visitenkarte-make.svg` / `visitenkarte-make-hell.svg` | **Logo zum Hochladen in ein Visitenkarten-Profil**: Wortmarke mit eigenem Grund (dunkel `#0B0E10` bzw. weiß) und Rand 48, 428 × 226, ca. 1,2 KB, reines SVG ohne Skript, Stil oder externe Verweise |
| `bildmarke.svg` / `bildmarke-hell.svg` | Bildmarke allein — **vorläufig**, nur noch Grundlage der Kachel |
| `kachel.svg` (= `website/favicon.svg`) | App-Kachel und Favicon — **vorläufig** (M-Bildmarke auf dunklem, abgerundetem Quadrat) |
| `favicon-32.png`, `apple-touch-icon.png` (180, ohne Rundung — iOS rundet selbst), `icon-512.png` | Raster-Fassungen der Kachel — vorläufig |

Die Bühne der Startseite trägt die Wortmarke **inline**: die zwei Striche zeichnen sich nacheinander ein (Rot, dann
Grün), bei `prefers-reduced-motion` steht alles sofort. Den Block liefert `node scripts/website-logo.mjs --buehne`;
`website/pruefen.mjs` prüft, dass seine Formen mit `wortmarke.svg` übereinstimmen.

## Schutzzone und Mindestgröße
- **Schutzzone:** rundum 40 (Einheiten der Wortmarke, ≈ halbe Versalhöhe von MAKE). Nichts ragt hinein.
- **Mindestgröße:** „quer“ 40 px hoch (darunter wird INNOVATION unleserlich → „kompakt“ nehmen, mind. 24 px hoch), Bildmarke/Kachel 16 px.
- Nicht verzerren, nicht umfärben (außer hell/dunkel), keine Schatten oder Konturen; Rot (MA) steht links, Grün (KE) rechts — nie tauschen.

## Übersicht
`website/logo-entwuerfe.html` (lokal öffnen, wird nie ausgeliefert) zeigt alle Fassungen dunkel und hell. Die
früheren Stände (v2 mit Personenstrichen und Bildmarke, v3 mit zwei Punkten) liegen im Git-Verlauf (Commits ca28282, 6b83f48).
