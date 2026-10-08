# Landingpage makeinnovation.de — MAKE Innovation (eine Marke der KEMARIS Innovation GmbH)

> **Stand 08.10.2026 (Kevin):** Beide Seiten sind **offline** (Caddy antwortet 503, Hotfix 1de19d8c auf `main`). KEMARIS steht
> **nirgends mehr** — Absender überall nur „MAKE Innovation“, Kontakt hello@makeinnovation.de, ohne Telefon; verantwortlich nach
> § 18 MStV Kevin Dieckmann; Registerangaben als Platzhalter bis zur Eintragung der Umbenennung. `pruefen.mjs` meldet jedes „KEMARIS“
> als Fehler. Was weiter unten zur Firmierung „eine Marke der KEMARIS Innovation GmbH“ steht, ist Verlauf.
> Wieder online: Platzhalter füllen → in `deploy/caddy/Caddyfile` den OFFLINE-Block löschen und die Fassungen entkommentieren → Upload auf Kevins Wort → Caddy reload.


Statische Seite (HTML + zwei CSS-Dateien + drei kleine eigene Skripte, keine Cookies, kein Tracking, kein Speicher im Browser,
Schriften selbst gehostet). Stand **„v3 · Der Weg“ (07.10.2026 abends, Branch `websites-v3`, nicht online)** auf der Grundlage von **„Klar 2“ (07.10.2026)** — Kevin: „Das sieht alles noch scheiße aus. Ich will, dass du die
Homepages richtig sauber machst.“ und „Wir wollen innovativ UND seriös wirken. Wir haben auch in [unserer Software] keine Spielereien —
das soll sich auch so durchziehen.“ Weiter gilt: 80 % Seriosität und Souveränität, höchstens 20 % Akzente, klare Linien, kein Gewusel —
„wenn ein Investor draufschaut, soll er sagen: oh Gott“.

**Botschaft:** Umsetzung & Sichtbarkeit für Unternehmen, die Innovation in den Markt bringen — Interim CSO, Interim Head of Sales,
Events & Netzwerk-Strategie, Make.One, Fokus Innovation. EIN Haupt-Ruf: „Erstgespräch anfragen“. Ton seriös und beratend, Anrede
„Du“; Impressum und Datenschutz „Sie“. Der Name der Software steht nirgends im Ordner; oben rechts nur „Login“.

**Firmierung (Kevin 03.10., rechtlich):** Eine GmbH unter dem Namen „MAKE Innovation“ ist nicht eingetragen. Überall steht
„MAKE Innovation“ und darunter klein „eine Marke der KEMARIS Innovation GmbH“; Impressum und Datenschutz nennen die
Kemaris Innovation GmbH (Schönefeld, HRB 19873, AG Cottbus). `pruefen.mjs` hält das fest.

Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
Sie ist als **nicht indexierte Vorschau** aktiv (`X-Robots-Tag: noindex`, `robots.txt` sperrt, jede Seite trägt
`<meta name="robots" content="noindex">`). Die CSP bleibt unverändert (`script-src 'self'`, keine Inline-Skripte, kein eval).

## v3 · Der Weg (07.10. abends) — was sich gegenüber „Klar 2“ ändert

Kevin 07.10. abends: „Nimm die Kugel raus. Bau das Ganze nochmal und bring Innovation nach vorne. Ich brauche keine 0815-KI-Homepage.“
Die Grundlage von „Klar 2“ bleibt (Papier, Tinte, Raster, Typo, Knöpfe, keine Spielereien); geändert wird, **wie** Innovation sichtbar wird:
durch ein eigenes Leitmotiv und gezeichnete Arbeit statt eines dekorativen Bilds.

- **Kugel raus.** `assets/bild/kugel.svg` und `.licht` sind weg; `pruefen.mjs` lässt kein Kugel-Bild und kein dekoratives Licht mehr zu
  (in der Software bleibt die Kugel).
