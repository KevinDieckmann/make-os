// Lindenhof Immobilien · Beispielseite. Der Rundgang (Linie und Fotos folgen dem Scrollen), die Wertverfahren, Einblenden, Filme, Formular.
// Ohne dieses Skript bleibt alles lesbar: Der Rundgang steht dann als Liste, alle Verfahren sind sichtbar.
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

/* ─── Aktiver Abschnitt im Menü ─── */
if (kannBeobachten) {
  const links = new Map($$('.wege a').map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) links.forEach((a, id) => { if (id === e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ─── Einblenden ─── */
if (html.classList.contains('belebt')) {
  const ziele = $$('.abschnitt-kopf, .wert-fall, .wert-fuss, .weg li, .orte li, .menschen li, .haltung, details, .start-bild');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('da'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  ziele.forEach((el, i) => { el.setAttribute('data-zeig', ''); el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
}

/* ─── Wertverfahren: Reiter ─── */
const reiter = $$('.reiter-knopf');
function artWaehlen(art, fokus) {
  reiter.forEach((k) => { const an = k.dataset.art === art; k.setAttribute('aria-selected', String(an)); k.tabIndex = an ? 0 : -1; if (an && fokus) k.focus(); });
  $$('.wert-fall').forEach((f) => { f.hidden = f.dataset.art !== art; });
}
reiter.forEach((k, i) => {
  k.addEventListener('click', () => artWaehlen(k.dataset.art, false));
  k.addEventListener('keydown', (ev) => {
    const r = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
    if (!r) return;
    ev.preventDefault();
    artWaehlen(reiter[(i + r + reiter.length) % reiter.length].dataset.art, true);
  });
});

/* ─── Rundgang: Linie durch den Grundriss, Fotos und Texte wechseln mit dem Scrollen ─── */
const spur = $('.rundgang-spur');
const weg = $('#plan-weg'), gezogen = $('#plan-gezogen'), marke = $('#plan-marke');
const fotos = $$('.foto-bild'), stationen = $$('.station'), raeume = $$('.raum[data-i]');
const N = stationen.length;
// Länge des Weges bis zu jeder Station (die Stationen sind Eckpunkte der Linie)
const ECKEN = [[100, 345], [100, 290], [185, 230], [185, 150], [395, 120], [450, 120], [450, 300], [270, 345], [135, 345], [120, 90]];
const STATIONS_ECKE = [3, 5, 6, 7, 9];
const abstaende = [0];
for (let i = 1; i < ECKEN.length; i++) abstaende.push(abstaende[i - 1] + Math.hypot(ECKEN[i][0] - ECKEN[i - 1][0], ECKEN[i][1] - ECKEN[i - 1][1]));
const gesamt = abstaende[abstaende.length - 1];
const bei = STATIONS_ECKE.map((e) => abstaende[e]);
const laenge = weg.getTotalLength();
const skala = laenge / gesamt;
let aktiv = -1, zeichnen = 0;

function laengeFuer(p) {
  // p 0..1 → Weglänge: Station i liegt bei (i + 0.5) / N
  const pos = p * N - 0.5;
  if (pos <= 0) return bei[0] * clamp01(p / (0.5 / N));
  if (pos >= N - 1) return bei[N - 1] + (gesamt - bei[N - 1]) * clamp01((pos - (N - 1)) / 0.5);
  const i = Math.floor(pos), t = pos - i;
  return bei[i] + (bei[i + 1] - bei[i]) * t;
}
const clamp01 = (x) => klemme(x, 0, 1);

function abgleichen() {
  zeichnen = 0;
  const r = spur.getBoundingClientRect();
  const weit = spur.offsetHeight - (parseFloat(getComputedStyle($('.rundgang-buehne')).height) || innerHeight);
  const p = weit > 0 ? clamp01(-r.top / weit) : 0;
  const l = laengeFuer(p) * skala;
  gezogen.style.strokeDasharray = laenge;
  gezogen.style.strokeDashoffset = laenge - l;
  const pt = weg.getPointAtLength(Math.min(l, laenge));
  marke.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
  const i = Math.min(N - 1, Math.floor(p * N));
  if (i !== aktiv) {
    aktiv = i;
    fotos.forEach((f) => f.classList.toggle('aktiv', +f.dataset.i === i));
    stationen.forEach((s) => s.classList.toggle('aktiv', +s.dataset.i === i));
    raeume.forEach((x) => x.classList.toggle('aktiv', +x.dataset.i === i));
    fotos.forEach((f) => { if (f.loading === 'lazy' && Math.abs(+f.dataset.i - i) <= 1) f.loading = 'eager'; });
  }
}
const anstossen = () => { if (!zeichnen) zeichnen = requestAnimationFrame(abgleichen); };
addEventListener('scroll', anstossen, { passive: true });
addEventListener('resize', anstossen);
abgleichen();

/* ─── Formular: sendet nichts ─── */
const formular = $('#anfrage-form'), danke = $('#anfrage-danke');
if (formular && danke) {
  const name = $('#f-name'), kontakt = $('#f-kontakt');
  const fehler = (feld, schlecht) => { $('#' + feld.id + '-fehler').hidden = !schlecht; feld.setAttribute('aria-invalid', String(schlecht)); return schlecht; };
  formular.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const a = fehler(name, !name.value.trim()), b = fehler(kontakt, !kontakt.value.trim());
    if (a || b) { (a ? name : kontakt).focus(); return; }
    $('#danke-name').textContent = ', ' + name.value.trim().split(/\s+/)[0];
    formular.hidden = true; danke.hidden = false; danke.focus();
  });
  $('#danke-zurueck').addEventListener('click', () => { formular.reset(); formular.hidden = false; danke.hidden = true; name.focus(); });
}
