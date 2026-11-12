// MAKE Revenue · der Schalter für Suche und KI-Suchen (SEO-GEO-VORGABEN, Abschnitt 8).
// Aufruf:  node seo.mjs            schreibt Kopf, Dateien und prüft
//          node seo.mjs --pruefen  prüft nur, schreibt nichts
//
// Freigabe (nur auf Kevins Wort), genau zwei Handgriffe, dann dieses Skript:
//   1) familie.js: die echten Adressen eintragen (https).
//   2) seo.json:   "oeffentlich": true.
//   3) node seo.mjs   (oder node bauen.mjs, das ruft dieses Skript am Ende auf). Der Prüfer muss grün sein.
//
// Was das Skript tut:
//   · schreibt in jede HTML-Seite den Block zwischen <!-- seo:anfang --> und <!-- seo:ende --> (Titel, Beschreibung,
//     robots, Canonical, Open Graph, EIN JSON-LD mit @graph)
//   · setzt den Rückfall aller Familien-Links (data-familie) im HTML aus familie.js
//   · erzeugt robots.txt, sitemap.xml, llms.txt, die IndexNow-Datei, site.webmanifest und die Markerdatei .vorschau
//   · prüft und bricht mit Fehlercode ab, wenn etwas nicht stimmt (Liste unten in pruefe…)
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const lies = (name) => readFileSync(join(ORDNER, name), 'utf8');
const att = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const TITEL_LAENGE = [15, 65], BESCHREIBUNG_LAENGE = [110, 165];