- **Leitmotiv Linienplan** „Der Weg der Innovation“ (aus dem Logo: rote Linie = Idee und Strategie, der Knoten = Umsetzung, grüne Linie =
  Vertrieb und Markt). Im Einstieg als SVG-Grafik (`role="img"`, Titel und Beschreibung), im Abschnitt **03 Der Weg** als Strecke mit sechs
  Etappen (`.strecke`), im Kontakt als Halt vor dem Erstgespräch („Der erste Halt ist ein Gespräch“).
- **Rhythmus statt EINES dunklen Abschnitts:** höchstens **zwei dunkle Abschnitte** (`.dunkel`: Der Weg, Kontakt) und **EINE Farbfläche**
  (`.farbflaeche`, Granat auf Papier, Weiß darauf 6,4 : 1: „Was Innovation bei uns heißt“). Der Rest bleibt Papier — 80 % Seriosität.
- **Arbeits-Schemata statt Behauptungen:** je Leistung Ausgangslage · Was wir tun · Was danach steht · Dauer & Form und daneben ein
  gezeichnetes Schema (Woche im Mandat, Vertriebs-Strecke, Botschaft in einem Satz, Einladung, Umsetzungs-Board). Jedes trägt „Schema ·“
  bzw. „Beispiel ·“ in der Beschriftung — keine echten Zahlen, Kunden oder Termine.
- **Neue Leistung „Sichtbarkeit & Marketing“** (aus den früheren Beratungsfeldern Botschaft, Unterlagen, Kanäle), gleichwertig mit „Erstgespräch anfragen“.
- **Gründer** (`#ueber-uns`, „Zwei Linien. Ein Knoten.“) und **Häufige Fragen** (`#fragen`, 5–7 aufklappbare `<details>`, ohne Skript).
- **Bewegung genau einmal:** die Linie im Einstieg zeichnet sich beim Laden, die Strecke weiter unten beim ersten Erscheinen (`js/weg.js`:
  ein Beobachter, der jede Linie danach abmeldet; nichts hängt am Scrollen). Nur unter `prefers-reduced-motion: no-preference`; ohne Skript
  und bei „Bewegung reduzieren“ steht alles sofort fertig da.

**Ruhe-Regeln v3** (`pruefeRuhe` in `pruefen.mjs`, gilt auch für fokusinnovation.de; Wächter `tests/website-landingpage.test.ts` › Ruhe (v3),
`tests/fokus-seite.test.ts` › Rhythmus (v3)):

| Regel | „Klar 2“ | v3 |
|---|---|---|
| Scroll-Film (Spur, Bühne, Szene, Leinwand), scroll-gebundene Skripte, `setInterval`, `requestAnimationFrame` | verboten | verboten (unverändert) |
| Dunkle Abschnitte · Farbflächen | höchstens 1 · keine | höchstens **2** · höchstens **1** |
| Licht/Standbild | genau ein Licht (Kugel-Standbild) | **kein** Kugel-Bild, kein `.licht` |
| CSS-Animation | keine | nur in `@media (prefers-reduced-motion: no-preference)`, nie `infinite`, nie öfter als einmal, nie Scroll-Timeline |
| Verborgener Inhalt | — | nur im Bewegungs-Block, nur unter `.wartet` (setzt `js/weg.js`, ohne Skript nie) oder als Anfang eines `@keyframes` |
| Skript mit `IntersectionObserver` | — | nur mit `unobserve`/`disconnect` (einmal) und mit Rücksicht auf „Bewegung reduzieren“ |
| „Bewegung reduzieren“ | `@media (prefers-reduced-motion: reduce)` Pflicht | unverändert Pflicht (schaltet Übergänge und Animationen ab) |

## Klar 2 (07.10.) — Gestaltungsplan

> Seit v3 gelten die Abschnitte unten nur noch, wo der Abschnitt oben nichts anderes sagt (Kugel/Licht, „EIN dunkler Abschnitt“,
> „keine Animation“ und die Abschnittsliste sind durch v3 ersetzt).

**Entscheidungen (Klickrunde 07.10.):** Richtung „innovativ UND seriös, keine Spielereien“ · Grundton **hell → dunkel** (Off-White mit
dunkler Schrift, EIN dunkler Abschnitt für die Wirkung) · Belege **nur als Prinzipien** (keine Statistiken, Prozentzahlen, Marktgrößen).

