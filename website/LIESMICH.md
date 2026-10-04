# Landingpage makeinnovation.de — MAKE Innovation (eine Marke der KEMARIS Innovation GmbH)

Statische Seite (HTML + eine CSS-Datei + sechs eigene Skripte, keine Cookies, kein Tracking, kein Speicher im Browser,
Schriften selbst gehostet). Stand **v5 „Der Weg“ (04.10.2026)**: ein Scroll-Erlebnis — eine durchgehende WebGL-Szene hinter dem
Text, Scrollen = Kamerafahrt entlang eines Lichtpfads durch ein Neuronennetz. Ton seriös und beratend („Du“ im professionellen
Register): Beratung für Unternehmen mit Umsetzungsstärke. Der Name der Software steht bewusst nirgends auf der Seite; oben
rechts nur ein kleiner Knopf „Login“.

**Firmierung (Kevin 03.10., rechtlich):** Eine GmbH unter dem Namen „MAKE Innovation“ ist nicht eingetragen. Überall steht
„MAKE Innovation“ und darunter klein „eine Marke der KEMARIS Innovation GmbH“; Impressum und Datenschutz nennen die
Kemaris Innovation GmbH (Schönefeld, HRB 19873, AG Cottbus). `pruefen.mjs` hält das fest.

Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
Sie ist als **nicht indexierte Vorschau** aktiv (`X-Robots-Tag: noindex`, `robots.txt` sperrt, jede Seite trägt
`<meta name="robots" content="noindex">`). Die CSP bleibt unverändert (`script-src 'self'` reicht: eigenes WebGL, kein eval, keine Worker).

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf (Logo, Navigation Beratung · Make.One · **Fokus Innovation ↗** (fokusinnovation.de) · Warum wir · Kontakt, Handy-Menü, „Login“), die Szene (`.szene`, `aria-hidden`: Leinwand, Beschriftungen, Logo-SVG `svg.zeichen`), die Kapitel-Leiste (Rechner, links) und die Kapitel — jedes mit `data-zustand` (= Eintrag im Drehbuch) und seinem Standbild (`img.still`). Fuß mit Firmierung |
| `js/szene/kern.js` | **wiederverwendbar:** Mathematik ohne DOM — Zufall, Matrizen, der Pfad (auch als GLSL), die Lichtfäden entlang des Pfads (JS + GLSL aus einer Quelle), Kamera aus dem Scroll-Stand, SVG-Formen abtasten |
| `js/szene/formationen.js` | **wiederverwendbar:** Formationen (Neuronennetz, Schriftzug, Stationen, Deutschlandkarte mit Städte-Liste, Knoten/Logo …) als Punkte + Linien, `bauen(drehbuch, { handy, logo })`, `logoAusSvg()` |
| `js/szene/motor.js` | **wiederverwendbar:** WebGL-1-Motor (4 kleine Shader: Teilchen, Linien, Lichtfäden, Staub), Scroll → Zustand, Beschriftungen und Logo als HTML/SVG über der Leinwand, Fallbacks, Pause im verborgenen Tab, senkt bei Bedarf die Auflösung |
| `js/drehbuch.js` | **nur diese Seite:** was die Szene je Kapitel zeigt (Formation, Kamera, Optionen) |
| `standbild.mjs` | erzeugt `assets/szene/<zustand>.svg` aus derselben Geometrie (Arbeitsdatei; Caddy liefert `*.mjs` nie aus) |
| `assets/szene/*.svg` | je Kapitel ein Standbild (nur geladen, wenn die Szene nicht läuft) |
| `js/lichtfaeden.js` | Lichtfäden-Zeichner (Canvas 2D) — **erzeugt** aus der App (`node scripts/lichtfaeden-website.mjs`), auf der Startseite v5 nicht eingebunden (die Szene zeichnet ihre Fäden selbst); bleibt für den Generator und als gemeinsame Quelle mit fokus/ |
| `js/menue.js` | schließt das Handy-Menü (`<details>`) nach einem Klick, mit Esc oder per Klick daneben |
| `js/erstgespraech.js` | übernimmt das Ziel aus `#erstgespraech-link` für alle Knöpfe mit `data-erstgespraech` |
| `css/seite.css` | Tokens wie `lib/make-one/design.ts` und `fokus/css/fokus.css` (gleich gehalten), neu nur `--tief`/`--tiefGanz`; Kapitel-Layout, Szene, Standbilder, Rechtstexte |
| `impressum.html`, `datenschutz.html`, `404.html` | Rechtstexte (Inhalt unverändert; Datenschutz: nur die Zahl der Skripte und „WebGL“ an v5 angepasst) |
| `assets/logo/` | Logo v5 „Synapse“ aus `scripts/website-logo.mjs` (nie von Hand ändern) — Konstruktion in `assets/logo/LOGO.md` |
| `logo-entwuerfe.html`, `pruefen.mjs`, `LIESMICH.md` | Arbeitsdateien (werden nie ausgeliefert) |

