# MAKE OS und die KI-Verordnung (VO (EU) 2024/1689)

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung. Stand 05.10.2026, IST-Stand Code e15a9a8.
> [[ANWALT: aktuellen Stand möglicher Änderungen/Verschiebungen (EU-„Digital-Omnibus“, Leitlinien und Verhaltenskodizes der
> Kommission zu Art. 50 und zur Hochrisiko-Einstufung) prüfen — dieser Entwurf geht vom Verordnungstext aus]]

---

## 1 · Was in MAKE OS KI ist

| Baustein | Technik | KI-System i. S. v. Art. 3 Nr. 1? |
|---|---|---|
| **ZOE** (Gespräch, Entwürfe, Vorschläge im Stapel, Telegram-Antworten) | Sprachmodell eines Anbieters (Anthropic) über API | **ja** |
| **Heads** (Sales, Marketing …), Tagesstart/Tageslauf, Inbox-Einstufung, Research-Agent (mit Websuche), Brain-Konsolidierung, **Delegations-Runde** | Sprachmodell | **ja** |
| Lead-Scoring (MQL/SQL), Traktions-Index, Business-Index | feste Regeln und Formeln (`lib/crm/scoring.ts`) | nein (klassische Software) |
| Kapazität, Plan-Treue, Fokus-Messung | feste Formeln (`lib/kapazitaet/`) | nein — **aber** Daten können in KI-Läufe fließen (Abschnitt 4) |
| Brain-Suche (lokale Embeddings) | lokales Modell, nur Suche | ja (geringes Risiko, keine Ausgabe an Dritte) |

**Rollen:**
- **MAKE** ist **Anbieter** (Art. 3 Nr. 3) der KI-Systeme in MAKE OS, sobald MAKE OS Kunden unter eigenem Namen bereitgestellt
  wird, und zugleich **Betreiber** (Art. 3 Nr. 4) in der eigenen Instanz.
- **Anthropic** ist Anbieter des **KI-Modells mit allgemeinem Verwendungszweck** (Kapitel V) — MAKE ist nachgelagerter Anbieter
  und stützt sich auf dessen Dokumentation und Nutzungsrichtlinien.
- **Kunden** sind **Betreiber** ihrer Instanz.

## 2 · Zeitplan (laut Verordnung)

| ab | Was |
|---|---|
| 02.02.2025 | **Art. 4 KI-Kompetenz**, Art. 5 Verbote |
| 02.08.2025 | Pflichten für Modelle mit allgemeinem Verwendungszweck (betrifft Anthropic) |
| **02.08.2026** | **Art. 50 Transparenzpflichten**, Hochrisiko nach Anhang III, Sanktionen |
| 02.08.2027 | Hochrisiko nach Anhang I (Produkte) |

---

## 3 · Art. 4 — KI-Kompetenz (gilt bereits)

Anbieter und Betreiber müssen sicherstellen, dass ihr Personal und Personen, die in ihrem Auftrag KI-Systeme nutzen, über
ausreichende KI-Kompetenz verfügen.

**IST:** keine dokumentierte Schulung. Leitplanken sind im Produkt eingebaut (Human-in-the-Loop, Stapel, Kapselung fremder Texte).

**Maßnahmen**
- [ ] **K1** Kurz-Schulung (1–2 Seiten + 30 Minuten) für alle, die MAKE OS mit KI nutzen: Was ZOE darf (nur vorschlagen), was nicht
      (nie selbst senden), Fehlerbilder (Halluzination, veraltete Daten, Prompt-Injection aus Mails), Datenschutz (keine Gesundheits-/
      Personaldaten anderer in Fragen), Prüfen vor Freigabe. Teilnahme mit Datum festhalten. [[KEVIN: wer, bis wann]]
- [ ] **K2** Für Kunden: dieselbe Unterlage im Onboarding (Kunde bleibt als Betreiber selbst verantwortlich, MAKE unterstützt).
- [ ] **K3** In der Oberfläche: kurzer Hinweis bei der ersten ZOE-Nutzung („ZOE ist eine KI, kann sich irren, schlägt nur vor“).

## 4 · Art. 5 — Verbote (Prüfpunkt)

Relevant ist nur **Art. 5 Abs. 1 lit. f**: Verbot von KI-Systemen, die **Emotionen** einer Person **am Arbeitsplatz** aus
**biometrischen Daten** ableiten (Ausnahme: medizinische/Sicherheitsgründe).

