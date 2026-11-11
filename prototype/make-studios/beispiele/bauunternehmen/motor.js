// motor.js · Ein Takt, Federn, Auftritte, Wort für Wort, rollende Etiketten.
// Alles, was sich bewegt, ist eine Feder auf einem Fortschritt 0 → 1, der zwischen zwei Zuständen mischt.

export const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const feinerZeiger = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ─── Ein Takt für alles (requestAnimationFrame), Nutzer dürfen seltener abtasten ─── */
const nutzer = new Set();
let taktLaeuft = false;
function takt(t) {
  for (const n of nutzer) {
    if (n.intervall && t - n.zuletzt < n.intervall) continue;
    n.zuletzt = t;
    n.fn(t);
  }
  if (nutzer.size) requestAnimationFrame(takt);
  else taktLaeuft = false;
}
export function imTakt(fn, intervall = 0) {
  const n = { fn, intervall, zuletzt: -Infinity };
  nutzer.add(n);
  if (!taktLaeuft) { taktLaeuft = true; requestAnimationFrame(takt); }
  return () => nutzer.delete(n);
}

export const nach = (ms, fn) => (ruhig || ms <= 0 ? (fn(), 0) : setTimeout(fn, ms));

/* ─── Federn: fester Schritt von 1/60 s, Aufholen gedeckelt ─── */
const SCHRITT = 1 / 60;
const aktiv = new Set();
let federAus = null;
let federZeit = 0;

function federTakt(t) {
  let dt = federZeit ? (t - federZeit) / 1000 : SCHRITT;
  federZeit = t;
  dt = Math.min(Math.max(dt, 0), 0.064);
  const schritte = Math.max(1, Math.ceil(dt / SCHRITT - 1e-6));
  const h = dt / schritte || SCHRITT;
  for (const f of aktiv) for (let i = 0; i < schritte; i++) f.schritt(h);
  for (const f of aktiv) {
    if (f.ruht()) { aktiv.delete(f); f.ankommen(); } else f.melden();
  }
  if (!aktiv.size) { federAus?.(); federAus = null; federZeit = 0; }
}
function wecken(f) {
  aktiv.add(f);
  if (!federAus) federAus = imTakt(federTakt);
}

export class Feder {
  constructor(wert = 0, { k = 170, d = 26, klemmen = false, ruhe = 0.0005 } = {}, aufWert = null) {
    this.wert = wert; this.ziel = wert; this.v = 0;
    this.k = k; this.d = d; this.klemmen = klemmen; this.ruhe = ruhe;
    this.aufWert = aufWert;
    this.warten = [];
  }
  einstellen({ k = this.k, d = this.d, klemmen = this.klemmen } = {}) { this.k = k; this.d = d; this.klemmen = klemmen; return this; }
  setze(ziel) {
    if (ruhig) return this.sofort(ziel);
    this.ziel = ziel;
    if (!this.ruht()) wecken(this);
    else if (this.wert !== ziel) this.sofort(ziel);
    return this;
  }
  sofort(w) {
    aktiv.delete(this);
    this.wert = this.ziel = w; this.v = 0;
    this.aufWert?.(w);
    this.loesen();
    return this;
  }
  schritt(h) {
    const vorher = this.wert - this.ziel;
    const a = -this.k * vorher - this.d * this.v;
    this.v += a * h;
    this.wert += this.v * h;
    if (this.klemmen) {
      const nachher = this.wert - this.ziel;
      if (vorher !== 0 && nachher * vorher <= 0) { this.wert = this.ziel; this.v = 0; }
    }
  }
  ruht() { return Math.abs(this.wert - this.ziel) < this.ruhe && Math.abs(this.v) < this.ruhe * 4; }
  melden() { this.aufWert?.(this.wert); }
  ankommen() { this.wert = this.ziel; this.v = 0; this.aufWert?.(this.wert); this.loesen(); }
  loesen() { const w = this.warten; this.warten = []; w.forEach(fn => fn()); }
  bis() { return new Promise(ok => (this.ruht() && !aktiv.has(this) ? ok() : this.warten.push(ok))); }
}

/* ─── Zustände mischen: opacity, x/y (Zahl = px, „%“ = Anteil der eigenen Box), scale, rotate, rotateX/Y, blur, clip ─── */
const teil = (a = 0, b = 0, p) => {
  const prozent = (typeof a === 'string' && a.endsWith('%')) || (typeof b === 'string' && b.endsWith('%'));
  const n = parseFloat(a) + (parseFloat(b) - parseFloat(a)) * p;
  return (Math.round(n * 1000) / 1000) + (prozent ? '%' : 'px');
};
const lin = (a, b, p) => a + (b - a) * p;
const hat = (von, zu, k) => k in von || k in zu;

