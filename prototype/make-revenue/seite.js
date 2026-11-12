/* ─── MAKE Revenue · Verhalten der Seite ───────────────────────────────────────────────────────────────
   Menü für schmale Fenster, Fläche und Farbe des Kopfes, Erscheinen beim Scrollen, Filmplätze (echte Filme erst in Sicht).
   Der Film-Einstieg der Startseite steht in film.js, die Stücke zum Anfassen in anfassen.js.
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

  // ═══ Kopf: Fläche, sobald Inhalt darunter durchläuft; dunkel über dem dunklen Einstieg, danach hell ═══
  // Jede Seite beginnt mit einem dunklen Einstieg ([data-dunkelkopf]: Film oder Seitenkopf). Solange dessen Unterkante
  // unter der Mitte des Kopfes liegt, bleibt der Kopf dunkel. Das gilt auch, wenn die Bühne des Films am Ende nach oben wegläuft.
  const kopf = D.querySelector('.kopf'), dunkelTeil = D.querySelector('[data-dunkelkopf]');
  let gescrollt = null, hell = null;
  const kopfStand = () => {
    const jetzt = W.scrollY > 12;
    if (jetzt !== gescrollt) { gescrollt = jetzt; H.classList.toggle('gescrollt', jetzt); }
    const h = !dunkelTeil || dunkelTeil.getBoundingClientRect().bottom <= (kopf ? kopf.offsetHeight : 72) / 2;
    if (h !== hell) { hell = h; H.classList.toggle('kopf-hell', h); }
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

  // ═══ Filmplätze: echte Filme (Symbolbilder) ═══
  // Im HTML steht nur das Poster. Der Film wird erst geholt, wenn sein Platz in Sicht kommt: stumm, in Schleife, ohne Bedienleiste,
  // preload="none". Außer Sicht hält er an. Der Knopf hält ihn dauerhaft an. Bei „Bewegung reduzieren“ oder Datensparen bleibt das Poster.
  const plaetze = Array.from(D.querySelectorAll('[data-filmplatz]'));
  const sparen = !!(navigator.connection && navigator.connection.saveData);
  if (plaetze.length && 'IntersectionObserver' in W && !sparen) {
    const stand = new Map();
    const ordnen = (z) => {
      const soll = z.sicht && !z.halt && !ruhig.matches && !D.hidden;
      if (soll && !z.video) {
        const v = D.createElement('video');
        v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = 'none';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
        v.disablePictureInPicture = true;
        v.addEventListener('playing', () => { if (z.video === v) z.el.classList.add('laeuft'); });
        v.addEventListener('error', () => { if (z.video === v) { z.kaputt = true; z.el.classList.remove('laeuft'); v.remove(); z.video = null; if (z.knopf) z.knopf.hidden = true; } });
        v.src = z.el.getAttribute('data-filmplatz');
        const poster = z.flaeche.querySelector('.filmplatz-poster');
        if (poster) poster.after(v); else z.flaeche.prepend(v);
        z.video = v;
        if (z.knopf) z.knopf.hidden = false;
      }
      if (!z.video) return;
      if (soll) { const p = z.video.play(); if (p && p.catch) p.catch(() => {}); } else z.video.pause();
      if (ruhig.matches) { z.el.classList.remove('laeuft'); if (z.knopf) z.knopf.hidden = true; } else if (z.knopf) z.knopf.hidden = false;
    };
    const waechter = new IntersectionObserver((liste) => {
      liste.forEach((e) => { const z = stand.get(e.target); if (z && !z.kaputt) { z.sicht = e.isIntersecting; ordnen(z); } });
    }, { rootMargin: '120px 0px', threshold: 0.01 });
    plaetze.forEach((el) => {
      const z = { el, flaeche: el.querySelector('.filmplatz-flaeche'), knopf: el.querySelector('.filmplatz-pause'), video: null, sicht: false, halt: false, kaputt: false };
      if (!z.flaeche) return;
      stand.set(el, z);
      if (z.knopf) z.knopf.addEventListener('click', () => {
        z.halt = !z.halt;
        z.knopf.setAttribute('aria-pressed', String(z.halt));
        const wort = z.knopf.querySelector('.vh'); if (wort) wort.textContent = z.halt ? 'Film abspielen' : 'Film anhalten';
        ordnen(z);
      });
      waechter.observe(el);
    });
    const alle = () => stand.forEach(ordnen);
    D.addEventListener('visibilitychange', alle);
    if (ruhig.addEventListener) ruhig.addEventListener('change', alle);
  }

  let wartet = false;
  const beimScrollen = () => {
    if (wartet) return;
    wartet = true;
    W.requestAnimationFrame(() => {
      wartet = false;
      kopfStand();
    });
  };
  W.addEventListener('scroll', beimScrollen, { passive: true });
  W.addEventListener('resize', beimScrollen, { passive: true });
  kopfStand();

  W.MAKE_REVENUE_BEREIT = true;
})();
