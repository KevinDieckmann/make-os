// Vorlader: Der Becher füllt sich, solange Schriften und 3D-Ansicht laden, dann gießt er die Seite frei.
// Höchstens gut zwei Sekunden Warten; danach geht es auch ohne fertige 3D-Ansicht weiter.
import { Feder, imTakt, zustandSetzen } from './bewegung.js';

const MIN_SICHTBAR = 620;
const HALTEN = 180;
const HOECHSTENS = 1900;
const NOTFALL = 4200;

export function vorladerStarten({ reduziert, heldBereit }) {
  const huelle = document.querySelector('.vorlader');
  const fertig = () => { zustandSetzen('enthuellt'); zustandSetzen('bereit'); };
  if (!huelle || reduziert) {
    if (huelle) huelle.classList.add('ist-weg');
    fertig();
    return Promise.resolve();
  }
  huelle.classList.add('ist-gesteuert');
  const zahl = huelle.querySelector('.vorlader-zahl');
  const fuellung = huelle.querySelector('.vorlader-fuellung');
  const start = performance.now();
  const stand = new Feder(0, 120, 26);
  const giessen = new Feder(0, 90, 18);
  stand.ziel = 0.1;
  let haltBis = 0;
  let giesst = false;
  let ende = false;
  let zuletzt = -1;

  return new Promise((ok) => {
    const abschluss = () => {
      if (ende) return;
      ende = true;
      huelle.classList.add('ist-weg');
      huelle.style.clipPath = '';
      fertig();
      aus();
      ok();
    };
    const schriften = document.fonts ? document.fonts.ready : Promise.resolve();
    schriften.then(() => { stand.ziel = Math.max(stand.ziel, 0.6); });
    const geladen = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => addEventListener('load', r, { once: true }));
    Promise.all([geladen, Promise.resolve(heldBereit).catch(() => {})]).then(() => { stand.ziel = 1; });
    setTimeout(() => { stand.ziel = 1; }, HOECHSTENS);
    setTimeout(abschluss, NOTFALL);

    const aus = imTakt((dt) => {
      if (ende) return;
      const jetzt = performance.now();
      stand.schritt(dt);
      const s = Math.min(1, Math.max(0, stand.wert));
      if (!giesst && s > 0.995 && stand.ziel === 1 && jetzt - start >= MIN_SICHTBAR) {
        if (!haltBis) haltBis = jetzt + HALTEN;
        else if (jetzt >= haltBis) { giesst = true; giessen.ziel = 1; zustandSetzen('enthuellt'); }
      }
      if (giesst) giessen.schritt(dt);
      const g = Math.min(1, Math.max(0, giessen.wert));
      const n = Math.round(s * 100);
      if (n !== zuletzt) { zuletzt = n; zahl.textContent = String(n).padStart(3, '0'); }
      fuellung.setAttribute('y', (156 - s * (1 - g) * 126).toFixed(2));
      if (giesst) huelle.style.clipPath = `inset(${(g * 100).toFixed(2)}% 0 0 0)`;
      if (giesst && g > 0.98) abschluss();
    });
  });
}
