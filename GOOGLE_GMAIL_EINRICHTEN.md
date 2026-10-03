# Gmail für MAKE OS einrichten — Schritt für Schritt (03.10.2026)

**Ziel:** Die Post von `@makeinnovation.de` liegt bei Google (Workspace/Gmail). In MAKE OS erscheint sie in der **Inbox**: lesen,
den Kontakten, Firmen und Deals zuordnen, **antworten** (in MAKE OS formuliert, optional mit dem Entwurf von ZOE aus dem Brain),
und aus einer Mail eine **Aufgabe, ein Follow-up oder einen Termin** machen. Google ist nur die Verlängerung — das Original bleibt
in Gmail, MAKE OS hält eine Kopie zum Lesen, Zuordnen und Antworten.

**Was MAKE OS darf — und was nicht:**
- Es bekommt von Google **eine** Freigabe: `gmail.modify` (Mails lesen, als gelesen markieren, archivieren, senden). Es bekommt **nicht**
  den Vollzugriff (`mail.google.com`, der auch endgültig löschen darf) und ändert keine Gmail-Einstellungen (Weiterleitung, Filter).
- **Gesendet wird nur auf deinen Klick** auf „Senden“ — nie von ZOE, vom Takt oder von einem Skript.
- Jede Person sieht nur **ihr eigenes** Postfach (Malin sieht nie Kevins Mails und umgekehrt).
- Fremde HTML-Mails werden **nie** als HTML angezeigt (nur Text), Bilder werden **nie** geladen (Tracking-Pixel), Anhänge gibt es nur als
  Download auf Klick.

**Du brauchst:** das Workspace-**Admin**-Konto von `makeinnovation.de`, das Google-Cloud-Projekt „MAKE OS“ aus
`GOOGLE_KALENDER_EINRICHTEN.md` (Schritte 1–7 dort — ist das schon erledigt, entfällt alles Doppelte), und später je Person das eigene Konto.
Dauer: etwa 20 Minuten (Teil A), Pub/Sub (Teil B) weitere 15 Minuten, DNS (Teil D) 30 Minuten plus Wartezeit.

> **REIHENFOLGE bei der Umstellung von IONOS (Teil D) — nicht vertauschen:**
> 1. Gmail-Konten aktiv, **`hello@` als Gruppe (Kevin + Malin)** angelegt und getestet (D1–D3)
> 2. alte Mails mitnehmen, wenn gewünscht (D4)
> 3. **erst dann** SPF, DKIM, DMARC und **zuletzt der MX** bei IONOS (D5)
> Wer den MX zuerst umstellt, verliert Mails an `hello@`, solange es bei Google noch nicht existiert.

---

## Teil A — Google Cloud: Gmail freischalten

### A1. Gmail API aktivieren
1. <https://console.cloud.google.com> mit dem **Workspace-Admin-Konto**, oben das Projekt **MAKE OS** wählen.
2. Menü (☰) → **APIs & Dienste** → **Bibliothek** → Suchfeld `Gmail API` → **Gmail API** → **Aktivieren**.

### A2. Zustimmungsbildschirm: den Bereich ergänzen
1. Menü → **APIs & Dienste** → **OAuth-Zustimmungsbildschirm** (neue Oberfläche: **Google Auth Platform** → **Datenzugriff**).
2. **Bereiche hinzufügen oder entfernen** → unter „Eigene Bereiche hinzufügen“ eintragen und hinzufügen:
   - `https://www.googleapis.com/auth/gmail.modify`

   Er steht bei Google unter „Eingeschränkte Bereiche“. Weil die App **Zielgruppe: Intern** ist (nur Nutzer aus `makeinnovation.de`),
   verlangt Google dafür **keine Prüfung** und keinen Sicherheitsbericht. **Aktualisieren** → **Speichern**.
