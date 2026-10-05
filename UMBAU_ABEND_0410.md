# Umbau 04.10.2026 abends — vorgemerkt (Kevin)

Kevin, 04.10.: „später einfach aufnehmen — wir machen heute Abend noch einen größeren Umbau, wenn wir das alles einmal
angeschaut haben.“ Nichts davon ist gebaut. Erst nach gemeinsamem Ansehen von makeinnovation.de (Standard, Branch
website-standard, auf entwicklung) und fokusinnovation.de (Branch fokus-3d).

Vorlage für alle drei Punkte: getlayers.ai „Solaris“ (Three.js-Punktwolke). Übernommen wird die WIRKUNG, nicht der Code:
**unsere CI** (Granat #C9465C, Smaragd #2FA878, unser dunkler Grund, Archivo + Public Sans), kein CDN/Three.js auf den
statischen Seiten (CSP 'self' → eigene WebGL-1-Engine website/js/szene/*), keine fremden Farben.

## Die Solaris-Wirkung (Kern der Vorlage, zum Nachbauen)
- Dichte Punktwolken-Kugel (~120 k Punkte, SphereGeometry 4.2 · 200 × 600 als Points), additiv, atmet mit Simplex-Rauschen
  (zwei Oktaven, Ausschlag entlang der Normale).
- Farbverlauf kühl → warm über die Kugel (bei uns Smaragd → Granat), hohle dunkle Mitte, heller Fresnel-Rand
  (edgeFade = smoothstep(0.4, 0.9, rim)).
- Einstieg 2,4 s easeOutCubic: Kugel erst gefüllt und nah, dann fährt die Kamera zurück und die Mitte höhlt sich zum
  leuchtenden Ring aus; die ganze Wolke blüht aus dem Nichts auf.
- „Sonneneruption“ unter dem Zeiger: Strahl auf eine unsichtbare Pick-Kugel, Punkte in Reichweite (Radius 2) schießen
  entlang der Normale hinaus (Flare 1,4), flackern wie Plasma, werden größer und glühen Richtung Weiß; Stärke und Ort
  folgen weich (0,09 / 0,18 je Bild).
- Aurora in den Ecken (fBm, Mitte frei) — haben wir auf makeinnovation.de schon (Granat/Smaragd, dezent).
- Bloom (UnrealBloom 1,64 / 1,14 / 0,04) — auf der Homepage bisher bewusst weggelassen; für ZOE/Brain in der App prüfen.

## 1 · ZOE tritt so auf (MAKE OS)
- Immer wenn wir mit ZOE sprechen: die Kugel als ihr Gesicht (Zustände zuhören / denken / sprechen über Farbe und Atem,
  wie heute in components/os/ZoeHirn.tsx — das SVG-Hirn wird abgelöst bzw. bleibt Rückfall ohne WebGL).
- Zusätzlich **unten als kleines Symbol** (ZoePanel, app/os/layout.tsx), dieselbe Kugel klein.
- **Keine** Verwandlung in einen Weg in der App (Kevin: „nur auf der Homepage“).
- Leistung: kleines Symbol mit wenigen Punkten und niedriger Bildrate; Schleifen pausieren, wenn unsichtbar;
  reduced motion → ruhiges Standbild.

## 2 · makeinnovation.de startet mit der Kugel → wird zum Weg
> **Stand 04.10. nachmittags:** teilweise überholt — Kevin hat den 80/20-Neubau auf der klaren „Superconscious“-Basis
> (hell → dunkel) beauftragt (Branch website-klar). Dort sitzt die Partikel-Kugel im dunklen Raum. Ob sie zum Weg wird,
> beim gemeinsamen Ansehen klären.
- Einstieg = diese Kugel (ohne den Namen ZOE — Website nennt die Software nicht), die beim Scrollen in den Neuronen-Weg
  übergeht, wie bei „New Era“ (Kugel → nächste Form über smoothstep-Phasen am Scroll-Fortschritt).
- Ersetzt den heutigen „Lichtwolke blüht auf“-Einstieg; Zeiger-Eruption auf der Kugel am Rechner, am Handy aus.

## 3 · Brain als Punkte-Kugel (MAKE OS, app/os/wissen → WissenView)
- **Alles in MAKE OS als Datenpunkte** (Kevin): Kontakte, Firmen, Aufgaben, Ziele, Termine, Wissen — eingefärbt nach
  Bereich, gruppiert (Cluster je Bereich/Space), Größe/Helligkeit z. B. nach Aktualität/Bedeutung.
- Zeiger: Eruption an der Stelle + Titel des Punkts und seine Verbindungen; Klick öffnet den Datensatz.
- **Privat bleibt privat:** nur Punkte, die der Betrachter sehen darf (fuerBetrachter/personStreng/nurIchBesitzer —
  dieselben Filter wie die Lichtfäden), Testkunden sehen nie unsere Daten. Daten über eine Lese-Route, eine Quelle.
- Leistung: Punktzahl deckeln, Daten zusammengefasst ausliefern, Schleife pausieren.

## 4 · Überblick-Muster „Für dich“ für JEDEN Bereich (MAKE OS)
Kevin, 04.10. (Screenshot Markttraktion → Überblick, Karte „Für dich“): „finde ich mega. Lass uns so immer den
Überblick gestalten und dann den Flow so anzeigen, wie es die letzten 3 Monate war, wie es jetzt ist und wie der
Forecast ist. So können wir das immer so klar abbilden — für jeden einzelnen Bereich.“
- Vorbild: components/os/crm/Ueberblick.tsx (+ crm/fokus-reihen.ts) — `Karte ton="fokus"`, oben die `FadenLinie`
  (components/os/ui/fokus.tsx), darunter wenige priorisierte Zeilen (Punkt · Titel · Unterzeile mit Bereich und
  Handlung · Zahl-Pille), Person rechts oben.
- NEU die Zeitachse: **letzte 3 Monate (Ist) → heute (Markierung) → Forecast**. Ist und Prognose sichtbar
  unterschieden (z. B. Prognose gestrichelt/leiser, Beschriftung „Prognose“), Achse „−3 M · heute · +X“.
- Ehrlich: nur echte Datenreihen (bestehende Regel „FadenLinie nur mit echter Reihe“); die Prognose wird aus echten
  Daten gerechnet (Fälligkeiten, Pipeline × Wahrscheinlichkeit, Pläne/Raten, Termine) — nie geschätzt oder erfunden;
  ohne Grundlage keine Prognose, sondern ein klarer Leerzustand.
- EIN gemeinsamer Baustein (z. B. `Ueberblick`/`FlussKarte` in components/os/ui/) + eine Reihen-Schnittstelle je
  Bereich (Ist-Reihe, heute, Prognose-Reihe, Zeilen) — nicht je Bereich neu bauen. Wächtertest: jede Bereichsseite
  nutzt den Baustein.
- Für jeden Bereich: Markttraktion (Vorbild), Finanzen, Planung/Ziele, Aufgaben, Kalender, Gesundheit, Familie,
  Netzwerken, Inbox, Wissen/Brain … (Liste beim Umbau aus der Navigation ziehen). Privatfilter wie überall.
- 80/20-Regel gilt (Memory feedback-80-20-seriositaet): die Linie ist der Akzent, der Rest ruhig und klar.

## 5 · Löschen & Archivieren überall gleich (MAKE OS, Usability)
Kevin, 04.10.: „Wenn man auf Produkte geht, kann man keine Produkte löschen — das macht das Ganze wieder ein bisschen
wild. Für die Usability können wir auch immer Tasks, Produkte etc. einfach löschen bzw. den Button, der kommt, wenn man
z. B. nach links swiped: dann kommt da Löschen oder Archivieren. Alles andere macht da keinen Sinn.“
- Befund: components/os/mandate/Produkte.tsx kann Lieferumfang/Phasen/Unterlagen entfernen, aber kein Produkt selbst.
  Beim Umbau alle Listen prüfen (Aufgaben, Produkte, Mandate, Kontakte/Firmen, Deals, Events, Ziele, Notizen …),
  wo Löschen/Archivieren fehlt oder je Ort anders aussieht.
- EIN gemeinsamer Baustein (z. B. `ZeileAktionen` in components/os/ui/): am Handy nach links wischen → „Archivieren“
  und „Löschen“ erscheinen; am Rechner dieselben zwei Aktionen beim Überfahren bzw. im „…“-Menü der Zeile. Tastatur
  erreichbar, Vorleser-Beschriftung.
- Sicher statt endgültig: Archivieren = ausblenden, jederzeit zurückholbar. Löschen = in den Papierkorb (bestehende
  Grabsteine/Archiv-Logik nutzen, z. B. wie /api/crm/firma-archiv mit 30 Tagen), dazu „Rückgängig“ für einige Sekunden.
  Endgültig weg erst nach Ablauf. Verknüpfungen prüfen (Produkt mit laufenden Mandaten → Hinweis statt stillem Löschen).
- Rechte: nur wer darf, sieht die Aktion (Haushalts-Tor, Besitzer); Testkunden nie fremde Daten.
- Wächtertest: jede Liste mit Einträgen nutzt den Baustein.

## 6 · Lichtfäden-Strahl in der Planung zurücknehmen (MAKE OS)
Kevin, 04.10. (Screenshot Planung › Business, Zeitstrahl Jan 2026 – Dez 2027): „Das muss auch noch ein wenig zurückgeholt
werden. Oben die Symbole genial, aber das sieht schon zu spacig aus.“ (Gegenbewegung zu Strahl v3.1 vom Vormittag:
„deutlich größer + kräftige Wellen“ — jetzt gilt die 80/20-Regel.)
- **Bleibt:** die Marker oben (Raute = Meilenstein, Quadrat = Steuerfrist) mit Stiel zur Linie, „+N“-Bündel, Zeitraum-Wahl,
  „Heute“, „+ Meilenstein“, Monats-/Quartalsachse.
- **Zurücknehmen:** das Band — deutlich weniger und dünnere Fäden, geringere Deckkraft, viel kleinere Wellen-Amplitude,
  KEIN heller Ausbruch/Glühen am Heute-Punkt (eine ruhige senkrechte Heute-Linie reicht), keine rosa/violetten Mischtöne,
  Farben nur je Ziel (zielFarben), Hintergrund-Netz weg oder kaum sichtbar. Ziel: man liest Ziele/Fristen, der Faden
  ist Akzent (≤ 20 % Wirkung).
- **Bedeutung statt Deko (Kevin 04.10. nachgeschärft):** „Gliedere einfach mehr. Die einzelnen Farben von den einzelnen
  Themen müssen immer gebündelt sein und zusammenlaufen. Es darf nur ausgeschlagen werden, wenn etwas Unvorhergesehenes
  kommt oder etwas schiefgelaufen ist. Ziel ist, dass alle Linien immer ruhig laufen — nach Ziel, Plan und Meilenstein.“
  → Je Thema EIN gebündelter Strang (Fäden einer Farbe eng zusammen), Themen sauber gegliedert (eigene Spur/Lage), Stränge
  laufen zum großen Ziel zusammen. Ruhelage = im Plan. Ausschlag NUR aus echten Abweichungen (Meilenstein überfällig/
  verschoben, Frist gerissen, Ziel gekippt, Kapazität überlastet, ungeplantes Ereignis) — Stärke = Größe der Abweichung,
  nie Zufall/Rauschen. Wächtertest: ohne Abweichung ist jeder Strang glatt (Amplitude 0 bis auf minimale Fadenbreite).
- Technik: Parameter in lib/lichtfaeden/band.ts / zeichnen.ts (eine Stelle), damit Planung, Für-dich-Linien und Website
  zusammen ruhiger werden; Wächtertest auf Höchstwerte (Fadenzahl, Deckkraft, Amplitude), damit es nicht wieder kippt.

## 7 · Säule „Kapazität“ im Business-Index + Kapazitätsplanung (extrem wichtig)
Kevin, 04.10.: „Schlichtweg die Zeit und Machbarkeit über die Personen und Kapas … Wir haben Kunden, Ziele, Meilensteine,
die wir erreichen wollen. Das Ziel ist super, wir brauchen aber auch die Umsetzung dahinter. Das heißt, wir müssen schauen,
wie wir Kapa reingeben für welche Sachen. Dann können wir nachher den Fokus und die Umsetzung zu den Zielen und Meilensteinen
messen. Und manchmal sind die Ziele nicht zu erreichen, weil man sonst z. B. 30 Stunden am Tag arbeiten müsste. Macht
keinen Sinn … also das Ganze messbar machen mit den Kapas, die da sind. Realistisch planbar.“ + „Kopf & Energie“.
- **Erledigt (sofort):** „Unternehmer-DNA“ heißt „Personal“ (Kennung `ud` bleibt), Text überall aus `SAEULEN_TEXT`.
- **Gewichte:** „Verhältnis halten“ — Kapazität bekommt 15 %, alle anderen Säulen schrumpfen im gleichen Verhältnis
  (heute FH 45 · Personal 27 · MT 18 · Fokus & Zeit 10 → ×0,85). Fehlt die Messung, zählt die Säule nicht (wie bei FZ).
- **Kapazitätsplanung:** je Person verfügbare Stunden (Woche/Monat, abzüglich Termine, Urlaub, feste Blöcke) — Kapa
  bewusst Zielen/Meilensteinen/Mandaten/Kunden zuweisen (geplante Stunden je Meilenstein) — Ist aus Zeitmessung/Fokuszeit.
  Machbarkeit je Ziel: Bedarf bis Termin ÷ verfügbare Kapa → „machbar / eng / nicht machbar (bräuchte N h/Tag)“.
  Im Planungs-Zeitstrahl sichtbar (Kevin mag, dass Punkte und Meilensteine sauber in den Zeitstrahl laufen — so kann man
  vorplanen): Last-Band je Woche unter dem Strahl, Engpass-Wochen markiert.
- **Kopf & Energie:** Belastbarkeit von Kevin/Malin (Fokuszeit, Meeting-Last, Erholung z. B. Whoop) als Faktor auf die
  verfügbare Kapa — im Business nur als Summe, keine privaten Details (Privatfilter!).
- Kennzahlen-Vorschlag der Säule: Auslastung nächste 4 Wochen, Anteil Ziele „machbar“, Plan-Treue (geplant vs. Ist),
  Puffer, Erholung (nur Summe). Auslastung wandert ggf. aus „Personal“ hierher (doppelt zählen vermeiden).

## 8 · Ergebnis der Gesamtprüfung 04.10. + Entscheidungen
Bericht (nur gelesen) — Kernaussagen:
- Eigene Gesellschaften sind fest auf `'kdc' | 'kdv' | 'ug'` verdrahtet (lib/einheiten.ts, UG_NAME = „MAKE Innovation GmbH“);
  Stammdaten an zwei Stellen (lib/crm/gesellschaften.ts + Firmen-Kartei /os/stammdaten), drei weitere Org-Listen
  (lib/make-one/organisation-data.ts ORGS, lib/planung/einheiten.ts, CRM-Firmen mit mutterId/rolle).
- Es fehlen: Gesellschafter/Anteile/Cap-Table, Stammkapital eingezahlt, Gründungsstatus, Organe/Beschlüsse, Vertragsregister
  mit Fristen, Beteiligungen.
- Produkte: Server kann löschen (PATCH delete leistungen, 409 → „eingestellt“), Oberfläche nicht; Mandate/Angebote ohne
  Löschen/Archiv; Ziele kennen kein Produkt; Mandat.ziele[] ist zweite Zielliste.
- Usability: Wischen nirgends; window.confirm in ~50 Dateien; `Leerzustand` nur 8×, `Leer` 131×; 33 Dateien noch auf
  `schlank` statt `ui`; tote Gruppe app/(dashboard) (Stubs/Mock) noch erreichbar; Stapel-Link „Meilensteine“ zeigt auf die
  Bau-Roadmap; /os/okr doppelt zu Planung; Stammdaten doppelt; /os/finanzplan neben Finanzen.
**Entscheidungen Kevin 04.10.:**
- MAKE Innovation GmbH wird von der **KD Ventures UG** gehalten.
- **KEMARIS wird aufgelöst bzw. daraus wird die MAKE Innovation GmbH** (Umfirmierung — im Register: „hervorgegangen aus
  KEMARIS Innovation GmbH“; Website-Firmierung erst nach Handelsregister-Eintrag umstellen).
- Eigene Gesellschaften als **offene Liste** (Status geplant · in Gründung · eingetragen · ruhend · aufgelöst; die drei
  bestehenden Kennungen bleiben, neue `g-…`).
- Wischen nach links zeigt **Archivieren und Löschen**.
**Arbeitspakete (Reihenfolge):** 1 ZeileAktionen (läuft) · 2 Produkte/Mandate auf Standard · 3 Gesellschafts-Register ·
4 Gründungsfahrplan MAKE (Vorlage Ziel/Meilensteine/Aufgaben) · 5 Überblick „Für dich“ je Bereich · 6 Aufräumen
(app/(dashboard), okr, Stapel-Link, schlank→ui, Leer→Leerzustand, confirm→Baustein) · 7 Kapazität (Abschnitt 7) ·
8 Strahl zurücknehmen (Abschnitt 6) · 9 ZOE-Kugel · 10 Brain-Kugel. Offen: F2 (Rolle KD Ventures), F5 (Tiefe Cap-Table),
F6 (Vertragswerk-Tiefe), F8 (app/(dashboard) löschen?).

## 9 · Alle Listen anpassbar + Demo-Konto (Kevin 04.10.)
„Mach weiter mit allen und den anderen Listen — wir müssen alles anpassbar haben, auch wenn wir mal einen Demo-Account machen.“
- ZeileAktionen (Branch zeile-aktionen, auf entwicklung) auf ALLE Listen mit Einträgen: Mandate, Angebote, Kontakte, Firmen,
  Deals, Events, Kampagnen, Segmente, Beiträge, Ziele/Meilensteine, Brain-Notizen, Bauplan-Karten, Familie, Stammdaten-Kartei,
  Netzwerken, Projekte/Listen/Gruppen im Aufgaben-Baum, Gesellschaften (läuft im Register-Paket). `window.confirm` (~50 Dateien)
  → `useRueckfrage`; eigene Rückgängig-Hinweise (z. B. Kalender-Verschieben) → `useRueckgaengig`. Wächtertest: jede Liste.
- „Alles anpassbar“: jede Liste anlegen/bearbeiten/archivieren/löschen in der Oberfläche; keine fest eingebauten Einträge,
  die man nicht entfernen kann (Vorgaben = Startwerte, überschreibbar) — passt zur Plattform-Regel.
- **Demo-Konto:** eigene Instanz/Datenordner mit erfundenen Beispieldaten (Seed), leer startbar, alles darin bearbeitbar und
  löschbar; nie unsere Daten (Plattform-Regel „Testkunden nie auf unserer Instanz“). Seed-Skript + Zurücksetzen-Knopf für
  Vorführungen als eigenes Paket.
  **Gebaut 05.10. (lokal, Branch `demo-schnappschuss`):** Seed `scripts/demo-saat.mjs`, Knopf „Demo zurücksetzen“ unter System — DEMO.md.

## Offen aus dem Tag (nicht vergessen)
- Bildfolgen-Platz „Beratung“ (makeinnovation.de) und „Abend“ (fokus) für echte Fotos/Film später — Kevin: erst 3D.
- Kevins Satz zur Vertriebserfahrung (Platzhalter), Datenschutz-Bestätigungen.

## 10 · Nachträge nach Kevins Antworten (04.10. abends)
- **Register (Branch gesellschaften-2, läuft):** KD Ventures = reine Holding (Rolle im Register, operative Kennzahlen gelten
  nicht); Cap-Table reicht so; Erinnerung vor „kündigen bis“ (Glocke + Aufgabe); Beschlüsse & Organe als Liste; neue
  Gesellschaften vorerst NICHT im Finanzplan.
- **Finanzplanung (Nachtrag, wartet auf freien Platz):** Umsatz von Hand zieht den Zahlungseingang mit (übliches
  Zahlungsziel); Handwerte zusätzlich je Szenario möglich (Standard: gilt für alle); Vorauszahlungen je Quartal wandern mit
  einem Steuer-Handwert mit.
- **Kapazität (Kevins Antworten):** Schwellen 70 % machbar / 90 % eng (umgesetzt, 4091608); Grundwert-Annahme 40 h bleibt;
  **wöchentlicher Plan-Schnappschuss** (jeden Montag den Wochenplan speichern → echte Plan-Treue „geplant vs. Ist“) → Update 3.

## 11 · Plattform-Schulden (aus der Abschlussprüfung 04.10., größer — später)
- Finanzplanung fest auf zwei Personen (`personName('kevin'/'malin')`, `kevinBrutto`, `ug.kevin`, Handwert `ug.bjoern`) → Modell-Umbau.
- `lib/einheiten.ts` feste Gesellschaftsnamen (`KERN_EINHEITEN`, `UG_NAME`) → aus Instanz-Einrichtung.
- `/os/stammdaten` (Firmen-Karten) neben dem Register → übertragen, dann entfernen.
- Feste Pfade/Namen in Schnellsuche-Liste, Stapel, bereiche.ts, spaces.ts, agents-data.ts, planung/bloecke-server.ts:44,
  Onboarding-Routen kevin/malin, WillkommenMalin.
- ZOE-Werkzeug „Kapazität lesen“ fehlt; Finanzplanung-Tabellen (Bausteine/Schulden/Posten) noch ohne ZeileAktionen;
  FlussKarte-Leerzustände ohne Knopf; Kennzahlen kp_treue/kp_puffer/kp_kopf ohne Detail-Link.

## 12 · DSGVO-Antworten Kevin (04.10. spät)
- Datenschutzhinweis der App: **erst Anwalt** — Entwurf bleibt intern (DATENSCHUTZ_APP.md Abschnitt 4).
- Einwilligung Erholung (Art. 9): Schalter reicht für Kevin & Malin; für Kunden-Instanzen mit Angestellten Gegenlesen vormerken.
- Team-Personen: Kapazitätsdaten **30 Tage nach Deaktivieren automatisch löschen** + Art.-15-Export (noch bauen).
- Unterlagen beim endgültigen Löschen von Gesellschaft/Vertrag: **behalten (§ 257 HGB) + deutlicher Hinweis mit Link** in der Rückfrage (noch bauen).
