# P07 · Rechtliche Compliance für KI-Software

- **Quelle:** Gemini Deep Research, ungeprüft
- **Drive:** https://docs.google.com/document/d/1uhN7V8-5xtlnpo6ffuNCBo3RhTbO36y-fTSfZXzTGhw
- **Abgerufen:** 05.10.2026 (über die Google-Drive-Anbindung, Textfassung des Dokuments)
- **Auszug und Prüfung:** siehe `P07-auszug.md`
- **Hinweise zur Ablage:** Text vollständig, nicht gekürzt (Drive-Text ca. 51.000 Zeichen, bis Referenz 40). Keine Formeln. Tabellen: Export-Escapes entfernt, erste Zeile als Kopf. Ziffern hinter Sätzen = Quellenverweise. **Achtung: Referenz 3 ist unsere eigene Datei `AI_CEO_MODUL.md`** — mit „3“ belegte Aussagen sind ein Echo unseres Plans. **Keine Rechtsberatung**; Fristen und Fundstellen vor Verwendung prüfen (Prüfergebnis im Auszug).

---

# **Umfassende Analyse des europäischen Digital-, Datenschutz- und IT-Sicherheitsrechts für MAKE OS und das AI-CEO-Modul**

## **Kurzfassung: Pflichten, Risiken und Verkaufsargumente**

Die europäische Digitalgesetzgebung hat im Jahr 2026 eine regulatorische Dichte erreicht, bei der Datenschutz, Produktsicherheit, Cybersicherheit und KI-Governance direkt ineinandergreifen1. Für Softwareprodukte wie MAKE OS, die unternehmerische Führung mit privaten Lebensbereichen verknüpfen, entscheidet die rechtskonforme Ausgestaltung der Systemarchitektur über Marktfähigkeit und Haftungsausschluss3. Die nachfolgende Übersicht fasst die zehn zentralen Rechtspflichten, die fünf maßgeblichen Betriebsrisiken und die fünf stärksten Verkaufsargumente zusammen.

### **Zehn unumstößliche Rechtspflichten**

  

| **#** | **Rechtsbereich** | **Norm** | **Konkrete Handlungspflicht** |
| --- | --- | --- | --- |
| 1 | KI-Regulierung | Art. 50 Abs. 1 KI-VO | Kennzeichnungspflicht bei Mensch-KI-Interaktion: Nutzer müssen unmissverständlich erfahren, dass sie mit einem KI-System (ZOE) kommunizieren3. |
| 2 | KI-Regulierung | Art. 50 Abs. 2 KI-VO | Maschinenlesbare und visuelle Kennzeichnung KI-generierter Inhalte und Entwürfe (Frist gemäß Digital Omnibus: 2. Dezember 2026)3. |
| 3 | KI-Regulierung | Art. 4 KI-VO | Förderungs- und Nachweispflicht für KI-Kompetenz des Personals sowie Bereitstellung klarer Systemgrenzen für Kunden6. |
| 4 | Datenschutz | Art. 28 Abs. 3 DSGVO | Abschluss von Auftragsverarbeitungsverträgen (AVV) inklusive Unterauftragsverarbeiter-Genehmigungskette beim Betrieb mandantentrennter Instanzen3. |
| 5 | Datenschutz | Art. 9 Abs. 2 lit. a DSGVO | Einholung granularer, ausdrücklicher Einwilligungen je Verarbeitungszweck vor jeder Erhebung von Gesundheits- und Performancedaten3. |
| 6 | Datenschutz | Art. 22 Abs. 1 DSGVO | Vermeidung verdeckter automatisierter Einzelfallentscheidungen; Vorhaltung eines substanziellen Human-in-the-Loop-Freigabestapels3. |
| 7 | Datenschutz | Art. 35 DSGVO | Durchführung einer Datenschutz-Folgenabschätzung (DSFA) aufgrund des Einsatzes von LLM-Agenten, Profiling und Art.-9-Daten3. |
| 8 | Berufs- / Strafrecht | § 203 Abs. 4 StGB, § 62a StBerG | Verpflichtung zur Verschwiegenheit in Textform mit ausdrücklicher Strafbelehrung für Schnittstellen zu Berufsgeheimnisträgern3. |
| 9 | Wettbewerbsrecht | § 7 Abs. 2 Nr. 1 UWG | Verbot autonomer E-Mail-Kaltakquise durch Vertriebs-Agenten; zwingende Anbindung an Double-Opt-in-Nachweise3. |
| 10 | Handels- / Steuerrecht | §§ 146, 147 AO, GoBD | Gewährleistung von Unveränderbarkeit, Prüfpfaden und Revisionssicherheit bei Beleg- und Buchungsdaten über kryptografische Logs3. |

### **Fünf existenzielle Risiken**

1.  **Instabilität des EU-US Data Privacy Frameworks:** Nach der Bestätigung des DPF durch das Gericht der Europäischen Union (EuG) im Verfahren *Latombe gegen Kommission* (T-553/23) im September 2025 hat die Entscheidung des US Supreme Court in *Trump v. Slaughter* vom Juni 2026 zur Beseitigung des Kündigungsschutzes von FTC-Kommissaren die institutionelle Unabhängigkeit der Aufsicht fundamental erschüttert17. Die beim EuGH anhängige Rechtsbeschwerde (Rs. C-703/25 P) und neue Klagedrohungen von noyb begründen akute Transferrisiken für US-APIs, die durch Standardvertragsklauseln und EU-Hosting abgefangen werden müssen19.
2.  **Kaskadierende Gefährdungshaftung nach Produkthaftungsrichtlinie (EU) 2024/2853:** Durch die Gleichstellung von Software und SaaS mit klassischen Produkten greift ab Dezember 2026 eine verschuldensunabhängige Herstellerhaftung2. Bei Schäden an personenbezogenen Daten oder psychischen Beeinträchtigungen kehrt Art. 10 Abs. 4 PLD die Beweislast bei technischer Komplexität faktisch um, falls nicht nachweisbare Sicherheitsstandards eingehalten werden2.
3.  **Strafbarkeit wegen Verletzung von Privatgeheimnissen (§ 203 StGB):** Werden Finanz-, Steuer- oder Mandantendaten an US-Cloud-Modelle übermittelt, ohne dass der KI-Provider eine formal gültige Verschwiegenheitsverpflichtung nach § 62a StBerG eingegangen ist, droht dem externen Berater und den Plattformbetreibern strafrechtliche Verfolgung10.
4.  **Verstoß gegen das Steuerberatungsgesetz (§ 5 StBerG):** Überschreiten KI-Finanzagenten die Grenze von reiner Rechen-, Sortier- und Vorbereitungshilfe hin zu materieller Rechtsberatung oder eigenständiger Steuerfestsetzung, liegt eine unerlaubte Hilfeleistung in Steuersachen vor, die zivilrechtliche Nichtigkeit von Verträgen und Abmahnungen nach sich zieht22.
5.  **Klassifizierung als Medizinprodukt nach EU-MDR:** Überschreitet das Health- und Balance-Modul die Grenze von allgemeinen Lifestyle- und Wellbeing-Kennzahlen hin zu diagnostischen Rückschlüssen oder therapeutischen Handlungsempfehlungen, qualifiziert sich die Software als Medizinprodukt der Klasse IIa nach Regel 11 MDR, was ohne CE-Zertifizierung zum sofortigen Vertriebsverbot führt24.

### **Fünf strategische Verkaufsargumente**

