# Kundengewinnung — die 18 Prozess-Vorlagen (Spezifikation)

Stand 21.10.2026. Grundlage: `research/prozesse/ANALYSE_100.md` (100 Punkte, Etappen A–D), `research/prozesse/0-bestand.md`, Recherche 4
(`research/prozesse/4-sales-marketing-fulfillment.md`) und der Code auf Stand `052f454e`. Kevin 21.10.: „Kundengewinnung wird unser Herzstück … extrem
viele Vorlagen, die auf dem höchsten Level integriert sind … Sales-Research-Agents reingeben, er zieht Scores zusammen, trägt alles in die Karte ein …
verbunden mit Loops, die wir immer wieder teilweise ausführen und triggern lassen … dann mit WhatsApp.“

Diese Datei baut nichts. Aus ihr entstehen danach die 18 Vorlagen als Daten (Knoten, Kanten, Masken-Werte) — ohne Namen, Firmen und Beträge, für jede
Instanz gleich.

**So ist sie zu lesen**

- Alle Pfade sind relativ zur Repo-Wurzel. `Datei:Zeile` habe ich im Code nachgesehen (Stand `052f454e`).
- **B1** = der Entwurf von Modell und Baustein-Katalog im Worktree `prozesse-b1` (`lib/prozesse/*`, Stand 21.10., noch nicht committet).
  Baustein-Kennungen wie `aufgabe.anlegen` oder `warten.ereignis` stammen aus `lib/prozesse/baustein-katalog.ts` (B1).
  Steht vor einer Kennung **neu:**, gibt es den Baustein im B1-Katalog noch nicht. Was er braucht, steht in Abschnitt 5 (N1–N12).
  B1-Verweise tragen keine Zeilennummer, weil sich der Entwurf noch ändert. Sie nennen Datei und Symbol.
- **Klasse** ist die Werkzeugklasse aus `lib/werkzeuge/vertrag.ts`: lesen · vorschlag · intern · aussen · geld · loeschen.
  aussen, geld und loeschen laufen immer über den Freigabe-Stapel (`IMMER_FREIGABE`, ebd.).
- **Freigabe** sagt, wann ein Mensch klicken muss:
  - „Schloss“: das Freigabe-Schloss vor einer Außenwirkung (B1 `lib/prozesse/schloss.ts`).
  - „Stapel“: ein Vorschlag, der erst per Klick übernommen wird.
  - „Mensch“: eine Entscheidung oder eine Aufgabe für eine Person.
  - „—“: der Schritt läuft ohne Klick.
- E1–E13 sind fehlende Ereignisse, N1–N12 fehlende Bausteine, M1–M10 fehlende Teile von Motor, Lesern und Daten (alle in Abschnitt 5).
- Zeiten sind Berliner Zeit. „Werktag“ heißt Mo–Fr ohne Feiertage in NRW (`lib/zeit/kalender-kern.ts`).

---

## 1. Übersicht

| Nr | Vorlage | Bereich · Fall | Auslöser | Schritte | Freigaben | Was fehlt (Kurz) |
|---|---|---|---|---|---|---|
| V01 | Nächtlicher Prospecting-Lauf | Sales · keiner → firma | Zeitplan werktags 02:00 | 5 + Teilprozess 10 | Stapel: Karte ergänzen, Deal · Schloss: Mail-Entwurf | N1, N2, N4, M2, M4, M6 |
| V02 | Lead-Eingang mit Uhr | Sales · lead | Ereignis `neuer-lead` + Webhook | 10 | Stapel: Anfrage aus Webhook, Deal · Schloss: Antwort · Mensch: Ergebnis | E8, E12, N10, M1, M5 |
| V03 | Mail eines Leads in der Inbox | Sales · lead | Ereignis `neue-mail` mit Kontakt | 9 | Stapel: Zuordnen, Follow-up · Schloss: Antwort | E8, E13, M1, N12 |
| V04 | Event-Nachfassen 48 h (Netzwerken) | Marketing · event | Datum am Fall `event.datum` ±0, 19:00 | 6 + Teilprozess 6 | Schloss: Danke-Mail · Stapel: Follow-up | E2, E7, N1, M8 |
| V05 | Vernetzen-Runde LinkedIn | Marketing · keiner | Zeitplan werktags 08:00 | 7 | Stapel: Texte, Lead-Status | E10, N3 |
| V06 | Kampagnen-Playbooks als Prozesse | Marketing · kampagne → lead | Kampagne wird aktiv · von Hand | 5 + Teilprozess 7 | Stapel: Texte · Schloss: Mails · Mensch: Ergebnis | E11, M3, N1, N9 |
| V07 | Power-Hour-Vorbereitung jeden Morgen | Sales · keiner | Zeitplan werktags 07:00 je Person | 7 | Stapel: Kalender-Block, Vorschläge | (läuft heute schon im Head-Takt) |
| V08 | Geparkte Leads wiederbeleben | Sales · lead | Datum am Fall `lead.wiedervorlage` | 9 | Stapel: erneut parken, Status · Mensch: Reaktivieren | N5, M2 |
| V09 | Deal ohne nächsten Schritt / hängt | Sales · deal | Zeitplan werktags 08:30 | 3 + Teilprozess 7 | Stapel: nächster Schritt, Stufe · Mensch: weiter/parken/verlieren | N1 (Abfrage-Art erweitern) |
| V10 | Angebot nachfassen | Sales · deal | Ereignis `deal-stufe` = angebot | 9 | Mensch: Antwort einordnen · Schloss: Erinnerung · Stapel: neue Version | E3, E8 |
| V11 | Termin-Nachbereitung 24 h | Sales · deal / firma | Ereignis `termin-vorbei` | 8 | Mensch: Wie lief's? · Stapel: Follow-up · Schloss: Mail | E1, M3 |
| V12 | Gewonnen → Übergabe mit Uhr → Fulfillment | Übergabe · deal → mandat | Ereignis `deal-stufe` = gewonnen | 9 | Stapel (geld): Mandat · Stapel: Fall starten · Schloss: Willkommen | E4, N6, N7, M1 |
| V13 | Verloren / keine Entscheidung | Sales · deal | Ereignis `deal-stufe` = verloren · geparkt | 8 | Mensch: Auswertung · Stapel: Wiedervorlage | M9, N5 |
| V14 | Empfehlung anfragen | Ausbau · mandat | Datum `mandat.ende` +45 · `ziel-erreicht` | 9 | Mensch: Intro erbitten · Stapel: Intro-Text · Schloss: Dank | E9, E4 |
| V15 | Bestandskunden-Ausbau & Verlängerung | Ausbau · mandat | Datum `mandat.ende` −90 | 10 | Mensch: Review · Schloss: Einladung · Stapel: Angebot, Deal | E9, M2 |
| V16 | Newsletter-Anmeldung → Begleitung | Marketing · lead | Ereignis `einwilligung-erteilt` · Webhook | 8 | Schloss: Willkommen · Mensch: Nachweis ergänzen | E6, Entscheidung E-V2 |
| V17 | Buchungsanfrage → Vorbereitung | Sales · lead / deal | Ereignis `buchung-angefragt` | 9 | Mensch: Freigabe der Buchung · Stapel: Deal/Qualifizierung, Leitfaden | E5, E1 |
| V18 | Make.One-Gästeliste | Marketing · event | Datum `event.datum` −28 | 9 + Teilprozess 4 | Stapel: Gästeliste · Schloss: Einladungen, Erinnerung | E7, N8, M8 |

**Zählweise.** „Schritte“ zählt die Knoten der obersten Ebene ohne Auslöser und Ende. Teilprozesse sind eigene veröffentlichte Prozesse
(B1 `teilprozess.aufruf`, Typ `TeilprozessAufruf`, `lib/prozesse/definition.ts`) und erscheinen auf der Landkarte nicht als eigene Kachel.

---

## 2. Bau-Reihenfolge

Gemeinsame Bausteine kommen zuerst. Danach folgen die Vorlagen, die nur mit vorhandenen Quellen laufen, und zuletzt die, für die eine neue
Ereignis-Quelle nötig ist. Jede Welle ist für sich vorführbar.

| Welle | Was | Warum zuerst |
|---|---|---|
| **0 · Bausteine** | Standard-Abbruch (R1), N1 `crm.abfrage`, N2 `entscheidung.score`, N3 `crm.entwurf-text`, M1 (Warten in Stunden), M2 (Wiedereintritt je Fall) | Diese Teile tragen 12 bis 15 der 18 Vorlagen. Ohne sie wird jede Vorlage zur Sonderlösung. |
| **1 · Vorhandene Quellen, reine Regeln** | V09, V07, V13, V12, V08, V15 | Sie brauchen nur Zeitplan, Datum am Fall und `deal-stufe`, also Quellen, die angebunden sind (`lib/ereignisse/arten.ts:25`). Kein Agent ist Pflicht. V12 schließt an den vorhandenen Fall-Start an (`lib/fulfillment/prozesse/fall-server.ts:97`). |
| **2 · Vorhandene Quellen + Agenten** | V03, V02, V10, V01, V05, V14 | Hier kommen ZOE, die Heads und Research als Schritte hinzu (Vorschlag, Budget). Dazu die kleinen Ergänzungen N4, N5, N10, E8 und E12. |
| **3 · Neue Quellen** | V11 (E1), V04 (E2), V17 (E5), V18 (E7 + Demo-Events), V06 (E11 + Fall-Art), V16 (E6 + Entscheidung E-V2) | Ohne neue Ereignis-Quelle laufen diese nur über einen Zeitplan-Rückfall. Der ist in jedem Abschnitt beschrieben und für die Demo ausreichend. |

Innerhalb einer Welle steht die Vorlage mit dem größten Nutzen vorn: Übergabe und Lecks vor Ausbau (ANALYSE_100 Punkt 71: „Übergabe zuerst“).

---

## 3. Gemeinsame Regeln aller 18 Vorlagen

Diese Regeln gelten in jeder Vorlage. Die einzelnen Abschnitte wiederholen sie nicht.

| Nr | Regel | Wo im Code |
|---|---|---|
| R1 | **Standard-Abbruch, fest und nicht abwählbar.** Ist eine Person des Falls in der Verarbeitung eingeschränkt (Art. 18) oder hat sie eine Werbesperre, enden alle Läufe zu ihr. Das gilt auch mitten im Warten (ANALYSE_100 Punkt 40). | `ausgenommen`: `lib/crm/einschraenkung.ts:47` |
| R2 | **Kontakte nur über die zentrale Sicht.** Wer verarbeitet, liest Kontakte nur so. Eingeschränkte Personen fehlen dort ganz. | `kontakteFuerVerarbeitung`: `lib/crm/verarbeitung.ts:20` |
| R3 | **Kanal-Ampel vor jedem Entwurf.** Bei rot entsteht kein Entwurf. Bei gelbem Telefon ist ein Anlass Pflicht. Mail ist mit Mandat nur dann grün, wenn der Hinweis bei Erhebung vorliegt. Der Newsletter ist nur mit vollem Double-Opt-in-Nachweis grün. Eine LinkedIn-Nachricht zählt als elektronische Post. | `kanalStatus`: `lib/crm/recht.ts:48` · Art. 18 / Werbesperre rot: `:49–50` · Newsletter: `:56–63` · Bestandskunde: `:76–78` · `anlassPflicht`: `:115` · bester Kanal `besterKanal`: `:98` |
| R4 | **Nichts geht automatisch nach außen.** Mail, WhatsApp, Einladung mit Gästen und „Angebot stellen“ haben die Klasse aussen und bekommen ein Schloss. Texte für LinkedIn, Telefon und Intros sind nur Entwürfe zum Kopieren (Klasse vorschlag). | `IMMER_FREIGABE`: `lib/werkzeuge/vertrag.ts` · `NUR_TEXT`: `lib/zoe/crm-vorschlag.ts:64` |
| R5 | **Fremder Text.** Dazu zählen Mail, Web, Kalender-Titel, Antworten auf Buchungsseiten, Webhook-Felder und WhatsApp. Er läuft durch `fremd()`. Danach gibt es nur Vorschläge. Rauten auf fremdem Text führen nur in harmlose Äste oder in eine Freigabe (ANALYSE_100 Punkt 56). Empfänger kommen aus Stammdaten, nie aus dem Text. | `fremd`: `lib/anthropic.ts:41` · `wirkungsEntscheid`: `lib/werkzeuge/vertrag.ts` |
| R6 | **Agenten-Schritte.** Jeder hat ein Budget je Schritt (B1 `budgetCent`, höchstens `PROZESS_GRENZEN.budgetCentMax` = 500, `lib/prozesse/definition.ts`) und einen Pflichtsatz „Warum reicht keine Regel?“. Die KI-Kategorien gehen ans KI-Tor (`askText`). Der Takt läuft nur von 7 bis 22 Uhr, höchstens 12 automatische Läufe je Head und Tag. KI-Text nach außen trägt `<KiMarke />`. | `TAKT_VON`/`TAKT_BIS`: `lib/agenten/zeitplan.ts:33–34` · `AUTO_LAEUFE_JE_TAG`: `:36` · `kiKennzeichen`: `lib/datenschutz/ki-kennzeichnung.ts:40` |
| R7 | **Ein Lauf je Prozess und Fall.** Ein zweiter Start nur mit dem Feld `erneutNachTagen` (M2). Eine Schleife hat eine harte Obergrenze je Lauf; der Rest bleibt sichtbar für den nächsten Lauf liegen. | B1 `SchleifeRegel`: `lib/prozesse/definition.ts` |
| R8 | **Als wer der Lauf schreibt.** Die Eigner-Rolle löst sich zur verantwortlichen Person der Welt auf, der Fall zur zuständigen Person. Nie fällt der Lauf auf den Inhaber zurück (Regel 5). | `verantwortlich(welt)`: `lib/crm/team.ts:33` · `zustaendig(z, welt)`: `:53` · `haeltBeziehung`: `:60` |
| R9 | **Telegram nur neutral.** Nur ein Hinweis mit Link, nie Inhalt. | B1 `TELEGRAM_HINWEISE`: `lib/prozesse/baustein-katalog.ts` · `lib/datenschutz/telegram-text.ts` |
| R10 | **Nur Business.** Prozesse hören nie auf private Ereignisse. Deals einer Privat-Einheit tragen den Bereich `privat` und starten keine dieser Vorlagen. Das ist Absicht: die Selbstständigkeit gehört zu Privat. | B1 `ausloeserPasst`: `lib/prozesse/ausloeser.ts` · `crmDiff`, Bereich aus der Gesellschaft: `lib/ereignisse/quellen.ts:156` |
| R11 | **Kennzahlen.** Gerechnet wird nur aus vorhandenen Daten. Ohne Messung gibt es eine Lücke, nie eine Null. Die vorhandene Traktion-Kennzahl bleibt die eine Wahrheit. Die Säule „Prozesse“ (M7) bekommt je Vorlage nur Befolgungsquote und Zeit. | `TRAKTION_KENNZAHLEN`: `lib/crm/traktion-index.ts:40` |
| R12 | **Demo.** Die Saat legt alles über die Routen an: erfundene Firmen (`f-demo-*`, `lib/demo/saat.ts:128–135`) und Personen mit `@example.invalid` (`lib/demo/schutz.ts:22`). Beträge stehen nie in der Vorlage. | `lib/demo/saat.ts` |

**Einstellbar heißt:** Ein Feld am Prozess oder Knoten mit Vorgabe, nie eine Konstante im Code. Die Schreibweise in den Abschnitten ist
`feld (Vorgabe)`.

---

## 4. Die 18 Vorlagen

### V01 · Nächtlicher Prospecting-Lauf

| Feld | Wert |
|---|---|
| Zweck | Jede Nacht ruhende Accounts und neue Leads anreichern, Scores zusammenziehen, das Ergebnis in die Karte bringen und die guten Fälle als Outreach-Aufgabe und Deal-Vorschlag bereitstellen. |
| Bereich · Fall | Sales · Hauptlauf `keiner`, je Account Teilprozess V01a mit Fall `firma` (ohne Firma: Fall `lead` der Person) |
| Eigner-Rolle | Verantwortlich Sales (`verantwortlich('sales')`, `lib/crm/team.ts:33`) |
| Auslöser | Zeitplan werktags 02:00 (B1 `ausloeser.zeitplan`). Die Regel-Schritte laufen sofort. Agenten-Schritte warten im Lauf bis 07:00, weil Agenten nur von 7 bis 22 Uhr laufen (`lib/agenten/zeitplan.ts:33–34`). Nachts laufen sie erst, wenn es den Batch-Weg des Anbieter-Tors gibt (`batch: true`, `lib/agenten/zeitplan.ts:20`, M4). |
| Ziel erreicht | V01a: der Account ist bewertet, und es liegt entweder ein Outreach oder die Entscheidung „bleibt in der Pflege“ vor. |
| Abbrechen | R1; Firma im Papierkorb oder archiviert; offener Deal am Account (dann gilt V09); Lead-Status `kunde` oder `kein_fit` (`lib/crm/typen.ts:12`). |

**Hauptlauf**

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `crm.abfrage` (N1) | Ruhende Accounts finden | Art `firmen-ruhend`; Kreis `A, B`; `ohneKontaktTage (90)`; höchstens `25` | B1 `CrmAbfrageArt`: `lib/prozesse/definition.ts` · `RUHEND_TAGE = 90`: `lib/crm/planung.ts:48` · Kadenz je Kreis `faellige`: `lib/crm/followup.ts:179` (Block :256–270) | lesen | — | — | weiter |
| 2 | neu: `crm.abfrage` | Neue Leads finden | Art `neue-leads`; Status `neu`; `seitTagen (7)`; höchstens `25` | `leads`: `lib/crm/leads.ts:163` · `LeadStatus`: `lib/crm/typen.ts:12` | lesen | — | — | weiter |
| 3 | `schleife.je-eintrag` | Jeden Account prüfen | Liste = Abfrage 1 ∪ 2 ohne Doppelte; Teilprozess V01a; `hoechstens (25)` | B1 `SchleifeRegel`: `lib/prozesse/definition.ts` | lesen | — | — | weiter |
| 4 | `glocke.melden` | Nachtergebnis melden | an Eigner; Text „n bewertet, m Outreach vorbereitet“ | `melde`: `lib/meldungen/melden.ts:58` | intern | — | — | weiter |
| 5 | `telegram.hinweis` | Hinweis „fertig“ | nur wenn `telegram (aus)` | R9 | intern | — | — | Ende |

