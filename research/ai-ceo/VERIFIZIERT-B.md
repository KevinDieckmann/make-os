# VERIFIZIERT-B · Faktenprüfung P06 · P07 · P08 (Stand 05.10.2026)

- **Geprüft von:** unabhängiger Faktenprüfer (Claude), 05.10.2026, jede Aussage selbst an der Quelle nachgeschlagen.
- **Gegenstand:** Gemini-Berichte P06 (Agenten-Architektur), P07 (Recht), P08 (Arbeitspsychologie) samt Auszügen, `AI_CEO_MODUL.md` Teil K3/K4 und `DATENSCHUTZ_APP.md`.
- **Regeln:** Gesetze nur aus EUR-Lex / gesetze-im-internet.de / Gerichten; Studien nur über DOI, PubMed, Crossref oder Originalveröffentlichung; Technik nur aus Hersteller-Doku. `AI_CEO_MODUL.md` ist **nie** Beleg. Zitate stehen nur dort, wo ich sie auf der Quelle gesehen habe (Originalsprache, ≤ 25 Wörter, Kürzungen mit „…").
- **Keine Rechtsberatung.** Wo „Anwalt" steht, ist die Auslegung offen; die Fundstellen sind präzise, die Schlüsse nicht verbindlich.

---

## Kurzfassung

**55 Aussagen geprüft:** ✅ 29 bestätigt · ⚠️ 20 teilweise/abweichend · ❌ 5 falsch/nicht auffindbar · ⏳ 1 nicht prüfbar
(nach Bericht: P06 12 Aussagen — 6 ✅ / 4 ⚠️ / 2 ❌ · P07 27 — 17 ✅ / 8 ⚠️ / 1 ❌ / 1 ⏳ · P08 16 — 6 ✅ / 8 ⚠️ / 2 ❌)

**Gesamturteil:** Die **Rechtsgrundlagen (Normen, Daten, Aktenzeichen) stimmen überwiegend**, aber Gemini **verkürzt die Übergangsregeln** (Art. 50 Abs. 2 KI-VO), **nummeriert Artikel falsch** (PLD, KI-MIG) und **zitiert eine BFH-Entscheidung entgegen ihrem Leitsatz**. Bei der **Technik** sind die Primärquellen echt, zwei Kernaussagen aber überzeichnet („15–20 Werkzeuge", „Dual-LLM einzige Abwehr") und drei Stände veraltet (OWASP 2026, MCP-Transport, A2A). Bei der **Psychologie** stimmen die Effekte meist, aber Zitate (Autoren, Zeitschrift, DOI) sind auffällig oft falsch, und mehrere Werbezahlen sind nicht belegt.

### Die 10 wichtigsten verifizierten Fakten und Pflichten

| # | Fakt / Pflicht | gilt ab | Fundstelle |
|---|---|---|---|
| 1 | **ZOE muss als KI erkennbar sein** (Pflicht des Anbieters) — gebaut. | **02.08.2026** | Art. 50 Abs. 1 i. V. m. Art. 113 KI-VO |
| 2 | **KI-erzeugte Texte maschinenlesbar kennzeichnen.** Übergang bis 02.12.2026 **nur** für Systeme, die **vor** dem 02.08.2026 in Verkehr gebracht wurden. Auch **unentgeltliche** Abgabe an Testpersonen im Rahmen einer Geschäftstätigkeit ist „Bereitstellung auf dem Markt". | ab erster Abgabe (für neue Instanzen sofort) | Art. 50 Abs. 2, Art. 3 Nr. 3/9/10, Art. 2 Abs. 8 KI-VO; Art. 111 Abs. 4 n. F. (VO 2026/1744) |
| 3 | **Digital-Omnibus KI = VO (EU) 2026/1744**, unterzeichnet 08.07.2026, in Kraft **27.07.2026**; Hochrisiko Anhang III ab **02.12.2027**, Anhang I ab **02.08.2028**. | 27.07.2026 | EUR-Lex ELI reg/2026/1744 |
| 4 | **KI-Kompetenz (Art. 4) ist nur noch Bemühenspflicht** („Maßnahmen … zu unterstützen", kein garantiertes Niveau). | 27.07.2026 (n. F.) | Art. 4 KI-VO i. d. F. VO 2026/1744 |
| 5 | **DSFA sehr wahrscheinlich Pflicht**: DSK-Muss-Liste Nr. 17 nennt ausdrücklich Fitnessarmband-/Wearable-Daten zur Bestimmung der Leistungsfähigkeit — **auch wenn nicht „umfangreich"**; Nr. 11 nennt KI zur Bewertung persönlicher Aspekte. Daraus folgt **DSB-Pflicht unabhängig von der Personenzahl**. | sofort | Art. 35 DSGVO; DSK-Liste v. 17.10.2018 Nr. 11, 17; § 38 Abs. 1 S. 2 BDSG |
| 6 | **Als Auftragsverarbeiter:** AVV mit Pflichtinhalt (Art. 28 Abs. 3), **eigenes Verzeichnis** (Art. 30 Abs. 2) — die KMU-Ausnahme (Art. 30 Abs. 5) greift wegen Art.-9-Daten **nicht**; Pannen **unverzüglich** an den Kunden melden (Art. 33 Abs. 2). | sofort | DSGVO |
| 7 | **Anthropic:** API-Daten standardmäßig **nicht** fürs Training, Löschung **binnen 30 Tagen**, **ZDR auf Antrag** (Vertrieb). Anthropic nennt für Drittlandtransfers **Standardvertragsklauseln**, das DPF wird in der Datenschutzerklärung **nicht** erwähnt. | Stand 10/2026 | Anthropic Privacy Center, API-Doku, Privacy Policy (gültig ab 10.09.2026) |
| 8 | **EU-US-DPF formal gültig** (EuG T-553/23, 03.09.2025), **Rechtsmittel C-703/25 P anhängig** (seit 31.10.2025); **Trump v. Slaughter** (29.06.2026): FTC-Kommissare frei abberufbar. | — | EuG PM 106/25; ABl. C/2025/6610; US Supreme Court No. 25-332 |
| 9 | **CRA:** Meldepflichten (Art. 14) seit **11.09.2026**, volle Geltung **11.12.2027**; reines SaaS fällt unter NIS2-Logik, nicht unter den CRA. **PLD:** Software inkl. SaaS ist „Produkt", gilt für Produkte, die **nach dem 09.12.2026** in Verkehr kommen; Haftungsausschluss gegenüber Geschädigten unwirksam (**Art. 15**). | 11.09.2026 / 09.12.2026 | VO 2024/2847 Art. 71; RL 2024/2853 Art. 2, 4, 15, 22 |
| 10 | **E-Rechnung:** Ausstellen auf Papier/sonstigem Format nur noch bis 31.12.2026; für Umsätze 2027 nur bei Vorjahresumsatz ≤ 800.000 €; ab 01.01.2028 für alle B2B-Inlandsumsätze E-Rechnung. | 01.01.2027 / 01.01.2028 | § 27 Abs. 38 UStG |

### Die 10 wichtigsten widerlegten oder korrigierten Aussagen

| # | Behauptung im Bericht | Richtig ist |
|---|---|---|
| 1 | „Unterbrechung kostet 23 Min. 15 Sek." (P08, als Studienbefund) | **Nur ein Interview** (Gallup 2006). Das Paper (Mark et al. 2005) misst **25 Min. 26 Sek. bis zur Rückkehr**, Streuung 54 Min.; dazwischen wurde **anderes gearbeitet** — keine verlorene Zeit. |
| 2 | „Einzelagent skaliert bis 15–20 Werkzeuge, darüber bricht er ein" (P06, „OpenAI") | OpenAI nennt **keine Grenze**: manche schaffen > 15 klar getrennte Werkzeuge, andere scheitern an < 10 **überlappenden**. |
| 3 | „Dual-LLM ist die einzige robuste Abwehr" (P06) | Das Paper schlägt **sechs** Muster mit Abwägungen vor; CaMeL ist ein weiteres. Keins ist „das einzige". |
| 4 | „Art. 50 Abs. 2: Schonfrist bis 02.12.2026" (P07) | **Nur für Systeme, die vor dem 02.08.2026 in Verkehr waren.** Neue (auch kostenlose Test-)Instanzen: Pflicht ab Abgabe. |
| 5 | DACH-Umfragewerte 82 % / 88 % / 76 % / 71 % (P07) | **Nicht auffindbar** (zweimal gesucht) — nicht verwenden. |
| 6 | „40 % mehr Fehler durch Aufgabenwechsel (Monsell 2003)" und „Ready-to-Resume-Plan senkt Aufmerksamkeitsrest um 60 %" (P08) | Monsell: Wechselkosten ja, **keine 40 %**. Leroy & Glomb: Wirkung ja, **keine 60 %**; außerdem falsche Zeitschrift/DOI. |
| 7 | „BFH II R 22/15: Software darf Voranmeldungen vorbereiten" (P07) | Leitsatz sagt das **Gegenteil** für Buchhalter: auch automatische Erstellung der UStVA durch das Programm berechtigt sie **nicht**. Fundstelle trägt die Aussage nicht. |
| 8 | PLD: „Art. 14 Haftungsausschluss unwirksam", „Art. 5: Datenverlust bei personenbezogenen/gemischten Daten ersatzfähig" (P07) | Haftungsausschluss = **Art. 15** (Art. 14 = Rückgriff). Schaden = **Art. 6**; ersatzfähig nur Daten, **die nicht für berufliche Zwecke** verwendet werden. |
| 9 | KI-MIG: „BGBl. I 2026 Nr. 245 vom 28.07.2026", „KI-Marktüberwachungskammer" (P07) | **BGBl. 2026 I Nr. 223**, ausgefertigt **22.07.2026**, in Kraft **29.07.2026**; Bundesnetzagentur mit **Koordinierungs- und Kompetenzzentrum**. |
| 10 | „Aeon & Aguinis 2021, JAP, 108 Studien" (P08) | **Aeon, Faber & Panaccio 2021, PLoS ONE, k = 158** (Werte etwa richtig). Ebenso falsch zitiert: Thayer 2009 (Ann Behav Med, nicht Int J Cardiol). |

Weitere Korrekturen in Kürze: Orthosomnie 3–14 % beziehen sich auf die **Gesamtstichprobe**, nicht auf Tracker-Nutzer · „HRV fällt 24–48 h vor Erschöpfung" in der zitierten Quelle **nicht** enthalten · OWASP LLM Top 10 **2026** ersetzt 2025 (Excessive Agency jetzt Rang 3) · MCP: HTTP+SSE **offiziell abgekündigt** · Brynjolfsson-Studie in der Endfassung **15 %**, n = 5.172.

### Bereinigte Pflichten-Liste „vor dem ersten fremden Nutzer"
*Lage: 3–4 Testpersonen, je eigene Instanz, kein öffentlicher Verkauf. Kernpunkt: **„kostenlos" und „Test" befreit nicht.** KI-VO: unentgeltliche Abgabe im Rahmen einer Geschäftstätigkeit = Bereitstellung; der Test-Ausschluss (Art. 2 Abs. 8) gilt ausdrücklich **nicht** für Tests unter Realbedingungen. DSGVO: Nutzen die Testpersonen MAKE OS für ihr Unternehmen, sind **sie** Verantwortliche und MAKE Innovation ist **Auftragsverarbeiter**.*

**A. Pflicht nach Wortlaut — vor Übergabe erledigen**
1. **AVV je Testperson** mit dem Pflichtinhalt aus Art. 28 Abs. 3 lit. a–h (Weisung, Vertraulichkeit, TOM, Unterauftragsverarbeiter Hetzner/Anthropic/Google/Microsoft …, Unterstützung, Löschung/Rückgabe, Nachweise). — *fehlt*
2. **Verzeichnis als Auftragsverarbeiter** (Art. 30 Abs. 2); die Ausnahme in Abs. 5 greift wegen Art.-9-Daten nicht. — *fehlt*
3. **Meldeweg „Panne → Kunde unverzüglich"** (Art. 33 Abs. 2). — *Register da, Ablauf fehlt*
4. **ZOE als KI erkennbar** (Art. 50 Abs. 1). — *gebaut*
5. **Maschinenlesbare Kennzeichnung KI-erzeugter Texte, die das System verlassen** (Mails, Exporte), Art. 50 Abs. 2 — **ab der ersten Abgabe**, keine Schonfrist. Die Ausnahme „menschliche Prüfung" steht nur in Abs. 4 (Texte zu Fragen öffentlichen Interesses), **nicht** in Abs. 2. — *teilweise (intern ja, ausgehend nein)*; Übergangslösung: KI-Entwurf für Außenversand bei Testinstanzen sperren, bis die Kennzeichnung steht (Vorschlag, Anwalt bestätigen lassen).
6. **Art. 9: ausdrückliche Einwilligung** für Gesundheitsdaten (drei getrennte Einwilligungen). — *gebaut*; Texte gegenlesen lassen.
7. **Datenschutzhinweis** (Art. 13) in der Anwendung — *Entwurf*; **Korrektur:** dort steht „Standardvertragsklauseln/Data Privacy Framework" — Anthropic selbst nennt in seiner Datenschutzerklärung **nur SCC**; „DPF" streichen, bis eine Zertifizierung belegt ist.
8. **§ 7 UWG** (Werbe-Mails nur mit vorheriger ausdrücklicher Einwilligung, auch B2B) — *gebaut*.
9. **KI-Kompetenz (Art. 4)**: kurze Nutzungshinweise (Grenzen, Halluzinationen, Prompt-Injection) für Testpersonen + eigener Nachweis. — *fehlt, geringer Aufwand*

**B. Pflicht sehr wahrscheinlich — Anwalt/DSB bestätigen lassen**
10. **DSFA** für Gesundheits-/Wearable-Funktionen und KI (DSK-Liste Nr. 17 und Nr. 11) + Muster für die Testpersonen als Verantwortliche. — *fehlt*
11. **Datenschutzbeauftragter** (extern möglich), weil DSFA-pflichtige Verarbeitung (§ 38 Abs. 1 S. 2 BDSG). Offen: trifft die Pflicht MAKE als Auftragsverarbeiter oder (nur) die Testpersonen? — *Kevin + Anwalt*
    *Risikominderung bis zur Klärung (Vorschlag, keine Pflicht):* Testinstanzen **ohne** Gesundheits-/Wearable-Modul ausliefern.
12. **Drittland USA:** SCC (im Anthropic-DPA prüfen) + **Transfer-Folgenabschätzung**; ZDR bei Anthropic beantragen (kostenlos auf Antrag; gilt nicht für Files-API und Code-Execution). — *fehlt / Kevin*

**C. Nur unter Bedingung**
13. **§ 203 StGB / § 62a StBerG:** nur wenn eine Testperson Berufsgeheimnisträger ist (Steuerberater, Anwalt, Arzt …). Dann Verschwiegenheitsverpflichtung **in Textform mit Strafbelehrung**, und MAKE muss seine eigenen Dienstleister (Hetzner, Anthropic) ebenfalls verpflichten (§ 203 Abs. 4 S. 2 Nr. 2 StGB).
14. **CRA:** nur wenn der **Mac-Zulieferer** an Testpersonen ausgegeben wird — dann laufen die Meldepflichten (seit 11.09.2026) bereits. Empfehlung: nicht ausgeben.
15. **Beschäftigte der Testpersonen:** keine Funktionen, die Leistung/Verhalten von Beschäftigten beobachten oder bewerten (Anhang III Nr. 4 b → Hochrisiko ab 02.12.2027) und keine Emotionsableitung am Arbeitsplatz (Art. 5 Abs. 1 lit. f, verboten seit 02.02.2025).

**D. Nicht vor den Testpersonen fällig**
- Neue Produkthaftung: gilt erst für Produkte, die **nach dem 09.12.2026** in Verkehr kommen (deutsches Umsetzungsgesetz: Stand nicht bestätigt, ⏳).
- Hochrisiko-Pflichten (02.12.2027), E-Rechnungs-Ausstellung (eigene Rechnungen von MAKE ab 2027/2028, je nach Umsatz).
- AGB/Haftung: erst bei Verkauf zwingend; für Tests reicht eine schriftliche Testvereinbarung (Leistungsbeschreibung, keine Rechts-/Steuer-/Medizinberatung, Prüfpflicht bei Freigaben) — Vorschlag.

---

## Teil 1 · P06 Agenten-Architektur

**B01 · Anthropic: erst Workflows, Agenten nur für offene Aufgaben; fünf Muster (Kette, Routing, Parallelisierung, Orchestrator-Worker, Bewerter-Optimierer).** (P06 #1)
- Status: ✅ bestätigt
- Primärquelle: [Anthropic, „Building effective agents"](https://www.anthropic.com/engineering/building-effective-agents), veröffentlicht 19.12.2024 — „When building applications with LLMs, we recommend finding the simplest solution possible, and only increasing complexity when needed." Fünf Muster als Überschriften vorhanden.
- Belastbarkeit: hoch (Hersteller-Doku)
- Bedeutung: Bestätigt den Ansatz Grundlauf/fester Ablauf vor Agentenschleife im Head-Rahmen.

**B02 · Hierarchie statt Agenten-Netz (ZOE als „Manager"), gestützt auf OpenAI.** (P06 #2)
- Status: ⚠️ teilweise — OpenAI beschreibt **beide** Muster (Manager und dezentrale Übergabe) als „broadly applicable" und empfiehlt **zuerst**, einen Einzelagenten auszureizen. Eine Empfehlung „Hierarchie statt Netz" steht dort nicht; sie ist unsere Wahl (vertretbar).
- Primärquelle: [OpenAI, „A practical guide to building agents" (PDF)](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf), 2025 — „Our general recommendation is to maximize a single agent's capabilities first."
- Belastbarkeit: hoch (Quelle) / Empfehlung = Meinung
- Bedeutung: Manager-Muster bleibt ok; Begründung im Plan als eigene Entscheidung, nicht als „OpenAI-Vorgabe" formulieren.

**B03 · „Einzelagent skaliert bis 15–20 Werkzeuge, darüber bricht die Auswahl ein [Fakt]".** (P06 #3)
- Status: ❌ falsch zugeordnet
- Primärquelle: OpenAI-Leitfaden (s. B02), S. 16 — „Some implementations successfully manage more than 15 well-defined, distinct tools while others struggle with fewer than 10 overlapping tools."
- Belastbarkeit: hoch (Gegenbeleg)
- Bedeutung: Für ZOE (36 Werkzeuge) zählt **Überlappung**, nicht Anzahl → Werkzeuge entdoppeln/klar benennen, gruppiert anbieten.

**B04 · Außenwirkung nur mit Freigabe; Risikostufen je Werkzeug.** (P06 #7/#9, Checkliste)
- Status: ✅ bestätigt (als Herstellerpraxis)
- Primärquelle: OpenAI-Leitfaden (s. B02), S. 25 — „Use these risk ratings to trigger automated actions, such as pausing for guardrail checks before executing high-risk functions or escalating to a human if needed."
- Belastbarkeit: hoch
- Bedeutung: Stützt den Freigabe-Stapel und Risikostufen je Werkzeug (Lesen/Schreiben, umkehrbar, Geldwirkung).

**B05 · pass^k statt pass@k; 70 % Einzelerfolg → pass@3 = 97,3 %, pass^3 = 34,3 %.** (P06 #4)
- Status: ⚠️ teilweise — Rechnung stimmt (1−0,3³ bzw. 0,7³). Ursprung ist τ-bench (Sierra), nicht der zitierte Blog. Definition im Bericht leicht schief: pass^k = **dieselbe Aufgabe in k Versuchen jedes Mal** gelöst (nicht „k verschiedene Aufgaben hintereinander").
- Primärquelle: [Yao et al., τ-bench, arXiv:2406.12045](https://arxiv.org/abs/2406.12045), 17.06.2024 — „We also propose a new metric (pass^k) to evaluate the reliability of agent behavior over multiple trials."
- Belastbarkeit: hoch
- Bedeutung: Eval-Stufe „pass^3 je Gold-Fall" ist richtig; Schwelle 0,85 bleibt eine Setzung (aus eigenen Läufen ableiten).

**B06 · Spotlighting senkt die Erfolgsquote indirekter Prompt-Injection von > 50 % auf < 2 %.** (P06 #10)
- Status: ✅ bestätigt — getestet nur mit GPT-Modellen
- Primärquelle: [Hines et al., arXiv:2403.14720](https://arxiv.org/abs/2403.14720), 20.03.2024 — „spotlighting reduces the attack success rate from greater than 50% to below 2% in our experiments with minimal impact on task efficacy."
- Belastbarkeit: hoch (für GPT), mittel (Übertrag auf Claude)
- Bedeutung: Billige Zusatzschicht um jeden Fremdtext; Wirkung mit Claude selbst testen.

**B07 · „Dual-LLM (Quarantäne-Modell ohne Werkzeuge) ist die einzige robuste Abwehr".** (P06 #9)
- Status: ❌ als Aussage falsch — das Muster existiert, aber das Paper stellt **sechs** Muster mit Nutzen/Sicherheit-Abwägung vor (Action-Selector, Plan-Then-Execute, LLM Map-Reduce, Dual LLM, Code-Then-Execute, Context-Minimization).
- Primärquelle: [Beurer-Kellner et al., arXiv:2506.08837](https://arxiv.org/abs/2506.08837), 10.06.2025 — „a set of principled design patterns for building AI agents with provable resistance to prompt injection"
- Belastbarkeit: hoch
- Bedeutung: Quarantäne-Schritt bleibt sinnvoll (Must), aber je Head das passende Muster wählen (z. B. Plan-Then-Execute für Mail-Heads).

**B08 · Ergänzung (nicht im Bericht): CaMeL trennt Kontroll- und Datenfluss.**
- Status: ✅ bestätigt
- Primärquelle: [Debenedetti et al., „Defeating Prompt Injections by Design", arXiv:2503.18813](https://arxiv.org/abs/2503.18813), 24.03.2025 — löst „77% of tasks with provable security" in AgentDojo (ungeschützt: 84 %).
- Belastbarkeit: hoch (Forschung, kein Produkt)
- Bedeutung: Zeigt den Preis von Sicherheit (~7 Pp. weniger gelöste Aufgaben) — Orientierung für die Abwägung, kein Bauauftrag.

**B09 · Prompt-Caching: 5 Min. Lebensdauer, Lesen 0,1×, bis 90 % günstiger; 1-h-Option.** (P06 #11)
- Status: ✅ bestätigt, mit Ergänzungen
- Primärquelle: [Claude-Doku Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), abgerufen 05.10.2026 — „By default, the cache has a 5-minute lifetime. The cache is refreshed for no additional cost each time the cached content is used." Schreiben 1,25× (5 Min.) / 2× (1 h); Lesen 0,1×, **Opus 5.5: 0,05×**. **Mindestlänge: Haiku 4.5 = 4.096 Token**, Opus 5.5/Sonnet 5.5 = 512, Sonnet 5 = 1.024.
- Belastbarkeit: hoch
- Bedeutung: Kurze Quarantäne-Läufe mit Haiku 4.5 (< 4.096 Token) werden **gar nicht** gecacht — Kosten dort ohne Cache rechnen.

**B10 · OWASP Top 10 for LLM 2025: LLM01 Prompt Injection, LLM06 Excessive Agency, LLM08 Vektor/Embedding, LLM10 Unbounded Consumption.** (P06 #9, Risikotabelle)
- Status: ⚠️ veraltet — die 2025-Liste ist korrekt wiedergegeben, aber seit **03.08.2026** gibt es die **OWASP GenAI LLM Top 10 2026**; laut Sekundärberichten bleibt Prompt Injection Rang 1, **Excessive Agency steigt auf Rang 3**, Unbounded Consumption auf Rang 6 (Nummern 2026 nicht auf der OWASP-Seite selbst gesehen). Zusätzlich: **OWASP Top 10 for Agentic Applications 2026** (09.12.2025), u. a. ASI06 „Memory & Context Poisoning".
- Primärquelle: [genai.owasp.org/llm-top-10](https://genai.owasp.org/llm-top-10/) — „LLM01:2025 Prompt Injection"; [OWASP-Mitteilung 01.09.2026](https://genai.owasp.org/2026/09/01/owasp-genai-security-project-unveils-2026-top-10-for-llm-applications-new-agent-control-standard-and-sponsors-as-community-tops-30000-members/) — „The OWASP GenAI LLM Top 10 2026 is available for download"; [Agentic Top 10](https://genai.owasp.org/2025/12/09/owasp-genai-security-project-releases-top-10-risks-and-mitigations-for-agentic-ai-security/)
- Belastbarkeit: hoch (Existenz) / mittel (Rangfolge 2026)
- Bedeutung: Sicherheits-Checkliste je Head gegen **Agentic Top 10** (Gedächtnis-Vergiftung!) statt gegen die alte LLM-Liste abgleichen.

**B11 · MCP als offener Standard mit stdio und SSE/streamendem HTTP; Google flankiert mit A2A.** (P06 Abschnitt 5)
- Status: ⚠️ teilweise veraltet — aktuelle MCP-Spezifikation **2026-07-28** (zustandslos); HTTP+SSE ist **offiziell abgekündigt**. MCP gehört seit **09.12.2025** zur **Agentic AI Foundation (Linux Foundation)**; A2A ist seit **23.06.2025** Linux-Foundation-Projekt, nicht mehr Google allein.
- Primärquelle: [MCP-Blog, Spezifikation 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) — „HTTP+SSE transport is also considered to be officially deprecated, with a year-long offramp."; [Anthropic: Donating MCP](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation); [Linux Foundation: A2A-Projekt](https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents)
- Belastbarkeit: hoch
- Bedeutung: Falls MCP-Server gebaut werden: nur stdio oder Streamable HTTP. A2A bleibt „später" (keine Pflicht, kein Nutzen für Einzel-Instanzen jetzt).

**B12 · OpenTelemetry-GenAI-Konventionen (`gen_ai.*`), Status „Development".** (P06 #12)
- Status: ✅ bestätigt — Konventionen liegen inzwischen in einem eigenen Repository.
- Primärquelle: [open-telemetry/semantic-conventions-genai, docs/gen-ai/gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai) — „**Status**: Development", abgerufen 05.10.2026
- Belastbarkeit: hoch
- Bedeutung: Feldnamen anlehnen ist billig; keine Stabilitätszusage → nicht hart verdrahten.

---

## Teil 2 · P07 Recht, Datenschutz, Sicherheit

**B13 · KI-VO: in Kraft 01.08.2024; Art. 4 und 5 seit 02.02.2025; GPAI seit 02.08.2025; allgemein — auch Art. 50 Abs. 1 — seit 02.08.2026.** (P07 Tab. 2)
- Status: ✅ bestätigt
- Primärquelle: [VO (EU) 2024/1689, Art. 113](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R1689) — „Sie gilt ab dem 2. August 2026. Jedoch: a) Die Kapitel I und II gelten ab dem 2. Februar 2025"
- Belastbarkeit: hoch
- Bedeutung: Pflicht ja — Art. 50 Abs. 1 (ZOE als KI erkennbar) gilt **jetzt**; gebaut.

**B14 · Digital-Omnibus KI: VO (EU) 2026/1744, angenommen 08.07.2026, in Kraft 27.07.2026.** (P07 #Omnibus)
- Status: ✅ bestätigt (Veröffentlichung ABl. 24.07.2026, Inkrafttreten am dritten Tag)
- Primärquelle: [EUR-Lex, VO (EU) 2026/1744](https://eur-lex.europa.eu/eli/reg/2026/1744/oj) — „Geschehen zu Straßburg am 8. Juli 2026."; ErwG 46: Inkrafttreten „am dritten Tag nach ihrer Veröffentlichung"
- Belastbarkeit: hoch
- Bedeutung: Alle KI-VO-Fristen ab jetzt nach der geänderten Fassung lesen.

**B15 · Art. 4 KI-Kompetenz zur Bemühenspflicht abgeschwächt.** (P07 #4)
- Status: ✅ bestätigt
- Primärquelle: VO 2026/1744, Art. 1 Nr. 5 (Art. 4 n. F.) — „Diese Verpflichtung verpflichtet Anbieter oder Betreiber nicht, für irgendeine Person ein bestimmtes Niveau an KI-Kompetenz zu garantieren."
- Belastbarkeit: hoch
- Bedeutung: Pflicht ja (seit 27.07.2026 in neuer Fassung): Maßnahmen ergreifen — kurze Schulung/Nutzungshinweise genügen voraussichtlich.

**B16 · Art. 50 Abs. 2 (maschinenlesbare Kennzeichnung): „Schonfrist bis 02.12.2026".** (P07 #3)
- Status: ⚠️ abweichend — die Frist gilt **nur** für Anbieter, deren Systeme **vor dem 02.08.2026 in Verkehr gebracht** wurden. Eigennutzung (Kevin/Malin) ist „Inbetriebnahme", kein Inverkehrbringen.
- Primärquelle: VO 2026/1744, Art. 1 Nr. 39 (Art. 111 Abs. 4 n. F.) — „…die vor dem 2. August 2026 in Verkehr gebracht wurden, treffen die erforderlichen Maßnahmen, um Artikel 50 Absatz 2 bis zum 2. Dezember 2026 nachzukommen."
- Belastbarkeit: hoch
- Bedeutung: Pflicht ja, **ab der ersten Abgabe** einer Instanz an Dritte — also schon vor den Testpersonen.

**B17 · Offene Frage P07: Entfällt Art. 50 Abs. 2, wenn der Mensch jeden Entwurf prüft?**
- Status: ⚠️ Wortlaut spricht dagegen — Abs. 2 kennt nur „unterstützende Funktion für die Standardbearbeitung" bzw. „keine wesentliche Veränderung der Eingabedaten". Die Ausnahme „menschliche Überprüfung/redaktionelle Kontrolle" steht nur in **Abs. 4** (Betreiber, Texte zu Angelegenheiten öffentlichen Interesses).
- Primärquelle: Art. 50 Abs. 2 S. 3 KI-VO — „…soweit die KI-Systeme eine unterstützende Funktion für die Standardbearbeitung ausführen oder … Eingabedaten oder deren Semantik nicht wesentlich verändern"; Abs. 4 — „wenn die durch KI erzeugten Inhalte einem Verfahren der menschlichen Überprüfung oder redaktionellen Kontrolle unterzogen wurden"
- Belastbarkeit: hoch (Wortlaut) / Auslegung: Anwalt; Leitlinien der Kommission stehen aus (laut ErwG des Omnibus bis 01.08.2027)
- Bedeutung: Ganze Mail-Entwürfe durch ZOE sind kaum „Standardbearbeitung" → Kennzeichnung (z. B. Kopfzeile/Metadaten) einplanen.

**B18 · „Gilt für neue Kunden-Instanzen ab Verkauf".** (Auszug P07, K3)
- Status: ⚠️ zu eng — nicht erst ab **Verkauf**: auch die **unentgeltliche** Abgabe im Rahmen einer Geschäftstätigkeit ist Bereitstellung auf dem Markt; Tests unter Realbedingungen sind vom Forschungs-/Test-Ausschluss ausgenommen.
- Primärquelle: Art. 3 Nr. 10 KI-VO — „die entgeltliche oder unentgeltliche Abgabe eines KI-Systems … zur Verwendung auf dem Unionsmarkt im Rahmen einer Geschäftstätigkeit"; Art. 2 Abs. 8 — „Tests unter Realbedingungen fallen nicht unter diesen Ausschluss."
- Belastbarkeit: hoch (Wortlaut); Einordnung der Testphase: Anwalt
- Bedeutung: Anbieterpflichten (Art. 50 Abs. 1 und 2) gelten **schon für die 3–4 Testinstanzen**.

**B19 · Kein Hochrisiko-System; Grenze bei Bewertung/Überwachung von Beschäftigten (Anhang III Nr. 4); Fristen 02.12.2027 / 02.08.2028; Art. 14 (menschliche Aufsicht).** (P07 #1)
- Status: ✅ bestätigt (Normen, Fristen). Art. 14 KI-VO gilt **nur für Hochrisiko-Systeme** — für MAKE OS keine Pflicht, die Freigabe-Logik ist freiwillig bzw. folgt aus Art. 22 DSGVO.
- Primärquelle: Anhang III Nr. 4 lit. b KI-VO — „für die Beobachtung und Bewertung der Leistung und des Verhaltens von Personen in solchen Beschäftigungsverhältnissen"; Art. 113 Abs. 3 lit. c n. F. (VO 2026/1744): 02.12.2027 (Anhang III), 02.08.2028 (Anhang I); Art. 14 Abs. 1 — „Hochrisiko-KI-Systeme werden so konzipiert und entwickelt, dass sie … von natürlichen Personen wirksam beaufsichtigt werden können."
- Belastbarkeit: hoch (Normen) / Einstufung MAKE OS: Schätzung
- Bedeutung: Pflicht nein, solange Head of People/Kapazität **keine Beschäftigten bewertet**; sonst Hochrisiko ab 02.12.2027.

**B20 · K4-Frage: Ist „Belastung" aus Gesundheitsdaten Emotionserkennung (Art. 50 Abs. 3)?**
- Status: ✅ geklärt nach Erwägungsgrund — physische Zustände wie **Ermüdung** sind ausdrücklich **keine** Emotionen. Aber: Emotionsableitung **am Arbeitsplatz** ist seit 02.02.2025 **verboten** (Art. 5 Abs. 1 lit. f).
- Primärquelle: ErwG 18 KI-VO — „Dies umfasst nicht physische Zustände wie Schmerz oder Ermüdung"; Art. 5 Abs. 1 lit. f — „Verwendung von KI-Systemen zur Ableitung von Emotionen einer natürlichen Person am Arbeitsplatz und in Bildungseinrichtungen"
- Belastbarkeit: hoch
- Bedeutung: Erholung/Energie als physischer Zustand ok; nie Stimmung/Emotion von Beschäftigten ableiten.

**B21 · Deutsches KI-Durchführungsgesetz: „BGBl. I 2026 Nr. 245 vom 28.07.2026", „KI-Marktüberwachungskammer".** (P07)
- Status: ⚠️ abweichend — **BGBl. 2026 I Nr. 223**, ausgefertigt **22.07.2026**, in Kraft **29.07.2026**; Bundesnetzagentur mit „Koordinierungs- und Kompetenzzentrum" (§ 5). Eine „Kammer" war im Text nicht zu finden.
- Primärquelle: [gesetze-im-internet.de/ki-mig](https://www.gesetze-im-internet.de/ki-mig/BJNR0DF0B0026.html), § 2 Abs. 1 — „Die Bundesnetzagentur ist die für die Einhaltung der Verordnung (EU) 2024/1689 zuständige Marktüberwachungsbehörde"
- Belastbarkeit: hoch
- Bedeutung: Aufsicht für Art. 50 = Bundesnetzagentur; keine eigene Meldepflicht für uns gefunden.

**B22 · Gesundheitsdaten nur mit ausdrücklicher Einwilligung (Art. 9 Abs. 2 lit. a).** (P07 #5)
- Status: ✅ bestätigt. Hinweis: Die DSGVO-Änderungen des „Daten-Omnibus" sind laut Fachberichten **noch im Verfahren** — maßgeblich ist der unveränderte Text (⏳ beobachten).
- Primärquelle: [DSGVO Art. 9 Abs. 2 lit. a](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32016R0679) — „Die betroffene Person hat in die Verarbeitung der genannten personenbezogenen Daten für einen oder mehrere festgelegte Zwecke ausdrücklich eingewilligt"
- Belastbarkeit: hoch
- Bedeutung: Pflicht ja, sofort — drei getrennte Einwilligungen sind gebaut.

**B23 · Art. 22: Mensch zwischenschalten hilft nur bei echter Prüfung (DSK-Orientierungshilfe KI).** (P07 #6)
- Status: ✅ bestätigt
- Primärquelle: Art. 22 Abs. 1 DSGVO; [DSK-Orientierungshilfe „KI und Datenschutz", 06.05.2024](https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf), Nr. 1.6 — „Eine lediglich formelle Beteiligung eines Menschen im Entscheidungsprozess ist nicht ausreichend."
- Belastbarkeit: hoch (Aufsichtsbehörden-Position)
- Bedeutung: Freigabe-Karte braucht Daten + Begründung + echte Ablehnungsoption; gegen „Durchwinken" messen (s. B54).

**B24 · Rollen: Auftragsverarbeiter für Kundendaten → AVV (Art. 28 Abs. 3), zwei Verzeichnisse (Art. 30 Abs. 1 und 2).** (P07 #5)
- Status: ✅ bestätigt; zusätzlich: Art. 30 Abs. 5 (unter 250 Beschäftigte) befreit **nicht**, weil Art.-9-Daten verarbeitet werden.
- Primärquelle: DSGVO Art. 30 Abs. 2 — „Jeder Auftragsverarbeiter … führen ein Verzeichnis zu allen Kategorien von im Auftrag eines Verantwortlichen durchgeführten Tätigkeiten der Verarbeitung"; Art. 30 Abs. 5 — Ausnahme nur, wenn die Verarbeitung „nicht die Verarbeitung besonderer Datenkategorien gemäß Artikel 9 Absatz 1 … einschließt"
- Belastbarkeit: hoch
- Bedeutung: Pflicht ja, vor der ersten Testinstanz (AVV-Vorlage + AV-Verzeichnis fehlen).

**B25 · DSFA „praktisch Pflicht" (Gesundheit, Kapazitätsbewertung, neue Technik).** (P07 #7 — im Bericht nur „Schätzung")
- Status: ✅ bestätigt und **verschärft**: Die DSK-Muss-Liste nennt Wearable-Daten zur Leistungsbestimmung ausdrücklich, **auch ohne „umfangreich"**.
- Primärquelle: [DSK-Liste DSFA, Version 1.1 v. 17.10.2018](https://www.lda.bayern.de/media/dsfa_muss_liste_dsk_de.pdf), Nr. 17 — „…auch wenn sie nicht als „umfangreich" … anzusehen ist – sofern die Daten … dazu verwendet werden, die Leistungsfähigkeit der Personen zu bestimmen." Beispiel: „Zentrale Speicherung der Messdaten von Sensoren, die in Fitnessarmbändern oder Smartphones verbaut sind". Nr. 11: KI „zur Bewertung persönlicher Aspekte".
- Belastbarkeit: hoch (Aufsichtsbehörden-Liste nach Art. 35 Abs. 4)
- Bedeutung: Pflicht ja für Instanzen mit Whoop/Erholung/Kapazität — DSFA vor Einsatz bei Testpersonen (oder Modul dort aus).

**B26 · § 38 Abs. 1 S. 2 BDSG: DSB-Pflicht unabhängig von der Kopfzahl bei DSFA-pflichtiger Verarbeitung.** (P07 #8)
- Status: ✅ bestätigt (Wortlaut)
- Primärquelle: [§ 38 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/__38.html) — „…haben sie unabhängig von der Anzahl der mit der Verarbeitung beschäftigten Personen eine Datenschutzbeauftragte oder einen Datenschutzbeauftragten zu benennen."
- Belastbarkeit: hoch (Norm); Anwendung auf MAKE als Auftragsverarbeiter: Anwalt
- Bedeutung: Wegen B25 sehr wahrscheinlich Pflicht → externen DSB einplanen.

**B27 · § 62a StBerG: IT-Dienstleister in Textform zur Verschwiegenheit verpflichten, mit Strafbelehrung; AVV allein reicht nicht.** (P07 #13)
- Status: ⚠️ teilweise — Wortlaut stimmt. Aber die Pflicht trifft den **Steuerberater** gegenüber **seinem** Dienstleister. Greift nur, wenn der Steuerberater MAKE beauftragt bzw. Mandantendaten in MAKE gibt; der bloße Zugriff des Steuerberaters auf die Instanz seines Mandanten ist ein anderer Fall (Anwalt).
- Primärquelle: [§ 62a Abs. 3 StBerG](https://www.gesetze-im-internet.de/stberg/__62a.html) — „Der Vertrag mit dem Dienstleister bedarf der Textform. In ihm ist 1. der Dienstleister unter Belehrung über die strafrechtlichen Folgen einer Pflichtverletzung zur Verschwiegenheit zu verpflichten"
- Belastbarkeit: hoch (Norm) / Anwendungsfall offen
- Bedeutung: Vorlage nötig, sobald Berufsgeheimnisträger MAKE **selbst** nutzen; für Phase 3.2 Fall genau beschreiben.

**B28 · § 203 StGB: Verletzung von Privatgeheimnissen; mitwirkende Personen.** (P07 #13)
- Status: ✅ bestätigt, mit Ergänzung: Ist MAKE „mitwirkende Person", muss MAKE **seine eigenen** Unterdienstleister (Hetzner, Anthropic) zur Geheimhaltung verpflichten — sonst strafbar.
- Primärquelle: [§ 203 Abs. 4 S. 2 Nr. 2 StGB](https://www.gesetze-im-internet.de/stgb/__203.html) — „…sich einer weiteren mitwirkenden Person … bedient und nicht dafür Sorge getragen hat, dass diese zur Geheimhaltung verpflichtet wurde"
- Belastbarkeit: hoch
- Bedeutung: Pflicht nur bei Berufsgeheimnisträgern als Nutzer; dann Kette Kunde → MAKE → Anthropic/Hetzner schließen.

**B29 · § 5 StBerG / BFH II R 22/15: „Software darf rechnen, sortieren, Voranmeldungen vorbereiten".** (P07 #12)
- Status: ⚠️ Grundsatz plausibel, **Fundstelle trägt ihn nicht** — der BFH entschied, dass Buchhalter (§ 6 Nr. 4 StBerG) UStVA auch dann nicht erstellen dürfen, wenn das Programm sie automatisch erzeugt.
- Primärquelle: [BFH, Urteil v. 07.06.2017 – II R 22/15, Leitsatz](https://www.bundesfinanzhof.de/en/entscheidungen/entscheidungen-online/decision-detail/STRE201710165/) — „…auch dann nicht zur Erstellung von Umsatzsteuervoranmeldungen berechtigt, wenn diese aufgrund des verwendeten Buchführungsprogramms automatisch erfolgt."; [§ 5 StBerG](https://www.gesetze-im-internet.de/stberg/__5.html)
- Belastbarkeit: hoch (Gegenbeleg)
- Bedeutung: Head of Finance nur als Werkzeug des Steuerpflichtigen bzw. Zuarbeit für den Steuerberater; nichts „für" Dritte erklären/übermitteln. Mit Steuerberater klären.

**B30 · § 7 UWG: keine B2B-Ausnahme für Werbe-Mails.** (P07 #11)
- Status: ✅ bestätigt (Ausnahme nur Bestandskunden, Abs. 3)
- Primärquelle: [§ 7 Abs. 2 Nr. 2 UWG](https://www.gesetze-im-internet.de/uwg_2004/__7.html) — „…elektronischer Post, ohne dass eine vorherige ausdrückliche Einwilligung des Adressaten vorliegt"
- Belastbarkeit: hoch
- Bedeutung: Pflicht ja — gebaut (Prüfer, Werbesperre, Einzelklick).

**B31 · DPF: EuG *Latombe* (03.09.2025, T-553/23) bestätigt; Rechtsmittel C-703/25 P anhängig; *Trump v. Slaughter* (29.06.2026).** (P07 #9)
- Status: ✅ bestätigt (Daten, Aktenzeichen, Tenor). Folgen von *Slaughter* für das DPF = Meinung (⏳; kein EuGH-Urteil bis heute gefunden).
- Primärquelle: [EuG, Pressemitteilung 106/25, 03.09.2025](https://curia.europa.eu/site/upload/docs/application/pdf/2025-09/cp250106en.pdf) — „the General Court dismisses an action for annulment of the new framework for the transfer of personal data"; [ABl. C/2025/6610 (C-703/25 P)](https://eur-lex.europa.eu/eli/C/2025/6610/oj/eng) — Rechtsmittel vom 31.10.2025; [US Supreme Court, No. 25-332](https://www.supremecourt.gov/opinions/25pdf/25-332_qn12.pdf) — „Argued December 8, 2025—Decided June 29, 2026"; Tenor: FTC-Abberufungsschutz verstößt gegen die Gewaltenteilung.
- Belastbarkeit: hoch
- Bedeutung: Für Anthropic ohnehin SCC (s. B37) — DPF-Wackeln trifft uns nur mittelbar; Quartalsprüfung bleibt sinnvoll.

**B32 · CRA: reines SaaS nicht erfasst; Mac-Zulieferer evtl. Produkt; „Meldepflichten 2026, voll Herbst 2027".** (P07 #16)
- Status: ⚠️ Daten unpräzise — exakt: Kapitel IV ab **11.06.2026**, Meldepflichten (Art. 14) ab **11.09.2026** (ENISA-Meldeplattform seit diesem Tag laut Fachberichten in Betrieb), volle Geltung **11.12.2027**. SaaS-Aussage stimmt; aber: Ist der Mac-Zulieferer ein Produkt, fällt das **Server-Backend, ohne das er nicht funktioniert**, als „Datenfernverarbeitung" mit hinein.
- Primärquelle: [VO (EU) 2024/2847, Art. 71 Abs. 2](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024R2847) — „Diese Verordnung gilt ab dem 11. Dezember 2027. Artikel 14 gilt jedoch ab dem 11. September 2026"; ErwG 12 — „Die Richtlinie (EU) 2022/2555 gilt für … Cloud-Dienstmodelle wie SaaS"
- Belastbarkeit: hoch
- Bedeutung: Pflicht nur, wenn der Mac-Zulieferer an Dritte geht — dann **schon jetzt** Meldepflichten. NIS2 trifft MAKE als Kleinstunternehmen nicht direkt.

**B33 · Produkthaftung neu (RL 2024/2853): Software/SaaS ist Produkt, verschuldensunabhängig, Umsetzung bis 09.12.2026.** (P07 #14)
- Status: ✅ bestätigt; präzisiert: gilt für Produkte, die **nach dem 09.12.2026** in Verkehr gebracht werden.
- Primärquelle: [RL (EU) 2024/2853](https://eur-lex.europa.eu/legal-content/DE/TXT/HTML/?uri=CELEX:32024L2853), Art. 4 Nr. 1 — „unter „Produkt" sind auch Elektrizität, digitale Konstruktionsunterlagen, Rohstoffe und Software zu verstehen"; Art. 2 Abs. 1 — „Diese Richtlinie gilt für Produkte, die nach dem 9. Dezember 2026 in Verkehr gebracht oder in Betrieb genommen werden."; Art. 22 (Umsetzung 09.12.2026)
- Belastbarkeit: hoch
- Bedeutung: Pflicht/Haftung ab Inverkehrbringen nach 09.12.2026 — Testphase davor nicht erfasst; Update-/Schwachstellenprozess vorher dokumentieren.

**B34 · PLD-Details: „Art. 14 Haftungsausschluss unwirksam", „Art. 5 Datenverlust personenbezogener/gemischter Daten", „Art. 10 Abs. 2 lit. b Vermutung bei KI-VO-Verstoß".** (P07)
- Status: ⚠️ abweichend — Ausschlussverbot = **Art. 15** (Art. 14 = Rückgriff). Schadensarten = **Art. 6**; Daten nur, wenn **nicht beruflich** genutzt (Geschäftsdaten der Kunden also nicht). Art. 10 Abs. 2 lit. b verlangt Verstoß gegen **Produktsicherheits**anforderungen, die vor genau diesem Schaden schützen — ob Art. 50 KI-VO dazu zählt, ist offen.
- Primärquelle: RL 2024/2853, Art. 15 — „…nicht durch eine vertragliche Bestimmung oder durch nationales Recht beschränkt oder ausgeschlossen wird"; Art. 6 Abs. 1 lit. c — „Vernichtung oder Beschädigung von Daten, die nicht für berufliche Zwecke verwendet werden"
- Belastbarkeit: hoch
- Bedeutung: Haftungsrisiko für **private** Daten (Privat-Bereich, Gesundheit) höher als für Business-Daten; AGB können gegenüber Geschädigten nicht helfen.

**B35 · Deutsches Umsetzungsgesetz zur Produkthaftung.** (Ergänzung)
- Status: ⏳ nicht prüfbar — Regierungsentwurf als BT-Drucksache 21/4297 (25.02.2026) gefunden; Verkündung im BGBl. nicht bestätigt (Sekundärquellen widersprüchlich).
- Primärquelle: [BT-Drs. 21/4297](https://dserver.bundestag.de/btd/21/042/2104297.pdf)
- Belastbarkeit: gering (Stand)
- Bedeutung: Vor 09.12.2026 erneut prüfen; Richtlinie wirkt zeitlich ohnehin erst danach.

**B36 · E-Rechnung-Fristen.** (im Auftrag genannt, in P07 **nicht** enthalten — ergänzt)
- Status: ✅ bestätigt
- Primärquelle: [§ 27 Abs. 38 UStG](https://www.gesetze-im-internet.de/ustg_1980/__27.html) — Nr. 2: Papier/sonstiges Format für 2027er Umsätze nur, „wenn der Gesamtumsatz … im vorangegangenen Kalenderjahr nicht mehr als 800 000 Euro betragen hat"
- Belastbarkeit: hoch
- Bedeutung: Pflicht für Nutzer (B2B-Rechnungen): Ausstellen als E-Rechnung ab 01.01.2027 (> 800.000 €) bzw. 01.01.2028 (alle); Empfang seit 2025. Für das Rechnungs-Modul: XRechnung/ZUGFeRD einplanen.

**B37 · Anthropic: kein Training, Aufbewahrung, ZDR; Transfergrundlage.** (P07 #9/A „Kevin muss"; Datenschutzhinweis-Entwurf)
- Status: ✅ bestätigt — Standard: Löschung binnen 30 Tagen, kein Training ohne Erlaubnis; ZDR auf Antrag (gilt nicht für Files-API, Code-Execution). Anthropics Datenschutzerklärung nennt **SCC**, das DPF **nicht**.
- Primärquelle: [Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) — „For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days of receipt or generation"; [API-Doku Datenaufbewahrung](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) — „Retained data is never used for model training without your express permission."; [Privacy Policy, gültig ab 10.09.2026](https://www.anthropic.com/legal/privacy) — „We rely on standard contractual clauses to transfer information…"
- Belastbarkeit: hoch (Hersteller); DPF-Teilnehmerliste selbst nicht eingesehen
- Bedeutung: „Kein Training mit Ihren Daten" ist belegbar; Datenschutzhinweis von „SCC/DPF" auf „SCC" ändern; ZDR beantragen.

**B38 · DACH-Kaufkriterien 82 % EU-Server · 88 % kein Training · 76 % § 203 · 71 % Black-Box („Bitkom/BSI/eco").** (P07)
- Status: ❌ nicht auffindbar (eigene Suche 05.10.2026; Bitkom 2026 berichtet andere Kennzahlen)
- Primärquelle: keine; geprüft u. a. [Bitkom-Studienbericht KI 2026](https://www.bitkom.org/sites/main/files/2026-02/bitkom-studienbericht-ki.pdf)
- Belastbarkeit: gering
- Bedeutung: Nicht in Vertrieb/Website verwenden.

**B39 · Claude über Bedrock/Vertex in EU-Regionen nutzbar.** (P07 #10)
- Status: ✅ bestätigt für Bedrock — EU-Inferenzprofil (Frankfurt u. a.), regionale Endpunkte mit **10 % Aufpreis**; Opus 5.5, Sonnet 5, Haiku 4.5 gelistet. Vorsicht: Das EU-Profil umfasst auch **London und Zürich** (keine EU-Staaten); auf Bedrock fehlen u. a. Structured Outputs, Web-Suche, Batches. Vertex nicht geprüft.
- Primärquelle: [Claude in Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock) — „Regional endpoints carry a 10% pricing premium over global endpoints."
- Belastbarkeit: hoch
- Bedeutung: Option für „Daten bleiben in Europa", aber mit Funktionsverlust (Web-Suche!) und anderem Vertragspartner (AWS als Auftragsverarbeiter) — Entscheidung Kevin.

---

## Teil 3 · P08 Arbeitspsychologie

**B40 · „Unterbrechungen kosten im Mittel 23 Min. 15 Sek. Wiederaufnahme" (Gloria Mark).** (P08 #5, Werbeargument)
- Status: ❌ als Studienbefund falsch — Zahl stammt aus einem **Interview**. Im Paper: Rückkehr zur unterbrochenen Tätigkeit am selben Tag nach **25 Min. 26 Sek.** (SD 54 Min. 48 Sek.), mit **> 2 anderen Tätigkeiten dazwischen** — das ist keine verlorene Zeit.
- Primärquelle: [Mark, Gonzalez & Harris 2005, CHI, DOI 10.1145/1054972.1055017](https://www.ics.uci.edu/~gmark/CHI2005.pdf) — „When people did resume work on the same day, it took an average length of time of 25 min. 26 sec (sd=54 min. 48sec.)"; [Gallup-Interview 08.06.2006](https://news.gallup.com/businessjournal/23146/too-many-interruptions-work.aspx) — „it was resumed, on average, in 23 minutes and 15 seconds"
- Belastbarkeit: hoch (Gegenbeleg)
- Bedeutung: Nie „23 Minuten" werben; Argument fürs Bündeln über B41 führen.

**B41 · Bündeln wirkt: Unterbrechungen → schneller, aber gestresster (Mark 2008); E-Mail 3× täglich senkt Stress (Kushlev & Dunn 2015).** (P08 #5, #6)
- Status: ✅ bestätigt
- Primärquelle: [Mark, Gudith & Klocke 2008, CHI, DOI 10.1145/1357054.1357072](https://www.ics.uci.edu/~gmark/chi08-mark.pdf) — „people compensate for interruptions by working faster, but this comes at a price: experiencing more stress, higher frustration, time pressure and effort."; [Kushlev & Dunn 2015, Comput Hum Behav 43:220–228, DOI 10.1016/j.chb.2014.11.005](https://www.interruptions.net/literature/Kushlev-ComputHumBehav15.pdf) — „participants experienced significantly lower daily stress than during the unlimited email use week" (n = 124)
- Belastbarkeit: mittel–hoch (je eine Studie, Labor bzw. Feld)
- Bedeutung: Freigabe-Fenster morgens/spätnachmittags gut begründet.

**B42 · Aufmerksamkeitsrest (Leroy 2009); Ready-to-Resume-Plan senkt ihn (Leroy & Glomb 2018, „JAP", „−60 %").** (P08 #5)
- Status: ⚠️ Wirkung bestätigt; Zitat und Zahl falsch — Leroy & Glomb erschien in **Organization Science** (DOI 10.1287/orsc.2017.1184); die angegebene DOI 10.1037/apl0000298 gehört zu einem **anderen Paper**. „60 %" steht nicht im Abstract.
- Primärquelle: [Leroy 2009, OBHDP 109(2), DOI 10.1016/j.obhdp.2009.04.002](https://doi.org/10.1016/j.obhdp.2009.04.002) — Titel: „Why is it so hard to do my work? The challenge of attention residue when switching between work tasks"; [Leroy & Glomb 2018](https://doi.org/10.1287/orsc.2017.1184) — „A ready-to-resume intervention … mitigates this effect such that attention residue is reduced and performance on the interrupting task does not suffer."
- Belastbarkeit: mittel–hoch (vier Studien, Labor)
- Bedeutung: Tagesabschluss mit „nächster Schritt je offener Aufgabe" ist belegt — ohne Prozentzahl.

**B43 · „Aufgabenwechsel erhöht die Fehlerquote um bis zu 40 % (Monsell 2003)".** (P08)
- Status: ❌ nicht in der Quelle — Monsell belegt Wechselkosten qualitativ, keine 40 %.
- Primärquelle: [Monsell 2003, Trends Cogn Sci 7(3):134–140, DOI 10.1016/S1364-6613(03)00028-7](https://pubmed.ncbi.nlm.nih.gov/12639695/) — „Subjects' responses are substantially slower and, usually, more error-prone immediately after a task switch."
- Belastbarkeit: hoch (Gegenbeleg)
- Bedeutung: Nur „Wechsel kostet Zeit und Genauigkeit", keine Zahl.

**B44 · Zeitmanagement wirkt stärker auf Wohlbefinden als auf Leistung („Aeon & Aguinis 2021, JAP, 108 Studien").** (P08 #7)
- Status: ⚠️ Werte richtig, Zitat falsch — korrekt: Aeon, Faber & Panaccio 2021, *PLoS ONE*, k = 158, N = 53.957. Korrelationen, **keine** Interventionseffekte.
- Primärquelle: [PLoS ONE 16(1):e0245066, DOI 10.1371/journal.pone.0245066](https://pmc.ncbi.nlm.nih.gov/articles/PMC7799745/) — Leistung r = .259, Wohlbefinden r = .313, Lebenszufriedenheit r = .426, Belastung r = −.222; „time management seems to enhance wellbeing—in particular, life satisfaction—to a greater extent than it does performance."
- Belastbarkeit: mittel (Metaanalyse, korrelativ)
- Bedeutung: Planung als Entlastung verkaufen, nicht als Leistungsturbo.

**B45 · Wenn-Dann-Pläne wirken mittel bis stark (94 Studien).** (P08 #8)
- Status: ✅ bestätigt (d = .65; im Bericht fehlte die Zahl)
- Primärquelle: [Gollwitzer & Sheeran 2006, Adv Exp Soc Psychol 38:69–119, DOI 10.1016/S0065-2601(06)38002-1](https://kops.uni-konstanz.de/handle/123456789/10973) — „Findings from 94 independent tests showed that implementation intentions had a positive effect of medium-to-large magnitude (d= .65) on goal attainment."
- Belastbarkeit: hoch
- Bedeutung: Aufgaben/Meilensteine an „wann + wo + erster Schritt" binden ist gut belegt.

**B46 · Planungsfehlschluss: geplant 33,9 Tage, tatsächlich 55,5 (Buehler 1994).** (P08 #9)
- Status: ✅ bestätigt (Abschlussarbeiten, n = 33); „30–50 % Unterschätzung" ist eine Verallgemeinerung.
- Primärquelle: [Buehler, Griffin & Ross 1994, JPSP 67(3):366–381, DOI 10.1037/0022-3514.67.3.366](https://web.mit.edu/curhan/www/docs/Articles/biases/67_J_Personality_and_Social_Psychology_366,_1994.pdf) — „respondents predicted, on average, that they would finish in 33.9 days, but they actually took 55.5 days"
- Belastbarkeit: hoch (vielfach repliziert)
- Bedeutung: „Ähnliches dauerte bisher 1,6× länger" neben Schätzungen anzeigen — belegt.

**B47 · Ego Depletion nicht repliziert (23 Labore, d = 0,04).** (P08 #3)
- Status: ✅ bestätigt
- Primärquelle: [Hagger et al. 2016, Perspect Psychol Sci 11(4):546–573, DOI 10.1177/1745691616652873](https://pubmed.ncbi.nlm.nih.gov/27474142/) — „k = 23, total N = 2,141 … (d = 0.04, 95% CI [-0.07, 0.15]"
- Belastbarkeit: hoch
- Bedeutung: Nicht mit „Willenskraft ist ein Muskel" argumentieren.

**B48 · Kontrollarbeit lässt Glutamat im lPFC steigen und verschiebt Entscheidungen zum Kurzfristigen (Wiehler 2022) — „toxische Überlastung".** (P08 #4, Werbeargument)
- Status: ⚠️ Befund bestätigt, Deutung überzogen — eine Studie (ein Arbeitstag, zwei kleine Gruppen); „toxisch" ist die Hypothese der Autoren, kein Nachweis von Schaden.
- Primärquelle: [Wiehler et al. 2022, Curr Biol 32(16):3564–3575, DOI 10.1016/j.cub.2022.07.010](https://pubmed.ncbi.nlm.nih.gov/35961314/) — „high-demand cognitive work resulted in higher glutamate concentration and glutamate/glutamine diffusion in a cognitive control brain region"
- Belastbarkeit: gering–mittel
- Bedeutung: Nicht werben („Glutamat-Schutz"); höchstens als Hintergrund für „wichtige Entscheidungen früh am Tag".

**B49 · Orthosomnie 3–14 % „unter Wearable-Nutzern" (Baron 2017).** (P08 #12)
- Status: ⚠️ abweichend — 3,0 / 8,6 / 14,0 % (je nach Schwelle) beziehen sich auf die **Gesamtstichprobe** (n = 523, davon 35,8 % Tracker-Nutzer); Baron 2017 ist eine **Fallserie**, keine Häufigkeitsstudie.
- Primärquelle: [Jahrami et al. 2024, Brain Sci 14(11):1123, DOI 10.3390/brainsci14111123](https://pubmed.ncbi.nlm.nih.gov/39595886/) — „One hundred seventy-six (35.8%) … regularly used sleep-tracking devices"; [Baron et al. 2017, J Clin Sleep Med, DOI 10.5664/jcsm.6472](https://pubmed.ncbi.nlm.nih.gov/27855740/)
- Belastbarkeit: mittel (eine Querschnittsstudie)
- Bedeutung: Risiko real → Energie nur beschreibend, nie als Note/Rot; Zahl nicht werblich nutzen.

**B50 · HRV hängt mit Exekutivfunktionen zusammen (Thayer 2009) und „fällt 24–48 h vor subjektiver Erschöpfung".** (P08 #11)
- Status: ⚠️ erster Teil bestätigt (Review der eigenen Studien; im Bericht falsche Zeitschrift/DOI — korrekt *Ann Behav Med*). Die „24–48 h" stehen **nicht** in der zitierten Quelle; keine Primärquelle gefunden.
- Primärquelle: [Thayer et al. 2009, Ann Behav Med 37(2):141–153, DOI 10.1007/s12160-009-9101-z](https://pubmed.ncbi.nlm.nih.gov/19424767/) — „individual differences in HRV are related to performance on tasks associated with executive function and prefrontal cortical activity"
- Belastbarkeit: mittel (Zusammenhang) / gering (Vorhersage-Zeitfenster)
- Bedeutung: Whoop-Werte als Hinweis relativ zur eigenen Basis ok; keine Frühwarn-Versprechen.

**B51 · Schlafmangel: Aufmerksamkeit stark, Arbeitsgedächtnis mittel, „exekutive Funktionen d = 0,45" (Lim & Dinges 2010).** (P08 #11)
- Status: ⚠️ teilweise — Aufmerksamkeit groß (g = −0,776) bestätigt; **schlussfolgerndes Denken nicht signifikant** (g = −0,125); „d = 0,45 exekutiv" nicht belegt.
- Primärquelle: [Lim & Dinges 2010, Psychol Bull 136(3):375–389, DOI 10.1037/a0018883](https://pubmed.ncbi.nlm.nih.gov/20438143/) — „Effect sizes ranged from small and nonsignificant (reasoning accuracy: g = -0.125 …) to large (lapses in simple attention: g = -0.776"
- Belastbarkeit: hoch (Metaanalyse, Totalschlafentzug < 48 h)
- Bedeutung: Nach schlechter Nacht eher Routine/Fokus-Schutz vorschlagen, nicht „keine Strategie".

**B52 · 23,0 % der Solo-Selbstständigen arbeiten ≥ 49 h/Woche („WSI/Mikrozensus").** (P08 #2)
- Status: ✅ bestätigt — Quelle ist **Destatis** (Mikrozensus 2025); Bezugsgröße: **Vollzeit**erwerbstätige; Vergleich 4,1 % der Vollzeit-Arbeitnehmer, 44,5 % Selbstständige mit Beschäftigten.
- Primärquelle: [Destatis, Pressemitteilung Nr. 263 vom 23.07.2026](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/07/PD26_263_13.html) — „Selbstständige mit Beschäftigten (44,5 %) und Solo-Selbstständige (23,0 %) am häufigsten von überlanger Arbeitszeit betroffen."
- Belastbarkeit: hoch (amtliche Statistik)
- Bedeutung: Zielgruppe arbeitet überdurchschnittlich lang — Belastungsargument mit amtlicher Zahl belegbar.

**B53 · Gründer: 72 % psychisch belastet vs. 48 % Vergleichsgruppe; Depression 30 %, ADHS 29 % (Freeman).** (P08 #1)
- Status: ⚠️ teilweise — 72 % schließt **familiäre Vorgeschichte** bei selbst symptomfreien Gründern ein (eigene Vorgeschichte: 49 %); Selbstauskunft, n = 242 vs. 93, USA; „48 %" nicht im Abstract.
- Primärquelle: [Freeman et al., Small Business Economics 53 (online 2018), DOI 10.1007/s11187-018-0059-8](https://doi.org/10.1007/s11187-018-0059-8) — „Mental health differences directly or indirectly affected 72% of the entrepreneurs in this sample"
- Belastbarkeit: mittel
- Bedeutung: Nicht „72 % der Gründer sind psychisch krank" sagen; höchstens vorsichtig mit Quelle.

**B54 · Automation Bias: blindes Bestätigen bei Entscheidungshilfen; Gegenmittel Gestaltung, nicht Schulung.** (P08 #15)
- Status: ✅ bestätigt
- Primärquelle: [Parasuraman & Manzey 2010, Hum Factors 52(3):381–410, DOI 10.1177/0018720810376055](https://pubmed.ncbi.nlm.nih.gov/21077562/) — „Automation bias occurs in both naive and expert participants, cannot be prevented by training or instructions"
- Belastbarkeit: hoch (Review)
- Bedeutung: Kein „Alle freigeben" für Ungleiches, Vorher/Nachher, Ablehnquote je Stapelposition messen — Gestaltung ist das Gegenmittel.

**B55 · KI-Produktivität: Support +14 % (Neulinge +34 %, n = 5.179); BCG 25 % schneller, 40 % besser, außerhalb der Grenze −19 Pp.** (P08 #14)
- Status: ⚠️ im Kern bestätigt — Brynjolfsson in der Endfassung (QJE 2025): **15 %**, n = **5.172**. Dell'Acqua: 12,2 % mehr Aufgaben, 25,1 % schneller, außerhalb der Grenze **19 %** seltener richtig (Abstract); „40 % bessere Qualität" steht nicht im Abstract (dort: „significantly improved quality"), im Volltext nicht geprüft.
- Primärquelle: [Brynjolfsson, Li & Raymond, QJE 2025, DOI 10.1093/qje/qjae044](https://doi.org/10.1093/qje/qjae044) — „increases worker productivity, as measured by issues resolved per hour, by 15% on average"; [Dell'Acqua et al. 2023, SSRN, DOI 10.2139/ssrn.4573321](https://doi.org/10.2139/ssrn.4573321) — „completing 12.2% more tasks and completing them 25.1% more quickly on average"; „19% less likely to produce correct solutions"
- Belastbarkeit: hoch (Feldexperimente)
- Bedeutung: „KI mit Mensch am Steuer" belegt; Zahlen in Vertrieb nur in dieser korrigierten Form.

---

## Methode und Grenzen
- **Gesetze:** Volltexte von EUR-Lex (KI-VO, VO 2026/1744, DSGVO, CRA, PLD) und gesetze-im-internet.de (BDSG, StBerG, StGB, UWG, UStG, KI-MIG) heruntergeladen und durchsucht; Gerichte über curia.europa.eu, EUR-Lex (ABl. C) und supremecourt.gov.
- **Studien:** über PubMed (E-Utilities), Crossref, Semantic Scholar oder Original-PDF; Aussagen nur aus Abstract/Text, den ich gesehen habe.
- **Technik:** Hersteller-Doku (Anthropic, OpenAI-PDF, MCP-Blog, OTel-Repo, OWASP).
- **Nicht geprüft in dieser Runde:** MDR/„kein Medizinprodukt" (P07 #15), § 25 TDDDG, GoBD, ISO/C5-Aufwände, Vertex AI, Anthropic in der DPF-Teilnehmerliste (nur über Anthropics eigene Datenschutzerklärung), Ränge der OWASP-Liste 2026 im Original-PDF.
- **Ein Sekundärbeleg** wurde nur dort genutzt, wo er ausdrücklich so markiert ist (OWASP-Ränge 2026, CRA-Meldeplattform, Daten-Omnibus-Stand, ProdHaftG-Stand).
