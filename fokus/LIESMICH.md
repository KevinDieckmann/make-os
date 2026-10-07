# Event-Seite fokusinnovation.de — Fokus Innovation, ein Format von Make.One

**Fokus Innovation** ist die Event-Reihe unter **Make.One** — Abende in kleiner Runde, junge und erfahrene Entscheider an einem
Tisch, in Berlin (Ausgangspunkt), Hamburg, Bielefeld, Köln, München und Dresden. Make.One bleibt das Netzwerk; Absender ist
**MAKE Innovation · eine Marke der KEMARIS Innovation GmbH**.

Statische Seite wie `website/` (HTML + zwei CSS-Dateien + ein kleines eigenes Skript, keine Cookies, kein Tracking, kein Speicher im
Browser, keine Formulare, Schriften selbst gehostet). Stand **„Klar 2“ (07.10.2026)**, **lokal gebaut — nicht online**. Anrede
**„Du“** wie auf makeinnovation.de; Impressum und Datenschutz förmlich („Sie“). Online geht sie nur auf Kevins Wort
(Abschnitt „Online-Gang“ unten).

## „Klar 2“ — dieselbe Gestaltungsgrundlage wie makeinnovation.de (Kevin 07.10.)

„Wir wollen innovativ UND seriös wirken. Wir haben auch in [unserer Software] keine Spielereien — das soll sich auch so durchziehen.“
Die Showreel-Fassung („Klar“, 05.10.: Spur mit Bühne, WebGL-Tafel, Karte aus Lichtpunkten, Buchstaben-Bewegung, Verlauf im Schluss) ist
entfernt. Die Seite ist eine normale Dokument-Seite auf **derselben Grundlage** wie makeinnovation.de: `css/seite.css` ist eine
**Byte-Kopie** von `website/css/seite.css` (Tokens, Kopf, Knöpfe, Abschnitte, Index, Schritte, Einträge, dunkler Schlussakt, Fuß,
Rechtstexte). Seitenspezifisch ist nur `css/fokus.css` (setzt keine Tokens). Gestaltungsplan, Farben, Typo-Skala und Raster:
`website/LIESMICH.md` › „Klar 2 (07.10.)“.

**Hell → dunkel:** Papier mit dunkler Schrift, EIN dunkler Schlussakt (Städte + Teilnahme), der in den dunklen Fuß übergeht. Kein Licht als
Dekoration — die ruhige **Deutschlandkarte** (SVG, Fäden von Berlin in Granat und Smaragd) ist die eine Grafik, und sie trägt Inhalt.
Keine Animation, nichts hängt am Scrollen; jeder Abschnitt ist ohne Skript und bei „Bewegung reduzieren“ vollständig lesbar.

| Abschnitt | Inhalt |
|---|---|
| **Einstieg** (Papier) | Vorzeile „Ein Format von Make.One“ mit Knoten · H1 **Fokus / Innovation** (groß, zweite Zeile ruhig) · rechts Satz, „Teilnahme anfragen“, „Den Abend ansehen“ · Index: Kleine Runden · Sechs Städte · Offen für alle · Ein Thema je Abend |
| **01 Der Abend** (`#abend`) | „Eine kleine Runde. / Gespräche mit Substanz.“, Satz, Ablauf als vier Schritte auf einer Linie (Ankommen · Impuls · Gespräche am Tisch · Ausklang), Hinweis |
| **02 Formate & Themen** (`#themen`) | „Jeder Abend hat ein Thema. / Zum Beispiel:“, zwei Formate im Satz, vier Themen |
| **03 Gastgeber & Partner** (`#mitwirken`) | zwei gleichwertige Spalten, je eine vorbereitete Mail („Fokus Innovation – Gastgeber/Partner“) |
| **04 Die Städte** (`#staedte`, dunkel) | „Aus Berlin / in sechs Städte.“, Satz, sechs Städte mit „Termin in Planung“ (Berlin „Ausgangspunkt“), rechts die ruhige Karte |
| **05 Teilnahme** (`#teilnahme`, dunkel) | „Offen für alle — / solange Plätze frei sind.“, was in die Mail gehört (vier Punkte), Hauptweg `#teilnahme-link` (vorbereitete Mail) |
| **Fuß** (dunkel) | Wortmarke FOKUS INNOVATION, Firmierung, **Absender** (`#make-one`: Make.One, Link zu makeinnovation.de), Impressum, Datenschutz, Mail |

**Navigation:** heller Kopf wie makeinnovation.de: Knoten + „Fokus Innovation“ · Der Abend · Themen · Gastgeber & Partner · Städte · Teilnahme ·
„Teilnahme anfragen“. Unter 1100 px ein Menü-Knopf (`<details>`, geht ohne Skript), unter 560 px ohne Ruf-Knopf (Teilnahme steht im Menü).

