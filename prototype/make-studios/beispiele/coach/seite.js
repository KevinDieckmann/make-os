// Fermate · Beispielseite. Menü, Kopf, Einblenden, die Pause-Szene, der wachsende Film, Formular.
// Ohne dieses Skript bleibt alles lesbar: Die belebte Fassung wird erst hier eingeschaltet (html.belebt).
import { filmEinrichten } from './film.js';

const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const kannBeobachten = 'IntersectionObserver' in window;
const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));

html.classList.add('js');
const belebtSetzen = () => html.classList.toggle('belebt', !wenigBewegung.matches && kannBeobachten);
belebtSetzen();

/* ─── Kopf: bekommt Grund, sobald gescrollt ist; weicht beim Abwärtsscrollen, kommt beim Aufwärtsscrollen ─── */
const kopf = $('#kopf');
const menue = $('#menue');
const menueKnopf = $('.menue-knopf');
let letztesY = scrollY;

function kopfAbgleichen() {
  const y = scrollY;
  kopf.classList.toggle('fest', y > 24);
  if (!kopf.classList.contains('offen')) {
    if (y > letztesY + 4 && y > 520) kopf.classList.add('weg');
    else if (y < letztesY - 4 || y <= 520) kopf.classList.remove('weg');
  }
  letztesY = y;
}

/* ─── Menü unter 960 px ─── */
const schmal = matchMedia('(max-width: 959px)');
const rest = [$('main'), $('.fuss')];

function menueSetzen(offen, fokus = true) {
  kopf.classList.toggle('offen', offen);
  kopf.classList.remove('weg');
  html.classList.toggle('gesperrt', offen);
  menueKnopf.setAttribute('aria-expanded', String(offen));
  $('.menue-knopf-text').textContent = offen ? 'Schließen' : 'Menü';
  rest.forEach((el) => { if (el) el.inert = offen; });
  if (offen) $('a', menue)?.focus({ preventScroll: true });
  else if (fokus) menueKnopf.focus({ preventScroll: true });
}
const menueOffen = () => kopf.classList.contains('offen');

menueKnopf.addEventListener('click', () => menueSetzen(!menueOffen()));
menue.addEventListener('click', (ev) => { if (ev.target.closest('a') && menueOffen()) menueSetzen(false, false); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && menueOffen()) menueSetzen(false); });
schmal.addEventListener('change', () => { if (!schmal.matches && menueOffen()) menueSetzen(false, false); });
// Tastatur bleibt im offenen Menü (Marke, Knopf, Verweise).
kopf.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Tab' || !menueOffen()) return;
  const ziele = $$('a, button', kopf).filter((el) => el.offsetParent !== null);
  const erstes = ziele[0], letztes = ziele[ziele.length - 1];
  if (ev.shiftKey && document.activeElement === erstes) { ev.preventDefault(); letztes.focus(); }
  else if (!ev.shiftKey && document.activeElement === letztes) { ev.preventDefault(); erstes.focus(); }
});

/* ─── Einblenden beim Hereinscrollen ─── */
if (kannBeobachten) {
  const zeiger = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) if (e.isIntersecting) { e.target.classList.add('da'); zeiger.unobserve(e.target); }
  }, { rootMargin: '0px 0px -9% 0px', threshold: 0.12 });
  $$('[data-zeig]').forEach((el) => zeiger.observe(el));
} else {
  $$('[data-zeig]').forEach((el) => el.classList.add('da'));
}