**Innovativ durch Präzision, nicht durch Effekte.** Eine normale Dokument-Seite: kein Scroll-Jacking, keine Bühne, keine scroll-gebundenen
Phasen. Jeder Abschnitt ist im Ruhezustand vollständig lesbar — ohne Skript und bei „Bewegung reduzieren“ genauso. Die Höhe richtet sich
nach dem Inhalt (Rechner ≈ 8,5 Bildschirme statt 11 Bildschirme Scroll-Film).

### Was entfällt und warum

| Entfällt | Warum |
|---|---|
| Showreel (Spur 1150vh, stehende Bühne, Feder, Phasen p) | Scroll-Jacking und leere Zwischenzustände — genau die „Spielerei“, die Kevin nicht will |
| WebGL-Szene (Kugel aus Lichtpunkten live, Mesh-Verläufe, Aurora), `js/szene/*`, `js/drehbuch.js`, `standbild.mjs` | Dauer-Animation hinter Lesetext; drei Leinwände; ≈ 100 KB Skript. Das eine Licht ist jetzt ein **Standbild** derselben Kugel |
| Vorhang, Karussell, Laufband, Flug-Kacheln, Buchstaben-Zerfall/-Aufstieg, Zahlen-Trommel, laufender Rand an Knöpfen | Choreografie ohne Inhalt; abgeschnittene Karten; Ablenkung vom Lesen |
| Vier Zahlen-Kacheln mit Fußnoten (KfW, Bitkom) und die Quellenliste | Kevin 07.10.: Belege nur als Prinzipien. Der Datenschutzhinweis nennt deshalb keine Quellenlinks mehr |
| Karte „Fokus & Klarheit — eigene Software“ | aufgegangen im Grundsatz „Struktur, die bleibt“ (ein Satz, ohne Namen) |
| Riesige Wortmarke im Fuß, dunkle Kachel-Pille als Kopf | zu laut; der Kopf ist hell und ruhig, die Wortmarke steht klein im dunklen Fuß |
| `js/lichtfaeden.js` (+ `scripts/lichtfaeden-website.mjs`) | war schon seit „Klar“ nicht eingebunden — tote Datei |

### Farben (Tokens in `css/seite.css`, Werte wie `lib/make-one/design.ts`)

| Rolle | Token | Wert |
|---|---|---|
| Papier (Grund) · Papier hell (Flächen, Menü) | `--papier` · `--papierHell` | #F4F3EF · #FAF9F6 |
| Tinte (Titel) · Lesetext · Beschriftung | `--tinte` · `--tinteDim` · `--tinteLeise` | #0B0E10 (17,4 : 1) · #4F5A5D (6,4 : 1) · #5C6669 (5,3 : 1) |
| Haarlinien auf Papier | `--haar` · `--haarStark` | Tinte 12 % · 28 % |
| Dunkler Schlussakt und Fuß | `--grund`, Text `--ink` · `--inkDim` · `--inkLeise` | #0B0E10, #E8ECEA · #A2ADB0 · #86918F (= FARBE) |
| Akzente (sparsam) | `--granat` · `--smaragd`, auf Papier `--granatPapier` · `--smaragdPapier` | #C9465C · #2FA878, #A82E44 · #167A55 |

Granat und Smaragd erscheinen nur als Knoten-Zeichen (Vorzeile, Fokus-Kasten), in „MA/KE“, in den Kürzeln der Gründer (getönt wie in der
Software), als „Ausgangspunkt“ und im einen Licht. Knöpfe sind Tinte (hell) bzw. Weiß (dunkel) — nie farbig.

### Typo-Skala (Archivo für Titel, Public Sans für Text; selbst gehostet)

