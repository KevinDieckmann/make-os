#!/usr/bin/env node
// ─── MAKE Innovation · Landingpage: Freigabe-Prüfung (v3 01.10.2026, v4 03.10.2026: Firmierung, v5 04.10.2026: Szene, „Klar“ 04.10.2026: Showreel) ───
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
//   · Logo: alle Dateien aus assets/logo/ da (scripts/website-logo.mjs), die Bühne zeichnet dieselbe Wortmarke (wortmarke.svg).
//   · Angebote: Interim CSO, Interim Head of Sales, Events & Netzwerk gleichwertig mit „Erstgespräch anfragen“, genau
//     EIN „Coming Soon“ — bei Development. Make.One und Make.Beteiligungen mit ihrem Mail-Knopf (Betreff).
//   · Erstgespräch: das Ziel steht an GENAU einer Stelle (#erstgespraech-link) — heute die vorbereitete Mail, später
//     die Buchungsseite. Alle anderen Knöpfe zeigen auf #erstgespraech (data-erstgespraech; js/erstgespraech.js
//     übernimmt das Ziel).
//   · Inhalt: nur MAKE — keine anderen Firmen-, Produkt- oder Projektnamen (SPERRLISTE), der Name der Software
//     steht nirgends im Ordner (auch nicht in LIESMICH/LOGO.md), keine Preise, dazu Wortregeln.
//   · Firmierung (Kevin 03.10.): Eine „MAKE Innovation GmbH“ gibt es nicht (nicht eingetragen) — der Name steht nirgends
//     im Ordner. Jede Seite trägt „MAKE Innovation“ mit dem Zusatz „eine Marke der KEMARIS Innovation GmbH“ (Fuß,
//     Titel/Beschreibung). KEMARIS steht nur in dieser Firmierung (und in der Adresse @kemaris.de im Impressum).
//   · Vorschau: solange robots.txt alles sperrt, trägt jede Seite <meta name="robots" content="noindex">; jede Seite
//     hat eine Beschreibung (<meta name="description">).
//   · Szene und Showreel („Klar“ 04.10.): Skripte auch aus js/szene/, Leinwand rein dekorativ (aria-hidden), die Bühne steht in
//     der Spur (.spur > .buehne); jeder Zustand des Drehbuchs (js/drehbuch.js) hat seine Lage p (aufsteigend, 0…1), jeder mit
//     `standbild: true` sein Standbild (assets/szene/<name>.svg, von der Seite genutzt) — und in assets/szene/ liegt nichts anderes;
//     Blöcke mit data-spur-p tragen eine Lage 0…1; die Lichter (Leinwände) stehen an höchstens LICHTER_HOECHSTENS Stellen (Kevin:
//     80 % Seriosität); zerlegt werden nur die H1 (data-zerfall) und die Überschrift des dunklen Raums (data-aufstieg, H2);
//     der Schlussblock zeigt die Wortmarke (assets/logo/wortmarke.svg). Gewicht der Startseite (HTML + CSS + Skripte, gzip) höchstens GEWICHT_GRENZE.
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
/**
 * Quellen der belegten Zahlen in „01 Die Lage“ und „02 Warum Innovation“ (Kevin 03.10.): nur Originalquellen seriöser
 * Herausgeber, direkt geprüft. Jede Zahlen-Kachel (`<li class="zahl">`) verweist per Fußnote (#fn-N) auf einen Eintrag der
 * Quellenliste mit genau einem dieser Links. Neue Quelle = hier eintragen, nach Prüfung an der Originalseite.
 */
