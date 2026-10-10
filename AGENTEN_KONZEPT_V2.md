# MAKE OS — Agenten v2: Konzept für ein Agenten-System auf Spitzenniveau

**Stand:** 10.10.2026 · nur Konzept, nichts gebaut · Basis `54c397cd` (Branch `update-0910b`, enthält `agenten-nacht`)
**Auftrag (Kevin, 09.10. spät, wörtlich):** „Nochmal ein gesamtes Konzept bauen, um das Agent-System weiter auszubauen, tiefer auszubauen —
und dabei alles im absoluten Top-1-%-Level zu programmieren.“

> **Gilt zusammen mit:** CLAUDE.md (vor allem Plattform-Regel, „Firma und Privat getrennt — auch in der Datenhaltung“, Eiserne Regeln 3/5/6/7,
> KI-Tor/Art. 9) · `AGENTEN_KONZEPT.md` (v1, Pakete 0–4c gebaut) · `ANALYSE_AGENTEN_DATEN.md` (E1–E9) · `research/agenten/ARCHITEKTUR.md`
> (R1–R20) · `AI_CEO_MODUL.md` D3–D6. Wo dieses Dokument und v1 abweichen, gilt nach Kevins Entscheidung (Teil E) dieses hier.
> Zeilenangaben beziehen sich auf `54c397cd`. Nichts wurde ausgeführt (kein tsc, kein vitest, kein Server) — alles hier ist gelesen.

---

## Zusammenfassung für Kevin (15 Zeilen)

1. Euer Agenten-System ist schon stark: Sicherheit, Datenschutz und Robustheit liegen über dem, was die meisten Produkte haben — nichts geht ohne euren Klick nach außen.
2. Zur absoluten Spitze fehlen vor allem drei Dinge: **messen**, **vereinheitlichen**, **trennen**.
3. **Messen:** Heute weiß niemand genau, wie gut ZOE und die neuen Heads antworten und was eine ganze Auftragskette kostet. Feste Prüffälle haben nur die drei alten Vertriebs-Heads.
4. **Vereinheitlichen:** Es laufen drei Agenten-Welten nebeneinander (alte Heads, Finanzchef, neuer Agenten-Bereich) — mit je eigenem Gedächtnis, eigenen Freigaben und eigener Kostenrechnung.
5. **Trennen:** Gespräche, Merksätze, Freigaben und Ereignisse liegen für Privat und Firma noch in gemeinsamen Dateien. Eure neue Regel verlangt getrennte Ablage.
6. Werkzeuge erkennen Fehler heute an Wörtern im Antworttext. Künftig hat jedes Werkzeug einen festen Vertrag (was hinein darf, was herauskommt, wer es darf) und eigene Tests.
7. ZOE plant künftig sichtbar („erst A, dann B“), prüft sich selbst („habe ich wirklich angelegt, was ich sage?“) und lädt fehlende Werkzeuge nach, statt nur nach Stichworten zu raten.
8. Jeder Head bekommt Ziele mit Schwellen (z. B. „mehr als 5 überfällige Nachfass-Termine“) und meldet sich selbst, wenn eine Ampel kippt — nicht erst zur nächsten Uhrzeit.
9. Mehr Selbständigkeit gibt es nur stufenweise, nur für Internes, das sich zurücknehmen lässt, und nur, wenn eure Annahmequote UND die Prüffälle stimmen. Außenwirkung und Geld bleiben immer Klick.
10. Aus euren Entscheidungen werden automatisch Prüffälle: Was ihr ablehnt, darf so nicht wiederkommen.
11. ZOE wird günstiger und schneller: Heute zahlt jede Antwort ihre ganzen Grundanweisungen neu, künftig wird der feste Teil zwischengespeichert.
12. Für Kunden werden Heads, Mitarbeiter und Skills zu Daten der Instanz (umbenennen, abschalten, aus dem Brain übernehmen) — mit Beispieldaten vorführbar.
13. Plan: 10 Pakete, etwa 35 Bau-Tage. Zuerst vier Fundament-Pakete (etwa 12 Tage), danach die sichtbaren Verbesserungen.
14. Woran wir „läuft perfekt“ messen: Annahmequote ≥ 70 %, Prüffälle ≥ 85 % bestanden, Fehlerquote ≤ 3 %, erstes Wort von ZOE in ≤ 2 Sekunden, Kosten je angenommenem Vorschlag sichtbar und fallend.
15. Acht Entscheidungen brauchen dein Wort — sie stehen unten in Teil E als Klickrunde bereit.

---

# Teil A — Ist-Stand (im Code gelesen)

## A1 · Das Bild auf einer Seite

```
EINGÄNGE                       STEUERUNG                                   WIRKUNG                                  MODELL
ZoePanel · Empfang · Seite ─┐
Telegram · WhatsApp ────────┼─► /api/kimmi = ZOE ─► schleife (3 Runden,    ─► fuehreAus (lib/zoe/ausfuehren.ts)     askText / askStream
Agenten-Seite (Head, MA) ───┤    parallel, ≤ 20 Werkzeuge per Stichwort)        Register-Stufe frei|freigabe|nie       (lib/anthropic.ts)
Takt: worker.mjs ───────────┤      ├─ an_head ─► Warteschlange ─► Head-Lauf     KI-Sperre · Business-frei               │
  (1,2–30 s Pause)          │      └─ head_fragen (sync, nur lesend)            Trockenlauf → Vorher/Nachher            ▼
Ereignisse (Cursor) ────────┘    agentLauf (lib/agenten/gespraech.ts)          ─► Stapel `zoe-stapel` ─Klick─► Route    KI-Tor (Art. 9, Bereiche,
                                   ─► schleife (Chat 3 / Lauf 6 Runden,            (beanspruchen → entscheiden,           Hintergrund, Pseudonym)
                                      14 Aufrufe, 5 Min, Stillstand)               Entscheidung dauerhaft)               Anbieter-Tor (Stufe, Region,
                                   ─► an_mitarbeiter (Tiefe 2), Brett, Rat,                                              AVV, Budget)
                                      Prüfer bei Außenwirkung, Plan-Freigabe                                             Verbrauch + KI-Protokoll
                                 ALTE WELT daneben:                                                                      (nur Metadaten)
                                   lib/heads/lauf.ts (Sales/Marketing/Event: JSON, Grundlauf, Prüfer, Evals, Lernen)
                                   lib/finanzen/chef/lauf.ts (eigene Werkzeug-Runden)
                                   ~25 Fach-Agenten-Routen (runAgent: board, okr, controlling, research …)

GEDÄCHTNIS: zoe-gedaechtnis · head-<id>.gedaechtnis · Werkstatt agenten-skills* · Thread-Index „Persönlich“ · Brain/Vault + app_chunks · Entscheidungen
SICHT:      kontoSicht · lib/agenten/sicht.ts · Routen nur `eigenePerson` · Messlatte-Test (alle GET mit fremder Person)
```

## A2 · Wer entscheidet was (heute)

| Frage | Entscheidet | Stelle |
|---|---|---|
| Darf diese Person diesen Head/Thread sehen? | Code, rein | `lib/agenten/sicht.ts`, `kontoSicht` |
| Welche Werkzeuge bekommt ZOE in diesem Zug? | Code (Stichwort-Regeln) | `lib/zoe/werkzeug-wahl.ts` (`ZOE_BEREICHE`, Z. 31) |
| Welche Werkzeuge ein Head/Mitarbeiter? | Code (Katalog ∩ Schalter ∩ Einwilligung) | `lib/agenten/werkzeuge.ts` `werkzeugAngebot` |
| Wirkt ein Aufruf sofort oder wird er Vorschlag? | Code (Register-Stufe, nur verschärfbar) | `lib/zoe/register.ts`, `lib/zoe/ausfuehren.ts` |
| Wird ein Vorschlag ausgeführt? | **Mensch, per Klick** | `lib/zoe/stapel.ts` (`beanspruche` → `entscheide`) |
| Darf ein Text an ein Modell, an welches? | Code (KI-Tor, Anbieter-Tor) | `lib/datenschutz/ki-tor.ts`, `lib/ki/tor.ts` |
| Läuft ein Head gerade? (Not-Aus, Budget, aus) | Code, fail-closed | `lib/agenten/einstellung.ts` (`headSperre`, `UNLESBAR_TEXT`) |
| Was ein Agent schreibt, welche Werkzeuge er ruft | Modell | `lib/agenten/schleife.ts` |
| Was gemerkt wird, welcher Skill aktiv ist | **Mensch, per Klick** | Stapel-Arten `merksatz`, `skill`; `skills-server.ts` |

## A3 · Stärken (bleiben so)

1. **EINE Wirkungsstelle** `fuehreAus` mit Risiko je Werkzeug, das nur verschärft werden kann; Agenten-Nachrichten sind nie Zustimmung.
2. **Schutz vor fremdem Text als Architektur, nicht als Filter:** `fremd()`, „fremd gelesen“ und „vertraulich“ am Thread auf dem Server,
   danach nur Vorschläge bzw. kein Web (`lib/zoe/gespraech-schutz.ts`, `schleife.ts` `zustandNach`). Das entspricht der „Rule of Two“.
3. **Zwei Tore vor jedem Modell:** KI-Tor (Art. 9, Bereiche, Pseudonym) und Anbieter-Tor (Mindeststufe je Kategorie, Gesundheit nur EU-ZDR).
4. **EINE Schleife** für ZOE, Heads und Mitarbeiter mit festen Invarianten aus dem Härtetest (`tests/agenten-haertetest.test.ts`, rund 40 Fehlerbilder:
   Überlast, abgeschnittenes JSON, Doppelklick, Stillstand, Budget, Not-Aus, Thread voll …).
5. **Budgets auf vier Ebenen** (Lauf, Head/Monat, Instanz, Tageshöchstzahl) und **Not-Aus fail-closed**.
6. **Warteschlange** mit Pacht, Herzschlag, Idempotenz-Schlüssel, 3 Versuchen; **Ereignisstelle** mit Cursor und Entprellen.
7. **Die alten Heads sind methodisch vorbildlich:** Grundlauf (Regeln ohne Modell) → Modell → Prüfer → eine Korrekturrunde → Pflicht-Vorschläge
   zurück → Belege → Autonomie → Lernen (Wirkungsleiter) → Evals mit pass^k (`lib/heads/*`). Das ist Evaluator-Optimizer mit Regelwerk-Rückfall.
