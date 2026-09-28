# CRM-Fehler-Prüfliste — typische Bau-Fehler beim Programmieren eines CRM

**Stand:** 28.09.2026 · **Zweck:** Prüfliste, gegen die das MAKE-OS-CRM (Kontakte, Firmen, Leads/Score, Deals/Pipeline, Mandate, Rechnungen, Follow-ups, Aktivitäten, Kampagnen/Segmente, Events, Masterlisten-Import, KI-Assistent, JSON-Speicher mit Sperren, Next.js) geprüft wird. Es geht um technische und fachliche Bau-Fehler von Entwicklern, nicht um Einführungsfehler von Anwendern.
**Format je Punkt:** Kurztitel · was schiefgeht · *Prüfen:* woran man es im Code oder Verhalten erkennt · *Quelle*. „(ergänzt)“ heißt: eigene Übertragung auf dieses CRM, nur der Kern ist in der Quelle belegt.
**Hinweis:** Rechtliche Punkte sind Recherche-Stand und keine Rechtsberatung. Zusammengestellt per Web-Recherche (Agent „mt-research“), noch nicht gegen den Code geprüft — Abgleich siehe `CRM_FEHLER_ABGLEICH.md`.

---

## 1 · Datenmodell (10)

1. **Deal kennt nur einen Kontakt.** Buying Groups haben mehrere Entscheider mit Rollen; ein einzelnes `contactId` erzwingt später den Umbau. *Prüfen:* Deal hat `contactId` statt Liste `{contactId, rolle}`. *Quelle:* https://resources.rework.com/guides/crm-implementation/crm-data-model-design
2. **Kontakt hängt fest an genau einer Firma.** Beiräte, Holdings, Mehrfachmandate lassen sich nicht abbilden. *Prüfen:* nur `contact.companyId`, keine Verknüpfung Kontakt↔Firma mit Label. *Quelle:* https://resources.rework.com/guides/crm-implementation/crm-data-model-design · https://blog.hubspot.com/marketing/crm-data-model
3. **Firmenwechsel überschreibt die Historie.** Beim Jobwechsel werden Firma und Titel überschrieben; frühere Beziehung und Aktivitäten „wandern mit“. *Prüfen:* keine Beschäftigung mit Start/Ende/Status. *Quelle:* https://www.openprisetech.com/blog/salesforce-contact-job-changes
4. **Lead und Kontakt als getrennte, doppelt gepflegte Objekte.** Bei der Konvertierung entstehen Dubletten, die Lead-Quelle geht verloren. *Prüfen:* getrennte Sammlungen mit gleichen Feldern; Konvertierung kopiert statt Status zu wechseln; `source` fehlt am Kontakt. *Quelle:* https://2x.com/blog/how-to-eliminate-salesforce-lead-object-problem/ · https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/
5. **Firma als Freitext am Lead.** Keine echte Verknüpfung zum Firmen-Datensatz. *Prüfen:* `lead.company: string` statt `companyId`. *Quelle:* https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/
6. **Aktivität nur an einem Objekt.** Ein Anruf hängt am Kontakt und fehlt in der Zeitlinie von Firma und Deal. *Prüfen:* Aktivität hat genau ein Fremdschlüsselfeld; Firmen-Zeitlinie zeigt keine Kontakt-Aktivitäten. *Quelle:* https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/
7. **Keine Firmenhierarchie.** Mutter/Tochter/Holding nicht abbildbar; Umsätze falsch aggregiert. *Prüfen:* kein `parentCompanyId`. *Quelle:* https://resources.rework.com/guides/crm-implementation/crm-data-model-design
8. **Eigene Felder als untypisierte Schlüssel-Wert-Strings (EAV).** Filtern/Sortieren teuer und falsch („1000“ < „200“). *Prüfen:* `customFields: Record<string,string>` ohne Typdefinition. *Quelle:* https://coussej.github.io/2016/01/14/Replacing-EAV-with-JSONB-in-PostgreSQL/
9. **Feldfriedhof „für später“.** Halb leere Datensätze täuschen Vollständigkeit vor. *Prüfen:* Befüllungsgrad je Feld; Felder unter ca. 10–20 % ohne Nutzer. *Quelle:* https://resources.rework.com/guides/crm-implementation/crm-data-model-design
10. **Falsche Feldtypen.** Beträge und Datum als String zerstören Rechnung und Sortierung. *Prüfen:* `typeof amount === 'string'`, Datum als `"03.04.2026"`. *Quelle:* https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/

