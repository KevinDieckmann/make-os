// Kurswerk Beratung · Beispielseite. Die Seekarte (Problem wählen, Kurs ziehen), Lesefortschritt, Einblenden, Filme, Formular.
// Ohne dieses Skript bleibt alles lesbar: Alle Probleme stehen dann untereinander.
import { filmEinrichten } from './film.js';

const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const kannBeobachten = 'IntersectionObserver' in window;
const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));

html.classList.add('js');
html.classList.toggle('belebt', !wenigBewegung.matches && kannBeobachten);

/* ─── Filme ─── */
$$('.film').forEach(filmEinrichten);

/* ─── Lesefortschritt ─── */
const balken = $('.fortschritt');
function fortschritt() {
  const rest = document.documentElement.scrollHeight - innerHeight;
  balken.style.setProperty('--f', rest > 0 ? klemme(scrollY / rest).toFixed(4) : '0');
}
addEventListener('scroll', fortschritt, { passive: true });
fortschritt();

/* ─── Aktiver Abschnitt im Menü ─── */
if (kannBeobachten) {
  const links = new Map($$('.wege a').map((a) => [a.getAttribute('href').slice(1), a]));
  const beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      links.forEach((a, id) => { if (id === e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) beobachter.observe(s); });
}

/* ─── Einblenden ─── */
if (html.classList.contains('belebt')) {
  const ziele = $$('.abschnitt-kopf, .verzeichnis li, .akte, .phasen li, .haltung li, .menschen li, details, .vorgehen-film');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('da'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  ziele.forEach((el, i) => { el.setAttribute('data-zeig', ''); el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
}

/* ─── Seekarte: Problem wählen, Kurs ziehen ─── */
const WEGE = {
  nachfolge: 'M70 360C190 360 230 200 350 200S560 330 650 250S800 130 850 110',
  wachstum: 'M70 380C220 370 300 330 400 290S560 230 640 170S790 90 850 70',
  ablaeufe: 'M70 120C190 120 230 330 330 330S450 130 560 130S640 330 740 330S800 250 850 230',
  zahlen: 'M70 380C170 380 170 300 270 300S370 220 470 220S570 140 670 140S780 90 850 90',
};
const WEGE_HOCH = {
  nachfolge: 'M90 540C90 450 330 470 330 380S90 330 110 250S330 200 330 70',
  wachstum: 'M80 540C80 470 200 450 240 400S330 330 320 270S150 220 200 150S330 100 330 60',
  ablaeufe: 'M90 80C90 160 330 150 330 230S90 270 90 350S330 380 330 460S250 520 250 540',
  zahlen: 'M80 540C80 460 220 470 240 400S110 340 160 280S300 240 270 180S320 110 340 60',
};
const hochMq = matchMedia('(max-width: 599px)');
const URTEIL = [
  'Noch kein Signal. Wenn Sie trotzdem etwas stört, reicht oft ein kurzes Gespräch, um es einzuordnen.',
  'Ein Punkt trifft zu. Das lässt sich im Erstgespräch meist schnell einordnen.',
  'Zwei Punkte treffen zu. Hier lohnt sich ein Erstgespräch in den nächsten Wochen.',
  'Alle drei Punkte treffen zu. Das Problem wird eher größer als kleiner, ein Erstgespräch ist jetzt sinnvoll.',
];
const weg = $('#karte-weg'), gezogen = $('#karte-gezogen'), schiff = $('#karte-schiff');
const punkte = $$('#karte-punkte .punkt');
const knoepfe = $$('.wahl-knopf');
const kSvg = $('#karte'), kGrund = $('.karte-grund'), kGitter = $('.karte-gitter'), kRose = $('.karte-rose'), kTiefe = $$('.karte-tiefe path');
const TIEFE = [['M0 400C140 360 240 410 380 380S640 330 900 372', 'M0 360C150 322 250 372 392 342S650 292 900 330', 'M0 322C160 286 260 332 404 304S660 256 900 290'], ['M0 590C100 570 220 600 420 566', 'M0 556C110 536 230 566 420 532', 'M0 522C120 502 240 532 420 498']];
function formatAnpassen() {
  const h = hochMq.matches, b = h ? 420 : 900, t = h ? 600 : 440;
  kSvg.setAttribute('viewBox', `0 0 ${b} ${t}`); kSvg.classList.toggle('hoch', h);
  [kGrund, kGitter].forEach((r) => { r.setAttribute('width', b); r.setAttribute('height', t); });
  kRose.setAttribute('transform', h ? 'translate(356 540)' : 'translate(800 372)');
  kTiefe.forEach((p, i) => p.setAttribute('d', TIEFE[h ? 1 : 0][i]));
}
const wegFuer = (fall) => (hochMq.matches ? WEGE_HOCH : WEGE)[fall];
const probleme = $$('.problem');
let laenge = 0, lauf = 0, aktuell = null;

function kursSetzen(p) {
  gezogen.style.strokeDasharray = laenge;
  gezogen.style.strokeDashoffset = laenge * (1 - p);
  const a = weg.getPointAtLength(laenge * p), b = weg.getPointAtLength(laenge * Math.min(1, p + 0.01)), c = weg.getPointAtLength(laenge * Math.max(0, p - 0.01));
  const grad = Math.atan2(b.y - c.y, b.x - c.x) * 180 / Math.PI + 90;
  schiff.setAttribute('transform', `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${grad.toFixed(1)})`);
  punkte.forEach((pt, i) => pt.classList.toggle('da', p >= i / 3 - 0.001));
  const panel = probleme.find((x) => x.dataset.fall === aktuell);
  if (panel) $$('.schritte li', panel).forEach((li, i) => li.classList.toggle('erreicht', p >= i / 3 - 0.001));
}

function kursZiehen() {
  cancelAnimationFrame(lauf);
  if (wenigBewegung.matches) { kursSetzen(1); return; }
  const dauer = 2400, t0 = performance.now();
  const schritt = (t) => {
    const u = klemme((t - t0) / dauer);
    kursSetzen(1 - Math.pow(1 - u, 3));
    if (u < 1) lauf = requestAnimationFrame(schritt);
  };
  kursSetzen(0);
  lauf = requestAnimationFrame(schritt);
}

function wegAuf(fall) {
  weg.setAttribute('d', wegFuer(fall));
  gezogen.setAttribute('d', wegFuer(fall));
  laenge = weg.getTotalLength();
  punkte.forEach((pt, i) => {
    const q = weg.getPointAtLength(laenge * i / 3);
    pt.setAttribute('transform', `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`);
  });
}

function waehlen(fall, ziehen) {
  if (fall === aktuell) return;
  aktuell = fall;
  knoepfe.forEach((k) => { const an = k.dataset.fall === fall; k.setAttribute('aria-checked', String(an)); k.tabIndex = an ? 0 : -1; });
  probleme.forEach((p) => p.classList.toggle('aktiv', p.dataset.fall === fall));
  wegAuf(fall);
  if (ziehen) kursZiehen(); else kursSetzen(1);
}

knoepfe.forEach((k, i) => {
  k.addEventListener('click', () => waehlen(k.dataset.fall, true));
  k.addEventListener('keydown', (ev) => {
    const richtung = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
    if (!richtung) return;
    ev.preventDefault();
    const n = knoepfe[(i + richtung + knoepfe.length) % knoepfe.length];
    n.focus(); waehlen(n.dataset.fall, true);
  });
});

/* Erste Wahl: der Kurs wird gezogen, sobald die Karte im Bild ist */
formatAnpassen();
hochMq.addEventListener('change', () => { formatAnpassen(); if (aktuell) { wegAuf(aktuell); kursSetzen(1); } });
waehlen('nachfolge', false);
if (kannBeobachten && !wenigBewegung.matches) {
  kursSetzen(0);
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); kursZiehen(); } }, { threshold: 0.45 });
  io.observe($('.karte'));
}

