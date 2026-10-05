# Landingpage makeinnovation.de — MAKE Innovation (eine Marke der KEMARIS Innovation GmbH)

Statische Seite (HTML + eine CSS-Datei + acht eigene Skripte, keine Cookies, kein Tracking, kein Speicher im Browser,
Schriften selbst gehostet). Stand **„Klar“ (04.10.2026)** — Kevin: „Das ist too much. Das muss klarer sein … Basis
Superconscious … ein bisschen von unserer futuristischen Sache mitnehmen, maximal 20 % — 80 % Seriosität und Souveränität.
Wenn ein Investor draufschaut, soll er sagen: oh Gott. Klare Linien, kein Gewusel.“

**Botschaft:** Umsetzung & Sichtbarkeit (Beratung) und Fokus & Klarheit (eigene Software — ohne Namen, ohne Bilder, ohne
Kaufangebot). Ton seriös und beratend, Anrede „Du“; Impressum und Datenschutz „Sie“. Der Name der Software steht nirgends
im Ordner; oben rechts nur „Login“.

**Firmierung (Kevin 03.10., rechtlich):** Eine GmbH unter dem Namen „MAKE Innovation“ ist nicht eingetragen. Überall steht
„MAKE Innovation“ und darunter klein „eine Marke der KEMARIS Innovation GmbH“; Impressum und Datenschutz nennen die
Kemaris Innovation GmbH (Schönefeld, HRB 19873, AG Cottbus). `pruefen.mjs` hält das fest.

Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
Sie ist als **nicht indexierte Vorschau** aktiv (`X-Robots-Tag: noindex`, `robots.txt` sperrt, jede Seite trägt
`<meta name="robots" content="noindex">`). Die CSP bleibt unverändert (`script-src 'self'` reicht: eigenes WebGL, kein eval, keine Worker).

## Aufbau „Klar“ — hell → dunkel, 80 / 20

