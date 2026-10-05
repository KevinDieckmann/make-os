# MAKE OS · AI-CEO-Modul — Bestandsaufnahme, Zielbild und Bauplan

**Stand:** 05.10.2026 · Online-Stand `6b10a5ba` (app.makeinnovation.de)
**Auftrag (Kevin, 05.10.2026):** „Als Nächstes bauen wir ein AI-CEO-Modul. Wir bauen das Produkt und alle Funktionen selbst — mit der Software — und mit einem klaren Plan dahinter. Wir bauen auf der Software auf und bauen die erste Plattform für AI CEOs, die Privat und Business zusammen bekommen wollen.“
**Rahmen (Kevin, 05.10.2026 spät — gilt für alles in dieser Datei):**
1. **Erst für uns** (Kevin & Malin, MAKE Innovation GmbH und KD Ventures als Kunde 0), **dann 3–4 ausgewählte Personen** auf eigenen Instanzen. **Kein Markteintritt jetzt**, keine öffentliche Website für das Modul, kein Vertrieb.
2. **Trotzdem marktreif gebaut:** jede Zeile so, als würden wir morgen verkaufen (eigene Instanz, Trennung serverseitig, nichts fest auf uns verdrahtet, Datenschutz und Recht wie für zahlende Kunden).
3. **Nur Belastbares zählt:** Keine Zahl und keine Aussage geht in eine Entscheidung, die nicht mit Primärquelle und Fundstelle geprüft ist (`research/ai-ceo/VERIFIZIERT.md`). Ungeprüftes steht als „Annahme“ da.

**Begleitdatei:** `AI_CEO_RECHERCHE_PROMPTS.md` — 18 Recherche-Aufträge (P1–P10, P12–P19) für parallele Gemini-Deep-Research-Läufe + Synthese-Prompt P11.

> Diese Datei ist Planung. Was gebaut ist, steht in Teil B mit Belegstellen im Code. Was geplant ist, steht in Teil C–F und ist ausdrücklich als Plan, Hypothese oder offene Entscheidung markiert. Marktzahlen stehen hier bewusst **nicht** — sie kommen aus der Recherche (Teil H), nicht aus dem Bauch.

---

## Inhalt

- **Teil A — Kurz und klar:** Was ein AI CEO ist, was das Modul tun soll, warum wir es bauen
- **Teil B — Was wir haben:** vollständige Bestandsaufnahme von MAKE OS (Fundament, Kern, Business, Privat, KI-Schicht, Betrieb, Datenschutz, Plattform-Stand, ehrliche Lücken)
- **Teil C — Wo es hingehen soll:** Zielbild der Plattform für AI CEOs, Positionierung, Prinzipien
- **Teil D — Das AI-CEO-Modul im Detail:** Bausteine, Abläufe, Daten, Rechte, Oberfläche
- **Teil E — Wie wir es bauen:** mit der eigenen Software (Dogfooding), Arbeitsweise, Qualität
- **Teil F — Der Plan:** Phasen, Pakete, Reihenfolge, Abnahmekriterien, Zeitrahmen
- **Teil G — Geschäftsmodell und Weg in den Markt** (Hypothesen, von der Recherche zu prüfen)
- **Teil H — Recherche:** was wir wissen müssen und wie wir die Ergebnisse einarbeiten
- **Teil I — Risiken, offene Entscheidungen, Kennzahlen des Vorhabens**
- **Teil J — Begriffe**
- **Teil K — Erkenntnisse aus der Recherche (Stand 05.10.2026, 10 von 19 Berichten)**

---

# Teil A — Kurz und klar

## A1 · Was ist ein AI CEO?

Ein **AI CEO** ist ein Mensch, der ein Unternehmen **ohne oder fast ohne Mitarbeiter** führt. Die Arbeit, für die früher ein Team nötig war — Vertrieb vorbereiten, Marketing, Buchhaltung, Recherche, Organisation, Nachfassen, Berichte —, erledigen KI-Agenten. Menschen sind dort, wo sie unersetzlich sind: Beziehungen, Urteil, Verantwortung, Unterschrift. Der AI CEO ist nicht „ein CEO, der KI benutzt“, sondern **der einzige Mensch an der Spitze eines Teams aus Agenten** (Kevin, 01.10.: „Business ohne Mitarbeiter — Menschen nur als Schnittstelle“).

Der Punkt, den fast alle Werkzeuge übersehen: **Ein AI CEO ist ein ganzer Mensch.** Die knappste Ressource ist nicht Rechenleistung, sondern seine Aufmerksamkeit, seine Energie und seine Zeit — und die verteilen sich auf Business **und** Privatleben. Wer nur das Business optimiert, verbrennt den Menschen. Wer nur das Privatleben ordnet, verliert das Geschäft. Genau dazwischen liegt MAKE OS.

## A2 · Was soll das AI-CEO-Modul tun?

Das Modul macht aus den vielen Bereichen von MAKE OS **eine Führungsebene**:

1. **Ein Blick auf alles, was zählt** — Business und Privat, Lage und Richtung, auf einer Seite (CEO-Cockpit).
2. **Ein KI-Führungsteam**, das wie Abteilungsleiter arbeitet: Jeder Head (Sales, Marketing, Finance, Operations, Product, People, IT, Strategie) hat einen klaren Auftrag, Kennzahlen, Grenzen, einen Rhythmus und berichtet an den Menschen — mit Vorschlägen, nicht mit Eigenmächtigkeiten.
3. **Ein fester Führungsrhythmus** — Tag, Woche, Monat, Quartal, Jahr —, der automatisch vorbereitet wird und in Entscheidungen endet.
4. **Ein Entscheidungssystem** — jede Entscheidung mit Vorlage, Begründung, Wirkung und Lernen; nichts verschwindet.
5. **Delegation, die wirklich trägt** — was ein Agent darf, was nur vorbereitet wird, was immer der Mensch macht; nachvollziehbar und zurücknehmbar.
6. **Balance als Steuergröße** — Kapazität, Energie, Familie und Gesundheit sind Kennzahlen des Unternehmens, nicht Privatsache am Rand.

## A3 · Warum wir das bauen — und warum wir es können

- **Wir haben das Fundament schon.** MAKE OS ist online und läuft täglich für Kevin und Malin: Fokus & Zeit, Markttraktion, Finanzen, Gesundheit, Familie, Brain, ZOE und ein Agenten-Organigramm mit sieben Abteilungen. Das AI-CEO-Modul ist **kein Neubau**, sondern die Führungsebene über dem, was es gibt.
- **Wir sind selbst die erste Zielgruppe.** Kevin führt mit KD Ventures und der MAKE Innovation GmbH genau das Leben, für das die Plattform gedacht ist. Jede Funktion wird zuerst an uns selbst geprüft.
- **Unser Unterschied ist hart, nicht kosmetisch.** Privat und Business in einer Software, aber mit **serverseitiger Trennung** (Business sieht nie Privat, Privat sieht Business), eigene Instanz je Kunde, verschlüsselte Daten, DSGVO- und KI-VO-Werkzeuge eingebaut, Mensch entscheidet. Das ist für Menschen in Europa, die ihr Leben und ihr Unternehmen einer Software anvertrauen, entscheidend.
- **Wir bauen mit der Software, die wir verkaufen.** Bauplan, Ziele, Meilensteine, Kapazität, ZOE und die Heads steuern den Bau des Moduls selbst (Teil E). Das ist zugleich der beste Beweis für Kunden.

---

# Teil B — Was wir haben (Bestandsaufnahme, Stand 05.10.2026)

## B1 · Zahlen auf einen Blick

| Größe | Stand | Quelle |
|---|---|---|
| Online-Stand | `6b10a5ba`, ausgerollt 05.10.2026 ~20:26 | Server, Ausroll-Protokoll |
| Seiten der App | 72 (`app/**/page.tsx`) | Code |
| Schnittstellen | rund 250 (`app/api/**/route.ts`), jede im Routen-Register mit Zugangsklasse | `lib/zugang/routen-register.ts` |
| Code | rund 198.000 Zeilen TypeScript (lib, components, app) | Code |
| Tests | 430 Testdateien, 5.429 Tests, volle Suite grün vor dem Upload | `tests/` |
| Agenten-Organigramm | 7 Abteilungen, rund 30 Agenten (davon einige „geplant“) | `lib/make-one/agents-data.ts` |
| ZOE-Werkzeuge | 36 benannte Werkzeuge (Lagen, Akten, Suche, Vorschläge, Tageslauf …) | `lib/zoe/*` |
| KI-Modelle | drei Stufen: schnell (Claude Haiku 4.5), ausgewogen (Claude Sonnet 5), stark (Claude Opus 5.5) | `lib/agent-config.ts` |
| Betrieb | eigener Server (Hetzner), Docker, Caddy, nächtliche Sicherung, Head of IT, Ausrollen per GitHub | `deploy/`, `compose.yml` |
| Nutzer heute | eine Instanz, ein Haushalt (Kevin & Malin) | — |

## B2 · Das Fundament

### B2.1 Datenschicht
- **Bestände als verschlüsselte Dateien** je Instanz (AES-256-GCM, „Hülle“ v1, Format v2 mit Schlüssel-ID und Bestandsbindung vorbereitet), atomares Schreiben, Schreibkette, Stand/Versionsschutz gegen gleichzeitiges Überschreiben (409), tägliche Sicherung beim Schreiben, Grabsteine für Gelöschtes (13 Monate), Papierkörbe (30 Tage).
- **Speicher-Register** mit Wächtertest: Jeder Bestand ist eingeordnet (Personenbezug, Frist, Rechtsgrundlage, Behandlung bei Auskunft/Löschung). Kein neuer Bestand ohne Eintrag.
- **Kompatibilitätsmodus:** neue Felder nur optional — der vorige Stand kann neue Daten immer lesen (Rückweg).
- **Bilder** verschlüsselt (`lib/store/bild-ablage.ts`), **Such-Index des Brains** nur im Arbeitsspeicher (tmpfs), nach jedem Start neu gebaut — nie im Klartext auf der Platte.

### B2.2 Zugang und Sicherheit
- Anmeldung mit Passwort (scrypt, stärkere Stufe vorbereitet), zweiter Faktor (Pflicht je Instanz schaltbar), Leerlauf-Ende, Anmeldeprotokoll (12 Monate, verkettet).
- **Routen-Register + Zugangs-Wächter:** Jede Schnittstelle hat eine Klasse (`offen`, `dienst`, `person`, `haushalt`, `inhaber`, `finanz-privat`, `finanz-business`, `modul:markttraktion`) und ruft nachweislich das passende Tor; ein Test schlägt fehl, wenn eine neue Route ohne Eintrag kommt.
- Dienstschlüssel nur von innen, eigener Zulieferer-Schlüssel für den Mac, Start-Riegel (startet nicht ohne Pflicht-Geheimnisse), Einmal-Code für das erste Konto, JSON-Größengrenze an allen Routen, Caddy-Schutzköpfe.
- **Protokolle fälschungssicher:** Änderungs-, Lese- und Anmeldeprotokoll in einer Hash-Kette mit Siegel; nächtliche Prüfung, Bruch = Alarm beim Head of IT.