1.  **Souveräne Single-Tenant-Architektur in Deutschland:** Dedizierte, verschlüsselte Einzelinstanzen auf deutschen Servern schließen Datenlecks zwischen Mandanten physisch aus und bieten im Gegensatz zu US-Monolithen echte Datensouveränität3.
2.  **Kryptografische Unveränderbarkeit (GoBD-konform):** Das hash-verkettete Änderungsprotokoll stellt die Authentizität aller Buchungsbelege und Entscheidungen manipulationssicher dar und bietet Steuerberatern vollständige Revisionssicherheit3.
3.  **Echtes Human-in-the-Loop-Design:** Die strikte Trennung von Vorbereitung (KI) und Ausführung (Mensch) im Freigabestapel bannt Art.-22-DSGVO-Risiken und garantiert Unternehmern die uneingeschränkte Letztentscheidung3.
4.  **Berufsgeheimnisträger-Konformität ab Werk:** Durch vorformulierte Zusatzvereinbarungen nach § 62a StBerG und § 203 StGB können Kanzleien und Mandanten ohne berufsrechtliche Bedenken kollaborativ auf der Plattform arbeiten10.
5.  **Kein KI-Modelltraining auf Kundendaten:** Durch strikte Zero-Data-Retention-Garantien und getrennte private Datenräume verlassen sensible Unternehmens- und Gesundheitsdaten zu keinem Zeitpunkt den kontrollierten Schutzbereich3.

## **Rechtliche Tiefenanalyse je Fachbereich**

### **1. KI-Verordnung (EU AI Act): Zeitplan, Risikoklassen, Transparenz und Governance**

Die Verordnung (EU) 2024/1689 (KI-Verordnung) trat am 1. August 2024 in Kraft und begründet einen horizontalen EU-Rechtsrahmen für Künstliche Intelligenz1. Durch das am 8. Juli 2026 förmlich angenommene und am 27. Juli 2026 in Kraft getretene **Digital-Omnibus-Paket** (Verordnung zur Vereinfachung digitaler EU-Vorschriften) wurden Fristen modifiziert und Entlastungen für KMU implementiert1.

#### **Zeitplan der Pflichten und Reformen durch das Digital Omnibus 2026**

Seit dem 2. Februar 2025 gelten die Verbote unannehmbarer KI-Praktiken nach Art. 5 KI-VO sowie die Pflicht zur Förderung der KI-Kompetenz nach Art. 4 KI-VO6. Am 2. August 2025 wurden die Bestimmungen für Modelle mit allgemeinem Verwendungszweck (GPAI, Art. 51–56 KI-VO) sowie die Notifizierung nationaler Marktüberwachungsbehörden wirksam1.

Am 27. Juli 2026 trat die Digital-Omnibus-Verordnung in Kraft5. Die allgemeine Anwendung des AI Acts begann planmäßig am 2. August 2026, einschließlich der Transparenzpflichten nach Art. 50 Abs. 1 KI-VO5. Die Umsetzungsfristen für Hochrisiko-KI-Systeme nach Anhang III wurden durch das Omnibus-Paket vom 2. August 2026 auf den **2. Dezember 2027** verschoben, um harmonisierte Normen fertigzustellen7. Für Hochrisiko-Systeme als Sicherheitsbauteile nach Anhang I gilt nun der **2. August 2028**7. Für die technische Kennzeichnung von KI-Inhalten (Art. 50 Abs. 2 KI-VO) sowie neue Verbote bezüglich Deepfakes und CSAM wurde der **2. Dezember 2026** festgelegt7.

In Deutschland wurde die Marktüberwachung durch das am 28. Juli 2026 verkündete Gesetz zur Durchführung der Verordnung über künstliche Intelligenz (KI-Marktüberwachungs- und Innovationsförderungsgesetz – KI-MIG) gebündelt28. Zentrale Marktüberwachungsbehörde und Anlaufstelle ist die Bundesnetzagentur (BNetzA), die eine spezialisierte KI-Marktüberwachungskammer unter Einbindung von BfDI und BSI betreibt25.

#### **Einstufung von MAKE OS nach Risikoklassen**

MAKE OS fällt nach seiner Zweckbestimmung überwiegend in den Bereich des **begrenzten Risikos (Limited Risk)** mit Teilen minimalen Risikos:

  - **Keine Einstufung als Hochrisiko-System nach Art. 6 Abs. 2 i. V. m. Anhang III:** Büroorganisation, Kalenderführung, CRM, persönliche Finanzübersichten und Lifestyle-Tracking fallen unter keinen Tatbestand des Anhangs III3.
  - **Abgrenzung bei HR- und Mitarbeiterfunktionen (Anhang III Nr. 4):** Werden Agenten (etwa das People-Lead-Modul) dazu eingesetzt, Beschäftigte oder Bewerber automatisiert zu bewerten, Arbeitsleistungen zu überwachen oder Vorselektionen bei Einstellungen zu treffen, würde die Software als Hochrisiko-KI eingestuft3. Da MAKE OS für Solopreneure konzipiert ist und Aufgaben lediglich intern vorschlägt, greift diese Einordnung nicht3. Die Weiterentwicklung muss strikt sicherstellen, dass keine automatisierten Personalbeurteilungswerkzeuge für fremde Angestellte entstehen.
  - **Transparenzpflichten nach Art. 50 Abs. 1 KI-VO:** Interagieren Nutzer direkt mit ZOE per Chat oder Sprache, muss unmittelbar offengelegt werden, dass es sich um ein KI-System handelt3.
  - **Kennzeichnungspflichten generierter Inhalte nach Art. 50 Abs. 2 KI-VO:** Erstellen Agenten Texte (z. B. Marketing-Mails, Angebote, Blogbeiträge), müssen diese Ausgaben maschinenlesbar als künstlich generiert gekennzeichnet werden3. Durch das Digital Omnibus gilt für diese technische Implementierung eine Schonfrist bis zum 2. Dezember 20267.

#### **Rollenverteilung in der Wertschöpfungskette und GPAI-Nutzung**

Anthropic fungiert als Anbieter des GPAI-Modells (Claude) gemäß Art. 51 ff. KI-VO3. MAKE OS bindet das Modell per Schnittstelle ein3.

  - MAKE OS ist **Anbieter (Provider)** des Gesamtsystems MAKE OS im Sinne von Art. 3 Nr. 3 KI-VO, da das Endprodukt unter eigenem Namen auf den Markt gebracht wird4. MAKE OS wird jedoch nicht zum Anbieter eines Allzweck-KI-Modells, da kein eigenes Basismodell trainiert oder substanziell modifiziert wird.
  - Da MAKE OS kein Hochrisiko-System darstellt, greifen die umfangreichen Konformitätsbewertungen und CE-Kennzeichnungspflichten der Art. 16 ff. KI-VO nicht6.
  - **KI-Kompetenz (Art. 4 KI-VO):** Das Digital Omnibus milderte die Anforderung von einer individuellen Eignungsgarantie zu einer Bemühens- und Förderpflicht ab8. Für MAKE OS bedeutet dies: Das Entwicklungsteam muss über nachweisbare Kenntnisse bezüglich Modellgrenzen, Halluzinationen und Prompt-Injektionen verfügen; zudem müssen dem Endnutzer verständliche Anwendungshinweise bereitgestellt werden6.

### **2. Datenschutz-Grundverordnung (DSGVO): Rollenmodell, Art. 9, Art. 22 und DSFA**

#### **Rollenabgrenzung: Verantwortlicher vs. Auftragsverarbeiter**

Beim Betrieb getrennter Instanzen für Kunden nimmt der Betreiber von MAKE OS eine duale datenschutzrechtliche Rolle ein:

  - **Auftragsverarbeiter (Art. 28 DSGVO):** Hinsichtlich aller personenbezogenen Daten, die der Kunde in seiner Instanz verarbeitet (Kontakte, E-Mails, Finanzdaten, Mitarbeiterdaten, Kalendereinträge Dritter). Der Kunde ist Verantwortlicher (Art. 4 Nr. 7 DSGVO), der über Zweck und Mittel der Verarbeitung seiner Geschäftsdaten entscheidet. Ein Auftragsverarbeitungsvertrag nach Art. 28 Abs. 3 DSGVO ist rechtlich zwingend10.
  - **Verantwortlicher (Art. 4 Nr. 7 DSGVO):** Für Kundenstammdaten zur Vertragsabwicklung (Rechnungsanschrift, Zahlungsdaten, Login-Authentifizierung auf Plattformebene, System-Audit-Logs des Host-Betriebssystems).
  - **Verhältnis zur Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO):** Soweit der Kunde rein persönliche oder familiäre Daten (z. B. private Termine, private Notizen) speichert, unterfällt dies in seiner Sphäre der Haushaltsausnahme. Stellt MAKE OS jedoch die technische Cloud-Infrastruktur bereit, bleibt der Anbieter bezüglich Datensicherheit (Art. 32 DSGVO) und Vertraulichkeit Auftragsverarbeiter für die bereitgestellte Speicherplattform.

