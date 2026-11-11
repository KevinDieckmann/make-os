// vorlader.js · Das Zeichen füllt sich von unten, Fotokarten werden ausgeteilt,
// die letzte wächst zum Heldenfoto, das Zeichen fliegt in den Kopf. Rund 2,4 s, wenn alles da ist, höchstens gut 3 s, nie hängen.
import { Feder, bewegung, nach, ruhig } from './motor.js';

const HALTEN_BEI = 0.72;      // so weit füllt sich das Zeichen, solange noch geladen wird
const WARTEN_MAX = 2000;      // danach geht es weiter, auch wenn noch nicht alles da ist
const KARTE_START = 100;
const KARTE_ABSTAND = 130;
const KARTE_SETZEN = 360;     // so lange braucht die letzte Karte, bis sie liegt
const FINALE_HALTEN = 120;
const FUELLEN_VORSPRUNG = 220; // das Zeichen füllt sich schon, dann beginnt der Flug
const FREIGABE_BEI = 0.35;

const FUELLEN = { k: 60, d: 30 };
const ABSCHLUSS = { k: 190, d: 28, klemmen: true };
const UEBERGABE = { k: 210, d: 30, klemmen: true, ruhe: 0.004 };
const KARTE = { k: 190, d: 24 };
const WACHSEN = { k: 90, d: 17, klemmen: true, ruhe: 0.001 };
const GEHEN = { k: 320, d: 30, klemmen: true };

export function vorlader({ lenis, uebergabe }) {
  const feld = document.querySelector('[data-vorlader]');
  const kopfZeichen = document.querySelector('[data-kopf-zeichen]');
  let uebergeben = false;
  const freigeben = () => { if (!uebergeben) { uebergeben = true; uebergabe(); } };
  const aufraeumen = () => {
    feld?.remove();
    if (kopfZeichen) kopfZeichen.style.opacity = '';
    lenis?.start();
    freigeben();
  };
  if (!feld || ruhig) { aufraeumen(); return aufraeumen; }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  lenis?.stop();
  if (kopfZeichen) kopfZeichen.style.opacity = '0';

  const fuellung = feld.querySelector('[data-fuellung]');
  const prozent = feld.querySelector('[data-prozent]');
  const zeichen = feld.querySelector('[data-vorlader-zeichen]');
  const zeichenGrund = zeichen.querySelector('.zeichen-grund');
  const zeile = feld.querySelector('[data-vorlader-zeile]');
  const karten = [...feld.querySelectorAll('[data-karte]')];
  const finale = feld.querySelector('[data-finale]');
  const buehne = document.querySelector('[data-held-buehne]');

  /* Laden zählen: Fotos des Stapels, Heldenfoto, Schrift */
  const bilder = [...feld.querySelectorAll('img'), buehne?.querySelector('img')].filter(Boolean);
  const gesamt = bilder.length + 1;
  let geladen = 0;
  let allesDa = false;
  const eins = () => { geladen++; fuell.setze(Math.min(geladen / gesamt, HALTEN_BEI)); if (geladen >= gesamt) allesDa = true; };
  const fuell = new Feder(0, FUELLEN, p => {
    fuellung.style.clipPath = `inset(${((1 - p) * 100).toFixed(2)}% 0 0 0)`;
    prozent.textContent = String(Math.min(100, Math.round(p * 100))).padStart(2, '0') + ' %';
  });
  fuell.melden();
  for (const b of bilder) {
    if (b.complete) eins();
    else { b.addEventListener('load', eins, { once: true }); b.addEventListener('error', eins, { once: true }); }
  }
  (document.fonts?.load('400 1em "DM Sans"') ?? Promise.resolve()).then(eins, eins);

  /* Karten austeilen */
  const kartenFedern = [...karten, finale].map(k => {
    const neigung = parseFloat(k.dataset.karte || '0');
    return bewegung(k, { opacity: 0, scale: 0.82, y: 48, rotate: neigung * 1.8 }, { opacity: 1, scale: 1, y: 0, rotate: neigung, halten: neigung !== 0 }, KARTE);
  });
  kartenFedern.forEach((f, i) => nach(KARTE_START + i * KARTE_ABSTAND, () => f.setze(1)));
  const finaleBereit = KARTE_START + karten.length * KARTE_ABSTAND + KARTE_SETZEN + FINALE_HALTEN;

  const t0 = performance.now();
  let fertig = false;
  const warten = () => new Promise(ok => {
    const pruefen = () => {
      const t = performance.now() - t0;
      if ((allesDa && t >= finaleBereit) || t >= Math.max(WARTEN_MAX, finaleBereit)) ok();
      else setTimeout(pruefen, 60);
    };
    pruefen();
  });

  (async () => {
    await warten();
    if (fertig) return;
    // Füllen abschließen; es läuft weiter, während das Zeichen schon losfliegt
    fuell.einstellen(ABSCHLUSS).setze(1);
    await new Promise(ok => setTimeout(ok, FUELLEN_VORSPRUNG));
    if (fertig) return;

    // Finale wächst zur Bühne, das Zeichen fliegt in den Kopf
    kartenFedern[kartenFedern.length - 1].sofort(1);
    const von = finale.getBoundingClientRect();
    const zu = buehne.getBoundingClientRect();
    finale.style.transform = '';
    finale.style.position = 'fixed';
    finale.style.margin = '0';
    finale.style.zIndex = '1';
    const setzeRahmen = p => {
      finale.style.left = (von.left + (zu.left - von.left) * p).toFixed(2) + 'px';
      finale.style.top = (von.top + (zu.top - von.top) * p).toFixed(2) + 'px';
      finale.style.width = (von.width + (zu.width - von.width) * p).toFixed(2) + 'px';
      finale.style.height = (von.height + (zu.height - von.height) * p).toFixed(2) + 'px';
    };
    setzeRahmen(0);
    const wachsen = new Feder(0, WACHSEN, setzeRahmen);

    const a = zeichen.getBoundingClientRect();
    const b = kopfZeichen.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = b.width / a.width;
    const flug = new Feder(0, UEBERGABE, p => {
      zeichen.style.transform = `translate3d(${(dx * p).toFixed(2)}px, ${(dy * p).toFixed(2)}px, 0) scale(${(1 + (s - 1) * p).toFixed(4)})`;
      zeichenGrund.style.opacity = String(0.2 * (1 - p));
      zeile.style.opacity = String(1 - p);
    });
    wachsen.setze(1);
    nach(60, () => flug.setze(1));
    await Promise.all([wachsen.bis(), flug.bis()]);
    if (fertig) return;

    // Übergabe: Kopf-Zeichen sichtbar, Feld blendet aus
    fertig = true;
    if (kopfZeichen) kopfZeichen.style.opacity = '';
    scrollTo(0, 0);
    lenis?.start();
    const gehen = new Feder(1, GEHEN, p => {
      feld.style.opacity = p.toFixed(3);
      if (p <= 1 - FREIGABE_BEI) freigeben();
    });
    gehen.setze(0);
    await gehen.bis();
    aufraeumen();
  })();

  // Notbremse: nie hängen bleiben
  return () => { if (!fertig) { fertig = true; aufraeumen(); } };
}
