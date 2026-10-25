# makeinnovation.de — Neubau nach Markenhandbuch 4.0 (24.10.2026, nicht online; Upload als kleines Update `website-check-vorab`)

Kevin 24.10. abends: „In die Richtung soll es erstmal laufen. So können wir jetzt erstmal alles bauen und auch die Unterseiten zu den
Produkten. Da haben wir ja dann Sales, Sichtbarkeit und Innovation.“ — „Ich möchte auf jeden Fall sehr seriös wahrgenommen werden, nicht
wie die nächste Tech-Bude.“

**Quellen:** Markenhandbuch 4.0 (Claude-Artifact „MAKE Markenhandbuch 4.0“, PDF `~/Desktop/MAKE/MAKE_Markenhandbuch_4.0.pdf`, Logo-Paket 4.0),
Homepage-Inhalte `homepage-content.json` (Kevins Bauanleitung, Stand 24.10. 21:49), Vorschau „MAKE Homepage neue CI“.

Dieser Ordner ersetzt `website/` (Stand v3, offline). `website/` bleibt liegen, bis auch fokusinnovation.de in 4.0 neu gebaut ist — beide
hängen dort noch zusammen (gemeinsame Grundlage, `scripts/fokus-seite.mjs`, Wächter). Danach `website/` löschen und Caddy auf diesen Ordner zeigen.

## Kevins Entscheidungen (20 Fragen, 24.10.2026)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Erster Bildschirm | **eine kurze 3D-Animation, die zeigt, was wir machen** (kein 60-Sekunden-Video) |
| 2 | Ansprache | **Du überall** (Rechtstexte Sie) |
| 3 | Grund | **dunkel, Lesestellen hell** (Angebote, Preise, Fragen, Rechtliches auf Papier) |
| 4 | Bewegung und Leuchten | **wie in der Vorschau** (Schein hinter dem Zeichen, Verlauf in der Überschrift, „Beliebt“-Abzeichen) |
| 5 | Wie entsteht die Animation | **im Code gebaut** (`css/szene.css`, keine Videodatei) |
| 6 | Länge der Startseite | **kompakt, 7 Abschnitte**: Einstieg · drei Bereiche · Innovations-Check · 90-Tage-Gespräch · Warum MAKE · Fokus Innovation · Abschluss |
| 7 | Hauptknopf oben | **Innovations-Check** (zweiter Knopf „Angebote ansehen“) |
| 8 | Zoe | **Knopf unten rechts auf jeder Seite**, öffnet den Check; „Zoe · KI-Assistentin“ (Art. 50 KI-VO) |
| 9 | Hauptmenü | **Vertrieb · Sichtbarkeit · Innovation** (je mit Untermenü der Produkte) · **Gratis** · **Fokus Innovation** · **Über uns** · Knopf **Innovations-Check** |
| 10 | Produkt-Unterseiten | **eigene Seite je Produkt** (12 Seiten aus einer Vorlage) |
| 11 | Preise | **überall offen**, netto mit B2B-Hinweis |
| 12 | Knopf auf Produktseiten | **Termin direkt buchen** (Buchungsseite aus MAKE OS; bis sie steht: vorbereitete Mail „Termin anfragen“) |
| 13 | Innovation, solange nicht gestartet | **wie geplant: „Coming Soon“** + Warteliste |
| 14 | Referenzen | keine Vorgabe → **erst Zahlen-Belege** (Stimmen/Logos kommen mit Zustimmung nach) |
| 15 | Fotos | **erst ohne Fotos** (Kürzel mit Leuchtrand statt Porträts) |
| 16 | Fallbeispiele | **2–3 anonymisiert** — Inhalte kommen von Kevin (Platzhalter) |
| 17 | Kontakt | **Telefon, Mail, Adresse** im Fuß jeder Seite und auf `/kontakt/` |
| 18 | Gratis zum Start | **nur was fertig ist** (heute der Innovations-Check) |
| 19 | Mails nach Formularen | **erst von Hand freigeben** (Eiserne Regel 3); Brevo-Strecke später |
| 20 | Online | **so früh wie möglich** — bis 08.11. mit KD Ventures UG im Impressum, ab 09.11. MAKE Innovation GmbH |

