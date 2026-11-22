// MAKE Studios · Bau und Prüfung für Suche und KI-Suchen (Vorgabe SEO-GEO-VORGABEN.md, Abschnitt 8).
// Aufruf im Ordner der Seite:   node seo.mjs            baut alles und prüft
//                               node seo.mjs --pruefen  prüft nur, schreibt nichts
// EIN Schalter: seo.json › "oeffentlich". false = Vorschau (noindex überall, robots.txt sperrt alles, Marke .vorschau).
// true = öffentlich (index, offene robots.txt mit Sitemap, Marke weg). Der Prüfer bricht bei true ab, solange etwas fehlt.
// Die Adressen kommen nur aus familie.js. Die Fallseiten unter websites/ entstehen hier aus websites/daten.json und den
// Karten in index.html; die Demos unter beispiele/ fasst dieses Skript nicht an.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'node:fs';
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
// Preise: nur aus preise.json (erzeugt von preise-bauen.mjs aus der EINEN Preisliste von MAKE Innovation, nie von Hand). Im HTML stehen sie als
// <span data-preis="schlüssel" data-form="ab|rhythmus">…</span>, dieses Skript füllt den Inhalt; Texte in Fallseiten und llms.txt kommen aus preisText().
if (!gibts('preise.json')) throw new Error('preise.json fehlt: erst node preise-bauen.mjs ausführen (Quelle: Preisliste von MAKE Innovation)');
const PREISE = JSON.parse(lies('preise.json'));
const NBSP = '\u00a0';
const preisEintrag = (k) => { const e = PREISE.eintraege[k]; if (!e) throw new Error('preise.json: Eintrag fehlt: ' + k); return e; };
const preisAb = (k) => preisEintrag(k).ab.replace(/ €$/, NBSP + '€');
const preisRhythmus = (k) => { const e = preisEintrag(k); return 'netto' + (e.rhythmus === 'einmalig' ? ', einmalig' : ' im Monat') + (e.mindestlaufzeit ? ', ' + e.mindestlaufzeit : ''); };
const preisText = (k, form = 'voll') => (k === 'stand' ? 'Stand ' + PREISE.standText : form === 'ab' ? preisAb(k) : form === 'rhythmus' ? preisRhythmus(k) : preisAb(k) + ' ' + preisRhythmus(k));
const preisAngebot = (k, name) => { const e = preisEintrag(k); return { '@type': 'Offer', name: name || e.kurzname, description: preisAb(k).replace(NBSP, ' ') + ' ' + preisRhythmus(k), priceCurrency: 'EUR', priceSpecification: { '@type': 'PriceSpecification', minPrice: e.betrag, priceCurrency: 'EUR', valueAddedTaxIncluded: false }, seller: { '@id': BASIS + '/#organisation' } }; };
const HEUTE = new Date().toISOString().slice(0, 10);
const STANDARDSATZ = 'MAKE Studios ist eine Marke von MAKE Innovation aus Berlin für Google-Profil, Foto, Video, Social Media und Websites.';
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
start = start.replace(/<span data-preis="([a-z-]+)"(?: data-form="([a-z]+)")?>[^<]*<\/span>/g, (m, k, fo) => '<span data-preis="' + k + '"' + (fo ? ' data-form="' + fo + '"' : '') + '>' + preisText(k, fo || 'voll') + '</span>');
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
const ANZAHL = ['', 'Eine', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf', 'Zwölf'][daten.seiten.length] || String(daten.seiten.length);
seiten.forEach((s) => { s.offen = !!s.platzhalter || PLATZHALTER.test([s.name, s.branche, s.satz, s.thema, s.aufgabe, s.passt].concat(s.merkmale).join(' ')); });

// ── Bausteine für den Kopf ──
const robotsMeta = (immerNoindex) => (OEFFENTLICH && !immerNoindex ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow');
const ORG_ID = BASIS + '/#organisation';
function seoBlock({ pfad, titel, beschreibung, graph, noindex, typ = 'website', bild = VORSCHAUBILD, bildAlt = 'MAKE Studios: sichtbar auf allen Ebenen mit Google-Profil, Foto, Video, Social Media und Website, für Betriebe in Berlin' }) {
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
    '<meta property="og:image" content="' + BASIS + bild + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="' + esc(bildAlt) + '">',
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
const webseite = (pfad, titel, beschreibung, bild = VORSCHAUBILD) => ({ '@type': 'WebPage', '@id': BASIS + pfad + '#webseite', url: BASIS + pfad, name: titel, description: beschreibung,
  isPartOf: { '@id': BASIS + '/#website' }, about: { '@id': ORG_ID }, inLanguage: 'de-DE', dateModified: HEUTE,
  primaryImageOfPage: { '@type': 'ImageObject', url: BASIS + bild, width: 1200, height: 630 } });
const krumen = (pfad, liste) => ({ '@type': 'BreadcrumbList', '@id': BASIS + pfad + '#brotkrumen',
  itemListElement: liste.map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: e[0], item: BASIS + e[1] })) });