### B2.3 Datenschutz eingebaut (DSGVO + KI-VO)
- **Eine Seite System › Datenschutz:** Verantwortlicher (aus der Einrichtung der Instanz), Selbstprüfung aus echten Beständen, Empfänger-/AVV-Register, Verzeichnis nach Art. 30 mit Export, Pannen-Register (Art. 33), Nachweise (Lese-Protokoll, Kette, Verschlüsselung).
- **Gesundheit (Art. 9):** drei getrennte, nachweisbare Einwilligungen je Person — verarbeiten, an die KI geben, mit dem Partner teilen.
- **KI-Schalter** je Instanz und Person (Hintergrund-KI, Web-Suche, Bereiche), **KI-Protokoll** (nur Metadaten, 12 Monate), **Pseudonymisierung** in automatischen Läufen, **KI-Kennzeichnung** (KI-VO Art. 50).
- **Betroffenenrechte:** vollständige Auskunft (Art. 15) als Datei, Konto-Export und Konto-Löschung, Instanz-Export und dokumentierte Instanz-Löschung, Art.-14-Information als Entwurf, Abmeldelink mit Rückkanal in die Werbesperre.
- Telegram nur noch mit neutralen Hinweisen; Inhalte bleiben in der App.

### B2.4 Betrieb
- Eigener Server, Docker Compose (App, Arbeiter, Caddy), Speicher- und Prozessgrenzen, nächtliche Sicherung (Übergang openssl, Ziel age), Rückweg-Bilder je Version, Ausrollen per GitHub-Aktion nach Prüfung.
- **Head of IT (HOI):** überwacht innen (Prozess, Bestände, Kette, Index, Riegel), auf dem Server und von außen (GitHub-Außenblick) — als Ampeln.
- **Demo-Instanz** vorbereitet: Saat mit erfundener Persona (`scripts/demo-saat.mjs`, `DEMO.md`), Zurücksetzen per Knopf nur im Demo-Modus.

## B3 · Der Kern: Fokus & Zeit

Kevin (01.10.): „Fokus & Zeit ist der Kern — alle anderen Module sind gleich wichtig.“

| Baustein | Was er heute kann |
|---|---|
| **Heute / Tageslauf** | Morgen- und Abendlauf (ZOE), was heute ansteht, Termine, Fokus, offene Freigaben |
| **Kalender** | Woche/Monat, Microsoft 365, Google, Apple (über den Mac-Zulieferer), Fokus-Blöcke, Aufgaben im Kalender, Fristen |
| **Planen** | Woche bauen (Wochenplan-Agent), Routinen und Routinen-Blöcke, Jahres- und Zeitstrahl-Planung bis Ende nächsten Jahres |
| **Ziele → Meilensteine → Aufgaben** | Ziel-Kette, Fortschritt rechnet sich aus echten Aufgaben, Unteraufgaben, Erwähnungen, Dateien, Notizen |
| **Kapazität** | Machbarkeit je Meilenstein aus Personen und Stunden (machbar ≤ 70 %, eng ≤ 90 %, darüber nicht machbar), Plan-Treue, wöchentlicher Stand, „Kopf & Energie“ |
| **Lichtfäden** | Fokus-Werkzeug über alles: Strahl links → rechts, Fäden nach Zielen, Abweichungen gebündelt sichtbar, nur auffällig wenn Unvorhergesehenes kommt |
| **Fluss „Für dich“** | je Bereich: wie es die letzten 3 Monate lief, wie es jetzt ist, Prognose |
| **Aufgaben** | Liste, Board, Tabelle, Kalender, ZOE-Ansicht; Spaces je Bereich/Firma; Papierkorb; Löschen/Archivieren per Wischen |

## B4 · Business

### B4.1 Markttraktion (einzeln verkaufbar)
- **CRM/Kartei:** Kontakte, Firmen, Akten, Datenqualität, Stammdaten, Herkunft und Rechtsgrundlage je Kontakt, Werbesperre (Art. 21), Löschfristen.
- **Sales:** Pipeline, Deals, Mandate, Angebote, Power Hour, Wiedervorlagen, Qualifizierung und Lead-Score (kalt → Segment), Traktions-Index.
- **Marketing:** Kampagnen, Einwilligungen (Double-Opt-in), Newsletter mit Abmeldelink, Content-Agent.
- **Events / Make.One / Fokus Innovation:** Veranstaltungen mit Ziel, Gästemischung, Nachfassen in 48 Stunden, Buchungsseiten.
- **Netzwerken:** Visitenkarten, vCard ins Handy, Veranstaltungs-Kontakte mit eigener Rechtsgrundlage.
- **Prospecting / Research:** signalbasierte Zielliste, belegte Recherche.
- **Heads:** Head of Sales, Head of Marketing, Head of Event mit Grundlauf ohne KI, Prüfer, Evals, Lernen aus Entscheidungen.

### B4.2 Finanzen
- **Finanzplanung** (Privat und Business als Sichten eines Plans): Treiber, Szenarien, Planszenarien, Handwerte je Szenario für jede Zahl, Steuern (ESt gemeinsam für Privat + Selbstständigkeit, Gewerbesteuer, KSt/Soli, USt-Durchlauf, Vorauszahlungen), Darlehen mit Geber/Nehmer, Töpfe und Ziele, Prüfstand mit unabhängiger Handrechnung und unabhängiger Gegenprüfung.
- **Liquidität, Rechnungen & Zahlungen, Buchungen, Belege, Controlling, Steuern-Bereich, Head of Finance** (Lage, Fristen, Vorschläge).
- **Business-Zahlen stehen seit 05.10. auf 0** (0-Punkt, Kevin trägt neu ein).

### B4.3 Gesellschafts-Register und Business-Index
- **Register** (`/os/unternehmen`): Gesellschaften, Rollen (Holding), Cap-Table, Organe, Beschlüsse, Vertrags-Erinnerungen, Fahrplan.
- **Bereich je Einheit:** Kapitalgesellschaften gehören zu Business, Einzelunternehmen (die Selbstständigkeit) zu Privat — eine Zuordnung, aus der Finanzplan, Cockpit, Spaces, Aufgaben, Liquidität, Steuern und Lichtfäden lesen. Arbeit (Zeit/Kapazität) ist davon getrennt („zählt als Arbeit“).
- **Business-Index** mit Säulen: Finanzielle Gesundheit, Personal, Markttraktion, Fokus & Zeit, Kapazität (15 %); Index-Verlauf; Monatsabschluss.
- **Wachstums-Score** (oben in der Leiste, z. B. „83 · Souverän“).

## B5 · Privat

- **Privat-Index** und **Haushaltsfinanzen** (Budget, Fixkosten, Ist/Soll, Netto-Tabelle, Runway Privat inklusive des freien Geldes der Selbstständigkeit).
- **Gesundheit & Performance:** Whoop (Erholung, HRV, Schlaf), Haut, Streak, Routinen, Journal, Sport, Ernährung (Essensplan, Einkaufsliste), Health-Agent mit Tagestakt — alles nur mit Einwilligung.
- **Familie & Partnerschaft:** gemeinsame und „nur ich“-Bereiche, Teilen je Person.
- **Kontakte**, **Kompass**, **Rituale**.

## B6 · Die KI-Schicht — das ist schon eine kleine Führungsebene

### B6.1 ZOE — Chief of Staff
- Gespräch per Text und Sprache, Kugel als Erscheinung (eigene WebGL-Darstellung), Symbol unten in jeder Seite.
- **36 Werkzeuge:** Lagen (Sales, Marketing, Events, Mandate, Angebote, Kampagnen, Qualifizierung, Heads, HOI), Akten (Kontakt, Firma), Suche (Arbeit, Wissen), Tageslauf, Tagesstart, Morgen/Abend, Kennzahlen, Pipeline, Datenqualität, Löschfristen, Konsolidierung, Verbesserung, Selbstbild …
- **Gedächtnis** (sofort merken, sichtbar in einer Liste), **Entscheidungen dauerhaft** (`zoe-entscheidungen--<haushalt>--<Monat>`), **Protokoll**, **Selbstbild** (die Software weiß aus echten Quellen, was sie kann).
- **Regelwerk-Rückfall:** Ohne KI (kein Schlüssel, Guthaben leer) liefern Läufe einen ehrlichen Lagesatz aus Zahlen statt auszufallen.

### B6.2 Freigabe-Stapel — „Mensch entscheidet“
- Alles, was laut Register eine Freigabe braucht, wird nicht ausgeführt, sondern **mit Vorher und Nachher** in den Stapel gelegt, gebündelt morgens und abends. Einmal freigegeben, darf ZOE den Auftrag durcharbeiten.

### B6.3 Heads — Abteilungsleiter aus Agenten
- **Lauf eines Heads** (`lib/heads/lauf.ts`): Daten laden → ruhige Läufe ohne Modell → Grundlauf aus Regeln → mit Modell (gecachter Systemteil, Daten vor Aufgabe, JSON-Schema) → Prüfer → Stapel.
- **Autonomie** (`lib/heads/autonomie.ts`): interne Kleinigkeiten selbst (mit Protokoll und Rücknahme), alles mit Außenwirkung nur zur Freigabe.
- **Prüfer** (`lib/heads/pruefer.ts`): Form, Kennungen müssen existieren (keine erfundenen Personen), erlaubte Kanäle (§ 7 UWG), Werbesperre.
- **Evals** (`lib/heads/eval.ts`): deterministische Prüfungen, „pass^k“ — erst messen, dann Prompt oder Modell ändern.
- **Lernen** (`lib/heads/lernen.ts`): Annahme-/Ablehnungsquote je Art, häufigste Ablehnungsgründe, **Wirkung** (kam nach dem Annehmen echte Aktivität?).

### B6.4 Agenten-Organigramm (heute)
| Abteilung | Lead | Agenten (Auswahl) |
|---|---|---|
| Operations | Ops Lead | Inbox, Task, Kalender, Meeting, Wochenplan, Wissen |
| Sales / Revenue | Revenue Lead | Prospecting, CRM/Pipeline, **Head of Sales**, Outreach |
| Marketing | Marketing Lead | **Head of Marketing**, **Head of Event**, Content; geplant: Kampagnen/Funnel, SEO/Analytics |
| Finance | Finance Lead | **Head of Finance**, Controlling, Board/Berichte |
| Strategie / Ventures | Strategy Lead | Research, Kontext/Gedächtnis, Score, OKR/Ziel |
| Product | Product Lead | **Head of IT**; geplant: Roadmap/Spec, Research/Feedback, Eng/QA |
| People / Founder-Care | People Lead | Fokus/Entscheidung, Health, Ernährung; geplant: Team/HR |

