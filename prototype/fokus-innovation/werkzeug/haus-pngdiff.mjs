// node werkzeug/haus-pngdiff.mjs a.png b.png [x,y,b,h;… ausnehmen]  → Anteil verschiedener Pixel und ein Raster (16 × 9), das zeigt, WO die Bilder abweichen.
// Zum Vergleich der eingebauten Geschichte mit einem früheren Stand (Standbilder mit demselben p).
import { readFileSync } from 'node:fs'; import { inflateSync } from 'node:zlib';
function lies(f) { const b = readFileSync(f); let o = 8, w, h, bd, ct; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), typ = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (typ === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; } else if (typ === 'IDAT') idat.push(d); o += 12 + len; }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 4, raw = inflateSync(Buffer.concat(idat)), st = w * bpp, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], row = raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)), out = px.subarray(y * st, (y + 1) * st), up = y ? px.subarray((y - 1) * st, y * st) : null;
    for (let x = 0; x < st; x++) { const a = x >= bpp ? out[x - bpp] : 0, bb = up ? up[x] : 0, c = up && x >= bpp ? up[x - bpp] : 0; let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1; else if (f === 4) { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; } out[x] = v & 255; } }
  return { w, h, bpp, px }; }
const [fa, fb, aus] = process.argv.slice(2); const A = lies(fa), B = lies(fb);
if (A.w !== B.w || A.h !== B.h) { console.log(`Größe verschieden: ${A.w}×${A.h} gegen ${B.w}×${B.h}`); process.exit(0); }
const ex = aus ? aus.split(";").map((r) => r.split(",").map(Number)) : []; const SP = 16, ZE = 9, feld = Array.from({ length: ZE }, () => new Array(SP).fill(0)); let n = 0, max = 0;
for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) { if (ex.some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h)) continue; let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.px[(y * A.w + x) * A.bpp + c] - B.px[(y * B.w + x) * B.bpp + c])); if (d > 2) { n++; if (d > max) max = d; feld[Math.floor(y * ZE / A.h)][Math.floor(x * SP / A.w)]++; } }
console.log(`${fb.split("/").pop()}: ${n} von ${A.w * A.h} Pixeln verschieden (${(100 * n / (A.w * A.h)).toFixed(3)} %), größte Abweichung ${max}`);
if (n) { const zelle = (A.w / SP) * (A.h / ZE); for (const z of feld) console.log("  " + z.map((v) => (v === 0 ? " ." : String(Math.min(99, Math.round(100 * v / zelle))).padStart(2))).join(" ")); }
