#!/usr/bin/env node
/* Bewegung der Menschen messen und in Zeitlupe ansehen („Das Haus“). Ein Chrome ohne Fenster, 1440 × 900, Gerätepixel 1,5, Zwischenspeicher aus.
   Vorher: GRENZE egal · node werkzeug/csp-server.mjs 3447     Aufruf: node werkzeug/haus-bewegung.mjs <zielordner> <profilordner> <name> <fall>
   Fälle (szene = e1 … e4, dach; raum = studios | revenue | innovation | pr; n = der wievielte Mensch der Leistung, ab 0):
     geht:<szene>:<raum>:<leistung>:<n>      die Leistung geht und kommt zurück: Zahlen (Standfuß, Ruck, Drehen, Übergänge, Skriptzeit) und vier Streifen (Aufstehen, Gehen, Ankommen, Hinsetzen)
     steht:<szene>:<raum>:<leistung>:<n>[:sek] der Mensch bleibt am Platz (12 s): Zahlen (Zittern, Anteil ohne Bewegung) und zwei Streifen (jedes 6. Bild über die ganze Zeit · 3 s am Stück ab der ersten Bewegung)
     seite:<abfrage>:<x>,<y>,<b>,<h>:<bilder>:<jedes>   ein fester Ausschnitt der Seite (CSS-Pixel) als Streifen aus echten Bildschirmfotos, z. B. Passanten auf der Straße
   Die Streifen sind Ausschnitte der Zeichenfläche in ihrer echten Auflösung (Gerätepixel 1,5), 15 Bilder je Zeile, ein Bild je Takt des Browsers.
   Die Zahlen liest das Skript aus __haus.spur (je gezeichnetem Bild: was von dem Menschen wirklich im Bild liegt) und __haus.zaehlen (Zeichenbefehle und Skriptzeit je Bild). */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASIS = process.env.BASIS || 'http://localhost:3447/';
const [out, profile, name, fall] = process.argv.slice(2);
if (!fall) { console.error('Aufruf: node werkzeug/haus-bewegung.mjs <zielordner> <profilordner> <name> <fall>'); process.exit(1); }
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(out, { recursive: true }); mkdirSync(profile, { recursive: true });
const chrome = spawn('nice', ['-n', '10', CHROME, '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', '--disk-cache-size=1',
  `--user-data-dir=${resolve(profile)}`, '--remote-debugging-pipe', '--window-size=1440,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const kill = setTimeout(() => { console.error('Zeitgrenze erreicht, Chrome wird beendet.'); chrome.kill('SIGKILL'); process.exit(2); }, +(process.env.GRENZE || 150000));
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
const ev = async (expression) => { const r = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
for (const d of ['Page', 'Runtime', 'Log', 'Network']) await S(d + '.enable');
await S('Network.setCacheDisabled', { cacheDisabled: true });
await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false });
const oeffnen = async (abfrage) => {
  await S('Page.navigate', { url: BASIS + '?' + abfrage });
  for (let i = 0; i < 80; i++) { await sleep(150); if (await ev("document.documentElement.dataset.bereit === '1'").catch(() => 0)) break; }
  await ev("try{localStorage.removeItem('make-auswahl')}catch(e){};1"); await S('Page.reload', { ignoreCache: true });
  for (let i = 0; i < 80; i++) { await sleep(150); if (await ev("document.documentElement.dataset.bereit === '1' && !!window.__haus").catch(() => 0)) break; }
  await sleep(2600);
};
const bild = async (datei, daten) => { writeFileSync(join(out, datei), Buffer.from(daten.replace(/^data:image\/png;base64,/, ''), 'base64')); console.log('   Streifen', join(out, datei)); };
const film = async (datei, n, b, h, fest = false) => { await ev(`__haus.film(${n}, ${b}, ${h}, ${fest})`); for (let i = 0; i < 400; i++) { await sleep(50); if ((await ev('__haus.filmStand()')) >= n) break; } await bild(datei, await ev('__haus.film(0)')); };
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; }, r2 = (v) => +v.toFixed(2), max = (a) => (a.length ? Math.max(...a) : 0), mittel = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const wkl = (d) => { d %= 2 * Math.PI; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };

/* Zahlen aus der Spur eines Gangs */
function gangZahlen(d) {
  const Z = {}, geh = d.filter((x) => x.a === 'geh'), arten = [...new Set(d.map((x) => x.a))];
  Z.bilder = d.length; Z.arten = arten.join(' → ');
  { // Standfuß: solange der Knöchel flach steht (unter 9,5 cm), wie weit er über den Boden wandert
    const rut = [];
    for (const fuss of ['wr', 'wl']) { let a0 = null, m = 0; for (const x of d) { const w = x[fuss], steht = x.a === 'geh' && w[2] < 0.095; if (steht) { if (!a0) { a0 = w; m = 0; } m = Math.max(m, Math.hypot(w[0] - a0[0], w[1] - a0[1])); } else { if (a0 && m > 0) rut.push(m * 100); a0 = null; } } }
    Z['Standfuß wandert je Standphase cm (Mitte / höchstens)'] = `${r2(med(rut))} / ${r2(max(rut))}`; Z.standphasen = rut.length;
  }
  { // Ruck: Änderung der Geschwindigkeit des Beckens im Bild von Bild zu Bild (Pixel je Bild), getrennt nach Losgehen (erste 0,9 s des Gehens samt Bild davor), unterwegs, Anhalten (letzte 0,9 s)
    const v = []; for (let i = 1; i < d.length; i++) { const dt = Math.max(4, d[i].t - d[i - 1].t) / 16.67; v.push({ t: d[i].t, a: d[i].a, vx: (d[i].hip[0] - d[i - 1].hip[0]) / dt, vy: (d[i].hip[1] - d[i - 1].hip[1]) / dt }); }
    const ru = []; for (let i = 1; i < v.length; i++) ru.push({ t: v[i].t, a: v[i].a, r: Math.hypot(v[i].vx - v[i - 1].vx, v[i].vy - v[i - 1].vy) });
    const t0 = geh.length ? geh[0].t : 0, t1 = geh.length ? geh[geh.length - 1].t : 0, teil = (f) => ru.filter(f).map((x) => x.r);
    const los = teil((x) => x.t >= t0 - 60 && x.t < t0 + 900), mit = teil((x) => x.t >= t0 + 900 && x.t <= t1 - 900), halt = teil((x) => x.t > t1 - 900 && x.t <= t1 + 60), sonst = teil((x) => x.t < t0 - 60 || x.t > t1 + 60);
    Z['Ruck Becken px/Bild² (Mitte / höchstens): Losgehen'] = `${r2(med(los))} / ${r2(max(los))}`; Z['… unterwegs'] = `${r2(med(mit))} / ${r2(max(mit))}`; Z['… letzte 0,9 s des Gehens'] = `${r2(med(halt))} / ${r2(max(halt))}`; Z['… Aufstehen bzw. Hinsetzen und Drehen'] = `${r2(med(sonst))} / ${r2(max(sonst))}`;
    Z['Tempo Becken unterwegs px/Bild (Mitte)'] = r2(med(v.filter((x) => x.a === 'geh').map((x) => Math.hypot(x.vx, x.vy))));
  }
  { const sp = []; for (let i = 1; i < d.length; i++) if (d[i].a !== 'ruhe' && d[i - 1].a !== 'ruhe') sp.push(Math.abs(wkl(d[i].dreh - d[i - 1].dreh)) * 57.3); Z['Drehen: größter Sprung der gezeichneten Richtung (Grad)'] = r2(max(sp)); Z['… Sprünge über 10 Grad'] = sp.filter((x) => x > 10).length; }
  { const ue = []; for (let i = 1; i < d.length; i++) if (d[i].a !== d[i - 1].a) ue.push(`${d[i - 1].a}→${d[i].a}: Becken ${r2(Math.hypot(d[i].hip[0] - d[i - 1].hip[0], d[i].hip[1] - d[i - 1].hip[1]))} px, Kopf ${r2(Math.hypot(d[i].kopf[0] - d[i - 1].kopf[0], d[i].kopf[1] - d[i - 1].kopf[1]))} px, Hand r ${r2(Math.hypot(d[i].hr[0] - d[i - 1].hr[0], d[i].hr[1] - d[i - 1].hr[1]))} px, Schärfe ${d[i - 1].kq}→${d[i].kq} von ${d[i].k} px/m`); Z['Übergänge (Sprung von einem Bild zum nächsten)'] = ue; }
  { const ph = []; for (let i = 1; i < geh.length; i++) if (geh[i].t - geh[i - 1].t < 40) ph.push(Math.hypot(geh[i].fr[0] - geh[i].hip[0] - geh[i - 1].fr[0] + geh[i - 1].hip[0], geh[i].fr[1] - geh[i].hip[1] - geh[i - 1].fr[1] + geh[i - 1].hip[1]) > 0.05 ? 1 : 0); Z['Gehen: Anteil der Bilder mit neuer Haltung'] = r2(mittel(ph)); }
  return Z;
}
/* Zahlen aus der Spur eines Menschen in Ruhe */
function ruheZahlen(d, sek) {
  const Z = { bilder: d.length }, pk = ['kopf', 'hip', 'hr', 'hl', 'fr', 'fl'];
  const ab = (a, b, k) => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1]);
  let still = 0, n = 0; const bew = []; // bew: Abschnitte mit Bewegung [von, bis, größter Weg]
  for (let i = 1; i < d.length; i++) { const m = Math.max(...pk.map((k) => ab(d[i], d[i - 1], k))); n++; if (m < 0.02) still++; else { const l = bew[bew.length - 1]; if (l && d[i].t - l[1] < 250) { l[1] = d[i].t; l[2]++; } else bew.push([d[i - 1].t, d[i].t, 1]); } }
  Z['Anteil der Bilder ohne jede Bewegung (Kopf, Becken, Hände, Füße)'] = r2(still / Math.max(1, n));
  Z['Bewegungen (zusammenhängend)'] = bew.length; Z['… Dauer ms (Mitte / längste)'] = `${Math.round(med(bew.map((b) => b[1] - b[0])))} / ${Math.round(max(bew.map((b) => b[1] - b[0])))}`; Z['… Bilder je Bewegung (Mitte)'] = med(bew.map((b) => b[2]));
  Z['… Bilder je Sekunde während einer Bewegung (Mitte)'] = r2(med(bew.filter((b) => b[1] - b[0] > 100).map((b) => (b[2] * 1000) / (b[1] - b[0]))));
  for (const [k, nm] of [['kopf', 'Kopf'], ['hr', 'rechte Hand']]) for (const ax of [0, 1]) { let w = 0, vor = 0; for (let i = 1; i < d.length; i++) { const dd = d[i][k][ax] - d[i - 1][k][ax]; if (Math.abs(dd) < 0.05) continue; const s = Math.sign(dd); if (vor && s !== vor) w++; vor = s; } Z[`Richtungswechsel ${nm} ${ax ? 'y' : 'x'} je 10 s`] = r2((w * 10) / sek); }
  Z['Füße wandern im Bild höchstens px'] = r2(Math.max(...d.map((x) => Math.max(ab(x, d[0], 'fr'), ab(x, d[0], 'fl')))));
  Z['Kopf wandert im Bild höchstens px'] = r2(Math.max(...d.map((x) => ab(x, d[0], 'kopf')))); Z['Auflösung des Bilds / Größe im Bild (px/m)'] = `${d[0].kq} / ${d[0].k}`;
  return Z;
}
function leistung(b, nurBew) {
  const g = b.filter((f) => f.pfad !== 'leer' && f.pfad !== 'warm' && f.pfad !== 'bau' && f.ms !== undefined && (nurBew === undefined || !!f.bew === nurBew)), sp = (k) => `${med(g.map((f) => f[k]))} / ${max(g.map((f) => f[k]))}`;
  return { bilder: g.length, 'Skript ms (Mittel / höchstens)': `${r2(mittel(g.map((f) => f.ms)))} / ${r2(max(g.map((f) => f.ms)))}`, 'über 8 ms': g.filter((f) => f.ms > 8).length, 'Pfade gefüllt (Mitte / höchstens)': sp('fill'), 'gezogen': sp('stroke'), 'Bilder eingesetzt': sp('bild'), 'Ausschnitte': sp('clip'), 'nebenher auf kleine Flächen': sp('neben') };
}