Jeder Agent hat Autonomie (`entwurf`, `freigabe`, `vorschlag`, `autonom`), Modellstufe, Aktiv-Schalter, Tore („Versand ✋“, „Publizieren ✋“, „Einladungen ✋“). Die Verwaltung unter `/os/agenten` wirkt wirklich (`lib/agent-config.ts`).

### B6.5 Takt, Arbeiter, Loops
- **Takt** (`lib/zoe/takt.ts`): Der Server entscheidet, was fällig ist; der Arbeiter holt jede Minute ab — unabhängig vom offenen Browser.
- **Loops** (`/os/loop`): Morgen, Woche, Rückblick — ziehen Daten mehrerer Bereiche zusammen, leiten **eine** Handlung ab und schreiben ins Agenten-Gedächtnis.

### B6.6 Brain
- Obsidian-Vault als Wahrheit, Suche über FTS5 + lokale Embeddings, Index nur im Arbeitsspeicher, nächtliche Konsolidierung, Brain-Kugel aller Daten (Galaxie mit Gruppen).

## B7 · Kanäle und Verbindungen
Microsoft 365 (Postfach, Kalender), Google (Kalender, Gmail; je Person per OAuth), Apple (Kalender, Erinnerungen, Kontakte über den Mac-Zulieferer), Whoop, Telegram (neutral), Miro. Versand: jede Mail erst Entwurf, dann Einzelklick (M365 für 1:1, Versanddienst für Masse).

## B8 · Plattform-Stand — wie nah sind wir an „verkaufbar“?

| Thema | Stand | Lücke |
|---|---|---|
| Eigene Instanz je Kunde | Architektur passt (Bestände, Schlüssel, Sicherung je Instanz) | **Instanz-Fabrik** fehlt (neue Instanz per Knopf/Skript, Updates an alle, KI-Kosten je Kunde) |
| Einrichtung beim ersten Start | Einmal-Code für erstes Konto, Verantwortlicher in der Einrichtung | Geführte Einrichtung (Personen, Firmen, Ziele, Kalender, KI-Schlüssel) fehlt |
| Personen-Modell | Konten mit Speicher-Kennung, Rollen, Haushalt, Finanzrecht | Altstellen mit fester Annahme `kevin`/`malin` (z. B. Antwortformen, einzelne Rückfälle) |
| Firmen/Einheiten | Zuordnung Bereich + Arbeit je Einheit | Kommt noch aus Build-Variable statt aus Register/Inhaber-Einstellung (Plattform-Schuld, ~1 Tag) |
| Modul-Schalter | Agenten je Agent abschaltbar | Bereiche je Instanz an/aus, Edition „nur Markttraktion“ fehlt |
| Lizenzen | Konzept (signiert Ed25519, offline geprüft, Schonfrist, nie Daten sperren) | nicht gebaut |
| Demo | Saat + Zurücksetzen gebaut | Container/Adresse, nächtliches Zurücksetzen |
| Rechtliches | DSGVO-Werkzeuge eingebaut | AVV-Vorlage, Datenschutzhinweis, KI-VO-Einordnung anwaltlich prüfen |

## B9 · Ehrliche Lücken (für das AI-CEO-Modul relevant)
1. **Es gibt keine Seite, die „Führung“ ist.** Die Teile (Tageslauf, Heads, Stapel, Index, Kapazität, Lichtfäden) liegen nebeneinander; niemand fügt sie zu Lage → Entscheidung → Wirkung zusammen.
2. **Heads gibt es nur für Sales, Marketing, Event, Finance, IT.** Operations, Product, People, Strategie haben Agenten, aber keinen Head mit Auftrag, Kennzahlen, Rhythmus und Bericht.
3. **Ziele und Nordstern sind teils noch persönlich verdrahtet** (z. B. „1-Mio-Nordstern“ im Organigramm-Text) statt je Instanz einstellbar.
4. **Kein KI-Budget je Abteilung** — Kosten sind sichtbar (Verbrauch), aber nicht als Budget mit Grenze je Head.
5. **Delegation an Menschen außerhalb** (Freelancer, Steuerberater, Assistenz) hat keinen eigenen Weg — der AI CEO braucht „Menschen als Schnittstelle“ genauso sauber wie Agenten.
6. **Privat-Business-Balance** ist messbar (Kapazität, Whoop, Familie), aber nicht als Führungsgröße mit Grenzen und Frühwarnung zusammengeführt.
7. **Wiederverwendbarkeit:** Vieles ist auf unseren Haushalt zugeschnitten; das Modul muss vom ersten Tag an je Instanz konfigurierbar sein.

---

# Teil C — Wo es hingehen soll

## C1 · Das Zielbild in einem Satz
**MAKE OS wird die erste Plattform, auf der ein Mensch sein Unternehmen und sein Leben mit einem KI-Führungsteam steuert — getrennt, wo es getrennt sein muss, verbunden, wo es zusammengehört, und immer mit dem Menschen am Steuer.**

## C2 · Für wen (Arbeitshypothese, von der Recherche zu schärfen)
- **Kern:** Gründerinnen und Gründer, die bewusst klein bleiben und mit KI skalieren (Solo- und Kleinst-Unternehmen, 0–5 Menschen), im DACH-Raum, mit eigenem Privatleben, das zählt (Familie, Gesundheit).
- **Typische Geschäftsmodelle:** Beratung/Expertise, Produkt-/Software-Kleinunternehmen, Agenturen ohne Angestellte, Coaches/Trainer, Holding-/Beteiligungs-Unternehmer (wie KD Ventures), Event-/Community-Unternehmer.
- **Gemeinsam:** viele Rollen in einer Person, hohe Eigenverantwortung, wenig Zeit, Bedarf an Ordnung **und** an Ruhe; Vertrauen in Datenhaltung ist Kaufgrund.
- **Nicht (zunächst):** Konzerne, klassische Teams mit Projektmanagement-Bedarf, reine Privat-Nutzer ohne Unternehmen.

## C3 · Positionierung (Hypothese)
| Kategorie | Typische Anbieter (zu prüfen) | Was fehlt dort aus unserer Sicht |
|---|---|---|
| Aufgaben/Projekt-Werkzeuge mit KI | Notion, ClickUp, Asana, Monday | Kein Privatleben, keine Führungsebene, keine Finanzen/Steuern mit Privat zusammen |
| KI-Kalender/Zeitplaner | Motion, Reclaim, Sunsama, Akiflow | Nur Zeit, keine Geschäftslage, keine Agenten-Abteilungen |
| Agenten-Plattformen | Lindy, Relevance AI, Gumloop, n8n, Zapier Agents, Microsoft Copilot Studio | Werkzeugkasten, kein fertiges Betriebssystem; Mensch baut alles selbst |
| CRM / Vertrieb | HubSpot, Pipedrive, Close, Attio | Nur Vertrieb |
| Finanz-/Buchhaltung | Lexoffice, sevDesk, Qonto, Pliant | Keine Planung mit Privat, keine Führung |
| „Life OS“ / persönliche Systeme | Notion-Vorlagen, Obsidian-Systeme, Rize, Whoop/Oura-Apps | Kein Business, kein Team aus Agenten |
| Founder-/CEO-Werkzeuge | Board-/Investor-Reporting, OKR-Werkzeuge | Kein Alltag, kein Privat |
| **„AI CEO“-/Company-OS-Startups** (neu, P3) | Tycoon („Astra“ als KI-CEO für Ein-Personen-Firmen), Voyd (KI-Rollen CEO bis CFO), Sintra (KI-Team, 39–97 $, > 40.000 Zahlende) | Dort ist die **KI** der CEO — bei uns bleibt der **Mensch** CEO; kein Privatleben, keine eigene EU-Instanz, Freigabe nicht Pflicht |

**Stand nach Recherche (Teil K):** Ein „fertiges KI-Team“ allein ist kein Alleinstellungsmerkmal mehr (Tycoon, Voyd, Sintra). Tragfähig ist nur die **Kombination** der vier Punkte unten.

**Unsere Behauptung (zu belegen):** Es gibt keine Plattform, die (1) Privat und Business in **einem** System mit **serverseitiger** Trennung führt, (2) ein **fertiges** KI-Führungsteam mit Grenzen, Evals und Lernen mitbringt, (3) als **eigene Instanz** mit europäischem Datenschutz betrieben wird und (4) Fokus & Zeit zum Kern macht.

## C4 · Prinzipien (verbindlich für jedes Paket)
1. **Mensch entscheidet.** Agenten bereiten vor, der Mensch gibt frei. Außenwirkung (Mail, Zahlung, Veröffentlichung, Einladung) nie ohne Freigabe; Autonomie nur für Internes, Zurücknehmbares mit Protokoll.
2. **Eine Quelle.** Jede Zahl hat genau einen Ort; Ansichten rechnen, sie speichern nicht doppelt.
3. **Alles verbunden, kein Datenpunkt ins Leere.** Jede neue Funktion hängt an Zielen, Kapazität, Lichtfäden, Fluss, ZOE und Brain.
4. **Trennung serverseitig, nie nur versteckt.** Business sieht nie Privat; Privat sieht Business; Rollen und Instanzen getrennt.
5. **80 % Seriosität, höchstens 20 % Effekt.** Klare Linien, kein Gewusel; Effekte nur dort, wo sie Bedeutung tragen.
6. **Ehrliche Zahlen.** Keine erfundenen Werte; ohne Daten steht „keine Daten“.
7. **Verkaufbar von Tag 1.** Nichts fest auf Kevin und Malin; alles je Instanz einstellbar.
8. **Messen vor Ändern.** Evals für jeden Head, Wirkung statt Klicks.
9. **Datenschutz im Bauplan, nicht danach.** Speicher-Register, Routen-Register, Lese-Protokoll, KI-Schalter für jede neue Funktion.
10. **Kompatibel ausrollen.** Rückweg immer möglich; neue Felder optional.

---

# Teil D — Das AI-CEO-Modul im Detail

## D1 · Überblick der Bausteine

