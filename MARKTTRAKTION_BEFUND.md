# Markttraktion — Befund Ende-zu-Ende (08.10.2026, Stand `entwicklung` c74158fa)

> Nur gelesen, nichts geändert, nichts gebaut. Sechs parallele Prüfungen (Kontakt → Lead · Qualifizierung → Deal · Angebot → Rechnung ·
> Follow-up · Marketing & Events · Zu zweit & Kennzahlen), die schweren Funde danach selbst im Code nachgeprüft (in Teil 2 mit **(geprüft)**
> markiert). 19 Testdateien der Markttraktion laufen grün (273 Tests: Abläufe, Deal-Ebene, Follow-up-Route, Sales, Team, Traktions-Index,
> Anfragen, Angebot, Rhythmus, Netzwerken, Besuche, Pipeline, Scoring-Route, Praxis-Fix, Heads, Umsatz, Ebenen). Die Tests prüfen die Regeln —
> die Funde unten liegen fast alle **zwischen** den Regeln: was die Oberfläche filtert, was ein Takt ohne Person tut, was nach einem Klick fehlt.
>
> Nebenbefund außerhalb der Markttraktion: `tests/aufraeumen-etappe3.test.ts` ist seit dem Merge `onboarding-b0` (c74158fa) rot — ein Untertitel in
> `components/os/OnboardingView.tsx` hat 130 statt höchstens 110 Zeichen. Vor dem Upload beheben, sonst bricht die GitHub-Prüfung.

---

## Teil 1 — für Kevin

### Was trägt
- **Aufräumen hält:** Alle alten Adressen (Sales, Firmen › Leads, Deals › Kunden, Events, runde-chancen …) landen am neuen Ort. In keinem Weg
  wurde ein Link ins Leere gefunden.
- **Zu zweit gleichzeitig arbeiten ist sicher:** Jede Änderung trägt ihren Stand; überschreibt jemand dazwischen, gibt es einen Hinweis statt Datenverlust.
- **Anfragen sind schnell:** Inbox „Kontakt anlegen“ (1 Klick) und Marketing › Anfragen (≈ 4 Klicks) legen Person, Lead „kontaktiert“, Follow-up
  „heute beantworten“ und die Marketing-Herkunft an.
- **Netzwerken trägt:** offline, doppelt gesendet ohne Doppel, rechtlich sauber, mit Abendbericht und Danke-Entwürfen.
- **Deal-Regeln greifen:** nächster Schritt Pflicht, Grund bei „verloren“, Wiedervorlage bei „geparkt“ — der Server prüft, nicht nur die Oberfläche.
- **Angebot stellen ist ein Schritt:** Nummer, PDF, Deal auf „Angebot“, Nachfass-Follow-up und Verlauf am Kontakt entstehen zusammen.
  „Bezahlt“ schreibt die Buchung in derselben Sperre.
- **Kennzahlen sind ehrlich gebaut:** Lücken sind grau statt Null, Win Rate erst ab 10 Entscheidungen, Wochen nach Berliner Zeit.
- **Recht überall:** Kanal-Ampel, Werbesperre und Art. 18 sperren auf dem Server.

### Was bricht — die 10 wichtigsten Hindernisse fürs Kunden-Gewinnen
1. **Neue Kontakte verschwinden.** Ein frisch angelegter Kontakt hat beim Standard-Scoring 1–5 von 123 Punkten und gilt damit als „kalt“.
   Die Leads-Liste zeigt ab Werk nur „In Arbeit“ ohne kalte; die Runde zeigt keine kalten und nur die eigenen. Auch Visitenkarten vom Netzwerken
   (Status „kontaktiert“) fallen so heraus. Man legt an — und findet den Lead nicht wieder.
2. **Die Power Hour schließt Follow-ups nicht.** Ein Ergebnis-Knopf (z. B. „Gespräch“) hält eine Aktivität fest, das offene Follow-up bleibt aber
   offen. Es kommt jeden Tag wieder, dazu eine neue Wiedervorlage.
3. **Die Heads laufen im Takt nicht, außer der Power Hour.** Wochenreview, Lead-Review und Kundenreview (Sales), alle Marketing-Läufe (Wochenplan,
   Vernetzen-Runde, Monatsreview) und alle Event-Läufe (Nachfassen, Countdown) scheitern still mit „keine Berechtigung“. Grund: Der Takt schickt
   keine Person mit. Von Hand angestoßen gehen sie.
4. **Das erste Angebot scheitert erst beim Senden.** Fehlt dem Absender Firmierung oder Anschrift, sagt der Editor vorher nichts. Erst „Senden“
   lehnt ab und verweist auf „Stammdaten › Gesellschaften“ — dort steht nur noch ein Weiterleitungs-Hinweis.
   Dazu ist der Absender auf einem neuen Gerät fest die Selbstständigkeit, nicht die GmbH.
5. **Fehler verschwinden oder werden als Erfolg gemeldet.** In der Follow-up-Liste ist eine Fehlermeldung nach Sekundenbruchteilen weg, das
   Formular schließt trotzdem. Kartei, Segmente, Make.One-Abend und „Rechnung aus dem Honorar“ melden Erfolg oder springen weiter, auch wenn
   das Speichern scheiterte.
6. **Ohne „Hält die Beziehung“ landet alles bei Kevin.** Das gilt für Power Hour, Kadenz, „Für dich“ und Leads. Malins Sales-Listen bleiben leer;
   ihr Wochen-Scoreboard misst sie trotzdem an Sales-Zielen und ist jede Woche rot. Die Power Hour folgt außerdem nicht der Zuständigkeit eines
   Follow-ups — die Glocke meldet es Malin, die Karte liegt bei Kevin.
7. **Vom angenommenen Angebot zur Rechnung reißt der Faden.**
   - Nach „Mandat anlegen“ gibt es keinen Link zum Mandat.
   - Ein Einmalbetrag (Setup) geht beim Mandat verloren.
   - Die Rechnung ist Handarbeit (Nummer, Datum, kein PDF).
   - „+ Rechnung“ im Kontakt › Umsatz trägt das Netto-Honorar als Brutto ein, also 19 % zu wenig.
   - Ein Angebot zu einem schon gewonnenen Deal (Folgeauftrag) meldet „Deal gewonnen“, und „Mandat anlegen“ scheitert.