**IST:** MAKE OS leitet keine Emotionen ab. Aber: Vitalwerte (HRV, Recovery) der fragenden Person gehen in den ZOE-Kontext
(`lib/brain.ts`); ZOE könnte daraus Aussagen über „Stress“ oder „Stimmung“ formulieren.
**Maßnahme:** **K4** In Kunden-Instanzen Gesundheitswerte nicht an ZOE (Schalter, Vorgabe aus — `DSFA.md` DSFA-1 M1); im Prompt
ausdrücklich keine Aussagen über Gefühle/Emotionen aus Körperwerten; Erholungs-Faktor der Kapazität bleibt reine Formel ohne KI.
[[ANWALT: Sind Whoop-Werte „biometrische Daten“ im Sinne von Art. 3 Nr. 34 und ist die Selbstnutzung durch Inhaber ein Arbeitsplatz-Fall?]]

## 5 · Art. 50 — Transparenz (ab 02.08.2026)

| Pflicht | Wer | Lage in MAKE OS | Maßnahme |
|---|---|---|---|
| **Abs. 1** — Personen müssen wissen, dass sie mit einer KI interagieren (außer offensichtlich) | Anbieter | ZOE ist als Assistentin benannt; für Nutzer ist die KI-Natur im Kontext erkennbar. Telegram-Antworten von ZOE sind nicht ausdrücklich als KI gekennzeichnet. Dritte (Gäste der Buchungsseite, Mail-Empfänger) interagieren **nicht** mit ZOE. | **K5** „ZOE (KI)“ an allen Einstiegen und in Telegram-Antworten kennzeichnen |
| **Abs. 2** — synthetisch erzeugte Texte/Bilder/Audio maschinenlesbar kennzeichnen (soweit technisch möglich; Ausnahme: unterstützende Funktion für Standardbearbeitung bzw. keine wesentliche Veränderung) | Anbieter | ZOE erzeugt Entwürfe (Mails, Nachrichten, Beiträge, Newsletter, Angebots-Entwürfe, Zusammenfassungen). Im System ist die Herkunft teils vermerkt (Aktivitäten mit ZOE-Herkunft, Stapel, Änderungsprotokoll „ZOE im Auftrag“). Ausgehende Texte werden von Menschen geprüft und versandt. | **K6** Herkunft „von ZOE entworfen“ an **jedem** gespeicherten Entwurf als Feld (maschinenlesbar); [[ANWALT: Fällt das Entwerfen mit menschlicher Freigabe unter die Ausnahme? Braucht der versandte Text eine Kennzeichnung?]] |
| **Abs. 3** — Emotionserkennung/biometrische Kategorisierung offenlegen | Betreiber | nicht eingesetzt | — (K4 sichert ab) |
| **Abs. 4** — Deepfakes offenlegen; KI-Texte, die **zur Information der Öffentlichkeit über Angelegenheiten von öffentlichem Interesse** veröffentlicht werden, offenlegen (außer menschliche Redaktion/Verantwortung) | Betreiber | Marketing-Entwürfe (Beiträge, Newsletter) werden vor Veröffentlichung von Menschen redigiert; KI-erzeugte Bilder/Filme auf Websites (Landingpages, Event-Seite) möglich | **K7** Redaktionsverantwortung festhalten (wer gibt frei); KI-erzeugte Bilder/Videos, die echte Personen/Orte täuschend echt zeigen, kennzeichnen |

## 6 · Hochrisiko — Anhang III Nr. 4 (Beschäftigung)

Hochrisiko sind u. a. KI-Systeme, die bestimmungsgemäß verwendet werden für Entscheidungen über Arbeitsbedingungen, Beförderung oder
Kündigung, **für die Zuweisung von Aufgaben auf der Grundlage des individuellen Verhaltens oder persönlicher Merkmale** oder
**zur Beobachtung und Bewertung der Leistung und des Verhaltens** von Beschäftigten (Anhang III Nr. 4 lit. b).

**Prüfung je Baustein**

| Baustein | Bewertung |
|---|---|
| Kapazität, Plan-Treue, Fokus-Messung | **kein KI-System** (Formeln) → fällt nicht unter Anhang III; bleibt aber datenschutzrechtlich heikel (DSFA-2) |
| **Delegations-Runde** (ZOE schlägt vor, wer welche Aufgabe übernimmt) | KI-System, das **Aufgaben zuweist**. Heute nach **Rollen/Zuständigkeiten** aus der Team-Liste, nicht nach Verhalten oder Leistung; Ergebnis nur Vorschlag, Übernahme per Klick. → **voraussichtlich nicht hochriskant**, solange keine Verhaltens-/Leistungsdaten einfließen. Kippt, sobald ZOE Fokuszeit, Plan-Treue, Erholung oder Erledigungsquoten **je Person** für die Zuteilung nutzt. |
| ZOE-Gespräch in Kunden-Instanzen | Kann auf Frage Kapazität/Aufgabenstand je Person zusammenfassen → Risiko der **Zweckentfremdung** zur Leistungsbewertung |
| Heads / Lead-Scoring | betrifft Geschäftskontakte, nicht Beschäftigte; kein Anhang-III-Fall (keine Kreditwürdigkeit natürlicher Personen) |

