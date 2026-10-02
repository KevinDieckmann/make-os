# Finanzplanung jetzt — Plan und Stand (27.09.2026, abends: Szenario-Baukasten; 02.10.: alle Felder anpassbar, Business-Blätter, Steuern aufgeräumt; 02.10.: Kern-Umbau)

> 30.09.: Die Gesellschaft `ug` heißt **MAKE Innovation GmbH** (kurz „MAKE“, vorher „MAKE OS UG“). Anzeigenamen kommen aus
> `lib/einheiten.ts` (`UG_NAME`/`UG_KURZ`); Kennungen und Code-Namen im Rechenkern (`ug`, `rechneUG`, `MonatUG`, `steuerUG`) bleiben.

Kevin: „Unsere privaten Finanzen und die Firmenfinanzen in einem Szenario planen. Die Zahlen sind echt. Als ‚Finanzplanung jetzt‘
links unter die Agenten, die ganze Systematik, in unserem Design, sofort funktional. Malin sieht alles. Später wandern die Teile
unter Privat › Finanzen und Business — jetzt erst ein eigener Bereich.“

## Quelle
Kevins Einbaupaket „Modul Finanzen v3“ (Vault, 27.09.): Konzept `01. MAKE OS Brain/07_Roadmap/Modul_Finanzen_Konzept.md`
(kritische Prüfung eigener Entwürfe, Recherche YNAB · Monarch · Copilot · Actual · Agicap/Runway · Finanzguru · Profit First),
Rechenkern `finanzen-rechenkern.ts` (gegen Finanzplan v4/Excel geprüft), Mock-up v3 (Funktionsvorlage, Design wird nicht übernommen),
Startbestand `finanzen-plan.json` (🔒 echte Zahlen, nie ins Repo — kommt per Upload auf den Server).

## Aufbau (seit 27.09. abends — Kevin: „so können wir damit noch nichts machen und auch nichts planen“)
| Bereich | Unterseiten | Frage |
|---|---|---|
| Lage | Lage | Frei verfügbar diesen Monat · Runway · Ziele im Plan — und was jetzt zu entscheiden ist (mit Sprung ins Feld) |
| Planen | Szenarien bauen · Treiber, Annahmen & Steuern | Szenario = Basis + Bausteine + Annahmen; Regler; Vergleich; Arbeitsplan |
| Privat | Privat | Das Privat-Blatt (IST-Historie + Plan) |
| Business | MAKE Innovation GmbH · KD Ventures · Selbstständigkeit | Die Gesellschaften getrennt |
| Gesamt | Gesamt · Entwicklung · Geldfluss | Übergänge (Gehalt, Ausschüttung), Mindestumsatz, Steuerrücklage, Gruppe je Monat |
| Buchungen & Check | Buchungen · Budget · Wochen-Check · Zu erledigen · Kalender & Verträge · Schulden | IST, Tempo, Verpflichtungen, Rhythmus |
| Ziele & Töpfe | Ziele · Töpfe MAKE | Ziele mit Tempo, Profit-First-Töpfe |
| Protokoll | Protokoll | Wer hat was geändert |

Die 17 alten Unterseiten leben darunter weiter; alte `?u=`-Adressen lösen auf (`bereichVon` in `lib/finanzen/plan/hilfen.ts`). Bei einem Bereich mit nur
einer Unterseite verschwindet die Pillenzeile. Das ursprüngliche Konzept-Raster (§ 3: Überblick · Monat · Planen · Verpflichtungen · Auswerten) steht in
der Git-Geschichte (82e43c2).

## Szenario-Baukasten (Kevins Entscheidungen 27.09.)
**Modell.** Ein `Planszenario` (`lib/finanzen/szenarien.ts`) = Basis + Bausteine + Annahmen:
- **Basis** = der Ist-Plan des Dokuments (Zeilen `privatBudget`/`sachkosten`/…, Zellen-Überschreibungen `plan`, gemeinsame `annahmen`) + ein
  **Treiber-Szenario** des Rechenkerns (`basis` = `d.szenarien[].id`, Kevins S1–S5 mit One Banking, Retainern, ASTARNA, Events, KEMARIS-Ausstieg).
- **Umsatzbaustein** = Produkt/Leistung × Kunde/Segment × Preis netto × Menge × Rhythmus (monatlich · jährlich · einmalig) × Start × Laufzeit ×
  Zahlungsziel, Einheit MAKE · Privat · KD Ventures. `produktId` zeigt auf den Katalog; ohne = „ohne Produkt“.
- **Kostenbaustein** = Art (Stelle · Software · Miete · Rate · Sonstiges) × Betrag × Menge × Rhythmus × Start × Laufzeit, Einheit wie oben.
  Stelle = Brutto, der Kern rechnet den Arbeitgeberanteil dazu; Software → Sachkosten; Miete/Rate wirken meist privat.
- **Annahmen je Szenario** (`PlanAnnahmen`): Kevin/Malin brutto, Steuerquote MAKE, Vorgabe Zahlungsziel, Ausschüttung MAKE → Privat ab Monat (brutto) und
  **pauschale Steuer auf die Ausschüttung** (`ausschuettungSteuer`, Vorgabe 26,4 % = Kapitalertragsteuer + Soli, Kevin 27.09.; Hinweis, keine
  Steuerberatung). Leer = wie im Dokument bzw. Vorgabe.
- **Regler** (Was wäre wenn) sind gewöhnliche Bausteine mit `regler`-Marke bzw. Annahmen — die Oberfläche findet sie wieder, die Rechnung nicht.
- Jeder Baustein hat `an` (aus- und einschaltbar ohne Löschen).

**Rechenweg.** `reihen(ps, N)` löst Bausteine in Monatsreihen `Zusatz` auf (Index = Plan-Monat − 1): `ugUmsatz` (Leistung, Gewinn), `ugEingang`
(Kasse, um das Zahlungsziel verschoben; USt kommt wie beim Retainer obendrauf), `ugPersonal` (Brutto weiterer Stellen), `ugSach`, `ausschuettung` (brutto,
verlässt die MAKE-Kasse), `ausschuettungSteuer` (= brutto × Quote; privat kommt brutto − Steuer an, `MonatPrivat.ausschuettung` ist netto,
`ausschuettungSteuer` der Abzug), `privatEin`/`privatAus`, `kdvEin`/`kdvAus`. `annahmenMit()` legt die Szenario-Annahmen über `d.annahmen`. `rechneMit(d, ps, treiber?)` ruft
`rechneUG(d', sz, x)` und `rechnePrivat(d', ug, sz, x)` — der Kern **addiert** die Reihen nur (`+ zx(x?.…, i)`); ohne Zusatz rechnet er Zeile für Zeile wie
bisher (Test „ohne Planszenario rechnet der Kern exakt wie bisher“). Neue Kern-Felder: `MonatUG.bausteineUmsatz/bausteineEingang/stellen/bausteineSach/
ausschuettung/kdvBausteineEin/kdvBausteineAus`, `MonatPrivat.ausschuettung/bausteineEin/bausteineAus`; `toepfeUG` zählt Stellen zu den laufenden Kosten,
der Zahlungskalender zeigt Bausteine, Stellen und Ausschüttung.

