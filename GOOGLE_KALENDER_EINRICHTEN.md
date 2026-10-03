# Google Kalender für MAKE OS einrichten — Schritt für Schritt (03.10.2026)

**Ziel:** Kevin und Malin verbinden je ihr Google-Workspace-Konto (`@makeinnovation.de`) mit MAKE OS. Danach liegen alle
Business-/MAKE-Termine im Google Kalender der jeweiligen Person und gleichen in beide Richtungen ab (nahezu sofort per Push).
Privat, Familie und Gemeinsam bleiben in MAKE OS und iCloud.

**Du brauchst:** das Workspace-**Admin**-Konto der Domain `makeinnovation.de` (für Schritte 1–6) und später je Person das eigene
Konto (Schritt 8). Dauer: etwa 20 Minuten. Es kostet nichts, und weil die App „Intern“ bleibt, prüft Google sie nicht.

**Wichtig:** Client-ID und Client-Geheimnis kommen **nie in den Chat** und nie ins Repo — du gibst sie in Schritt 6 selbst am
Server ein (das Skript fragt sie verdeckt ab).

---

## 1. Google Cloud Console öffnen
1. Im Browser <https://console.cloud.google.com> öffnen und mit dem **Workspace-Admin-Konto** anmelden.
2. Oben links neben „Google Cloud“ auf die **Projektauswahl** klicken und darauf achten, dass oben die **Organisation
   „makeinnovation.de“** gewählt ist (Reiter „Alle“). Fehlt die Organisation, ist das Konto kein Admin der Domain — dann mit dem
   richtigen Konto wiederholen.

## 2. Projekt „MAKE OS“ anlegen
1. Projektauswahl → **Neues Projekt**.
2. **Projektname:** `MAKE OS` · **Organisation:** `makeinnovation.de` → **Erstellen**.
3. Warten, bis die Glocke oben „Projekt erstellt“ meldet, dann in der Projektauswahl **MAKE OS** anklicken.

## 3. Google Calendar API aktivieren
1. Menü (☰) → **APIs & Dienste** → **Bibliothek**.
2. Suchfeld: `Google Calendar API` → Treffer **Google Calendar API** → **Aktivieren**.

## 4. OAuth-Zustimmungsbildschirm: „Intern“
1. Menü → **APIs & Dienste** → **OAuth-Zustimmungsbildschirm** (in der neuen Oberfläche: **Google Auth Platform**).
   Beim ersten Mal **Erste Schritte** klicken.
2. **App-Name:** `MAKE OS` · **Nutzersupport-E-Mail:** deine Admin-Adresse → **Weiter**.
3. **Zielgruppe: Intern** (nur Nutzer in makeinnovation.de) → **Weiter**. („Extern“ wäre falsch — dann müsste Google die App prüfen.)
4. **Kontaktdaten:** deine Admin-Adresse → **Weiter** → Häkchen bei den Richtlinien → **Fortfahren** → **Erstellen**.
5. **Datenzugriff** (bzw. „Bereiche“) → **Bereiche hinzufügen oder entfernen** und diese vier eintragen/anhaken, dann **Aktualisieren** → **Speichern**:
   - `openid`
   - `…/auth/userinfo.email`
   - `https://www.googleapis.com/auth/calendar.events` (Termine lesen, anlegen, ändern, löschen)
   - `https://www.googleapis.com/auth/calendar.readonly` (die Kalenderliste, damit jede Person ihren Kalender wählen kann)

   Mehr nimmt MAKE OS nicht: keine Mails, keine Dateien, keine Kontakte, kein Anlegen/Löschen ganzer Kalender.

## 5. OAuth-Client „Webanwendung“ anlegen
1. Menü → **APIs & Dienste** → **Anmeldedaten** → **Anmeldedaten erstellen** → **OAuth-Client-ID**
   (neue Oberfläche: Google Auth Platform → **Clients** → **Client erstellen**).