// ── Startseite: Kopf-Block mit Organisation, Website, Seite, Leistungen und Fragen (alles steht sichtbar im HTML) ──
const titelStart = text((/<title>([\s\S]*?)<\/title>/.exec(start) || [])[1] || '');
// Beschreibung der Startseite: Vorlage aus seo.json (Preise nur aus preise.json, nie von Hand)
if (seo.startBeschreibung) start = start.replace(/(<meta name="description" content=")[^"]*(">)/, (m, x, y) => x + esc(seo.startBeschreibung.replace(/\{\{preis:([a-z-]+)\}\}/g, (_, k) => preisAb(k).replace(NBSP, ' '))) + y);
const beschrStart = (/<meta name="description" content="([^"]*)"/.exec(start) || [])[1] || '';
const fragen = Array.from(start.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)).map((m) => [text(m[1]), text(m[2])]);
const leistungen = Array.from(start.matchAll(/<article class="leistung">[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)).map((m) => [text(m[1]), text(m[2])]);
const checkText = text((/id="check-titel">[\s\S]*?<p class="abschnitt-text">([\s\S]*?)<\/p>/.exec(start) || [])[1] || '');
// Videos: Erklärvideo und Beispiel-Reels (Poster, Name, Beschreibung stehen sichtbar im HTML; Dauer liest dieses Skript aus der mp4-Datei)
function mp4Dauer(p) {
  if (!gibts(p)) return null;
  const b = readFileSync(join(ORT, p)), i = b.indexOf('mvhd');
  if (i < 0) return null;
  const o = i + 8 + (b[i + 4] === 1 ? 16 : 8), ts = b.readUInt32BE(o), d = b[i + 4] === 1 ? Number(b.readBigUInt64BE(o + 4)) : b.readUInt32BE(o + 4);
  return ts ? d / ts : null;
}
const isoDauer = (sek) => { const g = Math.max(1, Math.round(sek)); return 'PT' + (g >= 60 ? Math.floor(g / 60) + 'M' : '') + (g % 60 ? (g % 60) + 'S' : ''); };
const dateiTag = (p) => statSync(join(ORT, p)).mtime.toISOString().slice(0, 10);
const videoObjekt = (id, name, beschr, poster, datei, abschnitt) => { const d = mp4Dauer(datei);
  return { '@type': 'VideoObject', '@id': BASIS + '/#' + id, name, description: beschr, thumbnailUrl: BASIS + '/' + poster, uploadDate: dateiTag(datei), contentUrl: BASIS + '/' + datei,
    ...(d ? { duration: isoDauer(d) } : {}), inLanguage: 'de-DE', creator: { '@id': ORG_ID }, ...(abschnitt ? { isPartOf: { '@id': BASIS + '/#webseite' }, url: BASIS + abschnitt } : {}) }; };
const videosStart = [];
{ const ev = /<video[^>]*poster="(medien\/erklaervideo[^"]+)"[^>]*aria-label="([^"]+)"[^>]*><source src="([^"]+\.mp4)"/.exec(start);
  if (ev) videosStart.push(videoObjekt('video-erklaervideo', 'Beispiel für ein Erklärvideo von MAKE Studios', text(ev[2]), ev[1], ev[3], '/#video'));
  for (const m of start.matchAll(/data-reel="(reels\/[a-z0-9-]+\.mp4)" data-reel-name="([^"]+)">\s*<img class="reel-poster" src="([^"]+)" alt="([^"]+)"/g))
    videosStart.push(videoObjekt('video-reel-' + m[1].slice(6, -4), 'Beispiel-Reel ' + text(m[2]) + ' von MAKE Studios', text(m[4]), m[3], m[1], '/#reels')); }
