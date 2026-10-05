# Datenschutz-Folgenabschätzung (Art. 35 DSGVO) — Schwellwertanalyse und Entwürfe

> **Entwurf — anwaltlich prüfen.** Keine Rechtsberatung. Stand 05.10.2026, IST-Stand Code e15a9a8. Eine DSFA ist **vor** Beginn
> der Verarbeitung durchzuführen und bei Änderungen zu überprüfen (Art. 35 Abs. 1, 11). Für die eigene Instanz laufen die
> Verarbeitungen bereits — die Entwürfe sind deshalb **nachzuholen**; für Kunden-Instanzen sind sie **vor dem ersten Kunden** fertigzustellen.
> In Kunden-Instanzen ist der **Kunde** Verantwortlicher und damit DSFA-pflichtig; MAKE liefert als Auftragsverarbeiter diese
> Entwürfe als Unterstützung (Art. 28 Abs. 3 lit. f).

---

## 1 · Methode

**a) DSK-Muss-Liste** (Liste der Verarbeitungstätigkeiten, für die eine DSFA durchzuführen ist, nicht-öffentlicher Bereich, Art. 35 Abs. 4).
Relevant sind hier sinngemäß die Fallgruppen
- **(M-KI)** Einsatz von künstlicher Intelligenz zur Verarbeitung personenbezogener Daten zur Steuerung der Interaktion mit den
  Betroffenen oder zur Bewertung persönlicher Aspekte,
- **(M-Besch)** umfangreiche Verarbeitung von Daten über das Verhalten von Beschäftigten, die zur Bewertung ihrer Arbeitstätigkeit
  eingesetzt werden kann, sodass Rechtsfolgen oder erhebliche Beeinträchtigungen entstehen können,
- **(M-Profil)** Erstellung umfassender Profile über Interessen, Netz persönlicher Beziehungen oder Persönlichkeit,
- **(M-Zus)** Zusammenführung von Daten aus verschiedenen Quellen und Weiterverarbeitung der zusammengeführten Daten,
- **(M-Art9)** Verarbeitung besonderer Kategorien (Art. 9), insbesondere mit neuen Technologien.

[[ANWALT: Nummern und genauen Wortlaut der aktuellen DSK-Liste bzw. der Liste der zuständigen Landesbehörde zuordnen]]

**b) WP 248 rev.01 (Leitlinien zur DSFA, vom EDSA bestätigt)** — neun Kriterien; ab **zwei** erfüllten Kriterien ist eine DSFA
in der Regel erforderlich:
K1 Bewerten/Einstufen (Scoring, Profiling) · K2 automatisierte Entscheidung mit Rechtswirkung · K3 systematische Überwachung ·
K4 vertrauliche oder höchstpersönliche Daten (Art. 9, Finanzen) · K5 Verarbeitung in großem Umfang · K6 Abgleichen/Zusammenführen
von Datensätzen · K7 schutzbedürftige Betroffene (u. a. **Beschäftigte**) · K8 innovative Nutzung/neue Technologie (**KI**) ·
K9 Verarbeitung hindert an Rechtsausübung/Vertrag.

---

## 2 · Schwellwertanalyse

