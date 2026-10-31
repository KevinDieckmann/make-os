# Kampagne „Homepage“ — Massen-Funnel (PLAN, noch nichts gebaut)

Stand 30.10.2026 · Auftrag Kevin: „…dass soll der funnel werden auf eine Zielgruppe wo wir einfach nur geld machen auf ‚Masse‘“ —
in Berlin Betriebe (Restaurants, Läden, Handwerk …) ohne oder mit sehr schlechter Homepage finden, jeden Abend selbstständig;
je Betrieb Entwurf + kleine Vorschau der neuen Seite + unser Angebot; Liste als Segment in der Markttraktion.

> Hinweis, keine Rechtsberatung. Die rechtliche Einordnung unten stützt sich auf IHK-Merkblätter und BGH-Leitsätze (Quellen am Ende);
> vor dem ersten Versand einmal anwaltlich gegenlesen lassen (gleicher Anwalt wie für `lib/crm/recht.ts`).

---

## Kevins Entscheidungen (Klickrunde 30.10.2026) — gelten vor den Empfehlungen unten

| # | Entscheidung | Was das für den Bau heißt |
|---|---|---|
| E1 Kanal | **Mail an Tag 0, nach 72 h ohne Antwort Anruf.** Vincento und sein Kumpel dürfen zusätzlich vor Ort hingehen. Auf die Rückfrage zum Abmahnrisiko: **„Mail + Anruf, mein Risiko“.** | Die Kanal-Ampel bleibt **rot** und wird nicht umgeschrieben. Neu: Freigabe-Modus **„eigenes Risiko“** NUR für Playbook `homepage-funde`. Er ist eine Instanz-Einstellung, die nur der Inhaber einschaltet; die Vorgabe ist AUS (Plattform-Regel: eine neue Instanz startet rechtssauber). Jeder Stapel trägt den sichtbaren Vermerk, wer ihn wann auf eigenes Risiko freigegeben hat. Das wird protokolliert (Änderungsprotokoll + ZOE-Entscheidungen). Versendet wird nur per Klick. Leitplanken, um das Risiko klein zu halten: genau **eine** Mail je Betrieb, keine Folge-Mails, persönlich formuliert (kein Newsletter-Look). In der Mail stehen der Absender, das Impressum, der Art.-14-Hinweis und ein Abmeldelink (`lib/datenschutz/abmelden.ts`), dazu der Vorschau-Link statt QR. Der Anruf erfolgt einmal, nach 72 h, nur ohne Reaktion und ohne Abmeldung, und bekommt einen Leitfaden. Ein „Nein“ in irgendeiner Form setzt sofort Werbesperre und Sperrliste. Besuch vor Ort = Aufgabe für Vincento. Brief bleibt als Option in der Vorlage. **Empfehlung bleibt:** einmal anwaltlich prüfen lassen, bevor die Menge steigt. |
| E2 Quelle | **OSM je Bezirk + Google Maps von Hand.** | Der Abendlauf geht die 12 Berliner Bezirke der Reihe nach durch (OSM-Abfrage je Bezirk und Branche). Dazu kommt ein Feld „Fund von Hand“: Vincento/Team tragen Betriebe ein, die sie auf Maps sehen. Das ist keine automatische Google-Abfrage und keine gespeicherte Google-Liste. |
| E3 Volumen | **20 je Abend.** | Stapel ≤ 20, Freigabe ~10 Min. |
| E4 Preis | **offen** (keine Vorgabe). | Kevin legt die Produktkarte „Website Start“ im Katalog an; der Plan liest Preis/Text nur daraus. |
| E7 Absender | **Fokus Innovation.** | Absender-Gesellschaft über das Register (`finanzFirmaFuer`), Texte im Ton der Positionierung (Sie). |
| E8 Branchen | **Gastro, Handwerk, Einzelhandel.** | Drei Vorlagen-Familien für die Vorschau; OSM-Filter `amenity`-Gastro, `craft`/`shop=hairdresser/beauty`, `shop=*` Einzelhandel. Ketten und Filialen werden ausgeschlossen (`brand`-Tag). |
| E5/E6/E9/E10 | nicht gefragt → Empfehlung gilt | Vorschau = private Seite (Link in der Mail), Sammelfreigabe je Abend mit Einzel-Häkchen, Segment-Kriterium auch für Firmen. |

**Funnel nach Kevins Wahl:** Fund (OSM/Hand) → Bewertung → Vorschau → **Mail-Entwurf** → Freigabe „eigenes Risiko“ → Mail per Klick
(Absender = Postfach von Fokus Innovation über die Inbox) → 72 h → **Anruf-Aufgabe** (oder Besuch) → Anfrage über Vorschau-Seite/Antwort →
Angebot → Mandat. Etappe E5 (öffentliche Vorschau-Seite) rückt damit nach vorn, weil die Mail den Link trägt.

---

## 0. Die Antwort zuerst

| Frage | Empfehlung |
|---|---|
| Darf der Agent jeden Abend Kaltmails vorbereiten, die wir dann verschicken? | **Nein.** Werbe-Mail an Firmen ohne Einwilligung ist auch im B2B unzulässig (§ 7 Abs. 2 Nr. 2 UWG) — schon eine einzige ist abmahnfähig. Eine im Impressum veröffentlichte Adresse ist keine Einwilligung (BGH). Unsere Kanal-Ampel steht hier schon heute auf **rot**. |
| Und Kaltanruf? | **Nein.** Mutmaßliche Einwilligung braucht konkrete Umstände für ein Interesse; „könnte eine Website brauchen“ reicht nicht (BGH I ZR 27/08). Ampel heute: rot. |
| Was geht dann auf Masse? | **Adressierter Brief** (B2B grundsätzlich zulässig, nur nicht bei erkennbarem Widerspruch, § 7 Abs. 1 S. 2 UWG) und **persönlicher Besuch** im Laden während der Öffnungszeit. |
| Wie wird daraus trotzdem ein digitaler Funnel? | Brief mit **QR-Code auf eine private Vorschau-Seite** („So könnte Ihre neue Seite aussehen“). Dort ein Knopf „Angebot ansehen / Rückruf erwünscht“ → das ist eine **Anfrage** → ab dann dürfen wir antworten (Mail, Anruf), Angebot schicken. Die Mail aus Kevins Wunsch entsteht also — aber als **Antwort nach der Reaktion**, nicht als Erstkontakt. |
| Woher die Betriebe? | **OpenStreetMap** (Overpass, ODbL, kostenlos, darf gespeichert werden). **Nicht** Google Places: die Bedingungen verbieten Speichern über place_id hinaus und das Aufbauen von Listen/Datenbanken aus Google-Inhalten. Kein Scraping von Gelbe Seiten/Das Örtliche/Handelsregister (AGB bzw. 60 Abrufe/Stunde, Massenabruf ggf. strafbar). |
| Wie messen wir „Homepage schlecht“? | Ohne KI, gerechnet: keine Website · kein HTTPS · nicht mobil (Viewport fehlt) · PageSpeed-Mobil-Wert (Google PageSpeed Insights API, kostenlos, 25.000 Abfragen/Tag) · veraltet (Copyright-Jahr, alte Technik) · kein Impressum. Ergebnis = Punkte 0–100 + Gründe. |

