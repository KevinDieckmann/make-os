// Bewegung: Federn, ein gemeinsamer Takt, Seitenzustand und die Auftritte über data-Attribute.
// Ohne Skript und bei reduzierter Bewegung bleibt alles sichtbar und ruhig.

/* ─── Federn ─── */
export class Feder {
  constructor(wert = 0, steif = 90, daempf = 26) {
    this.wert = wert; this.ziel = wert; this.tempo = 0; this.steif = steif; this.daempf = daempf; this.rest = 0;
  }
  // 1-ms-Teilschritte, höchstens 64 ms je Bild. Gibt false zurück, sobald die Feder ruht.
  schritt(ms) {
    let n = Math.min(64, ms) + this.rest;
    const ganz = Math.floor(n);
    this.rest = n - ganz;
    for (let i = 0; i < ganz; i++) {
      const a = -this.steif * (this.wert - this.ziel) - this.daempf * this.tempo;
      this.tempo += a * 0.001;
      this.wert += this.tempo * 0.001;
    }
    if (Math.abs(this.wert - this.ziel) < 1e-4 && Math.abs(this.tempo) < 1e-3) { this.wert = this.ziel; this.tempo = 0; return false; }
    return true;
  }
}

export const glatt = {
  aussenKubisch: (t) => 1 - (1 - t) ** 3,
  aussenQuart: (t) => 1 - (1 - t) ** 4,
  linear: (t) => t,
};

/* ─── Takt: ein requestAnimationFrame für alles, Lenis zuerst ─── */
const takte = new Set();
const laufend = new Set();
let lenis = null;
let letzte = 0;
function schleife(t) {
  requestAnimationFrame(schleife);
  const dt = letzte ? Math.min(64, t - letzte) : 16.7;
  letzte = t;
  if (lenis) lenis.raf(t);
  for (const lauf of laufend) if (!lauf(dt)) laufend.delete(lauf);
  for (const f of takte) f(dt, t);
}
requestAnimationFrame(schleife);

export const imTakt = (f) => { takte.add(f); return () => takte.delete(f); };
export const lenisSetzen = (l) => { lenis = l; };
export const lenisVon = () => lenis;

// Eine Feder, die einmal von → bis läuft.
export function federLauf({ von = 0, bis = 1, steif = 90, daempf = 26, verz = 0, bei, fertig }) {
  const f = new Feder(von, steif, daempf);
  f.ziel = bis;
  let warte = verz;
  bei(von);
  laufend.add((dt) => {
    if (warte > 0) { warte -= dt; if (warte > 0) return true; dt = -warte; }
    const weiter = f.schritt(dt);
    bei(f.wert);
    if (!weiter && fertig) fertig();
    return weiter;
  });
  return f;
}

// Eine Feder mit wechselndem Ziel (Hover, Umschalter).
export function feder({ wert = 0, steif = 90, daempf = 26, bei }) {
  const f = new Feder(wert, steif, daempf);
  let aktiv = false;
  const lauf = (dt) => { const w = f.schritt(dt); bei(f.wert); if (!w) aktiv = false; return w; };
  return {
    feder: f,
    zu(ziel, verz = 0) {
      const los = () => { f.ziel = ziel; if (!aktiv) { aktiv = true; laufend.add(lauf); } };
      if (verz > 0) setTimeout(los, verz); else los();
    },
    setze(wert) { f.wert = wert; f.ziel = wert; f.tempo = 0; bei(wert); },
  };
}

export function verlauf({ dauer, verz = 0, glaettung = glatt.aussenKubisch, bei, fertig }) {
  let t = -verz;
  bei(0);
  laufend.add((dt) => {
    t += dt;
    if (t < 0) return true;
    const q = Math.min(1, t / dauer);
    bei(glaettung(q));
    if (q >= 1) { if (fertig) fertig(); return false; }
    return true;
  });
}

