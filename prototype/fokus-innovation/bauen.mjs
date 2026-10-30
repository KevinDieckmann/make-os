#!/usr/bin/env node
// ─── Fokus Innovation · Website (Prototyp 25.10.2026, dritte Fassung) ─────────────────────────────────────────────────
// Alle Seiten aus EINER Quelle: inhalt/fokus.json (Marke, Leitidee, Bereiche, Abend, Über uns — aus dem Positionierungs-Doc)
// und den Angeboten der bisherigen Website (makeinnovation/inhalt/*.json: Preise, Produktblätter, Fragen). Nie eine Seite von
// Hand ändern — Text in den JSON-Dateien, Aussehen in css/, dann:
//   node prototype/fokus-innovation/bauen.mjs            → schreibt alle Seiten und prüft sie
//   node prototype/fokus-innovation/bauen.mjs --pruefen  → nur prüfen (Ausgang 1 bei Abweichung oder Regelverstoß)
// Regeln: keine Cookies, kein Tracking, keine Formulare, keine fremden Quellen, keine Inline-Skripte oder -Stile (CSP 'self'),
// der Name der eigenen Software und Connect stehen nirgends, Statistiken nur mit Quelle.
// Suche (27.10.): jede Seite trägt Titel, Beschreibung, Canonical, Vorschaubild und strukturierte Daten (JSON-LD, als Datenblock
// erlaubt — kein ausführbares Skript). Dazu sitemap.xml, robots.txt, llms.txt für KI-Suchen und site.webmanifest. Ob Suchmaschinen
// die Seite aufnehmen dürfen, entscheidet EIN Schalter: inhalt/fokus.json › seo.oeffentlich (bis Kevins Freigabe false).
// Vorschaubilder und Icons erzeugt bilder.mjs (braucht Chrome) — nach neuen Seiten oder geänderten Titeln einmal laufen lassen.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORDNER = dirname(fileURLToPath(import.meta.url));
const REPO = join(ORDNER, '..', '..');
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'));
/** Buchungsseite der eigenen Anwendung — dieselbe Form wie BUCHUNG_OFFEN in middleware.ts. */
const BUCHUNG = /^\/buchen\/[a-z0-9-]{1,40}-[a-f0-9]{24}$/;

// ── Hilfen ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Texte der bisherigen Website: Altnamen der Marke ersetzen (der Prüfer meldet jeden Rest). */
const BEGRIFFE = [
  [/aus dem MAKE-Netzwerk/g, 'aus unserem Netzwerk'], [/MAKE-Netzwerk/g, 'Netzwerk'], [/MAKE Innovation/g, 'Fokus Innovation'],
  // Interne Begriffe der Produktblätter in Worte, die Kunden verstehen
  [/Bestandsreaktivierung nach BEAN/g, 'Reaktivierung Ihrer Bestandskunden'], [/Skriptset mit BANT/g, 'Gesprächsleitfäden mit Bedarfsfragen'],
  [/33 gute Gründe/g, '33 Kaufargumente'], [/Security-Call gegen No-Shows/g, 'Erinnerungsanruf gegen ausgefallene Termine'],
  [/Onboarding mit Stempelkarte \(10 Stationen\)/g, 'Einarbeitung in 10 Stationen'], [/Stempelkarte vor dem ersten Live-Call/g, 'Einarbeitung vor dem ersten Live-Call'],
  [/die Stempelkarte abgeschlossen/g, 'die Einarbeitung abgeschlossen'], [/Sektionen/g, 'Abschnitte'], [/ im Hero/g, ' im Startbild'], [/7 Worten/g, '7 Wörtern'],
  // Prüfbericht 27.10.: Fachwörter, die ein Mittelständler nicht kennt, und „gehören“ passt nicht zum einfachen Nutzungsrecht.
  [/Quick Win aus (deinem|Ihrem) Bestand/g, 'ein erster schneller Erfolg aus Ihrem Kundenbestand'], [/ als Quick Win/g, ' als erster schneller Erfolg'], [/\bStages\b/g, 'Stufen'],
  [/mit (\d+ bis \d+) Abschnitte\b/g, 'mit $1 Abschnitten'], [/Video Serie/g, 'Videoserie'],
  [/Gehören Skripte und Playbooks danach mir\?/g, 'Darf ich Skripte und Playbooks danach weiter nutzen?'],
];
/** Preise in Ratgebern und Suchtexten nur als Platzhalter: {preis:id}, {ab:id} (erster Preis einer Staffel), {zusatz:id}. */
let ANGEBOTE = [];
const platz = (s) => String(s ?? '').replace(/\{(preis|ab|zusatz):([a-z0-9-]+)\}/g, (_, art, id) => {
  const a = ANGEBOTE.find((x) => x.id === id);
  if (!a) throw new Error(`Platzhalter ohne Angebot: {${art}:${id}}`);
  if (art === 'zusatz') return a.preis_zusatz ?? '';
  if (art === 'ab') return `${a.preis.replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '')} €`;
  return a.preis;
});
const alt = (s) => BEGRIFFE.reduce((x, [re, neu]) => x.replace(re, neu), platz(s));
/** Anker aus einer Überschrift: „Schritt 4: Wenige Kennzahlen“ → „schritt-4-wenige-kennzahlen“. */
export const slug = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Klartext für Suchtexte und strukturierte Daten (ohne HTML, Platzhalter ersetzt). */
const klar = (s) => alt(s).replace(/\[\[KEVIN: [^\]]*\]\]/g, '').replace(/\s+/g, ' ').trim();
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
  const wissen = lies(join(ORDNER, 'inhalt', 'wissen.json'));
  // Seit 30.10. zeigt der Check als Stufe das Gesamtergebnis über Sichtbarkeit, Vertrieb und Innovation (saeulen_stufen).
  const scoring = lies(join(REPO, 'lib/check/vorlagen/innovations-check/scoring.json'));
  const stufen = scoring.saeulen_stufen ?? scoring.stufen;
  const katalog = lies(join(REPO, 'lib/check/vorlagen/innovations-check/fragenkatalog.json'));
  // Bereich „Kostenlos“ (30.10.): belegte Zahlen und Vorlagen — fehlen die Dateien, entfallen die Teile.
  const zahlenDatei = join(ORDNER, 'inhalt', 'zahlen.json');
  const vorlagenDatei = join(ORDNER, 'inhalt', 'vorlagen.json');
  const zahlen = existsSync(zahlenDatei) ? lies(zahlenDatei) : null;
  const vorlagen = existsSync(vorlagenDatei) ? lies(vorlagenDatei) : null;
  const aus = seite.ausgeblendet ?? {};
  inhalt.angebote = inhalt.angebote.filter((a) => !(aus.angebote ?? []).includes(a.id) && a.id !== 'fokus-innovation');
  inhalt.zusatzoptionen = inhalt.zusatzoptionen.filter((z) => !(aus.zusatzoptionen ?? []).includes(z.name));
  return { inhalt, seite, blaetter, fokus, wissen, stufen, katalog, zahlen, vorlagen };
}

/** Adresse einer Seite im Netz: index.html → /, vertrieb/index.html → /vertrieb/. */
export const webPfad = (pfad) => (pfad === 'index.html' ? '/' : `/${pfad.replace(/index\.html$/, '')}`);
/** Dateiname des Vorschaubilds einer Seite (assets/bild/og/<name>.png). */
export const bildName = (pfad) => (pfad === 'index.html' ? 'start' : pfad.replace(/\/?index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '-'));

