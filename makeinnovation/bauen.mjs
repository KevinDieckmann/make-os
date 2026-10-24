#!/usr/bin/env node
// ─── makeinnovation.de · Seitengenerator (24.10.2026, Markenhandbuch 4.0) ──────────────────────────────────────────────
// Alle Seiten entstehen aus EINER Quelle: inhalt/inhalt.json (Kevins homepage-content.json ohne interne Teile) und
// inhalt/seite.json (Kontakt, Anbieter, Termin-Link, Team, Fallbeispiele, Fragen je Seite). Nie eine Seite von Hand ändern —
// Text in den JSON-Dateien, Aussehen in css/, dann:
//   node makeinnovation/bauen.mjs            → schreibt alle Seiten (und die Stempel ?v=… für css/ und js/)
//   node makeinnovation/bauen.mjs --pruefen  → Ausgang 1, wenn eine Seite nicht zur Quelle passt
// Danach node makeinnovation/pruefen.mjs (Regeln der Seite). Statisch: keine Cookies, kein Tracking, keine Formulare, keine
// fremden Quellen, keine Inline-Skripte oder -Stile (CSP script-src/style-src 'self'). Der Innovations-Check und die
// Buchungsseite laufen in MAKE OS (/check, /buchen/…); Caddy leitet nur diese Pfade an die App (LIESMICH.md).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORDNER = dirname(fileURLToPath(import.meta.url));
const lies = (p) => JSON.parse(readFileSync(join(ORDNER, p), 'utf8'));

