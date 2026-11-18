#!/usr/bin/env node
// MAKE Innovation · die gebaute Website zusätzlich als Vorschau in einen Unterordner legen.
// Zweck: Die neue Fassung läuft neben der jetzigen Website auf demselben Server, z. B. unter https://…/haus/ (gleicher Login, gleiche
// Kopfzeilen), ohne dass die jetzige Startseite ersetzt wird.
//
// Aufruf:  node werkzeug/vorschau-unterordner.mjs <zielordner> <vorsatz> [--caddyfile <pfad>]
//          node werkzeug/vorschau-unterordner.mjs <zielordner> <vorsatz> --pruefen      (ändert nichts, prüft nur das Ziel)
// Beispiel: node werkzeug/vorschau-unterordner.mjs /pfad/zu/website-upload/fokusinnovation/haus /haus
//
// Ablauf:
//   1) ausliefern.mjs liefert in einen Zwischenordner (nie direkt ins Ziel).
//   2) Der Zielordner wird geleert (nur dieser Unterordner, nie der Elternordner) und bekommt die Kopie.
//   3) Alle seiteneigenen Adressen, die mit „/“ beginnen, bekommen den Vorsatz:
//        HTML  Attribute href, src, srcset, imagesrcset, poster, action, formaction, xlink:href, data, cite, manifest, ping, background
//              und data-… (auch Pfade in JSON-Werten solcher Attribute)
//        CSS   url(/…) und @import "/…"
//        JS    Zeichenketten, die mit „/“ + einem Namen der obersten Ebene der Website beginnen (z. B. "/sichtbarkeit/…", "/assets/…"),
//              dazu "/#…" und "/?…". Nichts anderes: keine Muster, keine Rechenzeichen.
//        site.webmanifest  start_url, scope, icons, shortcuts, screenshots
//   4) Selbstprüfung: keine seiteneigene Wurzeladresse ohne Vorsatz mehr, jede umgeschriebene Adresse zeigt auf eine Datei oder einen
//      Ordner mit index.html. Bei Fund: Fehlerliste und Ausgang 1.
//
// Bleibt, wie es ist:
//   - Wege in die Anwendung hinter Caddy. Die Liste wird aus dem Caddyfile gelesen (Block makeinnovation.de: @app, @kontaktformular,
//     @bausteine), nie hier gepflegt. Gesucht wird deploy/caddy/Caddyfile oberhalb des Zielordners (das Caddyfile, das mit ausgerollt wird).
//   - //…, https://…, mailto:, tel:, #…, relative Adressen.
//   - Canonical, Open Graph, JSON-LD, sitemap.xml, robots.txt, llms*.txt (zeigen auf die echte Adresse; die Kopie ist für Suchmaschinen gesperrt).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, '..');
const args = process.argv.slice(2);
const nurPruefen = args.includes('--pruefen');
const caddyArg = args.includes('--caddyfile') ? args[args.indexOf('--caddyfile') + 1] : process.env.CADDYFILE;
const [zielRoh, vorsatz] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--caddyfile');
const ende = (text, code = 2) => { console.error(text); process.exit(code); };
if (!zielRoh || !vorsatz) ende('Aufruf: node werkzeug/vorschau-unterordner.mjs <zielordner> <vorsatz> [--caddyfile <pfad>] [--pruefen]');
if (!/^(\/[a-z0-9][a-z0-9-]*)+$/.test(vorsatz)) ende(`Vorsatz „${vorsatz}“: erwartet wird z. B. /haus (Kleinbuchstaben, Ziffern, Bindestrich; ohne Schrägstrich am Ende).`);
const ZIEL = resolve(zielRoh);

// ── Schutz: nur der Unterordner, der zum Vorsatz gehört ──
if (!ZIEL.endsWith(vorsatz.split('/').join(sep))) ende(`Der Zielordner muss auf „${vorsatz}“ enden (Ordner und Adresse gehören zusammen): ${ZIEL}`);
const ELTERN = ZIEL.slice(0, -vorsatz.length);
if (!existsSync(ELTERN) || !statSync(ELTERN).isDirectory()) ende(`Der Ordner der Website fehlt: ${ELTERN}`);
const liegtIn = (kind, ordner) => { const r = relative(ordner, kind); return r === '' || (!r.startsWith('..') && !r.startsWith(sep)); };
if (liegtIn(ZIEL, QUELLE) || liegtIn(QUELLE, ZIEL)) ende('Der Zielordner darf nicht in der Quelle liegen (und umgekehrt).');

