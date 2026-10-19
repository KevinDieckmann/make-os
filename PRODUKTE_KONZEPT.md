# Produkte & Mandate — „Ein Produkt, eine Karte“ (Konzept 19.10.2026)

Kevin 19.10.: „Überarbeite das ganze Thema Produkte & Mandate und schau, dass wir da weiterkommen — dann können wir die Produkte reinnehmen
und anpassen.“ Entscheidungen (Klickrunde 19.10.):

1. **Eine Karte je Produkt.** Preis, Laufzeit, Text, Ablauf und Stufe stehen genau EINMAL am Produkt (CRM-Liste `leistungen`, Typ `Leistung`).
   Die Leistungstreppe zeigt nur noch die Produkte nach Stufen. Was heute in der Treppe steht, geht nicht verloren.
2. **Preis-Formen kombinierbar** (Kevin: „Mehrfachauswahl möglich machen“): eine Karte trägt mehrere Preis-Teile (z. B. einmalig + je Event,
   monatlich + Bonus, Tagessatz + Reisekosten).
3. **Mandat = Hauptprodukt + Zusatzmodule** (z. B. Interim CSO + Eventvertrieb). Rechnung, Liquidität und Fall kennen beide.
4. **Echte Produkte bringt Kevin in 3–4 Stunden** (baut sie gerade selbst auf). Dann importiert Claude sie selbstständig — dafür braucht es
   einen Produkt-Import (Vorschau → anlegen), Inhalte nur als Instanz-Daten, nie im Code.

Prüfstein (Kevins Positionierung V1.1, nur als Form — die Werte kommen per Import, nie in Code/Tests): kostenloser Check · kostenloses Gespräch ·
Tagesworkshop Festpreis, beim Mandat voll angerechnet · Head of Sales monatlich, 6 Monate Mindestlaufzeit, danach monatlich kündbar, Bonus bei
Zielen, höchstens 2 gleichzeitig · Interim CSO wie HoS + Recruiting-Prozess, 1 Event je Quartal inklusive · Eventvertrieb einmalig + je Event,
Zahlung 50/50 · Umsetzungsprojekt Festpreis + Erfolgsbeteiligung ab 2. Vertrag · KI-Assistent jährlich mit Kontingent + Mehrverbrauch ·
Einzelleistungen Tagessatz bzw. Stundensatz (gedeckelt je Monat), Reisekosten separat.

## Grundsätze (gelten für jedes Paket)

- **Nur additiv, Live-Daten bleiben** (CLAUDE.md, Update-Probe): neue Felder optional; alte Felder (`preis`, `laufzeitMonate`, `aufwand`, `stufe`,
  `typ`, `phasen`, Treppen-Stufen im Bestand `produkt-treppe--<haushalt>`) bleiben gespeichert und lesbar. Nichts wird umgeschrieben oder gelöscht.
  Zusammengeführt wird **beim Lesen** (EINE Stelle), geschrieben wird nur noch an die Karte. Rückweg: der alte Stand liest seine Felder weiter.
- **EINE Stelle je Regel:** rein in `lib/crm/produkt-karte.ts` (Server + Browser). Jede Stelle, die ein Produkt liest (Angebot, Mandat,
  Rechnung, Liquidität, Finanzplan, Kapazität, Treppe, Fulfillment, ZOE/Heads), liest über diese Funktionen — nie `l.preis` direkt.
- **Geld in Cent** in neuen Feldern (`betragCent`), Rechnung über `lib/finanzen/ust.ts`.
- **Plattform-Regel:** keine echten Produkte, Preise, Namen im Code, in Tests oder in der Demo-Saat (erfundene Beispiele).
- **Trennung:** Produkte & Mandate sind Business; ein Konto „nur Business“ sieht alles hier (wie heute), nie Privates.

## Datenmodell (additiv an `Leistung`)

