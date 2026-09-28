# Versand aus MAKE OS — Plan (Kevin 28.09.2026, Entwurf zur Freigabe)

**Kevins Entscheidung:** MAKE OS verschickt künftig selbst — einzelne Mails an Kontakte, Follow-up-Folgen, Einladungen zu Make.One-Events, Newsletter und Kampagnen an Segmente. **Überall zuerst ein Entwurf, jede Mail wird einzeln per Klick freigegeben, erst dann versendet MAKE OS.** Persönliche Mails über eure Microsoft-365-Postfächer, Masse über einen Versanddienst. Die alte Regel „MAKE OS verschickt nichts“ ist damit aufgehoben. Gebaut wird erst nach Kevins Freigabe dieses Plans, nur lokal; Upload auf sein Wort.

## 1 · Ein Postausgang für alles
- Jede ausgehende Mail ist zuerst ein **Entwurf im Postausgang** (Speicher `ausgang--<haushalt>`): Absender (Kevin · Malin · Make.One), Empfänger (Kontakt-Kennung + Adresse), Betreff, Text, Anlass (von Hand, Follow-up-Folge, Event, Kampagne), Weg (M365 oder Versanddienst).
- Status: **Entwurf → freigegeben → versendet** (oder Fehler mit Grund). Wer freigegeben hat und wann, steht dauerhaft am Eintrag.
- ZOE und die Heads schreiben **nur Entwürfe**. Nichts geht ohne euren Klick „Senden“ hinaus — serverseitig erzwungen, nicht nur in der Oberfläche.
- Sichtbar an drei Stellen: im Kontakt (Schnellaktion E-Mail → Entwurf → Senden), in der Power Hour / im Follow-up und als eigene Liste **„Postausgang“** in der Markttraktion (alles, was auf Freigabe wartet).
- Nach dem Versand: Aktivität „E-Mail gesendet“ am Kontakt, Eintrag in der Auskunft nach Art. 15.

## 2 · Harte Prüfung vor jedem Versand (serverseitig)
Eine Mail wird nur verschickt, wenn alles grün ist — sonst bleibt sie mit Grund im Postausgang:
1. **Rechtsgrundlage je Kanal** (bestehende Ampel): werbliche Mail nur mit Einwilligung mit Nachweis (Zeitpunkt, Wortlaut/Version, Beleg) oder echtem Bestandskundenprivileg (§ 7 Abs. 3 UWG: eigenes Mandat, ähnliche Leistung, Hinweis bei Erhebung, Widerspruchshinweis in jeder Mail). Persönliche 1:1-Mail in laufender Geschäftsbeziehung: erlaubt, aber ohne Werbeinhalt-Automatik.
2. **Sperrliste** (gehasht, überlebt Löschen und Import), **Werbesperre**, **unzustellbar** (Bounce).
3. **Pflichtteile** in werblichen Mails: Abmeldelink, Impressum/Absender, Widerspruchshinweis.
4. **Menge begrenzt** (z. B. höchstens 50 je Stunde je Absender über M365), keine Doppelsendung (Idempotenz je Entwurf).

## 3 · Weg A — persönliche Mails über Microsoft 365
- Versand über **Microsoft Graph** im Namen des jeweiligen Postfachs (Kevin, Malin). Die Mail liegt danach normal in „Gesendet“, Antworten kommen ins Postfach.
- Einmalig nötig: eine **App-Registrierung in eurem Microsoft-365-Mandanten** (Recht „Mail.Send“ delegiert) und je Person eine Anmeldung in MAKE OS („mit Microsoft verbinden“). Die Zugangstoken liegen verschlüsselt auf dem Server, nie im Browser.
- Später möglich (eigener Schritt): Antworten automatisch als Aktivität erfassen („Mail.Read“).

## 4 · Weg B — Newsletter, Kampagnen, Einladungen über einen Versanddienst
- Empfehlung **Brevo** (EU, DSGVO, AVV, Double-Opt-in, Abmelde- und Bounce-Verwaltung eingebaut); Alternativen CleverReach (DE) oder Mailjet (EU).
- **Absender-Domain** mit SPF, DKIM und DMARC (DNS-Einträge setzt ihr bei eurem Domain-Anbieter; ich liefere die Werte).
- **Double-Opt-in** für Newsletter: Bestätigungsmail ohne Werbung, Nachweis wird am Kontakt gespeichert.
- **Abmeldung mit einem Klick** (List-Unsubscribe, RFC 8058) — wirkt sofort, landet in der Sperrliste.
- **Bounces** kommen über den Dienst zurück und sperren die Adresse.
- **Kein Öffnungs-/Klick-Tracking** (§ 25 TDDDG) — gemessen wird wie bisher an Antworten, Gesprächen und Deals.

## 5 · Folgen, Events, Kampagnen
- **Follow-up-Folgen:** Schritte (z. B. Tag 0, 3, 10) erzeugen am Fälligkeitstag je Kontakt einen Entwurf im Postausgang; eine Antwort oder ein Gespräch stoppt die Folge automatisch.
- **Make.One-Events:** Einladung, Erinnerung, Danke je Gast als Entwurf, mit Kalenderdatei (ICS), Absender Make.One.
- **Kampagnen/Newsletter an Segmente:** ein Entwurf je Aussendung mit Vorschau und Empfängerliste (nur Kontakte mit gültiger Einwilligung, Gesperrte automatisch raus). Freigabe-Modus: siehe offene Frage 1.

## 6 · Reihenfolge (Vorschlag)
1. **Stufe 1:** Postausgang + harte Prüfung + 1:1-Mails über M365 (geringstes Rechtsrisiko, sofort nützlich für Malin).
2. **Stufe 2:** Follow-up-Folgen und Make.One-Einladungen.
3. **Stufe 3:** Versanddienst, Double-Opt-in, Newsletter/Kampagnen, Abmeldung, Bounces.
Jede Stufe mit negativen Tests: ohne Freigabe kein Versand, an Gesperrte kein Versand, werblich ohne Einwilligung kein Versand, doppelte Freigabe = ein Versand. Entwicklung und Tests nur im Test-Modus des Dienstes bzw. an `@example.invalid`.

## 7 · Was ihr beisteuert
- App-Registrierung im Microsoft-365-Mandanten (ich schreibe die Klick-Anleitung).
- Konto beim Versanddienst + AVV abschließen.
- DNS-Einträge für die Absender-Domain.
- Festlegen der Absender-Adressen (z. B. kevin@…, malin@…, einladung@make.one).

## Offene Fragen an Kevin
1. Newsletter: eine Freigabe je Aussendung (nach Vorschau und Empfängerliste) oder wirklich je Empfänger?
2. Versanddienst: Brevo, CleverReach oder Mailjet?
3. Absender-Domain für Make.One und Marketing?
4. Mit Stufe 1 (1:1 über M365) anfangen?
