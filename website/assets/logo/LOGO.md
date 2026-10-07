# MAKE-Logo (v5 „Synapse“, Stand 03.10.2026)

Erzeugt von `scripts/website-logo.mjs` — **nicht von Hand ändern**, sondern dort und neu erzeugen:
`node scripts/website-logo.mjs` (schreibt alle Dateien hier, `website/favicon.svg` und `website/logo-entwuerfe.html`).
Diese Datei wird nie ausgeliefert (Caddy `@intern`, `hide LOGO.md`).

## Auftrag (Kevin 03.10.)
„Das Logo einfach bearbeiten und ein bisschen aufmotzen — das sieht noch nicht nach Innovation und Seriosität aus.“
Dieselbe Idee wie v4: **MAKE**, **Rot unter MA** (Malin), **Grün unter KE** (Kevin), darunter **INNOVATION**.
Drei Entwürfe in `website/logo-entwuerfe.html`:

| Entwurf | Idee |
|---|---|
| A „Präzision“ | Haarlinien genau unter MA und KE |
| **B „Synapse“ (gewählt)** | Rot läuft von links, Grün von rechts auf einen **Knoten in der Fuge zwischen A und K** zu, mit schmalem Spalt wie an einer Synapse; der Knoten ist links rot, rechts grün. Hier verbinden sich die beiden — und auf der Seite wachsen aus genau diesem Knoten die Neuronen. |
| C „Intarsie“ | keine Striche: A-Querstrich rot, E-Mittelstrich grün |

## Was gegenüber v4 anders ist
- **Buchstaben als Flächen** statt Linien mit runden Enden: Stämme, Diagonalen mit waagerechtem Anschnitt an Versalhöhe
  und Grundlinie, Diagonalen optisch 92 % der Stammstärke, Spitzen (A-Scheitel, M-Kerbe, V) enden in einer schmalen Fläche.
  Eine eigene, ruhige Grotesk — präzise und seriös statt verspielt.
- M mit Kerbe bis zur Grundlinie, K mit vom Arm abzweigendem Bein, E-Mittelstrich leicht über der Mitte und kürzer,
  A-Querstrich auf 64 %.
- **INNOVATION** aus derselben Konstruktion, klein (Versalhöhe 13,5) und weit gesperrt im Blocksatz auf Breite von MAKE.
- Striche als **Haarlinien** (3) in edleren Tönen; der Knoten (Ø 10) als Zeichen.
- Kopf: neue **Querfassung** (MAKE links, INNOVATION rechts auf Höhe der Versalmitte) — INNOVATION bleibt so im Kopf lesbar.
- Favicon/Kachel: **Monogramm** M mit Strichen und Knoten (ersetzt die vorläufige M-Bildmarke aus v3/v4).

## Konstruktion
| Teil | Raster |
|---|---|
| MAKE | Versalhöhe 64, Stamm 10,5. Sperrung M–A 11, A–K 24 (die Fuge), K–E 12. Breite 276,76. |
| Striche | Höhe 3, 12 unter der Grundlinie (y 76–79). Rot x 0 bis Knoten − 8, Grün Knoten + 8 bis Ende. |
| Knoten | Mitte der Fuge zwischen A und K, Radius 5, Spalt 3 zu beiden Strichen; linke Hälfte Rot, rechte Grün. |
| INNOVATION | Versalhöhe 13,5, Stamm 2,3, Blocksatz auf 276,76, y 91–105. |
| Block | 276,76 × 106 (kompakt ohne INNOVATION: 276,76 × 79). |

## Farben
| Rolle | auf dunklem Grund | auf hellem Grund |
|---|---|---|
| Rot (Malin) | `#C9465C` | `#A82E44` |
| Grün (Kevin) | `#2FA878` | `#167A55` |
| MAKE | `#ECEFED` | `#0B0E10` |
| INNOVATION | `#9AA5A8` | `#4F5A5D` |
| Kachel-Grund | `#0B0E10` | — |

Rot und Grün gehören den Personen — nie für Zustände oder Knöpfe (die sind Türkis `#58D9CD`). Rot steht links, Grün
rechts — nie tauschen.

## Dateien
| Datei | Einsatz |
|---|---|
| `wortmarke.svg` / `wortmarke-hell.svg` | Wortmarke gestapelt (MAKE · Striche mit Knoten · INNOVATION), 276,76 × 106 |
| `quer.svg` / `quer-hell.svg` | Kopf und Fuß: MAKE + Striche, INNOVATION rechts daneben (547,7 × 79; Kopf 30 px hoch) |
| `kompakt.svg` / `kompakt-hell.svg` | Kopf am Handy (≤ 560 px): ohne INNOVATION |
| `gross.svg` / `gross-hell.svg` | Titel, Druck: Wortmarke mit Schutzzone (rundum 40) |
| `visitenkarte-make.svg` / `visitenkarte-make-hell.svg` | **Logo zum Hochladen in ein Visitenkarten-Profil**: Wortmarke mit eigenem Grund (dunkel `#0B0E10` bzw. weiß), Rand 56, reines SVG ohne Skript, Stil oder externe Verweise |
| `bildmarke.svg` / `bildmarke-hell.svg` | Monogramm (M · Striche · Knoten) |
| `kachel.svg` (= `website/favicon.svg`) | App-Kachel und Favicon (Monogramm auf dunklem, abgerundetem Quadrat) |
| `favicon-32.png`, `apple-touch-icon.png` (180, ohne Rundung — iOS rundet selbst), `icon-512.png` | Raster-Fassungen der Kachel |

**Einsatz auf der Seite („Klar 2“, 07.10.2026):** Kopf hell — `quer-hell.svg` (Rechner) bzw. `kompakt-hell.svg` (Handy); Fuß dunkel —
`wortmarke.svg` (176 px breit). fokusinnovation.de: `make-quer.svg` (= `quer.svg`) als Kopie, eigene Wortmarke FOKUS INNOVATION im Fuß.
Keine Animation des Logos mehr (die frühere Einzeichnen-Bühne ist entfernt).

## Schutzzone und Mindestgröße
- **Schutzzone:** rundum 40 (Einheiten der Wortmarke). Nichts ragt hinein.
- **Mindestgröße:** gestapelt 120 px breit, quer 24 px hoch, kompakt 20 px hoch, Kachel 16 px.
- Nicht verzerren, nicht umfärben (außer hell/dunkel), keine Schatten oder Konturen.

Frühere Stände (v2 Personenstriche + Bildmarke, v3 zwei Punkte, v4 runde Linien-Buchstaben) liegen im Git-Verlauf.
