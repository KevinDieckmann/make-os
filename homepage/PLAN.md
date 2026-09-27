# MAKE OS Homepage — Plan (27.09.2026)

Kevin: „Homepage für MAKE OS, sauber auf dem UX-Design unserer Software. Logo entwerfen. USP selbst aus der Software holen und positionieren. Keine 08/15-Seite: extrem hochwertig, mit Effekten und sauberen Beschreibungen. Zu jedem Thema die Top 1 % der Welt. Mich und Malin als Founder; MA-KE = Malin + Kevin muss rauskommen. Ich will das nur einmal testen.“

## Annahmen (von mir gesetzt — Kevin korrigiert, wenn falsch)
- **Wo:** eigenständige statische Seite in `homepage/` (HTML + CSS + wenig JS). Nicht hinter dem Login, keine Abhängigkeit zur App, überall hostbar (Hetzner-Caddy, Vercel, GitHub Pages). Lokal: Preview „make-os-homepage“ (Port 3012).
- **Sprache:** Deutsch, Du. Englische Fassung später als Kopie.
- **Zweck:** Pre-Launch. Ein CTA: „Einmal testen“ (Warteliste / persönliche Einladung), kein Shop, kein Login-Link im Vordergrund.
- **Zielgruppe:** Gründer, Selbstständige und Paare, die Leben UND Geschäft führen — und die ihre Daten nicht an einen US-Dienst geben wollen.
- **Stil:** die Software selbst — dunkler Grund `#0B0E10`, Flächen `#161B1F`, Text `#E8ECEA`, Türkis `#58D9CD` als einzige Interaktionsfarbe, Zustandsfarben nur für Zustand (grün/gelb/rot), Lavendel für Schlaf; Radien 8/14; 4-px-Raster; sechs Schriftgrößen. Whoop/N26 als Vorbild: ruhig, wenige Zahlen, jede groß.

## Positionierung (USP aus der Software)
1. **Ein System für beides.** Leben und Business in EINEM Betriebssystem — Wachstums-Score aus Gesundheit, Beziehung, Finanzen und Business, Privat- und Business-Index, ein Modus-Schalter. (Alle anderen trennen: Sunsama/Motion = Arbeit, Whoop = Körper, Notion = leer.)
2. **Jarvis handelt — mit deinem Ja.** KI-Assistent mit Werkzeugen und Agenten (Heads of Sales/Marketing/Event/Finance/IT), aber Freigabe-Prinzip: alles Ausgehende wartet im Stapel. Kein Versand ohne Mensch.
3. **Dein Server, dein Brain.** Selbst gehostet in Deutschland, verschlüsselt im Ruhezustand, Obsidian-Vault als Wahrheit, lokale KI-Suche (Volltext + Embeddings) — nichts verlässt den Server außer der Frage an das Modell.
4. **Zu zweit gebaut, für zwei.** Kevin und Malin — MA-KE. Zwei Personen, ein Brain, klare Räume (privat-kevin, privat-malin, gemeinsam), Übergaben, Freigaben, Konfliktschutz.
5. **Markttraktion statt Lautstärke.** CRM, Deals, Follow-ups, Events, Marketing — gemessen an Gesprächen und Deals, DSGVO-fest (Art. 14, Werbesperre, Einwilligung).
6. **Der Head of IT wacht.** Sicherheit, Betrieb und Außenblick als Ampeln — die Software überwacht sich selbst.

Headline-Kandidaten (Entscheidung nach Recherche): „Das Betriebssystem für dein Leben und dein Unternehmen.“ · „Ein System. Beide Leben.“ · „Führe dein Leben wie dein Unternehmen — und umgekehrt.“

## Seitenaufbau (eine Seite, Scroll-Story)
1. **Hero** — Logo, Claim, ein Satz, CTA „Einmal testen“, dahinter der Score-Ring als lebendiges Element (Zahl zählt hoch, Säulen füllen sich).
2. **Das Problem in drei Sätzen** — sieben Apps, zwei Leben, null Überblick (Sticky-Text mit wechselnden Bildern).
3. **Ein System** — die vier Säulen des Wachstums-Scores als interaktive Ringe; Privat ↔ Business Umschalter live.
4. **Jarvis** — Chat-Mockup: Frage → Werkzeug → Vorschlag im Stapel → Freigabe. „Er handelt. Du entscheidest.“
5. **Die Bereiche** — Karten-Karussell: Gesundheit, Zahlen, Markttraktion, Brain, Kalender, Head of IT — je ein echtes Bild aus der Software (Dummy-Daten) und ein Satz.
6. **Dein Server, dein Brain** — Architektur-Grafik: Vault → Index → Jarvis → Freigabe; Schloss-Motiv, Deutschland-Hinweis.
7. **Zu zweit** — Räume und Übergaben; wie Kevin und Malin dasselbe System teilen, ohne Privates zu teilen.
8. **Warum MAKE** — Founder-Sektion: Malin + Kevin, die Buchstaben verschmelzen animiert zu MAKE; kurze Geschichte, zwei Porträt-Platzhalter, Zitat.
9. **Zahlen, die stimmen** — nur Systemzahlen (z. B. „24 Agenten“, „0 Versand ohne Freigabe“, „100 % auf eigenem Server“) — keine erfundenen Kunden.
10. **Einmal testen** — Formular (Name, Mail, warum) → speichert lokal in einer Datei/E-Mail-Link; Datenschutzsatz. Footer: Impressum-/Datenschutz-Platzhalter.