---

## 1. Der Funnel

```
 ABENDS (Takt, ab 20 Uhr, N Funde)                 MORGENS (Kevin/Malin, ein Klick je Fund oder je Stapel)
 ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌─────────────┐   ┌──────────────┐
 │ 1 FUND   │ → │ 2 BEWERTEN│ → │ 3 VORSCHAU│ → │ 4 ENTWURF   │ → │ 5 FREIGABE   │
 │ OSM:     │   │ Website?  │   │ Vorlage + │   │ Brief +     │   │ ZOE-Stapel,  │
 │ Berlin,  │   │ HTTPS,    │   │ Name/Ort/ │   │ Besuchszettel│  │ Art „fund“   │
 │ Branche  │   │ mobil,    │   │ Zeiten +  │   │ (Mail nur   │   │ → übernimmt  │
 │          │   │ PageSpeed │   │ KI-Text   │   │ bei Ampel≠rot)│ │ in Kartei    │
 └──────────┘   └───────────┘   └──────────┘   └─────────────┘   └──────┬───────┘
      verworfen (gute Seite, Kette, Sperrliste) ──► Löschfrist                │
                                                                           ▼
 ┌──────────────┐   ┌───────────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐
 │ 6 KONTAKT    │ → │ 7 REAKTION    │ → │ 8 ANFRAGE    │ → │ 9 ANGEBOT│ → │10 MANDAT │
 │ Brief raus   │   │ QR → private  │   │ Knopf auf der│   │ Produkt  │   │ Fall,    │
 │ (Druck) oder │   │ Vorschau-Seite│   │ Seite / Anruf│   │ „Website │   │ Rechnung,│
 │ Besuch       │   │               │   │ / Mail → Lead│   │ Start“   │   │ Liqui    │
 └──────────────┘   └───────────────┘   └──────────────┘   └──────────┘   └──────────┘
```

Jede Stufe ist ein Status am Fund bzw. später an Firma/Lead/Deal — dieselben Wege wie heute (Lead → SQL → Deal → Angebot → Mandat).

---

## 2. Rechtliche Einordnung

### 2.1 Kanäle (Erstkontakt, ohne Vorbeziehung)

| Kanal | Rechtslage | Ampel | Im Funnel |
|---|---|---|---|
| E-Mail (auch an info@ aus dem Impressum) | § 7 Abs. 2 Nr. 2 UWG: Werbung per elektronischer Post nur mit vorheriger ausdrücklicher Einwilligung — gilt B2B wie B2C; Impressumsadresse ≠ Einwilligung (BGH). Bestandskunden-Ausnahme § 7 Abs. 3 greift nicht. | **rot** | erst nach Anfrage (Stufe 8) |
| Kontaktformular der Website | Wird nach überwiegender Auffassung wie elektronische Post behandelt (Individualnachricht auf elektronischem Weg) — *kein BGH-Urteil gefunden, als Annahme rot behandeln*. | **rot** | nie |
| WhatsApp / LinkedIn-Nachricht / Instagram-DM | Elektronische Post (unsere Ampel: rot ohne Einwilligung). | **rot** | nie |
| Telefon | § 7 Abs. 2 Nr. 1 UWG, B2B mutmaßliche Einwilligung nur mit konkreten Umständen über den abstrakten Bedarf hinaus (BGH I ZR 27/08, I ZR 191/03); Branchenüblichkeit reicht nicht. | **rot** | erst nach Anfrage oder Brief-Rückmeldung |
| **Brief (adressiert)** | Grundsätzlich zulässig, auch an Unternehmen; unzulässig, wenn der Empfänger erkennbar nicht will (Widerspruch, Aufkleber, „keine Werbung“) — § 7 Abs. 1 S. 2 UWG. Absender muss erkennbar sein. | **grün** (mit Sperrliste) | **Haupt-Kanal** |
| **Besuch vor Ort** | Kein Fernkommunikationsmittel, § 7 Abs. 2 greift nicht; nur allgemeine Belästigungsgrenze (§ 7 Abs. 1). Im Laden während der Öffnungszeit, kurz, mit ausgedruckter Vorschau — in Berlin bei Gastro realistisch. | **grün/gelb** (Rücksicht: nicht zur Stoßzeit, bei „nein“ gehen und Sperre setzen) | **zweiter Kanal** |

**Empfehlung:** Erstkontakt **Brief mit QR-Code**, optional **Besuch** für die Top-Funde im eigenen Kiez. Mail/Telefon erst ab der Anfrage.
Im Code heißt das: neuer Kanal `brief` und `besuch` in der Kanal-Ampel (`lib/crm/recht.ts`, Regeln R10/R11, Tests) — die bestehenden
Regeln bleiben unverändert; ein Mail-Entwurf für einen Fund wird nur gebaut, wenn die Ampel nicht rot ist (also praktisch erst nach Anfrage).

### 2.2 DSGVO

- **Juristische Personen** (GmbH, UG) sind keine Betroffenen; **Einzelunternehmer, eingetragene Kaufleute, Freiberufler** schon
  (Name = Firma). Restaurants sind oft Einzelunternehmen → wir behandeln **jeden Fund als personenbezogen**.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. f (berechtigtes Interesse, Direktwerbung ErwG 47), mit dokumentierter Interessenabwägung
  (Vorbild „LIA-Netzwerken v1“ → „LIA-Recherche v1“), Verzeichnis-Eintrag `vv-recherche-funde`.
