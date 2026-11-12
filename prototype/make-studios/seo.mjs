// MAKE Studios · Bau und Prüfung für Suche und KI-Suchen (Vorgabe SEO-GEO-VORGABEN.md, Abschnitt 8).
// Aufruf im Ordner der Seite:   node seo.mjs            baut alles und prüft
//                               node seo.mjs --pruefen  prüft nur, schreibt nichts
// EIN Schalter: seo.json › "oeffentlich". false = Vorschau (noindex überall, robots.txt sperrt alles, Marke .vorschau).
// true = öffentlich (index, offene robots.txt mit Sitemap, Marke weg). Der Prüfer bricht bei true ab, solange etwas fehlt.
// Die Adressen kommen nur aus familie.js. Die Fallseiten unter websites/ entstehen hier aus websites/daten.json und den
// Karten in index.html; die Demos unter beispiele/ fasst dieses Skript nicht an.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORT = dirname(fileURLToPath(import.meta.url));
const NUR_PRUEFEN = process.argv.includes('--pruefen');
const lies = (p) => readFileSync(join(ORT, p), 'utf8');
const gibts = (p) => existsSync(join(ORT, p));
function schreibe(p, inhalt) {
  if (NUR_PRUEFEN) return;
  mkdirSync(dirname(join(ORT, p)), { recursive: true });
  if (gibts(p) && lies(p) === inhalt) return;
  writeFileSync(join(ORT, p), inhalt);
}

// ── Eingaben ──
const seo = JSON.parse(lies('seo.json'));
const OEFFENTLICH = seo.oeffentlich === true;
const FAMILIE = {};
lies('familie.js').replace(/^\s*(innovation|studios|revenue|check):\s*'([^']+)'/gm, (_, k, v) => { FAMILIE[k] = v.replace(/\/+$/, ''); return ''; });
for (const k of ['innovation', 'studios', 'revenue']) if (!FAMILIE[k]) throw new Error('familie.js: Adresse fehlt: ' + k);
const BASIS = FAMILIE.studios;
const daten = JSON.parse(lies('websites/daten.json'));
const HEUTE = new Date().toISOString().slice(0, 10);
const STANDARDSATZ = 'MAKE Studios ist eine Marke von MAKE Innovation aus Berlin für Websites, Google-Profil, Video, Fotos und Social Media.';
// Standardsätze der beiden anderen Marken: wörtlich gleich auf allen drei Seiten, aber nur in llms.txt und JSON-LD.
// Im sichtbaren Text steht die Zugehörigkeit genau einmal: in der Fußzeile (Schreibregeln 12.11., Abschnitt 2).
const SATZ_REVENUE = 'MAKE Revenue ist eine Marke von MAKE Innovation aus Berlin für Vertrieb mit System, Vertrieb auf Zeit sowie Netzwerken und Events.';
const SATZ_DACH = 'MAKE Innovation aus Berlin führt KI, bessere Abläufe und eigene Software in Unternehmen ein. Zu MAKE Innovation gehören die Marken MAKE Studios und MAKE Revenue.';
const VORSCHAUBILD = '/bild/og-start.png';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&shy;/g, '').replace(/&#8239;/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const PLATZHALTER = /\{\{|NAME_[A-Z]|SATZ_[A-Z]|MERKMAL_[A-Z]|BRANCHE_[A-Z]|THEMA_[A-Z]|AUFGABE_[A-Z]|PASST_[A-Z]/;

// ── Karten der Beispielseiten aus index.html lesen (eine Quelle für Name, Branche, Satz, Merkmale) ──
let start = lies('index.html');
const karten = {};
for (const m of start.matchAll(/<article class="referenz"[^>]*>([\s\S]*?)<\/article>/g)) {
  const k = m[1], slug = (/href="beispiele\/([a-z0-9-]+)\/"/.exec(k) || [])[1];
  if (!slug) continue;
  karten[slug] = {
    name: text((/<a class="referenz-link"[^>]*>([\s\S]*?)<\/a>/.exec(k) || [])[1] || ''),
    branche: text((/<p class="referenz-branche">([\s\S]*?)<\/p>/.exec(k) || [])[1] || ''),
    satz: text((/<p class="referenz-satz">([\s\S]*?)<\/p>/.exec(k) || [])[1] || ''),
    merkmale: Array.from(k.matchAll(/<li>([\s\S]*?)<\/li>/g)).map((x) => text(x[1])),
  };
}
const seiten = daten.seiten.map((s) => Object.assign({}, karten[s.slug] || { name: '', branche: '', satz: '', merkmale: [] }, s));
seiten.forEach((s) => { s.offen = !!s.platzhalter || PLATZHALTER.test([s.name, s.branche, s.satz, s.thema, s.aufgabe, s.passt].concat(s.merkmale).join(' ')); });

// ── Bausteine für den Kopf ──
const robotsMeta = (immerNoindex) => (OEFFENTLICH && !immerNoindex ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow');
const ORG_ID = BASIS + '/#organisation';
function seoBlock({ pfad, titel, beschreibung, graph, noindex, typ = 'website' }) {
  const url = BASIS + pfad;
  const z = [
    '<meta name="robots" content="' + robotsMeta(noindex) + '">',
    '<link rel="canonical" href="' + url + '">',
    '<meta property="og:type" content="' + typ + '">',
    '<meta property="og:site_name" content="MAKE Studios">',
    '<meta property="og:locale" content="de_DE">',
    '<meta property="og:title" content="' + esc(titel) + '">',
    '<meta property="og:description" content="' + esc(beschreibung) + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:image" content="' + BASIS + VORSCHAUBILD + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="MAKE Studios: Websites, Google-Profil, Video und Social Media für Betriebe in Berlin">',
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  if (graph) z.push('<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') + '</script>');
  return z.join('\n');
}
const zwischen = (html, block) => {
  if (!/<!-- seo:anfang -->[\s\S]*?<!-- seo:ende -->/.test(html)) throw new Error('seo-Block fehlt im Kopf');
  return html.replace(/<!-- seo:anfang -->[\s\S]*?<!-- seo:ende -->/, () => '<!-- seo:anfang -->\n' + block + '\n<!-- seo:ende -->');
};
// data-familie-Links: der Rückfall im HTML kommt aus familie.js (Vorschau = Vorschau-Adresse, öffentlich = echte Domain)
const familieLinks = (html) => html.replace(/<a\b[^>]*\bdata-familie="([a-z]+)"[^>]*>/g, (tag, k) => {
  const pf = (/data-pfad="([^"]*)"/.exec(tag) || [])[1] || '/';
  return FAMILIE[k] ? tag.replace(/href="[^"]*"/, 'href="' + FAMILIE[k] + pf + '"') : tag;
});
const webseite = (pfad, titel, beschreibung) => ({ '@type': 'WebPage', '@id': BASIS + pfad + '#webseite', url: BASIS + pfad, name: titel, description: beschreibung,
  isPartOf: { '@id': BASIS + '/#website' }, about: { '@id': ORG_ID }, inLanguage: 'de-DE', dateModified: HEUTE,
  primaryImageOfPage: { '@type': 'ImageObject', url: BASIS + VORSCHAUBILD, width: 1200, height: 630 } });
const krumen = (pfad, liste) => ({ '@type': 'BreadcrumbList', '@id': BASIS + pfad + '#brotkrumen',
  itemListElement: liste.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e[0], item: BASIS + e[1] })) });