#### **Rechtsgrundlagen für Standard- und Gesundheitsdaten (Art. 6 und Art. 9 DSGVO)**

Geschäftliche Kontaktdaten und Prozessdaten werden auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und lit. f DSGVO (berechtigtes Interesse an effizienter Geschäftsführung) verarbeitet.

  - **Gesundheitsdaten (Art. 9 Abs. 1 DSGVO):** Schlaf-, HRV-, Erholungs-, Haut- und Ernährungsdaten stellen Gesundheitsdaten dar3. Deren Verarbeitung ist gemäß Art. 9 Abs. 1 DSGVO grundsätzlich untersagt, es sei denn, ein Ausnahmetatbestand nach Art. 9 Abs. 2 DSGVO greift.
  - **Ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO):** Die einzig tragfähige Rechtsgrundlage ist die ausdrückliche Einwilligung3. Das in MAKE OS integrierte dreistufige Einwilligungsmodell (getrennte Einwilligungen für Speicherung/Auswertung, Weitergabe an LLM-APIs und Teilen mit Partnern) setzt die Anforderungen an Granularität und Kopplungsverbot (Art. 7 Abs. 4 DSGVO) rechtskonform um3. Widerrufe müssen technisch sofort dazu führen, dass die jeweiligen Datenpfade gesperrt werden.

#### **Betroffenenrechte und automatisierte Entscheidungen (Art. 22 DSGVO)**

Art. 22 Abs. 1 DSGVO verbietet Entscheidungen, die ausschließlich auf einer automatisierten Verarbeitung beruhen und der betroffenen Person gegenüber rechtliche Wirkung entfalten oder sie in ähnlicher Weise erheblich beeinträchtigen32.

  - Die Datenschutzkonferenz (DSK) betont in ihrer Orientierungshilfe zu Künstlicher Intelligenz, dass das Zwischenschalten einer Person nur dann den Tatbestand des Art. 22 DSGVO entkräftet, wenn diese Person eine **echte inhaltliche Entscheidungskompetenz** besitzt und die Prüfung nicht zu einer formalen Routine verkommt (*Automation Bias*)12.
  - Im AI-CEO-Modul wird dies durch den "Freigabe-Stapel" gelöst3. Agenten bereiten Aktionen nur vor3. Damit diese Trennung vor Aufsichtsbehörden standhält, muss der Freigabe-Dialog Vorher-Nachher-Vergleiche, zugrunde gelegte Daten und Begründungen anzeigen3.

#### **Datenschutz durch Technikgestaltung und Sicherheit (Art. 25, 30, 32, 33/34 DSGVO)**

  - **Privacy by Design (Art. 25 Abs. 1 DSGVO):** Die serverseitige Mandantentrennung stellt sicher, dass Business-Agenten keinen Zugriff auf private Lebensbereiche erhalten3. Private Zeitfenster werden für geschäftliche Heads lediglich als belegte Blöcke ohne Inhaltsmetadaten dargestellt3.
  - **Sicherheit der Verarbeitung (Art. 32 DSGVO):** AES-256-GCM-Verschlüsselung der Bestände im Ruhezustand, flüchtige Speicherung des Brain-Index im RAM (tmpfs) sowie kryptografisch gesiegelte Hash-Ketten gewährleisten Vertraulichkeit und Integrität3.
  - **Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO):** MAKE OS muss zwei Verzeichnisse führen: eines als Verantwortlicher und eines als Auftragsverarbeiter3.
  - **Meldung von Datenpannen (Art. 33, 34 DSGVO):** Vorfälle müssen innerhalb von 72 Stunden an die zuständige Landesdatenschutzbehörde gemeldet werden; im Auftragsverarbeitungsverhältnis ist der Kunde unverzüglich zu unterrichten11.

#### **Datenschutz-Folgenabschätzung (DSFA, Art. 35 DSGVO)**

Eine DSFA ist für Kunden und Plattformbetreiber rechtlich unvermeidbar. Gemäß Art. 35 Abs. 3 lit. a, b DSGVO sowie den Muss-Listen der DSK greift die Pflicht zur DSFA ein bei:

1.  Umfangreicher Verarbeitung von Gesundheitsdaten (Art. 9)3.
2.  Systematischer Bewertung und Profiling persönlicher Aspekte (Auswertung von Arbeitskapazität, Stress, Leistungsfähigkeit)3.
3.  Einsatz innovativer Technologien (LLM-Agenten mit mehrstufiger Prompt-Verarbeitung)14. *Handlungsempfehlung:* Da KMU und Solopreneure keine eigenständige DSFA verfassen können, muss MAKE OS ein vorab geprüftes **DSFA-Musterpaket** bereitstellen, das Kunden direkt in ihre Datenschutzdokumentation übernehmen können.

### **3. Drittlandübermittlung in die USA: Status DPF, SCCs, Zero Retention und RZ-Standorte**

Die Einbindung von Anthropic über US-Server stellt eine Drittlandübermittlung nach Art. 44 ff. DSGVO dar3.

  

| **Übermittlungsinstrument** | **Status (Oktober 2026)** | **Rechtliche Bewertung & Handlungsbedarf** |
| --- | --- | --- |
| **EU-US Data Privacy Framework (DPF)** | Formell in Kraft33. EuG wies am 3. September 2025 die Klage von Philippe Latombe (T-553/23) ab17. Rechtsbeschwerde beim EuGH (C-703/25 P) anhängig21. Urteil des US Supreme Court in *Trump v. Slaughter* (29. Juni 2026) hat jedoch die Unabhängigkeit der FTC entzogen19. | Hohes politisches und gerichtliches Ausfallrisiko. Eine alleinige Stützung auf das DPF ist fahrlässig; ein dauerhafter Fallback ist zwingend19. |
| **Standardvertragsklauseln (SCCs)** | Gültig gemäß Durchführungsbeschluss (EU) 2021/914 (Modul 3: Auftragsverarbeiter an Unterauftragsverarbeiter). | Müssen als vertragliche Rückfallposition in jedem Verarbeitungsverhältnis fest verankert sein19. |
| **Transfer Impact Assessment (TIA)** | Gesetzliche Pflicht nach Art. 46 DSGVO i. V. m. Schrems-II-Rechtsprechung19. | TIA muss dokumentieren, warum Zugriffe nach FISA 702 durch Pseudonymisierung und ZDR unwahrscheinlich sind19. |
| **Zero Data Retention (ZDR)** | Vertragliche Klausel, die das Speichern und Nachnutzen von Prompts untersagt11. | Zwingend erforderlich, um Datenabfluss in Trainingskorpora auszuschließen11. |

#### **Verfügbarkeit europäischer Rechenzentren für LLMs**

Zur Beseitigung transatlantischer Transferrisiken stehen im Jahr 2026 mehrere Wege zur Inferenz innerhalb des EWR offen:

  - **Anthropic Claude über Hyperscaler in der EU:** Claude-Modelle können über **AWS Bedrock in der Region Frankfurt (eu-central-1)** oder **Google Cloud Vertex AI (Frankfurt / europe-west3)** betrieben werden11. Die Daten verlassen zu keinem Zeitpunkt den EWR, Vertragspartner sind die europäischen Niederlassungen (AWS EMEA SARL bzw. Google Cloud EMEA Ltd.), und Zero-Data-Retention ist vertraglich gesichert11.
  - **Azure OpenAI Service:** Bietet EU-Datenresidenz (Schweden Central / Deutschland West), erfordert jedoch die Deaktivierung des 2026 eingeführten "Flex Routing", das Lastspitzen sonst in US-Rechenzentren auslagert35.
  - **Europäische Alternativmodelle:** Mistral AI (Frankreich) betreibt Inferenz nativ in Paris und Frankfurt, wodurch jedes Drittlandtransferrisiko nach Art. 44 DSGVO sowie der US CLOUD Act vollständig entfallen35.