```ts
type PreisTeilArt = 'kostenlos' | 'fest' | 'monatlich' | 'jaehrlich' | 'je_einheit' | 'tagessatz' | 'stundensatz' | 'erfolg';
// (im Code `PreisTeilArt`, nicht `PreisArt`: lib/crm/treppe-daten.ts exportiert `PreisArt` schon für die gespeicherte Treppen-Stufe)
interface PreisTeil {
  id: string;                 // pt-…
  art: PreisTeilArt;
  betragCent?: number;        // netto; fehlt bei kostenlos/erfolg; „ab“-Preise: bisCent
  bisCent?: number;
  einheit?: string;           // nur je_einheit: „je Event“, „je Seat“ …
  rolle: 'grund' | 'option';  // grund = immer dabei, option = nur wenn gewählt (z. B. Mehrverbrauch, je Event)
  zahlplan?: { anzahlungProzent: number };   // 50/50 = 50
  kontingent?: string;        // jaehrlich: was enthalten ist
  deckel?: { stundenJeMonat?: number };      // stundensatz: höchstens N Std./Monat
  text?: string;              // kurze Erklärung („Bonus bei erreichten Zielen“, „Erfolgsbeteiligung ab 2. Vertrag“)
}
interface ProduktVertrag {
  mindestlaufzeitMonate?: number;
  danach?: 'monatlich_kuendbar' | 'verlaengert_um_laufzeit' | 'endet';
  kuendigungsfristTage?: number;
  rechnungsrhythmus?: 'monatlich' | 'quartal' | 'einmalig';
  zahlungszielTage?: number;
  ustSatz?: number;
  reisekosten?: 'separat' | 'inklusive';
}
interface ProduktRegeln {
  anrechnung?: { auf: string[] /* leistungIds, auf die dieses Produkt angerechnet wird */; anteilProzent: number };
  maxGleichzeitig?: number;
  inklusive?: { leistungId: string; menge: number; je: 'monat' | 'quartal' | 'jahr' }[];  // CSO: 1 Eventvertrieb je Quartal
}
Leistung += {
  preise?: PreisTeil[];       // führt; fehlt → aus altem `preis` abgeleitet (preisteileVon)
  vertrag?: ProduktVertrag;
  regeln?: ProduktRegeln;
  rolle?: 'haupt' | 'zusatz' | 'beides';     // Zusatzmodul darf an ein Mandat gehängt werden
  ebene?: number;             // Stufe der Treppe (gleiche Ebene = Alternativen); fehlt → aus der gespeicherten Stufe (Lesen)
  aufgabe?: string; kennzahl?: string; dauerTage?: number;   // aus der Treppen-Stufe übernommen
  aufwandStundenWoche?: number;  // EIN Aufwand → Kapazität
  ziel?: { umsatz?: number; kunden?: number };
}
```
- Alte Felder werden beim Schreiben **gespiegelt**, damit der alte Stand und alte Leser weiterarbeiten: `preis` = Hauptpreis-Teil
  (`hauptpreis`), `laufzeitMonate` = Mindestlaufzeit, `aufwand.stunden` = Aufwand. Spiegeln nur im Säuberer des Servers.
- `Leistung.stufe` (Einstieg/Kern/Premium) und `typ` werden nicht mehr gezeigt; gelesen bleiben sie (Sortierung alt). Die Stufe der Treppe
  ist `ebene`.

## Treppe = Ansicht der Karten

- `stufenAusKatalog(leistungen, gespeicherteStufen)` (rein) baut die Stufen, mit denen `lib/crm/treppe.ts` heute rechnet: eine Stufe je Produkt
  mit `ebene`. Felder: Karte gewinnt; eine gespeicherte Stufe, die mit genau diesem Produkt verknüpft ist, füllt NUR leere Felder; ihre
  Kennung bleibt die Kennung der Stufe (damit Kundenfortschritt `stufeId` und `verlauf` weiter stimmen).
- Gespeicherte Stufen ohne Produkt erscheinen als „Stufe ohne Produkt“ mit einem Knopf „Als Produkt anlegen“ (ein Klick legt die Karte aus der
  Stufe an und verknüpft). Nie automatisch.
- Die Treppe bearbeitet keine eigenen Kopien mehr: „+ Stufe“ = neues Produkt mit Ebene; Antippen öffnet die Karte.

## Mandat übernimmt den Vertrag

