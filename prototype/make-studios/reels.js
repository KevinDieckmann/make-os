/* ─── MAKE Studios · Reels ─────────────────────────────────────────────────────────────────────────
   Die Beispiel-Reels im Abschnitt „Reels“ (#reels). Im HTML steht nur das Poster; die Datei wird erst geholt,
   wenn ein Handy im Bild ist. Stumm, in Schleife, playsinline. Außerhalb des Bilds ist Pause, am Handy (schmale Fenster) spielt nur das Reel in der Mitte, sonst laufen höchstens drei
   gleichzeitig. Bei „Bewegung reduzieren“, im Datensparmodus oder wenn die Bewegung angehalten ist (MAKE.halt aus seite.js)
   läuft nichts von selbst: Poster mit Abspielknopf. Am Rechner blättert die Bahn mit Pfeilen, Pfeiltasten oder Ziehen. Ohne JavaScript bleibt das Poster stehen und die Bahn lässt sich wischen. */
(() => {
  'use strict';
  const D = document, W = window;
  const M = W.MAKE || {};
  const mq = (q) => (W.matchMedia ? W.matchMedia(q) : { matches: false });
  const ruhig = mq('(prefers-reduced-motion: reduce)');
  const netz = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const sparen = () => !!(netz && (netz.saveData || /(^|-)2g$/.test(netz.effectiveType || ''))) || mq('(prefers-reduced-data: reduce)').matches;
  const HOECHSTENS = 3;
  const flaechen = Array.from(D.querySelectorAll('[data-reel]'));
  if (!flaechen.length || !('IntersectionObserver' in W)) return;

  const reels = flaechen.map((el) => ({
    el, quelle: el.getAttribute('data-reel'), name: el.getAttribute('data-reel-name') || '', video: null, knopf: null,
    imBild: false, hand: '', kaputt: false,
  }));
  const vonSelbst = () => !ruhig.matches && !sparen() && !(M.halt && M.halt.ist()) && !D.hidden;
  const beschriften = (r, laeuft) => {
    r.el.classList.toggle('laeuft', laeuft);
    r.knopf.setAttribute('aria-label', (laeuft ? 'Anhalten: ' : 'Abspielen: ') + 'Beispiel-Reel ' + r.name.replace(/&amp;/g, '&'));
  };
  function videoAnlegen(r) {
    if (r.video || r.kaputt) return r.video;
    const v = D.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.tabIndex = -1;
    v.setAttribute('aria-hidden', 'true');
    v.addEventListener('playing', () => beschriften(r, true));
    v.addEventListener('pause', () => beschriften(r, false));
    v.addEventListener('error', () => {
      r.kaputt = true; r.video = null;
      if (v.parentNode) v.parentNode.removeChild(v);
      beschriften(r, false);
    });
    v.src = r.quelle;
    r.el.insertBefore(v, r.knopf);
    r.video = v;
    return v;
  }
  // Schmale Fenster: die Reels liegen wischbar nebeneinander, nur das in der Mitte spielt
  const eng = () => mq('(max-width: 640px)').matches;
  function mitte(r) { const b = r.el.getBoundingClientRect(); return Math.abs(b.left + b.width / 2 - W.innerWidth / 2); }
  function ordnen() {
    const frei = vonSelbst();
    const wunsch = reels.filter((r) => !r.kaputt && r.imBild && r.hand !== 'aus' && (r.hand === 'an' || frei));
    wunsch.sort((a, b) => (b.hand === 'an') - (a.hand === 'an') || mitte(a) - mitte(b));
    reels.forEach((r) => {
      const i = wunsch.indexOf(r);
      if (i > -1 && i < (eng() ? 1 : HOECHSTENS)) {
        const v = videoAnlegen(r);
        if (v && v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => { /* Poster bleibt */ }); }
      } else if (r.video && !r.video.paused) r.video.pause();
    });
  }
  const sicht = new IntersectionObserver((liste) => {
    liste.forEach((e) => {
      const r = reels.find((x) => x.el === e.target);
      if (!r) return;
      r.imBild = e.isIntersecting && e.intersectionRatio >= .35;
      if (!r.imBild && r.hand === 'an') r.hand = '';
    });
    ordnen();
  }, { threshold: [0, .35, .7] });

  reels.forEach((r) => {
    const k = D.createElement('button');
    k.type = 'button'; k.className = 'reel-knopf';
    r.el.appendChild(k);
    r.knopf = k;
    beschriften(r, false);
    k.addEventListener('click', () => {
      const laeuft = r.video && !r.video.paused;
      if (laeuft) r.hand = 'aus'; else { r.hand = 'an'; r.imBild = true; }
      ordnen();
    });
    sicht.observe(r.el);
  });
  if (M.halt && M.halt.hoeren) M.halt.hoeren((an) => { if (an) reels.forEach((r) => { if (r.hand === 'an') r.hand = ''; }); ordnen(); });
  D.addEventListener('visibilitychange', ordnen);
  const bahn = D.querySelector('.reels-bahn'); let wartet = false;
  if (bahn) bahn.addEventListener('scroll', () => { if (wartet) return; wartet = true; W.requestAnimationFrame(() => { wartet = false; ordnen(); }); }, { passive: true });
  // Blättern am Rechner: Pfeile, Pfeiltasten, Ziehen mit der Maus
  if (bahn) {
    const schritt = () => { const a = bahn.querySelector('.reel'); return a ? a.getBoundingClientRect().width + 18 : 320; };
    const blaettern = (richtung) => bahn.scrollBy({ left: richtung * schritt() * 2, behavior: ruhig.matches ? 'auto' : 'smooth' });
    const pfeile = D.createElement('div'); pfeile.className = 'reels-pfeile';
    const machen = (text, label, richtung) => {
      const b = D.createElement('button'); b.type = 'button'; b.className = 'reels-pfeil'; b.textContent = text; b.setAttribute('aria-label', label);
      b.addEventListener('click', () => blaettern(richtung)); pfeile.appendChild(b); return b;
    };
    const zurueck = machen('←', 'Reels zurückblättern', -1), weiter = machen('→', 'Reels weiterblättern', 1);
    bahn.parentNode.insertBefore(pfeile, bahn.nextSibling);
    const stand = () => { const m = bahn.scrollWidth - bahn.clientWidth; zurueck.disabled = bahn.scrollLeft < 4; weiter.disabled = bahn.scrollLeft > m - 4 || m < 8; };
    bahn.addEventListener('scroll', stand, { passive: true }); W.addEventListener('resize', stand); stand();
    bahn.tabIndex = 0;
    bahn.addEventListener('keydown', (e) => {
      if (e.target !== bahn) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); blaettern(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); blaettern(-1); }
    });
    let start = null, weg = 0, links = 0, bewegt = false;
    bahn.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; start = e.clientX; links = bahn.scrollLeft; weg = 0; bewegt = false; });
    W.addEventListener('pointermove', (e) => {
      if (start === null) return;
      weg = e.clientX - start;
      if (!bewegt && Math.abs(weg) > 6) { bewegt = true; bahn.classList.add('zieht'); }
      if (bewegt) bahn.scrollLeft = links - weg;
    });
    const ende = () => { if (start === null) return; start = null; if (bewegt) { bahn.classList.remove('zieht'); const s = schritt(); bahn.scrollTo({ left: Math.round(bahn.scrollLeft / s) * s, behavior: 'smooth' }); } };
    W.addEventListener('pointerup', ende); W.addEventListener('pointercancel', ende);
    bahn.addEventListener('click', (e) => { if (bewegt) { e.preventDefault(); e.stopPropagation(); bewegt = false; } }, true);
  }
  if (ruhig.addEventListener) ruhig.addEventListener('change', ordnen);
})();
