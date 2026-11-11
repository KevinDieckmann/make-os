// seite.js · Lotwerk, Beispielseite für ein Bauunternehmen.
// Jeder Abschnitt startet für sich; scheitert einer, laufen die anderen weiter.
import Lenis from '../vendor/lenis/lenis.mjs';
import {
  ruhig, feinerZeiger, imTakt, nach, Feder, bewegung, F, ENTRY_DELAY, ENTRY_STAGGER,
  imBlick, scrub, worte, zaehler, rollen, beimZeigen,
} from './motor.js';
import { vorlader } from './vorlader.js';
import { film } from './film.js';

const wurzel = document.documentElement;
wurzel.classList.add('js');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MD = matchMedia('(min-width: 48rem)');
const LG = matchMedia('(min-width: 64rem)');

/** Einblenden: bei weniger Bewegung steht alles sofort an seinem Platz. */
const auf = (el, von, zu, feder) => bewegung(el, von, zu, feder, ruhig ? 1 : 0);

/** Staffel: was im selben Augenblick erscheint, kommt nacheinander. */
function staffel(basis, schritt) {
  let n = 0, zuletzt = 0;
  return () => {
    const t = performance.now();
    if (t - zuletzt > 140) n = 0;
    zuletzt = t;
    return basis + n++ * schritt;
  };
}

/* ─── Sanftes Scrollen ─── */
let lenis = null;
if (!ruhig) {
  try {
    lenis = new Lenis({ autoRaf: false, anchors: false, lerp: 0.1, smoothWheel: true });
    imTakt(t => lenis.raf(t));
  } catch (_) { lenis = null; }
}

/* ─── Bausteine, die mehrere Abschnitte brauchen ─── */
const woerter = new Map();
const zaehlerVon = new Map();
let menueOffen = false;

function bauen() {
  for (const el of $$('[data-worte]')) woerter.set(el, worte(el));
  for (const el of $$('[data-zahl]')) zaehlerVon.set(el, zaehler(el));
  if (ruhig) woerter.forEach(w => w.fertig());
}

/* Wurzelschrift wächst über 1440 px sanft weiter */
function schrift() {
  const setzen = () => {
    const w = innerWidth;
    wurzel.style.fontSize = w > 1440 ? (16 * (1 + ((w - 1440) / 1440) * 0.5)).toFixed(3) + 'px' : '';
  };
  setzen();
  addEventListener('resize', setzen, { passive: true });
}

