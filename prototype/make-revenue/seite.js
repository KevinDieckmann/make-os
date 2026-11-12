/* ─── MAKE Revenue · Verhalten der Seite ───────────────────────────────────────────────────────────────
   Menü für schmale Fenster, Fläche unter dem Kopf, Erscheinen beim Scrollen, die Strecke, die sich füllt.
   Alles ist Zugabe: Ohne dieses Skript ist die Seite vollständig lesbar und bedienbar.
   Stile nur über Klassen und CSSOM (style.setProperty): kein Inline-Stil, CSP-tauglich. */
(() => {
  'use strict';
  const D = document, H = D.documentElement, W = window;
  const mq = (q) => (W.matchMedia ? W.matchMedia(q) : { matches: false });
  const ruhig = mq('(prefers-reduced-motion: reduce)');

  // ═══ Menü für schmale Fenster ═══
  // <dialog> mit showModal(): Fokusfalle und Escape bringt der Browser mit, der Rest der Seite ist währenddessen stumm.
  const menue = D.getElementById('menue');
  const menueKnopf = D.querySelector('.menue-knopf');
  if (menue && menueKnopf && typeof menue.showModal === 'function') {
    const zu = () => { if (menue.open) menue.close(); };
    menueKnopf.addEventListener('click', () => {
      if (menue.open) { zu(); return; }
      H.classList.add('menue-offen');
      menueKnopf.setAttribute('aria-expanded', 'true');
      menue.showModal();
    });
    menue.addEventListener('close', () => {
      H.classList.remove('menue-offen');
      menueKnopf.setAttribute('aria-expanded', 'false');
    });
    // Ein Ziel gewählt (Verweis, Buchen, E-Mail) oder „Schließen“: erst zu, dann läuft der Klick normal weiter.
    menue.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('a, .menue-zu');
      if (t) zu();
    }, true);
    const breit = mq('(min-width: 1000px)');
    if (breit.addEventListener) breit.addEventListener('change', () => { if (breit.matches) zu(); });
  }

  // ═══ Kopf: Fläche, sobald Inhalt darunter durchläuft ═══
  let gescrollt = null;
  const kopfStand = () => {
    const jetzt = W.scrollY > 12;
    if (jetzt !== gescrollt) { gescrollt = jetzt; H.classList.toggle('gescrollt', jetzt); }
  };

  // ═══ Erscheinen: einmal, wenn ein Baustein ins Bild kommt ═══
  const erscheinende = Array.from(D.querySelectorAll('.erscheint'));
  if ('IntersectionObserver' in W && !ruhig.matches) {
    const spaeher = new IntersectionObserver((liste) => {
      liste.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('da'); spaeher.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    erscheinende.forEach((el) => spaeher.observe(el));
  } else {
    erscheinende.forEach((el) => el.classList.add('da'));
  }

  // ═══ Die Strecke: füllt sich mit dem Scrollen, die Halte werden nacheinander wach ═══
  // Am Rechner läuft die Schiene quer: Sie füllt sich, während der Abschnitt durch das Fenster wandert.
  // Schmal läuft sie von oben nach unten und folgt der Lesehöhe. Bei „Bewegung reduzieren“ bleibt alles gefüllt.
  const bahnen = Array.from(D.querySelectorAll('[data-bahn]')).map((bahn) => ({
    bahn, halte: Array.from(bahn.querySelectorAll('.halt')), p: -1,
  }));
  const schmal = mq('(max-width: 999px)');
  function bahnStand() {
    if (!bahnen.length) return;
    const vh = W.innerHeight;
    bahnen.forEach((z) => {
      const r = z.bahn.getBoundingClientRect();
      let p;
      if (schmal.matches) p = (vh * 0.62 - r.top) / Math.max(1, r.height);
      else p = (vh * 0.86 - r.top) / (vh * 0.5);
      p = Math.max(0, Math.min(1, p));
      if (Math.abs(p - z.p) < 0.002) return;
      z.p = p;
      z.bahn.style.setProperty('--p', p.toFixed(3));
      const gesamt = schmal.matches ? z.bahn.offsetHeight : z.bahn.offsetWidth;
      z.halte.forEach((h) => {
        const ort = (schmal.matches ? h.offsetTop : h.offsetLeft) / Math.max(1, gesamt);
        h.classList.toggle('an', p > 0 && p >= ort + 0.02);
      });
    });
  }
  if (bahnen.length && !ruhig.matches) bahnen.forEach((z) => z.bahn.classList.add('lebt'));

  let wartet = false;
  const beimScrollen = () => {
    if (wartet) return;
    wartet = true;
    W.requestAnimationFrame(() => {
      wartet = false;
      kopfStand();
      if (!ruhig.matches) bahnStand();
    });
  };
  W.addEventListener('scroll', beimScrollen, { passive: true });
  W.addEventListener('resize', beimScrollen, { passive: true });
  kopfStand();
  if (!ruhig.matches) bahnStand();

  W.MAKE_REVENUE_BEREIT = true;
})();