export function anwenden(el, von, zu, p) {
  const s = el.style;
  if (hat(von, zu, 'opacity')) s.opacity = String(Math.round(lin(von.opacity ?? 1, zu.opacity ?? 1, p) * 1000) / 1000);
  if (['x', 'y', 'scale', 'rotate', 'rotateX', 'rotateY'].some(k => hat(von, zu, k))) {
    const fertig = p === 1 && !zu.x && !zu.y && (zu.scale ?? 1) === 1 && !zu.rotate && !zu.rotateX && !zu.rotateY && zu.halten !== true;
    if (fertig) s.transform = '';
    else {
      let t = `translate3d(${teil(von.x, zu.x, p)}, ${teil(von.y, zu.y, p)}, 0)`;
      if (hat(von, zu, 'rotate')) t += ` rotate(${lin(von.rotate ?? 0, zu.rotate ?? 0, p).toFixed(3)}deg)`;
      if (hat(von, zu, 'rotateX')) t += ` rotateX(${lin(von.rotateX ?? 0, zu.rotateX ?? 0, p).toFixed(3)}deg)`;
      if (hat(von, zu, 'rotateY')) t += ` rotateY(${lin(von.rotateY ?? 0, zu.rotateY ?? 0, p).toFixed(3)}deg)`;
      if (hat(von, zu, 'scale')) t += ` scale(${lin(von.scale ?? 1, zu.scale ?? 1, p).toFixed(4)})`;
      s.transform = t;
    }
  }
  if (hat(von, zu, 'blur')) {
    const b = lin(von.blur ?? 0, zu.blur ?? 0, p);
    s.filter = b < 0.05 ? '' : `blur(${b.toFixed(2)}px)`;
  }
  if (hat(von, zu, 'clip')) {
    const a = von.clip ?? [0, 0, 0, 0], b = zu.clip ?? [0, 0, 0, 0];
    s.clipPath = `inset(${a.map((w, i) => lin(w, b[i], p).toFixed(3) + '%').join(' ')})`;
  }
}

/** Eine Feder, die ein Element zwischen zwei Zuständen bewegt. */
export function bewegung(el, von, zu, feder = {}, start = 0) {
  const f = new Feder(start, feder, p => anwenden(el, von, zu, p));
  anwenden(el, von, zu, start);
  return f;
}

/* ─── Federwerte der Seite ─── */
export const F = {
  boden: { k: 90, d: 26 },
  fluss: { k: 110, d: 26 },
  parallaxe: { k: 120, d: 26 },
  auftritt: { k: 210, d: 28 },
  zaehlen: { k: 90, d: 19, ruhe: 0.3, klemmen: true },
  rollen: { k: 260, d: 26 },
  pfeil: { k: 300, d: 26 },
  ecke: { k: 300, d: 22 },
  burger: { k: 320, d: 26 },
  fuellen: { k: 240, d: 30 },
};
export const ENTRY_DELAY = 180;
export const ENTRY_STAGGER = 110;

/* ─── Im Blick: einmal oder immer ─── */
export function imBlick(el, an, aus = null, { schwelle = 0.15, rand = '0px 0px -6% 0px' } = {}) {
  const io = new IntersectionObserver(eintraege => {
    for (const e of eintraege) {
      if (e.isIntersecting) { an(e.target); if (!aus) io.unobserve(e.target); }
      else if (aus) aus(e.target);
    }
  }, { threshold: schwelle, rootMargin: rand });
  io.observe(el);
  return io;
}

/* ─── Scrub: Fortschritt zwischen zwei Kanten („top bottom“ → „bottom top“) ─── */
const KANTE = { top: 0, center: 0.5, bottom: 1 };
export function scrub(messEl, start, ende, fn, intervall = 32) {
  const [es, vs] = start.split(' ').map(k => KANTE[k]);
  const [ee, ve] = ende.split(' ').map(k => KANTE[k]);
  let aus = null;
  const messen = () => {
    const r = messEl.getBoundingClientRect();
    const vh = innerHeight;
    const fs = r.top + r.height * es - vh * vs;
    const fe = r.top + r.height * ee - vh * ve;
    fn(fs === fe ? 0 : Math.min(1, Math.max(0, fs / (fs - fe))));
  };
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !aus) aus = imTakt(messen, intervall);
    else if (!e.isIntersecting && aus) { messen(); aus(); aus = null; }
  }, { rootMargin: '15% 0px' });
  io.observe(messEl);
  messen();
  return messen;
}

/* ─── Wort für Wort ─── */
export const WORT = {
  kopf: { von: { y: '80%', opacity: 0, scale: 0.9 }, versatz: 55, feder: { k: 180, d: 26 } },
  text: { von: { y: '60%', opacity: 0, scale: 0.94 }, versatz: 22, feder: { k: 210, d: 28 } },
  karte: { von: { y: '90%', opacity: 0, scale: 0.9 }, versatz: 50, feder: { k: 190, d: 28 } },
};
const DA = { x: 0, y: 0, opacity: 1, scale: 1 };

