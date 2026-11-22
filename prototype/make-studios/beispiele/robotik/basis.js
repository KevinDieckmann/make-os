// Gemeinsamer Teil der Seite: Kopf, Menü, Einblenden, Formular (sendet nichts). Das Besondere der Seite steht in szene.js.
const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const kannBeobachten = 'IntersectionObserver' in window;

html.classList.add('js');

/* Kopf: bekommt Grund, sobald gescrollt ist; weicht beim Abwärtsscrollen */
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
addEventListener('scroll', kopfAbgleichen, { passive: true });
kopfAbgleichen();

/* Menü unter 960 px */
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
kopf.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Tab' || !menueOffen()) return;
  const ziele = $$('a, button', kopf).filter((el) => el.offsetParent !== null);
  const erstes = ziele[0], letztes = ziele[ziele.length - 1];
  if (ev.shiftKey && document.activeElement === erstes) { ev.preventDefault(); letztes.focus(); }
  else if (!ev.shiftKey && document.activeElement === letztes) { ev.preventDefault(); erstes.focus(); }
});

/* Einblenden beim Hereinscrollen */
if (kannBeobachten && !wenigBewegung.matches) {
  html.classList.add('belebt');
  const zeiger = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) if (e.isIntersecting) { e.target.classList.add('da'); zeiger.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  $$('[data-zeig]').forEach((el) => zeiger.observe(el));
} else {
  $$('[data-zeig]').forEach((el) => el.classList.add('da'));
}

/* Menüpunkt des sichtbaren Abschnitts markieren */
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

/* Formular: prüft, sendet nichts */
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
  const pruefen = (feld) => {
    const ok = feld.gut(feld.el.value);
    const hinweis = document.getElementById(feld.el.id + '-fehler');
    if (ok) feld.el.removeAttribute('aria-invalid'); else feld.el.setAttribute('aria-invalid', 'true');
    if (hinweis) hinweis.hidden = ok;
    return ok;
  };
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
    formular.hidden = true; danke.hidden = false;
    danke.focus({ preventScroll: true });
    danke.scrollIntoView({ block: 'nearest', behavior: wenigBewegung.matches ? 'auto' : 'smooth' });
  });
  $('#danke-zurueck').addEventListener('click', () => {
    formular.reset();
    felder.forEach((feld) => { feld.el.removeAttribute('aria-invalid'); const h = document.getElementById(feld.el.id + '-fehler'); if (h) h.hidden = true; });
    danke.hidden = true; formular.hidden = false; nameFeld.focus();
  });
}
