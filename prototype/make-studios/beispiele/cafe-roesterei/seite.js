// Lohe Kaffeerösterei · Beispielseite. Startet Vorlader, Bewegung, weiches Scrollen, den Röstfilm und die 3D-Ansichten.
// Die Bestellung ist nur eine Vorführung: Kein Formular, kein Versand, keine Daten verlassen den Browser.
import Lenis from '../vendor/lenis/lenis.mjs';
import { bewegungStarten, lenisSetzen, imTakt, wenn, federLauf, feder, scrubAnmelden } from './bewegung.js';
import { vorladerStarten } from './vorlader.js';
import { druckerStarten } from './drucker.js';
import { opalStarten } from './opal.js';
import { roestenStarten } from './roesten.js';

const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wurzel = document.documentElement;

// Über 1440 px wächst die Schrift mit, darunter regelt das Stylesheet
function schriftGroesse() {
  const w = innerWidth;
  wurzel.style.fontSize = w > 1440 ? `${16 + (16 * (w - 1440) / 1440) * 0.6666}px` : '';
}
schriftGroesse();
addEventListener('resize', schriftGroesse);

const meldungEl = document.querySelector('.meldung');
let meldungGezeigt = false;
function meldung(text) {
  if (!meldungEl || meldungGezeigt) return;
  meldungGezeigt = true;
  meldungEl.textContent = text;
  meldungEl.hidden = false;
  setTimeout(() => { meldungEl.hidden = true; }, 9000);
}
const DREI_D_FEHLT = 'Die 3D-Ansicht konnte nicht geladen werden. Der Rest der Seite funktioniert wie gewohnt.';

/* ─── 3D-Ansichten ─── */
function webglDa() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
const mit3d = webglDa();
const heldBereit = mit3d
  ? import('./held.js').then((m) => m.heldStarten({ reduziert })).catch((e) => {
      console.info('Startbild ohne 3D:', e && e.message);
      document.querySelector('.held')?.classList.add('ohne-szene');
      meldung(DREI_D_FEHLT);
    })
  : Promise.resolve();
if (!mit3d) document.querySelector('.held')?.classList.add('ohne-szene');

/* ─── Vorlader und Bewegung ─── */
const { textBereit } = bewegungStarten({ reduziert });
vorladerStarten({ reduziert, heldBereit: Promise.race([heldBereit, textBereit.then(() => new Promise((ok) => setTimeout(ok, 1500)))]) });

/* ─── Weiches Scrollen ─── */
let lenis = null;
if (!reduziert) {
  lenis = new Lenis({ lerp: 0.1, autoRaf: false, smoothWheel: true, syncTouch: false });
  lenisSetzen(lenis);
}
// ziel: Element, Selektor oder Scrollstelle in Pixel
function scrolleZu(ziel) {
  if (typeof ziel === 'number') {
    if (lenis) lenis.scrollTo(ziel, { duration: 1.1 });
    else scrollTo({ top: ziel, behavior: reduziert ? 'auto' : 'smooth' });
    return;
  }
  const el = typeof ziel === 'string' ? document.querySelector(ziel) : ziel;
  if (!el) return;
  const fokus = () => { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); };
  if (lenis) lenis.scrollTo(el, { duration: 1.2, onComplete: fokus });
  else { el.scrollIntoView({ behavior: reduziert ? 'auto' : 'smooth' }); fokus(); }
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const ziel = document.querySelector(id);
  if (!ziel) return;
  e.preventDefault();
  menueSchliessen(false);
  history.replaceState(null, '', id);
  scrolleZu(ziel);
});

