# MAKE OS — Projekt-Regeln

Das private Life & Business OS von Kevin & Malin. Eigenständiges Projekt —
bewusst getrennt von KEMARIS (Firma) und CapOS (Produkt). Next.js 14, läuft
lokal, Route `/os`, Port 3001.

## Team & Sprache
- Antworte auf Deutsch. Kevin bevorzugt klickbare Entscheidungsrunden
  (AskUserQuestion) bei offenen Richtungsfragen.
- Malin und Kevin haben beide vollen Zugriff auf alles in diesem System.
- Diktat-Falle: „Berlin" oder „Marlene" im Diktat meint meist **Malin**.

## Leitbild & Terminologie (Kevin & Malin, 01.08.2026)
- **Jarvis-Mentalität, immer:** Wir arbeiten dauerhaft an unserer eigenen
  Software weiter. Ziel ist EINE zentrale Intelligenz mit allen Daten über
  alle Beteiligungen, die auch Familie & Alltag mitsteuert — Fernziel ein
  Sprach-Assistent zu Hause. Immer nach ethisch/moralisch sauberen Maßstäben.
- **KD Ventures UG ist DIE Firma.** Gegründet als „KD Management UG" — dieser
  Name wird überall ersetzt und nie mehr verwendet. KEMARIS ist nur eine
  Beteiligung der KD Ventures (Kevins Hauptfokus, aber Risiko wird gestreut).
  KD-Ventures-Aktivitäten gehen **nie in Konkurrenz zu KEMARIS** — sie ist die
  größte Beteiligung und das größte Gut.
- **Synonyme im Sprachgebrauch:** „die Selbständigkeit" = Kevin Dieckmann
  Consulting (Einzelunternehmen) · „die Beteiligungsgesellschaft" = KD Ventures UG.
- **Malin ist Gesundheits-Beauftragte** (Sport, Ernährung, Hyrox-Pro-Ziel) —
  Gesundheitsthemen laufen über sie.
- **Kritisch pulsiert:** Priorisierung nach Eisenhower; kritische Aufgaben
  werden im System visuell pulsierend hervorgehoben.

## Eiserne Regeln
1. **Privates bleibt hier.** Gesundheits-, Journal- und Finanzdaten gehören
   Kevin & Malin. `.env.local` und `.data/` sind gitignored und bleiben es —
   niemals Schlüssel oder echte Daten committen oder in Code schreiben.
2. **Rohbau-Regel:** An Dritte (z. B. Alex/KEMARIS) geht nur Code, Struktur
   und Regeln — niemals Daten. Das Repo ist genau so geschnitten.
3. **Human-in-the-Loop:** Nichts verlässt das System Richtung Dritter ohne
   Freigabe von Kevin oder Malin. Interne Planung/Buchführung (plan_block,
   Erfassungs-Werkzeuge) darf direkt schreiben.
4. **Testdaten nach Tests zurücksetzen** — vorher prüfen, ob ein Wert wirklich
   vom Test stammt und nicht von Kevin/Malin echt eingetragen wurde.

## Design & Produkt
- Design-Sprache: Klar·DARK — Token in `lib/make-one/os-data.ts` (THEME),
  Petrol `#21B5AA` als Akzent. Motion-Sprache in `app/globals.css`.
- **Keine Untertitel/Hinweise hinter Namen** — Namen stehen allein.
- Startseite heißt „Dashboard". Interne Navigation immer `next/link`, nie `<a>`.
- Charts: die drei Teals (health/planning/finance) nie gemeinsam als Serien —
  Finanzen im Chart = Kupfer `#DE9E63`.

## Technik
- TypeScript strikt: vor jedem Commit `npx tsc --noEmit` — null Fehler.
- Node liegt bei Kevin unter `/tmp/node-v22.16.0-darwin-arm64/bin` (nicht im
  PATH). Server startet über `./start.sh` bzw. `.claude/launch.json` —
  Dev-Server nie zusätzlich per Bash starten, wenn schon einer auf 3001 läuft.
- Stores: JSON-Dateien unter `.data/` via `lib/store/local-db.ts`
  (loadJson/updateJson). API-Gate: `x-make-key`-Header (MAKE_OS_KEY).
- `route.ts` darf keine Extra-Exporte tragen (Next) — geteilte Typen in `lib/`.
- Seiteneffekte nie im setState-Updater (StrictMode führt doppelt aus).
- KI-Aufrufe über `lib/anthropic.ts` (askText/askJson) — nie direkt.
- `main` bleibt immer lauffähig: Feature-Branches, kleine Commits, Merge nach
  kurzem Review.