- **Art. 14** (Daten nicht bei der Person erhoben): Information **spätestens mit der ersten Mitteilung** (Abs. 3 lit. b), sonst
  binnen eines Monats (lit. a). Lösung: **Datenschutz-Hinweis auf der Brief-Rückseite** bzw. auf dem Besuchszettel (Quelle
  „OpenStreetMap, öffentlich zugänglich“, Zweck, Speicherdauer, Widerspruchsrecht Art. 21, Kontakt). Für Funde, die wir **nicht**
  kontaktieren, greift die Monatsfrist → deshalb kurze **Löschfrist für nicht kontaktierte Funde** (Vorschlag 21 Tage, nie über 30).
  Die vorhandene Art.-14-Uhr (`art14()` in recht.ts) läuft ab der Übernahme in die Kartei mit.
- **Widerspruch** (Brief zurück, „nein“ beim Besuch, Knopf auf der Vorschau-Seite „Keine Post mehr“) → **Werbesperre + Sperrliste**
  (`sperren(...)`, Fingerabdruck) — der Abendlauf prüft jeden neuen Fund gegen die Sperrliste und die Grabsteine, bevor er überhaupt
  bewertet wird.
- **Vorschau-Seite:** zeigt den Firmennamen des Betriebs → nur über ein nicht erratbares Token, noindex, kein Referrer, Ablauf
  (Vorschlag 60 Tage), Aufruf zählt nur „angesehen ja/nein“ am Fund — kein Tracking-Pixel, keine IP-Speicherung.
  Im Art.-14-Hinweis steht, dass der Aufruf vermerkt wird.
- **Urheberrecht/Marke:** Die Vorschau nutzt **nur Fakten** (Name, Branche, Adresse, Öffnungszeiten aus OSM) und eigene Vorlagen/
  lizenzfreie Bilder — **nie** Fotos, Logos oder Texte von der alten Seite oder aus Google.
- **KI-VO Art. 50:** KI-Texte der Vorschau tragen `kiKennzeichen()`; auf der Seite steht „Entwurf, mit KI erstellt“.

---

## 3. Datenquellen und Kosten

| Quelle | Wofür | Nutzungsbedingungen | Kosten | Urteil |
|---|---|---|---|---|
| **OpenStreetMap über Overpass API** | Betriebe in Berlin je Kategorie (`amenity=restaurant/cafe/bar/fast_food`, `shop=*`, `craft=*`, `office=*`) mit Name, Adresse, Öffnungszeiten, `website`/`contact:website` | ODbL 1.0: kommerziell erlaubt, Namensnennung „© OpenStreetMap-Mitwirkende“; Share-Alike erst bei öffentlicher Weitergabe der Datenbank (machen wir nicht). Öffentliche Instanz: ~10.000 Abfragen/Tag, < 1 GB/Tag — wir brauchen **eine** Abfrage je Abend und Kategorie. | 0 € | **Empfohlen** |
| Google PageSpeed Insights API | Bewertung der vorhandenen Seite (Mobil-Wert, Core Web Vitals) | Schlüssel kostenlos; wir schicken nur die Website-Adresse des Betriebs | 0 € (25.000/Tag) | **Empfohlen** (Empfänger-Register `google-pagespeed`) |
| Eigener Abruf der Startseite | HTTPS, Viewport, Copyright-Jahr, Generator, Impressum vorhanden | robots.txt beachten, 1 Abruf je Fund, eigener User-Agent, Zeitlimit | 0 € | **Empfohlen** |
| Google Places API | Website-Feld, Bewertungen | Speichern nur `place_id` (lat/lng 30 Tage); keine Listen/Datenbanken aus Google-Inhalten, kein Scraping (ToS 3.2.3) — **unser Fundbestand wäre genau das** | Text Search Enterprise 1.000 frei/Monat, dann ~35 $/1.000 | **Nicht empfohlen** |
| Handelsregister | Rechtsform (Einzelunternehmen?) | keine API; > 60 Abrufe/Stunde unzulässig; Gastro meist gar nicht eingetragen | 0 € | nur Einzelabruf von Hand |
| Gelbe Seiten, Das Örtliche, Google-Maps-Scraper (Apify u. ä.) | — | Scraping gegen AGB / Google ToS | — | **Nein** |
| Web-Suche über ZOE (`askWithSearch`) | „Hat der Betrieb doch eine Seite?“ bei Funden ohne `website`-Tag | Anthropic Web-Suche, KI-Tor | ~0,01 $ je Suche + Tokens | **optional** (OSM-Lücken sind häufig) |
| KI-Text für Vorschau + Brief | Überschrift, 3 Leistungs-Absätze, Briefzeilen | `askText` mit `ki: { lauf: 'funde', kategorien: ['crm','web'] }`, Hintergrund-KI muss an sein | grob 2–5 Cent je Fund (Sonnet) | ja |
| Brief | Druck + Porto | Druckdienst mit API braucht AVV; oder selbst drucken | Porto Standardbrief derzeit 0,95 € + Druck; Dialogpost günstiger ab Mindestmenge (Preis prüfen) | Entscheidung |

**Grobe Rechnung je 100 kontaktierte Betriebe:** Daten 0 € · KI ~3–5 € · Briefe ~120–150 € (selbst gedruckt ~100 €) · Zeit für Freigabe ~30 Min.

---

## 4. Datenmodell und Andockstellen

Grundsatz: **Funde sind noch keine Kontakte.** Sie liegen in einem eigenen, kurzlebigen Bestand und kommen erst mit der Freigabe
in die Kartei (Firma + Lead). So bleibt die Kartei sauber, die Löschfrist ist einfach, und Segmente/Indizes zählen nur Echtes.

### 4.1 Neue Bestände (alle im Speicher-Register mit Rechtsgrundlage, Art. 15, Löschfrist, Kategorie)

| Bestand | Inhalt | Register |
|---|---|---|
| `kampagne-funde--<haushalt>` | `Fund { id: fd-<uuid>, kampagneId, quelle: 'osm', osmId, name, kategorie, adresse, oeffnungszeiten?, website?, bewertung { punkte, gruende[], pagespeedMobil?, https, mobil, jahr?, gemessenAm }, status: neu·bewertet·vorbereitet·freigegeben·kontaktiert·angesehen·anfrage·verworfen·gesperrt, grund?, vorschauId?, entwurf?, firmaId?, kontaktId?, kontaktiertAm?, kanal?, art14Am?, angesehenAm?, geloeschtAm? }` | Bezug `dritte`, Behandlung `entfernen`, Art. 6 (1) f, Frist `kampagne-funde` |
| `kampagne-vorschau--<haushalt>` | Vorschau je Fund: Vorlage-Kennung, Farben, KI-Texte (mit Kennzeichen), Token-Hash, Ablauf | `dritte`, `entfernen`, folgt dem Fund |
| `kampagne-funde-lauf` | Zustand des Abendlaufs (letzte Abfrage je Kategorie, Zähler, Fehler) — keine Personendaten | `kein`, in `RAUSCHEN` |

