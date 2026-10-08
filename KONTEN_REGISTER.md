# Konten-Register — EIN Ort für Konten und Kontostände

Stand 08.10.2026, Branch `konten-register` (nur lokal). ROADMAP_Q4 › „Lücken für das Business Couple“ › Lücke 2.

Kevin 08.10.: „Kontostände an fünf Stellen → EIN Konten-Register (Konto → Gesellschaft/Person/gemeinsam, Stand mit Datum); Bank, 0-Punkt,
Liquidität, Finanzplanung und Haushalt lesen nur noch daraus.“ R4: „Haushalt führt das Ist, Finanzplanung liest daraus.“ R3: Zahlen kommen
vorerst von Hand; die Bank-Anbindung (finAPI) schreibt später in dasselbe Register.

## 1. Befund — wo Kontostände heute liegen (vor dem Umbau)

| # | Stelle | Datei(en) | Was gespeichert wird | Wer schreibt | Wer liest |
|---|---|---|---|---|---|
| 1 | **Liquidität / Firmen-Konten** | Bestand `finanzplan` (global, Haushalt des Inhabers), `lib/finanzen/finanzplan-bestand.ts` (`Firma`) | je Gesellschaft (`kdc`, `kdv`, `ug`, Altlast `privat`) EIN `kontostand` (€, beim Lesen auf ganze Euro gerundet) + `stand` (Datum, stempelt der Server bei jeder Änderung) | Liquidität › Kontostände (Eingabefeld je Firma, PUT/PATCH `/api/state/finanzplan`), ZOE `setze_kontostand` (`lib/zoe/werkzeuge.ts`), Erststart `SEED` | `geschaeftsKasse`/`mitKasse` (`lib/make-one/finance-data.ts`: Kasse, Runway im Controlling, Brain, Schilde), `vorschau` (`lib/make-one/liquiditaet.ts`), Business-Index (`ladeRoh` → `lib/business/messen.ts`), Head of Finance (`ladeFinanzbild`, `ist-stand.ts`, `finanzbild.ts`), Fluss „Für dich“, Startfläche, `state/finance`, Controlling-Analyse, Schilde (`lib/risk.ts`), Onboarding-Prüfung „Kontostände frisch“, Zahlen › Business, Rechnungen & Zahlungen, Datenbasis |
| 2 | **0-Punkt (Eröffnung)** | Bestand `business-eroeffnung`, `lib/business/eroeffnung*.ts` | je Business-Gesellschaft Historie von Eröffnungen: Stichtag + `kontostand` (Anfangsbestand, auf den Cent) + offene Posten; „Rückgängig“ markiert | Business › Überblick › 0-Punkt (`/api/business/eroeffnung`) | `abEroeffnung` (EINE Wirkungsstelle: Firmen-Konto = Anfangsbestand, außer `kontoQuelle` = Kontostand NACH dem Stichtag), `kontoStartFuerPlan` → `FinanzDaten.eroeffnung` (Startwert MAKE/KD Ventures in der Finanzplanung) |
| 3 | **Finanzplanung** | Bestand `finanzen-plan--<haushalt>`, `lib/finanzen/rechenkern.ts`, `lib/finanzen/szenarien.ts` | (a) `posten` mit `art: 'konto'` je Einheit (Verpflichtungen › Kontostände, ohne Datum); (b) `selbst.kontoStart` („Kontostand heute“ der Selbstständigkeit); (c) `annahmen.kdvStart` (Startwert KD Ventures); (d) MAKE startet bei 0 bzw. beim 0-Punkt; Handwerte `ug.konto:<m>`/`kdv.konto:<m>`/`kdc.konto:<m>` | Planung › Verpflichtungen, Planung › Selbstständigkeit, Zahnrad (Annahmen), Handwerte im Blatt | `kontostand(d, 'privat')` → Runway Privat und „frei“ (`auswertung`), Lage („Auf den Konten“), Lücken; Kern: `rechneSelbstAchse` (kontoStart), `rechneUG` (kdvStart, 0-Punkt) |
| 4 | **Haushalt** | Bestände `haushalt-stamm--<h>` (Konten: Name, Inhaber, Einheit, IBAN-Endung, Bank), `haushalt-buchungen--<h>` | **keine Salden** — der Haushalt rechnet aus Buchungen (Entflechtung: „Der Haushalt führt keine Kontostände“) | Privat › Konten & Buchungen (Konten & Kategorien, Kontoauszug einlesen) | Buchungen, Fixkosten, Privat-Index |
| 5 | **Privat-Index › Rücklage** | Bestand `privat-index--<h>` (`ruecklage: { betrag (Cent), stand, von }`) | ein von Hand eingetragener Betrag „Tagesgeld, Notgroschen“ | Privat › Überblick › Rücklage | Privat-Index (Säule Reserve & Liquidität) |
| 6 | Stammdaten › Konten | Bestand `stammdaten` (Liste `konten`) | Bankverbindungen (IBAN, Inhaber) — **keine Salden** | Einstellungen › Stammdaten | Anzeige (IBAN nur für die Person selbst) |
| 7 | Steuern › Rücklage Ist | Bestand `steuern` (`einstellungen.ruecklageIst` je Einheit) | wie viel für Steuern schon zurückgelegt ist (zweckgebunden, kein Kontostand) | Steuern › Rücklage & Prognose | Steuer-Prognose |

