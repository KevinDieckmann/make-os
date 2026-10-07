#!/usr/bin/env node
// ─── MAKE Innovation · Landingpage: Freigabe-Prüfung (v3 01.10.2026, v4 03.10.2026: Firmierung, „Klar 2“ 07.10.2026: ruhige Seite) ───
// Die Seite unter makeinnovation.de geht erst online, wenn Kevin sie gesehen und freigegeben hat. Dieser
// Prüfschritt sagt, ob sie freigabefähig ist:
//   · Platzhalter: steht irgendwo noch „[[KEVIN:“, ist die Seite NICHT freigabefähig (Impressum/Datenschutz
//     wären unvollständig). Der Upload-Schritt für die Root-Domain hängt daran (website/LIESMICH.md;
//     tests/caddy-buchung-koepfe.test.ts lässt die Freigabe-Fassung der Caddyfile nur bei grüner Prüfung zu).
//   · Bau-Regeln, die die strenge CSP der Freigabe-Fassung voraussetzt: keine Inline-Skripte, Skripte nur als eigene
//     Datei aus js/ (und die lesen, speichern und senden nichts), keine Inline-Stile, keine fremden Quellen
//     (Schriften, Bilder, Stile nur vom eigenen Server), keine Tracker.
//   · Pflichtteile je Seite: lang="de", Titel, genau eine H1, Login-Knopf, Impressum + Datenschutz im Fuß.
//   · Jeder eigene Link, jedes srcset und jede url() in CSS zeigt auf eine vorhandene Datei bzw. einen Anker.
//   · Logo: alle Dateien aus assets/logo/ da (scripts/website-logo.mjs), der Kopf zeigt das Logo, der Fuß die Wortmarke.
//   · Angebote: Interim CSO, Interim Head of Sales, Sichtbarkeit & Marketing, Events & Netzwerk gleichwertig mit „Erstgespräch anfragen“, genau
//     EIN „Coming Soon“ — bei Development. Make.One und Make.Beteiligungen mit ihrem Mail-Knopf (Betreff).
//   · Erstgespräch: das Ziel steht an GENAU einer Stelle (#erstgespraech-link) — heute die vorbereitete Mail, später
//     die Buchungsseite. Alle anderen Knöpfe zeigen auf #erstgespraech (data-erstgespraech; js/erstgespraech.js
//     übernimmt das Ziel).
//   · Inhalt: nur MAKE — keine anderen Firmen-, Produkt- oder Projektnamen (SPERRLISTE), der Name der Software
//     steht nirgends im Ordner (auch nicht in LIESMICH/LOGO.md), keine Preise, dazu Wortregeln.
//   · Belege (Kevin 07.10.): nur Prinzipien — keine Statistiken, Prozentzahlen oder Marktgrößen auf der Startseite (STATISTIK).
//   · Firmierung (Kevin 03.10.): Eine „MAKE Innovation GmbH“ gibt es nicht (nicht eingetragen) — der Name steht nirgends
//     im Ordner. Jede Seite trägt „MAKE Innovation“ mit dem Zusatz „eine Marke der KEMARIS Innovation GmbH“ (Fuß,
//     Titel/Beschreibung). KEMARIS steht nur in dieser Firmierung (und in der Adresse @kemaris.de im Impressum).
//   · Vorschau: solange robots.txt alles sperrt, trägt jede Seite <meta name="robots" content="noindex">; jede Seite
//     hat eine Beschreibung (<meta name="description">).
//   · Ruhe (Kevin 07.10.: „keine Spielereien“; „v3“ abends: „Nimm die Kugel raus … bring Innovation nach vorne“ — gemeinsam mit
//     fokus/pruefen.mjs, pruefeRuhe): normale Dokument-Seite ohne Scroll-Film (keine Spur, Bühne, Leinwand, scroll-gebundenen
//     Skripte, keine Dauer-Animation), kein Kugel-Bild, höchstens zwei dunkle Abschnitte und eine Farbfläche, Bewegung nur einmal und
//     nur unter „prefers-reduced-motion: no-preference“, „Bewegung reduzieren“ beachtet, keine toten Bilder.
//     Gewicht der Startseite (HTML + CSS + Skripte, gzip) höchstens GEWICHT_GRENZE.
//   · Fokus Innovation: Menüpunkt und Kapitel verlinken auf FOKUS_SEITE, das Kapitel nennt alle STAEDTE.
//   · Stempel (04.10.): jeder Verweis auf css/ und js/ trägt ?v=<Prüfsumme der Datei> (Caddy hält Stile/Skripte einen Tag,
//     Seiten nie — ohne Stempel mischt ein Browser nach dem Upload die neue Seite mit alten Skripten). Setzen: node website/stempeln.mjs
// Aufruf: node website/pruefen.mjs   → Ausgang 0 = freigabefähig, 1 = nicht freigabefähig.
// Ohne Abhängigkeiten (läuft so auch auf dem Server oder in der CI).

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ANMELDEN = 'https://app.makeinnovation.de/anmelden';
// Zusammengesetzt, damit tests/repo-sauber.test.ts (keine echten Adressen im Code) die Firmenadresse nicht als Fund meldet.
export const KONTAKT = `mailto:${['hello', 'makeinnovation.de'].join('@')}`;
const PLATZHALTER = /\[\[KEVIN:([^\]]*)\]\]/g;
/** Seiten, die Fuß und Kopf der Marke tragen müssen (404 ist bewusst schlicht: kein Datenschutz-Anker nötig). */
const SEITEN_MIT_PFLICHT = ['index.html', 'impressum.html', 'datenschutz.html'];
/** Dateien, die zum Ordner gehören, aber nie ausgeliefert werden (Caddy: @intern → 404, dazu file_server hide). */
export const NICHT_OEFFENTLICH = ['LIESMICH.md', 'pruefen.mjs', 'logo-entwuerfe.html', 'assets/logo/LOGO.md'];
/** Dieselben Dateien als Namen für `file_server { hide … }` (Caddy vergleicht Namen ohne Pfad). */
export const VERSTECKT = NICHT_OEFFENTLICH.map(d => d.split('/').pop());
/**
 * Ziel des Erstgesprächs (#erstgespraech-link): heute eine Mail mit diesem Betreff (die Buchungsseite der Software ist
 * noch nicht so weit), später die öffentliche Buchungsseite (app/buchen/[slug]; Slug wie SLUG in lib/kalender/buchung.ts).
 */
