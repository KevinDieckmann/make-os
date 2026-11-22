# Online-Gang makeinnovation.de (Stand 21.11.2026, nach der Endprüfung; liegt auch als Kopie im Werk-Ordner der Prüfung)

Diese Liste ist für den Tag, an dem die Seite öffentlich wird. Sie gilt für makeinnovation.de; makestudios.de und makerevenue.de gehen am selben Tag mit (Abschnitt 4). Alles unter „Auslieferung“ und „Server“ macht Kevin; vorher passiert nichts. Quellen: `prototype/fokus-innovation/` (Branch `haus-umbau`), Server-Konfiguration `deploy/caddy/Caddyfile` (Worktree `website-upload`).

## 0. Voraussetzungen (vorher klären, sonst wirken Formulare halb)
Die Seite ist statisch. Formulare, Check und Termin laufen in MAKE OS (die Anwendung hinter Caddy). Fällt etwas aus, zeigt die Seite freundlich den Weg per E-Mail (`js/app-wege.js`, `unterlage.js`, `bestellung.js`, Newsletter im Haus). Trotzdem vor dem Öffentlichmachen einschalten und anklicken:
1. **Innovations-Check** (`/check`): MAKE OS › Markttraktion › Marketing › Innovations-Check einschalten, Verantwortlicher unter Einstellungen › Datenschutz, „Name im Check“. Sonst antwortet `/check` mit „gibt es nicht“ und 75 Verweise der Seite führen ins Leere.
2. **Erstgespräch** (`/erstgespraech`): Buchungsseite „Erstgespräch“ (30 Minuten) in MAKE OS anlegen, Link in `makeinnovation/inhalt/seite.json › termin.link` (steht bereits auf `/erstgespraech`; die App leitet auf die gewählte Seite). 219 Verweise der Seite führen dorthin.
3. **Kontaktformular** (`/anfrage`, `/api/anfrage`): einschalten. Kontrolle: `curl -s https://makeinnovation.de/api/anfrage` muss `{"ok":true,"aktiv":true}` liefern. Aus: Die Seite fällt selbst auf die Mail `kevin@makeinnovation.de` zurück.
4. **Newsletter** (`/newsletter`, `/api/newsletter`) und **Unterlagen per E-Mail** (`/api/unterlage`, Absender) einschalten; **Bausteine bestellen** (`/api/bestellung`, `/api/baustein/laden`) nur, wenn die Bausteine verkauft werden sollen (Verkäufer und Bedingungen stehen im Impressum).
5. **Rechtstexte anwaltlich lesen** (Impressum, Datenschutz stehen als Hinweis, keine Rechtsberatung). Beide sind in der Sie-Form geschrieben, der Rest der Seite im Du: bewusst so gelassen, entscheidet Kevin.
6. Prüfen, ob Adresse und Sitz stimmen: Impressum und Firmendaten nennen Attilastraße 18, 12529 Schönefeld; mehrere Texte sagen „aus Berlin“, die strukturierten Daten „Sitz“ nur über die Adresse. Entscheidet Kevin.

## 1. Die Seite freischalten (Quelle, hier im Worktree)
1. `prototype/fokus-innovation/inhalt/fokus.json`: unter `seo` den Wert `"oeffentlich": false` auf `true` setzen. Das eine Feld öffnet: `<meta name="robots">` auf `index, follow, …` (Podcast und 404 bleiben `noindex`), `robots.txt` (`Allow: /` plus Sitemap), `sitemap.xml`, `llms.txt`/`llms-full.txt`.
2. Optional vorher eintragen (nichts erfinden, leere Angaben entfallen von selbst):
   - `seo.same_as`: LinkedIn-Firmenseite und Profile von Kevin und Malin (hilft Google und KI-Suchen bei der Zuordnung).
   - `makeinnovation/inhalt/seite.json › kontakt.telefon`: kommt dann in die strukturierten Daten (`telephone`).
   - `anbieter.make.ustid`, sobald vorhanden: kommt als `vatID` in die strukturierten Daten und ins Impressum.
3. `cd prototype/fokus-innovation && node bauen.mjs`. Erwartet: „72 Seiten“ (davon 64 in der Sitemap und indexierbar), „Platzhalter für Kevin: 0“, keine Zeile „REGEL:“. Im Probelauf geprüft: Sitemap = alle indexierbaren Seiten, robots.txt `Allow: /`, nur 404 und Podcast mit `noindex`, kein `localhost`. Bei freigegebener Seite bricht der Bau ab, wenn irgendwo `localhost` steht.
4. Nur wenn der Prüfer ein Vorschaubild vermisst: `node bilder.mjs` (braucht Chrome, läuft lokal).
5. Neue Fotos oder Vorlagenblätter: `node bildvarianten.mjs` (legt die WebP-Varianten neben die JPG; die jetzigen liegen schon da), danach `node bauen.mjs`.
6. Kontrolle (lokal): `node werkzeug/csp-server.mjs 3401` starten, `curl -s localhost:3401/robots.txt`, Startseite im Browser mit Verlauf leeren, danach wieder beenden.

