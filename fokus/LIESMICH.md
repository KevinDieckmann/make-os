# Event-Seite fokusinnovation.de — Fokus Innovation, ein Format von Make.One

**Fokus Innovation** ist die Event-Reihe unter **Make.One** — das Leit-Format der Innovations-Abende (Kevin, 03.10.2026):
ausgewählte Orte, kleine Runden, junge und erfahrene Entscheider an einem Tisch, in Berlin, Hamburg, Bielefeld, Köln,
München und Dresden (Dresden seit 04.10.). Make.One bleibt das Netzwerk; Absender ist **MAKE Innovation · eine Marke der KEMARIS Innovation GmbH**.

Statische Seite wie `website/` (HTML + eine CSS-Datei + zwei kleine Skripte, keine Cookies, kein Tracking, kein Speicher im
Browser, keine Formulare, Schriften selbst gehostet). Stand **v1 (03.10.2026)**, **lokal gebaut — nicht online**. Online geht
sie nur auf Kevins Wort (Abschnitt „Online-Gang“ unten). Anrede **„Du“** wie auf makeinnovation.de; Impressum und
Datenschutz förmlich („Sie“).

## Aufbau der Startseite (`index.html`)

| Abschnitt | Inhalt |
|---|---|
| Kopf | Zeichen (Knoten mit Strichen) + „FOKUS INNOVATION“, Navigation Idee · Ein Abend · Städte · Teilnahme, Knopf „Teilnahme anfragen“ (am Handy „Anfragen“) |
| `#start` Held | „Ein Format von Make.One“, H1 **Fokus Innovation**, Unterzeile „Das Innovations-Format von Make.One.“, ein Satz, zwei Knöpfe. Dahinter die **Lichtfäden** (Strahl v3, unten): Granat läuft von links in den Knoten, Smaragd verlässt ihn nach rechts (wie die Synapse im Logo) |
| `#film` | Platz für den Film (`marketing/film/DREHBUCH.md`): 16:9-Rahmen mit Standbild (`assets/film/standbild.svg`), Bildunterschrift „Der Film … folgt“ |
| `#idee` Idee & Haltung | „Innovation braucht Umsetzung. Und Sichtbarkeit.“ — Umsetzung vor Bühne · Generationen an einem Tisch · Ausgewählte Orte, kleine Runden |
| `#abend` So läuft ein Abend | Ankommen · Impuls · Gespräche am Tisch · Ausklang — bewusst allgemein („Ablauf, Ort und Gäste stimmen wir für jede Stadt eigens ab“) |
| `#staedte` Städte | „Aus Berlin in sechs Städte.“ — Liste Berlin · Hamburg · Bielefeld · Köln · München · Dresden mit **„Termin in Planung“** und je einem Mail-Link „Für … anfragen“; daneben die **Deutschlandkarte** (echte Koordinaten, Fäden von Berlin aus) |
| `#teilnahme` | „Teilnahme anfragen.“ — **eine** vorbereitete Mail (`#teilnahme-link`, Betreff „Fokus Innovation – Teilnahme“, Text: Name, Unternehmen und Rolle, Stadt, woran ich arbeite); rechts, was in die Mail gehört |
| `#make-one` Absender | „Ein Format von Make.One.“ — Make.One, MAKE Innovation, Link auf makeinnovation.de, MAKE-Logo |
| Fuß | „Ein Format von Make.One · MAKE Innovation · eine Marke der KEMARIS Innovation GmbH“, Impressum · Datenschutz · makeinnovation.de, Mail |

Keine erfundenen Termine, Zahlen, Teilnehmer, Partner oder Preise — `pruefen.mjs` hält das fest (Datumsangaben, Mengen wie
„40 Gäste“, Preiswörter fallen auf).

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `impressum.html`, `datenschutz.html`, `404.html` | Seiten (404 mit absoluten Pfaden, erscheint unter jeder Adresse) |
| `css/fokus.css` | eigene, ruhige Gestaltung; die **geteilten Tokens** im `:root` sind dieselben wie in `website/css/seite.css` (Prüfung vergleicht) |
| `js/lichtfaeden.js` | Zeichner — **erzeugt** aus `lib/lichtfaeden/band.ts` + `zeichnen.ts` (derselbe Weg wie `website/js/lichtfaeden.js`), nie von Hand ändern |
| `js/fokus-faeden.js` | die Fäden im Held (Knoten-Lage aus dem SVG `.knoten-gross`), Strahl v3 über den gemeinsamen Zeichner; pausiert außerhalb des Bildes, `prefers-reduced-motion` = Standbild; liest, speichert, sendet nichts |
| `assets/fonts/` | Archivo + Public Sans — **Byte für Byte** aus `website/assets/fonts/` |
| `assets/logo/make-quer.svg` | MAKE-Logo (quer) — **Kopie** von `website/assets/logo/quer.svg` |
| `assets/film/standbild.svg` | Standbild des Films (erzeugt) |
| `favicon.svg` | der Knoten (erzeugt) |
| `robots.txt` | Vorschau: `Disallow: /` |
| `pruefen.mjs` | Freigabe-Prüfung (nie ausgeliefert) |
| `LIESMICH.md` | diese Datei (nie ausgeliefert) |

