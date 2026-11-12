# makeinnovation.de · gebaute Website von MAKE Innovation (Vorschau seit 26.10.2026; bis 12.11. unter fokusinnovation.de)

Dieser Ordner ist **gebaut**, nicht von Hand geschrieben. Quelle und Generator liegen im Prototyp
`prototype/fokus-innovation/` auf dem Zweig `innovations-check` (Texte in `inhalt/fokus.json`, Angebote aus `makeinnovation/inhalt/*.json`).

So kommt eine neue Fassung hierher:
1. Dort bauen: `node prototype/fokus-innovation/bauen.mjs` (prüft die Regeln gleich mit). Neue Seiten oder geänderte Titel: vorher
   `node prototype/fokus-innovation/bilder.mjs` (Vorschaubilder und Icons, braucht Chrome).
2. Hierher ausliefern, ohne Generatoren, Inhalte und Notizen:
   `node prototype/fokus-innovation/ausliefern.mjs <dieser Ordner>`
   Das Skript kopiert wie bisher (rsync, ohne `dateien/`, `werkzeug/`, Logo-Vorschläge) und nimmt danach alle Kommentare aus den
   ausgelieferten Stil- und Skriptdateien. Die Quelle behält ihre Arbeitsnotizen, im Netz stehen sie nicht. Nie mehr nur rsync.
3. Auf `main` bringen. Caddy liefert den Ordner unter makeinnovation.de aus; fokusinnovation.de leitet dorthin (`deploy/caddy/Caddyfile`, Mount in `compose.yml`).

Für Suchmaschinen und KI-Suchen (27.10.) trägt jede Seite Titel, Beschreibung, Canonical, Vorschaubild (`assets/bild/og/`) und
strukturierte Daten (JSON-LD); dazu `sitemap.xml`, `llms.txt`, `llms-full.txt`, `site.webmanifest` und die IndexNow-Datei (`<schlüssel>.txt`).

Vorschau: Suchmaschinen sperrt die Seite dreifach aus, über `X-Robots-Tag`, `<meta name="robots" content="noindex">` und `robots.txt`.
Freischalten erst auf Kevins Wort: `seo.oeffentlich` im Prototyp, neu bauen, `X-Robots-Tag` im Caddyfile entfernen (Schritte: `GOOGLE_SCHRITTE.md` im Prototyp).
Die Knöpfe zum Innovations-Check führen auf `/check`. Das geht erst, wenn der Check online ist; bis dahin kommt die 404-Seite (Kevin 26.10.: „machen wir dann fertig, wenn es so weit ist“).