8. **Skills nach Standard:** ≥ 3 Testfälle, Testlauf im Trockenlauf vor dem Einschalten (`lib/agenten/probelauf.ts`), Versionen, SKILL.md-Import.
9. **Verlauf nur auf dem Server**, Streaming, Threads je Thread-Datei (E3), Prüfendpunkt für Ende-zu-Ende-Läufe ohne echtes Modell (`lib/ki/pruefendpunkt.ts`).
10. **Plattform-neutral** mit Wächtern; Demo-Saat.

## A4 · Schwächen (konkret, mit Beleg)

| # | Befund | Beleg | Folge |
|---|---|---|---|
| S1 | **Drei Agenten-Welten** (plus ~25 Fach-Agenten-Routen mit eigenem Prompt): Grundlauf, Prüfer, Evals und Lernen gibt es nur in der alten Welt, der neue generische Head-Chat hat sie nicht | `lib/heads/lauf.ts` (JSON-Pipeline), `lib/finanzen/chef/lauf.ts:133` (eigene Runden), `lib/agenten/gespraech.ts` `agentLauf`; 56 Dateien rufen das Modell | Qualität hängt davon ab, welcher Weg gerade läuft; doppelte Schalter, Freigaben, Kosten (Analyse 5 B) |
| S2 | **Werkzeug-Verträge nur fürs Modell:** Das JSON-Schema geht an das Modell, zur Laufzeit prüft niemand die Eingabe. Werkzeuge klemmen still | `lib/zoe/werkzeug-defs.ts` (`input_schema`), `lib/zoe/werkzeuge.ts:53–55` (`planBlock`: Uhrzeit geklemmt, Titel `slice(0, 120)`) | Falsche Eingaben werden still „repariert“ statt zurückgemeldet |
| S3 | **Erfolg wird am Antworttext erkannt** (Regex), Ergebnis ist ein String ohne Fehlerklasse | `lib/zoe/ausfuehren.ts:140`, `lib/agenten/gespraech.ts:143` `OK_TEXT` | Ein neues Werkzeug mit anderem Fehlersatz gilt als Erfolg; keine gezielte Wiederholung |
| S4 | **Qualität nicht messbar** für ZOE, neue Heads, Mitarbeiter und die Werkzeug-Wahl; **Prompts ohne Fassung** (Code-Strings) | Evals nur `lib/heads/eval.ts` (3 Heads, 9 Prüfungen); `app/api/kimmi/route.ts:84` `systemPrompt`, `gespraech.ts` `systemText`; kein `promptVersion` im Code | Jede Prompt-, Modell- oder Stufen-Änderung ist ein Blindflug (auch der geplante Wechsel auf Haiku/Sonnet 5.5) |
| S5 | **Keine durchgehende Spur:** `LaufSpan` steht nur an Thread-Nachrichten; KI-Protokoll und Verbrauch kennen keine Lauf-Kennung | `lib/agenten/faeden.ts:27`, `lib/datenschutz/ki-protokoll.ts:46`, `lib/zoe/verbrauch.ts`; Zuordnung über `zweck`-Text (`einstellung.ts` `headVonZweck`) | Kosten einer Kette ZOE → Head → Mitarbeiter nicht sichtbar; ZOE-Gespräche keinem Ergebnis zugeordnet |
| S6 | **ZOE nutzt keinen Prompt-Cache**, und ihr System-Text trägt Uhrzeit und Live-Daten | `app/api/kimmi/route.ts:330` (`ask` ohne `cacheSystem`), `:100` (`ZEIT: ${jetztSatz()}`) | Jede Runde jedes Zugs bezahlt den ganzen System-Text neu; langsamer erster Token |
| S7 | **Werkzeug-Wahl per Stichwort-Regex**, kein Nachladen | `lib/zoe/werkzeug-wahl.ts:31` `ZOE_BEREICHE` | Synonyme, Diktat („Berlin“ = Malin), Tippfehler fallen durch → „frag den Head“ statt Antwort |
| S8 | **Delegationsvertrag unvollständig:** Auftrag ohne Erledigt-Kriterium, Budget, Frist (R10); Bericht ist freier Text; Agenten-Nachricht wird **still** auf 8.000 Zeichen gekürzt | `lib/agenten/typen.ts:234` `AuftragKarte`; `lib/agenten/delegation.ts:631` `e.text.slice(0, GRENZEN.nachrichtZeichen)` | „Ende nicht erkannt“ und „zu früh fertig“ (MAST FM-1.5/3.1, zusammen ~19 %) bleiben offen; Verstoß gegen „nie still kürzen“ |
| S9 | **Gedächtnis an vier Orten** (+ „Wissen je Head“ im Bau), Kurzfassung rein mechanisch | `lib/zoe/gedaechtnis.ts`, `lib/heads/lernen.ts` (`Merksatz`), `typen.ts:417/447/468`, `faeden.ts:326` `kurzfassung` (je Nachricht 160/220 Zeichen) | Was ein Head lernt, weiß ZOE nicht; frühe Entscheidungen in langen Threads gehen verloren |
| S10 | **Ablage mischt Privat und Business** | `zoe-stapel`, `zoe-gedaechtnis`, `zoe-auftraege`, `zoe-entscheidungen--<h>--*`, `ereignisse--<h>` (je Feld `bereich`); `agenten-faeden--<person>` (beide Bereiche einer Person); `agenten-skills--<haushalt>` und `agenten-einstellung--<haushalt>` tragen Business-Heads **und** Familie (bzw. `personen[…]`) | Widerspricht CLAUDE.md (09.10. spät); eine Firmen-Instanz ließe sich nicht sauber herauslösen |
| S11 | **Autonomie grob:** zwei Stufen je Head, Aufstieg nur nach Annahmequote, nicht nach Prüffällen, nicht je Werkzeug-Art | `lib/agenten/leistung.ts:197` `AUTONOMIE_REIHE`, `autonomieLage` | Entweder alles Vorschlag oder pauschal mehr — keine feine, belegte Freigabe |
| S12 | **Heads ohne Ziele:** Kennzahlen stehen im Katalog, aber ohne Zielwert/Schwelle; vier Ereignis-Arten noch nicht angebunden | `lib/agenten/katalog.ts` (`kennzahlen`), `lib/ereignisse/arten.ts` (`frist-naht`, `termin-vorbei`, `neue-aufgabe`, `neues-medium`) | „Ampel rot“ löst nichts aus; Heads reagieren auf Uhr und wenige Ereignisse |
| S13 | **Läufe nicht fortsetzbar:** Wiederholung = Neustart von vorn | `lib/zoe/auftraege.ts:85/170` (3 Versuche, Pacht) | Doppelte Kosten; beim zweiten Mal andere Vorschläge |
| S14 | **ZOE prüft sich nicht selbst:** Vollzugs- und Zahlen-Prüfer gibt es für alte Heads und Außenwirkung, nicht für ZOE-Antworten | `lib/heads/pruefer.ts`, `delegation.ts:179` `regelPruefung`; nichts in `kimmi` | „Erledigt“ ohne Werkzeug oder eine Zahl ohne Beleg bleibt stehen (MAST FM-2.6 „Denken ≠ Handeln“, 13,2 %) |
| S15 | **Katalog im Code** (16 Heads), Kunden können ihn nur ergänzen | `lib/agenten/katalog.ts:27` | Für AI-CEO-Kunden ist der Kern ihres Teams nicht ihre Konfiguration |
| S16 | **Lange Wege im Hintergrund:** Jeder Sprung über die Warteschlange wartet auf die nächste Runde des Arbeiters (bis 30 s auf kleinen Maschinen) | `worker.mjs:157` (Pause) | ZOE → Head → Mitarbeiter = zwei Sprünge, spürbare Wartezeit ohne Not |

**Einordnung:** S1–S16 sind keine Sicherheitslücken — die sind mit der Analyse vom 09.10. geschlossen. Es sind die Abstände zwischen „sehr gut
gebaut“ und „messbar das Beste“.

---

# Teil B — Benchmark: Was die besten 1 % auszeichnet

**Kennzeichnung:** **[Q]** = öffentliche Quelle, die ich kenne (aus dem Gedächtnis, am 10.10. nicht neu geprüft; Teile stehen mit Abrufdatum in
`research/agenten/*.md`) · **[E]** = Erfahrungswissen, nicht belegt. Vor dem Bau einzelne Punkte nachsehen.