/* Die Knöpfe im Einstieg springen zur Karte und wählen das Problem */
$$('.start-probleme button').forEach((b) => b.addEventListener('click', () => {
  $('#probleme').scrollIntoView({ behavior: wenigBewegung.matches ? 'auto' : 'smooth' });
  waehlen(b.dataset.fall, true);
}));

/* ─── Kurz-Check je Problem ─── */
probleme.forEach((panel) => {
  const haken = $$('input[type="checkbox"]', panel);
  const pegel = $('.pegel', panel), urteil = $('.urteil', panel);
  const neu = () => {
    const n = haken.filter((h) => h.checked).length;
    pegel.style.setProperty('--p', String(n / 3));
    urteil.textContent = n ? URTEIL[n] : '';
    if (n >= 2) {
      const a = document.createElement('a');
      a.href = '#kontakt'; a.className = 'textlink textlink-hell'; a.textContent = 'Erstgespräch vereinbaren';
      urteil.append(' ', a);
    }
  };
  haken.forEach((h) => h.addEventListener('change', neu));
});

/* ─── Formular: sendet nichts ─── */
const formular = $('#anfrage-form'), danke = $('#anfrage-danke');
if (formular && danke) {
  const name = $('#f-name'), kontakt = $('#f-kontakt');
  const fehler = (feld, schlecht) => { const p = $('#' + feld.id + '-fehler'); p.hidden = !schlecht; feld.setAttribute('aria-invalid', String(schlecht)); return schlecht; };
  formular.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const a = fehler(name, !name.value.trim()), b = fehler(kontakt, !kontakt.value.trim());
    if (a || b) { (a ? name : kontakt).focus(); return; }
    $('#danke-name').textContent = ', ' + name.value.trim().split(/\s+/)[0];
    formular.hidden = true; danke.hidden = false; danke.focus();
  });
  $('#danke-zurueck').addEventListener('click', () => { formular.reset(); formular.hidden = false; danke.hidden = true; name.focus(); });
}