## Effekte (mit Maß; alle mit `prefers-reduced-motion`)
- Scroll-getriebene Reveals (IntersectionObserver), Sticky-Storytelling für Sektion 2/6, Zahlen-Counter, Score-Ring-Animation (SVG stroke-dashoffset), Spotlight-Cursor im Hero, sanfter Parallax (max. 6 px), Magnetic-CTA, Tilt auf Produktkarten, Text-Reveal per Wort in H1. Keine Autoplay-Videos, kein Sound, LCP < 2 s (keine großen Bilder, SVG statt PNG).

## Logo
- Wortmarke **MAKE OS** in der Display-Schrift der Software; Bildmarke: ein **M**, dessen zwei Außenstriche für Malin und Kevin stehen und sich in der Mitte zu einem Punkt (dem Kern/OS) treffen — funktioniert als App-Icon, Favicon und in Türkis auf Dunkel wie in Grau auf Hell. Drei Entwürfe zur Auswahl in `assets/logo-entwuerfe.html`, danach `logo.svg`, `logo-wortmarke.svg`, `favicon.svg`, `apple-touch-icon` (PNG aus SVG).

## Recherche (parallel, läuft)
- Top-1 %-Landingpages, Effekte, Positionierung im Life-OS-Feld, Founder-Sektionen, Logo-/Font-Trends → `homepage/RECHERCHE.md`.
- Kevins Obsidian-Homepages → Muster, Wording, Name-Geschichte → fließt in Texte und Founder-Sektion.

## Stand 27.09. (zweiter Durchgang fertig — nach Kevins Feedback)
Kevin: „Grundgedanken sehr gut, CI gefällt mir. Logo noch nicht so. Nie echte Namen, Termine oder Kundendaten. UX kann mehr geben.“
1. **Datenhygiene:** alle Personen, Firmen, Termine, Protokolle und Firmenbezüge in den Bildern sind erfunden (Jonas Berg, Nordlicht GmbH, Kanzlei Weiß, Atelier Fuchs, Studio Lenz); Gesundheitsdetails und Firmennamen der Gründer raus; Fußzeile und FAQ sagen es ausdrücklich. `homepage/pruefen.mjs` (Sperrliste Namen/Kunden + verbotene Wörter) läuft vor jedem Stand: `node homepage/pruefen.mjs`.
2. **Logo F** gewählt (`assets/logo/logo.svg`, `logo-app.svg`, `logo-hell.svg`, `logo-mono.svg`, `wortmarke.svg`, `favicon.svg`): zwei Hälften — MA hell, KE türkis — treffen sich in der Fuge zum M; Wortmarke teilt genauso. Runde 2 (E–I) in `assets/logo/entwuerfe.html`; Runde 1 gelöscht.
3. **UX:** jedes Produktbild im App-Rahmen der Software (Fensterkopf, Leiste Home/Jarvis/System, Score-Chip) · Hero mit Aurora, Raster, Cursor-Licht, drei Fakten · Fortschrittsbalken, Scrollspy, Burger-Menü, Nach-oben · Weg eines Vorschlags (Erfassen → Vorschlag → Freigabe → Ausführung) animiert · Widgets „Größter Hebel“ und „Der Stapel“ im Start-Fenster · Mini-Verläufe in den Säulen · Founder-Karten mit Initialen in Personenfarbe · Regler auf Handy gestapelt · Korn-Overlay · Reiter per Pfeiltasten.
4. Geprüft: Desktop 1440 (headless), Handy 375 (Pane-Emulation: keine Seitenverschiebung, Burger sichtbar, Konsole leer), Reduced-Motion, Tastatur-Fokus, `pruefen.mjs` grün.
5. Kevin testet: Preview „make-os-homepage“ (Port 3012). Hosten nur auf sein Wort.

## Offen für Kevin
- „Life & Business **Operating** System“ (englisch korrekt) oder „Operation System“ wie im Auftrag und in `Terminologie_Brain`?
- Echte Porträts von Malin und Kevin (die CI verlangt sie — Initialen-Karten sitzen in „Warum MAKE“).
- Mail-Adresse für „Einmal testen“ (Platzhalter in `js/site.js`, Konstante `EMPFAENGER`) und Domain (make.one/.build waren am 21.09. frei; „MAKE“ in Klasse 35 fremd belegt).
- Gründergeschichte in drei Sätzen (Kennenlernen, der Moment der Entscheidung) — steht nirgends im Vault.
- Zweite Stufe des CTA: Read-only-Demo-Instanz mit Beispieldaten oder 14-Tage-Probe-Server.
