# Kundenpostfächer und ein zweites Google-Konto — was geht, was nicht

Stand: 09.10.2026 · alle Quellen abgerufen am 09.10.2026 · Hinweis, keine Rechtsberatung.
Kennzeichnung: **belegt** = offizielle Google- bzw. Microsoft-Doku (URL dabei) · **Annahme** = nicht wörtlich belegt, mit einem echten Konto prüfen.

Kevin 09.10.: „Es wäre geil, wenn wir ein zweites Google-Konto auch verbinden könnten … Wir haben da auch von den Kunden Postfächer.“
Gemeint: eine Adresse von Kevin oder Malin in der Domain eines Kunden (meist Google Workspace des Kunden). Die Mails sollen in MAKE OS
landen, und zwar beim Kunden bzw. Mandat.

## Kurzantwort

**Über unsere Google-App (OAuth) geht es heute nicht.** Unsere App ist auf „Intern“ gestellt. Konten außerhalb von makeinnovation.de
bekommen dann den Fehler `org_internal`. Auf „Extern“ umstellen hilft nicht dauerhaft: Im Testmodus laufen Gmail-Freigaben nach 7 Tagen ab.
Für den Betrieb verlangt `gmail.modify` als eingeschränkter Scope Googles Prüfung und eine Sicherheitsbewertung.

**Empfehlung:** Kundenpostfächer heute über **IMAP/SMTP mit App-Passwort** verbinden. Das ist gebaut (Anbieter „Google Workspace eines
Kunden (App-Passwort)“, Bereich = der Kunde). Der Admin des Kunden muss dafür IMAP und App-Passwörter zulassen. Sperrt ein Kunde das, gibt es
zwei OAuth-Wege, beide noch nicht gebaut (Option B/C unten). Microsoft 365 geht nur mit OAuth, also heute gar nicht.

## Befunde

### 1. „Intern“ nimmt keine fremde Domain an — belegt
„Internal“-Projekte beschränken die Anmeldung auf Mitglieder der eigenen Google-Cloud-Organisation. Wer von außerhalb anfragt, bekommt den
Fehler `org_internal`. Bei „External“ kann sich jedes Google-Konto anmelden.
Quelle: https://support.google.com/cloud/answer/15549945

### 2. „Extern“ im Testmodus: 7 Tage — belegt
Im Testmodus sind höchstens 100 eingetragene Testnutzer erlaubt. Ihre Freigaben „expire seven days from the time of consent“, das Refresh-Token
ebenso. Ausnahme sind nur Apps, die allein nach Name, E-Mail und Profil fragen. Für einen Spiegel, der dauerhaft abgleicht, ist das unbrauchbar.
Quellen: https://support.google.com/cloud/answer/15549945 · https://developers.google.com/identity/protocols/oauth2

### 3. `gmail.modify` ist eingeschränkt: Prüfung plus Sicherheitsbewertung — belegt
`https://www.googleapis.com/auth/gmail.modify` steht unter „Restricted scopes“. Wer solche Daten auf Servern speichert oder überträgt, braucht
eine Sicherheitsbewertung durch einen von Google benannten Prüfer. Ausnahmen von der Prüfung gibt es für:
- **persönliche Nutzung**: „you are the only user of your app or if your app is used by only a few users, all of whom are known personally to you“
- Entwicklung, Test und Staging
- ein Dienstkonto, das nur eigene Daten liest
- **nur intern**: die App wird nur innerhalb der eigenen Workspace-Organisation genutzt

Quellen: https://developers.google.com/workspace/gmail/api/auth/scopes ·
https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification

### 4. Kann der Admin des Kunden unsere App als „vertrauenswürdig“ markieren? — teils belegt
- **Ja, belegt.** In der Admin-Konsole unter Sicherheit › Zugriffs- und Datenkontrolle › API-Steuerung › App-Zugriff verwalten kann der Admin
  eine App auf „Trusted“ setzen. Trusted heißt: „Can access all Google services (both restricted and unrestricted)“, also auch Gmail.
  Nutzer können sie dann installieren, „whether or not the app is verified“.
  Quellen: https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data ·
  https://knowledge.workspace.google.com/admin/apps/authorize-unverified-third-party-apps
- **Belegt:** Eingeschränkt sind nur „Unverified third-party apps that access Gmail data and have more than 100 users worldwide“. Bei
  unter 100 Nutzern greift die Sperre nicht; der Warnbildschirm für unverifizierte Apps bleibt.
  Quelle: https://support.google.com/cloud/answer/7454865
