import { szeneStarten, geschichte, BRUCH } from './szene.js?v=abc6f98e65';

const wurzel = document.documentElement;
const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const handy = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const film = document.querySelector('.film');
const canvas = document.querySelector('.szene');
const kopf = document.querySelector('.kopf');
const hinweis = document.querySelector('.hinweis');
const aufgaben = document.querySelector('.aufgaben');
const ueberspringen = document.querySelector('.ueberspringen');
const anker = document.querySelector('.ende-anker');
const faden = document.querySelector('.faden');
const fadenPunkte = faden ? [...faden.querySelectorAll('.faden-punkt')] : [];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (p, [a, b]) => clamp01((p - a) / (b - a));

const ABLAUF = {
  aufgaben: [0.07, 0.19],
  fokus: [0.08, 0.27],
  luecke: [0.29, 0.40],
  momentum: [0.42, 0.58],
  durchbruch: [0.60, 0.79],
  ende: [0.79, 0.90],
};
const BLENDE = 0.035;
const BLOECKE = [
  { name: 'laerm', bis: 0.12 },
  { name: 'fokus', von: 0.13, bis: 0.27 },
  { name: 'luecke', von: 0.29, bis: 0.41 },
  { name: 'momentum', von: 0.43, bis: 0.58 },
  { name: 'durchbruch', von: 0.60, bis: 0.80 },
  { name: 'ende', von: 0.85 },
].map((b) => ({ ...b, el: document.querySelector(`[data-block="${b.name}"]`), an: false, da: null }));
const FADEN_STELLEN = [0, 0.13, 0.29, 0.43, 0.60, 0.85];

const zaehler = new Map();
document.querySelectorAll('[data-woerter]').forEach((el) => {
  const block = el.closest('.block');
  if (block?.dataset.block === 'laerm') return;
  const woerter = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  woerter.forEach((w, i) => {
    const n = zaehler.get(block) ?? 0;
    zaehler.set(block, n + 1);
    const s = document.createElement('span');
    s.className = 'fw';
    s.textContent = w;
    s.style.setProperty('--i', String(n));
    el.appendChild(s);
    if (i < woerter.length - 1) el.appendChild(document.createTextNode(' '));
  });
});

const kopfHoehe = () => kopf.getBoundingClientRect().height;
function kopfSetzen() {
  const unten = film.getBoundingClientRect().bottom;
  const ueber = unten > kopfHoehe() * 0.6;
  if (ueber !== kopf.classList.contains('ueber-film')) kopf.classList.toggle('ueber-film', ueber);
  const geht = ueber && unten < innerHeight - 2;
  if (geht !== kopf.classList.contains('film-geht')) kopf.classList.toggle('film-geht', geht);
}
addEventListener('scroll', kopfSetzen, { passive: true });
kopfSetzen();

const szene = ruhig ? null : szeneStarten(canvas, { handy, anker });
if (!szene) {
  wurzel.classList.add('ruhig');
  const still = szeneStarten(canvas, { handy, anker });
  if (still) {
    const malen = () => {
      still.groesse();
      geschichte(still.zustand, { fokus: 1, luecke: 1, momentum: 1, durchbruch: 1, ende: 1 });
      still.zustand.punkteSichtbar = 0;
      still.zustand.puls = 0;
      still.malen(4);
    };
    malen();
    addEventListener('resize', malen);
  } else {
    wurzel.classList.add('keingl');
  }
}

function rohFortschritt() {
  const r = film.getBoundingClientRect();
  const weg = film.offsetHeight - innerHeight;
  return weg > 0 ? clamp01(-r.top / weg) : 0;
}
let pGlatt = rohFortschritt();
let letzte = performance.now();
let start = null;
let impulsAb = -1e9;
let aktiv = null;
let knallAb = null;
let scharf = span(pGlatt, ABLAUF.durchbruch) < BRUCH;

function fadenSetzen(p, bereit) {
  if (!faden) return;
  let i = 0;
  while (i < FADEN_STELLEN.length - 2 && p >= FADEN_STELLEN[i + 1]) i++;
  const teil = clamp01((p - FADEN_STELLEN[i]) / (FADEN_STELLEN[i + 1] - FADEN_STELLEN[i]));
  faden.style.setProperty('--fp', ((i + teil) / (FADEN_STELLEN.length - 1)).toFixed(4));
  fadenPunkte.forEach((el, n) => { const an = p >= FADEN_STELLEN[n] - 0.002; if (an !== el.classList.contains('an')) el.classList.toggle('an', an); });
  faden.style.opacity = ((bereit ? 1 : 0) * (1 - span(p, [0.86, 0.93]))).toFixed(3);
}