**Auswertung** (`auswertung(d, ug, pr)`): `m0` = Plan-Monat von „jetzt“ (vor Okt 26 = 1) · **frei verfügbar** = MAKE frei (nach Steuer/USt) + KD-Ventures-Konto
+ (bekannte private Kontostände aus den Posten + Luft des Monats; fehlende Konten werden gezählt) · **Runway** MAKE = Monate ab jetzt bis `frei < 0`, Privat =
bis (Konten + kumulierte Luft) < 0, sonst null (= über den Horizont) · **Ziele** im Plan/knapp/gekippt aus `zielStaende` · **Mindestumsatz** = Personal inkl.
Stellen + Sachkosten + Holding je Monat (jetzt, Ø 12 Monate, gegen Umsatz Ø 12) · **Steuer** Rücklage jetzt, USt offen, nächste Ertragsteuerzahlung ·
**Übergänge** Gehälter brutto/netto, Ausschüttung brutto/Steuer/netto (Gesamt zeigt alle drei; die Steuer steht auch in der Steuerrücklage-Kachel). `entscheidungen()` leitet daraus Punkte ab (MAKE unter null, Privat im Minus, Runway < 6, Umsatz unter
Mindestumsatz, Ziele gekippt/knapp, Steuer fällig, Konten fehlen, Buchungen offen, kein Arbeitsplan) — kritisch zuerst, jeder mit Sprung
(`?u=planen&sz=…&feld=umsatz|privat`, `ziele`, `toepfe`, `posten`, `buchungen`, `gesamt`). `vergleich(d, [null, ps…], 3)` rechnet bis zu drei
Spalten (null = Basis).

**Arbeitsplan.** `arbeitsplan` (Kennung) im Dokument; `rechne()` in der Oberfläche und `kennzahlenVon()` (ZOE) rechnen immer mit ihm — Privat-Blatt, MAKE,
KDV, Gesamt, Lage, Treiber-Vergleich (dort mit den Bausteinen des Arbeitsplans je Treiber). Ohne Arbeitsplan gilt der reine Treiber (`aktiv`). Klick auf
einen Treiber setzt `aktiv` und die `basis` des Arbeitsplans.

**Speicherung.** Neue Schlüssel `planszenarien: Planszenario[]` und `arbeitsplan: string | null` im Plan-Dokument (nicht `szenarien` — der Schlüssel war
schon von Kevins Treiber-Szenarien belegt). Operationen wie bisher (`/planszenarien/id=ps1/bausteine/id=b1/preis`, `/planszenarien/-`, `/arbeitsplan`),
Rückgängig als Gegenoperation, 409 bei fremdem Stand. Server-Regeln: Arbeitsplan nur auf vorhandene Kennung (oder null), neues Planszenario braucht freie
Kennung, gelöschtes Planszenario → Arbeitsplan null, gelöschter Treiber → Basis der Planszenarien auf den aktiven. `pruefeDokument` bereinigt
(`pruefePlanszenarien`) und ergänzt fehlende Schlüssel — **ältere Dokumente ohne `planszenarien` laufen** (Test).

**Oberfläche.** `components/os/finanzplan/Baukasten.tsx` (Planen › Szenarien bauen): Szenario-Pillen (★ = Arbeitsplan), + Szenario (Dialog mit Treiber),
Duplizieren/Umbenennen/Löschen, Treiber wählen; Karten Umsatzbausteine (Tabelle, Produkt-Auswahl, Kunde, Wo, Preis, Menge, Rhythmus, ab, Monate,
Zahlungsziel, Summe im Plan; Chips „+ Produkt“ aus dem Katalog — gelb, wenn dem Produkt etwas fehlt — und „Ist-Basis“ aus Mandaten/gewonnenen Deals),
Kostenbausteine (+ Stelle · Software · Miete · Rate), Annahmen dieses Szenarios, Regler; rechts Wirkung gegen Basis (Kacheln + Linie MAKE frei/Privat
angespart, gestrichelt = Basis), Ziele/Mindestumsatz; unten Vergleich nebeneinander (Basis + bis zu zwei, ★ Arbeitsplan je Spalte). Felder speichern bei
Enter/Verlassen (sofort lokal gerechnet), Regler beim Loslassen. `Gesamt.tsx`: Kacheln (frei jetzt, Mindestumsatz-Deckung, Steuerrücklage, USt, Gehälter,
Ausschüttung, Selbstständigkeit 2026), Linie, Blatt „Gesamt je Monat“. `Ueberblick.tsx › LageKopf`: drei Zahlen + „Was jetzt zu entscheiden ist“ +
„Planungsrunde öffnen“; darunter die bisherige Lage.

## Alle Felder anpassbar · Business-Blätter · Steuern aufräumen (02.10.2026, Branch `finanzen`)
Kevin: „Businessplanung und die allgemeine fertig machen. Unten stehen so viele Steuern, die wir nicht brauchen. Alle Felder anpassbar.“
Der Rechenkern blieb in diesem Schritt, wie er war (Namen, Formeln; nur drei optionale Felder im Typ `FinanzDaten`) — **am selben Tag hat Kevin den Kern dann ausdrücklich freigegeben: siehe „Kern-Umbau 02.10.“ unten; die Aussagen zu Steuern und Selbstständigkeit in diesem Abschnitt beschreiben den Stand davor.** Anpassbar wird über Eingaben, Annahmen und Sichtbarkeit.

**Bestandsaufnahme (Stand 1818c5c).** Fest oder nicht editierbar waren: die Netto-Tabelle (nur angezeigt), Stichtag („heute“) nur per „auf heute setzen“,
alle Ampel-Grenzen (Runway 6/12 Monate, frei verfügbar 5.000, Tiefpunkt 1.000, Jahresende 20.000, Luft 250/100, Ankeranteil 30 %, 20 offene Buchungen) im Code,
Steuersätze lagen als 4 von 27 gleichrangigen Feldern in „Treiber & Annahmen“ ohne Bezug zur Rechtsform. Das Business-Blatt der MAKE Innovation GmbH hatte keine
Produkte (nur Treiber-Zeilen, die nicht zur Umsatzsumme addierten), kein Ergebnis nach Steuern, keinen Break-even; KD Ventures hatte keine einzige editierbare
Zelle und kein Ergebnis; die Selbstständigkeit nur den Jahresabschluss 2026. „Unten“ standen Steuern an fünf Stellen: UG-Blatt (USt vereinnahmt, USt an Finanzamt,
Ertragsteuer, Steuerrücklage, USt offen), Gesamt (Steuerrücklage, USt offen, Steuer auf Ausschüttung, zwei Kacheln), Töpfe, KD Ventures (Steuer auf Ausstieg),
Annahmen-Raster. Lage zeigte dieselben Warnungen zweimal („Was jetzt zu entscheiden ist“ und „Worauf wir achten“), zwei Knöpfe „Planungsrunde“, Kacheln für
Ankermandat/Retainer auch ohne solche Treiber.