- `mandatVorlageAusProdukt(leistung, zusatz[])` (rein): Art (aus Preis-Form), Honorar (monatlich/fest/Tagessatz), Mindestlaufzeit, Kündigung,
  Verlängerung, Rhythmus, Zahlungsziel, USt, Gesellschaft, Leistungen (Leistungstext + Lieferumfang). Genutzt von: „+ Mandat“, Mandat aus
  Deal/angenommenem Angebot (`mandatVorbelegung`), Excel-Einfügen (als Vorbelegung), „Mandat aus Produkt anlegen“ (neu, an der Karte).
- **Zusatzmodule:** `Mandat.zusatz?: { id, leistungId, ab?, bis?, honorar?: { betragCent, basis }, inklusive?: boolean, menge?, je? }[]` (optional, additiv;
  `basis` = monat · jahr · einmalig · einheit · tag · stunde, `menge`/`je` nur bei inklusive, z. B. 1 je Quartal). Typ `MandatZusatz`, gesäubert seit P1.
  Rechnung: Positionen Haupt + Zusatz (je Event/Einheit nur auf Klick „abrechnen“ mit Menge; inklusive = 0 € Position mit Hinweis).
  Liquidität: Posten je wiederkehrendem Zusatz (EINE Regel `lib/crm/mandat-laufzeit.ts`). Fall: Zusatzmodul mit Ablauf → bestehende
  Zusatzmodul-Zeile im Fall.
- Am Mandat pflegbar (heute nur gespeichert): Mindestlaufzeit, Rhythmus, Zahlungsziel, Leistungen, Zusatzmodule.
- **Deal folgt dem Angebot:** angenommenes Angebot mit anderem Produkt → `leistungId` des Deals nachziehen (Rückfrage nur, wenn mehrere).
- **Anrechnung:** Rechnung des Hauptprodukts zeigt die Anrechnung eines vorher gekauften Produkts dieses Kunden (z. B. Workshop) als
  Minus-Position — einmal, über `regeln.anrechnung`.

## Oberfläche

- Produkte-Reiter: oben der **Katalog** (Karten nach Stufe der Treppe, als Treppe gezeichnet — EINE Ansicht statt Treppe + Liste), darunter
  eingeklappt Kundenreise · Zielbild · Roadmap · Positionierung. „+ Produkt“ = **geführtes Anlegen** (Name · einmalig/laufend · Preis ·
  Gesellschaft · Leistungstext in einem Schritt), danach die Karte.
- **Die Karte** (Abschnitte, aufklappbar): Überblick (Name, Stufe/Ebene, Rolle, Status, Gesellschaft) · Preis (Preis-Teile, „+ Preis-Teil“) ·
  Vertrag · Regeln (Anrechnung, max. gleichzeitig, inklusive) · Texte (EIN Satz Kurzbeschreibung, Leistungstext, Ergebnis, Grenzen/Hinweise —
  keine Doppelungen mehr; Angebotstexte = die Texte) · Lieferumfang · Ablauf (Auswahl + „neuer Ablauf aus der Vorlage“) · Aufwand & Kapazität ·
  Ziel · Mandate/Deals dieses Produkts · „Mandat aus diesem Produkt anlegen“.
- Mandate-Reiter: Detail mit „Vertrag“ (aus dem Produkt, änderbar) und „Zusatzmodule“.
- Design-Standard (`components/os/ui`), Antwort zuerst, Handy 390 ohne Querscrollen.

## Import (für Kevins echte Produkte)

- `POST /api/crm/produkte/import { produkte: ProduktImport[], vorschau: true|false }` — Vorschau zeigt je Produkt „neu / ändert / gleich“ mit
  Feldern, schreibt nichts; ohne Vorschau legt an bzw. ändert (Abgleich über Name ohne Groß/Klein, sonst neu), Treppe über `ebene`. Klasse
  `haushalt` + `bauPruefen`, nie Dienstweg ohne Person. Format = Karte (JSON), dazu „aus Tabelle“ (CSV-Spalten) in der Oberfläche.