## Standard (04.10.2026): Glas, Kaskade, Einstieg, Aurora
Übernommen aus Kevins Vorlage nur der Standard — in unserer CI (Archivo/Public Sans, Granat/Smaragd, Tokens aus `css/seite.css`):

| Teil | Wo | Abschalten |
|---|---|---|
| Glas-Knöpfe (`.knopf`, `.gross`, `.leise`): Lauf-Rand Granat → Smaragd, Pfeil-Abzeichen (`span.pfeil`), Hover −2 px | `css/seite.css` › Knöpfe | — |
| Mikro-Pille (`.mikro.pille` + `svg.knoten-zeichen`) | `index.html`, `css/seite.css` | Klasse `pille` weglassen |
| Buchstaben-Kaskade: `data-kaskade` an H1/H2 (nicht am Wort INNOVATION) | `js/szene/motor.js` › `zerlegen` | `text: { kaskade: false }` |
| Ein-/Ausblenden: `data-auftritt` an Pille, Unterzeile, Knöpfen (vorher · jetzt · nach) | `motor.js` › `auftritt` | `text: { auftritt: false }` |
| Feder statt Lerp (Szene folgt dem Scroll weich) | `kern.js` › `feder` | `folgen` (Sekunden) |
| Einstieg: Lichtwolke blüht auf, Kamera fährt zurück | Shader `bluehen`, `kern.einstieg` | `einstieg: false` |
| Aurora an den Rändern (¼ Auflösung, eigener Puffer) | `motor.js` › `auroraBauen`; je Kapitel `aurora` im Drehbuch | `aurora: false` |
| Zahlen-Trommel: `li.zahl.trommel` — die Zahl zählt beim Aktivwerden hoch (2,2 s, easeOutQuint), unscharf und abgesenkt, solange sie läuft; beim Verlassen sofort 0; für Vorleser der echte Wert | `motor.js` › `trommel` | `text: { trommel: false }` |
| Aufdeck-Fuß (ab 768 px): Fuß fest hinter der Seite, `div.aufdecken` deckt ihn auf (`--aufdeckung`); Kontakt-Aufruf Buchstabe für Buchstabe ab 20 %, Glas-Knopf „Erstgespräch anfragen“ (`data-erstgespraech`), riesige Wortmarke steigt in zwei Stimmen. Passt der Fuß nicht ins Fenster, bleibt er normal; springt der Tastatur-Fokus hinein, scrollt die Seite ans Ende | `motor.js` › Bühne, `css/seite.css` › Aufdeck-Fuß | `text: { fuss: false }` |

Barrierefreiheit: Ohne Skript und bei „Bewegung reduzieren“ steht aller Text sofort (der Motor startet dann nicht, das CSS versteckt nur, was der Motor
markiert); nur der Einstieg wartet mit Skript auf den Motor — mit Notfall-Auftritt nach 2,2 s. Zerlegte Überschriften tragen vorn eine unsichtbare
Kopie, die Buchstaben sind `aria-hidden`; nach dem Auftritt steht wieder das Original. Ohne Szene: stehender Aurora-Hauch per CSS (`body::before`).
Nicht übernommen: Bloom, Zahlen-Karten im Kreis, Lichtblitz, Texte/Zahlen/Farben/Schriften der Vorlage, Lenis.
Die Ausblend-Maske am Ende der ruhigen Titelzeile endet bei 0,55 statt 0,2 Deckkraft (sonst Kontrast unter 3 : 1).

## Die Szene — Dramaturgie (Scroll = Kamerafahrt)

