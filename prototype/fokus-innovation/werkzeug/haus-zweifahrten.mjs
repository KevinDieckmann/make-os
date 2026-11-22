#!/usr/bin/env node
/* Mehrere Fahrten hintereinander auf DERSELBEN geladenen Seite (Chrome ohne Fenster; nur Diagnose, Auftrag Z, 22.11.2026): Ist die erste Fahrt im Skript teurer als die zweite?
   Die erste Fahrt läuft mit frisch geladenem, noch nie ausgeführtem Code, die zweite mit warmem. Je Fahrt: gezeichnete Bilder, Summe, Mitte, 90 %, 99 % und Höchstwert der Skriptzeit je Bild
   (__haus.zaehlen), die Bilder über AB ms mit ihren Teilen und die Summe je halber Lage.
   Aufruf: node werkzeug/haus-zweifahrten.mjs <adresse> <profilordner> [warten ms = 9000] [fahrten = 2]     Umgebung: GPU=1 · AB=<ms> (Vorgabe 4) */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [url, profile, wartenArg = '9000', fahrtenArg = '2'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(profile, { recursive: true });
const chrome = spawn('nice', ['-n', '10', CHROME, '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  `--user-data-dir=${resolve(profile)}`, '--remote-debugging-pipe', '--window-size=1470,801', ...(process.env.GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-accelerated-2d-canvas'] : []), 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const kill = setTimeout(() => { console.error('Zeitgrenze'); chrome.kill('SIGKILL'); process.exit(2); }, 280000);
const send = chrome.stdio[3], recv = chrome.stdio[4];
let id = 0, buf = Buffer.alloc(0); const wait = new Map(); const logs = [];
recv.on('data', (d) => {
  buf = Buffer.concat([buf, d]); let i;
  while ((i = buf.indexOf(0)) >= 0) {
    const m = JSON.parse(buf.subarray(0, i).toString('utf8')); buf = buf.subarray(i + 1);
    if (m.id && wait.has(m.id)) { const [res, rej] = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method === 'Runtime.exceptionThrown') logs.push('Ausnahme: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(`Konsole ${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
});
const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => { const n = ++id; wait.set(n, [res, rej]); send.write(JSON.stringify({ id: n, method, params, sessionId }) + '\0'); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => cdp(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 1470, height: 801, deviceScaleFactor: 2, mobile: false });
await S('Page.navigate', { url });
await sleep(+wartenArg);
const AB = +process.env.AB || 4;
const lauf = `(async()=>{const raf=()=>new Promise(r=>requestAnimationFrame(r));const o={n:0,ue25:0,max:0};__haus.zaehlen(true);let t=await raf(),t0=t;__haus.zaehlen();while(t-t0<31000){window.dispatchEvent(new WheelEvent('wheel',{deltaY:16,bubbles:true,cancelable:true}));const n=await raf(),d=n-t;t=n;o.n++;if(d>25){o.ue25++;if(d>o.max)o.max=Math.round(d);}}o.ende=+__haus.ort(scrollY).lage.toFixed(2);const z=__haus.zaehlen().filter(f=>f.ms);const ms=z.map(f=>f.ms).sort((a,b)=>a-b);o.bilder=ms.length;o.summe=Math.round(ms.reduce((a,b)=>a+b,0));o.med=ms[ms.length>>1];o.p90=ms[Math.floor(ms.length*0.9)];o.p99=ms[Math.floor(ms.length*0.99)];o.hoechst=ms[ms.length-1];o.ueber=z.filter(f=>f.ms>${AB}).map(f=>[f.lage,f.pfad,f.ms,f.teile,f.neben]);const je={};for(const f of z){const k=Math.floor(f.lage*2)/2;je[k]=+((je[k]||0)+f.ms).toFixed(1);}o.je=je;return JSON.stringify(o)})()`;
for (let i = 0; i < +fahrtenArg; i++) {
  const r = await S('Runtime.evaluate', { expression: lauf, awaitPromise: true, returnByValue: true });
  const o = JSON.parse(r.result.value); const ueber = o.ueber; delete o.ueber;
  console.log(`Fahrt ${i + 1}: ${JSON.stringify(o)}`); for (const u of ueber) console.log('   ' + JSON.stringify(u));
  await S('Runtime.evaluate', { expression: 'window.scrollTo(0,0); document.documentElement.scrollTop = 0; 1' }); await sleep(600);
  await S('Runtime.evaluate', { expression: 'window.dispatchEvent(new WheelEvent("wheel",{deltaY:-99999,bubbles:true,cancelable:true})); scrollY' }); await sleep(4000);
  const y = await S('Runtime.evaluate', { expression: 'JSON.stringify([scrollY, __haus.ort(scrollY).lage])' }); console.log('   zurück: ' + y.result.value);
}
if (logs.length) console.log(logs.join('\n'));
await cdp('Browser.close').catch(() => {}); clearTimeout(kill); setTimeout(() => process.exit(0), 300);