/* ─── Güteregler für die 3D-Ansichten ───
   Reicht die Bildzeit über etwa 40 Bilder nicht für flüssige Bewegung, geht die Auflösung eine Stufe herunter.
   Sind die Bilder dabei völlig gleichmäßig langsam, bremst vermutlich der Browser selbst (Stromsparmodus, 30 Bilder je Sekunde):
   Dann prüft der Regler kurz auf der untersten Stufe. Hilft das nicht, kommt die volle Güte zurück und er gibt Ruhe.
   stufen: absteigende Pixelverhältnisse. */
export function gueteRegler({ stufen, setze, amLimit }) {
  const letzte = stufen.length - 1;
  let i = 0, summe = 0, n = 0, tief = Infinity, hoch = 0, schonung = 45, erstes = 0, probe = false, fertig = false;
  const ende = (mittel) => {
    fertig = true;
    if (letzte > 0 && Math.abs(mittel - erstes) < 2) { i = 0; setze(stufen[0]); }      // an der Auflösung lag es nicht
    else if (amLimit && mittel > 27) amLimit();
  };
  return {
    wert: () => stufen[i],
    bild(dt) {
      if (fertig) return;
      if (schonung > 0) { schonung -= 1; return; }      // nach dem Start und nach jedem Wechsel kurz nicht messen
      summe += dt; n += 1;
      if (dt < tief) tief = dt;
      if (dt > hoch) hoch = dt;
      if (n < 40) return;
      const mittel = summe / n;
      const stetig = hoch - tief < 6;
      summe = 0; n = 0; tief = Infinity; hoch = 0;
      if (probe) { ende(mittel); return; }
      if (mittel <= 21.5) return;
      if (!erstes) erstes = mittel;
      if (i >= letzte) { ende(mittel); return; }
      if (stetig && i === 0 && letzte > 1) { i = letzte; probe = true; } else i += 1;
      schonung = 45;
      setze(stufen[i]);
    },
  };
}
export const stufenAb = (start, liste) => [start, ...liste.filter((w) => w < start - 0.05)];

/* ─── Seitenzustand: laedt → enthuellt → bereit ─── */
const RANG = { laedt: 0, enthuellt: 1, bereit: 2 };
let zustand = 'laedt';
const wartende = [];
export function zustandSetzen(z) {
  if (RANG[z] <= RANG[zustand]) return;
  zustand = z;
  document.documentElement.dataset.zustand = z;
  for (const w of wartende.slice()) {
    if (RANG[zustand] >= RANG[w.z]) { wartende.splice(wartende.indexOf(w), 1); w.f(); }
  }
}
export function wenn(z, f) {
  if (RANG[zustand] >= RANG[z]) f(); else wartende.push({ z, f });
}

/* ─── Bausteine ─── */
const span = (klasse, inhalt) => {
  const s = document.createElement('span');
  if (klasse) s.className = klasse;
  if (inhalt != null) s.textContent = inhalt;
  return s;
};
const zahl = (wert, vorgabe) => { const n = parseFloat(wert); return Number.isFinite(n) ? n : vorgabe; };
const federWerte = (el, steif = 90, daempf = 26) => {
  const [a, b] = (el.dataset.feder || '').split('/').map(Number);
  return { steif: a || steif, daempf: b || daempf };
};

// Text in Zeilen teilen. Die sichtbaren Zeilen sind für Vorleser verborgen, eine Kopie trägt den Text.
function zeilenBauen(el) {
  const text = (el.dataset.text ||= el.textContent.replace(/\s+/g, ' ').trim());
  el.textContent = '';
  el.append(span('sr-nur', text));
  const sicht = span('te-sicht');
  sicht.setAttribute('aria-hidden', 'true');
  el.append(sicht);
  const woerter = text.split(' ').map((w) => span('te-wort', w));
  woerter.forEach((w, i) => { sicht.append(w); if (i < woerter.length - 1) sicht.append(' '); });
  const zeilen = [];
  let oben = null;
  for (const w of woerter) {
    const t = w.offsetTop;
    if (oben === null || Math.abs(t - oben) > 3) { zeilen.push([]); oben = t; }
    zeilen[zeilen.length - 1].push(w.textContent);
  }
  sicht.textContent = '';
  return zeilen.map((z) => {
    const zeile = span('te-zeile');
    const innen = span('', z.join(' '));
    zeile.append(innen);
    sicht.append(zeile);
    return innen;
  });
}

