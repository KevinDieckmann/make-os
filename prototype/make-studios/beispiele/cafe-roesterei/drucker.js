// Vorbestellen als Vorführung: Ein Bondrucker schiebt beim Scrollen einen Bon heraus.
// Die Auswahl tauscht nur, was auf dem Bon steht. Es wird nichts gesendet und nichts gespeichert.
import { imTakt, Feder } from './bewegung.js';

const GETRAENKE = {
  cortado: { name: 'Cortado', bohne: 'Brasilien', geschmack: 'Kakao, Haselnuss', bild: 'medien/bon-espresso.webp', b: 295, h: 360 },
  flatwhite: { name: 'Flat White', bohne: 'Kolumbien', geschmack: 'Karamell, Schokolade', bild: 'medien/bon-latte.webp', b: 252, h: 360 },
  matcha: { name: 'Matcha auf Eis', bohne: 'Japan', geschmack: 'Grasig, mild', bild: 'medien/bon-matcha.webp', b: 221, h: 360 },
  eislatte: { name: 'Eislatte', bohne: 'Kolumbien', geschmack: 'Karamell, frisch', bild: 'medien/bon-eislatte.webp', b: 208, h: 360 },
};
const STUFEN = 46;
const NACHDRUCK = 1600;
const BUEHNE = { breite: 1440, geraetOben: 133, bon: 328, hoehe: 615, unten: 800 };
const LEISTE_FREI = 92;   // Platz für die feste Leiste unten in der Mitte