- **Nicht belegt:** Dass „Trusted“ Googles eigene Prüfpflicht für eingeschränkte Scopes ersetzt, steht in keiner der Quellen. Die
  Entwickler-Doku verlangt die Prüfung weiterhin „if applicable“.
  Quelle: https://developers.google.com/identity/protocols/oauth2/production-readiness/google-workspace
- **Annahme:** Das Trusted-Setzen räumt nur die Sperre im Workspace des Kunden weg. Ohne Prüfung bleibt man auf die Ausnahme „persönliche
  Nutzung“ angewiesen (Kevin und Malin, wenige Nutzer) bzw. auf weniger als 100 Nutzer mit Warnbildschirm. Gilt das für `gmail.modify`?
  Laut Admin-Doku ja, als Zugriffsrecht. Ob Google eine solche App dauerhaft unverifiziert in Produktion duldet, steht nicht in der Doku.

### 5. Google Workspace über IMAP mit App-Passwort — belegt, ein Rest ist Annahme
- **Server:** IMAP `imap.gmail.com:993` mit SSL (Pflicht). SMTP `smtp.gmail.com` auf 465 (SSL) oder 587 (TLS). IMAP-Sitzungen halten bis
  etwa 24 h. MAKE OS baut je Lauf eine neue auf.
  Quelle: https://developers.google.com/workspace/gmail/imap/imap-smtp
- **App-Passwort:** setzt die Bestätigung in zwei Schritten voraus. Es wird widerrufen, sobald jemand das Google-Passwort ändert. Anlegen unter
  https://myaccount.google.com/apppasswords. Die Option fehlt, wenn nur Sicherheitsschlüssel erlaubt sind, bei Advanced Protection, und bei
  „work, school, or another organization account“ je nach Einstellung der Organisation.
  Quelle: https://support.google.com/accounts/answer/185833
- **Workspace:** Seit 14.03.2025 funktionieren IMAP und SMTP nicht mehr mit dem normalen Passwort. App-Passwörter sind ausdrücklich
  ausgenommen („with the exception of app passwords“).
  Quelle: https://knowledge.workspace.google.com/admin/sync/transition-from-less-secure-apps-to-oauth
- **IMAP-Freigabe durch den Admin:** Admin-Konsole › Apps › Google Workspace › Gmail › Endnutzerzugriff › „POP- und IMAP-Zugriff“ ›
  „Enable IMAP access for all users“ einschalten und „Allow any mail client“ wählen. Clients ohne OAuth gehen nur mit dieser Wahl. Ist IMAP
  aus, kann der Nutzer es nicht selbst anschalten.
  Quelle: https://knowledge.workspace.google.com/admin/sync/turn-pop-and-imap-on-or-off-for-users
- **Annahme:** Mit 2-Schritt-Bestätigung, erlaubten App-Passwörtern und „Allow any mail client“ funktioniert die Anmeldung mit App-Passwort.
  Benutzername ist die volle Adresse (üblich, auf den Seiten oben nicht wörtlich genannt). Gmail legt über SMTP Gesendetes selbst in
  „Gesendet“ ab, deshalb hängt MAKE OS keine zweite Kopie an. **Mit einem echten Kundenpostfach einmal prüfen.**

### 6. Microsoft 365 / Exchange Online — belegt: nur OAuth
Basic-Anmeldung für POP, IMAP und weitere Protokolle ist „now disabled in all tenants“ und lässt sich nicht wieder einschalten. Für SMTP AUTH
ist das Ende von Basic ebenfalls angekündigt. Mit Passwort oder App-Passwort geht ein M365-Postfach also nicht. Nötig wäre OAuth über eine
Entra-App, die der Admin des Kunden zulässt. Gebaut ist das nicht; im Formular steht das ehrlich als „heute nicht möglich“.
Quelle: https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online

## Optionen