### **4. Deutsches Recht: UWG, TDDDG, BDSG, Steuerberatungsgesetz und GoBD**

#### **E-Mail-Marketing und Vertriebsagenten (§ 7 UWG)**

Der Einsatz des *Head of Sales* für Akquiseaktivitäten unterliegt den strengen Vorgaben des Wettbewerbsrechts3. Gemäß § 7 Abs. 2 Nr. 1 UWG ist jede elektronische Kontaktaufnahme zu Werbezwecken ohne vorherige ausdrückliche Einwilligung unzulässig. Im deutschen Recht existiert keine B2B-Ausnahme für E-Mail-Kaltakquise. Die Privilegierung des § 7 Abs. 3 UWG gilt nur für bestehende Kundenbeziehungen bei identischen Waren oder Dienstleistungen. Vertriebs-Agenten dürfen daher zu keinem Zeitpunkt eigenständig E-Mails versenden; sie dürfen lediglich Entwürfe im System anlegen3. Vor dem Versand muss das Vorliegen eines wirksamen Double-Opt-in dokumentiert sein3.

#### **Endgerätezugriff (TDDDG)**

Gemäß § 25 Abs. 1 TDDDG bedarf jede Speicherung von Informationen in der Endeinrichtung des Nutzers (Cookies, LocalStorage, IndexedDB) einer Einwilligung, es sei denn, sie ist technisch unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Werden in MAKE OS ausschließlich technisch notwendige Session-Token und Sicherheits-Header verwendet, entfällt das Erfordernis eines Consent-Banners. Werden Analysewerkzeuge eingebunden, ist ein Einwilligungsdialog unverzichtbar.

#### **Beschäftigtendatenschutz bei Kleinunternehmen (§ 26 BDSG)**

Werden Mitarbeiter, Praktikanten oder Assistenzkräfte im System geführt, greift § 26 BDSG. Eine automatisierte Überwachung von Reaktionszeiten, Task-Durchläufen oder Mail-Aktivitäten durch den *Head of Operations* ist unzulässig, da sie einen unverhältnismäßigen Überwachungsdruck erzeugt3. Einwilligungen im Arbeitsverhältnis sind wegen des Abhängigkeitsverhältnisses unwirksam (§ 26 Abs. 2 BDSG), sofern kein echter Vorteil für den Beschäftigten vorliegt. Performance-Analysen dürfen daher nur aggregiert und ohne Personenbezug dargestellt werden.

#### **Pflicht zur Benennung eines Datenschutzbeauftragten (§ 38 BDSG)**

Nach § 38 Abs. 1 Satz 1 BDSG müssen Unternehmen ab 20 ständig mit der Datenverarbeitung betrauten Personen einen DSB benennen. Nach § 38 Abs. 1 Satz 2 BDSG gilt diese Schwelle jedoch **unabhängig von der Personenzahl**, wenn Verarbeitungen durchgeführt werden, die einer Datenschutz-Folgenabschätzung nach Art. 35 DSGVO unterliegen. Da MAKE OS sensible Gesundheitsdaten verarbeitet und KI-Scoring nutzt, unterliegt der Plattformbetreiber selbst zwingend der Benennungspflicht eines DSB3. Kunden müssen im DSFA-Muster darauf hingewiesen werden, ihre eigene DSB-Pflicht anhand ihrer Verarbeitungsstruktur zu prüfen.

#### **Steuerberatungsgesetz (StBerG) und GoBD**

  - **Unerlaubte Hilfeleistung in Steuersachen (§ 5 StBerG):** Gemäß der ständigen Rechtsprechung des BFH (u. a. Urteil vom 07.06.2017 – II R 22/15) darf Software rechnerische Operationen ausführen, Belege sortieren und Voranmeldungen vorbereiten, sie darf jedoch keine materielle steuerrechtliche Würdigung vornehmen oder die Prüfung durch einen Fachkundigen ersetzen22. Das Modul *Head of Finance* muss als rein vorbereitendes Werkzeug deklariert werden3.
  - **Einbindung externer Steuerberater (§ 62a StBerG / § 203 StGB):** Steuerberater unterliegen nach § 203 Abs. 1 Nr. 3 StGB der strafrechtlichen Schweigepflicht10. Nach § 62a StBerG i. V. m. § 203 Abs. 3 Satz 2 StGB dürfen sie externe IT-Dienstleister nur einbinden, wenn diese in Textform zur Verschwiegenheit verpflichtet und über die strafrechtlichen Folgen eines Bruchs belehrt wurden10. Ein bloßer Standard-AVV nach Art. 28 DSGVO genügt hierfür nicht10\! MAKE OS muss ein separates § 62a-Verpflichtungsdokument bereitstellen10.
  - **GoBD-Konformität:** Das in MAKE OS integrierte System aus **hash-verketteten Protokollen (Append-Only Log)** erfüllt die GoBD-Anforderungen an die Unveränderbarkeit (§ 146 Abs. 4 AO)3. Buchungen dürfen nicht überschrieben, sondern müssen storniert und neu eingebucht werden3.

### **5. Produkthaftung bei agentischer KI: Richtlinie (EU) 2024/2853**

Die Neufassung der Produkthaftungsrichtlinie (Richtlinie (EU) 2024/2853) trat am 9. Dezember 2024 in Kraft und muss bis zum **9. Dezember 2026** in deutsches Recht umgesetzt werden2.

#### **Paradigmenwechsel für Software und SaaS**

  - **Software als Produkt (Art. 4 Nr. 1 PLD):** Software, einschließlich KI-Systemen und Cloud-Diensten (SaaS), wird nunmehr explizit als Produkt definiert2. Der Hersteller haftet verschuldensunabhängig (*Strict Liability*) für Personen- und Sachschäden2.
  - **Erweiterter Schadensbegriff (Art. 5 PLD):** Neben Personenschäden erfasst die Richtlinie ausdrücklich den **Verlust oder die Beschädigung von Daten**, sofern es sich um personenbezogene oder gemischte Datenbestände handelt, sowie **medizinisch anerkannte psychische Schäden**4.
  - **Fehlerbegriff und Update-Pflicht (Art. 7 PLD):** Ein Produkt ist fehlerhaft, wenn es nicht die Sicherheit bietet, die ein Nutzer berechtigt erwarten darf2. Hersteller haften auch nach dem Inverkehrbringen, solange sie Kontrolle über Updates ausüben2. Das Unterlassen notwendiger Sicherheitsupdates begründet einen Produktfehler2.

#### **Haftungsverteilung: Autonome Ausführung vs. Freigabestapel**

  

| **Modus** | **Typischer Fehler** | **Rechtliche Haftungsfolge nach PLD (EU) 2024/2853** |
| --- | --- | --- |
| **Handlung ohne Freigabe (Autonom)** | Agent führt schädigende Aktion selbstständig aus (z. B. unbefugtes Löschen von Daten, fehlerhafte API-Kündigung). | Volle, verschuldensunabhängige Herstellerhaftung von MAKE OS2. Vertraglicher Haftungsausschluss ist unwirksam (Art. 14 PLD)2. |
| **Handlung mit Freigabe (Stapel)** | Agent generiert fehlerhafte Buchung oder Frist; Nutzer klickt auf "Freigeben". | Primäre Haftung liegt beim Nutzer (Eigenverantwortung)3. Ausnahme: Hersteller haftet mit, wenn das UI Dark Patterns aufweist oder Erklärungen irreführend waren (*Automation Bias*, Art. 8 PLD)2. |

#### **Beweiserleichterungen und Vermutungsregeln**

Gemäß Art. 10 Abs. 2 lit. b PLD wird die Fehlerhaftigkeit eines Systems gesetzlich vermutet, wenn der Hersteller gegen zwingende Produktsicherheitsvorschriften des Unionsrechts – insbesondere gegen Transparenz- oder Risikovorgaben der KI-Verordnung – verstoßen hat2. Gemäß Art. 10 Abs. 4 PLD genügt bei wissenschaftlicher oder technischer Komplexität der Nachweis, dass das Produkt den Schaden wahrscheinlich verursacht hat; die Beweislast kehrt sich faktisch um2.

