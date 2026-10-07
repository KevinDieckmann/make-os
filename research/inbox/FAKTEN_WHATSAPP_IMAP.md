# Fakten: WhatsApp & Mail-Abruf (IMAP) für die MAKE-OS-Inbox

Stand: 06.10.2026 · alle Quellen abgerufen am 06.10.2026 · keine Rechtsberatung.
Kennzeichnung: **belegt** = offizielle Primärquelle · **Messung** = eigene Server-Antwort (öffentlich, ohne Login) · **Annahme** = nicht primär belegt.

---

## A) WhatsApp

### 1. Privates WhatsApp-Konto serverseitig lesen/senden
**Befund:** Es gibt keine offizielle API für private Konten. Die offizielle Plattform ist nur die WhatsApp Business Platform (Cloud API). Die EEA-Nutzungsbedingungen (gültig ab 17.08.2026) verbieten, die Dienste „directly, indirectly, through automated or other means“ unerlaubt zu nutzen. Dazu kommen Verbote zu Reverse Engineering und zu Konten, die „through unauthorized or automated means“ angelegt werden. Die Hilfeseite „About unofficial apps“ sagt: Wer ein Konto mit inoffiziellen Versionen verknüpft, verstößt gegen die Bedingungen. Das Konto kann dann „temporarily or permanently banned“ werden, auch mit Sperre für verknüpfte Geräte. Bibliotheken wie Baileys oder whatsapp-web.js bauen das WhatsApp-Web-Protokoll inoffiziell nach. Sie fallen damit unter diese Regeln.
**Quellen:** https://www.whatsapp.com/legal/terms-of-service-eea · https://faq.whatsapp.com/1217634902127718/?locale=en_US (06.10.2026)
**Belastbarkeit:** Klauseln und Sperrrisiko **belegt**. Dass Baileys/whatsapp-web.js konkret darunter fallen, ist eine **Annahme** (gut begründet; Meta nennt diese Bibliotheken nicht namentlich).

### 2. Cloud API: Voraussetzungen und Coexistence
**Befund Voraussetzungen:** Nötig sind ein Facebook- oder Managed-Meta-Konto, eine Developer-Registrierung, ein Meta Business Portfolio und ein WhatsApp Business Account. Die Nummer muss dem Nutzer gehören, Ländervorwahl haben und SMS oder Anrufe empfangen können. Eine Nummer, die schon in WhatsApp läuft, muss vorher gelöscht werden (Ausnahme: Coexistence). Neue Portfolios: höchstens 2 Nummern und 250 vom Unternehmen gestartete Nachrichten je 24 h. Nach der Unternehmensverifizierung sind es 2.000. Antworten im Service-Fenster zählen nicht gegen dieses Limit.
**Befund Coexistence:** Gibt es offiziell. Seit **11.02.2025** können Lösungsanbieter Nutzer der WhatsApp-Business-App per Embedded Signup anbinden. Seit **23.10.2025** gilt das auch für **EU/EWR/UK**. Seit 25.11.2025 kommen Webhooks für bearbeitete und zurückgezogene Nachrichten.
- Nur für **Solution Partner oder Tech Provider**. Business-App ab Version 2.24.17.
- Verlauf der letzten **6 Monate** und Kontakte lassen sich synchronisieren. Die Synchronisation muss **innerhalb von 24 h** laufen, sonst wird der Nutzer wieder abgemeldet.
- Webhooks: `smb_message_echoes` spiegelt Nachrichten, die in der App gesendet wurden. `history` liefert den Verlauf, `smb_app_state_sync` die Kontakte. Eingehende Nachrichten kommen als normale Webhooks. Laut Meta werden Nachrichten zwischen App und API „mirrored“.
- Einschränkungen: **Gruppen werden nicht unterstützt** und nicht synchronisiert. Verschwindende Nachrichten, Einmal-Ansicht und Live-Standort in 1:1-Chats sind aus, Broadcast-Listen ebenfalls. Keine Anrufe über die API. Begleitgeräte gehen, außer WhatsApp für Windows und WearOS. Feste Durchsatzgrenze: 20 Nachrichten/Sekunde.
- Kosten: In der App gesendete Nachrichten bleiben kostenlos. Über die API gesendete Nachrichten kosten Cloud-API-Preise.
**Quellen:** https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started · …/business-phone-numbers/phone-numbers · …/messaging-limits · …/embedded-signup/onboarding-business-app-users · …/changelog (alle 06.10.2026)
**Belastbarkeit:** **belegt**. Die Regel „App alle 14 Tage öffnen, sonst Trennung“ steht nur bei Drittanbietern (z. B. whautomate.com, qiscus) → **Annahme**.