/* ─── Kopf: Farbe je Abschnitt, am Handy über dem Fuß ausgeblendet ─── */
const kopf = document.querySelector('.kopf');
const abschnitte = [...document.querySelectorAll('[data-kopf]')];
const fuss = document.querySelector('.fuss');
let tonZuletzt = '';
// Beim Lesen nach unten tritt der Kopf zurück, beim Zurückscrollen ist er sofort wieder da
let scrollZuletzt = scrollY;
let nachUnten = false;
let kopfFokus = false;
kopf.addEventListener('focusin', () => { kopfFokus = true; });
kopf.addEventListener('focusout', () => { kopfFokus = false; });
imTakt(() => {
  const y = scrollY;
  const schritt = y - scrollZuletzt;
  if (Math.abs(schritt) > 6) { nachUnten = schritt > 0 && y > 96; scrollZuletzt = y; }
  if (y < 96) nachUnten = false;
  let ton = 'dunkel';
  for (const s of abschnitte) {
    const r = s.getBoundingClientRect();
    if (r.top <= 35 && r.bottom > 35) { ton = s.dataset.kopf; break; }
  }
  if (menueOffen) ton = 'dunkel';
  if (ton !== tonZuletzt) { tonZuletzt = ton; kopf.dataset.ton = ton; }
  const amFuss = innerWidth < 768 && fuss && fuss.getBoundingClientRect().top <= 35;
  const verbergen = (amFuss || nachUnten) && !menueOffen && !kopfFokus;
  kopf.classList.toggle('ist-verborgen', !!verbergen);
});
if (!reduziert) {
  const teile = [...kopf.querySelectorAll('.kopf-leiste > *')];
  teile.forEach((t) => { t.style.opacity = '0'; t.style.transform = 'translateY(-12px)'; });
  wenn('enthuellt', () => teile.forEach((t, i) => federLauf({
    steif: 90, daempf: 26, verz: 200 + i * 60,
    bei: (v) => { t.style.opacity = String(Math.min(1, Math.max(0, v))); t.style.transform = `translateY(${(1 - v) * -12}px)`; },
    fertig: () => { t.style.transform = ''; },
  })));
}

/* ─── Menü am Handy ─── */
const menueKnopf = document.querySelector('.kopf-menue');
const menue = document.getElementById('seitenmenue');
let menueOffen = false;
function menueOeffnen() {
  menueOffen = true;
  menue.hidden = false;
  menueKnopf.setAttribute('aria-expanded', 'true');
  menueKnopf.setAttribute('aria-label', 'Menü schließen');
  lenis?.stop();
  menue.querySelector('a')?.focus();
}
function menueSchliessen(fokusZurueck = true) {
  if (!menueOffen) return;
  menueOffen = false;
  menue.hidden = true;
  menueKnopf.setAttribute('aria-expanded', 'false');
  menueKnopf.setAttribute('aria-label', 'Menü öffnen');
  lenis?.start();
  if (fokusZurueck) menueKnopf.focus();
}
menueKnopf?.addEventListener('click', () => (menueOffen ? menueSchliessen() : menueOeffnen()));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { menueSchliessen(); tageskarteSchliessen(); return; }
  if (e.key === 'Tab' && menueOffen) {
    const ziele = [menueKnopf, ...menue.querySelectorAll('a')];
    const i = ziele.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); ziele[ziele.length - 1].focus(); }
    else if (!e.shiftKey && i === ziele.length - 1) { e.preventDefault(); ziele[0].focus(); }
  }
});
addEventListener('resize', () => { if (innerWidth >= 768) menueSchliessen(false); });

/* ─── Tageskarte ─── */
const karte = document.querySelector('.karte');
const tageskarte = document.getElementById('tageskarte');
const tkKnopf = document.querySelector('[data-tageskarte]');
let tkOffen = false;
const tkFeder = feder({
  wert: 0, steif: 120, daempf: 26,
  bei: (v) => {
    if (innerWidth < 1024 || !tageskarte) return;
    tageskarte.style.opacity = String(Math.min(1, Math.max(0, v)));
    tageskarte.style.transform = `translate(${((1 - v) * 150).toFixed(1)}px, ${((1 - v) * 150).toFixed(1)}px)`;
  },
});
function tkSetzen(offen) {
  tkOffen = offen;
  karte.classList.toggle('zeigt-tageskarte', offen);
  tageskarte.setAttribute('aria-hidden', String(!offen));
  tkKnopf.setAttribute('aria-expanded', String(offen));
  const text = tkKnopf.querySelector('.cta-text') || tkKnopf;
  text.textContent = offen ? 'Tageskarte ausblenden' : 'Tageskarte zeigen';
  if (innerWidth >= 1024) {
    if (reduziert) tkFeder.setze(offen ? 1 : 0); else tkFeder.zu(offen ? 1 : 0);
  } else {
    tageskarte.style.opacity = '';
    tageskarte.style.transform = '';
  }
}
function tageskarteSchliessen() { if (tkOffen) tkSetzen(false); }
tkKnopf?.addEventListener('click', () => tkSetzen(!tkOffen));
addEventListener('resize', () => { if (innerWidth < 1024 && tageskarte) { tageskarte.style.opacity = ''; tageskarte.style.transform = ''; } else if (tkOffen) tkFeder.setze(1); });