| # | Baustein | Kurz | Baut auf |
|---|---|---|---|
| D2 | **CEO-Cockpit** | eine Seite: Richtung, Lage, Entscheidungen, Balance | Business-Index, Privat-Index, Wachstums-Score, Kapazität, Lichtfäden, Fluss, Stapel |
| D3 | **KI-Führungsteam** | Heads für alle Abteilungen nach einem Rahmen | Heads-Rahmen, Organigramm, Agent-Config |
| D4 | **Führungsrhythmus** | Tag, Woche, Monat, Quartal, Jahr | Takt, Loops, Tageslauf, Monatsabschluss, Planung |
| D5 | **Entscheidungssystem** | Vorlage → Entscheidung → Wirkung → Lernen | Stapel, Entscheidungen-Log, Lernen der Heads |
| D6 | **Delegation** | Agent, Mensch intern, Mensch extern — mit Grenzen | Autonomie, Tore, Aufgaben, Kontakte |
| D7 | **Balance-Steuerung** | Energie, Kapazität, Familie als Führungsgrößen | Kapazität, Gesundheit (mit Einwilligung), Familie |
| D8 | **CEO-Index** | ein Maß für „führe ich gut — Firma und Leben?“ | Business-Index, Privat-Index, Wachstums-Score |
| D9 | **Nordstern & Strategie** | Ziele je Instanz, Strategie-Seite, Wetten | Ziele, OKR-Agent, Research |
| D10 | **Playbooks** | Startpakete je Geschäftsmodell | Einrichtung, Heads, Vorlagen |
| D11 | **KI-Budget & Kosten** | Budget je Head, Kosten je Ergebnis | Verbrauch, KI-Protokoll |
| D12 | **Vertrauen & Nachweis** | was die KI tat, warum, mit welchen Daten | KI-Protokoll, Entscheidungen, Kette |

## D2 · CEO-Cockpit

**Zweck:** Der AI CEO öffnet morgens **eine** Seite und weiß in zwei Minuten: Wo stehe ich, was muss ich heute entscheiden, wie geht es mir und meinem Unternehmen, was läuft ohne mich.

**Aufbau (von oben nach unten):**
1. **Richtung** — Nordstern der Instanz (z. B. Umsatz-, Wirkungs- oder Lebensziel), Quartalsziele mit Fortschritt (aus Ziel-Kette), ein Satz Lage von ZOE.
2. **Heute entscheiden** — die drei bis fünf wichtigsten Freigaben aus dem Stapel, gebündelt nach Abteilung, je mit Vorher/Nachher und „was passiert, wenn ich nichts tue“.
3. **Abteilungen** — eine Zeile je Head: Ampel, wichtigste Kennzahl, was er seit gestern getan hat (intern), was er vorschlägt (zur Freigabe), Budgetverbrauch.
4. **Balance** — Kapazität dieser Woche (machbar/eng/nicht machbar), Energie (nur mit Einwilligung), Familie/Privat-Termine geschützt ja/nein, Runway Privat und Business getrennt.
5. **Lichtfäden** — der Strahl der nächsten Wochen mit Abweichungen (gebündelt, ruhig).
6. **Was ohne mich lief** — Protokoll der autonomen, zurücknehmbaren Schritte (mit „zurücknehmen“).

**Sichten:** Im Business-Bereich ohne jede private Zahl (serverseitig gefiltert). Im Privat-Bereich alles. Für Konten mit Business-Recht nur Business.

**Daten:** Keine neuen Bestände für Zahlen — das Cockpit rechnet aus vorhandenen Quellen. Neu nur: `ceo-einstellungen` (Nordstern, Gewichte, Reihenfolge der Abteilungen) je Instanz.

## D3 · Das KI-Führungsteam

### D3.1 Der Head-Rahmen (verallgemeinert)
Heute hat jeder Head eigene Logik. Für das Modul wird daraus **ein Rahmen**, in den jede Abteilung passt:

| Teil | Inhalt | Heute vorhanden in |
|---|---|---|
| **Auftrag** | ein Satz, wofür der Head da ist, und was er nie tut | Organigramm-Texte |
| **Kennzahlen** | 3–5 Messgrößen mit Quelle (aus Kennzahlen-Register) | Business-Index, Traktions-Index |
| **Datenpaket** | was der Head sehen darf (Bereiche, Sicht, Pseudonymisierung) | `lib/heads/paket.ts`, KI-Schalter |
| **Grundlauf** | Regeln ohne KI (liefert immer) | `lib/heads/grundlauf.ts` |
| **Modell-Lauf** | Prompt mit Schema, Stufe, Budget | `lib/heads/lauf.ts`, `prompt.ts` |
| **Prüfer** | Form, Kennungen, Kanäle, Sperren | `lib/heads/pruefer.ts` |
| **Autonomie** | was er selbst darf (intern, zurücknehmbar), was zur Freigabe geht | `lib/heads/autonomie.ts` |
| **Rhythmus** | wann er läuft (Takt) | `lib/heads/takt.ts` |
| **Bericht** | was er an Cockpit, Woche, Monat liefert | Lagen-Werkzeuge |
| **Evals** | feste Prüfungen, pass^k | `lib/heads/eval.ts` |
| **Lernen** | Annahme, Ablehnungsgründe, Wirkung | `lib/heads/lernen.ts` |
| **Budget** | KI-Kosten je Monat, Grenze, Rückfall auf Regelwerk | neu (D11) |
| **Übergaben** | an andere Heads (z. B. Sales → Finance: Angebot angenommen) | Ansätze in `paket.ts` |

**Bauplan:** eine **Head-Fabrik** (`lib/heads/rahmen.ts` o. ä.), die aus einer Beschreibung einen lauffähigen Head macht; bestehende Heads ziehen auf den Rahmen um, ohne Verhalten zu ändern (Regressionstests).

### D3.2 Die Abteilungen des AI CEO

| Head | Auftrag (Entwurf) | Kennzahlen (Entwurf) | Darf selbst | Nur mit Freigabe |
|---|---|---|---|---|
| **Head of Sales** (gibt es) | Umsatz aus Beziehungen, Pipeline gesund | Pipeline-Wert, Abschlussquote, Zeit bis Antwort | Nächsten Schritt setzen, Aufgaben anlegen | Jede Nachricht nach außen, Angebot |
| **Head of Marketing** (gibt es) | ansprechbar sein, Einwilligungen pflegen | Einwilligungen, Anfragen, Themen | Listen pflegen | Versand, Veröffentlichung |
| **Head of Event** (gibt es) | Veranstaltungen mit Wirkung | Gäste, Nachfassen in 48 h, Folgegespräche | Gästelisten pflegen | Einladungen |
| **Head of Finance** (gibt es) | Liquidität, Steuern, Fristen | Runway Business, Fristen, offene Posten | Fristen anlegen | Zahlungen, Steuer-Entscheidungen |
| **Head of IT** (gibt es) | System sicher und gesund | Ampeln, Sicherung, Kette | Prüfungen, Hinweise | Eingriffe am Server |
| **Head of Operations** (neu) | dass alles läuft: Inbox, Aufgaben, Termine, Abläufe | Inbox-Null-Tage, überfällige Aufgaben, Durchlaufzeit | Aufgaben sortieren, Erinnerungen | Termine mit Externen |
| **Head of Product** (neu) | das Produkt bauen und schärfen (bei uns: MAKE OS selbst) | Bauplan-Durchsatz, Fehlerquote, Nutzerfeedback | Karten anlegen/sortieren | Prioritäten, Veröffentlichung |
| **Head of People / Founder-Care** (neu) | der Mensch bleibt leistungsfähig | Kapazität, Energie (Einwilligung), geschützte Zeit | Fokuszeit vorschlagen | alles Private bleibt Vorschlag |
| **Head of Strategy** (neu) | Richtung, Markt, Wetten | Fortschritt der Wetten, Marktsignale | Recherche anstoßen | Strategieänderungen |
| **Head of Ventures/Holding** (optional) | Beteiligungen, Gesellschaften, Organe | Fristen, Beschlüsse, Cap-Table | Erinnerungen | Beschlüsse |

### D3.3 ZOE als CEO-Büro
ZOE bleibt die eine Stimme: Sie spricht mit dem Menschen, fragt die Heads, fasst zusammen, bündelt Freigaben und erklärt. Die Heads sprechen nicht durcheinander mit dem Menschen — sie berichten an ZOE und erscheinen im Cockpit.

## D4 · Führungsrhythmus

| Takt | Wann (Vorgabe, je Instanz änderbar) | Was passiert | Ergebnis |
|---|---|---|---|
| **Tagesstart** | morgens | ZOE + Heads: Lage, Termine, Fokus, 3 Entscheidungen | Cockpit + gebündelter Stapel |
| **Tagesabschluss** | abends | was erledigt, was offen, was morgen | kurzer Rückblick, Stapel geleert |
| **Woche** | Sonntag/Montag | Wochenplan (Wochenplan-Agent), Kapazität, Lichtfäden-Abweichungen, Heads-Wochenbericht | Wochenplan zur Freigabe |
| **Monat** | Monatsanfang | Monatsabschluss je Gesellschaft, Index-Verlauf, Budget KI, Lernen der Heads | Monatsbericht (Board-Pack light) |
| **Quartal** | Quartalsbeginn | Ziele/OKR, Wetten, Strategie-Review | neue Quartalsziele |
| **Jahr** | Jahresende | Jahresplanung, Finanzplan, Lebensziele | Jahresplan |

Technisch: Takt + Arbeiter + Loops gibt es; neu ist ein **Rhythmus-Register** (welcher Lauf wann, welche Heads, welches Ergebnis) und die Verbindung ins Cockpit.

## D5 · Entscheidungssystem
1. **Vorlage:** Was ist zu entscheiden, Optionen, Empfehlung, Begründung, Daten (verlinkt), Folgen bei Nichtentscheidung, Frist.
2. **Entscheidung:** freigeben / ablehnen (mit Grund) / ändern / zurück an Head.
3. **Wirkung:** Nach Frist + n Tagen prüft der Head, ob die Entscheidung gewirkt hat (vorhanden für Sales, wird für alle verallgemeinert).
4. **Lernen:** Quoten und Gründe fließen in den nächsten Lauf (Prompt-Kontext, nicht Modell-Training).
5. **Nachweis:** Entscheidungen bleiben dauerhaft (Monatsdateien, verkettet), sichtbar je Abteilung und im Cockpit.

## D6 · Delegation — Agent, Mensch, extern
- **Delegations-Matrix je Aufgabe:** Wer macht es (Agent / ich / Person intern / Person extern), wer prüft, wer gibt frei.
- **Externe Menschen als Schnittstelle:** Steuerberater, Freelancer, Assistenz bekommen **eingeschränkte** Zugänge (eigene Rolle, nur ihre Aufgaben/Unterlagen; serverseitig) oder Übergabe-Pakete per Link (zeitlich begrenzt, protokolliert).
- **Agenten-Aufträge:** Aufgabe → „an ZOE“ (gibt es) → Head → Ergebnis in den Stapel.
- **Grenzen:** Kein Agent unterschreibt, zahlt, versendet oder veröffentlicht ohne Freigabe; das bleibt im Register technisch erzwungen.