**Welche Steuern gelten?** (`lib/finanzen/steuern.ts`, Karte `components/os/finanzplan/Steuern.tsx` je Gesellschaft in den Business-Blättern und gesammelt unter
Planen › Treiber, Annahmen & Steuern.) Dokument-Feld `steuern?: { <ort>: { rechtsform?, einzeln?, zeilen?: { <art>: { an?, satz?, hebesatz? } } } }`, ohne Eintrag gilt der Standard:
- **Rechtsform** bestimmt, welche Zeilen überhaupt vorkommen. MAKE Innovation GmbH und KD Ventures = Kapitalgesellschaft, Selbstständigkeit = Einzelunternehmen (`rechtsformStandard`);
  wechselbar nur bei der Gesellschaft, an der der Kern die Ertragsteuer hängt (`ug`). Kapital: KSt · Soli · Gewerbesteuer (Messzahl × Hebesatz) · USt (Durchlauf) · Ausschüttung;
  Einzel: Einkommensteuer-Vorauszahlung pauschal · USt · Ausschüttung; KD Ventures: nur Steuer auf den Ausstieg; Selbstständigkeit: Einkommensteuer (Grundtarif, nur Anzeige-Schalter);
  Privat: Netto-Tabelle (jetzt editierbar) und Ausschüttung. Was der Plan nicht rechnet (Kirchensteuer …), steht nicht da — kein Schalter ohne Wirkung.
- **Zwei Ebenen, die Zahl bleibt:** (1) *Sichtbarkeit* — abgeschaltete Zeilen verschwinden aus den Blättern, USt steht als eingeklappter Block „Umsatzsteuer — Durchlauf“,
  Nullzeilen hinter „n weitere Steuerzeilen ›“ (Blatt: `optional`, `GruppenZeile.zu/leerName`). (2) *Aufschlüsselung* — „Nach Steuerarten einstellen“ verteilt den heutigen Gesamtsatz
  (`annahmen.steuerUG`) auf KSt + Soli + Gewerbesteuer (Hebesatz = Rest, `aufteilen()`): der Gesamtsatz und jede Zahl bleiben beim Einschalten **exakt gleich** (Test). Erst eine
  Änderung eines Bestandteils schreibt die Summe in `annahmen.steuerUG` (gleiche Änderung, ein Rückgängig). Pauschale Sätze (Einzel-Ertragsteuer, Ausstieg): „gilt nicht“ = Satz 0, der
  alte Satz bleibt im Profil gemerkt und kommt beim Einschalten zurück. USt „aus“ ist reine Anzeige (Durchlauf ändert den Gewinn nicht); die Ein-/Auszahlungssummen sagen dann „inkl. USt-Durchlauf“.
- Steuer-Sätze liegen NUR hier (nicht mehr im Annahmen-Raster): Ertragsteuer-Gesamtsatz, USt-Satz, Zahlmonat, Ausstieg; Ausschüttung gilt je Szenario (Arbeitsplan).

**Business-Blatt je Gesellschaft** (`Geschaeft.tsx`, Rechnung `lib/finanzen/geschaeft.ts` — rechnet nichts neu, was der Kern kennt): Kacheln Umsatz · Kosten · Ergebnis vor/nach Steuern (12 Monate) ·
Break-even (Monatsergebnis dauerhaft ≥ 0; „insgesamt gedeckt ab“ = Summe) · Runway; **Produkte** (Name, Kunde, Preis netto, Anzahl, Rhythmus, Start, Laufzeit — frei anlegbar, Vorlagen
„Interim CSO“, „Interim Head of Sales“, „Events“ ohne Preis, `BEISPIEL_PRODUKTE`) und **Kosten** (Stelle mit Arbeitgeberanteil · Software · Miete · Rate · Sonstiges) schreiben in den
Arbeitsplan — gibt es keinen, legt das erste Produkt ihn in derselben Änderung an; das Blatt je Monat mit Umsatz, Kosten, Ergebnis vor/nach Steuern (Aufwand = Quote × Zuwachs des Jahresgewinns,
summiert sich auf Quote × Jahresgewinn), Zahlungsfluss, Liquidität, Steuern; **Zelle klicken → ändern** auch bei Produkten/Kosten: Baustein-Feld `ueber` (`m<Plan-Monat>` → Betrag, gilt unabhängig von
Start/Laufzeit, „aus“ schaltet auch ihn ab; `betragImMonat`). Danach „Welche Steuern gelten?“ und „Annahmen“ der Gesellschaft (`annahmen-felder.ts`, jedes Kern-Feld hat genau einen Ort;
`ruecklage5a` wirkt im Kern nirgends und ist bewusst kein Feld, `notgroschenMonate` ebenfalls ungenutzt). Selbstständigkeit: eigenes Blatt aus ihren Bausteinen, darunter der Abschluss 2026.
Hinweis zum Kern (Stand vor dem Umbau, überholt): Bausteine der Selbstständigkeit liefen über die Kanäle der MAKE Innovation GmbH; seit dem Kern-Umbau 02.10. haben sie eine eigene Achse und das MAKE-Blatt hat die Zeile „Selbstständigkeit (Kern rechnet hier mit)“ nicht mehr.

**Allgemeine Planung.** Lage: Karte „Noch offen in der Planung“ (`luecken()` — kein Arbeitsplan, Netto-Tabelle fehlt, Gesellschaft ohne Umsatz, Produkt ohne Preis, Steuern nicht durchgesehen, keine Gehälter, keine Fixkosten,
Konten, Ziele; jeder Punkt mit Sprung), Warnungen nicht mehr doppelt, ein Knopf „Planungsrunde“, Ankermandat-/Retainer-Kacheln nur, wenn es solche Treiber gibt. Gesamt: Karte „Übergänge einstellen“ (Gehälter, Ausschüttung, Ausschüttungssteuer),
Steuer-Kacheln/-Zeilen folgen dem Steuerprofil, Steuern als eingeklappte Gruppe. Planen › „Treiber, Annahmen & Steuern“: Annahmen je Gesellschaft, **Netto-Tabelle editierbar** (Schreibweg lehnt unsortierte ab),
Einstellungen (Stichtag, Reserve), **Ampeln und Schwellen** (`schwellen?`, leer = bisherige Vorgabe; Lage, Baukasten und „Was jetzt zu entscheiden ist“ lesen sie). Unter den Pillen steht je Unterseite eine Frage (`FRAGE`).
Handy: die Seite war durch die Reiterleiste 717 px breit — `minWidth: 0` am Seitenrahmen, Steuerzeilen als umbrechende Zeilen statt Tabelle; 375 px ohne Seitenscroll.

