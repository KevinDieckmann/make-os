# Produkte importieren: Vorlage

Mit dieser Vorlage bringst du deine Produkte in MAKE OS. Du kannst sie liefern, wie es für dich am einfachsten ist:

- als Text oder Dokument
- als Tabelle (Excel oder CSV)
- als JSON

Claude macht daraus eine Liste von Produkt-Karten. Danach geht es in zwei Schritten weiter:

1. Die **Vorschau** zeigt dir je Produkt, ob es neu ist, sich ändert, gleich bleibt oder einen Fehler hat. Dabei wird nichts gespeichert.
2. Mit **Übernehmen** wird gespeichert.

Den Import findest du unter Produkte & Mandate › Produkte › „Produkte importieren“. Technisch läuft er über `POST /api/crm/produkte/import`.

**Pflicht ist nur der Name.** Was du leer lässt, bleibt so, wie es ist. Über den Namen wird abgeglichen; Groß- und Kleinschreibung und Leerzeichen zählen dabei nicht. Gibt es den Namen schon, ändern sich nur die Felder, die du mitlieferst. Gibt es ihn noch nicht, wird das Produkt neu angelegt.

Die Beispiele unten sind erfunden.

## Beispiel mit zwei Produkten

```json
[
  {
    "name": "Beispiel-Workshop",
    "status": "aktiv",
    "gesellschaft": "ug",
    "beschreibung": "Ein Tag, an dem das Team seine Zahlen versteht.",
    "leistungstext": "Ein Workshop-Tag vor Ort: Ausgangslage, Kennzahlen-Bild, nächste Schritte.",
    "lieferumfang": ["Vorbereitungsgespräch", "Workshop-Tag", "Ergebnisprotokoll"],
    "preise": [{ "art": "fest", "betrag": 2500 }],
    "regeln": { "anrechnung": { "auf": ["Beispiel-Begleitung"], "anteilProzent": 100 } },
    "ebene": 2
  },
  {
    "name": "Beispiel-Begleitung",
    "status": "aktiv",
    "gesellschaft": "ug",
    "leistungstext": "Monatliche Begleitung: Steuerungstermin, Review, Sparring auf Abruf.",
    "preise": [
      { "art": "monatlich", "betrag": 3000 },
      { "art": "erfolg", "text": "Bonus bei erreichten Quartalszielen" }
    ],
    "vertrag": { "mindestlaufzeitMonate": 6, "danach": "monatlich_kuendbar", "kuendigungsfristTage": 30, "zahlungszielTage": 14 },
    "regeln": { "maxGleichzeitig": 3 },
    "ebene": 3,
    "ablauf": "Begleitung"
  }
]
```

Was in dem Beispiel passiert:

- Der Workshop wird voll auf die Begleitung angerechnet.
- Bei der Anrechnung steht der **Name** des anderen Produkts, keine Kennung.
- `ablauf` ist der Name eines Ablaufs aus dem Fulfillment. Gibt es diesen Ablauf nicht, kommt nur ein Hinweis, kein Fehler.

## Was du angeben kannst

| Feld | Was | Beispiel |
|---|---|---|
| `name` | Pflicht, darüber wird abgeglichen | „Beispiel-Workshop“ |
| `status` | `aktiv` oder `entwurf` | Ohne Angabe ist ein neues Produkt aktiv, wenn es einen Leistungstext hat, sonst ein Entwurf. |
| `gesellschaft` | Kennung (`ug`, `kdv` …) oder Name aus Unternehmen | „ug“ |
| `beschreibung` | ein Satz | |
| `leistungstext` | was genau geliefert wird | Pflicht für „aktiv“ |
| `lieferumfang` | eine Liste | |
| `preise` | ein oder mehrere Preis-Teile, siehe unten | |
| `vertrag` | `mindestlaufzeitMonate`, `danach`, `kuendigungsfristTage`, `rechnungsrhythmus`, `zahlungszielTage`, `ustSatz`, `reisekosten` | |
| `regeln` | `anrechnung` (auf Namen + Prozent), `maxGleichzeitig`, `inklusive` | Beispiel für `inklusive`: `[{ "produkt": "Name", "menge": 1, "je": "quartal" }]` |
| `rolle` | `haupt`, `zusatz` (Zusatzmodul) oder `beides` | |
| `ebene` | Stufe auf der Leistungstreppe (1, 2, 3 …) | |
| `aufgabe`, `kennzahl`, `dauerTage`, `aufwandStundenWoche`, `ziel` | was das Produkt leistet und wie viel Aufwand es macht | |
| `ablauf` | Name einer Fulfillment-Vorlage | |

Die erlaubten Werte für `danach`:

- `monatlich_kuendbar`
- `verlaengert_um_laufzeit`
- `endet`

Die erlaubten Werte für `rechnungsrhythmus`:

- `monatlich`
- `quartal`
- `einmalig`

Einen Wert, der schon gespeichert ist, entfernst du mit `null`.

### Preis-Teile

Ein Preis-Teil hat diese Angaben:

- **`art`** (Pflicht), einer dieser Werte:
  - `kostenlos`
  - `fest`
  - `monatlich`
  - `jaehrlich`
  - `je_einheit` (z. B. `"art": "je Event"`)
  - `tagessatz`
  - `stundensatz`
  - `erfolg`
- **`betrag`**: netto in Euro, z. B. `2500` oder „2.500,00“.
- **`optional: true`**: Der Teil gilt nur, wenn er gewählt wird.
- **`anzahlungProzent`**: Bei 50/50 steht hier 50.
- **`kontingent`**: Was im Jahrespreis enthalten ist.
- **`stundenJeMonat`**: Die Obergrenze beim Stundensatz.
- **`text`**: Für einen Bonus oder eine Erfolgsbeteiligung.

## Als Tabelle

Für eine Tabelle gelten diese Regeln:

- **Eine Zeile je Produkt.** Hat ein Produkt mehrere Preis-Teile, schreibst du mehrere Zeilen mit demselben Namen.
- **Spalten**, zum Beispiel: Name · Status · Gesellschaft · Stufe · Rolle · Leistungstext · Lieferumfang · Preis-Art · Betrag · Einheit · Optional · Anzahlung · Kontingent · Deckel · Mindestlaufzeit · Danach · Kündigungsfrist · Zahlungsziel · Reisekosten · Anrechnung auf · Max gleichzeitig · Inklusive · Ablauf.
- **Listen** trennst du mit `|`.
- **Inklusive** schreibst du so: „1 × Name je Quartal“.

```
Name;Stufe;Preis-Art;Betrag;Optional;Anzahlung;Mindestlaufzeit;Leistungstext;Status;Gesellschaft
Beispiel-Messemodul;;Festpreis;1.500;;50/50;;Begleitung des Messeauftritts.;aktiv;ug
Beispiel-Messemodul;;je Event;900;ja;50/50;;;;
Beispiel-Begleitung;3;monatlich;3.000;;;6;Monatliche Begleitung.;aktiv;ug
```

## Gut zu wissen

- **Papierkorb und Archiv:** Liegt ein Produkt mit demselben Namen im Papierkorb oder im Archiv, wird es nicht zurückgeholt. Es bekommt nur einen Hinweis.
- **Fehler:** Hat die Lieferung einen Fehler, wird nichts gespeichert. Die Vorschau sagt, was fehlt. Zu lange Texte werden nie gekürzt, sondern als Fehler gemeldet.
- **Grenzen:** Ein Import umfasst höchstens 100 Produkte und 1 MB.
- **Erneut importieren:** Denselben Import zweimal zu übernehmen ist harmlos. Beim zweiten Mal steht überall „gleich“.