// Social Media in drei Paketen: Name, Inhalt und Hinweis stehen sichtbar im Abschnitt #social (eine Quelle für die Daten und llms.txt).
// Preise nennt diese Seite nicht; sie stehen auf dem Preisblatt von MAKE Innovation (Adresse aus familie.js).
const socialTeil = (/<section\b[^>]*\bid="social"[\s\S]*?<\/section>/.exec(start) || [''])[0];
const pakete = Array.from(socialTeil.matchAll(/<li><span>[^<]*<\/span><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p>(?:<p class="paket-preis">[\s\S]*?<\/p>)?<\/li>/g)).map((m) => [text(m[1]), text(m[2])]);
const paketHinweis = text((/<p class="social-hinweis">([\s\S]*?)<\/p>/.exec(socialTeil) || [])[1] || '');
const ablauf = Array.from(((/<section[^>]*\bid="ablauf"[\s\S]*?<\/section>/.exec(start) || [''])[0]).matchAll(/<li><span>[^<]*<\/span><h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/li>/g)).map((m) => [text(m[1]), text(m[2].replace(/<\/p>/g, '. ').replace(/\.\s*\./g, '.'))]);
const formate = Array.from(start.matchAll(/<h4 class="format-name">([\s\S]*?)<\/h4>\s*<p>([\s\S]*?)<\/p>\s*<p class="format-frist">([\s\S]*?)<\/p>/g)).map((m) => [text(m[1]), text(m[2]), text(m[3])]);
const PFAD_SOCIAL_PREISE = '/sichtbarkeit/social-media/';
const ART = { 'Website': 'Webdesign', 'Sichtbarkeit bei Google': 'Google-Unternehmensprofil und lokale Sichtbarkeit', 'Video & Foto': 'Videoproduktion und Unternehmensfotografie', 'Social Media': 'Betreuung von Social-Media-Kanälen' };
// Wo die Leistung auf der Startseite ausführlich steht
const ANKER = { 'Website': '#websites', 'Video & Foto': '#video', 'Social Media': '#social' };
const ankerVon = (name) => BASIS + '/' + (ANKER[name] || '#leistungen');
const f = seo.firma || {};
// Angaben, die in seo.json noch als {{…}} stehen, fehlen in den Daten für Suchmaschinen ganz (statt als Platzhalter zu erscheinen).
const echt = (w) => (w && !PLATZHALTER.test(w) ? w : undefined);
const organisation = { '@type': 'Organization', '@id': ORG_ID, name: 'MAKE Studios', url: BASIS + '/', description: STANDARDSATZ,
  logo: { '@type': 'ImageObject', url: BASIS + '/bild/logo.png', width: 512, height: 512 }, email: f.email, telephone: echt(f.telefon),
  address: { '@type': 'PostalAddress', streetAddress: echt(f.strasse), postalCode: echt(f.plz), addressLocality: echt(f.ort), addressRegion: echt(f.region), addressCountry: 'DE' },
  areaServed: { '@type': 'City', name: 'Berlin' }, knowsAbout: ['Sichtbarkeit für Unternehmen', 'Webdesign', 'Website erstellen lassen', 'Google-Unternehmensprofil', 'Videoproduktion', 'Erklärvideos', 'Imagefilm', 'Reels', 'Unternehmensfotografie', 'Social Media Betreuung'],
  brand: { '@type': 'Brand', '@id': BASIS + '/#marke', name: 'MAKE Studios' },
  ...(f.email ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', email: f.email, availableLanguage: 'de', url: BASIS + '/#erstgespraech' } } : {}),
  parentOrganization: { '@type': 'Organization', '@id': FAMILIE.innovation + '/#organisation', name: 'MAKE Innovation', description: SATZ_DACH, url: FAMILIE.innovation + '/' } };
if (f.sameAs && f.sameAs.length) organisation.sameAs = f.sameAs;
const graphStart = [organisation,
  { '@type': 'WebSite', '@id': BASIS + '/#website', url: BASIS + '/', name: 'MAKE Studios', inLanguage: 'de-DE', publisher: { '@id': ORG_ID } },
  webseite('/', titelStart, beschrStart),
  ...leistungen.map(([name, beschr], i) => ({ '@type': 'Service', '@id': BASIS + '/#leistung-' + (i + 1), name: name + ' für Betriebe und Dienstleister', serviceType: ART[name] || name, description: beschr,
    provider: { '@id': ORG_ID }, areaServed: { '@type': 'City', name: 'Berlin' }, audience: { '@type': 'BusinessAudience', audienceType: 'Lokale Betriebe und Dienstleister' }, url: ankerVon(name),
    ...(name === 'Social Media' && pakete.length ? { hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Social Media in drei Paketen', description: paketHinweis || undefined,
      itemListElement: pakete.map(([n, b], j) => ({ ...preisAngebot('social-' + 'sml'[j], n), itemOffered: { '@type': 'Service', name: n, description: b } })) } } : {}),
    ...(name === 'Website' ? { offers: preisAngebot('website', 'Website ab Homepage Landing') } : {}),
    ...(name === 'Video & Foto' ? { offers: ['erklaervideo', 'videostory', 'video-serie'].map((k) => preisAngebot(k)) } : {}) })),
  { '@type': 'Service', '@id': BASIS + '/#leistung-check', name: 'Schnelltest Sichtbarkeit', serviceType: 'Analyse der Online-Sichtbarkeit', description: checkText, provider: { '@id': ORG_ID }, areaServed: { '@type': 'City', name: 'Berlin' }, url: BASIS + '/#check' },
  ...videosStart,
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

// ── Fallseiten: je Beispiel eine echte Seite von MAKE Studios („Website für <Branche>“; CreativeWork ehrlich als Beispiel benannt) ──
// Fragen der Fallseite: die Antworten beschreiben nur, wie MAKE Studios eine solche Seite baut (Daten: begriff, kundenfragen, aufgabe, merkmale; Ablauf und Bedarf wie auf der Startseite).
const fallFragen = (s) => (s.fragen && s.fragen.length ? s.fragen : [
  ['Was gehört auf eine Website für ' + s.begriff + '?', 'Auf eine solche Seite gehört, was Besucher vor der Anfrage suchen, und ein kurzer Weg zur Anfrage. Die Beispielseite ' + s.name + ' setzt dafür auf: ' + s.merkmale.join(', ') + '.'],
  ['Welche Fragen stellen Besucher vor der Anfrage?', 'Typisch sind diese: ' + s.kundenfragen.join(' ') + ' Eine gute Website beantwortet sie, bevor jemand anruft, oder zeigt den Weg zur Antwort. Die fachlichen Antworten kennt Ihr Betrieb; wir bauen den Platz dafür und schreiben die Texte gern aus dem Gespräch.'],
  ['Wie läuft der Bau einer Website für ' + s.begriff + ' ab?', 'In sechs Schritten: Briefing, Design, Feedback, Umsetzung, Abnahme, Live. Sie sehen den Entwurf, bevor wir bauen, und online geht die Seite erst mit Ihrem Okay.'],
  ['Was kostet eine Website für ' + s.begriff + '?', 'Das hängt vom Umfang ab. Nach dem Erstgespräch bekommen Sie einen Festpreis, schriftlich und bevor wir anfangen. Websites gibt es ' + preisText('website') + '; alle Preise stehen bei MAKE Innovation.'],
  ['Was brauche ich, um eine Website für ' + s.begriff + ' erstellen zu lassen?', 'Ein Gespräch vor Ort, Ihr Logo, Zugang zu Ihrem Google-Profil und einen Termin für Fotos und Video. Die Texte schreiben wir gern aus dem Gespräch.'],
]);
const gebaut = [];
for (const s of seiten) {
  const pfad = '/websites/' + s.slug + '/';
  s.begriff = s.begriff || s.thema; s.kundenfragen = s.kundenfragen || [];
  const titel = 'Website für ' + (s.titelbegriff || s.begriff) + ' erstellen lassen · MAKE Studios';
  const beschreibung = 'Website für ' + (s.titelbegriff || s.begriff) + ' erstellen lassen: die Beispielseite ' + s.name + ' von MAKE Studios mit Bausteinen, Ablauf und Fragen. Betrieb erfunden.';
  const fq = fallFragen(s);
  const video = videoObjekt('video', 'Bildschirmaufnahme der Beispielseite ' + s.name + ' (Website für ' + s.begriff + ')', 'Die Beispielseite ' + s.name + ' am Rechner, Aufnahme ohne Ton. Ein erfundener Betrieb, die Seite ist vollständig gebaut.', 'referenzen/' + s.slug + '-poster.webp', 'referenzen/' + s.slug + '.mp4');
  video.uploadDate = s.erstellt || video.uploadDate; video['@id'] = BASIS + pfad + '#video';
  const ogBild = gibts('bild/og-' + s.slug + '.jpg') ? '/bild/og-' + s.slug + '.jpg' : VORSCHAUBILD;
  const graph = [webseite(pfad, titel, beschreibung, ogBild), krumen(pfad, [['Start', '/'], ['Beispielseiten', '/websites/'], ['Website für ' + s.begriff, pfad]]),
    { '@type': 'Service', '@id': BASIS + pfad + '#leistung', name: 'Website für ' + s.begriff + ' erstellen lassen', serviceType: 'Webdesign', description: s.einleitung || s.passt, provider: { '@id': ORG_ID },
      areaServed: { '@type': 'City', name: 'Berlin' }, audience: { '@type': 'BusinessAudience', audienceType: s.begriff }, url: BASIS + pfad },
    { '@type': 'CreativeWork', '@id': BASIS + pfad + '#beispiel', name: 'Beispielseite ' + s.name + ': Entwurf für ' + s.thema, description: s.satz, creator: { '@id': ORG_ID }, genre: 'Website-Entwurf',
      about: s.thema, image: BASIS + '/referenzen/' + s.slug + '-poster.webp', dateCreated: s.erstellt, inLanguage: 'de-DE' }, video,
    { '@type': 'FAQPage', '@id': BASIS + pfad + '#fragen', inLanguage: 'de-DE', mainEntity: fq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }];
  s.fq = fq;
  const andere = seiten.filter((x) => x !== s && !x.offen).map((x) => `<li><a href="../${x.slug}/">Website für ${esc(x.begriff || x.thema)}</a></li>`).join('');
  const inhalt = `<nav class="krumen" aria-label="Sie sind hier"><a href="../../">Start</a> <span aria-hidden="true">›</span> <a href="../">Beispielseiten</a> <span aria-hidden="true">›</span> <span>Website für ${esc(s.begriff)}</span></nav>
<article class="fall">
  <header class="fall-kopf">
    <p class="ueberzeile">Beispiel · erfundener Betrieb</p>
    <h1>Website für ${esc(s.begriff)} erstellen lassen: die Beispielseite ${esc(s.name)}</h1>
    <p class="fall-satz">${esc(s.einleitung || s.satz)}</p>
    <p class="fall-text">${esc(s.satz)}</p>
    <p class="fall-aktionen"><a class="knopf knopf-signal" href="../../beispiele/${s.slug}/">Beispielseite öffnen</a><a class="knopf" href="../../#erstgespraech-${s.buchen}">Erstgespräch buchen</a></p>
  </header>
  <div class="fall-medien">
    <figure class="fenster">
      <video controls muted loop playsinline preload="none" width="960" height="600" poster="../../referenzen/${s.slug}-poster.webp" aria-label="Bildschirmaufnahme der Beispielseite ${esc(s.name)}, Website für ${esc(s.begriff)}, ohne Ton"><source src="../../referenzen/${s.slug}.mp4" type="video/mp4"></video>
      <figcaption>Am Rechner, Aufnahme ohne Ton</figcaption>
    </figure>
    <figure class="handy">
      <img src="../../referenzen/${s.slug}-hoch-poster.webp" alt="Beispielseite ${esc(s.name)}, Website für ${esc(s.begriff)}, auf dem Handy" width="540" height="1168" loading="lazy" decoding="async">
      <figcaption>Auf dem Handy</figcaption>
    </figure>
  </div>
  <section aria-labelledby="f-aufgabe"><h2 id="f-aufgabe">Welche Aufgabe löst die Seite?</h2><p>${esc(s.aufgabe)}</p></section>
  <section aria-labelledby="f-bausteine"><h2 id="f-bausteine">Was enthält die Seite?</h2><ul class="bausteine">${s.merkmale.map((m) => '<li>' + esc(m) + '</li>').join('')}</ul>${s.aufbau ? '<p>' + esc(s.aufbau) + '</p>' : ''}<p>Wie jede unserer Seiten ist sie zuerst für das Handy gestaltet und lädt schnell.</p></section>
  <section aria-labelledby="f-passt"><h2 id="f-passt">Für wen passt so eine Seite?</h2><p>${esc(s.passt)}</p></section>
  <section class="fragen-fall" aria-labelledby="f-fragen"><h2 id="f-fragen">Häufige Fragen zur Website für ${esc(s.begriff)}</h2><div>${fq.map(([q, a]) => '<h3>' + esc(q) + '</h3><p>' + esc(a) + '</p>').join('')}</div></section>
  <section aria-labelledby="f-weiter"><h2 id="f-weiter">Wie entsteht Ihre eigene Seite?</h2><p>In sechs Schritten: Briefing, Design, Feedback, Umsetzung, Abnahme, Live. Sie sehen den Entwurf, bevor wir bauen, und online geht die Seite erst mit Ihrem Okay. <a href="../../#ablauf">Zum Ablauf</a></p>
    <p>Websites gibt es ${preisText('website')}. Alle Preise finden Sie bei MAKE Innovation: <a data-familie="innovation" data-pfad="/sichtbarkeit/homepages/" href="${FAMILIE.innovation}/sichtbarkeit/homepages/">Alle Preise</a>. Mehr zu <a href="../../#video">Video und Reels</a> und zu <a href="../../#social">Social Media</a> steht auf der Startseite.</p>
    <p class="fall-aktionen"><a class="knopf knopf-signal" href="../../#erstgespraech-${s.buchen}">Erstgespräch buchen</a><a class="knopf" href="../../#check">Schnelltest machen</a></p></section>
  <aside aria-labelledby="f-andere"><h2 id="f-andere">Weitere Beispielseiten</h2><ul class="andere">${andere}</ul></aside>
  <p class="stand">Stand: ${esc(seo.stand)}</p>
</article>`;
  schreibe('websites/' + s.slug + '/index.html', huelle({ tiefe: 2, titel, beschreibung, inhalt, block: seoBlock({ pfad, titel, beschreibung, graph, noindex: s.offen, typ: 'article', bild: ogBild, bildAlt: 'Beispielseite ' + s.name + ': Website für ' + s.begriff + ' von MAKE Studios' }) }));
  gebaut.push({ pfad, datei: 'websites/' + s.slug + '/index.html', titel, beschreibung, offen: s.offen, bild: '/referenzen/' + s.slug + '-poster.webp' });
}

// ── Übersicht der Fallseiten: echte Seite, Filter als Links ──
{
  const pfad = '/websites/', titel = 'Website-Beispiele für Bau, Technik, Coaches · MAKE Studios';
  const beschreibung = ANZAHL + ' Beispielseiten von MAKE Studios: Website für Bau, Handwerk, Technik, Agenturen, Coaches und Kanzleien. Erfundene Betriebe, vollständig gebaut.';
  const fertig = seiten.filter((s) => !s.offen);
  const graph = [webseite(pfad, titel, beschreibung), krumen(pfad, [['Start', '/'], ['Beispielseiten', pfad]]),
    { '@type': 'ItemList', '@id': BASIS + pfad + '#liste', name: 'Beispielseiten von MAKE Studios', itemListElement: fertig.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: 'Website für ' + (s.begriff || s.thema), url: BASIS + '/websites/' + s.slug + '/' })) }];
  const gruppen = Object.entries(daten.arten).map(([art, name]) => {
    const anker = 'art-' + art, liste = seiten.filter((s) => s.art === art && !(OEFFENTLICH && s.offen));
    if (!liste.length) return '';
    return `<section class="gruppe" id="${anker}" aria-labelledby="${anker}-t"><h2 id="${anker}-t">${esc(name)}</h2><div class="raster">` + liste.map((s) => `
      <article class="karte"><a class="karte-bild" href="${s.slug}/" tabindex="-1" aria-hidden="true"><img src="../referenzen/${s.slug}-poster.webp" alt="Beispielseite ${esc(s.name)}, Website für ${esc(s.begriff || s.thema)}" width="960" height="600" loading="lazy" decoding="async"></a>
        <p class="ueberzeile">${esc(s.branche)}</p><h3><a href="${s.slug}/">Website für ${esc(s.begriff || s.thema)}</a></h3><p>${esc(s.satz)}</p>
        <p class="karte-wege"><a href="${s.slug}/">So ist sie gebaut</a><a href="../beispiele/${s.slug}/">Beispielseite ${esc(s.name)} öffnen</a></p></article>`).join('') + '</div></section>';
  }).join('\n');
  const inhalt = `<nav class="krumen" aria-label="Sie sind hier"><a href="../">Start</a> <span aria-hidden="true">›</span> <span>Beispielseiten</span></nav>
<header class="fall-kopf"><p class="ueberzeile">Beispielseiten</p><h1>Website erstellen lassen: Beispiele für Betriebe und Dienstleister</h1>
  <p class="fall-satz">${ANZAHL} vollständige Websites für erfundene Betriebe. Zu jeder lesen Sie, welche Aufgabe sie löst, was sie enthält und für wen sie passt.</p>
  <p class="filter-links" aria-label="Nach Art springen">${Object.entries(daten.arten).map(([art, name]) => `<a href="#art-${art}">${esc(name)}</a>`).join('')}</p></header>
${gruppen}
<p class="stand">Stand: ${esc(seo.stand)}</p>`;
  schreibe('websites/index.html', huelle({ tiefe: 1, titel, beschreibung, inhalt, block: seoBlock({ pfad, titel, beschreibung, graph }) }));
  gebaut.push({ pfad, datei: 'websites/index.html', titel, beschreibung, offen: false });
}

