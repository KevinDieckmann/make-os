# Top-1 %-Recherche für die MAKE-OS-Homepage (27.09.2026)

Ein Recherche-Agent hat 16 Referenzseiten am 27.09.2026 direkt abgerufen und Best Practices nur mit Primärquellen belegt (NN/g, web.dev, W3C, Chrome Developers, Unbounce, Bitkom, EU AI Act). Hier die Essenz und was die Seite daraus macht; die vollständige Quellenliste steht unten.

## Die vier Muster der besten Software-Seiten
1. **Dunkel als Standard, ein einziger Akzent** (Linear fast ohne Farbe, Raycast Koralle nur an drei Stellen). → MAKE OS: Türkis nur an CTA, Ring, Linien.
2. **Das Produkt ist der Inhalt**: echte Oberfläche statt Illustration („the marketing page is the product“). → Sechs Bereichs-Schirme als Nachbau der Software mit Beispieldaten, kein Stock.
3. **Ein Satz Headline, ein Satz Subline, ein primärer CTA**; laute Seiten (Motion, Reclaim) wirken nicht hochwertig. → Beschreibende Headline (Shapiro-Regel), Zielgruppe wörtlich in der Subline, ein CTA je Bildschirm.
4. **Proof früh, aber ohne Logo-Wand geht es auch** (Things: Awards, Reflect: Verschlüsselung als Feature, Linear: Changelog). → Status-Chip „läuft seit September 2026 auf unserem Server“, Sektion „Die Entwicklung“ mit echten Einträgen, Systemzahlen statt Kundenzahlen.

Was wir von wem übernommen haben: Linear (Hausgewicht, Changelog als Vertrauen, drei Stimmen statt dreißig) · Raycast (Karten mit Hairline statt Schatten, Cursor-Licht) · Notion Calendar („Work and life, playing nice“ — die nächste Formulierung an unserer These) · Framer („Agents that work alongside you, not instead of you“ → „Er handelt. Du entscheidest.“) · Reflect (Verschlüsselung als eigene Sektion mit klarem Satz) · Tana („What it is not“ → „Was MAKE OS nicht ist“) · Sunsama (Problem-Sektion direkt nach dem Hero, Drei-Takt-Headline) · Akiflow (Zielgruppe im Hero). Bewusst nicht übernommen: „#1“-Claims, Zahlenflut, Multi-Produkt-Hero, Karussell, WebGL-Verlauf, Apple-Bildsequenzen.

## Evidenz, die die Seite prägt
- **Above the fold:** 57 % der Betrachtungszeit im ersten Bildschirm, 74 % in den ersten zwei (NN/g Eyetracking) → Headline, Subline, CTA und Score-Karte oben; Sektion 2 schneidet an.
- **Headlines:** beschreibend schlägt clever (Shapiro; Copyhackers: klar gewann in 88 % von 150.000 Tests) → „Das Betriebssystem für dein Leben und dein Unternehmen.“
- **Textmenge:** beste SaaS-Seiten 250–725 Wörter, 79 % der Besuche mobil (Unbounce, 41.000 Seiten) → knapp, mobil zuerst.
- **Bewegung:** Scroll-Fading 100–400 ms, einmalig, ein Elementtyp je Abschnitt, auf Mobil weglassen; kein Scrolljacking (NN/g) → Reveals 450 ms nur Desktop, keine Scroll-Entführung, Sticky-Story nur mit sichtbarer Navigation.
- **Leistung:** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (web.dev) → keine Videos, keine Bilder, zwei selbst gehostete Schriften, SVG.
- **Barrierefreiheit:** WCAG 2.3.3 / SCR40 → `prefers-reduced-motion` überall, Regler als ARIA-Slider, Fragen als `<details>`.

## Effekte mit Maß (umgesetzt)
Reveal einmalig · Zahlen-Zähler nur für echte Systemzahlen · Score-Ring-Animation · Cursor-Licht auf Karten (nur Maus) · Spotlight im Hero · Magnetischer Knopf genau einmal (Hero-CTA) · 3D-Kippen nur auf der Score-Karte (±5°) · Sticky-Story mit drei Schritten · Vorher/Nachher-Regler mit Intro-Bewegung · MALIN + KEVIN → MAKE als Buchstaben-Animation. Alles hinter `prefers-reduced-motion` und `(hover:hover) and (pointer:fine)`.

## Positionierung im Feld „Life OS“
| Anbieter | besetzt | Preis |
|---|---|---|
| Notion „Life OS“-Vorlagen | Alles-in-einem-Vorlage in der Notion-Cloud | 99–130 $ einmalig |
| Sunsama | achtsame Tagesplanung, Work-Life-Balance | 17–22 $/Monat |
| Motion | Automatisierung, „AI to double productivity“ | ab 19 $/Monat |
| Akiflow | Konsolidierung für Gründer und Operatoren | 19 $/Monat |
| Reclaim | KI-Kalender für Arbeit | Free/Business |
| Reflect | private Notizen, Ende-zu-Ende-verschlüsselt | 10 $/Monat |
| Anytype | „personal operating environment“, local-first, Zero-Knowledge | Free/Pro |

