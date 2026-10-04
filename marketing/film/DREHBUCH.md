# MAKE Innovation — Film „Aus Berlin ins Machen“ (Drehbuch v1, 03.10.2026)

Kevin, 03.10.: „aus Berlin heraus … mit MAKE Innovation reingehen und dann dieses Innovation aufplatzt … in kleinere
Neuronen/Zeitstrahlen, die nach Bielefeld, München, Köln und Hamburg gehen … über Make.One das Netzwerk verknüpfen …
in den Städten in ein Penthouse oder auf ein Rooftop, wo Gespräche geführt werden — nicht futuristisch, sehr seriös,
sehr klar, klare Linien, kein Techie-Laden, ein seriöses Netzwerk, das Innovation in Deutschland fördert.“

**Format (Kevin 03.10.):** Die Stadt-Szenen sind Abende von **Fokus Innovation** — der Innovations-Event-Reihe von Make.One (Domain fokusinnovation.de).

**Kernaussage:** MAKE kommt aus Berlin. Aus der Idee wird Umsetzung — und über Make.One verbinden wir Entscheider in ganz
Deutschland: an ausgewählten Orten, in ruhigen Runden, mit Haltung.

**Länge:** ca. 40 s (Landingpage-Loop: 20-s-Schnittfassung). Format 16:9 (Website), dazu 9:16-Schnitt (LinkedIn/Reels).

## Arbeitsteilung (wichtig für die Qualität)
- **Code (scharf, exakt, in eurer CI):** Logo/Wortmarke, das „Aufplatzen“ von INNOVATION in Lichtfäden, die Deutschlandkarte
  mit den echten Positionen von Berlin, Hamburg, Bielefeld, Köln, München, Städtenamen, Schlussclaim. KI-Video kann keine
  Schrift, keine Logos und keine genauen Karten.
- **Higgsfield (KI-Video):** die Menschen und Orte — Berlin aus der Luft, Penthouse/Rooftop-Szenen in den vier Städten.
- **Übergänge:** Die Lichtfäden aus dem Code laufen über den Rand jeder KI-Szene hinein und wieder hinaus (Überblendung).