### 4.2 Andockstellen (vorhandenes nutzen, nichts daneben bauen)

| Stelle | Was passiert |
|---|---|
| **Kampagne** (`lib/crm/kampagnen.ts`) | Neues Playbook `homepage-funde` („Betriebe ohne gute Website“, Kanal `brief`, Schritte: Brief Tag 0 · Besuch Top-Funde Tag 3 · Nachfassen nach Anfrage Tag 7, Rechtshinweis aus 2.1). Eine Kampagne je Stadt/Branche, z. B. „Homepage · Berlin · Gastro“. `Kampagne.kanal` bekommt `brief` (additiv). |
| **Funde-Ansicht** | Markttraktion › Marketing › Kampagnen › Kampagne öffnen › Reiter **„Funde“**: Liste mit Punkten, Gründen, Vorschau-Knopf, Entwurf, Status; kein neuer Leistenpunkt. |
| **Abendlauf** (`lib/zoe/takt.ts`, `KI_LAEUFE`) | Job `funde` ab 20 Uhr, einmal je Tag, nur wenn eine Kampagne mit Playbook `homepage-funde` **aktiv** ist und Hintergrund-KI an. Schritte: OSM holen → Dubletten (osmId, gleiche Firma in Kartei über `bestehendeFirma`, Sperrliste, Grabsteine) → bewerten (ohne KI) → die N schlechtesten → Vorschau + Entwurf (KI) → in den Stapel. Agenten-Schalter unter /os/agenten (`resolveAgent('funde')`). Ein Lauf je Prozess, Pause nach Fehler wie gewohnt. |
| **Agent** | Kein neuer freier Web-Agent: der Lauf ist ein fester Ablauf (wie die Heads: Regelwerk zuerst, Modell nur für Texte). Der alte `prospect`-Agent (Bestand `prospects`, ICP-Score) bleibt unberührt; er bekommt nur einen Hinweis-Link auf die Funde. |
| **ZOE-Stapel** | Neue Stapel-Art **`fund`** (`lib/zoe/stapel-arten.ts`): ein Eintrag je Abend („12 Funde vorbereitet“) mit Einzel-Häkchen; **Freigabe** übernimmt über die bestehenden Schreibwege: Firma anlegen (`bestehendeFirma` zuerst), Lead `kontaktiert`, Herkunft `recherche`, Label der Kampagne, `fremddaten: true` (Art.-14-Uhr), Kampagne `firmaIds` (neu, optional — Restaurants haben oft keine benannte Person), Brief-PDF in die Dateiablage mit Bezug. Ablehnen mit Grund → Fund `verworfen` (Lerneffekt: Gründe zählen). |
| **Segment** | Gespeichertes Segment „Homepage · Berlin“ = Kriterien `herkunft: ['recherche']` + `label: ['homepage-berlin']`. **Lücke:** Segmente zählen heute Personen. Für Firmen ohne Person: Segment-Kriterium wirkt auch auf Firmen (`segmentFirmen`, additiv) — oder wir legen bei bekanntem Inhaber (Impressum) eine Person an. → Entscheidung E8. |
| **Leads / Scoring** | Firma.lead mit `grundArt: 'recherche'`; die Anfrage über die Vorschau-Seite läuft über `lib/crm/anfrage-anlegen.ts` (Kanal `vorschau`) → Lead `im Gespräch`, Marketing-Herkunft „Kampagne“ → zählt als MQL. |
| **Angebot** | `/api/crm/angebot` mit dem Produkt aus dem Katalog (siehe 6), Deal über `dealAnlegen`. |
| **Mandat / Fulfillment** | Angenommen → Mandat + Fall wie bei jedem Produkt (Kreislauf Geld & Lieferung). |
| **Kanal-Ampel** | `brief`, `besuch` als neue Kanäle (2.1); Sperrliste/Art. 18 gelten unverändert. |
| **Löschfristen** (`lib/crm/loeschfristen.ts`) | `kampagne-funde` (nicht kontaktiert: Vorschlag 21 Tage, max 30 — Art. 14 Monatsfrist), verworfen 7 Tage (nur osmId-Fingerabdruck bleibt, damit derselbe Betrieb nicht jeden Abend wiederkommt), Vorschau-Seite 60 Tage. Morgenlauf-Schritt `fundeAufraeumen`. |
| **Art. 15/17** | `lib/crm/person-weitere.ts`: Funde + Vorschauen über Name/Adresse; Art. 17 entfernt + Sperrliste. |
| **VVT / Empfänger** | `vv-recherche-funde`; Empfänger `openstreetmap` (nur Abfragen, keine Personendaten raus), `google-pagespeed` (Website-Adresse), Anthropic (vorhanden), Druckdienst (falls gewählt, AVV). |
| **Öffentlicher Weg** | `/vorschau/<slug>-<24 hex>` + `POST /api/vorschau/<slug>` (Knöpfe „Angebot ansehen“, „Rückruf“, „Keine Post mehr“) — gebaut wie die Buchung: Regex in `middleware.ts`, Drossel, Honigtopf, signierter Formular-Stempel, Größe, strenge Köpfe (noindex, no-referrer, CSP ohne Skripte von außen), handelt nie als Person, Register-Klasse `offen` + `OFFEN_ERLAUBT` + eigener Test. |
| **Wächter** | „Sicht Business bekommt nichts aus Privat“ (Funde gehören zur Business-Gesellschaft der Kampagne), Fund ohne Freigabe nie in der Kartei, nie ein Mail-Entwurf bei roter Ampel, Vorschau-Seite ohne gültiges Token 404, gesperrter Betrieb nie wieder als Fund. |

---

## 5. Die Vorschau

