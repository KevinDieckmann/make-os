// MAKE Revenue · baut alle Seiten aus gemeinsamen Bausteinen.
// Aufruf:  node bauen.mjs        (schreibt die HTML-Seiten und seiten.json, danach läuft seo.mjs: Kopf, Dateien, Prüfer)
// Inhalte: Alle Fakten, Zahlen und Quellen stammen aus den Inhaltsdateien der MAKE-Innovation-Website
// (fokus.json, wissen.json, zahlen.json, produkte.json, inhalt.json) und sind hier wörtlich oder gekürzt übernommen.
// Preise stehen bewusst nicht hier: Die stehen nur bei MAKE Innovation.
// Keine Inline-Stile, keine Inline-Skripte (außer JSON-LD, das seo.mjs schreibt), keine on…-Handler.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const STAND = 'November 2026';
const MAIL = 'kevin@makeinnovation.de';
// Ein Satz je Marke, wörtlich gleich auf allen drei Seiten (SEO-GEO-VORGABEN 3.3).
// RECHTSFORM: Bewusst ohne Rechtsform und Firmennamen (STRUKTUR-MARKEN, Nachtrag 11.11.): Welche Gesellschaft Betreiberin ist,
// entscheidet Kevin noch. Steht sie fest, hier und an den mit „RECHTSFORM“ markierten Stellen nachtragen (auch seo.mjs).
const SATZ = {
  revenue: 'MAKE Revenue ist eine Marke von MAKE Innovation aus Berlin für Vertrieb mit System, Vertrieb auf Zeit sowie Netzwerken und Events.',
  studios: 'MAKE Studios ist eine Marke von MAKE Innovation aus Berlin für Websites, Google-Profil, Fotos und Video.',
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

// Die vier Themen: eine Quelle für Startseite, Unterseiten und strukturierte Daten (kurz = Text auf der Startseite, vorweg = Antwort auf der Unterseite)
const THEMEN = [
  { id: 'systemvertrieb', pfad: 'systemvertrieb/', lage: 'Die ganze Strecke', titel: 'Digitaler Systemvertrieb', art: 'Vertriebsaufbau', klein: 'Der Kern von MAKE Revenue',
    kurz: 'Zielgruppe, Prozess im CRM, Gesprächsleitfäden, Kennzahlen und Nachfassen. Ein Vertrieb, den Sie steuern können und der nicht an Ihnen hängt.',
    vorweg: 'Vertrieb wird planbar, wenn fünf Dinge stehen: eine klare Zielgruppe, eine Ansprache mit Leitfäden, ein Prozess im CRM, wenige Kennzahlen mit Wochenreport und ein Team, das trainiert ist.' },
  { id: 'zeit', pfad: 'vertrieb-auf-zeit/', lage: 'Wer die Strecke führt', titel: 'Vertrieb auf Zeit', art: 'Vertriebsleitung auf Zeit', klein: 'Auch Interim oder Fractional Head of Sales',
    kurz: 'Head of Sales oder Chief Sales Officer auf Zeit, für 6 oder 12 Monate. Wer erst testen will, startet mit dem Tagesworkshop Vertrieb.',
    vorweg: 'Ein Head of Sales auf Zeit übernimmt die Vertriebsleitung für einige Monate. Das lohnt sich, wenn der Vertrieb am Gründer hängt und eine feste Vertriebsleitung zu früh kommt.' },
  { id: 'netzwerken', pfad: 'netzwerken/', lage: 'Woher Anfragen kommen', titel: 'Netzwerken und Events', art: 'Netzwerk-Events', klein: 'Für Gäste kostenlos',
    kurz: 'Abende in kleiner Runde, auf Einladung. Dazu der Weg, aus Begegnungen und Empfehlungen Kontakte zu machen, die niemand vergisst.',
    vorweg: 'Viele gute Verbindungen entstehen erst, wenn man sich einmal gegenübersitzt. Davon soll der Standort etwas haben, nicht nur wir.' },
  { id: 'check', pfad: 'vertriebs-check/', lage: 'Wo Sie heute stehen', titel: 'Vertriebs-Check', art: 'Vertriebsanalyse', klein: 'Kostenlos · rund 5 Minuten',
    kurz: 'Zwölf Fragen zu Organisation, Zahlen und Neukunden, dazu zwei in Ihren eigenen Worten. Sie sehen sofort, wo Ihr Vertrieb steht.',
    vorweg: 'Der Vertriebs-Check ist kostenlos und dauert rund 5 Minuten. Das Ergebnis sehen Sie sofort auf dem Bildschirm.' },
];
const thema = (id) => THEMEN.find((t) => t.id === id);
const leistung = (id) => { const t = thema(id); return { name: t.titel, art: t.art, kurz: t.kurz, text: t.vorweg }; };

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
const marke = (klasse = '') => `<svg class="marke-zeichen" viewBox="0 0 100 100" aria-hidden="true"><use href="#g-stufen"/></svg><span class="marke-wort${klasse}"><b>MAKE</b> <span>REVENUE</span></span>`;

function fragenListe(liste) {
  return `<div class="fragen-liste">
${liste.map(([f, a]) => `      <details><summary>${e(f)}</summary><div class="fragen-antwort"><p>${a}</p></div></details>`).join('\n')}
    </div>`;
}
const punkte = (liste, klasse = '') => `<ul class="punkte ${klasse}">${liste.map((p) => `<li>${p}</li>`).join('')}</ul>`;

function kontakt(W, { titel = 'Sprechen wir <em>darüber.</em>', thema = '' } = {}) {
  return `
<section class="abschnitt dunkel kontakt" id="kontakt" aria-labelledby="kontakt-titel">
  <div class="w">
    <p class="ueberzeile">Der Einstieg</p>
    <h2 class="kontakt-titel" id="kontakt-titel">${titel}</h2>
    <p class="abschnitt-text">Im kostenlosen Erstgespräch, 30 Minuten per Video, klären wir, ob und womit wir helfen können. Oder Sie starten mit dem Vertriebs-Check: 5 Minuten, Ergebnis sofort.</p>
    <div class="kontakt-aktionen" id="erstgespraech">
      <a class="knopf knopf-gross" href="mailto:${MAIL}?subject=Erstgespr%C3%A4ch%20MAKE%20Revenue" data-buchen${thema ? `="${thema}"` : ''}>Erstgespräch vereinbaren</a>
      ${fam('check', 'Vertriebs-Check starten', { klasse: 'knopf knopf-gross knopf-leise' })}
    </div>
    <a class="kontakt-mail" href="mailto:${MAIL}?subject=Anfrage%20MAKE%20Revenue">${MAIL}</a>
    <ol class="kontakt-drei">
      <li><b>Erstgespräch oder Check</b><span>30 Minuten Erstgespräch per Video oder ein Check mit Ergebnis sofort. Beides kostenlos.</span></li>
      <li><b>Ihr Vorschlag</b><span>Wir schlagen Ihnen das passende Angebot vor und nennen Festpreis und Ablauf schriftlich, bevor es losgeht.</span></li>
      <li><b>Start</b><span>Zum vereinbarten Termin, mit ersten Ergebnissen im ersten Monat.</span></li>
    </ol>
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
        <p class="buchen-datenschutz">Beim Senden öffnet sich Ihr E-Mail-Programm mit dem fertigen Text. Diese Seite speichert und versendet nichts. ${fam('innovation', 'Datenschutz', { pfad: 'datenschutz/' })}</p>
      </section>

      <div class="buchen-fertig" hidden>
        <svg class="buchen-fertig-zeichen" viewBox="0 0 100 100" aria-hidden="true"><use href="#g-stufen"/></svg>
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
<meta name="theme-color" content="#EFF1EA">
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

<!-- Das Zeichen: die Stufenlinie in der Scheibe. Vier Stufen wie die Strecke: Anfrage, Gespräch, Angebot, Abschluss. Einmal hier, überall per <use>. -->
<svg class="vorrat" aria-hidden="true" focusable="false">
  <defs>
    <mask id="m-stufen" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <circle cx="50" cy="50" r="46" fill="#fff"/>
      <path d="M-2 71H29.5V57H50V43H70.5V29H102" fill="none" stroke="#000" stroke-width="6"/>
    </mask>
    <g id="g-stufen"><rect width="100" height="100" mask="url(#m-stufen)"/></g>
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
        <p class="fuss-satz">${SATZ.revenue}</p>
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
        <p class="fuss-titel">Die Familie</p>
        <ul class="fuss-liste">
          <li>${fam('innovation', 'MAKE Innovation', { klasse: '' })}<small>Das Dach: KI, Abläufe und eigene Software</small></li>
          <li>${fam('studios', 'MAKE Studios', { klasse: '' })}<small>Websites, Google-Profil, Fotos und Video</small></li>
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

// Kopf einer Unterseite: Brotkrumen, eine h1, Einleitung, rechts „Das Wichtigste vorweg“
function seitenKopf(W, { krume, titel, text, aktionen, vorweg, fakten }) {
  return `
<section class="seiten-kopf">
  <div class="w">
    <nav aria-label="Brotkrumen"><ol class="krume"><li><a href="${W}">Start</a></li><li aria-current="page">${krume}</li></ol></nav>
    <div class="seiten-raster">
      <div>
        <h1 class="seiten-titel">${titel}</h1>
        <p class="seiten-text">${text}</p>
        <div class="seiten-aktionen">${aktionen}</div>
      </div>
      <aside class="vorweg" aria-label="Das Wichtigste vorweg">
        <p class="ueberzeile">Das Wichtigste vorweg</p>
        <p>${vorweg}</p>
        <dl>${fakten.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </aside>
    </div>
  </div>
</section>`;
}
const abKopf = (ueber, titel, text = '', id = '') => `<div class="abschnitt-kopf${text ? '' : ' abschnitt-kopf-schmal'}">
      <p class="ueberzeile">${ueber}</p>
      <h2 class="abschnitt-titel"${id ? ` id="${id}"` : ''}>${titel}</h2>
      ${text ? `<p class="abschnitt-text">${text}</p>` : ''}
    </div>`;
const autor = () => `<p class="stand">Verantwortlich für den Inhalt: Kevin Dieckmann, Vertrieb und Umsetzung · ${fam('innovation', 'Über uns bei MAKE Innovation', { pfad: 'ueber-uns/' })} · Stand: ${STAND}</p>`;

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
  const balken = (name, id, n) => `<li><span class="trichter-name">${name}</span><svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><rect class="grund" x="0" y="0" width="100" height="10" rx="2"/><rect class="wert" x="0" y="0" width="${Math.max(0.5, (100 * n) / r.kontakte).toFixed(2)}" height="10" rx="2" data-balken="${id}"/></svg><b data-aus="${id}">${de(n)}</b></li>`;
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
        <p class="rechner-hinweis">Die Startwerte sind ein Beispiel. Alle Werte sind angenommen.</p>
        <noscript><p class="rechner-hinweis">Zum Rechnen braucht diese Seite JavaScript. Ohne JavaScript sehen Sie rechts das Beispiel mit den Startwerten.</p></noscript>
      </div>
      <div class="rechner-rechts erscheint erscheint-2">
        <dl class="rechner-ergebnis" aria-live="polite">
          <div class="rechner-haupt"><dt>Termine je Woche</dt><dd data-aus="termineWoche">${de(r.termineWoche, 1)}</dd></div>
          <div><dt>Erstkontakte je Woche</dt><dd data-aus="kontakteWoche">${de(r.kontakteWoche, 1)}</dd></div>
          <div><dt>Angebote je Woche</dt><dd data-aus="angeboteWoche">${de(r.angeboteWoche, 1)}</dd></div>
          <div><dt>Umsatz je Monat</dt><dd data-aus="umsatzMonat">${de(r.umsatzMonat)}&nbsp;€</dd></div>
        </dl>
        <figure class="trichter" aria-label="Die Strecke vom Erstkontakt zum Abschluss, im Jahr"><figcaption class="etikett">Ihre Strecke im Jahr</figcaption>
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
  erstgespraech: ['Ist das Erstgespräch ein Verkaufsgespräch?', 'Nein, es ist ein Gespräch über Ihre Lage, kostenlos und per Video. Am Ende sagen wir Ihnen klar, ob wir helfen können und womit. Und wenn nicht, sagen wir auch das.'],
  gespraeche: ['Wer führt die Verkaufsgespräche?', 'Ihr Team. Wir machen vor, trainieren mit Rollenspielen und besprechen echte Calls nach. So bleibt das Wissen bei Ihnen, wenn wir gehen.'],
  crm: ['Brauche ich schon ein CRM?', 'Nein. Wenn Sie keins haben, wählen wir im ersten Monat gemeinsam ein passendes aus und richten Stages, Pflichtfelder und Wiedervorlagen ein. Die Lizenzkosten tragen Sie.'],
  preise: ['Wo stehen die Preise?', 'MAKE Revenue zeigt keine Preise. Die Preise aller Angebote stehen offen bei MAKE Innovation. Den genauen Festpreis bekommen Sie schriftlich, bevor es losgeht.'],
  wer: ['Wer steht hinter MAKE Revenue?', 'MAKE Revenue ist eine Marke von MAKE Innovation aus Berlin. Sie arbeiten direkt mit Kevin und Malin und nicht mit wechselnden Projektleitern.'],
  projekt: ['Wer arbeitet an meinem Projekt?', 'Sie arbeiten direkt mit uns, Kevin und Malin, und nicht mit wechselnden Projektleitern. Sie sprechen immer mit uns, und wir stimmen alles Weitere im Team ab.'],
  erfahrung: ['Welche Erfahrung bringen Sie mit?', 'Wir kommen aus der Vertriebsführung: Teams geführt, Partnernetze aufgebaut, Head of Sales bei einem FinTech. Heute arbeiten wir in laufenden Projekten mit KI, auch im internationalen Umfeld. Namen nennen wir nur, wenn Kunden es freigeben. Vertraulichkeit gehört für uns dazu.'],
  vorort: ['Arbeiten Sie auch bei uns vor Ort?', 'Ja. Vieles läuft per Video, wichtige Termine machen wir gern bei Ihnen: Workshops, Trainings mit Ihrem Team, Gespräche mit der Geschäftsführung. Termine vor Ort vereinbaren wir vorher, Reisekosten rechnen wir gegen Beleg ab.'],
  ersterVertriebler: ['Wann sollte ein Start-up den ersten Vertriebler einstellen?', 'Sobald es ein System gibt, in das er einsteigen kann: eine klare Zielgruppe, Leitfäden und einen Prozess im CRM. Ohne dieses Fundament verbringt ein neuer Vertriebler die ersten Monate damit, es selbst zu suchen.'],
  welchesCrm: ['Welches CRM brauche ich für den Anfang?', 'Eines, das Ihr Team jeden Tag nutzt. Wichtiger als das Werkzeug sind klare Stufen, Pflichtfelder und Wiedervorlagen. Fangen Sie einfach an und erweitern Sie erst, wenn die Grundlagen sitzen.'],
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
  workshopNichts: ['Was, wenn der Tagesworkshop nichts bringt?', 'Haben Sie am Abend keine drei Hebel, die Sie umsetzen wollen, zahlen Sie nichts.'],
  workshopFokus: ['Strategie oder operativ: Was heißt das beim Tagesworkshop?', 'Mit Fokus Strategie geht es um Zielgruppe, Markteintritt und Positionierung. Mit Fokus operativ um Ablauf, Zahlen und Werkzeuge im Vertrieb. Sie wählen vorab.'],
  nichtPassend: ['Für wen passt ein Head of Sales auf Zeit nicht?', 'Für Firmen ohne fertiges Produkt, Konzerne mit Einkaufsabteilung, reine Kaltakquise-Telefonteams und Network-Marketing.'],
  erstePerson: ['Wann sollte ich die erste Person für den Vertrieb einstellen?', 'Wenn Sie wissen, welche Kunden am besten passen, Ihr Erstgespräch einem aufgeschriebenen Ablauf folgt und genug Kontakte da sind, um eine Person auszulasten. Fehlt eines davon, holen Sie es zuerst nach.'],
  rollen: ['Brauche ich gleich getrennte Rollen im Vertrieb?', 'Nein. In kleinen Teams macht jede Person alles. Trennen Sie Rollen erst, wenn eine Aufgabe eine Person gut auslasten kann, und regeln Sie dann die Übergaben zwischen den Rollen.'],
  fuehren: ['Wer soll den Vertrieb führen, wenn ich es nicht mehr mache?', 'Jemand, der führen will und es gelernt hat oder lernen darf. Das ist nicht immer die Person, die am meisten verkauft. Am Anfang verkauft die Vertriebsleitung oft noch mit, braucht aber feste Zeit für die Führung.'],
  eventKosten: ['Was kosten die Events?', 'Für Gäste sind die Events kostenlos.'],
  eventEinladung: ['Wie bekomme ich eine Einladung?', 'Tragen Sie sich bei MAKE Innovation auf die Gästeliste ein, dann bekommen Sie die nächste Einladung. Termine, Orte und Formate stehen in jeder Einladung.'],
  eventGaeste: ['Wer kommt zu den Events?', 'Gründerinnen und Gründer, Mittelständler und Macher aus KI und Technik. Wir laden selbst ein und mischen bewusst, zum Beispiel Start-ups mit Mittelständlern oder Leute aus der Technik mit Leuten aus dem Vertrieb.'],
  checkKosten: ['Was kostet der Vertriebs-Check?', 'Nichts. Der Vertriebs-Check und das Erstgespräch danach sind kostenlos.'],
  checkDauer: ['Wie lange dauert der Vertriebs-Check?', 'Rund 5 Minuten. Es sind zwölf Fragen zu Organisation, Zahlen und Neukunden, dazu zwei in Ihren eigenen Worten. Das Ergebnis sehen Sie sofort.'],
  checkDanach: ['Was passiert nach dem Vertriebs-Check?', 'Sie sehen sofort, wo Ihr Vertrieb steht und welcher Schritt jetzt am meisten bringt. Wenn Sie möchten, sprechen wir im kostenlosen Erstgespräch darüber: 30 Minuten per Video.'],
};
const fr = (...ids) => ids.map((i) => FRAGEN[i]);

const BEGRIFFE = [
  ['Digitaler Systemvertrieb', 'Digitaler Systemvertrieb ist Vertrieb nach einem festen Ablauf im CRM: Jede Anfrage hat eine Stufe, eine nächste Aktion und ein Datum, und wenige Kennzahlen zeigen jede Woche, ob der Plan hält.'],
  ['Vertrieb auf Zeit', 'Vertrieb auf Zeit ist eine Vertriebsleitung für einige Monate, die das System aufbaut, mit Ihrem Team umsetzt und so übergibt, dass der Vertrieb ohne sie läuft. Auch Interim oder Fractional Head of Sales genannt.'],
  ['Salesprozess', 'Der Salesprozess sind die festen Stufen, die jede Anfrage bis zum Abschluss durchläuft, mit einer klaren nächsten Aktion je Stufe.'],
  ['Pipeline', 'Die Pipeline ist die Summe aller offenen Verkaufschancen mit ihrem erwarteten Wert, geordnet nach Stufe vom Erstkontakt bis zum Abschluss.'],
  ['Wiedervorlage', 'Eine Wiedervorlage ist ein fester Termin im CRM, an dem eine offene Anfrage wieder bearbeitet wird. So bleibt keine Anfrage liegen.'],
  ['Abschlussquote', 'Die Abschlussquote ist der Anteil der Angebote, aus denen ein Auftrag wird. Gezählt werden nur Angebote, die entschieden sind, also angenommen oder abgelehnt.'],
  ['Rückwärtsrechnung', 'Die Rückwärtsrechnung führt vom Umsatzziel zurück zu den nötigen Abschlüssen, Angeboten und Terminen je Woche.'],
  ['Wochenreport', 'Der Wochenreport ist ein kurzer Bericht jeden Freitag: die Zahlen des Vertriebs und ein Satz dazu, was nächste Woche anders läuft.'],
  ['Lead-Scoring', 'Lead-Scoring ist die Einteilung der Kontakte danach, wie gut sie passen, zum Beispiel in A, B und C. A-Kontakte bekommen zuerst Zeit.'],
  ['Sales Playbook', 'Das Sales Playbook ist das Nachschlagewerk des Vertriebs: Zielgruppe, Botschaft, Prozess, Leitfäden, Antworten auf Einwände und Kennzahlen an einem Ort.'],
];

// ─────────────── Startseite ───────────────
function start(W) {
  const halte = [
    ['Anfrage', 'Ein Interessent von der Messe hat vor drei Wochen um ein Angebot gebeten. Der Entwurf liegt noch in Ihrem Postfach.', 'Jede Anfrage bekommt eine Stufe, eine nächste Aktion und ein Datum. So geht nichts verloren, und jeder im Team sieht, wo ein Kunde steht.'],
    ['Gespräch', 'Viele Gründer und Geschäftsführer verkaufen selbst und nebenbei. Neue Kunden kommen über Empfehlungen, aber nicht planbar.', 'Leitfäden geben jedem Gespräch eine Richtung: Welche Fragen klären Bedarf, Budget, Entscheidung und Zeitpunkt? Dazu gehören gute Antworten auf die häufigsten Einwände.'],
    ['Angebot', 'Ein Wettbewerber mit dem schwächeren Produkt bekommt den Auftrag, weil er schneller nachgefasst hat.', 'Das Angebot geht in 24 Stunden raus. Jedes offene Angebot hat ein Datum zum Nachfassen, zum Beispiel drei Werktage danach und noch einmal eine Woche später.'],
    ['Abschluss', 'Wie viele neue Kunden nächsten Monat kommen, kann niemand sagen. Es hängt an Empfehlungen und an Ihnen.', 'Vom Umsatzziel rückwärts gerechnet stehen Wochenziele fest. Jeden Freitag zeigt der Wochenreport, ob der Plan hält, und Ihr Team schließt selbst ab.'],
  ];
  const themen = THEMEN.map((t) => [t.pfad, t.lage, t.titel, t.kurz, t.klein]);
  return `
<section class="held" aria-labelledby="held-titel">
  <div class="w held-raster">
    <div class="held-links">
      <p class="ueberzeile">MAKE Revenue · Vertrieb mit System</p>
      <h1 class="held-titel" id="held-titel">Ihr Produkt ist besser, als Ihr Umsatz <em>zeigt.</em> <span class="held-zusatz">Vertrieb mit System für Gründer, Mittelstand und Dienstleister.</span></h1>
      <p class="held-text">MAKE Revenue baut Ihren Vertrieb als System auf: Zielgruppe, Prozess im CRM, Kennzahlen und Nachfassen. Wir machen es vor und üben mit Ihrem Team, bis es selbst abschließt.</p>
      <div class="held-aktionen">
        <a class="knopf knopf-gross" href="#erstgespraech" data-buchen>Erstgespräch vereinbaren</a>
        ${fam('check', 'Vertriebs-Check, 5 Minuten', { klasse: 'link-pfeil' })}
      </div>
      <ul class="held-fakten" aria-label="Auf einen Blick">
        <li>B2B · Mittelstand · Dienstleister</li>
        <li>Erstgespräch kostenlos</li>
        <li>Berlin · Deutschland und Europa</li>
      </ul>
    </div>
    <figure class="treppe" aria-label="Die Strecke im Vertrieb in vier Stufen: Anfrage, Gespräch, Angebot, Abschluss">
      <svg class="treppe-linie" viewBox="0 0 4 5" preserveAspectRatio="none" aria-hidden="true">
        <rect class="treppe-saeule treppe-saeule-1" x="0" y="4" width="1" height="1"/>
        <rect class="treppe-saeule treppe-saeule-2" x="1" y="3" width="1" height="2"/>
        <rect class="treppe-saeule treppe-saeule-3" x="2" y="2" width="1" height="3"/>
        <rect class="treppe-saeule treppe-saeule-4" x="3" y="1" width="1" height="4"/>
        <path class="treppe-boden" d="M0 5H4"/>
      </svg>
      <svg class="treppe-linie treppe-zug" viewBox="0 0 4 5" preserveAspectRatio="none" aria-hidden="true">
        <path class="treppe-weg" d="M0 4H1V3H2V2H3V1H4"/>
      </svg>
      <ol class="treppe-stufen">
        <li class="treppe-stufe treppe-stufe-1"><span>01</span><b>Anfrage</b></li>
        <li class="treppe-stufe treppe-stufe-2"><span>02</span><b>Gespräch</b><small>Leitfäden geben jedem Gespräch eine Richtung.</small></li>
        <li class="treppe-stufe treppe-stufe-3"><span>03</span><b>Angebot</b><small>Raus in 24 Stunden, mit Datum zum Nachfassen.</small></li>
        <li class="treppe-stufe treppe-stufe-4"><span>04</span><b>Abschluss</b><small>Ihr Team schließt selbst ab, planbar.</small></li>
      </ol>
      <i class="treppe-ziel" aria-hidden="true"></i>
    </figure>
  </div>
</section>

<section class="abschnitt dunkel" id="zahlen" aria-labelledby="zahlen-titel">
  <div class="w">
    ${abKopf('Zahlen mit Quelle', 'Was Studien 2026 über Vertrieb <em>zeigen.</em>', 'Mehr als jedes dritte Unternehmen in Deutschland meldete im Januar 2026 zu wenig Aufträge. Was hier steht, können wir belegen. Quellen verlinken wir.', 'zahlen-titel')}
    <div class="zahlen">
      ${zahl(ZAHL.ifo, 'zahl-gross')}
      <div class="zahlen-neben">
        ${zahl(ZAHL.crm)}
        ${zahl(ZAHL.zeit)}
        ${zahl(ZAHL.umsatz)}
        ${zahl(ZAHL.nachfrage)}
      </div>
    </div>
    <p class="zahlen-fuss">Alle Zahlen am Original geprüft am 30.10.2026.</p>
  </div>
</section>

<section class="abschnitt" id="strecke" aria-labelledby="strecke-titel">
  <div class="w">
    ${abKopf('Die Strecke', 'Von der Anfrage zum Abschluss: wo es heute <em>hängt.</em>', 'Vertrieb hängt an der Geschäftsführung, und das meiste läuft über Bauchgefühl. Anfragen gehen verloren, Angebote bleiben liegen, und niemand weiß, wie viele Gespräche es für das Jahresziel braucht.', 'strecke-titel')}
    <div class="bahn" data-bahn>
      <div class="bahn-schiene" aria-hidden="true"><i></i></div>
      <ol class="bahn-halte">
${halte.map(([name, heute, system], i) => `        <li class="halt">
          <span class="halt-punkt" aria-hidden="true">0${i + 1}</span>
          <h3>${name}</h3>
          <div class="halt-teile">
            <div class="halt-teil halt-heute"><p class="halt-marke"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l8 10"/><path d="M19 11v6h-6"/></svg>Heute</p><p>${heute}</p></div>
            <div class="halt-teil halt-system"><p class="halt-marke"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h17M14 6l6 6-6 6"/></svg>Mit System</p><p>${system}</p></div>
          </div>
        </li>`).join('\n')}
      </ol>
    </div>
    <div class="strecke-fuss">
      <p>Vertrieb ist kein Talent, sondern ein System: wer angesprochen wird, was gesagt wird, was gemessen wird.</p>
      <a class="link-pfeil" href="systemvertrieb/">So baut MAKE Revenue das System auf</a>
    </div>
  </div>
</section>

<section class="abschnitt ton-2" id="themen" aria-labelledby="themen-titel">
  <div class="w">
    ${abKopf('Leistungen', 'Vier Themen, eine <em>Strecke.</em>', 'MAKE Revenue arbeitet an vier Stellen: am System selbst, an der Führung, an neuen Kontakten und am ehrlichen Blick auf den Stand.', 'themen-titel')}
    <ol class="themen-liste">
${themen.map(([pfad, lage, titel, text, klein], i) => `      <li class="thema erscheint">
        <span class="thema-nr" aria-hidden="true">0${i + 1}</span>
        <div><span class="thema-lage">${lage}</span><h3 class="thema-titel"><a href="${pfad}">${titel}</a></h3></div>
        <p class="thema-text">${text}<small>${klein}</small></p>
        <span class="thema-pfeil" aria-hidden="true">${pfeil}</span>
      </li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt dunkel" id="rechner" aria-labelledby="rechner-titel">
  <div class="w">
    ${abKopf('Vertriebsrechner', 'Rechnen Sie nach: Wie viele Termine braucht Ihr <em>Ziel?</em>', 'Vom Umsatzziel rückwärts: Abschlüsse, Angebote, Termine und Erstkontakte je Woche. Tragen Sie Ihre Werte ein. Die Rechnung bleibt in Ihrem Browser, nichts wird gesendet.', 'rechner-titel')}
    ${rechner()}
    <div class="rechner-fuss">
      <p>Ihre eigenen Quoten kennen Sie nach einigen Wochen mit sauberen Zahlen im CRM. Diesen Takt bauen wir als Head of Sales auf Zeit mit Ihnen auf.</p>
      <a class="link-pfeil" href="vertrieb-auf-zeit/">Vertrieb auf Zeit ansehen</a>
    </div>
  </div>
</section>

<section class="abschnitt" id="ablauf" aria-labelledby="ablauf-titel">
  <div class="w">
    ${abKopf('Ablauf', 'So kommen wir <em>zusammen.</em>', `Vom ersten Gespräch bis zum Mandat hat jeder Schritt ein klares Ergebnis. Preise zeigt MAKE Revenue nicht: Sie stehen offen bei ${fam('innovation', 'MAKE Innovation', { pfad: 'preise/' })}.`, 'ablauf-titel')}
    <ol class="ablauf-liste ablauf-stufen">
      <li class="erscheint"><h3>Erstgespräch oder Check</h3><p>Kostenlos: 30 Minuten Erstgespräch per Video oder der Vertriebs-Check mit Ergebnis sofort.</p></li>
      <li class="erscheint erscheint-2"><h3>Ihr Vorschlag</h3><p>Wir schlagen Ihnen das passende Angebot vor und nennen Festpreis und Ablauf schriftlich, bevor es losgeht.</p></li>
      <li class="erscheint erscheint-3"><h3>Tagesworkshop</h3><p>Ein Tag, an dem wir die größten Hebel finden und den ersten direkt umsetzen. Beim Start eines Mandats rechnen wir ihn voll an.</p></li>
      <li class="erscheint erscheint-4"><h3>Mandat</h3><p>Head of Sales oder Chief Sales Officer auf Zeit, für 6 oder 12 Monate. Erste Ergebnisse im ersten Monat.</p></li>
    </ol>
  </div>
</section>

<section class="satz-band" aria-labelledby="satz-titel">
  <div class="w">
    <p class="ueberzeile">Unser Maßstab</p>
    <h2 class="satz-gross" id="satz-titel">Wir schulden die Leistung, nicht den <em>Umsatz.</em></h2>
    <p class="satz-unter">Was wir zusagen, liefern wir. Im Mandat als Head of Sales heißt das: In Woche 8 bekommen Sie eine Zwischenbilanz mit Zahlen und Fahrplan. Ab Monat 3 läuft jedes Gespräch nach Prozess im CRM, und jeden Freitag kommt der Wochenreport mit Ihren Zahlen.</p>
  </div>
</section>

<section class="abschnitt" id="wer" aria-labelledby="wer-titel">
  <div class="w">
    ${abKopf('Wer dahinter steht', 'Wir kommen aus dem <em>Vertrieb.</em>', 'Wir haben selbst Vertriebsziele verantwortet und messen unsere Arbeit an Abschlüssen. Sie arbeiten direkt mit uns, Kevin und Malin, und nicht mit wechselnden Projektleitern.', 'wer-titel')}
    <div class="karten-2">
      <article class="karte erscheint">
        <span class="karte-kuerzel" aria-hidden="true">KD</span>
        <p class="karte-rolle">Vertrieb und Umsetzung</p>
        <h3 class="karte-titel">Kevin Dieckmann</h3>
        <p>Kevin kommt aus der Vertriebsführung: Er hat Vertriebsteams geführt, Partnernetze aufgebaut und war Head of Sales bei einem FinTech. Er verantwortet Vertrieb und Umsetzung, verbindet Vertrieb mit KI und arbeitet selbst in den Projekten mit, auch im internationalen Umfeld.</p>
      </article>
      <article class="karte erscheint erscheint-2">
        <span class="karte-kuerzel" aria-hidden="true">MA</span>
        <p class="karte-rolle">Bühne und Netzwerk</p>
        <h3 class="karte-titel">Malin</h3>
        <p>Malin ist Mitgründerin und Gastgeberin unserer Events. Sie verantwortet Bühne und Netzwerk und überlegt bei jeder Einladung, wer wen kennenlernen sollte.</p>
      </article>
    </div>
    <ul class="nicht-liste" aria-label="Was MAKE Revenue nicht ist">
      <li><b>Kein Callcenter</b><span>Ihr Team verkauft selbst, wir machen vor.</span></li>
      <li><b>Keine Folien-Beratung</b><span>Kein Konzept, das in der Schublade landet.</span></li>
      <li><b>Kein Inkubator</b><span>Wir vermitteln kein Kapital und leben nicht von Beteiligungen.</span></li>
      <li><b>Keine reine Werbe- oder PR-Agentur</b><span>Keine Kampagne und keine Pressemitteilung ohne Vertrieb dahinter.</span></li>
    </ul>
  </div>
</section>

<section class="abschnitt ton-2" id="familie" aria-labelledby="familie-titel">
  <div class="w">
    ${abKopf('Die Familie', 'Teil von MAKE <em>Innovation.</em>', SATZ.revenue, 'familie-titel')}
    <div class="karten-2">
      <article class="karte karte-familie familie-studios erscheint">
        <p class="familie-marke"><i class="familie-punkt" aria-hidden="true"></i><b>MAKE</b> <span>STUDIOS</span></p>
        <h3 class="karte-titel">Sichtbarkeit bringt Anfragen. Vertrieb macht daraus Kunden.</h3>
        <p>${SATZ.studios} Wer dort gefunden wird, braucht hier die Strecke, die jede Anfrage weiterverfolgt. Sichtbarkeit macht den Vertrieb leichter.</p>
        ${fam('studios', 'Zu MAKE Studios', { klasse: 'link-pfeil link-aussen' })}
      </article>
      <article class="karte karte-familie familie-innovation erscheint erscheint-2">
        <p class="familie-marke"><i class="familie-punkt" aria-hidden="true"></i><b>MAKE</b> <span>INNOVATION</span></p>
        <h3 class="karte-titel">Das Dach: KI, bessere Abläufe und eigene Software.</h3>
        <p>${SATZ.innovation} Dort stehen auch die Preise aller Angebote, und dort läuft der kostenlose Vertriebs-Check.</p>
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
${kontakt(W)}`;
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
    text: 'Vertrieb ist kein Talent, sondern ein System: wer angesprochen wird, was gesagt wird, was gemessen wird. MAKE Revenue baut dieses System mit Ihnen auf, mit einem festen Ablauf im CRM und wenigen Zahlen, die jede Woche auf dem Tisch liegen.',
    aktionen: `<a class="knopf knopf-gross" href="../#erstgespraech" data-buchen="systemvertrieb">Erstgespräch vereinbaren</a>${fam('check', 'Vertriebs-Check, 5 Minuten', { klasse: 'link-pfeil' })}`,
    vorweg: thema('systemvertrieb').vorweg,
    fakten: [['Für wen', 'Gründer und Unternehmer, B2B, Mittelstand und Dienstleister, deren Vertrieb an der Geschäftsführung hängt'], ['Ergebnis', 'Pipeline im CRM, Wochenreport, klare Rollen und ein Sales Playbook, das bleibt'], ['Einstieg', 'Vertriebs-Check oder Erstgespräch, beides kostenlos']],
  })}

<section class="abschnitt ton-2" aria-labelledby="was-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <p class="ueberzeile">Begriff</p>
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

<section class="abschnitt" id="bausteine" aria-labelledby="bausteine-titel">
  <div class="w">
    ${abKopf('Aufbau', 'Woraus besteht ein Vertrieb mit <em>System?</em>', 'Aus fünf Bausteinen, in dieser Reihenfolge: Fundament, Leadgenerierung, Prozesse, Kennzahlen und ein befähigtes Team. Wer mit einem neuen Werkzeug oder dem ersten Vertriebler anfängt, hat noch nichts, worauf beides aufsetzen kann.', 'bausteine-titel')}
    <ol class="bausteine">
${bausteine.map(([name, klein, text]) => `      <li class="baustein erscheint"><h3>${name}${klein ? `<small>${klein}</small>` : ''}</h3><p>${text}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt ton-2" id="prozess" aria-labelledby="prozess-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <p class="ueberzeile">Der Prozess</p>
      <h2 class="abschnitt-titel" id="prozess-titel">Was gehört in den Prozess im <em>CRM?</em></h2>
      <p class="abschnitt-text">Jede Anfrage bekommt eine Stufe, eine nächste Aktion und ein Datum. So geht nichts verloren, und jeder im Team sieht, wo ein Kunde steht. Welches CRM Sie nutzen, ist zweitrangig. Wichtig ist, dass alle es gleich nutzen.</p>
    </div>
    <div>
      ${punkte(['Stufen vom Erstkontakt bis zum Abschluss', 'Pflichtfelder für alles, was später ausgewertet wird', 'eine Wiedervorlage für jede offene Anfrage', 'ein fester Standard für Gesprächsnotizen', 'ein Ziel für die Zeit bis zum Angebot, zum Beispiel 24 Stunden'])}
      <div class="fliess abstand-oben">
        <h3>Nachfassen ist eine Regel, kein Vorsatz</h3>
        <p>Ein Angebot ohne Nachfrage bleibt liegen, auch wenn der Kunde eigentlich will: Entscheidungen werden verschoben, Postfächer laufen voll. Legen Sie deshalb eine feste Regel fest, zum Beispiel: nachfassen drei Werktage nach dem Angebot und noch einmal eine Woche später.</p>
      </div>
    </div>
  </div>
</section>

<section class="abschnitt" id="kennzahlen" aria-labelledby="kennzahlen-titel">
  <div class="w">
    ${abKopf('Kennzahlen', 'Wie viele Termine braucht Ihr <em>Umsatzziel?</em>', 'Rechnen Sie vom Umsatzziel rückwärts: Wie viele Abschlüsse brauchen Sie, wie viele Angebote führen dahin, wie viele Termine braucht es dafür? Daraus werden Wochenziele, die jeder versteht.', 'kennzahlen-titel')}
    <div class="kaesten-2">
      <div class="kasten erscheint">
        <table class="tafel tafel-zahl tafel-karten">
          <caption>Rechenbeispiel mit angenommenen Werten</caption>
          <thead><tr><th scope="col">Schritt</th><th scope="col">Rechnung</th><th scope="col">Ergebnis</th></tr></thead>
          <tbody>
            <tr><th scope="row">Umsatzziel im Jahr</th><td data-spalte="Rechnung">Beispielwert</td><td data-spalte="Ergebnis">240.000&nbsp;€</td></tr>
            <tr><th scope="row">Abschlüsse</th><td data-spalte="Rechnung">240.000&nbsp;€ ÷ 8.000&nbsp;€ je Auftrag</td><td data-spalte="Ergebnis">30</td></tr>
            <tr><th scope="row">Angebote</th><td data-spalte="Rechnung">jedes dritte Angebot wird ein Auftrag</td><td data-spalte="Ergebnis">90</td></tr>
            <tr><th scope="row">Termine</th><td data-spalte="Rechnung">aus jedem zweiten Termin wird ein Angebot</td><td data-spalte="Ergebnis">180</td></tr>
            <tr><th scope="row">Je Woche</th><td data-spalte="Rechnung">180 Termine ÷ 45 Arbeitswochen</td><td data-spalte="Ergebnis">4 Termine</td></tr>
          </tbody>
        </table>
        <p class="tafel-fuss">Alle Werte sind angenommen. Ihre eigenen Quoten kennen Sie nach einigen Wochen mit sauberen Zahlen im CRM.</p>
        <a class="link-pfeil" href="../#rechner">Mit eigenen Werten rechnen</a>
      </div>
      <div class="report erscheint erscheint-2">
        <div class="report-kopf"><h3 class="report-titel">So sieht ein Wochenreport aus</h3><span class="etikett">Kalenderwoche 12</span></div>
        <table>
          <thead><tr><th scope="col">Stufe</th><th scope="col">Ist</th><th scope="col">Ziel</th></tr></thead>
          <tbody>
            <tr><th scope="row">Erstkontakte</th><td><b>38</b></td><td>40</td></tr>
            <tr><th scope="row">Termine</th><td><b>5</b></td><td>4</td></tr>
            <tr><th scope="row">Angebote</th><td><b>3</b></td><td>2</td></tr>
            <tr><th scope="row">Abschlüsse</th><td><b>1</b></td><td>1</td></tr>
          </tbody>
        </table>
        <p class="report-satz">Nächste Woche: Messekontakte nachfassen, die zwei größten offenen Angebote zuerst.</p>
        <p class="report-hinweis">Beispielwerte, kein Kunde. Die Ziele kommen aus der Rückwärtsrechnung vom Umsatzziel.</p>
      </div>
    </div>
  </div>
</section>

<section class="abschnitt ton-2" id="zahlen" aria-labelledby="fuenf-titel">
  <div class="w">
    ${abKopf('Steuern', 'Welche Vertriebszahlen braucht ein kleines <em>Unternehmen?</em>', 'Fünf Zahlen reichen, um einen kleinen Vertrieb zu steuern. Ein teures Werkzeug braucht es dafür nicht: Eine Tabelle genügt, wenn sie gepflegt und jede Woche besprochen wird.', 'fuenf-titel')}
    <ol class="bausteine">
${fuenf.map(([name, text]) => `      <li class="baustein erscheint"><h3>${name}</h3><p>${text}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt" id="fehler" aria-labelledby="fehler-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <p class="ueberzeile">Aus der Praxis</p>
      <h2 class="abschnitt-titel" id="fehler-titel">Welche Fehler machen Vertrieb <em>unplanbar?</em></h2>
      <p class="abschnitt-text">Meist ist es die Reihenfolge: erst das Werkzeug, dann der Prozess. Oder der erste Vertriebler kommt, bevor es ein System gibt, in das er einsteigen kann.</p>
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

<section class="abschnitt ton-2" id="begriffe" aria-labelledby="begriffe-titel">
  <div class="w">
    ${abKopf('Begriffe', 'Zehn Begriffe aus dem Vertrieb, kurz <em>erklärt.</em>', '', 'begriffe-titel')}
    <dl class="begriffe">
${BEGRIFFE.map(([n, t]) => `      <div><dt>${n}</dt><dd>${t}</dd></div>`).join('\n')}
    </dl>
  </div>
</section>

<section class="abschnitt" id="fragen" aria-labelledby="fragen-titel">
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
    text: 'MAKE Revenue übernimmt die Rolle der Vertriebsleitung auf Zeit, auch Interim oder Fractional Head of Sales genannt. Wir bauen das System, setzen es mit Ihrem Team um und übergeben es so, dass es ohne uns weiterläuft.',
    aktionen: `<a class="knopf knopf-gross" href="../#erstgespraech" data-buchen="zeit">Erstgespräch vereinbaren</a><a class="link-pfeil" href="#tagesworkshop">Erst testen: der Tagesworkshop</a>`,
    vorweg: thema('zeit').vorweg,
    fakten: [['Laufzeit', '6 oder 12 Monate'], ['Einstieg', 'Tagesworkshop Vertrieb, wird beim Start eines Mandats voll angerechnet'], ['Preise', `stehen offen bei ${fam('innovation', 'MAKE Innovation', { pfad: 'preise/' })}`]],
  })}

<section class="abschnitt ton-2" id="angebote" aria-labelledby="angebote-titel">
  <div class="w">
    ${abKopf('Drei Wege', 'Welcher Vertrieb auf Zeit passt zu <em>Ihnen?</em>', 'Der Tagesworkshop zeigt in einem Tag, wo der größte Hebel liegt. Der Head of Sales baut und führt Ihren Vertrieb. Der Chief Sales Officer verantwortet dazu Strategie, Preise und Teamaufbau.', 'angebote-titel')}
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
      <p class="abschnitt-text">Jeder Monat hat ein Ergebnis, das Sie sehen können. Ab Monat 3 läuft jedes Gespräch nach Prozess im CRM und ist sauber dokumentiert. Ziel bis Monat 6: Ihr Team erreicht die Terminzahl aus der Rückwärtsrechnung und schließt ohne Sie ab.</p>
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
    ${abKopf('Vergleich', 'Head of Sales oder Chief Sales <em>Officer?</em>', 'Der Head of Sales baut und führt Ihren Vertrieb: Zielgruppe, Prozess im CRM, Skripte, Kennzahlen und Training. Der Chief Sales Officer macht all das auch und verantwortet dazu Strategie, Preise, Teamaufbau, Recruiting und Partnerschaften. Sie können jederzeit zum Chief Sales Officer wechseln.', 'vergleich-titel')}
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
    ${abKopf('Entscheidung', 'Auf Zeit oder fest <em>einstellen?</em>', 'Eine feste Vertriebsleitung lohnt sich, wenn das System steht und es vor allem um Führung und Wachstum geht. Jemanden auf Zeit holen Sie, wenn das System erst entstehen muss.', 'fest-titel')}
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
        ${punkte(['Zugänge zu CRM, Kalender und Zahlen innerhalb von 5 Werktagen nach dem Kickoff', 'einen festen Ansprechpartner mit Entscheidungsbefugnis', 'Teilnahme am wöchentlichen Vertriebs-Call (30 Minuten)', 'Ihr Team führt die Gespräche selbst, wir machen vor.'])}
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
      ${punkte(['Haben Sie am Abend keine drei Hebel, die Sie umsetzen wollen, zahlen Sie nichts.', 'Starten Sie danach mit dem Head of Sales oder dem Chief Sales Officer, rechnen wir den Workshop voll an.', 'Sie bringen mit: einen Tag Zeit ohne Unterbrechung und Ihre Vertriebszahlen der letzten Monate, soweit vorhanden.'], 'abstand-oben')}
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
    ['Treffen im Netzwerk', 'Wir stellen Unternehmen gezielt Menschen aus unserem Netzwerk vor, die zu ihrer Aufgabe passen.'],
  ];
  const merkmale = [
    ['Auf Einladung', 'Wir laden selbst ein und mischen bewusst, zum Beispiel Start-ups mit Mittelständlern oder Leute aus der Technik mit Leuten aus dem Vertrieb.'],
    ['Persönlich', 'Kleine Runden und klare Themen statt Messehalle. So kommen Sie mit den Menschen ins Gespräch, die für Sie zählen.'],
    ['Verbindend', 'Malin bringt die richtigen Menschen zusammen. Wer zusammenpasst, den verbinden wir nach dem Event gezielt.'],
  ];
  return `${seitenKopf(W, {
    krume: 'Netzwerken und Events',
    titel: 'Netzwerken und Events: Aus Begegnungen werden <em>Verbindungen.</em>',
    text: 'Abende in kleiner Runde, kuratiert und auf Einladung: Gründerinnen und Gründer, Mittelständler und Macher aus KI und Technik. Gastgeberin ist Malin. Die Events veranstaltet MAKE Innovation, dort tragen Sie sich auf die Gästeliste ein.',
    aktionen: `${fam('innovation', 'Einladung erhalten', { pfad: 'events/', klasse: 'knopf knopf-gross' })}<a class="link-pfeil" href="#vertrieb">Wie daraus Vertrieb wird</a>`,
    vorweg: thema('netzwerken').vorweg,
    fakten: [['Kosten', 'Für Gäste kostenlos'], ['Zugang', 'Auf Einladung, über die Gästeliste'], ['Termine', 'Termine, Orte und Formate stehen in jeder Einladung']],
  })}

<section class="abschnitt dunkel" id="formate" aria-labelledby="formate-titel">
  <div class="w">
    ${abKopf('Formate', 'Welche Formate gibt es bei den <em>Events?</em>', 'Vier Formate, von der Gesprächsrunde im kleinen Kreis bis zum Workshop. Diese Formate planen wir. Welches wann stattfindet, steht in der Einladung.', 'formate-titel')}
    <ol class="formate">
${formate.map(([n, t], i) => `      <li class="format erscheint${i ? ` erscheint-${i + 1}` : ''}"><h3>${n}</h3><p>${t}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="abschnitt" id="art" aria-labelledby="art-titel">
  <div class="w">
    ${abKopf('So sind die Abende', 'Auf Einladung, persönlich und <em>verbindend.</em>', '', 'art-titel')}
    <div class="karten-3">
