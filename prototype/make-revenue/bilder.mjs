// MAKE Revenue · erzeugt die Bilder mit dem Zeichen neu: favicon.ico, bild/icon-180.png, bild/icon-192.png, bild/logo.png, bild/og.png.
// Aufruf:  node bilder.mjs     (nach „node bauen.mjs“, wenn ZEICHEN_WAHL oder die Farben geändert wurden)
// Braucht Google Chrome (zeichnet kleine HTML-Vorlagen ohne Fenster und speichert sie als PNG) und das macOS-Werkzeug „sips“ zum Verkleinern.
// Zeichen und Farben kommen aus seiten.json (schreibt bauen.mjs), die Schriften aus schriften/. Nichts wird aus dem Netz geladen.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const ORDNER = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) { console.error('bilder: Google Chrome nicht gefunden (Pfad über die Umgebungsvariable CHROME setzen)'); process.exit(1); }
const { zeichen, farbe } = JSON.parse(readFileSync(join(ORDNER, 'seiten.json'), 'utf8'));
const schrift = (name) => pathToFileURL(join(ORDNER, 'schriften', name)).href;
const arbeit = mkdtempSync(join(tmpdir(), 'revenue-bilder-'));
const svg = (klasse = '') => `<svg class="${klasse}" viewBox="0 0 100 100">${zeichen.svg}</svg>`;
const grund = `
@font-face { font-family: "Bricolage"; src: url("${schrift('bricolage-grotesque.woff2')}") format("woff2"); font-weight: 200 800; font-stretch: 75% 100%; }
@font-face { font-family: "Instrument"; src: url("${schrift('instrument-serif-italic.woff2')}") format("woff2"); font-style: italic; }
@font-face { font-family: "Mono"; src: url("${schrift('jetbrains-mono.woff2')}") format("woff2"); font-weight: 400 600; }
html, body { margin: 0; background: transparent; }
svg { display: block; fill: currentColor; color: ${farbe.hell}; }`;

function aufnehmen(name, breite, hoehe, css, html, durchsichtig = false) {
  const seite = join(arbeit, name + '.html'), bild = join(arbeit, name + '.png');
  writeFileSync(seite, `<!doctype html><html lang="de"><meta charset="utf-8"><style>${grund}${css}</style><body>${html}</body></html>`);
  execFileSync(CHROME, ['--headless=new', `--user-data-dir=${join(arbeit, 'profil')}`, '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=4000',
    ...(durchsichtig ? ['--default-background-color=00000000'] : []), `--window-size=${breite},${hoehe}`, `--screenshot=${bild}`, pathToFileURL(seite).href], { stdio: 'ignore', timeout: 60000 });
  return bild;
}
const kleiner = (von, nach, kante) => { copyFileSync(von, nach); execFileSync('sips', ['-z', String(kante), String(kante), nach], { stdio: 'ignore' }); };

try {
  // Logo 512: das Zeichen hell auf Nacht, quadratisch (strukturierte Daten, Manifest); daraus die Icons 192 und 180
  const logo = aufnehmen('logo', 512, 512, `.l { width: 512px; height: 512px; display: grid; place-items: center; background: ${farbe.nacht}; } .l svg { width: 372px; height: 372px; }`, `<div class="l">${svg()}</div>`);
  copyFileSync(logo, join(ORDNER, 'bild', 'logo.png'));
  kleiner(logo, join(ORDNER, 'bild', 'icon-192.png'), 192);
  kleiner(logo, join(ORDNER, 'bild', 'icon-180.png'), 180);

  // favicon.ico: wie zeichen.svg (runde Ecken, durchsichtiger Rand) in 16, 32 und 48 Pixel, als PNG in einer ICO-Hülle
  const rund = aufnehmen('rund', 256, 256, `.r { width: 256px; height: 256px; display: grid; place-items: center; background: ${farbe.nacht}; border-radius: 56px; } .r svg { width: 196px; height: 196px; }`, `<div class="r">${svg()}</div>`, true);
  const teile = [16, 32, 48].map((k) => { const p = join(arbeit, `ico-${k}.png`); kleiner(rund, p, k); return { k, daten: readFileSync(p) }; });
  const kopf = Buffer.alloc(6 + 16 * teile.length); kopf.writeUInt16LE(0, 0); kopf.writeUInt16LE(1, 2); kopf.writeUInt16LE(teile.length, 4);
  let ort = kopf.length;
  teile.forEach((t, i) => { const o = 6 + 16 * i; kopf.writeUInt8(t.k, o); kopf.writeUInt8(t.k, o + 1); kopf.writeUInt8(0, o + 2); kopf.writeUInt8(0, o + 3); kopf.writeUInt16LE(1, o + 4); kopf.writeUInt16LE(32, o + 6); kopf.writeUInt32LE(t.daten.length, o + 8); kopf.writeUInt32LE(ort, o + 12); ort += t.daten.length; });
  writeFileSync(join(ORDNER, 'favicon.ico'), Buffer.concat([kopf, ...teile.map((t) => t.daten)]));

  // Vorschaubild 1200 × 630
  const og = aufnehmen('og', 1200, 630, `
.og { position: relative; width: 1200px; height: 630px; overflow: hidden; background: ${farbe.nacht}; color: ${farbe.papier}; font-family: "Bricolage", sans-serif; }
.oben { position: absolute; left: 72px; top: 64px; display: flex; align-items: center; gap: 18px; }
.oben svg { width: 52px; height: 52px; }
.wort { font-size: 26px; letter-spacing: .19em; } .wort b { font-weight: 800; } .wort span { font-weight: 300; }
h1 { position: absolute; left: 72px; top: 190px; margin: 0; font-size: 128px; line-height: .92; font-weight: 700; font-stretch: 82%; letter-spacing: -.022em; }
h1 em { font-family: "Instrument", serif; font-weight: 400; color: ${farbe.hell}; font-size: 1.04em; }
p { position: absolute; left: 72px; top: 446px; width: 600px; margin: 0; font-size: 29px; line-height: 1.3; color: rgba(238, 241, 246, .8); }
.gross { position: absolute; right: 56px; top: 96px; width: 440px; height: 440px; color: ${farbe.blau}; }
.gross circle:not([fill]) { color: ${farbe.hell}; fill: ${farbe.hell}; }
.fuss { position: absolute; left: 72px; bottom: 54px; font: 500 18px/1 "Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #9AA7BD; }`,
  `<div class="og"><div class="oben">${svg()}<span class="wort"><b>MAKE</b> <span>REVENUE</span></span></div>
<h1>Vertrieb<br>mit <em>System.</em></h1>
<p>Von der Anfrage zum Abschluss.</p>
${svg('gross')}
<span class="fuss">Eine Marke von MAKE Innovation · Berlin</span></div>`);
  copyFileSync(og, join(ORDNER, 'bild', 'og.png'));
  console.log(`bilder: favicon.ico, bild/icon-180.png, bild/icon-192.png, bild/logo.png, bild/og.png neu (Zeichen: ${zeichen.name})`);
} finally { rmSync(arbeit, { recursive: true, force: true }); }
