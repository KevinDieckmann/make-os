// MAKE Innovation · Szene — Spur: Baukasten für ein Scroll-Showreel (04.10.2026)
// Eine hohe Spur (.spur) mit einer stehenden Bühne (.buehne, sticky). EIN normierter Fortschritt p (0 → 1) über die Spur,
// geglättet durch eine kritisch gedämpfte Feder (kern.feder) — keine Keyframes für Scroll-Dinge: JEDER bewegte Wert ist eine
// reine Funktion von p (Phasen mit clamp/smoothstep), gerechnet in jedem Bild (requestAnimationFrame). Was wann geschieht,
// legt die Seite in ihrem Drehbuch fest (js/drehbuch.js › bild(p, w)); dieser Baukasten kennt keine Inhalte und ist für andere
// Seiten (fokus/) wiederverwendbar.
//
// Was der Baukasten mitbringt:
//   · Vorhang beim Laden: der Knoten aus dem Logo über einer sanften Blüte (Granat/Smaragd), hebt nach `dauer` ms ab (Bewegung
//     reduzieren: 0,7 s, ohne Bewegung). Ohne Skript gibt es ihn nicht; wer scrollt oder eine Taste drückt, hebt ihn sofort.
//   · Stufen je Fenster (rechner quer · tablet hoch ≤ 1024 · handy < 640) — Größen kommen aus dem CSS (--sr-*), eine Quelle.
//   · Werkzeuge für das Drehbuch: sicht, stil, Buchstaben (Zerfall nach unten / Aufstieg), Karussell (nach cos sortiert), Band,
//     Flug, Rasten (Lesezeit im Karussell), Zahlen-Trommel am Fortschritt, Maus (weich), Szene steuern (Motor, extern).
//   · Anker in der Spur (cfg.anker: id → p) fahren an die passende Stelle; springt der Tastatur-Fokus in einen Block mit
//     data-spur-p, fährt die Seite dorthin — nichts ist unerreichbar, auch wenn es gerade unsichtbar ist.
//   · Ruhige Fassung: ohne Skript, bei „Bewegung reduzieren“, ohne WebGL oder wenn die Szene scheitert (html.ohne-szene) steht
//     alles untereinander (das CSS ohne html.spur-an) — der Baukasten nimmt dann alle gesetzten Stile wieder heraus.
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};

  // ── Reine Teile (ohne Seite testbar, tests/website-landingpage.test.ts) ──
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const weich = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const lerp = (a, b, u) => a + (b - a) * u;
  /** Phase: 0 vor a, 1 nach b, dazwischen weich. */
  const ph = (p, a, b) => weich((p - a) / (b - a));
  /** Rasten: u (0…1) über n Schritte — in jedem Schritt steht der Wert den Anteil `halten` still (Lesezeit). Ergebnis 0…n. */
  function rasten(u, n, halten) {
    const x = clamp(u, 0, 1) * n, k = Math.min(n - 1, Math.floor(x)), f = x - k, h = clamp(halten, 0, .95) / 2;
    return k + weich((f - h) / (1 - 2 * h));
  }
  /** Fortschritt p → Zustand T der Szene (0 … n−1). Je Zustand [von, bis]: dort steht er (T = i), dazwischen gleitet T weich. */
  function zuT(p, lagen) {
    if (!lagen.length || p <= lagen[0][1]) return 0;
    for (let i = 1; i < lagen.length; i++) {
      if (p < lagen[i][0]) return i - 1 + weich((p - lagen[i - 1][1]) / Math.max(1e-6, lagen[i][0] - lagen[i - 1][1]));
      if (p <= lagen[i][1]) return i;
    }
    return lagen.length - 1;
  }
  /** Stufe des Fensters: handy (< 640) · tablet (≤ 1024 und hoch) · rechner. */
  const stufe = (b, h) => b < 640 ? 'handy' : b <= 1024 && h >= b ? 'tablet' : 'rechner';
  /** Karussell: Karte i von n bei Drehung d (Grad) → Winkel, cos (vorn = 1) und Stapelfolge. */
  function karte(i, n, d) {
    const winkel = i * 360 / n + d, cos = Math.cos(winkel * Math.PI / 180);
    return { winkel, cos, stapel: Math.round(cos * 100) + 200 };
  }
  /** Zahlen-Trommel am Fortschritt: u (0…1) → angezeigte Zahl (ausrollend wie easeOutQuint) und wie weit sie noch läuft. */
  function trommelAm(wert, u) {
    const q = 1 - Math.pow(1 - clamp(u, 0, 1), 5), zahl = Math.round(wert * q);
    return { zahl, rest: wert ? 1 - zahl / wert : 0 };
  }
  /** Buchstabe i von n: eigener Fortschritt in einer Phase (von, bis), gestaffelt von links nach rechts (Anteil `staffel`). */
  function gestaffelt(p, von, bis, i, n, staffel) {
    const lang = (bis - von) * (1 - staffel), start = von + (bis - von) * staffel * (n > 1 ? i / (n - 1) : 0);
    return ph(p, start, start + lang);
  }
  const rein = { clamp, weich, lerp, ph, rasten, zuT, stufe, karte, trommelAm, gestaffelt };
  S.spur = Object.assign({}, rein);
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const html = document.documentElement;
  const ruhig = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function webglDa() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && c.getContext('webgl')); } catch (e) { return false; }
  }

  /** Vorhang: Knoten (links Granat, rechts Smaragd) über einer Blüte; hebt nach `dauer` ms ab. */
  function vorhang(dauer) {
    const ns = 'http://www.w3.org/2000/svg', v = document.createElement('div'), bluete = document.createElement('div'), svg = document.createElementNS(ns, 'svg');
    v.className = 'vorhang'; v.setAttribute('aria-hidden', 'true'); bluete.className = 'vorhang-bluete';
    svg.setAttribute('viewBox', '0 0 24 10'); svg.setAttribute('class', 'vorhang-knoten'); svg.setAttribute('focusable', 'false');
    // Wie im Logo: roter Strich, linke Knotenhälfte Granat, rechte Smaragd, grüner Strich.
    for (const [art, a, klasse] of [['rect', { x: 0, y: 4.25, width: 5.5, height: 1.5 }, 'k-ma'], ['path', { d: 'M12 0A5 5 0 0 0 12 10Z' }, 'k-ma'],
      ['path', { d: 'M12 0A5 5 0 0 1 12 10Z' }, 'k-ke'], ['rect', { x: 18.5, y: 4.25, width: 5.5, height: 1.5 }, 'k-ke']]) {
      const el = document.createElementNS(ns, art);
      for (const [k, w] of Object.entries(a)) el.setAttribute(k, String(w));
      el.setAttribute('class', klasse); svg.appendChild(el);
    }
    v.appendChild(bluete); v.appendChild(svg); document.body.appendChild(v);
    html.classList.add('vorhang-zu');
    let fertig = false;
    const ab = () => {
      if (fertig) return; fertig = true;
      v.classList.add('ab'); html.classList.remove('vorhang-zu');
      for (const t of ['wheel', 'touchmove', 'keydown']) window.removeEventListener(t, ab);
      setTimeout(() => v.remove(), 1200);
    };
    for (const t of ['wheel', 'touchmove', 'keydown']) window.addEventListener(t, ab, { passive: true });
    setTimeout(ab, dauer);
  }

  /**
   * Startet ein Showreel. cfg:
   *   spur, buehne    Selektoren (Standard .spur / .buehne)
   *   vorhang         { dauer, ruhig } in ms (false = keiner)
   *   szene           { zustaende: [{ name, p, bis }], ruht(p) → true, solange die Bühne die Szene verdeckt } — steuert js/szene/motor.js
   *                   (der Zustand steht von p bis bis; dazwischen fährt die Kamera weich zum nächsten)
   *   anker           { id: p } — Links auf #id fahren in der Spur an p (Blöcke mit data-spur-p brauchen keinen Eintrag)
   *   messen(w)       eigene Maße der Seite (nach jeder Größenänderung)
   *   bild(p, w)      setzt in jedem Bild alles, was sich bewegt (reine Funktion von p — und der Maus)
   * Gibt { aus } zurück oder null (ruhige Fassung).
   */
  function starten(cfg) {
    const still = ruhig();
    if (cfg.vorhang !== false) vorhang(still ? (cfg.vorhang && cfg.vorhang.ruhig) || 700 : (cfg.vorhang && cfg.vorhang.dauer) || 1800);
    const spur = document.querySelector(cfg.spur || '.spur'), buehne = spur && spur.querySelector(cfg.buehne || '.buehne');
    if (!spur || !buehne || still || !webglDa() || html.classList.contains('ohne-szene')) return null;
    html.classList.add('spur-an');
    const huelle = document.querySelector('.szene');
    const gesetzt = new Set(); // alles, dem der Baukasten Stile gibt (für die ruhige Fassung wieder heraus)
    const fokussierbar = new WeakMap();

    // ── Werkzeuge für das Drehbuch ──
    const w = {
      p: 0, dt: .016, zeit: 0, vw: 1, vh: 1, stufe: 'rechner', maus: { x: 0, y: 0 }, oben: 0, laenge: 1,
      clamp, weich, lerp, ph, rasten, karte, gestaffelt,
      /** Deckkraft; ganz aus = unsichtbar (Blöcke mit Links bleiben im Fokus erreichbar: data-spur-p fährt hin). */
      sicht(el, o) {
        if (!el) return;
        gesetzt.add(el);
        const s = o.toFixed(3); if (el.style.opacity !== s) el.style.opacity = s;
        if (!fokussierbar.has(el)) fokussierbar.set(el, !!el.querySelector('a, button') || el.matches('a, button'));
        const v = o < .003 && !fokussierbar.get(el) ? 'hidden' : ''; if (el.style.visibility !== v) el.style.visibility = v;
        const pe = o < .5 ? 'none' : ''; if (el.style.pointerEvents !== pe) el.style.pointerEvents = pe;
      },
      /** Transformation und (optional) Unschärfe in px. */
      stil(el, transform, unschaerfe) {
        if (!el) return;
        gesetzt.add(el);
        if (el.style.transform !== transform) el.style.transform = transform;
        const f = unschaerfe > .05 ? `blur(${unschaerfe.toFixed(1)}px)` : '';
        if (el.style.filter !== f) el.style.filter = f;
      },
      /** CSS-Variable setzen (z. B. --loch für die Maske). */
      variable(el, name, wert) { if (!el) return; gesetzt.add(el); el.style.setProperty(name, wert); },
      /** Überschrift in Buchstaben zerlegen (für Vorleser bleibt sie ein Satz — MakeSzene.buehne.zerlegen aus dem Motor). */
      buchstaben(el) {
        if (!el || !S.buehne) return [];
        const { buchstaben, zurueck } = S.buehne.zerlegen(el, document, 'unsichtbar');
        rueck.push(zurueck); el.classList.add('zerlegt');
        return buchstaben;
      },
      /** Buchstaben gleiten verschwommen nach unten weg (Zerfall) — gestaffelt von links. */
      zerfall(bs, p, von, bis) {
        const n = bs.length;
        bs.forEach((b, i) => { const u = gestaffelt(p, von, bis, i, n, .55); w.stil(b, u > .001 ? `translate3d(0, ${(u * 0.9).toFixed(3)}em, 0)` : '', u * 12); b.style.opacity = (1 - u).toFixed(3); });
      },
      /** Buchstaben steigen einer nach dem anderen aus der Unschärfe auf. */
      aufstieg(bs, p, von, bis) {
        const n = bs.length;
        bs.forEach((b, i) => { const u = 1 - gestaffelt(p, von, bis, i, n, .6); w.stil(b, u > .001 ? `translate3d(0, ${(u * .55).toFixed(3)}em, 0)` : '', u * 10); b.style.opacity = (1 - u).toFixed(3); });
      },
      /** Zahl am Fortschritt hochzählen (unscharf, solange sie läuft). ziffer = span.trommel-ziffer. */
      trommel(t, u) {
        const st = trommelAm(t.wert, u);
        if (st.zahl !== t.zahl) { t.zahl = st.zahl; t.ziffer.textContent = String(st.zahl); }
        w.stil(t.ziffer, st.rest > .002 ? `translate3d(0, ${(st.rest * .4).toFixed(3)}em, 0)` : '', st.rest * 6);
      },
      /** Zahlen in .trommel .wert vorbereiten: unsichtbare Kopie für Vorleser + Ziffer (aria-hidden). */
      trommeln(wurzelEl) {
        return Array.from(wurzelEl.querySelectorAll('.trommel .wert'), el => {
          const t = el.firstChild, m = t && t.nodeType === 3 ? /^(\d+)([\s\S]*)$/.exec(t.nodeValue) : null;
          if (!m) return null;
          const lesen = document.createElement('span'), ziffer = document.createElement('span'), rest = document.createElement('span');
          lesen.className = 'unsichtbar'; lesen.textContent = t.nodeValue.replace(/\s+/g, ' ');
          ziffer.className = 'trommel-ziffer'; ziffer.setAttribute('aria-hidden', 'true'); ziffer.textContent = '0';
          rest.setAttribute('aria-hidden', 'true'); rest.textContent = m[2];
          el.insertBefore(lesen, t); el.insertBefore(ziffer, t); el.insertBefore(rest, t); el.removeChild(t);
          rueck.push(() => { el.insertBefore(t, lesen); lesen.remove(); ziffer.remove(); rest.remove(); });
          return { el, ziffer, wert: +m[1], zahl: 0 };
        }).filter(Boolean);
      },
      /** Szene (js/szene/motor.js) auf Zustand T stellen und ruhen lassen, solange sie verdeckt ist. */
      szene(T, ruht) {
        S.fortschritt = T;
        if (huelle && ruht !== huelle.hasAttribute('data-ruht')) ruht ? huelle.setAttribute('data-ruht', '') : huelle.removeAttribute('data-ruht');
      },
      /** Fließender Verlauf (js/szene/verlauf.js) auf einer Leinwand der Bühne. */
      verlauf(canvas, opt) { const v = S.verlauf && canvas ? S.verlauf.erstellen(canvas, opt) : null; if (v) verlaeufe.push(v); return v; },
    };
    const rueck = [], verlaeufe = [];

    // ── Maße (Layout-Boxen, nie Transformationen) ──
    function messen() {
      w.vw = window.innerWidth; w.vh = window.innerHeight; w.stufe = stufe(w.vw, w.vh);
      w.oben = spur.getBoundingClientRect().top + window.scrollY;
      w.laenge = Math.max(1, spur.offsetHeight - w.vh);
      for (const v of verlaeufe) v.groesse();
      if (cfg.messen) cfg.messen(w);
      zuletzt = -1;
    }
    let zuletzt = -1;
    const pVon = y => clamp((y - w.oben) / w.laenge, 0, 1);
    const fahre = p => window.scrollTo({ top: Math.round(w.oben + p * w.laenge), behavior: ruhig() ? 'auto' : 'smooth' });

    // ── Maus: weich, nur Zeiger mit Hover (am Handy aus) ──
    const mausZiel = { x: 0, y: 0 };
    if (window.matchMedia('(hover: hover)').matches) window.addEventListener('pointermove', e => { mausZiel.x = e.clientX / w.vw * 2 - 1; mausZiel.y = 1 - e.clientY / w.vh * 2; }, { passive: true });

    // ── Anker und Tastatur-Fokus ──
    const anker = cfg.anker || {};
    function klick(e) {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || !html.classList.contains('spur-an')) return;
      const id = a.getAttribute('href').slice(1), ziel = id && document.getElementById(id);
      const block = ziel && ziel.closest('.spur [data-spur-p]'); // ein Block der Bühne weiß selbst, wo er steht
      const p = block ? +block.dataset.spurP : anker[id];
      if (p === undefined || Number.isNaN(p)) return;
      e.preventDefault(); fahre(p);
      if (history.replaceState) history.replaceState(null, '', `#${id}`);
    }
    function fokus(e) {
      const block = e.target.closest && e.target.closest('.spur [data-spur-p]');
      if (!block || !html.classList.contains('spur-an') || !e.target.matches(':focus-visible')) return; // nur Tastatur, nicht der Mausklick
      const p = +block.dataset.spurP;
      if (Math.abs(pVon(window.scrollY) - p) > .004) window.scrollTo({ top: Math.round(w.oben + p * w.laenge), behavior: 'auto' });
    }
    document.addEventListener('click', klick);
    document.addEventListener('focusin', fokus);

    // ── Szene: Zustände am Fortschritt ──
    const lagen = cfg.szene ? cfg.szene.zustaende.map(z => [z.p, z.bis ?? z.p]) : [];

    if (cfg.vorbereiten) cfg.vorbereiten(w);
    messen();
    const lauf = { wert: pVon(window.scrollY), v: 0 };
    let letzte = 0, an = true;
    window.addEventListener('resize', messen);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(messen);
    window.addEventListener('load', messen);
    const start = location.hash ? document.getElementById(location.hash.slice(1)) : null, startBlock = start && start.closest('.spur [data-spur-p]');
    const startP = startBlock ? +startBlock.dataset.spurP : location.hash ? anker[location.hash.slice(1)] : undefined;
    if (startP !== undefined) requestAnimationFrame(() => { messen(); window.scrollTo(0, Math.round(w.oben + startP * w.laenge)); });

    function bild(jetzt) {
      if (!an) return;
      if (html.classList.contains('ohne-szene')) { aus(); return; } // die Szene ist gescheitert → ruhige Fassung
      const dt = Math.min(.1, letzte ? (jetzt - letzte) / 1000 : .016); letzte = jetzt; w.zeit += dt; w.dt = dt;
      const ziel = pVon(window.scrollY);
      if (Math.abs(ziel - lauf.wert) > .2) { lauf.wert = ziel; lauf.v = 0; } // große Sprünge (Anker) sofort
      const p = S.kern ? S.kern.feder(lauf, ziel, dt, .18) : ziel;
      const m = w.maus, k = Math.min(1, dt * 2.5);
      m.x += (mausZiel.x - m.x) * k; m.y += (mausZiel.y - m.y) * k;
      const bewegt = Math.abs(mausZiel.x - m.x) + Math.abs(mausZiel.y - m.y) > .001;
      w.p = p;
      if (cfg.szene) w.szene(zuT(p, lagen), cfg.szene.ruht(p));
      if (p !== zuletzt || bewegt || cfg.immer) { zuletzt = p; cfg.bild(p, w); }
      for (const v of verlaeufe) v.zeichnen(w.zeit, m);
      requestAnimationFrame(bild);
    }
    requestAnimationFrame(bild);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) letzte = 0; });

    /** Ruhige Fassung: alle gesetzten Stile heraus, Buchstaben und Zahlen zurück, Verläufe aus. */
    function aus() {
      an = false; html.classList.remove('spur-an');
      for (const v of verlaeufe) v.halt();
      for (const el of gesetzt) { el.removeAttribute('style'); }
      for (const z of rueck.splice(0)) z();
      for (const el of document.querySelectorAll('.zerlegt')) el.classList.remove('zerlegt');
      if (huelle) huelle.removeAttribute('data-ruht');
      document.removeEventListener('click', klick); document.removeEventListener('focusin', fokus);
      if (cfg.aus) cfg.aus();
    }
    return { aus, w };
  }

  S.spur = Object.assign({}, rein, { starten });
})(typeof window !== 'undefined' ? window : globalThis);