function woerterBauen(el) {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';
  el.append(span('sr-nur', text));
  const sicht = span('te-sicht');
  sicht.setAttribute('aria-hidden', 'true');
  el.append(sicht);
  const woerter = text.split(' ').map((w) => span('te-wort', w));
  woerter.forEach((w, i) => { sicht.append(w); if (i < woerter.length - 1) sicht.append(' '); });
  return woerter;
}

// Ziffern rollen in ihren Spalten auf den Wert. Der Text bleibt (durchsichtig) für Vorleser stehen.
function ziffernBauen(el) {
  const text = el.textContent;
  el.textContent = '';
  const huelle = span('dr');
  const platz = span('dr-platz', text);
  const zellen = span('dr-zellen');
  zellen.setAttribute('aria-hidden', 'true');
  const stapel = [];
  for (const z of text) {
    if (/[0-9]/.test(z)) {
      const spalte = span('dr-spalte');
      spalte.append(span('dr-mass', z));
      const s = span('dr-stapel');
      for (let i = 0; i < 10; i++) s.append(span('', String(i)));
      spalte.append(s);
      zellen.append(spalte);
      stapel.push({ s, n: Number(z) });
    } else {
      zellen.append(span('dr-fest', z));
    }
  }
  huelle.append(platz, zellen);
  el.append(huelle);
  return stapel;
}

/* ─── Unterstrich: das Wort rollt beim Darüberfahren ─── */
function unterstrichBauen(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  el.classList.add('us');
  const fenster = span('us-fenster');
  const a = span('us-a', text);
  const b = span('us-b', text);
  b.setAttribute('aria-hidden', 'true');
  fenster.append(a, b);
  const strich = span('us-linie');
  strich.setAttribute('aria-hidden', 'true');
  el.append(fenster, strich);
  const rollen = feder({ steif: 260, daempf: 30, bei: (v) => { a.style.transform = `translateY(${-v * 100}%)`; b.style.transform = `translateY(${(1 - v) * 100}%)`; } });
  const linie = feder({ steif: 220, daempf: 28, bei: (v) => { strich.style.transform = `scaleX(${v})`; strich.style.opacity = v > 0.01 ? '1' : '0'; } });
  const ziel = el.closest('a, button') || el;
  const an = () => { rollen.zu(1); linie.zu(1); };
  const aus = () => { rollen.zu(0); linie.zu(0); };
  ziel.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') an(); });
  ziel.addEventListener('pointerleave', aus);
  ziel.addEventListener('focus', () => { if (ziel.matches(':focus-visible')) an(); });
  ziel.addEventListener('blur', aus);
}

/* ─── Text-Knopf mit Pfeil ─── */
const PFEIL = '<svg viewBox="0 0 12.2137 13.2551" focusable="false"><path d="M11.9501 7.26396C12.3016 6.91249 12.3016 6.34264 11.9501 5.99117L6.22254 0.263604C5.87107 -0.0878682 5.30122 -0.0878682 4.94975 0.263604C4.59828 0.615076 4.59828 1.18492 4.94975 1.5364L10.0409 6.62756L4.94975 11.7187C4.59828 12.0702 4.59828 12.6401 4.94975 12.9915C5.30122 13.343 5.87107 13.343 6.22254 12.9915L11.9501 7.26396ZM0 6.62756V7.52756H11.3137V6.62756V5.72756H0V6.62756Z" fill="currentColor"/></svg>';