**Schreibweg.** Neue erlaubte Bereiche `steuern`, `schwellen` (bereinigt nach jeder Änderung: Sätze begrenzt, Unbekanntes verworfen, leer = Schlüssel entfernt), `annahmen/nettoTabelle` wird geprüft; `pruefeDokument` behält die neuen Schlüssel,
ältere Dokumente ohne sie laufen unverändert. `eur()` zeigt nie „-0“.

**Tests (neu).** `finanzplan-regression` (Goldwerte aus dem unveränderten Kern 1818c5c, zwei Fassungen × mit/ohne Arbeitsplan; Ausblenden/Aufschlüsseln/Schwellen ändern keine Zahl bit-genau), `finanzplan-steuern`, `finanzplan-geschaeft`
(Break-even, Runway, Steuer-Aufwand, Blatt je Gesellschaft, Produkte, `ueber`, Lücken, Annahmen-Abdeckung), `finanzplan-felder-routen` (Speichern mit Stand/409 für alle neuen Felder), `finanzplan-ansichten` (alle 19 Unterseiten rendern, mit/ohne Arbeitsplan, leer; Business-Blatt und Steuerkarte).

**Offene Entscheidungen für Kevin (Rechenkern) — am 02.10. entschieden, Punkte 1–4 sind im „Kern-Umbau 02.10.“ umgesetzt:**
1. Steuern je Gesellschaft: Der Kern kennt EINE Ertragsteuer-Quote (`steuerUG`, Zahlung im Folgejahr, MAKE Innovation GmbH). Echte Einzelrechnung (KSt/Soli/Gewerbesteuer getrennt, Gewerbesteuer-Freibetrag/Anrechnung, KiSt, eigene Steuer für KD Ventures oder die Selbstständigkeit im Monatsraster) bräuchte neue Formeln. Bis dahin: Summe aus den Bestandteilen.
2. Selbstständigkeit hat im Kern keine eigene Monatsachse; ihre Bausteine fließen in die UG-Zahlen (wie vorher). Eigene Achse = Kernänderung (`Zusatz` um `kdc*` erweitern).
3. Einkommensteuer der Selbstständigkeit: Grundtarif 2026 fest (`est2026`); ein pauschaler Satz wäre eine Formeländerung.
4. `ruecklage5a` und `notgroschenMonate` sind im Kern/der Oberfläche ohne Wirkung — löschen oder anschließen?
5. Ankermandat/Retainer/Provision (Treiber-Zeilen) tragen Namen aus Kevins Szenarien; für andere Instanzen neutral benennen, sobald der Treiber-Aufbau freigegeben wird.

## Kern-Umbau 02.10. (Branch `kern`, Kevins ausdrückliche Entscheidung)
Kevin am 02.10.: den Rechenkern ändern — vier Punkte. Die Regel „Namen/Formeln unverändert bis Kevins Wort“ (CLAUDE.md) ist für genau diese vier Punkte aufgehoben, für alles andere im Kern gilt sie weiter.
Dazu sein Zusatz: *„Mir ist wichtig, dass ich alles anpassen kann in den Rechnungen, damit ich selber spielen kann.“* — jeder neue Parameter ist ein editierbares Feld mit Vorgabe, nie eine Konstante.

### Was sich ändert
1. **Steuern einzeln.** `lib/finanzen/ertragsteuer.ts` (rein) ersetzt die EINE Ertragsteuer-Quote. Je Gesellschaft ein Steuerrechner, der Monat für Monat den Gewinn vor Steuern bekommt und Aufwand, Zahlung, Rücklage, Verlustvortrag liefert.
   - **Kapitalgesellschaft** (MAKE Innovation GmbH, KD Ventures; Rechtsform aus `steuern.ts`, je Gesellschaft wechselbar): Körperschaftsteuer 15 % × Gewinn · Soli 5,5 % × KSt · Gewerbesteuer = Messzahl 3,5 % × Hebesatz × Gewinn.
     Beispiel (Test): Gewinn 100.000 €, Hebesatz 400 % → KSt 15.000, Soli 825, GewSt 14.000, zusammen 29.825 €.
   - **Einzelunternehmen** (Selbstständigkeit): Einkommensteuer nach Grundtarif auf (Gewinn − Vorsorge − Sonderausgaben); Gewerbesteuer = Messzahl × Hebesatz × (Gewerbeertrag − Freibetrag 24.500 €); Anrechnung nach § 35 EStG = min(Faktor 4,0 × Messbetrag, Gewerbesteuer, Einkommensteuer). Beispiel (Test): Gewinn 60.000 €, Hebesatz 400 % → Messbetrag 1.242,50, GewSt 4.970, Anrechnung 4.970 → Netto = ESt; bei Hebesatz 500 % bleiben 1.242,50 € Mehrbelastung.
   - **Verlustvortrag** (einfach): ein Verlust mindert die Gewinne der Folgejahre in voller Höhe, ein Topf für KSt, Gewerbesteuer und Einkommensteuer; Mindestbesteuerung (60 % über 1 Mio. €) nicht abgebildet.
   - **Zahlung:** Standard wie bisher im `steuerMonat` (Vorgabe Juni) des Folgejahres; Option **Vorauszahlung je Quartal**: ein Viertel der Steuer des Vorjahres im März, Juni, September, Dezember, im Zahlmonat des Folgejahres der Abschluss (Steuer − Vorauszahlungen, kann eine Erstattung sein). Im ersten Planjahr (nur Okt–Dez 26) gibt es mangels Vorjahr keine Vorauszahlungen.
   - **Rücklage** = aufgelaufene Steuer − bezahlte; `MonatUG.st` / `kdvSt` / `MonatSelbst.st` tragen Aufwand je Steuerart (`kst`, `soli`, `gewst`, `est`, `anrechnung`, `summe`), `zahlung`, `ruecklage`, `verlustvortrag`. `MonatUG.steuer`/`steuerRuecklage` bleiben als Zahlung und Rücklage.
   - **KD Ventures** bekommt eine eigene Rechnung im Monatsraster: laufendes Ergebnis = Bausteine (Umlage und Partnerdarlehen-Rate heben sich weiter auf), versteuert wie eine GmbH, bezahlt aus dem KDV-Konto; `kdvFrei` = Konto − Rücklage. Die pauschale **Steuer auf den Ausstieg bleibt zusätzlich**; der Ausstieg selbst fließt nicht noch einmal in KSt/GewSt (Näherung für Veräußerungsgewinn, § 8b KStG).
   - **Vorgabe des Hebesatzes** = aus dem früheren Gesamtsatz `annahmen.steuerUG` abgeleitet (`aufteilen()`: KSt, Soli, Messzahl in der Vorgabe, Hebesatz = Rest) — bei unveränderten Eingaben kommt dieselbe Gesamtquote heraus (Test gegen die alte Formel). Reicht der Gesamtsatz nicht für KSt + Soli, schrumpft die Vorgabe-KSt. `steuerUG` ist jetzt nur noch diese Vorgabe; je Szenario überschreibbar wie bisher.