- **Wie:** EINE Vorlagen-Maschine (Daten statt Code, wie der Innovations-Check): 3–4 Vorlagen je Branche (Gastro, Laden, Handwerk,
  Dienstleistung), Farben aus einer kleinen Palette, Abschnitte Kopf · Öffnungszeiten · Lage · Angebot/Speisekarte-Platzhalter · Kontakt.
  Gefüllt mit OSM-Fakten + 3 kurzen KI-Texten (Überschrift, Willkommen, Leistungen) — JSON über `askJson`, gesäubert, Länge gedeckelt.
  Keine fremden Bilder; Bilder = eigene, lizenzfreie Branchenbilder im Repo-Ordner der Vorlagen (ohne Personen).
- **Wo:** Vorschau-Daten im Bestand `kampagne-vorschau--<haushalt>` (verschlüsselt wie alles); gerendert wird **zur Laufzeit**
  aus Vorlage + Daten — es entsteht keine Datei, nichts liegt in `public/`.
- **Intern:** Funde-Reiter zeigt die Vorschau in einem `sandbox`-iframe (Handy- und Rechner-Breite).
- **Nach außen:** erst nach Freigabe des Funds: Token wird erzeugt (nur Hash gespeichert), QR-Code auf dem Brief, Seite 60 Tage gültig.
  Ohne Freigabe existiert kein Link — **nie öffentlich ohne Freigabe**.
- **Im Brief:** optional ein kleines Bild der Vorschau. Das braucht einen Bildschirmfoto-Dienst (Chrome) — auf dem 1-vCPU-Server
  teuer; Vorschlag: zuerst nur QR + ein gezeichnetes Schema mit pdf-lib, Bild später.
- **Bonus für die Lieferung:** Nimmt der Betrieb an, ist die Vorschau der Startpunkt der echten Seite (gleiche Vorlage).

---

## 6. Das Angebot

Heute gibt es im Katalog **kein** passendes Massen-Produkt (die Produkte sind Instanz-Daten; Beratung/Mandate). Vorschlag für eine
neue Produktkarte (Kevin trägt sie selbst ein oder per Import — Werte nie im Code):

| Feld | Vorschlag |
|---|---|
| Name | „Website Start“ (Linie: Sichtbarkeit) |
| Leistung | Einseitige Website aus der Vorschau, 2 Korrekturrunden, eigene Domain, HTTPS, Impressum/Datenschutz-Gerüst, Google-Unternehmensprofil-Hinweis, Lieferung in 10 Werktagen |
| Preis | einmalig + Betrieb monatlich (Hosting, Pflege, kleine Änderungen) — siehe E4 |
| Laufzeit | Betrieb 12 Monate, dann monatlich kündbar |
| Fulfillment | fester Ablauf: Freigabe Texte → Bilder/Speisekarte vom Kunden → Bau → Abnahme → Livegang |

Wichtig für „Masse“: Gewinn entsteht nur, wenn die **Lieferung fast automatisch** ist (Vorlage = Vorschau). Sonst frisst die
Lieferzeit den Preis. Hosting auf unserem Server wie fokusinnovation.de (statisch über Caddy) ist möglich, braucht aber ein eigenes
Kunden-Seiten-Paket (später, eigener Plan).

**Marke:** Fokus Innovation ist „seriös, nicht Tech-Bude“ und zielt auf innovative Unternehmen — ein Massen-Angebot für Imbisse
kann die Marke verwässern. → Entscheidung E7 (eigene Marke / Absender).

---

## 7. Kennzahlen

Je Kampagne (Karte im Kampagnen-Reiter, später Kachel im Traktions-Index unter Marketing):

- Funde je Abend · Anteil „schlecht“ · verworfen (mit Gründen)
- Freigegeben · Briefe raus · Besuche
- Vorschau angesehen (Quote) · Anfragen (Quote je Brief) · Angebote · Abschlüsse
- **Kosten je Anfrage** und **je Abschluss** (Porto + Druck + KI, über `Kampagne.kostenEuro`) · Umsatz einmalig + MRR
- Widersprüche („Keine Post mehr“) — Warnsignal, wenn > 2 %

---

## 8. Etappen mit Aufwand

| # | Etappe | Inhalt | Aufwand |
|---|---|---|---|
| E0 | Entscheiden + Recht | Kevins Klickrunde, Anwalt liest 2.1/2.2 + Brief-Hinweistext, Produktkarte anlegen | Kevin ~1 h + Anwalt |
| E1 | Fund-Kern | Bestände, Register, Löschfrist, OSM-Abfrage, Bewertung (rein + getestet, PageSpeed), Dubletten/Sperrliste, Wächter | ~1 Bautag |
| E2 | Abendlauf + Funde-Reiter | Takt-Job, Agenten-Schalter, Liste in der Kampagne, Playbook `homepage-funde`, Kanal `brief`/`besuch` in der Ampel | ~1 Bautag |
| E3 | Vorschau | Vorlagen-Maschine, KI-Texte, interne Ansicht | ~1–1,5 Bautage |
| E4 | Entwurf + Freigabe | Brief-PDF (Serienbrief, Art.-14-Rückseite, QR), Besuchszettel, Stapel-Art `fund`, Übernahme in Kartei/Lead/Kampagne/Segment | ~1 Bautag |
| E5 | Öffentliche Vorschau-Seite | Token-Seite, Knöpfe Anfrage/Rückruf/Keine Post, Anfrage → Lead, Sperre | ~1 Bautag |
| E6 | Angebot + Kennzahlen | Angebots-Vorbelegung aus dem Fund, Kampagnen-Karte | ~0,5 Bautag |
| E7 | Versand (optional) | Druckdienst-API mit AVV statt selbst drucken | ~0,5–1 Bautag |

Erster Lauf im Kleinen: E0–E4 (ohne öffentliche Seite) reicht für einen Testballon mit 20 Briefen; Antwort dann per Anruf/Mail an uns.
Alles nur additiv (Live-Daten), Update-Probe mit Altbestand, Hochladen nur auf Kevins Wort.

---

## 9. Offene Entscheidungen für Kevin

