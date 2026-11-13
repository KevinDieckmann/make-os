// Quelle der Vertriebs-Tabellen (30.10.): erzeugt inhalt/vorlagen/vertriebskennzahlen-je-phase.tabelle.json und vertriebs-pipeline.tabelle.json.
// Ändern → node prototype/fokus-innovation/inhalt/vorlagen/vertrieb-tabellen.mjs prototype/fokus-innovation/inhalt/vorlagen → node prototype/fokus-innovation/vorlagen.mjs <id>
// Erzeugt die Tabellen-Beschreibungen (vorlagen.mjs-Format) für die Vertriebs-Vorlagen.
// Aufruf: node tabellen.mjs <zielordner>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ziel = process.argv[2];
if (!ziel) throw new Error('Zielordner fehlt');

const f = (formel, stil) => ({ f: formel, stil });
const t = (text, stil = 'text') => ({ v: text, stil });
const leer = (stil) => ({ v: null, stil });
// Excel-Seriennummer eines Kalendertags (Tage seit 1899-12-30, UTC)
const tag = (iso) => Math.round((Date.UTC(...iso.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x)))) - Date.UTC(1899, 11, 30)) / 86400000);

// ─────────────────────────────────────────────── Vertriebskennzahlen je Phase ───────────────────────────────────────────────
const W1 = 6, WN = 57; // Wochenzeilen 6 bis 57 = 52 Wochen
const kopfZeilen = (spaltenAnzahl, ziel, schnitt, summe) => [
  [t('Name', 'fett'), leer('eingabe'), ...Array(spaltenAnzahl - 2).fill(null)],
  ziel, schnitt, summe,
];
const wocheErste = (rest) => [t('Woche 1', 'fett'), leer('eingabe-datum'), ...rest];
const wocheWeitere = (rest) => [f(`"Woche "&(ROW()-${W1 - 1})`, 'text'), f('IF(OFFSET(B{r},-1,0)="","",OFFSET(B{r},-1,0)+7)', 'datum'), ...rest];
const summe = (sp) => f(`SUM(${sp}${W1}:${sp}${WN})`, 'fett');
const schnitt = (sp, stil = 'zahl') => (stil === 'zahl' ? f(`IFERROR(ROUND(AVERAGE(${sp}${W1}:${sp}${WN}),1),"")`, 'standard') : f(`IFERROR(AVERAGE(${sp}${W1}:${sp}${WN}),"")`, stil));
const quoteW = (zaehler, nenner) => f(`IF(OR(${nenner}{r}="",${zaehler}{r}=""),"",IFERROR(${zaehler}{r}/${nenner}{r},""))`, 'prozent');
const laufendAbschluss = (g, v) => f(`IF(AND(${g}{r}="",${v}{r}=""),"",IFERROR(SUM(${g}$${W1}:${g}{r})/(SUM(${g}$${W1}:${g}{r})+SUM(${v}$${W1}:${v}{r})),""))`, 'prozent');
const monatSpalte = (blatt) => f(`IF(${blatt}!$B$${W1}="","",DATE(YEAR(${blatt}!$B$${W1}),MONTH(${blatt}!$B$${W1})+ROW()-3,1))`, 'datum');
const monatSumme = (blatt, sp, stil = 'zahl') => f(`IF($A{r}="","",SUMIFS(${blatt}!${sp}$${W1}:${sp}$${WN},${blatt}!$B$${W1}:$B$${WN},">="&$A{r},${blatt}!$B$${W1}:$B$${WN},"<"&EDATE($A{r},1)))`, stil);

