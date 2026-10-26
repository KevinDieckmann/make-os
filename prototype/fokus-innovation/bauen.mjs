#!/usr/bin/env node
// ─── Fokus Innovation · Website (Prototyp 25.10.2026, dritte Fassung) ─────────────────────────────────────────────────
// Alle Seiten aus EINER Quelle: inhalt/fokus.json (Marke, Leitidee, Bereiche, Abend, Über uns — aus dem Positionierungs-Doc)
// und den Angeboten der bisherigen Website (makeinnovation/inhalt/*.json: Preise, Produktblätter, Fragen). Nie eine Seite von
// Hand ändern — Text in den JSON-Dateien, Aussehen in css/, dann:
//   node prototype/fokus-innovation/bauen.mjs            → schreibt alle Seiten und prüft sie
//   node prototype/fokus-innovation/bauen.mjs --pruefen  → nur prüfen (Ausgang 1 bei Abweichung oder Regelverstoß)
// Regeln: keine Cookies, kein Tracking, keine Formulare, keine fremden Quellen, keine Inline-Skripte oder -Stile (CSP 'self'),
// der Name der eigenen Software und Connect stehen nirgends, Statistiken nur mit Quelle.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORDNER = dirname(fileURLToPath(import.meta.url));
const REPO = join(ORDNER, '..', '..');
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── Hilfen ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Texte der bisherigen Website: Altnamen der Marke ersetzen (der Prüfer meldet jeden Rest). */
const BEGRIFFE = [
  [/aus dem MAKE-Netzwerk/g, 'aus unserem Netzwerk'], [/MAKE-Netzwerk/g, 'Netzwerk'], [/MAKE Innovation/g, 'Fokus Innovation'],
  // Interne Begriffe der Produktblätter in Worte, die Kunden verstehen
  [/Bestandsreaktivierung nach BEAN/g, 'Reaktivierung deiner Bestandskunden'], [/Skriptset mit BANT/g, 'Gesprächsleitfäden mit Bedarfsfragen'],
  [/33 gute Gründe/g, '33 Kaufargumente'], [/Security-Call gegen No-Shows/g, 'Erinnerungsanruf gegen ausgefallene Termine'],
  [/Onboarding mit Stempelkarte \(10 Stationen\)/g, 'Einarbeitung in 10 Stationen'], [/Stempelkarte vor dem ersten Live-Call/g, 'Einarbeitung vor dem ersten Live-Call'],
  [/die Stempelkarte abgeschlossen/g, 'die Einarbeitung abgeschlossen'], [/Sektionen/g, 'Abschnitte'], [/ im Hero/g, ' im Startbild'], [/7 Worten/g, '7 Wörtern'],
];
const alt = (s) => BEGRIFFE.reduce((x, [re, neu]) => x.replace(re, neu), String(s ?? ''));
/** Text mit Platzhaltern: [[KEVIN: …]] wird markiert und vom Prüfer gezählt. */
const t = (s) => e(alt(s)).replace(/\[\[KEVIN: ([^\]]*)\]\]/g, (_, x) => `<span class="ph">[[KEVIN: ${x}]]</span>`);
const istPlatzhalter = (s) => /\[\[KEVIN:/.test(String(s ?? ''));
const stempel = (datei) => createHash('sha256').update(readFileSync(join(ORDNER, datei))).digest('hex').slice(0, 10);
const PFEIL = '<svg class="pfeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const ZEICHEN = (klasse = 'zeichen') => `<svg class="${klasse}" viewBox="0 0 48 48" aria-hidden="true"><path class="bahn" d="M37.86,16 A16,16 0 1 1 26.78,8.24"/><circle class="punkt" cx="37.2" cy="9.3" r="2.8"/><circle class="kern" cx="24" cy="24" r="7"/></svg>`;
const WORTBILD = '<span class="wortbild" aria-hidden="true"><b>FOKUS</b><small>Innovation</small></span>';

/** Reihenfolge der Bereiche (Positionierung 25.10.: gesehen → verkauft → im Alltag angekommen). */
export const BEREICHE = ['sichtbarkeit', 'vertrieb', 'innovation'];

export function quellen() {
  const alteSeite = join(REPO, 'makeinnovation', 'inhalt');
  const inhalt = lies(join(alteSeite, 'inhalt.json'));
  const seite = lies(join(alteSeite, 'seite.json'));
  const blaetter = lies(join(alteSeite, 'produkte.json'));
  const fokus = lies(join(ORDNER, 'inhalt', 'fokus.json'));
  const stufen = lies(join(REPO, 'lib/check/vorlagen/innovations-check/scoring.json')).stufen;
  const katalog = lies(join(REPO, 'lib/check/vorlagen/innovations-check/fragenkatalog.json'));
  const aus = seite.ausgeblendet ?? {};
  inhalt.angebote = inhalt.angebote.filter((a) => !(aus.angebote ?? []).includes(a.id) && a.id !== 'fokus-innovation');
  inhalt.zusatzoptionen = inhalt.zusatzoptionen.filter((z) => !(aus.zusatzoptionen ?? []).includes(z.name));
  return { inhalt, seite, blaetter, fokus, stufen, katalog };
}

// ── Seiten bauen ────────────────────────────────────────────────────────────────────────────────────────────────────
export function seitenBauen(q = quellen()) {
  const { inhalt, seite, blaetter, fokus: F, stufen, katalog } = q;
  const angebot = (id) => inhalt.angebote.find((a) => a.id === id);
  const startBereiche = Object.fromEntries(inhalt.startseite.find((s) => s.id === 'bereiche').bereiche.map((b) => [b.name.toLowerCase(), b.angebote]));
  // Sichtbarkeit erzählt in der Reihenfolge der Arbeit: erst die Positionierung, dann Homepage, dann Videos.
  const REIHENFOLGE = { sichtbarkeit: ['positionierung', 'homepage-landing', 'homepage-story', 'homepage-cinematic', 'erklaervideo', 'videostory', 'video-serie'] };
  const rang = (b, id) => { const i = (REIHENFOLGE[b] ?? []).indexOf(id); return i < 0 ? 99 : i; };
  const produkteIn = (b) => (startBereiche[b] ?? []).map(angebot).filter(Boolean).sort((x, y) => rang(b, x.id) - rang(b, y.id));
  const produktPfad = (a) => `/${a.bereich.toLowerCase()}/${a.id}/`;
  const faqVon = (ids) => ids.map((id) => inhalt.faq.find((f) => f.id === id)).filter(Boolean);
  /** Gemeinsame Antworten auf den Bereich zuschneiden (Rabatt, Kündigung). */
  const zuschneiden = (liste, k) => liste.map((f) => (F.fragen_zuschnitt[k]?.[f.id] ? { ...f, a: F.fragen_zuschnitt[k][f.id] } : f));
  const start = Object.fromEntries(inhalt.startseite.map((s) => [s.id, s]));
  const check = (quelle) => `${seite.check}?q=${quelle}`;
  const mail = (betreff) => `mailto:${seite.kontakt.mail}?subject=${encodeURIComponent(betreff)}`;
  const terminLink = (betreff) => (seite.termin.link ? seite.termin.link : mail(`Gespräch: ${betreff}`));
  const preisKurz = (a) => (/ \/ /.test(a.preis) ? `ab ${a.preis.split(' / ')[0]} €` : `${a.preis}${/^pro Monat/.test(a.preis_zusatz ?? '') ? ' / Monat' : ''}`);
  const bald = (a) => a.status === 'Coming Soon';
  const anbieter = seite.anbieter[seite.anbieter_aktiv];

  /** Produktblatt eines Angebots: eigene Angaben über denen der Familie; null, wenn es keins gibt. */
  const produktBlatt = (a) => {
    const p = blaetter.produkte[a.id];
    if (!p) return null;
    const f = p.familie ? blaetter.familien[p.familie] : {};
    const passt = (x) => (!x.nur || x.nur.includes(a.id)) && !(x.ohne ?? []).includes(a.id);
    return {
      ...f, ...p, ...(F.produkt_anpassung[a.id] ?? {}),
      konditionen: [...(p.konditionen_vorn ?? []), ...(p.konditionen ?? f.konditionen ?? [])],
      fragen: (p.fragen ?? f.fragen ?? []).filter(passt),
      katalog: p.katalog_auswahl ? p.katalog_auswahl.map((n) => f.katalog[n]) : null,
    };
  };
  /** Angebote eines Bereichs in Gruppen (Homepage-Pakete, Videos, …); Einzelne bilden eine Gruppe ohne Titel. */
  const gruppenIn = (b) => {
    const gruppen = [];
    for (const a of produkteIn(b)) {
      const name = a.gruppe ?? '';
      let g = gruppen.find((x) => x.name === name);
      if (!g) gruppen.push((g = { name, liste: [] }));
      g.liste.push(a);
    }
    return gruppen;
  };
  const anker = (name) => `angebot-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  // ── Bausteine ──
  const knopf = (href, text, art = '') => `<a class="knopf${art ? ` ${art}` : ''}" href="${href}">${e(text)} ${PFEIL}</a>`;
  const checkKnopf = (quelle, text = 'Innovations-Check starten', art = '') => knopf(check(quelle), text, art);
  const textlink = (href, text) => `<a class="textlink" href="${href}"><span>${e(text)}</span> ${PFEIL}</a>`;
  const vorzeile = (text, nr) => `<p class="vorzeile${nr ? ' mit-nr' : ''}">${nr ? `<span class="nr">${e(nr)}</span>` : ''}${e(text)}</p>`;
  const zeilen = (s) => (String(s).includes('|') ? String(s).split('|').map((z) => `<span class="zeile">${e(z)}</span>`).join('') : e(s));
  const titel = (haupt, ruhig) => `${zeilen(haupt)}${ruhig ? `<span class="ruhig">${zeilen(ruhig)}</span>` : ''}`;
  const abKopf = ({ marke, nr, h2, ruhig, lead, id }) => `<header class="ab-kopf erscheint"><p class="ab-marke">${nr ? `<span class="nr">${e(nr)}</span>` : ''}${e(marke)}</p><div><h2${id ? ` id="${id}"` : ''}>${titel(h2, ruhig)}</h2>${lead ? `<p class="lead">${t(lead)}</p>` : ''}</div></header>`;
  const punkte = (liste, klasse = 'punkte') => `<ul class="${klasse}">${liste.map((x) => `<li>${t(x)}</li>`).join('')}</ul>`;
  const weg = (stationen, { klasse = '', etiketten = ['Heute', 'Mit uns', 'Danach'], label = 'Der Weg' } = {}) => `<ol class="weg erscheint${klasse ? ` ${klasse}` : ''}" aria-label="${e(label)}">${stationen.map((s, i) => `<li class="station"><span class="etikett">${e(etiketten[i] ?? '')}</span><b>${t(typeof s === 'string' ? s : s.titel)}</b>${typeof s === 'string' || !s.text ? '' : `<span class="station-text">${t(s.text)}</span>`}</li>`).join('')}</ol>`;
  const zahl = (b) => `<figure class="zahl erscheint"><b>${e(b.wert)}</b><figcaption>${e(b.text)}<cite><a href="${e(b.link)}" rel="noopener" target="_blank">${e(b.quelle)}</a></cite></figcaption></figure>`;
  const raster = (liste, n = liste.length) => `<div class="raster n${n} erscheint">${liste.map((x, i) => `<div class="spalte">${x.nr !== false ? `<span class="nr">${String(i + 1).padStart(2, '0')}</span>` : ''}${x.etikett ? `<span class="etikett">${e(x.etikett)}</span>` : ''}<h3>${e(x.titel)}</h3><p>${t(x.text)}</p>${x.unter ? `<p class="spalte-beleg">${t(x.unter)}</p>` : ''}</div>`).join('')}</div>`;
  const fragen = (liste, titelText = 'Häufige Fragen') => (liste.length ? `<section class="abschnitt" aria-labelledby="fragen-titel"><div class="w"><div class="zweispaltig">
<div class="erscheint"><p class="ab-marke">Fragen</p><h2 id="fragen-titel">${e(titelText)}</h2><p class="leise">Noch etwas offen? Schreib uns an <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p></div>
<div class="fragen erscheint">${liste.map((f) => `<details><summary>${t(f.f)}<span class="plus" aria-hidden="true"></span></summary><p>${t(f.a)}</p></details>`).join('')}</div>
</div></div></section>` : '');
  const netto = '<p class="netto">Alle Preise netto zuzüglich Umsatzsteuer. Unsere Angebote richten sich an Unternehmen.</p>';
  const brotkrumen = (liste) => `<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a>${liste.map(([h, n]) => `<span aria-hidden="true">/</span>${h ? `<a href="${h}">${e(n)}</a>` : `<span aria-current="page">${e(n)}</span>`}`).join('')}</nav>`;
  /** Die lange Tafel des Abends: Plätze als Punkte, ein paar Verbindungen über den Tisch (zeichnen sich einmal). */
  const tafel = () => {
    const plaetze = [];
    for (let i = 0; i < 6; i++) { const x = 70 + i * 52; plaetze.push([x, 38], [x, 142]); }
    // Die Gastgeberin (unten, dritter Platz) verbindet Gäste über den Tisch hinweg, dazu ein Gespräch zwischen zwei Gästen.
    const faeden = [[0, 5], [6, 5], [10, 5], [8, 7]].map(([a, b]) => {
      const [x1, y1] = plaetze[a], [x2, y2] = plaetze[b];
      return `<path class="faden" pathLength="1" d="M${x1} ${y1 + 10} C ${x1} 90, ${x2} 90, ${x2} ${y2 - 10}"/>`;
    }).join('');
    return `<svg class="tafel erscheint" viewBox="0 0 400 180" role="img" aria-label="Ein langer Tisch mit zwölf Plätzen, Linien verbinden Menschen über den Tisch hinweg"><rect class="tisch" x="40" y="62" width="320" height="56" rx="6"/>${faeden}${plaetze.map(([x, y], i) => `<circle class="platz${i === 5 ? ' gastgeberin' : ''}" cx="${x}" cy="${y}" r="9"/>`).join('')}</svg>`;
  };

  // ── Rahmen: Kopf, Fuß, Check-Knopf ──
  const navUnter = (b) => [
    ...(b === 'innovation' ? [['/innovations-check/', 'Innovations-Check', 'kostenlos']] : []),
    ...produkteIn(b).map((a) => [produktPfad(a), F.kurznamen[a.id] ?? a.name, bald(a) ? 'bald' : preisKurz(a)]),
  ];
  const NAV = [
    ...BEREICHE.map((b) => ({ key: b, name: F.bereiche[b].name, href: `/${b}/`, unter: navUnter(b) })),
    { key: 'abend', name: 'Abend', href: '/abend/' },
    { key: 'ueber-uns', name: 'Über uns', href: '/ueber-uns/' },
  ];
  const kopf = (aktiv) => `<a class="sprung" href="#inhalt">Zum Inhalt</a>
<header class="kopf"><div class="w kopf-innen">
<a class="marke" href="/" aria-label="Fokus Innovation, zur Startseite">${ZEICHEN()}${WORTBILD}</a>
<nav class="haupt-nav" aria-label="Hauptmenü">${NAV.map((n) => {
    const cur = n.key === aktiv ? ' aria-current="page"' : '';
    if (!n.unter) return `<a href="${n.href}"${cur}>${e(n.name)}</a>`;
    return `<div class="nav-punkt"><a href="${n.href}"${cur}>${e(n.name)}</a><div class="unter"><a class="unter-alles" href="${n.href}">Überblick ${e(n.name)}</a>${n.unter.map(([h, name, p]) => `<a href="${h}">${e(name)}<span>${e(p)}</span></a>`).join('')}</div></div>`;
  }).join('')}</nav>
<a class="kopf-kontakt" href="/kontakt/"${aktiv === 'kontakt' ? ' aria-current="page"' : ''}>Kontakt</a>
<a class="knopf klein kopf-check" href="${check('kopf')}">Innovations-Check</a>
<details class="menue"><summary><span class="striche" aria-hidden="true"></span>Menü</summary><nav class="menue-blatt" aria-label="Menü">
${BEREICHE.map((b) => `<p class="menue-gruppe">${e(F.bereiche[b].name)}</p><a href="/${b}/">Überblick ${e(F.bereiche[b].name)}</a>${navUnter(b).map(([h, name]) => `<a href="${h}">${e(name)}</a>`).join('')}`).join('\n')}
<p class="menue-gruppe">Fokus Innovation</p><a href="/abend/">Abend</a><a href="/ueber-uns/">Über uns</a><a href="/kontakt/">Kontakt</a>
<a class="knopf" href="${check('menue')}">Innovations-Check starten ${PFEIL}</a>
</nav></details>
</div></header>`;

  const fussSpalte = (titelText, links) => `<div><p class="fuss-titel">${e(titelText)}</p><ul>${links.map(([h, n]) => `<li><a href="${h}">${e(n)}</a></li>`).join('')}</ul></div>`;
  const fuss = () => `<footer class="fuss"><div class="w">
<div class="fuss-raster">
<div class="fuss-marke"><a class="marke" href="/" aria-label="Fokus Innovation, zur Startseite">${ZEICHEN()}${WORTBILD}</a><p class="claim">${e(F.marke.claim)}</p>
<p><a href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a><br>${seite.kontakt.adresse.map(t).join('<br>')}</p></div>
${fussSpalte('Leistungen', [...BEREICHE.map((b) => [`/${b}/`, F.bereiche[b].name]), ['/innovations-check/', 'Innovations-Check']])}
${fussSpalte('Fokus Innovation', [['/abend/', 'Abend'], ['/ueber-uns/', 'Über uns'], ['/kontakt/', 'Kontakt']])}
${fussSpalte('Rechtliches', [['/impressum/', 'Impressum'], ['/datenschutz/', 'Datenschutz']])}
</div>
<div class="fuss-unten"><span>© 2026 ${e(anbieter.name)}</span><span>Alle Preise netto zuzüglich Umsatzsteuer. Unsere Angebote richten sich an Unternehmen.</span></div>
</div></footer>
<a class="check-knopf" href="${check('knopf')}">${ZEICHEN()}<span>Innovations-Check</span></a>`;

  const rahmen = ({ titel: titelText, beschreibung, aktiv = '', main, film = false, klasse = '' }) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titelText)}</title>
<meta name="description" content="${e(beschreibung)}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${film ? '#0B0C0F' : '#F6F4F0'}">
<link rel="icon" href="/assets/zeichen.svg" type="image/svg+xml">
<link rel="preload" href="/assets/schriften/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/fokus.css?v=${stempel('css/fokus.css')}">
${film ? `<link rel="stylesheet" href="/css/film.css?v=${stempel('css/film.css')}">\n` : ''}<script src="/js/frueh.js?v=${stempel('js/frueh.js')}"></script>
<script src="/js/seite.js?v=${stempel('js/seite.js')}" defer></script>
${film ? `<script type="module" src="/js/film.js?v=${stempel('js/film.js')}"></script>\n` : ''}</head>
<body${klasse ? ` class="${klasse}"` : ''}>
${kopf(aktiv)}
<main id="inhalt">
${main}
</main>
${fuss()}
</body>
</html>
`;

  /** Der dunkle Schlussakt: eine Frage, ein Satz, der Einstieg in drei Schritten, zwei Knöpfe. */
  const schlussakt = ({ quelle, h2 = start.abschluss.titel, lead = 'Der Innovations-Check zeigt dir in rund 10 Minuten, wo dein Unternehmen steht. Danach klären wir im kostenlosen 90-Tage-Umsetzungsgespräch, was als Nächstes kommt.', knoepfe }) => `<section class="schlussakt dunkel" aria-labelledby="schluss-titel"><div class="w">
<div class="schluss-kopf erscheint">${ZEICHEN('zeichen schluss-zeichen')}<p class="vorzeile">Der Einstieg</p><h2 id="schluss-titel">${e(h2)}</h2><p class="lead">${t(lead)}</p>
<div class="knoepfe">${knoepfe ?? `${checkKnopf(quelle)}${knopf(terminLink('Erstgespräch'), 'Lieber direkt sprechen', 'zweit')}`}</div></div>
${weg(F.einstieg, { klasse: 'einstieg', etiketten: ['01', '02', '03'], label: 'Der Einstieg in drei Schritten' })}
</div></section>`;

  const seiten = [];
  const neu = (pfad, s) => seiten.push({ pfad, html: rahmen(s) });
  const B = F.bereiche;

  // ── Startseite: der Film, dann ruhige Abschnitte auf Papier ──
  {
    const fl = F.film;
    const block = (name, b, extra = '') => `<div class="block" data-block="${name}" aria-hidden="true"><div class="film-text"><p class="film-titel">${b.titel.split("|").map((z) => `<span class="zeile" data-woerter>${e(z)}</span>`).join("")}</p><p class="film-satz">${e(b.satz)}</p></div>${extra}</div>`;
    const kurz = {
      sichtbarkeit: gruppenIn('sichtbarkeit').map((g) => [`/sichtbarkeit/#${anker(g.name || g.liste[0].name)}`, g.name === 'Homepage-Pakete' ? 'Homepage' : g.name || g.liste[0].name]),
      vertrieb: produkteIn('vertrieb').map((a) => [produktPfad(a), a.id === 'tagesworkshop' ? 'Tagesworkshop' : a.name.replace(/ \(CSO\)$/, '')]),
      innovation: [['/innovations-check/', 'Innovations-Check'], ...produkteIn('innovation').map((a) => [produktPfad(a), 'Umsetzungsprojekte'])],
    };
    const leistung = (k) => {
      const b = B[k];
      return `<article class="leistung" id="bereich-${k}">
<div class="leistung-kopf erscheint">${vorzeile(b.name, b.nr)}<h3 class="paar">${e(b.paar)}</h3><p class="satz">${t(b.satz)}</p>${textlink(`/${k}/`, `Mehr zu ${b.name}`)}</div>
<div class="leistung-weg"><p class="etikett erscheint">Woran es oft hakt</p><p class="problem erscheint">${t(b.problem)}</p>${weg(b.weg)}${b.beleg ? zahl(F.belege[b.beleg]) : ''}
<p class="angebote-kurz erscheint"><span class="etikett">Angebote</span>${kurz[k].map(([h, n]) => `<a href="${h}">${e(n)}</a>`).join('<span aria-hidden="true">·</span>')}</p></div>
</article>`;
    };
    neu('index.html', {
      titel: `Fokus Innovation · ${F.marke.claim}`,
      beschreibung: F.marke.beschreibung,
      film: true,
      klasse: 'start',
      main: `<section class="film" id="start" aria-label="${e(F.marke.claim)}">
<div class="buehne">
<canvas class="szene" aria-hidden="true"></canvas>
<div class="ersatz" aria-hidden="true">${ZEICHEN('zeichen gross')}</div>
<p class="sr">${[fl.laerm, fl.fokus, fl.luecke, fl.momentum, fl.durchbruch].map((b) => `${e(b.titel.replace(/\|/g, " "))} ${e(b.satz)}`).join(' ')}</p>
<div class="aufgaben" aria-hidden="true">${F.aufgaben.map((x) => `<span class="aufgabe">${e(x)}</span>`).join('')}</div>
${block('laerm', fl.laerm, '<span class="hinweis" aria-hidden="true">Scrollen<span class="hinweis-strich"></span></span>')}
${block('fokus', fl.fokus)}
${block('luecke', fl.luecke)}
${block('momentum', fl.momentum)}
${block('durchbruch', fl.durchbruch)}
<div class="block" data-block="ende" aria-hidden="true"><div class="ende-marke"><span class="ende-wort">FOKUS</span><span class="ende-unter">Innovation</span><span class="ende-claim">${e(F.marke.claim)}</span></div></div>
</div>
</section>

<section class="held start-held" aria-labelledby="start-titel"><div class="w held-raster">
<div class="start-titel erscheint">${vorzeile(`${F.marke.name} · Berlin`)}<h1 id="start-titel">${titel(F.start.titel, F.start.ruhig)}</h1></div>
<div class="erscheint"><p class="lead">${t(F.start.lead)}</p>
<div class="knoepfe">${checkKnopf('start_held')}${knopf('#was-wir-tun', 'Was wir tun', 'zweit')}</div></div>
<nav class="index erscheint" aria-label="Unsere Bereiche">${[...BEREICHE.map((k) => [`/${k}/`, B[k].nr, B[k].name, B[k].paar]), ['/abend/', '04', 'Abend', 'Menschen verbinden.']].map(([h, nr, n, s]) => `<a href="${h}"><span class="nr">${nr}</span><b>${e(n)}</b><span class="index-satz">${e(s)}</span>${PFEIL}</a>`).join('')}</nav>
</div></section>

<section class="abschnitt" id="warum-es-uns-gibt" aria-labelledby="leitidee-titel"><div class="w">
${abKopf({ marke: 'Warum es uns gibt', h2: F.leitidee.titel, lead: F.leitidee.lead, id: 'leitidee-titel' })}
<div class="zwei-teile">
<figure class="zitat erscheint"><blockquote><p>„${e(F.leitidee.zitat.text)}“</p></blockquote><figcaption><b>${e(F.leitidee.zitat.wer)}</b><cite><a href="${e(F.leitidee.zitat.link)}" rel="noopener" target="_blank">${e(F.leitidee.zitat.quelle)}</a></cite></figcaption></figure>
<div class="fliesstext erscheint">${F.leitidee.absaetze.map((p) => `<p>${t(p)}</p>`).join('')}${zahl(F.belege.mittelstand)}</div>
</div>
</div></section>

<section class="abschnitt" id="was-wir-tun" aria-labelledby="leistungen-titel"><div class="w">
${abKopf({ marke: 'Was wir tun', h2: 'Drei Bereiche.', ruhig: 'Und in jedem setzen wir selbst mit um.', lead: 'Sichtbarkeit, Vertrieb und Innovation tragen die Arbeit. Darüber liegt das Verbinden: unser Netzwerk und unsere Abende.', id: 'leistungen-titel' })}
${BEREICHE.map(leistung).join('\n')}
</div></section>

<section class="abschnitt" id="abend" aria-labelledby="abend-titel"><div class="w">
<div class="kasten abend-kasten">
<div class="erscheint">${vorzeile(F.abend.titel)}<h2 id="abend-titel">${titel('Ein Abend.|Ein langer Tisch.', 'Menschen, die Neues umsetzen.')}</h2>${tafel()}</div>
<div class="erscheint"><p class="lead">${t(F.abend.text)}</p><p class="leise">${t(F.abend.termine)}</p>
<div class="knoepfe">${knopf(mail(F.abend.betreff), 'Auf die Gästeliste')}${textlink('/abend/', 'Mehr zum Abend')}</div></div>
</div>
</div></section>

<section class="abschnitt" id="warum-wir" aria-labelledby="warum-titel"><div class="w">
${abKopf({ marke: 'Warum wir', h2: 'Wir arbeiten in deinem Team, nicht daneben.', lead: 'Vier Unterschiede, an denen du uns messen kannst. Jeder mit einem Beleg.', id: 'warum-titel' })}
<dl class="zahlen erscheint">${F.zahlen.map((z) => `<div><dt>${e(z.text)}</dt><dd>${e(z.wert)}</dd></div>`).join('')}</dl>
${raster(F.warum_wir.map((w) => ({ titel: w.titel, text: w.text, unter: w.beleg })), 4)}
</div></section>

<section class="abschnitt" id="fuer-wen" aria-labelledby="wen-titel"><div class="w">
${abKopf({ marke: 'Für wen', h2: 'Für Menschen, die umsetzen statt reden.', lead: 'Drei Gruppen, zwei Richtungen: Neues in den Markt bringen oder Neues ins Unternehmen bringen.', id: 'wen-titel' })}
${raster(F.fuer_wen.map((w) => ({ etikett: w.richtung, titel: w.titel, text: w.text, unter: `Einstieg: ${w.einstieg}`, nr: false })), 3)}
</div></section>

${schlussakt({ quelle: 'start_ende' })}`,
    });
  }

  // ── Bereichsseiten ──
  for (const k of BEREICHE) {
    const b = B[k];
    const gruppen = gruppenIn(k);
    const checkZeile = k === 'innovation' ? `<li><a href="/innovations-check/"><span class="z-name">Innovations-Check</span><span class="z-text">In rund 10 Minuten siehst du, wo dein Unternehmen steht.</span><span class="z-preis">kostenlos</span>${PFEIL}</a></li>` : '';
    const angeboteHtml = gruppen.map((g, gi) => `<div class="angebot-gruppe" id="${anker(g.name || g.liste[0].name)}">${g.name ? `<h3 class="gruppe-titel">${e(g.name)}</h3>` : ''}
<ul class="zeilen erscheint">${gi === 0 ? checkZeile : ''}${g.liste.map((a) => `<li><a href="${produktPfad(a)}"><span class="z-name">${e(a.name)}${bald(a) ? ' <span class="marke-bald">Bald</span>' : ''}</span><span class="z-text">${t(F.kurztexte[a.id] ?? produktBlatt(a)?.versprechen ?? a.fuer_wen ?? (a.enthalten ?? [])[0] ?? '')}</span><span class="z-preis">${e(preisKurz(a))}</span>${PFEIL}</a></li>`).join('')}</ul></div>`).join('\n');

    const vergleich = k === 'vertrieb' ? (() => {
      const hos = angebot('head-of-sales'), cso = angebot('cso');
      const zeilen = [...hos.enthalten.map((x) => [x, true, true]), ...cso.enthalten.filter((x) => !/^Alles aus/.test(x)).map((x) => [x, false, true])];
      const zelle = (ja, name) => (ja ? `<td class="ja" data-name="${name}"><span class="knoten" aria-hidden="true"></span><span class="sr">enthalten</span></td>` : `<td class="nein" data-name="${name}"><span aria-hidden="true">–</span><span class="sr">nicht enthalten</span></td>`);
      return `<section class="abschnitt" aria-labelledby="vergleich-titel"><div class="w">${abKopf({ marke: 'Vergleich', h2: 'Head of Sales oder CSO?', lead: inhalt.faq.find((f) => f.id === 'was-ist-der-unterschied-zwischen-head')?.a, id: 'vergleich-titel' })}
<div class="tabelle-huelle erscheint"><table class="vergleich haken-tabelle"><thead><tr><th scope="col">Leistung</th><th scope="col">Head of Sales<span class="zahl-klein">${e(preisKurz(hos))}</span></th><th scope="col">CSO<span class="zahl-klein">${e(preisKurz(cso))}</span></th></tr></thead>
<tbody>${zeilen.map(([x, a, c]) => `<tr><th scope="row">${t(x)}</th>${zelle(a, 'Head of Sales')}${zelle(c, 'CSO')}</tr>`).join('')}</tbody></table></div>
<div class="knoepfe">${textlink(produktPfad(hos), 'Head of Sales im Detail')}${textlink(produktPfad(cso), 'CSO im Detail')}</div></div></section>`;
    })() : (blaetter.vergleiche[k] ?? []).length ? `<section class="abschnitt" aria-labelledby="vergleich-titel"><div class="w">${abKopf({ marke: 'Vergleich', h2: 'Was in welchem Angebot steckt', id: 'vergleich-titel' })}
${blaetter.vergleiche[k].map((v) => {
      const liste = v.angebote.map(angebot).filter(Boolean);
      const kurzName = (a) => a.name.replace(/^Homepage /, '');
      return `<h3 class="gruppe-titel">${e(v.titel)}</h3><div class="tabelle-huelle erscheint"><table class="vergleich text"><thead><tr><th scope="col"><span class="sr">Merkmal</span></th>${liste.map((a) => `<th scope="col"><a href="${produktPfad(a)}">${e(kurzName(a))}</a><span class="zahl-klein">${e(preisKurz(a))}</span></th>`).join('')}</tr></thead>
<tbody>${v.zeilen.map(([m, ...w]) => `<tr><th scope="row">${e(m)}</th>${w.map((x, n) => `<td data-name="${e(liste[n] ? kurzName(liste[n]) : '')}">${t(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('\n')}${netto}</div></section>` : '';

    const eigenes = {
      sichtbarkeit: () => `<section class="abschnitt" aria-labelledby="zusatz-titel"><div class="w">${abKopf({ marke: 'Dazu', h2: 'Zusatzoptionen und Netzwerk', id: 'zusatz-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Dazu buchbar</h3><dl class="daten">${inhalt.zusatzoptionen.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.name === 'Express' ? 'halbe Lieferzeit' : z.leistung)}</span></dt><dd>${e(z.preis)}</dd></div>`).join('')}</dl></div>
<div class="erscheint"><h3 class="gruppe-titel">${e(b.auch.titel)}</h3><p>${t(b.auch.text)}</p><div class="knoepfe">${textlink('/abend/', 'Zum Abend')}</div></div></div></div></section>`,
      vertrieb: () => `<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Ablauf', h2: 'So kommen wir zusammen', lead: 'Vom ersten Check bis zum Mandat, jeder Schritt mit klarem Ergebnis.', id: 'ablauf-titel' })}
${weg(b.ablauf, { klasse: 'vier', etiketten: ['01', '02', '03', '04'], label: 'Ablauf bis zum Mandat' })}</div></section>`,
      innovation: () => `<section class="abschnitt" aria-labelledby="check-titel"><div class="w">${abKopf({ marke: 'Innovations-Check', h2: start['innovations-check'].titel, lead: F.check.text, id: 'check-titel' })}
<ol class="stufen breit erscheint" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><span class="stufe-balken" aria-hidden="true"></span><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></li>`).join('')}</ol>
<div class="zwei-teile check-unten"><div class="erscheint">${punkte(seite.check_punkte.punkte)}</div><div class="erscheint"><div class="knoepfe">${checkKnopf('innovation_check')}${textlink('/innovations-check/', 'So funktioniert der Check')}</div></div></div></div></section>

<section class="abschnitt" id="ki-brain" aria-labelledby="brain-titel"><div class="w">${abKopf({ marke: 'Mehr als KI', h2: 'Mehr als ein neues Werkzeug.', lead: b.mehr_als_ki, id: 'brain-titel' })}
<div class="zwei-teile">${zahl(F.belege.roboter)}${zahl(F.belege.daten)}</div>
<div class="kasten brain-kasten erscheint"><div>${vorzeile(b.brain.stand)}<h3>${e(b.brain.titel)}</h3></div><div><p>${t(b.brain.text)}</p><div class="knoepfe">${knopf(mail(b.brain.betreff), 'Interesse anmelden', 'zweit')}</div></div></div>
</div></section>`,
    }[k]();

    const knoepfe = k === 'vertrieb'
      ? `${checkKnopf(`${k}_held`)}${knopf(terminLink('Vertrieb'), 'Gespräch vereinbaren', 'zweit')}`
      : k === 'sichtbarkeit'
        ? `${knopf('#angebote', 'Angebote ansehen')}${checkKnopf(`${k}_held`, 'Innovations-Check starten', 'zweit')}`
        : `${checkKnopf(`${k}_held`)}${knopf(mail('Anfrage: Umsetzungsprojekt'), 'Projekt anfragen', 'zweit')}`;

    neu(`${k}/index.html`, {
      titel: `${b.name} · Fokus Innovation`,
      beschreibung: `${b.held.titel} ${b.held.text}`.slice(0, 300),
      aktiv: k,
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, b.name]])}${vorzeile(b.name, b.nr)}<h1 id="held-titel">${e(b.held.titel)}</h1><p class="lead">${t(b.held.text)}</p><div class="knoepfe">${knoepfe}</div></div>
<aside class="weg-karte erscheint" aria-label="Der Weg"><p class="etikett">Der Weg mit uns</p>${weg(b.weg, { klasse: 'senkrecht' })}</aside>
</div></section>

<section class="abschnitt" aria-labelledby="weg-titel"><div class="w">${abKopf({ marke: 'Unser Weg mit dir', h2: b.paar, id: 'weg-titel' })}
${raster(b.schritte, 4)}
${b.beleg ? `<div class="beleg-zeile">${zahl(F.belege[b.beleg])}</div>` : ''}
</div></section>

<section class="abschnitt" id="angebote" aria-labelledby="angebote-titel"><div class="w">${abKopf({ marke: 'Angebote', h2: `${b.name}: was wir für dich tun`, lead: F.angebote_lead[k], id: 'angebote-titel' })}
${angeboteHtml}
${netto}</div></section>

${vergleich}
${eigenes}
${fragen(zuschneiden(faqVon(seite.bereiche[k].faq), k))}
${schlussakt({ quelle: `${k}_ende`, knoepfe: k === 'sichtbarkeit' ? `${knopf(terminLink('Sichtbarkeit'), 'Paket besprechen')}${checkKnopf(`${k}_ende`, 'Innovations-Check starten', 'zweit')}` : undefined })}`,
    });
  }

  // ── Produktseiten ──
  for (const a of inhalt.angebote) {
    const k = a.bereich.toLowerCase();
    const b = B[k];
    const pb = produktBlatt(a);
    const istBald = bald(a);
    const terminKnopf = istBald ? knopf(mail(`Warteliste: ${a.name}`), 'Auf die Warteliste') : knopf(terminLink(a.name), seite.termin.link ? 'Termin buchen' : 'Gespräch anfragen');
    const homepage = a.gruppe === 'Homepage-Pakete';
    const groesstes = homepage && produkteIn(k).filter((x) => x.gruppe === a.gruppe).at(-1)?.id === a.id;
    const zusatz = homepage ? inhalt.zusatzoptionen.filter((z) => /Homepage/.test(z.fuer) && !(groesstes && z.name === 'Upgrade')) : [];
    const zusatzPreis = (z) => { for (const m of String(z.preis).matchAll(/([+\d.,]+ €) bei ([^,]+)/g)) if (m[2].split(/ und /).some((n) => a.name.endsWith(n.trim()))) return m[1]; return z.preis; };
    const geschwister = a.gruppe ? produkteIn(k).filter((x) => x.gruppe === a.gruppe && x.id !== a.id) : [];
    const weitere = geschwister.length ? geschwister : produkteIn(k).filter((x) => x.id !== a.id);
    const nichtEnthalten = pb?.nicht_enthalten ?? a.nicht_enthalten;
    const fragenListe = zuschneiden(pb ? [...pb.fragen.filter((f) => !/Kundenstimmen-Videos/.test(f.frage)).map((f) => ({ f: f.frage, a: f.antwort })), ...faqVon(['sind-die-preise-netto'])] : faqVon(seite.produkt_faq[a.id] ?? []), k);
    const regeln = [...(a.regeln ?? []), inhalt.konditionen[0]];
    const datenTabelle = (zeilen) => `<dl class="daten">${zeilen.map(([x, v]) => `<div><dt>${e(x)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl>`;
    const zeitplan = (ab) => `<ol class="zeitplan">${ab.zeilen.map((z) => `<li><span class="wann">${e(z[0])}</span><div><b>${e(z[1])}</b>${z[2] ? `<span>${t(z[2])}</span>` : ''}</div></li>`).join('')}</ol>${ab.hinweis ? `<p class="leise klein-text">${t(ab.hinweis)}</p>` : ''}`;

    const blattHtml = pb ? `<section class="abschnitt" aria-labelledby="lage-titel"><div class="w">${abKopf({ marke: 'Ausgangslage', h2: 'Woran es heute hakt', lead: pb.problem, id: 'lage-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Für wen</h3>${punkte(pb.fuer)}</div><div class="erscheint"><h3 class="gruppe-titel">Nicht für</h3><p>${t(pb.nicht_fuer)}</p></div></div></div></section>

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Ablauf', h2: 'So läuft es', id: 'ablauf-titel' })}
<div class="zwei-teile"><div class="erscheint">${zeitplan(pb.ablauf)}</div>
${pb.ergebnis ? `<div class="kasten ergebnis-kasten erscheint"><p class="vorzeile">Ergebnis</p><h3>Woran du den Erfolg siehst</h3>${punkte(pb.ergebnis)}${pb.ergebnis_hinweis ? `<p class="leise klein-text">${t(pb.ergebnis_hinweis)}</p>` : ''}</div>` : ''}</div></div></section>

<section class="abschnitt" aria-labelledby="leistung-titel"><div class="w">
${pb.bausteine ? `${abKopf({ marke: 'Leistung', h2: 'Was du bekommst', lead: pb.loesung, id: 'leistung-titel' })}<div class="bausteine erscheint">${pb.bausteine.map((x) => `<div class="baustein"><h3>${e(x.name)}</h3>${x.hinweis ? `<span class="etikett">${e(x.hinweis)}</span>` : ''}<p>${t(x.text)}</p></div>`).join('')}</div>${pb.bausteine_satz ? `<p class="satz-unter">${t(pb.bausteine_satz)}</p>` : ''}${a.id === 'cso' ? `<p class="satz-unter">${textlink(produktPfad(angebot('head-of-sales')), 'Was im Head of Sales steckt')}</p>` : ''}`
    : `${abKopf({ marke: 'Leistung', h2: 'Was du bekommst', id: 'leistung-titel' })}<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Das Paket</h3>${datenTabelle(pb.eckdaten)}</div><div class="erscheint"><h3 class="gruppe-titel">Immer enthalten</h3>${punkte(pb.immer)}</div></div>`}
</div></section>
${pb.katalog ? `<section class="abschnitt" aria-labelledby="katalog-titel"><div class="w">${abKopf({ marke: 'Videokatalog', h2: 'Du wählst aus festen Formaten', lead: String(pb.katalog_hinweis ?? '').replace(/„Später“[^.]*\.\s*/g, '').trim() || null, id: 'katalog-titel' })}<div class="katalog n${pb.katalog.length} erscheint">${pb.katalog.map((g) => `<div><h3 class="gruppe-titel">${e(g.titel)}</h3><ul class="formate">${g.formate.filter((f) => !/\(später\)$/.test(f)).map((f) => `<li>${e(f)}</li>`).join('')}</ul></div>`).join('')}</div></div></section>` : ''}

<section class="abschnitt" aria-labelledby="konditionen-titel"><div class="w">${abKopf({ marke: 'Konditionen', h2: 'Preis und Konditionen', id: 'konditionen-titel' })}
<div class="zwei-teile"><div class="erscheint">${datenTabelle(pb.konditionen)}${netto}</div>
<div class="erscheint"><h3 class="gruppe-titel">Was wir von dir brauchen</h3>${punkte(pb.mitwirkung)}${nichtEnthalten ? `<h3 class="gruppe-titel">Nicht enthalten</h3>${punkte(nichtEnthalten, 'punkte nicht')}` : ''}${pb.abgrenzung ? `<h3 class="gruppe-titel">Abgrenzung</h3><p class="leise">${t(pb.abgrenzung)}</p>` : ''}</div></div></div></section>`
      : `<section class="abschnitt" aria-labelledby="inhalt-titel"><div class="w">${abKopf({ marke: 'Leistung', h2: 'Was drin ist', lead: a.fuer_wen, id: 'inhalt-titel' })}
${a.stufen ? `<div class="raster n3 erscheint">${a.stufen.map((s) => `<div class="spalte"><span class="etikett">Workshop: ${e(s.workshop)}</span><h3>Positionierung ${e(s.name)}</h3><p class="stufe-preis">${e(s.preis)}</p><p>${t(s.ergebnis)}</p></div>`).join('')}</div>${netto}` : ''}
<div class="zwei-teile">${a.enthalten ? `<div class="erscheint"><h3 class="gruppe-titel">Enthalten</h3>${punkte(a.enthalten)}</div>` : ''}
<div class="erscheint">${nichtEnthalten ? `<h3 class="gruppe-titel">Nicht enthalten</h3>${punkte(nichtEnthalten, 'punkte nicht')}` : ''}<h3 class="gruppe-titel">Gut zu wissen</h3>${punkte(regeln)}</div></div>
</div></section>`;

    neu(`${k}/${a.id}/index.html`, {
      titel: `${a.name} · Fokus Innovation`,
      beschreibung: `${a.name}: ${alt(F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? (a.enthalten ?? []).join(', '))} Preis: ${a.preis}${/^pro Monat/.test(a.preis_zusatz ?? '') ? ' im Monat' : ''}.`.replace(/\s+/g, ' ').slice(0, 300),
      aktiv: k,
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[`/${k}/`, b.name], [null, a.name]])}${vorzeile(`${b.name}${a.gruppe ? ` · ${a.gruppe}` : ''}${istBald ? ' · Bald' : ''}`)}<h1 id="held-titel">${e(a.name)}</h1><p class="lead">${t(F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? b.satz)}</p></div>
<aside class="preis-kasten erscheint" aria-label="Preis"><p class="etikett">Preis</p><p class="betrag">${e(a.preis)}</p><p class="zusatz">${e(a.preis_zusatz ?? '')}${a.preis_zusatz ? ' · ' : ''}netto zuzüglich Umsatzsteuer</p><div class="knoepfe senkrecht">${terminKnopf}${checkKnopf(`produkt_${a.id}`, 'Erst den Check machen', 'zweit')}</div></aside>
</div></section>
${blattHtml}
${zusatz.length ? `<section class="abschnitt" aria-labelledby="zusatz-titel"><div class="w">${abKopf({ marke: 'Zusatzoptionen', h2: 'Dazu buchbar', id: 'zusatz-titel' })}<dl class="daten erscheint">${zusatz.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.name === 'Express' && a.id !== 'homepage-landing' ? 'halbe Lieferzeit' : z.leistung)}</span></dt><dd>${e(zusatzPreis(z))}</dd></div>`).join('')}</dl></div></section>` : ''}
${fragen(fragenListe)}
${weitere.length ? `<section class="abschnitt" aria-labelledby="weitere-titel"><div class="w">${abKopf({ marke: geschwister.length ? a.gruppe : b.name, h2: geschwister.length ? `Die anderen ${a.gruppe}` : `Weitere Angebote im Bereich ${b.name}`, id: 'weitere-titel' })}
<ul class="zeilen erscheint">${weitere.map((x) => `<li><a href="${produktPfad(x)}"><span class="z-name">${e(x.name)}</span><span class="z-text">${t(F.kurztexte[x.id] ?? produktBlatt(x)?.versprechen ?? x.fuer_wen ?? (x.enthalten ?? [])[0] ?? '')}</span><span class="z-preis">${e(preisKurz(x))}</span>${PFEIL}</a></li>`).join('')}</ul></div></section>` : ''}
${schlussakt({ quelle: `produkt_${a.id}_ende`, h2: 'Bereit für den nächsten Schritt?', lead: pb?.naechster ?? (istBald ? 'Trag dich auf die Warteliste ein. Oder starte mit dem Innovations-Check, er zeigt in 10 Minuten, wo du stehst.' : 'Sprich mit uns über deinen Start. Oder mach zuerst den Innovations-Check, er zeigt in 10 Minuten, wo du stehst.'), knoepfe: `${terminKnopf}${checkKnopf(`produkt_${a.id}_ende`, 'Innovations-Check starten', 'zweit')}` })}`,
    });
  }

  // ── Innovations-Check (die Seite davor; der Check selbst läuft in der eigenen Anwendung unter /check) ──
  {
    const c = start['innovations-check'];
    const a1 = katalog.abschnitte.flatMap((x) => x.fragen).find((f) => f.id === 'A1');
    neu('innovations-check/index.html', {
      titel: 'Innovations-Check · Fokus Innovation',
      beschreibung: F.check.text,
      aktiv: 'innovation',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([['/innovation/', 'Innovation'], [null, 'Innovations-Check']])}${vorzeile('Kostenlos · rund 10 Minuten · Ergebnis sofort')}<h1 id="held-titel">${e(c.titel)}</h1><p class="lead">${t(F.check.text)}</p><div class="knoepfe">${checkKnopf('check_seite_held')}</div></div>
<figure class="frage-karte erscheint" aria-label="Beispiel: die erste Frage des Checks"><figcaption><span class="etikett">So sieht eine Frage aus</span><span class="leise">Frage 1 von 15</span></figcaption><p class="frage">${e(a1.text)}</p><ul class="optionen" aria-hidden="true">${a1.optionen.slice(0, 4).map((o) => `<li>${e(o.text)}</li>`).join('')}</ul><p class="leise klein-text">Zoe, unsere KI-Assistentin, führt durch die Fragen. Sie stellt sie mit festen Texten.</p></figure>
</div></section>

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'So läuft es', h2: 'In drei Schritten zu deinen Top 3', id: 'ablauf-titel' })}
${weg(F.einstieg, { etiketten: ['01', '02', '03'], label: 'Der Check in drei Schritten' })}</div></section>

<section class="abschnitt" aria-labelledby="stufen-titel"><div class="w">${abKopf({ marke: 'Fünf Stufen', h2: 'Wo steht dein Unternehmen?', lead: 'Der Check misst Strategie, KI im Alltag, Automatisierung, Daten und Team und vergleicht dich mit deiner Branche.', id: 'stufen-titel' })}
<ol class="stufen breit erscheint" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><span class="stufe-balken" aria-hidden="true"></span><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></li>`).join('')}</ol></div></section>

<section class="abschnitt" aria-labelledby="gespraech-titel"><div class="w">${abKopf({ marke: 'Nach dem Check', h2: start.gespraech.titel, lead: start.gespraech.text, id: 'gespraech-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Was du bekommst</h3>${punkte(seite.check_punkte.punkte)}</div>
<div class="erscheint"><h3 class="gruppe-titel">Deine Daten</h3>${punkte(['Deine Antworten liegen auf unserem eigenen Server in Deutschland.', 'Zoe stellt die Fragen mit festen Texten. Deine Antworten gehen an kein KI-Modell.', 'Kontaktdaten gibst du nur, wenn du deinen Bericht oder ein Gespräch willst.', 'Ohne Kontaktdaten löschen wir die Antworten nach 30 Tagen.'])}<p class="leise klein-text">${t(start.gespraech.regel)}</p></div></div></div></section>

${fragen(faqVon(seite.check_faq))}
${schlussakt({ quelle: 'check_seite_ende', h2: 'Bereit?', lead: 'In rund 10 Minuten weißt du, wo du stehst.' })}`,
    });
  }

  // ── Abend ──
  neu('abend/index.html', {
    titel: 'Abend · Fokus Innovation',
    beschreibung: `${F.abend.satz} ${F.abend.text}`,
    aktiv: 'abend',
    main: `<section class="held sand" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, 'Abend']])}${vorzeile(F.abend.titel)}<h1 id="held-titel">${titel('Ein Abend.|Ein langer Tisch.', 'Menschen, die Neues umsetzen.')}</h1><p class="lead">${t(F.abend.text)}</p>
<div class="knoepfe">${knopf(mail(F.abend.betreff), 'Auf die Gästeliste')}</div><p class="leise klein-text">${e(F.abend.kosten)} · Termine folgen</p></div>
<div class="tafel-raum">${tafel()}</div>
</div></section>

<section class="abschnitt" aria-labelledby="art-titel"><div class="w">${abKopf({ marke: 'So ist der Abend', h2: 'Kuratiert, klein, verbindend.', id: 'art-titel' })}
${raster(F.abend.merkmale, 3)}</div></section>

<section class="abschnitt" aria-labelledby="gast-titel"><div class="w">${abKopf({ marke: 'Gastgeberin', h2: 'Malin bringt Menschen zusammen.', lead: F.team.find((p) => p.kuerzel === 'MA').text, id: 'gast-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Warum wir Abende machen</h3><p>${t(F.abend.warum)}</p></div>
<div class="erscheint"><h3 class="gruppe-titel">Termine</h3><p>${t(F.abend.termine)}</p><div class="knoepfe">${knopf(mail(F.abend.betreff), 'Auf die Gästeliste', 'zweit')}</div></div></div></div></section>

${schlussakt({ quelle: 'abend_ende' })}`,
  });

  // ── Über uns ──
  neu('ueber-uns/index.html', {
    titel: 'Über uns · Fokus Innovation',
    beschreibung: `${F.leitidee.titel} ${F.leitidee.lead}`.slice(0, 300),
    aktiv: 'ueber-uns',
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Über uns']])}${vorzeile('Über uns')}<h1 id="held-titel">${e(F.leitidee.titel)}</h1><p class="lead">${t(F.leitidee.lead)}</p></div>
</div></section>

<section class="abschnitt" aria-labelledby="ursprung-titel"><div class="w">${abKopf({ marke: 'Warum es uns gibt', h2: 'Vier Erfahrungen.', ruhig: 'Ein Entschluss.', lead: F.leitidee.absaetze.join(' '), id: 'ursprung-titel' })}
${raster(F.leitidee.ursprung, 4)}</div></section>

<section class="abschnitt" aria-labelledby="team-titel"><div class="w">${abKopf({ marke: 'Team', h2: 'Zwei Menschen, ein Team.', lead: 'Kevin für Vertrieb und Umsetzung, Malin für Bühne und Netzwerk.', id: 'team-titel' })}
<div class="team erscheint">${F.team.map((p) => `<article class="person"><span class="kuerzel" aria-hidden="true">${e(p.kuerzel)}</span><div><p class="etikett">${e(p.rolle)}</p><h3>${e(p.name)}</h3><p>${t(p.text)}</p></div></article>`).join('')}</div></div></section>

<section class="abschnitt" aria-labelledby="werte-titel"><div class="w">${abKopf({ marke: 'Werte', h2: 'Woran man uns erkennt.', lead: 'Drei Werte, an denen du uns messen kannst.', id: 'werte-titel' })}
${raster(F.werte, 3)}
<div class="zwei-teile werte-unten erscheint"><div><h3 class="gruppe-titel">So arbeiten wir</h3><dl class="daten">${F.arbeitsweise.map((x) => `<div><dt>${e(x.titel)}</dt><dd>${t(x.text)}</dd></div>`).join('')}</dl></div>
<div><h3 class="gruppe-titel">Grundregel</h3><p class="grundregel">${t(F.grundregel)}</p></div></div></div></section>

<section class="abschnitt" aria-labelledby="nicht-titel"><div class="w">${abKopf({ marke: 'Abgrenzung', h2: 'Was wir nicht sind.', id: 'nicht-titel' })}
${raster(F.nicht.map((x) => ({ ...x, nr: false })), 4)}</div></section>

<section class="abschnitt" aria-labelledby="belege-titel"><div class="w">${abKopf({ marke: 'Aus unserer Laufbahn', h2: 'Was wir vorher aufgebaut haben.', id: 'belege-titel' })}
<dl class="zahlen erscheint">${F.zahlen.map((z) => `<div><dt>${e(z.text)}</dt><dd>${e(z.wert)}</dd></div>`).join('')}</dl>
<p class="satz-unter erscheint">Dazu bauen wir unsere eigene Software und nutzen sie jeden Tag in unserer Arbeit.</p></div></section>

${schlussakt({ quelle: 'ueber_uns_ende' })}`,
  });

  // ── Kontakt ──
  {
    const k = seite.kontakt;
    neu('kontakt/index.html', {
      titel: 'Kontakt · Fokus Innovation',
      beschreibung: 'So erreichst du Fokus Innovation: E-Mail, Adresse und Termin.',
      aktiv: 'kontakt',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Kontakt']])}${vorzeile('Kontakt')}<h1 id="held-titel">Sprich mit uns.</h1><p class="lead">Schreib uns kurz, worum es geht. Oder du startest mit dem Innovations-Check und buchst danach dein 90-Tage-Gespräch.</p>
<div class="knoepfe">${knopf(terminLink('Erstgespräch'), 'Gespräch anfragen')}${checkKnopf('kontakt', 'Innovations-Check starten', 'zweit')}</div></div>
</div></section>
<section class="abschnitt" aria-label="Kontaktdaten"><div class="w"><div class="kontakt-liste erscheint">
<div><p class="etikett">E-Mail</p><a class="gross-link" href="mailto:${e(k.mail)}">${e(k.mail)}</a></div>
<div><p class="etikett">Adresse</p><address>${e(anbieter.name)}<br>${k.adresse.map(t).join('<br>')}</address></div>
<div><p class="etikett">Abend</p><p>Für die Gästeliste genügt eine kurze Mail.</p>${textlink(mail(F.abend.betreff), 'Auf die Gästeliste')}</div>
</div></div></section>`,
    });
  }

  // ── Rechtliches (Sie-Form; Hinweis, keine Rechtsberatung — vor dem Start anwaltlich prüfen) ──
  const vp = seite.vertragspartner;
  const anschrift = `<address>${e(anbieter.name)}<br>${anbieter.adresse.map(t).join('<br>')}</address>`;
  const recht = (titelText, inhaltHtml) => `<section class="held klein" aria-labelledby="held-titel"><div class="w">${brotkrumen([[null, titelText]])}${vorzeile('Rechtliches')}<h1 id="held-titel">${e(titelText)}</h1></div></section>
<section class="abschnitt"><div class="w"><div class="recht">${inhaltHtml}<p class="leise">Stand: Oktober 2026</p></div></div></section>`;
  neu('impressum/index.html', {
    titel: 'Impressum · Fokus Innovation',
    beschreibung: 'Impressum von Fokus Innovation.',
    main: recht('Impressum', `<h2>Angaben gemäß § 5 DDG</h2>${anschrift}
<h2>Vertreten durch</h2><p>${t(anbieter.vertreten)}</p>
<h2>Kontakt</h2><p>E-Mail: <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a></p>
<h2>Registereintrag</h2><p>${t(anbieter.register)}</p>
${anbieter.ustid ? `<h2>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG</h2><p>${t(anbieter.ustid)}</p>` : ''}
${vp?.name ? `<h2>Vertragspartner für unsere Leistungen</h2><p>Verträge über die angebotenen Leistungen schließt derzeit:</p><address>${e(vp.name)}<br>${vp.adresse.map(t).join('<br>')}</address>${vp.ustid ? `<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${t(vp.ustid)}</p>` : ''}` : ''}
<h2>Verantwortlich nach § 18 Abs. 2 MStV</h2><p>${t(anbieter.vertreten)}, Anschrift wie oben</p>
<h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Unsere Angebote richten sich an Unternehmen.</p>`),
  });
  neu('datenschutz/index.html', {
    titel: 'Datenschutz · Fokus Innovation',
    beschreibung: 'Datenschutzhinweis von Fokus Innovation.',
    main: recht('Datenschutz', `<h2>Kurz gesagt</h2><p>Diese Website setzt keine Cookies und nutzt kein Tracking, keine Analyse und keine Werbung. Sie lädt nur Dateien von unserem eigenen Server: Schriften, Bilder, Stile und kleine Skripte liegen hier, nichts kommt von fremden Diensten. Persönliche Daten verarbeiten wir nur, wenn es technisch nötig ist, um die Seite auszuliefern, wenn Sie den Innovations-Check nutzen oder uns schreiben.</p>
<h2>Verantwortlich</h2>${anschrift}<p>vertreten durch ${t(anbieter.vertreten)}. Für alle Fragen zum Datenschutz: <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p>
<h2>Hosting</h2><p>Die Website liegt auf einem Server der Hetzner Online GmbH (Industriestr. 25, 91710 Gunzenhausen) in einem Rechenzentrum in Deutschland. Hetzner verarbeitet die Daten nur in unserem Auftrag (Art. 28 DSGVO).</p>
<h2>Aufruf der Seite</h2><p>Wenn Sie die Seite öffnen, schickt Ihr Browser technisch bedingt Ihre IP-Adresse, den Zeitpunkt, die aufgerufene Adresse und eine Browser-Kennung an unseren Server. Wir brauchen diese Angaben, um die Seite verschlüsselt (HTTPS) auszuliefern und den Server sicher zu betreiben. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, funktionierenden Angebot (Art. 6 Abs. 1 lit. f DSGVO). Unser Webserver führt kein Zugriffsprotokoll. Technische Fehlermeldungen können eine IP-Adresse enthalten; sie bleiben auf dem Server, werden nicht ausgewertet und rollierend überschrieben.</p>
<h2>Cookies und Speicher im Browser</h2><p>Die Website selbst setzt keine Cookies und legt nichts im Speicher Ihres Browsers ab. Kleine Skripte zeigen Abschnitte beim Scrollen an, spielen auf der Startseite eine Animation ab und schließen auf dem Handy das Menü; sie lesen nichts aus, speichern nichts und senden nichts.</p>
<h2>Links zu Quellen</h2><p>Bei Zahlen nennen wir die Quelle und verlinken sie. Erst wenn Sie einen solchen Link anklicken, öffnet Ihr Browser die Seite des jeweiligen Anbieters; dafür gilt dessen Datenschutzhinweis.</p>
<h2>Innovations-Check</h2><p>Der Innovations-Check läuft unter ${e(F.domain)}/check in unserer eigenen Anwendung auf demselben Server. Zoe ist eine KI-Assistentin; im Check stellt sie die Fragen mit festen Texten, Ihre Antworten gehen an kein KI-Modell. Wir speichern Ihre Antworten, um Ihr Ergebnis zu berechnen, und nur wenn Sie Kontaktdaten angeben, um Ihnen Ihren Bericht zu senden und ein Gespräch anzubieten (Art. 6 Abs. 1 lit. b DSGVO, vorvertragliche Maßnahmen). Damit Sie später weitermachen können, legt der Check im Speicher Ihres Browsers eine zufällige Kennung ab; sie enthält keine Antworten. Ohne Kontaktdaten löschen wir Ihre Antworten nach 30 Tagen, mit Kontaktdaten spätestens 24 Monate nach dem letzten Kontakt. Vor dem Start sehen Sie dort einen eigenen Datenschutzhinweis.</p>
<h2>Kontakt per E-Mail</h2><p>Schreiben Sie uns an ${e(seite.kontakt.mail)}, verarbeiten wir Ihre Adresse und den Inhalt Ihrer Nachricht, um zu antworten: bei Anfragen zu einem möglichen Vertrag nach Art. 6 Abs. 1 lit. b DSGVO, sonst nach Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die Nachricht, wenn sie erledigt ist, es sei denn, gesetzliche Aufbewahrungspflichten verlangen mehr. Die Postfächer betreibt Google Workspace (Gmail), ein Dienst der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, auf Grundlage eines Auftragsverarbeitungsvertrags. Werden dabei Daten in Länder außerhalb der EU übermittelt, etwa in die USA, ist das über das EU-US Data Privacy Framework beziehungsweise über Standardvertragsklauseln abgesichert.</p>
<h2>Weitergabe</h2><p>Wir verkaufen keine Daten und geben sie nicht an Dritte weiter, außer an die oben genannten Dienstleister, die in unserem Auftrag arbeiten. Es gibt keine automatisierten Entscheidungen.</p>
<h2>Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Verarbeiten wir Daten auf Grundlage berechtigter Interessen, können Sie jederzeit widersprechen (Art. 21). Eine Mail an ${e(seite.kontakt.mail)} genügt. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).</p>`),
  });
  neu('404.html', {
    titel: 'Seite nicht gefunden · Fokus Innovation',
    beschreibung: 'Diese Seite gibt es nicht.',
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig"><div>${vorzeile('404')}<h1 id="held-titel">Diese Seite gibt es nicht.</h1><p class="lead">Vielleicht hilft der Weg zurück zur Startseite.</p><div class="knoepfe">${knopf('/', 'Zur Startseite')}</div></div></div></section>`,
  });
  // Vorschau (Kevin 26.10.): Suchmaschinen sollen die Seite noch nicht aufnehmen. Zum Freischalten: noindex in rahmen() und hier öffnen.
  seiten.push({ pfad: 'robots.txt', html: 'User-agent: *\nDisallow: /\n' });
  return seiten;
}