${merkmale.map(([n, t], i) => `      <article class="karte erscheint${i ? ` erscheint-${i + 1}` : ''}"><p class="karte-rolle">0${i + 1}</p><h3 class="karte-titel">${n}</h3><p>${t}</p></article>`).join('\n')}
    </div>
  </div>
</section>

<section class="abschnitt ton-2" id="vertrieb" aria-labelledby="nv-titel">
  <div class="w spalten">
    <div class="spalten-kopf">
      <p class="ueberzeile">Netzwerken mit System</p>
      <h2 class="abschnitt-titel" id="nv-titel">Wie wird aus Netzwerken <em>Vertrieb?</em></h2>
      <p class="abschnitt-text">Indem jede Begegnung denselben Weg nimmt wie jede andere Anfrage: Sie bekommt eine Stufe, eine nächste Aktion und ein Datum. Neue Kunden kommen oft über Empfehlungen, aber nicht planbar. Das lässt sich ändern.</p>
      <a class="link-pfeil" href="../systemvertrieb/">Digitaler Systemvertrieb</a>
    </div>
    <div>
      ${punkte([
        '<b>Kontakte nachfassen.</b> Kontakte von Messe und Event gehören in die Wiedervorlage im CRM, nicht ins Postfach.',
        '<b>Empfehlungen planbar machen.</b> Ein Empfehlungsprogramm gehört zur Leadgenerierung, genauso wie Events.',
        '<b>Gezielt verbinden.</b> Wir stellen Unternehmen gezielt Menschen aus unserem Netzwerk vor, die zu ihrer Aufgabe passen.',
        '<b>Partnerschaften aufbauen.</b> Im Mandat als Chief Sales Officer gehören strategische Partner und Testmärkte dazu.',
      ])}
      <div class="kasten kasten-dunkel dunkel abstand-oben">${zahl(ZAHL.startup)}</div>
    </div>
  </div>