| Stufe | Token | Größe (390 → 1440 px) | Schnitt |
|---|---|---|---|
| H1 | `--t-held` | 40 → 76 px (fokusinnovation.de: 52 → 120 px) | Archivo 600, −0,035 em, Zeilenhöhe 1,02 |
| H2 | `--t-titel` | 30 → 50 px | Archivo 600, −0,03 em |
| H3 / Kartentitel | `--t-unter` | 20 → 24 px | Archivo 600 |
| Einleitung | `--t-lead` | 17 → 21 px | Public Sans 400, Tinte-Dim, höchstens 62 Zeichen |
| Fließtext · Listen | `--t-body` · 15 px | 16 px · 15 px | Public Sans 400, Zeilenhöhe 1,65 |
| Bedienung · Kleintext | `--t-bedien` | 14 px | Public Sans 500 |
| Beschriftung | `--t-mikro` | 12 px, GROSSBUCHSTABEN, +0,12 em | Public Sans 600 |

Überschriften bestehen aus zwei Sätzen: der zweite (`.ruhig`) steht in eigener Zeile in Tinte-Dim — „Verantwortung auf Zeit. / Mit klarer Agenda.“

### Raster, Abstände, Ecken
- **12 Spalten**, Inhalt höchstens 1168 px (`--breite` 1280 inkl. Rand), Rand 20 → 56 px, Rinne 16 → 32 px.
- **Abschnitt:** starke Linie (1 px Tinte) oben; links „01 Beratung“ (Spalten 1–3), rechts Titel + Einleitung (4–12); darunter der Inhalt.
  Abstand zwischen Abschnitten 80 → 144 px (`--abschnitt`).
- **Haarlinien statt Kartenwand:** Angebote als gleichwertige Spalten mit senkrechten Haarlinien, Listen mit Haarlinien je Zeile, Schritte als
  Linie mit Knoten. Genau EINE hervorgehobene Fläche je Seite (`.kasten`, Fokus Innovation).
- **Ecken wie die Software (ECKE):** Knopf 14, flache Fläche 16, Karte 20, Pille 999. Tippziele: Hauptknopf 48/52 px, alles andere ≥ 44 px.

### Bausteine (`css/seite.css` — EINE Quelle für beide Seiten)
Kopf (hell, sticky, Handy-Menü als `<details>`) · Knöpfe (`.knopf` Tinte = die Hauptaktion, `.knopf.zweit` Kontur, `.textlink`) · Vorzeile mit
Knoten · Held mit **Index** (vier Einträge mit Nummer und Haarlinie) · Abschnitt-Kopf · `.angebote` · `.schritte` · `.eintraege` · `.kasten` ·
`.liste` · `.dunkel` (der eine dunkle Abschnitt) · `.licht` (das eine Standbild) · Fuß (dunkel) · Rechtstexte · „Bewegung reduzieren“.
Seitenspezifisch: `css/start.css` (hier) bzw. `fokus/css/fokus.css` — beide setzen **keine** Tokens.

### Abschnitte — makeinnovation.de
1. **Einstieg** (Papier): Vorzeile „MAKE Innovation · Aus Berlin, für Deutschland“ mit Knoten · H1 „Innovation braucht Umsetzung / und
   Sichtbarkeit.“ · Satz · „Erstgespräch anfragen“ + „Was wir tun“ · Index: Interim CSO · Interim Head of Sales · Events & Netzwerk-Strategie ·
   Make.One & Fokus Innovation (je mit Satz, verlinkt).
2. **01 Beratung** (`#markttraktion`): „Verantwortung auf Zeit. / Mit klarer Agenda.“, für wen (drei Pillen), drei Angebote mit
   „Erstgespräch anfragen“, darunter „MAKE Innovation Development — Coming Soon“.
3. **02 Vorgehen** (`#so-arbeiten-wir`): drei Phasen auf einer Linie, der Wochenrhythmus, sechs Beratungsfelder.
4. **03 Netzwerk** (`#make-one`): Make.One (Formate, Merkmale, „Einladung anfragen“), der Kasten **Fokus Innovation** (`#fokus-innovation`,
   sechs Städte, Link fokusinnovation.de), **Make.Beteiligungen** (`#beteiligungen`, „Projekt einreichen“, Hinweis keine Anlageberatung).