**Teilprozess V01a · Account anreichern und bewerten** (Fall `firma`)

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| a1 | `entscheidung.regel` | Daten fehlen? | ja, wenn eine der drei Bedingungen gilt: Vollständigkeit < `0,6`; Firma ohne `branche`, `mitarbeiter` oder `webseite`; `recherche` leer oder älter als `180` Tage | `vollstaendigkeit`: `lib/crm/akte.ts:58` · Felder der Firma: `lib/crm/typen.ts:455–467` | lesen | — | — | ja → a2 · nein → a4 |
| a2 | `agent.skill` (Mitarbeiter `sales-recherche`) bzw. Fach-Agent `prospect` | Firma recherchieren | Auftrag fest: öffentliche Angaben mit Quelle; Ausgabe-Vertrag `branche, mitarbeiter, stadt, webseite, linkedin, signale[], aufhaenger, fit 0–100, quellen[]`; Modell `schnell`; `budgetCent (20)`; Warum: „Öffentliche Angaben stehen nicht im CRM.“ | `sales-recherche`: `lib/agenten/katalog.ts:40` · B1 `FACH_AGENTEN`: `lib/prozesse/agent-schritt.ts` · Web-Recherche `askWithSearch`: `app/api/research/route.ts` (liefert heute nur Text, M6) | vorschlag (fremd: web) | — | bis 22:00 des Tages | Fehler → a4 (ohne Recherche weiter) |
| a3 | neu: `crm.karte-ergaenzen` (N4) | Ergebnis in die Karte eintragen | Felder aus dem Vertrag; je Feld ein Häkchen; Quelle als Beleg | `kontakt_felder`: `lib/zoe/crm-vorschlag.ts:234–262` (Whitelist zu eng, N4) | vorschlag | Stapel (Sammelfreigabe erlaubt, nur Stammdaten) | 7 Tage, dann verfällt der Vorschlag | weiter |
| a4 | neu: `entscheidung.score` (N2) | Lead-Score lesen | Prüfung `temperatur`; Schwelle `warm` | `leadScore`: `lib/crm/score.ts:47` mit `scoringKontext`: `:38` · Vorgabe-Schwellen lau 5 / warm 12 / heiß 25: `lib/crm/scoring.ts:448` | lesen | — | — | ≥ Schwelle → a6 · darunter → a5 |
| a5 | `entscheidung.regel` | Fit aus der Recherche stark? | ja, wenn `fit ≥ fitSchwelle (70)` aus a2 | — | lesen | — | — | ja → a6 (nur harmloser Ast, R5) · nein → Ende „bleibt in der Pflege“ |
| a6 | `aufgabe.anlegen` | Outreach vorbereiten | an Besitzer bzw. Verantwortliche Sales; `fristTage (2)`; Beschreibung: Aufhänger, bester Kanal, Score | `besterKanal`: `lib/crm/recht.ts:98` · `haeltBeziehung`: `lib/crm/team.ts:60` | intern | Mensch | 2 Werktage | weiter |
| a7 | `entscheidung.regel` | Welcher Kanal? | Mail grün · Telefon gelb/grün · LinkedIn ohne Einwilligung | `kanalStatus`: `lib/crm/recht.ts:48` | lesen | — | — | Mail → a8 · Telefon → a8t · LinkedIn → Ende mit Übergabe an V05 |
| a8 | `inbox.mail-entwurf` | Erstansprache entwerfen | Postfach mit Business-Bereich; Text aus dem Aufhänger; KiMarke | `inboxEntwurf`: `lib/inbox/entwurf.ts:57` | aussen | Schloss | 5 Tage | weiter |
| a8t | neu: `crm.entwurf-text` (N3) | Anruf-Leitfaden | Art `anruf_leitfaden`; Anlass Pflicht | `VORSCHLAG_ARTEN`: `lib/zoe/crm-vorschlag.ts:42–61` · `anlassPflicht`: `lib/crm/recht.ts:115` | vorschlag | Stapel | 5 Tage | weiter |
| a9 | `entscheidung.score` | SQL-bereit? | Prüfung `sql-bereit` | `salesBereit`: `lib/crm/leads.ts:400` | lesen | — | — | ja → a10 · nein → Ende |
| a10 | `crm.deal-anlegen` als Vorschlag | Deal vorschlagen | `deal_anlegen`; nächster Schritt Pflicht, `inTagen (3)` | `dealAnlegen`: `lib/crm/deal-anlegen.ts:177` (nächster Schritt Pflicht, 409 bei zweitem offenem Deal) | vorschlag | Stapel | 7 Tage | Ende → Übergabe an „Deal führen“ (V09) |

- **Warum a5 nur in Harmloses führt:** `fit` kommt aus der Web-Recherche, ist also fremder Text. Er darf eine Aufgabe auslösen, aber nie selbst etwas
  schreiben.
- **Recht:**
  - Die Recherche nutzt nur öffentliche Angaben, Art. 14.
  - Herkunft bei Neuanlage: `recherche` (`lib/make-one/crm.ts:142`).
  - Die Erstansprache folgt der Kanal-Ampel (R3).
  - Kalte Mail ohne Einwilligung bleibt rot. Dann gibt es nur den Telefon-Leitfaden mit Anlass oder Vernetzen (V05).
  - Es gibt keinen Versand.
- **Kennzahlen:**
  - Menge: bewertete Accounts je Nacht.
  - Umwandlung: Outreach → Gespräch → SQL (`sql_30`, `lib/crm/traktion-index.ts:45`).
  - Zeit: Nacht → Outreach erledigt.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der Outreach-Aufgaben, die in der Frist erledigt wurden. Die Datenreife wirkt mit (`reife`,
    `lib/crm/traktion-index.ts:71`).
- **Einstellbar:** `uhrzeit (02:00)`, `ohneKontaktTage (90)`, `neueLeadsTage (7)`, `hoechstens (25)`, `vollstaendigkeitMin (0,6)`,
  `rechercheAlterTage (180)`, `budgetCent (20)`, `monatsbudgetCent (1.500)`, `scoreSchwelle (warm)`, `fitSchwelle (70)`, `erneutNachTagen (90)`.
- **Was fehlt im Code:**
  - M6: Research mit Ausgabe-Vertrag je Firma. `/api/research` liefert nur Markdown. Der Prospect-Agent bewertet nur die getrennte Zielliste
    `prospects` und schreibt nie in die Karte (`lib/zoe/agenten.ts:234–260`). Damit gibt es heute zwei Orte für Zielfirmen.
  - N4: Firma-Felder und die Felder `aufhaenger`, `signale` und `recherche` sind nicht vorschlagbar.
  - N1: die Abfrage-Arten.
  - M2: Wiedereintritt je Firma nach 90 Tagen.
  - M4: Nachtfenster bzw. Batch.
  - Offen ist auch, ob Agenten-Schritte eines Prozesses in die 12 Läufe des Heads zählen (Entscheidung E-V6).
- **Demo:**
  - `f-demo-atlas` (Zielkunde, Kontakt `nina` mit B-Prio) bekommt in der Nacht eine Recherche „Signale: neue Vertriebsleitung“.
  - Daraus entsteht eine Outreach-Aufgabe mit Telefon-Leitfaden.
  - Neu erfunden: `f-demo-werkzeug` „Beispiel Werkzeugbau GmbH“, Kreis B, seit 120 Tagen still, Ansprechpartnerin `lea.beispiel@example.invalid`. Das
    Ergebnis ist „bleibt in der Pflege“.

### V02 · Lead-Eingang mit Uhr

| Feld | Wert |
|---|---|
| Zweck | Jede neue Anfrage bekommt binnen einer Uhr eine erste Reaktion, eine zuständige Person und ein Pflicht-Ergebnis mit Grund — kein Lead bleibt ohne Status. |
| Bereich · Fall | Sales · `lead` (Firmen-Lead, ohne Firma der Personen-Lead) |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = Besitzer, sonst Verantwortliche Sales (`zustaendig`, `lib/crm/team.ts:53`) |
| Auslöser | (a) Ereignis `neuer-lead`, nur wenn `ereignis.quelle = anfrage` und `bezug.kontaktid` gesetzt. Gespeist von `/api/crm/anfrage` über `anfrageEreignis` (`lib/ereignisse/quellen.ts:189`). Diese Route deckt Website von Hand, Mail, LinkedIn, Telefon, Empfehlung, Event und WhatsApp ab (`ANFRAGE_KANAELE`, `lib/crm/anfragen.ts:40–51`). Inbox und WhatsApp gehen über „Kontakt anlegen“ (`components/os/inbox/Gespraech.tsx:109`). (b) Webhook „Website-Formular“ (B1 `ausloeser.webhook`), erst als Vorschlag, siehe Schritt 0. B1 erlaubt bis zu 5 Auslöser je Prozess (`PROZESS_GRENZEN.ausloeserJeProzess`). |
| Ziel erreicht | Ein Ergebnis ist gesetzt: Qualifizierung, Termin, Deal oder „kein Fit“ mit Grund. |
| Abbrechen | R1; die Anfrage ist schon beantwortet und das Ergebnis gesetzt (dann Ziel). |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 0 | neu: `crm.anfrage-anlegen` (N10) — nur bei Auslöser (b) | Anfrage aus dem Formular übernehmen | Webhook-Felder `name, email, firma, nachricht, kanal = website` | `anfrageBauen`: `lib/crm/anfragen.ts:144` (Dublette, Art. 18, Werbesperre, Einwilligung „Anfrage“, Follow-up „Anfrage beantworten“ fällig heute :238) | intern (fremd: webhook) | Stapel (fremder Text, R5) | Uhr läuft ab Eingang | übernommen → `neuer-lead` startet diese Vorlage erneut (Kette 2 tief) · abgelehnt → Ende |
| 1 | `crm.firma-akte` | Akte und Lead lesen | — | `firma_akte` (lesen) · `leadZeileFuer`: `lib/crm/leads.ts:443` | lesen | — | — | weiter |
| 2 | `entscheidung.regel` | Zuständig? | Besitzer gesetzt? | `LeadZeile.ohneBesitzer`: `lib/crm/leads.ts:142` | lesen | — | — | ja → 3 · nein → 2b |
| 2b | `crm.kontakt-pflegen` | Zuständige vorschlagen | Feld `zustaendig` = Verantwortliche Sales | `kontakt_felder`: `lib/zoe/crm-vorschlag.ts:234` | vorschlag | Stapel | 1 Werktag | weiter |
| 3 | `entscheidung.regel` | Über welchen Kanal kam die Anfrage? | Kanal aus der Anfrage-Aktivität | `ANFRAGE_KANAELE`: `lib/crm/anfragen.ts:40–51` | lesen | — | — | Mail/Website → 4m · WhatsApp → 4w · Telefon/Empfehlung → 4t · LinkedIn → 4l |
| 4m | `agent.zoe` → `inbox.mail-entwurf` | Erste Antwort entwerfen | Modell `ausgewogen`, `budgetCent (10)`; Eingabe: Anfrage-Text (fremd), Akte, Produkte | `inboxEntwurf`: `lib/inbox/entwurf.ts:57` (Art. 18 → kein Entwurf) | aussen | Schloss | innerhalb der Uhr | weiter |
| 4w | `whatsapp.entwurf` | Antwort per WhatsApp entwerfen | Das Fenster ist offen, weil die Person geschrieben hat (24 h); sonst nur eine freigegebene Vorlage | `whatsappSenden`: `lib/whatsapp/senden.ts:66` · `fensterBerechnen`: `lib/whatsapp/typen.ts:25` | aussen | Schloss | innerhalb der Uhr | weiter |
| 4t / 4l | `crm.entwurf-text` (N3) | Rückruf-Leitfaden bzw. LinkedIn-Antwort | Art `anruf_leitfaden` bzw. `nachricht_entwurf` | `lib/zoe/crm-vorschlag.ts:42–64` | vorschlag | Stapel | innerhalb der Uhr | weiter |
| 5 | `warten.ereignis` | Uhr: erste Reaktion | Ereignis `antwort-gesendet` (E8) oder Follow-up „Anfrage beantworten“ erledigt; `uhrStunden (4)` in Arbeitszeit (M1) | Follow-up erledigen: `app/api/crm/followup/route.ts:192` | lesen | — | 4 Std. | eingetreten → 7 · abgelaufen → 6 |
| 6 | `glocke.melden` + `erinnerung.runde` | Uhr abgelaufen: eskalieren | Runde 1: Glocke an die Zuständige · Runde 2 (nach weiteren `4` Std.): an den Eigner | `melde`: `lib/meldungen/melden.ts:58` | intern | — | — | zurück zu 5 (höchstens 2 Runden), dann 7 |
| 7 | `entscheidung.mensch` | Ergebnis der Anfrage | Pflicht mit Grund: Qualifizieren · Termin · Info/Material · kein Fit · weiterleiten | Lead-Status `LEAD_STATUS`: `lib/crm/leads.ts:33–43` · Ausscheiden mit Grund: `app/api/crm/lead/route.ts:276` (nur von Hand) | intern | Mensch | `ergebnisTage (2)` Werktage | Qualifizieren/Termin → 8 · kein Fit → Ende (Aufgabe „raus mit Grund“) · Info → Ende |
| 8 | `entscheidung.score` | MQL / SQL? | `mql` und `sql-bereit` | `mqlErreicht`: `lib/crm/leads.ts:414` · `istMarketingLead`: `lib/crm/scoring.ts:168` | lesen | — | — | SQL → 9 · sonst → `crm.lead-qualifizieren` (Status `qualifizierung`, Stapel) → Ende |
| 9 | `crm.deal-anlegen` als Vorschlag | Deal vorschlagen | nächster Schritt Pflicht | `dealAnlegen`: `lib/crm/deal-anlegen.ts:177` | vorschlag | Stapel | 3 Tage | Ende → Übergabe an V09 |

- **Recht:**
  - Eine Anfrage begründet die Einwilligung „Anfrage“ nur für ihren Kanal (`lib/crm/anfragen.ts:207–212`).
  - Die erste Antwort ist eine Antwort, keine Werbung. Folgemails mit Angebot brauchen die Ampel (R3).
  - Webhook-Felder sind fremder Text. Darum wird nur vorgeschlagen, und der Empfänger kommt aus der Kartei, nicht aus dem Formular (R5).
  - Art. 13: Die Antwort-Vorlage verweist auf den Datenschutzhinweis der Instanz.
- **Kennzahlen:**
  - Menge: Anfragen je Kanal (`anfragen_90`, `lib/crm/traktion-index.ts:56–62`).
  - Umwandlung: Anfrage → Qualifizierung → SQL.
  - Zeit: Median bis zur ersten Reaktion. Diese Kennzahl fehlt (M5). Sie ist die Leitkennzahl dieser Vorlage und füttert die Säule „Prozesse“
    (Anteil in der Uhr).
- **Einstellbar:** `uhrStunden (4)`, `nurArbeitszeit (ja)`, `eskalationsRunden (2)`, `ergebnisTage (2)`, `kanaeleAn (alle)`, `budgetCent (10)`.
- **Was fehlt im Code:**
  - E8: kein Ereignis für die eigene ausgehende Antwort. `eingehend()` filtert sie bewusst heraus (`lib/ereignisse/quellen.ts:73`).
  - E12: `neuer-lead` kommt nur aus `/api/crm/anfrage`. Die Buchungsfreigabe legt die Person über `anfrageBauen` an, aber ohne Ereignis
    (`lib/kalender/buchung-ablauf.ts:160`).
  - N10: Webhook → Anfrage.
  - M1: Warten in Stunden. B1 `WartenRegel.ereignis` kennt nur `hoechstensTage` (`lib/prozesse/definition.ts`).
  - M5: Antwortzeit-Kennzahl.
  - Ein offenes Website-Formular gibt es heute nicht (`middleware.ts`, nur Buchung, Abmeldelink und Webhooks).
- **Demo:**
  - Neue erfundene Anfrage über Kanal `website` von `jana.muster@example.invalid` (Firma `f-demo-seeblick`).
  - Die Uhr ist gelb nach 3 Std., die Antwort liegt im Stapel, das Ergebnis lautet „Termin“.

### V03 · Mail eines Leads in der Inbox

| Feld | Wert |
|---|---|
| Zweck | Kommt eine Mail von einem Lead oder aus einem offenen Deal, wird sie zugeordnet, die Wärme neu gelesen und ein nächster Schritt vorgeschlagen — mit Uhr bis zur Antwort. |
| Bereich · Fall | Sales · `lead`, mit offenem Deal `deal` |
| Eigner-Rolle | Verantwortlich Sales; Lauf als Person des Postfachs (`Ereignis.person`, `lib/ereignisse/typen.ts:40`), denn Inbox-Aktionen gehen nur mit eigener Sitzung |
| Auslöser | Ereignis `neue-mail`, nur wenn `bezug.kontaktid` gesetzt ist UND (Lead-Status aktiv ODER `bezug.dealid` gesetzt) UND der Bereich business ist. Der Absender wird schon im Ereignis zu einem Kontakt aufgelöst (`personBezug`, `lib/ereignisse/quellen.ts:46–53`). Bei Art. 18 gibt es kein Ereignis (`:48`). Entprellt: höchstens ein Lauf je Bezug und Stunde (`EREIGNIS_GRENZEN.entprellenMinuten`, `lib/ereignisse/typen.ts:79`). |
| Ziel erreicht | Die Antwort ist gesendet, oder ein Follow-up bzw. Termin ist angelegt. |
| Abbrechen | R1; Absender ist eine Sammeladresse; Fach `info` (Rundschreiben) bzw. die Mail ist automatisch. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Fach der Mail | Fach aus dem Strom | `fachVon`: `lib/inbox/faecher.ts:93` (`FAECHER` :13–20) | lesen | — | — | antworten → 2 · termine → 2 · info → Ende · warten → Ende (V10 bzw. Nachfassen deckt es ab) |
| 2 | `entscheidung.regel` | Gespräch schon zugeordnet? | Zuordnung im Inbox-Zustand der Person | `lib/inbox/zustand.ts` (`zuordnung`) | lesen | — | — | ja → 4 · nein → 3 |
| 3 | neu: Inbox-Aktion als Vorschlag | Gespräch zuordnen | Aktion `zuordnen` (schreibt Verlauf: Betreff + Link, nie Text) | `lib/inbox/aktionen.ts:86–96` → `verlaufNachziehen`: `lib/inbox/verlauf.ts:75` | intern | Stapel (Inbox-Aktionen nur mit eigener Sitzung, N12) | 1 Werktag | weiter |
| 4 | `entscheidung.score` | Wärme gestiegen? | Prüfung `temperatur`; Vergleich mit dem Stand vor der Mail | Wärme: `waermeMessen` `lib/crm/scoring.ts:194–197` · `leadScore`: `lib/crm/score.ts:47` | lesen | — | — | gestiegen auf ≥ warm → 4b (Hinweis in der Glocke) · sonst → 5 |
| 5 | `agent.zoe` | Antwort und nächsten Schritt entwerfen | Modell `ausgewogen`, `budgetCent (10)`; Eingabe: Mail (fremd), Akte, Deal; Ausgabe-Vertrag `antwort, vorschlag: termin|followup|deal_stufe, inTagen` | `inboxEntwurf`: `lib/inbox/entwurf.ts:57` · `vorschlaegeFuer`: `lib/inbox/gespraech-server.ts:65` | vorschlag (fremd: postfach) | — | — | weiter |
| 6 | `inbox.mail-entwurf` | Antwort bereitlegen | Postfach = das der Mail; Antwort im Thread | `/api/inbox/senden` (eigene Person, Absender = Postfach) | aussen | Schloss | `antwortStunden (24)` | weiter |
| 7 | `entscheidung.regel` | Was schlägt ZOE vor? | Feld `vorschlag` aus 5 (harmloser Ast, R5) | — | lesen | — | — | termin → `kalender.einladung` (Schloss) · followup → `crm.followup` (Stapel) · deal_stufe → `crm.deal-stufe` (Stapel) |
| 8 | `warten.ereignis` | Uhr: Antwort gesendet | E8 `antwort-gesendet` im selben Gespräch; `antwortStunden (24)` (M1) | — | lesen | — | 24 Std. | eingetreten → Ende · abgelaufen → 9 |
| 9 | `glocke.melden` | Antwort steht aus | an die Postfach-Person; nach `NACHFASSEN_TAGE` (3) übernimmt das Fach „warten“ | `NACHFASSEN_TAGE`: `lib/inbox/faecher.ts:25` | intern | — | — | Ende |

- **Recht:**
  - Antworten im laufenden Gespräch sind keine Werbung.
  - Zuordnen nur per Klick: keine Werbesperre, kein Art. 18, keine Sammeladresse (`lib/inbox/aktionen.ts:86–96`).
  - Mailtext geht an die KI nur mit der Kategorie `postfach`. Im Hintergrund wird pseudonymisiert. Text gibt es nie im Protokoll.
- **Kennzahlen:**
  - Menge: Lead-Mails je Woche.
  - Umwandlung: Mail → nächster Schritt angelegt.
  - Zeit: Median bis zur Antwort (M5). Füttert die Säule „Prozesse“ (Anteil in 24 Std.).
  - Daneben bleibt `followup_puenktlich` (`lib/crm/traktion-index.ts:52`).
