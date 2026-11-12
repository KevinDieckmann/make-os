// Wortlaut · Beispielseite. Ohne dieses Skript bleibt alles lesbar: die Seite steht dann still,
// alle Anlässe sind sichtbar und die drei Satzpaare stehen untereinander.
import { filmEinrichten } from './film.js';

const html = document.documentElement;
html.classList.add('js');

const ruhig = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const grenze = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const stufe = (x, von, bis) => grenze((x - von) / (bis - von));

/* ─── Filme ─── */
$$('[data-film]').forEach(filmEinrichten);

/* ─── Erscheinen beim Scrollen ─── */
{
  const teile = $$('.zeig');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(eintraege => {
      let n = 0;
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--verzug', `${Math.min(n++, 4) * 110}ms`);
        e.target.classList.add('da');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    teile.forEach(t => io.observe(t));
  } else {
    teile.forEach(t => t.classList.add('da'));
  }
}

/* ─── Menü unter 900 px ─── */
const menueKnopf = $('.kopf-menue');
const nav = $('#bereiche');
function menueSetzen(offen) {
  html.classList.toggle('menue-offen', offen);
  menueKnopf.setAttribute('aria-expanded', String(offen));
  menueKnopf.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
  for (const teil of [$('main'), $('.fuss')]) teil.inert = offen;
}
menueKnopf.addEventListener('click', () => menueSetzen(!html.classList.contains('menue-offen')));
nav.addEventListener('click', e => { if (e.target.closest('a')) menueSetzen(false); });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && html.classList.contains('menue-offen')) { menueSetzen(false); menueKnopf.focus(); }
});
matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches) menueSetzen(false); });

/* ─── Anlässe: drei Sichten als Reiter ─── */
const wahl = $('[data-wahl]');
const reiterLeiste = $('.wahl-reiter', wahl);
const reiter = $$('.reiter', wahl);
const felder = reiter.map(r => document.getElementById(r.getAttribute('aria-controls')));
const strich = $('.reiter-strich', wahl);

function strichSetzen() {
  const r = reiter.find(r => r.getAttribute('aria-selected') === 'true');
  if (!r) return;
  strich.style.width = `${r.offsetWidth}px`;
  strich.style.transform = `translate(${r.offsetLeft}px, ${r.offsetTop + r.offsetHeight - 1}px)`;
}
function reiterWaehlen(i, mitFokus = false) {
  reiter.forEach((r, j) => {
    const an = i === j;
    r.setAttribute('aria-selected', String(an));
    r.tabIndex = an ? 0 : -1;
    felder[j].hidden = !an;
  });
  strichSetzen();
  if (mitFokus) reiter[i].focus();
}
reiter.forEach((r, i) => r.addEventListener('click', () => reiterWaehlen(i)));
reiterLeiste.addEventListener('keydown', e => {
  const jetzt = reiter.indexOf(document.activeElement);
  if (jetzt < 0) return;
  let ziel = null;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ziel = (jetzt + 1) % reiter.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ziel = (jetzt - 1 + reiter.length) % reiter.length;
  else if (e.key === 'Home') ziel = 0;
  else if (e.key === 'End') ziel = reiter.length - 1;
  if (ziel === null) return;
  e.preventDefault();
  reiterWaehlen(ziel, true);
});
reiterWaehlen(0);
document.fonts?.ready.then(strichSetzen);

/* Sprung von außen direkt zu einem Anlass: Reiter wählen, aufklappen, hinfahren */
function anlassOeffnen(id) {
  const anlass = document.getElementById(id);
  if (!anlass || !anlass.matches('.anlass')) return false;
  const i = felder.findIndex(f => f.contains(anlass));
  if (i >= 0) reiterWaehlen(i);
  anlass.open = true;
  anlass.scrollIntoView({ behavior: ruhig.matches ? 'auto' : 'smooth', block: 'center' });
  $('summary', anlass).focus({ preventScroll: true });
  return true;
}
document.addEventListener('click', e => {
  const verweis = e.target.closest('a[href^="#anlass-"]');
  if (!verweis) return;
  if (anlassOeffnen(verweis.getAttribute('href').slice(1))) { e.preventDefault(); history.replaceState(null, '', verweis.getAttribute('href')); }
});
if (location.hash.startsWith('#anlass-')) requestAnimationFrame(() => anlassOeffnen(location.hash.slice(1)));