## 2 · Identität & Dubletten (9)

11. **Annahme „eine Person = eine E-Mail“.** Mehrere/wechselnde Adressen, Sammeladressen. *Prüfen:* E-Mail als Primärschlüssel; kein `emails[]`; `info@` als Person dedupliziert. *Quelle:* https://beesbuzz.biz/code/439-Falsehoods-programmers-believe-about-email
12. **Kontaktkanäle nicht normalisiert.** `Max@X.de ` ≠ `max@x.de`, `0170…` ≠ `+49 170…`. *Prüfen:* kein `trim().toLowerCase()` vor Vergleich; Telefon nicht E.164. *Quelle:* https://www.routine.co/blog/posts/deduplicate-crm-ai-fuzzy-merge · https://github.com/google/libphonenumber/blob/master/FAQ.md
13. **Unicode nicht normalisiert (NFC/NFD).** „Müller“ (NFD, macOS/Import) ≠ „Müller“ (NFC). *Prüfen:* fehlendes `.normalize('NFC')`. *Quelle:* https://symbolfyi.com/guides/unicode-normalization-guide/
14. **Firmennamen/Rechtsformen nicht normalisiert.** „Muster GmbH“, „Muster G.m.b.H.“, „Muster GmbH & Co. KG“ werden drei Firmen. *Prüfen:* Dublettenprüfung vergleicht Rohnamen. *Quelle:* https://www.routine.co/blog/posts/deduplicate-crm-ai-fuzzy-merge
15. **Falsche Namensannahmen.** Pflicht-Nachname, ASCII-Regex, Titel im Namen → Ablehnung oder falsche Anrede. *Prüfen:* Regex `[A-Za-z]` auf Namen; Anrede aus Vornamen geraten. *Quelle:* https://www.kalzumeus.com/2010/06/17/falsehoods-programmers-believe-about-names/
16. **Blindes Fuzzy-Matching/Auto-Merge.** Zwei echte Personen werden verschmolzen. *Prüfen:* Ähnlichkeitsschwelle ohne harten Schlüssel; Merge ohne Bestätigung. *Quelle:* https://fullstackgtm.com/guides/deduplicate-crm-records/
17. **Merge ohne Survivorship-Regeln und ohne Umhängen.** Unklar, welcher Wert gewinnt; Verweise zeigen auf die gelöschte ID. *Prüfen:* Merge löscht B, Verweise auf B bleiben. *Quelle:* https://www.glean.com/perspectives/best-practices-for-avoiding-data-inconsistencies-with-ai-in-crm
18. **Check-then-insert-Race.** Zwei gleichzeitige Anlagen bestehen beide die Existenzprüfung. *Prüfen:* `if (!exists) create()` ohne gemeinsame Sperre. *Quelle:* https://www.raijuna.com/knowledge/race-conditions
19. **Doppelklick/Retry ohne Idempotenz.** Wiederholte Requests legen doppelt an. *Prüfen:* Button während Speichern nicht gesperrt; kein Idempotenz-Schlüssel. *Quelle:* https://hookdeck.com/webhooks/guides/implement-webhook-idempotency

## 3 · Import/Export (9)