// ── Prüfen: Regeln der Seite ─────────────────────────────────────────────────────────────────────────────────────────
const SPERRWOERTER = [
  [/\bMAKE\b/, 'alter Markenname „MAKE“'], [/KEMARIS/, 'KEMARIS'], [/Make\.One/i, 'Make.One'], [/\bConnect\b/i, 'Connect (nicht erwähnen)'],
  [/MAKE OS|Make OS/i, 'Name der eigenen Software'], [/\b(führend|revolutionär|disruptiv|einzigartig|Gamechanger)\b/i, 'Superlativ'],
  [/Made in Germany|Deutschland first/i, 'Nationalstolz-Vokabular'], [/Investor(en)?-?(zugang|zugänge|kontakte)/i, 'Investoren nur im Gespräch'],
];
export function pruefen(seiten) {
  const fehler = [];
  const pfade = new Set(seiten.map((s) => s.pfad));
  const ids = new Map(seiten.map((s) => [s.pfad, new Set([...s.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
  const ziel = (href) => (href === '/' ? 'index.html' : `${href.replace(/^\//, '')}${href.endsWith('/') ? 'index.html' : ''}`);
  let platzhalter = 0;
  for (const s of seiten) {
    const sichtbar = s.html.replace(/<[^>]+>/g, ' ');
    for (const [re, was] of SPERRWOERTER) if (re.test(sichtbar)) fehler.push(`${s.pfad}: ${was}`);
    if (/makeinnovation/i.test(sichtbar.replace(/kevin@makeinnovation\.de/g, ''))) fehler.push(`${s.pfad}: alte Domain im Text`);
    if (/\sstyle="/.test(s.html)) fehler.push(`${s.pfad}: Inline-Stil`);
    if (/<script(?![^>]*\ssrc=)[^>]*>/.test(s.html)) fehler.push(`${s.pfad}: Inline-Skript`);
    if (/\son[a-z]+="/.test(s.html)) fehler.push(`${s.pfad}: Ereignis-Attribut`);
    if (/<(script|img|link|iframe|source|video)\b[^>]*\s(src|href)="https?:/.test(s.html)) fehler.push(`${s.pfad}: fremde Quelle`);
    if (/<form\b/.test(s.html)) fehler.push(`${s.pfad}: Formular`);
    if (/\bZoe\b/.test(sichtbar) && !/KI-Assistentin/.test(sichtbar)) fehler.push(`${s.pfad}: Zoe ohne Kennzeichnung als KI-Assistentin`);
    platzhalter += (s.html.match(/class="ph"/g) ?? []).length;
    for (const [, href] of s.html.matchAll(/\shref="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith('/check') || href.startsWith('/css/') || href.startsWith('/assets/')) continue;
      const [teil, hash] = href.split('#');
      const seite = teil ? ziel(teil.split('?')[0]) : s.pfad;
      if (!pfade.has(seite)) { fehler.push(`${s.pfad}: Link ins Leere ${href}`); continue; }
      if (hash && !ids.get(seite).has(hash)) fehler.push(`${s.pfad}: Anker fehlt ${href}`);
    }
  }
  for (const datei of ['css/fokus.css', 'css/film.css', 'js/frueh.js', 'js/seite.js', 'js/film.js', 'js/szene.js', 'assets/zeichen.svg', 'assets/schriften/schibsted-grotesk-latin.woff2']) if (!existsSync(join(ORDNER, datei))) fehler.push(`fehlt: ${datei}`);
  return { fehler, platzhalter };
}

// ── Schreiben oder prüfen ────────────────────────────────────────────────────────────────────────────────────────────
function lauf() {
  const nurPruefen = process.argv.includes('--pruefen');
  const seiten = seitenBauen();
  let abweichend = 0;
  for (const s of seiten) {
    const zielDatei = join(ORDNER, s.pfad);
    const vorher = existsSync(zielDatei) ? readFileSync(zielDatei, 'utf8') : null;
    if (vorher === s.html) continue;
    abweichend++;
    if (nurPruefen) { console.log(`weicht ab: ${s.pfad}`); continue; }
    mkdirSync(dirname(zielDatei), { recursive: true });
    writeFileSync(zielDatei, s.html);
  }
  const { fehler, platzhalter } = pruefen(seiten);
  console.log(nurPruefen ? `${seiten.length} Seiten, ${abweichend} weichen ab` : `${seiten.length} Seiten, ${abweichend} neu geschrieben`);
  console.log(`Platzhalter für Kevin: ${platzhalter}`);
  for (const f of fehler) console.log(`REGEL: ${f}`);
  if (fehler.length || (nurPruefen && abweichend)) process.exit(1);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) lauf();
