# Fulfillment — verbindliches Konzept (Bauplan für C0 → C1 · C2 · C3)

Stand: 10.10.2026, spät · Branch `update-0910b` · Grundlage: `scratchpad/fulfillment-brief.md` (Kevins Vorgaben, Antworten 22:30, Vorgabe 22:55),
`research/sales-transformation/FAKTEN_TRANSFORMATION.md` (zitiert als **[FT §x]**), `scratchpad/wissen-sales/` (INVENTAR.md, die Notiz zum früheren Vertriebsablauf,
vorlagen.json, vorlagen_2.json, prozesse_zeichnen.json; INVENTAR_2/3 und vorlagen_3.json folgen als Daten, Abschnitt 2.7), `research/unternehmen/FAKTEN_UNTERNEHMEN_RECHT.md` Abschnitt 7
(zitiert als **[FU §7]**) und der Code-Stand dieses Worktrees.

**Wie dieses Dokument gilt.** Kevins Vorgaben im Brief gehen vor. Was hier steht, ist für C0–C3 bindend: Dateinamen, Bestandsnamen, Kennungen,
Routen, Typen, Zuständigkeit je Datei. Wenn etwas fehlt, gilt diese Regel: **kleiner, additiv, nur Business, Wirkung nach außen nur per Klick**.
Dazu einen Satz im Bericht schreiben, nicht raten. Für Recht gilt immer: Hinweis, keine Rechtsberatung. Der Anwalt liest die genannten Texte
einmal gegen (Liste am Schluss von Abschnitt 13).

**Grenzen (gelten für jedes Paket).** Live-Daten werden nur additiv geändert: neue Bestände und optionale Felder, nie eine Formänderung an
Vorhandenem. Es gibt keine Namen von Personen, Kunden oder Firmen und keine Preise im Code. Alle Inhalte (Skripte, Workbooks, Texte, Pakete,
Preise) sind Instanz-Daten, kommen per Import oder Editor und in der Demo-Saat erfunden. Business sieht nie Privates, Privat bekommt nichts
hiervon. Die Trennung passiert serverseitig. Nichts verlässt das Haus ohne den Klick eines Menschen.

---

## 1 · Strategie & Versprechen

### 1.1 Zweck
Fulfillment beschreibt, **wie wir liefern**. Es ist die eine Stelle für die Lieferprozesse aller Pakete. Ein Produkt (Leistung im Katalog)
bekommt **eine Prozess-Vorlage** zugewiesen, und jedes Mandat führt diese Vorlage als laufenden **Fall** aus. Daraus folgt:
1. Lieferung ist **wiederholbar**: Bausteine werden einmal gebaut und in mehreren Paketen genutzt.
2. Lieferung ist **sichtbar**: Landkarte und Cockpit zeigen, wo jeder Kunde steht und was hängt.
3. Lieferung ist **verkaufbar**: Jedes Paket ist ein eigenes Produkt mit eigenem Prozess (Plattform-Regel „einzeln verkaufbar“).

Das Modul heißt im Routen-Register `modul:fulfillment`. Bis es Modul-Lizenzen gibt, gilt das Haushalts-Tor. An die Markttraktion dockt es nur über
Kennungen an: `KreislaufId`, `mandatId`, `leistungId`, `firmaId`, `kontaktId`. Die Dateien der Markttraktion ändert es nicht, außer an den
in Abschnitt 11 genannten Stellen.

### 1.2 Die Pakete (Kevin 22:55)
Fulfillment trägt **mehrere Pakete**. Jedes ist ein Produkt mit eigener Prozess-Vorlage, und Bausteine sind über Pakete hinweg wiederverwendbar:

| Paket | Inhalt (Instanz-Daten) | Typische Bausteine |
|---|---|---|
| **P1 Vertriebsleitung auf Zeit** (Head of Sales / CSO, Transformationsprozess) | Phasen Vorlauf/Onboarding → Analyse → Diagnose → Aufbau → Recruiting (nur Prozess) → Umsetzung (operativ nur Vertrieb, inkl. Eventvertrieb) → Führung → Follow-up/Übergabe, F0–F7 | Playbook-Formular, Analyse-Agenten, Diagnosebericht, Pipeline-Definition, Skripte, Rituale |
| **P2 Sales-Systematik** (einzeln verkaufbar) | Skripte, Workbooks, Kennzahlen-Board, CRM-Workflow, Rollen Opener/Setter/Closer, Training & Abnahme | Skripte, Workbooks, Kennzahlen, Checklisten, Rollen |
| **P3 Netzwerk-Vertrieb** | Partner- und Empfehlungsvertrieb, Messen & Events; Fulfillment über die Workbooks (vor · während · nach der Messe) | Workbooks, Empfehlungs-Regeln (markiert „vor Einsatz rechtlich prüfen“), Event-Checklisten |

Die Paketnamen in dieser Tabelle sind Beschreibungen. In der Instanz heißen die Pakete so, wie der Produktkatalog sie nennt. Die Import-Dateien
(ab `vorlagen_2.json`) führen je Vorlage das Feld `pakete` mit den Daten-Schlüsseln `hos-cso`, `sales-systematik`, `netzwerk-vertrieb`; die
Import-Vorschau ordnet jedem Schlüssel einmal eine Paket-Vorlage der Instanz zu (2.7). Die Schlüssel stehen nur in den Daten, nie im Code.

### 1.3 Das Kundenversprechen (20/80, Kevin 22:15) und wie jede Funktion einzahlt
| Versprechen | Funktion | Messung (Abschnitt 1.4) |
|---|---|---|
| **Wert-Konto**: ein gemeinsames Zielbild aus Ausgangslage, Zielwerten und Datum, im Kick-off festgelegt; in jedem Report steht vorher → jetzt → Ziel. Es gibt **keine Garantie und kein Erfolgshonorar**. | Wert-Konto am Fall (Ziele aus `Mandat.ziele` plus Messreihe), Report-Abschnitt, Kunden-Ansicht | Anteil der Fälle mit festgelegtem Wert-Konto bis Kick-off + 7 Tage |
| **Sichtbarer Erfolg in 30 Tagen** | Die Diagnose liefert 3 Quick Wins, jeweils mit Frist ≤ Tag 30 | Anteil der Fälle mit ≥ 1 erledigtem Quick Win bis Tag 30 |
| **Takt + Transparenz** | Rituale (Kick-off, 15-Minuten-Wochen-Check, monatliches Steering, Quartals-Review), 2-Wochen-Report mit „erledigt · als Nächstes · **wartet auf euch**“, Kunden-Ansicht | Report-Takt eingehalten (≤ 14 Tage), Alter von „wartet auf euch“ |
| **Befähigung** | Kennzahl „läuft ohne uns“ (Kriterien je Fall), Übergabe-Checkliste; das Playbook gehört dem Kunden (Export) | erfüllte Befähigungs-Kriterien am Mandatsende |
| **Kunden-Puls** | Im Report eine Frage von 0 bis 10 plus ein Satz über einen eigenen Puls-Link. Ein schlechter Wert erzeugt einen Hinweis an die zuständige Person. | Ø Puls, Antwortquote, Zeit bis zur Reaktion bei schlechtem Wert |
| **Kreis schließen** | Wirkungsbericht (vorher/nachher) → Testimonial, Fallstudie, Empfehlung, nächste Stufe; Nachsorge 90 Tage | Anteil der Fälle mit Wirkungsbericht und ≥ 1 Folge (Empfehlung, Folgeauftrag) |

### 1.4 Erfolgsmaße für uns (Kennzahlen mit Erklärung; rein gerechnet in `lib/fulfillment/prozesse/kennzahlen.ts`)
- `ff_willkommen_24h`: Anteil der Fälle mit gesendeter Willkommensmail ≤ 24 h nach der Unterschrift (Regel `unterschriftAm`, Abschnitt 3.1).
- `ff_kickoff_tage`: Median der Tage von der Unterschrift bis zum Kick-off.
- `ff_wertkonto`: Anteil der Fälle mit Wert-Konto, das bis Kick-off + 7 Tage festgelegt ist.
- `ff_quickwin_30`: Anteil der Fälle mit ≥ 1 Quick Win, erledigt bis Tag 30.
- `ff_report_takt`: Anteil der aktiven Fälle, deren letzter Report ≤ 14 Tage alt ist (Quelle `ReportStand` der Leistungstreppe).
- `ff_wartet_alt`: ältester offener Punkt „wartet auf euch“ in Tagen (je Fall und über alle Fälle).
- `ff_puls`: Ø Puls der letzten 90 Tage und Antwortquote.
- `ff_befaehigung`: Anteil der erfüllten Befähigungs-Kriterien am Mandatsende.
- `ff_dossier_belegt`: Anteil der Dossier-Aussagen mit Quelle und Datum. Ziel 100 % [FT §2 Phase 2].
- `ff_analyse_kosten`: Kosten je Dossier (Summe der Läufe) und Dauer bis F2.
Diese Kennzahlen gehen **nicht** in den Business-Index. Das wäre eine spätere, eigene Entscheidung (Abschnitt 13).

---

## 2 · Prozessmodell „Hochhaus“

### 2.1 Begriffe
- **Prozess-Vorlage** (`ProzessVorlage`, `fp-…`) hat eine von drei Arten:
  - `landkarte`: das Hochhaus des eigenen Unternehmens. Je Instanz gibt es genau eine.
  - `paket`: die Prozess-Vorlage eines Produkts, z. B. P1–P3.
  - `ablauf`: ein Fluss mit Stufen, Übergängen und **Rückwegen**, z. B. der Vertriebsablauf eines früheren Unternehmens (2.6).
- **Knoten** (`fk-…`): ein Element einer Vorlage. Die **Ebene** ergibt sich aus der Eltern-Kette:
  1 Gesamtprozess · 2 Prozess · 3 Teilprozess · 4 Einzelschritt · 5 **Baustein** (ein Blatt, das nur auf die Bibliothek verweist).
- **Baustein** (`fb-…`): die kleinste wiederverwendbare Einheit in der **Bibliothek**, z. B. Dokument, Skript, Checkliste, Mail, Kennzahl, Ritual,
  Formular/Workbook, Analyse-Agent oder Freigabe. Ein Baustein kann in vielen Vorlagen stecken.
- **Fall**: die Ausführung einer Paket-Vorlage an **einem** Mandat (Abschnitt 7).
- **Freigabepunkt**: ein benannter Halt in einer Vorlage, an dem der Kunde und/oder wir bestätigen (F0–F7 in P1).

### 2.2 Das Hochhaus (Landkarte; neutrales Muster in `lib/fulfillment/muster.ts`, Inhalte je Instanz änderbar)
Jeder Knoten auf Ebene 2 trägt eine `zone`. Etagen tragen außerdem `kreislauf` (eine oder mehrere `KreislaufId` aus `lib/crm/planung.ts`), und
jeder Knoten kann einen `ort` haben. Ein Ort ist eine Kennung aus der Liste `ORTE` in `lib/fulfillment/orte.ts`, die über `WEG` in eine vorhandene
Seite auflöst. Gespeichert werden nie rohe Adressen. Ein Klick führt in die Seite, in der dieser Prozess heute in MAKE OS **wohnt**.

| Zone | Knoten auf Ebene 2 (Muster) | `kreislauf` | `ort` (Beispiel) |
|---|---|---|---|
| **Dach — Steuerung** | Ziele & Planung · Positionierung · Führungsrhythmus · Kennzahlen | — | `planung.business` · `produkte.positionierung` · `fokus.business` · `business.index` |
| **Etage 1** | Marketing & Sichtbarkeit | `kanaele` | `markttraktion.marketing` |
| **Etage 2** | Leads & Qualifizierung | `leads` | `markttraktion.qualifizierung` |
| **Etage 3** | Sales & Abschluss | `deals`, `followup` | `markttraktion.deals` |
| **Etage 4** | Onboarding | `fulfillment` | `fulfillment.onboarding` |
| **Etage 5** | Fulfillment: Kinder sind **Verweise** auf die Paket-Vorlagen (`verweis: fp-…`); ein Klick springt in das Paket | `fulfillment` | `fulfillment.prozesse` |
| **Etage 6** | Follow-up, Upsell, Empfehlung | `nachher`, `wiederkauf` | `markttraktion.planung` |
| **Fundament — Unterstützung** | CRM · Recruiting & Führung · Recht & Datenschutz · KI-Agenten · Finanzen | — | `markttraktion.kontakte` · `einstellungen.team` · `datenschutz` · `agenten` · `finanzen.business` |

**Je Knoten (Ebenen 1–4)** werden angezeigt: Zuständig, Eingang und Ergebnis, Kennzahl und **welcher Kunde gerade dort steht**. Die letzte Angabe
wird abgeleitet: `kundenJeKnoten(vorlage, faelle)` zählt die Fälle, deren aktueller Knoten (Regel `aktuellerKnoten`, Abschnitt 7.4) in diesem
Teilbaum liegt. Ein Verweis auf eine Paket-Vorlage zählt deren Fälle mit.

### 2.3 Die 5 Ebenen als Datenstruktur
Eine Vorlage speichert eine **flache Liste** von Knoten mit `elternId`, wie die Aufgaben-Ebenen. Es gelten diese Regeln (rein, in `lib/fulfillment/regeln.ts`):
- Höchstens 5 Ebenen. `ebeneVon(knoten, liste)` ergibt sich aus der Kette. Ein Kreis oder eine zu tiefe Kette wird beim Schreiben mit 400 abgelehnt.
- **Ebene 5 trägt immer `bausteinId` und nichts sonst** außer `titel` (Anzeige, Vorgabe = Titel des Bausteins), `rang` und `kundeSichtbar`.
  Ein Baustein hängt nie auf Ebene 1–4. Wer einen Baustein auf Ebene 3 braucht, legt einen Einzelschritt mit genau einem Baustein an.
- Geschwister werden über `rang` geordnet (lückenlos neu durchnummeriert, Vorbild `lib/aufgaben/ziehen.ts`).
- In `ablauf`-Vorlagen gibt es zusätzlich `uebergaenge` zwischen Knoten **derselben Ebene** (Art `weiter`, `rueckweg` oder `ausstieg`, optional ein
  Weichen-Text wie „erreicht?“). Kreise sind dort erlaubt, denn genau das sind Rückwege.
- Freigabepunkte stehen als Liste an der Vorlage. Ein Knoten verweist mit `freigabe: <id>` darauf.

### 2.4 Transformationsprozess P1 (Phasen, Freigaben, Kreislauf) — neutrales Muster, Inhalte als Instanz-Daten
Die Phasen folgen Kevins Liste. Die Inhalte sind aus [FT §2] zusammengeführt (Recherche-Phasen 0+1 → Vorlauf/Onboarding, 7 Optimierung → Führung)
und haben die Belegstufen [S]/[A] wie dort. Kalenderwerte sind Empfehlungen [A]. Die Rückmeldung zum Playbook ist beschlossen (22:30): Recruiting nur als
Prozess (wir besetzen nicht selbst), operativ nur im Vertrieb, Eventvertrieb gehört dazu.

| Ebene 2 (Phase) | Ziel · Warum | Eingang → Ergebnis | Kennzahl | Freigabe | Agent / Werkzeug | `kreislauf` |
|---|---|---|---|---|---|---|
| **Vorlauf / Onboarding** (Woche 0–2) | Gemeinsames Verständnis von Auftrag, Rechten und Rhythmus. Ohne geklärte Zugänge gehen 10–15 % der Mandatszeit verloren [FT §1.3, S]. | Unterschrift → Willkommen, Vereinbarung, Kick-off, Playbook, Stakeholder-Karte, Wert-Konto | Tage bis Lesezugriff, Vollständigkeit des Playbooks in % | **F0** Mandatsrahmen & Zugänge · **F1** Analyse-Umfang & Personenliste | AP Playbook-Auswertung, A0 | `fulfillment` |
| **Analyse** (Woche 1–3) | Fakten und Hypothesen für die Diagnose; die interne Daten- und Gesprächsanalyse hat vermutlich den größten Hebel [FT §6.1, A] | Firma, Domain, F1 → Dossier, Wettbewerbsmatrix, Website-Befund | Anteil der Aussagen mit Quelle (Ziel 100 %) | **F2** Dossier geprüft | A1–A13, TB | `fulfillment` |
| **Diagnose** (Woche 3–4) | Befund, Top-5-Maßnahmen, Entscheidung über die Fortsetzung | Dossier, Daten → Diagnosebericht, Priorisierung, **3 Quick Wins**, Folgeangebot | Baseline (Win Rate, Zyklus, Coverage …) [FT §4.4] | **F3** Diagnose-Abnahme | A12 (Entwurf) | `fulfillment` |
| **Aufbau** (Woche 4–10), Teilprozesse: Prozess · CRM · Skripte · Einwände · Kennzahlen · Zielgruppe & Leads | System, das ohne uns läuft | F3 → Playbook, Pipeline-Definition, CRM-Feldkonzept, Leitfäden, Einwandmatrix | Adoption, Pflichtfeldquote | **F4** Playbook & Rechtsprüfung der Ansprache-Texte | — | `fulfillment` |
| **Recruiting** (nur Prozess) | Prozess und Werkzeuge, **keine** Besetzung durch uns, **keine** Bewerberdaten in MAKE OS | Rollenbedarf → Stellenprofil, Scorecard, Interviewleitfaden, Onboarding-Plan 30/60/90 | Quote strukturierter Interviews | **F5** Profil & Vergütungsmodell (Entscheidung trifft der Kunde) | — | `fulfillment` |
| **Umsetzung** (Woche 8–22) | Pipeline und Abschlüsse durch das Team; operativ arbeiten wir nur im Vertrieb, Eventvertrieb gehört dazu | F4/F6 → Review-Rhythmus, Account-Pläne, Forecast | Coverage, Win Rate, Zyklus [FT §4.4] | **F6** Go-live Ansprache & Preisfreigaben | — | `fulfillment` |
| **Führung** | Rhythmus, Coaching, Lernen aus Gewinn und Verlust | Kennzahlen → Win/Loss-Reviews, Playbook-Versionen | Verlustgründe, Win Rate je Quelle | — | — | `fulfillment` |
| **Follow-up / Übergabe** (Woche 20–26) | Der Vertrieb läuft ohne uns; der Kreis schließt sich | Übergabekriterien → Übergabepaket, Wirkungsbericht | **„läuft ohne uns“** (Kriterien) | **F7** Übergabe-Freigabe | — | `nachher`, `wiederkauf` |

