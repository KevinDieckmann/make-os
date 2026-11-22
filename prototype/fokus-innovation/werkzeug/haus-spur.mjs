#!/usr/bin/env node
/* Spur einer Fahrt durch „Das Haus“ im Chrome ohne Fenster (nur Diagnose, Auftrag Z, 22.11.2026): Was steckt in den langen Bildern: Übersetzen des Skripts,
   Aufräumen des Speichers (GC), Stil und Layout oder die Zeichnung? Fährt wie die Messung im echten Chrome (je Bild ein Rad-Ereignis mit deltaY 16) und liest die Spur des Browsers mit.
   Aufruf: node werkzeug/haus-spur.mjs <adresse> <profilordner> <ausgabe.json> [warten ms = 9000] [fahrt ms = 31000]
     z. B. node werkzeug/haus-spur.mjs 'http://localhost:3391/?fahrt=1&kalt=1' /tmp/make-spur-profil /tmp/spur.json
     Ein frischer (leerer) Profilordner ist der ehrlichste Erstbesuch: kein Zwischenspeicher für Dateien, übersetzten Code und Grafikprogramme.
   Umgebung: GPU=1 schaltet die Grafikkarte zu · AB=<ms> Schwelle für „langes Bild“ (Vorgabe 14) · ZAEHLEN=<ms> gibt dazu je Bild über dieser Skriptzeit die Teile aus (__haus.zaehlen)
             · PROFIL=1 nimmt Stichproben mit (welche Funktion in einem langen Bild lief).
   Ausgabe (JSON): lauf (Bilder, über 25/40/70 ms, längstes, Lagen) · summen (Übersetzen, GC: ms und Anzahl) · jeLage (Übersetzen je Lage) · gross (die längsten Einzelschritte des Browsers)
                   · langeBilder (je langem Bild: Lage, Dauer, Anteile, übersetzte Funktionen, mit PROFIL die Funktionen). Ein Chrome ohne Fenster über eine Leitung, nice 10. */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [url, profile, aus, wartenArg = '9000', fahrtArg = '31000'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(profile, { recursive: true });
const chrome = spawn('nice', ['-n', '10', CHROME, '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  `--user-data-dir=${resolve(profile)}`, '--remote-debugging-pipe', '--window-size=1470,801', ...(process.env.GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-accelerated-2d-canvas'] : []), 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const kill = setTimeout(() => { console.error('Zeitgrenze'); chrome.kill('SIGKILL'); process.exit(2); }, 240000);
const send = chrome.stdio[3], recv = chrome.stdio[4];
let id = 0, buf = Buffer.alloc(0); const wait = new Map(); const ev = []; let fertig = null; const logs = [];
const BEHALTEN = /^Profile|Compile|HitTest|Intersection|TimerFire|EventDispatch|Layer|GC|Parse|Optimize|Deopt|EvaluateScript|FunctionCall|FireAnimationFrame|RunTask|Layout|UpdateLayoutTree|Paint|Commit|Raster|Decode|TimeStamp|thread_name|ProduceCache|Deserialize|Flush|Sweep/;
recv.on('data', (d) => {
  buf = Buffer.concat([buf, d]); let i;
  while ((i = buf.indexOf(0)) >= 0) {
    const m = JSON.parse(buf.subarray(0, i).toString('utf8')); buf = buf.subarray(i + 1);
    if (m.id && wait.has(m.id)) { const [res, rej] = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method === 'Tracing.dataCollected') { for (const e of m.params.value) if (BEHALTEN.test(e.name) && (e.ph !== 'X' || e.dur >= 200 || /Compile|GC/.test(e.name))) ev.push(e); }
    else if (m.method === 'Tracing.tracingComplete') { if (fertig) fertig(); }
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
await cdp('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['v8', 'devtools.timeline', 'disabled-by-default-v8.compile', 'disabled-by-default-v8.gc', 'blink.user_timing', ...(process.env.PROFIL ? ['disabled-by-default-v8.cpu_profiler', 'disabled-by-default-v8.cpu_profiler.hires'] : [])], excludedCategories: ['*'] } });
const lauf = `(async()=>{const raf=()=>new Promise(r=>requestAnimationFrame(r));const o={n:0,ue25:0,ue40:0,ue70:0,max:0,lang:[]};__haus.mess.lang.length=0;${process.env.ZAEHLEN ? '__haus.zaehlen(true);' : ''}let t=await raf(),t0=t;while(t-t0<${+fahrtArg}){window.dispatchEvent(new WheelEvent('wheel',{deltaY:16,bubbles:true,cancelable:true}));const n=await raf(),d=n-t;t=n;o.n++;console.timeStamp('L'+__haus.ort(scrollY).lage.toFixed(2));if(d>25){o.ue25++;if(d>40)o.ue40++;if(d>70)o.ue70++;if(d>o.max)o.max=Math.round(d);o.lang.push([+__haus.ort(scrollY).lage.toFixed(2),Math.round(d),Math.round(n-t0)]);}}o.ende=+__haus.ort(scrollY).lage.toFixed(2);o.stufe=__haus.stufe();o.skript=__haus.lang().filter(e=>e[1]>14).map(e=>[Math.round(e[0]-t0),e[1],e[2]]);${process.env.ZAEHLEN ? "o.z=__haus.zaehlen().filter(f=>f.ms>" + (+process.env.ZAEHLEN) + ").map(f=>[f.lage,f.pfad,f.ms,f.teile,f.neben]);" : ''}return JSON.stringify(o)})()`;
const r = await S('Runtime.evaluate', { expression: lauf, awaitPromise: true, returnByValue: true });
const lage = JSON.parse(r.result.value);
const ende = new Promise((res) => { fertig = res; });
await cdp('Tracing.end'); await ende;
// Auswertung: der Hauptfaden der Seite = der Faden mit den meisten FireAnimationFrame
const zahl = new Map(); for (const e of ev) if (e.name === 'FireAnimationFrame') { const k = `${e.pid}:${e.tid}`; zahl.set(k, (zahl.get(k) || 0) + 1); }
const haupt = [...zahl].sort((a, b) => b[1] - a[1])[0]?.[0];
const mein = ev.filter((e) => `${e.pid}:${e.tid}` === haupt).sort((a, b) => a.ts - b.ts);
const marken = mein.filter((e) => e.name === 'TimeStamp').map((e) => [e.ts, e.args?.data?.message || '']);
const lageBei = (ts) => { let lo = 0, hi = marken.length - 1, a = ''; while (lo <= hi) { const m = (lo + hi) >> 1; if (marken[m][0] <= ts) { a = marken[m][1]; lo = m + 1; } else hi = m - 1; } return a; };
const X = mein.filter((e) => e.ph === 'X');
const bilder = X.filter((e) => e.name === 'FireAnimationFrame' && e.dur > (+process.env.AB || 14) * 1000);
const summen = {}; const fn = {};
for (const e of X) if (/Compile|GC|Parse|Optimize|Deserialize/.test(e.name)) { summen[e.name] = summen[e.name] || [0, 0]; summen[e.name][0] += e.dur / 1000; summen[e.name][1]++; }
// Stichproben des Profils (nur mit PROFIL=1): je Funktion die Zeit, die in einem langen Bild in ihr selbst und unter ihr verbracht wurde
const knoten = new Map(), proben = [];
for (const e of ev) if (e.name === 'ProfileChunk') for (const n of e.args?.data?.cpuProfile?.nodes || []) knoten.set(n.id, { name: n.callFrame?.functionName || '(anonym)', eltern: n.parent });
{ // die Zeitstempel der Stichproben laufen über alle Stücke fort (das erste Stück beginnt bei der Startzeit des Profils)
  const start = ev.find((e) => e.name === 'Profile'); let ts = start?.args?.data?.startTime ?? 0; proben.length = 0;
  for (const e of ev.filter((x) => x.name === 'ProfileChunk').sort((a, b) => a.ts - b.ts)) { const d = e.args?.data || {}, sm = d.cpuProfile?.samples || [], td = d.timeDeltas || []; for (let i = 0; i < sm.length; i++) { ts += td[i] || 0; proben.push([ts, sm[i], td[i] || 0]); } }
}
const profilIn = (a, b) => {
  const selbst = {}, unter = {};
  for (const [ts, id, dt] of proben) if (ts >= a && ts <= b) { let n = knoten.get(id); if (!n) continue; selbst[n.name] = (selbst[n.name] || 0) + dt / 1000; const gesehen = new Set(); let k = id; while (k && knoten.get(k)) { const nm = knoten.get(k).name; if (!gesehen.has(nm)) { gesehen.add(nm); unter[nm] = (unter[nm] || 0) + dt / 1000; } k = knoten.get(k).eltern; } }
  const top = (o, n) => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${k}:${v.toFixed(1)}`).join(' ');
  return { selbst: top(selbst, 14), unter: top(unter, 22) };
};
const langeBilder = bilder.map((b) => {
  const innen = X.filter((e) => e !== b && e.ts >= b.ts && e.ts + e.dur <= b.ts + b.dur);
  const je = {}; for (const e of innen) if (!/FunctionCall|RunTask/.test(e.name)) { je[e.name] = +((je[e.name] || 0) + e.dur / 1000).toFixed(2); }
  const fns = innen.filter((e) => /Compile/.test(e.name) && e.dur > 150).map((e) => `${e.args?.data?.functionName || e.args?.function || e.args?.data?.url?.slice(-20) || '?'}:${(e.dur / 1000).toFixed(1)}`).slice(0, 25);
  return { lage: lageBei(b.ts), ms: +(b.dur / 1000).toFixed(1), je, fns, ...(proben.length ? profilIn(b.ts, b.ts + b.dur) : {}) };
});
const jeLage = {}; for (const e of X) if (e.name === 'V8.CompileCode') { const l = lageBei(e.ts).slice(1, 4); jeLage[l] = +((jeLage[l] || 0) + e.dur / 1000).toFixed(2); }
const t0spur = marken.length ? marken[0][0] : 0;
const gross = X.filter((e) => /^(UpdateLayoutTree|Layout|Paint|PrePaint|Commit|ParseHTML|Decode Image|RunTask|EventDispatch|FunctionCall|TimerFire|HitTest|IntersectionObserverController::computeIntersections|ScheduleStyleRecalculation|UpdateLayer|Layerize)$/.test(e.name) && e.dur > 4000).sort((a, b) => b.dur - a.dur).slice(0, 25).map((e) => `${e.name} ${(e.dur / 1000).toFixed(1)} ms bei ${lageBei(e.ts)} t=${((e.ts - t0spur) / 1000).toFixed(0)} ${JSON.stringify(e.args?.beginData || e.args?.data || e.args || {}).slice(0, 160)}`);
const gc = X.filter((e) => /GC/.test(e.name) && e.dur > 3000).map((e) => ({ name: e.name, lage: lageBei(e.ts), ms: +(e.dur / 1000).toFixed(1), art: e.args?.type || e.args?.data?.type || '' }));
const namen = {}; for (const e of X) { namen[e.name] = namen[e.name] || [0, 0]; namen[e.name][0] += e.dur / 1000; namen[e.name][1]++; }
const o = { url: url.replace(/\?.*/, '?…'), lauf: lage, summen: Object.fromEntries(Object.entries(summen).map(([k, v]) => [k, [+v[0].toFixed(1), v[1]]])), namen: Object.fromEntries(Object.entries(namen).sort((a, b) => b[1][0] - a[1][0]).slice(0, 30).map(([k, v]) => [k, [+v[0].toFixed(1), v[1]]])), gc, jeLage, gross, langeBilder, logs };
writeFileSync(aus, JSON.stringify(o, null, 1));
console.log(JSON.stringify({ lauf: lage, summen: o.summen, gc, lange: langeBilder.length, logs }));
await cdp('Browser.close').catch(() => {}); clearTimeout(kill); setTimeout(() => process.exit(0), 300);