## Doku
- **Schlanke, lebendige Oberfläche (seit 23./24.09.2026):** neue Seiten nur mit
  den Bauteilen aus `components/os/schlank.tsx` (Seite, Karte, Ring, Zahl,
  Balken, Chip, Zeile, Haken, Segmente) und den Leuchtfarben `LEUCHT` aus
  design.ts — Karten mit Tiefe, Glow, hochzählende Zahlen, gestaffeltes
  Erscheinen; eine Ebene, nie eine Null, Farbe bedeutet Zustand. Alle Einträge der
  Leiste (Heute · Wachstum · Gesundheit · Inbox · Aufgaben · Zahlen · Kontakte ·
  Jarvis · System) sind umgebaut; Anmeldung führt zu Heute, Jarvis ist kein
  Vorspann mehr. Der **Wachstums-Score** steht als Kopf über jeder Seite
  (`WachstumsKopf`) — der Score, auf den wir hinarbeiten; sechs Säulen
  (Gesundheit 35 · Business 20 · Finanzen 15 · Planung 10 · Beziehung 10 ·
  Agenten 10, Regel in `lib/agenten-score.ts`), jeder Ring ein Sprung auf
  seine Seite. Seit 24.09. laufen ALLE Seiten und Mitläufer auf diesen Bausteinen; kein
  Bauteil unter `components/os` nutzt mehr `THEME`. ESLint muss grün bleiben
  (`npx next lint`), sonst bricht der Produktions-Build. Breite Seiten teilen
  sich mit `Spalten`/`Spalte`/`Raster` auf (ab 1180 px nebeneinander); keine
  Seite bleibt eine schmale Spalte in der Mitte.
- **Whoop-Export:** `lib/whoop-export.ts` + `/api/import/whoop` (ZIP, CSV oder
  neuester Export aus ~/Downloads, je Person). Knopf unter Gesundheit und
  Verbindungen. Neue Seiten: nie THEME, nie
  Rahmen-Kästen, nie Schrift unter 11, nie eine Null. Alte Ansichten liegen unter
  `/os/uebersicht`, `/os/aufgaben/board` und `/os/inbox/voll`.
- **Haushaltsfinanzen (24.09.2026): Malins MAKE.ORGA zieht nach MAKE OS.**
  Zahlen = Privat | Business | Gesamt. Logik in `lib/finanzen/haushalt/`
  (Cent, EINE Einordnung `einordnung.ts`, Monate über `monat.ts` — nie
  `new Date(...).toISOString()` für Monate). Zugriff nur über
  `haushaltVon(req)` (Konto.haushalt, setzt nur der Inhaber; kein Rückfall
  auf „kevin“). Privat zählt in keiner Business-Rechnung
  (`istPrivatPosten`/`nurBusiness` in `liquiditaet.ts`). Jarvis: Haushalt NUR
  über `blockHaushalt` in Gespräch/Morgen/Empfang, nie in `gatherBrain`.
  Test-Haushalt „test“ für Fotos, echte Prüfdaten nur in `.data/pruefdaten/`.
  Umzug: `app/api/haushalt/umzug`, Einfrieren: `docs/make-orga/`.
- **Head of Finance (24.09.2026): der Finanzagent auf allem.** `lib/finanzen/chef/`:
  `finanzbild.ts` rechnet ALLES deterministisch (Business, Haushalt nur mit
  Zugang, Brücke, Steuertermine, Hinweise); das Modell ordnet nur ein
  (`prompt.ts`, 5 Modi, JSON-Schema). `pruefer.ts` prüft jede Zahl, Quelle,
  Frist + Vollzug/Anlageprodukte → eine Korrekturrunde. Er bewegt nie Geld:
  Vorschläge → Freigabe-Liste (`stand.ts`, Dedup) → angenommen = Aufgabe
  (privat ohne Beträge, Tag „haushalt“). Takt über `plan.ts`/`takt.ts`, ein Lauf
  je Haushalt gleichzeitig; Haushalts-Ergebnisse in Warteschlange/Agenten-Log
  nur als Zähler. Speicher: `finanzchef` (Business) · `haushalt-chef--<h>`.
- **Navigation (24.09.2026, Kevins Vorgabe):** links nur Jarvis · Brain (Wissen) ·
  CRM · Fokus · Aufgaben (`lib/make-one/navigation.ts`, Test `navigation.test.ts`);
  alles andere oben im `WachstumsKopf` (Heute, Inbox, Säulen-Ringe). `/os/fokus`
  ist eine eigene Seite (Fokus je Horizont, Tagesform, Regler).
- **Familie & Partnerschaft (24.09.2026):** `/os/familie`, Logik `lib/familie/`,
  Speicher `familie--<haushalt>` nur über `haushaltVon`. Gemessen wird der
  Pflege-Rhythmus des PAARES (28 Tage, Gewichte in `logik.ts`), nie eine Person,
  nie Gefühle; Ausnahmezeit pausiert. „nur-ich“-Einträge und ungeteilte
  Reparatur-Reflexionen sieht und ändert nur, wer sie schrieb (serverseitig
  erzwungen). Säule „Familie & Partnerschaft“ im Score = Pflege-Rhythmus.
  Konzept: `docs/konzepte/familie-und-partnerschaft.md`.
