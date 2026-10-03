# Landingpage makeinnovation.de — MAKE Innovation (eine Marke der KEMARIS Innovation GmbH)

Statische Seite (HTML + eine CSS-Datei + sechs kleine eigene Skripte, keine Cookies, kein Tracking, kein Speicher im
Browser, Schriften selbst gehostet). Stand **v4 (03.10.2026)**: „Innovation braucht Umsetzung.“ — Beratung (Interim CSO,
Interim Head of Sales, Events & Netzwerk-Strategie), Make.One als Netzwerk für junge und erfahrene Entscheider,
Make.Beteiligungen und Development kompakt, „Warum wir“. Dazu die **Neuronen-Bühne**: oben das Logo, beim Scrollen
lösen sich Rot und Grün in Neuronen auf, die je Kapitel ein Bild formen; im Kontakt fließt das Netz zurück ins Logo.
Der Name der Software steht bewusst nirgends auf der Seite; oben rechts nur ein kleiner Knopf „Login“.

**Firmierung (Kevin 03.10., rechtlich):** Eine GmbH unter dem Namen „MAKE Innovation“ ist nicht eingetragen. Überall steht
„MAKE Innovation“ und darunter klein „eine Marke der KEMARIS Innovation GmbH“; Impressum und Datenschutz nennen die
Kemaris Innovation GmbH (Schönefeld, HRB 19873, AG Cottbus). `pruefen.mjs` hält das fest.

Sie liegt im Repo, Caddy liest sie auf dem Server read-only aus `/srv/make-os/app/website` (compose.yml → `/srv/website`).
Sie ist als **nicht indexierte Vorschau** aktiv (`X-Robots-Tag: noindex`, `robots.txt` sperrt, jede Seite trägt
`<meta name="robots" content="noindex">`).

| Datei | Inhalt |
|---|---|
| `index.html` | Kopf (Logo quer, Navigation Beratung · Make.One · Beteiligungen · Warum wir · Kontakt, Handy-Menü, „Login“), dann die **Reise**: sticky Bühne (`.buehne`: Canvas, Logo-SVG, Standbild) hinter acht Kapiteln (`.kapitel`, je `data-formation`): Start (Logo) · 01 Die Lage (laerm) · 02 Warum Innovation (impuls) · 03 Consulting & Beratung `#markttraktion` (pfad; Angebote, Themen, drei Phasen `#so-arbeiten-wir`) · 04 Make.One (kreise) · 05 Make.Beteiligungen + Development „Coming Soon“ (fokus) · 06 Warum MAKE `#ueber-uns` (kern) · 07 Erstgespräch `#erstgespraech` + Kontakt `#kontakt` (Logo). Fuß mit Firmierung |
| `impressum.html` | Pflichtangaben nach § 5 DDG (Kemaris Innovation GmbH), Verantwortlich nach § 18 Abs. 2 MStV |
| `datenschutz.html` | Hinweis passend zum tatsächlichen Verhalten (Hetzner DE, Caddy ohne Zugriffsprotokoll, keine Cookies, mailto, Bühne rechnet nur im Browser); Verantwortliche: Kemaris Innovation GmbH |
| `404.html` | Seite für unbekannte Adressen (absolute Pfade, weil sie unter jeder Adresse erscheint) |
| `css/seite.css` | CI-Tokens aus `lib/make-one/design.ts`; Rot/Grün (edler, wie Logo v5) nur für Personen, Logo und Bühne; Bewegung nur ohne `prefers-reduced-motion` |
| `js/formationen.js` | Geometrie der Bühne (sechs Formationen, ohne DOM — läuft auch in Node für das Standbild) |
| `js/neuronen.js` | die Bühne: Canvas 2D, mischt die Formationen entlang des Scrollens, Logo ↔ Netz überblenden; pausiert außerhalb des Bildes; `prefers-reduced-motion` = ein Standbild je Kapitel; liest, speichert, sendet nichts |
| `js/lichtfaeden.js` | Lichtfäden: Mathematik + Zeichner (Canvas 2D) — **erzeugt** aus denselben Dateien wie die Planung der App (`node scripts/lichtfaeden-website.mjs`, nie von Hand ändern; ein Test vergleicht) |
| `js/faden.js` | der rote Faden: zwei Bündel Granat/Smaragd aus dem Logo durch alle Kapitel (eigene Leinwand `canvas.faeden` in der Bühne, hinter dem Netz); pausiert außerhalb des Bildes; `prefers-reduced-motion` = Standbild; liest, speichert, sendet nichts |
| `js/menue.js` | schließt das Handy-Menü (`<details>`) nach einem Klick, mit Esc oder per Klick daneben |
| `js/erstgespraech.js` | übernimmt das Ziel aus `#erstgespraech-link` für alle Knöpfe mit `data-erstgespraech` |
| `assets/buehne/standbild.svg` | Standbild der Bühne ohne Skript/Canvas (`node website/standbild.mjs`) |
| `assets/logo/` | Logo v5 „Synapse“ aus `scripts/website-logo.mjs` (nie von Hand ändern) — Konstruktion in `assets/logo/LOGO.md` |
| `logo-entwuerfe.html` | drei Logo-Entwürfe + alle Fassungen (Arbeitsdatei, wird nie ausgeliefert) |
| `standbild.mjs` | erzeugt das Standbild (Arbeitsdatei; Caddy liefert `*.mjs` nie aus) |
| `assets/fonts/` | Archivo + Public Sans (SIL Open Font License, selbst gehostet — keine Google-Fonts-Anfrage) |
| `favicon.svg` | App-Kachel (= `assets/logo/kachel.svg`) |
| `pruefen.mjs` | Freigabe-Prüfung (wird nie ausgeliefert) |