3. Die bisherigen Bereiche (`openid`, `userinfo.email`, `calendar.events`, `calendar.readonly`) bleiben, mehr nicht.

   Warum nur `gmail.modify`: Er deckt Lesen, Markieren/Archivieren (Labels), `history.list`, `users.watch`, „Senden als“ und das Senden selbst ab
   (`users.messages.send` akzeptiert ihn). Ein zusätzliches `gmail.send` wäre überflüssig, der Vollzugriff `mail.google.com/` unnötig riskant.

### A3. Zugriff in der Admin-Konsole
Mit dem Admin-Konto in <https://admin.google.com> → **Sicherheit** → **Zugriff und Datenkontrolle** → **API-Steuerung** →
**Zugriff von Drittanbieter-Apps verwalten**. Ist die App `MAKE OS` dort schon **Vertrauenswürdig** (Schritt 7.2 der Kalender-Anleitung),
ist nichts zu tun. Meldet die Anmeldung später „Zugriff blockiert“, ist Gmail dort gesperrt: App konfigurieren → **Vertrauenswürdig: kann
auf alle Google-Daten zugreifen** (Gmail ist ein „sensibler Bereich“) → Speichern.

### A4. Datenverarbeitungszusatz
Der AVV von Google (Kalender-Anleitung 7.1) gilt auch für Gmail. MAKE OS trägt „E-Mail (Google Workspace)“ selbst ins Verzeichnis der
Verarbeitungstätigkeiten ein (System › Datenschutz, sobald Google auf dem Server eingerichtet ist).

---

## Teil B — Echtzeit per Pub/Sub-Push (optional)

Ohne Teil B fragt MAKE OS Gmail **alle 2 Minuten** ab — nichts geht verloren, neue Mails erscheinen nur bis zu 2 Minuten später.
Mit Teil B ruft Google MAKE OS bei jeder Änderung an (Abfrage dann nur noch alle 15 Minuten als Rückfall). Pub/Sub braucht eine
**öffentliche HTTPS-Adresse** (`https://app.makeinnovation.de`), lokal am Mac gibt es keinen Push.

### B1. Pub/Sub API aktivieren
APIs & Dienste → Bibliothek → `Cloud Pub/Sub API` → **Aktivieren**.

### B2. Thema anlegen
Menü → **Pub/Sub** → **Themen** → **Thema erstellen** → **Thema-ID:** `gmail-push` → „Standardabo hinzufügen“ **abwählen** → Erstellen.
Der vollständige Name steht danach oben: `projects/<Projekt-ID>/topics/gmail-push` — **diesen Namen brauchst du in B7** (die Projekt-ID
steht im Dashboard der Cloud Console, z. B. `make-os-123456`).

### B3. Gmail darf ins Thema schreiben
Im Thema → Reiter **Berechtigungen** → **Hauptkonto hinzufügen**:
- **Neue Hauptkonten:** `gmail-api-push@system.gserviceaccount.com`
- **Rolle:** **Pub/Sub-Publisher**
→ Speichern.

### B4. Dienstkonto für die Zustellung
Menü → **IAM & Verwaltung** → **Dienstkonten** → **Dienstkonto erstellen** → Name `make-os-gmail-push` → **Erstellen und fortfahren** →
**keine Rolle** vergeben → **Fertig**. Seine Adresse (`make-os-gmail-push@<Projekt-ID>.iam.gserviceaccount.com`) brauchst du in B7.

### B5. Pub/Sub darf das Token für dieses Dienstkonto ausstellen
Dienstkonto `make-os-gmail-push` öffnen → Reiter **Berechtigungen** → **Zugriff gewähren**:
- **Neue Hauptkonten:** `service-<Projektnummer>@gcp-sa-pubsub.iam.gserviceaccount.com` (die Projektnummer steht im Dashboard neben der Projekt-ID)
- **Rolle:** **Ersteller von Dienstkonto-Tokens** (`roles/iam.serviceAccountTokenCreator`)
→ Speichern.

### B6. Push-Abo anlegen
Pub/Sub → **Abos** → **Abo erstellen**:
- **Abo-ID:** `gmail-push-make-os` · **Thema:** `gmail-push`
- **Zustellungstyp:** **Push**
- **Endpunkt-URL:** `https://app.makeinnovation.de/api/google/gmail/meldung`
- **Authentifizierung aktivieren** ✔ → **Dienstkonto:** `make-os-gmail-push@…` aus B4 → **Zielgruppe (Audience):** dieselbe URL
  (`https://app.makeinnovation.de/api/google/gmail/meldung`)