8. **Herkunft und Quelle werden verfälscht.** Eine Visitenkarte, die in der Kartei fotografiert wird, zählt als „Website-Anfrage“ und kann
   MQL werden. Die Deal-Quelle ist fest vorbelegt („Empfehlung“, „Bestand“ oder leer). Ein direkt angelegter Deal macht den Lead ungeprüft zum
   SQL. Marketing-Trichter und SQL-Zahl stimmen damit nicht.
9. **Die Qualifizierungs-Runde leert sich nie.** Ein Lead bleibt drin, solange eine der 12 Standardfragen offen ist; „Geprüft“ hilft nur in der
   laufenden Sitzung. Texte nennen noch alte Regeln („mindestens 25 Punkte“, SQL ohne Punkteschwelle). Der Weg „SQL → Deal anlegen“ verlässt
   die Runde und springt in eine lange Liste.
10. **Neue Kunden finden hat Lücken.**
    - Prospecting (die Zielliste unter ZOE › Agenten) ist fest auf das Produkt „CapOS“ ausgerichtet und führt nicht in die Kartei.
    - Beim Netzwerken ist das KI-Auslesen der Visitenkarte aus; in Kartei und Make.One-Abend ist es an.
    - Netzwerken verlangt den Nachnamen, auch wenn man nur den Vornamen kennt.

Außerdem auffällig: Der **Traktions-Index startet rot**. Unter der roten Schwelle fallen die Punkte bis 0, und nach dem Import zählen alte
Kontakte sofort als überfällige Kadenz. Morgen-Nachricht und Freitags-Scoreboard gehen **nur über Telegram** — online wirkt das nicht.

### Was ich vorschlage
- **Vor bzw. direkt nach dem Upload (jeweils klein, zusammen ≈ 1 Tag):**
  - Punkt 1: neu angelegte und gesetzte Leads nie wegfiltern; Hinweis „n kalte ausgeblendet — zeigen“.
  - Punkt 2: Power-Hour-Karte trägt das Follow-up und erledigt es mit.
  - Punkt 3: Takt gibt die verantwortliche Person der Welt mit.
  - Punkt 4: Absender-Lücken früh zeigen mit Link zu Unternehmen › Absender; Vorgabe GmbH.
  - Punkt 5: Fehler stehen lassen, Rückgabe prüfen.
  - Rechnung im Umsatz-Reiter mit USt.
- **Am Samstag im Onboarding (Daten, kein Code):**
  - Unternehmen › MAKE Innovation GmbH › Absender vollständig ausfüllen.
  - Bei den wichtigen Kontakten „Hält die Beziehung“ setzen (Kreis-Runde).
  - Kevin und Malin bekommen je eigene Scoreboard-Erwartungen — oder Malins Sales-Zeilen erst einmal ignorieren.
- **Phase 1 (Markttraktion-Paket):**
  - Punkte 6–10.
  - Ein Weg für „Person anlegen“.
  - Rechnung schreiben wie das Angebot (Roadmap-Lücke 4).
  - Index-Anlaufphase.
  - Push über WhatsApp statt Telegram.

---

## Teil 2 — technisch

Schwere: **blockiert** = der Weg führt nicht ans Ziel · **stört** = geht, aber falsch, doppelt oder verwirrend · **nice** = Feinschliff.
Größe: S ≤ ½ Tag · M ≤ 2 Tage · L größer. **(geprüft)** = selbst im Code nachvollzogen, die übrigen Belege stammen aus den Teilprüfungen.

