# Fokus Innovation · Website (vierte Fassung, 27.10.2026)

Online als Vorschau unter https://fokusinnovation.de (seit 26.10., noindex). Die Quelle liegt hier, der gebaute Ordner liegt auf `main` unter `fokusinnovation/`.

## Aufbau
- `inhalt/fokus.json`: alle Texte der Marke aus dem Positionierungs-Doc:
  - Leitidee, Film, Bereiche, Abend, Werte, Team
  - Belege mit Quelle
  - Fakten „auf einen Blick“
  - `seo`: Titel und Beschreibung je Seite, Schalter `oeffentlich`, IndexNow-Schlüssel
- `inhalt/wissen.json`: sechs Ratgeber und 25 Begriffe. Preise stehen dort nur als Platzhalter (`{preis:head-of-sales}`, `{ab:positionierung}`, `{zusatz:id}`), damit es keine zweite Preisliste gibt.
- Angebote, Preise, Produktblätter und Fragen kommen weiter aus `makeinnovation/inhalt/*.json`.
- `bauen.mjs` erzeugt alle Seiten und Dateien: 31 Seiten, die 404-Seite, robots.txt, sitemap.xml, llms.txt, llms-full.txt, site.webmanifest und die IndexNow-Datei. Danach prüft es:
  - Sperrwörter: alter Name, Software-Name, Connect, Superlative.
  - keine Inline-Skripte außer JSON-LD, keine Inline-Stile, keine fremden Quellen, keine Formulare.
  - Zoe nur zusammen mit „KI-Assistentin“; tote Links und Anker.
  - Suche:
    - genau ein h1
    - Titel mit 15–65 Zeichen, Beschreibung mit 110–165 Zeichen, beide je Seite einmalig
    - Canonical
    - JSON-LD gültig und ohne leere Felder
    - jede Frage in den Daten auch sichtbar
    - Vorschaubild vorhanden
- `grafiken.mjs`: die gezeichneten Bewegungen (SVG) für Bereiche, Team, Einstiege und Belegzahlen.
- `arbeitsprobe.mjs` nimmt mit Chrome die zwei Bildschirmfotos der Arbeitsprobe von der laufenden Vorschau auf (`assets/bild/arbeitsprobe/rechner.jpg` 1440 × 900 und `handy.jpg` 780 × 1688). Beide zeigen seit 18.11. die Startseite im Raum von MAKE Studios (Etage 08, Website · Cinematic, als Standbild über `?p=0.4024&linie=website&paket=3`). Nach einem neuen Zeichen, Kopf oder einer Änderung am Haus einmal laufen lassen: `node arbeitsprobe.mjs http://localhost:<port>`.
- `bilder.mjs` zeichnet mit Chrome ein Vorschaubild je Seite (1200 × 630), dazu Logo, Icons und favicon.ico. Nach neuen Seiten oder geänderten Titeln einmal laufen lassen.

Aufruf:

```bash
node prototype/fokus-innovation/bauen.mjs
```

Mit `--pruefen` wird nur geprüft. Danach `bilder.mjs`, wenn der Prüfer ein fehlendes Bild meldet.

## Suche und KI-Suchen (27.10.)
- **Jede Seite** trägt:
  - Titel und Beschreibung
  - Canonical
  - Open Graph (Vorschaubild für LinkedIn, WhatsApp, Google)
  - JSON-LD mit Organisation (ProfessionalService, Sitz Berlin, Gründer), WebSite, WebPage und Brotkrumen
- **Je Seitentyp** kommen dazu:
  - Leistung mit Preis (Service, Offer, netto, monatlich wo „pro Monat“)
  - FAQPage, wo Fragen stehen
  - Article mit Autor, Datum und Quellen
  - DefinedTermSet bei den Begriffen
  - OfferCatalog bei den Preisen
- **Für KI-Suchen** (GEO):
  - „Kurz gesagt“ oben auf Bereichs- und Ratgeberseiten, die Antwort zuerst
  - „Auf einen Blick“ mit Fakten
  - Fragen mit Antworten und Zahlen mit Quelle
  - `llms.txt` als Wegweiser und `llms-full.txt` mit allen Inhalten als Klartext
- **Neue Seiten:**
  - Wissen: Übersicht und sechs Ratgeber
  - Preise: alles auf einer Seite
  - Häufige Fragen: alle an einem Ort
  - Begriffe: von A bis Z