**Die Lücke:** Niemand kombiniert (a) Leben und Unternehmen in einem Datenmodell, (b) eigenen Server in Deutschland mit Verschlüsselung, (c) einen Assistenten mit Freigabe-Prinzip, (d) das Gründerpaar als Zielgruppe. Rückenwind: Bitkom Cloud Report 2026 — 85 % halten Deutschland für zu abhängig von US-Clouds, 37 % würden dafür Nachteile in Kauf nehmen; EU AI Act Art. 14 beschreibt genau das Muster „KI empfiehlt, Mensch bestätigt“.

**Fünf Optionen für den Hero** (alle bestehen den Beschreibungs-Test): 1 „Ein Assistent, der fragt, bevor er handelt.“ · 2 „Dein Leben. Dein Unternehmen. Dein Server.“ · 3 „Sieh jede Woche, ob Leben und Geschäft im Gleichgewicht sind.“ · 4 „Zu zweit gründen, ohne dass eines von beiden zu kurz kommt.“ · 5 „Fünf fremde Clouds oder ein System, das dir gehört.“ — Gewählt: Kategorie-Satz als H1 („Das Betriebssystem für dein Leben und dein Unternehmen.“), Option 1 als erster Satz der Subline, Option 2 als Sektion „Souveränität“, Option 4 als „Warum MAKE“, Option 5 im Regler.

Ehrliche Risiken: „OS“ ist inflationär (differenziert nicht — Freigabe und eigener Server schon); Preisanker der Vorlagen liegt bei ~100 $ einmalig; für „Unternehmerpaare“ gibt es keine belastbare Marktgröße (Paar-Fokus als Herkunft erzählen, nicht als Marktzahl); Du-Ansprache passt für Gründer, nicht für CFO-Zielgruppen.

## Founder, Vertrauen ohne Logos, CTA
- NN/g: über 50 % wollen eine „Über uns“-Seite sehen, echte Fotos, kein Stock; vier Glaubwürdigkeitsfaktoren (Designqualität, offene Information, Vollständigkeit, Verbindung nach außen).
- Paar-Gründer-Vorbilder (Tally, Wildbit/Postmark): Paar-Status als Herkunft, nicht als Verkaufsargument; Rollen benennen; Arbeitsprinzipien statt Vision-Floskeln. → Sektion „Warum MAKE“ mit Name, Rollen, einem Zitat.
- Vertrauen pre-launch: Dogfooding-Datum, Changelog, Verschlüsselungssatz, „Was es nicht ist“, Gründer-Fotos, Server-Standort als Faktenzeile — alle sechs umgesetzt (Fotos als Platzhalter).
- CTA: ein Feld + Knopf, klare Erwartung („kein Newsletter“); für ein selbst gehostetes Produkt sind Probe-Instanz oder Read-only-Demo die nächsten Stufen.

## Logo und Schrift
- LogoLounge 2026: Monogramme, „Open Axis“ (Elemente auf einer Achse mit bewusster Lücke — passt zu MA | KE), Systeme statt Assets. → Bildmarke: ein M aus zwei Strichen (Malin, Kevin) mit türkisem Kern; Wortmarke MAKE OS mit zwei Strichen unter MA und KE (Kevins CI-Idee).
- Schrift: Empfehlung der Recherche wäre Instrument Serif + Inter; gewählt wurden die Schriften der Software (Archivo für Zahlen und Titel, Public Sans für Text), selbst gehostet — Kevins Vorgabe „CI aus der Software“ und keine Drittschriften.

## Entscheidungsliste (Empfehlung → umgesetzt)
1 Hero: Kategorie-Satz + Freigabe-Satz ✓ · 2 Hero-Aufbau: Chip → H1 → Sub mit Zielgruppe → ein CTA → lebendes Produktbild ✓ · 3 Zehn+ Sektionen in der belegten Reihenfolge ✓ · 4 Textmenge knapp, keine Superlative ✓ · 5 Effekt-Budget ✓ · 6 Leistung ohne Video/WebGL ✓ · 7 Proof pre-launch ✓ · 8 CTA einfeldig ✓ (Demo-Instanz später) · 9 About als Sektion, Paar als Herkunft ✓ · 10 Schrift aus der Software (abweichend von der Empfehlung, bewusst) · 11 Marke: M-Bildmarke + Wortmarke mit Fuge ✓ · 12 Du ✓ · 13 Nichts übernommen, was laut ist ✓

