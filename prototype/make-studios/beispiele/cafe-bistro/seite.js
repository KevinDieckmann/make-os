// Kerbel · Frühstück & Bistro. Beispielseite von MAKE Studios.
// Kein Versand, keine Tracker, keine fremden Dienste. Alles hier läuft nur im Browser.
import { filmEinrichten } from './film.js';

const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const html = document.documentElement;
const klemmen = (x, a, b) => Math.min(b, Math.max(a, x));
html.classList.add('mit-js');

/* ─── 1. Datum im Zeitungskopf, Gericht des Tages, heute geöffnet ─── */
const GERICHT_JE_TAG = [ // Sonntag zuerst, wie Date.getDay()
  ['Das große Brett', 'für zwei, mit Brotkorb'],
  ['Spiegelei auf Sauerteig', 'mit Kerbel und Schnittlauch'],
  ['Rührei mit Kräutern', 'mit Roggenbrot'],
  ['Shakshuka', 'mit Fladenbrot'],
  ['Linsen mit Wurzelgemüse', 'mit Joghurt'],
  ['Kerbel-Stulle', 'mit Spiegelei und Radieschen'],
  ['Pfannkuchen mit Beeren', 'frisch aus der Pfanne'],
];
const OEFFNUNG = { werktag: 8 * 60, wochenende: 9 * 60, schluss: 17 * 60 };
const heute = new Date();
const datumLang = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const datumKurz = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const istWochenende = (d) => d.getDay() === 0 || d.getDay() === 6;
const oeffnetUm = (d) => (istWochenende(d) ? OEFFNUNG.wochenende : OEFFNUNG.werktag);

const datumFeld = document.querySelector('[data-datum]');
if (datumFeld) datumFeld.textContent = datumLang.format(heute);
const [gericht, beilage] = GERICHT_JE_TAG[heute.getDay()];
const gerichtFeld = document.querySelector('[data-tagesgericht]');
const beilageFeld = document.querySelector('[data-wochentag]');
if (gerichtFeld) gerichtFeld.textContent = gericht;
if (beilageFeld) beilageFeld.textContent = beilage;

// Zeile unter den Knöpfen: Was gilt gerade? (Beispielzeiten wie im Abschnitt „Besuch“)
const offenZeile = document.querySelector('[data-offen]');
if (offenZeile) {
  const jetzt = heute.getHours() * 60 + heute.getMinutes();
  const morgen = new Date(heute); morgen.setDate(morgen.getDate() + 1);
  const auf = oeffnetUm(heute);
  let stand = 'zu';
  let satz = `Für heute geschlossen. Morgen ab ${oeffnetUm(morgen) / 60} Uhr.`;
  if (jetzt < auf) { stand = 'bald'; satz = `Heute ab ${auf / 60} Uhr geöffnet.`; }
  else if (jetzt < OEFFNUNG.schluss) { stand = 'offen'; satz = `Jetzt geöffnet, heute bis ${OEFFNUNG.schluss / 60} Uhr.`; }
  offenZeile.dataset.stand = stand;
  offenZeile.querySelector('[data-offen-text]').textContent = satz;
  offenZeile.hidden = false;
  document.querySelector(`[data-zeiten="${istWochenende(heute) ? 'wochenende' : 'werktag'}"]`)?.classList.add('heute');
}

/* ─── 2. Auftauchen beim Scrollen (sichtbare Teile sofort, damit nichts flackert) ─── */
const auftauchende = [...document.querySelectorAll('.auftauchen')];
if (!wenigBewegung.matches && 'IntersectionObserver' in window) {
  // Geschwister im selben Raster nacheinander zeigen
  for (const el of auftauchende) {
    const geschwister = [...el.parentElement.children].filter((k) => k.classList.contains('auftauchen'));
    const stelle = geschwister.indexOf(el);
    if (geschwister.length > 1 && stelle > 0) el.style.setProperty('--verzug', `${Math.min(stelle, 4) * 0.09}s`);
  }
  for (const el of auftauchende) {
    if (el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add('sichtbar');
  }
  html.classList.add('auftauchen-an');
  const beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('sichtbar');
      beobachter.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of auftauchende) if (!el.classList.contains('sichtbar')) beobachter.observe(el);
}