- **Freischalten für Google** auf Kevins Wort:
  1. `seo.oeffentlich` auf `true` setzen.
  2. Neu bauen.
  3. Im Caddyfile die Zeile `X-Robots-Tag` im Block `(fokus_koepfe)` entfernen, den Test anpassen und hochladen.
  4. Danach die Sitemap in der Search Console einreichen.

  Die Schritte für Kevin stehen in [GOOGLE_SCHRITTE.md](GOOGLE_SCHRITTE.md).

## Hochladen
1. Hier bauen, wie oben unter Aufruf.
2. In den Deploy-Ordner kopieren:

```bash
node prototype/fokus-innovation/ausliefern.mjs <main-checkout>/fokusinnovation   # rsync wie bisher + Kommentare aus ausgelieferten Stil- und Skriptdateien (seit 12.11., nie mehr nur rsync)
rsync -a --delete unterlagen/ <main-checkout>/unterlagen/   # lange Vorlagen (nur per E-Mail), aus dem Repo-Ordner unterlagen/
```

3. Dort committen und auf `main` pushen, nur auf Kevins Wort. Die GitHub Action rollt es aus.

## Gestaltung: seriöse Agentur statt Tech-Bude
- Papier und Tinte, eine Schrift (Schibsted Grotesk), Haarlinien statt Kartenwände. Farbe kommt nur aus dem Logo.
- Der Faden (Heute → Mit uns → Danach) ist das wiederkehrende Bild.
- Die Ratgeber sind ruhige Leseseiten: links das Inhaltsverzeichnis, rechts der Text in einer angenehmen Zeilenlänge.
- Der Film der Startseite erzählt den Gründer, der sich um alles kümmert. Das Erklärvideo erzählt dieselbe Story ([ERKLAERVIDEO_PROMPT.md](ERKLAERVIDEO_PROMPT.md)).
- Die Seite wackelt beim Laden nicht (CLS 0). Die Schrift lädt mit `font-display: optional` und Vorladen.

## Überarbeitung 11.11.2026: Rhythmus, größere Schrift, gezeichnete Bewegungen
Nach dem Film fiel die Seite in ein gleichförmiges Textdokument. Geändert wurden gemeinsame Bausteine, nicht einzelne Seiten:
- **Schrift und Breite:** am Rechner eine Stufe größer (`html` 106 %, ab 1700 px 119 %), Inhalt bis 1280 px (groß 1400 px). Abschnittsköpfe: Marke oben, links die Überschrift, rechts die Einleitung.
- **Zeichnungen (`grafiken.mjs`):** je Bereich eine dunkle Fläche im Format 16:10 in der Formensprache des Zeichens (Kugel, Balken, Linien): Sichtbarkeit (Signale werden zu Anfragen), Vertrieb (Strecke bis zum Abschluss), Innovation (ein Ablauf, der beim Team ankommt). Dazu „Wir sitzen mit in Ihrem Team“ auf Papier und die Zeichen der zwei Einstiege. Reines SVG mit Klassen, Bewegung in `css/fokus.css › Gezeichnete Bewegungen`: einmal, nur im Sichtfeld, ohne Skript und bei „Bewegung reduzieren“ steht das Endbild.
- **Belegzahlen (`belegBand`):** dunkles Band, Zahl groß, darunter ihre Bahn (Linie, Kugel, bei 100 % die Wand), Satz und Quelle. `js/seite.js` zählt einmal hoch. Startseite: drei Zahlen, Bereichsseiten: eine.
- **Neun Situationen:** mit Skript drei Reiter mit je drei Karten, jede lässt sich antippen („Kenne ich“), der Stand steht beim Schluss-Satz. Ohne Skript stehen alle neun da. Es wird nichts gespeichert oder gesendet.
- **Takt der Startseite:** Film (Nacht) · Einstieg mit zwei Türen (Papier) · Situationen (Papier) · Zahlen (Nacht) · drei Bereiche mit Zeichnung (Papier) · Warum wir · Fragen · Events (Sand, mit Tisch) · Wissen · Schlussakt (Nacht, Zeichen groß wie im letzten Bild des Films).
- **Film ohne Skript:** statt leerer dunkler Fläche steht das Endbild (`css/film.css`, letzter Block).
- **Erklärvideos:** Die dunkle Fläche der Bereiche (Startseite und Bereichsseiten) ist die vorbereitete Stelle. Sie sieht ohne Video vollständig aus; ein Video im Format 16:10 kann sie später übernehmen. Leere Player gibt es nicht.

