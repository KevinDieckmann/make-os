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
- **Schlanke Oberfläche (seit 23.09.2026):** neue Seiten nur mit den Bauteilen
  aus `components/os/schlank.tsx` (Seite, Zeile, Liste, Haken, Ring, Segmente)
  — keine Rahmen, eine Schrift, große Zahlen, nie eine Null. Alle sechs
  Einträge der Leiste sind umgebaut. Alte Ansichten liegen unter
  `/os/uebersicht`, `/os/aufgaben/board` und `/os/inbox/voll`.
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