**Nichts kopieren und vergessen:** Schriften, MAKE-Logo, Zeichner, Karte, Standbild und Favicon erzeugt
`node scripts/fokus-seite.mjs` aus EINER Quelle (Prüfen: `node scripts/fokus-seite.mjs --pruefen`; Wächter
`tests/fokus-seite.test.ts`). Die Karte steht inline in `index.html` zwischen `KARTE_ANFANG` und `KARTE_ENDE` — Städte,
Koordinaten und Umriss stehen im Skript (`STAEDTE`, `UMRISS`). Ändert jemand `lib/lichtfaeden/*`, das Logo oder die
Schriften auf makeinnovation.de: danach `node scripts/lichtfaeden-website.mjs` UND `node scripts/fokus-seite.mjs`.
Das Impressum übernimmt den Pflicht-Block von `website/impressum.html` wörtlich (die Prüfung vergleicht ihn).

## Prüfen

`node fokus/pruefen.mjs` → **„freigabefähig“** nur ohne Fehler und ohne Platzhalter. Er nutzt die Regeln von
`website/pruefen.mjs` (Sperrliste, Firmierung, Wortregeln, Preise, Skript- und Tracker-Muster) und prüft dazu: Absender
„Ein Format von Make.One“ auf jeder Seite, die sechs Städte mit „Termin in Planung“ in Liste und Karte, genau einen Hauptweg
`#teilnahme-link`, Mails nur an die MAKE-Adresse mit Betreff „Fokus Innovation …“, externe Links nur zu makeinnovation.de,
keine Formulare, keine Termine/Mengen/Preise, gemeinsame Dateien gleich wie in `website/`, ausgeliefert < 250 KB (heute ~ 125 KB).

Lokal ansehen: eigener statischer Server (z. B. `python3 -m http.server 3097 -d fokus` über einen Eintrag in
`.claude/launch.json`) oder `fokus/index.html` direkt im Browser öffnen.

## Die Lichtfäden im Held — Strahl v3 (04.10.2026)

Dieselben Effekte wie der Strahl in der App (DESIGN_STANDARD.md › Lichtfäden), alles aus dem gemeinsamen Zeichner `js/lichtfaeden.js`
(`front`, `punkte`, `frans`, `glanzPuffer`) — `js/fokus-faeden.js` legt nur Leitkurven, Farben und Zeitpunkte fest:

| Effekt | Umsetzung |
|---|---|
| Aufbau beim Laden | Eine Front läuft ab 0,15 s in 1,9 s (`LICHTFAEDEN.aufbau`) von links nach rechts über den Held; die Spitzen leuchten, ein leises Licht in Bündelfarbe läuft voraus. Granat erreicht den Knoten, während er einblendet (CSS 0,2–1,4 s); dort leuchtet ein Schein kurz auf, dann wächst Smaragd hinaus. |
| Fließen | Wellen und Lichtpunkte wandern links → rechts (Zeitrichtung); Lichtpunkte an jedem 2. Faden (Handy: jedem 3., Abstand 14 px). |
| Glühen | Schein-Puffer (Stärke 0,75, Handy 0,55) — am Knoten, wo die Fäden eng zusammenlaufen; dazu ein ruhiger Schein um den Knoten (wie HEUTE im Strahl). |
| Zukunft | Rechts vom Knoten franst Smaragd zum Rand hin leicht aus (bis 0,75, Handy 0,55). |
| Lesbarkeit | Unter der Textspalte (Rechner) leuchten die Fäden nur ~62 % — Kontrast der Texte gemessen unverändert. |
| Ruhe | „Bewegung reduzieren“: Standbild ohne Aufbau; Lauf pausiert außerhalb des Bildes und im verborgenen Tab. |

Gemessen (04.10., headless Chrome): 60 fps, keine langen Aufgaben, ≈ 1,5 ms Skript je Bild am Rechner. Der JavaScript-Wert für „unendlich“ steht
als fremder Name auf der Sperrliste der Prüfung — im Skript steht deshalb `null` für „keine Front“.

## Offene Platzhalter (Stand 03.10.2026)

- **Datenschutz:** AV-Vertrag mit Hetzner bestätigt? · AV-Vertrag mit Google (Cloud Data Processing Addendum) bestätigt? ·
  Abschnitt „Teilnahme an einem Abend“ (Gästeliste, Fotos, Einladungen) anwaltlich gegenlesen.
- Die beiden AV-Fragen sind dieselben wie auf makeinnovation.de — einmal klären, an beiden Stellen löschen.

## Bitte zusätzlich prüfen (Kevins Entscheidung)