### 1 · Kontakt anlegen → Lead

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 1.1 | Neue Kontakte sind „kalt“ (Score 1–5 von 123, Grenze „lau“ = 5) bzw. Status „neu“ (nicht „aktiv“) und fehlen in Leads-Liste (Standard „In Arbeit“, ohne kalte) und Runde (ohne kalte, nur eigene) **(geprüft)** | blockiert | lib/crm/scoring.ts:424; lib/crm/leads.ts:31, 238, 247; components/os/crm/Leads.tsx:99, 112 | Gesetzter aktiver Status und „angelegt ≤ 14 Tage“ zählen nie als kalt; Leads-Filter „In Arbeit“ nimmt „Neu“ dazu; Runde zeigt „n kalte ausgeblendet — zeigen“ | M |
| 1.2 | Netzwerken setzt den Lead auf „kontaktiert“, Score 4 = kalt → nirgends sichtbar; der Kommentar verspricht „In Arbeit“, der Test prüft nur den Status | blockiert | lib/crm/netzwerken-server.ts:477–479; tests/netzwerken-korrektur.test.ts:190–199 | wie 1.1; Test über `nichtKalt`/`zuQualifizieren` | S |
| 1.3 | Leere Zustände führen in die Irre: „alle haben mindestens 25 Punkte“ (Grenze ist 5 %), „Alle deine Leads sind qualifiziert … Nächste Runde in 60 Tagen“, obwohl nur kalte ausgeblendet sind **(geprüft)** | stört | Leads.tsx:138; components/os/crm/Qualifizierung.tsx:152 | Schwelle aus den Einstellungen nennen; Zahl der ausgeblendeten zeigen | S |
| 1.4 | Trichter zählt kalte Leads mit, die Liste dahinter nicht | stört | leads.ts:168–176 ↔ Leads.tsx:112 | gleich zählen oder Filter beim Sprung mitgeben | S |
| 1.5 | Kartei-Anlegen prüft die Rückgabe von Firma und Kontakt nicht. Die Karte öffnet auch bei einem Fehler. Ein Kontakt, dessen `firmaId` auf eine nicht gespeicherte Firma zeigt, wird kein Lead. | stört | components/os/crm/Kartei.tsx:392–402 | Rückgabe prüfen, bei Fehler stehen bleiben | S |
| 1.6 | Legt man eine Firma an, deren Name im Papierkorb schon existiert, entsteht dieselbe Kennung. Die Papierkorb-Marke bleibt erhalten, die Person bekommt keinen Lead. Aus dem Code gelesen, nicht im Lauf geprüft. | stört | lib/crm/speicher.ts:684–687; lib/crm/ablage.ts:48–56 | Upsert auf eine Firma im Papierkorb ablehnen oder sie zurückholen | M |
| 1.7 | „+ Aktivität hinzufügen“ kann keine neue Person anlegen; bei keinem Treffer steht nur ein Satz | stört | components/os/crm/SchnellErfassen.tsx:201 | Kurzformular „neue Person“ im Dialog | M |
| 1.8 | Sechs Anlege-Wege haben verschiedene Regeln (Kartei, Anfrage, Inbox, Netzwerken, Make.One-Abend, Import). Sie unterscheiden sich bei: Firma anlegen ja/nein, Lebensphase, Lead-Status, Herkunft, Follow-up. | stört | Kartei.tsx:395; lib/crm/anfragen.ts:155–166; netzwerken-server.ts:340; components/os/crm/events/Abend.tsx:185–188 | EINE Server-Funktion „Person anlegen“ mit Herkunft als Parameter | L |
| 1.9 | Inbox: „Kontakt anlegen“ macht auch aus dem Privat-Postfach einen Business-Lead mit Follow-up; nie eine Firma | stört | components/os/inbox/Gespraech.tsx:233; lib/inbox/aus-gespraech.ts:94 | nur bei Business-Bereich anbieten; Firma aus der Mail-Domain vorschlagen | S |
| 1.10 | Wer anlegt, wird „Hält die Beziehung“. Die Runde startet mit „Meine“, deshalb fehlen von Malin angelegte Leads bei Kevin. Die Leads-Liste startet dagegen mit „Alle“. | stört | Kartei.tsx:399; anfragen.ts:162; Qualifizierung.tsx:62; components/os/crm/team.tsx:51 | „Zuständig“ im Anlege-Dialog wählbar, Vorgabe nach Welt | S |
| 1.11 | Ein aktives Mandat bzw. die Firmenrolle „Kunde“ macht den Lead nicht zum „Kunde“, Status bleibt „neu“ (BEAN zeigt dagegen B) **(geprüft)** | stört | leads.ts:67–74 | aktives Mandat → „kunde“ in `abgeleitet` | S |
| 1.12 | Kartei-Anlage ohne nächsten Schritt → kein Follow-up, nicht in „Für dich“ | stört | Kartei.tsx:399–400; lib/crm/team.ts:126–173 | Feld „Nächster Schritt“ im Dialog oder Karte „neue Leads ohne Schritt“ | S |
| 1.13 | „+ Firma“ ergibt keinen Lead (Firma ohne Person zählt nicht); die Firmenkarte kann nur vorhandene Personen zuordnen | stört | leads.ts:152; components/os/crm/Firmen.tsx:256 | „+ neue Person“ in der Firmenkarte | S |
| 1.14 | Prospecting: Die Zielliste hat einen festen ICP für „CapOS“, ein anderes Produkt, gegen die Plattform-Regel. Sie liegt in einem eigenen Bestand `prospects` und führt nicht in Kartei oder Lead. Gespeichert wird der ganze Stand per PUT ohne Stand, Fehler werden verschluckt. Die Seite ist nur unter ZOE › Agenten erreichbar. **(geprüft)** | stört | lib/make-one/prospecting-data.ts:29–36; components/os/ProspectingView.tsx:62–67 | ICP aus den Einstellungen bzw. der Positionierung; „In die Kartei übernehmen“ → Lead; Einzeländerungen | M |
| 1.15 | Das Segment „Vernetzen“ entsteht erst beim ersten Import; der Runden-Text verweist darauf | nice | Qualifizierung.tsx:119; lib/store/absichten-crm.ts:43 | Segment beim ersten Laden anlegen | S |

