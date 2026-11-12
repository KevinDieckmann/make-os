// Passer · Büro für Marken (Beispielseite)
// Ohne dieses Skript bleibt die Seite vollständig lesbar: Alles hier ist Zugabe.
import Lenis from '../vendor/lenis/lenis.mjs';
import { imTakt, beiBewegung, Feder, klemme } from './feder.js';
import { reelEinrichten } from './reel.js';
import { plattenEinrichten } from './platten.js';

const html = document.documentElement;
html.classList.add('js');

const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const RUHE = matchMedia('(prefers-reduced-motion: reduce)');
const ZEIGER = matchMedia('(hover: hover) and (pointer: fine)');
const bereit = new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok)));
// Die große Schrift ausdrücklich anfordern: „fonts.ready“ allein kann schon durch sein, bevor sie gebraucht wird.
const schriften = document.fonts?.load
  ? Promise.all([document.fonts.load('900 100px "Passer Archivo"'), document.fonts.load('800 40px "Passer Archivo"')]).then(() => document.fonts.ready).catch(() => {})
  : Promise.resolve();

// ─── Weiches Scrollen (nur mit Maus oder Trackpad, nie bei „weniger Bewegung“) ───
let lenis = null;
if (!RUHE.matches && ZEIGER.matches) {
  try { lenis = new Lenis({ autoRaf: true, anchors: false, lerp: .11 }); } catch (_) { lenis = null; }
}
function scrolleZu(y, sofort = false) {
  if (lenis) lenis.scrollTo(y, sofort ? { immediate: true } : { duration: 1.15 });
  else scrollTo({ top: y, behavior: sofort || RUHE.matches ? 'auto' : 'smooth' });
}

// ─── Kopfzeile: Farbe je Abschnitt, Bogen-Anzeige, Menü ───
const kopf = (() => {
  const el = $('[data-kopf]');
  const bereiche = $$('main [data-ton], footer[data-ton]');
  const bogen = $$('[data-bogen]');
  const nr = $('[data-bogen-nr]'), name = $('[data-bogen-name]');
  const links = $$('.kopf-nav a');
  let ueberFilm = false;
  let letzter = null;

  function lesen() {
    el.classList.toggle('fest', scrollY > 12);
    let treffer = null;
    for (const b of bereiche) {
      const r = b.getBoundingClientRect();
      if (r.top <= 34 && r.bottom > 34) { treffer = b; break; }
    }
    treffer ??= scrollY < 40 ? bereiche[0] : bereiche[bereiche.length - 1];
    el.dataset.ton = ueberFilm && treffer === bereiche[0] ? 'film' : treffer.dataset.ton;
    if (treffer === letzter) return;
    letzter = treffer;
    const i = bogen.indexOf(treffer);
    if (i >= 0) { nr.textContent = String(i + 1).padStart(2, '0'); name.textContent = treffer.dataset.bogen; }
    for (const a of links) {
      if (a.getAttribute('href') === '#' + treffer.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }
  beiBewegung(lesen);

  // Menü unter 900 px
  const taste = $('.kopf-menue'), nav = $('#menue'), tastenText = $('.km-text', taste);
  const schmal = matchMedia('(max-width: 899px)');
  let offen = false;
  function menue(an, fokusZurueck = true) {
    if (an === offen) return;
    offen = an;
    html.classList.toggle('menue-offen', an);
    taste.setAttribute('aria-expanded', String(an));
    tastenText.textContent = an ? 'Schließen' : 'Menü';
    if (an) { lenis?.stop(); $('a', nav).focus({ preventScroll: true }); }
    else { lenis?.start(); if (fokusZurueck) taste.focus({ preventScroll: true }); }
  }
  taste.addEventListener('click', () => menue(!offen));
  document.addEventListener('keydown', e => {
    if (!offen) return;
    if (e.key === 'Escape') { menue(false); return; }
    if (e.key !== 'Tab') return;
    // Der Fokus bleibt im offenen Menü: Name, Menütaste, Bereiche.
    const kette = [$('.kopf-marke'), taste, ...$$('a', nav)];
    const i = kette.indexOf(document.activeElement);
    const ziel = e.shiftKey ? (i <= 0 ? kette.length - 1 : i - 1) : (i === kette.length - 1 || i < 0 ? 0 : i + 1);
    e.preventDefault();
    kette[ziel].focus();
  });
  schmal.addEventListener?.('change', () => { if (!schmal.matches) menue(false, false); });

  return { film(an) { if (an !== ueberFilm) { ueberFilm = an; lesen(); } }, menueZu() { menue(false, false); } };
})();

// ─── Sprungziele: weich hinfahren, Fokus mitnehmen ───
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
  const ziel = document.getElementById(a.getAttribute('href').slice(1));
  if (!ziel) return;
  e.preventDefault();
  kopf.menueZu();
  const y = ziel.id === 'inhalt' ? 0 : Math.round(ziel.getBoundingClientRect().top + scrollY);
  scrolleZu(y);
  history.replaceState(null, '', '#' + ziel.id);
  if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1');
  ziel.focus({ preventScroll: true });
});

