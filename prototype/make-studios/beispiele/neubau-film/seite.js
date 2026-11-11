// Beispielseite Hellgrund · Projekt HALM. Bauträger, Projekt und Werte sind erfunden.
// Ablauf nach der KELD-Vorlage, eigener Code: Vorhang mit Zähler, Szene über 1400 Viewports mit Bildfolge
// (zwei Stufen: 1280 × 720 und 1920 × 1080), Glastafel, Details mit Zählern, Stern, Rundgang-Film in drei
// Einstellungen, Haltung zum Blättern, aufgedeckter Fuß, Glasmenü und Anfrage.
// Bei reduzierter Bewegung bleibt die ruhige Fassung aus dem CSS stehen; das Skript bedient dann Menü, Anfrage,
// Blättern und den Film (nur Standbild, Abspielen erst nach Klick).

import Lenis from '../vendor/lenis/lenis.mjs';
import { Feder, Verlauf, kurve, span, clamp01, imTakt } from './feder.js';
import { teileWort, teileZeilen, Aufdecken, Folgen, ZEIT, stoppeAlle } from './text.js';
import { Rundgang } from './rundgang.js';

const html = document.documentElement;
const $ = (sel, wurzel = document) => wurzel.querySelector(sel);
const $$ = (sel, wurzel = document) => Array.from(wurzel.querySelectorAll(sel));

html.classList.add('js');
const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
const netz = navigator.connection || null;
const langsam = !!(netz && /(^|-)[23]g$/.test(netz.effectiveType || ''));
const sparsam = !!(netz && netz.saveData) || !!(netz && /(^|-)2g$/.test(netz.effectiveType || ''));
const zahlFormat = new Intl.NumberFormat('de-DE');

/* ── Stil nur schreiben, wenn er sich ändert (immer über das CSSOM, nie als Attribut) ── */
const gemerkt = new WeakMap();
const beruehrt = new Set();
function stil(el, eigenschaft, wert) {
  let m = gemerkt.get(el);
  if (!m) { m = new Map(); gemerkt.set(el, m); }
  if (m.get(eigenschaft) === wert) return;
  m.set(eigenschaft, wert);
  beruehrt.add(el);
  if (wert === '') el.style.removeProperty(eigenschaft);
  else el.style.setProperty(eigenschaft, wert);
}

/* ── Ruhiger Hinweis, wenn Wichtiges nicht lädt ── */
const meldung = $('.meldung');
let meldungUhr = 0;
function melde(text) {
  if (!meldung.hidden && meldung.textContent === text) return;
  meldung.textContent = text;
  meldung.hidden = false;
  clearTimeout(meldungUhr);
  meldungUhr = setTimeout(() => { meldung.hidden = true; }, 9000);
}

let lenis = null;
let aus = false;
let ankerZiel = null;

/* ── Glasmenü oben rechts ── */
const dock = $('.dock');
const dockKnopf = $('.dock-knopf');
function menueOffen(an) {
  dock.classList.toggle('offen', an);
  dockKnopf.setAttribute('aria-expanded', String(an));
  dockKnopf.setAttribute('aria-label', an ? 'Menü schließen' : 'Menü öffnen');
}
function dockWeg(weg) {
  if (dock.classList.contains('weg') === weg) return;
  if (weg) menueOffen(false);
  dock.classList.toggle('weg', weg);
  dock.inert = weg;
}
dockKnopf.addEventListener('click', () => menueOffen(!dock.classList.contains('offen')));
$('#dock-menue').addEventListener('click', (e) => { if (e.target.closest('a')) menueOffen(false); });
document.addEventListener('pointerdown', (e) => {
  if (dock.classList.contains('offen') && !dock.contains(e.target)) menueOffen(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dock.classList.contains('offen')) { menueOffen(false); dockKnopf.focus(); }
});