### 2 · Lead → Qualifizierung → SQL → Deal → Stufen

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 2.1 | Die Runde leert sich nie: Ist eine der 12 Standardfragen offen, bleibt der Lead dran. „Geprüft“ gilt nur in der Sitzung. **(geprüft)** | stört | leads.ts:215–221; Qualifizierung.tsx:152 | Nur Muss-Fragen zählen als „offen“, oder „Geprüft“ gibt 60 Tage Ruhe | S |
| 2.2 | „SQL → Deal anlegen“ verlässt die Runde und springt in die Leads-Liste (bis 120 Zeilen). Am Handy klappt der Lead dort auf, ohne dorthin zu scrollen. | stört | Qualifizierung.tsx:243; Markttraktion.tsx:249; Leads.tsx:123–156 | `DealAnlegen` direkt in der Karte öffnen (wie im Gesprächsmodus) | S |
| 2.3 | Zwei Regelwerke für den Deal: `/api/crm/lead` (sql) prüft die Kriterien; `/api/crm/deal` setzt den Lead ungeprüft auf SQL, auch bei Netzwerken-„Vermittlung“. SQL-Zahl und Trichter werden aufgebläht. Im Leads-Weg fehlt der Knopf für einen bewussten zweiten Deal. | stört | app/api/crm/lead/route.ts:259–265; lib/crm/deal-anlegen.ts:144, 153–159; netzwerken-server.ts:525–527 | SQL nur bei erfüllten Kriterien, sonst Vermerk „direkt angelegt“; `zweiter` in der Oberfläche | M |
| 2.4 | Firma mit > 20 Personen → 413 „Bitte die wichtigsten auswählen“, aber das Formular hat keine Auswahl | blockiert (Randfall) | lead/route.ts:261; deal-anlegen.ts:79; Leads.tsx:205 | Hauptkontakt senden oder Auswahl | S |
| 2.5 | Deal-Quelle fest: Gesprächsmodus „empfehlung“, ZOE „bestand“, Leads-Weg ohne. Das verfälscht den Marketing-Trichter („Deals aus Marketing“). | stört | components/os/crm/quali/Gespraechsmodus.tsx:142; lib/zoe/werkzeuge.ts:986; lib/crm/marketing.ts:49–51 | Quelle aus `marketingHerkunft`/`kanalVon` ableiten | S |
| 2.6 | Veraltete Regeltexte: SQL ohne Punkteschwelle, „Firmen › Leads“, „25 Punkte“ und der „Für dich“-Text „Schmerz, Entscheider und Budget/Zeitpunkt geklärt“ | stört | Leads.tsx:131, 138; lib/crm/leads.ts:14, 34; components/os/crm/Pipeline.tsx:266–267; lib/crm/team.ts (`sql_bereit`) | Texte aus `fehltBisSqlZeile` bzw. den Einstellungen | S |
| 2.7 | Score-Anzeige „13 von 100 · Warm“ verwirrt (Grenzen 5/12/25) | stört | components/os/crm/quali/ScoreAnzeige.tsx:54–56 | Fortschritt zur SQL-Schwelle statt „von 100“ | S |
| 2.8 | Leads-Pillen „Ruht“/„Kein Fit“ umgehen die Dialoge Parken/Raus: keine Wiedervorlage, keine Grund-Art, keine Sperre bei offenem Deal. Der Lead kommt nie zurück. | stört | Leads.tsx:231–235; lead/route.ts:163–231 | Pillen auf die Dialoge umleiten | S |
| 2.9 | „+ Deal für <Person>“ gibt keinen Besitzer mit | stört | Pipeline.tsx:82–83, 156, 161; components/os/crm/DealAnlegen.tsx:24, 38 | Besitzer übergeben | S |
| 2.10 | Gesprächsmodus: Abbruch und erneut „SQL“ ergibt eine doppelte Gesprächs-Aktivität. „Weiter qualifizieren“ meldet Erfolg auch bei einem Fehler. | stört | Gespraechsmodus.tsx:86–110, 147 | festgehalten merken; Antwort prüfen | S |
| 2.11 | Deal-Detail: Ein Datum ohne Text wird still verworfen. Der Schritt lässt sich leeren (Pflicht nur beim Anlegen und beim Stufenwechsel). | stört | Pipeline.tsx:365–366; speicher.ts:552–556 | Hinweis bzw. Pflicht auch beim Ändern | S |
| 2.12 | „Abgeben“: Die Vorwahl kann der jetzige Besitzer sein | stört | components/os/crm/quali/KleineDialoge.tsx:31–48 | erste sichtbare Person vorwählen | S |
| 2.13 | Prognose: Deals ohne Wert zählen 0 €, Spalten „0 €“, keine Zahl „n ohne Wert“ | nice | lib/crm/pipeline.ts:130–148; Pipeline.tsx:162–169, 208 | Kennzahl „ohne Wert“ | S |
| 2.14 | Win Rate: Text „ab 5“ bzw. Ziel „≥ 40 %“, Regel ab 10 und grün ab 25 % | nice | Pipeline.tsx:170; lib/crm/kennzahlen.ts:69; pipeline.ts:156; traktion-index.ts:47 | Texte aus `WIN_RATE` | S |
| 2.15 | Der Deal zeigt die alten 6 Kernfragen, der Lead hat 12 Stufenfragen — beides läuft auseinander | nice | Pipeline.tsx:46–48, 371–379; leads.ts:130 | Lead-Fragen im Deal anzeigen | M |
| 2.16 | Board: Ziehen nur mit der Maus, ohne Rückgängig; am Handy nur Karten und Pillen | nice | Pipeline.tsx:108, 196, 215 | Rückgängig wie beim Parken | S |
| 2.17 | Kleine Tippziele im Leads-Formular und im Deal-Detail (außerhalb von `.deal-anlegen`/`.quali-flaeche`) | nice | Leads.tsx:270; Pipeline.tsx:402–405; app/globals.css:626–635 | Klasse ergänzen | S |