**Barrierefreiheit:** eine H1; Karte als `role="img"` mit Titel und Beschreibung (nennt alle Städte); Fokus sichtbar; Tippziele ≥ 44 px;
kein waagerechtes Scrollen bei 1440 / 1024 / 768 / 390 px (gemessen 07.10.).

Keine erfundenen Termine, Zahlen zu Gästen/Plätzen, Partnernamen, Preise, Statistiken oder Fotos — `pruefen.mjs` hält das fest (Datumsangaben,
Mengen wie „40 Gäste“, Prozentzahlen, Preiswörter fallen auf).

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `impressum.html`, `datenschutz.html`, `404.html` | Seiten (404 mit absoluten Pfaden, erscheint unter jeder Adresse) |
| `css/seite.css` | **Byte-Kopie** der Gestaltungsgrundlage aus `website/css/seite.css` — nie hier ändern |
| `css/fokus.css` | nur diese Seite: Wortmarke im Kopf, großer Titel, Städte-Liste, Karte, Teilnahme, Absender im Fuß (keine Tokens) |
| `js/menue.js` | **Byte-Kopie** aus `website/js/menue.js` (Handy-Menü schließen) |
| `assets/logo/fokus-wortmarke.svg` | Wortmarke FOKUS INNOVATION (Fuß; erzeugt aus `scripts/website-logo.mjs` › `fokusWortmarke`) |
| `assets/logo/make-quer.svg`, `assets/fonts/` | **Kopien** aus `website/` (Logo quer, Archivo + Public Sans) |
| `favicon.svg` | der Knoten (erzeugt) |
| `robots.txt` | Vorschau: `Disallow: /` |
| `pruefen.mjs`, `LIESMICH.md` | Arbeitsdateien (nie ausgeliefert) |

**Nichts kopieren und vergessen:** `node scripts/fokus-seite.mjs` schreibt die Kopien (Grundlage `css/seite.css`, Schriften, Logo, Menü), die
Wortmarke, das Favicon und die ruhige Karte in `index.html` (Markierungen `KARTE_ANFANG`/`KARTE_ENDE`, aus EINER Liste `STAEDTE` mit echten
Koordinaten) und stempelt am Ende alle Seiten (`?v=<Prüfsumme>`). Prüfen ohne Schreiben: `node scripts/fokus-seite.mjs --pruefen`. Wächter:
`tests/fokus-seite.test.ts`, `tests/szene-website.test.ts` (eine Grundlage, keine Szene). Das Impressum übernimmt den Pflicht-Block von
`website/impressum.html` wörtlich (die Prüfung vergleicht).

### Ändern
- **Text:** `index.html`. **Aussehen nur dieser Seite:** `css/fokus.css`. **Aussehen beider Seiten:** `website/css/seite.css`, dann
  `node scripts/fokus-seite.mjs`, `node website/stempeln.mjs`, `node website/pruefen.mjs`.
- **Städte:** nur `STAEDTE` in `scripts/fokus-seite.mjs` (Karte) und die Liste in `index.html` (+ `STAEDTE` in `fokus/pruefen.mjs`).
- **Danach immer:** `node scripts/fokus-seite.mjs` und `node fokus/pruefen.mjs`.
- **Lokal ansehen:** `python3 -m http.server 3017 -d fokus` (bzw. über einen Eintrag in `.claude/launch.json`).

## Prüfen

`node fokus/pruefen.mjs` → **„freigabefähig“** nur ohne Fehler und ohne Platzhalter. Er nutzt die Regeln von `website/pruefen.mjs`
(Sperrliste, Firmierung, Wortregeln, Preise, Statistiken, Skript- und Tracker-Muster, Stempel, **`pruefeRuhe`** — dieselbe Ruhe-Prüfung wie
auf makeinnovation.de: kein Scroll-Film, höchstens ein dunkler Abschnitt und ein Licht, keine Animationen, keine scroll-gebundenen Skripte) und
prüft dazu: Absender „Ein Format von Make.One“ auf jeder Seite, H1 „Fokus Innovation“, die sechs Städte mit „Termin in Planung“ in Liste
und ruhiger Karte, genau einen Hauptweg `#teilnahme-link`, die Knöpfe „Gastgeber werden“/„Partner werden“ mit ihrer Mail, Mails nur an die
MAKE-Adresse mit Betreff „Fokus Innovation …“, externe Links nur zu makeinnovation.de, keine Formulare, keine Termine/Mengen/Preise, die
Wortmarke im Fuß, gemeinsame Dateien gleich wie in `website/` (auch `css/seite.css`), `css/fokus.css` ohne eigene Tokens.

**Größe (07.10.2026):** alles Ausgelieferte ≤ 250 KB (heute ≈ 131 KB inkl. Schriften), die Startseite (HTML + CSS + Skript, gzip, ohne
Schriften und Bilder) ≤ 80 KB (heute ≈ 15 KB — vorher ≈ 60 KB mit der Szene).