## D7 · Balance-Steuerung (Privat + Business)
- **Kapazität als Hauptgröße:** Wochenstunden je Person (Vorgabe 40 h), Machbarkeit je Meilenstein, Frühwarnung bei „eng“ und „nicht machbar“.
- **Energie** (nur mit Einwilligung Art. 9 b): Erholung/HRV/Schlaf als Hinweis „heute leichtere Arbeit planen“ — nie als Bewertung.
- **Geschützte Zeit:** Familie, Partnerschaft, Gesundheit als feste Blöcke, die kein Head verschieben darf.
- **Sichtregel:** Business-Heads sehen nur „belegt“ (ohne Inhalt) für private Zeit; Privat sieht alles.
- **Ziel:** Ein AI CEO, der wächst, ohne auszubrennen — messbar.

## D8 · CEO-Index
- Ein zusammengesetzter Wert aus **Business-Index** (Gesellschaften), **Privat-Index** und **Balance** (Kapazität, geschützte Zeit, Energie mit Einwilligung).
- Gewichte je Instanz einstellbar, Erklärung immer sichtbar („woraus besteht die Zahl“), ohne Daten „keine Daten“.
- Verhältnis zum heutigen Wachstums-Score: zusammenführen oder Wachstums-Score als CEO-Index weiterentwickeln (Entscheidung Kevin, I2).

## D9 · Nordstern & Strategie
- Nordstern je Instanz (heute teils fest „1 Mio“): frei definierbar, mit Messgröße und Datum.
- **Wetten** (Strategie-Hypothesen): „Wenn wir X tun, erreichen wir Y bis Z“ — mit Messung, Head of Strategy verfolgt.
- Research-Agent liefert belegte Marktsignale zu den Wetten.

## D10 · Playbooks je Geschäftsmodell
Startpakete, die beim Einrichten gewählt werden: Ziele-Vorlagen, aktive Heads, Kennzahlen, Rhythmus, Vorlagen für Angebote/Mails, Finanzplan-Struktur. Erste Kandidaten: **Beratung/Expertise**, **Holding/Beteiligungen**, **Events/Community**, **Software-/Produkt-Kleinunternehmen**. Unsere eigenen Firmen sind die ersten Vorlagen.

## D11 · KI-Budget & Kosten
- Budget je Head und Monat (Euro), Verbrauch aus KI-Protokoll, Ampel, beim Erreichen: Rückfall auf Regelwerk (gibt es schon als Mechanismus).
- Kosten je Ergebnis (z. B. je angenommenem Vorschlag) — die Kennzahl, die zeigt, ob ein Head sein Geld wert ist.

## D12 · Vertrauen & Nachweis
- Für jeden Vorschlag: **Warum** (Daten, Regel, Modell), **womit** (Kategorien, pseudonymisiert ja/nein), **wer** (Head, Modellstufe), **was danach** (Wirkung).
- Alles aus vorhandenen Bausteinen: KI-Protokoll, Entscheidungen-Log, Hash-Kette, Lese-Protokoll.

## D13 · Daten, Rechte, Datenschutz des Moduls
- **Neue Bestände (Entwurf):** `ceo-einstellungen` (je Instanz), `heads-rahmen` (Beschreibung je Head), `rhythmus-register`, `delegationen--<haushalt>`, `ki-budget--<JJJJ-MM>`; jeweils im Speicher-Register mit Frist und Rechtsgrundlage.
- **Neue Routen:** alle im Routen-Register; Cockpit-Lesewege mit Lese-Protokoll, Schreibwege mit `jsonBegrenzt` und Tor der passenden Klasse.
- **KI-VO:** Die Heads treffen keine Entscheidungen mit Rechtswirkung (Art. 22 DSGVO) — sie schlagen vor; Kennzeichnung „KI-Entwurf“ überall; Einordnung des Moduls nach KI-VO (vermutlich geringes Risiko, anwaltlich bestätigen).

## D14 · Oberfläche (Leitlinien)
- Ein Eintrag **„Führung“** (Arbeitstitel) oben in der Leiste, zwischen Home und Privat/Business — oder das Cockpit **wird** Home (Entscheidung I1).
- Design-Standard und CI (Granat, Smaragd, Archivo + Public Sans, dunkler Grund), 80/20; Abteilungen als ruhige Zeilen, nicht als bunte Kacheln; Freigaben mit Einzelklick und Rückgängig.
- Handy: Cockpit als Tagesübersicht, Freigaben per Wischen.

---

# Teil E — Wie wir es bauen: mit der eigenen Software

## E1 · Grundidee
Wir bauen das AI-CEO-Modul **in MAKE OS, mit MAKE OS**. Die MAKE Innovation GmbH ist **Kunde 0**: Kevin führt den Bau als AI CEO, mit den Heads als Team. Jede Lücke, die uns dabei stört, ist ein Produktfund.

## E2 · Die Werkzeuge, die wir dafür nutzen (alle vorhanden)
| Schritt | Werkzeug in MAKE OS | Wie |
|---|---|---|
| Ziel festlegen | Ziele → Meilensteine | „AI-CEO-Modul marktreif“ als Jahresziel, Phasen als Meilensteine |
| Planen | Kapazität | Stunden je Meilenstein, Machbarkeit vor dem Start |
| Arbeit zerlegen | Aufgaben + Bauplan (`/os/bauplan`) | Pakete als Bauplan-Karten mit Etappen, Bildern, Kommentaren |
| Spezifizieren | ZOE + (neu) Head of Product | Karte → Spezifikation (Entwurf) → Kevin gibt frei |
| Bauen | Claude Code (Agenten in Arbeitskopien) | ein Paket = ein Branch, Tests, tsc, eslint, Doku |
| Prüfen | Prüfstand, Gegenprüfung, Prüfbau, Browser-Durchgang | wie beim DSGVO-Ausbau und der Finanzplanung |
| Freigeben | Freigabe-Stapel / Kevins Wort | Upload nur auf Kevins Wort |
| Ausrollen | GitHub → Server, Head of IT | Sicherung, Rückweg-Bild, Außenprüfung |
| Sehen, ob es wirkt | Lichtfäden, Fluss, Evals der Heads | Abweichungen und Wirkung im Cockpit |
| Lernen | Entscheidungen-Log, Rückmeldungen | „Problem oder Idee melden“ → Bauplan |

## E3 · Arbeitsweise je Paket (bewährt)
1. **Klickrunde mit Kevin** für Richtungsfragen (AskUserQuestion), Entscheidungen festhalten (Memory + Dokument).
2. **Paket-Auftrag** mit Regeln (Kompatibilität, Register, Rechte, Datenschutz, Tests, Doku).
3. **Bau in eigener Arbeitskopie**, höchstens zwei schwere Agenten parallel (Mac 8 GB), Arbeitskopien nach dem Zusammenführen aufräumen.
4. **Unabhängige Gegenprüfung** bei allem, was rechnet oder Rechte betrifft.
5. **Gesamtprüfung:** volle Suite, Prüfbau mit Sandbox, Durchklicken, Kugeln in echtem Chrome, Server-Vorcheck (Caddy, Pflicht-Geheimnisse).
6. **Upload** nur auf Kevins Wort, mit Sicherung, Rückweg-Bild, Außenprüfung, Memory-Eintrag.

## E4 · Qualitätsregeln
- Jede Kennzahl mit Quelle und Test; jede Sicht-Grenze mit Wächtertest; jeder Head mit Evals (pass^k) bevor er in den Takt kommt.
- Kein Head geht live, bevor sein Grundlauf ohne KI etwas Sinnvolles liefert.
- Demo-Saat wächst mit: jede neue Funktion hat Beispieldaten für die Demo-Instanz.

---

# Teil F — Der Plan

> Zeitangaben sind Größenordnungen für Planung, nicht Zusagen. Reihenfolge und Umfang entscheidet Kevin in Klickrunden. Jede Phase endet mit einem Upload auf Kevins Wort.

## Phase 0 — Fundament nachziehen (Plattform-Schulden) · ca. 1–2 Wochen
| Paket | Inhalt | Abnahme |
|---|---|---|
| 0.1 Einheiten aus dem Register | Bereich/Arbeit je Einheit aus Gesellschafts-Register bzw. Inhaber-Einstellung statt Build-Variable; Client bekommt Zuordnung mit der Sitzung | Umstellen ohne neuen Bau; Wächtertests |
| 0.2 Personen neutral | Restliche feste `kevin`/`malin`-Annahmen raus (Antwortformen, Rückfälle) | Demo-Instanz mit beliebigen Personen ohne Rückfall |
| 0.3 Nordstern je Instanz | „1 Mio“ und persönliche Texte aus Organigramm/Agenten in Einstellungen | Kein persönlicher Text im Code (Wächter) |
| 0.4 Modul-Schalter | Bereiche je Instanz an/aus; Edition „nur Markttraktion“ | Instanz ohne Gesundheit/Familie läuft sauber |

## Phase 1 — CEO-Cockpit und Rhythmus · ca. 2 Wochen
| Paket | Inhalt | Abnahme |
|---|---|---|
| 1.1 Cockpit v1 | D2 aus vorhandenen Quellen; Business-/Privat-Sicht serverseitig | Kevin nutzt es 7 Tage täglich; keine private Zahl in Business |
| 1.2 Rhythmus-Register | D4: Tagesstart/-abschluss, Woche, Monat mit Ergebnis im Cockpit | Läufe sichtbar, Regelwerk-Rückfall ohne KI |
| 1.3 Entscheidungen v2 | D5: Vorlage-Format, Wirkung für alle Arten, Ansicht je Abteilung | Jede Freigabe hat Wirkungsmessung |

## Phase 2 — KI-Führungsteam · ca. 3–4 Wochen
| Paket | Inhalt | Abnahme |
|---|---|---|
| 2.1 Head-Rahmen | D3.1 als Fabrik; bestehende Heads ziehen um (verhaltensgleich) | Regressionstests der Heads unverändert grün |
| 2.2 Head of Operations | Inbox, Aufgaben, Termine, Abläufe | Evals pass^3, Grundlauf ohne KI |
| 2.3 Head of Product | Bauplan → Spezifikation → Priorisierung (wir nutzen ihn für MAKE OS selbst) | Kevin nimmt ≥ 60 % der Vorschläge an |
| 2.4 Head of People / Founder-Care | Balance-Vorschläge mit Einwilligung | Nie private Inhalte in Business; Einwilligungsprüfung im Test |
| 2.5 Head of Strategy | Wetten, Research-Anbindung | jede Wette mit Messung |
| 2.6 KI-Budget | D11 je Head | Grenze greift, Rückfall auf Regelwerk |