Doppelungen: derselbe Geschäftskontostand stand in (1), (2) und (3a); der private in (3a) und (5); Konten selbst in (4) und (6) — mit Salden
nur in (1)–(3) und (5). Eine Zahl, an bis zu drei Stellen gepflegt, und die Finanzplanung kannte die Liquidität gar nicht.

## 2. Das Register

- **Bestand** `konten--<haushalt>` (`{ v: 1, konten: RegisterKonto[], uebernahme?: […] }`), verschlüsselt wie jeder Bestand. Rein:
  `lib/finanzen/konten/register.ts` (Typen, Regeln, Sicht, Kassen, Wirkung, Übernahme — Server UND Browser), Server: `lib/finanzen/konten/server.ts`.
- **Konto:** `kt-<uuid>`, Name, Art (`giro · tagesgeld · kredit · depot · kasse · sonstiges`), Zuordnung `ort` (`privat` mit optionaler Person ·
  `gemeinsam` · Gesellschaft `kdc`/`kdv`/`ug` — die drei, die rechnen; `g-…` aus dem Gesellschafts-Register bewusst nicht, solange dort nichts
  rechnet), Bank, IBAN (Grundform im Bestand, nach außen **nur maskiert**, Regeln aus `lib/crm/zahlung.ts`: maskiert/leer = unverändert, ungültig
  = 400, `ibanEntfernen`), `externeId` (Bank, heute leer), `alt` (Verknüpfung zur bisherigen Quelle: Liquidität-Konto, Planungs-Posten,
  Haushalts-Konto), `archiviertAm`.
- **Stand:** `ks-<uuid>`, Betrag (€ auf den Cent), Datum (nie in der Zukunft), `quelle: 'hand' | 'bank'`, `erfasstVon`, `erfasstAm`,
  `herkunft` (konten · liquiditaet · eroeffnung · finanzplanung · zoe · uebernahme · bank, mit Kennung), `externeId`, Notiz. **Nur anhängen**;
  ein falscher Stand wird **zurückgenommen** (bleibt sichtbar, zählt nicht) — wie beim 0-Punkt. **Geltend = jüngster nach Datum**, bei gleichem
  Datum der zuletzt erfasste.
- **Kasse je Ort:** Summe der geltenden Stände der Konten, die zur Kasse zählen (`giro`, `tagesgeld`, `kasse`, `sonstiges` — Kredit und Depot
  nicht, archivierte nicht), dazu jüngster/ältester Stand, Konten mit und ohne Stand.
- **Wer regiert einen Ort?** Das Register, sobald es dort ein Kassen-Konto mit einem Stand hat (auch zurückgenommen). Dann zählt NUR das Register —
  nie Register + alte Stelle (keine Doppelzählung), und ein zurückgenommener Stand lässt die alte Zahl nicht still wieder aufleben. Sonst gilt die
  bisherige Stelle — **bit-gleich wie vorher**.

## 3. Wer liest jetzt daraus