| # | Frage | Empfehlung |
|---|---|---|
| E1 | Erstkontakt-Kanal | Brief mit QR (+ Besuch für Top-Funde) |
| E2 | Datenquelle | OpenStreetMap + PageSpeed (+ optional Web-Suche für Funde ohne Website-Angabe) |
| E3 | Volumen je Abend | 20 zum Start (Freigabe bleibt machbar), später 50 |
| E4 | Produkt und Preis | Einmalig + monatlicher Betrieb |
| E5 | Vorschau-Art | Private Seite über QR; Bild im Brief später |
| E6 | Freigabe | Sammelfreigabe je Abend mit Einzel-Häkchen |
| E7 | Absender/Marke | — (Kevins Wahl) |
| E8 | Branchen zum Start | Gastro zuerst |
| E9 | Druck | Selbst drucken zum Testballon, Druckdienst ab Masse |
| E10 | Segment für Firmen ohne Person | Segment-Kriterium wirkt auch auf Firmen |

---

## Quellen

- IHK München — Marketing per E-Mail, Telefon, Brief: https://www.ihk-muenchen.de/ratgeber/recht/werbung-fairer-wettbewerb/marketing-per-email-telefon-brief-etc/
- IHK Nordwestfalen — Werbung per Telefon, Brief oder E-Mail: https://www.ihk.de/nordwestfalen/recht/rechtsthemen/wettbewerbsrecht/werbung-per-telefon-brief-oder-e-mail-3614212
- IHK Ostwestfalen — Verteilung und Platzierung von Werbung (Briefwerbung): https://www.ostwestfalen.ihk.de/fileadmin/Dokumente/Recht/Merkblaetter-Recht/Verteilung_und_Platzierung_von_Werbung.pdf
- BGH I ZR 27/08 (11.03.2010), mutmaßliche Einwilligung bei Telefonwerbung gegenüber Unternehmen: https://rewis.io/urteile/urteil/kd2-10-03-2010-i-zr-2708/
- BGH — Angabe der E-Mail-Adresse auf der Website ist keine Einwilligung (Bericht): https://www.wbs.legal/medienrecht/bgh-keine-einwilligung-zur-e-mail-werbung-durch-angabe-der-e-mail-adresse-bei-den-kontaktdaten-auf-einer-internetseite-8907/
- Art. 14 DSGVO, Fristen (LDA Brandenburg, Handreichung): https://www.lda.brandenburg.de/sixcms/media.php/9/Handreichung_Informationspflichten.pdf
- DSK-Kurzpapier Informationspflichten: https://WWW.UNI-LEIPZIG.DE/fileadmin/ul/Dokumente/190508_DSK_Informationspflichten_bei_Dritt-_und_Direkterhebung.pdf
- OSM Licence and Legal FAQ (ODbL, kommerziell erlaubt): https://osmfoundation.org/wiki/Licence_and_Legal_FAQ
- Overpass API, Nutzungsgrenzen der öffentlichen Instanz: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- FOSSGIS-Nutzungsbedingungen (overpass-api.de): https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen
- Google Maps Platform — Service Specific Terms (Places: Speichern nur place_id, lat/lng 30 Tage): https://cloud.google.com/maps-platform/terms/maps-service-terms
- Google Maps Platform — Preise (Text Search Enterprise): https://developers.google.com/maps/billing-and-pricing/pricing
- PageSpeed Insights API, Kontingent (Drittquelle, im Cloud-Konsole prüfen): https://unlighthouse.dev/learn-lighthouse/pagespeed-insights-api/rate-limits
- Handelsregister, 60 Abrufe/Stunde (Drittquelle): https://github.com/bundesAPI/handelsregister

Nicht abschließend belegt (als Annahme markiert): Kontaktformular = elektronische Post; aktueller Wortlaut von Google ToS 3.2.3
(nur über Sekundärquellen gelesen); Porto/Dialogpost-Preise 2026; PageSpeed-Kontingent laut Google-Konsole.

---

## Umsetzung (30.10.2026 abends, Branch `homepage-funnel`, Basis origin/main bbf5f652 — nur lokal)

Kevin: „okay bau es sauber in make os ein und baue alles zusammen was zusammen muss mit agenten etc das das alles laufen kann“.

| Plan | Gebaut als |
|---|---|
| Fund-Kern (E1) | `lib/funde/{typen,speicher,osm,bewertung,web}.ts` — Bestand `kampagne-funde--<haushalt>`, OSM/Overpass je Gebiet + Branche, Website-Check ohne KI, PageSpeed mit `PAGESPEED_API_KEY` |
| Abendlauf + Ansicht (E2) | `lib/funde/lauf.ts` (Takt ab 20 Uhr, `KI_LAEUFE`, Agent „funde“), Markttraktion › Marketing › **Homepage-Funde** (`components/os/crm/marketing/Funde.tsx`), Playbook `homepage-funde` (Kanal „mix“) |
| Vorschau (E3) | `lib/funde/vorschau.ts` — Vorlage je Branche, KI-Texte über das KI-Tor (Rückfall Regelwerk), intern `/api/crm/funde/vorschau`, öffentlich `/vorschau/v1-…` erst nach Freigabe |
| Entwurf + Freigabe (E4) | `lib/funde/entwurf.ts` (Mail aus Vorlage, keine KI, Art.-14-Hinweis, Abmeldelink, Anruf-Leitfaden), Stapel-Art `fund` → Kontakt + Firma + Lead + Kampagne + Segment `seg-homepage-funnel` + Follow-up |
| Versand (Kevins Wahl) | nur mit Schalter **„Mail senden (eigenes Risiko)“** (Inhaber, Rückfrage, Vorgabe aus), nur aus der Sitzung, über die Inbox (`inboxSenden`), je Betrieb genau eine Mail; Anruf als Follow-up nach 3 Tagen |
| Fund von Hand | „Fund von Hand“ in der Ansicht (für Betriebe, die man z. B. auf Google Maps sieht — MAKE OS fragt Google nicht ab) |
| Recht/Register | Speicher-Register, Art. 15/17, Löschfrist `kampagne-funde` (21 Tage), Routen-Register, Middleware `VORSCHAU_OFFEN`, Konto-Daten |
| Demo/Doku | Demo-Saat (3 erfundene Funde), „Was ist neu“ `u-2026-11-01`, UPDATES.md, CLAUDE.md, Tests `tests/funde.test.ts` |

**Nicht gebaut (bewusst, später):** Brief-Serienbrief/Druckdienst (E7), Bild der Vorschau im Brief, Web-Suche für Funde ohne Website-Angabe, Kennzahl-Kachel im Traktions-Index,
Produktkarte „Website“ (Instanz-Daten — Kevin legt sie im Katalog an). **Vor dem ersten Versand:** anwaltlich prüfen lassen (Risiko-Hinweis bleibt sichtbar).

