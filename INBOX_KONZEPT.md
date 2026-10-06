# Inbox 2 — Konzept (06.10.2026)

**Auftrag Kevin (06.10.):** „Die Inbox braucht ein Upgrade … Privat wird nur Mail benötigt. KD Ventures hat Apple Mail und MAKE Innovation Google. … Dann müssen wir nur daraus alles ableiten können, schnell was passiert. … WhatsApp wäre noch nötig, wenn möglich.“
**Entschieden (Klickrunde 06.10.):** Mail holt der Server selbst (kein Mac nötig) · Microsoft 365/KEMARIS raus · dazu Malins iCloud-Kalender.
**Entschieden (Klickrunde 2, 06.10.):**
- Postfächer: **Kevin** — MAKE Innovation (Gmail `@makeinnovation.de`) · KD Ventures `22@kevindieckmann.de` (IONOS) · Privat `kevindieckmann@icloud.com` (iCloud, App-Passwort). **Malin** — MAKE Innovation (Gmail) · Privat `11@malinwuerriehausen.de` (IONOS).
- **WhatsApp: eigene, neue Business-Nummer** (Kevin hat eine Nummer) über die Cloud API direkt bei Meta — Variante A. Meta-Business-Konto/Nummer-Registrierung macht Kevin selbst (Bedingungen akzeptieren); wir bauen Adapter + Webhook vorbereitet.
- **ZOE macht alles nur als Vorschlag** — jede Übernahme (Zuordnung, Beleg, Aufgabe, Termin, Antwort) braucht einen Klick.
- Bild (Lagebild · Fächer · Gespräch mit Kontext) **passt — beim Bau nachschärfen, dass es wirklich gut und sinnig wird.**

**Fakten:** `research/inbox/FAKTEN_WHATSAPP_IMAP.md` (Primärquellen, gegengeprüft). Ist-Befund: Abschnitt 9.

---

## 1. Leitidee
Die Inbox ist kein Postfach, sondern das **Lagebild aller Kommunikation**: Auf einen Blick sieht man je Bereich, *was gerade passiert* — wer eine Antwort braucht, worauf wir warten, welches Geld und welche Termine anstehen. Jede Nachricht kann mit einem Klick zu einer Aufgabe, einem Termin, einem CRM-Eintrag oder einem Beleg werden. **Eine Inbox, ein Datenmodell, eine Quelle der Wahrheit.**

## 2. Quellen und Bereiche (pro Person, serverseitig)
| Bereich | Quelle | Weg | Push |
|---|---|---|---|
| **MAKE Innovation** | Google Workspace (`@makeinnovation.de`) | Gmail-API, Anmeldung über Google (läuft seit 06.10.) | Abfrage alle 90 s (Pub/Sub optional) |
| **KD Ventures** | `22@kevindieckmann.de` (Postfach bei IONOS) | IMAP `imap.ionos.de:993` + SMTP `smtp.ionos.de` | IMAP IDLE (IONOS meldet IDLE, geprüft 06.10.) |
| **Privat** | iCloud-Mail | IMAP `imap.mail.me.com:993` + SMTP `smtp.mail.me.com:587`, **app-spezifisches Passwort** (Apple-Pflicht) | Abfrage alle 1–2 min (IDLE bei iCloud unbelegt → Test) |
| **WhatsApp** (Option) | WhatsApp Business Platform (Cloud API) | Webhook → Server | sofort |

- **Postfach-Register je Person:** Jedes Postfach hat genau einen Bereich (Privat · KD Ventures · MAKE Innovation · weitere Gesellschaften aus dem Gesellschafts-Register). Der Bereich wird **auf dem Server** gefiltert: Ein Business-Bereich sieht nie Privates; die Person selbst sieht in „Alle“ alles Eigene. (Gleiche Regel wie Finanzen.)
- **Zugangsdaten** (App-Passwörter, IONOS-Passwort) liegen verschlüsselt (Hülle) je Person, nie im Browser; „Verbindung erneuern“, wenn Apple bei einer Passwortänderung alle App-Passwörter ungültig macht.
- **Verkaufbar:** Die Adapter sind generisch (Gmail · IMAP/SMTP beliebiger Anbieter · WhatsApp). Ein Kunde trägt seine Postfächer ein — nichts ist auf Kevin/Malin verdrahtet.