// ── 404 ──
// Die 404-Seite erscheint unter jeder Adresse; ein <base> verbietet die Sicherheitsregel (base-uri 'none'), deshalb stehen hier alle Pfade ab der Wurzel.
const wurzelPfade = (html) => html.replace(/\b(href|src)="(?!#|\/|https?:|mailto:|data:)(\.\/)?([^"]*)"/g, (m, a, _p, rest) => a + '="/' + rest + '"').replace(/href="#(?!inhalt")/g, 'href="/#');
schreibe('404.html', wurzelPfade(huelle({ tiefe: 0, titel: 'Seite nicht gefunden · MAKE Studios', beschreibung: 'Diese Adresse gibt es bei MAKE Studios nicht. Zur Startseite, zu den Beispielseiten oder zum Erstgespräch.', klasse: 'nichts',
  block: '<meta name="robots" content="noindex, nofollow">',
  inhalt: '<header class="fall-kopf"><p class="ueberzeile">Fehler 404</p><h1>Diese Seite gibt es nicht.</h1><p class="fall-satz">Die Adresse ist falsch oder die Seite ist umgezogen.</p><p class="fall-aktionen"><a class="knopf knopf-signal" href="./">Zur Startseite</a><a class="knopf" href="websites/">Beispielseiten</a><a class="knopf" href="./#erstgespraech">Erstgespräch buchen</a></p></header>' })));