/* ─── 3. Kopf: aktiver Bereich in der Navigation, Menü fürs Handy ─── */
const kopf = document.querySelector('.kopf');
const nav = document.querySelector('.kopf-nav');
const navLinks = [...document.querySelectorAll('.kopf-nav a')];
if ('IntersectionObserver' in window && navLinks.length) {
  const bereiche = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const sichtbar = new Map();
  const navBeobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) sichtbar.set(e.target.id, e.isIntersecting);
    const aktiv = bereiche.find((b) => sichtbar.get(b.id));
    for (const a of navLinks) {
      if (aktiv && a.getAttribute('href') === `#${aktiv.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  bereiche.forEach((b) => navBeobachter.observe(b));
}

const menueKnopf = document.querySelector('.kopf-menue');
function menue(offen, { fokus = false } = {}) {
  if (!kopf || !menueKnopf) return;
  kopf.classList.toggle('menue-offen', offen);
  menueKnopf.setAttribute('aria-expanded', String(offen));
  menueKnopf.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
  if (fokus) (offen ? navLinks[0] : menueKnopf)?.focus();
}
if (menueKnopf && nav) {
  const istOffen = () => kopf.classList.contains('menue-offen');
  menueKnopf.addEventListener('click', () => menue(!istOffen(), { fokus: !istOffen() }));
  nav.addEventListener('click', (ev) => { if (ev.target.closest('a')) menue(false); });
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && istOffen()) menue(false, { fokus: true }); });
  document.addEventListener('pointerdown', (ev) => { if (istOffen() && !kopf.contains(ev.target)) menue(false); });
  // Fokus verlässt das Menü (Tab über den letzten Eintrag hinaus): schließen
  kopf.addEventListener('focusout', (ev) => { if (istOffen() && ev.relatedTarget && !kopf.contains(ev.relatedTarget)) menue(false); });
  matchMedia('(min-width: 761px)').addEventListener?.('change', (e) => { if (e.matches) menue(false); });
}

/* ─── 4. Filme: Aufmacher im Auftakt (lädt erst nach dem ersten Bildaufbau) ─── */
const geladen = new Promise((fertig) => {
  const los = () => setTimeout(fertig, 350);
  if (document.readyState === 'complete') los(); else addEventListener('load', los, { once: true });
});
const filmAuftakt = document.querySelector('[data-film="auftakt"]');
if (filmAuftakt) filmEinrichten(filmAuftakt, { start: geladen });

/* ─── 5. Laufband, Stempel und die Nadel auf der Karte nur bewegen, solange sie zu sehen sind ─── */
if ('IntersectionObserver' in window) {
  for (const el of document.querySelectorAll('.laufband, .stempel, .plan')) {
    new IntersectionObserver(([e]) => el.classList.toggle('angehalten', !e.isIntersecting)).observe(el);
  }
}

/* ─── 6. Karte filtern (die Bilder oben gehen mit) ─── */
const filterKnoepfe = [...document.querySelectorAll('.filter')];
const gerichte = [...document.querySelectorAll('.gericht')];
const kartenBilder = [...document.querySelectorAll('.karten-bild')];
const filterZahl = document.querySelector('[data-filter-zahl]');
function filtern(art) {
  const passt = (a) => art === 'alle' || (art === 'veg' && (a === 'veg' || a === 'vegan')) || (art === 'vegan' && a === 'vegan');
  let passend = 0;
  for (const g of gerichte) {
    const ok = passt(g.dataset.art);
    g.classList.toggle('gedimmt', !ok);
    if (ok) passend += 1;
  }
  for (const b of kartenBilder) b.classList.toggle('gedimmt', !passt(b.dataset.art));
  for (const k of filterKnoepfe) k.setAttribute('aria-pressed', String(k.dataset.filter === art));
  if (filterZahl) filterZahl.textContent = art === 'alle' ? '' : `${passend} von ${gerichte.length} Gerichten`;
}
for (const k of filterKnoepfe) k.addEventListener('click', () => filtern(k.dataset.filter));

/* ─── 7. Ein Tag bei Kerbel: Himmel, Sonne, Uhr und das Bild im Fenster folgen dem Scrollen ─── */
const tag = document.querySelector('.tag');
const tagBuehne = tag?.querySelector('.tag-buehne');
const sonne = tag?.querySelector('.tag-sonne');
const uhr = tag?.querySelector('[data-uhr]');
const stationen = tag ? [...tag.querySelectorAll('.station')] : [];
const skala = tag ? [...tag.querySelectorAll('.skala-punkt')] : [];
const fenster = tag?.querySelector('.station-bild');
const filmTagRahmen = tag?.querySelector('[data-film="tag"]');
const filmTag = filmTagRahmen ? filmEinrichten(filmTagRahmen) : null;
const FILM_STATION = filmTagRahmen ? stationen.indexOf(filmTagRahmen.closest('.station')) : -1;

// Je Station: Minuten seit Mitternacht, Himmel oben und unten, Sonne, Tisch, Schrift
const TAGESLAUF = [
  { min: 480, oben: '#F6D2A6', unten: '#F6EBDA', sonne: '#F2B035', tisch: '#EFE3CC', schrift: '#1C2A21' },
  { min: 600, oben: '#CDE3E2', unten: '#F5EFE2', sonne: '#F6BE3F', tisch: '#EEE7D6', schrift: '#1C2A21' },
  { min: 750, oben: '#AFD5E0', unten: '#EEF2E5', sonne: '#F8C84A', tisch: '#E7E9D8', schrift: '#1C2A21' },
  { min: 900, oben: '#F0CB8B', unten: '#F6E6C8', sonne: '#F2A830', tisch: '#EEDDBD', schrift: '#1C2A21' },
  { min: 1020, oben: '#24314A', unten: '#A65B45', sonne: '#EE8636', tisch: '#3A2C33', schrift: '#F5EFE2' },
];
const alsRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const RGB = TAGESLAUF.map((s) => ({ oben: alsRgb(s.oben), unten: alsRgb(s.unten), sonne: alsRgb(s.sonne), tisch: alsRgb(s.tisch), schrift: alsRgb(s.schrift) }));
const glatt = (t) => t * t * (3 - 2 * t);
const mischen = (a, b, f) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(' ')})`;
const uhrzeit = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

let tagBewegt = false;
let tagSichtbar = false;
let letzteStation = -1;
let lage = null; // Fenster und Sonne, gemessen relativ zur Bühne (nur bei Größenwechsel neu)

function tagMessen() {
  if (!tagBewegt || !fenster || !sonne) return;
  const b = tagBuehne.getBoundingClientRect();
  const f = fenster.getBoundingClientRect();
  lage = { breite: b.width, links: f.left - b.left, oben: f.top - b.top, w: f.width, h: f.height, sonne: sonne.offsetWidth };
  tag.style.setProperty('--fenster-links', `${Math.round(lage.links)}px`); // die Dinge auf dem Tisch enden vor dem Fenster
}

function tagFortschritt() {
  const r = tag.getBoundingClientRect();
  const strecke = tag.offsetHeight - innerHeight;
  return strecke > 0 ? klemmen(-r.top / strecke, 0, 1) : 0;
}

function stationSetzen(aktiv) {
  if (aktiv === letzteStation) return;
  letzteStation = aktiv;
  stationen.forEach((st, n) => st.classList.toggle('aktiv', n === aktiv));
  skala.forEach((k, n) => (n === aktiv ? k.setAttribute('aria-current', 'true') : k.removeAttribute('aria-current')));
  if (aktiv === FILM_STATION - 1) filmTag?.vorladen();
  filmTag?.erlauben(aktiv === FILM_STATION);
}

function tagZeichnen() {
  if (!tagBewegt) return;
  if (!lage) tagMessen();
  // Stationen liegen bei 10, 30, 50, 70 und 90 Prozent der Strecke
  const p = klemmen((tagFortschritt() - 0.1) / 0.8, 0, 1) * 4;
  const i = Math.min(3, Math.floor(p));
  const roh = p - i;
  // An jeder Station verweilt der Tag kurz, dazwischen läuft er zügig weiter
  const f = glatt(klemmen((roh - 0.22) / 0.56, 0, 1));
  const a = RGB[i];
  const b = RGB[i + 1];
  // Die Dämmerung kommt rasch: Mitteltöne bleiben kurz, damit die Schrift lesbar bleibt
  const fh = i === 3 ? glatt(klemmen((f - 0.4) / 0.2, 0, 1)) : f;
  tag.style.setProperty('--himmel-oben', mischen(a.oben, b.oben, fh));
  tag.style.setProperty('--himmel-unten', mischen(a.unten, b.unten, fh));
  tag.style.setProperty('--sonne', mischen(a.sonne, b.sonne, fh));
  tag.style.setProperty('--tisch', mischen(a.tisch, b.tisch, fh));
  // Die Schrift springt in der Mitte der Dämmerung ins Helle (der Übergang läuft über die Zeit, nie halb stehen)
  const abend = i === 3 && f >= 0.5;
  tag.style.setProperty('--schrift', TAGESLAUF[abend ? 4 : 0].schrift);
  tag.classList.toggle('abend', abend);

  const minuten = Math.round((TAGESLAUF[i].min + (TAGESLAUF[i + 1].min - TAGESLAUF[i].min) * f) / 5) * 5;
  if (uhr) uhr.textContent = uhrzeit(minuten);

  // Die Sonne zieht einen Bogen um das Fenster: links herauf, oben dahinter vorbei, rechts hinunter
  if (lage) {
    const s = (i + f) / 4;
    const g = lage.sonne;
    const mitte = lage.links + lage.w / 2;
    const fuss = lage.oben + lage.h;
    const rx = Math.min(lage.w / 2 + g * 0.62, mitte - g * 0.18, lage.breite - mitte - g * 0.18);
    const hoch = lage.h - g * 0.32;
    const x = mitte - rx * Math.cos(Math.PI * s) - g / 2;
    const y = fuss - g * 0.12 - hoch * Math.sin(Math.PI * s) - g / 2;
    sonne.style.setProperty('--sx', `${x.toFixed(1)}px`);
    sonne.style.setProperty('--sy', `${y.toFixed(1)}px`);
  }

  // Text und Bild wechseln auf halbem Weg; „Stühle hoch“ erst kurz vor Schluss
  stationSetzen(i + (f >= (i === 3 ? 0.8 : 0.5) ? 1 : 0));
}

function tagEinrichten() {
  if (!tag) return;
  tagBewegt = !wenigBewegung.matches;
  tag.classList.toggle('bewegt', tagBewegt);
  lage = null;
  if (!tagBewegt) {
    for (const n of ['--himmel-oben', '--himmel-unten', '--sonne', '--tisch', '--schrift']) tag.style.removeProperty(n);
    tag.classList.remove('abend');
    stationen.forEach((st) => st.classList.remove('aktiv'));
    letzteStation = -1;
    filmTag?.erlauben(true);
    return;
  }
  letzteStation = -1;
  tagZeichnen();
}

if (tag) {
  tagEinrichten();
  wenigBewegung.addEventListener?.('change', tagEinrichten);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { tagSichtbar = e.isIntersecting; if (tagSichtbar) tagZeichnen(); }).observe(tag);
  } else {
    tagSichtbar = true;
  }
  if ('ResizeObserver' in window && tagBuehne) new ResizeObserver(() => { lage = null; if (tagSichtbar) tagZeichnen(); }).observe(tagBuehne);
  skala.forEach((knopf, n) => knopf.addEventListener('click', () => {
    const strecke = tag.offsetHeight - innerHeight;
    const oben = tag.getBoundingClientRect().top + scrollY;
    scrollTo({ top: oben + strecke * (0.1 + n * 0.2) + 1, behavior: wenigBewegung.matches ? 'auto' : 'smooth' });
  }));
}