- **Einstellbar:** `antwortStunden (24)`, `nurBeiDeal (nein)`, `waermeHinweis (ja)`, `budgetCent (10)`.
- **Was fehlt im Code:**
  - E8: ausgehende Mail als Ereignis.
  - E13: IMAP- und WhatsApp-Ereignisse tragen kein `gespraech` (`lib/ereignisse/quellen.ts:93`, `:111`); nur Gmail (`:85`).
  - N12: Inbox-Aktion und Versand nach Freigabe mit der Sitzung der freigebenden Person.
  - M1: Warten in Stunden.
  - Eine Auffälligkeit: Das Scoring-Kriterium „antwort“ filtert `von !== 'system'` (`lib/crm/scoring.ts:280`). Eingehende Inbox-Antworten
    (`von: 'system'`, `lib/inbox/verlauf.ts:63`) zählen dort darum nicht, nur in der Wärme.
- **Demo:**
  - Erfundene Mail von `marie`, Kontakt an `f-demo-seeblick`, Deal „Cockpit für Seeblick Hotels“: „Können wir nächste Woche sprechen?“.
  - Ablauf: Fach „termine“ → Entwurf mit zwei freien Zeiten → Termin-Einladung im Stapel.

### V04 · Event-Nachfassen 48 h (Netzwerken)

| Feld | Wert |
|---|---|
| Zweck | Jede auf einem besuchten Event erfasste Person ist binnen 48 Stunden nachgefasst — Danke-Entwurf, Follow-up oder Termin —, sichtbar mit Zähler „offen · rechtzeitig“. |
| Bereich · Fall | Marketing · `event` (besuchtes Event, `istNetzwerkenEvent`, `lib/crm/marke.ts:135`); je Erfassung Teilprozess V04a (Fall `lead`) |
| Eigner-Rolle | Verantwortlich Event (`verantwortlich('event')`); je Person die Person, die erfasst hat bzw. die Zuständige aus der Erfassung |
| Auslöser | Bis E2 da ist: Datum am Fall `event.datum`, Versatz 0, `uhrzeit (19:00)` (B1 `ausloeser.datum`, `DATUMS_FELDER` `lib/prozesse/ausloeser.ts`). Danach: Ereignis `netzwerken-erfasst` (E2) je Erfassung, ein Lauf je Event. |
| Ziel erreicht | Jede Erfassung ist nachgefasst oder bewusst verzichtet. |
| Abbrechen | R1 je Person; Event abgesagt. |

**Hauptlauf**

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `crm.abfrage` (N1) | Offene Erfassungen finden | Art `netzwerken-offen`: Teilnahmen des Events mit `netzwerken`, ohne `followUpAm`, ohne `nachfassenVerzichtet` | `Teilnahme`: `lib/crm/typen.ts:608` (`followUpAm?` :614, `nachfassenVerzichtet?` :616, `netzwerken?` :629) | lesen | — | — | weiter |
| 2 | `schleife.je-eintrag` | Jede Erfassung nachfassen | Teilprozess V04a; `hoechstens (60)` | — | lesen | — | — | weiter |
| 3 | `agent.skill` (Mitarbeiter `event-abendbericht`) | Abendbericht | Regelwerk zuerst, Modell nur zum Ordnen; `budgetCent (5)` | `berichtAus`: `lib/crm/netzwerken.ts:695` · Mitarbeiter: `lib/agenten/katalog.ts` (Head Event) | vorschlag | — | Abend | weiter |
| 4 | `glocke.melden` | Bericht melden | an Eigner und alle, die erfasst haben | `melde` (Art `netzwerken`): `lib/meldungen/melden.ts:34` | intern | — | — | weiter |
| 5 | `warten.dauer` | 48 Stunden | `tage (2)` | `BESUCH_FOLLOWUP_TAGE = 2`: `lib/crm/besuche.ts:44` | lesen | — | — | weiter |
| 6 | `entscheidung.regel` | Quote erreicht? | Anteil rechtzeitig ≥ `ziel (80 %)` | `besuchKennzahlen` (`besuche_followup`, Ziel ≥ 80 %): `lib/crm/besuche.ts:274`, `:280` | lesen | — | — | ja → Ende · nein → Glocke an Eigner → Ende |

**Teilprozess V04a · Eine Erfassung nachfassen** (Fall `lead`)

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| a1 | `entscheidung.regel` | Welcher Schritt wurde vereinbart? | `NetzwerkSchritt` der Erfassung | `NetzwerkSchritt`: `lib/crm/typen.ts:571` · `SCHRITTE`: `lib/crm/netzwerken.ts:69–78` | lesen | — | — | nur-kontakt → Ende (zählt nicht) · termin → Ende (gilt erst nach dem Kalender-Schritt, `lib/crm/netzwerken-server.ts:618`) · followup → a5 · sonst → a2 |
| a2 | `entscheidung.regel` | Danke möglich? | persönlich gesprochen (`keinGespraech` nicht gesetzt) und Mail-Ampel nicht rot und Frist nicht abgelaufen | `dankeOffen`: `lib/crm/netzwerken.ts:639` · `DANKE_FRIST_TAGE = 14`: `lib/crm/netzwerken-recht.ts:25` | lesen | — | — | ja → a3 · nein → a5 |
| a3 | neu: `crm.entwurf-text` (Art `danke_entwurf`) bzw. `inbox.mail-entwurf` | Danke-Mail entwerfen | Text nach Fall (neu/bestand, gesprochen, Kunde); Datenschutzhinweis bei neu angelegten; Werbewörter → Rückfrage | `dankeEntwurf`: `lib/crm/netzwerken.ts:568` · `datenschutzHinweisText`: `lib/crm/netzwerken-recht.ts:69` · `werbeWoerter`: `:98` · `DANKE_UWG_HINWEIS`: `:93` | aussen | Schloss | `dankeStunden (24)` | freigegeben → a4 · abgelehnt → Verzicht (`dankeVerzichten`, `lib/crm/netzwerken-server.ts:747`) |
| a4 | neu: Aktion „Danke raus vermerken“ | Danke als gesendet vermerken | setzt `followUpAm` und `datenschutzInformiertAm` | `dankeRausVermerken`: `lib/crm/netzwerken-server.ts:709` | intern | — | — | Ende |
| a5 | `crm.followup` | Follow-up sichern | nur wenn noch keines da ist; `inTagen` = Frist der Erfassung | `followupFrist` (2 Werktage): `lib/crm/netzwerken.ts:202` | vorschlag | Stapel | 2 Werktage | weiter |
| a6 | `warten.datum` | Bis zur Frist | Feld = Frist aus a5; `hoechstensTage (3)` | — | lesen | — | — | nachgefasst → Ende · abgelaufen → Glocke an Zuständige → Ende |

- **Recht:**
  - Eine Visitenkarte ist keine Einwilligung. Darum gibt es kein Danke ohne Gespräch.
  - Im Danke stehen kein Angebot und keine Einladung (§ 7 UWG, `DANKE_UWG_HINWEIS`).
  - Art. 13 bei Neuanlage (`datenschutzHinweisText`).
  - Nach 14 Tagen gibt es kein Danke mehr.
  - Art. 18 bricht die Schleife je Person ab (R1).
- **Kennzahlen:**
  - Menge: Erfassungen je Event (`besuche_kontakte`).
  - Umwandlung: Erfassung → Follow-up/Termin/Deal (`besuche_deals`).
  - Zeit: Anteil rechtzeitig (`besuche_followup`, `lib/crm/besuche.ts:274`).
  - Leitkennzahl ist `besuche_followup`. Die Säule „Prozesse“ bekommt die Befolgungsquote: der Anteil der Erfassungen, deren Teilprozess in der Frist
    endete.
- **Einstellbar:** `uhrzeit (19:00)`, `fristTage (2)`, `zielQuote (80)`, `dankeStunden (24)`, `hoechstens (60)`.
- **Was fehlt im Code:**
  - E2: Netzwerken-Erfassung als Ereignis. Heute wird nur die Glocke gemeldet (Schritt `melden`, `lib/crm/netzwerken-server.ts:630`), kein Ereignis.
  - E7: „Event vorbei“.
  - N1: Abfrage-Art `netzwerken-offen`.
  - M8: Die Demo-Saat sät keine CRM-Events und Teilnahmen.
  - Unstimmig im Bestand: Die Kennzahl zählt 2 **Kalendertage** (`lib/crm/besuche.ts:127–129`), die Follow-up-Frist 2 **Werktage**
    (`lib/crm/netzwerken.ts:202`). Die Uhr dieser Vorlage nimmt die Kennzahl (Kalendertage). Das sollte Kevin vereinheitlichen (Entscheidung E-V7).
  - Der Kopfkommentar `lib/crm/netzwerken-server.ts:25–26` nennt andere Schritte, die `followUpAm` setzen, als der Code bei `:575`.
- **Demo:**
  - Erfundenes besuchtes Event „Beispiel-Unternehmertag“ (Marke Netzwerken), drei Erfassungen:
    - `tom.beispiel@example.invalid`, Qualifizieren
    - `ida.muster@example.invalid`, nur Kontakt
    - `ben.probe@example.invalid`, Follow-up
  - Am nächsten Morgen: 1 Danke im Stapel, 1 Follow-up, Quote 2/2.

### V05 · Vernetzen-Runde LinkedIn

| Feld | Wert |
|---|---|
| Zweck | Jeden Werktag die Vernetzen-Runde je Profil vorbereiten (schreiben, nachfassen, anfragen, anreichern, zurückziehen) — der Mensch klickt in LinkedIn, MAKE OS versendet nichts. |
| Bereich · Fall | Marketing · `keiner` (je Profil-Person ein Lauf); Personen als Liste im Lauf |
| Eigner-Rolle | Verantwortlich Marketing; Lauf je Team-Person mit LinkedIn-Profil |
| Auslöser | Zeitplan werktags 08:00. Wie heute der Head-of-Marketing-Modus `netzwerk` (`lib/heads/takt.ts:120`, Skill `heads:netzwerk` `lib/agenten/skills.ts:444`); nur mit aktiver Kampagne mit Playbook `vernetzen`. |
| Ziel erreicht | Die Runde des Tages ist abgearbeitet; über die Zeit: Ja-Antworten werden Leads. |
| Abbrechen | Kampagne beendet; R1 je Person (die Runde lässt ausgenommene Personen ohnehin weg). |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `crm.abfrage` (N1) | Runde berechnen | Art `vernetzen-runde`; Profil = Person des Laufs; `proTag (15)` | `netzRunde`: `lib/crm/netzwerk.ts:122` (Reihenfolge schreiben → nachfassen → anfragen → anreichern → zurückziehen, :131) · `netzStufe`: `:79` · `PRO_TAG_STANDARD = 15`: `:40` · `ANFRAGE_TAGE = 21`: `:38` | lesen | — | — | weiter |
| 2 | `entscheidung.regel` | Etwas zu tun? | Karten > 0 | — | lesen | — | — | ja → 3 · nein → Ende |
| 3 | `aufgabe.anlegen` | Vernetzen-Runde heute | an die Profil-Person; Titel „Vernetzen-Runde: n anfragen, m schreiben, k nachfassen“; fällig heute; Link zur Runde | `WEG`/Runde `?s=kontakte&a=runde-vernetzen` | intern | Mensch | heute | weiter |
| 4 | `schleife.je-eintrag` | Texte für „schreiben“ | Teilprozess: `crm.entwurf-text` (`nachricht_entwurf`) aus der Kampagnen-Vorlage; nur ohne Werbebotschaft, solange keine Einwilligung da ist | Vorlagen je Kampagne: `Kampagne.vernetzen` (`lib/crm/typen.ts:719`) · Ampel R3 | vorschlag | Stapel (Text kopieren) | heute | weiter |
| 5 | `warten.ereignis` | Auf Antwort warten | E10 `linkedin-antwort`; `hoechstensTage (7)` | Nachfass-Frist `folgeTage = 7`: `lib/crm/netzwerk.ts:79` | lesen | — | 7 Tage | ja → 6 · Gespräch → 6 · kein Interesse → Ende · abgelaufen → Ende (die nächste Runde fasst nach) |
| 6 | `crm.lead-qualifizieren` | Lead aufnehmen | Status `im_gespraech` bzw. `qualifizierung` | Antwort „Ja“ → Einwilligung „social“: `linkedinEinwilligung` `lib/crm/netzwerk.ts:327` (`app/api/crm/netzwerk/route.ts:154–165`, von Hand) | vorschlag | Stapel | 2 Werktage | weiter |
| 7 | `ende.uebergabe` | An Lead-Eingang | Übergabe an V02 (Ergebnis-Pflicht) | — | lesen | — | — | Ende |

- **Recht:**
  - Vernetzen ist keine Werbung. Die Nachricht danach ist elektronische Post (§ 7 UWG, Playbook-Text `lib/crm/kampagnen.ts:85–95`).
  - Ein „Ja“ ist eine Einwilligung mit Wortlaut. Gesetzt wird sie nur per Klick in der Runde.
  - Es gibt keine Automatik gegenüber LinkedIn.
- **Kennzahlen:**
  - Menge: Anfragen je Woche.
  - Umwandlung: Annahmen ÷ Anfragen (`vernetztAm`/`angefragtAm`, `lib/crm/netzwerk-form.ts:10–15`), Ja ÷ geschrieben.
  - Zeit: Tage bis zur Annahme.
  - Füttert die Säule „Prozesse“ mit „Runde an n von m Werktagen erledigt“.
  - Die Kampagnen-Kennzahl „Annahmen und Gespräche aus der Vernetzung“ (`lib/crm/kampagnen.ts:94`) bleibt die Wahrheit.
- **Einstellbar:** `uhrzeit (08:00)`, `proTag (15)` (je Kampagne 1–40, `lib/crm/netzwerk-form.ts:47`), `folgeTage (7)`, `zurueckziehenTage (21)`,
  `nurWerktags (ja)`.
- **Was fehlt im Code:**
  - E10: Netzwerk-Route meldet kein Ereignis bei „vernetzt“ oder „Antwort“ (`app/api/crm/netzwerk/route.ts:138`, `:154`).
  - N1: Abfrage-Art `vernetzen-runde`.
  - N3: Text-Entwürfe als Katalog-Baustein.
- **Demo:**
  - Erfundene Kampagne „Vernetzen Beispiel-Region“, 6 erfundene Personen (`…@example.invalid`), darunter `felix` aus der Saat
    (`lib/demo/saat.ts:153`).
  - Die Runde zeigt: 2 anfragen, 1 schreiben, 1 zurückziehen.

### V06 · Kampagnen-Playbooks als Prozesse

| Feld | Wert |
|---|---|
| Zweck | Jede aktive Kampagne läuft als Prozess: Zielgruppe prüfen, je Person die Playbook-Schritte mit Tagesversatz anstoßen, Ergebnis je Person einsammeln, Interesse wird Lead. |
| Bereich · Fall | Marketing · Fall `kampagne` (fehlt, M3); je Person Teilprozess V06a mit Fall `lead` |
| Eigner-Rolle | Verantwortlich Marketing; je Person Besitzer bzw. Verantwortliche Sales |
| Auslöser | Kampagne wechselt von `entwurf` auf `aktiv` (E11, `KampagnenStatus` `lib/crm/typen.ts:702`). Bis dahin: von Hand „Kampagne als Prozess starten“. |
| Ziel erreicht | Jede Person der Zielgruppe hat ein Ergebnis (`KampagnenErgebnis`, `lib/crm/typen.ts:703`). |
| Abbrechen | Kampagne abgeschlossen/abgebrochen; R1 je Person. |

**Ein Prozess, neun Ausprägungen.** Die Playbooks stehen in `PLAYBOOKS` (`lib/crm/kampagnen.ts:33–103`, neun Stück). Damit nichts doppelt läuft,
verweisen fünf auf eigene Vorlagen. Die übrigen vier laufen über diesen Prozess.

| Playbook (`id`) | Kanal | Schritte (Tag) | Läuft über |
|---|---|---|---|
| `reaktivierung` | telefon | Anlass notieren (0) · anrufen oder persönlich schreiben (2) · Termin oder in 90 Tagen wieder (7) | **V06** (Anlass Pflicht, R3) |
| `lookalike` | linkedin | Top 10 prüfen (0) · Warm-Intro suchen (2) · Vernetzen ohne Werbung (5) · Gespräch nach Reaktion | **V06**; Vernetzen-Teil über V05 |
| `fallstudie` | persönlich | Ergebnis festhalten (0) · Freigabe erbitten (3) · Beitrag anlegen (7) · Endfassung zeigen | **V06** (Kundenname nur mit schriftlicher Freigabe) |
| `upsell` | persönlich | Wirkung zusammenfassen (0) · Engpass im Review ansprechen (7) · drei Optionen (14) | **V06**, in V15 als Ausbau-Ast eingebettet |
| `empfehlung` | persönlich | → **V14** | V14 |
| `verlaengerung` | persönlich | → **V15** | V15 |
| `vernetzen` | linkedin | → **V05** | V05 |
| `event` | event | → **V18** | V18 |
| `newsletter` | persönlich | → **V16** (Einwilligung im Gespräch) | V16 |

**Hauptlauf**

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `crm.abfrage` (N1) | Zielgruppe lesen | Art `kampagne-personen` (Kampagne des Falls) | `Kampagne.kontaktIds`: `lib/crm/typen.ts:711` · `planen`: `lib/crm/kampagnen.ts:177` | lesen | — | — | weiter |
| 2 | `entscheidung.regel` | Werblicher Kanal mit roter Ampel? | Kanal ∈ `WERBLICHE_KANAELE` und Ampel rot → Person fällt heraus (gezählt, ohne Namen) | `WERBLICHE_KANAELE`: `lib/crm/personen-schranke.ts:164` · `personenSchranke`: `:107` · `kampagnenHinweise`: `:196` | lesen | — | — | weiter |
| 3 | `schleife.je-eintrag` | Personen bearbeiten | Teilprozess V06a; `jeTag (10)`, sonst als Rest für morgen | Power-Hour-Deckel 10 je Kampagne: `lib/crm/heute.ts:235–239` | lesen | — | — | weiter |
| 4 | `warten.ereignis` | Bis alle ein Ergebnis haben | E11 `kampagnen-ergebnis`; `hoechstensTage` = letzter Playbook-Tag + `7` | — | lesen | — | — | alle → 5 · abgelaufen → 5 |
| 5 | `agent.head` (Head of Marketing, Mitarbeiter `marketing-kampagnen`) | Kampagne auswerten | Kennzahl des Playbooks (`Playbook.kennzahl`); Vorschlag „abschließen“ | Head-Modus `kampagne` (nur als Modus, nicht im Takt: `lib/heads/prompt.ts:51–54`) | vorschlag | Stapel | 5 Tage | Ende |

