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

## Dritter Durchgang (27.09.): Brain-Effekt und Abenteuer
Kevin: „Der Schieber reicht da nicht. Überarbeite das Ganze. Malin ist eher Rot, Kevin Grün. Bau uns daraus ein Abenteuer, das verkauft.“

**Gebaut**
1. **Das Brain (`js/brain.js`, ~330 Zeilen, keine Bibliothek).** Ein 2D-Canvas als Sticky-Bühne hinter den ersten fünf Kapiteln (`.odyssee` → `.buehne`). 548 Knoten (Handy 244) auf einer Hirnform — Fibonacci-Kugel, breiter als hoch, Furche in der Mitte, Windungen als Sinus-Wellen im Radius — plus Kernknoten. Linke Hälfte Granat (Malin), rechte Hälfte Smaragd (Kevin), Synapsen über die Furche und der Kern in Türkis (das Produkt). Kanten sind die zwei nächsten Nachbarn im Raum (einmal gerechnet). Das Netz dreht sich langsam, neigt sich zum Zeiger, Knoten weichen der Maus (Handy: dem Finger) aus, Verbindungen leuchten dort türkis auf.
2. **Die Verwandlung folgt dem Scrollen, nie umgekehrt.** Aus der Lage des Abschnitts wird ein kontinuierlicher Kapitelindex f ∈ [0, 4] mit ruhigen Fenstern um jede Kapitelmitte; daraus Gewichte je Kapitel (Dach-Funktionen), die Zielpositionen mischen: **00 Hero** ein Brain aus zwei Hälften · **01 Zwei Leben** die Hälften treiben auseinander · **02 Das Chaos** alles zerfällt in neun graue App-Haufen mit Chips (Wearable, Kalender, CRM … jede „alles gut“) · **03 Ein Brain** die Haufen finden sich hinter der Score-Scheibe wieder (Glas: das Netz schimmert durch) · **04 Jarvis** ein Impuls läuft per Breitensuche vom Kern nach außen, bleibt am Stapel-Knoten stehen (gelb, „Wartet auf dein Ja“) und wird beim Weiterscrollen grün („Freigegeben — von dir“). Am Ende der Bühne blendet das Canvas aus.
3. **Das M (`#make-m`).** Zweites Netz im Founder-Abschnitt: Granat- und Smaragd-Wolken treiben, formen beim Einscrollen die zwei Striche von Logo F und treffen sich in der Fuge — dort ein türkiser Funke. Darunter weiter die MALIN + KEVIN → MAKE-Animation, jetzt mit MA in Granat und KE in Smaragd.
4. **Kapitel-Dramaturgie.** Zehn Stationen mit Rail rechts (Desktop) und Kapitel-Label im Kopf (Handy): 00 Start · 01 Zwei Leben · 02 Das Chaos · 03 Ein Brain · 04 Jarvis · 05 Die Bereiche · 06 Dein Server · 07 MA + KE (Founder + Zu zweit) · 08 Was drinsteckt (Zahlen, Für wen, Entwicklung, Fragen) · 09 Einmal testen. Der Vorher/Nachher-Regler und die Sticky-Story sind im Effekt aufgegangen (Chaos → Brain). Kapiteltexte blenden über der Bühne ein und aus; im langen Jarvis-Kapitel bleibt der Text stehen, während der Impuls läuft. Kevins Texte, die App-Rahmen, Zähler, Reiter, Chat, Weg eines Vorschlags, Garantien, FAQ, Formular bleiben.
5. **Granat und Smaragd als Erzählfarben** (`--granat:#D13A55`, `--smaragd:#22B577` in `site.css`; `ci.css` unverändert): Logo F (linker Strich Granat, rechter Smaragd — `logo.svg`, `logo-app.svg`, `logo-hell.svg`, `favicon.svg`), Wortmarke nach MAKE-CI (Buchstaben weiß, Granat-Strich unter MA, Smaragd-Strich unter KE — Nav, Footer, `wortmarke.svg`), Founder-Karten, Räume privat-malin/privat-kevin, Fortschrittsbalken, Aurora. Türkis bleibt Produkt-Akzent (CTA, Ring, Kern, Synapsen).
6. **Standbild und Fallbacks.** `assets/brain-standbild.svg` (63 KB, gleiche Geometrie, fester Blickwinkel) liegt unter dem Canvas und bleibt ohne JS oder ohne Canvas stehen; `prefers-reduced-motion` schaltet den Dauerlauf ab — ein Bild je Scroll-Stand, Übergänge springen. Handy: weniger Knoten, Haufen enger, Text unten mit Scrim, Score-Scheibe unter dem Text.
7. **Behobene Falle:** `body{overflow-x:hidden}` machte den Body zum Scroll-Container — `position:sticky` (Nav und Bühne) griff nicht. Jetzt `overflow-x:clip`.
8. **Prüfung:** `pruefen.mjs` prüft jetzt Seite **und** Code (css/js) auf gesperrte Namen (inkl. Vorbild-Firma und -Gründer), verbotene Wörter, eingebundene Skripte und das Standbild. Headless-Screenshots 1440×900 (Hero, jedes Kapitel, Übergang, MA + KE) und 390×844 (Hero, Kapitel, Bereiche) — keine horizontale Verschiebung, Konsole leer.