## Phase 3 — Delegation und Ausführung · ca. 2–3 Wochen
| Paket | Inhalt | Abnahme |
|---|---|---|
| 3.1 Delegations-Matrix | D6 je Aufgabe/Bereich | jede Aufgabe hat „wer macht, wer gibt frei“ |
| 3.2 Externe Schnittstellen | eingeschränkte Rolle bzw. Übergabe-Link für Steuerberater/Freelancer | serverseitig nur eigene Aufgaben/Unterlagen; Lese-Protokoll |
| 3.3 Ausführende Werkzeuge | Versand, Termine, Dokumente über bestehende Wege — immer Entwurf + Einzelklick | keine Außenwirkung ohne Freigabe (Wächter) |

## Phase 4 — Balance und CEO-Index · ca. 2 Wochen
| Paket | Inhalt | Abnahme |
|---|---|---|
| 4.1 Balance-Steuerung | D7: geschützte Zeit, Frühwarnung, Energie mit Einwilligung | Kein Head verschiebt geschützte Zeit |
| 4.2 CEO-Index | D8, Erklärung, Verlauf | ohne Daten „keine Daten“; Gewichte je Instanz |

## Phase 5 — Plattform und 3–4 Testpersonen · ca. 3–4 Wochen
| Paket | Inhalt | Abnahme |
|---|---|---|
| 5.1 Geführte Einrichtung | Personen, Gesellschaften, Ziele, Kalender, KI-Schlüssel, Playbook | Fremde Person kommt ohne uns zum ersten Cockpit |
| 5.2 Playbooks | D10, erste 3–4 Vorlagen | Einrichtung mit Vorlage < 30 Minuten |
| 5.3 Instanz-Fabrik v1 | neue Instanz per Skript, Updates an alle, Sicherung je Instanz | 3 Instanzen parallel auf einem Server |
| 5.4 Lizenzen v1 | signierte Lizenz, Modul-Schalter folgen ihr, Schonfrist, nur lesen nach Ablauf | Ablauf sperrt nie Daten |
| 5.5 Demo-Instanz | eigene Adresse, nächtlich zurückgesetzt, Rundgang (10 Minuten) — nur für Gespräche mit den Testpersonen, nicht öffentlich | Rundgang ohne echte Daten |
| 5.6 Testpersonen | **3–4 ausgewählte Personen** (Kevins Wahl), je eigene Instanz, AVV/Verschwiegenheit vorher, wöchentliches Feedback in den Bauplan, Gesprächsleitfaden aus P12 | Nutzung ≥ 4 Tage/Woche, Rückmeldungen strukturiert, kein Vorfall |

## Phase 6 — Markt · erst auf Kevins Wort (nicht jetzt)
Website-Bereich für das Modul (erst nach Marktreife, Kevins Regel), Fokus-Innovation-Abende als Bühne, Partnerschaften, Preisprüfung mit Piloten, rechtliche Unterlagen final (AVV-Vorlage, Datenschutzhinweis, KI-VO).

## F1 · Abhängigkeiten in Kürze
- Phase 0 vor allem anderen, was Kunden sehen.
- 1.1 (Cockpit) kann parallel zu 0.x beginnen, solange nur gelesen wird.
- 2.1 (Rahmen) vor 2.2–2.5.
- 5.1/5.3/5.4 brauchen 0.1–0.4.

## F2 · Woran wir merken, dass das Modul trägt (Abnahme des Ganzen)
1. Kevin führt MAKE Innovation GmbH und KD Ventures 4 Wochen lang aus dem Cockpit.
2. Mindestens 60 % der Head-Vorschläge werden angenommen, und angenommene Vorschläge wirken messbar.
3. Kein Business-Lauf sieht je eine private Zahl (Wächter + Lese-Protokoll belegen es).
4. Ein Pilotkunde richtet seine Instanz ohne unsere Hilfe ein.
5. KI-Kosten je Instanz liegen unter dem geplanten Budget.

---

# Teil G — Geschäftsmodell und Weg in den Markt (Hypothesen — erst relevant, wenn Kevin den Markteintritt beschließt)

## G1 · Editionen (Arbeitsstand, aus PLATTFORM_PLAN.md weitergedacht)
| Edition | Inhalt | Für wen |
|---|---|---|
| **Markttraktion** | CRM, Sales, Marketing, Events, Heads Sales/Marketing/Event | Vertriebsstarke Solo-Unternehmer |
| **MAKE OS** | Fokus & Zeit, Business, Privat, ZOE | Wer Privat und Business ordnen will |
| **AI CEO** | MAKE OS + Cockpit + vollständiges Führungsteam + Rhythmus + Playbooks | Wer sein Unternehmen mit Agenten führt |

## G2 · Preisgestaltung (zu recherchieren)
- Grundpreis je Instanz und Monat + KI-Verbrauch (transparent, mit Budget) oder Pauschale mit enthaltener KI.
- Einrichtung als Dienstleistung (MAKE Innovation berät — „Make.One“-Format).
- Vergleichspreise der Kategorien aus C3 durch die Recherche belegen.

## G3 · Kanäle (Hypothesen)
- **Fokus Innovation / Make.One** als Bühne (Abende, Tisch-Gespräche, Workshops).
- Eigene Geschichte als Beweis („Wir führen zwei Gesellschaften so“).
- Empfehlungen aus dem Netzwerk, Steuerberater/Berater als Multiplikatoren.
- Inhalte über Führung mit KI für Solo-Unternehmer (DACH, deutsch).

## G4 · Warum Kunden kaufen (Hypothesen zum Prüfen)
1. Zeit zurück und weniger Kopf-Last.
2. Ein Ort für alles — inklusive Privatleben.
3. Datenschutz und eigene Instanz in Europa.
4. Ein fertiges Team statt Werkzeugkasten.

---

# Teil H — Recherche

## H1 · Was wir wissen müssen
1. **Markt:** Wie groß ist die Zielgruppe „Solo-/Kleinst-Unternehmen mit KI“ in DACH/EU, wie wächst sie, welche Belege gibt es für den Trend „Unternehmen ohne Mitarbeiter“?
2. **Wettbewerb:** Wer kommt dem Zielbild am nächsten (C3), mit welchem Funktionsumfang, Preis, Datenschutz, Betriebsmodell?
3. **Bedarf:** Welche Schmerzen nennen AI CEOs selbst (Foren, Studien, Interviews)? Wie wichtig ist Privat + Business zusammen?
4. **Technik:** Bewährte Muster für Agenten-Orchestrierung, Evals, Autonomie-Stufen, menschliche Freigabe, Kostensteuerung.
5. **Recht:** KI-VO (Pflichten, Zeitplan, Einstufung), DSGVO (Art. 9, Art. 22, AVV, Drittland USA), Haftung bei Agenten-Handlungen, Berufsrecht (Steuerberatung) bei Finanzfunktionen.
6. **Preis und Geschäftsmodell:** Zahlungsbereitschaft, Preismodelle vergleichbarer Werkzeuge, Kosten der KI je Nutzer.
7. **Weg in den Markt:** Kanäle, die bei Solo-Unternehmern in DACH wirken.

## H1a · Belastbarkeitsregel (Kevin 05.10. spät)
- Gemini-Berichte sind **Rohmaterial**, keine Belege. Jede entscheidungsrelevante Aussage wird von uns selbst mit Primärquelle geprüft (Status ✅ / ⚠️ / ❌ / ⏳) und in `research/ai-ceo/VERIFIZIERT.md` geführt.
- In dieser Datei steht bei Zahlen und Marktaussagen entweder ein Verweis auf VERIFIZIERT.md oder das Wort „Annahme“.
- Recherche-Prompts enthalten harte Beleg-Regeln (Link auf Fundstelle, wörtliches Kurzzitat, „nicht belegt“ statt schätzen, keine hochgeladene Datei als Beleg).

## H2 · Wie wir die Ergebnisse einarbeiten
- Ergebnis als Datei in `research/ai-ceo/` (mit Datum und Quellen), Zusammenfassung in diese Datei (Teil C/G aktualisieren, Hypothesen als bestätigt/verworfen markieren).
- Jede belastbare Erkenntnis wird zu einer Bauplan-Karte oder ändert eine Phase.
- Die 18 Recherche-Aufträge (P1–P10, P12–P19) und die Synthese (P11) stehen in **`AI_CEO_RECHERCHE_PROMPTS.md`**.

---

# Teil I — Risiken, offene Entscheidungen, Kennzahlen

## I1 · Offene Entscheidungen für Kevin (Klickrunde vorschlagen)
1. **Ort des Cockpits:** eigener Eintrag „Führung“ oder Cockpit wird die neue Startseite?
2. **CEO-Index:** Wachstums-Score weiterentwickeln oder neuer Index daneben?
3. **Name des Moduls:** „AI CEO“, „Führung“, „Kommando“ (eher nicht, 80/20), Alternativen?
4. **Reihenfolge:** Phase 0 komplett zuerst oder Cockpit (1.1) parallel?
5. **Neue Heads:** welche zuerst (Operations, Product, People, Strategy)?
6. **Pilotkunden:** wer, wann, Preis im Pilot?
7. **Externe Zugänge:** Steuerberater (Jörg) als erster externer Nutzer?
8. **KI-Budget:** Höhe je Head/Monat für unsere Instanz?
9. **Name nach außen** (neu, P3/P10): „AI CEO“ ist bei Tycoon als „KI ist der CEO“ besetzt. Vorschlag: „AI CEO“ nur als Edition-/Community-Name, nach außen „Das Betriebssystem für Unternehmer ohne Mitarbeiter“ + „Sie bleiben CEO“.
10. **Erste Zielgruppe** (neu, P1/P11): wissensbasierte Solo-Unternehmer mit mehreren Gesellschaften (Berater, Fractional Executives, Agenturinhaber, Holding-Unternehmer) statt breit „Solo-Unternehmer“?
11. **Erste Edition** (neu, P11): eine einzige Start-Edition („AI CEO Starter“: Cockpit, Heads Sales/Finance/Operations/IT, Stapel, Fokus & Zeit, DATEV-Export) statt drei Editionen zum Start?
12. **Datenschutzbeauftragter** (neu, P7): Gesundheitsdaten + KI → DSFA sehr wahrscheinlich → nach § 38 Abs. 1 S. 2 BDSG DSB-Pflicht unabhängig von der Größe. Intern oder extern benennen?
13. **Streak im Gesundheitsbereich** (neu, P8): Forschung rät von Streaks ab (Druck, Orthosomnie). Behalten, abschaltbar machen oder entfernen?
14. **KI-Datenweg** (neu, verifiziert): bei Anthropic direkt bleiben (global/USA, SCC, ZDR beantragen) oder für Kunden-Instanzen auf eine **EU-Region über AWS Bedrock / Google Vertex** umstellen (~+10 %)? Entscheidet, ob wir je „Verarbeitung in der EU“ sagen dürfen.
15. **Testinstanzen ohne Gesundheitsmodul?** (neu, verifiziert): senkt DSFA-/DSB-Druck für die 3–4 Testpersonen deutlich.

