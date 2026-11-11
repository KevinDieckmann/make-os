// Röstung: ein echter Film in drei Einstellungen (Auswurf, Kühlsieb, Abfüllen).
// Die Bühne bleibt beim Scrollen stehen, die Einstellung wechselt mit der Scrollstelle. Es läuft immer nur ein Film,
// geladen wird erst in Sichtnähe. Bei reduzierter Bewegung, im Datensparmodus oder wenn ein Film nicht lädt, bleiben die Standbilder.
//
// Wechsel: Das Standbild der neuen Einstellung blendet über die alte (deren Film läuft darunter weiter). Erst wenn es deckt,
// hält der alte Film an und der neue beginnt bei seinem ersten Bild, das dem Standbild gleicht. So wird nie ein laufender Film
// selbst durchsichtig geblendet: Das kostet in manchen Browsern dauerhaft die halbe Bildrate.
import { imTakt, scrubAnmelden } from './bewegung.js';

const WECHSEL = 950;          // ms, so lange blendet eine Einstellung über die vorige
const STRECKE = { breit: 1.8, schmal: 1.65 };   // zusätzliche Scrollstrecke in Fensterhöhen
// Die erste Einstellung sieht man schon beim Hereinkommen, darum wechselt sie etwas früher. Ziele der Knöpfe: Mitte jedes Abschnitts.
const GRENZEN = [0.27, 0.63];
const ZIELE = [0.1, 0.45, 0.82];

