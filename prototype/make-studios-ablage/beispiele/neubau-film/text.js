// Buchstaben der Beispielseite Hellgrund: Text teilen, aufdecken und einem Fortschritt folgen.
// Zwei Arten wie im Vorbild: "gleiten" kommt von links, "steigen" steigt aus der Zeile; beide mit Unschärfe.

import { Feder, Verlauf, kurve, imTakt, clamp01 } from './feder.js';

const ARTEN = {
  gleiten: { x: -40, y: 0 },
  steigen: { x: 0, y: 105 },
};

/** Versatz je Buchstabe und Dauer je Buchstabe in Millisekunden. */
export const ZEIT = {
  label: { versatz: 35, dauer: 1500 },
  cta: { versatz: 12, dauer: 800 },
  quote: { versatz: 7, dauer: 1600 },
};

function zeichne(el, s, art) {
  const w = clamp01(s);
  if (el.__s === w) return;
  el.__s = w;
  const st = el.style;
  if (w >= 0.999) {
    st.removeProperty('opacity');
    st.removeProperty('transform');
    st.removeProperty('filter');
    return;
  }
  const r = 1 - w;
  st.setProperty('opacity', w.toFixed(3));
  st.setProperty('transform', `translate3d(${(art.x * r).toFixed(2)}px, ${(art.y * r).toFixed(2)}%, 0)`);
  st.setProperty('filter', r > 0.004 ? `blur(${(12 * r).toFixed(2)}px)` : 'none');
}

/* Alle laufenden Gruppen teilen sich den einen Takt. */
const aktiv = new Set();
let angemeldet = false;
let gestoppt = false;
function wecke(gruppe) {
  if (gestoppt) return;
  aktiv.add(gruppe);
  if (!angemeldet) {
    angemeldet = true;
    imTakt((jetzt, dt) => {
      for (const g of aktiv) if (!g.schritt(jetzt, dt)) aktiv.delete(g);
    });
  }
}

/** Notaus: keine Gruppe zeichnet mehr (die Seite fällt auf die ruhige Fassung zurück). */
export function stoppeAlle() {
  gestoppt = true;
  aktiv.clear();
}

function buchstabenIn(ziel, text, klasse) {
  const liste = [];
  for (const zeichen of Array.from(text)) {
    const s = document.createElement('span');
    s.className = klasse;
    s.textContent = zeichen;
    ziel.append(s);
    liste.push(s);
  }
  return liste;
}

/** Ein einzelnes Wort in Buchstaben teilen (das Element ist schon aria-hidden). */
export function teileWort(el, klasse = 'bu') {
  const text = el.textContent.trim();
  el.textContent = '';
  return buchstabenIn(el, text, klasse);
}

/** Ein Element mit .zeile-Kindern teilen: lesbarer Text bleibt versteckt erhalten, die Buchstaben sind nur Bild. */
export function teileZeilen(el) {
  const zeilen = Array.from(el.querySelectorAll(':scope > .zeile'));
  const klemme = !el.hasAttribute('data-frei');
  const lesbar = document.createElement('span');
  lesbar.className = 'vh';
  lesbar.textContent = zeilen.map((z) => z.textContent.trim()).join(' ');
  const innen = document.createElement('span');
  innen.className = 'zeilen-in';
  innen.setAttribute('aria-hidden', 'true');
  const alle = [];
  for (const z of zeilen) {
    const zeile = document.createElement('span');
    zeile.className = 'zeile';
    for (const wort of z.textContent.trim().split(/\s+/).filter(Boolean)) {
      const w = document.createElement('span');
      w.className = klemme ? 'zw klemme' : 'zw';
      alle.push(...buchstabenIn(w, wort, 'bu'));
      zeile.append(w);
    }
    innen.append(zeile);
  }
  el.replaceChildren(lesbar, innen);
  return alle;
}

/** Aufdecken mit Versatz je Buchstabe; aus() setzt ohne Bewegung zurück. */
export class Aufdecken {
  constructor(bu, art, { versatz, dauer, kurveFn = kurve.outExpo, verzug = 0 }) {
    this.verzug = verzug;
    this.bu = bu;
    this.art = ARTEN[art];
    this.versatz = versatz;
    this.dauer = dauer;
    this.kurveFn = kurveFn;
    this.v = bu.map(() => new Verlauf(0));
    this.an = false;
    bu.forEach((el) => zeichne(el, 0, this.art));
  }
  setze(an) {
    if (an === this.an) return;
    this.an = an;
    if (an) {
      const jetzt = performance.now();
      this.v.forEach((v, i) => v.starte(1, this.dauer, this.kurveFn, jetzt, this.verzug + i * this.versatz));
      wecke(this);
    } else {
      aktiv.delete(this);
      this.v.forEach((v, i) => { v.sofort(0); zeichne(this.bu[i], 0, this.art); });
    }
  }
  /** Sofort sichtbar, ohne Bewegung. */
  zeige() {
    this.an = true;
    aktiv.delete(this);
    this.v.forEach((v, i) => { v.sofort(1); zeichne(this.bu[i], 1, this.art); });
  }
  schritt(jetzt) {
    let laeuft = false;
    this.v.forEach((v, i) => {
      if (v.schritt(jetzt)) { laeuft = true; zeichne(this.bu[i], v.wert, this.art); }
    });
    return laeuft;
  }
}

/** Buchstabe i ist da, solange der Fortschritt über i / n liegt; Federn in beide Richtungen. */
export class Folgen {
  constructor(bu, art, { spannung = 170, reibung = 26 } = {}) {
    this.bu = bu;
    this.art = ARTEN[art];
    this.f = bu.map(() => new Feder(0, { spannung, reibung, genau: 0.002 }));
    this.p = -1;
    bu.forEach((el) => zeichne(el, 0, this.art));
  }
  setze(p) {
    if (p === this.p) return;
    this.p = p;
    const n = this.bu.length;
    let neu = false;
    this.f.forEach((f, i) => {
      const ziel = p > i / n ? 1 : 0;
      if (ziel !== f.ziel) { f.setze(ziel); neu = true; }
    });
    if (neu) wecke(this);
  }
  schritt(jetzt, dt) {
    let laeuft = false;
    this.f.forEach((f, i) => {
      if (f.schritt(dt)) { laeuft = true; zeichne(this.bu[i], f.wert, this.art); }
    });
    return laeuft;
  }
}