## Offene Platzhalter (Stand 07.10.2026)

- **Datenschutz:** AV-Vertrag mit Hetzner bestätigt? · AV-Vertrag mit Google (Cloud Data Processing Addendum) bestätigt? ·
  Abschnitt „Teilnahme an einem Abend“ (Gästeliste, Fotos, Einladungen) anwaltlich gegenlesen.
- Die beiden AV-Fragen sind dieselben wie auf makeinnovation.de — einmal klären, an beiden Stellen löschen.

## Bitte zusätzlich prüfen (Kevins Entscheidung)

- Texte: Titelsatz, „Eine kleine Runde. Gespräche mit Substanz.“ mit Satz und Ablauf, „Jeder Abend hat ein Thema. Zum Beispiel:“ mit
  zwei Formaten und vier Themen, Städte-Satz, „Offen für alle — solange Plätze frei sind.“ (Kevin 05.10.: offene Anmeldung), Gastgeber- und Partner-Texte.
- Neu formuliert (07.10.): die vier Index-Sätze im Einstieg („Ein Tisch statt eines Saals.“ · „Berlin ist der Ausgangspunkt.“ · „Solange
  Plätze frei sind.“ · „Erst ein Impuls, dann das Gespräch.“) und die Überschrift „Absender“ im Fuß.
- Die ruhige Karte: vereinfachter Umriss, Städte an echten Koordinaten; keine Grenzkarte.
- Der Film (`marketing/film/DREHBUCH.md`) hat auf der „Klar 2“-Seite noch keinen Platz (früher ein Standbild „Der Film folgt“ — entfernt,
  weil ein leerer Platz nicht seriös wirkt). Einbinden später als `<video>` mit `preload="none"`, `poster` aus `assets/`, ohne Autoplay
  bei „Bewegung reduzieren“, Datei vom eigenen Server (CSP um `media-src 'self'` ergänzen) — `pruefen.mjs` verlangt dann `preload="none"`.

## Online-Gang (erst auf Kevins Wort — Domain ist gekauft)

### 1 · DNS bei IONOS (Domain fokusinnovation.de)
In IONOS › Domains & SSL › fokusinnovation.de › DNS:
1. **A-Record** `@` → `2.28.108.162` (TTL 1 Stunde). Vorhandene A-/AAAA-Records für `@` (Parkseite von IONOS) löschen.
2. **A-Record** `www` → `2.28.108.162` (oder CNAME `www` → `fokusinnovation.de`).
3. Keinen AAAA-Record setzen, solange der Server keine IPv6 in Caddy bedient (sonst scheitert die Zertifikatsprüfung über IPv6).
4. MX-/Mail-Einträge nicht anfassen (die Seite schickt keine Mails; Kontakt bleibt hello@makeinnovation.de).
5. Prüfen: `dig +short fokusinnovation.de` und `dig +short www.fokusinnovation.de` → `2.28.108.162`.

### 2 · Ordner und Caddy-Block (seit 04.10.2026 eingetragen, auf `entwicklung`)
`compose.yml` hängt `./fokus:/srv/fokus:ro` in den Caddy-Container, `deploy/caddy/Caddyfile` hat den Block `fokusinnovation.de`
(+ `www` → 301) mit denselben strengen Köpfen wie makeinnovation.de (`landingpage_koepfe`, CSP `script-src 'self'`, Vorschau mit
`X-Robots-Tag: noindex, nofollow`) und versteckt die Arbeitsdateien. Wächter: `tests/caddy-buchung-koepfe.test.ts`. Die CSP reicht ohne
Änderung (seit „Klar 2“ nur ein kleines Skript, kein WebGL); erst für einen Film kommt `media-src 'self'` dazu.

### 3 · Ausrollen und prüfen
1. `node fokus/pruefen.mjs` → freigabefähig (Platzhalter gefüllt), Kevin hat die Seite gesehen und freigegeben.
2. Hochladen nur auf Kevins Wort (`entwicklung` → `main`), danach auf dem Server
   `docker compose up -d caddy` (neuer Ordner im Container) und
   `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` + `… caddy reload …`.
3. `curl -sI https://fokusinnovation.de` → 200 mit `content-security-policy` und `x-robots-tag: noindex, nofollow`;
   `curl -sI https://www.fokusinnovation.de` → 301 auf `https://fokusinnovation.de/`.
4. **Vorschau beenden** erst, wenn beworben wird: `X-Robots-Tag` aus dem Block, `fokus/robots.txt` öffnen, die
   `noindex`-Meta-Tags streichen (die Prüfung verlangt sie nur, solange `robots.txt` sperrt).

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind aus dem tatsächlichen Verhalten der Seite
> abgeleitet (Stand Oktober 2026) und vor der Freigabe von einer fachkundigen Person zu prüfen.