/* ─── 8. Fuß: der große Name füllt sich beim Hinscrollen mit Eigelb ─── */
const fussWort = document.querySelector('.fuss-wort');
function fussZeichnen() {
  if (!fussWort) return;
  if (wenigBewegung.matches) { fussWort.style.setProperty('--fuellung', '100%'); return; }
  const r = fussWort.getBoundingClientRect();
  if (r.top > innerHeight || r.bottom < 0) return;
  /* voll genau dann, wenn das Seitenende erreicht ist */
  const rest = document.documentElement.scrollHeight - innerHeight - scrollY;
  const strecke = innerHeight - (r.top + rest);
  const anteil = strecke > 1 ? klemmen((innerHeight - r.top) / strecke, 0, 1) : 1;
  fussWort.style.setProperty('--fuellung', `${Math.round(anteil * 100)}%`);
}

/* Ein gemeinsamer, gedrosselter Takt für alles, was am Scrollen hängt */
let geplant = false;
function takt() {
  geplant = false;
  kopf?.classList.toggle('gescrollt', scrollY > 8);
  if (tagSichtbar) tagZeichnen();
  fussZeichnen();
}
function planen() { if (!geplant) { geplant = true; requestAnimationFrame(takt); } }
addEventListener('scroll', planen, { passive: true });
addEventListener('resize', planen);
takt();