2. **Anwendungstyp: Webanwendung** · **Name:** `MAKE OS Server`.
3. **Autorisierte Weiterleitungs-URIs → URI hinzufügen** — genau diese (ohne Schrägstrich am Ende):
   - `https://app.makeinnovation.de/api/google/rueckruf`
   - für die Entwicklung am Mac zusätzlich: `http://localhost:3001/api/google/rueckruf`
4. **Erstellen.** Es erscheint ein Fenster mit **Client-ID** (endet auf `.apps.googleusercontent.com`) und **Client-Geheimnis**.
   **Fenster offen lassen** (oder „JSON herunterladen“ und die Datei nur auf dem Mac behalten) — beide Werte brauchst du gleich.
   Das Geheimnis lässt sich später unter **Anmeldedaten → MAKE OS Server** wieder ansehen bzw. neu erzeugen.

## 6. Werte auf dem Server eintragen (nicht in den Chat!)
Am Mac im Terminal — genau wie beim iCloud-Skript:
```
ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/google-verbinden.sh
```
Das Skript fragt der Reihe nach:
1. **Client-ID** — einfügen (Cmd+V), Enter.
2. **Client-Geheimnis** — einfügen, Enter (man sieht nichts; es zeigt zur Kontrolle nur die letzten vier Zeichen).
3. **Erlaubte Domain** — Enter für `makeinnovation.de`.

Es schreibt die drei Zeilen (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ERLAUBTE_DOMAIN`) in `/srv/make-os/app/.env`
(nur für den Nutzer `make` lesbar) und **startet MAKE OS neu** (etwa eine halbe Minute). Ohne das Skript: dieselben Zeilen von Hand
in `/srv/make-os/app/.env` (siehe `deploy/env.server.beispiel`), dann `docker compose up -d --force-recreate app arbeiter`.
Die Rückruf-Adresse leitet MAKE OS aus `MAKE_OS_ADRESSE` ab (`https://app.makeinnovation.de/api/google/rueckruf`) — sie muss zu
Schritt 5 passen. Lokal am Mac: Werte in `.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ERLAUBTE_DOMAIN`),
dann ist die Rückruf-Adresse `http://localhost:3001/api/google/rueckruf`.

## 7. Workspace-Admin-Konsole: Datenschutz und Zugriff
Mit dem Admin-Konto in <https://admin.google.com>:
1. **Datenverarbeitungszusatz (AVV) bestätigen:** **Konto** → **Rechtliche Hinweise und Compliance** → **Zusatz zur Datenverarbeitung**
   → ansehen und **Akzeptieren**, falls noch nicht geschehen (Auftragsverarbeitung nach Art. 28 DSGVO). Das gehört zum Verzeichnis der
   Verarbeitungstätigkeiten — MAKE OS trägt „Kalender (Google Workspace)“ dort selbst ein (System › Datenschutz).
2. **Zugriff für Dritt-Apps:** **Sicherheit** → **Zugriff und Datenkontrolle** → **API-Steuerung** → **Zugriff von Drittanbieter-Apps
   verwalten**. Steht dort „Alle Drittanbieter-Apps blockieren“ oder „Nur erlauben, was ich freigebe“, die App `MAKE OS`
   (Client-ID aus Schritt 5) **als „Vertrauenswürdig“** hinzufügen: **App konfigurieren** → nach der Client-ID suchen → Konten der
   Domain (oder die Organisationseinheit von Kevin und Malin) → **Vertrauenswürdig: kann auf alle Google-Daten zugreifen** → Speichern.
   Eigene interne Apps sind meist schon erlaubt — nur wenn die Anmeldung später „Zugriff blockiert“ meldet, ist es hier gesperrt.

## 8. Je Person in MAKE OS verbinden
Kevin und Malin machen das **einzeln mit dem eigenen Konto** (niemand kann für die andere Person verbinden):
1. MAKE OS öffnen → **Kalender** → rechts **Einstellungen → öffnen** → Kachel **Google Kalender (MAKE)**.
2. **Google Kalender verbinden** → bei Google mit **dem eigenen @makeinnovation.de-Konto** anmelden → **Zulassen** (alle
   Häkchen lassen — wird eines abgewählt, meldet MAKE OS „bei Google fehlt eine Freigabe“).