export function ctaBauen(el, reduziert) {
  const text = el.textContent.trim();
  el.textContent = '';
  el.classList.add('ist-cta');
  const zeile = span('cta-zeile');
  const t = span('cta-text', text);
  const pfeile = span('cta-pfeile');
  pfeile.setAttribute('aria-hidden', 'true');
  const pa = span('cta-pfeil cta-pfeil-a');
  const pb = span('cta-pfeil cta-pfeil-b');
  pa.innerHTML = PFEIL;
  pb.innerHTML = PFEIL;
  pfeile.append(pa, pb);
  zeile.append(t, pfeile);
  const linie = span('cta-linie');
  linie.setAttribute('aria-hidden', 'true');
  const grund = span('cta-linie-grund');
  const ueber = span('cta-linie-ueber');
  linie.append(grund, ueber);
  el.append(zeile, linie);
  if (reduziert) return t;
  const fa = feder({ steif: 200, daempf: 28, bei: (v) => { pa.style.transform = `translateX(${v * 190}%)`; pa.style.opacity = String(1 - v); } });
  const fb = feder({ steif: 200, daempf: 28, bei: (v) => { pb.style.transform = `translateX(${(v - 1) * 190}%)`; pb.style.opacity = String(v); } });
  const fg = feder({ wert: 1, steif: 260, daempf: 30, bei: (v) => { grund.style.transform = `scaleX(${v})`; } });
  const fu = feder({ steif: 170, daempf: 26, bei: (v) => { ueber.style.transform = `scaleX(${v})`; } });
  const an = () => { fa.zu(1); fb.zu(1, 70); fg.zu(0); fu.zu(1, 140); };
  const aus = () => { fa.zu(0); fb.zu(0); fg.zu(1, 120); fu.zu(0); };
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') an(); });
  el.addEventListener('pointerleave', aus);
  el.addEventListener('focus', () => { if (el.matches(':focus-visible')) an(); });
  el.addEventListener('blur', aus);
  return t;
}

/* ─── Neigen zur Maus ─── */
function neigenBauen(el, ziel, raum) {
  const rx = feder({ steif: 90, daempf: 22, bei: () => {} });
  const ry = feder({ steif: 90, daempf: 22, bei: () => {} });
  const zeigen = () => { ziel.style.transform = `rotateX(${rx.feder.wert}deg) rotateY(${ry.feder.wert}deg)`; };
  let aktiv = false;
  imTakt(() => { if (aktiv || rx.feder.tempo || ry.feder.tempo || rx.feder.wert || ry.feder.wert) zeigen(); });
  const flaeche = raum || el;
  flaeche.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || innerWidth < 768) return;
    const r = flaeche.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    aktiv = true;
    ry.zu(x * 14 * 2 * 0.5);
    rx.zu(-y * 14 * 2 * 0.5);
  });
  flaeche.addEventListener('pointerleave', () => { aktiv = false; rx.zu(0); ry.zu(0); });
}

/* ─── Scrub: Werte folgen der Scrollposition ─── */
const scrubs = [];
const KANTE = { top: 0, center: 0.5, bottom: 1 };
function kanten(spec) { const [a, b] = (spec || 'top_bottom').split('_'); return [KANTE[a] ?? 0, KANTE[b] ?? 1]; }
export function scrubAnmelden({ ziel, von = 'top_bottom', bis = 'bottom_top', bei }) {
  const [a1, b1] = kanten(von);
  const [a2, b2] = kanten(bis);
  scrubs.push({ ziel, a1, b1, a2, b2, bei, letzter: -1 });
}
let scrubStand = '';
function scrubsRechnen(erzwingen) {
  const stand = `${scrollY}|${innerHeight}|${innerWidth}`;
  if (!erzwingen && stand === scrubStand) return;
  scrubStand = stand;
  const vh = innerHeight;
  for (const s of scrubs) {
    const r = s.ziel.getBoundingClientRect();
    if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) {
      const p = r.top > vh ? 0 : 1;
      if (p !== s.letzter) { s.letzter = p; s.bei(p); }
      continue;
    }
    const s1 = r.top + s.a1 * r.height - s.b1 * vh;
    const s2 = r.top + s.a2 * r.height - s.b2 * vh;
    const p = s1 === s2 ? 1 : Math.min(1, Math.max(0, s1 / (s1 - s2)));
    if (Math.abs(p - s.letzter) > 1e-4) { s.letzter = p; s.bei(p); }
  }
}
imTakt(() => scrubsRechnen(false));
addEventListener('resize', () => scrubsRechnen(true));

