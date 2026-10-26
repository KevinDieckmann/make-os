# Fokus Innovation · Website (Prototyp, dritte Fassung, 25.10.2026)

Nicht online, nicht committet. Ansehen: Vorschau „fokus-prototyp“ (Port 3018) oder `python3 -m http.server 3018 -d prototype/fokus-innovation`.

## Aufbau
- `inhalt/fokus.json`: alle Texte der Marke aus dem Positionierungs-Doc (Leitidee, Film, Bereiche, Abend, Werte, Team, Belege mit Quelle).
- Angebote, Preise, Produktblätter und Fragen kommen weiter aus `makeinnovation/inhalt/*.json`. Es gibt also keine zweite Preisliste.
- `bauen.mjs` erzeugt alle 22 Seiten. Danach prüft es:
  - Sperrwörter: alter Name, Software-Name, Connect, Superlative.
  - Inline-Skripte und -Stile, fremde Quellen, Formulare.
  - Zoe nur zusammen mit „KI-Assistentin“.
  - tote Links und Anker.
  Aufruf: `node prototype/fokus-innovation/bauen.mjs` (mit `--pruefen` nur prüfen).
- `css/fokus.css`: die ganze Gestaltung. Die Farben stehen oben an EINER Stelle, vorerst das Lavendel aus dem Logo.
- `css/film.css`, `js/film.js` und `js/szene.js` bilden den Film der Startseite. Das ist eigenes WebGL, keine Bibliothek.
- `js/seite.js` lässt Abschnitte einmal erscheinen, steuert das Menü und den Check-Knopf. `js/frueh.js` setzt nur die Klasse `js`.

## Gestaltung: seriöse Agentur statt Tech-Bude
- Papier und Tinte, eine Schrift (Schibsted Grotesk), Haarlinien statt Kartenwände. Farbe kommt nur aus dem Logo: Kern, Knoten, Unterstreichungen.
- Kein Monospace, kein Glühen, keine Chat-Optik. Je Seite höchstens eine hervorgehobene Fläche, und der dunkle Schlussakt ist der einzige dunkle Abschnitt.
- **Der Faden** (Heute → Mit uns → Danach) ist das wiederkehrende Bild. Er zeichnet sich einmal und steht still bei „Bewegung reduzieren“.
- **Der Film der Startseite** erzählt den Gründer, der sich um alles kümmert (Kevin 25.10. spät), in sechs Bildern:
  1. Aufgaben und Ringe schweben um ihn herum.
  2. Sie sammeln sich zum Kern: das Produkt ist richtig gut.
  3. Der Kern steht allein: der Markt weiß es noch nicht.
  4. Ein Punkt zieht die Bahn: jetzt braucht es Fokus.
  5. Der Punkt geht durch die Lücke: das Produkt kommt in den Markt.
  6. Logo mit Wortmarke und Claim.

  Danach kommt die Seite auf Papier. Das Erklärvideo erzählt dieselbe Story ([ERKLAERVIDEO_PROMPT.md](ERKLAERVIDEO_PROMPT.md)).
- Kein Wackeln beim Laden (CLS 0). Die Schrift lädt mit `font-display: optional` und Vorladen.

## Offen für Kevin
- Handelsregister im Impressum (Platzhalter).
- Porträtfotos von Kevin und Malin würden „Über uns“ und den Abend stark machen; bis dahin stehen Kürzel.
- Der Check-Link `/check` braucht auf fokusinnovation.de dieselbe Weiterleitung an die Anwendung wie auf makeinnovation.de.
- Login-Link, Rubrik „Im Fokus“ und Gratis-Seite fehlen bewusst: Es gibt dafür noch nichts Fertiges.
