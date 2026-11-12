/* ─── MAKE Revenue · der Film-Einstieg ───────────────────────────────────────────────────────────────────
   Die Strecke von der Anfrage bis zum Abschluss in acht Szenen, gesteuert allein vom Scrollen.
   EIN Fortschritt p (0 … 1) über die Spur .film. In jedem Bild wird JEDER Zustand neu aus p gerechnet: Szenen, Trichter,
   Beschriftung, Anzeige. Es gibt keinen gemerkten Zustand außer p; nach einem Sprung (Anker, Ende-Taste, Zurückspringen)
   steht deshalb nie etwas Altes. Ausgeblendetes bekommt Deckkraft 0 UND visibility: hidden.
   Stile nur über CSSOM (style.setProperty), mit Merkliste: geschrieben wird nur bei Änderung, und beim Wechsel in die
   ruhige Fassung wird alles wieder entfernt. Die Schleife läuft nur, solange sich p bewegt; außer Sicht steht sie.
   Ruhige Fassung (kein html.film-an): „Bewegung reduzieren“, zu kleines Fenster, fehlende Teile. Dann tut dieses Skript nichts. */
(() => {
  'use strict';
  const D = document, H = D.documentElement, W = window;
  const film = D.querySelector('[data-film]');
  if (!film) return;
  const $ = (s, r) => (r || film).querySelector(s);
  const $$ = (s, r) => Array.from((r || film).querySelectorAll(s));

  // ─── Rechnen ───
  const klemme = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const weich = (t) => { t = klemme(t); return t * t * (3 - 2 * t); };
  const r3 = (x) => Math.round(x * 1000) / 1000;

  // ─── Zeitplan: Scrollweg je Szene (Gewichte). Die Gesamtlänge steht in revenue.css (html.film-an .film). ───
  const PLAN = [['einstieg', 46], ['zahl', 60], ['heute', 84], ['stufe-1', 70], ['stufe-2', 70], ['stufe-3', 70], ['stufe-4', 76], ['ende', 64]];
  const G = {};
  { let s = 0; const summe = PLAN.reduce((x, e) => x + e[1], 0); for (const [name, g] of PLAN) { G[name] = [s / summe, (s + g) / summe]; s += g; } }

  // ─── Teile ───
  const buehne = $('.buehne'), strecke = $('[data-strecke]');
  const szenen = PLAN.map(([name]) => $(`[data-szene="${name}"]`));
  const reihen = [0, 1, 2, 3].map((i) => ({
    grund: $(`[data-grund="${i}"]`), rand: $(`[data-rand="${i}"]`), voll: $(`[data-voll="${i}"]`), fluss: $(`[data-fluss="${i}"]`),
    heute: $(`[data-stufe="${i}"] [data-lage-heute]`), system: $(`[data-stufe="${i}"] [data-lage-system]`),
    paarHeute: $('.paar-heute', szenen[3 + i] || film), paarSystem: $('.paar-system', szenen[3 + i] || film),
  }));
  const ring = $('[data-ring]'), nr = $('[data-film-nr]'), name = $('[data-film-name]'), balken = $('[data-film-balken]');
  const vollstaendig = buehne && strecke && ring && nr && name && balken && szenen.every(Boolean)
    && reihen.every((r, i) => r.grund && r.rand && r.voll && r.heute && r.system && r.paarHeute && r.paarSystem && (i === 3 || r.fluss));
  if (!vollstaendig) { H.classList.remove('film-an'); return; }
  W.MAKE_REVENUE_FILM = true;
  for (const r of reihen) if (r.fluss) r.fluss.setAttribute('pathLength', '1');
  const kapitel = szenen.map((s) => s.getAttribute('data-kapitel') || '');

  // ─── Stil-Speicher ───
  const gestylt = new Map();
  function setze(el, prop, wert) {
    let m = gestylt.get(el);
    if (!m) { m = {}; gestylt.set(el, m); }
    const w = String(wert);
    if (m[prop] === w) return;
    m[prop] = w;
    el.style.setProperty(prop, w);
  }
  // Deckkraft und Sichtbarkeit immer zusammen: Was nicht zu sehen ist, ist auch für Tastatur und Vorleseprogramme weg.
  function zeige(el, o) {
    o = o < 0.004 ? 0 : o > 0.996 ? 1 : r3(o);
    setze(el, 'opacity', o);
    setze(el, 'visibility', o === 0 ? 'hidden' : 'visible');
  }
  function allesZurueck() { gestylt.forEach((_, el) => el.removeAttribute('style')); gestylt.clear(); nrAlt = -1; }

  // ─── Zustand ───
  const ruhigMq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let aktiv = false, p = 0, ziel = 0, laeuft = false, letzte = 0, spanne = 1, oben = 0, schmal = false, nrAlt = -1, messenNoetig = true;
  const lok = (n, a = 0, b = 1) => { const g = G[n], l = g[1] - g[0]; return klemme((p - g[0] - l * a) / (l * (b - a))); };

  function messen() {
    messenNoetig = false;
    schmal = (H.clientWidth || W.innerWidth) < 1000;
    spanne = Math.max(1, film.offsetHeight - buehne.offsetHeight);
    oben = film.getBoundingClientRect().top + W.scrollY;
  }
  const zielLesen = () => klemme((W.scrollY - oben) / spanne);

  // ─── Ein Bild: alles aus p ───
  function zeichne() {
    // Szenen: jede blendet am Anfang ihres Fensters ein und am Ende aus, nie zwei Texte gleichzeitig
    let vorn = 0;
    for (let i = 0; i < szenen.length; i++) {
      const g = G[PLAN[i][0]], l = g[1] - g[0];
      const ein = i === 0 ? 1 : weich((p - g[0]) / (l * 0.16));
      const raus = i === szenen.length - 1 ? 1 : 1 - weich((p - (g[1] - l * 0.13)) / (l * 0.13));
      const o = Math.min(ein, raus);
      zeige(szenen[i], o);
      setze(szenen[i], 'transform', `translate3d(0, ${r3((1 - ein) * 22 - (1 - raus) * 16)}px, 0)`);
      if (p >= g[0]) vorn = i;
    }
    // Der Trichter: Stufe i wird „heute“ brüchig (h), mit System gefüllt (s), dann läuft die Linie zur nächsten Stufe (f)
    for (let i = 0; i < 4; i++) {
      const r = reihen[i], n = 'stufe-' + (i + 1);
      const h = weich(lok('heute', 0.1 + i * 0.16, 0.34 + i * 0.16));
      const s = weich(lok(n, 0.12, 0.5));
      const offen = h * (1 - s);
      setze(r.grund, 'opacity', r3(1 - 0.72 * offen));
      setze(r.rand, 'opacity', r3(offen));
      zeige(r.voll, Math.min(1, s * 3));
      setze(r.voll, 'transform', i < 3 ? `scaleX(${r3(0.06 + 0.94 * s)})` : `scale(${r3(0.3 + 0.7 * s)})`);
      zeige(r.heute, h * (1 - Math.min(1, s * 2.2)));
      zeige(r.system, klemme((s - 0.45) / 0.55));
      if (r.fluss) setze(r.fluss, 'stroke-dashoffset', r3(1 - weich(lok(n, 0.5, 0.94))));
      // im Text der Stufe: erst „Heute“, dann legt sich „Mit System“ darüber
      const t = weich(lok(n, 0.16, 0.46));
      setze(r.paarSystem, 'opacity', r3(t));
      setze(r.paarSystem, 'transform', `translate3d(0, ${r3((1 - t) * 14)}px, 0)`);
      setze(r.paarHeute, 'opacity', r3(1 - 0.3 * t));
    }
    setze(ring, 'opacity', r3(0.6 * weich(lok('ende', 0, 0.5))));
    // Schmal steht der Trichter über dem Text und macht dem Einstieg, der Zahl und dem Schluss Platz; breit steht er immer rechts
    zeige(strecke, schmal ? weich(lok('heute', 0.02, 0.16)) * (1 - weich(lok('stufe-4', 0.9, 1))) : 1);
    // Anzeige
    setze(balken, 'transform', `scaleX(${r3(p)})`);
    if (vorn !== nrAlt) { nrAlt = vorn; nr.textContent = '0' + (vorn + 1); name.textContent = kapitel[vorn]; }
  }

  function bild(jetzt) {
    if (!aktiv) { laeuft = false; return; }
    if (messenNoetig) messen();
    ziel = zielLesen();
    const dt = Math.min(64, jetzt - letzte || 16); letzte = jetzt;
    const weg = ziel - p;
    // Sprünge sofort (Anker, Ende-Taste, Zurückspringen); sonst kurz nachziehen, damit Mausrad-Stufen weich werden
    if (Math.abs(weg) > 0.12 || Math.abs(weg) < 0.0004) p = ziel; else p += weg * (1 - Math.exp(-dt / 80));
    zeichne();
    if (p !== ziel) W.requestAnimationFrame(bild); else laeuft = false;
  }
  function wecken() { if (aktiv && !laeuft) { laeuft = true; letzte = performance.now(); W.requestAnimationFrame(bild); } }

  // ─── An und aus ───
  const erlaubt = () => !(ruhigMq && ruhigMq.matches) && W.innerHeight >= 600 && W.innerWidth >= 340;
  function ein() {
    aktiv = true;
    H.classList.add('film-an');
    messen();
    p = ziel = zielLesen();
    zeichne();
  }
  function aus() {
    aktiv = false;
    H.classList.remove('film-an');
    allesZurueck();
  }
  function pruefen() {
    const soll = erlaubt();
    if (soll && !aktiv) ein(); else if (!soll && aktiv) aus(); else if (aktiv) { messenNoetig = true; wecken(); }
  }
  W.addEventListener('scroll', wecken, { passive: true });
  W.addEventListener('resize', pruefen, { passive: true });
  W.addEventListener('load', () => { messenNoetig = true; wecken(); });
  D.addEventListener('visibilitychange', () => { if (!D.hidden) { messenNoetig = true; wecken(); } });
  if (ruhigMq) { if (ruhigMq.addEventListener) ruhigMq.addEventListener('change', pruefen); else if (ruhigMq.addListener) ruhigMq.addListener(pruefen); }
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { messenNoetig = true; wecken(); });
  if (erlaubt()) ein(); else H.classList.remove('film-an');
})();