/* ─── Auftritte ─── */
export function bewegungStarten({ reduziert }) {
  const alle = (sel) => [...document.querySelectorAll(sel)];

  for (const el of alle('[data-unterstrich]')) { if (!reduziert) unterstrichBauen(el); }
  for (const el of alle('.cta')) ctaBauen(el, reduziert);

  if (reduziert) return { textBereit: Promise.resolve() };

  const beobachter = new Map();
  const beobachte = (el, los) => {
    const rand = el.dataset.rand != null ? zahl(el.dataset.rand, 0) : 10;
    if (!beobachter.has(rand)) {
      beobachter.set(rand, new IntersectionObserver((eintraege, io) => {
        for (const e of eintraege) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          const f = e.target.__los;
          if (f) wenn('enthuellt', f);
        }
      }, { rootMargin: `0px 0px -${rand}% 0px`, threshold: 0 }));
    }
    el.__los = los;
    beobachter.get(rand).observe(el);
  };
  const ausloesen = (el, los) => { if (el.hasAttribute('data-start')) wenn('enthuellt', los); else beobachte(el, los); };

  // Hochsteigen mit Ausblendung
  for (const el of alle('[data-auf]')) {
    const weg = zahl(el.dataset.auf, 16);
    const { steif, daempf } = federWerte(el);
    const verz = zahl(el.dataset.verz, 0);
    el.style.opacity = '0';
    el.style.transform = `translateY(${weg}px)`;
    ausloesen(el, () => federLauf({ steif, daempf, verz, bei: (v) => { el.style.opacity = String(Math.min(1, Math.max(0, v))); el.style.transform = `translateY(${(1 - v) * weg}px)`; }, fertig: () => { el.style.transform = ''; } }));
  }

  // Aufdecken per clip-path, {} ist die bewegte Kante
  for (const el of alle('[data-clip]')) {
    const muster = el.dataset.clip;
    const von = zahl(el.dataset.clipVon, 100);
    const bis = zahl(el.dataset.clipBis, 0);
    const { steif, daempf } = federWerte(el, 60, 26);
    const verz = zahl(el.dataset.verz, 0);
    const setze = (v) => { el.style.clipPath = `inset(${muster.replace('{}', v.toFixed(2) + '%')})`; };
    setze(von);
    // Die Feder zielt etwas über das Ende hinaus und wird dort gehalten: So endet der Auftritt sauber,
    // statt mit einem langen Ausklang, in dem der letzte Buchstabe noch abgeschnitten wirkt.
    const richtung = Math.sign(bis - von) || -1;
    const halte = (v) => setze(richtung < 0 ? Math.max(v, bis) : Math.min(v, bis));
    ausloesen(el, () => federLauf({ von, bis: bis + 16 * richtung, steif, daempf, verz, bei: halte }));
  }

  // Linien wachsen
  for (const el of alle('[data-linie]')) {
    const achse = el.dataset.linie === 'y' ? 'Y' : 'X';
    const verz = zahl(el.dataset.verz, 0);
    el.style.transform = `scale${achse}(0)`;
    ausloesen(el, () => federLauf({ steif: 80, daempf: 26, verz, bei: (v) => { el.style.transform = `scale${achse}(${Math.max(0, v)})`; } }));
  }

  // Ziffern rollen
  for (const el of alle('[data-ziffern]')) {
    const verz = zahl(el.dataset.verz, 0);
    const stapel = ziffernBauen(el);
    ausloesen(el, () => {
      let k = 0;
      for (const { s, n } of stapel) {
        if (!n) continue;
        // leicht über die Ziffer hinaus zielen und dort anhalten, damit keine Ziffer halb stehen bleibt
        federLauf({ von: 0, bis: n + 0.6, steif: 150, daempf: 28, verz: verz + k * 45, bei: (v) => { s.style.transform = `translateY(${-Math.min(v, n) * 10}%)`; } });
        k += 1;
      }
    });
  }

  // Steigen aus einem Schlitz
  for (const el of alle('[data-steigen]')) {
    const verz = zahl(el.dataset.verz, 0);
    el.classList.add('st');
    const innen = span('st-innen');
    innen.append(...el.childNodes);
    el.append(innen);
    innen.style.transform = 'translateY(150%)';
    ausloesen(el, () => federLauf({ steif: 80, daempf: 26, verz, bei: (v) => { innen.style.transform = `translateY(${(1 - v) * 150}%)`; }, fertig: () => { innen.style.transform = ''; } }));
  }

  // Neigen
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    for (const el of alle('[data-neigen]')) neigenBauen(el, el.firstElementChild || el, null);
    for (const el of alle('[data-neigen-raum]')) neigenBauen(el, el, document.querySelector(el.dataset.neigenRaum));
  }

  // Scrub
  for (const el of alle('[data-scrub]')) {
    const [art, a, b] = el.dataset.scrub.split(':');
    const von = Number(a), bis = Number(b);
    const bereich = el.closest('section, footer') || document.body;
    const ziel = el.dataset.scrubZiel ? bereich.querySelector(el.dataset.scrubZiel) : (el.closest('[data-scrub-raum]') || el);
    scrubAnmelden({
      ziel: ziel || el, von: el.dataset.scrubVon, bis: el.dataset.scrubBis,
      bei: (p) => {
        const w = von + (bis - von) * p;
        el.style.transform = art === 'rot' ? `rotate(${w}deg)` : `translateY(${w}px)`;
      },
    });
  }
  scrubsRechnen(true);

  // Text teilen, sobald die Schriften stehen (sonst stimmen die Zeilen nicht)
  const textTeile = [];
  for (const el of alle('[data-zeilen], [data-woerter]')) { el.style.opacity = '0'; textTeile.push(el); }
  const schriften = document.fonts ? Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 1500))]) : Promise.resolve();
  const textBereit = schriften.then(() => {
    for (const el of textTeile) {
      const verz = zahl(el.dataset.verz, 0);
      if (el.hasAttribute('data-zeilen')) {
        let gezeigt = false;
        let innen = zeilenBauen(el);
        const verstecken = (liste) => liste.forEach((i) => { i.style.transform = 'translateY(110%)'; i.style.opacity = '0'; });
        verstecken(innen);
        el.style.opacity = '';
        let breite = el.clientWidth;
        new ResizeObserver(() => {
          if (Math.abs(el.clientWidth - breite) < 2) return;
          breite = el.clientWidth;
          innen = zeilenBauen(el);
          if (!gezeigt) verstecken(innen);
        }).observe(el);
        ausloesen(el, () => {
          gezeigt = true;
          innen.forEach((i, n) => verlauf({ dauer: 900, verz: verz + n * 90, glaettung: glatt.aussenKubisch, bei: (v) => { i.style.transform = `translateY(${(1 - v) * 110}%)`; i.style.opacity = String(v); }, fertig: () => { i.style.transform = ''; } }));
        });
      } else {
        const held = el.dataset.woerter === 'held';
        const woerter = woerterBauen(el);
        const y = held ? 16 : 14;
        woerter.forEach((w) => { w.style.transform = `translateY(${y}px)`; w.style.opacity = '0'; });
        el.style.opacity = '';
        ausloesen(el, () => woerter.forEach((w, n) => verlauf({
          dauer: held ? 650 : 620, verz: verz + n * (held ? 18 : 14), glaettung: glatt.aussenQuart,
          bei: (v) => { w.style.transform = `translateY(${(1 - v) * y}px)`; w.style.opacity = String(v); },
          fertig: () => { w.style.transform = ''; },
        })));
      }
    }
  });
  return { textBereit };
}