| # | Dimension | Was die Besten tun | Quelle | MAKE OS heute |
|---|---|---|---|---|
| B1 | **Orchestrierung** | Ein Koordinator, spezialisierte Worker mit eigenem, kleinem Kontext. Jede Delegation hat Ziel, Ausgabeformat, Werkzeuge, Grenzen und ein **Erledigt-Kriterium**. Der Aufwand richtet sich nach der Frage. Zurück kommt eine Verdichtung (1.000–2.000 Token), kein Verlauf | [Q] Anthropic „Building effective agents“ (12/2024), „Multi-agent research system“ (06/2025); Cognition „Don't build multi-agents“ (06/2025) | ✓ Struktur und Tiefe 2 · **teils** Vertrag (S8) · fehlt: Aufwand nach Frage |
| B2 | **Planung & Reflexion** | Plan als sichtbares Artefakt („Arbeitszettel“), erst planen, dann ausführen. Ein Prüfer vergleicht Behauptung und Werkzeug-Ergebnis. „Fertig“ erst nach Prüfung | [Q] Anthropic „Effective harnesses for long-running agents“ (11/2025); Beurer-Kellner et al. „Plan-Then-Execute“ (2025); Shinn et al. „Reflexion“ (2023) | alte Heads ✓ · Agenten-Bereich **teils** · ZOE fehlt (S14) |
| B3 | **Werkzeug-Verträge** | Wenige, klar abgegrenzte Werkzeuge. Eingaben streng geprüft, Fehler mit Handlungsanweisung, Antworten sparsam und mit wählbarem Detail. Annotationen *nur lesen · zerstörend · idempotent*. Werkzeuge werden mit Prüffällen entwickelt | [Q] Anthropic „Writing effective tools for agents — with agents“ (09/2025); MCP-Spezifikation (Tool-Annotationen, 2025) | **teils:** Beschreibungen und Risiko gut; Laufzeitprüfung, Fehlerklassen, typisierte Ergebnisse fehlen (S2, S3) |
| B4 | **Werkzeug-Wahl bei vielen Werkzeugen** | Höchstens 30–40 Wahlmöglichkeiten je Zug. Werkzeuge werden gesucht bzw. nachgeladen statt alle angeboten (schrittweise Offenlegung wie bei Skills) | [Q] Anthropic „advanced tool use“ (Tool Search, 11/2025 — vor Nutzung prüfen); Copilot-Studio-Doku (research, B3) | ✓ ≤ 20 · **teils:** Wahl nur per Stichwort, kein Nachladen (S7) |
| B5 | **Gedächtnis** | Getrennte Ebenen: Arbeit, episodisch, semantisch, prozedural. Jede mit Herkunft, Gültigkeit und Abruf nach Relevanz und Aktualität. Langzeit nur über Menschen; Schutz gegen Vergiftung | [Q] Sumers et al. „CoALA“ (2023); Park et al. „Generative Agents“ (2023); Packer et al. „MemGPT“ (2023); OWASP Agentic ASI06 (12/2025) | **teils:** alle Ebenen da, aber an 4+ Orten, mechanische Kurzfassung, Ablage gemischt (S9, S10) |
| B6 | **Evals** | Prüffälle aus echten Fällen. Zuerst deterministische Prüfer, dann ein Modell-Richter mit Rubrik, abgeglichen mit Menschen. pass^k statt pass@1. Prüfung von Weg **und** Endzustand. Gate vor jeder Änderung, dazu Online-Signale | [Q] Yao et al. „τ-bench“ (pass^k, 2024); Anthropic Eval-Leitfaden (zitiert in `lib/heads/eval.ts`); [E] | **vorbildlich** für 3 Heads, Skills mit Testlauf · fehlt für ZOE, neue Heads, Werkzeug-Wahl; kein Gate (S4) |
| B7 | **Beobachtbarkeit** | Eine Spur über alle Sprünge (auch asynchron), Spans je Agent, Werkzeug und Modell, Kosten, Token und Dauer je Lauf, Replay | [Q] OpenTelemetry GenAI-Konventionen (in Entwicklung); OpenAI Agents SDK (Tracing eingebaut, 2025) | **teils:** Spans je Thread-Nachricht, Protokoll je Aufruf — ohne gemeinsame Kennung (S5) |
| B8 | **Determinismus & Idempotenz** | Steuerfluss im Code, das Modell entscheidet nur Inhalt. Idempotenz-Schlüssel für jede Wirkung. Läufe setzen nach Abbruch am letzten Schritt fort | [Q] „12-Factor Agents“ (HumanLayer, 2025); [E] Temporal/LangGraph-Checkpoints, Idempotenz-Schlüssel wie bei Zahlungs-APIs | ✓ Stapel-Dedup, `anfrageId`, Pacht · fehlt: Fortsetzen (S13) |
| B9 | **Sicherheit** | Lethal Trifecta / Rule of Two als Architektur. Fähigkeiten statt Vertrauen (Datenfluss-Marken). Least Privilege je Werkzeug, Freigabe-Stufen. Ein rotes Team als feste Testsuite, ausgehend von einem „gehorsamen“ Modell | [Q] Willison (06/2025); Meta „Agents Rule of Two“ (10/2025); Debenedetti et al. „CaMeL“ (2025); OWASP Agentic Top 10 (12/2025) | **stark** · teils: Regel steht an mehreren Stellen, Angriffsfälle verstreut |
| B10 | **Budget & Tempo** | Stabiler Prompt-Anfang gecacht (Reihenfolge Werkzeuge → System → Nachrichten). Kleine Modelle für Weiche und Zusammenfassung, Stapelverarbeitung für Nicht-Eiliges (günstiger), Streaming, parallele Aufrufe | [Q] Anthropic-Doku Prompt-Caching und Message Batches | Streaming und Budgets ✓, Heads cachen · **ZOE nicht** (S6), kein Batch |
| B11 | **Modell-Routing** | Modell je Aufgabe, belegt durch Prüffälle; Kaskade „klein zuerst, groß bei Unsicherheit“; Datenschutz-Stufen je Anbieter | [E] | ✓ Anbieter-Tor überdurchschnittlich · fehlt: Belegung per Eval (Vergleichsskript vorhanden) |
| B12 | **Skills / Marktplatz** | SKILL.md-Standard, schrittweise Offenlegung, Tests, Versionen, nur vertrauenswürdige Quellen | [Q] Anthropic „Agent Skills“ (10/2025) | ✓ gebaut · fehlt: Vorlagen-Bibliothek je Instanz |
| B13 | **Lernen aus Entscheidungen** | Annehmen, Ablehnen und Änderungsgrad sind Signale. Einsichten werden Regeln, aber jede Änderung läuft durch ein Eval-Gate. Nie stille Selbständerung | [Q] Zhao et al. „ExpeL“ (2023), „Reflexion“; [E] | alte Heads ✓ (`lernen.ts`) · neu teils · Entscheidungen werden **keine Prüffälle** |
| B14 | **Mandantenfähigkeit** | Konfiguration als Daten je Mandant, Vorlagen, Demo-Modus, Admin-Sicht mit Kennzahlen, Not-Aus | [E] | Not-Aus und Demo ✓ · Katalog im Code (S15) |

**Wo MAKE OS schon Spitze ist:** B9 (Sicherheit), B11 (Datenschutz-Routing), Robustheit der Schleife, Freigabe-Disziplin. **Die größten Abstände:** B6
(Messen), B7 (Spur), B3 (Verträge), B5 (Gedächtnis/Trennung), B1/B2 (Vertrag und Selbstprüfung). Genau dort setzt v2 an.

---

# Teil C — Zielbild „Agenten v2“

## C1 · Architektur

```
EINGÄNGE  Chat · Kanäle · Zeitpläne · Ereignisse · ZIELE/SCHWELLEN (neu) · Klick im Stapel
   │
   ▼
EINGANGSTOR  Person (Sitzung) · Konto-Sicht · BEREICH (privat | business, genau einer je Zug/Lauf) · Spur (trace_id) · fail-closed
   │
   ▼
ZOE (je Person)  Absicht → [Plan] → selbst lesen / head_fragen / an_head → Selbstprüfung → Antwort
   │                                     │
   ▼                                     ▼
HEAD-LAUFZEIT (EINE Fabrik für alle Heads)        WERKZEUG-SCHICHT (Verträge)
  Kontextbauer (nur sein Bereich)                    Eingabe geprüft (Schema, Laufzeit) · Rechteklasse · Idempotenz-Schlüssel
  Grundlauf (Regeln, optional) → Modell (schleife)   Ergebnis typisiert (ok | Fehlerklasse) · Zeitgrenze
  → Prüfer (Code, dann KI) → Bericht (Schema)        Wirkung NUR über fuehreAus → Stapel → Klick → Route
  → Mitarbeiter (Tiefe 2, Auftrag mit Erledigt-Kriterium)
  Checkpoint je Runde (fortsetzbar)
   │
   ▼
GEDÄCHTNIS-DIENST (EINE Schnittstelle, Ablage je Bereich)
  Arbeit (Thread + Arbeitszettel) · episodisch (Läufe, Entscheidungen, Wirkung) · semantisch (Merksätze) · prozedural (Skills, Aufträge) · Wissen (Brain)
   │
   ▼
MODELL-TOR  KI-Tor → Anbieter-Tor → Stufe je Aufgabe (eval-belegt) → Cache-Plan (stabil | flüchtig) → askText / askStream / Batch
   │
   ▼
BEOBACHTUNG  Lauf-Spur (trace/span über die Warteschlange) · Kosten je Kette und je Ergebnis · Prüffälle offline/online · Head-of-IT-Kennzahlen
LERNSCHLEIFE  Entscheidung → Episode → Wochen-Review → Vorschlag (Merksatz/Skill-Fassung) → Klick → neuer Prüffall → Gate
```

## C2 · Die Top-1-%-Standards (verbindlich, jeweils mit Wächter)

| # | Standard | Wächter (neu, Name als Vorschlag) |
|---|---|---|
| T1 | **Kein Werkzeug ohne Vertrag:** Schema, Rechteklasse, Bereich, KI-Kategorien, Fremdquelle, Idempotenz, Zeitgrenze, ≥ 3 Testfälle (gültig, ungültig, fehlendes Recht) | `tests/werkzeug-vertraege.test.ts` — jedes Register- und Agenten-Werkzeug hat einen Vertrag, seine Fälle laufen |
| T2 | **Ergebnisse typisiert:** `ok` oder Fehlerklasse (`eingabe · rechte · sperre · nicht_gefunden · konflikt · grenze · voruebergehend · intern`) — nie mehr Regex über Text | Wächter scannt `ausfuehren.ts`/`gespraech.ts`/`kimmi` auf Erfolgserkennung per Textmuster |
| T3 | **Eingaben geprüft, nie still geklemmt oder gekürzt** — ungültig → Klasse `eingabe` mit Satz ans Modell, nichts gewirkt | Wächter: keine `slice(`/`Math.min(` auf Werkzeug-Eingaben ohne Fehlerpfad (Liste mit Begründung wie `KONTAKTE_LESER_ERLAUBT`) |
| T4 | **Prüffälle vor jeder Prompt-, Modell-, Stufen- oder Werkzeug-Änderung:** jedes Prompt-Stück hat Kennung + Fassung (Hash), das KI-Protokoll schreibt die Fassung mit | `tests/prompt-register.test.ts` + Gate `scripts/evals.mjs --offline` in der GitHub Action |
| T5 | **Jeder Lauf hat eine Spur:** `trace_id`, `span_id`, `parent_span_id` über Warteschlange, Thread, Werkzeug, Modell, Protokoll und Verbrauch | `tests/agenten-spur.test.ts` — Kette ZOE → Head → Mitarbeiter ergibt EINE trace_id |
| T6 | **Kosten sichtbar je Lauf, je Kette, je Ergebnis** (Euro, wie heute über den Kurs der Instanz) | HOI-Befund + Test der Summen |
| T7 | **Zeitgrenzen je Ebene** (Werkzeug Vorgabe 20 s, Modell je Stufe, Zug, Lauf) und Wiederholung nur bei `voruebergehend` | Härtetest-Erweiterung |
| T8 | **Code entscheidet Steuerfluss, Rechte, Wirkung; das Modell entscheidet Inhalt** — jeder Head hat einen (auch leeren) Grundlauf und einen Code-Prüfer | `tests/head-fabrik.test.ts` |
| T9 | **Rule of Two als EINE Funktion:** `zweiVonDrei(zustand, rechteklasse)` (fremd gelesen · Sensibles gelesen · Wirkung) entscheidet Vorschlag/Ausführen/Sperre an einer Stelle | `tests/rule-of-two.test.ts` + Angriffs-Suite mit „gehorsamem Prüfmodell“ |
| T10 | **Privat und Business getrennt in der Ablage** — Threads, Gedächtnis, Stapel, Ereignisse, Entscheidungen, Einstellungen, Pläne | Register-Feld `bereich` Pflicht für Agenten-Bestände; „Firmen-Export enthält keinen Privat-Eintrag“ |
| T11 | **Nie still kürzen, nie still selbst ändern** — Merksätze, Skills, Prompts, Autonomie nur per Klick bzw. mit Eval-Gate | bestehende Wächter + neuer Test für Agenten-Nachrichten (S8) |
| T12 | **Instanz-fähig:** Heads, Mitarbeiter, Ziele, Prompts der Kunden sind Daten; Standard = Vorlage im Code | Plattform-Wächter auf `lib/agenten/**` (besteht) + „leere Instanz startet“ |

