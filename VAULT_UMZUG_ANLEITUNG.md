# Vault-Umzug am Mac — Klick-Anleitung für Kevin (29.09.2026)

**Warum:** Der Obsidian-Vault liegt heute unter `~/Desktop/MAKE` — und der Schreibtisch ist iCloud Drive. iCloud
synchronisiert die Git-Dateien (`Make.Claude/.git`) halb und legt Konfliktkopien an; ein beschädigtes Repo merkt man
erst, wenn der Abgleich scheitert. Seit dem 25.09. gab es am Mac keinen Abgleich mehr (Stand der Prüfung: 53 offene
Änderungen). Ziel: der Vault liegt **außerhalb von iCloud** unter `~/Vaults/MAKE`, abgeglichen wird **nur über Git** —
alle 5 Minuten automatisch, bei Konflikt kommt eine Mitteilung. Der Server-Vault ist die Wahrheit (BRAIN_SERVER_PLAN.md).

**Claude fasst den echten Vault nicht an** — alle Schritte machst du. Dauer: etwa 20 Minuten. Obsidian dabei geschlossen.

---

## 1 · Offene Änderungen festhalten und abgleichen (vor dem Umzug)

1. Obsidian **beenden** (⌘Q).
2. Terminal öffnen und eingeben:
   ```
   cd ~/Desktop/MAKE/Make.Claude
   git status
   ```
   Du siehst die offenen Änderungen (etwa 53 Dateien).
3. Festhalten und abgleichen:
   ```
   git add -A
   git commit -m "Stand vor dem Umzug nach ~/Vaults"
   git pull --rebase
   git push
   ```
   - Endet `git pull --rebase` mit **CONFLICT**: nicht weitermachen. `git rebase --abort` eingeben und Claude fragen
     (Meldung aus dem Terminal zeigen). Nichts löschen.
   - `git push` fragt nach einem Passwort oder scheitert: siehe Schritt 6.3 (SSH-Schlüssel), dann erneut `git push`.
4. Prüfen: `git status` sagt „nothing to commit, working tree clean“ und „up to date with 'origin/main'“.

## 2 · Alles aus iCloud herunterladen

1. Finder → Schreibtisch → Ordner **MAKE** mit Rechtsklick → **„Jetzt laden“** (falls angeboten). Warten, bis kein
   Wolken-/Fortschrittssymbol mehr am Ordner steht.
2. Kontrolle im Terminal — es darf **nichts** ausgegeben werden:
   ```
   find ~/Desktop/MAKE -name "*.icloud" | head
   ```
   Kommen Zeilen: in Finder die betroffenen Dateien öffnen bzw. „Jetzt laden“, dann erneut prüfen.

## 3 · Umziehen nach `~/Vaults/MAKE`

1. Ordner anlegen und verschieben (im Terminal — ein Finder-Ziehen von iCloud weg kopiert manchmal nur):
   ```
   mkdir -p ~/Vaults
   mv ~/Desktop/MAKE ~/Vaults/MAKE
   ```
   Mitgezogen werden auch die anderen Ordner im Vault (Finanz-Cockpit, MAKE.Business, Claude outputs …) — sie gehören
   zum Obsidian-Vault. Verknüpfungen, die auf `~/Desktop/MAKE/…` zeigen (z. B. freigegebene Ordner in Claude), danach
   neu auf `~/Vaults/MAKE/…` setzen.
2. Prüfen:
   ```
   cd ~/Vaults/MAKE/Make.Claude
   git status
   git fsck --no-dangling
   ```
   `git status` sauber, `git fsck` ohne „error“/„missing“. Bei Fehlern: nicht weiter, Claude fragen (der Stand liegt
   zusätzlich auf GitHub und auf dem Server — nichts ist verloren).
3. Auf dem Schreibtisch darf kein Ordner **MAKE** mehr liegen (iCloud braucht ein paar Minuten, bis er überall weg ist).

## 4 · Obsidian neu öffnen

