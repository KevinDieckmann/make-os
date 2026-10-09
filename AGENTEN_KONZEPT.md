# MAKE OS — Agenten-Bereich neu: Bestand, Markt, Zielbild, Bauplan

**Stand:** 08.10.2026 spät · nur Konzept, nichts gebaut · Grundlage für die nächste Klickrunde und den Bau über Nacht
**Auftrag (Kevin, 08.10. spät, zusammengefasst):** Den Agenten-Bereich in Business und Privat aufs nächste Level bringen,
direkt und systematisch mit den Agenten chatten. Grundstruktur von Claude, aber eigen. Seite: links die gespeicherten Heads,
oben Aktionen (z. B. „neuen Skill anlegen“), Mitte ZOE, die die Heads steuert, rechts oben die Hintergrundaufgaben, rechts
unten das, was als Nächstes kommt. Skills je Head speichern. Ein Klick auf einen Head öffnet den Chat mit ihm, und er sieht nur
die Daten seines Bereichs. Im Head-Chat lassen sich einzelne „Mitarbeiter“ ansprechen. Der Head steuert sie und berichtet wie
Claude über Threads. Mit jedem Mitarbeiter kann man einzeln sprechen.

> **Gilt zusammen mit:** CLAUDE.md (Regeln, vor allem Plattform-Regel, Trennung serverseitig, Regeln 3, 5, 6, 7, KI-Tor),
> `AI_CEO_MODUL.md` (Teil D3 KI-Führungsteam — **Kevins neuer Wunsch ändert D3.3:** Dort heißt es noch: „Heads sprechen nicht
> direkt mit dem Menschen, sie berichten an ZOE“. Jetzt soll man direkt mit jedem Head und jedem Mitarbeiter sprechen können.
> Nach Kevins Bestätigung muss D3.3 angepasst werden.) und `ROADMAP_Q4.md` (ZOE zuerst feinjustieren).

---

## Kurzfassung

- **Viel ist schon da**, aber verteilt:
  - ZOE mit rund 66 Werkzeugen, Stapel (Freigaben), Takt und Warteschlange, dauerhaften Entscheidungen, KI-Tor und Agenten-Log je Person.
  - Drei Heads (Sales, Marketing, Event) mit Grundlauf, Prüfer, Lernen, Gedächtnis, Autonomie und Evals, dazu der Head of Finance.
  - Etwa 20 Fach-Agenten, die ZOE starten kann.
- **Es fehlt der Kern dessen, was Kevin beschreibt:**
  - Ein Chat mit Verlauf je Head. Heute gibt es dort nur eine einzelne Frage ohne Verlauf.
  - Threads und Mitarbeiter als ansprechbare Unter-Agenten.
  - Skills.
  - Eine sichtbare Liste „Läuft / Fertig“.
  - Eine Vorschau „Als Nächstes“. Der Takt kennt heute nur, was *jetzt* fällig ist.
  - Privat-Heads.
- **Markt (Stand Okt. 2026), drei Lehren:**
  1. Die Hierarchie ist sichtbar, und man kann jede Ebene direkt ansprechen. Der Koordinator leitet die Arbeit in Threads weiter und berichtet zurück. Vorbilder: Claude Projects (Beta seit 17.09.), Claude Code Agent Teams, Devin.
  2. Skills folgen der „schrittweisen Offenlegung“: Name und Beschreibung stehen immer im Kontext, die Anleitung wird erst bei Bedarf geladen, und Tests kommen zuerst.
  3. Freigaben gelten je Werkzeug. Ab etwa 30–40 Werkzeugen wählt ein einzelner Agent schlechter, deshalb bekommt jeder Head nur seine eigenen Werkzeuge.
- **Vorschlag:** ein Paket 0 (Schnittstellen-Vertrag, etwa 1 Stunde), danach drei parallele Pakete über Nacht in getrennten Branches:
  - (1) `agenten-kern`: Datenmodell, Server, Rechte, Head-Chat und Delegation.
  - (2) `agenten-seite`: Oberfläche.
  - (3) `agenten-skills`: Skills, Hintergrundaufgaben, „Als Nächstes“ und Takt.
  - Danach Paket 4 nacheinander: ZOE mit den Heads verdrahten, Streaming, ZoePanel auf Threads umstellen.

---

# Teil A — Was es schon gibt (im Code geprüft, 08.10.2026)

## A1 · ZOE-Gespräch
- **Route `app/api/kimmi/route.ts`** (817 Zeilen), die einzige Gesprächsroute:
  - **Ablauf:**
    - `modellSchranke` begrenzt auf 40 Züge in 10 Minuten.
    - `personStreng` muss eine Person liefern, und die Person muss im Haushalt des Inhabers sein.
    - KI-Schalter und Gesundheits-Einwilligung (b) werden geprüft.
    - `gatherBrain` liefert den Live-Zustand, `liesFakten` das Gedächtnis, `brainAnweisung` die Grundlage aus dem Vault.
    - Der System-Text ist neutral (seit 08.10. `vornameVon`, `gesellschaftenSatz`, `anredeSatz`).
  - **Werkzeug-Schleife:** höchstens 3 Runden, 8 Agentenläufe und 14 Werkzeuge je Zug. Ausgeführt wird parallel über `fuehreAus` (Werkzeuge) bzw. `runAgent` (Agenten).
  - **Schutz vor fremdem Text:**
    - `fremd()`-Kapselung.
    - `nurVorschlag` nach Fremdtext und `agentNurVorschlag`.
    - Web-Agenten laufen nach vertraulichem Lesen nur als Vorschlag (`lib/zoe/gespraech-schutz.ts`).
  - **Antwort:** `{ reply, handoffs, ran, stapelOffen, ki }`. **Kein Streaming**: Die Antwort kommt erst nach allen Runden (Zeitgrenze 180 s je Modellaufruf).
  - **Werkzeuge:** rund 45 direkt in der Route, dazu 18 CRM-, 2 Aufgaben- und 1 Such-Werkzeug (`lib/zoe/crm-werkzeug-defs.ts`, `aufgaben-werkzeuge.ts`, `arbeit-werkzeug.ts`). Zusammen sind das **etwa 66 Werkzeuge in einem Prompt**.
- **Verlauf:**
  - `lib/make-one/zoe-verlauf.ts` und `app/api/state/zoe-verlauf/route.ts`, ein Bestand `zoe-verlauf` mit Feld `person`.
  - Grenzen: 80 Gespräche, 240 Nachrichten, 8.000 Zeichen.
  - **Aber:** Der Prompt nimmt den Verlauf aus dem Browser-Körper (`payload.verlauf`), nicht aus dem Speicher. Damit hängt auch „fremd gelesen“ (`verlaufFremd` über `ran`) an Angaben aus dem Browser.
- **Oberflächen:**
  - `components/os/ZoePanel.tsx` (667 Zeilen): Fenster auf jeder Seite, Stimme, Gespräche.
  - `components/os/ZoeStart.tsx` (Empfang `/zoe`, Kugel, Stimme).
  - `components/os/ZoeReiter.tsx`: Reiter „Freigaben · Agenten · Loops · Brain · Empfang“ (`ZOE_BEREICH` in `lib/make-one/spaces.ts`).

## A2 · Werkzeuge, Register, Stapel, Entscheidungen, Protokoll
- **`lib/zoe/register.ts`** (60 Einträge):
  - Risiko je Werkzeug `frei | freigabe | nie`. `risikoFuerAufruf` kann die Stufe je Aufruf nur verschärfen.
  - Trockenlauf (`vorschau`: titel, vorher, nachher, zurueck).
  - Die **Stufe gehört zum Werkzeug, nicht zum Modell.**
  - Gruppen u. a. markttraktion (17), gesundheit (7), kontakte, finanzen, haushalt, aufgaben, wissen, kalender, gedaechtnis, business, inbox, fokus, bauplan, auftraege.
- **`lib/zoe/ausfuehren.ts` `fuehreAus`:** die einzige Stelle zur Wirkung. Sie prüft Risiko, Trockenlauf, Stapel, Protokoll und KI-Sperre (`werkzeugSperre`).
- **Stapel (`lib/zoe/stapel.ts`):**
  - Vorschläge mit vorher und nachher.
  - `beanspruche` → `entscheide` → `loslassen`.
  - Arten mit eigenem Bezug: `aufgabe | crm | kalender` (`lib/zoe/stapel-arten.ts`).
  - Sichtbar über `vorschlagSichtbar`.
  - Oberfläche `/os/stapel` (`StapelView.tsx`): Reiter Offen und Protokoll. Die Freigabe-Listen der Heads und des Finanzchefs stehen dort mit.
- **Entscheidungen (`lib/zoe/entscheidungen.ts`):** dauerhaft, nur anhängend, `zoe-entscheidungen--<haushalt>--<JJJJ-MM>`, mit `entschiedenVon`.
- **Protokoll** (`lib/zoe/protokoll.ts`, nur Kennungen und Feldnamen) und **Verbrauch** (`lib/zoe/verbrauch.ts`, je `zweck` und Modell, mit Cache-Anteil; wird in `lib/anthropic.ts` erfasst).

## A3 · Aufträge, Arbeiter, Takt
- **Warteschlange `lib/zoe/auftraege.ts`:**
  - Bestand `zoe-auftraege`.
  - Arten `werkzeug | agent`, Status `offen | laeuft | fertig | fehler`.
  - Idempotenz-Schlüssel, Pacht mit Token, 3 Versuche, Feld `person`.
  - Route `/api/zoe/auftraege` (GET zeigt nur eigene und Systemaufträge), dazu `/nimm` und `/lauf`.
  - ZOE reiht über `starte_auftraege` ein.
- **Arbeiter `worker.mjs`:**
  - Eigener Prozess, ruft jede Minute `/api/zoe/takt` auf und holt Aufträge ab.
  - Höchstens 2 parallel auf kleinen Maschinen (`MAX_PARALLEL`), der Server hat 1 vCPU.
- **Takt `lib/zoe/takt.ts` `faellig()`:**
  - Plant nur, was **jetzt** fällig ist: Durchsicht, Absichten, Gesundheits- und Markttraktion-Takt, HOI, Konsolidierung, Löschfristen, Morgenlauf, ZOE-Aufgaben, Abendlauf, Selbstbild, Finanzchef, Heads, Tageslauf, Verbesserung.
  - `KI_LAEUFE` ruhen, wenn die Hintergrund-KI aus ist.
  - Nach einem Fehler wird `wartenNachFehler` abgewartet.
- **Loops:** `/os/loop` (`LoopView.tsx`, `/api/loop`) mit morgen, woche, rückblick, finanzen, sales u. a.

## A4 · Gedächtnis, Selbstbild, Grundauftrag, Brain
- **`lib/zoe/gedaechtnis.ts`:** Fakten je Raum (Person oder gemeinsam), höchstens 1.800 Zeichen im Prompt; `fakt_merken` läuft immer über den Stapel.
- **`lib/zoe/selbstbild.ts`:** rechnet aus Verzeichnis und Register, was die Software über sich weiß.
- **`lib/zoe/grundauftrag.ts`:** neutrale Bausteine (Vorname, Gesellschaften, Anrede).
- **Brain:** Vault, Suche (`suche`, `suche_arbeit`), Regeln nur mit `freigegeben_von` einer bekannten Person (`regelnFuerPrompt`). Das ist das einzige heutige Muster für **„Anweisungen, die Menschen schreiben und freigeben“** und damit das Vorbild für Skills.

## A5 · Agenten-Verzeichnis, Seite, Schalter, Log
- **`lib/make-one/agents-data.ts`:**
  - Statisches Organigramm mit 7 Abteilungen (`DEPARTMENTS`) und je Agent `status`, `autonomy`, `model`, `funktionen`, `bauplan`, `href`.
  - `agentRoster()` geht in den ZOE-Prompt.