- **Wiederholungsrichtlinie:** Exponentieller Backoff (Standard) · alles andere Standard
→ **Erstellen**. Fragt Google hier nach einer **Domain-Bestätigung**, ist es Schritt 9 der Kalender-Anleitung (Cloud Console → APIs & Dienste
→ Domainbestätigung).

### B7. Werte auf dem Server eintragen (nicht in den Chat!)
```
ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/google-verbinden.sh
```
Das Skript fragt wie beim Kalender zuerst nach Client-ID und Client-Geheimnis (einfach noch einmal einfügen — es ersetzt die bisherigen Zeilen) und
danach **optional** nach den Push-Werten:
1. **Pub/Sub-Thema:** `projects/<Projekt-ID>/topics/gmail-push` (aus B2)
2. **Dienstkonto:** `make-os-gmail-push@<Projekt-ID>.iam.gserviceaccount.com` (aus B4)
3. **Zielgruppe:** Enter (= die Webhook-Adresse; nur eintragen, wenn du in B6 etwas anderes gewählt hast)

Es schreibt `GMAIL_PUBSUB_THEMA`, `GMAIL_PUSH_DIENSTKONTO` (und ggf. `GMAIL_PUSH_AUDIENCE`) in `/srv/make-os/app/.env` und startet MAKE OS neu.
MAKE OS akzeptiert dann **nur** Meldungen mit einem von Google signierten Token für **genau dieses** Dienstkonto und diese Zielgruppe
(falsche oder fehlende Werte → der Webhook antwortet immer 403).

### B8. Prüfen
In der Inbox steht unten bei jeder verbundenen Person „Push aktiv“. Eine Test-Mail an dich → erscheint binnen Sekunden. MAKE OS erneuert die
Überwachung (`users.watch`) selbst alle paar Tage; fällt Push aus, greift die Abfrage alle 15 Minuten.

---

## Teil C — Je Person in MAKE OS verbinden

Kevin und Malin machen das **einzeln mit dem eigenen Konto**:
1. MAKE OS → **Inbox** → Karte **Gmail verbinden**.
2. Bei Google mit **dem eigenen @makeinnovation.de-Konto** anmelden → **Zulassen** (das Häkchen für Gmail lassen — fehlt es, meldet MAKE OS
   „bei Google fehlt die Freigabe“). Es ist **dieselbe Verbindung** wie beim Kalender: ein zweites Token gibt es nicht.
3. Zurück in der Inbox liest MAKE OS die **letzten 30 Tage** (Posteingang und Gesendet); danach laufend. Unten steht „Gmail · k***@makeinnovation.de · letzter
   Abgleich vor … Min.“ mit **Jetzt abgleichen** und **Gmail ausschalten** (löscht den Spiegel, der Kalender bleibt verbunden).
4. Wer den Spiegel nicht mehr will: **Gmail ausschalten**; ganz trennen: Kalender-Einstellungen › Google › **Trennen** (widerruft bei Google und
   löscht alle Kopien).

Gmail liegt in MAKE OS im **Business-Space**. Quelle, Space und Einstufung (ZOE bleibt außen vor, die Einstufung folgt Gmail-Kategorien und
Kontaktzuordnung) stehen in der Inbox oben rechts.

---

## Teil D — Umstellung der Mail-Adresse von IONOS auf Gmail (DNS)

> Vor allem anderen: **Screenshot/Abschrift aller bisherigen DNS-Einträge** bei IONOS (MX, TXT, CNAME) machen — das ist der Rückweg.

### D1. Workspace-Konten
Admin-Konsole → **Verzeichnis** → **Nutzer**: `kevin@…` und `malin@…` sind aktiv (Lizenz zugewiesen).