| # | Kapitel (`data-zustand`) | Formation | Bild |
|---|---|---|---|
| 01 | Der Weg (`weg`) | `weg` | Start IM Neuronennetz; Granat und Smaragd verflochten als Lichtpfad, Staub fließt nach vorn — beim Scrollen geht die Kamera den Pfad |
| 02 | INNOVATION (`innovation`) | `schriftzug` | die Teilchen formen INNOVATION in der Typo der Wortmarke (aus dem Logo-SVG), darunter Rot · Knoten · Grün; das Wort steht als echtes HTML (`h2.wort`, mit Szene unsichtbar) |
| 02 | Der Satz (`satz`) | `strom` | „Innovation braucht Umsetzung und Sichtbarkeit.“ — zwei Stränge laufen zu einem Faden zusammen (Kamera im Strang) |
| 03 | Beratung (`beratung`) | `huerde` | „Wachstum scheitert selten an Ideen. Meist an der Umsetzung.“ — eine graue Wand mit Öffnung, der Weg führt hindurch |
| 3.1 | Sales (`sales`) | `trichter` | von vielen Kontakten links zu einem klaren Strahl rechts (Interim CSO, Interim Head of Sales, Go-to-Market-Beratung) |
| 3.2 | Sichtbarkeit (`sichtbarkeit`) | `signal` | Leuchtpunkt, Ringe breiten sich aus, ein Strahl steigt auf (Events & Netzwerk-Strategie) |
| 3.3 | Umsetzung (`umsetzung`) | `stufen` | drei wachsende Gitter Analyse · Aufbau · Skalierung, Pfad darüber (Development „Coming Soon“) |
| 3.4 | Netzwerk (`netzwerk`) | `runden` | Runden von Menschen auf einer Kugel, Brücken dazwischen (Make.One, Make.Beteiligungen) |
| 04 | Fokus Innovation (`fokus`) | `karte` | die Szene wird zur Deutschlandkarte (echte Koordinaten): Lichtfäden von Berlin nach Hamburg, Bielefeld, Köln, München, Dresden; Kapitel-Knopf und Menüpunkt → fokusinnovation.de |
| 05 | Ideen (`funken`) | `funken` | verstreute Funken (41 %, 57 % mit Fußnote) |
| 05 | KI (`ki`) | `strahl` | ein Strahl aus vielen feinen Fäden, fließt links → rechts (wie der Strahl v3 der App; 66 %, 7 %) |
| 05 | Wirkung (`wirkung`) | `wirkung` | eine Runde von Menschen, daraus drei Ströme Umsetzung · Sichtbarkeit · Netzwerk |
| 06 | Kontakt (`kontakt`) | `zeichen` | alles fließt in den Knoten des Logos; die Teilchen formen das Logo, dann steht es scharf als SVG (Logo unverändert) |

Rechner (≥ 1100 px): Text links, die Szene rechts daneben (Objektiv-Verschiebung, Platz bis zur gemessenen Textkante); die großen
Sätze (INNOVATION, der Satz) mittig und stehend (sticky), während sich die Szene formt. Handy: die Szene oben, der Text kommt als
ruhige Fläche darüber; weniger Teilchen (1.800 statt 4.200), Netz 1.100 statt 2.600 Knoten, Auflösung ≤ 1,5.

### Kapitel ändern
- **Text:** in `index.html` im Abschnitt mit dem passenden `data-zustand`.
- **Bild:** in `js/drehbuch.js` (Formation, `s` = Lage am Pfad, Kamera `abstand/hebung/seite/blick`, `breite/hoehe`, `schub`, `faeden/nah`,
  `optionen`). Neues Kapitel = neuer Eintrag im Drehbuch + Abschnitt mit gleichem `data-zustand` in derselben Reihenfolge + Standbild.
- **Danach:** `node website/standbild.mjs` (Standbilder neu) und `node website/pruefen.mjs` (prüft Reihenfolge, Standbilder, Gewicht).
- **Lokal ansehen:** `python3 -m http.server 3013 -d website` über einen Eintrag in `.claude/launch.json` (nicht per Bash) — die Szene braucht
  einen Server (Schriften, gleiche Herkunft); ohne Server zeigt die Datei die Standbilder.
- **Neue Formation:** Funktion in `FORMEN` (`js/szene/formationen.js`) — lokal am Anker bauen (x rechts, y oben, z zur Kamera), Punkte mit
  `b.punkt`, Linien mit `b.zug` (t = 0…1 für Aufbau von links und Lichtimpulse), Beschriftungen mit `b.marke` (+ `span.marke` in `.szene`).

