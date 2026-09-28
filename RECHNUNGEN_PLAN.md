# Rechnungsstellung in MAKE OS — Plan (Kevin 28.09.2026, Entwurf)

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

## Stufen
1. Rechnungssteller + Nummernkreis + Entwurf/Stellen/Storno + PDF (GoBD-Kern).
2. ZUGFeRD/XRechnung + Schema-Prüfung.
3. Monatsrechnungen aus Mandaten, Export für den Steuerberater, E-Rechnungs-Empfang im Beleg-Leser (XML).

## Was Kevin beisteuert
- Je Gesellschaft: genaue Firmierung, Anschrift, Steuernummer/USt-IdNr., Bankverbindung, Kleinunternehmer-Status, gewünschtes Nummernformat, Logo (trägt ihr in MAKE OS ein — nicht in den Chat).
- Welche Gesellschaft stellt ab wann welche Rechnungen (heute stellt laut Brain die Selbstständigkeit die laufenden Rechnungen).
- Kurze Abstimmung mit dem Steuerberater zu Nummernkreis und Format.