Die Freigaben F0 und F3–F7 sind **Daten der Vorlage**. F1 und F2 sind zusätzlich harte Regeln der Analyse-Strecke (Abschnitt 4.4) und stehen am Dossier.

### 2.5 P2 Sales-Systematik und P3 Netzwerk-Vertrieb (Muster nur als Gerüst, Inhalte per Import)
- **P2 (Muster):** Einführung (Statusmodell, Rollen Opener/Setter/Closer/Führung, Pipeline) · Skripte & Workbooks · Kennzahlen-Board · CRM-Workflow ·
  Training & Abnahme · Übergabe. Die Rollen stehen in `ProzessVorlage.rollen`, und ein Knoten verweist mit `rolle` darauf.
- **P3 (Muster):** Partner- und Empfehlungsprogramm (Regeln markiert „vor Einsatz rechtlich prüfen“) · Messen & Events
  (Workbook vor/während/nach; Andocken an Netzwerken und besuchte Events über `ort`: `netzwerken`, `markttraktion.events`) · Netzwerk-Rhythmus · Messung.
- Workbooks sind **Formular-Bausteine** (`art: 'workbook'`, mit `fragen`). Wenn `kundeFuellt: true` gesetzt ist, füllt der Kunde sie wie das Playbook
  über seinen Link aus (Abschnitt 5.4). Damit läuft das Fulfillment von P3 über die Workbooks.

### 2.6 Abläufe aus früheren Vertriebsprozessen — klickbar und schön visualisiert (Kevin 22:55)
- Das sind Vorlagen `art: 'ablauf'`, eingespielt als **Instanz-Daten** aus `scratchpad/wissen-sales/prozesse_zeichnen.json` (Sichtung 2, liegt vor) über den Import (2.7).
  Die Datei enthält heute **drei** Abläufe; jeder trägt eine Zeichenform:

  | Ablauf (Titel aus den Daten, neutral) | Form | Inhalt |
  |---|---|---|
  | Gruppen-Zugang: Webinar-Trichter in vier Schritten | `trichter` | Einstieg mit zwei Wegen (Leads einkaufen · Trichter bauen) → Webinar → Rückmeldung und Bedarf → Gespräch → Abschluss; Rückwege, Schleifen, Empfehlung als Kreislauf |
  | Telefon-Zyklus: Opening, Setting, Closing, Übergabe | `fluss` (drei Spalten mit Weichen) | Lead-Verwaltung, Tagesstart (Routine), Opening, Absicherung, Setting, Closing, Übergabe, Wiedervorlage, Absage, Kunde; Weichen „erreicht? Termin? Zusage? passend?“ |
  | Lieferprozess eines externen Vertriebsleiters: zehn Schritte in zwei Phasen | `zeitachse` | Phase Aufbau (5 Schritte) → Phase Umsetzung (5 Schritte), wöchentliche Schleife, Folgeauftrag zurück |

- **Abbildung** auf das Modell: `phasen` → Ebene 2, `stufen` → Ebene 2 (ohne Phasen) bzw. Ebene 3 (unter ihrer Phase). Je Stufe werden übernommen:
  `art` (einstieg · stufe · ausstieg · routine), `name` → `titel`, `zweck` → `ziel`, `rolle`, `kennzahl`, `ausgang`, `optional`, `original` (Begriff der Quelle),
  `entspricht_make` → `heute` (die heutige Stufe der Instanz) und `herkunft` → `beleg` (`quelle` | `ergaenzung`).
  Übergänge: `vorwaerts` → `weiter`, dazu `rueckweg`, `ausstieg`, `schleife`, `kreislauf`; `bedingung` → `weiche`; `herkunft` → `beleg`.
  `vorbehalt`, `quelle` (nur Kennungen wie „X19“) und `zeichenhinweis` werden als Hinweise am Ablauf gezeigt; `ein_ausstiege` wird aus Stufen und Übergängen neu
  abgeleitet, nicht gespeichert.
- **Neutral benannt:** Die Schlüssel der Datei (Prozessnamen früherer Unternehmen) werden **nie** Kennung oder Titel. Die Kennung entsteht aus dem Titel
  (`fp-imp-<titel-slug>`), Firmen- und Produktnamen erscheinen nicht.
- **Zeichnung** (Abschnitt 6.2): Trichter als gestapelte, nach unten schmalere Scheiben mit Seitenwegen; Fluss in Spalten mit Rauten als Weichen; Zeitachse mit
  Kreisen auf einer Linie, nach Phasen gruppiert. Rückwege sind Bögen, Schleifen kleine Rundpfeile, `kreislauf` führt zurück an den Anfang. Alles mit
  `beleg: 'ergaenzung'` ist **gestrichelt** (nicht aus der Quelle). Ein Klick auf eine Stufe öffnet ihren Steckbrief, ein Klick auf `heute` springt in den
  heutigen Kreislauf (Markttraktion › Planung).
- Unter „Kreislauf“ stehen die Abläufe neben dem heutigen Sales-Kreislauf. Der heutige Kreislauf **gilt** (Kevin 22:30); die früheren Abläufe sind Wissen,
  keine zweite Wahrheit. Der Lieferprozess kann per Klick „Als Paket-Vorlage übernehmen“ in eine Paket-Vorlage kopiert werden (Phasen → Ebene 2, Schritte → Ebene 3).
- Kommen mit INVENTAR_3/`vorlagen_3.json` weitere Abläufe, nimmt sie derselbe Import (gleiches Format).

### 2.7 Was im Code liegt und was Daten sind
| Im Code (neutral, `lib/fulfillment/muster.ts`, nie gespeichert, bis „Aus Muster anlegen“ geklickt wird — Vorbild `lib/aufgaben/vorlagen-start.ts`) | Instanz-Daten (Bestand `fulfillment--<haushalt>`, per Import oder Editor) |
|---|---|
| Hochhaus-Gerüst (Zonen, Knotennamen wie in 2.2, Orte, KreislaufIds) | alle Paket-Inhalte: Bausteine mit Gliederung, Texten, Fragen, Workbooks, Skripten und Kennzahl-Definitionen |
| Drei Paket-Muster nur bis Ebene 3 (Titel wie in 2.4/2.5, F0–F7 als Freigabe-Gerüst) | Namen der Pakete, Zuordnung Produkt → Vorlage |
| Onboarding-Checkliste (Abschnitt 3.2), Rituale-Gerüst (Abschnitt 5.1) | Agenda-Texte der Rituale, Mail-Vorlagen (Willkommen, Report-Zusatz), Vereinbarungs-Text |
| Playbook-Formular-Gerüst: 9 Abschnitte nach [FT §3 D1] mit je einer offenen Frage | die eigentlichen Playbook-Fragen, Workbook-Fragen |
| Regeln der Analyse (Positiv-/Negativliste, Pflichtregeln, Ausgabeschemata, Auftragskerne A0–A13): Methode, kein Instanzwissen | Zusatz-Aufträge je Agent (`agentZusatz`), LIA-Text je Dossier |
| Muster-Texte mit rechtlichem Bezug (Art.-13-Hinweis Kunden-Link, Art.-14-Hinweis, LIA-Muster); Verantwortlicher **immer** aus `verantwortlicherLaden()` | Preise: **nur** im Produktkatalog bzw. in der Treppe (Kevin 22:30), nie in Bausteinen |

**Import-Schnittstelle** (C1, Route `POST /api/fulfillment/import`):
- Angenommen werden JSON-Dateien im Format von `vorlagen.json` (`{ meta, quellenverzeichnis?, vorlagen: [...] }`), Abläufe kommen als eigene Datei im Format
  von `prozesse_zeichnen.json` (unten). **vorlagen_2.json / vorlagen_3.json** haben dasselbe Format, ihre Kennungen tragen das Präfix `s2-` bzw. `s3-`.
  Der Import erkennt das Präfix nicht eigens: Er nimmt jede Kennung `^[a-z0-9][a-z0-9-]{0,79}$` und macht daraus `fb-imp-<id>`. Damit kollidieren die
  Kennungen der Dateien nie, und ein erneuter Import derselben Datei aktualisiert statt zu verdoppeln.
- Feld-Abbildung Vorlage → Baustein:
  - `art` (dokument|skript|checkliste|mail|kennzahl) → `Baustein.art`
  - `titel`, `zweck` → gleiches Feld
  - `gliederung` → `gliederung`; `text` → `text`; `platzhalter` → `platzhalter`
  - `phase` und `unterphase` → `tags` (`phase:aufbau`, `unterphase:skripte`); `gilt_fuer` → `tags` (`fuer:cso` …)
  - `hinweis` → `hinweis`; `quelle` (nur Kennungen wie „D4“) → `herkunft.quelleIds`
- **Nie übernommen** werden:
  - `quellenverzeichnis` und alle `link`-Felder. Sie enthalten private Drive-Adressen.
  - `instanzwerte` und `instanzspezifisch`, weil darin Preise stehen. Die Vorschau zeigt sie stattdessen als Hinweis „gehört in den Produktkatalog“ mit einem Link auf `WEG.produkt()`.
- **„Vor Einsatz rechtlich prüfen“** (Kevin 22:30): Die Vorschau schlägt die Marke vor, wenn mindestens eins davon zutrifft:
  `art ∈ {skript, mail}` mit Ansprache-Bezug (`unterphase` skripte oder zielgruppe_leads, oder Telefon/Mail/Netzwerk im Titel); oder `hinweis` bzw. `zweck`
  enthalten `/recht|§\s?7|UWG|Provision|Tippgeber|Einwilligung|Kaltakquise/i`. Mit vorlagen.json trifft das heute mindestens diese:
  `skript-opening`, `skript-netzwerk-folgekontakt`, `skript-empfehlung-fragen`, `leads-recht-akquise`, `recruiting-verguetung`, `recruiting-bewerberprozess`,
  `vorlauf-mitwirkung-und-grenzen` sowie alle `mail-*`. Die Person kann die Marke je Eintrag vor dem Übernehmen setzen oder lösen.
- **Einsortieren** (optional in der Vorschau): Die Person wählt je `gilt_fuer`-Wert eine Paket-Vorlage. Der Import hängt die Bausteine dort als Ebene 5 unter
  Ebene 2 = Phase (Titel-Abgleich ohne Groß-/Kleinschreibung; fehlt die Phase, wird ein Knoten angelegt) und Ebene 3 = Unterphase. Wer nichts wählt, bekommt nur die Bibliothek.
- **Konflikte:** Wurde ein Baustein nach dem letzten Import von Hand geändert (`vonHand: true`), überschreibt ihn der Import nicht. Er steht als Konflikt in der
  Vorschau mit den Wahlen „Import nehmen“ oder „meine Fassung behalten“ (Vorbild: Masterlisten-Import „Online gewinnt“).
- **Ablauf:** erst Vorschau (schreibt nichts) → Übernehmen mit `vorschauId` (409, wenn sich der Bestand seitdem geändert hat) → Rückgängig mit `laufId`
  innerhalb von 30 Tagen. Rückgängig betrifft nur Einträge, die seitdem unverändert sind.
- **Grenzen:** Datei ≤ 4 MB (sonst 413), ≤ 400 Vorlagen und ≤ 20 Abläufe je Datei. Alles darüber wird abgelehnt, nie still gekürzt.
- **Abläufe:** Der Import nimmt zusätzlich Dateien im Format von `prozesse_zeichnen.json` an: ein Objekt `{ <schluessel>: { titel, quelle, form, zeichenhinweis[],
  phasen?: { id, name, dauer, stufen[] }[], stufen: { id, art, name, zweck, rolle, kennzahl, herkunft, schritt?, phase?, original?, entspricht_make?, ausgang?, optional? }[],
  uebergaenge: { von, nach, bedingung, art, herkunft }[], ein_ausstiege, vorbehalt? } }`. Abbildung in 2.6. Unbekannte `art` → 400 mit der Stelle.
- **Neue Felder ab `vorlagen_2.json`:** `pakete` → Tags `paket:<schluessel>` und, wenn in der Vorschau eine Paket-Vorlage je Schlüssel gewählt ist,
  Einsortieren in genau diese Vorlagen (ein Baustein kann so in mehreren Paketen stecken); `herkunft` (Satz) → `herkunftText`. Nennt `herkunft` gekauftes Material
  Dritter (`/gekauft|Urheberrecht|Seminar|Playbook eines|Workbook eines/i`), setzt die Vorschau die Marke **„vor Einsatz Urheberrecht prüfen“** (`urheberPruefen`);
  solche Bausteine zeigen beim Ausgeben an Kunden (Kunden-Link, Export, Mail) eine Rückfrage (Abschnitt 13, Frage 6).
- **Dateien, die bis heute vorliegen:** `vorlagen.json` (86), `vorlagen_2.json` (45, `s2-`), `prozesse_zeichnen.json` (3 Abläufe). Erwartet: `vorlagen_3.json` (`s3-`)
  und INVENTAR_2/3 — gleicher Weg, keine Code-Änderung nötig. Die Dateien bleiben außerhalb des Repos und werden nie committet.

---

## 3 · Onboarding-Strecke (C1, außer Kunden-Link/Playbook = C2)

### 3.1 Auslöser
- Regel `onboardingKandidaten(crm, faelle, marken, heute)` (rein, C0): Ein Mandat ist Kandidat, wenn alle Punkte zutreffen:
  - Status `aktiv` oder `angebot`
  - Gesellschaft ist eine Business-Gesellschaft (`istBusinessGesellschaft`)
  - nicht gelöscht
  - es gibt noch **keinen Fall**
  - es ist nicht ausgeblendet (Marke `onboarding-aus:<mandatId>`)
  - **und** mindestens eins davon: `vertragUnterschrieben`, ein verknüpftes Angebot `angenommen`, oder der Deal (`chanceId`) ist `gewonnen`.
- Gewonnene Deals **ohne** Mandat behandelt weiter die vorhandene Karte „Gewonnene Deals ohne Mandat“ (`ProdukteMandate.tsx`). Erst das Mandat, dann das Onboarding.
- Der Zeitpunkt der Unterschrift ergibt sich aus `unterschriftAm(mandat, crm)` (rein, C0). Reihenfolge: `angenommenAm` des verknüpften Angebots → Tag des Deal-Wechsels
  auf `gewonnen` (Historie) → `Mandat.start` → Tag, an dem der Fall angelegt wurde.
- Angezeigt wird die Karte **„Kundenonboarding starten“** in Produkte & Mandate › Mandate (Komponente `OnboardingHinweis`, C1; der Platz dafür ist in C0 eingehängt)
  und unter Fulfillment › Onboarding. Der Morgenlauf legt außerdem **einmal** je Mandat einen Stapel-Vorschlag an (Art `fulfillment`, `bezug.id = p:onboarding:<mandatId>`)
  für die zuständige Person, ohne Person für den Haushalt. Die Marke `onboarding-vorschlag:<mandatId>` verhindert doppelte Vorschläge.
- Klick „Starten“ öffnet einen Dialog: Paket-Vorlage (vorgewählt aus der Zuordnung des Produkts, sonst Wahl), Zuständig, Startdatum.
  `POST /api/fulfillment/fall { aktion: 'starten', mandatId, vorlageId, anfrageId }` legt den Fall an (Kopie, Abschnitt 7.2; idempotent über `anfrageId` mit `einmalig()`).

### 3.2 Schritte (Onboarding-Checkliste; neutrales Muster in `muster.ts`, je Vorlage änderbar)
Jeder Schritt ist ein Knoten im Teilprozess „Onboarding“ des Falls. Sein Status wird, wo möglich, **abgeleitet**:

| # | Schritt | Werkzeug in MAKE OS | Status abgeleitet aus |
|---|---|---|---|
| 1 | **Willkommen in 24 h**: Willkommensmail + Kick-off-Terminvorschläge + Playbook-Link | Karte „Willkommen“: Mail-Vorlage (Instanz-Text, Du/Sie aus der Akte) mit Platzhaltern `{{vorname}}`, `{{kickoff_vorschlaege}}`, `{{playbook_link}}`. Terminvorschläge kommen aus `freieZeitFuer` (3 Fenster, nur Zeiten) **oder** vom Link einer vorhandenen Buchungsseite. Der Playbook-Link entsteht per Aufruf von C2 (`POST /api/fulfillment/kunde { aktion: 'link-anlegen' }`); bei abgeschaltetem Schalter fehlt der Absatz. **Ein Klick „Senden“** geht über `/api/inbox/senden` (Absender = Postfach des Business-Bereichs, Art. 18 und § 7 UWG wie dort). | `Fall.onboarding.willkommenGesendetAm`, wird beim erfolgreichen Senden gesetzt. Uhr: `unterschriftAm` + 24 h, danach „überfällig“ (rot). |
| 2 | **Kick-off terminieren** + Rituale anlegen | Abschnitt 5.1 (Kalender-Dialog vorbelegt) | Termin mit `kalender-bezug.mandatId` und Ritual `kickoff` vorhanden |
| 3 | **Zusammenarbeits-Vereinbarung** (Rollen, Reaktionszeiten, was wir brauchen, Eskalation, Scope drin/draußen, Entscheidungsrechte) | Formular am Fall; Vorlagen-Text aus der Bibliothek; „im Kick-off bestätigt“ (Tag + wie) | `Fall.vereinbarung.bestaetigtAm` |
| 4 | **Kunden-Playbook** über den Link | C2 (Abschnitt 5.4) | `KundeKurz.formularProzent` |
| 5 | **Stakeholder-Karte** (Entscheider, Unterstützer, Skeptiker …) | Karte am Fall; Personen **nur** als CRM-Kontakt (`kontaktId`). Fehlt der Kontakt, wird er über „Kontakt anlegen“ im vorhandenen Weg angelegt (`person-anlegen`). | ≥ 1 Entscheider eingetragen |
| 6 | **Wert-Konto festlegen** (im Kick-off) | Abschnitt 7.5 | alle Ziele mit Ausgang, Ziel und Datum, `festgelegtAm` gesetzt |
| 7 | **Entscheidungs-Log** eröffnet | Liste am Fall | ≥ 1 Eintrag |
| 8 | **F0 bestätigt** | Freigabe vermerken (Abschnitt 7.3) | `Fall.freigaben.F0` |