// ── Startseite: Kopf-Block mit Organisation, Website, Seite, Leistungen und Fragen (alles steht sichtbar im HTML) ──
const titelStart = text((/<title>([\s\S]*?)<\/title>/.exec(start) || [])[1] || '');
const beschrStart = (/<meta name="description" content="([^"]*)"/.exec(start) || [])[1] || '';
const fragen = Array.from(start.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)).map((m) => [text(m[1]), text(m[2])]);
const leistungen = Array.from(start.matchAll(/<article class="leistung">[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)).map((m) => [text(m[1]), text(m[2])]);
const checkText = text((/id="check-titel">[\s\S]*?<p class="abschnitt-text">([\s\S]*?)<\/p>/.exec(start) || [])[1] || '');
const ART = { 'Website': 'Webdesign', 'Sichtbarkeit bei Google': 'Google-Unternehmensprofil und lokale Sichtbarkeit', 'Video & Foto': 'Videoproduktion und Unternehmensfotografie', 'Social Media': 'Betreuung von Social-Media-Kanälen' };
// Wo die Leistung auf der Startseite ausführlich steht
const ANKER = { 'Website': '#websites', 'Video & Foto': '#video', 'Social Media': '#social' };
const ankerVon = (name) => BASIS + '/' + (ANKER[name] || '#leistungen');
const f = seo.firma || {};
// Angaben, die in seo.json noch als {{…}} stehen, fehlen in den Daten für Suchmaschinen ganz (statt als Platzhalter zu erscheinen).
const echt = (w) => (w && !PLATZHALTER.test(w) ? w : undefined);
const organisation = { '@type': 'Organization', '@id': ORG_ID, name: 'MAKE Studios', url: BASIS + '/', description: STANDARDSATZ,
  logo: { '@type': 'ImageObject', url: BASIS + '/bild/logo.png', width: 512, height: 512 }, email: f.email, telephone: echt(f.telefon),
  address: { '@type': 'PostalAddress', streetAddress: echt(f.strasse), postalCode: echt(f.plz), addressLocality: 'Berlin', addressRegion: 'BE', addressCountry: 'DE' },
  areaServed: { '@type': 'City', name: 'Berlin' }, knowsAbout: ['Webdesign', 'Google-Unternehmensprofil', 'Videoproduktion', 'Erklärvideos', 'Unternehmensfotografie', 'Social Media'],
  brand: { '@type': 'Brand', '@id': BASIS + '/#marke', name: 'MAKE Studios' },
  parentOrganization: { '@type': 'Organization', '@id': FAMILIE.innovation + '/#organisation', name: 'MAKE Innovation', description: SATZ_DACH, url: FAMILIE.innovation + '/' } };
if (f.sameAs && f.sameAs.length) organisation.sameAs = f.sameAs;
const graphStart = [organisation,
  { '@type': 'WebSite', '@id': BASIS + '/#website', url: BASIS + '/', name: 'MAKE Studios', inLanguage: 'de-DE', publisher: { '@id': ORG_ID } },
  webseite('/', titelStart, beschrStart),
  ...leistungen.map(([name, beschr], i) => ({ '@type': 'Service', '@id': BASIS + '/#leistung-' + (i + 1), name: name + ' für Betriebe und Dienstleister', serviceType: ART[name] || name, description: beschr,
    provider: { '@id': ORG_ID }, areaServed: { '@type': 'City', name: 'Berlin' }, audience: { '@type': 'BusinessAudience', audienceType: 'Lokale Betriebe und Dienstleister' }, url: ankerVon(name) })),
  { '@type': 'Service', '@id': BASIS + '/#leistung-check', name: 'Sichtbarkeits-Check', serviceType: 'Analyse der Online-Sichtbarkeit', description: checkText, provider: { '@id': ORG_ID }, areaServed: { '@type': 'City', name: 'Berlin' }, url: BASIS + '/#check' },
  { '@type': 'FAQPage', '@id': BASIS + '/#fragen', inLanguage: 'de-DE', mainEntity: fragen.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }];
start = familieLinks(zwischen(start, seoBlock({ pfad: '/', titel: titelStart, beschreibung: beschrStart, graph: graphStart })));
schreibe('index.html', start);

// ── Gemeinsame Hülle für Fallseiten, Übersicht und 404 ──
function huelle({ tiefe, titel, beschreibung, block, inhalt, klasse = '' }) {
  const w = '../'.repeat(tiefe);
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<!-- seo:anfang -->
${block}
<!-- seo:ende -->
<meta name="theme-color" content="#F2EDE4">
<link rel="icon" href="${w}zeichen.svg" type="image/svg+xml">
<link rel="icon" href="${w}favicon.ico" sizes="32x32">
<link rel="preload" href="${w}schriften/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${w}websites/fall.css">
<script type="module" src="${w}familie.js"></script>
</head>
<body class="${klasse}">
<a class="springen" href="#inhalt">Zum Inhalt</a>
<header class="kopf">
  <a class="marke" href="${w || './'}" aria-label="MAKE Studios, zur Startseite"><img src="${w}zeichen.svg" alt="" width="30" height="30"><span class="marke-wort"><b>MAKE</b> <span>STUDIOS</span></span></a>
  <nav aria-label="Hauptmenü"><a href="${w}websites/">Beispielseiten</a><a href="${w}#leistungen">Leistungen</a><a href="${w}#fragen">Fragen</a></nav>
  <a class="knopf" href="${w}#erstgespraech">Erstgespräch</a>
</header>
<main id="inhalt">
${inhalt}
</main>
<footer class="fuss">
  <p>MAKE Studios · eine Marke von <a data-familie="innovation" href="${FAMILIE.innovation}/">MAKE Innovation</a></p>
  <nav aria-label="Rechtliches"><a href="${w || './'}">Startseite</a><a data-familie="innovation" data-pfad="/impressum/" href="${FAMILIE.innovation}/impressum/">Impressum</a><a data-familie="innovation" data-pfad="/datenschutz/" href="${FAMILIE.innovation}/datenschutz/">Datenschutz</a></nav>
</footer>
</body>
</html>
`;
}

// ── Fallseiten: je Beispiel eine echte Seite von MAKE Studios (CreativeWork, ehrlich als Beispiel benannt) ──
const gebaut = [];
for (const s of seiten) {
  const pfad = '/websites/' + s.slug + '/';
  const titel = 'Website für ' + s.thema + ': Entwurf · MAKE Studios';
  const beschreibung = 'Entwurf von MAKE Studios: Website für ' + s.thema + '. Was die Seite zeigt, welche Bausteine sie hat und für wen sie passt. Der Betrieb ist erfunden.';
  const graph = [webseite(pfad, titel, beschreibung), krumen(pfad, [['Start', '/'], ['Beispielseiten', '/websites/'], [s.thema, pfad]]),
    { '@type': 'CreativeWork', '@id': BASIS + pfad + '#beispiel', name: 'Beispielseite ' + s.name + ': Entwurf für ' + s.thema, description: s.satz, creator: { '@id': ORG_ID }, genre: 'Website-Entwurf',
      about: s.thema, image: BASIS + '/referenzen/' + s.slug + '-poster.webp', dateCreated: s.erstellt, inLanguage: 'de-DE' }];
  const andere = seiten.filter((x) => x !== s && !x.offen).map((x) => `<li><a href="../${x.slug}/">${esc(x.thema)}</a></li>`).join('');
  const inhalt = `<nav class="krumen" aria-label="Sie sind hier"><a href="../../">Start</a> <span aria-hidden="true">›</span> <a href="../">Beispielseiten</a> <span aria-hidden="true">›</span> <span>${esc(s.thema)}</span></nav>
<article class="fall">
  <header class="fall-kopf">
    <p class="ueberzeile">Beispiel · erfundener Betrieb</p>
    <h1>Website für ${esc(s.thema)}: die Beispielseite ${esc(s.name)}</h1>
    <p class="fall-satz">${esc(s.satz)}</p>
    <p class="fall-aktionen"><a class="knopf knopf-signal" href="../../beispiele/${s.slug}/">Beispielseite öffnen</a><a class="knopf" href="../../#erstgespraech-${s.buchen}">Erstgespräch buchen</a></p>
  </header>
  <div class="fall-medien">
    <figure class="fenster">
      <video controls muted loop playsinline preload="none" width="960" height="600" poster="../../referenzen/${s.slug}-poster.webp" aria-label="Bildschirmaufnahme der Beispielseite ${esc(s.name)}, ohne Ton"><source src="../../referenzen/${s.slug}.mp4" type="video/mp4"></video>
      <figcaption>Am Rechner, Aufnahme ohne Ton</figcaption>
    </figure>
    <figure class="handy">
      <img src="../../referenzen/${s.slug}-hoch-poster.webp" alt="Die Beispielseite ${esc(s.name)} auf dem Handy" width="540" height="1168" loading="lazy" decoding="async">
      <figcaption>Auf dem Handy</figcaption>
    </figure>
  </div>
  <section aria-labelledby="f-aufgabe"><h2 id="f-aufgabe">Welche Aufgabe löst die Seite?</h2><p>${esc(s.aufgabe)}</p></section>
  <section aria-labelledby="f-bausteine"><h2 id="f-bausteine">Was enthält die Seite?</h2><ul class="bausteine">${s.merkmale.map((m) => '<li>' + esc(m) + '</li>').join('')}</ul>${s.aufbau ? '<p>' + esc(s.aufbau) + '</p>' : ''}<p>Wie jede unserer Seiten ist sie zuerst für das Handy gestaltet und lädt schnell.</p></section>
  <section aria-labelledby="f-passt"><h2 id="f-passt">Für wen passt so eine Seite?</h2><p>${esc(s.passt)}</p></section>
  <section aria-labelledby="f-weiter"><h2 id="f-weiter">Wie entsteht Ihre eigene Seite?</h2><p>In sechs Schritten: Briefing, Design, Feedback, Umsetzung, Abnahme, Live. Sie sehen den Entwurf, bevor wir bauen, und online geht die Seite erst mit Ihrem Okay. <a href="../../#ablauf">Zum Ablauf</a></p>
    <p class="fall-aktionen"><a class="knopf knopf-signal" href="../../#erstgespraech-${s.buchen}">Erstgespräch buchen</a><a class="knopf" href="../../#check">Sichtbarkeits-Check machen</a></p></section>
  <aside aria-labelledby="f-andere"><h2 id="f-andere">Weitere Beispielseiten</h2><ul class="andere">${andere}</ul></aside>
  <p class="stand">Stand: ${esc(seo.stand)}</p>
</article>`;
  schreibe('websites/' + s.slug + '/index.html', huelle({ tiefe: 2, titel, beschreibung, inhalt, block: seoBlock({ pfad, titel, beschreibung, graph, noindex: s.offen, typ: 'article' }) }));
  gebaut.push({ pfad, datei: 'websites/' + s.slug + '/index.html', titel, beschreibung, offen: s.offen, bild: '/referenzen/' + s.slug + '-poster.webp' });
}

// ── Übersicht der Fallseiten: echte Seite, Filter als Links ──
{
  const pfad = '/websites/', titel = 'Beispielseiten: acht Website-Entwürfe · MAKE Studios';
  const beschreibung = 'Acht Beispielseiten von MAKE Studios für erfundene Betriebe aus Gastronomie, Bau, Handwerk, Beratung und Büro. Gebaut, erklärt und zum Durchklicken.';
  const fertig = seiten.filter((s) => !s.offen);
  const graph = [webseite(pfad, titel, beschreibung), krumen(pfad, [['Start', '/'], ['Beispielseiten', pfad]]),
    { '@type': 'ItemList', '@id': BASIS + pfad + '#liste', name: 'Beispielseiten von MAKE Studios', itemListElement: fertig.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: 'Website für ' + s.thema, url: BASIS + '/websites/' + s.slug + '/' })) }];
  const gruppen = Object.entries(daten.arten).map(([art, name]) => {
    const anker = 'art-' + art, liste = seiten.filter((s) => s.art === art && !(OEFFENTLICH && s.offen));
    if (!liste.length) return '';
    return `<section class="gruppe" id="${anker}" aria-labelledby="${anker}-t"><h2 id="${anker}-t">${esc(name)}</h2><div class="raster">` + liste.map((s) => `
      <article class="karte"><a class="karte-bild" href="${s.slug}/" tabindex="-1" aria-hidden="true"><img src="../referenzen/${s.slug}-poster.webp" alt="" width="960" height="600" loading="lazy" decoding="async"></a>
        <p class="ueberzeile">${esc(s.branche)}</p><h3><a href="${s.slug}/">Website für ${esc(s.thema)}</a></h3><p>${esc(s.satz)}</p>
        <p class="karte-wege"><a href="${s.slug}/">So ist sie gebaut</a><a href="../beispiele/${s.slug}/">Beispielseite ${esc(s.name)} öffnen</a></p></article>`).join('') + '</div></section>';
  }).join('\n');
  const inhalt = `<nav class="krumen" aria-label="Sie sind hier"><a href="../">Start</a> <span aria-hidden="true">›</span> <span>Beispielseiten</span></nav>
<header class="fall-kopf"><p class="ueberzeile">Beispielseiten</p><h1>Beispielseiten: Website-Entwürfe für Betriebe und Dienstleister</h1>
  <p class="fall-satz">Acht vollständige Websites für erfundene Betriebe. Zu jeder lesen Sie, welche Aufgabe sie löst, was sie enthält und für wen sie passt.</p>
  <p class="filter-links" aria-label="Nach Art springen">${Object.entries(daten.arten).map(([art, name]) => `<a href="#art-${art}">${esc(name)}</a>`).join('')}</p></header>
${gruppen}
<p class="stand">Stand: ${esc(seo.stand)}</p>`;
  schreibe('websites/index.html', huelle({ tiefe: 1, titel, beschreibung, inhalt, block: seoBlock({ pfad, titel, beschreibung, graph }) }));
  gebaut.push({ pfad, datei: 'websites/index.html', titel, beschreibung, offen: false });
}

// ── 404 ──
schreibe('404.html', huelle({ tiefe: 0, titel: 'Seite nicht gefunden · MAKE Studios', beschreibung: 'Diese Adresse gibt es bei MAKE Studios nicht. Zur Startseite, zu den Beispielseiten oder zum Erstgespräch.', klasse: 'nichts',
  block: '<meta name="robots" content="noindex, nofollow">\n<base href="' + BASIS + '/">',
  inhalt: '<header class="fall-kopf"><p class="ueberzeile">Fehler 404</p><h1>Diese Seite gibt es nicht.</h1><p class="fall-satz">Die Adresse ist falsch oder die Seite ist umgezogen.</p><p class="fall-aktionen"><a class="knopf knopf-signal" href="./">Zur Startseite</a><a class="knopf" href="websites/">Beispielseiten</a><a class="knopf" href="./#erstgespraech">Erstgespräch buchen</a></p></header>' }));

// ── robots.txt, sitemap.xml, llms.txt, Marke .vorschau ──
const KI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'CCBot', 'Meta-ExternalAgent'];
schreibe('robots.txt', OEFFENTLICH
  ? 'User-agent: *\nAllow: /\n\n# Demo-Seiten erfundener Betriebe: KI-Bots sollen sie nicht einlesen. Googlebot und Bingbot bleiben erlaubt, damit sie das noindex sehen.\n'
    + KI_BOTS.map((b) => 'User-agent: ' + b).join('\n') + '\nDisallow: /beispiele/\n\nSitemap: ' + BASIS + '/sitemap.xml\n'
  : '# Vorschau: nichts freigegeben (seo.json › oeffentlich: false)\nUser-agent: *\nDisallow: /\n');

const hash = (p) => createHash('sha1').update(lies(p).replace(/<!-- seo:anfang -->[\s\S]*?<!-- seo:ende -->/, '')).digest('hex').slice(0, 12);
const standAlt = gibts('seo-stand.json') ? JSON.parse(lies('seo-stand.json')) : {};
const stand = {};
const inSitemap = [{ pfad: '/', datei: 'index.html', bild: '/referenzen/cafe-roesterei-poster.webp' }].concat(gebaut.filter((g) => !g.offen));
for (const e of inSitemap) {
  if (NUR_PRUEFEN && !gibts(e.datei)) continue;
  const h = hash(e.datei), alt = standAlt[e.pfad];
  stand[e.pfad] = alt && alt.hash === h ? alt : { hash: h, datum: HEUTE };
}
schreibe('seo-stand.json', JSON.stringify(stand, null, 1) + '\n');
schreibe('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
  + inSitemap.map((e) => '  <url><loc>' + BASIS + e.pfad + '</loc><lastmod>' + ((stand[e.pfad] || {}).datum || HEUTE) + '</lastmod>' + (e.bild ? '<image:image><image:loc>' + BASIS + e.bild + '</image:loc></image:image>' : '') + '</url>').join('\n') + '\n</urlset>\n');
schreibe('llms.txt', '# MAKE Studios\n\n> ' + STANDARDSATZ + '\n\n## Leistungen\n'
  + leistungen.map(([n, b]) => '- [' + n + '](' + ankerVon(n) + '): ' + b).join('\n') + '\n- [Sichtbarkeits-Check](' + BASIS + '/#check): ' + checkText
  + '\n\n## Beispielseiten\n- [Übersicht](' + BASIS + '/websites/): Website-Entwürfe für erfundene Betriebe, je Seite erklärt\n'
  + seiten.filter((s) => !s.offen).map((s) => '- [Website für ' + s.thema + '](' + BASIS + '/websites/' + s.slug + '/): ' + s.satz).join('\n')
  + '\n\n## Kontakt\n- E-Mail: ' + (f.email || '') + '\n- Erstgespräch: ' + BASIS + '/#erstgespraech\n\n## Weitere Angebote\n- [MAKE Innovation](' + FAMILIE.innovation + '/): ' + SATZ_DACH + '\n- [MAKE Revenue](' + FAMILIE.revenue + '/): ' + SATZ_REVENUE + '\n');
if (!NUR_PRUEFEN) {
  if (OEFFENTLICH) { if (gibts('.vorschau')) unlinkSync(join(ORT, '.vorschau')); }
  else writeFileSync(join(ORT, '.vorschau'), 'Vorschau: nicht freigegeben. Der Server setzt X-Robots-Tag noindex, solange diese Datei liegt.\n');
  if (OEFFENTLICH && seo.indexnow && !/\{\{/.test(seo.indexnow)) writeFileSync(join(ORT, seo.indexnow + '.txt'), seo.indexnow);
}

// ── Prüfer ──
const fehler = [], hinweise = [];
const melde = (hart, t) => (hart ? fehler : hinweise).push(t);
const dateien = ['index.html', '404.html', 'websites/index.html'].concat(seiten.map((s) => 'websites/' + s.slug + '/index.html')).filter(gibts);
const titelGesehen = new Map(), beschrGesehen = new Map();
for (const d of dateien) {
  const html = lies(d), istFehlerseite = d === '404.html', offen = seiten.some((s) => s.offen && d === 'websites/' + s.slug + '/index.html');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) melde(true, d + ': ' + h1 + ' h1 statt genau einer');
  const t = text((/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1] || ''), b = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  if (!offen && (t.length < 15 || t.length > 65)) melde(true, d + ': Titel hat ' + t.length + ' Zeichen (15 bis 65)');
  if (!offen && !istFehlerseite && (b.length < 110 || b.length > 165)) melde(true, d + ': Beschreibung hat ' + b.length + ' Zeichen (110 bis 165)');
  if (titelGesehen.has(t)) melde(!offen, d + ': Titel doppelt mit ' + titelGesehen.get(t)); else titelGesehen.set(t, d);
  if (beschrGesehen.has(b)) melde(!offen, d + ': Beschreibung doppelt mit ' + beschrGesehen.get(b)); else beschrGesehen.set(b, d);
  const robots = (/<meta name="robots" content="([^"]*)"/.exec(html) || [])[1] || '';
  if (!OEFFENTLICH && !/noindex/.test(robots)) melde(true, d + ': Vorschau ohne noindex');
  if (OEFFENTLICH && !istFehlerseite && !offen && !/^index, follow/.test(robots)) melde(true, d + ': öffentlich, aber robots = ' + robots);
  if ((istFehlerseite || offen) && !/noindex/.test(robots)) melde(true, d + ': muss noindex bleiben');
  if (!istFehlerseite) {
    const kan = (/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1] || '';
    if (!kan) melde(true, d + ': Canonical fehlt');
    else if (!kan.startsWith(BASIS + '/')) melde(true, d + ': Canonical zeigt auf fremde Adresse ' + kan);
    else if (OEFFENTLICH && !kan.startsWith('https://')) melde(true, d + ': Canonical ohne https');
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let j; try { j = JSON.parse(m[1]); } catch (e) { melde(true, d + ': JSON-LD ungültig (' + e.message + ')'); continue; }
      const leer = []; (function geh(o, weg) { if (o === '' || o === null || o === undefined) leer.push(weg); else if (typeof o === 'object') for (const k in o) geh(o[k], weg + '.' + k); })(j, '');
      if (leer.length) melde(true, d + ': JSON-LD mit leerem Feld ' + leer.join(', '));
      if (PLATZHALTER.test(m[1])) melde(OEFFENTLICH && !offen, d + ': JSON-LD enthält noch Platzhalter (Telefon, Anschrift oder Texte)');
    }
    if ((html.match(/application\/ld\+json/g) || []).length !== 1) melde(true, d + ': nicht genau ein JSON-LD-Block');
  }
  if (PLATZHALTER.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''))) melde(OEFFENTLICH && !offen, d + ': Platzhaltertext im sichtbaren Inhalt');
  if (OEFFENTLICH && /localhost|127\.0\.0\.1/.test(html)) melde(true, d + ': Vorschau-Adresse (localhost) in öffentlicher Datei');
  if (/—/.test(html)) melde(true, d + ': Gedankenstrich im Text');
  // Vorgabe 11.11.: keine Rechtsform und kein Firmenname auf MAKE Studios, auch nicht in den Daten; das nennt nur das Impressum des Dachs
  if (/\bGmbH\b|\bUG\b|legalName|Handelsregister|\bHRB\b/.test(html)) melde(true, d + ': Rechtsform oder Firmenname genannt (nur das Impressum des Dachs nennt sie)');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0]) || !/\swidth="/.test(m[0]) || !/\sheight="/.test(m[0])) melde(true, d + ': Bild ohne alt oder feste Maße: ' + m[0].slice(0, 80));
}
// Fragen in den Daten müssen sichtbar sein (hier per Bauweise gleich, trotzdem geprüft)
{ const html = gibts('index.html') ? lies('index.html') : ''; const sicht = text(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  for (const [q] of fragen) if (!sicht.includes(q)) melde(true, 'index.html: Frage in den Daten, aber nicht sichtbar: ' + q);
  if (fragen.length < 5) melde(true, 'index.html: weniger als fünf Fragen gefunden');
  if (leistungen.length !== 4) melde(true, 'index.html: nicht genau vier Leistungen gefunden (' + leistungen.length + ')');
  for (const [n] of leistungen) if (!ART[n]) melde(true, 'index.html: Leistung ohne Art in den Daten: ' + n);
  // Standardsätze: wörtlich in den Daten für Suchmaschinen (JSON-LD) und in llms.txt. Sichtbar steht die Zugehörigkeit nur in der Fußzeile.
  const ld = (/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html) || [])[1] || '', llms = gibts('llms.txt') ? lies('llms.txt') : '';
  for (const [n, s] of [['MAKE Studios', STANDARDSATZ], ['MAKE Innovation', SATZ_DACH]]) if (!ld.includes(JSON.stringify(s).slice(1, -1))) melde(true, 'index.html: Standardsatz von ' + n + ' fehlt in den strukturierten Daten');
  for (const [n, s] of [['MAKE Studios', STANDARDSATZ], ['MAKE Revenue', SATZ_REVENUE], ['MAKE Innovation', SATZ_DACH]]) if (!llms.includes(s)) melde(true, 'llms.txt: Standardsatz von ' + n + ' fehlt');
  const fuss = text((/<footer class="fuss">([\s\S]*?)<\/footer>/.exec(html) || [])[1] || '');
  if (!fuss.includes('MAKE Studios · eine Marke von MAKE Innovation')) melde(true, 'index.html: Fußzeile „MAKE Studios · eine Marke von MAKE Innovation“ fehlt'); }
// Innensicht: Wörter über unsere Aufteilung und Sätze über die Seite selbst stehen nicht im sichtbaren Text (Schreibregeln 12.11., Abschnitt 2)
{ const INNEN = /Familie|Das Dach|Zuhause|im selben Haus|weitere Adressen|auf dieser Seite|eigene Marke|Platzhalter/;
  for (const d of dateien) { const sicht = text(lies(d).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '')); const m = INNEN.exec(sicht);
    if (m) melde(true, d + ': Innensicht im sichtbaren Text („' + m[0] + '“)'); } }
if (!gibts('bild/og-start.png')) melde(true, 'Vorschaubild bild/og-start.png fehlt');
if (!gibts('bild/logo.png')) melde(true, 'Logo bild/logo.png fehlt');
if (gibts('sitemap.xml')) { const sm = lies('sitemap.xml'); for (const s of seiten) if (s.offen && sm.includes('/websites/' + s.slug + '/')) melde(true, 'Sitemap enthält noindex-Seite ' + s.slug);
  if (/\/beispiele\//.test(sm) || /404/.test(sm)) melde(true, 'Sitemap enthält Demo oder 404'); }
// Demos: müssen noindex tragen und dürfen kein JSON-LD haben (nur lesen, nichts ändern)
if (gibts('beispiele')) for (const n of readdirSync(join(ORT, 'beispiele'), { withFileTypes: true })) {
  if (!n.isDirectory() || n.name.startsWith('_') || n.name === 'vendor') continue;
  const d = 'beispiele/' + n.name + '/index.html';
  if (!gibts(d)) { melde(OEFFENTLICH, d + ' fehlt (Karte und Fallseite verweisen darauf)'); continue; }
  const html = lies(d);
  if (!/<meta name="robots" content="[^"]*noindex/.test(html)) melde(true, d + ': Demo ohne noindex');
  if (/application\/ld\+json/.test(html)) melde(true, d + ': Demo mit JSON-LD');
}
for (const s of seiten) { if (!gibts('beispiele/' + s.slug + '/index.html')) melde(OEFFENTLICH, 'Demo beispiele/' + s.slug + '/ fehlt');
  for (const x of ['.mp4', '-poster.webp', '-hoch.mp4', '-hoch-poster.webp']) if (!gibts('referenzen/' + s.slug + x)) melde(OEFFENTLICH, 'Datei referenzen/' + s.slug + x + ' fehlt'); }
{ const fehlt = [['Telefon', f.telefon], ['Straße', f.strasse], ['PLZ', f.plz]].filter((x) => !echt(x[1])).map((x) => x[0]);
  if (fehlt.length) melde(false, 'seo.json › firma: ' + fehlt.join(', ') + ' noch offen; die Angaben fehlen so lange in den Daten für Suchmaschinen'); }
if (OEFFENTLICH) { if (!BASIS.startsWith('https://')) melde(true, 'familie.js: studios ist keine https-Adresse');
  if (gibts('.vorschau') && NUR_PRUEFEN) melde(true, 'Marke .vorschau liegt noch');
  if (seiten.some((s) => s.offen)) melde(false, 'Fallseiten mit Platzhaltern bleiben noindex und fehlen in der Sitemap: ' + seiten.filter((s) => s.offen).map((s) => s.slug).join(', '));
  hinweise.push('Impressum und Datenschutz verweisen auf das Dach (' + FAMILIE.innovation + '). Die Vorgabe empfiehlt je Domain eigene Seiten.'); }

console.log((OEFFENTLICH ? 'ÖFFENTLICH' : 'VORSCHAU') + ' · ' + BASIS + ' · ' + dateien.length + ' Seiten · Sitemap ' + inSitemap.length + ' Adressen' + (NUR_PRUEFEN ? ' · nur geprüft' : ' · gebaut'));
hinweise.forEach((t) => console.log('  Hinweis: ' + t));
fehler.forEach((t) => console.log('  FEHLER:  ' + t));
if (fehler.length) { console.log(fehler.length + ' Fehler.'); process.exit(1); }
console.log('Prüfer grün.');