### D2. `hello@makeinnovation.de` ZUERST anlegen
**Entschieden (Kevin 03.10.): `hello@` ist eine Gruppe — Kevin und Malin lesen beide jede Anfrage.**
1. Admin-Konsole → **Verzeichnis → Gruppen → Gruppe erstellen**: Name „MAKE Innovation · Anfragen“, E-Mail `hello@makeinnovation.de`,
   Mitglieder **Kevin** und **Malin** (je als Mitglied).
2. Gruppeneinstellungen → **Wer kann Beiträge posten**: „Externe Nutzer“ erlauben (sonst kommen Mails von außen nicht an) →
   **Wer kann als Gruppe E-Mails senden**: „Gruppenmitglieder“ (bzw. „Mitglieder dürfen als Gruppe senden“).
3. Jede Person in Gmail: **Einstellungen → Konten → Senden als → Weitere E-Mail-Adresse hinzufügen** → `hello@makeinnovation.de`
   (Name „MAKE Innovation“). Erst dann bietet MAKE OS beim Antworten `hello@` als Absender an („Von“-Auswahl; bei einer Mail an `hello@`
   wird `hello@` vorgeschlagen).
4. Hinweis: Jede Anfrage liegt danach in beiden Postfächern bzw. MAKE-OS-Spiegeln — wer antwortet, sieht man im Gesendet-Ordner und im
   Verlauf der Kontaktakte; vorher kurz abstimmen, wer übernimmt.

### D3. Zustellung testen, **bevor** der MX umzieht
Von einem fremden Konto eine Mail an `kevin@makeinnovation.de.test-google-a.com` und `hello@makeinnovation.de.test-google-a.com` schicken
(Google liefert so schon vor der Umstellung an das Workspace-Konto). Kommt sie in Gmail an → weiter.

### D4. Alte Mails mitnehmen (optional)
Admin-Konsole → **Daten → Datenmigration → E-Mail migrieren** (Datenmigrationsdienst): Quelle IMAP (`imap.ionos.de`), Zielkonten Kevin/Malin.
Zuerst vor der Umstellung, nach dem MX-Wechsel ein letzter Durchlauf. Die IONOS-Postfächer **mindestens vier Wochen** weiterlaufen lassen.

### D5. DNS bei IONOS — in dieser Reihenfolge
Bei IONOS: **Domains & SSL → makeinnovation.de → DNS**. Vorher (am besten einen Tag früher) die **TTL** der Einträge auf den kleinsten Wert stellen.

1. **SPF** — genau **ein** TXT-Eintrag auf `@`: `v=spf1 include:_spf.google.com ~all`
   Den alten IONOS-SPF-Eintrag **ersetzen** (nie zwei SPF-Einträge). Versenden weitere Dienste im Namen der Domain (Newsletter, Rechnungen),
   deren `include:` ergänzen.
2. **DKIM** — Admin-Konsole → **Apps → Google Workspace → Gmail → E-Mails authentifizieren** → Domain wählen → **Neuen Eintrag generieren**
   (2048 Bit, Selektor `google`). Es erscheint ein TXT-Eintrag: **Host** `google._domainkey`, **Wert** `v=DKIM1; k=rsa; p=…`. Bei IONOS als TXT eintragen,
   10–60 Minuten warten, dann in Google **Authentifizierung starten**.
3. **DMARC** — TXT auf `_dmarc`: `v=DMARC1; p=none; rua=mailto:hello@makeinnovation.de`
   Nach zwei bis vier Wochen mit sauberen Berichten auf `p=quarantine` anheben.
4. **MX (zuletzt!)** — die alten IONOS-MX-Einträge (`mx00.ionos.de`, `mx01.ionos.de` bzw. `mx00.kundenserver.de` …) **löschen**, dann **einen**
   neuen MX: **Host** `@`, **Ziel** `smtp.google.com`, **Priorität** `1`. (Die klassischen fünf Google-MX `aspmx.l.google.com` … funktionieren
   ebenfalls — nicht mischen.)