/* „Mit diesem Anlass anfragen“: Auswahl im Formular vorbelegen */
const formular = $('[data-formular]');
document.addEventListener('click', e => {
  const verweis = e.target.closest('[data-anfrage]');
  if (!verweis) return;
  const anlass = verweis.closest('.anlass')?.dataset.anlass;
  const auswahl = formular.elements.anlass;
  if (anlass && [...auswahl.options].some(o => o.value === anlass)) {
    auswahl.value = anlass;
    feldPruefen(auswahl, true);
    const feld = auswahl.closest('.feld');
    feld.classList.remove('vorbelegt');
    requestAnimationFrame(() => feld.classList.add('vorbelegt'));
  }
});

/* ─── Formular: prüft, sendet aber nichts ─── */
const meldung = $('[data-meldung]', formular);
const regeln = {
  name: w => w.trim().length >= 2,
  kontakt: w => {
    const t = w.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) || (/^[\d\s+()/-]+$/.test(t) && t.replace(/\D/g, '').length >= 6);
  },
  anlass: w => w !== '',
};
function feldPruefen(feld, nurWennFalsch = false) {
  const regel = regeln[feld.name];
  if (!regel) return true;
  if (nurWennFalsch && feld.getAttribute('aria-invalid') !== 'true') return true;
  const gut = regel(feld.value);
  if (gut) feld.removeAttribute('aria-invalid'); else feld.setAttribute('aria-invalid', 'true');
  const hinweis = document.getElementById(`${feld.id}-fehler`);
  if (hinweis) hinweis.hidden = gut;
  return gut;
}
formular.addEventListener('input', e => feldPruefen(e.target, true));
formular.addEventListener('change', e => feldPruefen(e.target, true));
formular.addEventListener('focusout', e => { if (e.target.value && regeln[e.target.name]) feldPruefen(e.target); });
formular.addEventListener('submit', e => {
  e.preventDefault();
  let erstes = null;
  for (const name of Object.keys(regeln)) {
    const feld = formular.elements[name];
    if (!feldPruefen(feld) && !erstes) erstes = feld;
  }
  if (erstes) { meldung.hidden = true; erstes.focus(); return; }
  meldung.textContent = 'Dies ist eine Beispielseite. Ihre Angaben werden nicht gesendet.';
  meldung.hidden = false;
  meldung.scrollIntoView({ behavior: ruhig.matches ? 'auto' : 'smooth', block: 'nearest' });
});

/* ─── Klartext: aus dem Vertragssatz wird Wort für Wort ein klarer Satz ─── */
const klar = $('[data-klar]');
let klarStand = () => {};
if (klar && !ruhig.matches && CSS.supports('position', 'sticky')) {
  // Wörter einzeln fassen; der ganze Satz bleibt für Vorleseprogramme als ein Stück erhalten.
  const fassen = (absatz, mitLeer) => {
    const text = absatz.textContent.trim();
    const sicht = document.createElement('span');
    sicht.setAttribute('aria-hidden', 'true');
    const woerter = text.split(/\s+/).map((wort, i, alle) => {
      const w = document.createElement('span');
      w.className = 'w';
      const letztes = i === alle.length - 1;
      w.textContent = mitLeer && !letztes ? `${wort} ` : wort;
      sicht.append(w);
      if (!mitLeer && !letztes) sicht.append(' ');
      return w;
    });
    const ganz = document.createElement('span');
    ganz.className = 'nur-vorlesen';
    ganz.textContent = text;
    absatz.textContent = '';
    absatz.append(ganz, sicht);
    return { woerter, stand: 0 };
  };
  const paare = $$('.paar', klar).map(el => ({ el, alt: fassen($('[data-alt]', el), true), neu: fassen($('[data-neu]', el), false) }));
  const nr = $('[data-klar-nr]', klar);
  const setzen = (satz, anteil, klasse) => {
    const soll = Math.round(anteil * satz.woerter.length);
    if (soll === satz.stand) return;
    satz.woerter.forEach((w, i) => w.classList.toggle(klasse, i < soll));
    satz.stand = soll;
  };
  klar.classList.add('bewegt');
  let aktiv = -1;
  klarStand = () => {
    const r = klar.getBoundingClientRect();
    if (r.bottom < -innerHeight * .5 || r.top > innerHeight * 1.5) return;
    const weg = Math.max(1, r.height - innerHeight);
    const p = grenze(-r.top / weg);
    const x = Math.min(paare.length - 1e-4, p * paare.length);
    const i = Math.floor(x);
    const q = x - i;
    paare.forEach((paar, j) => {
      const durch = j < i ? 1 : j > i ? 0 : stufe(q, .06, .4);
      const neu = j < i ? 1 : j > i ? 0 : stufe(q, .44, .74);
      setzen(paar.alt, durch, 'weg');
      setzen(paar.neu, neu, 'da');
      paar.el.classList.toggle('klar-an', neu > 0);
    });
    if (i !== aktiv) {
      aktiv = i;
      paare.forEach((paar, j) => paar.el.classList.toggle('aktiv', j === i));
      nr.textContent = String(i + 1);
    }
    klar.style.setProperty('--fort', p.toFixed(3));
  };
}

