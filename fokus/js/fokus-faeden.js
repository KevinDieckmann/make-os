// Fokus Innovation · Event-Seite: Lichtfäden im Held (03.10.2026 · Strahl v3 seit 04.10.2026)
// Zwei Bündel feiner Fäden — Granat und Smaragd, die Farben der Synapse im MAKE-Logo: Granat kommt von links und läuft in
// den Knoten, Smaragd verlässt ihn nach rechts. Der Knoten selbst ist ein SVG in der Seite (.knoten-gross); die Fäden enden
// mit einem schmalen Spalt davor und dahinter, wie an einer Synapse.
// Strahl v3 wie in der App (DESIGN_STANDARD.md › Lichtfäden), alles aus dem gemeinsamen Zeichner:
//   · Aufbau beim Laden: eine Front läuft von links nach rechts über den Held — erst wächst Granat in den Knoten, dann
//     Smaragd aus ihm heraus; die Spitzen leuchten, ein leises Licht läuft der Front voraus (`front` im Zeichner).
//   · Fließen in Zeitrichtung (links → rechts), Lichtpunkte wandern entlang der Fäden nach rechts (`punkte`).
//   · Glühen an dichten Stellen (Schein-Puffer `glanzPuffer`) — am Knoten, wo die Fäden eng zusammenlaufen; dazu ein ruhiger
//     Schein um den Knoten, der kurz aufleuchtet, wenn die Front ihn erreicht (die Synapse „feuert“).
//   · Rechts vom Knoten (die Zukunft) fransen die Smaragd-Fäden leicht aus (`frans`); links (das Woher) gedämpft.
// Dezent: Unter dem Text bleiben die Fäden leiser (Lesbarkeit). Handy: weniger Fäden und Lichtpunkte.
//   · Zeichner und Mathematik: js/lichtfaeden.js (erzeugt aus lib/lichtfaeden — dieselben Parameter wie in der App und auf
//     makeinnovation.de; nie von Hand ändern, node scripts/fokus-seite.mjs).
//   · Pausiert außerhalb des Bildes und im verborgenen Tab; prefers-reduced-motion: ein Standbild (ohne Aufbau).
// Liest nichts aus, speichert nichts, sendet nichts (fokus/pruefen.mjs prüft das).
(() => {
  'use strict';
  const L = globalThis.Lichtfaeden; if (!L) return;
  const held = document.querySelector('.held'); if (!held) return;
  const canvas = held.querySelector('canvas.faeden');
  const knoten = held.querySelector('.knoten-gross');
  const text = held.querySelector('.held-text');
  if (!canvas || !canvas.getContext || !knoten) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;

  const ruhig = L.bewegungReduziert();
  const handyAbfrage = matchMedia('(max-width: 900px)');
  const GRANAT = '#C9465C', SMARAGD = '#2FA878';
  const P = L.LICHTFAEDEN;
  /** Aufbau: Beginn (ms nach dem ersten Bild — der Knoten blendet ab 0,2 s ein) und Dauer wie in der App. */
  const AUFBAU_AB = 150, AUFBAU = P.aufbau;
  const glanz = L.glanzPuffer();
  let W = 0, H = 0, handy = false, buendel = [], kn = { x: 0, y: 0 };

  /** Leitkurven aus der Lage des Knotens; Werte je Anker: [Spreizung in px, Helligkeit]. */
  function vermessen() {
    handy = handyAbfrage.matches;
    W = held.clientWidth; H = held.clientHeight;
    L.leinwand(canvas, W, H, handy ? 2 : 1.5);
    const hr = held.getBoundingClientRect(), kr = knoten.getBoundingClientRect();
    const kx = kr.left - hr.left + kr.width / 2, ky = kr.top - hr.top + kr.height / 2;
    const spalt = Math.max(kr.width, 20) / 2 + 6;
    kn = { x: kx, y: ky };
    // Unter dem Text (Rechner) bleiben die Fäden leiser: rechter Rand der Textspalte.
    const textRechts = !handy && text ? text.getBoundingClientRect().right - hr.left : -1;
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
    const schritt = handy ? P.schritt.handy : P.schritt.rechner;
    const zukunftAb = kx + spalt + (handy ? 30 : 70);
    const proben = (anker, zukunft) => L.kurve(anker, schritt).map(p => ({
      x: p.x, y: p.y, nx: p.nx, ny: p.ny, s: p.s, spreizung: p.werte[0],
      hell: p.werte[1] * (textRechts > 0 ? 0.62 + 0.38 * L.glatt(p.x, textRechts - 120, textRechts + 40) : 1),
      frans: zukunft ? L.glatt(p.x, zukunftAb, W + 40) * (handy ? 0.55 : 0.75) : 0,
    }));
    buendel = [
      { farbe: GRANAT, saaten: L.fadenSaaten(handy ? 10 : 18, 10032026), proben: proben(rot, false) },
      { farbe: SMARAGD, saaten: L.fadenSaaten(handy ? 10 : 18, 20032026), proben: proben(gruen, true) },
    ];
  }

  /** Weg `s` eines Bündels an der Stelle x der Front (die Kurven laufen von links nach rechts). */
  function wegBei(pr, fx) {
    if (fx <= pr[0].x) return pr[0].s - (pr[0].x - fx) - 1;
    for (let i = 1; i < pr.length; i++) {
      if (pr[i].x >= fx) { const a = pr[i - 1], b = pr[i], u = (fx - a.x) / ((b.x - a.x) || 1); return a.s + (b.s - a.s) * u; }
    }
    const z = pr[pr.length - 1];
    return z.s + (fx - z.x);
  }
  /** Lage auf der Leitkurve an der Stelle x (für das Licht der Front); null außerhalb. */
  function punktBei(pr, fx) {
    if (fx < pr[0].x || fx > pr[pr.length - 1].x) return null;
    for (let i = 1; i < pr.length; i++) if (pr[i].x >= fx) { const a = pr[i - 1], b = pr[i], u = (fx - a.x) / ((b.x - a.x) || 1); return { x: fx, y: a.y + (b.y - a.y) * u }; }
    return null;
  }

  function zeichne(t) {
    ctx.setTransform(canvas.width / Math.max(1, W), 0, 0, canvas.height / Math.max(1, H), 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // Aufbau: die Front läuft in AUFBAU ms von links nach rechts über den Held; danach ist alles da.
    const p = ruhig ? 1 : (t - AUFBAU_AB) / AUFBAU;
    const fx = p >= 1 ? null : L.glatt(Math.max(0, p), 0, 1) * (W + P.aufbauVerzug + 120) - 60;
    const punkte = handy ? { ...P.punkte, abstand: 14, jeder: 3 } : { ...P.punkte, jeder: 2 };
    for (const b of buendel) {
      if (b.proben.length < 2) continue;
      const front = fx == null ? undefined : wegBei(b.proben, fx);
      L.zeichneBuendel(ctx, b.proben, { farbe: b.farbe, saaten: [L.MITTE], deckkraft: handy ? 0.08 : 0.06, strich: handy ? 6 : 10, front }, t);
      L.zeichneBuendel(ctx, b.proben, { farbe: b.farbe, saaten: b.saaten, deckkraft: handy ? 0.32 : 0.27, front, punkte }, t);
    }
    // Glühen an dichten Stellen (am Knoten laufen die Fäden eng zusammen): das Gezeichnete klein und weich darüber.
    if (glanz) glanz.auf(ctx, canvas, W, H, handy ? 0.55 : 0.75);
    // Die Synapse: ein ruhiger Schein um den Knoten (wie HEUTE im Strahl) — er leuchtet kurz auf, wenn die Front ihn erreicht.
    const erreicht = fx == null ? 1 : L.glatt(fx - kn.x, -20, 80);
    const blitz = fx == null ? 0 : Math.exp(-(((fx - kn.x) / 150) ** 2));
    const schein = 0.07 * erreicht + 0.16 * blitz;
    if (schein > 0.004) {
      const rad = handy ? 46 : 74;
      for (const [farbe, dx] of [[GRANAT, -5], [SMARAGD, 5]]) {
        const [r, g, bl] = L.rgb(farbe), x = kn.x + dx;
        const h = ctx.createRadialGradient(x, kn.y, 0, x, kn.y, rad);
        h.addColorStop(0, `rgba(${r},${g},${bl},${schein.toFixed(3)})`); h.addColorStop(1, `rgba(${r},${g},${bl},0)`);
        ctx.fillStyle = h;
        ctx.fillRect(x - rad, kn.y - rad, rad * 2, rad * 2);
      }
    }
    // Das leise Licht vor der Front — verlischt mit dem Ende des Aufbaus.
    if (fx != null && p > 0) {
      for (const b of buendel) {
        const q = punktBei(b.proben, Math.max(0, Math.min(W, fx)));
        if (!q) continue;
        const [r, g, bl] = L.rgb(b.farbe), rad = handy ? 54 : 96;
        const licht = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
        licht.addColorStop(0, `rgba(${r},${g},${bl},${(0.22 * (1 - p)).toFixed(3)})`); licht.addColorStop(1, `rgba(${r},${g},${bl},0)`);
        ctx.fillStyle = licht;
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  vermessen();
  const lauf = L.starteLauf({ beobachte: held, zeichne, ruhig });
  const neu = () => { vermessen(); lauf.einmal(); };
  addEventListener('resize', neu, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(neu).observe(held);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
})();