Das Onboarding ist fertig, wenn die Schritte 1–3 und 5–8 erfüllt sind. Das Playbook (4) darf noch laufen. Danach wechselt `Fall.status` von `onboarding` auf `laeuft`.

### 3.3 Kick-off-Agenda
Die Agenda besteht aus der Ritual-Vorlage `kickoff` und den `kickoffFragen` des Falls (aus Diagnose/Analyse, Abschnitt 4.6, oder von Hand). Eine Mitschrift
im 4-Zeilen-Standard (Abschnitt 5.1) wird im Entscheidungs-Log und als Aufgaben übernommen, beides per Klick.

---

## 4 · Analyse-Strecke (C3)

### 4.1 Grundsätze (Kevin, Recherche §8–9, Antworten 22:30)
- Jede Analyse ist ein **Baustein mit Agent** (`Baustein.art = 'analyse'`, `analyse: AnalyseAgentId`). Ihr Stand am Fall wird aus dem Dossier **abgeleitet**, C3 schreibt nie in den Fall.
- **Jeder Lauf wird einzeln bestätigt.** Jeder Lauf hat eine Kostenschätzung und startet erst nach dem Klick auf **genau diesen** Lauf. Es gibt keinen Autostart,
  keinen Pauschalrahmen und keinen „alle starten“-Knopf. Ist ein Lauf fertig, werden abhängige Läufe nur **bereit** (mit neuer Schätzung).
- Fremdtext läuft immer durch `fremd()`. Modelle werden nur über `askText`/`askWithSearch` (KI-Tor) angesprochen. Werkzeuge gibt es nur mit Vertrag (`lib/werkzeuge/*`).
- Das **Dossier** ist ein eigenes Objekt am Mandat: fester Aufbau, Quelle und Datum je Aussage, Personenteil **getrennt** (eigener Bestand, eigene Löschfrist),
  verknüpft mit der CRM-Firmenakte (`firmaId`, Übernahme von Steckbrief-Feldern nur per Klick).
- **MAKE ist eigener Verantwortlicher** für die Personenrecherche (Kevin 22:30): berechtigtes Interesse, Interessenabwägung je Dossier dokumentiert, Art.-14-Hinweis durch MAKE.
  Der Anwalt liest die Texte einmal gegen (Liste am Schluss von Abschnitt 13).

### 4.2 Agenten, Wellen, Abhängigkeiten ([FT §9.2–9.3]; Schätzwerte [A], die Token-Verbräuche sind ungemessen)
Definition als Daten in `lib/fulfillment/analyse/agenten.ts`. Feste Felder je Agent: `id`, `name`, `welle`, `braucht`, `web` (mit Such-Schritt), `werkzeuge`, `kategorien`,
`stufe` (schnell, ausgewogen oder stark), `schaetzung` ({ tokenEin, tokenAus, suchen, seiten }), `abschnitte` (welche Dossier-Abschnitte er füllt),
`personen` (Personenbezug), `auftrag` (neutraler Kerntext). Dazu kommt optional der Instanz-Zusatz `agentZusatz[id]` (≤ 2.000 Zeichen, Daten, nie Anweisung von außen).

| Id | Name | Welle | braucht | Web | Werkzeuge (Schritt 2) | Abschnitte | Personen | Schätzung je Lauf [FT §9.3] |
|---|---|---|---|---|---|---|---|---|
| A0 | Start-Prüfer | 0 | Eingaben | nein | — (ohne Modell) | Deckblatt, Gerüst | nein | 0 $ |
| AP | Playbook-Auswertung (Head of Sales) | 0 | Playbook ≥ 1 Abschnitt | nein | `fall_unterlagen` | hypothesen, fragen | nein | ≈ 0,05–0,30 $ |
| TB | **Tiefenbericht** (Lesehilfe, Gemini) | 1 | A0 | — | — (eigener Weg, 4.7) | **keiner** (Leseteil) | nein | ≈ 1–3 $ (Max 3–7 $) |
| A1 | Unternehmens-Steckbrief | 1 | A0 | ja | `web_lesen` | unternehmen | nein | ≈ 0,3–1,2 $ |
| A2 | Register & Finanzsignale | 1 | A0 + abgelegte Register-PDFs | nein | `fall_unterlagen` | unternehmen, finanzen | nein (Geburtsdatum/Wohnort nie) | ≈ 0,05–0,3 $ |
| A5 | News & Reputation | 1 | A0 | ja | `web_lesen` | reputation, good_bad | nein | ≈ 0,3–0,8 $ |
| A7 | Außendarstellung | 1 | A0 | ja | `web_lesen` | aussen | nein | ≈ 0,2–0,8 $ |
| A8 | SEO & Sichtbarkeit | 1 | A0 | ja | `web_lesen` | aussen | nein | ≈ 0,2–0,8 $ |
| A3 | Gesellschafter & Beteiligungen | 2 | A2, **F1** | nein | `fall_unterlagen`, `dossier_teile` | gesellschafter | Funktion/Anteil nur als Verweis `pp-…` | ≈ 0,2–0,8 $ |
| A4 | Personen (nur beruflich) | 2 | A1, A2, **F1** | ja | `web_lesen` (nur erlaubte Domains) | **Personenteil** | **ja** | ≈ 0,5–1,5 $ (je Person 1 Lauf) |
| A6 | Markt & Wettbewerb | 2 | A1, Playbook | ja | `web_lesen` | markt | nein | ≈ 0,5–1,6 $ |
| A9 | Social & PR | 2 | A1, A7 | ja | `web_lesen` | aussen | nein | ≈ 0,2–0,8 $ |
| A10 | Vertriebsaufstellung & Signale | 2 | A1, A7 | ja | `web_lesen` | vertrieb | nein | ≈ 0,2–0,8 $ |
| A11 | Risiken / Red Flags | 3 | alle aus 1–2, die laufen sollen | nein | `dossier_teile` | chancen_risiken | nein (keine Daten natürlicher Personen zur Zahlungsfähigkeit) | ≈ 0,1–0,4 $ |
| A12 | Dossier-Redakteur + Diagnose-Entwurf | 3 | A11 | nein | `dossier_teile` | fazit, good_bad, hypothesen, fragen + Diagnose-Entwurf | liest nur Funktionen | ≈ 0,3–0,8 $ (Stufe stark) |
| A13 | Prüfer (Quellen + DSGVO) | 3 | A12 | nein | `dossier_teile` (inkl. Personenteil) | Prüfbericht | liest | ≈ 0,2–0,6 $ |

- **Minimalset** [FT §9.2]: A0, A1, A2, A6, A7, A12, A13. Die Seite schlägt es vor, startet es aber nicht.
- **Kosten-Rechnung** (`schaetzen(agent, dossier, messungen)`, rein):
  - Token-Preise über `kostenSchaetzen({ faehigkeit: 'text', modell, tokenEin, tokenAus })` (lib/ki/kosten.ts).
  - Suchen: 10 $ je 1.000 Suchen [FT §9.3, P-Repo MODELLE.md], umgerechnet mit `usdEurKurs()`.
  - Liegen ≥ 3 gemessene Läufe desselben Agenten vor, gilt deren **Median** statt der Vorgabe („Schätzung lernt“).
  - Angezeigt werden „ca. x €“ und „höchstens y €“ mit y = 1,5 × bestätigter Betrag. Das ist die harte Kostengrenze des Laufs (`kostenGrenzeCent` der Schleife).
- **Wiederholung:** höchstens 3 Läufe je Agent und Dossier [FT §9.1.6]. Der 4. geht nur mit Grund (≤ 300 Zeichen, steht am Lauf).
- **Gleichzeitig:** höchstens **2 laufende** Analyse-Läufe je Instanz (1 vCPU), sonst 429 „Gerade laufen schon zwei Analysen.“

### 4.3 Ein Lauf technisch (`lib/fulfillment/analyse/lauf.ts`)
1. **Start** mit `POST /api/fulfillment/analyse { aktion: 'starten', mandatId, agent, bestaetigtCent, anfrageId }` und dieser Prüfreihenfolge:
   - Zugang
   - `bauPruefen`
   - Abhängigkeiten erfüllt
   - F1 vorhanden, wo nötig
   - Web-Suche an, wo nötig (sonst Status „gesperrt: Web-Suche ist aus“ mit Link auf die KI-Schalter; nichts wird umgeschaltet)
   - Schätzung neu rechnen: ist sie größer als `bestaetigtCent`, antwortet der Server 409 `{ kostenRueckfrage, schaetzung }`
   - ≤ 2 laufend
   - ≤ 3 je Agent
   - Danach wird der Lauf `laeuft` mit Pacht (`laeuftSeit`) angelegt. Die Antwort 202 kommt sofort, die Arbeit läuft per `after()` im App-Prozess.
     Ist die Pacht älter als 10 Minuten, gilt der Lauf als `abgebrochen` („Neustart des Servers?“). Ein neuer Start braucht eine neue Bestätigung.
2. **Schritt 1 „Suchen“** (nur Agenten mit `web`): `askWithSearch` (serverseitige Web-Suche, höchstens 5 Suchen, Vorgabe des Codes) mit festem Auftrag.
   Ausgabe (JSON) ist die Kandidaten-Quellenliste `{ url, titel, warum }[]` (≤ 15) plus Notizen.
   `ki: { lauf: 'aufruf', person, kategorien: ['crm','web'], pseudonym: false }` (Begründung im Code: der Suchauftrag **ist** die Firma bzw. Person, wie in `app/api/research/route.ts`).
3. **Schritt 2 „Lesen & Auswerten“**: `schleife` (lib/agenten/schleife.ts) mit `runden: 4`, `letzteRundeOhneWerkzeuge: true`, `werkzeugBudget: 20`, `deadline: +5 min`,
   `kostenGrenzeCent` und den Werkzeugen des Agenten. Jeder Aufruf läuft durch `vertragsPruefung` → Ausführung → `ausgangVermerken`. Die letzte Runde liefert JSON nach dem
   Ausgabeschema. `ask.zweck = 'fulfillment-<agent>'`, `ask.ki = { lauf: 'aufruf', person }`, Kategorien wie in 4.5.
4. **Säubern** mit `ausgabePruefen(agent, roh)` (rein, getestet):
   - unbekannte Abschnitte und Felder fallen weg (gezählt)
   - eine Aussage **ohne** Quelle mit URL oder Unterlage wandert nach „Offene Fragen“ [FT §9.1.1]
   - URLs nur http(s), nie aus `GESPERRTE_DOMAINS`
   - Texte über den Grenzen werden abgeschnitten **und markiert** (Ausnahme vom „nie kürzen“: das ist Modell-Ausgabe, kein Bestand; die Marke `gekuerzt` ist sichtbar)
   - beim Personen-Agenten entfernt der Negativlisten-Filter Treffer (4.5) und vermerkt die **Kategorie** in `ausgelassen`
5. **Ablage**: Das Ergebnis kommt als **Entwurf** an den Lauf (`AnalyseLauf.ergebnis`). Es ändert keinen Abschnitt, bis ein Mensch „In das Dossier übernehmen“ klickt
   (je Abschnitt Häkchen, Vorbild `FreigabeFelder`). Ist eine Aussage älter als 30 Tage, wird sie als „veraltet?“ markiert [FT §9.1.7].

### 4.4 Freigaben der Analyse (hart, im Dossier)
- **F1 Analyse-Umfang & Personenliste:**
  - Die Person trägt ein: welche Agenten laufen dürfen (Umfang), welche **Funktionen** beruflich recherchiert werden dürfen (z. B. „Geschäftsführung“, „Vertriebsleitung“ — keine Namen),
    dazu „vom Kunden bestätigt am · wie (Kick-off/Mail)“.
  - Ohne F1 sperrt die Seite A3 und A4 und blendet die Personen-Karte aus.
  - Die **Interessenabwägung** (Zweck · Erforderlichkeit · Abwägung · Schutzmaßnahmen; Muster-Text [FT §8.2], je Dossier bearbeitbar) ist Pflicht für F1.
- **F2 Dossier geprüft:**
  - Nur möglich, wenn die **deterministische Prüfung** (4.5) bestanden ist. Qualitäts-Befunde des Modell-Prüfers (A13) dürfen mit Grund überstimmt werden.
    **DSGVO-Befunde nie.**
  - F2 setzt die Abschnitte auf `geprueft`. Erst dann dürfen A12-Inhalte in den Fall (Quick Wins, Kick-off-Fragen) und in die Firmenakte übernommen werden.

### 4.5 Prüfer und DSGVO (C3; `lib/fulfillment/analyse/pruefen.ts` rein + A13 als Modell)
**Deterministisch (harte Prüfung)** prüft je Aussage, Personenkarte und Dossier:
- jede Aussage hat ≥ 1 Quelle mit `url` oder `unterlageId` und `abgerufenAm`
- keine Quelle aus `GESPERRTE_DOMAINS`
- Personenkarte:
  - `identitaet !== 'niedrig'` (unsichere Zuordnung wird verworfen [FT §9.1.4])
  - kein Treffer der **Negativliste** (Muster: Geburtsdatum `\d{1,2}\.\d{1,2}\.\d{4}` im Personenteil, „wohnhaft“/„wohnt in“, Familie/Partner/Kinder,
    Gesundheit/Krankheit, Religion/Konfession, Partei/politisch, Gewerkschaft, sexuelle Orientierung, Herkunft/Ethnie, Vermögen/Immobilie/Schulden/Insolvenz einer Person)
  - Art.-14-Plan gesetzt, `loeschAm` gesetzt
- Dossier: Interessenabwägung und F1 vorhanden.

**Modell (A13)** prüft, ob Zahlen zur Quelle plausibel sind, Widersprüche und Lücken. Das sind nur Hinweise.

**Positivliste (beruflich, soweit erforderlich)** [FT §8.4]: Name, Funktion, Unternehmen, beruflicher Werdegang, beruflich relevante Ausbildung, Veröffentlichungen, Vorträge, Interviews,
öffentliche Aussagen zum Geschäft, berufsbezogene Verbandsmitgliedschaften, geschäftliche Beteiligungen und Mandate aus öffentlichen Registern.

**Negativliste:** wie oben; dazu private Social-Media-Profile, Namen Dritter aus Bewertungs-Freitexten und **nichts aus dem Transparenzregister** [FT §8.5].

**`GESPERRTE_DOMAINS`** (Code, `lib/fulfillment/analyse/quellen.ts`): `linkedin.com`, `xing.com`, `handelsregister.de`, `unternehmensregister.de`, `transparenzregister.de`,
`insolvenzbekanntmachungen.de`. `web_lesen` lehnt sie ab, der Such-Schritt verwirft sie, A13 meldet sie. Register-Auszüge legt ein **Mensch** als PDF ab (Aufgabe aus A0);
A2 liest die Unterlage [FT §8.5]. LinkedIn sieht nur ein Mensch manuell an und trägt Stichpunkte als TXT-Unterlage mit `zweck: 'notiz'` ein (interne Unterlage, Route `fulfillment/kunde/datei`).

**Art. 14** [FT §8.3, P]:
- Je Personenkarte gilt die Uhr `faelligAm = erfasstAm + 1 Monat`, bzw. die erste Mitteilung an die Person.
- Hinweistext: Muster mit `{{verantwortlicher}}` (aus `verantwortlicherLaden()`) und `{{herkunft}}` (Quellen-Domains), Vorbild `ART14_STANDARD` (lib/datenschutz/art14.ts).
- Vermerk „gegeben am · wie (Kick-off/Mail/erster Kontakt)“. Ist die Karte mit einem CRM-Kontakt verknüpft (`kontaktId`), läuft der Hinweis über den vorhandenen
  CRM-Weg (`art14-entwurf`/`art14-raus`), und die Karte zeigt dessen Stand.
- Der Morgenlauf meldet Fristen („bald“ ab Tag 25) als Stapel-Hinweis an die zuständige Person.

**Löschfrist Personenteil** (Kevin 22:30: Standard): **Mandatsende + 90 Tage**, als Zeile `fulfillment-personen` in der Löschfristen-Tabelle einstellbar (30–365 Tage).
Danach entfernt der Lauf die Karten, und am Dossier bleibt nur der Vermerk „Personenteil gelöscht am … (n Karten)“ ohne Namen. Ist eine Person CRM-Kontakt,
gelten für den Kontakt die CRM-Fristen; die Karte wird trotzdem gelöscht.

**KI-Kategorien ehrlich:**

| Lauf | Kategorien |
|---|---|
| Unternehmens-Agenten | `['crm','web']` |
| A2, AP, A11–A13 | `['crm']` |
| A4 | `['crm','web']` mit `pseudonym: false` und KI-Protokoll-Zweck `fulfillment-a4-personen` |
| TB | über `anbieterTor`, Fähigkeit `tiefenbericht` |

Keine Kategorie ist `allgemein` [FT §9.5 L8].

**Recruiting:** keine Bewerberdaten, kein Agent für Kandidaten (beschlossen 22:30). Interviewleitfaden und Scorecard gibt es nur als Baustein-Vorlage.

### 4.6 Dossier-Aufbau und Diagnose-Entwurf ([FT §9.4])
Abschnitte (`AbschnittId`):
- `deckblatt` (berechnet: Mandat, Stand, Version, Löschdatum des Personenteils, Quellenstand)
- `fazit`, `unternehmen`, `gesellschafter`, `markt`, `aussen`, `vertrieb`, `reputation`, `finanzen`, `chancen_risiken`, `good_bad`, `hypothesen`, `fragen`, `quellen` (berechnet), `recht` (LIA, Art.-14-Plan, Prüfbericht).

Der **Personenteil** liegt getrennt (`fulfillment-personen--*`) und wird nur über die Personen-Route gelesen.