## I2 · Risiken
| Risiko | Wirkung | Gegenmittel |
|---|---|---|
| Zu viel auf einmal | nichts wird fertig | Phasen mit Abnahme, Kevin entscheidet Reihenfolge |
| Agenten-Fehler mit Außenwirkung | Vertrauen weg, rechtliche Folgen | Freigabe-Pflicht technisch erzwungen, Prüfer, Wächter |
| KI-Kosten laufen weg | Marge weg | Budget je Head, Regelwerk-Rückfall, Modellstufen |
| Privates sickert ins Business | Kernversprechen gebrochen | serverseitige Sichten, Wächtertests, Lese-Protokoll |
| Zu sehr auf uns zugeschnitten | nicht verkaufbar | Phase 0, Demo-Instanz mit fremder Persona als Prüfstein |
| Rechtliche Unklarheit KI-VO/DSGVO | Verzögerung | frühe anwaltliche Prüfung, Datenschutz im Bauplan |
| Mac-Ressourcen beim Bau | Abstürze, Zeitverlust | max. 2 schwere Agenten, Arbeitskopien aufräumen |
| Abhängigkeit von einem KI-Anbieter | Ausfall, Preis | Regelwerk-Rückfall, Modellstufen kapseln, Anbieter austauschbar halten; Werkzeuge als MCP-Schnittstelle kapseln (P3) |
| **Prompt Injection über Mails, PDFs, Webseiten** (neu, P3/P6) | Agent folgt fremden Anweisungen, Datenabfluss | Quarantäne-Schritt im Head-Rahmen (werkzeugloser Lauf übersetzt Fremdtext in festes Schema), Spotlighting-Marken, Rechte je Werkzeug |
| **Falsches im Gedächtnis** (neu, P3/P6) | ZOE merkt sich Erfundenes oder Fremdes dauerhaft | Nichts aus Fremdinhalten automatisch ins Gedächtnis; „sofort merken“ nur aus Aussagen der Person |
| **Kostenexplosion durch Schleifen** (neu, P3/P6) | ein Lauf verbrennt das Budget | harte Grenzen je Lauf (Schritte, Werkzeugaufrufe, Laufzeit, Euro) |
| **Datenschutz-Versprechen zu groß** (neu, P1/P10) | „Daten bleiben in Deutschland“ stimmt für KI-Läufe nicht ohne Weiteres | ehrlich formulieren: Instanz und Daten in DE, KI-Läufe beim Modellanbieter (USA) mit Pseudonymisierung, Schaltern, Protokoll; ZDR-Vertrag und EU-Region prüfen |
| **EU-US-Datenabkommen wackelt** (neu, P7) | Grundlage der USA-Übermittlung fällt weg | Standardvertragsklauseln + TIA als Rückfall, EU-Region des Modellanbieters prüfen, Modell austauschbar halten |

## I3 · Kennzahlen des Vorhabens
- Tägliche Nutzung des Cockpits (Kevin, später Piloten)
- Annahmequote und Wirkung der Head-Vorschläge
- Zeit von „Lage öffnen“ bis „alle Entscheidungen getroffen“
- KI-Kosten je Instanz und je angenommenem Vorschlag
- Kapazität im grünen Bereich (Wochen „machbar“)
- Einrichtungszeit einer neuen Instanz
- Fehler/Vorfälle mit Außenwirkung (Ziel: 0)

---

# Teil J — Begriffe

| Begriff | Bedeutung in MAKE OS |
|---|---|
| **AI CEO** | Mensch, der sein Unternehmen mit einem Team aus KI-Agenten führt — Privat und Business zusammen |
| **ZOE** | KI-Chief-of-Staff: die eine Stimme gegenüber dem Menschen |
| **Head** | KI-Abteilungsleiter mit Auftrag, Kennzahlen, Grundlauf, Prüfer, Evals, Lernen |
| **Grundlauf / Regelwerk** | was ein Head oder Lauf ohne KI aus Regeln liefert |
| **Stapel** | gebündelte Freigaben mit Vorher/Nachher |
| **Autonomie-Stufen** | `entwurf`, `freigabe`, `vorschlag`, `autonom` — was ein Agent selbst darf |
| **Takt / Arbeiter** | Server entscheidet, was fällig ist; Arbeiter führt aus |
| **Loop** | Lauf über mehrere Bereiche mit einer abgeleiteten Handlung |
| **Lichtfäden** | Fokus-Strahl über Ziele, Meilensteine, Routinen mit Abweichungen |
| **Kapazität** | Machbarkeit aus Stunden und Personen (machbar/eng/nicht machbar) |
| **Business-Index / Privat-Index / Wachstums-Score** | zusammengesetzte Kennzahlen je Bereich |
| **Instanz** | eigene, getrennte MAKE-OS-Installation je Kunde |
| **Bereich je Einheit** | Zuordnung jeder Gesellschaft zu Privat oder Business (+ „zählt als Arbeit“) |
| **0-Punkt** | Business-Zahlen auf 0 gesetzt (05.10.2026), Neuanfang der Erfassung |
| **Kunde 0** | MAKE Innovation GmbH — wir selbst als erster Nutzer des Moduls |

---

---

# Teil K — Erkenntnisse aus der Recherche (Stand 05.10.2026)

**Grundlage:** 10 Gemini-Deep-Research-Berichte (P1, P2, P3, P4, P6, P7, P8, P9, P10, frühe P11), vollständig abgelegt unter `research/ai-ceo/` (Volltext + Auszug je Bericht). Noch offen: **P5** (KI-Entwicklung 2026–2030) und **P12–P19**, danach die endgültige Synthese P11.

## K1 · Wie belastbar die Berichte sind (zuerst lesen)
- **Zirkelbeleg:** Alle Berichte zitieren diese Datei (`AI_CEO_MODUL.md`) selbst als Quelle. Aussagen wie „MAKE OS besetzt eine Lücke“ oder „etablierter Standard“ sind deshalb oft **unsere eigene Hypothese, zurückgespiegelt** — keine Bestätigung. Für P5 und P12–P19 die Datei **nicht** als Kontext mitgeben.
- **Stichproben:** Je Bericht wurden 4–9 wichtige Zahlen im Netz geprüft. Viele stimmen (Destatis ~1,8 Mio. Solo-Selbstständige, WKO 376.112 EPU, Notion-/ClickUp-Preise, Gartner 40 %, Tycoon, Oura 5,7 Mio., Bitkom 93 %, KI-VO-Omnibus-Zeitplan, Spotlighting-Wirkung, Prompt-Caching-Preise, Ego-Depletion d = 0,04, Orthosomnie 3–14 %), einige sind **falsch oder überdehnt** (siehe K6). Jede Zahl, die in Website, Vertrieb oder Investoren-Material geht, braucht eine eigene Prüfung.
- **Gemini rechnet mit veralteten KI-Preisen** (Claude-3.5-Ära). Echte KI-Kosten je Head messen wir aus dem KI-Protokoll, bevor Preise festgelegt werden.

## K2 · Was sich bestätigt (mit echten Belegen, nicht nur Rückspiegelung)
1. **Premium statt Masse:** Die Zahl der Solo-Selbstständigen in Deutschland sinkt (−25 % seit 2012, ~1,8 Mio.), nur der qualifizierte Teil wächst (P1). → Premium-Positionierung, kein Massenmarkt.
2. **Freigabe-Pflicht ist Verkaufsargument:** Haftungsfälle (Moffatt v. Air Canada, NYC-MyCity-Bot) und Motion (verschiebt Termine ohne Bestätigung) zeigen den Bedarf an Kontrolle (P2/P3).
3. **KI-Budget statt Kredite:** Notion (Custom Agents, 10 $ je 1.000 Credits seit 04.05.2026), ClickUp, monday rechnen in Credits; unser Budget je Head mit Regelwerk-Rückfall („nichts blockiert“) ist ein klares Gegenmodell (P2/P9).
4. **Datenschutz zieht in DACH:** 93 % der Firmen bevorzugen KI aus Deutschland (Bitkom, geprüft) (P10).
5. **Höherer Preis hält Kunden besser:** KI-Produkte über 250 $/Monat halten Kunden ähnlich gut wie klassische B2B-Software, unter 50 $ schlecht (ChartMogul, geprüft) (P9/P10).
6. **Gut belegte Gestaltungsprinzipien (P8):** Freigaben bündeln, geschützte Zeit, die der Mensch selbst kontrolliert, Gesundheitswerte nur beschreibend (keine Noten, Nocebo/Orthosomnie), Kapazität **warnt**, blockiert nicht.

## K3 · Was neu ist und in den Plan gehört
| Neu | Quelle | Wohin im Plan |
|---|---|---|
| **Quarantäne-Schritt** für Fremdinhalte (Mail, PDF, Web) + Spotlighting-Marken | P6 | D3.1 Head-Rahmen (Pflichtteil), Phase 2.1 |
| **Harte Grenzen je Lauf** (Schritte, Werkzeugaufrufe, Laufzeit, Euro) | P6 | D3.1 + D11, Phase 2.1/2.6 — im Code prüfen |
| **Fehlerbudget je Head:** fallen die Eval-Werte, automatisch zurück auf „nur Freigabe“ | P6 | D3.1, Phase 2.1 |
| **Idempotenz-Schlüssel** für jede schreibende Aktion | P6 | D3.1, Phase 2.1 |
| **Drei Eval-Stufen:** bei jedem Commit, Smoke-Test, vor Upload pass^3 auf der Demo-Saat | P6 | E4 Qualitätsregeln |
| **Prompt-Caching messen** (Cache 5 Min. verfällt bei seltenen Head-Läufen; 1-Std.-Option prüfen) | P6 | D11 |
| **ZOE-Werkzeuge entschlacken/gruppieren** (36 Werkzeuge; Überlappung vermeiden) | P6 | Phase 2.1 |
| **„Sicher entnehmbarer Unternehmerlohn“** als Cockpit-Kennzahl (Runway Privat + Steuer-Vorauszahlungen + Business) | P4/P1 | D2 Cockpit, Phase 1.1 — Daten vorhanden |
| **Planungsfehlschluss sichtbar:** neben jeder Schätzung, wie lange Ähnliches wirklich dauerte | P8 | D7 Balance / Kapazität, Phase 4.1 — Daten vorhanden |
| **Schnellerfassung per Tastatur** und **Import-Assistenten** („was du kündigen kannst“) | P2/P1 | neu in D1 (Wechselhilfe), Phase 5.1 |
| **Kalender in beide Richtungen verlässlich**, geführte Rituale wie Sunsama | P2 | D4 Rhythmus, Phase 1.2 |
| **Oura-Anbindung prüfen** (5,7 Mio. Zahlende, größer als Whoop) | P4 | P14 Integrationen |
| **Privat abschaltbar halten**; mit gemeinsamen Ressourcen (Zeit, Geld, Energie) argumentieren statt „alles an einem Ort“ | P4 | C4 Prinzipien, G4 |
| **KI-Kennzeichnung auch für ausgehende Mails/Exporte** (KI-VO Art. 50 Abs. 2, maschinenlesbar) — gilt für neue Kunden-Instanzen ab Verkauf | P7 | D12, vor Phase 5.6 |
| **DATEV-Export** für die Kanzlei (Steuerberater-Allianz, provisionsfrei) | P10/P11 | P14 Integrationen, Phase 3.2 |
| **Holding-Funktionen:** Darlehensverrechnung zwischen Gesellschaften, Beschluss-/Fristenkalender, Treuhänder-/Steuerberater-Zugang | P1 | D6, Phase 3.2 (vorziehen, falls Holding-Segment zuerst) |