| Stelle | Wie | Rückfall ohne Register |
|---|---|---|
| Liquidität, Business-Index, Head of Finance, Fluss, Startfläche, Kasse/Runway (`state/finance`), Controlling-Analyse, Schilde, Brain, Onboarding-Prüfung | `mitEroeffnung` (Server) bzw. `ladeRoh`/Fluss überlagern die Firmen-Konten mit der Kasse je Gesellschaft (`firmenMitRegister`), DANN wirkt der 0-Punkt wie bisher (`abEroeffnung`: jüngerer Stand als der Stichtag gewinnt) | dieselben Firmen-Objekte (Test: `toBe`) |
| Oberfläche: Liquidität, Zahlen › Business, Rechnungen & Zahlungen, Controlling | `useKontenKasse('business')` + `mitRegister(…)` vor `abEroeffnung` | dieselben Firmen |
| 0-Punkt | setzen → sein Anfangsbestand ist ein Stand am Stichtag (Herkunft Eröffnung, frühere 0-Punkte zurückgenommen); zurücknehmen → auch im Register | führt das Register die Gesellschaft nicht, bleibt der 0-Punkt die Quelle (nichts still übernommen) |
| Finanzplanung (R4) | beim Lesen (`ladeFinanzplan` → `mitIst`, nie gespeichert): Start MAKE/KD Ventures = jüngerer Register-Stand als der 0-Punkt (`FinanzDaten.eroeffnung` mit `quelle: 'register'`, Planmonat des Datums); Privat-Konten = `kontenIst.privat` (privat + gemeinsam) für Runway, „frei“, Lage; „Kontostand heute“ der Selbstständigkeit = `kontenIst.selbststaendigkeit` (Feld in Planung › Selbstständigkeit wird zur Anzeige mit Link). Business-Sicht trägt `kontenIst` nie. Formeln des Rechenkerns unverändert | 0-Punkt bzw. Posten „Konto“, `selbst.kontoStart`, `kdvStart` wie bisher (Test: Kennzahlen gleich) |
| Haushalt | Karte „Konten“ unter Privat › Konten & Buchungen (Pflege des Ists: Konten, Stände, Verlauf, Übernahme der Haushalts-Konten) | — |
| Privat-Index | Rücklage = Tagesgeld (privat + gemeinsam) aus dem Register, wenn vorhanden (`quelle: 'register'`, Hinweis auf der Karte) | die eingetragene Rücklage |
| Bank (später) | dieselbe Schreibstelle mit `quelle: 'bank'`, `externeId` am Konto und am Stand | — |

Bewusst nicht umgestellt: Stammdaten › Konten (Bankverbindungen ohne Salden), Steuern › Rücklage Ist (zweckgebunden), ZOE-Vorschau „vorher“ bei
`setze_kontostand` (zeigt den Finanzplan-Wert, der über den Rückweg-Spiegel mitgezogen wird), Datenbasis (zählt Firmen mit Stand).

## 4. Schreibwege

- **Formular** (Route `/api/finanzen/konten`, POST `{ ops }`, alles oder nichts): `konto-neu` (optional mit erstem Stand), `konto-aendern` (mit
  Fassung, sonst 400; veraltet → 409), `stand-neu`, `stand-zuruecknehmen`, `archivieren` (auch zurück). Grenzen → 413, nie gekürzt
  (200 Konten, 5000 Stände je Konto, 50 Schritte). Bau-Kennung (`bauPruefen`). Änderungsprotokoll nur Kennung + Feldnamen.
- **Bisherige Wege schreiben zusätzlich ins Register** (`kontostandAusAltweg`): Kontostand über `/api/state/finanzplan` (PUT/PATCH — ältere
  Fenster, Skripte) und ZOE `setze_kontostand` (nach Freigabe) — nur, wenn das Register die Gesellschaft schon führt, in das verknüpfte bzw.
  einzige Kassen-Konto (mehrdeutig → nichts, mit Log).
- **Rückweg zum alten Online-Stand:** die alten Stellen bleiben. Jede Register-Änderung an einer Gesellschaft zieht `finanzplan.firmen[…]`
  (Kontostand = Kasse, Datum = jüngster Stand) nach (`finanzplanSpiegeln`, nur im Haushalt des Inhabers) — der alte Stand sieht die neue Zahl.
  Nur neue Bestände (`konten--*`) und optionale Felder (`KontoStart.quelle`, `FinanzDaten.kontenIst` — beide nur beim Lesen), kein `_v`.
  Privat-Stände werden nicht in die Posten der Planung zurückgeschrieben (der alte Stand zeigt dort die alten Posten).