2. **Selbstständigkeit eigene Rechnung.** `rechneSelbstAchse` → `MonatSelbst`: Umsatz (Bausteine, Zahlungsziel verschiebt den Eingang, USt obendrauf und im Folgemonat ans Finanzamt), Kosten (Stellen mit Arbeitgeberanteil, Software/Miete/…, dazu Sachkosten-Zeilen mit `einheit: 'selbststaendigkeit'`), Ergebnis vor/nach Steuern, **eigenes Konto** (Start `selbst.kontoStart`), Rücklage, frei = Konto − Rücklage − USt. Bausteine ohne Zuordnung (oder mit unbekannter Einheit) bleiben wie bisher bei MAKE. Das MAKE-Blatt hat die Zeile „Selbstständigkeit (Kern rechnet hier mit)“ nicht mehr.
   **Entnahme → Privat:** Regel im Szenario (`annahmen.entnahme`): fester Betrag je Monat ab Monat und/oder Anteil am positiven Ergebnis nach Steuern; schon versteuert, keine weitere Steuer; ohne Regel bleibt das Geld im Konto der Selbstständigkeit. Gesamt/Privat: `MonatPrivat.entnahme` zählt zu „verfügbar“; **Gesamt = MAKE + KD Ventures + Selbstständigkeit + Privat** (Kacheln, Linie, Blatt, Ziel „Gruppe“, Lage).
3. **Einkommensteuer der Selbstständigkeit** nach echtem Grundtarif (`estTarif`, Vorgabe 2026 = `est2026`), einzeln einstellbare Eckwerte. Auf das Ergebnis der Selbstständigkeit minus Vorsorge/Sonderausgaben (Abschluss-Felder) — **keine privaten Einkünfte aufaddiert**: der Kern kennt nur Netto-Beträge (Gehälter über die Netto-Tabelle), nichts Steuerpflichtiges brutto; ein Progressionseffekt der Gehälter wird nicht abgebildet. Soli auf die ESt entfällt (Freigrenze), Kirchensteuer wird nicht gerechnet.
4. **`ruecklage5a` und `notgroschenMonate` gelöscht** (Typ, Säuberer, Oberfläche, Tests). Dokumente mit den Feldern werden beim Lesen ignoriert (`annahmenOhneAlt`, `einstellungen` wird neu aufgebaut) und beim nächsten Schreiben ohne sie geschrieben.

### Parameter (alle editierbar, leer = Vorgabe)
| Parameter | Ort | Vorgabe |
|---|---|---|
| KSt-Satz · Soli-Satz · Gewerbesteuer-Messzahl · Hebesatz | je Gesellschaft (`steuern[ort].zeilen`) | 15 % · 5,5 % · 3,5 % · aus `steuerUG` abgeleitet |
| Zeile an/aus (KSt, Soli, GewSt, ESt, USt, Ausstieg) | je Gesellschaft | an |
| Rechtsform | je Gesellschaft | Kapital (MAKE, KDV) · Einzel (Selbstständigkeit) |
| Verlustvortrag · Zahlweise · Zahlmonat | je Gesellschaft (`steuern[ort].param`) | an · Folgejahr · `annahmen.steuerMonat` (6) |
| Gewerbesteuer-Freibetrag · Anrechnungsfaktor § 35 | je Gesellschaft (Einzel) | 24.500 € · 4,0 |
| Tarif-Eckwerte der Einkommensteuer (13 Felder) | je Gesellschaft (Einzel) | 2026 |
| Steuer auf den Ausstieg | Plan (`annahmen.exitSteuer`) und Szenario | 25 % (Plan) |
| Entnahme (Betrag, Anteil, ab Monat) | Szenario (`annahmen.entnahme`) | keine |
Alles Steuerliche gilt **je Gesellschaft und je Szenario**: im Plan unter `steuern`, im Szenario als Überlagerung `planszenarien[].annahmen.steuern` (nur eingetragene Felder greifen, `steuernMit`). Oberfläche: Karte „Welche Steuern gelten?“ in den drei Business-Blättern und unter Planen › Treiber, Annahmen & Steuern („Gilt für: ganzen Plan / nur Arbeitsplan“); im Baukasten je Szenario; Felder zeigen die Vorgabe als grauen Platzhalter, „↺ zurücksetzen“ leert. Der Schreibweg ist der vorhandene (Stand/409, Protokoll, Rückgängig), die Blätter rechnen sofort neu. Entnahme: Selbstständigkeit-Blatt, Gesamt › Übergänge, Baukasten › Annahmen.

### Näherungen (Hinweis, keine Steuerberatung)
Bemessungsgrundlage = Gewinn vor Steuern (keine Hinzurechnungen/Kürzungen, Messbetrag nicht auf 100 € gerundet; die Gewerbesteuer mindert die KSt nicht) · Verlustvortrag einfach (siehe oben) · jedes Kalenderjahr für sich · Einkommensteuer ohne private Einkünfte, ohne Soli und Kirchensteuer · Anrechnung vereinfacht als Faktor auf den Messbetrag · Ausstieg nur mit der pauschalen Steuer.

### Vorher-Nachher (erfundene Fixture-Pläne, Kern c83cb1f → Umbau)
`tests/fixtures/finanz-plan.ts` (`planFix(Ankermandat)`, Arbeitspläne `arbeitsplanFix()` und `arbeitsplanSelbst()`), 27 Plan-Monate, Beträge in €. „A“ = kleiner Umsatz (Ankermandat 4.000 €), „B“ = größerer (14.000 €). Vorher-Zahlen stehen als `tests/fixtures/kern-vorher.json`.
Ohne Arbeitsplan (A und B) ändert sich **keine Zahl** außer „Frei verfügbar gesamt“ (+ 5.000 €: das Konto der Selbstständigkeit zählt jetzt mit).