| # | Verarbeitung | DSK-Muss | WP 248 erfüllt | Einordnung Umfang | Ergebnis |
|---|---|---|---|---|---|
| V1 | **Gesundheitsdaten + KI** — Whoop/Vitalwerte, Gesundheits-Log, Haut-Tagebuch, Sport, Ernährung; eigene Werte im ZOE-Kontext und im Planungsvorschlag (Anthropic); Erholung als Team-Faktor in der Kapazität; Gesundheits-Takt per Telegram | M-Art9, M-KI, M-Zus | K4, K6, K8; in Kunden-Instanzen mit Beschäftigten zusätzlich K7 | eigene Instanz: 2 Personen (klein); Kunden-Instanzen: je Team | **DSFA erforderlich** (≥ 3 Kriterien) — DSFA-1 |
| V2 | **Lead-Scoring / Profiling** im CRM — regelbasiertes Marketing-/Sales-Scoring (MQL/SQL, `lib/crm/scoring.ts`), Signale aus Mail/Kalender, Traktions-Index; **keine** automatische Änderung von Status/Phase (nur Anzeige/Vorschlag) | M-Profil (Grenzfall, B2B), M-Zus | K1, K6; mit KI-Heads zusätzlich K8 | eigene Instanz: wenige hundert Kontakte; Kunden-Instanzen: offen | **ohne KI: Grenzfall, DSFA empfohlen; mit KI-Heads: erforderlich** — gemeinsam in DSFA-3 |
| V3 | **Beschäftigten-Planung in Kunden-Instanzen** — Kapazität (Arbeitszeit, Urlaub, Blöcke, Zuweisungen), gemessene Fokuszeit je Person, festgehaltene Wochenpläne, Plan-Treue „geplant vs. Ist“, KI-Delegationsvorschläge | M-Besch, M-KI | K3 (Fokus-Messung), K6, K7, K1 (Plan-Treue ist eine Bewertung), K8 (Delegation per KI) | je Kunde; in der eigenen Instanz nur Inhaber-Haushalt + einzelne Freie | **DSFA erforderlich** für Kunden-Instanzen mit Beschäftigten — DSFA-2; eigene Instanz: Grenzfall, mit DSFA-2 abgedeckt |
| V4 | **KI-Hintergrundläufe** — Takt-Läufe ohne Klick: Tagesstart/Tageslauf, Heads (Sales/Marketing …) mit CRM-Paketen, Inbox-Einstufung, Research-Agent (Websuche), Brain-Konsolidierung, ZOE-Empfang, Delegations-Runde | M-KI, M-Zus | K6, K8, K1 (Heads priorisieren Leads), K3 (laufende Auswertung eingehender Mails Dritter) | alle Kontakte/Mails einer Instanz | **DSFA erforderlich** — DSFA-3 |
| — | Netzwerken / Kunden-Events (LIA vorhanden) | — | K6 (Übermittlung an Kunden) | gering | keine DSFA; Interessenabwägung `DATENSCHUTZ_NETZWERKEN.md` |
| — | Gesellschafts-Register | — | K4 (vertraulich) | gering | keine DSFA |
| — | Terminbuchung (öffentlich) | — | — | gering | keine DSFA |

Keine Verarbeitung trifft **automatisierte Einzelentscheidungen** im Sinne von Art. 22 (K2): KI und Scoring schlagen vor, ein Mensch entscheidet.

---

## 3 · DSFA-1: Gesundheitsdaten und KI

### 3.1 Systematische Beschreibung (Art. 35 Abs. 7 lit. a)
- **Zweck:** persönliche Gesundheits- und Leistungssteuerung der Person selbst (Erholung, Schlaf, Sport, Ernährung, Haut);
  realistische Tages-/Wochenplanung; optional Team-Kapazität mit Erholungs-Faktor.
- **Daten:** Vitalwerte (Recovery, HRV, Ruhepuls, Schlaf) aus Whoop (OAuth, nur Inhaber verbindet), selbst erfasste Gesundheits-Logs,
  Haut-Tagebuch, Sport, Ernährungsprofil (Bedarf, Ziel), Journal.