## Markenfamilie 11.11.2026: MAKE Innovation ist das Dach
Kevin: „Dach plus Innovation“. Verbindlich sind `STRUKTUR-MARKEN.md` und `SEO-GEO-VORGABEN.md` (Arbeitsordner der Sitzung).
- **Eine Stelle:** `inhalt/fokus.json › familie` hält Adressen, Standardsätze, Anrisse und die Texte der Preisblätter. Bis zu den echten Domains stehen dort die Vorschau-Adressen (MAKE Studios `http://localhost:3022/`, MAKE Revenue `http://localhost:3023/`). Der Prüfer bricht ab, wenn bei `seo.oeffentlich = true` noch `localhost` in einer Datei steht.
- **Startseite:** Film · Einstieg · „Eine Firma, drei Marken.“ (zwei Karten in Farbe und mit Zeichen der Marke, je ein Link zur Marke und zum Preisblatt) · Innovation als eigener Abschnitt · Situationen · Zahlen · Warum wir · Fragen · Events · Wissen · Schlussakt.
- **Sichtbarkeit und Vertrieb** sind beim Dach ein knappes Preis- und Leistungsblatt (Preise, Vergleich, Zusatzoptionen bzw. Rechner und Ablauf, Wissen, Fragen) mit der Karte der Marke im Kopf. Problem, Beispiele und Ablauf stehen bei der Marke. Adressen, Angebotsseiten und Preise sind unverändert. Innovation behält die volle Seite.
- **Verweise:** Karte im Familien-Abschnitt und im Kopf der Preisblätter, ein Hinweis auf jeder Angebots- und Gruppenseite von Sichtbarkeit und Vertrieb, eine Zeile bei Events, im Fuß „Marken: MAKE Studios · MAKE Revenue“. Immer sichtbare Links mit dem Markennamen.
- **Strukturierte Daten:** Organisation als `Organization` + `ProfessionalService` mit `brand` und `subOrganization` für beide Marken, `WebSite` mit `alternateName`. `llms.txt` hat den Abschnitt „Die Markenfamilie“.
- **Prüfer:** „MAKE“ ist erlaubt als MAKE Innovation, MAKE Studios, MAKE Revenue. Startseite und Preisblätter müssen zur Marke verweisen.
- **Zeichen:** MAKE Studios trägt die Irisblende aus deren `zeichen.svg`. MAKE Revenue trägt den Kreis mit der Stufenlinie aus deren `zeichen.svg` (Minze auf dunklem Grund, Tannengrün auf Papier). Beide Zeichen zeichnet `grafiken.mjs › markenZeichen`, die Farben stehen in `css/fokus.css › Markenfamilie`.
- **Erste Szene des Films:** Titel und Satz stehen ab dem ersten Bild da (ohne Skript, ohne Einblenden aus Deckkraft 0), damit sie als größtes sichtbares Element zählen. Die übrigen Szenen laufen wie bisher.

## Ergänzungen 18.11.2026: Social Media, Innovation mit Preisen, Fokus Abend, Podcast
Kevin: Was die Scroll-Geschichte „Das Haus“ nennt, steht auch auf den Seiten dahinter.
- **Preise bleiben an einer Stelle** (`makeinnovation/inhalt/inhalt.json › angebote`): neu `social-media` (drei Stufen mit `punkte`), `scoping-workshop` und `abendpartner`. Angebote mit dem Feld `anker` haben keine eigene Seite, sondern stehen als Abschnitt auf einer anderen (`/innovation/#scoping-workshop`, `/events/#abendpartner`). Umsetzungsprojekte tragen kein „Coming Soon“ mehr.
- **Social Media:** Seite `/sichtbarkeit/social-media/`, auf dem Preisblatt die drei Pakete als Zeilen unter dem Angebot (`stufenDaten`), auf `/preise/` als Karte.
- **Innovation:** `/innovation/` zeigt statt einer Liste die drei Schritte Check, Workshop, Projekt (`dreiSchritte`, Texte in `fokus.json › bereiche.innovation.schritt_texte`); dieselben Schritte als Weg auf `/innovation/umsetzungsprojekte/`.
- **Events:** Der monatliche Abend heißt „Fokus Abend“ (`fokus.json › events.abend`: Ablauf, Rollen als Vergleich, Fragen). Die allgemeine Einleitung mit `data-mk="text:events.einleitung"` steht jetzt über den weiteren Formaten, damit ein in der Anwendung gepflegter Text den Kopf nicht überschreibt.
- **Podcast:** Seite `/podcast/` (`fokus.json › podcast`), Menüpunkt neben Events. Es gibt genau eine Aussage und einen Aufruf.
- **Prüfer:** „Fokus Innovation“ ist nur noch der Name des Podcasts. Erlaubt ist genau diese Schreibweise und nur zusammen mit „Podcast“ im selben Textblock (`fokusNameFehler`). Als Firmen- oder Seitenname (Seitentitel, Name der Website, Organisation in den strukturierten Daten, „… GmbH“, „© …“) bleibt er gesperrt (`fokusAlsSeitenname`), ebenso andere Schreibweisen und die alte Adresse. „Fokus Abend“ ist kein Sperrwort.