### D6. Prüfen
- <https://toolbox.googleapps.com/apps/checkmx/> → `makeinnovation.de`: grün für MX, SPF, DKIM, DMARC.
- Eine Mail von einem fremden Konto an `kevin@` und `hello@` → kommt in Gmail und binnen Minuten in der MAKE-OS-Inbox an.
- In Gmail bei einer erhaltenen Mail **⋮ → Original anzeigen**: SPF, DKIM, DMARC jeweils **PASS**.
- Eine Antwort aus MAKE OS an ein fremdes Konto schicken: dort ebenfalls **PASS**; Absender ist die gewählte Adresse.

### D7. Rückweg
MX auf die alten IONOS-Werte zurücksetzen (Abschrift von oben), SPF zurück. Mails, die in der Zwischenzeit bei Google ankamen, bleiben in Gmail.
In MAKE OS bleibt Gmail verbunden; es zeigt dann einfach nichts Neues.

---

## Prüfen (nach Teil C)
- Inbox zeigt Gmail-Threads (ungelesen fett, „gehört zu …“ bei bekannten Personen); **Quelle** oben rechts filtert Gmail/Apple/Microsoft.
- Eine Mail öffnen → **Antworten** → Text schreiben (oder **ZOE-Entwurf**) → **Senden**: die Antwort steht in Gmail im selben Thread.
- **Aufgabe**, **Follow-up**, **Termin** (Business → Google-Kalender), **Kontakt anlegen**, **Erledigt (archivieren)** wirken sofort.
- HOI (System › Head of IT) zeigt den Befund **Gmail (Inbox)**.

## Trennen / Rückbau
- Nur Gmail: Inbox → **Gmail ausschalten** (Spiegel weg; der Zugriff bleibt bei Google gewährt, bis ganz getrennt wird).
- Alles: Kalender-Einstellungen › Google › **Trennen** (widerruft den Zugriff, beendet die Überwachung, löscht Spiegel).
- Server: `google-verbinden.sh --entfernen` (entfernt auch die Push-Werte).
- Zugriff bei Google prüfen/entziehen: <https://myaccount.google.com/permissions> bzw. Admin-Konsole → API-Steuerung.

## Falls etwas hakt
| Meldung / Beobachtung | Ursache | Abhilfe |
|---|---|---|
| Karte: „Gmail ist noch nicht eingerichtet“ | `GOOGLE_CLIENT_ID`/`SECRET` fehlen auf dem Server | Kalender-Anleitung Schritt 6 |
| „bei Google fehlt die Freigabe für Gmail“ | Bereich `gmail.modify` nicht im Zustimmungsbildschirm (A2) oder Häkchen abgewählt | A2 prüfen, neu verbinden |
| Google: „Zugriff blockiert“ | Gmail in der API-Steuerung gesperrt | A3 |
| Google: `access_denied` / „App nicht geprüft“ | Zielgruppe steht auf „Extern“ | Zielgruppe **Intern** (Kalender-Anleitung 4.3) |
| Gmail-API-Fehler 403 „has not been used in project“ | Gmail API nicht aktiviert (A1) | aktivieren, 2 Minuten warten |
| Inbox: „Die Google-Verbindung ist getrennt“ | Zugriff widerrufen, Passwort-Reset mit Abmelden | **Neu verbinden** |
| Kein Push („alle 2 Minuten“) | Teil B fehlt oder `GMAIL_PUSH_*` falsch (der Webhook antwortet dann 403) | B6/B7 prüfen: Dienstkonto und Zielgruppe müssen zur Subscription passen |
| Push-Abo meldet Zustellfehler 403 | Zielgruppe/Dienstkonto im Abo ≠ Server-Werte | gleiche Werte in B6 und B7 |
| Antwort geht „von der falschen Adresse“ | Alias in Gmail nicht unter „Senden als“ bestätigt | D2; in MAKE OS nur verifizierte Adressen wählbar |
| Alte Mails fehlen | MAKE OS liest nur die letzten 30 Tage und hält 180 Tage | D4 (Migration) bzw. Löschfrist „Mail-Spiegel“ (System › Datenschutz) anheben |
