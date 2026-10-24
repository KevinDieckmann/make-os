#!/usr/bin/env node
// ─── makeinnovation.de · Prüfung vor der Freigabe (24.10.2026, Markenhandbuch 4.0) ────────────────────────────────────
// node makeinnovation/pruefen.mjs → Fehler (Ausgang 1) und Offenes (Platzhalter, vorläufige Preise, fehlender Termin-Link).
// „freigabefähig“ erst ohne Fehler UND ohne Offenes. Wächter: tests/makeinnovation-seite.test.ts.
// Regeln: Seiten passen zur Quelle (bauen.mjs), je Seite genau eine H1, Titel und Beschreibung, noindex solange robots.txt
// sperrt, keine Inline-Skripte/-Stile/Ereignis-Attribute (CSP 'self'), keine fremden Quellen (Skripte, Stile, Bilder, Schriften),
// jeder eigene Link und Anker führt irgendwohin, jedes Angebot hat seine Seite, Zoe ist auf jeder Seite als KI gekennzeichnet
// (Art. 50 KI-VO), keine Namen und Begriffe, die nicht auf die Homepage gehören, Gewicht der Startseite begrenzt.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORDNER, seitenBauen, quellen } from './bauen.mjs';

/** Pfade, die nicht aus diesem Ordner kommen, sondern aus MAKE OS (Caddy leitet sie an die App, LIESMICH.md). */
export const APP_PFADE = [/^\/check(\?q=[a-z0-9_-]{1,40})?$/, /^\/buchen\/[a-z0-9-]{1,40}-[a-f0-9]{24}$/];
/** Erlaubte Ziele außerhalb (nur Links, nie geladene Quellen). */
export const AUSSEN_ERLAUBT = [/^https:\/\/app\.makeinnovation\.de\/anmelden$/, /^mailto:[a-z]+@makeinnovation\.de(\?subject=[^"]*)?$/, /^tel:\+?\d{6,20}$/];
/** Gehört nicht auf die Homepage (Kevins Liste „nicht_auf_die_homepage“, Namensregel, alter Firmenname; der Name der Software erst, wenn sie marktreif ist). */
export const SPERRLISTE = [/KEMARIS/i, /MAKE OS/, /KD Management/i, /Vincenzo/, /\bRichard\b/, /Bodo/, /OneBuddy/i, /Make\.One/, /Eventvertrieb/, /KI-Vertriebsassistent/];
/** Größe der Startseite (HTML + CSS + Skript, gzip) — ohne Schriften. */
export const GEWICHT_MAX = 120 * 1024;

const alleHtml = (ordner) => {
  const aus = [];
  const gehe = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!['inhalt', 'assets', 'css', 'js'].includes(n)) gehe(p); } else if (n.endsWith('.html')) aus.push(p); } };
  gehe(ordner);
  return aus.sort();
};

