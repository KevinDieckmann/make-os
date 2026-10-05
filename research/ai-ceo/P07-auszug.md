# P07 · Recht, Datenschutz, Sicherheit — Auszug und Prüfung

- **Volltext:** `P07-recht.md` · Drive: https://docs.google.com/document/d/1uhN7V8-5xtlnpo6ffuNCBo3RhTbO36y-fTSfZXzTGhw
- **Quelle:** Gemini Deep Research (Auftrag P7), ungeprüft; Auszug, Stichproben und Abgleich mit `DATENSCHUTZ_APP.md`: 05.10.2026
- **Gelesen:** 100 % des Textes (40 Referenzen + Quellenliste). **Keine Rechtsberatung** — alles mit „Kevin muss“ oder ⚠ gehört vor dem ersten Kunden zum Anwalt.

> **Vorbehalte vorweg:**
> 1. Referenz 3 ist **unsere eigene Datei `AI_CEO_MODUL.md`** — wo Gemini mit „3“ belegt (z. B. „Hash-Kette erfüllt GoBD“, „Einwilligungsmodell rechtskonform“), ist das **unsere Behauptung, zurückgespiegelt**, keine Prüfung.
> 2. Viele Sekundärquellen sind Kanzlei-/Anbieter-Blogs; Primärquellen (EUR-Lex, gesetze-im-internet) sind nur in der Quellenliste genannt.
> 3. Die DACH-Umfragewerte (82 %/88 %/76 %/71 %) haben **keine** Quelle und waren nicht auffindbar.

---

## 1. Kernaussagen