### 3 · Angebot → angenommen → Mandat → Rechnung → bezahlt

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 3.1 | `GET /api/crm/angebot` liefert die Gesellschaften ohne `luecken`. Deshalb erscheint der Chip „Absender … fehlt“ nie, und „Senden“ ist nicht gesperrt. Der Server lehnt erst beim Stellen ab (409) und verweist auf „Stammdaten › Gesellschaften“; dort steht nur ein Weiterleitungs-Hinweis. **(geprüft)** | blockiert (leeres Register) | app/api/crm/angebot/route.ts:45; components/os/crm/angebot/Editor.tsx:282; angebot/Vorschau.tsx:27, 50; lib/crm/angebot-server.ts:238–239; components/os/crm/Stammdaten.tsx:71–72 | `luecken` im GET mitliefern; Karte mit Link `WEG.unternehmen(g, 'absender')`; Text der Ablehnung anpassen | S |
| 3.2 | Absender-Vorgabe auf neuem Gerät fest `kdc` (Selbstständigkeit, gehört zu Privat); der Umsatz-Reiter fällt ebenso still auf `kdc` zurück **(geprüft)** | stört | Editor.tsx:75; components/os/crm/kontakt/UmsatzReiter.tsx:287, 522 | Vorgabe aus dem Register (operative Business-Gesellschaft) oder Wahl erzwingen | M |
| 3.3 | Folgeauftrag: Ein Angebot zu einem gewonnenen, verlorenen oder geparkten Deal übernimmt diesen Deal. Danach ist „Angenommen — Deal gewonnen“ falsch, und „Mandat anlegen“ endet mit 400. | stört | components/os/crm/DealAkte.tsx:117; Editor.tsx:69–73; angebot-server.ts:250, 344, 468; lead/route.ts:114 | Bei geschlossenem Deal ohne Deal starten (es entsteht ein neuer) | S |
| 3.4 | „Angenommen“: ein Klick, keine Rückfrage, nicht rückgängig | stört | components/os/crm/angebot/Ansicht.tsx:103; angebot-server.ts:147, 461 | Rückfrage | S |
| 3.5 | Nach „Mandat anlegen“ nur Text und Chip; die `mandatId` aus der Antwort wird nicht genutzt | stört | Ansicht.tsx:54–56, 108–110; lead/route.ts:152 | Link `WEG.mandat(id)` und Knopf „Erste Rechnung“ | S |
| 3.6 | Gemischtes Angebot (einmalig plus monatlich): Das Mandat übernimmt nur den laufenden Teil. Der Setup-Betrag erreicht weder Honorar noch Rechnung. | stört | lib/crm/angebote.ts:401–413; lib/crm/typen.ts:119 | Einmalposten als geplante Rechnung anlegen | M |
| 3.7 | Die Rechnung ist Handarbeit: keine Nummer, kein Nummernkreis, keine Prüfung auf doppelte Nummern, kein PDF. Die Monatsrechnung legt man je Monat von Hand an (Roadmap-Lücke 4). | stört | components/os/crm/Kunden.tsx:358; components/os/FinanzplanungView.tsx:299–300 | Rechnung schreiben wie das Angebot | L |
| 3.8 | „+ Rechnung aus dem Honorar“: Bei einem Netzfehler springt die Seite auf eine Rechnung, die es nicht gibt (`r?.ok !== false`); `ok:false` bleibt still. Der Liquiplan-Knopf ignoriert die Antwort. **(geprüft)** | stört | Kunden.tsx:359–360, 204–207 | Meldung zeigen, nur bei `ok` springen | S |
| 3.9 | Kontakt › Umsatz „+ Rechnung“ hat drei Fehler: Das Netto-Honorar steht ohne USt im Feld „brutto“ (19 % zu wenig); Vorgabe ist „gestellt“, auch ohne Nummer; die Gesellschaft fällt auf die erste Firma bzw. `kdc` statt `finanzFirmaFuer`. Der Weg aus dem Mandat rechnet richtig (`bruttoAusNetto`). **(geprüft)** | stört | UmsatzReiter.tsx:522, 530, 539 ↔ Kunden.tsx:357 | `bruttoAusNetto` und `finanzFirmaFuer`; Vorgabe „geplant“ | S |
| 3.10 | Ein angenommenes Tool-Angebot hat im Umsatz-Reiter keinen Weg weiter (nur Ablage-Angebote „→ als Rechnung planen“) | stört | UmsatzReiter.tsx:489–497 ↔ 508 | „Mandat anlegen ›“ bzw. „Mandat ›“ zeigen | S |
| 3.11 | Finanzen: Der Status wechselt per Klick ohne Rückfrage und ohne Prüfung der Nummer. Scheitert „bezahlt“, landet der Fehler nur in der Konsole. | stört | FinanzplanungView.tsx:46, 145, 266–267 | Rückfrage mit Nummer/Datum; Fehler zeigen | S |
| 3.12 | Ein Angebot über 0 € lässt sich stellen und belegt eine feste Nummer | stört | angebot/Positionen.tsx:109; angebote.ts:253–262 | Summe > 0 Pflicht | S |
| 3.13 | Doppelte Wege: ein Mandat ohne Deal mit Gesellschaft „offen“; vier Rechnungs-Anleger mit verschiedener Vorbelegung | stört | Kunden.tsx:121, 358; UmsatzReiter.tsx:290, 466, 530; FinanzplanungView.tsx:332 | einen Rechnungs-Anleger, den alle nutzen | M |
| 3.14 | Handy: Die Summenleiste ist inline `sticky` (nicht `.ui-aktion`) und bricht bei 375 px um. Das PDF hängt man nach dem Download von Hand an. Am Gerät nicht geprüft. | stört | Editor.tsx:241–242, 325; app/globals.css:833 | `.ui-aktion`; Teilen mit Datei (Web Share) | S/M |
| 3.15 | Kleinkram: Kürzel-Vorgabe `ug` noch „MOS“. Der Schnellknopf „Angebot“ verliert den offenen Kontakt. Die Aktivität „gesendet“ entsteht, auch wenn die Mail nie rausgeht. Der Deal entsteht vor dem Festschreiben. Interne Links mit `<a>`. | nice | angebote.ts:135; angebot-server.ts:252–260, 392–401; UmsatzReiter.tsx:297, 572 | einzeln | S |
| 3.16 | Ein Konto ohne Privat-Finanzzugang bekommt für Rechnungen 403; Mandat › Rechnungen zeigt dann „noch keine Rechnung“ (unbelegt, welche Rechte Malins Konto hat) | nice | Kunden.tsx:347; app/api/state/finanzplan/route.ts:29 | 403 sauber anzeigen | S |