- **Seite `/os/agenten`** (`app/os/agenten/page.tsx` → `components/os/AgentenView.tsx`):
  - Agenten-Score, „Zuletzt gelaufen“, das Hirn (`AgentenHirn.tsx`) und Abteilungs-Karten mit Reglern.
  - **Kein Chat, keine Läufe, keine Vorschau.**
- **Schalter `agents-config`** (`app/api/state/agents/route.ts`, PUT nur Inhaber): `lib/agent-config.ts` `resolveAgent`, Modellstufen schnell, ausgewogen und stark (Haiku 4.5, Sonnet 5, Opus 5.5). Sie gelten für ZOE, Takt und direkte Aufrufe.
- **Agenten-Log `lib/agent-log.ts`:** seit 08.10. je Person (`laufSichtbar`). **Höchstens 200 Einträge, Älteres wird abgeschnitten.** Für eine Rückschau „Was ist passiert“ reicht das nicht.

## A6 · Fach-Agenten (`lib/zoe/agenten.ts` `runAgent`)
- `AUSFUEHRBAR`: research, board, okr, controlling, finanzchef, fokus, kalender, inbox, task, prospect, planung, ernaehrung, performance, content, meeting, outreach, crm, head-sales, head-marketing, head-event, dazu 14 Systemläufe.
- Jeder Fach-Agent ist **ein Einmal-Lauf** über eine eigene Route, mit `x-make-person` und `hintergrundKopf`. Ergebnis ist Text, halbfertige Ergebnisse gehen als Vorschlag in den Stapel (`stapleAlle`).
- Eigene Formularseiten: `/os/research`, `/os/content`, `/os/meeting`, `/os/board`, `/os/prospecting`.

## A7 · Heads Sales, Marketing, Event (`lib/heads/*`, Route `app/api/heads/[head]/route.ts`)
- **Ein Lauf** (`lauf.ts`) hat diese Schritte:
  1. Das volle Datenpaket (`paket.ts`) wird zusammengestellt.
  2. Der Grundlauf (`grundlauf.ts`) arbeitet ohne Modell.
  3. Das Modell (JSON-Schema, gecachtes System) übernimmt, verwirft oder ergänzt.
  4. Der Prüfer (`pruefer.ts`) prüft, mit genau einer Korrekturrunde.
  5. `pflichtZurueck` holt verworfene Pflicht-Vorschläge zurück.
  6. Belege werden angehängt.
  7. Autonomie (`autonomie.ts`): interne Kleinigkeiten übernimmt der Head selbst, mit Rücknahme.
  8. Lernen (`lernen.ts`): Annahmequote, Ablehnungsgründe, Wirkungsleiter, Merksätze als `gedaechtnis`.
  9. Evals (`eval.ts`, pass^k).
- **Modi** (`prompt.ts` `MODI`):
  - Sales: power_hour, lead_review, deal_review, kundenreview, kampagne, wochenreview, frage.
  - Marketing: wochenplan, netzwerk, kampagne, monatsreview, frage.
  - Event: planung, einladung, nachfassen, wirkung, frage.
  - Für Reviews „stark“, sonst „ausgewogen“.
- **Bestand `head-<id>`** (Berichte, Freigabe-Liste mit Dedup, `letzte`, Gedächtnis), Takt in `lib/heads/takt.ts` (`faelligeModi`).
- **Oberfläche:** `components/os/crm/HeadPanel.tsx` in der Markttraktion. Es gibt nur **ein Feld „Frage an den Head“**: Der Modus `frage` ist ein Einzel-Lauf, angezeigt wird nur die Antwort des letzten Berichts. Kein Verlauf, keine Rückfrage.

## A8 · Head of Finance (`lib/finanzen/chef/*`, `app/api/finanzchef/route.ts`, `components/os/FinanzchefView.tsx`)
- Das Finanzbild rechnet Code (`finanzbild.ts`). Es gibt 5 Modi (Tagescheck, Wochenreview, Monatsabschluss, Steuercheck, Frage) und einen kleinen Werkzeug-Kreis (`rechne`, `buchungen_suchen`).
- Der Prüfer prüft Zahlen, Quellen, Fristen und Vollzug. Dazu kommen eine Freigabe-Liste (`finanzchef`, `haushalt-chef--<h>`) und ein Takt (`plan.ts`, `takt.ts`).
- **Den Haushaltsteil gibt es nur für Mitglieder.** Auch hier ist die Frage ein Einzel-Lauf ohne Verlauf.

## A9 · Head of IT (`lib/hoi/*`, `/os/hoi`)
- **Kein KI-Agent:** ein Lagebild aus Zählern (innen, Host, außen) mit Ampeln. Er bleibt so; ein Chat wäre später höchstens eine Schicht über die Zahlen.

## A10 · ZOE-Aufgaben (`Task.zoe`, `lib/aufgaben/zoe.ts`, `lib/zoe/aufgaben-lauf.ts`, `/api/aufgaben/zoe`)
- Status: `offen → in_arbeit → wartet_freigabe → freigegeben | abgelehnt`. Auftraggeberin ist `zoe.von`.
- Ein Lauf am Tag, höchstens 5. Die Ergebnisse gehen nur als Stapel-Art `aufgabe` in den Stapel. **Das ist bereits ein „Auftrag an einen Agenten mit Rückmeldung“ und ein Vorbild für Mitarbeiter-Threads.**

## A11 · KI-Tor, KI-Schalter, Datenschutz der KI
- **`lib/datenschutz/ki-tor.ts`** prüft vor jedem `askText`:
  - Ist die Hintergrund-KI aus?
  - Liegt für Gesundheit Einwilligung (b) vor?
  - Ist der Bereich gesperrt (crm, kalender, aufgaben, finanzen, brain)?
  - Ist die Web-Suche erlaubt?
  - Bei Hintergrundläufen wird pseudonymisiert.
- **Kategorien:** crm, kalender, aufgaben, finanzen, brain, gesundheit, postfach, web, konto, allgemein. **Eine Kategorie „familie“ gibt es nicht.**
- **`lib/datenschutz/ki-werkzeuge.ts`** ordnet jeder Werkzeug-Gruppe eine Kategorie zu (`GRUPPE_KATEGORIE`). **Daraus lässt sich der Datenausschnitt je Head direkt ableiten.**
- **KI-Protokoll** (nur Metadaten), Kennzeichen nach KI-VO Art. 50 (`kiKennzeichen`).

## A12 · Lücken zu Kevins Wunsch (jeweils im Code geprüft)

| Wunsch | Stand heute | Beleg |
|---|---|---|
| Chat je Head mit Verlauf | nur eine einzelne Frage ohne Verlauf | `lib/heads/prompt.ts` (Modus `frage`), `HeadPanel.tsx`, `FinanzchefView.tsx` |
| Heads links auf der Agenten-Seite | Die Heads liegen in der Markttraktion bzw. unter Finanzen; die Agenten-Seite ist ein statisches Organigramm | `AgentenView.tsx`, `agents-data.ts` |
| Skills | **keine.** Verwandte Muster: fest eingebaute Head-Modi, Merksätze (`HeadStand.gedaechtnis`), Kampagnen-Playbooks (`lib/crm/kampagnen.ts`), Brain-Regeln | `grep -i skill` in `lib/`, `app/`, `components/`: nur ein Altbestand-Text |
| Threads und Mitarbeiter | `run_agent` und `starte_auftraege` sind Einmal-Läufe ohne Thread, ohne Rückkanal und ohne direktes Ansprechen | `kimmi`, `lib/zoe/agenten.ts` |
| Mitarbeiter einzeln ansprechen | Fach-Agenten haben Formularseiten, keinen Chat | `ZOE_BEREICH` |
| Hintergrundaufgaben sichtbar | Daten sind da (`zoe-auftraege` mit Status), aber es gibt keine „Läuft / Fertig“-Liste. Head-Läufe hängen im Request (`maxDuration 400`) | `auftraege.ts`, Heads-Route |
| „Als Nächstes“ | Der Takt kennt nur „jetzt fällig“, eine Vorschau fehlt | `takt.ts` `faellig`, `heads/takt.ts` `faelligeModi` |
| Daten nur des Bereichs | Heads: eigenes Paket, gut. ZOE: alle 66 Werkzeuge in einem Prompt | `kimmi` |
| Gespräch wie Claude | kein Streaming; der Verlauf kommt vom Browser | `lib/anthropic.ts`, `kimmi` |
| Privat-Heads | keine. Der Finanzchef hat einen Haushaltsmodus, Gesundheit und Familie sind nur Takte bzw. Fach-Agenten | `lib/finanzen/chef/plan.ts`, `lib/gesundheit/lauf.ts` |
| Budget je Head | Kosten je Head (30 Tage) sind sichtbar, eine Grenze gibt es nicht | Heads-Route `cent`, `verbrauch.ts` |
| Einstellungen je Head | Autonomie und Modell gelten für die ganze Instanz, nur der Inhaber stellt sie | `/api/state/agents` PUT |

## A13 · Plattform-Schulden im Agenten-Bereich (beim Anfassen neutralisieren)
- `kimmi`: Enum `wer: ['kevin','malin','both']` (create_task) und `an: ['kevin','malin','beide']` (uebergeben).
- `lib/heads/prompt.ts`: Der Rahmen nennt „Kevin und Malin“.
- `lib/heads/takt.ts`: `faelligeModi(…, personen = ['kevin'])`.
- `lib/zoe/raum.ts`: `PERSON_LABEL` und `RAUM_LABEL` mit festen Namen.
- `zoe-verlauf`: Altbestand ohne Person fällt auf `kevin` zurück.
- `AGENT_ZWECK` (gesundheit, markttraktion): „schickt Kevin und Malin …“.
- `agents-data.ts`: Texte mit Namen und Firmen-Terminologie (Content-Agent).
- Die Heads lesen das Team aus `lib/crm/team.ts` (`TEAM`, Build-Variable). Das ist richtig für die Instanz, aber kein Konto-Register.

---

# Teil B — Markt (Web-Recherche, abgerufen 08.10.2026)

> **Belastbarkeit:**
> - **[O]** = offizielle Doku bzw. Hersteller-Blog, gelesen.
> - **[S]** = nur Such-Ausschnitt bzw. Drittquelle.
> - **„nicht belegt“** = gesucht, aber keine Quelle gefunden.
>
> Die Produkte ändern sich monatlich. Vor dem Bau einzelne Punkte noch einmal ansehen.

## B1 · Die Produkte im Überblick

