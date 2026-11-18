# Fokus Innovation · Website (vierte Fassung, 27.10.2026)

Online als Vorschau unter https://fokusinnovation.de (seit 26.10., noindex). Die Quelle liegt hier, der gebaute Ordner liegt auf `main` unter `fokusinnovation/`.

## Aufbau
- `inhalt/fokus.json`: alle Texte der Marke aus dem Positionierungs-Doc:
  - Leitidee, Film, Bereiche, Abend, Werte, Team
  - Belege mit Quelle
  - Fakten „auf einen Blick“
  - `seo`: Titel und Beschreibung je Seite, Schalter `oeffentlich`, IndexNow-Schlüssel
- `inhalt/wissen.json`: sechs Ratgeber und 25 Begriffe. Preise stehen dort nur als Platzhalter (`{preis:head-of-sales}`, `{ab:positionierung}`, `{zusatz:id}`), damit es keine zweite Preisliste gibt.
- Angebote, Preise, Produktblätter und Fragen kommen weiter aus `makeinnovation/inhalt/*.json`.
- `bauen.mjs` erzeugt alle Seiten und Dateien: 31 Seiten, die 404-Seite, robots.txt, sitemap.xml, llms.txt, llms-full.txt, site.webmanifest und die IndexNow-Datei. Danach prüft es:
  - Sperrwörter: alter Name, Software-Name, Connect, Superlative.
  - keine Inline-Skripte außer JSON-LD, keine Inline-Stile, keine fremden Quellen, keine Formulare.
  - Zoe nur zusammen mit „KI-Assistentin“; tote Links und Anker.
  - Suche:
    - genau ein h1
    - Titel mit 15–65 Zeichen, Beschreibung mit 110–165 Zeichen, beide je Seite einmalig
    - Canonical
    - JSON-LD gültig und ohne leere Felder
    - jede Frage in den Daten auch sichtbar
    - Vorschaubild vorhanden
- `grafiken.mjs`: die gezeichneten Bewegungen (SVG) für Bereiche, Team, Einstiege und Belegzahlen.
- `arbeitsprobe.mjs` nimmt mit Chrome die zwei Bildschirmfotos der Arbeitsprobe von der laufenden Vorschau auf (`assets/bild/arbeitsprobe/rechner.jpg` 1440 × 900 und `handy.jpg` 780 × 1688). Beide zeigen seit 18.11. die Startseite im Raum von MAKE Studios (Etage 08, Website · Cinematic, als Standbild über `?p=0.4024&linie=website&paket=3`). Nach einem neuen Zeichen, Kopf oder einer Änderung am Haus einmal laufen lassen: `node arbeitsprobe.mjs http://localhost:<port>`.
- `bilder.mjs` zeichnet mit Chrome ein Vorschaubild je Seite (1200 × 630), dazu Logo, Icons und favicon.ico. Nach neuen Seiten oder geänderten Titeln einmal laufen lassen.

Aufruf:

```bash
node prototype/fokus-innovation/bauen.mjs
```

Mit `--pruefen` wird nur geprüft. Danach `bilder.mjs`, wenn der Prüfer ein fehlendes Bild meldet.

## Suche und KI-Suchen (27.10.)
- **Jede Seite** trägt:
  - Titel und Beschreibung
  - Canonical
  - Open Graph (Vorschaubild für LinkedIn, WhatsApp, Google)
  - JSON-LD mit Organisation (ProfessionalService, Sitz Berlin, Gründer), WebSite, WebPage und Brotkrumen
- **Je Seitentyp** kommen dazu:
  - Leistung mit Preis (Service, Offer, netto, monatlich wo „pro Monat“)
  - FAQPage, wo Fragen stehen
  - Article mit Autor, Datum und Quellen
  - DefinedTermSet bei den Begriffen
  - OfferCatalog bei den Preisen
