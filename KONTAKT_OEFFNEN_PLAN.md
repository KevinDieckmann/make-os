# „Kontakt öffnen“ — Plan (Kevin 28.09., nur lokal, Upload erst auf Kevins Wort)

Vorbild HubSpot (Screenshots von Kevin: Kontaktseite mit Über · Aktivitäten · Umsatz · Intelligence, links Kontakt + Schnellaktionen, rechts Unternehmen + Deals). Unser Kopf bleibt, wie er ist.

## Entscheidungen
- **Name:** nicht mehr „Akte öffnen“, sondern **„Kontakt öffnen“** (überall in der Oberfläche; Adresse `a=akte` bleibt kompatibel).
- **Aufbau:** Kopf oben (bleibt), darunter **drei Spalten**: links Kontaktdaten + Schnellaktionen (Notiz · E-Mail · Anruf · Aufgabe · Meeting) + wichtigste Felder; Mitte Reiter; rechts Firma · Deals · Mandate mit „+ Hinzufügen“. Am Handy untereinander.
- **Reiter:** **Über · Aktivitäten · Umsatz · Daten** (Daten = Stammdaten + Beziehung + Datenschutz).
- **Datensatz-Zusammenfassung** in „Über“: sofort aus den Daten (letztes Gespräch, offener Deal, Umsatz, nächster Schritt) mit Quellen-Nummern; mit KI-Guthaben formuliert ZOE daraus einen Text und beantwortet „Frage stellen“.
- **Lifecycle** wählbar als Chip mit Vorschlag: **Lead · Marketing Qualified Lead · Sales Qualified Lead · Opportunity · Angebot · Kunde · Follow Up** (Follow Up = nach dem Auftrag: Nachbetreuung, Folgegeschäft, Empfehlung). Vorschlag: aktives Mandat → Kunde, beendetes Mandat/gewonnener Deal ohne aktives Mandat → Follow Up, offener Deal in Angebotsstufe → Angebot, offener Deal → Opportunity, Lead-Status SQL → SQL, Marketing-Signal (Antwort, Anfrage, Event, warm) → MQL, sonst Lead.
- **MAKE OS verschickt nichts:** „E-Mail“ = Entwurf + Mail-Programm öffnen, „Anruf“ = Telefon-Link + Anruf festhalten.

## Pakete (parallel)
- **H1 Aufbau & Lifecycle:** `components/os/crm/Akte.tsx` (Drei-Spalten, Reiter Über/Aktivitäten/Umsatz/Daten, Zusammenfassung, Schnellaktionen, rechte Spalte), Umbenennung „Kontakt öffnen“, Lifecycle (Typ, Säuberung, Vorschlag, Import-Mapping, Kopf-Chip, Kartei-Filter/Spalte, Export, Segment-Kriterium, Head-Datenblock).
- **H3 Aktivitäten:** `components/os/crm/kontakt/AktivitaetenReiter.tsx` — Unter-Reiter Alle · Notizen · E-Mails · Anrufe · Aufgaben · Meetings, Suche, Filter (Art, Zeitraum, Person), nach Monat gruppiert, einklappbar, „+ …“ je Unter-Reiter.
- **H2 Umsatz:** `components/os/crm/kontakt/UmsatzReiter.tsx` — Kachel Umsatz mit dem Kunden, Zahlungsmöglichkeiten, Verträge (Upload), Angebote, Rechnungen, Zahlungseingang — je eigene Kachel; verschlüsselte Dateiablage je Haushalt.