| Produkt | Steuerung / Kopfleiste | Hierarchie & Delegation sichtbar | Skills / Wissen je Agent | Hintergrund & Zeitpläne | Freigaben | Kosten / Gedächtnis |
|---|---|---|---|---|---|---|
| **Claude Projects (neu, Beta seit 17.09.2026, Claude Code)** [O] | Ziel und Repo wählen; Umgebung, Connectors, Plugins, Anweisungen und Modell je Projekt | Ein **Koordinator-Hauptchat** leitet Arbeit „wie an einen Chief of Staff“ an neue oder bestehende **Threads** weiter, prüft die Ergebnisse und setzt sie zusammen. Jeder Thread ist einzeln zu öffnen und zu steuern | „Library“ für Dateien und Ergebnisse; **geteiltes Gedächtnis** über alle Threads | Threads laufen in der Cloud weiter, steuerbar auch vom Handy | — | Verbrauch je Projekt; Modell und Effort getrennt für Koordinator und Worker. Die Beschriftung „An einen Thread gesendet“: **nicht belegt** |
| **Claude Projects (klassisch, claude.ai)** [S] | Anweisungen, Wissen, Chats | — | Projektwissen; Chats teilen untereinander keinen Kontext | — | — | Teilen mit Rollen „can use“ / „can edit“ |
| **Claude Code Subagents** [O] | `/agents`; Markdown-Datei mit YAML-Kopf (`name`, `description`, `tools`, `model`, `memory`, `skills`, `background`, `maxTurns`) | Delegation automatisch über die `description` oder ausdrücklich per @-Erwähnung; nur die Zusammenfassung geht zurück; Verschachtelung bis 3 Ebenen | Eigenes Gedächtnis je Subagent (`memory`), Skills vorgeladen | Vordergrund oder Hintergrund (Strg+B), Transkripte bleiben und sind wieder aufnehmbar | Rechte werden geerbt, Werkzeug-Listen erlaubt/verboten | Routing auf günstige Modelle |
| **Claude Code Agent Teams** (experimentell) [O] | Teamleitung plus Teammitglieder; Agenten-Leiste unter der Eingabe | Man kann **mit jedem Teammitglied direkt sprechen**; gemeinsame Aufgabenliste (pending, in progress, completed, mit Abhängigkeiten); Postfach je Agent | Teammitglieder laden Projektkontext und Skills | — | **Nachrichten zwischen Agenten zählen nie als Zustimmung des Menschen**; Hooks `TaskCreated`, `TaskCompleted`, `TeammateIdle` | Kosten steigen linear mit der Zahl der Mitglieder; empfohlen sind 3–5; keine verschachtelten Teams |
| **Agent Skills** [O] | claude.ai: Einstellungen › Fähigkeiten › Skills (ZIP hochladen, „skill-creator“ im Gespräch) [S] | — | `SKILL.md` mit `name` (≤ 64 Zeichen) und `description` (≤ 1.024, was **und** wann, dritte Person). Drei Stufen: Metadaten immer, Inhalt bei Bedarf, Zusatzdateien bei Bedarf. Inhalt < 500 Zeilen, Verweise nur eine Ebene tief, **Tests zuerst (≥ 3)**, mit Haiku/Sonnet/Opus testen. Offener Standard seit 18.12.2025 | — | Sicherheit: nur aus vertrauenswürdiger Quelle, sonst prüfen | — |
| **Claude Code Hooks** [O] | Ereignisse: PreToolUse, PostToolUse, Stop, SubagentStart/Stop, TaskCreated/Completed u. a. | — | — | — | Können sperren, erlauben, Kontext anhängen | — |
| **Claude Cowork „Scheduled“ / Code „Routines“** [S] | Eigene Seite „Scheduled“ in der Seitenleiste; `/schedule` | — | Gespeicherter Prompt (plus Repos und Connectors bei Routines) | Jeder Lauf ist eine eigene Sitzung; Auslöser Zeitplan, API oder GitHub (Routines) | — | Ob Cowork-Aufgaben in der Cloud oder lokal laufen: **Quellen widersprechen sich** |
| **Claude Managed Agents (API)** [S] | Agent, Umgebung, Sitzung, Ereignisse | Mehragenten-Orchestrierung (öffentliche Beta laut Drittquelle) | Gedächtnis-Speicher je Sitzung | Ereignis-Stream, steuern und unterbrechen | — | — |
| **ChatGPT** [S] | Projects (Chats, Dateien, Anweisungen, teilbar); Seite „Scheduled“ für Tasks; GPTs (Anweisungen, Wissen, Fähigkeiten, Actions) | — | Projekt-Gedächtnis „nur in diesem Projekt“ (Drittquellen) | Tasks: Grenzen je Plan; **Tasks in Projekten sehen die Projektdateien nicht** | — | „ChatGPT agent“ ist laut Hilfe-Artikel eingestellt, Nachfolger ist „ChatGPT Work“ (nur Ausschnitt) |
| **Microsoft Copilot Studio** [O, Stand 01.10.2026] | Seite „Agents“ mit **An/Aus je Unter-Agent**; Verweis per „/“ in den Anweisungen | **Child agents** (leicht, im Agenten) vs. **connected agents** (eigenständig, eigenes Modell, wiederverwendbar). Der Haupt-Agent wählt über Name und Beschreibung | Werkzeuge, Anweisungen und Wissen je Unter-Agent | Autonome Auslöser | — | **Ab etwa 30–40 Wahlmöglichkeiten (Werkzeuge, Themen, Agenten) wird die Auswahl unscharf** → aufteilen. Zusätzliche Hops kosten Latenz |
| **Salesforce Agentforce** [S] | Agent Builder: Einstellungen, Konfiguration, Live-Test | **Topics** (Klassifizierungs-Beschreibung, Umfang, „was nicht“) → Actions (Flow, Apex, Prompt) → Anweisungen; Atlas wählt Topic und Action | Topic-Anweisungen | — | „Trust Layer“; Rat: mit einem Topic und einer Action beginnen | — |
| **HubSpot Breeze Agents** [O/S] | Breeze Studio | Fertige Agenten (Prospecting, Customer, Knowledge Base) im CRM | Werkzeug-Typen **Daten holen · Erzeugen · Handeln** | — | „Handeln“ fragt standardmäßig vorher („Review before running this tool“, je Werkzeug abschaltbar); fertige Agenten nicht änderbar | Credits |
| **Notion Custom Agents** [S] | Anlegen in Alltagssprache, Vorlagen | — | Rechte je Agent auf genau die Seiten, Datenbanken und Werkzeuge; Audit-Log | Auslöser: Zeitplan, Slack, Mail, Datenbank-Änderung | — | Credits seit 04.05.2026 |
| **Lindy** [O] | — | Agent-zu-Agent-Nachrichten (Auslöser plus Senden) | — | Auslöser | **„Ask for confirmation“ je Aktion mit Nebenwirkung** | „Agent Swarms“: **offiziell nicht belegt** |
| **Relevance AI** [O, Herstellerdoku] | „Workforce“-Ansicht, **Task-Ansicht für Freigaben** | Manager-Agent mit Sub-Agenten; je Verbindung „When to call this agent“ | — | — | Je Verbindung **Autorun · Approval required · Let agent decide**; Eskalationsregeln in Alltagssprache | — |
| **Dust** [O] | — | Werkzeug `run_agent`: Unter-Agent in eigenem Hintergrund-Gespräch mit frischem Kontext, Ergebnis zurück | Wissen je Agent | — | — | — |
| **CrewAI** [O] | Code | Ablauf „hierarchical“: Manager verteilt nach Rolle und Fähigkeit und prüft die Ergebnisse; Agent = role, goal, backstory | — | — | — | Manager-Modell nötig |
| **Zapier (AI by Zapier)** [S] | Anweisungen, Werkzeuge, Leitplanken | — | Wissensquellen | Auslöser: Chat, Webhook, Zeitplan, Zap; **Aktivitäts-Reiter** | Freigabe je Werkzeug | Kein Gedächtnis über Sitzungen hinweg (MIT-Index 2025) |
| **n8n** [O] | Knoten „AI Agent“ (Modell, Gedächtnis, Werkzeuge) | „Agents“ (Preview) mit Sub-Agenten und höchstens n parallel | — | Workflows | **Menschliche Prüfung je Werkzeug**, Freigabe auch über Slack, Telegram oder WhatsApp | — |
| **Devin** [O, Blog] | — | Koordinator verteilt an „managed Devins“ (je eigene VM); **jedes Kind hat einen eigenen Link und ist direkt ansprechbar** | — | Kinder pausieren oder beenden | — | Rechenverbrauch je Kind sichtbar |
| **Cursor Background/Cloud Agents** [S] | Agents Window | Bis 8 parallel, je eigener Worktree | — | VMs in der Cloud, Aufzeichnung | — | — |
| **Manus Wide Research** [O, Blog] | — | Über 100 parallele Generalisten-Unter-Agenten | — | — | — | Fortschrittsanzeige je Unter-Agent: **nicht belegt** |

## B2 · Muster aus der Forschung
- **Anthropic „Building effective agents“ (19.12.2024) [O]:**
  - Unterschied: Workflows folgen festen Codepfaden, Agenten steuern selbst.
  - Fünf Muster: Kette, Routing, Parallelisierung, **Orchestrator-Worker**, Evaluator-Optimizer.
  - Drei Grundsätze: einfach bauen, Planung sichtbar machen, Werkzeuge sorgfältig beschreiben.
- **Anthropic „Multi-agent research system“ (13.06.2025) [O]:**
  - Lead-Agent plus parallele Subagenten; der Plan wird ins Gedächtnis geschrieben.
  - Jede Delegation braucht **Ziel, Ausgabeformat, Werkzeug- und Quellenhinweise und klare Grenzen**.
  - Der Aufwand richtet sich nach der Frage (1 Agent mit 3–10 Aufrufen bis 10+ Subagenten).
  - **Agenten brauchen etwa 4×, Mehragenten-Systeme etwa 15× die Token eines Chats.** Gewinn: +90,2 % im eigenen Research-Test.
  - Bewertung durch ein LLM mit Rubrik, dazu Prüfung durch Menschen.
  - Läufe setzen nach einem Abbruch am Zwischenstand fort.
  - Schwach bei Aufgaben mit viel gemeinsamem Kontext.
- **LangGraph Supervisor [S]:**
  - Übergaben als Werkzeugaufrufe (`create_handoff_tool`).
  - Supervisor lassen sich verschachteln (Teams aus Teams).
  - Nachteil: Fällt der Supervisor aus, steht alles.

## B3 · Was davon zu MAKE OS passt (Erkenntnisse)
1. **Ein Koordinator, Threads darunter, jede Ebene direkt ansprechbar.** So machen es Claude Projects, Agent Teams und Devin. Das deckt sich 1:1 mit Kevins Bild (ZOE → Head → Mitarbeiter).
2. **Rückmeldung als Nachricht im Eltern-Thread.** Der Bericht kommt als Nachricht in den Eltern-Thread zurück (Dust, Claude Code: nur die Zusammenfassung). Nicht der ganze Verlauf wandert hoch, der Thread bleibt nachlesbar.
3. **Datenausschnitt und Werkzeuge je Head sind Pflicht, nicht nur Ordnung.** Copilot Studio nennt 30–40 Wahlmöglichkeiten als Grenze, ZOE hat heute etwa 66. Heads mit 8–20 Werkzeugen wählen besser, sind billiger (kürzerer Prompt) und datensparsam (KI-Tor-Kategorien je Head).
4. **Freigabe je Werkzeug** ist überall Stand (HubSpot, Zapier, n8n, Lindy, Relevance). MAKE OS hat das bereits besser: Das Risiko gehört zum Werkzeug und wird vom Server erzwungen (`register.ts`). **Nichts Neues bauen, sondern wiederverwenden.**
5. **Skills mit schrittweiser Offenlegung.** Nur Name und Beschreibung stehen immer im Prompt, die Anleitung wird über ein Werkzeug geladen. Grenzen und Tests wie bei Anthropic. **Skills sind Anweisungen:** Sie dürfen nur von Menschen kommen bzw. freigegeben werden (wie die Brain-Regeln heute).
6. **„Scheduled“ und „Aktivität“ als eigene Fläche** (Claude, ChatGPT, Zapier). Bei uns: rechts oben „Läuft / Fertig“, rechts unten „Als Nächstes“.
7. **Tiefe begrenzen.** Agent Teams kennen keine verschachtelten Teams, Anthropic arbeitet mit Lead und Subagenten. Bei uns: ZOE → Head → Mitarbeiter; Mitarbeiter delegieren nicht weiter.
8. **Kosten im Blick.** Wegen des etwa 15-fachen Token-Verbrauchs gilt: Delegation nur, wenn sie sich lohnt; ein Budget je Head; günstige Modelle für Mitarbeiter, das starke nur für Reviews (wie heute bei den Heads).
9. **Agenten-Nachrichten sind nie Zustimmung** (Agent Teams). Das passt zu Regel 3 und zur Stapel-Freigabe nur per Klick einer Person (`entschiedenVon` aus der Sitzung).

## B4 · Empfehlung: Was gehört in die Kopfleiste (oben)?
Der Design-Standard erlaubt eine Hauptaktion je Ansicht. **Die Hauptaktion ist das Eingabefeld** (Senden, 48 px). Die Kopfleiste trägt nur Nebenaktionen:

| Knopf | Warum (Marktvorbild) | Verhalten |
|---|---|---|
| **+ Auftrag** | Claude Projects „briefen“, Devin, Notion-Auslöser | An ZOE, einen Head oder einen Mitarbeiter; „jetzt“ oder „geplant“; legt einen Thread an, der Lauf erscheint rechts oben |
| **+ Skill** | Anthropic: „aus erledigter Aufgabe einen Skill machen“, skill-creator | Drei Wege: (a) **aus diesem Gespräch** (ZOE oder der Head entwirft), (b) aus einer Vorlage (eingebaute Modi), (c) leer. Pflichtfelder: Head, Name, Beschreibung (was und wann), Werkzeuge (Auswahl aus denen des Heads), Auslöser, **3 Testfälle**. Dann **„Probelauf“** (ohne Wirkung, alles nur Vorschau) und **„Aktivieren“** per Klick |
| **Zeitpläne** | Claude/ChatGPT „Scheduled“ | Liste aller geplanten Läufe (Takt, Heads, Skills): pausieren oder anpassen, sofern erlaubt |
| **Freigaben (n)** | Relevance Task-Ansicht, HubSpot Review | Zahl der offenen Freigaben, Sprung nach `/os/stapel` |
| **⋯** | Copilot Studio Agents-Seite | Verbrauch je Head (30 Tage), Einstellungen (die bisherigen Regler aus `AgentenView`: an/aus, Autonomie, Modell), Protokoll |

**Bewusst nicht in der Kopfleiste:**
- Kein eigener Bereichs-Schalter: Der Kopf hat schon „Alles · Privat · Business“, die Liste links folgt `useSpace().wahl`.
- Keine Modellwahl: Sie gehört in die Einstellungen des Heads.
- **„+ Head“** erst in Version 2: eigene Heads aus Bausteinen. Version 1 heißt Heads aus dem Katalog an- und ausschalten, siehe offene Fragen.

## B5 · Quellen (abgerufen am 08.10.2026)
- Claude Projects neu: https://claude.com/blog/projects-redesigned
- Subagents: https://code.claude.com/docs/en/sub-agents
- Agent Teams: https://code.claude.com/docs/en/agent-teams
- Hooks: https://code.claude.com/docs/en/hooks
- Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Skill-Best-Practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Skills in claude.ai [S]: https://support.claude.com/en/articles/12512180-using-skills-in-claude
- Skill im Gespräch erstellen [S]: https://support.claude.com/en/articles/12599426-how-to-create-a-skill-with-claude-through-conversation
- Cowork Scheduled [S]: https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- Routines [S]: https://www.theregister.com/2026/04/14/claude_code_routines/
- Managed Agents [S]: https://platform.claude.com/docs/en/managed-agents/overview
- Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Multi-agent research: https://www.anthropic.com/engineering/multi-agent-research-system
- ChatGPT Tasks [S]: https://help.openai.com/en/articles/10291617-tasks-in-chatgpt
- ChatGPT Projects [S]: https://help.openai.com/en/articles/10169521
- ChatGPT agent [S]: https://help-lb.openai.com/en/articles/11752874-chatgpt-agent
- GPTs [S]: https://openai.com/academy/custom-gpts
- Copilot Studio: https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-add-other-agents
- Agentforce [S]: https://admin.salesforce.com/blog/2024/build-effective-agentforce-agents-for-high-impact-automation
- HubSpot Breeze: https://knowledge.hubspot.com/ai/use-breeze-tools · https://www.hubspot.com/company-news/spring-2025-spotlight-breeze-agents
- Notion [S]: https://matthiasfrank.de/en/notion-custom-agents/
- Lindy: https://docs.lindy.ai/testing/human-in-the-loop.md · https://docs.lindy.ai/skills/by-lindy/talk-with-other-lindy.md
- Relevance AI: https://relevanceai.com/docs/build/workforces/workforce-features/approvals-and-escalations
- Dust: https://docs.dust.tt/docs/run-agent
- CrewAI: https://docs.crewai.com/en/learn/hierarchical-process
- Zapier [S]: https://zapier.com/blog/zapier-agents-is-now-ai-by-zapier.md · https://aiagentindex.mit.edu/2025/zapier-agents
- n8n: https://docs.n8n.io/advanced-ai/human-in-the-loop-tools · https://docs.n8n.io/build/build-and-manage-agents
- Devin: https://cognition.com/blog/devin-can-now-manage-devins
- Cursor [S]: https://www.morphllm.com/cursor-background-agents
- Manus: https://manus.im/blog/introducing-wide-research
- LangGraph Supervisor [S]: https://pypi.org/project/langgraph-supervisor/

---

# Teil C — Zielbild für MAKE OS

## C1 · Begriffe (Oberfläche · Code)
- **ZOE** · `zoe`: Orchestratorin (Chief of Staff).
  - Sieht, was die Person sehen darf, wie heute.
  - Delegiert an Heads, bündelt Freigaben und Berichte.
  - Gibt es genau einmal je Person.
- **Head** · `head`: Leitung eines Bereichs.
  - Bringt mit: Auftrag (ein Satz), Datenausschnitt (KI-Kategorien plus Datenpaket), **Werkzeug-Gruppen** (eine Teilmenge des Registers), 3–5 Kennzahlen, Merksätze, Skills, Mitarbeiter und einen eigenen Chat.
  - Bereich `business` (gehört dem Haushalt) oder `privat` (gehört der Person bzw. dem Haushalt bei Familie und Haushaltsfinanzen).
- **Mitarbeiter** · `mitarbeiter`: Unter-Agent eines Heads mit einer Rolle (z. B. „Kampagnen“, „Content & Social“).
  - Werkzeuge sind eine **Teilmenge** der Werkzeuge des Heads; er kann einen bestehenden Fach-Agenten nutzen (`runAgent`-Kennung).
  - **Delegiert nie weiter** (Tiefe ≤ 2 unter ZOE).
- **Thread** · `faden`: ein Gespräch mit genau einem Agenten (ZOE, Head oder Mitarbeiter).
  - Trägt Verlauf, Status und Eltern-Thread („gesendet aus …“).
  - Der Verlauf liegt **auf dem Server**; der Prompt liest nur dort.
- **Skill** · `skill`: gespeicherte, wiederverwendbare Anleitung bei genau einem Head (optional bei einem Mitarbeiter).
  - Felder: Name, Beschreibung (was und wann), Anleitung, Werkzeuge, Auslöser, Testfälle.
  - **Eingebaute Skills** sind die heutigen Modi der Heads (power_hour, deal_review, …, Finanzchef-Modi): sichtbar, aber nicht änderbar, wie bei den fertigen HubSpot-Agenten.
- **Hintergrundaufgabe** · `lauf`: eine Ausführung mit Status `wartet · läuft · fertig · Fehler`, mit Link auf ihren Thread oder Bericht.
- **Als Nächstes** · `naechstes`: Dazu gehören:
  - geplante Läufe (Takt, Heads, Skills)
  - Fristen
  - offene Freigaben
  - Aufgaben, die bei ZOE liegen
- **Freigabe:** wie heute — der Stapel (`zoe-stapel`) bzw. die Freigabe-Liste des Heads (`head-<id>`, `finanzchef`). **Nur ein Klick einer Person entscheidet.**

## C2 · Seitenaufbau `/os/agenten`

**Breit (ab 1.180 px):**
```
┌ Agenten ─────────── [+ Auftrag] [+ Skill] [Zeitpläne] [Freigaben 3] [⋯] ┐
├───────────────┬────────────────────────────────────┬────────────────────┤
│ TEAM          │ ZOE                                 │ HINTERGRUND        │
│ ◉ ZOE         │ ┌ Überblick ─────────────────────┐  │ Läuft (2)          │
│ Business      │ │ Passiert (24 h) · In Arbeit ·   │  │  ◐ Kampagnen: …    │
│  ● Sales   2  │ │ Nächste Tage (je 3 Zeilen)      │  │  ◐ Research: …     │
│  ● Marketing  │ └─────────────────────────────────┘  │ Fertig (5)         │
│     ↳ Content │  … Verlauf …                         │  ✓ Power Hour      │
│     ↳ Kampagn.│  ▸ An Head of Marketing gesendet:    │  ✕ Board-Pack (…)  │
│  ● Event      │    „Herbst-Kampagne“ ›               ├────────────────────┤
│  ● Finanzen   │  ◂ Bericht aus Thread „Herbst-…“     │ ALS NÄCHSTES       │
│ Privat        │                                      │  Mo 07:00 Power H. │
│  ● Gesundheit │                                      │  Di Frist USt-VA   │
│  ● Planung    │  [ Nachricht an ZOE … @Head  ] (➤)   │  3 Freigaben offen │
└───────────────┴────────────────────────────────────┴────────────────────┘
```
- **Links (Team):**
  - ZOE oben, darunter die Heads nach Bereich.
  - Die Liste folgt dem Kopf-Schalter Alles/Privat/Business und wird **auf dem Server gefiltert**.
  - Punkt je Head: gerade aktiv, offene Freigaben bzw. Zahl der laufenden Threads.
  - Aufgeklappt: Mitarbeiter und die letzten Threads des Heads.
- **Mitte:**
  - Ohne Auswahl: ZOE mit Überblick-Karte und Chat.
  - Mit Head: Kopf des Heads (Auftrag, 3 Kennzahlen, Skills als Chips, Mitarbeiter als Chips) und sein Chat.
  - Mit Mitarbeiter-Thread: dessen Chat mit Brotkrumen „Head › Mitarbeiter › Thread“.
- **Ansprechen per @:**
  - `@Marketing` in ZOEs Feld → „An Head of Marketing gesendet“.
  - `@Kampagnen` im Head-Feld → neuer Mitarbeiter-Thread.
  - Chips leisten dasselbe per Klick.
- **Rechts oben: Läuft / Fertig.** Läufe der Person und Systemläufe, gefiltert auf dem Server. Klick öffnet Thread oder Bericht.
- **Rechts unten: Als Nächstes.** Die nächsten 7 Tage, Freigaben als eine Zeile mit Zahl.
- **Adresse:** über `WEG.agenten({ h, f })` (`h` = Head, `f` = Thread); Zurück folgt der `Verlauf`-Regel (Ort wechseln = `push`).

**Handy (< 720 px):**
- Unten drei Reiter: **Gespräch · Team · Läuft**. „Läuft“ zeigt Hintergrund und „Als Nächstes“ untereinander.
- Ein Head oder Thread öffnet sich ganzflächig mit Zurück; das Eingabefeld sitzt unten (16 px, Ziel 48 px).
- Die Kopfleiste schrumpft auf „+“ (Menü: Auftrag, Skill) und die Freigaben-Zahl.

**Design:** nur Bausteine aus `components/os/ui` (Seite, Karte, Knopf, Reiter, Zeile, Hinweis, Leerzustand), keine Literale (DESIGN_STANDARD.md). Antworten tragen `<KiMarke />`.

## C3 · Abläufe

**Head-Chat (synchron, wie heute bei ZOE):**
1. `POST /api/agenten/faden { headId, fadenId?, text }`. Die Person kommt aus der Sitzung (`personStreng`). Das Tor prüft, ob die Person den Head sehen darf (`headSichtbar`).
2. Der Server lädt den Thread aus **seinem** Bestand (Stand/409) und baut den **Kontext des Heads** (`kontextFuer(head, person)`):
   - Sales, Marketing, Event: `vollesPaket` (Modus `frage`).
   - Finanzen: `baueFinanzbild`, den Haushaltsteil nur mit `privatFinanzZugang`.
   - Andere: Ausschnitt der `gatherBrain`-Blöcke **nur der Kategorien des Heads**.