### 4 · Follow-up (Fällig, Power Hour, Glocke, Heute)

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 4.1 | Power Hour: Ein Ergebnis-Knopf schreibt nur eine Aktivität. Das echte Follow-up bleibt offen, kommt täglich als „Versprechen“ wieder (gilt nicht als „kürzlich“), dazu eine neue Wiedervorlage. **(geprüft)** | blockiert | lib/crm/heute.ts:132–135, 202–203; components/os/crm/Heute.tsx:136–146; lib/crm/aktivitaet-folgen.ts:66–76 | Karte trägt `followupId`, `/api/crm/aktivitaet` erledigt es mit | M |
| 4.2 | Follow-up-Liste: `aktion` setzt den Fehler, das sofort folgende `laden()` löscht ihn wieder (auch bei 304). Formulare schließen trotz Fehler, die Eingabe ist weg. **(geprüft)** | stört | components/os/crm/FollowUp.tsx:52–63, 116, 178 | Fehler nur nach erfolgreicher Aktion löschen; Formular bei `!ok` offen lassen | S |
| 4.3 | Die Power Hour verteilt nach Deal, Kampagne bzw. „Hält die Beziehung“, nicht nach `f.zustaendig`. Die Glocke meldet das Follow-up Malin, die Karte liegt bei Kevin. **(geprüft)** | stört | heute.ts:74–82, 134; lib/crm/followup.ts:113 | `karteGehoert` nimmt zuerst die Zuständigkeit des Follow-ups | S |
| 4.4 | Ein Deal-Follow-up ohne „Als Nächstes“ erledigt: Der alte Deal-Schritt bleibt und ist sofort wieder überfällig (`v:dealschritt`) | stört | app/api/crm/followup/route.ts:205, 224; followup.ts:133–137 | Schritt am Deal mit leeren bzw. Pflicht | S |
| 4.5 | Kontakt › Aktivitäten: „✓ Erledigt“ für einen Deal-Schritt endet immer mit 400; keine Notiz möglich | stört | components/os/crm/kontakt/AktivitaetenReiter.tsx:130–134; followup/route.ts:205 | dasselbe Erledigen-Formular wie in der Liste | M |
| 4.6 | Follow-ups der Art „sonstig“ (Zusagen, Deal-Schritte) werden als „notiz“ verbucht. Auch mit Ergebnis „Gespräch“ ändern sich letzter Kontakt und Kadenz nicht. | stört | followup/route.ts:57; lib/make-one/crm.ts:1009–1010, 1233–1243 | Mit Ergebnis die Art Gespräch/Anruf setzen | S |
| 4.7 | Eine Aufgabe mit Kontakt-Bezug (der neue Standardweg „+ Hinzufügen“) schreibt beim Abhaken keine Aktivität und setzt die Kadenz nicht zurück. Die Power Hour kennt diese Aufgaben nicht. | stört | lib/aufgaben/speicher.ts:503; lib/crm/followup-aufgabe.ts:21–30; heute.ts | Aktivität beim Erledigen; Aufgaben in `werIstDran` | M |
| 4.8 | Glocke und Heute: Echte Follow-ups eingeschränkter Personen (Art. 18) erscheinen mit dem Follow-up-Text als Namen, weil `kontakteFuerVerarbeitung` sie weglässt und die Prüfung in `faellige` dann nicht greift | stört (Datenschutz) | lib/heute/anstehend-server.ts:72, 94; followup.ts:107–109 | Kennungen der ausgeblendeten mitgeben bzw. Follow-ups ohne Kontakt weglassen | S |
| 4.9 | Ergebnis „Sperre“ in der Follow-up-Liste ohne Rückfrage (Power Hour fragt) | stört | FollowUp.tsx:198; components/os/crm/teile.tsx:57 ↔ Heute.tsx:137 | `bestaetigen` wie in der Power Hour | S |
| 4.10 | Heute › Privat zeigt CRM-Follow-ups und Business-Fristen; auf „Alles/Business“ steht dasselbe Follow-up auch in „Wer heute dran ist“ | stört | components/os/HeuteView.tsx:51; components/os/heute/Anstehend.tsx:105–116; components/os/flaeche/widgets.tsx:196–208 | `space` an `/api/heute/anstehend`, serverseitig filtern | M |
| 4.11 | Die Follow-up-Karte rechts in „Kontakt öffnen“ legt mit „+ Hinzufügen“ eine Aufgabe an, die woanders erscheint; die Rückmeldung wird verworfen. Der Bereich ist fest `'kdv'`, gegen die Plattform-Regel. | stört | components/os/crm/KontaktSpalten.tsx:360, 375, 477; Anstehend.tsx:124 | Knopf in die Aufgaben-Karte; Bereich aus `lib/einheiten.ts` | S |
| 4.12 | Neues Follow-up: Vorauswahl „Kevin“, der Server nimmt aber, wer die Beziehung hält. Eigene Suche statt `suchPasst`. Eingeschränkte Personen sind wählbar und ergeben 409; der Fehler verschwindet (4.2). | stört | FollowUp.tsx:232, 253; followup.ts:209; components/os/crm/team.tsx:30 | Vorauswahl Beziehung/ich; `suchPasst`; `ausgenommen` filtern | S |
| 4.13 | Der Anlass wird automatisch „Vereinbartes Follow-up: …“, auch bei einer Kadenz-Erinnerung; ohne Ergebnis entsteht ein „Anruf“, der vielleicht nie stattfand | stört (Nachweis) | followup/route.ts:95 | Text nach Quelle; Anruf nur mit Ergebnis | S |
| 4.14 | Kadenz: „Alle Kreise im Takt“ auch ohne einen einzigen Kreis. Die Absagen-Rückfrage sagt „Zusage fällt weg“, legt aber einen neuen Anlauf an. Personen ohne letzten Kontakt bekommen nie eine Kadenz. | nice | FollowUp.tsx:171, 316; followup.ts:165; heute.ts:176–177 | Texte nach Quelle; Link zur Kreis-Runde | S |
| 4.15 | Pünktlichkeit: UTC-Tag statt Berliner Tag; die Kachel zeigt „0 · 0“ | nice | followup.ts:198–199; FollowUp.tsx:108 | `tagVon`; ohne Daten ausblenden | S |
| 4.16 | Woche: nicht erledigbar, Aufgaben fehlen (in den Kopfzahlen aber mitgezählt), rollierendes Fenster statt Kalenderwoche | nice | FollowUp.tsx:107, 263–296 | Zeile antippbar mit denselben Aktionen | M |
| 4.17 | Zähler „verschoben“ nur bei echten Follow-ups; die Warnung „3× verschoben“ kommt bei Zusagen und Wiedervorlagen nie | nice | followup/route.ts:253, 262–264 | beim Verschieben ein echtes Follow-up anlegen | S |
| 4.18 | Importierte Teilnahmen „da“ ohne `followUpAm` wären dauerhaft „Nachfassen überfällig“ (keine Altersgrenze; unbelegt, ob es solche gibt) | nice | followup.ts:146–154 | Grenze z. B. 60 Tage | S |