// ── Wege der Anwendung aus dem Caddyfile ──
function caddyfileFinden() {
  if (caddyArg) return resolve(caddyArg);
  for (let o = ELTERN; ; o = dirname(o)) {
    const p = join(o, 'deploy', 'caddy', 'Caddyfile');
    if (existsSync(p)) return p;
    if (dirname(o) === o) return null;
  }
}
function appWegeLesen(pfad) {
  const zeilen = readFileSync(pfad, 'utf8').split('\n');
  const start = zeilen.findIndex((z) => /^makeinnovation\.de\b[^#]*\{\s*$/.test(z));
  if (start < 0) ende(`Im Caddyfile fehlt der Block „makeinnovation.de {“: ${pfad}`);
  const schluss = zeilen.findIndex((z, i) => i > start && /^\}/.test(z));
  const block = zeilen.slice(start, schluss < 0 ? undefined : schluss);
  const muster = [];
  for (const name of ['@app', '@kontaktformular', '@bausteine']) {
    const z = block.find((x) => new RegExp(`^\\s*${name}\\s+path\\s`).test(x));
    if (!z) ende(`Im Block makeinnovation.de fehlt „${name} path …“ (${pfad}). Ohne diese Liste wird nichts umgeschrieben.\nAnderes Caddyfile: --caddyfile <pfad>`);
    muster.push(...z.trim().split(/\s+/).slice(2));
  }
  return muster;
}
const CADDY = caddyfileFinden();
if (!CADDY || !existsSync(CADDY)) ende('Kein Caddyfile gefunden (deploy/caddy/Caddyfile oberhalb des Zielordners). Bitte mit --caddyfile <pfad> nennen.');
const APP_MUSTER = appWegeLesen(CADDY);
const APP_RE = APP_MUSTER.map((m) => new RegExp('^' + m.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i'));
const nurPfad = (adresse) => adresse.split(/[?#]/)[0];
const istApp = (adresse) => { const p = nurPfad(adresse); return APP_RE.some((re) => re.test(p)); };
if (istApp(vorsatz) || istApp(vorsatz + '/')) ende(`Der Vorsatz „${vorsatz}“ ist ein Weg der Anwendung.`);
const hatVorsatz = (adresse) => adresse === vorsatz || adresse.startsWith(vorsatz + '/') || adresse.startsWith(vorsatz + '?') || adresse.startsWith(vorsatz + '#');

// ── Helfer ──
const alleDateien = (ordner, liste = []) => {
  for (const name of readdirSync(ordner)) { const p = join(ordner, name); if (statSync(p).isDirectory()) alleDateien(p, liste); else liste.push(p); }
  return liste;
};
const musterText = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const zaehler = { html: [0, 0], css: [0, 0], js: [0, 0], manifest: [0, 0] }; // [Dateien geändert, Ersetzungen]
let appBleibt = 0;

/** Eine Adresse: neuer Wert oder null (bleibt). */
const neu = (adresse) => {
  if (!adresse.startsWith('/') || adresse.startsWith('//')) return null;
  if (istApp(adresse)) { appBleibt++; return null; }
  return vorsatz + adresse;
};
const URL_ATTR = new Set(['href', 'src', 'srcset', 'imagesrcset', 'poster', 'action', 'formaction', 'xlink:href', 'data', 'cite', 'manifest', 'ping', 'background']);
const TAG = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR = /(\s+)([^\s"'<>\/=]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;

/** HTML: Attribute der Tags; der Inhalt von <script> und <style> bleibt unberührt. `je(name, wert, tag)` liefert den neuen Wert oder null. */
function htmlAttribute(text, je) {
  let aus = '', i = 0; TAG.lastIndex = 0;
  for (let m; (m = TAG.exec(text)); ) {
    const [ganz, tag, attrs] = m; const klein = tag.toLowerCase();
    const neuAttrs = attrs.replace(ATTR, (alles, ws, name, gleich, dq, sq) => {
      const wert = dq ?? sq, q = dq !== undefined ? '"' : "'";
      const w = je(name.toLowerCase(), wert, klein);
      return w === null || w === wert ? alles : `${ws}${name}${gleich}${q}${w}${q}`;
    });
    aus += text.slice(i, m.index) + (neuAttrs === attrs ? ganz : ganz.replace(attrs, () => neuAttrs));
    i = m.index + ganz.length;
    if (klein === 'script' || klein === 'style') { // Inhalt überspringen
      const zu = text.toLowerCase().indexOf(`</${klein}`, i);
      if (zu >= 0) { aus += text.slice(i, zu); i = zu; TAG.lastIndex = zu; }
    }
  }
  return aus + text.slice(i);
}
const srcsetNeu = (wert, fn) => wert.split(',').map((teil) => { const t = teil.trim(); if (!t) return teil; const u = t.split(/\s+/)[0]; const n = fn(u); return n === null ? teil : teil.replace(u, () => n); }).join(',');

function htmlUmschreiben(text, namen) {
  let n = 0;
  const jsonPfad = new RegExp(`(&quot;|&#39;|&#x27;|&apos;)\\/(${namen})(?=[\\/?#&])`, 'g');
  const aus = htmlAttribute(text, (name, wert) => {
    if (name === 'srcset' || name === 'imagesrcset') { const w = srcsetNeu(wert, (u) => { const x = neu(u); if (x !== null) n++; return x; }); return w === wert ? null : w; }
    if (URL_ATTR.has(name) || name.startsWith('data-')) {
      if (wert.startsWith('/')) { const x = neu(wert); if (x !== null) n++; return x; }
      if (name.startsWith('data-') && /^\s*(\{|\[)/.test(wert)) { const w = wert.replace(jsonPfad, (_, q, erstes) => { n++; return `${q}${vorsatz}/${erstes}`; }); return w === wert ? null : w; }
    }
    return null;
  });
  return [aus, n];
}
function cssUmschreiben(text) {
  let n = 0;
  const aus = text
    .replace(/url\(\s*(["']?)([^"')\s]+)\1\s*\)/g, (alles, q, u) => { const x = neu(u); if (x === null) return alles; n++; return `url(${q}${x}${q})`; })
    .replace(/(@import\s+)(["'])([^"']+)\2/g, (alles, vor, q, u) => { const x = neu(u); if (x === null) return alles; n++; return `${vor}${q}${x}${q}`; });
  return [aus, n];
}
/** JS: nur Zeichenketten, die mit „/“ + einem Namen der obersten Ebene beginnen, und "/#…", "/?…". Wege der Anwendung haben andere Namen und bleiben. */
function jsUmschreiben(text, namen) {
  let n = 0;
  const aus = text
    .replace(new RegExp(`(["'\`])\\/(${namen})(?=[\\/?#"'\`\\\\])`, 'g'), (_, q, erstes) => { n++; return `${q}${vorsatz}/${erstes}`; })
    .replace(/(["'`])\/(?=[#?][A-Za-z])/g, (_, q) => { n++; return `${q}${vorsatz}/`; });
  return [aus, n];
}
function manifestUmschreiben(text) {
  let n = 0; const j = JSON.parse(text);
  const setze = (o, k) => { if (o && typeof o[k] === 'string') { const x = neu(o[k]); if (x !== null) { o[k] = x; n++; } } };
  setze(j, 'start_url'); setze(j, 'scope'); setze(j, 'id');
  for (const liste of ['icons', 'screenshots']) for (const e of Array.isArray(j[liste]) ? j[liste] : []) setze(e, 'src');
  for (const s of Array.isArray(j.shortcuts) ? j.shortcuts : []) { setze(s, 'url'); for (const e of Array.isArray(s.icons) ? s.icons : []) setze(e, 'src'); }
  return [n ? JSON.stringify(j, null, 2) + (text.endsWith('\n') ? '\n' : '') : text, n];
}

// ── Selbstprüfung: unabhängig vom Umschreiben, mit grobem Blick auf den ganzen Text ──
function pruefen() {
  const fehler = []; let geprueft = 0, app = 0;
  const kurz = (p) => relative(ZIEL, p);
  const da = (adresse) => {
    let p = nurPfad(adresse).slice(vorsatz.length); try { p = decodeURIComponent(p); } catch { return false; }
    const f = join(ZIEL, p); if (!liegtIn(f, ZIEL) || !existsSync(f)) return false;
    return statSync(f).isDirectory() ? existsSync(join(f, 'index.html')) : true;
  };
  const urteil = (datei, adresse, wo) => {
    if (adresse.startsWith('//')) return;
    if (istApp(adresse)) { app++; return; }
    if (!hatVorsatz(adresse)) { fehler.push(`${kurz(datei)}: Wurzeladresse ohne Vorsatz ${wo}: ${adresse.slice(0, 120)}`); return; }
    geprueft++;
    if (!da(adresse)) fehler.push(`${kurz(datei)}: zeigt ins Leere ${wo}: ${adresse.slice(0, 120)}`);
  };
  for (const datei of alleDateien(ZIEL)) {
    const endung = datei.slice(datei.lastIndexOf('.'));
    if (!['.html', '.css', '.js', '.svg', '.webmanifest'].includes(endung)) continue;
    const text = readFileSync(datei, 'utf8');
    if (endung === '.html' || endung === '.svg') {
      // 1) jedes Attribut gleich welchen Namens, dessen Wert mit „/“ beginnt (Inhalt von <script>/<style> ausgenommen)
      htmlAttribute(text, (name, wert) => {
        if (name === 'srcset' || name === 'imagesrcset') { for (const teil of wert.split(',')) { const u = teil.trim().split(/\s+/)[0]; if (u.startsWith('/')) urteil(datei, u, `(${name})`); } return null; }
        if (/^\s*\/(?!\/)/.test(wert)) urteil(datei, wert.trim(), `(${name})`);
        else if (/url\s*=\s*\//i.test(wert)) fehler.push(`${kurz(datei)}: Weiterleitung mit Wurzeladresse (${name}): ${wert.slice(0, 80)}`);
        for (const m of wert.matchAll(/(?:&quot;|&#39;|&#x27;|&apos;)(\/(?!\/)[^&"'\s]*)/g)) urteil(datei, m[1], `(${name}, JSON)`);
        return null;
      });
      // 2) grob über den ganzen Text ohne Skript-Inhalte: ="/…  und ='/…
      const ohneSkript = text.replace(/<script\b[\s\S]*?<\/script>/gi, '');
      for (const m of ohneSkript.matchAll(/=\s*["']?\s*(\/(?!\/)[^"'\s>]*)/g)) if (!istApp(m[1]) && !hatVorsatz(m[1])) fehler.push(`${kurz(datei)}: Wurzeladresse ohne Vorsatz (grober Blick): ${m[1].slice(0, 120)}`);
    } else if (endung === '.css') {
      for (const m of text.matchAll(/url\(\s*["']?([^"')\s]+)/g)) if (m[1].startsWith('/')) urteil(datei, m[1], '(url)');
      for (const m of text.matchAll(/@import\s+["']([^"']+)/g)) if (m[1].startsWith('/')) urteil(datei, m[1], '(@import)');
      for (const m of text.matchAll(/[("']\s*(\/(?!\/)[A-Za-z0-9_.~%-][^"')\s]*)/g)) if (!istApp(m[1]) && !hatVorsatz(m[1])) fehler.push(`${kurz(datei)}: Wurzeladresse ohne Vorsatz (grober Blick): ${m[1].slice(0, 120)}`);
    } else if (endung === '.js') {
      // jede Zeichenkette, die mit „/“ beginnt: Weg der Anwendung, Adresse mit Vorsatz oder ein Fall zum Ansehen
      // (ein Name muss mit /, ?, # oder dem Ende der Zeichenkette aufhören: so zählt der Rest eines Musters wie /"/g nicht als Adresse)
      for (const m of text.matchAll(/(["'`])(\/(?:[A-Za-z0-9_.~%-]+(?=[\/?#"'`\\])|(?=[#?][A-Za-z]))[^"'`\s\\]*)/g)) urteil(datei, m[2], '(Zeichenkette)');
      for (const m of text.matchAll(/(["'`])\/\1/g)) fehler.push(`${kurz(datei)}: Zeichenkette "/" im Skript bei Zeichen ${m.index}: bitte einzeln ansehen (Wurzel der Seite oder Trennzeichen?)`);
    } else if (endung === '.webmanifest') {
      const j = JSON.parse(text);
      for (const u of [j.start_url, j.scope, ...(j.icons ?? []).map((e) => e.src), ...(j.shortcuts ?? []).map((e) => e.url)]) if (typeof u === 'string' && u.startsWith('/')) urteil(datei, u, '(Manifest)');
    }
  }
  return { fehler, geprueft, app };
}

if (!nurPruefen) {
  // ── 1) in den Zwischenordner ausliefern ──
  const zw = mkdtempSync(join(tmpdir(), 'vorschau-unterordner-'));
  try {
    execFileSync(process.execPath, [join(QUELLE, 'ausliefern.mjs'), zw], { stdio: ['ignore', 'ignore', 'inherit'] });
    const oben = readdirSync(zw);
    const erstes = vorsatz.split('/')[1];
    if (oben.includes(erstes)) ende(`Die Website hat selbst einen Eintrag „${erstes}“ auf der obersten Ebene. Bitte einen anderen Vorsatz wählen.`);
    if (!oben.includes('index.html')) ende('Die Auslieferung hat keine index.html erzeugt.');
    const namen = oben.map(musterText).sort((a, b) => b.length - a.length).join('|');

    // ── 2) Zielordner leeren (nur ihn) und Kopie hineinlegen ──
    if (existsSync(ZIEL)) {
      if (!statSync(ZIEL).isDirectory()) ende(`Das Ziel ist kein Ordner: ${ZIEL}`);
      const inhalt = readdirSync(ZIEL);
      const start = join(ZIEL, 'index.html');
      if (inhalt.length && !(existsSync(start) && readFileSync(start, 'utf8').includes(`"${vorsatz}/css/`))) ende(`Der Zielordner ist nicht leer und sieht nicht nach einer früheren Vorschau-Kopie mit dem Vorsatz ${vorsatz} aus. Bitte von Hand ansehen und leeren: ${ZIEL}`);
      for (const name of inhalt) rmSync(join(ZIEL, name), { recursive: true, force: true });
    } else mkdirSync(ZIEL, { recursive: true });
    cpSync(zw, ZIEL, { recursive: true });

    // ── 3) umschreiben ──
    for (const datei of alleDateien(ZIEL)) {
      const endung = datei.slice(datei.lastIndexOf('.'));
      const art = endung === '.html' ? 'html' : endung === '.css' ? 'css' : endung === '.js' ? 'js' : datei.endsWith('site.webmanifest') ? 'manifest' : null;
      if (!art) continue;
      const alt = readFileSync(datei, 'utf8');
      const [text, n] = art === 'html' ? htmlUmschreiben(alt, namen) : art === 'css' ? cssUmschreiben(alt) : art === 'js' ? jsUmschreiben(alt, namen) : manifestUmschreiben(alt);
      if (n) { writeFileSync(datei, text); zaehler[art][0]++; zaehler[art][1] += n; }
    }
  } finally { rmSync(zw, { recursive: true, force: true }); }
  const z = zaehler;
  console.log(`Kopie liegt in ${ZIEL} (Vorsatz ${vorsatz})`);
  console.log(`Umgeschrieben: HTML ${z.html[1]} Adressen in ${z.html[0]} Dateien · CSS ${z.css[1]} in ${z.css[0]} · JS ${z.js[1]} in ${z.js[0]} · Manifest ${z.manifest[1]} in ${z.manifest[0]}`);
  console.log(`Unverändert an der Wurzel (Wege der Anwendung laut ${relative(process.cwd(), CADDY) || CADDY}): ${appBleibt} Verweise · Muster: ${APP_MUSTER.join(' ')}`);
} else if (!existsSync(ZIEL)) ende(`Das Ziel fehlt: ${ZIEL}`);

// ── 4) Selbstprüfung ──
const { fehler, geprueft, app } = pruefen();
if (fehler.length) {
  const einmal = [...new Set(fehler)];
  console.error(`Selbstprüfung: ${einmal.length} Funde\n` + einmal.slice(0, 200).join('\n') + (einmal.length > 200 ? `\n… und ${einmal.length - 200} weitere` : ''));
  process.exit(1);
}
console.log(`Selbstprüfung grün: ${geprueft} Adressen mit Vorsatz zeigen auf vorhandene Dateien, ${app} Wege der Anwendung bleiben an der Wurzel, keine Wurzeladresse ohne Vorsatz.`);