| Kennzahl | A Arbeitsplan: vorher | nachher | B Arbeitsplan: vorher | nachher | B Selbstständigkeit: vorher | nachher |
|---|---|---|---|---|---|---|
| Ergebnis nach Steuern MAKE (27 Monate) | -151.186 | -153.766 **≠** | -39.508 | -41.668 **≠** | 45.524 | -41.668 **≠** |
| Ergebnis nach Steuern KD Ventures | 23.750 | 22.350 **≠** | 23.750 | 22.350 **≠** | 23.750 | 22.350 **≠** |
| Ergebnis nach Steuern Selbstständigkeit | 3.000 | 3.000 | 3.000 | 3.000 | 91.255 | 91.255 |
| Steuerzahlungen 2026 | 0 | 0 | 0 | 0 | 0 | 0 |
| Steuerzahlungen 2027 | 1.863 | 1.499 **≠** | 10.263 | 9.899 **≠** | 14.631 | 10.088 **≠** |
| Steuerzahlungen 2028 | 0 | 672 **≠** | 19.923 | 20.175 **≠** | 34.623 | 30.899 **≠** |
| Runway MAKE (Monate) | 7 | 5 **≠** | 21 | 21 | über Horizont | 21 **≠** |
| Runway Privat (Monate) | 0 | 0 | 0 | 0 | 0 | 0 |
| Frei verfügbar MAKE jetzt | 7.841 | 7.481 **≠** | 15.041 | 14.681 **≠** | 12.785 | 14.681 **≠** |
| Frei verfügbar Selbstständigkeit jetzt | — | 5.500 **≠** | — | 5.500 **≠** | — | 4.700 **≠** |
| Frei verfügbar gesamt jetzt | 8.591 | 13.731 **≠** | 15.791 | 20.931 **≠** | 13.535 | 20.131 **≠** |
| Privat-Luft, schlechtester Monat | -700 | -700 | -700 | -700 | -700 | -700 |
| Privat-Luft, Summe | 57.952 | 57.952 | 57.952 | 57.952 | 57.952 | 57.952 |

**Erklärung der Abweichungen**
- *Ergebnis nach Steuern MAKE* — A/B Arbeitsplan: der Baustein „K“ der Selbstständigkeit (500 € × 6 Monate = 3.000 €) liegt nicht mehr in den MAKE-Zahlen; die MAKE-Steuer sinkt um 28 % davon. **B Selbstständigkeit:** vorher steckten 6.000 €/Monat Umsatz der Selbstständigkeit in den MAKE-Zahlen (Ergebnis +45.524, Runway „über Horizont“, Tiefpunkt +12.785), jetzt rechnet MAKE allein (−41.668, Runway 21 Monate, Tiefpunkt −57.168) und die Selbstständigkeit steht für sich (+91.255 nach Steuern). Die Summe von MAKE + Selbstständigkeit vor Steuern ist unverändert (Test).
- *KD Ventures* (alle Arbeitsplan-Fälle): der Baustein „V“ (200 €/Monat ab Dez 26) wird jetzt wie bei einer GmbH versteuert (28 % von 5.000 € = 1.400 €, gezahlt Juni 27/Juni 28); vorher zahlte KDV nur die pauschale Steuer auf den Ausstieg.
- *Steuerzahlungen* — 2027/2028 (alle drei Gesellschaften zusammen): A/B Arbeitsplan verschieben sich aus denselben Gründen (MAKE ohne den Gewinn der Selbstständigkeit, dazu die KDV-Zahlung im Juni 28: 672 €). **B Selbstständigkeit:** 2027 14.631 → 10.088, 2028 34.623 → 30.899 — vorher wurde der Gewinn der Selbstständigkeit mit der MAKE-Quote (28 %) versteuert, jetzt mit dem Grundtarif (Einkommensteuer 15.845 € Aufwand über 27 Monate statt 28 % × 107.100 €); die Gewerbesteuer ist bei diesem Hebesatz durch die Anrechnung nach § 35 EStG ausgeglichen (Faktor 4,0 × Messbetrag ≥ Gewerbesteuer).
- *Frei verfügbar Selbstständigkeit* (neu, nicht vorher): Konto (Start 5.000 €) + Ergebnis − Rücklage − USt. *Frei verfügbar gesamt* nimmt sie als vierten Strom mit — **das ist eine Definitionsänderung** (CLAUDE.md hielt „frei verfügbar“ am 27.09. fest; Kevins Auftrag 02.10. „Gesamt nimmt die Selbstständigkeit als eigenen Strom“). Wer das nicht will: `Auswertung.frei.kdc` aus `frei.gesamt` herausnehmen.
- *Privat* (Luft Summe/Minimum, Runway Privat): **unverändert**, solange keine Entnahme-Regel gesetzt ist; mit Entnahme steigt „verfügbar“ um den Betrag.
- Der alte Wächter „Gesamtsatz bleibt beim Aufschlüsseln gleich“ entfällt (es gibt keine Aufschlüsselung mehr, der Kern rechnet die Teile selbst); ersetzt durch „leere Felder = alte Gesamtquote“ (Test gegen die alte Formel) und „von Hand eingetragene Vorgaben = leere Felder (bit-genau)“.

### Regression und Tests
- `tests/finanzplan-regression.test.ts`: Goldwerte für A/B ohne Plan **unverändert**; mit Arbeitsplan auf die neuen Werte angepasst (Erklärung im Kopf des Tests); neu **„Nicht betroffene Teile bleiben exakt gleich“** gegen `tests/fixtures/kern-vorher-gold.json` (aus dem alten Kern erzeugt, Plan ohne Selbstständigkeit und ohne KDV-Baustein): Privat-Blatt je Monat, Ziele (Verlauf, Erreicht-Monat, Status), Töpfe, Buchungen/IST, MAKE-Konto/frei/Steuer/Rücklage, Kennzahlen, Auswertung (auf 1e-8; die Steuer ist jetzt eine Summe der Einzelsteuern, das ändert nur die letzten Bits).
- `tests/kern-steuern.test.ts` (88 Tests): Tarif (von Hand und mit Eckwerten), KSt/Soli/GewSt-Beispiele, Verlustvortrag (auch über mehrere Jahre), Freibetrag/Anrechnung, Steuerrechner (Folgejahr, Zahlmonat, Quartal), MAKE und KD Ventures im Kern, Selbstständigkeit-Achse (Konto, USt, ESt, Rücklage, Sachkosten-Zeilen), Entnahme, Gesamt-Summen konsistent (Summe der Gesellschaften = Gesamt), Altdaten, und **für jeden Parameter: geändert wirkt, geleert wirkt wie die Vorgabe, im Szenario = im Plan** (23 Fälle × 2: eingetragen/geleert und Plan/Szenario).
- Angepasst: `finanzplan-steuern` (neue Felder/Zeilen), `finanzplan-geschaeft` (Blatt aus dem Kern), `finanzplan-ansichten` (Karte, Selbstständigkeit-Blatt, Gesamt), `finanz-einheiten-summen` (kdc-Achse, KDV-Konto), `finanzplan-szenarien`.

### Kompatibilität und Rückweg
Siehe `GO_LIVE_CHECKLISTE.md` › „Was beim Rückweg wegfällt“ (Eintrag „Kern-Umbau 02.10.“). Kurz: alle neuen Felder sind optional (`steuern`, `schwellen`, `planszenarien[].annahmen.{steuern,exitSteuer,entnahme}`); der Online-Säuberer (1818c5c/af4679a) verwirft sie beim nächsten Schreiben, rechnet dann wieder mit EINER Quote und kdc-Bausteinen in den MAKE-Zahlen — kein Absturz, keine Datenverluste an Plänen.

