// film.js · Ein Film in mehreren Einstellungen, weich überblendet.
// Standbild sofort, Video erst in Sichtnähe. Außerhalb des Bilds, bei weniger Bewegung und im Datensparmodus
// läuft nichts: dann bleiben die Standbilder, und die Einstellungen lassen sich von Hand wählen.
import { Feder, imTakt, ruhig } from './motor.js';

const BLENDE = 0.9;        // so viele Sekunden vor dem Ende beginnt die nächste Einstellung
const STANDZEIT = 4;       // so lange steht ein Standbild, wenn sein Video nicht lädt
const WARTEN_MAX = 8000;   // ms: so lange darf ein Video auf sich warten lassen
const UEBERBLENDEN = { k: 60, d: 15.5, ruhe: 0.01 };   // liegt nach rund 0,85 s, also vor dem Ende der alten Einstellung

export function film(wurzel) {
  const bilder = [...wurzel.querySelectorAll('[data-film-bild]')];
  const videos = bilder.map(b => b.querySelector('video'));
  const takte = [...wurzel.querySelectorAll('[data-takt]')];
  const striche = takte.map(t => t.querySelector('[data-fortschritt]'));
  const knopf = wurzel.querySelector('[data-film-pause]');
  const knopfText = wurzel.querySelector('[data-film-pause-text]');
  if (!bilder.length) return;

  const sparsam = navigator.connection?.saveData === true;
  const darf = !ruhig && !sparsam && videos.every(Boolean);
  const angefragt = videos.map(() => false);
  const fehlt = videos.map(() => false);
  let aktiv = 0, sichtbar = false, laeuft = darf, seit = performance.now(), taktAus = null;

  const ebenen = bilder.map((b, i) => new Feder(i ? 0 : 1, UEBERBLENDEN, p => { b.style.opacity = p.toFixed(3); }));
  ebenen.forEach(f => f.melden());
  const strich = (i, anteil) => { if (striche[i]) striche[i].style.transform = `scaleX(${Math.min(1, Math.max(0, anteil)).toFixed(4)})`; };

  /* Laden erst auf Zuruf; scheitert es, bleibt das Standbild */
  const laden = i => {
    if (!darf || angefragt[i]) return;
    angefragt[i] = true;
    const v = videos[i];
    v.addEventListener('playing', () => v.classList.add('spielt'));
    v.addEventListener('error', () => { fehlt[i] = true; v.classList.remove('spielt'); }, { once: true });
    v.preload = 'auto';   // beginnt zu laden; spätestens play() holt den Rest
  };
  const halten = i => {
    const v = videos[i];
    if (!v || !angefragt[i]) return;
    v.pause();
    if (v.readyState > 0) { try { v.currentTime = 0; } catch (_) { /* noch keine Daten */ } }
  };

  const knopfSetzen = () => {
    if (!knopf) return;
    knopf.dataset.zustand = laeuft ? 'laeuft' : 'steht';
    if (knopfText) knopfText.textContent = laeuft ? 'Film anhalten' : 'Film abspielen';
  };

  const spielen = () => {
    const soll = darf && sichtbar && laeuft && !document.hidden;
    if (!soll) {
      videos.forEach((v, i) => { if (angefragt[i]) v.pause(); });
      if (taktAus) { taktAus(); taktAus = null; }
      return;
    }
    laden(aktiv);
    if (!taktAus) seit = performance.now();
    if (!fehlt[aktiv]) {
      const v = videos[aktiv];
      v.play()?.catch(fehler => {
        // Abspielen von selbst nicht erlaubt (Stromsparmodus): Standbild bleibt, der Knopf startet den Film
        if (fehler?.name === 'NotAllowedError') { laeuft = false; knopfSetzen(); spielen(); }
      });
    }
    if (!taktAus) taktAus = imTakt(pruefen, 80);
  };

  const zeige = i => {
    if (i === aktiv) return;
    const vorher = aktiv;
    aktiv = i;
    seit = performance.now();
    bilder.forEach((b, j) => {
      b.style.zIndex = j === i ? '2' : j === vorher ? '1' : '0';
      if (j !== i && j !== vorher) { ebenen[j].sofort(0); halten(j); }
    });
    takte.forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
    striche.forEach((_, j) => strich(j, !darf && j === i ? 1 : 0));
    ebenen[i].sofort(0);
    ebenen[i].setze(1);
    ebenen[i].bis().then(() => { if (aktiv === i) { ebenen[vorher].sofort(0); halten(vorher); } });
    spielen();
  };

  /* Läuft nur, solange der Film zu sehen ist: Fortschritt zeichnen, rechtzeitig weiterblenden */
  function pruefen() {
    const v = videos[aktiv];
    const naechste = (aktiv + 1) % bilder.length;
    // Kommt das Video nicht in Gang, geht es mit dem Standbild weiter
    if (!fehlt[aktiv] && v.readyState < 2 && performance.now() - seit > WARTEN_MAX) { fehlt[aktiv] = true; seit = performance.now(); }
    let zeit, dauer;
    if (fehlt[aktiv]) { zeit = (performance.now() - seit) / 1000; dauer = STANDZEIT + BLENDE; }
    else { zeit = v.currentTime; dauer = v.duration; }
    if (!(dauer > 0)) return;
    strich(aktiv, zeit / (dauer - BLENDE));
    if (zeit > dauer * 0.35) laden(naechste);
    // Die nächste Einstellung beginnt mit ihrem Standbild (ihr erstes Bild) und läuft los, sobald sie geladen ist
    if (dauer - zeit <= BLENDE) zeige(naechste);
  }

  takte.forEach((t, i) => t.addEventListener('click', () => zeige(i)));
  if (knopf) {
    if (!darf) knopf.hidden = true;
    else knopf.addEventListener('click', () => { laeuft = !laeuft; knopfSetzen(); spielen(); });
    knopfSetzen();
  }
  if (!darf) { wurzel.dataset.film = 'still'; strich(0, 1); return; }

  /* In Sichtnähe laden, im Bild spielen, außerhalb anhalten */
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    laden(aktiv);
  }, { rootMargin: '70% 0px' }).observe(wurzel);
  new IntersectionObserver(([e]) => {
    sichtbar = e.isIntersecting;
    spielen();
  }, { threshold: 0.15 }).observe(wurzel);
  document.addEventListener('visibilitychange', spielen);
}