## C3 · Werkzeug-Vertrag (Entwurf, `lib/werkzeuge/vertrag.ts`)

```ts
type Rechteklasse = 'lesen' | 'vorschlag' | 'intern' | 'aussen' | 'geld' | 'loeschen';
type Fehlerklasse = 'eingabe' | 'rechte' | 'sperre' | 'nicht_gefunden' | 'konflikt' | 'grenze' | 'voruebergehend' | 'intern';

interface WerkzeugVertrag<E = Record<string, unknown>, A = unknown> {
  name: string;                       // bleibt wie heute (Register-Name)
  beschreibung: string;               // was + wann + was NICHT (fürs Modell), heute werkzeug-defs.ts
  eingabe: JsonSchema;                // streng: required, enum, Grenzen, additionalProperties:false — zur LAUFZEIT geprüft
  ausgabe?: JsonSchema;               // für Werkzeuge mit Daten (Agenten-Berichte, Lagen)
  rechteklasse: Rechteklasse;         // neu; leitet MCP-Hinweise ab (readOnly, destructive, idempotent)
  risiko: Risiko;                     // weiter aus register.ts, nur verschärfbar
  kategorien: KiKategorie[];          // KI-Tor (heute ki-werkzeuge.ts)
  fremdQuelle?: string;               // trägt Text Dritter → fremd() (heute FREMD_WERKZEUGE)
  bereich: 'privat' | 'business' | 'beide';
  idempotenz?: (e: E, k: Kontext) => string;  // Schlüssel der Wirkung, z. B. `lauf:<trace>:<span>`
  zeitgrenzeMs?: number;              // Vorgabe 20_000
  lauf(e: E, k: Kontext): Promise<WerkzeugErgebnis<A>>;
  vorschau?(e: E, k: Kontext): Promise<Vorschau>;   // heute im Register
  faelle: { name: string; eingabe: unknown; konto?: 'voll' | 'nur-business' | 'fremd'; erwartet: 'ok' | Fehlerklasse }[]; // ≥ 3
}
type WerkzeugErgebnis<A> =
  | { ok: true; text: string; daten?: A; quelle?: string; kategorien?: KiKategorie[]; vorschlagId?: string }
  | { ok: false; klasse: Fehlerklasse; text: string };
```

**Übergang ohne Bruch:** Ein Adapter `ausAltText(text)` übersetzt bestehende String-Werkzeuge (heutige Regex an EINER Stelle) — Werkzeug für Werkzeug wird
umgestellt; der Wächter T2 zählt die Restliste herunter (nur sinken, wie `ALTBESTAND_OHNE_ANGABEN`). Der Schema-Prüfer ist ein eigener, kleiner
Prüfer für das benutzte Schema-Teilset (type, enum, required, min/max, Länge) — keine neue Abhängigkeit nötig (Entscheidung offen, siehe V3).

## C4 · ZOE v2 — die Orchestratorin

- **Bereichs-bewusst:** Jeder Zug läuft in genau EINEM Bereich (Kopf-Schalter, Bezug, `bereichErmitteln` aus `lib/zoe/bereich.ts`). Gedächtnis, Threads,
  Stapel und Ereignisse kommen nur aus diesem Bereich. Ein Blick in den anderen Bereich nur ausdrücklich („auch in Business nachsehen“ wie die Suche).
- **Person-bewusst:** wie heute über `kontoSicht`; ZOE der Person X erreicht nur Heads, die X sieht; Systemläufe rechnen mit der auslösenden Person (E8).
- **Werkzeuge:** Kern (≤ 10) + Bereich nach Regeln (heute) + **Nachladen** über ein Meta-Werkzeug `werkzeuge_laden { bereich }` (nur Bereiche, die
  die Person haben darf; je Runde weiter ≤ 20). Die Stichwort-Regeln bleiben als erste Stufe — deterministisch und gut prüfbar.
- **Plan sichtbar:** Bei mehrstufigen Anliegen schreibt ZOE zuerst einen Arbeitszettel (`plan_schreiben`, ≤ 5 Schritte, im Thread als Karte); mit
  Plan bis zu 5 Runden statt 3. Plan-Freigabe vor Kosten über der Schwelle bzw. mehreren Heads (Regel R14, wie bei den Heads).
- **Selbstprüfung nach dem Zug (Code zuerst):** (1) Vollzug behauptet ohne erfolgreichen Werkzeug-Aufruf, (2) Zahl ohne Beleg im Live-Kontext oder
  in einem Werkzeug-Ergebnis (Belege-Mechanik aus `lib/heads/belege.ts`), (3) Inhalte aus dem anderen Bereich → eine Korrekturrunde, sonst ein
  sichtbarer Hinweis. Nie still umgeschrieben.
- **Cache-Plan:** System in zwei Blöcke: **stabil** (Identität, Regeln, Heads, Werkzeug-Hinweise — gecacht) und **flüchtig** (Zeit, Live-Zustand,
  Gedächtnis — danach). Werkzeuge in fester Reihenfolge (Kern zuerst, alphabetisch), damit der Präfix trägt.
- **Kompaktierung statt Abschneiden:** Ältere Züge eines Threads verdichtet ein kleines Modell im Hintergrund zu „Entscheidungen · Fakten · Offenes“
  (als `fremd('agent')` gekapselt, nie gelöschte Nachrichten); die heutige mechanische `kurzfassung` bleibt der Rückfall ohne KI.
- **Aufwand nach Frage:** einfache Frage → nur Kern, kleines Budget; Recherche/Planung → Plan + Delegation (B1).

## C5 · Heads v2 — EINE Head-Laufzeit

**Head-Fabrik** (`lib/agenten/head-laufzeit.ts`): Jeder Head ist Daten (Katalog bzw. Instanz-Katalog) plus optionale Bausteine:

| Baustein | Heute | v2 |
|---|---|---|
| Auftrag, Ton, Kategorien, Werkzeuge | Katalog | Katalog-Vorlage + Instanz-Kopie (V10) |
| Kontext | `kontext.ts` (heads · finanzchef · hoi · brain) | unverändert, je Bereich |
| **Grundlauf** (Regeln ohne Modell) | nur Sales/Marketing/Event, Finanzchef | jeder Head (auch leer); bei leerem Guthaben/Ausfall IST er das Ergebnis |
| **Prüfer** | alt: `lib/heads/pruefer.ts`; neu: nur Außenwirkung | Code-Prüfer je Head (IDs, Zahlen, Vollzug, Kanal, Bereich), dann KI-Prüfer nur bei Außenwirkung |
| **Bericht** | alt: JSON-Schema; neu: freier Text | Bericht-Schema für Läufe: `zusammenfassung`, `ergebnisse[]`, `belege[]`, `offen[]`, `vorschlaege[]` (Stapel-Kennungen), `erledigt { erfuellt, warum }`, `kosten` |
| **Ziele & Schwellen** | Kennzahlen ohne Ziel | je Kennzahl Zielwert, Richtung, Gelb/Rot — Instanz-Daten; Riss → Ereignis `kennzahl-schwelle` → Head-Lauf „Gegenmaßnahme vorschlagen“ |
| **Wissen** | Brain allgemein; „Wissen je Head“ im Bau | Ordner/Notizen je Head (Branch `agenten-grundausstattung`) als Gedächtnis-Ebene „Wissen“ |
| **Mitarbeiter** | Vorlagen + eigene | unverändert, mit Auftrag+ (C6) |
| **Autonomie** | 2 Stufen je Head | Stufen L0–L2 je Head × Rechteklasse (unten) |
| **Lernen** | alt: `lernen.ts`; neu: `leistung.ts` | EIN Lernmodell für alle (Quote, Gründe, Änderungsgrad, Wirkungsleiter) |
| **Evals** | alt: `eval.ts` | Gold-Set je Head (≥ 15 Fälle aus der Demo-Saat) |
| **Freigaben** | `head-<id>`, `finanzchef`, `haushalt-chef--<h>`, `zoe-stapel` | EIN Stapel (je Bereich), Stapel-Art `head` |

**Umzug der alten Heads (= E2):** Die Modi (power_hour, deal_review, Tagescheck …) werden eingebaute Skills der Laufzeit; Grundlauf, Prüfer, Belege
und Lernen ziehen als Bausteine um, **ohne Verhalten zu ändern** — Regressionsprüfung gegen die Replay-Fälle (`heads-replay-*`, nur `.data`) und
erfundene Gold-Fälle (Repo). Die ~25 Fach-Agenten-Routen werden schrittweise Mitarbeiter-Skills; die Routen bleiben als Adapter, bis nichts mehr
auf sie zeigt.

**Autonomie-Stufen je Rechteklasse:**