1. Obsidian starten → unten links **Vault-Symbol** („Vault öffnen/verwalten“) → **„Ordner als Vault öffnen“** →
   `Benutzerordner › Vaults › MAKE` wählen → **Öffnen**.
2. In derselben Vault-Liste den alten Eintrag „MAKE“ (Schreibtisch) mit **„…“ › „Aus Liste entfernen“** entfernen
   (entfernt nur den Eintrag, keine Dateien).
3. Hast du das Obsidian-Git-Plugin: **Einstellungen › Obsidian Git** → automatisches Pull/Push/Backup **ausschalten**
   (den Abgleich macht ab jetzt der Mac-Dienst aus Schritt 5 — zwei gleichzeitige Abgleiche erzeugen Konflikte).

## 5 · Automatischen Abgleich einrichten (alle 5 Minuten)

1. Im Terminal:
   ```
   mkdir -p ~/.make-os ~/Library/LaunchAgents
   cp ~/Claude/Projects/MakeOS/deploy/de.makeos.vault-abgleich.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/de.makeos.vault-abgleich.plist
   ```
2. Nach einer Minute prüfen:
   ```
   tail -5 ~/.make-os/vault-abgleich.log
   ls -l ~/Vaults/MAKE/Make.Claude/.git/make-os-letzter-push
   ```
   Die Datei `make-os-letzter-push` zeigt den letzten **erfolgreichen** Push (Uhrzeit). Das Log ist leer, solange alles
   gut geht.
3. **Mitteilungen erlauben:** Beim ersten Konflikt fragt macOS, ob „Skripteditor“ Mitteilungen senden darf → **Erlauben**
   (Systemeinstellungen › Mitteilungen › Skripteditor). So erscheint „Konflikt im Vault“ bzw. „Push fehlgeschlagen“.

## 6 · Wenn etwas hakt

1. **Mitteilung „Konflikt im Vault“:** Terminal → `cd ~/Vaults/MAKE/Make.Claude && git status` — die Datei mit dem
   Konflikt steht dort. Am einfachsten Claude fragen. Solange der Konflikt besteht, zeigt auch der Head of IT auf dem
   Server „Vault-Abgleich: Konflikt“ (rot). Nach dem Lösen läuft der nächste Abgleich von selbst und die Meldung geht weg.
2. **Mitteilung „Push fehlgeschlagen“:** meist Netz oder Schlüssel. Terminal: `ssh -T git@github.com` — muss „successfully
   authenticated“ sagen.
3. **SSH-Schlüssel für den Hintergrunddienst** (einmalig, falls Schritt 2 scheitert):
   ```
   ssh-add --apple-use-keychain ~/.ssh/id_ed25519
   ```
   und in `~/.ssh/config` für `Host github.com` die Zeilen `AddKeysToAgent yes` und `UseKeychain yes`.
4. **MAKE OS am Mac** liest den Vault ab jetzt automatisch unter `~/Vaults/MAKE/Make.Claude` (Entwicklungs-Server einmal
   neu starten). Steht in `.env.local` noch `MAKE_VAULT_DIR=…Desktop…`: Zeile löschen oder auf den neuen Pfad setzen.
   Die App **schreibt** am Mac nie in den Vault (nur der Server-Vault bekommt `_App/` und `_inbox/`).

## 7 · Rückweg (falls nötig)

```
launchctl unload ~/Library/LaunchAgents/de.makeos.vault-abgleich.plist
rm ~/Library/LaunchAgents/de.makeos.vault-abgleich.plist
mv ~/Vaults/MAKE ~/Desktop/MAKE
```
Dann in Obsidian „Ordner als Vault öffnen“ → Schreibtisch › MAKE. (Nicht empfohlen: Git in iCloud bleibt das Risiko.)

---

**Was danach gilt:** Vault nie wieder in iCloud, Schreibtisch oder Dokumente legen (iCloud-Ordner). Gesichert ist er
über Git (Server + GitHub), nicht über iCloud. Löschen einer Person auch im Vault: DATENARCHITEKTUR.md › Art. 17 im Vault.