### Fallbacks
- **Ohne WebGL** (oder Fehler im Aufbau): der Motor setzt `.ohne-szene` → je Kapitel das Standbild (Rechner: rechts, sticky; Handy: über dem Text).
- **„Bewegung reduzieren“:** keine Szene, dieselben Standbilder (`@media (prefers-reduced-motion: reduce)`), kein Lauf-Effekt.
- **Ohne Skript:** alle Inhalte, Links, Impressum; die Standbilder stehen (`@media (scripting: none)`).
- Mit Skript und Bewegung bleiben die Standbilder ungeladen (`display: none` + `loading="lazy"`).

### Technik, Gewicht, Tempo (gemessen 04.10., headless Chrome, Apple M3)
- **Eigenes WebGL statt three.js:** die Szene besteht nur aus Punkten und 1-px-Linien mit additivem Licht — dafür reichen vier kleine Shader.
  So bleibt alles selbst gehostet ohne Bibliothek (three.js allein wäre ~170 KB gzip und enthält Muster, die `pruefen.mjs` für Seiten-Skripte sperrt).
- **Gewicht:** Startseite (HTML + CSS + sechs Skripte) **≈ 53 KB gzip** (Standard 04.10.; v5: 42 KB), mit Schriften ≈ 113 KB (`pruefen.mjs`: Grenze 400 KB). Standbilder je ≈ 21–46 KB gzip, nur im Fallback.
- **Erster Text:** sofort als HTML (First Contentful Paint ≈ 0,08 s lokal); die Szene baut sich nach dem ersten Bild auf (einmalig ≈ 90 ms Rechnen, Handy gedrosselt ≈ 160 ms).
- **Bildrate:** 60 fps beim Scrollen über die ganze Seite, längstes Bild 16,8 ms (Rechner und Handy-Emulation mit 4× gedrosselter CPU). Konsole leer.
  Mit Standard (Aurora, Text-Bühne, Fuß): Rechner 60 fps / längstes Bild 16,8 ms; Handy (CPU × 4) 59,9 fps, ein Bild 33 ms. Messungen schwanken, wenn
  der Rechner nebenbei ausgelastet ist — dann einzelne Ausreißer bis ~80 ms.

### Andocken für fokus/ (später, eine Quelle)
`js/szene/kern.js`, `formationen.js`, `motor.js` kennen keine Inhalte. Wie beim Lichtfäden-Zeichner kann ein Generator
(`scripts/szene-website.mjs`, Muster `scripts/lichtfaeden-website.mjs` mit Liste `ZIELE`) sie byte-gleich nach `fokus/js/szene/` kopieren
(Wächtertest vergleicht). fokus/ bringt nur ein eigenes `js/drehbuch.js` (z. B. `karte` mit `optionen.staedte` = eigene Liste, `schriftzug`
mit eigener SVG-Form, `zeichen` mit dem Fokus-Knoten), Abschnitte mit `data-zustand`, `.szene` mit Leinwand und die Standbilder
(`standbild.mjs` mit Ordner als Parameter). `fokus/pruefen.mjs` müsste dafür `js/szene/` als Skript-Pfad erlauben.

## Freigabe — in dieser Reihenfolge

1. **Platzhalter füllen.** Jeder offene Wert steht gelb markiert als `<span class="ph">[[KEVIN: …]]</span>` in der Seite.
   Beim Füllen das **ganze** `<span class="ph">…</span>` durch den Text ersetzen (sonst bleibt die gelbe Markierung —
   die Prüfung meldet das). Abschnitte, die nicht zutreffen (z. B. USt-IdNr.), ganz streichen.
