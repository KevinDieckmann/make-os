// ─── MAKE OS Homepage — Die Neuronen-Bühne (27.09., siebter Durchgang) ────────────
// Ein Netz aus Knoten und Verbindungen auf einem 2D-Canvas. Kein WebGL, keine
// Bibliothek. Die Geometrie kommt aus js/formationen.js — dieselbe Datei erzeugt
// in Node die Standbilder (standbild.mjs).
//
// Baustein: <section class="odyssee" data-formationen="a,b,c"> mit einer .buehne
// (sticky, 100 vh) und je Kapitel einem .kapitel. Die Bühne mischt die Formationen
// entlang des Scrollens (kontinuierlicher Kapitelindex mit ruhigen Fenstern um jede
// Kapitelmitte — Bewegung folgt dem Scrollen, nie umgekehrt). Je Seite eine andere
// Reihe von Formationen, so setzt sich die visuelle Story von Seite zu Seite fort.
//
// Besonderheiten je Formation (nur, wenn das Kapitel sie mitbringt):
//   welten  → .welt-chips (Konflikt um 19 Uhr)      chaos → .chips („alles gut“)
//   ring/score/index → .ring-zahl, Füllung = Score der Sicht
//   brain   → Impuls vom Kern nach außen (Breitensuche), .stapel-chip wartet auf das Ja
// Dazu: kleine Bühne #make-m (Granat + Smaragd → M) und das leise Netz im Hero (#hero-netz).
// prefers-reduced-motion: kein Dauerlauf, ein Bild je Scroll-Stand. Ohne Canvas bleibt
// das Standbild (SVG) stehen. Jeder Lauf pausiert, wenn seine Bühne den Viewport verlässt.
(() => {
  'use strict';
  const MF = globalThis.MakeFormationen; if (!MF) return;
  const F = MF.FARBEN;
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handy = matchMedia('(max-width: 820px)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const glatt = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const spanne = (v, a, b) => glatt((v - a) / (b - a));
  const hut = (f, m) => glatt(1 - Math.abs(f - m));
  const sicht = () => document.body.dataset.spur === 'business' ? 'business' : 'privat';
  const SCORE = { privat: 78, business: 64 };
  const farbe = (schluessel, s) => schluessel === 'sicht' ? (s === 'business' ? F.orange : F.tuerkis) : F[schluessel] || F.teal;

  // ── Eimer: gleiche Farbe + ähnliche Deckkraft = ein Pfad, ein Strich (trägt die 60 fps). ──
  class Eimer {
    constructor(ctx) { this.ctx = ctx; this.k = new Map(); }
    linie(farbe, a, x1, y1, x2, y2, breite = 1) { if (a < .015) return; a = Math.min(1, Math.round(a * 14) / 14); const key = 'l' + farbe + '|' + a + '|' + breite; let e = this.k.get(key); if (!e) { e = { art: 'l', farbe, a, breite, p: new Path2D() }; this.k.set(key, e); } e.p.moveTo(x1, y1); e.p.lineTo(x2, y2); }
    punkt(farbe, a, x, y, r) { if (a < .02 || r < .3) return; a = Math.min(1, Math.round(a * 10) / 10); const key = 'p' + farbe + '|' + a; let e = this.k.get(key); if (!e) { e = { art: 'p', farbe, a, p: new Path2D() }; this.k.set(key, e); } e.p.moveTo(x + r, y); e.p.arc(x, y, r, 0, TAU); }
    zeichnen() { const c = this.ctx; c.lineCap = 'round'; for (const e of this.k.values()) { if (e.art === 'l') { c.strokeStyle = `rgba(${e.farbe},${e.a})`; c.lineWidth = e.breite; c.stroke(e.p); } else { c.fillStyle = `rgba(${e.farbe},${e.a})`; c.fill(e.p); } } this.k.clear(); }
  }

  // ── Zeiger (Maus oder Finger) ──
  const zeiger = { x: -1e5, y: -1e5, an: false };
  if (!ruhig) {
    addEventListener('pointermove', e => { zeiger.x = e.clientX; zeiger.y = e.clientY; zeiger.an = true; }, { passive: true });
    addEventListener('pointerleave', () => { zeiger.an = false; }); addEventListener('pointercancel', () => { zeiger.an = false; });
    addEventListener('touchend', () => { setTimeout(() => { zeiger.an = false; }, 400); }, { passive: true });
  }

  function leinwand(canvas, el) { const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(devicePixelRatio || 1, handy ? 2 : 1.5); const bw = Math.round(W * dpr), bh = Math.round(H * dpr); if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; } return { W, H, dpr }; }

  // Ein Bild je Scroll-Stand (ruhig) oder Dauerlauf, der pausiert, wenn die Bühne nicht im Bild ist.
  function starten(zeichne, beobachtet) {
    if (ruhig) { let an = false; const einmal = () => { if (an) return; an = true; requestAnimationFrame(t => { an = false; zeichne(t); }); }; addEventListener('scroll', einmal, { passive: true }); addEventListener('resize', einmal); document.addEventListener('spur', einmal); einmal(); return; }
    let laeuft = false, raf = 0;
    const lauf = t => { if (!laeuft) return; if (!document.hidden) zeichne(t); raf = requestAnimationFrame(lauf); };
    const an = () => { if (laeuft) return; laeuft = true; raf = requestAnimationFrame(lauf); }, aus = () => { laeuft = false; cancelAnimationFrame(raf); };
    if (beobachtet && 'IntersectionObserver' in window) new IntersectionObserver(es => { es.some(e => e.isIntersecting) ? an() : aus(); }, { rootMargin: '160px 0px' }).observe(beobachtet); else an();
  }

  // Hops vom Kern nach außen (für den Impuls im Brain).
  function hops(form, N) {
    const hop = new Int16Array(N).fill(-1), adj = Array.from({ length: N }, () => []), K = form.kanten;
    for (let e = 0; e < K.length; e += 2) { adj[K[e]].push(K[e + 1]); adj[K[e + 1]].push(K[e]); }
    let start = 0, best = 1e9; for (let i = 0; i < N; i++) if (form.gruppe[i] === 2) { const d = Math.hypot(form.pos[i * 3], form.pos[i * 3 + 1], form.pos[i * 3 + 2]); if (d < best) { best = d; start = i; } }
    const q = [start]; hop[start] = 0; while (q.length) { const a = q.shift(); for (const b of adj[a]) if (hop[b] < 0) { hop[b] = hop[a] + 1; q.push(b); } }
    let max = 0; for (let i = 0; i < N; i++) { if (hop[i] < 0) hop[i] = 12; if (hop[i] > max) max = hop[i]; }
    let stapel = 0, sb = -1e9; for (let i = 0; i < N; i++) if (form.gruppe[i] === 1) { const s = hop[i] * .6 + form.pos[i * 3] * 3 - form.pos[i * 3 + 1] * 2; if (s > sb) { sb = s; stapel = i; } }
    return { hop, max, stapel };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Die große Bühne — generisch über data-formationen
  // ═══════════════════════════════════════════════════════════════════════════════
  function grosseBuehne(odyssee) {
    const buehne = odyssee.querySelector('.buehne'), canvas = buehne?.querySelector('canvas');
    if (!buehne || !canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const namen = (odyssee.dataset.formationen || 'brain').split(',').map(s => s.trim()).filter(Boolean);
    const kapitel = Array.from(odyssee.querySelectorAll(':scope > .kapitel'));
    const inhalte = kapitel.map(k => k.querySelector('.wrap'));
    const N = handy ? 220 : 464;
    const formen = namen.map((n, i) => MF.bauen(n, N, 27092026 + i * 7));
    const eimer = new Eimer(ctx);
    // Überlagerungen aus dem DOM (nur vorhanden, wenn die Seite sie braucht)
    const weltChips = Array.from(buehne.querySelectorAll('.welt-chip')), chips = Array.from(buehne.querySelectorAll('.chip'));
    const ringZahl = buehne.querySelector('.ring-zahl'), ringZahlB = ringZahl?.querySelector('b');
    const stapelChip = buehne.querySelector('.stapel-chip'), stapelText = stapelChip?.querySelector('b');
    const brainIdx = formen.findIndex(f => f.name === 'brain'), brainForm = brainIdx >= 0 ? formen[brainIdx] : null;
    const impuls = brainForm && stapelChip && brainIdx === kapitel.length - 1 ? hops(brainForm, N) : null;
    const stapelIdxForm = formen.findIndex(fm => fm.name === 'stapel');
    let stapelKnoten = -1; if (stapelIdxForm >= 0) { const fm = formen[stapelIdxForm]; let best = -1e9; for (let i = 0; i < N; i++) if (fm.gruppe[i] === 1 && fm.pos[i * 2] > best) { best = fm.pos[i * 2]; stapelKnoten = i; } }

    const x = new Float32Array(N), y = new Float32Array(N), sc = new Float32Array(N), nah = new Float32Array(N);
    let W = 0, H = 0, dpr = 1, mitte = [], oben = [], hoehen = [], max = 1, winkel = -.35, neigung = 0, letzteZeit = 0, an = false;
    let sichtbar = { welt: false, chips: false, ring: false }, stapelZustand = -1, stapelAlpha = 0, letzteZahl = -1; const impuls_ersatz = { stapel: 0 };

    function vermessen() { ({ W, H, dpr } = leinwand(canvas, buehne)); oben = kapitel.map(k => k.offsetTop); hoehen = kapitel.map(k => k.offsetHeight); mitte = kapitel.map((k, i) => oben[i] + hoehen[i] / 2 - innerHeight / 2); max = Math.max(1, odyssee.offsetHeight - innerHeight); }
    vermessen(); addEventListener('resize', vermessen, { passive: true });
    const grund = () => handy ? { cx: W * .5, cy: H * .30, R: Math.min(W * .30, H * .17) } : { cx: W * .70, cy: H * .5, R: Math.min(H * .33, W * .18) };

    function zeichne(t) {
      const dt = letzteZeit ? Math.min(48, t - letzteZeit) : 16; letzteZeit = t;
      const r = odyssee.getBoundingClientRect(); if (r.bottom < -80 || r.top > innerHeight + 80) return;
      const S = clamp(-r.top, 0, max), vh = innerHeight, br = buehne.getBoundingClientRect();
      const s = sicht(), fS = farbe('sicht', s), score = SCORE[s];
      // Kapitelindex f ∈ [0, n−1]
      let f = 0; for (let i = 0; i < kapitel.length - 1; i++) { if (S >= mitte[i + 1]) { f = i + 1; continue; } if (S > mitte[i]) f = i + spanne((S - mitte[i]) / (mitte[i + 1] - mitte[i]), .22, .78); break; }
      const w = formen.map((_, i) => hut(f, i)); let dom = 0; for (let i = 1; i < w.length; i++) if (w[i] > w[dom]) dom = i;
      const letzte = kapitel.length - 1, uLetzt = clamp((S - oben[letzte]) / Math.max(1, hoehen[letzte] - vh), 0, 1);
      const ausblenden = 1 - spanne(S, max - vh * .22, max);
      const herz = ruhig ? .5 : .5 + .5 * Math.sin(t * .0022);
      let { cx, cy, R } = grund();
      const wChaos = formen[1]?.name === 'chaos' ? w[1] : 0; if (!handy) cx -= R * .3 * wChaos;
      if (!ruhig) winkel += dt * .00007;
      const zx = zeiger.x - br.left, zy = zeiger.y - br.top;
      neigung += ((zeiger.an && !ruhig ? clamp((zy - cy) / H, -.5, .5) * .4 : 0) - neigung) * .04;
      const cA = Math.cos(winkel), sA = Math.sin(winkel), cB = Math.cos(neigung), sB = Math.sin(neigung);
      const dreh = ruhig ? 0 : t * .00012, k = ruhig ? 1 : .1, RM = handy ? 80 : 130, RM2 = RM * RM, drift = ruhig ? 0 : 1;
      const ringForm = formen.find(fm => fm.fuellen), wRing = ringForm ? w[formen.indexOf(ringForm)] : 0, fuellung = wRing * score / 100;

      for (let i = 0; i < N; i++) {
        let tx = 0, ty = 0; sc[i] = .8;
        for (let q = 0; q < formen.length; q++) {
          if (w[q] <= 0) continue; const fm = formen[q];
          if (fm.dreiD) {
            const px = fm.pos[i * 3], py = fm.pos[i * 3 + 1], pz = fm.pos[i * 3 + 2];
            const x1 = px * cA + pz * sA, z1 = -px * sA + pz * cA, y1 = py * cB - z1 * sB, z2 = py * sB + z1 * cB, persp = 1 / (1 + z2 * .28);
            sc[i] = clamp(.35 + .65 * (1 - (z2 + 1) / 2), .2, 1); tx += w[q] * (cx + x1 * R * persp); ty += w[q] * (cy + y1 * R * persp);
          } else if (fm.name === 'welten') {
            const a = fm.extra.ang[i] + (fm.gruppe[i] ? -dreh : dreh), mx = cx + (fm.gruppe[i] ? .5 : -.5) * R; tx += w[q] * (mx + Math.cos(a) * .72 * R * fm.extra.rad[i]); ty += w[q] * (cy + Math.sin(a) * .66 * R * fm.extra.rad[i]);
          } else { tx += w[q] * (cx + fm.pos[i * 2] * R); ty += w[q] * (cy + fm.pos[i * 2 + 1] * R); }
        }
        if (drift) { tx += Math.sin(t * .0011 + i * 1.7) * .7; ty += Math.cos(t * .0009 + i * 2.3) * .7; }
        x[i] += (tx - x[i]) * k; y[i] += (ty - y[i]) * k;
        let n = 0; if (zeiger.an) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2); n = 1 - d / RM; x[i] += dx / d * n * n * 12; y[i] += dy / d * n * n * 12; } }
        nah[i] = n;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalAlpha = ausblenden;
      // Kernschein: Brain türkis, gefüllter Ring in der Sichtfarbe, sonst leise in der Formfarbe
      const fd = formen[dom], scheinF = fd.dreiD ? F.tuerkis : fd.fuellen ? fS : (fd.name === 'chaos' || fd.name === 'trichter' ? null : farbe(fd.farben[fd.farben.length - 1], s));
      if (scheinF) { const a = (fd.dreiD ? 1 : .5) * (.16 + .08 * herz) * w[dom]; const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .9); g.addColorStop(0, `rgba(${scheinF},${(a * .8).toFixed(3)})`); g.addColorStop(.5, `rgba(${scheinF},${(a * .2).toFixed(3)})`); g.addColorStop(1, `rgba(${scheinF},0)`); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); }
      // Impuls (Brain + Stapel)
      let front = -99, wImp = 0, stapelErreicht = false, frei = false;
      if (impuls && brainIdx >= 0) { wImp = spanne(f, brainIdx - .7, brainIdx - .05); front = (brainIdx === letzte ? uLetzt : 1) * (impuls.max + 3) * 2.4; stapelErreicht = wImp > .5 && front >= impuls.hop[impuls.stapel] - .3; frei = brainIdx === letzte ? uLetzt > .55 : true; }
      const front2 = ruhig ? -99 : (t * .0035) % ((impuls?.max || 8) + 8);
      const boost = i => { if (!wImp) return 0; const d1 = impuls.hop[i] - front, d2 = impuls.hop[i] - front2; return Math.max(Math.exp(-d1 * d1 / 1.6), .45 * Math.exp(-d2 * d2 / 1.2) * spanne(uLetzt, .35, .5)) * wImp; };
      // Kanten je Formation
      for (let q = 0; q < formen.length; q++) {
        if (w[q] < .01) continue; const fm = formen[q], K = fm.kanten, dm = R * fm.reichweite * (fm.dreiD ? (1 - .4 * (1 - w[q])) : 1), lang0 = dm * .5;
        const A = (fm.dreiD ? .34 : fm.fuellen ? .3 : .38) * w[q] * w[q];
        for (let e = 0; e < K.length; e += 2) {
          const a = K[e], b = K[e + 1], dx = x[a] - x[b], dy = y[a] - y[b], d = Math.sqrt(dx * dx + dy * dy); if (d > dm) continue;
          const g = fm.gruppe[a]; let col = farbe(fm.farben[g], s), al = A * (1 - clamp((d - lang0) / (dm - lang0), 0, 1)), br2 = 1;
          if (fm.dreiD) { const quer = fm.gruppe[a] !== fm.gruppe[b] || fm.gruppe[a] === 2; col = quer ? F.tuerkis : F.teal; al *= Math.min(sc[a], sc[b]) * (quer ? 1.1 : .8); }
          else if (fm.fuellen) { const voll = fm.extra.ang[a] / TAU < fuellung && fm.extra.ang[b] / TAU < fuellung; col = voll ? fS : F.grau; al = (voll ? .75 : .3) * w[q] * (1 - d / dm); br2 = voll ? 2 : 1; }
          else if (fm.bruecken && fm.gruppe[a] !== fm.gruppe[b]) { col = F.tuerkis; al = .22 * w[q]; }
          else if (fm.name === 'chaos') al = .45 * w[q] * (1 - d / dm);
          eimer.linie(col, al, x[a], y[a], x[b], y[b], br2);
          const nm = Math.max(nah[a], nah[b]); if (nm > .05) eimer.linie(F.tuerkis, nm * .7 * w[q], x[a], y[a], x[b], y[b], 1.2);
          if (fm.dreiD) { const bo = Math.max(boost(a), boost(b)); if (bo > .06) eimer.linie(F.tuerkis, bo * .9, x[a], y[a], x[b], y[b], 1.6); }
        }
      }
      // Knoten (Farbe der dominanten Formation)
      const rB = handy ? .95 : 1.05;
      for (let i = 0; i < N; i++) {
        let col, al, rr;
        if (fd.dreiD) { const kern = fd.gruppe[i] === 2; col = kern ? F.tuerkis : F.teal; al = (.32 + .68 * sc[i]) * (kern ? .9 : .7); rr = (kern ? 1.6 : 1.05 + 1.15 * sc[i]) * rB; }
        else if (fd.fuellen) { const kern = fd.gruppe[i] === 1, voll = fd.extra.ang[i] / TAU < fuellung; col = kern || voll ? fS : F.grau; al = kern ? .45 + .2 * herz : voll ? .95 : .35; rr = (voll ? 1.7 : 1.2) * rB; }
        else if (fd.name === 'welten') { const imLens = Math.abs(x[i] - cx) < R * .22 && Math.abs(y[i] - cy) < R * .4; col = farbe(fd.farben[fd.gruppe[i]], s); al = .55 + .3 * (fd.extra.rad[i] > .9 ? 1 : .4); rr = 1.35 * rB; if (imLens) { const bl = ruhig ? .6 : .5 + .5 * Math.sin(t * .005 + i); col = F.gelb; al = .35 + .6 * bl; rr = (1.3 + .8 * bl) * rB; } }
        else if (fd.name === 'stapel') { const wartet = fd.gruppe[i] === 1, bl = ruhig ? .6 : .5 + .5 * Math.sin(t * .004 + i * .3); col = farbe(fd.farben[fd.gruppe[i]], s); al = wartet ? .5 + .45 * bl : .6; rr = (wartet ? 1.5 + .5 * bl : 1.25) * rB; }
        else { col = farbe(fd.farben[fd.gruppe[i]], s); al = fd.name === 'chaos' ? .6 : .75; rr = (fd.name === 'chaos' ? 1.25 : 1.4) * rB; if (fd.name === 'heads' && fd.gruppe[i] === 5) { al = .5 + .3 * herz; } }
        eimer.punkt(col, al, x[i], y[i], rr);
        const bo = fd.dreiD ? boost(i) : 0, n = nah[i];
        if (bo > .12) eimer.punkt(F.tuerkis, bo, x[i], y[i], rr + 2.2 * bo); else if (n > .1) eimer.punkt(F.tuerkis, n * .8, x[i], y[i], rr + 1.4 * n);
      }
      eimer.zeichnen();
      if (stapelErreicht) { const i = impuls.stapel, sx = x[i], sy = y[i], puls = ruhig ? .5 : .5 + .5 * Math.sin(t * .006), fs = frei ? F.gruen : F.gelb; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 26 + 8 * puls); g.addColorStop(0, `rgba(${fs},.5)`); g.addColorStop(1, `rgba(${fs},0)`); ctx.fillStyle = g; ctx.fillRect(sx - 40, sy - 40, 80, 80); ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, TAU); ctx.fillStyle = `rgba(${fs},1)`; ctx.fill(); ctx.beginPath(); ctx.arc(sx, sy, 9 + 5 * puls, 0, TAU); ctx.strokeStyle = `rgba(${fs},${(.6 - .4 * puls).toFixed(2)})`; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.globalAlpha = 1;

      // ── Überlagerungen (erst, wenn ihr Kapitel überwiegt) ──
      const zeige = (els, soll, key) => { if (soll !== sichtbar[key]) { sichtbar[key] = soll; els.forEach(c => { c.style.visibility = soll ? 'visible' : 'hidden'; }); } return soll; };
      const ab = wv => spanne(wv, .5, .85);
      const iW = formen.findIndex(fm => fm.name === 'welten'), iC = formen.findIndex(fm => fm.name === 'chaos'), iR = ringForm ? formen.indexOf(ringForm) : -1;
      if (weltChips.length && zeige(weltChips, iW >= 0 && w[iW] > .5, 'welt')) { const wR = R * .72, wA = R * .5; weltChips.forEach(c => { const v = c.dataset.w; let px, py; if (handy) { if (v === 'a') { px = cx; py = cy - wR - 46; } else if (v === 'b') { px = cx; py = cy - wR - 16; } else { px = cx; py = cy - 13; } } else if (v === 'a') { px = cx - wA; py = cy + wR * .92 + 18; } else if (v === 'b') { px = cx + wA; py = cy + wR * .92 + 18; } else { px = cx; py = cy - wR * .62 - 30; } c.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,0)`; c.style.opacity = String(ab(w[iW]) * ausblenden); }); }
      if (chips.length && zeige(chips, iC >= 0 && w[iC] > .5, 'chips')) { const hf = formen[iC].extra.haufen; chips.forEach((c, j) => { const h = hf[j % 9]; c.style.transform = `translate(${(cx + h[0] * 1.22 * R).toFixed(1)}px,${(cy + h[1] * 1.12 * R + R * .34).toFixed(1)}px) translate(-50%,0)`; c.style.opacity = String(ab(w[iC]) * ausblenden); }); }
      if (ringZahl && zeige([ringZahl], iR >= 0 && w[iR] > .5, 'ring')) { ringZahl.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px) translate(-50%,-50%)`; ringZahl.style.opacity = String(ab(w[iR]) * ausblenden); ringZahl.style.setProperty('--f', `rgb(${fS})`); const z = Math.round(fuellung * 100); if (z !== letzteZahl && ringZahlB) { letzteZahl = z; ringZahlB.textContent = String(z); } }
      if (stapelChip && !impuls && stapelKnoten >= 0) { const wS = w[stapelIdxForm]; stapelErreicht = wS > .5; frei = false; impuls_ersatz.stapel = stapelKnoten; }
      if (stapelChip) {
        const zst = stapelErreicht ? (frei ? 2 : 1) : 0;
        if (zst !== stapelZustand) { stapelZustand = zst; stapelChip.classList.toggle('da', zst > 0); stapelChip.classList.toggle('frei', zst === 2); if (stapelText) stapelText.textContent = zst === 2 ? 'Freigegeben — von dir.' : 'Wartet auf dein Ja'; }
        if (zst > 0) { const i = (impuls || impuls_ersatz).stapel, sx = x[i], sy = y[i], cw = stapelChip.offsetWidth || 240, chh = stapelChip.offsetHeight || 80; const px = clamp(handy ? sx - cw / 2 : (sx > W * .6 ? sx - 18 - cw : sx + 18), 12, W - cw - 12), py = clamp(sy - 14 - chh, 72, H - chh - 12); stapelAlpha += (1 - stapelAlpha) * (ruhig ? 1 : .12); stapelChip.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`; stapelChip.style.opacity = (stapelAlpha * ausblenden).toFixed(3); } else stapelAlpha = 0;
      }
      if (!ruhig) inhalte.forEach(el => { if (!el) return; const er = el.getBoundingClientRect(), d = er.top + er.height / 2 - vh / 2; el.style.opacity = (1 - spanne(Math.abs(d), vh * .26, vh * .52)).toFixed(3); });
      if (!an) { an = true; buehne.classList.add('an'); }
    }
    // Startlage: sofort in der ersten Form.
    { const { cx, cy, R } = grund(), fm = formen[0]; for (let i = 0; i < N; i++) { if (fm.dreiD) { x[i] = cx + fm.pos[i * 3] * R; y[i] = cy + fm.pos[i * 3 + 1] * R; } else { x[i] = cx + fm.pos[i * 2] * R; y[i] = cy + fm.pos[i * 2 + 1] * R; } } }
    starten(zeichne, odyssee);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Kleine Bühne: Granat + Smaragd → M (formt sich beim Einscrollen)
  // ═══════════════════════════════════════════════════════════════════════════════
  function kleineBuehne() {
    const canvas = document.getElementById('make-m'), buehne = canvas?.parentElement; if (!canvas || !buehne || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const eimer = new Eimer(ctx), N = handy ? 170 : 340, fm = MF.bauen('m', N, 27092026), z = MF.zufallsquelle(4711);
    const wolke = new Float32Array(N * 2); for (let i = 0; i < N; i++) { wolke[i * 2] = (fm.gruppe[i] === 1 ? .48 : -.48) + z.gauss() * .35; wolke[i * 2 + 1] = z.gauss() * .38; }
    const x = new Float32Array(N), y = new Float32Array(N), nah = new Float32Array(N); let W = 0, H = 0, dpr = 1, an = false, mix = 0;
    const ab = (vx, vy) => { const s = Math.min(W, H) / 2; return [W / 2 + vx * s, H / 2 + vy * s]; };
    function zeichne(t) {
      const r = buehne.getBoundingClientRect(); if (r.bottom < -40 || r.top > innerHeight + 40) return;
      const frisch = !W; ({ W, H, dpr } = leinwand(canvas, buehne)); if (frisch) for (let i = 0; i < N; i++) { const [px, py] = ab(wolke[i * 2], wolke[i * 2 + 1]); x[i] = px; y[i] = py; }
      mix += (spanne(innerHeight * .92 - r.top, 0, innerHeight * .5) - mix) * (ruhig ? 1 : .05);
      const s = Math.min(W, H) / 2, k = ruhig ? 1 : .09, RM = handy ? 60 : 90, RM2 = RM * RM, zx = zeiger.x - r.left, zy = zeiger.y - r.top;
      for (let i = 0; i < N; i++) { const [wx, wy] = ab(wolke[i * 2], wolke[i * 2 + 1]), [mx, my] = ab(fm.pos[i * 2], fm.pos[i * 2 + 1]); let tx = wx + (mx - wx) * mix, ty = wy + (my - wy) * mix; if (!ruhig) { const tr = (1 - mix) * 6 + 1.2; tx += Math.sin(t * .0009 + i * 1.9) * tr; ty += Math.cos(t * .0011 + i * 2.7) * tr; } x[i] += (tx - x[i]) * k; y[i] += (ty - y[i]) * k; let n = 0; if (zeiger.an && !ruhig) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2); n = 1 - d / RM; x[i] += dx / d * n * n * 10; y[i] += dy / d * n * n * 10; } } nah[i] = n; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const [fx, fy] = ab(0, (141 - 124) / 120 * .92), funke = spanne(mix, .82, 1) * (ruhig ? .8 : .7 + .3 * Math.sin(t * .0035));
      if (funke > .01) { const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, .28 * s); g.addColorStop(0, `rgba(${F.tuerkis},${(funke * .7).toFixed(3)})`); g.addColorStop(1, 'rgba(88,217,205,0)'); ctx.fillStyle = g; ctx.fillRect(fx - .33 * s, fy - .33 * s, .66 * s, .66 * s); }
      const dm = fm.reichweite * s * (1 + (1 - mix) * 1.4), K = fm.kanten;
      for (let e = 0; e < K.length; e += 2) { const a = K[e], b = K[e + 1], d = Math.hypot(x[a] - x[b], y[a] - y[b]); if (d > dm) continue; const quer = fm.gruppe[a] !== fm.gruppe[b] || fm.gruppe[a] === 2, al = (.28 + .3 * mix) * (1 - d / dm); eimer.linie(quer ? F.tuerkis : farbe(fm.farben[fm.gruppe[a]]), al * (quer ? 1.3 : 1), x[a], y[a], x[b], y[b], 1); const nm = Math.max(nah[a], nah[b]); if (nm > .05) eimer.linie(F.tuerkis, nm * .8, x[a], y[a], x[b], y[b], 1.2); }
      for (let i = 0; i < N; i++) { const rr = (1.1 + .9 * mix) * (handy ? .95 : 1) + (fm.gruppe[i] === 2 ? .6 * mix : 0); eimer.punkt(fm.gruppe[i] === 2 ? F.tuerkis : farbe(fm.farben[fm.gruppe[i]]), .7 + .3 * mix, x[i], y[i], rr); if (nah[i] > .1) eimer.punkt(F.tuerkis, nah[i] * .9, x[i], y[i], rr + 1.4 * nah[i]); }
      eimer.zeichnen();
      if (!an) { an = true; buehne.classList.add('an'); }
    }
    starten(zeichne, buehne);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // Das leise Netz hinter der Score-Scheibe im Hero (≈11 % Deckkraft; ohne reduced-motion)
  // ═══════════════════════════════════════════════════════════════════════════════
  function heroNetz() {
    if (ruhig) return;
    const hero = document.querySelector('.hero'), canvas = document.getElementById('hero-netz'), scheibe = document.getElementById('score-app'); if (!hero || !canvas || !scheibe || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const eimer = new Eimer(ctx), N = handy ? 136 : 250, fm = MF.bauen('brain', N, 1234567);
    const x = new Float32Array(N), y = new Float32Array(N), ta = new Float32Array(N), sc = new Float32Array(N); let W = 0, H = 0, dpr = 1, winkel = .4, letzteZeit = 0, bild = 0, rect = null, an = false;
    function zeichne(t) {
      const dt = letzteZeit ? Math.min(48, t - letzteZeit) : 16; letzteZeit = t; bild++;
      ({ W, H, dpr } = leinwand(canvas, hero)); const hr = hero.getBoundingClientRect(); if (!rect || (bild & 7) === 0) rect = scheibe.getBoundingClientRect();
      const cx = rect.left - hr.left + rect.width / 2, cy = rect.top - hr.top + rect.height / 2, R = Math.max(rect.width, rect.height) * (handy ? .72 : .7);
      winkel += dt * .00005; const cA = Math.cos(winkel), sA = Math.sin(winkel), zx = zeiger.x - hr.left, zy = zeiger.y - hr.top, RM = 160, RM2 = RM * RM;
      for (let i = 0; i < N; i++) { const px = fm.pos[i * 3], py = fm.pos[i * 3 + 1], pz = fm.pos[i * 3 + 2], x1 = px * cA + pz * sA, z1 = -px * sA + pz * cA, persp = 1 / (1 + z1 * .28); sc[i] = clamp(.35 + .65 * (1 - (z1 + 1) / 2), .2, 1); ta[i] = .32 + .68 * sc[i]; let tx = cx + x1 * R * persp + Math.sin(t * .0007 + i * 1.7) * .8, ty = cy + py * R * persp + Math.cos(t * .0006 + i * 2.3) * .8; x[i] += (tx - x[i]) * .08; y[i] += (ty - y[i]) * .08; if (zeiger.an) { const dx = x[i] - zx, dy = y[i] - zy, d2 = dx * dx + dy * dy; if (d2 < RM2 && d2 > .01) { const d = Math.sqrt(d2), n = 1 - d / RM; x[i] += dx / d * n * n * 5; y[i] += dy / d * n * n * 5; } } }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalAlpha = .11;
      const dm = R * 1.05, l0 = R * .5, K = fm.kanten;
      for (let e = 0; e < K.length; e += 2) { const a = K[e], b = K[e + 1], d = Math.hypot(x[a] - x[b], y[a] - y[b]); if (d > dm) continue; const quer = fm.gruppe[a] !== fm.gruppe[b] || fm.gruppe[a] === 2; eimer.linie(quer ? F.tuerkis : F.teal, .9 * Math.min(ta[a], ta[b]) * (1 - clamp((d - l0) / (dm - l0), 0, 1)), x[a], y[a], x[b], y[b], 1); }
      for (let i = 0; i < N; i++) eimer.punkt(fm.gruppe[i] === 2 ? F.tuerkis : F.teal, ta[i], x[i], y[i], fm.gruppe[i] === 2 ? 1.8 : 1.1 + 1.2 * sc[i]);
      eimer.zeichnen(); ctx.globalAlpha = 1; if (!an) { an = true; hero.classList.add('netz-an'); }
    }
    { const hr = hero.getBoundingClientRect(), r0 = scheibe.getBoundingClientRect(), cx = r0.left - hr.left + r0.width / 2, cy = r0.top - hr.top + r0.height / 2, R = Math.max(r0.width, r0.height) * .7; for (let i = 0; i < N; i++) { x[i] = cx + fm.pos[i * 3] * R; y[i] = cy + fm.pos[i * 3 + 1] * R; } }
    starten(zeichne, hero);
  }

  const start = () => { document.querySelectorAll('.odyssee').forEach(o => { try { grosseBuehne(o); } catch (e) { console.error('Bühne:', e); } }); try { kleineBuehne(); } catch (e) { console.error('M:', e); } try { heroNetz(); } catch (e) { console.error('Hero-Netz:', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