## K4 · Recht: Pflichten vor dem ersten Kunden (Abgleich mit DATENSCHUTZ_APP.md, P7)
| Pflicht | Status |
|---|---|
| AVV-Vorlage für Kunden (wir als Auftragsverarbeiter) | fehlt |
| Verzeichnis als Auftragsverarbeiter (Art. 30 Abs. 2) | fehlt |
| Transfer-Folgenabschätzung USA (TIA) + Standardvertragsklauseln als Rückfall | fehlt |
| Zero-Data-Retention / EU-Region mit Anthropic klären | Kevin |
| DSFA (Gesundheit + KI) und Muster für Kunden; DSB benennen (§ 38 Abs. 1 S. 2 BDSG) | Kevin + Anwalt |
| AGB, Haftungsbegrenzung | fehlt |
| Hinweis „kein Medizinprodukt“ (Gesundheitsbereich) | fehlt |
| Verschwiegenheit nach § 62a StBerG / § 203 StGB für Steuerberater-/Berater-Zugang (AVV reicht nicht) | fehlt — Voraussetzung für Phase 3.2 |
| KI-Kennzeichnung ausgehender Inhalte (Art. 50 Abs. 2) | teilweise (App-Kennzeichnung da, ausgehende Mails/Exporte fehlen) |
| Klären: Gilt „Belastung“ aus Gesundheitsdaten als Emotionserkennung (Art. 50 Abs. 3 KI-VO)? | Anwalt |
| Bestätigt: KI-VO-Omnibus (VO 2026/1744): Hochrisiko-Pflichten erst ab 02.12.2027 bzw. 02.08.2028; Art. 50 gilt ab 02.08.2026 | — |

## K5 · Preise, Markt, Vertrieb (Arbeitsstand, Widersprüche offen)
- **Preisvorschläge widersprechen sich:** P9 99 / 149 / 249 € (Monat), P10 149 / 299 / 499 €, frühe P11 eine Edition 249 €. P1 setzte 49/99/199 € ohne Grundlage. → **Arbeitshypothese:** AI CEO um 249 €/Monat (199 € bei Jahreszahlung), bezahlter Pilot statt Gratis-Tarif (P9: 199 € für 30 Tage, voll anrechenbar), Einrichtungspaket 990 €. Erst nach gemessenen KI-Kosten und Preis-Test mit Piloten festlegen.
- **KI-Budget-Regel (P9):** Budget so, dass 90 % im Rahmen bleiben; Hinweis bei 85 %, bei 100 % Rückfall aufs Regelwerk, Nachkauf nur per Klick.
- **Marge:** P9-Rechnung in sich stimmig (69–75 %); mit vorsichtigeren Annahmen (Server 12 €, KI 30 €, Betreuung 25 €) für AI CEO etwa **68 %** — trägt.
- **Ziele Jahr 1 widersprechen sich** (35 / 100 / 1.000 Kunden). 1.000 ist unrealistisch; **Arbeitshypothese 30–50 Kunden in Jahr 1** über Piloten und Abende.
- **Kanäle (P10):** Make.One-/Fokus-Innovation-Abende (8–12 Gäste, Live-Lösung an der Demo-Instanz, 48-Std.-Nachfassen), Kevin als Gesicht auf LinkedIn (nur mit echten Zahlen), VGSD-Inhalte, provisionsfreie Steuerberater-Allianz (Steuerberater dürfen keine Vermittlungsprovision nehmen), Berater als Einrichtungspartner erst nach geführter Einrichtung; bezahlte Werbung erst ab ~100 Kunden. Event-Quoten aus P10 (80–90 % Erscheinen, 25–45 % Abschluss) stammen aus dem Großkunden-Vertrieb — selbst messen.
- **Wortwahl (P10):** ja: Betriebssystem, KI-Führungsteam, Freigabe-Stapel, eigene Instanz, Mensch entscheidet. Nein: KI-Tool, Bots, Autopilot, „autonom“, „KI ersetzt den Menschen“, Hustle.
- **Erste Zielgruppe (P1/P11):** wissensbasierte Solo-Unternehmer mit mehreren Gesellschaften (Berater, Fractional Executives, Agenturinhaber, Holding-Unternehmer). Coaches und Creator: geringste Zahlungsbereitschaft.
- **Reihenfolge (P1/P3/P11 einig):** Cockpit + Rhythmus → Freigabe-Stapel sichtbar → Head of Operations als erster neuer Head (vor Product; P3 nennt Strategy vor Product) → geführte Einrichtung → Balance.

## K6 · Was NICHT stimmt oder nicht verwendet werden darf
- „4,2 Mio. Solo-Selbstständige“ (P11) → laut Destatis ~1,8 Mio.
- „87 % Burnout“ → gilt für Gründer allgemein und „irgendein psychisches Problem“.
- Marktgröße P1 zählt Kunden der drei Editionen doppelt; Kurzfassung und Tabelle widersprechen sich.
- P8: „23 Min. 15 Sek.“ nur aus einem Interview; Zeitmanagement-Metaanalyse falsch zitiert; „40 % Fehler beim Aufgabenwechsel“ und „60 % weniger Aufmerksamkeitsrest“ nicht belegt.
- P6: „15–20 Werkzeuge als Grenze“ steht so nicht im OpenAI-Leitfaden (dort: Überlappung vermeiden).
- P7: Umfragewerte 82/88/76/71 % nicht auffindbar.
- P10 über uns: „zwei Gesellschaften profitabel ohne Angestellte“, „15 h → 3 h Verwaltung“, „Bruttomarge > 80 %“ — **unbelegt, nicht nach außen verwenden** (Business-Zahlen stehen seit 05.10. auf 0).
- „Zertifizierte europäische Datenhoheit“ — wir haben **keine** Zertifizierung.

## K6a · Ergebnis der eigenen Faktenprüfung (Stand 05.10.2026, Details: `research/ai-ceo/VERIFIZIERT.md`)
104 Aussagen geprüft: 58 ✅ · 30 ⚠️ · 14 ❌ · 2 ⏳. **Was sich gegenüber K1–K6 ändert:**
- **K4 „EU-Region mit Anthropic klären“ ist beantwortet:** Beim Direktanbieter gibt es keine; EU-Verarbeitung nur über **AWS Bedrock oder Google Vertex** (~+10 %). → neue Architektur-Entscheidung (I1 Nr. 14).
- **Testinstanzen sind keine Ausnahme:** Auch kostenlose Abgabe an die 3–4 Testpersonen ist „Bereitstellung“ → maschinenlesbare KI-Kennzeichnung ausgehender Inhalte **vor** der ersten Übergabe; AVV, Verzeichnis als Auftragsverarbeiter, Pannen-Meldeweg ebenfalls vorher.
- **DSFA/DSB stärker belegt** (DSK-Muss-Liste Nr. 17, Wearable-Daten) → Option: Testinstanzen **ohne Gesundheitsmodul** (I1 Nr. 15).
- **K5 Preise:** KI-Kosten jetzt mit echten Preisen (Haiku 4.5 1/5 $, Sonnet 5/5.5 2/10 $, Opus 5.5 4/20 $); Zahlungsbereitschaft und Segmentgrößen sind **nicht belegt** → nur über Gespräche mit den Testpersonen.
- **K2.4 korrigiert:** „8 von 10 Unternehmen (ab 20 Beschäftigten) bevorzugen KI aus Deutschland“ statt „93 %“.
- **K3:** OWASP LLM Top 10 **2026** und Agentic Top 10 als Prüfliste für den Quarantäne-Schritt; keine feste Werkzeug-Obergrenze, aber ZOE-Werkzeuge auf Überlappung prüfen; Haiku cacht erst ab 4.096 Token (kurze Quarantäne-Läufe ohne Cache einplanen).
- **Neu für den Steuerberater-Zugang:** Provisionsverbot § 2 Abs. 3 BOStB (nicht § 5).
- **Eigene Texte:** „Data Privacy Framework“ in 6 App-Texten erst nach Prüfung der DPF-Liste stehen lassen, sonst auf „Standardvertragsklauseln“ korrigieren.

## K7 · Nächste Schritte (angepasst an den Rahmen „erst für uns + 3–4“)
1. **Eigene Faktenprüfung** der 10 vorhandenen Berichte → `research/ai-ceo/VERIFIZIERT.md` (läuft); Teil K danach auf „nur Verifiziertes“ umstellen.
2. Nächste Gemini-Läufe mit harten Beleg-Regeln, **ohne Datei als Kontext**, in dieser Reihenfolge: **P5** (KI-Entwicklung), **P19** (KI-Brain), **P16** (Gestaltung), **P14** (Integrationen), **P12** (Gesprächsleitfaden für die 3–4 Testpersonen), **P13** (erste Nutzer, mehrere Instanzen betreiben), **P15** (Förderung). P17/P18 erst, wenn der Markt dran ist.
3. Jeden neuen Bericht wieder selbst prüfen, bevor er in den Plan geht.
4. Synthese über alle **verifizierten** Ergebnisse; Klickrunde mit Kevin zu I1.
5. KI-Kosten je Head aus dem KI-Protokoll messen (Grundlage für Budget, später Preis).
6. Start Phase 0 + Cockpit v1 (mit „sicher entnehmbarem Unternehmerlohn“) — für uns.

*Erstellt am 05.10.2026 aus dem Code-Stand `6b10a5ba`, PLATTFORM_PLAN.md, UMBAU_ABEND_0410.md, CLAUDE.md und Kevins Entscheidungen; Teil K ergänzt am 05.10.2026 aus 10 Recherche-Berichten (`research/ai-ceo/`). Nächster Schritt: restliche Recherche (P5, P12–P19), Synthese P11, Klickrunde zu Teil I1, Start mit Phase 0.*