function zufall(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function druckerStarten({ reduziert }) {
  const bereich = document.querySelector('.bestellen');
  if (!bereich) return;
  const klebe = bereich.querySelector('.bestellen-klebe');
  const buehne = bereich.querySelector('.drucker-buehne');
  const bon = bereich.querySelector('.bon');
  const bild = bereich.querySelector('.bon-bild');
  const felder = { name: bereich.querySelector('.bon-getraenk'), bohne: bereich.querySelector('.bon-bohne'), geschmack: bereich.querySelector('.bon-geschmack') };
  const ansage = bereich.querySelector('[data-bon-ansage]');
  const knoepfe = [...bereich.querySelectorAll('[data-getraenk]')];
  const kopfTeil = bereich.querySelector('.bestellen-kopf');
  const seiteTeil = bereich.querySelector('.bestellen-seite');

  // Abgerissene Kante
  let d = 'M0 0 L328 0';
  for (let x = 328; x > 0; x -= 8) d += ` L${x - 4} 9 L${x - 8} 0`;
  bereich.querySelector('.bon-kante-pfad')?.setAttribute('d', d + ' Z');

  // Strichcode aus festen Zufallszahlen, damit er bei jedem Laden gleich aussieht
  const code = bereich.querySelector('.bon-strichcode');
  const balken = [];
  if (code) {
    const z = zufall(20250521);
    let x = 0, luecke = false;
    while (x < 284) {
      const w = Math.min(284 - x, 1 + Math.floor(z() * 4));
      const el = document.createElement('span');
      el.className = luecke ? 'bon-balken ist-luecke' : 'bon-balken';
      el.style.width = w + 'px';
      code.append(el);
      if (!luecke) balken.push({ el, anteil: (x + w / 2) / 284 });
      x += w;
      luecke = !luecke;
    }
    code.style.gap = '0';
  }
  const fegen = new Feder(reduziert ? 1 : 0, 70, 34);
  const fegenZeigen = () => {
    const v = fegen.wert;
    for (const b of balken) {
      const s = Math.min(1, Math.max(0, (v * 1.25 - b.anteil) / 0.25));
      b.el.style.transform = `scaleY(${s.toFixed(3)})`;
    }
  };
  fegenZeigen();

  // Bühne skalieren: auf breiten Schirmen mit der Schrift, sonst passend zur Höhe
  function buehneSetzen() {
    const W = klebe.clientWidth, H = klebe.clientHeight;
    const wurzel = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    let s, schieben;
    if (innerWidth >= 1024) {
      s = wurzel / 16;
      // wie --fall im Stylesheet: ab 1440 px rückt die Bühne auf hohen Schirmen etwas tiefer
      schieben = innerWidth >= 1440 ? Math.max(0, Math.min(innerHeight - 50 * wurzel, 6.5 * wurzel)) : 0;
      // Füllt der Abschnitt genau das Fenster, endet der Bon sonst hinter der Leiste: dann höher rücken und notfalls kleiner werden.
      if (H <= innerHeight + 1) {
        const frei = H - LEISTE_FREI;
        s = Math.min(s, frei / BUEHNE.unten);
        schieben = Math.max(0, Math.min(schieben, frei - BUEHNE.unten * s));
      }
    } else {
      // Zwischen Überschrift und Auswahl einpassen, gemessen ohne Bewegungs-Versatz
      const luft = 20;
      let oben = 0.217 * H, unten = 0.78 * H;
      if (kopfTeil && seiteTeil && seiteTeil.offsetTop > 0) {
        oben = kopfTeil.offsetTop + kopfTeil.offsetHeight + luft;
        unten = seiteTeil.offsetTop - luft;
      }
      s = Math.max(0.35, (unten - oben) / BUEHNE.hoehe);
      s = Math.min(1, s, (W - 40) / BUEHNE.bon);
      schieben = oben - BUEHNE.geraetOben * s + Math.max(0, (unten - oben) - BUEHNE.hoehe * s) / 2;
    }
    buehne.style.transform = `translateX(-50%) translate(0px, ${schieben.toFixed(1)}px) scale(${s.toFixed(4)})`;
  }
  buehneSetzen();
  new ResizeObserver(buehneSetzen).observe(klebe);
  if (document.fonts) document.fonts.ready.then(buehneSetzen);

  // Auswahl
  let nachdruckStart = -1;
  let gefuettert = reduziert;
  function waehlen(schluessel, ansagen) {
    const g = GETRAENKE[schluessel];
    if (!g) return;
    for (const k of knoepfe) k.setAttribute('aria-pressed', String(k.dataset.getraenk === schluessel));
    felder.name.textContent = g.name;
    felder.bohne.textContent = g.bohne;
    felder.geschmack.textContent = g.geschmack;
    if (bild) { bild.width = g.b; bild.height = g.h; bild.src = g.bild; }
    if (ansagen && ansage) ansage.textContent = `Bon für ${g.name} gedruckt · nichts gesendet`;
    if (!reduziert) { nachdruckStart = performance.now(); fegen.ziel = 0; fegen.wert = 0; fegen.tempo = 0; gefuettert = false; }
  }
  for (const k of knoepfe) k.addEventListener('click', () => waehlen(k.dataset.getraenk, true));

  if (reduziert) {
    bon.style.setProperty('--p', '1');
    return;
  }

  let zuletzt = -1;
  let gezeigt = fegen.wert;
  imTakt((dt) => {
    const r = bereich.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight * 1.2) return;
    const roh = Math.min(1, Math.max(0, 1 - r.top / (0.85 * innerHeight)));
    let p = 1 - Math.pow(1 - roh, 1.6);
    if (nachdruckStart >= 0) {
      const q = Math.min(1, (performance.now() - nachdruckStart) / NACHDRUCK);
      p = Math.min(p, 1 - Math.pow(1 - q, 2.2));
      if (q >= 1) nachdruckStart = -1;
    }
    const stufe = Math.floor(p * STUFEN) / STUFEN;
    if (stufe !== zuletzt) { zuletzt = stufe; bon.style.setProperty('--p', stufe.toFixed(4)); }
    if (!gefuettert && p >= 0.88) { gefuettert = true; fegen.ziel = 1; }
    if (fegen.schritt(dt) || fegen.wert !== gezeigt) { fegenZeigen(); gezeigt = fegen.wert; }
  });
}
