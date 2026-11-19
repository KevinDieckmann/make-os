#!/usr/bin/env node
/* Aufnahme und Echtlauf über eine CDP-Leitung (Mausrad, Klicks, Tasten, eigene Skripte). Aufruf: node haus-echtlauf.mjs <auftraege.json> <ausgabeordner> <profil>
   Vorher: node werkzeug/csp-server.mjs <port> (die Adressen in haus-echtlauf.json zeigen auf 3391; anderer Port: Datei mit sed kopieren).
   Skript-Schritte: Zahl = warten (ms) · taste:<Taste> · rad:x,y,dy (Mausrad) · wisch:x,y,strecke (Wischen mit dem Finger, nach oben, ohne Schwung) · finger:x,y,strecke,dauer
   (echte Berührungs-Ereignisse: der Browser macht daraus selbst den Schwung; strecke > 0 = Finger nach oben, Seite nach unten) · fingerhalt:x,y,strecke,dauer (Finger bleibt liegen) · fingerlos · klicksel:<Selektor> · klick:x,y · sonst ein Ausdruck.
   Trackpad-Probe: probe:<art>[,<startszene>] mit art = nachlauf | doppel | langsam | rad-einzeln | rad-schnell | gegen | mittel | stark. Sie schickt eine Folge von Rad-Ereignissen im
   Takt eines Trackpads bzw. Mausrads und misst: Verzögerung bis zur ersten Bewegung, tote Ereignisse (Ereignis ohne Bewegung in den nächsten 50 ms), längstes totes Fenster,
   Lage 700 ms nach dem letzten Ereignis (Abstand zur nächsten Szene in px), Zeit bis zum Stillstand, Weg je Abschnitt und Bildzeiten. Ergebnis: Zeile im Protokoll und <ausgabe>/probe.json.
   Auftrag: { name (mit Name: Bild <name>.png), titel (nur fürs Protokoll), touch (Berührung auch am Rechner-Format), url, w, h, voll?, y?, ms?, js?[], wurzel? (Ordner, der unter http://vorbild.test/ ausgeliefert wird), dsf?, clip? } */
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