### 3. Preise, 24-h-Fenster, Vorlagenpflicht
**Befund:** Seit **01.07.2025** wird **pro zugestellter Vorlagen-Nachricht** abgerechnet. Marketing-Vorlagen kosten immer. Utility- und Authentication-Vorlagen kosten nur außerhalb des Service-Fensters. Freie Texte (keine Vorlage) im offenen Fenster sind **kostenlos**. Service-Gespräche sind seit 01.11.2024 gratis. Das **Kundenservice-Fenster** startet mit jeder Nachricht oder jedem Anruf des Nutzers und dauert **24 h**. Danach sind nur genehmigte Vorlagen erlaubt. Ein **Erstkontakt** geht also nur per Vorlage. Abgerechnet wird u. a. in EUR.
**Quellen:** …/whatsapp/pricing · …/messages/send-messages · …/changelog (06.10.2026)
**Belastbarkeit:** **belegt**. Konkrete Euro-Sätze für DE nicht geprüft.

### 4. Datenschutz / Ort der Verarbeitung
**Befund:** Die Cloud API verarbeitet Nachrichten in Meta-Rechenzentren. Meta handelt als Auftragsverarbeiter. Nachrichten werden höchstens **30 Tage** gespeichert. Transport-Verschlüsselung per Signal-Protokoll, die Schlüssel verwaltet Meta. Zertifikate: SOC 2 Type II und ISO 27001. **Local Storage:** Gespeicherte Daten bleiben in der gewählten Region; **„DE“ (EU/Germany) ist möglich**. Während der Verarbeitung können Inhalte bis zu **60 Minuten** auch in Rechenzentren weltweit liegen. Local Storage lässt sich nur vor der Registrierung der Nummer einschalten. Seit 01.12.2025 gibt es zusätzlich „No Storage“: Gespeicherte Daten werden gar nicht dauerhaft abgelegt. Die **WhatsApp Business Data Processing Terms** (Stand 22.08.2025) gelten automatisch, also ohne eigene Unterschrift. Für EU-Kunden ist WhatsApp Ireland Limited der Vertragspartner; ein Data Transfer Addendum (EU) regelt Übermittlungen. Unterauftragnehmer werden vorab angekündigt.
**Grobe DSGVO-Folge:** Für den Inhalt der Chats (auch Daten Dritter) ist Meta ein Auftragsverarbeiter mit möglichem Drittlandbezug. Eine Hetzner-Inbox ändert nichts daran, dass die Nachrichten zuerst über Meta laufen.
**Quellen:** …/whatsapp/data-privacy-and-security · …/whatsapp/local-storage · …/business-phone-numbers/registration · https://www.whatsapp.com/legal/business-data-processing-terms (06.10.2026)
**Belastbarkeit:** **belegt**. Die rechtliche Bewertung ist eine **Annahme**.

### 5. BSPs mit EU-Bezug
**Befund:** Die On-Premises API wurde am **23.10.2025** abgeschaltet. Seitdem laufen alle Anbieter über die Meta Cloud API. Ein „EU-Hosting“ eines BSP betrifft also nur seine eigene Schicht, nicht Meta. **360dialog** bezeichnet sich auf der eigenen Seite als „Official Meta Solution Partner“. Sitz und EU-Hosting sind dort nicht genannt; Sekundärquellen sagen Berlin bzw. Grünwald. Das Meta-Partnerverzeichnis ließ sich ohne Login nicht lesen.
**Quellen:** https://developers.facebook.com/docs/whatsapp/on-premises/sunset · https://360dialog.com/whatsapp-api (06.10.2026)
**Belastbarkeit:** Abschaltung **belegt**. Partner-Status von 360dialog nur als Eigenangabe belegt. EU-Hosting und weitere BSPs (Sinch, Infobip, Bird, superchat) **nicht belegt → Annahme**.

---

## B) Mail per IMAP vom Server

