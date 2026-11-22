#!/usr/bin/env node
/* Figurenblätter für „Das Haus“: alle Menschen aus haus/figuren.json, gezeichnet vom Figuren-System (haus/figuren.js), ohne Haus und ohne Server.
   Aufruf: node werkzeug/haus-figurenblatt.mjs <zielordner> [profilordner] [nur]
     nur = Namen mit Komma (z. B. tom,lea) oder „gang“, „stufen“, „koepfe“, „haltungen“, „sitzen“, „leben“, „figuren“, „figuren-3“ (nur dieses Blatt); ohne Angabe alles.
   Es entstehen:
     figuren-1.png … figuren-5.png  je fünf Menschen in großer Darstellung: von vorn, im Dreiviertelprofil, von der Seite, sitzend; links im Tageslicht, rechts im Abendlicht
     koepfe-1.png … koepfe-3.png    Kopf und Schultern aller Menschen, groß: von vorn, im Dreiviertelprofil (spricht), im Profil am Tag (Mund in Ruhe), fast im Profil am Abend (konzentriert)
     haltungen-1.png, -2.png        jede stehende Haltung, die im Haus vorkommt, an zwei verschiedenen Menschen, im Tageslicht, groß
     sitzen.png                     Sitzen von vorn, im Dreiviertelprofil, von der Seite, von hinten: am Tisch tippend, zuhörend im Sessel, im Publikum, im Gespräch (Möbel in derselben Sicht)
     leben.png                      Standbilder über die Zeit: ein Gespräch zu zweit (wer spricht, wer nickt), drei Menschen in Ruhe (Gewicht, Blick, die kleine Bewegung aus der Gewohnheit)
     gang.png                       die Geh-Phasen eines Menschen (von der Seite und schräg von vorn), dazu Aufstehen
     stufen.png                     dieselben Menschen in den drei Detailstufen (klein, mittel, groß) in ihrer wirklichen Bildgröße, und von hinten
   Die Blätter sind das Prüfmittel für jede Änderung an figuren.js (siehe haus/STIL.md). Ein Chrome ohne Fenster über eine Leitung, nur eine Instanz zur Zeit. */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), HAUS = join(HERE, '..', 'haus');
const [out = join(HERE, 'figurenblatt'), profile = '/tmp/make-haus-chrome', nur = ''] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const figuren = readFileSync(join(HAUS, 'figuren.js'), 'utf8'), menschen = JSON.parse(readFileSync(join(HAUS, 'figuren.json'), 'utf8')).menschen, haus = readFileSync(join(HAUS, 'haus.js'), 'utf8');
const block = (name) => { const a = haus.indexOf(`const ${name} = {`), b = haus.indexOf('\n};', a); if (a < 0 || b < 0) throw new Error(`${name} fehlt in haus.js`); return haus.slice(a, b + 3); }; // LICHT und HALT gelten wie im Haus
const ids = Object.keys(menschen).filter((id) => /^[a-z]+$/.test(id));