/* ─── Karte am Handy: Die vier Kacheln liegen in einer Wischreihe, der Zähler zeigt die Stelle ─── */
const reihe = document.querySelector('.karte-reihe');
const wischNr = document.querySelector('.karte-wisch-nr');
const wischStand = document.querySelector('.karte-wisch-stand');
if (reihe && wischNr && wischStand) {
  let wartet = false;
  const zeigen = () => {
    wartet = false;
    const weg = reihe.scrollWidth - reihe.clientWidth;
    if (weg < 8) return;
    const p = Math.min(1, Math.max(0, reihe.scrollLeft / weg));
    const n = reihe.children.length;
    wischNr.textContent = String(Math.round(p * (n - 1)) + 1).padStart(2, '0');
    wischStand.style.transform = `scaleX(${(1 / n + p * (1 - 1 / n)).toFixed(3)})`;
  };
  reihe.addEventListener('scroll', () => { if (!wartet) { wartet = true; requestAnimationFrame(zeigen); } }, { passive: true });
  zeigen();
}

/* ─── Uhr: zeigt die echte Uhrzeit in Berlin ─── */
const zeiger = {
  stunde: document.querySelector('.zeiger-stunde'),
  minute: document.querySelector('.zeiger-minute'),
  sekunde: document.querySelector('.zeiger-sekunde'),
};
const uhrFormat = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
// Öffnungszeiten wie auf der Seite genannt: Mo–Fr 07–18, Sa–So 09–17 (Stunden, Ortszeit Berlin)
const OFFEN = { woche: [7, 18], ende: [9, 17] };
const TAGE = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 7 };
const jetztEl = document.querySelector('[data-haus-jetzt]');
let jetztText = '';
function offenStand(tag, h, m) {
  const [auf, zu] = tag >= 6 ? OFFEN.ende : OFFEN.woche;
  const zeit = h + m / 60;
  if (zeit >= auf && zeit < zu) return { offen: true, text: `Jetzt geöffnet · bis ${zu} Uhr` };
  const heuteNoch = zeit < auf;
  const naechster = heuteNoch ? tag : (tag % 7) + 1;
  const [dann] = naechster >= 6 ? OFFEN.ende : OFFEN.woche;
  return { offen: false, text: `Gerade geschlossen · ${heuteNoch ? 'heute' : 'morgen'} ab ${dann} Uhr` };
}
function uhrStellen() {
  const teile = Object.fromEntries(uhrFormat.formatToParts(new Date()).map((t) => [t.type, t.value]));
  const h = Number(teile.hour), m = Number(teile.minute), s = Number(teile.second);
  zeiger.stunde?.style.setProperty('transform', `rotate(${((h % 12) + m / 60) * 30}deg)`);
  zeiger.minute?.style.setProperty('transform', `rotate(${(m + s / 60) * 6}deg)`);
  zeiger.sekunde?.style.setProperty('transform', `rotate(${s * 6}deg)`);
  if (jetztEl) {
    const stand = offenStand(TAGE[teile.weekday.slice(0, 2)] || 1, h, m);
    const text = `${teile.hour}:${teile.minute}|${stand.text}`;
    if (text !== jetztText) {
      jetztText = text;
      jetztEl.dataset.offen = String(stand.offen);
      jetztEl.replaceChildren();
      const punkt = document.createElement('span');
      punkt.className = 'puls';
      punkt.setAttribute('aria-hidden', 'true');
      const zeit = document.createElement('span');
      zeit.className = 'haus-jetzt-zeit';
      zeit.textContent = `Berlin ${teile.hour}:${teile.minute} Uhr`;
      const lage = document.createElement('span');
      lage.className = 'haus-jetzt-lage';
      lage.textContent = stand.text;
      const kopfzeile = document.createElement('span');
      kopfzeile.className = 'haus-jetzt-kopf';
      kopfzeile.append(punkt, zeit);
      jetztEl.append(kopfzeile, lage);
    }
  }
}
if (zeiger.stunde) {
  uhrStellen();
  let uhrTakt = null;
  const haus = document.querySelector('.haus');
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !uhrTakt) { uhrStellen(); uhrTakt = setInterval(uhrStellen, reduziert ? 60000 : 1000); }
    else if (!e.isIntersecting && uhrTakt) { clearInterval(uhrTakt); uhrTakt = null; }
  }).observe(haus);
}

