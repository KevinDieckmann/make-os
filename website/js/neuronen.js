// MAKE Innovation · Landingpage: die Neuronen-Bühne (03.10.2026)
// Kevin 03.10.: „Unser Logo steht oben und verändert sich beim Scrollen … aus den Farben kommen Neuronen, und dann
// das nächste Bild verkaufen.“ Am Anfang steht das Logo (SVG, gestochen scharf). Beim Scrollen lösen sich die zwei
// Striche (Rot = Malin, Grün = Kevin) und die Buchstaben in Teilchen auf, die je Kapitel eine Formation bilden
// (js/formationen.js); im Kontakt fließt das Netz zurück ins Logo.
//
// Weiterentwickelt aus der Bühne der früheren Homepage (2D-Canvas, sticky Bühne, Formationen mischen entlang des
// Scrollens — die Bewegung folgt dem Scrollen, nie umgekehrt). Ruhig: dünne Linien, kein Glühen, langsame Drift.
//   · 60 fps: gleiche Farbe + Deckkraft = ein Pfad, ein Strich (Eimer). Der Lauf pausiert, wenn die Bühne nicht im
//     Bild oder der Tab verborgen ist.
//   · prefers-reduced-motion: keine Eigenbewegung — je Kapitel ein Standbild, neu gezeichnet nur beim Scrollen.
//   · Ohne Skript oder Canvas bleiben Logo und Standbild (SVG) stehen.
// Liest nichts aus, speichert nichts, sendet nichts (website/pruefen.mjs prüft das).
(() => {
  'use strict';
  const MF = globalThis.MakeFormationen; if (!MF) return;
  const reise = document.querySelector('.reise'); if (!reise) return;
  const buehne = reise.querySelector('.buehne'), canvas = buehne && buehne.querySelector('canvas'), zeichen = buehne && buehne.querySelector('svg.zeichen');
  if (!canvas || !canvas.getContext || !zeichen) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;

  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const handyAbfrage = matchMedia('(max-width: 1099px)');
  let handy = handyAbfrage.matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const glatt = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const spanne = (v, a, b) => glatt((v - a) / (b - a));

  const kapitel = Array.from(reise.querySelectorAll(':scope > .kapitel'));
  const namen = kapitel.map(k => k.dataset.formation || 'logo');
  const N = handy ? 210 : 380;
  const fam = MF.familien(N);
  const formen = namen.map((n, i) => n === 'logo' ? null : MF.bauen(n, N, 3102026 + i * 11));
  const FARBE = MF.FARBEN, DECKKRAFT = [.86, .86, .5, .82];

  // ── Das Logo als Formation: Teilchen genau auf den Strichen und Buchstaben des SVG (Einheiten der viewBox) ──
  function logoFormation() {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N);
    const rot = zeichen.querySelector('.strich-ma'), gruen = zeichen.querySelector('.strich-ke'), make = zeichen.querySelector('.make'), knoten = zeichen.querySelector('.knoten');
    const zahl = (el, a) => el ? parseFloat(el.getAttribute(a)) || 0 : 0;
    const linie = (el, idx, f) => {
      const x = zahl(el, 'x'), y = zahl(el, 'y') + zahl(el, 'height') / 2, b = zahl(el, 'width');
      idx.forEach((i, k) => { pos[i * 2] = x + (k + .5) / idx.length * b; pos[i * 2 + 1] = y; farbe[i] = f; });
    };
    const idx = f => { const r = []; for (let i = 0; i < N; i++) if (fam[i] === f) r.push(i); return r; };
    const r = idx(0), g = idx(1), t = idx(2);
    // Je drei Teilchen sitzen im Knoten (die Synapse), der Rest auf den Linien.
    let kx = 0, ky = 0;
    if (knoten) { const kb = knoten.getBBox(); kx = kb.x + kb.width / 2; ky = kb.y + kb.height / 2; }
    const imKnoten = knoten ? 3 : 0;
    linie(rot, r.slice(0, r.length - imKnoten), 0); linie(gruen, g.slice(imKnoten), 1);
    r.slice(r.length - imKnoten).forEach((i, k) => { pos[i * 2] = kx - 1.6 + k * .4; pos[i * 2 + 1] = ky + (k - 1) * 1.4; farbe[i] = 0; });
    g.slice(0, imKnoten).forEach((i, k) => { pos[i * 2] = kx + 1.6 - k * .4; pos[i * 2 + 1] = ky + (k - 1) * 1.4; farbe[i] = 1; });
    // Tinte: entlang der Umrisse von MAKE.
    if (make && make.getTotalLength) {
      const L = make.getTotalLength();
      t.forEach((i, k) => { const p = make.getPointAtLength((k + .5) / t.length * L); pos[i * 2] = p.x; pos[i * 2 + 1] = p.y; farbe[i] = 3; });
    }
    const gruppe = i => fam[i];
    return { pos, farbe, kanten: MF.nachbarn(pos, 2, (i, j) => gruppe(i) === gruppe(j)), reichweite: 26, logo: true };
  }
  const LOGO = logoFormation();
  namen.forEach((n, i) => { if (n === 'logo') formen[i] = LOGO; });

  // ── Eimer: gleiche Farbe + Deckkraft = ein Pfad ──
  const eimer = new Map();
  const schluessel = (rgb, a) => `${rgb[0] & 0xF8},${rgb[1] & 0xF8},${rgb[2] & 0xF8}|${Math.round(Math.min(1, a) * 16)}`;
  function linie(rgb, a, x1, y1, x2, y2) { if (a < .02) return; const k = 'l' + schluessel(rgb, a); let e = eimer.get(k); if (!e) { e = { l: true, k, p: new Path2D() }; eimer.set(k, e); } e.p.moveTo(x1, y1); e.p.lineTo(x2, y2); }
  function punkt(rgb, a, x, y, r) { if (a < .03 || r < .3) return; const k = 'p' + schluessel(rgb, a); let e = eimer.get(k); if (!e) { e = { l: false, k, p: new Path2D() }; eimer.set(k, e); } e.p.moveTo(x + r, y); e.p.arc(x, y, r, 0, TAU); }
  function ausschuetten() {
    ctx.lineCap = 'round'; ctx.lineWidth = 1;
    for (const e of eimer.values()) { const [rgb, a] = e.k.slice(1).split('|'); const farbe = `rgba(${rgb},${(+a / 16).toFixed(3)})`; if (e.l) { ctx.strokeStyle = farbe; ctx.stroke(e.p); } else { ctx.fillStyle = farbe; ctx.fill(e.p); } }
    eimer.clear();
  }

  // ── Vermessen ──
  let W = 0, H = 0, dpr = 1, oben = [], vh = 0, logoRahmen = { x: 0, y: 0, s: 1 }, kopf = 64;
  const vb = zeichen.viewBox && zeichen.viewBox.baseVal;
  function vermessen() {
    handy = handyAbfrage.matches;
    W = buehne.clientWidth; H = buehne.clientHeight; vh = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, handy ? 2 : 1.5);
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    oben = kapitel.map(k => k.offsetTop);
    const kopfEl = document.querySelector('.kopf'); kopf = kopfEl ? kopfEl.offsetHeight : 64;
    const br = buehne.getBoundingClientRect(), zr = zeichen.getBoundingClientRect();
    logoRahmen = { x: zr.left - br.left, y: zr.top - br.top, s: vb && vb.width ? zr.width / vb.width : 1 };
  }
  const mitte = () => handy
    ? { cx: W * .5, cy: kopf + (H - kopf) * .25, R: Math.min(W * .4, (H - kopf) * .19) }
    : { cx: W * .72, cy: kopf + (H - kopf) * .5, R: Math.min((H - kopf) * .33, W * .165) };

  // ── Zustand ──
  const x = new Float32Array(N), y = new Float32Array(N), farbe = new Float32Array(N * 3), deck = new Float32Array(N);
  let gestartet = false, letztesF = -1;

  /** Kapitelindex f: ganzzahlig, solange ein Kapitel die Bühne hat; der Wechsel läuft, während die Überschrift des
   *  nächsten Kapitels von unten bis auf gut ein Drittel der Höhe steigt. */
  function kapitelIndex() {
    const S = -reise.getBoundingClientRect().top;
    let f = 0;
    for (let i = 1; i < kapitel.length; i++) f += spanne(S, oben[i] - vh * .92, oben[i] - vh * .36);
    return f;
  }

  function zeichne(t) {
    const rr = reise.getBoundingClientRect(); if (rr.bottom < -40 || rr.top > innerHeight + 40) return;
    let f = kapitelIndex(); if (ruhig) f = Math.round(f);
    if (ruhig && f === letztesF && gestartet) return; letztesF = f;
    const w = formen.map((_, q) => Math.max(0, 1 - Math.abs(f - q)));
    const { cx, cy, R } = mitte(), L = logoRahmen;
    const k = ruhig || !gestartet ? 1 : .11, drift = ruhig ? 0 : 1;
    const dreh = ruhig ? 0 : t * .000035;
    const cD = Math.cos(dreh), sD = Math.sin(dreh);

    // Ziel, Farbe, Deckkraft je Teilchen: gewichtete Mischung der Formationen.
    for (let i = 0; i < N; i++) {
      let tx = 0, ty = 0, r = 0, g = 0, b = 0, a = 0, unruhe = 0;
      for (let q = 0; q < formen.length; q++) {
        const wq = w[q]; if (wq <= 0) continue; const fm = formen[q];
        let px = fm.pos[i * 2], py = fm.pos[i * 2 + 1];
        if (fm.logo) { px = L.x + px * L.s; py = L.y + py * L.s; }
        else { if (fm.drehen) { const qx = px * cD - py * sD; py = px * sD + py * cD; px = qx; } px = cx + px * R; py = cy + py * R; }
        tx += wq * px; ty += wq * py;
        const c = FARBE[fm.farbe[i]]; r += wq * c[0]; g += wq * c[1]; b += wq * c[2]; a += wq * DECKKRAFT[fm.farbe[i]];
        if (fm.unruhe) unruhe += wq;
      }
      if (drift) { const amp = .55 + unruhe * 1.6; tx += Math.sin(t * .0009 + i * 1.7) * amp; ty += Math.cos(t * .0007 + i * 2.3) * amp; }
      x[i] += (tx - x[i]) * k; y[i] += (ty - y[i]) * k;
      farbe[i * 3] = r; farbe[i * 3 + 1] = g; farbe[i * 3 + 2] = b; deck[i] = a;
    }

    // Logo und Teilchen überblenden: am Anfang (und am Ende) steht das SVG, dazwischen das Netz.
    const wLogo = Math.max(namen[0] === 'logo' ? w[0] : 0, namen[namen.length - 1] === 'logo' ? w[namen.length - 1] : 0);
    const logoSicht = spanne(wLogo, .45, .96), netzSicht = 1 - spanne(wLogo, .72, 1);
    const gedimmt = handy ? .4 + .6 * (namen[0] === 'logo' ? w[0] : 0) : 1;
    zeichen.style.opacity = (logoSicht * (handy && w[0] < .5 ? .16 : 1)).toFixed(3);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = netzSicht * gedimmt;
    if (ctx.globalAlpha > .01) {
      const rgb = [0, 0, 0], hol = i => { rgb[0] = farbe[i * 3]; rgb[1] = farbe[i * 3 + 1]; rgb[2] = farbe[i * 3 + 2]; return rgb; };
      // Kanten je Formation
      for (let q = 0; q < formen.length; q++) {
        const wq = w[q]; if (wq < .02) continue; const fm = formen[q], K = fm.kanten;
        const dm = fm.logo ? fm.reichweite * L.s : R * fm.reichweite, l0 = dm * .55, A = (fm.logo ? .55 : fm.name === 'kern' ? .17 : .32) * wq * wq;
        for (let e = 0; e < K.length; e += 2) {
          const i = K[e], j = K[e + 1], dx = x[i] - x[j], dy = y[i] - y[j], d = Math.sqrt(dx * dx + dy * dy); if (d > dm) continue;
          linie(hol(i), A * (1 - clamp((d - l0) / (dm - l0), 0, 1)) * Math.min(deck[i], deck[j]) / .86, x[i], y[i], x[j], y[j]);
        }
      }
      // Impuls (Kapitel Innovation): ein heller Puls läuft die zwei Stränge entlang, durch den Knoten, gemeinsam weiter.
      const qi = namen.indexOf('impuls'), wImp = qi >= 0 ? w[qi] : 0, u = qi >= 0 ? formen[qi].extra.u : null;
      const front = ruhig ? -9 : ((t * .00016) % 1.35) - .15;
      const rB = handy ? 1.05 : 1.15;
      for (let i = 0; i < N; i++) {
        punkt(hol(i), deck[i], x[i], y[i], rB * (farbe[i * 3] > 200 && farbe[i * 3 + 1] > 200 ? 1.25 : 1));
        if (wImp > .05) { const d = u[i] - front, bo = Math.exp(-d * d / .0016) * wImp; if (bo > .08) punkt(FARBE[3], bo * .85, x[i], y[i], rB + 1.4 * bo); }
      }
      ausschuetten();
    }
    ctx.globalAlpha = 1;
    if (!gestartet) { gestartet = true; buehne.classList.add('an'); }
  }

  // ── Start: Dauerlauf (pausiert außerhalb des Bildes) oder — bei reduzierter Bewegung — ein Bild je Scroll-Stand ──
  vermessen();
  addEventListener('resize', () => { vermessen(); letztesF = -1; einmal(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { vermessen(); letztesF = -1; einmal(); }).observe(reise);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { vermessen(); letztesF = -1; einmal(); });
  let wartet = false;
  function einmal() { if (wartet) return; wartet = true; requestAnimationFrame(t => { wartet = false; zeichne(t); }); }
  if (ruhig) { addEventListener('scroll', einmal, { passive: true }); einmal(); return; }
  let laeuft = false, raf = 0;
  const lauf = t => { if (!laeuft) return; if (!document.hidden) zeichne(t); raf = requestAnimationFrame(lauf); };
  const an = () => { if (laeuft) return; laeuft = true; raf = requestAnimationFrame(lauf); };
  const aus = () => { laeuft = false; cancelAnimationFrame(raf); };
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { es.some(e => e.isIntersecting) ? an() : aus(); }, { rootMargin: '120px 0px' }).observe(reise);
  else an();
})();
