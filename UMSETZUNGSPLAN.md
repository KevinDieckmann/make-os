# MAKE OS — Umsetzungsplan (Übergabe an die nächste Session)

> **Erledigt und abgelöst (18.09.2026).** Die Pakete unten sind gebaut. Der
> führende Plan ist jetzt `PLAN.md`. Diese Datei bleibt als Referenz.

> **Für den ausführenden Bot:** Dieses Dokument ist selbsttragend. Arbeite die
> Pakete IN REIHENFOLGE ab. Nach jedem Paket: `tsc` + Verifikation (unten) +
> Haken hier im Dokument setzen. Vollständige Audit-Befunde (5 Dimensionen,
> inkl. Best-Practice-Recherche) liegen unter:
> `/private/tmp/claude-501/-Users-kevindieckmann-Claude-Projects-KEMARIS/2d3c25e4-45de-49bd-a381-096e05bee566/tasks/wzay3bk0x.output`
> (falls weg: Kern steht in diesem Plan).

---

## 0 · Kontext in 60 Sekunden

- **Was:** Kevins persönliches Life+Business-OS (JARVIS-Idee). Next.js 14 App Router,
  lokal auf seinem Mac, Port 3001, single-user. Route der App: `/os`.
- **Server:** läuft über `~/.make-os/launch.sh` (fester Node in `~/.make-os/node`).
  Für Werkzeuge: portables Node unter `/tmp/node-v22.16.0-darwin-arm64/bin/node`.
- **Design:** Klar·Dark, token-getrieben (`THEME` in `lib/make-one/os-data.ts`). Deutsch. Anrede „Sir".
- **Persistenz:** JSON-Stores `.data/*.json` über `lib/store/local-db.ts`
  (loadJson/saveJson/updateJson — serialisiert, tägliche Backups nach `.data/backup/`).
- **KI:** `lib/anthropic.ts` (askText/askJson/askWithSearch; Retry, Timeout,
  Thinking-sicher, `fremd()`/`FREMD_REGEL` gegen Prompt-Injection).
  Agenten-Konfig: `lib/agent-config.ts` (`resolveAgent(id)` → Modellstufe
  Haiku/Sonnet/Opus + enabled; wird von den meisten Agenten-Routen respektiert).
- **Zugangsschutz (NEU, verifiziert):** `middleware.ts` — Schlüssel `MAKE_OS_KEY`
  aus `.env.local` gilt IMMER (auch localhost). Browser: einmal `/os?key=…` →
  signiertes HMAC-Cookie 30 Tage. **Interne Server-Selbstaufrufe brauchen den
  Header `x-make-key: process.env.MAKE_OS_KEY`** — bei JEDEM neuen internen
  fetch dran denken! CSRF: fremde Origins auf Nicht-GET → 403.
- **Kern-Flüsse:** Tageslauf-Kette (`/api/tageslauf`, Arten voll/kurz/puls) →
  Tagesstart (`/api/tagesstart`, läuft beim ersten Öffnen) → Taktgeber
  (Browser-Intervall, stündlich). Loops (`/api/loop`: woche/rueckblick;
  morgen ist durch Tageslauf faktisch ersetzt → Paket 3). Performance-Index
  `lib/performance.ts` (21 Faktoren, 5 Säulen, Messlücken-Prinzip).
  Roadmap/Bauplan: `/os/roadmap`, `/os/bauplan` (Store `backlog`, 47+ Punkte, 7 Phasen).

### Arbeitsregeln (nicht verhandelbar)
1. **Ehrliche Daten:** nie Werte erfinden. Fehlende Quelle = Messlücke, wird
   ausgewiesen. Testdaten nach Tests IMMER zurücksetzen (`.data/…` aufräumen).
2. **Human-in-the-Loop:** alles, was nach außen geht (Mail-Versand, Kalender-
   Schreiben, Bestellungen), bleibt hinter einem Klick von Kevin.
3. **Privatsphäre:** Gesundheit/Whoop/Journal/Wittner nie in Business-Kontexte
   (Board filtert auf `category === 'business'`). `.env.local` nie anzeigen.