- **Für KI-Suchen** (GEO):
  - „Kurz gesagt“ oben auf Bereichs- und Ratgeberseiten, die Antwort zuerst
  - „Auf einen Blick“ mit Fakten
  - Fragen mit Antworten und Zahlen mit Quelle
  - `llms.txt` als Wegweiser und `llms-full.txt` mit allen Inhalten als Klartext
- **Neue Seiten:**
  - Wissen: Übersicht und sechs Ratgeber
  - Preise: alles auf einer Seite
  - Häufige Fragen: alle an einem Ort
  - Begriffe: von A bis Z
- **Freischalten für Google** auf Kevins Wort:
  1. `seo.oeffentlich` auf `true` setzen.
  2. Neu bauen.
  3. Im Caddyfile die Zeile `X-Robots-Tag` im Block `(fokus_koepfe)` entfernen, den Test anpassen und hochladen.
  4. Danach die Sitemap in der Search Console einreichen.

  Die Schritte für Kevin stehen in [GOOGLE_SCHRITTE.md](GOOGLE_SCHRITTE.md).

## Hochladen
1. Hier bauen, wie oben unter Aufruf.
2. In den Deploy-Ordner kopieren:

```bash
node prototype/fokus-innovation/ausliefern.mjs <main-checkout>/fokusinnovation   # rsync wie bisher + Kommentare aus ausgelieferten Stil- und Skriptdateien (seit 12.11., nie mehr nur rsync)
rsync -a --delete unterlagen/ <main-checkout>/unterlagen/   # lange Vorlagen (nur per E-Mail), aus dem Repo-Ordner unterlagen/
```

3. Dort committen und auf `main` pushen, nur auf Kevins Wort. Die GitHub Action rollt es aus.

## Gestaltung: seriöse Agentur statt Tech-Bude
- Papier und Tinte, eine Schrift (Schibsted Grotesk), Haarlinien statt Kartenwände. Farbe kommt nur aus dem Logo.
- Der Faden (Heute → Mit uns → Danach) ist das wiederkehrende Bild.
- Die Ratgeber sind ruhige Leseseiten: links das Inhaltsverzeichnis, rechts der Text in einer angenehmen Zeilenlänge.
- Der Film der Startseite erzählt den Gründer, der sich um alles kümmert. Das Erklärvideo erzählt dieselbe Story ([ERKLAERVIDEO_PROMPT.md](ERKLAERVIDEO_PROMPT.md)).
- Die Seite wackelt beim Laden nicht (CLS 0). Die Schrift lädt mit `font-display: optional` und Vorladen.

## Überarbeitung 11.11.2026: Rhythmus, größere Schrift, gezeichnete Bewegungen
Nach dem Film fiel die Seite in ein gleichförmiges Textdokument. Geändert wurden gemeinsame Bausteine, nicht einzelne Seiten:
- **Schrift und Breite:** am Rechner eine Stufe größer (`html` 106 %, ab 1700 px 119 %), Inhalt bis 1280 px (groß 1400 px). Abschnittsköpfe: Marke oben, links die Überschrift, rechts die Einleitung.
- **Zeichnungen (`grafiken.mjs`):** je Bereich eine dunkle Fläche im Format 16:10 in der Formensprache des Zeichens (Kugel, Balken, Linien): Sichtbarkeit (Signale werden zu Anfragen), Vertrieb (Strecke bis zum Abschluss), Innovation (ein Ablauf, der beim Team ankommt). Dazu „Wir sitzen mit in Ihrem Team“ auf Papier und die Zeichen der zwei Einstiege. Reines SVG mit Klassen, Bewegung in `css/fokus.css › Gezeichnete Bewegungen`: einmal, nur im Sichtfeld, ohne Skript und bei „Bewegung reduzieren“ steht das Endbild.
- **Belegzahlen (`belegBand`):** dunkles Band, Zahl groß, darunter ihre Bahn (Linie, Kugel, bei 100 % die Wand), Satz und Quelle. `js/seite.js` zählt einmal hoch. Startseite: drei Zahlen, Bereichsseiten: eine.
- **Neun Situationen:** mit Skript drei Reiter mit je drei Karten, jede lässt sich antippen („Kenne ich“), der Stand steht beim Schluss-Satz. Ohne Skript stehen alle neun da. Es wird nichts gespeichert oder gesendet.
- **Takt der Startseite:** Film (Nacht) · Einstieg mit zwei Türen (Papier) · Situationen (Papier) · Zahlen (Nacht) · drei Bereiche mit Zeichnung (Papier) · Warum wir · Fragen · Events (Sand, mit Tisch) · Wissen · Schlussakt (Nacht, Zeichen groß wie im letzten Bild des Films).
- **Film ohne Skript:** statt leerer dunkler Fläche steht das Endbild (`css/film.css`, letzter Block).
- **Erklärvideos:** Die dunkle Fläche der Bereiche (Startseite und Bereichsseiten) ist die vorbereitete Stelle. Sie sieht ohne Video vollständig aus; ein Video im Format 16:10 kann sie später übernehmen. Leere Player gibt es nicht.