---

## Persona Berlin + Segment-Recherche (31.10.2026, mit Kevin festgelegt)

**Persona:** inhabergeführte **Restaurants & Cafés** in der **Berliner Innenstadt** (Mitte, Friedrichshain-Kreuzberg, Pankow mit Prenzlauer Berg,
Neukölln) — **halb ohne eigene Website, halb mit toter oder unsicherer Seite**; nur Betriebe mit veröffentlichter Mail-Adresse (Kanal Mail, Kevin 30.10.).
Keine Ketten, keine Restaurants in Häusern mit eigener Website (Hotel, Museum).
**Angebot:** die Homepage-Pakete der Website — **Landing 2.990 €** (10 Werktage), **Story 4.990 €** (15 Werktage), **Cinematic 9.990 €** (25 Werktage),
netto, einmalig; Hosting/Domain beim Kunden. Für die Persona führt Landing; die Produktkarte(n) legt Kevin im Katalog an, die Mail nennt das gewählte Produkt.

**Segment gemessen (OpenStreetMap, 31.10.):**

| Bezirk | Gastro gesamt | Restaurants & Cafés | mit eigener Website | ohne Website-Angabe | mit Mail | mit Telefon |
|---|---|---|---|---|---|---|
| Mitte | 2.272 | 1.394 | 712 | 682 | 212 | 557 |
| Friedrichshain-Kreuzberg | 1.876 | 1.132 | 548 | 584 | 179 | 456 |
| Pankow | 1.230 | 772 | 410 | 362 | 96 | 349 |
| Neukölln | 1.079 | 548 | 211 | 337 | 82 | 184 |
| **Summe** | **6.457** | **3.846** | **1.881 (49 %)** | **1.965 (51 %)** | **569 (15 %)** | **1.546 (40 %)** |

**Was die Prüfung der Websites zeigt (Stichprobe 225 Seiten mit Mail):** die meisten sind technisch ordentlich (HTTPS + Handy) — „schlecht“ heißt in
Berlin vor allem **tot oder unsicher**: Domain weg, Zertifikat ungültig, kein HTTPS, Fehlerseite. Rund jede achte geprüfte Seite fällt darunter.
Ohne PageSpeed-Schlüssel misst der Lauf keine Ladezeit — mit `PAGESPEED_API_KEY` kämen langsame Seiten dazu. „Ohne Website laut OSM“ ist oft nur eine
Lücke in OSM: die Recherche prüft deshalb die Domain der Mail-Adresse (eigene Domain mit Seite → wie eine Website bewertet; Freemail → wahrscheinlich
keine Seite). **Wichtigste Engstelle: nur 15 % haben eine veröffentlichte Mail** — der Rest ist nur per Telefon/Besuch erreichbar.

**Die 50 (Recherche 31.10.):** 25 mit toter/unsicherer Seite (7 Domain weg, 6 Zertifikat ungültig, 6 kein HTTPS, 4 nicht erreichbar, 2 Fehlerseite),
25 ohne eigene Website (20 nur Freemail, 5 Domain ohne Seite); 34 Restaurants, 16 Cafés; Mitte 16, Friedrichshain-Kreuzberg 18, Pankow 10, Neukölln 6.
Datei: `~/Desktop/Homepage-Funde Berlin 2026-10-31.json` (Instanz-Daten — nie ins Repo) → nach dem Upload unter Homepage-Funde „Funde importieren (Datei)“.

**Im Code nachgeschärft (aus der Recherche):** Overpass-Grenze 1.000 → 5.000 Treffer je Abfrage + zwei Wiederholversuche bei 429/502/503/504;
Bot-Sperre (401/403/429) ist KEIN Mangel (vorher fälschlich „nicht erreichbar“); eigener Satz für tote Domain und kaputtes Zertifikat; NAT64-Adressen
(DNS64-Netze) nach eingebetteter IPv4 geprüft; Unterseiten fremder Häuser (Hotel, Museum) sind kein Fund; Persona-Filter „nur Restaurants & Cafés“ und
„nur mit Mail-Adresse“ in den Einstellungen; Import einer Funde-Datei (nur Inhaber, ≤ 200).

**Anreicherung (31.10. abends, Kevin: „alle Informationen, sonst keine Akquise“):** je Betrieb nur selbst veröffentlichte bzw. gesetzlich
veröffentlichte Angaben — OSM-Tags, Startseite/Impressum, Websuche (Lieferdienst-Impressum, Handelsregister), jeweils mit Quelle am Fund.
Ergebnis: 48 Funde (2 raus: einer dauerhaft geschlossen, einer hat doch eine erreichbare Website) · Mail 48 · Telefon 39 · Adresse 46 · Website 24 ·
**Inhaber/Betreiber 10** (davon 5 aus OSM „operator“ — Gemeinschaftswissen, deshalb ohne Namens-Anrede in der Mail) · **Instagram 7**.
**Befund:** Bei genau dieser Persona (keine bzw. tote Website) fehlt meist das Impressum — Inhaber stehen dann nirgends öffentlich und maschinenlesbar.
Lieferdienst-Impressen (Lieferando, Wolt) laden nur per JavaScript. Der Inhaber kommt deshalb im Anruf/Besuch („Wer ist der Inhaber?“) — der Anruf-
Leitfaden fragt danach. Instagram-Nachrichten sind elektronische Post (Ampel rot) — das Profil dient nur zur Vorbereitung.
Software: `Fund.inhaber`/`inhaberArt`/`instagram`/`quellen` (Import, Ansicht, Übernahme → Name des Kontakts bzw. Notiz „Instagram: @…“, Mail mit
Namens-Anrede nur bei Inhaber aus einer Anbieterkennzeichnung), „geschlossen“ wird beim Import übersprungen.