export function worte(el, art = el.dataset.worte, text = null) {
  const vorgabe = WORT[art] || WORT.text;
  const inhalt = (text ?? el.textContent).replace(/\s+/g, ' ').trim();
  el.textContent = '';
  el.classList.add('worte');
  if (el.hasAttribute('data-einzug')) {
    const e = document.createElement('span');
    e.className = 'einzug'; e.setAttribute('aria-hidden', 'true');
    el.append(e);
  }
  const federn = [];
  inhalt.split(' ').forEach((w, i) => {
    if (i) el.append(' ');
    const huelle = document.createElement('span');
    huelle.className = 'wort';
    const innen = document.createElement('span');
    innen.className = 'wort-innen';
    innen.textContent = w;
    huelle.append(innen);
    el.append(huelle);
    federn.push(bewegung(innen, vorgabe.von, DA, vorgabe.feder));
  });
  let zeiten = [];
  const halt = () => { zeiten.forEach(clearTimeout); zeiten = []; };
  return {
    zeigen(verzug = 0) { halt(); zeiten = federn.map((f, i) => nach(verzug + i * vorgabe.versatz, () => f.setze(1))); },
    verbergen() { halt(); federn.forEach(f => f.sofort(0)); },
    fertig() { halt(); federn.forEach(f => f.sofort(1)); },
  };
}

/* ─── Zählende Zahlen: Ziffern sichtbar und still, Endwert für Vorleser ─── */
const ZAHLFORM = new Intl.NumberFormat('de-DE');
export function zaehler(el) {
  const text = el.textContent.trim();
  const m = text.match(/^([\d.]+)(.*)$/);
  if (!m) return { start() {}, fertig() {} };
  const ziel = parseInt(m[1].replace(/\./g, ''), 10);
  el.textContent = '';
  const ziffern = document.createElement('span');
  ziffern.className = 'zahl-ziffern';
  ziffern.setAttribute('aria-hidden', 'true');
  const rest = document.createElement('span');
  rest.setAttribute('aria-hidden', 'true');
  rest.textContent = m[2];
  const vorlesen = document.createElement('span');
  vorlesen.className = 'unsichtbar';
  vorlesen.textContent = text;
  el.append(ziffern, rest, vorlesen);
  ziffern.textContent = ZAHLFORM.format(ziel);
  if (ziel < 10 || ruhig) return { start() {}, fertig() {} };
  // Kurz vor dem Ziel gleich die volle Zahl zeigen: der Rest der Feder kriecht sonst sichtbar über die letzten Stellen
  const knapp = Math.max(1, ziel * 0.002);
  const f = new Feder(0, F.zaehlen, v => { ziffern.textContent = ZAHLFORM.format(Math.abs(ziel - v) < knapp ? ziel : Math.round(v)); });
  let gestartet = false;
  return {
    start(verzug = 0) {
      if (gestartet) return;
      gestartet = true;
      // Breite festhalten, damit nichts springt
      ziffern.style.display = 'inline-block';
      ziffern.style.textAlign = 'right';
      ziffern.style.minWidth = ziffern.getBoundingClientRect().width + 'px';
      f.sofort(0);
      nach(verzug, () => f.setze(ziel));
    },
    fertig() { f.sofort(ziel); },
  };
}

/* ─── Rollende Etiketten: zwei Kopien, die zweite rollt von unten nach ─── */
export function rollen(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  el.classList.add('roll');
  const a = document.createElement('span');
  a.className = 'roll-a';
  a.textContent = text;
  const b = document.createElement('span');
  b.className = 'roll-b';
  b.setAttribute('aria-hidden', 'true');
  b.textContent = text;
  el.append(a, b);
  return new Feder(0, F.rollen, p => {
    a.style.transform = p ? `translate3d(0, ${(-100 * p).toFixed(2)}%, 0)` : '';
    b.style.transform = `translate3d(0, ${(100 - 100 * p).toFixed(2)}%, 0)`;
  });
}

/* ─── Zeigen und Verlassen mit Maus oder Tastatur (Finger lösen nichts aus) ─── */
export function beimZeigen(ziel, an, aus) {
  let drin = false;
  const ein = () => { if (!drin) { drin = true; an(); } };
  const raus = () => { if (drin) { drin = false; aus(); } };
  ziel.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') ein(); });
  ziel.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') raus(); });
  ziel.addEventListener('focusin', () => { if (ziel.matches(':focus-visible') || ziel.querySelector(':focus-visible')) ein(); });
  ziel.addEventListener('focusout', e => { if (!ziel.contains(e.relatedTarget)) raus(); });
}