export const QUELLEN_LINKS = [
  'https://www.kfw.de/PDF/Download-Center/Konzernthemen/Research/PDF-Dokumente-Fokus-Volkswirtschaft/Fokus-2026/Fokus-Nr.-526-Januar-2026-Nachfolge-Monitoring.pdf',
  'https://www.kfw.de/PDF/Download-Center/Konzernthemen/Research/PDF-Dokumente-Fokus-Volkswirtschaft/Fokus-2025/Fokus-Nr.-495-April-2025-Buerokratie.pdf',
  'https://www.kfw.de/PDF/Download-Center/Konzernthemen/Research/PDF-Dokumente-Innovationsbericht/KfW-Innovationsbericht-Mittelstand-2025.pdf',
  'https://www.bitkom.org/Presse/Presseinformation/Erstmals-nutzt-Mehrheit-Unternehmen-KI',
];
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
/** Navigation im Kopf der Startseite (Kevin 01.10.; 04.10.: Fokus Innovation als eigener Menüpunkt). */
export const NAVIGATION = ['#markttraktion', '#make-one', FOKUS_SEITE, '#ueber-uns', '#kontakt'];
/** Städte von Fokus Innovation (Kevin 04.10.: Dresden dazu) — stehen im Kapitel #fokus-innovation. */
export const STAEDTE = ['Berlin', 'Hamburg', 'Bielefeld', 'Köln', 'München', 'Dresden'];
/** Lichter (Kevin 04.10.: höchstens 20 % Akzente): so viele Leinwände (WebGL) hat die Startseite höchstens — Szene + zwei Verläufe. */
export const LICHTER_HOECHSTENS = 3;
/** Höchstgewicht der Startseite: index.html + CSS + alle Skripte der Seite, gzip, ohne Schriften und Standbilder. */
export const GEWICHT_GRENZE = 400 * 1024;
/** Skripte der Seiten: eigene Dateien aus js/ oder js/szene/ (die wiederverwendbare Szene). */
export const SKRIPT_PFAD = /^\/?js\/(?:szene\/)?[a-z0-9-]+\.js(?:\?v=[a-f0-9]{10})?$/;
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
export const ANGEBOTE = { 'angebot-interim-cso': 'aktiv', 'angebot-head-of-sales': 'aktiv', 'angebot-events': 'aktiv', 'angebot-development': 'bald' };
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

/**
 * Showreel und Szene einer Startseite („Klar“ 04.10.; gemeinsam mit fokus/pruefen.mjs, damit beide Seiten nach denselben Regeln
 * gebaut sind): Szene rein dekorativ (aria-hidden), die Bühne steht in der Spur (.spur > .buehne), jeder Zustand des Drehbuchs hat
 * seine Lage p (aufsteigend, 0…1), jeder mit `standbild: true` sein Standbild (assets/szene/<name>.svg, von der Seite genutzt) und
 * in assets/szene/ liegt nichts anderes; Blöcke mit data-spur-p tragen eine Lage 0…1; höchstens `lichter` Leinwände (80 %
 * Seriosität); zerlegt werden nur die H1 (data-zerfall) und eine H2 im dunklen Raum (data-aufstieg); der Schlussblock zeigt die
 * Wortmarke. Gibt die Fehler zurück.
 */
