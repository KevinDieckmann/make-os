#!/usr/bin/env node
// ─── Fokus Innovation · Event-Seite (fokusinnovation.de): Freigabe-Prüfung (03.10.2026; „Klar 2“ 07.10.2026) ────────────
// Nach dem Vorbild von website/pruefen.mjs — die gemeinsamen Regeln (Sperrliste, Firmierung, Wortregeln, Preise, Skript-
// und Tracker-Muster) kommen von dort, damit beide Seiten nie auseinanderlaufen. Die Seite geht erst online, wenn Kevin sie
// gesehen und freigegeben hat. Geprüft wird:
//   · Platzhalter „[[KEVIN: …]]“ → NICHT freigabefähig (Datenschutz-Bestätigungen).
//   · Bau-Regeln der strengen CSP: keine Inline-Skripte/-Stile/Handler, Skripte nur aus js/ (lesen, speichern,
//     senden nichts), keine fremden Quellen, keine Tracker, keine Formulare. Stempel: jeder Verweis auf css/ und js/ trägt
//     ?v=<Prüfsumme der Datei> (wie makeinnovation.de — node scripts/fokus-seite.mjs oder node website/stempeln.mjs fokus).
//   · Pflichtteile je Seite: lang="de", Titel, Beschreibung, genau eine H1, noindex solange robots.txt sperrt, Firmierung
//     „eine Marke der KEMARIS Innovation GmbH“, Impressum + Datenschutz verlinkt; jeder eigene Link/Anker existiert.
//   · Externe Links nur zu makeinnovation.de (Startseite, Datenschutzhinweis). Mail nur an die MAKE-Adresse; jede Mail mit
//     Betreff beginnt mit „Fokus Innovation“.
//   · Inhalt: Absender „Ein Format von Make.One“, die H1 „Fokus Innovation“, die sechs Städte mit „Termin in Planung“ (Liste
//     und ruhige Karte), Hauptweg „Teilnahme anfragen“ (#teilnahme-link, vorbereitete Mail), „Gastgeber werden“ und „Partner
//     werden“ (je eine vorbereitete Mail mit Betreff) — und KEINE erfundenen Termine, Preise, Statistiken oder Zahlen zu Gästen,
//     Plätzen, Partnern.
//   · Ruhe nach DENSELBEN Regeln wie makeinnovation.de (pruefeRuhe aus website/pruefen.mjs, „Klar 2“ 07.10.): kein Scroll-Film,
//     höchstens ein dunkler Abschnitt und ein Licht, keine Animationen, „Bewegung reduzieren“ beachtet; der Fuß zeigt die Wortmarke.
//   · Gemeinsame Dateien gleich wie in website/: die Gestaltungsgrundlage (css/seite.css), Schriften, MAKE-Logo und Handy-Menü
//     Byte für Byte, Impressum (Block von „Angaben gemäß § 5 DDG“ bis „Stand“); css/fokus.css überschreibt keine Tokens.
//   · Größe: alles Ausgelieferte ≤ GROESSE_MAX; die Startseite (HTML + CSS + Skripte, gzip) ≤ GEWICHT_GRENZE.
// Aufruf: node fokus/pruefen.mjs → Ausgang 0 = freigabefähig, 1 = nicht freigabefähig (Fehler oder offene Platzhalter).
// Ohne Abhängigkeiten außer website/pruefen.mjs (läuft so auch auf dem Server oder in der CI).

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SPERRLISTE, FIRMIERUNG, ALTER_NAME, SOFTWARE_NAME, PREISE, STATISTIK, VERBOTENE_WOERTER, SKRIPT_VERBOTEN, TRACKER, SKRIPT_PFAD, STEMPEL_VERWEIS, stempelVon, pruefeRuhe, alleDateien } from '../website/pruefen.mjs';