## Quellen (Abruf 27.09.2026)
1 linear.app · 2 linear.app/now/behind-the-latest-design-refresh · 3 designmd.cc/benchmarks/linear · 4 blog.logrocket.com/ux-design/linear-design · 5 raycast.com · 6 github.com/VoltAgent/awesome-design-md (Raycast DESIGN.md) · 7 vercel.com · 8 stripe.com (DE) · 9 designmd.cc/benchmarks/stripe · 10 css-tricks.com (Apple-Scroll) · 11 in-sync.io (Scroll-to-action) · 12 brad-holmes.co.uk (Scroll-Animationen) · 13 notion.com · 14 notion.com/product/calendar · 15 superhuman.com · 16 reflect.app · 17 tana.inc · 18 framer.com · 19 sunsama.com · 20 usemotion.com · 21 akiflow.com · 22 reclaim.ai · 23 culturedcode.com/things · 24 arc.net · 25 framiq.app/blog/best-saas-landing-pages-2026 · 26 nngroup.com/articles/scrolling-and-attention · 27 nngroup.com/articles/scrolljacking-101 · 28 nngroup.com/articles/scroll-fading-101 · 29 nngroup.com/articles/animation-duration · 30 julian.com/guide/startup/landing-pages · 31 copyhackers.com (clear vs. clever) · 32 copyhackers.com (headline formulas) · 33 hype4.academy (hero sections) · 34 unbounce.com (SaaS conversion benchmark) · 35 unbounce.com (average conversion rates) · 36 web.dev/articles/vitals · 37 web.dev/articles/optimize-lcp · 38 web.dev/learn/performance/video-performance · 39 mintec.co (hero video dilemma) · 40 w3.org WCAG 2.3.3 · 41 w3.org SCR40 · 42 navattic.com (interactive demo report 2025) · 43 developer.chrome.com (scroll-driven animations) · 44 developer.mozilla.org (scroll-driven animations) · 45 buildmvpfast.com (Firefox-Status, unsicher) · 46 scroll-driven-animations.style (stacking cards) · 47 bram.us (card stack) · 48 dirckmulder.com (scroll reveal CSS) · 49 en.inithtml.com (magnetic hover) · 50 blog.finiam.com (spotlight) · 51 bholmes.dev (shiny hover) · 52 vanilla-tilt.js · 53 codepen nathanlong (counter) · 54 web.dev/articles/speed-parallax · 55 developer.chrome.com/blog/performant-parallaxing · 56 reclaim.ai/blog/motion-alternatives · 57 morgen.so (Akiflow alternatives) · 58 temporal.day (Notion agent vs. AI calendars) · 59 littlebird.ai (second brain apps) · 60 tana.inc/blog (second brain apps 2026) · 61 notion4management.com (Life OS templates) · 62 thomasfrank.gumroad.com/l/ultimatebrain · 63 nicklafferty.com (Notion second brain) · 64 morgen.so (Sunsama pricing) · 65 ellieplanner.com (Motion pricing) · 66 morgen.so (Akiflow pricing) · 67 inkandswitch.com/essay/local-first · 68 privacytools.io/app/anytype · 69 bitkom.org Cloud Report 2026 (PDF) · 70 connect-professional.de (Bitkom-Studie) · 71 artificialintelligenceact.eu/article/14 · 72 coaching-magazin.de (Copreneur, nicht repräsentativ) · 73 nngroup.com/articles/about-us-summaries · 74 nngroup.com/articles/trustworthy-design · 75 tally.so/about · 76 bootstrappers.com (Tally) · 77 technical.ly (Wildbit/Postmark) · 78 builttosell.com/radio/episode-363 · 79 shoutjar.com (social proof before launch) · 80 getlaunchlist.com (waitlist examples) · 81 viral-loops.com (waitlist) · 82 codesi.ai (waitlist pages, unsicher) · 83 logolounge.com 2025 · 84 logolounge.com 2026 · 85 logotouse.com (tech logo trends) · 86 fonts.google.com/specimen/Geist · 87 fonts.google.com/specimen/Instrument+Serif · 88 fonts.google.com/specimen/Bricolage+Grotesque · 89 madegooddesigns.com (font pairings) · 90 web.dev/articles/variable-fonts · 91 marketing-boerse.de (Du oder Sie, Appinio) · 92 absatzwirtschaft.de (Duzen oder Siezen) · 93 medium.com Mac O'Clock (Apple landing page) · 94 roast.page (hero statistics, nur Einordnung) · 95 vercel.com/font

Als unsicher markiert und vor externer Verwendung gegenzuprüfen: Tana-Positionierung (17), Firefox-Status für Scroll-Timelines (45), Warteliste-Zahlen (82), „5,7 Sekunden“-Claim (94).