/* ─── Kopf färbt sich mit, Untergrund federt zwischen Schwarz und Off-White ─── */
function kopfUndGrund() {
  const kopf = $('[data-kopf]');
  const dunkel = $('[data-grund-dunkel]');
  const sektionen = $$('main > section');
  const held = $('#oben');
  const boden = new Feder(1, F.boden, p => { dunkel.style.opacity = p.toFixed(3); });

  // Lage der Abschnitte merken (sie selbst stehen fest, nur ihr Inhalt gleitet): Scrollen kostet so kein Messen
  let lagen = [], kopfHoehe = 0, eigenerGrund = new Set();
  const messen = () => {
    lagen = sektionen.map(s => s.offsetTop);
    kopfHoehe = kopf.offsetHeight;
    eigenerGrund = new Set(sektionen.filter(s => {
      const farbe = getComputedStyle(s).backgroundColor;
      return farbe && farbe !== 'transparent' && farbe !== 'rgba(0, 0, 0, 0)';
    }));
  };
  /** Nummer des Abschnitts an einer Linie (px unter der Fensteroberkante). */
  const bei = linie => {
    const y = scrollY + linie;
    for (let i = lagen.length - 1; i > 0; i--) if (lagen[i] <= y) return i;
    return 0;
  };
  // Hell hält länger: Ein heller Block bestimmt den Grund, solange er die obere oder die untere Linie
  // erreicht. So steht seine dunkle Schrift nie auf Schwarz; der nächste dunkle Block beginnt mit Fotos.
  const inMitte = () => {
    const oben = sektionen[bei(innerHeight * 0.2)];
    return oben.dataset.grund === 'hell' ? oben : sektionen[bei(innerHeight * 0.65)];
  };
  // Farbe des Kopfes über einem Abschnitt: Blöcke mit eigenem Grund (Ablauf; der Held bis 1024 px und bei
  // weniger Bewegung, weil sich sein Foto dann nicht auflöst) geben ihre Farbe vor, alle anderen folgen dem Untergrund.
  const themaVon = (sek, mitte) => {
    const eigen = sek.dataset.kopfThema;
    if (eigen === 'weg') return 'weg';
    return (eigenerGrund.has(sek) || (ruhig && sek === held) ? eigen : mitte.dataset.kopfThema) || 'dunkel';
  };

  // Liegen zwei Abschnitte verschiedener Farbe unter dem Kopf, teilt er sich genau an ihrer Kante:
  // oben der Kopf selbst, unten eine zweite Fassung in der Farbe des nächsten Abschnitts.
  let zwilling = null, geteilt = false;
  const zwillingBauen = () => {
    zwilling = kopf.cloneNode(true);
    zwilling.classList.add('kopf-zwilling');
    zwilling.setAttribute('aria-hidden', 'true');
    zwilling.setAttribute('data-flaeche', '');
    zwilling.inert = true;
    for (const el of [zwilling, ...zwilling.querySelectorAll('*')]) {
      for (const name of ['data-kopf', 'data-kopf-zeichen', 'data-burger', 'data-burger-linie', 'aria-controls', 'aria-expanded', 'aria-label']) el.removeAttribute(name);
    }
    const zeichen = zwilling.querySelector('.kopf-zeichen');
    if (zeichen) zeichen.style.opacity = '';
    kopf.after(zwilling);
  };
  const thema = (el, t) => { if (el.dataset.thema !== t) el.dataset.thema = t; };

  const pruefen = () => {
    const mitte = inMitte();
    boden.setze(mitte.dataset.grund === 'hell' ? 0 : 1);
    const iUnten = bei(kopfHoehe - 0.5);
    const oben = sektionen[bei(0.5)], unten = sektionen[iUnten];
    const tOben = menueOffen ? 'dunkel' : themaVon(oben, mitte);
    const tUnten = menueOffen ? 'dunkel' : themaVon(unten, mitte);
    // Ganz oben über dem Heldenfoto bleibt der Kopf durchsichtig. Sobald gescrollt wird, trägt er die
    // Fläche des Grundes, damit keine Schrift unter ihm durchläuft.
    kopf.toggleAttribute('data-flaeche', unten !== held || scrollY > 8);

    if (tOben === tUnten) {
      if (geteilt) {
        // Die Kante ist durch: die neue Farbe gilt sofort, ohne Überblenden
        geteilt = false;
        thema(kopf, tUnten);
        kopf.style.clipPath = '';
        zwilling.hidden = true;
        void kopf.offsetWidth;
        kopf.removeAttribute('data-schnitt');
      } else thema(kopf, tUnten);
      kopf.inert = tUnten === 'weg';
      return;
    }
    if (!zwilling) zwillingBauen();
    const kante = Math.min(kopfHoehe, Math.max(0, lagen[iUnten] - scrollY));
    geteilt = true;
    kopf.setAttribute('data-schnitt', '');
    kopf.inert = false;
    thema(kopf, tOben);
    kopf.style.clipPath = `inset(0 0 ${(kopfHoehe - kante).toFixed(1)}px 0)`;
    thema(zwilling, tUnten);
    zwilling.hidden = tUnten === 'weg';
    zwilling.style.clipPath = `inset(${kante.toFixed(1)}px 0 -8px 0)`;
  };

  let wartet = false;
  const anstossen = () => {
    if (wartet) return;
    wartet = true;
    requestAnimationFrame(() => { wartet = false; pruefen(); });
  };
  // Mit sanftem Scrollen im selben Schritt wie die Scrollstelle, sonst im nächsten Bild
  lenis?.on('scroll', pruefen);
  addEventListener('scroll', anstossen, { passive: true });
  addEventListener('resize', () => { messen(); anstossen(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { messen(); anstossen(); }).observe($('main'));
  messen();
  boden.sofort(inMitte().dataset.grund === 'hell' ? 0 : 1);
  pruefen();
  return pruefen;
}

/* ─── Jeder Abschnitt gleitet beim Verlassen etwas nach und wird leiser ─── */
function fluss() {
  if (ruhig) return;
  for (const el of $$('[data-fluss]')) {
    const sek = el.closest('section');
    const f = new Feder(0, F.fluss, p => {
      if (p < 0.001) { el.style.transform = ''; el.style.opacity = ''; return; }
      el.style.transform = `translate3d(0, ${(50 * p).toFixed(2)}px, 0)`;
      el.style.opacity = (1 - 0.75 * p).toFixed(3);
    });
    // Der Film ist niedriger als das Fenster: Er wird erst leiser, wenn er zur Hälfte hinausgeglitten ist
    scrub(sek, el.dataset.fluss === 'spaet' ? 'bottom center' : 'bottom bottom', 'bottom top', p => f.setze(p));
  }
}

/* ─── Rollende Etiketten, wandernde Pfeile, Eckmarken, Füllung ─── */
function zeiger() {
  const ziele = new Map();
  const zielVon = el => el.closest('a, button, [data-ueber-bild]');
  const eintragen = (el, an, aus) => {
    const z = zielVon(el);
    if (!z) return;
    if (!ziele.has(z)) ziele.set(z, []);
    ziele.get(z).push([an, aus]);
  };
  for (const r of $$('[data-roll]')) {
    const f = rollen(r);
    eintragen(r, () => f.setze(1), () => f.setze(0));
  }
  for (const pfeil of $$('.pfeil')) {
    if (pfeil.closest('.ms-leiste')) continue;
    const [a, b] = pfeil.querySelectorAll('i');
    if (!b) continue;
    const fa = bewegung(a, { x: 0 }, { x: 16, halten: true }, F.pfeil);
    const fb = bewegung(b, { x: -16 }, { x: 0 }, F.pfeil);
    eintragen(pfeil, () => { fa.setze(1); fb.setze(1); }, () => { fa.setze(0); fb.setze(0); });
  }
  for (const fuell of $$('.kasten-fuellung')) {
    const f = new Feder(0, F.fuellen, p => { fuell.style.transform = `scaleY(${p.toFixed(4)})`; });
    eintragen(fuell, () => f.setze(1), () => f.setze(0));
  }
  for (const ecke of $$('.ecken')) {
    const f = new Feder(0, { ...F.ecke, ruhe: 0.005 }, w => ecke.style.setProperty('--spreizung', w.toFixed(3) + 'px'));
    const z = zielVon(ecke);
    if (!z) continue;
    if (!ziele.has(z)) ziele.set(z, []);
    ziele.get(z).push([() => f.setze(3), () => f.setze(0)]);
  }
  for (const [z, liste] of ziele) beimZeigen(z, () => liste.forEach(([an]) => an()), () => liste.forEach(([, aus]) => aus()));
}

/* ─── Auftritte: Etiketten, Zahlen, Fußzeile ─── */
function auftritte() {
  const verzug = staffel(ENTRY_DELAY, ENTRY_STAGGER);
  for (const el of $$('[data-auftritt]')) {
    const f = auf(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, F.auftritt);
    const zahl = el.querySelector('[data-zahl]');
    imBlick(el, () => {
      const d = verzug();
      nach(d, () => f.setze(1));
      if (zahl) zaehlerVon.get(zahl)?.start(d + 60);
    }, null, { schwelle: 0.1 });
  }
}

/* ─── Text Wort für Wort, sobald er ins Bild kommt ─── */
function textAuftritte() {
  const EXTRA = [['.ueber-titel', 120], ['.ueber-auftrag', 280], ['.team-titel', 120], ['.team-intro', 300]];
  for (const [el, w] of woerter) {
    if (el.closest('#oben, .projekt, .team-reihe')) continue;
    const extra = EXTRA.find(([s]) => el.matches(s))?.[1] ?? 0;
    const immer = el.hasAttribute('data-immer') && !ruhig;
    imBlick(el, () => w.zeigen(ENTRY_DELAY + extra), immer ? () => w.verbergen() : null, { schwelle: 0.1 });
  }
}

/* ─── 1 · Held ─── */
function held() {
  const sek = $('#oben');
  const titel = woerter.get($('.held-titel', sek));
  const zeilen = $$('.held-zeile', sek).map(el => woerter.get(el));
  const intro = woerter.get($('.held-intro', sek));
  const zahlen = $$('.held-zahlen li', sek).map(li => auf(li, { opacity: 0, y: 18 }, { opacity: 1, y: 0 }, F.auftritt));
  const links = $$('.held-aktionen .kasten-link', sek).map(a => auf(a, { opacity: 0, y: 16 }, { opacity: 1, y: 0 }, { k: 170, d: 26 }));
  const linie = $('.haarlinie', sek);
  const strich = new Feder(ruhig ? 1 : 0, { k: 120, d: 26 }, p => { linie.style.transform = p >= 1 ? '' : `scaleX(${p.toFixed(4)})`; });
  strich.melden();

  const ebene = $('[data-held-parallax]', sek);
  if (!ruhig) {
    const par = new Feder(0, F.parallaxe, p => { ebene.style.transform = p < 0.0005 ? '' : `translate3d(0, ${(22 * p).toFixed(3)}%, 0)`; });
    scrub(sek, 'top top', 'bottom top', p => par.setze(p));
  }

  return () => {
    titel?.zeigen(120);
    zeilen.forEach((w, i) => w?.zeigen(160 + i * 90));
    nach(200, () => strich.setze(1));
    intro?.zeigen(260);
    zahlen.forEach((f, i) => nach(220 + i * 110, () => f.setze(1)));
    links.forEach((f, i) => nach(320 + i * 90, () => f.setze(1)));
  };
}

/* ─── 2 · Über uns: Fotos wechseln, Leistungen leuchten mit ─── */
function ueber() {
  const sek = $('#ueber');
  const bild = $('[data-ueber-bild]', sek);
  const ablage = $('.ueber-fotos', sek);
  const fotos = $$('img', ablage);
  const themen = $$('.ueber-themen li', sek);
  const fotoFedern = fotos.map((img, i) => new Feder(i ? 0 : 1, { k: 420, d: 38 }, p => { img.style.opacity = p.toFixed(3); }));
  const themaFedern = themen.map((li, i) => new Feder(i ? 0 : 1, { k: 260, d: 30 }, p => { li.style.opacity = (0.55 + 0.45 * p).toFixed(3); }));
  fotoFedern.forEach(f => f.melden());
  themaFedern.forEach(f => f.melden());

  let index = 0;
  const zeige = i => {
    const vorher = index;
    index = i;
    fotos.forEach((img, j) => { if (j !== i && j !== vorher) fotoFedern[j].sofort(0); });
    ablage.append(fotos[i]);
    fotoFedern[i].sofort(0);
    fotoFedern[i].setze(1);
    const t = Math.floor((i * themen.length) / fotos.length);
    themaFedern.forEach((f, j) => f.setze(j === t ? 1 : 0));
  };

  if (!ruhig) {
    // Die erste Runde blättert zügig durch, danach wechselt das Foto in Ruhe
    let uhr = 0, gezeigt = 0;
    const weiter = () => {
      zeige((index + 1) % fotos.length);
      uhr = setTimeout(weiter, ++gezeigt < fotos.length ? 520 : 2600);
    };
    new IntersectionObserver(([e]) => {
      clearTimeout(uhr);
      if (e.isIntersecting) uhr = setTimeout(weiter, 450);
    }, { threshold: 0.3 }).observe(bild);
  }

  // Knopf erscheint beim Überfahren (nur mit Maus), sonst steht er
  const knopf = $('.ueber-knopf', bild);
  if (feinerZeiger() && MD.matches) {
    const f = bewegung(knopf, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }, { k: 420, d: 30 });
    beimZeigen(bild, () => f.setze(1), () => f.setze(0));
  }
}

/* ─── 3 · Projekte: Masken öffnen sich, Bilder setzen sich, Drift beim Scrollen ─── */
function projekte() {
  const sek = $('#projekte');
  const karten = $$('.projekt', sek);
  const wahl = $('[data-projektart-wahl]');
  const verzug = staffel(180, 180);
  const knopfHover = feinerZeiger() && MD.matches;

  karten.forEach(karte => {
    const maske = $('.projekt-maske', karte);
    const bildEbene = $('.projekt-bild', karte);
    const img = $('img', bildEbene);
    const etikett = $('.projekt-etikett', karte);
    const name = woerter.get($('.projekt-name', karte));
    const knopf = $('.projekt-knopf', karte);

    const oeffnen = auf(maske, { clip: [0, 0, 100, 0] }, { clip: [0, 0, 0, 0] }, { k: 70, d: 24, klemmen: true });
    const setzen = auf(img, { scale: 1.18 }, { scale: 1 }, { k: 60, d: 26 });
    const schild = auf(etikett, { opacity: 0, y: -8 }, { opacity: 1, y: 0 }, F.auftritt);
    imBlick(karte, () => {
      const d = verzug();
      nach(d, () => { oeffnen.setze(1); setzen.setze(1); });
      nach(d + 420, () => schild.setze(1));
      name?.zeigen(d + 420);
    }, null, { schwelle: 0.15 });

    if (!ruhig) {
      let weite = 0;
      const masse = () => { weite = Math.min(parseFloat(karte.dataset.drift || '60'), karte.offsetHeight * 0.15); };
      masse();
      addEventListener('resize', masse, { passive: true });
      const drift = new Feder(0, F.parallaxe, p => {
        bildEbene.style.transform = `translate3d(0, ${(-weite + 2 * weite * p).toFixed(2)}px, 0)`;
      });
      scrub(sek, 'top bottom', 'bottom top', p => drift.setze(p));
    }

    if (knopfHover) {
      const f = bewegung(knopf, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }, { k: 420, d: 30 });
      beimZeigen(karte, () => f.setze(1), () => f.setze(0));
    }

    karte.addEventListener('click', () => {
      const art = karte.dataset.projektart;
      if (wahl && [...wahl.options].some(o => o.value === art || o.text === art)) {
        wahl.value = art;
        wahl.dispatchEvent(new Event('change'));
      }
    });
  });
}

