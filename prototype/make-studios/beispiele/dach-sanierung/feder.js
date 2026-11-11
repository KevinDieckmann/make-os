// Federn, ein gemeinsamer Takt und die vier Verhalten (Erscheinen, Zeigen, Scrollen, einmalig).
// Halbimplizites Euler-Verfahren in 1-ms-Schritten, Ruhe bei kleinster Restbewegung.

export const SPRING = { tension: 420, friction: 42 };
export const SPRING_REVEAL = { tension: 150, friction: 25 };
export const SPRING_CAMERA = { tension: 30, friction: 14 };
export const SPRING_SOFT = { tension: 120, friction: 22 };
export const SPRING_POP = { tension: 260, friction: 14 };
export const SPRING_TRAIL = { tension: 170, friction: 26 };
export const SPRING_DRAW = { tension: 90, friction: 19 };
export const LIFT = { tension: 150, friction: 26 };
export const TYPE_STAGGER = 30;
export const REVEAL_MARGIN = '0px 0px -20% 0px';

export const klemme = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

// ── Ein Takt für alles ──
const abos = new Set();
let rafId = 0;
function takt(t) {
  rafId = 0;
  for (const a of abos) {
    if (t - a.zuletzt >= a.abstand) {
      a.zuletzt = t;
      try { a.fn(t); } catch (e) { abos.delete(a); console.warn(e); }
    }
  }
  if (abos.size) rafId = requestAnimationFrame(takt);
}
export function abonnieren(fn, abstand = 0) {
  const a = { fn, abstand, zuletzt: -Infinity };
  abos.add(a);
  if (!rafId) rafId = requestAnimationFrame(takt);
  return () => abos.delete(a);
}

// ── Feder mit benannten Kanälen ──
export class Feder {
  constructor(werte, schreiben) {
    this.wert = { ...werte };
    this.ziel = { ...werte };
    this.v = {};
    for (const k in werte) this.v[k] = 0;
    this.schreiben = schreiben || (() => {});
    this.cfg = SPRING;
    this.ab = null;
    this.uhr = 0;
    this.zeit = 0;
    this.warten = 0;
    this.fertig = null;
  }
  setze(werte) {
    clearTimeout(this.warten);
    Object.assign(this.wert, werte);
    Object.assign(this.ziel, werte);
    for (const k in werte) this.v[k] = 0;
    this.halt();
    this.schreiben(this.wert);
    return this;
  }
  nach(ziel, cfg = SPRING, verzoegerung = 0) {
    clearTimeout(this.warten);
    return new Promise(fertig => {
      const los = () => {
        this.cfg = cfg;
        if (cfg.duration) {
          this.von = { ...this.wert };
          this.zeit = performance.now();
        }
        Object.assign(this.ziel, ziel);
        for (const k in ziel) if (!(k in this.v)) { this.v[k] = 0; if (!(k in this.wert)) this.wert[k] = ziel[k]; }
        if (this.fertig) this.fertig();
        this.fertig = fertig;
        this.uhr = 0;
        if (!this.ab) this.ab = abonnieren(t => this.schritt(t));
      };
      if (verzoegerung > 0) this.warten = setTimeout(los, verzoegerung);
      else los();
    });
  }
  halt() {
    if (this.ab) { this.ab(); this.ab = null; }
    if (this.fertig) { const f = this.fertig; this.fertig = null; f(); }
  }
  schritt(t) {
    const cfg = this.cfg;
    let ruhe = true;
    if (cfg.duration) {
      const p = klemme((t - this.zeit) / cfg.duration);
      const e = (cfg.easing || (x => x))(p);
      for (const k in this.ziel) this.wert[k] = this.von[k] + (this.ziel[k] - this.von[k]) * e;
      ruhe = p >= 1;
    } else {
      const dt = this.uhr ? Math.min(64, t - this.uhr) : 16;
      const schritte = Math.max(1, Math.round(dt));
      for (const k in this.ziel) {
        let x = this.wert[k], v = this.v[k];
        const z = this.ziel[k];
        for (let i = 0; i < schritte; i++) {
          const a = -cfg.tension * (x - z) - cfg.friction * v;
          v += a * 0.001;
          x += v * 0.001;
        }
        const eps = Math.max(0.0005, Math.abs(z) * 0.0002);
        if (Math.abs(x - z) < eps && Math.abs(v) < eps * 10) { x = z; v = 0; }
        else ruhe = false;
        this.wert[k] = x;
        this.v[k] = v;
      }
    }
    this.uhr = t;
    this.schreiben(this.wert);
    if (ruhe) this.halt();
  }
}