| Stufe | Bedeutung | Für welche Rechteklassen | Aufstieg | Abstieg |
|---|---|---|---|---|
| L0 | nur lesen und antworten | alle | — | — |
| L1 | Vorschlag in den Stapel (Standard heute) | vorschlag, intern | — | automatisch bei Quote < 40 % (heute `QUOTE_RUNTER`) |
| L2 | selbst ausführen, **rücknehmbar** (24 h „Rückgängig“), Tageshöchstzahl | nur `intern` (eigene Aufgabe, nächster Schritt, Notiz am Eintrag) | per Klick, nur wenn Quote ≥ 70 % über ≥ 10 Entscheidungen **und** pass^3 ≥ 0,85 auf dem Gold-Set des Heads | automatisch bei Quote < 40 % oder Eval-Regression |
| — | nie selbst | `aussen`, `geld`, `loeschen` | **nie** (Eiserne Regel 3) | — |

## C6 · Mitarbeiter v2 — Auftrag, Bericht, Skill

- **Auftrag+ (R10 vollständig):** `{ ziel, format, grenzen, quellen, erledigt, budgetCent, frist? }` — `erledigt` ist Pflicht und wird vom
  Prüfer gegen den Bericht gehalten („Kriterium erfüllt? warum?“). Ohne Erfüllung: Status „wartet auf Klärung“ statt „fertig“.
- **Bericht-Schema** wie C5; der Text im Head-Thread zeigt die Verdichtung, der ganze Bericht bleibt im Mitarbeiter-Thread. **Nie still gekürzt:**
  zu lang → Teil-Nachrichten bzw. Anhang mit „Teil x von y“ (S8).
- **Skills:** unverändert (Tests ≥ 3, Testlauf, Versionen); neu: jede Skill-Fassung trägt eine Prompt-Fassung (T4); Erfolgsquote = angenommen ∧ Prüffall bestanden.
- **Kontext minimal:** Web-Mitarbeiter sehen nie Akten (heute schon so, Map-Reduce) — als Rule-of-Two-Fall in der Angriffs-Suite festgehalten.

## C7 · Gedächtnis-Architektur

| Ebene | Inhalt | Ablage v2 (getrennt) | Wer schreibt | Im Prompt |
|---|---|---|---|---|
| **Arbeit** | letzte 16 Nachrichten, Kompaktierung, Arbeitszettel, Brett | Thread-Datei je Bereich | Server | immer |
| **Episodisch** | Läufe (Spur), Entscheidungen mit Grund, Wirkung | `zoe-entscheidungen--<bereich>--…`, Lauf-Spur | Server | gezielt, als Beispiele (wie `lernen.ts`) |
| **Semantisch** | Merksätze/Fakten mit Herkunft, Gegenstand (Person, Firma, Head), Gültigkeit „bis“, Bereich | `gedaechtnis--business--<haushalt>`, `gedaechtnis--privat--<person>` (+ Familie: `--privat--<haushalt>`) | **nur Klick** (Stapel) | Top-k nach Gegenstand → Aktualität → Wichtigkeit, ≤ 1.800 Zeichen |
| **Prozedural** | Skills, Aufträge an Heads, Prompt-Fassungen | Werkstatt, Einstellung, Prompt-Register — je Bereich | Menschen / Klick | Name + Beschreibung immer, Inhalt bei Bedarf |
| **Wissen** | Vault/Brain, `app_chunks` | Brain (Menschen) | Menschen; ZOE nur Vorschläge | per Suche, Sicht VOR dem Ranking |

**EINE Schnittstelle** `lib/gedaechtnis/dienst.ts`: `lesen({ person, bereich, agent, gegenstand?, k })`, `vorschlagen({ … , herkunft })`. Die vier heutigen
Orte (`zoe-gedaechtnis`, `head-<id>.gedaechtnis`, Werkstatt-`gedaechtnis`, Thread-Index „Persönlich“) ziehen ohne Verlust in eine Merksatz-Form
um; die alten Bestände bleiben liegen (Rückweg). **Bewusst nicht:** Vektor-Datenbank als Pflicht — Abruf nach Feldern + Volltext reicht für Merksätze
(Begründung wie `gedaechtnis.ts`: „eine Frage nach einem Feld, keine nach Ähnlichkeit“); Embeddings bleiben an die CPU-Regel gebunden.

## C8 · Lernschleife

```
Klick (annehmen · ablehnen mit Grund · ändern & freigeben)          ─► Episode (Entscheidung, Änderungsgrad, Wirkung nach Frist)
        │                                                                   │
        │                                                                   ▼
        │                                                 Wochen-Review (ZOE, kleines Modell, pseudonym, nur Zahlen + Gründe)
        │                                                                   │  schlägt vor: Merksatz · Skill-Fassung · Schwelle
        ▼                                                                   ▼
AUTOMATISCH: neuer Prüffall                                        Stapel → Klick der berechtigten Person
  abgelehnt mit Grund  → Negativfall („darf so nicht wiederkommen“)         │
  unverändert angenommen → Positivfall                                      ▼
  stark umgeschrieben  → Fall „Ton/Entwurf“                         neue Fassung NUR, wenn das Gold-Set nicht schlechter wird (Gate)
```

Prüffälle aus echten Entscheidungen bleiben in `.data` (nie im Repo, wie `heads-replay-*`); das Repo trägt nur erfundene Gold-Fälle aus der Demo-Saat.

## C9 · Beobachtbarkeit und Kosten — die Lauf-Spur

Erweiterung des KI-Protokolls zur **Lauf-Spur** (Namen angelehnt an OpenTelemetry GenAI, nur Metadaten, Hash-Kette über `anhaengenVerkettet`):

| Feld | Inhalt |
|---|---|
| `trace_id`, `span_id`, `parent_span_id` | über Warteschlange (`Auftrag.eingabe.spur`), Thread (`LaufSpan`), `askText({ ki: { spur } })`, Verbrauch, Werkzeug-Protokoll |
| `operation` | `zug` · `invoke_agent` · `chat` · `execute_tool` · `modell` |
| `agent`, `bereich`, `person` | wie heute (Speichername, nie Name) |
| `prompt_fassung` | `<kennung>@<hash8>` (T4) |
| `modell`, `anbieter`, `stufe` | wie heute |
| `token` (ein, aus, Cache lesen/schreiben), `cent`, `dauer_ms`, `ttft_ms` | Zeit bis zum ersten Zeichen neu |
| `werkzeug`, `rechteklasse`, `ergebnis` | `ok` · `gestapelt` · `abgebrochen:<grund>` · `fehler:<klasse>` |

Daraus (rein gerechnet, nie gespeichert): Kosten je Kette, je Head, je angenommenem Vorschlag; p50/p95 je Ebene; Fehlerquote je Klasse; Cache-Quote.
Sichtbar unter Agenten › ⋯ › Leistung und im Head of IT (Ampeln). **Kein externer Tracing-Dienst** ohne Entscheidung (F6).

## C10 · Sicherheit — Rule of Two als Code und als Testsuite