</section>

<section class="abschnitt" id="gastgeberin" aria-labelledby="gast-titel">
  <div class="w">
    ${abKopf('Gastgeberin', 'Malin bringt Menschen <em>zusammen.</em>', 'Malin ist Mitgründerin und Gastgeberin unserer Events. Sie verantwortet Bühne und Netzwerk und überlegt bei jeder Einladung, wer wen kennenlernen sollte.', 'gast-titel')}
    <div class="kaesten-2">
      <div class="kasten">
        <h3>Warum wir Events machen</h3>
        <p>Viele gute Verbindungen entstehen erst, wenn man sich einmal gegenübersitzt. Davon soll der Standort etwas haben, nicht nur wir.</p>
      </div>
      <div class="kasten">
        <h3>Termine</h3>
        <p>Termine, Orte und Formate stehen in jeder Einladung. Tragen Sie sich bei MAKE Innovation auf die Gästeliste ein, dann bekommen Sie die nächste.</p>
        <p>${fam('innovation', 'Zur Gästeliste bei MAKE Innovation', { pfad: 'events/', klasse: 'link-pfeil link-aussen' })}</p>
      </div>
    </div>
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
    titel: 'Vertriebs-Check: Wie planbar ist Ihr <em>Vertrieb?</em>',
    text: 'Zwölf Fragen zu Organisation, Zahlen und Neukunden, dazu zwei in Ihren eigenen Worten. Sie sehen sofort, wo Ihr Vertrieb steht und welcher Schritt jetzt am meisten bringt.',
    aktionen: `${fam('check', 'Vertriebs-Check starten', { klasse: 'knopf knopf-gross' })}<a class="link-pfeil" href="../#erstgespraech" data-buchen>Lieber gleich sprechen</a>`,
    vorweg: thema('check').vorweg,
    fakten: [['Dauer', 'rund 5 Minuten'], ['Kosten', 'kostenlos'], ['Wo', 'Der Check läuft bei MAKE Innovation']],
  })}

