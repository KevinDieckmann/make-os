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

## 12. Schärfung beim Bau (06.10., vor dem ersten Strich Code)
Kevin: „nochmal nacharbeiten, dass es wirklich gut und sinnig wird.“ Vorbilder: Superhuman (Tempo, Tasten, Zero), HEY (Screener,
Fächer statt Ordner), Front (Gespräch + Kontext daneben). Übersetzt in unsere CI und Sprache — 80 % Ruhe, 20 % Akzent.

**1. Was zuerst kommt (eine Spalte, feste Reihenfolge).**
- **Oben das Lagebild:** je Bereich EINE Zeile (`Privat · 2 brauchen Antwort · 1 wartet · 1 Termin`), Zahlen anklickbar = Filter. Bereiche ohne
  Postfach erscheinen nicht. Darunter der **ZOE-Satz** (ohne Modell aus dem Strom abgeleitet, nur Vorschlag, ein Klick öffnet das Gespräch).
- **Darunter die Arbeitsliste**, nur Fächer mit Inhalt: Wiedervorlage fällig → **Antworten** → **Nachfassen fällig** → **Termine** →
  **Geld & Papier** → **Neue Absender** (kompakt: Zulassen · Blocken direkt in der Zeile) → **Info & Rundschreiben** (eingeklappt, „alle
  erledigen“). „Warten auf“ (noch nicht fällig) steht nur als Zahl im Lagebild und als eigener Filter — es ist nichts zu tun.
- **Bereichs-Umschalter** (Alle · je Bereich) oben in der Seite; `?space=privat|business` aus dem Kopf filtert auf dem Server mit.

**2. „Antwort nötig“ vs. „Warten auf“ — zuverlässig, ohne Modell.**
- Maßgeblich ist die **jüngste echte Nachricht** des Gesprächs: von außen → *Antworten*; von uns (eigene Adresse/Alias oder Gesendet-Ordner)
  → *Warten auf*. **Automatische Antworten** (Kopf `Auto-Submitted` ≠ `no`, `X-Autoreply`, Betreff „Automatische Antwort/Abwesend/Out of
  Office“) zählen nicht als Antwort — das Gespräch bleibt in „Warten auf“.
- **Rundschreiben** am Kopf, nie am Inhalt: `List-Unsubscribe`, `List-Id`, `Precedence: bulk|list|junk`, `Auto-Submitted`, Absender
  `noreply/no-reply/mailer-daemon`, bei Gmail zusätzlich die Kategorien. Eine zugeordnete Person ist nie Rundschreiben.
- **Nachfassen fällig** ab 3 Tagen ohne Antwort; nach 30 Tagen fällt ein Gespräch aus „Warten auf“ (bleibt in der Quelle und im Verlauf).
- **Termine:** Anhang `text/calendar` oder Einladungs-Wörter im Betreff. **Geld & Papier:** Rechnung/Mahnung/Vertrag/Finanzamt/Beleg im
  Betreff oder PDF mit solchem Namen. Beides nur für Gespräche, deren jüngste Nachricht von außen kommt.
- **Neue Absender:** keine Kontaktakte mit der Adresse, nie zugelassen, nie von uns angeschrieben, kein Rundschreiben. Die Entscheidung gilt
  **je Person** (nicht je Haushalt) für alle ihre Postfächer. Blocken blendet aus (nichts wird gelöscht oder beim Anbieter verschoben),
  Rückgängig unter „Postfächer & Absender“.

**3. Erledigt, Später, Gelesen — eine Stelle, zurückgeschrieben.**
- Erledigt = Gmail archivieren / IMAP in den Archiv-Ordner (fehlt er, legt MAKE OS „Archiv“ an). Für „Warten auf“ merkt sich MAKE OS
  „erledigt bis Nachricht X“ — kommt Neues, ist das Gespräch wieder da.
- Später = Wiedervorlage mit Datum (Morgen · Montag · in einer Woche); eine neue Nachricht holt das Gespräch sofort zurück.
- Öffnen = gelesen (`UNREAD` weg bzw. `\Seen`).

**4. Leere Zustände.**
- Kein Postfach: ein großer Leerzustand „Verbinde dein erstes Postfach“ mit der einen Hauptaktion.
- Alles erledigt: ruhiger Smaragd-Haken „Inbox leer“ + was als Nächstes kommt (nächste Wiedervorlage, wartende Gespräche).
- Ein Fach ohne Inhalt erscheint nicht — keine leeren Karten.

**5. Fehler und Verbindungen — immer sichtbar, nie laut.**
- Unter dem Lagebild eine Leiste **Postfächer**: je Postfach ein Chip mit Punkt — Smaragd = aktuell, gelb = verzögert (> 30 Min.), Granat =
  Anmeldung gescheitert. Nur im letzten Fall zusätzlich eine Hinweis-Karte oben mit **„Verbindung erneuern“** (Apple macht App-Passwörter bei
  jedem Passwortwechsel ungültig). Nach gescheiterter Anmeldung fragt MAKE OS nicht weiter an (Sperrgefahr), bis die Person erneuert.
- Senden scheitert → der Text bleibt stehen, Hinweis „kritisch“ mit „Noch einmal senden“; nichts geht doppelt raus (Anfrage-Kennung).

**6. Gespräch und Kontext.**
- Rechner: Liste links, Gespräch rechts (klebend), darunter bzw. daneben die **Kontext-Spalte** (Person/Firma mit Link in die Akte, offene
  Deals, offene Aufgaben zur Person, letzter/nächster Termin). Handy: Liste zuerst, das Gespräch als eigene Ansicht mit „Zurück“, Kontext
  unter dem Gespräch eingeklappt.
- **„ZOE schlägt vor“** — höchstens drei ruhige Knöpfe, ohne Modell abgeleitet, alles erst auf Klick über die bestehenden Schreibwege:
  Frist im Text („bis Freitag“, „bis 12.10.“) → *Aufgabe bis …* · Einladung/Terminwort → *Termin vorschlagen* · PDF in Geld & Papier →
  *Beleg ablegen* · bekannte Person, noch nicht bestätigt → *Zuordnen* · offener Deal der Person → *Deal-Berührung*.
- **Zuordnung:** „gehört zu …“ wird angezeigt, sobald die Adresse in der Kartei steht. In den **Verlauf der Kontaktakte** kommt ein Gespräch
  erst nach dem Klick „Zuordnen“ — danach auch seine neuen Nachrichten. (Gilt jetzt auch für Gmail; bisher schrieb Gmail automatisch.)

**7. Antworten.** Immer aus dem Postfach, in dem das Gespräch liegt (Absender und Signatur des Postfachs, sichtbar im Editor). ZOE-Entwurf
nur auf Klick; „Senden“ ist ein Einzelklick der Person. iCloud: Hinweis „nur 1:1“.

**8. Tempo.** Die Liste kommt aus dem Spiegel auf dem Server (nie live beim Anbieter), mit ETag — der 60-s-Abgleich im Browser kostet
meist nur ein 304. Text lädt erst beim Öffnen. Aktionen wirken sofort in der Liste und werden bei Fehler zurückgenommen. Abgleich im Takt:
IMAP alle 2 Min., mit IDLE alle 15 Min. + sofort bei neuer Post; höchstens eine IDLE-Verbindung je Postfach.

**9. Tasten und Wischen.** j/k wandern · Enter öffnen · e erledigt · s später · a Aufgabe · r antworten · Esc zurück. Handy: Zeile nach
rechts wischen = erledigt, nach links = später (mit „Rückgängig“).