- **EINE Funktion** `zweiVonDrei` (rein, `lib/agenten/regel-zwei.ts`): Eingang = Lauf-Zustand (A fremd gelesen, B Sensibles gelesen, C gewünschte
  Rechteklasse); Ausgang = `ausfuehren | vorschlag | sperre`. Heute verteilt auf `gespraech-schutz.ts`, `nurVorschlag`, `agentNurVorschlag`, Web-Sperre (#91).
- **Marken wandern** (heute schon): Kind ← Eltern, Bericht → Eltern, Ereignis → Lauf. Neu: Marke „aus fremdem Text“ auch an Merksatz-Vorschlägen
  (heute nur an Skills/Mitarbeitern) — der Stapel zeigt sie.
- **Angriffs-Suite** (`tests/angriffe/*.test.ts`, ≥ 30 Fälle): Mail, WhatsApp, Kontaktnotiz, Web-Recherche, Agenten-Bericht, Skill-Import, Brain-Notiz,
  Kalendertitel, Unterlage (Arztbrief), Dateiname. Gefahren mit einem **gehorsamen Prüfmodell** (`scripts/ki-pruefmodell.mjs`, Modus „tut, was im
  Text steht“): Das System muss halten, auch wenn das Modell jeder Einschleusung folgt — Erwartung: nur Stapel-Einträge, kein Web-Aufruf mit
  vertraulichen Daten, keine Wirkung im anderen Bereich.

## C11 · Trennung Privat/Business in den Agenten-Beständen (Anteil an der Datentrennung)

| Heute (gemischt) | v2 (getrennt) | Hinweis |
|---|---|---|
| `agenten-faeden--<person>` + `agenten-faden--<person>--<id>` (beide Bereiche) | Business: `agenten-faeden--business--<haushalt>` (Besitzer bleibt die Person, Sicht wie heute); Privat: `agenten-faeden--privat--<person>` | Firmen-Instanz bekommt nur `--business--`; Konto löschen: Business-Threads wie andere Business-Daten (getilgt, nicht entfernt) |
| `zoe-stapel` (Feld `bereich`, „unklar“) | `zoe-stapel--business--<haushalt>`, `zoe-stapel--privat--<haushalt>` | „unklar“ liegt im Privat-Bestand der Person, bis entschieden (im Zweifel privat) |
| `zoe-gedaechtnis` (Feld `bereich`, neutral) | `gedaechtnis--business--<haushalt>`, `gedaechtnis--privat--<person>` | neutrale Altfakten → privat der Person |
| `zoe-entscheidungen--<h>--<monat>` | `zoe-entscheidungen--business--<h>--<monat>` / `--privat--` | Hash-Kette je Familie (`MONATS_FAMILIEN`) |
| `ereignisse--<haushalt>` (Feld `bereich`) | `ereignisse--business--<h>`, `ereignisse--privat--<h>` | Cursor je Bestand |
| `agenten-skills--<haushalt>` (Business-Heads **und** Familie) | `agenten-skills--business--<h>`, `agenten-skills--privat--<h>` (Familie) | Privat je Person bleibt `agenten-skills-privat--<person>` (Name angleichen) |
| `agenten-einstellung--<haushalt>` (`personen[…]` für Privat-Heads) | `agenten-einstellung--business--<h>`, `agenten-einstellung--privat--<person>` | Not-Aus „für alle“ bleibt Instanz-Einstellung |
| `agenten-plan--<person>` | je Bereich | |
| `zoe-auftraege` (Warteschlange) | bleibt `instanz` (Technik), trägt nur Kennungen + `bereich`; Ergebnistexte nur im Thread | Ausnahme mit Begründung im Register |
| `ki-protokoll--*`, `ki-verbrauch` | bleibt `instanz` (nur Metadaten) mit Feld `bereich` | Ausnahme mit Begründung; endgültig entscheidet der Trennungs-Plan |

Umzug nach dem Muster von E3 (`lib/agenten/faeden-ablage.ts` `ablageUmziehen`): Kopie zuerst, idempotent, alte Bestände bleiben, Rückweg dokumentiert.

## C12 · Produkt-Sicht (AI CEO, eigene Instanz je Kunde)

- **Katalog = Vorlage + Instanz-Daten:** Der Code trägt den Standard-Katalog (versioniert, neutral). Jede Instanz hat `agenten-katalog--business--<instanz>`
  bzw. `--privat--<person>`: umbenennen, an/aus, Ziele/Schwellen, eigener Auftrag, eigene Heads aus Bausteinen (Kontext, Werkzeug-Liste ⊆ Register,
  Kategorien, Mitarbeiter). Der Brain-Import (`agenten-grundausstattung`) schreibt hierhin.
- **Nur-Markttraktion-Instanz:** Heads mit `voraussetzung: 'modul:markttraktion'` sind ein Modul; ZOE ohne andere Heads funktioniert (Test).
- **Demo:** Saat legt Heads mit Zielen, Threads, Skills und **Prüffälle** an; die Evals laufen gegen die Demo-Instanz (zeigbar: „so gut ist dein Team“).
- **Admin-Sicht:** Leistung je Head (Quote, Prüffälle, Kosten je Ergebnis, Fehler), Not-Aus, Budget — dieselben Zahlen wie in Teil F.
- **Skill-Vorlagen:** eigene, geprüfte Bibliothek (kein fremder Import ohne Prüfung, wie heute); später teilbar zwischen eigenen Instanzen.

---

# Teil D — Stufenplan (10 Pakete)

**Reihenfolge-Prinzip:** erst messen, dann ändern. V1–V4 sind das Fundament (wenig sichtbar, alles danach wird damit prüfbar). V2 kommt früh, weil die
Agenten-Bestände seit dem Neustart (09.10.) jung sind — trennen ist jetzt billig (Lehre aus E3). Danach die sichtbaren Pakete, zuletzt Produkt.

| # | Paket | Kern | Tage* | hängt an |
|---|---|---|---|---|
| V1 | **Messen & sparen** | Lauf-Spur, Kosten je Kette, ZOE-Cache, Arbeiter-Wecker | 2 | — |
| V2 | **Agenten-Bestände trennen** | C11, Umzug, Register `bereich` | 3 | Trennungs-Plan (Namensregel), `agenten-grundausstattung` gemergt |
| V3 | **Werkzeug-Verträge** | C3, Laufzeitprüfung, Fehlerklassen, Rechteklasse | 4 | V1 (Spur im Ergebnis) |
| V4 | **Prüffälle & Prompt-Register** | Gold-Sets, Gate in CI, Fassungen | 3 | V1, V3 |
| V5 | **ZOE v2** | Plan, Selbstprüfung, Nachladen, Kompaktierung | 3 | V3, V4 |
| V6 | **EINE Head-Laufzeit** | Fabrik, alte Heads + Finanzchef überführen (E2), Bericht-Schema, Auftrag+, fortsetzbare Läufe | 7 | V3, V4 |
| V7 | **Gedächtnis-Dienst** | C7, eine Schnittstelle, Abruf nach Gegenstand | 3 | V2, V6 |
| V8 | **Ziele & Schwellen** | Kennzahl-Ziele, Ereignis `kennzahl-schwelle`, fehlende Ereignisse, Wirkung für alle | 3 | V6 |
| V9 | **Autonomie je Rechteklasse + Lernschleife** | L0–L2, Prüffälle aus Entscheidungen, Wochen-Review | 3 | V3, V4, V6 |
| V10 | **Katalog als Instanz-Daten** | C12, Head aus Bausteinen, Skill-Vorlagen, Demo mit Prüffällen | 4 | V6, V7, `agenten-grundausstattung` |

\* Bau-Agent-Tage inklusive Tests und Doku, ohne Kevins Abnahme. Summe etwa 35 Tage; V1/V2 und V3 lassen sich parallel bauen (verschiedene Dateien).

### V1 · Messen & sparen (2 Tage) — Quick Win
- **Ziel:** Jede Kette hat eine Spur; ZOE cacht; Hintergrund-Sprünge ohne Wartezeit.
- **Umfang:** `spur` in `Auftrag.eingabe`, `LaufSpan`, `askText({ ki: { spur } })`, KI-Protokoll, Verbrauch; Leistung „Kosten je Kette“; ZOE-System in
  stabil/flüchtig, `cacheSystem`, feste Werkzeug-Reihenfolge; `reihe()` weckt den Arbeiter (lokaler Anstoß statt bis zu 30 s Pause); HOI-Befunde
  „p95 Antwortzeit“, „Fehlerquote Läufe“, „Cache-Quote ZOE“.
- **Nutzen heute:** Kevin sieht, was ein Auftrag an einen Head wirklich gekostet hat; ZOE antwortet günstiger und schneller (gecachte Eingabe kostet
  laut Anthropic-Preisliste einen Bruchteil des normalen Eingabepreises — [Q], genauer Wert vor dem Bau prüfen).
- **Nutzen Produkt:** Kostentransparenz je Kunde und Head — Grundlage für Preise.
- **Risiken:** Cache-Schnitt falsch → kein Effekt (wird über die Cache-Quote sichtbar); Spur-Felder vergrößern das Protokoll minimal.
- **Tests/Wächter:** `tests/agenten-spur.test.ts` (eine `trace_id` über ZOE → Head → Mitarbeiter, auch über die Warteschlange); `tests/zoe-cache.test.ts`
  (stabiler Teil ohne Uhrzeit/Live/Gedächtnis, `cache_control` gesetzt, Reihenfolge stabil); Wächter „jeder `askText` im Agenten-Pfad trägt `spur`“.

### V2 · Agenten-Bestände trennen (3 Tage)
- **Ziel:** C11 umgesetzt — keine Agenten-Datei mischt Privat und Business.
- **Umfang:** Namensregel aus dem Trennungs-Plan übernehmen; Lese-/Schreibstellen auf Bereich-Bestände; Umzug mit Kopie, Marke, Rückweg; Speicher-
  Register-Einträge mit `bereich`; Art. 15/17, Konto-Export/-Löschen angepasst; Messlatte-Saat.
- **Nutzen heute:** Eure Regel „Firma und Privat getrennt — auch in den Daten“ gilt für ZOE und Agenten; ein Business-Partner berührt technisch nie
  einen Privat-Bestand.
- **Nutzen Produkt:** Firmen-Instanz lässt sich herauslösen (Export nur `--business--`); Privat-Instanz ohne Firmendaten.
- **Risiken:** Umzug während des Betriebs (Sperren-Rangfolge Index → Thread wie E3); doppelte Pflege, falls der Trennungs-Plan eine andere Namensregel wählt → erst abstimmen.
- **Tests/Wächter:** `tests/agenten-trennung.test.ts` (nach dem Umzug kein Privat-Eintrag in `--business--`; Firmen-Export; Umzug idempotent; Rückweg);
  Register-Wächter: Agenten-Bestand ohne `bereich` → rot.

### V3 · Werkzeug-Verträge (4 Tage)
- **Ziel:** T1–T3 — jedes Werkzeug mit Vertrag, Laufzeitprüfung, Fehlerklasse, Rechteklasse, Idempotenz-Schlüssel.
- **Umfang:** `lib/werkzeuge/vertrag.ts` + Prüfer; Adapter für Alt-Werkzeuge; Umstellung zuerst der schreibenden Werkzeuge (Risiko `freigabe`) und der
  Agenten-Werkzeuge; `fuehreAus` liefert typisierte Ergebnisse; Schleife wiederholt nur `voruebergehend`.
- **Nutzen heute:** Keine still „reparierten“ Eingaben mehr — ZOE sagt klar, was fehlt; weniger falsche „erledigt“-Meldungen im Stapel.
- **Nutzen Produkt:** Werkzeug-Baukasten für Module und eigene Heads (V10); spätere MCP-Freigabe möglich (Rechteklasse → Hinweise).
- **Risiken:** große Fläche (rund 60 Register-Werkzeuge plus die Agenten-Werkzeuge) → schrittweise mit sinkender Restliste; Verhalten einzelner Werkzeuge ändert sich (bewusst: Fehler statt Klemmen).
- **Tests/Wächter:** `tests/werkzeug-vertraege.test.ts` (Vertrag vorhanden, ≥ 3 Fälle laufen, ungültig → `eingabe`, nichts gewirkt); Regex-Wächter (T2) mit
  sinkender Liste; Idempotenz: gleicher Schlüssel → eine Wirkung.

### V4 · Prüffälle & Prompt-Register (3 Tage)
- **Ziel:** T4 — Qualität messbar, Änderungen nur mit Gate.
- **Umfang:** `lib/evals/` (Fall-Format: Eingabe, Fixture aus der Demo-Saat bzw. Replay, erwartete/verbotene Werkzeuge, Endzustand, Antwort-Regeln, Rubrik);
  deterministische Prüfer zuerst (Vollzug, IDs, Bereich, Rechte, Werkzeug-Wahl), Modell-Richter nur ergänzend; pass^k. Gold-Sets: ZOE 40 Fälle
  (Bereich, Routing, Freigabe, Einschleusung), Werkzeug-Wahl 100 Sätze, je Business-Head ≥ 15, Delegation 10. Prompt-Register (`lib/prompts/`): Kennung,
  Fassung, Hash, Besitzer; KI-Protokoll schreibt `prompt_fassung`. `scripts/evals.mjs --offline` (Prüfmodell, in der GitHub Action) und `--live --k 3`
  (Knopf, mit Kostenschätzung). Der geplante Stufenwechsel (Haiku/Sonnet 5.5, `scripts/ki-stufen-vergleich.mjs`) läuft über diese Prüffälle.
- **Nutzen heute:** Jede Verbesserung an ZOE ist belegt statt gefühlt; Rückschritte fallen vor dem Hochladen auf.
- **Nutzen Produkt:** Qualitätsnachweis je Kunde („Prüffälle bestanden“); sichere Modellwechsel.
- **Risiken:** Gold-Sets veralten → Pflege im Review; Live-Evals kosten (nur auf Knopf, Schätzung vorher).
- **Tests/Wächter:** `tests/prompt-register.test.ts` (kein System-Text ohne Kennung); Offline-Evals grün als Bedingung im CI.

### V5 · ZOE v2 (3 Tage)
- **Ziel:** C4 — Plan, Selbstprüfung, Nachladen, Kompaktierung, Aufwand nach Frage.
- **Nutzen heute:** ZOE versteht mehr Formulierungen (auch Diktat), sagt nie „erledigt“, wenn nichts passiert ist, und verliert in langen Gesprächen
  keine früheren Entscheidungen.
- **Nutzen Produkt:** Die Chief-of-Staff-Erfahrung, die den AI CEO trägt.
- **Risiken:** mehr Runden = mehr Kosten → Plan nur bei mehrstufigen Anliegen, Budget je Zug bleibt; Nachladen darf die Rechte nie erweitern.
- **Tests/Wächter:** Gold-Set ZOE (V4) ≥ 0,85 pass^3; `tests/zoe-v2-selbstpruefung.test.ts` (Vollzug ohne Werkzeug → Korrektur/Hinweis); Nachladen nur
  erlaubte Bereiche (Konto „nur Business“ lädt nie Privat).

### V6 · EINE Head-Laufzeit (7 Tage) — entspricht E2
- **Ziel:** C5 + C6 — drei Welten werden eine; Bericht-Schema; Auftrag+ mit Erledigt-Kriterium; fortsetzbare Läufe (Checkpoint je Runde im Thread,
  Wiederaufnahme statt Neustart, Wirkungs-Schlüssel `lauf:<trace>:<runde>:<aufruf>`).
- **Umfang:** Fabrik, Umzug Sales/Marketing/Event/Finance (Grundlauf, Prüfer, Belege, Lernen als Bausteine); `head-<id>`/`finanzchef`/`haushalt-chef--<h>`
  → EIN Stapel (Stapel-Art `head`); Takt der alten Heads über die Zeitpläne der Laufzeit; Fach-Agenten-Routen als Mitarbeiter-Skills (zuerst die
  meistgenutzten); keine stille Kürzung der Agenten-Nachricht (S8).
- **Nutzen heute:** Ein Ort für alle Freigaben, ein Lernstand, eine Kostenrechnung; der Finanz-Head arbeitet wie die anderen.
- **Nutzen Produkt:** „Head-Fabrik“ aus AI_CEO D3.1 — neue Abteilungen ohne neuen Code.
- **Risiken:** größtes Paket, Verhaltensänderung bei den alten Heads → Regression gegen Replays und Gold-Fälle, Umzug der Freigabe-Listen ohne Verlust (Absichtsprotokoll).
- **Tests/Wächter:** `tests/head-fabrik.test.ts`; Regression „alter Head = neuer Head“ auf Gold-Fällen; Fortsetzen nach Abbruch je Runde (Muster `absichtTest`);
  „kein zweiter Modell-Pfad“ (Wächter: `askText` nur in Schleife, Laufzeit und begründeten Ausnahmen).

### V7 · Gedächtnis-Dienst (3 Tage)
- **Ziel:** C7 — eine Schnittstelle, eine Merksatz-Form, Abruf nach Gegenstand und Aktualität.
- **Nutzen heute:** Was ein Head gelernt hat, weiß auch ZOE (im selben Bereich); veraltete Merksätze laufen aus („bis“).
- **Nutzen Produkt:** Gedächtnis je Kunde nachvollziehbar (Herkunft, Art. 15/17 an einer Stelle).
- **Risiken:** Umzug der vier Orte; Prompt-Länge → Grenze 1.800 Zeichen bleibt.
- **Tests/Wächter:** `tests/gedaechtnis-dienst.test.ts` (Bereich, Herkunft, nie Fremdtext ohne Klick, Auskunft/Löschen, „Sicht X bekommt nichts aus Y“).

### V8 · Ziele & Schwellen (3 Tage)
- **Ziel:** S12 — Heads handeln, wenn eine Kennzahl reißt; fehlende Ereignisse anbinden (`frist-naht`, `termin-vorbei`, `neue-aufgabe`, `kennzahl-schwelle`).
- **Nutzen heute:** „Win-Rate fällt“ oder „Runway unter Schwelle“ führt zu einem Vorschlag, bevor ihr es selbst merkt.
- **Nutzen Produkt:** Das Versprechen „KI-Führungsteam“ wird proaktiv.
- **Risiken:** Alarm-Müdigkeit → Entprellen je Kennzahl und Woche, Eisenhower-Sortierung (bestehend), Business-frei gilt.
- **Tests/Wächter:** Gold-Fälle Schwelle; Entprellen; Business-frei; Privat-Kennzahlen (Gesundheit) nur mit Einwilligung (b).

### V9 · Autonomie je Rechteklasse + Lernschleife (3 Tage)
- **Ziel:** C5 Autonomie-Tabelle, C8 Lernschleife.
- **Nutzen heute:** Weniger Klicks für Kleinkram, aber nur dort, wo ein Head nachweislich gut ist; Abgelehntes kommt nicht wieder.
- **Nutzen Produkt:** belegbare, abgestufte Selbständigkeit — ein Verkaufsargument mit Nachweis.
- **Risiken:** falscher Aufstieg → doppelte Bedingung (Quote + Prüffälle), automatischer Abstieg, 24 h Rückgängig, Tageshöchstzahl.
- **Tests/Wächter:** nie Autonomie für `aussen|geld|loeschen` (Wächter über Rechteklasse); Aufstieg nur mit beiden Bedingungen; Entscheidung → Prüffall entsteht.

### V10 · Katalog als Instanz-Daten (4 Tage)
- **Ziel:** C12 — Heads und Mitarbeiter je Instanz konfigurierbar; eigene Heads aus Bausteinen; Skill-Vorlagen; Demo mit Prüffällen.
- **Nutzen heute:** Eigene Bezeichnungen und Ziele für eure Heads ohne Code; Brain-Import landet sauber.
- **Nutzen Produkt:** Kern des AI-CEO-Produkts: jedes Kundenteam ist eigene Konfiguration auf einer gemeinsamen, geprüften Laufzeit.
- **Risiken:** Freiheit vs. Sicherheit → Werkzeuge nur aus dem Register, Kategorien/Bereich geprüft, Business nie `gesundheit`.
- **Tests/Wächter:** leere Instanz startet; Plattform-Wächter; Instanz-Katalog „Sicht X bekommt nichts aus Y“; Demo-Saat-Wächter.

### D · Bezug zu laufenden Paketen

| Laufendes Paket | Stand | Bezug zu v2 | Empfehlung |
|---|---|---|---|
| **Agenten-Grundausstattung** (Branch `agenten-grundausstattung`, Zwischenstand `fabf6c8f`: Brain-Import der Heads/Mitarbeiter, Wissen je Business-Head `agenten-wissen--<haushalt>`) | nicht gemergt | Wissen = Gedächtnis-Ebene (V7), Import → Instanz-Katalog (V10); berührt `typen.ts`, `einstellung.ts`, `gespraech.ts`, `skills-server.ts` | **zuerst fertig und mergen**; V3/V6 nicht parallel dazu bauen |
| **Bereichs-Trennung ZOE** (`zoe-bereich`, `nur-zwei-bereiche` in `update-0910b`; Nachtrag `a0a55487` offen) | gemergt bzw. Nachtrag offen | `bereichErmitteln` (Bezug → Inhalt → Gespräch → unklar) wird in V2 vom Feld zum Ablageort | Nachtrag mergen, dann V2 |
| **Datentrennung** (`trennung-plan`, `TRENNUNG_PRIVAT_BUSINESS.md` im Entstehen) | in Arbeit | V2 ist der Agenten-Anteil; gleiche Namensregel und Umzugsmechanik | Agenten-Bestände als **erste Gruppe** des Trennungs-Plans (wenig Altbestand) |
| E2 alte Heads überführen | entschieden „nach Update 2“ | = V6 | nach V3/V4 |
| E5 fehlende Bereiche (Woche, Aufgaben abhaken, Kapazität, Steuern, Sport) | offen | neue Werkzeuge gleich mit Vertrag (V3) | erst nach V3 bauen |
| E7 Steuern EINE Quelle | offen | Voraussetzung für den Finanz-Head in V6 | vor V6 |
| E8 Systemläufe je Person | offen | Spur und Laufzeit rechnen mit auslösender Person | in V6 mitnehmen |
| KI-Stufen-Vergleich (Haiku/Sonnet 5.5) | Skript vorhanden | misst mit V4-Prüffällen | Umstellung erst nach V4 |

---

# Teil E — Entscheidungsfragen (klickfertig)

Je Frage: Kurztitel (für die Klickrunde) · Frage · Optionen · Empfehlung.

**F1 · „Start“ — Womit fangen wir an?**
- A) **Fundament zuerst** (V1 Messen → V3 Verträge → V4 Prüffälle, ca. 9 Tage): wenig Sichtbares, danach ist jede Verbesserung belegt.
- B) ZOE sichtbar klüger zuerst (V5 vor V3/V4): schneller spürbar, aber ohne Messung.
- C) Heads zusammenlegen zuerst (V6/E2): größter Umbau ohne Sicherheitsnetz.
- **Empfehlung A** — V1 bringt in 2 Tagen schon spürbar günstigere, schnellere ZOE-Antworten, und ohne Prüffälle wäre jeder weitere Umbau ein Blindflug.