/* ── Anfrage: ein Fenster, das prüft und nichts sendet ── */
const anfrage = $('.anfrage');
const anfrageForm = $('.anfrage-form');
const anfrageHinweis = $('.anfrage-hinweis');
const feldName = $('#f-name');
const feldMail = $('#f-email');
function feldFehler(feld, text) {
  const zeile = $(`#${feld.id}-fehler`);
  if (text) feld.setAttribute('aria-invalid', 'true');
  else feld.removeAttribute('aria-invalid');
  zeile.textContent = text;
  zeile.hidden = !text;
}
let anfrageZurueck = null;
function oeffneAnfrage(anliegen, ausloeser) {
  // Nach dem Schließen kehrt der Fokus zum Auslöser zurück (aus dem Menü: zum Menüknopf, das Menü ist dann zu).
  anfrageZurueck = ausloeser && ausloeser.closest('#dock-menue') ? dockKnopf : ausloeser || null;
  const wahl = anfrageForm.elements.namedItem('anliegen');
  if (anliegen && wahl) wahl.value = anliegen;
  anfrageHinweis.textContent = '';
  feldFehler(feldName, '');
  feldFehler(feldMail, '');
  if (!anfrage.open) anfrage.showModal();
  if (lenis) lenis.stop();
}
anfrage.addEventListener('close', () => {
  if (lenis) lenis.start();
  if (anfrageZurueck && anfrageZurueck.isConnected) anfrageZurueck.focus({ preventScroll: true });
  anfrageZurueck = null;
});
anfrage.addEventListener('click', (e) => { if (e.target === anfrage) anfrage.close(); });
$('.anfrage-zu').addEventListener('click', () => anfrage.close());
for (const feld of [feldName, feldMail]) {
  feld.addEventListener('input', () => { if (feld.hasAttribute('aria-invalid')) feldFehler(feld, ''); });
}
anfrageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = feldName.value.trim();
  const mail = feldMail.value.trim();
  const fName = name ? '' : 'Bitte nennen Sie Ihren Namen.';
  let fMail = '';
  if (!mail) fMail = 'Bitte geben Sie Ihre E-Mail-Adresse an.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) fMail = 'Bitte prüfen Sie die E-Mail-Adresse. Es fehlt zum Beispiel das @ oder die Endung.';
  feldFehler(feldName, fName);
  feldFehler(feldMail, fMail);
  if (fName || fMail) {
    anfrageHinweis.textContent = 'Bitte ergänzen Sie die markierten Felder.';
    (fName ? feldName : feldMail).focus();
    return;
  }
  anfrageHinweis.textContent = 'Dies ist eine Beispielseite. Ihre Angaben werden nicht gesendet.';
});

/* ── Sprungmarken: Anfrage öffnet das Fenster, in der bewegten Fassung führt Lenis an den richtigen Moment ── */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  if (a.hasAttribute('data-anfrage')) {
    e.preventDefault();
    menueOffen(false);
    oeffneAnfrage(a.getAttribute('data-anfrage'), a);
    return;
  }
  if (!lenis || !ankerZiel) return;
  const ziel = ankerZiel(a.getAttribute('href'));
  if (ziel == null) return;
  e.preventDefault();
  lenis.scrollTo(ziel, { duration: 1.6 });
});

/* ── Rundgang-Film: drei Einstellungen. Von selbst läuft er nur mit Bewegung und ohne Datensparmodus. ── */
const rolle = $('.rolle');
const zeiger = $('.marke-zeiger');
const zeigerText = $('span', zeiger);
const rundgang = new Rundgang({
  filme: $$('.rolle-film'),
  stationen: $$('.station'),
  knopf: $('.film-knopf'),
  knopfText: $('.film-knopf-text'),
  vonSelbst: !ruhig && !sparsam,
  melde,
  beiWechsel: ({ angehalten }) => { zeigerText.textContent = angehalten ? 'Abspielen' : 'Pause'; },
});
// Ein Klick auf den Film hält ihn an oder lässt ihn weiterlaufen (wie der Knopf).
rolle.addEventListener('click', () => rundgang.umschalten());

/* ── Haltung: drei Sätze zum Blättern ── */
const saetze = $$('.aussage-satz');
const satzZaehler = $('.blaettern p');
const [satzZurueck, satzWeiter] = $$('.blaettern button');
const zwei = (n) => String(n).padStart(2, '0');
let satz = 0;
let beimSatzwechsel = null;
function zeigeSatz(n) {
  n = (n + saetze.length) % saetze.length;
  if (n === satz) return;
  const alt = satz;
  satz = n;
  saetze.forEach((s, i) => s.classList.toggle('an', i === n));
  satzZaehler.textContent = `${zwei(n + 1)} / ${zwei(saetze.length)}`;
  if (beimSatzwechsel) beimSatzwechsel(alt, n);
}
satzZurueck.addEventListener('click', () => zeigeSatz(satz - 1));
satzWeiter.addEventListener('click', () => zeigeSatz(satz + 1));

if (ruhig) ruhigeFassung();
else {
  try { bewegteFassung(); } catch (fehler) { console.error(fehler); notaus(); }
}

/* ════════════ Ruhige Fassung ════════════ */
function ruhigeFassung() {
  const wache = $('.dock-wache');
  let geplant = false;
  const pruefe = () => { geplant = false; dockWeg(wache.getBoundingClientRect().top < innerHeight); };
  addEventListener('scroll', () => { if (!geplant) { geplant = true; requestAnimationFrame(pruefe); } }, { passive: true });
  addEventListener('resize', pruefe);
  pruefe();
  filmOhneSzene();
}

/* Film außerhalb der Scroll-Szene: nur Standbild, bis jemand „Film abspielen“ wählt; außerhalb des Bilds steht er.
   Der Takt läuft nur, solange der Film wirklich spielt (Laufbalken und Überblenden). */
