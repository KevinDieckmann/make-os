// ─── MAKE OS Homepage — Das Brain (27.09., dritter Durchgang) ──────────────────
// Ein Netz aus Knoten und Verbindungen auf einem 2D-Canvas. Kein WebGL, keine
// Bibliothek, kein Kopieren: alles hier ist eigene Geometrie.
//
// Zwei Bühnen:
//   1. Die große Bühne (.odyssee) — klebt hinter den ersten fünf Kapiteln und
//      verwandelt sich mit dem Scrollen: Hero (ein Brain aus zwei Hälften) →
//      Zwei Leben (die Hälften treiben auseinander) → Das Chaos (alles zerfällt
//      in neun graue App-Haufen) → Ein Brain (alles findet sich wieder, hinter
//      der Score-Scheibe) → Jarvis (ein Impuls läuft durchs Netz, bleibt im
//      Stapel stehen und wartet auf dein Ja).
//   2. Die kleine Bühne (#make-m) im Founder-Abschnitt — Granat- und Smaragd-
//      Partikel finden sich zum M, in der Fuge ein türkiser Funke.
//
// Regeln: Bewegung folgt dem Scrollen, nie umgekehrt (kein Scrolljacking).
// prefers-reduced-motion → keine Dauerbewegung, nur der Zustand je Kapitel.
// Ohne Canvas bleibt das Standbild (SVG) stehen. Handy: weniger Knoten, Finger
// statt Maus, Backing-Store bis 2× dpr.
(() => {
  'use strict';
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handy = matchMedia('(max-width: 820px)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const glatt = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const spanne = (v, a, b) => glatt((v - a) / (b - a));
  const hut = (f, m, breite = 1) => glatt(1 - Math.abs(f - m) / breite);   // Dach über einem Kapitel
  const lerp = (a, b, t) => a + (b - a) * t;

  // Fester Zufall: gleiche Geometrie bei jedem Laden — das Standbild passt zum Netz.
  let saat = 27092026;
  const zufall = () => { saat = (saat * 1664525 + 1013904223) >>> 0; return saat / 4294967296; };
  const gauss = () => (zufall() + zufall() + zufall() - 1.5) * 1.15;

  // Farben als "r,g,b" — Granat (Malin), Smaragd (Kevin), Türkis (das Produkt).
  const F = { granat: '209,58,85', smaragd: '34,181,119', tuerkis: '88,217,205', grau: '110,122,125', gelb: '255,201,60', gruen: '61,226,139' };
  const mischen = (a, b, t) => { const p = a.split(',').map(Number), q = b.split(',').map(Number); return p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(','); };

  // ── Eimer: gleiche Farbe + ähnliche Deckkraft = ein Pfad, ein Strich. ──────────
  // 900 Kanten werden so zu ~30 stroke()-Aufrufen — das trägt die 60 fps.
  class Eimer {
    constructor(ctx) { this.ctx = ctx; this.k = new Map(); }
    linie(farbe, a, x1, y1, x2, y2, breite = 1) {
      if (a < .015) return; a = Math.min(1, Math.round(a * 14) / 14);
      const key = 'l' + farbe + '|' + a + '|' + breite; let e = this.k.get(key);
      if (!e) { e = { art: 'l', farbe, a, breite, p: new Path2D() }; this.k.set(key, e); }
      e.p.moveTo(x1, y1); e.p.lineTo(x2, y2);
    }
    punkt(farbe, a, x, y, r) {
      if (a < .02 || r < .3) return; a = Math.min(1, Math.round(a * 10) / 10);
      const key = 'p' + farbe + '|' + a; let e = this.k.get(key);
      if (!e) { e = { art: 'p', farbe, a, p: new Path2D() }; this.k.set(key, e); }
      e.p.moveTo(x + r, y); e.p.arc(x, y, r, 0, TAU);
    }
    zeichnen() {
      const c = this.ctx; c.lineCap = 'round';
      for (const e of this.k.values()) {
        if (e.art === 'l') { c.strokeStyle = `rgba(${e.farbe},${e.a})`; c.lineWidth = e.breite; c.stroke(e.p); }
        else { c.fillStyle = `rgba(${e.farbe},${e.a})`; c.fill(e.p); }
      }
      this.k.clear();
    }
  }

  // ── Zeiger: Maus oder Finger, in Client-Koordinaten. ──────────────────────────
  const zeiger = { x: -1e5, y: -1e5, an: false };
  if (!ruhig) {
    addEventListener('pointermove', e => { zeiger.x = e.clientX; zeiger.y = e.clientY; zeiger.an = true; }, { passive: true });
    addEventListener('pointerleave', () => { zeiger.an = false; });
    addEventListener('pointercancel', () => { zeiger.an = false; });
    addEventListener('touchend', () => { setTimeout(() => { zeiger.an = false; }, 400); }, { passive: true });
  }

  // ── k nächste Nachbarn (einmalig, beim Bau) ────────────────────────────────────
  function nachbarn(pos, dim, k, erlaubt) {
    const n = pos.length / dim, kanten = [], seen = new Set();
    for (let i = 0; i < n; i++) {
      const best = [];
      for (let j = 0; j < n; j++) {
        if (i === j || (erlaubt && !erlaubt(i, j))) continue;
        let d = 0; for (let q = 0; q < dim; q++) { const t = pos[i * dim + q] - pos[j * dim + q]; d += t * t; }
        if (best.length < k) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); }
        else if (d < best[k - 1][0]) { best[k - 1] = [d, j]; best.sort((a, b) => a[0] - b[0]); }
      }
      for (const [, j] of best) { const key = i < j ? i * n + j : j * n + i; if (!seen.has(key)) { seen.add(key); kanten.push(i, j); } }
    }
    return kanten;
  }

  // ── Leinwand: Größe mit dpr-Deckel ─────────────────────────────────────────────
  function leinwand(canvas, el) {
    const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, handy ? 2 : 1.5);
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    return { W, H, dpr };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. Die große Bühne
  // ═══════════════════════════════════════════════════════════════════════════════
  function grosseBuehne() {
    const odyssee = document.querySelector('.odyssee'), buehne = odyssee?.querySelector('.buehne'), canvas = document.getElementById('brain');
    if (!odyssee || !buehne || !canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const kapitel = Array.from(odyssee.querySelectorAll(':scope > .kapitel'));
    const inhalte = kapitel.map(k => k.querySelector('.wrap'));
    const scheibe = document.getElementById('score-app');
    const chips = Array.from(buehne.querySelectorAll('.chip'));
    const stapelChip = buehne.querySelector('.stapel-chip');
    const stapelText = stapelChip?.querySelector('b');
    const eimer = new Eimer(ctx);

    // ── Geometrie: ein Brain aus zwei Hälften ──
    const N_OBER = handy ? 210 : 470, N_KERN = handy ? 34 : 78, N = N_OBER + N_KERN;
    const P = new Float32Array(N * 3);            // Einheitskoordinaten (3D)
    const seite = new Uint8Array(N);              // 0 = links (Granat), 1 = rechts (Smaragd)
    const kern = new Uint8Array(N);               // 1 = Kernknoten (Türkis)
    const GOLD = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N_OBER; i++) {
      // Fibonacci-Kugel mit Streuung, dann zur Hirnform verzogen: breiter als hoch,
      // eine Furche in der Mitte, Windungen als flache Wellen im Radius.
      const y0 = 1 - 2 * (i + .5) / N_OBER, r0 = Math.sqrt(1 - y0 * y0), phi = i * GOLD + (zufall() - .5) * .18;
      let x = r0 * Math.cos(phi), y = y0 + (zufall() - .5) * .04, z = r0 * Math.sin(phi);
      const theta = Math.acos(clamp(y, -1, 1));
      let rad = 1 + .04 * Math.sin(7 * phi) * Math.sin(6 * theta) + .022 * Math.sin(11 * phi + 1.3) * Math.cos(4 * theta);
      if (Math.abs(x) < .11 && y > -.35) rad *= .9;                        // Furche
      x *= rad * 1.02; y *= rad * .84; z *= rad * .92;
      if (y < -.55) { y = -.55 - (y + .55) * .35; }                         // unten flacher (Hirnstamm bleibt weg)
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; seite[i] = x < 0 ? 0 : 1;
    }
    for (let i = N_OBER; i < N; i++) {
      const u = zufall() * 2 - 1, phi = zufall() * TAU, r0 = Math.sqrt(1 - u * u), rr = .18 + .3 * Math.cbrt(zufall());
      P[i * 3] = r0 * Math.cos(phi) * rr; P[i * 3 + 1] = u * rr * .8; P[i * 3 + 2] = r0 * Math.sin(phi) * rr;
      seite[i] = P[i * 3] < 0 ? 0 : 1; kern[i] = 1;
    }
    // Kanten im Brain: die zwei nächsten Nachbarn im Raum (der dritte mit etwas Glück).
    const K_BRAIN = nachbarn(P, 3, 2);
    const KB = K_BRAIN.length / 2;
    // Verbindungen über die Furche hinweg sind Synapsen → Türkis.
    // ── Chaos: neun Haufen (die Apps) ──
    const HAUFEN = [[-.92, -.78], [.02, -.98], [.94, -.7], [-1, .04], [.04, .08], [1, .02], [-.86, .86], [.04, .98], [.9, .8]].map(([x, y]) => [x + (zufall() - .5) * .14, y + (zufall() - .5) * .14]);
    const haufen = new Uint8Array(N), off = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { haufen[i] = (i * 7 + seite[i] * 3) % 9; off[i * 2] = gauss() * .55; off[i * 2 + 1] = gauss() * .5; }
    const K_CHAOS = nachbarn(off, 2, 2, (i, j) => haufen[i] === haufen[j]);
    const KC = K_CHAOS.length / 2;
    // ── Hops vom Kern nach außen (für den Jarvis-Impuls) ──
    const hop = new Int16Array(N).fill(-1); {
      const adj = Array.from({ length: N }, () => []);
      for (let e = 0; e < KB; e++) { const a = K_BRAIN[e * 2], b = K_BRAIN[e * 2 + 1]; adj[a].push(b); adj[b].push(a); }
      let start = N_OBER; for (let i = N_OBER; i < N; i++) if (Math.hypot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) < Math.hypot(P[start * 3], P[start * 3 + 1], P[start * 3 + 2])) start = i;
      const q = [start]; hop[start] = 0;
      while (q.length) { const a = q.shift(); for (const b of adj[a]) if (hop[b] < 0) { hop[b] = hop[a] + 1; q.push(b); } }
      for (let i = 0; i < N; i++) if (hop[i] < 0) hop[i] = 12;              // abgehängte Inseln kommen spät
    }
    let maxHop = 0; for (let i = 0; i < N; i++) if (hop[i] > maxHop) maxHop = hop[i];
    // Der Stapel-Knoten: weit außen, rechts oben — dort wartet der Vorschlag.
    let stapelIdx = 0; { let best = -1e9; for (let i = 0; i < N_OBER; i++) { const s = hop[i] * .6 + P[i * 3] * 3 - P[i * 3 + 1] * 2; if (seite[i] === 1 && s > best) { best = s; stapelIdx = i; } } }

    // ── Zustand ──
    const x = new Float32Array(N), y = new Float32Array(N), ta = new Float32Array(N), sc = new Float32Array(N), nah = new Float32Array(N);
    let W = 0, H = 0, dpr = 1, mitte = [], oben = [], hoehen = [], max = 1, winkel = -.35, neigung = 0, letzteZeit = 0, bild = 0, an = false;
    let scheibeRect = null, stapelZustand = -1, chipsAn = false;

    function vermessen() {
      ({ W, H, dpr } = leinwand(canvas, buehne));
      oben = kapitel.map(k => k.offsetTop); hoehen = kapitel.map(k => k.offsetHeight);
      mitte = kapitel.map((k, i) => oben[i] + hoehen[i] / 2 - innerHeight / 2);
      max = Math.max(1, odyssee.offsetHeight - innerHeight);
    }
    vermessen();
    addEventListener('resize', () => { vermessen(); scheibeRect = null; }, { passive: true });

    // Zielposition je Kapitel: rechts der Text-Spalte (Desktop) bzw. im oberen Drittel (Handy).
    const grund = () => handy ? { cx: W * .5, cy: H * .30, R: Math.min(W * .34, H * .19) } : { cx: W * .70, cy: H * .5, R: Math.min(H * .36, W * .19) };

    function zeichne(t) {
      const dt = letzteZeit ? Math.min(48, t - letzteZeit) : 16; letzteZeit = t; bild++;
      const r = odyssee.getBoundingClientRect();
      if (r.bottom < -80 || r.top > innerHeight + 80) return;         // weit weg: nichts tun
      const S = clamp(-r.top, 0, max), vh = innerHeight;
      const br = buehne.getBoundingClientRect();

      // Kontinuierlicher Kapitelindex f ∈ [0, 4] mit ruhigen Fenstern um jede Kapitelmitte.
      let f = 0;
      for (let i = 0; i < kapitel.length - 1; i++) {
        if (S >= mitte[i + 1]) { f = i + 1; continue; }
        if (S > mitte[i]) { f = i + spanne((S - mitte[i]) / (mitte[i + 1] - mitte[i]), .22, .78); }
        break;
      }
      const wZwei = hut(f, 1), wChaos = hut(f, 2), wZahl = hut(f, 3), wJarvis = spanne(f, 3.25, 3.95);
      const letzte = kapitel.length - 1, u4 = clamp((S - oben[letzte]) / Math.max(1, hoehen[letzte] - vh), 0, 1);
      const ausblenden = 1 - spanne(S, max - vh * .22, max);   // erst ganz am Ende der Bühne, damit das grüne „Freigegeben“ voll steht
      const herz = ruhig ? .5 : .5 + .5 * Math.sin(t * .0022);

      // Mittelpunkt und Radius — in Kapitel 3 sitzt das Netz hinter der Score-Scheibe.
      let { cx, cy, R } = grund();
      if (wZahl > 0 && scheibe) {
        if (!scheibeRect || (bild & 3) === 0) scheibeRect = scheibe.getBoundingClientRect();
        const zx = scheibeRect.left - br.left + scheibeRect.width / 2, zy = scheibeRect.top - br.top + scheibeRect.height / 2, zR = Math.min(scheibeRect.height * .5, scheibeRect.width * .36);
        cx = lerp(cx, zx, wZahl); cy = lerp(cy, zy, wZahl); R = lerp(R, zR, wZahl);
      }
      // Zwei Leben: die Hälften weichen auseinander — das Ganze rückt dafür etwas nach links, damit rechts nichts abreißt.
      const spalt = R * .5 * wZwei;
      if (!handy) cx -= R * .22 * wZwei + R * .3 * wChaos;
      else cy -= H * .02 * wChaos;
      const hx = handy ? W * .32 : R * 1.22, hy = handy ? H * .16 : R * 1.12, rC = handy ? R * .3 : R * .27;

      // Drehung: langsam von selbst, dazu eine Neigung zum Zeiger hin.
      if (!ruhig) winkel += dt * .00011;
      const zx = zeiger.x - br.left, zy = zeiger.y - br.top;
      const zielNeigung = zeiger.an && !ruhig ? clamp((zy - cy) / H, -.5, .5) * .5 : 0;
      neigung += (zielNeigung - neigung) * .04;
      const cosA = Math.cos(winkel), sinA = Math.sin(winkel), cosB = Math.cos(neigung), sinB = Math.sin(neigung);
      const k = ruhig ? 1 : .1, RM = handy ? 90 : 150, RM2 = RM * RM;
      const drift = ruhig ? 0 : 1;

      for (let i = 0; i < N; i++) {
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        const x1 = px * cosA + pz * sinA, z1 = -px * sinA + pz * cosA;
        const y1 = py * cosB - z1 * sinB, z2 = py * sinB + z1 * cosB;
        const persp = 1 / (1 + z2 * .28);
        sc[i] = clamp(.35 + .65 * (1 - (z2 + 1) / 2), .2, 1);            // vorn groß, hinten klein
        ta[i] = .32 + .68 * sc[i];
        let bx = cx + (x1 * R + (seite[i] ? spalt : -spalt)) * persp, by = cy + y1 * R * persp;
        if (wChaos > 0) {
          const h = HAUFEN[haufen[i]];
          const qx = cx + h[0] * hx + off[i * 2] * rC, qy = cy + h[1] * hy + off[i * 2 + 1] * rC;
          bx = lerp(bx, qx, wChaos); by = lerp(by, qy, wChaos);
        }
        if (drift) { bx += Math.sin(t * .0011 + i * 1.7) * .9; by += Math.cos(t * .0009 + i * 2.3) * .9; }
        x[i] += (bx - x[i]) * k; y[i] += (by - y[i]) * k;
        // Zeiger: Knoten weichen aus, Verbindungen leuchten auf.
        let s = 0;
        if (zeiger.an) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2); s = 1 - d / RM; x[i] += dx / d * s * s * 14; y[i] += dy / d * s * s * 14; } }
        nah[i] = s;
      }

      // ── Zeichnen ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = ausblenden;
      // Kernschein: das Produkt in der Mitte — fehlt im Chaos.
      const schein = (1 - wChaos) * (.22 + .12 * herz) * (1 - wZwei * .6);
      if (schein > .01) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .95);
        g.addColorStop(0, `rgba(${F.tuerkis},${(schein * .9).toFixed(3)})`); g.addColorStop(.45, `rgba(${F.tuerkis},${(schein * .25).toFixed(3)})`); g.addColorStop(1, 'rgba(88,217,205,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }
      // Impulsfront (Jarvis): läuft vom Kern nach außen, getrieben vom Scrollen.
      const front = u4 * (maxHop + 3), stapelErreicht = wJarvis > .5 && front >= hop[stapelIdx] - .3;
      const wImpuls = wJarvis;
      const boost = i => wImpuls ? Math.exp(-((hop[i] - front) * (hop[i] - front)) / 1.6) * wImpuls : 0;
      // Kanten
      // Auf dem Weg ins Chaos werden die Brain-Kanten schnell kurz und blass — sonst gibt es Spaghetti.
      const langMax = R * (1.05 - .45 * wChaos), lang0 = R * (.55 - .3 * wChaos);
      const fGranat = mischen(F.granat, F.grau, wChaos), fSmaragd = mischen(F.smaragd, F.grau, wChaos), fTuerkis = mischen(F.tuerkis, F.grau, wChaos * .9);
      const kantenA = .46 * (1 - wChaos) * (1 - wChaos) * (1 - wZwei * .15);
      if (kantenA > .01) for (let e = 0; e < KB; e++) {
        const a = K_BRAIN[e * 2], b = K_BRAIN[e * 2 + 1];
        const dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy);
        if (d > langMax) continue;
        const nahMax = Math.max(nah[a], nah[b]), bo = Math.max(boost(a), boost(b));
        const grundA = kantenA * Math.min(ta[a], ta[b]) * (1 - clamp((d - lang0) / (langMax - lang0), 0, 1));
        const quer = seite[a] !== seite[b] || kern[a] || kern[b];
        eimer.linie(quer ? fTuerkis : seite[a] ? fSmaragd : fGranat, grundA * (quer ? 1.15 : .85), x[a], y[a], x[b], y[b], 1);
        if (nahMax > .05) eimer.linie(F.tuerkis, nahMax * .8, x[a], y[a], x[b], y[b], 1.2);
        if (bo > .06) eimer.linie(F.tuerkis, bo * .95, x[a], y[a], x[b], y[b], 1.6);
      }
      if (wChaos > .01) for (let e = 0; e < KC; e++) {
        const a = K_CHAOS[e * 2], b = K_CHAOS[e * 2 + 1];
        const dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy);
        if (d > rC * 2.2) continue;
        eimer.linie(F.grau, .5 * wChaos * (1 - d / (rC * 2.2)), x[a], y[a], x[b], y[b], 1);
      }
      // Knoten
      const rBasis = handy ? .95 : 1.1;
      for (let i = 0; i < N; i++) {
        const rr = (kern[i] ? 1.7 : 1.15 + 1.25 * sc[i]) * rBasis;
        const farbe = kern[i] ? fTuerkis : seite[i] ? fSmaragd : fGranat;
        eimer.punkt(farbe, ta[i] * (kern[i] ? .95 : .85) * (1 - wChaos * .35), x[i], y[i], rr);
        const bo = boost(i), s = nah[i];
        if (bo > .12) eimer.punkt(F.tuerkis, bo, x[i], y[i], rr + 2.4 * bo);
        else if (s > .1) eimer.punkt(F.tuerkis, s * .9, x[i], y[i], rr + 1.6 * s);
      }
      eimer.zeichnen();
      // Der Stapel-Knoten: gelb, solange er wartet — grün, wenn du freigegeben hast.
      const frei = u4 > .62;
      if (stapelErreicht) {
        const sx = x[stapelIdx], sy = y[stapelIdx], puls = ruhig ? .5 : .5 + .5 * Math.sin(t * .006);
        const fs = frei ? F.gruen : F.gelb;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 26 + 8 * puls);
        g.addColorStop(0, `rgba(${fs},.55)`); g.addColorStop(1, `rgba(${fs},0)`);
        ctx.fillStyle = g; ctx.fillRect(sx - 40, sy - 40, 80, 80);
        ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, TAU); ctx.fillStyle = `rgba(${fs},1)`; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, 9 + 5 * puls, 0, TAU); ctx.strokeStyle = `rgba(${fs},${(.6 - .4 * puls).toFixed(2)})`; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── DOM-Überlagerungen: Chips im Chaos, Stapel-Chip, Kapiteltexte ──
      const chipsSollen = wChaos > .04;
      if (chipsSollen !== chipsAn) { chipsAn = chipsSollen; chips.forEach(c => { c.style.visibility = chipsAn ? 'visible' : 'hidden'; }); }
      if (chipsAn) chips.forEach((c, j) => {
        const h = HAUFEN[j % 9]; const px = cx + h[0] * hx, py = cy + h[1] * hy + rC * 1.25;
        c.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,0)`; c.style.opacity = String(wChaos * ausblenden);
      });
      const z = stapelErreicht ? (frei ? 2 : 1) : 0;
      if (stapelChip) {
        if (z !== stapelZustand) {
          stapelZustand = z; stapelChip.classList.toggle('da', z > 0); stapelChip.classList.toggle('frei', z === 2);
          if (stapelText) stapelText.textContent = z === 2 ? 'Freigegeben — von dir.' : 'Wartet auf dein Ja';
        }
        if (z > 0) { const sx = x[stapelIdx], sy = y[stapelIdx]; const links = sx > W * .6; stapelChip.style.transform = `translate(${(sx + (links ? -18 : 18)).toFixed(1)}px,${(sy - 12).toFixed(1)}px) translate(${links ? '-100%' : '0'},-100%)`; stapelChip.style.opacity = String(ausblenden); }
      }
      if (!ruhig) inhalte.forEach((el, i) => {
        if (!el) return;
        const er = el.getBoundingClientRect(), d = er.top + er.height / 2 - vh / 2;   // Textmitte zur Bildmitte
        const op = i === 0 ? 1 - spanne(-d, vh * .12, vh * .45) : 1 - spanne(Math.abs(d), vh * .26, vh * .52);
        el.style.opacity = op.toFixed(3);
      });
      if (!an) { an = true; buehne.classList.add('an'); }
    }

    // Startlage: sofort in Form — kein Sprung aus (0,0).
    { const { cx, cy, R } = grund(); const cosA = Math.cos(winkel), sinA = Math.sin(winkel); for (let i = 0; i < N; i++) { const px = P[i * 3], pz = P[i * 3 + 2]; const x1 = px * cosA + pz * sinA, z1 = -px * sinA + pz * cosA; const persp = 1 / (1 + z1 * .28); x[i] = cx + x1 * R * persp; y[i] = cy + P[i * 3 + 1] * R * persp; } }

    if (ruhig) {
      // Ruhig: kein Dauerlauf. Ein Bild je Scroll-Stand, Übergänge springen.
      let angefordert = false;
      const einmal = () => { if (angefordert) return; angefordert = true; requestAnimationFrame(t => { angefordert = false; zeichne(t); }); };
      addEventListener('scroll', einmal, { passive: true }); addEventListener('resize', einmal); einmal();
    } else {
      const lauf = t => { if (!document.hidden) zeichne(t); requestAnimationFrame(lauf); };
      requestAnimationFrame(lauf);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. Die kleine Bühne: Granat + Smaragd → M
  // ═══════════════════════════════════════════════════════════════════════════════
  function kleineBuehne() {
    const canvas = document.getElementById('make-m'), buehne = canvas?.parentElement;
    if (!canvas || !buehne || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const eimer = new Eimer(ctx);
    const N = handy ? 170 : 340;
    // Das M aus Logo F: zwei Striche, die sich in der Fuge treffen (Raster 240).
    const STRICHE = [[[50, 176], [50, 72], [119, 141]], [[121, 141], [190, 72], [190, 176]]];
    const laenge = s => { let l = 0; for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); return l; };
    const punktAuf = (s, u) => { let rest = u * laenge(s); for (let i = 1; i < s.length; i++) { const l = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); if (rest <= l) { const t = rest / l; return [lerp(s[i - 1][0], s[i][0], t), lerp(s[i - 1][1], s[i][1], t), (s[i][0] - s[i - 1][0]) / l, (s[i][1] - s[i - 1][1]) / l]; } rest -= l; } return [...s[s.length - 1], 0, 1]; };
    const M = new Float32Array(N * 2), WOLKE = new Float32Array(N * 2), seite = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const s = i % 2; seite[i] = s;
      const [px, py, tx, ty] = punktAuf(STRICHE[s], (Math.floor(i / 2) + .5) / (N / 2) + (zufall() - .5) * .02);
      const quer = gauss() * 7.5;                                           // Strichdicke
      M[i * 2] = px - ty * quer; M[i * 2 + 1] = py + tx * quer;
      WOLKE[i * 2] = (s ? 178 : 62) + gauss() * 42; WOLKE[i * 2 + 1] = 118 + gauss() * 46;
    }
    const K = nachbarn(M, 2, 2, (i, j) => seite[i] === seite[j] || (Math.hypot(M[i * 2] - 120, M[i * 2 + 1] - 141) < 16 && Math.hypot(M[j * 2] - 120, M[j * 2 + 1] - 141) < 16));
    const KN = K.length / 2;
    const x = new Float32Array(N), y = new Float32Array(N), nah = new Float32Array(N);
    let W = 0, H = 0, dpr = 1, an = false, mix = 0, letzteZeit = 0;
    const abbilden = (vx, vy) => { const s = Math.min(W, H) / 240; return [(W - 240 * s) / 2 + vx * s, (H - 240 * s) / 2 + vy * s]; };
    for (let i = 0; i < N; i++) { const [px, py] = abbilden(WOLKE[i * 2], WOLKE[i * 2 + 1]); x[i] = px; y[i] = py; }

    function zeichne(t) {
      const dt = letzteZeit ? Math.min(48, t - letzteZeit) : 16; letzteZeit = t;
      const r = buehne.getBoundingClientRect();
      if (r.bottom < -40 || r.top > innerHeight + 40) return;
      if (!W) { ({ W, H, dpr } = leinwand(canvas, buehne)); for (let i = 0; i < N; i++) { const [px, py] = abbilden(WOLKE[i * 2], WOLKE[i * 2 + 1]); x[i] = px; y[i] = py; } }
      else ({ W, H, dpr } = leinwand(canvas, buehne));
      const ziel = spanne(innerHeight * .92 - r.top, 0, innerHeight * .5);  // formt sich, sobald es ins Bild kommt
      mix += (ziel - mix) * (ruhig ? 1 : .05);
      const s = Math.min(W, H) / 240, k = ruhig ? 1 : .09, RM = handy ? 60 : 90, RM2 = RM * RM;
      const zx = zeiger.x - r.left, zy = zeiger.y - r.top;
      for (let i = 0; i < N; i++) {
        const [wx, wy] = abbilden(WOLKE[i * 2], WOLKE[i * 2 + 1]), [mx, my] = abbilden(M[i * 2], M[i * 2 + 1]);
        let tx = lerp(wx, mx, mix), ty = lerp(wy, my, mix);
        if (!ruhig) { const treiben = (1 - mix) * 6 + 1.2; tx += Math.sin(t * .0009 + i * 1.9) * treiben; ty += Math.cos(t * .0011 + i * 2.7) * treiben; }
        x[i] += (tx - x[i]) * k; y[i] += (ty - y[i]) * k;
        let n = 0; if (zeiger.an && !ruhig) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2); n = 1 - d / RM; x[i] += dx / d * n * n * 10; y[i] += dy / d * n * n * 10; } }
        nah[i] = n;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const [fx, fy] = abbilden(120, 141), funke = spanne(mix, .82, 1) * (ruhig ? .8 : .7 + .3 * Math.sin(t * .0035));
      if (funke > .01) { const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 34 * s); g.addColorStop(0, `rgba(${F.tuerkis},${(funke * .7).toFixed(3)})`); g.addColorStop(1, 'rgba(88,217,205,0)'); ctx.fillStyle = g; ctx.fillRect(fx - 40 * s, fy - 40 * s, 80 * s, 80 * s); }
      const langMax = 26 * s * (1 + (1 - mix) * 1.4);
      for (let e = 0; e < KN; e++) {
        const a = K[e * 2], b = K[e * 2 + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy);
        if (d > langMax) continue;
        const quer = seite[a] !== seite[b], al = (.28 + .3 * mix) * (1 - d / langMax);
        eimer.linie(quer ? F.tuerkis : seite[a] ? F.smaragd : F.granat, al * (quer ? 1.3 : 1), x[a], y[a], x[b], y[b], 1);
        const nm = Math.max(nah[a], nah[b]); if (nm > .05) eimer.linie(F.tuerkis, nm * .8, x[a], y[a], x[b], y[b], 1.2);
      }
      for (let i = 0; i < N; i++) {
        const rr = (1.1 + .9 * mix) * (handy ? .95 : 1) + (Math.hypot(x[i] - fx, y[i] - fy) < 18 * s ? .6 * mix : 0);
        eimer.punkt(seite[i] ? F.smaragd : F.granat, .7 + .3 * mix, x[i], y[i], rr);
        if (nah[i] > .1) eimer.punkt(F.tuerkis, nah[i] * .9, x[i], y[i], rr + 1.4 * nah[i]);
      }
      eimer.zeichnen();
      if (funke > .05) { ctx.beginPath(); ctx.arc(fx, fy, 3.2 * s * .5 + 2, 0, TAU); ctx.fillStyle = `rgba(${F.tuerkis},${funke.toFixed(2)})`; ctx.fill(); }
      if (!an) { an = true; buehne.classList.add('an'); }
    }
    if (ruhig) {
      let angefordert = false;
      const einmal = () => { if (angefordert) return; angefordert = true; requestAnimationFrame(t => { angefordert = false; zeichne(t); }); };
      addEventListener('scroll', einmal, { passive: true }); addEventListener('resize', einmal); einmal();
    } else {
      const lauf = t => { if (!document.hidden) zeichne(t); requestAnimationFrame(lauf); };
      requestAnimationFrame(lauf);
    }
  }

  const start = () => { try { grosseBuehne(); } catch (e) { console.error('Brain:', e); } try { kleineBuehne(); } catch (e) { console.error('M:', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