Die Seite beginnt auf **Off-White** (`--papier` #F4F3EF) mit dunkler Schrift wie eine Beteiligungsgesellschaft; beim Scrollen
öffnet sich der **dunkle Raum** mit unseren Lichtern. **80 %** sind Typografie, Weißraum, Haarlinien, ruhige Bewegung; die
**20 %** Lichter (Verlauf, Kugel, Aurora) stehen an genau drei Stellen: Titelkarte, dunkler Raum, Schlussblock (`pruefen.mjs`:
höchstens drei Leinwände). Keine Dauer-Animation hinter Lesetext, keine konkurrierenden Bewegungen, keine Neon-Effekte.

**Showreel** (Vorlage „Superconscious“, in unsere CI übersetzt): eine hohe Spur (`.spur`, Rechner 1150vh · Tablet hoch 1000vh ·
Handy 900vh — kürzer als die Vorlage, Klarheit vor Länge) mit stehender Bühne (`.buehne`, sticky). EIN Fortschritt p (0 → 1),
geglättet durch eine kritisch gedämpfte Feder; **jeder bewegte Wert ist eine reine Funktion von p** (Phasen mit clamp/smoothstep),
gerechnet in jedem Bild — keine Keyframes für Scroll-Dinge (Keyframes nur für Vorhang, Laufband und den Rand beim Zeigen).

| p | Phase | Was geschieht |
|---|---|---|
| — | **Vorhang** | Knoten aus dem Logo (links Granat, rechts Smaragd) fügt sich über einer sanften Blüte zusammen, nach 1,9 s hebt der Vorhang ab (Bewegung reduzieren: 0,7 s ohne Bewegung). Wer scrollt oder eine Taste drückt, hebt ihn sofort. Ohne Skript gibt es ihn nicht. |
| 0,00–0,10 | **1 · Titelkarte** | dunkle Karte auf Off-White, ruhiger Mesh-Gradient (Anthrazit, dezente Granat/Smaragd-Lichter, folgt leicht der Maus, Auflösung 1, 36 fps). H1 „Innovation braucht Umsetzung / und Sichtbarkeit.“ (zweite Zeile 42 %), rechts ein Bildkarte mit dem Standbild der Kugel (neigt sich mit der Maus). Unten Satz, „Erstgespräch anfragen“ / „Den Weg ansehen“, Haarlinie, Fakten (Aus Berlin für Deutschland · Interim CSO · Interim Head of Sales · Fokus Innovation). Beim Scrollen gleiten die Buchstaben verschwommen nach unten weg. |
| 0,09–0,17 | **2 · Karussell** | die Karte schrumpft zur Marken-Karte (Wortmarke) und wird Teil eines Karussells aus vier Karten, dahinter das Laufband „Umsetzung · Sichtbarkeit · Vertrieb · Netzwerk · Fokus · Klarheit“ (25 s, 6 % Tinte). |
| 0,17–0,37 | | rotateY 0 → −270°, nach cos sortiert, mit **Rasten** (jede Karte steht vorn still — Lesezeit): **Umsetzung & Sichtbarkeit** (Beratung: Interim CSO, Interim Head of Sales, Events & Netzwerk-Strategie) · **Fokus & Klarheit** (eigene Software) · das **Tor** (Knoten). Darunter „Erstgespräch anfragen“. |
| 0,37–0,45 | **3 · Tor** | der Knoten teilt sich, ein Kreis öffnet das Papier in den dunklen Raum. |
| 0,44–0,60 | **4 · Dunkler Raum** | die **Kugel** aus der Szene (Smaragd/Granat, additiv, hohle Mitte, heller Rand — ruhig), Aurora sehr dezent an den Rändern. „Wachstum scheitert selten an Ideen. / Meist an der Umsetzung.“ steigt Buchstabe für Buchstabe auf, dazu der Absatz. Rechner: Text links, Kugel rechts; hochkant: Kugel oben, Text unten. |
| 0,60–0,80 | **5 · Band** | ruhige Karten ziehen von rechts nach links vorbei (Handy: rastet je Karte mittig ein): **Fokus Innovation** (sechs Städte, Berlin Ausgangspunkt, Link fokusinnovation.de) · **Make.One** · zwei Karten mit den **vier belegten Zahlen** (Zahlen-Trommel am Fortschritt, Fußnoten unverändert). Die Kugel steht klein und gedimmt oben rechts. |
| 0,79–0,91 | **6 · Flug** | die Kamera fliegt ruhig in die Kugel; sechs typografische Kacheln kommen aus der Tiefe (Wiederholung der Inhalte, `aria-hidden`). |
| 0,90–1,00 | **7 · Schluss** | Wortmarke über eigenem Verlauf, „Sprechen wir über dein Vorhaben.“ + „Erstgespräch anfragen“; der Rand aus Papier und der weiße Innenrahmen schnappen ein. |
| danach | **Im Detail** (Off-White) | Beratung im Detail (drei Angebote, drei Phasen, Beratungsfelder, Development „Coming Soon“) · Make.One + Make.Beteiligungen · Warum MAKE · Kontakt mit dem Erstgespräch (`#erstgespraech-link`) und den Quellen · ruhiger dunkler Fuß mit großer Wortmarke. |

**Navigation:** Kachel-Pille (dunkel auf jedem Grund): Logo-Kachel · Beratung · Make.One · Fokus Innovation ↗ · Warum wir · Kontakt ·
„Login“ · Ruf-Kachel „Erstgespräch“ (Off-White). Unter 1100 px ein Menü-Knopf (`<details>`, geht ohne Skript), unter 560 px ohne Ruf-Kachel.
Anker in der Spur fahren an die passende Stelle (Blöcke tragen `data-spur-p`); springt der **Tastatur-Fokus** in einen Block der Bühne,
fährt die Seite dorthin — nichts ist unerreichbar, auch wenn es gerade unsichtbar ist.

**Ruhige Fassung** (ohne Skript, „Bewegung reduzieren“, ohne WebGL, oder wenn die Szene scheitert): dieselben Blöcke stehen
untereinander — Titelkarte mit stehendem Verlauf (CSS), die zwei Karten nebeneinander, der dunkle Raum mit dem **Standbild der Kugel**,
das Band als Raster, der Schlussblock; der Flug entfällt. Versteckt (Deckkraft 0) wird nur unter `html.spur-an`, das allein
`js/szene/spur.js` setzt — nach der Prüfung auf „Bewegung reduzieren“ und WebGL. Bis das Skript entscheidet, deckt ein dunkler Grund die
Startseite (nur mit Skript, spätestens nach 2,5 s weg).

**Barrierefreiheit:** eine H1; zerlegte Überschriften tragen vorn eine unsichtbare Kopie, die Buchstaben sind `aria-hidden`
(`MakeSzene.buehne.zerlegen`); Zahlen der Trommel mit unsichtbarer Kopie; Szene und Flug `aria-hidden`, die Szene in einem Satz
beschrieben; Fokus sichtbar (auf Papier Tinte, auf Dunkel Türkis); Tippziele ≥ 44 px; 375 px ohne waagerechtes Scrollen; kein
Scrollbalken-Trick, kein Scroll-Sperren.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf (Kachel-Pille), die Spur mit Bühne (Szene, Papier mit Laufband, Karussell, dunkler Raum, Band, Flug, Schluss), die Abschnitte im Detail, Fuß |
| `js/szene/spur.js` | **wiederverwendbar — der Showreel-Baukasten:** p über die Spur + Feder, Stufen (rechner/tablet/handy wie `--sr-*`), Vorhang, Werkzeuge (`sicht`, `stil`, Buchstaben-Zerfall/-Aufstieg, Karussell nach cos, Rasten, Trommel am Fortschritt, Maus, Szene steuern, Verlauf), Anker/Tastatur-Fokus, ruhige Fassung. Kennt keine Inhalte. |
| `js/szene/verlauf.js` | **wiederverwendbar:** ruhiger Mesh-Gradient (WebGL 1, Auflösung 1, höchstens 36 fps, nur sichtbar und gebraucht) |
| `js/szene/kern.js` | **wiederverwendbar:** Mathematik ohne DOM (Zufall, Matrizen, Pfad, Kamera, Feder, Optionen) |
| `js/szene/formationen.js` | **wiederverwendbar:** Formationen als Punkte + Linien — neu `kugel` (dichte Hülle, links Granat, rechts Smaragd, heller Rand, hohle Mitte, eigener fester Zufall: mehrere Zustände = dieselbe Kugel); `netz: false` / `pfad: false` im Drehbuch stellen Netz, Lichtfäden und Staub ab; `tafel` nur für fokusinnovation.de |
| `js/szene/motor.js` | **wiederverwendbar:** WebGL-1-Motor der Szene — neu: `fortschritt: 'extern'` (folgt `MakeSzene.fortschritt` statt Abschnitten), `teilchen` je Gerät, `hell` je Zustand, `handy()` aus dem Drehbuch, `.szene[data-ruht]` (zeichnet nicht, solange verdeckt), kein Teilchen-Bogen, wenn die Formation gleich bleibt |
| `js/drehbuch.js` | **nur diese Seite:** Zustände der Szene (raum · band · flug mit p/bis) und die Choreografie (`MakeSzene.showreel`: was bei welchem p geschieht) |
| `js/menue.js`, `js/erstgespraech.js` | Handy-Menü schließen; Ziel des Erstgesprächs für alle Knöpfe mit `data-erstgespraech` |
| `js/lichtfaeden.js` | Lichtfäden-Zeichner (Canvas 2D) — **erzeugt** aus der App (`node scripts/lichtfaeden-website.mjs`), auf der Startseite nicht eingebunden; gemeinsame Quelle mit fokus/ |
| `css/seite.css` | Tokens (das erste `:root` gleich `fokus/css/fokus.css`), neu `--papier`/`--tinte*` (Off-White, siehe Kommentar) und `--sr-*` je Stufe; ruhige Fassung + Showreel (`.spur-an`) aus einem HTML |
| `assets/szene/raum.svg` | Standbild der Kugel (`node website/standbild.mjs`) — Titelkarte und ruhige Fassung |
| `impressum.html`, `datenschutz.html`, `404.html` | Rechtstexte auf Off-White (Inhalt unverändert; Datenschutz: Satz zu den acht Skripten angepasst) |
| `assets/logo/` | Logo v5 „Synapse“ aus `scripts/website-logo.mjs` (nie von Hand ändern) — `assets/logo/LOGO.md` |
| `logo-entwuerfe.html`, `pruefen.mjs`, `stempeln.mjs`, `standbild.mjs`, `LIESMICH.md` | Arbeitsdateien (werden nie ausgeliefert) |

**Off-White (neu 04.10.):** Die CI von MAKE hatte bisher kein Off-White. `--papier` #F4F3EF ist ein warmes, leicht gebrochenes Weiß
(ruhiger als reines Weiß, passt zum warmen Granat); Tinte darauf = dunkler Grund der Marke #0B0E10 (wie MAKE im hellen Logo, 17,4 : 1),
Lesetext `--tinteDim` #4F5A5D (INNOVATION im hellen Logo, 6,4 : 1), Beschriftungen `--tinteLeise` #5C6669 (5,3 : 1).

### Ändern
- **Text:** `index.html`. **Zeitplan / Bewegung:** `js/drehbuch.js` › `bild(p, w)` (je Phase ein Block). **Bild der Szene:** `js/drehbuch.js`
  › `S.drehbuch.zustaende` (Kamera, `hell`, `p`/`bis`), danach `node website/standbild.mjs`. **Größen je Stufe:** `--sr-*` in `css/seite.css`.
- **Danach immer:** `node website/stempeln.mjs` und `node website/pruefen.mjs`.
- **Lokal ansehen:** `python3 -m http.server 3013 -d website` über einen Eintrag in `.claude/launch.json` (nicht per Bash).

### Andocken für fokus/ (seit 05.10.2026, eine Quelle)
`js/szene/spur.js`, `verlauf.js`, `kern.js`, `formationen.js`, `motor.js` kennen keine Inhalte und sind das **Original** auch für
fokusinnovation.de: `node scripts/fokus-seite.mjs` (über `scripts/szene-website.mjs`, Liste `ZIELE`) kopiert sie byte-gleich nach
`fokus/js/szene/` und stempelt fokus/ (Wächter `tests/szene-website.test.ts`, `fokus/pruefen.mjs` › `GLEICH_WIE_WEBSITE`). fokus/ bringt
nur ein eigenes `js/drehbuch.js` (Zustände, `bild(p, w)`), dieselbe Spur-Struktur (`.spur > .buehne`, `data-spur-p`) und eigene `--sr-*`.
**Nach jeder Änderung hier:** `node website/stempeln.mjs`, `node website/standbild.mjs` (darf sich für diese Seite nicht ändern),
`node scripts/fokus-seite.mjs`, `node website/standbild.mjs fokus`. Was fokus/ dazu brauchte, ist **freiwillig** — ohne Angabe im
Drehbuch bleibt diese Seite unverändert: die Formation `tafel` (ein Abend in kleiner Runde, eigener fester Zufall wie `kugel`).
`standbild.mjs` nimmt einen Ordner und liest die Beschriftungen aus `index.html` (`span.marke[data-zustand][data-nr]`); die Prüfung des
Showreels steht als `pruefeShowreel()` in `pruefen.mjs` und gilt für beide Seiten (fokus/: höchstens zwei Lichter).

### Gewicht, Tempo (gemessen 04.10., headless Chrome, Apple M3)
- **Startseite** (HTML + CSS + acht Skripte, gzip) ≈ 64 KB; ausgeliefert ohne Schriften ≈ 82 KB (mit Standbild der Kugel 17 KB),
  mit Schriften ≈ 142 KB (`pruefen.mjs`: Grenze 400 KB).
- **Bildrate** beim Scrollen über die ganze Seite: Rechner 1440 × 900 **60 fps**, längstes Bild 16,8 ms; Handy 375 × 812 mit 4× gedrosselter
  CPU **60 fps**, längstes Bild 16,8 ms (drei Läufe; ein früherer kalter Lauf hatte einmal 417 ms beim ersten Erscheinen der Karten).
  Aufbau der Szene einmalig ≈ 85–200 ms (gedrosselt). Konsole leer, kein waagerechtes Scrollen (375 / 820 / 1440 px).

## Freigabe — in dieser Reihenfolge

1. **Platzhalter füllen.** Jeder offene Wert steht gelb markiert als `<span class="ph">[[KEVIN: …]]</span>` in der Seite.
   Beim Füllen das **ganze** `<span class="ph">…</span>` durch den Text ersetzen (sonst bleibt die gelbe Markierung —
   die Prüfung meldet das). Abschnitte, die nicht zutreffen (z. B. USt-IdNr.), ganz streichen.
2. **Prüfen:** `node website/pruefen.mjs` → muss **„freigabefähig“** melden (Ausgang 0). Er prüft außerdem: Firmierung
   „eine Marke der KEMARIS Innovation GmbH“ auf jeder Seite und **nirgends eine GmbH namens MAKE Innovation**, Beschreibung und — solange
   `robots.txt` sperrt — `noindex` je Seite, keine
   Skripte, keine Inline-Stile, keine fremden Quellen/Tracker, eine H1 je Seite, Login-Knopf, Impressum- und
   Datenschutz-Link, alle eigenen Links und Anker — dazu: Skripte nur aus `js/` und ohne Speichern/Senden, Logo-Dateien
   vollständig, Schlussblock mit `assets/logo/wortmarke.svg`, Showreel (Spur + Bühne, Zustände mit Lage p, Standbild ohne tote Dateien, Lichter an höchstens drei Stellen, Buchstaben-Bewegung nur an H1 und Raum-Überschrift), Navigation, Angebote (drei mit „Erstgespräch anfragen“, genau
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

## Offene Platzhalter (Stand 04.10.2026, „Klar“)

- **Startseite › Warum MAKE › Vertrieb aus der Praxis:** ein Satz zu Kevins Vertriebserfahrung (ohne Kundennamen)

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
- **Belegte Zahlen** (Kevin 03.10.): vier Kacheln in zwei Karten des Bands („Ideen gibt es genug.“, „KI macht aus Ideen schneller Ergebnisse.“),
  jede mit Fußnote; die Quellenliste steht im Abschnitt Kontakt (`#quellen`). Nur Originalquellen, direkt am Dokument geprüft (Stand der Prüfung 03.10.2026). Neue Zahl = neue Quelle in
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