<section class="abschnitt ton-2" id="bereiche" aria-labelledby="bereiche-titel">
  <div class="w">
    ${abKopf('Drei Bereiche', 'Was fragt der <em>Vertriebs-Check?</em>', 'Er fragt nach drei Bereichen: Organisation, Zahlen und Neukunden. Zum Schluss kommen zwei Fragen in Ihren eigenen Worten.', 'bereiche-titel')}
    <div class="karten-3">
      <article class="karte erscheint"><p class="karte-rolle">01</p><h3 class="karte-titel">Organisation</h3><p>Gibt es einen festen Ablauf?</p></article>
      <article class="karte erscheint erscheint-2"><p class="karte-rolle">02</p><h3 class="karte-titel">Zahlen</h3><p>Wissen Sie, was im nächsten Quartal kommt?</p></article>
      <article class="karte erscheint erscheint-3"><p class="karte-rolle">03</p><h3 class="karte-titel">Neukunden</h3><p>Kommen neue Kunden planbar?</p></article>
    </div>
  </div>
</section>

<section class="abschnitt" id="danach" aria-labelledby="danach-titel">
  <div class="w">
    ${abKopf('Ablauf', 'Was passiert nach dem <em>Check?</em>', 'Sie sehen Ihr Ergebnis sofort. Wenn Sie möchten, sprechen wir danach im kostenlosen Erstgespräch darüber.', 'danach-titel')}
    <ol class="ablauf-liste">
      <li class="erscheint"><h3>Vertriebs-Check</h3><p>Zwölf Fragen, fast alles per Klick, dazu zwei in Ihren eigenen Worten. Kostenlos.</p></li>
      <li class="erscheint erscheint-2"><h3>Ergebnis</h3><p>Sie sehen sofort, wo Ihr Vertrieb steht und welcher Schritt jetzt am meisten bringt.</p></li>
      <li class="erscheint erscheint-3"><h3>Erstgespräch</h3><p>30 Minuten per Video mit Kevin. Kostenlos und kein Verkaufsgespräch.</p></li>
      <li class="erscheint erscheint-4"><h3>Ihr Vorschlag</h3><p>Wir schlagen Ihnen das passende Angebot vor und nennen Festpreis und Ablauf schriftlich, bevor es losgeht.</p></li>
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
${kontakt(W)}`;
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
<section class="seiten-kopf">
  <div class="w">
    <nav aria-label="Brotkrumen"><ol class="krume"><li><a href="${W}">Start</a></li><li aria-current="page">Fragen</li></ol></nav>
    <div class="seiten-raster">
      <div>
        <h1 class="seiten-titel">Häufige Fragen zum Vertriebsaufbau mit MAKE <em>Revenue.</em></h1>
        <p class="seiten-text">Antworten zu Zusammenarbeit, Systemvertrieb, Vertrieb auf Zeit, Teamaufbau, Events und dem Vertriebs-Check. Jede Antwort steht offen auf dieser Seite.</p>
      </div>
      <aside class="vorweg" aria-label="Das Wichtigste vorweg">
        <p class="ueberzeile">Das Wichtigste vorweg</p>
        <p>Das Erstgespräch ist kostenlos, dauert 30 Minuten und ist kein Verkaufsgespräch. Ihr Team führt die Verkaufsgespräche selbst, wir machen vor.</p>
        <dl><div><dt>Noch offen?</dt><dd><a class="textlink" href="mailto:${MAIL}?subject=Frage%20an%20MAKE%20Revenue">Schreiben Sie uns</a>, wir antworten persönlich.</dd></div></dl>
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
<section class="seiten-kopf">
  <div class="w">
    <p class="ueberzeile">Fehler 404</p>
    <h1 class="seiten-titel">Diese Seite gibt es <em>nicht.</em></h1>
    <p class="seiten-text">Vielleicht wurde sie verschoben. Über die Startseite finden Sie alle Themen von MAKE Revenue.</p>
    <div class="seiten-aktionen"><a class="knopf knopf-gross" href="/">Zur Startseite</a><a class="link-pfeil" href="/fragen/">Häufige Fragen</a></div>
  </div>
</section>`;
}