- Bestehende Karten werden nur in den gelieferten Feldern geändert (Teil-Merge), Archiv/Papierkorb unberührt.

## Reste aus dem Rundgang 19.10. (mit beheben)

A4 neuer Fall zeigt Phase 6/7 „erledigt“ · A5 `GET /api/finanzplan/vorschlaege` 403 für „nur Business“ (Business-Katalog darf es sehen) ·
A6 Lieferumfang verdoppelt sich (Enter + Verlassen) · A7 Demo: Gesellschaft ohne IBAN, Firma ohne Anschrift · B12 Anschrift aus dem
Rechnungs-Dialog zurück an die Firma (Kevin 18.10.: „an der Firma speichern“) · B9 Angebot übernimmt still den offenen Deal mit anderem Produkt
(→ Rückfrage) · B11 Handy: geöffnetes Produkt 50 px zu breit · B13 Hafenkontor „Angebot angenommen?“ obwohl Mandat aktiv · B14/B15 Wege
Ablauf ↔ Produkt und Finanzplanung mit vorgewähltem Produkt.

## P1 Kern — gebaut (19.10., Branch `produkte`)

EINE Stelle `lib/crm/produkt-karte.ts` (rein, Server + Browser). Grundsatz **„ohne Karte gilt das Alte“**: solange ein Produkt keines der Felder
`preise · vertrag · regeln · rolle · ebene · aufgabe · kennzahl · dauerTage · aufwandStundenWoche · ziel` trägt (`istKarte`), rechnet jede Funktion
bit-gleich wie vorher (Paritätstests in `tests/produkt-karte.test.ts`). Entscheidungen beim Bauen:
- **Hauptpreis** = der erste Preis-Teil mit Rolle „grund“ (die Reihenfolge der Karte zählt). Mindestens ein Grund-Teil ist Pflicht (400).
- **Spiegeln** im Säuberer des Servers (`produktSpiegeln`): `preis` aus dem Hauptpreis-Teil (Einheit „Monat netto“, „Jahr netto“, „pauschal netto“,
  „Tag netto“, „Stunde netto“, „je … netto“, „kostenlos“), `laufzeitMonate` = Mindestlaufzeit, `aufwand.stunden` = Aufwand je Preis-Einheit (Monat ×52/12,
  Jahr ×52, einmalig × Dauer in Wochen; ohne Dauer bleibt er). Ändert eine alte Oberfläche ein gespiegeltes Feld einer Karte, lehnt der Server mit Text ab
  (409, `spiegelKonflikt`) — nie still überschrieben. Prüfen vor dem Schreiben (`produktPruefen`): Unsinn 400 (`CrmAnwendung.ungueltig`), zu groß 413.
- **Treppe:** jede gespeicherte Stufe gehört dem ERSTEN vorhandenen Produkt ihrer `leistungIds`. Ist es (noch) keine Karte, bleibt die Stufe genau so;
  ist es eine Karte, gewinnt die Karte (Name, Preis, Aufwand …), die Stufe füllt Leeres, ihre Kennung bleibt. Weitere Karten mit Ebene (eigene oder aus
  einer verknüpften Stufe — dann nur die Ebene) bekommen eine eigene Stufe `ts-k-<Produkt>` (`katalogStufeId`) und fallen aus den `leistungIds` der alten
  Stufe heraus; neue Stufen nur für Business-Produkte, die nicht eingestellt sind. Stufen ohne vorhandenes Produkt rechnen weiter mit und stehen zusätzlich
  in `ohneProdukt`. Kunde/Station/Paket dürfen auf eine Katalog-Stufe zeigen (`AnwendenKontext.katalogStufen`). Der Aufwand einer Karten-Stufe steht als
  `TreppenStufe.wochenAufwand` (nur gelesen, nie gespeichert) und gewinnt in `stufeStundenWoche`. `GET /api/crm/treppe` liefert zusätzlich
  `katalog { stufen, ohneProdukt, herkunft }`; `datei` bleibt die gespeicherte Treppe (bearbeitbar bis P2).