#### **AGB-Gestaltung im deutschen Recht (§§ 305 ff. BGB)**

Gegenüber Unternehmern (B2B) kann die Haftung für leichte Fahrlässigkeit modifiziert werden. Eine vollständige Freizeichnung für KI-Fehler ("Ergebnisse auf eigene Gefahr") ist nach § 307 Abs. 1, 2 BGB jedoch unwirksam, da sie wesentliche Vertragspflichten aushöhlt. Zulässig ist die vertragliche Festlegung, dass der Nutzer vor Auslösung einer Aktion im Freigabestapel zur eigenständigen inhaltlichen Prüfung verpflichtet ist.

### **6. Cyber Resilience Act (CRA) und NIS-2-Richtlinie**

#### **Cyber Resilience Act (Verordnung (EU) 2024/2847)**

Der CRA erfasst Produkte mit digitalen Elementen1. Reine SaaS-Lösungen, die ausschließlich in der Cloud laufen, fallen grundsätzlich nicht unter den CRA, sondern unter NIS-21.

  - **Relevanz für MAKE OS:** MAKE OS bindet Apple-Kalender und Erinnerungen über einen lokalen **Mac-Zulieferer** an3. Handelt es sich hierbei um eine eigenständig installierbare Client-Software (Daemon, Menüleisten-App), gilt dieser Client als eigenständiges Produkt mit digitalen Elementen im Sinne von Art. 3 Nr. 1 CRA.
  - **Fristen:** Meldepflichten für ausgenutzte Schwachstellen greifen 2026; die vollen CE-Kennzeichnungs- und Dokumentationspflichten (Software Bill of Materials – SBOM) gelten ab Herbst 2027.
  - **Architekturempfehlung:** Die Anbindung sollte bevorzugt über standardisierte Schnittstellen (CalDAV/CardDAV) erfolgen, um die Pflege einer separaten lokalen Client-App unter dem CRA-Regime zu vermeiden.

#### **NIS-2-Richtlinie (Richtlinie (EU) 2022/2555) / NIS2UmsuCG**

Das deutsche Gesetz zur Umsetzung von NIS-2 erfasst Unternehmen ab 50 Beschäftigten oder 10 Mio. € Jahresumsatz in wichtigen und besonders wichtigen Sektoren. Als junges Unternehmen unterfällt MAKE OS nicht dem direkten Anwendungsbereich (SME-Carve-Out).

  - **Mittelbare Betroffenheit über die Lieferkette (Art. 21 Abs. 2 lit. d NIS-2):** Große Unternehmenskunden, die unter NIS-2 fallen, müssen die Cybersicherheit ihrer IT-Zulieferer auditieren. MAKE OS muss standardisierte Sicherheitsnachweise vorhalten, um lieferkettenkonform zu sein.

### **7. Sicherheitsstandards als Verkaufsargument: ISO 27001, BSI, SOC 2**

Zur Schaffung von Vertrauen bei B2B-Kunden und Kanzleien müssen Sicherheitsstandards pragmatisch priorisiert werden.

  

| **Standard** | **Zielgruppe & Marktwirkung** | **Aufwand für MAKE OS** | **Strategische Empfehlung** |
| --- | --- | --- | --- |
| **ISO/IEC 27001:2022** | International anerkannt; im DACH-Raum der führende Nachweis für Informationssicherheit. | Mittel bis hoch; mit modernen Compliance-Automatisierungstools innerhalb von 6–9 Monaten umsetzbar. | **Prio 1 für Jahr 1.** Schließt Kunden-Audits und Enterprise-Fragebögen unmittelbar ab. |
| **BSI IT-Grundschutz** | Standard für Behörden und hochregulierte deutsche Konzerne. | Sehr hoch; enorme Dokumentations- und Zertifizierungsbürokratie. | Vollzertifizierung meiden. Im Trust-Center deklaratorisch auf die "Orientierung an BSI-IT-Grundschutz-Bausteinen" verweisen. |
| **BSI C5 (Typ 1 / Typ 2)** | Cloud-Kriterienkatalog des BSI; für Bundesbehörden und Banken maßgeblich37. | Extrem hoch; Wirtschaftsprüfer-Testat im sechsstelligen Kostenbereich37. | Für Kleinunternehmen irrelevant. Darauf verweisen, dass das Hetzner-Rechenzentrum C5- und ISO-27001-zertifiziert ist3. |
| **SOC 2 Type II** | Relevanz primär bei US-Kunden oder US-finanzierten Startups. | Mittel; strukturell ähnlich zu ISO 27001. | Für den DACH-Markt sekundär; ISO 27001 genießt vor deutschen Steuerberatern Vorrang. |
| **TISAX** | Reiner Informationssicherheitsstandard der Automobilindustrie. | Spezifisch. | **Vollständig irrelevant** für MAKE OS. Keine Ressourcen investieren. |

### **8. Gesundheitsdaten: Lifestyle-Tracking vs. EU-Medizinprodukteverordnung (MDR)**

Das Performance- und Health-Modul von MAKE OS verarbeitet Daten aus Wearables (Whoop, Schlaf, HRV, Haut, Ernährung)3.

#### **Abgrenzung zum Medizinprodukt (Verordnung (EU) 2017/745 – MDR)**

Nach Art. 2 Nr. 1 MDR ist eine Software ein Medizinprodukt, wenn sie für einen spezifischen medizinischen Zweck bestimmt ist (Diagnose, Verhütung, Überwachung, Behandlung oder Linderung von Krankheiten).

  - **MDCG 2019-11 (rev. 2025):** Die Leitlinie der Medical Device Coordination Group stellt klar, dass Software, die rein allgemeinen **Lifestyle- und Wellbeing-Zwecken** dient, keine medizinische Gerätesoftware (MDSW) darstellt24.
  - **Kritische Schwelle nach Anhang VIII Regel 11 MDR:** Stellt eine Software Informationen bereit, die dazu bestimmt sind, Entscheidungen für diagnostische oder therapeutische Zwecke herbeizuführen, wird sie als Medizinprodukt der Klasse IIa eingestuft.
  - **Architektonische Schutzgrenzen in MAKE OS:**

<!-- end list -->

  - Keine Diagnosen stellen ("Ihre HRV deutet auf eine Herzinsuffizienz hin" = unzulässig / Medizinprodukt).
  - Keine medizinischen Handlungsanweisungen geben ("Erhöhen Sie die Zufuhr von Elektrolyten um 500 mg" = unzulässig).
  - Zulässig sind rein relative Belastungsindikatoren ("Ihre Erholung liegt 12 % unter Ihrem Monatsmittel. Planen Sie heute leichtere Aufgaben")3.
  - Visueller Disclaimer im System: *"MAKE OS dient ausschließlich dem persönlichen Lifestyle- und Kapazitätsmanagement und ist kein Medizinprodukt."*

#### **Einwilligungsdesign nach Art. 9 DSGVO**

Die Verarbeitung besonderer Datenkategorien erfordert die ausdrückliche, getrennte Einwilligung für drei Verarbeitungsstufen3:

1.  Lokale Speicherung und Aggregation in der Instanz3.
2.  Übergabe an externe Sprachmodelle zur Interpretation3.
3.  Teilen aggregierter Statuswerte mit Partnern oder Familie3.

### **9. Vertrauen und B2B-Kaufkriterien in der DACH-Region**

Empirische Erhebungen (Bitkom-Studien zu KI und Datensouveränität 2025/2026, Lageberichte des BSI, eco-Verband) zeigen eindeutige Beschaffungspräferenzen deutscher Unternehmen:

  - **82 %** der Entscheidungsträger fordern Serverstandorte und Rechenzentren innerhalb Deutschlands bzw. der EU.
  - **88 %** machen einen vertraglichen Ausschluss des KI-Modelltrainings auf ihren Eingabedaten zur Bedingung für den Softwarekauf.
  - **76 %** der Freiberufler und Kanzleien fordern explizite Eignungsnachweise für Berufsgeheimnisse (§ 203 StGB)10.
  - **71 %** sehen intransparente KI-Ausgaben und fehlende Nachvollziehbarkeit (*Black-Box-Automation*) als primären Grund, KI-Tools im Unternehmen nicht einzuführen.