4. **max_tokens großzügig** (≥3000 bei sonnet-5, extended thinking frisst Budget),
   Text-Blöcke per `type==='text'` filtern — macht `lib/anthropic.ts` zentral.
5. **UI-Race:** nach `form_input` im Browser-Test einmal warten/nachklicken.
6. **Datum:** NUR `lib/zeit.ts` (`localDay/tagePlus/alterStunden`) — nie `toISOString().slice(0,10)`.
7. Verifizieren per curl gegen `http://localhost:3001` — mit Cookie oder Header
   `x-make-key: $(grep ^MAKE_OS_KEY= .env.local | cut -d= -f2)`.

---

## 1 · Heute bereits gebaut & verifiziert (NICHT wiederholen)

- ✅ **Zugangsschutz gehärtet** (`middleware.ts`): Host-Header-Bypass beseitigt,
  HMAC-Cookie statt Klartext, CSRF-Origin-Check, interner Dienstweg `x-make-key`,
  403-Seite mit Eingabemaske. 7 curl-Checks bestanden (localhost ohne Cookie 403;
  gefälschter Host 403; ?key 307+Cookie; Cookie 200; x-make-key 200; fremder
  Origin-POST 403; Cookie ohne Klartext-Key). `launch.sh` öffnet mit `?key=`,
  `chmod 600 .env.local`.
- ✅ **Backups + Guards** (`lib/store/local-db.ts`): tägliche Sicherung je Store
  nach `.data/backup/<name>-<tag>.json` (14 behalten), Store-Namens-Validierung.
  Schrumpf-Wächter (409) in `state/journal` + `state/health` PUT.
- ✅ **Prompt-Injection-Schutz**: `fremd()`/`FREMD_REGEL` in `lib/anthropic.ts`;
  verdrahtet im Tageslauf (Wächter-Mails + Ausrichtung).