/* ─── 4 · Baustelle: der Film öffnet sich wie eine Blende, das Lot pendelt mit dem Scrollen aus ─── */
function baustelle() {
  const sek = $('#baustelle');
  const rahmen = $('[data-film]', sek);
  const maske = $('[data-film-maske]', sek);
  const ebene = $('[data-film-ebene]', sek);
  const lot = $('[data-film-lot]', sek);
  film(rahmen);
  if (ruhig) return;

  const oeffnen = new Feder(0, F.parallaxe, p => {
    const q = 1 - p;
    if (q < 0.002) { maske.style.clipPath = ''; ebene.style.transform = ''; return; }
    maske.style.clipPath = `inset(${(9 * q).toFixed(2)}% ${(13 * q).toFixed(2)}%)`;
    ebene.style.transform = `scale(${(1 + 0.16 * q).toFixed(4)})`;
  });
  oeffnen.melden();
  scrub(rahmen, 'top bottom', 'center center', p => oeffnen.setze(p));

  // Das Lot hängt am Rahmen: Es schlägt mit dem Scrollen aus und pendelt sich wieder ein
  const pendel = new Feder(0, { k: 26, d: 2.4, ruhe: 0.02 }, w => { lot.style.transform = Math.abs(w) < 0.02 ? '' : `rotate(${w.toFixed(3)}deg)`; });
  let yVor = scrollY, tVor = performance.now();
  scrub(sek, 'top bottom', 'bottom top', () => {
    const t = performance.now();
    const dt = t - tVor;
    if (dt < 16) return;
    const tempo = (scrollY - yVor) / dt;
    yVor = scrollY; tVor = t;
    pendel.setze(Math.max(-7, Math.min(7, -tempo * 3.2)));
  });
}