5. **04 Warum MAKE** (`#ueber-uns`): „Zwei Linien. / Ein Knoten.“, MA/KE, „Warum du mit uns arbeiten solltest.“ (vier Grundsätze), Malin und Kevin.
6. **05 Kontakt** (`#kontakt`, **der dunkle Schlussakt**): „Wachstum scheitert selten an Ideen. / Meist an der Umsetzung.“, das Erstgespräch
   (`#erstgespraech`, `#erstgespraech-link`), „Pitch-Deck anfordern“, rechts das **eine Licht**: das Standbild der Kugel (`assets/bild/kugel.svg`,
   statisch, dekorativ). Der dunkle Grund geht in den Fuß über (eine Haarlinie trennt).
7. **Fuß** (dunkel): Wortmarke, Firmierung, Beratung · MAKE · Kontakt (inkl. Impressum, Datenschutz, Login), „© 2026 MAKE Innovation / eine Marke
   der KEMARIS Innovation GmbH“.

**Bewegung:** nur Übergänge beim Zeigen/Fokus (Pfeil rückt 3 px, die Linie über einem Index-Eintrag zieht sich auf, Farbwechsel ≤ 0,35 s);
keine Animation, kein Parallax, nichts hängt am Scrollen. Bei „Bewegung reduzieren“ entfallen auch die Übergänge.

**Barrierefreiheit:** eine H1 je Seite, Abschnitte mit `aria-labelledby`, Sprung-Link „Zum Inhalt“, sichtbarer Fokus (2 px Tinte, auf Dunkel
Weiß), Kontrast AA (siehe Farben), Tippziele ≥ 44 px am Handy (gemessen), Menü per Tastatur (`<details>`, Esc schließt), das Licht `aria-hidden`.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf, Einstieg mit Linienplan, 01 Farbfläche, 02 Leistungen, 03 Der Weg (dunkel), 04 Netzwerk, 05 Beteiligungen, 06 Gründer, 07 Fragen, 08 Kontakt (dunkel), Fuß |
| `css/seite.css` | **Gestaltungsgrundlage** (Tokens, Bausteine) — Original; `fokus/css/seite.css` ist eine Byte-Kopie (`node scripts/fokus-seite.mjs`) |
| `css/start.css` | nur die Startseite (Development-Zeile, Rhythmus, Netzwerk-Raster, Fokus-Kasten, Beteiligungen, Grundsätze, Gründer, Schlussakt) |
| `js/menue.js`, `js/erstgespraech.js` | Handy-Menü schließen; Ziel des Erstgesprächs für alle Knöpfe mit `data-erstgespraech` |
| `js/weg.js` | v3: die Linie zeichnet sich einmal (setzt `.wartet` nur an Linien unter dem Bild, entfernt es beim ersten Erscheinen) — Byte-Kopie in `fokus/js/` |
| `impressum.html`, `datenschutz.html`, `404.html` | Rechtstexte auf Papier mit dunklem Fuß (Inhalt unverändert; Datenschutz: Skript-Satz angepasst, „Links zu Quellen“ entfällt) |
| `assets/logo/` | Logo v5 „Synapse“ aus `scripts/website-logo.mjs` (nie von Hand ändern) — `assets/logo/LOGO.md`. Kopf: `quer-hell`/`kompakt-hell`, Fuß: `wortmarke` |
| `logo-entwuerfe.html`, `pruefen.mjs`, `stempeln.mjs`, `LIESMICH.md` | Arbeitsdateien (werden nie ausgeliefert) |

### Ändern
- **Text:** `index.html`. **Aussehen beider Seiten:** `css/seite.css`, danach `node scripts/fokus-seite.mjs` (Kopie nach fokus/ + Stempel).
  **Nur diese Seite:** `css/start.css`.
- **Danach immer:** `node website/stempeln.mjs` und `node website/pruefen.mjs` (und `node fokus/pruefen.mjs`, wenn `seite.css` geändert wurde).
- **Lokal ansehen:** `python3 -m http.server 3016 -d website` (bzw. über einen Eintrag in `.claude/launch.json`).

## Freigabe — in dieser Reihenfolge

