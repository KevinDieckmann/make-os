// Fokus Innovation · Event-Seite: Lichtfäden im Held (03.10.2026)
// Zwei Bündel feiner Fäden — Granat und Smaragd, die Farben der Synapse im MAKE-Logo: Granat kommt von links und läuft in
// den Knoten, Smaragd verlässt ihn nach rechts. Der Knoten selbst ist ein SVG in der Seite (.knoten-gross); die Fäden enden
// mit einem schmalen Spalt davor und dahinter, wie an einer Synapse.
//   · Zeichner und Mathematik: js/lichtfaeden.js (erzeugt aus lib/lichtfaeden — dieselben Parameter wie in der App und auf
//     makeinnovation.de; nie von Hand ändern, node scripts/fokus-seite.mjs).
//   · Pausiert außerhalb des Bildes und im verborgenen Tab; prefers-reduced-motion: ein Standbild.
// Liest nichts aus, speichert nichts, sendet nichts (fokus/pruefen.mjs prüft das).
(() => {
  'use strict';
  const L = globalThis.Lichtfaeden; if (!L) return;
  const held = document.querySelector('.held'); if (!held) return;
  const canvas = held.querySelector('canvas.faeden');
  const knoten = held.querySelector('.knoten-gross');
  if (!canvas || !canvas.getContext || !knoten) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;

  const ruhig = L.bewegungReduziert();
  const handyAbfrage = matchMedia('(max-width: 900px)');
  const GRANAT = '#C9465C', SMARAGD = '#2FA878';
  let W = 0, H = 0, handy = false, buendel = [];

  /** Leitkurven aus der Lage des Knotens; Werte je Anker: [Spreizung in px, Helligkeit]. */
  function vermessen() {
    handy = handyAbfrage.matches;
    W = held.clientWidth; H = held.clientHeight;
    L.leinwand(canvas, W, H, handy ? 2 : 1.5);
    const hr = held.getBoundingClientRect(), kr = knoten.getBoundingClientRect();
    const kx = kr.left - hr.left + kr.width / 2, ky = kr.top - hr.top + kr.height / 2;
    const spalt = Math.max(kr.width, 20) / 2 + 6;
    const A = (x, y, spreiz, hell) => ({ x, y, werte: [spreiz, hell] });
    let rot, gruen;
    if (handy) {
      // Handy: ein ruhiges Band oben, quer über den Bildschirm durch den Knoten.
      rot = [A(-30, ky + 54, 20, 0.5), A(kx * 0.45, ky + 26, 12, 0.85), A(kx - spalt - 28, ky + 3, 4, 1.15), A(kx - spalt, ky, 1.2, 1.35)];
      gruen = [A(kx + spalt, ky, 1.2, 1.35), A(kx + spalt + 28, ky - 3, 4, 1.15), A(kx + (W - kx) * 0.55, ky - 26, 12, 0.85), A(W + 30, ky - 54, 20, 0.5)];
    } else {
      // Rechner: Granat steigt von links unten unter dem Text auf in den Knoten, Smaragd zieht nach rechts oben hinaus.
      rot = [A(-40, ky + H * 0.3, 34, 0.4), A(W * 0.22, ky + H * 0.24, 26, 0.65), A(kx - W * 0.16, ky + H * 0.06, 12, 1), A(kx - spalt - 26, ky + 1, 4, 1.2), A(kx - spalt, ky, 1.2, 1.4)];
      gruen = [A(kx + spalt, ky, 1.2, 1.4), A(kx + spalt + 26, ky - 1, 4, 1.2), A(kx + (W - kx) * 0.5, ky - H * 0.1, 18, 0.9), A(W + 40, ky - H * 0.24, 30, 0.45)];
    }
    const schritt = handy ? L.LICHTFAEDEN.schritt.handy : L.LICHTFAEDEN.schritt.rechner;
    const proben = anker => L.kurve(anker, schritt).map(p => ({ x: p.x, y: p.y, nx: p.nx, ny: p.ny, s: p.s, spreizung: p.werte[0], hell: p.werte[1] }));
    buendel = [
      { farbe: GRANAT, saaten: L.fadenSaaten(handy ? 10 : 18, 10032026), proben: proben(rot) },
      { farbe: SMARAGD, saaten: L.fadenSaaten(handy ? 10 : 18, 20032026), proben: proben(gruen) },
    ];
  }

  function zeichne(t) {
    ctx.setTransform(canvas.width / Math.max(1, W), 0, 0, canvas.height / Math.max(1, H), 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // Beim ersten Laden kommen die Fäden sanft herein; reduzierte Bewegung: sofort da.
    ctx.globalAlpha = ruhig ? 1 : L.glatt(t, 150, 1700);
    for (const b of buendel) {
      L.zeichneBuendel(ctx, b.proben, { farbe: b.farbe, saaten: [L.MITTE], deckkraft: handy ? 0.08 : 0.06, strich: handy ? 5 : 8 }, t);
      L.zeichneBuendel(ctx, b.proben, { farbe: b.farbe, saaten: b.saaten, deckkraft: handy ? 0.32 : 0.27 }, t);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  vermessen();
  const lauf = L.starteLauf({ beobachte: held, zeichne, ruhig });
  const neu = () => { vermessen(); lauf.einmal(); };
  addEventListener('resize', neu, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(neu).observe(held);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
})();