/* ─── 5 · Ablauf: fünf Schritte, eine kippende Bühne ─── */
function ablauf() {
  const sek = $('[data-ablauf]');
  const schritte = $$('[data-schritt]', sek);
  const bilderEl = $('[data-buehne-bilder]', sek);
  const bilder = $$('img', bilderEl);
  const text = $('[data-ablauf-text]', sek);
  const dreh = $('[data-buehne-dreh]', sek);
  const kipp = $('[data-buehne-kipp]', sek);
  const par = $('[data-buehne-parallax]', sek);
  let aktiv = 0;

  // Ab 1024 px liegen die übrigen Schritte unscharf hinter dem Bild; darunter stehen sie lesbar als Liste
  const schrittFedern = schritte.map((s, i) => new Feder(i ? 0 : 1, { k: 220, d: 30 }, p => {
    const breit = LG.matches;
    s.style.opacity = (breit ? 0.3 + 0.7 * p : 0.42 + 0.58 * p).toFixed(3);
    const b = breit ? 5 * (1 - p) : 0;
    s.style.filter = b < 0.05 ? 'none' : `blur(${b.toFixed(2)}px)`;
  }));
  LG.addEventListener('change', () => schrittFedern.forEach(f => f.melden()));
  schrittFedern.forEach(f => f.melden());
  const bildFedern = bilder.map((img, i) => new Feder(i ? 0 : 1, { k: 320, d: 34 }, p => { img.style.opacity = p.toFixed(3); }));
  bildFedern.forEach(f => f.melden());
  const drehung = new Feder(-10, { k: 170, d: 22, ruhe: 0.01 }, w => { dreh.style.transform = `rotate(${w.toFixed(3)}deg)`; });
  drehung.melden();

  // Neigung folgt der Maus, das Bild hängt leicht nach
  const kippen = { x: 0, y: 0, lx: 0, ly: 0 };
  const malen = () => {
    kipp.style.transform = `rotateX(${kippen.x.toFixed(3)}deg) rotateY(${kippen.y.toFixed(3)}deg)`;
    bilderEl.style.transform = `translate3d(${kippen.lx.toFixed(2)}px, ${kippen.ly.toFixed(2)}px, 0) scale(1.12)`;
  };
  const kippFeder = schluessel => new Feder(0, { k: 150, d: 24, ruhe: 0.01 }, w => { kippen[schluessel] = w; malen(); });
  const kx = kippFeder('x'), ky = kippFeder('y'), lx = kippFeder('lx'), ly = kippFeder('ly');

  if (!ruhig) {
    const parF = new Feder(0, F.parallaxe, p => {
      const hub = LG.matches ? 70 : 18;
      par.style.transform = `translate3d(0, ${(hub - 2 * hub * p).toFixed(2)}px, 0)`;
    });
    scrub(sek, 'top bottom', 'bottom top', p => parF.setze(p));
  }

  let textWorte = null;
  const textSetzen = (i, zeigen) => {
    text.style.setProperty('--breite', schritte[i].dataset.breite + 'rem');
    textWorte = worte(text, 'text', schritte[i].dataset.text);
    if (zeigen || ruhig) textWorte.zeigen(0);
  };
  textSetzen(0, false);
  imBlick(text, () => textWorte.zeigen(ENTRY_DELAY + 200), null, { schwelle: 0.1 });

  const waehlen = i => {
    if (i === aktiv) return;
    const vorher = aktiv;
    aktiv = i;
    schritte.forEach((s, j) => { s.setAttribute('aria-pressed', String(j === i)); schrittFedern[j].setze(j === i ? 1 : 0); });
    bilder.forEach((img, j) => { if (j !== i && j !== vorher) bildFedern[j].sofort(0); });
    bilderEl.append(bilder[i]);
    bildFedern[i].sofort(0);
    bildFedern[i].setze(1);
    drehung.setze(30 - (bilder.length - 1 - i) * 10);
    textSetzen(i, true);
  };

  // Läuft von selbst weiter, solange der Abschnitt gut sichtbar ist und niemand eingreift
  let sichtbar = false, eingegriffen = false, uhr = 0;
  const planen = () => {
    clearTimeout(uhr);
    if (sichtbar && !eingegriffen && !ruhig) uhr = setTimeout(() => { waehlen((aktiv + 1) % schritte.length); planen(); }, 3800);
  };
  new IntersectionObserver(([e]) => {
    sichtbar = e.isIntersecting && e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.4, innerHeight * 0.5);
    planen();
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] }).observe(sek);
  const eingreifen = () => { eingegriffen = true; clearTimeout(uhr); };

  schritte.forEach((s, i) => {
    s.addEventListener('click', () => { eingreifen(); waehlen(i); });
    s.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { eingreifen(); waehlen(i); } });
    s.addEventListener('focus', () => { if (s.matches(':focus-visible')) { eingreifen(); waehlen(i); } });
  });

  sek.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || ruhig) return;
    const r = sek.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    ky.setze(nx * 12); kx.setze(-ny * 9);
    lx.setze(-nx * 18); ly.setze(-ny * 18);
  });
  sek.addEventListener('pointerleave', () => { kx.setze(0); ky.setze(0); lx.setze(0); ly.setze(0); });
}

