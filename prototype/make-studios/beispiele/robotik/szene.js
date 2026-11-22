// Greifzelle Automation · Beispielseite. Die Szene „Die Zelle“: ein Roboterarm von oben, zwei Aufgaben, ein Takt in fünf Schritten.
// Alles ist eine gezeichnete Illustration. Es gibt keine Messwerte, keine Taktzeiten und keine Leistungsangaben.
// Ohne dieses Skript bleibt ein Standbild (medien/szene-poster.jpg) stehen und die Seite ist vollständig lesbar.

const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));
const weich = (t) => { t = klemme(t); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/* ─── Aufbau der Zelle (Zeichenwelt 900 × 600) ─── */
const BASIS = [430, 330], L1 = 165, L2 = 145;
const AUFNAHME = [215, 330], WARTE = [300, 425], ZIEL = [650, 175], BEHAELTER = [680, 482];
const BAND_ABSTAND = 130;
export const SCHRITTE = [
  { dauer: 0.9, palettieren: 'Greifen', maschine: 'Greifen' },
  { dauer: 0.5, palettieren: 'Heben', maschine: 'Heben' },
  { dauer: 1.6, palettieren: 'Fahren', maschine: 'Fahren' },
  { dauer: 0.7, palettieren: 'Ablegen', maschine: 'Einlegen' },
  { dauer: 1.3, palettieren: 'Zurück', maschine: 'Zurück' },
];
export const TAKT = SCHRITTE.reduce((s, x) => s + x.dauer, 0);
export const SATZ = {
  palettieren: [
    'Der Greifer fasst den Karton am Ende des Förderbands.',
    'Der Karton wird angehoben, bevor der Arm schwenkt.',
    'Der Arm fährt zum nächsten freien Platz auf der Palette.',
    'Der Karton wird abgesetzt, der Greifer öffnet.',
    'Der Arm fährt zurück, das Band bringt den nächsten Karton.',
  ],
  maschine: [
    'Der Greifer nimmt das Rohteil vom Förderband.',
    'Das Teil wird angehoben, bevor der Arm schwenkt.',
    'Der Arm fährt zur Maschine, die Tür steht offen.',
    'Das Teil liegt in der Spannvorrichtung, der Greifer öffnet.',
    'Die Tür schließt, die Maschine arbeitet. Fertige Teile landen im Behälter.',
  ],
};
const SLOTS = 12;
const slotPos = (s) => {
  const lage = Math.floor(s / 6), p = s % 6, sp = p % 3, zl = Math.floor(p / 3);
  return [ZIEL[0] + (sp - 1) * 66 - lage * 5, ZIEL[1] - 26 + zl * 52 - lage * 7, lage];
};

/* Wo ist der Takt: Zyklus, Schritt, Fortschritt im Schritt */
export function takt(tc) {
  const c = Math.floor(tc / TAKT); let r = tc - c * TAKT;
  for (let i = 0; i < SCHRITTE.length; i++) { if (r < SCHRITTE[i].dauer || i === SCHRITTE.length - 1) return { c, i, u: klemme(r / SCHRITTE[i].dauer), phase: (tc - c * TAKT) / TAKT }; r -= SCHRITTE[i].dauer; }
}
export const tcAus = (c, phase) => c * TAKT + phase * TAKT;

/* Der Arm: zwei Glieder, Ellbogen nach unten */
function arm(ziel) {
  let dx = ziel[0] - BASIS[0], dy = ziel[1] - BASIS[1], d = Math.hypot(dx, dy);
  const dm = klemme(d, 70, L1 + L2 - 3); if (d > 0) { dx *= dm / d; dy *= dm / d; d = dm; }
  const w = Math.atan2(dy, dx), a = Math.acos(klemme((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), t1 = w - a;
  const ell = [BASIS[0] + L1 * Math.cos(t1), BASIS[1] + L1 * Math.sin(t1)], ende = [BASIS[0] + dx, BASIS[1] + dy];
  return { ell, ende, w2: Math.atan2(ende[1] - ell[1], ende[0] - ell[0]) };
}

/* Lage des Greifers, Halteaufgabe, Öffnung */
function pose(tc, aufgabe) {
  const { c, i, u } = takt(tc), s = c % SLOTS;
  const ablage = aufgabe === 'palettieren' ? slotPos(s) : [ZIEL[0], ZIEL[1]];
  const e = weich(u);
  let pos, offen, trage = false, hub = 0;
  if (i === 0) { pos = [mix(WARTE[0], AUFNAHME[0], e), mix(WARTE[1], AUFNAHME[1], e)]; offen = u < 0.72 ? 1 : 1 - weich((u - 0.72) / 0.28); }
  else if (i === 1) { pos = AUFNAHME; offen = 0; trage = true; hub = e; }
  else if (i === 2) { pos = [mix(AUFNAHME[0], ablage[0], e), mix(AUFNAHME[1], ablage[1], e)]; offen = 0; trage = true; hub = 1; }
  else if (i === 3) { pos = ablage; trage = u < 0.55; offen = u < 0.55 ? 0 : weich((u - 0.55) / 0.3); hub = 1 - e; }
  else { pos = [mix(ablage[0], WARTE[0], e), mix(ablage[1], WARTE[1], e)]; offen = 1; }
  return { c, i, u, s, pos, offen, trage, hub, ablage };
}

/* Geschwindigkeit nach Abstand der Person zum Arm */
export const personPos = (h) => [585, mix(640, 410, weich(h))];
export function tempo(h) {
  if (h <= 0) return 1;
  const p = personPos(h), d = Math.hypot(p[0] - BASIS[0], p[1] - BASIS[1]);
  return klemme((d - 175) / (265 - 175));
}
export const tempoWort = (v) => (v > 0.95 ? 'volle Fahrt' : v > 0.04 ? 'verlangsamt' : 'Halt');

/* ─── Zeichnen ─── */
const STAHL = '#161B20', BODEN = '#1D242B', GELB = '#FFD100', HELL = '#E9ECEE', KARTON = '#D5AA6B';
export function szeneBauen(cv) {
  const ctx = cv.getContext('2d');
  let B = 0, H = 0, dpr = 1;
  const groesse = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    B = Math.max(2, Math.round(cv.clientWidth)); H = Math.max(2, Math.round(cv.clientHeight));
    cv.width = Math.round(B * dpr); cv.height = Math.round(H * dpr);
  };
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  function karton(x, y, w = 56, h = 40, s = 1, schatten = 0, hell = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (schatten) { ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(-w / 2 + schatten * 9, -h / 2 + schatten * 12, w, h, 4); ctx.fill(); }
    ctx.fillStyle = hell ? '#E2BE86' : KARTON; rr(-w / 2, -h / 2, w, h, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,15,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-4, -h / 2, 8, h);
    ctx.restore();
  }
  function teil(x, y, s = 1, schatten = 0, fertig = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (schatten) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(schatten * 9, schatten * 12, 22, 0, 7); ctx.fill(); }
    ctx.fillStyle = fertig ? '#C9D2D8' : '#7D8A93'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = BODEN; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
    if (fertig) { ctx.strokeStyle = GELB; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  function zeichnen({ tc = 0, aufgabe = 'palettieren', h = 0, t = 0 }) {
    const sc = Math.min(B / 900, H / 600), ox = (B - 900 * sc) / 2, oy = (H - 600 * sc) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = STAHL; ctx.fillRect(0, 0, B, H);
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);
    const P = pose(tc, aufgabe), pal = aufgabe === 'palettieren', v = tempo(h);
    // Boden mit Raster
    ctx.fillStyle = BODEN; ctx.fillRect(-ox / sc, -oy / sc, B / sc, H / sc);
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
    const x0 = Math.floor(-ox / sc / 50) * 50, y0 = Math.floor(-oy / sc / 50) * 50;
    for (let x = x0; x < (B - ox) / sc; x += 50) { ctx.beginPath(); ctx.moveTo(x, -oy / sc); ctx.lineTo(x, (H - oy) / sc); ctx.stroke(); }
    for (let y = y0; y < (H - oy) / sc; y += 50) { ctx.beginPath(); ctx.moveTo(-ox / sc, y); ctx.lineTo((B - ox) / sc, y); ctx.stroke(); }
    // Schutzbereiche
    const zone = (r, farbe, fuell) => { ctx.beginPath(); ctx.arc(BASIS[0], BASIS[1], r, 0, 7); ctx.fillStyle = fuell; ctx.fill(); ctx.setLineDash([10, 9]); ctx.strokeStyle = farbe; ctx.lineWidth = 2.2; ctx.stroke(); ctx.setLineDash([]); };
    zone(265, 'rgba(255,209,0,.55)', 'rgba(255,209,0,.045)'); zone(175, 'rgba(255,94,77,.7)', 'rgba(255,94,77,.07)');
    // Förderband
    ctx.fillStyle = '#2A323A'; ctx.fillRect(-60, 300, 330, 60); ctx.fillStyle = '#0F1317'; ctx.fillRect(-60, 304, 330, 52);
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
    const shift = P.i === 4 ? weich(P.u) * BAND_ABSTAND : 0;
    for (let x = -60 - (BAND_ABSTAND / 2) + (shift % 26); x < 270; x += 26) { ctx.beginPath(); ctx.moveTo(x, 304); ctx.lineTo(x, 356); ctx.stroke(); }
    ctx.fillStyle = GELB; ctx.fillRect(268, 296, 8, 68);
    for (let k = 0; k < 4; k++) {
      const x = AUFNAHME[0] - BAND_ABSTAND * k + shift;
      if (k === 0 && (P.i > 0 || P.u > 0.8) && P.i !== 4) continue;
      if (k === 0 && P.i === 4) continue;
      if (x < -20 || x > 262) continue;
      if (pal) karton(x, AUFNAHME[1]); else teil(x, AUFNAHME[1]);
    }
    // Ziel: Palette oder Maschine
    if (pal) {
      ctx.fillStyle = '#7C5A31'; rr(ZIEL[0] - 118, ZIEL[1] - 78, 236, 156, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(ZIEL[0] - 118, ZIEL[1] - 78 + k * 31); ctx.lineTo(ZIEL[0] + 118, ZIEL[1] - 78 + k * 31); ctx.stroke(); }
      const fertig = P.s + (P.i > 3 || (P.i === 3 && P.u >= 0.55) ? 1 : 0);
      for (let s = 0; s < Math.min(SLOTS, fertig); s++) { const q = slotPos(s); karton(q[0], q[1], 56, 40, 1, 0, q[2]); }
      // freie Plätze der Lage
      if (fertig < SLOTS) { const q = slotPos(P.s); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,209,0,.55)'; ctx.lineWidth = 2; rr(q[0] - 28, q[1] - 20, 56, 40, 4); ctx.stroke(); ctx.setLineDash([]); }
    } else {
      const aufT = P.i === 2 ? weich(P.u) : P.i === 3 ? 1 : P.i === 4 ? 1 - weich(clamp5(P.u)) : P.i === 0 ? 0 : 0;
      ctx.fillStyle = '#2E3841'; rr(ZIEL[0] - 120, ZIEL[1] - 90, 240, 180, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#0F1317'; rr(ZIEL[0] - 96, ZIEL[1] - 66, 192, 132, 6); ctx.fill();
      ctx.strokeStyle = GELB; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ZIEL[0], ZIEL[1], 30, 0, 7); ctx.moveTo(ZIEL[0] - 38, ZIEL[1]); ctx.lineTo(ZIEL[0] + 38, ZIEL[1]); ctx.moveTo(ZIEL[0], ZIEL[1] - 38); ctx.lineTo(ZIEL[0], ZIEL[1] + 38); ctx.stroke();
      const imBett = (P.i === 3 && P.u >= 0.55) || P.i === 4 || (P.i === 0 && P.u < 0.5 && P.c > 0);
      if (imBett) teil(ZIEL[0], ZIEL[1], 1, 0, P.i === 0 || P.i === 4 && P.u > 0.4);
      // Tür
      ctx.fillStyle = 'rgba(160,190,210,.28)'; rr(ZIEL[0] - 96 - aufT * 190, ZIEL[1] - 66, 192, 132, 6); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.6; ctx.stroke();
      const laeuft = (P.i === 4 && P.u > 0.55) || (P.i === 0) || (P.i === 1) || (P.i === 2 && P.u < 0.4);
      ctx.fillStyle = laeuft && (P.c > 0 || P.i === 4) ? '#3DDC84' : aufT > 0.1 ? GELB : '#566069'; ctx.beginPath(); ctx.arc(ZIEL[0] + 104, ZIEL[1] - 74, 8, 0, 7); ctx.fill();
      // Behälter für fertige Teile
      ctx.fillStyle = '#2A323A'; rr(BEHAELTER[0] - 70, BEHAELTER[1] - 48, 140, 96, 8); ctx.fill(); ctx.fillStyle = '#12171B'; rr(BEHAELTER[0] - 62, BEHAELTER[1] - 40, 124, 80, 5); ctx.fill();
      const n = P.c > 0 ? P.c - 1 + (P.i > 0 || P.u >= 0.5 ? 1 : 0) : 0;
      for (let k = 0; k < Math.min(n, 6); k++) teil(BEHAELTER[0] - 36 + (k % 3) * 36, BEHAELTER[1] - 16 + Math.floor(k / 3) * 34, 0.62, 0, true);
    }
    // Beschriftung
    const fs = Math.round(Math.max(13, 11 / sc)); ctx.fillStyle = 'rgba(233,236,238,.78)'; ctx.font = `500 ${fs}px "Red Hat Mono", ui-monospace, monospace`; ctx.textAlign = 'center';
    ctx.fillText('FÖRDERBAND', 110, 385); ctx.fillText(pal ? 'PALETTE' : 'MASCHINE', ZIEL[0], pal ? ZIEL[1] + 100 : ZIEL[1] + 112); if (!pal) ctx.fillText('FERTIGE TEILE', BEHAELTER[0], BEHAELTER[1] + 70);
    // Roboter
    const g = arm(P.pos), ell = g.ell, en = g.ende, w2 = g.w2;
    const glied = (a, b, breite, farbe) => { ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = breite + 4; ctx.beginPath(); ctx.moveTo(a[0] + 4, a[1] + 6); ctx.lineTo(b[0] + 4, b[1] + 6); ctx.stroke(); ctx.strokeStyle = farbe; ctx.lineWidth = breite; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = breite * 0.28; ctx.beginPath(); ctx.moveTo(a[0], a[1] - breite * 0.18); ctx.lineTo(b[0], b[1] - breite * 0.18); ctx.stroke(); };
    ctx.fillStyle = '#3A444D'; ctx.beginPath(); ctx.arc(BASIS[0], BASIS[1], 40, 0, 7); ctx.fill();
    const led = v > 0.95 ? '#3DDC84' : v > 0.04 ? GELB : '#FF5E4D';
    ctx.strokeStyle = led; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(BASIS[0], BASIS[1], 40, 0, 7); ctx.stroke();
    glied(BASIS, ell, 38, HELL); glied(ell, en, 30, '#D5DADD');
    for (const [pt, r] of [[BASIS, 22], [ell, 19], [en, 12]]) { ctx.fillStyle = GELB; ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke(); }
    // Greifer
    ctx.save(); ctx.translate(en[0], en[1]); ctx.rotate(w2);
    const spalt = 9 + P.offen * 13; ctx.fillStyle = '#2B333B';
    ctx.fillRect(4, -spalt - 5, 26, 6); ctx.fillRect(4, spalt - 1, 26, 6); ctx.fillRect(0, -spalt - 5, 6, spalt * 2 + 10);
    ctx.restore();
    // Getragenes Stück
    if (P.trage || (P.i === 3 && P.u < 0.55)) { const s = 1 + 0.16 * P.hub; if (pal) karton(en[0], en[1], 56, 40, s, P.hub); else teil(en[0], en[1], s, P.hub); }
    // Person
    if (h > 0.001) {
      const p = personPos(h);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(p[0] + 4, p[1] + 6, 24, 14, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7FB0FF'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 24, 13, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#FFD9B8'; ctx.beginPath(); ctx.arc(p[0], p[1] - 2, 10, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(233,236,238,.85)'; ctx.fillText('PERSON', p[0], p[1] + 20 + fs);
    }
    ctx.restore();
  }
  const clamp5 = (u) => klemme((u - 0.2) / 0.8);
  return { groesse, zeichnen };
}

/* ─── Auf der Seite ─── */
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const buehne = $('#zelle-canvas');
if (buehne) {
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const szene = szeneBauen(buehne);
  const el = { poster: $('.zelle-poster'), status: $('#zelle-status'), steuerung: $('#zelle-steuerung'), regler: $('#zelle-takt'), play: $('#zelle-play'), person: $('#zelle-person'), satz: $('#zelle-satz'), tempo: $('#zelle-tempo'), schritte: $$('#takt li'), zaehler: $('#zelle-zaehler') };
  const z = { tc: 0, aufgabe: 'palettieren', h: 0, hZiel: 0, spielt: false, sichtbar: true, v: 1, letzte: 0 };
  [el.status, el.steuerung].forEach((e) => { e.hidden = false; });
  document.documentElement.classList.add('szene-an');
  let zuletzt = '';
  const bild = (ms) => {
    szene.zeichnen({ tc: z.tc, aufgabe: z.aufgabe, h: z.h, t: ms / 1000 });
    const k = takt(z.tc), vz = tempo(z.h), w = tempoWort(vz);
    const sig = [k.i, z.aufgabe, w, k.c].join('|');
    if (sig !== zuletzt) {
      zuletzt = sig;
      el.schritte.forEach((li, i) => { li.textContent = SCHRITTE[i][z.aufgabe]; li.classList.toggle('jetzt', i === k.i); li.classList.toggle('fertig', i < k.i); if (i === k.i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      const person = vz < 0.95 ? ' Eine Person ist im Bereich: Der Arm wird langsamer und hält an, bevor sie ihn erreicht.' : '';
      el.satz.textContent = SATZ[z.aufgabe][k.i] + person;
      el.tempo.textContent = w; el.status.dataset.tempo = vz > 0.95 ? 'voll' : vz > 0.04 ? 'langsam' : 'halt';
      el.zaehler.textContent = String(k.c + (k.i === 4 ? 1 : 0));
    }
    el.regler.value = String(Math.round(k.phase * 1000));
  };
  const alleGroessen = () => { szene.groesse(); bild(performance.now()); };
  function lauf(ms) {
    requestAnimationFrame(lauf);
    const dt = Math.min(0.08, (ms - z.letzte) / 1000); z.letzte = ms;
    if (!z.sichtbar) return;
    if (Math.abs(z.h - z.hZiel) > 0.001) z.h += Math.sign(z.hZiel - z.h) * Math.min(Math.abs(z.hZiel - z.h), dt * 0.55);
    if (z.spielt) z.tc += dt * tempo(z.h);
    bild(ms);
  }
  const stopp = () => { z.spielt = false; el.play.setAttribute('aria-pressed', 'false'); };
  const start = () => { z.spielt = true; el.play.setAttribute('aria-pressed', 'true'); };
  el.play.addEventListener('click', () => { z.spielt ? stopp() : start(); });
  el.regler.addEventListener('input', () => { stopp(); const k = takt(z.tc); z.tc = tcAus(k.c, Number(el.regler.value) / 1000); if (reduziert) bild(0); });
  $$('.segment').forEach((k) => k.addEventListener('click', () => {
    z.aufgabe = k.dataset.aufgabe; z.tc = tcAus(0, 0);
    $$('.segment').forEach((x) => x.setAttribute('aria-pressed', String(x === k)));
    $('#zelle-canvas').setAttribute('data-aufgabe', z.aufgabe);
    zuletzt = ''; if (reduziert) bild(0);
  }));
  el.person.addEventListener('click', () => {
    const an = el.person.getAttribute('aria-pressed') !== 'true';
    el.person.setAttribute('aria-pressed', String(an)); z.hZiel = an ? 1 : 0;
    if (reduziert) { z.h = z.hZiel; bild(0); }
  });
  alleGroessen(); addEventListener('resize', alleGroessen);
  if ('ResizeObserver' in window) new ResizeObserver(alleGroessen).observe(buehne);
  document.fonts?.load('500 13px "Red Hat Mono"').then(() => bild(performance.now()));
  z.tc = tcAus(0, 0.2); bild(performance.now());
  if (!reduziert) {
    requestAnimationFrame(lauf);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { z.sichtbar = e.isIntersecting; }, { threshold: 0.05 }).observe(buehne);
      const an = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; an.disconnect(); z.tc = tcAus(0, 0); start(); }, { threshold: 0.55 }); an.observe(buehne);
    }
  }
  el.poster.classList.add('weg');
}

/* ─── Rechenhilfe: nur mit den Zahlen der Besucher ─── */
const rechner = $('#rechner-form');
if (rechner) {
  const feld = (id) => { const t = ($('#' + id).value || '').trim().replace(/\./g, '').replace(',', '.'); const n = Number(t); return t !== '' && Number.isFinite(n) && n >= 0 ? n : null; };
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const ausgabe = $('#rechner-ergebnis'), kopf = $('#rechner-kopf'), text = $('#rechner-text');
  const rechnen = () => {
    const inv = feld('r-invest'), std = feld('r-stunden'), satz = feld('r-satz'), lauf = feld('r-lauf') ?? 0;
    if (inv === null || std === null || satz === null) { kopf.textContent = 'Noch nicht berechnet'; text.textContent = 'Tragen Sie Investition, Arbeitsstunden und Kosten je Stunde ein. Die laufenden Kosten sind freiwillig.'; ausgabe.dataset.zustand = 'leer'; return; }
    const monat = std * (52 / 12) * satz - lauf;
    if (inv === 0) { kopf.textContent = 'Ohne Investition gibt es nichts zu amortisieren'; text.textContent = 'Geben Sie die Investition der Zelle ein.'; ausgabe.dataset.zustand = 'leer'; return; }
    if (monat <= 0) { kopf.textContent = 'Mit diesen Angaben amortisiert sich die Zelle nicht'; text.textContent = `Die übernommene Arbeit spart rechnerisch ${eur.format(std * (52 / 12) * satz)} im Monat, die laufenden Kosten betragen ${eur.format(lauf)}.`; ausgabe.dataset.zustand = 'nein'; return; }
    const m = inv / monat;
    kopf.textContent = m < 24 ? `Nach etwa ${zahl.format(Math.ceil(m * 10) / 10)} Monaten` : `Nach etwa ${zahl.format(Math.ceil(m / 12 * 10) / 10)} Jahren`;
    text.textContent = `Rechnerischer Vorteil: ${eur.format(monat)} im Monat (${zahl.format(std)} Stunden je Woche × ${eur.format(satz)} je Stunde, minus ${eur.format(lauf)} laufende Kosten). Das ist ein Rechenbeispiel mit Ihren Zahlen, keine Prognose.`;
    ausgabe.dataset.zustand = 'ja';
  };
  rechner.addEventListener('input', rechnen); rechner.addEventListener('submit', (e) => { e.preventDefault(); rechnen(); });
}
