// Lichtfäden — feine, leuchtende Fäden auf Canvas 2D (übersetzt, nicht von Hand ändern).
// Erzeugt mit: node scripts/lichtfaeden-website.mjs — liest nichts, speichert nichts, sendet nichts.
(() => {
  'use strict';
  const LICHTFAEDEN = {
      faeden: { rechner: 22, handy: 11 },
      schritt: { rechner: 6, handy: 8 },
      tempo: 0.00028,
      strich: 0.6,
      deckkraft: 0.2,
      stufen: 40,
      ruhe: 0.12,
      dprMax: 2,
      aufbau: 1900,
      aufbauVerzug: 150,
      aufbauSpitze: 46,
      punkte: { abstand: 10, tempo: 0.011, groesse: 1.1, hell: 2.4 },
      frans: { weite: 0.95, min: 7, blass: 0.6 },
      glanz: { teiler: 4, weich: 2.5, staerke: 0.55 },
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
          const lage = u * 0.86 + (r() - 0.5) * 0.18, phase = r() * TAU, frequenz = 0.0045 + r() * 0.0125;
          const tempo = 0.55 + r() * 0.9;
          r();
          aus.push({ lage, phase, frequenz, tempo, welle: 0.3 + r() * 0.7, hell: 0.5 + r() * 0.5 });
      }
      return aus;
  }
  const MITTE = { lage: 0, phase: 0, frequenz: 0, tempo: 0, welle: 0, hell: 1 };
  function versatz(f, s, t) {
      const ph = t * LICHTFAEDEN.tempo * Math.abs(f.tempo);
      return f.lage * (1 - 0.45 * f.welle)
          + f.welle * 0.62 * Math.sin(s * f.frequenz + f.phase - ph)
          + 0.16 * f.welle * Math.sin(s * f.frequenz * 2.3 + f.phase * 1.7 - ph * 1.6);
  }
  function fransen(f, s, t) {
      const ph = t * LICHTFAEDEN.tempo * Math.abs(f.tempo);
      return f.lage * 0.8 + 0.6 * Math.sin(s * f.frequenz * 3.1 + f.phase * 2.3 - ph * 1.8);
  }
  function buendelMitte(index, anzahl, s, t, dichte) {
      const phi = (index / Math.max(1, anzahl)) * TAU + index * 0.9;
      const ph = t * LICHTFAEDEN.tempo * 0.55;
      const amp = 0.06 + 0.44 * dichte;
      return amp * Math.sin(s * 0.0098 + phi - ph) + 0.05 * Math.sin(s * 0.0031 - phi * 1.3 - ph * 0.4);
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
      var _a, _b, _c, _d, _e, _f;
      if (proben.length < 2)
          return 0;
      const stufen = LICHTFAEDEN.stufen;
      const basis = (_a = stil.deckkraft) !== null && _a !== void 0 ? _a : LICHTFAEDEN.deckkraft;
      const F = LICHTFAEDEN.frans;
      const front = stil.front != null && isFinite(stil.front) ? stil.front : null;
      const spitze = LICHTFAEDEN.aufbauSpitze;
      const pk = (_b = stil.punkte) !== null && _b !== void 0 ? _b : null;
      const g = pk ? pk.groesse : 0, gh = g / 2;
      const eimer = new Map();
      const punktEimer = new Map();
      const saaten = stil.saaten;
      for (let fi = 0; fi < saaten.length; fi++) {
          const f = saaten[fi];
          const reicht = front == null ? null : front - (f.phase / TAU) * LICHTFAEDEN.aufbauVerzug;
          const mitPunkten = !!pk && fi % Math.max(1, (_c = pk.jeder) !== null && _c !== void 0 ? _c : 1) === 0;
          const verschub = pk && mitPunkten ? t * pk.tempo + (f.phase / TAU) * pk.abstand : 0;
          const faecher = (f.welle - 0.65) * 0.8;
          let pfad = null, stufe = -1, vx = 0, vy = 0, vs = 0, vq = 0;
          for (let k = 0; k < proben.length; k++) {
              const p = proben[k];
              if (reicht != null && p.s > reicht)
                  break;
              let o = versatz(f, p.s, t) * p.spreizung;
              const fr = (_d = p.frans) !== null && _d !== void 0 ? _d : 0;
              if (fr > 0)
                  o += fr * F.weite * Math.max(p.spreizung, F.min) * fransen(f, p.s, t);
              if (p.hub)
                  o += p.hub * faecher;
              const x = p.x + p.nx * o, y = p.y + p.ny * o;
              const q = pk && mitPunkten ? Math.floor((p.s - verschub) / pk.abstand) : 0;
              if (k > 0) {
                  let a = basis * f.hell * p.hell;
                  if (fr > 0)
                      a *= 1 - fr * F.blass * (0.4 + 0.6 * Math.min(1, Math.abs(f.lage)));
                  if (reicht != null) {
                      const r = reicht - p.s;
                      if (r < spitze)
                          a *= 1 + 1.8 * (1 - r / spitze);
                  }
                  a = Math.min(1, a);
                  const st = Math.round(a * stufen);
                  if (st <= 0) {
                      pfad = null;
                      stufe = -1;
                  }
                  else {
                      if (st !== stufe || !pfad) {
                          stufe = st;
                          pfad = (_e = eimer.get(st)) !== null && _e !== void 0 ? _e : null;
                          if (!pfad) {
                              pfad = new Path2D();
                              eimer.set(st, pfad);
                          }
                          pfad.moveTo(vx, vy);
                      }
                      pfad.lineTo(x, y);
                  }
                  if (pk && mitPunkten && q > vq && st > 0) {
                      const u = (q * pk.abstand + verschub - vs) / ((p.s - vs) || 1);
                      const ps = Math.round(Math.min(1, a * pk.hell) * stufen);
                      let pp = punktEimer.get(ps);
                      if (!pp) {
                          pp = new Path2D();
                          punktEimer.set(ps, pp);
                      }
                      pp.rect(vx + (x - vx) * u - gh, vy + (y - vy) * u - gh, g, g);
                  }
              }
              vx = x;
              vy = y;
              vs = p.s;
              vq = q;
          }
      }
      const [r, gr, b] = rgb(stil.farbe);
      ctx.lineWidth = (_f = stil.strich) !== null && _f !== void 0 ? _f : LICHTFAEDEN.strich;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [st, pfad] of eimer) {
          ctx.strokeStyle = `rgba(${r},${gr},${b},${(st / stufen).toFixed(3)})`;
          ctx.stroke(pfad);
      }
      for (const [st, pp] of punktEimer) {
          ctx.fillStyle = `rgba(${r},${gr},${b},${(st / stufen).toFixed(3)})`;
          ctx.fill(pp);
      }
      return eimer.size + punktEimer.size;
  }
  function glanzPuffer() {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function')
          return null;
      const c = document.createElement('canvas');
      const g = c.getContext ? c.getContext('2d') : null;
      if (!g)
          return null;
      return {
          auf(ctx, quelle, breite, hoehe, staerke = LICHTFAEDEN.glanz.staerke) {
              const T = LICHTFAEDEN.glanz.teiler;
              const w = Math.max(1, Math.round(breite / T)), h = Math.max(1, Math.round(hoehe / T));
              if (c.width !== w)
                  c.width = w;
              if (c.height !== h)
                  c.height = h;
              g.setTransform(1, 0, 0, 1, 0, 0);
              g.globalCompositeOperation = 'copy';
              g.filter = `blur(${LICHTFAEDEN.glanz.weich}px)`;
              g.drawImage(quelle, 0, 0, w, h);
              g.filter = 'none';
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = staerke;
              ctx.imageSmoothingEnabled = true;
              ctx.drawImage(c, 0, 0, breite, hoehe);
              ctx.restore();
          },
      };
  }
  function zeichneNetz(ctx, o) {
      var _a, _b, _c;
      const r = zufall((_a = o.saat) !== null && _a !== void 0 ? _a : 7);
      const n = Math.max(3, (_b = o.knoten) !== null && _b !== void 0 ? _b : 11);
      const pk = [];
      for (let i = 0; i < n; i++) {
          const bx = r(), by = r(), ph = r() * TAU, amp = 4 + r() * 7;
          pk.push({ x: o.x + bx * o.breite + Math.sin(o.t * 0.00011 + ph) * amp, y: o.y + by * o.hoehe + Math.cos(o.t * 0.00009 + ph * 1.3) * amp * 0.7, g: 1.3 + r() * 1.5 });
      }
      const max = Math.max(o.breite, o.hoehe) * 0.5;
      const a0 = (_c = o.deckkraft) !== null && _c !== void 0 ? _c : 0.16;
      const [cr, cg, cb] = rgb(o.farbe);
      const linien = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) {
              const d = Math.hypot(pk[i].x - pk[j].x, pk[i].y - pk[j].y);
              if (d >= max)
                  continue;
              const l = linien[d < max * 0.45 ? 0 : d < max * 0.75 ? 1 : 2];
              l.moveTo(pk[i].x, pk[i].y);
              l.lineTo(pk[j].x, pk[j].y);
          }
      ctx.lineWidth = 0.6;
      linien.forEach((l, i) => { ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(a0 * [1, 0.6, 0.3][i]).toFixed(3)})`; ctx.stroke(l); });
      const knoten = new Path2D();
      for (const p of pk) {
          knoten.moveTo(p.x + p.g, p.y);
          knoten.arc(p.x, p.y, p.g, 0, TAU);
      }
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${(a0 * 0.7).toFixed(3)})`;
      ctx.fill(knoten);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(1, a0 * 2.4).toFixed(3)})`;
      ctx.stroke(knoten);
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
      var _a;
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
      let sichtbar = true, laeuft = false, id = 0, zuletzt = -1e9;
      const abstand = Math.max(0, (_a = o.intervall) !== null && _a !== void 0 ? _a : 0);
      const schritt = (j) => {
          if (!laeuft)
              return;
          if (!abstand || j - zuletzt >= abstand - 1) {
              zuletzt = j;
              messen(zeit(j));
          }
          id = raf(schritt);
      };
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
  globalThis.Lichtfaeden = Object.freeze({ LICHTFAEDEN, TAU, zufall, textSaat, fadenSaaten, MITTE, versatz, fransen, buendelMitte, spreizung, gauss, saettigen, wertBei, glatt, kurve, rgb, zeichneBuendel, glanzPuffer, zeichneNetz, leinwand, bewegungReduziert, starteLauf });
})();