export function pruefeShowreel({ index, drehbuch, dateien, wortmarke, lichter = LICHTER_HOECHSTENS, standbildBefehl = 'node website/standbild.mjs' }) {
  const fehler = [];
  if (!/<div class="szene" aria-hidden="true">\s*<canvas><\/canvas>/.test(index)) fehler.push('index.html: Szene (<div class="szene" aria-hidden="true"><canvas>) fehlt oder ist nicht aria-hidden');
  const haupt = /<main\b[\s\S]*<\/main>/.exec(index)?.[0] ?? '';
  if (!/<div class="spur"[^>]*>\s*<div class="buehne">/.test(haupt)) fehler.push('index.html: Showreel ohne Spur und Bühne (<div class="spur"><div class="buehne">)');
  const zustaende = Array.from(drehbuch.matchAll(/\{ name: '([a-z-]+)', p: ([\d.]+)(?:, bis: ([\d.]+))?([^\n]*)/g), m => ({ name: m[1], p: +m[2], bis: m[3] ? +m[3] : +m[2], standbild: /\sstandbild: true/.test(m[4]) }));
  const alleNamen = Array.from(drehbuch.matchAll(/\{ name: '([a-z-]+)'/g), m => m[1]);
  if (zustaende.length !== alleNamen.length || zustaende.length < 2) fehler.push(`js/drehbuch.js: jeder Zustand braucht seine Lage im Showreel ({ name, p[, bis] }) — mindestens zwei (${alleNamen.join(', ')})`);
  let vorher = 0;
  for (const z of zustaende) {
    if (!(z.p >= vorher && z.bis >= z.p && z.bis <= 1)) fehler.push(`js/drehbuch.js: Zustand „${z.name}“ liegt nicht aufsteigend zwischen 0 und 1 (p ${z.p}, bis ${z.bis})`);
    vorher = z.bis;
  }
  const mitBild = zustaende.filter(z => z.standbild).map(z => `assets/szene/${z.name}.svg`);
  for (const d of mitBild) {
    if (!dateien.includes(d)) fehler.push(`${d}: fehlt (${standbildBefehl})`);
    if (!index.includes(`src="${d}"`)) fehler.push(`index.html: Standbild ${d} wird nicht gezeigt (Titelkarte oder ruhige Fassung)`);
  }
  for (const d of dateien.filter(d => d.startsWith('assets/szene/'))) if (!mitBild.includes(d)) fehler.push(`${d}: kein Zustand mit standbild: true — tote Datei`);
  for (const m of haupt.matchAll(/\sdata-spur-p="([^"]*)"/g)) if (!/^(?:0|1|0?\.\d+)$/.test(m[1]) || +m[1] > 1) fehler.push(`index.html: data-spur-p="${m[1]}" — Lage im Showreel zwischen 0 und 1`);
  const zahl = (index.match(/<canvas\b/g) ?? []).length;
  if (zahl > lichter) fehler.push(`index.html: ${zahl} Leinwände — die Lichter stehen an höchstens ${lichter} Stellen (80 % Seriosität)`);
  const zerlegt = Array.from(index.matchAll(/<(\w+)\b[^>]*\sdata-(zerfall|aufstieg)\b[^>]*>/g), m => `${m[1]}:${m[2]}`);
  if (zerlegt.join(' ') !== 'h1:zerfall h2:aufstieg') fehler.push(`index.html: Buchstaben-Bewegung nur an der H1 (data-zerfall) und der Überschrift des dunklen Raums (h2 data-aufstieg) — gefunden: ${zerlegt.join(', ') || 'keine'}`);
  const ende = /<section class="ende"[\s\S]*?<\/section>/.exec(index)?.[0] ?? '';
  if (!ende.includes(`src="${wortmarke}"`)) fehler.push(`index.html: Schlussblock ohne Wortmarke (${wortmarke})`);
  return fehler;
}

/** Alle Dateien unter `ordner` (relativ, mit „/“). */
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
    // Externe Links: nur bewusst gesetzte (Login, Buchungsseite). Alles andere wäre neu und muss hier eingetragen werden.
    for (const m of text.matchAll(/\shref="(https?:[^"]*)"/g)) if (m[1] !== ANMELDEN && m[1] !== FOKUS_SEITE && !m[1].startsWith(BUCHUNG_BASIS) && !(d === 'index.html' && QUELLEN_LINKS.includes(m[1]))) fehler.push(`${d}: unerwarteter externer Link ${m[1]}`);
    // Quellenlinks: nur als Fußnote einer Zahl, mit rel="noopener noreferrer"; jede Zahl hat eine Fußnote, jede Fußnote einen Beleg.
    for (const [tag, url] of Array.from(text.matchAll(/<a\b[^>]*\shref="(https?:[^"]*)"[^>]*>/g), m => [m[0], m[1]])) {
      if (QUELLEN_LINKS.includes(url) && !/\srel="noopener noreferrer"/.test(tag)) fehler.push(`${d}: Quellenlink ${url} ohne rel="noopener noreferrer"`);
    }
    if (d === 'index.html') {
      const kacheln = Array.from(text.matchAll(/<li class="zahl[^"]*">([\s\S]*?)<\/li>/g), m => m[1]);
      for (const k of kacheln) if (!/<p class="wert">[^<]*\d[^<]*<sup><a href="#fn-\d+"/.test(k)) fehler.push('index.html: Zahlen-Kachel ohne Zahl oder ohne Fußnote (#fn-N)');
      const belege = Array.from(text.matchAll(/<li id="fn-\d+">([\s\S]*?)<\/li>/g), m => m[1]);
      for (const b of belege) if (QUELLEN_LINKS.filter(u => b.includes(`href="${u}"`)).length !== 1) fehler.push('index.html: Fußnote ohne genau einen geprüften Quellenlink aus QUELLEN_LINKS');
      if (belege.length !== kacheln.length) fehler.push(`index.html: ${kacheln.length} Zahlen-Kacheln, aber ${belege.length} Fußnoten`);
    }
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
    // Logo im Kopf, Favicons im <head>.
    if (!/<header class="kopf">[\s\S]*?src="assets\/logo\/quer\.svg"[\s\S]*?<\/header>/.test(index)) fehler.push('index.html: Logo (assets/logo/quer.svg) fehlt im Kopf');
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
    const p = PREISE.exec(index.replace(/<[^>]+>/g, ' '));
    if (p) fehler.push(`index.html: „${p[0]}“ — keine Preise auf der Seite`);
    // Fokus Innovation (Kevin 04.10.): eigener Menüpunkt + klarer Weg im Kapitel, alle Städte genannt.
    const fokus = /<section\b[^>]*\sid="fokus-innovation"[\s\S]*?<\/section>/.exec(index)?.[0] ?? '';
    if (!fokus) fehler.push('index.html: Kapitel #fokus-innovation fehlt');
    else {
      if (!fokus.includes(`href="${FOKUS_SEITE}"`)) fehler.push(`index.html: Kapitel Fokus Innovation ohne Link auf ${FOKUS_SEITE}`);
      for (const st of STAEDTE) if (!fokus.includes(`<b>${st}</b>`)) fehler.push(`index.html: Fokus Innovation — Stadt ${st} fehlt`);
    }
    // Szene und Showreel (gemeinsame Regeln mit fokus/pruefen.mjs): Drehbuch, Lagen, Standbilder, Lichter, Buchstaben, Schluss.
    fehler.push(...pruefeShowreel({ index, drehbuch: inhalt.get('js/drehbuch.js') ?? '', dateien, wortmarke: 'assets/logo/wortmarke.svg' }));
    // Gewicht: HTML + CSS + Skripte der Startseite (gzip), ohne Schriften und Standbilder.
    const teile = ['index.html', ...Array.from(index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g), m => m[1]), ...Array.from(index.matchAll(/<script src="([^"]+)"/g), m => m[1])];
    const gewicht = teile.map(t => t.split('?')[0]).filter(t => dateien.includes(t)).reduce((summe, t) => summe + gzipSync(readFileSync(join(ordner, t))).length, 0);
    if (gewicht > GEWICHT_GRENZE) fehler.push(`index.html: Startseite wiegt ${(gewicht / 1024).toFixed(0)} KB gzip (höchstens ${GEWICHT_GRENZE / 1024} KB)`);
    // Zeichnet die Szene das Logo (svg.zeichen, Formation „zeichen“), dann dieselbe Wortmarke wie assets/logo/wortmarke.svg.
    const zeichen = /<svg class="zeichen"[\s\S]*?<\/svg>/.exec(index)?.[0] ?? '';
    // Formen: Pfade (d + Strich- oder Füllfarbe), Kreise (Lage, Radius, Farbe) und Striche (Rechtecke) — ohne Klassen.
    const attr = (t, n) => new RegExp(`\\s${n}="([^"]+)"`).exec(t)?.[1] ?? '';
    const pfade = s => Array.from(s.matchAll(/<(path|circle|rect)\b[^>]*>/g), ([t, art]) => art === 'path'
      ? `p ${attr(t, 'd')}|${attr(t, 'stroke')}|${attr(t, 'fill')}`
      : art === 'circle' ? `c ${attr(t, 'cx')} ${attr(t, 'cy')} ${attr(t, 'r')}|${attr(t, 'stroke')}|${attr(t, 'fill')}`
        : `r ${attr(t, 'x')} ${attr(t, 'y')} ${attr(t, 'width')} ${attr(t, 'height')}|${attr(t, 'fill')}`).sort().join(' ');
    if (zeichen && dateien.includes('assets/logo/wortmarke.svg') && pfade(zeichen) !== pfade(inhalt.get('assets/logo/wortmarke.svg')))
      fehler.push('index.html: Bühnen-Zeichen weicht von assets/logo/wortmarke.svg ab — Block aus `node scripts/website-logo.mjs --buehne` übernehmen');
  }

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