- **Mandat:** `mandatVorlageAusProdukt` (Art aus Typ, sonst Preis-Form; Honorar: monatlich, jährlich ÷ 12, fest/je Einheit/Erfolg/kostenlos einmalig,
  Tagessatz Basis „tag“, Stundensatz mit Deckel = Obergrenze je Monat + Hinweis; Vertragsfelder über `mandatVertragAusProdukt`; Leistungen = Leistungstext
  (wenn ≤ 400 Zeichen) + Lieferumfang; `hinweise` → offene Punkte). „+ Mandat“: die gewählte Gesellschaft gilt, „offen“ → die des Produkts. Mandat aus
  angenommenem Angebot: das Angebot gilt, der Vertrag des Produkts füllt nur Lücken (Kündigung, Verlängerung, Quartal, Mindestlaufzeit ohne Laufzeit).
  Mandat aus Deal ohne Angebot: Vertragsfelder des Produkts dazu.
- **Angebot:** `angebotPositionenAusProdukt` — je Grund-Teil eine Position, Optionen nur gewählt, Erfolg als Satz im Text, kostenlos nur allein;
  `positionAusProdukt` (Produktwahl im Tool) = die erste davon.
- ZOE (`stammdaten_lage`, Produkte & Leistungen) nennt den Preis über `preiseText` (alle Preis-Teile).
- **Noch direkt am alten `preis` (nicht in P1):** Oberfläche `components/os/mandate/Produkte.tsx`, `components/os/crm/angebot/Positionen.tsx` (P2),
  Demo-Saat (P4). Wer neu liest: über `preiseText`/`hauptpreis`/`planBausteinAusProdukt`.

## P2 Karte + Katalog-Oberfläche — gebaut (19.10., Branch `produkte-ui`)

Regeln der Oberfläche rein in `lib/crm/produkt-katalog.ts` (liest nur von `produkt-karte.ts`, rechnet nie daneben); Oberfläche
`components/os/mandate/` (`Produkte.tsx`, `KatalogTreppe.tsx`, `karte/*`). Wächter `tests/produkte-oberflaeche.test.ts`.
- **Katalog = EINE Ansicht:** `katalogAnsicht` aus `katalogTreppe` (Browser, live aus dem CRM-Bestand + den gespeicherten Stufen; Kunden/Plätze aus
  `lage.kapa.jeStufe`). Stufen links → rechts, Alternativen übereinander, am Handy untereinander; Archiv/Papierkorb nie auf der Treppe; die Linie ist
  ein Filter (die Liste nach Linien ist weg). Gespeicherte Stufen ohne Produkt stehen gestrichelt an ihrer Stelle: „Als Produkt anlegen“ (`karteAusStufe`
  → `api.setze`, dann Treppen-Op `stufe` `leistungIds: [neu]` mit Stand — Kennung der Stufe bleibt) oder „entfernen“ (Rückfrage). Produkte ohne Stufe
  stehen als Zeilen „Ohne Stufe“ (mit Satz, warum: verknüpft mit fremder Stufe / Gesellschaft Privat). Lage oben (Antwort zuerst, ≤ 5 Kacheln).
- **Faden:** `treppenFaden` über die Balken der Stufen (gemessen), jede Stufe in ihrer Farbe, hell bis zur höchsten Stufe mit Kunden, dahinter gedämpft
  und ausgefranst, über der Platzgrenze rot. Ohne zwei Stufen kein Faden.
- **Geführtes Anlegen** (`neuesProdukt`): Name · Art (einmalig · laufend monatlich · jährlich · kostenlos · nach Aufwand je Stunde/Tag) · Preis ·
  Gesellschaft · Stufe · ein Satz Leistungstext → Entwurf mit EINEM Preis-Teil, öffnet die Karte. Kein Sofort-Entwurf mit Vorgaben mehr.