**Teilprozess V06a · Eine Person** (Fall `lead`)

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| a1 | `entscheidung.regel` | Kanal-Ampel | Kanal der Kampagne | `kanalStatus`: `lib/crm/recht.ts:48` | lesen | — | — | rot → Ende · gelb Telefon → a2 (Anlass Pflicht) · grün → a2 |
| a2 | `aufgabe.anlegen` | Schritt 1 des Playbooks | Titel aus `Playbook.schritte[0].text`; an Besitzer | `PLAYBOOKS[].schritte`: `lib/crm/kampagnen.ts:27` | intern | Mensch | Tag des Schritts | weiter |
| a3 | `crm.entwurf-text` bzw. `inbox.mail-entwurf` | Text zum Schritt | nach Kanal; Mail nur bei grün | `entwurf_ansprache` (intern, `lib/werkzeuge/einordnung.ts`) | vorschlag / aussen | Stapel / Schloss | Tag des Schritts | weiter |
| a4 | `warten.ereignis` | Reaktion abwarten | `neue-mail` oder `neue-whatsapp` mit dieser Person; bis zum nächsten Playbook-Tag | `lib/ereignisse/quellen.ts:56–112` | lesen | — | Playbook-Tag | Reaktion → a6 · abgelaufen → a5 |
| a5 | `aufgabe.anlegen` | Nächster Playbook-Schritt | Schritte 2…n mit ihrem `tag` | — | intern | Mensch | je Schritt | nach dem letzten → a6 |
| a6 | neu: `crm.kampagnen-ergebnis` (N9) | Ergebnis setzen | Pflicht: angesprochen · reagiert · gespräch · chance · kein_interesse | `app/api/crm/kampagnen/route.ts:128` (chance → Lead auf `qualifizierung`, :161–177) | intern | Mensch | 2 Werktage | chance → a7 · sonst → Ende |
| a7 | `ende.uebergabe` | An Lead-Eingang | Übergabe an V02 (Ergebnis-Pflicht) | — | lesen | — | — | Ende |

- **Recht:**
  - Je Playbook gilt das Feld `recht` (`lib/crm/kampagnen.ts:29`). Ein Beispiel ist `empfehlung`: keine Empfehlungs-Mails an Dritte aus dem System (BGH I ZR 208/12).
  - Bei werblichem Kanal lehnt die Personen-Schranke neue Personen mit roter Ampel ab (409).
  - Wer bei gelbem Telefon anruft, braucht einen Anlass.
- **Kennzahlen:**
  - Menge: angesprochene Personen.
  - Umwandlung: je `KampagnenErgebnis`; Leitkennzahl ist das Feld `kennzahl` des Playbooks.
  - Zeit: Tage bis zum Ergebnis.
  - Füttert die Säule „Prozesse“ mit dem Anteil der Personen mit Ergebnis in der Frist. Die Marketing-Kennzahlen (`marketing_anteil`, `anfragen_90`)
    bleiben die Wahrheit.
- **Einstellbar:** `jeTag (10)`, `nachlaufTage (7)`, `playbookSchritteVerschieben (0)`, `ergebnisTage (2)`.
- **Was fehlt im Code:**
  - M3: Fall-Art `kampagne`. B1 kennt nur `lead | deal | mandat | event | firma | keiner` (`lib/prozesse/definition.ts`).
  - E11: Kampagne aktiv / Ergebnis als Ereignis.
  - N1: Abfrage-Art `kampagne-personen`.
  - N9: Ergebnis-Baustein.
  - Der Head-Modus `kampagne` hat keinen Takt (`lib/heads/takt.ts:105ff`).
- **Demo:**
  - Erfundene Kampagne „Reaktivierung Kreis A/B“ mit drei Personen der Saat: `sophie`, `david` und `tobias` (`lib/demo/saat.ts:144–153`).
  - Ablauf: zwei Anlass-Aufgaben, ein Ergebnis „chance“ → Lead `f-demo-atlas` in Qualifizierung.

### V07 · Power-Hour-Vorbereitung jeden Morgen

| Feld | Wert |
|---|---|
| Zweck | Jeden Werktag liegt für jede Person die Power-Hour-Liste bereit: wer heute dran ist, mit Grund, Aufhänger, Kanal und Leitfaden. Wer gerade geschrieben hat, steht oben. |
| Bereich · Fall | Sales · `keiner` (ein Lauf je Person und Tag) |
| Eigner-Rolle | Verantwortlich Sales; Lauf je Team-Person mit Konto (`powerHourPersonen`, `lib/heads/takt.ts:150`) |
| Auslöser | Zeitplan werktags 07:00. Läuft heute schon als Head-Takt: `power_hour` werktags ab 7 Uhr je Person (`lib/heads/takt.ts:112`), Skill `heads:power_hour` (`lib/agenten/skills.ts:437`). |
| Ziel erreicht | Die Liste ist da. Am Abend zählt eine Power Hour als gehalten (Kennzahl). |
| Abbrechen | Business-frei der Person (Arbeitsrahmen) oder Feiertag; Head aus oder Not-Aus. |

**Erst „System“, dann Motor.** Diese Vorlage beschreibt einen Ablauf, den es im Code schon gibt. Nach ANALYSE_100 Entscheidung E3 (b) zeigt die
Landkarte sie zuerst als „System“-Kachel, nur lesbar. In den Motor wandert sie erst mit Gold-Test, damit keine zweite Wahrheit entsteht.

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `crm.abfrage` (N1) | Wer ist heute dran? | Art `powerhour-karten`; Person des Laufs; `n (12)` | `werIstDran`: `lib/crm/heute.ts:125` (Kategorien `KATEGORIEN` :41) · Zuordnung je Person `karteGehoert`: `:104` | lesen | — | — | weiter |
| 2 | `entscheidung.regel` | Karten da? | Anzahl > 0 | — | lesen | — | — | ja → 3 · nein → Ende |
| 3 | `entscheidung.regel` | Wer hat gerade geschrieben? | Ereignisse der letzten `72` Std. mit Kontakt der Liste → nach vorn | `geradeGeschrieben`: `lib/ereignisse/server.ts:114` · `EREIGNIS_GRENZEN.geradeStunden`: `lib/ereignisse/typen.ts:83` | lesen | — | — | weiter |
| 4 | `agent.head` (Head of Sales, Mitarbeiter `sales-nachfassen`) | Liste begründen | Modus `power_hour`: Grundlauf zuerst (Regelwerk), das Modell ordnet nur; `budgetCent (15)`; die ersten `5` Karten mit Aufhänger und Leitfaden | Grundlauf: `lib/heads/grundlauf.ts:43` · Ablauf `lib/heads/lauf.ts` · ohne Automatik: `OHNE_AUTO_MODI` `lib/heads/autonomie.ts:30` | vorschlag | — | bis 08:00 | Fehler → Grundlauf als Ergebnis (Rückfall) |
| 5 | `crm.entwurf-text` (Art `anruf_leitfaden`) | Leitfäden bereitlegen | je Telefon-Karte; Anlass Pflicht bei gelb | `anlassPflicht`: `lib/crm/recht.ts:115` | vorschlag | Stapel | heute | weiter |
| 6 | `kalender.block` | Power Hour einplanen | nur wenn `block (an)` und noch kein Block heute; `dauerMin (60)`; `uhrzeit (10:00)` | `plan_block` (ZOE schreibt in den Kalender nur über den Stapel, Eiserne Regel 3) | intern | Stapel | heute | weiter |
| 7 | `telegram.hinweis` | Hinweis „wartet“ | nur wenn `telegram (aus)` | R9 | intern | — | — | Ende |

- **Recht:**
  - Die Karten kommen aus `werIstDran`. Ausgenommene Personen fehlen dort schon.
  - Bei gelbem Telefon ist der Anlass Pflicht. `/api/crm/aktivitaet` verlangt ihn ohnehin (`anlassPflicht`).
- **Kennzahlen:**
  - Menge: Karten je Tag.
  - Umwandlung: Karten → echte Gespräche (`gespraeche`, `lib/crm/traktion-index.ts:43`).
  - Zeit: die Liste liegt vor 08:00 bereit.
  - Leitkennzahl ist `power_hours` (`lib/crm/traktion-index.ts:42`), Ziel 4 je Woche (`SCORE_ZIELE.power_hours`, `lib/crm/scoreboard.ts:113`).
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der Werktage mit gehaltener Power Hour.
- **Einstellbar:** `uhrzeit (07:00)`, `n (12)`, `mitBegruendung (5)`, `geradeStunden (72)`, `block (an)`, `blockUhrzeit (10:00)`, `blockDauer (60)`, `budgetCent (15)`.
- **Was fehlt im Code:**
  - Fachlich fehlt nichts. Die Vorlage braucht nur N1 als lesbare Abfrage über `werIstDran` und eine Lauf-Spiegelung, damit der Head-Takt als Lauf
    sichtbar wird.
  - Eine feste Power-Hour-Uhrzeit gibt es im Code nicht. Belegt sind nur die Vorbereitung ab 7 Uhr und der Erklärtext „Dienstags um 10 Uhr“
    (`lib/erklaerungen/schritte.ts:117`). Deshalb ist die Uhrzeit hier ein Feld.
- **Demo:**
  - Für die erfundene Person „Lena“ (Saat) stehen 6 Karten bereit.
  - `tobias` steht oben, weil er gestern geschrieben hat.
  - Ein Block 10:00–11:00 liegt im Stapel.

### V08 · Geparkte Leads wiederbeleben

| Feld | Wert |
|---|---|
| Zweck | Am Tag der Wiedervorlage wird ein geparkter Lead geprüft: Gibt es neue Signale, entsteht eine Reaktivierungs-Aufgabe mit Anlass. Sonst wird er bewusst neu geparkt oder ausgeschieden. Kein Lead verschwindet still. |
| Bereich · Fall | Sales · `lead`. Geparkte **Deals** laufen über dieselbe Vorlage mit Fall `deal` und Datumsfeld `deal.wiedervorlage` (N1/M2). |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = Besitzer |
| Auslöser | Datum am Fall `lead.wiedervorlage`, Versatz 0, `uhrzeit (08:00)` (B1 `DATUMS_FELDER`, `lib/prozesse/ausloeser.ts`). Die Wiedervorlage setzt „Parken“ (`app/api/crm/lead/route.ts:276–297`: Status `ruht`, `wiedervorlage = bis`, `grundArt`, Follow-up „Wiedervorlage Qualifizierung“ fällig `bis`, :293). |
| Ziel erreicht | Der Lead steht wieder auf `kontaktiert` oder höher, ist neu geparkt oder auf `kein_fit` gesetzt. |
| Abbrechen | R1; Status nicht mehr `ruht` (dann hat schon jemand gehandelt: Ziel); offener Deal. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Warum geparkt? | `grundArt` des Leads | `istGrundParken`: `lib/crm/lead-grund.ts:24–29` (spaeter, budget_spaeter, wartet, nicht_erreicht, sonstiges) | lesen | — | — | nicht_erreicht → 2 mit Hinweis „anderer Kanal“ · sonst → 2 |
| 2 | `entscheidung.score` | Neue Signale seit dem Parken? | ja, wenn eine dieser Bedingungen gilt: Temperatur gestiegen; neue Antwort; Ereignis `neue-mail`/`neue-whatsapp` mit der Person; Event-Anmeldung | `leadScore`: `lib/crm/score.ts:47` · `ereignisseSeit`: `lib/ereignisse/server.ts:126` | lesen | — | — | ja → 4 · nein → 3 |
| 3 | `agent.fach` (`research`) — nur wenn `recherche (aus)` an ist | Was hat sich bei der Firma geändert? | Ausgabe-Vertrag `signale[], aufhaenger, quellen[]`; Modell `schnell`; `budgetCent (15)`; Warum: „Anlass liegt außerhalb des CRM.“ | `/api/research` (M6) | vorschlag (fremd: web) | — | — | Signal → 4 (harmloser Ast, R5) · nichts → 6 |
| 4 | `aufgabe.anlegen` | Reaktivieren mit Anlass | an Besitzer; `fristTage (3)`; Beschreibung: Anlass, bester Kanal, Grund des Parkens | `besterKanal`: `lib/crm/recht.ts:98` | intern | Mensch | 3 Werktage | weiter |
| 5 | `crm.entwurf-text` bzw. `inbox.mail-entwurf` | Text zum Anlass | nach Kanal (R3); Mail nur bei grün | — | vorschlag / aussen | Stapel / Schloss | 3 Werktage | weiter |
| 6 | `entscheidung.mensch` | Wie weiter? | Reaktivieren · erneut parken · kein Fit (mit Grund) | Ausscheiden `raus` mit Grund Pflicht (`GRUND_RAUS`, `lib/crm/lead-grund.ts:12`) | intern | Mensch | `entscheidTage (5)` | reaktivieren → 7 · parken → 6p · kein Fit → Aufgabe „Ausscheiden“ → Ende |
| 6p | neu: `crm.lead-parken` (N5) | Neu parken | `bis` = heute + `parkTage (90)`; `grundArt` übernehmen | Parken nur von Hand (`VON_HAND`, `app/api/crm/lead/route.ts:101`) | vorschlag | Stapel | 5 Tage | Ende (neue Wiedervorlage startet die Vorlage wieder, M2) |
| 7 | `crm.lead-qualifizieren` | Lead aktivieren | Status `kontaktiert` | Rückkehr in die Runde: `brauchtQualifizierung` `lib/crm/leads.ts:318` | vorschlag | Stapel | 2 Tage | weiter |
| 8 | `warten.ereignis` | Reaktion abwarten | `neue-mail`/`neue-whatsapp` mit der Person; `hoechstensTage (14)` | — | lesen | — | 14 Tage | eingetreten → Ende (Übergabe an V03) · abgelaufen → 6 (höchstens 1× „erneut ab“) |

- **Recht:**
  - Reaktivierung per Mail nur mit Grundlage (R3).
  - Am Telefon braucht es einen Anlass aus der Beziehung (Playbook `reaktivierung`, `lib/crm/kampagnen.ts:41–48`).
  - Ein ausgeschiedener Lead bleibt in der Kartei. Die Löschfristen gelten unverändert.
- **Kennzahlen:**
  - Menge: fällige Wiedervorlagen je Woche.
  - Umwandlung: Rückkehrquote aus der Pflege zu SQL (Recherche 4, Prozess 7).
  - Zeit: Tage von der Wiedervorlage bis zur Entscheidung.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der Wiedervorlagen, die in 5 Tagen entschieden wurden.
- **Einstellbar:** `uhrzeit (08:00)`, `recherche (aus)`, `budgetCent (15)`, `entscheidTage (5)`, `parkTage (90)`, `reaktionTage (14)`.
- **Was fehlt im Code:**
  - N5: Parken als Vorschlag. `parken` geht heute nur von Hand, Dienstweg → 403.
  - M2: Wiedereintritt nach neuer Wiedervorlage.
  - Datumsfeld `deal.wiedervorlage` für geparkte Deals (es gibt nur `dealWiedervorlagen`, `lib/crm/followup.ts:276`).
  - M6: Research mit Vertrag.
- **Demo:**
  - Erfundene Firma `f-demo-ruhe` „Beispiel Druckerei GmbH“, geparkt mit `budget_spaeter`, Wiedervorlage heute.
  - Ein neues Signal liegt vor: Anmeldung zu einem eigenen Event.
  - Ergebnis: Aufgabe „Reaktivieren“.

### V09 · Deal ohne nächsten Schritt / hängender Deal

| Feld | Wert |
|---|---|
| Zweck | Jeden Werktag werden Deals ohne nächsten Schritt, mit überfälligem Schritt, lange still oder mehrfach verschoben aufgegriffen: ein nächster Schritt wird vorgeschlagen, und bei Dauer-Verschiebung wird entschieden. |
| Bereich · Fall | Sales · Hauptlauf `keiner`, je Deal Teilprozess V09a (Fall `deal`) |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = `Chance.besitzer` (`lib/crm/typen.ts:99`) |
| Auslöser | Zeitplan werktags 08:30. Auch als Übergabe-Ziel aus V01, V02, V11. |
| Ziel erreicht | Der Deal hat einen nächsten Schritt mit Datum in der Zukunft und Ampel grün, oder er ist geschlossen bzw. geparkt. |
| Abbrechen | Deal nicht mehr offen (`OFFENE_STUFEN`, `lib/crm/pipeline.ts:27`); R1 für alle `kontaktIds`. |

**Hauptlauf**

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `crm.abfrage` (N1) | Hängende Deals finden | Art `deals-ohne-schritt`, erweitert um Ampel rot/gelb; höchstens `30` | B1 `CrmAbfrageArt`: `lib/prozesse/definition.ts` · Ampel `gesundheit`: `lib/crm/pipeline.ts:89` | lesen | — | — | weiter |
| 2 | `schleife.je-eintrag` | Jeden Deal klären | Teilprozess V09a; `hoechstens (30)` | — | lesen | — | — | weiter |
| 3 | `glocke.melden` | Lage melden | an Eigner: „n Deals hängen, Wert gewichtet …“ ohne Beträge in der Glocke | `prognose().gewichtetOhneHaengende`: `lib/crm/pipeline.ts:158`, `:177` | intern | — | — | Ende |

**Teilprozess V09a · Einen Deal klären** (Fall `deal`)

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| a1 | `entscheidung.regel` | Was fehlt? | Gründe der Ampel | `gesundheit`: `lib/crm/pipeline.ts:89` (rot: Schritt überfällig :94, > 30 Tage still :95 · gelb: kein Wert :97, > 14 Tage still :98, kein Schritt :99, Entscheidung ≥ 2× verschoben :102–105) | lesen | — | — | ≥ 2× verschoben → a5 · sonst → a2 |
| a2 | `agent.skill` (Mitarbeiter `sales-nachfassen`) | Nächsten Schritt vorschlagen | Eingabe: Deal-Akte, letzte Aktivitäten, offene Angebote; Ausgabe-Vertrag `text, inTagen, kanal`; Modell `schnell`; `budgetCent (5)`; Warum: „Der passende Schritt hängt vom Gesprächsstand ab.“ | `pipeline` (lesen, mit `deal`) · Mitarbeiter: `lib/agenten/katalog.ts` | vorschlag | — | — | Fehler → a3 mit leerem Text |
| a3 | `crm.deal-stufe` (Art `deal_aendern`, Feld `naechster_schritt`) | Nächsten Schritt setzen | `naechster_schritt + faellig`; Häkchen je Feld | `deal_aendern`: `lib/zoe/crm-vorschlag.ts` (Felder stufe, grund, naechster_schritt+faellig, erwartet_am, wiedervorlage) | vorschlag | Stapel | `vorschlagTage (2)` | angenommen → a4 · abgelehnt → a5 |
| a4 | `warten.ereignis` | Bewegung abwarten | Ereignis `deal-stufe` oder Aktivität am Deal bzw. Schritt erledigt; `hoechstensTage (5)` | `crmDiff`: `lib/ereignisse/quellen.ts:150` | lesen | — | 5 Werktage | eingetreten → Ende · abgelaufen → a6 |
| a5 | `entscheidung.mensch` | Weiterführen, parken oder verlieren? | an Besitzer; parken braucht die Wiedervorlage, verlieren den Grund | `wechsleStufe`: `lib/crm/pipeline.ts:123` (verloren ohne Grund :124, geparkt ohne Wiedervorlage :125 abgelehnt) · `VERSCHOBEN_GELB = 2`: `:110` | intern | Mensch | `entscheidTage (3)` | weiter → a2 · parken/verlieren → `crm.deal-stufe` (Stapel) → Ende (V13 startet über `deal-stufe`) |
| a6 | `erinnerung.runde` | Eskalieren | Runde 1 an den Besitzer, Runde 2 an den Eigner | `melde`: `lib/meldungen/melden.ts:58` | intern | — | — | nach 2 Runden → Ende |

- **Recht:**
  - Es gibt keine Außenwirkung.
  - Ein Gewonnen → Verloren ist gesperrt, solange ein Mandat oder ein angenommenes Angebot da ist (`gewonnenVerlorenSperre`,
    `lib/crm/pipeline.ts:144`). Der Prozess schlägt so einen Wechsel nie vor.
- **Kennzahlen:**
  - Menge: hängende Deals.
  - Umwandlung: hängend → mit Schritt.
  - Zeit: Tage im Zustand „hängt“.
  - Leitkennzahlen: `ohne_schritt` (`lib/crm/traktion-index.ts:46`) und `haengt_wert` (`:51`, Rechnung `haengtNachWert` `lib/crm/deal-auswertung.ts:96`).
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der hängenden Deals, die in 5 Werktagen wieder grün sind.
- **Einstellbar:** `uhrzeit (08:30)`, `stillTageGelb (14)`, `stillTageRot (30)`, `verschobenAb (2)`, `hoechstens (30)`, `vorschlagTage (2)`,
  `bewegungTage (5)`, `budgetCent (5)`.
  - Die Schwellen der Ampel stehen heute fest in `gesundheit`. Die Vorlage liest sie dort ab. Wenn sie einstellbar sein sollen, kommen sie in
    `crm-scoring`/Wertelisten — nie doppelt.