export function roestenStarten({ reduziert, scrolleZu }) {
  const bereich = document.querySelector('.roesten');
  if (!bereich) return;
  const buehne = bereich.querySelector('.roesten-buehne');
  const schritte = [...bereich.querySelectorAll('.roest-schritt')];
  const bilder = schritte.map((s) => s.querySelector('.roest-bild'));
  const filme = schritte.map((s) => s.querySelector('.roest-video'));
  const wahl = bereich.querySelector('.roest-wahl');
  const knoepfe = [...bereich.querySelectorAll('[data-roest-schritt]')];
  const gang = bereich.querySelector('.roest-gang-stand');
  const pause = bereich.querySelector('.roest-pause');
  const pauseText = bereich.querySelector('.roest-pause-text');

  // Ruhige Fassung: drei Standbilder mit Text, kein Film, keine stehende Bühne.
  if (reduziert || !buehne || schritte.length !== 3) {
    for (const f of filme) f?.remove();
    return;
  }

  const sparsam = !!(navigator.connection && navigator.connection.saveData);
  const kannFilm = filme.every((f) => f && typeof f.play === 'function' && f.canPlayType && f.canPlayType('video/mp4; codecs="avc1.640028"') !== '');
  const mitFilm = kannFilm && !sparsam;
  if (!mitFilm) for (const f of filme) f?.remove();

  bereich.classList.add('ist-szene');
  if (wahl) wahl.hidden = false;
  const streckeSetzen = () => { bereich.style.setProperty('--roest-strecke', String(innerWidth < 640 ? STRECKE.schmal : STRECKE.breit)); };
  streckeSetzen();
  addEventListener('resize', streckeSetzen);

  // Die Bühne wächst beim Hereinkommen aus einem Fenster auf volle Breite und zieht sich beim Verlassen wieder zusammen.
  const rand = () => (innerWidth < 640 ? 1.25 : 2.5) * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  let auf = 0, zu = 0;
  const fenster = () => {
    const r = rand();
    const a = 1 - auf, z = zu;
    const seite = (r * Math.max(a, z)).toFixed(1);
    const oben = (r * 2.4 * a).toFixed(1);
    const unten = (r * 2.4 * z).toFixed(1);
    buehne.style.clipPath = a < 0.002 && z < 0.002 ? '' : `inset(${oben}px ${seite}px ${unten}px ${seite}px)`;
  };
  scrubAnmelden({ ziel: bereich, von: 'top_bottom', bis: 'top_top', bei: (p) => { auf = 1 - (1 - p) ** 2; fenster(); } });
  scrubAnmelden({ ziel: bereich, von: 'bottom_bottom', bis: 'bottom_top', bei: (p) => { zu = p * p; fenster(); } });

  /* ─── Einstellung nach Scrollstelle ─── */
  let aktiv = 0;
  let sichtbar = false;
  let nah = false;
  let angehalten = false;      // von Hand angehalten oder vom Browser nicht gestartet
  let laeuft = 0;              // Einstellung, deren Film gerade läuft oder zuletzt lief
  let wechselNr = 0;
  const geladen = new Set();
  const defekt = new Set();     // Filme, die nicht laden: Dort bleibt das Standbild, ohne Fehlerbild und ohne Knopf

  function laden(i) {
    const f = filme[i];
    if (!mitFilm || !f || geladen.has(i)) return;
    geladen.add(i);
    f.addEventListener('playing', () => { if (i === laeuft) bilder[i].classList.add('laeuft'); });
    f.addEventListener('error', () => { defekt.add(i); bilder[i].classList.remove('laeuft'); knopfZeigen(); });
    f.preload = 'auto';
  }

  // Lässt genau den Film der Einstellung „laeuft“ spielen, alle anderen ruhen.
  function abspielen() {
    if (!mitFilm) return;
    filme.forEach((f, i) => {
      const soll = sichtbar && !angehalten && !document.hidden && i === laeuft && !defekt.has(i);
      if (soll) {
        laden(i);
        if (f.paused) {
          const lauf = f.play();
          // Abgelehnt, obwohl der Film in Ordnung ist: Der Browser erlaubt kein selbsttätiges Abspielen. Dann startet der Knopf.
          if (lauf && lauf.catch) lauf.catch(() => { if (i === laeuft && !angehalten && !f.error && !defekt.has(i) && f.paused) { angehalten = true; knopfZeigen(); } });
        }
      } else if (!f.paused) f.pause();
    });
  }

  // Nach dem Überblenden: alte Bilder weg, alter Film an den Anfang, neuer Film ab seinem ersten Bild.
  function uebernehmen() {
    bilder.forEach((b, n) => {
      if (n === aktiv) return;
      b.style.transition = 'none';
      b.style.opacity = '0';
      b.classList.remove('laeuft');
      const f = filme[n];
      if (mitFilm && f) { if (!f.paused) f.pause(); try { if (f.readyState > 0 && f.currentTime > 0) f.currentTime = 0; } catch { /* bleibt stehen */ } }
    });
    laeuft = aktiv;
    knopfZeigen();
    abspielen();
  }

  function knopfZeigen() {
    if (!pause) return;
    pause.hidden = !mitFilm || defekt.has(laeuft);
    pause.classList.toggle('ist-angehalten', angehalten);
    if (pauseText) pauseText.textContent = angehalten ? 'Film abspielen' : 'Film anhalten';
  }

  function setzen(i) {
    if (i === aktiv) return;
    aktiv = i;
    schritte.forEach((s, n) => s.classList.toggle('ist-aktiv', n === i));
    knoepfe.forEach((k, n) => k.setAttribute('aria-pressed', String(n === i)));
    if (nah) { laden(i); if (i + 1 < filme.length) laden(i + 1); }
    // Zurück zur Einstellung, deren Film noch läuft (mitten in einer Blende): Sie bleibt, die Standbilder darüber blenden wieder aus.
    if (i === laeuft && bilder[i].style.opacity === '1') {
      bilder.forEach((x, n) => { if (n !== i) { x.style.transition = ''; x.style.opacity = '0'; } });
      wechselNr += 1;
      return;
    }
    // Standbild der neuen Einstellung nach oben legen und einblenden
    const b = bilder[i];
    b.classList.remove('laeuft');
    b.style.transition = 'none';
    b.style.opacity = '0';
    // Ebenen 1 bis 3: das neue Bild ganz oben, ein noch blendendes darunter, der Rest unten (alle unter Schleier und Text)
    for (const anderes of bilder) anderes.style.zIndex = anderes.style.zIndex === '3' ? '2' : '1';
    b.style.zIndex = '3';
    void b.offsetWidth;
    b.style.transition = '';
    b.style.opacity = '1';
    const nr = (wechselNr += 1);
    setTimeout(() => { if (nr === wechselNr) uebernehmen(); }, WECHSEL);
  }
  bilder[0].style.opacity = '1';

  let standZuletzt = -1;
  imTakt(() => {
    if (!nah) return;
    const r = bereich.getBoundingClientRect();
    const weg = r.height - innerHeight;
    const p = weg > 0 ? Math.min(1, Math.max(0, -r.top / weg)) : 0;
    setzen(p < GRENZEN[0] ? 0 : p < GRENZEN[1] ? 1 : 2);
    if (gang && Math.abs(p - standZuletzt) > 0.002) { standZuletzt = p; gang.style.transform = `scaleX(${p.toFixed(3)})`; }
  });

  for (const k of knoepfe) {
    k.addEventListener('click', () => {
      const i = Number(k.dataset.roestSchritt);
      const r = bereich.getBoundingClientRect();
      const weg = Math.max(0, r.height - innerHeight);
      scrolleZu(r.top + scrollY + weg * ZIELE[i]);
    });
  }

  pause?.addEventListener('click', () => { angehalten = !angehalten; knopfZeigen(); abspielen(); });
  knopfZeigen();

  // In Sichtnähe den ersten Film holen; außerhalb des Bildes ruht alles.
  new IntersectionObserver(([e]) => {
    nah = e.isIntersecting;
    if (nah) { laden(aktiv); if (aktiv + 1 < filme.length && geladen.size < 2) setTimeout(() => { if (nah) laden(aktiv + 1); }, 1200); }
  }, { rootMargin: '90% 0px' }).observe(bereich);
  new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; abspielen(); }, { threshold: 0.01 }).observe(bereich);
  document.addEventListener('visibilitychange', abspielen);
}