20. **Kodierung und Trennzeichen geraten.** Deutsches Excel: Semikolon, oft Windows-1252; BOM im ersten Spaltennamen. *Prüfen:* Parser fest auf `,`/UTF-8; erste Spalte `﻿Name`. *Quelle:* https://changethisfile.com/blog/csv-encoding-delimiters · https://convertcsvonline.com/guides/csv-utf8-bom
21. **Selbstgebauter CSV-Parser.** `split(',')` bricht an Anführungszeichen/Zeilenumbrüchen in Feldern. *Prüfen:* kein echter Parser; abweichende Spaltenzahl still übernommen. *Quelle:* https://changethisfile.com/blog/csv-encoding-delimiters
22. **Excel-Verstümmelung übernommen.** PLZ 01067 → 1067, lange Nummern → 4,91E+11. *Prüfen:* PLZ als Zahl; Werte mit `E+`. *Quelle:* https://support.microsoft.com/en-us/office/keeping-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7
23. **Deutsche Zahlen-/Datumsformate falsch geparst.** `parseFloat("1.234,56")` = 1.234; `03.04.` als 4. März. *Prüfen:* Parsing ohne de-DE-Regeln. *Quelle:* https://changethisfile.com/blog/csv-encoding-delimiters
24. **Kein Probelauf/keine Vorschau.** *Prüfen:* Import ohne Vorschau „neu/aktualisiert/Dublette“. *Quelle:* https://www.salesforceben.com/6-best-practices-for-importing-data-into-salesforce/
25. **Keine Import-Charge, kein Rollback.** *Prüfen:* Datensätze ohne `importBatchId`; kein Rückgängig je Charge. *Quelle:* https://www.codestringers.com/articles/how-to-import-data-into-zoho-crm
26. **Import überschreibt gepflegte Werte.** *Prüfen:* Upsert setzt Felder auch bei leerem Quellwert; keine Feld-Priorität. *Quelle:* https://www.glean.com/perspectives/best-practices-for-avoiding-data-inconsistencies-with-ai-in-crm
27. **Herkunft nicht gespeichert (Art. 14).** *Prüfen:* kein `source`/`importedAt`. *Quelle:* https://www.ratgeberrecht.eu/aktuell/informationspflicht-bei-indirekter-datenerhebung-art-14-dsgvo/
28. **CSV-Injection im Export.** Zellen mit `= + - @`, Tab, CR werden in Excel ausgeführt. *Prüfen:* Export ohne Escaping. *Quelle:* https://owasp.org/www-community/attacks/CSV_Injection

## 4 · Datenqualität & Validierung (6)

29. **Zu viele Pflichtfelder** → Müllwerte („n/a“). *Prüfen:* Platzhalterwerte zählen. *Quelle:* https://pipelinedecoded.com/blog/crm-required-fields/
30. **Freitext statt Auswahlliste.** *Prüfen:* distinkte Werte je Steuerungsfeld. *Quelle:* https://pipelinedecoded.com/blog/crm-required-fields/
31. **Validierung nur im Client.** *Prüfen:* Schema-Prüfung nur im Formular, nicht serverseitig. *Quelle:* https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions
32. **Zu strenge E-Mail-Regex.** *Prüfen:* eigene strenge Regex. *Quelle:* https://beesbuzz.biz/code/439-Falsehoods-programmers-believe-about-email
33. **JSON wandelt NaN/Infinity stumm in `null`.** *Prüfen:* numerische Felder vor `JSON.stringify` nicht validiert. *Quelle:* https://dev.to/constanta/crash-safe-json-at-scale-atomic-writes-recovery-without-a-db-3aic
34. **Kein Datenverfall-Signal.** *Prüfen:* kein „zuletzt geprüft“. *Quelle:* https://www.openprisetech.com/blog/salesforce-contact-job-changes

## 5 · Nebenläufigkeit & Konsistenz (8)