1. **Platzhalter füllen.** Jeder offene Wert steht gelb markiert als `<span class="ph">[[KEVIN: …]]</span>` in der Seite.
   Beim Füllen das **ganze** `<span class="ph">…</span>` durch den Text ersetzen (sonst bleibt die gelbe Markierung —
   die Prüfung meldet das). Abschnitte, die nicht zutreffen (z. B. USt-IdNr.), ganz streichen.
2. **Prüfen:** `node website/pruefen.mjs` → muss **„freigabefähig“** melden (Ausgang 0). Er prüft außerdem: Firmierung
   „eine Marke der KEMARIS Innovation GmbH“ auf jeder Seite und **nirgends eine GmbH namens MAKE Innovation**, Beschreibung und — solange
   `robots.txt` sperrt — `noindex` je Seite, keine Inline-Skripte, keine Inline-Stile, keine fremden Quellen/Tracker, eine H1 je Seite,
   Login-Knopf, Impressum- und Datenschutz-Link, alle eigenen Links und Anker — dazu: Skripte nur aus `js/` und ohne Speichern/Senden,
   Logo-Dateien vollständig (Kopf `quer-hell`, Fuß `wortmarke`), Navigation, Angebote (drei mit „Erstgespräch anfragen“, genau ein
   „Coming Soon“ bei Development), Mail-Knöpfe Make.One/Make.Beteiligungen, **Ziel des Erstgesprächs an genau einer Stelle**
   (`#erstgespraech-link`: vorbereitete Mail oder Buchungsseite mit gültigem Slug), **keine Preise**, **keine Statistiken/Prozentzahlen**,
   **Ruhe** (`pruefeRuhe`, gemeinsam mit fokus/: kein Scroll-Film, keine Leinwand, höchstens ein Licht und ein dunkler Abschnitt, keine
   CSS-Animationen, keine scroll-gebundenen Skripte, „Bewegung reduzieren“ beachtet, keine toten Bilder), Gewicht der Startseite ≤ 80 KB gzip,
   **Sperrliste**: keine anderen Firmen-, Marken- oder Projektnamen (nur MAKE; KEMARIS nur in der Firmierung), der Name der Software
   nirgends im Ordner, Wortregeln (kein „Dashboard“, „Tool“, „Reporting“, „Disruption“, „einfach zu bedienen“).
3. **Kevin sieht die Seite lokal an** und gibt sie ausdrücklich frei.
4. **Vorschau beenden** (erst, wenn die Seite beworben wird): in `deploy/caddy/Caddyfile` die Zeile `X-Robots-Tag` entfernen,
   `website/robots.txt` öffnen (`Disallow:` leer) und in allen Seiten `<meta name="robots" content="noindex">` streichen
   (`pruefen.mjs` verlangt das Meta-Tag nur, solange `robots.txt` sperrt). `npx vitest run tests/caddy-buchung-koepfe.test.ts`.
5. **Hochladen nur auf Kevins Wort** (wie immer: `entwicklung` → `main`). Danach auf dem Server einmal
   `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` und
   `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` (Caddy lädt eine geänderte Caddyfile nicht
   von selbst). Prüfen: `curl -sI https://makeinnovation.de` → 200 mit `content-security-policy`,
   `curl -sI https://www.makeinnovation.de` → 301 auf `https://makeinnovation.de/`.

## Offene Platzhalter (Stand 08.10.2026, v3)

- keine — Gründer-Satz von Kevin gewählt (08.10.): „Er hat Vertrieb als Geschäftsführer, CRO und Head of Sales aufgebaut — in Fintech, Software und Beratung.“

## Später auf Buchungsseite umstellen