3. **Werkzeuge** sind die Schnittmenge aus Register-Werkzeugen der Head-Gruppen, KI-Schaltern und Einwilligung. Dazu kommen `skill_laden`, `an_mitarbeiter` und optional `merksatz_vorschlagen` (geht in den Stapel).
4. `askText` mit `ki: { lauf: 'gespraech', person, kategorien: head.kategorien }`, Schleife ≤ 3 Runden, **jede Wirkung über `fuehreAus`**: freigabepflichtige Werkzeuge landen im Stapel, nach Fremdtext alles. `fremdGelesen` und `vertraulich` stehen **am Thread** auf dem Server (nicht mehr vom Browser, vgl. A12).
5. Antwort und Nachricht werden gespeichert; `logRun('faden:<head>', …, { person })`; Verbrauch mit `zweck = agent-<head>`.

**Delegation an einen Mitarbeiter (asynchron, „An Thread gesendet“):**
1. Der Head ruft `an_mitarbeiter { mitarbeiter, auftrag }` auf. Nach Anthropic braucht der Auftrag Ziel, Format, Grenzen und Quellen; das Werkzeug-Schema erzwingt diese Felder.
2. Ein neuer Thread entsteht (`elternId` = Head-Thread, `mitarbeiterId`). Im Head-Thread steht die Systemnachricht **„An Thread ‚…‘ gesendet ›“**.
3. Ein Auftrag wird über `reihe([{ art: 'agent', name: 'faden', eingabe: { fadenId }, person }])` eingereiht. Der Arbeiter ruft `/api/agenten/faden/lauf` auf: Mitarbeiter-Lauf im **Hintergrund-Kontext** (KI-Tor: Schalter „Hintergrund-KI“, Pseudonymisierung), Budget ≤ 6 Runden und 14 Werkzeuge.
4. Das Ergebnis geht als Nachricht in den Mitarbeiter-Thread und als **„Bericht aus Thread ‚…‘“** in den Head-Thread: eine Zusammenfassung, gekapselt als `fremd('agent', …)`.
5. Eine **Glocke** (`melde`, neue Art `agenten`, Text neutral ohne Inhalt) geht an die Person.
6. Rechts oben wechselt der Lauf von „Läuft“ auf „Fertig“.
7. Der Mitarbeiter-Thread lässt sich jederzeit öffnen und **direkt** weiterführen. Dort läuft das Gespräch synchron wie beim Head, mit den Werkzeugen des Mitarbeiters.

**ZOE steuert Heads (Paket 4):**
- `an_head { head, auftrag }`: Thread beim Head, Bericht zurück an ZOE.
- `head_fragen { head, frage }`: synchroner Head-Lauf, nur mit dem Kontext dieses Heads.
- Der Prompt nennt die Heads statt des `agentRoster()`.
- **ZOE der zweiten Person erreicht nie die Privat-Heads der ersten.** Heads werden immer für die *auslösende* Person aufgelöst.

**Grenzen gegen Kostenexplosion:**
- Höchstens 3 offene Mitarbeiter-Läufe je Person.
- Tiefe ≤ 2.
- Mitarbeiter laufen standardmäßig auf „schnell“ oder „ausgewogen“, „stark“ nur bei Review-Skills.
- Budget je Head und Monat (Grenze → Regelwerk bzw. „pausiert“; die Höhe entscheidet Kevin nach dem Messmonat laut ROADMAP).

## C4 · Datenmodell (Entwurf, Typen in `lib/agenten/typen.ts`)
```ts
type Bereich = 'business' | 'privat';
interface HeadDef {                       // Daten im Code (Katalog), neutral, ohne Namen
  id: string;                             // 'sales' | 'marketing' | … (kebab)
  name: string; auftrag: string;          // „Head of Marketing“, ein Satz
  bereich: Bereich; ebene: 'haushalt' | 'person';
  kategorien: KiKategorie[];              // KI-Tor
  werkzeugGruppen: string[];              // Teilmenge von register.ts-Gruppen
  kontext: 'heads' | 'finanzchef' | 'brain';   // welcher Datenpaket-Bauer
  eingebaut?: { quelle: 'heads' | 'finanzchef'; modi: string[] };  // eingebaute Skills = bestehende Modi
  voraussetzung?: 'gesundheit-ki' | 'privat-finanzen' | 'modul:markttraktion';
  mitarbeiter: MitarbeiterDef[];
}
interface MitarbeiterDef { id: string; name: string; rolle: string; werkzeugGruppen: string[]; agentId?: string; stufe: ModelTier }
interface Faden {
  id: string;                             // 'fd-<uuid>' (neueKennung)
  besitzer: string;                       // Speichername — nie geraten
  agent: { art: 'zoe' } | { art: 'head'; headId: string } | { art: 'mitarbeiter'; headId: string; mitarbeiterId: string };
  elternId?: string; titel: string;
  status: 'offen' | 'wartet' | 'laeuft' | 'fertig' | 'fehler';
  fremdGelesen: boolean; vertraulich: boolean;
  nachrichten: Nachricht[]; erstellt: string; aktualisiert: string;
}
interface Nachricht {
  id: string; rolle: 'person' | 'agent' | 'system'; von: string; text: string; zeit: string;
  werkzeuge?: { name: string; ok: boolean; gestapelt?: boolean }[];
  verweis?: { art: 'gesendet' | 'bericht'; fadenId: string };
  ki?: true;
}
interface Skill {
  id: string; headId: string; mitarbeiterId?: string;
  name: string;                           // ≤ 64, [a-z0-9-]
  beschreibung: string;                   // ≤ 1.024, was + wann, dritte Person
  anleitung: string;                      // ≤ 20.000 Zeichen (≈ 500 Zeilen), sonst 413
  werkzeuge: string[];                    // ⊆ Werkzeuge des Heads/Mitarbeiters
  ausloeser: { art: 'hand' } | { art: 'zeitplan'; rhythmus: 'taeglich' | 'werktags' | 'woechentlich' | 'monatlich'; uhrzeit: string; tage?: number[] };
  ergebnis: 'faden' | 'stapel';
  stufe: ModelTier; tests: { eingabe: string; erwartet: string[] }[];  // ≥ 3 zum Aktivieren
  aktiv: boolean; version: number; quelle: 'hand' | 'vorschlag';
  angelegtVon: string; freigegebenVon?: string; stand?: string;
}
interface Lauf { id: string; quelle: 'auftrag' | 'faden' | 'head' | 'finanzchef' | 'skill'; titel: string; headId?: string;
  status: 'wartet' | 'laeuft' | 'fertig' | 'fehler'; start: string; ende?: string; link: string }      // Lesemodell, nie gespeichert
interface Naechstes { art: 'zeitplan' | 'frist' | 'freigabe' | 'zoe-aufgabe'; titel: string; wann: string; headId?: string; link: string }
```
**Bestände** (alle über local-db, verschlüsselt; jeweils mit Eintrag im Speicher-Register):

| Bestand | Inhalt | Register |
|---|---|---|
| `agenten-faeden--<person>` | Threads der Person, auch die Business-Threads | Behandlung „tilgen“: Text Dritter möglich (Kontaktnamen); `PERSON_BESTAENDE`, Konto löschen, Art. 15. Löschfrist: offene Frage, Vorschlag 12 Monate nach letzter Nachricht |
| `agenten-skills--<haushalt>` | Skills der Business-Heads | „haushalt“, `angelegtVon` beim Konto-Löschen → „[gelöscht]“ |
| `agenten-skills--<person>` | Skills der Privat-Heads | wie oben, je Person, `PERSON_BESTAENDE` |
| `agenten-einstellung--<haushalt>` | Heads an/aus, Budget je Head, Mitarbeiter an/aus | kein Personenbezug |

- **Grenzen** (nie still kürzen): Nachricht 8.000 Zeichen und Thread 400 Nachrichten, sonst 413 bzw. „Thread voll — Fortsetzung anlegen“.
- **Prompt:** die letzten 16 Nachrichten plus eine **auf dem Server gerechnete Kurzfassung** älterer Züge (nie die gelöschten).
- **Schreiben** nur als Einzeländerung mit Stand (`listePatchen`-Muster), `bauPruefen` und `jsonBegrenzt`.

## C5 · Rechte und Trennung (auf dem Server, je Bereich eine reine, getestete Filterstelle)
- **EINE Filterstelle `lib/agenten/sicht.ts`:**
  - `headsFuer(konto)`: welche Heads die Person sieht.
  - `headSichtbar(konto, headId)`.
  - `fadenSichtbar(faden, person)`: Threads gehören dem `besitzer`; geteilte Business-Threads nur, falls Kevin das so will (offene Frage 2).
  - `skillsSichtbar`.
- **Sichtbarkeit je Konto:**

| Konto | Business-Heads | Privat-Heads | ZOE |
|---|---|---|---|
| Volles Haushaltsmitglied | ja | eigene (Person) und Haushalt (Familie, Haushaltsfinanzen mit `privatFinanzZugang`) | ja |
| `finanzRecht: 'business'` | ja | **nein** (nicht in der Liste, direkt → 403) | ja. Haushaltsfinanzen fehlen schon heute (`haushaltVon` → null); die übrigen Privat-Blöcke in `gatherBrain` für solche Konten in Paket 1 prüfen |
| Testkunde ohne Haushalt / fremder Haushalt | 403 | 403 | 403 |
| Dienstweg ohne Person | nur `faden/lauf` mit Auftragspacht | — | — |

- **KI-Tor je Head:**
  - `kategorien` des Heads gehen in `ki`. Was ausgeschaltet ist, wird gar nicht angeboten (Werkzeuge) und vom Tor gesperrt.
  - **Business-Heads tragen nie `gesundheit`.**
  - **Art. 9:** Der Head Gesundheit erscheint nur, wenn die Person (a) und (b) erteilt hat (`gesundheitStandFuer`). Er arbeitet nur mit **eigenen** Werten, die Partnersicht nur mit (c).
- **Freigaben:**
  - Nichts geht nach außen ohne Klick.
  - Das Werkzeug-Risiko bleibt die einzige Stufe.
  - Ein Skill kann sie **nie lockern**: Seine Werkzeuge sind eine Teilmenge, die Stufe kommt weiter aus dem Register.
  - Agenten- und Mitarbeiter-Nachrichten sind **nie** Zustimmung.
  - `entschiedenVon` kommt nur aus der Sitzung.
- **Fremder Text:**
  - Mitarbeiter-Ergebnisse und Web-Recherche → `fremd()`.
  - Ab dem ersten fremden Text gilt am Thread „nur Vorschlag“ (Regeln aus `gespraech-schutz.ts`).
  - Skill-Texte stammen nur von Menschen. Ein von einem Agenten **vorgeschlagener** Skill geht als neue Stapel-Art `skill` in den Stapel und ist erst nach Klick aktiv (`freigegebenVon`).
- **Business-frei** (Branch `business-frei`, nach dem Upload): Business-Heads ruhen in den Business-freien Zeiten:
  - Keine Hintergrundläufe, keine Skill-Zeitpläne.
  - Der Chat zeigt einen ruhigen Hinweis. Ob er dann ganz gesperrt ist: offene Frage 6.
- **Routen-Register:** neue Routen mit den Klassen `person` bzw. `haushalt` und der Tor-Zeile. Die Messlatte „Malin“ läuft automatisch über alle GET-Routen; neue Bestände bekommen Marken in der Saat.
- **Plattform:**
  - Keine Namen, keine Firmen und kein `'kevin'`/`'malin'` in `lib/agenten/**` und `components/os/agenten/**` (Wächter).
  - Heads, Mitarbeiter und Vorlagen sind neutrale Daten.
  - Die Demo-Saat bekommt erfundene Threads und Skills.

## C6 · Welche Heads und Mitarbeiter (Vorschlag)

**Business** (Ebene Haushalt; die ersten drei bauen auf `lib/heads` auf, der vierte auf `lib/finanzen/chef`):