35. **Lost Update.** Zweite Bearbeitung überschreibt die erste still. *Prüfen:* Speichern schreibt ganzes Objekt aus Formularzustand; kein Versionsabgleich. *Quelle:* https://vladmihalcea.com/a-beginners-guide-to-database-locking-and-the-lost-update-phenomena/
36. **Sperre nur um das Schreiben.** *Prüfen:* `load()` außerhalb, `save()` innerhalb des Locks. *Quelle:* https://vladmihalcea.com/a-beginners-guide-to-database-locking-and-the-lost-update-phenomena/
37. **Nicht-atomares Schreiben.** Absturz während `writeFile` → abgeschnittenes JSON. *Prüfen:* kein Temp-Datei + fsync + rename. *Quelle:* https://github.com/npm/write-file-atomic
38. **Verwaiste Sperre nach Absturz.** *Prüfen:* Lock ohne Stale-Erkennung/Timeout. *Quelle:* https://github.com/moxystudio/node-proper-lockfile
39. **Kaputte Datei wird als leer gelesen und dann überschrieben.** Totalverlust. *Prüfen:* `catch { return [] }` im Loader; keine Quarantäne-Kopie. *Quelle:* https://github.com/apache/maka/issues/4285
40. **In-Memory-Sperre bei mehreren Prozessen.** *Prüfen:* JS-Mutex statt prozessübergreifender Sperre (App + Worker). *Quelle:* https://github.com/moxystudio/node-proper-lockfile
41. **Mehrdatei-Vorgänge ohne Transaktion.** „Deal gewonnen → Mandat + Rechnung + Aktivität“ bricht halb ab. *Prüfen:* mehrere Dateien nacheinander ohne Ausgleich. *Quelle:* https://offensive360.com/knowledge-base/race-condition/ (ergänzt)
42. **Last-Write-Wins zwischen Geräten.** *Prüfen:* keine feldweise Zusammenführung/Konfliktanzeige. *Quelle:* https://dev.to/subraatakumar/your-offline-first-app-can-lose-correct-data-without-showing-any-error-1bm4

## 6 · Historie & Audit (4)

43. **Kein Änderungsprotokoll pro Feld** (wer, was, wann, alt→neu; Mensch/KI/Import). *Quelle:* https://appmaster.io/blog/audit-logging-internal-tools-activity-feed
44. **Audit-Log manipulierbar.** *Prüfen:* Einträge editierbar/löschbar, gleicher Speicher. *Quelle:* https://letsbuildsolutions.com/blog/system-design/designing-an-audit-log-system-immutable-events-efficient-querying-and-compliance-at-scale/
45. **Logs mit Geheimnissen/zu viel PII.** *Prüfen:* `console.log(request.body)`. *Quelle:* https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
46. **Ereigniszeit und Erfassungszeit vermischt.** *Prüfen:* nur `createdAt`, kein `occurredAt`. (ergänzt) *Quelle:* https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/

## 7 · Löschen & Aufbewahrung (7)

47. **Soft-Delete-Filter vergessen.** *Quelle:* https://brandur.org/soft-deletion
48. **Eindeutigkeit kollidiert mit gelöschten Datensätzen.** *Quelle:* https://brandur.org/soft-deletion
49. **Waisen durch fehlende Kaskade.** *Quelle:* https://brandur.org/soft-deletion
50. **Rechnungen/Belege hart löschbar** (§ 147 AO, § 257 HGB). *Quelle:* https://www.dids.de/loeschpflicht-vs-aufbewahrungsfrist/
51. **Keine Sperre (Art. 18) statt Löschung.** *Quelle:* https://www.datenschutz-notizen.de/zum-anspruch-auf-loeschung-einzelner-daten-im-kontext-gesetzlicher-aufbewahrungspflichten-4933610/
52. **Keine Löschfristen** (Art. 5 Abs. 1 lit. e). *Quelle:* https://externer-datenschutzbeauftragter-dresden.de/loeschfristen-dsgvo/
53. **Löschung erreicht Kopien nicht** (Backups, Exporte, Caches, KI-Kontext). (ergänzt) *Quelle:* https://externer-datenschutzbeauftragter-dresden.de/loeschfristen-dsgvo/