// ── robots.txt, sitemap.xml, llms.txt, Marke .vorschau ──
const KI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'CCBot', 'Meta-ExternalAgent'];
schreibe('robots.txt', OEFFENTLICH
  ? 'User-agent: *\nAllow: /\n\n# Demo-Seiten erfundener Betriebe: KI-Bots sollen sie nicht einlesen. Googlebot und Bingbot bleiben erlaubt, damit sie das noindex sehen.\n'
    + KI_BOTS.map((b) => 'User-agent: ' + b).join('\n') + '\nDisallow: /beispiele/\n\nSitemap: ' + BASIS + '/sitemap.xml\n'
  : '# Vorschau: nichts freigegeben (seo.json › oeffentlich: false)\nUser-agent: *\nDisallow: /\n');

const hash = (p) => createHash('sha1').update(lies(p).replace(/<!-- seo:anfang -->[\s\S]*?<!-- seo:ende -->/, '')).digest('hex').slice(0, 12);
const standAlt = gibts('seo-stand.json') ? JSON.parse(lies('seo-stand.json')) : {};
const stand = {};
const inSitemap = [{ pfad: '/', datei: 'index.html', bild: '/referenzen/energiespeicher-poster.webp' }].concat(gebaut.filter((g) => !g.offen));
for (const e of inSitemap) {
  if (NUR_PRUEFEN && !gibts(e.datei)) continue;
  const h = hash(e.datei), alt = standAlt[e.pfad];
  stand[e.pfad] = alt && alt.hash === h ? alt : { hash: h, datum: HEUTE };
}
schreibe('seo-stand.json', JSON.stringify(stand, null, 1) + '\n');
schreibe('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
  + inSitemap.map((e) => '  <url><loc>' + BASIS + e.pfad + '</loc><lastmod>' + ((stand[e.pfad] || {}).datum || HEUTE) + '</lastmod>' + (e.bild ? '<image:image><image:loc>' + BASIS + e.bild + '</image:loc></image:image>' : '') + '</url>').join('\n') + '\n</urlset>\n');