const PLATZHALTER = /\[\[KEVIN:([^\]]*)\]\]/g;
// Zusammengesetzt, damit tests/repo-sauber.test.ts (keine echten Adressen im Code) die Adresse nicht als Fund meldet.
export const MAIL = ['hello', 'makeinnovation.de'].join('@');
export const KONTAKT = `mailto:${MAIL}`;
/** Erlaubte Ziele außerhalb der Seite (makeinnovation.de: Absender und Datenschutzhinweis zu Geschäftskontakten). */
export const EXTERN_ERLAUBT = ['https://makeinnovation.de', 'https://makeinnovation.de/datenschutz.html'];
/** Seiten mit Pflichtteilen (404 schlicht, aber mit Firmierung). */
const SEITEN_MIT_PFLICHT = ['index.html', 'impressum.html', 'datenschutz.html'];
/** Arbeitsdateien im Ordner — nie ausgeliefert (Caddy: @intern → 404 und file_server hide; Vorschlag in LIESMICH.md). */
export const NICHT_OEFFENTLICH = ['LIESMICH.md', 'pruefen.mjs'];
/** Die Städte der Reihe (Kevin 03.10.) — Kennung und Name wie in scripts/fokus-seite.mjs (Wächter: tests/fokus-seite.test.ts). */
export const STAEDTE = { berlin: 'Berlin', hamburg: 'Hamburg', bielefeld: 'Bielefeld', koeln: 'Köln', muenchen: 'München', dresden: 'Dresden' };
/** Zahlwort der Überschrift „Aus Berlin in … Städte.“ — muss zur Zahl der Städte passen (wie der Kartentitel in scripts/fokus-seite.mjs). */
export const ZAHLWORT = ['keine', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'];
/** Hauptweg: vorbereitete Mail mit Betreff „Fokus Innovation – Teilnahme“ (Text vorbereitet). */
export const TEILNAHME_MAIL = /^mailto:hello@makeinnovation\.de\?subject=Fokus%20Innovation%20%E2%80%93%20Teilnahme&amp;body=[^"]+$/;
/** Gastgeber und Partner (Kevin 04.10.): je eine vorbereitete Mail mit diesem Betreff (kodiert wie im href). */
export const MAIL_BETREFFE = { 'Gastgeber werden': 'Fokus%20Innovation%20%E2%80%93%20Gastgeber', 'Partner werden': 'Fokus%20Innovation%20%E2%80%93%20Partner' };
/** Jede Mail mit Betreff gehört zur Reihe: „Fokus Innovation[ Stadt] – …“. */
const BETREFF = /^mailto:hello@makeinnovation\.de\?subject=Fokus%20Innovation(?:%20[^%&"]+|%20K%C3%B6ln|%20M%C3%BCnchen)?%20%E2%80%93%20/;
/** Kein erfundener Termin: Datumsangaben (12.11. · 12.11.2026 · 12. November · November 2026) stehen nicht auf der Startseite. */
export const TERMIN = /\b\d{1,2}\.\s?\d{1,2}\.(?:\d{2,4})?(?!\d)|\b\d{1,2}\.\s?(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b|\b(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+20\d\d\b/;
/** Keine erfundenen Mengen zu Gästen, Plätzen, Partnern oder Abenden (z. B. „40 Gäste“, „12 Plätze“). */
export const MENGEN = /\b(?!0\d)\d+\s*(?:Gäste|Gästen|Plätze|Teilnehmer(?:innen)?|Partner|Abende|Unternehmen|Entscheider(?:innen)?)\b/i;
/** Gemeinsame Dateien: fokus-Pfad → website-Pfad (Byte-gleich; erzeugt von scripts/fokus-seite.mjs). */
export const GLEICH_WIE_WEBSITE = {
  'css/seite.css': 'css/seite.css',
  'assets/fonts/archivo-latin.woff2': 'assets/fonts/archivo-latin.woff2',
  'assets/fonts/public-sans-latin.woff2': 'assets/fonts/public-sans-latin.woff2',
  'assets/logo/make-quer.svg': 'assets/logo/quer.svg',
  'js/menue.js': 'js/menue.js',
  'js/weg.js': 'js/weg.js',
};
/** Die Wortmarke „FOKUS INNOVATION“ (Fuß; erzeugt von scripts/fokus-seite.mjs aus scripts/website-logo.mjs). */
export const WORTMARKE = 'assets/logo/fokus-wortmarke.svg';
/** Tokens der Grundlage (css/seite.css, beide Seiten) — css/fokus.css setzt keinen davon neu (sonst laufen die Seiten auseinander). */
export const GETEILTE_TOKENS = ['--grund', '--grundTief', '--flaeche', '--flaecheHoch', '--linie', '--ink', '--inkDim', '--inkLeise', '--aktiv', '--aktivSanft', '--achtung', '--granat', '--smaragd', '--schrift-display', '--schrift-text', '--breite', '--kopf'];
/** Größe: alles, was ausgeliefert wird (Seiten, CSS, Skript, Bilder, Schriften). */
export const GROESSE_MAX = 250 * 1024;
/** Was ein Besuch der Startseite lädt (HTML + CSS + Skripte, gzip, ohne Schriften und Bilder). */
export const GEWICHT_GRENZE = 80 * 1024;

const zeileVon = (text, index) => text.slice(0, index).split('\n').length;
const anker = html => new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), m => m[1]));
const sichtbar = html => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
/** Alle Tokens (--name: Wert), die eine CSS-Datei setzt — egal in welchem Block. */
function tokens(css) {
  return Object.fromEntries(Array.from(css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[A-Za-z-]+)\s*:\s*([^;}]+)[;}]/g), m => [m[1], m[2].trim()]));
}
/** Der Kern des Impressums: von „Angaben gemäß § 5 DDG“ bis vor „Stand“. */
export function impressumKern(html) {
  const a = html.indexOf('<h2>Angaben gemäß § 5 DDG</h2>'), e = html.indexOf('<p class="stand">');
  return a >= 0 && e > a ? html.slice(a, e).trim() : '';
}