A12 liefert außerdem den **Diagnose-Entwurf**: Top-5-Maßnahmen (Wirkung · Aufwand · Evidenz A/B/C · Abhängigkeit · Hebel, Methode [FT §6.3]), **3 Quick Wins mit Frist ≤ Tag 30**
und **Fragen fürs Kick-off** (an Gründer, Entscheider, Vertrieb; je Frage: warum, welche Lücke).

Übernahme in den Fall nur nach F2 und per Klick, über die **Route von C1** (`PATCH /api/fulfillment/fall` mit den Ops `quickwins-setzen` und `kickoff-fragen`, Form in C0).

**Firmenakte:** Je Steckbrief-Feld (Domain, Webseite, Branche, Mitarbeiter, Stadt, gegründet, Rechtsform) gibt es „In die Firmenakte übernehmen“ über den vorhandenen
CRM-Schreibweg (`/api/crm/bestand` PATCH `teil` mit Stand). Das ist ein Klick, nie automatisch.

### 4.7 Tiefenbericht (Kevin 22:30)
- In Welle 1 wird er als **eigener Lauf** vorgeschlagen. Die Frage entsteht aus einem neutralen Muster mit Firma, Branche und Domain; die Person kann sie ändern (≤ 2.000 Zeichen).
- Schätzung über `kostenSchaetzen({ faehigkeit: 'tiefenbericht', modell })`. Start nur per Klick mit `kiTiefenberichtStarten({ ki: { lauf: 'aufruf', person, kategorien: ['crm','web'] }, frage, bestaetigtCent })`
  (lib/ki/aufruf.ts). Die Regeln in lib/ki/tiefenbericht.ts bleiben **unverändert**.
- Das Dossier speichert nur den Verweis `leseteil: { id: 'tb-…', person, gestartetAm }`. Den Leseteil „**Tiefenbericht — nur für dich**“ zeigt eine eigene Route (Klasse `person`):
  - **nur** der auslösenden Person
  - mit den Suchvorschlägen in einem abgeschotteten iframe (`sandbox=""`) und den Quellen
  - gelesen über die neue Datei `lib/ki/leseteil.ts` (C3, **in** lib/ki). Der Wächter `tests/ki-anbieter-tor.test.ts` bleibt grün: Außerhalb von lib/ki steht weder
    `tiefenberichtFuer`, `ki-tiefenbericht` noch ein Import von `lib/ki/tiefenbericht`.
- Er geht **nie** an Agenten, Synthese (A12), Prüfer, Brain, Suche oder ZOE. Wächter: Kein Modul unter `lib/fulfillment/**` außer der Leseteil-Route importiert `lib/ki/leseteil`.
- Nach 30 Tagen (Frist des Tiefenberichts) zeigt der Verweis „abgelaufen“.

### 4.8 Web-Fetch mit Schutz (`web_lesen`, C3; `lib/fulfillment/analyse/web-lesen.ts`)
- Nur `http:`/`https:`, nur Port 80/443, keine Zugangsdaten in der URL.
- **DNS einmal auflösen und prüfen.** Abgelehnt werden Loopback, privat, link-lokal, CGNAT, Multicast, IPv6 ULA/link-lokal sowie IPv4-mapped. Die Prüfung `ipIntern` wird aus
  `lib/postfach/transport.ts` nach `lib/netz/oeffentlich.ts` verschoben, und beide nutzen sie.
- Danach **mit genau dieser Adresse verbinden** (eigenes `lookup`, gegen DNS-Rebinding).
- Höchstens 3 Weiterleitungen, jede wird neu geprüft.
- Zeitgrenzen: Verbinden 5 s, insgesamt 15 s. Größe: höchstens 2 MB, sonst Abbruch.
- Nur `text/html`, `application/xhtml+xml`, `text/plain`, `application/pdf` (Text über `textAuslesen`). HTML wird **nur zu Text** über `htmlZuText` (lib/gmail/html.ts):
  keine Skripte, Bilder nie geladen, Links als „Text (Adresse)“.
- GET ohne Cookies und ohne Formulare. User-Agent `MAKE-OS-Recherche/1.0 (+<MAKE_OS_ADRESSE>)`. `robots.txt` wird beachtet (Disallow für `*` und den eigenen Agenten).
- Höchstens 1 Abruf je Sekunde und Host, höchstens 20 Abrufe je Lauf.
- **Erlaubte Ziele je Lauf (gegen Prompt-Injection):** die Domain(s) des Mandats und ihre Subdomains, URLs aus Schritt 1 dieses Laufs und URLs, die der Mensch in den Eingaben genannt hat.
  Alles andere wird mit `rechte` abgelehnt.
- Antwort ≤ 30.000 Zeichen je Aufruf („Teil x von y“, weiter mit `teil`). Die Kopfzeile (URL, Datum, Zeichenzahl) steht außerhalb, der Inhalt in `fremd()`.
- Seiten werden **nicht gespeichert**. Im Dossier stehen nur Aussagen mit URL und Abrufdatum.

### 4.9 Werkzeuge mit Vertrag (C3)
Neue Agenten-Werkzeuge (`herkunft: 'agent'`) in `lib/werkzeuge/einordnung.ts`. Die Schemas stehen in `lib/fulfillment/analyse/werkzeug-defs.ts` und werden in `lib/werkzeuge/register.ts` aufgenommen.

| Werkzeug | Rechte | Bereich | fremd | gekapselt | Kategorie | Was |
|---|---|---|---|---|---|---|
| `web_lesen` | lesen | business | `web` | ja | `web` | 4.8 |
| `fall_unterlagen` | lesen | business | `mandat-unterlagen` | ja | `crm` | Liste bzw. Text **freigegebener** Unterlagen und die Formular-Antworten **dieses** Mandats (über C2 `unterlagenFuer`/`unterlageText`/`formularAntwortenFuer`) |
| `dossier_teile` | lesen | business | `dossier` | ja | `crm` | fertige Abschnitte **dieses** Dossiers; den Personenteil nur für A11–A13; den Leseteil nie |

Diese Werkzeuge bietet **nur** der Analyse-Handler an, nie ZOE oder die Heads.

Zusätzlich gibt es das ZOE-Werkzeug **`fulfillment_lage`** (z('lesen', { fremd: 'fulfillment', gekapselt: true }), Gruppe `crm`, Business). Es liefert Überblick über Fall,
Onboarding-Stand, Wert-Konto und Dossier-Unternehmensteil eines Mandats und gibt Kevins „alle Daten in der KI“ eine Lesetür. Den Personenteil liefert es nur, wenn der Aufruf
`mitPersonen: true` trägt und die Person den Personenteil sehen darf. Den Leseteil liefert es nie.

---

## 5 · Takt, Reports, Kunden-Ansicht

### 5.1 Rituale (C1)
- Ritual-Vorlagen in der Bibliothek (`RitualVorlage`). Das Muster nennt die Rituale und Rhythmen, die Texte sind Instanz-Daten:
  - **Kick-off** (einmal, 90 Min.)
  - **Wochen-Check** (15 Min., wöchentlich)
  - **Steering** (60 Min., monatlich)
  - **Quartals-Review** (120 Min., quartalsweise)
  Quelle der Rhythmen: [FT §7.2] und Kevin.
- **„Termine anlegen“** öffnet den vorhandenen Kalender-Anlege-Dialog, vorbelegt mit Titel, Dauer, Wiederholung, Bezug `mandatId` (`kalender-bezug`) und Gästen aus der Stakeholder-Karte (Kontakte).
  Der Dialog schreibt über `/api/kalender/termin`. Gäste gibt es nur über die vorhandene Rückfrage `EinladungFrage`. **Es gibt keinen neuen Schreibweg in den Kalender.**
  Der Fall merkt sich `rituale[].terminUids`.
- **Mitschrift im 4-Zeilen-Standard** (Kevin 22:30): **Anlass · Ergebnis · nächster Schritt · Frist**, kein Freitext über Personen. Daraus kommen per Klick ein Eintrag im
  Entscheidungs-Log bzw. eine Aufgabe (`/api/tasks/create` mit `bezug.mandatId`).

### 5.2 2-Wochen-Report (C2; erweitert den vorhandenen Fortschritts-Report der Leistungstreppe)
- `ReportDokument` (lib/crm/treppe-report.ts) bekommt **optionale** Felder:
  - `wartetAufEuch: string[]`
  - `wertKonto: { name, vorher, jetzt, ziel, bis? }[]`
  - `puls?: { wert, am }`
  - `pulsFrage?: boolean`

  Gefüllt werden sie aus `reportZusatzFuer(mandatId, heute)` (C2): Fall über `fallLesen`, Regeln `wartetAufEuch`/`wertKontoZeilen` aus C0, Puls aus dem eigenen Bestand.
  **Ohne Fall bleiben Dokument, PDF und Mail Byte für Byte wie heute** (Schnappschuss-Test).
- Die Spalten heißen im PDF und in der Mail **Erledigt · Als Nächstes · Wartet auf euch · Wert-Konto (vorher → jetzt → Ziel) · Kunden-Puls**.
- Die Mail bleibt die vorhandene Vorlage („ich wollte dich gerade updaten …“, Du/Sie aus der Akte). Neu ist nur, bei aktivem Kunden-Link, der Satz mit der **Puls-Frage**
  und dem **Puls-Link** (eigenes Token, 5.5).
- **Versand nur auf Klick**: Vorschau (Text, PDF, Empfänger) → **ein Klick „Senden“**. Der Browser macht dann nacheinander „PDF erstellen“ (vorhanden) → `/api/inbox/senden` mit Anhang
  → `report-gesendet` vermerken; danach ist keine Handarbeit mehr nötig („automatisiert nach dem Klick“). Puls-Anfrage und Puls-Token entstehen **erst beim Senden**.

### 5.3 Wirkungsbericht und Nachsorge (C1)
- **Wirkungsbericht** am Mandatsende (bzw. vor F7) enthält:
  - Wert-Konto vorher/nachher
  - erledigte Quick Wins, Lieferobjekte, Befähigungs-Kriterien „läuft ohne uns“ (Vorschlag [FT §2 Phase 8, A]: ≥ 2 Abschlüsse ohne Gründerteilnahme, Coverage ≥ Ziel über 4 Wochen,
    Rhythmen 4 Wochen ohne uns gelaufen, Pflichtfeldquote ≥ Zielwert; je Fall änderbar)
  - optional ein Kundenzitat, nur mit vermerkter Einwilligung (Tag, wie)

  Er wird als PDF erzeugt (pdf-lib, `lib/fulfillment/prozesse/wirkung-pdf.ts`), verschlüsselt im Ordner `fulfillment-unterlagen` abgelegt und nur per Klick versendet (Inbox).
- Folgen als Knöpfe, alles per Klick:
  - Testimonial anfragen → Aufgabe
  - Fallstudie → Baustein-Entwurf, anonymisiert, außer es gibt eine Einwilligung
  - Empfehlung erfragen → Follow-up über `/api/crm/followup`
  - Nächste Stufe → vorhandener Stapel-Vorschlag `naechste_stufe` der Treppe
  - Die „nach der Leistung“-Marken der Markttraktion-Planung (`nachLeistung`) werden **angezeigt und über die vorhandene Op abgehakt**, nie doppelt gespeichert.
- **Nachsorge 90 Tage:** Nach `mandatsEnde` legt der Morgenlauf an Tag +14, +45 und +90 je einen Stapel-Vorschlag an (Check-in, Empfehlung bzw. nächste Stufe).
  Die Marken `nachsorge:<mandat>:<tag>` verhindern Doppelte. Freigabe → Follow-up bzw. Aufgabe.

### 5.4 Kunden-Ansicht und Kunden-Link (öffentlicher Weg, C2) — **kommt ausgeschaltet**
**Zwei Schlüssel müssen an sein, sonst antwortet jeder öffentliche Weg 404 mit demselben Text:**
1. Umgebung `MAKE_OS_KUNDENLINK=an`, gesetzt vom Betrieb erst nach der Prüfung in 12.4.
2. Schalter der Instanz `einstellungen.kundenLink.an`, umlegen nur durch den Inhaber per Sitzung, mit Erklärung.

Teilrechte je Link sind `formular` (Playbook/Workbooks), `upload` und `puls`. **`upload` ist je neuem Link AN** (Kevin 10.10., 23:25: Upload freigegeben — nur sichere Dateitypen, am INHALT geprüft, verschlüsselt, nur als Download, kein Virenscanner), **je Link abschaltbar**. Der ganze Kunden-Link kommt trotzdem ausgeschaltet (Umgebung + Instanz-Schalter).

**Adresse und Token:**
- Öffentliche Kennung `kl-<24 hex>` (96 Bit, `randomBytes(12)`) im Pfad.
- Geheimes Token (256 Bit, `randomBytes(32)` base64url) **nur im Fragment** `#t=…`. Es landet nie in Server-Logs, nie im Referer, nie in Proxies.
- Im Bestand liegt nur `tokenHash = sha256('make-os-kunde|' + token)`. Der Vergleich ist zeitkonstant (`timingSafeEqual`).
- Die Seite liest das Fragment und schickt das Token als Kopf `x-kunde-token`.
- Je Mandat gibt es **einen** aktiven Link; ein neuer widerruft den alten.
- Ablauf: Vorgabe 90 Tage, verlängerbar, nie über Mandatsende + 30 Tage.
- Das Token zeigt der Server **genau einmal** in der Antwort von `link-anlegen` (für die Willkommensmail bzw. „Kopieren“). Danach nie wieder; „neu erzeugen“ widerruft.

**Middleware** (C0, `middleware.ts`, nach dem Muster `BUCHUNG_OFFEN`, Köpfe gelöscht, nie als jemand):
```
KUNDE_OFFEN = [/^\/kunde\/kl-[a-f0-9]{24}$/, /^\/api\/kunde\/kl-[a-f0-9]{24}(\/(formular|upload|puls))?$/]
```
- Seite nur GET; API-Wurzel nur GET; `formular`, `upload` und `puls` nur POST.
- Für die Origin-Prüfung gibt es keine Ausnahme: Die Formulare senden von der eigenen Seite.

**Köpfe** (C0, `next.config.mjs`): `/kunde/:pfad*` und `/api/kunde/:pfad*` bekommen dieselbe strenge Richtlinie wie die Buchung (no-referrer, noindex, no-store, keine Rahmen,
CSP ohne fremde Quellen).

**Drossel** (`lib/zugang/drossel.ts`, je Netz `adresseNetz`):
- Lesen `kunde-lesen:<netz>` (großzügig)
- Fehlgriffe `kunde:<netz>` (unbekannt, falsches Token, abgelaufen, aus — alle zählen)
- je Link: Formular 120/h, Puls 5/Tag, Upload 30/h

**Formulare:** signierter Stempel (HMAC mit `sitzungsGeheimnis`, Zweck `kunde-formular`, ≥ 3 s und ≤ 12 h, weil Kunden lange Formulare füllen), Honigtopf `webseite`.
Honigtopf- und Zeitfehler bekommen denselben Text.

**Größen:**

| Was | Grenze |
|---|---|
| Formular-POST | ≤ 64 KB (413) |
| Antwort je Frage | ≤ 4.000 Zeichen |
| Puls-Satz | ≤ 500 Zeichen |
| Upload je Datei | ≤ 25 MB |
| Upload je Link | ≤ 20 Dateien und ≤ 200 MB [FU §7 S2] |

**Upload:**
- Typ am **Inhalt** über `aufgabenTypErkennen` (PDF, PNG, JPG, WEBP, HEIC, DOCX/XLSX/PPTX ohne Makros, CSV, TXT); SVG, ZIP und ausführbare Dateien nie.
- Name serverseitig gesäubert, gespeichert unter der Kennung `ud-<uuid>` im Ordner `fulfillment-unterlagen` über `bildAblegen` (verschlüsselt, AAD = Ordner/Name).
- Bilder ohne Exif/GPS (`lib/netzwerken/bild-bereinigen.ts`).
- Status `ungeprueft`, bis ein Mensch die Datei intern als `freigegeben` markiert. Erst dann sieht `fall_unterlagen` (KI) sie.
- Intern gibt es Download **nur als Anhang** (`nosniff`, CSP `sandbox`), nie inline gerendert.
- Die zuständige Person bekommt eine **neutrale** Meldung („Neue Unterlagen zu „<Mandat-Titel>“ eingegangen“) ohne Dateinamen [FU §7 S8].

**Was der Kunde sieht** (`kundenSicht(fall, mandat, kunde, vorlage)`, rein, C2; Positivliste der Schlüssel, Wächter):
- Mandat-Titel, Firmenname, Paketname
- Zeitstrahl der Ebene-2-Knoten mit `kundeSichtbar` (erledigt · aktuell · kommt)
- „Erledigt (letzte 14 Tage)“, „Als Nächstes“, „**Wartet auf euch**“
- Wert-Konto (vorher → jetzt → Ziel)
- Rituale (Name + Rhythmus, **keine** Kalenderdaten)
- Entscheidungen mit `geteilt: true`
- Formulare zum Ausfüllen mit den **eigenen** bisherigen Antworten
- Upload-Feld mit „n Dateien eingegangen“ (**keine Liste**, [FU §7 S3])
- Puls-Formular, wenn eine Anfrage offen ist
- Datenschutzhinweis (Art. 13; Verantwortlicher aus `verantwortlicherLaden()`, Fassung zählt hoch)

**Was er NIE sieht:** Stakeholder-Karte, Haltungen, Notizen, interne Knoten, Health/Ampel, Zahlungen, Honorar, Rechnungen, Dossier, Personenteil, Leseteil, Kosten, andere Mandate,
Dateiliste, Namen oder Adressen unseres Teams, Kennungen anderer Bestände.

**Playbook gehört dem Kunden:** Intern gibt es „Antworten exportieren (PDF/CSV)“, damit wir sie ihm geben können. Über den Link selbst gibt es keinen Export (nur Ansicht).

### 5.5 Kunden-Puls (C2)
- Eine Puls-Anfrage (`pa-…`) entsteht beim Senden eines Reports (5.2) oder von Hand. Sie hat ein **eigenes Token** (Fragment `#p=…`), ist 14 Tage gültig und nimmt eine Antwort an.
  Mit diesem Token zeigt die Seite **nur** das Puls-Formular. Ein weitergeleiteter Report öffnet also nie Playbook oder Uploads.