// ═══════════════════════════════════════ Bauen ═══════════════════════════════════════
const SEITEN = [
  { pfad: '', aktuell: '', klasse: 'seite-start', inhalt: start, skripte: ['rechner.js'], name: 'Start',
    titel: 'MAKE Revenue · Vertrieb mit System für Gründer und Mittelstand',
    beschreibung: 'MAKE Revenue baut Ihren Vertrieb als System auf: Zielgruppe, Prozess im CRM, Kennzahlen und Nachfassen. Einstieg: kostenloser Vertriebs-Check oder Erstgespräch.',
    leistungen: THEMEN.map((t) => ({ name: t.titel, art: t.art, text: t.kurz, pfad: t.pfad })),
    fragen: fr('erstgespraech', 'gespraeche', 'crm', 'preise', 'wer') },
  { pfad: 'systemvertrieb/', aktuell: 'systemvertrieb', klasse: 'seite-unter', inhalt: systemvertrieb, name: 'Digitaler Systemvertrieb',
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
  stand: STAND, mail: MAIL, satz: SATZ,
  seiten: SEITEN.map((s) => ({ pfad: s.pfad, datei: s.pfad + 'index.html', name: s.name, titel: s.titel, beschreibung: s.beschreibung, leistung: s.leistung ? { name: s.leistung.name, art: s.leistung.art, text: s.leistung.text, kurz: s.leistung.kurz } : null, leistungen: s.leistungen || [],
    fragen: (s.fragen || []).map(([f, a]) => ({ f, a: nurText(a) })), begriffe: (s.begriffe || []).map(([name, text]) => ({ name, text })) })),
}, null, 1) + '\n');

console.log(`gebaut: ${SEITEN.length} Seiten + 404.html + seiten.json`);
const { seo } = await import('./seo.mjs');
process.exitCode = seo({ nurPruefen: false }) ? 0 : 1;