- **Was fehlt im Code:** N1 (Abfrage-Art `deals-ohne-schritt` liest auch die Ampel-Gründe).
- **Demo:** Die Saat-Deals „Vertriebsaufbau Atlas Software“ und „Cockpit für Seeblick Hotels“: einer mit überfälligem Schritt, einer mit einer zweimal
  verschobenen Entscheidung. Ergebnis: ein Schritt-Vorschlag und eine Entscheidung.

### V10 · Angebot nachfassen

| Feld | Wert |
|---|---|
| Zweck | Ein gestelltes Angebot wird nach fünf Werktagen nachgefasst, vor Ablauf der Gültigkeit erinnert und bei Ablauf bewusst entschieden — nie still liegen gelassen. |
| Bereich · Fall | Sales · `deal` (das Angebot hängt am Deal, `Angebot.dealId`, `lib/crm/typen.ts:374`) |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = Deal-Besitzer |
| Auslöser | Bis E3 da ist: Ereignis `deal-stufe` mit `ereignis.stufe = angebot`. Es feuert, wenn „Angebot stellen“ den Deal auf „angebot“ hebt (`lib/crm/angebot-server.ts:375`; `crmDiff` `lib/ereignisse/quellen.ts:150–165`). Danach: `angebot-gestellt` (E3), auch für Version 2 eines Deals, der schon auf „angebot“ steht. |
| Ziel erreicht | Das Angebot ist angenommen oder abgelehnt (mit Grund), oder es gibt eine neue Version. |
| Abbrechen | R1; Angebot `ersetzt` (eine neue Version startet einen eigenen Lauf); Deal geschlossen. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Nachfass-Follow-up da? | Follow-up `fu-<angebot>` offen | „Angebot stellen“ legt es an: `lib/crm/angebot-server.ts:381` (Art Anruf, fällig nach `NACHFASSEN_WERKTAGE` = 5, `lib/crm/angebote.ts:45`, `:230`) | lesen | — | — | ja → 2 · nein → `crm.followup` (Stapel) → 2 |
| 2 | `warten.ereignis` | Reaktion abwarten | `neue-mail`/`neue-whatsapp` mit einer Person des Deals; `hoechstensTage (5)` (Werktage) | `personBezug`: `lib/ereignisse/quellen.ts:46–53` | lesen | — | 5 Werktage | eingetreten → 3 · abgelaufen → 4 |
| 3 | `entscheidung.mensch` | Antwort einordnen | Zusage · Absage · Frage/Änderung | Annehmen/Ablehnen nur per Klick in der Angebots-Ansicht: `angebotAnnehmen` :541 / `angebotAblehnen` :543 (Grund Pflicht :545) | intern | Mensch | 2 Werktage | Zusage/Absage → Ende (V12 bzw. V13 starten über `deal-stufe`) · Frage → 6 |
| 4 | `crm.entwurf-text` (Art `anruf_leitfaden`) | Nachfassen am Telefon | Anlass = gestelltes Angebot (Anlass aus der Beziehung) | `anlassPflicht`: `lib/crm/recht.ts:115` | vorschlag | Stapel | am Fälligkeitstag von `fu-<angebot>` | weiter |
| 5 | `warten.datum` | Bis kurz vor Ablauf | Feld `angebot.gueltig-bis`, Versatz `−3`; `hoechstensTage (30)` | B1 `DATUMS_FELDER` · `gueltigBis`: `lib/crm/typen.ts:381` (Vorgabe 30 Tage, `GUELTIG_VORGABE_TAGE`, `lib/crm/angebote.ts:42`) · Kalender-Frist „Angebot gültig bis“: `lib/kalender/eintraege.ts:104–105` | lesen | — | — | Datum erreicht → 5b · Antwort vorher → 3 |
| 5b | `inbox.mail-entwurf` | Erinnerung: Angebot läuft ab | Antwort im Thread des Angebots; kein neues Angebot im Text | `/api/inbox/senden` | aussen | Schloss | 1 Werktag | weiter |
| 6 | `entscheidung.mensch` | Bei Ablauf: wie weiter? | neue Version · Gültigkeit verlängern · verloren (Grund) | Ablauf: `ablaufen` `lib/crm/angebote.ts:304` · `ablaufFollowUps` `:322` (holt `fu-<id>` auf heute bzw. legt `fu-<id>-ablauf` an) | intern | Mensch | 3 Werktage | neue Version → 7 · verloren → `crm.deal-stufe` (Stapel) → Ende |
| 7 | `angebot.entwurf` | Neue Version entwerfen | Gesellschaft des Deals; Vorgänger = dieses Angebot | Entwurf nur speichern, nie stellen: `angebot_entwurf` (`lib/zoe/crm-vorschlag.ts`) | vorschlag | Stapel | 5 Tage | Ende (neuer Lauf mit E3) |

- **Recht:**
  - Nachfassen eines Angebots ist Kommunikation in der Anbahnung mit Anlass, keine Werbung.
  - Neue Leistungen im Text wären Werbung. Darum geht es nur um Rückfragen zum gestellten Angebot.
  - Gestellt wird nur per Klick (Klasse aussen). Das PDF ist festgeschrieben.
- **Kennzahlen:**
  - Menge: gestellte Angebote.
  - Umwandlung: Angebots-Abschlussquote.
  - Zeit: Tage bis zur Antwort, Anteil abgelaufen ohne Entscheidung.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der Angebote, die vor Ablauf entschieden wurden.
  - Daneben bleibt `angebote` je Woche (`lib/crm/scoreboard.ts:262`).
- **Einstellbar:** `nachfassenWerktage (5)` (Vorgabe aus `NACHFASSEN_WERKTAGE`), `erinnerungVorAblaufTage (3)`, `einordnenTage (2)`, `ablaufEntscheidTage (3)`.
- **Was fehlt im Code:**
  - E3: `angebot-gestellt` und `angebot-antwort`. Heute reicht nur `deal-stufe`, und das bleibt still, wenn der Deal schon auf „angebot“ steht.
  - E8: eigene Antwort als Ereignis, um „Frage beantwortet“ zu erkennen.
  - Optional ANALYSE_100 Punkt 77: Kapazitätsprüfung vor Version 2 (`kapazitaetRechnen`, `lib/kapazitaet/modell.ts:119`).
- **Demo:** Das Saat-Angebot `ang-demo-gruenfeld` (`lib/demo/saat.ts:489–495`) ist seit 6 Werktagen gestellt, ohne Antwort. Ein Anruf-Leitfaden liegt im
  Stapel, die Erinnerung ist 3 Tage vor Ablauf geplant.

### V11 · Termin-Nachbereitung 24 h

| Feld | Wert |
|---|---|
| Zweck | Nach jedem Termin mit CRM-Bezug ist binnen 24 Stunden festgehalten, wie es lief, und ein nächster Schritt angelegt. ZOE entwirft Zusammenfassung und Follow-up, ein Mensch gibt frei. |
| Bereich · Fall | Sales · `deal`, wenn der Termin einen Deal trägt; sonst `firma` bzw. `lead`. Der Termin selbst (`terminUid`) steht als Bezug im Lauf (M3). |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = Person, die den Termin angelegt hat (`kalender-bezug.von`) |
| Auslöser | Ereignis `termin-vorbei` (E1, Name schon da: `lib/ereignisse/arten.ts:21`; Quelle fehlt). Rückfall bis dahin: Zeitplan werktags 17:00 + Abfrage `nachbereiten` über `nachbereitung()` (`lib/crm/erfassen.ts:121`, Fenster 3 Tage `NACHBEREITEN_TAGE`, `:85`). |
| Ziel erreicht | Eine menschliche Notiz nach dem Termin und ein offenes Follow-up bzw. ein nächster Schritt am Deal. |
| Abbrechen | R1; Termin abgesagt (`termin-abgesagt`) oder ganztägig; es gibt schon ein offenes Follow-up mit derselben `terminUid` (`lib/crm/erfassen.ts:122`, `:138`). |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `crm.firma-akte` | Termin und Akte lesen | Meeting-Aktivität mit `terminUid`, Zeiten aus dem Kalender | `terminAktivitaetAnwenden`: `lib/crm/termin-aktivitaet.ts:60` · Termin-Zeiten: `lib/crm/termin-zeiten-server.ts` | lesen (fremd: kalender) | — | — | weiter |
| 2 | `aufgabe.anlegen` | Wie lief's? festhalten | an die Person des Termins; `fristStunden (24)`; Link öffnet „Wie lief's?“ | `nachbereitung`: `lib/crm/erfassen.ts:121` · Knopf „Nachbereiten“: `components/os/kalender/TermineAkte.tsx:91–112` | intern | Mensch | 24 Std. | weiter |
| 3 | `warten.ereignis` | Notiz abwarten | menschliche Aktivität am Kontakt nach Terminende (`lib/crm/erfassen.ts:147`); `hoechstensStunden (24)` (M1) | — | lesen | — | 24 Std. | eingetreten → 4 · abgelaufen → 3e |
| 3e | `erinnerung.runde` | Erinnern | 1 Runde an die Person, dann Glocke an den Eigner | — | intern | — | +24 Std. | zurück zu 3 (1×), dann 4 ohne Notiz |
| 4 | `agent.zoe` | Zusammenfassung und Follow-up entwerfen | Eingabe: Notiz der Person, Deal, offene Kernfragen; Termin-Titel als fremder Text; Ausgabe-Vertrag `zusammenfassung, followup{text,inTagen}, deal{stufe?, naechsterSchritt?}, mail?`; Modell `ausgewogen`; `budgetCent (10)` | `fehltBisSqlZeile`: `lib/crm/leads.ts:402` · KI-Kategorien crm, kalender | vorschlag (fremd: kalender) | — | — | weiter |
| 5 | `crm.followup` | Follow-up mit Termin-Bezug | Text + Datum aus 4; `terminUid` gesetzt (Vortag-Logik bleibt beim Server) | `FollowUp.terminUid` (Folge-Regeln Abschnitt K6a in CLAUDE.md) | vorschlag | Stapel | 2 Tage | weiter |
| 6 | `entscheidung.regel` | Deal offen? | `bezug.dealid` gesetzt und Deal offen | — | lesen | — | — | ja → 6d · nein → 7 |
| 6d | `crm.deal-stufe` | Stufe / nächsten Schritt anpassen | aus 4; Häkchen je Feld | `deal_aendern` | vorschlag | Stapel | 2 Tage | weiter |
| 7 | `inbox.mail-entwurf` | Zusammenfassung an den Kontakt | nur wenn 4 eine Mail vorschlägt und die Ampel nicht rot ist; KiMarke | `/api/inbox/senden` · `kiKennzeichen`: `lib/datenschutz/ki-kennzeichnung.ts:40` | aussen | Schloss | 2 Tage | Ende |

- **Recht:**
  - Termin-Titel kommen aus dem Kalender und können Text Dritter tragen (Kalender-Quelle in `lib/zoe/fremd.ts`). Darum gibt es danach nur Vorschläge.
  - Private Termine der anderen Person sind maskiert und nie Auslöser.
  - Die Zusammenfassung an den Kunden ist KI-Text nach außen und bekommt eine Kennzeichnung (Art. 50).
- **Kennzahlen:**
  - Menge: Termine mit CRM-Bezug.
  - Umwandlung: Termin → nächster Schritt angelegt.
  - Zeit: Stunden bis zur Notiz.
  - Leitkennzahl: Anteil nachbereitet in 24 Std. Er fehlt und füttert die Säule „Prozesse“.
  - Daneben bleiben `gespraeche` und `erstgespraeche` (`lib/crm/traktion-index.ts:43–44`).
- **Einstellbar:** `fristStunden (24)`, `erinnerungen (1)`, `mailVorschlag (an)`, `budgetCent (10)`, `rueckfallUhrzeit (17:00)`.
- **Was fehlt im Code:**
  - E1: Quelle für `termin-vorbei`, zum Beispiel im Kalender-Abgleich nach dem Vorbild `terminAbsagenEreignisse` (`lib/ereignisse/quellen.ts:242`):
    Termin mit Bezug, Ende ≤ jetzt.
  - M1: Warten in Stunden.
  - M3: der Bezug `terminUid` als Fall-Feld. B1 `BEZUG_FELDER` kennt `terminUid` schon (`lib/ereignisse/typen.ts:25`).
- **Demo:** Ein erfundener Termin „Erstgespräch Seeblick“ mit `marie` ist gestern zu Ende gegangen. Die Aufgabe „Wie lief's?“ ist erledigt, und im Stapel
  liegen das Follow-up „Unterlagen schicken“ sowie der nächste Deal-Schritt.

### V12 · Gewonnen → Übergabe mit Uhr → Fulfillment

| Feld | Wert |
|---|---|
| Zweck | Sobald ein Deal gewonnen ist, startet die Übergabe sofort mit Frist. Mandat, Übergabe-Checkliste, Fall-Start, Willkommen in 24 Stunden und Kickoff folgen ohne Lücke. |
| Bereich · Fall | Übergabe · `deal`, ab dem Mandat `mandat` |
| Eigner-Rolle | Verantwortlich Sales bis „startklar“, danach Verantwortlich Fulfillment bzw. Kundenerfolg |
| Auslöser | Ereignis `deal-stufe`, nur wenn `ereignis.stufe = gewonnen` (`crmDiff` feuert bei jeder Stufe, `lib/ereignisse/quellen.ts:154–156`). Das gilt auch, wenn ein Angebot angenommen wird (`wechsleStufe … 'gewonnen'`, `lib/crm/angebot-server.ts:520`). **Weich (Kevin, E5 b):** „gewonnen“ bleibt jederzeit möglich, die Uhr startet sofort. |
| Ziel erreicht | Der Fall ist gestartet, das Willkommen ist gesendet, das Kickoff ist terminiert. Danach Übergabe an den Fulfillment-Prozess. |
| Abbrechen | Deal nicht mehr gewonnen (Sperre `gewonnenVerlorenSperre`, `lib/crm/pipeline.ts:144`); R1; Deal einer Privat-Einheit (R10). |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Mandat schon da? | Mandat mit `chanceId` = Deal | Deal → Mandat setzt `chanceId`: `app/api/crm/lead/route.ts:156–166` | lesen | — | — | ja → 3 · nein → 2 |
| 2 | neu: `crm.mandat-anlegen` (N6) | Mandat anlegen | aus dem Deal; bei angenommenem Angebot aus `mandatVorbelegung`, sonst aus der Produkt-Karte | Aktion „mandat“: `app/api/crm/lead/route.ts:147–208` (nur gewonnen :149, 409 bei vorhandenem :150, Vorbelegung :186–193, Firma → Kunde :202) · `mandatVorbelegung`: `lib/crm/angebote.ts:531` | geld (Honorar zählt in MRR und Index, wie `setze_kunde`, `lib/werkzeuge/einordnung.ts:101–102`) | Stapel | Uhr: `mandatStunden (24)` | angenommen → 3 · abgelehnt → Glocke an Eigner → Ende |
| 3 | `aufgabe.anlegen` | Übergabe vervollständigen | an den Deal-Besitzer; Unteraufgaben = acht Blöcke (Kunde, Umfang, Zeit, Geld, Personal, Risiken, Erwartungen, Kickoff — ANALYSE_100 Punkt 71); `fristTage (2)` | Aufgaben mit Unteraufgaben bis Ebene 5 (`AUFGABEN_EBENEN_MAX`, `lib/aufgaben/ebenen.ts`) | intern | Mensch | 2 Werktage | weiter |
| 4 | `entscheidung.regel` | Vertrag unterschrieben? | `vertragUnterschrieben` am Mandat (mit angenommenem Angebot schon gesetzt, Lead-Route :186–193) | — | lesen | — | — | ja → 5 · nein → 4v |
| 4v | `aufgabe.anlegen` | Vertrag unterschreiben lassen | an Besitzer; `fristTage (5)` | offener Punkt „Vertrag unterschreiben lassen“ aus `mandatEntwurf`: `lib/crm/mandat-anlegen.ts:140` | intern | Mensch | 5 Werktage | erledigt → 5 |
| 5 | neu: `fulfillment.fall-starten` (N7) | Fall starten | Vorlage aus der Produkt-Karte; sofort statt erst im Morgenlauf | Kandidaten: `onboardingKandidaten` `lib/fulfillment/regeln.ts:459` · Stapel-Vorschlag „Fall starten“ heute im Morgenlauf: `lib/fulfillment/prozesse/server.ts:218`, Werkzeug `fulfillment_onboarding` `:195` · Start: `fallStartenServer` `lib/fulfillment/prozesse/fall-server.ts:97` | intern | Stapel | `fallTage (1)` | angenommen → 6 |
| 6 | `entscheidung.regel` | Darf die Willkommens-Mail raus? | Mail-Ampel grün; bei Bestandskunden mit `hinweisBeiErhebung` | `kanalStatus`: `lib/crm/recht.ts:48`, `:76–78` | lesen | — | — | grün → 7 · sonst → Aufgabe „persönlich begrüßen“ → 8 |
| 7 | `inbox.mail-entwurf` | Willkommen in 24 Stunden | Text aus dem Willkommens-Gerüst | `willkommenMail`: `lib/fulfillment/prozesse/onboarding.ts:283` · Uhr `willkommenUhr`: `:83` | aussen | Schloss | Uhr: `willkommenStunden (24)` ab Unterschrift | weiter |
| 8 | `kalender.einladung` | Kickoff terminieren | Gäste = Ansprechpartner des Mandats; `dauerMin (60)`; spätestens `kickoffTage (14)` nach Start | Einladung nur nach Rückfrage (`EinladungNoetig`, `lib/kalender/icloud.ts`) · Onboarding-Schritt „Kick-off terminieren“: `lib/fulfillment/prozesse/onboarding.ts:3–11` | aussen | Schloss | 14 Tage | Ende → `ende.uebergabe` an den Fulfillment-Prozess (Onboarding) |
| 9 | `warten.ereignis` (parallel zu 3–8) | Uhr der Übergabe | E4 `mandat-angelegt` bzw. Fall gestartet; `hoechstensTage (2)`; abgelaufen → `erinnerung.runde` an den Eigner | — | lesen | — | 2 Werktage | — |

- **Recht:**
  - Kommunikation im neuen Mandat ist frei.
  - Werbliche Mail an Bestandskunden nur mit Hinweis bei Erhebung (R3).
  - Die Einladung mit Gästen geht über iCloud bzw. Google nur nach Rückfrage.
  - Das Mandat trägt Honorar (MRR, Business-Index). Darum steht es in Klasse geld und wird nur per Klick angelegt (Entscheidung E-V3).
- **Kennzahlen:**
  - Menge: gewonnene Deals.
  - Umwandlung: gewonnen → Fall gestartet.
  - Zeit: Tage von „gewonnen“ bis Kickoff (Leitkennzahl, Recherche 4 Prozess 15) und Stunden bis Willkommen.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der Übergaben mit allen acht Blöcken in 2 Werktagen.
  - Die Fulfillment-Säule (`ff`, `lib/fulfillment/prozesse/kennzahlen.ts:93–121`) zählt erst ab dem Fall.