- Antwort: Wert 0–10 plus optional ein Satz (≤ 500).
- Ist der Wert ≤ `einstellungen.pulsSchwelle` (Vorgabe 6, einstellbar, mit Erklärung), folgt:
  - `melde()` an die zuständige Person, Art `produkte`, neutraler Text „Kunden-Puls zu „<Mandat-Titel>“ braucht Aufmerksamkeit“, ohne Wert
  - ein Stapel-Vorschlag „Gespräch anbieten“ → Follow-up
- Intern gibt es „In die Health übernehmen“ (Klick): `Mandat.health.stimmung = wert × 10` über den CRM-Schreibweg mit Stand. Die vorhandene Zufriedenheits-Ampel rechnet
  unverändert weiter (`kundenAmpel`).

---

## 6 · Visualisierung und Cockpit

### 6.1 Regel (Vorbild Lichtfäden)
Gerechnet wird **nur** in reinen Funktionen. Die Komponenten zeichnen und rechnen nichts. Am Rechner gibt es SVG, am Handy (< 720 px) eine Liste. Bei reduzierter Bewegung
bleibt alles still. Bausteine kommen aus `components/os/ui`, Farben aus `lib/make-one/design.ts`.

### 6.2 Landkarte und Ablauf-Bild (C1)
- `lib/fulfillment/prozesse/landkarte.ts`: `landkarteLage(vorlage, zaehler, breite) → { kaesten: { id, x, y, b, h, titel, zone, anzahl, ampel?, href }[], pfeile }`.
  Das Hochhaus: Dach oben (eine Reihe), Etagen gestapelt (1 = unten über dem Fundament, Kreislauf-Reihenfolge von unten nach oben), Fundament als breite Reihe.
- Ein Klick öffnet die Drill-down-Ansicht `?u=prozesse&k=<knoten>` mit Brotkrumen über die Ebenen und dem Steckbrief des Knotens (Zuständig, Eingang/Ergebnis, Kennzahl, Kunden dort mit Links in den Fall).
- `lib/fulfillment/prozesse/ablauf-bild.ts`: `ablaufLage(vorlage, breite) → { form, stufen: { id, x, y, b, h, titel, art, gestrichelt, href? }[], kanten: { art, pfad, weiche, gestrichelt }[] }`,
  je `form` eigene Lage (trichter · fluss · zeitachse, 2.6; `baum` = gestaffelte Liste). Im Fluss stehen Stufen in Spalten, `weiter` sind gerade Pfeile,
  `rueckweg` Bögen unterhalb, `ausstieg` rechts gestrichelt. Weichen-Texte stehen an den Kanten.

### 6.3 Mandats-Cockpit (C1)
`GET /api/fulfillment/cockpit` fasst je aktivem Fall zusammen:
- Kunde, Paket, aktuelle Phase (Ebene 2), Fortschritt %
- nächster Schritt, „wartet auf euch“ (Anzahl, ältester)
- Health-Ampel (vorhandenes `kundenZeilen`/`kundenAmpel`), Report fällig
- Puls (C2 `kundeKurzFuer`), Analyse-Stand (C3 `dossierKurzFuer`)
- Onboarding-Stand, nächster Ritual-Termin (nur `kalender-bezug`)
- Kapazität: Aufwand je Woche gegen freie Stunden (vorhandene Treppen-Kapazität)

Ansicht „**Was hängt**“ zuerst: überfällige Willkommensmails, überfällige Freigaben, „wartet auf euch“ > 7 Tage, Puls ≤ Schwelle, Report > 14 Tage, Art.-14-Frist bald.

### 6.4 Kunden-Ansicht-Vorlage (C2)
Die öffentliche Seite und die interne Vorschau nutzen **dieselbe** Komponente `KundenAnsicht` mit demselben serverseitig gefilterten Objekt.
`GET /api/fulfillment/kunde/vorschau?m=` liefert genau das, was der Kunde bekäme („So sieht der Kunde es“).

---

## 7 · Zuordnung Produkte ↔ Fulfillment ↔ Mandat

### 7.1 Produkt → Vorlage
- `VorlagenDatei.zuordnung[leistungId] = { vorlageId }`: je Produkt **eine** Paket-Vorlage; eine Vorlage darf mehreren Produkten dienen. Die Zuordnung steht im Fulfillment-Bestand.
  Das CRM (`Leistung`) bleibt unverändert, dadurch gibt es beim Rückweg keine Verluste.
- Im Fulfillment wird der Produktkatalog nur **gelesen** (`ladeCrm`). Unter Produkte zeigt eine Zeile je Produkt „Fulfillment: <Vorlage> ›“ (C1; in `Produkte.tsx` nur ein Einhänger, Abschnitt 11).
- Brücken zum Vorhandenen (je optional, nur Kennungen):
  - Ein Ebene-2-Knoten einer Paket-Vorlage trägt `phaseId` (= `Leistung.phasen[].id`).
  - Ein Baustein trägt `lieferobjekt` (= ein Lieferobjekt der Treppen-Stufe des Produkts, exakter Text).

### 7.2 Kopie oder Verweis? — **Struktur als Kopie, Vorlagen-Texte als Verweis**
- Beim Start kopiert der Fall die **Struktur**: Knoten mit Titel, Ziel, Ergebnis, Kennzahl, Zuständig, Freigabe, `kundeSichtbar`, `phaseId`, `bausteinId`, Rang.
  Er merkt sich `vorlageId` und `vorlageFassung`.
- Begründung:
  1. Der Kunde sieht den Plan (Kunden-Ansicht, Report). Er darf sich nicht still ändern, nur weil jemand die Vorlage für künftige Kunden verbessert.
  2. Ein Fall braucht eigene Anpassungen (Schritt entfällt, Zusatz-Schritt), ohne die Vorlage zu verbiegen.
  3. Fortschritt hängt an Knoten-Kennungen. Eine gelöschte Vorlage darf laufende Fälle nicht beschädigen.
- **Lange Texte** (Gliederung, Skript, Fragen) liest der Fall dagegen **live** aus der Bibliothek über `bausteinId`. Sie sind unser Werkzeug, und es soll die beste aktuelle Fassung gelten.
  Fehlt ein Baustein, zeigt der Knoten „Baustein entfernt“.
- Ausnahme Formulare: Antworten werden mit der `fassung` des Formular-Bausteins gespeichert. Fragen bleiben über die Kennung (`frageId`) stabil.
- **Neue Fassung der Vorlage:** Der Fall zeigt „Vorlage geändert (Fassung n → m)“. `vorlagenDiff(fall, vorlage)` (rein) liefert neue, geänderte und entfernte Knoten.
  „Übernehmen“ fügt neue Knoten hinzu und übernimmt Titel und Felder geänderter Knoten. Erledigte oder entfallene Knoten werden nie entfernt. Alles per Klick.
- **Live-Daten:** Alles ist neu (eigene Bestände). Mandate ohne Fall verhalten sich **genau wie heute**.

### 7.3 Freigabe Schritt für Schritt
- Knoten-Status: `offen` · `in_arbeit` · `wartet_kunde` · `erledigt` · `entfaellt` (mit Grund).
- Knoten mit `freigabe` werden nur über „Freigabe vermerken“ erledigt: Datum, interne Person, `kunde: { wie: 'kickoff'|'mail'|'link'|'termin', am }`, Notiz im 4-Zeilen-Standard.
- Die nächste Phase darf vor der Freigabe der vorherigen beginnen; dann erscheint ein Hinweis, aber keine Sperre. **Ausnahme:** F1 und F2 der Analyse sind hart (4.4).

### 7.4 Fortschritt fließt in das Vorhandene
Regeln (rein, C0 `regeln.ts`):
- `fallFortschritt`: Anteil der erledigten Knoten auf Ebene 4 und 5; `entfaellt` zählt nicht.
- `aktuellerKnoten`: der erste nicht erledigte Ebene-2-Knoten in Rang-Reihenfolge, darin der erste offene Einzelschritt.

Wirkung in einem Klick (C1, `fallSchreiben`):
1. Fall-Bestand ändern (Sperre, Stand).
2. Wenn sich der aktuelle Ebene-2-Knoten ändert und er `phaseId` trägt: `Mandat.phase` über `aendereCrm` (Teil-Änderung) setzen, nur wenn die neue Phase im Ablauf des Produkts **später** liegt.
3. Wenn ein erledigter Baustein `lieferobjekt` trägt: `treppeSchreiben([{ op: 'lieferobjekt', mandatId, was, erledigt: true }])` (idempotent).

Die Schritte 2 und 3 sind idempotent. Schlägt einer fehl, zeigt der Fall „nicht nachgezogen — erneut“; ein Absichtsprotokoll ist nicht nötig, weil nichts halb bleibt.
Damit rechnen die vorhandene **Lieferungen-Ampel**, „aktueller Schritt“, der Report und der Kreislauf (`fortschrittFuerKreislauf`) ohne Änderung mit.

### 7.5 Wert-Konto
- Die **Ziele bleiben in `Mandat.ziele`** (Text, `ziel`, `ist`; vorhanden, eine Wahrheit für „was ist das Ziel“).
- Der Fall ergänzt je Ziel-Kennung `wertKonto[zielId]`: Ausgang (Text und optional Zahl), Zielzahl, Einheit, Richtung, `zielBis`, `festgelegtAm`, Messreihe.
- Eine neue Messung schreibt im selben Klick `Mandat.ziele[i].ist` (formatierter Wert) über den CRM-Weg. So bleibt der heutige Report-Wert richtig.
- Ein neues Ziel legt zuerst die Zeile in `Mandat.ziele` an (CRM `teil` mit Stand), dann den Wert-Konto-Eintrag.
- Die Treppe hat ein „Zielbild“ (unsere Umsatz- und Kundenziele je Stufe). Das ist **etwas anderes** und bleibt unberührt. Das Wert-Konto ist das Zielbild **des Kunden**.

---

## 8 · Datenmodell

### 8.1 Bestände (alle Bereich **business**, Liste `IN_BUSINESS`; Haushalt = `haushaltDesInhabers()`, Name über `fulfillmentSpeicherFuer(art, h)` in `lib/fulfillment/speicher.ts`)
| Bestand | Inhalt | Register | Art. 15 / 17 | Frist |
|---|---|---|---|---|
| `fulfillment--<h>` | Vorlagen (Landkarte, Pakete, Abläufe), Bibliothek, Rituale, Zuordnung, Agent-Zusätze, Einstellungen, Import-Läufe, Marken | `mit(H(…))`, `bezug: haushalt`, `behandlung: ausgenommen`, `kategorie: ['vertraulich']` (Geschäftswissen); Rechtsgrundlage Art. 6 Abs. 1 lit. b/f; Personen nur als Speichername | Konten des Haushalts sehen alles unter Fulfillment; Konto löschen tilgt den Speichernamen | bis der Haushalt löscht |
| `fulfillment-faelle--<h>` | je Mandat der Fall: Knoten-Kopie und Status, Freigaben, Onboarding, Vereinbarung, **Stakeholder (kontaktId + Rolle/Haltung/Notiz)**, Entscheidungen, Rituale, Mitschriften, Quick Wins, Kick-off-Fragen, Wert-Konto, Befähigung, Wirkung, Nachsorge | `mit(T(…), …)` `bezug: dritte`, `behandlung: tilgen`; lit. b (Vertrag mit dem Kunden), lit. f (Führung des Mandats) | Art. 15: Stakeholder-Einträge der Person (Rolle, Haltung, Notiz) über `lib/fulfillment/auskunft.ts`; Art. 17: `WEITERE_SPEICHER` `tilgen` (kontaktId → „[gelöscht]“, Notiz → leer) | Haltung und Notiz: Mandatsende + 12 Monate (`fulfillment-mandatsdaten`); sonst so lange wie das Mandat |
| `fulfillment-kunde--<h>` | Kunden-Links (nur Hash), Formular-Antworten, Puls-Anfragen (nur Hash) und Antworten, Unterlagen-Metadaten | `mit(E(…), …)` `bezug: dritte`, `behandlung: entfernen`; lit. b; Art. 13 durch Hinweis auf der Seite | Art. 15: Antworten und Unterlagen-Metadaten, die die Person nennen; Art. 17: `eintraegeRaus` über Nennung | Antworten und Puls-Sätze: Mandatsende + 12 Monate; Unterlagen: Mandatsende + 90 Tage (`fulfillment-unterlagen`), außer sie wurden als Beleg übernommen |
| `fulfillment-dossiers--<h>` | je Mandat das Dossier (Unternehmensteil, Quellen, Läufe mit Kosten und Entwürfen, F1/F2, Interessenabwägung, Prüfbericht, Leseteil-Verweis, Diagnose-Entwurf) | `mit(T(…), …)` `bezug: dritte` (Firma; Personen nur als `pp-…`); lit. f | Art. 17: `tilgen`; Läufe-Entwürfe mit Personenbezug fallen mit dem Personenteil | Entwürfe von Läufen: 90 Tage nach Lauf; sonst so lange wie das Mandat |
| `fulfillment-personen--<h>` | berufliche Personenkarten je Mandat, Art.-14-Stand, `loeschAm`, Vermerke gelöschter Karten (nur Anzahl) | `mit(E(…), …)` `bezug: dritte`, `behandlung: entfernen`; **Art. 6 Abs. 1 lit. f, LIA je Dossier; Art. 14 durch MAKE als Verantwortlicher** | Art. 15: Karte(n), die die Person nennen (Name/kontaktId), über `auskunft.ts`; Art. 17: `eintraegeRaus('karten')` | **Mandatsende + 90 Tage** (`fulfillment-personen`, einstellbar 30–365) |
| Datei-Ordner `fulfillment-unterlagen` (`BILD_ORDNER`) | Kunden- und interne Unterlagen, Wirkungsbericht-PDF | über die Metadaten in `fulfillment-kunde--*` | wie die Metadaten | wie oben |

**Neue Löschfristen** in `LOESCHFRISTEN` (lib/crm/loeschfristen.ts):

| Kennung | Vorgabe | Spanne | Wirkung |
|---|---|---|---|
| `fulfillment-personen` | 90 Tage nach Mandatsende | 30–365 | automatisch |
| `fulfillment-unterlagen` | 90 Tage nach Mandatsende | 30–3650 | automatisch, außer Beleg |
| `fulfillment-mandatsdaten` | 12 Monate nach Mandatsende | 3–120 Monate | automatisch: Formular-Antworten, Puls-Sätze, Stakeholder-Haltung und -Notiz |

`mandatsEnde(m)` (rein, C0) = `m.ende`, wenn der Status `beendet` ist; sonst `geloeschtAm`; sonst null. Wird ein Mandat endgültig gelöscht, fallen sein Fall, seine Kunden-Daten,
sein Dossier und sein Personenteil im Fristen-Lauf weg.

**Neue Lese-Bereiche** (`lib/store/leseprotokoll.ts`): `fulfillment` („Mandate & Dossiers“) und `personenrecherche` („Personenteil der Dossiers“).

### 8.2 Kennungen
| Kennung | Bedeutung |
|---|---|
| `fp-` | Vorlage |
| `fk-` | Knoten |
| `fb-` | Baustein; Import: `fb-imp-<quell-id>` |
| `fr-` | Ritual-Vorlage |
| `fi-` | Import-Lauf |
| `fs-` | Stakeholder |
| `fe-` | Entscheidung |
| `fn-` | Mitschrift |
| `fq-` | Quick Win |
| `fx-` | Kick-off-Frage |
| `kl-<24 hex>` | Kunden-Link (öffentlich) |
| `pa-` | Puls-Anfrage |
| `pu-` | Puls |
| `ud-` | Unterlage |
| `al-` | Analyse-Lauf |
| `da-` | Aussage |
| `dq-` | Quelle |
| `pp-` | Personenkarte |

Kennungen werden über `neueKennung(präfix)` vergeben, nie mit `Date.now()`. Muster-Kennungen `fp-muster-*`/`fk-muster-*`/`fb-muster-*` stehen nur im Code und bekommen beim Anlegen neue Kennungen.

