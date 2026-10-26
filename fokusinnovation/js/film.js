// Fokus Innovation · der Film der Startseite (Prototyp 25.10.2026, dritte Fassung — ruhiger).
// Fünf Bilder, ein Motiv: vom Lärm zum Durchbruch, am Ende steht das Logo mit der Wortmarke. Der Fortschritt p (0 → 1) folgt dem
// Scrollen mit etwas Trägheit (das Scrollen bleibt das des Browsers); die Wörter erscheinen nach der Uhr, nicht am Scrollrad.
// „Bewegung reduzieren“ oder kein WebGL → ein Standbild mit dem fertigen Logo, die Seite liest sich normal.
import { szeneStarten, geschichte } from './szene.js';

const wurzel = document.documentElement;
const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const handy = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const film = document.querySelector('.film');
const canvas = document.querySelector('.szene');
const kopf = document.querySelector('.kopf');
const hinweis = document.querySelector('.hinweis');
const aufgaben = document.querySelector('.aufgaben');

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const span = (p, [a, b]) => clamp01((p - a) / (b - a));

// ── Der Ablauf: alle Bereiche von p an EINER Stelle ──
const ABLAUF = {
  aufgaben: [0.10, 0.22],     // die Aufgaben rund um den Gründer treten zurück
  fokus: [0.11, 0.33],        // die Punkte sammeln sich zum Kern: das Produkt
  momentum: [0.50, 0.68],     // ein Punkt löst sich und zieht die Bahn: das System
  durchbruch: [0.71, 0.80],   // er geht durch die Lücke nach außen: in den Markt
};
const BLENDE = 0.035;
const BLOECKE = [
  { name: 'laerm', bis: 0.13 },
  { name: 'fokus', von: 0.16, bis: 0.31 },
  { name: 'luecke', von: 0.34, bis: 0.48 },
  { name: 'momentum', von: 0.51, bis: 0.67 },
  { name: 'durchbruch', von: 0.70, bis: 0.84 },
  { name: 'ende', von: 0.87 },
].map((b) => ({ ...b, el: document.querySelector(`[data-block="${b.name}"]`), an: false, da: null }));

// Wörter einzeln, damit sie nacheinander erscheinen
const zaehler = new Map();
document.querySelectorAll('[data-woerter]').forEach((el) => {
  const block = el.closest('.block');
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

// Kopf: über dem Film hell auf dunkel, danach wie überall
const kopfHoehe = () => kopf.getBoundingClientRect().height;
function kopfSetzen() {
  const ueber = film.getBoundingClientRect().bottom > kopfHoehe() * 0.6;
  if (ueber !== kopf.classList.contains('ueber-film')) kopf.classList.toggle('ueber-film', ueber);
}
addEventListener('scroll', kopfSetzen, { passive: true });
kopfSetzen();

// ── Standbild: „Bewegung reduzieren“ oder kein WebGL ──
const szene = ruhig ? null : szeneStarten(canvas, { handy });
if (!szene) {
  wurzel.classList.add('ruhig');
  const still = szeneStarten(canvas, { handy });
  if (still) {
    const malen = () => {
      still.groesse();
      geschichte(still.zustand, { fokus: 1, momentum: 1, durchbruch: 1 });
      still.zustand.punkteSichtbar = 0;
      still.malen(4);
    };
    malen();
    addEventListener('resize', malen);
  } else {
    wurzel.classList.add('keingl');
  }
}

// ── Der eine Takt ──
let pGlatt = 0;
let letzte = performance.now();
let start = null;

function rohFortschritt() {
  const r = film.getBoundingClientRect();
  const weg = film.offsetHeight - innerHeight;
  return weg > 0 ? clamp01(-r.top / weg) : 0;
}

function anwenden(p, bereit) {
  if (hinweis) hinweis.style.opacity = String(1 - span(p, [0.005, 0.04]));
  if (aufgaben) {
    // Die Aufgaben ziehen sich zur Mitte und treten zurück, sobald der Fokus beginnt
    const weg = span(p, ABLAUF.aufgaben);
    aufgaben.style.opacity = ((bereit ? 1 : 0) * (1 - weg)).toFixed(3);
    aufgaben.style.transform = weg > 0 ? `scale(${(1 - 0.35 * weg).toFixed(4)})` : '';
  }
  for (const b of BLOECKE) {
    const ein = b.von === undefined ? (bereit ? 1 : 0) : span(p, [b.von, b.von + BLENDE]);
    const aus = b.bis === undefined ? 0 : span(p, [b.bis - BLENDE, b.bis]);
    const wert = ein * (1 - aus);
    const da = wert > 0.001;
    if (da !== b.da) { b.el.classList.toggle('da', da); b.da = da; }
    if (!da) { if (b.an) { b.el.classList.remove('an'); b.an = false; } continue; }
    b.el.style.opacity = wert.toFixed(3);
    const an = wert > 0.5 || (b.an && wert > 0.05);
    if (an !== b.an) { b.el.classList.toggle('an', an); b.an = an; }
  }
}

function takt(jetzt) {
  const dt = Math.min(0.064, (jetzt - letzte) / 1000);
  letzte = jetzt;
  const roh = rohFortschritt();
  pGlatt += (roh - pGlatt) * (1 - Math.exp(-dt * 6));
  if (Math.abs(roh - pGlatt) < 0.0002) pGlatt = roh;
  anwenden(pGlatt, start !== null);
  if (pGlatt < 0.999 && !document.hidden) {
    const z = szene.zustand;
    geschichte(z, { fokus: span(pGlatt, ABLAUF.fokus), momentum: span(pGlatt, ABLAUF.momentum), durchbruch: span(pGlatt, ABLAUF.durchbruch) });
    // Beim Start tauchen die Punkte langsam auf
    z.punkteSichtbar = start === null ? 0 : clamp01((jetzt - start) / 1800);
    szene.malen(jetzt / 1000);
  }
  requestAnimationFrame(takt);
}

if (szene) {
  // Erst wenn die Schrift da ist (höchstens 1,2 s), erscheinen die ersten Worte — kein Springen der Zeilen
  const los = () => { if (start === null) { start = performance.now(); canvas.classList.add('da'); } };
  document.fonts?.ready.then(los);
  setTimeout(los, 1200);
  addEventListener('resize', () => szene.groesse());
  requestAnimationFrame(takt);
}