**F2 · „Trennung“ — Wann trennen wir die Agenten-Ablage nach Privat/Business?**
- A) **Jetzt als V2**, als erste Gruppe des großen Trennungs-Plans — die Bestände sind seit dem Neustart jung.
- B) Zusammen mit dem großen Trennungs-Paket, wann immer es kommt.
- C) Erst mit dem ersten Firmenkunden.
- **Empfehlung A** — je später, desto mehr Altbestand muss umziehen (Lehre aus E3); eure Regel vom 09.10. gilt ausdrücklich für Neues.

**F3 · „Werkzeuge“ — Wie findet ZOE das passende Werkzeug?**
- A) **Stichwort-Regeln wie heute + ZOE darf einen Bereich nachladen** (geprüft gegen eure Rechte).
- B) Stichwort-Regeln + ein kleines Modell als Weiche vor jedem Zug.
- C) So lassen.
- **Empfehlung A** — deterministisch, günstig, und Diktat/Synonyme fallen nicht mehr durch; B kostet je Zug einen zusätzlichen Aufruf.

**F4 · „Prüffälle“ — Wie streng ist das Gate?**
- A) **Offline-Prüffälle bei jedem Hochladen Pflicht; Live-Prüffälle (echtes Modell, k = 3) vor jeder Prompt-/Modelländerung auf Knopf** mit Kostenschätzung.
- B) Wie A, zusätzlich jede Woche automatisch live (laufende Kosten).
- C) Nur auf Knopf.
- **Empfehlung A** — schützt vor Rückschritten ohne Dauerkosten; B lohnt erst mit mehreren Kunden.