/* ─── 9. Tisch anfragen: nur eine Vorschau, es wird nichts gesendet ─── */
const formular = document.getElementById('tisch-form');
const bon = document.getElementById('bon');
const tageReihe = document.querySelector('[data-tage]');
const personenFeld = document.getElementById('personen');
const zaehlerKnoepfe = [...document.querySelectorAll('.zaehler-knopf')];
const nameFeld = formular?.querySelector('input[name="name"]');
const nameFehler = document.getElementById('name-fehler');
let personen = 2;

const minutenVon = (text) => { const [h, m] = text.split(':').map(Number); return h * 60 + m; };

// Die nächsten sieben Tage als Auswahl
const tage = Array.from({ length: 7 }, (_, n) => { const d = new Date(heute); d.setDate(d.getDate() + n); return d; });
if (tageReihe) {
  tageReihe.replaceChildren();
  tageReihe.classList.add('tage-zweizeilig');
  tage.forEach((d, n) => {
    const label = document.createElement('label');
    label.className = 'chip';
    const eingabe = document.createElement('input');
    eingabe.type = 'radio';
    eingabe.name = 'tag';
    eingabe.value = datumLang.format(d);
    eingabe.dataset.index = String(n);
    const text = document.createElement('span');
    text.append(n === 0 ? 'Heute' : n === 1 ? 'Morgen' : datumKurz.format(d).split(',')[0]);
    const klein = document.createElement('small');
    klein.textContent = datumKurz.format(d).split(', ').pop();
    text.append(klein);
    label.append(eingabe, text);
    tageReihe.append(label);
  });
}

