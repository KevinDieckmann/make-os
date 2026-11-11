// Firstlinie Dach & Sanierung · Bewegung und Bedienung der Beispielseite.
// Alle Startzustände setzt dieses Skript; ohne Skript oder bei „weniger Bewegung“ gilt der ruhige Endzustand aus dem CSS.
import {
  SPRING, SPRING_REVEAL, SPRING_CAMERA, SPRING_SOFT, SPRING_POP, SPRING_DRAW, LIFT,
  TYPE_STAGGER, REVEAL_MARGIN, klemme, easeInOutCubic, Feder, stilSchreiber, beiSicht, erscheinen, scrollen, teilen,
} from './feder.js';
import { filme } from './film.js';

const html = document.documentElement;
html.classList.add('js');

const RUHE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AB_768 = matchMedia('(min-width: 48rem)');
const AB_1024 = matchMedia('(min-width: 64rem)');
const AB_1440 = matchMedia('(min-width: 90rem)');
const ZEIGER = matchMedia('(hover: hover) and (pointer: fine)');
const LOAD_DELAY = 1500;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rem = () => parseFloat(getComputedStyle(html).fontSize) || 16;
let lenis = null;

// Ein Fehler in einem Teil darf die übrigen nie aufhalten.
function sicher(fn) {
  try { fn(); } catch (e) { console.warn(e); }
}

// Größenänderungen gebündelt, einmal je Bild.
const groessen = new Set();
let groesseRaf = 0;
addEventListener('resize', () => {
  cancelAnimationFrame(groesseRaf);
  groesseRaf = requestAnimationFrame(() => groessen.forEach(f => sicher(f)));
});
const beiGroesse = f => { groessen.add(f); return f; };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => groessen.forEach(f => sicher(f)));

// Zeitgesteuertes Erscheinen (für den ersten Bildschirm nach der Eröffnung).
function zeitlich(el, von, zu, cfg, verzoegerung, schreiber) {
  if (!el) return null;
  const f = new Feder(von, schreiber || stilSchreiber(el));
  f.schreiben(f.wert);
  f.nach(zu, cfg, verzoegerung);
  return f;
}

// Buchstaben nacheinander zeigen (Schreibmaschine ohne Textwechsel, also ohne Sprünge im Satz).
function tippen(zeichen, start, abstand = TYPE_STAGGER) {
  const uhren = [];
  zeichen.forEach((z, i) => {
    z.style.opacity = '0';
    uhren.push(setTimeout(() => { z.style.opacity = '1'; }, start + i * abstand));
  });
  return () => uhren.forEach(clearTimeout);
}

// ── Ruhiger Hinweis, wenn etwas Wichtiges nicht lädt ──
let hinweisGezeigt = false;
function hinweis(text) {
  if (hinweisGezeigt) return;
  const p = $('.hinweis-laden');
  const t = p && $('.hl-text', p);
  if (!t) return;
  hinweisGezeigt = true;
  t.textContent = text;
  p.classList.add('zeigen');
  setTimeout(() => p.classList.remove('zeigen'), 6000);
}
const BILD_TEXT = 'Einige Bilder konnten nicht geladen werden. Die Seite funktioniert trotzdem.';
document.addEventListener('error', e => {
  if (e.target instanceof HTMLImageElement) hinweis(BILD_TEXT);
}, true);
for (const img of $$('img.wichtig')) {
  if (img.complete && img.naturalWidth === 0 && img.currentSrc) hinweis(BILD_TEXT);
}
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    for (const f of document.fonts) {
      if (f.status === 'error') { hinweis('Die Schrift konnte nicht geladen werden. Die Seite funktioniert trotzdem.'); break; }
    }
  });
}