- **Übernahme** (einmalig, nur per Klick): GET `?uebernahme=1` = Vorschau (schreibt nichts), POST `{ aktion: 'uebernahme', basis }` nur mit der
  Kennung genau dieser Vorschau (sonst 409). Je Gesellschaft, die das Register noch nicht führt: Liquidität-Stand (mit seinem Datum) und 0-Punkt
  (Stichtag) als zwei Stände EINES Kontos „Geschäftskonto …“ (der jüngere gilt — dieselbe Regel wie `kontoQuelle`); Posten „Konto“ der Planung
  für diese Gesellschaft nur, wenn sonst kein Stand da ist (sonst doppelt). Privat: jeder Posten „Konto“ ein Konto (Datum unbekannt → heute,
  vermerkt), Konten des Haushalts als Konten ohne Stand (gleicher Name → dasselbe Konto). Idempotent (Verknüpfung `alt`).

## 5. Zugang (Trennung serverseitig)

Route-Klasse `finanz-business` (`planZugangVon`) mit `wirksameSicht(Konto, ?sicht)` wie die Finanzplanung: volle Haushaltsmitglieder sehen alles
(Sicht `privat`); Konten mit `finanzRecht: 'business'` und der Business-Bereich (`?sicht=business`) bekommen NUR Konten der Business-
Gesellschaften (`istBusinessGesellschaft` — die Selbstständigkeit gehört über `bereichVon` zu Privat). Schreiben außerhalb der Sicht → 403,
Dienstweg (ZOE, Takt) → 403, ohne Haushalt → 403. Ein anderer Haushalt hat sein eigenes Register. Lese-Protokoll Bereich `konten`.
Datenschutz: Speicher-Register `konten--*` (Haushalt, Angaben, Kategorie vertraulich), `NICHT_PERSOENLICH` (Konto-Export: eigene Konten,
IBAN maskiert; Konto löschen: Konten bleiben, Personen-Kennung → „[gelöscht]“).

## 6. Andockstelle Bank (finAPI, nicht gebaut)

Ein Abruf legt je Bank-Konto ein Register-Konto an bzw. verknüpft es (`externeId`), schreibt Salden als Stände mit `quelle: 'bank'`,
`herkunft: { art: 'bank' }`, `externeId` (idempotent über `standAnhaengen`) — über `lib/finanzen/konten/server.ts`, nie daneben. Buchungen gehen
weiter in den Haushalt bzw. `buchungen`; der Saldo gehört hierher.

## 7. Offen

- Das Register und die Konten des Haushalts (`haushalt-stamm`) sind noch zwei Listen (verknüpft über `alt.haushaltKonto`); die Buchungen hängen
  am Haushalts-Konto. Zusammenlegen wäre der nächste Schritt (Haushalt-Konto = Register-Konto).
- Konten der offenen Gesellschafts-Liste (`g-…`) — erst, wenn diese Gesellschaften rechnen.

## 8. Kontoauszug einlesen — Bank-Übergang bis finAPI (09.10., Branch `kontoauszug`)

ONBOARDING_PLAN.md › B9 d (+ L7/L8/L32). Kevin 08.10.: „Bank-Anbindung vorziehen“; R3: bis dahin von Hand. Je Konto der Karte „Konten“ →
„Kontoauszug einlesen“: Datei (CAMT.053 oder CSV) → bei CSV Spalten zuordnen → **Vorschau** → **Übernehmen** → **Rückgängig**.

- **Leser** `lib/finanzen/kontoauszug/` (rein, Server UND Browser, ohne neue Abhängigkeiten): `lesen.ts` (Einstieg, 5 MB → 413, PDF/ZIP/Bild → 415),
  `camt.ts` (camt.053.001.02–.08, auch .052/.054; eigener XML-Leser **ohne DTD/Entitäten** — `<!DOCTYPE`/`<!ENTITY` → 415, Tiefe ≤ 64; Salden
  `OPBD`/`PRCD`/`CLBD`, Einträge mit Status `BOOK`/`PDNG`, Gegenseite je Richtung (`Dbtr`/`Cdtr`, ab .08 `Pty/Nm`), `Ustrd`, `AcctSvcrRef`/`NtryRef`;
  mehrere Tagesauszüge je IBAN zusammengefasst, **jeder** gegengerechnet), `csv.ts` (EIN Trenner erkannt, RFC-4180-Anführungszeichen, UTF-8 oder
  Windows-1252, **Vorspann übersprungen**, Fußzeile „Kontostand“, Spaltenvorschlag aus Kopfnamen — nur Namen, keine Daten — für N26, Sparkasse,
  VR-Banken, Deutsche Bank, Commerzbank, Qonto, Revolut, Kontist; Betrag, Soll/Haben oder Kennzeichen S/H; Gebühr; Status „vorgemerkt“; Saldo-Spalte
  → End- und Anfangssaldo), `text.ts` (Beträge in **Cent**, deutsches/englisches Format, Daten inkl. zweistelliger Jahre, Fingerabdruck).
  Ergebnis je Konto: `{ iban?, waehrung, saldo?, anfang?, eintraege, hinweise, pruefung }` — Prüfsumme Anfang + Summe = Ende, Abweichung = Hinweis.