| Head | Andocken (vorhanden) | KI-Kategorien | Mitarbeiter (Vorschlag) |
|---|---|---|---|
| **Sales** | `lib/heads` sales (Modi = eingebaute Skills), CRM-Werkzeuge, `crm_vorschlag`, Power Hour, Angebote | crm, kalender (maskiert), aufgaben | Lead-Recherche (`prospect`/`research`), Ansprache (`outreach`, `entwurf_ansprache`), Angebote (`angebot_entwurf`), Power Hour |
| **Marketing** | `lib/heads` marketing, Kampagnen-Playbooks, Newsletter, Content-Agent | crm, web | Content & Social (`content`), Kampagnen, Newsletter, Positionierung. **„Design“ nur als Briefing/Text** — ein Bildwerkzeug gibt es nicht |
| **Event** | `lib/heads` event, besuchte Events, Netzwerken | crm, kalender | Gäste & Einladung, Nachfassen 48 h, Netzwerken-Abendbericht |
| **Finanzen (Business)** | `lib/finanzen/chef` (Business-Teil), Business-Index, Controlling, Board, Steuern Business; nach `rechnungen-pdf` auch Rechnungen | finanzen | Controlling (`controlling`), Board-Pack (`board`), Steuern & Fristen, Rechnungen & Mahnungen (nur Vorschlag) |
| **Operations** (neu, AI_CEO D3.2) | Team-Postfach (`inbox-teilen`), Business-Aufgaben, Kalender Business, Meeting | postfach, aufgaben, kalender | Inbox-Triage (`inbox`), Aufgaben (`task`), Meeting (`meeting`), Termine (`kalender`) |
| **Strategie & Unternehmen** (neu) | `research`, `okr`, Gesellschafts-Register (Verträge, Fristen, Beschlüsse), Kapazität | web, aufgaben, allgemein | Research (`research`), Ziele (`okr`), Gesellschaften & Verträge |
| *IT* | HOI — **bleibt ohne KI**; erscheint links als Lagebild-Karte | — | — |

**Privat:**

| Head | Ebene | Andocken | KI-Kategorien | Mitarbeiter |
|---|---|---|---|---|
| **Gesundheit** | Person; nur mit Einwilligung (a)+(b) | Gesundheits-Index, Sport, Ernährung, WHOOP-Spiegel, Körper-Profil — nur eigene | gesundheit | Training (Sport-Modell), Ernährung (`ernaehrung`), Erholung |
| **Finanzen (Privat)** | Haushalt, nur `privatFinanzZugang` | Finanzchef-Haushaltsmodus, Buchungen, Budget, Finanzplanung Privat, Steuern privat, Selbstständigkeit (gehört zu Privat) | finanzen | Budget & Fixkosten, Steuern privat, Verträge |
| **Planung & Fokus** | Person | Ziele, Meilensteine, Routinen, Kapazität, `planung`, `fokus`, Wochenplan | aufgaben, kalender | Wochenplan (`planung`), Tagesform (`fokus`), Routinen |
| **Familie & Partnerschaft** | Haushalt (Paar); „nur ich“ bleibt „nur ich“ | `lib/familie` (Rhythmus, Dates, Wichtige Tage, Gespräche), Geburtstage | **fehlt: neue KI-Kategorie `familie`** (Schalter plus Tor) | Dates & Anlässe, Urlaub & Reisen, Gesprächsthemen |

**Begründung:**
- Business folgt AI_CEO D3.2 und den vorhandenen Modulen.
- Privat folgt der ROADMAP (ZOE als Gesundheits-Coach, Dates/Urlaub, Wochenplanung mit ZOE) und den Art.-9-Regeln.
- Jeder Head hat **≤ 20 Werkzeuge**, das liegt unter der Copilot-Grenze von 30–40.
- Die Selbstständigkeit gehört zu Privat (`bereichVon`). Ihre Finanzen liegen deshalb beim Head Finanzen (Privat), nie bei den Business-Heads.

## C7 · Wiederverwendung — nichts doppelt
- **Werkzeuge, Risiko, Trockenlauf, Stapel, Entscheidungen, Protokoll:** unverändert (`register.ts`, `fuehreAus`, `stapel.ts`, `entscheidungen.ts`). Neu ist nur die Stapel-Art `skill`.
- **Head-Läufe:** `headLauf` und Finanzchef-`lauf` bleiben die Motoren der **eingebauten Skills** (Modi). Ihre Freigabe-Listen (`head-<id>`, `finanzchef`) bleiben; der Head-Chat zeigt sie als Karte „Vorschläge“ (Daten wie im `HeadPanel`).
- **Warteschlange und Arbeiter:** Mitarbeiter- und Skill-Läufe sind Aufträge (`art: 'agent'`, Namen `faden` bzw. `skill`) mit Pacht, Idempotenz und 3 Versuchen. **Kein zweiter Hintergrund-Mechanismus.**
- **Takt:** eine neue Zeile „Skill-Zeitpläne“ in `faellig()`; sie respektiert die Hintergrund-KI (`KI_LAEUFE`) und `wartenNachFehler`.
- **Agenten-Log, Verbrauch, KI-Tor, Gedächtnis/Merksätze:** werden wiederverwendet. Merksätze = kurze Regeln, immer im Prompt. Skills = Anleitungen, nur bei Bedarf.
- **Gesprächsschleife:** `kimmi` und der Head-Chat teilen später **eine** Schleife (`lib/agenten/schleife.ts`, Paket 4). Bis dahin prüft ein Wächter, dass der Head-Chat nur über `fuehreAus` wirkt.
- **`agents-data.ts`:** bleibt Quelle für `resolveAgent` (Schalter, Modell) der Fach-Agenten, die jetzt Mitarbeiter-Vorlagen sind. Das Organigramm wird zur Ansicht „⋯ › Einstellungen“ (der Inhalt von `AgentenView` bleibt dort erhalten).

## C8 · Bauplan in Paketen

**Paket 0 · Vertrag** (Hauptsitzung, vor den Agenten, etwa 1 Stunde, direkt auf `entwicklung`)

Paket 0 legt alles an, was mehrere Pakete berühren, damit danach **jede Datei genau einem Paket gehört**:
- `lib/agenten/typen.ts`: Typen aus C4, Bestandsnamen-Funktionen, Grenzen.
- `lib/agenten/katalog.ts`: Heads und Mitarbeiter als Daten.
- Stub `lib/agenten/skills-lesen.ts`: `skillsFuerHead()` liefert `[]`.
- **Routen-Stubs** mit Tor-Zeile und 501: `app/api/agenten/route.ts`, `…/faden/route.ts`, `…/faden/lauf/route.ts`, `…/skills/route.ts`, `…/laeufe/route.ts`.
- Einträge in `lib/zugang/routen-register.ts`, `lib/crm/speicher-register.ts`, `lib/datenschutz/konto-daten.ts`.
- Fixture `tests/fixtures/agenten-api.ts` (Beispiel-Antworten für die Oberfläche).

**Danach parallel über Nacht, je ein Branch, keine gemeinsamen Dateien:**

| Paket | Branch | Gehört dem Paket | Liefert | Wächtertests |
|---|---|---|---|---|
| **1 · Kern: Datenmodell, Server, Rechte, Head-Chat** | `agenten-kern` | `lib/agenten/{sicht,faeden,faeden-server,kontext,gespraech,delegation}.ts`, `app/api/agenten/route.ts`, `…/faden/route.ts`, `…/faden/lauf/route.ts`, Eintrag in `lib/crm/person-weitere.ts` (Art. 17 tilgen) | GET Heads und Übersicht (passiert / in Arbeit) je Person; Head- und Mitarbeiter-Chat synchron; `an_mitarbeiter` → Thread plus Auftrag; Ergebnis und Bericht zurück; Glocke neutral | `agenten-sicht` („Sicht X bekommt nichts aus Y“: zweite Person, Business-Konto, fremder Haushalt, Dienstweg), `agenten-ki-tor` (nur Kategorien des Heads, Business ohne Gesundheit), `agenten-freigabe` (Schreiben → Stapel, nach Fremdtext nur Vorschlag, Agenten-Nachricht ≠ Freigabe), `agenten-faeden` (Stand/409, Grenzen 413, Verlauf nur vom Server) |
| **2 · Oberfläche** | `agenten-seite` | `components/os/agenten/**`, `app/os/agenten/page.tsx`, `lib/wege.ts` (`WEG.agenten({h,f})`) | Drei Spalten wie C2, Handy-Reiter, Kopfleiste (B4), Head-Kopf, @-Ansprechen, Thread-Ansicht mit „gesendet / Bericht“, „Läuft/Fertig“ und „Als Nächstes“; **arbeitet gegen das Fixture**; ZOE-Mitte nutzt vorerst das bestehende `/api/kimmi`; AgentenView wandert unter „⋯ › Einstellungen“ | `agenten-oberflaeche` (Design-Standard, keine Literale, Ziele ≥ 44 px, Eingabe 16 px), `agenten-plattform` (keine Namen/Firmen), Suche/Seiten-Wächter grün |
| **3 · Skills, Hintergrund, Als Nächstes, Takt** | `agenten-skills` | `lib/agenten/{skills,skills-server,skills-lesen,laeufe,naechstes,zeitplan}.ts`, `app/api/agenten/skills/route.ts`, `…/laeufe/route.ts`, Zeile in `lib/zoe/takt.ts`, `faden`/`skill` in `lib/zoe/agenten.ts`, Art `skill` in `lib/zoe/stapel.ts` + `stapel-arten.ts`, Zeitplan-Regeln aus `lib/heads/takt.ts` als Daten | Skills anlegen, prüfen, Probelauf, aktivieren, Versionen; Zeitplan-Läufe; Lesemodell `laeufe` (Aufträge, Thread-, Head- und Finanzchef-Berichte, je Person gefiltert); `naechstes` (dieselben Zeitplan-Regeln wie `faellig` — **keine zweite Planung**) | `agenten-skills` (Grenzen 413, Werkzeuge ⊆ Head, Agent-Vorschlag → Stapel, aktiv erst nach Klick, Zeitplan ruht bei Hintergrund-KI aus), `agenten-laeufe` (nie Läufe der anderen Person), `agenten-naechstes` (gleiche Regeln wie `faellig`, Gold-Fälle) |

**Merge-Reihenfolge:** 1 → 3 → 2. Die Oberfläche kommt zuletzt und schaltet vom Fixture auf die echten Routen um. Vor jedem Merge laufen die volle Suite, tsc und lint.

**Paket 4 · Verdrahtung** (danach, nacheinander, erst nach dem Merge von `zoe-whatsapp` und `business-frei`):
- ZOE-Werkzeuge `an_head` und `head_fragen`; der Prompt nennt Heads.
- Die Schleife aus `kimmi` wandert nach `lib/agenten/schleife.ts`, eine für alle.
- ZoePanel und Empfang laufen auf Threads (`zoe-verlauf` → Thread `zoe`, mit Übernahme).
- **Streaming:** `askStream` in `lib/anthropic.ts` mit demselben KI-Tor.
- Business-frei für Heads; Budget je Head; Demo-Saat; Plattform-Schulden aus A13; `AI_CEO_MODUL.md` D3.3 anpassen.

**Hinweise für die Bau-Agenten:**
- Dateien, die in Branches liegen, die noch nicht gemergt sind, **nicht anfassen** (`kimmi`, `lib/zoe/takt.ts` ist in `business-frei` berührt): Paket 3 baut seine Takt-Zeile erst nach dem Merge von `business-frei` ein oder hält sie minimal.
- Höchstens 2 Bau-Agenten gleichzeitig auf dem Mac (ROADMAP: Mac-Last ≤ 75 %, 8 GB). Das dritte Paket startet, sobald eines fertig ist.
- Nichts committen ohne grüne Wächter. Nichts nach `main`.

## C9 · Risiken
1. **Kosten.**
   - Mehragenten-Systeme verbrauchen etwa 15× die Token eines Chats (Anthropic), dazu kommen Zeitpläne.
   - **Gegenmittel:** Budget je Head, günstige Modelle für Mitarbeiter, Delegation nur bei Bedarf, Regelwerk-Rückfall. Den Verbrauch je Head zeigt die Seite („⋯“).
