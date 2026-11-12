// MAKE Revenue · baut alle Seiten aus gemeinsamen Bausteinen.
// Aufruf:  node bauen.mjs        (schreibt die HTML-Seiten, zeichen.svg und seiten.json, danach läuft seo.mjs: Kopf, Dateien, Prüfer)
// Zeichen: ZEICHEN_WAHL weiter unten schaltet zwischen „Trichter“ und „Abschluss“ um; danach zusätzlich „node bilder.mjs“ für die Icons.
// Inhalte: Alle Fakten, Zahlen und Quellen stammen aus den Inhaltsdateien der MAKE-Innovation-Website
// (fokus.json, wissen.json, zahlen.json, produkte.json, inhalt.json) und sind hier wörtlich oder gekürzt übernommen.
// Preise stehen bewusst nicht hier: Die stehen nur bei MAKE Innovation.
// Keine Inline-Stile, keine Inline-Skripte (außer JSON-LD, das seo.mjs schreibt), keine on…-Handler.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const STAND = 'November 2026';
// Die Kontaktadresse steht in seo.json (kontakt), nicht im Code (Wächter des Repos: keine echten Adressen in Code-Dateien).
const MAIL = JSON.parse(readFileSync(join(ORDNER, 'seo.json'), 'utf8')).kontakt;
if (!MAIL) throw new Error('seo.json: kontakt (E-Mail-Adresse) fehlt');
// Ein Satz je Marke, wörtlich gleich auf allen drei Seiten (SEO-GEO-VORGABEN 3.3).
// RECHTSFORM: Bewusst ohne Rechtsform und Firmennamen (STRUKTUR-MARKEN, Nachtrag 11.11.): Welche Gesellschaft Betreiberin ist,
// entscheidet Kevin noch. Steht sie fest, hier und an den mit „RECHTSFORM“ markierten Stellen nachtragen (auch seo.mjs).
const SATZ = {
  revenue: 'MAKE Revenue ist eine Marke von MAKE Innovation aus Berlin für Vertrieb mit System, Vertrieb auf Zeit sowie Netzwerken und Events.',
  studios: 'MAKE Studios ist eine Marke von MAKE Innovation aus Berlin für Websites, Google-Profil, Video, Fotos und Social Media.',
  innovation: 'MAKE Innovation aus Berlin führt KI, bessere Abläufe und eigene Software in Unternehmen ein. Zu MAKE Innovation gehören die Marken MAKE Studios und MAKE Revenue.',
};

const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nurText = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// ─── Belegte Zahlen: Wortlaut und Quelle aus zahlen.json (am Original geprüft am 30.10.2026) ───
const ZAHL = {
  ifo: { wert: '36,3 %', anteil: 36.3, satz: 'Im Januar 2026 meldeten 36,3 % der Unternehmen in Deutschland zu wenig Aufträge. Am stärksten betroffen waren Unternehmensberater (53,8 %), die Werbebranche (51,2 %) und IT-Dienstleister (48,1 %).', quelle: 'ifo Institut, 29.01.2026', link: 'https://www.ifo.de/fakten/2026-01-29/auftragslage-der-unternehmen-entspannt-sich-nur-geringfuegig' },
  crm: { wert: '26 %', anteil: 26, satz: '2025 nutzten 26 % der kleinen Unternehmen in Deutschland (10 bis 49 Beschäftigte) eine CRM-Software, bei mittleren Unternehmen (50 bis 249) waren es 44 % und bei großen (ab 250) 61 %.', quelle: 'Eurostat, Stand 27.02.2026', link: 'https://ec.europa.eu/eurostat/databrowser/view/isoc_eb_iip/default/table?lang=de' },
  zeit: { wert: '40 %', anteil: 40, satz: 'Vertriebsmitarbeitende verbringen im Schnitt nur 40 % ihrer Arbeitszeit mit dem Verkaufen. Befragt wurden 4.050 Vertriebsprofis in 22 Ländern, darunter Deutschland.', quelle: 'Salesforce, State of Sales Report, 03.02.2026', link: 'https://www.salesforce.com/news/stories/state-of-sales-report-announcement-2026/', zusatz: 'Der Herausgeber verkauft selbst Vertriebssoftware.' },
  umsatz: { wert: '29 %', anteil: 29, satz: 'Je 29 % der kleinen und mittleren Unternehmen in Deutschland erwarten für die nächsten drei Jahre höhere bzw. niedrigere Umsätze, unterm Strich Stillstand. 2025 sanken ihre Umsätze preisbereinigt um 1,5 %, zum dritten Mal in Folge.', quelle: 'KfW Research, KfW-Mittelstandspanel 2026, 22.10.2026', link: 'https://www.kfw.de/PDF/Download-Center/Konzernthemen/Research/PDF-Dokumente-KfW-Mittelstandspanel/KfW-Mittelstandspanel-2026.pdf' },
  nachfrage: { wert: '56 %', anteil: 56, satz: 'In der DIHK-Konjunkturumfrage Frühsommer 2026 nannten 56 % der Unternehmen die Inlandsnachfrage als Geschäftsrisiko, nach 59 % in der Umfrage davor.', quelle: 'DIHK, 26.05.2026', link: 'https://www.dihk.de/de/newsroom/konjunkturumfrage-fruehsommer-2026-178080' },
  systeme: { wert: '51 %', anteil: 51, satz: '51 % der Vertriebsleitungen mit KI sagen, dass unverbundene Systeme ihre KI-Vorhaben bremsen. 74 % der Vertriebsprofis arbeiten an der Bereinigung ihrer Daten.', quelle: 'Salesforce, State of Sales Report, 03.02.2026', link: 'https://www.salesforce.com/news/stories/state-of-sales-report-announcement-2026/', zusatz: 'Der Herausgeber verkauft selbst Vertriebssoftware.' },
  startup: { wert: '72,3 %', anteil: 72.3, satz: '72,3 % der Start-ups in Deutschland nennen die Gewinnung von Referenzkunden als Ziel bei Kooperationen mit etablierten Unternehmen, 59,6 % neue Vertriebskanäle.', quelle: 'Startup-Verband, Deutscher Startup Monitor 2026, S. 43, 28.09.2026', link: 'https://startupverband.de/media/file/rs-deutscherstartupmonitor2026' },
};
const zahl = (z, klasse = '') => `<figure class="zahl ${klasse} erscheint">
        <b class="zahl-wert">${e(z.wert).replace(' %', '&nbsp;%')}</b>
        <span class="zahl-balken" aria-hidden="true"><svg viewBox="0 0 100 2" preserveAspectRatio="none" width="100%" height="100%"><rect class="zahl-balken-wert" width="${z.anteil}" height="2"/></svg></span>
        <figcaption><p class="zahl-satz">${e(z.satz).replace(/ %/g, '&nbsp;%').replace(/ €/g, '&nbsp;€')}</p>
        <cite class="zahl-quelle">Quelle: <a href="${e(z.link)}" rel="noopener">${e(z.quelle)}</a>${z.zusatz ? ' · ' + e(z.zusatz) : ''}</cite></figcaption>
      </figure>`;

// Die vier Themen: eine Quelle für Startseite, Unterseiten und strukturierte Daten (kurz = Text auf der Startseite, vorweg = Antwort im blauen Kasten der Unterseite)
const THEMEN = [
  { id: 'systemvertrieb', pfad: 'systemvertrieb/', titel: 'Digitaler Systemvertrieb', art: 'Vertriebsaufbau', klein: '',
    kurz: 'Zielgruppe, Prozess im CRM, Gesprächsleitfäden, Kennzahlen und Nachfassen. Ein Vertrieb, den Sie steuern können und der nicht an Ihnen hängt.',
    vorweg: 'Vertrieb wird planbar, wenn fünf Dinge stehen: die Zielgruppe, eine Ansprache mit Leitfäden, ein Prozess im CRM, wenige Kennzahlen mit Wochenreport und ein trainiertes Team.' },
  { id: 'zeit', pfad: 'vertrieb-auf-zeit/', titel: 'Vertrieb auf Zeit', art: 'Vertriebsleitung auf Zeit', klein: 'Auch Interim oder Fractional Head of Sales',
    kurz: 'Head of Sales oder Chief Sales Officer auf Zeit, für 6 oder 12 Monate. Wer erst testen will, startet mit dem Tagesworkshop Vertrieb.',
    vorweg: 'Ein Head of Sales auf Zeit übernimmt die Vertriebsleitung für einige Monate. Das lohnt sich, wenn der Vertrieb am Gründer hängt und eine feste Vertriebsleitung zu früh kommt.' },
  { id: 'netzwerken', pfad: 'netzwerken/', titel: 'Netzwerken und Events', art: 'Netzwerk-Events', klein: 'Für Gäste kostenlos',
    kurz: 'Abende in kleiner Runde, auf Einladung. Dazu der Weg, auf dem aus Begegnungen und Empfehlungen Kontakte werden, die nicht liegen bleiben.',
    vorweg: 'Viele gute Verbindungen entstehen erst, wenn man sich einmal gegenübersitzt. Davon soll der Standort etwas haben, nicht nur wir.' },
  { id: 'check', pfad: 'vertriebs-check/', titel: 'Vertriebs-Check', art: 'Vertriebsanalyse', klein: 'Kostenlos · rund 5 Minuten',
    kurz: 'Zwölf Fragen zu Organisation, Zahlen und Neukunden, dazu zwei in Ihren eigenen Worten. Sie sehen sofort, wo Ihr Vertrieb steht.',
    vorweg: 'Der Vertriebs-Check ist kostenlos und dauert rund 5 Minuten. Das Ergebnis sehen Sie sofort auf dem Bildschirm.' },
];
const thema = (id) => THEMEN.find((t) => t.id === id);
const leistung = (id) => { const t = thema(id); return { name: t.titel, art: t.art, kurz: t.kurz, text: t.vorweg }; };

// ─── Das Zeichen: zwei Fassungen, EIN Umschalter ───
// Kevin schwankt zwischen D „Der Trichter“ und C „Der Abschluss“. Hier umschalten, dann „node bauen.mjs“ (Seiten, zeichen.svg)
// und „node bilder.mjs“ (favicon.ico, bild/icon-180.png, icon-192.png, logo.png, og.png; braucht Google Chrome).
const ZEICHEN_WAHL = 'trichter'; // oder 'abschluss'
const ZEICHEN = {
  // D: die drei Linien aus dem Zeichen von MAKE Innovation als Vertriebstrichter, unten der gewonnene Kunde.
  // Nachgezogen: gleiche Abstände (8) auch vor dem Punkt, das Ganze um 4 nach oben in die optische Mitte (10 bis 90).
  trichter: { name: 'Der Trichter', alt: 'Der Trichter: drei Linien, die schmaler werden, darunter ein Punkt.',
    svg: '<rect x="12" y="10" width="76" height="13" rx="6.5"/><rect x="24" y="31" width="52" height="13" rx="6.5"/><rect x="36" y="52" width="28" height="13" rx="6.5"/><circle cx="50" cy="81.5" r="8.5"/>' },
  // C: zwei Ringe, die sich überschneiden. Die gemeinsame Fläche ist der Abschluss.
  abschluss: { name: 'Der Abschluss', alt: 'Der Abschluss: zwei Ringe, die sich überschneiden, die gemeinsame Fläche ist gefüllt.',
    svg: '<circle cx="37" cy="50" r="25" fill="none" stroke="currentColor" stroke-width="8"/><circle cx="63" cy="50" r="25" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 28.65A25 25 0 0 1 50 71.35A25 25 0 0 1 50 28.65Z"/>' },
};
const ZEICHNUNG = ZEICHEN[ZEICHEN_WAHL];
if (!ZEICHNUNG) throw new Error(`ZEICHEN_WAHL „${ZEICHEN_WAHL}“ gibt es nicht (trichter oder abschluss)`);
const FARBE = { nacht: '#0A1326', blau: '#17469E', hell: '#7DB7FF', papier: '#EEF1F6' }; // wie :root in revenue.css, für zeichen.svg und Kopfangaben

// ─── Echte Filme (medien/): Symbolbilder aus freien Quellen, siehe medien/LIESMICH.md ───
// Beim Bauen wird geprüft, was da ist: Film und Poster → Poster, Film erst in Sicht; nur Poster → Bild; nichts → gezeichnete Fläche.
const FILME = {
  gespraech: { b: 1280, h: 720, alt: 'Symbolbild: zwei Menschen im Gespräch an einem Tisch, vor ihnen ein Laptop.' },
  arbeit: { b: 1280, h: 674, alt: 'Symbolbild: eine Hand schreibt in ein Notizbuch, daneben steht ein Laptop.' },
  runde: { b: 1280, h: 674, alt: 'Symbolbild: eine kleine Runde sitzt abends an einem Tisch.' },
  handschlag: { b: 1280, h: 720, alt: 'Symbolbild: zwei Menschen geben sich die Hand.' },
};
function filmplatz(W, name, klasse = '', marke = 'Symbolbild') {
  const f = FILME[name];
  const hatPoster = existsSync(join(ORDNER, 'medien', `${name}-poster.webp`)), hatFilm = hatPoster && existsSync(join(ORDNER, 'medien', `${name}.mp4`));
  if (!hatPoster) return `<div class="filmplatz filmplatz-leer ${klasse}" aria-hidden="true"><div class="filmplatz-flaeche"><svg class="filmplatz-zeichnung" viewBox="0 0 100 100"><use href="#g-zeichen"/></svg></div></div>`;
  return `<figure class="filmplatz ${klasse}"${hatFilm ? ` data-filmplatz="${W}medien/${name}.mp4"` : ''}>
      <div class="filmplatz-flaeche">
        <img class="filmplatz-poster" src="${W}medien/${name}-poster.webp" width="${f.b}" height="${f.h}" alt="${e(f.alt)}" loading="lazy" decoding="async">
        <span class="filmplatz-marke">${marke}</span>${hatFilm ? `
        <button class="filmplatz-pause" type="button" aria-pressed="false" hidden><span class="filmplatz-pause-zeichen" aria-hidden="true"></span><span class="vh">Film anhalten</span></button>` : ''}
      </div>
    </figure>`;
}