Selbst gesetzt (Kevin kann widersprechen): Fokus Innovation als eigene Seite `/fokus-innovation/` mit Gästeliste per Mail (fokusinnovation.de ist
offline und wird später in 4.0 neu gebaut — bis dahin kein Link dorthin) · keine Messung/Analyse, also kein Cookie-Banner · nur Deutsch.

## Aufbau

| Datei | Inhalt |
|---|---|
| `inhalt/inhalt.json` | Angebote, Startseiten-Texte, Bereichsseiten, Gratis, FAQ, Konditionen — Kevins `homepage-content.json` **ohne** interne Teile (Namen Dritter, Kapazitäten, Rechtsnotizen, offene Punkte, Zielgruppen, Formular-Plan); FAQ mit fester `id` |
| `inhalt/seite.json` | Kontakt, Anbieter (KD Ventures UG / MAKE Innovation GmbH), Termin-Link, Team, Fallbeispiele, Fragen je Seite, Konditionen je Produkt, was der Check heute kann |
| `bauen.mjs` | Generator: schreibt alle 24 Seiten aus den beiden Dateien (+ Stempel `?v=` für css/js). `--pruefen` = passt alles zur Quelle? |
| `pruefen.mjs` | Regeln vor der Freigabe (Fehler + Offenes, siehe unten) |
| `css/marke.css` | Gestaltungsgrundlage 4.0 (Tokens aus Kap. 07/08, Bausteine) — eine Quelle für alle Seiten |
| `css/szene.css` | die Einstiegs-Szene (Startseite) und die Bereichs-Ebene (Bereichsseiten) |
| `js/seite.js` | das einzige Skript: Handy-Menü nach Klick/Esc schließen |
| `assets/` | Logo-Paket 4.0 (nie nachbauen), Bereichskacheln, Schriften (Schibsted Grotesk, IBM Plex Mono 500 — selbst ausgeliefert, OFL) |
| generierte Seiten | `index.html`, `vertrieb/`, `sichtbarkeit/`, `innovation/` (+ je Produkt ein Unterordner), `innovations-check/`, `gratis/`, `fokus-innovation/`, `ueber-uns/`, `kontakt/`, `impressum/`, `datenschutz/`, `404.html` — **nie von Hand ändern** |

Die fünf Stufen und die erste Frage im Chat-Beispiel kommen aus `lib/check/vorlagen/innovations-check/` — dieselbe Quelle wie der Check.

### Ändern
- **Text:** `inhalt/inhalt.json` bzw. `inhalt/seite.json` → `node makeinnovation/bauen.mjs` → `node makeinnovation/pruefen.mjs`.
- **Neue Fassung von Kevins `homepage-content.json`:** die internen Teile wie oben weglassen (Sperrliste in `pruefen.mjs`), FAQ-`id` behalten.
- **Aussehen:** `css/marke.css` (alle Seiten) bzw. `css/szene.css`, danach `bauen.mjs` (Stempel).
- **Ansehen:** Vorschau „makeinnovation-neu“ (Port 3017) bzw. `python3 -m http.server 3017 -d makeinnovation`.
- **Am 09.11.:** in `inhalt/seite.json` `anbieter_aktiv` auf `"make"` stellen, Daten der GmbH eintragen, bauen.

## Regeln (pruefen.mjs, Wächter `tests/makeinnovation-seite.test.ts`)
Seiten passen zur Quelle · genau eine H1, Titel, Beschreibung · `noindex`, solange `robots.txt` sperrt · keine Inline-Skripte, -Stile oder
Ereignis-Attribute (CSP `script-src`/`style-src 'self'`) · keine Formulare (Eingaben nur über MAKE OS: `/check`, `/buchen/…`) · keine fremden
Quellen · jeder eigene Link und Anker führt irgendwohin, nach außen nur Login, Mail, Telefon · jedes Angebot hat seine Seite · Zoe überall als
„KI-Assistentin“ gekennzeichnet · Sperrliste (Namen und Angebote, die nicht auf die Homepage gehören; alter Firmenname) · Startseite ≤ 120 KB gzip
(heute ≈ 15 KB, dazu Schriften ≈ 57 KB). **Freigabefähig** erst ohne Fehler UND ohne Offenes.