// ── Schreiber: Kanäle in CSS (jeder Transformkanal mit Einheit) ──
export function stilSchreiber(el) {
  return w => {
    let tr = '';
    if ('x' in w || 'y' in w) tr += `translate3d(${(w.x || 0).toFixed(2)}px, ${(w.y || 0).toFixed(2)}px, 0)`;
    if ('scale' in w) tr += ` scale(${w.scale.toFixed(4)})`;
    if ('scaleX' in w) tr += ` scaleX(${w.scaleX.toFixed(4)})`;
    if ('scaleY' in w) tr += ` scaleY(${w.scaleY.toFixed(4)})`;
    if ('rotate' in w) tr += ` rotate(${w.rotate.toFixed(2)}deg)`;
    if (tr) el.style.transform = tr;
    if ('opacity' in w) el.style.opacity = klemme(w.opacity).toFixed(3);
    if ('blur' in w) el.style.filter = w.blur < 0.05 ? 'none' : `blur(${w.blur.toFixed(2)}px)`;
  };
}

// ── Sichtbarkeit einmal ──
export function beiSicht(el, fn, rootMargin = REVEAL_MARGIN) {
  const io = new IntersectionObserver(eintraege => {
    for (const e of eintraege) if (e.isIntersecting) { io.disconnect(); fn(); }
  }, { rootMargin });
  io.observe(el);
  return io;
}

// Erscheinen: from sofort schreiben, beim ersten Kreuzen der Linie nach to federn.
export function erscheinen(el, von, zu, cfg = SPRING_REVEAL, verzoegerung = 0, rootMargin = REVEAL_MARGIN, ausloeser = el) {
  const f = new Feder(von, stilSchreiber(el));
  f.schreiben(f.wert);
  beiSicht(ausloeser, () => f.nach(zu, cfg, verzoegerung), rootMargin);
  return f;
}

// Scroll-Kopplung: misst das äußere Element, federt den Fortschritt, ruft zeichne(p).
export function scrollen(aussen, start, ende, zeichne, cfg = SPRING) {
  let ab = null;
  let p = null, v = 0, uhr = 0;
  const messen = () => {
    const bb = aussen.getBoundingClientRect();
    const vh = window.innerHeight;
    const lage = {
      'top top': bb.top, 'center top': bb.top + bb.height / 2, 'bottom top': bb.bottom,
      'top bottom': bb.top - vh, 'center bottom': bb.top + bb.height / 2 - vh, 'bottom bottom': bb.bottom - vh,
      'top center': bb.top - vh / 2, 'center center': bb.top + bb.height / 2 - vh / 2, 'bottom center': bb.bottom - vh / 2,
    };
    const s = lage[start], e = lage[ende];
    const laenge = Math.abs(s - e) || 1;
    return klemme(1 - (s + laenge) / laenge);
  };
  const schritt = t => {
    const z = messen();
    if (p === null) { p = z; zeichne(p); uhr = t; return; }
    const dt = Math.min(64, t - uhr || 16);
    uhr = t;
    const n = Math.max(1, Math.round(dt));
    for (let i = 0; i < n; i++) {
      const a = -cfg.tension * (p - z) - cfg.friction * v;
      v += a * 0.001;
      p += v * 0.001;
    }
    if (Math.abs(p - z) < 0.0004 && Math.abs(v) < 0.004) { p = z; v = 0; }
    zeichne(p);
  };
  // Nur rechnen, wenn das Element in der Nähe des Bildschirms ist.
  const io = new IntersectionObserver(eintraege => {
    for (const e of eintraege) {
      if (e.isIntersecting && !ab) { uhr = 0; ab = abonnieren(schritt, 10); }
      else if (!e.isIntersecting && ab) { schritt(performance.now()); ab(); ab = null; }
    }
  }, { rootMargin: '50% 0px 50% 0px' });
  io.observe(aussen);
  zeichne(p = messen());
  return { messen };
}

// Text in Wörter und Buchstaben teilen; die echte Fassung bleibt für Vorleseprogramme erhalten.
export function teilen(el, { buchstaben = true } = {}) {
  const kopie = document.createElement('span');
  kopie.className = 'vh';
  kopie.textContent = el.textContent.replace(/\s+/g, ' ').trim();
  const huelle = document.createElement('span');
  huelle.className = 'geteilt';
  huelle.setAttribute('aria-hidden', 'true');
  const zeichen = [];
  const woerter = [];
  const bauen = (quelle, ziel) => {
    for (const knoten of [...quelle.childNodes]) {
      if (knoten.nodeType === 3) {
        const teile = knoten.textContent.split(/(\s+)/);
        for (const t of teile) {
          if (!t) continue;
          if (/^\s+$/.test(t)) { ziel.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span');
          w.className = 'wort';
          if (buchstaben) {
            for (const c of t) {
              const b = document.createElement('span');
              b.className = 'zeichen';
              b.textContent = c;
              w.appendChild(b);
              zeichen.push(b);
            }
          } else w.textContent = t;
          woerter.push(w);
          ziel.appendChild(w);
        }
      } else if (knoten.nodeType === 1) {
        const klon = knoten.cloneNode(false);
        klon.removeAttribute('id');
        ziel.appendChild(klon);
        bauen(knoten, klon);
      }
    }
  };
  bauen(el, huelle);
  el.textContent = '';
  el.append(kopie, huelle);
  return { zeichen, woerter, huelle };
}