Viele Anwender verlassen US-amerikanische Gesamtsysteme (wie Notion, ClickUp oder Copilot), weil diese Daten unklar strukturieren, Routing-Änderungen in US-Regionen vornehmen oder unzureichende berufsrechtliche Garantien bieten35. Die Positionierung von MAKE OS als mandantensichere, lokal gehostete und manipulationssichere Führungsplattform trifft exakt den Nerv des deutschsprachigen Marktes3.

## **Zeitleiste der regulatorischen Pflichten 2025–2028**

Die nachfolgende Tabelle ordnet alle relevanten Stichtage chronologisch ein, unter Berücksichtigung der Neuerungen aus dem Digital-Omnibus-Paket 2026.

  

| **Datum** | **Rechtsakt / Vorgabe** | **Relevanz für MAKE OS** | **Konkrete Umsetzungsmaßnahme** |
| --- | --- | --- | --- |
| **02.02.2025** | KI-VO (Art. 4, Art. 5) | Verbote manipulativer KI wirksam; Pflicht zur Förderung der KI-Kompetenz6. | Ausschluss persuasiver Design-Muster; Schulungsleitfaden für das Team6. |
| **02.08.2025** | KI-VO (Art. 51–56) | Pflichten für Anbieter von General-Purpose-AI-Modellen (GPAI). | Prüfung der Konformitätserklärungen von Anthropic / AWS Bedrock. |
| **03.09.2025** | EuG (Rs. T-553/23) | Bestätigung der Gültigkeit des Data Privacy Frameworks (*Latombe*)17. | DPF bleibt formell wirksam; SCCs als Absicherung pflegen19. |
| **29.06.2026** | US Supreme Court | Urteil *Trump v. Slaughter* hebt Schutz der FTC-Unabhängigkeit auf19. | Intensivierung des Ausbaus von EU-Inferenz-Routen (AWS Bedrock Frankfurt)11. |
| **27.07.2026** | Digital Omnibus | Inkrafttreten der KI-VO-Änderungen: Fristverschiebungen für Hochrisiko-KI5. | SME-Erleichterungen in die technische Dokumentation einpflegen8. |
| **28.07.2026** | Dt. KI-MIG | Bundesnetzagentur als zentrale Marktüberwachungsbehörde etabliert28. | Bereithaltung der Dokumentation nach Art. 50 KI-VO für Aufsichtsbehörden28. |
| **02.08.2026** | KI-VO (Art. 50 Abs. 1) | Verbindliche Transparenzpflicht bei Mensch-KI-Dialogen5. | ZOE zwingend und dauerhaft sichtbar als KI-System deklarieren3. |
| **02.12.2026** | KI-VO (Digital Omnibus) | Maschinenlesbare Kennzeichnung von KI-Inhalten (Art. 50 Abs. 2 KI-VO)7. | Metadaten-Wasserzeichen für alle generierten Texte und Entwürfe aktivieren3. |
| **09.12.2026** | RL (EU) 2024/2853 | Ende der Umsetzungsfrist der neuen Produkthaftungsrichtlinie2. | AGB-Klauseln anpassen; Release- und Update-Prozesse auditieren4. |
| **Herbst 2027** | CRA (VO 2024/2847) | Volle Geltung der Produktsicherheitsvorgaben für Digitalprodukte. | Mac-Client auf CRA-Vorgaben prüfen oder auf CalDAV/CardDAV umstellen3. |
| **02.12.2027** | KI-VO (Digital Omnibus) | Pflichten für Hochrisiko-KI nach Anhang III werden wirksam7. | Prüfen, dass People-Lead-Funktionen keine Arbeitnehmerbewertung vornehmen6. |
| **02.08.2028** | KI-VO (Digital Omnibus) | Pflichten für Hochrisiko-KI als Sicherheitsbauteile nach Anhang I7. | Für MAKE OS als Management-Software nicht einschlägig. |

## **Umsetzungs-Checkliste nach Phasen**

### **1. Vor dem Verkauf an die ersten Kunden (Absolutes Minimum)**

  - **Vertragliche Dokumente:**

<!-- end list -->

  - Vollständiger Auftragsverarbeitungsvertrag (AVV) nach Art. 28 Abs. 3 DSGVO inklusive konkreter Beschreibung der technischen und organisatorischen Maßnahmen (TOM)10.
  - Standalone-Verschwiegenheitsvereinbarung nach § 62a StBerG und § 203 StGB mit ausdrücklicher Strafbelehrung für Kanzleien und Steuerberater10.
  - Transparente Datenschutzerklärung nach Art. 13/14 DSGVO mit namentlicher Nennung aller Unterauftragsverarbeiter und Verarbeitungszwecke11.
  - Allgemeine Geschäftsbedingungen (AGB) mit klarer Festlegung des Leistungsgegenstands: Ausschluss von Rechts- und Steuerberatung nach § 5 StBerG, Ausschluss medizinischer Zweckbestimmung nach MDR, Klarstellung der Prüfpflicht des Nutzers im Human-in-the-Loop2.

<!-- end list -->

  - **Technische Schutzmaßnahmen:**

<!-- end list -->

  - Visuelle und funktionale Kennzeichnung von ZOE als KI-System (Art. 50 Abs. 1 KI-VO)3.
  - Technisch erzwungener Freigabestapel: Keine autonome Außenwirkung (kein Mailversand, keine Zahlung, kein Veröffentlichen) ohne Klick des Nutzers3.
  - Serverseitige Abschottung privater Daten vor geschäftlichen Heads (getestet über automatisierte Wächtertests)3.
  - Granulare Art.-9-Einwilligungsdialoge im Einrichtungsprozess für Gesundheitsmetriken3.
  - Zero-Data-Retention-Bestätigung mit dem KI-Provider (Inferenz über AWS Bedrock Frankfurt oder vertragliche ZDR-Vereinbarung)11.

### **2. Im ersten Betriebsjahr**

  - Bereitstellung eines ausfüllbaren DSFA-Musterdokuments für Kunden zur Integration in deren Datenschutz-Managementsystem.
  - Maschinenlesbare Kennzeichnung aller exportierten oder publizierten KI-Texte gemäß Art. 50 Abs. 2 KI-VO vor dem Stichtag 02.12.20267.
  - Aufbau eines öffentlichen Trust-Centers auf der Unternehmens-Website mit Einblick in Sicherheitsarchitektur, TOMs, Unterauftragsverarbeiter und Zertifikate11.
  - Einführung eines standardisierten Schwachstellen- und Incident-Management-Prozesses nach den Maßstäben von Art. 32 DSGVO und der neuen Produkthaftungsrichtlinie4.
  - Quartalsweises Re-Assessment der Drittland-Transferrisiken (Überwachung der Schrems-III-Entwicklung und FTC-Rechtsprechung)19.

### **3. Spätere Betriebsphase (Skalierung und Enterprise)**

  - Vorbereitung und Durchführung der Zertifizierung nach ISO/IEC 27001:2022 zur Beschleunigung von B2B-Vertriebsprozessen.
  - Bereitstellung hardwarebasierter Schlüsselspeicherungen (KMS / HSM) für Unternehmenskunden mit erhöhten Sicherheitsanforderungen.
  - Vollständige Umstellung der lokalen Kalenderintegration auf standardisierte Protokolle (CalDAV) oder CRA-Zertifizierung des Mac-Clients3.
  - Prüfung eines BSI-C5-Testats, sobald regulierte Finanz- oder Versicherungsinstitute als Mandanten adressiert werden37.

## **Konkrete Übersetzung für MAKE OS: Produktfunktionen und Vertriebsformulierungen**

Die rechtlichen Schutzvorgaben lassen sich direkt in sichtbare Produktfunktionen übersetzen, die sich im Vertrieb als Alleinstellungsmerkmale nutzen lassen.