| # | Aussage | Beleg | Einordnung |
|---|---|---|---|
| 1 | MAKE OS ist nach KI-VO **kein Hochrisiko-System** (Büro, Kalender, CRM, Finanzübersicht, Lifestyle), sondern „begrenztes Risiko“ mit Transparenzpflichten. Grenze: sobald Funktionen **Beschäftigte bewerten/überwachen** (Anhang III Nr. 4), droht Hochrisiko. | KI-VO Art. 6, Anhang III; [3] | **Schätzung** (plausibel; anwaltlich bestätigen) |
| 2 | Art. 50 Abs. 1: Nutzer müssen erkennen, dass sie mit KI (ZOE) sprechen — gilt seit 02.08.2026. | KI-VO, Omnibus | **Fakt — bestätigt** |
| 3 | Art. 50 Abs. 2: KI-erzeugte Inhalte maschinenlesbar kennzeichnen — „Schonfrist bis 02.12.2026“. | Omnibus [7] | **abweichend**: Die Frist 02.12.2026 gilt nur für Systeme, die **vor dem 02.08.2026** in Verkehr waren. Was danach neu auf den Markt kommt, muss **ab Inverkehrbringen** kennzeichnen. |
| 4 | Art. 4 KI-Kompetenz: durch den Omnibus von „sicherstellen“ zu „Maßnahmen zur Förderung“ abgeschwächt (Bemühenspflicht). | Omnibus [8] | **Fakt — bestätigt** |
| 5 | Rollen: Für Kundendaten in der Kunden-Instanz ist MAKE Innovation **Auftragsverarbeiter** (AVV Pflicht, Art. 28 Abs. 3), für eigene Vertrags-/Konto-/Plattformdaten **Verantwortlicher**. Zwei Verzeichnisse (Art. 30 Abs. 1 und 2). | DSGVO | **Fakt** (Standardauslegung) |
| 6 | Art. 22: Das Zwischenschalten eines Menschen hilft nur, wenn er **echte Prüfkompetenz** hat und nicht nur abnickt (DSK-Orientierungshilfe KI 2024). Freigabe-Karten brauchen Vorher/Nachher, Daten, Begründung. | DSK OH KI [12,13] | **Fakt** (DSK-Position) |
| 7 | **DSFA (Art. 35) ist praktisch Pflicht** (Gesundheitsdaten, Bewertung von Kapazität/Leistung, neue Technik). Kunden brauchen ein **DSFA-Muster** von uns. | Art. 35 Abs. 3, DSK-Muss-Liste | **Schätzung** (für Gesundheit + KI sehr wahrscheinlich) |
| 8 | **§ 38 Abs. 1 S. 2 BDSG:** Wer DSFA-pflichtige Verarbeitungen macht, braucht einen **Datenschutzbeauftragten unabhängig von der Personenzahl**. | BDSG | **Fakt — bestätigt** (Wortlaut geprüft); Folge für uns hängt an Punkt 7 |
| 9 | USA-Übermittlung: DPF formal gültig (EuG *Latombe*, 03.09.2025), Rechtsmittel beim EuGH anhängig (C-703/25 P); *Trump v. Slaughter* (29.06.2026) nimmt der FTC die Unabhängigkeit → DPF wackelt. Daher SCC als Rückfall, TIA, Zero-Data-Retention, ggf. EU-Inferenz. | EuG, EuGH, US Supreme Court | **Fakt — bestätigt** (Urteile/Daten); Folgen fürs DPF **Meinung** |
| 10 | Claude ist über AWS Bedrock/Google Vertex in EU-Regionen nutzbar. | [11] | **teilweise bestätigt** — EU-Regionen gibt es, echte In-Region-Verarbeitung **je Modell unterschiedlich** ⚠ für Haiku 4.5/Sonnet 5/Opus 5.5 prüfen |
| 11 | § 7 UWG: keine B2B-Ausnahme für Kalt-Mails; Agenten nur Entwürfe, Versand nur mit dokumentierter Einwilligung bzw. § 7 Abs. 3. | UWG | **Fakt** |
| 12 | Steuerberatung: Software darf rechnen, sortieren, vorbereiten — keine materielle steuerliche Würdigung (§ 5 StBerG). Head of Finance als „vorbereitend“ deklarieren. | StBerG, BFH II R 22/15 | **Fakt** (Grundsatz); BFH-Fundstelle ⚠ nicht geprüft |
| 13 | **§ 62a StBerG / § 203 StGB:** Steuerberater dürfen IT-Dienstleister nur nutzen, wenn diese **in Textform zur Verschwiegenheit verpflichtet und über Strafbarkeit belehrt** sind; ein AVV allein reicht nicht → eigenes Verpflichtungsdokument nötig. | StBerG, StGB [10,16,37] | **Fakt** (Normlage) — wichtig für Phase 3.2 (Steuerberater-Zugang) |
| 14 | Produkthaftung neu (RL 2024/2853): Software/SaaS ist Produkt, verschuldensunabhängige Haftung, Umsetzung bis 09.12.2026; Haftungsausschluss gegenüber Geschädigten unwirksam; Beweiserleichterungen bei Komplexität. | PLD [2,4] | **Fakt** (Kern) · ⚠ Lücke: Datenverlust ist nach PLD nur ersatzfähig, wenn die Daten **nicht beruflich** genutzt werden — im Bericht nicht erwähnt; Aussage „mit Freigabe haftet primär der Nutzer“ ist **Meinung** |
| 15 | Wellbeing ≠ Medizinprodukt, solange keine Diagnose/Therapie-Empfehlung; zulässig sind relative Hinweise („Erholung 12 % unter deinem Mittel → leichtere Aufgaben“); Hinweis „kein Medizinprodukt“ empfohlen. | MDR Art. 2, Regel 11, MDCG 2019-11 | **Fakt** (Abgrenzung) |
| 16 | CRA: reines SaaS nicht erfasst; **der Mac-Zulieferer** kann als installierbare Software ein „Produkt mit digitalen Elementen“ sein. NIS2 trifft uns nicht direkt, aber über Kunden-Lieferketten. | CRA, NIS2 | **Schätzung** (plausibel) |
| 17 | Werbeaussagen: nicht „100 % DSGVO-konform“, sondern präzise und belegbar formulieren (Irreführung § 5 UWG). Formulierungstabelle im Volltext. | UWG | **Meinung** (gute Praxis) |

---

## 2. Zahlen und Fristen