const fertigeSeiten = seiten.filter((s) => !s.offen);
const FUER_WEN = 'Betriebe und Dienstleister in Berlin, die online gefunden werden wollen, in drei Gruppen: Bau und Handwerk, innovative Produkte (zum Beispiel Robotik, Drohnen, Energiespeicher) sowie Agenturen und Coaches, dazu zählen Kanzleien und Berater.';
const ohneNbsp = (s) => s.replace(/\u00a0/g, ' ');
const PREIS_ZEILE = ohneNbsp(PREISE.hinweis + ', ' + PREISE.standText + '. Website: ' + preisText('website') + '. Erklärvideo: ' + preisText('erklaervideo') + '. Videostory: ' + preisText('videostory') + '. Video-Serie: ' + preisText('video-serie')
  + '. Social Media S: ' + preisText('social-s') + '. Social Media M: ' + preisText('social-m') + '. Social Media L: ' + preisText('social-l') + '. Für Google-Profil und Fotos steht hier kein Preis; er wird im Erstgespräch genannt. Nach dem Erstgespräch gibt es einen Festpreis, schriftlich und vor Beginn. Alle Preise: Websites ' + FAMILIE.innovation + '/sichtbarkeit/homepages/, Videos ' + FAMILIE.innovation + '/sichtbarkeit/videos/, Social Media ' + FAMILIE.innovation + PFAD_SOCIAL_PREISE + '.');
const llmsKopf = '# MAKE Studios\n\n> ' + STANDARDSATZ + '\n\nMAKE Studios sitzt in Berlin und macht Unternehmen auf allen Ebenen sichtbar: Google-Profil, Foto, Video, Reels, Social Media und Website, KI-gestützt und aus einer Hand. Social Media gibt es ' + preisText('social-s', 'ab') + ' im Monat, Videos ' + preisText('erklaervideo', 'ab') + ', Websites ' + preisText('website', 'ab') + ', jeweils netto. Aus jedem Anlass, vom Drehtag bis zur Messe, entstehen Fotos, Videos, Reels und Beiträge für Wochen. Wer eine Website erstellen lassen, Reels oder Videos drehen lassen oder Social Media betreuen lassen will, bekommt alles aus einer Hand oder einzeln. Sichtbar werden mit MAKE Studios, planbar verkaufen mit MAKE Revenue.\n\n## Für wen\n' + FUER_WEN + '\n\n## Leistungen\n'
  + leistungen.map(([n, b]) => '- [' + n + '](' + ankerVon(n) + '): ' + b).join('\n') + '\n- [Schnelltest Sichtbarkeit](' + BASIS + '/#check): ' + checkText
  + '\n\n## Video\n' + formate.map(([n, b, fr]) => '- ' + n + ': ' + b + ' (' + fr + ')').join('\n')
  + '\n\n## Social Media in drei Paketen\n' + pakete.map(([n, b]) => '- ' + n + ': ' + b).join('\n') + '\n- Für alle drei Pakete: ' + paketHinweis
  + '\n- [Preise für Social Media](' + FAMILIE.innovation + PFAD_SOCIAL_PREISE + ')\n\n## Preise\n' + PREIS_ZEILE
  + '\n\n## Ablauf in sechs Schritten\n' + ablauf.map(([n, b], i) => (i + 1) + '. ' + n + ': ' + b).join('\n');
