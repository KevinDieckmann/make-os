# Vorlage „Relay“ (getlayers.ai) — Basis für die nächste makeinnovation.de

**Stand:** 05.10.2026 · Kevin: „Auf diese Basis nochmal die MAKE-Innovation-Homepage anpassen“ → **zurückgestellt** (Kevin: „wir stellen es nochmal nach hinten“), bis P17 (Homepage-Recherche) geprüft vorliegt.

Die vollständige Bauanleitung (Sektionen, Tokens, Shader, Federn, Zeitachsen) hat Kevin am 05.10. im Chat geliefert; sie liegt im Sitzungsprotokoll. Beim Bau neu anfordern oder aus dem Protokoll übernehmen.

## Was wir übernehmen (Struktur und Qualität)
- Vorlader: Linie läuft als echter Ladefortschritt um den Bildschirm, flutet, faltet sich ins Logo (bei uns: M+K-Kachel).
- **Ein seitenlanger Partikelstrom** (three.js, `screen`-Mischung, Dokument-Koordinaten) — passt zu „Jede Innovation beginnt als Signal. Wir machen daraus einen Weg.“
- Mattglas-Fläche über mehrere Abschnitte, Federbewegung (280/32, 120/26, 70 ms Staffel), Titel aus Unschärfe mit Maskenwisch, getippte Mono-Zeilen, Live-Fenster im ersten Bildschirm mit Zeiger-Neigung, Abschnitts-Übergänge per Scroll.
- Raster: vier Rahmen (1440/1024/768/390), rem-Raster.

## Was wir NICHT übernehmen
- **Keine Relay-Grafiken, kein Relay-Logo, keine Dateien von storage.getlayers.ai** — alles selbst gezeichnet (SVG/WebGL/CSS).
- **Keine erfundenen Zahlen, Statistiken oder Kundenzitate** (Kevins Regel „alles belastbar“, `research/ai-ceo/VERIFIZIERT.md`). Beleg-Abschnitt nur mit echten, freigegebenen Belegen — sonst Prinzipien.
- **Kein MAKE OS auf der Seite**, solange kein Markteintritt beschlossen ist.
- **Kein „Daten bleiben in Deutschland“ / „Hosted in Germany“**, solange die KI-Läufe über Anthropic direkt (global/USA) gehen (VERIFIZIERT-A.md).

## Offene Entscheidungen (beim Bau als Klickrunde)
1. Grundton: Schwarz + Granat (Smaragd als Zweitton im Strom) · Schwarz + Smaragd · hell → dunkel behalten.
2. Live-Fenster im Hero: Umsetzungs-Board (Signal → Strategie → Vertrieb → Markt mit Freigabe) · Vertriebs-Pipeline · Make.One-Abend.
3. Beleg-Abschnitt: Prinzipien statt Zahlen · echte, freigegebene Zahlen.
4. Preis-Abschnitt: Formate ohne Preise (Regler → Empfehlung → Erstgespräch) · mit Preisen · weglassen.

## Abbildung Relay → MAKE Innovation (Entwurf)
| Relay | MAKE Innovation |
|---|---|
| 01 Navigation | Leistungen · Vorgehen · Make.One · Fokus Innovation · „Erstgespräch“ |
| 02 Hero | „Innovation braucht Umsetzung *und Sichtbarkeit*.“ + Live-Fenster |
| 03 Integrations | „Wo wir wirken“: Strategie, Vertrieb, Marketing, Events, Netzwerk, KI |
| 04 Product (3 Zeilen) | Interim CSO · Interim Head of Sales · Events & Netzwerk-Strategie |
| 05 Statement (Akzentplatte) | „Wachstum scheitert selten an Ideen. *Meist an der Umsetzung.*“ |
| 06 Scale | „So arbeiten wir. Drei Phasen, ein Fundament, das bleibt.“ |
| 07 Signals | Make.One / Fokus Innovation (Abende, Städte, Netzwerk) |
| 08 Proof | Prinzipien: Umsetzung statt Folien · Vertrieb aus der Praxis · Netzwerk inklusive · Struktur, die bleibt |
| 09 Pricing | Formate (je nach Entscheidung 4) |
| 10 Footer | Erstgespräch-Platte, Firmierung „MAKE Innovation · eine Marke der KEMARIS Innovation GmbH“, Impressum/Datenschutz |