## 2. Auslieferung (nur auf Kevins Wort)
1. Gebauten Stand in den Auslieferungsordner bringen (nicht per einfachem rsync; `ausliefern.mjs` nimmt die Arbeitskommentare aus Stilen und Skripten heraus und lässt `haus/`, `werkzeug/`, `inhalt/`, `*.mjs`, `*.md`, `dateien/`, `assets/logo-vorschlaege/` weg):
   `node prototype/fokus-innovation/ausliefern.mjs <main-checkout>/fokusinnovation`
   `rsync -a --delete unterlagen/ <main-checkout>/unterlagen/`
2. Dort committen, auf `main` pushen (macht Kevin). Die GitHub Action baut und rollt aus (rund 5 Minuten, die alte Version läuft solange).
3. Wichtig: Die Seite liegt an der Wurzel (`/`). Es gibt keine Verweise auf `/haus/` mehr (geprüft), die Vorschau-Kopie unter `/haus/` wird nicht gebraucht.

## 3. Server: Caddyfile (`deploy/caddy/Caddyfile`, Aurelia-Konfiguration)
Reihenfolge: erst die Dateien ausliefern (Abschnitt 2), dann Caddy öffnen. Sonst steht die neue Seite eine Weile hinter dem Kennwort bereit, und Besucher sehen die alte.
1. Im Block `makeinnovation.de { … }` den ganzen Block `basic_auth bcrypt "MAKE Innovation" { Besucher … }` samt Kommentar löschen. Im Fehlerblock (`handle_errors`) kann `@ohne_kennwort` (401) bleiben (wird nie ausgelöst) oder fallen.
2. Im Block `(fokus_koepfe)` die Zeile `X-Robots-Tag "noindex, nofollow"` löschen. Die gleiche Zeile in den drei App-Handlern (`@app`, `@kontaktformular`, `@bausteine`) kann stehen bleiben: Dort liegen Check, Formulare und Schnittstellen, die nicht in die Suche sollen.
3. Empfohlen, klein: fehlende Cache-Köpfe ergänzen (Block `handle { … }` unter `@stile`):
   - `/assets/team/*`, `/assets/vorlagen/*` und `/site.webmanifest` bekommen heute keine Vorgabe (Browser raten). Zum Beispiel `@statisch path /assets/team/* /assets/vorlagen/* /site.webmanifest` mit `Cache-Control "public, max-age=86400"`.
   - Optional: Stile, Skripte und Bilder tragen im Namen den Stempel `?v=…`; dafür ginge `max-age=31536000, immutable`. Heute: ein Tag.
4. Tests im Repo anpassen (beide erwarten heute Kennwort und `noindex`): `tests/caddy-buchung-koepfe.test.ts` (Zeilen um 101, 117, 129 für `basic_auth` und `X-Robots-Tag` bei makeinnovation.de) und `tests/fokus-kennwort.test.ts`.
5. Prüfen und neu laden (nur mit der Aurelia-Konfiguration, wie in `deploy/DOMAINS_MARKEN.md`):
   `docker compose exec caddy caddy validate --config /etc/caddy-aurelia/Caddyfile --adapter caddyfile`
   `docker compose exec caddy caddy reload --config /etc/caddy-aurelia/Caddyfile --adapter caddyfile`
6. Was schon stimmt (nichts zu tun): `encode zstd gzip` für den ganzen Block; Seiten `Cache-Control: no-cache` (mit ETag/Last-Modified aus `file_server`), Schriften 30 Tage `immutable`, `/css/*`, `/js/*`, `/assets/bild/*`, `/favicon.ico` ein Tag; HSTS, CSP ohne Fremdquellen, `frame-ancestors 'none'`, `form-action 'none'`; `*.md` und `*.mjs` werden nie ausgeliefert; 404 mit eigener Seite; `fokusinnovation.de` und `www` leiten mit 301 um. Nicht gesetzt: Brotli (Caddy liefert ohne Zusatz nur zstd und gzip; für diese Seite ausreichend).

## 4. makestudios.de und makerevenue.de (am selben Tag)
- Je Seite: in `prototype/make-studios/seo.json` und `prototype/make-revenue/seo.json` `oeffentlich` auf `true`, `node seo.mjs` (laut Kopfkommentar im Caddyfile), prüfen, ausliefern (die Ordner werden direkt gemountet, kein Kopierschritt).
- Caddyfile: `basic_auth` in den Blöcken `makestudios.de` und `makerevenue.de` löschen. `X-Robots-Tag "noindex, nofollow"` steht im gemeinsamen Block `(marke_koepfe)`: eine Zeile gilt für beide. Auch dort Tests anpassen.
- Die Verweise von makeinnovation.de auf beide Seiten sind Wurzel-Adressen mit https (`https://makestudios.de/`, `https://makerevenue.de/`) aus `inhalt/fokus.json › familie`. Zeigt eine der Seiten beim Freischalten noch Kennwort, laufen die Verweise ins Leere: deshalb alle drei am selben Tag.