- ✅ **PWA**: `public/manifest.webmanifest`, Icons (192/512/apple-touch, Klar-Dark-Orb),
  Meta in `app/layout.tsx` (standalone, themeColor #0B0E10). iPhone: Seite öffnen →
  „Zum Home-Bildschirm".
- ✅ **`lib/zeit.ts`** (eine Datums-Quelle) und **`lib/brain.ts`** (gatherBrain +
  promptBrain + Blöcke + NORDSTERN/MILESTONES) — **erstellt und tsc-sauber,
  aber noch NICHT verdrahtet** → Paket 1.

---

## 2 · Arbeitspakete (in dieser Reihenfolge)

### ✅ Paket 1 — Brain verdrahten — ERLEDIGT (31.07. Abend)
> kimmi, loop, fokus, board, okr, tageslauf laufen über gatherBrain/promptBrain.
> Board/OKR lesen server-seitig (Board-Privatfilter jetzt SERVER-seitig, business-only).
> MOCK_TASKS-Fallbacks entfernt. Datums-Konsolidierung: 0 `toISOString().slice(0,10)`-Treffer.
> Verifiziert: 27 Seiten 200 · Kimmi-Statuscheck echt · Wochen-Loop zitiert Index · Puls-Kette 17s · Board autonom ohne Body.
**Warum:** 4 parallele Kontextsammler mit divergierenden Frische-Regeln; Kimmi
mischt hartkodierte MSI-Zahlen mit dem echten Index; Mock-Tasks tauchen als
angebliche Prioritäten auf.
**Wie:**
1. `app/api/kimmi/route.ts`: Funktion `liveContext()` komplett ersetzen durch
   `const b = await gatherBrain(); return promptBrain(b);`. Lokale Konsten
   `MILESTONES` löschen (aus `@/lib/brain` importieren), `TEAM`-Konstante löschen
   (Systemprompt nutzt `blockZiele()` schon via promptBrain — die expliziten
   MILESTONES/TEAM-Abschnitte im systemPrompt dann entfernen, sonst doppelt).
   **MOCK_TASKS/MOCK_PROJECTS-Fallback ersatzlos streichen** (leerer Store =
   ehrliche Ansage, macht blockAufgaben). Hartkodierte MSI/`computeMsi`/
   `MSI_PILLARS`/`FOCUS_NOW`-Bezüge im Prompt entfernen (Index kommt aus blockIndex).
2. `app/api/loop/route.ts`: `gather()` intern auf `gatherBrain()` umstellen,
   Rückgabefelder mappen (open/overdue/dueToday/critical/fin/prospects/
   todaysEvents→kalender.heute/weekEvents→kalender.woche/calAt/calAgeH/calStale/
   perf→index). `loopLog` = `recentRuns(undefined, 30, 'loop-')` (voller Payload nötig!).
   Eigene localKey-Funktion löschen → `lib/zeit`.
3. `app/api/fokus/route.ts`: Task-Laden + MOCK-Fallback raus →
   `blockAufgaben(b, 15)`; Vitals hat er schon via resolveVitals — auf `b.vitals` umstellen.
4. `app/api/board/route.ts` + `app/api/okr/route.ts`: Server liest selbst via
   gatherBrain; POST-Body wird OPTIONALER Override (`p.finance ?? b.finance` …).
   Dann sind beide autonom aufrufbar (für spätere Zeitpläne).
5. `app/api/tageslauf/route.ts`: Schritte kalender/aufgaben auf Brain-Felder;
   Ausrichtung nutzt blockIndex/blockVitals statt eigener computeIndex/resolveVitals-Aufrufe.
6. Datums-Duplikate: `localDay` in `lib/performance.ts`, `lib/vitals.ts`
   (re-export ok), `tagKey` in `lib/tageslauf.ts`, `todayISO` in `kit.tsx`,
   Kopien in Views → alle auf `lib/zeit` umstellen (re-exports erlaubt, Logik nur 1×).
**Fertig wenn:** `grep -rn "toISOString().slice(0, 10)" app lib components` = 0 Treffer;
kimmi-Antwort nennt echte Aufgaben + echten Index (curl-Test „Statuscheck");
`grep -c "MOCK_TASKS" app/api` = 0.

### ✅ Paket 2 — Letzte KI-Inseln — ERLEDIGT (31.07. Nacht)
> kimmi läuft über askText (`raw` trägt die Tool-Use-Blöcke; `stop_reason: tool_use` gilt als Erfolg),
> inbox/draft über askText + fremd()/FREMD_REGEL + resolveAgent('inbox'), News-Schritt nutzt extractJson,
> Morgen-Loop-Kachel aus /os/loop entfernt (Verweis auf Tageslauf). grep api.anthropic.com → nur lib/anthropic.ts.
> DAZU (Kevin-Wunsch): Die Intelligenz heißt jetzt **JARVIS** — Persona-Prompts (kimmi/loop/tageslauf/performance),
> UI (JARVIS · ONLINE, „Sprich mit Jarvis …", „JARVIS denkt nach"), ORCHESTRATOR in agents-data.
> Prompt fixiert: **Sir + DUZEN** („du hast 3 Termine, Sir") — nicht siezen. Das OS heißt weiterhin MAKE OS.
1. `app/api/kimmi/route.ts` auf `lib/anthropic` umstellen — ACHTUNG Tool-Use:
   askJson kann kein Tool-Use → entweder `askRaw`-Erweiterung in lib/anthropic
   (body-Passthrough mit tools, Retry/Timeout wiederverwenden) oder kimmi behält
   seinen fetch, nutzt aber `MODEL`-Konstante + extractText aus lib/anthropic. Bevorzugt: `askRaw`.
2. `app/api/inbox/draft/route.ts` → askText + `fremd()` um Mail-Inhalte + FREMD_REGEL.
3. `app/api/tageslauf` News-Schritt: `r.text.match(/{…}/)`-Regex durch askJson ersetzen
   (askWithSearch liefert Text — besser: `extractJson` aus lib/anthropic nutzen).
4. `/os/loop`: Morgen-Loop-Kachel entfernen (Tageslauf ersetzt ihn), Wochen-Loop +
   Rückblick bleiben. Redirect-Hinweis „Morgens → Tageslauf".
**Fertig wenn:** `grep -rln "api.anthropic.com" app lib` → nur `lib/anthropic.ts`.

### ✅ Paket 3 — Ausrichtung wird Handlung — ERLEDIGT (31.07. Nacht)
> tasks/create: Duplikat-Schutz (normalisierter Titel + offen → duplikat:true statt Doppel-Anlage),
> Titel-Limit 300, dueDate-Plausibilität. TasksContext hat `rehydrate()` — Pflicht nach jedem
> server-seitigen Task-Write, sonst überschreibt der debounced PUT des Providers die neue Aufgabe.
> „→ Aufgabe"-Knöpfe: Tagesstart-Prioritäten (+ „Alle übernehmen") und TageslaufView
> (Ausrichtung + Wächter-Vorzieher aus dem prioritaet-Schritt-Detail).
> Verifiziert: 2. Anlage → duplikat:true; Test-Task sauber entfernt; Kernseiten 200; tsc 0.
### Paket 3 (alt — erledigt, Text bleibt als Referenz)
1. Ausrichtungs-Prioritäten + Wächter-Vorzieher bekommen in `Tagesstart.tsx` und
   `TageslaufView.tsx` je einen Knopf „→ Aufgabe" (POST `/api/tasks/create`,
   existiert; projectId-Zuordnung wie Meeting-Agent; Duplikat-Schutz: gleicher
   Titel + offen → nicht doppelt anlegen, Route entsprechend erweitern).
2. „Alle 3 übernehmen"-Knopf.
3. Nach Übernahme: TasksContext-HYDRATE auslösen (bekannter Konflikt: der
   Provider überschreibt sonst per PUT — siehe Review-Befund in Memory).
**Fertig wenn:** Klick legt echte Task an, doppelter Klick legt KEINE zweite an,
Aufgaben-Seite zeigt sie sofort.

### ✅ Paket 4 — M365 sichtbar — ERLEDIGT (31.07. Nacht)
> kemaris-calendar + microsoft Routen schreiben ihre Snapshots write-through in Stores
> (kemaris-calendar.json, microsoft-inbox.json, je mit `at`). Brain mergt: KEMARIS-Termine
> in kalender (Dedupe Titel+Startminute; stale nur wenn BEIDE Quellen alt; quellen{apple,kemaris}
> mit Einzelaltern) + `msMails.ungelesen` als eigenes Feld. Tageslauf-Postfach zeigt beide Konten
> („31 ungelesen (5 KEMARIS/M365, 26 Apple) · M365-Snapshot 29 Std. alt").
> Verifiziert: M365-only-Termin „CheckIn (Reach-Out)" in der Kette sichtbar; Wächter sieht
> Alex' Mail und erkennt korrekt, dass sie schon als kritische Aufgabe geführt ist.
> Hinweis: Snapshots altern, bis M365 live ist (Azure) — Aktualisieren weiterhin per
> „Microsoft-Daten aktualisieren"-Zuruf an Claude (schreibt die Route-Konstanten neu; GET seedet den Store).
### Paket 4 (alt — erledigt, Referenz)
Audit-Kernbefund: M365-Kalender/-Mails stecken als Code-Konstanten nur im UI —
die Loops planen Kevins Tag OHNE Firmenkalender.
1. `app/api/kemaris-calendar/route.ts` + `app/api/microsoft/route.ts` lesen:
   Snapshots in Stores schreiben (`kemaris-calendar`, `microsoft-inbox`) mit `at`.
2. `gatherBrain`: Kalender = apple-cache GEMERGT mit kemaris-Snapshot (dedupe über
   Titel+Start); Mails-Block analog (apple + microsoft) für Tageslauf-Postfach-Schritt.
3. Frische je Quelle ausweisen (alterStunden).
**Fertig wenn:** Tageslauf-Postfach-Schritt zählt beide Postfächer; Termine-Schritt
enthält KEMARIS-Termine (CapOS TownHall etc.).

### ✅ Paket 5 — Autonomie wirkt — ERLEDIGT (31.07. Nacht)
> Task-Agent auf „autonom" → Tageslauf-Ausrichtung legt die Prioritäten SELBST als Aufgaben an
> (interner /api/tasks/create mit x-make-key, Duplikat-Schutz greift, `autoAufgaben` im Ergebnis).
> Kalender-Agent auf „autonom" → analyse trägt Schutz-Blöcke direkt via /api/apple-calendar/create ein
> (`eingetragen:true`, View stellt Knöpfe auf ✓). Standard bleibt freigabe/entwurf = Knöpfe.
> AgentenView erklärt je Stufe die echte Wirkung (+ Sonderhinweis bei task/kalender).
> Verifiziert: autonom → 2 Aufgaben automatisch angelegt („Die 4 kritischen durchgehen", „Alex-Mail sichten"),
> danach Config + Store sauber zurückgesetzt (17 = 17).
### Paket 5 (alt — erledigt, Referenz)
`resolveAgent().autonomy` wird bisher kaum ausgewertet.
1. Konvention: `autonom` = Ergebnis direkt anwenden + loggen; `entwurf`/`freigabe` =
   nur vorlegen (Buttons); `vorschlag` = nur Text.
2. Konkret umsetzen wo es JETZT etwas ändert: Tageslauf-Ausrichtung (autonom →
   Prioritäten werden direkt als Tasks angelegt, Paket-3-Route nutzen; sonst Buttons)
   und Kalender-Agent (autonom → Blöcke direkt eintragen; aktuell freigabe = Buttons bleiben).
3. AgentenView: kurzer Hinweistext je Stufe, was sie WIRKLICH bewirkt.
**Fertig wenn:** Umschalten von entwurf→autonom beim Tageslauf erzeugt beim
nächsten Lauf Tasks ohne Klick (und zurück).

### Paket 6 — Härtungs-Rest (klein, wichtig)
1. `POST /api/state/agent-log`: `agent` gegen bekannte IDs aus `agents-data`
   whitelisten (+ `loop-*`, `tageslauf-*`, `performance`).
2. `app/api/state/backlog` POST: Feld-Längen begrenzen (titel 200, warum 2000).
3. `tasks/create`: title trim + 300 Zeichen, dueDate-Plausibilität (>= 2020-01-01).
4. Rate-Grenze für teure Routen (tageslauf voll, research): in-memory „läuft
   bereits"-Sperre → 429 statt Doppel-Lauf (Taktgeber + Kevin gleichzeitig).
**Fertig wenn:** doppelter paralleler voll-Lauf → einer läuft, einer 429.

### Paket 7 — Score-Vervollständigung (aus Bauplan `steuerung`)
1. Meilenstein-Faktor in Säule Business (`lib/performance.ts`): MILESTONES aus
   brain parsen (✓-Anteil der terminierten; überfällige benennen).
2. Postfach-Last-Faktor in Planung (ungelesen aus mail-Snapshot, 0=100, 50+=0, stale→Messlücke).
3. Lebensrad-Entscheid liegt bei Kevin — NICHT bauen, nur im Bauplan lassen.
**Fertig wenn:** /os/performance zeigt die zwei neuen Faktoren mit Quellen.

### Paket 8 — Abnahme-Lauf (Pflicht am Ende)
```bash
N=/tmp/node-v22.16.0-darwin-arm64/bin/node
cd ~/Claude/Projects/KEMARIS/make
$N node_modules/typescript/bin/tsc --noEmit            # 0 Fehler
KEY=$(grep ^MAKE_OS_KEY= .env.local | cut -d= -f2)
for p in /os /os/tageslauf /os/loop /os/roadmap /os/bauplan /os/performance \
         /os/saeule/health /os/saeule/business /os/saeule/planning /os/saeule/finance /os/saeule/social \
         /os/agenten /os/kalender /os/controlling /os/okr /os/board /os/meeting /os/content \
         /os/research /os/prospecting /os/gesundheit /os/journal /os/inbox /os/aufgaben /os/woche /os/fokus; do
  curl -s -o /dev/null -w "%{http_code}  $p\n" -H "x-make-key: $KEY" -m 30 http://localhost:3001$p
done                                                    # alle 200
# Gate-Suite (alle 7 Checks aus Abschnitt 1 wiederholen!)
# Tageslauf voll + kurz + puls je 1× (mit x-make-key), Kimmi-Statuscheck,
# danach Testdaten aufräumen (vitals/tagesstart/rituale nur wenn selbst erzeugt).
```
Danach: Memory-Datei `make-os-real-app-build.md` fortschreiben + erledigte
Bauplan-Punkte über `POST /api/state/backlog` (gleiche id = Update) auf `erledigt`.

---

## 2b · Außerplanmäßig erledigt (31.07. Nacht)

- ✅ **Jarvis führt Agenten selbst aus (run_agent):** Tool-Use-Schleife in kimmi (max 3 Runden, Budget 4, PARALLELE Ausführung), runAgent() für research/board/okr/controlling/fokus/kalender (intern via x-make-key, respektiert resolveAgent + Autonomie-Gates), ran-Chips im Chat, controlling body-optional. Freigaben unangetastet. Verifiziert: board 37s, fokus+okr parallel 54s.

- ✅ **Startseite auf das neue Konstrukt:** Fest-Zahlen raus (KSI/EBA/Recovery/alter Lagebericht), Fokus-Banner aus echten Aufgaben, Jarvis-Lagebericht aus letzter Tageslauf-Ausrichtung, Konstrukt-Strip „So arbeitet MAKE OS" (Eingang → Brain → Jarvis & Agenten → Handlung → Messung, alles klickbar), Modul-Kacheln ehrlich + Roadmap-Kachel.

## 3 · Danach (nicht heute — Reihenfolge = Roadmap `/os/roadmap`)

1. **Zeitplan ohne Browser** (`loop-automatisch`): launchd-Job ruft
   `curl -H "x-make-key:…" -X POST /api/tageslauf` (07:30 voll, stündlich puls) —
   damit läuft der Takt auch bei geschlossenem Browser.
2. **Whoop-API** (wartet auf Kevins Client-ID/Secret) → OAuth-Fundament
   (`oauth-fundament` im Bauplan) zuerst, dann entfällt der Morgen-Check.
3. **Transkript-Agent** (Phase 2, braucht Mikrofon-Freigabe + Entscheid lokal/Dienst).
4. **M365 live** (Azure-App), **Miro live** (Token), **HubSpot** (Connector-OAuth).
5. **Kundenbereich** (Phase 5), **Ernährung/Malin** (Phase 6), **SQLite/Supabase +
   Mandanten** (Phase 7 — erst wenn Produktweg konkret).
6. Best-Practice-Ideen aus dem Audit (Memory-Schichten episodisch/semantisch,
   Supervisor-`run_agent`-Tool für MAKE, Alerts/Risk-Shields) → als Bauplan-Punkte
   pflegen, nicht ad hoc bauen.

## 4 · Was Kevin selbst tun muss (gesammelt)
- iPhone: einmal `http://<Mac-IP>:3001/os?key=<MAKE_OS_KEY>` öffnen → „Zum
  Home-Bildschirm". (Schlüssel steht in `.env.local`; Mac-IP: `ipconfig getifaddr en0`.
  Für unterwegs: Tailscale auf Mac+iPhone, gleiche URL mit Tailscale-IP.)
- Whoop-Developer-App registrieren (Bauplan `whoop-api`).
- Systemeinstellungen → Erinnerungen-Zugriff (Bauplan `reminders-freigabe`).
- Ist-Zahlen ins Controlling (Bauplan `controlling-zahlen`).
- Morgens: Morgen-Check (15 Sek.) bis Whoop automatisch fließt.
