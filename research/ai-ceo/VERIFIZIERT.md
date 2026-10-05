# VERIFIZIERT — geprüfte Fakten für Entscheidungen (Stand 05.10.2026)

**Regel (Kevin 05.10.):** Nur was hier mit ✅ (oder ⚠️ mit korrektem Wert) steht, darf in Entscheidungen, Unterlagen oder nach außen. Alles andere ist „Annahme“.

| Datei | Gegenstand | Ergebnis |
|---|---|---|
| [VERIFIZIERT-A.md](VERIFIZIERT-A.md) | Markt, Wettbewerb, Preise, KI-Kosten, Vertrieb (P01–P04, P09–P11, Teil K) | 49 Aussagen: ✅ 29 · ⚠️ 10 · ❌ 9 · ⏳ 1 |
| [VERIFIZIERT-B.md](VERIFIZIERT-B.md) | Agenten-Technik, Recht, Arbeitspsychologie (P06–P08) | 55 Aussagen: ✅ 29 · ⚠️ 20 · ❌ 5 · ⏳ 1 |

**Gesamt:** 104 Aussagen — 58 bestätigt, 30 teilweise/abweichend, 14 falsch/nicht auffindbar, 2 nicht prüfbar. Jede Zeile in A/B hat Primärquelle (Link), Kurzzitat, Datum, Belastbarkeit.

## Die Fakten, die unsere Entscheidungen am stärksten verändern
1. **Datenweg KI:** Anthropic direkt verarbeitet nur „global“ oder „us“, speichert nur in den USA; eine **EU-Region gibt es nur über AWS Bedrock oder Google Cloud (Vertex)**, ca. +10 %. Löschung API-Daten binnen 30 Tagen, kein Training, ZDR nur auf Antrag. Anthropics Datenschutzerklärung nennt für Drittlandtransfers **Standardvertragsklauseln** (DPF dort nicht genannt; DPF-Liste nicht geprüft). → „Daten bleiben in Deutschland“ / „Hosted in Germany“-Siegel heute **nicht** haltbar.
2. **KI-Preise (Okt. 2026, je Mio. Token Ein/Aus):** Haiku 4.5 1/5 $, Sonnet 5 / 5.5 2/10 $, Opus 5.5 4/20 $; Cache-Lesen 10 % (Opus 5.5: 5 %); Haiku 4.5 cacht erst ab 4.096 Token; ab Claude 4.7 ~30 % mehr Token je Text.
3. **Markt:** DE ~1,8 Mio. Solo-Selbstständige (Mikrozensus 2024, seit 2012 rückläufig); AT ~376.000 EPU; EU eher 14–15 Mio. Solo-Selbstständige. Segmentgrößen „wissensbasierte Solo-Unternehmer DACH“ und Zahlungsbereitschaft: **nicht belegt**.
4. **Bindung nach Preis (ChartMogul, Dez. 2025):** KI-Produkte > 250 $/Monat 70 % GRR / 85 % NRR, < 50 $ nur 23 % / 32 %; B2B-SaaS-Median NRR 82 %.
5. **„AI CEO“ besetzt:** Tycoon („Astra, an AI CEO“, ab 50 $), Voyd (CEO/CTO/CMO/CFO-Agenten, 40 $), Sintra (> 40.000 Zahlende, 12 Mio. $ ARR, effektiv 15,60–48,50 $). EU-Datenhaltung bieten auch Notion, ClickUp, Fyxer (Enterprise), Microsoft (EU Data Boundary, aber Anthropic-Modelle in Copilot ausgenommen).
6. **Bitkom:** „8 von 10 Unternehmen (ab 20 Beschäftigten) bevorzugen KI aus Deutschland“ — nicht „93 %“ ohne Einschränkung.
7. **Steuerberater:** Provisionsverbot § 2 Abs. 3 BOStB → Kanzlei-Programm nur provisionsfrei.
8. **KI-VO:** Art. 50 seit 02.08.2026; **maschinenlesbare Kennzeichnung (Abs. 2) für neue Systeme ab der ersten Abgabe** — auch **kostenlose Testinstanzen** sind „Bereitstellung“ (Art. 3 Nr. 10), Tests mit echten Nutzern fallen nicht unter Art. 2 Abs. 8; Übergang bis 02.12.2026 nur für Altsysteme (Art. 111 Abs. 4 i. d. F. VO 2026/1744). Art. 4 (KI-Kompetenz) nur noch Bemühenspflicht. Hochrisiko ab 02.12.2027 / 02.08.2028.
9. **DSFA:** DSK-Muss-Liste Nr. 17 nennt Wearable-/Fitnessarmband-Daten zur Leistungsbestimmung ausdrücklich → DSFA sehr wahrscheinlich Pflicht → DSB nach § 38 Abs. 1 S. 2 BDSG sehr wahrscheinlich. **Option:** Testinstanzen ohne Gesundheitsmodul.
10. **Als Auftragsverarbeiter:** AVV mit Pflichtinhalt (Art. 28 Abs. 3), eigenes Verzeichnis (Art. 30 Abs. 2, KMU-Ausnahme greift wegen Art.-9-Daten nicht), Pannen unverzüglich an den Kunden.
11. **Weitere Fristen:** CRA-Meldepflichten seit 11.09.2026 (volle Geltung 11.12.2027; reines SaaS → NIS2-Logik); neue Produkthaftung für Produkte nach dem 09.12.2026 (Software inkl. SaaS); E-Rechnung: ab 2027 Pflicht (Ausnahme ≤ 800.000 € Vorjahresumsatz bis Ende 2027), ab 2028 für alle.
12. **Technik:** OWASP LLM Top 10 **2026** und Agentic Top 10 (12/2025) sind aktuell; MCP bei der Linux Foundation, HTTP+SSE abgekündigt; A2A Linux-Foundation-Projekt; OpenAI nennt **keine** feste Werkzeug-Obergrenze (Überlappung entscheidet); Prompt-Injection-Abwehr: mehrere Muster (u. a. Dual-LLM, CaMeL, Spotlighting) — keins „das einzige“.
13. **Arbeitspsychologie (belastbar):** Freigaben bündeln und geschützte Zeit, Gesundheitswerte beschreibend (Orthosomnie-Risiko), Wechselkosten real (ohne die „40 %“), Ego-Depletion kaum vorhanden (d ≈ 0,04). „23 Minuten“ ist kein Studienbefund.

## Daraus folgende Korrekturen in unseren eigenen Texten (offen, auf Kevins Wort)
- **„Data Privacy Framework“** steht in 6 Texten der App (u. a. Gesundheits-Einwilligung (b) — Textänderung = neue Fassung, ZOE-/KI-Empfänger, VVT-KI, CRM-Verzeichnis, DATENSCHUTZ_APP.md). Erst die DPF-Teilnehmerliste prüfen; ist Anthropic nicht zertifiziert → auf „Standardvertragsklauseln“ korrigieren.
- **Maschinenlesbare KI-Kennzeichnung** ausgehender Mails/Exporte bauen, **bevor** die erste Testinstanz übergeben wird.