**Ehrlichkeit:** Der Check verspricht nur, was die Beta kann (`seite.json › check_punkte`: keine Sprachnachricht, kein Upload — kommen mit
Phase 2). „Homepage-Check“ und die übrigen Gratis-Werkzeuge stehen erst da, wenn sie fertig sind. Keine erfundenen Fälle, Kunden oder Zahlen —
was fehlt, steht als gelber Platzhalter `[[KEVIN: …]]` und blockiert die Freigabe.

## Sauber und flüssig (25.10., Kevin: „überarbeite alles, ich will es sauber und flüssig haben“)
- **Bewegung, die der Browser auf der Grafikkarte rechnet:** kein Unschärfe-Filter in Animationen (der Schein ist ein mehrstufiger Verlauf), animiert
  werden nur Deckkraft und Lage; Kopf ohne Hintergrund-Unschärfe (deckend). Gemessen im unsichtbaren Chrome: 60 Bilder/s beim Einstieg und beim Scrollen,
  keine Layout-Sprünge (CLS 0).
- **Seitenwechsel blenden weich über** (View Transitions zwischen Seiten, Kopf und Zoe-Knopf bleiben stehen) und **Inhalte gleiten beim Hineinscrollen
  ein** (Scroll-Zeitleiste in CSS, kein Skript; ohne Unterstützung steht alles sofort da). Untermenüs und Handy-Menü blenden weich, Karten heben sich
  beim Zeigen leicht an. Alles nur ohne „Bewegung reduzieren“.
- **Ruhiger Aufbau:** je Seite erst die dunklen Abschnitte (Einstieg, Weg, Belege, Ablauf), dann die hellen zum Lesen (Angebote, Vergleich, Fragen),
  dann der Abschluss — kein Hin und Her mehr. Das 90-Tage-Gespräch steht direkt unter dem Check. Vier Angebote stehen in einer Reihe.

## Offen vor der Freigabe (Stand 24.10. spät; `node makeinnovation/pruefen.mjs` listet es)
- Telefon und Adresse · Anbieter-Daten der KD Ventures UG (Anschrift, Geschäftsführer, Register) und später der GmbH
- Kurztexte zu Kevin und Malin · drei Fallbeispiele (anonymisiert, mit Zustimmung)
- Preise der Homepage-Pakete bestätigen (2.990 / 4.990 / 9.990 €, „vorläufig“ seit der Inhaltsänderung 24.10.)
- Buchungsseite in MAKE OS anlegen und `seite.json › termin.link` setzen (`/buchen/<name>-<24 Hex>`)
- AGB auf die GmbH umstellen (noch nicht verlinkt) · Impressum und Datenschutz anwaltlich prüfen (Hinweis, keine Rechtsberatung)
- Innovations-Check in MAKE OS einschalten (Markttraktion › Marketing › Innovations-Check, braucht den Verantwortlichen)

## Online gehen (nur auf Kevins Wort)
Kevin 24.10.: „so früh wie möglich“ als **eigenes kleines Update** (Website + Innovations-Check, ohne das große Update), „sofort indexieren“.
Branch `website-check-vorab` = Online-Stand `main` + dieser Ordner + der Check. Caddy (`deploy/caddy/Caddyfile`) liefert diesen Ordner unter
makeinnovation.de aus (Köpfe `make_koepfe`, Arbeitsdateien `*.md *.mjs /inhalt/*` → 404) und gibt nur `/check /api/check /buchen… /api/buchung… /_next/*`
an die App; fokusinnovation.de bleibt 503. compose mountet `./makeinnovation:/srv/makeinnovation:ro`. Ablauf und Prüfschritte: UPDATES.md (24.10. spät).
