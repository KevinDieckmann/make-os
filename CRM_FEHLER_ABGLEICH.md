# Abgleich: MAKE OS gegen die CRM-Fehler-Prüfliste (28.09.2026)

Grundlage: `CRM_FEHLER_PRUEFLISTE.md` (116 Punkte aus Web-Recherche). Zwei Prüfer haben den Code lesend dagegen geprüft (Punkte 1–74 und 75–116). Stand: Branch `entwicklung` nach den Reparaturen F1–F3 und der Verbindungsprüfung V1.

## Ergebnis

| | Punkte |
|---|---|
| erfüllt | 49 |
| teilweise | 48 |
| Lücke | 11 |
| nicht relevant (bisher kein Versand) | 8 |

**Achtung:** Kevin hat am 28.09. entschieden, dass MAKE OS künftig selbst verschickt (jede Mail nach Einzelfreigabe). Damit werden die bisher „nicht relevanten“ Versand-Punkte (#56, #61, #90, #91) und die Einwilligungs-Punkte (#54, #55, #57, #60) Pflicht — sie gehören in den Versand-Plan (`VERSAND_PLAN.md`).

## Schwerste Befunde
1. **#66/#67 Kartei ohne Haushaltsprüfung** — `/api/state/kontakte` (und `state/{kunden,prospects,netzwerk,stammdaten,aenderungen}`) prüfen nur „angemeldet“, nicht den Haushalt. Ein neues Konto ohne Haushalt kann die ganze Kartei lesen und ändern. **Auch online.**
2. **Stilles Abschneiden** entgegen der Regel „nie abschneiden“: Aktivitäten je Kontakt auf 600, Deal-Historie auf 60, Einwilligungen auf 30, Änderungsprotokolle auf 200.
3. **#12/#13/#14 Normalisierung** — E-Mail-Schlüssel entfernt `-`, `_`, `+` (zwei Menschen verschmelzen beim Import), NFD-Umlaute (macOS) werden nicht wiedererkannt, „G.m.b.H.“ nicht erkannt, zwei verschiedene Telefon-Normalisierungen.
4. **#60 Sperrliste umgehbar** — Werbesperre hängt nur am Kontakt; nach Löschung legt ein erneuter Import die Person ungesperrt neu an.
5. **#50/#81 Rechnungen und Belege hart löschbar** — auch gestellte/bezahlte Rechnungen per ✕ ohne Rückfrage; Buchung bleibt verwaist.
6. **Echte Namen und Beträge im Code** — `lib/finanzen/finanzplan-bestand.ts` enthält im SEED echte Drittnamen und Beträge (Verstoß gegen Regel „keine echten Daten im Repo“).
7. **#109/#110 Sicherung** — kein getesteter Probe-Restore; Tagesarchive vor dem 26.09. sind mit dem alten Datenschlüssel verschlüsselt, das Rotationsskript bewahrt ihn nicht auf; zweiter Ablageort offen.

## Reparaturrunde (klein/mittel, lokal) — Pakete K1–K4
- **K1 Zugriff & Betrieb:** Haushaltsprüfung in allen `state/*`-Personenrouten (#66/#67), SEED ohne echte Daten, Änderungsprotokoll serverseitig und nur anhängend (#44), `fremdGelesen` bei Browser-Kontext (#98), fsync (#37), HOI-Befund „Bestand beschädigt“ (#39), Probe-Restore-Skript + Schlüsselrotation bewahrt alten Schlüssel (#109/#110), Regel 5 (Rückfall „kevin“) in Dubletten/Löschprotokoll, Änderungslisten nicht kürzen.
- **K2 Identität & Import:** Normalisierung (#11–#14, eine gemeinsame `suchNorm` für Suche/Kartei #105), Sammeladressen nicht als Schlüssel, Import-Vorschau warnt bei `E+`/Spaltenzahl, deutsches Datum umrechnen (#21–#23), Import-Lauf mit Rückgängig (#25), Herkunft/Art.-14-Uhr beim Import (#27/#62), gehashte Sperrliste über Löschen und Import (#60), Sperre aufheben nur mit Nachweis (#64), CSV-Injection (#28), Server stempelt `geaendertAm`/`importiertAm`/`vonHand` (#68), Aktivitäten und Einwilligungen nicht kürzen, NFD-Tests (#115).
- **K3 Finanzen & Zeit:** Rechnungen ab „gestellt“ nicht löschbar, Dateiablage mit Rechnungsbezug nicht löschbar (#50/#81), Beträge centgenau + eine USt-Funktion (#79/#80), `stand`/409 für Finanzplan-Listen (#107), „heute“ überall Berliner Tag + Art.-15-Frist mit Monatsend-Kappung (#75/#77).
- **K4 Pipeline & CRM-Bestand:** Deal-Historie nicht kürzen (#83), `stand`/409 für CRM-`teil` (#35/#42), Firmen/Mandate mit Verweisen nicht löschen (#49), Verschiebungen von `erwartetAm` zählen, gemessene Quoten neben Wahrscheinlichkeiten, „gewichtet ohne hängende“ (#84–#86), Score: Antwort/Angesprochen verfallen, SQL-Quote je Temperatur (#93/#95), Doppelklick-Sperre im `Knopf` (#19).

## Mit Kevin zu entscheiden (großer Umbau)
- **#2/#3 Kontakt↔Firma mehrfach mit Rolle + Beschäftigungshistorie** (Firmenwechsel ohne Verlust der Historie).
- **#11 mehrere E-Mail-Adressen je Person** (`emails[]`).
- **#82 E-Rechnung / #81 GoBD-Rechnungsstellung:** bleibt die Rechnungsstellung extern (Buchhaltungsprogramm) oder baut MAKE OS ein eigenes Modul (Pflicht spätestens 2028)?
- **#79 echte Cent-Ganzzahlen im Rechenkern v3** (Kevins geprüfter Kern).
- **#104 Paginierung der Kartei** (erst bei deutlich mehr Kontakten nötig).
- **#110 zweiter Ablageort für Sicherungen** (Anbieter, Kosten, Standort).
- **#101 AVV/DPA mit dem KI-Anbieter ablegen** (organisatorisch).
- **Versand** (neu): siehe `VERSAND_PLAN.md`.

Die vollständigen Tabellen je Punkt (Status, Beleg Datei:Zeile, Aufwand, Vorschlag) liegen in den Prüfberichten vom 28.09. (Sitzungsprotokoll).

## Entscheidungen Kevin (28.09. abends)
- **Gehört zu „CRM grundsätzlich fertig“ (wird gebaut, nach K1–K4):**
  - Person in **mehreren Firmen mit Rolle** + **Beschäftigungshistorie** beim Jobwechsel (#2/#3).
  - **Mehrere E-Mail-Adressen** je Person (#11).
  - **Mutter- und Tochterfirmen** (#7).
  - **Datenschutz vollständig:** Einwilligung mit vollem Nachweis, Einschränkung nach Art. 18 als echte Sperre, Löschfristen je Datenart, „zuletzt geprüft“ je Kontakt (#34/#51/#52/#55).
- **Rechnungen: MAKE OS stellt selbst Rechnungen** (Nummernkreis, Storno statt Bearbeiten, PDF + XRechnung/ZUGFeRD, GoBD) — eigener Baustein mit Plan (#81/#82).
- **Zweiter Sicherungsort:** später.
- **Versand:** zurückgestellt (siehe `VERSAND_PLAN.md`), erst CRM fertig.