## 3. Ein Strom auf dem Server
- **Ein Endpunkt `/api/inbox`** liefert vereinheitlichte **Gespräche** (nicht Einzelmails): Quelle, Bereich, Beteiligte, letzte Nachricht, Ausschnitt, Anhänge, Status, Einstufung, Bezüge.
- **Stabile Kennungen:** Gmail-Thread-ID · IMAP `UIDVALIDITY:UID` + `Message-ID`, Gespräche über `References/In-Reply-To` · WhatsApp-Nachrichten-ID. (Der heutige Apple-Index-Fehler verschwindet.)
- **Status lebt an einer Stelle und wird zurückgeschrieben:** erledigt = Gmail „archivieren“ / IMAP in „Archiv“ verschieben · gelesen = `\Seen` · später = Wiedervorlage mit Datum.
- **Spiegel je Person × Postfach**, verschlüsselt, mit Frist (z. B. Volltext 90 Tage, Kopfdaten 12 Monate — Vorschlag); „Trennen“ löscht den Spiegel.

## 4. Oben: das Lagebild („was passiert“)
Eine Zeile je Bereich, Zahlen anklickbar:

`MAKE Innovation · 4 brauchen Antwort · 2 warten auf andere · 1 Termin-Anfrage · 1 Rechnung`
`KD Ventures · 1 braucht Antwort · 1 Frist (Fr) · 2 Belege`
`Privat · 2 brauchen Antwort · 1 Paket`

Darunter **ZOE in einem Satz** (nur Vorschlag): „Wichtigste Antwort heute: Herr X wartet seit 3 Tagen auf das Angebot.“

## 5. Die Arbeitsliste (Fächer)
1. **Antworten** — Menschen, die etwas von uns wollen (oben: Wiedervorlagen, die heute fällig sind)
2. **Warten auf** — wir haben geschrieben, keine Antwort seit n Tagen → Nachfassen per Klick
3. **Geld & Papier** — Rechnungen, Verträge, Behörden → Beleg in Finanzen (richtiger Bereich)
4. **Termine** — Einladungen und Anfragen → Kalender-Vorschlag / Buchungslink
5. **Neue Absender** (Screener) — einmal zulassen oder blocken, danach nie wieder fragen
6. **Info & Rundschreiben** — eingeklappt, am Stück wegräumen

Bedienung: **Zero-Durchlauf** (j/k wandern · e erledigt · a Aufgabe · s später · r antworten), am Handy **Wischen** (rechts erledigt, links später) — passt zum vorgemerkten „Wischen überall“.

## 6. Ableiten — jede Nachricht verbindet sich
| Aus der Nachricht | wird | Modul |
|---|---|---|
| Absender | Kontakt/Firma zugeordnet, Verlauf im CRM sichtbar | CRM / Markttraktion |
| Bezug zu Deal/Projekt | „letzte Berührung“, Nachfassen, Deal-Aktivität | Deals / Follow-up |
| „Bitte bis Freitag …“ | Aufgabe mit Frist und Link zurück zur Mail | Aufgaben |
| Termin-Anfrage / Einladung | Termin-Vorschlag oder Buchungslink | Kalender |
| Rechnung/Beleg im Anhang | Beleg im richtigen Bereich (KD Ventures / MAKE) | Finanzen |
| Antwort auf Kampagne/Einladung | Rücklauf gezählt | Marketing / Make.One |
| Lage aller Bereiche | Morgen-Briefing und Tageslauf | ZOE / Heute |

**Regel (Kevin 06.10.):** Erkennen macht ZOE, entscheiden macht der Mensch — **alles ist Vorschlag + ein Klick**, auch Zuordnung und Beleg-Ablage.

## 7. Antworten und Senden
- ZOE-Entwurf im Ton des Bereichs → **Einzelklick „Senden“** über die richtige Quelle (Gmail-API · IONOS-SMTP · iCloud-SMTP · WhatsApp).
- Signatur und Absender je Bereich automatisch richtig (nie aus Versehen privat für KD Ventures).
- iCloud nur 1:1 (Apple: max. 1.000 Mails/Tag, „primarily for personal use“); Massenversand bleibt beim Versanddienst.

