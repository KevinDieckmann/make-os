// Havelblick Luftservice · Beispielseite. Menü, Kopf, Einblenden, die Szene „Der Flug“, Ergebnisse, Ablauf, Vergleich, Formular.
// Ohne dieses Skript bleibt alles lesbar: Die Szene steht als Bild, die belebte Fassung schaltet erst dieses Skript ein (html.belebt).
import { szeneBauen, ausschnittZeichnen, moduleDetail } from './szene.js';

const html = document.documentElement;
const $ = (s, w = document) => w.querySelector(s);
const $$ = (s, w = document) => [...w.querySelectorAll(s)];
const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const kannBeobachten = 'IntersectionObserver' in window;
const klemme = (w, a = 0, b = 1) => Math.min(b, Math.max(a, w));
const weich = (t) => { t = klemme(t); return t * t * (3 - 2 * t); };

html.classList.add('js');
const belebtSetzen = () => html.classList.toggle('belebt', !wenigBewegung.matches && kannBeobachten);
belebtSetzen();
const belebt = () => html.classList.contains('belebt');

/* ─── Kopf: bekommt Grund, sobald gescrollt ist; weicht beim Abwärtsscrollen ─── */
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
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
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

/* ═══ Die Szene „Der Flug“ ═══ */
const flug = $('#start');
const buehne = $('.flug-buehne', flug);
const canvas = $('#szene');
const szene = szeneBauen(canvas);
const hud = $('#flug-hud');
hud.hidden = false;

const TEXTE = {
  plan: ['01 / 03', 'Planen', 'Vor dem Start steht die Bahn fest: Streifen mit Überlappung, damit aus vielen Einzelbildern ein Ganzes wird.'],
  foto: ['02 / 03', 'Fliegen', 'Die Drohne fliegt die Bahn ab und löst in festen Abständen aus. Aus den Luftbildern entsteht später ein maßstäbliches Orthofoto.'],
  waerme: ['02 / 03', 'Fliegen', 'Die Wärmebildkamera zeigt, was das Auge nicht sieht: Ein Modul im Feld ist deutlich wärmer als seine Nachbarn.'],
  hoehe: ['02 / 03', 'Fliegen', 'Aus dem Raster der Messpunkte entsteht ein Höhenmodell. Daraus lassen sich Flächen, Höhen und Stufen ablesen.'],
  fertig: ['03 / 03', 'Auswerten', 'Am Ende steht kein Bildordner, sondern ein Bericht mit Befunden, Position und Empfehlung.'],
};
const knoepfe = $$('.ansicht-knopf', hud);
const el = {
  zahl: $('#schritt-zahl'), name: $('#schritt-name'), text: $('#schritt-text'),
  streifen: $('#zahl-streifen'), bilder: $('#zahl-bilder'), callout: $('#callout'),
  balken: $$('.schritt-faden i', hud),
};

const zustand = { modus: 'foto', davor: 'foto', mix: 1, ziel: 0, prog: 0, benutzt: false, gezeigt: '', sichtbar: false, calloutAn: false };
let letzteZeit = 0, rahmenId = 0;

function modusSetzen(modus, vonHand = true) {
  if (modus === zustand.modus) return;
  zustand.davor = zustand.modus; zustand.modus = modus; zustand.mix = belebt() ? 0 : 1;
  if (vonHand) { zustand.benutzt = true; knoepfe.forEach((k) => k.classList.remove('hinweis')); }
  knoepfe.forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.modus === modus)));
  buehne.dataset.modus = modus;
  textZeigen(true);
  anstossen();
}
knoepfe.forEach((k) => k.addEventListener('click', () => modusSetzen(k.dataset.modus)));
buehne.dataset.modus = 'foto';

function textZeigen(erzwingen = false) {
  const schl = !belebt() ? zustand.modus : zustand.prog >= 0.8 ? 'fertig' : zustand.prog < 0.36 ? 'plan' : zustand.modus;
  const key = schl + (belebt() ? 'b' : 'r');
  if (!erzwingen && key === zustand.gezeigt) return;
  zustand.gezeigt = key;
  const [zahl, name, text] = TEXTE[schl];
  el.zahl.textContent = zahl; el.name.textContent = name; el.text.textContent = text;
}

