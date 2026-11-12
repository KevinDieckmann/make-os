// Werkstattfilm: vier kurze, stumme Einstellungen hintereinander.
// Das Standbild jeder Einstellung steht sofort. Ein Film lädt erst, wenn er dran ist und der Film im Bild steht,
// und ruht, sobald er aus dem Bild ist. Bei „weniger Bewegung“ oder im Datensparmodus bleibt es bei den Standbildern;
// lädt ein Film nicht, bleibt sein Standbild ebenfalls stehen.
// Auf breiten, hohen Fenstern ist der Auftakt angeheftet: Der Film wächst beim Scrollen aus seinem kleinen Fenster auf volle Größe.
import { beiBewegung, klemme } from './feder.js';

const sparsam = () => navigator.connection?.saveData === true || matchMedia('(prefers-reduced-data: reduce)').matches;

export function reelEinrichten({ ruhe, bereit = Promise.resolve(), beiFortschritt = () => {}, scrolleZu = y => scrollTo(0, y) }) {
  const reel = document.querySelector('[data-reel]');
  if (!reel) return null;
  const abschnitt = reel.closest('.auftakt');
  const halt = abschnitt.querySelector('.auftakt-halt');
  const blatt = abschnitt.querySelector('[data-blatt]');
  const platz = abschnitt.querySelector('[data-film-platz]');
  const bild = reel.querySelector('[data-reel-bild]');
  const clips = [...reel.querySelectorAll('[data-clip]')];
  const videos = clips.map(c => c.querySelector('video'));
  const saetze = [...reel.querySelectorAll('[data-satz]')];
  const wahl = [...reel.querySelectorAll('[data-wahl]')];
  const knopf = reel.querySelector('[data-film-knopf]');
  const knopfText = reel.querySelector('[data-film-knopf-text]');

  let aktiv = 0;          // welche Einstellung zu sehen ist
  let inSicht = false;    // der Film steht im Bild oder kurz davor
  let vonHand = false;    // Besucher hat angehalten
  let los = false;        // der erste Bildaufbau ist durch
  let liefSchon = false;
  let letzteZeit = 0;
  const defekt = videos.map(() => false);
  const darf = () => !ruhe.matches && !sparsam();

  function knopfZeigen() {
    knopf.hidden = !(darf() && liefSchon);
    knopf.classList.toggle('steht', vonHand);
    const text = vonHand ? 'Film abspielen' : 'Film anhalten';
    knopf.setAttribute('aria-label', text);
    knopfText.textContent = text;
  }

  function abgleichen() {
    const film = videos[aktiv];
    videos.forEach((v, i) => { if (i !== aktiv && !v.paused) v.pause(); });
    const soll = los && darf() && inSicht && !vonHand && !document.hidden && !defekt[aktiv];
    if (soll) {
      if (film.paused) film.play()?.catch(() => { /* Abspielen nicht erlaubt: das Standbild bleibt */ });
    } else if (!film.paused) {
      film.pause();
    }
    if (!darf()) clips.forEach(c => c.classList.remove('laeuft'));
    knopfZeigen();
  }

  function zeige(i) {
    if (i === aktiv) return;
    const alt = aktiv;
    aktiv = i;
    letzteZeit = 0;
    clips.forEach((c, n) => c.classList.toggle('aktiv', n === i));
    saetze.forEach((s, n) => s.classList.toggle('aktiv', n === i));
    wahl.forEach((b, n) => {
      b.setAttribute('aria-pressed', String(n === i));
      b.style.setProperty('--lauf', n < i ? '1' : '0');
    });
    const film = videos[i];
    try { if (film.readyState > 0) film.currentTime = 0; } catch (_) { /* noch nichts geladen */ }
    // Die alte Einstellung blendet aus und springt danach auf ihr erstes Bild zurück.
    setTimeout(() => {
      if (aktiv === alt) return;
      clips[alt].classList.remove('laeuft');
      try { if (videos[alt].readyState > 0) videos[alt].currentTime = 0; } catch (_) { /* egal */ }
    }, 750);
    abgleichen();
  }
  const weiter = () => zeige((aktiv + 1) % clips.length);

  videos.forEach((film, i) => {
    film.muted = true;
    film.addEventListener('playing', () => {
      liefSchon = true;
      clips[i].classList.add('laeuft');
      knopfZeigen();
    });
    film.addEventListener('timeupdate', () => {
      if (i !== aktiv || !Number.isFinite(film.duration) || film.paused) return;
      const t = film.currentTime;
      wahl[i]?.style.setProperty('--lauf', klemme(t / film.duration).toFixed(3));
      if (film.duration - t < .3 || t < letzteZeit - 1) weiter();
      else letzteZeit = t;
    });
    film.addEventListener('error', () => { defekt[i] = true; clips[i].classList.remove('laeuft'); abgleichen(); });
  });

  // Breite Fenster bekommen für die erste Einstellung die größere Fassung. Noch ist nichts geladen.
  if (videos[0]?.dataset.gross && matchMedia('(min-width: 1440px)').matches) videos[0].src = videos[0].dataset.gross;

  wahl.forEach((b, i) => b.addEventListener('click', () => zeige(i)));
  knopf.addEventListener('click', e => { e.stopPropagation(); vonHand = !vonHand; abgleichen(); });
  document.addEventListener('visibilitychange', abgleichen);
  ruhe.addEventListener?.('change', () => { messen(); abgleichen(); });
  navigator.connection?.addEventListener?.('change', abgleichen);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inSicht = e.isIntersecting; abgleichen(); }, { rootMargin: '120px 0px' }).observe(reel);
  }
  bereit.then(() => { los = true; abgleichen(); });

  // ─── Angehefteter Auftakt: Fenster → volle Größe ───
  const gross = matchMedia('(min-width: 900px) and (min-height: 700px)');
  let gepinnt = false;
  let fenster = null;     // Lage des kleinen Fensters in der Bühne (Abstände zu den vier Rändern)
  let bw = 0, bh = 0;     // Größe der Bühne
  let stand = -1;

  function messen() {
    const soll = gross.matches && !ruhe.matches;
    if (soll !== gepinnt) {
      gepinnt = soll;
      abschnitt.classList.toggle('gepinnt', soll);
      if (!soll) {
        for (const el of [reel, bild, blatt]) el.removeAttribute('style');
        reel.classList.remove('offen');
        beiFortschritt(0, false);
      }
    }
    if (!gepinnt) return;
    blatt.style.transform = '';
    const b = halt.getBoundingClientRect();
    const f = platz.getBoundingClientRect();
    bw = b.width; bh = b.height;
    fenster = { l: f.left - b.left, o: f.top - b.top, r: b.right - f.right, u: b.bottom - f.bottom };
    stand = -1;
    zeichnen();
  }

  function zeichnen() {
    if (!gepinnt || !fenster) return;
    const p = klemme(-abschnitt.getBoundingClientRect().top / (bh * .9));
    if (p === stand) return;
    stand = p;
    const e = p * p * (3 - 2 * p);
    const l = fenster.l * (1 - e), o = fenster.o * (1 - e), r = fenster.r * (1 - e), u = fenster.u * (1 - e);
    const w = bw - l - r, h = bh - o - u;
    const s = Math.max(w / bw, h / bh);
    reel.style.clipPath = `inset(${o.toFixed(1)}px ${r.toFixed(1)}px ${u.toFixed(1)}px ${l.toFixed(1)}px round ${(4 * (1 - e)).toFixed(1)}px)`;
    bild.style.transform = `translate3d(${(l + w / 2 - bw / 2).toFixed(1)}px, ${(o + h / 2 - bh / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    reel.style.setProperty('--fl', l.toFixed(1) + 'px');
    reel.style.setProperty('--ft', o.toFixed(1) + 'px');
    reel.style.setProperty('--fr', r.toFixed(1) + 'px');
    reel.style.setProperty('--fb', u.toFixed(1) + 'px');
    reel.style.setProperty('--offen', e.toFixed(3));
    reel.classList.toggle('offen', e > .8);
    blatt.style.opacity = (1 - klemme(p * 1.5)).toFixed(3);
    blatt.style.transform = `translate3d(0, ${(-p * bh * .08).toFixed(1)}px, 0)`;
    blatt.style.visibility = p > .67 ? 'hidden' : '';
    beiFortschritt(p, o < 40);
  }

  reel.addEventListener('click', e => {
    if (!gepinnt || reel.classList.contains('offen') || e.target.closest('button')) return;
    scrolleZu(abschnitt.offsetTop + bh * .92);
  });

  gross.addEventListener?.('change', messen);
  addEventListener('resize', messen);
  beiBewegung(zeichnen);
  messen();

  return { messen };
}