// ── Seiten bauen ────────────────────────────────────────────────────────────────────────────────────────────────────
export function seitenBauen(q = quellen()) {
  const { inhalt, seite, blaetter, fokus: F, wissen: W, stufen, katalog, zahlen: Z, vorlagen: VL } = q;
  const K = F.kostenlos;
  ANGEBOTE = [...inhalt.angebote];
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
  /** Die kleinen Checks (30.10.): dieselbe Seite der Anwendung, gewählt über `thema` (lib/check/katalog.ts `VORLAGE_JE_THEMA`). */
  const checkThema = (thema, quelle) => `${seite.check}?thema=${thema}&q=${quelle}`;
  const kleinerCheck = (thema) => K.checks.find((c) => c.thema === thema);
  /** Der Check zu einem Bereich (Ratgeber, 30.10.): Vertrieb/Sichtbarkeit = der kleine Check, Innovation = der Innovations-Check. */
  const checkZuBereich = (bereich, quelle) => {
    const c = kleinerCheck(bereich) ?? K.checks.find((x) => x.haupt);
    return c ? { ...c, href: c.thema ? checkThema(c.thema, quelle) : c.pfad } : null;
  };
  const mail = (betreff) => `mailto:${seite.kontakt.mail}?subject=${encodeURIComponent(betreff)}`;
  const terminLink = (betreff) => (seite.termin.link ? seite.termin.link : mail(`Gespräch: ${betreff}`));
  /** Erstgespräch: die Buchungsseite aus MAKE OS, solange es keine gibt eine vorbereitete Mail mit drei Fragen. */
  // Die Buchungsseite läuft in der eigenen Anwendung (Caddy reicht /buchen/* durch) — nur diese Form, sonst bricht der Bau ab.
  if (seite.termin.link && !BUCHUNG.test(seite.termin.link)) throw new Error(`termin.link muss /buchen/<name>-<24 Hex> sein, ist ${seite.termin.link}`);
  const erstLink = () => seite.termin.link || `mailto:${seite.kontakt.mail}?subject=${encodeURIComponent(F.erstgespraech.betreff)}&body=${encodeURIComponent(F.erstgespraech.mail_text)}`;
  const bald = (a) => a.status === 'Coming Soon';
  const monatlich = (a) => /^pro Monat/.test(a.preis_zusatz ?? '');
  const erster = (a) => `${a.preis.replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '')} €`;
  /** Preise ruhig (Kevin 29.10.): Listen zeigen „ab“, Angebotsseiten und Preisseite den vollen Preis; was erst startet, hat noch keinen. */
  const preisKurz = (a) => (bald(a) ? 'Start in Kürze' : `ab ${erster(a)}${monatlich(a) ? ' / Monat' : ''}`);
  const preisVoll = (a) => (bald(a) ? 'Preis folgt zum Start' : a.preis);
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
  const erstKnopf = (art = '', text = F.erstgespraech.knopf) => knopf(erstLink(), text, art);
  const textlink = (href, text) => `<a class="textlink" href="${href}"><span>${e(text)}</span> ${PFEIL}</a>`;
  const vorzeile = (text, nr) => `<p class="vorzeile${nr ? ' mit-nr' : ''}">${nr ? `<span class="nr">${e(nr)}</span>` : ''}${e(text)}</p>`;
  const zeilen = (s) => (String(s).includes('|') ? String(s).split('|').map((z) => `<span class="zeile">${e(z)}</span>`).join('') : e(s));
  const titel = (haupt, ruhig) => `${zeilen(haupt)}${ruhig ? `<span class="ruhig">${zeilen(ruhig)}</span>` : ''}`;
  const abKopf = ({ marke, nr, h2, ruhig, lead, id }) => `<header class="ab-kopf erscheint"><p class="ab-marke">${nr ? `<span class="nr">${e(nr)}</span>` : ''}${e(marke)}</p><div><h2${id ? ` id="${id}"` : ''}>${titel(h2, ruhig)}</h2>${lead ? `<p class="lead">${t(lead)}</p>` : ''}</div></header>`;
  const punkte = (liste, klasse = 'punkte') => `<ul class="${klasse}">${liste.map((x) => `<li>${t(x)}</li>`).join('')}</ul>`;
  const weg = (stationen, { klasse = '', etiketten = ['Heute', 'Mit uns', 'Danach'], label = 'Der Weg' } = {}) => `<ol class="weg erscheint${klasse ? ` ${klasse}` : ''}" aria-label="${e(label)}">${stationen.map((s, i) => `<li class="station"><span class="etikett">${e(etiketten[i] ?? '')}</span><b>${t(typeof s === 'string' ? s : s.titel)}</b>${typeof s === 'string' || !s.text ? '' : `<span class="station-text">${t(s.text)}</span>`}</li>`).join('')}</ol>`;
  const zahl = (b) => `<figure class="zahl erscheint"><b>${e(b.wert)}</b><figcaption>${e(b.text)}<cite><a href="${e(b.link)}" rel="noopener" target="_blank">${e(b.quelle)}</a></cite></figcaption></figure>`;
  const raster = (liste, n = liste.length) => `<div class="raster n${n} erscheint">${liste.map((x, i) => `<div class="spalte">${x.nr !== false ? `<span class="nr">${String(i + 1).padStart(2, '0')}</span>` : ''}${x.etikett ? `<span class="etikett">${e(x.etikett)}</span>` : ''}<h3>${e(x.titel)}</h3><p>${t(x.text)}</p>${x.unter ? `<p class="spalte-beleg">${t(x.unter)}</p>` : ''}</div>`).join('')}</div>`;
  // Was eine Seite an Fragen und Brotkrumen zeigt, landet auch in ihren strukturierten Daten (neu() liest und leert es).
  let seitenFragen = [];
  let seitenKrumen = null;
  const fragen = (liste, titelText = 'Häufige Fragen', { id = 'fragen', marke = 'Fragen', hinweis = true } = {}) => {
    if (!liste.length) return '';
    seitenFragen.push(...liste);
    return `<section class="abschnitt" id="${id}" aria-labelledby="${id}-titel"><div class="w"><div class="zweispaltig">
<div class="erscheint"><p class="ab-marke">${e(marke)}</p><h2 id="${id}-titel">${e(titelText)}</h2>${hinweis ? `<p class="leise">Noch etwas offen? Schreiben Sie uns an <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p>` : ''}</div>
<div class="fragen erscheint">${liste.map((f) => `<details><summary>${t(f.f)}<span class="plus" aria-hidden="true"></span></summary><p>${t(f.a)}</p></details>`).join('')}</div>
</div></div></section>`;
  };
  const netto = '<p class="netto">Alle Preise netto zuzüglich Umsatzsteuer. Unsere Angebote richten sich an Unternehmen.</p>';
  const brotkrumen = (liste) => {
    seitenKrumen = liste;
    return `<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a>${liste.map(([h, n]) => `<span aria-hidden="true">/</span>${h ? `<a href="${h}">${e(n)}</a>` : `<span aria-current="page">${e(n)}</span>`}`).join('')}</nav>`;
  };
  /** Fakten kompakt, für Menschen und Maschinen: „Auf einen Blick“. */
  const blick = (zeilen, titelText = 'Auf einen Blick') => `<section class="blick-band" aria-label="${e(titelText)}"><div class="w"><dl class="blick erscheint">${zeilen.filter(([, v]) => v).map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl></div></section>`;
  const kurzGesagt = (text) => `<div class="kurz-gesagt erscheint"><p class="etikett">Kurz gesagt</p><p>${t(text)}</p></div>`;
  const zeitplan = (ab) => `<ol class="zeitplan">${ab.zeilen.map((z) => `<li><span class="wann">${e(z[0])}</span><div><b>${e(z[1])}</b>${z[2] ? `<span>${t(z[2])}</span>` : ''}</div></li>`).join('')}</ol>${ab.hinweis ? `<p class="leise klein-text">${t(ab.hinweis)}</p>` : ''}`;
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
    ...(kleinerCheck(b) ? [[checkThema(b, `${b}_menue`), kleinerCheck(b).name, 'kostenlos']] : []),
    ...produkteIn(b).map((a) => [produktPfad(a), F.kurznamen[a.id] ?? a.name, bald(a) ? 'bald' : '']),
  ];
  const NAV = [
    ...BEREICHE.map((b) => ({ key: b, name: F.bereiche[b].name, href: `/${b}/`, unter: navUnter(b) })),
    { key: 'abend', name: 'Abend', href: '/abend/' },
    { key: 'kostenlos', name: 'Kostenlos', href: '/kostenlos/' },
    { key: 'ueber-uns', name: 'Über uns', href: '/ueber-uns/' },
  ];
  const kopf = (aktiv) => `<a class="sprung" href="#inhalt">Zum Inhalt</a>
<header class="kopf"><div class="w kopf-innen">
<a class="marke" href="/" aria-label="Fokus Innovation, zur Startseite">${ZEICHEN()}${WORTBILD}</a>
<nav class="haupt-nav" aria-label="Hauptmenü">${NAV.map((n) => {
    const cur = n.key === aktiv ? ' aria-current="page"' : '';
    if (!n.unter) return `<a href="${n.href}"${cur}>${e(n.name)}</a>`;
    return `<div class="nav-punkt"><a href="${n.href}"${cur}>${e(n.name)}</a><div class="unter"><a class="unter-alles" href="${n.href}">Überblick ${e(n.name)}</a>${n.unter.map(([h, name, p]) => `<a href="${h}">${e(name)}${p ? `<span>${e(p)}</span>` : ''}</a>`).join('')}</div></div>`;
  }).join('')}</nav>
<a class="kopf-kontakt" href="/kontakt/"${aktiv === 'kontakt' ? ' aria-current="page"' : ''}>Kontakt</a>
<a class="knopf klein kopf-check" href="${erstLink()}">${e(F.erstgespraech.name)}</a>
<details class="menue"><summary><span class="striche" aria-hidden="true"></span>Menü</summary><nav class="menue-blatt" aria-label="Menü">
${BEREICHE.map((b) => `<p class="menue-gruppe">${e(F.bereiche[b].name)}</p><a href="/${b}/">Überblick ${e(F.bereiche[b].name)}</a>${navUnter(b).map(([h, name]) => `<a href="${h}">${e(name)}</a>`).join('')}`).join('\n')}
<p class="menue-gruppe">Fokus Innovation</p><a href="/abend/">Abend</a><a href="/kostenlos/">Kostenlos</a><a href="/preise/">Preise</a><a href="/ueber-uns/">Über uns</a><a href="/kontakt/">Kontakt</a>
${erstKnopf()}<a class="textlink menue-check" href="${check('menue')}"><span>Oder: Innovations-Check, 10 Minuten</span> ${PFEIL}</a>
</nav></details>
</div></header>`;

  const fussSpalte = (titelText, links) => `<div><p class="fuss-titel">${e(titelText)}</p><ul>${links.map(([h, n]) => `<li><a href="${h}">${e(n)}</a></li>`).join('')}</ul></div>`;
  const fuss = () => `<footer class="fuss"><div class="w">
<div class="fuss-raster">
<div class="fuss-marke"><a class="marke" href="/" aria-label="Fokus Innovation, zur Startseite">${ZEICHEN()}${WORTBILD}</a><p class="claim">${e(F.marke.claim)}</p>
<p><a href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a><br>${seite.kontakt.adresse.map(t).join('<br>')}</p></div>
${fussSpalte('Leistungen', [...BEREICHE.map((b) => [`/${b}/`, F.bereiche[b].name]), ['/innovations-check/', 'Innovations-Check'], ['/preise/', 'Preise']])}
${fussSpalte('Kostenlos', [['/kostenlos/#checks', 'Checks'], ['/kostenlos/#ratgeber', 'Ratgeber'], ...(Z ? [['/kostenlos/zahlen/', 'Zahlen']] : []), ...(VL ? [['/kostenlos/#vorlagen', 'Vorlagen']] : []), ['/fragen/', 'Häufige Fragen'], ['/begriffe/', 'Begriffe']])}
${fussSpalte('Fokus Innovation', [['/abend/', 'Abend'], ['/ueber-uns/', 'Über uns'], ['/kontakt/', 'Kontakt'], ['/impressum/', 'Impressum'], ['/datenschutz/', 'Datenschutz']])}
</div>
<div class="fuss-unten"><span>© 2026 ${e(anbieter.name)} · ${e(F.marke.name)} ist eine Marke der ${e(anbieter.name)}</span><span>Keine Cookies, kein Tracking. Alle Preise netto zuzüglich Umsatzsteuer, für Unternehmen.</span></div>
</div></footer>`;

  // ── Suche: Adressen, Organisation und strukturierte Daten (schema.org, eine @graph je Seite) ──
  const SEO = F.seo;
  const BASIS = `https://${F.domain}`;
  const absolut = (p) => `${BASIS}${p}`;
  const ORG = `${BASIS}/#organisation`;
  const SITE = `${BASIS}/#website`;
  const personAnker = (p) => slug(p.name);
  const personId = (p) => `${BASIS}/ueber-uns/#${personAnker(p)}`;
  const [strasse, ort] = seite.kontakt.adresse;
  const organisation = {
    '@type': 'ProfessionalService', '@id': ORG, name: F.marke.name, legalName: anbieter.name, url: `${BASIS}/`,
    description: klar(F.marke.beschreibung), slogan: F.marke.claim,
    logo: { '@type': 'ImageObject', '@id': `${BASIS}/#logo`, url: absolut('/assets/bild/logo.png'), width: 512, height: 512, caption: F.marke.name },
    image: absolut('/assets/bild/og/start.png'),
    email: seite.kontakt.mail,
    address: { '@type': 'PostalAddress', streetAddress: klar(strasse), postalCode: klar(ort).split(' ')[0], addressLocality: klar(ort).split(' ').slice(1).join(' '), addressCountry: 'DE' },
    areaServed: [{ '@type': 'Country', name: 'Deutschland' }, { '@type': 'Place', name: 'Europa' }],
    knowsAbout: SEO.wissen_gebiete,
    founder: F.team.map((p) => ({ '@id': personId(p) })),
    contactPoint: { '@type': 'ContactPoint', contactType: 'Anfragen', email: seite.kontakt.mail, availableLanguage: ['de'] },
    ...(SEO.same_as.length ? { sameAs: SEO.same_as } : {}),
  };
  const personen = F.team.map((p) => ({ '@type': 'Person', '@id': personId(p), name: p.name, jobTitle: p.rolle, description: klar(p.text), worksFor: { '@id': ORG }, url: personId(p) }));
  const webseite = { '@type': 'WebSite', '@id': SITE, url: `${BASIS}/`, name: F.marke.name, description: klar(F.marke.beschreibung), inLanguage: 'de-DE', publisher: { '@id': ORG } };
  /** Preis eines Angebots als Angebot nach schema.org (netto, Euro, monatlich wo „pro Monat“). */
  const angebotDaten = (a) => {
    const url = absolut(produktPfad(a));
    const monat = /^pro Monat/.test(a.preis_zusatz ?? '');
    const basis = { '@type': 'Offer', url, priceCurrency: 'EUR', availability: bald(a) ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock', eligibleCustomerType: 'https://schema.org/Business', seller: { '@id': ORG } };
    const spez = (preis, extra = {}) => ({ '@type': monat ? 'UnitPriceSpecification' : 'PriceSpecification', priceCurrency: 'EUR', valueAddedTaxIncluded: false, ...(monat ? { unitCode: 'MON', unitText: 'Monat' } : {}), ...preis, ...extra });
    const zahl = (s) => String(Number(String(s).replace(/[^\d]/g, '')));
    if (a.stufen) return a.stufen.map((s) => ({ ...basis, name: `${a.name.replace(/ S, M, L$/, '')} ${s.name}`, price: zahl(s.preis), priceSpecification: spez({ price: zahl(s.preis) }) }));
    if (/^ab /.test(a.preis)) return { ...basis, name: a.name, priceSpecification: spez({ minPrice: zahl(a.preis) }) };
    return { ...basis, name: a.name, price: zahl(a.preis), priceSpecification: spez({ price: zahl(a.preis) }) };
  };

  const rahmen = ({ pfad, titel: titelText, beschreibung, aktiv = '', main, film = false, klasse = '', schema = [], seitenTyp = 'WebPage', artikel = null, fragenListe = [], krumen = null }) => {
    const ohneSuche = pfad === '404.html';
    const url = absolut(webPfad(pfad));
    const bild = absolut(`/assets/bild/og/${bildName(pfad)}.png`);
    const geaendert = artikel?.aktualisiert ?? SEO.stand;
    const graph = [organisation, ...personen, webseite];
    if (!ohneSuche) {
      graph.push({ '@type': seitenTyp, '@id': `${url}#webseite`, url, name: titelText, description: beschreibung, isPartOf: { '@id': SITE }, about: { '@id': ORG }, inLanguage: 'de-DE', dateModified: geaendert, primaryImageOfPage: { '@type': 'ImageObject', url: bild, width: 1200, height: 630 }, ...(krumen ? { breadcrumb: { '@id': `${url}#brotkrumen` } } : {}) });
      if (krumen) graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#brotkrumen`, itemListElement: [['/', 'Start'], ...krumen].map(([h, n], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: h ? absolut(h) : url })) });
      const gesehen = new Set();
      const fragenEinmal = fragenListe.filter((f) => { const k = klar(f.f); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
      if (fragenEinmal.length) graph.push({ '@type': 'FAQPage', '@id': `${url}#fragen-liste`, isPartOf: { '@id': `${url}#webseite` }, inLanguage: 'de-DE', mainEntity: fragenEinmal.map((f) => ({ '@type': 'Question', name: klar(f.f), acceptedAnswer: { '@type': 'Answer', text: klar(f.a) } })) });
      graph.push(...schema);
    }
    const ldJson = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
    const robots = ohneSuche || !SEO.oeffentlich ? 'noindex' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    const suche = ohneSuche ? '' : `<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<meta property="og:type" content="${artikel ? 'article' : 'website'}">
<meta property="og:site_name" content="${e(F.marke.name)}">
<meta property="og:locale" content="de_DE">
<meta property="og:title" content="${e(titelText)}">
<meta property="og:description" content="${e(beschreibung)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${bild}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(titelText)}">
<meta name="twitter:card" content="summary_large_image">
${artikel ? `<meta property="article:published_time" content="${artikel.veroeffentlicht}">\n<meta property="article:modified_time" content="${artikel.aktualisiert}">\n<meta name="author" content="${e(artikel.autor)}">\n` : ''}`;
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titelText)}</title>
<meta name="description" content="${e(beschreibung)}">
<meta name="robots" content="${robots}">
${suche}<meta name="theme-color" content="${film ? '#0B0C0F' : '#F6F4F0'}">
<link rel="icon" href="/assets/zeichen.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/assets/bild/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/schriften/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/fokus.css?v=${stempel('css/fokus.css')}">
${film ? `<link rel="stylesheet" href="/css/film.css?v=${stempel('css/film.css')}">\n` : ''}<script src="/js/frueh.js?v=${stempel('js/frueh.js')}"></script>
<script src="/js/seite.js?v=${stempel('js/seite.js')}" defer></script>
${film ? `<script type="module" src="/js/film.js?v=${stempel('js/film.js')}"></script>\n` : ''}${main.includes('data-rechner') ? `<script src="/js/rechner.js?v=${stempel('js/rechner.js')}" defer></script>\n` : ''}<script type="application/ld+json">${ldJson}</script>
</head>
<body${klasse ? ` class="${klasse}"` : ''}>
${kopf(aktiv)}
<main id="inhalt">
${main}
</main>
${fuss()}
</body>
</html>
`;
  };

  /** Der dunkle Schlussakt: eine Frage, ein Satz, der Einstieg in drei Schritten, zwei Knöpfe. */
  const schlussakt = ({ quelle, h2 = 'Bereit für den nächsten Schritt?', lead = 'Im kostenlosen Erstgespräch klären wir, ob und womit wir helfen können. Oder Sie starten mit dem Innovations-Check: rund 10 Minuten, Ergebnis sofort.', knoepfe, stufen = F.einstieg }) => `<section class="schlussakt dunkel" aria-labelledby="schluss-titel"><div class="w">
<div class="schluss-kopf erscheint">${ZEICHEN('zeichen schluss-zeichen')}<p class="vorzeile">Der Einstieg</p><h2 id="schluss-titel">${e(h2)}</h2><p class="lead">${t(lead)}</p>
<div class="knoepfe">${knoepfe ?? `${erstKnopf()}${checkKnopf(quelle, 'Innovations-Check starten', 'zweit')}`}</div></div>
${weg(stufen, { klasse: 'einstieg', etiketten: ['01', '02', '03'], label: 'Der Einstieg in drei Schritten' })}
</div></section>`;

  const seiten = [];
  /** Eine Seite anlegen. Titel und Beschreibung kommen aus fokus.json › seo.seiten[seo] (oder direkt, bei Ratgebern). */
  const neu = (pfad, s) => {
    const vorgabe = s.seo ? SEO.seiten[s.seo] : null;
    if (s.seo && !vorgabe) throw new Error(`seo.seiten.${s.seo} fehlt in fokus.json`);
    const titelText = klar(vorgabe?.titel ?? s.titel);
    const beschreibung = klar(vorgabe?.beschreibung ?? s.beschreibung);
    const html = rahmen({ ...s, pfad, titel: titelText, beschreibung, fragenListe: seitenFragen, krumen: seitenKrumen });
    seitenFragen = [];
    seitenKrumen = null;
    seiten.push({
      pfad, html, titel: titelText, beschreibung,
      geaendert: s.artikel?.aktualisiert ?? SEO.stand,
      bild: pfad === '404.html' ? null : { datei: `assets/bild/og/${bildName(pfad)}.png`, titel: s.bildTitel ?? titelText.replace(/ · Fokus Innovation$/, ''), vorzeile: s.bildVorzeile ?? F.marke.name },
    });
  };
  const B = F.bereiche;

  // ── Wissen: Ratgeber und Begriffe ──
  const artikelPfad = (a) => `/wissen/${a.id}/`;
  const artikelText = (a) => [a.kurz, ...a.abschnitte.flatMap((x) => [x.h, ...(x.absaetze ?? []), ...(x.punkte ?? []), ...(x.absaetze_danach ?? []), ...(x.schritte ?? []).flatMap((s) => [s.titel, s.text]), ...(x.tabelle?.zeilen.flat() ?? [])])].join(' ');
  const lesezeit = (a) => Math.max(2, Math.ceil(klar(artikelText(a)).split(/\s+/).length / 200));
  const wissenListe = (liste) => `<ul class="wissen-liste erscheint">${liste.map((a) => `<li><a href="${artikelPfad(a)}"><span class="etikett">${e(B[a.bereich].name)} · ${lesezeit(a)} Minuten</span><h3>${e(a.titel)}</h3><p>${t(a.beschreibung)}</p><span class="textlink"><span>Lesen</span> ${PFEIL}</span></a></li>`).join('')}</ul>`;
  const artikelZu = (bedingung) => W.artikel.filter(bedingung);
  const wissenAbschnitt = (liste, h2 = 'Wissen zum Thema') => (liste.length ? `<section class="abschnitt" aria-labelledby="wissen-titel"><div class="w">${abKopf({ marke: 'Wissen', h2, id: 'wissen-titel' })}${wissenListe(liste)}</div></section>` : '');
  /** Vergleichstabelle der Produktblätter (Homepages, Videos): Kopf mit Links und Preisen, auf dem Handy als Karten. */
  const vergleichTabelle = (v) => {
    const liste = v.angebote.map(angebot).filter(Boolean);
    const kurzName = (a) => a.name.replace(/^Homepage /, '');
    return `<h3 class="gruppe-titel">${e(v.titel)}</h3><div class="tabelle-huelle erscheint"><table class="vergleich text"><thead><tr><th scope="col"><span class="sr">Merkmal</span></th>${liste.map((a) => `<th scope="col"><a href="${produktPfad(a)}">${e(kurzName(a))}</a><span class="zahl-klein">${e(preisKurz(a))}</span></th>`).join('')}</tr></thead>
<tbody>${v.zeilen.map(([m, ...w]) => `<tr><th scope="row">${e(alt(m))}</th>${w.map((x, n) => `<td data-name="${e(liste[n] ? kurzName(liste[n]) : '')}">${t(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const angebotZeilen = (liste) => `<ul class="zeilen erscheint">${liste.map((x) => `<li><a href="${produktPfad(x)}"><span class="z-name">${e(x.name)}${bald(x) ? ' <span class="marke-bald">Bald</span>' : ''}</span><span class="z-text">${t(F.kurztexte[x.id] ?? produktBlatt(x)?.versprechen ?? x.fuer_wen ?? (x.enthalten ?? [])[0] ?? '')}</span><span class="z-preis">${e(preisKurz(x))}</span>${PFEIL}</a></li>`).join('')}</ul>`;
  // ── Bausteine für Vertrauen (29.10.): Arbeitsprobe, Muster, Risiko, Rechner ──
  const arbeitsprobe = () => `<section class="abschnitt" aria-labelledby="probe-titel"><div class="w"><div class="kasten probe-kasten erscheint"><div>${vorzeile('Arbeitsprobe')}<h2 id="probe-titel">${e(F.arbeitsprobe.titel)}</h2><p class="lead">${t(F.arbeitsprobe.text)}</p></div><div>${punkte(F.arbeitsprobe.punkte)}<div class="knoepfe">${textlink('/', 'Zur Startseite mit dem Film')}</div></div></div></div></section>`;
  const musterPositionierung = () => {
    const M = F.muster_positionierung;
    return `<section class="abschnitt" aria-labelledby="muster-titel"><div class="w">${abKopf({ marke: 'Muster', h2: M.titel, lead: M.lead, id: 'muster-titel' })}
<figure class="muster-blatt erscheint"><figcaption><span class="etikett">Positionierung S · Fokus Innovation</span><span class="leise">eigenes Beispiel</span></figcaption>
<dl class="daten">${M.saetze.map(([x, v]) => `<div><dt>${e(x)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl>
<div class="muster-kurz"><div><span class="etikett">In einem Satz</span><p>${e(M.ein_satz)}</p></div><div><span class="etikett">In sieben Wörtern</span><p>${e(M.sieben_woerter)}</p></div><div><span class="etikett">Claim</span><p>${e(M.claim)}</p></div></div></figure></div></section>`;
  };
  const wochenreportMuster = () => {
    const R = F.wochenreport_muster;
    return `<section class="abschnitt" aria-labelledby="bericht-titel"><div class="w">${abKopf({ marke: 'Muster', h2: R.titel, lead: R.hinweis, id: 'bericht-titel' })}
<figure class="muster-blatt bericht erscheint"><figcaption><span class="etikett">Wochenreport · ${e(R.woche)}</span><span class="leise">Beispielwerte, kein Kunde</span></figcaption>
<table class="bericht-tabelle"><thead><tr><th scope="col">Kennzahl</th><th scope="col">Ist</th><th scope="col">Ziel</th><th scope="col"><span class="sr">Stand</span></th></tr></thead><tbody>${R.zeilen.map(([n, ist, ziel]) => `<tr><th scope="row">${e(n)}</th><td>${e(ist)}</td><td>${e(ziel)}</td><td><meter min="0" max="${Math.max(Number(ist), Number(ziel))}" low="${Number(ziel) * 0.8}" optimum="${Math.max(Number(ist), Number(ziel))}" value="${e(ist)}">${e(ist)} von ${e(ziel)}</meter></td></tr>`).join('')}</tbody></table>
<p class="bericht-satz">${t(R.satz)}</p></figure></div></section>`;
  };
  const risiko = () => `<section class="abschnitt eng" aria-labelledby="risiko-titel"><div class="w"><div class="risiko erscheint"><h2 class="gruppe-titel" id="risiko-titel">${e(F.risiko.titel)}</h2>${punkte(F.risiko.punkte)}</div></div></section>`;
  /** Rückwärtsrechnung vom Umsatzziel. Dieselbe Rechnung steht in js/rechner.js; ohne JavaScript zeigt die Seite das Beispiel. */
  const rueckwaerts = ({ ziel, auftrag, angebotsquote, terminquote, wochen }) => {
    const abschluesse = Math.ceil(ziel / auftrag);
    const angebote = Math.ceil(abschluesse / (angebotsquote / 100));
    const termine = Math.ceil(angebote / (terminquote / 100));
    return { abschluesse, angebote, termine, woche: (termine / wochen).toLocaleString('de-DE', { maximumFractionDigits: 1 }) };
  };
  const RECHNER_START = { ziel: 240000, auftrag: 8000, angebotsquote: 33, terminquote: 50, wochen: 45 };
  const rechner = () => {
    const r = rueckwaerts(RECHNER_START);
    const feld = (id, text, schritt, einheit) => `<label class="rechner-feld"><span>${e(text)}</span><span class="rechner-eingabe"><input type="number" inputmode="numeric" min="1" step="${schritt}" value="${RECHNER_START[id]}" data-feld="${id}"><span class="einheit">${e(einheit)}</span></span></label>`;
    return `<section class="abschnitt" id="rechner" aria-labelledby="rechner-titel"><div class="w">${abKopf({ marke: 'Vertriebsrechner', h2: F.rechner.titel, lead: F.rechner.lead, id: 'rechner-titel' })}
<div class="rechner erscheint" data-rechner>
<div class="rechner-eingaben">${feld('ziel', 'Umsatzziel im Jahr', 1000, '€')}${feld('auftrag', 'Durchschnittlicher Auftrag', 500, '€')}${feld('angebotsquote', 'Angebote, die zum Auftrag werden', 1, '%')}${feld('terminquote', 'Termine, aus denen ein Angebot wird', 1, '%')}${feld('wochen', 'Arbeitswochen im Jahr', 1, 'Wochen')}</div>
<dl class="rechner-ergebnis" aria-live="polite"><div><dt>Abschlüsse im Jahr</dt><dd data-aus="abschluesse">${r.abschluesse.toLocaleString('de-DE')}</dd></div><div><dt>Angebote im Jahr</dt><dd data-aus="angebote">${r.angebote.toLocaleString('de-DE')}</dd></div><div><dt>Termine im Jahr</dt><dd data-aus="termine">${r.termine.toLocaleString('de-DE')}</dd></div><div class="haupt"><dt>Termine je Woche</dt><dd data-aus="woche">${r.woche}</dd></div></dl>
</div>
<p class="satz-unter erscheint">Die Startwerte sind ein Beispiel. Ihre eigenen Quoten kennen Sie nach einigen Wochen mit sauberen Zahlen im CRM. ${textlink('/wissen/vertrieb-aufbauen/', 'Mehr im Ratgeber Vertrieb aufbauen')}</p>
</div></section>`;
  };
  const itemListe = (name, eintraege) => ({ '@type': 'ItemList', name, numberOfItems: eintraege.length, itemListElement: eintraege.map(([url, n], i) => ({ '@type': 'ListItem', position: i + 1, url: absolut(url), name: n })) });

  // ── Startseite: der Film (kurz, mit „Überspringen“), dann der Einstieg mit zwei Türen und ruhige Abschnitte auf Papier ──
  {
    const fl = F.film;
    const block = (name, b, extra = '') => `<div class="block" data-block="${name}" aria-hidden="true"><div class="film-text"><p class="film-titel">${b.titel.split("|").map((z) => `<span class="zeile" data-woerter>${e(z)}</span>`).join("")}</p><p class="film-satz">${e(b.satz)}</p></div>${extra}</div>`;
    const kurz = {
      sichtbarkeit: gruppenIn('sichtbarkeit').map((g) => [`/sichtbarkeit/#${anker(g.name || g.liste[0].name)}`, g.name === 'Homepage-Pakete' ? 'Website' : g.name || g.liste[0].name]),
      vertrieb: produkteIn('vertrieb').map((a) => [produktPfad(a), a.id === 'tagesworkshop' ? 'Tagesworkshop' : a.name.replace(/ \(CSO\)$/, '')]),
      innovation: [['/innovations-check/', 'Innovations-Check'], ...produkteIn('innovation').map((a) => [produktPfad(a), 'Umsetzungsprojekte (bald)'])],
    };
    const leistung = (k) => {
      const b = B[k];
      const rechts = k === 'innovation'
        ? `<ul class="felder-kurz erscheint">${b.felder.map((f) => `<li><b>${e(f.titel)}</b><span>${t(f.text)}</span></li>`).join('')}</ul>`
        : `${weg(b.weg)}${b.beleg && k === 'vertrieb' ? zahl(F.belege[b.beleg]) : ''}`;
      return `<article class="leistung" id="bereich-${k}">
<div class="leistung-kopf erscheint">${vorzeile(b.name, b.nr)}<h3 class="paar">${e(b.paar)}</h3><p class="satz">${t(b.satz)}</p>${textlink(`/${k}/`, `Mehr zu ${b.name}`)}</div>
<div class="leistung-weg"><p class="etikett erscheint">Woran es oft hakt</p><p class="problem erscheint">${t(b.problem)}</p>${rechts}
<p class="angebote-kurz erscheint"><span class="etikett">Angebote</span>${kurz[k].map(([h, n]) => `<a href="${h}">${e(n)}</a>`).join('<span aria-hidden="true">·</span>')}</p></div>
</article>`;
    };
    /** Eine Zeile des Wegweisers: Lage links, passender Einstieg rechts (mit Preis „ab“, wo es einen gibt). */
    const wegZeile = (z) => {
      const a = z.angebot ? angebot(z.angebot) : null;
      const [h, n, p] = a ? [produktPfad(a), F.kurznamen[a.id] ?? a.name.replace(/ S, M, L$/, ''), preisKurz(a)] : [z.ziel, z.name, z.preis];
      return `<li><a href="${h}"><span class="wl-lage">${t(z.lage)}</span><span class="wl-ziel"><b>${e(n)}</b><span>${e(p)}</span></span>${PFEIL}</a></li>`;
    };
    const ww = F.wegweiser;
    neu('index.html', {
      seo: 'start',
      bildTitel: F.start.titel,
      bildVorzeile: 'Vertrieb · Sichtbarkeit · Innovation',
      film: true,
      klasse: 'start',
      main: `<section class="film" id="start" aria-label="${e(F.marke.claim)}">
<div class="buehne">
<canvas class="szene" aria-hidden="true"></canvas>
<div class="ersatz" aria-hidden="true">${ZEICHEN('zeichen gross')}</div>
<p class="sr">${[fl.laerm, fl.fokus, fl.luecke, fl.momentum, fl.durchbruch].map((b) => `${e(b.titel.replace(/\|/g, " "))} ${e(b.satz)}`).join(' ')}</p>
<div class="aufgaben" aria-hidden="true">${F.aufgaben.map((x) => `<span class="aufgabe">${e(x)}</span>`).join('')}</div>
${block('laerm', fl.laerm, `<p class="film-marke">${e(fl.marke)}</p><span class="hinweis" aria-hidden="true">Scrollen<span class="hinweis-strich"></span></span>`)}
${block('fokus', fl.fokus)}
${block('luecke', fl.luecke)}
${block('momentum', fl.momentum)}
${block('durchbruch', fl.durchbruch)}
<div class="block" data-block="ende" aria-hidden="true"><div class="ende-marke"><span class="ende-wort">FOKUS</span><span class="ende-unter">Innovation</span><span class="ende-claim">${e(F.marke.claim)}</span></div></div>
<a class="ueberspringen" href="#einstieg">Film überspringen</a>
</div>
</section>

<section class="held start-held" id="einstieg" aria-labelledby="start-titel"><div class="w held-raster">
<div class="start-titel erscheint">${vorzeile(F.start.vorzeile)}<h1 id="start-titel">${titel(F.start.titel, F.start.ruhig)}</h1></div>
<div class="erscheint"><p class="lead">${t(F.start.lead)}</p>
<div class="knoepfe">${erstKnopf()}${checkKnopf('start_held', 'Innovations-Check, 10 Minuten', 'zweit')}</div></div>
<nav class="index tueren erscheint" aria-label="Ihr Anliegen">${F.tueren.map((d) => `<a href="#${d.id}"><span class="nr">${e(d.etikett)}</span><b>${e(d.titel)}</b><span class="index-satz">${t(d.text)}</span>${PFEIL}</a>`).join('')}</nav>
</div></section>

<section class="abschnitt" id="bekannt" aria-labelledby="bekannt-titel"><div class="w">
${abKopf({ marke: 'Ihr Alltag', h2: F.bekannt.titel, lead: F.bekannt.lead, id: 'bekannt-titel' })}
<ul class="momente erscheint">${F.bekannt.momente.map((m) => `<li>${t(m)}</li>`).join('')}</ul>
<div class="momente-schluss erscheint"><p>${t(F.bekannt.schluss)}</p>${erstKnopf()}</div>
</div></section>

<section class="abschnitt" id="was-wir-tun" aria-labelledby="leistungen-titel"><div class="w">
${abKopf({ marke: 'Was wir tun', h2: 'Drei Bereiche.', ruhig: 'Und in jedem arbeiten wir selbst mit.', lead: 'Sichtbarkeit, Vertrieb und Innovation tragen die Arbeit. Dazu kommen unser Netzwerk und unsere Abende.', id: 'leistungen-titel' })}
${BEREICHE.map(leistung).join('\n')}
</div></section>

<section class="abschnitt" id="wegweiser" aria-labelledby="wegweiser-titel"><div class="w">
${abKopf({ marke: 'Wegweiser', h2: ww.titel, lead: ww.lead, id: 'wegweiser-titel' })}
<div class="wegweiser">
<div class="erscheint" id="markt"><h3 class="gruppe-titel">${e(F.tueren[0].etikett)}</h3><ul class="wl">${ww.markt.map(wegZeile).join('')}</ul></div>
<div class="erscheint" id="unternehmen"><h3 class="gruppe-titel">${e(F.tueren[1].etikett)}</h3><ul class="wl">${ww.unternehmen.map(wegZeile).join('')}</ul></div>
</div>
<p class="satz-unter erscheint">Nichts dabei? ${textlink(erstLink(), 'Erzählen Sie uns im Erstgespräch, worum es geht')}</p>
</div></section>

<section class="abschnitt" id="warum-wir" aria-labelledby="warum-titel"><div class="w">
${abKopf({ marke: 'Warum wir', h2: 'Wir arbeiten in Ihrem Team, nicht daneben.', lead: 'Vier Unterschiede, an denen Sie uns messen können. Jeder mit einem Beleg.', id: 'warum-titel' })}
<dl class="zahlen erscheint">${F.zahlen.map((z) => `<div><dt>${e(z.text)}</dt><dd>${e(z.wert)}</dd></div>`).join('')}</dl>
${raster(F.warum_wir.map((w) => ({ titel: w.titel, text: w.text, unter: w.beleg })), 4)}
</div></section>

${fragen(F.einwaende, 'Ehrliche Antworten', { id: 'einwaende', marke: 'Bevor Sie fragen' })}

<section class="abschnitt" id="abend" aria-labelledby="abend-titel"><div class="w">
<div class="kasten abend-kasten">
<div class="erscheint">${vorzeile(F.abend.titel)}<h2 id="abend-titel">${titel('Ein Abend.|Ein langer Tisch.', 'Menschen, die Neues umsetzen.')}</h2>${tafel()}</div>
<div class="erscheint"><p class="lead">${t(F.abend.text)}</p><p class="leise">${t(F.abend.termine)}</p>
<div class="knoepfe">${knopf(mail(F.abend.betreff), 'Auf die Gästeliste')}${textlink('/abend/', 'Mehr zum Abend')}</div></div>
</div>
</div></section>

<section class="abschnitt" id="wissen" aria-labelledby="wissen-titel"><div class="w">
${abKopf({ marke: 'Wissen', h2: 'Aus unserer Arbeit.', ruhig: 'Zum Nachlesen.', lead: 'Ratgeber zu Vertrieb, Sichtbarkeit und Innovation: wie wir vorgehen, worauf es ankommt, mit Quellen.', id: 'wissen-titel' })}
${wissenListe(W.artikel.slice(0, 3))}
<div class="knoepfe erscheint">${textlink('/kostenlos/#ratgeber', 'Alle Ratgeber')}${textlink('/preise/', 'Alle Preise')}</div>
</div></section>

${schlussakt({ quelle: 'start_ende' })}`,
    });
  }

  // ── Bereichsseiten ──
  for (const k of BEREICHE) {
    const b = B[k];
    const gruppen = gruppenIn(k);
    const klein = kleinerCheck(k);
    const checkZeile = k === 'innovation' ? `<li><a href="/innovations-check/"><span class="z-name">Innovations-Check</span><span class="z-text">In rund 10 Minuten sehen Sie, wo Ihr Unternehmen steht.</span><span class="z-preis">kostenlos</span>${PFEIL}</a></li>`
      : klein ? `<li><a href="${checkThema(k, `${k}_angebote`)}"><span class="z-name">${e(klein.name)}</span><span class="z-text">${e(klein.text)}</span><span class="z-preis">kostenlos · ${klein.minuten} Min.</span>${PFEIL}</a></li>` : '';
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
${blaetter.vergleiche[k].map(vergleichTabelle).join('\n')}${netto}</div></section>` : '';

    const eigenes = {
      sichtbarkeit: () => `${arbeitsprobe()}
<section class="abschnitt" aria-labelledby="zusatz-titel"><div class="w">${abKopf({ marke: 'Dazu', h2: 'Zusatzoptionen und Netzwerk', id: 'zusatz-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Dazu buchbar</h3><dl class="daten">${inhalt.zusatzoptionen.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.name === 'Express' ? 'halbe Lieferzeit' : z.leistung)}</span></dt><dd>${e(z.preis)}</dd></div>`).join('')}</dl></div>
<div class="erscheint"><h3 class="gruppe-titel">${e(b.auch.titel)}</h3><p>${t(b.auch.text)}</p><div class="knoepfe">${textlink('/abend/', 'Zum Abend')}</div></div></div></div></section>`,
      vertrieb: () => `<section class="abschnitt" aria-labelledby="leiter-titel"><div class="w"><div class="kasten leiter-kasten erscheint"><div>${vorzeile('Für den Mittelstand')}<h2 id="leiter-titel">${e(b.leiter.titel)}</h2></div><div><p class="lead">${t(b.leiter.text)}</p><div class="knoepfe">${textlink(produktPfad(angebot('head-of-sales')), 'Head of Sales auf Zeit')}${textlink(erstLink(), 'Erstgespräch vereinbaren')}</div></div></div></div></section>

${rechner()}

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Ablauf', h2: 'So kommen wir zusammen', lead: 'Vom ersten Gespräch bis zum Mandat, jeder Schritt mit klarem Ergebnis.', id: 'ablauf-titel' })}
${weg(b.ablauf, { klasse: 'vier', etiketten: ['01', '02', '03', '04'], label: 'Ablauf bis zum Mandat' })}</div></section>`,
      innovation: () => `<section class="abschnitt" aria-labelledby="felder-titel"><div class="w">${abKopf({ marke: 'Was dazugehört', h2: 'Innovation ist mehr als KI.', lead: b.mehr_als_ki, id: 'felder-titel' })}
${raster(b.felder, 4)}
<div class="zwei-teile belege-paar">${zahl(F.belege.roboter)}${zahl(F.belege.daten)}</div></div></section>

<section class="abschnitt" aria-labelledby="check-titel"><div class="w">${abKopf({ marke: 'Innovations-Check', h2: start['innovations-check'].titel, lead: F.check.text, id: 'check-titel' })}
<ol class="stufen breit erscheint" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><span class="stufe-balken" aria-hidden="true"></span><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></li>`).join('')}</ol>
<div class="zwei-teile check-unten"><div class="erscheint">${punkte(seite.check_punkte.punkte)}</div><div class="erscheint"><div class="knoepfe">${checkKnopf('innovation_check')}${textlink('/innovations-check/', 'So funktioniert der Check')}</div></div></div></div></section>

<section class="abschnitt" id="ki-brain" aria-label="KI-Brain"><div class="w">
<div class="kasten brain-kasten erscheint"><div>${vorzeile(b.brain.stand)}<h3>${e(b.brain.titel)}</h3></div><div><p>${t(b.brain.text)}</p><div class="knoepfe">${knopf(mail(b.brain.betreff), 'Interesse anmelden', 'zweit')}</div></div></div>
</div></section>`,
    }[k]();

    const knoepfe = k === 'innovation'
      ? `${erstKnopf()}${checkKnopf(`${k}_held`, 'Innovations-Check starten', 'zweit')}`
      : `${erstKnopf()}${knopf('#angebote', 'Angebote ansehen', 'zweit')}`;

    const liste = produkteIn(k);
    const fuerWen = F.fuer_wen.filter((w) => new RegExp(b.name).test(w.einstieg)).map((w) => w.titel).join(', ');
    const preiseAb = liste.filter((a) => !bald(a)).map((a) => `${F.kurznamen[a.id] ?? a.name.replace(/ S, M, L$/, '')} ${preisKurz(a)}`).join(' · ');
    neu(`${k}/index.html`, {
      seo: k,
      bildVorzeile: `${b.nr} · ${b.name}`,
      bildTitel: b.held.titel,
      aktiv: k,
      seitenTyp: 'CollectionPage',
      schema: [{ ...itemListe(`Angebote im Bereich ${b.name}`, [...(k === 'innovation' ? [['/innovations-check/', 'Innovations-Check']] : []), ...liste.map((a) => [produktPfad(a), a.name])]), '@id': `${absolut(`/${k}/`)}#angebote` }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, b.name]])}${vorzeile(b.name, b.nr)}<h1 id="held-titel">${e(b.held.titel)}</h1><p class="lead">${t(b.held.text)}</p><div class="knoepfe">${knoepfe}</div></div>
<aside class="weg-karte erscheint" aria-label="Der Weg"><p class="etikett">Der Weg mit uns</p>${weg(b.weg, { klasse: 'senkrecht' })}</aside>
</div></section>

<section class="blick-band" aria-label="Kurz gesagt"><div class="w">${kurzGesagt(b.kurz)}
<dl class="blick erscheint">${[['Für wen', fuerWen], ['Angebote', preiseAb || 'Start in Kürze, jetzt auf die Warteliste'], ['Einstieg', { vertrieb: `Erstgespräch, kostenlos, oder der Tagesworkshop für ${angebot('tagesworkshop').preis}`, sichtbarkeit: 'Erstgespräch, kostenlos, oder direkt die Positionierung S', innovation: 'Innovations-Check, kostenlos, rund 10 Minuten' }[k]], ['Preise', 'fest und netto, auf jeder Angebotsseite']].filter(([, v]) => v).map(([x, v]) => `<div><dt>${e(x)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl>
${b.beleg ? `<div class="beleg-zeile">${zahl(F.belege[b.beleg])}</div>` : ''}</div></section>

<section class="abschnitt" id="angebote" aria-labelledby="angebote-titel"><div class="w">${abKopf({ marke: 'Angebote', h2: `${b.name}: was wir für Sie tun`, lead: F.angebote_lead[k], id: 'angebote-titel' })}
${angeboteHtml}
${netto}</div></section>

${vergleich}
${eigenes}
${wissenAbschnitt(artikelZu((a) => a.bereich === k), `Wissen zu ${b.name}`)}
${fragen(zuschneiden(faqVon(seite.bereiche[k].faq), k))}
${schlussakt({ quelle: `${k}_ende` })}`,
    });
  }

  // ── Produktseiten ──
  for (const a of inhalt.angebote) {
    const k = a.bereich.toLowerCase();
    const b = B[k];
    const pb = produktBlatt(a);
    const istBald = bald(a);
    const terminKnopf = istBald ? knopf(mail(`Warteliste: ${a.name}`), 'Auf die Warteliste') : erstKnopf();
    const mandat = monatlich(a) && k === 'vertrieb';
    const zweitKnopf = k === 'innovation' ? checkKnopf(`produkt_${a.id}`, 'Innovations-Check starten', 'zweit') : knopf('#fragen', 'Häufige Fragen', 'zweit');
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

    const blattHtml = pb ? `<section class="abschnitt" aria-labelledby="lage-titel"><div class="w">${abKopf({ marke: 'Ausgangslage', h2: 'Woran es heute hakt', lead: pb.problem, id: 'lage-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Für wen</h3>${punkte(pb.fuer)}</div><div class="erscheint"><h3 class="gruppe-titel">Nicht für</h3><p>${t(pb.nicht_fuer)}</p></div></div></div></section>

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Ablauf', h2: 'So läuft es', id: 'ablauf-titel' })}
<div class="zwei-teile"><div class="erscheint">${zeitplan(pb.ablauf)}</div>
${pb.ergebnis ? `<div class="kasten ergebnis-kasten erscheint"><p class="vorzeile">Ergebnis</p><h3>Woran Sie den Erfolg sehen</h3>${punkte(pb.ergebnis)}${pb.ergebnis_hinweis ? `<p class="leise klein-text">${t(pb.ergebnis_hinweis)}</p>` : ''}</div>` : ''}</div></div></section>

<section class="abschnitt" aria-labelledby="leistung-titel"><div class="w">
${pb.bausteine ? `${abKopf({ marke: 'Leistung', h2: 'Was Sie bekommen', lead: pb.loesung, id: 'leistung-titel' })}<div class="bausteine erscheint">${pb.bausteine.map((x) => `<div class="baustein"><h3>${e(x.name)}</h3>${x.hinweis ? `<span class="etikett">${e(x.hinweis)}</span>` : ''}<p>${t(x.text)}</p></div>`).join('')}</div>${pb.bausteine_satz ? `<p class="satz-unter">${t(pb.bausteine_satz)}</p>` : ''}${a.id === 'cso' ? `<p class="satz-unter">${textlink(produktPfad(angebot('head-of-sales')), 'Was im Head of Sales steckt')}</p>` : ''}`
    : `${abKopf({ marke: 'Leistung', h2: 'Was Sie bekommen', id: 'leistung-titel' })}<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Das Paket</h3>${datenTabelle(pb.eckdaten)}</div><div class="erscheint"><h3 class="gruppe-titel">Immer enthalten</h3>${punkte(pb.immer)}</div></div>`}
</div></section>
${pb.katalog ? `<section class="abschnitt" aria-labelledby="katalog-titel"><div class="w">${abKopf({ marke: 'Videokatalog', h2: 'Sie wählen aus festen Formaten', lead: String(pb.katalog_hinweis ?? '').replace(/„Später“[^.]*\.\s*/g, '').trim() || null, id: 'katalog-titel' })}<div class="katalog n${pb.katalog.length} erscheint">${pb.katalog.map((g) => { const formate = g.formate.filter((f) => !/\(später\)$/.test(f)); return `<div><h3 class="gruppe-titel">${e(g.titel.replace(/^\d+/, String(formate.length)))}</h3><ul class="formate">${formate.map((f) => `<li>${e(f)}</li>`).join('')}</ul></div>`; }).join('')}</div></div></section>` : ''}

<section class="abschnitt" aria-labelledby="konditionen-titel"><div class="w">${abKopf({ marke: 'Konditionen', h2: 'Preis und Konditionen', id: 'konditionen-titel' })}
<div class="zwei-teile"><div class="erscheint">${datenTabelle(pb.konditionen)}${netto}</div>
<div class="erscheint"><h3 class="gruppe-titel">Was wir von Ihnen brauchen</h3>${punkte(pb.mitwirkung)}${nichtEnthalten ? `<h3 class="gruppe-titel">Nicht enthalten</h3>${punkte(nichtEnthalten, 'punkte nicht')}` : ''}${pb.abgrenzung ? `<h3 class="gruppe-titel">Abgrenzung</h3><p class="leise">${t(pb.abgrenzung)}</p>` : ''}</div></div></div></section>`
      : `<section class="abschnitt" aria-labelledby="inhalt-titel"><div class="w">${abKopf({ marke: 'Leistung', h2: 'Was drin ist', lead: a.fuer_wen, id: 'inhalt-titel' })}
${a.stufen ? `<div class="raster n3 erscheint">${a.stufen.map((s) => `<div class="spalte"><span class="etikett">Workshop: ${e(s.workshop)}</span><h3>Positionierung ${e(s.name)}</h3><p class="stufe-preis">${e(s.preis)}</p><p>${t(s.ergebnis)}</p></div>`).join('')}</div>${netto}` : ''}
<div class="zwei-teile">${a.enthalten ? `<div class="erscheint"><h3 class="gruppe-titel">Enthalten</h3>${punkte(a.enthalten)}</div>` : ''}
<div class="erscheint">${nichtEnthalten ? `<h3 class="gruppe-titel">Nicht enthalten</h3>${punkte(nichtEnthalten, 'punkte nicht')}` : ''}<h3 class="gruppe-titel">Gut zu wissen</h3>${punkte(regeln)}</div></div>
</div></section>`;

    const zuArtikeln = artikelZu((x) => x.angebote.includes(a.id));
    // Ergebnis in einem Satz: bei Paketen (Websites, Videos) das Versprechen des Pakets, sonst das erste Ergebnis des Produktblatts.
    const ergebnisSatz = pb?.familie ? pb.versprechen : pb?.ergebnis?.[0] ?? (a.stufen ? 'Ihre Positionierung in Sätzen, die Ihr Team und Ihre Website sofort verwenden können.' : (a.enthalten ?? [])[0]);
    neu(`${k}/${a.id}/index.html`, {
      seo: a.id,
      bildVorzeile: `${b.name}${a.gruppe && a.gruppe !== a.name ? ` · ${a.gruppe}` : ''}`,
      bildTitel: a.name,
      aktiv: k,
      seitenTyp: 'ItemPage',
      schema: [{
        '@type': 'Service', '@id': `${absolut(produktPfad(a))}#leistung`, name: a.name, serviceType: b.name, category: b.name,
        description: klar(F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? ''), provider: { '@id': ORG }, areaServed: organisation.areaServed,
        audience: { '@type': 'BusinessAudience', audienceType: klar((pb?.fuer ?? [a.fuer_wen]).filter(Boolean).join('; ')) },
        url: absolut(produktPfad(a)), ...(istBald ? {} : { offers: angebotDaten(a) }),
        ...(zuArtikeln.length ? { subjectOf: zuArtikeln.map((x) => ({ '@type': 'Article', name: x.titel, url: absolut(artikelPfad(x)) })) } : {}),
      }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[`/${k}/`, b.name], [null, a.name]])}${vorzeile(`${b.name}${a.gruppe ? ` · ${a.gruppe}` : ''}${istBald ? ' · Bald' : ''}`)}<h1 id="held-titel">${e(a.name)}</h1><p class="lead">${t(F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? b.satz)}</p></div>
<aside class="preis-kasten erscheint" aria-label="Preis"><p class="etikett">Preis</p><p class="betrag">${e(preisVoll(a))}</p><p class="zusatz">${istBald ? 'Festpreis mit klarem Umfang, vorab vereinbart' : `${e(a.preis_zusatz ?? '')}${a.preis_zusatz ? ' · ' : ''}netto zuzüglich Umsatzsteuer`}</p>${F.umfang[a.id] ? `<p class="umfang">${e(F.umfang[a.id])}</p>` : ''}${mandat ? `<p class="sicher">Ausstieg zum Ende von Monat 3 möglich</p>` : ''}<div class="knoepfe senkrecht">${terminKnopf}${zweitKnopf}</div></aside>
</div></section>
${blick([['Preis', istBald ? 'folgt zum Start' : `${a.preis} netto${a.preis_zusatz ? `, ${a.preis_zusatz}` : ''}`], ['Umfang', F.umfang[a.id]], ['Für wen', pb?.fuer?.[0] ?? a.fuer_wen], ['Ergebnis', ergebnisSatz], ['Bereich', istBald ? `${b.name} · startet in Kürze` : b.name]])}
${mandat ? risiko() : ''}
${blattHtml}
${a.id === 'head-of-sales' ? wochenreportMuster() : ''}
${a.id === 'positionierung' ? musterPositionierung() : ''}
${a.gruppe === 'Homepage-Pakete' ? arbeitsprobe() : ''}
${zusatz.length ? `<section class="abschnitt" aria-labelledby="zusatz-titel"><div class="w">${abKopf({ marke: 'Zusatzoptionen', h2: 'Dazu buchbar', id: 'zusatz-titel' })}<dl class="daten erscheint">${zusatz.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.name === 'Express' && a.id !== 'homepage-landing' ? 'halbe Lieferzeit' : z.leistung)}</span></dt><dd>${e(zusatzPreis(z))}</dd></div>`).join('')}</dl></div></section>` : ''}
${fragen(fragenListe)}
${weitere.length ? `<section class="abschnitt" aria-labelledby="weitere-titel"><div class="w">${abKopf({ marke: geschwister.length ? a.gruppe : b.name, h2: geschwister.length ? `Die anderen ${a.gruppe}` : `Weitere Angebote im Bereich ${b.name}`, id: 'weitere-titel' })}
${angebotZeilen(weitere)}</div></section>` : ''}
${wissenAbschnitt(zuArtikeln)}
${schlussakt({ quelle: `produkt_${a.id}_ende`, lead: istBald ? 'Tragen Sie sich auf die Warteliste ein. Oder starten Sie mit dem Innovations-Check, er zeigt in rund 10 Minuten, wo Ihr Unternehmen steht.' : 'Sprechen Sie mit uns über Ihren Start: Im kostenlosen Erstgespräch klären wir, ob dieses Angebot passt. Oder Sie starten mit dem Innovations-Check, rund 10 Minuten.', knoepfe: `${terminKnopf}${checkKnopf(`produkt_${a.id}_ende`, 'Innovations-Check starten', 'zweit')}` })}`,
    });
  }

  // ── Innovations-Check (die Seite davor; der Check selbst läuft in der eigenen Anwendung unter /check) ──
  {
    const c = start['innovations-check'];
    const a1 = katalog.abschnitte.flatMap((x) => x.fragen).find((f) => f.id === 'A1');
    neu('innovations-check/index.html', {
      seo: 'innovations-check',
      bildVorzeile: 'Kostenlos · rund 10 Minuten',
      bildTitel: 'Innovations-Check: Wo steht Ihr Unternehmen?',
      aktiv: 'innovation',
      schema: [{ '@type': 'Service', '@id': `${absolut('/innovations-check/')}#leistung`, name: 'Innovations-Check', serviceType: 'Innovation', description: klar(F.check.text), provider: { '@id': ORG }, areaServed: organisation.areaServed, url: absolut('/innovations-check/'), offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: absolut('/innovations-check/') } }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([['/innovation/', 'Innovation'], [null, 'Innovations-Check']])}${vorzeile('Kostenlos · rund 10 Minuten · Ergebnis sofort')}<h1 id="held-titel">${e(c.titel)}</h1><p class="lead">${t(F.check.text)}</p><div class="knoepfe">${checkKnopf('check_seite_held')}</div></div>
<figure class="frage-karte erscheint" aria-label="Beispiel: die erste Frage des Checks"><figcaption><span class="etikett">So sieht eine Frage aus</span><span class="leise">Frage 1 von ${katalog.anzahl_kurzcheck}</span></figcaption><p class="frage">${e(a1.text)}</p><ul class="optionen" aria-hidden="true">${a1.optionen.slice(0, 4).map((o) => `<li>${e(o.text)}</li>`).join('')}</ul><p class="leise klein-text">Zoe, unsere KI-Assistentin, führt durch die Fragen. Sie stellt sie mit festen Texten.</p></figure>
</div></section>

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'So läuft es', h2: 'In drei Schritten zu Ihren Top 3', id: 'ablauf-titel' })}
${weg(F.check_einstieg, { etiketten: ['01', '02', '03'], label: 'Der Check in drei Schritten' })}</div></section>

<section class="abschnitt" aria-labelledby="stufen-titel"><div class="w">${abKopf({ marke: 'Fünf Stufen', h2: 'Wo steht Ihr Unternehmen?', lead: 'Der Check misst Sichtbarkeit, Vertrieb und Innovation und nennt für die zwei schwächsten Bereiche den nächsten Schritt. Die Innovation vergleicht er mit Ihrer Branche.', id: 'stufen-titel' })}
<ol class="stufen breit erscheint" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><span class="stufe-balken" aria-hidden="true"></span><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></li>`).join('')}</ol></div></section>

<section class="abschnitt" aria-labelledby="gespraech-titel"><div class="w">${abKopf({ marke: 'Nach dem Check', h2: start.gespraech.titel, lead: start.gespraech.text, id: 'gespraech-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Was Sie bekommen</h3>${punkte(seite.check_punkte.punkte)}</div>
<div class="erscheint"><h3 class="gruppe-titel">Ihre Daten</h3>${punkte(['Ihre Antworten liegen auf unserem eigenen Server in Deutschland.', 'Zoe stellt die Fragen mit festen Texten. Ihre Antworten gehen an kein KI-Modell.', 'Kontaktdaten geben Sie nur an, wenn Sie Ihren Bericht oder ein Gespräch wollen.', 'Ohne Kontaktdaten löschen wir die Antworten nach 30 Tagen.'])}<p class="leise klein-text">${t(start.gespraech.regel)}</p></div></div></div></section>

${fragen(faqVon(seite.check_faq))}
${schlussakt({ quelle: 'check_seite_ende', h2: 'Bereit?', lead: 'In rund 10 Minuten wissen Sie, wo Ihr Unternehmen steht.', knoepfe: `${checkKnopf('check_seite_ende')}${erstKnopf('zweit', 'Lieber direkt sprechen')}`, stufen: F.check_einstieg })}`,
    });
  }

  // ── Abend ──
  neu('abend/index.html', {
    seo: 'abend',
    bildVorzeile: F.abend.titel,
    bildTitel: F.abend.satz,
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
    seo: 'ueber-uns',
    bildVorzeile: 'Über uns',
    bildTitel: F.leitidee.titel,
    aktiv: 'ueber-uns',
    seitenTyp: 'AboutPage',
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Über uns']])}${vorzeile('Über uns')}<h1 id="held-titel">${e(F.leitidee.titel)}</h1><p class="lead">${t(F.leitidee.lead)}</p></div>
</div></section>

${blick([...F.fakten, ['Betreiber', anbieter.name], ['Kontakt', seite.kontakt.mail]], 'Fokus Innovation auf einen Blick')}

<section class="abschnitt" aria-labelledby="ursprung-titel"><div class="w">${abKopf({ marke: 'Warum es uns gibt', h2: 'Vier Erfahrungen.', ruhig: 'Ein Entschluss.', lead: F.leitidee.absaetze.join(' '), id: 'ursprung-titel' })}
${raster(F.leitidee.ursprung, 4)}
<div class="zwei-teile ueber-zitat"><figure class="zitat erscheint"><blockquote><p>„${e(F.leitidee.zitat.text)}“</p></blockquote><figcaption><b>${e(F.leitidee.zitat.wer)}</b><cite><a href="${e(F.leitidee.zitat.link)}" rel="noopener" target="_blank">${e(F.leitidee.zitat.quelle)}</a></cite></figcaption></figure>
<div class="erscheint">${zahl(F.belege.mittelstand)}</div></div></div></section>

<section class="abschnitt" aria-labelledby="wen-titel"><div class="w">${abKopf({ marke: 'Für wen', h2: 'Für Menschen, die umsetzen statt reden.', lead: 'Drei Gruppen, zwei Richtungen: Neues in den Markt bringen oder Neues ins Unternehmen bringen.', id: 'wen-titel' })}
${raster(F.fuer_wen.map((w) => ({ etikett: w.richtung, titel: w.titel, text: w.text, unter: `Einstieg: ${w.einstieg}`, nr: false })), 3)}
</div></section>

<section class="abschnitt" aria-labelledby="team-titel"><div class="w">${abKopf({ marke: 'Team', h2: 'Zwei Menschen, ein Team.', lead: 'Kevin für Vertrieb und Umsetzung, Malin für Bühne und Netzwerk.', id: 'team-titel' })}
<div class="team erscheint">${F.team.map((p) => `<article class="person" id="${personAnker(p)}"><span class="kuerzel" aria-hidden="true">${e(p.kuerzel)}</span><div><p class="etikett">${e(p.rolle)}</p><h3>${e(p.name)}</h3><p>${t(p.text)}</p></div></article>`).join('')}</div></div></section>

<section class="abschnitt" aria-labelledby="werte-titel"><div class="w">${abKopf({ marke: 'Werte', h2: 'Woran man uns erkennt.', lead: 'Drei Werte, an denen Sie uns messen können.', id: 'werte-titel' })}
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
      seo: 'kontakt',
      bildVorzeile: 'Kontakt',
      bildTitel: 'Sprechen Sie mit uns.',
      aktiv: 'kontakt',
      seitenTyp: 'ContactPage',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Kontakt']])}${vorzeile('Kontakt')}<h1 id="held-titel">Sprechen Sie mit uns.</h1><p class="lead">Ein kurzes Erstgespräch klärt, ob und womit wir helfen können. Kostenlos und per Video. Oder Sie starten mit dem Innovations-Check, rund 10 Minuten.</p>
<div class="knoepfe">${erstKnopf()}${checkKnopf('kontakt', 'Innovations-Check starten', 'zweit')}</div></div>
</div></section>
<section class="abschnitt" aria-labelledby="weiter-titel"><div class="w">${abKopf({ marke: 'So geht es weiter', h2: 'Drei Schritte bis zum Start.', id: 'weiter-titel' })}
${weg(F.einstieg, { etiketten: ['01', '02', '03'], label: 'Drei Schritte bis zum Start' })}</div></section>
<section class="abschnitt" aria-label="Kontaktdaten"><div class="w"><div class="kontakt-liste erscheint">
<div><p class="etikett">E-Mail</p><a class="gross-link" href="mailto:${e(k.mail)}">${e(k.mail)}</a></div>
<div><p class="etikett">Adresse</p><address>${e(F.marke.name)}<br>${e(anbieter.name)}<br>${k.adresse.map(t).join('<br>')}</address><p class="leise klein-text">${e(F.marke.name)} ist eine Marke der ${e(anbieter.name)}.</p></div>
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
    seo: 'impressum',
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
    seo: 'datenschutz',
    main: recht('Datenschutz', `<h2>Kurz gesagt</h2><p>Diese Website setzt keine Cookies und nutzt kein Tracking, keine Analyse und keine Werbung. Sie lädt nur Dateien von unserem eigenen Server: Schriften, Bilder, Stile und kleine Skripte liegen hier, nichts kommt von fremden Diensten. Persönliche Daten verarbeiten wir nur, wenn es technisch nötig ist, um die Seite auszuliefern, und wenn Sie selbst etwas tun: einen unserer Checks machen, ein Gespräch buchen, den Newsletter bestellen oder uns schreiben.</p>
<h2>Verantwortlich</h2>${anschrift}<p>vertreten durch ${t(anbieter.vertreten)}. Für alle Fragen zum Datenschutz: <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p>
<h2>Hosting</h2><p>Die Website liegt auf einem Server der Hetzner Online GmbH (Industriestr. 25, 91710 Gunzenhausen) in einem Rechenzentrum in Deutschland. Auf demselben Server läuft unsere eigene Anwendung für die Checks, die Terminbuchung und die Newsletter-Anmeldung. Hetzner verarbeitet die Daten nur in unserem Auftrag (Art. 28 DSGVO).</p>
<h2>Aufruf der Seite</h2><p>Wenn Sie die Seite öffnen, schickt Ihr Browser technisch bedingt Ihre IP-Adresse, den Zeitpunkt, die aufgerufene Adresse und eine Browser-Kennung an unseren Server. Wir brauchen diese Angaben, um die Seite verschlüsselt (HTTPS) auszuliefern und den Server sicher zu betreiben. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, funktionierenden Angebot (Art. 6 Abs. 1 lit. f DSGVO). Unser Webserver führt kein Zugriffsprotokoll. Technische Fehlermeldungen können eine IP-Adresse enthalten; sie bleiben auf dem Server, werden nicht ausgewertet und rollierend überschrieben.</p>
<h2>Cookies und Speicher im Browser</h2><p>Die Website selbst setzt keine Cookies und legt nichts im Speicher Ihres Browsers ab. Kleine Skripte zeigen Abschnitte beim Scrollen an, spielen auf der Startseite eine Animation ab und schließen auf dem Handy das Menü; sie lesen nichts aus, speichern nichts und senden nichts. Was die Checks im Speicher Ihres Browsers ablegen, steht im Abschnitt zu den Checks.</p>
<h2>Links zu Quellen</h2><p>Bei Zahlen nennen wir die Quelle und verlinken sie. Erst wenn Sie einen solchen Link anklicken, öffnet Ihr Browser die Seite des jeweiligen Anbieters; dafür gilt dessen Datenschutzhinweis.</p>
<h2>Vorlagen zum Herunterladen</h2><p>Die Vorlagen laden Sie ohne Anmeldung direkt von unserem Server. Dabei fallen nur die technischen Angaben an, die beim Aufruf jeder Seite entstehen (siehe oben).</p>
<h2>Checks: Innovations-Check, Vertriebscheck, Sichtbarkeitstest</h2><p>Die Checks laufen unter ${e(F.domain)}/check in unserer eigenen Anwendung auf demselben Server. Zoe ist eine KI-Assistentin; in den Checks stellt sie die Fragen mit festen Texten, Ihre Antworten gehen an kein KI-Modell. Wir speichern Ihre Antworten, um Ihr Ergebnis zu berechnen. Geben Sie Kontaktdaten an, schicken wir Ihnen Ihren Bericht, legen Sie als Anfrage in unserem Kundensystem an und bieten Ihnen das Erstgespräch an (Art. 6 Abs. 1 lit. b DSGVO, Anfrage vor einem möglichen Vertrag). Ohne Kontaktdaten löschen wir Ihre Antworten nach 30 Tagen, mit Kontaktdaten spätestens 24 Monate nach dem letzten Kontakt.</p><p>Damit Sie später weitermachen können, legt jeder Check im Speicher Ihres Browsers eine zufällige Kennung ab; sie enthält keine Antworten. Wählen Sie im Ergebnis einen freien Termin, merkt sich Ihr Browser bis zum Schließen des Fensters die gewählte Zeit und, falls Sie sie angegeben haben, Vorname, E-Mail und Firma, damit die Buchungsseite sie vorausfüllt. Die Buchungsseite löscht diese Angaben, sobald sie sie gelesen hat. Vor dem Start jedes Checks sehen Sie einen eigenen Datenschutzhinweis.</p>
<h2>Erstgespräch buchen</h2><p>Das Erstgespräch buchen Sie unter ${e(F.domain)}/buchen in unserer eigenen Anwendung. Ihre Angaben (Name, E-Mail, Firma, Anliegen) verwenden wir, um Ihre Terminanfrage zu bearbeiten und das Gespräch vorzubereiten (Art. 6 Abs. 1 lit. b DSGVO). Bis wir den Termin bestätigen, liegt Ihre Anfrage nur in unserer Terminverwaltung. Nicht bestätigte, abgelehnte, abgesagte oder abgelaufene Anfragen löschen wir 30 Tage nach der letzten Änderung, bestätigte Buchungen 30 Tage nach dem Termin. Mit der Bestätigung legen wir Sie als Geschäftskontakt an und tragen den Termin mit Ihrem Namen und Ihrer E-Mail-Adresse in unseren Kalender bei Google Workspace ein (siehe unten). Nach dem Absenden zeigt Ihnen die Seite Ihren persönlichen Status; die Adresse mit Ihrem Schlüssel kennen nur Sie. Vor dem Absenden sehen Sie dort einen eigenen Datenschutzhinweis.</p>
<h2>Newsletter</h2><p>Den Newsletter bestellen Sie unter ${e(F.domain)}/newsletter. Sie bekommen ihn nur, wenn Sie die Anmeldung über den Link in unserer Bestätigungsmail bestätigen (Double-Opt-in). Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Wir speichern Ihre E-Mail-Adresse, Ihren Vornamen, falls Sie ihn angeben, den Wortlaut Ihrer Einwilligung und die Zeitpunkte von Anmeldung, Bestätigungsmail und Bestätigung, um die Einwilligung nachweisen zu können. Nach der Bestätigung führen wir Sie mit diesem Nachweis in unserem Kundensystem. Unbestätigte Anmeldungen löschen wir nach 30 Tagen. Sie können die Einwilligung jederzeit widerrufen, über den Abmeldelink in jeder Ausgabe oder per E-Mail; danach bekommen Sie nichts mehr, und wir behalten nur den Nachweis, dass und wann Sie eingewilligt und widerrufen haben. Die Mails verschicken wir über unser Postfach bei Google Workspace (siehe unten).</p>
<h2>Kontakt per E-Mail, Kalender</h2><p>Schreiben Sie uns an ${e(seite.kontakt.mail)}, verarbeiten wir Ihre Adresse und den Inhalt Ihrer Nachricht, um zu antworten: bei Anfragen zu einem möglichen Vertrag nach Art. 6 Abs. 1 lit. b DSGVO, sonst nach Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die Nachricht, wenn sie erledigt ist, es sei denn, gesetzliche Aufbewahrungspflichten verlangen mehr. Die Postfächer und den Kalender betreibt Google Workspace (Gmail, Google Kalender), ein Dienst der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, auf Grundlage eines Auftragsverarbeitungsvertrags. Werden dabei Daten in Länder außerhalb der EU übermittelt, etwa in die USA, ist das über das EU-US Data Privacy Framework beziehungsweise über Standardvertragsklauseln abgesichert.</p>
<h2>Sicherungen</h2><p>Verschlüsselte Sicherungen unseres Servers bewahren wir bis zu 12 Monate auf (14 Tages-, 8 Wochen- und 12 Monatsstände), danach werden sie überschrieben. Gelöschte Daten können bis dahin noch in einer Sicherung stehen, werden dort aber nicht mehr verwendet. Wird eine Sicherung zurückgespielt, löschen wir sie sofort erneut.</p>
<h2>Weitergabe</h2><p>Wir verkaufen keine Daten und geben sie nicht an Dritte weiter, außer an die oben genannten Dienstleister, die in unserem Auftrag arbeiten. Es gibt keine automatisierten Entscheidungen.</p>
<h2>Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Verarbeiten wir Daten auf Grundlage berechtigter Interessen, können Sie jederzeit widersprechen (Art. 21). Eine Mail an ${e(seite.kontakt.mail)} genügt. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).</p>`),
  });
  neu('404.html', {
    titel: 'Seite nicht gefunden · Fokus Innovation',
    beschreibung: 'Diese Seite gibt es nicht.',
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig"><div>${vorzeile('404')}<h1 id="held-titel">Diese Seite gibt es nicht.</h1><p class="lead">Vielleicht hilft der Weg zurück zur Startseite. Oder Sie schauen, was wir kostenlos anbieten.</p><div class="knoepfe">${knopf('/', 'Zur Startseite')}${textlink('/kostenlos/', 'Zu Kostenlos')}</div></div></div></section>`,
  });

  // ── Wissen: Übersicht und Ratgeber ──
  const autor = F.team[0];
  const datum = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  /** Fragen eines Ratgebers: eigene ({f, a}), aus den gemeinsamen Fragen ({faq}) oder aus einem Produktblatt ({aus, frage}). */
  const frageAus = (x, bereich) => {
    if (x.f) return x;
    if (x.faq) {
      const f = inhalt.faq.find((y) => y.id === x.faq);
      if (!f) throw new Error(`Frage ${x.faq} fehlt in inhalt.json`);
      return zuschneiden([f], bereich)[0];
    }
    const f = produktBlatt(angebot(x.aus))?.fragen.find((y) => y.frage === x.frage);
    if (!f) throw new Error(`Frage „${x.frage}“ fehlt im Produktblatt ${x.aus}`);
    return { f: f.frage, a: f.antwort };
  };
  const tabelleHtml = (tb) => `<figure class="tabelle-figur"><p class="tabelle-titel">${e(tb.titel)}</p><div class="tabelle-huelle"><table class="vergleich text"><caption class="sr">${e(tb.titel)}</caption><thead><tr>${tb.kopf.map((k) => `<th scope="col">${k ? e(k) : '<span class="sr">Merkmal</span>'}</th>`).join('')}</tr></thead><tbody>${tb.zeilen.map(([m, ...w]) => `<tr><th scope="row">${e(m)}</th>${w.map((v, n) => `<td data-name="${e(tb.kopf[n + 1])}">${t(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${tb.hinweis ? `<figcaption class="leise klein-text">${t(tb.hinweis)}</figcaption>` : ''}</figure>`;
  const abschnittHtml = (x, genutzt, bereich) => {
    const id = slug(x.h);
    const teile = [`<h2 id="${id}">${e(x.h)}</h2>`];
    const beleg = (k) => { if (!F.belege[k]) throw new Error(`Beleg ${k} fehlt`); genutzt.add(k); teile.push(zahl(F.belege[k])); };
    if (x.faq) teile.push(`<p>${t(frageAus({ faq: x.faq }, bereich).a)}</p>`);
    for (const p of x.absaetze ?? []) teile.push(`<p>${t(p)}</p>`);
    if (x.punkte) teile.push(punkte(x.punkte));
    if (x.schritte) teile.push(`<ol class="schritte">${x.schritte.map((s, i) => `<li><span class="nr">${String(i + 1).padStart(2, '0')}</span><div><h3>${e(s.titel)}</h3><p>${t(s.text)}</p></div></li>`).join('')}</ol>`);
    if (x.tabelle) teile.push(tabelleHtml(x.tabelle));
    if (x.zeitplan_von) teile.push(zeitplan(produktBlatt(angebot(x.zeitplan_von)).ablauf));
    if (x.vergleich_von) { const [bk, n] = x.vergleich_von.split(':'); teile.push(`<div class="artikel-vergleich">${vergleichTabelle(blaetter.vergleiche[bk][Number(n)])}${netto}</div>`); }
    if (x.beleg) beleg(x.beleg);
    for (const p of x.absaetze_danach ?? []) teile.push(`<p>${t(p)}</p>`);
    if (x.beleg_danach) beleg(x.beleg_danach);
    return `<section class="artikel-teil" aria-labelledby="${id}">${teile.join('')}</section>`;
  };

  // ── Kostenlos (30.10., Kevin: „einen Bereich, wo wir kostenlose Sachen anbieten“): Checks, Ratgeber, Zahlen, Vorlagen, Newsletter.
  // Ersetzt die frühere Übersicht /wissen/ (Caddy leitet sie hierher um); die Ratgeber behalten ihre Adressen /wissen/<id>/.
  const checkZeilen = K.checks.map((c) => {
    const href = c.thema ? checkThema(c.thema, 'kostenlos') : c.pfad;
    return `<li><a href="${href}"><span class="z-name">${e(c.name)}${c.haupt ? ' <span class="marke-bald">Empfohlen</span>' : ''}</span><span class="z-text">${e(c.text)}</span><span class="z-preis">${c.minuten} Minuten</span>${PFEIL}</a></li>`;
  }).join('');
  /** Eine belegte Zahl im Stil der Belege der Website (`zahl`), mit Herausgeber und Jahr. */
  const zahlKarte = (z) => zahl({ wert: z.wert, text: z.satz, link: z.url, quelle: `${z.quelle}, ${z.jahr_der_daten ?? String(z.datum).slice(0, 4)}` });
  neu('kostenlos/index.html', {
    seo: 'kostenlos',
    bildVorzeile: 'Kostenlos',
    bildTitel: 'Checks, Ratgeber, Zahlen und Vorlagen.',
    aktiv: 'kostenlos',
    seitenTyp: 'CollectionPage',
    schema: [{ ...itemListe('Kostenlos bei Fokus Innovation', [...K.checks.map((c) => [c.thema ? `/check?thema=${c.thema}` : c.pfad, c.name]), ...W.artikel.map((a) => [artikelPfad(a), a.titel])]), '@id': `${absolut('/kostenlos/')}#kostenlos` }],
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Kostenlos']])}${vorzeile('Kostenlos')}<h1 id="held-titel">${titel(K.titel, K.ruhig)}</h1><p class="lead">${t(K.lead)}</p>
<nav class="az breit" aria-label="Auf dieser Seite"><a href="#checks">Checks</a><a href="#ratgeber">Ratgeber</a>${Z ? '<a href="#zahlen">Zahlen</a>' : ''}${VL ? '<a href="#vorlagen">Vorlagen</a>' : ''}<a href="#newsletter">Newsletter</a></nav></div>
</div></section>

<section class="abschnitt" id="checks" aria-labelledby="checks-titel"><div class="w">${abKopf({ marke: 'Checks', h2: 'Wo stehen Sie?', ruhig: 'In Minuten.', lead: 'Fast alles per Klick, Ergebnis sofort, mit nächsten Schritten. Zoe, unsere KI-Assistentin, führt durch die Fragen.', id: 'checks-titel' })}
<ul class="zeilen erscheint">${checkZeilen}</ul></div></section>

<section class="abschnitt" id="ratgeber" aria-labelledby="ratgeber-titel"><div class="w">${abKopf({ marke: 'Ratgeber', h2: 'Aus unserer Arbeit.', ruhig: 'Zum Nachlesen.', lead: 'Wie wir Vertrieb aufbauen, Angebote sichtbar machen und Neues im Alltag einführen. Praktisch, in klaren Worten und mit Quellen, wo Zahlen stehen.', id: 'ratgeber-titel' })}</div></section>
${BEREICHE.map((k) => { const liste = artikelZu((a) => a.bereich === k); return liste.length ? `<section class="abschnitt" aria-labelledby="ratgeber-${k}"><div class="w">${abKopf({ marke: B[k].name, nr: B[k].nr, h2: B[k].paar, id: `ratgeber-${k}` })}${wissenListe(liste)}</div></section>` : ''; }).join('\n')}
${Z ? `<section class="abschnitt" id="zahlen" aria-labelledby="zahlen-titel"><div class="w">${abKopf({ marke: 'Zahlen', h2: K.zahlen.titel, lead: K.zahlen.lead, id: 'zahlen-titel' })}<div class="zahlen-raster">${(Z.zahlen.some((z) => z.vorn) ? Z.zahlen.filter((z) => z.vorn) : Z.zahlen.slice(0, 3)).map(zahlKarte).join('')}</div><div class="knoepfe erscheint">${textlink('/kostenlos/zahlen/', `Alle ${Z.zahlen.length} Zahlen`)}</div></div></section>` : ''}
${VL ? `<section class="abschnitt" id="vorlagen" aria-labelledby="vorlagen-titel"><div class="w">${abKopf({ marke: 'Vorlagen', h2: K.vorlagen.titel, lead: K.vorlagen.lead, id: 'vorlagen-titel' })}<ul class="zeilen erscheint">${VL.vorlagen.map((v) => `<li><a href="${e(v.datei)}" download><span class="z-name">${e(v.titel)}</span><span class="z-text">${e(v.text)}</span><span class="z-preis">PDF · ${v.seiten} ${v.seiten === 1 ? 'Seite' : 'Seiten'}</span>${PFEIL}</a></li>`).join('')}</ul></div></section>` : ''}
<section class="abschnitt" id="newsletter" aria-labelledby="newsletter-titel"><div class="w">${abKopf({ marke: 'Newsletter', h2: K.newsletter.titel, lead: K.newsletter.text, id: 'newsletter-titel' })}<div class="knoepfe erscheint">${knopf(K.newsletter.pfad, K.newsletter.knopf)}</div></div></section>
<section class="abschnitt" aria-labelledby="nachschlagen-titel"><div class="w">${abKopf({ marke: 'Nachschlagen', h2: 'Begriffe, Fragen, Preise.', id: 'nachschlagen-titel' })}
<ul class="zeilen erscheint">${[['/begriffe/', 'Begriffe von A bis Z', 'Pipeline, Sales Playbook, Wiedervorlage: kurz und klar erklärt.', `${W.begriffe.length} Begriffe`], ['/fragen/', 'Häufige Fragen', 'Antworten zu Check, Vertrieb, Homepages, Videos und Verträgen.', 'alle Bereiche'], ['/preise/', 'Alle Preise', 'Jedes Angebot mit Preis und Konditionen auf einer Seite.', 'netto']].map(([h, n, s, p]) => `<li><a href="${h}"><span class="z-name">${e(n)}</span><span class="z-text">${e(s)}</span><span class="z-preis">${e(p)}</span>${PFEIL}</a></li>`).join('')}</ul></div></section>
${schlussakt({ quelle: 'kostenlos_ende' })}`,
  });

  if (Z) {
    neu('kostenlos/zahlen/index.html', {
      seo: 'zahlen',
      bildVorzeile: 'Kostenlos · Zahlen',
      bildTitel: 'Zahlen zu Vertrieb, Sichtbarkeit und KI.',
      aktiv: 'kostenlos',
      seitenTyp: 'CollectionPage',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, 'Zahlen']])}${vorzeile(`Stand ${datum(Z.stand)}`)}<h1 id="held-titel">${titel(K.zahlen.titel)}</h1><p class="lead">${t(K.zahlen.lead)}</p></div>
</div></section>
${BEREICHE.map((k) => { const liste = Z.zahlen.filter((z) => z.bereich === k); return liste.length ? `<section class="abschnitt" aria-labelledby="zahlen-${k}"><div class="w">${abKopf({ marke: B[k].name, nr: B[k].nr, h2: B[k].paar, id: `zahlen-${k}` })}<div class="zahlen-raster">${liste.map(zahlKarte).join('')}</div></div></section>` : ''; }).join('\n')}
<section class="abschnitt" aria-labelledby="zahlen-hinweis"><div class="w"><p class="leise klein-text erscheint" id="zahlen-hinweis">Wir geben die Zahlen so wieder, wie die Herausgeber sie veröffentlicht haben. Der Link führt jeweils zur Quelle. Die Zahlen beziehen sich auf Deutschland, wo nicht anders genannt.</p></div></section>
${schlussakt({ quelle: 'zahlen_ende' })}`,
    });
  }

  for (const a of W.artikel) {
    const b = B[a.bereich];
    const pfad = `wissen/${a.id}/index.html`;
    const url = absolut(artikelPfad(a));
    const genutzt = new Set();
    const teile = a.abschnitte.map((x) => abschnittHtml(x, genutzt, a.bereich)).join('\n');
    const quellenListe = [...genutzt].map((k) => F.belege[k]);
    const angebote = a.angebote.map(angebot).filter(Boolean);
    const weiter = a.weiter.map((id) => W.artikel.find((x) => x.id === id)).filter(Boolean);
    neu(pfad, {
      titel: a.seo_titel.length + ' · Fokus Innovation'.length <= 65 ? `${a.seo_titel} · Fokus Innovation` : a.seo_titel,
      beschreibung: a.beschreibung,
      bildVorzeile: `Wissen · ${b.name}`,
      bildTitel: a.titel,
      aktiv: 'kostenlos',
      artikel: { veroeffentlicht: a.veroeffentlicht, aktualisiert: a.aktualisiert, autor: autor.name },
      schema: [{
        '@type': 'Article', '@id': `${url}#artikel`, headline: a.titel, description: klar(a.beschreibung), abstract: klar(a.kurz),
        image: absolut(`/assets/bild/og/${bildName(pfad)}.png`), datePublished: a.veroeffentlicht, dateModified: a.aktualisiert,
        author: { '@id': personId(autor) }, publisher: { '@id': ORG }, mainEntityOfPage: { '@id': `${url}#webseite` }, inLanguage: 'de-DE',
        articleSection: b.name, wordCount: klar(artikelText(a)).split(/\s+/).length, timeRequired: `PT${lesezeit(a)}M`,
        ...(quellenListe.length ? { citation: quellenListe.map((q) => ({ '@type': 'CreativeWork', name: q.quelle, url: q.link })) } : {}),
        ...(angebote.length ? { mentions: angebote.map((x) => ({ '@type': 'Service', name: x.name, url: absolut(produktPfad(x)) })) } : {}),
      }],
      main: `<section class="held artikel-held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, a.titel]])}${vorzeile(`${b.name} · ${lesezeit(a)} Minuten Lesezeit`)}<h1 id="held-titel">${e(a.titel)}</h1>
<p class="autor-zeile">Von <a class="unterstrichen" href="/ueber-uns/#${personAnker(autor)}">${e(autor.name)}</a>, ${e(autor.rolle)} · <time datetime="${a.aktualisiert}">${e(datum(a.aktualisiert))}</time></p></div>
</div></section>

<section class="abschnitt" aria-label="Artikel"><div class="w artikel-raster">
<nav class="inhaltsangabe" aria-label="Inhalt dieses Artikels"><p class="etikett">Inhalt</p><ol>${a.abschnitte.map((x) => `<li><a href="#${slug(x.h)}">${e(x.h)}</a></li>`).join('')}</ol></nav>
<article class="artikel">
${kurzGesagt(a.kurz)}
${teile}
${(() => { const c = checkZuBereich(a.bereich, `wissen_${a.id}`); return c ? `<aside class="artikel-check erscheint" aria-label="${e(c.name)}"><p class="etikett">Kostenlos · ${c.minuten} Minuten</p><p class="artikel-check-titel">${e(c.name)}</p><p>${e(c.text)}</p>${knopf(c.href, `${c.name} starten`)}</aside>` : ''; })()}
${quellenListe.length ? `<section class="quellen" aria-labelledby="quellen-titel"><h2 id="quellen-titel">Quellen</h2><ol>${quellenListe.map((q) => `<li><a href="${e(q.link)}" rel="noopener" target="_blank">${e(q.quelle)}</a></li>`).join('')}</ol></section>` : ''}
</article>
</div></section>

${fragen(a.fragen.map((x) => frageAus(x, a.bereich)), 'Fragen zum Thema')}
<section class="abschnitt" aria-labelledby="passend-titel"><div class="w">${abKopf({ marke: 'Angebote', h2: 'Passende Angebote', id: 'passend-titel' })}${angebotZeilen(angebote)}${netto}</div></section>
${weiter.length ? `<section class="abschnitt" aria-labelledby="weiter-titel"><div class="w">${abKopf({ marke: 'Weiterlesen', h2: 'Das könnte Sie auch interessieren', id: 'weiter-titel' })}${wissenListe(weiter)}</div></section>` : ''}
${schlussakt({ quelle: `wissen_${a.id}_ende` })}`,
    });
  }

  // ── Begriffe von A bis Z ──
  {
    const sortiert = [...W.begriffe].sort((x, y) => x.name.localeCompare(y.name, 'de'));
    const buchstabe = (n) => (/^\d/.test(n) ? '0–9' : n[0].toLocaleUpperCase('de').replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U'));
    const gruppen = [];
    for (const x of sortiert) { const g = buchstabe(x.name); const da = gruppen.find((y) => y.g === g); if (da) da.liste.push(x); else gruppen.push({ g, liste: [x] }); }
    const BASIS_B = absolut('/begriffe/');
    neu('begriffe/index.html', {
      seo: 'begriffe',
      bildVorzeile: 'Begriffe von A bis Z',
      bildTitel: 'Vertrieb, Sichtbarkeit und KI, kurz erklärt.',
      aktiv: 'kostenlos',
      schema: [{ '@type': 'DefinedTermSet', '@id': `${BASIS_B}#begriffe`, name: 'Begriffe aus Vertrieb, Sichtbarkeit und KI', inLanguage: 'de-DE', hasDefinedTerm: sortiert.map((x) => ({ '@type': 'DefinedTerm', '@id': `${BASIS_B}#${x.id}`, name: x.name, description: klar(x.text), url: `${BASIS_B}#${x.id}`, inDefinedTermSet: { '@id': `${BASIS_B}#begriffe` } })) }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, 'Begriffe']])}${vorzeile('Begriffe von A bis Z')}<h1 id="held-titel">${titel('Begriffe,', 'kurz erklärt.')}</h1><p class="lead">Die Wörter, die in Vertrieb, Sichtbarkeit und bei der Einführung von KI immer wieder fallen. So, wie wir sie verwenden.</p>
<nav class="az" aria-label="Buchstaben">${gruppen.map((g) => `<a href="#b-${slug(g.g)}">${e(g.g)}</a>`).join('')}</nav></div>
</div></section>
<section class="abschnitt" aria-label="Begriffe"><div class="w"><div class="begriffe erscheint">
${gruppen.map((g) => `<section class="begriff-gruppe" aria-labelledby="b-${slug(g.g)}"><h2 class="buchstabe" id="b-${slug(g.g)}">${e(g.g)}</h2><dl>${g.liste.map((x) => `<div id="${x.id}"><dt>${e(x.name)}</dt><dd><p>${t(x.text)}</p>${x.link ? textlink(x.link, 'Mehr dazu') : ''}</dd></div>`).join('')}</dl></section>`).join('\n')}
</div></div></section>
${schlussakt({ quelle: 'begriffe_ende' })}`,
    });
  }

  // ── Häufige Fragen: alle an einem Ort ──
  {
    // Fragen aus den Produktblättern; was nur für ein Angebot gilt, sagt die Frage hier dazu (sonst liest man es für beide Mandate).
    const UMBENANNT = { 'Wie viel Zeit kostet mich das?': 'Wie viel Zeit kostet mich der Head of Sales?', 'Wie viel Zeit bringen Sie ein?': 'Wie viel Zeit bringen Sie beim Chief Sales Officer ein?', 'Stellen Sie unsere Vertriebler ein?': 'Stellen Sie als CSO unsere Vertriebler ein?', 'Kann ich später zum Head of Sales wechseln?': 'Kann ich vom CSO zum Head of Sales wechseln?', 'Was passiert am Ende?': 'Was passiert am Ende des CSO-Mandats?' };
    const ausBlatt = (id, ausser) => produktBlatt(angebot(id)).fragen.filter((f) => !ausser.test(f.frage)).map((f) => ({ f: UMBENANNT[f.frage] ?? f.frage, a: f.antwort }));
    const gruppen = [
      ['vorab', 'Bevor Sie fragen', F.einwaende],
      ['einstieg', 'Einstieg und Innovations-Check', faqVon(seite.check_faq)],
      ['vertrieb', 'Vertrieb', [...zuschneiden(faqVon(['was-ist-der-unterschied-zwischen-head', 'was-kostet-der-tagesworkshop-und-was']), 'vertrieb'), ...ausBlatt('head-of-sales', /Unterschied|nach 3 Monaten/), ...ausBlatt('cso', /Unterschied|Investoren/)]],
      ['sichtbarkeit', 'Homepages und Videos', [...faqVon(['wie-schnell-ist-meine-homepage-fertig', 'kann-ich-spaeter-auf-ein-groesseres', 'sind-eure-videos-ki-generiert']), ...ausBlatt('homepage-story', /Wie schnell|größeres Paket/), ...ausBlatt('video-serie', /Kundenstimmen-Videos/)]],
      ['vertraege', 'Preise und Verträge', faqVon(['sind-die-preise-netto', 'gibt-es-rabatt', 'kann-ich-vorzeitig-kuendigen'])],
    ];
    neu('fragen/index.html', {
      seo: 'fragen',
      bildVorzeile: 'Häufige Fragen',
      bildTitel: 'Was Sie vor dem ersten Gespräch wissen wollen.',
      aktiv: 'kostenlos',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, 'Häufige Fragen']])}${vorzeile('Häufige Fragen')}<h1 id="held-titel">${titel('Häufige Fragen.', 'Kurz beantwortet.')}</h1><p class="lead">Was Gründer, Unternehmer und Mittelständler uns vor dem ersten Gespräch fragen. Fehlt Ihre Frage, schreiben Sie uns an <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p>
<nav class="az breit" aria-label="Themen">${gruppen.map(([k, n]) => `<a href="#fragen-${k}">${e(n)}</a>`).join('')}</nav></div>
</div></section>
${gruppen.map(([k, n, liste]) => fragen(liste, n, { id: `fragen-${k}`, marke: 'Fragen', hinweis: false })).join('\n')}
${schlussakt({ quelle: 'fragen_ende' })}`,
    });
  }

  // ── Preise: alles auf einer Seite ──
  {
    const zeile = (a) => `<tr><th scope="row"><a class="unterstrichen" href="${produktPfad(a)}">${e(a.name)}</a>${bald(a) ? ' <span class="marke-bald">Bald</span>' : ''}</th><td data-name="Preis netto">${e(preisVoll(a))}</td><td data-name="Konditionen">${bald(a) ? 'Festpreis mit klarem Umfang, vorab vereinbart; Start in Kürze' : t([a.preis_zusatz, F.umfang[a.id]].filter(Boolean).join(' · '))}</td></tr>`;
    const frei = [[erstLink(), F.erstgespraech.name, 'per Video, klärt, ob und womit wir helfen können'], ['/innovations-check/', 'Innovations-Check', 'rund 10 Minuten, Ergebnis sofort'], ['/innovations-check/', '90-Tage-Umsetzungsgespräch', '60 Minuten mit Kevin nach dem Check, Top 3 schriftlich'], ['/abend/', F.abend.titel, 'auf Einladung, für Gäste']];
    const kopfZeile = '<thead><tr><th scope="col">Angebot</th><th scope="col">Preis netto</th><th scope="col">Konditionen</th></tr></thead>';
    const tabelle = (titelText, zeilenHtml, { zeigen = true } = {}) => `${zeigen ? `<h3 class="gruppe-titel">${e(titelText)}</h3>` : ''}<div class="tabelle-huelle erscheint"><table class="vergleich text preis-tabelle"><caption class="sr">${e(titelText)}</caption>${kopfZeile}<tbody>${zeilenHtml}</tbody></table></div>`;
    const angeboteAlle = BEREICHE.flatMap(produkteIn);
    neu('preise/index.html', {
      seo: 'preise',
      bildVorzeile: 'Preise',
      bildTitel: 'Alle Preise auf einen Blick. Fest und netto.',
      schema: [{ '@type': 'OfferCatalog', '@id': `${absolut('/preise/')}#katalog`, name: 'Preise von Fokus Innovation', numberOfItems: angeboteAlle.length, itemListElement: angeboteAlle.filter((a) => !bald(a)).flatMap((a) => [angebotDaten(a)].flat().map((o) => ({ ...o, itemOffered: { '@type': 'Service', name: a.name, url: absolut(produktPfad(a)) } }))) }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Preise']])}${vorzeile('Preise')}<h1 id="held-titel">${titel('Alle Preise.', 'Fest, offen und netto.')}</h1><p class="lead">Jedes Angebot hat einen festen Preis, einen festen Ablauf und klare Konditionen. Hier stehen alle auf einer Seite. Die Details finden Sie auf der Seite des Angebots.</p></div>
</div></section>
<section class="abschnitt" aria-labelledby="kostenlos-titel"><div class="w">${abKopf({ marke: 'Der Einstieg', h2: 'Kostenlos', lead: 'Erstgespräch, Innovations-Check und das Gespräch danach kosten nichts und verpflichten zu nichts.', id: 'kostenlos-titel' })}
${tabelle('Kostenlos', frei.map(([h, n, z]) => `<tr><th scope="row"><a class="unterstrichen" href="${h}">${e(n)}</a></th><td data-name="Preis netto">kostenlos</td><td data-name="Konditionen">${e(z)}</td></tr>`).join(''), { zeigen: false })}</div></section>
${BEREICHE.map((k) => `<section class="abschnitt" aria-labelledby="preise-${k}"><div class="w">${abKopf({ marke: B[k].name, nr: B[k].nr, h2: B[k].paar, lead: F.angebote_lead[k], id: `preise-${k}` })}
${gruppenIn(k).map((g, _, alle) => tabelle(g.name || B[k].name, g.liste.map(zeile).join(''), { zeigen: alle.length > 1 && Boolean(g.name) })).join('\n')}${k === 'sichtbarkeit' ? `<h3 class="gruppe-titel">Dazu buchbar</h3><dl class="daten erscheint">${inhalt.zusatzoptionen.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.fuer)}: ${e(z.leistung)}</span></dt><dd>${e(z.preis)}</dd></div>`).join('')}</dl>` : ''}</div></section>`).join('\n')}
<section class="abschnitt" aria-labelledby="konditionen-titel"><div class="w">${abKopf({ marke: 'Gut zu wissen', h2: 'Zahlung und Konditionen', id: 'konditionen-titel' })}
<div class="zwei-teile"><div class="erscheint">${punkte(inhalt.konditionen)}</div><div class="erscheint"><p>${t(F.fragen_zuschnitt.vertrieb['gibt-es-rabatt'])} ${t(F.fragen_zuschnitt.sichtbarkeit['gibt-es-rabatt'])}</p><p>${t(F.preise_nebenkosten)}</p><p class="leise klein-text">Unsere Angebote richten sich an Unternehmen.</p></div></div></div></section>
${schlussakt({ quelle: 'preise_ende' })}`,
    });
  }

  // ── Dateien für Suchmaschinen und KI-Suchen ──
  const htmlSeiten = seiten.filter((s) => s.pfad.endsWith('.html') && s.pfad !== '404.html');
  seiten.push({
    pfad: 'robots.txt', datei: true,
    html: SEO.oeffentlich
      ? `User-agent: *\nAllow: /\n\nSitemap: ${absolut('/sitemap.xml')}\n`
      : '# Vorschau: noch nicht für Suchmaschinen freigegeben.\nUser-agent: *\nDisallow: /\n',
  });
  seiten.push({
    pfad: 'sitemap.xml', datei: true,
    html: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${htmlSeiten.map((s) => `<url><loc>${absolut(webPfad(s.pfad))}</loc><lastmod>${s.geaendert}</lastmod></url>`).join('\n')}\n</urlset>\n`,
  });
  seiten.push({
    pfad: 'site.webmanifest', datei: true,
    html: `${JSON.stringify({ name: F.marke.name, short_name: 'Fokus', description: klar(F.marke.beschreibung), lang: 'de', start_url: '/', display: 'browser', background_color: '#F6F4F0', theme_color: '#F6F4F0', icons: [{ src: '/assets/bild/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/bild/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2)}\n`,
  });
  seiten.push({ pfad: `${SEO.indexnow}.txt`, datei: true, html: `${SEO.indexnow}\n` });

  // llms.txt (Vorschlag llmstxt.org): kurzer Wegweiser für KI-Assistenten, dazu llms-full.txt mit allen Inhalten als Klartext.
  const mdLink = (n, p) => `[${n}](${absolut(p)})`;
  const angebotMd = (a) => `- ${mdLink(a.name, produktPfad(a))}: ${bald(a) ? 'Start in Kürze, Preis folgt zum Start' : `${a.preis} netto${a.preis_zusatz ? ` (${klar(a.preis_zusatz)})` : ''}`}. ${klar(F.kurztexte[a.id] ?? produktBlatt(a)?.versprechen ?? a.fuer_wen ?? '')}${bald(a) ? ' Startet in Kürze.' : ''}`;
  const faktenMd = [...F.fakten, ['Betreiber', `${anbieter.name}, ${anbieter.adresse.map(klar).join(', ')}`], ['Kontakt', seite.kontakt.mail]].map(([k, v]) => `- ${k}: ${klar(v)}`).join('\n');
  const leistungenMd = BEREICHE.map((k) => `### ${B[k].name}: ${B[k].paar}\n\n${klar(B[k].kurz)}\n\n${k === 'innovation' ? `- ${mdLink('Innovations-Check', '/innovations-check/')}: kostenlos, rund 10 Minuten. ${klar(F.check.text)}\n` : ''}${produkteIn(k).map(angebotMd).join('\n')}`).join('\n\n');
  seiten.push({
    pfad: 'llms.txt', datei: true,
    html: `# ${F.marke.name}

> ${klar(F.marke.beschreibung)} Claim: „${F.marke.claim}“

${klar(F.start.lead)} Alle Preise sind fest, netto und auf der Website veröffentlicht.

## Auf einen Blick

${faktenMd}

## Leistungen

${leistungenMd}

## Wissen

${W.artikel.map((a) => `- ${mdLink(a.titel, artikelPfad(a))}: ${klar(a.beschreibung)}`).join('\n')}

## Weitere Seiten

- ${mdLink('Alle Preise', '/preise/')}: jedes Angebot mit Preis und Konditionen
- ${mdLink('Häufige Fragen', '/fragen/')}: Check, Vertrieb, Homepages, Videos, Verträge
- ${mdLink('Begriffe von A bis Z', '/begriffe/')}: ${W.begriffe.length} Begriffe aus Vertrieb, Sichtbarkeit und KI
- ${mdLink(F.abend.titel, '/abend/')}: ${klar(F.abend.text)}
- ${mdLink('Über uns', '/ueber-uns/')}: Leitidee, Team, Werte
- ${mdLink('Kontakt', '/kontakt/')}: ${seite.kontakt.mail}

## Optional

- ${mdLink('Alle Inhalte als Klartext', '/llms-full.txt')}
`,
  });
  const artikelMd = (a) => `## ${a.titel}\n\nQuelle: ${absolut(artikelPfad(a))} · ${autor.name} · ${a.aktualisiert}\n\nKurz gesagt: ${klar(a.kurz)}\n\n${a.abschnitte.map((x) => {
    const teile = [`### ${x.h}`];
    if (x.faq) teile.push(klar(frageAus({ faq: x.faq }, a.bereich).a));
    for (const p of x.absaetze ?? []) teile.push(klar(p));
    if (x.punkte) teile.push(x.punkte.map((p) => `- ${klar(p)}`).join('\n'));
    if (x.schritte) teile.push(x.schritte.map((s, i) => `${i + 1}. ${s.titel}: ${klar(s.text)}`).join('\n'));
    if (x.tabelle) teile.push(`${x.tabelle.titel}${x.tabelle.hinweis ? ` (${klar(x.tabelle.hinweis)})` : ''}:\n${x.tabelle.zeilen.map((z) => `- ${z.map(klar).filter(Boolean).join(' | ')}`).join('\n')}`);
    if (x.zeitplan_von) teile.push(produktBlatt(angebot(x.zeitplan_von)).ablauf.zeilen.map((z) => `- ${z.map(klar).filter(Boolean).join(': ')}`).join('\n'));
    for (const k of [x.beleg, x.beleg_danach].filter(Boolean)) teile.push(`${F.belege[k].wert} ${klar(F.belege[k].text)} (Quelle: ${F.belege[k].quelle}, ${F.belege[k].link})`);
    for (const p of x.absaetze_danach ?? []) teile.push(klar(p));
    return teile.join('\n\n');
  }).join('\n\n')}\n\n${a.fragen.map((x) => frageAus(x, a.bereich)).map((f) => `Frage: ${klar(f.f)}\nAntwort: ${klar(f.a)}`).join('\n\n')}`;
  const fragenAlle = [...new Map([...faqVon(seite.check_faq), ...inhalt.faq].map((f) => [f.id, f])).values()];
  seiten.push({
    pfad: 'llms-full.txt', datei: true,
    html: `# ${F.marke.name}: alle Inhalte als Klartext

Stand: ${SEO.stand}. Website: ${absolut('/')}. Diese Datei fasst die Website für KI-Assistenten zusammen. Maßgeblich sind die Seiten selbst.

## Wer wir sind

${klar(F.marke.beschreibung)} ${klar(F.leitidee.lead)} ${F.leitidee.absaetze.map(klar).join(' ')}

${faktenMd}

${F.team.map((p) => `- ${p.name} (${p.rolle}): ${klar(p.text)}`).join('\n')}

Was wir nicht sind: ${F.nicht.map((x) => `${x.titel} (${klar(x.text)})`).join('; ')}.

## Leistungen und Preise

${leistungenMd}

Zahlung und Konditionen: ${inhalt.konditionen.map(klar).join('; ')}.

## Häufige Fragen

${fragenAlle.map((f) => `Frage: ${klar(f.f)}\nAntwort: ${klar(f.a)}`).join('\n\n')}

## Begriffe

${[...W.begriffe].sort((x, y) => x.name.localeCompare(y.name, 'de')).map((x) => `- ${x.name}: ${klar(x.text)}`).join('\n')}

# Ratgeber

${W.artikel.map(artikelMd).join('\n\n')}
`,
  });
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
  const titel = new Map();
  const beschreibungen = new Map();
  let platzhalter = 0;
  for (const s of seiten) {
    const sichtbar = s.html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    for (const [re, was] of SPERRWOERTER) if (re.test(sichtbar)) fehler.push(`${s.pfad}: ${was}`);
    if (/makeinnovation/i.test(sichtbar.replace(/kevin@makeinnovation\.de/g, ''))) fehler.push(`${s.pfad}: alte Domain im Text`);
    if (/\bZoe\b/.test(sichtbar) && !/KI-Assistentin/.test(sichtbar)) fehler.push(`${s.pfad}: Zoe ohne Kennzeichnung als KI-Assistentin`);
    if (/\{(preis|ab|zusatz):/.test(s.html)) fehler.push(`${s.pfad}: Platzhalter nicht ersetzt`);
    if (s.datei) continue;
    if (/\sstyle="/.test(s.html)) fehler.push(`${s.pfad}: Inline-Stil`);
    if (/<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>/.test(s.html)) fehler.push(`${s.pfad}: Inline-Skript`);
    if (/\son[a-z]+="/.test(s.html)) fehler.push(`${s.pfad}: Ereignis-Attribut`);
    if (/<(script|img|link|iframe|source|video)\b[^>]*\s(src|href)="https?:/.test(s.html.replace(/<link rel="(canonical|alternate)"[^>]*>/g, ''))) fehler.push(`${s.pfad}: fremde Quelle`);
    if (/<form\b/.test(s.html)) fehler.push(`${s.pfad}: Formular`);
    platzhalter += (s.html.match(/class="ph"/g) ?? []).length;
    for (const [, href] of s.html.matchAll(/\shref="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith('/check') || href === '/newsletter' || BUCHUNG.test(href) || href.startsWith('/css/') || href.startsWith('/assets/') || ['/favicon.ico', '/site.webmanifest'].includes(href)) continue;
      const [teil, hash] = href.split('#');
      const seite = teil ? ziel(teil.split('?')[0]) : s.pfad;
      if (!pfade.has(seite)) { fehler.push(`${s.pfad}: Link ins Leere ${href}`); continue; }
      if (hash && !ids.get(seite).has(hash)) fehler.push(`${s.pfad}: Anker fehlt ${href}`);
    }
    // Suche: ein h1, Titel und Beschreibung in Google-Länge und je Seite einmalig, Canonical, gültige strukturierte Daten.
    const h1 = (s.html.match(/<h1\b/g) ?? []).length;
    if (h1 !== 1) fehler.push(`${s.pfad}: ${h1} statt einer Hauptüberschrift`);
    if (s.pfad === '404.html') continue;
    if (s.titel.length < 15 || s.titel.length > 65) fehler.push(`${s.pfad}: Titel hat ${s.titel.length} Zeichen (15–65)`);
    if (s.beschreibung.length < 110 || s.beschreibung.length > 165) fehler.push(`${s.pfad}: Beschreibung hat ${s.beschreibung.length} Zeichen (110–165)`);
    if (titel.has(s.titel)) fehler.push(`${s.pfad}: Titel doppelt mit ${titel.get(s.titel)}`); else titel.set(s.titel, s.pfad);
    if (beschreibungen.has(s.beschreibung)) fehler.push(`${s.pfad}: Beschreibung doppelt mit ${beschreibungen.get(s.beschreibung)}`); else beschreibungen.set(s.beschreibung, s.pfad);
    if (!s.html.includes(`<link rel="canonical" href="https://`)) fehler.push(`${s.pfad}: Canonical fehlt`);
    const ld = s.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    try {
      const daten = JSON.parse(ld[1]);
      for (const knoten of daten['@graph']) for (const [k, v] of Object.entries(knoten)) if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) fehler.push(`${s.pfad}: strukturierte Daten, ${knoten['@type']}.${k} leer`);
      for (const f of daten['@graph'].filter((x) => x['@type'] === 'FAQPage').flatMap((x) => x.mainEntity)) if (!sichtbar.replace(/\s+/g, ' ').includes(f.name.replace(/&/g, '&amp;').slice(0, 40))) fehler.push(`${s.pfad}: Frage in den Daten, aber nicht auf der Seite: ${f.name}`);
    } catch (err) { fehler.push(`${s.pfad}: strukturierte Daten ungültig (${err.message})`); }
    if (s.bild && !existsSync(join(ORDNER, s.bild.datei))) fehler.push(`${s.pfad}: Vorschaubild fehlt (node bilder.mjs)`);
  }
  for (const datei of ['css/fokus.css', 'css/film.css', 'js/frueh.js', 'js/seite.js', 'js/film.js', 'js/szene.js', 'js/rechner.js', 'assets/zeichen.svg', 'assets/schriften/schibsted-grotesk-latin.woff2', 'assets/bild/logo.png', 'assets/bild/apple-touch-icon.png', 'assets/bild/icon-192.png', 'assets/bild/icon-512.png', 'favicon.ico']) if (!existsSync(join(ORDNER, datei))) fehler.push(`fehlt: ${datei}${/bild|favicon/.test(datei) ? ' (node bilder.mjs)' : ''}`);
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
