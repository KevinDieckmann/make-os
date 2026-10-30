#!/usr/bin/env node
// ─── Fokus Innovation · Vorschaubilder und Icons (27.10.2026) ────────────────────────────────────────────────────────
// Ein Bild je Seite (1200 × 630, für Google, LinkedIn, WhatsApp und Co.), dazu Logo, Icons und favicon.ico.
// Gezeichnet mit einem unsichtbaren Chrome, ohne Pakete; Titel und Vorzeile kommen aus bauen.mjs (seitenBauen).
//   node prototype/fokus-innovation/bilder.mjs     → schreibt assets/bild/og/*.png, assets/bild/*.png und favicon.ico
// Danach bauen.mjs laufen lassen: der Prüfer meldet jede Seite ohne Bild. Chrome-Pfad notfalls über CHROME=… setzen.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { seitenBauen, ORDNER } from './bauen.mjs';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const schrift = readFileSync(join(ORDNER, 'assets/schriften/schibsted-grotesk-latin.woff2')).toString('base64');
const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Farben wie in css/fokus.css (:root) — dort ist die eine Stelle; hier nur abgeschrieben, weil das Bild ohne die Seite entsteht.
const FARBE = { papier: '#F6F4F0', tinte: '#111316', text: '#3C3F44', leise: '#62666B', grau: '#5F6468', akzent: '#7C3AED', nacht: '#0B0C0F', hell: '#F2F3F3', akzentNacht: '#A78BFA', grauNacht: '#A3ABAE' };
const zeichen = (linie, kern) => `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M37.86,16 A16,16 0 1 1 26.78,8.24" fill="none" stroke="${linie}" stroke-width="2.6" stroke-linecap="round"/><circle cx="35.33" cy="7.81" r="2.8" fill="${linie}"/><circle cx="24" cy="24" r="7" fill="${kern}"/></svg>`;
const kopf = (breite, hoehe, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: S; src: url(data:font/woff2;base64,${schrift}) format("woff2"); font-weight: 400 800; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${breite}px; height: ${hoehe}px; overflow: hidden; }
body { font-family: S, sans-serif; -webkit-font-smoothing: antialiased; }
${extra}</style></head><body>`;

/** Vorschaubild einer Seite: Marke oben, Vorzeile und Titel unten, Adresse und Claim als Fußzeile, das Zeichen groß und leise rechts. */
const vorschau = ({ titel, vorzeile }, dunkel) => {
  const f = dunkel ? { grund: FARBE.nacht, tinte: FARBE.hell, text: FARBE.grauNacht, leise: FARBE.grauNacht, kern: FARBE.akzentNacht, haar: 'rgba(242,243,243,.16)' } : { grund: FARBE.papier, tinte: FARBE.tinte, text: FARBE.text, leise: FARBE.leise, kern: FARBE.akzent, haar: 'rgba(17,19,22,.16)' };
  const groesse = titel.length <= 28 ? 80 : titel.length <= 46 ? 68 : 58;
  return `${kopf(1200, 630, `
body { background: ${f.grund}; color: ${f.tinte}; position: relative; }
.ring { position: absolute; right: -170px; top: 50%; width: 640px; height: 640px; transform: translateY(-50%); opacity: ${dunkel ? '.16' : '.07'}; }
.innen { position: absolute; inset: 0; padding: 62px 80px 54px; display: flex; flex-direction: column; }
.marke { display: flex; align-items: center; gap: 16px; }
.marke svg { width: 50px; height: 50px; }
.wort b { display: block; font-weight: 650; font-size: 23px; letter-spacing: .12em; line-height: 1; }
.wort small { display: block; margin-top: 6px; font-weight: 500; font-size: 15px; letter-spacing: .08em; color: ${f.text}; }
.vorzeile { margin-top: auto; display: flex; align-items: center; gap: 14px; font-size: 19px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${f.leise}; }
.vorzeile::before { content: ""; width: 11px; height: 11px; border-radius: 50%; background: ${f.kern}; flex: none; }
h1 { margin-top: 20px; max-width: 930px; font-size: ${groesse}px; font-weight: 600; letter-spacing: -.03em; line-height: 1.06; text-wrap: balance; }
.fuss { margin-top: 42px; padding-top: 22px; border-top: 1px solid ${f.haar}; display: flex; justify-content: space-between; font-size: 20px; color: ${f.text}; }
`)}<div class="ring">${zeichen(f.tinte, f.kern)}</div><div class="innen"><div class="marke">${zeichen(f.tinte, f.kern)}<span class="wort"><b>FOKUS</b><small>Innovation</small></span></div>
<p class="vorzeile">${e(vorzeile)}</p><h1>${e(titel)}</h1><div class="fuss"><span>fokusinnovation.de</span><span>Fortschritt braucht Fokus.</span></div></div></body></html>`;
};
/** Icon: das Zeichen auf Papier (randlos, Systeme runden selbst) oder frei auf durchsichtigem Grund (Logo für Google). */
const icon = (seite, frei) => `${kopf(seite, seite, `body { background: ${frei ? 'transparent' : FARBE.papier}; display: grid; place-items: center; } svg { width: ${frei ? 92 : 66}%; height: ${frei ? 92 : 66}%; }`)}${zeichen(FARBE.tinte, FARBE.akzent)}</body></html>`;

// ── Chrome steuern (Chrome DevTools Protocol über WebSocket) ──
const profil = mkdtempSync(join(tmpdir(), 'fokus-bilder-'));
const port = 9500 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
const warte = (ms) => new Promise((f) => setTimeout(f, ms));
let ws;
for (let i = 0; i < 240 && !ws; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find((x) => x.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch { /* Chrome startet noch */ }
  if (!ws) await warte(250);
}
if (!ws) { console.error('Chrome antwortet nicht. Pfad über CHROME=… setzen.'); process.exit(1); }
await new Promise((f) => ws.addEventListener('open', f));
let id = 0;
const offen = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((f) => { const i = ++id; offen.set(i, f); ws.send(JSON.stringify({ id: i, method, params })); });
await cdp('Page.enable');
const rahmen = (await cdp('Page.getFrameTree')).result.frameTree.frame.id;

const zeichne = async (html, breite, hoehe, frei = false) => {
  await cdp('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: false });
  await cdp('Emulation.setDefaultBackgroundColorOverride', frei ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
  await cdp('Page.setDocumentContent', { frameId: rahmen, html });
  await cdp('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => 1)', awaitPromise: true });
  await warte(60);
  const b = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: breite, height: hoehe, scale: 1 } });
  return Buffer.from(b.result.data, 'base64');
};
const schreibe = (datei, daten) => { mkdirSync(dirname(join(ORDNER, datei)), { recursive: true }); writeFileSync(join(ORDNER, datei), daten); };

// Vorschaubilder: eines je Seite; verwaiste Bilder (Seite gibt es nicht mehr) fliegen raus.
const seiten = seitenBauen().filter((s) => s.bild);
const sollen = new Set(seiten.map((s) => s.bild.datei.split('/').pop()));
mkdirSync(join(ORDNER, 'assets/bild/og'), { recursive: true });
for (const d of readdirSync(join(ORDNER, 'assets/bild/og'))) if (!sollen.has(d)) rmSync(join(ORDNER, 'assets/bild/og', d));
for (const s of seiten) schreibe(s.bild.datei, await zeichne(vorschau(s.bild, s.pfad === 'index.html'), 1200, 630));

// Logo (Google, strukturierte Daten), Icons (Handy, Browser), favicon.ico (48 px, PNG im ICO-Rahmen).
schreibe('assets/bild/logo.png', await zeichne(icon(512, true), 512, 512, true));
schreibe('assets/bild/apple-touch-icon.png', await zeichne(icon(180), 180, 180));
schreibe('assets/bild/icon-192.png', await zeichne(icon(192), 192, 192));
schreibe('assets/bild/icon-512.png', await zeichne(icon(512), 512, 512));
const png48 = await zeichne(icon(48), 48, 48);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(48, 6); ico.writeUInt8(48, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png48.length, 14); ico.writeUInt32LE(22, 18);
schreibe('favicon.ico', Buffer.concat([ico, png48]));

console.log(`${seiten.length} Vorschaubilder, Logo, 3 Icons und favicon.ico geschrieben`);
ws.close();
const beendet = new Promise((f) => chrome.once('exit', f));
chrome.kill();
await beendet;
try { rmSync(profil, { recursive: true, force: true }); } catch { /* Chrome räumt noch auf; der Ordner liegt im Temp-Verzeichnis */ }