/** Datei zu einem eigenen Pfad („/vertrieb/“ → vertrieb/index.html). */
const dateiVon = (pfad) => {
  const ohne = pfad.split('#')[0].split('?')[0];
  if (!ohne || ohne === '/') return 'index.html';
  const r = ohne.replace(/^\//, '');
  return r.endsWith('/') ? `${r}index.html` : r;
};

export function pruefen(ordner = ORDNER) {
  const fehler = [], offen = [];
  const platzhalter = new Map();
  const q = quellen();

  // 1. Seiten passen zur Quelle
  const gebaut = seitenBauen(q);
  for (const s of gebaut) {
    const p = join(ordner, s.pfad);
    if (!existsSync(p)) fehler.push(`${s.pfad}: fehlt — node makeinnovation/bauen.mjs`);
    else if (readFileSync(p, 'utf8') !== s.html) fehler.push(`${s.pfad}: passt nicht zur Quelle — node makeinnovation/bauen.mjs`);
  }
  const erwartet = new Set(gebaut.map((s) => s.pfad));
  for (const p of alleHtml(ordner)) { const r = relative(ordner, p); if (!erwartet.has(r)) fehler.push(`${r}: liegt im Ordner, entsteht aber nicht aus bauen.mjs (alte Seite löschen)`); }

  const robotsSperrt = /Disallow:\s*\/\s*$/m.test(readFileSync(join(ordner, 'robots.txt'), 'utf8'));
  const seiten = new Map(gebaut.map((s) => [s.pfad, s.html]));
  const ankerVon = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  for (const [pfad, html] of seiten) {
    if (!pfad.endsWith('.html')) continue;
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fehler.push(`${pfad}: ${h1} H1 statt genau einer`);
    if (!/<title>[^<]{5,}<\/title>/.test(html)) fehler.push(`${pfad}: Titel fehlt`);
    if (!/<meta name="description" content="[^"]{20,}">/.test(html)) fehler.push(`${pfad}: Beschreibung fehlt oder ist zu kurz`);
    if (robotsSperrt && !html.includes('<meta name="robots" content="noindex">')) fehler.push(`${pfad}: noindex fehlt, solange robots.txt sperrt`);
    if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) fehler.push(`${pfad}: Inline-Skript (CSP script-src 'self')`);
    if (/<style[\s>]/.test(html) || /\sstyle="/.test(html)) fehler.push(`${pfad}: Inline-Stil (CSP style-src 'self')`);
    if (/\son[a-z]+="/.test(html)) fehler.push(`${pfad}: Ereignis-Attribut (onclick …)`);
    if (/<form[\s>]/.test(html)) fehler.push(`${pfad}: Formular — Eingaben laufen nur über MAKE OS (/check, /buchen)`);
    if (!html.includes('Zoe · KI-Assistentin')) fehler.push(`${pfad}: Zoe-Knopf ohne Kennzeichnung als KI`);
    for (const w of SPERRLISTE) if (w.test(html)) fehler.push(`${pfad}: „${w.source}“ gehört nicht auf die Homepage`);
    // geladene Quellen nur von hier
    for (const m of html.matchAll(/<(?:script|img|source|link)\b[^>]*\s(?:src|href|srcset)="([^"]+)"/g)) {
      const ziel = m[1];
      if (/^(https?:)?\/\//.test(ziel)) fehler.push(`${pfad}: fremde Quelle ${ziel}`);
      else if (ziel.startsWith('/') && !existsSync(join(ordner, dateiVon(ziel)))) fehler.push(`${pfad}: Datei fehlt ${ziel}`);
    }
    // Links
    for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
      const ziel = m[1].replace(/&amp;/g, '&');
      if (ziel.startsWith('#')) { if (ziel.length > 1 && !ankerVon(html).has(ziel.slice(1))) fehler.push(`${pfad}: Anker ${ziel} fehlt`); continue; }
      if (APP_PFADE.some((r) => r.test(ziel))) continue;
      if (/^(https?:|mailto:|tel:)/.test(ziel)) { if (!AUSSEN_ERLAUBT.some((r) => r.test(ziel))) fehler.push(`${pfad}: Link nach außen nicht vorgesehen: ${ziel}`); continue; }
      if (!ziel.startsWith('/')) { fehler.push(`${pfad}: relativer Link ${ziel} (immer ab /)`); continue; }
      const datei = dateiVon(ziel);
      if (!seiten.has(datei) && !existsSync(join(ordner, datei))) { fehler.push(`${pfad}: Link ins Leere ${ziel}`); continue; }
      const anker = ziel.split('#')[1];
      if (anker && seiten.has(datei) && !ankerVon(seiten.get(datei)).has(anker)) fehler.push(`${pfad}: Anker #${anker} fehlt auf ${datei}`);
    }
    // Offenes (je Platzhalter einmal, mit den Seiten, auf denen er steht)
    for (const m of html.matchAll(/\[\[KEVIN: ([^\]]*)\]\]/g)) (platzhalter.get(m[1]) ?? platzhalter.set(m[1], new Set()).get(m[1])).add(pfad);
  }
  for (const [x, wo] of platzhalter) offen.push(`${x} — ${wo.size === 1 ? [...wo][0] : `${wo.size} Seiten`}`);

  // 2. Jedes Angebot hat seine Seite
  for (const a of q.inhalt.angebote) {
    const ziel = a.id === 'fokus-innovation' ? 'fokus-innovation/index.html' : `${q.seite.bereiche[a.bereich.toLowerCase()].pfad}/${a.id}/index.html`;
    if (!seiten.has(ziel)) fehler.push(`Angebot ${a.id}: Seite ${ziel} fehlt`);
    if (a.preis_vorlaeufig) offen.push(`Angebot ${a.id}: Preis ${a.preis} noch vorläufig (Kevin bestätigt)`);
  }
  // 3. Termin
  const t = q.seite.termin.link;
  if (!t) offen.push('Termin: noch keine Buchungsseite (inhalt/seite.json › termin.link) — Knöpfe öffnen bis dahin eine vorbereitete Mail');
  else if (!APP_PFADE[1].test(t)) fehler.push(`Termin: Link ${t} hat nicht die Form /buchen/<name>-<24 Hex>`);
  // 4. Gewicht der Startseite
  const start = seiten.get('index.html') ?? '';
  const dateien = [...start.matchAll(/(?:href|src)="(\/(?:css|js)\/[^"?]+)/g)].map((m) => readFileSync(join(ordner, m[1].slice(1))));
  const gewicht = gzipSync(Buffer.from(start)).length + dateien.reduce((n, b) => n + gzipSync(b).length, 0);
  if (gewicht > GEWICHT_MAX) fehler.push(`Startseite: ${Math.round(gewicht / 1024)} KB gzip (Grenze ${GEWICHT_MAX / 1024} KB)`);

  return { fehler, offen, gewicht, seiten: seiten.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = pruefen();
  for (const f of r.fehler) console.log(`FEHLER  ${f}`);
  for (const o of r.offen) console.log(`OFFEN   ${o}`);
  console.log(`\n${r.seiten} Seiten · Startseite ${Math.round(r.gewicht / 1024)} KB gzip · ${r.fehler.length} Fehler · ${r.offen.length} offen`);
  console.log(r.fehler.length ? 'nicht freigabefähig (Fehler)' : r.offen.length ? 'nicht freigabefähig (Offenes füllen)' : 'freigabefähig');
  process.exit(r.fehler.length ? 1 : 0);
}
