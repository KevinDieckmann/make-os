# fokusinnovation.de · gebaute Website (Vorschau seit 26.10.2026)

Dieser Ordner ist **gebaut**, nicht von Hand geschrieben. Quelle und Generator liegen im Prototyp
`prototype/fokus-innovation/` auf dem Zweig `innovations-check` (Texte in `inhalt/fokus.json`, Angebote aus `makeinnovation/inhalt/*.json`).

So kommt eine neue Fassung hierher:
1. Dort bauen: `node prototype/fokus-innovation/bauen.mjs` (prüft die Regeln gleich mit).
2. Hierher kopieren, ohne Generator, Inhalte und Notizen:
   `rsync -a --delete --exclude bauen.mjs --exclude inhalt/ --exclude '*.md' prototype/fokus-innovation/ fokusinnovation/`
3. Auf `main` bringen. Caddy liefert den Ordner unter fokusinnovation.de aus (`deploy/caddy/Caddyfile`, Mount in `compose.yml`).

Vorschau: Suchmaschinen sperrt die Seite dreifach aus, über `X-Robots-Tag`, `<meta name="robots" content="noindex">` und `robots.txt`.
Die Knöpfe zum Innovations-Check führen auf `/check`. Das geht erst, wenn der Check online ist; bis dahin kommt die 404-Seite (Kevin 26.10.: „machen wir dann fertig, wenn es so weit ist“).