## Startseite: „Das Haus“, die Fahrt in 15 Szenen (Umbau 18.11.2026)
Die Startseite beginnt mit einer Fahrt durch ein Haus: vom Dach über die Straße und den Tresen bis zu den Etagen und wieder hinauf zu den Paketen und zum Finale. Danach folgt die Kurz-Startseite (siehe unten). Die Fahrt ist ein Bildschirm-Erlebnis: eine Zeichenfläche (Canvas) zeigt Haus und Räume, der Text jeder Szene ist echter HTML-Text.
- **Die 15 Szenen** (Nummer, Kennung): 1 `eingang` · 2 `problem` · 3 `fahrt` · 4 `eg` (Erdgeschoss) · 5 `tresen` (Eingangshalle) · 6 `e1` · 7 `e2` · 8 `e3a` · 9 `e3b` · 10 `e4` · 11 `e5a` (Podcast) · 12 `e5b` (Deine Bühne) · 13 `dach` (Fokus Abend) · 14 `pakete` · 15 `finale`. Prüfen: `?fahrt=1&szene=7` oder `?fahrt=1&szene=e2` springt in die Szene.
- **Quellen in `haus/`:** `szenen.json` (alle 15 Szenen als Daten: Art, Texte, Kacheln, Preis, Knopf, Bild; die Kopfzeile der Datei erklärt jedes Feld), `stufen.json` (Fundament, Wachstum, Skalieren; Quelle für Szene 14 und die Pakete der Kurz-Startseite; hier steht auch, welche Stufe empfohlen ist), `ziele.json` (alle Linkziele), `buehne.html` (Rahmen: Zeichenfläche, Szenen, Leisten, Etagenwahl, Gastwunsch), `haus.css`, `haus.js` (Zeichnung der Räume und Ablauf), `haus-frueh.js` (winziges Skript vor allem anderen), `haus-bau.mjs` (baut aus alledem das Markup und die Dateien `css/haus.css`, `js/haus.js`, `js/haus-frueh.js`; `bauen.mjs` ruft es auf). Alte Quellen (`pakete.json`, `haus.json`, `verbindungen.json`, Lenis) gibt es nicht mehr.
- **Eine Preisliste:** In `szenen.json` stehen keine Preise. `preis.angebote` nennt Angebote aus `makeinnovation/inhalt/inhalt.json`; der Bau nimmt den kleinsten Ab-Preis von dort und bricht ab, wenn ein Angebot fehlt. Die Paketpreise (Szene 14) sind noch Platzhalter `[AB-PREIS FOLGT]` in `stufen.json`.
- **Links:** nur über `haus/ziele.json`, aufgelöst mit denselben Helfern wie überall (`hausZiel` in `bauen.mjs`). Der Knopf „Erstgespräch buchen“ steht in der Fahrt nur in der Etagenwahl und groß in Szene 15 (Szene 14 hat einen Textlink); die Etagen selbst tragen ihn nie.
- **Scrollen, Halt und Fahrt:** Jede Szene hat auf dem Scrollweg einen **Halt** (der Raum steht, die Tafel ist voll da, im Halt kommt die Zeichnung nur ganz langsam näher) und danach eine **Fahrt** zur nächsten Szene (Aufzug bzw. Kamera fährt mit Anfahren und Ausrollen; die Tafel blendet im ersten Fünftel der Fahrt aus, die nächste im letzten Fünftel ein). Die Abbildung Scrollweg → Ort steht an EINER Stelle (`ortVon` in `haus.js`); Zeichnung, Tafeln, Leisten, Tasten und Einrasten nutzen sie gemeinsam. **Stellwerte:** die Längen in `haus/haus.css` ganz oben (`--halt-auftakt`/`--fahrt-auftakt` Szenen 1 bis 3, `--halt-etage`/`--fahrt-etage` Szenen 4 bis 13, `--halt-schluss`/`--fahrt-schluss` Szenen 14 und 15, `--kreis`; zusammen rund 34 Fensterhöhen), das Gefühl in `haus/haus.js` unter „STELLWERTE DES SCROLLENS“ (`LENIS`, `ANLAUF`, `TAFEL_BLENDE`, `NAEHER`, `RUHE`, `RAST_AB`, `RAST_DAUER`, `RAST_TIEFE`, `TASTE_DAUER`). Am Rechner (feiner Zeiger, nicht bei „weniger Bewegung“, nicht für Rückkehrer ohne Fahrt) scrollt die Seite weich und etwas gebremst über Lenis (`js/lenis.min.js` 1.3.26, MIT, Lizenz daneben; gilt für die ganze Startseite, steht bei offenem Dialog oder Menü). Im Halt rastet nichts: Man kann stehen und vor und zurück scrollen. Nur wer mitten in einer Fahrt stehen bleibt, gleitet nach 350 ms Ruhe in 500 bis 700 ms zum näheren Halt; jede Eingabe bricht das ab. Kein Gleiten bei offenem Dialog oder Menü, in einem Formularfeld, bei gedrücktem Zeiger und nach der Fahrt. Tasten (Pfeile, Bild auf/ab, Leertaste) fahren zum nächsten bzw. vorigen Halt (in dessen Mitte, 900 bis 1.400 ms je nach Weg), Pos1 an den Anfang, Ende ans Seitenende; Etagenanzeige, Stufenleiste, `?szene=`, `?etage=` und `#szene-…` zielen ebenfalls auf die Mitte des Halts. Diese Fahrten sind „geführt“: Die Zeichnung fährt in der Zeit gleichmäßig weich zur Zielszene, ohne an Zwischenhalten zu warten. Mit dem Finger (grober Zeiger) bleibt es beim Scrollen des Browsers: eine Fensterhöhe je Szene, kein Halt, der Browser rastet Szene für Szene (CSS Scroll-Snap, `html.rast-fest`; die Klasse wird nur im Stillstand gesetzt und gelöst). Alle Längen in `vh`, damit die Adressleiste am Handy nichts verschiebt. Der Kreis-Übergang führt in die Kurz-Startseite, danach scrollt die Seite ganz normal. Messen: `werkzeug/haus-echtlauf.mjs` (Proben `tipp`, `klein`, `mittel`, `stark`, `rollen`, `durchlauf`; mit `DSF=2` in Retina-Auflösung).
- **Leisten:** Ab Szene 4 stehen links die Etagen (EG bis Dach), rechts die drei Stufen (am Handy als Reihe oben neben „Fahrt überspringen“, dort trägt nur die aktuelle Stufe ihren Namen sichtbar, die anderen sind Farbfelder mit Namen für Vorlesegeräte; in Szene 14 stehen alle drei Namen da). Die Etagenwahl öffnet sich am Tresen.
- **Etagen-Szenen:** Die Tafel links ist am Rechner in allen Etagen gleich hoch (`min-height`), der Rest wird gleichmäßig verteilt, der Knopf steht überall am selben Platz. Am Handy ist es ein Blatt am unteren Rand. Wo Text über der hellen Zeichnung steht (Szene 3, 14, 15), liegt eine dunkle Fläche dahinter (Kontrast mindestens 4,5 : 1).
- **Fahrt überspringen:** Der Knopf oben rechts (und die Esc-Taste) springt zur Kurz-Startseite (`#kurz`) und merkt sich das in `localStorage` (`make-fahrt`).
- **Rückkehrer:** Wer die Fahrt schon beendet oder übersprungen hat, sieht sie nicht mehr: `haus-frueh.js` setzt vor dem ersten Bild die Klasse `fahrt-aus`, die Kurz-Startseite steht ohne Springen ganz oben. Wieder starten: Link „Fahrt durchs Haus starten“ bzw. „Fahrt nochmal starten“ auf `/?fahrt=1#top`; ebenso starten `?etage=…`, `?szene=…`, `?p=…`. Ohne `localStorage` läuft die Fahrt immer.
- **Eine Etage einfügen** (z. B. Referenzen oder Gastro): neuer Eintrag in `szenen.json` (Art `etage`, `stufe`, `etage` mit Nummer, Name und Kurzform, Text, Kacheln, Preis, Knopf), dazu der Raum in `haus.js` (`FLOORS` und die Raumzeichnung), die Etagenleiste entsteht beim Bau von selbst. Die Zahl „15 Szenen“ in `buehne.html` (Beschriftung) und hier nachziehen. Der Ablauf selbst ändert sich nicht.
- **Sicherheitsregeln:** kein Inline-Skript, kein `<style>`, kein `style`-Attribut (auch nicht in HTML, das das Skript einsetzt, nur einzelne `el.style`-Zuweisungen). Farben je Etage stehen als Klassen in `haus.css`. Der Bau bricht ab, wenn im Markup oder Skript ein `style=` steht. Formulare (Newsletter, Gast vorschlagen) senden per Skript.
- **Maße:** In `haus/haus.css` und `haus/haus.js` meint „rem“ die Einheit des Hauses (`--hr`, läuft mit der Fensterbreite); der Bau setzt dafür `calc(… * var(--hr))` ein. Regeln des Hauses gelten nur in `.haus`.
- **Ohne Skript und bei „weniger Bewegung“:** Die 15 Szenen stehen als lesbare Abschnitte untereinander (`html.statisch`), mit ruhigem Bild, wenn das Skript es malt. Das eine `h1` der Seite ist der Titel der ersten Szene.
- **Auslieferung:** `ausliefern.mjs` lässt `haus/` (Quellen) und `werkzeug/` weg. Film (`css/film.css`, `js/film.js`, `js/szene.js`) lädt keine Seite mehr; die Dateien liegen noch da, weil der Prüfer sie verlangt.
- **Prüfen** (Ordner `werkzeug/`):
  - `node werkzeug/csp-server.mjs [port]` liefert die Seite mit den Sicherheits-Kopfzeilen (Port 3391, oder der genannte).
  - `node werkzeug/haus-standbilder.mjs <ziel> <profil> "name|fahrt=1&szene=7|1440|900"` nimmt Standbilder auf und liest die Konsole mit (Schalter: `fahrt=1&szene=<Nr oder Kennung>`, `p=` Stelle 0 bis 1, `ohneskript` für die Fassung ohne Skript). Umgebungsvariable `BASIS` nimmt eine andere Adresse.
  - `node werkzeug/haus-echtlauf.mjs werkzeug/haus-echtlauf.json <ziel> <profil>` fährt mit echtem Mausrad durch alle 15 Szenen, wischt am Handy mit echten Berührungs-Ereignissen durch, prüft Tasten, Leisten, Direkteinstiege, das Ende der Fahrt, Formularfeld, Dialog, geänderte Fenstergröße, „Fahrt überspringen“, Esc, Rückkehrer und „weniger Bewegung“ und meldet Skriptfehler und Verstöße gegen die Sicherheitsregeln (die Adressen zeigen auf Port 3391). Der Auftrag „e08-trackpad-probe“ misst das Scroll-Gefühl in Zahlen (Schwung mit Nachlauf, zwei Schwünge, langsames Rollen, Mausrad-Rasten, Gegenrichtung): Verzögerung, tote Ereignisse, Lage und Stillstand danach, Bildzeiten; Ergebnis in `<ziel>/probe.json`.
  - `node werkzeug/haus-pngdiff.mjs a.png b.png` vergleicht zwei Standbilder.
  - `node arbeitsprobe.mjs [Adresse]` nimmt die zwei Bilder „Diese Website ist unsere Arbeitsprobe“ auf (Szene der Etage 2).

