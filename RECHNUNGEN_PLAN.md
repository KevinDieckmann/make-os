# Angebote und Rechnungen in MAKE OS — Plan (Kevin 28.09.2026, Entwurf)

> **Nachtrag Kevin 28.09.:** „Wenn du das mit der Rechnungsstellung machst, nimm bitte auch Angebotsstellung mit rein.“ → Angebote sind Teil dieses Bausteins (Abschnitt „Angebote“).

**Kevins Entscheidung:** MAKE OS stellt selbst Rechnungen (statt extern im Buchhaltungsprogramm). Pflicht zur E-Rechnung im B2B spätestens 2028 (bei mehr als 800 T€ Vorjahresumsatz 2027); Empfang schon seit 2025. Rechtliche Punkte sind Recherche-Stand, keine Steuerberatung — vor dem ersten echten Einsatz einmal mit dem Steuerberater abstimmen.

## Ziel
Aus Angebot oder Mandat wird mit wenigen Klicks eine korrekte Rechnung je Gesellschaft (Selbstständigkeit · KD Ventures · MAKE OS UG): fortlaufende Nummer, Pflichtangaben nach § 14 UStG, PDF und strukturierte E-Rechnung (ZUGFeRD bzw. XRechnung, EN 16931), unveränderbar nach dem Stellen, Korrektur nur per Storno und neuer Rechnung (GoBD). Der Zahlungseingang schließt den Vorgang; Umsatz-Reiter, Finanzplan und Liquidität lesen dieselbe Quelle.

## Bausteine
1. **Rechnungssteller je Gesellschaft** (Stammdaten, nur im Datenspeicher, nie im Code): Name, Anschrift, Steuernummer und/oder USt-IdNr., Bankverbindung, Kleinunternehmer ja/nein, Logo, Standard-Zahlungsziel, Fußtext.
2. **Nummernkreis je Gesellschaft** (z. B. `KDV-2026-0001`), vergeben serverseitig in einer Sperre beim Stellen — lückenlos, nie doppelt, nie wiederverwendet.
3. **Rechnung** mit Positionen (Leistung aus dem Produktkatalog oder frei, Menge, Einzelpreis in Cent, USt-Satz je Position), Leistungszeitraum, Empfänger (Firma + Rechnungsempfänger aus den Zahlungsdaten), Bezug (Mandat, Deal, Angebot). Summen und USt kaufmännisch je Rechnung gerundet (eine Funktion).
4. **Zustände:** Entwurf (frei änderbar) → **gestellt** (festgeschrieben: Inhalt, Nummer, PDF, E-Rechnung und Prüfsumme; keine Änderung mehr) → bezahlt / teilbezahlt / **storniert** (Stornorechnung mit eigener Nummer und Bezug auf das Original).
5. **Ausgabe:** PDF (Layout je Gesellschaft) und ZUGFeRD (PDF/A-3 mit eingebettetem XML) bzw. XRechnung-XML für öffentliche Auftraggeber. Prüfung der XML gegen das EN-16931-Schema im Test.
6. **Aufbewahrung:** gestellte Rechnungen und Stornos sind nicht löschbar (§ 147 AO, § 257 HGB), liegen verschlüsselt in der Dateiablage mit Prüfsumme; Änderungsprotokoll nur anhängend.
7. **Anbindung:** Umsatz-Reiter (Kontakt/Firma), Mandat (monatliche Rechnung aus Honorar), Finanzplan (Rechnung = Vorgang mit Fälligkeit), „als bezahlt“ mit Buchung in einem Schritt (besteht schon), Export für den Steuerberater (CSV/DATEV-Format prüfen).
8. **Versand:** bis der Versand-Baustein kommt, als PDF herunterladen bzw. als Entwurf in Apple Mail.

## Angebote (Nachtrag Kevin)
1. **Angebot je Gesellschaft** mit eigenem Nummernkreis (z. B. `KDV-A-2026-0001`), aus dem Deal heraus („Angebot erstellen“) oder frei; Positionen aus dem Produktkatalog (Preis, Basis, Laufzeit) oder frei, Menge, Rabatt, USt je Position, Gültig bis, Zahlungsbedingungen, Leistungsbeschreibung/Lieferumfang aus dem Produkt, optional Phasen und Termine.
2. **Zustände:** Entwurf → **gestellt** (festgeschrieben mit PDF und Prüfsumme) → angenommen / abgelehnt (mit Grund) / abgelaufen (automatisch nach „gültig bis“) / ersetzt durch **Version 2** (neue Fassung mit Bezug, alte bleibt lesbar).
3. **Pipeline-Anbindung:** Ein gestelltes Angebot hebt den Deal auf Stufe „Angebot“ (mit Wert aus dem Angebot); „angenommen“ → Deal gewonnen → Mandat anlegen (bestehender Weg) mit Honorar und Laufzeit aus dem Angebot; „abgelehnt“ → Verlustgrund. Follow-up „Angebot nachfassen“ automatisch zum passenden Datum. BEAN: offenes Angebot = Angebotskunde.
4. **Vom Angebot zur Rechnung:** „Rechnung aus Angebot“ übernimmt Positionen (Teil- oder Abschlagsrechnungen möglich), Bezug bleibt sichtbar; bei Mandaten Monatsrechnungen aus dem angenommenen Angebot.
5. **Ausgabe:** PDF im Layout der Gesellschaft (gleiches Gerüst wie Rechnung), optional Annahme-Vermerk; Umsatz-Reiter zeigt Angebote aus diesem Baustein statt der bisherigen Ablage-Einträge (Altbestand bleibt lesbar).

## Stufen
1. Rechnungssteller + Nummernkreise + **Angebote** und Rechnungen: Entwurf/Stellen/Storno + PDF (GoBD-Kern), Angebot → Deal-Stufe → Mandat → Rechnung.
2. ZUGFeRD/XRechnung + Schema-Prüfung.
3. Monatsrechnungen aus Mandaten, Export für den Steuerberater, E-Rechnungs-Empfang im Beleg-Leser (XML).

## Was Kevin beisteuert
- Je Gesellschaft: genaue Firmierung, Anschrift, Steuernummer/USt-IdNr., Bankverbindung, Kleinunternehmer-Status, gewünschtes Nummernformat für Angebote und Rechnungen, Standard-Gültigkeit von Angeboten, Logo (trägt ihr in MAKE OS ein — nicht in den Chat).
- Welche Gesellschaft stellt ab wann welche Rechnungen (heute stellt laut Brain die Selbstständigkeit die laufenden Rechnungen).
- Kurze Abstimmung mit dem Steuerberater zu Nummernkreis und Format.
