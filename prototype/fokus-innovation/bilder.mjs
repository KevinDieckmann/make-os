#!/usr/bin/env node
// ─── MAKE Innovation · Vorschaubilder und Icons (27.10.2026) ────────────────────────────────────────────────────────
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
const FARBE = { papier: '#F6F4F0', tinte: '#111316', text: '#3C3F44', leise: '#62666B', grau: '#5F6468', akzent: '#7C3AED', nacht: '#0B0C0F', hell: '#F2F3F3', akzentNacht: '#A78BFA', grauNacht: '#A3ABAE', kernNacht: '#8B5CF6', spur: '#A78BFA' };
// Zeichen „Durchbruch“ (Spur · Wand · Kern) wie im Markenpaket; klein = Favicon-Fassung (ohne Spur, breitere Lücke) für 48 px.
const zeichen = (wand, kern) => `<svg viewBox="2.7 5 38 38" xmlns="http://www.w3.org/2000/svg"><path d="M6,18.5H14.5M4,24H14.5M8,29.5H14.5" fill="none" stroke="${FARBE.spur}" stroke-width="2.6" stroke-linecap="round"/><path d="M18.8,6H24.2A0.8,0.8 0 0 1 25,6.8V12.44A12.8,12.8 0 0 0 18,21.25V6.8A0.8,0.8 0 0 1 18.8,6ZM18,26.75A12.8,12.8 0 0 0 25,35.56V41.2A0.8,0.8 0 0 1 24.2,42H18.8A0.8,0.8 0 0 1 18,41.2Z" fill="${wand}"/><circle cx="30.5" cy="24" r="10.2" fill="${kern}"/></svg>`;
const zeichenKlein = (wand, kern) => `<svg viewBox="10.35 5 38 38" xmlns="http://www.w3.org/2000/svg"><path d="M18.8,6H24.2A0.8,0.8 0 0 1 25,6.8V11.78A13.4,13.4 0 0 0 18,19.17V6.8A0.8,0.8 0 0 1 18.8,6ZM18,28.83A13.4,13.4 0 0 0 25,36.22V41.2A0.8,0.8 0 0 1 24.2,42H18.8A0.8,0.8 0 0 1 18,41.2Z" fill="${wand}"/><circle cx="30.5" cy="24" r="10.2" fill="${kern}"/></svg>`;
const wortbild = (wort, unter) => `<svg class="wortbild" viewBox="55.6 17.4 212.6 13.4" xmlns="http://www.w3.org/2000/svg"><path d="M58.57 30.30L56 30.30L56.68 18.00L60.97 18.00L63.46 28.52L63.15 28.52L65.66 18.00L69.95 18.00L70.63 30.30L68.06 30.30L67.51 19.88L67.54 19.88L64.93 30.30L61.70 30.30L59.09 19.88L59.12 19.88L58.57 30.30ZM77.39 30.30L74.55 30.30L79.27 18.00L82.63 18.00L87.33 30.30L84.49 30.30L80.94 19.91L77.39 30.30ZM84.22 26.93L77.64 26.93L77.64 24.82L84.22 24.82L84.22 26.93ZM94.22 30.30L91.58 30.30L91.58 18.00L94.22 18.00L94.22 23.03L99.28 18.00L102.54 18.00L97.98 22.52L102.86 30.30L99.82 30.30L96.16 24.32L94.22 26.25L94.22 30.30ZM116.07 30.30L107.27 30.30L107.27 18.00L115.95 18.00L115.95 20.23L109.91 20.23L109.91 22.76L115.03 22.76L115.03 24.90L109.91 24.90L109.91 28.07L116.07 28.07L116.07 30.30Z" fill="${wort}"/><path d="M131.55 30.30L125.99 30.30L125.99 28.50L127.66 28.50L127.66 19.80L125.99 19.80L125.99 18.00L131.55 18.00L131.55 19.80L129.88 19.80L129.88 28.50L131.55 28.50L131.55 30.30ZM138.65 30.30L136.53 30.30L136.53 18.00L139.67 18.00L145.60 28.99L145.00 29.04L145.00 18.00L147.11 18.00L147.11 30.30L144.09 30.30L138.01 19.24L138.65 19.18L138.65 30.30ZM154.79 30.30L152.67 30.30L152.67 18.00L155.81 18.00L161.74 28.99L161.14 29.04L161.14 18.00L163.26 18.00L163.26 30.30L160.23 30.30L154.16 19.24L154.79 19.18L154.79 30.30ZM174.25 30.51L174.25 30.51Q172.38 30.51 171.01 29.74Q169.65 28.97 168.91 27.54Q168.18 26.11 168.18 24.15L168.18 24.15Q168.18 22.18 168.91 20.76Q169.65 19.33 171.01 18.56Q172.38 17.78 174.25 17.78L174.25 17.78Q176.12 17.78 177.48 18.56Q178.84 19.33 179.58 20.76Q180.31 22.18 180.31 24.15L180.31 24.15Q180.31 26.11 179.58 27.54Q178.84 28.97 177.48 29.74Q176.12 30.51 174.25 30.51ZM174.25 28.66L174.25 28.66Q175.41 28.66 176.24 28.12Q177.08 27.57 177.52 26.56Q177.96 25.55 177.96 24.15L177.96 24.15Q177.96 22.74 177.52 21.73Q177.08 20.72 176.24 20.18Q175.41 19.64 174.25 19.64L174.25 19.64Q173.09 19.64 172.26 20.18Q171.43 20.72 170.98 21.73Q170.53 22.74 170.53 24.15L170.53 24.15Q170.53 25.55 170.98 26.56Q171.43 27.57 172.26 28.12Q173.09 28.66 174.25 28.66ZM191.45 30.30L188.71 30.30L184.26 18.00L186.64 18.00L190.23 28.87L189.95 28.87L193.51 18.00L195.88 18.00L191.45 30.30ZM201.66 30.30L199.29 30.30L204.19 18.00L206.84 18.00L211.73 30.30L209.35 30.30L205.51 19.79L201.66 30.30ZM208.79 26.68L202.21 26.68L202.21 24.89L208.79 24.89L208.79 26.68ZM221.79 30.30L219.57 30.30L219.57 19.85L215.21 19.85L215.21 18.00L226.17 18.00L226.17 19.85L221.79 19.85L221.79 30.30ZM235.80 30.30L230.24 30.30L230.24 28.50L231.91 28.50L231.91 19.80L230.24 19.80L230.24 18.00L235.80 18.00L235.80 19.80L234.13 19.80L234.13 28.50L235.80 28.50L235.80 30.30ZM246.21 30.51L246.21 30.51Q244.34 30.51 242.98 29.74Q241.61 28.97 240.88 27.54Q240.14 26.11 240.14 24.15L240.14 24.15Q240.14 22.18 240.88 20.76Q241.61 19.33 242.98 18.56Q244.34 17.78 246.21 17.78L246.21 17.78Q248.08 17.78 249.44 18.56Q250.81 19.33 251.54 20.76Q252.28 22.18 252.28 24.15L252.28 24.15Q252.28 26.11 251.54 27.54Q250.81 28.97 249.44 29.74Q248.08 30.51 246.21 30.51ZM246.21 28.66L246.21 28.66Q247.37 28.66 248.21 28.12Q249.04 27.57 249.48 26.56Q249.93 25.55 249.93 24.15L249.93 24.15Q249.93 22.74 249.48 21.73Q249.04 20.72 248.21 20.18Q247.37 19.64 246.21 19.64L246.21 19.64Q245.06 19.64 244.22 20.18Q243.39 20.72 242.94 21.73Q242.49 22.74 242.49 24.15L242.49 24.15Q242.49 25.55 242.94 26.56Q243.39 27.57 244.22 28.12Q245.06 28.66 246.21 28.66ZM259.32 30.30L257.20 30.30L257.20 18.00L260.35 18.00L266.28 28.99L265.67 29.04L265.67 18.00L267.79 18.00L267.79 30.30L264.76 30.30L258.69 19.24L259.32 19.18L259.32 30.30Z" fill="${unter}"/></svg>`;
const kopf = (breite, hoehe, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: S; src: url(data:font/woff2;base64,${schrift}) format("woff2"); font-weight: 400 800; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${breite}px; height: ${hoehe}px; overflow: hidden; }
body { font-family: S, sans-serif; -webkit-font-smoothing: antialiased; }
${extra}</style></head><body>`;

/** Vorschaubild einer Seite: Marke oben, Vorzeile und Titel unten, Adresse und Claim als Fußzeile, das Zeichen groß und leise rechts. */
const vorschau = ({ titel, vorzeile }, dunkel) => {
  const f = dunkel ? { grund: FARBE.nacht, tinte: FARBE.hell, text: FARBE.grauNacht, leise: FARBE.grauNacht, kern: FARBE.kernNacht, punkt: FARBE.akzentNacht, unter: FARBE.grauNacht, haar: 'rgba(242,243,243,.16)' } : { grund: FARBE.papier, tinte: FARBE.tinte, text: FARBE.text, leise: FARBE.leise, kern: FARBE.akzent, punkt: FARBE.akzent, unter: FARBE.grau, haar: 'rgba(17,19,22,.16)' };
  const groesse = titel.length <= 28 ? 80 : titel.length <= 46 ? 68 : 58;
  return `${kopf(1200, 630, `
body { background: ${f.grund}; color: ${f.tinte}; position: relative; }
.ring { position: absolute; right: -170px; top: 50%; width: 640px; height: 640px; transform: translateY(-50%); opacity: ${dunkel ? '.16' : '.07'}; }
.innen { position: absolute; inset: 0; padding: 62px 80px 54px; display: flex; flex-direction: column; }
.marke { display: flex; align-items: center; gap: 19px; }
.marke svg { width: 50px; height: 50px; }
.marke svg.wortbild { width: 280px; height: 17.6px; }
.vorzeile { margin-top: auto; display: flex; align-items: center; gap: 14px; font-size: 19px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${f.leise}; }
.vorzeile::before { content: ""; width: 11px; height: 11px; border-radius: 50%; background: ${f.punkt}; flex: none; }
h1 { margin-top: 20px; max-width: 930px; font-size: ${groesse}px; font-weight: 600; letter-spacing: -.03em; line-height: 1.06; text-wrap: balance; }
.fuss { margin-top: 42px; padding-top: 22px; border-top: 1px solid ${f.haar}; display: flex; justify-content: space-between; font-size: 20px; color: ${f.text}; }
`)}<div class="ring">${zeichen(f.tinte, f.kern)}</div><div class="innen"><div class="marke">${zeichen(f.tinte, f.kern)}${wortbild(f.tinte, f.unter)}</div>
<p class="vorzeile">${e(vorzeile)}</p><h1>${e(titel)}</h1><div class="fuss"><span>makeinnovation.de</span><span>Innovation braucht Umsetzung.</span></div></div></body></html>`;
};
/** Icon: das Zeichen auf Papier (randlos, Systeme runden selbst) oder frei auf durchsichtigem Grund (Logo für Google). */
// Kachel wie im Markenpaket: das ganze Zeichen auf 64 Einheiten Papier (≈ 60 %); favicon.ico in der kleinen Fassung.
const icon = (seite, frei, klein = false) => `${kopf(seite, seite, `body { background: ${frei ? 'transparent' : FARBE.papier}; display: grid; place-items: center; } svg { width: ${frei ? 92 : klein ? 95 : 60}%; height: ${frei ? 92 : klein ? 95 : 60}%; }`)}${(klein ? zeichenKlein : zeichen)(FARBE.tinte, FARBE.akzent)}</body></html>`;

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
const png48 = await zeichne(icon(48, false, true), 48, 48);
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