### 6. iCloud Mail
**Befund:** IMAP `imap.mail.me.com`, Port **993**, SSL (Ausweich: TLS). SMTP `smtp.mail.me.com`, Port **587**, SSL/TLS/STARTTLS, mit Anmeldung. Benutzername: für IMAP der Teil vor dem @, für SMTP die volle Adresse. Passwort: ein **app-spezifisches Passwort** ist Pflicht. Dafür braucht der Account **Zwei-Faktor-Authentifizierung** („must be protected with two-factor authentication“). Höchstens **25** aktive App-Passwörter. Wer das Apple-Passwort ändert oder zurücksetzt, macht **alle App-Passwörter ungültig**. Limits: 1.000 Mails und 1.000 Empfänger pro Tag, 500 Empfänger pro Mail, 20 MB je Mail. Der Dienst ist „designed primarily for personal use“; Massenmails sind verboten.
**Quellen:** https://support.apple.com/en-us/102525 · https://support.apple.com/en-us/102654 · https://support.apple.com/en-us/102198 (06.10.2026)
**Belastbarkeit:** **belegt**.

### 7. IONOS Mail
**Befund:** IMAP `imap.ionos.de`:**993** SSL/TLS. POP3 `pop.ionos.de`:995. SMTP `smtp.ionos.de`:**465** SSL/TLS, alternativ 587 STARTTLS. Benutzername ist die volle Adresse, das Passwort das des Postfachs („Jede E-Mail-Adresse hat ein eigenes Passwort“). Seit 29.01.2024 nur Absender aus derselben Domain. In der Hilfe steht nichts zu App-Passwörtern.
**Quelle:** https://www.ionos.de/hilfe/e-mail/allgemeine-themen/serverinformationen-fuer-imap-pop3-und-smtp/ (06.10.2026)
**Belastbarkeit:** Einstellungen **belegt**. „Keine App-Passwörter nötig“ ist eine **Annahme** (in der Hilfe nicht erwähnt).

### 8. iCloud CardDAV/CalDAV, Erinnerungen
**Befund:** Laut Apple sind App-Passwörter für Drittanbieter-Apps gedacht, die auf „mail, contacts, and calendars“ in iCloud zugreifen. Für CalDAV/CardDAV gibt es **keine offizielle Apple-Seite mit Server-Adressen**. `caldav.icloud.com` und `contacts.icloud.com` stehen nur in Community- und Drittquellen. Zu Erinnerungen sagt Apple (102457): Nach dem Upgrade ab iOS 13 sind sie „aren't compatible with earlier versions“; Zugriff gibt es nur über aktuelle Apple-Geräte und iCloud.com. Dass CalDAV dann **nicht mehr** geht, sagt Apple nicht wörtlich. Das steht nur bei BusyMac, 2Do und DAVx5.
**Quellen:** https://support.apple.com/en-us/102654 · https://support.apple.com/en-us/102457 · https://support.busymac.com/blog/112990-reminders-in-ios-13-and-macos-catalina-drops-support-for-caldav (06.10.2026)
**Belastbarkeit:** App-Passwort für Kontakte/Kalender **belegt**. Server-Adressen **Annahme**. Erinnerungen nicht per CalDAV: **Annahme** (stark gestützt, nicht von Apple wörtlich).

### 9. IMAP IDLE (RFC 2177)
**Befund:** Keiner der beiden Anbieter dokumentiert IDLE. Eigene Abfrage ohne Login (CAPABILITY), 06.10.2026:
- **IONOS:** `imap.ionos.de` meldet `IDLE` (dazu MOVE, UIDPLUS, SPECIAL-USE).
- **iCloud:** `imap.mail.me.com` meldet vor dem Login nur `XAPPLEPUSHSERVICE IMAP4rev1 SASL-IR AUTH=PLAIN AUTH=XOAUTH2…`, **kein IDLE**. Nach dem Login nicht geprüft (kein Login erlaubt).
**Belastbarkeit:** IONOS-IDLE per **Messung** belegt. iCloud-IDLE nach Login: **Annahme** (verbreitet, aber unbelegt). Vor dem Bau mit Testkonto prüfen.

---