// ═══════════════════════════════════ Vertrieb zum Anfassen ═══════════════════════════════════
// Drei Stücke, überall gleich gebaut: das Brett im CRM, der Wochenreport, der Gesprächsleitfaden. Alle Namen und Zahlen sind Beispiele.
// Ohne JavaScript stehen sie als ruhige Ansicht da; anfassen.js macht sie bedienbar.
const STUFEN = ['Anfrage', 'Gespräch', 'Angebot', 'Abschluss'];
// Die Regel je Stufe: Was ist die nächste Aktion, und wie viele Werktage später ist sie fällig? (dieselbe Tabelle steht in anfassen.js)
const AKTION = [['Erstgespräch vereinbaren', 1], ['Angebot senden, in 24 Stunden', 1], ['Nachfassen, drei Werktage nach dem Angebot', 3], ['Übergabe an die Umsetzung', 1]];
const BRETT = [
  { id: 'a', firma: 'Firma A', kontakt: 'Kontakt 1', woher: 'Anfrage über die Website', stufe: 0, tag: 'Di 17.03.' },
  { id: 'b', firma: 'Firma B', kontakt: 'Kontakt 2', woher: 'Empfehlung', stufe: 0, tag: 'Di 17.03.' },
  { id: 'c', firma: 'Firma C', kontakt: 'Kontakt 3', woher: 'Kontakt von der Messe', stufe: 0, tag: '' },
  { id: 'd', firma: 'Firma D', kontakt: 'Kontakt 4', woher: 'Erstgespräch geführt', stufe: 1, tag: 'Di 17.03.' },
  { id: 'e', firma: 'Firma E', kontakt: 'Kontakt 5', woher: 'Erstgespräch geführt', stufe: 1, tag: 'Mi 18.03.' },
  { id: 'f', firma: 'Firma F', kontakt: 'Kontakt 6', woher: 'Angebot ist raus', stufe: 2, tag: 'Do 19.03.' },
  { id: 'g', firma: 'Firma G', kontakt: 'Kontakt 7', woher: 'Angebot ist raus', stufe: 2, tag: 'Fr 20.03.' },
  { id: 'h', firma: 'Firma H', kontakt: 'Kontakt 8', woher: 'Auftrag erteilt', stufe: 3, tag: 'Di 17.03.' },
];
function brett() {
  const karte = (k) => `<li class="brett-karte${k.tag ? '' : ' brett-karte-offen'}" data-karte="${k.id}" data-firma="${k.firma}" data-kontakt="${k.kontakt}"${k.tag ? '' : ' data-ohne'}>
              <b class="brett-firma">${k.firma}</b><span class="brett-kontakt" data-stand>${k.kontakt} · ${k.woher}</span>
              <p class="brett-aktion"><span class="brett-aktion-wort">Nächste Aktion</span><span data-aktion>${k.tag ? AKTION[k.stufe][0] : 'Noch keine. Diese Anfrage würde liegen bleiben.'}</span><span class="brett-tag" data-tag>${k.tag ? 'bis ' + k.tag : ''}</span></p>
              <button class="brett-weiter" type="button" data-schieben>${k.tag ? (k.stufe < 3 ? 'Eine Stufe weiter' : 'Gewonnen') : 'Nächste Aktion setzen'}</button>
            </li>`;
  const offen = BRETT.filter((k) => k.stufe < 3).length, ohne = BRETT.filter((k) => !k.tag).length, gewonnen = BRETT.filter((k) => k.stufe === 3).length;
  return `<div class="brett" data-brett>
        <div class="brett-kopf">
          <p class="stueck-marke">Beispiel · Montag, 16.03.</p>
          <dl class="brett-zaehler">
            <div><dt>Offene Anfragen</dt><dd data-brett-aus="offen">${offen}</dd></div>
            <div class="brett-zaehler-ohne"><dt>Ohne nächste Aktion</dt><dd data-brett-aus="ohne">${ohne}</dd></div>
            <div><dt>Gewonnen</dt><dd data-brett-aus="gewonnen">${gewonnen}</dd></div>
          </dl>
        </div>
        <ol class="brett-spalten">
${STUFEN.map((name, i) => `          <li class="brett-spalte" data-spalte="${i}">
            <p class="brett-stufe"><span>0${i + 1}</span><b>${name}</b><i data-brett-zahl aria-label="Karten in dieser Stufe">${BRETT.filter((k) => k.stufe === i).length}</i></p>
            <ul class="brett-karten">
            ${BRETT.filter((k) => k.stufe === i).map(karte).join('\n            ')}
            </ul>
          </li>`).join('\n')}
        </ol>
        <div class="brett-fuss">
          <p class="brett-meldung" data-brett-meldung role="status">Schieben Sie eine Karte weiter. Sie bekommt sofort ihre nächste Aktion mit Datum.</p>
          <button class="knopf-zart" type="button" data-brett-zurueck hidden>Zurücksetzen</button>
        </div>
        <noscript><p class="stueck-hinweis">Zum Verschieben der Karten braucht es JavaScript.</p></noscript>
      </div>`;
}

// Der Wochenreport: Ist gegen Ziel. Die Beispielwerte stammen aus fokus.json (Wochenreport, Kalenderwoche 12).
const REPORT = [['kontakte', 'Erstkontakte', 38, 40], ['termine', 'Termine', 5, 4], ['angebote', 'Angebote', 3, 2], ['abschluesse', 'Abschlüsse', 1, 1]];
function report(W) {
  const zeile = ([id, name, ist, ziel]) => {
    const anteil = Math.round((100 * ist) / ziel), luecke = ziel - ist;
    return `<tr data-zeile="${id}" data-name="${name}"><th scope="row">${name}</th><td class="report-ist"><b data-ist>${ist}</b></td><td data-ziel>${ziel}</td>
              <td class="report-stand"><svg class="report-balken" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect class="grund" width="100" height="6" rx="3"/><rect class="wert" width="${Math.min(100, anteil)}" height="6" rx="3" data-balken/></svg><span data-stand>${luecke > 0 ? `${luecke} unter Ziel` : 'Ziel erreicht'}</span></td></tr>`;
  };
  return `<div class="report" data-report>
        <div class="report-kopf"><p class="report-titel">Wochenreport</p><p class="stueck-marke" data-report-marke>Beispiel · Kalenderwoche 12</p></div>
        <table>
          <caption class="vh">Wochenreport: Ist gegen Ziel je Stufe</caption>
          <thead><tr><th scope="col">Stufe</th><th scope="col">Ist</th><th scope="col">Ziel</th><th scope="col">Stand</th></tr></thead>
          <tbody>
            ${REPORT.map(zeile).join('\n            ')}
          </tbody>
        </table>
        <p class="report-luecke" data-report-luecke role="status">Größte Lücke: Erstkontakte, 2 unter Ziel.</p>
        <p class="report-satz"><b>Nächste Woche:</b> Messekontakte nachfassen, die zwei größten offenen Angebote zuerst.</p>
        <p class="report-hinweis" data-report-hinweis>Die Ziele kommen aus dem <a href="${W}#rechner">Vertriebsrechner</a>, sobald Sie dort Ihre Werte eintragen.</p>
        <button class="knopf-zart" type="button" data-report-zurueck hidden>Zurück zu den Beispielzielen</button>
      </div>`;
}

// Der Gesprächsleitfaden: Auszüge aus den Inhalten von MAKE Innovation (wissen.json, Bausteine Skriptset und Einwandbibliothek), wörtlich.
// l(…) setzt eine Lücke zum Ausfüllen in einen Beispielsatz.
const l = (wort) => `<i class="luecke">${wort}</i>`;
const LEITFADEN = [
  { name: 'Einstieg', dauer: 'wenige Sekunden, dann ein Satz zum Anlass',
    regel: 'Name, Firma, Rahmen. Kein Smalltalk-Zwang, keine Frage nach dem Befinden am Telefon. Dann der Anlass: warum Sie sich gerade jetzt melden. Ohne Anlass kein Gespräch.',
    saetze: [`„Guten Tag, hier ist ${l('Name')} von ${l('Firma')}.“`, `„Sie hatten nach ${l('Thema')} gefragt.“`] },
  { name: 'Bedarf', dauer: 'der größte Teil',
    regel: 'Offene Fragen, zuhören, nachfragen. Ihr Gegenüber redet mehr als Sie. Die Reihenfolge im Gespräch: Bedarf, Zeitpunkt, Entscheidung, Mittel.',
    saetze: [`„Wie läuft ${l('Aufgabe')} heute bei Ihnen?“`, '„Bis wann?“', '„Wer entscheidet mit?“'],
    fragen: [
      ['Bedarf', 'Welches Problem soll gelöst werden, und was kostet es, wenn es bleibt?', 'Der Kunde beschreibt das Problem in eigenen Worten.', '„Wäre schön zu haben“'],
      ['Zeitpunkt', 'Bis wann muss es gelöst sein, und warum gerade dann?', 'Ein Datum mit Grund: Frist, Projekt, Saison.', '„Irgendwann dieses Jahr“'],
      ['Entscheidung', 'Wer entscheidet, wer redet mit, und wie läuft eine Entscheidung ab?', 'Die entscheidende Person sitzt im Gespräch.', '„Das entscheidet jemand anders“, ohne Namen'],
      ['Mittel', 'Gibt es Geld dafür, oder kann es beschafft werden?', 'Ein Rahmen wird genannt oder ist eingeplant.', '„Wir schauen erst mal, was es kostet“ ohne jede Vorstellung'],
    ] },
  { name: 'Einwand', dauer: 'vier Schritte',
    regel: 'Ein Einwand ist kein Nein. Er zeigt, dass Ihr Gegenüber sich mit dem Angebot beschäftigt und an einer Stelle noch nicht überzeugt ist. Wer sofort argumentiert, antwortet oft auf die falsche Frage. Darum kommt die Antwort erst im dritten Schritt.',
    schritte: [
      ['Nachfragen', 'Kurz anerkennen, ohne zuzustimmen. Dann eine offene Frage stellen, die den Einwand genauer macht.', '„Verstehe. Zu teuer im Vergleich wozu?“'],
      ['Verstehen', 'In eigenen Worten wiederholen und prüfen, ob es der einzige Punkt ist.', '„Ist das der einzige Punkt, oder gibt es noch etwas?“'],
      ['Antworten', 'Auf den eigentlichen Grund antworten, kurz und konkret: mit einer Rechnung, einem Beispiel oder einer Möglichkeit.', '„Lassen Sie uns kurz rechnen …“'],
      ['Weiterführen', 'Fragen, ob der Punkt geklärt ist, und einen nächsten Schritt mit Datum vorschlagen. Sonst bleibt alles offen.', '„Ist das damit für Sie geklärt?“'],
    ],
    zusatz: ['Einwand oder Vorwand? Der Prüfsatz', '„Angenommen, wir finden für den Punkt eine gute Lösung: Wären Sie dann bereit, den nächsten Schritt zu gehen?“ Ein Ja zeigt einen echten Einwand. Kommt stattdessen ein neuer Grund, war der erste ein Vorwand.'] },
  { name: 'Nächster Schritt', dauer: 'je eine Minute',
    regel: 'Erst zusammenfassen: in eigenen Worten wiedergeben, was Sie gehört haben, und bestätigen lassen. Dann ein konkreter Schritt mit Datum, oder ein klares Nein. Beides ist besser als „mal sehen“.',
    saetze: ['„Habe ich richtig verstanden, dass …?“', `„Passt Ihnen ${l('Tag')} um ${l('Uhrzeit')}?“`],
    danach: 'Danach im CRM: Stufe, nächste Aktion und Datum. Das Angebot geht in 24 Stunden raus, und jedes offene Angebot hat ein Datum zum Nachfassen.' },
];
function leitfaden({ voll = false } = {}) {
  const tafel = (t, i) => `<section class="lf-tafel" data-tafel aria-labelledby="lf-${i + 1}">
            <h4 class="lf-titel" id="lf-${i + 1}" tabindex="-1"><span>0${i + 1}</span>${t.name}<small>${t.dauer}</small></h4>
            <p class="lf-regel">${t.regel}</p>
            ${t.fragen ? `<dl class="lf-fragen">${t.fragen.map(([n, f, gut, warn]) => `<div><dt>${n}</dt><dd>${f}${voll ? `<span class="lf-zeichen"><span><b>Gutes Zeichen:</b> ${gut}</span><span><b>Warnzeichen:</b> ${warn}</span></span>` : ''}</dd></div>`).join('')}</dl>` : ''}
            ${t.schritte ? `<ol class="lf-schritte">${t.schritte.map(([n, was, satz]) => `<li><b>${n}</b><span>${was}</span><q class="lf-satz">${satz.slice(1, -1)}</q></li>`).join('')}</ol>` : ''}
            ${t.saetze ? `<div class="lf-saetze"><p class="lf-marke">Beispielsätze</p><ul>${t.saetze.map((s) => `<li><q class="lf-satz">${s.slice(1, -1)}</q></li>`).join('')}</ul></div>` : ''}
            ${t.zusatz && voll ? `<div class="lf-zusatz"><p class="lf-marke">${t.zusatz[0]}</p><p>${t.zusatz[1]}</p></div>` : ''}
            ${t.danach ? `<p class="lf-danach">${t.danach}</p>` : ''}
          </section>`;
  return `<div class="leitfaden" data-leitfaden>
        <div class="report-kopf"><p class="report-titel">Gesprächsleitfaden</p>${voll ? '' : '<p class="stueck-marke">Auszug</p>'}</div>
        <ol class="lf-wahl" hidden>
          ${LEITFADEN.map((t, i) => `<li><button type="button" data-lf="${i}"><span>0${i + 1}</span>${t.name}</button></li>`).join('')}
        </ol>
        <div class="lf-tafeln">
          ${LEITFADEN.map(tafel).join('\n          ')}
        </div>
        <div class="lf-fuss" hidden>
          <button class="knopf-zart" type="button" data-lf-zurueck>Zurück</button>
          <span class="lf-stand" data-lf-stand aria-live="polite">Schritt 1 von 4</span>
          <button class="knopf-zart knopf-zart-voll" type="button" data-lf-weiter>Weiter</button>
        </div>
        <p class="stueck-hinweis">Abgelesen wird nichts. Die Sätze passen Sie an Ihr Angebot und Ihre Branche an.</p>
      </div>`;
}
// Ein Stück mit Text links und dem Stück rechts
const stueck = (nr, titel, text, inhalt, id = '') => `<div class="stueck"${id ? ` id="${id}"` : ''}>
      <div class="stueck-text">
        <p class="stueck-nr" aria-hidden="true">${nr}</p>
        <h3 class="stueck-titel">${titel}</h3>
        ${text}
      </div>
      ${inhalt}
    </div>`;

// ─── Bausteine ───
const pfeil = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const NAV = [
  ['systemvertrieb/', 'Systemvertrieb', 'systemvertrieb'],
  ['vertrieb-auf-zeit/', 'Vertrieb auf Zeit', 'zeit'],
  ['netzwerken/', 'Netzwerken', 'netzwerken'],
  ['vertriebs-check/', 'Vertriebs-Check', 'check'],
  ['fragen/', 'Fragen', 'fragen'],
];
// Familien-Link: href ist der Rückfall (seo.mjs schreibt ihn aus familie.js), verweise.js setzt ihn im Browser neu
const fam = (ziel, text, { pfad = '', klasse = 'textlink' } = {}) =>
  `<a${klasse ? ` class="${klasse}"` : ''} href="#" data-familie="${ziel}"${pfad ? ` data-pfad="${pfad}"` : ''}>${text}</a>`;
const marke = (klasse = '') => `<svg class="marke-zeichen" viewBox="0 0 100 100" aria-hidden="true"><use href="#g-zeichen"/></svg><span class="marke-wort${klasse}"><b>MAKE</b> <span>REVENUE</span></span>`;

function fragenListe(liste) {
  return `<div class="fragen-liste">
${liste.map(([f, a]) => `      <details><summary>${e(f)}</summary><div class="fragen-antwort"><p>${a}</p></div></details>`).join('\n')}
    </div>`;
}
const punkte = (liste, klasse = '') => `<ul class="punkte ${klasse}">${liste.map((p) => `<li>${p}</li>`).join('')}</ul>`;

function kontakt(W, { titel = 'Sprechen wir <em>darüber.</em>', thema = '', schritte = true } = {}) {
  return `
<section class="abschnitt dunkel kontakt" id="kontakt" aria-labelledby="kontakt-titel">
  <div class="w">
    <p class="ueberzeile">Kontakt</p>
    <h2 class="kontakt-titel" id="kontakt-titel">${titel}</h2>
    <p class="abschnitt-text">Das Erstgespräch dauert 30 Minuten, läuft per Video und kostet nichts. Danach wissen Sie, ob und womit wir helfen können. Oder Sie machen zuerst den Vertriebs-Check: 5 Minuten, Ergebnis sofort.</p>
    <div class="kontakt-aktionen" id="erstgespraech">
      <a class="knopf knopf-gross" href="mailto:${MAIL}?subject=Erstgespr%C3%A4ch%20MAKE%20Revenue" data-buchen${thema ? `="${thema}"` : ''}>Erstgespräch vereinbaren</a>
      ${fam('check', 'Vertriebs-Check starten', { klasse: 'knopf knopf-gross knopf-leise' })}
    </div>
    <a class="kontakt-mail" href="mailto:${MAIL}?subject=Anfrage%20MAKE%20Revenue">${MAIL}</a>${schritte ? `
    <ol class="kontakt-drei">
      <li><b>Erstgespräch</b><span>Sie schildern Ihre Lage, wir fragen nach. Ein Verkaufsgespräch ist es nicht.</span></li>
      <li><b>Ihr Vorschlag</b><span>Wir schlagen Ihnen ein Angebot vor. Festpreis und Ablauf bekommen Sie schriftlich, bevor es losgeht.</span></li>
      <li><b>Start</b><span>Zum vereinbarten Termin, mit ersten Ergebnissen im ersten Monat.</span></li>
    </ol>` : ''}
  </div>
</section>`;
}