const llmsFall = '\n\n## Beispielseiten (Website für ...)\n- [Übersicht](' + BASIS + '/websites/): Website-Entwürfe für erfundene Betriebe, je Seite erklärt\n'
  + fertigeSeiten.map((s) => '- [Website für ' + s.begriff + '](' + BASIS + '/websites/' + s.slug + '/): ' + s.satz).join('\n');
const llmsFuss = '\n\n## Kontakt\n- E-Mail: ' + (f.email || '') + '\n- Erstgespräch: ' + BASIS + '/#erstgespraech\n\n## Weitere Angebote\n- [MAKE Innovation](' + FAMILIE.innovation + '/): ' + SATZ_DACH + '\n- [MAKE Revenue](' + FAMILIE.revenue + '/): ' + SATZ_REVENUE + '\n';
schreibe('llms.txt', llmsKopf + '\n\n## Häufige Fragen (Antworten: ' + BASIS + '/llms-full.txt und ' + BASIS + '/#fragen)\n' + fragen.map(([q]) => '- ' + q).join('\n') + llmsFall + '\n\n## Ausführliche Fassung\n- [llms-full.txt](' + BASIS + '/llms-full.txt): alle Fragen mit Antworten, auch zu den Beispielseiten' + llmsFuss);
schreibe('llms-full.txt', llmsKopf + '\n\n## Häufige Fragen und Antworten\n' + fragen.map(([q, a]) => '### ' + q + '\n' + a).join('\n\n') + llmsFall
  + '\n\n## Fragen zu den Beispielseiten\n' + fertigeSeiten.map((s) => '### Website für ' + s.begriff + ' (' + BASIS + '/websites/' + s.slug + '/)\n' + s.einleitung + '\n\n' + s.fq.map(([q, a]) => '#### ' + q + '\n' + a).join('\n\n')).join('\n\n') + llmsFuss);
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
// Strukturierte Daten: Pflichtfelder je Typ (eigene Prüfung gegen die Angaben von schema.org und die Hinweise für Rich Results), Verweise auf @id müssen es geben, Überschriften ohne Sprung
{ const PFLICHT = { Organization: ['name', 'url', 'logo'], WebSite: ['url', 'name'], WebPage: ['url', 'name', 'isPartOf'], BreadcrumbList: ['itemListElement'], Service: ['name', 'provider', 'description'],
    VideoObject: ['name', 'description', 'thumbnailUrl', 'uploadDate', 'contentUrl', 'duration'], FAQPage: ['mainEntity'], CreativeWork: ['name', 'creator'], ItemList: ['itemListElement'] };
  for (const d of dateien) { const html = lies(d); const hv = html.replace(/<script[\s\S]*?<\/script>/g, '');
    let l = 0; for (const m of hv.matchAll(/<h([1-6])[\s>]/g)) { if (+m[1] > l + 1 && l) melde(true, d + ': Überschriften springen von h' + l + ' auf h' + m[1]); l = +m[1]; }
    const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html); if (!m) continue;
    let j; try { j = JSON.parse(m[1]); } catch (e) { continue; }
    const ids = new Set((j['@graph'] || []).map((x) => x['@id']).filter(Boolean));
    for (const x of j['@graph'] || []) {
      const typ = x['@type'];
      for (const k of PFLICHT[typ] || []) if (x[k] === undefined) melde(true, d + ': ' + typ + ' ohne Pflichtfeld ' + k);
      if (typ === 'FAQPage') { if (!x.mainEntity.length) melde(true, d + ': FAQPage ohne Fragen'); const sicht = text(hv);
        for (const q of x.mainEntity) { if (!q.name || !(q.acceptedAnswer && q.acceptedAnswer.text)) melde(true, d + ': Frage ohne Antwort'); else if (!sicht.includes(q.name) || !sicht.includes(q.acceptedAnswer.text.slice(0, 60))) melde(true, d + ': Frage/Antwort in den Daten, aber nicht sichtbar: ' + q.name); } }
      if (typ === 'BreadcrumbList') x.itemListElement.forEach((e, i) => { if (e.position !== i + 1 || !e.name || !e.item) melde(true, d + ': Brotkrume unvollständig'); });
      if (typ === 'VideoObject' && !/^PT(\d+M)?(\d+S)?$/.test(x.duration || '')) melde(true, d + ': VideoObject mit ungültiger Dauer');
      if (typ === 'VideoObject' && x.contentUrl && !gibts(x.contentUrl.slice(BASIS.length + 1))) melde(true, d + ': VideoObject, Datei fehlt: ' + x.contentUrl);
      for (const k of ['provider', 'creator', 'isPartOf', 'about', 'publisher']) if (x[k] && x[k]['@id'] && !ids.has(x[k]['@id']) && !x[k]['@id'].startsWith(FAMILIE.innovation) && !x[k]['@id'].startsWith(BASIS + '/#')) melde(true, d + ': Verweis auf unbekannte @id ' + x[k]['@id']); } }
  for (const [n, d] of [['llms.txt', 'llms.txt'], ['llms-full.txt', 'llms-full.txt']]) if (!gibts(d)) melde(true, n + ' fehlt');
  const llmsFull = gibts('llms-full.txt') ? lies('llms-full.txt') : '';
  for (const [q] of fragen) if (!llmsFull.includes(q)) melde(true, 'llms-full.txt: Frage fehlt: ' + q);
  for (const x of seiten.filter((q) => !q.offen)) { const h = gibts('websites/' + x.slug + '/index.html') ? lies('websites/' + x.slug + '/index.html') : '';
    if (!/<h1>Website für /.test(h)) melde(true, 'websites/' + x.slug + ': h1 beginnt nicht mit „Website für“');
    if (!x.kundenfragen || x.kundenfragen.length < 3 || x.kundenfragen.length > 5) melde(true, 'websites/' + x.slug + ': kundenfragen: drei bis fünf nötig');
    if (!x.einleitung) melde(true, 'websites/' + x.slug + ': einleitung fehlt'); } }