| Pflicht / Größe | Wert / Frist | Quelle | Stand | Belastbarkeit |
|---|---|---|---|---|
| KI-VO in Kraft | 01.08.2024 | VO (EU) 2024/1689 | — | bestätigt |
| Verbote Art. 5, KI-Kompetenz Art. 4 | seit 02.02.2025 | KI-VO | — | bestätigt |
| GPAI-Pflichten (Anthropic, nicht wir) | seit 02.08.2025 | KI-VO Art. 51 ff. | — | bestätigt |
| **Digital Omnibus KI** | VO (EU) **2026/1744**, in Kraft **27.07.2026** | Kommission, Kanzleien | 07/2026 | **bestätigt** (Bericht nennt die VO-Nummer nicht; „angenommen 08.07.2026“ nicht geprüft) |
| Art. 50 Abs. 1 (KI-Dialog erkennbar) | seit **02.08.2026** | KI-VO | — | **bestätigt** |
| Art. 50 Abs. 2 (maschinenlesbare Kennzeichnung) | 02.12.2026 **nur für vor dem 02.08.2026 in Verkehr gebrachte Systeme**; sonst ab Inverkehrbringen | Omnibus | 07/2026 | ⚠ prüfen — **Bericht verkürzt**; für neue Kunden-Instanzen gilt die Pflicht sofort |
| Hochrisiko Anhang III | **02.12.2027** | Omnibus | 07/2026 | bestätigt (für uns voraussichtlich nicht einschlägig) |
| Hochrisiko Anhang I | **02.08.2028** | Omnibus | 07/2026 | bestätigt |
| Deutsches KI-Durchführungsgesetz (KI-MIG) | Bericht: BGBl. I 2026 Nr. 245 vom 28.07.2026, „KI-Marktüberwachungskammer“ | — | — | ⚠ **abweichend im Detail**: Gesetz vom 22.07.2026, BGBl. 2026 I Nr. 223, in Kraft 29.07.2026; Bundesnetzagentur mit Koordinierungszentrum (KoKIVO) |
| DPF — EuG *Latombe* | 03.09.2025, T-553/23 | EuG | — | bestätigt |
| DPF — Rechtsmittel | C-703/25 P, eingelegt 31.10.2025, anhängig | EuGH | — | bestätigt |
| *Trump v. Slaughter* | 29.06.2026 | US Supreme Court | — | bestätigt |
| Datenpanne an Behörde | 72 h (Art. 33) | DSGVO | — | bestätigt (Gesetzestext) |
| DSB-Pflicht | ab 20 Personen **oder** unabhängig davon bei DSFA-pflichtiger Verarbeitung | § 38 BDSG | — | **bestätigt** (Wortlaut) |
| Produkthaftungs-RL Umsetzung | 09.12.2026 | RL 2024/2853 | — | bestätigt (nach unserem Wissen; Artikelnummern im Bericht ⚠ nicht geprüft) |
| CRA | Bericht: „Meldepflichten 2026, voll Herbst 2027“ | VO 2024/2847 | — | ⚠ prüfen — nach unserem Wissen Meldepflichten ab **11.09.2026**, volle Geltung **11.12.2027** |
| ISO 27001 | „6–9 Monate“ mit Automatisierungs-Werkzeugen | Gemini | — | Schätzung ohne Beleg |
| BSI C5 | „sechsstellig“ | [37] | — | Schätzung |
| DACH-Kaufkriterien | 82 % EU-Server · 88 % kein Training · 76 % § 203 · 71 % Black-Box | „Bitkom/BSI/eco“ ohne Link | — | ⚠ **nicht auffindbar** — nicht verwenden |
| GoBD-Aufbewahrung | (im Bericht nicht genannt) 8/10 Jahre nach § 147 AO | AO | — | Fakt (unser Wissen) |

---

## 3. Stichprobenprüfung (05.10.2026)