- **Die Karte** (Fenster, `?s=produkte&k=<id>` = `WEG.produkt`): Kopf mit Chips Stufe · Rolle · Status · Gesellschaft, Preis-Zeile, Lage, „Was noch
  fehlt“ (`kartenLuecken`, Weg in den Abschnitt). Abschnitte: Preis (`PREIS_TEIL_FELDER` je Form, Reihenfolge ↑↓, Hauptpreis markiert, Formwechsel räumt
  auf — `teilFuerArt`) · Vertrag · Regeln · Texte · Lieferumfang · Ablauf · Aufwand & Kapazität · Ziel & Planung · Mandate & Deals · Name, Linie &
  Unterlagen. Speichern NUR `api.teil` mit Stand; vorher `produktPruefen` wie der Server; was der Server ablehnt, steht im Abschnitt.
- **Texte an EINER Stelle:** Kurzbeschreibung (`beschreibung`), Leistungstext (`angebot.leistungstext`), Ergebnis, Grenzen & Hinweise. Ergebnis und
  Grenzen werden an BEIDE alten Stellen geschrieben (`ergebnis`+`angebot.ergebnis`, `grenzen`+`angebot.hinweise`, ≤ 600 Zeichen) — alle Leser sehen
  denselben Text; standen bisher zwei verschiedene, zeigt das Feld beide (`zusammen`), nichts geht verloren. Titel/Einleitung im Angebot nur, wenn da.
- **Lieferumfang:** Enter oder „Hinzufügen“ hängt EINMAL an (Verlassen nicht mehr — A6), ≤ 160 Zeichen, ≤ 20 Punkte (Grenzen der Treppe), keine Doppelten.
- **Ablauf:** Zuordnung über `vorlagenOps` `zuordnung` (wie bisher), „Ablauf öffnen ›“, „+ neuer Ablauf“ (leere Vorlage mit dem Produktnamen, zugeordnet,
  Editor öffnet). Alte Phasen bleiben lesbar und pflegbar (aufgeklappt).
- **Mandat aus Produkt:** Knopf in der Karte → `WEG.mandatAusProdukt(id)` = `/os/mandate?neu=mandat&produkt=<id>`, gelesen über `mandatNeuAusAdresse`
  (lib/crm/adresse.ts) in `ProdukteMandate.tsx` → „+ Mandat“ (`MandatAnlegen`, Produkt vorbelegt, Gesellschaft des Produkts). P3 kann den Dialog dort umstellen.
- **Angebots-Tool:** Produktwahl = `angebotPositionenAusProdukt` (alle Grund-Teile, angehakte Optionen); `Editor.dazu` nimmt mehrere Positionen.
- **Reste:** B15 `WEG.finanzplanungProdukt` (Baukasten zeigt das Produkt vorgewählt mit „Als Umsatzbaustein hinzufügen“) · B14 Fulfillment „liefert X ›“
  führt zur Karte, „noch keinem Produkt zugeordnet“ mit „Produkt wählen ›“ · B11 Karte im Fenster (`minmax(0,1fr)`, Felder umbrechend).
- Kundenreise/Roadmap/Fortschritt wählen Stufen aus `lage.katalog.stufen`; Zielbild ändert das Ziel einer Karten-Stufe in der Karte (Link), nicht an einer Kopie.

## Pakete

- **P1 Kern** (`lib/crm/produkt-karte.ts`, Typen, Säuberer + Spiegeln in `lib/crm/speicher.ts` `zusatz('leistungen')`, `stufenAusKatalog`,
  `mandatVorlageAusProdukt`, Leser umstellen: Angebot, Finanzplan-Bausteine, Kapazität, Treppe; Tests mit Altbestand = bit-gleich).
- **P2 Karte + Katalog-Oberfläche** (geführtes Anlegen, Karte, Treppe als Ansicht, „Stufe ohne Produkt“, Handy).
- **P3 Mandat** (Vorlage aus Produkt überall, Felder pflegbar, Zusatzmodule inkl. Rechnung/Liquidität/Fall, Anrechnung, Deal folgt Angebot,
  Anschrift an Firma).
- **P4 Import + Demo + Reste** (Import-Route + Oberfläche, Demo-Saat mit erfundenen Karten in allen Preis-Formen + IBAN/Anschrift, A4/A5/A6/B9/B13).
- Danach: volle Suite, Update-Probe, Demo-Rundgang mit Bildern → Kevin → Upload → Kevins Produkte importieren.
