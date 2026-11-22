// MAKE Revenue · der Schalter für Suche und KI-Suchen (SEO-GEO-VORGABEN, Abschnitt 8).
// Aufruf:  node seo.mjs            schreibt Kopf, Dateien und prüft
//          node seo.mjs --pruefen  prüft nur, schreibt nichts
//
// Freigabe (nur auf Kevins Wort), genau zwei Handgriffe, dann dieses Skript:
//   1) familie.js: die echten Adressen eintragen (https).
//   2) seo.json:   "oeffentlich": true.
//   3) node seo.mjs   (oder node bauen.mjs, das ruft dieses Skript am Ende auf). Der Prüfer muss grün sein.
//   Dazu gehört auf dem Server: im Caddyfile für makerevenue.de X-Robots-Tag und basic_auth entfernen (sonst bleibt die Seite gesperrt).
//
// Was das Skript tut:
//   · schreibt in jede HTML-Seite den Block zwischen <!-- seo:anfang --> und <!-- seo:ende --> (Titel, Beschreibung,
//     robots, Canonical, Open Graph, EIN JSON-LD mit @graph: Organisation, Leistungen mit Ab-Preisen, Fragen, Brotkrumen)
//   · setzt den Rückfall aller Familien-Links (data-familie) im HTML aus familie.js
//   · erzeugt robots.txt, sitemap.xml, llms.txt, llms-full.txt, die IndexNow-Datei, site.webmanifest und die Markerdatei .vorschau
//   · prüft und bricht mit Fehlercode ab, wenn etwas nicht stimmt (Liste unten in pruefe…)
// Preise: nur aus preise.json (erzeugt von preise-bauen.mjs aus der EINEN Preisliste von MAKE Innovation). Der Prüfer scheitert,
// wenn die Datei fehlt oder ein Euro-Betrag in HTML, strukturierten Daten oder llms-Dateien nicht daraus stammt.
// Rechenbeispiele stehen im HTML zwischen <!-- beispiel:anfang --> und <!-- beispiel:ende -->: Nur dort sind andere Beträge erlaubt.
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const lies = (name) => readFileSync(join(ORDNER, name), 'utf8');
const att = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<span data-preis="[a-z-]+">([^<]*)<\/span>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const TITEL_LAENGE = [15, 65], BESCHREIBUNG_LAENGE = [110, 165];
const BETRAG = /(\d{1,3}(?:\.\d{3})+|\d+)(?:[\s\u00a0]|&nbsp;)*€/g;
const zahlAus = (s) => Number(s.replace(/\./g, ''));