- **Betroffene:** Konto-Inhaber der Instanz (in der eigenen Instanz zwei Personen); in Kunden-Instanzen Nutzer, ggf. Beschäftigte.
- **Datenflüsse:**
  1. Speicherung verschlüsselt je Person (`vitals--*`, `health-log--*`, `haut--*`, `sport--*`), Register-Kategorie `art9`.
  2. Andere Konten sehen Werte nur bei „Teilen“ (Konto › teilt.gesundheit).
  3. **ZOE-Kontext** der fragenden Person enthält ihre **eigenen** Werte (`lib/brain.ts`, „KÖRPER (privat, nie in Business-Aussagen,
     nie über die andere Person)“) → Übermittlung an **Anthropic (USA)** bei jeder ZOE-Anfrage.
  4. **Planungsvorschlag** (`/api/planung/vorschlag`): Recovery und Schlaf der Person → Anthropic.
  5. **Gesundheits-Takt**: Morgen-/Abendnachricht mit Werten per **Telegram** (nur wenn konfiguriert); Antworten gehen an das Modell.
  6. **Kapazität:** Ø-Erholung als Team-Faktor nur mit eigener Einwilligung (`erholungAm`, Vorgabe aus, nur die Person selbst) **und**
     Teilen mit allen Konten; Wert nie gespeichert, nie im Business-Index, nie an ZOE.
- **Technik:** Hetzner (DE), Anthropic-API, Whoop-API, Telegram-Bot-API.

### 3.2 Notwendigkeit und Verhältnismäßigkeit (lit. b)
- Rechtsgrundlage: **Art. 9 Abs. 2 lit. a** — ausdrückliche Einwilligung durch eigenes Erfassen bzw. Verbinden; Kapazität: gesonderte
  Einwilligung. [[ANWALT: Reicht „eigenes Erfassen/Verbinden“ als ausdrückliche Einwilligung, oder braucht es einen Einwilligungstext
  mit Hinweis auf KI-Übermittlung in die USA (Art. 49 Abs. 1 lit. a / Art. 46)?]]
- Datenminimierung: nur eigene Werte an die KI, nie Werte anderer Personen, keine Diagnosen im Code/Prompt (Prüfung S1).
- Zweckbindung: Gesundheit nie im Business-Index, nie in Protokollen, nie in Verlauf/Änderungsprotokoll (nur Kennungen).
- Speicherbegrenzung: bis die Person löscht — **keine automatische Frist** (bewusst: Langzeitverlauf ist Zweck). [[KEVIN: Höchstdauer?]]
- Betroffenenrechte: Person sieht/exportiert/löscht selbst; Widerruf = Verbindung trennen bzw. Schalter aus.

### 3.3 Risiken (lit. c)

| Risiko | Wahrscheinlichkeit | Schwere | Stufe |
|---|---|---|---|
| R1 Offenlegung gegenüber anderen Konten des Haushalts/Teams (Rechtefehler) | gering (serverseitige Filter, Wächtertests) | hoch | mittel |
| R2 Übermittlung an Anthropic: Speicherung/Zugriff beim Anbieter, Drittland USA | mittel (bei jeder ZOE-Nutzung) | hoch | **hoch** |
| R3 Telegram: Werte im Messenger (Gerät, Anbieter außerhalb EU) | mittel, wenn aktiviert | hoch | **hoch** |
| R4 Druck/fehlende Freiwilligkeit bei Beschäftigten (Erholungs-Faktor) | mittel in Kunden-Instanzen | hoch | **hoch** |
| R5 Server-/Abbild-Kompromittierung (Schlüssel auf demselben System) | gering | hoch | mittel |
| R6 Fehlinterpretation durch KI (Planung zu stark an Recovery gekoppelt) | mittel | mittel | mittel |

### 3.4 Maßnahmen (lit. d)
Bestehend: AES-256-GCM im Ruhezustand; Teilen nur ausdrücklich; Kapazität nur Team-Faktor mit gesonderter Einwilligung, Vorgabe aus;
nie Business-Index; KI nur eigene Werte; Prompt-Regel „nie über die andere Person“; Wächtertests (`tests/sicher-s1.test.ts`,
`kapazitaet-route`); Rechte serverseitig; 2FA verfügbar.