**F5 · „Autonomie“ — Wie weit dürfen Heads selbst handeln?**
- A) **Bis Stufe 2 nur für Internes und Rücknehmbares** (eigene Aufgaben, nächster Schritt, Notiz), je Head erst nach ≥ 70 % Annahme UND bestandenen Prüffällen, 24 h Rückgängig.
- B) Alles bleibt Vorschlag (wie heute im Agenten-Bereich).
- C) Stufe 2 nur für Persönliche Assistenz und Operations.
- **Empfehlung A** — weniger Klicks dort, wo ein Head es nachweislich kann; Außenwirkung, Geld und Löschen bleiben in jedem Fall Klick.

**F6 · „Spur“ — Wo liegt die Nachverfolgung der Läufe?**
- A) **Eigene Lauf-Spur im Server, nur Metadaten** (keine Inhalte, Hash-Kette wie die anderen Protokolle).
- B) Zusätzlich Export an einen externen Dienst (z. B. Langfuse/LangSmith in der EU) — neuer Empfänger, AVV, Inhalte würden das Haus verlassen.
- C) Nur Summen, keine Einzelspur.
- **Empfehlung A** — passt auf den Server, kein neuer Empfänger, reicht für Kosten und Fehlersuche.

**F7 · „Katalog“ — Was dürfen Kunden an ihrem KI-Team ändern?**
- A) **Vorlage + umbenennen, an/aus, Ziele, eigener Auftrag, eigene Heads aus Bausteinen** (Werkzeuge nur aus dem geprüften Register).
- B) Nur an/aus und eigener Auftrag.
- C) Alles frei, auch eigene Werkzeuge/Anbindungen.
- **Empfehlung A** — genug Freiheit für ein echtes eigenes Team, ohne die Sicherheitsgrenze zu öffnen; C erst mit eigenem Prüfprozess.

**F8 · „Lernen“ — Wer gibt Merksätze und neue Skill-Fassungen aus dem Wochen-Review frei?**
- A) **Privat: die Person selbst; Business: jedes volle Mitglied** — und nur, wenn die Prüffälle nicht schlechter werden.
- B) Nur der Inhaber.
- C) Gesammelt einmal im Monat im Review mit ZOE.
- **Empfehlung A** — wer betroffen ist, entscheidet; das Gate verhindert, dass ein gut gemeinter Merksatz die Qualität senkt.

---

# Teil F — KPIs: Woran wir „läuft perfekt“ messen

Zielwerte sind **Vorschläge** (erster Monat messen, dann festlegen — wie bei den Budgets). Alles nur Zahlen, keine Inhalte.

| Bereich | Kennzahl | Definition | Quelle (heute bzw. v2) | Ziel (Vorschlag) |
|---|---|---|---|---|
| Qualität | **Annahmequote** je Head/Skill | angenommen ÷ (angenommen + abgelehnt), ab 10 Entscheidungen | `leistung.ts` `annahmeAus` | ≥ 70 % nach 30 Tagen |
| Qualität | **Prüffälle bestanden** | pass^3 je Gold-Set (ZOE, je Head, Werkzeug-Wahl) | V4 | ≥ 0,85; Sicherheits-/Angriffsfälle 100 % |
| Qualität | Änderungsgrad der Entwürfe | wie stark Entwürfe vor dem Übernehmen umgeschrieben werden | `heads/lernen.ts` | ≤ 30 % |
| Qualität | Daumen hoch | hoch ÷ (hoch + runter) | `leistung.ts` | ≥ 80 % |
| Qualität | Falsche Vollzugsmeldungen | „erledigt“ ohne erfolgreiche Wirkung | V5-Selbstprüfung | 0 |
| Qualität | Werkzeug-Wahl richtig | Gold-Satz → richtiger Bereich angeboten | V4 | ≥ 95 % |
| Zuverlässigkeit | **Fehlerquote Läufe** | `fehler` ÷ alle Läufe (ohne Sperren durch Schalter/Budget) | Lauf-Spur | ≤ 3 % |
| Zuverlässigkeit | Stillstand/Abbruch | „festgefahren“ ÷ Läufe | Lauf-Spur | ≤ 5 % |
| Zuverlässigkeit | Werkzeug-Fehler `intern` | Klasse `intern` ÷ Aufrufe | V3 | ≤ 1 % |
| Zuverlässigkeit | Verwaiste Läufe | „läuft“ ohne Prozess nach Pacht | `laeufe.ts`, HOI | 0 |
| Tempo | **Zeit bis zum ersten Zeichen** (ZOE) | `ttft_ms` p50 / p95 | Lauf-Spur | ≤ 2 s / ≤ 5 s |
| Tempo | Zug fertig (ohne Delegation) | p95 | Lauf-Spur | ≤ 30 s |
| Tempo | Auftrag an Head bis Bericht | p95 | Lauf-Spur | ≤ 5 Min |
| Tempo | Ereignis bis Reaktion | Ereignis `am` → Lauf-Start | Ereignisse + Spur | ≤ 2 Min (Takt-Fenster) |
| Kosten | **Kosten je angenommenem Vorschlag** | Kosten der Ketten ÷ angenommene Vorschläge | V1 + Stapel | sichtbar, fallend |
| Kosten | Kosten je ZOE-Zug | Median | Lauf-Spur | −40 % gegenüber heute nach V1 (Annahme) |
| Kosten | Cache-Quote ZOE | Cache-Lesen ÷ Eingabe-Token | Lauf-Spur | ≥ 60 % |
| Kosten | Budget-Auslastung | Monat je Head und Instanz | `einstellung.ts`, KI-Tor | < 80 % ohne Glocke |
| Wirkung | Wirkungsleiter | angenommen → Aktivität → Antwort → Termin → Chance | `heads/lernen.ts` (V6 für alle) | je Head steigend |
| Sicherheit | Wirkung ohne Klick (außen/Geld/Löschen) | Anzahl | Wächter + Spur | 0 |
| Sicherheit | Bereichs-Lecks | Messlatte + Trennungs-Wächter | Tests | 0 |
| Sicherheit | Inhalte in Protokollen | Klartext in Spur/Protokoll | Wächter | 0 |

**Sichtbar:** Agenten › ⋯ › Leistung (je Head), Head of IT (Ampeln: Fehlerquote, p95, Prüffälle, Cache-Quote), Monatsreview von ZOE (nur Zahlen).

---

# Teil G — Bewusst nicht (und warum)

- **Kein Framework-Wechsel** (LangGraph, CrewAI, Agents SDK): Die eigene Schleife ist geprüft, passt auf 1 vCPU und trägt alle Datenschutz-Regeln.
  Wir übernehmen Muster und Namen, nicht die Plattform.
- **Keine Vektor-Datenbank als Pflicht:** Merksätze sind Felder; Brain-Suche hat FTS und optional Embeddings (CPU-Regel bleibt).
- **Keine stille Selbstverbesserung:** Prompts, Skills, Merksätze und Autonomie ändern sich nur per Klick und mit Gate.
- **Keine tiefere Hierarchie als 2** (ZOE → Head → Mitarbeiter) — mehr Ebenen kosten Token und Nachvollziehbarkeit.
- **Keine autonome Außenwirkung**, auch nicht bei bester Quote (Eiserne Regel 3).
- **Kein externer Tracing-Dienst** ohne Entscheidung F6 (wäre ein neuer Empfänger mit Inhalten).

## Quellen (Kennzeichnung siehe Teil B)
- Anthropic: „Building effective agents“ (12/2024) · „How we built our multi-agent research system“ (06/2025) · „Effective context engineering for
  AI agents“ (09/2025) · „Writing effective tools for agents — with agents“ (09/2025) · „Equipping agents for the real world with Agent Skills“ (10/2025) ·
  „Effective harnesses for long-running agents“ (11/2025) · „advanced tool use“ / Tool Search (11/2025, vor Nutzung prüfen) · Doku Prompt-Caching und
  Message Batches.
- OpenAI: „A practical guide to building agents“ (2025) · Agents SDK (Guardrails, Handoffs, Tracing).
- Forschung: Yao et al. „τ-bench“ (2024, pass^k) · Cemri et al. „Why Do Multi-Agent LLM Systems Fail?“ (MAST, 2025; Anteile in `research/agenten/ARCHITEKTUR.md` 4.1) ·
  Sumers et al. „CoALA“ (2023) · Park et al. „Generative Agents“ (2023) · Packer et al. „MemGPT“ (2023) · Shinn et al. „Reflexion“ (2023) · Zhao et al.
  „ExpeL“ (2023) · Debenedetti et al. „CaMeL — Defeating Prompt Injections by Design“ (2025) · Beurer-Kellner et al. „Design Patterns for Securing LLM
  Agents against Prompt Injections“ (2025).
- Sicherheit: Willison „The lethal trifecta“ (06/2025) · Meta „Agents Rule of Two“ (10/2025) · OWASP Top 10 for Agentic Applications (12/2025).
- Praxis: HumanLayer „12-Factor Agents“ (2025) · Cognition „Don't build multi-agents“ (06/2025) · OpenTelemetry GenAI Semantic Conventions (in Entwicklung) ·
  Model Context Protocol (Tool-Annotationen, 2025).
- Eigene Recherche mit Abrufdatum: `research/agenten/ARCHITEKTUR.md`, `MARKT_UX.md`, `MODELLE.md`, `RECHT.md` (08.10.2026).