// ── Hilfen ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** HTML-sicher. */
export const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Text mit Platzhaltern: [[KEVIN: …]] wird gelb markiert (blockiert die Freigabe, pruefen.mjs). */
export const t = (s) => e(s).replace(/\[\[KEVIN: ([^\]]*)\]\]/g, (_, x) => `<span class="ph">[[KEVIN: ${x}]]</span>`);
const istPlatzhalter = (s) => /\[\[KEVIN:/.test(String(s ?? ''));
export const PFEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h12M12 6l6 6-6 6"/></svg>';
const HAKEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const haken = (liste) => `<ul class="haken">${liste.map((x) => `<li>${HAKEN}<span>${t(x)}</span></li>`).join('')}</ul>`;
const stempel = (datei) => createHash('sha256').update(readFileSync(join(ORDNER, datei))).digest('hex').slice(0, 10);

/** Fester Ablauf der Bereiche (Reihenfolge der Seite). */
export const BEREICHE = ['vertrieb', 'sichtbarkeit', 'innovation'];
const bereichKey = (name) => String(name).toLowerCase();

export function quellen() {
  const inhalt = lies('inhalt/inhalt.json');
  const seite = lies('inhalt/seite.json');
  // Die fünf Stufen kommen aus derselben Vorlage wie der Check in MAKE OS — EINE Quelle für Namen und Sätze.
  const stufen = JSON.parse(readFileSync(join(ORDNER, '..', 'lib/check/vorlagen/innovations-check/scoring.json'), 'utf8')).stufen;
  const katalog = JSON.parse(readFileSync(join(ORDNER, '..', 'lib/check/vorlagen/innovations-check/fragenkatalog.json'), 'utf8'));
  return { inhalt, seite, stufen, katalog };
}

// ── Seiten bauen ────────────────────────────────────────────────────────────────────────────────────────────────────
export function seitenBauen(q = quellen()) {
  const { inhalt, seite, stufen, katalog } = q;
  const angebot = (id) => inhalt.angebote.find((a) => a.id === id);
  const faqVon = (ids) => ids.map((id) => inhalt.faq.find((f) => f.id === id)).filter(Boolean);
  const start = Object.fromEntries(inhalt.startseite.map((s) => [s.id, s]));
  const bereichDaten = Object.fromEntries(start.bereiche.bereiche.map((b) => [bereichKey(b.name), b]));
  const bereichSeite = Object.fromEntries(inhalt.bereichsseiten.map((b) => [bereichKey(b.bereich), b]));

  /** Pfad einer Produktseite (Fokus Innovation hat eine eigene Seite). */
  const produktPfad = (a) => (a.id === 'fokus-innovation' ? '/fokus-innovation/' : `/${seite.bereiche[bereichKey(a.bereich)].pfad}/${a.id}/`);
  const produkteIn = (b) => (bereichDaten[b]?.angebote ?? []).map(angebot).filter(Boolean);
  const check = (quelle) => `${seite.check}?q=${quelle}`;
  const mail = (betreff) => `mailto:${seite.kontakt.mail}?subject=${encodeURIComponent(betreff)}`;
  const terminLink = (betreff) => (seite.termin.link ? seite.termin.link : mail(`Termin: ${betreff}`));
  const terminText = seite.termin.link ? 'Termin buchen' : 'Termin anfragen';
  const preisKurz = (a) => `${a.preis}${/^pro Monat/.test(a.preis_zusatz ?? '') ? ' / Monat' : ''}`;
  const bald = (a) => a.status === 'Coming Soon';
  const kachel = (b, gross = false) => `<img class="kachel${gross ? ' gross' : ''}" src="/assets/bereiche/${seite.bereiche[b].kachel}" width="${gross ? 72 : 56}" height="${gross ? 72 : 56}" alt="">`;
  const zeichen = (klasse = '', groesse = 44) => `<img class="${klasse}" src="/assets/logo/MAKE_Zeichen_auf-dunkel.svg" width="${groesse}" height="${groesse}" alt="">`;

  // ── Rahmen: Kopf, Fuß, Zoe-Knopf ──
  const navProdukte = (b) => produkteIn(b).filter((a) => a.id !== 'fokus-innovation');
  const navUnter = (b) => [
    ...(b === 'innovation' ? [`<a href="/innovations-check/">Innovations-Check<span>kostenlos</span></a>`] : []),
    ...navProdukte(b).map((a) => `<a href="${produktPfad(a)}">${e(a.name)}<span>${e(bald(a) ? 'bald' : preisKurz(a))}</span></a>`),
  ].join('');
  const NAV = [
    ...BEREICHE.map((b) => ({ key: b, name: bereichDaten[b].name, href: `/${seite.bereiche[b].pfad}/`, unter: navUnter(b) })),
    { key: 'gratis', name: 'Gratis', href: '/gratis/' },
    { key: 'fokus', name: 'Fokus Innovation', href: '/fokus-innovation/' },
    { key: 'ueber-uns', name: 'Über uns', href: '/ueber-uns/' },
  ];
  const kopf = (aktiv) => `<a class="sprung" href="#inhalt">Zum Inhalt</a>
<header class="kopf"><div class="w kopf-innen">
<a class="marke" href="/" aria-label="MAKE Innovation, zur Startseite"><img src="/assets/logo/MAKE_Innovation_Logo_auf-dunkel.svg" width="250" height="73" alt=""></a>
<nav class="haupt-nav" aria-label="Hauptmenü">${NAV.map((n) => {
    const cur = n.key === aktiv ? ' aria-current="page"' : '';
    return n.unter ? `<div class="nav-punkt"><a href="${n.href}"${cur}>${e(n.name)}</a><div class="unter">${n.unter}</div></div>` : `<a href="${n.href}"${cur}>${e(n.name)}</a>`;
  }).join('')}</nav>
<a class="knopf haupt" href="${check('kopf')}">Innovations-Check</a>
<details class="menue"><summary><span class="striche" aria-hidden="true"></span>Menü</summary><nav class="menue-blatt" aria-label="Menü">
${BEREICHE.map((b) => `<div class="menue-gruppe">${e(bereichDaten[b].name)}</div><a href="/${seite.bereiche[b].pfad}/">Alles zu ${e(bereichDaten[b].name)}</a>${navUnter(b).replace(/<span>[^<]*<\/span>/g, '')}`).join('\n')}
<div class="menue-gruppe">MAKE</div><a href="/gratis/">Gratis</a><a href="/fokus-innovation/">Fokus Innovation</a><a href="/ueber-uns/">Über uns</a><a href="/kontakt/">Kontakt</a>
<a class="knopf haupt" href="${check('menue')}">Innovations-Check starten ${PFEIL}</a>
</nav></details>
</div></header>`;

  /** Telefon nur, wenn eine Nummer eingetragen ist (Kevin 24.10.: vorerst keine). */
  const telefon = () => (istPlatzhalter(seite.kontakt.telefon) ? t(seite.kontakt.telefon) : `<a href="tel:${e(seite.kontakt.telefon.replace(/[^\d+]/g, ''))}">${e(seite.kontakt.telefon)}</a>`);
  const fussSpalte = (titel, links) => `<div><p class="fuss-titel">${e(titel)}</p><ul>${links.map(([h, n]) => `<li><a href="${h}">${e(n)}</a></li>`).join('')}</ul></div>`;
  const fuss = () => `<footer class="fuss"><div class="w">
<div class="fuss-raster">
<div><img src="/assets/logo/MAKE_Innovation_Logo_auf-dunkel.svg" width="116" height="34" alt="MAKE Innovation"><p class="claim">${e(inhalt.marke.claim)}</p>
<p><a href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>${seite.kontakt.telefon ? `<br>${telefon()}` : ''}<br>${e(seite.anbieter[seite.anbieter_aktiv].name)}<br>${seite.kontakt.adresse.map(t).join('<br>')}</p></div>
${BEREICHE.map((b) => fussSpalte(bereichDaten[b].name, [[`/${seite.bereiche[b].pfad}/`, `Überblick ${bereichDaten[b].name}`], ...(b === 'innovation' ? [['/innovations-check/', 'Innovations-Check']] : []), ...navProdukte(b).map((a) => [produktPfad(a), a.name])])).join('\n')}
${fussSpalte('MAKE', [['/ueber-uns/', 'Über uns'], ['/fokus-innovation/', 'Fokus Innovation'], ['/gratis/', 'Gratis'], ['/kontakt/', 'Kontakt'], ['/impressum/', 'Impressum'], ['/datenschutz/', 'Datenschutz'], ['https://app.makeinnovation.de/anmelden', 'Login']])}
</div>
<div class="fuss-unten"><span>© 2026 ${e(seite.anbieter[seite.anbieter_aktiv].name)}</span><span>Alle Preise netto zuzüglich Umsatzsteuer. Unsere Angebote richten sich an Unternehmen.</span></div>
</div></footer>
<a class="zoe-knopf" href="${check('zoe_knopf')}" aria-label="Innovations-Check mit Zoe starten (Zoe ist eine KI-Assistentin)">${zeichen('', 40)}<span>Zoe · KI-Assistentin<small>Innovations-Check starten</small></span></a>`;

  const rahmen = ({ titel, beschreibung, aktiv = '', main, szene = false }) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titel)}</title>
<meta name="description" content="${e(beschreibung)}">
<meta name="theme-color" content="#131519">
${seite.indexieren ? '' : '<meta name="robots" content="noindex">\n'}<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/logo/MAKE_Favicon_32px.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/logo/MAKE_Favicon_180px.png">
<link rel="preload" href="/assets/fonts/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/marke.css?v=${stempel('css/marke.css')}">
${szene ? `<link rel="stylesheet" href="/css/szene.css?v=${stempel('css/szene.css')}">\n` : ''}<script src="/js/seite.js?v=${stempel('js/seite.js')}" defer></script>
</head>
<body>
${kopf(aktiv)}
<main id="inhalt">
${main}
</main>
${fuss()}
</body>
</html>
`;

  // ── Bausteine ──
  const kopfzeile = (eb, titel, text) => `<div class="kopfzeile"><span class="eb">${e(eb)}</span><h2>${titel}</h2>${text ? `<p>${t(text)}</p>` : ''}</div>`;
  const fragen = (liste, titel = 'Häufige Fragen') => (liste.length ? `<section class="abschnitt hell" aria-labelledby="fragen-titel"><div class="w">
<div class="kopfzeile"><span class="eb">Fragen</span><h2 id="fragen-titel">${e(titel)}</h2></div>
<div class="fragen">${liste.map((f) => `<details><summary>${e(f.f)}<span class="plus" aria-hidden="true">+</span></summary><p>${t(f.a)}</p></details>`).join('')}</div>
</div></section>` : '');
  const ende = (titel, text, knopf) => `<section class="abschnitt ende"><div class="w"><h2>${titel}</h2><p>${t(text)}</p>${knopf}</div></section>`;
  const checkKnopf = (quelle, text = 'Innovations-Check starten', art = 'haupt') => `<a class="knopf ${art}" href="${check(quelle)}">${e(text)} ${PFEIL}</a>`;
  const stufenLeiste = () => `<ol class="stufen" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><i></i>${e(s.name.replace(/ \(.*\)$/, ''))}</li>`).join('')}</ol>`;
  const stufenLang = () => `<ol class="stufen-lang">${stufen.map((s) => `<li><span class="nr">${s.stufe}</span><div><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></div></li>`).join('')}</ol>`;
  const a1 = katalog.abschnitte.flatMap((x) => x.fragen).find((f) => f.id === 'A1');
  const chat = () => `<div class="chat" role="img" aria-label="Beispiel: so beginnt der Innovations-Check mit Zoe">
<div class="chat-kopf">${zeichen('', 44)}<div><b>Zoe</b><small>KI-Assistentin von MAKE Innovation</small></div></div>
<div class="nachricht zoe">Hi, ich bin Zoe, die KI-Assistentin von MAKE Innovation. In rund 10 Minuten siehst du, wo dein Unternehmen bei KI und Automatisierung steht.</div>
<div class="nachricht du">Los geht’s.</div>
<div class="nachricht zoe">${e(a1.text)}</div>
<div class="auswahl" aria-hidden="true">${a1.optionen.slice(0, 4).map((o) => `<span>${e(o.text)}</span>`).join('')}</div>
</div>`;
  const angebotKarte = (a, mitListe = true) => `<article class="angebot${a.hervorheben ? ' hervor' : ''}">${a.hervorheben ? `<span class="abzeichen">${e(seite.abzeichen)}</span>` : ''}
<h3>${e(a.name)}${bald(a) ? ' <span class="bald">Coming Soon</span>' : ''}</h3>
<div class="preis"><b>${e(a.preis)}</b><span>${e(a.preis_zusatz ?? '')}</span></div>
${a.fuer_wen ? `<p class="fuer">${t(a.fuer_wen)}</p>` : ''}
${mitListe && a.enthalten ? haken(a.enthalten.slice(0, 4)) : ''}
<a class="textlink" href="${produktPfad(a)}">Mehr erfahren ${PFEIL}</a></article>`;
  const belegListe = (liste) => `<div class="belege">${liste.map((b) => `<div class="beleg"><span class="punkt" aria-hidden="true"></span><span>${t(b)}</span></div>`).join('')}</div>`;
  const team = () => `<div class="team">${seite.team.map((p) => `<div class="person"><span class="kuerzel" aria-hidden="true">${e(p.kuerzel)}</span><div><span class="rolle">${e(p.rolle)}</span><b>${e(p.name)}</b><p>${t(p.text)}</p></div></div>`).join('')}</div>`;
  const faelle = (liste) => `<div class="faelle">${liste.map((f) => `<article class="fall"><h3>${t(f.titel)}</h3><dl><dt>Ausgangslage</dt><dd>${t(f.ausgangslage)}</dd><dt>Vorgehen</dt><dd>${t(f.vorgehen)}</dd><dt>Ergebnis</dt><dd>${t(f.ergebnis)}</dd></dl></article>`).join('')}</div>`;
  const netto = '<p class="netto">Alle Preise netto zuzüglich Umsatzsteuer. Unsere Angebote richten sich an Unternehmen.</p>';
  const gespraechKarte = (quelle) => `<div class="gespraech"><div class="gross verlauf" aria-hidden="true">90</div><div><span class="eb">Nach dem Check</span><h3>${e(start.gespraech.titel)}</h3><p>${t(start.gespraech.text)}</p><small>${t(start.gespraech.regel)}</small></div>${checkKnopf(quelle, start.gespraech.cta.text, 'zweit')}</div>`;

  /** Eine Ebene der Szene: Kachel, Name, Satz und ein kleines Bild davon, was dort passiert (Start- und Bereichsseiten). */
  const EBENEN = {
    sichtbarkeit: `<div class="ebene e-sichtbarkeit"><div class="ebene-innen"><div class="ebene-kopf">${kachel('sichtbarkeit')}<div><b>Sichtbarkeit</b><span>Gesehen und verstanden werden</span></div></div>
<svg viewBox="0 0 200 44" aria-hidden="true"><rect class="mini-zeile" x="0" y="2" width="190" height="5" rx="2.5"/><rect class="mini-zeile" x="0" y="12" width="160" height="5" rx="2.5"/><rect class="mini-zeile" x="0" y="22" width="176" height="5" rx="2.5"/><rect class="mini-satz" x="0" y="33" width="128" height="8" rx="4"/></svg></div></div>`,
    vertrieb: `<div class="ebene e-vertrieb"><div class="ebene-innen"><div class="ebene-kopf">${kachel('vertrieb')}<div><b>Vertrieb</b><span>${e(bereichDaten.vertrieb.satz)}</span></div></div>
<svg viewBox="0 0 200 44" aria-hidden="true"><rect class="mini-grund" x="0" y="43" width="200" height="1"/><rect class="mini-balken b1" x="8" y="31" width="36" height="12" rx="3"/><rect class="mini-balken b2" x="58" y="23" width="36" height="20" rx="3"/><rect class="mini-balken b3" x="108" y="13" width="36" height="30" rx="3"/><rect class="mini-balken b4" x="158" y="2" width="36" height="41" rx="3"/></svg></div></div>`,
    innovation: `<div class="ebene e-innovation"><div class="ebene-innen"><div class="ebene-kopf">${kachel('innovation')}<div><b>Innovation</b><span>${e(bereichDaten.innovation.satz)}</span></div></div>
<svg viewBox="0 0 200 44" aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => `<rect class="mini-stufe${i < 3 ? ` an s${i + 1}` : ''}" x="${i * 40 + 2}" y="${36 - i * 8}" width="36" height="${8 + i * 8}" rx="3"/>`).join('')}</svg></div></div>`,
  };
  const ebeneKarte = (b) => EBENEN[b];

  // ── Szene im Einstieg (css/szene.css) ──
  const szene = () => `<div class="szene" role="img" aria-label="Animation: Aus dem Funken im MAKE-Zeichen entstehen drei Bereiche — Sichtbarkeit, Vertrieb und Innovation.">
<div class="szene-raum">
<div class="szene-schein"></div>
<svg class="szene-faeden" viewBox="0 0 520 470" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="szene-faden" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2FBF71"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>
<path class="faden f1" pathLength="1" d="M150 214 C 196 186, 206 92, 250 70"/><path class="faden f2" pathLength="1" d="M162 236 C 186 236, 204 232, 229 230"/><path class="faden f3" pathLength="1" d="M150 258 C 196 286, 206 376, 250 392"/>
<circle class="faden-punkt p1" cx="250" cy="70" r="3.5"/><circle class="faden-punkt p2" cx="229" cy="230" r="3.5"/><circle class="faden-punkt p3" cx="250" cy="392" r="3.5"/></svg>
<svg class="szene-zeichen" viewBox="9.5 23.5 177 177" aria-hidden="true"><defs><linearGradient id="szene-ring" gradientUnits="userSpaceOnUse" x1="30" y1="180" x2="166" y2="44"><stop offset="0" stop-color="#2FBF71"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient><linearGradient id="szene-licht" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2FBF71"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>
<circle class="scheibe" cx="98" cy="112" r="74.5" fill="#1B1F27"/>
<path class="ring" d="M159.63 83.26 A68 68 0 1 1 115.60 46.32" fill="none" stroke="url(#szene-ring)" stroke-width="9.1" stroke-linecap="round"/>
<g transform="translate(98 116)"><path class="funke" d="M0.0 -55.1 Q5.2 -5.2 39.9 0.0 Q5.2 5.2 0.0 31.1 Q-5.2 5.2 -39.9 0.0 Q-5.2 -5.2 0.0 -55.1Z" fill="url(#szene-licht)"/></g>
<g transform="translate(141.70 59.00)"><path class="funke-klein" d="M0.0 -14.2 Q1.9 -1.9 14.2 0.0 Q1.9 1.9 0.0 14.2 Q-1.9 1.9 -14.2 0.0 Q-1.9 -1.9 0.0 -14.2Z" fill="#9F88FF"/></g></svg>
${ebeneKarte('sichtbarkeit')}
${ebeneKarte('vertrieb')}
${ebeneKarte('innovation')}
</div></div>`;

  const seiten = [];
  const neu = (pfad, s) => seiten.push({ pfad, html: rahmen(s) });

  /** Gruppe als Anker auf der Bereichsseite. */
  const gruppeAnker = (name) => `gruppe-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const abPreis = (liste) => {
    const zahlen = liste.map((a) => Number((String(a.preis).replace(/\./g, '').match(/\d+/) ?? [NaN])[0])).filter(Number.isFinite);
    const min = Math.min(...zahlen);
    return `ab ${min.toLocaleString('de-DE')} €`;
  };
  /** Zeilen eines Bereichs auf der Startseite: Angebote mit Gruppe zusammengefasst („ab“-Preis), die übrigen einzeln. */
  const startZeilen = (b) => {
    const aus = [];
    for (const a of produkteIn(b)) {
      if (!a.gruppe) { aus.push({ name: a.name, preis: preisKurz(a), href: produktPfad(a) }); continue; }
      if (aus.some((z) => z.gruppe === a.gruppe)) continue;
      const liste = produkteIn(b).filter((x) => x.gruppe === a.gruppe);
      aus.push({ gruppe: a.gruppe, name: liste.length > 1 ? a.gruppe : a.name, preis: liste.length > 1 ? abPreis(liste) : preisKurz(a), href: liste.length > 1 ? `/${seite.bereiche[b].pfad}/#${gruppeAnker(a.gruppe)}` : produktPfad(a) });
    }
    return aus;
  };

  // ── Startseite (Kevin 24.10.: kompakt, 7 Abschnitte) ──
  {
    const h = start.hero;
    const letztes = h.titel.lastIndexOf(' ');
    const bereiche = BEREICHE.map((b) => {
      const d = bereichDaten[b];
      return `<article class="bereich ${b}">${kachel(b)}<h3>${e(d.name)}${d.status === 'Coming Soon' ? ' <span class="bald">Coming Soon</span>' : ''}</h3><p>${t(d.satz)}</p>
<ul>${startZeilen(b).map((z) => `<li><a href="${z.href}"><b>${e(z.name)}</b><span>${e(z.preis)}</span></a></li>`).join('')}</ul>
<a class="textlink" href="/${seite.bereiche[b].pfad}/">Alles zu ${e(d.name)} ${PFEIL}</a></article>`;
    }).join('\n');
    neu('index.html', {
      titel: `MAKE Innovation · ${inhalt.marke.claim}`,
      beschreibung: inhalt.marke.positionierung,
      szene: true,
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster"><div>
<span class="eb erscheinen">Vertrieb · Sichtbarkeit · Innovation</span>
<h1 id="held-titel" class="erscheinen d1">${e(h.titel.slice(0, letztes))} <span class="verlauf">${e(h.titel.slice(letztes + 1))}</span></h1>
<p class="lead erscheinen d2">${t(h.text)}</p>
<div class="knoepfe erscheinen d3">${checkKnopf('start_hero', h.cta_primaer.text)}<a class="knopf zweit" href="#bereiche">${e(h.cta_sekundaer.text)}</a></div>
<small>${e(h.hinweis.replace(/^k/, 'K'))}</small>
</div>
${szene()}
</div></section>

<section class="abschnitt hell" id="bereiche" aria-labelledby="bereiche-titel"><div class="w">
<div class="kopfzeile"><span class="eb">Angebote</span><h2 id="bereiche-titel">${e(start.bereiche.titel)}</h2><p>${t(start.story.text)}</p></div>
<div class="bereiche">${bereiche}</div>
${netto}
</div></section>

<section class="abschnitt getoent" id="check" aria-labelledby="check-titel"><div class="w zwei">
<div><span class="eb">Kostenlos · Herzstück</span><h2 id="check-titel">${e(start['innovations-check'].titel)}</h2><p class="lead">${t(start['innovations-check'].text)}</p>
${haken(seite.check_punkte.punkte)}
<div class="knoepfe">${checkKnopf('start_check')}<a class="textlink" href="/innovations-check/">So funktioniert der Check ${PFEIL}</a></div>
${stufenLeiste()}</div>
${chat()}
</div></section>

<section class="abschnitt" aria-label="Das 90-Tage-Umsetzungsgespräch"><div class="w">${gespraechKarte('start_gespraech')}</div></section>

<section class="abschnitt" id="warum" aria-labelledby="warum-titel"><div class="w zwei mitte">
<div><span class="eb">Über uns</span><h2 id="warum-titel">${e(start['ueber-uns'].titel)}</h2><p class="lead">${t(start['ueber-uns'].text)}</p>
${team()}
<p><a class="textlink" href="/ueber-uns/">Mehr über uns ${PFEIL}</a></p></div>
${belegListe(inhalt.belege)}
</div></section>

<section class="abschnitt fokus" aria-labelledby="fokus-titel"><div class="w fokus-zeile">
<div><span class="eb">Bühne und Netzwerk</span><h2 id="fokus-titel">${e(start.fokus.titel)}</h2><p>${t(start.fokus.text)}</p></div>
<a class="knopf fokus-knopf" href="/fokus-innovation/">${e(start.fokus.cta.text)} ${PFEIL}</a>
</div></section>

${ende(e(start.abschluss.titel), start.abschluss.text, checkKnopf('start_ende', start.abschluss.cta.text))}`,
    });
  }

  // ── Bereichsseiten ──
  for (const b of BEREICHE) {
    const d = bereichDaten[b];
    const s = bereichSeite[b];
    const pfad = seite.bereiche[b].pfad;
    const produkte = produkteIn(b);
    const istBald = d.status === 'Coming Soon';
    const knoepfe = b === 'vertrieb'
      ? `${checkKnopf(`${b}_hero`)}<a class="knopf zweit" href="${terminLink('Vertrieb')}">${e(s.hero.cta2)}</a>`
      : b === 'sichtbarkeit'
        // „Homepage-Check“ gibt es noch nicht (Gratis: nur was fertig ist, Kevin 24.10.) — der Hauptknopf führt zu den Paketen.
        ? `<a class="knopf haupt" href="#angebote">${e(s.hero.cta2)} ${PFEIL}</a>${checkKnopf(`${b}_hero`, 'Innovations-Check starten', 'zweit')}`
        : `${checkKnopf(`${b}_hero`)}<a class="knopf zweit" href="${mail('Warteliste Umsetzungsprojekte')}">${e(s.hero.cta2)}</a>`;
    const gruppen = [];
    for (const a of produkte) {
      const g = a.gruppe ?? (a.id === 'fokus-innovation' ? 'Bühne und Netzwerk' : '');
      let ziel = gruppen.find((x) => x.name === g);
      if (!ziel) gruppen.push((ziel = { name: g, liste: [] }));
      ziel.liste.push(a);
    }
    const angeboteHtml = gruppen.map((g) => `${g.name && gruppen.length > 1 ? `<h3 class="gruppe-titel" id="${gruppeAnker(g.name)}">${e(g.name)}</h3>` : ''}<div class="angebote">${g.liste.map((a) => angebotKarte(a)).join('')}</div>`).join('\n');
    const ablauf = b === 'vertrieb' ? (() => {
      const zeile = s.abschnitte.find((x) => x.startsWith('So läuft es ab:')) ?? '';
      const schritte = zeile.replace(/^So läuft es ab:\s*/, '').split('→').map((x) => x.trim()).filter(Boolean);
      const unter = { 'Check': 'Rund 10 Minuten, Ergebnis sofort, kostenlos', '90-Tage-Gespräch': '60 Minuten mit Kevin, kostenlos', 'Tagesworkshop': `${angebot('tagesworkshop').preis}, wird beim Mandatsstart voll angerechnet`, 'Mandat': 'Head of Sales oder Chief Sales Officer' };
      return `<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${kopfzeile('Ablauf', '<span id="ablauf-titel">So läuft es ab</span>')}
<ol class="ablauf">${schritte.map((x) => `<li><b>${e(x)}</b><span>${e(unter[x] ?? '')}</span></li>`).join('')}</ol></div></section>`;
    })() : '';
    const vergleich = b === 'vertrieb' ? (() => {
      const hos = angebot('head-of-sales'), cso = angebot('cso');
      const zeilen = [...hos.enthalten.map((x) => [x, true, true]), ...cso.enthalten.filter((x) => !/^Alles aus/.test(x)).map((x) => [x, false, true])];
      const zelle = (ja) => (ja ? '<td class="ja" aria-label="enthalten">✓</td>' : '<td class="nein" aria-label="nicht enthalten">—</td>');
      return `<section class="abschnitt hell" aria-labelledby="vergleich-titel"><div class="w">${kopfzeile('Vergleich', '<span id="vergleich-titel">Head of Sales oder CSO?</span>', inhalt.faq.find((f) => f.id === 'was-ist-der-unterschied-zwischen-head')?.a)}
<div class="tabelle-huelle"><table class="vergleich"><thead><tr><th scope="col">Leistung</th><th scope="col">Head of Sales<br><span class="zahl">${e(preisKurz(hos))}</span></th><th scope="col">CSO<br><span class="zahl">${e(preisKurz(cso))}</span></th></tr></thead>
<tbody>${zeilen.map(([x, a, c]) => `<tr><th scope="row">${e(x)}</th>${zelle(a)}${zelle(c)}</tr>`).join('')}</tbody></table></div>
<div class="knoepfe"><a class="textlink" href="${produktPfad(hos)}">Head of Sales im Detail ${PFEIL}</a><a class="textlink" href="${produktPfad(cso)}">CSO im Detail ${PFEIL}</a></div></div></section>`;
    })() : '';
    const zusatz = b === 'sichtbarkeit' ? `<section class="abschnitt hell" aria-labelledby="zusatz-titel"><div class="w">${kopfzeile('Zusatzoptionen', '<span id="zusatz-titel">Dazu buchbar</span>')}
<div class="angebote">${inhalt.zusatzoptionen.map((z) => `<article class="angebot"><h3>${e(z.name)}</h3><div class="preis"><b>${e(z.preis)}</b><span>${e(z.fuer)}</span></div><p class="fuer">${t(z.leistung)}</p></article>`).join('')}</div>${netto}</div></section>` : '';
    const belege = b === 'vertrieb' ? inhalt.belege.slice(0, 3) : b === 'innovation' ? inhalt.belege.slice(4, 5) : [];
    const faelleHier = seite.fallbeispiele.filter((f) => f.bereich === b);
    neu(`${pfad}/index.html`, {
      titel: `${d.name} · MAKE Innovation`,
      beschreibung: `${d.satz} ${s.hero.text}`.slice(0, 300),
      aktiv: b,
      szene: true,
      main: `<section class="held klein" aria-labelledby="held-titel"><div class="w held-raster"><div>
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><span>${e(d.name)}</span></nav>
<div class="bereich-zeile">${kachel(b, true)}<span class="eb">${e(d.name)}${istBald ? ' · <span class="bald dunkel-bald">Coming Soon</span>' : ''}</span></div>
<h1 id="held-titel">${e(s.hero.titel)}</h1>
<p class="lead">${t(s.hero.text)}</p>
<div class="knoepfe">${knoepfe}</div>
</div>
<div class="bild-raum" aria-hidden="true"><svg class="verlaeufe" width="0" height="0" aria-hidden="true"><defs><linearGradient id="szene-licht" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2FBF71"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs></svg><div class="szene-schein"></div>${ebeneKarte(b)}</div>
</div></section>

<section class="abschnitt" aria-labelledby="story-titel"><div class="w">${kopfzeile('Unser Weg mit dir', `<span id="story-titel">${e(s.story_kern)}</span>`)}
<div class="schritte">${s.story.map((x, i) => `<div class="schritt"><span class="nr">0${i + 1}</span><b>${e(x.schritt)}</b><p>${t(x.text)}</p></div>`).join('')}</div></div></section>

${belege.length ? `<section class="abschnitt" aria-labelledby="belege-titel"><div class="w zwei mitte"><div>${kopfzeile('Belege', `<span id="belege-titel">${b === 'innovation' ? 'Wir nutzen, was wir einführen' : 'Wir haben Vertrieb aufgebaut, geführt und skaliert'}</span>`)}</div>${belegListe(belege)}</div></section>` : ''}

${b === 'innovation' ? `<section class="abschnitt getoent" aria-labelledby="stufen-titel"><div class="w zwei"><div>${kopfzeile('Innovations-Check', `<span id="stufen-titel">${e(start['innovations-check'].titel)}</span>`, start['innovations-check'].text)}<div class="knoepfe">${checkKnopf('innovation_stufen')}</div></div>${stufenLang()}</div></section>
<section class="abschnitt" aria-label="Das 90-Tage-Umsetzungsgespräch"><div class="w">${gespraechKarte('innovation_gespraech')}</div></section>` : ''}

<section class="abschnitt hell" id="angebote" aria-labelledby="angebote-titel"><div class="w">${kopfzeile('Angebote', `<span id="angebote-titel">${e(d.name)}: unsere Angebote</span>`, d.satz)}
${angeboteHtml}
${netto}</div></section>

${vergleich}
${zusatz}
${ablauf}
${seite.fallbeispiele_zeigen && faelleHier.length ? `<section class="abschnitt hell" aria-labelledby="faelle-titel"><div class="w">${kopfzeile('Aus der Praxis', '<span id="faelle-titel">So sieht das in der Praxis aus</span>', 'Anonymisiert, mit Zustimmung der Kunden.')}${faelle(faelleHier)}</div></section>` : ''}
${b === 'sichtbarkeit' ? `<section class="abschnitt fokus" aria-labelledby="fokus-titel"><div class="w fokus-zeile"><div><span class="eb">Auf die Bühne</span><h2 id="fokus-titel">${e(start.fokus.titel)}</h2><p>${t(start.fokus.text)}</p></div><a class="knopf fokus-knopf" href="/fokus-innovation/">Mehr zu Fokus Innovation ${PFEIL}</a></div></section>` : ''}
${fragen(faqVon(seite.bereiche[b].faq))}
${ende(e(start.abschluss.titel), start.abschluss.text, checkKnopf(`${b}_ende`, start.abschluss.cta.text))}`,
    });
  }

  // ── Produktseiten (Kevin 24.10.: eigene Seite je Produkt, Preise offen, Termin direkt) ──
  for (const a of inhalt.angebote.filter((x) => x.id !== 'fokus-innovation')) {
    const b = bereichKey(a.bereich);
    const d = bereichDaten[b];
    const pfad = produktPfad(a).replace(/^\//, '');
    const istBald = bald(a);
    const terminKnopf = istBald
      ? `<a class="knopf haupt" href="${mail(`Warteliste: ${a.name}`)}">Auf die Warteliste ${PFEIL}</a>`
      : `<a class="knopf haupt" href="${terminLink(a.name)}">${terminText} ${PFEIL}</a>`;
    const regeln = [...(a.regeln ?? []), ...(seite.produkt_konditionen[a.id] ?? []), inhalt.konditionen[1]];
    const homepage = a.gruppe === 'Homepage-Pakete';
    const zusatz = homepage ? inhalt.zusatzoptionen.filter((z) => /Homepage/.test(z.fuer)) : [];
    const weitere = produkteIn(b).filter((x) => x.id !== a.id);
    const stufenHtml = a.stufen ? `<section class="abschnitt hell" aria-labelledby="pakete-titel"><div class="w">${kopfzeile('Drei Stufen', '<span id="pakete-titel">Wähle die Tiefe, die du brauchst</span>', a.preis_zusatz)}
<div class="pakete">${a.stufen.map((s) => `<article class="angebot"><h3>Positionierung ${e(s.name)}</h3><div class="preis"><b>${e(s.preis)}</b><span>Workshop: ${e(s.workshop)}</span></div><p class="fuer">${t(s.ergebnis)}</p></article>`).join('')}</div>${netto}</div></section>` : '';
    const gutZuWissen = `<div class="karte-hell">${a.nicht_enthalten ? `<h3>Nicht enthalten</h3><ul class="nicht">${a.nicht_enthalten.map((x) => `<li>${t(x)}</li>`).join('')}</ul>${a.id === 'head-of-sales' ? `<p class="leise">Das alles gehört zum <a class="textlink" href="${produktPfad(angebot('cso'))}">Chief Sales Officer ${PFEIL}</a></p>` : ''}` : ''}
<h3>Gut zu wissen</h3><ul class="regeln">${regeln.map((x) => `<li>${t(x)}</li>`).join('')}<li>${t(inhalt.konditionen[0])}</li></ul></div>`;
    neu(`${pfad}index.html`, {
      titel: `${a.name} · MAKE Innovation`,
      beschreibung: `${a.name}: ${a.fuer_wen ?? (a.enthalten ?? []).join(', ')} ${a.preis} ${a.preis_zusatz ?? ''}`.slice(0, 300),
      aktiv: b,
      main: `<section class="held klein" aria-labelledby="held-titel"><div class="w zwei mitte"><div>
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><a href="/${seite.bereiche[b].pfad}/">${e(d.name)}</a><span aria-hidden="true">›</span><span>${e(a.name)}</span></nav>
<div class="bereich-zeile">${kachel(b)}<span class="eb">${e(d.name)}${a.gruppe ? ` · ${e(a.gruppe)}` : ''}${istBald ? ' · <span class="bald dunkel-bald">Coming Soon</span>' : ''}</span></div>
<h1 id="held-titel">${e(a.name)}</h1>
${a.fuer_wen ? `<p class="lead">${t(a.fuer_wen)}</p>` : `<p class="lead">${t(d.satz)}</p>`}
</div>
<aside class="preis-kasten" aria-label="Preis"><span class="eb">Preis</span><div class="betrag">${e(a.preis)}</div><div class="zusatz">${e(a.preis_zusatz ?? '')} · netto zuzüglich Umsatzsteuer</div>${terminKnopf}${checkKnopf(`produkt_${a.id}`, 'Erst den Innovations-Check machen', 'zweit')}</aside>
</div></section>

${a.enthalten ? `<section class="abschnitt hell" aria-labelledby="inhalt-titel"><div class="w spalten">
<div><span class="eb">Was drin ist</span><h2 id="inhalt-titel">Enthalten</h2>${haken(a.enthalten)}</div>
${gutZuWissen}
</div></section>` : ''}

${stufenHtml}
${a.enthalten ? '' : `<section class="abschnitt hell" aria-label="Gut zu wissen"><div class="w">${gutZuWissen}</div></section>`}
${zusatz.length ? `<section class="abschnitt hell" aria-labelledby="zusatz-titel"><div class="w">${kopfzeile('Zusatzoptionen', '<span id="zusatz-titel">Dazu buchbar</span>')}<div class="angebote">${zusatz.map((z) => `<article class="angebot"><h3>${e(z.name)}</h3><div class="preis"><b>${e(z.preis)}</b><span>${e(z.fuer)}</span></div><p class="fuer">${t(z.leistung)}</p></article>`).join('')}</div></div></section>` : ''}
${fragen(faqVon(seite.produkt_faq[a.id] ?? []))}
${weitere.length ? `<section class="abschnitt" aria-labelledby="weitere-titel"><div class="w">${kopfzeile(d.name, `<span id="weitere-titel">Weitere Angebote im Bereich ${e(d.name)}</span>`)}<div class="angebote dunkel-karten">${weitere.map((x) => `<a class="schritt" href="${produktPfad(x)}"><span class="nr">${e(preisKurz(x))}</span><b>${e(x.name)}</b><p>${t(x.fuer_wen ?? (x.enthalten ?? [])[0] ?? '')}</p></a>`).join('')}</div></div></section>` : ''}
${ende('Bereit für den nächsten Schritt?', istBald ? 'Trag dich auf die Warteliste ein. Oder starte mit dem Innovations-Check, er zeigt in 10 Minuten, wo du stehst.' : 'Sprich mit uns über deinen Start. Oder mach zuerst den Innovations-Check, er zeigt in 10 Minuten, wo du stehst.', `<div class="knoepfe">${terminKnopf}${checkKnopf(`produkt_${a.id}_ende`, 'Innovations-Check starten', 'zweit')}</div>`)}`,
    });
  }

  // ── Innovations-Check (Landingpage; der Check selbst läuft in MAKE OS unter /check) ──
  {
    const c = start['innovations-check'];
    neu('innovations-check/index.html', {
      titel: `Innovations-Check · MAKE Innovation`,
      beschreibung: c.text,
      aktiv: 'innovation',
      main: `<section class="held klein" aria-labelledby="held-titel"><div class="w zwei mitte"><div>
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><a href="/innovation/">Innovation</a><span aria-hidden="true">›</span><span>Innovations-Check</span></nav>
<span class="eb">Kostenlos · rund 10 Minuten · Ergebnis sofort</span>
<h1 id="held-titel">${e(c.titel)}</h1>
<p class="lead">${t(c.text)}</p>
<div class="knoepfe">${checkKnopf('check_seite_hero')}</div></div>
${chat()}
</div></section>

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${kopfzeile('So läuft es', '<span id="ablauf-titel">In drei Schritten zu deinen Top 3</span>')}
<div class="schritte drei"><div class="schritt"><span class="nr">01</span><b>15 Fragen mit Zoe</b><p>${t(seite.check_punkte.punkte[0])}</p></div><div class="schritt"><span class="nr">02</span><b>Ergebnis sofort</b><p>${t(seite.check_punkte.punkte[1])}</p></div><div class="schritt"><span class="nr">03</span><b>90-Tage-Gespräch</b><p>${t(start.gespraech.text)}</p></div></div></div></section>

<section class="abschnitt getoent" aria-labelledby="stufen-titel"><div class="w zwei"><div>${kopfzeile('Fünf Stufen', '<span id="stufen-titel">Wo steht dein Unternehmen?</span>', 'Der Check misst Strategie, KI im Alltag, Automatisierung, Daten und Team und vergleicht dich mit deiner Branche.')}</div>${stufenLang()}</div></section>

<section class="abschnitt" aria-labelledby="daten-titel"><div class="w zwei mitte"><div>${kopfzeile('Deine Daten', '<span id="daten-titel">Was mit deinen Antworten passiert</span>')}</div>
${haken(['Deine Antworten liegen auf unserem eigenen Server in Deutschland.', 'Zoe stellt die Fragen mit festen Texten. Deine Antworten gehen an kein KI-Modell.', 'Kontaktdaten gibst du nur, wenn du deinen Bericht oder ein Gespräch willst.', 'Ohne Kontaktdaten löschen wir die Antworten nach 30 Tagen.'])}</div></section>

${fragen(faqVon(seite.check_faq))}
${ende('Bereit?', 'In 10 Minuten weißt du, wo du stehst.', checkKnopf('check_seite_ende'))}`,
    });
  }

  // ── Gratis (Kevin 24.10.: nur was fertig ist) ──
  {
    const g = start.gratis;
    const fertig = inhalt.gratis.flatMap((r) => r.angebote.map((x) => ({ ...x, rubrik: r.rubrik }))).filter((x) => x.herzstueck);
    neu('gratis/index.html', {
      titel: `Gratis · MAKE Innovation`,
      beschreibung: g.text,
      aktiv: 'gratis',
      main: `<section class="held klein" aria-labelledby="held-titel"><div class="w">
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><span>Gratis</span></nav>
<span class="eb">Gratis</span><h1 id="held-titel">${e(g.titel)}</h1><p class="lead">${t(g.text)}</p></div></section>
<section class="abschnitt hell" aria-labelledby="gratis-titel"><div class="w">${kopfzeile('Jetzt verfügbar', '<span id="gratis-titel">Damit startest du</span>')}
<div class="angebote">${fertig.map((x) => `<article class="angebot hervor"><span class="abzeichen">Herzstück</span><h3>${e(x.name)}</h3><div class="preis"><b>Kostenlos</b><span>${e(x.format)}</span></div>${haken(seite.check_punkte.punkte)}<a class="knopf haupt" href="${check('gratis')}">Innovations-Check starten ${PFEIL}</a></article>`).join('')}</div>
<p class="netto">Weitere Werkzeuge und Leitfäden für Vertrieb, Sichtbarkeit und KI folgen.</p></div></section>`,
    });
  }

  // ── Fokus Innovation ──
  {
    const f = angebot('fokus-innovation');
    neu('fokus-innovation/index.html', {
      titel: `Fokus Innovation · MAKE Innovation`,
      beschreibung: start.fokus.text,
      aktiv: 'fokus',
      main: `<section class="held klein fokus" aria-labelledby="held-titel"><div class="w">
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><span>Fokus Innovation</span></nav>
<span class="eb">Bühne und Netzwerk · ${e(f.preis)}</span><h1 id="held-titel">${e(seite.fokus.titel)}</h1><p class="lead">${t(seite.fokus.satz)} ${t(start.fokus.text)}</p>
<div class="knoepfe"><a class="knopf fokus-knopf" href="${mail(seite.fokus.mail_betreff)}">Auf die Gästeliste ${PFEIL}</a></div></div></section>
<section class="abschnitt" aria-labelledby="abend-titel"><div class="w zwei mitte"><div>${kopfzeile('Der Abend', '<span id="abend-titel">Was dich erwartet</span>', seite.fokus.termine)}</div>${haken(f.enthalten)}</div></section>`,
    });
  }

  // ── Über uns ──
  neu('ueber-uns/index.html', {
    titel: `Über uns · MAKE Innovation`,
    beschreibung: `${start['ueber-uns'].text} ${inhalt.marke.positionierung}`.slice(0, 300),
    aktiv: 'ueber-uns',
    main: `<section class="held klein" aria-labelledby="held-titel"><div class="w">
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><span>Über uns</span></nav>
<span class="eb">Über uns</span><h1 id="held-titel">${e(start['ueber-uns'].titel)}</h1><p class="lead">${t(inhalt.marke.positionierung)}</p></div></section>
<section class="abschnitt" aria-labelledby="weg-titel"><div class="w">${kopfzeile(inhalt.marke.claim, `<span id="weg-titel">${e(start.story.titel)}</span>`, start.story.text)}
<div class="schritte drei">${inhalt.marke.story.map((x, i) => `<div class="schritt"><span class="nr">0${i + 1}</span><b>${e(x.schritt[0].toUpperCase() + x.schritt.slice(1))}</b><p>${e(x.bereich)}</p></div>`).join('')}</div></div></section>
<section class="abschnitt" aria-labelledby="team-titel"><div class="w zwei"><div>${kopfzeile('Team', '<span id="team-titel">Wer hinter MAKE steht</span>', start['ueber-uns'].text)}<p class="leise">MAKE steht für machen. Und für <b>MA</b>lin und <b>KE</b>vin.</p></div>${team()}</div></section>
<section class="abschnitt" aria-labelledby="belege-titel"><div class="w zwei mitte"><div>${kopfzeile('Belege', '<span id="belege-titel">Was wir schon umgesetzt haben</span>')}</div>${belegListe(inhalt.belege)}</div></section>
${seite.fallbeispiele_zeigen ? `<section class="abschnitt hell" aria-labelledby="faelle-titel"><div class="w">${kopfzeile('Aus der Praxis', '<span id="faelle-titel">Fallbeispiele</span>', 'Anonymisiert, mit Zustimmung der Kunden.')}${faelle(seite.fallbeispiele)}</div></section>` : ''}
${ende(e(start.abschluss.titel), start.abschluss.text, checkKnopf('ueber_uns_ende', start.abschluss.cta.text))}`,
  });

  // ── Kontakt (Kevin 24.10.: Telefon, Mail, Adresse) ──
  {
    const k = seite.kontakt;
    neu('kontakt/index.html', {
      titel: `Kontakt · MAKE Innovation`,
      beschreibung: `So erreichst du MAKE Innovation: ${k.telefon ? 'Telefon, ' : ''}E-Mail, Adresse und Termin.`,
      main: `<section class="held klein" aria-labelledby="held-titel"><div class="w">
<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a><span aria-hidden="true">›</span><span>Kontakt</span></nav>
<span class="eb">Kontakt</span><h1 id="held-titel">Sprich mit uns.</h1><p class="lead">Am schnellsten geht es über einen Termin. Oder du startest mit dem Innovations-Check und buchst danach dein 90-Tage-Gespräch.</p>
<div class="knoepfe"><a class="knopf haupt" href="${terminLink('Gespräch')}">${terminText} ${PFEIL}</a>${checkKnopf('kontakt', 'Innovations-Check starten', 'zweit')}</div></div></section>
<section class="abschnitt" aria-label="Kontaktdaten"><div class="w kontakt-liste${k.telefon ? '' : ' zwei-spalten'}">
${k.telefon ? `<div><span class="eb">Telefon</span>${telefon()}</div>` : ''}
<div><span class="eb">E-Mail</span><a href="mailto:${e(k.mail)}">${e(k.mail)}</a></div>
<div><span class="eb">Adresse</span><address>${e(seite.anbieter[seite.anbieter_aktiv].name)}<br>${k.adresse.map(t).join('<br>')}</address></div>
</div></section>`,
    });
  }

  // ── Rechtliches (Sie-Form; Hinweis, keine Rechtsberatung — vor dem Start anwaltlich prüfen) ──
  const an = seite.anbieter[seite.anbieter_aktiv];
  const anschrift = `<address>${e(an.name)}<br>${an.adresse.map(t).join('<br>')}</address>`;
  neu('impressum/index.html', {
    titel: 'Impressum · MAKE Innovation',
    beschreibung: 'Impressum von MAKE Innovation.',
    main: `<section class="abschnitt hell"><div class="w recht">
<span class="eb">Rechtliches</span><h1>Impressum</h1>
<h2>Angaben gemäß § 5 DDG</h2>${anschrift}
<h2>Vertreten durch</h2><p>${t(an.vertreten)}</p>
<h2>Kontakt</h2><p>E-Mail: <a class="textlink" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>${seite.kontakt.telefon ? `<br>Telefon: ${telefon()}` : ''}</p>
<h2>Registereintrag</h2><p>${t(an.register)}</p>
${an.ustid ? `<h2>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG</h2><p>${t(an.ustid)}</p>` : ''}
<h2>Verantwortlich nach § 18 Abs. 2 MStV</h2><p>${t(an.vertreten)}, Anschrift wie oben</p>
<h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Unsere Angebote richten sich an Unternehmen.</p>
<p class="leise">Stand: Oktober 2026</p>
</div></section>`,
  });
  neu('datenschutz/index.html', {
    titel: 'Datenschutz · MAKE Innovation',
    beschreibung: 'Datenschutzhinweis von MAKE Innovation.',
    main: `<section class="abschnitt hell"><div class="w recht">
<span class="eb">Rechtliches</span><h1>Datenschutz</h1>
<h2>Kurz gesagt</h2><p>Diese Website setzt keine Cookies und nutzt kein Tracking, keine Analyse und keine Werbung. Sie lädt nur Dateien von unserem eigenen Server — Schriften, Bilder, Stile und ein kleines Skript liegen hier, nichts kommt von fremden Diensten. Persönliche Daten verarbeiten wir nur, wenn es technisch nötig ist, um die Seite auszuliefern, wenn Sie den Innovations-Check nutzen, einen Termin buchen oder uns schreiben.</p>
<h2>Verantwortlich</h2>${anschrift}<p>vertreten durch ${t(an.vertreten)}. Für alle Fragen zum Datenschutz: <a class="textlink" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p>
<h2>Hosting</h2><p>Die Website liegt auf einem Server der Hetzner Online GmbH (Industriestr. 25, 91710 Gunzenhausen) in einem Rechenzentrum in Deutschland. Hetzner verarbeitet die Daten nur in unserem Auftrag (Art. 28 DSGVO).</p>
<h2>Aufruf der Seite</h2><p>Wenn Sie die Seite öffnen, schickt Ihr Browser technisch bedingt Ihre IP-Adresse, den Zeitpunkt, die aufgerufene Adresse und eine Browser-Kennung an unseren Server. Wir brauchen diese Angaben, um die Seite verschlüsselt (HTTPS) auszuliefern und den Server sicher zu betreiben — Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, funktionierenden Angebot (Art. 6 Abs. 1 lit. f DSGVO). Unser Webserver führt kein Zugriffsprotokoll. Technische Fehlermeldungen können eine IP-Adresse enthalten; sie bleiben auf dem Server, werden nicht ausgewertet und rollierend überschrieben.</p>
<h2>Cookies und Speicher im Browser</h2><p>Die Website selbst setzt keine Cookies und legt nichts im Speicher Ihres Browsers ab. Ein kleines Skript schließt auf dem Handy das Menü nach einem Klick wieder; es liest nichts aus, speichert nichts und sendet nichts.</p>
<h2>Innovations-Check</h2><p>Der Innovations-Check läuft unter ${e(seite.domain)}/check in unserer eigenen Anwendung auf demselben Server. Zoe ist eine KI-Assistentin; im Check stellt sie die Fragen mit festen Texten, Ihre Antworten gehen an kein KI-Modell. Wir speichern Ihre Antworten, um Ihr Ergebnis zu berechnen, und — nur wenn Sie Kontaktdaten angeben — um Ihnen Ihren Bericht zu senden und ein Gespräch anzubieten (Art. 6 Abs. 1 lit. b DSGVO, vorvertragliche Maßnahmen). Damit Sie später weitermachen können, legt der Check im Speicher Ihres Browsers eine zufällige Kennung ab; sie enthält keine Antworten. Ohne Kontaktdaten löschen wir Ihre Antworten nach 30 Tagen, mit Kontaktdaten spätestens 24 Monate nach dem letzten Kontakt. Vor dem Start sehen Sie dort einen eigenen Datenschutzhinweis.</p>
<h2>Termin buchen</h2><p>Buchen Sie einen Termin, verarbeiten wir Name, E-Mail-Adresse und gegebenenfalls Firma und Anliegen, um den Termin abzustimmen (Art. 6 Abs. 1 lit. b DSGVO). Die Buchungsseite zeigt vor dem Absenden einen eigenen Hinweis.</p>
<h2>Kontakt per E-Mail</h2><p>Schreiben Sie uns an ${e(seite.kontakt.mail)}, verarbeiten wir Ihre Adresse und den Inhalt Ihrer Nachricht, um zu antworten — bei Anfragen zu einem möglichen Vertrag nach Art. 6 Abs. 1 lit. b DSGVO, sonst nach Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die Nachricht, wenn sie erledigt ist, es sei denn, gesetzliche Aufbewahrungspflichten verlangen mehr. Die Postfächer betreibt Google Workspace (Gmail), ein Dienst der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, auf Grundlage eines Auftragsverarbeitungsvertrags. Werden dabei Daten in Länder außerhalb der EU übermittelt, etwa in die USA, ist das über das EU-US Data Privacy Framework beziehungsweise über Standardvertragsklauseln abgesichert.</p>
<h2>Login</h2><p>Der Link „Login“ führt zu app.makeinnovation.de — einem geschlossenen Bereich für Kunden und eingeladene Personen. Dafür gilt der eigene Datenschutzhinweis der Anwendung.</p>
<h2>Weitergabe</h2><p>Wir verkaufen keine Daten und geben sie nicht an Dritte weiter — außer an die oben genannten Dienstleister, die in unserem Auftrag arbeiten. Es gibt keine automatisierten Entscheidungen.</p>
<h2>Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Verarbeiten wir Daten auf Grundlage berechtigter Interessen, können Sie jederzeit widersprechen (Art. 21). Eine Mail an ${e(seite.kontakt.mail)} genügt. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).</p>
<p class="leise">Stand: Oktober 2026</p>
</div></section>`,
  });
  neu('404.html', {
    titel: 'Seite nicht gefunden · MAKE Innovation',
    beschreibung: 'Diese Seite gibt es nicht.',
    main: `<section class="held klein"><div class="w"><span class="eb">404</span><h1>Diese Seite gibt es nicht.</h1><p class="lead">Vielleicht hilft der Weg zurück zur Startseite.</p><div class="knoepfe"><a class="knopf haupt" href="/">Zur Startseite ${PFEIL}</a></div></div></section>`,
  });

  if (seite.indexieren) {
    const urls = seiten.filter((s) => s.pfad !== '404.html').map((s) => `https://${seite.domain}/${s.pfad.replace(/index\.html$/, '')}`);
    seiten.push({ pfad: 'sitemap.xml', html: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${e(u)}</loc></url>`).join('\n')}\n</urlset>\n` });
  }
  return seiten;
}

// ── Schreiben oder prüfen ────────────────────────────────────────────────────────────────────────────────────────────
function lauf() {
  const nurPruefen = process.argv.includes('--pruefen');
  const seiten = seitenBauen();
  let abweichend = 0;
  for (const s of seiten) {
    const ziel = join(ORDNER, s.pfad);
    const alt = existsSync(ziel) ? readFileSync(ziel, 'utf8') : null;
    if (alt === s.html) continue;
    abweichend++;
    if (nurPruefen) { console.log(`weicht ab: ${s.pfad}`); continue; }
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, s.html);
  }
  console.log(nurPruefen ? (abweichend ? `${abweichend} Seiten passen nicht zur Quelle — node makeinnovation/bauen.mjs` : `alle ${seiten.length} Seiten aktuell`) : `${seiten.length} Seiten, ${abweichend} neu geschrieben`);
  if (nurPruefen && abweichend) process.exit(1);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) lauf();
