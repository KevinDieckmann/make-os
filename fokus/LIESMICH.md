# Event-Seite fokusinnovation.de — Fokus Innovation, ein Format von Make.One

**Fokus Innovation** ist die Event-Reihe unter **Make.One** — Abende in kleiner Runde, junge und erfahrene Entscheider an einem
Tisch, in Berlin (Ausgangspunkt), Hamburg, Bielefeld, Köln, München und Dresden. Make.One bleibt das Netzwerk; Absender ist
**MAKE Innovation · eine Marke der KEMARIS Innovation GmbH**.

Statische Seite wie `website/` (HTML + eine CSS-Datei + sieben eigene Skripte, keine Cookies, kein Tracking, kein Speicher im
Browser, keine Formulare, Schriften selbst gehostet). Stand **„Klar“ (05.10.2026)**, **lokal gebaut — nicht online**. Anrede
**„Du“** wie auf makeinnovation.de; Impressum und Datenschutz förmlich („Sie“). Online geht sie nur auf Kevins Wort
(Abschnitt „Online-Gang“ unten).

## „Klar“ — auf der Basis von makeinnovation.de (Kevin 04.10.)

„80 % Seriosität und Souveränität, höchstens 20 % Akzente, klare Linien, kein Gewusel.“ Die verspielte Fassung mit drei Vorlagen
(Branch `fokus-3d`: Laufband, Kachel-Flug, Dock, Aufdeck-Fuß, Lade-Spielerei) ist verworfen. Die Seite steht jetzt auf denselben
Bausteinen wie makeinnovation.de „Klar“: Showreel-Baukasten `js/szene/spur.js`, Mesh-Gradient `js/szene/verlauf.js`, WebGL-1-Szene
(`kern.js`, `formationen.js`, `motor.js`) — alles **Byte-Kopien** aus `website/js/szene/`. Seitenspezifisch ist nur `js/drehbuch.js`.