export function seo({ nurPruefen = false } = {}) {
  const fehler = [], hinweise = [];
  // ─── Einstellungen ───
  const einstellung = JSON.parse(lies('seo.json'));
  if (!einstellung.indexnow) { einstellung.indexnow = randomBytes(16).toString('hex'); if (!nurPruefen) writeFileSync(join(ORDNER, 'seo.json'), JSON.stringify(einstellung, null, 2) + '\n'); }
  const oeffentlich = einstellung.oeffentlich === true;
  const anbieter = einstellung.anbieter || {};
  const fam = Function('return ' + /export const FAMILIE = (\{[\s\S]*?\});/.exec(lies('familie.js'))[1])();
  const ohneStrich = (u) => u.replace(/\/+$/, '');
  const BASIS = ohneStrich(fam[einstellung.marke]);
  const INNOVATION = ohneStrich(fam.innovation), STUDIOS = ohneStrich(fam.studios);
  const lokal = (u) => /localhost|127\.0\.0\.1|\.local\b/.test(u);
  const daten = JSON.parse(lies('seiten.json'));
  const ORG = `${BASIS}/#organisation`, DACH = `${INNOVATION}/#organisation`, SITE = `${BASIS}/#website`;
  const heute = new Date().toISOString().slice(0, 10);

  // ─── Preise: nur aus preise.json ───
  if (!existsSync(join(ORDNER, 'preise.json'))) { console.error('  FEHLER:  preise.json fehlt: erst preise-bauen.mjs ausführen (Quelle: Preisliste von MAKE Innovation)'); console.log('seo: 1 Fehler'); return false; }
  const PREISE = JSON.parse(lies('preise.json'));
  const erlaubt = new Set(Object.values(PREISE.eintraege).map((p) => p.betrag));
  const P = (k) => PREISE.eintraege[k];
  const preisSatz = (k) => `${P(k).ab} ${P(k).rhythmus}`;

  // lastmod: Tag der letzten echten Inhaltsänderung (Fingerabdruck des Hauptinhalts je Seite)
  const standDatei = join(ORDNER, 'seo-stand.json');
  const stand = existsSync(standDatei) ? JSON.parse(readFileSync(standDatei, 'utf8')) : {};
  const familienLink = (ziel, pfad) => {
    const basis = fam[ziel];
    if (!basis) return null;
    return pfad ? new URL(pfad, basis.endsWith('/') ? basis : basis + '/').href : new URL(basis).href;
  };
  const linksSetzen = (html) => html.replace(/<a\b([^>]*?)\sdata-familie="([a-z]+)"([^>]*)>/g, (ganz, davor, ziel, danach) => {
    const pfad = (/data-pfad="([^"]*)"/.exec(davor + danach) || [])[1] || '';
    const href = familienLink(ziel, pfad);
    if (!href) { fehler.push(`Familien-Link mit unbekanntem Ziel „${ziel}“`); return ganz; }
    const rest = (davor + ' data-familie="' + ziel + '"' + danach).replace(/\shref="[^"]*"/, '');
    return `<a${rest.replace(/^(\s*class="[^"]*")?/, (m) => m + ` href="${att(href)}"`)}>`;
  });

  // ─── Strukturierte Daten ───
  // Anbieterin: MAKE Innovation GmbH (seo.json › anbieter, Angaben wie im Impressum von MAKE Innovation). Kein Telefon, keine Registernummer hier.
  const adresse = anbieter.strasse ? { '@type': 'PostalAddress', streetAddress: anbieter.strasse, postalCode: anbieter.plz, addressLocality: anbieter.ort, addressCountry: anbieter.land || 'DE' } : null;
  const organisation = () => ({
    '@type': 'Organization', '@id': ORG, name: 'MAKE Revenue', url: `${BASIS}/`, description: daten.satz.revenue,
    logo: { '@type': 'ImageObject', url: `${BASIS}/bild/logo.png`, width: 512, height: 512 }, email: daten.mail,
    ...(anbieter.name ? { legalName: anbieter.name } : {}), ...(adresse ? { address: adresse } : {}),
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    knowsAbout: ['Vertrieb aufbauen', 'Vertriebsleitung auf Zeit', 'Interim Head of Sales', 'Vertriebsprozess im CRM', 'Vertriebskennzahlen', 'Netzwerkabend für Unternehmer'],
    brand: { '@type': 'Brand', '@id': `${BASIS}/#marke`, name: 'MAKE Revenue' },
    contactPoint: { '@type': 'ContactPoint', contactType: 'Erstgespräch', email: daten.mail, availableLanguage: 'de', url: `${BASIS}/#erstgespraech` },
    parentOrganization: { '@type': 'Organization', '@id': DACH, name: anbieter.name || 'MAKE Innovation', url: `${INNOVATION}/` },
  });
  // Ein Angebot mit Ab-Preis: minPrice statt price, netto. Beträge nur aus preise.json.
  const angebot = (k, url) => ({ '@type': 'Offer', name: P(k).kurzname, url, description: `${preisSatz(k)}, netto zuzüglich Umsatzsteuer${P(k).laufzeit ? ', ' + P(k).laufzeit : ''}`,
    priceSpecification: { '@type': 'UnitPriceSpecification', priceCurrency: 'EUR', minPrice: P(k).betrag, valueAddedTaxIncluded: false, unitText: P(k).rhythmus } });
  const gratis = (name, url) => ({ '@type': 'Offer', name, url, price: 0, priceCurrency: 'EUR' });
  const leistungKnoten = (l, url, id, angebote = [], frei = '') => ({ '@type': 'Service', '@id': id, name: l.name, serviceType: l.art || 'Vertriebsaufbau', description: l.text, provider: { '@id': ORG },
    areaServed: { '@type': 'Country', name: 'Deutschland' }, audience: { '@type': 'BusinessAudience', audienceType: 'Gründer, Geschäftsführer und Vertriebsverantwortliche in Start-ups und Mittelstand' }, url,
    ...(angebote.length || frei ? { offers: [...(frei ? [gratis(frei, url)] : []), ...angebote.map((k) => angebot(k, url))] } : {}) });
  const graph = (s, url, lastmod) => {
    const g = [];
    const seite = { '@type': 'WebPage', '@id': `${url}#webseite`, url, name: s.titel, description: s.beschreibung, isPartOf: { '@id': SITE }, about: { '@id': ORG }, inLanguage: 'de-DE', dateModified: lastmod,
      primaryImageOfPage: { '@type': 'ImageObject', url: `${BASIS}/bild/og.png`, width: 1200, height: 630 } };
    if (!s.pfad) {
      g.push(organisation());
      g.push({ '@type': 'WebSite', '@id': SITE, url: `${BASIS}/`, name: 'MAKE Revenue', inLanguage: 'de-DE', publisher: { '@id': ORG } });
      g.push(seite);
      for (const l of s.leistungen) g.push(leistungKnoten(l, `${BASIS}/${l.pfad}`, `${BASIS}/#angebot-${l.key}`, [l.key]));
    } else {
      seite.author = { '@type': 'Person', name: 'Kevin Dieckmann', jobTitle: 'Vertrieb und Umsetzung', worksFor: { '@id': DACH } };
      g.push(seite);
      g.push({ '@type': 'BreadcrumbList', '@id': `${url}#brotkrumen`, itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: `${BASIS}/` },
        { '@type': 'ListItem', position: 2, name: s.name, item: url }] });
      if (s.leistung) g.push(leistungKnoten(s.leistung, url, `${url}#leistung`, s.angebote || [], s.gratis || ''));
      if (s.begriffe.length) g.push({ '@type': 'DefinedTermSet', '@id': `${url}#begriffe`, name: 'Begriffe aus dem Vertrieb', inLanguage: 'de-DE',
        hasDefinedTerm: s.begriffe.map((b) => ({ '@type': 'DefinedTerm', name: b.name, description: b.text })) });
    }
    if (s.fragen.length) g.push({ '@type': 'FAQPage', '@id': `${url}#fragen`, inLanguage: 'de-DE',
      mainEntity: s.fragen.map((q) => ({ '@type': 'Question', name: q.f, acceptedAnswer: { '@type': 'Answer', text: q.a } })) });
    return { '@context': 'https://schema.org', '@graph': g };
  };

  // ─── Kopf je Seite ───
  const robots = oeffentlich ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow';
  const kopf = (s, url, lastmod) => [
    `<title>${att(s.titel)}</title>`,
    `<meta name="description" content="${att(s.beschreibung)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${att(url)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="MAKE Revenue">',
    '<meta property="og:locale" content="de_DE">',
    `<meta property="og:title" content="${att(s.titel)}">`,
    `<meta property="og:description" content="${att(s.beschreibung)}">`,
    `<meta property="og:url" content="${att(url)}">`,
    `<meta property="og:image" content="${BASIS}/bild/og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="MAKE Revenue: Vertrieb mit System. Von der Anfrage zum Abschluss.">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<script type="application/ld+json">${JSON.stringify(graph(s, url, lastmod)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
  const blockSetzen = (html, block) => html.replace(/<!-- seo:anfang -->[\s\S]*?<!-- seo:ende -->/, () => `<!-- seo:anfang -->\n${block}\n<!-- seo:ende -->`);

  const fertig = [];
  for (const s of daten.seiten) {
    if (!existsSync(join(ORDNER, s.datei))) { fehler.push(`${s.datei} fehlt (erst node bauen.mjs)`); continue; }
    let html = linksSetzen(lies(s.datei));
    const haupt = (/<main[\s\S]*<\/main>/.exec(html) || [''])[0].replace(/\shref="[^"]*"/g, '');
    const abdruck = createHash('sha256').update(haupt).digest('hex').slice(0, 16);
    const alt = stand[s.pfad];
    const lastmod = alt && alt.abdruck === abdruck ? alt.lastmod : heute;
    stand[s.pfad] = { abdruck, lastmod };
    const url = `${BASIS}/${s.pfad}`;
    html = blockSetzen(html, kopf(s, url, lastmod));
    if (!nurPruefen) writeFileSync(join(ORDNER, s.datei), html);
    fertig.push({ s, html, url, lastmod });
  }
  // 404: bleibt immer noindex, ohne Canonical und ohne strukturierte Daten
  let seite404 = '';
  if (existsSync(join(ORDNER, '404.html'))) {
    seite404 = blockSetzen(linksSetzen(lies('404.html')), '<title>Seite nicht gefunden · MAKE Revenue</title>\n<meta name="robots" content="noindex, nofollow">');
    if (!nurPruefen) writeFileSync(join(ORDNER, '404.html'), seite404);
  }

  // ─── Dateien ───
  const sitz = anbieter.name ? `${anbieter.name}, ${anbieter.strasse}, ${anbieter.plz} ${anbieter.ort}` : 'MAKE Innovation';
  const angebotZeile = (a) => `- [${a.name}](${BASIS}/${a.pfad}): ${preisSatz(a.key)}, netto${P(a.key).laufzeit ? ', ' + P(a.key).laufzeit : ''}. ${a.fuer}`;
  const kontaktBlock = `## Kontakt\n- Erstgespräch buchen: ${BASIS}/#erstgespraech (30 Minuten per Video, kostenlos, kein Verkaufsgespräch)\n- E-Mail: ${daten.mail}\n- Anbieterin: ${sitz}\n- Impressum: ${INNOVATION}/impressum/`;
  const auchVonUns = `## Auch von uns\n- [MAKE Innovation](${INNOVATION}/): ${daten.satz.innovation}\n- [MAKE Studios](${STUDIOS}/): ${daten.satz.studios}`;
  const llms = `# MAKE Revenue\n\n> ${daten.satz.revenue}\n\nMAKE Revenue baut Vertrieb für Gründer und Mittelstand auf: mit Tagesworkshop, Vertriebsleitung auf Zeit (Head of Sales oder Chief Sales Officer) und dem Fokus Abend. ${PREISE.hinweis}.\n\n## Angebote mit Preis\n${daten.angebote.map(angebotZeile).join('\n')}\n- [Abendpartner beim Fokus Abend](${BASIS}/netzwerken/#partner): ${preisSatz('abendpartner')}, netto. Für Gäste ist der Abend kostenlos.\n\n## Seiten\n${fertig.filter((f) => f.s.pfad).map((f) => `- [${f.s.name}](${f.url}): ${f.s.beschreibung}`).join('\n')}\n- [Ausführliche Fassung für KI-Suchen](${BASIS}/llms-full.txt): Angebote, Preise, Ablauf, Zusagen, Fragen und Antworten\n\n${kontaktBlock}\n\n${auchVonUns}\n\nStand: ${daten.stand} · Preise: Stand ${PREISE.standText}\n`;
  const alleFragen = [...new Map(fertig.flatMap((f) => f.s.fragen).map((q) => [q.f, q])).values()];
  const voll = `# MAKE Revenue: Angebote, Preise, Ablauf, Fragen und Antworten\n\n> ${daten.satz.revenue}\n\nDiese Datei fasst zusammen, was auf ${BASIS}/ steht. Alle Angaben stehen auch sichtbar auf den Seiten. ${PREISE.hinweis}. Stand der Preise: ${PREISE.standText}.\n\n## Für wen\nGeschäftsführer, Gründer und Vertriebsverantwortliche in Start-ups und Mittelstand mit fertigem Produkt, deren Vertrieb am Gründer hängt oder ohne System läuft. Arbeitsgebiet: Deutschland, per Video und vor Ort.\n\n## Angebote und Preise\n${daten.angebote.map((a) => `### ${a.name}\n- Preis: ${preisSatz(a.key)}, netto zuzüglich Umsatzsteuer\n- Dauer: ${P(a.key).laufzeit}\n- ${a.fuer}\n- Was passiert: ${a.passiert}\n- Am Ende steht: ${a.ergebnis}\n- Aufwand für den Kunden: ${a.aufwand}${a.zusatz ? '\n- ' + a.zusatz : ''}\n- Mehr: ${BASIS}/${a.pfad}`).join('\n\n')}\n\nDen genauen Festpreis gibt es schriftlich vor dem Start.\n\n## Ablauf (Mandat als Head of Sales auf Zeit, sechs Monate)\n${daten.ablauf.map((a) => `- ${a.wann}: ${a.was}. ${a.text}`).join('\n')}\n\n## Zusagen\n${daten.zusagen.map((z) => '- ' + z).join('\n')}\n\n## Grenzen\n${daten.grenzen.map((z) => '- ' + z).join('\n')}\n\n## ${daten.abend.name}\n${daten.abend.text} Erster Abend: ${daten.abend.start}. Für Gäste kostenlos, auf Einladung. Abendpartner: ${preisSatz('abendpartner')}, netto. Anmeldung zur Gästeliste: ${INNOVATION}/events/\n\n## Zahlen aus Studien (am Original geprüft)\n${daten.zahlen.map((z) => `- ${z.satz} Quelle: ${z.quelle}, ${z.link}`).join('\n')}\n\n## Fragen und Antworten\n${alleFragen.map((q) => `### ${q.f}\n${q.a}`).join('\n\n')}\n\n${kontaktBlock}\n\n${auchVonUns}\n\nStand: ${daten.stand}\n`;
  const dateien = {
    'robots.txt': oeffentlich
      ? `# MAKE Revenue: alles offen, auch für die Such-Bots der KI-Anbieter (SEO-GEO-VORGABEN 2.5 und 2.6)\nUser-agent: *\nAllow: /\n\nSitemap: ${BASIS}/sitemap.xml\n`
      : '# MAKE Revenue · Vorschau: nichts wird eingelesen. Freigabe über seo.json (oeffentlich) und node seo.mjs.\nUser-agent: *\nDisallow: /\n',
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${fertig.map((f) => `  <url><loc>${att(f.url)}</loc><lastmod>${f.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`,
    'llms.txt': llms,
    'llms-full.txt': voll,
    [`${einstellung.indexnow}.txt`]: einstellung.indexnow + '\n',
    'site.webmanifest': JSON.stringify({ name: 'MAKE Revenue', short_name: 'MAKE Revenue', description: daten.satz.revenue, lang: 'de', start_url: '/', display: 'browser', background_color: daten.farbe.papier, theme_color: daten.farbe.nacht,
      icons: [{ src: 'bild/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'bild/logo.png', sizes: '512x512', type: 'image/png' }] }, null, 1) + '\n',
  };
  if (!nurPruefen) {
    for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(ORDNER, name), inhalt);
    writeFileSync(standDatei, JSON.stringify(stand, null, 1) + '\n');
    // Markerdatei: Solange sie liegt, kann der Server „X-Robots-Tag: noindex, nofollow“ setzen (zweites Schloss)
    if (oeffentlich) rmSync(join(ORDNER, '.vorschau'), { force: true });
    else writeFileSync(join(ORDNER, '.vorschau'), 'Vorschau: nicht freigegeben. Diese Datei löscht „node seo.mjs“, sobald seo.json › oeffentlich auf true steht.\n');
  }

  // ─── Prüfer ───
  // Preise in preise.json selbst
  for (const [k, p] of Object.entries(PREISE.eintraege)) if (p.ab !== 'ab ' + p.betrag.toLocaleString('de-DE') + ' €') fehler.push(`preise.json: ${k}: ab-Text passt nicht zum Betrag`);
  if (!PREISE.netto || !/netto/.test(PREISE.hinweis || '')) fehler.push('preise.json: Hinweis „netto zuzüglich Umsatzsteuer“ fehlt');
  const preiseInHtml = (wo, html) => {
    // 1) Jede Preismarke trägt genau den Text aus preise.json
    let marken = 0;
    for (const m of html.matchAll(/<span data-preis="([a-z-]+)">([^<]*)<\/span>/g)) { marken++; const p = P(m[1]); if (!p) fehler.push(`${wo}: Preismarke „${m[1]}“ gibt es in preise.json nicht`); else if (m[2].replace(/&nbsp;/g, ' ') !== p.ab) fehler.push(`${wo}: Preismarke ${m[1]} trägt „${m[2]}“ statt „${p.ab}“`); }
    // 2) Außerhalb von Preismarken, Rechenbeispielen und dem Kopf steht im sichtbaren Teil kein Euro-Betrag
    if ((html.match(/<!-- beispiel:anfang -->/g) || []).length !== (html.match(/<!-- beispiel:ende -->/g) || []).length) fehler.push(`${wo}: Markierung der Rechenbeispiele ist nicht geschlossen`);
    const rumpf = (/<body[\s\S]*<\/body>/.exec(html) || [''])[0].replace(/<!-- beispiel:anfang -->[\s\S]*?<!-- beispiel:ende -->/g, ' ').replace(/<span data-preis="[a-z-]+">[^<]*<\/span>/g, ' ');
    for (const m of rumpf.matchAll(BETRAG)) fehler.push(`${wo}: Euro-Betrag „${m[0].replace(/&nbsp;/g, ' ')}“ steht nicht in einer Preismarke aus preise.json`);
    // 3) Im Kopf (Beschreibung, strukturierte Daten) stammt jeder Betrag aus preise.json
    const kopfTeil = (/<head[\s\S]*<\/head>/.exec(html) || [''])[0];
    for (const m of kopfTeil.matchAll(BETRAG)) if (!erlaubt.has(zahlAus(m[1]))) fehler.push(`${wo}: Betrag „${m[0]}“ im Kopf steht nicht in preise.json`);
    for (const m of kopfTeil.matchAll(/"(?:minPrice|price|lowPrice|highPrice)":\s*"?(\d+(?:\.\d+)?)"?/g)) if (Number(m[1]) !== 0 && !erlaubt.has(Number(m[1]))) fehler.push(`${wo}: Preis ${m[1]} in den strukturierten Daten steht nicht in preise.json`);
    return marken;
  };
  const titel = new Map(), beschreibungen = new Map(), begriffe = new Map(); let impressumFremd = 0;
  for (const { s, html, url } of fertig) {
    const wo = s.datei;
    const sicht = text((/<body[\s\S]*<\/body>/.exec(html) || [''])[0]);
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fehler.push(`${wo}: ${h1} h1 statt genau einer`);
    if (s.titel.length < TITEL_LAENGE[0] || s.titel.length > TITEL_LAENGE[1]) fehler.push(`${wo}: Titel hat ${s.titel.length} Zeichen (erlaubt ${TITEL_LAENGE.join(' bis ')})`);
    if (s.beschreibung.length < BESCHREIBUNG_LAENGE[0] || s.beschreibung.length > BESCHREIBUNG_LAENGE[1]) fehler.push(`${wo}: Beschreibung hat ${s.beschreibung.length} Zeichen (erlaubt ${BESCHREIBUNG_LAENGE.join(' bis ')})`);
    if (titel.has(s.titel)) fehler.push(`${wo}: Titel doppelt (auch ${titel.get(s.titel)})`); else titel.set(s.titel, wo);
    if (beschreibungen.has(s.beschreibung)) fehler.push(`${wo}: Beschreibung doppelt`); else beschreibungen.set(s.beschreibung, wo);
    // Je Seite EIN Hauptbegriff: Er steht in Titel, Beschreibung und h1, und keine zweite Seite nimmt denselben
    if (!s.begriff) fehler.push(`${wo}: Hauptbegriff fehlt`);
    else {
      const klein = (t) => t.toLowerCase();
      const ueberschrift = text((/<h1[\s\S]*?<\/h1>/.exec(html) || [''])[0]);
      if (begriffe.has(s.begriff)) fehler.push(`${wo}: Hauptbegriff „${s.begriff}“ doppelt (auch ${begriffe.get(s.begriff)})`); else begriffe.set(s.begriff, wo);
      if (!klein(s.titel).includes(klein(s.begriff))) fehler.push(`${wo}: Hauptbegriff „${s.begriff}“ fehlt im Titel`);
      if (!klein(ueberschrift).includes(klein(s.begriff))) fehler.push(`${wo}: Hauptbegriff „${s.begriff}“ fehlt in der h1 („${ueberschrift}“)`);
      if (!klein(s.beschreibung).includes(klein(s.begriff))) fehler.push(`${wo}: Hauptbegriff „${s.begriff}“ fehlt in der Beschreibung`);
    }
    if ((html.match(/rel="canonical"/g) || []).length !== 1) fehler.push(`${wo}: Canonical fehlt oder steht mehrfach`);
    if ((html.match(/application\/ld\+json/g) || []).length !== 1) fehler.push(`${wo}: nicht genau ein JSON-LD`);
    // JSON-LD: gültig, kein leeres Feld, kein Platzhalter
    try {
      const roh = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
      const j = JSON.parse(roh);
      const leer = [];
      (function geh(o, weg) { if (o === '' || o === null || (Array.isArray(o) && !o.length)) leer.push(weg); else if (typeof o === 'object') for (const k of Object.keys(o)) geh(o[k], weg + '/' + k); })(j, '');
      if (leer.length) fehler.push(`${wo}: JSON-LD mit leerem Feld (${leer.join(', ')})`);
      if (/\{\{/.test(roh)) fehler.push(`${wo}: Platzhalter {{ im JSON-LD`);
      // Alles Ausgezeichnete steht auch sichtbar auf der Seite
      for (const q of s.fragen) { if (!sicht.includes(q.f)) fehler.push(`${wo}: Frage in den Daten, aber nicht sichtbar: „${q.f}“`); if (!sicht.includes(q.a)) fehler.push(`${wo}: Antwort in den Daten, aber nicht sichtbar: „${q.f}“`); }
      for (const b of s.begriffe) if (!sicht.includes(b.text)) fehler.push(`${wo}: Begriff in den Daten, aber nicht sichtbar: „${b.name}“`);
      for (const l of [...(s.leistungen || []), ...(s.leistung ? [s.leistung] : [])]) if (!sicht.includes(l.text)) fehler.push(`${wo}: Leistungstext in den Daten, aber nicht sichtbar: „${l.name}“`);
      // Angebote mit Preis: Die Preismarke steht auch sichtbar auf der Seite
      for (const k of [...(s.angebote || []), ...(s.leistungen || []).map((l) => l.key)]) if (!html.includes(`data-preis="${k}"`)) fehler.push(`${wo}: Angebot „${k}“ steht mit Preis in den Daten, aber nicht sichtbar auf der Seite`);
      // Der Standardsatz der Marke steht in den strukturierten Daten und in llms.txt, nicht im sichtbaren Text (Schreibregeln 12.11.2026:
      // Wer zu wem gehört, sagt sichtbar nur die Fußzeile und die Frage „Wer steht hinter MAKE Revenue?“).
      if (!s.pfad && !(j['@graph'] || []).some((k) => k['@type'] === 'Organization' && k.description === daten.satz.revenue)) fehler.push(`${wo}: Standardsatz der Marke fehlt in den strukturierten Daten (Organization)`);
    } catch (err) { fehler.push(`${wo}: JSON-LD ungültig (${err.message})`); }
    // Anbieterin im Fuß jeder Seite (seit 21.11.2026: MAKE Innovation GmbH)
    if (anbieter.name && !sicht.includes(`eine Marke der ${anbieter.name}`)) fehler.push(`${wo}: Fußzeile „eine Marke der ${anbieter.name}“ fehlt`);
    if (/\{\{|\[\[|TODO|Lorem|Platzhalter/.test(html)) fehler.push(`${wo}: Platzhalter im HTML`);
    if (/[\u2014\u2013]/.test(html)) fehler.push(`${wo}: Gedankenstrich im HTML`);
    if (/\bUG\b|HRB|Erstgespräch vereinbaren<\/a>/.test(html)) fehler.push(`${wo}: alte Firma, Registernummer oder alter Knopf-Wortlaut im HTML`);
    if (/<style[\s>]|\sstyle="|\son[a-z]+="/.test(html)) fehler.push(`${wo}: Inline-Stil oder on…-Handler`);
    if (/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/.test(html)) fehler.push(`${wo}: Inline-Skript`);
    if (/hreflang=/.test(html)) fehler.push(`${wo}: hreflang gesetzt (es gibt nur eine Sprachfassung)`);
    // Ein Hauptknopf: genau ein Wortlaut, mindestens einmal je Seite
    const rufe = [...html.matchAll(/<a class="knopf knopf-ruf[^"]*"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    if (!rufe.length) fehler.push(`${wo}: Hauptknopf fehlt`);
    if (new Set(rufe).size > 1) fehler.push(`${wo}: Hauptknopf mit mehreren Wortlauten (${[...new Set(rufe)].join(' / ')})`);
    preiseInHtml(wo, html);
    // Lokale Verweise: jede Datei gibt es; nichts, was der Browser lädt, endet auf .mjs oder .md (liefert der Server nie aus)
    const tiefe = s.pfad ? dirname(join(ORDNER, s.datei)) : ORDNER;
    const verweise = [...html.matchAll(/\s(?:href|src|data-stil)="([^"#?]+)[^"]*"/g)].map((m) => m[1]);
    for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const teil of m[1].split(',')) verweise.push(teil.trim().split(/\s+/)[0]);
    for (const z of verweise) {
      if (/^(https?:|mailto:|tel:|data:)/.test(z)) continue;
      if (/\.(mjs|md)$/.test(z) || /(^|\/)(seo|seo-stand|seiten)\.json$/.test(z)) fehler.push(`${wo}: Verweis auf eine Datei, die der Server nie ausliefert: ${z}`);
      const pfad = join(z.startsWith('/') ? ORDNER : tiefe, z.endsWith('/') ? z + 'index.html' : z);
      if (!existsSync(pfad)) fehler.push(`${wo}: Verweis ins Leere: ${z}`);
    }
    // Sprungziele auf derselben Seite und auf anderen eigenen Seiten gibt es
    for (const m of html.matchAll(/\shref="([^"#?:]*)#([A-Za-z][\w-]*)"/g)) {
      const [, ziel, anker] = m;
      if (/^(https?|mailto)/.test(ziel)) continue;
      const datei = ziel ? join(ziel.startsWith('/') ? ORDNER : tiefe, ziel.endsWith('/') ? ziel + 'index.html' : ziel) : join(ORDNER, s.datei);
      if (!existsSync(datei)) continue;
      const zielHtml = datei === join(ORDNER, s.datei) ? html : readFileSync(datei, 'utf8');
      if (!new RegExp(`\\sid="${anker}"`).test(zielHtml)) fehler.push(`${wo}: Sprungziel #${anker} fehlt in ${ziel || 'dieser Seite'}`);
    }
    // Familien-Links tragen ihren Rückfall aus familie.js im HTML (Bots ohne JavaScript sehen sonst tote Links)
    if (/<a[^>]*\shref="#"[^>]*data-familie=/.test(html)) fehler.push(`${wo}: Familien-Link ohne Rückfall`);
    const fremdesImpressum = /href="([^"]+)"[^>]*data-pfad="impressum\/"|data-pfad="impressum\/"[^>]*href="([^"]+)"/.exec(html);
    // Kevins Vorgabe (STRUKTUR-MARKEN, Nachtrag 11.11.): Impressum und Datenschutz sind reine Verweise auf die Seiten von MAKE Innovation. Deshalb nur ein Hinweis,
    // kein Abbruch. SEO-GEO-VORGABEN 5.5 empfiehlt ein eigenes Impressum je Domain: Das entscheidet Kevin vor der Freigabe.
    if (fremdesImpressum && !(fremdesImpressum[1] || fremdesImpressum[2]).startsWith(BASIS + '/')) impressumFremd++;
    if (oeffentlich) {
      if (!/^https:\/\//.test(url)) fehler.push(`${wo}: Canonical ist nicht https`);
      if (lokal(html)) fehler.push(`${wo}: Vorschau-Adresse (localhost) in einer öffentlichen Datei`);
      if (/noindex/.test((/<meta name="robots"[^>]*>/.exec(html) || [''])[0])) fehler.push(`${wo}: noindex trotz Freigabe`);
    } else if (!/content="noindex, nofollow"/.test(html)) fehler.push(`${wo}: Vorschau ohne noindex, nofollow`);
  }
  if (impressumFremd) hinweise.push(`Impressum und Datenschutz verweisen auf die Seiten von MAKE Innovation (${impressumFremd} Seiten). So ist es vorgegeben; ein eigenes Impressum je Domain entscheidet Kevin vor der Freigabe.`);
  if (seite404 && !/content="noindex, nofollow"/.test(seite404)) fehler.push('404.html: muss noindex bleiben');
  if (!dateien['llms.txt'].includes(daten.satz.revenue)) fehler.push('llms.txt: Standardsatz der Marke fehlt');
  // llms-Dateien: jeder Betrag aus preise.json, jedes Angebot mit Preis genannt
  for (const name of ['llms.txt', 'llms-full.txt']) {
    for (const m of dateien[name].matchAll(BETRAG)) if (!erlaubt.has(zahlAus(m[1]))) fehler.push(`${name}: Betrag „${m[0]}“ steht nicht in preise.json`);
    for (const a of daten.angebote) if (!dateien[name].includes(preisSatz(a.key))) fehler.push(`${name}: Preis für „${a.name}“ fehlt`);
    if (/[\u2014\u2013]/.test(dateien[name])) fehler.push(`${name}: Gedankenstrich`);
  }
  for (const bild of ['bild/og.png', 'bild/logo.png', 'bild/icon-192.png', 'bild/icon-180.png', 'favicon.ico', 'zeichen.svg']) if (!existsSync(join(ORDNER, bild))) fehler.push(`${bild} fehlt`);
  if (oeffentlich) {
    for (const [name, inhalt] of Object.entries(dateien)) if (lokal(inhalt)) fehler.push(`${name}: Vorschau-Adresse (localhost) in einer öffentlichen Datei`);
    for (const [k, v] of Object.entries(fam)) if (lokal(v) || !/^https:\/\//.test(v)) fehler.push(`familie.js: „${k}“ ist keine echte https-Adresse`);
    if (existsSync(join(ORDNER, '.vorschau')) && !nurPruefen) fehler.push('.vorschau liegt noch, obwohl freigegeben');
    hinweise.push('ÖFFENTLICH gebaut. Auf dem Server gehört dazu: im Caddyfile für makerevenue.de X-Robots-Tag und basic_auth entfernen. Sonst bleibt die Seite trotz dieses Schalters gesperrt.');
  } else if (!/Disallow: \//.test(dateien['robots.txt'])) fehler.push('robots.txt: Vorschau muss alles sperren');
  // Skripte und Stile: kein Gedankenstrich in dem, was Besucher lesen könnten; Skripte, die der Browser lädt, importieren nichts mit .mjs
  for (const name of readdirSync(ORDNER).filter((n) => /\.(js|css|svg|txt|webmanifest)$/.test(n) && !n.startsWith('seo'))) {
    const inhalt = nurPruefen && dateien[name] ? dateien[name] : lies(name);
    if (/\u2014/.test(inhalt)) fehler.push(`${name}: Gedankenstrich „\u2014“`);
    if (/\.js$/.test(name) && /(from|import)\s*\(?\s*['"][^'"]+\.mjs['"]/.test(inhalt)) fehler.push(`${name}: lädt eine .mjs-Datei (liefert der Server nie aus)`);
  }

  const zustand = oeffentlich ? 'ÖFFENTLICH' : 'Vorschau (noindex, robots.txt sperrt alles)';
  console.log(`seo: ${fertig.length} Seiten · Zustand: ${zustand} · Adresse: ${BASIS}/${nurPruefen ? ' · nur geprüft' : ''}`);
  for (const h of hinweise) console.log('  Hinweis: ' + h);
  for (const f of fehler) console.error('  FEHLER:  ' + f);
  console.log(fehler.length ? `seo: ${fehler.length} Fehler` : 'seo: Prüfer grün');
  return fehler.length === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(seo({ nurPruefen: process.argv.includes('--pruefen') }) ? 0 : 1);
