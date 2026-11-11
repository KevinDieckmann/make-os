// Filme der Seite: Das Standbild steht sofort. Der Film lädt erst, wenn sein Rahmen in Sichtnähe kommt,
// ruht außerhalb des Bildschirms und blendet am Schleifenende kurz auf das Standbild (gleich dem ersten Bild).
// Bei „weniger Bewegung“ oder im Datensparmodus bleibt es beim Standbild. Lädt der Film nicht, bleibt es ebenfalls dabei.
// Trägt ein Video data-gross, laden Fenster ab 1440 px diese größere Fassung statt der kleinen.
import { abonnieren } from './feder.js';

const NAHT = 0.55; // Sekunden vor dem Ende, ab denen der Film auf das Standbild blendet

function sparen() {
  const netz = navigator.connection;
  return Boolean(netz && netz.saveData) || matchMedia('(prefers-reduced-data: reduce)').matches;
}

export function filme({ ruhe = false, bereit = Promise.resolve() } = {}) {
  const liste = [];
  for (const el of document.querySelectorAll('[data-film]')) {
    const video = el.querySelector('video');
    if (!video) continue;
    const rahmen = el.closest('[data-film-rahmen]') || el;
    const knopf = rahmen.querySelector('.film-knopf');
    if (ruhe || sparen()) { video.remove(); continue; }

    // Breite Fenster bekommen die größere Fassung. Noch ist nichts geladen, also kostet der Wechsel nichts.
    const quelle = video.querySelector('source');
    if (quelle && video.dataset.gross && matchMedia('(min-width: 90rem)').matches) {
      quelle.src = video.dataset.gross;
      video.load();
    }

    const text = knopf && knopf.querySelector('.film-knopf-text');
    let sichtbar = false;
    let angehalten = false;
    let kaputt = false;
    let ab = null;

    const naht = () => {
      const dauer = video.duration;
      if (dauer && isFinite(dauer)) el.classList.toggle('naht', video.currentTime > dauer - NAHT);
    };
    const takt = an => {
      if (an && !ab) ab = abonnieren(naht, 50);
      else if (!an && ab) { ab(); ab = null; }
    };
    // Der Film lädt nicht: Standbild bleibt, der Knopf verschwindet, keine Meldung.
    const aus = () => {
      kaputt = true;
      takt(false);
      el.classList.remove('bereit', 'naht');
      rahmen.classList.remove('mit-film-knopf');
      if (knopf) knopf.hidden = true;
    };
    const spielen = () => {
      if (kaputt || angehalten || !sichtbar || document.hidden) return;
      const p = video.play();
      if (p && p.catch) p.catch(e => { if (e && e.name === 'NotSupportedError') aus(); });
    };
    const ruhen = () => { if (!video.paused) video.pause(); };
    const zeichnen = () => {
      if (!knopf) return;
      knopf.classList.toggle('steht', angehalten);
      if (text) text.textContent = angehalten ? 'Film abspielen' : 'Film anhalten';
    };

    video.addEventListener('playing', () => {
      el.classList.add('bereit');
      takt(true);
      if (knopf && !kaputt) { knopf.hidden = false; rahmen.classList.add('mit-film-knopf'); }
    });
    video.addEventListener('pause', () => takt(false));
    video.addEventListener('error', aus);
    if (quelle) quelle.addEventListener('error', aus);

    if (knopf) {
      knopf.addEventListener('click', () => {
        angehalten = !angehalten;
        zeichnen();
        if (angehalten) ruhen(); else spielen();
      });
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) ruhen(); else spielen(); });

    // Erst nach der Eröffnung beobachten: Der erste Bildaufbau wartet nie auf einen Film.
    bereit.then(() => {
      new IntersectionObserver(([e]) => {
        sichtbar = e.isIntersecting;
        if (sichtbar) spielen(); else ruhen();
      }, { rootMargin: '12% 0px 12% 0px', threshold: 0.05 }).observe(rahmen);
    });

    liste.push({
      el,
      rahmen,
      // Von außen anhalten (zum Beispiel, sobald jemand das Formular daneben ausfüllt).
      halt() { if (!angehalten && !kaputt) { angehalten = true; zeichnen(); ruhen(); } },
    });
  }
  return liste;
}