function filmOhneSzene() {
  let laeuft = false;
  const schritt = () => {
    rundgang.schritt();
    if (rundgang.imBild && !rundgang.angehalten && !rundgang.gestoppt) requestAnimationFrame(schritt);
    else laeuft = false;
  };
  const wecke = () => { if (!laeuft) { laeuft = true; requestAnimationFrame(schritt); } };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((eintraege) => {
      for (const e of eintraege) rundgang.sichtbar(e.isIntersecting);
      wecke();
    }, { threshold: 0.2 }).observe(rolle);
  } else rundgang.sichtbar(true);
  for (const el of [rolle, $('.film-knopf'), ...$$('.station')]) el.addEventListener('click', wecke);
}

/* Bricht die Bewegung ab und lässt die ruhige Fassung stehen. */
function notaus() {
  aus = true;
  try { if (lenis) lenis.destroy(); } catch (fehler) { /* nichts mehr zu tun */ }
  lenis = null;
  ankerZiel = null;
  beimSatzwechsel = null;
  stoppeAlle();
  html.classList.remove('bewegt', 'vorhang-js', 'vorhang-geht');
  html.classList.add('vorhang-weg');
  for (const el of beruehrt) el.removeAttribute('style');
  $$('.bu, .wm-bu').forEach((el) => el.removeAttribute('style'));
  $$('.trommel').forEach((el) => { el.textContent = zahlFormat.format(Number(el.dataset.wert)); });
  rundgang.stopp();
}