## Die Neuronen-Bühne — Dramaturgie

| Kapitel | Formation | Bild |
|---|---|---|
| Start | Logo | Das Logo steht (SVG). Beim ersten Scrollen werden Striche und Buchstaben zu Teilchen. |
| 01 Die Lage | `laerm` | zerfasertes Netz: viele kleine Inseln, meist grau — Lärm, wenig Verbindung |
| 02 Warum Innovation | `impuls` | Rot und Grün laufen als zwei Stränge zusammen, ein Impuls läuft durch den Knoten und gemeinsam weiter |
| 03 Beratung | `pfad` | Struktur: drei wachsende Gitter (Analyse, Aufbau, Skalierung), Spalten Rot/Grün, ein Pfad darüber |
| 04 Make.One | `kreise` | Runden von Menschen, Rot und Grün gemischt, mit Brücken verbunden |
| 05 Beteiligungen | `fokus` | ein ruhiger Ring (der Markt), darin drei dichte, ausgewählte Knoten |
| 06 Warum MAKE | `kern` | Rot und Grün verschmelzen spiralförmig zu einem stabilen Kern, dreht sich sehr langsam |
| 07 Kontakt | Logo | das Netz fließt zurück in das Logo |

Desktop (≥ 1100 px): Text links, Bühne rechts. Schmaler: Bühne als ruhiges oberes Band, das Netz gedimmt hinter dem Text.
Ruhig wie die frühere Bühne („wie ein Auge“): dünne Linien, kein Glühen, langsame Drift; die Verwandlung folgt dem Scrollen.

Lokal ansehen: `python3 -m http.server 3013 -d website` über einen Eintrag in `.claude/launch.json` (nicht per Bash),
oder die HTML-Datei direkt im Browser öffnen. Logo ändern: `node scripts/website-logo.mjs`, danach den Bühnen-Block
(`node scripts/website-logo.mjs --buehne`) in `index.html` übernehmen. Formationen ändern: danach `node website/standbild.mjs`.

## Der rote Faden (Lichtfäden, 03.10.2026)

Zwei Bündel feiner Lichtfäden — **Granat** (#C9465C) und **Smaragd** (#2FA878), die Farben der Synapse im Logo (das Logo selbst bleibt
unverändert) — kommen aus dem Logo: Rot hinter dem roten Strich aus dessen linkem Ende, Grün hinter dem grünen Strich und in einem Bogen
unter dem Logo zurück. Unterhalb treffen sie sich und ziehen sich am Rechner zwischen Text und Bühne durch die Seite, am Handy an den
beiden Rändern. Der Charakter wechselt mit dem Kapitel (`CHARAKTER` in `js/faden.js`):

| Kapitel | Faden |
|---|---|
| Start | aus den Strichen des Logos, Bogen unter dem Logo |
| 01 Die Lage | zwei ruhige Bündel nebeneinander, leicht unruhig |
| 02 Warum Innovation | verflochten — die Kreuzungen wandern langsam |
| 03 Beratung | eng zu einem Pfad, drei Stufen zur Bühne hin, Licht steigt in ihm auf |
| 04 Make.One | weit aufgefächert |
| 05–06 | ruhig, leicht verflochten (Kern) |
| 07 Kontakt | zurück in die Striche und den Knoten |

Ruhig gehalten (wenige, dünne Fäden; die Neuronen-Bühne bleibt das Hauptbild). Gemessen: 60 fps beim Scrollen, keine langen Aufgaben;
zusammen +19 KB Skript. Rein dekorativ (`aria-hidden` über die Bühne), im Text beschrieben (`.unsichtbar`).

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

## Offene Platzhalter (Stand 03.10.2026, v4)

- **Startseite › Warum MAKE:** ein Satz zu Kevins Vertriebserfahrung (ohne Kundennamen)

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
- **Belegte Zahlen** (Kevin 03.10.): vier Kacheln in „01 Die Lage“ und „02 Warum Innovation“, jede mit Fußnote und Quellenliste
  unter dem Kapitel. Nur Originalquellen, direkt am Dokument geprüft (Stand der Prüfung 03.10.2026). Neue Zahl = neue Quelle in
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