Geplant / zu entscheiden:
- **M1** Schalter je Person „Gesundheit an ZOE geben“ (Vorgabe **aus** in Kunden-Instanzen), Hinweis bei erster Nutzung. [[KEVIN]]
- **M2** AVV/DPA mit Anthropic + **Zero-Data-Retention** anfragen; Drittland-Garantie dokumentieren. [[KEVIN]]
- **M3** Telegram: Gesundheitswerte nicht im Nachrichtentext („Dein Morgenbericht liegt in MAKE OS“) oder Telegram ganz ersetzen. [[KEVIN]]
- **M4** In Kunden-Instanzen: Erholungs-Faktor standardmäßig **nicht verfügbar** für Beschäftigte (nur Inhaber/Selbstständige), bis
  [[ANWALT: Freiwilligkeit § 26 Abs. 2 BDSG]] geklärt ist.
- **M5** 2FA-Pflicht für Konten mit Gesundheitsdaten.
- **M6** Whoop: Konstanten/Rückfälle auf eine feste Person neutralisieren (Paket 1).

### 3.5 Restrisiko und Ergebnis
Mit M1–M5 **vertretbar** (mittel). Ohne M2/M3 bleibt R2/R3 hoch → vor Kunden-Instanzen umsetzen.
Kein Fall des Art. 36 (vorherige Konsultation), solange M1–M3 umgesetzt sind. [[ANWALT: bestätigen]]
Überprüfung: bei jeder Änderung an Gesundheit/KI, spätestens [[KEVIN: Datum, z. B. 04/2027]].

---

## 4 · DSFA-2: Beschäftigten-Planung in Kunden-Instanzen

### 4.1 Beschreibung
- **Zweck:** realistische Planung — verfügbare Arbeitszeit je Person gegen Aufwand von Meilensteinen/Zielen und Mandaten; Engpässe
  sichtbar; Plan-Treue als Kennzahl der Umsetzung; KI-Vorschläge, wer welche Aufgabe übernimmt.
- **Daten:** Stunden/Woche, Urlaub, feste Blöcke (Titel nur für die Person), Zuweisungen Person × Mandat (Kennung), Termine im
  Arbeitsfenster (nur Dauer/Anzahl), **gemessene Business-Fokuszeit je Person und Tag** (`zeit--<person>`), montags festgehaltener
  Wochenplan je Person (`kapazitaet-plan--*`, 24 Monate), Plan-Treue (Σ Ist ÷ Σ Plan, über Personen mit Konto summiert — bei sehr
  kleinen Teams praktisch eine Einzelbewertung), Delegationsvorschläge (KI, nach Rollen/Verantwortungen aus `team--*`).
- **Betroffene:** Beschäftigte, Freie, Team-Personen ohne Konto.
- **Empfänger:** Personen des Haushalts (Einzelwerte teils nur die Person), Hoster; Delegation: Aufgabentitel an Anthropic.

### 4.2 Notwendigkeit und Verhältnismäßigkeit
- Rechtsgrundlage: Art. 6 Abs. 1 lit. b / **§ 26 BDSG** (Planung im Beschäftigungsverhältnis), lit. f. [[ANWALT: § 26 BDSG ist
  nach EuGH C-34/21 (2023) als eigenständige Grundlage fraglich — tragfähige Grundlage (Art. 6 Abs. 1 lit. b/c/f, Art. 88,
  Betriebsvereinbarung) festlegen]]
- **Mitbestimmung:** Fokus-Messung und Plan-Treue sind technische Einrichtungen, die zur Überwachung von Verhalten/Leistung
  **geeignet** sind → § 87 Abs. 1 Nr. 6 BetrVG, wenn der Kunde einen Betriebsrat hat. [[ANWALT]]
- Minimierung: keine Gesundheitswerte gespeichert; Fokus-Zeit wird **nur beim Rechnen** gelesen; Kapazität speichert nur Kennungen;
  keine Rangliste von Personen. Speicherbegrenzung: Wochenpläne 24 Monate, Team-Personen 30 Tage nach Deaktivieren.