- **Einstellbar:** `mandatStunden (24)`, `uebergabeTage (2)`, `vertragTage (5)`, `fallTage (1)`, `willkommenStunden (24)`, `kickoffTage (14)`.
- **Was fehlt im Code:**
  - N6: Mandat aus dem Deal als Vorschlag.
  - N7: Fall-Start direkt aus dem Lauf. Heute schlägt erst der Morgenlauf vor.
  - E4: `mandat-angelegt` und `mandat-beendet` in `crmDiff`, das heute nur `chancen` und `firmen` vergleicht (`lib/ereignisse/quellen.ts:150`).
  - M1: Uhr in Stunden.
- **Demo:** Der Saat-Deal „Diagnose Grünfeld Bau“ wird auf „gewonnen“ gesetzt (über das angenommene Angebot `ang-demo-gruenfeld`). Mandat-Vorschlag und
  Übergabe-Aufgabe erscheinen sofort, Willkommen 23 Std. später, Kickoff in 9 Tagen.

### V13 · Verloren / „keine Entscheidung“ → Auswertung + Wiedervorlage

| Feld | Wert |
|---|---|
| Zweck | Jeder verlorene oder geparkte Deal wird kurz ausgewertet, damit Gründe in Zielkundenprofil, Scoring und Angebote zurückfließen. Wo der Grund es erlaubt, bekommt er eine echte Wiedervorlage. |
| Bereich · Fall | Sales · `deal` |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = Deal-Besitzer |
| Auslöser | Ereignis `deal-stufe`, nur wenn `ereignis.stufe` ∈ {`verloren`, `geparkt`}. Beides sind geschlossene Stufen (`STUFEN`, `lib/crm/pipeline.ts:16–26`). |
| Ziel erreicht | Die Auswertung ist notiert, und die Wiedervorlage ist gesetzt oder bewusst „keine“. |
| Abbrechen | R1; der Deal ist wieder offen. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Welcher Grund? | `Chance.grund` (Pflicht bei verloren/geparkt, `lib/crm/typen.ts:91`) | `VERLUSTGRUENDE`: `lib/crm/pipeline.ts:28` (Preis, Kein Bedarf, Zeitpunkt, Wettbewerb, Kein Entscheider, Intern gelöst, Keine Rückmeldung) + eigene Gründe `verlustgruende()` `:36` | lesen | — | — | Zeitpunkt / Keine Rückmeldung / Kein Entscheider / (neu) Keine Entscheidung → Ast W · Preis / Wettbewerb → Ast P · Kein Bedarf / Intern gelöst → Ast K · geparkt → Ast W |
| 2 | `aufgabe.anlegen` | Abschluss auswerten (10 Min.) | an den Besitzer; drei Fragen: Was gab den Ausschlag? Wer hat entschieden? Was hätte geholfen? `fristTage (5)` | — | intern | Mensch | 5 Werktage | erledigt → 3 · abgelaufen → 3 ohne Notiz |
| 3 | `agent.zoe` | Auswertung zusammenfassen | Eingabe: Deal-Historie, Aktivitäten, Auswertungsnotiz; Ausgabe-Vertrag `kurzfassung, muster[], hinweisFuer: icp|scoring|angebot|keiner`; Modell `ausgewogen`; `budgetCent (8)` | `winLoss` (180 Tage): `lib/crm/deal-auswertung.ts:44` | vorschlag | — | — | weiter |
| 4 | `crm.kontakt-notiz` | Erkenntnis am Deal festhalten | Kurzfassung aus 3 | `notiere_kontakt` (intern) | intern | Stapel (Text aus dem Modell) | 5 Tage | weiter |
| W | neu: `crm.lead-parken` (N5) bzw. `crm.deal-stufe` (Feld `wiedervorlage`) | Wiedervorlage setzen | Lead: `bis` = heute + `wiederTageW (90)`; geparkter Deal: `wiedervorlage` schon gesetzt (Pflicht, `lib/crm/pipeline.ts:125`) | Lead „ruht“ wird nur abgeleitet (`lib/crm/leads.ts:191`). Ohne `wiedervorlage` holt `brauchtQualifizierung` (`:318–319`) ihn nie zurück. | vorschlag | Stapel | 5 Tage | Ende (V08 startet zur Wiedervorlage) |
| P | neu: `crm.lead-parken` | Wiedervorlage später | `wiederTageP (180)` | — | vorschlag | Stapel | 5 Tage | Ende |
| K | `ende.ziel` | Keine Wiedervorlage | Grund steht am Deal | — | lesen | — | — | Ende |

- **Recht:**
  - Ein kurzes Gespräch mit dem Kunden über den Grund ist zulässig (Anlass aus der Beziehung). Eine werbliche Mail ist es nicht.
  - Die Auswertung bleibt intern. Personennamen gehören nicht in Deal-Titel (Art. 17, `crmNamenTilgen`).
- **Kennzahlen:**
  - Menge: Abschlüsse je Monat.
  - Umwandlung: Win Rate (`win_rate`, `lib/crm/traktion-index.ts:49`; Regel `WIN_RATE`, `lib/crm/pipeline.ts:190`), Anteil „keine Entscheidung“ (M9),
    Rückkehrquote der Wiedervorlagen.
  - Zeit: Tage bis zur Auswertung.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der ausgewerteten Abschlüsse (Recherche 4, Prozess 14).
- **Einstellbar:** `auswertenTage (5)`, `wiederTageW (90)`, `wiederTageP (180)`, `auchGewonnen (aus)`, `budgetCent (8)`.
  - Mit `auchGewonnen` läuft dieselbe Auswertung auch nach einem Gewinn (ANALYSE_100 Punkt 79).
- **Was fehlt im Code:**
  - M9: Fester Grund „Keine Entscheidung“ in `VERLUSTGRUENDE`. Heute gibt es nur „Keine Rückmeldung“ und „Kein Entscheider“, darum lässt sich der größte
    Gegner nicht zählen (Entscheidung E-V4).
  - N5: Parken als Vorschlag.
  - Ein Rückfluss-Weg „Hinweis an Scoring/ICP“ fehlt. Bis dahin entsteht eine Aufgabe für den Eigner.
- **Demo:** Ein erfundener Deal „Beispiel-Workshop Kanzlei“ an `f-demo-kanzlei`, verloren mit Grund „Zeitpunkt“. Ergebnis: Auswertungs-Aufgabe, Kurzfassung
  im Stapel, Wiedervorlage in 90 Tagen.

### V14 · Empfehlung anfragen

| Feld | Wert |
|---|---|
| Zweck | Im Moment sichtbarer Wirkung um ein Intro bitten — doppelte Zustimmung, kein Versand an Dritte aus dem System —, und jede Empfehlung als Lead mit Herkunft und Dank verbuchen. |
| Bereich · Fall | Ausbau · `mandat` |
| Eigner-Rolle | Verantwortlich Kundenerfolg (Head `kundenerfolg`, Mitarbeiter `kundenerfolg-ausbau`, `lib/agenten/katalog.ts:155–156`); Fall-Zuständige = Mandats-Zuständige |
| Auslöser | (a) Datum am Fall `mandat.ende` +`45` Tage — die mittlere Nachsorge-Stufe „Nach einer Empfehlung fragen“. Heute legt sie der Morgenlauf als Stapel-Vorschlag ab (`nachsorgeFaellig`, `lib/fulfillment/prozesse/wirkung.ts:106`; Tage `[14, 45, 90]`, `lib/fulfillment/lesen.ts:83`; Werkzeug `fulfillment_nachsorge`, `lib/fulfillment/prozesse/server.ts:195`). (b) Im laufenden Mandat: Ereignis `ziel-erreicht` (E9), wenn die Zielerreichung eines Wert-Konto-Eintrags die Schwelle überschreitet (`zielErreichung`, `lib/fulfillment/prozesse/wert.ts:18`), bzw. ein Fortschritts-Report ist erstellt (`reportErstellen`, `lib/crm/treppe-server.ts:234`). |
| Ziel erreicht | Ein Intro ist erbeten, und eine Empfehlung kam als Lead mit Herkunft „empfehlung“ an, oder die Frage ist bewusst verschoben. |
| Abbrechen | R1; Mandat-Ampel rot; in den letzten `abstandTage (120)` schon gefragt. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Steht das Mandat gut? | Ampel grün bzw. Health ≥ `healthMin (75)` | `mandatLage`: `lib/crm/kunden.ts:85` (Health > 75 grün, :99) · Playbook `empfehlung` nur mit Health grün: `lib/crm/kampagnen.ts:37` | lesen | — | — | ja → 2 · nein → Ende „nicht jetzt“ |
| 2 | `entscheidung.regel` | Schon gefragt? | Marke `nachsorge:<mandat>:<tag>` bzw. Lauf in den letzten 120 Tagen | `markeNachsorge`: `lib/fulfillment/prozesse/wirkung.ts:100` | lesen | — | — | ja → Ende · nein → 3 |
| 3 | `agent.skill` (Mitarbeiter `kundenerfolg-ausbau`) | Wen könnte die Person kennen? | nur aus dem eigenen CRM: Kreis, Branche, ähnliche Firmen — **keine** Web-Suche; Ausgabe-Vertrag `vorschlaege[{firmaId|beschreibung, warum}]`; Modell `ausgewogen`; `budgetCent (10)` | Kundenprofil und ähnliche Firmen: `lib/crm/kampagnen.ts` (Abschnitt „Kundenprofil“) · Werkzeuge `mandate_lage`, `firma_akte` | vorschlag | — | — | weiter |
| 4 | `aufgabe.anlegen` | Im nächsten Termin um ein Intro bitten | an die Mandats-Zuständige; Beschreibung: Wirkung in einem Satz, 1–3 Namen aus 3; `fristTage (14)` | Wirkung: `wirkungsDokument` `lib/fulfillment/prozesse/wirkung.ts:39` | intern | Mensch | 14 Tage | weiter |
| 5 | `crm.entwurf-text` (Art `nachricht_entwurf`) | Intro-Text zum Weiterleiten | Text für den **Kunden**, den er selbst weiterleitet; erst nach Zusage der Zielperson | Recht im Playbook: „Keine Empfehlungs-Mails an Dritte aus dem System (BGH I ZR 208/12) — der Vermittler fragt selbst.“ `lib/crm/kampagnen.ts:39` | vorschlag | Stapel | 14 Tage | weiter |
| 6 | `warten.ereignis` | Empfehlung abwarten | Ereignis `neuer-lead` mit Fall-Feld `lead.herkunft = empfehlung` bzw. Anfrage-Kanal `empfehlung`; `hoechstensTage (30)` | B1 `FALL_FELDER` `lead.herkunft`: `lib/prozesse/ausloeser.ts` · Herkunft `empfehlung`: `lib/make-one/crm.ts:142` · Kanal: `lib/crm/anfragen.ts:45` | lesen | — | 30 Tage | eingetreten → 7 · abgelaufen → Ende „gefragt, offen“ |
| 7 | `crm.kontakt-pflegen` | „Vorgestellt durch“ eintragen | Feld `vorgestelltDurch` am neuen Kontakt = Empfehlungsgeber | `vorgestelltDurch`: `lib/crm/akte.ts:46` (Einordnungsfeld) — nicht in der Vorschlags-Whitelist (N4) | vorschlag | Stapel | 2 Tage | weiter |
| 8 | `aufgabe.anlegen` + `inbox.mail-entwurf` | Danke an den Empfehlungsgeber | persönlich; Mail nur bei grüner Ampel | Antwort binnen 24–48 Std. (Recherche 4, Erkenntnis 29) | intern / aussen | Mensch / Schloss | 2 Werktage | weiter |
| 9 | `ende.uebergabe` | An Lead-Eingang | Übergabe an V02 (Uhr und Ergebnis) | — | lesen | — | — | Ende |

- **Recht:**
  - Kein Versand an die empfohlene Person aus dem System (BGH I ZR 208/12), nur doppelte Zustimmung.
  - Die Bitte an den eigenen Kunden ist Kommunikation im Mandat.
  - Die empfohlene Person wird mit Herkunft `empfehlung` angelegt, und der Hinweis nach Art. 14 gilt.
  - Eine Empfehlung ist kein Marketing (`ANFRAGE_OHNE_MARKETING`, `lib/crm/scoring.ts:125`). Darum wird sie nie MQL, sondern direkt qualifiziert.
- **Kennzahlen:**
  - Menge: erbetene Intros.
  - Umwandlung: Intros je angesprochener Person (`kennzahl` des Playbooks, `lib/crm/kampagnen.ts:39`), Empfehlung → SQL.
  - Zeit: Tage bis zur Empfehlung.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der fälligen Nachsorge-Empfehlungen, die gestellt wurden.
  - Der Kanal-Anteil „empfehlung“ kommt aus `kanalVon` (`lib/crm/kanal.ts:16–23`). Das Scoring-Kriterium `empfehlung` bleibt (`lib/crm/scoring.ts:306–309`).
- **Einstellbar:** `nachMandatsendeTage (45)`, `zielSchwelle (100 %)`, `healthMin (75)`, `abstandTage (120)`, `terminFristTage (14)`, `wartenTage (30)`, `budgetCent (10)`.
- **Was fehlt im Code:**
  - E9: `ziel-erreicht` bzw. `report-erstellt`. Einen Zustand „Ziel erreicht“ gibt es nicht, nur den Prozentwert.
  - E4: `mandat-beendet` für Auslöser (a) ohne Morgenlauf.
  - `neuer-lead` trägt keine Herkunft. Der Motor liest sie als Fall-Feld nach (B1).
  - N4: `vorgestelltDurch` vorschlagbar machen.
  - Doppelte Wahrheit vermeiden: Die Nachsorge-Stufe „empfehlung“ im Morgenlauf wird beim Umzug in den Motor durch diese Vorlage ersetzt (E3-Regel:
    erst „System“, dann Motor).
- **Demo:** Das Saat-Mandat `m-demo-nordwerk` mit `sophie`: Ziel „Termine je Monat“ zu 100 % erreicht → Aufgabe „Intro erbitten“. 20 Tage später kommt eine
  erfundene Anfrage über Kanal `empfehlung` von `kai.beispiel@example.invalid`; Danke-Aufgabe und Übergabe an V02 folgen.

### V15 · Bestandskunden-Ausbau & Verlängerung

| Feld | Wert |
|---|---|
| Zweck | 90 Tage vor Laufzeitende spricht man über Ergebnisse statt auf die Kündigungsfrist zu warten. Daraus entstehen ein Verlängerungsangebot oder ein Ausbau-Deal, und die Kündigungsfrist ist nie eine Überraschung. |
| Bereich · Fall | Ausbau · `mandat` |
| Eigner-Rolle | Verantwortlich Kundenerfolg (Mitarbeiter `kundenerfolg-betreuung`); Fall-Zuständige = Mandats-Zuständige |
| Auslöser | Datum am Fall `mandat.ende`, Versatz `−90` (Playbook `verlaengerung` „Laufzeitende in 90 Tagen“, `lib/crm/kampagnen.ts:79`, Filter :161). Das Ende rechnet `mandatFristen` (`lib/crm/kunden.ts:74`): ohne `ende` aus Start + Mindestlaufzeit, bei `verlaengerung = auto` monatsweise weiter (:75–80). Das macht die Vorlage je Periode wiederkehrend (M2). |
| Ziel erreicht | Verlängert (Angebot angenommen bzw. automatische Verlängerung bestätigt), ein Ausbau-Deal angelegt, oder ein bewusster Abschied (dann Übergabe an V14). |
| Abbrechen | Mandat `beendet` oder `pausiert` (`MandatStatus`, `lib/crm/typen.ts:110`); R1. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `crm.firma-akte` | Lage lesen | Ampel, Health, Gründe, Monatswert, Zielerreichung | `mandatLage`: `lib/crm/kunden.ts:85` (rot: aktiv, Ende ≤ 60 Tage, nicht auto, :100) · `zielErreichung`: `lib/fulfillment/prozesse/wert.ts:18` | lesen | — | — | weiter |
| 2 | `entscheidung.regel` | Risiko? | Ampel rot oder Health < `healthGelb (60)` | — | lesen | — | — | ja → 2r · nein → 3 |
| 2r | `aufgabe.anlegen` + `glocke.melden` | Risiko-Gespräch | an die Zuständige, Glocke an den Eigner; `fristTage (5)` | — | intern | Mensch | 5 Werktage | weiter → 3 |
| 3 | `agent.skill` (Mitarbeiter `kundenerfolg-betreuung`) | Ergebnisse gegen Ziele aufbereiten | Eingabe: Mandat-Ziele (`Mandat.ziele`, `lib/crm/typen.ts:137`), Wirkung, Reports; Ausgabe-Vertrag `agenda[], ausbauAnlass?, risiko?`; Modell `ausgewogen`; `budgetCent (15)` | `wirkungsDokument`: `lib/fulfillment/prozesse/wirkung.ts:39` · Report: `lib/crm/treppe-report.ts:87` | vorschlag | — | — | weiter |
| 4 | `kalender.einladung` | Review-Termin mit dem Entscheider | Gäste aus dem Mandat; `dauerMin (60)`; Agenda aus 3 | Einladung nur nach Rückfrage | aussen | Schloss | `reviewTage (14)` | weiter |
| 5 | `entscheidung.regel` | Verlängert es sich von selbst? | `Mandat.verlaengerung` (`lib/crm/typen.ts:128`: auto · manuell · offen) | — | lesen | — | — | auto → 7 · manuell/offen → 6 |
| 6 | `angebot.entwurf` | Verlängerungsangebot entwerfen | Vorbelegung aus dem Mandat; Optionen aus der Leistungstreppe | `mandatVorbelegung`: `lib/crm/angebote.ts:531` · nächste Stufe der Treppe: `lib/crm/treppe-server.ts:352` | vorschlag | Stapel | `angebotTage (21)` | weiter |
| 7 | `entscheidung.mensch` | Ausbau-Signal im Review? | nach dem Review: nächster Engpass ja/nein | Playbook `upsell`: `lib/crm/kampagnen.ts` („Drei Optionen aus dem Leistungskatalog“) | intern | Mensch | 3 Werktage nach dem Review | ja → 7d · nein → 8 |
| 7d | `crm.deal-anlegen` als Vorschlag | Ausbau-Deal | Quelle `bestand` (`Quelle`, `lib/crm/typen.ts:57`); nächster Schritt Pflicht | `dealAnlegen`: `lib/crm/deal-anlegen.ts:177` | vorschlag | Stapel | 5 Tage | weiter → 8 |
| 8 | `warten.datum` | Bis zur Kündigungsfrist | Feld `mandat.kuendigungsfrist`, Versatz `−14` | `kuendigungVorlaufTage = 14`: `lib/kalender/einstellungen.ts:80` · Heute zeigt Kündigungsfristen schon mit Vorlauf (`lib/heute/anstehend.ts:161`) | lesen | — | — | erreicht → 9 · Angebot angenommen vorher → Ende „verlängert“ |
| 9 | `entscheidung.regel` | Verlängerung gesichert? | Angebot angenommen oder `verlaengerung = auto` und keine Kündigung | — | lesen | — | — | ja → Ende · nein → Glocke an den Eigner „Kündigungsfrist in 14 Tagen“ → Ende (bei Mandatsende Übergabe an V14) |

- **Recht:**
  - Kommunikation im laufenden Mandat ist frei. Ein werbliches Angebot per Mail verlangt bei Bestandskunden den Hinweis bei Erhebung (R3, `lib/crm/recht.ts:76–78`).
  - Das Verlängerungsangebot wird nur per Klick gestellt (Klasse aussen).
- **Kennzahlen:**
  - Menge: Mandate mit Laufzeitende im Fenster.
  - Umwandlung: Verlängerungsquote (fehlt) und Zusatzmandate (Playbook `upsell`).
  - Zeit: Tage vor Ende, an denen das Review stattfand.
  - Wert: `mrr` (`lib/crm/traktion-index.ts:47`).
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil der Mandate mit Review ≥ 60 Tage vor Ende. Die Fulfillment-Säule (`ff_health`,
    `lib/fulfillment/prozesse/kennzahlen.ts:110`) bleibt die Wahrheit für die Gesundheit.