function zeitenPruefen() {
  if (!formular) return;
  const gewaehlt = formular.querySelector('input[name="tag"]:checked');
  const index = Number(gewaehlt?.dataset.index ?? 0);
  const d = tage[index] ?? heute;
  const auf = oeffnetUm(d);
  const jetzt = heute.getHours() * 60 + heute.getMinutes();
  const zeiten = [...formular.querySelectorAll('input[name="uhr"]')];
  for (const z of zeiten) {
    const m = minutenVon(z.value);
    z.disabled = m < auf || (index === 0 && m <= jetzt + 30);
  }
  const aktuell = zeiten.find((z) => z.checked);
  if (!aktuell || aktuell.disabled) {
    const frei = zeiten.find((z) => !z.disabled);
    if (frei) frei.checked = true;
  }
}

function tagVorwaehlen() {
  if (!formular) return;
  // Heute nur, wenn noch eine Zeit frei ist
  const letzte = Math.max(...[...formular.querySelectorAll('input[name="uhr"]')].map((z) => minutenVon(z.value)));
  const jetzt = heute.getHours() * 60 + heute.getMinutes();
  const start = letzte > jetzt + 30 ? 0 : 1;
  const ziel = formular.querySelector(`input[name="tag"][data-index="${start}"]`);
  if (ziel) { ziel.checked = true; ziel.defaultChecked = true; }
  zeitenPruefen();
}

function personenSetzen(n) {
  personen = klemmen(n, 1, 8);
  if (personenFeld) personenFeld.value = String(personen);
  if (personenFeld) personenFeld.textContent = String(personen);
  zaehlerKnoepfe.forEach((k) => { k.disabled = (k.dataset.schritt === '-1' && personen === 1) || (k.dataset.schritt === '1' && personen === 8); });
}

if (formular && bon) {
  tagVorwaehlen();
  personenSetzen(2);
  formular.addEventListener('change', (ev) => { if (ev.target.name === 'tag') zeitenPruefen(); });
  zaehlerKnoepfe.forEach((k) => k.addEventListener('click', () => personenSetzen(personen + Number(k.dataset.schritt))));
  nameFeld?.addEventListener('input', () => { nameFeld.removeAttribute('aria-invalid'); if (nameFehler) nameFehler.textContent = ''; });

  formular.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameFeld.value.trim();
    if (name.length < 2) {
      nameFeld.setAttribute('aria-invalid', 'true');
      if (nameFehler) nameFehler.textContent = 'Bitte geben Sie Ihren Namen an.';
      nameFeld.focus();
      return;
    }
    const daten = new FormData(formular);
    const notiz = String(daten.get('notiz') ?? '').trim();
    const werte = {
      tag: String(daten.get('tag') ?? ''),
      uhr: `${daten.get('uhr') ?? ''} Uhr`,
      personen: personen === 1 ? '1 Person' : `${personen} Personen`,
      name,
      notiz,
    };
    for (const [schluessel, wert] of Object.entries(werte)) {
      const feld = bon.querySelector(`[data-bon="${schluessel}"]`);
      if (feld) feld.textContent = wert;
    }
    const notizZeile = bon.querySelector('[data-bon-zeile="notiz"]');
    if (notizZeile) notizZeile.hidden = !notiz;
    formular.hidden = true;
    bon.hidden = false;
    bon.focus({ preventScroll: true });
    if (bon.getBoundingClientRect().top < 80) bon.scrollIntoView({ behavior: wenigBewegung.matches ? 'auto' : 'smooth', block: 'center' });
  });

  bon.querySelector('[data-neu]')?.addEventListener('click', () => {
    formular.reset();
    tagVorwaehlen();
    personenSetzen(2);
    bon.hidden = true;
    formular.hidden = false;
    nameFeld?.focus();
  });
}