/* ════════════ Bewegte Fassung ════════════ */
function bewegteFassung() {
  html.classList.add('bewegt', 'vorhang-js');
  const start = performance.now();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const N = 105;
  const KAPPE = 2300;
  // Anteile der Scrollstrecke der Szene. Zwischen „echo“ und „details“ sowie nach „zoom“ steht das Bild kurz still.
  const PH = {
    seq: [0, 0.4],
    h1aus: [0.08, 0.13], h2an: [0.13, 0.18], h2aus: [0.21, 0.26], h3an: [0.26, 0.31],
    echo: [0.4, 0.5], halm: [0.415, 0.485], details: [0.53, 0.66], stern: [0.66, 0.735],
    rev: [0.712, 0.77], zoom: [0.77, 0.92],
  };

  lenis = new Lenis({ smoothWheel: true, anchors: false, autoRaf: false });
  lenis.stop();
  imTakt((jetzt) => { if (lenis) lenis.raf(jetzt); });

  /* ── Bildfolge: große Stufe nur für breite Fenster mit guter Verbindung, sonst die kleine.
        Geladen wird vom Groben ins Feine (jedes 8., 4., 2. Bild, dann der Rest): So ist die ganze Fahrt früh
        befahrbar, fehlende Bilder ersetzt der nächste geladene Nachbar. ── */
  const gross = innerWidth >= 1000 && !sparsam && !langsam;
  const stufe = gross ? { ordner: 'medien/folge-gross', b: 1920, h: 1080 } : { ordner: 'medien/folge', b: 1280, h: 720 };
  const reihenfolge = [];
  {
    const drin = new Set();
    for (const weite of [8, 4, 2, 1]) {
      for (let i = 0; i < N; i += weite) if (!drin.has(i)) { drin.add(i); reihenfolge.push(i); }
    }
  }
  const ERST = reihenfolge.filter((i) => i % 4 === 0).length;
  const bilder = new Array(N).fill(null);
  let erstDa = 0, fehler = 0, naechstes = 0, nullFehlt = false;
  let sollBild = 0, gezeichnet = -1, leinwandDirty = true, canvasAn = true;
  const ladeBild = (i) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = `${stufe.ordner}/${String(i).padStart(3, '0')}.webp`;
    const fertig = () => { if (i % 4 === 0) erstDa++; };
    return img.decode().then(
      () => { bilder[i] = img; leinwandDirty = true; fertig(); nahePflegen(); },
      () => {
        fehler++;
        fertig();
        if (i === 0) nullFehlt = true;
        if (i === 0 || fehler === 10) melde('Der Film konnte nicht vollständig geladen werden. Die Seite funktioniert trotzdem.');
      },
    );
  };
  // Die feinste Runde (jedes zweite Bild, die halbe Datenmenge) wartet, bis der Einstieg steht oder jemand loslegt.
  const GROB = reihenfolge.filter((i) => i % 2 === 0).length;
  let feinFrei = false, feinLos = null;
  const feinTor = new Promise((ok) => { feinLos = ok; });
  const feinOeffnen = () => { if (!feinFrei) { feinFrei = true; feinLos(); } };
  for (const art of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(art, feinOeffnen, { once: true, passive: true });
  const arbeiter = async () => {
    while (naechstes < N) {
      if (naechstes >= GROB && !feinFrei) { await feinTor; continue; }
      const i = reihenfolge[naechstes++];
      await ladeBild(i);
    }
  };
  for (let k = 0; k < 6; k++) arbeiter();

  const leinwandEl = $('.film-leinwand');
  leinwandEl.width = stufe.b;
  leinwandEl.height = stufe.h;
  const ctx = leinwandEl.getContext('2d', { alpha: false });

  /* Die Bilder rund um die aktuelle Stelle liegen fertig entpackt bereit (ImageBitmap), damit beim Zeichnen
     nichts mehr entpackt werden muss. Das Fenster wandert mit; was weit weg ist, wird wieder freigegeben. */
  const NAH = 8, HALTEN = 13, ZUGLEICH = 3;
  const bereit = new Map();
  const unterwegs = new Set();
  const kannBitmap = typeof createImageBitmap === 'function';
  function nahePflegen() {
    if (!kannBitmap) return;
    for (const [i, bm] of bereit) {
      if (!canvasAn || Math.abs(i - sollBild) > HALTEN) { bm.close(); bereit.delete(i); }
    }
    if (!canvasAn) return;
    for (let d = 0; d <= NAH && unterwegs.size < ZUGLEICH; d++) {
      for (const i of d ? [sollBild + d, sollBild - d] : [sollBild]) {
        if (i < 0 || i >= N || !bilder[i] || bereit.has(i) || unterwegs.has(i) || unterwegs.size >= ZUGLEICH) continue;
        unterwegs.add(i);
        createImageBitmap(bilder[i]).then((bm) => {
          unterwegs.delete(i);
          if (!canvasAn || Math.abs(i - sollBild) > HALTEN) bm.close();
          else bereit.set(i, bm);
          nahePflegen();
        }, () => { unterwegs.delete(i); });
      }
    }
  }
  function leinwand() {
    if (!canvasAn || document.hidden || !ctx) return;
    leinwandDirty = false;
    let i = -1;
    for (let d = 0; d < N && i < 0; d++) {
      if (sollBild - d >= 0 && bilder[sollBild - d]) i = sollBild - d;
      else if (sollBild + d < N && bilder[sollBild + d]) i = sollBild + d;
    }
    if (i < 0 || i === gezeichnet) return;
    ctx.drawImage(bereit.get(i) || bilder[i], 0, 0, stufe.b, stufe.h);
    gezeichnet = i;
  }
  document.addEventListener('visibilitychange', () => { leinwandDirty = true; });

  /* ── Buchstaben ── */
  const helden1 = $$('.block-1 .wort').map((w, n) => {
    const bu = teileWort(w);
    return new Aufdecken(bu, 'gleiten', { versatz: 750 / bu.length, dauer: 750, kurveFn: kurve.outQuart, verzug: n * 140 });
  });
  const folgen2 = new Folgen($$('.block-2 .wort').flatMap((w) => teileWort(w)), 'gleiten');
  const folgen3 = new Folgen($$('.block-3 .wort').flatMap((w) => teileWort(w)), 'gleiten');
  const halm = new Folgen(teileWort($('.halm-wort')), 'gleiten');
  const etikettOben = new Aufdecken(teileZeilen($('.tafel > .etikett')), 'steigen', ZEIT.label);
  const etikettUnten = new Aufdecken(teileZeilen($('.fuss-etikett')), 'steigen', ZEIT.label);
  const rundgangTitel = new Aufdecken(teileZeilen($('.rundgang')), 'steigen', ZEIT.label);
  const aussagenEl = $('.aussagen');
  const aussagen = saetze.map((s) => new Aufdecken(teileZeilen($('.aussage', s)), 'steigen', ZEIT.quote));
  const ctaEl = $('.fuss-frage');
  const cta = new Aufdecken(teileZeilen(ctaEl), 'steigen', ZEIT.cta);
  const wmBu = teileWort($('.wm-wort'), 'wm-bu');

  let ctaIo = false, aussageIo = false;
  const io = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (e.target === aussagenEl) { aussageIo = e.isIntersecting; aussagen[satz].setze(aussageIo); }
      else if (e.target === ctaEl) ctaIo = e.isIntersecting;
    }
  }, { rootMargin: '0px 0px -15% 0px' });
  io.observe(aussagenEl);
  io.observe(ctaEl);
  // Blättern: der alte Satz blendet aus (CSS), der neue deckt sich Buchstabe für Buchstabe auf.
  beimSatzwechsel = (alt, neu) => {
    setTimeout(() => { if (satz !== alt) aussagen[alt].setze(false); }, 380);
    aussagen[neu].setze(false);
    if (aussageIo) aussagen[neu].setze(true);
  };

  /* ── Teile der Bühne ── */
  const szene = $('.szene');
  const buehne = $('.buehne');
  const film = $('.film');
  const raster = $('.buehne > .raster');
  const bloecke = [1, 2, 3].map((n) => {
    const b = $(`.block-${n}`);
    return { b, aus: $('.block-aus', b), text: $('.block-text', b) };
  });
  const projekt = $('.projekt');
  const projektBild = $('.projekt-bild');
  const details = $('.details-ebene');
  const detailsBild = $('.details-bild');
  const stern = $('.stern');
  const sternTon = $('.stern-ton');
  const filmTeil = $('.film-teil');
  const fuss = $('.fuss');
  const fussBild = $('.fuss-bild');
  const fussPlatz = $('.fuss-platz');
  const wache = $('.dock-wache');

  /* ── Maße ── */
  const mqBreit = matchMedia('(min-width: 768px)');
  const mqFein = matchMedia('(pointer: fine)');
  let spurOben = 0, weg = 1, szeneEnde = 1, platzOben = 0, platzHoehe = 0, wacheOben = 0;
  let breit = mqBreit.matches, feinerZeiger = false, erzwingen = true, zoomEnde = 1.8;
  const absolutOben = (el) => el.getBoundingClientRect().top + window.scrollY;
  function messen() {
    spurOben = absolutOben(szene);
    weg = Math.max(1, szene.offsetHeight - buehne.offsetHeight);
    szeneEnde = spurOben + szene.offsetHeight;
    platzOben = absolutOben(fussPlatz);
    platzHoehe = Math.max(1, document.documentElement.scrollHeight - platzOben);
    wacheOben = absolutOben(wache);
    breit = mqBreit.matches;
    feinerZeiger = mqFein.matches && innerWidth > 768;
    // Am Ende füllt der Film die Bühne ganz (breite Fenster) oder die volle Breite (Handy, der Titel bleibt darüber frei).
    const rb = Math.max(1, rolle.offsetWidth), rh = Math.max(1, rolle.offsetHeight);
    zoomEnde = breit
      ? Math.max(buehne.offsetWidth / rb, buehne.offsetHeight / rh) * 1.03
      : buehne.offsetWidth / rb;
    if (!breit) {
      wmBu.forEach((el) => stil(el, 'transform', ''));
      stil(fussBild, 'transform', '');
    }
    erzwingen = true;
  }
  messen();
  addEventListener('resize', messen);
  addEventListener('load', messen);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(messen);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => messen());
    ro.observe($('.seite'));
    ro.observe(buehne);
  }

  ankerZiel = (hash) => {
    if (hash === '#oben') return 0;
    if (hash === '#projekt') return spurOben + 0.515 * weg;
    if (hash === '#details') return spurOben + 0.66 * weg;
    if (hash === '#rundgang') return spurOben + 0.95 * weg;
    if (hash === '#haltung') return $('#haltung');
    return null;
  };

  /* ── Vorhang mit rollendem Zähler ── */
  const vorhang = $('.vorhang');
  const vh = {
    spalten: $$('.vh-spalten i', vorhang),
    marke: $('.vh-marke', vorhang),
    linie: $('.vh-linie', vorhang),
    fuell: $('.vh-fuell', vorhang),
    laeufer: $('.vh-laeufer', vorhang),
  };
  const STELLEN = [
    ['0', '1'],
    [...'0123456789', '0'],
    Array.from({ length: 101 }, (_, n) => String(n % 10)),
  ];
  const zaehlTeile = [];
  const rollen = STELLEN.map((zellen) => {
    const spalte = document.createElement('span');
    spalte.className = 'vh-spalte';
    const walze = document.createElement('span');
    walze.className = 'vh-rolle';
    for (const z of zellen) {
      const c = document.createElement('span');
      c.textContent = z;
      walze.append(c);
    }
    spalte.append(walze);
    vh.laeufer.append(spalte);
    zaehlTeile.push(spalte);
    return walze;
  });
  const prozent = document.createElement('span');
  prozent.className = 'vh-prozent';
  prozent.textContent = '%';
  vh.laeufer.append(prozent);
  zaehlTeile.push(prozent);

  function zeichneZahl(z) {
    stil(vh.laeufer, 'left', `${z.toFixed(3)}%`);
    stil(vh.laeufer, 'transform', `translateX(${(-z).toFixed(3)}%)`);
    stil(vh.fuell, 'transform', `scaleX(${(z / 100).toFixed(4)})`);
    const zehner = Math.floor(Math.min(z, 100) / 10);
    const lagen = [clamp01(z - 99), Math.min(10, zehner + clamp01(z - zehner * 10 - 9)), z];
    rollen.forEach((r, i) => stil(r, 'transform', `translateY(${(-lagen[i] * 0.9).toFixed(4)}em)`));
  }

  // Der Vorhang wartet nur auf das erste, grobe Viertel der Bildfolge und höchstens bis zur Kappe.
  const uhr = new Verlauf(0);
  uhr.starte(1, 1500, kurve.outQuart, start);
  const intro = new Verlauf(0);
  let phase = 'zaehlt', tGehen = 0, zahl = 0, lenisFrei = false, introFrei = false;
  const ausgaenge = [];
  function gehen(jetzt) {
    phase = 'geht';
    tGehen = jetzt;
    html.classList.add('vorhang-geht');
    if (nullFehlt || !bilder[0]) melde('Der Film lädt noch. Sie können schon weiterlesen.');
    zahl = 100;
    zeichneZahl(100);
    const neu = (el, dauer, kurveFn, verzug, zeichner) => {
      const v = new Verlauf(0);
      v.starte(1, dauer, kurveFn, jetzt, verzug);
      ausgaenge.push({ el, v, zeichner });
    };
    neu(vh.marke, 700, kurve.inOutQuart, 0, (el, e) => {
      stil(el, 'opacity', (1 - e).toFixed(4));
      stil(el, 'transform', `translate3d(0, ${(-40 * e).toFixed(2)}px, 0)`);
    });
    neu(vh.linie, 700, kurve.inOutQuint, 0, (el, e) => stil(el, 'transform', `scaleX(${(1 - e).toFixed(4)})`));
    zaehlTeile.forEach((el, i) => neu(el, 700, kurve.inOutQuart, (zaehlTeile.length - 1 - i) * 45, (t, e) => {
      stil(t, 'opacity', (1 - e).toFixed(4));
      stil(t, 'transform', `translate3d(${(-40 * e).toFixed(2)}px, 0, 0)`);
    }));
    vh.spalten.forEach((el, i) => neu(el, 900, kurve.inOutQuart, 150 + i * 90, (t, e) => stil(t, 'transform', `scaleY(${(1 - e).toFixed(4)})`)));
  }
  function vorhangSchritt(jetzt) {
    if (phase === 'zaehlt') {
      uhr.schritt(jetzt);
      const anteil = Math.min(1, erstDa / ERST);
      zahl = Math.max(zahl, Math.min(uhr.wert, anteil) * 100);
      zeichneZahl(zahl);
      if (zahl >= 99.99 || jetzt - start >= KAPPE) gehen(jetzt);
    } else if (phase === 'geht') {
      for (const a of ausgaenge) if (a.v.schritt(jetzt)) a.zeichner(a.el, a.v.wert);
      const seit = jetzt - tGehen;
      if (!lenisFrei && seit >= 650) { lenisFrei = true; if (lenis && !anfrage.open) lenis.start(); }
      if (!introFrei && seit >= 700) {
        introFrei = true;
        intro.starte(1, 800, kurve.inQuad, jetzt);
        helden1.forEach((a) => a.setze(true));
      }
      if (seit >= 1350) { phase = 'weg'; html.classList.add('vorhang-weg'); setTimeout(feinOeffnen, 1200); }
    }
  }

  /* ── Zähler der Details ── */
  const trommeln = $$('.trommel').map((el) => ({ el, wert: Number(el.dataset.wert), v: new Verlauf(0), an: false, text: '' }));
  function zeichneTrommel(t) {
    const n = t.v.wert;
    const text = zahlFormat.format(Math.floor(n));
    if (text !== t.text) { t.text = text; t.el.textContent = text; }
    const rest = 1 - n / t.wert;
    if (rest <= 0.0005) { stil(t.el, 'filter', ''); stil(t.el, 'transform', ''); return; }
    stil(t.el, 'filter', `blur(${(rest * 0.5).toFixed(3)}rem)`);
    stil(t.el, 'transform', `translate3d(0, ${(rest * 1.25).toFixed(3)}rem, 0)`);
  }
  trommeln.forEach(zeichneTrommel);
  function trommelSchritt(jetzt, an) {
    for (const t of trommeln) {
      if (an !== t.an) {
        t.an = an;
        if (an) t.v.starte(t.wert, 2200, kurve.outQuint, jetzt);
        else { t.v.sofort(0); zeichneTrommel(t); }
      }
      if (t.v.schritt(jetzt)) zeichneTrommel(t);
    }
  }

  /* ── Film: lädt kurz vor seinem Auftritt und spielt nur, solange er im Bild ist ── */
  let vorbereitet = false;
  function filmSchritt(p, y) {
    if (!vorbereitet && p >= 0.6) { vorbereitet = true; rundgang.vorbereiten(); }
    rundgang.sichtbar(p >= PH.rev[0] && y < szeneEnde);
    if (rundgang.imBild) rundgang.schritt();
  }

  /* ── Marke folgt dem Zeiger über dem Film ── */
  const zx = new Feder(0, { spannung: 300, reibung: 40, genau: 0.1 });
  const zy = new Feder(0, { spannung: 300, reibung: 40, genau: 0.1 });
  const zo = new Feder(0, { spannung: 300, reibung: 40, genau: 0.002 });
  const zs = new Feder(0.6, { spannung: 300, reibung: 40, genau: 0.002 });
  let mx = 0, my = 0, ueberRolle = false, zeigerDa = false;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; } }, { passive: true });
  rolle.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') ueberRolle = true; });
  rolle.addEventListener('pointerleave', () => { ueberRolle = false; });
  function zeigerSchritt(dt, p) {
    const an = feinerZeiger && ueberRolle && p >= 0.74;
    if (an && !zeigerDa) { zx.sofort(mx); zy.sofort(my); zeigerDa = true; }
    if (!an && zo.ruht && zo.wert === 0) zeigerDa = false;
    zx.setze(mx); zy.setze(my); zo.setze(an ? 1 : 0); zs.setze(an ? 1 : 0.6);
    const a = zx.schritt(dt), b = zy.schritt(dt), c = zo.schritt(dt), d = zs.schritt(dt);
    if (a || b || c || d) {
      stil(zeiger, 'transform', `translate3d(${zx.wert.toFixed(1)}px, ${zy.wert.toFixed(1)}px, 0) scale(${zs.wert.toFixed(3)})`);
      stil(zeiger, 'opacity', clamp01(zo.wert).toFixed(3));
    }
  }

  /* ── Fuß: hinter der Seite festgehalten, beim Scrollen aufgedeckt ── */
  const ff = new Feder(0, { spannung: 140, reibung: 30, genau: 0.0005 });
  let fussOffen = false, tastatur = false;
  addEventListener('keydown', (e) => { if (e.key === 'Tab' && !tastatur) { tastatur = true; erzwingen = true; } });
  fuss.addEventListener('focusin', () => {
    if (breit && lenis && ff.wert < 0.99) lenis.scrollTo(lenis.limit, { duration: 1.2 });
  });
  function fussSchritt(y, dt) {
    if (!breit) { cta.setze(ctaIo); return; }
    const roh = platzHoehe > 0 ? clamp01((innerHeight - (platzOben - y)) / platzHoehe) : 0;
    ff.setze(roh);
    const lief = ff.schritt(dt);
    if (!lief && !erzwingen) return;
    const f = ff.wert;
    const offen = f > 0.001 || tastatur;
    if (offen !== fussOffen) { fussOffen = offen; fuss.classList.toggle('offen', offen); }
    cta.setze(f >= 0.2);
    wmBu.forEach((el, i) => {
      const gerade = (i + 1) % 2 === 0;
      const [a, b, hub] = gerade ? [i * 0.02, 0.48 + i * 0.02, 5.625] : [0.12, 0.72, 8.75];
      const t = kurve.outSine(span(f, [a, b]));
      stil(el, 'transform', t >= 1 ? '' : `translate3d(0, ${((1 - t) * hub).toFixed(3)}rem, 0)`);
    });
    stil(fussBild, 'transform', f >= 1 ? '' : `scale(${(1.08 - 0.08 * f).toFixed(4)})`);
  }

  /* ── Szene ── */
  function ausgang(el, e) {
    if (e <= 0) { stil(el, 'opacity', ''); stil(el, 'transform', ''); stil(el, 'filter', ''); return; }
    stil(el, 'opacity', (1 - e).toFixed(4));
    stil(el, 'transform', `translate3d(0, ${(-2.5 * e).toFixed(3)}rem, 0)`);
    stil(el, 'filter', `blur(${(0.75 * e).toFixed(3)}rem)`);
  }
  let filmTeilSichtbar = false;
  function szeneZeichnen(p, roh) {
    const a = intro.wert;
    const fs = span(p, PH.seq);
    const soll = Math.min(N - 1, Math.floor(fs * N));
    const canvas = p < PH.echo[1];
    if (soll !== sollBild || canvas !== canvasAn) {
      sollBild = soll;
      canvasAn = canvas;
      leinwandDirty = true;
      nahePflegen();
    }

    const echo = span(p, PH.echo);
    stil(film, 'opacity', (1 - echo).toFixed(4));
    stil(film, 'visibility', canvas ? 'visible' : 'hidden');
    const gitter = a * (1 - fs);
    stil(raster, 'opacity', gitter.toFixed(4));
    stil(raster, 'visibility', gitter > 0 ? 'visible' : 'hidden');

    // Erste Aussage: einmal aufgedeckt, beim Weiterscrollen nach oben weg.
    ausgang(bloecke[0].aus, kurve.inOutSine(span(p, PH.h1aus)));
    stil(bloecke[0].text, 'opacity', (a * (1 - span(p, PH.h1aus))).toFixed(4));
    stil(bloecke[0].b, 'visibility', p < 0.13 ? 'visible' : 'hidden');

    // Zweite Aussage: Buchstaben folgen dem Scrollen.
    folgen2.setze(span(roh, PH.h2an));
    ausgang(bloecke[1].aus, kurve.inOutSine(span(p, PH.h2aus)));
    stil(bloecke[1].text, 'opacity', (span(p, PH.h2an) * (1 - span(p, PH.h2aus))).toFixed(4));
    stil(bloecke[1].b, 'visibility', Math.max(p, roh) >= 0.12 && p < 0.26 ? 'visible' : 'hidden');

    // Dritte Aussage: bleibt, bis der Innenraum kommt.
    folgen3.setze(span(roh, PH.h3an));
    stil(bloecke[2].aus, 'opacity', (1 - echo).toFixed(4));
    stil(bloecke[2].text, 'opacity', (span(p, PH.h3an) * (1 - echo)).toFixed(4));
    stil(bloecke[2].b, 'visibility', Math.max(p, roh) >= 0.25 && echo < 1 ? 'visible' : 'hidden');

    // Projekt HALM: Innenraum fährt von unten ein, die Glastafel liegt darüber; danach steht es kurz still.
    stil(projekt, 'transform', `translate3d(0, ${((1 - echo) * 100).toFixed(3)}%, 0)`);
    stil(projektBild, 'transform', `scale(${(1.1 - 0.1 * echo).toFixed(4)})`);
    stil(projekt, 'visibility', p > 0.39 && p < 0.67 ? 'visible' : 'hidden');
    etikettOben.setze(p >= PH.echo[0]);
    halm.setze(span(roh, PH.halm));
    etikettUnten.setze(echo >= 0.85);

    // Details: von unten aufgedeckt.
    const det = span(p, PH.details);
    stil(details, 'clip-path', `inset(${((1 - det) * 100).toFixed(3)}% 0 0 0)`);
    stil(details, 'visibility', p > PH.details[0] ? 'visible' : 'hidden');
    stil(detailsBild, 'transform', `scale(${(1.1 - 0.1 * det).toFixed(4)})`);

    // Stern: wächst, bis er die Fläche füllt.
    const s = span(p, PH.stern);
    stil(stern, 'transform', `scale(${(0.04 + Math.pow(s, 5) * 16).toFixed(4)})`);
    stil(sternTon, 'opacity', s.toFixed(4));

    // Film: steigt gedämpft auf, wächst bis über die ganze Bühne und wird dabei hell und farbig.
    // Der Titel weicht zur Seite und tritt zurück; Einstellungen und Knöpfe bleiben auf Glas stehen.
    const rev = span(p, PH.rev);
    const zoom = kurve.inOutSine(span(p, PH.zoom));
    stil(rolle, 'clip-path', rev >= 1 ? 'none' : `inset(${((1 - rev) * 100).toFixed(3)}% 0 0 0)`);
    stil(rolle, 'transform', `translate(-50%, calc(-50% + ${((1 - rev) * 10).toFixed(3)}%)) scale(${(1 + zoom * (zoomEnde - 1)).toFixed(4)})`);
    stil(rolle, 'visibility', rev > 0 ? 'visible' : 'hidden');
    const licht = span(zoom, [0.3, 0.85]);
    stil(rolle, 'filter', licht >= 1 ? '' : `saturate(${(0.12 + 0.88 * licht).toFixed(3)}) brightness(${(0.56 + 0.44 * licht).toFixed(3)})`);
    const sichtbar = rev > 0;
    if (sichtbar !== filmTeilSichtbar) { filmTeilSichtbar = sichtbar; filmTeil.classList.toggle('sichtbar', sichtbar); }
    stil(filmTeil, '--ueber-o', rev.toFixed(4));
    stil(filmTeil, '--titel-o', (rev * (1 - span(zoom, [0.22, 0.6]))).toFixed(4));
    stil(filmTeil, '--ueber-x', `${((1 - zoom) * 7.5).toFixed(3)}rem`);
    rundgangTitel.setze(rev > 0.4);
  }

  /* ── Ein Takt für alles ── */
  const pf = new Feder(0, { spannung: 90, reibung: 26, genau: 0.0002 });
  let zielRoh = -1;
  // Die zwei Innenraumfotos liegen bis zu ihrem Auftritt außerhalb des Bilds. Sie werden geholt, sobald jemand
  // losscrollt, damit sie beim Einfahren schon da sind.
  let innenGeholt = false;
  const innenBilder = $$('.projekt-bild img, .details-bild img');
  function haupt(jetzt, dt) {
    vorhangSchritt(jetzt);
    const y = window.scrollY;
    const roh = clamp01((y - spurOben) / weg);
    if (roh !== zielRoh) { zielRoh = roh; pf.setze(roh); }
    const lief = pf.schritt(dt);
    const introLief = intro.schritt(jetzt);
    const p = pf.wert;
    if (!innenGeholt && roh >= 0.1) { innenGeholt = true; innenBilder.forEach((bild) => { bild.loading = 'eager'; }); }
    if (lief || introLief || erzwingen) szeneZeichnen(p, roh);
    if (leinwandDirty) leinwand();
    trommelSchritt(jetzt, p >= PH.details[0]);
    filmSchritt(p, y);
    fussSchritt(y, dt);
    dockWeg(wacheOben - y < innerHeight);
    zeigerSchritt(dt, p);
    erzwingen = false;
  }
  imTakt((jetzt, dt) => {
    if (aus) return;
    try { haupt(jetzt, dt); } catch (fehler) { console.error(fehler); notaus(); }
  });
}