/* Läuft in der Seite: zeichnet ein Blatt und gibt es als PNG zurück */
const SEITE = `
${figuren}
${block('LICHT')}
${block('HALT')}
const MENSCHEN = ${JSON.stringify(menschen)};
const AKZ = ['#FF5A1F', '#7DB7FF', '#A78BFA'];
const TAG = LICHT.studios, ABEND = LICHT.abend, GOLD = LICHT.pr;
function flaeche(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); return [c, g]; }
function grund(g, x, y, w, h, licht) { // heller Raum am Tag, dunkle Terrasse am Abend; eine Bodenlinie
  const tag = licht !== ABEND; g.fillStyle = tag ? (licht === GOLD ? '#d9c4b4' : '#d8d2cd') : '#1d1a2c'; g.fillRect(x, y, w, h);
  g.fillStyle = tag ? (licht === GOLD ? '#c9ad98' : '#c4bcb6') : '#141222'; g.fillRect(x, y + h * 0.86, w, h * 0.14);
}
function figur(g, id, n, p, x, y, k, dreh, licht, extra) {
  const m = FIG.mensch(id, MENSCHEN[id], AKZ[n % 3]);
  FIG.schatten(g, x, y, k * m.gr, 0.44, 0.22, licht === ABEND ? 0.5 : 0.32);
  return FIG.malen(g, m, p, x, y, k, Object.assign({ dreh, auge: 1.5, dz: 5, licht, L: licht.L, saum: { farbe: licht.saum, a: 0.32 } }, extra || {}));
}
function text(g, s, x, y, hell, gr) { g.font = (gr || 15) + 'px system-ui, sans-serif'; g.fillStyle = hell ? 'rgba(255,255,255,.8)' : 'rgba(30,26,40,.75)'; g.fillText(s, x, y); }
function blatt(liste, k) {
  const zw = Math.round(k * 1.12), zh = Math.round(k * 2.16), [c, g] = flaeche(zw * 8, zh * liste.length);
  liste.forEach((id, r) => {
    const n = ${JSON.stringify(ids)}.indexOf(id), m = MENSCHEN[id];
    [TAG, ABEND].forEach((licht, hälfte) => {
      grund(g, hälfte * zw * 4, r * zh, zw * 4, zh, licht);
      const halt = Object.keys(HALT)[n % Object.keys(HALT).length];
      const sicht = [[0, FIG.steh(0.5, 'haengt', 'haengt')], [0.7, FIG.steh(-0.4, 'spricht', 'offen')], [Math.PI / 2, FIG.steh(0.3, 'haelt', 'zeigt')], [0.55, FIG.sitz(0.46, m.gr || 1, 'tippt', 'maus')]];
      sicht.forEach(([dreh, p], s) => {
        const x = hälfte * zw * 4 + s * zw + zw / 2, y = r * zh + zh * 0.93;
        if (s === 3) { g.fillStyle = hälfte ? '#2c2940' : '#8d8791'; g.fillRect(x - k * 0.24, y - k * 0.47, k * 0.44, k * 0.05); g.fillRect(x - k * 0.2, y - k * 0.45, k * 0.03, k * 0.45); g.fillRect(x + k * 0.14, y - k * 0.45, k * 0.03, k * 0.45); }
        figur(g, id, n, p, x, y, k, dreh, licht, s === 2 ? { l: 'tablet' } : null);
      });
      text(g, id + (hälfte ? ' · Abend' : ' · Tag'), hälfte * zw * 4 + 12, r * zh + 24, !!hälfte);
    });
  });
  return c.toDataURL('image/png');
}
function koepfe(liste, k) { // Kopf und Schultern aller Menschen, groß: von vorn (Tag), im Dreiviertelprofil (Tag, spricht), im Profil (Abend)
  const zw = Math.round(k * 0.5), zh = Math.round(k * 0.56), sp = 12, [c, g] = flaeche(zw * sp, zh * Math.ceil(liste.length / 3));
  liste.forEach((id, i) => { const n = ${JSON.stringify(ids)}.indexOf(id), m = MENSCHEN[id], gr = m.gr || 1;
    [[0, TAG, FIG.steh(0.4, 'spricht', 'spricht')], [0.75, TAG, FIG.steh(-0.3, 'spricht', 'offen')], [-1.5, TAG, FIG.steh(0.2, 'spricht', 'haelt')], [1.25, ABEND, FIG.steh(0.2, 'spricht', 'haelt')]].forEach(([dreh, licht, p], s) => {
      const x = ((i % 3) * 4 + s) * zw, y = Math.floor(i / 3) * zh; if (s === 1) p.mund = 0.7; if (s === 3) p.mund = -1;
      g.save(); g.beginPath(); g.rect(x, y, zw, zh); g.clip(); grund(g, x, y, zw, zh * 1.3, licht);
      figur(g, id, n, p, x + zw / 2, y + zh * 0.56 + 1.6 * k * gr, k, dreh, licht); g.restore();
      if (!s) text(g, id, x + 8, y + 20);
    }); });
  return c.toDataURL('image/png');
}
function gang(id, k) {
  const n = 12, zw = Math.round(k * 0.92), zh = Math.round(k * 2.1), [c, g] = flaeche(zw * n, zh * 3), m = MENSCHEN[id];
  grund(g, 0, 0, zw * n, zh, TAG); grund(g, 0, zh, zw * n, zh, TAG); grund(g, 0, 2 * zh, zw * n, zh, GOLD);
  for (let i = 0; i < n; i++) {
    figur(g, id, 1, FIG.geh((i / n) * Math.PI * 2, 'r'), i * zw + zw / 2, zh * 0.93, k, Math.PI / 2, TAG, { r: 'tasche' });
    figur(g, id, 1, FIG.geh((i / n) * Math.PI * 2, ''), i * zw + zw / 2, zh * 1.93, k, 0.6, TAG);
    const e = i / (n - 1), sitz = FIG.sitz(0.46, m.gr || 1, 'tippt', 'maus'), steh = FIG.steh(0, 'haengt', 'haengt'), vor = FIG.sitz(0.46, m.gr || 1, 'schoss', 'schoss'); vor.neig = 0.52;
    const p = e < 0.4 ? FIG.zwischen(sitz, vor, FIG.weich(e / 0.4)) : FIG.zwischen(vor, steh, FIG.weich((e - 0.4) / 0.6));
    figur(g, id, 1, p, i * zw + zw / 2, zh * 2.93, k, 1.0, GOLD);
  }
  text(g, id + ' · Gang von der Seite (12 Phasen, mit Tasche)', 12, 24); text(g, 'Gang schräg von vorn', 12, zh + 24); text(g, 'Aufstehen (goldene Stunde)', 12, 2 * zh + 24);
  return c.toDataURL('image/png');
}
/* Haltungen: jede stehende Haltung, die im Haus vorkommt (HALT in haus.js, Grundstellung, Empfang, Passant), an zwei verschiedenen Menschen, im Tageslicht, groß */
function haltungen(k, teil) {
  const ids = ${JSON.stringify(ids)}, L = [];
  for (const [name, h] of Object.entries(HALT)) if (!h.sitz) L.push([name, () => FIG.steh(h.w || 0, h.l, h.r), { l: h.dl || null, r: h.dr || null }, h.leben]);
  L.push(['steht (Gewicht links)', () => FIG.steh(-0.7, 'haengt', 'haengt'), {}], ['Grundstellung (w = 0)', () => FIG.steh(0, 'haengt', 'haengt'), {}], ['Empfang A', () => FIG.steh(0.4, 'haengt', 'haelt'), {}], ['Empfang B', () => FIG.steh(-0.4, 'spricht', 'haengt'), {}, 'spricht'], ['Passant', () => FIG.steh(0.6, 'haengt', 'huefte'), {}]);
  const von = teil ? Math.ceil(L.length / 2) : 0, bis = teil ? L.length : Math.ceil(L.length / 2), sp = 4, zw = Math.round(k * 1.3), zh = Math.round(k * 2.14), n = bis - von, [c, g] = flaeche(zw * sp * 2, zh * Math.ceil(n / sp));
  for (let i = von; i < bis; i++) { const [name, pose, ex, leb] = L[i], j = i - von;
    [0, 1].forEach((b) => { const id = ids[(i * 2 + b * 13 + 3) % ids.length], x = ((j % sp) * 2 + b) * zw, y = Math.floor(j / sp) * zh, p = pose(); if (leb === 'spricht') p.mund = 0.5; else if (leb) p.mund = -1;
      grund(g, x, y, zw, zh, TAG); figur(g, id, ids.indexOf(id), p, x + zw / 2, y + zh * 0.93, k, b ? -0.85 : 0.3, TAG, ex); text(g, name + ' · ' + id, x + 10, y + 22); });
  }
  return c.toDataURL('image/png');
}
/* Möbel in derselben Sicht wie die Figur (Körpermaße in Metern: x nach rechts, y nach oben, z nach vorn) */
function sicht(x0, y0, k, dreh, auge = 1.5, dz = 5) { const cd = Math.cos(dreh), sd = Math.sin(dreh), kl = (v, a, b) => Math.min(b, Math.max(a, v));
  return (X, Y, Z) => { const vx = -X * cd + Z * sd, vz = X * sd + Z * cd, nah = 1 + kl(vz / dz, -0.25, 0.25); return [x0 + vx * k * nah, y0 - Y * k + vz * k * kl((auge - Y) / dz, -0.14, 0.45), vz]; }; }
function kiste(g, P, dreh, x0, x1, y0, y1, z0, z1, c) { // Quader: die zwei zugewandten Seiten, dann der Deckel
  const cd = Math.cos(dreh), sd = Math.sin(dreh), f = (pts, farbe) => { g.beginPath(); pts.forEach((q, i) => { const b = P(q[0], q[1], q[2]); i ? g.lineTo(b[0], b[1]) : g.moveTo(b[0], b[1]); }); g.closePath(); g.fillStyle = farbe; g.fill(); };
  const xs = sd > 0 ? x1 : x0, zs = cd > 0 ? z1 : z0;
  f([[xs, y0, z0], [xs, y0, z1], [xs, y1, z1], [xs, y1, z0]], c[2]); f([[x0, y0, zs], [x1, y0, zs], [x1, y1, zs], [x0, y1, zs]], c[1]); f([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c[0]);
}
const STUHL = [[-0.19, -0.16, 0, 0.43, 0.18, 0.21], [0.16, 0.19, 0, 0.43, 0.18, 0.21], [-0.19, -0.16, 0, 0.43, -0.2, -0.17], [0.16, 0.19, 0, 0.43, -0.2, -0.17], [-0.22, 0.22, 0.43, 0.47, -0.22, 0.22], [-0.19, -0.16, 0.47, 0.6, -0.23, -0.2], [0.16, 0.19, 0.47, 0.6, -0.23, -0.2], [-0.21, 0.21, 0.58, 0.93, -0.235, -0.195]].map((b) => [...b, ['#77737f', '#4a4753', '#55525f']]); // wie stuhlDinge in haus.js
const SESSEL = [[-0.36, 0.36, 0.42, 1.02, -0.4, -0.24], [-0.36, 0.36, 0.14, 0.44, -0.26, 0.34], [-0.38, -0.26, 0.14, 0.64, -0.3, 0.34], [0.26, 0.38, 0.14, 0.64, -0.3, 0.34]].map((b, i) => [...b, i > 1 ? ['#b9aaf0', '#5a4c96', '#4a3e7c'] : ['#8f7fc8', '#5a4c96', '#4a3e7c']]);
const TISCH = [[-0.62, -0.57, 0, 0.72, 0.9, 0.95], [0.57, 0.62, 0, 0.72, 0.9, 0.95], [-0.7, 0.7, 0.72, 0.75, 0.3, 1.0], [-0.17, 0.17, 0.75, 0.762, 0.38, 0.6]].map((b, i) => [...b, i > 2 ? ['#3a3846', '#22212b', '#2a2933'] : ['#e4dccf', '#b8ac9c', '#c6baa9']]);
function moebel(g, P, dreh, liste, vorn) { const cd = Math.cos(dreh), sd = Math.sin(dreh); liste.map((b) => [b, ((b[0] + b[1]) / 2) * sd + ((b[4] + b[5]) / 2) * cd]).filter(([, vz]) => (vz > (cd < 0 ? 0.1 : 0.3)) === vorn).sort((a, b) => a[1] - b[1]).forEach(([b]) => kiste(g, P, dreh, b[0], b[1], b[2], b[3], b[4], b[5], b[6])); }
/* Sitzen: von vorn, im Dreiviertelprofil, von der Seite, von hinten; am Tisch tippend, zuhörend im Sessel, im Publikum, im Gespräch; je Reihe zwei Menschen */
function sitzen(k) {
  const R = [['tippt (am Tisch)', ['jana', 'jonas'], (m) => FIG.sitz(0.46, m.gr || 1, 'tippt', 'maus'), [...STUHL, ...TISCH], -1], ['sitzt (hört zu, im Sessel)', ['lea', 'karl'], (m) => FIG.sitz(0.46, m.gr || 1, 'schoss', 'schoss'), SESSEL, 0],
    ['Publikum', ['aylin', 'omar'], (m, b) => FIG.sitz(0.46, m.gr || 1, b ? 'haelt' : 'schoss', 'schoss'), STUHL, 0], ['sitzt-spricht (am Tisch)', ['mika', 'rosa'], (m) => FIG.sitz(0.46, m.gr || 1, 'tippt', 'spricht'), [...STUHL, ...TISCH], 0.5],
    ['Sessel, angelehnt (art sessel, Arme auflage)', ['clara', 'paul'], (m) => FIG.sitz(0.46, m.gr || 1, 'auflage', 'auflage', 'sessel'), SESSEL, 0]];
  const W = [0, 0.7, Math.PI / 2, Math.PI - 0.6], zw = Math.round(k * 1.5), zh = Math.round(k * 1.8), [c, g] = flaeche(zw * 8, zh * R.length), ids = ${JSON.stringify(ids)};
  R.forEach(([name, wer, pose, mb, mund], r) => wer.forEach((id, b) => W.forEach((dreh, s) => { const x = (b * 4 + s) * zw, y = r * zh, m = MENSCHEN[id], x0 = x + zw / 2, y0 = y + zh * 0.8, p = pose(m, b); p.mund = mund;
    g.save(); g.beginPath(); g.rect(x, y, zw, zh); g.clip(); grund(g, x, y, zw, zh, TAG); g.fillStyle = '#c4bcb6'; g.fillRect(x, y + zh * 0.62, zw, zh * 0.38);
    const P = sicht(x0, y0, k, dreh); moebel(g, P, dreh, mb, false); figur(g, id, ids.indexOf(id), p, x0, y0, k, dreh, TAG); moebel(g, P, dreh, mb, true); g.restore();
    if (!s) text(g, name + ' · ' + id, x + 10, y + 22); })));
  return c.toDataURL('image/png');
}
/* Leben: Standbilder über die Zeit. Oben ein Gespräch zu zweit (alle 650 ms: Wer spricht, gestikuliert; wer zuhört, nickt), unten drei Menschen in Ruhe (alle 900 ms: Gewicht, Blick, die kleine Bewegung aus der Gewohnheit) */
function lebenBlatt(k) {
  const n = 10, zw = Math.round(k * 2.1), zh = Math.round(k * 2.12), [c, g] = flaeche(zw * n, zh * 2), ids = ${JSON.stringify(ids)};
  for (let i = 0; i < n; i++) { grund(g, i * zw, 0, zw, zh, TAG); grund(g, i * zw, zh, zw, zh, TAG);
    const t = 400 + i * 650; [['paul', 0.9, 0.45, 1.3, 0], ['ida', -0.9, -0.5, 2.6, 1]].forEach(([id, dreh, w, saat, teil], j) => { const p = FIG.steh(w, 'spricht', 'offen'); FIG.leben(p, t, saat); FIG.reden(p, t, saat, 4, teil); figur(g, id, ids.indexOf(id), p, i * zw + zw * (j ? 0.8 : 0.2), zh * 0.93, k, dreh, TAG); });
    const t2 = 300 + i * 900; [['hanna', 0.3, 0.5, 0.0], ['nora', -0.4, -0.5, 0.38], ['yuki', 0.1, 0.6, 1.71]].forEach(([id, dreh, w, saat], j) => { const p = FIG.steh(w, 'haengt', 'haengt'); FIG.leben(p, t2, saat); figur(g, id, ids.indexOf(id), p, i * zw + zw * (0.18 + j * 0.32), zh * 1.93, k, dreh, TAG); });
    text(g, (t / 1000).toFixed(2) + ' s', i * zw + 8, 20); text(g, (t2 / 1000).toFixed(1) + ' s', i * zw + 8, zh + 20); }
  return c.toDataURL('image/png');
}
function stufen(liste) {
  const ks = [40, 90, 150, 260], zh = 600, br = 2560, [c, g] = flaeche(br, zh * 2);
  grund(g, 0, 0, br, zh, TAG); grund(g, 0, zh, br, zh, ABEND);
  [TAG, ABEND].forEach((licht, r) => { let x = 30;
    for (const k of ks) { liste.slice(0, 3).forEach((id, i) => { const w = k * 0.9; figur(g, id, i, i === 1 ? FIG.sitz(0.46, MENSCHEN[id].gr || 1, 'tippt', 'maus') : FIG.steh(0.4, 'haengt', i ? 'zeigt' : 'spricht'), x + w / 2, r * zh + zh * 0.93, k, i === 1 ? 0.6 : i ? 2.6 : 0.3, licht); x += w; }); text(g, k + ' px je Meter', x - k * 2.6, r * zh + 24, !!r); x += 24; }
    liste.slice(3).forEach((id, i) => { figur(g, id, i, FIG.steh(-0.4, 'haengt', 'huefte'), x + 130, r * zh + zh * 0.93, 260, [Math.PI, 2.3, -1.1][i % 3], licht); x += 250; });
  });
  return c.toDataURL('image/png');
}
`;