- **Einstellbar:** `vorEndeTage (90)`, `healthGelb (60)`, `reviewTage (14)`, `angebotTage (21)`, `kuendigungVorlaufTage (14)` (Vorgabe aus den
  Kalender-Einstellungen, nie doppelt), `budgetCent (15)`.
- **Was fehlt im Code:**
  - M2: Wiedereintritt je Periode. Die Lauf-Kennung braucht Prozess + Mandat + `endeAm`.
  - E9: Report/Ziel als Ereignis für einen Ausbau-Auslöser mitten in der Laufzeit (ANALYSE_100 Punkt 78).
  - Kennzahl „Verlängerungsquote“ fehlt.
  - Der monatliche Head-Modus `kundenreview` (1. Werktag 9 Uhr, `lib/heads/takt.ts:115`) überschneidet sich. Er bleibt Beratung, diese Vorlage handelt.
  - Demo-Mandate haben weder `ende` noch `kuendigungsfristTage` (`lib/demo/saat.ts:306–307`).
- **Demo:** Das Saat-Mandat `m-demo-nordwerk` bekommt in der Saat `mindestlaufzeitMonate` und `kuendigungsfristTage`, sodass das Ende in 85 Tagen liegt.
  Ergebnis: Review-Einladung im Stapel, danach ein Ausbau-Deal-Vorschlag.

### V16 · Newsletter-Anmeldung (Double-Opt-in) → Begleitung

| Feld | Wert |
|---|---|
| Zweck | Eine neue Newsletter-Einwilligung mit vollem Nachweis wird begleitet: Willkommen, Marketing-Lead-Prüfung, nach 30 Tagen ein Blick auf echte Signale (Antwort, Anfrage, Event) — ohne Öffnungs- oder Klick-Tracking. |
| Bereich · Fall | Marketing · `lead` (Person) |
| Eigner-Rolle | Verantwortlich Marketing |
| Auslöser | Ereignis `einwilligung-erteilt` (E6), nur wenn Kanal = `newsletter` und der Nachweis vollständig ist. Bis dahin: von Hand je Person bzw. Playbook `newsletter`, bei dem die Einwilligung im Gespräch entsteht (`lib/crm/kampagnen.ts`, Schritt „Double-Opt-in-Mail auslösen (Versandwerkzeug)“). Später: Webhook „DOI bestätigt“ vom Versandwerkzeug (B1 `ausloeser.webhook`, Entscheidung E-V2). |
| Ziel erreicht | Abonnent begrüßt; bei Signal: Übergabe an die Qualifizierung. |
| Abbrechen | R1; Widerruf der Einwilligung (`widerrufenAm`); Abmeldung über den Abmeldelink. |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `entscheidung.regel` | Nachweis vollständig? | Zeitpunkt, erfasst von, Wortlaut, Beleg | `nachweisLuecken`: `lib/crm/einwilligung.ts:56` · Newsletter-Ampel grün nur mit vollem Nachweis: `lib/crm/recht.ts:56–63` · Einwilligungs-Typ: `lib/make-one/crm.ts:156–172` | lesen | — | — | ja → 3 · nein → 2 |
| 2 | `aufgabe.anlegen` | Nachweis ergänzen | an die Person, die erfasst hat; ohne Nachweis kein Newsletter | Karte „Einwilligung ohne vollständigen Nachweis“ (`nachweisOffen`, `lib/crm/einwilligung.ts`) | intern | Mensch | 5 Werktage | Ende |
| 3 | `entscheidung.score` | Marketing-Lead? | Prüfung `mql` (Newsletter mit vollem Nachweis zählt als Marketing-Herkunft) | `marketingHerkunft` / `istMarketingLead`: `lib/crm/scoring.ts:137–168` · `mqlErreicht`: `lib/crm/leads.ts:414` | lesen | — | — | MQL → 3q · sonst → 4 |
| 3q | `aufgabe.anlegen` | MQL prüfen | an die Verantwortliche Sales; Übergabe Marketing → Sales | — | intern | Mensch | 2 Werktage | weiter → 4 |
| 4 | `inbox.mail-entwurf` | Willkommen | Nutzen in einem Satz; Abmeldelink Pflicht; keine Angebote | `abmeldeLink`: `lib/datenschutz/abmelden.ts:38` | aussen | Schloss | `willkommenTage (1)` | weiter |
| 5 | `warten.dauer` | Begleiten | `tage (30)` | — | lesen | — | — | weiter |
| 6 | `entscheidung.score` | Echte Signale? | Antwort, Anfrage, Event-Anmeldung seit der Einwilligung; Temperatur ≥ `lau` | `leadScore`: `lib/crm/score.ts:47` · Event-Anmeldung als Marketing: `alsMarketingAnmeldung` `lib/crm/marke.ts:124` | lesen | — | — | ja → 7 · nein → Ende (bleibt Abonnent) |
| 7 | `aufgabe.anlegen` | Persönlich nachfassen | an Besitzer bzw. Verantwortliche Sales; Kanal nach Ampel | `besterKanal`: `lib/crm/recht.ts:98` | intern | Mensch | 5 Werktage | Ende → Übergabe an V02 |

- **Recht:**
  - Double-Opt-in ist Pflicht. Der Nachweis enthält Zeitpunkt und Wortlaut (Playbook-Recht, `lib/crm/kampagnen.ts`). Eine Visitenkarte ist keine Einwilligung.
  - Jede Mail hat einen Abmeldelink (`lib/datenschutz/abmelden.ts`).
  - Es gibt kein Öffnungs- und Klick-Tracking (Regel „keine Tracker“). Darum zählen nur eigene Signale.
  - Eine Einwilligung wird nie automatisch gesetzt.
- **Kennzahlen:**
  - Menge: neue Double-Opt-ins (Playbook-Kennzahl) und `newsletter_netto` (`lib/crm/traktion-index.ts:56–62`).
  - Umwandlung: Abonnent → MQL → SQL.
  - Zeit: Tage bis zum ersten Signal.
  - Abmeldequote: `abmeldequote`.
  - Der Säule „Prozesse“ liefert die Vorlage den Anteil begrüßter Abonnenten in 1 Werktag.
- **Einstellbar:** `willkommenTage (1)`, `begleitTage (30)`, `signalSchwelle (lau)`, `mqlUebergabe (an)`.
- **Was fehlt im Code:**
  - Es gibt keinen Anmelde-Eingang: keine Route, kein Formular, keinen Webhook (`middleware.ts`), und die Marketing-Route exportiert nur Empfänger als CSV
    (`app/api/crm/marketing/route.ts:63–65`).
  - Es gibt keinen Versand der Bestätigungsmail, denn MAKE OS verschickt nichts selbst.
  - E6: Einwilligung als Ereignis (Kartei-Diff wie `karteiDiffSql`, `lib/ereignisse/quellen.ts:172`).
  - Entscheidung E-V2.
- **Demo:** Für die Saat-Person `nina` wird eine erfundene Newsletter-Einwilligung mit vollem Nachweis angelegt (Wortlaut „Beispiel-Newsletter v1“). Willkommen
  liegt im Stapel, 30 Tage später meldet sie sich zu einem Event an → Aufgabe „persönlich nachfassen“.

### V17 · Buchungsanfrage → Vorbereitung

| Feld | Wert |
|---|---|
| Zweck | Eine Buchungsanfrage über die öffentliche Buchungsseite wird binnen einer Uhr freigegeben oder abgelehnt. Bestätigte Termine werden vorbereitet (Leitfaden, offene Kernfragen, Deal- oder Qualifizierungs-Vorschlag) und danach nachbereitet (V11). |
| Bereich · Fall | Sales · `lead`, mit offenem Deal `deal` |
| Eigner-Rolle | Verantwortlich Sales; Fall-Zuständige = Person der Buchungsseite (`seite.person`) |
| Auslöser | Ereignis `buchung-angefragt` (E5). Heute meldet `anfrageLauf` nur die Glocke, Art `buchung` (`lib/kalender/buchung-ablauf.ts:107–117`, `melde` :113), und kein Ereignis. Rückfall: Zeitplan werktags stündlich gibt es nicht (M10). Deshalb ist bis E5 nur die Glocke da. |
| Ziel erreicht | Die Buchung ist bestätigt, der Termin vorbereitet, und nach dem Termin übernimmt V11 (Übergabe). |
| Abbrechen | Buchung `abgelehnt`, `abgesagt` oder `abgelaufen` (`BuchungStatus`, `lib/kalender/buchung.ts:140`); R1 (bei Art. 18 legt die Buchung ohnehin nichts an). |

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | `aufgabe.anlegen` | Buchung freigeben oder ablehnen | an die Person der Seite; Hinweis bei unbestätigter Mail-Adresse; `fristStunden (4)` | Freigabe-Schritte `kontakt · termin · buchung · kartei · crm`: `lib/kalender/buchung-ablauf.ts:69` · Konflikt-Prüfung `istFrei` bei der Freigabe | intern | Mensch | 4 Std. | weiter |
| 2 | `warten.ereignis` | Freigabe abwarten | E5 `buchung-bestaetigt`; `hoechstensStunden (24)` (M1) | — | lesen | — | 24 Std. | bestätigt → 3 · abgelehnt → Ende · abgelaufen → `erinnerung.runde` (Eigner) → 2 (1×) |
| 3 | `entscheidung.regel` | Was schlägt die Buchung vor? | Lead `qualifizierung`/`sql` ohne offenen Deal → Deal · `neu`/`kontaktiert`/`im_gespraech` → Qualifizierung | `folgeVorschlag`: `lib/kalender/buchung-ablauf.ts:451` (legt nichts an) | lesen | — | — | Deal → 4d · Qualifizierung → 4q · nichts → 5 |
| 4d | `crm.deal-anlegen` als Vorschlag | Deal vorschlagen | nächster Schritt = der gebuchte Termin | `dealAnlegen`: `lib/crm/deal-anlegen.ts:177` | vorschlag | Stapel | vor dem Termin | weiter → 5 |
| 4q | `crm.lead-qualifizieren` | Qualifizierung starten | Status `qualifizierung` | — | vorschlag | Stapel | vor dem Termin | weiter → 5 |
| 5 | `agent.zoe` | Termin vorbereiten | Eingabe: Antworten auf die Fragen der Buchungsseite (fremd), Akte, fehlende Kernfragen; Ausgabe-Vertrag `leitfaden[], offeneFragen[]`; Modell `schnell`; `budgetCent (8)` | `fehltBisSqlZeile`: `lib/crm/leads.ts:402` | vorschlag (fremd: buchung) | — | — | weiter |
| 6 | `crm.entwurf-text` (Art `anruf_leitfaden`) | Leitfaden bereitlegen | am Follow-up „Termin vorbereiten“ | Follow-up „Termin vorbereiten“ mit `terminUid`, fällig am Vortag: `lib/kalender/buchung-ablauf.ts:327`, `vorbereitenTag` `lib/kalender/buchung.ts:441` | vorschlag | Stapel | Vortag | weiter |
| 7 | `warten.ereignis` | Termin abwarten | E1 `termin-vorbei` mit der `terminUid`; `hoechstensTage (60)` | — | lesen | — | — | vorbei → 8 · abgesagt → Ende |
| 8 | `ende.uebergabe` | An die Nachbereitung | Übergabe an V11 | — | lesen | — | — | Ende |

- **Recht:**
  - Für die Buchung gilt eine Rechtsgrundlage, Art. 6 Abs. 1 lit. b. Das Häkchen ist eine Kenntnisnahme, keine Einwilligung. Werbung ist daraus nicht
    erlaubt.
  - Die Antworten der Gäste sind fremder Text. Darum gibt es danach nur Vorschläge.
  - Eingeladen wird an eine unbestätigte Adresse nur mit Warnhinweis (R-K2).
  - Ein CRM-Eintrag entsteht erst bei der Freigabe.
- **Kennzahlen:**
  - Menge: Buchungsanfragen.
  - Umwandlung: angefragt → bestätigt → Deal/Qualifizierung.
  - Zeit: Stunden bis zur Freigabe (Leitkennzahl, fehlt). Sie füttert die Säule „Prozesse“ (Anteil in 4 Std.).
  - Der Termin zählt dann über V11 in `erstgespraeche`.
- **Einstellbar:** `freigabeStunden (4)`, `eskalationStunden (24)`, `vorbereitenAm (Vortag)`, `budgetCent (8)`.
- **Was fehlt im Code:**
  - E5: Buchung angefragt/bestätigt als Ereignis.
  - E1: `termin-vorbei`.
  - E12: Die Buchungsfreigabe legt Personen über `anfrageBauen` an (`lib/kalender/buchung-ablauf.ts:160`), aber ohne `neuer-lead`.
  - M1: Uhr in Stunden.
  - Unstimmig: `vorbereitenTag` sagt im Kommentar „Werktag“, zieht im Code aber einen Kalendertag ab (`lib/kalender/buchung.ts:441–446`).
- **Demo:** Eine erfundene Buchungsseite „Erstgespräch (Beispiel)“ bekommt eine Anfrage von `lisa.probe@example.invalid` (neue Person). Die Freigabe-Aufgabe
  ist nach 2 Std. erledigt. Im Stapel liegen „Qualifizierung starten“ und der Leitfaden für den Vortag.

### V18 · Make.One-Gästeliste

| Feld | Wert |
|---|---|
| Zweck | Für jeden eigenen Abend die Gästeliste in der richtigen Mischung aufbauen, einladen, erinnern und binnen 48 Stunden nachfassen. Die Einladungs-Wege folgen der Ampel, die Folgegespräche gehen in die Qualifizierung. |
| Bereich · Fall | Marketing · `event` (nur eigene Abende, nie `istNetzwerkenEvent`, `lib/crm/marke.ts:135`); je Gast Teilprozess V18a (Fall `lead`) |
| Eigner-Rolle | Verantwortlich Event (`verantwortlich('event')`); je Gast die einladende Person (`einlader`, `lib/crm/eventplanung.ts:318`) |
| Auslöser | Datum am Fall `event.datum`, Versatz `−28`. Das ist der Rhythmus des Playbooks `event`: einladen an Tag 7, erinnern an Tag 21, nachfassen an Tag 30 (`lib/crm/kampagnen.ts:63–67`). Mit E7: zusätzlich Status `einladung` (`Event.status`, `lib/crm/typen.ts:510`). |
| Ziel erreicht | Das Event ist durchgeführt, und alle Teilnehmenden sind binnen 48 Std. nachgefasst. |
| Abbrechen | Event `abgesagt`; R1 je Gast. |

**Hauptlauf**

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| 1 | neu: `event.gaeste` (N8) | Gäste vorschlagen | `n (12)`; Segment des Events; Mischung `zielkunden (40 %)`, `kunden (20 %)` | `gaesteVorschlag`: `lib/crm/eventplanung.ts:491` · `mix`: `:177` · `MIX_STANDARD`: `:148` · Vorschlags-Art `gaesteliste` („vorgemerkt“, nur zulässiger Einladungskanal): `lib/zoe/crm-vorschlag.ts:42–61` | vorschlag | Stapel | `listeTage (3)` | angenommen → 2 |
| 2 | `aufgabe.anlegen` (je Checklisten-Punkt) | Checkliste als Aufgaben | Punkte mit Vorlauf; Bearbeiter aus `wer` | `checklisteAlsAufgaben`: `lib/crm/eventplanung.ts:262` (Kennung `aufgabenId` `:241`, idempotent) | intern | — | je Punkt | weiter |
| 3 | `schleife.je-eintrag` | Jeden Gast einladen | Teilprozess V18a; `hoechstens (kapazitaet × 2)` | `gastVormerken`: `lib/crm/eventplanung.ts:573` | lesen | — | — | weiter |
| 4 | `warten.datum` | Eine Woche vorher | `event.datum −7` | — | lesen | — | — | weiter |
| 5 | `entscheidung.regel` | Mischung erreicht? | `mix` gegen `mixZiel` | `mix`: `lib/crm/eventplanung.ts:177` | lesen | — | — | ja → 6 · nein → `agent.head` (Head of Event, Modus `planung`, `lib/heads/takt.ts:127`) schlägt weitere Gäste vor (Stapel) → 6 |
| 6 | `warten.datum` + `inbox.mail-entwurf` | Erinnern | `event.datum −1`; nur Zugesagte, nur Mail bei grün | `TeilnahmeStatus`: `lib/crm/typen.ts:607` | aussen | Schloss | Vortag | weiter |
| 7 | `warten.datum` | Tag nach dem Event | `event.datum +1`, `09:00` | Head of Event `nachfassen` am Tag nach dem Event: `lib/heads/takt.ts:126` | lesen | — | — | weiter |
| 8 | `agent.skill` (Mitarbeiter `event-nachfassen`) | Nachfassen 48 h vorbereiten | je einladende Person eine Liste; Danke/Folge-Entwürfe nur für Status `da`; `budgetCent (10)` | `nachfassGruppen`: `lib/crm/eventplanung.ts:364` · `followUpBis = datum + 2`: `lib/crm/events.ts:19` | vorschlag | Stapel (Entwürfe) / Schloss (Mails) | 48 Std. | weiter |
| 9 | `entscheidung.regel` | 48-Stunden-Ziel erreicht? | `nachfassen_48h` ≥ `ziel (90 %)` | `nachfassen_48h`: `lib/crm/traktion.ts:114`, `lib/crm/traktion-index.ts:65` · Ziel 90: `lib/crm/scoreboard.ts:113` | lesen | — | — | ja → Ende · nein → Glocke an den Eigner → Ende |

**Teilprozess V18a · Einen Gast einladen** (Fall `lead`)

| # | Baustein | Titel | Einstellungen (Vorgabe) | nutzt | Klasse | Freigabe | Frist | Ausgänge |
|---|---|---|---|---|---|---|---|---|
| a1 | `entscheidung.regel` | Einladungsweg | Mail nur bei grüner Ampel, sonst persönlich | `einladungswegAus`: `lib/crm/eventplanung.ts:541` · Kanal `einladung`: `lib/crm/recht.ts:25` | lesen | — | — | mail → a2 · persönlich → a3 |
| a2 | `inbox.mail-entwurf` | Einladung schreiben | Text aus der Vorlage; Marke/Reihe im Titel | `einladungText`: `lib/crm/eventplanung.ts:591` | aussen | Schloss | `event.datum −21` | weiter → a4 |
| a3 | `aufgabe.anlegen` | Persönlich einladen | an die einladende Person; Leitfaden | `einlader`: `lib/crm/eventplanung.ts:318` | intern | Mensch | `event.datum −21` | weiter → a4 |
| a4 | `entscheidung.mensch` | Antwort festhalten | zugesagt · abgesagt · keine Antwort | Teilnahme-Status: `lib/crm/typen.ts:607` | intern | Mensch | `event.datum −3` | Ende |

- **Recht:**
  - Eine Einladung zum eigenen Event ist Werbung (§ 7 UWG). Eine Teilnahme ist keine Einwilligung (Playbook `event`, `lib/crm/kampagnen.ts:63–67`).
  - Die Personen-Schranke prüft jede neue Teilnahme. Bei Werbesperre wird niemand vorgemerkt (`gastVormerken`).
  - Danke-Mails danach enthalten nur Dank und Verabredetes.
- **Kennzahlen:**
  - Menge: `events_90`, Gäste je Event.
  - Umwandlung: `erscheinen`, `folgegespraeche` (Ziel ≥ 3 je Event).
  - Zeit: `nachfassen_48h`. Die Kennzahlen stehen in `lib/crm/traktion.ts:38–43`.
  - Der Säule „Prozesse“ liefert die Vorlage `nachfassen_48h` als Befolgungsquote.
  - Je Reihe: `reihenUebersicht` (`lib/crm/reihen.ts:49`).