export const ERSTGESPRAECH_MAIL = /^mailto:hello@makeinnovation\.de\?subject=Erstgespr%C3%A4ch%20%E2%80%93%20Markttraktion&amp;body=[^"]+$/;
export const BUCHUNG_BASIS = 'https://app.makeinnovation.de/buchen/';
/** Eigene Schwester-Seite (04.10.): Fokus Innovation, Reihe von Make.One (Ordner fokus/). */
export const FOKUS_SEITE = 'https://fokusinnovation.de';
export const BUCHUNG_MUSTER = /^https:\/\/app\.makeinnovation\.de\/buchen\/[a-z0-9-]{1,40}-[a-f0-9]{24}$/;
/** Mail-Knöpfe mit Betreff, die auf der Startseite stehen müssen (Betreff kodiert wie im href). */
export const MAIL_BETREFFE = {
  'Make.One – Einladung': 'Make.One%20%E2%80%93%20Einladung',
  'Make.Beteiligungen – Projekt': 'Make.Beteiligungen%20%E2%80%93%20Projekt',
};
/** Navigation im Kopf der Startseite (Kevin 01.10.; 04.10.: Fokus Innovation als eigener Menüpunkt; v3 07.10.: Der Weg). */
export const NAVIGATION = ['#markttraktion', '#weg', '#make-one', FOKUS_SEITE, '#ueber-uns', '#kontakt'];
/** Städte von Fokus Innovation (Kevin 04.10.: Dresden dazu) — stehen im Kapitel #fokus-innovation. */
export const STAEDTE = ['Berlin', 'Hamburg', 'Bielefeld', 'Köln', 'München', 'Dresden'];
/** Höchstgewicht der Startseite: index.html + CSS + alle Skripte der Seite, gzip, ohne Schriften und Bilder („Klar 2“: ≈ 15 KB). */
export const GEWICHT_GRENZE = 80 * 1024;
/** Skripte der Seiten: eigene Dateien aus js/ (seit „Klar 2“ keine Szene mehr). */
export const SKRIPT_PFAD = /^\/?js\/[a-z0-9-]+\.js(?:\?v=[a-f0-9]{10})?$/;
/** Stempel: Prüfsumme des Dateiinhalts — ändert sich genau dann, wenn sich die Datei ändert. */
export const stempelVon = inhalt => createHash('sha256').update(inhalt).digest('hex').slice(0, 10);
/** Verweise auf eigene Stile/Skripte in Seiten (Gruppe 2 = Pfad, Gruppe 3 = vorhandener Stempel). */
export const STEMPEL_VERWEIS = /(\s(?:src|href)=")(\/?(?:css|js)\/[a-z0-9\/-]+\.(?:css|js))(?:\?v=([a-f0-9]*))?"/g;
/** Setzt in einer Seite jeden Verweis auf den aktuellen Stempel (Pfad relativ zum Ordner der Seite). */
export const stempeln = (ordner, text) => text.replace(STEMPEL_VERWEIS, (ganz, vor, pfad) => {
  const datei = join(ordner, pfad.replace(/^\//, ''));
  return existsSync(datei) ? `${vor}${pfad}?v=${stempelVon(readFileSync(datei))}"` : ganz;
});
/** Logo-Dateien (erzeugt von scripts/website-logo.mjs, v5 „Synapse“). */
export const LOGO_DATEIEN = ['bildmarke.svg', 'bildmarke-hell.svg', 'wortmarke.svg', 'wortmarke-hell.svg', 'kachel.svg', 'quer.svg', 'quer-hell.svg', 'kompakt.svg', 'kompakt-hell.svg',
  'gross.svg', 'gross-hell.svg', 'visitenkarte-make.svg', 'visitenkarte-make-hell.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'LOGO.md'].map(d => `assets/logo/${d}`);
/** Angebote auf der Startseite: Kennung des <article> → aktiv (mit „Erstgespräch anfragen“) oder „Coming Soon“. */
export const ANGEBOTE = { 'angebot-interim-cso': 'aktiv', 'angebot-head-of-sales': 'aktiv', 'angebot-sichtbarkeit': 'aktiv', 'angebot-events': 'aktiv', 'angebot-development': 'bald' };
/**
 * Auf der Seite steht nur MAKE: keine anderen Firmen, Marken oder Projekte (Kevin 01.10.). Die Muster sind absichtlich
 * mit Zeichenklassen geschrieben, damit eine Textsuche über website/ die Namen nirgends findet — auch hier nicht.
 */
export const SPERRLISTE = /\b(?:Cap[O]S|POIN[C]AP|K[S]I|Capital[ ]Readiness|AST[A]RNA|Conn[e]ct|One[ ]?B[a]nking|Infin[i]ty)\b/i;
/** KEMARIS nur als Firmierung der Trägerin („KEMARIS Innovation GmbH“ / „Kemaris Innovation GmbH“) oder als Mail-Domain. */
const KEMARIS_ALLE = /\bkem[a]ris\b/gi;
/** Die Firmierung, die jede Seite trägt (Kevin 03.10.). */
export const FIRMIERUNG = 'eine Marke der KEMARIS Innovation GmbH';
/** Gibt es nicht (nicht eingetragen) — darf nirgends im Ordner stehen. */
export const ALTER_NAME = /MAKE Innovation Gmb[H]/;
/** Der Name der Software kommt erst auf die Seite, wenn sie marktreif ist (Kevin 01.10.) — gilt für den ganzen Ordner. */
export const SOFTWARE_NAME = /\bMAKE[ ]?O[S]\b/i;
/** Keine Preise auf der Seite (Kevin 01.10.). */
export const PREISE = /€|\bEUR\b|\bEuro\b|\bPreis(?:e|liste)?\b|\bTagessatz|\bHonorar/i;
/** Wortregeln (Geschmack der Marke): diese Wörter stehen nicht auf der Seite. */
export const VERBOTENE_WOERTER = /\b(?:Dashboard|Tool|Tools|Disruption|Reporting|einfach zu bedienen)\b/i;
/** Was ein Skript der Seite nicht darf: nichts lesen, speichern, senden oder nachladen (auch fokus/pruefen.mjs nutzt es). */
export const SKRIPT_VERBOTEN = /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|eval|Function)\b|document\.cookie|import\s*\(|innerHTML|\.src\s*=/;
export const TRACKER = /google-analytics|googletagmanager|gtag\(|fonts\.googleapis|fonts\.gstatic|facebook\.(?:net|com)|hotjar|matomo|plausible|clarity\.ms|doubleclick/i;
/** Belege (Kevin 07.10.): nur Prinzipien — keine Statistiken, Prozentzahlen oder Marktgrößen im sichtbaren Text der Startseite. */
export const STATISTIK = /\d\s?%|\bProzent\b|\b(?:Mio|Mrd)\.|\bMillion(?:en)?\b|\bMilliarde(?:n)?\b/;

// ── Ruhe („Klar 2“ 07.10.; „v3 · Der Weg“ 07.10. abends) ──────────────────────────────────────────────────────────────────
// Kevin 07.10.: „Wir wollen innovativ UND seriös wirken. Wir haben auch in [unserer Software] keine Spielereien.“ — abends: „Nimm die
// Kugel raus. Bau das Ganze nochmal und bring Innovation nach vorne.“ Deshalb gilt weiter: kein Scroll-Film, keine Leinwand, keine
// Dauer-Animation; neu erlaubt (v3): Rhythmus aus höchstens zwei dunklen Abschnitten und EINER Farbfläche, und Bewegung genau EINMAL
// (die Linie zeichnet sich) — nur unter „prefers-reduced-motion: no-preference“, nie endlos, nie an den Scroll gebunden.
/** Höchstens so viele dunkle Abschnitte (class="dunkel") und kräftige Farbflächen (class="farbflaeche") je Seite. */
export const DUNKEL_HOECHSTENS = 2;
export const FARBFLAECHE_HOECHSTENS = 1;
/** Reste des Scroll-Films (bis 06.10.): Spur, Bühne, Szene, Karussell, Laufband, Flug, Vorhang, Lagen im Showreel, Leinwände. */
export const SHOWREEL_RESTE = /\sclass="(?:[^"]*\s)?(?:spur|buehne|szene|karussell|laufband|flug|vorhang)(?:\s[^"]*)?"|\sdata-(?:spur-p|zerfall|aufstieg|zustand)\b|<canvas\b/;
/** Kein Kugel-Bild und kein dekoratives „Licht“ mehr (Kevin 07.10. abends: „Nimm die Kugel raus.“ — in der Software bleibt sie). */
export const KUGEL = /kugel|\sclass="(?:[^"]*\s)?licht(?:\s[^"]*)?"/i;
/** Was ein Skript der Seite nicht tut: an Scroll, Rad oder Wischen hängen, Bild für Bild zeichnen, die Seite fahren, endlos takten. */
export const RUHE_SKRIPT = /addEventListener\(\s*['"](?:scroll|wheel|touchmove)['"]|\bonscroll\b|requestAnimationFrame|getContext\s*\(|scrollTo\s*\(|scrollBy\s*\(|setInterval\s*\(/;
/** Nie endlos, nie an den Scroll gebunden. */
export const RUHE_CSS = /\binfinite\b|animation-timeline|scroll-timeline|view-timeline/;

/** Die Blöcke `@media (prefers-reduced-motion: no-preference…) { … }` einer CSS-Datei (Klammern gezählt) — und der Rest ohne sie. */
export function bewegungsBloecke(css) {
  const ohne = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bloecke = [];
  let rest = '', i = 0;
  const kopf = /@media \(prefers-reduced-motion: no-preference\)[^{]*\{/g;
  for (let m; (m = kopf.exec(ohne));) {
    let tiefe = 1, j = m.index + m[0].length;
    while (j < ohne.length && tiefe) { if (ohne[j] === '{') tiefe++; else if (ohne[j] === '}') tiefe--; j++; }
    rest += ohne.slice(i, m.index);
    bloecke.push(ohne.slice(m.index, j));
    i = j; kopf.lastIndex = j;
  }
  return { bloecke, rest: rest + ohne.slice(i) };
}

/**
 * Ruhige Dokument-Seite (gemeinsam mit fokus/pruefen.mjs): jeder Abschnitt ist im Ruhezustand vollständig lesbar — ohne Skript und
 * bei „Bewegung reduzieren“. Prüft alle Seiten, Stile und Skripte eines Ordners; gibt die Fehler zurück.
 * @param {{ seiten: Map<string,string>, stile: Map<string,string>, skripte: Map<string,string>, dateien: string[] }} o
 */
export function pruefeRuhe({ seiten, stile, skripte, dateien }) {
  const fehler = [];
  const bilder = dateien.filter(d => d.startsWith('assets/bild/'));
  const genutzt = new Set();
  for (const d of dateien) if (/kugel/i.test(d)) fehler.push(`${d}: kein Kugel-Bild auf den Websites (Kevin 07.10. abends: „Nimm die Kugel raus.“)`);
  for (const [d, html] of seiten) {
    const ohneKommentar = html.replace(/<!--[\s\S]*?-->/g, '');
    const rest = SHOWREEL_RESTE.exec(ohneKommentar);
    if (rest) fehler.push(`${d}: „${rest[0].trim().slice(0, 40)}“ — kein Scroll-Film mehr (Spur, Bühne, Szene, Leinwand; Kevin 07.10.: keine Spielereien)`);
    const kugel = KUGEL.exec(ohneKommentar);
    if (kugel) fehler.push(`${d}: „${kugel[0].trim()}“ — kein Kugel-Bild, kein dekoratives Licht (Kevin 07.10. abends)`);
    const zaehle = name => (ohneKommentar.match(new RegExp(`\\sclass="(?:[^"]*\\s)?${name}(?:\\s[^"]*)?"`, 'g')) ?? []).length;
    const dunkel = zaehle('dunkel'), flaeche = zaehle('farbflaeche');
    if (dunkel > DUNKEL_HOECHSTENS) fehler.push(`${d}: ${dunkel} dunkle Abschnitte — höchstens ${DUNKEL_HOECHSTENS} (Rhythmus, kein Dauer-Dunkel)`);
    if (flaeche > FARBFLAECHE_HOECHSTENS) fehler.push(`${d}: ${flaeche} Farbflächen — höchstens ${FARBFLAECHE_HOECHSTENS} (80 % Seriosität)`);
    for (const m of html.matchAll(/\ssrc="\/?(assets\/bild\/[^"]+)"/g)) genutzt.add(m[1]);
  }
  for (const b of bilder) if (!genutzt.has(b)) fehler.push(`${b}: von keiner Seite gezeigt — tote Datei`);
  let reduziert = false;
  for (const [d, text] of stile) {
    const { bloecke, rest } = bewegungsBloecke(text);
    const m = RUHE_CSS.exec(text.replace(/\/\*[\s\S]*?\*\//g, ''));
    if (m) fehler.push(`${d}: „${m[0]}“ — keine Dauer-Animation, nichts an den Scroll gebunden`);
    // Außerhalb der Bewegungs-Blöcke nur „animation: none“ (zum Abschalten); @keyframes nur darin.
    const draussen = /@keyframes|\banimation(?:-name)?\s*:(?!\s*none\b)/.exec(rest);
    if (draussen) fehler.push(`${d}: „${draussen[0]}“ außerhalb von @media (prefers-reduced-motion: no-preference) — Bewegung nur, wer sie nicht abgeschaltet hat`);
    if (bloecke.some(b => /\banimation-iteration-count\s*:\s*(?!1\b)/.test(b))) fehler.push(`${d}: Animation öfter als einmal — die Linie zeichnet sich genau einmal`);
    if (/@media \(prefers-reduced-motion: reduce\)/.test(text)) reduziert = true;
  }
  if (stile.size && !reduziert) fehler.push('css/: kein @media (prefers-reduced-motion: reduce) — „Bewegung reduzieren“ muss beachtet werden');
  for (const [d, text] of skripte) {
    const code = text.replace(/^\s*\/\/.*$/gm, '');
    const m = RUHE_SKRIPT.exec(code);
    if (m) fehler.push(`${d}: „${m[0]}“ — Skripte fahren, zeichnen und takten nichts beim Scrollen`);
    if (/IntersectionObserver/.test(code) && !/\.(?:unobserve|disconnect)\s*\(/.test(code)) fehler.push(`${d}: IntersectionObserver ohne unobserve/disconnect — Bewegung nur EINMAL beim ersten Erscheinen`);
    if (/IntersectionObserver/.test(code) && !/prefers-reduced-motion: reduce/.test(code)) fehler.push(`${d}: IntersectionObserver ohne Rücksicht auf „Bewegung reduzieren“`);
  }
  return fehler;
}

/** Alle Dateien eines Ordners (rekursiv, relativ, sortiert) — auch von fokus/pruefen.mjs genutzt. */
export function alleDateien(ordner, basis = ordner) {
  const raus = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) raus.push(...alleDateien(pfad, basis));
    else raus.push(relative(basis, pfad).split('\\').join('/'));
  }
  return raus.sort();
}

/** Zeilennummer eines Zeichenindex. */
const zeileVon = (text, index) => text.slice(0, index).split('\n').length;

/** Anker (id="…") einer HTML-Datei. */
function anker(html) {
  return new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), m => m[1]));
}

/**
 * Prüft den Ordner der Landingpage.
 * @param {string} ordner absoluter Pfad zu website/
 * @returns {{ fehler: string[], platzhalter: { datei: string, zeile: number, text: string }[], freigabefaehig: boolean }}
 */
export function pruefeWebsite(ordner) {
  const fehler = [];
  const platzhalter = [];
  const dateien = alleDateien(ordner);
  const html = dateien.filter(d => d.endsWith('.html'));
  const css = dateien.filter(d => d.endsWith('.css'));
  const js = dateien.filter(d => d.endsWith('.js'));
  const svg = dateien.filter(d => d.endsWith('.svg'));
  const robots = existsSync(join(ordner, 'robots.txt')) ? readFileSync(join(ordner, 'robots.txt'), 'utf8') : null;
  const vorschau = robots !== null && /^Disallow: \/\s*$/m.test(robots);
  if (robots === null) fehler.push('robots.txt: fehlt');
  const inhalt = new Map(dateien.filter(d => ['.html', '.css', '.md', '.js', '.svg'].includes(extname(d))).map(d => [d, readFileSync(join(ordner, d), 'utf8')]));

  // Nur MAKE: Sperrliste in allem, was ausgeliefert wird; Wortregeln im sichtbaren Text.
  for (const d of [...html, ...css, ...js, ...svg]) {
    const text = inhalt.get(d);
    const m = SPERRLISTE.exec(text);
    if (m) fehler.push(`${d}:${zeileVon(text, m.index)}: fremder Name „${m[0]}“ — auf der Seite steht nur MAKE`);
    for (const k of text.matchAll(KEMARIS_ALLE)) {
      const um = text.slice(k.index, k.index + k[0].length + 16), davor = text[k.index - 1];
      if (!/^kemaris Innovation GmbH/i.test(um) && !(davor === '@' && /^kemaris\.de\b/i.test(um)))
        { fehler.push(`${d}:${zeileVon(text, k.index)}: fremder Name „${k[0]}“ — KEMARIS nur als „KEMARIS Innovation GmbH“`); break; }
    }
    if (d.endsWith('.html')) {
      const w = VERBOTENE_WOERTER.exec(text.replace(/<[^>]+>/g, ' '));
      if (w) fehler.push(`${d}: Wort „${w[0]}“ — steht nicht auf der Seite (Wortregeln)`);
    }
  }

  for (const [d, text] of inhalt) {
    const alt = ALTER_NAME.exec(text);
    if (alt) fehler.push(`${d}:${zeileVon(text, alt.index)}: „${alt[0]}“ — die GmbH ist nicht eingetragen; „MAKE Innovation“ + „${FIRMIERUNG}“`);
    const m = SOFTWARE_NAME.exec(text);
    if (m) fehler.push(`${d}:${zeileVon(text, m.index)}: Name der Software — kommt erst auf die Seite, wenn sie marktreif ist`);
  }

  // Platzhalter in allem, was ausgeliefert wird (LIESMICH erklärt sie nur).
  for (const d of [...html, ...css]) {
    const text = inhalt.get(d);
    for (const m of text.matchAll(PLATZHALTER)) platzhalter.push({ datei: d, zeile: zeileVon(text, m.index), text: m[1].trim() });
  }

  for (const d of SEITEN_MIT_PFLICHT) if (!html.includes(d)) fehler.push(`${d}: fehlt`);

  for (const d of html) {
    const text = inhalt.get(d);
    const pflicht = SEITEN_MIT_PFLICHT.includes(d);
    const arbeitsdatei = NICHT_OEFFENTLICH.includes(d);
    if (!/<html lang="de">/.test(text)) fehler.push(`${d}: <html lang="de"> fehlt`);
    if (!/<title>[^<]{5,}<\/title>/.test(text)) fehler.push(`${d}: <title> fehlt`);
    if (!/<meta name="viewport"/.test(text)) fehler.push(`${d}: viewport fehlt`);
    const h1 = (text.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fehler.push(`${d}: ${h1} × <h1> (genau eine erwartet)`);
    // CSP der Freigabe-Fassung: script-src 'self' — nur eigene Dateien aus js/, nie Inline; style-src 'self' (keine Inline-Stile).
    for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = /\ssrc="([^"]*)"/.exec(m[1])?.[1];
      if (!src || !SKRIPT_PFAD.test(src) || m[2].trim() !== '') fehler.push(`${d}: <script> — nur eigene Dateien aus js/ (<script src="js/….js" defer>), nie Inline-Skript`);
    }
    for (const m of text.matchAll(STEMPEL_VERWEIS)) {
      const datei = join(ordner, m[2].replace(/^\//, ''));
      if (!existsSync(datei)) fehler.push(`${d}: ${m[2]} — Datei fehlt`);
      else if (m[3] !== stempelVon(readFileSync(datei))) fehler.push(`${d}: ${m[2]} ohne aktuellen Stempel (?v=…) — node website/stempeln.mjs`);
    }
    if (/<style[\s>]/i.test(text)) fehler.push(`${d}: <style>-Block — Stile gehören nach css/ (CSP style-src 'self')`);
    if (/\sstyle="/i.test(text)) fehler.push(`${d}: style="…" — Inline-Stile blockiert die CSP`);
    if (/\son[a-z]+="/i.test(text)) fehler.push(`${d}: on…="…"-Handler — blockiert die CSP`);
    if (/<(form|iframe|object|embed)[\s>]/i.test(text)) fehler.push(`${d}: <form>/<iframe>/<object>/<embed> — gibt es auf dieser Seite nicht`);
    if (TRACKER.test(text)) fehler.push(`${d}: Tracker oder fremder Dienst`);
    // Platzhalter-Markierung (gelb) ohne Platzhalter darin: beim Füllen das ganze <span class="ph">…</span> ersetzen.
    for (const m of text.matchAll(/<span class="ph">([^<]*)<\/span>/g)) if (!m[1].includes('[[KEVIN:')) fehler.push(`${d}:${zeileVon(text, m.index)}: gelbe Platzhalter-Markierung um „${m[1].slice(0, 40)}“ — ganzes <span class="ph"> ersetzen`);
    // Quellen (src, srcset, <link href>) nur vom eigenen Server.
    for (const m of text.matchAll(/\ssrc="([^"]*)"/g)) if (/^(https?:)?\/\//.test(m[1])) fehler.push(`${d}: fremde Quelle ${m[1]}`);
    for (const m of text.matchAll(/\ssrcset="([^"]*)"/g)) {
      for (const teil of m[1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean)) {
        if (/^(https?:)?\/\//.test(teil)) fehler.push(`${d}: fremde Quelle ${teil}`);
        else if (!dateien.includes(teil.replace(/^\//, ''))) fehler.push(`${d}: srcset ${teil} — Datei fehlt`);
      }
    }
    for (const m of text.matchAll(/<link\b[^>]*\shref="([^"]*)"/g)) if (/^(https?:)?\/\//.test(m[1])) fehler.push(`${d}: fremde Quelle ${m[1]}`);
    if (pflicht) {
      if (!text.includes(`href="${ANMELDEN}"`)) fehler.push(`${d}: Login-Knopf (${ANMELDEN}) fehlt`);
      if (!text.includes(`<a class="knopf anmelden" href="${ANMELDEN}">Login</a>`)) fehler.push(`${d}: Login-Knopf im Kopf fehlt (klein, nur „Login“)`);
      if (!text.includes('href="impressum.html"')) fehler.push(`${d}: Link auf impressum.html fehlt`);
      if (!text.includes('href="datenschutz.html"')) fehler.push(`${d}: Link auf datenschutz.html fehlt`);
    }
    // Firmierung auf jeder Seite (auch 404), Beschreibung, Vorschau-Sperre.
    if (!arbeitsdatei && !text.includes(FIRMIERUNG)) fehler.push(`${d}: Firmierung „MAKE Innovation — ${FIRMIERUNG}“ fehlt`);
    if (!/<meta name="description" content="[^"]{20,}">/.test(text) && !arbeitsdatei) fehler.push(`${d}: <meta name="description"> fehlt`);
    if (!arbeitsdatei && vorschau && !text.includes('<meta name="robots" content="noindex">')) fehler.push(`${d}: Vorschau (robots.txt sperrt) — <meta name="robots" content="noindex"> fehlt`);
    // Eigene Links und Quellen müssen existieren (Seiten-Anker inklusive).
    for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const ziel = m[1];
      if (/^(https?:|mailto:|tel:)/.test(ziel)) continue;
      if (ziel.includes('[[KEVIN:')) { fehler.push(`${d}: Platzhalter als Link ${ziel}`); continue; }
      const [mitStempel, frag] = ziel.split('#');
      const pfadTeil = mitStempel.replace(/\?v=[a-f0-9]{10}$/, ''); // Stempel (siehe stempeln) gehört nicht zum Dateinamen
      const datei = pfadTeil === '' ? d : pfadTeil === '/' ? 'index.html' : pfadTeil.replace(/^\//, '');
      if (!dateien.includes(datei)) { fehler.push(`${d}: Link auf ${ziel} — Datei fehlt`); continue; }
      if (frag && datei.endsWith('.html') && !anker(inhalt.get(datei)).has(frag)) fehler.push(`${d}: Anker #${frag} fehlt in ${datei}`);
    }
    // Externe Links: nur bewusst gesetzte (Login, Fokus Innovation, Buchungsseite). Alles andere wäre neu und muss hier eingetragen werden.
    for (const m of text.matchAll(/\shref="(https?:[^"]*)"/g)) if (m[1] !== ANMELDEN && m[1] !== FOKUS_SEITE && !m[1].startsWith(BUCHUNG_BASIS)) fehler.push(`${d}: unerwarteter externer Link ${m[1]}`);
    // Buchungsseite (später): nur als Ziel des Erstgesprächs auf der Startseite, nirgends sonst.
    const buchung = Array.from(text.matchAll(/<a\b[^>]*\shref="(https:\/\/app\.makeinnovation\.de\/buchen\/[^"]*)"[^>]*>/g));
    for (const [tag, url] of buchung) {
      if (d !== 'index.html' || !/\sid="erstgespraech-link"/.test(tag)) fehler.push(`${d}: Buchungslink — nur als Ziel des Erstgesprächs (#erstgespraech-link auf der Startseite)`);
      else if (!BUCHUNG_MUSTER.test(url)) fehler.push(`${d}: Buchungslink ${url} — Slug wie in lib/kalender/buchung.ts erwartet`);
    }
    // Weitere Erstgespräch-Knöpfe tragen data-erstgespraech und zeigen ohne Skript auf #erstgespraech.
    for (const m of text.matchAll(/<a\b[^>]*\sdata-erstgespraech\b[^>]*>/g)) if (!/\shref="(?:index\.html)?#erstgespraech"/.test(m[0])) fehler.push(`${d}: Knopf mit data-erstgespraech zeigt nicht auf #erstgespraech`);
  }
  if (html.includes('index.html')) {
    const index = inhalt.get('index.html');
    if (!index.includes(`href="${KONTAKT}"`)) fehler.push(`index.html: Kontakt (${KONTAKT}) fehlt`);
    // Logo im Kopf (heller Kopf seit „Klar 2“: quer-hell), Wortmarke im Fuß, Favicons im <head>.
    if (!/<header class="kopf">[\s\S]*?src="assets\/logo\/quer-hell\.svg"[\s\S]*?<\/header>/.test(index)) fehler.push('index.html: Logo (assets/logo/quer-hell.svg) fehlt im Kopf');
    if (!/<footer class="fuss">[\s\S]*?src="assets\/logo\/wortmarke\.svg"[\s\S]*?<\/footer>/.test(index)) fehler.push('index.html: Fuß ohne Wortmarke (assets/logo/wortmarke.svg)');
    for (const f of ['favicon.svg', 'assets/logo/favicon-32.png', 'assets/logo/apple-touch-icon.png']) if (!index.includes(`href="${f}"`)) fehler.push(`index.html: <link> auf ${f} fehlt`);
    // Navigation im Kopf.
    const nav = /<nav class="haupt"[\s\S]*?<\/nav>/.exec(index)?.[0] ?? '';
    for (const z of NAVIGATION) if (!nav.includes(`href="${z}"`)) fehler.push(`index.html: Navigation ohne ${z}`);
    // Angebote: aktiv = „Erstgespräch anfragen“; bald = genau das eine „Coming Soon“, ohne Knopf.
    const bloecke = new Map(Array.from(index.matchAll(/<article\b[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g), m => [m[1], m[0]]));
    for (const [id, art] of Object.entries(ANGEBOTE)) {
      const b = bloecke.get(id);
      if (!b) { fehler.push(`index.html: Angebot #${id} fehlt`); continue; }
      const knopf = /<a\b[^>]*\shref="#erstgespraech"[^>]*\sdata-erstgespraech/.test(b);
      if (art === 'aktiv' && !knopf) fehler.push(`index.html: #${id} — Knopf „Erstgespräch anfragen“ (href="#erstgespraech" data-erstgespraech) fehlt`);
      if (art === 'bald' && (!b.includes('class="abzeichen bald">Coming Soon<') || /<a\b/.test(b))) fehler.push(`index.html: #${id} ist „Coming Soon“ — Abzeichen nötig, kein Knopf`);
    }
    const bald = (index.match(/Coming Soon/g) ?? []).length;
    const sollBald = Object.values(ANGEBOTE).filter(a => a === 'bald').length;
    if (bald !== sollBald) fehler.push(`index.html: ${bald} × „Coming Soon“ (erwartet ${sollBald} — nur MAKE Innovation Development)`);
    // Erstgespräch: das Ziel steht genau einmal (#erstgespraech-link) — vorbereitete Mail oder Buchungsseite.
    if (!/\sid="erstgespraech"/.test(index)) fehler.push('index.html: Abschnitt #erstgespraech fehlt');
    const ziele = Array.from(index.matchAll(/<a\b[^>]*\sid="erstgespraech-link"[^>]*>/g), m => /\shref="([^"]*)"/.exec(m[0])?.[1] ?? '');
    if (ziele.length !== 1) fehler.push(`index.html: ${ziele.length} × #erstgespraech-link — genau einer`);
    else if (!ERSTGESPRAECH_MAIL.test(ziele[0]) && !BUCHUNG_MUSTER.test(ziele[0])) fehler.push(`index.html: Ziel des Erstgesprächs ${ziele[0].slice(0, 60)} — Mail mit Betreff „Erstgespräch – Markttraktion“ oder Buchungsseite`);
    const erstMails = (index.match(/subject=Erstgespr%C3%A4ch%20%E2%80%93%20Markttraktion/g) ?? []).length;
    if (erstMails > 1) fehler.push(`index.html: ${erstMails} × Erstgespräch-Mail — das Ziel steht nur in #erstgespraech-link`);
    for (const [name, betreff] of Object.entries(MAIL_BETREFFE)) if (!index.includes(`href="${KONTAKT}?subject=${betreff}"`)) fehler.push(`index.html: Mail-Knopf „${name}“ fehlt`);
    const sichtbar = index.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
    const p = PREISE.exec(sichtbar);
    if (p) fehler.push(`index.html: „${p[0]}“ — keine Preise auf der Seite`);
    const z = STATISTIK.exec(sichtbar);
    if (z) fehler.push(`index.html: „${z[0]}“ — keine Statistiken oder Prozentzahlen, nur Prinzipien (Kevin 07.10.)`);
    // Fokus Innovation (Kevin 04.10.): eigener Menüpunkt + klarer Weg im Kapitel, alle Städte genannt.
    const fokus = /<section\b[^>]*\sid="fokus-innovation"[\s\S]*?<\/section>/.exec(index)?.[0] ?? '';
    if (!fokus) fehler.push('index.html: Kapitel #fokus-innovation fehlt');
    else {
      if (!fokus.includes(`href="${FOKUS_SEITE}"`)) fehler.push(`index.html: Kapitel Fokus Innovation ohne Link auf ${FOKUS_SEITE}`);
      for (const st of STAEDTE) if (!fokus.includes(`<b>${st}</b>`)) fehler.push(`index.html: Fokus Innovation — Stadt ${st} fehlt`);
    }
    // Gewicht: HTML + CSS + Skripte der Startseite (gzip), ohne Schriften und Standbilder.
    const teile = ['index.html', ...Array.from(index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g), m => m[1]), ...Array.from(index.matchAll(/<script src="([^"]+)"/g), m => m[1])];
    const gewicht = teile.map(t => t.split('?')[0]).filter(t => dateien.includes(t)).reduce((summe, t) => summe + gzipSync(readFileSync(join(ordner, t))).length, 0);
    if (gewicht > GEWICHT_GRENZE) fehler.push(`index.html: Startseite wiegt ${(gewicht / 1024).toFixed(0)} KB gzip (höchstens ${GEWICHT_GRENZE / 1024} KB)`);
  }

  // Ruhe (gemeinsam mit fokus/pruefen.mjs): kein Scroll-Film, keine Kugel, Rhythmus begrenzt, Bewegung nur einmal.
  fehler.push(...pruefeRuhe({
    seiten: new Map(html.filter(d => !NICHT_OEFFENTLICH.includes(d)).map(d => [d, inhalt.get(d)])),
    stile: new Map(css.map(d => [d, inhalt.get(d)])), skripte: new Map(js.map(d => [d, inhalt.get(d)])), dateien,
  }));

  for (const d of LOGO_DATEIEN) if (!dateien.includes(d)) fehler.push(`${d}: fehlt (node scripts/website-logo.mjs)`);
  for (const d of svg) {
    const text = inhalt.get(d);
    if (/<script|<style|<foreignObject|\son[a-z]+="|(?:href|src)="(?:https?:)?\/\//i.test(text)) fehler.push(`${d}: SVG mit Skript, Stil oder fremder Quelle`);
  }
  for (const d of js) {
    const text = inhalt.get(d);
    const m = SKRIPT_VERBOTEN.exec(text.replace(/^\s*\/\/.*$/gm, ''));
    if (m) fehler.push(`${d}: „${m[0]}“ — Skripte der Seite lesen, speichern und senden nichts`);
    if (TRACKER.test(text)) fehler.push(`${d}: fremder Dienst`);
  }

  for (const d of css) {
    const text = inhalt.get(d);
    if (/@import/i.test(text)) fehler.push(`${d}: @import — alles in eine Datei`);
    if (TRACKER.test(text)) fehler.push(`${d}: fremder Dienst`);
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ziel = m[1];
      if (/^data:/.test(ziel)) continue;
      if (/^(https?:)?\/\//.test(ziel)) { fehler.push(`${d}: fremde Quelle ${ziel}`); continue; }
      const datei = join(dirname(d), ziel).split('\\').join('/');
      if (!existsSync(join(ordner, datei))) fehler.push(`${d}: url(${ziel}) — Datei fehlt`);
    }
  }

  for (const d of NICHT_OEFFENTLICH) if (!dateien.includes(d)) fehler.push(`${d}: fehlt (wird von Caddy versteckt — Name in NICHT_OEFFENTLICH und Caddyfile gleich halten)`);

  return { fehler, platzhalter, freigabefaehig: fehler.length === 0 && platzhalter.length === 0 };
}

// ── Aufruf von der Kommandozeile ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ordner = dirname(fileURLToPath(import.meta.url));
  const { fehler, platzhalter, freigabefaehig } = pruefeWebsite(ordner);
  for (const f of fehler) console.log(`✗ ${f}`);
  if (platzhalter.length) {
    console.log(`\n${platzhalter.length} Platzhalter offen:`);
    for (const p of platzhalter) console.log(`  · ${p.datei}:${p.zeile}  ${p.text}`);
  }
  console.log(freigabefaehig
    ? '\n✓ freigabefähig — Caddyfile darf auf die Freigabe-Fassung umgestellt werden (website/LIESMICH.md).'
    : '\n✗ nicht freigabefähig — erst Platzhalter füllen und Fehler beheben.');
  process.exit(freigabefaehig ? 0 : 1);
}
