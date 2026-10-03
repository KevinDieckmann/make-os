// Lichtfäden — feine, leuchtende Fäden auf Canvas 2D (übersetzt, nicht von Hand ändern).
// Erzeugt mit: node scripts/lichtfaeden-website.mjs — liest nichts, speichert nichts, sendet nichts.
(() => {
  'use strict';
  const LICHTFAEDEN = {
      faeden: { rechner: 22, handy: 11 },
      schritt: { rechner: 6, handy: 8 },
      tempo: 0.00028,
      strich: 0.8,
      deckkraft: 0.24,
      stufen: 40,
      ruhe: 0.12,
      dprMax: 2,
  };
  const TAU = Math.PI * 2;
  function zufall(saat) {
      let a = saat >>> 0;
      return () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
  }
  function textSaat(text) {
      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) {
          h ^= text.charCodeAt(i);
          h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
  }
  function fadenSaaten(anzahl, saat) {
      const r = zufall(saat);
      const n = Math.max(1, Math.floor(anzahl));
      const aus = [];
      for (let i = 0; i < n; i++) {
          const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
          aus.push({
              lage: u * 0.86 + (r() - 0.5) * 0.18,
              phase: r() * TAU,
              frequenz: 0.0045 + r() * 0.0125,
              tempo: (0.55 + r() * 0.9) * (r() < 0.5 ? -1 : 1),
              welle: 0.3 + r() * 0.7,
              hell: 0.5 + r() * 0.5,
          });
      }
      return aus;
  }
  const MITTE = { lage: 0, phase: 0, frequenz: 0, tempo: 0, welle: 0, hell: 1 };
  function versatz(f, s, t) {
      const ph = t * LICHTFAEDEN.tempo * f.tempo;
      return f.lage * (1 - 0.45 * f.welle)
          + f.welle * 0.62 * Math.sin(s * f.frequenz + f.phase + ph)
          + 0.16 * f.welle * Math.sin(s * f.frequenz * 2.3 + f.phase * 1.7 - ph * 0.7);
  }
  function buendelMitte(index, anzahl, s, t, dichte) {
      const phi = (index / Math.max(1, anzahl)) * TAU + index * 0.9;
      const ph = t * LICHTFAEDEN.tempo * 0.55;
      const amp = 0.06 + 0.44 * dichte;
      return amp * Math.sin(s * 0.0098 + phi + ph) + 0.05 * Math.sin(s * 0.0031 - phi * 1.3 - ph * 0.4);
  }
  function spreizung(dichte, halb) {
      const d = Math.max(0, Math.min(1, dichte));
      return halb * (LICHTFAEDEN.ruhe + (1 - LICHTFAEDEN.ruhe) * d) * 0.85;
  }
  function gauss(werte, sigma) {
      if (!(sigma > 0))
          return werte.slice();
      const r = Math.ceil(sigma * 3);
      const kern = [];
      let summe = 0;
      for (let k = -r; k <= r; k++) {
          const w = Math.exp(-(k * k) / (2 * sigma * sigma));
          kern.push(w);
          summe += w;
      }
      const aus = new Array(werte.length).fill(0);
      for (let i = 0; i < werte.length; i++) {
          let v = 0;
          for (let k = -r; k <= r; k++) {
              const j = i + k;
              if (j >= 0 && j < werte.length)
                  v += werte[j] * kern[k + r];
          }
          aus[i] = v / summe;
      }
      return aus;
  }
  function saettigen(v, halb) {
      if (!(v > 0))
          return 0;
      return 1 - Math.pow(2, -v / Math.max(1e-9, halb));
  }
  function wertBei(werte, f) {
      const n = werte.length;
      if (!n)
          return 0;
      const p = Math.max(0, Math.min(n - 1, f * n - 0.5));
      const i = Math.floor(p), j = Math.min(n - 1, i + 1), a = p - i;
      return werte[i] * (1 - a) + werte[j] * a;
  }
  function glatt(v, a, b) {
      const t = Math.max(0, Math.min(1, (v - a) / (b - a || 1)));
      return t * t * (3 - 2 * t);
  }
  function kurve(anker, schritt) {
      const aus = [];
      if (anker.length < 2)
          return aus;
      const n = anker.length, st = Math.max(1, schritt);
      const p = (i) => anker[Math.max(0, Math.min(n - 1, i))];
      let s = 0, vx = anker[0].x, vy = anker[0].y;
      for (let i = 0; i < n - 1; i++) {
          const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
          const laenge = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const teile = Math.max(1, Math.ceil(laenge / st));
          for (let k = i === 0 ? 0 : 1; k <= teile; k++) {
              const t = k / teile, t2 = t * t, t3 = t2 * t;
              const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
              const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
              const dx = 0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2);
              const dy = 0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2);
              const d = Math.hypot(dx, dy) || 1;
              s += Math.hypot(x - vx, y - vy);
              vx = x;
              vy = y;
              const g = t * t * (3 - 2 * t);
              const werte = p1.werte.map((w, j) => { var _a; return w + (((_a = p2.werte[j]) !== null && _a !== void 0 ? _a : w) - w) * g; });
              aus.push({ x, y, nx: -dy / d, ny: dx / d, s, werte });
          }
      }
      return aus;
  }

  function rgb(hex) {
      const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!h)
          return [255, 255, 255];
      const n = parseInt(h[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function zeichneBuendel(ctx, proben, stil, t) {
      var _a, _b, _c;
      if (proben.length < 2)
          return 0;
      const stufen = LICHTFAEDEN.stufen;
      const basis = (_a = stil.deckkraft) !== null && _a !== void 0 ? _a : LICHTFAEDEN.deckkraft;
      const eimer = new Map();
      for (const f of stil.saaten) {
          let pfad = null, stufe = -1, vx = 0, vy = 0;
          for (let k = 0; k < proben.length; k++) {
              const p = proben[k];
              const o = versatz(f, p.s, t) * p.spreizung;
              const x = p.x + p.nx * o, y = p.y + p.ny * o;
              if (k > 0) {
                  const a = Math.min(1, basis * f.hell * p.hell);
                  const st = Math.round(a * stufen);
                  if (st <= 0) {
                      pfad = null;
                      stufe = -1;
                  }
                  else {
                      if (st !== stufe || !pfad) {
                          stufe = st;
                          pfad = (_b = eimer.get(st)) !== null && _b !== void 0 ? _b : null;
                          if (!pfad) {
                              pfad = new Path2D();
                              eimer.set(st, pfad);
                          }
                          pfad.moveTo(vx, vy);
                      }
                      pfad.lineTo(x, y);
                  }
              }
              vx = x;
              vy = y;
          }
      }
      const [r, g, b] = rgb(stil.farbe);
      ctx.lineWidth = (_c = stil.strich) !== null && _c !== void 0 ? _c : LICHTFAEDEN.strich;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [st, pfad] of eimer) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${(st / stufen).toFixed(3)})`;
          ctx.stroke(pfad);
      }
      return eimer.size;
  }
  function leinwand(canvas, breite, hoehe, dprMax = LICHTFAEDEN.dprMax) {
      const dpr = Math.max(1, Math.min(dprMax, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
      const bw = Math.max(1, Math.round(breite * dpr)), bh = Math.max(1, Math.round(hoehe * dpr));
      if (canvas.width !== bw)
          canvas.width = bw;
      if (canvas.height !== bh)
          canvas.height = bh;
      return dpr;
  }
  function bewegungReduziert() {
      return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function starteLauf(o) {
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(() => f(Date.now()), 16);
      const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : (id) => clearTimeout(id);
      let bilder = 0, summe = 0, laengstes = 0, beendet = false;
      const messen = (t) => {
          const a = typeof performance !== 'undefined' ? performance.now() : Date.now();
          o.zeichne(t);
          const d = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - a;
          bilder++;
          summe += d;
          if (d > laengstes)
              laengstes = d;
      };
      let start = -1, wartet = 0;
      const zeit = (jetzt) => { if (start < 0)
          start = jetzt; return o.ruhig ? 0 : jetzt - start; };
      const einmal = () => { if (beendet || wartet)
          return; wartet = raf(j => { wartet = 0; messen(zeit(j)); }); };
      const messung = () => ({ bilder, mittelMs: bilder ? summe / bilder : 0, laengstesMs: laengstes });
      if (o.ruhig) {
          einmal();
          return { einmal, stop: () => { beendet = true; if (wartet)
                  caf(wartet); }, messung };
      }
      let sichtbar = true, laeuft = false, id = 0;
      const schritt = (j) => { if (!laeuft)
          return; messen(zeit(j)); id = raf(schritt); };
      const pruefe = () => {
          const soll = !beendet && sichtbar && !(typeof document !== 'undefined' && document.hidden);
          if (soll && !laeuft) {
              laeuft = true;
              id = raf(schritt);
          }
          else if (!soll && laeuft) {
              laeuft = false;
              caf(id);
          }
      };
      let io = null;
      if (o.beobachte && typeof IntersectionObserver === 'function') {
          io = new IntersectionObserver(es => { sichtbar = es.some(e => e.isIntersecting); pruefe(); }, { rootMargin: '120px 0px' });
          io.observe(o.beobachte);
      }
      const sicht = () => pruefe();
      if (typeof document !== 'undefined')
          document.addEventListener('visibilitychange', sicht);
      pruefe();
      return {
          einmal: () => { if (!laeuft)
              einmal(); },
          stop: () => {
              beendet = true;
              laeuft = false;
              caf(id);
              if (wartet)
                  caf(wartet);
              if (io)
                  io.disconnect();
              if (typeof document !== 'undefined')
                  document.removeEventListener('visibilitychange', sicht);
          },
          messung,
      };
  }
  globalThis.Lichtfaeden = Object.freeze({ LICHTFAEDEN, TAU, zufall, textSaat, fadenSaaten, MITTE, versatz, buendelMitte, spreizung, gauss, saettigen, wertBei, glatt, kurve, rgb, zeichneBuendel, leinwand, bewegungReduziert, starteLauf });
})();