function schritt(zeit) {
  rahmenId = 0;
  const dt = Math.min(0.1, (zeit - letzteZeit) / 1000 || 0.016); letzteZeit = zeit;
  const ruhe = !belebt();
  // Scrollstand der Szene
  if (!ruhe) {
    const r = flug.getBoundingClientRect(), max = Math.max(1, r.height - innerHeight);
    zustand.ziel = klemme(-r.top / max);
    zustand.prog += (zustand.ziel - zustand.prog) * Math.min(1, dt * 9);
    if (Math.abs(zustand.ziel - zustand.prog) < 0.0004) zustand.prog = zustand.ziel;
  } else { zustand.prog = 1; }
  const prog = zustand.prog;
  if (zustand.mix < 1) zustand.mix = Math.min(1, zustand.mix + dt * 2.2);

  const hero = ruhe ? 1 : 1 - weich((prog - 0.03) / 0.09);
  const hudW = ruhe ? 1 : weich((prog - 0.05) / 0.08);
  buehne.style.setProperty('--hero', hero.toFixed(3));
  buehne.style.setProperty('--hud', hudW.toFixed(3));
  el.balken[0].style.setProperty('--f', ruhe ? 1 : klemme((prog - 0.08) / 0.28).toFixed(3));
  el.balken[1].style.setProperty('--f', ruhe ? 1 : klemme((prog - 0.36) / 0.44).toFixed(3));
  el.balken[2].style.setProperty('--f', ruhe ? 1 : klemme((prog - 0.8) / 0.2).toFixed(3));
  $('#flug-kopf').style.pointerEvents = hero > 0.25 ? 'auto' : 'none';
  hud.style.pointerEvents = hudW > 0.3 ? '' : 'none';

  const info = szene.zeichnen({
    p: ruhe ? 1 : klemme((prog - 0.14) / 0.76), plan: ruhe ? 1 : klemme((prog - 0.02) / 0.1),
    modus: zustand.modus, davor: zustand.davor, mix: zustand.mix, t: zeit / 1000,
  });
  textZeigen();
  const gestartet = ruhe || prog > 0.14;
  el.streifen.textContent = gestartet ? info.streifen : 0;
  el.bilder.textContent = gestartet ? info.aufnahmen : 0;

  // Hinweis auf die Wärmebild-Ansicht, wenn noch nicht umgeschaltet wurde
  const ruf = belebt() && !zustand.benutzt && prog > 0.5 && prog < 0.9;
  knoepfe.find((k) => k.dataset.modus === 'waerme').classList.toggle('hinweis', ruf);

  // Markierung am auffälligen Modul
  const zeigeCallout = info.heissSichtbar && hudW > 0.5;
  if (zeigeCallout !== zustand.calloutAn) { zustand.calloutAn = zeigeCallout; el.callout.hidden = !zeigeCallout; }
  if (zeigeCallout) {
    const b = canvas.getBoundingClientRect(), bb = buehne.getBoundingClientRect();
    const x = info.heiss.x + (b.left - bb.left), y = info.heiss.y + (b.top - bb.top);
    el.callout.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.callout.classList.toggle('links', x > bb.width / 2);
  }
  if (!flug.classList.contains('bereit')) { flug.classList.add('bereit'); html.dataset.bereit = '1'; }

  // weiterlaufen, solange die Szene im Bild ist (Rotoren) oder etwas gleitet
  if (zustand.sichtbar && (belebt() || zustand.mix < 1)) rahmenId = requestAnimationFrame(schritt);
}
function anstossen() { if (!rahmenId) rahmenId = requestAnimationFrame(schritt); }

if (kannBeobachten) {
  new IntersectionObserver(([e]) => { zustand.sichtbar = e.isIntersecting; if (zustand.sichtbar) anstossen(); }, { rootMargin: '60px 0px' }).observe(flug);
} else { zustand.sichtbar = true; }
addEventListener('scroll', () => { kopfAbgleichen(); ablaufAbgleichen(); anstossen(); }, { passive: true });
let groessenTimer = 0;
new ResizeObserver(() => { clearTimeout(groessenTimer); groessenTimer = setTimeout(() => { szene.groesse(); ergebnisZeichnen(); anstossen(); }, 120); }).observe(canvas);
wenigBewegung.addEventListener?.('change', () => { belebtSetzen(); zustand.gezeigt = ''; anstossen(); ablaufAbgleichen(); });
szene.groesse();
kopfAbgleichen();
anstossen();

/* ═══ Ergebnisse: Ausgaben wählen ═══ */
const TAFEL = {
  foto: { titel: 'Orthofoto', satz: 'Aus vielen überlappenden Einzelbildern entsteht ein entzerrtes Luftbild, in dem sich Flächen und Abstände messen lassen.', klein: 'Gezeichnete Illustration.', rahmen: { x: 60, y: 240, w: 960, h: 540 } },
  waerme: { titel: 'Wärmebild-Auswertung', satz: 'Auffälligkeiten sind markiert und nummeriert. Das Modul mit dem Ring läuft deutlich wärmer als seine Nachbarn.', klein: 'Falschfarben, gezeichnete Illustration.', rahmen: { x: 60, y: 240, w: 960, h: 540 }, marke: true },
  hoehe: { titel: '3D-Modell und Höhen', satz: 'Aus den Messpunkten entsteht ein Höhenmodell: Dachflächen, Aufbauten und Bäume mit ihren Höhen. Daraus folgen digitales Dachaufmaß und Flächen.', klein: 'Höhenfarben, gezeichnete Illustration.', rahmen: { x: 60, y: 240, w: 960, h: 540 } },
  bericht: { titel: 'Bericht', satz: 'Jeder Befund mit Nummer, Ort und Empfehlung. Dazu kommen Bildseiten mit Position und Foto.', klein: 'Beispielbericht, Inhalt erfunden.' },
};
const tabs = $$('.reiter-knopf');
const tafel = $('#tafel'), ergebnisBild = $('#ergebnis-bild'), bericht = $('#ergebnis-bericht');
let tabAktiv = 'foto';