// Fragen in den Daten müssen sichtbar sein (hier per Bauweise gleich, trotzdem geprüft)
{ const html = gibts('index.html') ? lies('index.html') : ''; const sicht = text(html.replace(/<script[\s\S]*?<\/script>/g, ''));
  for (const [q] of fragen) if (!sicht.includes(q)) melde(true, 'index.html: Frage in den Daten, aber nicht sichtbar: ' + q);
  if (fragen.length < 5) melde(true, 'index.html: weniger als fünf Fragen gefunden');
  if (leistungen.length !== 4) melde(true, 'index.html: nicht genau vier Leistungen gefunden (' + leistungen.length + ')');
  for (const [n] of leistungen) if (!ART[n]) melde(true, 'index.html: Leistung ohne Art in den Daten: ' + n);
  // Social Media: genau drei Pakete mit Hinweis und Verweis auf das Preisblatt; „auf Anfrage“ steht dort nicht mehr (Entscheidung 18.11.)
  if (pakete.length !== 3) melde(true, 'index.html: nicht genau drei Social-Media-Pakete im Abschnitt #social gefunden (' + pakete.length + ')');
  if (!paketHinweis) melde(true, 'index.html: Hinweis zu Laufzeit und Anzeigen (social-hinweis) fehlt im Abschnitt #social');
  if (!socialTeil.includes('data-pfad="' + PFAD_SOCIAL_PREISE + '"')) melde(true, 'index.html: Verweis auf die Preise für Social Media fehlt im Abschnitt #social');
  const sozial = [text(socialTeil)].concat(leistungen.filter(([n]) => n === 'Social Media').map(([, b]) => b), fragen.filter(([q, a]) => /Social Media|sozialen Medien/.test(q + ' ' + a)).map(([, a]) => a), [beschrStart]);
  if (sozial.some((t) => /auf Anfrage/i.test(t))) melde(true, 'index.html: Social Media steht noch „auf Anfrage“ (es gibt drei feste Pakete)');
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
// Firmenangaben: leere oder unbekannte Angaben (Telefon, Profile) entfallen ganz in den Daten, nichts wird erfunden; Anschrift und E-Mail sind Pflicht.
{ const fehlt = [['E-Mail', f.email], ['Straße', f.strasse], ['PLZ', f.plz], ['Ort', f.ort]].filter((x) => !echt(x[1])).map((x) => x[0]);
  if (fehlt.length) melde(OEFFENTLICH, 'seo.json › firma: ' + fehlt.join(', ') + ' fehlt (steht im Impressum von MAKE Innovation)'); }
// Preise: jeder Betrag in Seiten und llms-Dateien stammt aus preise.json; die Marken im HTML tragen genau den Text aus preise.json
{ const erlaubt = new Set(Object.values(PREISE.eintraege).map((e) => e.betrag));
  for (const [k, e] of Object.entries(PREISE.eintraege)) if (e.ab !== 'ab ' + e.betrag.toLocaleString('de-DE') + ' €') melde(true, 'preise.json: ' + k + ': ab-Text passt nicht zum Betrag');
  if (!PREISE.netto || !/netto/.test(PREISE.hinweis || '')) melde(true, 'preise.json: Hinweis „netto zuzüglich Umsatzsteuer“ fehlt');
  for (const d of dateien.concat(['llms.txt', 'llms-full.txt'].filter(gibts))) { const roh = lies(d).replace(/<script[\s\S]*?<\/script>/g, '');
    for (const m of roh.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+)[\s\u00a0]*€/g)) if (!erlaubt.has(Number(m[1].replace(/\./g, '')))) melde(true, d + ': Preis „' + m[0] + '“ steht nicht in preise.json (nur aus der Preisliste, nie von Hand)');
    for (const m of roh.matchAll(/<span data-preis="([a-z-]+)"(?: data-form="([a-z]+)")?>([^<]*)<\/span>/g)) if (m[3] !== preisText(m[1], m[2] || 'voll')) melde(true, d + ': Preismarke ' + m[1] + ' trägt nicht den Text aus preise.json'); } }
if (OEFFENTLICH) { if (!BASIS.startsWith('https://')) melde(true, 'familie.js: studios ist keine https-Adresse');
  if (gibts('.vorschau') && NUR_PRUEFEN) melde(true, 'Marke .vorschau liegt noch');
  if (seiten.some((s) => s.offen)) melde(false, 'Fallseiten mit Platzhaltern bleiben noindex und fehlen in der Sitemap: ' + seiten.filter((s) => s.offen).map((s) => s.slug).join(', '));
  hinweise.push('Impressum und Datenschutz verweisen auf das Dach (' + FAMILIE.innovation + '). Die Vorgabe empfiehlt je Domain eigene Seiten.'); }

console.log((OEFFENTLICH ? 'ÖFFENTLICH' : 'VORSCHAU') + ' · ' + BASIS + ' · ' + dateien.length + ' Seiten · Sitemap ' + inSitemap.length + ' Adressen' + (NUR_PRUEFEN ? ' · nur geprüft' : ' · gebaut'));
hinweise.forEach((t) => console.log('  Hinweis: ' + t));
fehler.forEach((t) => console.log('  FEHLER:  ' + t));
if (fehler.length) { console.log(fehler.length + ' Fehler.'); process.exit(1); }
console.log('Prüfer grün.');