## 8 · DSGVO/UWG (12)

54. **E-Mail-Werbung ohne Einwilligung, auch B2B** (§ 7 UWG). *Quelle:* https://www.yagemi.de/blog/recht-compliance/kaltakquise-b2b-uwg/
55. **Einwilligung als bloßes true/false** (Nachweis: Zeitpunkt, IP, Text/Version). *Quelle:* https://externer-datenschutzbeauftragter-dresden.de/double-opt-in/
56. **Werbung in der Double-Opt-in-Mail.** *Quelle:* https://www.dr-datenschutz.de/werbung-in-double-opt-in-bestaetigungsmail-unzulaessig/
57. **Bestandskundenprivileg zu weit ausgelegt** (§ 7 Abs. 3 UWG). *Quelle:* https://www.sbs-legal.de/blog/wie-man-sein-e-mail-marketing-rechtssicher-macht
58. **Telefonakquise ohne dokumentierte Umstände** (mutmaßliche Einwilligung B2B). *Quelle:* https://www.yagemi.de/blog/recht-compliance/kaltakquise-b2b-uwg/
59. **Widerruf nicht so einfach wie Erteilung.** *Quelle:* https://dsgvo-gesetz.de/art-7-dsgvo/
60. **Sperrliste fehlt oder ist umgehbar** (Re-Import, gelöschte Adressen). *Quelle:* https://www.sender.net/blog/email-suppression-list/
61. **Öffnungs-/Klicktracking ohne gesonderte Einwilligung** (§ 25 TDDDG). *Quelle:* https://www.dr-datenschutz.de/tracking-im-e-mail-newsletter-und-der-datenschutz/
62. **Art.-14-Information bei Fremdlisten nicht nachgehalten.** *Quelle:* https://dsgvo-gesetz.de/art-14-dsgvo/
63. **Keine Auskunft/Export je Person (Art. 15/20).** *Quelle:* https://www.activemind.de/magazin/recht-auf-datenuebertragbarkeit/
64. **Widerspruch gegen Direktwerbung nicht als harte Sperre** (Art. 21 Abs. 3). *Quelle:* https://dsgvo-gesetz.de/art-21-dsgvo/
65. **Kein Privacy by Default** (Art. 25). *Quelle:* https://dsgvo-gesetz.de/art-25-dsgvo/

## 9 · Sicherheit & Berechtigungen (9)

66. **Server Actions/API ohne Rechteprüfung.** *Quelle:* https://nextjs.org/docs/app/guides/data-security
67. **BOLA/IDOR.** *Quelle:* https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
68. **Mass Assignment** (`{...existing, ...body}` ohne Allowlist). *Quelle:* https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
69. **Zu viele Daten an den Client.** *Quelle:* https://nextjs.org/docs/app/guides/data-security
70. **Stored XSS in Notizen/Vorlagen** (`dangerouslySetInnerHTML`). *Quelle:* https://developers.hubspot.com/changelog/xss-sanitization-for-crm-properties-containing-html
71. **Login ohne Brute-Force-Schutz/2FA.** *Quelle:* https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
72. **Unsichere Uploads** (Content-Type vertraut, Path Traversal). *Quelle:* https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
73. **Echte Kundendaten in Entwicklung/Test.** *Quelle:* https://www.bfdi.bund.de/DE/Fachthemen/Inhalte/Technik/Kurzposition_Testdaten.html
74. **Keine Sichtbarkeitsstufen** (privat Markiertes in Suche/KI-Kontext). (ergänzt)

## 10 · Datum, Zeit, Zahlen, Rechnungen (8)