## Markenfamilie 11.11.2026: MAKE Innovation ist das Dach
Kevin: „Dach plus Innovation“. Verbindlich sind `STRUKTUR-MARKEN.md` und `SEO-GEO-VORGABEN.md` (Arbeitsordner der Sitzung).
- **Eine Stelle:** `inhalt/fokus.json › familie` hält Adressen, Standardsätze, Anrisse und die Texte der Preisblätter. Bis zu den echten Domains stehen dort die Vorschau-Adressen (MAKE Studios `http://localhost:3022/`, MAKE Revenue `http://localhost:3023/`). Der Prüfer bricht ab, wenn bei `seo.oeffentlich = true` noch `localhost` in einer Datei steht.
- **Startseite:** Film · Einstieg · „Eine Firma, drei Marken.“ (zwei Karten in Farbe und mit Zeichen der Marke, je ein Link zur Marke und zum Preisblatt) · Innovation als eigener Abschnitt · Situationen · Zahlen · Warum wir · Fragen · Events · Wissen · Schlussakt.
- **Sichtbarkeit und Vertrieb** sind beim Dach ein knappes Preis- und Leistungsblatt (Preise, Vergleich, Zusatzoptionen bzw. Rechner und Ablauf, Wissen, Fragen) mit der Karte der Marke im Kopf. Problem, Beispiele und Ablauf stehen bei der Marke. Adressen, Angebotsseiten und Preise sind unverändert. Innovation behält die volle Seite.
- **Verweise:** Karte im Familien-Abschnitt und im Kopf der Preisblätter, ein Hinweis auf jeder Angebots- und Gruppenseite von Sichtbarkeit und Vertrieb, eine Zeile bei Events, im Fuß „Marken: MAKE Studios · MAKE Revenue“. Immer sichtbare Links mit dem Markennamen.
- **Strukturierte Daten:** Organisation als `Organization` + `ProfessionalService` mit `brand` und `subOrganization` für beide Marken, `WebSite` mit `alternateName`. `llms.txt` hat den Abschnitt „Die Markenfamilie“.
- **Prüfer:** „MAKE“ ist erlaubt als MAKE Innovation, MAKE Studios, MAKE Revenue. Startseite und Preisblätter müssen zur Marke verweisen.
- **Zeichen:** MAKE Studios trägt die Irisblende aus deren `zeichen.svg`. MAKE Revenue trägt den Kreis mit der Stufenlinie aus deren `zeichen.svg` (Minze auf dunklem Grund, Tannengrün auf Papier). Beide Zeichen zeichnet `grafiken.mjs › markenZeichen`, die Farben stehen in `css/fokus.css › Markenfamilie`.
- **Erste Szene des Films:** Titel und Satz stehen ab dem ersten Bild da (ohne Skript, ohne Einblenden aus Deckkraft 0), damit sie als größtes sichtbares Element zählen. Die übrigen Szenen laufen wie bisher.