## Konsequenz für MAKE OS
1. **Mail zuerst und ohne Mac:** Der Hetzner-Server holt IONOS (IMAP 993, IDLE gemessen) und iCloud (IMAP 993 + App-Passwort) direkt ab. Fallback: Abfrage alle 1–2 Min., falls iCloud kein IDLE hat.
2. **Zugangsdaten sicher ablegen:** App-Passwörter verschlüsselt speichern, getrennt je Person. Ein Hinweis in der Oberfläche: Ändert man das Apple-Passwort, sind alle App-Passwörter ungültig → „Verbindung neu herstellen“-Ablauf einbauen.
3. **Senden über iCloud SMTP nur 1:1:** Limits 1.000/Tag und nur private Nutzung. Newsletter oder Massenversand gehören weiter zu einem eigenen Versanddienst (passt zur Versand-Entscheidung vom 28.09.).
4. **Kein Nachbau des privaten WhatsApp:** Baileys, whatsapp-web.js usw. verstoßen gegen die Bedingungen und können das Konto sperren. Für Kevins und Malins private Nummern ausschließen.
5. **WhatsApp nur geschäftlich über die Cloud API:** realistisch mit eigener Business-Nummer **oder** per Coexistence mit der WhatsApp-Business-App. Coexistence braucht einen Tech Provider oder BSP und deckt **keine Gruppen** ab. Private Chats bleiben draußen.
6. **Kosten sind gering:** Antworten innerhalb von 24 h sind gratis. Nur Vorlagen kosten (Erstkontakt, Nachfassen nach 24 h). In der Inbox braucht es eine Anzeige für das 24-h-Fenster und eine Vorlagen-Auswahl.
7. **DSGVO:** WhatsApp-Inhalte laufen immer über Meta (Auftragsverarbeiter, EU-Vertrag mit WhatsApp Ireland). Local Storage „DE“ bzw. „No Storage“ vor der Registrierung der Nummer festlegen. Im Verzeichnis der Verarbeitungstätigkeiten (VVT) und in der Datenschutzerklärung aufnehmen.
8. **Kalender und Kontakte später per CalDAV/CardDAV mit demselben App-Passwort:** Server-Adressen sind nicht offiziell dokumentiert, daher mit Testkonto prüfen. Erinnerungen nicht per CalDAV einplanen.

---
## Gegenprüfung (Claude, 06.10.2026, selbst an der Quelle gelesen)
- ✅ Coexistence EU/EWR/UK: Changelog-Eintrag 23.10.2025 („… now supported for Coexistence in Embedded Signup: … EEA, EU, UK“); Start 11.02.2025.
- ✅ Coexistence-Grenzen (onboarding-business-app-users): Gruppen werden nicht synchronisiert; verschwindende Nachrichten/Einmal-Ansicht aus; Broadcast-Listen aus; Verlauf 180 Tage; Webhook `smb_message_echoes`; nur Solution Partner/Tech Provider; App ≥ 2.24.17.
- ✅ WhatsApp-Bedingungen EWR (gültig 17.08.2026): Verbot, „directly or through automated means“ Software/APIs zu bauen, die im Wesentlichen wie die Dienste funktionieren; Folge „disabling or suspending your account“.
- ✅ iCloud Mail (support.apple.com/102525): IMAP imap.mail.me.com:993 SSL, SMTP smtp.mail.me.com:587, Passwort = app-spezifisches Passwort.
- ⚠️ On-Premises-API-Abschaltung 23.10.2025: im Changelog NICHT gefunden → bis zur Prüfung „Annahme“.
- ⚠️ FAQ 1217634902127718 (inoffizielle Apps): Seite ließ sich nicht vollständig laden → Aussage stützt sich auf die Bedingungen oben.

## Gegenprüfung 2 (Claude, 07.10.2026)
- ✅ Startlimit (messaging-limits): neue Business-Portfolios 250 eindeutige Nummern je 24 h, nur für Nachrichten AUSSERHALB des Kundenservice-Fensters; auf 2.000 per Unternehmensverifizierung, Partner-Verifizierung oder 2.000 zugestellte Vorlagen in 30 Tagen; danach automatisch 10.000/100.000/unbegrenzt.
- ✅ Preise (pricing): seit 01.07.2025 pro zugestellter Vorlage; Nicht-Vorlagen im offenen 24-h-Fenster kostenlos; Utility-Vorlagen im offenen Fenster kostenlos; Preisliste je Land: business.whatsapp.com/products/platform-pricing#rates (Stand der Karten 01.07.2026) — DE-Preis dort ablesen, nicht hier behauptet.
- ⚠️ Anzeigename (display-names): Prüfung erfolgt automatisch beim Erreichen höherer Limits, Ergebnis per Webhook APPROVED/REJECTED; die inhaltlichen Regeln stehen in einem eigenen Help-Center-Artikel → vor Registrierung lesen.