2. **Last auf dem Server:**
   - Der Server hat 1 vCPU und 2 GB, der Arbeiter hat 2 Plätze, Head-Läufe dauern bis zu 400 s im Request.
   - **Gegenmittel:** Mitarbeiter laufen asynchron über die Warteschlange, Grenze 3 je Person, Streaming in Paket 4.
3. **Datenschutz und Prompt-Injection.**
   - Threads tragen Text Dritter (Web, Mails, Notizen).
   - **Gegenmittel:** `fremd()`, Status am Thread auf dem Server, Werkzeug-Risiko, Pseudonymisierung im Hintergrund, Art. 15/17 über das Register.
4. **Skills als Einfallstor.**
   - Skills sind Anweisungen. Sie dürfen nur von Menschen kommen oder per Klick freigegeben werden und können keine Werkzeug-Stufe lockern.
   - Kein Skill-Import aus fremden Quellen in Version 1.
5. **Zwei Gesprächsschleifen** (`kimmi` und Head-Chat) laufen auseinander, bis Paket 4 sie zusammenführt. Wächter: Wirkung nur über `fuehreAus`.
6. **Parallele Branches** (`zoe-whatsapp`, `business-frei`, `konten-register`, `rechnungen-pdf`, `inbox-teilen`) berühren `kimmi`, Takt und Register. Deshalb gibt es Paket 0 und eine feste Merge-Reihenfolge.
7. **Begriffs- und Plattform-Schulden** (A13).
   - Die Heads lesen das Team aus der Build-Variable `TEAM`.
   - Neue Stellen nehmen die Konten bzw. `teamVon`, nie feste Kürzel.
8. **Erwartung „wie Claude“.** Ohne Streaming und ohne geteiltes Thread-Gedächtnis wirkt der Chat langsamer. Beides gehört in Paket 4.
9. **„Head of IT“ ist kein KI-Agent.** Damit niemand Chat erwartet, steht er links als Lagebild.

## C10 · Offene Fragen für Kevins Klickrunde
1. **Welche Heads in Version 1?**
   - Vorschlag: Business Sales, Marketing, Event, Finanzen, Operations; Privat Gesundheit, Finanzen, Planung.
   - Strategie und Familie in Version 2. Familie braucht die neue KI-Kategorie `familie` (eigener Schalter und Einwilligung?).
2. **Business-Threads:**
   - Gehören sie der Person, wie die ZOE-Gespräche heute (Vorschlag), oder sieht das ganze Business-Team sie (wie geteilte Claude-Projekte)?
   - Oder „persönlich, aber per Knopf teilbar“?
3. **Wer darf Business-Skills anlegen und aktivieren?** Jedes volle Mitglied, auch Konten „nur Business“, oder nur der Inhaber?
4. **Eingebaute Modi als Skills:** sichtbar und nicht änderbar (Vorschlag), oder dürfen eigene Fassungen sie ersetzen?
5. **Budget je Head:** erst messen (ROADMAP: ein Monat) und dann eine Grenze festlegen? Vorschlag: zunächst nur anzeigen.
6. **Business-frei:** Sind Business-Head-Chats in diesen Zeiten ganz gesperrt oder nur die Hintergrundläufe?
7. **Mitarbeiter-Ergebnisse:** Sollen sie zusätzlich auf das Handy kommen (WhatsApp/Telegram, neutral „liegt bereit“)?
8. **Beschriftung:** „Threads“ (Kevins Wort) oder „Fäden“? Vorschlag: „Threads“ in der Oberfläche, `faden` im Code.
9. **Eigene Heads anlegen („+ Head“):** schon in Version 1 oder erst für Kunden-Instanzen (Version 2)?
10. **Gesundheit:** Laut Leitbild ist Malin Gesundheits-Beauftragte. Soll das eine **Instanz-Einstellung** werden, also eine zuständige Person je Head wie bei der Markttraktion? Nie fest im Code.
11. **Löschfrist der Threads:** 12 Monate nach der letzten Nachricht (Vorschlag) oder unbegrenzt bis zum Löschen von Hand?
12. **AI_CEO_MODUL.md D3.3** auf „direkt mit Heads und Mitarbeitern sprechen“ umstellen?

## C11 · Vertrag (Paket 0) — Dateien je Paket

**Stand:** 09.10.2026, Branch `agenten-vertrag` (Basis `nach-upload`). C11 ersetzt die Spalte „Gehört dem Paket“ der Tabelle in C8; wo
C11 und C8/C4 abweichen, gilt C11. Kevins Antworten 1–16 (ENTSCHEIDUNGEN_FRAGEBOGEN.md) gehen beidem vor.

### Was Paket 0 festlegt
- **`lib/agenten/typen.ts`** — die EINE Stelle für Typen, Bestandsnamen, Grenzen und die Form der Schnittstellen (Anfragen und Antworten
  aller Agenten-Routen). Rein und client-sicher. **Nur additiv ändern** (neue optionale Felder, neue Union-Glieder) — nie umbenennen.
- **`lib/agenten/katalog.ts`** — Kevins Auswahl als neutrale Daten: 11 Business-Heads (Sales, Marketing, Event, Finance, IT/Betrieb,
  Operations, Kundenerfolg, Strategie/CEO-Office, Produkt, Recht & Datenschutz, Research) und 5 Privat-Heads (Gesundheit & Sport, Ernährung
  & Einkauf, Familie & Partnerschaft, Finanzen privat, Persönliche Assistenz), je Head 1–5 Mitarbeiter-Vorlagen (zuerst ausgestattet:
  Marketing, Sales, Finance). Werkzeuge je Head als ausdrückliche Liste aus dem ZOE-Register, KI-Kategorien, Ton, Farb-Token, Kennzahlen,
  eingebaute Skills (= vorhandene Modi), Voraussetzungen. Kennungen nie ändern.
- **`lib/agenten/skills-lesen.ts`** — Lese-Schnittstelle der Werkstatt (Stub): `skillsFuerHead` (→ `[]`), `skillLesen`, `mitarbeiterFuerHead`
  (→ Vorlagen aus dem Katalog), `gedaechtnisFuer`, `einstellungFuer`. Paket 3 füllt sie, die Signaturen bleiben — Paket 1 baut dagegen.
- **Routen-Stubs (501)** mit Tor-Zeile: `app/api/agenten` (GET), `agenten/faden` (GET/POST), `agenten/faden/lauf` (POST, Dienstweg MIT
  Person), `agenten/skills` (GET/POST), `agenten/laeufe` (GET/POST), `medien` (GET/POST). Alle Personen-Routen über `eigenePerson`
  (Re-Export in `lib/zugang/tor.ts`): nur die Person selbst, Dienstweg 403, keine Personen-Parameter.
- **Register:** Routen (`lib/zugang/routen-register.ts`), Bestände mit Angaben (`lib/crm/speicher-register.ts`), Art. 17 tilgen und Art. 15
  zählen (`lib/crm/person-weitere.ts` — `weitereAufzaehlen` nimmt die Bestände damit auch in die Kontakt-Auskunft), Konto-Export/-Löschen
  (`lib/datenschutz/konto-daten.ts`), `StapelArt` + `skill`/`mitarbeiter`/`merksatz` (`lib/zoe/stapel.ts`), `WEG.agenten({ h, f })` (`lib/wege.ts`).
- **Fixture** `tests/fixtures/agenten-api.ts` (Heads, Überblick, Threads mit „gesendet/Bericht“, Läufe, Als Nächstes, Skills, Medien — erfunden,
  neutral, typgeprüft) und **Wächter** `tests/agenten-vertrag.test.ts`.

### Entscheidungen in Paket 0 (Abweichungen von C4/C8)
1. **Werkstatt statt nur Skills:** `agenten-skills--<haushalt>` (Heads der Ebene Haushalt: alle Business-Heads, Familie) und
   `agenten-skills-privat--<person>` (Privat-Heads je Person) tragen `WerkstattBestand` = Skills + eigene/geänderte Mitarbeiter + Gedächtnis
   der Heads (das der Mitarbeiter steht am Mitarbeiter). **Zwei verschiedene Namen**, weil Konto-Löschen `<basis>--<speicher>` ganz entfernt —
   ein Haushalt, der zufällig wie eine Person heißt, verlöre sonst seine Skills. Welcher Bestand: `werkstattBestandFuer(ebene, umfang)`.
2. **Hintergrundaufgaben:** „jetzt“ = Thread (`POST /api/agenten/faden` mit `hintergrund: true`, Paket 1); „geplant/wiederkehrend“ = neuer
   Bestand `agenten-plan--<person>` (`POST /api/agenten/laeufe` `planen`, Paket 3). Deshalb hat `laeufe` auch POST (abbrechen, neu starten).
3. **EIN Lauf-Name in der Warteschlange:** `faden` (`LAUF_AGENT`) für Mitarbeiter-, Skill- und Plan-Läufe; die `eingabe` ist ein `LaufAuftrag`,
   eingereiht mit `auftrag: JSON.stringify(…)` (der Arbeiter reicht Agenten nur den Text weiter). Ausgeführt wird nur über
   `/api/agenten/faden/lauf` (Paket 1) — Paket 3 reiht nur ein. `lib/zoe/agenten.ts` gehört damit allein Paket 1.
4. **Mitarbeiter-Ids** sind im ganzen Katalog eindeutig (`<head>-<rolle>`); selbst angelegte heißen `ma-<uuid>`. Ein Mitarbeiter, der über
   `auchFuer` aushilft, arbeitet im Thread mit `headId` des Heads, dem er hilft (Daten, Kategorien, Werkzeuge = Schnittmenge, Paket 1).
5. **Werkzeuge** stehen je Head ausdrücklich im Katalog (nicht ganze Gruppen); die Agenten-Werkzeuge (`HEAD_WERKZEUGE`: `skill_laden`,
   `an_mitarbeiter`, `merksatz_vorschlagen`, `skill_vorschlagen`, `mitarbeiter_vorschlagen`) zählen in die Grenze 20 mit. Mitarbeiter bekommen
   nur `skill_laden` und `merksatz_vorschlagen` (Tiefe ≤ 2).
6. **Head of IT** hat einen Chat über dem Lagebild (Antwort 2, Kontext `hoi`) — das Lagebild selbst bleibt ohne KI, nie Personen.
7. **Familie:** die KI-Kategorie `familie` fehlt im KI-Tor — vorerst `allgemein` (+ Kalender, Aufgaben), als `offen` im Katalog (Paket 4).
8. **Ernährung** trägt `gesundheit` nur als `kategorienMitEinwilligung` (wie die Ernährungs-Routen heute); Head Gesundheit braucht (a)+(b).
9. **Modell-Anbieter:** nur das Feld `anbieter` (Antwort 14); ausgeführt wird bis zum Anbieter-Tor ausschließlich über `askText`.
10. **Einstellungen schreiben** (Modell/Aufwand, Budget, Autonomie, Not-Aus, zuständige Person) → Paket 4 mit eigener Methode/Route und
    Register-Eintrag; gelesen wird schon jetzt über `einstellungFuer` (Vorgabe).
11. **Medien unterwegs** (Nachtrag): `medien--<haushalt>` (Business) und `medien-privat--<person>` (Privat) — Typ `Medium` ist ein Entwurf,
    die Richtungsfragen (Speicherort, Ordnung, Recht am Bild, Videogrößen) klärt die Fragerunde.

### Dateien je Paket (jede Datei gehört genau einem Paket)