75. **Reine Datumsfelder als Zeitstempel** (Off-by-one-Tag). *Quelle:* https://dev.to/zachgoll/a-complete-guide-to-javascript-dates-and-why-your-date-is-off-by-1-day-fi1
76. **Offset statt Zeitzonen-ID bei Terminen/Serien.** *Quelle:* https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html
77. **„Heute/überfällig“ in Server-Zeitzone.** *Quelle:* https://zainrizvi.io/blog/falsehoods-programmers-believe-about-time-zones/
78. **Zeitgesteuerte Erinnerungen bei Zeitumstellung** doppelt/gar nicht. *Quelle:* https://dev.to/libme/your-nightly-job-ran-twice-on-the-dst-switch-making-scheduled-jobs-timezone-safe-32hn
79. **Beträge als Float, ohne Währung/Netto-Brutto-Kennung.** *Quelle:* https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents
80. **USt-Rundung uneinheitlich.** *Quelle:* https://hilfe.sevdesk.de/de/articles/9423755-die-kaufmannische-rundungsdifferenz-darum-unterscheidet-sich-der-endbetrag-von-brutto-und-nettorechnungen
81. **Rechnungen nicht GoBD-fest** (Nummern-Race, Bearbeiten statt Storno). *Quelle:* https://kostenlose-erechnung.de/ratgeber/rechnungsnummer-system-pflichten/
82. **E-Rechnung nicht vorgesehen** (EN 16931, Pflicht ab 2027/2028). *Quelle:* https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html

## 11 · Pipeline & Forecast (6)

83. **Keine Stufenhistorie.** *Quelle:* https://knowledge.hubspot.com/properties/stage-calculated-properties
84. **Stufen-Wahrscheinlichkeiten nie kalibriert.** *Quelle:* https://forecastio.ai/blog/pipeline-forecasting
85. **Verschobene Abschlussdaten unsichtbar.** *Quelle:* https://trytrusted.com/article/sales-pipeline-forecasting-revenue-forecast-accuracy-deal-risk-slippage-commit-confidence
86. **Tote Deals blähen die Pipeline.** *Quelle:* https://forecastio.ai/blog/pipeline-forecasting
87. **Stufen über Anzeigenamen referenziert.** (ergänzt)
88. **Kein Verlustgrund / gewichteter Wert persistiert.** (ergänzt)

## 12 · Aktivitäten & Kommunikation (4)

89. **Öffnungen/Klicks als Interesse gewertet** (Apple MPP, Scanner). *Quelle:* https://postmarkapp.com/blog/how-apples-mail-privacy-changes-affect-email-open-tracking
90. **Bounces nicht unterdrückt.** *Quelle:* https://www.suped.com/learn/email-deliverability/what-is-the-recommended-soft-bounce-suppression-logic-for-email
91. **Fehlende Versand-Grundlagen** (SPF/DKIM/DMARC, List-Unsubscribe). *Quelle:* https://support.google.com/a/answer/14229414?hl=en
92. **Ausgehende Nachrichten ohne Freigabe.** (ergänzt)

## 13 · Lead-Scoring & Automatisierung (5)

93. **Kein Punkteverfall.** *Quelle:* https://getspike.ai/blog/b2b-lead-scoring-model/
94. **Keine Negativpunkte/Ausschlussgründe.** *Quelle:* https://breadcrumbs.io/blog/lead-scoring-best-practices/
95. **Schwelle willkürlich und nie überprüft.** *Quelle:* https://getspike.ai/blog/b2b-lead-scoring-model/
96. **Fit und Interesse in einer Zahl, ohne Begründung.** (ergänzt)
97. **Automationen feuern doppelt oder in Schleifen.** *Quelle:* https://www.svix.com/resources/webhook-university/reliability/idempotency-and-deduplication/

## 14 · KI (5)