/* ─── 6 · Team: Reihen erscheinen nacheinander, jede mit ihrem Porträt ─── */
function team() {
  const rahmen = $('[data-team-reihen]');
  const reihen = $$('.team-reihe', rahmen);
  const reiheFedern = reihen.map(r => auf(r, { opacity: 0, y: -28, blur: 14 }, { opacity: 1, y: 0, blur: 0 }, { k: 55, d: 22 }));
  const fotoFedern = reihen.map(r => auf($('.team-foto img', r), { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1 }, { k: 480, d: 42 }));
  imBlick(rahmen, () => {
    reihen.forEach((r, i) => {
      const d = 180 + i * 220;
      nach(d, () => reiheFedern[i].setze(1));
      nach(d + 120, () => fotoFedern[i].setze(1));
      woerter.get($('.team-bio', r))?.zeigen(d + 260);
    });
  }, null, { schwelle: 0.12 });
}

/* ─── 7 · Kontakt: Foto gleitet, Karte erscheint ─── */
function kontakt() {
  const sek = $('#kontakt');
  const ebene = $('[data-kontakt-parallax]', sek);
  if (!ruhig) {
    const f = new Feder(0, F.parallaxe, p => { ebene.style.transform = `translate3d(0, ${(-15 + 15 * p).toFixed(3)}%, 0)`; });
    f.melden();
    scrub(sek, 'top bottom', 'bottom bottom', p => f.setze(p));
  }
  const karte = $('[data-formular]', sek);
  const f = auf(karte, { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, F.auftritt);
  imBlick(karte, () => nach(ENTRY_DELAY, () => f.setze(1)), null, { schwelle: 0.1 });
}

/* ─── Formular sendet nichts ─── */
function formular() {
  const form = $('[data-formular]');
  const meldung = $('[data-meldung]', form);
  const wahl = $('[data-projektart-wahl]', form);
  const leer = () => wahl.classList.toggle('leer', !wahl.value);
  leer();
  wahl.addEventListener('change', leer);
  // Eigene, ruhige Hinweise statt der Sprechblasen des Browsers: Felder werden markiert und beim Namen genannt
  form.noValidate = true;
  const pflicht = $$('[required]', form);
  const NAMEN = { vorname: 'Vorname', email: 'E-Mail', ort: 'Ort des Vorhabens', zustimmung: 'Einverständnis' };
  const pruefe = feld => {
    const gut = feld.checkValidity();
    feld.closest('label')?.classList.toggle('fehler', !gut);
    if (gut) feld.removeAttribute('aria-invalid'); else feld.setAttribute('aria-invalid', 'true');
    return gut;
  };
  for (const feld of pflicht) {
    feld.addEventListener(feld.type === 'checkbox' ? 'change' : 'input', () => {
      if (feld.hasAttribute('aria-invalid')) pruefe(feld);
    });
  }
  const senden = e => {
    e?.preventDefault();
    const offen = pflicht.filter(feld => !pruefe(feld));
    if (offen.length) {
      meldung.dataset.art = 'fehler';
      meldung.textContent = 'Bitte ergänzen Sie noch: '
        + offen.map(f => (NAMEN[f.name] || f.name) + (f.validity.valueMissing ? '' : ' (bitte prüfen)')).join(', ') + '.';
      offen[0].focus();
      return;
    }
    meldung.dataset.art = 'gut';
    meldung.textContent = 'Dies ist eine Beispielseite. Ihre Angaben werden nicht gesendet.';
  };
  $('[data-absenden]', form).addEventListener('click', senden);
  form.addEventListener('submit', senden);
}

/* ─── Menü fürs Handy ─── */
function menue(kopfPruefen) {
  const knopf = $('[data-burger]');
  const m = $('[data-menue]');
  const [a, b] = $$('[data-burger-linie]', knopf);
  const la = bewegung(a, { y: 5, rotate: 0 }, { y: 8, rotate: 45 }, F.burger);
  const lb = bewegung(b, { y: 11, rotate: 0 }, { y: 8, rotate: -45 }, F.burger);
  const eintraege = $$('nav a, .menue-ort, .menue-knopf', m).map(el => bewegung(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0 }, F.auftritt));
  m.setAttribute('data-lenis-prevent', '');

  const setzen = offen => {
    menueOffen = offen;
    m.hidden = !offen;
    knopf.setAttribute('aria-expanded', String(offen));
    la.setze(offen ? 1 : 0);
    lb.setze(offen ? 1 : 0);
    if (offen) {
      lenis?.stop();
      if (!lenis) wurzel.style.overflow = 'hidden';
      eintraege.forEach((f, i) => { f.sofort(0); nach(60 + i * 45, () => f.setze(1)); });
      m.querySelector('a')?.focus();
    } else {
      lenis?.start();
      wurzel.style.overflow = '';
    }
    kopfPruefen?.();
  };
  knopf.addEventListener('click', () => setzen(!menueOffen));
  addEventListener('keydown', e => { if (e.key === 'Escape' && menueOffen) { setzen(false); knopf.focus(); } });
  m.addEventListener('click', e => { if (e.target.closest('a')) setzen(false); });
  MD.addEventListener('change', e => { if (e.matches && menueOffen) setzen(false); });
}