**Stellschrauben (alle in `js/brain.js`, oben in `grosseBuehne` / `kleineBuehne`)**
- Knotenzahl `N_OBER`/`N_KERN` (470/78 Desktop, 210/34 Handy) · Nachbarn `nachbarn(P, 3, 2)` (2 → dichter mit 3) · Drehung `winkel += dt * .00011` · Trägheit `k = .1` · Zeiger-Radius `RM` (150/90) und Kraft `* 14`.
- Lage: `grund()` (Desktop Mittelpunkt 70 % Breite, Radius min(36 % Höhe, 19 % Breite); Handy 50 %/30 %) · Spalt in „Zwei Leben“ `R * .5` · Chaos-Raster `HAUFEN`, Streuung `hx/hy/rC`.
- Kapitelfenster: `spanne(u, .22, .78)` (ruhige Zone ±22 % um jede Mitte) · Kapitellängen in `site.css` (`.kapitel` 100 svh, `.kapitel.lang` 190 svh) · Ausblenden am Ende `max − vh * .45`.
- Impuls: `front = u4 * (maxHop + 3)`, Freigabe bei `u4 > .78`, Stapel-Knoten = weit außen rechts oben.
- Farben nur in `F` (brain.js), `:root` (site.css) und den Logo-SVGs.
- Bilder: `node …/standbild.mjs` (Skript im Scratchpad dieser Session; bei Geometrie-Änderung neu erzeugen — Rezept steht im Kopf von `brain.js`).

**Offen für Kevin**
- Farbwerte final: Granat `#D13A55` / Smaragd `#22B577` sind aus der MAKE-CI abgeleitet, nicht daraus kopiert (die PDF nennt Namen, keine Hex-Werte) — gegen die Original-CI prüfen.
- Hero-Bild: Brain allein (jetzt) oder Brain + kleine Score-Scheibe wie im zweiten Durchgang?
- Das Chaos-Kapitel nennt Gattungen (Wearable, CRM, Banking …) — sollen echte Produktnamen als Gegner genannt werden (verkauft härter, ist aber angreifbar)?
- Kapitel 06 „Dein Server“ könnte ein drittes Netz bekommen (Brain in einem Server-Rahmen, eine Linie geht raus und kommt zurück) — bewusst noch nicht gebaut, damit der Effekt nicht inflationär wird.
- Ton auf dem Handy: die Bühne liegt hinter dem Text (Scrim); Alternative wäre Bühne oben, Text darunter ohne Überlappung (ruhiger, aber weniger Kino).

## Offen für Kevin (zweiter Durchgang, weiter gültig)
- „Life & Business **Operating** System“ (englisch korrekt) oder „Operation System“ wie im Auftrag und in `Terminologie_Brain`?
- Echte Porträts von Malin und Kevin (die CI verlangt sie — Initialen-Karten sitzen in „Warum MAKE“).
- Mail-Adresse für „Einmal testen“ (Platzhalter in `js/site.js`, Konstante `EMPFAENGER`) und Domain (make.one/.build waren am 21.09. frei; „MAKE“ in Klasse 35 fremd belegt).
- Gründergeschichte in drei Sätzen (Kennenlernen, der Moment der Entscheidung) — steht nirgends im Vault.
- Zweite Stufe des CTA: Read-only-Demo-Instanz mit Beispieldaten oder 14-Tage-Probe-Server.