**Telefon zuerst (31.10. spät, Kevin: „wir werden sie anrufen … am besten Handynummern, vom Scoring besser“):** Erreichbarkeit als eigenes Scoring
(`lib/funde/telefon.ts`: Handy 100 · Festnetz 60 · nur Mail 25 · nichts 0), die Liste sortiert danach, dann nach Website-Bedarf. Handy = deutsches
Mobilnetz (+49 15x/16x/17x), nur vom Betrieb selbst veröffentlicht (OSM `phone`/`mobile`, `tel:`-Links der Website, Impressum); Übernahme legt sie
ins Handy-Feld des Kontakts. Neuer Persona-Filter „Nur mit Telefonnummer“. **Segment:** 3.847 Restaurants & Cafés, 1.569 (41 %) mit Nummer, Handynummern
sind selten veröffentlicht. **Neue Auswahl (ersetzt die 48):** 50 Betriebe, 45 mit Handy + 5 Festnetz, je Bezirk 12–13; 37 laut Verzeichnis ohne Website
(der Anruf-Leitfaden sagt: vorher kurz selbst suchen), 13 mit toter/unsicherer Seite; Mail 9, Instagram 5, Inhaber 2 (aus OSM — im Gespräch erfragen).
Datei wie bisher `~/Desktop/Homepage-Funde Berlin 2026-10-31.json` (überschrieben, Format v2).

**Erweitert auf 200 (31.10. spät, Kevin: „erweitere die Liste auf 200 in Berlin“):** alle 12 Bezirke, gleiche Regeln (Restaurants & Cafés, Nummer
Pflicht, Handy zuerst, keine/kaputte Website, höchstens 24 je Bezirk); die bisherigen 50 bleiben. **Berlin gesamt (OSM):** 7.115 Restaurants & Cafés,
3.160 (44 %) mit Nummer, 411 (6 %) mit Handynummer. **Die 200:** Handy 139 · nur Festnetz 61 · Mail 39 · Inhaber 20 · Instagram 18 · 141 laut Verzeichnis
ohne Website, 59 mit toter/unsicherer Seite. Bezirke: Mitte 24, Friedrichshain-Kreuzberg 24, Pankow 24, Charlottenburg-Wilmersdorf 24, Neukölln 23,
Tempelhof-Schöneberg 21, Steglitz-Zehlendorf 14, Treptow-Köpenick 12, Lichtenberg 12, Reinickendorf 9, Spandau 8, Marzahn-Hellersdorf 5.
Datei (Format v3, 124 KB) besteht die Import-Prüfung vollständig; 200 ist genau die Höchstzahl je Import-Datei.

---

## Analyse: Restaurants & Cafés MIT Website unter unserem Niveau (31.10.2026 spät)

Kevin: „saubere Analysen über die, die auch eine Homepage haben, die aber maximal unter dem Niveau ist, was wir anbieten“.

**Maßstab** = unser Paket „Homepage Landing“ (in 5 Sekunden verständlich, mit einem Klick anfragen, Handy, Ladezeit, Suche inkl. strukturierte Daten,
Impressum/Datenschutz, ohne Tracking) + was Gäste suchen (Speisekarte als Seite, Öffnungszeiten, Reservierung, Telefon zum Antippen, Adresse/Karte).
Baustein `lib/funde/analyse.ts` (rein, getestet): **Niveau 0–100** (100 = unser Standard) aus Technik 35 · Gäste 35 · Auffindbarkeit 15 · Recht 15, Gestaltung
(1–5) mit 30 %; Lücken in Sätzen + drei Gesprächsaufhänger. „Unter Niveau“ = Niveau < 55 oder Gestaltung ≤ 2.

**Vorgehen (drei Stufen):**
1. Alle Restaurants & Cafés in Berlin mit Telefon und eigener Website (ohne Ketten-Domains): **1.935 Startseiten** gelesen und bewertet — Niveau im Median 74
   (Viertel unter 61). Querschnitt: HTTPS 90 %, Handy-tauglich 92 %, Speisekarte 62 % (nur PDF 8 %), Reservierung 66 %, Öffnungszeiten 57 %, Telefon antippbar
   41 %, strukturierte Daten 33 %, Meta-Beschreibung 57 %, Google Fonts extern 24 %, Tracker 25 %, Impressum 83 %, Datenschutz 78 %.
2. Die 120 schwächsten in Chrome gemessen (Handy, Slow-4G, CPU ×4 wie Lighthouse): Ladezeit, Gewicht, Screenshot. Ohne PageSpeed-Schlüssel lokal gemessen.
3. Gestaltung am Handy-Screenshot beurteilt (Raster 1–5); 33 leere Aufnahmen ohne Drosselung neu aufgenommen — 17 blieben leer und zählen als „nicht
   beurteilbar“ (nie als schlecht).

**Bereinigt:** 5 standen schon in der 200er-Liste, 7 Websites gehörten gar nicht zum Betrieb (falscher Eintrag im Verzeichnis — jetzt auch im Code geprüft:
`seitePasstZumNamen`, Abendlauf), Bot-Sperren und weiße Seiten nie als Mangel.

**Ergebnis: 87 Betriebe deutlich unter unserem Niveau** (Median 24 von 100): 25 zeigen gar keinen eigenen Inhalt (Platzhalter, Parkseite, Fehler, Wartung),
62 sind echte, aber schwache Seiten. Häufigste Lücken der 62: Telefon nicht antippbar 100 % · keine strukturierten Daten 100 % · nicht für Handys 90 % · keine
Reservierung 90 % · Impressum/Datenschutz fehlt 90 % · keine Speisekarte 81 % · keine Öffnungszeiten 81 % · Gestaltung veraltet 77 % · Titel/Beschreibung
fehlen 77 % · kein HTTPS 77 %. Kontakt: Telefon alle 87 (Handy 10), Mail 43, Inhaber 15 (11 aus dem Impressum), Instagram 5.
Bezirke: Friedrichshain-Kreuzberg 17, Charlottenburg-Wilmersdorf 16, Pankow 12, Mitte 11, Tempelhof-Schöneberg 11, übrige 2–4.

**Dateien (nur auf Kevins Mac, nie im Repo):** `~/Desktop/Homepage-Funde Berlin – Websites unter Niveau 2026-10-31.json` (Import, mit `analyse` je Fund) und
`… .csv` (zum Telefonieren: Name, Bezirk, Handy, Telefon, Mail, Inhaber, Website, Niveau, Gestaltung, Ladezeit, drei Aufhänger; Handy zuerst).
**Im Code:** `Fund.analyse` (Import, Ansicht „Niveau x/100“ + Lücken, Mail nennt die zwei stärksten Aufhänger, Anruf-Leitfaden alle drei), Abendlauf analysiert
erreichbare Seiten genauso (mit PageSpeed-LCP, wenn `PAGESPEED_API_KEY` gesetzt ist) und nimmt „unter Niveau“ als Fund.