### 8.3 Typen (C0: `lib/fulfillment/typen.ts`; client-sicher, nur Typ-Importe)
```ts
import type { KreislaufId } from '@/lib/crm/planung';

export const FULFILLMENT_VERSION = 1;
export type Zone = 'dach' | 'etage' | 'fundament';
export type ProzessArt = 'landkarte' | 'paket' | 'ablauf';
export type Zustaendig = 'intern' | 'kunde' | 'beide';
export interface Herkunft { art: 'muster' | 'import' | 'hand' | 'demo'; datei?: string; quelleIds?: string[]; importLauf?: string; am: string }

export interface ProzessKnoten {
  id: string; elternId?: string; titel: string; rang: number;
  zone?: Zone; kreislauf?: KreislaufId[]; ort?: string; verweis?: string;          // Landkarte
  ziel?: string; warum?: string; eingang?: string; ergebnis?: string; kennzahl?: string;
  zustaendig?: Zustaendig; rolle?: string; dauerTage?: number; aufwandStunden?: number;
  freigabe?: string; kundeSichtbar?: boolean; phaseId?: string;
  bausteinId?: string;                                                              // NUR Ebene 5 (dort Pflicht)
  heute?: string; werkzeuge?: string[]; dokumentation?: string;                     // Ablauf-Stufen
  art?: 'einstieg' | 'stufe' | 'ausstieg' | 'routine'; optional?: boolean; ausgang?: string; original?: string;
  beleg?: 'quelle' | 'ergaenzung';                                                 // ergaenzung = gestrichelt
}
export interface Uebergang { von: string; nach: string; art: 'weiter' | 'rueckweg' | 'ausstieg' | 'schleife' | 'kreislauf'; weiche?: string; beleg?: 'quelle' | 'ergaenzung' }
export interface Freigabepunkt { id: string; titel: string; wer: Zustaendig }
export interface Rolle { id: string; titel: string; aufgabe?: string }
export interface ProzessVorlage {
  id: string; art: ProzessArt; titel: string; beschreibung?: string;
  form?: 'baum' | 'trichter' | 'fluss' | 'zeitachse';   // Zeichenform (Ablauf); fehlt = baum
  quelleHinweis?: string; vorbehalt?: string; zeichenhinweise?: string[];
  knoten: ProzessKnoten[]; uebergaenge: Uebergang[]; freigaben: Freigabepunkt[]; rollen: Rolle[];
  fassung: number; herkunft?: Herkunft; geaendert: string; geaendertVon: string;
}

export type BausteinArt = 'aufgabe' | 'dokument' | 'skript' | 'checkliste' | 'mail' | 'kennzahl' | 'ritual' | 'formular' | 'workbook' | 'analyse' | 'freigabe';
export type AnalyseAgentId = 'a0' | 'ap' | 'tb' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'a8' | 'a9' | 'a10' | 'a11' | 'a12' | 'a13';
export interface Frage { id: string; abschnitt?: string; frage: string; art: 'text' | 'langtext' | 'zahl' | 'auswahl' | 'ja-nein'; optionen?: string[]; pflicht?: boolean; hilfe?: string }
export interface Baustein {
  id: string; art: BausteinArt; titel: string;
  zweck?: string; warum?: string; ergebnis?: string; kennzahl?: string; hinweis?: string;
  gliederung: string[]; text?: string; platzhalter: string[];
  fragen?: Frage[];                    // formular | workbook
  kundeFuellt?: boolean;               // formular | workbook über den Kunden-Link
  wer: Zustaendig; kundeSichtbar: boolean;
  lieferobjekt?: string; analyse?: AnalyseAgentId; ritualId?: string;
  rechtPruefen?: { seit: string; grund: string };                // „vor Einsatz rechtlich prüfen“
  rechtGeprueft?: { am: string; von: string; notiz: string };
  urheberPruefen?: { seit: string; grund: string };              // „vor Einsatz Urheberrecht prüfen“ (Material Dritter)
  herkunftText?: string;
  tags: string[]; vonHand?: true; herkunft?: Herkunft;
  fassung: number; geaendert: string; geaendertVon: string;
}
export type Rhythmus = 'einmal' | 'woche' | 'zwei-wochen' | 'monat' | 'quartal';
export interface RitualVorlage { id: string; titel: string; rhythmus: Rhythmus; dauerMin: number; agenda: string[]; teilnehmende: ('intern' | 'entscheider' | 'tagesverantwortlich' | 'team')[]; geaendert: string; geaendertVon: string }
export interface FulfillmentEinstellungen { kundenLink: { an: boolean; am?: string; von?: string }; pulsSchwelle: number; willkommenStunden: number; nachsorgeTage: number[] }
export interface ImportLauf { id: string; am: string; von: string; datei: string; neu: string[]; geaendert: { id: string; vorher: Baustein | ProzessVorlage }[] }
export interface VorlagenDatei {
  version: number; prozesse: ProzessVorlage[]; bausteine: Baustein[]; rituale: RitualVorlage[];
  zuordnung: Record<string, { vorlageId: string }>; agentZusatz: Partial<Record<AnalyseAgentId, string>>;
  einstellungen: FulfillmentEinstellungen; importLaeufe: ImportLauf[]; marken: Record<string, string>;
}

export type KnotenStatus = 'offen' | 'in_arbeit' | 'wartet_kunde' | 'erledigt' | 'entfaellt';
export interface FallKnoten extends Pick<ProzessKnoten, 'id' | 'elternId' | 'titel' | 'rang' | 'ziel' | 'ergebnis' | 'kennzahl' | 'zustaendig' | 'freigabe' | 'kundeSichtbar' | 'phaseId' | 'bausteinId' | 'dauerTage'> {
  status: KnotenStatus; seit?: string; faelligAm?: string; erledigtAm?: string; erledigtVon?: string; grund?: string; extra?: true;
}
export interface Vereinbarung { rollen?: string; reaktionszeiten?: string; wirBrauchen?: string; eskalation?: string; scopeDrin?: string; scopeDraussen?: string; entscheidungsrechte?: string; bestaetigtAm?: string; bestaetigtWie?: 'kickoff' | 'mail' | 'termin' }
export interface Stakeholder { id: string; kontaktId: string; rolle: 'entscheider' | 'unterstuetzer' | 'skeptiker' | 'nutzer' | 'einkauf' | 'sponsor'; einfluss: 1 | 2 | 3; haltung?: 'positiv' | 'neutral' | 'kritisch'; notiz?: string }
export interface Entscheidung { id: string; am: string; titel: string; inhalt?: string; status: 'offen' | 'entschieden' | 'verworfen'; wer: Zustaendig; frist?: string; geteilt: boolean; von: string }
export interface Mitschrift { id: string; ritualId?: string; am: string; anlass: string; ergebnis: string; naechster: string; frist?: string; von: string }
export interface WertKontoEintrag { ausgang?: string; ausgangZahl?: number; zielZahl?: number; einheit?: string; richtung?: 'hoch' | 'runter'; zielBis?: string; festgelegtAm?: string; messungen: { am: string; wert: number; quelle: 'hand' | 'kunde' }[] }
export interface Fall {
  mandatId: string; vorlageId: string; vorlageFassung: number;
  gestartetAm: string; gestartetVon: string; status: 'onboarding' | 'laeuft' | 'pausiert' | 'abgeschlossen';
  knoten: FallKnoten[];
  freigaben: Record<string, { am: string; von: string; kunde?: { wie: 'kickoff' | 'mail' | 'link' | 'termin'; am: string }; notiz?: string }>;
  onboarding: { willkommenGesendetAm?: string; willkommenVon?: string };
  vereinbarung?: Vereinbarung; stakeholder: Stakeholder[]; entscheidungen: Entscheidung[];
  rituale: { ritualId: string; terminUids: string[]; angelegtAm: string }[]; mitschriften: Mitschrift[];
  quickWins: { id: string; text: string; bis: string; erledigtAm?: string; quelle: 'analyse' | 'hand' }[];
  kickoffFragen: { id: string; frage: string; an: 'gruender' | 'entscheider' | 'vertrieb'; warum?: string; quelle: 'analyse' | 'hand'; erledigt?: true }[];
  wertKonto: Record<string, WertKontoEintrag>;                                         // Schlüssel = Mandat.ziele[].id
  befaehigung: { id: string; text: string; erfuellt: boolean; am?: string }[];
  wirkung?: { erstelltAm: string; dateiName?: string; zitat?: { text: string; einwilligungAm: string; wie: string } };
  marken: Record<string, string>; geaendert: string; geaendertVon: string;
}
export interface FaelleDatei { version: number; faelle: Record<string, Fall> }

export interface KundenLink { id: string; mandatId: string; tokenHash: string; erstelltAm: string; erstelltVon: string; ablaufAm: string; status: 'aktiv' | 'widerrufen' | 'abgelaufen'; rechte: { formular: boolean; upload: boolean; puls: boolean }; zuletztAm?: string; hinweisFassung: string }
export interface FormularStand { mandatId: string; bausteinId: string; fassung: number; antworten: Record<string, string>; fertig: string[]; geaendertAm: string; quelle: 'kunde' | 'intern' }
export interface PulsAnfrage { id: string; mandatId: string; tokenHash: string; erstelltAm: string; offenBis: string; beantwortetAm?: string }
export interface Puls { id: string; mandatId: string; am: string; wert: number; satz?: string; anfrageId?: string; quelle: 'link' | 'hand' }
export interface Unterlage { id: string; mandatId: string; name: string; typ: string; groesse: number; am: string; herkunft: 'kunde' | 'intern'; linkId?: string; von?: string; zweck: 'register' | 'playbook' | 'notiz' | 'sonstig'; status: 'ungeprueft' | 'freigegeben' | 'gesperrt'; beleg?: true }
export interface KundeDatei { version: number; links: KundenLink[]; formulare: FormularStand[]; pulsAnfragen: PulsAnfrage[]; puls: Puls[]; unterlagen: Unterlage[] }

export type AbschnittId = 'fazit' | 'unternehmen' | 'gesellschafter' | 'markt' | 'aussen' | 'vertrieb' | 'reputation' | 'finanzen' | 'chancen_risiken' | 'good_bad' | 'hypothesen' | 'fragen' | 'recht';
export interface Quelle { id: string; url?: string; unterlageId?: string; titel?: string; domain?: string; abgerufenAm: string }
export interface Aussage { id: string; text: string; art: 'fakt' | 'schaetzung' | 'hypothese'; quellen: string[]; stand: string; agent: AnalyseAgentId | 'hand'; personRef?: string; veraltet?: true; gekuerzt?: true }
export interface Abschnitt { id: AbschnittId; aussagen: Aussage[]; tabelle?: { spalten: string[]; zeilen: { werte: string[]; quellen: string[] }[] }; status: 'leer' | 'entwurf' | 'geprueft'; stand?: string }
export type LaufStatus = 'bereit' | 'laeuft' | 'fertig' | 'fehler' | 'abgebrochen' | 'uebernommen' | 'verworfen';
export interface AnalyseLauf { id: string; agent: AnalyseAgentId; status: LaufStatus; schaetzungCent: number; bestaetigtCent: number; grenzeCent: number; kostenCent?: number; gestartetAm?: string; gestartetVon?: string; laeuftSeit?: string; fertigAm?: string; fehler?: string; grund?: string; ergebnis?: unknown; versuch: number }
export interface Massnahme { id: string; text: string; hebel: 'zufluss' | 'umwandlung' | 'zyklus' | 'dealwert' | 'bindung'; wirkung: string; aufwand: 'klein' | 'mittel' | 'gross'; evidenz: 'A' | 'B' | 'C'; abhaengig?: string }
export interface Dossier {
  mandatId: string; firmaId?: string; version: number;
  eingaben: { firma: string; domains: string[]; registerNr?: string; sitz?: string; branche?: string; urls: string[] };
  f1?: { am: string; von: string; umfang: AnalyseAgentId[]; funktionen: string[]; kundeBestaetigtAm?: string; wie?: 'kickoff' | 'mail' };
  interessenabwaegung?: { zweck: string; erforderlichkeit: string; abwaegung: string; schutz: string; am: string; von: string };
  abschnitte: Partial<Record<AbschnittId, Abschnitt>>; quellen: Quelle[]; laeufe: AnalyseLauf[];
  pruefung?: { am: string; bestanden: boolean; befunde: { art: 'dsgvo' | 'quelle' | 'qualitaet'; text: string; bezug?: string; ueberstimmt?: { von: string; grund: string } }[] };
  f2?: { am: string; von: string };
  leseteil?: { id: string; person: string; gestartetAm: string };
  diagnose?: { top5: Massnahme[]; quickWins: string[]; fragen: { frage: string; an: 'gruender' | 'entscheider' | 'vertrieb'; warum: string }[] };
  personenGeloescht?: { am: string; anzahl: number }[];
  geaendert: string; geaendertVon: string;
}
export interface DossierDatei { version: number; dossiers: Record<string, Dossier> }
export interface PersonenKarte {
  id: string; mandatId: string; funktion: string; name: string; kontaktId?: string; rolleSeit?: string;
  werdegang: Aussage[]; themen: Aussage[]; auftritte: Aussage[]; aufhaenger: Aussage[];
  identitaet: 'hoch' | 'mittel' | 'niedrig'; ausgelassen: string[]; quellen: Quelle[];
  art14: { faelligAm: string; gegebenAm?: string; wie?: 'kickoff' | 'mail' | 'erster-kontakt'; von?: string };
  erfasstAm: string; loeschAm?: string; status: 'entwurf' | 'geprueft';
}
export interface PersonenDatei { version: number; karten: PersonenKarte[] }

// Schnittstellen zwischen den Paketen (Signaturen in den Stub-Dateien, Abschnitt 11):
export interface FallKurz { mandatId: string; status: Fall['status']; phase?: string; fortschritt: number; naechster?: string; wartet: number; wartetAeltesterTage?: number; onboardingOffen: number; willkommenUeberfaellig: boolean }
export interface KundeKurz { link: 'keiner' | 'aktiv' | 'abgelaufen' | 'widerrufen' | 'aus'; formularProzent: number | null; ungepruefteUnterlagen: number; letzterPuls?: { wert: number; am: string }; pulsOffen: boolean }
export interface DossierKurz { vorhanden: boolean; f1: boolean; f2: boolean; laeufe: Partial<Record<AnalyseAgentId, LaufStatus>>; kostenCent: number; art14Bald: number }
```
**Grenzen** (`lib/fulfillment/grenzen.ts`, darüber 413, nie gekürzt):

| Was | Grenze |
|---|---|
| Vorlagen | 60 |
| Knoten je Vorlage | 400 |
| Übergänge je Ablauf | 200 |
| Bausteine | 1.500 |
| Gliederung | 80 Punkte |
| Text | 30.000 Zeichen |
| Fragen je Formular | 150 |
| Rituale | 30 |
| Fälle | 500 |
| Knoten je Fall | 600 |
| Stakeholder | 60 |
| Entscheidungen | 500 |
| Mitschriften | 1.000 |
| Messungen je Ziel | 104 |
| Links | 1.000 |
| Formular-Stände | 3.000 |
| Puls | 10.000 |
| Unterlagen | 5.000 |
| Dossiers | 500 |
| Aussagen je Abschnitt | 200 |
| Quellen je Dossier | 600 |
| Läufe je Dossier | 80 |
| Personenkarten | 2.000 |
| Ops je Anfrage | 60 |

Textgrenzen je Feld stehen in `TEXT_MAX` (Titel 120, Notiz 300, Ziel/Ergebnis 1.000 …).

### 8.4 Schreibwege
Jeder Bestand wird **nur** über `fulfillmentAendern(art, mut, wer)` geschrieben (C0, `lib/fulfillment/speicher.ts`): `updateJson` in einer Sperre, `protokolliereBestand` ohne Werte,
unverändert bedeutet kein Schreiben. Änderungen kommen als **Einzel-Ops mit Stand je Eintrag** (`eintragStand` = Fingerabdruck), bei fremdem Stand folgt 409 mit `konflikte` und dem aktuellen Stand.
Alles oder nichts. Unsinn ergibt 400, Grenzen 413. Rein und je Paket gibt es `<bestand>Anwenden(datei, ops, kontext)` wie bei `treppeAnwenden`.
**Lesen schreibt nie**, auch nicht beim ersten Aufruf: Leere Bestände ergeben `leer…()`.

---

## 9 · Routen

Klasse `modul:fulfillment` (Tor `imHaushaltDesInhabers`) für alle internen Routen. Schreiben nur per Sitzung (Dienstweg 403), `bauPruefen`, `jsonBegrenzt`.
Lese-Protokoll `leseZugriff` überall, wo Personen Dritter stehen. `ROUTEN_BEREICH`: `fulfillment` → business, `kunde` → business.
**C0 legt jede Datei als Stub an** (Tor-Zeile + `501 { fehler: 'kommt mit Paket Cx' }`; öffentliche Stubs `404`), damit das Routen-Register von Anfang an stimmt. Die Pakete füllen ihre Dateien.

| Route (unter `app/api/`) | Methoden | Klasse | Paket | Zweck / Besonderes |
|---|---|---|---|---|
| `fulfillment` | GET, PATCH | modul:fulfillment | C1 | GET: Vorlagen, Bibliothek (Kurzform; lange Texte nur `?baustein=`), Rituale, Zuordnung, Einstellungen, Onboarding-Kandidaten, Kennzahlen. PATCH: Ops (Vorlage/Knoten/Übergang/Baustein/Ritual/Zuordnung/Agent-Zusatz/Einstellungen/aus-Muster/recht-geprueft). **Kunden-Link-Schalter nur Inhaber** (`nurInhaber` → sonst 403). `?space=privat` → 403 (Middleware). |
| `fulfillment/import` | POST | modul:fulfillment | C1 | `vorschau` · `uebernehmen` (vorschauId) · `rueckgaengig` (laufId); ≤ 4 MB |
| `fulfillment/fall` | GET, POST, PATCH | modul:fulfillment | C1 | GET `?m=`: Fall + Vorlagen-Diff + abgeleitete Stände; Lese-Protokoll `fulfillment` (Stakeholder). POST `starten` (anfrageId), `vorlage-uebernehmen`. PATCH Ops (`knoten-status`, `knoten-extra`, `freigabe`, `vereinbarung`, `stakeholder`, `entscheidung`, `ritual-merken`, `mitschrift`, `quickwins-setzen`, `kickoff-fragen`, `wert-ziel`, `wert-messung`, `befaehigung`, `willkommen-gesendet`, `onboarding-aus`) |
| `fulfillment/cockpit` | GET | modul:fulfillment | C1 | Zusammenfassung je Fall (6.3) |
| `fulfillment/wirkung` | GET, POST | modul:fulfillment | C1 | POST erzeugt PDF (Ablage `fulfillment-unterlagen`); GET `?m=` liefert das PDF als Anhang |
| `fulfillment/kunde` | GET, POST | modul:fulfillment | C2 | GET `?m=`: Link-Stand (nie Token), Formulare, Puls, Unterlagen-Metadaten; Lese-Protokoll `fulfillment`. POST: `link-anlegen` (Token einmal in der Antwort) · `widerrufen` · `verlaengern` · `rechte` · `puls-anfrage` · `puls-hand` · `puls-uebernehmen` (→ Health) · `unterlage-status` · `formular-intern` · `export` |
| `fulfillment/kunde/datei` | GET, POST, DELETE | modul:fulfillment | C2 | interne Unterlage hochladen (multipart, gleiche Prüfung) · Download nur als Anhang · Entfernen (nicht bei `beleg`) |
| `fulfillment/kunde/vorschau` | GET | modul:fulfillment | C2 | genau die Kunden-Sicht (6.4) |
| `kunde/[link]` | GET | **offen** | C2 | Kunden-Sicht; Kopf `x-kunde-token` oder `x-kunde-puls` (dann nur Puls) |
| `kunde/[link]/formular` | POST | **offen** | C2 | Antworten eines Abschnitts (Stand je Formular, 409), Stempel, Honigtopf, ≤ 64 KB |
| `kunde/[link]/upload` | POST | **offen** | C2 | eine Datei je Anfrage (`begrenztLesen`), nur mit `rechte.upload` |
| `kunde/[link]/puls` | POST | **offen** | C2 | Wert + Satz (Puls-Token) |
| `fulfillment/dossier` | GET, POST | modul:fulfillment | C3 | GET `?m=`: Dossier ohne Personenteil, Lese-Protokoll `firmen`. POST: `anlegen` · `eingaben` · `f1` · `lia` · `uebernehmen` (Lauf → Abschnitte, Häkchen) · `verwerfen` · `pruefen` (deterministisch) · `ueberstimmen` (nur Qualität) · `f2` · `aussage-hand` · `firma-uebernehmen` · `nach-fall` (ruft C1-Route-Logik nicht, sondern gibt dem Browser die Ops zurück) |
| `fulfillment/analyse` | GET, POST | modul:fulfillment | C3 | GET `?m=`: Läufe, Zustände, **Schätzung je Lauf**. POST: `starten` (agent, bestaetigtCent, anfrageId) · `abbrechen` · `tiefenbericht` (frage, bestaetigtCent) |
| `fulfillment/personen` | GET, POST | modul:fulfillment, Tor zusätzlich `personenteilZugang` (Inhaber oder Mitglied **ohne** `finanzRecht: 'business'`, sonst 403) | C3 | Personenkarten · `pruefen` · `art14` · `verknuepfen` (kontaktId) · `loeschen`; Lese-Protokoll `personenrecherche` |
| `fulfillment/dossier/leseteil` | GET | **person** (Tor `personDerSitzung`) | C3 | nur die Person, die den Tiefenbericht ausgelöst hat; sonst 404 |