2. **Prüfen:** `node website/pruefen.mjs` → muss **„freigabefähig“** melden (Ausgang 0). Er prüft außerdem: Firmierung
   „eine Marke der KEMARIS Innovation GmbH“ auf jeder Seite und **nirgends eine GmbH namens MAKE Innovation**, Beschreibung und — solange
   `robots.txt` sperrt — `noindex` je Seite, keine
   Skripte, keine Inline-Stile, keine fremden Quellen/Tracker, eine H1 je Seite, Login-Knopf, Impressum- und
   Datenschutz-Link, alle eigenen Links und Anker — dazu: Skripte nur aus `js/` und ohne Speichern/Senden, Logo-Dateien
   vollständig, Bühnen-Zeichen = `assets/logo/wortmarke.svg`, Navigation, Angebote (drei mit „Erstgespräch anfragen“, genau
   ein „Coming Soon“ bei Development), Mail-Knöpfe Make.One/Make.Beteiligungen, **Ziel des Erstgesprächs an genau einer Stelle**
   (`#erstgespraech-link`: vorbereitete Mail oder Buchungsseite mit gültigem Slug), **keine Preise**, **Sperrliste**: keine anderen Firmen-, Marken- oder
   Projektnamen (nur MAKE; KEMARIS nur in der Firmierung), der Name der Software nirgends im Ordner, Wortregeln (kein „Dashboard“, „Tool“,
   „Reporting“, „Disruption“, „einfach zu bedienen“).
3. **Kevin sieht die Seite lokal an** und gibt sie ausdrücklich frei.
4. **Vorschau beenden** (erst, wenn die Seite beworben wird): in `deploy/caddy/Caddyfile` die Zeile `X-Robots-Tag` entfernen,
   `website/robots.txt` öffnen (`Disallow:` leer) und in allen Seiten `<meta name="robots" content="noindex">` streichen
   (`pruefen.mjs` verlangt das Meta-Tag nur, solange `robots.txt` sperrt). `npx vitest run tests/caddy-buchung-koepfe.test.ts`.
5. **Hochladen nur auf Kevins Wort** (wie immer: `entwicklung` → `main`). Danach auf dem Server einmal
   `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` und
   `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` (Caddy lädt eine geänderte Caddyfile nicht
   von selbst). Prüfen: `curl -sI https://makeinnovation.de` → 200 mit `content-security-policy`,
   `curl -sI https://www.makeinnovation.de` → 301 auf `https://makeinnovation.de/`.

## Offene Platzhalter (Stand 04.10.2026, v5)

- **Startseite › Kontakt › Warum MAKE:** ein Satz zu Kevins Vertriebserfahrung (ohne Kundennamen)

## Später auf Buchungsseite umstellen

Hauptweg ist vorerst **„Erstgespräch anfragen“ → vorbereitete Mail** an `hello@makeinnovation.de` (Betreff
„Erstgespräch – Markttraktion“, Text: Firma, worum es geht, 2–3 Terminvorschläge), weil die Buchungsseite der Software
noch nicht so weit ist. Das Ziel steht an **genau einer Stelle**: `index.html`, Knopf `id="erstgespraech-link"`
(Abschnitt „Erstgespräch“). Alle anderen Knöpfe tragen `data-erstgespraech` und übernehmen es über `js/erstgespraech.js`.
**Umstellen:** nur dieses eine `href` durch `https://app.makeinnovation.de/buchen/<slug>` ersetzen (Slug der
Buchungsseite, Form `name-<24 Hex-Zeichen>`), dann `node website/pruefen.mjs`. Dazu im Datenschutzhinweis einen
Abschnitt „Termin buchen“ ergänzen (Buchungsseite unter app.makeinnovation.de, verarbeitet Name, E-Mail, ggf. Firma und
Anliegen, eigener Hinweis vor dem Absenden) und im Abschnitt „Cookies und Speicher“ den Satz zum Skript anpassen.

## Offene Platzhalter — Rechtstexte

- **Impressum:** vollständig (KEMARIS-Impressum, 03.10.). Eine USt-IdNr. ist nicht bekannt und steht deshalb nicht da —
  falls es eine gibt, als Abschnitt „Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG“ ergänzen.
- **Datenschutz:** AV-Vertrag mit Hetzner bestätigt? · AV-Vertrag mit Google (Cloud Data Processing Addendum) in der Admin-Konsole bestätigen — Anbieter für `hello@makeinnovation.de` ist eingetragen: Google Workspace/Gmail, Google Ireland Limited ·
  eigener Datenschutzhinweis der App unter `app.makeinnovation.de` · Drittland-Verträge (Microsoft, Apple, Anthropic) ·
  Abschnitt „Geschäftskontakte und Veranstaltungen“ anwaltlich gegenlesen

## Bitte zusätzlich prüfen (kein Platzhalter, aber Kevins Entscheidung)