/* ─── Wirbel hinter den Tafeln ─── */
for (const w of document.querySelectorAll('.wirbel')) {
  const imFuss = w.classList.contains('wirbel-fuss');
  if (reduziert) continue;
  const bereich = w.parentElement;
  let halb = false;
  if (imFuss) {
    w.style.opacity = '0';
    w.style.transform = 'scale(1.05)';
  } else {
    w.style.setProperty('--fill', '0');
  }
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    wenn('enthuellt', () => federLauf(imFuss
      ? { steif: 40, daempf: 26, bei: (v) => { w.style.opacity = String(Math.min(1, Math.max(0, v))); w.style.transform = `scale(${1.05 - 0.05 * v})`; } }
      // Die Maske wird bei jeder Änderung neu gemalt (große Fläche): jedes zweite Bild genügt für die weiche Füllung.
      : { von: 0, bis: 100, steif: 40, daempf: 26, bei: (v) => { halb = !halb; if (halb || v > 99.4) w.style.setProperty('--fill', v.toFixed(1)); } }));
  }, { rootMargin: '0px 0px -15% 0px' }).observe(bereich);
  const parallax = w.querySelector('.wirbel-parallax');
  if (parallax) scrubAnmelden({ ziel: bereich, von: 'top_bottom', bis: 'bottom_top', bei: (p) => { parallax.style.transform = `translateY(${((p - 0.5) * -60).toFixed(1)}px)`; } });
}

/* ─── Opal-Licht im Start und in der Haltung ─── */
const opale = [...document.querySelectorAll('.opal-leinwand')];
opale.forEach((c, i) => {
  try {
    if (!opalStarten(c, reduziert)) return;
  } catch { return; }
  if (i === 0) wenn('enthuellt', () => c.classList.add('ist-sichtbar'));
  else new IntersectionObserver(([e], io) => { if (e.isIntersecting) { c.classList.add('ist-sichtbar'); io.disconnect(); } }, { rootMargin: '20% 0px' }).observe(c);
});

/* ─── Röstung: echter Film ─── */
roestenStarten({ reduziert, scrolleZu });

/* ─── Bestellen (Vorführung) ─── */
druckerStarten({ reduziert });

/* ─── Bohnenfeld: in einer ruhigen Sekunde nach dem Start vorbereiten, spätestens wenn der Abschnitt näher kommt ───
   Der Aufbau (Umgebungslicht, Shader) kostet einige Zehntelsekunden. Früher fiel er mitten ins Scrollen. */
const ruhe = document.querySelector('.ruhe');
if (ruhe) {
  if (!mit3d) ruhe.classList.add('ohne-szene');
  else {
    let begonnen = false;
    const bohnen = () => {
      if (begonnen) return;
      begonnen = true;
      import('./bohnen.js').then((m) => m.bohnenStarten({ reduziert })).catch((err) => {
        console.info('Haltung ohne 3D:', err && err.message);
        ruhe.classList.add('ohne-szene');
        meldung(DREI_D_FEHLT);
      });
    };
    new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); bohnen(); } }, { rootMargin: '150% 0px' }).observe(ruhe);
    const sparsam = !!(navigator.connection && navigator.connection.saveData);
    if (!sparsam) {
      heldBereit.then(() => wenn('bereit', () => setTimeout(() => {
        if ('requestIdleCallback' in window) requestIdleCallback(bohnen, { timeout: 2500 }); else bohnen();
      }, 2600)));
    }
  }
}
