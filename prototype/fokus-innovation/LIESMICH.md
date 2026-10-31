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
rsync -a --delete --exclude '*.mjs' --exclude inhalt/ --exclude '*.md' prototype/fokus-innovation/ <main-checkout>/fokusinnovation/
```

3. Dort committen und auf `main` pushen, nur auf Kevins Wort. Die GitHub Action rollt es aus.

## Gestaltung: seriöse Agentur statt Tech-Bude
- Papier und Tinte, eine Schrift (Schibsted Grotesk), Haarlinien statt Kartenwände. Farbe kommt nur aus dem Logo.
- Der Faden (Heute → Mit uns → Danach) ist das wiederkehrende Bild.
- Die Ratgeber sind ruhige Leseseiten: links das Inhaltsverzeichnis, rechts der Text in einer angenehmen Zeilenlänge.
- Der Film der Startseite erzählt den Gründer, der sich um alles kümmert. Das Erklärvideo erzählt dieselbe Story ([ERKLAERVIDEO_PROMPT.md](ERKLAERVIDEO_PROMPT.md)).
- Die Seite wackelt beim Laden nicht (CLS 0). Die Schrift lädt mit `font-display: optional` und Vorladen.

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
