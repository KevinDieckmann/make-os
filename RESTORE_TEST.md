# Restore-Test am Mac — Klick-Anleitung (Kevin 08.10.2026: „lokal am Mac“)

> Ziel: einmal beweisen, dass sich MAKE OS aus der nächtlichen Sicherung zurückholen lässt — ohne den Server anzufassen.
> Das Werkzeug gibt es schon (`deploy/sicherung-probe.sh`, DEPLOY.md › Probe-Restore); es wurde nur noch nie benutzt.
> Dauer: ca. 30–45 Min. beim ersten Mal. Nie Schlüssel oder Passwörter in den Chat.

**Befund 08.10.:** Am Mac ist dafür noch nichts eingerichtet — kein `age`, kein Abholordner `~/MAKE-OS-Sicherungen`, kein
Abhol-Dienst. Das heißt auch: **der zweite Sicherungsort außerhalb von Hetzner läuft bisher nicht** (nur Hetzner-Backups +
Nachtarchiv auf dem Server). Schritt 2 behebt das gleich mit.

## 1 · age installieren (einmal)
Homebrew ist am Mac nicht installiert. Zwei Wege:
- **Ohne Homebrew:** von https://github.com/FiloSottile/age/releases die Datei `age-v…-darwin-arm64.tar.gz` laden, entpacken,
  `age` und `age-keygen` nach `~/.local/bin` legen (Ordner ggf. anlegen) und `export PATH="$HOME/.local/bin:$PATH"` in `~/.zshrc`.
- **Mit Homebrew:** Homebrew von https://brew.sh installieren, dann `brew install age`.
Prüfen: `age --version`.

## 2 · Abholung vom Server einrichten (einmal — zweiter Sicherungsort)
```
cd ~/Claude/Projects/MakeOS
bash deploy/sicherung-abholen.sh --einrichten
```
Das Skript erzeugt `~/.ssh/make-os-abholung` und zeigt eine Zeile für den Server (nur lesender Zugang). Diese Zeile am Server in
`/home/make/.ssh/authorized_keys` eintragen (wie im Skript beschrieben). Dann den täglichen Dienst laden:
```
cp deploy/de.makeos.sicherung.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/de.makeos.sicherung.plist
```
Einmal sofort holen: `bash deploy/sicherung-abholen.sh` → danach liegt das neueste Archiv in `~/MAKE-OS-Sicherungen`.
Im Head of IT wird „letzte Abholung“ grün.

## 3 · Die Probe
1. Die **age-Identität** (privater Sicherungsschlüssel) aus dem Passwort-Manager in eine Datei mit Rechten 600 legen,
   z. B. `~/.config/make-os/age-identitaet.txt` (`chmod 600 …`). Nach der Probe wieder löschen.
2. Den **Datenschlüssel** nur in die Umgebung geben (nicht in eine Datei):
   ```
   read -rs MAKE_OS_DATEN_SCHLUESSEL && export MAKE_OS_DATEN_SCHLUESSEL
   ```
3. Für den App-Start einmal den Produktionsbau haben (`./start.sh` einmal laufen lassen oder
   `MAKE_OS_DIST=.next-prod node node_modules/next/dist/bin/next build`).
4. Probe starten (neuestes Archiv einsetzen):
   ```
   bash deploy/sicherung-probe.sh ~/MAKE-OS-Sicherungen/make-os-JJJJ-MM-TT.tar.gz.age ~/.config/make-os/age-identitaet.txt --app
   ```
   Das Skript entschlüsselt in einen Temp-Ordner, zählt Bestände (nur Zahlen), startet MAKE OS auf Port 3098 (nur lokal),
   misst die Zeit bis „läuft“ und löscht danach alles wieder.
5. Ergebnis (Datum, Archiv, Anzahl Bestände, Dauer, Auffälligkeiten) in `DEPLOY.md` › Probe-Restore eintragen —
   oder Claude die Ausgabe zeigen (sie enthält keine Inhalte), dann trägt Claude es ein.

## 4 · Danach
- age-Identität vom Mac löschen (sie gehört in den Passwort-Manager), Terminal schließen (Datenschlüssel weg).
- Wiederholen: einmal im Quartal und nach jeder Schlüsselrotation.