const anleitungKz = {
  name: 'Anleitung',
  spalten: [{ breite: 34 }, { breite: 78 }, { breite: 16 }],
  zeilen: [
    [t('Vertriebskennzahlen je Phase', 'titel')],
    [t('MAKE Innovation · makeinnovation.de · Vorlage zum freien Gebrauch', 'hinweis')],
    [],
    [t('So nutzen Sie die Tabelle', 'kopf'), t('', 'kopf'), t('', 'kopf')],
    [t('1. Phase wählen', 'fett'), t('Start: Der Gründer verkauft selbst. Aufbau: Erste Vertriebler verkaufen mit. Wachstum: Ein Team mit mehreren Rollen und einer Vertriebsleitung. Bei Zweifel gilt die frühere Phase.')],
    [t('2. Erste Woche eintragen', 'fett'), t('Tragen Sie auf dem Blatt Ihrer Phase in der Zeile „Woche 1“ den Montag der ersten Woche ein. Alle weiteren Wochen rechnet die Tabelle selbst.')],
    [t('3. Jeden Freitag eintragen', 'fett'), t('Lila Felder sind Eingaben. Alle anderen Felder rechnen selbst und bleiben leer, solange etwas fehlt.')],
    [t('4. Oben ablesen', 'fett'), t('Über den Wochen stehen Ihr Ziel, der Durchschnitt je Woche und die Summe. Die Quoten in der Summenzeile gelten für alle eingetragenen Wochen. In den Wochenzeilen zeigt die Abschlussquote den laufenden Stand seit Woche 1.')],
    [t('5. Monatsblätter', 'fett'), t('„Start Monate“ und „Aufbau Monate“ fassen die Wochen nach Monat zusammen. Eine Woche zählt zu dem Monat, in dem ihr Montag liegt. Dort tragen Sie nichts ein.')],
    [t('6. Je Person (Aufbau)', 'fett'), t('Führen Sie im Aufbau ein Blatt je Person: Blatt „Aufbau“ duplizieren und umbenennen. Das Monatsblatt fasst nur das Blatt „Aufbau“ zusammen.')],
    [t('7. Ziele setzen', 'fett'), t('Tragen Sie Ziele erst nach vier bis acht Wochen Messung in die Zeile „Ihr Ziel je Woche“ ein, aus Ihren eigenen Werten.')],
    [],
    [t('Die Kennzahlen', 'kopf'), t('Formel', 'kopf'), t('Phase', 'kopf')],
    [t('Vertriebsstunden', 'fett'), t('Stunden je Woche, die nur dem Vertrieb gehören'), t('Start')],
    [t('Erstgespräche', 'fett'), t('Gespräche mit neuen möglichen Kunden über einen konkreten Bedarf'), t('Start')],
    [t('Angebote', 'fett'), t('schriftliche Angebote mit Preis und Datum'), t('alle')],
    [t('Abschlussquote', 'fett'), t('gewonnene ÷ entschiedene Angebote (gewonnen + verloren)'), t('alle')],
    [t('Offene Chancen mit Wert', 'fett'), t('Summe der Werte offener Chancen mit vereinbartem nächstem Schritt'), t('Start')],
    [t('Erreichquote', 'fett'), t('erreichte Gespräche ÷ Ansprachen'), t('Aufbau')],
    [t('Terminquote', 'fett'), t('vereinbarte Termine ÷ erreichte Gespräche'), t('Aufbau')],
    [t('Erscheinquote', 'fett'), t('stattgefundene Termine ÷ vereinbarte Termine'), t('Aufbau')],
    [t('Angebotsquote', 'fett'), t('Angebote ÷ stattgefundene Termine'), t('Aufbau, Wachstum')],
    [t('Aufträge ohne Gründer', 'fett'), t('Aufträge ohne Beteiligung des Gründers ÷ alle Aufträge'), t('Aufbau')],
    [t('Abdeckung der Pipeline', 'fett'), t('gewichteter Wert offener Chancen ÷ noch offenes Umsatzziel im selben Zeitraum'), t('Wachstum')],
    [t('Prognosegenauigkeit', 'fett'), t('tatsächlicher Umsatz ÷ Prognose vom Monatsanfang'), t('Wachstum')],
    [t('Kosten je Neukunde', 'fett'), t('Vertriebskosten im Zeitraum ÷ neue Kunden im Zeitraum'), t('Wachstum')],
    [t('Umsatz mit Bestandskunden', 'fett'), t('Umsatz aus Verlängerungen und Zusatzaufträgen ÷ gesamter Umsatz'), t('Wachstum')],
    [t('Zeit bis zur vollen Leistung', 'fett'), t('Tage vom ersten Arbeitstag, bis eine neue Person vier Wochen in Folge ihre Ziele erreicht (Blatt „Team“)'), t('Wachstum')],
    [t('Abgänge im Vertrieb', 'fett'), t('Abgänge in zwölf Monaten ÷ durchschnittliche Zahl der Vertriebsleute'), t('Wachstum')],
    [],
    [t('Richtwerte', 'kopf'), t('', 'kopf'), t('', 'kopf')],
    [t('Bewusst keine', 'fett'), t('Quoten hängen von Branche, Preis, Kanal und Kontaktliste ab. Setzen Sie Ziele aus Ihren eigenen Werten. Zeit bis zum Abschluss und Herkunft der Aufträge rechnet die Vorlage „Vertriebs-Pipeline“.')],
    [t('Mehr dazu', 'fett'), t('Ratgeber: makeinnovation.de/wissen/vertriebskennzahlen-je-phase/ · Check: makeinnovation.de/check?thema=sichtbarkeit-vertrieb')],
  ],
};

