// Lädt die Modelle (Tüte, Becher, Bohne) einmal und legt den Aufdruck der Lohe Kaffeerösterei als eigene Textur darüber.
import * as THREE from '../vendor/three/build/three.module.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '../vendor/three/examples/jsm/loaders/DRACOLoader.js';

let modelle = null;
let aufdrucke = null;

export function modelleLaden() {
  if (!modelle) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('../vendor/three/examples/jsm/libs/draco/gltf/');
    const lader = new GLTFLoader();
    lader.setCrossOrigin('anonymous');
    lader.setDRACOLoader(draco);
    modelle = lader.loadAsync('medien/modelle.glb').finally(() => draco.dispose());
  }
  return modelle;
}

const TINTE = '#1d1915';
const KUPFER = '#93592f';

function bildLaden(pfad) {
  return new Promise((ok, fehler) => {
    const bild = new Image();
    bild.crossOrigin = 'anonymous';
    bild.decoding = 'async';
    bild.onload = () => ok(bild);
    bild.onerror = () => fehler(new Error('Bild fehlt: ' + pfad));
    bild.src = pfad;
  });
}

async function schriftenBereit() {
  if (!document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('800 120px "Lohe Geist"'),
        document.fonts.load('400 120px "Lohe Allura"'),
        document.fonts.load('400 30px "Lohe Mono"'),
        document.fonts.load('700 30px "Lohe Mono"'),
      ]),
      new Promise((ok) => setTimeout(ok, 1800)),
    ]);
  } catch { /* Ersatzschrift genügt */ }
}