- Transparenz: Beschäftigte müssen wissen, was gemessen wird (Art. 13) — Hinweistext fehlt.

### 4.3 Risiken

| Risiko | Wahrscheinlichkeit | Schwere | Stufe |
|---|---|---|---|
| R1 Leistungs-/Verhaltenskontrolle über Fokuszeit und Plan-Treue (Zweckänderung) | mittel | hoch | **hoch** |
| R2 Nachteilige Personalentscheidungen auf Basis der Kennzahlen | gering–mittel | hoch | **hoch** |
| R3 Einsicht anderer Teammitglieder in Einzelwerte | gering (serverseitige Filter) | mittel | mittel |
| R4 KI-Delegation verteilt Aufgaben nach Merkmalen statt Rollen (Diskriminierung, KI-VO Hochrisiko) | gering (Prompt nach Rollen) | hoch | mittel |
| R5 Unzulässige Einwilligung (Erholung) im Abhängigkeitsverhältnis | mittel | hoch | **hoch** (siehe DSFA-1 M4) |

### 4.4 Maßnahmen
Bestehend: Erholung nur mit Einwilligung der Person selbst (auch nicht der Inhaber), nie im Index; Titel von Blöcken nur für die Person;
Art.-15-Auskunft je Person (`GET /api/kapazitaet?auskunft=…`); Löschfristen; serverseitige Filter (`fuerBetrachter`); Delegation nur
Vorschlag, Übernahme per Klick; Delegation ohne Gesundheit/Privates (fail-closed).

Geplant / zu entscheiden:
- **M1** Modul-Schalter je Kunden-Instanz: Fokus-Messung und Plan-Treue für Beschäftigte **aus** als Vorgabe; nur Team-Summen ab
  einer Mindestgröße (z. B. ≥ 5 Personen) anzeigen. [[KEVIN]]
- **M2** Zweckbindung im AVV/Kundenvertrag: **keine Verwendung für Leistungsbeurteilung, Abmahnung, Kündigung**. [[ANWALT]]
- **M3** Hinweistext für Beschäftigte (Muster) und Checkliste Betriebsrat im Onboarding. [[ANWALT]]
- **M4** Delegations-Prompt in Kunden-Instanzen auf Rollen/Zuständigkeit beschränken (keine Leistungswerte, keine Kapazität je Person
  ohne Freigabe) — siehe `KI_VO.md`.
- **M5** Fokus-Rohdaten mit Frist versehen (heute keine). [[KEVIN]]

### 4.5 Restrisiko und Ergebnis
Mit M1–M4 **vertretbar**; ohne M1/M2 hoch. Die DSFA ist je Kunde vom Kunden zu übernehmen und an seine Lage (Betriebsrat, Teamgröße)
anzupassen. Überprüfung: vor dem ersten Kunden mit Beschäftigten.

---

## 5 · DSFA-3: KI-Hintergrundläufe und Lead-Scoring/Profiling

### 5.1 Beschreibung
- **Läufe** (Takt, ohne Klick): Tagesstart/Tageslauf, Morgen/Abend, Heads (z. B. Sales, Marketing — lesen CRM-Pakete, schlagen
  vor), Inbox-Einstufung (Absender, Betreff, Vorschau eingehender Mails), Research-Agent (Websuche über den Anbieter), Brain-Konsolidierung,
  ZOE-Empfang, Delegations-Runde, Löschfristen/Durchsicht (ohne Modell). Liste: `lib/zoe/agenten.ts` (`SYSTEM_LAEUFE`).
- **Scoring:** regelbasierte Punkte je Kriterium (gemessen aus Daten = Marketing; im Gespräch erfragt = Sales), Schwellen MQL/SQL,
  Muss-Kriterien; Ergebnis nur Anzeige/Vorschlag, keine automatische Statusänderung (`SCORING.md`).