/* ─── Menüpunkt des sichtbaren Abschnitts markieren ─── */
if (kannBeobachten) {
  const verweise = new Map($$('.menue-liste a').map((a) => [a.getAttribute('href').slice(1), a]));
  const ort = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      verweise.forEach((v) => v.removeAttribute('aria-current'));
      verweise.get(e.target.id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach((el) => ort.observe(el));
}

/* ─── Szenen, die am Scrollen hängen: Einstiegsbild, Pause, Film ───
   Gerechnet wird nur, solange die jeweilige Szene im Bild ist; die Werte laufen weich nach. */
const einstiegBild = $('.einstieg-bild img');
const einstieg = $('.einstieg');
const pause = $('#pause');
const raumRahmen = $('.raum-rahmen');

const szenen = [
  { el: einstieg, ziel: einstiegBild, name: '--h', wert: 0, soll: 0, nah: true,
    messen: (r, vh) => klemme(-r.top / Math.max(1, r.height)) },
  { el: pause, ziel: pause, name: '--p', wert: 0, soll: 0, nah: false,
    messen: (r, vh) => klemme(-r.top / Math.max(1, r.height - vh)) },
  { el: raumRahmen, ziel: raumRahmen, name: '--g', wert: 0, soll: 0, nah: false,
    messen: (r, vh) => { const t = klemme((vh - r.top) / (vh * 0.72)); return t * t * (3 - 2 * t); } },
].filter((s) => s.el && s.ziel);

let bild = 0;
function szenenSchritt() {
  bild = 0;
  if (!html.classList.contains('belebt')) return;
  const vh = innerHeight;
  let unruhig = false;
  for (const s of szenen) {
    if (!s.nah) continue;
    s.soll = s.messen(s.el.getBoundingClientRect(), vh);
    const d = s.soll - s.wert;
    s.wert = Math.abs(d) < 0.0006 ? s.soll : s.wert + d * 0.16;
    if (s.wert !== s.soll) unruhig = true;
    s.ziel.style.setProperty(s.name, s.wert.toFixed(4));
  }
  if (unruhig) bild = requestAnimationFrame(szenenSchritt);
}
const szenenAnstossen = () => { if (!bild) bild = requestAnimationFrame(szenenSchritt); };

if (kannBeobachten) {
  const nah = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      const s = szenen.find((x) => x.el === e.target);
      if (s) s.nah = e.isIntersecting;
      if (e.target === pause) pause.classList.toggle('sichtbar', e.isIntersecting);
    }
    szenenAnstossen();
  }, { rootMargin: '25% 0px' });
  szenen.forEach((s) => nah.observe(s.el));
}

function szenenZuruecksetzen() {
  // ruhige Fassung: keine gesetzten Werte, das Stylesheet zeigt den Endzustand
  for (const s of szenen) { s.ziel.style.removeProperty(s.name); s.wert = 0; }
}

addEventListener('scroll', () => { kopfAbgleichen(); szenenAnstossen(); }, { passive: true });
addEventListener('resize', szenenAnstossen, { passive: true });
wenigBewegung.addEventListener?.('change', () => { belebtSetzen(); if (html.classList.contains('belebt')) szenenAnstossen(); else szenenZuruecksetzen(); });
kopfAbgleichen();
szenenAnstossen();

/* ─── Filme ─── */
$$('.film').forEach((rahmen) => filmEinrichten(rahmen));

/* ─── Formular: prüft, sendet nichts ─── */
const formular = $('#anfrage-form');
const danke = $('#anfrage-danke');
if (formular && danke) {
  const nameFeld = $('#f-name', formular);
  const kontaktFeld = $('#f-kontakt', formular);
  const istMail = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
  const istTelefon = (t) => /^[+\d][\d\s()/.-]{5,}$/.test(t) && t.replace(/\D/g, '').length >= 6;
  const felder = [
    { el: nameFeld, gut: (t) => t.trim().length >= 2 },
    { el: kontaktFeld, gut: (t) => istMail(t.trim()) || istTelefon(t.trim()) },
  ];

  function pruefen(feld) {
    const ok = feld.gut(feld.el.value);
    const hinweis = document.getElementById(feld.el.id + '-fehler');
    feld.el.setAttribute('aria-invalid', String(!ok));
    if (ok) feld.el.removeAttribute('aria-invalid');
    if (hinweis) hinweis.hidden = ok;
    return ok;
  }
  for (const feld of felder) {
    feld.el.addEventListener('blur', () => { if (feld.el.value.trim() || feld.el.hasAttribute('aria-invalid')) pruefen(feld); });
    feld.el.addEventListener('input', () => { if (feld.el.hasAttribute('aria-invalid')) pruefen(feld); });
  }

  formular.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fehler = felder.filter((feld) => !pruefen(feld));
    if (fehler.length) { fehler[0].el.focus(); return; }
    const vorname = nameFeld.value.trim().split(/\s+/)[0].slice(0, 40);
    $('#danke-name').textContent = vorname ? ', ' + vorname : '';
    formular.hidden = true;
    danke.hidden = false;
    danke.focus({ preventScroll: true });
    danke.scrollIntoView({ block: 'nearest', behavior: wenigBewegung.matches ? 'auto' : 'smooth' });
  });

  $('#danke-zurueck').addEventListener('click', () => {
    formular.reset();
    felder.forEach((feld) => { feld.el.removeAttribute('aria-invalid'); const h = document.getElementById(feld.el.id + '-fehler'); if (h) h.hidden = true; });
    danke.hidden = true;
    formular.hidden = false;
    nameFeld.focus();
  });
}