Hauptweg ist vorerst **„Erstgespräch anfragen“ → vorbereitete Mail** an `hello@makeinnovation.de` (Betreff
„Erstgespräch – Markttraktion“, Text: Firma, worum es geht, 2–3 Terminvorschläge), weil die Buchungsseite der Software
noch nicht so weit ist. Das Ziel steht an **genau einer Stelle**: `index.html`, Knopf `id="erstgespraech-link"`
(dunkler Schlussakt „05 Kontakt“). Alle anderen Knöpfe tragen `data-erstgespraech` und übernehmen es über `js/erstgespraech.js`.
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
- Die Seite nennt keine Preise, Kundennamen, Kundenzahlen, Statistiken oder Erfolgsversprechen — bewusst. Die Fakten zu den Mandaten
  (ca. 2 Tage pro Woche, wöchentliche Calls, 6–12 Monate, Make.One-Zugang beim Interim CSO) sind Kevins Vorgaben vom 01.10.
- Die Make.One-Formate (Stammtisch, Dinner, Workshop, Webinar) haben je einen allgemeinen Satz, keine Termine oder Orte.
- Gründer-Texte: MAKE = Malin + Kevin, Malins Zeile aus v2 (Kevins Worte, 27.09.). Ohne Fotos — Kürzel in Personenfarbe.
  Fotos nur, wenn ihr sie freigebt (dann als Datei in `assets/`, `img-src 'self'` erlaubt das).
- Anrede auf der Startseite **„Du“** (Kevin 03.10.); **Impressum und Datenschutz bleiben förmlich („Sie“)** — Rechtstexte.
- Neu formuliert (07.10.): Vorzeile „MAKE Innovation · Aus Berlin, für Deutschland“, Index-Sätze, Einleitung „Vorgehen“, Fokus-Kasten-Satz,
  Grundsatz „Struktur, die bleibt“ (mit dem Satz zur eigenen Software), Schlussakt-Satz. Die belegten Zahlen (KfW, Bitkom) stehen nur noch im
  Git-Verlauf (Commit e008ebfc) — falls sie später wieder gebraucht werden, mit Quelle prüfen.

## Gewicht (gemessen 07.10. abends, v3, gzip)
Startseite (HTML + zwei CSS + drei Skripte) ≈ **22 KB** („Klar 2“ ≈ 16 KB, davor ≈ 64 KB); dazu Schriften ≈ 60 KB. Kein Standbild mehr — die
Grafiken sind Inline-SVG in `index.html`. fokusinnovation.de ≈ 18 KB. `pruefen.mjs`: Grenze 80 KB. Konsole leer; kein waagerechtes Scrollen bei 1440 / 1024 / 768 / 390 px.

## Stempel für Stile und Skripte (04.10.2026)
Caddy liefert Seiten immer frisch, `css/` und `js/` bleiben einen Tag im Browser. Nach dem ersten v5-Upload sah deshalb wer
die Seite vorher besucht hatte, die neue Seite mit alten Stilen/Skripten (kaputt). Seitdem trägt jeder Verweis die Prüfsumme der
Datei (`css/seite.css?v=…`). **Nach jeder Änderung an `css/` oder `js/`: `node website/stempeln.mjs`** — `pruefen.mjs` meldet
fehlende oder veraltete Stempel (Wächter: tests/website-landingpage.test.ts › Stempel).

## Rückweg
v3 liegt auf Branch `websites-v3` (Commits ab `32f3807c`); der Stand davor („Klar 2“) ist `000da837` (Branch `websites-klar-2`) — `git checkout 000da837 -- website fokus scripts tests`
holt ihn vollständig zurück (mit Prüfer und Tests der „Klar 2“-Regeln).
Der Stand vor „Klar 2“ (Showreel mit Szene) ist Commit `e008ebfc` auf `entwicklung` — z. B. `git checkout e008ebfc -- website fokus scripts tests`
holt ihn vollständig zurück (Prüfer, Generatoren und Tests gehören dazu).

> **Hinweis, keine Rechtsberatung:** Impressum und Datenschutzhinweis sind nach bestem Wissen aus dem tatsächlichen
> Verhalten der Seite und des Servers abgeleitet (Stand Oktober 2026: § 5 DDG, DSGVO, TDDDG; die frühere Pflicht zum
> Link auf die EU-OS-Plattform ist mit deren Abschaltung im Juli 2025 entfallen). Vor der Freigabe von einer
> fachkundigen Person prüfen lassen.