- **Daten:** Geschäftskontakte (Name, Firma, Position, Kontaktdaten, Aktivitäten, Notizen außer Privatnotizen, Deal-Stände),
  Mail-Metadaten und -Texte, Kalender-Signale, öffentlich recherchierte Firmeninformationen.
- **Empfänger:** Anthropic (USA) für Modellaufrufe; Websuche über den Anbieter.

### 5.2 Notwendigkeit und Verhältnismäßigkeit
- Rechtsgrundlage: Art. 6 Abs. 1 lit. f (B2B-Vertrieb, Priorisierung) bzw. lit. b; Werbung nur mit Einwilligung (§ 7 UWG).
  [[ANWALT: Interessenabwägung für Scoring/KI-Auswertung schriftlich ergänzen (analog LIA-Netzwerken)]]
- Minimierung: KI-Pakete nur Arbeitsfelder, nie Privatnotizen, nie eingeschränkte (Art. 18) oder gesperrte Personen, IBAN maskiert;
  fremder Text gekapselt; Protokolle nur Kennungen; Heads-Replay 90 Tage.
- Transparenz: Art. 13/14-Hinweise nennen KI-Auswertung noch nicht ausdrücklich. [[ANWALT]]
- Widerspruch (Art. 21) wirkt in einem Klick überall, auch für KI-Pakete.
- Keine Entscheidung nach Art. 22.

### 5.3 Risiken

| Risiko | Wahrscheinlichkeit | Schwere | Stufe |
|---|---|---|---|
| R1 Übermittlung großer Teile der Kartei/Mails an US-Anbieter ohne AVV/ZDR | mittel | mittel–hoch | **hoch** bis AVV |
| R2 Prompt-Injection aus Mails/Web führt zu ungewollten Aktionen | mittel | mittel | mittel (Schreiben nur über Stapel) |
| R3 Fehlerhafte/verzerrte Einstufung (Halluzination, Bias) beeinflusst Ansprache | mittel | gering–mittel | mittel |
| R4 Profilbildung über Personen über den Zweck hinaus (Zusammenführung Mail + Kalender + Web) | gering–mittel | mittel | mittel |
| R5 Unbemerkte Läufe (Kosten, Datenabfluss) | gering | mittel | gering (Agenten-Schalter, Kosten je Person `ki-verbrauch`) |

### 5.4 Maßnahmen
Bestehend: Human-in-the-Loop (Stapel, Freigabe per Klick, 409 bei Änderung); `fremd()`-Kapselung; Art.-18/Werbesperre-Ausschluss;
Agenten-Schalter je Lauf (`agents-config`); Modell-Drossel; keine Mail-Inhalte in Logs; Transkription aus.
Geplant: **M1** AVV + ZDR Anthropic; **M2** Instanz-Schalter „KI-Hintergrundläufe aus“ (heute: nur über leeren `ANTHROPIC_API_KEY`
oder je Agent); **M3** Art.-13/14-Text um KI-Auswertung ergänzen; **M4** Research-Agent nur Firmen, keine Personen-Recherche ohne Anlass.

### 5.5 Restrisiko und Ergebnis
Mit M1–M3 **vertretbar** (mittel–gering). Überprüfung bei jedem neuen Lauf/Head.

---

## 6 · Datenschutzbeauftragter (§ 38 BDSG)

Nach § 38 Abs. 1 Satz 2 BDSG ist ein Datenschutzbeauftragter **unabhängig von der Zahl der Beschäftigten** zu benennen, wenn
Verarbeitungen vorgenommen werden, die einer **DSFA nach Art. 35 unterliegen**. Ergibt diese Analyse DSFA-Pflicht (V1, V3, V4),
spricht viel für eine **DSB-Pflicht** — für die eigene Gesellschaft und ggf. für Kunden.
[[ANWALT: DSB-Pflicht für die eigene Gesellschaft prüfen; extern oder intern; Meldung der Kontaktdaten an die Aufsichtsbehörde (Art. 37 Abs. 7)]]