- **CRM (24.09.2026): alles zur Kundengewinnung unter `/os/crm`** — Heute (Power
  Hour) · Kartei · Pipeline · Kunden · Marketing · Events. Personen im Speicher
  `kontakte` (Modell `lib/make-one/crm.ts`), alles daran im Speicher `crm`
  (`lib/crm/`: pipeline, recht, heute, kunden, events, dubletten, umzug).
  Grundkonzept aus der Markttraktion (KEMARIS Operations) — **Daten nur eigene**
  (Masterdatei `~/Desktop/CRM Leadordner`, Brain); nie Daten aus Operations/HubSpot
  holen, das Adressbuch der Kontakte-App bleibt draußen. **Kanal-Ampel
  (`lib/crm/recht.ts`) gilt für jede Karte, jeden Entwurf, jedes Agentenpaket**:
  LinkedIn-Nachricht = elektronische Post, Kaltanruf nur mit Anlass, Werbesperre
  sperrt alles — keine Rechtsberatung, einmal anwaltlich gegenlesen. Kunden
  = Mandate (`kundenAusMandaten` für Score/Jarvis); Mandat → Liquiplan nur als
  Vorschlag (`/api/crm/liquiplan`), nie automatisch. Konzept:
  `docs/konzepte/crm-sales-marketing-events.md`.
- **Die drei Heads (24.09.2026):** Sales, Marketing, Event in `lib/heads/`
  (Muster wie Head of Finance: Code rechnet das Datenpaket, Prüfer streicht
  erfundene IDs, Sperren und unzulässige Kanäle, Vollzug/unbelegte Zahlen →
  Korrekturrunde; Freigabe-Liste `head-<id>`; angenommen = nächster Schritt an
  der Person oder Aufgabe). Nie `privatNotiz`, nie gesperrte Personen ins Paket.
  Takt in `lib/heads/takt.ts`, eingehängt in `lib/jarvis/takt.ts`.
- **Eine Kasse (24.09.2026).** Business-Kasse = Summe der Firmenkonten
  (`geschaeftsKasse`/`mitKasse` in `finance-data.ts`); `finance.cash` nur
  Rückfall. Rest-Monate ab heute (Berlin). Keine zweite Runway-Formel bauen.
- **Selbstaufrufe nie über die Anfrage-Adresse (24.09.2026).** Routen, die
  andere Routen mit `x-make-key` aufrufen, nehmen `innenAdresse(req)` aus
  `lib/innen.ts` — nie `new URL(req.url).origin` (Vorbau Tailscale/Caddy,
  Schlüssel an fremden Host). Einladungslinks: `MAKE_OS_ADRESSE`.
- **Obsidian ist Wissensbank Nummer eins (24.09.2026).** `lib/jarvis/vault.ts`
  liest `~/Desktop/MAKE/Make.Claude` zuerst, dann die iCloud-Doku. Es gelten
  Kevins Regeln aus dem Vault (`AGENTS.md`, `Vertraulichkeitsregeln.md`):
  `scope: privat` nie an Agenten/Hintergrundläufe und nie in Texte nach außen;
  Schreiben nur als Protokoll oder Anhang an `Offene_Fragen_Brain`,
  `Taskmanagement_Brain`, `Jarvis_Log` — Fundament und Quellen nie, im Ordner
  MAKE wird nichts gelöscht. Seite `/os/wissen` mit Chat „Fragen“
  (`lib/jarvis/brain-chat.ts`, nur lesend, antwortet nur aus Notizen mit Quelle),
  Tests `vault-sicht`/`markdown`/`brain-chat`.
- **`PLAN.md` ist der führende Plan (seit 18.09.2026).** Bestand bleibt und
  wird auf Hetzner hochgefahren; Reihenfolge Hochfahren → Aufgaben → CRM →
  Anbindungen → Prozesse. Ein Bereich wird fertig und benutzt, dann der
  nächste. Keine Spielerei — Kevins Ansage. `UMSETZUNGSPLAN.md` ist erledigt.
- **Das Gedächtnis liegt im Obsidian-Vault**, nicht nur im Repo:
  `iCloud/Make Privat ❤️/MAKE OS/05 Wissen/MAKE OS/`. Einstieg dort:
  `MAKE OS — Karte.md`. 21 verlinkte Notizen (07.09.2026) mit dem kompletten
  Weg seit 19.06., allen Entscheidungen samt Begründung, den Fehlern und ihren
  Lehren, der Codelandkarte, dem tragenden Code im Original und Kevins
  Wunschliste. **Vor größeren Umbauten dort nachlesen** — die Begründungen
  stehen nirgends sonst. Jarvis findet die Notizen über `suche_wissen`.
  Achtung: der Vault liegt in iCloud — dort niemals Schlüssel ablegen.
- `BEWEGUNG.md` — die Bewegungssprache: 30 Punkte aus der Recherche vom 07.09.,
  jeweils mit Begründung.
- `ONBOARDING_MALIN.md` — Einstieg für Malin (mitbenutzen + mitbauen).
- `UMSETZUNGSPLAN.md` — Konzept; der lebende Bauplan liegt in der App
  unter `/os/bauplan`.