3. Zurück in MAKE OS steht dort „verbunden als k***@makeinnovation.de“. Der Hauptkalender wird gewählt; mit **Kalender wählen**
   geht auch ein anderer Google-Kalender (nur einer je Person). Der Kalender heißt in MAKE OS **„MAKE Kevin (Google)“** bzw.
   **„MAKE Malin (Google)“** und trägt ein kleines „G“.
4. Optional **Business-Termine aus iCloud umziehen** — erst Vorschau (was zieht um, was bleibt), dann ein ausdrücklicher Klick;
   vorher sichert MAKE OS jeden Termin (30 Tage).

## 9. Push einschalten (optional, macht „nahezu sofort“)
Google meldet Änderungen per Webhook an `https://app.makeinnovation.de/api/kalender/google/meldung`. Dafür muss Google die **Domain
kennen**:
1. Cloud Console → **APIs & Dienste** → **Domainbestätigung** → **Domain hinzufügen** → `makeinnovation.de` (bzw.
   `app.makeinnovation.de`). Ist die Domain im Workspace schon bestätigt, genügt der Klick auf **Bestätigen**; sonst fragt Google den
   Search-Console-Nachweis (TXT-Eintrag im DNS).
2. In MAKE OS zeigt die Kachel danach „Änderungen kommen sofort per Push von Google“. Solange das nicht steht, gleicht MAKE OS alle
   5 Minuten ab (nichts geht verloren, es dauert nur bis zu 5 Minuten).

## Prüfen
- Kachel „Google Kalender (MAKE)“ zeigt **verbunden** und **letzter Abgleich vor … Min.** (ab 30 Minuten färbt sie sich).
- In Google einen Test-Termin anlegen → erscheint in MAKE OS (mit Push sofort, sonst ≤ 5 Min.). In MAKE OS einen Termin im Kalender
  „MAKE Kevin (Google)“ anlegen → erscheint in Google.
- HOI (System › Head of IT) zeigt den Befund „Google Kalender“; getrennte Verbindungen melden sich rot und in der Glocke.

## Trennen / Rückbau
- Je Person: Kachel → **Trennen** (widerruft den Zugriff bei Google, die Termine bleiben in Google; in MAKE OS verschwindet der Spiegel).
- Ganz entfernen: `ssh -t make@2.28.108.162 sudo bash /srv/make-os/app/deploy/google-verbinden.sh --entfernen`.
- Zugriff bei Google selbst prüfen/entziehen: <https://myaccount.google.com/permissions> (jede Person) bzw. Admin-Konsole → API-Steuerung.

## Falls etwas hakt
| Meldung / Beobachtung | Ursache | Abhilfe |
|---|---|---|
| Kachel: „Noch nicht eingerichtet“ | `GOOGLE_CLIENT_ID`/`SECRET` fehlen im Server-Umfeld | Schritt 6, danach MAKE OS neu starten |
| Google: `redirect_uri_mismatch` | die Weiterleitungs-URI aus Schritt 5 passt nicht zu `MAKE_OS_ADRESSE` | URI exakt `<Adresse>/api/google/rueckruf`, ohne Schrägstrich am Ende |
| Google: „Zugriff blockiert“ / `access_denied` für die App | Drittanbieter-Zugriff gesperrt oder Zielgruppe „Extern“ | Schritt 7.2 bzw. Schritt 4.3 (Zielgruppe **Intern**) |
| MAKE OS: „gehört nicht zur erlaubten Domain“ | mit einem privaten Google-Konto angemeldet | mit dem @makeinnovation.de-Konto erneut verbinden |
| MAKE OS: „bei Google fehlt eine Freigabe“ | ein Häkchen auf dem Zustimmungsfenster abgewählt | neu verbinden, alle Häkchen lassen |
| Kachel: „getrennt“ | Zugriff bei Google widerrufen, Passwort-Reset mit Abmelden, Konto gesperrt | **Neu verbinden** |
| Kein Push („wartet“/„aus“) | Domain nicht bestätigt (Schritt 9) oder keine öffentliche HTTPS-Adresse | Schritt 9; bis dahin Abgleich alle 5 Min. |