## Kurz-Startseite, Menü, Fuß (Umbau 18.11., Konzept Malin)
- **Nach der Fahrt** folgt die Kurz-Startseite (`bauen.mjs`, Block „Startseite“; Texte in `inhalt/fokus.json › kurz`, alles in Du): Pitch (`#kurz`), Problem-Satz, fünf Bereiche, Pakete (`#pakete`; Sätze, Stichpunkte, Ab-Preis und Zusagen kommen aus `haus/stufen.json`, dieselbe Quelle wie Szene 14), Kevin und Malin, Community (`#community`), drei Fragen, Finale. Die Sektion „Referenzen“ kommt später zwischen Team und Community (Platz im Bau vermerkt).
- **Menü** (`NAV` im Seitenrahmen): Leistungen (fünf Bereiche und drei Pakete) · Über uns · Community (Fokus Abend, Podcast, Newsletter) · Kostenloser Check · Kontakt · Erstgespräch buchen. Alles andere steht im Fuß.
- **Eine Farbe für „Erstgespräch buchen“:** `--cta` in `css/fokus.css`, Klasse `.knopf.cta` (`erstKnopf()` setzt sie). Sie steht für nichts anderes; Etagen und Auszeichnungen nehmen Lavendel (`--akzent-papier`), Schrift nimmt Tinte.
- **Handy:** `js/seite.js` setzt `html.cta-unten-da`, sobald der große Knopf oben auf der Kurz-Startseite aus dem Bild ist (und nimmt sie zurück, wenn der Knopf im Finale sichtbar wird); der Knopf `[data-cta-unten]` steht dann unten fest.
- **Platzhalter** stehen als `[AB-PREIS FOLGT]` und `[FOTO …]` mit Klasse `ph` (gelb markiert); der Prüfer zählt sie.

