#!/usr/bin/env node
/* Standbilder der Startseite („Das Haus“) aufnehmen und dabei die Konsole mitlesen (auch Verstöße gegen die Sicherheitsregeln).
   Vorher: node werkzeug/csp-server.mjs   Aufruf: node werkzeug/haus-standbilder.mjs <zielordner> <profilordner> auftrag …
   Auftrag: name|abfrage|breite|höhe[|scrollY[|wartezeit in ms[|ausschnitt x,y,b,h[|schärfe[|skript]]]]], z. B.  szene-07|fahrt=1&szene=7|1440|900   (?fahrt=1&szene=<Nr 1 bis 15 oder Kennung, z. B. e2> springt in die Szene; ?p=0.4 zeichnet nur eine Stelle der Zeitachse)
   Abfrage „ohneskript“ nimmt die Fassung ohne Skript auf; „seite@abfrage“ eine andere Seite (z. B. sichtbarkeit/@). Ein Chrome ohne Fenster über eine Leitung. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASIS = process.env.BASIS || 'http://localhost:3391/'; // die Seite kommt vom Prüfserver (werkzeug/csp-server.mjs), damit die Sicherheitsregeln gelten
const [out = join(HERE, 'stills'), profile = '/tmp/make-haus-chrome', ...jobsArg] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FLOOR = (i) => (0.27 + i * 0.077 + 0.077 * 0.72).toFixed(4);
const A = '800,150,640,520';
const LISTE = [];
const jobs = jobsArg.length ? jobsArg.map((j) => { const [n, q, w, h, y, ms, aus, dsf, js] = j.split('|'); return [n, q, +w || 1440, +h || 900, y === undefined || y === '' ? undefined : +y, +ms || 0, aus || '', +dsf || 1, js || '']; }) : LISTE.filter((j) => !process.env.NUR || new RegExp(process.env.NUR).test(j[0])); // NUR='^(2[4-9]|3)' nimmt nur einen Teil der Liste auf

mkdirSync(out, { recursive: true }); mkdirSync(profile, { recursive: true });
const chrome = spawn('nice', ['-n', '10', CHROME, '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  `--user-data-dir=${resolve(profile)}`, '--remote-debugging-pipe', '--window-size=1440,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const kill = setTimeout(() => { console.error('Zeitgrenze erreicht, Chrome wird beendet.'); chrome.kill('SIGKILL'); process.exit(2); }, 600000);
const send = chrome.stdio[3], recv = chrome.stdio[4];
let id = 0, buf = Buffer.alloc(0); const wait = new Map(), logs = [];
recv.on('data', (d) => {
  buf = Buffer.concat([buf, d]); let i;
  while ((i = buf.indexOf(0)) >= 0) {
    const m = JSON.parse(buf.subarray(0, i).toString('utf8')); buf = buf.subarray(i + 1);
    if (m.id && wait.has(m.id)) { const [res, rej] = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('Ausnahme: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`Konsole ${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') logs.push('Protokoll: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  }
});
const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => { const n = ++id; wait.set(n, [res, rej]); send.write(JSON.stringify({ id: n, method, params, sessionId }) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => cdp(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
const seiteVon = (q) => (q.includes('@') ? q.split('@') : ['index.html', q]); // „studios.html@paket=3“ nimmt eine Unterseite auf
let fehler = 0;
for (const [name, query, w, h, y, ms = 0, aus = '', dsf = 1, js = ''] of jobs) {
  const before = logs.length;
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile: w < 600 });
  const [seite, abfrage] = seiteVon(query);
  const ohneSkript = /(^|&)ohneskript/.test(abfrage); await S('Emulation.setScriptExecutionDisabled', { value: ohneSkript });
  await S('Page.navigate', { url: `${BASIS}${seite === 'index.html' ? '' : seite}?${abfrage}` });
  let ok = false;
  for (let i = 0; i < (ohneSkript ? 8 : 80) && !ok; i++) { await sleep(150); const r = await S('Runtime.evaluate', { expression: "document.documentElement.dataset.bereit === '1'" }).catch(() => null); ok = !!(r && r.result.value); }
  if (ms) await sleep(ms);
  if (y !== undefined) { await S('Runtime.evaluate', { expression: `window.lenis ? window.lenis.scrollTo(${y}, { immediate: true, force: true }) : window.scrollTo(0, ${y})` }); await sleep(1800); }
  if (js) { await S('Runtime.evaluate', { expression: js }); await sleep(1300); } // z. B. einen Klickpunkt drücken
  let clip;
  if (aus) { const [cx, cy, cw, ch] = aus.split(',').map(Number); clip = { x: cx, y: cy, width: cw, height: ch, scale: 1 }; } // Ausschnitt x,y,breite,höhe
  if (abfrage.startsWith('s=')) { // Abschnitt: das Bild endet mit dem Abschnitt
    const lang = abfrage.startsWith('s=nach'); // ?s=nach: der ganze helle Teil samt Fuß als ein langes Bild
    const hh = (await S('Runtime.evaluate', { expression: lang ? 'document.documentElement.scrollHeight' : "Math.ceil((document.querySelector('main > section:not(.gone)') || document.querySelector('footer')).getBoundingClientRect().height)" })).result.value;
    if (hh > 200 && !clip) clip = { x: 0, y: 0, width: w, height: Math.min(lang ? 24000 : 6000, hh), scale: 1 };
  }
  await sleep(700);
  const info = (await S('Runtime.evaluate', { expression: "JSON.stringify({ f: document.documentElement.dataset.fehler, w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth, s: [...document.fonts].map((f) => f.status).join(',') })" })).result.value;
  const shot = await S('Page.captureScreenshot', clip ? { format: 'png', clip, captureBeyondViewport: true } : { format: 'png' });
  writeFileSync(join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
  const neu = logs.slice(before); const f = JSON.parse(info);
  fehler += neu.length + (+f.f || 0);
  console.log(`${name}  ${query}  ${w}×${h}  bereit=${ok}  Seitenfehler=${f.f}  Schrift=${f.s}  Breite=${f.sw}${f.sw > f.w ? ' (läuft über!)' : ''}${neu.length ? '\n   ' + neu.join('\n   ') : ''}`);
}
console.log(`Fertig. Fehler und Warnungen in der Konsole: ${fehler}`);
clearTimeout(kill);
await cdp('Browser.close').catch(() => {});
setTimeout(() => process.exit(0), 300);