// Start: A Woche · B Woche ab · C Stunden · D Erstgespräche · E Angebote · F gewonnen · G verloren · H Wert gewonnen · I offene Chancen (Stand) · J ohne Nachfass-Datum (Stand) · K Angebote je Erstgespräch · L Abschlussquote · M Notiz
const startEingaben = [leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-euro'), leer('eingabe-euro'), leer('eingabe-zahl')];
const startFormeln = [quoteW('E', 'D'), laufendAbschluss('F', 'G'), leer('eingabe')];
const start = {
  name: 'Start',
  fixieren: true,
  spalten: [
    { titel: 'Woche', breite: 15 }, { titel: 'Woche ab (Montag)', breite: 14, stil: 'datum' },
    { titel: 'Vertriebs­stunden', breite: 12 }, { titel: 'Erst­gespräche', breite: 12 }, { titel: 'Angebote verschickt', breite: 12 },
    { titel: 'Angebote gewonnen', breite: 12 }, { titel: 'Angebote verloren', breite: 12 }, { titel: 'Wert gewonnen (€)', breite: 14 },
    { titel: 'Offene Chancen, Wert (€, Stand Freitag)', breite: 16 }, { titel: 'Angebote ohne Nachfass-Datum (Stand Freitag)', breite: 16 },
    { titel: 'Angebote je Erst­gespräch', breite: 12 }, { titel: 'Abschluss­quote (laufend)', breite: 13 }, { titel: 'Notiz', breite: 34 },
  ],
  zeilen: [
    ...kopfZeilen(13,
      [t('Ihr Ziel je Woche', 'fett'), null, ...startEingaben, leer('eingabe-prozent'), leer('eingabe-prozent'), null],
      [t('Durchschnitt je Woche', 'fett'), null, ...'CDEFGHIJ'.split('').map((sp) => schnitt(sp, 'HI'.includes(sp) ? 'euro' : 'zahl')), null, null, null],
      [t('Summe', 'fett'), null, ...'CDEFGH'.split('').map(summe), null, null, f('IFERROR(E5/D5,"")', 'prozent'), f('IFERROR(F5/(F5+G5),"")', 'prozent'), null],
    ),
    wocheErste([...startEingaben, ...startFormeln]),
  ],
  wiederholen: { zeile: wocheWeitere([...startEingaben, ...startFormeln]), anzahl: WN - W1 },
};
start.zeilen[3][7] = f(`SUM(H${W1}:H${WN})`, 'euro');

const startMonate = {
  name: 'Start Monate',
  fixieren: true,
  spalten: [
    { titel: 'Monat (ab)', breite: 13 }, { titel: 'Vertriebs­stunden', breite: 12 }, { titel: 'Erst­gespräche', breite: 12 }, { titel: 'Angebote verschickt', breite: 12 },
    { titel: 'Angebote gewonnen', breite: 12 }, { titel: 'Angebote verloren', breite: 12 }, { titel: 'Wert gewonnen (€)', breite: 14 },
    { titel: 'Angebote je Erst­gespräch', breite: 12 }, { titel: 'Abschluss­quote', breite: 12 },
  ],
  zeilen: [[t('Summe', 'fett'), f('SUM(B3:B14)', 'fett'), f('SUM(C3:C14)', 'fett'), f('SUM(D3:D14)', 'fett'), f('SUM(E3:E14)', 'fett'), f('SUM(F3:F14)', 'fett'), f('SUM(G3:G14)', 'euro'), f('IFERROR(D2/C2,"")', 'prozent'), f('IFERROR(E2/(E2+F2),"")', 'prozent')]],
  wiederholen: {
    zeile: [monatSpalte('Start'), monatSumme('Start', 'C'), monatSumme('Start', 'D'), monatSumme('Start', 'E'), monatSumme('Start', 'F'), monatSumme('Start', 'G'), monatSumme('Start', 'H', 'euro'),
      f('IF($A{r}="","",IFERROR(D{r}/C{r},""))', 'prozent'), f('IF($A{r}="","",IFERROR(E{r}/(E{r}+F{r}),""))', 'prozent')],
    anzahl: 12,
  },
};

// Aufbau: A Woche · B ab · C Ansprachen · D erreicht · E Termine vereinbart · F stattgefunden · G Angebote · H gewonnen · I verloren · J ohne Gründer · K–P Quoten · Q Notiz
const aufbauEingaben = Array(8).fill(0).map(() => leer('eingabe-zahl'));
const aufbauFormeln = [quoteW('D', 'C'), quoteW('E', 'D'), quoteW('F', 'E'), quoteW('G', 'F'), laufendAbschluss('H', 'I'),
  f(`IF(AND(H{r}="",J{r}=""),"",IFERROR(SUM(J$${W1}:J{r})/SUM(H$${W1}:H{r}),""))`, 'prozent'), leer('eingabe')];
const aufbau = {
  name: 'Aufbau',
  fixieren: true,
  spalten: [
    { titel: 'Woche', breite: 15 }, { titel: 'Woche ab (Montag)', breite: 14, stil: 'datum' },
    { titel: 'Ansprachen', breite: 11 }, { titel: 'erreichte Gespräche', breite: 11 }, { titel: 'Termine vereinbart', breite: 11 }, { titel: 'Termine statt­gefunden', breite: 11 },
    { titel: 'Angebote', breite: 10 }, { titel: 'Angebote gewonnen', breite: 11 }, { titel: 'Angebote verloren', breite: 11 }, { titel: 'davon ohne Gründer', breite: 11 },
    { titel: 'Erreich­quote', breite: 10 }, { titel: 'Termin­quote', breite: 10 }, { titel: 'Erschein­quote', breite: 10 }, { titel: 'Angebots­quote', breite: 10 },
    { titel: 'Abschluss­quote (laufend)', breite: 12 }, { titel: 'ohne Gründer (laufend)', breite: 12 }, { titel: 'Notiz', breite: 30 },
  ],
  zeilen: [
    ...kopfZeilen(17,
      [t('Ihr Ziel je Woche', 'fett'), null, ...aufbauEingaben, ...Array(6).fill(0).map(() => leer('eingabe-prozent')), null],
      [t('Durchschnitt je Woche', 'fett'), null, ...'CDEFGHIJ'.split('').map((sp) => schnitt(sp)), null, null, null, null, null, null, null],
      [t('Summe', 'fett'), null, ...'CDEFGHIJ'.split('').map(summe),
        f('IFERROR(D5/C5,"")', 'prozent'), f('IFERROR(E5/D5,"")', 'prozent'), f('IFERROR(F5/E5,"")', 'prozent'), f('IFERROR(G5/F5,"")', 'prozent'),
        f('IFERROR(H5/(H5+I5),"")', 'prozent'), f('IFERROR(J5/H5,"")', 'prozent'), null],
    ),
    wocheErste([...aufbauEingaben, ...aufbauFormeln]),
  ],
  wiederholen: { zeile: wocheWeitere([...aufbauEingaben, ...aufbauFormeln]), anzahl: WN - W1 },
};

const aufbauMonate = {
  name: 'Aufbau Monate',
  fixieren: true,
  spalten: [
    { titel: 'Monat (ab)', breite: 13 }, { titel: 'Ansprachen', breite: 11 }, { titel: 'erreichte Gespräche', breite: 11 }, { titel: 'Termine vereinbart', breite: 11 },
    { titel: 'Termine statt­gefunden', breite: 11 }, { titel: 'Angebote', breite: 10 }, { titel: 'Angebote gewonnen', breite: 11 }, { titel: 'Angebote verloren', breite: 11 },
    { titel: 'davon ohne Gründer', breite: 11 }, { titel: 'Erreich­quote', breite: 10 }, { titel: 'Termin­quote', breite: 10 }, { titel: 'Erschein­quote', breite: 10 },
    { titel: 'Angebots­quote', breite: 10 }, { titel: 'Abschluss­quote', breite: 11 }, { titel: 'ohne Gründer', breite: 11 },
  ],
  zeilen: [[t('Summe', 'fett'), ...'BCDEFGHI'.split('').map((sp) => f(`SUM(${sp}3:${sp}14)`, 'fett')),
    f('IFERROR(C2/B2,"")', 'prozent'), f('IFERROR(D2/C2,"")', 'prozent'), f('IFERROR(E2/D2,"")', 'prozent'), f('IFERROR(F2/E2,"")', 'prozent'),
    f('IFERROR(G2/(G2+H2),"")', 'prozent'), f('IFERROR(I2/G2,"")', 'prozent')]],
  wiederholen: {
    zeile: [monatSpalte('Aufbau'), ...'CDEFGHIJ'.split('').map((sp) => monatSumme('Aufbau', sp)),
      f('IF($A{r}="","",IFERROR(C{r}/B{r},""))', 'prozent'), f('IF($A{r}="","",IFERROR(D{r}/C{r},""))', 'prozent'), f('IF($A{r}="","",IFERROR(E{r}/D{r},""))', 'prozent'),
      f('IF($A{r}="","",IFERROR(F{r}/E{r},""))', 'prozent'), f('IF($A{r}="","",IFERROR(G{r}/(G{r}+H{r}),""))', 'prozent'), f('IF($A{r}="","",IFERROR(I{r}/G{r},""))', 'prozent')],
    anzahl: 12,
  },
};

// Wachstum: A Woche · B ab · C Termine stattgefunden · D Angebote · E gewonnen · F verloren · G Auftragswert gewonnen · H gewichtete Pipeline · I offenes Ziel · J Abdeckung · K Angebotsquote · L Abschlussquote · M Ø Auftragswert · N Notiz
const wEingaben = [leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-zahl'), leer('eingabe-euro'), leer('eingabe-euro'), leer('eingabe-euro')];
const wFormeln = [f('IF(OR(H{r}="",I{r}=""),"",IFERROR(H{r}/I{r},""))', 'prozent'), quoteW('D', 'C'), laufendAbschluss('E', 'F'),
  f(`IF(G{r}="","",IFERROR(SUM(G$${W1}:G{r})/SUM(E$${W1}:E{r}),""))`, 'euro'), leer('eingabe')];
const wachstum = {
  name: 'Wachstum',
  fixieren: true,
  spalten: [
    { titel: 'Woche', breite: 15 }, { titel: 'Woche ab (Montag)', breite: 14, stil: 'datum' },
    { titel: 'Termine statt­gefunden (Team)', breite: 12 }, { titel: 'Angebote', breite: 10 }, { titel: 'Angebote gewonnen', breite: 11 }, { titel: 'Angebote verloren', breite: 11 },
    { titel: 'Auftragswert gewonnen (€)', breite: 14 }, { titel: 'Gewichtete Pipeline (€, Stand Freitag)', breite: 15 }, { titel: 'Offenes Ziel bis Quartalsende (€)', breite: 15 },
    { titel: 'Abdeckung (Pipeline ÷ Ziel)', breite: 13 }, { titel: 'Angebots­quote', breite: 10 }, { titel: 'Abschluss­quote (laufend)', breite: 12 },
    { titel: 'Ø Auftragswert (laufend, €)', breite: 13 }, { titel: 'Notiz', breite: 30 },
  ],
  zeilen: [
    ...kopfZeilen(14,
      [t('Ihr Ziel je Woche', 'fett'), null, ...wEingaben, leer('eingabe-prozent'), leer('eingabe-prozent'), leer('eingabe-prozent'), leer('eingabe-euro'), null],
      [t('Durchschnitt je Woche', 'fett'), null, ...'CDEFGHI'.split('').map((sp) => schnitt(sp, 'GHI'.includes(sp) ? 'euro' : 'zahl')), null, null, null, null, null],
      [t('Summe', 'fett'), null, ...'CDEF'.split('').map(summe), f(`SUM(G${W1}:G${WN})`, 'euro'), null, null, null,
        f('IFERROR(D5/C5,"")', 'prozent'), f('IFERROR(E5/(E5+F5),"")', 'prozent'), f('IFERROR(G5/E5,"")', 'euro'), null],
    ),
    wocheErste([...wEingaben, ...wFormeln]),
  ],
  wiederholen: { zeile: wocheWeitere([...wEingaben, ...wFormeln]), anzahl: WN - W1 },
};

// Wachstum Monate: A Monat · B Prognose · C Umsatz · D Genauigkeit · E Neukunden · F Vertriebskosten · G Kosten je Neukunde · H Umsatz Bestand · I Anteil Bestand · J Vertriebsleute · K Abgänge · L Auftragswert gewonnen (aus Woche) · M Notiz
const wmZeile = (erste) => [
  erste ? leer('eingabe-datum') : f('IF(OFFSET(A{r},-1,0)="","",EDATE(OFFSET(A{r},-1,0),1))', 'datum'),
  leer('eingabe-euro'), leer('eingabe-euro'), f('IF(OR(B{r}="",C{r}=""),"",IFERROR(C{r}/B{r},""))', 'prozent'),
  leer('eingabe-zahl'), leer('eingabe-euro'), f('IF(OR(E{r}="",F{r}=""),"",IFERROR(F{r}/E{r},""))', 'euro'),
  leer('eingabe-euro'), f('IF(OR(C{r}="",H{r}=""),"",IFERROR(H{r}/C{r},""))', 'prozent'),
  leer('eingabe-zahl'), leer('eingabe-zahl'),
  f(`IF($A{r}="","",SUMIFS(Wachstum!G$${W1}:G$${WN},Wachstum!$B$${W1}:$B$${WN},">="&$A{r},Wachstum!$B$${W1}:$B$${WN},"<"&EDATE($A{r},1)))`, 'euro'),
  leer('eingabe'),
];
const wachstumMonate = {
  name: 'Wachstum Monate',
  fixieren: true,
  spalten: [
    { titel: 'Monat (ab)', breite: 13 }, { titel: 'Prognose am 1. Werktag (€)', breite: 14 }, { titel: 'Umsatz Ist (€)', breite: 14 }, { titel: 'Prognose­genauigkeit', breite: 12 },
    { titel: 'Neukunden', breite: 10 }, { titel: 'Vertriebs­kosten (€)', breite: 14 }, { titel: 'Kosten je Neukunde (€)', breite: 13 }, { titel: 'Umsatz Bestands­kunden (€)', breite: 14 },
    { titel: 'Anteil Bestand', breite: 11 }, { titel: 'Vertriebsleute am Monatsende', breite: 13 }, { titel: 'Abgänge im Monat', breite: 11 },
    { titel: 'Auftragswert gewonnen (€, aus Wochenblatt)', breite: 16 }, { titel: 'Notiz', breite: 28 },
  ],
  zeilen: [
    [t('Summe Jahr', 'fett'), f('SUM(B3:B14)', 'euro'), f('SUM(C3:C14)', 'euro'), f('IFERROR(C2/B2,"")', 'prozent'), f('SUM(E3:E14)', 'fett'), f('SUM(F3:F14)', 'euro'),
      f('IFERROR(F2/E2,"")', 'euro'), f('SUM(H3:H14)', 'euro'), f('IFERROR(H2/C2,"")', 'prozent'), f('IFERROR(AVERAGE(J3:J14),"")', 'zahl'), f('SUM(K3:K14)', 'fett'),
      f('SUM(L3:L14)', 'euro'), f('IF(COUNT(J3:J14)=0,"","Abgänge ÷ Ø Vertriebsleute: "&TEXT(IFERROR(K2/J2,0)*100,"0")&" %")', 'hinweis')],
    wmZeile(true),
  ],
  wiederholen: { zeile: wmZeile(false), anzahl: 11 },
};

const team = {
  name: 'Team',
  fixieren: true,
  spalten: [
    { titel: 'Person', breite: 22 }, { titel: 'Rolle', breite: 20 }, { titel: 'Erster Arbeitstag', breite: 14, stil: 'datum' },
    { titel: 'Volle Leistung ab (4 Wochen in Folge Ziele erreicht)', breite: 18, stil: 'datum' }, { titel: 'Tage bis zur vollen Leistung', breite: 13 },
    { titel: 'Abgang am', breite: 13, stil: 'datum' }, { titel: 'Notiz', breite: 34 },
  ],
  zeilen: [[t('Durchschnitt', 'fett'), null, null, null, f('IFERROR(AVERAGE(E3:E42),"")', 'fett'), f('IF(COUNT(F3:F42)=0,"",COUNT(F3:F42)&" Abgänge")', 'hinweis'), null]],
  wiederholen: { zeile: [leer('eingabe'), leer('eingabe'), leer('eingabe-datum'), leer('eingabe-datum'), f('IF(OR(C{r}="",D{r}=""),"",D{r}-C{r})', 'zahl'), leer('eingabe-datum'), leer('eingabe')], anzahl: 40 },
};

writeFileSync(join(ziel, 'vertriebskennzahlen-je-phase.tabelle.json'), JSON.stringify({ blaetter: [anleitungKz, start, startMonate, aufbau, aufbauMonate, wachstum, wachstumMonate, team] }, null, 1).replace(/\u00ad/g, '') + '\n');

// ─────────────────────────────────────────────── Vertriebs-Pipeline ───────────────────────────────────────────────
const STUFEN = ['1 Erstkontakt', '2 Gespräch', '3 Angebot', '4 Verhandlung', 'Gewonnen', 'Verloren'];
const QUELLEN = ['Empfehlung', 'Netzwerk', 'Website', 'Ansprache', 'Bestandskunde', 'Veranstaltung', 'Sonstige'];
const P = { von: 2, bis: 101 };
const rng = (sp) => `Pipeline!$${sp}$${P.von}:$${sp}$${P.bis}`;
const pipelineFormeln = (blatt = 'Pipeline') => ({
  nr: f('IF(B{r}="","",ROW()-1)', 'zahl'),
  wahrsch: f('IF(H{r}="","",IFERROR(VLOOKUP(H{r},Stufen!$A$2:$B$7,2,FALSE),""))', 'prozent'),
  gewichtet: f('IF(OR(I{r}="",H{r}="",H{r}="Gewonnen",H{r}="Verloren"),"",IFERROR(I{r}*IF(K{r}="",J{r},K{r}),""))', 'euro'),
  tage: f('IF(OR(E{r}="",N{r}=""),"",N{r}-E{r})', 'zahl'),
  hinweis: f('IF(OR(H{r}="",H{r}="Gewonnen",H{r}="Verloren"),"",IF(F{r}="","Nächster Schritt fehlt",IF(G{r}="","Nachfass-Datum fehlt",IF(G{r}<TODAY(),"Nachfassen überfällig",""))))', 'hinweis'),
});
const pipelineSpalten = [
  { titel: 'Nr.', breite: 5, stil: 'zahl' }, { titel: 'Kontakt / Firma (Rolle)', breite: 28, stil: 'eingabe' }, { titel: 'Bedarf', breite: 26, stil: 'eingabe' },
  { titel: 'Quelle', breite: 14, stil: 'eingabe' }, { titel: 'Erstes Gespräch', breite: 12, stil: 'eingabe-datum' }, { titel: 'Nächster Schritt (was, wer)', breite: 30, stil: 'eingabe' },
  { titel: 'Nachfassen am', breite: 12, stil: 'eingabe-datum' }, { titel: 'Stufe', breite: 14, stil: 'eingabe' }, { titel: 'Wert (€, netto)', breite: 12, stil: 'eingabe-euro' },
  { titel: 'Wahrsch. nach Stufe', breite: 10, stil: 'prozent' }, { titel: 'Eigene Wahrsch. (optional)', breite: 11, stil: 'eingabe-prozent' }, { titel: 'Gewichteter Wert (€)', breite: 13, stil: 'euro' },
  { titel: 'Angebot verschickt am', breite: 12, stil: 'eingabe-datum' }, { titel: 'Entschieden am', breite: 12, stil: 'eingabe-datum' }, { titel: 'Tage bis Entscheidung', breite: 11, stil: 'zahl' },
  { titel: 'Hinweis', breite: 22, stil: 'hinweis' },
];
const pf = pipelineFormeln();
const leerZeile = [pf.nr, leer('eingabe'), leer('eingabe'), leer('eingabe'), leer('eingabe-datum'), leer('eingabe'), leer('eingabe-datum'), leer('eingabe'), leer('eingabe-euro'),
  pf.wahrsch, leer('eingabe-prozent'), pf.gewichtet, leer('eingabe-datum'), leer('eingabe-datum'), pf.tage, pf.hinweis];

const anleitungP = {
  name: 'Anleitung',
  spalten: [{ breite: 30 }, { breite: 84 }],
  zeilen: [
    [t('Vertriebs-Pipeline', 'titel')],
    [t('MAKE Innovation · makeinnovation.de · Vorlage zum freien Gebrauch', 'hinweis')],
    [],
    [t('So nutzen Sie die Tabelle', 'kopf'), t('', 'kopf')],
    [t('Eine Zeile je Chance', 'fett'), t('Tragen Sie im Blatt „Pipeline“ jede Chance ein: Kontakt, Bedarf, Quelle, erstes Gespräch, nächster Schritt mit Nachfass-Datum, Stufe und Wert. Lila Felder sind Eingaben, der Rest rechnet selbst.')],
    [t('Stufe wählen', 'fett'), t('Die Stufe wählen Sie aus der Liste. Die Wahrscheinlichkeit kommt aus dem Blatt „Stufen“. Weicht eine Chance deutlich ab, tragen Sie eine eigene Wahrscheinlichkeit ein.')],
    [t('Gewichteter Wert', 'fett'), t('Wert × Wahrscheinlichkeit, nur für offene Chancen. Die Summe steht im Blatt „Auswertung“.')],
    [t('Hinweis-Spalte', 'fett'), t('Zeigt, wo ein nächster Schritt oder ein Nachfass-Datum fehlt und wo das Nachfassen überfällig ist.')],
    [t('Beispiel', 'fett'), t('Das Blatt „Beispiel“ zeigt eine ausgefüllte Pipeline mit frei erfundenen Firmen. Es fließt in keine Rechnung ein.')],
    [],
    [t('Wochenroutine, 15 Minuten', 'kopf'), t('', 'kopf')],
    [t('1. Überfälliges (5 Min.)', 'fett'), t('Filtern Sie die Hinweis-Spalte: Was ist überfällig? Heute nachfassen oder einen neuen Termin festlegen.')],
    [t('2. Stufen nachziehen (5 Min.)', 'fett'), t('Was hat sich bewegt? Stufe ändern. Gewonnenes und Verlorenes mit „Entschieden am“ abschließen.')],
    [t('3. Lücken schließen (3 Min.)', 'fett'), t('Jede offene Zeile braucht einen nächsten Schritt und ein Nachfass-Datum. Chancen ohne nächsten Schritt ehrlich auf „Verloren“ setzen.')],
    [t('4. Neues eintragen (2 Min.)', 'fett'), t('Neue Chancen der Woche ergänzen.')],
    [],
    [t('Am Monatsende', 'kopf'), t('', 'kopf')],
    [t('Auswertung', 'fett'), t('Im Blatt „Auswertung“ den Monatsersten eintragen. Angebote, Gewonnen, Verloren, Abschlussquote, Zeit bis zum Abschluss und Wert rechnet die Tabelle aus den Daten der Pipeline. Offene Chancen und offenen Wert übertragen Sie am Monatsende aus „Stand heute“.')],
    [t('Mehr dazu', 'fett'), t('Ratgeber: makeinnovation.de/wissen/fuenf-vertriebszahlen/ · Kennzahlen je Phase: makeinnovation.de/wissen/vertriebskennzahlen-je-phase/')],
  ],
};

const stufen = {
  name: 'Stufen',
  spalten: [{ titel: 'Stufe', breite: 16 }, { titel: 'Wahrscheinlichkeit (Vorschlag, anpassbar)', breite: 18, stil: 'eingabe-prozent' }, { titel: 'Eine Chance steht hier, wenn …', breite: 80, stil: 'text' }],
  zeilen: [
    [t('1 Erstkontakt', 'fett'), 0.1, 'es einen ersten Kontakt gab und ein Bedarf möglich ist, aber noch nicht besprochen wurde.'],
    [t('2 Gespräch', 'fett'), 0.25, 'ein Gespräch über einen konkreten Bedarf stattgefunden hat und der nächste Schritt vereinbart ist.'],
    [t('3 Angebot', 'fett'), 0.5, 'ein schriftliches Angebot mit Preis und Datum verschickt ist.'],
    [t('4 Verhandlung', 'fett'), 0.75, 'der Kunde über Umfang, Preis oder Vertrag verhandelt und eine Entscheidung terminiert ist.'],
    [t('Gewonnen', 'fett'), 1, 'der Auftrag schriftlich erteilt ist.'],
    [t('Verloren', 'fett'), 0, 'der Kunde abgesagt hat oder es seit längerem keinen nächsten Schritt mehr gibt.'],
    [],
    [t('Hinweis', 'fett'), null, t('Die Wahrscheinlichkeiten sind ein Startwert. Passen Sie sie an, sobald Sie eigene Abschlussquoten aus einigen Monaten haben. Die Namen der Stufen nicht ändern, sonst passt die Auswahlliste nicht mehr.', 'hinweis')],
  ],
};

const pipeline = {
  name: 'Pipeline',
  fixieren: true,
  spalten: pipelineSpalten,
  wiederholen: { zeile: leerZeile, anzahl: P.bis - P.von + 1 },
  auswahl: [{ spalte: 'H', werte: STUFEN }, { spalte: 'D', werte: QUELLEN }],
};

// Beispiel (frei erfunden)
const bsp = [
  ['Beispiel GmbH (Geschäftsführung)', 'neue Website mit Anfrageformular', 'Empfehlung', '2026-09-02', 'Angebot besprechen, Termin steht', '2026-11-05', '3 Angebot', 12000, null, '2026-10-20', null],
  ['Muster AG (Vertriebsleitung)', 'Vertriebstraining für sechs Personen', 'Netzwerk', '2026-08-18', 'Vertragsentwurf schicken', '2026-11-03', '4 Verhandlung', 18000, null, '2026-09-30', null],
  ['Musterbau KG (Inhaber)', 'Erklärvideo für die Website', 'Website', '2026-10-14', 'zweites Gespräch: Umfang klären', '2026-11-10', '2 Gespräch', 6000, null, null, null],
  ['Probe & Partner (Geschäftsführung)', 'Workshop Positionierung', 'Ansprache', '2026-10-27', 'Erstgespräch vereinbaren', '2026-11-04', '1 Erstkontakt', 2000, null, null, null],
  ['Beispielwerk e. K. (Inhaberin)', 'CRM einführen', 'Empfehlung', '2026-07-08', 'Auftrag erteilt, Start planen', null, 'Gewonnen', 9500, null, '2026-08-12', '2026-09-15'],
  ['Exempel GmbH (Einkauf)', 'Website-Relaunch', 'Website', '2026-06-24', 'anderer Anbieter gewählt', null, 'Verloren', 15000, null, '2026-07-20', '2026-08-28'],
  ['Muster & Co. KG (Geschäftsführung)', 'Kampagne zur Fachmesse', 'Netzwerk', '2026-08-05', 'Auftrag erteilt, Start planen', null, 'Gewonnen', 7200, null, '2026-08-25', '2026-10-06'],
  ['Beispiel Logistik GmbH (Vertrieb)', 'Vertriebsprozess aufsetzen', 'Bestandskunde', '2026-09-21', 'nachfragen, ob Angebot passt', null, '3 Angebot', 8000, null, '2026-10-23', null],
];
const d = (iso, stil) => (iso ? { v: tag(iso), stil } : leer(stil));
const beispiel = {
  name: 'Beispiel',
  fixieren: true,
  spalten: pipelineSpalten.map((s) => ({ ...s, stil: s.stil?.startsWith('eingabe') ? s.stil.replace(/^eingabe-?/, '') || 'text' : s.stil })),
  zeilen: [
    ...bsp.map(([kontakt, bedarf, quelle, erst, schritt, nach, stufe, wert, eigen, angebot, entschieden]) => [
      pf.nr, t(kontakt), t(bedarf), t(quelle), d(erst, 'datum'), t(schritt), d(nach, 'datum'), t(stufe), { v: wert, stil: 'euro' },
      pf.wahrsch, eigen === null ? null : { v: eigen, stil: 'prozent' }, pf.gewichtet, d(angebot, 'datum'), d(entschieden, 'datum'), pf.tage, pf.hinweis,
    ]),
    [],
    [null, t('Summe offen', 'fett'), null, null, null, null, null, null, f('SUMIFS(I2:I9,H2:H9,"<>Gewonnen",H2:H9,"<>Verloren")', 'euro'), null, null, f('SUM(L2:L9)', 'euro'), null, null, null, null],
    [null, t('Alle Firmen und Zahlen sind frei erfunden. Dieses Blatt fließt in keine Rechnung ein.', 'hinweis')],
  ],
};

const A = (formel, stil) => f(formel, stil);
const monatKrit = (spDatum) => `${rng(spDatum)},">="&$A{r},${rng(spDatum)},"<"&EDATE($A{r},1)`;
const monatZeile = (erste) => [
  erste ? leer('eingabe-datum') : f('IF(OFFSET(A{r},-1,0)="","",EDATE(OFFSET(A{r},-1,0),1))', 'datum'),
  A(`IF($A{r}="","",COUNTIFS(${monatKrit('M')}))`, 'zahl'),
  A(`IF($A{r}="","",COUNTIFS(${rng('H')},"Gewonnen",${monatKrit('N')}))`, 'zahl'),
  A(`IF($A{r}="","",COUNTIFS(${rng('H')},"Verloren",${monatKrit('N')}))`, 'zahl'),
  A('IF($A{r}="","",IFERROR(C{r}/(C{r}+D{r}),""))', 'prozent'),
  A(`IF($A{r}="","",IFERROR(AVERAGEIFS(${rng('O')},${rng('H')},"Gewonnen",${monatKrit('N')}),""))`, 'zahl'),
  A(`IF($A{r}="","",SUMIFS(${rng('I')},${rng('H')},"Gewonnen",${monatKrit('N')}))`, 'euro'),
  leer('eingabe-zahl'), leer('eingabe-euro'), leer('eingabe-zahl'),
  A('IF(OR(B{r}="",J{r}=""),"",IFERROR(J{r}/B{r},""))', 'prozent'),
];
const offen = `${rng('H')},"<>",${rng('H')},"<>Gewonnen",${rng('H')},"<>Verloren"`;
const auswertung = {
  name: 'Auswertung',
  spalten: [{ breite: 36 }, { breite: 14 }, { breite: 12 }, { breite: 12 }, { breite: 12 }, { breite: 14 }, { breite: 14 }, { breite: 15 }, { breite: 16 }, { breite: 15 }, { breite: 13 }],
  zeilen: [
    [t('Auswertung', 'titel')],
    [t('Rechnet aus dem Blatt „Pipeline“. Lila Felder: hier eintragen.', 'hinweis')],
    [],
    [t('Stand heute', 'kopf'), t('Wert', 'kopf')],
    [t('Offene Chancen (Anzahl)'), A(`COUNTIFS(${offen})`, 'fett')],
    [t('Offener Wert (€)'), A(`SUMIFS(${rng('I')},${offen})`, 'euro')],
    [t('Gewichteter Wert (€)'), A(`SUM(${rng('L')})`, 'euro')],
    [t('Offene Angebote ohne Nachfass-Datum'), A(`COUNTIFS(${rng('H')},"3 Angebot",${rng('G')},"")+COUNTIFS(${rng('H')},"4 Verhandlung",${rng('G')},"")`, 'fett')],
    [t('Nachfassen überfällig'), A(`COUNTIF(${rng('P')},"Nachfassen überfällig")`, 'fett')],
    [t('Gewonnen gesamt'), A(`COUNTIF(${rng('H')},"Gewonnen")`, 'zahl')],
    [t('Verloren gesamt'), A(`COUNTIF(${rng('H')},"Verloren")`, 'zahl')],
    [t('Abschlussquote gesamt'), A('IFERROR(B10/(B10+B11),"")', 'prozent')],
    [t('Ø Tage bis zum Abschluss (gewonnen)'), A(`IFERROR(AVERAGEIFS(${rng('O')},${rng('H')},"Gewonnen"),"")`, 'zahl')],
    [],
    [t('Monat (ab, Monatserster)', 'kopf'), t('Angebote verschickt', 'kopf'), t('Gewonnen', 'kopf'), t('Verloren', 'kopf'), t('Abschluss­quote', 'kopf'), t('Ø Tage bis Abschluss', 'kopf'),
      t('Wert gewonnen (€)', 'kopf'), t('Offene Chancen am Monatsende', 'kopf'), t('Offener Wert am Monatsende (€)', 'kopf'), t('Angebote nachgefasst in 7 Tagen', 'kopf'), t('Anteil nachgefasst', 'kopf')],
    monatZeile(true),
  ],
  wiederholen: { zeile: monatZeile(false), anzahl: 11 },
};

writeFileSync(join(ziel, 'vertriebs-pipeline.tabelle.json'), JSON.stringify({ blaetter: [anleitungP, pipeline, stufen, auswertung, beispiel] }, null, 1).replace(/\u00ad/g, '') + '\n');
console.log('ok', tag('2026-09-15') - tag('2026-07-08'), tag('2026-10-06') - tag('2026-08-05'), tag('2026-08-28') - tag('2026-06-24'), tag('2026-10-30'));