| | Weg | Aufwand | Haken |
|---|---|---|---|
| **A (gebaut)** | IMAP/SMTP mit App-Passwort, Bereich = Kunde | — | Der Admin des Kunden muss IMAP („Allow any mail client“) und App-Passwörter erlauben. Ändert jemand das Passwort, ist das App-Passwort weg (dann „Verbindung erneuern“). |
| **B** | Zweite eigene Google-App „Extern“, Status „In Produktion“, unverifiziert, nur Kevin + Malin (Ausnahme persönliche Nutzung). Der Admin des Kunden setzt sie auf „Trusted“. | mittel: mehrere Google-Verbindungen je Person (siehe Bauplan) + zweite Client-ID | Warnbildschirm bei der Anmeldung. Ob Google das dauerhaft so lässt, ist Annahme. Für den Verkauf (Plattform) nicht tragfähig: dort ginge es nur mit Prüfung + Sicherheitsbewertung (jährlich, kostenpflichtig). |
| **C** | Der Kunde legt in SEINER Google Cloud eine **interne** App an und gibt uns Client-ID/Secret für unseren Rückruf. Kevins Kundenadresse ist Mitglied dieser Organisation. | mittel: wie B, dazu OAuth-Client je Verbindung statt je Instanz | Belegt: interne Apps brauchen keine Prüfung. Annahme: Der Kunde macht das mit. Das Secret des Kunden liegt verschlüsselt bei uns. |
| **D** | Microsoft 365 über OAuth (Entra-App, Admin-Zustimmung beim Kunden) | groß: neue Quelle neben Gmail/IMAP | nur, wenn ein Kunde M365 hat |

**Empfehlung:** A sofort nutzen. Lehnt ein Kunde App-Passwörter ab, ist **C** der sauberste Weg: keine Prüfung, keine Warnung, die Kontrolle
bleibt beim Kunden. B nur als Übergang. Für die verkaufbare Plattform gilt: Jede Kundeninstanz hat ohnehin ihre eigene interne Google-App
(`GOOGLE_CLIENT_ID` je Instanz), dort ist „eigene Domain“ kein Problem.

## Zweites Google-Konto in der eigenen Domain

Ziel z. B.: eine zweite Adresse in makeinnovation.de. **Heute:** über Weg A (IMAP + App-Passwort, Bereich = die Gesellschaft). Kevin ist Admin
der eigenen Domain und kann IMAP und App-Passwörter dort selbst erlauben.

**OAuth mit mehreren Verbindungen je Person — nicht gebaut, Bauplan** (geschätzt 1–2 Tage):
1. Bestand `google-verbindung--<person>` bleibt die Hauptverbindung (Kalender + Gmail wie heute). Weitere Verbindungen kommen nach
   `google-verbindung--<person>--<n>` (`n` = `gv-<uuid>`). Register-Eintrag mit Angaben, `PERSON_BESTAENDE`, Art. 15/17, Grabstein.
2. `verbindungStarten(person, funktionen, { weitere: true })` legt die Verbindungs-Kennung in den `state`. Der Rückruf schreibt in genau
   diese Verbindung. Die Domain-Prüfung bleibt (eigene Domain); Option C bekommt dafür einen OAuth-Client je Verbindung.
3. Spiegel je Verbindung: `gmail-stand--<person>--<n>`, `gmail-text--<person>--<n>`. Postfach-Kennung `gmail-<n>`; `POSTFACH_ID` erweitern,
   Gespräch-Kennung `gm~<n>~<thread>`. Der Takt läuft je Verbindung.
4. `googleZugriffstoken(person, funktion, verbindung?)` erneuert je Verbindung streng nacheinander (wie WHOOP).
5. Kalender bleibt an der Hauptverbindung. Eine zweite Kalender-Quelle wäre ein eigener Auftrag.
6. Tests: Rückruf mit fremder Verbindungs-Kennung → 403. Zwei Verbindungen getrennt. Trennen räumt nur die eine ab.

## Recht (Hinweis, keine Rechtsberatung)
- Kein neuer Empfänger bei uns. Der Mail-Anbieter ist der des Kunden (sein Vertrag). Bei uns sind es Hetzner und, beim ZOE-Entwurf auf Klick,
  Anthropic. Verzeichnis: neuer Eintrag `vv-email-kunden` „E-Mail (Postfächer bei Kunden)“ (lib/crm/datenschutz.ts).
- **Mit dem Kunden klären:** Wir spiegeln seine Korrespondenz auf unserem Server. Das ist wahrscheinlich Auftragsverarbeitung für den Kunden
  (Art. 28), also Freigabe und ggf. ein AVV, dazu seine IT-Richtlinie (App-Passwörter, IMAP).
- Spätestens bei Mandatsende trennen. Der Bereich bleibt lesbar, ist aber nicht mehr neu wählbar.