**Öffentliche Wege** stehen in `OFFEN_ERLAUBT` (tests/routen-register.test.ts, C0) mit genau ihren Methoden. Die Middleware-Regex liegt in `middleware.ts`, der Wächter in `tests/fulfillment-kunde-middleware.test.ts` (C2).
Die Routen handeln für niemanden (Köpfe gelöscht) und drosseln selbst. Sie suchen den Link in `fulfillment-kunde--<inhaber-haushalt>`.
Unbekannter Link, falsches Token, abgelaufen, Schalter aus und Recht aus ergeben **dieselbe** Antwort 404 `{ ok: false, fehler: 'Dieser Link ist nicht (mehr) gültig.' }`.

---

## 10 · Seiten und Navigation

- **Produkte & Mandate** (`/os/mandate`): Die Segmente oben heißen **Mandate · Produkte · Fulfillment**. „Fulfillment“ führt auf die **eigene Seite** `/os/mandate/fulfillment` (C0: `ProdukteMandate.tsx`).
  Die Leiste bekommt keinen neuen Punkt; `passt: ['/os/mandate']` trifft die Unterseite schon.
- **Fulfillment-Seite** `app/os/mandate/fulfillment/page.tsx` → `components/os/fulfillment/FulfillmentSeite.tsx` (C0-Rahmen). Gleicher Kopf mit Segmenten, darunter die **Unternavigation** `u`:
  **Prozesse** (Standard: Landkarte + Paket-Vorlagen + Drill-down `k`) · **Bausteine** (Bibliothek, `b` öffnet einen, Import) · **Onboarding** (Kandidaten, laufende Onboardings) ·
  **Analysen** (alle Dossiers, Kosten, Fristen) · **Kreislauf** (heutiger Sales-Kreislauf + Abläufe, Zuordnung der Etagen) · **Visualisierung** (Landkarte groß, Cockpit, Kunden-Ansicht-Vorlage).
- **Fall** `?m=<mandatId>&r=` mit Reitern **Überblick** · **Ablauf** · **Wert-Konto** · **Menschen & Entscheidungen** · **Takt** (C1) · **Kunde & Reports** (C2) · **Analyse** (C3).
  Aus der Mandatsakte und aus „Fortschritt im Paket“ führt je ein Link „Fulfillment öffnen ›“ dorthin.
- **Adressen nur über `WEG`** (C0; Bau-Hilfe `lib/fulfillment/adresse.ts`, rein):
  - `WEG.fulfillment(u?: FulfillmentBereich, p?: { k?: string; b?: string })`
  - `WEG.fall(mandatId: string, r?: FallReiter)`
  - `WEG.dossier(mandatId)` = `WEG.fall(m, 'analyse')`

  Leser: `fulfillmentAusAdresse(searchParams)` (ungültige Werte fallen weg). Alte Links gibt es nicht.
- **Schnellsuche** (`lib/make-one/seiten.ts`, C0): `fulfillment` („Produkte & Mandate · Fulfillment (Prozesse)“), `fulfillment-bausteine`, `fulfillment-onboarding`, `fulfillment-analysen`,
  `fulfillment-kreislauf`, `fulfillment-visualisierung`; alle `space: 'business'`.
- **Öffentliche Seite** `app/kunde/[link]/page.tsx` (C2) liegt außerhalb von `/os`. C0 nimmt `kunde` in `ERLAUBT` von `tests/aufraeumen.test.ts` auf (wie `buchen`, `abmelden`).
- **Erklärungen mit Fallbeispiel** an jedem Schalter und jeder Kennzahl (Pflicht, Wächter `tests/erklaerungen.test.ts`). Je Paket gibt es eine Datei, die C0 leer anlegt und in `lib/erklaerungen/index.ts` einhängt;
  danach gehört sie dem Paket:
  - `lib/erklaerungen/fulfillment-prozesse.ts` (C1): `fulfillment.vorlageAusMuster`, `fulfillment.importRechtPruefen`, `fulfillment.fortschritt`, `fulfillment.wartetAufEuch`, `fulfillment.wertKonto`,
    `fulfillment.befaehigung`, `fulfillment.willkommen24h`, `fulfillment.freigabe` und die Kennzahlen aus 1.4.
  - `lib/erklaerungen/fulfillment-kunde.ts` (C2): `fulfillment.kundenLink` (an/aus, Datenweg), `fulfillment.kundenLinkFormular`, `fulfillment.kundenLinkUpload`, `fulfillment.kundenLinkPuls`,
    `fulfillment.pulsSchwelle`, `fulfillment.pulsInHealth`.
  - `lib/erklaerungen/fulfillment-analyse.ts` (C3): je Agent `AgentText` (tut · nie · Beispiel), `fulfillment.laufBestaetigen` (Kosten und Datenweg), `fulfillment.f1`, `fulfillment.f2`,
    `fulfillment.tiefenbericht` (Google, nur für dich), `fulfillment.personenteil`, `fulfillment.loeschfristPersonen`.
- Design: `components/os/ui` (Seite, Karte, Knopf mit `haupt` — eine Hauptaktion je Ansicht, Hinweis, Leerzustand, Segmente/Reiter, Zeile, Schalter mit `erklaerung`). Keine Literale; Handy zuerst bei der Kunden-Seite.

---

## 11 · Arbeitspakete

**Eigentum an Dateien:** Was ein Paket anlegt oder unten als „ändert“ führt, gehört nur ihm. Ordner-Regel:
- `lib/fulfillment/*.ts` (oberste Ebene), `components/os/fulfillment/*.tsx` (oberste Ebene) und alle gemeinsamen Dateien gehören **C0**.
- `lib/fulfillment/prozesse/**`, `components/os/fulfillment/prozesse/**` gehören **C1**.
- `lib/fulfillment/kunde/**`, `components/os/fulfillment/kunde/**`, `app/kunde/**`, `app/api/kunde/**`, `app/api/fulfillment/kunde/**` gehören **C2**.
- `lib/fulfillment/analyse/**`, `components/os/fulfillment/analyse/**`, `app/api/fulfillment/{dossier,analyse,personen}/**` gehören **C3**.

Ein Paket ändert **keine** Datei eines anderen. Braucht es dort etwas, nutzt es die Schnittstelle (Stub-Signatur bzw. Route) oder schreibt einen Satz in den Bericht. Neue Tests heißen
`tests/fulfillment-<paket>-*.test.ts` (C0: `fulfillment-fundament-*`).

### C0 — Fundament (zuerst; baut und merged der Koordinator; ≈ 9–11 h)
**Neu:**
- `lib/fulfillment/typen.ts` (8.3) · `grenzen.ts` (Grenzen, `TEXT_MAX`, Kennungs-Regex) · `lesen.ts` (Säuberer `vorlagenAus`, `faelleAus`, `kundeAus`, `dossiersAus`, `personenAus` und `leer…()`;
  robust, Unlesbares fällt weg, nie Absturz) · `adresse.ts` · `orte.ts` (`ORTE` → WEG; jede Kennung löst in eine vorhandene Seite auf) · `muster.ts` (2.7 links; nur neutrale Titel) ·
  `regeln.ts` (rein: `ebeneVon`, `kinderVon`, `teilbaum`, `kreisBei`, `fallFortschritt`, `aktuellerKnoten`, `wartetAufEuch`, `wertKontoZeilen`, `pulsStufe`, `mandatsEnde`, `unterschriftAm`,
  `onboardingKandidaten`, `kundenJeKnoten`)
- `speicher.ts` (Server: `fulfillmentSpeicherFuer`, `fulfillmentLesen`, `fulfillmentAendern`, `eintragStand`) · `zugang.ts` (`fulfillmentZugang(req, { schreiben?, inhaber? })`, `personenteilZugang`)
- Hub-Dateien, die die Paket-Stubs aufrufen: `morgenlauf.ts`, `fristen-server.ts`, `auskunft.ts`, `stapel.ts` (`FULFILLMENT_STAPEL_ART`: Verteilung nach `bezug.id`-Präfix `p:`/`k:`/`a:`)
- Stubs mit **fester Signatur** (gehören danach dem Paket):
  - `lib/fulfillment/prozesse/server.ts` (C1): `fallLesen`, `faelleKurz`, `prozesseMorgenlauf`, `prozesseFristen`, `stakeholderAuskunft`, `PROZESSE_STAPEL`
  - `lib/fulfillment/kunde/server.ts` (C2): `kundeKurzFuer`, `formularAntwortenFuer`, `unterlagenFuer`, `unterlageText`, `reportZusatzFuer`, `kundeMorgenlauf`, `kundeFristen`, `kundeAuskunft`, `KUNDE_STAPEL`
  - `lib/fulfillment/analyse/server.ts` (C3): `dossierKurzFuer`, `analyseMorgenlauf`, `personenFristen`, `personenAuskunft`, `ANALYSE_STAPEL`
  - Stub-Komponenten: `components/os/fulfillment/prozesse/index.tsx` (`Prozesse`, `Bausteine`, `Onboarding`, `Kreislauf`, `Visualisierung`, `Cockpit`, `OnboardingHinweis`, `FallUeberblick`, `FallAblauf`,
    `FallWert`, `FallMenschen`, `FallTakt`, `ProduktFulfillmentZeile`), `components/os/fulfillment/kunde/index.tsx` (`FallKunde`, `KundenAnsichtVorschau`),
    `components/os/fulfillment/analyse/index.tsx` (`Analysen`, `FallAnalyse`). Jede Stub-Komponente zeigt einen `Leerzustand` „kommt mit Paket Cx“.
- `components/os/fulfillment/FulfillmentSeite.tsx` (Rahmen, Unternavigation, Fall-Reiter) · `app/os/mandate/fulfillment/page.tsx`
- Route-Stubs aller Routen aus Abschnitt 9 (Tor + 501 bzw. 404) · `app/kunde/[link]/page.tsx` (Stub: „Dieser Link ist nicht aktiv.“)
- Leere Erklär-Dateien (Abschnitt 10) · `lib/demo/saat-fulfillment.ts` + Stubs `lib/demo/fulfillment-{prozesse,kunde,analyse}.ts` (gehören danach C1/C2/C3)
- `tests/fulfillment-fundament.test.ts`

**Ändert (gemeinsame Dateien, nur C0):**
- `lib/wege.ts`, `lib/make-one/seiten.ts`, `components/os/mandate/ProdukteMandate.tsx` (Segment + `<OnboardingHinweis/>`), `components/os/mandate/Produkte.tsx` (nur der Einhänger `<ProduktFulfillmentZeile leistungId=… />`)
- `lib/erklaerungen/index.ts`
- `lib/crm/speicher-register.ts` (5 Einträge mit Angaben + `IN_BUSINESS`), `lib/crm/person-weitere.ts` (`WEITERE_SPEICHER`), `lib/crm/person-bestaende.ts` (Art. 15: `fulfillment: await fulfillmentAuskunft(m)`),
  `lib/crm/loeschfristen.ts` (3 Fristen), `lib/crm/loeschfristen-lauf.ts` (Schritt „Fulfillment“ → `fristen-server.ts`), `lib/crm/datenschutz.ts` (VVT `vv-fulfillment`, `vv-fulfillment-analyse` inkl. berufliche Personenrecherche Art. 6 f/14,
  `vv-kundenlink` Art. 6 b/13 — nachgetragen in `verzeichnisVervollstaendigen`)
- `lib/store/leseprotokoll.ts` (2 Bereiche), `lib/store/datei-huelle.mjs` + `.d.mts` (`BILD_ORDNER` + `fulfillment-unterlagen`)
- `lib/zugang/routen-register.ts`, `lib/zugang/sicht-bereich.ts`, `middleware.ts` (`KUNDE_OFFEN`), `next.config.mjs` (Köpfe)
- `lib/zoe/stapel.ts` (`StapelArt` + `'fulfillment'`), `lib/zoe/stapel-arten.ts` (`ARTEN.fulfillment`), `app/api/tagesstart/route.ts` (Morgenlauf-Schritt „Fulfillment“), `lib/demo/saat.ts` (R-Einträge + Aufruf `fulfillmentSaeen`)
- `tests/routen-register.test.ts` (`OFFEN_ERLAUBT`), `tests/aufraeumen.test.ts` (`ERLAUBT` + `kunde`)

**Wächter C0:**
- Säuberer: Unsinn fällt weg, Grenzen, leere Bestände
- `regeln.ts`: Ebenen, Kreis, Fortschritt, `aktuellerKnoten`, `onboardingKandidaten` mit Fixture, `unterschriftAm`-Reihenfolge, `mandatsEnde`
- `muster.ts` neutral (keine Eurobeträge `/\d[\d.,]*\s?€/`, keine Namen aus der Prüfliste von `tests/repo-sauber.test.ts`)
- `ORTE` lösen auf
- Routen-Register, Speicher-Register, Trennung-Bereiche, datenschutz-register und aufraeumen sind grün
- `?space=privat` auf `/api/fulfillment` → 403

**Abnahme (So testet ihr):**
1. Produkte & Mandate öffnen → oben „Fulfillment“ → die Seite mit sechs Unterpunkten erscheint, jeder zeigt „kommt mit Paket …“.
2. ⌘K „Fulfillment“ → sechs Treffer.
3. `/kunde/kl-000000000000000000000000` → „Dieser Link ist nicht aktiv.“
4. `npx tsc --noEmit` und die genannten Tests sind grün.

### C1 — Prozesse, Bibliothek, Fall, Onboarding, Takt, Wert, Wirkung, Cockpit (≈ 32 h)
**Besitzt:**
- `lib/fulfillment/prozesse/**`: `vorlagen-anwenden.ts`, `import.ts`, `fall.ts` (starten/Kopie, Ops, `vorlagenDiff`), `fall-server.ts` (`fallSchreiben` mit Phase/Lieferobjekt-Nachzug 7.4), `onboarding.ts`,
  `rituale.ts`, `wert.ts`, `wirkung.ts` + `wirkung-pdf.ts`, `nachsorge.ts`, `landkarte.ts`, `ablauf-bild.ts`, `cockpit.ts`, `kennzahlen.ts`, `server.ts`
- `components/os/fulfillment/prozesse/**`
- `app/api/fulfillment/route.ts`, `…/import`, `…/fall`, `…/cockpit`, `…/wirkung`
- `lib/erklaerungen/fulfillment-prozesse.ts`, `lib/demo/fulfillment-prozesse.ts`

**Ändert:**
- `components/os/crm/Kunden.tsx` (nur der Link „Fulfillment öffnen ›“ im `MandatDetail`)
- `lib/crm/planung.ts` (nur `href`/`hrefLabel` der Kreislauf-Stufe `fulfillment` → `WEG.fulfillment('kreislauf')`)

**Schnittstellen:**
- liefert `fallLesen`, `faelleKurz`, `PROZESSE_STAPEL` (Onboarding starten, Nachsorge), `prozesseFristen` (Haltung/Notiz nach 12 Monaten, verwaiste Fälle), `stakeholderAuskunft`
- nimmt `kundeKurzFuer` (C2) und `dossierKurzFuer` (C3) fürs Cockpit
- die Willkommens-Karte nutzt `POST /api/fulfillment/kunde { aktion: 'link-anlegen' }` (C2); ohne C2 oder bei Schalter aus: „Playbook-Link: aus“
- nimmt die Ops `quickwins-setzen` und `kickoff-fragen` an (von C3 per Browser)

**Wächter:**
- Vorlagen-Ops (Ebenen, Kreis 400, Ebene 5 nur Baustein, Rang lückenlos, 409, 413)
- Import (Kennungen `fb-imp-…`, s2-/s3- ohne Kollision, `pakete` → Einsortieren in mehrere Vorlagen, `herkunft` → Marke „Urheberrecht prüfen“, Abläufe im Format `prozesse_zeichnen.json` (Abbildung 2.6, Kennung aus dem Titel, nie aus dem Datei-Schlüssel), `quellenverzeichnis`/`link`/`instanzwerte` nie übernommen, Marke „rechtlich prüfen“ für die genannten Kennungen, Konflikt bei `vonHand`, Rückgängig nur Unverändertes)
- Fall-Kopie (Struktur stabil bei Vorlagen-Änderung, Diff, erledigte nie entfernt)
- 7.4 (Phase nur vorwärts, Lieferobjekt idempotent, Fehler sichtbar)
- Wert-Konto (Messung setzt `ist`)
- `landkarteLage`/`ablaufLage` deterministisch
- Cockpit „was hängt“
- Business-only (`?space=privat` 403, Testkunde ohne Haushalt 403, Dienstweg schreibt 403)
- Update-Probe (Mandate ohne Fall: Produkte & Mandate, Treppe und Kreislauf unverändert; GET schreibt nichts)