/* ─── Sprungmarken über das sanfte Scrollen, danach Fokus ans Ziel ─── */
function anker() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href').slice(1);
    const ziel = id && document.getElementById(id);
    if (!ziel) return;
    e.preventDefault();
    const fokus = () => {
      if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1');
      ziel.focus({ preventScroll: true });
    };
    const oben = id === 'oben';
    if (lenis) lenis.scrollTo(oben ? 0 : ziel, { onComplete: fokus });
    else {
      if (oben) scrollTo(0, 0); else ziel.scrollIntoView();
      fokus();
    }
  });
}

/* ─── Ruhiger Hinweis, wenn Bilder fehlen ─── */
function bildFehler() {
  const hinweis = $('[data-ladehinweis]');
  let uhr = 0;
  const melden = img => {
    img.classList.add('fehlt');
    img.parentElement?.classList.add('bild-fehlt');
    hinweis.hidden = false;
    clearTimeout(uhr);
    uhr = setTimeout(() => { hinweis.hidden = true; }, 12000);
  };
  for (const img of $$('img')) {
    if (img.closest('.ms-leiste')) continue;
    if (img.loading !== 'lazy' && img.complete && img.naturalWidth === 0) melden(img);
    else img.addEventListener('error', () => melden(img), { once: true });
  }
}