| Paket | Branch | Gehört dem Paket (nur dieses Paket ändert sie) | Liest nur |
|---|---|---|---|
| **0 · Vertrag** | `agenten-vertrag` | `lib/agenten/typen.ts`, `lib/agenten/katalog.ts`; die Agenten-Einträge in `lib/zugang/routen-register.ts`, `lib/zugang/tor.ts` (Re-Export `eigenePerson`), `lib/crm/speicher-register.ts`, `lib/crm/person-weitere.ts`, `lib/datenschutz/konto-daten.ts` (`PERSON_BESTAENDE`, `NICHT_PERSOENLICH`), `lib/zoe/stapel.ts` (`StapelArt`), `lib/wege.ts` (`WEG.agenten`); `tests/agenten-vertrag.test.ts`, `tests/fixtures/agenten-api.ts` | — |
| **1 · Kern** | `agenten-kern` | neu: `lib/agenten/{sicht,faeden,faeden-server,kontext,gespraech,delegation,werkzeuge}.ts`; `app/api/agenten/route.ts`, `app/api/agenten/faden/route.ts`, `app/api/agenten/faden/lauf/route.ts` (Stubs ersetzen); `lib/zoe/agenten.ts` (`faden` in `AUSFUEHRBAR` + `SYSTEM_LAEUFE` + `AGENT_ZWECK` + Fall → `/api/agenten/faden/lauf`, Hintergrund-Kopf); `lib/meldungen/*` (Glocken-Art `agenten`, Text neutral); Tests `agenten-sicht`, `agenten-ki-tor`, `agenten-freigabe`, `agenten-faeden`; Saat-Marke für `agenten-faeden--<person>` in `tests/messlatte-malin.test.ts` | `typen`, `katalog`, `skills-lesen` (Signaturen), Stapel `lege()` mit den neuen Arten |
| **2 · Oberfläche** | `agenten-seite` | `components/os/agenten/**`, `app/os/agenten/page.tsx`; arbeitet gegen `tests/fixtures/agenten-api.ts`, ZOE-Mitte vorerst über `/api/kimmi`; Tests `agenten-oberflaeche`, `agenten-plattform` | `typen`, `katalog`, `WEG.agenten`, Fixture |
| **3 · Skills, Läufe, Als Nächstes** | `agenten-skills` | neu: `lib/agenten/{skills,skills-server,laeufe,naechstes,zeitplan,plan-server}.ts`; `lib/agenten/skills-lesen.ts` (Stub füllen, Signaturen bleiben); `app/api/agenten/skills/route.ts`, `app/api/agenten/laeufe/route.ts`; `lib/zoe/stapel-arten.ts` (Freigabe `skill`/`mitarbeiter`/`merksatz`); `lib/zoe/takt.ts` (eine Zeile Skill-/Plan-Zeitpläne, `faden` in `KI_LAEUFE`); Export/Löschen des Speichernamens in `agenten-skills--*` (`kontoExport`/`kontoLoeschen` in `lib/datenschutz/konto-daten.ts` — nur diese beiden Funktionen); Tests `agenten-skills`, `agenten-laeufe`, `agenten-naechstes`; Saat-Marken für `agenten-skills-privat--<person>`, `agenten-plan--<person>` | `typen`, `katalog`; Threads nur lesend über `fadenBestand` (Lesemodell `Lauf`) |
| **5 · Medien unterwegs** | `medien-unterwegs` | neu: `lib/medien/**`, `components/os/medien/**` (+ ggf. `app/os/medien/**`); `app/api/medien/route.ts`; Ordner `medien` in `BILD_ORDNER` (`lib/store/datei-huelle.mjs` + `.d.mts`) samt Register-Eintrag der Dateien (eine Zeile im Agenten-Block von `lib/crm/speicher-register.ts`); Dateien beim Konto-Löschen (`kontoLoeschen`, eigener Schritt) | `typen` (`Medium`), `katalog` (`anHeads`) |
| **4 · Verdrahtung** | nacheinander | `app/api/kimmi/route.ts` (`an_head`, `head_fragen`, Heads statt `agentRoster`), `lib/agenten/schleife.ts`, Streaming (`lib/anthropic.ts`), ZoePanel/Empfang auf Threads, Einstellungen schreiben, KI-Kategorie `familie`, Plattform-Schulden A13, `AI_CEO_MODUL.md` D3.3 | alles |

**Berührungspunkte (bewusst klein, Merge-Reihenfolge 1 → 3 → 5 → 2):**
- `tests/messlatte-malin.test.ts`: Paket 1 und 3 hängen je einen eigenen Saat-Block an (verschiedene Zeilen).
- `lib/datenschutz/konto-daten.ts`: Paket 3 und 5 ändern verschiedene Funktionen; `PERSON_BESTAENDE`/`NICHT_PERSOENLICH` stehen schon.
- `lib/make-one/seiten.ts` und `lib/wege.ts`: nur Paket 5, falls Medien eine eigene Seite bekommt (die Agenten-Seite gibt es schon).
- Braucht ein Paket eine neue Route, Methode oder einen neuen Bestand, ist das eine **Vertragsänderung**: im Bericht nennen, nicht still
  in fremde Register schreiben.

**Offen nach Paket 0:** KI-Kategorie `familie` (Schalter, ggf. Einwilligung) · Anbieter-Tor für andere Modelle · Löschfrist der Threads
(C10 Frage 11) · zuständige Person für Gesundheit als Instanz-Einstellung (C10 Frage 10) · Medien-Richtungsfragen · Einstellungen schreiben.

## Paket 4 — so verdrahtet (09.10.2026, Paket 4a, Branch `agenten-p4a`)

**Die eine Schleife** `lib/agenten/schleife.ts`: ZOE (`app/api/kimmi`) und Heads/Mitarbeiter (`lib/agenten/gespraech.ts` `agentLauf`) rufen das
Modell nur noch dort. Gemeinsam: `askText` mit `ki`, Kapselung von Text Dritter (`FREMD_WERKZEUGE`/`FREMD_AGENTEN`, `SELBST_GEKAPSELT`), „fremd
gelesen“/„vertraulich“ fürs ganze Gespräch, Kategorien wachsen mit, nur Metadaten im Protokoll. Parameter: Runden (ZOE 3; Head-Chat
`GRENZEN.headRunden` = 3; Lauf `GRENZEN.mitarbeiterRunden` = 6), parallel (ZOE) oder nacheinander (Heads), gleiche Aufrufe nur einmal, Budget
(Heads 14), letzte Runde ohne Werkzeuge (Heads), Zeit-/Kostengrenze, Abbruch, Stillstand nach 2 Runden (Lauf), Plan-Freigabe (`vorRunde`). Jede
Wirkung im Handler über `fuehreAus`; im Agenten-Bereich alles Schreibende nur als Vorschlag; Skill-Testlauf im Trockenlauf (`trocken`).

**Die eine Werkzeug-Quelle** `lib/zoe/werkzeug-defs.ts` (`werkzeugDefs({ personen, agenten, heads })`) + Teil-Quellen `crm-werkzeug-defs.ts`,
`aufgaben-werkzeuge.ts`, `arbeit-werkzeug.ts`. Agenten lesen dieselbe Stelle über `agentenDef` (lib/agenten/werkzeuge.ts). Personen zur Laufzeit,
CRM-Zuständige aus dem Team der Instanz.

**ZOE steuert die Heads** (`lib/agenten/zoe-heads.ts`): `an_head` (frei, reiht nur ein → Thread beim Head, Eltern = ZOE-Thread, Bericht zurück in
den ZOE-Thread + Glocke) und `head_fragen` (synchron, nur Kontext + lesende Werkzeuge des Heads, Antwort `fremd('agent')`). Der Prompt nennt die
Heads, die die Person sieht (`headsImPrompt`), statt `agentRoster()`. Thread-Kontext reicht kimmi über `WerkzeugKontext.zoe` (nur Server).

**ZOE auf Threads** (`lib/agenten/zoe-faden.ts`): ZOE-Gespräch = Thread `zoe` der Person; `/api/kimmi` mit `zoeFaden` (Kennung | `neu`) liest den
Verlauf aus dem Thread. Einmalige Übernahme von `zoe-verlauf` beim ersten Lesen (Marke `zoeUebernahme`). ZoePanel, Empfang, Agenten-Seite, Telegram
und WhatsApp schreiben in Threads.

**ZOE ≤ 20 Werkzeuge** (`lib/zoe/werkzeug-wahl.ts`): Kern + Bereich nach Regelwerk (Frage, letzte Fragen, Bezug), reihum, höchstens 20; nicht
angebotene Werkzeuge lehnt kimmi ab („frag den Head“). Bereiche mit `*` stehen hinter Platz 11 (rücken nur nach, wenn Platz ist — es gibt sie
auch beim Head).

| Werkzeug | ZOE | Heads |
|---|---|---|
| an_head, head_fragen, suche_arbeit, lies_notiz, create_task, meine_aufgaben, freie_zeit, fakt_merken, frag_gedaechtnis | **Kern** (immer) | create_task: alle außer Gesundheit · suche_arbeit: Operations, Strategie, Produkt, Recht, Research, Assistenz · lies_notiz: Marketing, IT, Strategie, Produkt, Recht, Research · meine_aufgaben: Operations, Produkt, Assistenz · freie_zeit: Sales, Event, Operations, Kundenerfolg, Familie, Assistenz |
| crm_lage, suche_kontakt, notiere_kontakt, chance_anlegen, uebergeben | Bereich vertrieb | — (nur ZOE; im Agenten-Bereich über `crm_vorschlag`) |
| crm_suche, kontakt_akte, firma_akte, pipeline, sales_lage, crm_vorschlag | Bereich vertrieb (crm_vorschlag auch marketing, event, crm-pflege) | Sales (pipeline, sales_lage), Sales/Marketing/Event/Kundenerfolg (übrige) |
| entwurf_ansprache*, angebote_lage*, mandate_lage*, setze_kunde*, qualifizierung_lage* | Bereich vertrieb* (entwurf_ansprache, qualifizierung_lage auch marketing) | Sales, Marketing, Event, Kundenerfolg, Finanzen |
| marketing_lage, kampagnen_lage, kennzahlen | Bereich marketing (kennzahlen auch event) | Marketing, Event, Sales, Strategie |
| events_lage, besuche_lage | Bereich event | Event, Marketing |
| datenqualitaet, stammdaten_lage, crm_datei_lesen | Bereich crm-pflege | Sales (datenqualitaet), Sales/Marketing/Kundenerfolg (crm_datei_lesen) |
| heads_lage, run_agent, starte_auftraege, open_agent | Bereich agenten | — (Fach-Agenten sind Mitarbeiter-Vorlagen der Heads) |
| business_index, gesellschaften_lesen, setze_kontostand, erfasse_rechnung, erfasse_zahlung, erfasse_planposten, monatsabschluss_erfassen, setze_ziele | Bereich finanzen (business_index, gesellschaften_lesen auch business; setze_ziele auch planung) | Finanzen, Strategie, Recht |
| haushalt_stand, haushalt_buchungen, haushalt_zuordnen, haushalt_rechnung_bezahlt, haushalt_rechnung_erfassen | Bereich haushalt (nur mit Haushaltszugang) | Finanzen privat |
| gesundheits_index, setze_vitalwerte, hake_routine, journal_eintrag, haut_eintrag, streak_eintrag | Bereich gesundheit (nur mit Einwilligung (b)) | Gesundheit (ohne haut/streak) |
| einkauf_setzen | Bereich ernaehrung | Ernährung |
| plan_block | Bereich kalender | Operations, Assistenz |
| aufgabe_an_zoe, projekt_unterlagen, datei_lesen | Bereich aufgaben | Operations, Assistenz, Kundenerfolg |
| setze_meilenstein, setze_fokus | Bereich planung | Operations, Strategie, Assistenz |
| suche_wissen, notiz_anlegen, notiz_ergaenzen | Bereich wissen | Marketing, IT, Strategie, Produkt, Recht, Research (ohne notiz_ergaenzen) |
| lies_postfach | Bereich inbox | Operations |
| bauplan_notieren | Bereich bauplan | IT, Produkt |

Wächter: `tests/agenten-p4a-schleife.test.ts`, `tests/agenten-p4a-zoe.test.ts` (u. a. „kein Zug > 20“, „jedes bisherige Werkzeug erreichbar“),
`tests/agenten-p4a-verdrahtung.test.ts`.