function buchenFenster() {
  return `
<dialog class="buchen" id="buchen" aria-labelledby="buchen-titel">
  <form class="buchen-form" novalidate>
    <div class="buchen-kopf">
      <p class="ueberzeile buchen-titel" id="buchen-titel">Erstgespräch vereinbaren</p>
      <p class="buchen-schritt" aria-live="polite"><span class="buchen-schritt-wort">Schritt </span><b>1</b> von 3</p>
      <button class="buchen-zu" type="button" data-zu aria-label="Schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="buchen-balken" aria-hidden="true"><i></i></div>
    <div class="buchen-inhalt">

      <section data-teil aria-labelledby="buchen-frage-1">
        <p class="buchen-frage" id="buchen-frage-1" tabindex="-1" role="heading" aria-level="2">Worum <em>geht es?</em></p>
        <fieldset data-feld="thema">
          <legend>Ihr Thema</legend>
          <div class="wahl-reihe">
            <label class="wahl"><input type="radio" name="thema" value="systemvertrieb" data-text="Digitaler Systemvertrieb"><span>Digitaler Systemvertrieb</span></label>
            <label class="wahl"><input type="radio" name="thema" value="zeit" data-text="Vertrieb auf Zeit"><span>Vertrieb auf Zeit</span></label>
            <label class="wahl"><input type="radio" name="thema" value="workshop" data-text="Tagesworkshop Vertrieb"><span>Tagesworkshop Vertrieb</span></label>
            <label class="wahl"><input type="radio" name="thema" value="netzwerk" data-text="Netzwerken und Events"><span>Netzwerken und Events</span></label>
            <label class="wahl"><input type="radio" name="thema" value="offen" data-text="Noch offen"><span>Noch offen</span></label>
          </div>
          <p class="feld-fehler" hidden></p>
        </fieldset>
        <div class="felder">
          <div class="feld feld-breit">
            <label for="b-ziel">Was soll in 90 Tagen anders sein? <span class="optional">optional</span></label>
            <textarea id="b-ziel" name="ziel" rows="3" maxlength="1000"></textarea>
          </div>
        </div>
      </section>

      <section data-teil aria-labelledby="buchen-frage-2" hidden>
        <p class="buchen-frage" id="buchen-frage-2" tabindex="-1" role="heading" aria-level="2">Wann passt es <em>Ihnen?</em></p>
        <fieldset data-feld="art">
          <legend>Wie sprechen wir?</legend>
          <div class="wahl-reihe">
            <label class="wahl"><input type="radio" name="art" value="video" data-text="Video-Call" checked><span>Video-Call</span></label>
            <label class="wahl"><input type="radio" name="art" value="telefon" data-text="Telefon"><span>Telefon</span></label>
          </div>
          <p class="feld-fehler" hidden></p>
        </fieldset>
        <fieldset data-feld="tag">
          <legend>Ihr Wunschtag</legend>
          <div class="buchen-tage"></div>
          <p class="feld-fehler" hidden></p>
        </fieldset>
        <fieldset data-feld="zeit">
          <legend>Ihr Zeitfenster</legend>
          <div class="wahl-raster">
            <label class="wahl"><input type="radio" name="zeit" value="vormittag" data-text="Vormittag (9 bis 12 Uhr)"><span>Vormittag<small>9 bis 12 Uhr</small></span></label>
            <label class="wahl"><input type="radio" name="zeit" value="mittag" data-text="Mittag (12 bis 14 Uhr)"><span>Mittag<small>12 bis 14 Uhr</small></span></label>
            <label class="wahl"><input type="radio" name="zeit" value="nachmittag" data-text="Nachmittag (14 bis 17 Uhr)"><span>Nachmittag<small>14 bis 17 Uhr</small></span></label>
          </div>
          <p class="feld-fehler" hidden></p>
        </fieldset>
        <p class="buchen-hinweis">Wir bestätigen den Termin persönlich per E-Mail. Passt der Tag nicht, schlagen wir einen anderen vor.</p>
      </section>

      <section data-teil aria-labelledby="buchen-frage-3" hidden>
        <p class="buchen-frage" id="buchen-frage-3" tabindex="-1" role="heading" aria-level="2">Wie erreichen wir <em>Sie?</em></p>
        <div class="felder">
          <div class="feld" data-feld="name">
            <label for="b-name">Ihr Name</label>
            <input id="b-name" name="name" type="text" autocomplete="name" maxlength="120">
            <p class="feld-fehler" hidden></p>
          </div>
          <div class="feld" data-feld="unternehmen">
            <label for="b-unternehmen">Ihr Unternehmen</label>
            <input id="b-unternehmen" name="unternehmen" type="text" autocomplete="organization" maxlength="160">
            <p class="feld-fehler" hidden></p>
          </div>
          <div class="feld" data-feld="email">
            <label for="b-email">E-Mail</label>
            <input id="b-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="200">
            <p class="feld-fehler" hidden></p>
          </div>
          <div class="feld">
            <label for="b-telefon">Telefon <span class="optional">optional</span></label>
            <input id="b-telefon" name="telefon" type="tel" autocomplete="tel" maxlength="40">
          </div>
          <div class="feld feld-breit">
            <label for="b-web">Website <span class="optional">optional</span></label>
            <input id="b-web" name="web" type="text" inputmode="url" autocomplete="url" maxlength="300">
          </div>
          <div class="feld feld-breit">
            <label for="b-nachricht">Nachricht <span class="optional">optional</span></label>
            <textarea id="b-nachricht" name="nachricht" rows="4" maxlength="2000"></textarea>
          </div>
        </div>
        <p class="buchen-datenschutz">Beim Senden öffnet sich Ihr E-Mail-Programm mit dem fertigen Text. ${fam('innovation', 'Datenschutz', { pfad: 'datenschutz/' })}</p>
      </section>

      <div class="buchen-fertig" hidden>
        <svg class="buchen-fertig-zeichen" viewBox="0 0 100 100" aria-hidden="true"><use href="#g-zeichen"/></svg>
        <p class="buchen-frage" tabindex="-1" role="heading" aria-level="2">Fast <em>geschafft.</em></p>
        <p>Ihr E-Mail-Programm hat sich mit der fertigen Anfrage geöffnet. Bitte senden Sie die Nachricht dort ab, wir antworten persönlich.</p>
        <p>Hat sich nichts geöffnet? Kopieren Sie den Text und schicken Sie ihn an ${MAIL}.</p>
        <div class="buchen-fertig-aktionen">
          <a class="knopf" href="mailto:${MAIL}" data-erneut>E-Mail erneut öffnen</a>
          <button class="buchen-leise" type="button" data-kopieren>Text kopieren</button>
        </div>
        <textarea class="buchen-kopie" readonly hidden aria-label="Text der Anfrage"></textarea>
        <button class="buchen-leise buchen-schliessen" type="button" data-zu>Schließen</button>
      </div>

    </div>
    <div class="buchen-fuss">
      <button class="buchen-leise" type="button" data-zurueck hidden>Zurück</button>
      <button class="knopf" type="submit" data-weiter>Weiter</button>
    </div>
  </form>
</dialog>`;
}

