#!/usr/bin/env node
// ─── MAKE Innovation GmbH · Landingpage: Freigabe-Prüfung (01.10.2026) ──────────────────────────────
// Die Seite unter makeinnovation.de geht erst online, wenn Kevin sie gesehen und freigegeben hat. Dieser
// Prüfschritt sagt, ob sie freigabefähig ist:
//   · Platzhalter: steht irgendwo noch „[[KEVIN:“, ist die Seite NICHT freigabefähig (Impressum/Datenschutz
//     wären unvollständig). Der Upload-Schritt für die Root-Domain hängt daran (website/LIESMICH.md;
//     tests/caddy-buchung-koepfe.test.ts lässt die Freigabe-Fassung der Caddyfile nur bei grüner Prüfung zu).
//   · Bau-Regeln, die die strenge CSP der Freigabe-Fassung voraussetzt: keine Skripte, keine Inline-Stile,
//     keine fremden Quellen (Schriften, Bilder, Stile nur vom eigenen Server), keine Tracker.
//   · Pflichtteile je Seite: lang="de", Titel, genau eine H1, Anmelden-Knopf, Impressum + Datenschutz im Fuß.
//   · Jeder eigene Link und jede url() in CSS zeigt auf eine vorhandene Datei bzw. einen vorhandenen Anker.
// Aufruf: node website/pruefen.mjs   → Ausgang 0 = freigabefähig, 1 = nicht freigabefähig.
// Ohne Abhängigkeiten (läuft so auch auf dem Server oder in der CI).

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANMELDEN = 'https://app.makeinnovation.de/anmelden';
export const KONTAKT = 'mailto:hello@makeinnovation.de';
const PLATZHALTER = /\[\[KEVIN:([^\]]*)\]\]/g;
/** Seiten, die Fuß und Kopf der Marke tragen müssen (404 ist bewusst schlicht: kein Datenschutz-Anker nötig). */
const SEITEN_MIT_PFLICHT = ['index.html', 'impressum.html', 'datenschutz.html'];
/** Dateien, die zum Ordner gehören, aber nie ausgeliefert werden (Caddy versteckt sie). */
export const NICHT_OEFFENTLICH = ['LIESMICH.md', 'pruefen.mjs'];
const TRACKER = /google-analytics|googletagmanager|gtag\(|fonts\.googleapis|fonts\.gstatic|facebook\.net|connect\.facebook|hotjar|matomo|plausible|clarity\.ms|doubleclick/i;

/** Alle Dateien unter `ordner` (relativ, mit „/“). */
function alleDateien(ordner, basis = ordner) {
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
  const inhalt = new Map(dateien.filter(d => ['.html', '.css', '.md'].includes(extname(d))).map(d => [d, readFileSync(join(ordner, d), 'utf8')]));

  // Platzhalter in allem, was ausgeliefert wird (LIESMICH erklärt sie nur).
  for (const d of [...html, ...css]) {
    const text = inhalt.get(d);
    for (const m of text.matchAll(PLATZHALTER)) platzhalter.push({ datei: d, zeile: zeileVon(text, m.index), text: m[1].trim() });
  }

  for (const d of SEITEN_MIT_PFLICHT) if (!html.includes(d)) fehler.push(`${d}: fehlt`);

  for (const d of html) {
    const text = inhalt.get(d);
    const pflicht = SEITEN_MIT_PFLICHT.includes(d);
    if (!/<html lang="de">/.test(text)) fehler.push(`${d}: <html lang="de"> fehlt`);
    if (!/<title>[^<]{5,}<\/title>/.test(text)) fehler.push(`${d}: <title> fehlt`);
    if (!/<meta name="viewport"/.test(text)) fehler.push(`${d}: viewport fehlt`);
    const h1 = (text.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fehler.push(`${d}: ${h1} × <h1> (genau eine erwartet)`);
    // CSP der Freigabe-Fassung: script-src 'self' (wir brauchen gar keins), style-src 'self' (keine Inline-Stile).
    if (/<script[\s>]/i.test(text)) fehler.push(`${d}: <script> — die Seite kommt ohne JavaScript aus`);
    if (/<style[\s>]/i.test(text)) fehler.push(`${d}: <style>-Block — Stile gehören nach css/ (CSP style-src 'self')`);
    if (/\sstyle="/i.test(text)) fehler.push(`${d}: style="…" — Inline-Stile blockiert die CSP`);
    if (/\son[a-z]+="/i.test(text)) fehler.push(`${d}: on…="…"-Handler — blockiert die CSP`);
    if (/<(form|iframe|object|embed)[\s>]/i.test(text)) fehler.push(`${d}: <form>/<iframe>/<object>/<embed> — gibt es auf dieser Seite nicht`);
    if (TRACKER.test(text)) fehler.push(`${d}: Tracker oder fremder Dienst`);
    // Platzhalter-Markierung (gelb) ohne Platzhalter darin: beim Füllen das ganze <span class="ph">…</span> ersetzen.
    for (const m of text.matchAll(/<span class="ph">([^<]*)<\/span>/g)) if (!m[1].includes('[[KEVIN:')) fehler.push(`${d}:${zeileVon(text, m.index)}: gelbe Platzhalter-Markierung um „${m[1].slice(0, 40)}“ — ganzes <span class="ph"> ersetzen`);
    // Quellen (src, <link href>) nur vom eigenen Server.
    for (const m of text.matchAll(/\ssrc="([^"]*)"/g)) if (/^(https?:)?\/\//.test(m[1])) fehler.push(`${d}: fremde Quelle ${m[1]}`);
    for (const m of text.matchAll(/<link\b[^>]*\shref="([^"]*)"/g)) if (/^(https?:)?\/\//.test(m[1])) fehler.push(`${d}: fremde Quelle ${m[1]}`);
    if (pflicht) {
      if (!text.includes(`href="${ANMELDEN}"`)) fehler.push(`${d}: Anmelden-Knopf (${ANMELDEN}) fehlt`);
      if (!/class="knopf anmelden"/.test(text)) fehler.push(`${d}: Anmelden-Knopf im Kopf fehlt`);
      if (!text.includes('href="impressum.html"')) fehler.push(`${d}: Link auf impressum.html fehlt`);
      if (!text.includes('href="datenschutz.html"')) fehler.push(`${d}: Link auf datenschutz.html fehlt`);
      if (!text.includes('MAKE Innovation GmbH')) fehler.push(`${d}: Firmenname fehlt`);
    }
    // Eigene Links und Quellen müssen existieren (Seiten-Anker inklusive).
    for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const ziel = m[1];
      if (/^(https?:|mailto:|tel:)/.test(ziel)) continue;
      const [pfadTeil, frag] = ziel.split('#');
      const datei = pfadTeil === '' ? d : pfadTeil === '/' ? 'index.html' : pfadTeil.replace(/^\//, '');
      if (!dateien.includes(datei)) { fehler.push(`${d}: Link auf ${ziel} — Datei fehlt`); continue; }
      if (frag && datei.endsWith('.html') && !anker(inhalt.get(datei)).has(frag)) fehler.push(`${d}: Anker #${frag} fehlt in ${datei}`);
    }
    // Externe Links: nur bewusst gesetzte (Anmelden). Alles andere wäre neu und muss hier eingetragen werden.
    for (const m of text.matchAll(/\shref="(https?:[^"]*)"/g)) if (m[1] !== ANMELDEN) fehler.push(`${d}: unerwarteter externer Link ${m[1]}`);
  }
  if (html.includes('index.html') && !inhalt.get('index.html').includes(`href="${KONTAKT}"`)) fehler.push(`index.html: Kontakt (${KONTAKT}) fehlt`);

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
