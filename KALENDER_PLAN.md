# Kalender ausbauen — Vorbild Google Calendar (Kevin 29.09.2026)

## Bestand (Karte 29.09.)
`/os/kalender` (Tag/Woche/Monat/Agenda, Mini-Monat, Suche, Kürzel, Klick-Anlegen, Verschieben/Dauer ziehen, Wiederholung + Erinnerung, mehrere Kalender mit Farben, Sicht Kevin/Malin/Gemeinsam, Fristen/Aufgaben-Ebenen, Privat/Business), iCloud CalDAV lesen+schreiben (ETag), Mac-Zulieferer nur lesend, M365 nur Beispieldaten. Daneben Wochenplaner `/os/planung/woche` (Blöcke, Aufgaben einplanen) und ein Alt-Dashboard `/calendar` mit Beispieldaten.

## Kevins Entscheidungen
1. **Termin-Arten im Anlegen** (wie Google-Reiter): Termin · Aufgabe · Abwesend · Fokuszeit · Arbeitsort; Aufziehen im Raster; Farbe je Termin; frei/beschäftigt; privat sichtbar; Zeitzone; Wiederholung mit allen Optionen (Intervall, Tage, Anzahl, bis).
2. **Feiertage NRW und Geburtstage** (Familie + CRM) als eigene, einzeln schaltbare Kalender.
3. **CRM und Aufgaben am Termin:** Kontakt/Firma/Mandat verknüpfen → Aktivität im CRM; Aufgaben im Kalender abhaken und per Ziehen einplanen.
4. **Zeit-Auswertung** (Stunden in Meetings, Fokus, Mandaten, privat je Woche) + **Jahres- und 4-Tage-Ansicht**.
5. **Gäste mit echter Einladung nach Klick:** Gäste (auch aus dem CRM) → vor dem Speichern „Einladung an n Personen senden?“ → erst dann über iCloud verschickt; Zusagen/Absagen am Termin sichtbar.
6. **Gemeinsame freie Zeit** (Kevin + Malin übereinander, freie Lücken vorschlagen).
7. **Öffentliche Buchungsseite** („30 min mit Kevin“): Link für Externe, Spam-Schutz, Bestätigung per Mail-Link, Freigabe, erst dann fester Termin; DSGVO-Hinweis.
8. **Ein Kalender:** Wochenplaner wird Modus „Planen“ im Kalender; Alt-Dashboard `/calendar` mit Beispieldaten entfällt.

## Pakete
- **K1 Kern:** Termin-Modell (Arten, Farbe, TRANSP, CLASS, Zeitzone, volle Wiederholung) in `lib/kalender/**` + Termin-Route, Anlege-Dialog wie Google (Reiter, alle Felder), Aufziehen im Raster, Arbeitsort-Leiste, Abwesend/Fokuszeit-Logik.
- **K2 Quellen & Auswertung:** Feiertage NRW, Geburtstage, Zeit-Auswertung, Jahr + 4 Tage.
- **K4 Termine finden:** gemeinsame freie Zeit + öffentliche Buchungsseite.
- **K3 Verbindungen (nach K1):** CRM am Termin → Aktivität, Aufgaben abhaken/einplanen, Gäste + Einladungen nach Klick, Zusagen.
- **K5 Ein Kalender (nach K1):** Wochenplaner als Modus „Planen“, Alt-Dashboard und dessen Kalender-Kontext entfernen, alte Schreibwege (`/api/apple-calendar/*`) auf `/api/kalender/termin` umstellen.
Alles lokal; Upload nur auf Kevins Wort.

## Verbindungen (Kevin 29.09.: „alles sauber mit allen verbunden, Datenhaltung sauber, einen Schritt weiter denken“)
- **Eine Quelle je Information:** iCloud = Wahrheit für Termine; MAKE-OS-Zusätze (Art, Farbe, Bezug, Fokus-Verknüpfung) als X-Eigenschaft und/oder Neben-Bestand über UID/RECURRENCE-ID, mit Abgleich, falls Apple X-Eigenschaften verliert. Aufgabe-als-Termin = dieselbe Aufgabe (keine Kopie). Geburtstag genau einmal je Person. Buchung = ein CRM-Vorgang.
- **Gemeinsame Lesefunktionen** statt Doppel-Logik: `verfuegbarkeitFuer` (Abwesend, Arbeitsort, Arbeitszeiten), Feiertage NRW, `geburtstageIm`, freie Zeit, Wochen-Auswertung — genutzt von Kalender, Aufgaben, Heute, Glocke, ZOE, Buchung, Angebot, Brain.
- **Jede neue Kennung** → Verbindungsprüfung; **Personenbezug** → Speicher-Register/Art. 17.
- **K6 Verbindungsrunde** (nach K1–K4): Karte „Zeit & Termine“ über alle Module (Aufgaben, Ziele, Zeitmessung, CRM-Follow-ups/Deals/Angebote/Mandate/Events/Power Hour, Finanzen-Fälligkeiten/Steuern, Familie, Gesundheit/Sport, Inbox, ZOE, Heads, Glocke, Heute, Brain) → doppelte Wahrheiten auflösen, fehlende Verbindungen bauen.

## Offene Verbindungen für K6 (gesammelt aus K1/K2)
- `lib/brain/app-spiegel.ts` (`_App/Woche`) an `auswertungMarkdown()` anschließen.
- `app/api/kalender/route.ts` (Mac-Rückfall) auf `termineLesen()` umstellen (Abbildung doppelt).
- Auswertung: mehrere Gäste je Termin (`ATermin.kontakte`) sobald K3 Gäste einführt.
- Glocke + Heute: Termine, Follow-ups, Fristen (Verbindungskarte Befund 8/9).
- ZOE-Kalender-Agent reparieren (blind, autonom über Altweg, fest verdrahtete Kalender) — Verbindungskarte Befund 1.
- (aus K4) ZOE-Werkzeug `freie_zeit` (nur lesen) → `freieZeitFuer`; Angebot „Termin zum Besprechen vorschlagen“ → `freieZeitFuer`; Heute + Glocke: offene Buchungsanfragen; K3: Gast-Einladung statt Notiz bei bestätigter Buchung.

## Qualität (Kevin 29.09.)
- Nach K3/K5/K6: **Prüfliste „100 typische Fehler bei Kalender-Systemen“** (Web-Recherche, `KALENDER_FEHLER_PRUEFLISTE.md`) gegen den Code abgleichen (2 Prüfer), Befunde reparieren, Gesamtprüfung.
- **Sinnvolle Zusatzthemen** aus der Recherche (Timeboxing, Meeting-Vorbereitung aus CRM, Nachbereitung → Follow-ups, Puffer/Reisezeit, Kontingente je Mandat, Abrechnung aus Terminen, Reisen aus Mails …) in die Verbindungsrunde aufnehmen — Auswahl der 15 sinnvollsten.