export function seo({ nurPruefen = false } = {}) {
  const fehler = [], hinweise = [];
  // ─── Einstellungen ───
  const einstellung = JSON.parse(lies('seo.json'));
  if (!einstellung.indexnow) { einstellung.indexnow = randomBytes(16).toString('hex'); if (!nurPruefen) writeFileSync(join(ORDNER, 'seo.json'), JSON.stringify(einstellung, null, 2) + '\n'); }
  const oeffentlich = einstellung.oeffentlich === true;
  const fam = Function('return ' + /export const FAMILIE = (\{[\s\S]*?\});/.exec(lies('familie.js'))[1])();
  const ohneStrich = (u) => u.replace(/\/+$/, '');
  const BASIS = ohneStrich(fam[einstellung.marke]);
  const INNOVATION = ohneStrich(fam.innovation), STUDIOS = ohneStrich(fam.studios);
  const lokal = (u) => /localhost|127\.0\.0\.1|\.local\b/.test(u);
  const daten = JSON.parse(lies('seiten.json'));
  const ORG = `${BASIS}/#organisation`, DACH = `${INNOVATION}/#organisation`, SITE = `${BASIS}/#website`;
  const heute = new Date().toISOString().slice(0, 10);

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
  const organisation = () => ({
    '@type': 'Organization', '@id': ORG, name: 'MAKE Revenue', url: `${BASIS}/`, description: daten.satz.revenue,
    logo: { '@type': 'ImageObject', url: `${BASIS}/bild/logo.png`, width: 512, height: 512 }, email: daten.mail,
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    knowsAbout: ['Vertriebsaufbau', 'Vertriebsleitung auf Zeit', 'Vertriebskennzahlen', 'CRM', 'Netzwerk-Events'],
    brand: { '@type': 'Brand', '@id': `${BASIS}/#marke`, name: 'MAKE Revenue' },
    // RECHTSFORM: bewusst ohne legalName, Anschrift, Telefon und Registerangaben, bis Kevin die Gesellschaft entschieden hat
    parentOrganization: { '@type': 'Organization', '@id': DACH, name: 'MAKE Innovation', url: `${INNOVATION}/` },
  });
  const leistungKnoten = (l, url, id) => ({ '@type': 'Service', '@id': id, name: l.name, serviceType: l.art, description: l.text, provider: { '@id': ORG },
    areaServed: { '@type': 'Country', name: 'Deutschland' }, audience: { '@type': 'BusinessAudience', audienceType: 'Gründer, Mittelstand und Dienstleister im B2B' }, url });
  const graph = (s, url, lastmod) => {
    const g = [];
    const seite = { '@type': 'WebPage', '@id': `${url}#webseite`, url, name: s.titel, description: s.beschreibung, isPartOf: { '@id': SITE }, about: { '@id': ORG }, inLanguage: 'de-DE', dateModified: lastmod,
      primaryImageOfPage: { '@type': 'ImageObject', url: `${BASIS}/bild/og.png`, width: 1200, height: 630 } };
    if (!s.pfad) {
      g.push(organisation());
      g.push({ '@type': 'WebSite', '@id': SITE, url: `${BASIS}/`, name: 'MAKE Revenue', inLanguage: 'de-DE', publisher: { '@id': ORG } });
      g.push(seite);
      for (const l of s.leistungen) g.push(leistungKnoten(l, `${BASIS}/${l.pfad}`, `${BASIS}/${l.pfad}#leistung`));
    } else {
      seite.author = { '@type': 'Person', name: 'Kevin Dieckmann', jobTitle: 'Vertrieb und Umsetzung', worksFor: { '@id': DACH } };
      g.push(seite);
      g.push({ '@type': 'BreadcrumbList', '@id': `${url}#brotkrumen`, itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: `${BASIS}/` },
        { '@type': 'ListItem', position: 2, name: s.name, item: url }] });
      if (s.leistung) g.push(leistungKnoten(s.leistung, url, `${url}#leistung`));
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
  const blockSetzen = (html, block) => html.replace(/<!-- seo:anfang -->[\s\S]*?<!-- seo:ende -->/, `<!-- seo:anfang -->\n${block}\n<!-- seo:ende -->`);

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
  const dateien = {
    'robots.txt': oeffentlich
      ? `# MAKE Revenue: alles offen, auch für die Such-Bots der KI-Anbieter (SEO-GEO-VORGABEN 2.5 und 2.6)\nUser-agent: *\nAllow: /\n\nSitemap: ${BASIS}/sitemap.xml\n`
      : '# MAKE Revenue · Vorschau: nichts wird eingelesen. Freigabe über seo.json (oeffentlich) und node seo.mjs.\nUser-agent: *\nDisallow: /\n',
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${fertig.map((f) => `  <url><loc>${att(f.url)}</loc><lastmod>${f.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`,
    'llms.txt': `# MAKE Revenue\n\n> ${daten.satz.revenue}\n\n## Leistungen\n${fertig.filter((f) => f.s.leistung).map((f) => `- [${f.s.leistung.name}](${f.url}): ${f.s.leistung.kurz}`).join('\n')}\n\n## Mehr\n${fertig.filter((f) => f.s.pfad && !f.s.leistung).map((f) => `- [${f.s.name}](${f.url}): ${f.s.beschreibung}`).join('\n')}\n\n## Kontakt\n- E-Mail: ${daten.mail}\n- Erstgespräch: kostenlos, 30 Minuten per Video\n\n## Die Familie\n- [MAKE Innovation](${INNOVATION}/): ${daten.satz.innovation} Dort stehen die Preise.\n- [MAKE Studios](${STUDIOS}/): ${daten.satz.studios}\n\nStand: ${daten.stand}\n`,
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
  const titel = new Map(), beschreibungen = new Map(); let impressumFremd = 0;
  for (const { s, html, url } of fertig) {
    const wo = s.datei;
    const sicht = text((/<body[\s\S]*<\/body>/.exec(html) || [''])[0]);
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fehler.push(`${wo}: ${h1} h1 statt genau einer`);
    if (s.titel.length < TITEL_LAENGE[0] || s.titel.length > TITEL_LAENGE[1]) fehler.push(`${wo}: Titel hat ${s.titel.length} Zeichen (erlaubt ${TITEL_LAENGE.join(' bis ')})`);
    if (s.beschreibung.length < BESCHREIBUNG_LAENGE[0] || s.beschreibung.length > BESCHREIBUNG_LAENGE[1]) fehler.push(`${wo}: Beschreibung hat ${s.beschreibung.length} Zeichen (erlaubt ${BESCHREIBUNG_LAENGE.join(' bis ')})`);
    if (titel.has(s.titel)) fehler.push(`${wo}: Titel doppelt (auch ${titel.get(s.titel)})`); else titel.set(s.titel, wo);
    if (beschreibungen.has(s.beschreibung)) fehler.push(`${wo}: Beschreibung doppelt`); else beschreibungen.set(s.beschreibung, wo);
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
      if (!s.pfad && !sicht.includes(daten.satz.revenue)) fehler.push(`${wo}: Standardsatz der Marke nicht sichtbar`);
    } catch (err) { fehler.push(`${wo}: JSON-LD ungültig (${err.message})`); }
    if (/\{\{|\[\[|TODO|Lorem|Platzhalter/.test(html)) fehler.push(`${wo}: Platzhalter im HTML`);
    if (/\u2014/.test(html)) fehler.push(`${wo}: Gedankenstrich „\u2014“ im HTML`);
    if (/GmbH|\bUG\b|legalName|HRB/.test(html)) fehler.push(`${wo}: Rechtsform oder Firmenname im HTML (gilt, bis Kevin die Gesellschaft entschieden hat)`);
    if (/<style[\s>]|\sstyle="|\son[a-z]+="/.test(html)) fehler.push(`${wo}: Inline-Stil oder on…-Handler`);
    if (/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/.test(html)) fehler.push(`${wo}: Inline-Skript`);
    if (/hreflang=/.test(html)) fehler.push(`${wo}: hreflang gesetzt (es gibt nur eine Sprachfassung)`);
    // Lokale Verweise: jede Datei gibt es
    const tiefe = s.pfad ? dirname(join(ORDNER, s.datei)) : ORDNER;
    for (const m of html.matchAll(/\s(?:href|src)="([^"#?]+)[^"]*"/g)) {
      const z = m[1];
      if (/^(https?:|mailto:|tel:|data:)/.test(z)) continue;
      const pfad = join(z.startsWith('/') ? ORDNER : tiefe, z.endsWith('/') ? z + 'index.html' : z);
      if (!existsSync(pfad)) fehler.push(`${wo}: Verweis ins Leere: ${z}`);
    }
    // Familien-Links tragen ihren Rückfall aus familie.js im HTML (Bots ohne JavaScript sehen sonst tote Links)
    if (/<a[^>]*\shref="#"[^>]*data-familie=/.test(html)) fehler.push(`${wo}: Familien-Link ohne Rückfall`);
    const fremdesImpressum = /href="([^"]+)"[^>]*data-pfad="impressum\/"|data-pfad="impressum\/"[^>]*href="([^"]+)"/.exec(html);
    // Kevins Vorgabe (STRUKTUR-MARKEN, Nachtrag 11.11.): Impressum und Datenschutz sind reine Verweise auf die Seiten des Dachs. Deshalb nur ein Hinweis,
    // kein Abbruch. SEO-GEO-VORGABEN 5.5 empfiehlt ein eigenes Impressum je Domain: Das entscheidet Kevin vor der Freigabe.
    if (fremdesImpressum && !(fremdesImpressum[1] || fremdesImpressum[2]).startsWith(BASIS + '/')) impressumFremd++;
    if (oeffentlich) {
      if (!/^https:\/\//.test(url)) fehler.push(`${wo}: Canonical ist nicht https`);
      if (lokal(html)) fehler.push(`${wo}: Vorschau-Adresse (localhost) in einer öffentlichen Datei`);
      if (/noindex/.test((/<meta name="robots"[^>]*>/.exec(html) || [''])[0])) fehler.push(`${wo}: noindex trotz Freigabe`);
    } else if (!/content="noindex, nofollow"/.test(html)) fehler.push(`${wo}: Vorschau ohne noindex, nofollow`);
  }
  if (impressumFremd) hinweise.push(`Impressum und Datenschutz verweisen auf die Seiten des Dachs (${impressumFremd} Seiten). So ist es vorgegeben; ein eigenes Impressum je Domain entscheidet Kevin vor der Freigabe.`);
  if (seite404 && !/content="noindex, nofollow"/.test(seite404)) fehler.push('404.html: muss noindex bleiben');
  for (const bild of ['bild/og.png', 'bild/logo.png', 'bild/icon-192.png', 'bild/icon-180.png', 'favicon.ico', 'zeichen.svg']) if (!existsSync(join(ORDNER, bild))) fehler.push(`${bild} fehlt`);
  if (oeffentlich) {
    for (const [name, inhalt] of Object.entries(dateien)) if (lokal(inhalt)) fehler.push(`${name}: Vorschau-Adresse (localhost) in einer öffentlichen Datei`);
    for (const [k, v] of Object.entries(fam)) if (lokal(v) || !/^https:\/\//.test(v)) fehler.push(`familie.js: „${k}“ ist keine echte https-Adresse`);
    if (existsSync(join(ORDNER, '.vorschau')) && !nurPruefen) fehler.push('.vorschau liegt noch, obwohl freigegeben');
  } else if (!/Disallow: \//.test(dateien['robots.txt'])) fehler.push('robots.txt: Vorschau muss alles sperren');
  // Skripte und Stile: kein Gedankenstrich in dem, was Besucher lesen könnten
  for (const name of readdirSync(ORDNER).filter((n) => /\.(js|css|svg|txt|webmanifest)$/.test(n) && !n.startsWith('seo'))) if (/\u2014/.test(lies(name))) fehler.push(`${name}: Gedankenstrich „\u2014“`);

  const zustand = oeffentlich ? 'ÖFFENTLICH' : 'Vorschau (noindex, robots.txt sperrt alles)';
  console.log(`seo: ${fertig.length} Seiten · Zustand: ${zustand} · Adresse: ${BASIS}/${nurPruefen ? ' · nur geprüft' : ''}`);
  for (const h of hinweise) console.log('  Hinweis: ' + h);
  for (const f of fehler) console.error('  FEHLER:  ' + f);
  console.log(fehler.length ? `seo: ${fehler.length} Fehler` : 'seo: Prüfer grün');
  return fehler.length === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(seo({ nurPruefen: process.argv.includes('--pruefen') }) ? 0 : 1);