const E = { fall, name };
try {
  const T = fall.split(':');
  if (T[0] === 'geht') {
    const [, szene, raum, lst, n] = T; await oeffnen(`fahrt=1&szene=${szene}`);
    E.mensch = await ev(`__haus.spur('${raum}', '${lst}', ${+n || 0})`); await sleep(1500);
    await ev('__haus.zaehlen(true)'); await sleep(300); await ev('__haus.spurHolen()'); await ev('__haus.zaehlen()');
    const B = +process.env.B || 260, H = +process.env.H || 400;
    const dauer = await ev(`__haus.geh('${raum}', '${lst}', false)`); E.dauerMs = Math.round(dauer);
    await film(`${name}-1-aufstehen.png`, 150, B, H); await film(`${name}-2-gehen.png`, 60, B, H);
    await sleep(Math.max(300, dauer - 3600)); await sleep(800);
    const hin = await ev('__haus.spurHolen()'), zHin = await ev('__haus.zaehlen()'); E.flaechenNachGehen = await ev('__haus.bilder().flaechen');
    await ev(`__haus.geh('${raum}', '${lst}', true)`);
    await sleep(Math.max(200, dauer - 3600)); await film(`${name}-3-ankommen.png`, 105, B, H); await film(`${name}-4-hinsetzen.png`, 120, B, H); await sleep(1200);
    const her = await ev('__haus.spurHolen()'), zHer = await ev('__haus.zaehlen()');
    E.geht = gangZahlen(hin); E.kommt = gangZahlen(her);
    E['Leistung, während jemand geht'] = leistung([...zHin, ...zHer], true); E['Leistung in Ruhe (derselbe Lauf)'] = leistung([...zHin, ...zHer], false);
    if (process.env.ROH) writeFileSync(join(out, `${name}-spur.json`), JSON.stringify({ hin, her }));
  } else if (T[0] === 'steht') {
    const [, szene, raum, lst, n, sek0] = T, sek = +sek0 || 12; await oeffnen(`fahrt=1&szene=${szene}`);
    E.mensch = await ev(`__haus.spur('${raum}', '${lst}', ${+n || 0})`); await sleep(2500);
    await ev('__haus.zaehlen(true)'); await sleep(300); await ev('__haus.spurHolen()'); await ev('__haus.zaehlen()');
    const B = +process.env.B || 260, H = +process.env.H || 400, t0 = Date.now();
    // der Überblick: jedes 6. Bild über die ganze Zeit (die Fläche nimmt jedes Bild; hier wird nur jedes sechste behalten: also sechs Filme hintereinander zu je einem Bild wären zu teuer, darum ein eigener Zähler in der Seite)
    await ev(`(() => { const n = ${Math.floor((sek * 60) / 6)}, c = document.createElement('canvas'); c.width = 15 * ${B}; c.height = Math.ceil(n / 15) * ${H}; const g = c.getContext('2d'); let i = 0, k = 0; window.__ueb = c; (function f() { if (i >= n) return; if (k++ % 6 === 0) { const q = __haus.mess.spur && __haus.mess.spur.q; if (q) { g.drawImage(document.getElementById('seq'), Math.round(q[0] - ${B / 2}), Math.round(q[1] - ${H} * 0.9), ${B}, ${H}, (i % 15) * ${B}, Math.floor(i / 15) * ${H}, ${B}, ${H}); i++; } } requestAnimationFrame(f); })(); })()`);
    // 3 s am Stück ab der ersten Bewegung
    let los = false; for (let i = 0; i < (sek * 1000) / 40 && !los; i++) { await sleep(40); los = await ev("(() => { const d = __haus.mess.spur.d, n = d.length; if (n < 3) return false; const a = d[n - 1], b = d[n - 2]; return Math.hypot(a.hr[0] - b.hr[0], a.hr[1] - b.hr[1]) + Math.hypot(a.kopf[0] - b.kopf[0], a.kopf[1] - b.kopf[1]) + Math.hypot(a.hl[0] - b.hl[0], a.hl[1] - b.hl[1]) + Math.hypot(a.hip[0] - b.hip[0], a.hip[1] - b.hip[1]) > 0.3; })()"); }
    E.ersteBewegungNachMs = los ? Date.now() - t0 : null;
    await film(`${name}-geste.png`, 180, B, H);
    await sleep(Math.max(0, sek * 1000 - (Date.now() - t0)) + 300);
    const d = await ev('__haus.spurHolen()'), z = await ev('__haus.zaehlen()');
    await bild(`${name}-ueberblick.png`, await ev("window.__ueb.toDataURL('image/png')"));
    E.ruhe = ruheZahlen(d, (d[d.length - 1].t - d[0].t) / 1000); E['Leistung in Ruhe'] = leistung(z); E.flaechen = await ev('__haus.bilder().flaechen');
    E['gezeichnete Bilder je Sekunde'] = r2((z.filter((f) => f.pfad !== 'leer' && f.pfad !== 'warm' && f.pfad !== 'bau').length * 1000) / (d[d.length - 1].t - d[0].t)); E['neu gezeichnete Menschen je Sekunde (alle im Raum, Befehle nebenher / 100)'] = r2((z.reduce((a, f) => a + f.neben, 0) / 100 / (d[d.length - 1].t - d[0].t)) * 1000);
    if (process.env.ROH) writeFileSync(join(out, `${name}-spur.json`), JSON.stringify(d));
  } else if (T[0] === 'seite') {
    const [, abfrage, aus, n0, je0] = T, [x, y, b, h] = aus.split(',').map(Number), n = +n0 || 30, je = +je0 || 1; await oeffnen(abfrage.replace(/;/g, '&'));
    await ev(`(() => { const c = document.createElement('canvas'), D = 1.5; c.width = Math.min(15, ${n}) * ${b} * D; c.height = Math.ceil(${n} / 15) * ${h} * D; const g = c.getContext('2d'); let i = 0, k = 0; window.__ueb = c; window.__uebN = () => i; (function f() { if (i >= ${n}) return; if (k++ % ${je} === 0) { g.drawImage(document.getElementById('seq'), ${x} * D, ${y} * D, ${b} * D, ${h} * D, (i % 15) * ${b} * D, Math.floor(i / 15) * ${h} * D, ${b} * D, ${h} * D); i++; } requestAnimationFrame(f); })(); })()`);
    for (let i = 0; i < 400; i++) { await sleep(60); if ((await ev('window.__uebN()')) >= n) break; }
    await bild(`${name}.png`, await ev("window.__ueb.toDataURL('image/png')")); E.flaechen = await ev('__haus.bilder().flaechen');
  } else if (T[0] === 'neben') { // neben:<szene>:<raum>:<leistung>:<n>:<leistung, die geht>   ein Mensch am Platz, während eine andere Leistung den Raum verlässt: Der Lauf wartet, bis er mitten in einer Geste ist (Rede, Gewohnheit), und nimmt dann die andere Leistung heraus
    const [, szene, raum, lst, n, weg] = T; await oeffnen(`fahrt=1&szene=${szene}`);
    E.mensch = await ev(`__haus.spur('${raum}', '${lst}', ${+n || 0})`); await sleep(1500); await ev('__haus.zaehlen(true)');
    let an = false; for (let i = 0; i < 900 && !an; i++) { await sleep(30); an = await ev("(() => { const d = __haus.mess.spur.d; return d.length > 4 && d[d.length - 1].m === 1 && d[d.length - 3].m === 1; })()"); }
    E.inGeste = an; await ev('__haus.spurHolen()'); await ev('__haus.zaehlen()');
    const B = +process.env.B || 260, H = +process.env.H || 400, dauer = await ev(`__haus.geh('${raum}', '${weg}', false)`); E.dauerMs = Math.round(dauer);
    await film(`${name}.png`, 240, B, H); await sleep(Math.max(0, dauer - 4200) + 500);
    const d = await ev('__haus.spurHolen()'), z = await ev('__haus.zaehlen()');
    let lang = 0, a0 = null, offenMs = 0; for (let i = 1; i < d.length; i++) { if (d[i].m === 1) offenMs += d[i].t - d[i - 1].t; if (d[i].m === 1 && d[i].sg === d[i - 1].sg) { if (a0 == null) a0 = d[i - 1].t; lang = Math.max(lang, d[i].t - a0); } else a0 = null; }
    E['offene Geste steht unverändert, längste Zeit ms'] = Math.round(lang); E['Geste offen insgesamt ms'] = Math.round(offenMs); E['Geste offen im letzten Bild'] = d.length ? d[d.length - 1].m : null; E['Bilder der Spur'] = d.length;
    E['Leistung, während jemand geht'] = leistung(z, true); E.flaechen = await ev('__haus.bilder().flaechen');
  } else if (T[0] === 'js') { // js:<szene>:<wartezeit ms>   der Ausdruck steht in der Umgebung AUSDRUCK und wird dreimal im Abstand der Wartezeit ausgewertet (nur zum Nachsehen)
    await oeffnen(`fahrt=1&szene=${T[1]}`); E.werte = []; for (let i = 0; i < 3; i++) { E.werte.push(await ev(process.env.AUSDRUCK)); await sleep(+T[2] || 1000); }
  } else throw new Error('Fall unbekannt: ' + fall);
  E.takt = await ev('__haus.takt()'); E.stufe = await ev('__haus.stufe()');
} catch (e) { E.fehler = e.message; }
E.meldungen = logs;
writeFileSync(join(out, `${name}.json`), JSON.stringify(E, null, 1));
console.log(JSON.stringify(E, null, 1));
clearTimeout(kill); chrome.kill('SIGKILL'); process.exit(E.fehler ? 1 : 0);