/* ─── Ablauf: die Randlinie füllt sich, der aktuelle Schritt steht unter dem Film ─── */
const ablauf = $('.ablauf');
const schrittListe = $('[data-schritte]');
const schritte = $$('.schritt', schrittListe);
const schrittStand = $('[data-schritt-stand]');
const schrittTitel = schritte.map(s => $('h3', s).textContent.trim());
const standAnfang = schrittStand.textContent;
let letzterSchritt = -2;
if (!ruhig.matches) { ablauf.classList.add('bewegt'); schrittListe.classList.add('bewegt'); }
function ablaufStand() {
  const r = ablauf.getBoundingClientRect();
  if (r.bottom < -100 || r.top > innerHeight + 100) return;
  ablauf.style.setProperty('--fort', grenze((innerHeight * .62 - r.top) / r.height).toFixed(4));
  let letzter = -1;
  schritte.forEach((s, i) => {
    const an = s.getBoundingClientRect().top < innerHeight * .7;
    s.classList.toggle('war', an);
    if (an) letzter = i;
  });
  if (letzter !== letzterSchritt) {
    letzterSchritt = letzter;
    schrittStand.textContent = letzter < 0 ? standAnfang : `Schritt ${letzter + 1} von ${schritte.length}: ${schrittTitel[letzter]}`;
  }
}

/* ─── Kopf: Grund beim Scrollen, aktueller Bereich, laufende Randnummer ─── */
const kopf = $('[data-kopf]');
const rnAnzeige = $('[data-rn-stand]');
const navVerweise = $$('a[href^="#"]', nav);
const bereiche = navVerweise.map(a => document.getElementById(a.getAttribute('href').slice(1)));
let rnOben = [];
let bereichOben = [];
let rnJetzt = 0;
let bereichJetzt = -2;
function messen() {
  const y = scrollY;
  rnOben = $$('.rn').filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().top + y);
  bereichOben = bereiche.map(b => (b ? b.getBoundingClientRect().top + y : Infinity));
}
function kopfStand() {
  kopf.classList.toggle('fest', scrollY > 24);
  const marke = scrollY + innerHeight * .42;
  let rn = 1;
  for (let i = 0; i < rnOben.length && rnOben[i] <= marke; i++) rn = i + 1;
  if (rn !== rnJetzt) { rnJetzt = rn; rnAnzeige.textContent = String(rn); }
  let bereich = -1;
  for (let i = 0; i < bereichOben.length && bereichOben[i] <= marke; i++) bereich = i;
  if (bereich !== bereichJetzt) {
    bereichJetzt = bereich;
    navVerweise.forEach((a, i) => { if (i === bereich) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
}

/* ─── Ein Takt für alles, was am Scrollen hängt ─── */
let wartet = false;
function takt() { wartet = false; kopfStand(); klarStand(); ablaufStand(); }
function anstossen() { if (!wartet) { wartet = true; requestAnimationFrame(takt); } }
addEventListener('scroll', anstossen, { passive: true });
addEventListener('resize', () => { messen(); strichSetzen(); anstossen(); });
if ('ResizeObserver' in window) new ResizeObserver(() => { messen(); anstossen(); }).observe(document.body);
messen();
takt();