- Texte im Held, „Idee & Haltung“ und „Ein Abend“ (vier allgemeine Teile, keine Uhrzeiten).
- „Fokus Innovation ist eine Runde auf Einladung“ und „Die Gäste laden wir persönlich ein“ — passt das zu eurem Vorgehen?
- Karte: vereinfachter Umriss (Festland, Rügen/Usedom angedeutet), Städte an echten Koordinaten; keine Grenzkarte.
- Der Film fehlt noch; das Standbild ist ein ruhiger Platzhalter (Drehbuch Szene 4). Einbinden später als `<video>` mit
  `preload="none"`, `poster` = Standbild, ohne Autoplay bei „Bewegung reduzieren“, Datei vom eigenen Server (CSP um
  `media-src 'self'` ergänzen).

## Online-Gang (erst auf Kevins Wort — Domain ist gekauft)

### 1 · DNS bei IONOS (Domain fokusinnovation.de)
In IONOS › Domains & SSL › fokusinnovation.de › DNS:
1. **A-Record** `@` → `2.28.108.162` (TTL 1 Stunde). Vorhandene A-/AAAA-Records für `@` (Parkseite von IONOS) löschen.
2. **A-Record** `www` → `2.28.108.162` (oder CNAME `www` → `fokusinnovation.de`).
3. Keinen AAAA-Record setzen, solange der Server keine IPv6 in Caddy bedient (sonst scheitert die Zertifikatsprüfung über IPv6).
4. MX-/Mail-Einträge nicht anfassen (die Seite schickt keine Mails; Kontakt bleibt hello@makeinnovation.de).
5. Prüfen: `dig +short fokusinnovation.de` und `dig +short www.fokusinnovation.de` → `2.28.108.162`.

### 2 · Ordner in den Caddy-Container (compose.yml, Dienst `caddy`)
Wie `website/`: unter `volumes:` zusätzlich `- ./fokus:/srv/fokus:ro`.

### 3 · Caddy-Block (VORSCHLAG — `deploy/caddy/Caddyfile` ist NICHT geändert)
Unter den makeinnovation.de-Block setzen; die Köpfe sind dieselben wie bei makeinnovation.de (`landingpage_koepfe`, mit
`X-Robots-Tag: noindex, nofollow` als Vorschau):

```caddyfile
# ─── fokusinnovation.de + www — Event-Seite „Fokus Innovation“ (Ordner fokus/) ─────────────────────────
# VORSCHAU wie makeinnovation.de: noindex über landingpage_koepfe + fokus/robots.txt (Disallow).
www.fokusinnovation.de {
	header -Server
	redir https://fokusinnovation.de{uri} 301
}
fokusinnovation.de {
	root * /srv/fokus
	encode zstd gzip
	import landingpage_koepfe
	# Arbeitsdateien werden nie ausgeliefert (wie NICHT_OEFFENTLICH in fokus/pruefen.mjs).
	@intern path /LIESMICH.md /pruefen.mjs *.md *.mjs
	respond @intern 404
	@seiten path / /*.html
	header @seiten Cache-Control "no-cache"
	@schriften path /assets/fonts/*
	header @schriften Cache-Control "public, max-age=2592000, immutable"
	@stile path /css/* /js/* /favicon.svg /assets/logo/* /assets/film/*
	header @stile Cache-Control "public, max-age=86400"
	file_server {
		hide LIESMICH.md pruefen.mjs
	}
	handle_errors {
		root * /srv/fokus
		import landingpage_koepfe
		rewrite * /404.html
		file_server
	}
}
```

Die CSP aus `landingpage_koepfe` (`default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; …`) passt
ohne Änderung; erst für den Film kommt `media-src 'self'` dazu. HSTS ohne `includeSubDomains` (wie makeinnovation.de).
Den Wächter `tests/caddy-buchung-koepfe.test.ts` dann um den neuen Block ergänzen (Köpfe, `root * /srv/fokus`, www-301).

### 4 · Ausrollen und prüfen
1. `node fokus/pruefen.mjs` → freigabefähig (Platzhalter gefüllt), Kevin hat die Seite gesehen.
2. Hochladen nur auf Kevins Wort (`entwicklung` → `main`), danach auf dem Server
   `docker compose up -d caddy` (neuer Ordner im Container) und
   `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` + `… caddy reload …`.
3. `curl -sI https://fokusinnovation.de` → 200 mit `content-security-policy` und `x-robots-tag: noindex, nofollow`;
   `curl -sI https://www.fokusinnovation.de` → 301 auf `https://fokusinnovation.de/`.
4. Auf makeinnovation.de im Make.One-Kapitel (`#fokus-innovation`) den Link „Zu Fokus Innovation“ setzen und
   `https://fokusinnovation.de` in `website/pruefen.mjs` als erlaubten externen Link eintragen.
5. **Vorschau beenden** erst, wenn beworben wird: `X-Robots-Tag` aus dem Block, `fokus/robots.txt` öffnen, die
   `noindex`-Meta-Tags streichen (die Prüfung verlangt sie nur, solange `robots.txt` sperrt).

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind aus dem tatsächlichen Verhalten der Seite
> abgeleitet (Stand Oktober 2026) und vor der Freigabe von einer fachkundigen Person zu prüfen.