// ─── Wortmarke: drei Druckfarben, die in den Passer springen ───
const marke = (() => {
  const wm = $('[data-wortmarke]');
  const anzeige = $('[data-abweichung]');
  if (!wm) return { fortschritt() {} };
  const lagen = [...wm.children];

  function einpassen() {
    const eltern = wm.parentElement;
    const stil = getComputedStyle(eltern);
    const frei = eltern.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight);
    wm.style.fontSize = '200px';
    wm.style.width = 'max-content';
    const natur = wm.getBoundingClientRect().width;
    wm.style.fontSize = '';
    wm.style.width = '';
    if (natur > 0) html.style.setProperty('--wm-fit', (200 * frei / natur * .992).toFixed(1) + 'px');
  }
  einpassen();
  schriften.then(einpassen);
  let breite = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== breite) { breite = innerWidth; einpassen(); } });

  if (RUHE.matches) return { fortschritt() {} };

  // Jede Farbe hat ihre Richtung, in die sie aus dem Passer läuft.
  const RICHTUNG = [[-1, -.5], [.9, .45], [.15, -1]];
  const MAUS = [-13, 11, 5];
  let maus = [0, 0], weg = 0, gemeldet = false;

  function melden() {
    if (gemeldet || !anzeige) return;
    gemeldet = true;
    imTakt(() => {
      gemeldet = false;
      const px = Math.max(...federn.map(f => Math.hypot(f.x[0], f.x[1])));
      const mm = px * .2646;
      const sitzt = mm < .05;
      anzeige.textContent = `Abweichung ${mm.toFixed(2).replace('.', ',')} mm${sitzt ? ' · sitzt' : ''}`;
      anzeige.parentElement.classList.toggle('sitzt', sitzt);
      return false;
    });
  }
  const federn = lagen.map(el => new Feder([0, 0], ([x, y]) => {
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    melden();
  }, { k: 64, c: 11 }));

  function zielen() {
    const f = klemme(innerWidth / 1440, .5, 1.4);
    federn.forEach((feder, i) => feder.nach([
      maus[0] * MAUS[i] + RICHTUNG[i][0] * weg * 54 * f,
      maus[1] * MAUS[i] + RICHTUNG[i][1] * weg * 54 * f,
    ]));
  }

  // Auftritt: die Farben liegen daneben und rasten ein.
  const f0 = klemme(innerWidth / 1440, .4, 1.3);
  federn.forEach((feder, i) => feder.setze([RICHTUNG[i][0] * 30 * f0, RICHTUNG[i][1] * 30 * f0]));
  Promise.all([schriften, bereit]).then(() => setTimeout(zielen, 320));

  if (ZEIGER.matches) {
    const buehne = wm.closest('.auftakt');
    buehne.addEventListener('pointermove', e => {
      const r = wm.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / Math.max(r.height, 1);
      const nah = klemme(1.25 - Math.abs(dy) * .55);     // je näher an der Wortmarke, desto stärker
      maus = [klemme(dx, -1, 1) * nah, klemme(dy, -1, 1) * nah];
      zielen();
    });
    buehne.addEventListener('pointerleave', () => { maus = [0, 0]; zielen(); });
  }

  return { fortschritt(p) { if (p !== weg) { weg = p; zielen(); } } };
})();

// ─── Werkstattfilm ───
const reel = reelEinrichten({
  ruhe: RUHE,
  bereit,
  scrolleZu,
  beiFortschritt(p, obenAngekommen) { marke.fortschritt(p); kopf.film(obenAngekommen); },
});
schriften.then(() => reel?.messen());   // mit der fertigen Schrift liegt das kleine Filmfenster endgültig