mkdirSync(out, { recursive: true }); mkdirSync(profile, { recursive: true });
const chrome = spawn('nice', ['-n', '10', CHROME, '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', `--user-data-dir=${resolve(profile)}`, '--remote-debugging-pipe', '--window-size=800,600', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const kill = setTimeout(() => { console.error('Zeitgrenze erreicht, Chrome wird beendet.'); chrome.kill('SIGKILL'); process.exit(2); }, 240000);
const send = chrome.stdio[3], recv = chrome.stdio[4];
let id = 0, buf = Buffer.alloc(0); const wait = new Map();
recv.on('data', (d) => { buf = Buffer.concat([buf, d]); let i; while ((i = buf.indexOf(0)) >= 0) { const m = JSON.parse(buf.subarray(0, i).toString('utf8')); buf = buf.subarray(i + 1); if (m.id && wait.has(m.id)) { const [res, rej] = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } } });
const cdp = (method, params = {}, sessionId) => new Promise((res, rej) => { const n = ++id; wait.set(n, [res, rej]); send.write(JSON.stringify({ id: n, method, params, sessionId }) + '\0'); });
const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
const lauf = async (expression) => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
let fehler = 0;
try {
  await lauf(SEITE + '; 1');
  const schreib = (name, url) => { writeFileSync(join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); console.log(join(out, name + '.png')); };
  const wahl = nur && !['gang', 'stufen', 'koepfe', 'haltungen', 'sitzen', 'figuren', 'leben'].includes(nur) && !/^figuren-\d$/.test(nur) ? nur.split(',').filter((x) => menschen[x]) : null;
  if (wahl) schreib('figuren-wahl', await lauf(`blatt(${JSON.stringify(wahl)}, 300)`));
  else {
    for (let i = 0; i < ids.length; i += 5) if (!nur || nur === 'figuren' || nur === `figuren-${i / 5 + 1}`) schreib(`figuren-${i / 5 + 1}`, await lauf(`blatt(${JSON.stringify(ids.slice(i, i + 5))}, 260)`));
    if (!nur || nur === 'haltungen') { schreib('haltungen-1', await lauf('haltungen(300, 0)')); schreib('haltungen-2', await lauf('haltungen(300, 1)')); }
    if (!nur || nur === 'sitzen') schreib('sitzen', await lauf('sitzen(260)'));
    if (!nur || nur === 'leben') schreib('leben', await lauf('lebenBlatt(170)'));
    if (!nur || nur === 'koepfe') for (let i = 0; i < ids.length; i += 9) schreib(`koepfe-${i / 9 + 1}`, await lauf(`koepfe(${JSON.stringify(ids.slice(i, i + 9))}, 640)`));
    if (!nur || nur === 'gang') schreib('gang', await lauf(`gang('tom', 230)`));
    if (!nur || nur === 'stufen') schreib('stufen', await lauf(`stufen(['lea', 'jana', 'tom', 'mika', 'rosa', 'karl', 'nora'])`));
  }
} catch (e) { console.error(String(e.stack || e)); fehler = 1; }
clearTimeout(kill);
await cdp('Browser.close').catch(() => {});
setTimeout(() => process.exit(fehler), 300);