- **Plan** `plan.ts` (rein): Zuordnung per IBAN (Grundform) bzw. Wahl; IBAN eines anderen Kontos → 409 mit dem passenden Konto. Ziel:
  privat/gemeinsam → Haushalt (Haushalts-Konto: verknüpftes `alt.haushaltKonto`, sonst gleicher Name/IBAN-Endung, sonst **neu angelegt** und
  verknüpft; Einordnung über die Regeln/Kategorien des Haushalts wie der bisherige Import); Gesellschaft → `buchungen` mit `ort` (nur im Haushalt
  des Inhabers, sonst nur der Saldo). Fremde Währung, vorgemerkt, storniert, Buchungstag in der Zukunft → übersprungen (nie still).
  **Dubletten:** externe Kennung (wenn in der Datei eindeutig) bzw. Fingerabdruck (Datum, Betrag, Gegenseite, Zweck) als **Menge** (zwei gleiche
  Kaffees = zwei Buchungen; auch von Hand Erfasstes zählt), im Haushalt zusätzlich der `zeilen_hash` des bisherigen Imports. Business-Kennung fest:
  `bu-ka-<Konto>-<Schlüssel>`. Gegen-IBAN = eigenes Konto → Umbuchung. `basis` = Kennung genau dieser Vorschau.
- **Server** `server.ts` + Route `/api/finanzen/konten/auszug` (Klasse `finanz-business` wie das Register; Business-Sicht nur Business-Konten →
  sonst 403, Dienstweg 403): `vorschau` schreibt nichts; `uebernehmen` nur mit `basis` (sonst 409 + neue Vorschau) und bei nicht stimmiger
  Saldo-Prüfung nur mit `trotzAbweichung`; `zuruecknehmen` nimmt nur Buchungen, deren Fingerabdruck seit dem Anlegen gleich ist (sonst
  Konflikt-Liste, Lauf „teilweise“), und den Saldo-Stand zurück (bleibt im Verlauf); das angelegte Haushalts-Konto bleibt. `anfrageId` über
  `einmalig`. **Absichtsprotokoll** (Art `kontoauszug`, Schritte lauf · haushaltkonto · buchungen · saldo · abschluss bzw. buchungen · saldo ·
  protokoll) — jeder Schritt idempotent (Lauf-Marke `auszug`/`import_id` an der Buchung), Wiederaufnahme im Takt/beim Start.
- **Saldo** → `standAusAuszug` (lib/finanzen/konten/server.ts, EINE Schreibstelle): Stand `quelle: 'bank'`, Herkunft `auszug` (Lauf), gleicher
  Betrag + Datum schon da → nichts; Rückweg-Spiegel in den Finanzplan wie jeder Stand.
- **Recht:** Die Datei wird nie gespeichert (Namen Dritter). Bestand `kontoauszug-laeufe--<haushalt>` hält nur Kennungen, Fingerabdrücke, Zahlen,
  Zeitraum, Speichername (Register mit Angaben, Export/Konto löschen wie das Register, 400 Tage). Die anzulegenden Zeilen liegen nur bis zum Abschluss
  in der Absicht. IBANs nach außen nur maskiert; Verwendungszwecke sind fremder Text (an ZOE nur über `fremd()` — heute geht nichts an ZOE).
- **Nicht gebaut:** ZIP mit mehreren CAMT-Dateien (bitte entpacken), MT940, PDF (bleibt der N26-Import des Haushalts), Kategorien-Regeln für
  Business-Buchungen (Kategorie aus der CSV bzw. „Sonstiges“/„Umbuchung“), automatischer Abgleich mit Rechnungen („bezahlt“ — wäre Vorschlag).
- Tests: `tests/kontoauszug-lesen.test.ts`, `tests/kontoauszug-route.test.ts`.
