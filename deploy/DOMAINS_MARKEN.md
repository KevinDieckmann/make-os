# makestudios.de und makerevenue.de einrichten (Stand 12.11.2026)

Kevin hat beide Domains am 12.11. gekauft, sie liegen bei IONOS. Vorbild ist fokusinnovation.de: erst **Vorschau mit Kennwort**,
für Suchmaschinen gesperrt; öffentlich erst auf Kevins Wort.

## Was im Repo vorbereitet ist (Branch `website-upload`)
- **Adressen der Familie** stehen an einer Stelle je Seite: `prototype/make-studios/familie.js`,
  `prototype/make-revenue/familie.js` und `prototype/fokus-innovation/inhalt/fokus.json › familie`.
  Auf dem eigenen Rechner führen die Verweise weiter zu den lokalen Vorschauen.
- **Auslieferung:** `compose.yml` bindet `prototype/make-studios` als `/srv/makestudios` und `prototype/make-revenue` als
  `/srv/makerevenue` ein (nur lesen). Quelle = Auslieferung, es gibt keinen Kopierschritt.
- **Caddy:** `deploy/caddy/Caddyfile` hat je Domain einen Block (www leitet um, Benutzer „Besucher“ + das gemeinsame Vorschau-Kennwort, `X-Robots-Tag: noindex`, strenge Köpfe, eigene 404-Seite). Arbeitsdateien (`*.mjs`, `*.md`, `seo.json`,
  `seiten.json`, `websites/daten.json`, `logo-entwuerfe/`, `beispiele/_vorlage/`) werden nie ausgeliefert.
- Die Seiten selbst bleiben `noindex` und `robots.txt` sperrt alles, bis in `seo.json` „oeffentlich“ auf `true` steht.

## Schritt 1 · IONOS (erledigt am 12.11.2026, je Domain gleich)
Stand 12.11.: Für beide Domains ist A `@` und A `www` auf `2.28.108.162` gesetzt. Beim Speichern hat IONOS die eigene Parkseite
(„Default Site“: alter A-Eintrag, AAAA-Eintrag und ein TXT-Eintrag `_dep_ws_mutex`) deaktiviert. Die Mail-Einträge (MX, SPF,
DKIM, DMARC, autodiscover) sind unverändert. Geprüft am IONOS-Nameserver: viermal `2.28.108.162`, kein AAAA.

Zum Nachschlagen, so war es einzutragen (IONOS › Domains & SSL › Domain wählen › DNS):

| Typ | Hostname | Wert | Hinweis |
|---|---|---|---|
| A | `@` | `2.28.108.162` | den vorhandenen A-Eintrag von IONOS ersetzen |
| A | `www` | `2.28.108.162` | neu anlegen (heute gibt es keinen) |
| AAAA | `@` | **löschen** | der IONOS-Eintrag `2001:8d8:…` zeigt auf die Parkseite; unser Server hat keine IPv6-Adresse im DNS. Bleibt er stehen, landen manche Besucher bei IONOS und das Zertifikat kann scheitern. |
| MX | | unverändert lassen | Mail bleibt bei IONOS |

Falls IONOS eine „Weiterleitung“ oder „Website-Baukasten“-Verbindung für die Domain angelegt hat: trennen, sonst überschreibt
IONOS die Einträge wieder.

Prüfen (am Mac, nach einigen Minuten bis zu einer Stunde):

```bash
dig +short A makestudios.de www.makestudios.de makerevenue.de www.makerevenue.de
```

Erwartet: viermal `2.28.108.162`. Und `dig +short AAAA makestudios.de makerevenue.de` liefert nichts.

## Schritt 2 · Hochladen (nur auf Kevins Wort)
1. `website-upload` nach `main` bringen (Push macht Kevin). Das Ausrollen zieht den Stand und startet die Container neu;
   wegen der zwei neuen Einbindungen wird der Caddy-Container dabei neu angelegt.
2. Auf dem Server (macht Kevin), Caddy NUR mit der Aurelia-Konfiguration prüfen und neu laden:

```bash
docker compose exec caddy caddy validate --config /etc/caddy-aurelia/Caddyfile --adapter caddyfile
```