### Offen / für Kevin
- „Frei verfügbar gesamt“ mit dem Konto der Selbstständigkeit (siehe oben) bestätigen.
- Entnahme-Regel je Szenario festlegen (ohne Regel bleibt das Geld in der Selbstständigkeit und Privat sieht nichts davon).
- Hebesatz je Gemeinde eintragen (bis dahin aus `steuerUG` abgeleitet, ~405 % bei 30 % Gesamtsatz); Rechtsform der Selbstständigkeit prüfen (Freiberuf = Gewerbesteuer-Zeile ausschalten).
- Mindestbesteuerung beim Verlustvortrag, Progressionseffekt der Gehälter auf die Einkommensteuer — bewusst nicht abgebildet.

## Produkte → Deals → Mandate → Planung (Kevin: „clean von vorne bis hinten“)
- **Produkt** (`Leistung`, Katalog im CRM, Seite `/os/mandate?s=produkte`) trägt, was die Planung braucht: `preis.betrag`, `preis.basis`
  (monat · jahr · einmalig — neu, additiv in `lib/crm/typen.ts`; fehlt sie, leitet `preisBasisVon()` sie aus der Freitext-Einheit ab, „festklicken“ speichert
  sie), `laufzeitMonate` (neu), `aufwand { anteil, stunden }` (neu, Marge), `gesellschaft` (→ Plan-Einheit: kdv → KD Ventures, sonst MAKE), `status`.
  `planungFehlt(l)` nennt, was fehlt — auf der Produktseite als „für die Planung fehlt: …“, im Kopf als Zähler, im Baukasten als gelber Chip.
- **Deal** (`Chance`, `leistungId`, `wert {betrag, basis, laufzeitMonate}`) → **Mandat** (`leistungId`, `honorar {betrag, basis}`, `start/ende`,
  `mindestlaufzeitMonate`, `gesellschaft`): aktive Mandate und gewonnene Deals ohne Mandat sind die **Ist-Basis** (`istBasisVorschlaege()`), per Klick ein
  Umsatzbaustein mit Kunde, Produkt, Betrag, Rhythmus, Start (Mandatsbeginn bzw. jetzt) und Laufzeit.
- **Planung**: Umsatzbaustein = Produkt (aus dem Katalog, `bausteinAusProdukt()`: Preis, Rhythmus aus der Basis, Laufzeit, Einheit vorbelegt) × Menge ×
  Preis (überschreibbar) × Start × Laufzeit. Freie Bausteine bleiben möglich („ohne Produkt“). Produkt im Baustein wechseln übernimmt Preis/Rhythmus/
  Laufzeit des neuen Produkts.
- **Zurück**: Produktseite zeigt „In Szenarien: ★ Arbeitsplan (2×) · …“ (`produktInSzenarien()`) und verlinkt „In der Finanzplanung verwenden ›“; der
  Baukasten verlinkt „Produktseite ›“ (kein zweiter Editor). Alles über `GET /api/finanzplan/vorschlaege` (nur lesen, Haushalt-Zugang; ohne CRM leere Listen).
- **Kein Schreibzugriff ins CRM.** Offen: `lib/crm/speicher.ts::leistung()` reicht `preis.basis`, `laufzeitMonate`, `aufwand` noch nicht durch
  (Datei war für dieses Paket gesperrt) — bis dahin verliert die Produktseite diese drei Felder beim Speichern.

## Technik
- **Rechenkern:** `lib/finanzen/rechenkern.ts` — Kevins v3, übernommen (nur Typ `fokus.entscheidung` ergänzt, zwei Non-Null-Behauptungen
  im Zahlungskalender aufgelöst); am 02.10. auf Kevins Wort umgebaut (Abschnitt „Kern-Umbau 02.10.“, Steuern einzeln, Selbstständigkeit-Achse, Einkommensteuer, zwei Felder gelöscht). EINE Wahrheit für Seite, Routen und ZOE. Lokal gegen die echte Datei geprüft: Repo-Rechenkern = Mock-up-Rechenkern
  in allen fünf Szenarien (11.122 Vergleiche, 0 Abweichungen, keine nicht endlichen Werte).
- **Operationen:** `lib/finanzen/plan/operationen.ts` (rein, getestet) — Pfade `/plan/<zeile>:<monat>`, Listen über `id=<kennung>` oder Index, `/-` hängt an,
  fehlendes `neu` entfernt; gesperrt: version, stand, monate, historie, meta, protokoll. `/regeln/<empfänger>` merkt die Regel und ordnet rückwirkend zu
  (`lerneRegel`). Protokoll (wer/wann/feld/alt/neu, 500 Einträge), Zellen-Meta (wer/wann je Planzelle), neuer Stand = Zeitstempel, immer größer als der alte.
  `pruefeDokument` (strikt: version 3, szenarien, annahmen, Zeitachse Jan–Sep 26 + ≥ 15 Planmonate) und `leeresDokument`.
- **Speicher:** `lib/finanzen/plan/speicher.ts` — Bestand `finanzen-plan--<haushalt>` (Kevin + Malin = ein Haushalt), Prüfung und Schreiben in EINER
  `updateJson`-Sperre, 409 mit aktuellem Dokument bei fremdem Stand, Import ersetzt nur mit ausdrücklichem `ersetzen`.
- **Routen:** `GET /api/finanzplan` (ETag aus dem Dateistand, gepackt; `dokument: null` ohne Startbestand) · `GET ?nur=kennzahlen` (verdichtet, für ZOE/
  Startfläche) · `PATCH { basisStand, ops }` · `POST /api/finanzplan/import` (multipart `datei` oder JSON `{ leer: true }` / `{ dokument }`, `ersetzen`).
  Zugang überall nur `haushaltVon(req)`.
- **Oberfläche:** `/os/finanzplan` (`app/os/finanzplan/page.tsx`, force-dynamic), `components/os/finanzplan/`: `Finanzplan.tsx` (Rahmen), `daten.ts`
  (Laden mit ETag, Abgleich 30 s, optimistisches Anwenden, Rückgängig-Stapel aus Gegenoperationen, Meldungen), `teile.tsx`, `diagramme.tsx` (SVG),
  `Blatt.tsx` (Excel-Gefühl), `ZeileDialog.tsx`, `Ueberblick.tsx`, `Planen.tsx`, `Monat.tsx`, `Verpflichtungen.tsx`, `Auswerten.tsx`, `Einrichtung.tsx`.
  Adresse: `?u=<unterseite>` (+ `monat`, `zeile` für Sprünge in die Buchungen).
