# Fakten: Bank-Anbindung für MAKE OS (Kontostände + Umsätze)

Stand: 08.10.2026 · **alle Quellen abgerufen am 08.10.2026** · Hinweis, keine Rechts- oder Steuerberatung.
Anlass: Kevin 08.10.: „Bank-Anbindung auf Oktober vorziehen.“ (ROADMAP_Q4.md › Lücken des Business Couples, Punkt 1)
Kennzeichnung: **belegt** = Primärquelle (Anbieter-Doku, Preisseite, Vertrag, Gesetz, BaFin/EU) · **nicht belegt** = in keiner Primärquelle gefunden ·
**Einschätzung** = eigene Schlussfolgerung aus belegten Teilen (vor Entscheidung bestätigen lassen).

---

## 0. Kurzfassung

- **finAPI geht für den Oktober** — als Direktkunde (Unternehmen, Online-Bestellung, KYC-Prüfung), Sandbox 30 Tage kostenlos. Zwei Wege:
  **(A) Access B2X + PSD2-Lizenz (KID) über finAPI, Web Form 2.0** — jede Kontoinhaberin/jeder Kontoinhaber (GmbH, UG, Kevin, Malin) schließt im
  Web Form selbst einen Vertrag mit finAPI. Listenpreis 100 € + 200 € = **300 €/Monat netto** (+ 20 € Batch), **24 Monate Mindestlaufzeit**.
  Derselbe Weg trägt später die Kunden-Instanzen. **(B) „Access für Eigenanwender“** 200 €/Monat, max. 10 Eigenkonten, keine PSD2-Lizenz nötig —
  aber nur „eigene Konten“; ob Konten anderer Gesellschaften und privater Personen dazuzählen, ist **nicht belegt** (Frage an finAPI).
- **Einwilligung:** EU-Recht erlaubt seit 25.07.2023 Abruf ohne neue SCA bis **180 Tage**; finAPI-Doku nennt weiter **90 Tage** als Fall für neue
  Freigabe. Planen mit „alle 90 Tage, oft erst nach 180“ und einer Erinnerung in MAKE OS.
- **Hintergrund-Abruf:** ohne Nutzer höchstens **4× in 24 h** (RTS Art. 36 Abs. 5); bei finAPI 1× täglich im Vertrag enthalten, bis 4× mit Add-on
  Batch (20 €/Monat). Webhooks nur mit Batch-Updates.
- **Alternativen fallen für Oktober weg:** GoCardless Bank Account Data (Neuanmeldung gesperrt), Tink Standard (nur Privatkonten; Firmenkonten nur
  Enterprise über Vertrieb), Yapily/Salt Edge (nur über Vertrieb, keine Preise). **FinTS direkt** geht nur für Eigennutzung (Produktregistrierung
  10–15 Werktage, TAN, PIN auf dem Server) und nie für Kunden. **Bank-eigene APIs** (Qonto, Revolut Business ab „Grow“, Kontist) sind ein guter
  Zusatz, wenn ihr diese Banken nutzt. **CAMT/CSV-Import** als Übergang (N26-PDF/CSV-Import für den Haushalt gibt es schon).
- **Recht:** Für Eigennutzung braucht ihr keine eigene BaFin-Registrierung (finAPI-Preisseite: „Eigenanwender benötigen rechtlich keine PSD2 Lizenz“).
  Für Kunden: keine eigene Registrierung, **wenn** MAKE den Kontoinformationsdienst nicht selbst verspricht, nie Bank-Zugangsdaten sieht und der
  Kunde einen eigenen Vertrag mit dem lizenzierten Dienst hat (BaFin-Merkblatt ZAG, B. VII) — genau das Web-Form-Modell von finAPI. **Einschätzung**,
  vor Kundenstart anwaltlich bestätigen.

---

## 1. Regeln, die für jeden Anbieter gelten (PSD2/RTS)

| Regel | Inhalt | Quelle |
|---|---|---|
| Abruf ohne Nutzer | Kontoinformationsdienst darf ohne aktive Anforderung des Nutzers „maximal viermal innerhalb von 24 Stunden“ zugreifen, außer höhere Frequenz ist vereinbart und der Nutzer stimmt zu. **belegt** | Delegierte VO (EU) 2018/389, Art. 36 Abs. 5 lit. b — https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32018R0389 |
| 90 → 180 Tage | Neuer Art. 10a: Bei Zugriff über einen Kontoinformationsdienst (Saldo + Umsätze der letzten 90 Tage) **darf** die Bank keine SCA verlangen — außer beim ersten Zugriff und wenn mehr als **180 Tage** seit der letzten SCA über diesen Dienst verstrichen sind; Ausnahme bei begründetem Betrugsverdacht (Abs. 3). Gilt ab **25.07.2023**. **belegt** | Delegierte VO (EU) 2022/2360 — https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2360 |
| alte Fassung | Art. 10 Abs. 2 lit. b: SCA, wenn „mehr als 90 Tage“ seit dem letzten Zugriff verstrichen sind. **belegt** | VO 2018/389 (Link oben) |
| Bank-Praxis | N26: Drittanbieter haben „for a maximum of 180 days“ Zugriff, dann neue Einwilligung. **belegt** (N26) | https://support.n26.com/en-eu/security/open-banking-psd2/psd2-and-secure-open-banking |
| Dedizierte Schnittstelle | Drittdienste müssen „grundsätzlich die … bereitgestellten Kontozugangsschnittstellen“ nutzen; Einbetten der Bank-Authentifizierung in die eigene Domain gilt als „non compliant“. Aufsichtsmitteilung vom 09.10.2024, geändert 02.05.2025. **belegt** | BaFin — https://www.bafin.de/SharedDocs/Veroeffentlichungen/DE/Aufsichtsmitteilung/2024/Aufsichtsmitteilung_zu_PSD2_Kontozugangsschnittstellen.html |
| Historie | Manche Banken geben die volle Umsatzhistorie nur in den ersten **5 Minuten** nach der Einwilligung heraus, danach nur 90 Tage (Revolut-Open-Banking-API; Yapily: Banken begrenzen „to as little as 5 minutes“). **belegt** für Yapily (Seite abgerufen); Revolut nur **laut Suchergebnis** (Seite nicht selbst abgerufen) → beim ersten Verbinden sofort die ganze Historie holen. | https://docs.yapily.com/data/financial-data-resources/financial-data-consents · https://developer.revolut.com/docs/api/open-banking#get-accounts-account-id-transactions |
| Was kommt | PSR (Verordnung) + Änderung PSD2 („PSD3“): vorläufige Einigung 27.11.2025 (u. a. **Dashboard für Datenzugriffe**, Liste verbotener Hindernisse); Coreper-Bestätigung 22.04.2026; förmliche Annahme/Amtsblatt **nicht belegt**. | Rat: https://www.consilium.europa.eu/en/press/press-releases/2025/11/27/payment-services-council-and-parliament-agree-to-step-up-the-fight-against-fraud-and-increase-transparency/ · EP: https://www.europarl.europa.eu/news/en/press-room/20251121IPR31540/payment-services-deal-more-protection-from-online-fraud-and-hidden-fees · Rat-Dok. 13589/26 (02.10.2026): https://data.consilium.europa.eu/doc/document/ST-13589-2026-INIT/en/pdf |