## Offen für Kevin
- Ratgeber lesen: Sie stehen unter Kevins Namen.
- Porträtfotos von Kevin und Malin würden „Über uns“, den Abend und die Autorenzeile stärken; bis dahin stehen Kürzel.
- LinkedIn-Profile oder eine LinkedIn-Firmenseite in `seo.same_as` eintragen. Das hilft Google und KI-Suchen, die Firma zuzuordnen.
- **Check und Erstgespräch über fokusinnovation.de (29.10., Zweig `fokus-check`):** Caddy reicht `/check`, `/api/check`, `/buchen/*`, `/api/buchung/*`,
  `/_next/*` und `/schriften/*` an die Anwendung durch, alles andere bleibt die statische Seite. Danach in MAKE OS:
  1. Markttraktion › Marketing › Innovations-Check: einschalten (braucht den Verantwortlichen unter Einstellungen › Datenschutz), „Name im Check“ = Fokus Innovation.
  2. Kalender › Buchungsseiten: eine Seite „Erstgespräch“ anlegen (30 Minuten, Verantwortlicher eingetragen), Link kopieren.
  3. Dieselbe Seite im Check als Buchungsseite für das Gespräch wählen.
  4. Den Pfad (`/buchen/<name>-<24 Hex>`, ohne Domain) in `makeinnovation/inhalt/seite.json › termin.link` eintragen, `node bauen.mjs`, hochladen.
     Der Bau bricht ab, wenn der Pfad eine andere Form hat. Solange `termin.link` leer ist, öffnet „Erstgespräch“ eine vorbereitete Mail.
  Solange der Check aus ist, antwortet `/check` mit „gibt es nicht“ — vor der Freigabe für Google muss er an sein.