// Ohne angehefteten Auftakt (schmale Fenster) laufen die Farben beim Wegscrollen leicht auseinander.
{
  const auftakt = $('.auftakt');
  beiBewegung(() => { if (!auftakt.classList.contains('gepinnt')) marke.fortschritt(Math.round(klemme(scrollY / (innerHeight * .9)) * 40) / 50); });
}

// ─── Überschriften in Worte teilen, Einblenden beim Hereinscrollen ───
function teileWorte(el) {
  let n = 0;
  const gehe = knoten => {
    for (const k of [...knoten.childNodes]) {
      if (k.nodeType === 1) { gehe(k); continue; }
      if (k.nodeType !== 3) continue;
      const teile = document.createDocumentFragment();
      for (const t of k.textContent.split(/(\s+)/)) {
        if (!t) continue;
        if (/^\s+$/.test(t)) { teile.append(' '); continue; }
        const w = document.createElement('span'), wi = document.createElement('span');
        w.className = 'w'; wi.className = 'wi';
        wi.style.setProperty('--i', String(n++));
        wi.textContent = t;
        w.append(wi);
        teile.append(w);
      }
      k.replaceWith(teile);
    }
  };
  gehe(el);
}
{
  const titel = $$('[data-worte]');
  if (!RUHE.matches) titel.forEach(teileWorte);
  const alle = [...$$('[data-auf]'), ...titel];
  if (RUHE.matches || !('IntersectionObserver' in window)) {
    alle.forEach(el => el.classList.add('da'));
  } else {
    const io = new IntersectionObserver(eintraege => {
      let n = 0;
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        if (e.target.hasAttribute('data-auf')) e.target.style.setProperty('--i', String(n++));
        e.target.classList.add('da');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -7% 0px', threshold: .06 });
    alle.forEach(el => io.observe(el));
  }
}

// ─── Arbeiten: Bogen stapeln sich, wenn jeder ganz ins Fenster passt ───
{
  const stapel = $('.stapel');
  const bogen = $$('.projekt', stapel);
  let warten = 0;
  const pruefen = () => {
    stapel.classList.remove('haftet');
    const frei = innerHeight - 64 - 14 - 32 - 100;   // unten bleibt Platz für die Leiste
    stapel.classList.toggle('haftet', innerWidth >= 1100 && bogen.every(b => b.offsetHeight <= frei));
  };
  pruefen();
  schriften.then(pruefen);
  addEventListener('load', pruefen);
  addEventListener('resize', () => { clearTimeout(warten); warten = setTimeout(pruefen, 160); });
}

// ─── Leistungen: vier Platten ───
plattenEinrichten();

// ─── Anfrage: prüfen, nichts senden ───
{
  const form = $('[data-formular]');
  const meldung = $('[data-meldung]', form);
  const felder = [
    { el: $('#f-name'), pruefe: w => (w.trim().length >= 2 ? '' : 'Bitte nennen Sie Ihren Namen.') },
    { el: $('#f-mail'), pruefe: w => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(w.trim()) ? '' : 'Bitte prüfen Sie die E-Mail-Adresse.') },
    { el: $('#f-text'), pruefe: w => (w.trim().length >= 10 ? '' : 'Bitte beschreiben Sie in ein, zwei Sätzen, worum es geht.') },
  ];
  const pruefen = f => {
    const text = f.pruefe(f.el.value);
    const hinweis = document.getElementById(f.el.id + '-fehler');
    hinweis.textContent = text;
    hinweis.hidden = !text;
    if (text) f.el.setAttribute('aria-invalid', 'true'); else f.el.removeAttribute('aria-invalid');
    return !text;
  };
  for (const f of felder) {
    f.el.addEventListener('input', () => {
      if (f.el.hasAttribute('aria-invalid')) pruefen(f);
      if (form.classList.contains('gemeldet')) { form.classList.remove('gemeldet'); meldung.textContent = ''; }
    });
    f.el.addEventListener('blur', () => { if (f.el.value.trim()) pruefen(f); });
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    meldung.textContent = '';
    form.classList.remove('gemeldet');
    const offen = felder.filter(f => !pruefen(f));
    if (offen.length) { offen[0].el.focus(); return; }
    requestAnimationFrame(() => {
      form.classList.add('gemeldet');
      meldung.textContent = 'Dies ist eine Beispielseite. Ihre Angaben werden nicht gesendet.';
    });
  });
}