// ── Eröffnung: Hauszeichen, Zähler, Firstfalte ──
function eroeffnung() {
  const tafel = $('.oeffnung');
  if (!tafel) return Promise.resolve();
  if (RUHE) { tafel.classList.add('weg'); return Promise.resolve(); }

  html.classList.add('oe-js', 'oe-laeuft');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  return new Promise(fertig => {
    let vorbei = false;
    const schliessen = () => {
      if (vorbei) return;
      vorbei = true;
      clearTimeout(notbremse);
      tafel.classList.add('weg');
      html.classList.remove('oe-laeuft');
      fertig();
    };
    // Höchstens drei Sekunden, auch wenn unterwegs etwas hängt.
    const notbremse = setTimeout(schliessen, 3000);

    try {
      const haus = $('.oe-haus', tafel);
      const falze = $$('.oe-falz', tafel);
      const zahl = $('.oe-zahl', tafel);
      const fuellung = $('.oe-fuellung', tafel);
      const mitte = $('.oe-mitte', tafel);

      haus.style.strokeDasharray = '1';
      const linie = new Feder({ d: 1, f: 0 }, w => {
        haus.style.strokeDashoffset = w.d.toFixed(4);
        haus.style.fillOpacity = klemme(w.f).toFixed(3);
      });
      linie.schreiben(linie.wert);
      linie.nach({ d: 0 }, SPRING_DRAW, 100);
      setTimeout(() => linie.nach({ d: 0, f: 1 }, { duration: 420, easing: easeInOutCubic }), 650);

      falze.forEach((r, i) => zeitlich(r, { scaleY: 0 }, { scaleY: 1 }, SPRING, 700 + i * 120));

      zeitlich(zahl, { n: 0 }, { n: 100 }, { duration: 1200, easing: easeInOutCubic }, 0, w => {
        zahl.textContent = String(Math.round(w.n)).padStart(3, '0');
        fuellung.style.transform = `scaleX(${(w.n / 100).toFixed(4)})`;
      });

      setTimeout(() => {
        new Feder({ y: 0, opacity: 1 }, stilSchreiber(mitte)).nach({ y: -16, opacity: 0 }, SPRING);
      }, 1200);

      setTimeout(() => {
        new Feder({ l: 0 }, w => {
          const falte = Math.min(1, w.l * 1.6) * 16;
          tafel.style.transform = `translate3d(0, ${(-w.l * 100).toFixed(3)}%, 0)`;
          tafel.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${falte.toFixed(2)}vh), 0 100%)`;
        }).nach({ l: 1 }, LIFT);
      }, 1260);

      setTimeout(schliessen, 2210);
    } catch (e) {
      console.warn(e);
      schliessen();
    }
  });
}

// ── Sanftes Scrollen (nur mit Bewegung) ──
async function glatt() {
  if (RUHE) return;
  try {
    const m = await import('../vendor/lenis/lenis.mjs');
    lenis = new m.default({ autoRaf: true });
    if (html.classList.contains('oe-laeuft') || html.classList.contains('gesperrt')) lenis.stop();
  } catch (e) {
    lenis = null;
  }
}

// Sprung zu einem Abschnitt: weich, mit Fokus für die Tastatur.
function springeZu(hash, verzoegerung = 0) {
  let ziel = null;
  try { ziel = document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { ziel = null; }
  if (!ziel) return false;
  const los = () => {
    if (lenis) lenis.scrollTo(ziel, { duration: 1.2 });
    else ziel.scrollIntoView({ behavior: RUHE ? 'auto' : 'smooth', block: 'start' });
    if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1');
    ziel.focus({ preventScroll: true });
    if (location.hash !== hash) history.replaceState(null, '', hash);
  };
  if (verzoegerung) setTimeout(los, verzoegerung); else los();
  return true;
}

// ── Kopf: Glas, Plakette, Menü ──
let menueSchliessen = () => {};
function kopf() {
  const k = $('.kopf');
  if (!k) return;

  // Glas, solange der Kopf über dem Bild liegt.
  const box = $('.held-box');
  if (box) {
    new IntersectionObserver(([e]) => k.classList.toggle('glas', e.isIntersecting), { rootMargin: '-88px 0px 0px 0px' }).observe(box);
  }

  // Erscheinen nach der Eröffnung.
  if (!RUHE) $$('.kopf-stueck', k).forEach((el, i) => zeitlich(el, { y: -30, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, LOAD_DELAY + 70 * i));

  // Plakette unter dem aktiven bzw. gezeigten Link.
  const pille = $('.kopf-pille', k);
  const plakette = $('.kp-plakette', k);
  const links = $$('.kp-link', k);
  const menueLinks = $$('.menue-link');
  const sektionen = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  let aktiv = 0;
  let gezeigt = null;
  const pf = new Feder({ x: 0, w: 0 }, w => {
    plakette.style.transform = `translate3d(${w.x.toFixed(2)}px, 0, 0)`;
    plakette.style.width = `${Math.max(0, w.w).toFixed(2)}px`;
  });
  const ziel = i => ({ x: links[i].offsetLeft, w: links[i].offsetWidth });
  const sichtbar = () => pille && pille.offsetWidth > 0;
  const zeichnen = (sofort = false) => {
    const i = gezeigt ?? aktiv;
    links.forEach((a, j) => a.classList.toggle('aktiv', j === i));
    menueLinks.forEach((a, j) => a.classList.toggle('aktiv', j === aktiv));
    if (!sichtbar()) return;
    if (sofort || RUHE) pf.setze(ziel(i)); else pf.nach(ziel(i), SPRING);
  };
  beiGroesse(() => { if (sichtbar()) { pf.setze(ziel(gezeigt ?? aktiv)); k.classList.add('mit-plakette'); } });
  if (sichtbar()) { pf.setze(ziel(0)); k.classList.add('mit-plakette'); }

  links.forEach((a, i) => {
    a.addEventListener('pointerenter', () => { gezeigt = i; zeichnen(); });
    a.addEventListener('focus', () => { gezeigt = i; zeichnen(); });
  });
  pille.addEventListener('pointerleave', () => { gezeigt = null; zeichnen(); });
  pille.addEventListener('focusout', e => { if (!pille.contains(e.relatedTarget)) { gezeigt = null; zeichnen(); } });

  // Aktiver Abschnitt folgt dem Scrollen.
  let spyRaf = 0;
  const spy = () => {
    spyRaf = 0;
    const linieY = innerHeight * 0.35;
    let i = 0;
    sektionen.forEach((s, j) => { if (s && s.getBoundingClientRect().top <= linieY) i = j; });
    if (i !== aktiv) { aktiv = i; zeichnen(); }
  };
  addEventListener('scroll', () => { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }, { passive: true });
  spy();

  // Menü am Telefon und Tablet.
  const knopf = $('.kopf-menue', k);
  const menue = $('#menue');
  if (!knopf || !menue) return;
  const oben = $('.km-oben', k);
  const unten = $('.km-unten', k);
  const mFuss = $('.menue-fuss', menue);
  const teile = [...menueLinks, mFuss].filter(Boolean);
  let offen = false;

  const flaeche = new Feder({ i: 1 }, w => {
    const rand = innerWidth < 768 ? 1.25 : 2;
    const i = klemme(w.i);
    menue.style.opacity = klemme(1 - i).toFixed(3);
    menue.style.clipPath = `inset(${(i * 44).toFixed(2)}px ${(i * rand).toFixed(3)}rem ${(i * 100).toFixed(2)}% ${(i * 100).toFixed(2)}% round ${(i * 1.75).toFixed(3)}rem)`;
  });
  const balken = new Feder({ c: 0 }, w => {
    oben.style.transform = `translateY(${(w.c * 5.25).toFixed(2)}px) rotate(${(w.c * 45).toFixed(2)}deg)`;
    unten.style.transform = `translateY(${(-w.c * 5.25).toFixed(2)}px) rotate(${(-w.c * 45).toFixed(2)}deg)`;
  });
  const teilFedern = teile.map(el => new Feder({ y: 24, opacity: 0 }, stilSchreiber(el)));

  const auf = () => {
    if (offen) return;
    offen = true;
    menue.hidden = false;
    k.classList.add('menue-auf');
    html.classList.add('gesperrt');
    if (lenis) lenis.stop();
    knopf.setAttribute('aria-expanded', 'true');
    knopf.setAttribute('aria-label', 'Menü schließen');
    if (RUHE) {
      flaeche.setze({ i: 0 }); balken.setze({ c: 1 });
      teilFedern.forEach(f => f.setze({ y: 0, opacity: 1 }));
      return;
    }
    flaeche.nach({ i: 0 }, SPRING);
    balken.nach({ c: 1 }, SPRING);
    teilFedern.forEach((f, j) => { f.setze({ y: 24, opacity: 0 }); f.nach({ y: 0, opacity: 1 }, SPRING_REVEAL, 120 + 60 * j); });
  };
  const zu = (fokus = true) => {
    if (!offen) return;
    offen = false;
    k.classList.remove('menue-auf');
    html.classList.remove('gesperrt');
    if (lenis && !html.classList.contains('oe-laeuft')) lenis.start();
    knopf.setAttribute('aria-expanded', 'false');
    knopf.setAttribute('aria-label', 'Menü öffnen');
    if (fokus) knopf.focus();
    const verstecken = () => { if (!offen) menue.hidden = true; };
    if (RUHE) { flaeche.setze({ i: 1 }); balken.setze({ c: 0 }); verstecken(); return; }
    teilFedern.forEach(f => f.nach({ opacity: 0 }, SPRING));
    balken.nach({ c: 0 }, SPRING);
    flaeche.nach({ i: 1 }, SPRING).then(verstecken);
  };
  menueSchliessen = zu;

  knopf.addEventListener('click', () => (offen ? zu() : auf()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && offen) zu(); });
  AB_1024.addEventListener('change', e => { if (e.matches) zu(false); });
  menue.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    zu(false);
    springeZu(a.getAttribute('href'), 320);
  });
}

// Alle übrigen Sprünge innerhalb der Seite.
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  const hash = a.getAttribute('href');
  if (hash.length < 2) return;
  if (springeZu(hash)) e.preventDefault();
});

// ── Pillen: zweite Beschriftung rollt beim Zeigen herein ──
function pillen() {
  if (RUHE) return;
  for (const p of $$('.pille')) {
    const stapel = $('.pille-stapel', p);
    const fenster = $('.pille-fenster', p);
    if (!stapel || !$('.pille-zweit', p)) continue;
    const f = new Feder({ y: 0 }, stilSchreiber(stapel));
    const hin = () => f.nach({ y: -(fenster.offsetHeight || 20) }, SPRING);
    const her = () => f.nach({ y: 0 }, SPRING);
    p.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hin(); });
    p.addEventListener('pointerleave', her);
    p.addEventListener('focus', () => { if (p.matches(':focus-visible')) hin(); });
    p.addEventListener('blur', her);
  }
}

// ── Held: Film mit Tiefe, Titel und Fußzeile erscheinen nach der Eröffnung ──
function held() {
  const box = $('.held-box');
  if (!box || RUHE) return;
  const lage = $('.held-lage', box);
  let hoehe = box.offsetHeight;
  beiGroesse(() => { hoehe = box.offsetHeight; });

  scrollen(box, 'top top', 'bottom top', p => {
    lage.style.transform = `translate3d(0, ${(p * 0.12 * hoehe).toFixed(2)}px, 0)`;
  });

  zeitlich($('.held-kamera', box), { scale: 1.1 }, { scale: 1 }, SPRING_CAMERA, LOAD_DELAY);

  const z1 = $('.ht-1', box);
  const z2 = $('.ht-2', box);
  if (AB_1440.matches) {
    zeitlich(z1, { opacity: 0 }, { opacity: 1 }, SPRING_REVEAL, LOAD_DELAY);
    zeitlich(z2, { x: -40, opacity: 0 }, { x: 0, opacity: 1 }, SPRING_REVEAL, LOAD_DELAY + 300);
  } else {
    zeitlich(z1, { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, LOAD_DELAY);
    zeitlich(z2, { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, LOAD_DELAY + 300);
  }

  $$('.held-material li', box).forEach((c, i) => zeitlich(c, { opacity: 0, blur: 6 }, { opacity: 1, blur: 0 }, SPRING_REVEAL, LOAD_DELAY + 400 + 80 * i));
  zeitlich($('.held-film', box), { y: 12, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, LOAD_DELAY + 600);
  zeitlich($('.held-cta', box), { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, LOAD_DELAY + 600);
}

// ── Über uns: angeheftet, Buchstaben füllen sich, Zahlen rollen ──
function ueber() {
  const ueber = $('.ueber');
  if (!ueber) return;
  const halt = $('.halt');
  const text = $('.aussage-text', ueber);
  // Passt der Block nicht ganz in den Bildschirm, füllt sich der Satz schon beim Hereinscrollen.
  let zuHoch = false;

  beiGroesse(() => {
    zuHoch = ueber.offsetHeight > innerHeight;
    if (AB_768.matches) ueber.style.setProperty('--nadel-top', `${Math.min(0, innerHeight - ueber.offsetHeight)}px`);
    else ueber.style.removeProperty('--nadel-top');
  })();
  const amSatz = () => !AB_768.matches || zuHoch;

  $$('.aw-chips .chip', ueber).forEach((c, i) => {
    if (RUHE) return;
    erscheinen(c, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1 }, SPRING_POP, i * 60, '0px 0px -6% 0px', $('.aw-chips', ueber));
  });

  if (RUHE) return;

  // Buchstaben
  const zeichen = text ? teilen(text).zeichen : [];
  const n = zeichen.length;
  const fenster = 0.05;
  const letzte = new Float32Array(n).fill(-1);
  const fuellen = p => {
    for (let i = 0; i < n; i++) {
      const s = n > 1 ? (i / (n - 1)) * (1 - fenster) : 0;
      const o = 0.25 + 0.75 * klemme((p - s) / fenster);
      if (Math.abs(o - letzte[i]) > 0.002) { letzte[i] = o; zeichen[i].style.opacity = o.toFixed(3); }
    }
  };
  fuellen(0);

  // Zahlen als Walzen
  const walzen = [];
  for (const dd of $$('.zahl[data-wert]', ueber)) {
    const wert = dd.dataset.wert;
    const kopie = document.createElement('span');
    kopie.className = 'vh';
    kopie.textContent = wert;
    const huelle = document.createElement('span');
    huelle.setAttribute('aria-hidden', 'true');
    huelle.className = 'walzen';
    const ziffern = [...wert];
    const reihe = ziffern.map((z, i) => {
      const w = document.createElement('span');
      w.className = 'walze';
      const platz = document.createElement('span');
      platz.className = 'walze-platz';
      platz.textContent = z;
      const rolle = document.createElement('span');
      rolle.className = 'walze-rolle';
      for (let d = 0; d <= 9; d++) { const s = document.createElement('span'); s.textContent = String(d); rolle.appendChild(s); }
      w.append(platz, rolle);
      huelle.appendChild(w);
      return { rolle, ziel: Number(z), lead: (ziffern.length - 1 - i) * 0.08, span: 1 - (ziffern.length - 1) * 0.08, verz: (ziffern.length - 1 - i) * 90, zuletzt: -1 };
    });
    dd.textContent = '';
    dd.append(kopie, huelle);
    walzen.push({ dd, reihe });
  }
  const rollen = (z, r) => {
    if (Math.abs(r - z.zuletzt) < 0.001) return;
    z.zuletzt = r;
    z.rolle.style.transform = `translate(-50%, ${(-r * 10).toFixed(3)}%)`;
  };
  const zaehlen = p => walzen.forEach(w => w.reihe.forEach(z => rollen(z, z.ziel * klemme((p - z.lead) / z.span))));

  // Ab Tablet: an das Anhalten gekoppelt.
  if (halt) scrollen(halt, 'top bottom', 'bottom bottom', p => { if (AB_768.matches) { if (!amSatz()) fuellen(p); zaehlen(p); } });
  // Am Telefon (und bei hohem Block): Text im Lauf; am Telefon Zahlen einmal beim Erscheinen.
  if (text) scrollen(text, 'top bottom', 'center center', p => { if (amSatz()) fuellen(p); });
  for (const w of walzen) {
    beiSicht(w.dd, () => {
      if (AB_768.matches) return;
      w.reihe.forEach(z => new Feder({ r: 0 }, v => rollen(z, v.r)).nach({ r: z.ziel }, SPRING_REVEAL, z.verz));
    });
  }
}

// ── Abschnittsköpfe und Augenbrauen ──
function koepfe() {
  if (RUHE) return;
  for (const kz of $$('.kopfzeile')) {
    erscheinen($('.kz-1', kz), { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, 0, REVEAL_MARGIN, kz);
    erscheinen($('.kz-2', kz), { x: 30, opacity: 0 }, { x: 0, opacity: 1 }, SPRING_REVEAL, 260, REVEAL_MARGIN, kz);
    const seite = $('.kz-seite', kz);
    if (seite) erscheinen(seite, { y: 16, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, 420, REVEAL_MARGIN, kz);
  }
  for (const ab of $$('.augenbraue')) {
    const t = $('.ab-text', ab);
    if (!t) continue;
    const index = $('.ab-index', ab);
    const zeichen = teilen(t).zeichen;
    zeichen.forEach(z => { z.style.opacity = '0'; });
    beiSicht(ab, () => tippen(zeichen, ((index ? index.textContent.length : 0) + 2) * TYPE_STAGGER), '0px 0px -10% 0px');
  }
}

// ── Leistungen ──
function leistungen() {
  const zweiSpalten = () => (AB_1440.matches ? 2 : 1);
  if (!RUHE) {
    $$('.leistung').forEach((l, i) => {
      erscheinen(l, { y: 32, opacity: 0, blur: 16 }, { y: 0, opacity: 1, blur: 0 }, SPRING_REVEAL, (i % zweiSpalten()) * 140, '0px 0px -10% 0px');
    });

    // Zeichnungen ziehen ihre Linien, sobald sie zu sehen sind.
    for (const svg of $$('.zeichnung, .schnitt')) {
      const federn = $$('.fd-strich, .sn-strich', svg).map(s => {
        s.style.strokeDasharray = '1';
        const f = new Feder({ d: 1 }, w => { s.style.strokeDashoffset = w.d.toFixed(4); });
        f.schreiben(f.wert);
        return f;
      });
      const schritt = svg.classList.contains('schnitt') ? 70 : 140;
      beiSicht(svg, () => federn.forEach((f, j) => f.nach({ d: 0 }, SPRING_DRAW, 150 + j * schritt)), '0px 0px -10% 0px');
    }

    $$('.liste-punkt').forEach((p, i) => {
      const verz = Math.min(i, 4) * 70;
      const fl = new Feder({ scaleX: 0 }, stilSchreiber($('.lp-linie', p)));
      const fz = new Feder({ opacity: 0 }, stilSchreiber($('.lp-zeile', p)));
      fl.schreiben(fl.wert);
      fz.schreiben(fz.wert);
      beiSicht(p, () => { fl.nach({ scaleX: 1 }, SPRING_REVEAL, verz); fz.nach({ opacity: 1 }, SPRING_REVEAL, verz + 200); }, '0px 0px -8% 0px');
    });

    // Leichter Zoom der Bilder beim Zeigen (nur mit Maus, ab Tablet).
    for (const z of $$('[data-zoom]')) {
      const bilder = $$('.zoom img', z).map(img => new Feder({ scale: 1 }, stilSchreiber(img)));
      if (!bilder.length) continue;
      z.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse' || !ZEIGER.matches || !AB_768.matches) return;
        bilder.forEach(f => f.nach({ scale: 1.06 }, SPRING_SOFT));
      });
      z.addEventListener('pointerleave', () => bilder.forEach(f => f.nach({ scale: 1 }, SPRING_SOFT)));
    }
  }
}

// ── Liste der Sanierung: ein Punkt offen, der Schnitt zeigt seine Schicht ──
function liste() {
  const punkte = $$('.liste-punkt');
  if (!punkte.length) return;
  const feld = $('.schnitt-feld');
  const svg = $('.schnitt');
  const nr = $('.sw-nr');
  const text = $('.sw-text');
  let offen = punkte.findIndex(p => p.classList.contains('offen'));
  let gezeigt = -2;

  const zeigen = i => {
    if (i === gezeigt) return;
    gezeigt = i;
    if (svg) {
      for (const p of punkte) svg.classList.remove(`zeigt-${p.dataset.schicht}`);
      svg.classList.toggle('wahl', i >= 0);
      if (i >= 0) svg.classList.add(`zeigt-${punkte[i].dataset.schicht}`);
    }
    if (feld) feld.classList.toggle('mit-wahl', i >= 0);
    if (i >= 0 && nr && text) {
      nr.textContent = $('.lp-nr', punkte[i]).textContent;
      text.textContent = $('.lp-text', punkte[i]).textContent;
    }
  };
  const setzen = i => {
    offen = i;
    punkte.forEach((p, j) => {
      p.classList.toggle('offen', j === i);
      $('.lp-zeile', p).setAttribute('aria-expanded', String(j === i));
    });
    zeigen(i);
  };

  punkte.forEach((p, i) => {
    const knopf = $('.lp-zeile', p);
    knopf.addEventListener('click', () => setzen(offen === i ? -1 : i));
    knopf.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && ZEIGER.matches) zeigen(i); });
    knopf.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') zeigen(offen); });
    knopf.addEventListener('focus', () => { if (knopf.matches(':focus-visible')) zeigen(i); });
    knopf.addEventListener('blur', () => zeigen(offen));
  });
  setzen(offen);
}

// ── Ablauf: eine Stufe offen, die anderen gefaltet ──
function ablauf() {
  const schritte = $$('.schritt').map(li => {
    const zeile = $('.schritt-zeile', li);
    const klappe = $('.schritt-klappe', li);
    const detail = $('.schritt-detail', li);
    const luft = $('.schritt-luft', li);
    const pfeil = $('.sz-pfeil', li);
    const bild = $('.sd-foto img', li);
    let offen = li.classList.contains('offen');
    let hoehe = detail.offsetHeight;
    let zeigen = false;

    const f = new Feder({ o: offen ? 1 : 0 }, w => {
      const o = klemme(w.o, 0, 1.2);
      li.style.setProperty('--open', klemme(w.o).toFixed(4));
      klappe.style.height = `${Math.max(0, o * hoehe).toFixed(2)}px`;
      luft.style.height = `${Math.max(0, o * rem()).toFixed(2)}px`;
    });
    f.schreiben(f.wert);
    klappe.inert = !offen;

    const fPfeil = RUHE ? null : new Feder({ rotate: offen ? 90 : 0 }, stilSchreiber(pfeil));
    if (fPfeil) fPfeil.schreiben(fPfeil.wert);
    const pfeilNach = () => { if (fPfeil) fPfeil.nach({ rotate: offen || zeigen ? 90 : 0 }, SPRING); };
    const fBild = RUHE || !bild ? null : new Feder({ scale: 1 }, stilSchreiber(bild));

    new ResizeObserver(() => {
      const neu = detail.offsetHeight;
      if (Math.abs(neu - hoehe) < 0.5) return;
      hoehe = neu;
      f.schreiben(f.wert);
    }).observe(detail);

    const setzen = auf => {
      if (auf === offen) return;
      offen = auf;
      li.classList.toggle('offen', auf);
      zeile.setAttribute('aria-expanded', String(auf));
      klappe.inert = !auf;
      hoehe = detail.offsetHeight;
      if (RUHE) f.setze({ o: auf ? 1 : 0 }); else f.nach({ o: auf ? 1 : 0 }, SPRING);
      pfeilNach();
      if (auf && fBild) { fBild.setze({ scale: 1.12 }); fBild.nach({ scale: 1 }, SPRING_CAMERA, 60); }
    };

    zeile.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { zeigen = true; pfeilNach(); } });
    zeile.addEventListener('pointerleave', () => { zeigen = false; pfeilNach(); });

    if (offen && fBild) {
      fBild.setze({ scale: 1.12 });
      beiSicht(li, () => fBild.nach({ scale: 1 }, SPRING_CAMERA), '0px 0px -15% 0px');
    }
    return { li, zeile, setzen, istOffen: () => offen };
  });

  schritte.forEach((s, i) => s.zeile.addEventListener('click', () => {
    if (s.istOffen()) { s.setzen(false); return; }
    schritte.forEach((t, j) => t.setzen(j === i));
  }));
}

// ── Beispielprojekt: Bild mit Tiefe, Markierungen sitzen fest am Foto ──
function projekt() {
  const haupt = $('.haupt');
  const orte = $$('.marke-ort');
  if (haupt && !RUHE) {
    // Bild und Markierungen teilen sich Versatz und Zoom, damit jede Markierung auf ihrer Stelle bleibt.
    let hoehe = haupt.offsetHeight;
    beiGroesse(() => { hoehe = haupt.offsetHeight; });
    scrollen(haupt, 'top bottom', 'bottom top', p => {
      haupt.style.setProperty('--versatz', `${((p * 0.12 - 0.06) * hoehe).toFixed(2)}px`);
    });
    const zoom = new Feder({ z: 1.1 }, w => haupt.style.setProperty('--zoom', w.z.toFixed(4)));
    zoom.schreiben(zoom.wert);
    beiSicht(haupt, () => zoom.nach({ z: 1 }, SPRING_CAMERA), '0px 0px -10% 0px');
    $$('.marke-ort .marke', haupt).forEach((m, i) => {
      erscheinen(m, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1 }, SPRING_POP, 500 + i * 110, '0px 0px -10% 0px', haupt);
    });
  }
  if (!RUHE) {
    $$('.detail').forEach((d, i) => erscheinen(d, { y: 16, opacity: 0 }, { y: 0, opacity: 1 }, SPRING_REVEAL, i * 60, '0px 0px -8% 0px', $('.details-liste')));
    const doku = $('.doku');
    if (doku) erscheinen(doku, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1 }, SPRING_REVEAL, 0, '0px 0px -10% 0px');
  }

  // Markierungen
  let offenOrt = null;
  const zustand = new Map();
  const detailVon = ort => (ort.dataset.detail ? document.getElementById(ort.dataset.detail) : null);

  const schliessen = (ort, fokus = false) => {
    const z = zustand.get(ort);
    if (!z || !ort.classList.contains('offen')) return;
    z.fest = false;
    ort.classList.remove('offen');
    z.knopf.setAttribute('aria-expanded', 'false');
    if (z.detail) z.detail.classList.remove('aktiv');
    if (offenOrt === ort) offenOrt = null;
    const ende = () => {
      if (ort.classList.contains('offen')) return;
      z.karte.classList.remove('sichtbar');
      ort.dataset.seite = z.seite;
      ort.classList.remove('karte-unten');
      if (z.huelle && !z.huelle.querySelector('.marke-ort.offen')) z.huelle.classList.remove('marke-auf');
    };
    if (fokus) z.knopf.focus();
    if (RUHE) { z.f.setze({ s: 0.4, o: 0 }); ende(); return; }
    z.karte.classList.add('sichtbar');
    z.f.nach({ s: 0.4, o: 0 }, SPRING).then(ende);
  };

  const oeffnen = (ort, fest) => {
    const z = zustand.get(ort);
    if (fest) z.fest = true;
    if (ort.classList.contains('offen')) return;
    if (offenOrt && offenOrt !== ort) schliessen(offenOrt);
    offenOrt = ort;
    ort.dataset.seite = z.seite;
    ort.classList.add('offen');
    z.karte.classList.remove('sichtbar');
    z.knopf.setAttribute('aria-expanded', 'true');
    if (z.detail) z.detail.classList.add('aktiv');
    if (z.huelle) z.huelle.classList.add('marke-auf');
    // Karte auf die andere Seite, wenn sie aus dem Bildschirm ragt. Passt keine Seite (Telefon), sitzt sie über oder unter der Markierung.
    const r = ort.getBoundingClientRect();
    const b = z.karte.offsetWidth + 16;
    const rand = 12;
    const breite = html.clientWidth;
    const passtRechts = r.right + b <= breite - rand;
    const passtLinks = r.left - b >= rand;
    z.schub = 0;
    ort.classList.remove('karte-unten');
    if (z.seite === 'rechts' && !passtRechts && passtLinks) ort.dataset.seite = 'links';
    else if (z.seite === 'links' && !passtLinks && passtRechts) ort.dataset.seite = 'rechts';
    else if (!passtLinks && !passtRechts) {
      ort.dataset.seite = 'mitte';
      const halb = z.karte.offsetWidth / 2;
      const mitte = r.left + r.width / 2;
      z.schub = Math.max(rand + halb - mitte, Math.min(0, breite - rand - halb - mitte));
      const rahmen = z.huelle ? z.huelle.getBoundingClientRect() : r;
      ort.classList.toggle('karte-unten', r.top - z.karte.offsetHeight - 12 < Math.max(rahmen.top, 84));
    }
    if (RUHE) { z.f.setze({ s: 1, o: 1 }); return; }
    z.f.setze({ s: 0.4, o: 0 });
    z.f.nach({ s: 1, o: 1 }, SPRING_POP);
  };

  for (const ort of orte) {
    const knopf = $('.marke', ort);
    const karte = $('.marke-karte', ort);
    const detail = detailVon(ort);
    const f = new Feder({ s: 0.4, o: 0 }, w => {
      const z = zustand.get(ort);
      karte.style.transform = ort.dataset.seite === 'mitte'
        ? `translateX(calc(-50% + ${(z ? z.schub : 0).toFixed(1)}px)) scale(${w.s.toFixed(4)})`
        : `translateY(-50%) scale(${w.s.toFixed(4)})`;
      karte.style.opacity = klemme(w.o).toFixed(3);
    });
    zustand.set(ort, { knopf, karte, detail, f, schub: 0, fest: false, seite: ort.dataset.seite || 'rechts', huelle: ort.closest('.haupt, .auftrag-box') });

    ort.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && ZEIGER.matches) oeffnen(ort, false); });
    ort.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse') return;
      const z = zustand.get(ort);
      if (!z.fest && document.activeElement !== knopf) schliessen(ort);
    });
    knopf.addEventListener('focus', () => oeffnen(ort, false));
    knopf.addEventListener('blur', () => { if (!zustand.get(ort).fest) schliessen(ort); });
    knopf.addEventListener('click', () => {
      const z = zustand.get(ort);
      if (ort.classList.contains('offen') && z.fest) schliessen(ort);
      else oeffnen(ort, true);
    });

    // Die Liste unter dem Foto hebt beim Zeigen ihre Markierung hervor.
    if (detail) {
      detail.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse' || !ZEIGER.matches) return;
        ort.classList.add('zeigt');
        detail.classList.add('aktiv');
      });
      detail.addEventListener('pointerleave', () => {
        ort.classList.remove('zeigt');
        if (!ort.classList.contains('offen')) detail.classList.remove('aktiv');
      });
    }
  }
  document.addEventListener('pointerdown', e => { if (offenOrt && !offenOrt.contains(e.target)) schliessen(offenOrt); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && offenOrt) schliessen(offenOrt, true); });
  const io = new IntersectionObserver(eintraege => {
    for (const e of eintraege) if (!e.isIntersecting && offenOrt && e.target.contains(offenOrt)) schliessen(offenOrt);
  });
  new Set(orte.map(o => o.closest('.haupt, .auftrag-box')).filter(Boolean)).forEach(h => io.observe(h));
}

// ── Anfrage: Film zieht sich auf den Rahmen zusammen, der Dachcheck kommt an ──
function anfrage() {
  const lauf = $('.buehne-lauf');
  const buehne = $('.buehne');
  const box = $('.anfrage-box');
  const rahmen = $('.af-rahmen');
  if (lauf && box && rahmen && !RUHE) {
    let an = false;
    let steuerung = null;
    const PROPS = ['--bleed-t', '--bleed-r', '--bleed-b', '--bleed-l', '--shrink', '--cta-in'];
    const zeichnen = p => {
      if (!an) return;
      box.style.setProperty('--shrink', klemme(p / 0.8).toFixed(4));
      box.style.setProperty('--cta-in', klemme((p - 0.55) / 0.45).toFixed(4));
    };
    beiGroesse(() => {
      if (!AB_1440.matches) { an = false; PROPS.forEach(p => box.style.removeProperty(p)); return; }
      const r = rahmen.getBoundingClientRect();
      const b = buehne.getBoundingClientRect();
      box.style.setProperty('--bleed-t', `${Math.max(0, r.top - b.top).toFixed(1)}px`);
      box.style.setProperty('--bleed-b', `${Math.max(0, b.bottom - r.bottom).toFixed(1)}px`);
      box.style.setProperty('--bleed-l', `${Math.max(0, r.left).toFixed(1)}px`);
      box.style.setProperty('--bleed-r', `${Math.max(0, html.clientWidth - r.right).toFixed(1)}px`);
      an = true;
      if (steuerung) zeichnen(steuerung.messen());
    })();
    steuerung = scrollen(lauf, 'top bottom', 'bottom bottom', zeichnen);
  }

  // Auswahl mit wandernder Plakette, je Frage eine.
  for (const wahl of $$('.fo-wahl')) {
    const plakette = $('.fo-plakette', wahl);
    const chips = $$('.fo-chip', wahl);
    const pf = new Feder({ x: 0, y: 0, w: 0, h: 44 }, w => {
      plakette.style.transform = `translate3d(${w.x.toFixed(2)}px, ${w.y.toFixed(2)}px, 0)`;
      plakette.style.width = `${Math.max(0, w.w).toFixed(2)}px`;
      plakette.style.height = `${Math.max(0, w.h).toFixed(2)}px`;
    });
    const ziel = () => {
      const c = chips.find(c => $('input', c).checked);
      return c ? { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight } : null;
    };
    beiGroesse(() => { const z = ziel(); if (z && wahl.offsetWidth) { pf.setze(z); wahl.classList.add('mit-plakette'); } })();
    wahl.addEventListener('change', () => {
      const z = ziel();
      if (!z) return;
      if (RUHE) pf.setze(z); else pf.nach(z, SPRING);
    });
  }

  // Der Dachcheck prüft Name und Telefon und sendet nichts.
  const form = $('.formular');
  const meldung = $('.fo-meldung');
  if (form && meldung) {
    const felder = [
      { el: $('#fo-name', form), gut: v => v.trim().length >= 2 },
      { el: $('#fo-telefon', form), gut: v => v.replace(/\D/g, '').length >= 6 },
    ].filter(f => f.el);
    const pruefen = f => {
      const gut = f.gut(f.el.value);
      const fehler = document.getElementById(`${f.el.id}-fehler`);
      if (gut) f.el.removeAttribute('aria-invalid'); else f.el.setAttribute('aria-invalid', 'true');
      if (fehler) fehler.hidden = gut;
      return gut;
    };
    for (const f of felder) f.el.addEventListener('input', () => { if (f.el.hasAttribute('aria-invalid')) pruefen(f); });
    const wahlVon = name => { const r = form.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };

    form.addEventListener('submit', e => {
      e.preventDefault();
      meldung.textContent = '';
      form.classList.remove('gemeldet');
      const offen = felder.filter(f => !pruefen(f));
      if (offen.length) { offen[0].el.focus(); return; }
      const angaben = [wahlVon('anlass'), wahlVon('alter')].filter(Boolean).join(' · ');
      requestAnimationFrame(() => {
        form.classList.add('gemeldet');
        meldung.textContent = `Dies ist eine Beispielseite. Ihre Angaben werden nicht gesendet.${angaben ? ` Angekommen wäre: ${angaben}.` : ''}`;
      });
    });

    // Wer das Formular ausfüllt, soll daneben keinen laufenden Film haben.
    form.addEventListener('focusin', () => {
      const film = filmListe.find(f => rahmen && f.rahmen === rahmen);
      if (film) film.halt();
    }, { once: true });
  }

  // Zusagen zeichnen ihre Symbole.
  if (RUHE) return;
  const zusagen = $('.zusagen');
  if (zusagen) {
    const federn = [];
    $$('.zu-symbol', zusagen).forEach((sym, i) => {
      $$('path, circle', sym).forEach((el, j) => {
        el.style.strokeDasharray = '1';
        const f = new Feder({ d: 1 }, w => { el.style.strokeDashoffset = w.d.toFixed(4); });
        f.schreiben(f.wert);
        federn.push(() => f.nach({ d: 0 }, SPRING_DRAW, i * 200 + j * 80));
      });
    });
    beiSicht(zusagen, () => federn.forEach(los => los()), '0px 0px -10% 0px');
  }
}

// ── Fuß ──
function fuss() {
  if (RUHE) return;
  const kontakt = $('.fuss-kontakt');
  if (kontakt) {
    $$('.fk-linie', kontakt).forEach((l, i) => erscheinen(l, { scaleX: 0 }, { scaleX: 1 }, SPRING_REVEAL, i * 150, '0px 0px -5% 0px', kontakt));
    $$('.fk-zelle', kontakt).forEach((c, i) => erscheinen(c, { opacity: 0 }, { opacity: 1 }, SPRING_REVEAL, 300 + i * 90, '0px 0px -5% 0px', kontakt));
  }
  const wort = $('.fuss-wort');
  const wtext = $('.fw-text');
  if (wort && wtext) {
    const f = new Feder({ p: 0 }, w => {
      wort.style.setProperty('--sp-p', klemme(w.p).toFixed(4));
      wtext.style.opacity = klemme(w.p).toFixed(3);
    });
    f.schreiben(f.wert);
    beiSicht(wort, () => f.nach({ p: 1 }, SPRING_REVEAL), '0px 0px -2% 0px');
  }
}

// ── Kleinigkeiten: Uhr, ruhende Schleifen ──
function uhr() {
  const zeit = $('.sl-zeit');
  if (!zeit) return;
  const fmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  const stellen = () => {
    const d = new Date();
    zeit.textContent = fmt.format(d);
    zeit.setAttribute('datetime', d.toISOString());
  };
  stellen();
  $$('.sl-uhr').forEach(el => { el.hidden = false; });
  setTimeout(() => { stellen(); setInterval(stellen, 60000); }, (60 - new Date().getSeconds()) * 1000 + 50);
}

function ruhen() {
  const io = new IntersectionObserver(eintraege => {
    for (const e of eintraege) e.target.classList.toggle('ruhig', !e.isIntersecting);
  });
  $$('.held, .statusleiste, .projekt').forEach(el => io.observe(el));
}

// ── Start ──
const eroeffnet = eroeffnung();
// Filme: Standbild sofort, Bewegung erst nach der Eröffnung und nur in Sichtnähe.
let filmListe = [];
sicher(() => { filmListe = filme({ ruhe: RUHE, bereit: eroeffnet }); });
[kopf, pillen, held, ueber, koepfe, leistungen, liste, ablauf, projekt, anfrage, fuss, uhr, ruhen].forEach(sicher);
glatt();
eroeffnet.then(() => {
  if (lenis && !html.classList.contains('gesperrt')) lenis.start();
  if (location.hash.length > 1) springeZu(location.hash, 120);
});