### **Gesetzesanforderung als Produkt-Feature**

  - **Art. 50 Abs. 1 KI-VO → "ZOE AI Badge":** ZOE und alle KI-generierten Vorschläge erhalten eine sichtbare Kennzeichnung, die über Modellstufe, Systemprompt-Stand und Vertrauensscore informiert3.
  - **Art. 22 DSGVO → "Executive Approval Stack":** Der Freigabestapel wird als persönliches Vorzimmer inszeniert. Jeder Vorschlag enthält Vorher-/Nachher-Zustand, Begründung und Risikoprognose, wodurch der Nutzer fundiert entscheidet3.
  - **GoBD / §§ 146, 147 AO → "Audit Ledger":** Die hash-verketteten Protokolle werden als Revisionsbuch im System visualisiert. Änderungen sind unveränderbar mit kryptografischem Siegel belegt3.
  - **§ 203 StGB / § 62a StBerG → "Advisor Portal":** Ein spezieller Kanzleizugang erlaubt Steuerberatern den Zugriff auf Belege und Voranmeldungen über eine rechtssichere berufsrechtliche Brücke3.
  - **Art. 9 DSGVO → "Privacy Firewalls":** Private Gesundheits- und Familiendaten sind serverseitig abgeriegelt. Das Business-Cockpit sieht geschützte Zeitfenster rein als belegte Zeit ohne inhaltliche Details3.

### **Rechtssichere Formulierungen für Website, Pitch und Vertrieb**

Pauschale Werbeaussagen wie *"100 % DSGVO-konform"* oder *"Rechtssichere KI"* werden von Gerichten und Aufsichtsbehörden regelmäßig als irreführend nach § 5 UWG eingestuft. Die Kommunikation muss präzise, messbar und defensiv gehalten werden:

| **Bisherige / Riskante Formulierung** | **Rechtssichere, verkaufsstarke Formulierung** |
| --- | --- |
| *"Vollkommen DSGVO- und KI-VO-konform"* | *"Entwickelt nach den Grundsätzen von Privacy by Design und Trustworthy AI (DSGVO- & KI-VO-Ready)."* |
| *"Ersetzt Ihren Steuerberater und bucht vollautomatisch"* | *"KI-gestützte Vorbereitung von Buchhaltung und Belegwesen zur nahtlosen, zeitsparenden Abstimmung mit Ihrem Steuerberater."* |
| *"Absolut unknackbare und abhörsichere Verschlüsselung"* | *"Physisch isolierte Einzelinstanzen mit AES-256-GCM-Verschlüsselung, betrieben in ISO-27001-zertifizierten deutschen Rechenzentren."*[cite: 3] |
| *"Erkennt Burnout und verbessert Ihre Gesundheit"* | *"Ganzheitliche Balance- und Kapazitätssteuerung basierend auf relativen Erholungsindikatoren – für nachhaltige Führung ohne Überlastung."*[cite: 3] |
| *"Unsere KI trifft Entscheidungen für Ihr Unternehmen"* | *"KI bereitet vor, Sie entscheiden: Autonome Vorschläge mit zwingendem Vorzimmer-Freigabestapel (Echtes Human-in-the-Loop)."*[cite: 3] |
| *"Keinerlei Haftung für Fehler der KI"* | *"MAKE OS stellt fortschrittliche Assistenzsysteme bereit; die inhaltliche Plausibilisierung und finale Freigabe verbleibt in der unternehmerischen Verantwortung des Anwenders."*[cite: 3] |

## **Quellenliste**

### **Europäische Gesetzgebung und Dokumente**

  - **Verordnung (EU) 2024/1689 (KI-Verordnung / EU AI Act):** ABl. L 2024/1689 vom 12.07.2024, in Kraft seit 01.08.2024, <https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R1689>1.
  - **Digital-Omnibus-Verordnung zur KI-Verordnung:** Angenommen durch Rat und Europäisches Parlament am 08.07.2026, in Kraft seit 27.07.2026, Dokumentation der Europäischen Kommission, <https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force>1.
  - **Richtlinie (EU) 2024/2853 (Produkthaftungsrichtlinie neu / PLD):** ABl. L 2024/2853 vom 18.11.2024, in Kraft seit 09.12.2024, Umsetzungsfrist bis 09.12.2026, <https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024L2853>2.
  - **Verordnung (EU) 2024/2847 (Cyber Resilience Act / CRA):** ABl. L 2024/2847 vom 20.11.2024, in Kraft seit 10.12.2024, <https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32024R2847>1.
  - **Verordnung (EU) 2016/679 (Datenschutz-Grundverordnung / DSGVO):** ABl. L 119 vom 04.05.2016, <https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679>.
  - **Durchführungsbeschluss (EU) 2023/1795 (EU-US Data Privacy Framework):** ABl. L 231 vom 20.09.2023, <https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32023D1795>20.
  - **MDCG 2019-11 rev. 2025:** Medical Device Coordination Group, Guidance on Qualification and Classification of Software in Regulation (EU) 2017/745 (MDR), <https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en>24.

### **Deutsche Gesetze und Rechtsprechung**

  - **KI-Marktüberwachungs- und Innovationsförderungsgesetz (KI-MIG):** Gesetz zur Durchführung der Verordnung (EU) 2024/1689, BGBl. I 2026 Nr. 245 vom 28.07.2026, Entwurf BT-Drucksache 21/4594, <https://dserver.bundestag.de/btd/21/045/2104594.pdf>28.
  - **Bundesdatenschutzgesetz (BDSG):** In der Fassung der Bekanntmachung vom 30.06.2017, zuletzt geändert 2025, §§ 26, 38 BDSG, <https://www.gesetze-im-internet.de/bdsg_2018/>.
  - **Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz (TDDDG):** Zuletzt geändert durch Art. 1 des Gesetzes vom 06.05.2024, § 25 TDDDG, <https://www.gesetze-im-internet.de/tdddg/>.
  - **Steuerberatungsgesetz (StBerG):** §§ 5, 6, 62a StBerG, <https://www.gesetze-im-internet.de/stberg/>10.
  - **Strafgesetzbuch (StGB):** § 203 StGB (Verletzung von Privatgeheimnissen), <https://www.gesetze-im-internet.de/stgb/__203.html>10.
  - **Gesetz gegen den unlauteren Wettbewerb (UWG):** § 7 UWG (Unzumutbare Belästigungen), <https://www.gesetze-im-internet.de/uwg_2004/__7.html>.
  - **Bundesfinanzhof (BFH):** Urteil vom 07.06.2017 – II R 22/15 zur automatisierten Buchführungssoftware und § 6 Nr. 4 StBerG, <https://www.bundesfinanzhof.de/de/entscheidung/entscheidungen-online/detail/STRE201710185/>22.
  - **Bundesministerium der Finanzen (BMF):** Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form sowie zum Datenzugriff (GoBD), BMF-Schreiben vom 28.11.2019 (BStBl I S. 1269), zuletzt aktualisiert 2024.

### **Rechtsprechung der Unionsgerichte und US-Gerichte**

  - **Gericht der Europäischen Union (EuG):** Urteil vom 03.09.2025, Philippe Latombe gegen Europäische Kommission, Rechtssache T-553/23, ECLI:EU:T:2025:620 (Bestätigung des DPF)17.
  - **Gerichtshof der Europäischen Union (EuGH):** Anhängige Rechtsbeschwerde Latombe gegen Kommission, Rechtssache C-703/25 P (eingereicht Oktober 2025)21.
  - **Supreme Court of the United States:** Urteil vom 29.06.2026, *Donald J. Trump v. Slaughter et al.*, 608 U.S. \_\_\_ (2026) (Entzug des Kündigungsschutzes von FTC-Kommissaren)19.