---

## 2. finAPI (der bisherige Plan)

### 2.1 Unternehmen, Lizenz, Eigentümer
- finAPI GmbH, Adams-Lehmann-Str. 44, 80797 München; „von der BaFin … für Kontoinformationsdienste und Zahlungsauslösedienste lizenziert und
  registriert“. **belegt** — SaaS-Basisvertrag (Fassung 20.05.2026), Präambel + Ziff. 2.1:
  https://www.finapi.io/wp-content/uploads/2026/05/20260520_SaaS_Vertrag_online-version.pdf
- Registrierter Kontoinformationsdienst + lizenzierter Zahlungsauslösedienst; **Fabrick S.p.A. (Gruppe Sella) hält seit Juni 2025 75 %** (vorher
  SCHUFA-Mehrheit seit 2019). TÜViT-Zertifikat „Trusted Site Privacy“ (2022). **belegt** — https://www.finapi.io/en/about-finapi/about-us/
- Eintrag im BaFin-ZAG-Register selbst **nicht abgefragt** (vor Vertrag prüfen: https://www.bafin.de/DE/die-bafin/publikationen-daten/datenbanken-uebersichten/zahlungsinstitute-register/register-zahlungsinstitute_node.html).

### 2.2 Produkte
- **Access (Banking-API)**: B2C = nur Privatkonten, **B2X = Privat- und Geschäftskonten**. **belegt** — https://www.finapi.io/en/prices/
- **Web Form 2.0**: einbettbares Formular, in dem der Nutzer Bank wählt, sich anmeldet, SCA macht, Konten auswählt; „you always integrate with the
  2.0 product“ (2.1 = neue Oberfläche darauf). **belegt** — https://documentation.finapi.io/webform/web-form-documentation-2-0-2-1 ·
  https://documentation.finapi.io/webform/ais-flows
- Ohne eigene Erlaubnis ist das Web Form **Pflicht** für Import/Update/Bearbeiten von Bankverbindungen. **belegt** — https://documentation.finapi.io/webform/
- Data Intelligence (Berichte, Kategorisierung „Labeling Service“), Payments, KYC (GiroIdent) — für MAKE OS nicht nötig (eigene Einordnung in
  `lib/finanzen/haushalt/einordnung.ts`). Preise: §2.8.

### 2.3 Ablauf einer Bank-Verbindung
1. Server erzeugt das Web Form über die API mit dem Token des finAPI-Nutzers → Formular-Adresse. 2. Nutzer öffnet sie (eingebettet oder per URL/QR).
3. Bank wählen · 4. bei der Bank anmelden · 5. **SCA** · 6. Konten wählen (optional) · 7. Daten laden → `COMPLETED`. **belegt** —
   https://documentation.finapi.io/webform/ais-flows
- SCA-Arten: Verfahren wählen, TAN, Freigabe in der Banking-App (decoupled), Weiterleitung zur Bank. **belegt** — https://documentation.finapi.io/webform/flows
- Formulare, die über 20 Minuten nicht abgeschlossen werden, verfallen. **belegt** (laut Suchergebnis zur Web-Form-Doku; Einzelseite nicht abgerufen)
- Alte Doku (Web Form v1): Öffnen im iFrame sei vom deutschen Regulierer nicht erlaubt. Web Form 2.0 spricht von „embedding with the loader“ —
  **Widerspruch, nicht geklärt**; die BaFin-Aufsichtsmitteilung (§1) verbietet das Einbetten der *Bank*-Authentifizierung in die eigene Domain.
  Quellen: https://documentation.finapi.io/access/web-form-v1 · https://documentation.finapi.io/webform/web-form-documentation-2-0-2-1
- Ergebnis kommt per Callback an eine URL aus der Anfrage (statt Abfragen). **belegt** — https://documentation.finapi.io/access/update-a-bank-connection-for-web-form-2-0-customer
- Direkt nach dem Import (`IN_PROGRESS`) können Salden noch fehlen; je Konto `UPDATED` = alles geladen. **belegt** —
  https://documentation.finapi.io/access/post-processing-of-bank-account-import-update
- Schnittstellen je Bank: XS2A (PSD2, meist nur Zahlungskonten), FinTS (auch Spar-/Kreditkonten; Zahlungskonten über FinTS nach der
  „market probation“ gesetzlich nicht mehr), Web-Scraper (nur Rückfall). Welche Bank was kann: `GET /banks`. **belegt** —
  https://documentation.finapi.io/access/interfaces

### 2.4 Gültigkeit der Einwilligung und Erneuerung
- finAPI: Erneute Anmeldung/zweiter Faktor kann nötig sein, „if the last authorization at the bank was performed more than **90 days** ago“; dann
  Status `WEB_FORM_REQUIRED` → Nutzer ins Web Form schicken. **belegt** — https://documentation.finapi.io/access/update-a-bank-connection-for-web-form-2-0-customer
- Abgelaufene XS2A-Einwilligung: nächstes Batch-Update scheitert, Flag **`userActionRequired = true`**; erst nach neuer Einwilligung über
  `updateBankConnection` (ohne Lizenz: Web Form) laufen Batch-Updates weiter. **belegt** — https://documentation.finapi.io/access/possible-reasons-for-failing-batch-updates
- **Ob finAPI die 180 Tage aus Art. 10a nutzt: nicht belegt** (keine finAPI-Aussage gefunden). Rechtlich möglich ab 25.07.2023 (§1); die Bank
  entscheidet die Umsetzung. → In MAKE OS: Ablauf aus dem Status lesen, nie fest rechnen; Glocke „Bank neu freigeben“ bei `userActionRequired`.
- Zum Vergleich: Tink-Doku Geschäftskonten „90 days (which is the maximum consent time)“; Tink-PSD2-Einführung „up to 180 days“ (siehe §3).

### 2.5 Abruf ohne Nutzer (Hintergrund)
- „PSD2 limits updates outside the user present scenario to a maximum of 4 updates per day“; ohne mitgeschickte Nutzer-Metadaten (IP, Gerät,
  User-Agent) zählt jede Anfrage gegen dieses Limit. Mit Nutzer: unbegrenzt. **belegt** — https://documentation.finapi.io/access/update-a-bank-connection-for-web-form-2-0-customer
- Add-on **Batch**: finAPI aktualisiert selbst bis **4×/Tag**, „fully automated“, Freischaltung über support@finapi.io. **belegt** —
  https://documentation.finapi.io/access/automated-update-of-the-bank-data-batch-updates
- Preisliste: „1 automated update per day is included in the contract“; Batch (bis 4×/Tag) gilt für XS2A- und FinTS-Verbindungen. **belegt** — https://www.finapi.io/preise/
- Batch-Updates verlangen ggf. eine **bei finAPI gespeicherte PIN** (Grund 1 für fehlgeschlagene Batch-Updates: „has not stored his banking PIN“).
  **belegt** — https://documentation.finapi.io/access/possible-reasons-for-failing-batch-updates (gilt vermutlich für FinTS-Verbindungen — **nicht belegt**)

### 2.6 Webhooks
- Benachrichtigungsregeln mit Auslösern u. a. `NEW_TRANSACTIONS`, `NEW_ACCOUNT_BALANCE`, `BANK_LOGIN_ERROR`, `LOW_ACCOUNT_BALANCE`,
  `HIGH_TRANSACTION_AMOUNT`; Ziel `userNotificationCallbackUrl` je Regel. **Nur mit Batch-Updates** („Notifications are available only when the
  client is set up for batch updates“). Felder wie Kontoname/IBAN/Details kommen **verschlüsselt** (Entschlüsseln mit dem Daten-Schlüssel des
  Clients). Eine **Signatur der Webhooks** und Wiederholungen beschreibt die Seite **nicht**. **belegt** (bzw. „nicht beschrieben“) —
  https://documentation.finapi.io/access/push-notifications-web-hooks
- `NEW_TRANSACTIONS` mit `includeDetails=true`: bis 100 Umsätze je Nachricht (id, Buchungsdaten, Betrag, Gegenpartei Name/IBAN, Verwendungszweck,
  Kategorie). **belegt** (gleiche Seite, laut Suchergebnis)
- **Folge (Einschätzung):** Webhook nur als „Anstoß“ werten, Daten immer über die API nachladen (wie bei WhatsApp/WHOOP); Absicherung über geheime
  Kennung in der Callback-URL, weil keine Signatur belegt ist.

### 2.7 Datenformat
- Umsätze: Buchungstag, Valuta, Betrag, Gegenpartei (Name, IBAN), Verwendungszweck, Kategorie (bei aktivierter Auto-Kategorisierung,
  `isAutoCategorizationEnabled`). **belegt** über das Webhook-Format (§2.6); vollständiges Schema nur in der OpenAPI-Doku
  https://docs.finapi.io/?product=access (**nicht einzeln geprüft**).
- Salden: je Konto nach dem Laden. **belegt** (§2.3); Feldnamen **nicht geprüft**.
- Kategorien: Hintergrundprozess, Feld bis `READY` (PFM-Add-on). **belegt** — https://documentation.finapi.io/access/post-processing-of-bank-account-import-update

### 2.8 Preise (Preisliste ohne Datum; netto zzgl. USt) — https://www.finapi.io/preise/ · https://www.finapi.io/en/prices/
| Posten | Preis/Monat | Hinweis |
|---|---|---|
| Access B2C, bis 200 Nutzer | 60 € | nur Privatkonten |
| **Access B2X, bis 200 Nutzer** | **100 €** | Privat + Geschäft; 201–1.000 Nutzer 500 €, dann ab 0,50 €/Nutzer |
| Add-on Batch, bis 200 Nutzer | 20 € | bis 4 Updates/Tag; 1/Tag im Vertrag enthalten |
| Add-on International | 20 € | weitere Länder (eins enthalten) |
| **PSD2-Lizenz KID (über finAPI), bis 200 Nutzer** | **200 €** | „inkl. Web Form“; je weitere 100 Nutzer +100 €, ab 901: 1.000 € |
| **Access für Eigenanwender (max. 10 Eigenkonten)** | **200 €** | „Eigenanwender benötigen rechtlich keine PSD2 Lizenz“; ob B2X und Batch enthalten: **nicht belegt** |
| Demobank / Lite | 249 € / 99 € | nicht nötig |
- „Nutzer“ = eindeutige User-ID; **Anzahl der Konten wird nicht abgerechnet**; gelöschter Nutzer = voller Monat. **belegt** (Preisseite; AGB § 5.2)
- Wer **kein** Eigenanwender ist und keine eigene Lizenz hat, zahlt die PSD2-Lizenz **zusätzlich**. **belegt** (Preisseite)
- **Mindestumsatz:** keiner genannt. **Mindestlaufzeit: 24 Monate**, Verlängerung um 12 Monate, Kündigung 6 Monate vor Ende (SaaS-Basisvertrag
  Ziff. 9.1). Ob das auch für „Eigenanwender“ gilt: **nicht belegt** (Einschätzung: ja, gleicher Online-Vertrag). Preisanhebung während der Laufzeit
  möglich, mit Widerspruchsrecht (AGB § 5.4, Stand 07.04.2026 — https://www.finapi.io/wp-content/uploads/2026/04/Anlage-AGB.pdf).
- Rechenbeispiele (Einschätzung, Listenpreis): (A) B2X + KID = 300 €/Monat (+ Batch 320 €) → 24 Monate **7.200–7.680 € netto**.
  (B) Eigenanwender 200 €/Monat → 24 Monate **4.800 € netto**.

### 2.9 Vertrag, Direktkunde, Datenschutz, Rechenzentrum
- **Direktkunde ja:** Vertrag kommt über den Online-Bestellprozess auf finapi.io zustande („kostenpflichtig bestellen“), Kunde muss Unternehmer
  i. S. v. § 14 BGB sein; Vorbehalt **KYC-Prüfung** (GwG/aufsichtsrechtlich). **belegt** — SaaS-Basisvertrag Ziff. 2.2, 2.3, 3
- **Nutzungsrecht nur im eigenen Unternehmen**; Weitergabe an **verbundene Unternehmen** (§§ 15 ff. AktG) nur mit Anlage „Verbundene Unternehmen“.
  **belegt** — Ziff. 5.2 → relevant für GmbH/UG (Frage an finAPI).
- **Betrieb und Datenverarbeitung „ausschließlich in Deutschland, sowie in Ausnahmefällen in der EU“**, bei Vertragsschluss AWS (Amazon Web Services
  EMEA SARL), Großraum Frankfurt; Rechenzentrum ISO 27001, 27017, 27018, ISO 9001, CSA STAR (Stand 01/2023); Wechsel nach Rücksprache.
  **belegt** — Ziff. 6.4. Eigene ISO-27001-Zertifizierung von finAPI: **nicht belegt** (Über-uns-Seite nennt keine).
- Sandbox: 30 Tage kostenlos je Produkt. **belegt** — Ziff. 6.6; Anmeldung https://www.finapi.io/jetzt-testen/
- **Rollen im Datenschutz:** Der Endnutzer schließt im Web Form einen eigenen Vertrag mit finAPI über den KID („Mit der Zustimmung kommt der Vertrag
  zwischen Endnutzer und finAPI zustande“, kostenlos, Kündigung 2 Wochen, Ende nach 14 Monaten ohne Nutzung; Fassung **24.06.2019**). **belegt** —
  https://live.finapi.io/agb?version=v1.4 → Einschätzung: finAPI ist für den KID **eigener Verantwortlicher**, nicht Auftragsverarbeiter.
  Der Geschäftskunde braucht wirksame Endkunden-AGB und darf Daten nur mit Einwilligung oder gesetzlicher Erlaubnis verarbeiten (AGB § 7.1, § 7.2).
  Ein AVV wird je Produkt „ggf.“ vereinbart (Basisvertrag Ziff. 4.4) — **Inhalt nicht belegt**.

### 2.10 Banken
- 13 Länder, u. a. Deutschland; Geschäftskonten „depending on the bank, country, and interface“; **Bankliste nur auf Anfrage** beim Vertrieb.
  **belegt** — https://www.finapi.io/en/products/country-coverage/
- Für **Sparkasse, Volksbank, Deutsche Bank, Commerzbank, Qonto, N26, Kontist, Holvi, Fyrst, Revolut Business**: **nicht belegt** (keine öffentliche
  Liste). Prüfbar in der Sandbox mit `GET /banks` (§2.3). Hinweis: Qonto-Support nennt eine DATEV-Anbindung „über FinAPI (PIN/TAN)“ — nur aus
  Suchergebnis, Seite beim Abruf 403, **nicht verifiziert**.

---

## 3. Alternativen im Vergleich

| Anbieter | Für neue Kunden 10/2026 | Geschäftskonten | Lizenz für uns | Einwilligung | Preise | Bewertung |
|---|---|---|---|---|---|---|
| **finAPI** | ja, online + KYC | ja (B2X) | Web Form (finAPI-Lizenz) oder Eigenanwender | 90 Tage laut Doku (180 rechtlich möglich) | öffentlich (§2.8) | **Favorit** |
| **GoCardless Bank Account Data** | **nein** — „New signups for Bank Account Data are currently disabled.“ | – | – | – | – | entfällt |
| **Tink (Visa)** | Standard per Konsole; Preise „exclusively to our existing customers“ | Standard nur **Privatkonten**; „Business Transactions“ nur **Enterprise** | Standard: Tinks Lizenz; Enterprise: Tink oder eigene | Geschäftskonten 90 Tage (Doku); 180 Tage nur in einzelnen Ländern, DE nicht genannt | nicht öffentlich | entfällt für Oktober |
| **Yapily** | nur über Vertrieb | **nicht belegt** | „Yapily Connect“ (Yapily Connect UAB, Bank of Lithuania) | 180 Tage EWR | nicht öffentlich („Tailored pricing“) | Option für später |
| **Salt Edge** | über Vertrieb | **nicht belegt** | „Partner Program“ für Firmen ohne PSD2-Lizenz | **nicht belegt** | nicht öffentlich | Option für später |
| **Klarna (ex Kosma)** | **nicht belegt** — Doku zeigt nur Klarna als kontoführende Bank für lizenzierte Drittdienste | – | – | – | – | entfällt |
| **FinTS direkt** | ja (Registrierung DK) | je Bank (nicht belegt) | Eigennutzung keine; für Kunden nein (s. §4) | TAN „in almost all cases“ | Registrierung (Gebühr nicht genannt) | nur Eigennutzung, Rückfall |
| **Bank-eigene APIs** | Qonto, Revolut Business, Kontist | ja (nur diese Bank) | keine (eigener Zugang) | API-Schlüssel / OAuth | in Kontomodell | Zusatz je Bank |
| **CAMT/CSV-Import** | immer | ja | keine | – | 0 € | Übergang |

Quellen und Einzelheiten:
- **GoCardless:** https://bankaccountdata.gocardless.com/new-signups-disabled (Seite selbst abgerufen). Altes Produkt am 18.12.2023 eingestellt:
  https://gocardless.com/bank-account-data/announcement. **belegt**
- **Tink:** Preisseite (Standard/Enterprise, Lizenz, Privatkonten, „Business Transactions“ Enterprise) https://tink.com/pricing/ · Geschäftskonten
  90 Tage https://docs.tink.com/resources/business-transactions/continuous-access-to-a-business-account · bis 180 Tage
  https://docs.tink.com/entries/articles/introduction-to-psd2 · 180 Tage je Markt https://docs.tink.com/changelog · `SESSION_EXPIRED` ohne
  Hintergrund-Abruf https://docs.tink.com/entries/articles/credentials-status-transitions (Inhalte laut Suchergebnis). **belegt**
- **Yapily:** Preise https://www.yapily.com/pricing · Yapily Connect (Lizenz „on your behalf“) https://docs.yapily.com/tools-and-services/yapily-connect/overview ·
  180 Tage EWR https://docs.yapily.com/data/financial-data-resources/financial-data-consents. **belegt**
- **Salt Edge:** „With Salt Edge Partner Program you get instant access to aggregated EU bank data“, ISO 27001, AISP-Lizenz (Behörde nicht genannt)
  https://saltedge.com/products/spectre. **belegt**
- **Klarna:** Marke Kosma 2023 aufgegeben (Presse, keine Primärquelle); aktuelle Klarna-PSD2-Doku nur als kontoführende Bank
  https://docs.klarna.com/api/xs2a/psd2-overview/. Ein heutiges Aggregator-Produkt für Dritte: **nicht belegt**.
- **FinTS:** Seit 01.08.2019 nur noch registrierte Produkte; Formular „im Original“ an registrierung@hbci-zka.de; Nummer i. d. R. in **10–15 Werktagen**;
  Registriernummer bei jeder Dialoginitialisierung im Element „Produktbezeichnung“; Bankliste nur für registrierte Produkte. Gebühr: auf der Seite
  **nicht genannt** (Banken/Bibliotheken schreiben „kostenfrei“). https://www.fints.org/de/hersteller/produktregistrierung · „Since the implementation
  of PSD2, you will in almost all cases need to be ready to deal with TANs.“ https://python-fints.readthedocs.io/en/latest/quickstart.html ·
  TypeScript-Bibliothek `lib-fints` (PIN/TAN, decoupled TAN, CAMT, nur serverseitig wegen CORS) — nur über Paket-Spiegel geprüft, **npm-Seite selbst
  nicht abgerufen**. FinTS-Abdeckung der Neobanken (N26, Qonto, Kontist, Holvi, Revolut): **nicht belegt**.
- **Qonto Business API:** API-Schlüssel (Login + Secret, unter „Integrations and Partnerships > API key“) oder OAuth 2.0; `GET /v2/organization`,
  `/v2/bank_accounts`, `/v2/transactions`; Sandbox mit eigenem Kopf. https://docs.qonto.com/get-started/business-api/authentication/api-key ·
  https://docs.qonto.com/api-reference/business-api/transactions-statements/transactions/list-transactions. Rollen-/Tarifgrenzen: **nicht belegt**.
- **Revolut Business API:** „available to all customers on our Grow plan and above“, nur Kontoinhaber, Privatkonten ohne öffentliche API.
  https://www.revolut.com/business/business-api/ **belegt**
- **Kontist:** GraphQL-API, OAuth2-Client je Anwendung, Node-SDK. https://kontist.dev/ — Aktualität (Datum) **nicht belegt**.
- **N26:** keine Kunden-API; PSD2-Schnittstelle nur für lizenzierte Drittdienste mit QWAC. https://support.n26.com/en-eu/security/open-banking-psd2/psd2-open-banking-for-third-party-providers
  (laut Suchergebnis) **belegt**. **Holvi, Fyrst:** **nicht geprüft/nicht belegt**.
- **CAMT:** Die Deutsche Kreditwirtschaft hat das MT940-Regelwerk im **November 2025** eingestellt; camt.053 (DK-Version 3.8, Nov. 2024) ist der
  Kontoauszug. **belegt** (Bankseite OLB) — https://www.olb.de/mt940-camt. Ob jede eurer Banken CAMT im Online-Banking zum Herunterladen anbietet:
  **nicht belegt**. Im Repo existiert bereits ein Kontoauszug-Import (N26-PDF/Text, CSV) für den Haushalt: `lib/finanzen/haushalt/import.ts`.

---

## 4. Rechtliches

### 4.1 Was ist erlaubnispflichtig?
- Kontoinformationsdienste sind Zahlungsdienste (§ 1 Abs. 1 Satz 2 Nr. 8 ZAG). Definition § 1 Abs. 34 ZAG: „Online-Dienst zur Mitteilung konsolidierter
  Informationen über ein Zahlungskonto oder mehrere Zahlungskonten des Zahlungsdienstnutzers bei einem oder mehreren anderen Zahlungsdienstleistern“.
  **belegt** — https://www.gesetze-im-internet.de/zag_2018/__1.html
- Wer „im Inland gewerbsmäßig oder in einem Umfang, der einen in kaufmännischer Weise eingerichteten Geschäftsbetrieb erfordert“ ausschließlich
  Kontoinformationsdienste erbringen will, braucht eine **Registrierung** durch die BaFin (mit Berufshaftpflicht nach § 36). **belegt** —
  https://www.gesetze-im-internet.de/zag_2018/__34.html
- „Gewerbsmäßig“ laut BaFin: Betrieb „auf eine gewisse Dauer angelegt“ und „mit der Absicht der Gewinnerzielung“. **belegt** — BaFin-Merkblatt ZAG
  (Stand 07/2024), Abschnitt F — https://www.bafin.de/SharedDocs/Veroeffentlichungen/DE/Merkblatt/mb_111222_zag.html

### 4.2 Arbeitsteilung mit einem lizenzierten Dienst (das finAPI-Web-Form-Modell)
BaFin-Merkblatt ZAG, Abschnitt B. VII (Kontoinformationsdienste), **belegt** (Link oben):
- „Wird der Dienst arbeitsteilig erbracht, erfüllt derjenige nicht den Tatbestand, der nicht selbst die Kontoinformationsdienste verspricht, nicht in den
  Besitz der Kontozugangsdaten gelangt und die Kontoinformationen von einem anderen lizensierten oder registrierten Kontoinformationsdienstleister erhält.“
- „Das setzt unterdessen voraus, dass der Kontoinhaber eine eigene vertragliche Beziehung mit dem anderen … Kontoinformationsdienstleister eingeht.“
- finAPI: ohne Lizenz muss man „the minimum requirements to not process bank credentials or access banks directly“ erfüllen; dafür gibt es das Web
  Form. **belegt** — https://documentation.finapi.io/access/web-form-v1 · Endnutzer-Vertrag mit finAPI im Web Form: https://live.finapi.io/agb?version=v1.4
- **Einschätzung:** MAKE (und später jede Kunden-Instanz) braucht **keine eigene BaFin-Registrierung**, solange (1) MAKE in Texten nicht selbst einen
  Kontoinformationsdienst verspricht (Formulierung: „Kontoinformationen über finAPI, einen von der BaFin zugelassenen Kontoinformationsdienst“),
  (2) Bank-PIN/TAN **nur** im finAPI-Web-Form eingegeben werden, nie in MAKE OS, (3) jede Kontoinhaberin den finAPI-Endnutzervertrag selbst annimmt.

### 4.3 „Lizenz-Leihe“ / Agent
- „Lizenz-Leihe“ ist kein Begriff des ZAG. Ein **Agent** ist ein eigener Weg: das Institut muss der BaFin und der Bundesbank den Agenten melden
  (§ 25 Abs. 1 ZAG). **belegt** — https://www.gesetze-im-internet.de/zag_2018/__25.html. finAPI beschreibt für Kunden **kein** Agentenmodell, sondern das
  Web Form (Einschätzung aus §2.2/§4.2). Yapily nennt sein Modell „Yapily Connect … on your behalf“ (Lizenz in Litauen), Salt Edge „Partner Program“.

### 4.4 Eigennutzung
- finAPI-Preisseite: Die Lizenzpflicht „gilt nicht, wenn Kunden nur eigene Konten für unsere Dienste nutzen“; „Eigenanwender benötigen rechtlich keine
  PSD2 Lizenz.“ **belegt** — https://www.finapi.io/preise/
- **Einschätzung:** Für Kevin & Malin ist der Knackpunkt nicht die BaFin, sondern **wessen** Konten „eigene“ sind: MAKE Innovation GmbH, KD Ventures UG,
  Kevin (Einzelunternehmen + privat) und Malin sind **vier verschiedene Kontoinhaber**. Schließt nur die GmbH den Vertrag, sind die übrigen Konten
  fremde Konten (und der Vertrag erlaubt verbundene Unternehmen nur per Anlage, §2.9). Der Web-Form-Weg (jede Inhaberin mit eigenem finAPI-Vertrag)
  vermeidet die Frage vollständig.
- FinTS direkt für eigene Konten: Nutzung der Kundenschnittstelle der eigenen Bank — keine Erlaubnisfrage belegt; Pflicht ist nur die
  Produktregistrierung (§3). **Für Kunden-Instanzen nicht geeignet:** wer für andere Konten liest, ist Drittdienst → Registrierung + dedizierte
  Schnittstelle (BaFin-Aufsichtsmitteilung, §1).

### 4.5 Datenschutz (Hinweise, nicht abschließend)
- finAPI = eigener Verantwortlicher für den KID gegenüber dem Endnutzer (Einschätzung, §2.9); MAKE = Verantwortlicher für die eigenen Konten bzw.
  **Auftragsverarbeiter** der Kunden in deren Instanz (Einschätzung). finAPI verarbeitet bei AWS Frankfurt (US-Konzern) — Drittland-Garantie im
  Empfänger-Register prüfen (**nicht belegt**).
- Kontoumsätze können Rückschlüsse auf besondere Kategorien (Art. 9 DSGVO) erlauben (z. B. Arzt, Gewerkschaft, Kirche) — **Einschätzung, keine
  Primärquelle geprüft**; im Speicher-Register entsprechend einstufen.

---

## 5. Empfehlung

### (a) Jetzt — Eigennutzung Kevin & Malin im Oktober
1. **Diese Woche:** finAPI-Sandbox anmelden (kostenlos, 30 Tage) und Vertrieb anfragen (Fragen §7). In der Sandbox mit `GET /banks` jede eurer Banken
   prüfen (XS2A/FinTS, Geschäftskonto ja/nein).
2. **Weg A bestellen** (Access B2X + KID über finAPI, + Batch): Vertragspartner MAKE Innovation GmbH; im Web Form verbinden GmbH, UG, Kevin, Malin
   jeweils ihre Konten. 300–320 €/Monat netto, 24 Monate. Weg B (Eigenanwender, 200 €) nur, wenn finAPI **schriftlich** bestätigt, dass alle Konten
   dazuzählen — sonst nicht.
3. **Übergang sofort (unabhängig von finAPI):** CAMT.053-/CSV-Import je Konto ins Konten-Register (vorhandenen Haushalts-Import mitnutzen), und für
   Qonto/Revolut Business ggf. die Bank-API direkt.
4. **Aufwand (Einschätzung):** vergleichbar mit WHOOP je Person (Verbindung, Abgleich, Abbildung, Webhook, Recht, Oberfläche) — rund 4–6 Bau-Sitzungen
   inkl. Fake für Tests. Laufend: Neu-Freigabe je Bankverbindung alle 90–180 Tage (Klick + SCA in der Banking-App).
5. **Risiken:** KYC-Dauer (**nicht belegt**) kann den Oktober sprengen → CAMT-Übergang; Bank fehlt oder liefert Geschäftskonto nicht über XS2A;
   24-Monats-Bindung; Preisanhebung (AGB § 5.4); keine belegte Webhook-Signatur; Einwilligung läuft unbemerkt ab → Glocke + Status-Anzeige.

### (b) Später — Kunden-Instanzen
1. **Gleiches Modell:** MAKE ist finAPI-Geschäftskunde (Access B2X + KID), jeder Kunde (und dessen Kontoinhaber) nimmt im Web Form den finAPI-
   Endnutzervertrag an → keine eigene BaFin-Registrierung für MAKE und Kunden (Einschätzung §4.2; **vor Kundenstart anwaltlich bestätigen**).
2. **Kosten in Stufen (Listenpreis, Einschätzung aus §2.8; Konten selbst zählen nicht, nur finAPI-Nutzer):** bis 200 Nutzer pauschal 300 €
   (B2X 100 + KID 200); ab 201 Nutzern Sprung auf 800 € (B2X 500 + KID 300); bei 1.000 Nutzern rund 1.500 € (≈ 1,50 € je Nutzer und Monat);
   die KID-Stufe „ab 901“ steht mit 1.000 € in der Tabelle — ob pauschal: **nicht belegt**. Ein finAPI-Nutzer je Kontoinhaber (Einschätzung).
3. **Architektur-Frage (offen):** Die finAPI-Zugangsdaten des Clients dürfen nicht in jede Kunden-Instanz kopiert werden (Plattform-Regel „Trennung
   serverseitig“). Entweder eine kleine **Bank-Brücke** bei MAKE (hält den finAPI-Client, gibt jeder Instanz nur ihre eigenen Nutzer/Daten) oder je
   Instanz ein eigener finAPI-Client — ob finAPI mehrere Clients je Vertrag erlaubt: **nicht belegt** (Frage an finAPI). Vertrag 5.2/AGB: Unterlizenz an
   Endnutzer im Funktionsumfang — Wortlaut für Kunden-Instanzen von finAPI bestätigen lassen.
4. **Alternativen für später:** Yapily oder Salt Edge (Lizenz in Litauen bzw. Partner-Programm) als zweiter Anbieter/Verhandlungsbasis; Tink nur mit
   Enterprise. GoCardless nur, falls Neuanmeldungen wieder öffnen.
5. **Risiken:** Abhängigkeit von einem Anbieter (Eigentümerwechsel 06/2025), PSR/PSD3 ändert Einwilligungs-Regeln (Dashboard) — Umsetzungsfristen
   **nicht belegt**; Kunden brauchen Hinweis-/Datenschutztexte (finAPI verlangt wirksame Endkunden-AGB, AGB § 7.1).

---

## 6. Leitplanken für den Bau (aus CLAUDE.md abgeleitet, noch nicht gebaut)
- Verbindung **je Kontoinhaber**, nicht je Person der Sitzung: Konto → Gesellschaft/Person/gemeinsam im geplanten **Konten-Register** (ROADMAP_Q4 Punkt 2);
  Privat/Business **serverseitig** trennen (`privatFinanzZugang`, `finanzRecht: 'business'` sieht nie Privatkonten), Wächtertest „Sicht X bekommt nichts aus Y“.
- Bank-PIN/TAN nie in MAKE OS; finAPI-Client-Secret und Daten-Entschlüsselungsschlüssel nur in der Server-Umgebung (Einrichtungs-Skript wie
  `deploy/whoop-verbinden.sh`), finAPI-Nutzer-Zugangsdaten verschlüsselt im Bestand, nie an Browser/Log/Protokoll.
- Neue Bestände ins Speicher-Register (mit Rechtsgrundlage, Löschfrist, ggf. `art9`), Empfänger „finAPI“ ins AVV-/Empfänger-Register (Drittland AWS prüfen),
  VVT-Eintrag, Art. 15/17, Lese-Protokoll (`leseZugriff(…, 'finanzen')`), Routen-Register, KI-Tor-Kategorie `finanzen`, Telegram nur neutral.
- Umsätze landen über die vorhandenen Schreibwege (Buchungen, Liquidität, Rechnung „bezahlt“ als **Vorschlag**, 0-Punkt über `abEroeffnung`), nie daneben.
- Webhook = offene Route mit enger Prüfung (wie WhatsApp/WHOOP), nur Anstoß, Daten immer per API nachladen; Abgleich höchstens 4×/Tag ohne Nutzer.

---

## 7. Offene Fragen

**An Kevin (und Malin):**
1. Welche Banken nutzt ihr — je Gesellschaft (MAKE Innovation GmbH, KD Ventures UG), für die Selbstständigkeit und privat (Kevin, Malin)? Wie viele Konten
   insgesamt (Eigenanwender ist auf 10 begrenzt)?
2. Gibt es Konten bei Qonto oder Revolut Business (eigene API, ohne finAPI) — und Kreditkarten/Tagesgeld, die mit sollen (XS2A liefert meist nur
   Zahlungskonten)?
3. Ist die 24-Monats-Bindung bei finAPI (7.200–7.680 € netto für Weg A) in Ordnung? Wer ist Vertragspartner — MAKE Innovation GmbH?
4. Sollen Malins Privatkonten von Anfang an dabei sein (dann im Web Form durch Malin selbst freigegeben)?
5. Reicht für den Oktober zuerst der CAMT-/CSV-Import, falls die finAPI-KYC länger dauert?

**An finAPI (Vertrieb/Support):**
1. Gilt „Access für Eigenanwender“ für Konten **mehrerer Rechtsträger** (GmbH, UG, Einzelunternehmer, Privatpersonen) unter einem Vertrag? Enthält er B2X und Batch?
2. Nutzt finAPI die **180 Tage** nach Art. 10a (VO 2022/2360) — wie lange gilt eine Einwilligung je Bank, wie erkennt man den Ablauf vorab?
3. Welche unserer Banken (Liste aus Frage 1 an Kevin) liefern **Geschäftskonten** über XS2A/FinTS? Umsatzhistorie beim ersten Import?
4. Webhooks: Signatur/Absicherung, Wiederholungen, gilt das tägliche Gratis-Update als „Batch“ für Benachrichtigungen?
5. Gilt die 24-Monats-Laufzeit auch für Eigenanwender? Dauer der KYC-Prüfung?
6. Für Kunden-Instanzen: mehrere Clients je Vertrag möglich? Unterlizenz an Kunden ausdrücklich erlaubt? AVV-Vorlage und Rolle (Verantwortlicher/
   Auftragsverarbeiter)? Web Form 2.0 eingebettet (Loader) oder nur extern?

---

## 8. Quellen (alle abgerufen am 08.10.2026)
- finAPI Preise DE: https://www.finapi.io/preise/ · EN: https://www.finapi.io/en/prices/
- finAPI SaaS-Basisvertrag (20.05.2026): https://www.finapi.io/wp-content/uploads/2026/05/20260520_SaaS_Vertrag_online-version.pdf
- finAPI AGB (Stand 07.04.2026): https://www.finapi.io/wp-content/uploads/2026/04/Anlage-AGB.pdf
- finAPI Endnutzer-Vereinbarung (Stand 24.06.2019): https://live.finapi.io/agb?version=v1.4
- finAPI Über uns: https://www.finapi.io/en/about-finapi/about-us/ · Länder: https://www.finapi.io/en/products/country-coverage/
- finAPI Doku: https://documentation.finapi.io/webform/ · https://documentation.finapi.io/webform/web-form-documentation-2-0-2-1 ·
  https://documentation.finapi.io/webform/flows · https://documentation.finapi.io/webform/ais-flows · https://documentation.finapi.io/access/ ·
  https://documentation.finapi.io/access/unlicensed-customers · https://documentation.finapi.io/access/web-form-v1 ·
  https://documentation.finapi.io/access/interfaces · https://documentation.finapi.io/access/update-a-bank-connection-for-web-form-2-0-customer ·
  https://documentation.finapi.io/access/automated-update-of-the-bank-data-batch-updates ·
  https://documentation.finapi.io/access/possible-reasons-for-failing-batch-updates ·
  https://documentation.finapi.io/access/post-processing-of-bank-account-import-update ·
  https://documentation.finapi.io/access/push-notifications-web-hooks · OpenAPI: https://docs.finapi.io/?product=access
- EU: VO 2018/389 https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32018R0389 · VO 2022/2360
  https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32022R2360 · PSR/PSD3: Links in §1
- ZAG: § 1 https://www.gesetze-im-internet.de/zag_2018/__1.html · § 25 https://www.gesetze-im-internet.de/zag_2018/__25.html · § 34
  https://www.gesetze-im-internet.de/zag_2018/__34.html
- BaFin: Merkblatt ZAG (Stand 07/2024) https://www.bafin.de/SharedDocs/Veroeffentlichungen/DE/Merkblatt/mb_111222_zag.html · Aufsichtsmitteilung
  Kontozugangsschnittstellen (09.10.2024/02.05.2025) https://www.bafin.de/SharedDocs/Veroeffentlichungen/DE/Aufsichtsmitteilung/2024/Aufsichtsmitteilung_zu_PSD2_Kontozugangsschnittstellen.html
- GoCardless: https://bankaccountdata.gocardless.com/new-signups-disabled · https://gocardless.com/bank-account-data/announcement
- Tink: https://tink.com/pricing/ · https://docs.tink.com/resources/business-transactions/continuous-access-to-a-business-account ·
  https://docs.tink.com/entries/articles/introduction-to-psd2 · https://docs.tink.com/changelog
- Yapily: https://www.yapily.com/pricing · https://docs.yapily.com/tools-and-services/yapily-connect/overview ·
  https://docs.yapily.com/data/financial-data-resources/financial-data-consents
- Salt Edge: https://saltedge.com/products/spectre · Klarna: https://docs.klarna.com/api/xs2a/psd2-overview/
- FinTS: https://www.fints.org/de/hersteller/produktregistrierung · https://python-fints.readthedocs.io/en/latest/quickstart.html
- Qonto: https://docs.qonto.com/get-started/business-api/authentication/api-key ·
  https://docs.qonto.com/api-reference/business-api/transactions-statements/transactions/list-transactions
- Revolut: https://www.revolut.com/business/business-api/ · Kontist: https://kontist.dev/
- N26: https://support.n26.com/en-eu/security/open-banking-psd2/psd2-and-secure-open-banking ·
  https://support.n26.com/en-eu/security/open-banking-psd2/psd2-open-banking-for-third-party-providers
- CAMT/MT940: https://www.olb.de/mt940-camt
