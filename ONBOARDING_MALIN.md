# MAKE OS — Onboarding für Malin

Willkommen im Maschinenraum. MAKE OS ist unser Life & Business OS — Dashboard,
Tag, Inbox, Gesundheit, Finanzen, Planung mit Zeitstrahl, Jarvis. Du hast
vollen Zugriff: mitbenutzen und mitbauen.

## 1 · Mitbenutzen (ohne Code)

Kevins Mac betreibt das System. Solange sein Server läuft:

- Kevin erzeugt unter System → Konto → „Einladen" einen Link und gibt ihn dir
  persönlich (48 Stunden gültig, einmal einlösbar).
- Im selben WLAN den Link öffnen (`http://<IP-von-Kevins-Mac>:3001/anmelden?code=…`;
  die IP steht auf dem Mac unter Systemeinstellungen → WLAN → Details).
- Vorname **Malin**, E-Mail, Passwort mit mindestens 10 Zeichen — fertig. Der
  Vorname wird der Name deiner Daten, deine bisherigen Bestände hängen damit
  an deinem Konto. Danach: `http://<IP>:3001/anmelden` als Lesezeichen.
- Für Zugriff von überall kommt der Server (PLAN.md, Phase 1).

## 2 · Mitbauen (eigene Entwicklungs-Kopie)

Du entwickelst auf einer eigenen Kopie mit eigenen Testdaten — die echten
Daten bleiben auf Kevins Mac. Zusammengeführt wird über GitHub.

1. **Werkzeuge:** Node 22 (nodejs.org) und Git. Optional, aber empfohlen:
   Claude Code (claude.com/claude-code) — damit bauen wir dieses System.
2. **Code holen:** `git clone <GitHub-URL>` (URL kommt von Kevin, das Repo ist
   privat) und dann `cd make-os && npm install`.
   Öffne den geklonten Ordner danach als Projekt in Claude Code — dein
   Claude liest die `CLAUDE.md` und kennt damit unsere Spielregeln.
3. **Umgebung:** `.env.local.example` zu `.env.local` kopieren und eigene
   Werte eintragen — eigener `MAKE_OS_KEY` (frei ausdenken), Anthropic-Key
   von Kevin. Die Datei bleibt auf deinem Rechner, Git ignoriert sie.
4. **Starten:** `npm run dev` → `http://localhost:3001/anmelden`. Beim ersten
   Start „Erstes Konto einrichten" — dafür einmal deinen eigenen `MAKE_OS_KEY`
   aus deiner `.env.local`. Danach ist alles leer — das ist richtig so: deine
   Kopie, deine Testdaten.

   **Im gemeinsamen System** (Kevins Instanz, später der Server) brauchst du
   keinen Schlüssel: Kevin erzeugt unter Konto → „Einladen" einen Code, du
   öffnest die Anmeldeseite → „Ich habe eine Einladung" → Vorname, E-Mail,
   Passwort. Dein Vorname wird der Name deiner Daten (`malin`) — deine
   bisherigen Bestände hängen damit automatisch an deinem Konto.

## 3 · Arbeitsweise

- `main` bleibt immer lauffähig. Für jede Änderung ein eigener Branch
  (`git checkout -b feature/mein-thema`), kleine Commits, dann Pull Request —
  Kevin oder Claude schaut kurz drüber, dann Merge.
- Design-Sprache: Klar·DARK, Petrol `#21B5AA`, keine Untertitel hinter Namen,
  Terminologie wie im System etabliert.
- TypeScript strikt: vor jedem Commit `npx tsc --noEmit` — null Fehler.

## 4 · Eiserne Regeln

1. `.env.local` und `.data/` sind vom Repo ausgeschlossen und bleiben es —
   niemals Schlüssel oder echte Daten committen, niemals Keys in den Code.
2. Was wir an Dritte geben (z. B. Alex), ist immer nur der **Rohbau**: Code,
   Regeln, Struktur. Niemals unsere Daten — Gesundheit, Journal, Ziele,
   Finanzen bleiben bei uns. Das Repo ist genau so gebaut.
3. Ausgehendes (Mails, Nachrichten an Dritte) verschickt das System nie
   selbst — immer erst Freigabe durch einen von uns.