/* ── Trackpad-Probe ── */
const PROBEN = {
  // je Eintrag: [Zeit in ms ab Start, deltaY]
  nachlauf: () => schwung(0, 40, 0.93, 60, 20),                                              // ein Schwung mit Nachlauf: 60 Ereignisse über 1,2 s, abklingend
  doppel: () => [...schwung(0, 40, 0.93, 60, 20).filter(([t]) => t < 300), ...schwung(300, 40, 0.93, 60, 20)], // zweiter Schwung 300 ms nach dem Start des ersten, mitten im Nachlauf
  langsam: () => Array.from({ length: 30 }, (_, i) => [i * 40, 6]),                            // langsames Rollen
  'rad-einzeln': () => Array.from({ length: 4 }, (_, i) => [i * 400, 100]),                    // klassisches Mausrad: eine Raste je 400 ms
  'rad-schnell': () => Array.from({ length: 5 }, (_, i) => [i * 75, 100]),                     // fünf Rasten in 300 ms
  gegen: () => [...schwung(0, 40, 0.93, 60, 20).filter(([t]) => t < 360), ...schwung(360, -40, 0.93, 60, 20)], // Gegenrichtung mitten in der Bewegung
  mittel: () => schwung(0, 70, 0.94, 70, 16),                                                 // normaler Schwung (rund 1150 px)
  stark: () => schwung(0, 120, 0.95, 80, 16),                                                 // kräftiger Schwung (rund 2400 px)
};
function schwung(t0, start, faktor, n, takt) { const r = []; let d = start; for (let i = 0; i < n; i++) { r.push([t0 + i * takt, Math.sign(d) * Math.max(1, Math.round(Math.abs(d)))]); d *= faktor; } return r; }
const probenErgebnis = [];
async function probe(art, start, j) {
  const folge = PROBEN[art](); if (!folge) throw new Error('Probe unbekannt: ' + art);
  // Ausgangslage: genau auf einer Szene, in Ruhe
  await ev(`(()=>{const s=[...document.querySelectorAll('.snap')].map(e=>Math.round(e.getBoundingClientRect().top+scrollY));window.__sz=s;const k=document.getElementById('kurz');window.__kurz=k?Math.round(k.getBoundingClientRect().top+scrollY):null;scrollTo(0,s[${start}]);})()`);
  await sleep(1300);
  await ev(`(()=>{const m=window.__m={rad:[],bild:[],an:true};if(!window.__mh){window.__mh=1;addEventListener('wheel',e=>{if(window.__m.an)window.__m.rad.push([performance.now(),e.deltaY,scrollY])},{capture:true,passive:true});}
    (function f(){if(!m.an)return;m.bild.push([performance.now(),scrollY]);requestAnimationFrame(f)})();})()`);
  await sleep(150);
  const t0 = Date.now() + 30, offen = [];
  for (const [t, dy] of folge) { const w = t0 + t - Date.now(); if (w > 0) await sleep(w); offen.push(S('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(j.w / 2), y: Math.round(j.h / 2), deltaX: 0, deltaY: dy }).catch(() => {})); }
  await sleep(700);
  const nach700 = await ev('scrollY');
  await sleep(1500);
  await Promise.race([Promise.all(offen), sleep(500)]);
  const m = JSON.parse(await ev('(()=>{window.__m.an=false;return JSON.stringify({rad:window.__m.rad,bild:window.__m.bild,sz:window.__sz,kurz:window.__kurz,ende:scrollY})})()'));
  const rad = m.rad, bild = m.bild, ziele = [...m.sz, ...(m.kurz != null ? [m.kurz] : [])];
  const yBei = (t) => { let y = bild[0][1]; for (const [tb, yb] of bild) { if (tb <= t) y = yb; else break; } return y; };
  const erstes = rad[0]?.[0] ?? null, letztes = rad[rad.length - 1]?.[0] ?? null, y0 = bild[0][1];
  const ersteBew = bild.find(([t, y]) => erstes != null && t >= erstes && Math.abs(y - y0) > 0.5);
  // tote Ereignisse: Ereignis, nach dem sich die Lage in den nächsten 50 ms nicht bewegt
  let tot = 0, totFenster = 0, totSeit = null;
  for (const [t] of rad) { const bewegt = bild.some(([tb, yb]) => tb > t && tb <= t + 50 && Math.abs(yb - yBei(t)) > 0.5); if (!bewegt) { tot++; if (totSeit == null) totSeit = t; totFenster = Math.max(totFenster, t - totSeit); } else totSeit = null; }
  // Folgt die Lage der Hand? Anteil der Ereignisse, nach denen sich die Lage in Richtung des Ereignisses bewegt hat (bis zum nächsten Ereignis bzw. 50 ms)
  let folgt = 0; rad.forEach(([t, dy], i) => { const bis = Math.min(t + 50, rad[i + 1]?.[0] ?? t + 50) + 17; const d = yBei(bis) - yBei(t); if (Math.sign(d) === Math.sign(dy) && Math.abs(d) > 0.5) folgt++; });
  let stillAb = bild[0][0]; for (let i = 1; i < bild.length; i++) if (Math.abs(bild[i][1] - bild[i - 1][1]) > 0.5) stillAb = bild[i][0];
  const zeiten = []; const tA = erstes ?? bild[0][0], tE = stillAb + 100; for (let i = 1; i < bild.length; i++) if (bild[i][0] >= tA && bild[i][0] <= tE) zeiten.push(bild[i][0] - bild[i - 1][0]);
  zeiten.sort((a, b) => a - b); const rund = (x) => (x == null ? null : Math.round(x * 10) / 10);
  const naechste = (y) => ziele.reduce((b, z) => (Math.abs(z - y) < Math.abs(b - y) ? z : b), ziele[0]);
  const L = m.sz[1] - m.sz[0], szene = (y) => rund((y - m.sz[0]) / L);
  // zweiter Abschnitt (Probe „doppel“ und „gegen“): Weg, den die Lage ab dem Beginn des zweiten Schwungs noch zurücklegt, solange Ereignisse kommen
  let zweiter = null; if (art === 'doppel' || art === 'gegen') { const ab = erstes + (art === 'doppel' ? 300 : 360); zweiter = { wegWaehrend: rund(yBei(letztes) - yBei(ab)), wegBis300ms: rund(yBei(ab + 300) - yBei(ab)) }; }
  const e = { probe: art, format: `${j.w}×${j.h}`, szenenlaenge: L, start, gesendet: folge.length, summeDelta: folge.reduce((a, [, d]) => a + d, 0), angekommen: rad.length,
    a_verzoegerungMs: ersteBew ? rund(ersteBew[0] - erstes) : null, b_toteEreignisse: tot, b_laengstesTotesFensterMs: rund(totFenster), b_folgtDerHand: `${folgt}/${rad.length}`,
    c_lageNach700ms: nach700, c_szene: szene(nach700), c_abstandPx: rund(Math.abs(nach700 - naechste(nach700))), d_stillstandNachLetztemMs: rund(stillAb - letztes), e_zweiterSchwung: zweiter,
    endlage: m.ende, endszene: szene(m.ende), endAbstandPx: rund(Math.abs(m.ende - naechste(m.ende))), wegGesamt: rund(m.ende - y0), groessteLage: szene(Math.max(...bild.map((b) => b[1]))),
    f_bildMittelMs: rund(zeiten.reduce((a, b) => a + b, 0) / (zeiten.length || 1)), f_bildP95Ms: rund(zeiten[Math.floor(zeiten.length * 0.95)] ?? null), f_bildMaxMs: rund(zeiten[zeiten.length - 1] ?? null), bilder: zeiten.length };
  probenErgebnis.push(e); console.log('   → probe ' + JSON.stringify(e));
  if (process.env.PROBE_ROH) writeFileSync(join(out, `probe-${art}-roh.json`), JSON.stringify({ rad, bild }));
}
/* Echte Berührung: touchStart, Bewegung in Schritten, touchEnd. Der Browser erkennt daraus selbst Ziehen und Schwung. */
async function finger(x, y, strecke, dauer, halten) {
  const n = Math.max(4, Math.round(dauer / 16)), t0 = Date.now();
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= n; i++) { const w = t0 + (i * dauer) / n - Date.now(); if (w > 0) await sleep(w); await S('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y - (strecke * i) / n), id: 1 }] }); }
  if (!halten) await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
let fehler = 0, erwartet404 = 0;
for (const j of jobs) {
  const before = logs.length; wurzel = j.wurzel || null;
  await S('Emulation.setDeviceMetricsOverride', { width: j.w, height: j.h, deviceScaleFactor: j.dsf || 1, mobile: j.w < 600 });
  await S('Emulation.setTouchEmulationEnabled', { enabled: !!(j.touch ?? j.w < 600), maxTouchPoints: 5 }).catch(() => {});
  if (j.reduziert) await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); else await S('Emulation.setEmulatedMedia', { features: [] });
  if (j.url) { await S('Page.navigate', { url: j.url }); await sleep(j.lade || 1500);
    if (j.bereit) { let ok = false; for (let i = 0; i < 80 && !ok; i++) { await sleep(150); ok = !!(await ev("document.documentElement.dataset.bereit === '1'").catch(() => 0)); } } }
  if (j.y !== undefined) { await ev(`window.lenis ? window.lenis.scrollTo(${j.y}, { immediate: true, force: true }) : window.scrollTo(0, ${j.y})`); await sleep(900); }
  for (const s of j.js || []) { if (typeof s === 'number') await sleep(s); else if (s.startsWith('taste:')) { const key = s.slice(6); const map = { Tab: 9, Escape: 27, Enter: 13 }; for (const type of ['keyDown', 'keyUp']) await S('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: map[key] || 0 }); await sleep(200); } else if (s.startsWith('rad:')) { const [x, y, dy] = s.slice(4).split(',').map(Number); await S('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); await sleep(120); } else if (s.startsWith('wisch:')) { const [x, y, d] = s.slice(6).split(',').map(Number); await S('Input.synthesizeScrollGesture', { x, y, yDistance: -d, speed: +(process.env.WISCHTEMPO || 1800), gestureSourceType: 'touch' }); await sleep(300); } else if (s.startsWith('probe:')) { const [art, st] = s.slice(6).split(','); await probe(art, +(st || 3), j); } else if (s.startsWith('fingerhalt:')) { const [x, y, d, ms] = s.slice(11).split(',').map(Number); await finger(x, y, d, ms || 400, true); await sleep(300); } else if (s === 'fingerlos') { await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300); } else if (s.startsWith('finger:')) { const [x, y, d, ms] = s.slice(7).split(',').map(Number); await finger(x, y, d, ms || 180); await sleep(300); } else if (s.startsWith('klicksel:')) { // echter Mausklick auf ein Element: erst hinfahren (löst das Überfahren aus), dann drücken und loslassen
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
  const neu = logs.slice(before); const erwartet = neu.filter((l) => /status of 404/.test(l) && /\/api\//.test(l)).length; fehler += neu.length - erwartet; erwartet404 += erwartet; // die Anwendung (/api/…) gibt es lokal nicht
  console.log(`${j.name || j.titel || '(ohne Bild)'}  ${j.w}×${j.h}  ${info}${neu.length ? '\n   ' + neu.join('\n   ') : ''}`);
}
if (probenErgebnis.length) writeFileSync(join(out, 'probe.json'), JSON.stringify(probenErgebnis, null, 1));
console.log(`Fertig. Meldungen (Skriptfehler, Konsole, Sicherheitsregeln): ${fehler} · erwartete 404 der Anwendung (/api/…): ${erwartet404}`);
clearTimeout(kill); await cdp('Browser.close').catch(() => {}); setTimeout(() => process.exit(0), 300);