## Ergänzungen 18.11.2026: Social Media, Innovation mit Preisen, Fokus Abend, Podcast
Kevin: Was die Scroll-Geschichte „Das Haus“ nennt, steht auch auf den Seiten dahinter.
- **Preise bleiben an einer Stelle** (`makeinnovation/inhalt/inhalt.json › angebote`): neu `social-media` (drei Stufen mit `punkte`), `scoping-workshop` und `abendpartner`. Angebote mit dem Feld `anker` haben keine eigene Seite, sondern stehen als Abschnitt auf einer anderen (`/innovation/#scoping-workshop`, `/events/#abendpartner`). Umsetzungsprojekte tragen kein „Coming Soon“ mehr.
- **Social Media:** Seite `/sichtbarkeit/social-media/`, auf dem Preisblatt die drei Pakete als Zeilen unter dem Angebot (`stufenDaten`), auf `/preise/` als Karte.
- **Innovation:** `/innovation/` zeigt statt einer Liste die drei Schritte Check, Workshop, Projekt (`dreiSchritte`, Texte in `fokus.json › bereiche.innovation.schritt_texte`); dieselben Schritte als Weg auf `/innovation/umsetzungsprojekte/`.
- **Events:** Der monatliche Abend heißt „Fokus Abend“ (`fokus.json › events.abend`: Ablauf, Rollen als Vergleich, Fragen). Die allgemeine Einleitung mit `data-mk="text:events.einleitung"` steht jetzt über den weiteren Formaten, damit ein in der Anwendung gepflegter Text den Kopf nicht überschreibt.
- **Podcast:** Seite `/podcast/` (`fokus.json › podcast`), Menüpunkt neben Events. Es gibt genau eine Aussage und einen Aufruf.
- **Prüfer:** „Fokus Innovation“ ist nur noch der Name des Podcasts. Erlaubt ist genau diese Schreibweise und nur zusammen mit „Podcast“ im selben Textblock (`fokusNameFehler`). Als Firmen- oder Seitenname (Seitentitel, Name der Website, Organisation in den strukturierten Daten, „… GmbH“, „© …“) bleibt er gesperrt (`fokusAlsSeitenname`), ebenso andere Schreibweisen und die alte Adresse. „Fokus Abend“ ist kein Sperrwort.

## Startseite: „Das Haus“ statt Film (18.11.2026)
Die Scroll-Geschichte „Das Haus“ ist der Auftakt der Startseite: Auftakt auf der Dachbühne, Fahrt nach unten, sieben Halte mit Räumen, Paketschaltern, Rollen und Karten, der rote Faden, das Finale, der Kreis-Übergang in den ersten hellen Abschnitt. Dazu das Dock mit der Etagenwahl. Kopf, Fuß und alles danach sind die Website wie bisher.
- **Quelle ist `haus/` in diesem Ordner** (der frühere Test-Ordner `prototype/make-haus/` ist eingefroren):
  - `buehne.html` Markup der Bühne, `haus.css` Stile, `haus.js` Skript.
  - `pakete.json` Pakete und Rollen der Räume, `haus.json` die sieben Etagen, `verbindungen.json` „Spielt zusammen mit“, `ziele.json` alle Linkziele.
  - `lenis.min.js` (Lenis 1.3.26, MIT) mit `lenis-LICENSE.txt`.
  - `haus-bau.mjs` baut daraus das Markup und die Dateien `css/haus.css`, `js/haus.js`, `js/lenis.min.js`. `bauen.mjs` ruft es auf; im Seitenrahmen heißt der Schalter `haus` (Startseite), er lädt Stile und Skript und setzt den Kopf von Anfang an hell auf dunkel.