**Abnahme:**
1. Fulfillment › Prozesse → „Aus Muster anlegen“ → Hochhaus erscheint; Etage „Leads & Qualifizierung“ anklicken → Steckbrief → „öffnen ›“ führt in die Qualifizierung.
2. Bausteine › Import → `vorlagen.json` wählen → Vorschau zeigt n neu, Preise als Hinweis, 7+ Einträge mit „rechtlich prüfen“ → Übernehmen → Rückgängig funktioniert.
3. Produkte → Produkt → „Fulfillment: Vorlage wählen“.
4. Mandat (Demo „aktiv“) → Karte „Kundenonboarding starten“ → Starten → Fall › Überblick zeigt 8 Onboarding-Schritte; Willkommen-Karte → Vorschau → Senden (Testpostfach) → Schritt 1 grün.
5. Wert-Konto: Ziel + Ausgang + Datum → Messung → Mandat zeigt den neuen Ist-Wert.
6. Bausteine › Import → `prozesse_zeichnen.json` → drei Abläufe → Kreislauf zeigt Trichter, Fluss mit Weichen und Zeitachse; Ergänzungen gestrichelt, Rückwege als Bögen; kein Firmenname in Titeln oder Kennungen.
7. Visualisierung › Cockpit listet „was hängt“.

### C2 — Kunden-Link, Kunden-Ansicht, Formulare, Upload, Puls, Report (≈ 22 h)
**Besitzt:**
- `lib/fulfillment/kunde/**`: `token.ts` (Erzeugen, Hash, zeitkonstanter Vergleich, Stempel), `sicht.ts` (`kundenSicht`, Positivliste), `formular.ts`, `upload.ts` (Typ, Größe, Exif, Ablage), `puls.ts`, `link.ts`,
  `fristen.ts`, `report-zusatz.ts`, `server.ts`
- `components/os/fulfillment/kunde/**` (u. a. `KundenAnsicht.tsx`, `FallKunde.tsx`, `KundenAnsichtVorschau.tsx`)
- `app/kunde/[link]/page.tsx`
- `app/api/kunde/[link]/**`, `app/api/fulfillment/kunde/**`
- `lib/erklaerungen/fulfillment-kunde.ts`, `lib/demo/fulfillment-kunde.ts`

**Ändert:**
- `lib/crm/treppe-report.ts` (optionale Felder 5.2), `lib/crm/treppe-pdf.ts`, `lib/crm/treppe-server.ts` (`grundlage`/`mailGrundlage` holen `reportZusatzFuer`)
- `components/os/mandate/treppe/Fortschritt.tsx` (Vorschau der neuen Abschnitte, Puls, Ein-Klick-Senden, Link „Fulfillment öffnen ›“)
- `app/api/crm/treppe/report/route.ts` (nur, falls nötig für Puls-Anfrage beim Senden)

**Schnittstellen:**
- liefert `kundeKurzFuer`, `formularAntwortenFuer`/`unterlagenFuer`/`unterlageText` (nur `freigegeben`, für C3), `KUNDE_STAPEL` (Puls schlecht → Gespräch anbieten), Fristen, Auskunft
- nimmt `fallLesen` (C1) und die Regeln aus C0

**Wächter:**
- Middleware (Regex trifft nur die vier Formen, Methoden, Köpfe gelöscht)
- jede Fehlerart ergibt dieselbe 404
- Token nie in Antworten außer bei `link-anlegen`; nie im Bestand im Klartext; zeitkonstanter Vergleich
- Puls-Token öffnet nur Puls
- **`kundenSicht` liefert nur Schlüssel der Positivliste** (tiefer Schlüssel-Vergleich mit einem Fall voller interner Daten)
- Link A sieht nie Mandat B
- Upload: Typ am Inhalt (falsche Endung abgelehnt, SVG/ZIP 415), 25 MB/20 Dateien 413, Exif weg, Status `ungeprueft`, KI sieht nur `freigegeben`
- Stempel/Honigtopf gleicher Text; Drossel 429
- Schalter: Umgebung aus **oder** Instanz aus → 404; Instanz-Schalter nur Inhaber
- Report ohne Fall: Byte für Byte wie vorher (Schnappschuss); mit Fall: neue Abschnitte
- Puls ≤ Schwelle → Meldung neutral (ohne Wert), Stapel-Vorschlag
- Fristen
- Art. 15/17 (`eintraegeRaus`)

**Abnahme:**
1. Ohne `MAKE_OS_KUNDENLINK=an`: Fall › Kunde & Reports zeigt „aus (Betrieb)“; jeder Link 404.
2. Lokal mit `=an` + Schalter an (Inhaber) → „Link anlegen“ → Link kopieren → privates Fenster: Kunden-Seite zeigt Zeitstrahl, „Wartet auf euch“ und Playbook (keine Stakeholder, keine Health) → einen Abschnitt ausfüllen → intern erscheinen die Antworten und 25 %.
3. Report-Vorschau → „Senden“ → die Mail enthält den Puls-Link → Puls 4 abgeben → Glocke „braucht Aufmerksamkeit“ + Stapel-Vorschlag.
4. „Widerrufen“ → der alte Link zeigt 404.
5. „So sieht der Kunde es“ = dieselbe Ansicht.

### C3 — Analyse-Strecke: Dossier, Agenten, Web-Fetch, Prüfer, Personenteil, Tiefenbericht (≈ 30 h)
**Besitzt:**
- `lib/fulfillment/analyse/**`: `agenten.ts`, `schaetzen.ts`, `ausgabe.ts` (`ausgabePruefen`), `quellen.ts` (`GESPERRTE_DOMAINS`), `web-lesen.ts`, `werkzeug-defs.ts`, `werkzeuge.ts` (Ausführung),
  `lauf.ts`, `dossier-anwenden.ts`, `personen-anwenden.ts`, `pruefen.ts`, `dsgvo.ts` (Positiv-/Negativliste, LIA- und Art.-14-Muster), `fristen.ts`, `zoe-werkzeug.ts`, `server.ts`
- `lib/netz/oeffentlich.ts` (neu), `lib/ki/leseteil.ts` (neu, in lib/ki)
- `components/os/fulfillment/analyse/**`
- `app/api/fulfillment/{dossier,analyse,personen,dossier/leseteil}/**`
- `lib/erklaerungen/fulfillment-analyse.ts`, `lib/demo/fulfillment-analyse.ts`

**Ändert:**
- `lib/postfach/transport.ts` (nur: `ipIntern` aus `lib/netz/oeffentlich.ts` importieren)
- `lib/werkzeuge/einordnung.ts` (vier Zeilen), `lib/werkzeuge/register.ts` (Defs der drei Agenten-Werkzeuge)
- `lib/zoe/werkzeuge.ts`, `lib/zoe/werkzeug-defs.ts`, `lib/zoe/register.ts` (ZOE-Werkzeug `fulfillment_lage`)
- `lib/zoe/gespraech-schutz.ts` (`VERTRAULICHE_QUELLEN` + `dossier`, `mandat-unterlagen`), falls die Einordnung das nicht schon ableitet

**Schnittstellen:**
- liefert `dossierKurzFuer`, `ANALYSE_STAPEL` (Art.-14-Uhr, Hinweise), `personenFristen`, `personenAuskunft`
- nimmt `formularAntwortenFuer`/`unterlagenFuer`/`unterlageText` (C2) und schickt die Ops `quickwins-setzen`/`kickoff-fragen` aus dem Browser an `PATCH /api/fulfillment/fall` (C1)
- `fallLesen` nur lesend für den Mandatskontext

**Wächter:**
- kein Lauf ohne Klick (Morgenlauf startet nie)
- Bestätigung zu niedrig → 409 `kostenRueckfrage`; Grenze 1,5×; ≤ 2 laufend (429); ≤ 3 je Agent; Pacht 10 Min. → `abgebrochen`
- Abhängigkeiten und F1 hart; F2 nur mit bestandener DSGVO-Prüfung
- `ausgabePruefen` (Aussage ohne Quelle → offene Frage, gesperrte Domains raus, Negativliste raus mit Kategorie)
- **Web-Fetch:** private, Loopback, CGNAT und IPv6-ULA abgelehnt; DNS-Rebinding (zweite Auflösung anders) abgelehnt; Weiterleitung auf intern abgelehnt; > 2 MB Abbruch; nur Text; Ziel außerhalb der Erlaubnis → `rechte`; `robots.txt`. Fake-Server, kein echtes Netz.
- Werkzeug-Verträge grün (`tests/werkzeug-vertraege.test.ts`); KI-Kategorien je Lauf wie in 4.5 (`tests/ki-datenschutz.test.ts`)
- Personenteil: Konto mit `finanzRecht: 'business'` → 403; Lese-Protokoll `personenrecherche`; Löschfrist entfernt Karten und lässt nur den Vermerk
- **Leseteil:** nur die auslösende Person (andere 404); kein Modul unter `lib/fulfillment/**` außer der Leseteil-Route importiert `lib/ki/leseteil`; `tests/ki-anbieter-tor.test.ts` grün
- Demo ohne KI-Schlüssel vollständig (gespeicherte Antworten)

**Abnahme:**
1. Fall › Analyse → „Dossier anlegen“ (Firma und Domain vorbelegt aus der Akte) → A0 „Prüfen“ (ohne Kosten) → Aufgabe „Registerauszug ablegen“ erscheint.
2. Welle 1 zeigt A1, A5, A7, A8, TB je mit „ca. … € · höchstens … €“ → A1 starten → läuft → Entwurf → Abschnitte anhaken → übernehmen.
3. A4 gesperrt bis F1 → F1 + LIA eintragen → A4 bereit.
4. A12 → Diagnose-Entwurf → F2 gesperrt, solange die Prüfung rot ist → nach bestandener Prüfung F2 → „Quick Wins in den Fall“ → Fall › Überblick zeigt 3 Quick Wins mit Frist.
5. Tiefenbericht starten → nur bei mir sichtbar, eine zweite Person sieht „nur für die auslösende Person“.

### Reihenfolge und Zusammenführen
1. C0 auf `update-0910b` (Koordinator), dann C1, C2 und C3 parallel in eigenen Worktrees von diesem Stand.
2. Zusammenführen in der Reihenfolge C1 → C2 → C3. Konflikte sind nur in `lib/demo/saat.ts` möglich, falls C0 dort Fehler hatte, sonst keine.
3. Danach einmal gesamt: `npx tsc --noEmit`, `npx vitest run`, `npx next lint`, Demo-Saat in einem leeren Ordner, Update-Probe (12.5).
4. Summe ≈ 92–95 h.

---

## 12 · Prüfkriterien und Wächter (gesamt)

1. **Business zeigt nie Privat, Privat bekommt nichts:** `ROUTEN_BEREICH` (`fulfillment`, `kunde`) → `?space=privat` 403; alle Bestände `IN_BUSINESS`; Fälle nur für Mandate von Business-Gesellschaften
   (`istBusinessGesellschaft`, sonst 400 mit `GEHOERT_ZU_PRIVAT`); `tests/sicht-business-privat*.test.ts` und `tests/trennung-bereiche.test.ts` grün; `messlatte-malin` grün.
2. **Sicht X bekommt nichts aus Y:**
   - fremder Haushalt / Testkunde ohne Haushalt → 403
   - Dienstweg schreibt → 403
   - `finanzRecht: 'business'` → Personenteil 403 (Rest sichtbar)
   - Leseteil nur die auslösende Person
   - Kunden-Link A ↛ Mandat B
   - Puls-Token ↛ Playbook
   - ZOE-Werkzeug ohne `mitPersonen` liefert keinen Personenteil, nie den Leseteil
3. **Öffentlicher Weg gibt nie mehr als erlaubt:** Positivliste-Test auf `kundenSicht`; Schlüssel-Vergleich der echten Antwort; gleiche 404 für alle Fehlerarten; keine Dateiliste; Token nur gehasht.
4. **Kunden-Link „voll geprüft“** (Bedingung für `MAKE_OS_KUNDENLINK=an`):
   - alle C2-Wächter grün
   - Prüfbau mit CSP (`make-os-pruefbau`)
   - manueller Durchgang nach [FU §7 S1–S9] (Ausnahme S6 Virenscan, siehe Abschnitt 13)
   - Anwalt hat den Art.-13-Hinweis gelesen
   - Kevin gibt frei
5. **Update-Probe (Altbestand bleibt):** Kopie eines Datenordners ohne Fulfillment-Bestände →
   - alle GETs laufen und schreiben nichts
   - Produkte & Mandate, Treppe, Report (Schnappschuss), Kreislauf und Mandate bleiben Byte für Byte gleich
   - `Mandat`/`Leistung` werden nie umgeformt (Fulfillment schreibt dort nur über vorhandene Wege: `phase`, `ziele[].ist`, `health.stimmung` — jeweils per Klick)
   - Rückweg zum alten Stand: Die neuen Bestände bleiben liegen und stören ihn nicht
   - Sicherung vor dem Upload (Memory „Live-Daten erhalten“)
6. **Keine Namen und Preise im Code:** `tests/fulfillment-fundament.test.ts` scannt `lib/fulfillment/**`, `components/os/fulfillment/**`, `lib/erklaerungen/fulfillment-*`; `tests/repo-sauber.test.ts` grün.
   Die Liste verbotener Wörter (Namen früherer Firmen und Prozesse, Personen) steht **nur im Test**. Beispiele in Erklärungen sind erfunden.
7. **Demo-Saat zeigt den ganzen Ablauf mit erfundenen Daten** (`tests/demo.test.ts` liest jede Demo-Datei):
   - Landkarte, drei erfundene Paket-Vorlagen, rund 25 Bausteine (zwei markiert „rechtlich prüfen“)
   - drei erfundene Abläufe (je einer als Trichter, Fluss mit Weichen, Zeitachse) mit Rückwegen und gestrichelten Ergänzungen
   - zwei Fälle (einer im Onboarding mit überfälliger Willkommensmail, einer in der Umsetzung mit Wert-Konto und drei Messungen, Stakeholder aus Demo-Kontakten, Entscheidungen, Mitschriften)
   - Kunden-Link-Schalter **aus** (Vorschau sichtbar), Formular-Antworten, Puls 8 und 5
   - Dossier mit gespeicherten Läufen (ohne Modell, mit Kosten), Prüfbericht, eine Personenkarte zu einer erfundenen Person mit Art.-14-Uhr
   - kein Leseteil (Google), stattdessen der Hinweis
8. **Register und Verträge:** Routen-Register (Stubs ab C0), Speicher-Register mit Angaben, `datenschutz-register`, `werkzeug-vertraege`, `ki-datenschutz` (jeder Aufrufer gibt `ki` an), `erklaerungen`,
   `design-standard`, `aufraeumen*` (Seiten in der Suche).
9. **Human-in-the-Loop:** Kein Weg verschickt, lädt ein, veröffentlicht, startet einen Lauf oder ändert die Firmenakte ohne Klick. Der Morgenlauf legt nur Vorschläge in den Stapel (Wächter je Paket).

---

## 13 · Offene Fragen (nur, was Kevin entscheiden muss)

1. **Virenscan für Kunden-Uploads.** Im Projekt gibt es keinen. Ein ClamAV im Arbeiter-Container braucht ≈ 1 GB RAM, der Server hat 1,9 GB; ein externer Dienst wäre ein neuer Datenweg.
   *Entschieden (Kevin 10.10., 23:25):* Upload freigegeben, **nur sichere Dateitypen** (PDF, Bilder, Office ohne Makros, am Inhalt geprüft), nie öffnen/ausführen, verschlüsselt,
   nur als Download — **kein Virenscanner**. Recht `upload` ist je neuem Link an und je Link abschaltbar; der Kunden-Link selbst kommt ausgeschaltet.
2. **Kunden-Link auf eigener Adresse?** Getrennte Subdomain (z. B. `kunde.<domain>`) heißt: keine Sitzungs-Cookies im selben Ursprung, sauberere Trennung.
   *Vorschlag:* erst die Instanz-Adresse (der Cookie ist `__Host-`, CSP streng), die Subdomain beim nächsten Server-Schritt.
3. **Befähigung „läuft ohne uns“:** Die Kriterien sind ein Vorschlag aus der Recherche [FT §2 Phase 8, A] (≥ 2 Abschlüsse ohne Gründer, Rhythmen 4 Wochen ohne uns, Coverage und Pflichtfeldquote ≥ Ziel).
   *Vorschlag:* als Vorgabe übernehmen, je Fall änderbar.
4. **Fulfillment-Kennzahlen im Business-Index** (z. B. Report-Takt, Puls)? *Vorschlag:* noch nicht, erst nach drei Monaten Daten.
5. **Darf der Kunde Messwerte im Wert-Konto selbst eintragen?** *Vorschlag:* nein, nur sehen. Messwerte tragen wir im Wochen-Check ein.
6. **Material Dritter in den Vorlagen** (laut `vorlagen_2.json` Prinzipien aus gekauften Playbooks bzw. Seminar-Workbooks, neu formuliert): nur intern nutzen oder
   nach Prüfung auch an Kunden geben (Workbook über den Link, Export)? *Vorschlag:* intern frei, an Kunden erst nach Vermerk „Urheberrecht geprüft“ (Rückfrage beim Ausgeben).

Bereits entschieden (22:30/22:55, nicht mehr offen):
- Dossier als Objekt; Web-Fetch mit Schutz
- jeder Lauf einzeln bestätigt; Tiefenbericht als einzelner Lauf, nur für die auslösende Person
- MAKE ist Verantwortlicher, der Anwalt liest gegen
- Personenfrist 90 Tage nach Mandatsende, einstellbar
- alte Vorlagen markiert „vor Einsatz rechtlich prüfen“; Kreislauf von heute; Notizen in vier Zeilen
- Einstiegsstufe „Diagnose“, Preise nur als Daten
- Rückmeldung zum Playbook (Recruiting nur Prozess, operativ nur Vertrieb, Eventvertrieb dazu)
- mehrere Pakete mit je einer Vorlage je Produkt; die früheren Vertriebsabläufe als klickbare, gezeichnete Abläufe

**Vor Go-live gegenlesen (Anwalt, einmal):** Art.-13-Hinweis Kunden-Link, Art.-14-Muster, LIA-Muster, Upload-Bedingungen, alle Bausteine mit „vor Einsatz rechtlich prüfen“.
