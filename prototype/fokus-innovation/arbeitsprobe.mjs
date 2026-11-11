#!/usr/bin/env node
// ─── MAKE Innovation · Arbeitsprobe (11.11.2026) ────────────────────────────────────────────────────────────────────
// Die zwei Bildschirmfotos im Abschnitt „Diese Website ist unsere Arbeitsprobe“ (Sichtbarkeit, Homepage-Pakete):
//   assets/bild/arbeitsprobe/rechner.jpg  1440 × 900   das Endbild des Films der Startseite (Zeichen, Claim, zwei Knöpfe)
//   assets/bild/arbeitsprobe/handy.jpg     780 × 1688  die Seite „In den Markt“ am Handy (390 × 844, doppelte Auflösung)
// Aufgenommen mit einem unsichtbaren Chrome von der laufenden Vorschau, ohne Pakete. Nach einem neuen Zeichen, Film oder Kopf einmal
// laufen lassen:
//   node prototype/fokus-innovation/arbeitsprobe.mjs [http://localhost:3019]
// Chrome-Pfad notfalls über CHROME=… setzen. Größe und Dateinamen stehen so auch in bauen.mjs › arbeitsprobe().

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(ORDNER, 'assets/bild/arbeitsprobe');
const BASIS = (process.argv[2] ?? 'http://localhost:3019').replace(/\/$/, '');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const profil = mkdtempSync(join(tmpdir(), 'mi-arbeitsprobe-'));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--use-angle=metal', '--enable-gpu', '--hide-scrollbars', '--mute-audio', '--no-default-browser-check', '--window-size=1440,900', 'about:blank']);
let ws; let id = 0; const offen = new Map();
for (let i = 0; i < 240 && !ws; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const s = l.find((t) => t.type === 'page'); if (s) ws = new WebSocket(s.webSocketDebuggerUrl); } catch (_) { /* Chrome startet noch */ }
  await warte(250);
}
if (!ws) { chrome.kill('SIGKILL'); console.error('Chrome ist nicht gestartet.'); process.exit(2); }
if (ws.readyState !== 1) await new Promise((ok, f) => { ws.onopen = ok; ws.onerror = f; });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
const cdp = (method, params = {}) => new Promise((ok) => { const i = ++id; offen.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const wert = async (a) => (await cdp('Runtime.evaluate', { expression: a, returnByValue: true, awaitPromise: true })).result?.result?.value;

async function bild({ datei, pfad, breite, hoehe, mass, handy, vorher, wartezeit, guete }) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: mass, mobile: handy });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: handy, maxTouchPoints: handy ? 5 : 1 });
  await cdp('Page.navigate', { url: `${BASIS}${pfad}` });
  await warte(3000);
  if (vorher) await wert(vorher);
  await warte(wartezeit);
  const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: guete });
  writeFileSync(join(ZIEL, datei), Buffer.from(r.result.data, 'base64'));
  console.log(`${datei}: ${breite * mass} × ${hoehe * mass}`);
}

try {
  mkdirSync(ZIEL, { recursive: true });
  await cdp('Page.enable'); await cdp('Runtime.enable');
  // Rechner: ans Ende des Films scrollen (die Bühne füllt dann genau das Fenster) und warten, bis Claim und Knöpfe stehen.
  await bild({ datei: 'rechner.jpg', pfad: '/', breite: 1440, hoehe: 900, mass: 1, handy: false, guete: 88, wartezeit: 5000,
    vorher: '(() => { const f = document.querySelector(".film"); scrollTo(0, f.offsetHeight - innerHeight); })()' });
  // Handy: „In den Markt“ von oben; warten, bis das Problem-Bild von „Heute“ nach „Mit uns“ gewechselt hat.
  await bild({ datei: 'handy.jpg', pfad: '/in-den-markt/', breite: 390, hoehe: 844, mass: 2, handy: true, guete: 84, wartezeit: 6000 });
} finally {
  chrome.kill('SIGKILL');
  await warte(600);
  try { rmSync(profil, { recursive: true, force: true }); } catch (_) { /* Profil bleibt im Temp-Ordner */ }
  process.exit(0);
}