98. **Prompt Injection über CRM-Inhalte.** *Quelle:* https://www.oligo.security/academy/owasp-top-10-llm-updated-2025-examples-and-mitigation-strategies
99. **Excessive Agency** (schreibt/versendet ohne Bestätigung). *Quelle:* https://www.promptfoo.dev/docs/red-team/owasp-llm-top-10/
100. **KI-Ausgabe ungeprüft weiterverwendet** (HTML, Stammdaten). *Quelle:* https://www.oligo.security/academy/owasp-top-10-llm-updated-2025-examples-and-mitigation-strategies
101. **Datenabfluss an KI-Anbieter** (AVV, Drittland, DSFA). *Quelle:* https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf
102. **KI-Werte überschreiben verifizierte Daten.** *Quelle:* https://www.glean.com/perspectives/best-practices-for-avoiding-data-inconsistencies-with-ai-in-crm

## 15 · Suche & Performance (3)

103. **N+1-Zugriffe.** *Quelle:* https://www.scoutapm.com/blog/understanding-n1-database-queries
104. **Alles laden statt paginieren.** *Quelle:* https://www.stacksync.com/blog/keyset-cursors-postgres-pagination-fast-accurate-scalable
105. **Suche ohne Normalisierung** (Umlaute, ß/ss, NFD). *Quelle:* https://symbolfyi.com/guides/unicode-normalization-guide/

## 16 · UX/Bedienung (3)

106. **Veraltete Anzeige nach dem Speichern** (Router Cache). *Quelle:* https://nextjs.org/docs/app/api-reference/functions/revalidatePath
107. **Stumme Konflikte.** *Quelle:* https://dev.to/subraatakumar/your-offline-first-app-can-lose-correct-data-without-showing-any-error-1bm4
108. **Endlos konfigurierbar statt klar vorgegeben.** *Quelle:* https://news.ycombinator.com/item?id=37807840

## 17 · Betrieb, Backup, Migration (5)

109. **Backup nie zurückgespielt, Alarme versanden.** *Quelle:* https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/
110. **Backup am selben Ort / Restore mit anderer Version ungetestet.** *Quelle:* https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/
111. **Kein `schemaVersion` in JSON-Dateien.** *Quelle:* https://jsonic.io/guides/json-migrations
112. **Migration ohne Sicherung/Probelauf; nie abgeschlossene Lazy-Migration.** *Quelle:* https://reintech.io/blog/best-practices-mongodb-schema-versioning
113. **Datenpfad in einem Sync-Ordner (iCloud/Dropbox).** (ergänzt)

## 18 · Tests (3)

114. **Kein Test für gleichzeitiges Speichern / Abbruch mitten im Schreiben.** *Quelle:* https://vladmihalcea.com/a-beginners-guide-to-database-locking-and-the-lost-update-phenomena/
115. **Testdaten nur Happy Path** (keine Umlaute/NFD, BOM-CSV, Zeitumstellung, `=`-Zellen). *Quelle:* https://github.com/kdeldycke/awesome-falsehood
116. **Rechtliche Sperren nicht getestet** (Versand an Gesperrte muss fehlschlagen). (ergänzt)

---

## Top 10 für ein Zwei-Personen-CRM (Einschätzung der Recherche)
1. #39/#37 kaputte Datei → leer → überschrieben; nicht-atomares Schreiben
2. #35/#36 Lost Update; Sperre nur um das Schreiben
3. #109/#110 Restore nie getestet, Alarme versanden
4. #66/#67 API ohne Rechteprüfung, BOLA
5. #54/#55 Werbe-E-Mail ohne nachweisbare Einwilligung
6. #60/#62 Sperrliste umgehbar durch Re-Import; Art.-14-Frist bei der Masterliste
7. #20–#25 Kodierung/Trennzeichen/Excel; kein Probelauf, keine Charge
8. #12/#16/#17 Normalisierung und Merge-Regeln
9. #75/#77 Datumsfelder verrutschen; „heute“ in Server-UTC
10. #99/#98 KI handelt ohne Freigabe; Prompt Injection

Vollständige Quellenliste und ausführliche Prüfhinweise: Bericht des Recherche-Agenten vom 28.09.2026 (Sitzungsprotokoll); die wichtigsten URLs stehen an den Punkten.
