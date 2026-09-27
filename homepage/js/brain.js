// ─── MAKE OS Homepage — Die Bühne (27.09., fünfter Durchgang) ──────────────────
// Ein Netz aus Knoten und Verbindungen auf einem 2D-Canvas. Kein WebGL, keine
// Bibliothek, kein Kopieren: alles hier ist eigene Geometrie.
//
// Kevins Richtung im vierten Durchgang: kein Spektakel im Hero — oben steht die
// Score-Scheibe aus der Software. Die Bühne erzählt darunter in vier Kapiteln,
// ruhig und in der CI (dunkel, Türkis als Akzent, Orange für die Business-Sicht
// wie in der Software; Granat und Smaragd bleiben den Personen vorbehalten):
//   01 Zwei Welten   zwei Ringe — Privat (Türkis) und Business (Orange) — die
//                    sich überlappen; in der Schnittmenge der Konflikt um 19 Uhr
//   02 Sieben Apps   alles zerfällt in neun graue Haufen mit Chips („alles gut“)
//   03 Messbar       die Haufen finden sich zu EINEM Ring: der Index füllt sich
//                    in der Farbe der gewählten Sicht, die Zahl zählt hoch
//   04 Zoe hilft     der Ring wird zum Brain (die Helferin): ein Impuls läuft vom
//                    Kern nach außen, bleibt im Stapel stehen, wartet auf dein Ja
// Dazu die kleine Bühne im Founder-Abschnitt (Granat + Smaragd → M) und ein sehr
// leises Netz hinter der Score-Scheibe im Hero (≈10 % Deckkraft, aus bei reduced-motion).
// Jeder Lauf pausiert, sobald seine Bühne den Viewport verlässt (IntersectionObserver).
//
// Regeln: Bewegung folgt dem Scrollen, nie umgekehrt (kein Scrolljacking).
// prefers-reduced-motion → keine Dauerbewegung, nur der Zustand je Kapitel.
// Ohne Canvas bleibt das Standbild (SVG). Handy: weniger Knoten, Finger statt Maus.
(() => {
  'use strict';
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handy = matchMedia('(max-width: 820px)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const glatt = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const spanne = (v, a, b) => glatt((v - a) / (b - a));
  const hut = (f, m) => glatt(1 - Math.abs(f - m));            // Dach über einem Kapitel; Nachbarn ergänzen sich zu 1
  const lerp = (a, b, t) => a + (b - a) * t;

  // Fester Zufall: gleiche Geometrie bei jedem Laden — das Standbild passt zum Netz.
  let saat = 27092026;
  const zufall = () => { saat = (saat * 1664525 + 1013904223) >>> 0; return saat / 4294967296; };
  const gauss = () => (zufall() + zufall() + zufall() - 1.5) * 1.15;

  // Farben als "r,g,b" — alle aus der Software (ci.css) bzw. der MAKE-CI.
  const F = { tuerkis: '88,217,205', orange: '255,159,67', grau: '110,122,125', teal: '124,142,146', gelb: '255,201,60', gruen: '61,226,139', granat: '209,58,85', smaragd: '34,181,119' };
  const sicht = () => document.body.dataset.spur === 'business' ? 'business' : 'privat';

  // ── Eimer: gleiche Farbe + ähnliche Deckkraft = ein Pfad, ein Strich. ──────────
  // Hunderte Kanten werden so zu ~30 stroke()-Aufrufen — das trägt die 60 fps.
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

  // Ein Bild je Scroll-Stand (ruhig) oder Dauerlauf — der pausiert, wenn die Bühne nicht im Bild ist.
  function starten(zeichne, beobachtet) {
    if (ruhig) {
      let angefordert = false;
      const einmal = () => { if (angefordert) return; angefordert = true; requestAnimationFrame(t => { angefordert = false; zeichne(t); }); };
      addEventListener('scroll', einmal, { passive: true }); addEventListener('resize', einmal);
      document.addEventListener('spur', einmal); einmal();
      return;
    }
    let laeuft = false, raf = 0;
    const lauf = t => { if (!laeuft) return; if (!document.hidden) zeichne(t); raf = requestAnimationFrame(lauf); };
    const an = () => { if (laeuft) return; laeuft = true; raf = requestAnimationFrame(lauf); };
    const aus = () => { laeuft = false; cancelAnimationFrame(raf); };
    if (beobachtet && 'IntersectionObserver' in window) new IntersectionObserver(es => { es.some(e => e.isIntersecting) ? an() : aus(); }, { rootMargin: '160px 0px' }).observe(beobachtet);
    else an();
  }

  // Die Hirnform: Fibonacci-Kugel mit Streuung, zur Hirnform verzogen (breiter als hoch, Furche, Windungen) + Kernpunkte.
  function hirnPunkte(nOber, nKern) {
    const N = nOber + nKern, P = new Float32Array(N * 3), seite = new Uint8Array(N), kern = new Uint8Array(N), GOLD = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < nOber; i++) {
      const y0 = 1 - 2 * (i + .5) / nOber, r0 = Math.sqrt(1 - y0 * y0), phi = i * GOLD + (zufall() - .5) * .18;
      let x = r0 * Math.cos(phi), y = y0 + (zufall() - .5) * .04, z = r0 * Math.sin(phi);
      const theta = Math.acos(clamp(y, -1, 1));
      let rad = 1 + .04 * Math.sin(7 * phi) * Math.sin(6 * theta) + .022 * Math.sin(11 * phi + 1.3) * Math.cos(4 * theta);
      if (Math.abs(x) < .11 && y > -.35) rad *= .9;
      x *= rad * 1.02; y *= rad * .84; z *= rad * .92;
      if (y < -.55) y = -.55 - (y + .55) * .35;
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; seite[i] = x < 0 ? 0 : 1;
    }
    for (let i = nOber; i < N; i++) {
      const u = zufall() * 2 - 1, phi = zufall() * TAU, r0 = Math.sqrt(1 - u * u), rr = .18 + .3 * Math.cbrt(zufall());
      P[i * 3] = r0 * Math.cos(phi) * rr; P[i * 3 + 1] = u * rr * .8; P[i * 3 + 2] = r0 * Math.sin(phi) * rr;
      seite[i] = P[i * 3] < 0 ? 0 : 1; kern[i] = 1;
    }
    return { N, P, seite, kern };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. Die große Bühne: Zwei Welten → Sieben Apps → Messbar → Zoe hilft
  // ═══════════════════════════════════════════════════════════════════════════════
  function grosseBuehne() {
    const odyssee = document.querySelector('.odyssee'), buehne = odyssee?.querySelector('.buehne'), canvas = document.getElementById('brain');
    if (!odyssee || !buehne || !canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const kapitel = Array.from(odyssee.querySelectorAll(':scope > .kapitel'));
    const inhalte = kapitel.map(k => k.querySelector('.wrap'));
    const weltChips = Array.from(buehne.querySelectorAll('.welt-chip'));
    const chips = Array.from(buehne.querySelectorAll('.chip'));
    const ringZahl = buehne.querySelector('.ring-zahl'), ringZahlB = ringZahl?.querySelector('b');
    const stapelChip = buehne.querySelector('.stapel-chip'), stapelText = stapelChip?.querySelector('b');
    const eimer = new Eimer(ctx);
    const SCORE = { privat: 78, business: 64 };

    // ── Geometrie ──
    const N_OBER = handy ? 190 : 400, N_KERN = handy ? 30 : 64;
    const { N, P, seite, kern } = hirnPunkte(N_OBER, N_KERN);   // P: Einheitskoordinaten (3D); seite: Synapsen über die Furche
    const K_BRAIN = nachbarn(P, 3, 2), KB = K_BRAIN.length / 2;

    // Zwei Welten: jeder Knoten gehört zu einer Welt (0 privat, 1 business) und sitzt auf oder im Ring.
    const welt = new Uint8Array(N), wAng = new Float32Array(N), wRad = new Float32Array(N);
    for (let i = 0; i < N; i++) { welt[i] = i & 1; wAng[i] = zufall() * TAU; wRad[i] = zufall() < .78 ? 1 + gauss() * .045 : .25 + zufall() * .6; }
    const WPOS = new Float32Array(N * 2); for (let i = 0; i < N; i++) { WPOS[i * 2] = Math.cos(wAng[i]) * wRad[i]; WPOS[i * 2 + 1] = Math.sin(wAng[i]) * wRad[i]; }
    const K_WELT = nachbarn(WPOS, 2, 2, (i, j) => welt[i] === welt[j]), KW = K_WELT.length / 2;

    // Sieben Apps: neun Haufen.
    const HAUFEN = [[-.92, -.78], [.02, -.98], [.94, -.7], [-1, .04], [.04, .08], [1, .02], [-.86, .86], [.04, .98], [.9, .8]].map(([x, y]) => [x + (zufall() - .5) * .14, y + (zufall() - .5) * .14]);
    const haufen = new Uint8Array(N), off = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { haufen[i] = (i * 7 + seite[i] * 3) % 9; off[i * 2] = gauss() * .55; off[i * 2 + 1] = gauss() * .5; }
    const K_CHAOS = nachbarn(off, 2, 2, (i, j) => haufen[i] === haufen[j]), KC = K_CHAOS.length / 2;

    // Messbar: ein Ring. Winkel ab 12 Uhr im Uhrzeigersinn; Kernknoten liegen locker innen.
    const rAng = new Float32Array(N), rRad = new Float32Array(N);
    { const reihe = Array.from({ length: N }, (_, i) => i).sort((a, b) => wAng[a] - wAng[b]); reihe.forEach((i, k) => { rAng[i] = k / N * TAU; rRad[i] = kern[i] ? .2 + zufall() * .45 : 1 + gauss() * .03; }); }
    const K_RING = []; { const reihe = Array.from({ length: N }, (_, i) => i).filter(i => !kern[i]).sort((a, b) => rAng[a] - rAng[b]); for (let k = 0; k < reihe.length; k++) K_RING.push(reihe[k], reihe[(k + 1) % reihe.length]); }
    const KR = K_RING.length / 2;

    // Hops vom Kern nach außen (für den Impuls in Kapitel 04).
    const hop = new Int16Array(N).fill(-1); {
      const adj = Array.from({ length: N }, () => []);
      for (let e = 0; e < KB; e++) { const a = K_BRAIN[e * 2], b = K_BRAIN[e * 2 + 1]; adj[a].push(b); adj[b].push(a); }
      let start = N_OBER; for (let i = N_OBER; i < N; i++) if (Math.hypot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]) < Math.hypot(P[start * 3], P[start * 3 + 1], P[start * 3 + 2])) start = i;
      const q = [start]; hop[start] = 0;
      while (q.length) { const a = q.shift(); for (const b of adj[a]) if (hop[b] < 0) { hop[b] = hop[a] + 1; q.push(b); } }
      for (let i = 0; i < N; i++) if (hop[i] < 0) hop[i] = 12;
    }
    let maxHop = 0; for (let i = 0; i < N; i++) if (hop[i] > maxHop) maxHop = hop[i];
    let stapelIdx = 0; { let best = -1e9; for (let i = 0; i < N_OBER; i++) { const s = hop[i] * .6 + P[i * 3] * 3 - P[i * 3 + 1] * 2; if (seite[i] === 1 && s > best) { best = s; stapelIdx = i; } } }

    // ── Zustand ──
    const x = new Float32Array(N), y = new Float32Array(N), ta = new Float32Array(N), sc = new Float32Array(N), nah = new Float32Array(N);
    let W = 0, H = 0, dpr = 1, mitte = [], oben = [], hoehen = [], max = 1, winkel = -.35, neigung = 0, letzteZeit = 0, an = false;
    let stapelZustand = -1, stapelAlpha = 0, chipsAn = false, weltAn = false, ringAn = false, letzteZahl = -1;

    function vermessen() {
      ({ W, H, dpr } = leinwand(canvas, buehne));
      oben = kapitel.map(k => k.offsetTop); hoehen = kapitel.map(k => k.offsetHeight);
      mitte = kapitel.map((k, i) => oben[i] + hoehen[i] / 2 - innerHeight / 2);
      max = Math.max(1, odyssee.offsetHeight - innerHeight);
    }
    vermessen();
    addEventListener('resize', vermessen, { passive: true });
    const grund = () => handy ? { cx: W * .5, cy: H * .30, R: Math.min(W * .30, H * .17) } : { cx: W * .70, cy: H * .5, R: Math.min(H * .33, W * .18) };

    function zeichne(t) {
      const dt = letzteZeit ? Math.min(48, t - letzteZeit) : 16; letzteZeit = t;
      const r = odyssee.getBoundingClientRect();
      if (r.bottom < -80 || r.top > innerHeight + 80) return;
      const S = clamp(-r.top, 0, max), vh = innerHeight, br = buehne.getBoundingClientRect();
      const s = sicht(), fSicht = s === 'business' ? F.orange : F.tuerkis, score = SCORE[s];

      // Kontinuierlicher Kapitelindex f ∈ [0, 3] mit ruhigen Fenstern um jede Kapitelmitte.
      let f = 0;
      for (let i = 0; i < kapitel.length - 1; i++) {
        if (S >= mitte[i + 1]) { f = i + 1; continue; }
        if (S > mitte[i]) f = i + spanne((S - mitte[i]) / (mitte[i + 1] - mitte[i]), .22, .78);
        break;
      }
      const wWelt = hut(f, 0), wChaos = hut(f, 1), wRing = hut(f, 2), wBrain = hut(f, 3);
      const wZoe = spanne(f, 2.3, 2.95);
      const letzte = kapitel.length - 1, u4 = clamp((S - oben[letzte]) / Math.max(1, hoehen[letzte] - vh), 0, 1);
      const ausblenden = 1 - spanne(S, max - vh * .22, max);
      const herz = ruhig ? .5 : .5 + .5 * Math.sin(t * .0022);

      let { cx, cy, R } = grund();
      if (!handy) cx -= R * .3 * wChaos;
      const hx = handy ? W * .32 : R * 1.22, hy = handy ? H * .16 : R * 1.12, rC = handy ? R * .3 : R * .27;
      if (handy) cy -= H * .02 * wChaos;
      const wAbst = R * .5, wR = R * .72;                     // Zwei Welten: Ringmitten ±wAbst, Radius wR

      if (!ruhig) winkel += dt * .00007;
      const zx = zeiger.x - br.left, zy = zeiger.y - br.top;
      const zielNeigung = zeiger.an && !ruhig ? clamp((zy - cy) / H, -.5, .5) * .4 : 0;
      neigung += (zielNeigung - neigung) * .04;
      const cosA = Math.cos(winkel), sinA = Math.sin(winkel), cosB = Math.cos(neigung), sinB = Math.sin(neigung);
      const dreh = ruhig ? 0 : t * .00012;                  // die Welten drehen sich gegenläufig
      const k = ruhig ? 1 : .1, RM = handy ? 80 : 130, RM2 = RM * RM, drift = ruhig ? 0 : 1;
      const fuellung = wRing * score / 100;                 // Ringfüllung wächst mit dem Kapitel

      for (let i = 0; i < N; i++) {
        let tx = 0, ty = 0;
        if (wWelt > 0) {
          const a = wAng[i] + (welt[i] ? -dreh : dreh), mx = cx + (welt[i] ? wAbst : -wAbst);
          tx += wWelt * (mx + Math.cos(a) * wR * wRad[i]); ty += wWelt * (cy + Math.sin(a) * wR * wRad[i] * .92);
        }
        if (wChaos > 0) { const h = HAUFEN[haufen[i]]; tx += wChaos * (cx + h[0] * hx + off[i * 2] * rC); ty += wChaos * (cy + h[1] * hy + off[i * 2 + 1] * rC); }
        if (wRing > 0) { const a = rAng[i] - Math.PI / 2, rr = R * .8 * rRad[i]; tx += wRing * (cx + Math.cos(a) * rr); ty += wRing * (cy + Math.sin(a) * rr); }
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        const x1 = px * cosA + pz * sinA, z1 = -px * sinA + pz * cosA, y1 = py * cosB - z1 * sinB, z2 = py * sinB + z1 * cosB;
        const persp = 1 / (1 + z2 * .28);
        sc[i] = clamp(.35 + .65 * (1 - (z2 + 1) / 2), .2, 1); ta[i] = .32 + .68 * sc[i];
        if (wBrain > 0) { tx += wBrain * (cx + x1 * R * persp); ty += wBrain * (cy + y1 * R * persp); }
        if (drift) { tx += Math.sin(t * .0011 + i * 1.7) * .7; ty += Math.cos(t * .0009 + i * 2.3) * .7; }
        x[i] += (tx - x[i]) * k; y[i] += (ty - y[i]) * k;
        let n = 0;
        if (zeiger.an) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2); n = 1 - d / RM; x[i] += dx / d * n * n * 12; y[i] += dy / d * n * n * 12; } }
        nah[i] = n;
      }

      // ── Zeichnen ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = ausblenden;
      // Kernschein: im Ring in der Farbe der Sicht, im Brain türkis — nie im Chaos.
      const schein = (wRing * .5 + wBrain) * (.16 + .08 * herz);
      if (schein > .01) {
        const fk = wBrain > wRing ? F.tuerkis : fSicht;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .9);
        g.addColorStop(0, `rgba(${fk},${(schein * .8).toFixed(3)})`); g.addColorStop(.5, `rgba(${fk},${(schein * .2).toFixed(3)})`); g.addColorStop(1, `rgba(${fk},0)`);
        ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }
      // Impuls: die Front läuft mit dem Scrollen vom Kern nach außen (erreicht den Stapel bei ~40 % des Kapitels);
      // danach atmet das Netz mit einem leisen Dauer-Impuls weiter. Freigabe bei 55 %, Ausblenden erst ab ~75 %.
      const front = u4 * (maxHop + 3) * 2.4, stapelErreicht = wZoe > .5 && front >= hop[stapelIdx] - .3;
      const front2 = ruhig ? -99 : (t * .0035) % (maxHop + 8);
      const boost = i => { if (!wZoe) return 0; const d1 = hop[i] - front, d2 = hop[i] - front2; return Math.max(Math.exp(-d1 * d1 / 1.6), .45 * Math.exp(-d2 * d2 / 1.2) * spanne(u4, .35, .5)) * wZoe; };
      // Kanten je Form — auf dem Weg werden sie kurz und blass, sonst gibt es Spaghetti.
      const lensX = R * .22;
      if (wWelt > .01) for (let e = 0; e < KW; e++) {
        const a = K_WELT[e * 2], b = K_WELT[e * 2 + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy), dm = wR * .42;
        if (d > dm) continue;
        eimer.linie(welt[a] ? F.orange : F.tuerkis, .34 * wWelt * (1 - d / dm), x[a], y[a], x[b], y[b], 1);
      }
      if (wChaos > .01) for (let e = 0; e < KC; e++) {
        const a = K_CHAOS[e * 2], b = K_CHAOS[e * 2 + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy), dm = rC * 2.2;
        if (d > dm) continue;
        eimer.linie(F.grau, .45 * wChaos * (1 - d / dm), x[a], y[a], x[b], y[b], 1);
      }
      if (wRing > .01) for (let e = 0; e < KR; e++) {
        const a = K_RING[e * 2], b = K_RING[e * 2 + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy), dm = R * .35;
        if (d > dm) continue;
        const voll = rAng[a] / TAU < fuellung && rAng[b] / TAU < fuellung;
        eimer.linie(voll ? fSicht : F.grau, (voll ? .75 : .3) * wRing * (1 - d / dm), x[a], y[a], x[b], y[b], voll ? 2 : 1);
      }
      if (wBrain > .01) {
        const langMax = R * (1.05 - .4 * (1 - wBrain)), lang0 = R * .5, kantenA = .34 * wBrain * wBrain;
        for (let e = 0; e < KB; e++) {
          const a = K_BRAIN[e * 2], b = K_BRAIN[e * 2 + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy);
          if (d > langMax) continue;
          const quer = seite[a] !== seite[b] || kern[a] || kern[b], bo = Math.max(boost(a), boost(b)), nm = Math.max(nah[a], nah[b]);
          eimer.linie(quer ? F.tuerkis : F.teal, kantenA * Math.min(ta[a], ta[b]) * (1 - clamp((d - lang0) / (langMax - lang0), 0, 1)) * (quer ? 1.1 : .8), x[a], y[a], x[b], y[b], 1);
          if (nm > .05) eimer.linie(F.tuerkis, nm * .7, x[a], y[a], x[b], y[b], 1.2);
          if (bo > .06) eimer.linie(F.tuerkis, bo * .9, x[a], y[a], x[b], y[b], 1.6);
        }
      }
      // Knoten
      const rBasis = handy ? .95 : 1.05;
      for (let i = 0; i < N; i++) {
        let farbe, al, rr = 1.3 * rBasis;
        if (wBrain >= .5) { farbe = kern[i] ? F.tuerkis : F.teal; al = ta[i] * (kern[i] ? .9 : .7); rr = (kern[i] ? 1.6 : 1.05 + 1.15 * sc[i]) * rBasis; }
        else if (wRing >= .5) { const voll = rAng[i] / TAU < fuellung; farbe = kern[i] ? fSicht : voll ? fSicht : F.grau; al = kern[i] ? .45 + .2 * herz : voll ? .95 : .35; rr = (voll ? 1.7 : 1.2) * rBasis; }
        else if (wChaos >= .5) { farbe = F.grau; al = .6; rr = 1.25 * rBasis; }
        else {
          // Zwei Welten: in der Schnittmenge blinken die Knoten gelb — der Konflikt um 19 Uhr.
          const imLens = Math.abs(x[i] - cx) < lensX && Math.abs(y[i] - cy) < wR * .55;
          farbe = welt[i] ? F.orange : F.tuerkis; al = .55 + .3 * (wRad[i] > .9 ? 1 : .4); rr = 1.35 * rBasis;
          if (imLens) { const bl = ruhig ? .6 : .5 + .5 * Math.sin(t * .005 + i); farbe = F.gelb; al = .35 + .6 * bl; rr = (1.3 + .8 * bl) * rBasis; }
        }
        eimer.punkt(farbe, al, x[i], y[i], rr);
        const bo = boost(i), n = nah[i];
        if (bo > .12) eimer.punkt(F.tuerkis, bo, x[i], y[i], rr + 2.2 * bo);
        else if (n > .1) eimer.punkt(F.tuerkis, n * .8, x[i], y[i], rr + 1.4 * n);
      }
      eimer.zeichnen();
      // Der Stapel-Knoten: gelb, solange er wartet — grün, wenn du freigegeben hast.
      const frei = u4 > .55;
      if (stapelErreicht) {
        const sx = x[stapelIdx], sy = y[stapelIdx], puls = ruhig ? .5 : .5 + .5 * Math.sin(t * .006), fs = frei ? F.gruen : F.gelb;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 26 + 8 * puls);
        g.addColorStop(0, `rgba(${fs},.5)`); g.addColorStop(1, `rgba(${fs},0)`);
        ctx.fillStyle = g; ctx.fillRect(sx - 40, sy - 40, 80, 80);
        ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, TAU); ctx.fillStyle = `rgba(${fs},1)`; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, 9 + 5 * puls, 0, TAU); ctx.strokeStyle = `rgba(${fs},${(.6 - .4 * puls).toFixed(2)})`; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── DOM-Überlagerungen ──
      const setzeSichtbar = (els, soll, warAn) => { if (soll !== warAn) els.forEach(c => { c.style.visibility = soll ? 'visible' : 'hidden'; }); return soll; };
      // Chips und Zahl erscheinen erst, wenn ihr Kapitel überwiegt — so überlappen sich im Übergang nie zwei Sätze.
      const sichtbarAb = w => spanne(w, .5, .85);
      weltAn = setzeSichtbar(weltChips, wWelt > .5, weltAn);
      if (weltAn) weltChips.forEach(c => {
        const w = c.dataset.w; let px, py;
        if (handy) { if (w === 'a') { px = cx; py = cy - wR - 46; } else if (w === 'b') { px = cx; py = cy - wR - 16; } else { px = cx; py = cy - 13; } }
        else if (w === 'a') { px = cx - wAbst; py = cy + wR * .92 + 18; } else if (w === 'b') { px = cx + wAbst; py = cy + wR * .92 + 18; } else { px = cx; py = cy - wR * .62 - 30; }
        c.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,0)`; c.style.opacity = String(sichtbarAb(wWelt) * ausblenden);
      });
      chipsAn = setzeSichtbar(chips, wChaos > .5, chipsAn);
      if (chipsAn) chips.forEach((c, j) => { const h = HAUFEN[j % 9]; c.style.transform = `translate(${(cx + h[0] * hx).toFixed(1)}px,${(cy + h[1] * hy + rC * 1.25).toFixed(1)}px) translate(-50%,0)`; c.style.opacity = String(sichtbarAb(wChaos) * ausblenden); });
      ringAn = setzeSichtbar(ringZahl ? [ringZahl] : [], wRing > .5, ringAn);
      if (ringAn && ringZahl) {
        ringZahl.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) translate(-50%,-50%)`; ringZahl.style.opacity = String(sichtbarAb(wRing) * ausblenden);
        ringZahl.style.setProperty('--f', `rgb(${fSicht})`);
        const z = Math.round(fuellung * 100); if (z !== letzteZahl && ringZahlB) { letzteZahl = z; ringZahlB.textContent = String(z); }
      }
      const zst = stapelErreicht ? (frei ? 2 : 1) : 0;
      if (stapelChip) {
        if (zst !== stapelZustand) { stapelZustand = zst; stapelChip.classList.toggle('da', zst > 0); stapelChip.classList.toggle('frei', zst === 2); if (stapelText) stapelText.textContent = zst === 2 ? 'Freigegeben — von dir.' : 'Wartet auf dein Ja'; }
        if (zst > 0) {
          const sx = x[stapelIdx], sy = y[stapelIdx], cw = stapelChip.offsetWidth || 240, chh = stapelChip.offsetHeight || 80;
          const px = clamp(handy ? sx - cw / 2 : (sx > W * .6 ? sx - 18 - cw : sx + 18), 12, W - cw - 12), py = clamp(sy - 14 - chh, 72, H - chh - 12);
          stapelAlpha += (1 - stapelAlpha) * (ruhig ? 1 : .12);   // Einblenden ohne CSS-Übergang — der Lauf trägt es
          stapelChip.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`; stapelChip.style.opacity = (stapelAlpha * ausblenden).toFixed(3);
        } else stapelAlpha = 0;
      }
      if (!ruhig) inhalte.forEach(el => {
        if (!el) return;
        const er = el.getBoundingClientRect(), d = er.top + er.height / 2 - vh / 2;
        el.style.opacity = (1 - spanne(Math.abs(d), vh * .26, vh * .52)).toFixed(3);
      });
      if (!an) { an = true; buehne.classList.add('an'); }
    }

    // Startlage: sofort in der ersten Form (zwei Welten) — kein Sprung aus (0,0).
    { const { cx, cy, R } = grund(); for (let i = 0; i < N; i++) { const mx = cx + (welt[i] ? R * .5 : -R * .5); x[i] = mx + Math.cos(wAng[i]) * R * .72 * wRad[i]; y[i] = cy + Math.sin(wAng[i]) * R * .72 * wRad[i] * .92; } }
    starten(zeichne, odyssee);
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
      const quer = gauss() * 7.5;
      M[i * 2] = px - ty * quer; M[i * 2 + 1] = py + tx * quer;
      WOLKE[i * 2] = (s ? 178 : 62) + gauss() * 42; WOLKE[i * 2 + 1] = 118 + gauss() * 46;
    }
    const K = nachbarn(M, 2, 2, (i, j) => seite[i] === seite[j] || (Math.hypot(M[i * 2] - 120, M[i * 2 + 1] - 141) < 16 && Math.hypot(M[j * 2] - 120, M[j * 2 + 1] - 141) < 16));
    const KN = K.length / 2;
    const x = new Float32Array(N), y = new Float32Array(N), nah = new Float32Array(N);
    let W = 0, H = 0, dpr = 1, an = false, mix = 0;
    const abbilden = (vx, vy) => { const s = Math.min(W, H) / 240; return [(W - 240 * s) / 2 + vx * s, (H - 240 * s) / 2 + vy * s]; };

    function zeichne(t) {
      const r = buehne.getBoundingClientRect();
      if (r.bottom < -40 || r.top > innerHeight + 40) return;
      const frisch = !W; ({ W, H, dpr } = leinwand(canvas, buehne));
      if (frisch) for (let i = 0; i < N; i++) { const [px, py] = abbilden(WOLKE[i * 2], WOLKE[i * 2 + 1]); x[i] = px; y[i] = py; }
      const ziel = spanne(innerHeight * .92 - r.top, 0, innerHeight * .5);
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
      if (funke > .05) { ctx.beginPath(); ctx.arc(fx, fy, 1.6 * s + 2, 0, TAU); ctx.fillStyle = `rgba(${F.tuerkis},${funke.toFixed(2)})`; ctx.fill(); }
      if (!an) { an = true; buehne.classList.add('an'); }
    }
    starten(zeichne, buehne);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. Das leise Netz im Hero: lebt hinter der Score-Scheibe, ≈10 % Deckkraft,
  //    dreht langsam, weicht der Maus schwach aus. Bei reduced-motion gar nicht erst da.
  // ═══════════════════════════════════════════════════════════════════════════════
  function heroNetz() {
    if (ruhig) return;
    const hero = document.querySelector('.hero'), canvas = document.getElementById('hero-netz'), scheibe = document.getElementById('score-app');
    if (!hero || !canvas || !scheibe || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const eimer = new Eimer(ctx);
    const { N, P, seite, kern } = hirnPunkte(handy ? 120 : 220, handy ? 16 : 30);
    const K = nachbarn(P, 3, 2), KN = K.length / 2;
    const x = new Float32Array(N), y = new Float32Array(N), ta = new Float32Array(N), sc = new Float32Array(N);
    let W = 0, H = 0, dpr = 1, winkel = .4, letzteZeit = 0, bild = 0, rect = null, an = false;
    function zeichne(t) {
      const dt = letzteZeit ? Math.min(48, t - letzteZeit) : 16; letzteZeit = t; bild++;
      ({ W, H, dpr } = leinwand(canvas, hero));
      const hr = hero.getBoundingClientRect();
      if (!rect || (bild & 7) === 0) rect = scheibe.getBoundingClientRect();
      const cx = rect.left - hr.left + rect.width / 2, cy = rect.top - hr.top + rect.height / 2, R = Math.max(rect.width, rect.height) * (handy ? .72 : .7);
      winkel += dt * .00005;
      const cosA = Math.cos(winkel), sinA = Math.sin(winkel);
      const zx = zeiger.x - hr.left, zy = zeiger.y - hr.top, RM = 160, RM2 = RM * RM;
      for (let i = 0; i < N; i++) {
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
        const x1 = px * cosA + pz * sinA, z1 = -px * sinA + pz * cosA, persp = 1 / (1 + z1 * .28);
        sc[i] = clamp(.35 + .65 * (1 - (z1 + 1) / 2), .2, 1); ta[i] = .32 + .68 * sc[i];
        let tx = cx + x1 * R * persp, ty = cy + py * R * persp;
        tx += Math.sin(t * .0007 + i * 1.7) * .8; ty += Math.cos(t * .0006 + i * 2.3) * .8;
        x[i] += (tx - x[i]) * .08; y[i] += (ty - y[i]) * .08;
        if (zeiger.an) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2), n = 1 - d / RM; x[i] += dx / d * n * n * 5; y[i] += dy / d * n * n * 5; } }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = .11;
      const langMax = R * 1.05, lang0 = R * .5;
      for (let e = 0; e < KN; e++) {
        const a = K[e * 2], b = K[e * 2 + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy);
        if (d > langMax) continue;
        const quer = seite[a] !== seite[b] || kern[a] || kern[b];
        eimer.linie(quer ? F.tuerkis : F.teal, .9 * Math.min(ta[a], ta[b]) * (1 - clamp((d - lang0) / (langMax - lang0), 0, 1)), x[a], y[a], x[b], y[b], 1);
      }
      for (let i = 0; i < N; i++) eimer.punkt(kern[i] ? F.tuerkis : F.teal, ta[i], x[i], y[i], kern[i] ? 1.8 : 1.1 + 1.2 * sc[i]);
      eimer.zeichnen();
      ctx.globalAlpha = 1;
      if (!an) { an = true; hero.classList.add('netz-an'); }
    }
    // Startlage: schon in Form.
    { const hr = hero.getBoundingClientRect(), r0 = scheibe.getBoundingClientRect(); const cx = r0.left - hr.left + r0.width / 2, cy = r0.top - hr.top + r0.height / 2, R = Math.max(r0.width, r0.height) * .7; for (let i = 0; i < N; i++) { x[i] = cx + P[i * 3] * R; y[i] = cy + P[i * 3 + 1] * R; } }
    starten(zeichne, hero);
  }

  const start = () => { try { grosseBuehne(); } catch (e) { console.error('Bühne:', e); } try { kleineBuehne(); } catch (e) { console.error('M:', e); } try { heroNetz(); } catch (e) { console.error('Hero-Netz:', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