## 5. Nach dem Freischalten prüfen (5 Minuten, Mac)
```
curl -sI https://makeinnovation.de/ | egrep -i "HTTP|x-robots|content-encoding|cache-control"
curl -s  https://makeinnovation.de/robots.txt
curl -s  https://makeinnovation.de/sitemap.xml | head -5
curl -sI https://makeinnovation.de/podcast/ | head -1                      # 200, die Seite trägt noindex im HTML
curl -s  https://makeinnovation.de/api/anfrage                              # {"ok":true,"aktiv":true}
curl -sI https://makeinnovation.de/gibt-es-nicht | head -1                  # 404
curl -sI -H 'Accept-Encoding: gzip' https://makeinnovation.de/css/fokus.css | egrep -i "content-encoding|cache-control"
```
Erwartet: kein `X-Robots-Tag: noindex` auf Seiten, `Content-Encoding: zstd` oder `gzip`, `robots.txt` mit `Allow: /`. Danach die Startseite im Browser öffnen (leerer Verlauf: Fahrt durchs Haus, danach „Fahrt überspringen“ und Neuladen: die Kurz-Startseite).

## 6. Danach außerhalb der Website (Kevin)
(`GOOGLE_SCHRITTE.md` verweist seit der Endprüfung hierher; gemeint ist makeinnovation.de mit 64 indexierbaren Seiten.)
1. **Google Search Console**: Property „Domain“ `makeinnovation.de` anlegen, den TXT-Eintrag bei IONOS setzen, bestätigen. Sitemap `https://makeinnovation.de/sitemap.xml` einreichen, Startseite mit der URL-Prüfung „Indexierung beantragen“. Für makestudios.de und makerevenue.de je eine eigene Property.
2. **Bing Webmaster Tools**: aus der Search Console importieren (ChatGPT-Suche und Copilot lesen den Bing-Index). IndexNow-Schlüssel liegt schon unter `/9e808dbefe5dc092174a334135f7d894.txt`.
3. **Google-Unternehmensprofil** (business.google.com): als Dienstleister mit Einzugsgebiet anlegen; ist die Adresse in Schönefeld kein Ort für Kundenbesuche, die Adresse nicht öffentlich zeigen. Bestätigung kommt per Postkarte oder Video.
4. **LinkedIn-Firmenseite** und die zwei Profile: Link zu makeinnovation.de eintragen und die Adressen für `seo.same_as` liefern (dann in `fokus.json` eintragen, bauen, ausliefern).
5. **Beobachten**: nach einer Woche in der Search Console auf Abdeckung, Fehler bei strukturierten Daten und Kerndaten zur Seitenerfahrung schauen; `site:makeinnovation.de` bei Google.
6. **Fokus Abend und Podcast**: Der Podcast bleibt „eröffnet bald“ (`noindex`, nicht in Sitemap, nicht im Menü). Wird er freigegeben: `noindex: true` an der Seite in `bauen.mjs` entfernen, Menü und Sitemap ergänzen, neu bauen.
7. **Referenzen und Gründungsgeschichte** sind bewusst leer. Sobald Texte da sind: Gründungsgeschichte unter `inhalt/fokus.json › ueber_uns.gruendung.text` (Liste von Absätzen, Du-Form) eintragen, dann erscheint der Abschnitt von selbst.

## 7. Zusätze der Endprüfung (21.11.)
Fertige Zeilen für das Caddyfile (Block `handle { … }` unter `@stile`, ersetzen die Empfehlung unter 3.3):
```
@statisch path /assets/team/* /assets/vorlagen/* /site.webmanifest /llms.txt /llms-full.txt
header @statisch Cache-Control "public, max-age=86400"
```
Gemessen am Prüfserver mit denselben Köpfen wie `(fokus_koepfe)`: keine Meldung der Sicherheitsregel, keine gesperrte Datei verlinkt, `/wissen` und `/abend` leiten um, `*.md`, `*.mjs`, `haus/`, `inhalt/` liefern 404.

Von Kevin in der Anwendung vorher anzuklicken (nicht prüfbar ohne Server):
1. `/erstgespraech`: führt auf die Buchungsseite? (219 Verweise)
2. `/check` mit beiden Checks (Innovations-Check, Sichtbarkeits- und Vertriebs-Check): Start, Ergebnis, Termin danach.
3. `/anfrage` und `/api/anfrage`: Formular absenden, Mail kommt an; `curl -s https://makeinnovation.de/api/anfrage` zeigt `{"ok":true,"aktiv":true}`.
4. Newsletter: Menü › Community › Newsletter öffnet `/?fahrt=1#newsletter`; die Seite springt zu Etage 5 mit dem Formular (geprüft für neue und wiederkehrende Besucher). Absenden, Bestätigungsmail, Abmelden.
5. Unterlagen per E-Mail (`/api/unterlage`), und nur wenn sie verkauft werden: Bausteine (`/api/bestellung`). Die Baustein-Preise (49 bis 590 €) stehen nicht in der einen Preisliste `inhalt.json`, sondern in `inhalt/bausteine.json`; vor dem Öffentlichmachen entscheiden: dort lassen oder in die Preisliste ziehen.