function anwenden(p, bereit) {
  if (hinweis) hinweis.style.opacity = String(1 - span(p, [0.005, 0.04]));
  if (ueberspringen) {
    const weg = span(p, [0.86, 0.93]);
    ueberspringen.style.opacity = (1 - weg).toFixed(3);
    ueberspringen.style.visibility = weg >= 1 ? 'hidden' : '';
  }
  if (aufgaben) {
    const weg = span(p, ABLAUF.aufgaben);
    aufgaben.style.opacity = ((bereit ? 1 : 0) * (1 - weg)).toFixed(3);
    aufgaben.style.transform = weg > 0 ? `scale(${(1 - 0.35 * weg).toFixed(4)})` : '';
  }
  fadenSetzen(p, bereit);
  for (const b of BLOECKE) {
    const ein = b.von === undefined ? 1 : span(p, [b.von, b.von + BLENDE]);
    const aus = b.bis === undefined ? 0 : span(p, [b.bis - BLENDE, b.bis]);
    const wert = ein * (1 - aus);
    const da = wert > 0.001;
    if (da !== b.da) { b.el.classList.toggle('da', da); b.da = da; if (!da) b.el.style.opacity = '0'; }
    if (!da) { if (b.an) { b.el.classList.remove('an'); b.an = false; } continue; }
    b.el.style.opacity = wert.toFixed(3);
    const an = wert > 0.5 || (b.an && wert > 0.05);
    if (an !== b.an) { b.el.classList.toggle('an', an); b.an = an; }
    if (an && bereit && aktiv !== b.name) { if (aktiv !== null) impulsAb = performance.now(); aktiv = b.name; }
  }
}

function takt(jetzt) {
  const dt = Math.min(0.064, (jetzt - letzte) / 1000);
  letzte = jetzt;
  const roh = rohFortschritt();
  pGlatt += (roh - pGlatt) * (1 - Math.exp(-dt * 6));
  if (Math.abs(roh - pGlatt) < 0.0002) pGlatt = roh;
  anwenden(pGlatt, start !== null);
  const z = szene.zustand;
  const durch = span(pGlatt, ABLAUF.durchbruch);
  if (scharf && durch >= BRUCH) { knallAb = jetzt; scharf = false; } else if (!scharf && durch < BRUCH - 0.1) scharf = true;
  const knall = knallAb === null ? -1 : (jetzt - knallAb) / 1000;
  z.faden += 1.25 * dt;
  z.stromP += (0.1 + 0.85 * z.tempo) * dt;
  z.fahrt += 1.6 * z.tempo * dt;
  const leerlauf = Math.abs(roh - pGlatt) < 0.0002 && start !== null && jetzt - start > 1800 && jetzt - impulsAb > 1500 && (knall < 0 || knall > 2.5);
  bild++;
  if (!document.hidden && sichtbar && (!leerlauf || bild % 2 === 0)) {
    geschichte(z, { fokus: span(pGlatt, ABLAUF.fokus), luecke: span(pGlatt, ABLAUF.luecke), momentum: span(pGlatt, ABLAUF.momentum), durchbruch: durch, ende: span(pGlatt, ABLAUF.ende) });
    z.knall = knall >= 0 && knall < 3 ? knall : -1;
    const s = jetzt / 1000;
    z.wackel = [0, 0];
    if (z.knall >= 0) {
      const t = z.knall;
      const a = 1.4 * Math.exp(-5.5 * t);
      z.wackel = [a * Math.sin(63 * t), a * Math.cos(51 * t)];
      z.zoom *= 1 + 0.06 * Math.exp(-4 * t) * Math.min(1, 25 * t);
    }
    if (z.riss > 0 && z.glut < 0.01) {
      z.wackel[0] += 0.16 * z.riss * Math.sin(s * 57);
      z.wackel[1] += 0.16 * z.riss * Math.cos(s * 49);
    }
    z.punkteSichtbar = start === null ? 0 : clamp01((jetzt - start) / 1800);
    const b = start === null ? 0 : clamp01((jetzt - start) / 1400);
    z.bluete = 1 - Math.pow(1 - b, 3);
    z.impuls = Math.exp(-(jetzt - impulsAb) / 520) * 0.9;
    szene.malen(s);
  }
  if (sichtbar && !document.hidden) requestAnimationFrame(takt); else laeuft = false;
}
let bild = 0;
let sichtbar = true;
let laeuft = false;
function weiter() { if (!laeuft && sichtbar && !document.hidden) { laeuft = true; letzte = performance.now(); requestAnimationFrame(takt); } }

if (szene) {
  const los = () => { if (start === null) { start = performance.now(); canvas.classList.add('da'); } };
  document.fonts?.ready.then(los);
  setTimeout(los, 1200);
  addEventListener('resize', () => szene.groesse());
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; weiter(); }).observe(film);
  document.addEventListener('visibilitychange', weiter);
  weiter();
}