```bash
docker compose exec caddy caddy reload --config /etc/caddy-aurelia/Caddyfile --adapter caddyfile
```

3. Caddy holt die Zertifikate von selbst, sobald die DNS-Einträge stimmen. Reihenfolge: **erst DNS, dann hochladen** (sonst
   versucht Caddy es vergeblich und wartet zwischen den Versuchen länger).

## Schritt 3 · Prüfen
- `https://makeinnovation.de`, `https://makestudios.de` und `https://makerevenue.de` fragen nach Benutzer und Kennwort, danach
  erscheint die Seite.
- `https://www.makestudios.de` leitet auf die Adresse ohne www; `https://fokusinnovation.de/preise/` leitet auf
  `https://makeinnovation.de/preise/`.
- `https://makestudios.de/seo.mjs` und `/seo.json` antworten 404.
- Filme laufen, die Beispielseite der Rösterei zeigt Becher und Tüte in 3D (prüft die strengen Köpfe).
- Auf makeinnovation.de laufen Check (`/check`), Buchung und Kontaktformular wie bisher.
- Eine erfundene Adresse zeigt die eigene 404-Seite.

## Das Dach zieht mit um (Kevin 12.11.: „Ja“)
- **makeinnovation.de** liefert jetzt die Website von MAKE Innovation aus (derselbe Ordner `fokusinnovation/`, dieselben Wege an
  die Anwendung für Check, Buchung, Newsletter, Unterlagen, Kontakt und Bausteine). **fokusinnovation.de** und beide www-Adressen
  leiten samt Pfad dorthin; Links aus alten Mails bleiben gültig. Am DNS ändert sich dafür nichts, beide Domains zeigen schon auf
  den Server.
- Die Seite ist mit der neuen Adresse gebaut (`prototype/fokus-innovation/inhalt/fokus.json › domain` und `› familie`, Branch
  `make-website`). In den gebauten Ordner kommt sie ohne Generatoren, Inhalte, Notizen und **ohne die Kauf-Unterlagen** in
  `dateien/` (die liefert nur die Anwendung aus):
  `node <make-website>/prototype/fokus-innovation/ausliefern.mjs <website-upload>/fokusinnovation` (kopiert wie bisher mit rsync und nimmt die Kommentare aus den ausgelieferten Stil- und Skriptdateien; nie mehr nur rsync)
- **Nach dem Hochladen in der Software umstellen (macht Kevin):** Überall, wo die Adresse der Website eingetragen ist
  (Newsletter-Einstellungen, Check, Unterlagen, Bausteine), `https://makeinnovation.de` statt der alten Adresse eintragen. Bis
  dahin funktionieren die Links in Mails weiter, weil die alte Adresse umleitet.

## Vorschau-Login (Kevin 12.11.: „auf jeder Seite einen kleinen Login, bis wir offiziell rausgehen“)
Alle drei Websites fragen Benutzer **Besucher** und dasselbe Kennwort ab. Das Kennwort steht nirgends im Repo, in der Caddyfile
steht nur der Hash (Wächter `tests/fokus-kennwort.test.ts`). Kennwort ändern: neuen Hash erzeugen (`htpasswd -niBC 12 Besucher`,
am Anfang `2y` durch `2a` ersetzen, base64) und in allen drei Blöcken ersetzen. Öffnen für alle: den Block `basic_auth` der
jeweiligen Domain löschen.

## Offen, bevor die Vorschau online geht
- **MAKE Revenue** wird gerade umgebaut (Tiefblau, neues Zeichen). Hochladen erst, wenn der Umbau abgenommen ist.
- **Betreiberin, Telefon, Anschrift** (Impressum, Daten für Suchmaschinen) und ob jede Domain ein eigenes Impressum bekommt.

## Später, bei der Freigabe für Suchmaschinen
`seo.json › oeffentlich: true`, `node seo.mjs`, in der Caddyfile `X-Robots-Tag` und `basic_auth` im Block der Domain entfernen,
Domains in der Google Search Console anmelden (je Domain eine Property), Sitemap einreichen, IndexNow-Schlüssel eintragen.