### 5 · Marketing, Events, Make.One

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 5.1 | Kartei-Visitenkarte setzt Herkunft „selbst“. `marketingHerkunft` liest „selbst“ als Website-Anfrage, die Begegnung kann also MQL werden. Ebenso Anfragen mit Kanal Empfehlung/Event bzw. mit Bezug auf ein besuchtes Event. **(geprüft)** | stört | components/os/crm/Kartei.tsx:407; lib/crm/scoring.ts:125; lib/crm/anfragen.ts:164; components/os/crm/marketing/Anfragen.tsx:69 | Marketing-Herkunft nicht aus der Datenschutz-Herkunft; Kartei-Karte → „Veranstaltung“ | M |
| 5.2 | Kampagne: Der Server-Hinweis „n Personen mit roter Ampel nicht aufgenommen“ wird verschluckt; „0 Personen“ kommt ohne Grund | stört | components/os/crm/Kampagnen.tsx:86 ↔ app/api/crm/kampagnen/route.ts:86–94 | `r.text` zeigen | S |
| 5.3 | „Als Nächstes“ verspricht, die Personen „stehen in der Power Hour“. Tatsächlich kommen dort höchstens 4 „Neu“-Karten über alle Quellen; rote Ampel und kürzlich Kontaktierte fallen raus. | stört | Kampagnen.tsx:210; heute.ts:182, 205, 216 | ehrlicher Text plus „heute in der Power Hour: n“ | S/M |
| 5.4 | Wird der Kanal nachträglich auf Mail/LinkedIn gestellt, prüft die Schranke nur neue Personen; wer rot ist, bleibt drin | stört (Recht) | lib/crm/personen-schranke.ts:72–79; Kampagnen.tsx:243 | beim Wechsel auf werblichen Kanal alle prüfen | S |
| 5.5 | Fehler und Bestätigungen stehen oben auf der Seite, das Detail weit unten außer Sicht; ein Ergebnis wird nicht bestätigt | stört | Kampagnen.tsx:76, 99, 282 | Meldung am Detail | S |
| 5.6 | Bei leerer Kartei ist „Kampagne planen“ ohne Grund gesperrt; eine eigene bzw. leere Kampagne geht nur über ein Segment | stört | Kampagnen.tsx:107, 173 | Knopf „Eigene Kampagne“ | S |
| 5.7 | Ein Link auf eine Kampagne öffnet nichts, wenn der gemerkte Filter „Meins“ steht oder sie archiviert ist | stört | Kampagnen.tsx:91, 122; team.tsx:54 | `k` aus dem Link gewinnt | S |
| 5.8 | Die Kampagnen-Route schreibt `tasks` direkt mit `updateJson`: kein Verlauf, keine Glocke, kein Protokoll. Das verletzt die Regel „Server-Schreiber nur über `systemAufgabenAendern`“. | stört | app/api/crm/kampagnen/route.ts:106–115 | über `systemAufgabenAendern` | S/M |
| 5.9 | Anfrage einer bestehenden Person mit Werbesperre → 400, keine Anfrage, kein Follow-up; eine neue Person auf der Sperrliste wird dagegen erfasst | stört | anfragen.ts:167–168, 176 | Anfrage festhalten, nur keine Einwilligung | S |
| 5.10 | Redaktionsplan „Wirkung: Anfrage“ legt weder Follow-up noch Lead noch Einwilligung an, zählt aber im Trichter (zweiter Anfrage-Weg) | stört | components/os/crm/marketing/Redaktionsplan.tsx:285–294 | über `/api/crm/anfrage` | S |
| 5.11 | Erfolgsmeldung trotz gescheitertem Speichern (Rückgabe von `api.setze`/`kontaktSetzen` ignoriert). Der Abend trägt eine nicht gespeicherte Person als „da“ ein. | stört | marketing/Segmente.tsx:88–90, 140; events/Abend.tsx:183–188; events/Start.tsx:77–79; Redaktionsplan.tsx:236 | Rückgabe prüfen (Vorbild `besuche/NeuesBesuch.tsx:42–44`) | S |
| 5.12 | Drei Erfass-Wege mit verschiedener Wirkung: Netzwerken (Schritt, Lead, Danke), Make.One-Abend (nur Kontakt + „da“), Kartei-Visitenkarte (Herkunft „selbst“). Vom Abend führt kein Weg zu Netzwerken. | stört | events/Abend.tsx; Kartei.tsx:407 | im Abend „Ausführlich erfassen“ → `WEG.netzwerken({ event })` | S |
| 5.13 | KI-Auslesen der Visitenkarte ist beim Netzwerken aus (`KARTE_AUSLESEN_AN = false`), in Kartei und Abend an — ausgerechnet auf dem Event wird getippt **(geprüft)** | stört | lib/crm/netzwerken-karte.ts:12 ↔ app/api/crm/visitenkarte/route.ts:83 | an dieselbe Route hängen (gleiche KI-Regeln) | M |
| 5.14 | Netzwerken: Nachname Pflicht (Browser und Server) — nur Vorname oder Firma blockiert **(geprüft)** | stört | components/os/netzwerken/Erfassen.tsx:157–160; lib/crm/netzwerken.ts:264 | Vorname ODER Nachname | S |
| 5.15 | Wer einen Gast aus der Gästeliste vormerkt, setzt bei Begegnungen auf besuchten Events nicht den „nachgefasst“-Stempel. Die Schnellleiste und der Server tun es. Die Begegnung bleibt deshalb in der Power Hour. | stört | events/Gaeste.tsx:69 ↔ kontakt/SchnellLeiste.tsx:68–69, lib/crm/eventplanung.ts:563–580 | gemeinsame Funktion | S |
| 5.16 | Kein Einladungstext zum Kopieren in der Gästeliste (nur Kalender-Datei und ZOE) | nice | events/Kalender.tsx:68 | Textbaustein je Ampel | M |
| 5.17 | Meldung der Anfrage zeigt das Kürzel statt des Namens („steht heute bei kevin“) | nice | app/api/crm/anfrage/route.ts:85 | `nameVon` | S |
| 5.18 | Veraltete Texte: Der Newsletter verweist auf „unter Recht“, die Schnellleiste nennt „Markttraktion › Event“, der Kanal-Fehler nennt WhatsApp nicht | nice | marketing/Newsletter.tsx:93; kontakt/SchnellLeiste.tsx:58; anfragen.ts:132 | anpassen | S |
| 5.19 | `WEG.event(undefined, r)` baut `?s=event?r=…` (heute ohne Aufrufer) | nice | lib/wege.ts:142 | über `markttraktion(…)` verketten | S |