- **Einstellbar:** `vorlaufTage (28)`, `einladenBisTage (21)`, `erinnernTage (1)`, `n (12)`, `mixZielkunden (40)`, `mixKunden (20)`, `ziel48h (90)`, `budgetCent (10)`.
- **Was fehlt im Code:**
  - E7: Event-Status bzw. „Event vorbei“ als Ereignis.
  - N8: Gästeliste und Einladung als Katalog-Bausteine.
  - M8: Die Demo-Saat sät keine Events und keine Teilnahmen.
  - Doppelte Wahrheit vermeiden: Die Head-Event-Modi `planung` und `nachfassen` bleiben Beratung, diese Vorlage handelt (E3-Regel).
- **Demo:**
  - Ein erfundener Make.One-Abend „Beispiel-Stammtisch“ in 28 Tagen. 12 Gäste werden vorgeschlagen: 5 Zielkunden, 3 Kunden aus der Saat (`sophie`, `paul`) und
    erfundene `…@example.invalid`.
  - Ergebnis: 4 Mails im Stapel, 8 persönliche Einladungen. Nach dem Abend 6 Nachfass-Entwürfe, Quote 100 %.

---

## 5. Gemeinsame fehlende Bausteine und Ereignisse (für Etappe C)

### 5.1 Neue Ereignisse (Quelle melden über `ereignis()`, `lib/ereignisse/server.ts:42` — wirft nie, nur Kennungen)

| Nr | Ereignis-Art | Wo melden (Schreibweg) | Für | Größe |
|---|---|---|---|---|
| E1 | `termin-vorbei` (Name da: `lib/ereignisse/arten.ts:21`) | Kalender-Takt: Termin mit Eintrag in `kalender-bezug` und Ende ≤ jetzt. Vorbild `terminAbsagenEreignisse` (`lib/ereignisse/quellen.ts:242`). Kennung `kalender:<uid>:vorbei`. Abgesagte und ganztägige nie. | V11, V17 | M |
| E2 | `netzwerken-erfasst` | `erfassungAusfuehren`, nach Schritt `melden` (`lib/crm/netzwerken-server.ts:169`, `:630`); Bezug kontaktId, firmaId | V04, V01 | S |
| E3 | `angebot-gestellt` · `angebot-antwort` | `angebotStellen` (`lib/crm/angebot-server.ts:226`) und `antwortSetzen` (`:502`); Bezug dealId, kontaktId | V10 | S |
| E4 | `mandat-angelegt` · `mandat-beendet` | `crmDiff` um `mandate` erweitern (`lib/ereignisse/quellen.ts:150`), heute nur `chancen`/`firmen` | V12, V14, V15 | S |
| E5 | `buchung-angefragt` · `buchung-bestaetigt` | `anfrageLauf` (`lib/kalender/buchung-ablauf.ts:107`) und Freigabe-Schritt `crm` (`:327`). Achtung: `BEZUG_FELDER.buchungId` meint heute Bankbuchungen (`lib/ereignisse/quellen.ts:134`). Darum braucht es ein eigenes Feld `terminBuchungId`. | V17 | S |
| E6 | `einwilligung-erteilt` (mit Kanal) | Kartei-Diff wie `karteiDiffSql` (`lib/ereignisse/quellen.ts:172`): neue, nicht widerrufene Einwilligung mit vollem Nachweis; nur Kanal + Kennung | V16 | S |
| E7 | `event-vorbei` · Event-Status | `crmDiff` um `events` (Status) erweitern + Takt am Tag nach `datum`; besuchte und eigene Events über `istNetzwerkenEvent` unterscheiden | V18, V04 | M |
| E8 | `antwort-gesendet` (eigene ausgehende Mail/WhatsApp an einen Kontakt) · `followup-erledigt` | Gmail-/IMAP-Abgleich (heute filtert `eingehend()` sie heraus, `lib/ereignisse/quellen.ts:73`), Senden (`lib/gmail/senden.ts`, `lib/whatsapp/senden.ts`), Follow-up erledigen (`app/api/crm/followup/route.ts:192`) | V02, V03, V10 | M |
| E9 | `ziel-erreicht` · `report-erstellt` | Fulfillment: `zielErreichung` überschreitet die Schwelle (`lib/fulfillment/prozesse/wert.ts:18`) bei einer neuen Messung; `reportErstellen` (`lib/crm/treppe-server.ts:234`) | V14, V15 | M |
| E10 | `linkedin-antwort` · `vernetzt` | Netzwerk-Route `vernetzt` (`app/api/crm/netzwerk/route.ts:138`), `antwort` (`:154`) | V05 | S |
| E11 | `kampagne-aktiv` · `kampagnen-ergebnis` | Kampagnen-Route (`app/api/crm/kampagnen/route.ts:128`) bzw. `crmDiff` über `kampagnen` | V06 | S |
| E12 | `neuer-lead` auch aus Netzwerken-Neuanlage und Buchungsfreigabe | `anfrageEreignis` (`lib/ereignisse/quellen.ts:189`) zusätzlich in `erfassungAusfuehren` (Schritt `kontakt`, neu angelegt) und `buchung-ablauf.ts:160` aufrufen | V02 | S |
| E13 | Bezug `gespraech` für IMAP und WhatsApp | `imapEreignisse` (`lib/ereignisse/quellen.ts:90–95`), `whatsappEreignisse` (`:100–112`) | V03 | S |

Für alle neuen Arten gilt: ein Eintrag in `SkillEreignis` (`lib/agenten/typen.ts:350`), in `EREIGNIS_NAME` und in `EREIGNISSE_ANGEBUNDEN`
(`lib/ereignisse/arten.ts:18–25`). Es bleibt eine Liste, keine zweite. Für die Ereignisse, die ein Lauf selbst auslöst, gilt der Schleifenschutz über die
Herkunft `prozess:<id>` (ANALYSE_100 Punkt 49).

### 5.2 Neue Bausteine im Katalog (B1 `lib/prozesse/baustein-katalog.ts`)

| Nr | Baustein | Was | Baut auf | Für |
|---|---|---|---|---|
| N1 | `crm.abfrage` | Liste von Fällen, nur Kennungen. Der Typ ist da (B1 `CrmAbfrage`, `lib/prozesse/definition.ts`), der Katalog-Eintrag fehlt. Neue Arten zu den fünf vorhandenen (`:271`): `leads-wiedervorlage`, `deals-wiedervorlage`, `netzwerken-offen`, `nachbereiten`, `vernetzen-runde`, `powerhour-karten`, `kampagne-personen`, `mandate-laufzeitende`. | `leads` `lib/crm/leads.ts:163` · `faellige` `lib/crm/followup.ts:179` · `gesundheit` `lib/crm/pipeline.ts:89` · `nachbereitung` `lib/crm/erfassen.ts:121` · `netzRunde` `lib/crm/netzwerk.ts:122` · `werIstDran` `lib/crm/heute.ts:125` · `mandatFristen` `lib/crm/kunden.ts:74` · immer über `kontakteFuerVerarbeitung` | V01, V04–V07, V09 |
| N2 | `entscheidung.score` | Score-Raute. Der Typ ist da (B1 `RautenRegel` `art: 'score'`, `lib/prozesse/definition.ts–254`), der Katalog-Eintrag fehlt. | `leadScore` + `scoringKontext` (`lib/crm/score.ts:38`, `:47`) · `salesBereit`/`mqlErreicht` (`lib/crm/leads.ts:400`, `:414`) | V01–V03, V08, V16 |
| N3 | `crm.entwurf-text` | Text-Entwurf ohne Versand (LinkedIn, Anruf-Leitfaden, Intro, Danke, Einladung) | `crm_vorschlag` NUR_TEXT-Arten (`lib/zoe/crm-vorschlag.ts:42–64`) | V01, V02, V04–V08, V10, V14, V17 |
| N4 | `crm.karte-ergaenzen` | Ein Ergebnis aus Recherche oder Agent in die Akte bringen | `kontakt_felder` um `aufhaenger`, `signale`, `marktinfo`, `recherche`, `steckbrief`, `vorgestelltDurch` erweitern (Whitelist `lib/zoe/crm-vorschlag.ts:234–262`) + neue Art `firma_felder` (`branche`, `branchen`, `mitarbeiter`, `stadt`, `webseite`, `linkedin`, `marktinfo` — `lib/crm/typen.ts:455–467`) | V01, V14 |
| N5 | `crm.lead-parken` | Parken bzw. Wiedervorlage als Vorschlag | Vorschlags-Art `lead_parken` → `app/api/crm/lead/route.ts:276–297` (heute nur von Hand, `:101`) | V08, V13 |
| N6 | `crm.mandat-anlegen` | Mandat aus einem gewonnenen Deal (Klasse geld) | `app/api/crm/lead/route.ts:147–208` | V12 |
| N7 | `fulfillment.fall-starten` | Fall sofort vorschlagen | Werkzeug `fulfillment_onboarding` (`lib/fulfillment/prozesse/server.ts:195`) → `fallStartenServer` (`lib/fulfillment/prozesse/fall-server.ts:97`) | V12 |
| N8 | `event.gaeste` | Gästeliste und Einladung | `gaesteVorschlag`, `einladungText` (`lib/crm/eventplanung.ts:491`, `:591`); Vorschlags-Arten `gaesteliste`, `einladung_entwurf` | V18 |
| N9 | `crm.kampagnen-ergebnis` | Ergebnis je Person (fünf Ausgänge) | `app/api/crm/kampagnen/route.ts:128` | V06 |
| N10 | `crm.anfrage-anlegen` | Webhook-Felder → Anfrage, als Vorschlag | `anfrageBauen` (`lib/crm/anfragen.ts:144`) über `/api/crm/anfrage` | V02, V16 |
| N11 | `ausloeser.loop` | „Nach dem Morgenlauf“. Der Typ ist da (B1 `lib/prozesse/definition.ts`), der Katalog-Eintrag fehlt. **Quelle:** das Ende von `app/api/tagesstart/route.ts` (startet `/api/tageslauf`, :314–322), nicht `/api/loop`. Dort ruft niemand automatisch `morgen` auf (nur `components/os/LoopView.tsx:77` von Hand). | Morgenlauf: Systemlauf `lib/zoe/agenten.ts:303` | V07 (statt Uhrzeit), „Loops“ allgemein |
| N12 | Versand nach Freigabe | Mail über `/api/inbox/senden`, WhatsApp über `/api/whatsapp/senden` und Inbox-Aktionen (zuordnen) mit der **Sitzung der freigebenden Person**. Heute gibt es aus dem Stapel nur Text bzw. `mailto` (`NUR_TEXT`), und die Routen verlangen die eigene Sitzung (Dienstweg 403). | Stapel-Art `prozess` (ANALYSE_100 Punkt 61) | V02–V04, V10–V12, V14–V18 |

### 5.3 Motor, Leser, Daten

| Nr | Was fehlt | Wo | Für |
|---|---|---|---|
| M1 | Warten auf ein Ereignis mit Obergrenze in **Stunden**. B1 `WartenRegel.ereignis` hat nur `hoechstensTage` (`lib/prozesse/definition.ts`). Dazu gehört „Arbeitszeit zählen“ (Business-frei, Feiertage). | Motor | V02, V03, V11, V12, V17 |
| M2 | Wiedereintritt je Fall nach `erneutNachTagen` bzw. je Periode (Lauf-Kennung aus Prozess + Fall + Periode) — ANALYSE_100 Punkt 35 | Motor | V01, V08, V15 |
| M3 | Fall-Art `kampagne` und Bezug `terminUid` als Fall-Feld. B1 `FallArt` kennt sie nicht (`lib/prozesse/definition.ts`). | Modell | V06, V11 |
| M4 | Agenten-Schritte in der Nacht: Fenster 7–22 Uhr (`lib/agenten/zeitplan.ts:33–34`); der Batch-Weg (`batch: true`, `:20`) ist nicht gebaut | Anbieter-Tor | V01 |
| M5 | Kennzahl „Zeit bis zur ersten Reaktion“ (Median, Anteil in der Uhr). Es gibt keine Antwortzeit in `lib/crm/traktion-index.ts`. | Leser | V02, V03, V17 |
| M6 | Research mit Ausgabe-Vertrag je Firma: `/api/research` gibt Markdown zurück (`app/api/research/route.ts`). Der Prospect-Agent bewertet nur die Zielliste `prospects` (`lib/zoe/agenten.ts:234–260`). Zielliste und Karte sind zwei Orte für dasselbe. | Agent | V01, V08 |
| M7 | Säule „Prozesse“ im Business-Index. `SaeuleId` kennt nur `fh · ud · mt · fz · kp · ff` (`lib/business/register.ts:13`). Vorbild ist die Fulfillment-Säule mit `nurMitMessung` (`lib/fulfillment/prozesse/kennzahlen.ts:95`). | Kennzahlen (Etappe D) | alle |
| M8 | Demo-Saat ohne CRM-Events und Teilnahmen (`lib/demo/saat.ts`); Demo-Mandate ohne `ende` und Kündigungsfrist (`:306–307`) | Demo | V04, V15, V18 |
| M9 | Fester Verlustgrund „Keine Entscheidung“ (`VERLUSTGRUENDE`, `lib/crm/pipeline.ts:28`) | Daten | V13 |
| M10 | Zeitplan ohne „stündlich“ (Rhythmen `taeglich · werktags · woechentlich · monatlich`, `lib/agenten/zeitplan.ts:44`). Uhren laufen deshalb nur über Warten (M1). | Motor | V17, V02 |

**Die fünf wichtigsten** (sie tragen die meisten Vorlagen):

1. **N1 `crm.abfrage` mit den neuen Arten** — trägt V01, V04, V05, V06, V07 und V09.
2. **N12 Versand und Inbox-Aktion nach Freigabe mit der Sitzung der freigebenden Person** — ohne ihn bleibt jede Mail ein `mailto`-Text. Betrifft 12 Vorlagen.
3. **E1 `termin-vorbei`** — der Name ist schon da, die Quelle fehlt. Trägt V11 und V17.
4. **E8 `antwort-gesendet` / `followup-erledigt`** — ohne sie stoppt keine Uhr von selbst. Betrifft V02, V03 und V10.
5. **E4 `mandat-angelegt`/`-beendet` + E9 `ziel-erreicht`** — die rechte Seite der Fliege (V12, V14, V15).

---

## 6. Offene Entscheidungen für Kevin

| Nr | Frage | Optionen | Empfehlung |
|---|---|---|---|
| E-V1 | Website-Formular (Webhook): Kontakt automatisch anlegen? | (a) nur Vorschlag mit Uhr ab Eingang · (b) automatisch anlegen, weil die Felder ein festes Schema haben | **(a)** — Webhook-Felder sind fremder Text (R5). Ein Klick „Übernehmen“ ist schnell, die Uhr misst ab Eingang. |
| E-V2 | Double-Opt-in für den Newsletter: wer verschickt die Bestätigung? | (a) das Versandwerkzeug, Rückmeldung „bestätigt“ per Prozess-Webhook mit Zeitpunkt und Wortlaut · (b) ein eigener, eng gefasster Versandweg in MAKE OS (wie der Abmeldelink, Token statt Adresse) · (c) nur im Gespräch (Playbook `newsletter`) | **(a)** — MAKE OS bleibt ohne eigenen Massenversand. Für die Demo und die ersten Monate reicht (c). |
| E-V3 | Mandat bei „gewonnen“: ohne Klick anlegen? | (a) Vorschlag, Klasse geld · (b) intern ohne Klick | **(a)** — Honorare zählen in MRR und Index wie `setze_kunde` (`lib/werkzeuge/einordnung.ts:101–102`). Alle Felder sind vorbelegt, es bleibt ein Klick. |
| E-V4 | „Keine Entscheidung“ als fester Verlustgrund? | (a) ja, in `VERLUSTGRUENDE` · (b) nur als Werteliste je Instanz | **(a)** — sonst kann keine Vorlage den größten Gegner zählen. |
| E-V5 | Prospecting „nächtlich“ | (a) Regeln nachts, Agenten ab 7 Uhr · (b) ganzer Lauf ab 7 Uhr · (c) erst nach dem Batch-Weg | **(a)** bis der Batch-Weg steht, dann (c). |
| E-V6 | Zählen Agenten-Schritte eines Prozesses in die 12 Läufe des Heads am Tag? | (a) ja, plus Monatsbudget je Prozess · (b) eigenes Kontingent für Prozesse | **(a)** — eine Grenze, keine zweite Rechnung. |
| E-V7 | Netzwerken: „48 Stunden“ in Kalender- oder Werktagen? | (a) Werktage überall (Kennzahl anpassen) · (b) Kalendertage überall (Follow-up-Frist anpassen) | **(a)** — ein Event am Freitag lässt sich sonst nicht rechtzeitig nachfassen. Die Kennzahl-Definition (`lib/crm/besuche.ts:46`) würde dazu umformuliert. |

---

## 7. Unstimmigkeiten im Bestand, die beim Nachsehen auffielen

Diese Punkte sind nicht Teil der Vorlagen, betreffen sie aber. Gefunden beim Nachsehen, nichts geändert.

1. **Netzwerken-Frist doppelt:** Die Kennzahl zählt 2 Kalendertage (`lib/crm/besuche.ts:44`, `:127–129`), die Follow-up-Frist 2 Werktage
   (`lib/crm/netzwerken.ts:202`). Siehe E-V7.
2. **Kommentar ≠ Code:**
   - `lib/crm/netzwerken-server.ts:25–26` nennt Termin, Angebot, Vermitteln und Make.One als Schritte, die `followUpAm` setzen. Der Code setzt es bei angebot,
     vermitteln, andere, qualifizieren und makeone (`:575`); Termin erst nach dem Kalender-Schritt (`:618`).
   - `vorbereitenTag` (`lib/kalender/buchung.ts:441–446`) spricht von „Werktag“ und zieht einen Kalendertag ab.
3. **`/api/loop` „morgen“ läuft nie von selbst:** Nur `components/os/LoopView.tsx:77` ruft die Route auf, und dort fehlt „morgen“ in der Knopfliste. Der echte
   Morgen ist `app/api/tagesstart/route.ts` → `/api/tageslauf` (:314–322). Der B1-Auslöser `loop` muss dort andocken (N11).
4. **Inbox-Antworten zählen im Scoring-Kriterium „antwort“ nicht:** Es filtert `von !== 'system'` (`lib/crm/scoring.ts:280`), eingehende Inbox-Antworten tragen
   `von: 'system'` (`lib/inbox/verlauf.ts:63`). In der Wärme zählen sie (`:194–197`).
5. **`neuer-lead` hat nur eine Quelle:** `/api/crm/anfrage` (`lib/ereignisse/quellen.ts:189`). Netzwerken-Neuanlagen und die Buchungsfreigabe
   (`lib/kalender/buchung-ablauf.ts:160`) legen Leads an, ohne das Ereignis.
6. **`deal-stufe` bleibt still bei Angebot v2:** Steht der Deal schon auf „angebot“, ändert ein neues Angebot die Stufe nicht und meldet nichts (E3).
7. **Zwei Orte für Zielfirmen:** Zielliste `prospects` (Prospect-Agent) und CRM-Karte (`lib/zoe/agenten.ts:234–260`). V01 schreibt nur in die Karte. Die
   Zielliste sollte darin aufgehen.
8. **Eigner-Auflösung aus der Build-Variable:** `verantwortlich`/`zustaendig` lesen `TEAM` aus `lib/crm/team.ts` (Build-Variable), nicht aus
   `team--<haushalt>` (Eiserne Regel 11). Für Kunden-Instanzen muss der Eigner aus dem Team der Instanz kommen.
9. **IMAP- und WhatsApp-Ereignisse ohne `gespraech`** (`lib/ereignisse/quellen.ts:93`, `:111`) — ein Lauf findet sein Gespräch dort nicht (E13).