- **Navigation:** Eintrag „Finanzplanung jetzt“ in `EIGEN` (`lib/make-one/spaces.ts`) direkt unter Agenten; eingeklappt nur das Symbol (Calculator).
- **Tests:** `tests/finanzplan-rechenkern.test.ts` (Rechenkern mit erfundenen Zahlen, von Hand nachgerechnet), `tests/finanzplan-operationen.test.ts`
  (Pfade, Operationen, Stand, Prüfung, Helfer), `tests/finanzplan-routen.test.ts` (Routen mit eigenem Datenordner: 403, Import, 409, ETag/304, Regel,
  Kennzahlen, Baukasten per PATCH, Vorschläge), `tests/finanzplan-szenarien.test.ts` (Bausteine → Reihen → Kern von Hand, Auswertung, Entscheidungen,
  Vergleich, Produkte als Quelle, Migration ohne `planszenarien`, Operationen auf `planszenarien`/`arbeitsplan`). 81 Tests grün. Dazu ein lokales Prüfskript, das alle 17 Unterseiten serverseitig rendert (20 Prüfungen grün) —
  nicht im Repo, weil vitest hier kein JSX übersetzt (siehe Offenes).

## Bedienung (Konzept § 4)
- Zelle anklicken oder Ziffer tippen · Enter übernimmt · Tab übernimmt und geht nach rechts · Pfeile bewegen die Auswahl · Entf/Backspace setzt zurück ·
  Escape bricht ab · Rechtsklick oder langer Druck: Wert ab hier / 12 Monate fortschreiben, zurücksetzen, ab hier alle zurücksetzen, Notiz.
- Überschriebene Planzellen tragen links den Strich der Person (Farben aus dem CRM-Team: Kevin türkis, Malin lila), Tooltip mit Datum; Notiz = kleiner Punkt.
- Rückgängig: Knopf oben rechts oder Cmd+Z (außerhalb von Feldern). Nach jedem Speichern eine Meldung mit „Rückgängig“; Fehler bleiben rot stehen.
- Verbergen: verwischt alle Beträge (Kacheln, Blatt, Diagramme, Felder ohne Fokus) — gemerkt je Browser.
- Wer plant, kommt aus dem Konto — kein Umschalter.

## Stufen und Stand
1. Rechenkern + Tests — **fertig** (a26d859)
2. Speicher + Routen + Import — **fertig** (4c4d511)
3. Seite, Navigation, Rahmen — **fertig** (9bc0dd9 Grundlage, 06080a0 Rahmen)
4. Überblick — **fertig** (74a75a9)
5. Planen — **fertig** (c5daadd)
6. Verpflichtungen — **fertig** (77d172d)
7. Monat — **fertig** (b9b081b)
8. Auswerten — **fertig** (87da885)
9. Doku — **fertig** (82e43c2)
10. Szenario-Baukasten, Lage, Gesamt, Produkte als Quelle, neue Navigation — **fertig** (27.09. abends, dieser Stand)

Alles nur lokal auf `entwicklung`; nichts gepusht. Sichtprüfung im Dev-Server steht aus (Browser war belegt).

## Abweichungen vom Konzept
- **Speichern:** Konzept § 6.3 nennt `POST /api/state/finanzen-plan/op` mit `basisVersion`; gebaut ist `PATCH /api/finanzplan` mit `basisStand` und
  einer Liste von Operationen (Vorgabe des Einbau-Auftrags). Dafür ist `stand` jetzt ein Zeitstempel statt nur ein Datum — die Seite zeigt den Tag.
- **Wer plant:** kein Umschalter oben rechts (Mock-up), sondern das angemeldete Konto; Personen heißen im Dokument `kevin`/`malin` (Speichernamen).
  Alte Einträge mit „Kevin“/„Malin“/„Beide“ werden beim Anzeigen abgebildet.
- **Regel „merken“:** läuft serverseitig als Operation auf `/regeln/<empfänger>` (rückwirkend über `lerneRegel`) und ist bewusst nicht rückgängig-fähig —
  der Browser lädt danach neu. Ohne „merken“ ändert sich nur die eine Buchung.
- **Dialoge:** keine Browser-`prompt`/`confirm` (können abgeschaltet sein) — eigener Notiz-Dialog, Löschen als zweiter Klick „Wirklich …“.
- **Export/Zurücksetzen:** die Knöpfe des Mock-ups fehlen bewusst. Import läuft über die Einrichtungskarte bzw. die Route (ersetzen nur ausdrücklich).
  Ein JSON-Export ist eine kleine Route — auf Kevins Wort.
- **Sondertilgung** ist eine Probe (nicht gespeichert), wie im Mock-up.
- **Stichtag:** `einstellungen.heute` steuert die Rechnung (wie im Rechenkern). Weicht er vom echten Tag ab, bietet der Überblick „auf heute setzen“ an.
- **Konzept § 6.5/6.6** (sechs Finanzseiten ablösen, Cockpit/Supabase-Anbindung) sind nicht Teil dieser Stufe — Kevins Ansage: erst ein eigener Bereich.
- **Außerhalb der Dateiliste:** `tests/spaces.test.ts` bekam eine Zeile (der neue EIGEN-Eintrag), sonst wäre die Prüfkette rot.
- **Nicht angeschlossen** (Dateien nicht freigegeben): Schnellsuche (`SEITEN` in `components/os/Schnellsuche.tsx`) und `lib/wege.ts` — je ein Eintrag,
  wenn Kevin es will.

## Offen für Kevin und Malin
0. **Sanitizer im CRM** (`lib/crm/speicher.ts::leistung()`): `preis.basis`, `laufzeitMonate`, `aufwand` durchreichen — sonst gehen sie beim Speichern
   auf der Produktseite verloren. Dann auf der Produktseite je Produkt Basis, Laufzeit und Gesellschaft festziehen („für die Planung fehlt“ leer bekommen).
0a. Erstes Szenario bauen: Planen › Szenarien bauen → „Aus Mandaten und gewonnenen Deals anlegen“ oder leer → Bausteine → ★ Arbeitsplan.
0b. Entschieden (Kevin 27.09.): Ausschüttung mit pauschaler Steuerquote je Szenario (Vorgabe 26,4 %); Selbstständigkeit 2026 bleibt Abschlusszahl; „frei verfügbar“ bleibt wie definiert.
1. Startbestand auf dem Server hochladen (Einrichtungskarte oder `POST /api/finanzplan/import`) — lokal liegt die Datei zur Prüfung unter `.data/`.
2. Sichtprüfung im Dev-Server: Blatt am Handy (720 px), Kontextmenü per Langdruck, Verbergen, Rückgängig.
3. Kontostände aller Konten eintragen (Verpflichtungen › Zu erledigen › Kontostände).
4. Offene Familienposten klären; Jahreskosten-Topf füllen (welche Jahreszahlungen, welcher Monat); ein Konto oder drei.
5. Finanz-Cockpit abschalten oder als Import-Werkzeug behalten; danach die Buchungen aus dem Haushalts-Import hier hinein (ein IST).
6. ZOE/Startfläche an `?nur=kennzahlen` anschließen; Export-Route; Schnellsuche und `lib/wege.ts` ergänzen.
7. vitest: `esbuild: { jsx: 'automatic' }` in `vitest.config.ts`, damit der Ansichten-Test ins Repo kann.
8. Danach: Privat-Teile unter Privat › Finanzen, MAKE/KD Ventures unter Business.