### 6 · Zu zweit

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 6.1 | Heads im Takt: Nur `power_hour` trägt eine Person. Ohne `x-make-person` antwortet `/api/heads/[head]` mit 403 (`imHaushaltDesInhabers`, ein Test bestätigt die 403). Wochen-, Lead- und Kundenreview, alle Marketing- und alle Event-Läufe laufen nie automatisch. Sie scheitern still und pausieren mit Backoff; der Überblick zeigt „Noch kein Lauf“. **(geprüft)** | blockiert (Heads) | lib/heads/takt.ts:32, 61; lib/zoe/agenten.ts:121, 418–422; app/api/heads/[head]/route.ts:84–86; lib/zugang/haushalt-inhaber.ts:19–28; tests/integritaet-zugang.test.ts:144 | Für Modi ohne Person `person: verantwortlich(welt)` (nur mit Konto); Test „Takt-Lauf Marketing → 200“ | S |
| 6.2 | Ohne „Hält die Beziehung“ gilt die Sales-Verantwortung, also Kevin: Power Hour, Kadenz, „Für dich“, Leads. Malins Sales-Listen bleiben leer, bis zugewiesen wird (so entschieden am 25.09.). **(geprüft)** | stört | lib/crm/team.ts:53, 80; heute.ts:81; followup.ts:172; leads.ts:146 | Im Onboarding zuweisen; Hinweis „n ohne Zuständigkeit“ im Überblick | S |
| 6.3 | Wochen-Scoreboard: Jede Person bekommt dieselben Sales-Anteile (2 Power Hours, 4 Gespräche), gemessen ab der ersten Power Hour irgendeiner Person. Malin ist damit jede Woche rot. **(geprüft)** | stört | lib/crm/scoreboard.ts:107, 184–196 | Anteile nur für Personen mit Sales-Verantwortung bzw. ab ihrer ersten eigenen Sitzung | S |
| 6.4 | Team fest im Code (Kevin Sales, Malin Marketing/Event); nur per Build-Variable änderbar; nicht aus Konten bzw. `team--<haushalt>` | nice (Plattform) | team.ts:14–15, 47–50 | Plattform-Paket 1: Team aus Konten, Verantwortung als Einstellung | L |
| 6.5 | Feste `kevin`/`malin` außerhalb von `team.ts`: | nice (Plattform) | siehe Unterpunkte | über `TEAM`/`verantwortlich()`/`nameVon` zur Laufzeit | M |
| | • Personenfilter der Aktivitäten | | lib/crm/aktivitaeten.ts:373–374 | | |
| | • Kartei-Hinweis | | Kartei.tsx:250 | | |
| | • Import-Owner | | lib/make-one/crm.ts:474–481 | | |
| | • Rückfälle `?? 'kevin'` | | Vernetzen.tsx:36, 295; kontakt-teile.tsx:203; SchnellErfassen.tsx:112; Leads.tsx:197; leads.ts:146 | | |
| | • Takt-Rückfall `['kevin']` | | takt.ts:25, 61 | | |
| | • Prompts der Heads | | lib/heads/prompt.ts:40–136 | | |
| | • Leertext „Was Kevin und Malin notieren“ | | Ueberblick.tsx:119 | | |
| 6.6 | Kampagnen gehören zur Welt „sales“ (Standard Kevin), stehen seit dem Aufräumen aber unter Marketing (Malin). Von Heads angelegte Kampagnen landen bei Kevin. **(geprüft)** | nice | team.ts (`WELT_DER_LISTE`); Kampagnen.tsx:91, 130 | Welt nach Playbook bzw. einstellbar | S |
| 6.7 | Team-Feed „Mandat bearbeitet“, „Kundenreviews“ und Befund „Mandat endet“ führen nach Deals › Auswertung statt zum Mandat **(geprüft)** | nice | team.ts:116, 139; lib/crm/befunde.ts:35 | `mandateLink`/`WEG.mandat` | S |
| 6.8 | Übergabe prüft Kennungen strenger als die Kartei (`{4,60}` gegen `{1,62}`; unbelegt, ob es solche gibt) | nice | lib/crm/uebergabe.ts:56; lib/kennung.ts:39 | `istKontaktKennung` | S |

### 7 · Kennzahlen

| # | Befund | Schwere | Beleg | Vorschlag | Größe |
|---|---|---|---|---|---|
| 7.1 | Der Index startet rot. Unter der roten Schwelle fallen die Punkte bis 0. Nach dem Import ergeben Kontakte mit altem „letzter Kontakt“ sofort überfällige Kadenz (ab 5 rot). Sales liegt damit in den ersten Wochen bei 0–20, der Gesamtwert ist praktisch nur Sales. Im Business-Index ist die Traktion unter 40 rot. | stört | lib/kennzahlen/kern.ts:43–48; lib/crm/kennzahlen.ts:25–27, 42, 73; followup.ts:161–173; lib/business/register.ts:139 | Anlaufphase (4 Wochen „vorläufig“) bzw. Kadenz erst ab Import-Datum zählen | M |
| 7.2 | Zwei Messlatten für dieselbe Zahl: Die Ziele aus Wertelisten (Gespräche je Woche, SQL je Monat) gelten nur für die Einzelampel. Der Index rechnet fest 8/4 und 2/1, zeigt aber den Text der Werteliste. Das Scoreboard hat eigene feste Ziele. | stört | traktion-index.ts:41, 43, 254; scoreboard.ts:107 | Ziele als Schwellen an `traktionsIndex` und `wochenScoreboard` | S/M |
| 7.3 | Morgen-Nachricht und Freitags-Scoreboard nur über Telegram — online wirkungslos (Bote nur am Mac; Telegram wird durch WhatsApp ersetzt) | stört | lib/crm/scoreboard.ts:14–17; components/os/crm/Scoreboard.tsx:225–229; MODUL_LANDKARTE.md | über Glocke bzw. ZOE-WhatsApp (Roadmap-Lücke 5) | M |
| 7.4 | Quoten ohne Mindestmenge: Kanal-Leistung „1 (100 %)“, „Deals aus Marketing“ ab einem Deal | nice | lib/crm/score.ts:74; marketing.ts:221 | `MINDESTMENGE` wie bei der Temperatur | S |
| 7.5 | UTC-Tag statt Berliner Tag bei Aktivitäten (0–2 Uhr → Vortag bzw. Vorwoche) | nice | scoreboard.ts:97, 172; kennzahlen.ts:27 | `tagVon(a.am)` | S |
| 7.6 | Kanal-Leistung verschluckt Fehler; das Scoreboard bleibt bei `ok:false` auf „Lädt …“ | nice | Qualifizierung.tsx:354; Scoreboard.tsx:207–213 | Fehlertext | S |
| 7.7 | Power-Hour-Detail zeigt das Kürzel statt des Namens | nice | lib/crm/traktion-index.ts:100 | `nameVon` | S |

### Reihenfolge (Vorschlag)
1. **Vor bzw. direkt nach dem Upload, alle S:** 6.1, 4.1, 1.1/1.2, 3.1, 3.9, 4.2, 4.3, 5.11 und 1.5, 3.8, 3.2 (Vorgabe GmbH).
   Außerdem der rote Wächter (OnboardingView-Untertitel).
2. **Woche 1 (Feinschliff Markttraktion):**
   - Runde und Texte: 2.1–2.3, 2.5, 2.6, 2.8.
   - Angebot: 3.3–3.6.
   - Follow-up: 4.4–4.8.
   - Marketing und Netzwerken: 5.1, 5.3, 5.13, 5.14.
   - Scoreboard und Ziele: 6.3, 7.1, 7.2.
3. **Danach (M/L):**
   - Ein Weg „Person anlegen“ (1.8).
   - Rechnung schreiben (3.7, 3.13).
   - Prospecting an die Kartei (1.14).
   - Team aus den Konten (6.4, 6.5).
   - Push über WhatsApp (7.3).
