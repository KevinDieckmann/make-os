# Markt-UX: Wie die Besten KI-Mitarbeiter, Agenten-Teams und Assistenten bedienbar machen

**Stand:** 08.10.2026 · reine Recherche, nichts gebaut · ergänzt `AGENTEN_KONZEPT.md` Teil B (dort Stehendes wird hier nur verwiesen, nicht wiederholt)
**Zweck:** Grundlage für die nächste Klickrunde zum Agenten-Bereich (Kevins Wunsch: „nochmal eine Fragerunde, nachdem du eine umfangreiche Marktrecherche gemacht hast").

> **Belastbarkeit (wie in Teil B):**
> - **[O]** = offizielle Doku, Hilfeseite oder Hersteller-Blog, am 08.10.2026 gelesen.
> - **[W]** = Startseite/Marketing des Herstellers gelesen (Werbeaussage, keine Doku).
> - **[S]** = nur Such-Ausschnitt oder Drittquelle (Test-Blogs, Fachpresse). Oft mit Interessenkonflikt (z. B. Wettbewerber-Blogs).
> - **„nicht belegt"** = gesucht, nichts Belastbares gefunden.
>
> OpenAI-Seiten (openai.com, help.openai.com) antworteten am 08.10. mit 403 — alles zu ChatGPT ist deshalb [S].
> Motion: die Hilfeseiten zu „AI Employees" lieferten am 08.10. „Page Not Found" — Stand unklar (umbenannt oder zurückgezogen?).
> Alle Produkte ändern sich monatlich. Vor dem Bau einzelne Punkte noch einmal ansehen.

---

## 0 · Kurzfassung

1. **Drei Bedienmodelle am Markt:** (a) **Koordinator + Threads** — man spricht mit einer Leitung, die Arbeit in einzeln öffnbare Threads verteilt (Claude Projects, Devin, ChatGPT Work). (b) **Rollen-Team mit Gesichtern** — feste „Mitarbeiter" mit Namen und Avatar (Sintra, Marblism, Motion). (c) **Agent-Profil mit Reitern** — jeder Agent ist eine Seite mit Chat · Aktivität · Einstellungen · Auswertung (Notion, Langdock, HubSpot, Copilot Studio, Dust).
2. **Kevins Bild (Heads links, ZOE Mitte, rechts Hintergrund und „Als Nächstes") deckt sich mit (a)+(c).** Das Rollen-Team (b) ist der beste *Einstieg*, wird aber in Tests als „isoliert" kritisiert (Entwürfe per Kopieren zwischen Helfern) [S].
3. **Neu seit Teil B:** Claude „Agent View" (Mai 2026) stellt **„wartet auf dich"** nach oben und lässt **direkt in der Liste antworten** [O]. HubSpot hat eine **Agent-Inbox** mit Status „Braucht Freigabe" [O]. ChatGPT hat seit Juni 2026 eine **Seite „Scheduled"** und hat dafür das Briefing-Produkt **Pulse eingestellt** [S].
4. **Anlegen per Gespräch ist Standard:** Beschreiben → Rückfragen → Plan bestätigen → Konfiguration erscheint daneben, dann **Bauen/Testen-Umschalter** (Langdock, Notion, Microsoft, OpenAI) [O/S].
5. **Freigaben** laufen überall je Werkzeug oder je Konto (Relevance: Auto · Freigabe · Agent entscheidet; Lindy: „Immer erlauben / Um Freigabe bitten"; Lesen nie) [O]. Lücke bei Lindy laut Drittquelle: in Direktnachrichten greift die Freigabe nicht [S] → **bei uns nie kanalabhängig.**
6. **Kosten:** Langdock zeigt das reifste Muster — Grenze je Lauf, je Monat und je Instanz, Warnungen bei 80/95 %, Verbrauchsbalken [O]. Fast alle anderen rechnen in **Credits** (Dust, Notion, Manus, Sintra, HubSpot), was Nutzer als undurchsichtig erleben [S].
7. **Leistung je Agent:** Daumen auf jeder Antwort (Langdock, Copilot Studio), Ergebnis-Kategorien „gelöst · eskaliert · abgebrochen" (Copilot Studio), Coaching-Vorschläge (HubSpot) [O/S]. Eine „Mitarbeiter-Beurteilung" im Wortsinn hat niemand — Leistung = Annahme, Ergebnis, Kosten.
8. **Gedächtnis wird sichtbar:** eigener Reiter je Agent, löschbar (Dust), Dateien mit Versionen und Ebenen Persönlich/Team/System (Lindy) [O].
9. **Privat & Familie:** Google (Personal Intelligence, Home Brief) und Apple (Siri AI, iOS 27) bauen persönliche Assistenten mit Opt-in je Quelle — **Apple startet nicht in der EU, Google nur in einzelnen Ländern** [S]. Niemand verbindet Privat und Business mit serverseitiger Trennung und Art.-9-Einwilligung → **Alleinstellung für MAKE OS**.
10. **EU:** Langdock (EU-Hosting, Self-Host) und Dust (EU-Region, Schalter „nur EU-Modelle") sind die Vorbilder für eine EU-Erzählung [O/S].
11. **Empfehlung in sechs Zusätzen zu C2:** „Wartet auf dich" ganz oben rechts mit Antwort in der Zeile · Head-Seite mit Reitern · Delegation als aufklappbare Karte · Anlegen per Gespräch + Probelauf · Budget-Balken in der Kopfleiste · Daumen + Annahmequote je Head.

---

## 1 · Die Produkte (je eine Zeile)

| Produkt (Stand) | Einstieg · Team sichtbar | Chat · Übergabe · Skills/Gedächtnis | Hintergrund · Freigaben | Kosten · Leistung | Handy · Sprache · EU |
|---|---|---|---|---|---|
| **Claude Projects neu** (Beta, 17.09.2026) [O] | Ziel beschreiben; Koordinator schlägt sofort Arbeit vor | Koordinator routet in neue/bestehende **Threads**, prüft und setzt zusammen; geteiltes Gedächtnis aller Threads; **einstellbar: wie oft er nachfragt, wie oft er neue Threads anlegt, wie ausführlich er berichtet** | Threads laufen in der Cloud weiter | Verbrauch je Projekt; Modell + Aufwand getrennt für Koordinator und Threads | „vom Handy steuern"; EU nicht geprüft |
| **Claude Code Agent View** (11.05.2026) [O] | eine Liste aller Hintergrund-Sitzungen | Zeile = Sitzung, letzte Antwort, „braucht dich"; **Vorschau ohne Öffnen, Antwort direkt in der Liste**; Enter = ganzer Verlauf | Zustände arbeitet · wartet auf dich · fertig (laut Drittquelle auch Fehler/gestoppt [S]); Schleifen zeigen **nächste Laufzeit in der Liste** | Jede Sitzung zählt einzeln aufs Kontingent [S] | Terminal; Push aufs Handy über Remote Control mit zwei Schaltern „Push bei nötiger Aktion" / „Push, wenn Claude es entscheidet" [S] |
| **Claude Agent Teams** (experimentell) [S] | Teamleitung + Mitglieder | Umschalten zwischen Mitgliedern und **direkt schreiben**; gemeinsame Aufgabenliste (offen · in Arbeit · fertig, Abhängigkeiten); Agenten-Nachricht ≠ Zustimmung (Teil B) | — | Kosten linear je Mitglied (Teil B) | — |
| **Claude App: Skills, Scheduled, Dispatch** [O/S] | Skill im Gespräch bauen lassen (skill-creator), Verwaltung unter Einstellungen › Fähigkeiten › Skills, **an/aus je Skill**; Nutzung sichtbar als „Using [Skill]" [O] | — | Seite **„Scheduled"**: „Create with Claude" oder „manuell" (Name, Prompt, **Freigabe-Modus**, Rhythmus, Modell); bearbeiten, pausieren, löschen, sofort ausführen; jeder Lauf eigene Sitzung [O] | — | **Dispatch**: Auftrag vom Handy, Arbeit am Rechner, Rückmeldung danach [S] |
| **ChatGPT** (Work, Scheduled, workspace agents) [S] | **workspace agents** (22.04.2026, Nachfolger der GPTs): Reiter „Agents" in der Seitenleiste, Ablauf beschreiben → ChatGPT führt Schritt für Schritt | Work (Juli 2026): „New Task" als kleines Projekt, parallele Unter-Agenten, „Ultra" mit bis zu 4 Agenten | Seite **„Scheduled"** (Juni 2026, Web + Handy): nächste Laufzeit, pausieren/fortsetzen/bearbeiten/löschen; Einmal · wiederkehrend · beobachten; Auslöser per Webhook (Gmail, Slack, GitHub); Admins legen fest, welche Aktionen Freigabe brauchen; **Pulse (tägliches Briefing) eingestellt** | nutzungsbasiert/Credits; Agenten-Läufe zählen gegen Monatskontingent | Web/iOS/Android; in Slack einsetzbar |
| **Langdock** (Berlin) [O] | Agent per **Agent Builder** im Gespräch: Rückfragen → Plan → „Start building"; Konfiguration live daneben; **Build/Test-Umschalter**; Vorlagen | @-Menü für Agenten, Skills, Wissen, Workflows; **Sub-Agenten als aufklappbarer Werkzeug-Block**, sehen den Verlauf nicht, nur oberste Ebene delegiert; Skills als ZIP (SKILL.md) [S]; Gedächtnis je Nutzer, max. 50, einsehbar/editierbar | Scheduled: Vorlagen **Tages-Briefing · Meeting-Vorbereitung · Wochenrückblick**; Vorschlag des Agenten erst nach Klick „Schedule"; Lauf-Historie fertig/übersprungen/Fehler; Workflows mit Freigabe-Schritten, Benachrichtigung nur an benannte Empfänger; Aktionen zeigen **editierbare Eingaben** vor dem Ausführen | **Grenze je Lauf, je Monat je Workflow, je Instanz**; Warnung 80/95 %; Verbrauchsbalken; Kosten je Schritt; je Agent Analytics + **Daumen** [S] | Slack, Teams, Desktop; Handy-App nicht belegt; EU-Hosting, ISO 27001, SOC 2, Self-Host laut Hersteller [S] — Modell-Standort je Modell prüfen |
| **Sintra AI** [W/S] | **12 Helfer mit Namen, Rolle, Bild** (Buddy, Soshie, Seomi …); Onboarding in 4 Schritten inkl. „Freigabestufen" | Chat je Helfer; **Brain AI** = gemeinsames Wissen, je Helfer abschaltbar [S]; Kritik: Helfer isoliert, Übergabe per Kopieren, keine eigenen Helfer [S] | „Power-Ups" (90+ fertige Abläufe) [S] | Credits (250/Monat) [S]; keine Leistungsanzeige belegt | Web + App (iOS/Android) [W]; EU nicht belegt |
| **Marblism** [W/S] | **7 KI-Mitarbeiter** (Assistenz, Social Media, Leads, Website, SEO, Empfang, Recht) | Mitarbeiter melden sich „nur, wenn sie deine Eingabe oder Freigabe brauchen" [W] | Tests: jede Ausgabe wartet auf Freigabe → 10–30 Min. am Tag [S] | „Stunden KI-Arbeit" als Kontingent [S] | Telefon-Empfang als Rolle; App nicht belegt |
| **Lindy** („teammate") [O] | lebt in Slack, verknüpft je Person Mail, Kalender, Telefon | Gedächtnis als **Dateien mit Versionen**, Ebenen Persönlich · Team · System | **Routinen** per Satz („Jeden Montag um 9 …"), Auslöser Zeit oder Ereignis mit **„Smart Filter" in Klartext**, Ausgabe-Kanal wählbar; Freigabe je verbundenem Konto: „Always allow" / „Ask for approval", **Lesen nie**; laut Drittquelle greift die Freigabe nur in geteilten Slack-Threads, nicht in DMs/SMS [S] | Credits; Agent pausiert bei leerem Guthaben (VERIFIZIERT-A Nr. 29) | **SMS/iMessage**, Telefon |
| **Relevance AI** [O] | „Workforce"-Leinwand: Agenten als Kästen, Kanten = Übergaben mit „When to call this agent" [S] | Manager + Unter-Agenten (Teil B) | **Task View**: aktiv · fertig · wartet auf Freigabe · fehlgeschlagen; Filter nach Agent/Status; **Zeitleiste: welcher Agent, welches Werkzeug, wie lange**; übernehmen; Autonomie **je Kante: Auto · Freigabe · Agent entscheidet**, „Max auto runs" | Testsuiten/Monitor nur Enterprise [S] | — |
| **Motion** (AI Employees, Beta) [S] | 7 Mitarbeiter (Assistenz, Sales, Support, Recruiting, PM, Research, Marketing) mit fertigen **Skills**, eigene Skills baubar | Kontext = Projekte, Aufgaben, Termine, Docs | **manuell oder autonom** (Ereignis/Zeitplan); Ergebnisse per Schritt „Send to Inbox" | 29 $/Sitz + Credits [S] | Hilfeseiten am 08.10. nicht erreichbar |
| **Microsoft 365 Copilot / Copilot Studio / Agent 365** [S] | Agent Builder: beschreiben, Rückfragen, Daten anhängen, testen rechts, veröffentlichen an Personen/Gruppen; Agenten **an die linke Leiste pinnen**; Agent Store mit „Built by your org" (Admin-Freigabe) | @-Erwähnung im Copilot-Chat; Unter-Agenten child/connected (Teil B); Test-Pane zeigt den **Plan des Orchestrators als Karte** | autonome Auslöser (Teil B) | **Effectiveness:** Daumen + Kommentar je Antwort, CSAT 1–5, Ergebnisse gelöst/eskaliert/abgebrochen; Agent 365: Register + **Karte, wie Agenten verbunden sind** | Teams, Handy; EU Data Boundary, aber Anthropic-Modelle ausgenommen (VERIFIZIERT Nr. 5) |
| **HubSpot Breeze** [O] | Agent Hub: Agenten anlegen, klonen; Anweisungen, Aktionen (inkl. MCP), Wissen, **Eingabe-Felder** | Nachsteuern per Chat am Lauf → neue Fassung unter der alten | **Agent Inbox**: Status „Needs approval", Filter „Ungelesen", alles gelesen; „Review before running this tool" je Werkzeug (Teil B) | **„Test agent" kostet keine Credits**; Lauf-Historie mit **geschätzten Credits**; Laufgrenzen; Customer Agent: Lösungsquote, Übergaben, **Coaching-Vorschläge**, Quellen-Leistung [S] | — |
| **Salesforce Agentforce** [S] | Agent Builder mit Topics (Teil B) | Slack als Oberfläche für Menschen + Agenten | — | **Observability** (früher Command Center): Analytics (Abbruch, Eskalation, Qualität) + Schritt-für-Schritt-Spur jedes Laufs | Slack |
| **Notion Agents** [O] | Seitenleiste „Agents", **+**: „Mit KI-Chat erstellen" · Vorlage · leer | Agent-Seite mit Reitern **Chat · Activity · Settings** (+ Insights); @-Erwähnung in Seiten, Kommentaren, Slack | Auslöser: Zeitplan (mit Vorschau nächster Lauf), Notion-Ereignisse mit Filter, Slack; Activity = Lauf-Historie mit jedem Schritt; Freigabe vor Aktionen nicht beschrieben | Credits je Lauf; **Insights**: Modell, Qualität, Credits je Lauf, CSV | Notion Agent seit 01/2026 auf dem Handy [S]; Agent ohne Eigentümer stoppt nach 7 Tagen [S] |
| **Dust** (Paris) [O] | Agent Builder mit „Sidekick", Vorlagen | **Pods** = gemeinsame Räume mit Gesprächen, Aufgaben, Dateien, Live-Dashboards; „was ein Mensch im Pod kann, kann ein Agent auch"; **Gedächtnis je Nutzer und Agent**, Reiter „Memory", löschbar | Zeitplan in Klartext, LLM rechnet ihn aus, **Bestätigung „läuft effektiv: …"**; Ergebnis privat oder in einem Pod | Analytics je Agent in **Credits** (keine Daumen) | **EU-Region + Schalter „nur EU-Modelle"**, EU-Flagge je Modell |
| **Mistral Le Chat** [S] | Agenten im Le Chat bauen, Aufruf per **@** | Bibliotheken (Wissen), 20+ MCP-Konnektoren mit Admin-Rechten je Konnektor; **Gedächtnis einsehbar, änderbar, löschbar**, Import aus ChatGPT | Zeitpläne in Le Chat nicht belegt | — | französischer Anbieter; Hosting-Ort nicht geprüft |
| **Manus** [S] | Auftrag eingeben, Agent arbeitet im eigenen virtuellen Rechner, **Schritte live mitverfolgen, mittendrin stoppen** | Wide Research: viele parallele Unter-Agenten | geplante Aufgaben (Gratis 2, bezahlt 20) | Credits je Aktion (≈ 11–14/Min.) — „frisst schnell" | Übernahme durch Meta von China untersagt (04/2026) |
| **Devin** [O] | Sitzungen in der Seitenleiste, Ordner, Standardfilter „meine, nicht archiviert" [S] | Koordinator startet „managed Devins", **Kind-Sitzungen vor Start freigeben** (abschaltbar); **Playbooks aus erfolgreichen Sitzungen erzeugen und aus Fehlschlägen verbessern**; Wissensvorschläge prüfen | **ACU-Grenze je Kind-Sitzung**, Verbrauch je Kind | `/usage`-Anzeige [S] | Slack-Befehl `!agent` [S] |
| **Google Gemini** [S] | Personal Intelligence (14.01.2026): Gmail, Fotos, YouTube **einzeln verbinden, standardmäßig aus, jederzeit trennen** | Daumen runter bei falschen Verknüpfungen erbeten | Scheduled Actions (Pro/Ultra); Google Home: **„Home Brief" mit Erkennung der Haushaltsmitglieder** (I/O 2026, angekündigt) | — | zuerst USA, dann Kanada/Indien; nur private Konten |
| **Apple Siri AI** (iOS 27, 14.09.2026) [S] | eigene Siri-App, Seitentaste, Dynamic Island | persönlicher Kontext aus Nachrichten, Mail, Fotos; Aktionen über Apps; Chats per iCloud, **auto-löschen nach 30 Tagen / 1 Jahr / nie** | — | Tageslimits bei Server-Funktionen | Englisch zuerst; **nicht in der EU** zum Start |
| **Tycoon** („Astra, AI CEO") [S] | KI-CEO plant, verteilt an 10+ Agenten (CMO, CTO …), fragt bei Bedarf um Freigabe | — | — | Firmen-Guthaben („wallet") ab 49 $ | iMessage, Slack, Discord |

---

## 2 · Die 25 besten Bedien-Muster

Jedes Muster: **Vorbild** · **Warum** · **Passt zu MAKE OS, weil …** (mit Bezug auf Vorhandenes aus `AGENTEN_KONZEPT.md`).

**1. „Wartet auf dich" steht ganz oben — mit Antwort direkt in der Zeile**
- Vorbild: Claude Agent View (Zeile zeigt „needs your input", Vorschau ohne Öffnen, Antwort inline) [O]; Relevance Task View (eigene Gruppe „wartet auf Freigabe") [O].
- Warum: Agenten blockieren meist an *einer* Rückfrage. Wer sie in der Liste beantwortet, hält alle Läufe in Bewegung, ohne Kontextwechsel.
- Passt, weil: Rechts oben „Läuft/Fertig" (C2) bekommt einen dritten, obersten Block. Rückfragen und Stapel-Freigaben sind schon Daten (`zoe-stapel`, `head-<id>`), sie brauchen nur eine Zeile mit Eingabefeld.

**2. Jeder Agent ist eine Seite mit Reitern: Chat · Aktivität · Einstellungen · Auswertung**
- Vorbild: Notion Custom Agents (Chat · Activity · Settings · Insights) [O]; Langdock (Analytics + Feedback je Agent) [S]; HubSpot (Run history) [O].
- Warum: Gespräch, Nachweis und Steuerung trennen, ohne dass man den Agenten verlässt. Die Aktivität ist der Prüfpfad.
- Passt, weil: der Head-Kopf (C2) wird so zur Reiterleiste; Aktivität = `agent-log` + Läufe des Heads, Auswertung = Annahmequote aus `lib/heads/lernen.ts`, Einstellungen = bisherige Regler aus `AgentenView`.

**3. Der Koordinator verteilt in Threads — und man stellt ein, wie er berichtet**
- Vorbild: Claude Projects (Koordinator routet in neue oder bestehende Threads; einstellbar: wie oft er nachfragt, wie oft er neue Threads anlegt, wie ausführlich er berichtet) [O].
- Warum: Nicht jede Person will dieselbe Taktung. Drei Regler ersetzen viele Einzeleinstellungen.
- Passt, weil: ZOE ist der Koordinator; die drei Regler gehören je Person in die ZOE-Einstellungen (Plattform-Regel: nichts Persönliches im Code).

**4. Delegation erscheint als aufklappbare Karte, der Unter-Agent bekommt nur den Auftrag**
- Vorbild: Langdock Sub-Agenten (aufklappbarer Werkzeug-Block; sieht den Verlauf nicht; nur die oberste Ebene delegiert) [O]; Claude Code/Dust (nur die Zusammenfassung kommt zurück, Teil B).
- Warum: Man sieht, *dass* delegiert wurde und mit welchem Auftrag, ohne dass der Chat zuläuft. Frischer Kontext spart Kosten und schützt Daten.
- Passt, weil: genau C3 („An Thread … gesendet ›" / „Bericht aus Thread …"), und die Tiefe ≤ 2 (Mitarbeiter delegieren nie weiter) ist dasselbe wie bei Langdock.

**5. Jede Ebene ist direkt ansprechbar, alle sehen eine gemeinsame Aufgabenliste**
- Vorbild: Claude Agent Teams (zwischen Mitgliedern umschalten und direkt schreiben; Aufgabenliste mit Abhängigkeiten) [S]; Devin (jedes Kind direkt öffnbar) [O].
- Warum: Man muss nicht „über den Chef" gehen, wenn man weiß, wer es macht. Die Liste verhindert Doppelarbeit.
- Passt, weil: Kevin will „mit jedem Mitarbeiter einzeln sprechen"; die Aufgabenliste muss keine neue sein — ZOE-Aufgaben (`Task.zoe`) und Läufe reichen.

**6. Anlegen im Gespräch: beschreiben → Rückfragen → Plan bestätigen → Konfiguration live daneben**
- Vorbild: Langdock Agent Builder („Ask for edits" / „Start building", Formular rechts, beides dieselbe Konfiguration) [O]; Notion „Mit KI-Chat erstellen" [O]; Microsoft Agent Builder [S]; ChatGPT workspace agents [S]; Lindy „Describe your routine" [O].
- Warum: Niemand füllt gern zehn Felder aus. Der Plan-Schritt verhindert, dass das Modell etwas Falsches still anlegt.
- Passt, weil: „+ Mitarbeiter" und „+ Skill" (Kevins Kopfleiste) brauchen genau das; der Plan wird ein Stapel-Eintrag, erst der Klick legt an (Regel 3).

**7. Bauen/Testen-Umschalter — der Test wirkt nicht und kostet nichts**
- Vorbild: Langdock „Build/Test" [O]; HubSpot „Test agent" verbraucht keine Credits [O].
- Warum: Vertrauen entsteht durch Ausprobieren ohne Folgen.
- Passt, weil: der „Probelauf" in B4/C8 ist geplant; Trockenlauf gibt es schon in `fuehreAus` (Werkzeuge nur Vorschau).

**8. Vorschläge des Agenten werden erst mit einem Klick gespeichert**
- Vorbild: Langdock (Agent schlägt Zeitplan vor, gespeichert erst nach „Schedule") [O]; Claude Scheduled (Name, Zeitplan, Anweisungen prüfen, dann „Schedule") [O].
- Warum: Zeitpläne kosten Geld und laufen unbeobachtet.
- Passt, weil: neue Stapel-Art `skill` (C5) — Agenten-Vorschläge für Skills, Mitarbeiter und Zeitpläne laufen alle über den Stapel.

**9. Eigene Seite „Geplant" mit nächstem Lauf, Historie und Vorlagen**
- Vorbild: ChatGPT „Scheduled" (Juni 2026: nächste Laufzeit, pausieren, fortsetzen, bearbeiten, löschen) [S]; Claude „Scheduled" (sofort ausführen) [O]; Langdock (Vorlagen Tages-Briefing · Meeting-Vorbereitung · Wochenrückblick; Historie fertig/übersprungen/Fehler) [O]. ChatGPT hat dafür sein Briefing-Produkt Pulse eingestellt [S].
- Warum: Wiederkehrendes braucht einen Ort zum Aufräumen. Ein Briefing ist am Markt inzwischen „eine geplante Aufgabe", kein eigenes Produkt.
- Passt, weil: Kevins Rhythmus (7 Uhr, Montag, Freitag) wird zu drei Vorlagen; der Takt (`lib/zoe/takt.ts`) bleibt die eine Planung, die Seite liest nur.

**10. Auslöser in Klartext — mit Bestätigung, was daraus wird, und Vorschau des nächsten Laufs**
- Vorbild: Dust (Zeitplan in Klartext, „läuft effektiv: …" vor dem Speichern) [O]; Notion (Vorschau nächster Lauf, Ereignis mit Filter) [O]; Lindy („Smart Filter" in Klartext für Ereignisse) [O]; ChatGPT Work (Webhooks Gmail/Slack) [S].
- Warum: „Jeden Werktag um 7" ist leichter als Cron; die Bestätigung fängt Missverständnisse.
- Passt, weil: Skill-Auslöser (C4 `ausloeser`) bekommen ein Klartext-Feld; Ereignisse („neue Mail von Kunde X", „Deal auf Angebot") gibt es als Daten schon (Inbox 2, CRM).

**11. Autonomie je Verbindung in drei Stufen — Lesen fragt nie**
- Vorbild: Relevance (je Kante: Auto · Freigabe nötig · Agent entscheidet, dazu „Max auto runs") [O]; Lindy (je Konto „Immer erlauben / Um Freigabe bitten", Lesen nie) [O].
- Warum: Eine globale Stufe ist zu grob; je Werkzeug ist zu fein für Laien. „Je Verbindung" ist die Mitte.
- Passt, weil: MAKE OS hat das Risiko schon je Werkzeug im Register; die Stufe *je Head* (Kevins Wunsch) darf nur **verschärfen**, nie lockern; „Max. Auto-Läufe je Tag" ist ein gutes zusätzliches Ventil.

**12. Freigabe zeigt die Eingaben editierbar — mit gerenderter Vorschau**
- Vorbild: Langdock („Eingaben erscheinen im Chat zum Prüfen und Bearbeiten", Mailtext als Vorschau + Quelltext) [O].
- Warum: „Ändern und freigeben" in einem Schritt ist schneller als ablehnen und neu anstoßen.
- Passt, weil: der Stapel kann es schon („Ändern & freigeben", T2-Häkchen je Feld) — im Chat soll dieselbe Karte erscheinen, nicht ein zweiter Weg.

**13. Eine Agenten-Inbox: Ergebnisse, Ungelesen, „Braucht Freigabe" — Nachsteuern per Chat am Lauf**
- Vorbild: HubSpot Agent Inbox (Status „Needs approval", Filter „Ungelesen", Chat am Lauf erzeugt neue Fassung unter der alten) [O]; Motion („Send to Inbox") [S]; Relevance Task View [O].
- Warum: Hintergrundergebnisse brauchen einen Briefkasten, sonst gehen sie unter.
- Passt, weil: „Fertig" rechts oben + Glocke (Art `agenten`) ist dieser Briefkasten; „neue Fassung unter der alten" passt zum Thread-Modell (Mitarbeiter-Thread weiterführen).

**14. Push nur, wenn eine Entscheidung nötig ist — Risiko vor dem Klick sichtbar**
- Vorbild: Claude Code Remote Control (zwei Schalter: „Push bei nötiger Aktion" / „Push, wenn Claude es entscheidet") [S]; Forge Remote (Risiko-Einstufung vor Erlauben/Ablehnen) [S]; Langdock (Benachrichtigung nur an benannte Empfänger) [O].
- Warum: Zu viele Pushes = Freigaben werden blind bestätigt.
- Passt, weil: Telegram/WhatsApp-Texte sind schon neutral (`telegram-text.ts`); die Risiko-Ampel kommt aus dem Register.

**15. Der Agent ist dort, wo man ist — die Freigabe-Regel hängt nie am Kanal**
- Vorbild: Lindy in Slack/SMS/iMessage [O]; ChatGPT workspace agents in Slack [S]; Devin `!agent` in Slack [S]. Gegenbeispiel: bei Lindy greift die Freigabe laut Drittquelle nur in geteilten Threads, nicht in DMs/SMS [S].
- Warum: Kanäle senken die Hürde; uneinheitliche Freigaben sind das größte Vertrauensrisiko.
- Passt, weil: ZOE auf WhatsApp ist gebaut; der Server entscheidet die Freigabe immer gleich (`fuehreAus`), egal ob Web, WhatsApp oder Telegram.

**16. Kosten-Leitplanken in drei Ebenen, Warnschwellen, Verbrauchsbalken**
- Vorbild: Langdock (Grenze je Lauf, je Monat je Workflow, je Instanz; Warnung 80/95 %; bei Grenze werden neue Läufe gesperrt und Zeitpläne abgeschaltet; Balken „Verbrauch vs. Grenze") [O]; HubSpot (geschätzte Credits je Lauf) [O]; Devin (ACU-Grenze je Kind) [O].
- Warum: Mehragenten kosten etwa 15× einen Chat (Teil B). Ohne Deckel gibt es „Rechnungsschock".
- Passt, weil: Verbrauch je Head ist schon messbar (`verbrauch.ts`); der Regelwerk-Rückfall ersetzt das harte „gesperrt" — nichts steht still.

**17. Große Aufträge zuerst schätzen und Kind-Läufe vor dem Start freigeben**
- Vorbild: Devin („Auto-approve child sessions" abschaltbar → jede Charge vor dem Start prüfen) [O].
- Warum: Bei vielen Unter-Agenten ist der Start der teuerste Moment.
- Passt, weil: Kevins Wunsch „Kostenschätzung vor großen Aufträgen" (Antwort 14) — ab z. B. 3 Mitarbeiter-Läufen oder geschätzt > X € erst eine Karte „So würde ich es verteilen · ca. 0,40 € · [Starten]".

**18. Leistung je Agent: Daumen je Antwort, Ergebnis-Kategorien, Coaching**
- Vorbild: Langdock (Daumen auf jeder Antwort, automatisch an) [S]; Copilot Studio (Daumen + Kommentar, CSAT 1–5, gelöst/eskaliert/abgebrochen) [S]; HubSpot (Lösungsquote, Coaching-Vorschläge, welche Wissensquelle trägt) [S]; Notion Insights [O].
- Warum: Ohne Rückmeldung kein Lernen; ohne Kategorien keine Vergleichbarkeit.
- Passt, weil: die Heads lernen schon (Annahmequote, Ablehngründe, Wirkungsleiter). Neu wären nur Daumen im Chat und eine Karte „Leistung" je Head. Achtung KI-VO: das bewertet **Agenten**, nie Beschäftigte (VERIFIZIERT-B Nr. 15).

**19. Gedächtnis ist sichtbar, editierbar und löschbar — je Agent und je Person**
- Vorbild: Dust (Reiter „Memory" im Agenten-Profil, je Nutzer und Agent, löschbar) [O]; Lindy (Dateien mit Versionen, Ebenen Persönlich · Team · System) [O]; Langdock (max. 50 Einträge) [O]; Mistral (änderbar, löschbar, Import) [S].
- Warum: Unsichtbares Gedächtnis erzeugt Misstrauen („woher weiß er das?").
- Passt, weil: Merksätze der Heads (`HeadStand.gedaechtnis`) existieren; Kevin wünscht „eigenes Gedächtnis" je Mitarbeiter. Ebenen Persönlich/Haushalt passen 1:1 zur Trennung je Person/Haushalt; Art. 15/17 bekommt eine Anzeige.

**20. Persönlicher Kontext nur per Opt-in je Quelle — mit Lösch-Frist**
- Vorbild: Gemini Personal Intelligence (Gmail, Fotos, YouTube einzeln, Standard aus, jederzeit trennen) [S]; Apple Siri AI (Chats auto-löschen nach 30 Tagen / 1 Jahr / nie) [S].
- Warum: Persönliche Assistenten werden nur angenommen, wenn die Person sieht, was sie sehen.
- Passt, weil: KI-Tor + Einwilligung (b) existieren; Privat-Heads zeigen oben „sieht: Kalender ✓ · Gesundheit ✕ (keine Einwilligung)". Lösch-Frist der Threads ist offene Frage C10/11.

**21. Skills als Paket mit Bibliothek, Schalter je Skill und sichtbarer Nutzung**
- Vorbild: Claude (Einstellungen › Fähigkeiten › Skills, an/aus, „Using [Skill]" sichtbar) [O]; Langdock (ZIP mit SKILL.md, Skripte werden nicht ausgeführt) [S].
- Warum: Man muss sehen, *welche* Anleitung gerade wirkt, sonst ist ein Fehler nicht zu finden.
- Passt, weil: schrittweise Offenlegung (Teil B) — im Chat steht „verwendet Skill ‚Angebot nachfassen'"; Import SKILL.md nur als Entwurf, nichts ausführbar (C9 Risiko 4).

**22. Skills aus erfolgreichen Läufen ableiten — und aus Fehlschlägen verbessern**
- Vorbild: Devin (Playbook aus Sitzungs-Links erzeugen, mit misslungenen Sitzungen verbessern) [O]; Claude skill-creator im Gespräch [O].
- Warum: Gute Abläufe entstehen im Tun, nicht im Formular.
- Passt, weil: Kevins Wunsch „Das als Skill speichern" aus dem Chat; Fehlschläge kennen wir aus Ablehngründen und Evals der Heads.

**23. Das Team hat Gesichter — aber einen gemeinsamen Kontext**
- Vorbild: Sintra (12 Helfer mit Name, Rolle, Bild) [W]; Marblism (7 Mitarbeiter) [W]; Motion (7 AI Employees) [S]. Kritik: Helfer isoliert, Übergabe per Kopieren, keine eigenen Helfer [S].
- Warum: Gesichter machen das Angebot greifbar („ich habe ein Team"), das verkauft sich (Sintra > 40.000 Zahlende, VERIFIZIERT-A Nr. 28).
- Passt, weil: Heads/Mitarbeiter bekommen Kürzel-Kugel in Bereichsfarbe (Design `TIEF`); der Unterschied zu Sintra ist der geteilte Kontext und die Übergaben über ZOE.

**24. Onboarding in vier Schritten: Geschäft beschreiben → verbinden → Regeln + Freigabestufen → loslassen**
- Vorbild: Sintra („Share how your business works · Connect your tools · Define rules and success criteria · Sit back") [W]; Marblism („beschreib dein Geschäft und deine Ziele") [W].
- Warum: Ein Einstieg ohne Prompt-Wissen; Freigabestufen werden gleich zu Beginn festgelegt statt vergessen.
- Passt, weil: das Onboarding (`onboarding-data.ts`) hat Etappen; eine Etappe „Dein KI-Team" (Heads an/aus, Stufe, Budget) fehlt dort noch.

**25. Ein @-Menü für alles — Agenten, Mitarbeiter, Skills, Wissen**
- Vorbild: Langdock (@ öffnet Agenten, Skills, Wissen, Prompts, Workflows) [O]; Notion (@ in Seiten, Kommentaren, Slack) [O]; Microsoft Copilot [S]; Mistral [S].
- Warum: Ein Griff statt vieler Knöpfe; funktioniert auch am Handy.
- Passt, weil: C2 sieht `@Head` und `@Mitarbeiter` vor; `/Skill` (Schrägstrich) für Skills ergänzt es — dasselbe Menü, zwei Zeichen.

**Bewusst nicht übernehmen**
- **Credits statt Euro** (Dust, Notion, Manus, Sintra, HubSpot) — schwer zu verstehen, „Credits nach 2–3 Tagen leer" ist ein häufiger Kritikpunkt (P03-Auszug Nr. 4). MAKE OS zeigt Euro.
- **Isolierte Helfer ohne Übergaben** (Sintra-Kritik) [S].
- **Freigabe, die vom Kanal abhängt** (Lindy laut Drittquelle) [S].
- **Unbegrenzte Parallelität** (Manus Wide Research mit 100+ Unter-Agenten, „credit-heavy") [S] — bei uns höchstens 3 Mitarbeiter-Läufe je Person (C3).
- **Agent stoppt, wenn der Eigentümer fehlt** (Notion nach 7 Tagen) [S] — bei Konto-Löschung brauchen Business-Skills eine Übergabe an den Inhaber statt Stillstand (Plattform-Frage, siehe Frage 13).

---

## 3 · Text-Wireframes

Alle Bildschirme nur mit Bausteinen aus `components/os/ui` (Seite, Karte, Knopf, Reiter, Zeile, Hinweis, Leerzustand). Symbole hier sind Platzhalter: ◉ ZOE, ◍ Head, ↳ Mitarbeiter, ◐ läuft, ⚑ wartet auf dich, ✓ fertig, ✕ Fehler, ⏸ pausiert, ▸ aufklappen.

### 3.1 Agenten-Seite — Desktop (ab 1.180 px)

```
┌ Kopf (global): [Alles | Privat | Business]      Suche ⌘K      Glocke 4      Fokus 00:42 ─────────────────────────────┐
├ AGENTEN ──── [+ Neu ▾] [Freigaben 3] [Geplant 7] [Leitplanken] [Budget ▮▮▮▮▮▮▯▯▯▯ 62 € / 100 €] [⋯] [⏻ Not-Aus] ┤
├────────────────────┬──────────────────────────────────────────────────────────┬────────────────────────────────────┤
│ TEAM          [⌕]  │ ┌ ZOE · seit deinem letzten Besuch (gestern 18:40) ────┐ │ WARTET AUF DICH (2)                │
│ ◉ ZOE          ●   │ │ „Drei Dinge zuerst: …" (Briefing, 3 Zeilen)           │ │ ⚑ Sales · „Angebot A-17 senden?"   │
│ ─ Business ─       │ │ Passiert    4 fertig · 1 Fehler ›                     │ │   Risiko: nach außen   [Ansehen]   │
│ ◍ Sales      ⚑ 1   │ │ In Arbeit   Marketing: Herbst-Kampagne (3/5) ›        │ │   [Freigeben] [Ändern] [Ablehnen]  │
│   ↳ Recherche ◐    │ │ Nächste     Mo 07:00 Briefing · Di Frist USt-VA ›     │ │ ⚑ Content fragt: „Du oder Sie?"    │
│   ↳ Angebote       │ │ Ziele       Umsatz Q4 ▮▮▮▮▮▮▯▯▯▯ 62 % ›               │ │   [ Antwort …             ] (➤)    │
│   ↳ Power Hour     │ │ Freigaben   3 offen · [2 risikoarme freigeben]        │ ├────────────────────────────────────┤
│ ◍ Marketing  ◐     │ └────────────────────────────────────────────────────────┘ │ LÄUFT (2)                         │
│   ↳ Content        │                                                          │ ◐ Recherche · Leads Köln           │
│   ↳ Kampagnen      │  Du   09:12  Was braucht heute meine Aufmerksamkeit?     │   Schritt 2/4 · 1:42 · 0,08 € [■]  │
│ ◍ Event            │  ZOE  09:12  … (Antwort, KI-Marke)                       │ ◐ Content · LinkedIn-Woche         │
│ ◍ Finanzen   1     │  ┌ ▸ An Head of Marketing gesendet ─────────────────┐   │   Schritt 1/3 · 0:20 · 0,02 € [■]  │
│ ▫ IT (Lagebild)    │  │ Auftrag „Herbst-Kampagne planen" · Thread öffnen › │   │ FERTIG HEUTE (4) ▸   FEHLER (1) ▸ │
│ ─ Privat ─         │  └────────────────────────────────────────────────────┘   ├────────────────────────────────────┤
│ ◍ Gesundheit (Einw)│  ┌ ◂ Bericht aus „Herbst-Kampagne" ─────────────────┐   │ ALS NÄCHSTES  (nach Eisenhower)    │
│ ◍ Finanzen privat  │  │ 3 Sätze · 2 Vorschläge im Stapel · Thread öffnen › │   │ ! heute 14:00  Angebot-Frist (Sales)│
│ ◍ Assistenz        │  └────────────────────────────────────────────────────┘   │   Mo 07:00    Morgen-Briefing (ZOE)│
│                    │                                                          │   Mo 07:30    Power Hour (Sales)   │
│ [+ Mitarbeiter]    │  [ Nachricht an ZOE …   @Head  /Skill  Datei  Mikro ] (➤) │   Fr 16:00    Wochenrückblick      │
└────────────────────┴──────────────────────────────────────────────────────────┴────────────────────────────────────┘
```
- **[+ Neu ▾]** öffnet: Auftrag (jetzt) · Auftrag an mehrere Heads · Hintergrundaufgabe (geplant/wiederkehrend) · Mitarbeiter · Skill. So bleibt die Kopfleiste ruhig (eine Hauptaktion je Ansicht = das Eingabefeld).
- **Budget-Balken** klickbar → Verbrauch je Head (30 Tage), Grenzen, Warnschwellen (Muster 16).
- **Not-Aus** mit Rückfrage („Alle Hintergrundläufe anhalten und Zeitpläne pausieren? Chats bleiben möglich.").
- **Wartet auf dich** steht vor „Läuft" (Muster 1); Freigaben mit Risiko-Hinweis aus dem Register (Muster 14).
- **Team links:** Punkt = aktiv, Zahl = wartet auf dich; „Gesundheit (Einw)" erscheint nur mit Einwilligung (a)+(b), sonst gar nicht (Server).

### 3.2 Agenten-Seite — Handy (< 720 px)

```
┌──────────────────────────────────┐   ┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│ Agenten            ⚑ 2    [+]    │   │ ‹ Team                     ⌕     │   │ ‹ Läuft                           │
├──────────────────────────────────┤   ├──────────────────────────────────┤   ├──────────────────────────────────┤
│ ZOE · seit gestern 18:40         │   │ ◉ ZOE                     ●      │   │ WARTET AUF DICH (2)              │
│ „Drei Dinge zuerst: …"           │   │ BUSINESS                         │   │ ⚑ Sales · Angebot A-17 senden?   │
│ 4 fertig · 1 Fehler · 3 Freig. ›│   │ ◍ Sales               ⚑ 1  ›     │   │  ← wischen: ablehnen             │
│──────────────────────────────────│   │ ◍ Marketing           ◐   ›     │   │  → wischen: freigeben (Rückfrage)│
│ Du: Was steht heute an?          │   │ ◍ Event                    ›     │   │ ⚑ Content: „Du oder Sie?"        │
│ ZOE: …                           │   │ ◍ Finanzen            1   ›     │   │  [Du] [Sie] [Antwort …]          │
│ ▸ An Marketing gesendet ›        │   │ PRIVAT                           │   │ LÄUFT (2)                        │
│                                  │   │ ◍ Finanzen privat          ›     │   │ ◐ Recherche · 2/4 · 0,08 €       │
│                                  │   │ ◍ Assistenz                ›     │   │ ALS NÄCHSTES                     │
│ [ Nachricht …        Mikro ] (➤) │   │                                  │   │ ! 14:00 Angebot-Frist            │
├──────────────────────────────────┤   ├──────────────────────────────────┤   ├──────────────────────────────────┤
│ [Gespräch]   [Team]   [Läuft ⚑2] │   │ [Gespräch]   [Team]   [Läuft ⚑2] │   │ [Gespräch]   [Team]   [Läuft ⚑2] │
└──────────────────────────────────┘   └──────────────────────────────────┘   └──────────────────────────────────┘
```
- Unten drei Reiter wie C2; das Abzeichen am Reiter „Läuft" zählt nur „wartet auf dich".
- Wischen mit Daumen nur für **risikoarme** Freigaben; „nach außen" öffnet immer die Karte mit Vorschau (Muster 12).
- **[+]** = Auftrag · Hintergrundaufgabe · Skill ansehen (Bearbeiten von Skills am Rechner, siehe 3.5).
- Eingabe 16 px, Ziele ≥ 48 px (Design-Standard).

### 3.3 Head-Chat — Desktop (Mitte, Head ausgewählt)

```
┌ ◍ Head of Marketing · „Sorgt für Sichtbarkeit und Anfragen." ──────────────────── [Stufe: Vorschlag ▾] [⋯] ┐
│ Kennzahlen: Anfragen 30 T. 12 ▲ · Kampagnen aktiv 2 · Annahmequote 74 %                                    │
│ Sieht: CRM · Web            Sieht nicht: Finanzen · Privat · Gesundheit                                    │
│ Mitarbeiter: [Content ◐] [Kampagnen] [Newsletter] [+]       Skills: [/kampagne-planen] [/linkedin-woche] [+]│
├ [Chat] [Aktivität] [Mitarbeiter] [Skills] [Gedächtnis] [Leistung] [Einstellungen] ─────────────────────────┤
│  Du   10:02  Plan mir die Herbst-Kampagne für Bestandskunden.                                              │
│  Head 10:02  Ich teile das auf: Zielgruppe (ich), Texte (Content), Versand-Plan (Kampagnen).                │
│              verwendet Skill „kampagne-planen" ›                                                            │
│  ┌ ▸ An „Content" gesendet · Thread „Herbst-Texte" ───────────────────────────── ◐ läuft · 0:40 ┐         │
│  │ Ziel: 3 Mail-Varianten · Format: Betreff + 120 Wörter · Grenzen: keine Rabatte · Quellen: Akte│         │
│  └──────────────────────────────────────────────────────────────────────────────────────────────┘         │
│  ┌ Vorschlag · Segment „Bestandskunden aktiv" anlegen (32 Personen, 3 ausgenommen) ──────────────┐         │
│  │ [Ansehen] [Ändern & freigeben] [Ablehnen ▾ Grund]                    Risiko: intern            │         │
│  └──────────────────────────────────────────────────────────────────────────────────────────────┘         │
│  ┌ ◂ Bericht aus „Herbst-Texte" ✓ ──────────────────────────────────────────────────────────────┐         │
│  │ 3 Varianten fertig (A sachlich, B persönlich, C kurz). Empfehlung: B. Thread öffnen ›          │         │
│  └──────────────────────────────────────────────────────────────────────────────────────────────┘         │
│  [Daumen hoch] [Daumen runter]   [Als Skill speichern]                                                     │
│  [ Nachricht an Head of Marketing …   @Content  /Skill  Datei  Mikro ]                               (➤)  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Kopf:** Auftrag in einem Satz, 3 Kennzahlen, **„Sieht / sieht nicht"** (aus den KI-Kategorien, Muster 20), Stufe als Chip (nur verschärfbar).
- **Reiter** wie Notion (Muster 2): Aktivität = Läufe + Werkzeugaufrufe + Freigaben des Heads; Leistung = Daumen, Annahmequote, Kosten je Ergebnis; Gedächtnis = Merksätze mit „löschen" (Muster 19).
- **Delegation** als Karte mit den vier Pflichtfeldern aus C3 (Ziel, Format, Grenzen, Quellen), aufklappbar (Muster 4).
- **Freigabe-Karte** im Chat ist dieselbe wie im Stapel (Muster 12) — kein zweiter Weg.

### 3.4 Mitarbeiter-Thread — Desktop und Handy

```
Desktop
┌ Marketing › Content › Thread „Herbst-Texte"                         ◐ läuft · Schritt 2/3 · 0:52 · 0,03 € [■ Stopp] ┐
│ ┌ Auftrag von Head of Marketing (10:02) ────────────────────────────────────────────────────────────────┐        │
│ │ Ziel: 3 Mail-Varianten · Format: Betreff + 120 Wörter · Grenzen: keine Rabatte · Quellen: Akte, Brain  │        │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────────┘        │
│ Schritte:  ✓ Zielgruppe gelesen (CRM, 32 Personen, gekapselt)  ◐ Varianten schreiben  ○ Selbstprüfung (Rubrik)    │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────────         │
│ Content 10:03  Variante A … (Text)                                                                                │
│ Content 10:04  Variante B …                                                                                       │
│ Du      10:06  Mach B noch persönlicher, Du-Form.                    ← direkt mit dem Mitarbeiter sprechen         │
│ Content 10:06  Fassung B2 … (neue Fassung unter der alten)                                                        │
│ [An Head zurückmelden]  [Als Skill speichern]  [Daumen hoch] [Daumen runter]                                      │
│ [ Nachricht an Content …   /Skill  Datei  Mikro ]                                                            (➤)  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Handy
┌──────────────────────────────────┐
│ ‹ Content · „Herbst-Texte"   ⋯   │
│ ◐ 2/3 · 0,03 €          [Stopp]  │
├──────────────────────────────────┤
│ Auftrag ▸ (zugeklappt)           │
│ Variante A … ▸                   │
│ Variante B … ▸                   │
│ Du: Mach B persönlicher.         │
│ Fassung B2 …                     │
│ [Zurückmelden] [Daumen] [Daumen] │
│ [ Nachricht …        Mikro ] (➤) │
└──────────────────────────────────┘
```
- **Fortschritt in Schritten** (Kevins Antwort 8) und Stopp-Knopf in der Kopfzeile (Manus: „mittendrin stoppen" [S]).
- **„An Head zurückmelden"** erzeugt den Bericht im Head-Thread (C3 Schritt 4) — auch nach direktem Weiterfragen.
- Mitarbeiter-Ergebnisse sind Text Dritter, wenn Web/Mails gelesen wurden (`fremd()`); dann zeigt der Kopf „nur Vorschlag".

### 3.5 Skill-Editor — Desktop (Handy: nur ansehen, an/aus, Probelauf)

```
┌ Skill „angebot-nachfassen" · Head of Sales · Entwurf v3                  [Bauen | Testen]   [Aktivieren] (gesperrt) ┐
├ GESPRÄCH (Builder) ─────────────────────────────┬ EINSTELLUNGEN ───────────────────────────────────────────────────┤
│ Du: Mach daraus einen Skill: 3 Tage nach dem     │ Name           angebot-nachfassen            (≤ 64, a–z, -)      │
│     Angebot nachfassen, freundlich, mit Termin.  │ Beschreibung   „Fasst gestellte Angebote nach 3 Werktagen nach,  │
│ Builder: Zwei Fragen: Sie oder Du? Kanal?        │                wenn keine Antwort da ist." (was + wann)          │
│ [Sie] [Du] · [Mail] [Anruf-Leitfaden]            │ Anleitung      (Text, Beispiele: gut / schlecht)        ▸ öffnen │
│ Builder: Plan:                                   │ Eingabe-Felder [Angebot ▾] [Ton ▾]                               │
│  1. Angebote „gestellt", > 3 Werktage, ohne      │ Werkzeuge      ☑ crm_suche (frei) ☑ crm_vorschlag (Stapel)       │
│     Antwort                                      │                ☐ gmail senden — nicht verfügbar (nur Mensch)     │
│  2. Entwurf je Kontakt in den Stapel             │ Auslöser       ( ) von Hand  (•) Zeitplan „werktags 9 Uhr"       │
│ [Ändern] [So bauen]                              │                → läuft effektiv: Mo–Fr 09:00, nächster Do 09.10. │
│                                                  │                ( ) Ereignis „Angebot gestellt" + Filter …        │
│                                                  │ Ergebnis       (•) Stapel  ( ) Thread                            │
│                                                  │ Freigabe       wie Werkzeug (Register)  [strenger ▾]             │
│                                                  │ Modell/Aufwand ausgewogen ▾   Kostengrenze je Lauf 0,50 €        │
│                                                  │ Tests (3 nötig)  ✓ kein Angebot → nichts   ✓ Werbesperre → nichts│
│                                                  │                  ◐ Angebot 5 Tage alt → 1 Entwurf  [Probelauf]   │
│                                                  │ Erfolgsquote   — (noch keine Läufe)   Versionen v1 v2 v3 ▸       │
│ [ Nachricht an Builder … ]                (➤)    │ [SKILL.md importieren …] (nur Entwurf, nichts ausführbar)        │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘
```
- **Bauen/Testen** wie Langdock (Muster 7); „Aktivieren" erst grün, wenn ≥ 3 Tests bestanden (Teil B: Tests zuerst).
- **Werkzeuge** nur aus denen des Heads; die Stufe kommt aus dem Register und ist sichtbar (Muster 11).
- **Zeitplan in Klartext** mit Bestätigung und nächstem Lauf (Muster 10).
- Vom Agenten vorgeschlagene Skills landen als Stapel-Art `skill` und öffnen sich hier im Zustand „Vorschlag" (Muster 8).

### 3.6 Hintergrundaufgaben — volle Ansicht (Desktop) und Handy

```
Desktop (Klick auf „Läuft" rechts oben → volle Ansicht; Filter oben)
┌ Hintergrundaufgaben   [Alle Heads ▾] [Status: alle ▾] [Heute ▾]                  [+ Hintergrundaufgabe] ┐
├──────────────────────────────────────────────────────────────────────┬─────────────────────────────────────┤
│ ⚑ Sales · Angebot A-17 senden?          wartet seit 12 Min.     ›   │ ◐ Recherche · „Leads Köln"          │
│ ◐ Recherche · Leads Köln       2/4 · 1:42 · 0,08 €  [Stopp]     ›   │ Auftrag von Head of Sales (09:40)   │
│ ◐ Content · LinkedIn-Woche     1/3 · 0:20 · 0,02 €  [Stopp]     ›   │ Zeitleiste                          │
│ ✓ Power Hour vorbereitet       08:01 · 2:10 · 0,11 €            ›   │  09:40 gestartet                    │
│ ✓ Morgen-Briefing (Takt)       07:00 · 0:35 · 0,04 €            ›   │  09:41 crm_suche (12 Treffer)       │
│ ✕ Board-Pack                   06:30 · Fehler: Guthaben  [Neu]  ›   │  09:42 web_suche (gekapselt)        │
│ ⏸ Newsletter-Entwurf           pausiert (Business-frei)         ›   │  ◐ Schritt 3: Firmen prüfen         │
│ ─ Geplant ─                                                          │ Kosten bisher 0,08 € / Grenze 0,50 €│
│   Mo 07:00 Morgen-Briefing · Mo 07:30 Power Hour · Fr 16:00 Rückbl. │ [Thread öffnen] [Stopp] [Neu starten]│
└──────────────────────────────────────────────────────────────────────┴─────────────────────────────────────┘

Handy (Reiter „Läuft")
┌──────────────────────────────────┐
│ WARTET AUF DICH (1)          ›   │
│ LÄUFT (2)                        │
│ ◐ Leads Köln · 2/4 · 0,08 €  ›   │
│ ◐ LinkedIn-Woche · 1/3       ›   │
│ FERTIG HEUTE (2) ▸  FEHLER (1) ▸ │
│ ALS NÄCHSTES                     │
│ ! 14:00 Angebot-Frist            │
│   Mo 07:00 Morgen-Briefing       │
└──────────────────────────────────┘
```
- Zustände wie Claude Agent View + Relevance: wartet auf dich · läuft · fertig · Fehler · pausiert (Muster 1, 13).
- **Takt-Läufe erscheinen mit** (Kevins Antwort 8) — gelesen aus `zoe-auftraege`, Head- und Finanzchef-Läufen (Lesemodell `Lauf`, C4).
- **Zeitleiste** je Lauf: welches Werkzeug, wann, gekapselt ja/nein (Relevance-Muster), nie Inhalte Dritter in der Zeile.
- Fehler zeigen den Grund in einem Satz + „Neu starten"; „Guthaben" führt zum Regelwerk-Rückfall statt Stillstand.

---

## 4 · Entscheidungsfragen an Kevin (15)

Jede Frage mit Antwortmöglichkeiten (Marktvorbild in Klammern) und meiner Empfehlung. Mehrfachwahl, wo sinnvoll.

**F1 · Wie heißen die Ebenen in der Oberfläche?**
A) Heads · Mitarbeiter · Threads (Kevins Wort) · B) Leitung · Team · Fäden · C) Abteilungen · Mitarbeiter (Marblism, Motion) · D) Helfer (Sintra) · E) Agenten · Unter-Agenten (Langdock, Claude) · F) Teamleitung · Teammitglieder (Claude Agent Teams) · G) Manager · Worker (Relevance) · H) Koordinator · Threads (Claude Projects) · I) je Instanz umbenennbar
→ **Empfehlung: A + I.** Kevins Begriffe sind schon in den Antworten verankert; umbenennbar je Instanz, weil Kundinnen eigene Wörter mitbringen (Plattform-Regel).

**F2 · Wie sehen Heads und Mitarbeiter aus?**
A) nur Rollenname · B) Kürzel-Kugel in Bereichsfarbe (Design `TIEF`) · C) Vorname + Rolle wie Sintra („Soshie, Social Media") · D) Foto-Avatar (Marblism) · E) Emoji (Langdock) · F) eigene Farbe + Ton je Head (Kevins Antwort 10) · G) kleine ZOE-Kugel-Variante je Head · H) Vorname frei je Instanz
→ **Empfehlung: B + F + H.** Gesichter verkaufen (Sintra), aber ohne erfundene Personen im Code; Vorname optional in den Einstellungen der Instanz.

**F3 · Was zeigt die Mitte, wenn ich die Agenten-Seite öffne?**
A) Überblick-Karte + ZOE-Chat (Kevins Antwort 1) · B) nur ZOE-Chat, leer · C) Kurz-Briefing als Text oben (wie früher ChatGPT Pulse) · D) „Wartet auf dich" als erste Karte (Agent View) · E) Agenten-Inbox der fertigen Ergebnisse (HubSpot) · F) ZOE schlägt Arbeit für heute vor (Claude Projects) · G) Jahresziele-Fortschritt · H) Kanban der Läufe (Relevance)
→ **Empfehlung: A mit C oben und F als „Vorschläge"-Zeile.** „Wartet auf dich" gehört nach rechts oben (F4), sonst doppelt.

**F4 · Aufbau der rechten Spalte**
A) Läuft/Fertig + Als Nächstes (C2) · B) **Wartet auf dich** · Läuft · Als Nächstes (Agent View) · C) nur Inbox mit Ungelesen (HubSpot) · D) Zeitleiste aller Läufe (Relevance) · E) Kalender-Ansicht der geplanten Läufe · F) Eisenhower-Matrix für Als Nächstes · G) Kosten-Zähler ganz oben · H) „Fertig" und „Fehler" eingeklappt
→ **Empfehlung: B + H**, Als Nächstes nach Eisenhower sortiert (Kevins Antwort 9), Kosten in die Kopfleiste (F10).

**F5 · Wie entsteht ein neuer Mitarbeiter?**
A) nur aus Vorlagen (Sintra: fest) · B) beschreiben → Builder fragt nach → Plan bestätigen (Langdock, Notion, Microsoft, OpenAI) · C) leeres Formular · D) ZOE/Head schlägt vor → Stapel (Kevins Antwort 4) · E) Duplizieren und anpassen (HubSpot klonen, Notion duplizieren) · F) aus einem gelungenen Thread ableiten (Devin Playbook) · G) Import einer Agenten-Datei · H) Marktplatz (Microsoft Agent Store, HubSpot Marketplace)
→ **Empfehlung: A + B + D + E jetzt**, F in Version 2, G/H erst für Kunden-Instanzen (Einfallstor, C9 Risiko 4).

**F6 · Dürfen Mitarbeiter mehreren Heads helfen?**
A) nein, je Head eigene · B) ja, geteilt mit Zugriff je Head (Langdock: Zugriff auf Unter-Agent nötig) · C) „Springer"-Pool, den jeder Head beauftragen kann · D) Mitarbeiter gehören ZOE, Heads leihen sie · E) Kopie je Head (Notion duplizieren) · F) Mitarbeiter schreiben einander direkt (Agent Teams) · G) nur über den Head des anderen Bereichs · H) geteilt, aber Werkzeuge immer die Schnittmenge mit dem beauftragenden Head
→ **Empfehlung: B + H.** Kevin will „geteilt über mehrere Heads"; die Schnittmenge hält den Datenausschnitt des Bereichs ein. F nicht: Kosten und Kontrolle (Agent Teams empfiehlt 3–5 Mitglieder).

**F7 · Wie sieht der Autonomie-Regler aus?**
A) Stufe je Head (Kevins Antwort 12) · B) drei Stufen je Werkzeug-Gruppe: Auto · Freigabe · Agent entscheidet (Relevance) · C) zwei Stufen je verbundenem Konto (Lindy) · D) mehr Freiheit erst nach guter Annahmequote (Heads heute) · E) Höchstzahl Auto-Läufe je Tag (Relevance) · F) Kind-Läufe vor dem Start freigeben (Devin) · G) alles immer freigeben (Marblism) · H) fest: Lesen frei · intern frei mit Rückgängig · nach außen immer Klick (MAKE heute)
→ **Empfehlung: H als Boden + A (nur verschärfen) + D + E.** „Agent entscheidet" (B) nicht für Schreibendes — widerspricht Regel 3.

**F8 · Freigaben am Handy**
A) neutraler Hinweis per Telegram/WhatsApp mit Link (heute) · B) Web-App/PWA mit Push · C) eigene App (Kevins Idee) · D) Wischen mit dem Daumen für risikoarme · E) Sammel-Freigabe „alle risikoarmen" · F) Risiko-Ampel vor dem Klick (Forge Remote) · G) Freigabe direkt im WhatsApp-Chat per Knopf · H) Sprach-Freigabe („ja, senden")
→ **Empfehlung: A + B + D + E + F.** G nur für risikoarme (Inhalt im Kanal = Datenschutz-Frage); H nicht — zu leicht ungewollt.

**F9 · Wann kommt ein Push?**
A) nur, wenn eine Entscheidung nötig ist (Claude „Push bei nötiger Aktion") · B) auch, wenn ein langer Lauf fertig ist · C) wenn der Agent es für wichtig hält (Claude zweiter Schalter) · D) nur Tageszusammenfassung 7 Uhr · E) Schwellen je Head · F) Erinnerung, wenn eine Freigabe > X Std. offen ist (Relevance-Timeouts) · G) nie außerhalb der Arbeitszeit/Business-frei · H) gar kein Push, nur Glocke
→ **Empfehlung: A + B + F + G**, C als zweiter Schalter je Person (Standard aus).

**F10 · Kosten und Budget**
A) nur anzeigen im Messmonat (ROADMAP) · B) Monatsgrenze je Head mit Warnung 80/95 % (Langdock) · C) Grenze je Lauf (Langdock, Devin ACU) · D) Kostenschätzung vor großen Aufträgen (Kevins Antwort 14) · E) Grenze für die ganze Instanz · F) Euro statt Credits · G) bei Grenze Regelwerk-Rückfall statt Sperre · H) Budget-Balken in der Kopfleiste · I) Kosten je Ergebnis („0,11 € je gewonnenem Termin")
→ **Empfehlung: A + C + D + F + G + H sofort**, B und E nach dem Messmonat, I in der Leistungs-Karte.

**F11 · Wie messen wir die Leistung eines Heads oder Mitarbeiters?**
A) Daumen je Antwort (Langdock, Copilot) · B) Annahmequote der Vorschläge (Heads heute) · C) Ergebnis-Kategorien erledigt · eskaliert · abgebrochen (Copilot Studio) · D) Erfolgsquote je Skill (Kevins Antwort 7) · E) Wirkung auf die Kennzahl des Bereichs (Business-Index-Säule) · F) Kosten je Ergebnis · G) Coaching-Vorschläge „was verbessern" (HubSpot) · H) monatlicher „Review" von ZOE als Bericht · I) Testsuite/Evals vor jeder Änderung (Heads heute, Relevance Monitor)
→ **Empfehlung: A + B + D + F + H + I.** E als Hinweis, nicht als Note (Ursache schwer zuzuordnen). Nie Menschen bewerten (KI-VO).

**F12 · Gedächtnis der Agenten**
A) je Agent und Person getrennt (Dust) · B) Ebenen Persönlich · Haushalt · System (Lindy) · C) als Brain-Notizen im Vault · D) Obergrenze je Agent (Langdock 50) · E) Agent lernt selbst, alles sichtbar und löschbar · F) neue Einträge nur per Freigabe (Merksätze heute) · G) Mitarbeiter erben das Gedächtnis ihres Heads · H) automatische Lösch-Frist (Apple 30 T./1 J./nie)
→ **Empfehlung: B + E + F für Haushalts-Ebene + G + H.** Persönliches Gedächtnis darf der Agent selbst anlegen (sichtbar), Haushalts-Gedächtnis nur mit Klick (wirkt auf beide Personen).

**F13 · Wem gehören Business-Threads und Business-Skills?**
A) Threads der Person, wie ZOE heute · B) alle Business-Threads für das Team lesbar (geteilte Claude-Projekte) · C) persönlich, per Knopf teilbar · D) Ergebnis geteilt, Verlauf privat · E) geplante Läufe landen in einem gemeinsamen Raum (Dust Pods) · F) Skills gehören dem Haushalt, Anleger nur vermerkt · G) Skills gehören der Person, teilbar · H) bei Konto-Löschung gehen Business-Skills an den Inhaber (gegen Notion: „stoppt nach 7 Tagen")
→ **Empfehlung: C + E + F + H.** Deckt C10/Frage 2 und 3 mit Marktvorbildern ab.

**F14 · Was steht sichtbar in der Kopfleiste, was im Menü?**
A) alle acht Wünsche als Knöpfe · B) „+ Neu ▾" bündelt Auftrag, an mehrere Heads, Hintergrundaufgabe, Mitarbeiter, Skill · C) Freigaben (n) sichtbar · D) Geplant sichtbar · E) Leitplanken sichtbar · F) Modell & Aufwand sichtbar · G) Budget-Balken sichtbar · H) Not-Aus sichtbar · I) Modell & Aufwand nur in den Einstellungen je Head (Teil B4)
→ **Empfehlung: B + C + D + G + H + I**, Leitplanken unter „⋯". Begründung: eine Hauptaktion je Ansicht (Design-Standard), Not-Aus muss sofort erreichbar sein.

**F15 · Sprache und Handy**
A) Diktat im Eingabefeld (Mikro-Knopf) · B) Vorlesen der Antwort (Kevins Antwort 15) · C) Sprachmodus in Echtzeit (ChatGPT Voice, Gemini Live) · D) Sprachnachricht per WhatsApp an ZOE → Aufgabe/Notiz (gebaut) · E) Siri-Kurzbefehl „Sag ZOE …" · F) eigene Telefonnummer für ZOE (Lindy, Marblism-Empfang) · G) eigene App (Kevins Idee) · H) PWA zum Installieren · I) Heads direkt per WhatsApp ansprechen („@Sales …")
→ **Empfehlung: A + B + D + E + H jetzt**, I als nächster Schritt (gleiche Freigabe-Regel, Muster 15), C/F/G später — Echtzeit-Sprache kostet und braucht einen eigenen Datenschutz-Check (Stimme).

---

## 5 · Quellen (abgerufen am 08.10.2026)

**Claude / Anthropic**
- [O] Projects neu (17.09.2026): https://claude.com/blog/projects-redesigned
- [O] Agent View (11.05.2026): https://claude.com/blog/agent-view-in-claude-code
- [O] Scheduled Tasks in Cowork: https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- [O] Skill im Gespräch erstellen: https://academy.claude.com/tutorials/how-to-create-a-skill-with-claude-through-conversation
- [S] Agent Teams: https://code.claude.com/docs/en/agent-teams
- [S] Routines: https://code.claude.com/docs/en/web-scheduled-tasks
- [S] Dispatch: https://claude.com/docs/cowork/guide/dispatch · https://www.tomsguide.com/ai/i-sent-claude-a-task-from-my-phone-and-it-finished-it-on-my-laptop-without-me-touching-a-thing
- [S] Push-Schalter Remote Control: https://wmedia.es/en/tips/claude-code-notifications-on-your-phone
- [S] Forge Remote (Risiko-Einstufung): https://apps.apple.com/dk/app/forge-remote/id6760141378
- [S] Agent View Zustände (Drittquelle): https://dsebastien.net/claude-code-agent-view-one-screen-for-every-background-session/

**ChatGPT / OpenAI** (openai.com am 08.10. mit 403)
- [S] Scheduled-Seite, Pulse eingestellt (18.06.2026): https://gigazine.net/gsc_news/en/20260619-chatgpt-scheduled-tasks/
- [S] workspace agents (22.04.2026): https://openai.com/index/introducing-workspace-agents-in-chatgpt/ · https://www.vktr.com/digital-workplace/openai-launches-workspace-agents-for-enterprise-workflow-automation/
- [S] ChatGPT Work + GPT-5.6: https://the-decoder.com/openai-pairs-its-gpt-5-6-public-rollout-with-chatgpt-work-a-new-agent-that-handles-entire-workflows/ · https://consulting.sva.com/insights/chatgpt-work-explained-a-guide-to-the-new-workspace-and-gpt-5.6-models
- [S] ChatGPT agent, Zeitpläne, Kontingente: https://help.openai.com/articles/11752874

**Langdock**
- [O] Agenten: https://docs.langdock.com/en/using-langdock/agents/introduction.md
- [O] Agent Builder: https://docs.langdock.com/en/using-langdock/agents/agent-builder.md
- [O] Sub-Agenten: https://docs.langdock.com/en/using-langdock/agents/subagents.md
- [O] Aktionen/@ im Chat: https://docs.langdock.com/en/using-langdock/chat/tools/actions-in-chat.md
- [O] Scheduled: https://docs.langdock.com/en/using-langdock/chat/scheduled.md
- [O] Human in the loop: https://docs.langdock.com/en/using-langdock/workflows/fundamentals/human-in-the-loop.md
- [O] Kosten: https://docs.langdock.com/en/using-langdock/workflows/guides/cost-management.md
- [O] Gedächtnis: https://docs.langdock.com/en/using-langdock/chat/tools/memory.md
- [S] Usage Insights + Feedback: https://docs.langdock.com/en/using-langdock/agents/usage-insights
- [S] Skills-FAQ: https://docs.langdock.com/en/using-langdock/guides/skills/faq
- [S] EU/ISO/SOC 2/Self-Host: https://www.langdock.com/langdock-for-enterprise · https://langdock.com/dpa

**Sintra · Marblism · Motion · Lindy · Relevance · Tycoon**
- [W] https://sintra.ai/ · [S] https://www.eesel.ai/blog/sintra-ai-review · https://lindy.ai/blog/sintra-ai-review (Wettbewerber) · https://www.practica.vc/en/news/lithuanian-ai-startup-sintra-secures-17m-seed-empowering-smes-with-ai-helpers
- [W] https://www.marblism.com/ · [S] https://crevio.co/blog/marblism-review
- [S] Motion: https://www.usemotion.com/help/ai-employees (am 08.10. 404) · https://usemotion.com/help/time-management/inbox/inbox-how-to-guide · https://sacra.com/chat/h/17bff60f-91e5-440f-a7ef-e782921f224c/
- [O] Lindy: https://docs.lindy.ai/teammate/setup.md · https://docs.lindy.ai/teammate/memory.md · https://docs.lindy.ai/teammate/routines.md · [S] https://automationatlas.io/guides/moxo-vs-lindy-2026/
- [O] Relevance: https://relevanceai.com/docs/build/workforces/workforce-features/approvals-and-escalations · https://relevanceai.com/docs/build/workforces/workforce-features/workforce-task-view.md · [S] https://relevanceai.com/posts/2026-03-13-agent-performance-observability-monitor-your-ai-age · https://relevanceai.com/blog/introducing-workforce-the-visual-canvas-for-building-ai-teams
- [S] Tycoon: https://www.producthunt.com/products/tycoon-us

**Microsoft · HubSpot · Salesforce · Notion · Dust · Mistral · Manus · Devin**
- [S] Copilot Studio Effectiveness: https://learn.microsoft.com/microsoft-copilot-studio/analytics-improve-agent-effectiveness · Aktivität: https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-review-activity
- [S] Agent Builder: https://support.microsoft.com/en-us/microsoft-365-copilot/build-your-own-agent-with-microsoft-365-copilot
- [S] Agent 365: https://venturebeat.com/ai/microsofts-agent-365-shifts-ai-agents-from-sandbox-tools-to-enterprise-grade · https://spaces.collab365.com/posts/microsoft-adds-dashboard-and-shadow-detection-for--2f7_26
- [O] HubSpot Agent Builder: https://knowledge.hubspot.com/ai/use-assistants-and-agents-in-breeze-studio · Agent Inbox: https://knowledge.hubspot.com/ai/review-agent-output · [S] Customer Agent Leistung: https://knowledge.hubspot.com/customer-agent/analyze-your-customer-agents-performance
- [S] Salesforce Observability: https://www.salesforce.com/blog/command-center/ · https://new.salesforcedevops.net/posts/salesforce-makes-agent-observability-ga-extending-the-agentic-sdlc · Slack: https://salesforce.com/slack/agentforce
- [O] Notion Custom Agents: https://www.notion.com/help/custom-agent · [S] Rechte/Eigentümer: https://www.notion.com/help/custom-agents-sharing-and-permissions
- [O] Dust: https://docs.dust.tt/docs/user-documentation/pods/overview.md · https://docs.dust.tt/docs/user-documentation/agents/tools/agent-memory.md · https://docs.dust.tt/analytics.md · https://docs.dust.tt/docs/user-documentation/agents/triggers/schedules.md · https://docs.dust.tt/docs/user-documentation/admins/admin-governance/eu-hosted-models.md
- [S] Mistral: https://mistral.ai/fr/news/le-chat-mcp-connectors-memories · https://docs.mistral.ai/agents/tools/built-in/document_library
- [S] Manus: https://emergent.sh/learn/manus-ai-review · https://aitoolsradar.org/blog/reviews/manus-ai-review-2026/
- [O] Devin: https://docs.devin.ai/work-with-devin/advanced-capabilities · [S] https://releasebot.io/updates/devin/devin-desktop

**Google · Apple**
- [S] Personal Intelligence (14.01.2026): https://blog.google/innovation-and-ai/products/gemini-app/personal-intelligence · https://mobilesyrup.com/2026/04/14/google-personal-intelligence-gemini-app-canada/
- [S] Scheduled Actions: https://blog.google/products/gemini/scheduled-actions-gemini-app/
- [S] Google Home I/O 2026: https://developers.home.google.com/io/2026
- [S] Siri AI / iOS 27: https://letsdatascience.com/news/apple-releases-ios-27-with-siri-ai-8b44349e · https://www.macwelt.de/article/3107838/apple-ios-27-test-freie-wildbahn.html · https://www.mactrast.com/2026/06/ios-27-users-could-be-forced-to-wait-in-line-for-new-siri-features/

**Interne Bezüge:** `AGENTEN_KONZEPT.md` (Teil A–C), `ENTSCHEIDUNGEN_FRAGEBOGEN.md` › Agenten-Bereich, `research/ai-ceo/VERIFIZIERT*.md`, `research/ai-ceo/P03-auszug.md`.