**Art. 6 Abs. 3:** Ein Anhang-III-System ist nicht hochriskant, wenn es kein erhebliches Risiko birgt (z. B. eng begrenzte
Verfahrensaufgabe, vorbereitende Aufgabe) — **außer es betreibt Profiling** natürlicher Personen. Wer sich darauf beruft, muss die
Bewertung **vor dem Inverkehrbringen dokumentieren** (Art. 6 Abs. 4) und das System registrieren (Art. 49 Abs. 2).

**Maßnahmen**
- [ ] **K8** **Zweckbestimmung** schriftlich festlegen (Produktbeschreibung, AVV/Kundenvertrag): Delegation und Kapazität dienen der
      Planung nach Rollen und verfügbarer Zeit, **nicht** der Leistungs- oder Verhaltensbewertung, nicht Personalentscheidungen.
- [ ] **K9** Technisch absichern: In Kunden-Instanzen erhält die Delegation **keine** personenbezogenen Leistungs-/Verhaltenswerte
      (Fokuszeit, Plan-Treue, Erholung, Erledigungsquoten je Person); ZOE-Werkzeuge liefern Kapazität nur als Team-Summe. Wächtertest
      „Delegation bekommt keine Leistungsdaten“. (Code-Änderung, auf Wort)
- [ ] **K10** Bewertung nach Art. 6 Abs. 3/4 dokumentieren (dieses Kapitel als Grundlage) und klären, ob eine Registrierung nötig ist.
      [[ANWALT]]
- [ ] **K11** Falls Kunden die Delegation doch nach Leistung wollen: **nicht anbieten**, bis Hochrisiko-Pflichten (Risikomanagement,
      Daten-Governance, Protokollierung, menschliche Aufsicht, Konformitätsbewertung) erfüllbar sind.

## 7 · Weitere Pflichten und gute Praxis

- **Menschliche Aufsicht** ist im Produkt angelegt: Stapel, Freigabe per Klick, nie Versand durch ZOE, 409 bei veralteten Vorschlägen.
- **Protokollierung:** ZOE-Entscheidungen (36 Monate), ZOE-Protokoll (90 Tage, nur Kennungen), Kosten je Person.
- **Datenqualität/Robustheit:** fremder Text gekapselt (`fremd()`), Prompt-Injection-Regel, Größen- und Ratenschranken.
- **Anbieter-Richtlinien** von Anthropic einhalten; Modellwechsel dokumentieren (`lib/agent-config.ts` `MODEL_BY_TIER`).
- Verhältnis zur DSGVO: KI-Läufe sind in `DSFA.md` (DSFA-1, -3) bewertet.

## 8 · Maßnahmen-Übersicht

| # | Maßnahme | Art | Wer | Bis |
|---|---|---|---|---|
| K1 | Schulung KI-Kompetenz (eigenes Team) | Art. 4 | [[KEVIN]] | sofort (Pflicht seit 02/2025) |
| K2 | Schulungsunterlage für Kunden | Art. 4 | [[KEVIN]] | vor erstem Kunden |
| K3 | Hinweis bei erster ZOE-Nutzung | Art. 4/50 | Bau | [[KEVIN]] |
| K4 | Keine Emotions-Aussagen aus Körperwerten; Gesundheit an ZOE abschaltbar | Art. 5 | Bau | vor erstem Kunden |
| K5 | „ZOE (KI)“ kennzeichnen, auch in Telegram | Art. 50 Abs. 1 | Bau | überfällig (seit 02.08.2026) |
| K6 | Herkunftsfeld an allen KI-Entwürfen | Art. 50 Abs. 2 | Bau + [[ANWALT]] | überfällig, Umfang klären |
| K7 | Redaktionsverantwortung, Bild/Video-Kennzeichnung | Art. 50 Abs. 4 | [[KEVIN]] | laufend |
| K8 | Zweckbestimmung schriftlich | Anhang III | [[KEVIN]] + [[ANWALT]] | vor erstem Kunden |
| K9 | Delegation ohne Leistungsdaten, Wächtertest | Anhang III | Bau | vor erstem Kunden |
| K10 | Art.-6-Abs.-3-Bewertung dokumentieren | Art. 6 Abs. 4 | [[ANWALT]] | vor erstem Kunden |
| K11 | Keine leistungsbasierte Zuteilung anbieten | Anhang III | [[KEVIN]] | Grundsatz |
