# MAKE OS — Onboarding für Malin

Willkommen im Maschinenraum. MAKE OS ist unser Life & Business OS — Dashboard,
Tag, Inbox, Gesundheit, Finanzen, Planung mit Zeitstrahl, Jarvis. Du hast
vollen Zugriff: mitbenutzen und mitbauen.

## 1 · Mitbenutzen (ohne Code)

Kevins Mac betreibt das System, bis der Server steht (PLAN.md, Phase 1). Du
kommst über **Tailscale** hin — ein privates, verschlüsseltes Netz nur
zwischen unseren Geräten. Das klappt über mobile Daten von überall, ein
gemeinsames WLAN braucht es nicht. (Kevin, 24.09.: Tailscale jetzt als Brücke,
Hetzner parallel.)

**Einmal einrichten (iPhone):**
1. **Tailscale** aus dem App Store laden, mit deinem eigenen Konto anmelden
   (Apple-ID reicht).
2. Kevins Freigabe für seinen Mac annehmen (kommt per Mail oder Link) und in
   der App den Schalter auf „Connected".
3. Den **Einladungslink** von Kevin öffnen (48 Stunden gültig, einmal
   einlösbar). Er sieht so aus: `https://macbook-air-von-kevin.….ts.net/anmelden?code=…`
4. Vorname **Malin**, E-Mail, Passwort mit mindestens 10 Zeichen — fertig. Der
   Vorname wird der Name deiner Daten, deine bisherigen Bestände hängen damit
   an deinem Konto.
5. In Safari Teilen → **„Zum Home-Bildschirm"**: MAKE OS liegt dann wie eine
   App auf dem Handy.

**Was du wissen musst:** Du erreichst MAKE OS nur, solange Kevins Mac läuft,
MAKE OS darauf gestartet ist und der Mac online ist (gerade über Kevins
Handy-Hotspot). Ist er weg, siehst du „Seite nicht erreichbar" — nichts ist
kaputt. Das ändert sich mit dem Server. Im Wissen siehst du alles aus dem
Brain außer Kevins privaten Notizen.

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