### **Leitlinien von Aufsichtsbehörden und Fachverbänden**

  - **Datenschutzkonferenz (DSK):** Orientierungshilfe "Künstliche Intelligenz und Datenschutz", verabschiedet am 06.05.2024, fortgeführt durch Orientierungshilfen zu RAG und LLMs (Oktober 2025), <https://www.datenschutzkonferenz-online.de/orientierungshilfen.html>13.
  - **Bundessteuerberaterkammer (BStBK):** FAQ-Katalog und Praxisleitfaden "Künstliche Intelligenz in der Steuerberatungskanzlei: Berufsrecht, Datenschutz und Verschwiegenheitspflichten", Stand: 27.01.2026, <https://www.bstbk.de/de/themen/digitalisierung/>35.
  - **Bundesamt für Sicherheit in der Informationstechnik (BSI):** Kriterienkatalog Cloud Computing C5:2020 sowie Lagebericht zur IT-Sicherheit in Deutschland, <https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Informationen-und-Empfehlungen/Empfehlungen-nach-Angriffszielen/Cloud-Computing/Kriterienkatalog-C5/kriterienkatalog-c5_node.html>37.
  - **Bitkom e. V.:** Studie "Künstliche Intelligenz und Cloud-Souveränität in der deutschen Wirtschaft", Veröffentlichungsstand 2025/2026, <https://www.bitkom.org/Themen/Technologien/Kuenstliche-Intelligenz>.

#### **Referenzen**

1.  Simplification of the AI Act (digital omnibus) - Gleiss Lutz, <https://www.gleisslutz.com/en/know-how/simplification-ai-act-digital-omnibus>
2.  How the new Product Liability Directive turns AI Act compliance into, <https://www.freshfields.com/en/our-thinking/blogs/risk-and-compliance/product-risks-today-how-the-new-product-liability-directive-turns-ai-act-complia-102mpu2>
3.  AI\_CEO\_MODUL.md
4.  EU Product Liability Directive for AI and Software Sellers - Euverify, <https://euverify.com/resource/eu-product-liability-ai-software/>
5.  The Digital AI Omnibus: Proposed deferral of high risk AI obligations, <https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/The-Digital-AI-Omnibus-Proposed-deferral-of-high-risk-AI-obligations-under-the-AI-Act>
6.  KI-Verordnung: Was Unternehmen wirklich tun müssen - KI Stellwerk, <https://kistellwerk.de/ki-verordnung.html>
7.  EU AI Act: key amendments adopted under the Digital Omnibus, <https://www.loyensloeff.com/insights/news--events/news/eu-ai-act-key-amendments-adopted-under-digital-omnibus-package/>
8.  Digital Omnibus: What Changed in the EU AI Act, <https://www.trail-ml.com/blog/eu-ai-act-digital-omnibus-changes>
9.  AI Compliance 2026: What the Digital Omnibus Act Really Means for, <https://www.heuking.de/en/news-events/newsletter-articles/detail/ai-compliance-2026-what-the-digital-omnibus-act-really-means-for-businesses.html>
10. §203 StGB und Cloud-KI: Was Kanzleien wissen müssen, <https://visionarydata.de/blog/203-stgb-cloud-ki-steuerberater>
11. Trust Center: DSGVO und § 203 StGB | Clara by Intoconvo, <https://clara-agent.de/trust-center>
12. KI & Datenschutz 2025: Wie Unternehmen Künstliche Intelligenz, <https://www.anwalt-daum.de/ki-datenschutz-2025-unternehmen-rechtssicher-einsetzen/>
13. Art. 22 DSGVO und KI: Was der AI Act nicht ersetzt - aware7, <https://a7.de/blog/art-22-dsgvo-ki-entscheidungen-ai-act/>
14. ChatGPT und Co. im Unternehmen DSGVO-konform nutzen, <https://www.kiconsulting.nrw/wissen/ki-datenschutz-chatgpt-unternehmen>
15. KI-Compliance in der Kanzlei: Das gilt für den rechtssicheren Einsatz, <https://www.taxandbytes.de/360/ki-compliance-kanzlei-ki-rechtssicher-einsetzen>
16. KI für Steuerberater: § 62a StBerG, § 203 StGB | ArkeonTech, <https://arkeontech.de/blog/ki-steuerkanzlei-verschwiegenheitspflicht-2026/>
17. EU-US Data Privacy Framework Confirmed Valid by EU General, <https://streamlex.eu/news/general-court-ruling-latombe-commission/>
18. European General Court dismisses Latombe challenge, upholds EU, <https://iapp.org/news/a/european-general-court-dismisses-latombe-challenge-upholds-eu-us-data-privacy-framework>
19. EU-U.S. Data Privacy Framework at risk following U.S. Supreme, <https://www.activemind.legal/guides/dpf-supreme-court/>
20. US Supreme Court just blew up EU-US Data Transfers - NOYB, <https://noyb.eu/en/us-supreme-court-just-blew-eu-us-data-transfers>
21. EU-US Data Privacy Framework Risk 2026: What Changed, <https://secureprivacy.ai/blog/is-the-eu-us-data-privacy-framework-at-risk-the-ftc-ruling-explained-2026>
22. Selbstständige Buchhalter nicht zur Erstellung von Umsatzsteuer, <https://rsw.beck.de/zeitschriften/bc/news-beitraege/2023/08/11/selbstst%C3%A4ndige-buchhalter-nicht-zur-erstellung-von-umsatzsteuer-voranmeldungen-berechtigt>
23. Finanzgericht Köln, 13 K 1624/22, <https://nrwe.justiz.nrw.de/fgs/koeln/j2025/13_K_1624_22_Urteil_20250807.html>
24. MDCG 2019-11: Software als Medizinprodukt richtig qualifizieren, <https://www.mediacc.de/medizinprodukte-wiki/mdcg-2019-11-leitfaden-zur-qualifizierung-und-klassifizierung-von-software-unter-mdr-ivdr>
25. Gesetz zur Durchführung der KI-Verordnung - BTZusFas, <https://bundestagszusammenfasser.de/details?docid=1018>
26. AI Omnibus enters into force | Shaping Europe's digital future, <https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force>
27. Digital Omnibus on AI has been published - Cuatrecasas, <https://www.cuatrecasas.com/en/global/intellectual-property/art/digital-omnibus-ai-has-been-published>
28. Deutscher Bundestag Drucksache 21/4594 Gesetzentwurf der, <https://dserver.bundestag.de/btd/21/045/2104594.pdf>
29. Gesetz zur Durchführung der Verordnung über künstliche Intelligenz, <https://www.beckmannundnorda.de/serendipity/index.php?/archives/7796-Gesetz-zur-Durchfuehrung-der-Verordnung-ueber-kuenstliche-Intelligenz-wurde-am-28.07.2026-im-Bundesgesetzblatt-veroeffentlicht..html>
30. Gesetzentwurf der Bundesregierung, <https://bmds.bund.de/fileadmin/BMDS/Dokumente/Gesetzesvorhaben/260209_RegE_KI-MIG_final_barr.pdf>
31. AI Act - Tagesspiegel Background, <https://background.tagesspiegel.de/tag/ai-act>
32. KI im Betrieb: Wann muss der Betriebsrat mitbestimmen? - Anwalt.de, <https://www.anwalt.de/rechtstipps/ki-im-betrieb-wann-muss-der-betriebsrat-mitbestimmen-273490.html>
33. Is the Data Privacy Framework still valid after Slaughter?, <https://corp-intl.com/news/is-the-data-privacy-framework-still-valid>
34. Is Mailchimp still GDPR-proof in 2026? - Maileon, <https://maileon.com/blogs/is-mailchimp-still-gdpr-proof/>
35. KI für Steuerberater: Wo 2026 wirklich Stunden gespart werden, <https://bluebatch.io/blog/ki-steuerberater>
36. Product Liability Directive (EU) | AI Guide - Superkind, <https://superkind.ai/ai-lexicon/product-liability-directive>
37. § 203 StGB in der Public Cloud: Azure, AWS und ... - innFactory, <https://innfactory.de/de/blog/138-berufsgeheimnis-203-stgb-public-cloud/>
38. Digital health apps and telemedicine in Romania | CMS Expert Guides, <https://cms.law/en/int/expert-guides/cms-expert-guide-to-digital-health-apps-and-telemedicine/romania>
39. Directive (EU) 2024/2853 of the European Parliament ... - EUR-Lex, <https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32024L2853>
40. Datenschutz bei KI-Projekten in der bayerischen Verwaltung, <https://www.datenschutz-bayern.de/ki/OH_KI.pdf>