- Impressum › Verbraucherstreitbeilegung/Universalschlichtungsstelle: wörtlich aus dem KEMARIS-Impressum übernommen.
- **Make.Beteiligungen:** bewusst vorsichtig formuliert („Kooperation oder Beteiligung im Einzelfall“, Hinweis „keine
  Anlageberatung, kein Finanzierungsangebot, keine Rendite- oder Finanzierungszusage“). Vor der Freigabe juristisch
  gegenlesen lassen.
- Die Seite nennt keine Preise, Kundennamen, Kundenzahlen oder Erfolgsversprechen — bewusst. Die Fakten zu den Mandaten
  (ca. 2 Tage pro Woche, wöchentliche Calls, 6–12 Monate, Make.One-Zugang beim Interim CSO) sind Kevins Vorgaben vom 01.10.
- Die Make.One-Formate (Stammtisch, Dinner, Workshop, Webinar) haben je einen allgemeinen Satz, keine Termine oder Orte.
- Gründer-Texte: MAKE = Malin + Kevin, Malins Zeile aus v2 (Kevins Worte, 27.09.). Ohne Fotos — Initialen in
  Personenfarbe. Fotos nur, wenn ihr sie freigebt (dann als Datei in `assets/`, `img-src 'self'` erlaubt das).
- Anrede auf der Startseite **„Du“** (Kevin 03.10.: unter Unternehmern üblich, natürlich und souverän; Überschrift „Warum du mit uns arbeiten solltest.“). **Impressum und Datenschutz bleiben förmlich („Sie“)** — Rechtstexte.
- **Belegte Zahlen** (Kevin 03.10.): vier Kacheln im Kapitel „05 KI & Innovation in Deutschland“ (je zwei in den Schritten Ideen und KI),
  jede mit Fußnote; die Quellenliste steht am Ende des Kapitels. Nur Originalquellen, direkt am Dokument geprüft (Stand der Prüfung 03.10.2026). Neue Zahl = neue Quelle in
  `QUELLEN_LINKS` (`pruefen.mjs`) eintragen — der Prüfer verlangt je Kachel eine Fußnote mit genau einem dieser Links.
  Jährlich neu prüfen, ob eine jüngere Ausgabe erschienen ist:

  | Zahl | Aussage | Quelle |
  |---|---|---|
  | 57 % | der Inhaber:innen mittelständischer Unternehmen sind 55+ (über 2 Mio.; 2003: 20 %) | KfW Research, Nachfolge-Monitoring Mittelstand 2025, Fokus Nr. 526, 9.1.2026 |
  | 7 % | der Arbeitszeit im Mittelstand für Bürokratie (Ø 32 Std./Monat und Unternehmen) | KfW Research, Fokus Nr. 495, 25.4.2025 |
  | 41 % | Innovatorenquote im Mittelstand 2022–2024; 80 % der Innovatoren ohne eigene FuE | KfW-Innovationsbericht Mittelstand 2025, März 2026 |
  | 66 % | der KI-Anwender: Wettbewerbsposition verbessert (57 % setzen KI ein, vor zwei Jahren 20 %) | Bitkom, Presseinformation 14.9.2026 (603 Unternehmen ab 20 Beschäftigten) |

  Die Fußnoten verlinken auf kfw.de und bitkom.org; der Datenschutzhinweis nennt das (Abschnitt „Links zu Quellen“).

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind nach bestem Wissen aus dem tatsächlichen
> Verhalten der Seite und des Servers abgeleitet (Stand Oktober 2026: § 5 DDG, DSGVO, TDDDG; die frühere Pflicht zum
> Link auf die EU-OS-Plattform ist mit deren Abschaltung im Juli 2025 entfallen). Vor der Freigabe von einer
> fachkundigen Person prüfen lassen.

## Stempel für Stile und Skripte (04.10.2026)
Caddy liefert Seiten immer frisch, `css/` und `js/` bleiben einen Tag im Browser. Nach dem ersten v5-Upload sah deshalb wer
die Seite vorher besucht hatte, die neue Seite mit alten Stilen/Skripten (kaputt). Seitdem trägt jeder Verweis die Prüfsumme der
Datei (`css/seite.css?v=…`). **Nach jeder Änderung an `css/` oder `js/`: `node website/stempeln.mjs`** — `pruefen.mjs` meldet
fehlende oder veraltete Stempel (Wächter: tests/website-landingpage.test.ts › Stempel).
