/* ─── MAKE Revenue · Verhalten der Seite ───────────────────────────────────────────────────────────────
   Menü für schmale Fenster, Fläche und Farbe des Kopfes, Erscheinen beim Scrollen, die feste Leiste mit dem Hauptknopf am Handy.
   Die Stücke zum Anfassen stehen in anfassen.js, der Rechner in rechner.js, das Buchungsfenster in buchen.js.
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
  // Jede Seite beginnt mit einem dunklen Einstieg ([data-dunkelkopf]). Solange dessen Unterkante
  // unter der Mitte des Kopfes liegt, bleibt der Kopf dunkel.
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

  // ═══ Handy: der Hauptknopf als feste Leiste unten ═══
  // Erst nach dem ersten Bildschirm, nie über dem Schluss der Seite (dort steht der Knopf groß) und nie über einem offenen Fenster.
  const leiste = D.querySelector('[data-leiste]'), schluss = D.getElementById('kontakt');
  let leisteDa = null, schlussInSicht = false;
  if (leiste) {
    leiste.hidden = false;
    if (schluss && 'IntersectionObserver' in W) new IntersectionObserver((l) => { schlussInSicht = l[0].isIntersecting; leisteStand(); }, { threshold: 0.12 }).observe(schluss);
  }
  function leisteStand() {
    if (!leiste) return;
    const da = W.scrollY > W.innerHeight * 0.7 && !schlussInSicht;
    if (da !== leisteDa) { leisteDa = da; H.classList.toggle('leiste-da', da); }
  }

  let wartet = false;
  const beimScrollen = () => {
    if (wartet) return;
    wartet = true;
    W.requestAnimationFrame(() => {
      wartet = false;
      kopfStand();
      leisteStand();
    });
  };
  W.addEventListener('scroll', beimScrollen, { passive: true });
  W.addEventListener('resize', beimScrollen, { passive: true });
  kopfStand();
  leisteStand();

  // ═══ Fragen: im HTML offen (ohne Skript alles lesbar), mit Skript zu ═══
  D.querySelectorAll('details[data-faq]').forEach((d) => { d.open = false; });

  // ═══ Handy kürzer: Zuklappbares (details.mobil-zu, details.einwand-zu) ist breit und ohne Skript offen, unter 701 px zu ═══
  // Ausnahme: data-offen (der erste Einwand). Beim Wechsel zurück auf breit öffnet alles wieder.
  const zu = D.querySelectorAll('details.mobil-zu, details.einwand-zu');
  if (zu.length) {
    const schmal = mq('(max-width: 700px)');
    const stand = () => zu.forEach((d) => { d.open = !schmal.matches || d.hasAttribute('data-offen'); });
    stand();
    if (schmal.addEventListener) schmal.addEventListener('change', stand);
    // Ein Sprung zu einem Anker im Zugeklappten (z. B. #wochenreport) öffnet es.
    const oeffnen = () => { const t = W.location.hash && D.getElementById(W.location.hash.slice(1)); const d = t && t.closest && t.closest('details'); if (d) d.open = true; const i = t && t.querySelector && t.querySelector('details.mobil-zu'); if (i) i.open = true; };
    W.addEventListener('hashchange', oeffnen); oeffnen();
  }

  W.MAKE_REVENUE_BEREIT = true;
})();