- **Eine Preisliste:** In `haus/pakete.json` stehen keine Preise. Ein Paket nennt mit `angebot` (bei Social Media dazu `stufe`) das Angebot aus `makeinnovation/inhalt/inhalt.json`; Ab-Preis und Linkziel „Zum Angebot“ kommen beim Bau von dort. Der Bau vergleicht auch die Namen und bricht ab, wenn einer nicht mehr passt; geduldete Kurzformen nennt er in der Ausgabe.
- **Links:** nur über `haus/ziele.json`. Erstgespräch, Checks und Anfragen (Einladung, Abendpartner, Gast im Podcast) löst `bauen.mjs` mit denselben Helfern auf wie überall (`hausZiel`). Anfragen tragen `data-anfrage-mail`, auch die, die das Skript einsetzt.
- **Sicherheitsregeln:** kein Inline-Skript, kein `<style>`, kein `style`-Attribut (auch nicht in HTML, das das Skript einsetzt). Farben je Etage stehen als Klassen in `haus.css`. Der Bau bricht ab, wenn im Markup oder Skript ein `style=` steht.
- **Maße:** In `haus/haus.css` und `haus/haus.js` meint „rem“ die Einheit des Hauses (`--hr`, läuft mit der Fensterbreite). Der Bau setzt dafür `calc(… * var(--hr))` ein, weil die Website eine andere Wurzel-Schriftgröße hat. Regeln des Hauses gelten nur in `.haus`.
- **Kopf über der Szene:** dieselbe dunkle Fassung wie früher beim Film (`.kopf.ueber-film`, mit `film-geht` als dunkles Glas ab der Fahrt). `html.kopf-da` rückt Etikett, Paketschalter, Karte und Etagenleiste unter den Kopf. „Zum Inhalt“ führt auf `#einstieg`.
- **Ohne Skript und für Suchmaschinen:** dieselben Elemente als lesbare Abschnitte (Auftakt, sieben Etagen, roter Faden), je Etage in `<noscript>` die Preiszeile und die Pakete mit Link. Das eine `h1` der Seite ist der Titel des Auftakts; die Überschrift des ersten hellen Abschnitts ist jetzt `h2.held-titel` (sieht aus wie vorher).
- **Handy, Schalterblatt (Nacharbeit 18.11.):** Das Blatt ist ein Raster: Etikett und Link („Zum Angebot“ bzw. „Mehr erfahren“) teilen sich die erste Zeile, das Etikett kürzt mit Auslassungspunkten. Solange das Blatt offen ist (`html.blatt-offen`, setzt das Skript), rückt das Dock 0,75 rem tiefer; so steht der letzte Knopf bei 390 × 844 in allen Paketen frei. In Fenstern von 768 bis 1024 Breite steht der Hinweis „Punkte antippen“ über dem Dock.
- **Kein Vorlader:** Titel und Satz stehen ab dem ersten Bild im HTML.
- **Auftakt mit der Mission (18.11.):** Die drei Bilder tragen „Gute Ideen / scheitern / nicht mehr“ (das `h1`), „an Sichtbarkeit, / Vertrieb / und Zugängen.“ und „Dafür / gibt es / uns.“. „Bühne für Innovation“ steht als Vorzeile über dem ersten Titel (`.hero-vor`; für Vorleser und ohne Skript als `p.sr-only` davor). Alle drei Bilder haben dieselbe Größe (`.hero .word` in `haus.css`): Maß ist die längste Zeile „an Sichtbarkeit,“ (6,71 em breit), die untere Zeile muss links vom Satz rechts unten enden. Wer eine Zeile ändert, prüft die Standbilder bei `?p=0.02`, `?p=0.10` und `?p=0.17` in 1440 × 900, 1280 × 720, 1024 × 768 und 390 × 844.
- **Film:** `css/film.css`, `js/film.js` und `js/szene.js` lädt keine Seite mehr. Die Dateien liegen noch da (der Prüfer verlangt sie); `fokus.json › film` wird nicht mehr gelesen.
- **Auslieferung:** `ausliefern.mjs` lässt `haus/` (Quellen) und `werkzeug/` weg.
- **Prüfen** (Ordner `werkzeug/`):
  - `node werkzeug/csp-server.mjs` liefert die Seite mit den Sicherheits-Kopfzeilen auf Port 3391.
  - `node werkzeug/haus-standbilder.mjs <ziel> <profil> "name|p=0.4024|1440|900"` nimmt Standbilder auf und liest die Konsole mit. Schalter: `?p=` (Stelle 0 bis 1), `&linie=`, `&paket=`, `&punkt=`, `?etage=08`; Abfrage `ohneskript` für die Fassung ohne Skript.
  - `node werkzeug/haus-echtlauf.mjs werkzeug/haus-echtlauf.json <ziel> <profil>` scrollt die ganze Fahrt, klickt Schalter, Karten, Dock und Menü und nennt Bildzeiten.
  - `node werkzeug/haus-pngdiff.mjs a.png b.png` vergleicht zwei Standbilder und zeigt, wo sie abweichen.

