#!/usr/bin/env node
/* Aufnahme und Echtlauf über eine CDP-Leitung (Mausrad, Klicks, Tasten, eigene Skripte). Aufruf: node haus-echtlauf.mjs <auftraege.json> <ausgabeordner> <profil>
   Vorher: node werkzeug/csp-server.mjs <port> (die Adressen in haus-echtlauf.json zeigen auf 3391; anderer Port: Datei mit sed kopieren).
   Skript-Schritte: Zahl = warten (ms) · taste:<Taste> · rad:x,y,dy (Mausrad) · wisch:x,y,strecke (Wischen mit dem Finger, nach oben) · klicksel:<Selektor> · klick:x,y · sonst ein Ausdruck.
   Auftrag: { name, url, w, h, voll?, y?, ms?, js?[], wurzel? (Ordner, der unter http://vorbild.test/ ausgeliefert wird), dsf?, clip? } */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
const [jobsFile, out, profile] = process.argv.slice(2);
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(out, { recursive: true }); mkdirSync(profile, { recursive: true });
const chrome = spawn('nice', ['-n', '10', CHROME, '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  `--user-data-dir=${resolve(profile)}`, '--remote-debugging-pipe', '--window-size=1440,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const kill = setTimeout(() => { console.error('Zeitgrenze'); chrome.kill('SIGKILL'); process.exit(2); }, +(process.env.GRENZE || 300000));
const send = chrome.stdio[3], recv = chrome.stdio[4];
let id = 0, buf = Buffer.alloc(0); const wait = new Map(), logs = []; let wurzel = null, sess = null;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webmanifest': 'application/json' };
recv.on('data', (d) => {
  buf = Buffer.concat([buf, d]); let i;
  while ((i = buf.indexOf(0)) >= 0) {
    const m = JSON.parse(buf.subarray(0, i).toString('utf8')); buf = buf.subarray(i + 1);
    if (m.id && wait.has(m.id)) { const [res, rej] = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method === 'Fetch.requestPaused') {
      const u = new URL(m.params.request.url); let p = decodeURIComponent(u.pathname); let f = join(wurzel || '/nix', p);
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
      if (wurzel && existsSync(f)) cdp('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: MIME[extname(f)] || 'application/octet-stream' }], body: readFileSync(f).toString('base64') }, sess).catch(() => {});
      else cdp('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 404, body: '' }, sess).catch(() => {});
    }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('Ausnahme: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`Konsole ${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('Protokoll: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  }
});
const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => { const n = ++id; wait.set(n, [res, rej]); send.write(JSON.stringify({ id: n, method, params, sessionId }) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true }); sess = sessionId;
const S = (m, p) => cdp(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
await S('Fetch.enable', { patterns: [{ urlPattern: 'http://vorbild.test/*' }] });
const ev = async (x) => (await S('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
let fehler = 0;
for (const j of jobs) {
  const before = logs.length; wurzel = j.wurzel || null;
  await S('Emulation.setDeviceMetricsOverride', { width: j.w, height: j.h, deviceScaleFactor: j.dsf || 1, mobile: j.w < 600 });
  if (j.reduziert) await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); else await S('Emulation.setEmulatedMedia', { features: [] });
  if (j.url) { await S('Page.navigate', { url: j.url }); await sleep(j.lade || 1500);
    if (j.bereit) { let ok = false; for (let i = 0; i < 80 && !ok; i++) { await sleep(150); ok = !!(await ev("document.documentElement.dataset.bereit === '1'").catch(() => 0)); } } }
  if (j.y !== undefined) { await ev(`window.lenis ? window.lenis.scrollTo(${j.y}, { immediate: true, force: true }) : window.scrollTo(0, ${j.y})`); await sleep(900); }
  for (const s of j.js || []) { if (typeof s === 'number') await sleep(s); else if (s.startsWith('taste:')) { const key = s.slice(6); const map = { Tab: 9, Escape: 27, Enter: 13 }; for (const type of ['keyDown', 'keyUp']) await S('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: map[key] || 0 }); await sleep(200); } else if (s.startsWith('rad:')) { const [x, y, dy] = s.slice(4).split(',').map(Number); await S('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); await sleep(120); } else if (s.startsWith('wisch:')) { const [x, y, d] = s.slice(6).split(',').map(Number); await S('Input.synthesizeScrollGesture', { x, y, yDistance: -d, speed: +(process.env.WISCHTEMPO || 1800), gestureSourceType: 'touch' }); await sleep(300); } else if (s.startsWith('klicksel:')) { // echter Mausklick auf ein Element: erst hinfahren (löst das Überfahren aus), dann drücken und loslassen
      const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(s.slice(9))});if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.x+r.width/2),Math.round(r.y+r.height/2)]})()`);
      if (!r) { console.log('   → klicksel: nicht gefunden', s.slice(9)); } else { await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] }); await sleep(150); for (const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 }); await sleep(300); }
    } else if (s.startsWith('klick:')) { const [x, y] = s.slice(6).split(',').map(Number); for (const type of ['mousePressed', 'mouseReleased']) await S('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(300); } else { const r = await ev(s).catch((e) => 'FEHLER ' + e.message); if (r !== undefined && r !== null && j.zeig) console.log('   →', typeof r === 'string' ? r : JSON.stringify(r)); await sleep(250); } }
  if (j.ms) await sleep(j.ms);
  let clip;
  if (j.voll) { const hh = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'); clip = { x: 0, y: 0, width: j.w, height: Math.min(j.max || 16000, hh), scale: 1 }; }
  if (j.clip) { const [x, y, w, h] = j.clip; clip = { x, y, width: w, height: h, scale: 1 }; }
  if (j.clipSel) { const r = await ev(`(()=>{const r=document.querySelector(${JSON.stringify(j.clipSel)}).getBoundingClientRect();return [0,Math.max(0,r.top+scrollY),innerWidth,r.height]})()`); clip = { x: r[0], y: r[1], width: r[2], height: Math.min(j.max || 9000, r[3]), scale: 1 }; }
  if (j.name) { const shot = await S('Page.captureScreenshot', clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' }); writeFileSync(join(out, j.name + '.png'), Buffer.from(shot.data, 'base64')); }
  const info = await ev("JSON.stringify({ f: document.documentElement.dataset.fehler, w: innerWidth, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight })");
  const neu = logs.slice(before); fehler += neu.length;
  console.log(`${j.name || '(ohne Bild)'}  ${j.w}×${j.h}  ${info}${neu.length ? '\n   ' + neu.join('\n   ') : ''}`);
}
console.log(`Fertig. Meldungen: ${fehler}`);
clearTimeout(kill); await cdp('Browser.close').catch(() => {}); setTimeout(() => process.exit(0), 300);