| Aussage | Ergebnis | Beleg |
|---|---|---|
| Omnibus in Kraft 27.07.2026; Hochrisiko 02.12.2027 / 02.08.2028 | **bestätigt** (VO (EU) 2026/1744) | [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/), [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/), [Kommission](https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force) |
| Art. 50 Abs. 2 Schonfrist bis 02.12.2026 | **abweichend** — nur Bestandssysteme vor 02.08.2026 | [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/) |
| Art. 4 abgeschwächt | **bestätigt** | [lawandtechnology.eu](https://lawandtechnology.eu/en/ai-literacy-digital-omnibus-article-4-ai-act/) |
| *Latombe* / C-703/25 P / *Slaughter* | **bestätigt** | [Digital Policy Alert](https://digitalpolicyalert.org/event/35459-latombe-filed-appeal-against-general-court-dismissal-of-challenge-to-european-unionunited-states-data-protection-framework-adequacy-decision-in-latombe-v-commission), [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/6/supreme-court-decides-trump-v-slaughter), [ICTLC zu DPF](https://ictlc.com/trump-v-slaughter-and-the-eu-u-s-data-privacy-framework/?lang=en) |
| KI-MIG BGBl./Datum | **abweichend im Detail** | [gesetze-im-internet KI-MIG](https://www.gesetze-im-internet.de/ki-mig/BJNR0DF0B0026.html), [medhochzwei](https://www.medhochzwei-verlag.de/News/Details/203095), [BMDS](https://bmds.bund.de/aktuelles/pressemitteilungen/detail/neues-ki-gesetz-tritt-in-kraft) |
| § 38 Abs. 1 S. 2 BDSG | **bestätigt** (Wortlaut) | [gesetze-im-internet § 38 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/__38.html) |
| Claude in EU-Rechenzentren | **teilweise** — je Modell/Region verschieden | [Claude in Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock), [Requesty](https://www.requesty.ai/blog/claude-eu-data-residency-bedrock-quota-fallback-regions) |
| Bitkom-Prozentwerte | **nicht auffindbar** (Bitkom 2026 berichtet andere Kennzahlen, z. B. KI-Nutzung) | [Bitkom KI-Studie 2026](https://www.bitkom.org/sites/main/files/2026-02/bitkom-studienbericht-ki.pdf) |

---

## 4. Was das für MAKE OS heißt — Pflichten-Checkliste

Status: **haben wir** (gebaut laut `DATENSCHUTZ_APP.md`) · **teilweise** · **fehlt** (Bauarbeit) · **Kevin muss** (Entscheidung, Vertrag, Anwalt).

### A. Vor dem ersten Kunden

| Pflicht | Norm | Status | Was konkret |
|---|---|---|---|
| ZOE als KI erkennbar | KI-VO Art. 50 Abs. 1 | **haben wir** | „· KI“ an ZOE, `KiMarke` |
| KI-Texte maschinenlesbar kennzeichnen | Art. 50 Abs. 2 | **teilweise** | intern Kennzeichen `ki` + „KI-Entwurf“; **fehlt** für Texte, die das System verlassen (versendete Mails, Exporte, Newsletter) — z. B. Kopfzeile/Metadaten. Gilt für neue Kunden **ab Verkauf**. ⚠ Anwalt: greift die Ausnahme „unterstützende Bearbeitung“, wenn der Mensch jeden Entwurf prüft? |
| KI-Kompetenz (Bemühen) | Art. 4 | **Kevin muss** | kurze Schulung/Nachweis für uns; Nutzungshinweise für Kunden (Grenzen, Halluzinationen, Injection) |
| Verantwortlicher eingetragen | DSGVO | **teilweise** | Feld gebaut; Eintrag in unserer Instanz und Adresse im Hinweis fehlen (`[[KEVIN: Adresse]]`) |
| AVV-Vorlage für Kunden (mit TOM, Unterauftragsverarbeitern) | Art. 28 Abs. 3 | **fehlt** | steht schon als Lücke in B8 |
| AVVs mit unseren Dienstleistern (Hetzner, Anthropic, Google, Microsoft, GitHub …) | Art. 28 | **Kevin muss** | Register gebaut, Status „offen“ |
| Verzeichnis als Auftragsverarbeiter | Art. 30 Abs. 2 | **fehlt** | Instanz-Verzeichnis (Abs. 1) haben wir; das eigene der MAKE Innovation als AV nicht |
| Datenschutzhinweis der Anwendung | Art. 13 | **teilweise** | Entwurf in Abschnitt 4 von `DATENSCHUTZ_APP.md`, nicht veröffentlicht; Anwalt |
| Art.-14-Information | Art. 14 | **haben wir** | Vorlage, Frist-Uhr |
| Gesundheit: drei getrennte Einwilligungen | Art. 9 Abs. 2 a, Art. 7 | **haben wir** | Texte anwaltlich gegenlesen (offen) |
| Keine Entscheidung nach Art. 22, echte Prüfung | Art. 22, DSK | **teilweise** | Stapel + Vorher/Nachher + ehrliche Art.-15-Beschreibung gebaut; Begründung/Daten je Karte (D12) und „Folgen bei Nichtentscheidung“ (D5) noch Plan |
| **DSFA** für unsere Verarbeitung + **DSFA-Muster** für Kunden | Art. 35 | **fehlt** | Gesundheit (Art. 9) + KI + Kapazitäts-„Bewertung“ |
| **Datenschutzbeauftragter** | § 38 Abs. 1 S. 2 BDSG | **Kevin muss** | wenn DSFA-pflichtig → DSB unabhängig von der Kopfzahl (extern möglich) |
| Drittland USA: SCC + **TIA** | Art. 44 ff., 46 | **teilweise** | Empfänger-Register mit Drittland/Garantie gebaut; TIA-Dokument **fehlt** |
| Zero-Data-Retention / kein Training bei Anthropic | Art. 28, 32 | **Kevin muss** | steht als offener Punkt („Aufbewahrung der API-Daten bei Anthropic im AVV prüfen“) |
| Option EU-Inferenz (Bedrock/Vertex) | — | **Kevin muss** (Entscheidung) | Modelle je Region prüfen; Wechsel ändert Vertragspartner und Preise; Modellstufen sind gekapselt (`lib/agent-config.ts`) |
| Pseudonymisierung | Art. 25, 32 | **teilweise** | Hintergrund-Läufe ja; Research und ZOE-Gespräche nein (bekannte Lücke) |
| Verschlüsselung, Protokolle, Trennung Privat/Business | Art. 25, 32 | **haben wir** | AES-256-GCM, Hash-Kette, Routen-Register, Wächtertests |
| Pannen-Register + Meldeweg | Art. 33/34 | **teilweise** | Register gebaut; **Ablauf „Kunde unverzüglich informieren“** als Auftragsverarbeiter fehlt |
| § 7 UWG | UWG | **haben wir** | Prüfer, Werbesperre, Double-Opt-in, Entwurf + Einzelklick, Abmeldelink |
| Endgerät-Speicherung nur technisch nötig | § 25 TDDDG | ⚠ prüfen | welche Cookies/localStorage nutzt die App? wenn nur Sitzung/Sicherheit → kein Banner nötig |
| Head of Finance nur vorbereitend | § 5 StBerG | **teilweise** | Vorschläge statt Entscheidungen gebaut; Hinweis in Oberfläche + AGB **fehlt** |
| Kein Medizinprodukt | MDR | **teilweise** | Energie nur als Hinweis, nie Bewertung (D7); **Hinweistext „kein Medizinprodukt“ fehlt**; Regel „keine Diagnosen/Dosis-Empfehlungen“ in Prompts von Health-/Ernährungs-Agent festschreiben |
| **AGB** (Leistungsbeschreibung, keine Rechts-/Steuer-/Medizinberatung, Prüfpflicht bei Freigabe, Haftung B2B) | §§ 305 ff. BGB | **fehlt** / **Kevin muss** | Anwalt |

### B. Im ersten Jahr

| Pflicht | Status | Was konkret |
|---|---|---|
| **§ 62a StBerG-/§ 203-StGB-Verpflichtung** als Vorlage | **fehlt** | Voraussetzung für Phase 3.2 (Steuerberater als externer Nutzer) und für Kunden, die selbst Berufsgeheimnisträger sind; klären, ob Anthropic als Unter-Dienstleister einbezogen werden muss |
| Produkthaftung: Update-/Schwachstellenprozess dokumentieren | **teilweise** | Head of IT, Rückweg-Bilder, Ausroll-Protokoll vorhanden; Schwachstellen-Prozess als Dokument fehlt |
| Trust-Center (Seite: Architektur, TOM, Unterauftragsverarbeiter) | **fehlt** | erst nach Marktreife (Kevins Website-Regel) |
| Quartalsweise Prüfung Drittland-Risiko (DPF-Verfahren) | **Kevin muss** | Termin in Rhythmus (Quartal) |
| CRA-Prüfung Mac-Zulieferer | **Kevin muss** | nur relevant, wenn Kunden ihn bekommen; Alternative CalDAV/CardDAV |
| Einwilligungs-Nachweis nach Kontoende löschen (3 J.) | **fehlt** | steht als offener Punkt |
| GoBD | ⚠ | Bericht behauptet „Hash-Kette erfüllt GoBD“ — **Selbstzitat, nicht belegt**; GoBD verlangt u. a. Verfahrensdokumentation und Aufbewahrung; mit Steuerberater klären, ob unsere Buchungen überhaupt Buchführung im Sinne der AO sind |

### C. Später

ISO 27001 (Prio für Vertrieb an Kanzleien), KMS/HSM-Schlüssel für Firmenkunden, BSI C5 nur bei regulierten Kunden, TISAX nie.

### Verkaufsargumente (vorsichtig formuliert, aus dem Bericht)
- „KI bereitet vor, Sie entscheiden — nichts geht ohne Ihren Klick nach außen.“
- „Eigene, verschlüsselte Instanz auf Servern in Deutschland.“ (Hetzner-Zertifikate selbst prüfen, bevor wir sie nennen)
- „Kein Training mit Ihren Daten“ — **erst sagen, wenn ZDR/Vertrag mit Anthropic belegt ist.**
- Nie: „100 % DSGVO-konform“, „rechtssichere KI“, „erkennt Burnout“.

---

## 5. Abgleich mit `AI_CEO_MODUL.md`

| Abschnitt | Ergebnis |
|---|---|
| B2.3 Datenschutz eingebaut | **bestätigt** als starke Basis; **ergänzt** um DSFA, DSB-Frage, TIA, AV-Verzeichnis, AGB, § 62a-Vorlage |
| B8 „Rechtliches: AVV-Vorlage, Datenschutzhinweis, KI-VO-Einordnung anwaltlich prüfen“ | **bestätigt**; Liste deutlich länger (siehe Checkliste A) |
| D13 „vermutlich geringes Risiko“ | **bestätigt** (begrenztes Risiko + Art. 50), mit Warnung: Head of People / Kapazität dürfen keine **Beschäftigten bewerten** (Anhang III Nr. 4) — relevant, sobald Kunden Angestellte führen |
| D6 / Phase 3.2 Externe Steuerberater | **ergänzt**: § 62a StBerG/§ 203 StGB-Verpflichtung ist Voraussetzung, AVV reicht nicht |
| D7 Balance, Energie nur Hinweis | **bestätigt** (MDR-Grenze); ergänzt um Hinweistext „kein Medizinprodukt“ |
| B4.2 Head of Finance, Steuern | **ergänzt**: als vorbereitend kennzeichnen (§ 5 StBerG) |
| C4 Prinzip 1 „Mensch entscheidet“ | **bestätigt** — rechtlich doppelt wertvoll (Art. 22 DSGVO, § 7 UWG, Haftung) |
| B7 Kanäle: Apple über Mac-Zulieferer | **ergänzt**: CRA-Frage, falls an Kunden ausgeliefert |
| I2 Risiko „Rechtliche Unklarheit KI-VO/DSGVO“ | **ergänzt**: DPF-Wackeln (*Slaughter*) als eigenes Risiko mit Gegenmittel EU-Inferenz/SCC |
| G4 Kaufgrund „Datenschutz und eigene Instanz in Europa“ | **gestützt**, aber die Umfragezahlen des Berichts sind **nicht belegt** |

---

## 6. Offene Fragen und Lücken

1. **Art. 50 Abs. 2 für uns:** Gilt die Pflicht für Entwürfe, die der Mensch vor dem Versand prüft und ändert? Wie kennzeichnen wir Mails maschinenlesbar, ohne Empfänger zu irritieren? (Anwalt)
2. **DSFA-Pflicht und DSB:** Lösen Gesundheitsdaten eines Haushalts + KI wirklich „umfangreiche“ Verarbeitung aus? Davon hängt § 38 BDSG ab.
3. **Rolle bei Privatdaten der Kunden:** Bericht nimmt Auftragsverarbeitung auch für private Daten an (Haushaltsausnahme des Kunden) — anwaltlich bestätigen, besonders für Partner-Daten (Malin-Fall).
4. **PLD und Datenverlust bei Geschäftsdaten** — im Bericht nicht differenziert.
5. **Claude in der EU:** Welche unserer drei Modelle laufen echt in-region (Frankfurt), zu welchem Preis, mit welchem Vertragspartner?
6. **Einwilligung Erholung bei Beschäftigten** (§ 26 BDSG) — schon offen in `DATENSCHUTZ_APP.md`, vom Bericht bekräftigt.
7. **GoBD/Buchungen** — mit Steuerberater (Jörg) klären.
8. Die deutsche KI-Aufsicht (KI-MIG) — Pflichten für uns gegenüber der Bundesnetzagentur (Dokumentation nach Art. 50) konkret nachlesen.