## Stilbibel (gilt für jede KI-Szene)
Photoreal, cinematic, zurückhaltend, hochwertig — wie ein Imagefilm einer Privatbank oder eines Architekturbüros, nicht
wie ein Tech-Start-up. Klare Architektur, ruhige Kamera (langsame Dolly-/Gleitfahrt), blaue Stunde bzw. früher Abend,
warmes, natürliches Licht, viel dunkles Anthrazit, Holz, Stein, Glas. Farbakzente nur dezent in **Granat (#C9465C)** und
**Smaragd (#2FA878)** — z. B. ein Einstecktuch, ein Buchrücken, das Licht eines Weinglases. Menschen: gemischt jung und
erfahren, Business-Casual bis elegant, echte Gespräche, niemand schaut in die Kamera. **Nie:** Bildschirme, Hologramme,
Neon, Roboter, Sci-Fi, Text, Logos, Wasserzeichen, schnelle Schnitte.

Negativ-Prompt (immer anhängen): `text, letters, logos, watermark, neon, hologram, futuristic interface, robots, screens,
distorted hands, extra fingers, warped faces, fast cuts, shaky camera, oversaturated`

## Szenen

| # | Zeit | Bild | Quelle |
|---|---|---|---|
| 1 | 0–5 s | Berlin, blaue Stunde, Luftaufnahme langsam über die Spree Richtung Mitte, Fernsehturm in der Ferne | Higgsfield |
| 2 | 5–9 s | Über dem Bild baut sich die Wortmarke **MAKE INNOVATION** auf, der rot-grüne Knoten leuchtet | Code |
| 3 | 9–13 s | **INNOVATION platzt auf**: die Buchstaben lösen sich in feine Lichtfäden (Granat + Smaragd), die als Neuronen auseinanderfließen | Code |
| 4 | 13–18 s | Die Fäden legen sich auf eine **ruhige Deutschlandkarte bei Nacht** (nur Umriss + Lichtpunkte): von Berlin aus nach **Hamburg, Bielefeld, Köln, München, Dresden** — Städtenamen erscheinen, dazu klein „Fokus Innovation“ an jeder Stadt | Code |
| 5 | 18–22 s | **Hamburg** — Penthouse über dem Hafen, Abenddämmerung, kleine Runde im Gespräch | Higgsfield |
| 6 | 22–26 s | **Bielefeld** — helles Dachgeschoss mit Holz und klaren Linien, Mittelständler und Gründerin am Tisch | Higgsfield |
| 7 | 26–30 s | **Köln** — Rooftop-Terrasse, der Dom als Silhouette in der Ferne, Stehgespräche mit Gläsern | Higgsfield |
| 8 | 30–35 s | **München** — elegantes Penthouse, langer Tisch, Abendessen, Gespräche, ruhiges Licht | Higgsfield |
| 9 | 35–40 s | Die Fäden ziehen sich aus allen Städten zurück nach Berlin in den Knoten → **„Innovation braucht Umsetzung und Sichtbarkeit.“** darunter **„Fokus Innovation — ein Format von Make.One“** und klein „MAKE Innovation · eine Marke der KEMARIS Innovation GmbH“ | Code |

## Prompts (Higgsfield)

**S1 · Berlin aus der Luft**
> Cinematic aerial drone shot over Berlin at blue hour, slowly gliding along the river Spree towards the city centre, the
> Fernsehturm TV tower softly silhouetted in the distance, calm water reflections, warm city lights coming on, clean and
> restrained premium brand film look, natural colour grading with deep charcoal tones, 35mm, very slow smooth camera
> movement, no text, no logos.

**S5 · Hamburg — Penthouse am Hafen**
> Elegant penthouse in Hamburg at dusk, floor-to-ceiling windows overlooking the harbour and cranes in soft distant haze,
> a small group of four entrepreneurs of different ages in calm conversation around a low table, business casual and
> elegant clothing, warm natural light, dark wood and stone, clean architectural lines, subtle garnet red and emerald green
> accents in details, slow dolly in, photorealistic, cinematic, serious and understated, no screens, no text.

**S6 · Bielefeld — Dachgeschoss, Mittelstand**
> Bright modern attic loft in a German mid-sized city at early evening, exposed timber beams and clean white walls, a
> family business owner in his sixties and a young founder discussing sketches and printed plans at a long oak table, two
> more people listening, warm daylight fading, calm and focused atmosphere, clean lines, subtle garnet and emerald accents,
> slow lateral camera move, photorealistic, cinematic, no screens, no text.

**S7 · Köln — Rooftop mit Dom**
> Rooftop terrace in Cologne at golden hour, the cathedral softly silhouetted in the far distance, small groups of decision
> makers standing in relaxed conversation with glasses in hand, young and experienced people mixed, elegant business attire,
> warm low sun, clean minimal terrace design with stone and glass railing, subtle garnet and emerald accents, slow gliding
> camera, photorealistic, cinematic, understated, no text, no logos.

**S8 · München — Penthouse-Abendessen**
> Refined penthouse in Munich in the evening, a long dark wood dinner table with candles and simple tableware, eight
> entrepreneurs and executives of different ages in engaged conversation, warm candlelight and soft city lights through
> large windows, clean architectural interior, deep charcoal and warm neutral palette with subtle garnet and emerald details,
> slow dolly along the table, photorealistic, cinematic, serious and elegant, no screens, no text.

## Modelle & Kosten (Higgsfield, Stand 03.10., per Kostenabfrage — nichts generiert)
- Standbilder/Schlüsselbilder (`gpt_image_2_5`, 16:9): **0,25 Credits** je Bild → erst Look festlegen, dann animieren.
- Video `kling3_0`: **10 Credits** je 5 s, 20 je 10 s (gute Qualität, bezahlbar).
- Video `cinematic_studio_3_0`: **30 Credits** je 6 s (720p, kinoreifer).
- Video `seedance_2_0` 1080p: **54 Credits** je 6 s; `seedance_2_5`: 56 je 8 s.
- Bedarf: 5 KI-Szenen à ~5 s → mit Kling ca. **50 Credits**, mit Cinema Studio ca. **150 Credits** (+ Reserve für 1–2 Varianten je Szene).
- Konto heute: **10 Credits, Free-Plan** → reicht für Schlüsselbilder, nicht für die Videos.

## Ablauf
1. Schlüsselbilder je Szene (S1, S5–S8, je 1–2 Varianten) → Kevin wählt den Look.
2. Kevin entscheidet über Credits/Plan (Higgsfield).
3. Schlüsselbild → Video (image-to-video, Start-Bild = gewähltes Schlüsselbild) je Szene.
4. Code-Teile (Wortmarke, Aufplatzen, Karte, Claim) mit der Lichtfäden-Technik bauen, Schnitt zusammensetzen, Landingpage
   einbinden (komprimiert, Standbild-Ersatz, `prefers-reduced-motion`).