- Rubrik „Im Fokus“ und Gratis-Seite fehlen bewusst: Es gibt dafür noch nichts Fertiges.

## Vorlagen: kurz direkt, lang per E-Mail (31.10.)
Kevin: „Die kleinen Sachen sind okay, aber die größeren brauchen eine E-Mail, damit wir denen das Ganze zuschicken können.“
- `node vorlagen.mjs [id …]` baut PDF/XLSX nach `dateien/vorlagen/` (NICHT öffentlich) und für lange Vorlagen die Vorschaubilder
  `assets/bild/vorlagen/<id>-titel.jpg` + `<id>-seite.jpg` (Seite aus `inhalt/vorlagen.json › vorschau_seite`, PDFKit über `werkzeug/pdfseiten.swift`, nur am Mac).
  `--nur-vorschau` erneuert nur die Bilder.
- `node bauen.mjs` verteilt: unter `fokus.json › kostenlos.vorlagen.per_mail_ab_seiten` Seiten → `assets/vorlagen/` (Download),
  ab dieser Seitenzahl → Repo-Ordner `unterlagen/` mit `katalog.json` (die App liefert sie nur über den Link aus der Mail, `/api/unterlage`).
  Lange Vorlagen bekommen die Seite `/kostenlos/vorlagen/<id>/` mit Formular (`js/unterlage.js`); ohne Antwort der App steht der Weg per E-Mail da.
- Übernehmen in den Upload-Stand: rsync wie bisher, zusätzlich `--exclude dateien/ --exclude werkzeug/`, und `unterlagen/` in den Repo-Ordner `unterlagen/`.