## Offen für Kevin
- Ratgeber lesen: Sie stehen unter Kevins Namen.
- Porträtfotos von Kevin und Malin würden „Über uns“, den Abend und die Autorenzeile stärken; bis dahin stehen Kürzel.
- LinkedIn-Profile oder eine LinkedIn-Firmenseite in `seo.same_as` eintragen. Das hilft Google und KI-Suchen, die Firma zuzuordnen.
- **Check und Erstgespräch über fokusinnovation.de (29.10., Zweig `fokus-check`):** Caddy reicht `/check`, `/api/check`, `/buchen/*`, `/api/buchung/*`,
  `/_next/*` und `/schriften/*` an die Anwendung durch, alles andere bleibt die statische Seite. Danach in MAKE OS:
  1. Markttraktion › Marketing › Innovations-Check: einschalten (braucht den Verantwortlichen unter Einstellungen › Datenschutz), „Name im Check“ = Fokus Innovation.
  2. Kalender › Buchungsseiten: eine Seite „Erstgespräch“ anlegen (30 Minuten, Verantwortlicher eingetragen), Link kopieren.
  3. Dieselbe Seite im Check als Buchungsseite für das Gespräch wählen.
  4. Den Pfad (`/buchen/<name>-<24 Hex>`, ohne Domain) in `makeinnovation/inhalt/seite.json › termin.link` eintragen, `node bauen.mjs`, hochladen.
     Der Bau bricht ab, wenn der Pfad eine andere Form hat. Solange `termin.link` leer ist, öffnet „Erstgespräch“ eine vorbereitete Mail.
  Solange der Check aus ist, antwortet `/check` mit „gibt es nicht“ — vor der Freigabe für Google muss er an sein.
- Rubrik „Im Fokus“ und Gratis-Seite fehlen bewusst: Es gibt dafür noch nichts Fertiges.

## Vorlagen: kurz direkt, lang per E-Mail (31.10.)
Kevin: „Die kleinen Sachen sind okay, aber die größeren brauchen eine E-Mail, damit wir denen das Ganze zuschicken können.“
- `node vorlagen.mjs [id …]` baut PDF/XLSX nach `dateien/vorlagen/` (NICHT öffentlich) und für lange Vorlagen die Vorschaubilder
  `assets/bild/vorlagen/<id>-titel.jpg` + `<id>-seite.jpg` (Seite aus `inhalt/vorlagen.json › vorschau_seite`, PDFKit über `werkzeug/pdfseiten.swift`, nur am Mac).
  `--nur-vorschau` erneuert nur die Bilder.
- `node bauen.mjs` verteilt: unter `fokus.json › kostenlos.vorlagen.per_mail_ab_seiten` Seiten → `assets/vorlagen/` (Download),
  ab dieser Seitenzahl → Repo-Ordner `unterlagen/` mit `katalog.json` (die App liefert sie nur über den Link aus der Mail, `/api/unterlage`).
  Lange Vorlagen bekommen die Seite `/kostenlos/vorlagen/<id>/` mit Formular (`js/unterlage.js`); ohne Antwort der App steht der Weg per E-Mail da.
- Übernehmen in den Upload-Stand: rsync wie bisher, zusätzlich `--exclude dateien/ --exclude werkzeug/`, und `unterlagen/` in den Repo-Ordner `unterlagen/`.
