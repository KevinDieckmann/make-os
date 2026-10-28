# fokusinnovation.de · gebaute Website (Vorschau seit 26.10.2026)

Dieser Ordner ist **gebaut**, nicht von Hand geschrieben. Quelle und Generator liegen im Prototyp
`prototype/fokus-innovation/` auf dem Zweig `innovations-check` (Texte in `inhalt/fokus.json`, Angebote aus `makeinnovation/inhalt/*.json`).

So kommt eine neue Fassung hierher:
1. Dort bauen: `node prototype/fokus-innovation/bauen.mjs` (prüft die Regeln gleich mit). Neue Seiten oder geänderte Titel: vorher
   `node prototype/fokus-innovation/bilder.mjs` (Vorschaubilder und Icons, braucht Chrome).
2. Hierher kopieren, ohne Generatoren, Inhalte und Notizen:
   `rsync -a --delete --exclude '*.mjs' --exclude inhalt/ --exclude '*.md' prototype/fokus-innovation/ fokusinnovation/`
3. Auf `main` bringen. Caddy liefert den Ordner unter fokusinnovation.de aus (`deploy/caddy/Caddyfile`, Mount in `compose.yml`).

Für Suchmaschinen und KI-Suchen (27.10.) trägt jede Seite Titel, Beschreibung, Canonical, Vorschaubild (`assets/bild/og/`) und
strukturierte Daten (JSON-LD); dazu `sitemap.xml`, `llms.txt`, `llms-full.txt`, `site.webmanifest` und die IndexNow-Datei (`<schlüssel>.txt`).

Vorschau: Suchmaschinen sperrt die Seite dreifach aus, über `X-Robots-Tag`, `<meta name="robots" content="noindex">` und `robots.txt`.
Freischalten erst auf Kevins Wort: `seo.oeffentlich` im Prototyp, neu bauen, `X-Robots-Tag` im Caddyfile entfernen (Schritte: `GOOGLE_SCHRITTE.md` im Prototyp).
Die Knöpfe zum Innovations-Check führen auf `/check`. Das geht erst, wenn der Check online ist; bis dahin kommt die 404-Seite (Kevin 26.10.: „machen wir dann fertig, wenn es so weit ist“).