## 8. WhatsApp — was geht, was nicht (belegt)
- **Private WhatsApp-Konten: nein.** Es gibt keinen offiziellen Zugang; Nachbauten (z. B. Baileys) verstoßen gegen die WhatsApp-Bedingungen (EWR, gültig 17.08.2026: keine Software, die „substantially the same as our Services“ funktioniert; Folge: Sperre des Kontos).
- **Geschäftlich: ja, über die Cloud API von Meta.**
  - **Variante A – eigene Business-Nummer** (z. B. MAKE Innovation), direkt bei Meta: sauber, voller Funktionsumfang der API; die Nummer läuft dann *nur* über MAKE OS.
  - **Variante B – Coexistence:** eine bestehende **WhatsApp-Business-App**-Nummer bleibt im Handy *und* kommt in MAKE OS an (EU seit 23.10.2025). Grenzen: nur über Solution Partner/Tech Provider anbindbar, **Gruppen werden nicht synchronisiert**, verschwindende Nachrichten/Broadcast-Listen werden abgeschaltet, Verlauf 180 Tage wird übernommen.
- Kosten: Antworten innerhalb von 24 h nach Kundennachricht sind frei; Erstkontakt/außerhalb des Fensters nur mit genehmigter Vorlage (kostenpflichtig, pro zugestellter Vorlage).
- Datenschutz: Meta ist Auftragsverarbeiter (WhatsApp Business Data Processing Terms); Speicherort „DE“ (Local Storage) oder „No Storage“ vor Registrierung wählen; Eintrag ins VVT und die Datenschutzerklärung.
- In der Inbox: 24-h-Fenster als Uhr am Gespräch, Vorlagen-Auswahl, wenn das Fenster zu ist.

## 9. Aufräumen (heutiger Bestand)
- Zwei Inboxen → **eine**: aus der alten (`/os/inbox/voll`, InboxView) wandern Fächer, Screener und Zero-Durchlauf hinein; danach fällt sie weg.
- **Raus:** Microsoft-365-Bestand (`/api/microsoft`, manuell befüllt), `/api/eingang` (iCloud-Datei, auf dem Server tot), Apple-Mail per osascript + Mail im Mac-Zulieferer (ersetzt durch IMAP).
- Fehler behoben durch das neue Modell: Apple-Mail-IDs nach Index (Status landete auf falscher Mail), kein Mailtext auf dem Server, CRM-Zuordnung nur für Gmail.
- **Malins iCloud-Kalender:** iCloud-CalDAV je Person (heute nur Kevins Apple-ID).

## 10. Datenschutz & Sicherheit
Verschlüsselt im Ruhezustand · Zugangsdaten je Person getrennt · Bereichstrennung serverseitig · KI sieht nur Kopf + Ausschnitt zur Einstufung (Volltext nur beim Entwurf auf Klick) · Fristen/Löschung · Routen-Register + Wächtertests · VVT-Einträge je Quelle · Testkunden-Instanzen sehen nie unsere Daten.

## 11. Bau-Pakete
1. **Fundament:** Postfach-Register, IMAP/SMTP-Adapter (IONOS, iCloud), einheitlicher Strom `/api/inbox`, stabile IDs, Status zurückschreiben, Tests.
2. **Oberfläche:** Lagebild, Fächer, Gespräch mit Kontext-Spalte (CRM, Aufgaben, Termine, Deals), Senden je Quelle, Zero-Durchlauf + Wischen, Handy.
3. **Ableiten:** CRM-Zuordnung für alle Quellen, Aufgabe/Termin/Beleg aus Nachricht, Warten-auf/Nachfassen, ZOE-Lage im Briefing.
4. **Aufräumen + Malins iCloud-Kalender.**
5. **WhatsApp** (nach Entscheidung + Meta-Konto/Nummer).
Alles lokal mit erfundenen Demo-Postfächern geprüft; hochladen nur auf Kevins Wort.