function ergebnisZeichnen() {
  const t = TAFEL[tabAktiv];
  if (!t || !t.rahmen) return;
  ausschnittZeichnen(ergebnisBild, szene, tabAktiv, t.rahmen, t.marke);
}
function tabSetzen(ebene, fokus = false) {
  tabAktiv = ebene;
  const t = TAFEL[ebene];
  tabs.forEach((k) => { const an = k.dataset.ebene === ebene; k.setAttribute('aria-selected', String(an)); k.tabIndex = an ? 0 : -1; if (an) { tafel.setAttribute('aria-labelledby', k.id); if (fokus) k.focus(); } });
  $('#tafel-titel').textContent = t.titel; $('#tafel-satz').textContent = t.satz; $('#tafel-klein').textContent = t.klein;
  bericht.hidden = ebene !== 'bericht'; ergebnisBild.hidden = ebene === 'bericht';
  ergebnisZeichnen();
}
tabs.forEach((k, i) => {
  k.tabIndex = i === 0 ? 0 : -1;
  k.addEventListener('click', () => tabSetzen(k.dataset.ebene));
  k.addEventListener('keydown', (ev) => {
    const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return; ev.preventDefault();
    tabSetzen(tabs[(i + d + tabs.length) % tabs.length].dataset.ebene, true);
  });
});
tabSetzen('foto');

/* ═══ Ablauf: Linie füllt sich beim Scrollen ═══ */
const schritteEl = $('#schritte');
const karten = $$('.schritt-karte', schritteEl);
function ablaufAbgleichen() {
  let lauf = 1;
  if (belebt()) {
    const r = schritteEl.getBoundingClientRect(), vh = innerHeight;
    lauf = klemme((vh * 0.8 - r.top) / Math.min(r.height, vh * 0.9));
  }
  schritteEl.style.setProperty('--lauf', lauf.toFixed(3));
  karten.forEach((k, i) => k.classList.toggle('aktiv', lauf >= i / (karten.length - 1) - 0.001 && (lauf > 0.02 || !belebt())));
}
ablaufAbgleichen();

/* ═══ Einsatzbeispiel: Regler Foto gegen Wärmebild ═══ */
const vergleich = $('#vergleich');
if (vergleich) {
  moduleDetail($('#v-foto'), 'foto');
  const marke = moduleDetail($('#v-waerme'), 'waerme');
  const ring = $('#v-ring');
  if (marke) { ring.style.left = (marke.x * 100).toFixed(1) + '%'; ring.style.top = (marke.y * 100).toFixed(1) + '%'; }
  const regler = $('#v-wert');
  const setzen = () => {
    const w = Number(regler.value);
    vergleich.style.setProperty('--x', String(w));
    regler.setAttribute('aria-valuetext', w < 10 ? 'Fast nur Wärmebild' : w > 90 ? 'Fast nur Foto' : `${w} Prozent Foto, ${100 - w} Prozent Wärmebild`);
  };
  regler.addEventListener('input', setzen);
  setzen();
  // einmal sanft anspielen, damit der Regler auffällt; jede Eingabe der Besucherin oder des Besuchers bricht es ab
  if (kannBeobachten && !wenigBewegung.matches) {
    let abbruch = false;
    regler.addEventListener('pointerdown', () => { abbruch = true; }, { once: true });
    regler.addEventListener('keydown', () => { abbruch = true; }, { once: true });
    const o = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      const start = performance.now();
      const lauf = (z) => {
        if (abbruch) return;
        const u = (z - start) / 2200;
        const w = u >= 1 ? 50 : 50 + Math.sin(u * Math.PI * 2) * 24 * (1 - u * 0.5);
        regler.value = String(Math.round(w)); setzen();
        if (u < 1) requestAnimationFrame(lauf);
      };
      requestAnimationFrame(lauf);
    }, { threshold: 0.6 });
    o.observe(vergleich);
  }
}

/* ═══ Formular: prüft, sendet nichts ═══ */
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