// Mittlere Papierfarbe einer sauberen Stelle.
function papierFarbe(ctx, x, y, b, h) {
  const d = ctx.getImageData(Math.round(x), Math.round(y), b, h).data;
  let r = 0, g = 0, bl = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(bl / n)})`;
}

function ueberdecken(ctx, farbe, rechtecke) {
  ctx.save();
  ctx.fillStyle = farbe;
  ctx.filter = 'blur(7px)';
  for (const [x, y, b, h] of rechtecke) ctx.fillRect(x, y, b, h);
  ctx.restore();
}

function text(ctx, inhalt, x, y, schrift, { farbe = TINTE, abstand = '0px', ausrichtung = 'center' } = {}) {
  ctx.font = schrift;
  ctx.fillStyle = farbe;
  ctx.textAlign = ausrichtung;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = abstand;
  ctx.fillText(inhalt, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function linie(ctx, x0, x1, y, dicke = 2) {
  ctx.fillStyle = TINTE;
  ctx.fillRect(x0, y - dicke / 2, x1 - x0, dicke);
}

// Tüte: 2048 × 2048, zwei Flächen (vorn, hinten). Der Druck steht im Bild kopfüber.
function tueteZeichnen(bild) {
  const W = bild.naturalWidth, H = bild.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bild, 0, 0, W, H);

  for (const [a, b] of [[0.03, 0.38], [0.40, 0.75]]) {
    const x0 = a * W, x1 = b * W, breite = x1 - x0, mitte = (x0 + x1) / 2;
    const papier = papierFarbe(ctx, mitte - 30, 0.34 * H, 60, 24);
    const rand = breite * 0.05;
    ueberdecken(ctx, papier, [
      [x0 + rand, 0.115 * H, breite - 2 * rand, 0.07 * H],
      [x0 + rand, 0.235 * H, breite - 2 * rand, 0.08 * H],
      [x0 + rand, 0.385 * H, breite - 2 * rand, 0.075 * H],
      [x0 + rand, 0.55 * H, breite - 2 * rand, 0.045 * H],
    ]);

    ctx.save();
    ctx.setTransform(1, 0, 0, -1, 0, H);
    text(ctx, 'HAUSRÖSTUNG  Nº 07', mitte, 0.42 * H, '700 30px "Lohe Mono", monospace', { abstand: '6px' });
    linie(ctx, mitte - breite * 0.3, mitte + breite * 0.3, 0.442 * H);
    text(ctx, 'LOHE', mitte, 0.608 * H, '800 176px "Lohe Geist", sans-serif', { abstand: '-6px' });
    text(ctx, 'Kaffeerösterei', mitte, 0.725 * H, '400 150px "Lohe Allura", cursive', { farbe: KUPFER });
    text(ctx, 'GANZE BOHNE · 250 G', mitte, 0.795 * H, '400 30px "Lohe Mono", monospace', { abstand: '3px' });
    text(ctx, 'GERÖSTET IN BERLIN', mitte, 0.82 * H, '400 30px "Lohe Mono", monospace', { abstand: '3px' });
    text(ctx, 'FÜR FILTER & ESPRESSO', mitte, 0.845 * H, '400 30px "Lohe Mono", monospace', { abstand: '3px' });
    linie(ctx, x0 + breite * 0.1, x1 - breite * 0.1, 0.91 * H);
    text(ctx, 'BERLIN', x0 + breite * 0.1, 0.937 * H, '700 26px "Lohe Mono", monospace', { abstand: '4px', ausrichtung: 'left' });
    text(ctx, 'Nº 07', x1 - breite * 0.1, 0.937 * H, '700 26px "Lohe Mono", monospace', { abstand: '4px', ausrichtung: 'right' });
    ctx.restore();
  }
  return c;
}

// Becher: 1536 × 921, Aufdruck links im Band.
function becherZeichnen(bild) {
  const W = bild.naturalWidth, H = bild.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bild, 0, 0, W, H);
  const papier = papierFarbe(ctx, 0.55 * W, 0.5 * H, 40, 40);
  ueberdecken(ctx, papier, [[0.02 * W, 0.22 * H, 0.26 * W, 0.5 * H]]);

  const x0 = 0.045 * W, x1 = 0.242 * W, mitte = (x0 + x1) / 2, teiler = 0.142 * W;
  text(ctx, 'LOHE', mitte, 0.335 * H, '800 92px "Lohe Geist", sans-serif', { abstand: '-3px' });
  text(ctx, 'KAFFEERÖSTEREI', mitte, 0.378 * H, '700 17px "Lohe Mono", monospace', { abstand: '5px' });
  linie(ctx, x0 + 18, x1 - 18, 0.46 * H, 2);
  text(ctx, 'HAUSRÖSTUNG Nº 07', mitte, 0.507 * H, '400 17px "Lohe Mono", monospace', { abstand: '2px' });
  text(ctx, 'Frisch gebrüht', mitte, 0.556 * H, '400 34px "Lohe Allura", cursive', { farbe: KUPFER });
  linie(ctx, x0 + 18, x1 - 18, 0.593 * H, 2);
  text(ctx, 'Nº 07', (x0 + teiler) / 2 + 6, 0.68 * H, '700 16px "Lohe Mono", monospace', { abstand: '3px' });
  text(ctx, 'BERLIN', (teiler + x1) / 2 - 6, 0.68 * H, '700 16px "Lohe Mono", monospace', { abstand: '3px' });
  ctx.fillStyle = TINTE;
  ctx.fillRect(teiler - 1, 0.645 * H, 2, 0.045 * H);
  return c;
}

export function aufdruckeLaden() {
  if (!aufdrucke) {
    aufdrucke = (async () => {
      const [tuete, becher] = await Promise.all([bildLaden('medien/tuete-textur.webp'), bildLaden('medien/becher-textur.webp'), schriftenBereit()]);
      return { tuete: tueteZeichnen(tuete), becher: becherZeichnen(becher) };
    })();
  }
  return aufdrucke;
}

function texturAus(leinwand, alt) {
  const t = new THREE.CanvasTexture(leinwand);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (alt) { t.wrapS = alt.wrapS; t.wrapT = alt.wrapT; t.channel = alt.channel; }
  return t;
}

// Ersetzt den Aufdruck an Tüte und Becher. Jede Szene bekommt eigene Texturen.
export function aufdruckSetzen(wurzel, leinwaende) {
  wurzel.traverse((o) => {
    if (!o.isMesh) return;
    const liste = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of liste) {
      if (!m || !m.name) continue;
      if (m.name === 'Material_0') { const alt = m.map; m.map = texturAus(leinwaende.tuete, alt); m.needsUpdate = true; }
      else if (m.name.startsWith('CupCoffee2')) { const alt = m.map; m.map = texturAus(leinwaende.becher, alt); m.needsUpdate = true; }
    }
  });
}