/* ─── Übrige Bilder in Ruhe vorladen, damit beim Scrollen nichts nachkommt ─── */
function aufwaermen() {
  const naechster = window.requestIdleCallback || (fn => setTimeout(fn, 200));
  const los = () => {
    const liste = $$('img[loading="lazy"]');
    let i = 0;
    const weiter = frist => {
      while (i < liste.length && (!frist || frist.timeRemaining() > 4)) liste[i++].loading = 'eager';
      if (i < liste.length) naechster(weiter);
    };
    naechster(weiter);
  };
  if (document.readyState === 'complete') los();
  else addEventListener('load', los, { once: true });
}

/* ─── Start ─── */
const versuchen = (fn, ...arg) => {
  try { return fn(...arg); } catch (fehler) { console.error('Lotwerk ·', fn.name, fehler); return null; }
};

versuchen(schrift);
versuchen(bauen);
const kopfPruefen = versuchen(kopfUndGrund);
versuchen(zeiger);
versuchen(fluss);
versuchen(auftritte);
versuchen(textAuftritte);
const heldZeigen = versuchen(held) || (() => woerter.forEach(w => w.fertig()));
versuchen(ueber);
versuchen(projekte);
versuchen(baustelle);
versuchen(ablauf);
versuchen(team);
versuchen(kontakt);
versuchen(formular);
versuchen(menue, kopfPruefen);
versuchen(anker);
versuchen(bildFehler);

const freigabe = () => { heldZeigen(); aufwaermen(); };
const notbremse = versuchen(vorlader, { lenis, uebergabe: freigabe });
if (notbremse) setTimeout(notbremse, 6000);
else {
  // Ladefeld konnte nicht starten: sofort weg, Seite steht
  $('[data-vorlader]')?.remove();
  const kz = $('[data-kopf-zeichen]');
  if (kz) kz.style.opacity = '';
  lenis?.start();
  freigabe();
}