**Hell → dunkel:** Die Titelkarte steht auf Off-White (`--papier` #F4F3EF) mit dunkler Schrift; ein Fenster öffnet sich in den dunklen
Raum des Abends. **80 %** sind Typografie, Weißraum, Haarlinien, ruhige Bewegung; die **Lichter** stehen an genau **zwei** Stellen
(`pruefen.mjs`: höchstens zwei Leinwände): die Szene und der Verlauf im Schlussblock. Kein Vorhang, keine Dauer-Animation hinter
Lesetext, keine konkurrierenden Bewegungen.

| p | Phase | Was geschieht |
|---|---|---|
| 0,00–0,15 | **Titelkarte** | Off-White: Mikro-Pille „Ein Format von Make.One“, H1 **Fokus Innovation** (zweite Zeile ruhig), ein Satz, „Teilnahme anfragen“ / „Den Abend ansehen“, Haarlinie mit „Kleine Runden · Sechs Städte · Auf Einladung · Aus Berlin“. Rechts (Handy: zwischen Titel und Satz) ein **Fenster in den Abend** — die Szene selbst, live. Beim Scrollen gleiten die Buchstaben verschwommen nach unten weg, das Fenster öffnet sich zum ganzen Raum (`clip-path` der Szene, Maß = Layout-Box des Fensters). |
| 0,15–0,41 | **01 Der Abend** | Dunkler Raum, die **Tafel** (Formation `tafel`): eine lange Tafel bei Nacht, zwölf Menschen als ruhige Lichter, Kerzen, wenige Gespräche als Bögen, ein leiser Boden aus Licht. Die Kamera fährt ruhig näher. „Eine kleine Runde. / Gespräche mit Substanz.“ steigt Buchstabe für Buchstabe auf, dann Satz und Ablauf (Ankommen · Impuls · Gespräche am Tisch · Ausklang). Rechner: Text links, Tafel rechts; hochkant: Tafel oben, Text unten (am Handy der Ablauf nur mit den vier Teilen). |
| 0,41–0,60 | **02 Formate & Themen** | Die Tafel tritt zurück (klein, gedimmt). „Jeder Abend hat ein Thema. / Zum Beispiel:“, zwei Formate (Abendrunde mit Impuls, Tischgespräch), unten in einer Reihe: KI im Unternehmen · Vertrieb & Markteintritt · Sichtbarkeit · Umsetzung im Mittelstand. |
| 0,60–0,83 | **03 Die Städte** | Aus der Tafel wird die **Deutschlandkarte** (Formation `karte`, echte Koordinaten), feine Fäden von Berlin in die fünf Städte, Beschriftungen legt der Motor über die Leinwand. Links „Aus Berlin / in sechs Städte.“ und die Liste — jede Stadt „Termin in Planung“, Berlin „Ausgangspunkt“. |
| 0,83–1,00 | **Schluss** | Wortmarke **FOKUS INNOVATION** über eigenem Verlauf, „Auf Einladung — / oder per Bewerbung.“, „Teilnahme anfragen“ / „Gastgeber oder Partner werden“; der Rahmen aus Papier schnappt ein. |
| danach | **Im Detail** (Off-White) | **04 Teilnahme** (Hauptweg `#teilnahme-link`, vorbereitete Mail, was hineingehört) · **05 Gastgeber & Partner** (je eine vorbereitete Mail, Betreff „Fokus Innovation – Gastgeber/Partner“) · **06 Absender** (Make.One, Link zu makeinnovation.de) · ruhiger dunkler Fuß (MAKE-Logo, Firmierung, Impressum, Datenschutz, makeinnovation.de, Mail). |

**Navigation:** Kachel-Pille wie makeinnovation.de (dunkel auf jedem Grund): Zeichen + „Fokus Innovation“ · Der Abend · Themen · Städte ·
Teilnahme · Gastgeber & Partner · Ruf-Kachel „Teilnahme anfragen“. Unter 1060 px ein Menü-Knopf (`<details>`, geht ohne Skript), unter
560 px ohne Ruf-Kachel (Teilnahme steht im Menü). Anker in der Spur fahren an die passende Stelle (Blöcke tragen `data-spur-p`);
springt der Tastatur-Fokus in einen Block der Bühne, fährt die Seite dorthin.

**Ruhige Fassung** (ohne Skript, „Bewegung reduzieren“, ohne WebGL, oder wenn die Szene scheitert): dieselben Blöcke untereinander —
Titelkarte mit dem **Standbild der Tafel** im Fenster (`assets/szene/abend.svg`), der Abend, die Themen, die Städte mit der **ruhigen
SVG-Karte** (aus `scripts/fokus-seite.mjs`), der Schlussblock mit stehendem Verlauf (CSS). Versteckt wird nur unter `html.spur-an`, das
allein `js/szene/spur.js` setzt. Bis das Skript entscheidet, deckt ein Papier-Grund die Seite (nur mit Skript, spätestens nach 1,5 s weg).

**Barrierefreiheit:** eine H1; zerlegte Überschriften tragen vorn eine unsichtbare Kopie, die Buchstaben sind `aria-hidden`; Szene und
Beschriftungen `aria-hidden`, die Szene in einem Satz beschrieben (nennt alle Städte); Fokus sichtbar (auf Papier Tinte, auf Dunkel
Türkis); Tippziele ≥ 44 px; 375 px ohne waagerechtes Scrollen.

Keine erfundenen Termine, Zahlen zu Gästen/Plätzen, Partnernamen, Preise oder Fotos — `pruefen.mjs` hält das fest (Datumsangaben,
Mengen wie „40 Gäste“, Preiswörter fallen auf).

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `impressum.html`, `datenschutz.html`, `404.html` | Seiten (404 mit absoluten Pfaden, erscheint unter jeder Adresse) |
| `css/fokus.css` | Tokens (das erste `:root` = makeinnovation.de, die Prüfung vergleicht), Off-White/Tinte, `--sr-*` je Stufe; ruhige Fassung + Showreel (`.spur-an`) aus einem HTML |
| `js/drehbuch.js` | **nur diese Seite:** Zustände der Szene (abend · gespraech · themen = dieselbe Tafel, nur die Kamera fährt; staedte = Karte) und die Choreografie (`MakeSzene.showreel`: was bei welchem p geschieht). Die Städte zwischen `STAEDTE_ANFANG/ENDE` sind erzeugt. |
| `js/szene/*.js` | **Byte-Kopie** aus `website/js/szene/` (kern · formationen · motor · spur · verlauf) — nie hier ändern |
| `js/menue.js` | **Byte-Kopie** aus `website/js/menue.js` (Handy-Menü schließen) |
| `assets/szene/abend.svg` | Standbild der Tafel (`node website/standbild.mjs fokus`) — ruhige Fassung |
| `assets/logo/fokus-wortmarke.svg` | Wortmarke FOKUS INNOVATION (erzeugt aus `scripts/website-logo.mjs` › `fokusWortmarke`) |
| `assets/logo/make-quer.svg`, `assets/fonts/` | **Kopien** aus `website/` (Logo quer, Archivo + Public Sans) |
| `favicon.svg` | der Knoten (erzeugt) |
| `robots.txt` | Vorschau: `Disallow: /` |
| `pruefen.mjs`, `LIESMICH.md` | Arbeitsdateien (nie ausgeliefert) |

**Nichts kopieren und vergessen:** `node scripts/fokus-seite.mjs` schreibt die Kopien (Schriften, Logo, Menü, Szene über
`scripts/szene-website.mjs`), die Wortmarke, das Favicon, die Städte im Drehbuch, die Beschriftungen der Szene und die ruhige Karte
in `index.html` (Markierungen `MARKEN_*`, `KARTE_*`) — alles aus EINER Liste `STAEDTE` — und stempelt am Ende alle Seiten
(`?v=<Prüfsumme>`). Prüfen ohne Schreiben: `node scripts/fokus-seite.mjs --pruefen`. Wächter: `tests/fokus-seite.test.ts`,
`tests/szene-website.test.ts`. Das Impressum übernimmt den Pflicht-Block von `website/impressum.html` wörtlich (die Prüfung vergleicht).

### Ändern
- **Text:** `index.html`. **Zeitplan / Bewegung:** `js/drehbuch.js` › `bild(p, w)` (je Phase ein Block). **Bild der Szene:** `js/drehbuch.js`
  › `S.drehbuch.zustaende` (Kamera, `hell`, `p`/`bis`, `dreh` der Tafel), danach `node website/standbild.mjs fokus`. **Größen je Stufe:** `--sr-*`.
- **Neue Fähigkeit der Szene** (Formation, Werkzeug im Baukasten): nur in `website/js/szene/` und so, dass makeinnovation.de unverändert
  bleibt; dann `node scripts/fokus-seite.mjs`, `node website/stempeln.mjs`, `node website/standbild.mjs` (darf sich nicht ändern),
  `node website/pruefen.mjs`.
- **Danach immer:** `node scripts/fokus-seite.mjs` und `node fokus/pruefen.mjs`.
- **Lokal ansehen:** eigener statischer Server (z. B. `python3 -m http.server 3097 -d fokus` über einen Eintrag in `.claude/launch.json`).

## Prüfen

`node fokus/pruefen.mjs` → **„freigabefähig“** nur ohne Fehler und ohne Platzhalter. Er nutzt die Regeln von `website/pruefen.mjs`
(Sperrliste, Firmierung, Wortregeln, Preise, Skript- und Tracker-Muster, Stempel, **`pruefeShowreel`** — dieselbe Prüfung des Showreels
wie auf makeinnovation.de) und prüft dazu: Absender „Ein Format von Make.One“ auf jeder Seite, H1 „Fokus Innovation“, die sechs Städte
mit „Termin in Planung“ in Liste, ruhiger Karte, Beschriftungen der Szene, Drehbuch und Beschreibung der Szene, genau einen Hauptweg
`#teilnahme-link`, die Knöpfe „Gastgeber werden“/„Partner werden“ mit ihrer Mail, Mails nur an die MAKE-Adresse mit Betreff
„Fokus Innovation …“, externe Links nur zu makeinnovation.de, keine Formulare, keine Termine/Mengen/Preise, höchstens **zwei** Lichter,
gemeinsame Dateien gleich wie in `website/`.

**Größe (05.10.2026):** Bis v1 (zwei kleine Skripte) galt „alles Ausgelieferte ≤ 250 KB“. Die Szene ist eine Byte-Kopie von
makeinnovation.de (≈ 104 KB roh, ≈ 40 KB gzip, bewacht von `website/pruefen.mjs` und dem Wächtertest). Deshalb: **250 KB gelten
unverändert für alles Eigene** (heute ≈ 190 KB inkl. Schriften und Standbild), die Kopie der Szene hat eine eigene Grenze (**120 KB**),
und was ein Besuch der Startseite lädt (HTML + CSS + Skripte, gzip, ohne Schriften und Bilder) höchstens **80 KB** (heute ≈ 60 KB).

### Gemessen (05.10.2026, headless Chrome, Apple M3, lokaler Server mit gzip)
- **Geladen** (Showreel): gzip ohne Schriften ≈ 61 KB (das Standbild lädt nur in der ruhigen Fassung — `loading="lazy"`), mit
  Schriften ≈ 121 KB. Erstes Bild nach ≈ 0,5 s.
- **Bildrate** beim Scrollen über die ganze Seite: Rechner 1440 × 900 **60 fps**, längstes Bild 16,8 ms; Handy 375 × 812 mit 4×
  gedrosselter CPU **59,5 fps**, längstes Bild 50 ms (6 von 833 Bildern über 25 ms). Aufbau der Szene einmalig ≈ 130–250 ms
  (Rechner) bzw. ≈ 250 ms (gedrosselt). Konsole leer, kein waagerechtes Scrollen (375 / 820 / 1440 px).

## Offene Platzhalter (Stand 05.10.2026)

- **Datenschutz:** AV-Vertrag mit Hetzner bestätigt? · AV-Vertrag mit Google (Cloud Data Processing Addendum) bestätigt? ·
  Abschnitt „Teilnahme an einem Abend“ (Gästeliste, Fotos, Einladungen) anwaltlich gegenlesen.
- Die beiden AV-Fragen sind dieselben wie auf makeinnovation.de — einmal klären, an beiden Stellen löschen.

## Bitte zusätzlich prüfen (Kevins Entscheidung)

- Texte: Titelsatz, „Eine kleine Runde. Gespräche mit Substanz.“ mit Satz und Ablauf, „Jeder Abend hat ein Thema. Zum Beispiel:“ mit
  zwei Formaten und vier Themen, Städte-Satz, „Auf Einladung — oder per Bewerbung.“, Gastgeber- und Partner-Texte.
- „Fokus Innovation ist eine Runde auf Einladung — die Gäste laden wir persönlich ein“ — passt das zu eurem Vorgehen?
- Die ruhige Karte: vereinfachter Umriss, Städte an echten Koordinaten; keine Grenzkarte.
- Der Film (`marketing/film/DREHBUCH.md`) hat auf der „Klar“-Seite noch keinen Platz (früher ein Standbild „Der Film folgt“ — entfernt,
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
`X-Robots-Tag: noindex, nofollow`) und versteckt die Arbeitsdateien. Wächter: `tests/caddy-buchung-koepfe.test.ts`. Die CSP reicht für
die Szene ohne Änderung (eigenes WebGL, kein eval, keine Worker); erst für einen Film kommt `media-src 'self'` dazu. Die Standbilder
unter `/assets/szene/` bekommen keinen eigenen Cache-Kopf (Browser-Standard) — wer es will, ergänzt sie in `@stile`.

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