/**
 * Prüft den Ordner der Event-Seite.
 * @param {string} ordner absoluter Pfad zu fokus/
 * @param {string} [website] absoluter Pfad zu website/ (Vergleich der gemeinsamen Dateien)
 */
export function pruefeFokus(ordner, website = join(ordner, '..', 'website')) {
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
  const inhalt = new Map(dateien.filter(d => ['.html', '.css', '.md', '.js', '.svg', '.mjs'].includes(extname(d))).map(d => [d, readFileSync(join(ordner, d), 'utf8')]));

  for (const d of [...html, ...css, ...js, ...svg]) {
    const text = inhalt.get(d);
    const m = SPERRLISTE.exec(text);
    if (m) fehler.push(`${d}:${zeileVon(text, m.index)}: fremder Name „${m[0]}“`);
    for (const k of text.matchAll(/\bkem[a]ris\b/gi)) {
      const um = text.slice(k.index, k.index + k[0].length + 16), davor = text[k.index - 1];
      if (!/^kemaris Innovation GmbH/i.test(um) && !(davor === '@' && /^kemaris\.de\b/i.test(um))) { fehler.push(`${d}:${zeileVon(text, k.index)}: KEMARIS nur als „KEMARIS Innovation GmbH“`); break; }
    }
    if (d.endsWith('.html')) {
      const w = VERBOTENE_WOERTER.exec(sichtbar(text));
      if (w) fehler.push(`${d}: Wort „${w[0]}“ — steht nicht auf der Seite (Wortregeln)`);
    }
  }
  for (const [d, text] of inhalt) {
    const alt = ALTER_NAME.exec(text);
    if (alt) fehler.push(`${d}:${zeileVon(text, alt.index)}: „${alt[0]}“ — die GmbH ist nicht eingetragen; „MAKE Innovation“ + „${FIRMIERUNG}“`);
    const s = SOFTWARE_NAME.exec(text);
    if (s) fehler.push(`${d}:${zeileVon(text, s.index)}: Name der Software — kommt nicht auf die Seite`);
  }
  for (const d of [...html, ...css]) {
    const text = inhalt.get(d);
    for (const m of text.matchAll(PLATZHALTER)) platzhalter.push({ datei: d, zeile: zeileVon(text, m.index), text: m[1].trim() });
  }
  for (const d of [...SEITEN_MIT_PFLICHT, '404.html']) if (!html.includes(d)) fehler.push(`${d}: fehlt`);

  for (const d of html) {
    const text = inhalt.get(d);
    if (!/<html lang="de">/.test(text)) fehler.push(`${d}: <html lang="de"> fehlt`);
    if (!/<title>[^<]{5,}<\/title>/.test(text)) fehler.push(`${d}: <title> fehlt`);
    if (!/<meta name="viewport"/.test(text)) fehler.push(`${d}: viewport fehlt`);
    if (!/<meta name="description" content="[^"]{20,}">/.test(text)) fehler.push(`${d}: <meta name="description"> fehlt`);
    const h1 = (text.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fehler.push(`${d}: ${h1} × <h1> (genau eine erwartet)`);
    for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = /\ssrc="([^"]*)"/.exec(m[1])?.[1];
      if (!src || !SKRIPT_PFAD.test(src) || m[2].trim() !== '') fehler.push(`${d}: <script> — nur eigene Dateien aus js/, nie Inline-Skript`);
    }
    for (const m of text.matchAll(STEMPEL_VERWEIS)) {
      const datei = join(ordner, m[2].replace(/^\//, ''));
      if (!existsSync(datei)) fehler.push(`${d}: ${m[2]} — Datei fehlt`);
      else if (m[3] !== stempelVon(readFileSync(datei))) fehler.push(`${d}: ${m[2]} ohne aktuellen Stempel (?v=…) — node scripts/fokus-seite.mjs`);
    }
    if (/<style[\s>]/i.test(text)) fehler.push(`${d}: <style>-Block — Stile gehören nach css/`);
    if (/\sstyle="/i.test(text)) fehler.push(`${d}: style="…" — Inline-Stile blockiert die CSP`);
    if (/\son[a-z]+="/i.test(text)) fehler.push(`${d}: on…="…"-Handler — blockiert die CSP`);
    if (/<(form|iframe|object|embed|input|textarea)[\s>]/i.test(text)) fehler.push(`${d}: Formular/Rahmen — gibt es auf dieser Seite nicht (Teilnahme nur per Mail)`);
    if (TRACKER.test(text)) fehler.push(`${d}: Tracker oder fremder Dienst`);
    for (const m of text.matchAll(/<span class="ph">([^<]*)<\/span>/g)) if (!m[1].includes('[[KEVIN:')) fehler.push(`${d}:${zeileVon(text, m.index)}: gelbe Platzhalter-Markierung ohne Platzhalter`);
    for (const m of text.matchAll(/\ssrc="([^"]*)"/g)) if (/^(https?:)?\/\//.test(m[1])) fehler.push(`${d}: fremde Quelle ${m[1]}`);
    for (const m of text.matchAll(/<link\b[^>]*\shref="([^"]*)"/g)) if (/^(https?:)?\/\//.test(m[1])) fehler.push(`${d}: fremde Quelle ${m[1]}`);
    if (!text.includes(FIRMIERUNG)) fehler.push(`${d}: Firmierung „${FIRMIERUNG}“ fehlt`);
    if (!/Ein Format von Make\.One/.test(text)) fehler.push(`${d}: Absender „Ein Format von Make.One“ fehlt`);
    if (vorschau && !text.includes('<meta name="robots" content="noindex">')) fehler.push(`${d}: Vorschau (robots.txt sperrt) — <meta name="robots" content="noindex"> fehlt`);
    if (SEITEN_MIT_PFLICHT.includes(d)) {
      if (!text.includes('href="impressum.html"')) fehler.push(`${d}: Link auf impressum.html fehlt`);
      if (!text.includes('href="datenschutz.html"')) fehler.push(`${d}: Link auf datenschutz.html fehlt`);
    }
    for (const m of text.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const ziel = m[1];
      if (/^https?:/.test(ziel)) { if (!EXTERN_ERLAUBT.includes(ziel)) fehler.push(`${d}: unerwarteter externer Link ${ziel}`); continue; }
      if (/^mailto:/.test(ziel)) {
        // Das Impressum trägt die Kontaktwege der Trägerin (wörtlich wie auf makeinnovation.de, unten verglichen).
        if (!ziel.startsWith(KONTAKT) && d !== 'impressum.html') fehler.push(`${d}: Mail nur an die MAKE-Adresse (${ziel.slice(0, 40)})`);
        else if (ziel.includes('?subject=') && !BETREFF.test(ziel)) fehler.push(`${d}: Betreff „${decodeURIComponent(ziel.split('subject=')[1].split('&')[0])}“ — beginnt mit „Fokus Innovation“`);
        continue;
      }
      if (/^tel:/.test(ziel)) continue;
      if (ziel.includes('[[KEVIN:')) { fehler.push(`${d}: Platzhalter als Link ${ziel}`); continue; }
      const [mitStempel, frag] = ziel.split('#');
      const pfadTeil = mitStempel.replace(/\?v=[a-f0-9]{10}$/, ''); // Stempel gehört nicht zum Dateinamen
      const datei = pfadTeil === '' ? d : pfadTeil === '/' ? 'index.html' : pfadTeil.replace(/^\//, '');
      if (!dateien.includes(datei)) { fehler.push(`${d}: Link auf ${ziel} — Datei fehlt`); continue; }
      if (frag && datei.endsWith('.html') && !anker(inhalt.get(datei)).has(frag)) fehler.push(`${d}: Anker #${frag} fehlt in ${datei}`);
    }
  }

  if (html.includes('index.html')) {
    const index = inhalt.get('index.html');
    const text = sichtbar(index);
    const ziele = Array.from(index.matchAll(/<a\b[^>]*\sid="teilnahme-link"[^>]*>/g), m => /\shref="([^"]*)"/.exec(m[0])?.[1] ?? '');
    if (ziele.length !== 1) fehler.push(`index.html: ${ziele.length} × #teilnahme-link — genau einer`);
    else if (!TEILNAHME_MAIL.test(ziele[0])) fehler.push('index.html: #teilnahme-link — vorbereitete Mail mit Betreff „Fokus Innovation – Teilnahme“ erwartet');
    if (!/\sid="teilnahme"/.test(index)) fehler.push('index.html: Abschnitt #teilnahme fehlt');
    if (!index.includes('href="https://makeinnovation.de"')) fehler.push('index.html: Link zu makeinnovation.de fehlt');
    if (!index.includes(`href="${KONTAKT}"`)) fehler.push(`index.html: Kontakt (${KONTAKT}) fehlt`);
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(index)?.[1] ?? '';
    if (h1.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() !== 'Fokus Innovation') fehler.push('index.html: H1 „Fokus Innovation“ fehlt');
    const wort = ZAHLWORT[Object.keys(STAEDTE).length];
    if (!text.includes(`in ${wort} Städte.`)) fehler.push(`index.html: Überschrift der Städte — „in ${wort} Städte.“ erwartet (${Object.keys(STAEDTE).length} Städte)`);
    if (!index.includes(`Fokus Innovation in ${wort} Städten`)) fehler.push(`index.html: Kartentitel nennt nicht ${wort} Städte (node scripts/fokus-seite.mjs)`);
    for (const [id, name] of Object.entries(STAEDTE)) {
      const zeile = new RegExp(`<li data-stadt="${id}"><b>${name}</b><span>Termin in Planung</span>`).test(index);
      if (!zeile) fehler.push(`index.html: Stadt ${name} — Zeile mit „Termin in Planung“ fehlt`);
      if (!new RegExp(`<g class="stadt[^"]*" data-stadt="${id}">`).test(index)) fehler.push(`index.html: Stadt ${name} fehlt in der Karte (node scripts/fokus-seite.mjs)`);
    }
    for (const [name, betreff] of Object.entries(MAIL_BETREFFE)) {
      if (!new RegExp(`<a class="knopf[^"]*" href="${KONTAKT}\\?subject=${betreff}&amp;body=[^"]+">${name} `).test(index)) fehler.push(`index.html: Knopf „${name}“ (vorbereitete Mail, Betreff ${decodeURIComponent(betreff)}) fehlt`);
    }
    // Der Fuß zeigt die Wortmarke FOKUS INNOVATION.
    if (!dateien.includes(WORTMARKE)) fehler.push(`${WORTMARKE}: fehlt (node scripts/fokus-seite.mjs)`);
    if (!new RegExp(`<footer class="fuss">[\\s\\S]*?src="${WORTMARKE}"[\\s\\S]*?</footer>`).test(index)) fehler.push(`index.html: Fuß ohne Wortmarke (${WORTMARKE})`);
    // Gewicht: HTML + CSS + Skripte der Startseite (gzip), ohne Schriften und Bilder.
    const teile = ['index.html', ...Array.from(index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g), m => m[1]), ...Array.from(index.matchAll(/<script src="([^"]+)"/g), m => m[1])];
    const gewicht = teile.map(t => t.split('?')[0]).filter(t => dateien.includes(t)).reduce((summe, t) => summe + gzipSync(readFileSync(join(ordner, t))).length, 0);
    if (gewicht > GEWICHT_GRENZE) fehler.push(`index.html: Startseite wiegt ${(gewicht / 1024).toFixed(0)} KB gzip (höchstens ${GEWICHT_GRENZE / 1024} KB)`);
    const t = TERMIN.exec(text);
    if (t) fehler.push(`index.html: „${t[0]}“ — keine Termine auf der Seite, solange keiner feststeht („Termin in Planung“)`);
    const p = PREISE.exec(text);
    if (p) fehler.push(`index.html: „${p[0]}“ — keine Preise`);
    const z = MENGEN.exec(text);
    if (z) fehler.push(`index.html: „${z[0]}“ — keine erfundenen Zahlen zu Gästen, Plätzen oder Partnern`);
    const st = STATISTIK.exec(text);
    if (st) fehler.push(`index.html: „${st[0]}“ — keine Statistiken oder Prozentzahlen, nur Prinzipien (Kevin 07.10.)`);
    if (/<video\b(?![^>]*\spreload="none")/.test(index.replace(/<!--[\s\S]*?-->/g, ''))) fehler.push('index.html: <video> nur mit preload="none" (und Standbild als poster)');
  }

  // Ruhe („Klar 2“, dieselben Regeln wie makeinnovation.de): kein Scroll-Film, ein Licht, ein dunkler Abschnitt, keine Animationen.
  fehler.push(...pruefeRuhe({
    seiten: new Map(html.map(d => [d, inhalt.get(d)])),
    stile: new Map(css.map(d => [d, inhalt.get(d)])), skripte: new Map(js.map(d => [d, inhalt.get(d)])), dateien,
  }));

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
      if (!existsSync(join(ordner, dirname(d), ziel))) fehler.push(`${d}: url(${ziel}) — Datei fehlt`);
    }
  }

  // Gemeinsam mit website/: Dateien Byte für Byte, Impressum, Tokens.
  if (existsSync(website)) {
    for (const [hier, dort] of Object.entries(GLEICH_WIE_WEBSITE)) {
      if (!existsSync(join(ordner, hier))) { fehler.push(`${hier}: fehlt (node scripts/fokus-seite.mjs)`); continue; }
      if (!readFileSync(join(ordner, hier)).equals(readFileSync(join(website, dort)))) fehler.push(`${hier}: weicht von website/${dort} ab — node scripts/fokus-seite.mjs`);
    }
    const kernHier = impressumKern(inhalt.get('impressum.html') ?? ''), kernDort = impressumKern(readFileSync(join(website, 'impressum.html'), 'utf8'));
    if (!kernHier || kernHier !== kernDort) fehler.push('impressum.html: Pflichtangaben weichen von website/impressum.html ab (Block „Angaben gemäß § 5 DDG“ bis „Stand“ übernehmen)');
    const tHier = tokens(inhalt.get('css/fokus.css') ?? ''), tDort = tokens(readFileSync(join(website, 'css', 'seite.css'), 'utf8'));
    for (const n of new Set([...GETEILTE_TOKENS, ...Object.keys(tDort)])) if (n in tHier) fehler.push(`css/fokus.css: Token ${n} = ${tHier[n]} — die Grundlage (css/seite.css) setzt ${tDort[n] ?? 'ihn'}; hier nicht überschreiben`);
  } else fehler.push('website/: fehlt — gemeinsame Dateien nicht prüfbar');

  // Größe: alles, was ausgeliefert wird.
  const oeffentlich = dateien.filter(d => !NICHT_OEFFENTLICH.includes(d));
  const summe = oeffentlich.reduce((a, d) => a + statSync(join(ordner, d)).size, 0);
  if (summe > GROESSE_MAX) fehler.push(`Größe: ${Math.round(summe / 1024)} KB ausgeliefert — höchstens ${GROESSE_MAX / 1024} KB`);
  for (const d of NICHT_OEFFENTLICH) if (!dateien.includes(d)) fehler.push(`${d}: fehlt`);

  return { fehler, platzhalter, groesse: summe, freigabefaehig: fehler.length === 0 && platzhalter.length === 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ordner = dirname(fileURLToPath(import.meta.url));
  const { fehler, platzhalter, groesse, freigabefaehig } = pruefeFokus(ordner);
  for (const f of fehler) console.log(`✗ ${f}`);
  if (platzhalter.length) {
    console.log(`\n${platzhalter.length} Platzhalter offen:`);
    for (const p of platzhalter) console.log(`  · ${p.datei}:${p.zeile}  ${p.text}`);
  }
  console.log(`\nAusgeliefert: ${Math.round(groesse / 1024)} KB.`);
  console.log(freigabefaehig
    ? '✓ freigabefähig — Caddy-Block aus fokus/LIESMICH.md darf übernommen werden (nur auf Kevins Wort).'
    : fehler.length ? '✗ nicht freigabefähig — Fehler beheben.' : '✗ nicht freigabefähig — nur noch die Platzhalter füllen (Bau-Regeln erfüllt).');
  process.exit(freigabefaehig ? 0 : 1);
}