// RECHTSFORM: Die Formel im Fuß („MAKE Revenue · eine Marke von MAKE Innovation“) steht in rahmen(), Abschnitt fuss-unten.
// Dort später die Gesellschaft nachtragen, sobald Kevin entschieden hat.
function rahmen({ pfad, aktuell, klasse, inhalt, skripte = [] }) {
  const W = pfad ? '../' : '';
  const start = W || './';
  const nav = (mitNr) => NAV.map(([p, name, id], i) =>
    `<a href="${W}${p}"${id === aktuell ? ' aria-current="page"' : ''}>${mitNr ? `<span>0${i + 1}</span>` : ''}${name}</a>`).join('\n    ');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- seo:anfang -->
<!-- seo:ende -->
<meta name="theme-color" content="${FARBE.nacht}">
<link rel="icon" href="${W}favicon.ico" sizes="32x32">
<link rel="icon" href="${W}zeichen.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${W}bild/icon-180.png">
<link rel="manifest" href="${W}site.webmanifest">
<link rel="preload" href="${W}schriften/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${W}schriften/instrument-serif-italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${W}revenue.css">
<link rel="stylesheet" href="${W}buchen.css">
<script src="${W}frueh.js"></script>
<script src="${W}seite.js" defer></script>
${skripte.map((s) => `<script src="${W}${s}" defer></script>\n`).join('')}<script src="${W}buchen.js" defer></script>
<script type="module" src="${W}verweise.js"></script>
</head>
<body class="${klasse}">

<!-- Das Zeichen (${ZEICHNUNG.name}): einmal hier, überall per <use>. Farbe über currentColor. -->
<svg class="vorrat" aria-hidden="true" focusable="false">
  <defs>
    <g id="g-zeichen">${ZEICHNUNG.svg}</g>
  </defs>
</svg>

<a class="springen" href="#inhalt">Zum Inhalt</a>

<header class="kopf">
  <a class="marke" href="${start}" aria-label="MAKE Revenue, zur Startseite">${marke()}</a>
  <nav class="kopf-nav" aria-label="Hauptmenü">
    ${nav(false)}
  </nav>
  <div class="kopf-rechts">
    <a class="knopf knopf-klein" href="${W}#erstgespraech" data-buchen>Erstgespräch</a>
    <button class="menue-knopf" type="button" aria-expanded="false" aria-controls="menue"><span class="menue-knopf-wort">Menü</span><span class="menue-knopf-zeichen" aria-hidden="true"><i></i><i></i></span></button>
  </div>
</header>

<!-- Menü für schmale Fenster: eigenes Fenster (dialog) mit Fokusfalle und Escape (seite.js) -->
<dialog class="menue" id="menue" aria-label="Menü">
  <div class="menue-kopf">
    <span class="marke">${marke()}</span>
    <button class="menue-zu" type="button" aria-label="Menü schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  <nav class="menue-nav" aria-label="Hauptmenü">
    ${nav(true)}
  </nav>
  <div class="menue-fuss">
    <a class="knopf knopf-gross" href="${W}#erstgespraech" data-buchen>Erstgespräch vereinbaren</a>
    <a class="menue-mail" href="mailto:${MAIL}?subject=Anfrage%20MAKE%20Revenue">${MAIL}</a>
  </div>
</dialog>

<main id="inhalt">
${inhalt(W)}
</main>

<footer class="fuss">
  <div class="w">
    <div class="fuss-oben">
      <div>
        <a class="marke" href="${start}" aria-label="MAKE Revenue, zur Startseite">${marke()}</a>
        <p class="fuss-satz">Vertrieb mit System, Vertriebsleitung auf Zeit, Netzwerken und Events. Aus Berlin, für Unternehmen in Deutschland und Europa.</p>
      </div>
      <nav aria-label="Themen">
        <p class="fuss-titel">Themen</p>
        <ul class="fuss-liste">
          <li><a href="${W}systemvertrieb/">Digitaler Systemvertrieb</a></li>
          <li><a href="${W}vertrieb-auf-zeit/">Vertrieb auf Zeit</a></li>
          <li><a href="${W}netzwerken/">Netzwerken und Events</a></li>
          <li><a href="${W}vertriebs-check/">Vertriebs-Check</a></li>
          <li><a href="${W}fragen/">Häufige Fragen</a></li>
        </ul>
      </nav>
      <div>
        <p class="fuss-titel">Auch von uns</p>
        <ul class="fuss-liste">
          <li>${fam('innovation', 'MAKE Innovation', { klasse: '' })}<small>KI, bessere Abläufe und eigene Software</small></li>
          <li>${fam('studios', 'MAKE Studios', { klasse: '' })}<small>Websites, Google-Profil, Video und Social Media</small></li>
        </ul>
      </div>
    </div>
    <div class="fuss-unten">
      <span>MAKE Revenue · eine Marke von MAKE Innovation · Stand: ${STAND}</span>
      <nav aria-label="Rechtliches">${fam('innovation', 'Impressum', { pfad: 'impressum/', klasse: '' })}${fam('innovation', 'Datenschutz', { pfad: 'datenschutz/', klasse: '' })}<a href="mailto:${MAIL}">Kontakt</a></nav>
    </div>
  </div>
</footer>
${buchenFenster()}

</body>
</html>
`;
}

// Kopf einer Unterseite: Brotkrumen, eine h1, Einleitung, rechts der blaue Kasten mit der Antwort in ein, zwei Sätzen und den Eckdaten
function seitenKopf(W, { krume, titel, text, aktionen, vorweg, fakten, film = '', filmMarke }) {
  return `
<section class="seiten-kopf dunkel" data-dunkelkopf>
  <div class="w">
    <nav aria-label="Brotkrumen"><ol class="krume"><li><a href="${W}">Start</a></li><li aria-current="page">${krume}</li></ol></nav>
    <div class="seiten-raster">
      <div>
        <h1 class="seiten-titel">${titel}</h1>
        <p class="seiten-text">${text}</p>
        <div class="seiten-aktionen">${aktionen}</div>
      </div>
      <aside class="vorweg" aria-label="Eckdaten">
        <p>${vorweg}</p>
        <dl>${fakten.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </aside>
    </div>
    ${film ? filmplatz(W, film, 'filmplatz-band', filmMarke) : ''}
  </div>
</section>`;
}
const abKopf = (ueber, titel, text = '', id = '') => `<div class="abschnitt-kopf${text ? '' : ' abschnitt-kopf-schmal'}">
      ${ueber ? `<p class="ueberzeile">${ueber}</p>` : ''}
      <h2 class="abschnitt-titel"${id ? ` id="${id}"` : ''}>${titel}</h2>
      ${text ? `<p class="abschnitt-text">${text}</p>` : ''}
    </div>`;
const autor = () => `<p class="stand">Verantwortlich für den Inhalt: Kevin Dieckmann, Vertrieb und Umsetzung · ${fam('innovation', 'Über uns', { pfad: 'ueber-uns/' })} · Stand: ${STAND}</p>`;

// ─── Rechner: dieselbe Rechnung wie rechner.js, hier für die Startwerte im HTML (ohne JavaScript sichtbar) ───
const START = { ziel: 240000, auftrag: 8000, kontaktquote: 20, terminquote: 50, angebotsquote: 33, wochen: 45, offen: 4, stunden: 2 };
function rueckwaerts(w) {
  const abschluesse = Math.ceil(w.ziel / w.auftrag);
  const angebote = Math.ceil(abschluesse / (w.angebotsquote / 100));
  const termine = Math.ceil(angebote / (w.terminquote / 100));
  const kontakte = Math.ceil(termine / (w.kontaktquote / 100));
  const jeWoche = (n) => n / w.wochen;
  const termineMit = (aq, auftrag) => Math.ceil(Math.ceil(Math.ceil(w.ziel / auftrag) / (aq / 100)) / (w.terminquote / 100)) / w.wochen;
  const offen = Math.round(jeWoche(angebote) * w.offen);
  const stunden = jeWoche(termine) * w.stunden;
  return { abschluesse, angebote, termine, kontakte, kontakteWoche: jeWoche(kontakte), termineWoche: jeWoche(termine), angeboteWoche: jeWoche(angebote),
    umsatzMonat: w.ziel / 12, offen, pipeline: offen * w.auftrag, stunden, vertriebler: stunden / (40 * 0.4),
    quoteNeu: Math.min(100, w.angebotsquote + 7), hebelQuote: Math.max(0, jeWoche(termine) - termineMit(Math.min(100, w.angebotsquote + 7), w.auftrag)),
    hebelAuftrag: Math.max(0, jeWoche(termine) - termineMit(w.angebotsquote, w.auftrag * 1.25)) };
}
const de = (n, stellen = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });

function rechner() {
  const r = rueckwaerts(START);
  const feld = (name, id, wert, einheit) => `<label class="rechner-feld"><span>${name}</span><span class="rechner-eingabe"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${wert}" data-feld="${id}"><span class="einheit">${einheit}</span></span></label>`;
  const balken = (name, id, n) => `<li><span class="trichter-name">${name}</span><svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect class="grund" x="0" y="0" width="100" height="10" rx="1.4" ry="5"/><rect class="wert" x="${(50 - Math.max(1, (100 * n) / r.kontakte) / 2).toFixed(2)}" y="0" width="${Math.max(1, (100 * n) / r.kontakte).toFixed(2)}" height="10" rx="1.4" ry="5" data-balken="${id}"/></svg><b data-aus="${id}">${de(n)}</b></li>`;
  return `<div class="rechner" data-rechner>
      <div class="rechner-eingaben erscheint">
        <p class="etikett">Ihr Ziel</p>
        ${feld('Umsatzziel im Jahr', 'ziel', de(START.ziel), '€')}
        ${feld('Durchschnittlicher Auftrag', 'auftrag', de(START.auftrag), '€')}
        <p class="etikett">Ihre Quoten</p>
        ${feld('Erstkontakte, aus denen ein Termin wird', 'kontaktquote', START.kontaktquote, '%')}
        ${feld('Termine, aus denen ein Angebot wird', 'terminquote', START.terminquote, '%')}
        ${feld('Angebote, die zum Auftrag werden', 'angebotsquote', START.angebotsquote, '%')}
        <p class="etikett">Ihr Alltag</p>
        ${feld('Arbeitswochen im Jahr', 'wochen', START.wochen, 'Wochen')}
        ${feld('Bis ein Angebot entschieden ist', 'offen', START.offen, 'Wochen')}
        ${feld('Zeit je Termin mit Vor- und Nachbereitung', 'stunden', START.stunden, 'Stunden')}
        <p class="rechner-hinweis">Die Startwerte sind ein Beispiel.</p>
        <noscript><p class="rechner-hinweis">Zum Rechnen braucht es JavaScript. Rechts sehen Sie das Beispiel mit den Startwerten.</p></noscript>
      </div>
      <div class="rechner-rechts erscheint erscheint-2">
        <dl class="rechner-ergebnis" aria-live="polite">
          <div class="rechner-haupt"><dt>Termine je Woche</dt><dd data-aus="termineWoche">${de(r.termineWoche, 1)}</dd></div>
          <div><dt>Erstkontakte je Woche</dt><dd data-aus="kontakteWoche">${de(r.kontakteWoche, 1)}</dd></div>
          <div><dt>Angebote je Woche</dt><dd data-aus="angeboteWoche">${de(r.angeboteWoche, 1)}</dd></div>
          <div><dt>Umsatz je Monat</dt><dd data-aus="umsatzMonat">${de(r.umsatzMonat)}&nbsp;€</dd></div>
        </dl>
        <figure class="trichter" aria-label="Vom Erstkontakt zum Abschluss, im Jahr"><figcaption class="etikett">Im Jahr</figcaption>
          <ol>
            ${balken('Erstkontakte', 'kontakte', r.kontakte)}
            ${balken('Termine', 'termine', r.termine)}
            ${balken('Angebote', 'angebote', r.angebote)}
            ${balken('Abschlüsse', 'abschluesse', r.abschluesse)}
          </ol>
        </figure>
        <div class="rechner-saetze">
          <div class="rechner-satz"><p class="etikett">Offene Angebote</p><p><b data-aus="offen">${de(r.offen)}</b> Angebote im Wert von <b data-aus="pipeline">${de(r.pipeline)}&nbsp;€</b> sollten im Schnitt gleichzeitig offen sein.</p></div>
          <div class="rechner-satz"><p class="etikett">Vertriebszeit</p><p><b data-aus="stunden">${de(r.stunden, 1)}</b> Stunden je Woche nur für Termine. Bei 40&nbsp;% Verkaufszeit sind das rund <b data-aus="vertriebler">${de(r.vertriebler, 1)}</b> Vertriebler in Vollzeit.</p><cite class="zahl-quelle">40&nbsp;% Verkaufszeit: <a href="${ZAHL.zeit.link}" rel="noopener">Salesforce, State of Sales Report, 03.02.2026</a></cite></div>
          <div class="rechner-satz"><p class="etikett">Hebel Abschlussquote</p><p>Schließen Sie <b data-aus="quoteNeu">${de(r.quoteNeu)}&nbsp;%</b> statt <b data-aus="quoteAlt">${de(START.angebotsquote)}&nbsp;%</b> der Angebote ab, brauchen Sie <b data-aus="hebelQuote">${de(r.hebelQuote, 1)}</b> Termine weniger pro Woche.</p></div>
          <div class="rechner-satz"><p class="etikett">Hebel Auftragsgröße</p><p>Ist Ihr Auftrag im Schnitt ein Viertel größer, sind es <b data-aus="hebelAuftrag">${de(r.hebelAuftrag, 1)}</b> Termine weniger.</p></div>
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════ Seiten ═══════════════════════════════════════
const FRAGEN = {
  erstgespraech: ['Ist das Erstgespräch ein Verkaufsgespräch?', 'Nein. Wir sprechen über Ihre Lage, kostenlos und per Video. Am Ende sagen wir Ihnen, ob wir helfen können und womit. Wenn nicht, sagen wir auch das.'],
  gespraeche: ['Wer führt die Verkaufsgespräche?', 'Ihr Team. Wir machen vor, trainieren mit Rollenspielen und besprechen echte Calls nach. So bleibt das Wissen bei Ihnen, wenn wir gehen.'],
  crm: ['Brauche ich schon ein CRM?', 'Nein. Wenn Sie keins haben, wählen wir im ersten Monat gemeinsam ein passendes aus und richten Stages, Pflichtfelder und Wiedervorlagen ein. Die Lizenzkosten tragen Sie.'],
  preise: ['Was kostet das?', `Sie bekommen einen Festpreis, schriftlich und bevor es losgeht. Unsere ${fam('innovation', 'Startpreise', { pfad: 'preise/' })} können Sie vorher ansehen.`],
  wer: ['Wer steht hinter MAKE Revenue?', 'MAKE Revenue ist eine Marke von MAKE Innovation aus Berlin. Ihre Ansprechpartner sind Kevin und Malin.'],
  projekt: ['Wer arbeitet an meinem Projekt?', 'Sie arbeiten direkt mit uns, Kevin und Malin, und nicht mit wechselnden Projektleitern. Sie sprechen immer mit uns, und wir stimmen alles Weitere im Team ab.'],
  erfahrung: ['Welche Erfahrung bringen Sie mit?', 'Wir kommen aus der Vertriebsführung: Teams geführt, Partnernetze aufgebaut, Head of Sales bei einem FinTech. Heute arbeiten wir in laufenden Projekten mit KI, auch im internationalen Umfeld. Namen nennen wir nur, wenn Kunden es freigeben.'],
  vorort: ['Arbeiten Sie auch bei uns vor Ort?', 'Ja. Vieles läuft per Video, wichtige Termine machen wir gern bei Ihnen: Workshops, Trainings mit Ihrem Team, Gespräche mit der Geschäftsführung. Termine vor Ort vereinbaren wir vorher, Reisekosten rechnen wir gegen Beleg ab.'],
  ersterVertriebler: ['Wann sollte ein Start-up den ersten Vertriebler einstellen?', 'Sobald es ein System gibt, in das er einsteigen kann: eine Zielgruppe, Leitfäden und einen Prozess im CRM. Ohne dieses Fundament verbringt ein neuer Vertriebler die ersten Monate damit, es selbst zu suchen.'],
  welchesCrm: ['Welches CRM brauche ich für den Anfang?', 'Eines, das Ihr Team jeden Tag nutzt. Wichtiger als das Werkzeug sind feste Stufen, Pflichtfelder und Wiedervorlagen. Fangen Sie klein an und erweitern Sie erst, wenn die Grundlagen sitzen.'],
  kennzahlen: ['Wie viele Kennzahlen braucht ein kleiner Vertrieb?', 'Wenige: Erstkontakte, Termine, Angebote und Abschlüsse je Woche, dazu die Quoten zwischen den Stufen. Wichtiger als die Zahl der Kennzahlen ist, dass sie jede Woche besprochen werden.'],
  planbar: ['Wie lange dauert es, bis Vertrieb planbar läuft?', 'Das hängt vom Ausgangspunkt ab. In unserem Mandat als Head of Sales läuft ab Monat 3 jedes Gespräch nach Prozess im CRM, und jeden Freitag kommt der Wochenreport. Ziel bis Monat 6 ist, dass Ihr Team ohne den Gründer abschließt. Wir schulden die Leistung, nicht den Umsatz.'],
  richtwerte: ['Gibt es gute Richtwerte für Termin- oder Abschlussquoten?', 'Wir nennen bewusst keine. Quoten hängen von Branche, Preis, Kanal und Kontaktliste ab. Messen Sie vier bis acht Wochen Ihre eigenen Werte und setzen Sie Ziele daraus.'],
  tabelle: ['Reicht eine Tabelle, oder brauche ich ein CRM?', 'Am Start reicht eine Tabelle. Sobald mehrere Personen verkaufen und Sie Zahlen je Person und je Stufe brauchen, wird ein CRM mit Pflichtfeldern deutlich einfacher.'],
  eintragen: ['Wer trägt die Zahlen ein?', 'Jede Person ihre eigenen, am selben Tag. Eine Person achtet darauf, dass alles vollständig ist, und bringt die Zahlen zur Wochenrunde mit.'],
  zeitaufwand: ['Wie viel Zeit kostet mich ein Mandat?', 'Rund 3 bis 4 Stunden für das Sales Playbook Teil 1 im ersten Monat, danach 30 Minuten Wochen-Call und kurze Freigaben. Ihr Team braucht Zeit für Training und Gespräche.'],
  unterschied: ['Was ist der Unterschied zwischen Head of Sales und Chief Sales Officer?', 'Der Head of Sales baut und führt Ihren Vertrieb: Zielgruppe, Prozess im CRM, Skripte, Kennzahlen und Training. Der Chief Sales Officer macht all das auch und verantwortet dazu Strategie, Preise, Teamaufbau, Recruiting und Partnerschaften. Sie können jederzeit zum Chief Sales Officer wechseln.'],
  playbooks: ['Gehören Skripte und Playbooks danach mir?', 'Ja. Nach Zahlung dürfen Sie alle Vorlagen, Skripte und Playbooks in Ihrem Unternehmen zeitlich unbegrenzt nutzen.'],
  laufzeit: ['Wie lange laufen die Verträge?', 'Head of Sales und Chief Sales Officer laufen 6 oder 12 Monate. Der Tagesworkshop ist ein Einmalprojekt mit Festpreis.'],
  csoZeit: ['Wie viel Zeit bringt der Chief Sales Officer ein?', '30 bis 35 Stunden im Monat, fest eingeplant. Dazu kommen der Wochen-Call und ein monatlicher Strategie-Call mit der Geschäftsführung.'],
  einstellen: ['Stellen Sie unsere Vertriebler ein?', 'Wir bauen Rollenmodell, Stellenanzeige, Interviewleitfaden und Probetag und führen die Interviews mit Ihnen. Die Entscheidung und den Arbeitsvertrag machen Sie. Stellenanzeigen und Recruiting-Tools zahlen Sie direkt.'],
  ende: ['Was passiert am Ende eines Mandats?', 'Wir übergeben an Ihre interne Vertriebsleitung, mit Übergabeplan in 4 Schritten und dem Sales Playbook Teil 3.'],
  workshopNichts: ['Was bringt mir der Tagesworkshop?', 'Ziel des Tages sind drei Hebel, die Sie sofort umsetzen können.'],
  workshopFokus: ['Strategie oder operativ: Was heißt das beim Tagesworkshop?', 'Mit Fokus Strategie geht es um Zielgruppe, Markteintritt und Positionierung. Mit Fokus operativ um Ablauf, Zahlen und Werkzeuge im Vertrieb. Sie wählen vorab.'],
  nichtPassend: ['Für wen passt ein Head of Sales auf Zeit nicht?', 'Für Firmen ohne fertiges Produkt, Konzerne mit Einkaufsabteilung, reine Kaltakquise-Telefonteams und Network-Marketing.'],
  erstePerson: ['Wann sollte ich die erste Person für den Vertrieb einstellen?', 'Wenn Sie wissen, welche Kunden am besten passen, Ihr Erstgespräch einem aufgeschriebenen Ablauf folgt und genug Kontakte da sind, um eine Person auszulasten. Fehlt eines davon, holen Sie es zuerst nach.'],
  rollen: ['Brauche ich gleich getrennte Rollen im Vertrieb?', 'Nein. In kleinen Teams macht jede Person alles. Trennen Sie Rollen erst, wenn eine Aufgabe eine Person gut auslasten kann, und regeln Sie dann die Übergaben zwischen den Rollen.'],
  fuehren: ['Wer soll den Vertrieb führen, wenn ich es nicht mehr mache?', 'Jemand, der führen will und es gelernt hat oder lernen darf. Das ist nicht immer die Person, die am meisten verkauft. Am Anfang verkauft die Vertriebsleitung oft noch mit, braucht aber feste Zeit für die Führung.'],
  eventKosten: ['Was kosten die Events?', 'Für Gäste sind die Events kostenlos.'],
  eventEinladung: ['Wie bekomme ich eine Einladung?', `Tragen Sie sich auf die ${fam('innovation', 'Gästeliste', { pfad: 'events/' })} ein, dann bekommen Sie die nächste Einladung. Termin, Ort und Format stehen darin.`],
  eventGaeste: ['Wer kommt zu den Events?', 'Gründerinnen und Gründer, Mittelständler und Macher aus KI und Technik. Wir laden selbst ein und mischen bewusst, zum Beispiel Start-ups mit Mittelständlern oder Leute aus der Technik mit Leuten aus dem Vertrieb.'],
  checkKosten: ['Was kostet der Vertriebs-Check?', 'Nichts. Der Vertriebs-Check und das Erstgespräch danach sind kostenlos.'],
  checkDauer: ['Wie lange dauert der Vertriebs-Check?', 'Rund 5 Minuten. Es sind zwölf Fragen zu Organisation, Zahlen und Neukunden, dazu zwei in Ihren eigenen Worten. Das Ergebnis sehen Sie sofort.'],
  checkDanach: ['Was passiert nach dem Vertriebs-Check?', 'Sie sehen sofort, wo Ihr Vertrieb steht und welcher Schritt jetzt am meisten bringt. Wenn Sie möchten, sprechen wir im kostenlosen Erstgespräch darüber: 30 Minuten per Video.'],
};
const fr = (...ids) => ids.map((i) => FRAGEN[i]);

const BEGRIFFE = [
  ['Digitaler Systemvertrieb', 'Digitaler Systemvertrieb ist Vertrieb nach einem festen Ablauf im CRM: Jede Anfrage hat eine Stufe, eine nächste Aktion und ein Datum, und wenige Kennzahlen zeigen jede Woche, ob der Plan hält.'],
  ['Vertrieb auf Zeit', 'Vertrieb auf Zeit ist eine Vertriebsleitung für einige Monate, die das System aufbaut, mit Ihrem Team umsetzt und so übergibt, dass der Vertrieb ohne sie läuft. Auch Interim oder Fractional Head of Sales genannt.'],
  ['Salesprozess', 'Der Salesprozess sind die festen Stufen, die jede Anfrage bis zum Abschluss durchläuft, mit einer festgelegten nächsten Aktion je Stufe.'],
  ['Pipeline', 'Die Pipeline ist die Summe aller offenen Verkaufschancen mit ihrem erwarteten Wert, geordnet nach Stufe vom Erstkontakt bis zum Abschluss.'],
  ['Wiedervorlage', 'Eine Wiedervorlage ist ein fester Termin im CRM, an dem eine offene Anfrage wieder bearbeitet wird. So bleibt keine Anfrage liegen.'],
  ['Abschlussquote', 'Die Abschlussquote ist der Anteil der Angebote, aus denen ein Auftrag wird. Gezählt werden nur Angebote, die entschieden sind, also angenommen oder abgelehnt.'],
  ['Rückwärtsrechnung', 'Die Rückwärtsrechnung führt vom Umsatzziel zurück zu den nötigen Abschlüssen, Angeboten und Terminen je Woche.'],
  ['Wochenreport', 'Der Wochenreport ist ein kurzer Bericht jeden Freitag: die Zahlen des Vertriebs und ein Satz dazu, was nächste Woche anders läuft.'],
  ['Lead-Scoring', 'Lead-Scoring ist die Einteilung der Kontakte danach, wie gut sie passen, zum Beispiel in A, B und C. A-Kontakte bekommen zuerst Zeit.'],
  ['Sales Playbook', 'Das Sales Playbook ist das Nachschlagewerk des Vertriebs: Zielgruppe, Botschaft, Prozess, Leitfäden, Antworten auf Einwände und Kennzahlen an einem Ort.'],
];

// ─────────────── Startseite ───────────────
// Die Strecke als Trichter: dieselbe Form wie das Zeichen. Sie steht im Film rechts (schmal: oben) und füllt sich Stufe für Stufe.
// Maße in viewBox 0 0 400 470; die Beschriftung liegt als HTML darüber (film.js rechnet jeden Zustand aus dem Fortschritt).
const STRECKE = [
  { name: 'Anfrage', heute: 'liegt im Postfach', system: 'nächste Aktion mit Datum', x: 20, y: 18, b: 360 },
  { name: 'Gespräch', heute: 'läuft nebenbei', system: 'nach Leitfaden', x: 70, y: 128, b: 260 },
  { name: 'Angebot', heute: 'bleibt liegen', system: 'raus in 24 Stunden', x: 120, y: 238, b: 160 },
  { name: 'Abschluss', heute: 'nicht planbar', system: 'Wochenreport freitags', x: 164, y: 348, b: 72 },
];
function strecke() {
  const H = 56;
  return `<figure class="strecke" data-strecke aria-label="Die Strecke im Vertrieb als Trichter in vier Stufen: Anfrage, Gespräch, Angebot, Abschluss">
      <div class="strecke-rahmen">
        <svg class="strecke-bild" viewBox="0 0 400 470" aria-hidden="true">
          ${STRECKE.slice(0, 3).map((s, i) => `<path class="strecke-faden" d="M200 ${s.y + H}V${STRECKE[i + 1].y}"/><path class="strecke-fluss" data-fluss="${i}" d="M200 ${s.y + H}V${STRECKE[i + 1].y}"/>`).join('\n          ')}
          ${STRECKE.slice(0, 3).map((s, i) => `<rect class="strecke-grund" data-grund="${i}" x="${s.x}" y="${s.y}" width="${s.b}" height="${H}" rx="${H / 2}"/><rect class="strecke-rand" data-rand="${i}" x="${s.x + 1}" y="${s.y + 1}" width="${s.b - 2}" height="${H - 2}" rx="${H / 2 - 1}"/><rect class="strecke-voll" data-voll="${i}" x="${s.x}" y="${s.y}" width="${s.b}" height="${H}" rx="${H / 2}"/>`).join('\n          ')}
          <circle class="strecke-ring" data-ring cx="200" cy="384" r="50"/>
          <circle class="strecke-grund" data-grund="3" cx="200" cy="384" r="36"/><circle class="strecke-rand" data-rand="3" cx="200" cy="384" r="35"/><circle class="strecke-voll strecke-ziel" data-voll="3" cx="200" cy="384" r="36"/>
        </svg>
        <ol class="strecke-stufen">
          ${STRECKE.map((s, i) => `<li class="strecke-stufe strecke-stufe-${i + 1}" data-stufe="${i}"><span class="strecke-name"><i>0${i + 1}</i><b>${s.name}</b></span><span class="strecke-lage"><span class="strecke-heute" data-lage-heute>Heute: ${s.heute}</span><span class="strecke-system" data-lage-system>${s.system}</span></span></li>`).join('\n          ')}
        </ol>
      </div>
    </figure>`;
}

function start(W) {
  const halte = [
    ['Anfrage', 'Ein Interessent von der Messe hat vor drei Wochen um ein Angebot gebeten. Der Entwurf liegt noch in Ihrem Postfach.', 'Jede Anfrage bekommt eine Stufe, eine nächste Aktion und ein Datum. So geht nichts verloren, und jeder im Team sieht, wo ein Kunde steht.'],
    ['Gespräch', 'Sie verkaufen selbst, zwischen zwei anderen Terminen. Neue Kunden kommen über Empfehlungen, aber nicht planbar.', 'Leitfäden geben jedem Gespräch eine Richtung: Welche Fragen klären Bedarf, Budget, Entscheidung und Zeitpunkt? Dazu gehören gute Antworten auf die häufigsten Einwände.'],
    ['Angebot', 'Ein Wettbewerber mit dem schwächeren Produkt bekommt den Auftrag, weil er schneller nachgefasst hat.', 'Das Angebot geht in 24 Stunden raus. Jedes offene Angebot hat ein Datum zum Nachfassen, zum Beispiel drei Werktage danach und noch einmal eine Woche später.'],
    ['Abschluss', 'Wie viele neue Kunden nächsten Monat kommen, kann niemand sagen. Es hängt an Empfehlungen und an Ihnen.', 'Vom Umsatzziel rückwärts gerechnet stehen Wochenziele fest. Jeden Freitag zeigt der Wochenreport, ob der Plan hält, und Ihr Team schließt selbst ab.'],
  ];
  const themen = THEMEN.map((t) => [t.pfad, t.titel, t.kurz, t.klein]);
  return `
<!-- Der Film-Einstieg: die Strecke von der Anfrage bis zum Abschluss in acht Szenen. Ohne JavaScript und mit „Bewegung reduzieren“
     stehen dieselben Inhalte ruhig untereinander (das ist der Normalfall im CSS); erst html.film-an macht daraus die Bühne. -->
<section class="film" id="film" data-film data-dunkelkopf aria-labelledby="held-titel">
  <div class="buehne dunkel">
    <div class="film-leiste">
      <p class="film-kapitel" aria-hidden="true"><b data-film-nr>01</b><span data-film-name>Einstieg</span></p>
      <span class="film-balken" aria-hidden="true"><i data-film-balken></i></span>
      <a class="film-weiter" href="#anfassen">Film überspringen</a>
    </div>

    <div class="szene szene-einstieg" data-szene="einstieg" data-kapitel="Einstieg">
      <p class="ueberzeile">MAKE Revenue</p>
      <h1 class="held-titel" id="held-titel">Ihr Produkt ist besser, als Ihr Umsatz <em>zeigt.</em> <span class="held-zusatz">Vertrieb mit System für Gründer, Mittelstand und Dienstleister.</span></h1>
      <p class="held-text">Wir bauen Ihren Vertrieb als System auf: Zielgruppe, Prozess im CRM, Kennzahlen und Nachfassen. Dann machen wir es vor und üben mit Ihrem Team, bis es selbst abschließt. Das Erstgespräch ist kostenlos.</p>
      <div class="held-aktionen">
        <a class="knopf knopf-gross" href="#erstgespraech" data-buchen>Erstgespräch vereinbaren</a>
        ${fam('check', 'Vertriebs-Check, 5 Minuten', { klasse: 'link-pfeil' })}
      </div>
    </div>

    ${strecke()}

    <div class="szene szene-zahl" data-szene="zahl" data-kapitel="Die Lage">
      <figure class="grosszahl">
        <b class="grosszahl-wert">36,3&nbsp;%</b>
        <figcaption><p class="grosszahl-satz">${e(ZAHL.ifo.satz).replace(/ %/g, '&nbsp;%')}</p>
        <cite class="zahl-quelle">Quelle: <a href="${e(ZAHL.ifo.link)}" rel="noopener">${e(ZAHL.ifo.quelle)}</a></cite></figcaption>
      </figure>
    </div>

    <div class="szene szene-heute" data-szene="heute" data-kapitel="Heute">
      <p class="ueberzeile">Heute</p>
      <h2 class="szene-titel">Wo es zwischen Anfrage und Abschluss <em>hängt.</em></h2>
      <p class="szene-text">Der Vertrieb liegt bei der Geschäftsführung und läuft nach Bauchgefühl. Anfragen gehen verloren, Angebote bleiben liegen. Wie viele Gespräche das Jahresziel braucht, weiß niemand.</p>
    </div>

${halte.map(([name, heute, system], i) => `    <div class="szene szene-stufe" data-szene="stufe-${i + 1}" data-kapitel="${name}">
      <p class="ueberzeile">Stufe ${i + 1} von 4</p>
      <h3 class="szene-titel">${name}</h3>
      <div class="szene-paar">
        <div class="paar-heute"><p class="paar-marke">Heute</p><p>${heute}</p></div>
        <div class="paar-system"><p class="paar-marke">Mit System</p><p>${system}</p></div>
      </div>
    </div>`).join('\n\n')}

    <div class="szene szene-ende" data-szene="ende" data-kapitel="Abschluss">
      <h2 class="szene-titel szene-titel-gross">Vertrieb ist kein Talent, sondern ein <em>System.</em></h2>
      <p class="szene-text">Wer angesprochen wird, was gesagt wird, was gemessen wird: Das bauen wir mit Ihnen auf, bis Ihr Team selbst abschließt.</p>
      <div class="held-aktionen">
        <a class="knopf knopf-gross" href="#erstgespraech" data-buchen>Erstgespräch vereinbaren</a>
        ${fam('check', 'Vertriebs-Check starten', { klasse: 'knopf knopf-gross knopf-leise' })}
      </div>
      <p class="szene-weiter"><a class="link-pfeil" href="systemvertrieb/">So bauen wir das System auf</a></p>
    </div>
  </div>
</section>

<section class="abschnitt" id="anfassen" aria-labelledby="anfassen-titel">
  <div class="w">
    ${abKopf('', 'So sieht Vertrieb mit System <em>aus.</em>', '', 'anfassen-titel')}
    ${stueck('01', 'Keine Anfrage bleibt ohne nächsten Schritt.', `<p>Ein Montag im CRM: acht Karten, jede mit Stufe, nächster Aktion und Datum. Bei einer fehlt die nächste Aktion. Das ist die Anfrage, die sonst liegen bleibt.</p>
        <p>Welches CRM Sie nutzen, ist zweitrangig. Wichtig ist, dass alle es gleich nutzen.</p>`, brett(), 'brett')}
    ${stueck('02', 'Jeden Freitag kommt der Wochenreport.', `<p>Vier Zahlen, Ist gegen Ziel, und ein Satz dazu, was nächste Woche anders läuft. Die Ist-Zahlen können Sie überschreiben.</p>`, report(W), 'wochenreport')}
    ${stueck('03', 'Jedes Gespräch folgt einem Leitfaden.', `<p>Einstieg, Bedarf, Einwand, nächster Schritt. Der Leitfaden gibt die Fragen vor, die Bedarf, Budget, Entscheidung und Zeitpunkt klären, dazu Antworten auf die häufigsten Einwände.</p>
        <p><a class="link-pfeil" href="systemvertrieb/#leitfaden">Den ganzen Leitfaden ansehen</a></p>`, leitfaden(), 'leitfaden')}
  </div>
</section>

<section class="abschnitt dunkel" id="zahlen" aria-labelledby="zahlen-titel">
  <div class="w">
    ${abKopf('', 'Was Studien 2026 über Vertrieb <em>zeigen.</em>', '', 'zahlen-titel')}
    <div class="zahlen-reihe">
      ${zahl(ZAHL.crm)}
      ${zahl(ZAHL.zeit)}
      ${zahl(ZAHL.umsatz)}
      ${zahl(ZAHL.nachfrage)}
    </div>
    <p class="zahlen-fuss">Alle Zahlen am Original geprüft am 30.10.2026.</p>
  </div>
</section>

<section class="abschnitt ton-2" id="themen" aria-labelledby="themen-titel">
  <div class="w">
    ${abKopf('Leistungen', 'Was wir für Sie <em>tun.</em>', '', 'themen-titel')}
    <ol class="themen-liste">
${themen.map(([pfad, titel, text, klein], i) => `      <li class="thema erscheint">
        <span class="thema-nr" aria-hidden="true">0${i + 1}</span>
        <div><h3 class="thema-titel"><a href="${pfad}">${titel}</a></h3></div>
        <p class="thema-text">${text}${klein ? `<small>${klein}</small>` : ''}</p>
        <span class="thema-pfeil" aria-hidden="true">${pfeil}</span>
      </li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt dunkel" id="rechner" aria-labelledby="rechner-titel">
  <div class="w">
    ${abKopf('Vertriebsrechner', 'Wie viele Termine braucht Ihr <em>Umsatzziel?</em>', 'Der Rechner geht vom Umsatzziel rückwärts bis zu den Erstkontakten je Woche. Ihre Eingaben bleiben in Ihrem Browser.', 'rechner-titel')}
    ${rechner()}
    <div class="rechner-fuss">
      <p>Ihre eigenen Quoten kennen Sie, wenn einige Wochen lang jedes Gespräch im CRM steht. Diesen Takt bauen wir als Head of Sales auf Zeit mit Ihnen auf.</p>
      <a class="link-pfeil" href="#wochenreport">Ihre Wochenziele im Wochenreport ansehen</a>
      <a class="link-pfeil" href="vertrieb-auf-zeit/">Vertrieb auf Zeit ansehen</a>
    </div>
  </div>
</section>

<section class="abschnitt" id="ablauf" aria-labelledby="ablauf-titel">
  <div class="w">
    ${abKopf('Ablauf', 'So kommen wir <em>zusammen.</em>', '', 'ablauf-titel')}
    <ol class="ablauf-liste">
      <li class="erscheint"><h3>Erstgespräch oder Check</h3><p>Kostenlos: 30 Minuten Erstgespräch per Video oder der Vertriebs-Check mit Ergebnis sofort.</p></li>
      <li class="erscheint erscheint-2"><h3>Ihr Vorschlag</h3><p>Wir schlagen Ihnen ein Angebot vor. Festpreis und Ablauf bekommen Sie schriftlich, bevor es losgeht.</p></li>
      <li class="erscheint erscheint-3"><h3>Tagesworkshop</h3><p>Ein Tag, an dem wir die größten Hebel finden und den ersten direkt umsetzen. Beim Start eines Mandats rechnen wir ihn voll an.</p></li>
      <li class="erscheint erscheint-4"><h3>Mandat</h3><p>Head of Sales oder Chief Sales Officer auf Zeit, für 6 oder 12 Monate. Erste Ergebnisse im ersten Monat.</p></li>
    </ol>
    <p class="fragen-fuss">${fam('innovation', 'Preise ansehen', { pfad: 'preise/', klasse: 'link-pfeil link-aussen' })}</p>
  </div>
</section>

<section class="satz-band" aria-labelledby="satz-titel">
  <div class="w satz-raster">
    <div>
      <h2 class="satz-gross" id="satz-titel">Wir schulden die Leistung, nicht den <em>Umsatz.</em></h2>
      <p class="satz-unter">Was wir zusagen, liefern wir. Im Mandat als Head of Sales heißt das: In Woche 8 bekommen Sie eine Zwischenbilanz mit Zahlen und Fahrplan. Ab Monat 3 läuft jedes Gespräch nach Prozess im CRM, und jeden Freitag kommt der Wochenreport mit Ihren Zahlen.</p>
    </div>
    ${filmplatz(W, 'handschlag')}
  </div>
</section>

<section class="abschnitt" id="wer" aria-labelledby="wer-titel">
  <div class="w">
    ${abKopf('Über uns', 'Wir kommen aus dem <em>Vertrieb.</em>', 'Wir haben selbst Vertriebsziele verantwortet und messen unsere Arbeit an Abschlüssen. Sie arbeiten direkt mit uns, Kevin und Malin, und nicht mit wechselnden Projektleitern.', 'wer-titel')}
    <div class="karten-2">
      <article class="karte erscheint">
        <span class="karte-kuerzel" aria-hidden="true">KD</span>
        <p class="karte-rolle">Vertrieb und Umsetzung</p>
        <h3 class="karte-titel">Kevin Dieckmann</h3>
        <p>Kevin hat Vertriebsteams geführt, Partnernetze aufgebaut und war Head of Sales bei einem FinTech. Er verantwortet Vertrieb und Umsetzung und arbeitet selbst in den Projekten mit, auch im internationalen Umfeld. Vertrieb verbindet er mit KI.</p>
      </article>
      <article class="karte erscheint erscheint-2">
        <span class="karte-kuerzel" aria-hidden="true">MA</span>
        <p class="karte-rolle">Bühne und Netzwerk</p>
        <h3 class="karte-titel">Malin</h3>
        <p>Malin ist Mitgründerin und Gastgeberin unserer Events. Sie verantwortet Bühne und Netzwerk und überlegt bei jeder Einladung, wer wen kennenlernen sollte.</p>
      </article>
    </div>
    <ul class="nicht-liste" aria-label="Was wir nicht sind">
      <li><b>Kein Callcenter</b><span>Ihr Team verkauft selbst, wir machen vor.</span></li>
      <li><b>Keine Folien-Beratung</b><span>Kein Konzept, das in der Schublade landet.</span></li>
      <li><b>Kein Inkubator</b><span>Wir vermitteln kein Kapital und leben nicht von Beteiligungen.</span></li>
      <li><b>Keine reine Werbe- oder PR-Agentur</b><span>Keine Kampagne und keine Pressemitteilung ohne Vertrieb dahinter.</span></li>
    </ul>
  </div>
</section>

<section class="abschnitt ton-2" id="familie" aria-labelledby="familie-titel">
  <div class="w">
    ${abKopf('Auch von uns', 'Wenn es nicht am Vertrieb <em>liegt.</em>', '', 'familie-titel')}
    <div class="karten-2">
      <article class="karte karte-familie familie-studios erscheint">
        <p class="familie-marke"><i class="familie-punkt" aria-hidden="true"></i><b>MAKE</b> <span>STUDIOS</span></p>
        <h3 class="karte-titel">Es kommen zu wenige Anfragen?</h3>
        <p>Ein Vertriebssystem braucht Anfragen, die es verfolgen kann. Wenn Sie online kaum gefunden werden, hilft MAKE Studios mit Website, Google-Profil, Video und Social Media.</p>
        ${fam('studios', 'Zu MAKE Studios', { klasse: 'link-pfeil link-aussen' })}
      </article>
      <article class="karte karte-familie familie-innovation erscheint erscheint-2">
        <p class="familie-marke"><i class="familie-punkt" aria-hidden="true"></i><b>MAKE</b> <span>INNOVATION</span></p>
        <h3 class="karte-titel">Angebote und Protokolle kosten zu viel Zeit?</h3>
        <p>Protokolle, Angebote und Nachfassen kann KI vorbereiten. MAKE Innovation führt KI, bessere Abläufe und eigene Software in Unternehmen ein.</p>
        ${fam('innovation', 'Zu MAKE Innovation', { klasse: 'link-pfeil link-aussen' })}
      </article>
    </div>
  </div>
</section>

<section class="abschnitt" id="fragen" aria-labelledby="fragen-titel">
  <div class="w">
    ${abKopf('Fragen', 'Was Entscheider uns zuerst <em>fragen.</em>', '', 'fragen-titel')}
    ${fragenListe(fr('erstgespraech', 'gespraeche', 'crm', 'preise', 'wer'))}
    <p class="fragen-fuss"><a class="link-pfeil" href="fragen/">Alle Fragen und Antworten</a></p>
  </div>
</section>
${kontakt(W, { schritte: false })}`;
}

// ─────────────── Digitaler Systemvertrieb ───────────────
function systemvertrieb(W) {
  const bausteine = [
    ['Fundament', 'zuerst', 'Zielgruppe mit wenigen Personas und einer Einteilung der Kontakte in A, B und C. Botschaft in einem Satz, Salesprozess mit Stufen im CRM, Gesprächsleitfäden und gute Antworten auf die häufigsten Einwände.'],
    ['Leadgenerierung', '', 'Bestandskunden reaktivieren als erster schneller Erfolg, Kanäle ans CRM anbinden, Empfehlungsprogramm, Erstansprache in festen Schritten, Events.'],
    ['Prozesse', '', 'Wiedervorlagen statt Verlust, Angebot in 24 Stunden, ein fester Vertriebsrhythmus mit Wochen-Call.'],
    ['Kennzahlen', '', 'Rückwärtsrechnung vom Umsatzziel, Wochenreport jeden Freitag, Kennzahlen je Kanal und je Person.'],
    ['Befähigen', '', 'Einarbeitung in festen Stationen, Rollenspiele vor dem ersten echten Gespräch und gemeinsame Nachbesprechung echter Gespräche. Am Ende steht das Sales Playbook: das Nachschlagewerk für jeden im Vertrieb.'],
  ];
  const fuenf = [
    ['Angebote im Monat', 'Wie viele schriftliche Angebote mit Preis und Datum gehen raus? Die Zahl zeigt, ob genug in Ihren Vertrieb hineinkommt.'],
    ['Abschlussquote', 'Der Anteil Ihrer Angebote, aus denen ein Auftrag wird. Gezählt werden nur entschiedene Angebote.'],
    ['Zeit bis zum Abschluss', 'Wie viele Tage liegen zwischen dem ersten Gespräch und dem unterschriebenen Auftrag? Die Zahl hilft beim Planen.'],
    ['Offene Chancen mit Wert', 'Jede Chance mit erwartetem Auftragswert, Stufe und Datum des nächsten Schritts. Die Summe der Werte ist Ihre Pipeline.'],
    ['Nachfassen', 'Hat jedes offene Angebot ein Datum, an dem Sie nachfragen? Zählen Sie jede Woche die offenen Angebote ohne dieses Datum. Das Ziel ist null.'],
  ];
  return `${seitenKopf(W, {
    krume: 'Digitaler Systemvertrieb',
    titel: 'Digitaler Systemvertrieb: Vertrieb, der nicht an Ihnen <em>hängt.</em>',
    text: 'Vertrieb ist kein Talent, sondern ein System: wer angesprochen wird, was gesagt wird, was gemessen wird. Wir bauen es mit Ihnen auf, mit einem festen Ablauf im CRM und wenigen Zahlen, die jede Woche auf dem Tisch liegen.',
    aktionen: `<a class="knopf knopf-gross" href="../#erstgespraech" data-buchen="systemvertrieb">Erstgespräch vereinbaren</a>${fam('check', 'Vertriebs-Check, 5 Minuten', { klasse: 'link-pfeil' })}`,
    vorweg: thema('systemvertrieb').vorweg,
    fakten: [['Für wen', 'Gründer, Mittelstand und Dienstleister im B2B, deren Vertrieb an der Geschäftsführung hängt'], ['Ergebnis', 'Pipeline im CRM, Wochenreport, feste Rollen und ein Sales Playbook, das bleibt'], ['Einstieg', 'Vertriebs-Check oder Erstgespräch, beides kostenlos']],
    film: 'arbeit',
  })}

<section class="abschnitt" aria-labelledby="was-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <h2 class="abschnitt-titel" id="was-titel">Was ist digitaler <em>Systemvertrieb?</em></h2>
      <p class="abschnitt-text">Digitaler Systemvertrieb ist Vertrieb nach einem festen Ablauf im CRM statt nach Bauchgefühl. Jede Anfrage hat eine Stufe, eine nächste Aktion und ein Datum, und wenige Kennzahlen zeigen jede Woche, ob der Plan hält.</p>
    </div>
    <div>
      <div class="fliess">
        <h3>Die Ausgangslage</h3>
        <p>Am Anfang verkauft der Gründer selbst. Das ist richtig, denn niemand kennt das Produkt besser. Schwierig wird es, wenn es so bleibt: Dann hängt jeder Abschluss an einer Person, Anfragen bleiben liegen, Angebote gehen zu spät raus, und niemand weiß, wie viele Gespräche es für das Jahresziel braucht.</p>
        <h3>Was daran digital ist</h3>
      </div>
      ${punkte([
        '<b>Ein Ort für alles.</b> Kontakte, Gespräche, Angebote und nächste Schritte stehen im CRM, nicht in Postfächern und Köpfen.',
        '<b>Kanäle sind angebunden.</b> Was über Website, Empfehlungen und Events hereinkommt, landet im selben Ablauf.',
        '<b>Zahlen kommen jede Woche.</b> Der Wochenreport zeigt jeden Freitag, ob der Plan hält.',
        '<b>KI bereitet vor.</b> Protokolle, Angebote und Nachfassen kann KI vorbereiten. Verkaufen bleibt Sache Ihres Teams.',
      ])}
      <div class="kaesten-2 abstand-oben">
        <div class="kasten kasten-dunkel dunkel">${zahl(ZAHL.crm)}</div>
        <div class="kasten kasten-dunkel dunkel">${zahl(ZAHL.systeme)}</div>
      </div>
    </div>
  </div>
</section>

<section class="abschnitt ton-2" id="bausteine" aria-labelledby="bausteine-titel">
  <div class="w">
    ${abKopf('Aufbau', 'Woraus besteht ein Vertrieb mit <em>System?</em>', 'Aus fünf Bausteinen, und die Reihenfolge zählt. Wer mit einem neuen Werkzeug oder dem ersten Vertriebler anfängt, hat noch nichts, worauf beides aufsetzen kann.', 'bausteine-titel')}
    <ol class="bausteine">
${bausteine.map(([name, klein, text]) => `      <li class="baustein erscheint"><h3>${name}${klein ? `<small>${klein}</small>` : ''}</h3><p>${text}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt" id="prozess" aria-labelledby="prozess-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <h2 class="abschnitt-titel" id="prozess-titel">Was gehört in den Prozess im <em>CRM?</em></h2>
      <p class="abschnitt-text">Jede Anfrage bekommt eine Stufe, eine nächste Aktion und ein Datum. So geht nichts verloren, und jeder im Team sieht, wo ein Kunde steht. Welches CRM Sie nutzen, ist zweitrangig. Wichtig ist, dass alle es gleich nutzen.</p>
    </div>
    <div>
      ${punkte(['Stufen vom Erstkontakt bis zum Abschluss', 'Pflichtfelder für alles, was später ausgewertet wird', 'eine Wiedervorlage für jede offene Anfrage', 'ein fester Standard für Gesprächsnotizen', 'ein Ziel für die Zeit bis zum Angebot, zum Beispiel 24 Stunden'])}
      <div class="fliess abstand-oben">
        <h3>Nachfassen braucht einen festen Termin</h3>
        <p>Ein Angebot ohne Nachfrage bleibt liegen, auch wenn der Kunde eigentlich will: Entscheidungen werden verschoben, Postfächer laufen voll. Legen Sie deshalb fest, wann nachgefasst wird, zum Beispiel drei Werktage nach dem Angebot und noch einmal eine Woche später.</p>
      </div>
    </div>
  </div>
  <div class="w abstand-gross" id="brett">
    <div class="stueck-kopf">
      <h3 class="stueck-titel">Der Prozess als Brett mit vier Stufen.</h3>
      <p>Eine der acht Karten hat noch keine nächste Aktion. Solche Anfragen bleiben sonst liegen.</p>
    </div>
    ${brett()}
  </div>
</section>

<section class="abschnitt" id="leitfaden" aria-labelledby="leitfaden-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <h2 class="abschnitt-titel" id="leitfaden-titel">Wie sieht ein Gesprächsleitfaden <em>aus?</em></h2>
      <p class="abschnitt-text">Leitfäden geben jedem Gespräch eine Richtung: Welche Fragen klären Bedarf, Budget, Entscheidung und Zeitpunkt? Dazu gehört eine Sammlung der häufigsten Einwände mit guten Antworten.</p>
      <p class="abschnitt-text">Neue Vertriebler üben damit im Rollenspiel, bevor sie das erste echte Gespräch führen.</p>
    </div>
    ${leitfaden({ voll: true })}
  </div>
</section>

<section class="abschnitt ton-2" id="kennzahlen" aria-labelledby="kennzahlen-titel">
  <div class="w">
    ${abKopf('Kennzahlen', 'Wie viele Termine braucht Ihr <em>Umsatzziel?</em>', 'Rechnen Sie vom Umsatzziel rückwärts: Wie viele Abschlüsse brauchen Sie, wie viele Angebote führen dahin, wie viele Termine braucht es dafür? Daraus werden Wochenziele, die jeder versteht.', 'kennzahlen-titel')}
    <div class="kaesten-2">
      <div class="kasten erscheint">
        <table class="tafel tafel-zahl tafel-karten">
          <caption>Rechenbeispiel</caption>
          <thead><tr><th scope="col">Schritt</th><th scope="col">Rechnung</th><th scope="col">Ergebnis</th></tr></thead>
          <tbody>
            <tr><th scope="row">Umsatzziel im Jahr</th><td data-spalte="Rechnung">angenommen</td><td data-spalte="Ergebnis">240.000&nbsp;€</td></tr>
            <tr><th scope="row">Abschlüsse</th><td data-spalte="Rechnung">240.000&nbsp;€ ÷ 8.000&nbsp;€ je Auftrag</td><td data-spalte="Ergebnis">30</td></tr>
            <tr><th scope="row">Angebote</th><td data-spalte="Rechnung">jedes dritte Angebot wird ein Auftrag</td><td data-spalte="Ergebnis">90</td></tr>
            <tr><th scope="row">Termine</th><td data-spalte="Rechnung">aus jedem zweiten Termin wird ein Angebot</td><td data-spalte="Ergebnis">180</td></tr>
            <tr><th scope="row">Je Woche</th><td data-spalte="Rechnung">180 Termine ÷ 45 Arbeitswochen</td><td data-spalte="Ergebnis">4 Termine</td></tr>
          </tbody>
        </table>
        <p class="tafel-fuss">Ihre eigenen Quoten kennen Sie, wenn einige Wochen lang jedes Gespräch im CRM steht.</p>
        <a class="link-pfeil" href="../#rechner">Mit eigenen Werten rechnen</a>
      </div>
      ${report(W)}
    </div>
  </div>
</section>

<section class="abschnitt" id="zahlen" aria-labelledby="fuenf-titel">
  <div class="w">
    ${abKopf('', 'Welche Vertriebszahlen braucht ein kleines <em>Unternehmen?</em>', 'Fünf Zahlen reichen, um einen kleinen Vertrieb zu steuern. Ein teures Werkzeug braucht es dafür nicht: Eine Tabelle genügt, wenn sie gepflegt und jede Woche besprochen wird.', 'fuenf-titel')}
    <ol class="bausteine">
${fuenf.map(([name, text]) => `      <li class="baustein erscheint"><h3>${name}</h3><p>${text}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt ton-2" id="fehler" aria-labelledby="fehler-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <h2 class="abschnitt-titel" id="fehler-titel">Welche Fehler machen Vertrieb <em>unplanbar?</em></h2>
      <p class="abschnitt-text">Meist liegt es an der Reihenfolge.</p>
    </div>
    <div>
      ${punkte(['Erst das Werkzeug kaufen, dann über den Prozess nachdenken.', 'Den ersten Vertriebler einstellen, bevor es ein System gibt, in das er einsteigen kann.', 'Zwanzig Kennzahlen messen und keine davon besprechen.', 'Alle ansprechen statt der Kontakte, die am besten passen.', 'Angebote ohne Wiedervorlage verschicken und auf eine Antwort warten.'], 'punkte-nicht')}
      <div class="fliess abstand-oben">
        <h3>Selbst aufbauen oder Hilfe holen?</h3>
        <p>Vieles davon können Sie selbst anstoßen. Hilfe lohnt sich, wenn der Gründer nicht mehr zum Produkt kommt, wenn neue Vertriebler nicht ankommen oder wenn seit Monaten niemand sagen kann, wie viele Gespräche es für das Ziel braucht.</p>
        <p>Für einen ersten Blick reicht ein Tag: Im Tagesworkshop finden wir die größten Hebel und setzen den ersten direkt um. Soll jemand den Vertrieb aufbauen und führen, bis Ihr Team selbst abschließt, ist ein Head of Sales auf Zeit der nächste Schritt.</p>
        <p><a class="link-pfeil" href="../vertrieb-auf-zeit/">Vertrieb auf Zeit: Tagesworkshop, Head of Sales, Chief Sales Officer</a></p>
      </div>
    </div>
  </div>
</section>

<section class="abschnitt" id="begriffe" aria-labelledby="begriffe-titel">
  <div class="w">
    ${abKopf('Begriffe', 'Zehn Begriffe aus dem Vertrieb, kurz <em>erklärt.</em>', '', 'begriffe-titel')}
    <dl class="begriffe">
${BEGRIFFE.map(([n, t]) => `      <div><dt>${n}</dt><dd>${t}</dd></div>`).join('\n')}
    </dl>
  </div>
</section>

<section class="abschnitt ton-2" id="fragen" aria-labelledby="fragen-titel">
  <div class="w">
    ${abKopf('Fragen', 'Häufige Fragen zum <em>Systemvertrieb.</em>', '', 'fragen-titel')}
    ${fragenListe(fr('ersterVertriebler', 'welchesCrm', 'kennzahlen', 'planbar', 'tabelle'))}
    ${autor()}
  </div>
</section>
${kontakt(W, { thema: 'systemvertrieb' })}`;
}

// ─────────────── Vertrieb auf Zeit ───────────────
function vertriebAufZeit(W) {
  const monate = [
    ['Monat 1', 'Ankommen und analysieren', 'Ergebnisbild, ein erster schneller Erfolg aus Ihrem Kundenbestand'],
    ['Monat 2', 'Fundament bauen', 'Zielgruppe, Prozess im CRM, Skripte, Zahlen, Zwischenbilanz in Woche 8'],
    ['Monat 3', 'Live gehen', 'Team trainiert, Wochenreport jeden Freitag'],
    ['Monat 4 bis 5', 'Hebel umsetzen', 'die zwei, drei Module mit der größten Wirkung'],
    ['Monat 6', 'Übergeben', 'Vertrieb ohne Gründer, Sales Playbook Teil 2, Abschlussbericht'],
  ];
  const vergleich = [
    ['Fundament: Zielgruppe, Salesprozess im CRM, Skripte und Einwandbibliothek', 1],
    ['Ein erster schneller Erfolg aus Ihrem Kundenbestand ab Monat 1', 1],
    ['Leadgenerierung, Prozesse und KPIs nach dem größten Hebel', 1],
    ['Wochenreport jeden Freitag ab Monat 3', 1],
    ['Rollenspiele, Call-Reviews und Onboarding für Ihr Team', 1],
    ['Sales Playbook Teil 1 und 2', 1],
    ['Strategie, Go-to-Market und Preislogik', 0],
    ['Rollen, Vergütung und Recruiting', 0],
    ['Führung von bis zu 10 Vertrieblern', 0],
    ['Monatliche Produkt-Runde mit Kundenstimmen', 0],
    ['Partnerschaften und Skalierung, Intros aus unserem Netzwerk nach 6 Monaten', 0],
    ['Sales Playbook Teil 3 und Übergabeplan an Ihre Vertriebsleitung', 0],
  ];
  const fest = [
    ['Start', 'nach dem Kick-off', 'nach Suche, Auswahl und Kündigungsfrist'],
    ['Bindung', '6 oder 12 Monate', 'unbefristeter Arbeitsvertrag'],
    ['Kosten', 'fester Monatspreis, Reisekosten nach Absprache gegen Beleg', 'Gehalt, Nebenkosten, Suche und Einarbeitung'],
    ['Ziel', 'System aufbauen und übergeben', 'Vertrieb dauerhaft führen'],
    ['Danach', 'Playbook, Leitfäden und Prozesse bleiben bei Ihnen', 'die Leitung bleibt im Unternehmen'],
  ];
  return `${seitenKopf(W, {
    krume: 'Vertrieb auf Zeit',
    titel: 'Vertrieb auf Zeit: Head of Sales oder Chief Sales Officer für 6 oder 12 <em>Monate.</em>',
    text: 'Auch Interim oder Fractional Head of Sales genannt. Wir bauen das System, setzen es mit Ihrem Team um und übergeben es so, dass es ohne uns weiterläuft.',
    aktionen: `<a class="knopf knopf-gross" href="../#erstgespraech" data-buchen="zeit">Erstgespräch vereinbaren</a><a class="link-pfeil" href="#tagesworkshop">Erst testen: der Tagesworkshop</a>`,
    vorweg: thema('zeit').vorweg,
    fakten: [['Laufzeit', '6 oder 12 Monate'], ['Einstieg', 'Tagesworkshop Vertrieb, wird beim Start eines Mandats voll angerechnet'], ['Preis', `Festpreis, schriftlich vor dem Start · ${fam('innovation', 'Preise ansehen', { pfad: 'preise/' })}`]],
    film: 'gespraech',
  })}

<section class="abschnitt ton-2" id="angebote" aria-labelledby="angebote-titel">
  <div class="w">
    ${abKopf('Angebote', 'Welcher Vertrieb auf Zeit passt zu <em>Ihnen?</em>', '', 'angebote-titel')}
    <div class="kaesten-3">
      <article class="kasten erscheint">
        <p class="karte-rolle">Ein Tag</p>
        <h3>Tagesworkshop Vertrieb</h3>
        <p>Ein Tag, an dem Sie erfahren, wo Ihr größter Hebel in Vertrieb, Markteintritt und Sichtbarkeit liegt. Mit einem Plan für 90 Tage.</p>
        ${punkte(['Gründer und Unternehmer, die wissen wollen, wo der größte Hebel liegt, bevor sie investieren', 'Teams, deren Vertrieb wächst, aber nicht planbar läuft'])}
      </article>
      <article class="kasten erscheint erscheint-2">
        <p class="karte-rolle">6 oder 12 Monate</p>
        <h3>Head of Sales auf Zeit</h3>
        <p>Wir bauen Ihnen einen Vertrieb mit System, den Ihr Team ohne Sie bedienen kann.</p>
        ${punkte(['Unternehmer mit fertigem Produkt und 10 bis 50 Mitarbeitenden', 'Tech, KI, FinTech, innovative Dienstleister und Handwerk, Gesundheit, Sport, Ernährung', 'Firmen, deren Vertrieb heute am Gründer hängt oder ohne System läuft'])}
      </article>
      <article class="kasten erscheint erscheint-3">
        <p class="karte-rolle">6 oder 12 Monate</p>
        <h3>Chief Sales Officer auf Zeit</h3>
        <p>Wir führen Ihren Vertrieb wie ein Vertriebsvorstand auf Zeit: Strategie, Preis, Team und Wachstum, bis Ihre eigene Vertriebsleitung übernimmt.</p>
        ${punkte(['Firmen, die ein Vertriebsteam aufbauen oder vergrößern wollen', 'Firmen vor Markteintritt, neuem Markt, neuem Produkt oder neuer Preisstrategie', 'Firmen, die mit Partnern oder in neue Regionen wachsen wollen'])}
      </article>
    </div>
  </div>
</section>

<section class="abschnitt" id="ablauf" aria-labelledby="monate-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <p class="ueberzeile">Head of Sales auf Zeit</p>
      <h2 class="abschnitt-titel" id="monate-titel">Wie laufen die sechs Monate <em>ab?</em></h2>
      <p class="abschnitt-text">Jeder Monat hat ein Ergebnis, das Sie sehen können. Ab Monat 3 läuft jedes Gespräch nach Prozess im CRM und ist dokumentiert. Ziel bis Monat 6: Ihr Team erreicht die Terminzahl aus der Rückwärtsrechnung und schließt ohne Sie ab.</p>
    </div>
    <div>
      <ol class="monate">
${monate.map(([m, was, ergebnis]) => `        <li class="monat erscheint"><span class="monat-nr">${m}</span><b>${was}</b><span>${ergebnis}</span></li>`).join('\n')}
      </ol>
      <p class="tafel-fuss">Bei 12 Monaten: Monate 7 bis 9 ausbauen, Monate 10 bis 12 skalieren oder an die interne Vertriebsleitung übergeben.</p>
      <div class="kasten kasten-dunkel dunkel abstand-oben">
        <h3>Wir schulden die Leistung, nicht den Umsatz.</h3>
        <p>Was wir zusagen, liefern wir. In Woche 8 bekommen Sie eine Zwischenbilanz mit Zahlen und Fahrplan. Was entsteht, dürfen Sie nach Zahlung weiter nutzen.</p>
      </div>
    </div>
  </div>
</section>

<section class="abschnitt ton-2" id="vergleich" aria-labelledby="vergleich-titel">
  <div class="w">
    ${abKopf('', 'Head of Sales oder Chief Sales <em>Officer?</em>', 'Der Head of Sales baut und führt Ihren Vertrieb: Zielgruppe, Prozess im CRM, Skripte, Kennzahlen und Training. Der Chief Sales Officer macht all das auch und verantwortet dazu Strategie, Preise, Teamaufbau, Recruiting und Partnerschaften. Sie können jederzeit zum Chief Sales Officer wechseln.', 'vergleich-titel')}
    <table class="tafel tafel-karten">
      <caption>Leistungen von Head of Sales und Chief Sales Officer im Vergleich</caption>
      <thead><tr><th scope="col">Leistung</th><th scope="col">Head of Sales</th><th scope="col">Chief Sales Officer</th></tr></thead>
      <tbody>
${vergleich.map(([name, hos]) => `        <tr><th scope="row">${name}</th><td data-spalte="Head of Sales" class="${hos ? 'ja' : 'nein'}">${hos ? 'enthalten' : 'nicht enthalten'}</td><td data-spalte="Chief Sales Officer" class="ja">enthalten</td></tr>`).join('\n')}
      </tbody>
    </table>
    <p class="tafel-fuss">Der Chief Sales Officer bringt 30 bis 35 Stunden im Monat ein, fest eingeplant. Keine Personalvermittlung, keine Anlage- oder Kapitalvermittlung, keine Arbeits-, Steuer- oder Rechtsberatung.</p>
  </div>
</section>

<section class="abschnitt" id="fest" aria-labelledby="fest-titel">
  <div class="w">
    ${abKopf('', 'Auf Zeit oder fest <em>einstellen?</em>', 'Eine feste Vertriebsleitung lohnt sich, wenn das System steht und es vor allem um Führung und Wachstum geht. Jemanden auf Zeit holen Sie, wenn das System erst entstehen muss.', 'fest-titel')}
    <table class="tafel tafel-karten">
      <caption>Head of Sales auf Zeit und feste Vertriebsleitung im Vergleich</caption>
      <thead><tr><th scope="col">Kriterium</th><th scope="col">Head of Sales auf Zeit</th><th scope="col">Feste Vertriebsleitung</th></tr></thead>
      <tbody>
${fest.map(([k, a, b]) => `        <tr><th scope="row">${k}</th><td data-spalte="Auf Zeit">${a}</td><td data-spalte="Fest">${b}</td></tr>`).join('\n')}
      </tbody>
    </table>
    <div class="kaesten-2 abstand-gross">
      <div class="kasten">
        <h3>Woran Sie ein gutes Mandat erkennen</h3>
        ${punkte(['Es gibt feste Ergebnisse mit Terminen, nicht nur Stunden.', 'Ihr Team führt die Gespräche, die Vertriebsleitung auf Zeit macht vor.', 'Die Zahlen kommen jede Woche, nicht erst am Ende.', 'Vorlagen, Leitfäden und Playbook dürfen Sie danach dauerhaft nutzen.', 'Nach acht Wochen gibt es eine Zwischenbilanz mit Zahlen und Fahrplan.'])}
      </div>
      <div class="kasten">
        <h3>Ihr Vertriebsleiter kommt nicht in Fahrt?</h3>
        <p>Meist fehlt ihm ein System, nach dem er führen kann. Das bauen wir mit ihm auf, arbeiten ihn ein und übergeben ihm dann den Vertrieb. Danach hängt der Vertrieb nicht mehr an der Geschäftsführung.</p>
        <h3 class="abstand-oben">Was wir von Ihnen brauchen</h3>
        ${punkte(['Zugänge zu CRM, Kalender und Zahlen innerhalb von 5 Werktagen nach dem Kick-off', 'einen festen Ansprechpartner mit Entscheidungsbefugnis', 'Teilnahme am wöchentlichen Vertriebs-Call (30 Minuten)', 'Ihr Team führt die Gespräche selbst, wir machen vor.'])}
      </div>
    </div>
  </div>
</section>

<section class="abschnitt dunkel" id="tagesworkshop" aria-labelledby="workshop-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <p class="ueberzeile">Tagesworkshop Vertrieb</p>
      <h2 class="abschnitt-titel" id="workshop-titel">Was bringt der <em>Tagesworkshop?</em></h2>
      <p class="abschnitt-text">Am Abend kennen Sie Ihre fünf größten Hebel, bewertet nach Aufwand und Wirkung. Sie haben einen 90-Tage-Plan und wissen, ob Sie ein Markt- oder ein Produktproblem haben. Ein Hebel ist schon umgesetzt.</p>
      <a class="knopf" href="../#erstgespraech" data-buchen="workshop">Tagesworkshop anfragen</a>
    </div>
    <div>
      <ol class="monate">
        <li class="monat"><span class="monat-nr">Vorab</span><b>Fokus wählen</b><span>Sie wählen den Fokus: eher Strategie oder eher operativ.</span></li>
        <li class="monat"><span class="monat-nr">Vormittag</span><b>Lage, Zahlen und Kunden</b><span>Wir ordnen ein, ob Sie ein Markt- oder ein Produktproblem haben.</span></li>
        <li class="monat"><span class="monat-nr">Nachmittag</span><b>Hebel bewerten</b><span>Nach Aufwand und Wirkung. Einen davon setzen wir direkt gemeinsam um.</span></li>
        <li class="monat"><span class="monat-nr">Danach</span><b>Protokoll und Plan</b><span>Protokoll mit Ihren Top 5 und Ihr 90-Tage-Plan, schriftlich.</span></li>
      </ol>
      ${punkte(['Ziel des Tages sind drei Hebel, die Sie sofort umsetzen können.', 'Starten Sie danach mit dem Head of Sales oder dem Chief Sales Officer, rechnen wir den Workshop voll an.', 'Sie bringen mit: einen Tag Zeit ohne Unterbrechung und Ihre Vertriebszahlen der letzten Monate, soweit vorhanden.'], 'abstand-oben')}
    </div>
  </div>
</section>

<section class="abschnitt" id="fragen" aria-labelledby="fragen-titel">
  <div class="w">
    ${abKopf('Fragen', 'Häufige Fragen zum Vertrieb auf <em>Zeit.</em>', '', 'fragen-titel')}
    ${fragenListe(fr('gespraeche', 'crm', 'zeitaufwand', 'playbooks', 'laufzeit', 'csoZeit', 'einstellen', 'ende', 'nichtPassend'))}
    ${autor()}
  </div>
</section>
${kontakt(W, { thema: 'zeit' })}`;
}

// ─────────────── Netzwerken und Events ───────────────
function netzwerken(W) {
  const formate = [
    ['Gesprächsrunde', 'Ein kleiner Kreis spricht offen über ein Thema, das gerade viele beschäftigt. Was gesagt wird, bleibt im Raum, und jeder kommt zu Wort.'],
    ['Impulsabend', 'Kurze Beiträge aus der Praxis: Wer Neues umgesetzt hat, zeigt, was funktioniert hat und was nicht. Danach ist Zeit für Gespräche.'],
    ['Workshop', 'In wenigen Stunden arbeiten Sie an einem Thema und nehmen ein Ergebnis mit, etwa zu KI im Alltag, zur eigenen Positionierung oder zum Vertrieb.'],
    ['Treffen im Netzwerk', 'Wir stellen Unternehmen Menschen aus unserem Netzwerk vor, die zu ihrer Aufgabe passen.'],
  ];
  const merkmale = [
    ['Auf Einladung', 'Die Gästeliste stellen wir selbst zusammen: Start-ups neben Mittelständlern, Technik neben Vertrieb.'],
    ['Persönlich', 'Kleine Runden mit einem Thema statt Messehalle. So kommen Sie mit den Menschen ins Gespräch, die für Sie zählen.'],
    ['Verbindend', 'Wir achten darauf, wer zu wem passt, und verbinden die Richtigen nach dem Event.'],
  ];
  return `${seitenKopf(W, {
    krume: 'Netzwerken und Events',
    titel: 'Netzwerken und Events in kleiner <em>Runde.</em>',
    text: 'Abende auf Einladung, mit Gründerinnen und Gründern, Mittelständlern und Machern aus KI und Technik. Gastgeberin ist Malin.',
    aktionen: `${fam('innovation', 'Einladung erhalten', { pfad: 'events/', klasse: 'knopf knopf-gross' })}<a class="link-pfeil" href="#vertrieb">Wie daraus Vertrieb wird</a>`,
    vorweg: thema('netzwerken').vorweg,
    fakten: [['Kosten', 'Für Gäste kostenlos'], ['Zugang', 'Auf Einladung, über die Gästeliste'], ['Termine', 'stehen mit Ort und Format in jeder Einladung']],
    film: 'runde',
  })}

<section class="abschnitt dunkel" id="formate" aria-labelledby="formate-titel">
  <div class="w">
    ${abKopf('Formate', 'Welche Formate gibt es bei den <em>Events?</em>', 'Diese vier Formate planen wir. Welches wann stattfindet, steht in der Einladung.', 'formate-titel')}
    <ol class="formate">
${formate.map(([n, t], i) => `      <li class="format erscheint${i ? ` erscheint-${i + 1}` : ''}"><h3>${n}</h3><p>${t}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt" id="art" aria-labelledby="art-titel">
  <div class="w">
    ${abKopf('', 'Was Sie an einem Abend <em>erwartet.</em>', '', 'art-titel')}
    <div class="karten-3">
${merkmale.map(([n, t], i) => `      <article class="karte erscheint${i ? ` erscheint-${i + 1}` : ''}"><p class="karte-rolle">0${i + 1}</p><h3 class="karte-titel">${n}</h3><p>${t}</p></article>`).join('\n')}
    </div>
  </div>
</section>

<section class="abschnitt ton-2" id="vertrieb" aria-labelledby="nv-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <h2 class="abschnitt-titel" id="nv-titel">Wie wird aus Netzwerken <em>Vertrieb?</em></h2>
      <p class="abschnitt-text">Indem jede Begegnung denselben Weg nimmt wie jede andere Anfrage: Sie bekommt eine Stufe, eine nächste Aktion und ein Datum. Neue Kunden kommen oft über Empfehlungen, aber nicht planbar. Das lässt sich ändern.</p>
      <a class="link-pfeil" href="../systemvertrieb/">Digitaler Systemvertrieb</a>
    </div>
    <div>
      ${punkte([
        '<b>Kontakte nachfassen.</b> Kontakte von Messe und Event gehören in die Wiedervorlage im CRM, nicht ins Postfach.',
        '<b>Empfehlungen planbar machen.</b> Ein Empfehlungsprogramm gehört zur Leadgenerierung, genauso wie Events.',
        '<b>Partnerschaften aufbauen.</b> Im Mandat als Chief Sales Officer gehören strategische Partner und Testmärkte dazu.',
      ])}
      <div class="kasten kasten-dunkel dunkel abstand-oben">${zahl(ZAHL.startup)}</div>
    </div>
  </div>
</section>

<section class="abschnitt" id="gastgeberin" aria-labelledby="gast-titel">
  <div class="w">
    ${abKopf('Gastgeberin', 'Malin bringt Menschen <em>zusammen.</em>', 'Malin ist Mitgründerin und Gastgeberin unserer Events. Sie verantwortet Bühne und Netzwerk und überlegt bei jeder Einladung, wer wen kennenlernen sollte.', 'gast-titel')}
    <p class="fragen-fuss">${fam('innovation', 'Auf die Gästeliste', { pfad: 'events/', klasse: 'link-pfeil link-aussen' })}</p>
  </div>
</section>

<section class="abschnitt ton-2" id="fragen" aria-labelledby="fragen-titel">
  <div class="w">
    ${abKopf('Fragen', 'Häufige Fragen zu Netzwerken und <em>Events.</em>', '', 'fragen-titel')}
    ${fragenListe(fr('eventKosten', 'eventEinladung', 'eventGaeste'))}
    ${autor()}
  </div>
</section>
${kontakt(W, { thema: 'netzwerk' })}`;
}

// ─────────────── Vertriebs-Check ───────────────
function vertriebsCheck(W) {
  return `${seitenKopf(W, {
    krume: 'Vertriebs-Check',
    titel: 'Der Vertriebs-Check zeigt, wie planbar Ihr Vertrieb <em>ist.</em>',
    text: 'Zwölf Fragen zu Organisation, Zahlen und Neukunden, dazu zwei in Ihren eigenen Worten. Sie sehen sofort, wo Ihr Vertrieb steht und welcher Schritt jetzt am meisten bringt.',
    aktionen: `${fam('check', 'Vertriebs-Check starten', { klasse: 'knopf knopf-gross' })}<a class="link-pfeil" href="../#erstgespraech" data-buchen>Lieber gleich sprechen</a>`,
    vorweg: thema('check').vorweg,
    fakten: [['Danach', 'auf Wunsch 30 Minuten Erstgespräch per Video, ebenfalls kostenlos']],
  })}

<section class="abschnitt ton-2" id="bereiche" aria-labelledby="bereiche-titel">
  <div class="w">
    ${abKopf('', 'Was fragt der <em>Vertriebs-Check?</em>', 'Zum Schluss kommen zwei Fragen, die Sie in eigenen Worten beantworten.', 'bereiche-titel')}
    <div class="karten-3">
      <article class="karte erscheint"><p class="karte-rolle">01</p><h3 class="karte-titel">Organisation</h3><p>Gibt es einen festen Ablauf?</p></article>
      <article class="karte erscheint erscheint-2"><p class="karte-rolle">02</p><h3 class="karte-titel">Zahlen</h3><p>Wissen Sie, was im nächsten Quartal kommt?</p></article>
      <article class="karte erscheint erscheint-3"><p class="karte-rolle">03</p><h3 class="karte-titel">Neukunden</h3><p>Kommen neue Kunden planbar?</p></article>
    </div>
  </div>
</section>

<section class="abschnitt" id="danach" aria-labelledby="danach-titel">
  <div class="w">
    ${abKopf('Ablauf', 'Was passiert nach dem <em>Check?</em>', '', 'danach-titel')}
    <ol class="ablauf-liste">
      <li class="erscheint"><h3>Vertriebs-Check</h3><p>Zwölf Fragen, fast alles per Klick, dazu zwei in Ihren eigenen Worten. Kostenlos.</p></li>
      <li class="erscheint erscheint-2"><h3>Ergebnis</h3><p>Direkt nach der letzten Frage, auf dem Bildschirm.</p></li>
      <li class="erscheint erscheint-3"><h3>Erstgespräch</h3><p>Wenn Sie möchten: 30 Minuten per Video mit Kevin. Kostenlos und kein Verkaufsgespräch.</p></li>
      <li class="erscheint erscheint-4"><h3>Ihr Vorschlag</h3><p>Wir schlagen Ihnen ein Angebot vor. Festpreis und Ablauf bekommen Sie schriftlich, bevor es losgeht.</p></li>
    </ol>
  </div>
</section>

<section class="abschnitt ton-2" id="fragen" aria-labelledby="fragen-titel">
  <div class="w">
    ${abKopf('Fragen', 'Häufige Fragen zum <em>Vertriebs-Check.</em>', '', 'fragen-titel')}
    ${fragenListe(fr('checkKosten', 'checkDauer', 'checkDanach'))}
    ${autor()}
  </div>
</section>
${kontakt(W, { schritte: false })}`;
}

// ─────────────── Fragen ───────────────
const FRAGEN_GRUPPEN = [
  ['Zusammenarbeit', fr('erstgespraech', 'projekt', 'erfahrung', 'vorort', 'preise', 'wer')],
  ['Digitaler Systemvertrieb', fr('planbar', 'crm', 'welchesCrm', 'tabelle', 'kennzahlen', 'richtwerte', 'eintragen')],
  ['Vertrieb auf Zeit', fr('unterschied', 'laufzeit', 'gespraeche', 'zeitaufwand', 'playbooks', 'csoZeit', 'einstellen', 'ende', 'nichtPassend', 'workshopNichts', 'workshopFokus')],
  ['Vertriebsteam aufbauen', fr('ersterVertriebler', 'erstePerson', 'rollen', 'fuehren')],
  ['Netzwerken und Events', fr('eventKosten', 'eventEinladung', 'eventGaeste')],
  ['Vertriebs-Check', fr('checkKosten', 'checkDauer', 'checkDanach')],
];
function fragenSeite(W) {
  return `
<section class="seiten-kopf dunkel" data-dunkelkopf>
  <div class="w">
    <nav aria-label="Brotkrumen"><ol class="krume"><li><a href="${W}">Start</a></li><li aria-current="page">Fragen</li></ol></nav>
    <div class="seiten-raster">
      <div>
        <h1 class="seiten-titel">Häufige Fragen zum Vertriebsaufbau mit MAKE <em>Revenue.</em></h1>
        <p class="seiten-text">Was Unternehmer wissen wollen, bevor wir zusammenarbeiten.</p>
      </div>
      <aside class="vorweg" aria-label="Ihre Frage fehlt?">
        <p>Ihre Frage ist nicht dabei? <a class="textlink" href="mailto:${MAIL}?subject=Frage%20an%20MAKE%20Revenue">Schreiben Sie uns</a>, wir antworten persönlich.</p>
      </aside>
    </div>
  </div>
</section>

<section class="abschnitt abschnitt-eng ton-2">
  <div class="w">
${FRAGEN_GRUPPEN.map(([name, liste], i) => `    <section class="fragen-gruppe" aria-labelledby="fg-${i + 1}">
      <h2 id="fg-${i + 1}">${name}</h2>
      <dl class="begriffe fragen-offen">
${liste.map(([f, a]) => `        <div><dt>${e(f)}</dt><dd>${a}</dd></div>`).join('\n')}
      </dl>
    </section>`).join('\n')}
    ${autor()}
  </div>
</section>
${kontakt(W)}`;
}

function nichtGefunden() {
  return `
<section class="seiten-kopf dunkel" data-dunkelkopf>
  <div class="w">
    <p class="ueberzeile">Fehler 404</p>
    <h1 class="seiten-titel">Diese Seite gibt es <em>nicht.</em></h1>
    <p class="seiten-text">Vielleicht wurde sie verschoben. Von der Startseite aus finden Sie alles Weitere.</p>
    <div class="seiten-aktionen"><a class="knopf knopf-gross" href="/">Zur Startseite</a><a class="link-pfeil" href="/fragen/">Häufige Fragen</a></div>
  </div>
</section>`;
}

// ═══════════════════════════════════════ Bauen ═══════════════════════════════════════
const SEITEN = [
  { pfad: '', aktuell: '', klasse: 'seite-start', inhalt: start, skripte: ['film.js', 'rechner.js', 'anfassen.js'], name: 'Start',
    titel: 'MAKE Revenue · Vertrieb mit System für Gründer und Mittelstand',
    beschreibung: 'MAKE Revenue baut Ihren Vertrieb als System auf: Zielgruppe, Prozess im CRM, Kennzahlen und Nachfassen. Einstieg: kostenloser Vertriebs-Check oder Erstgespräch.',
    leistungen: THEMEN.map((t) => ({ name: t.titel, art: t.art, text: t.kurz, pfad: t.pfad })),
    fragen: fr('erstgespraech', 'gespraeche', 'crm', 'preise', 'wer') },
  { pfad: 'systemvertrieb/', aktuell: 'systemvertrieb', klasse: 'seite-unter', inhalt: systemvertrieb, skripte: ['anfassen.js'], name: 'Digitaler Systemvertrieb',
    titel: 'Digitaler Systemvertrieb: Vertrieb mit System · MAKE Revenue',
    beschreibung: 'Vertrieb, der nicht am Gründer hängt: Zielgruppe, Prozess im CRM, Leitfäden, Kennzahlen und Wochenreport. So baut MAKE Revenue Ihr Vertriebssystem auf.',
    leistung: leistung('systemvertrieb'),
    fragen: fr('ersterVertriebler', 'welchesCrm', 'kennzahlen', 'planbar', 'tabelle'), begriffe: BEGRIFFE },
  { pfad: 'vertrieb-auf-zeit/', aktuell: 'zeit', klasse: 'seite-unter', inhalt: vertriebAufZeit, name: 'Vertrieb auf Zeit',
    titel: 'Vertrieb auf Zeit: Head of Sales und CSO · MAKE Revenue',
    beschreibung: 'Vertriebsleitung auf Zeit für 6 oder 12 Monate: Head of Sales oder Chief Sales Officer bauen das System auf und übergeben es. Einstieg über den Tagesworkshop.',
    leistung: leistung('zeit'),
    fragen: fr('gespraeche', 'crm', 'zeitaufwand', 'playbooks', 'laufzeit', 'csoZeit', 'einstellen', 'ende', 'nichtPassend') },
  { pfad: 'netzwerken/', aktuell: 'netzwerken', klasse: 'seite-unter', inhalt: netzwerken, name: 'Netzwerken und Events',
    titel: 'Netzwerken und Events in kleiner Runde · MAKE Revenue',
    beschreibung: 'Abende in kleiner Runde, kuratiert und auf Einladung: Gesprächsrunde, Impulsabend, Workshop und Treffen im Netzwerk. Für Gäste kostenlos, Gastgeberin ist Malin.',
    leistung: leistung('netzwerken'),
    fragen: fr('eventKosten', 'eventEinladung', 'eventGaeste') },
  { pfad: 'vertriebs-check/', aktuell: 'check', klasse: 'seite-unter', inhalt: vertriebsCheck, name: 'Vertriebs-Check',
    titel: 'Vertriebs-Check: Wie planbar ist Ihr Vertrieb? · MAKE Revenue',
    beschreibung: 'Der kostenlose Vertriebs-Check: zwölf Fragen zu Organisation, Zahlen und Neukunden in rund 5 Minuten. Sie sehen sofort, wo Ihr Vertrieb steht.',
    leistung: leistung('check'),
    fragen: fr('checkKosten', 'checkDauer', 'checkDanach') },
  { pfad: 'fragen/', aktuell: 'fragen', klasse: 'seite-unter', inhalt: fragenSeite, name: 'Fragen',
    titel: 'Häufige Fragen zum Vertriebsaufbau · MAKE Revenue',
    beschreibung: 'Antworten auf häufige Fragen zu Systemvertrieb, Head of Sales und Chief Sales Officer auf Zeit, Tagesworkshop, Events und dem kostenlosen Vertriebs-Check.',
    fragen: FRAGEN_GRUPPEN.flatMap(([, l]) => l) },
];

for (const s of SEITEN) {
  const html = rahmen(s);
  const ziel = join(ORDNER, s.pfad, 'index.html');
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, html);
}
// 404: eigene Seite mit absoluten Pfaden (sie wird unter jeder Adresse ausgeliefert), bleibt immer noindex
writeFileSync(join(ORDNER, '404.html'), rahmen({ pfad: '', aktuell: '', klasse: 'seite-unter', inhalt: nichtGefunden })
  .replace(/(href|src)="(?!https?:|mailto:|#|\/)([^"]*)"/g, (m, a, p) => `${a}="/${p.replace(/^\.\/$/, '')}"`).replace(/href="#erstgespraech"/g, 'href="/#erstgespraech"'));

// Was seo.mjs für Kopf, strukturierte Daten und Prüfer braucht
writeFileSync(join(ORDNER, 'seiten.json'), JSON.stringify({
  hinweis: 'Von bauen.mjs geschrieben, nicht von Hand ändern. seo.mjs liest daraus Titel, Beschreibung, Leistungen, Fragen und Begriffe.',
  stand: STAND, mail: MAIL, satz: SATZ, zeichen: { wahl: ZEICHEN_WAHL, name: ZEICHNUNG.name, alt: ZEICHNUNG.alt, svg: ZEICHNUNG.svg }, farbe: FARBE,
  seiten: SEITEN.map((s) => ({ pfad: s.pfad, datei: s.pfad + 'index.html', name: s.name, titel: s.titel, beschreibung: s.beschreibung, leistung: s.leistung ? { name: s.leistung.name, art: s.leistung.art, text: s.leistung.text, kurz: s.leistung.kurz } : null, leistungen: s.leistungen || [],
    fragen: (s.fragen || []).map(([f, a]) => ({ f, a: nurText(a) })), begriffe: (s.begriffe || []).map(([name, text]) => ({ name, text })) })),
}, null, 1) + '\n');

// zeichen.svg (Favicon): das gewählte Zeichen hell auf Nacht, mit runden Ecken
writeFileSync(join(ORDNER, 'zeichen.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>MAKE Revenue</title><rect width="100" height="100" rx="22" fill="${FARBE.nacht}"/><g transform="translate(50 50) scale(.74) translate(-50 -50)" fill="${FARBE.hell}" color="${FARBE.hell}">${ZEICHNUNG.svg}</g></svg>\n`);

console.log(`gebaut: ${SEITEN.length} Seiten + 404.html + seiten.json + zeichen.svg (Zeichen: ${ZEICHNUNG.name})`);
const { seo } = await import('./seo.mjs');
process.exitCode = seo({ nurPruefen: false }) ? 0 : 1;
