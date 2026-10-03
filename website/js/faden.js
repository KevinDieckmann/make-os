// MAKE Innovation · Landingpage: der rote Faden aus Lichtfäden (03.10.2026)
// Kevin 03.10.: Feine, leuchtende Fäden „können sich auch mit durch die Homepage ziehen“. Aus dem Knoten des Logos
// entspringen zwei Bündel — Granat und Smaragd, die Farben der Synapse — und fließen beim Scrollen von Kapitel zu Kapitel:
// zwischen Text und Neuronen-Bühne (Rechner) bzw. an den Rändern (Handy). In „Warum Innovation“ verflechten sie sich, in
// „Beratung“ steigen sie in drei Stufen auf, bei „Make.One“ fächern sie auf, im Kontakt laufen sie im Knoten zusammen.
// Ruhig: wenige, dünne Fäden; die Bühne bleibt das Hauptbild.
//   · Zeichner und Mathematik: js/lichtfaeden.js (übersetzt aus denselben Dateien wie in der App — gleiche Parameter).
//   · Der Faden liegt in Seiten-Koordinaten; gezeichnet wird nur, was im Bild ist (eine Leinwand in der Bühne).
//   · Pausiert außerhalb des Bildes und im verborgenen Tab; prefers-reduced-motion: Standbild, neu nur beim Scrollen.
// Liest nichts aus, speichert nichts, sendet nichts (website/pruefen.mjs prüft das).
(() => {
  'use strict';
  const L = globalThis.Lichtfaeden; if (!L) return;
  const reise = document.querySelector('.reise'); if (!reise) return;
  const buehne = reise.querySelector('.buehne');
  const canvas = buehne && buehne.querySelector('canvas.faeden');
  const zeichen = buehne && buehne.querySelector('svg.zeichen');
  if (!canvas || !canvas.getContext || !zeichen) return;
  const ctx = canvas.getContext('2d'); if (!ctx) return;

  const ruhig = L.bewegungReduziert();
  const handyAbfrage = matchMedia('(max-width: 1099px)');
  const GRANAT = '#C9465C', SMARAGD = '#2FA878';
  const kapitel = Array.from(reise.querySelectorAll(':scope > .kapitel'));
  const formation = kapitel.map(k => k.dataset.formation || 'logo');

  // Charakter je Kapitel: [Abstand der Bündel (px), Flechten 0…1, Spreizung (px), Helligkeit, aufsteigendes Licht 0…1]
  const CHARAKTER = {
    logo: [3, 0, 2.5, 0.9, 0],
    laerm: [9, 0.15, 5, 0.75, 0],
    impuls: [11, 1, 4, 1.15, 0],
    pfad: [2.5, 0, 2.5, 1, 1],
    kreise: [20, 0.25, 12, 0.95, 0],
    fokus: [6, 0, 3, 0.8, 0],
    kern: [7, 0.55, 3.5, 0.85, 0],
  };
  const charakter = (i, zusatz) => { const c = CHARAKTER[formation[i]] || CHARAKTER.logo; return zusatz ? c.map((v, k) => v * (zusatz[k] ?? 1)) : c; };

  let handy = handyAbfrage.matches, W = 0, H = 0, vh = 0;
  let saatRot = [], saatGruen = [], anker = null, knoten = { x: 0, y: 0, rotX: 0, gruenX: 0 }, sRef = 0, endeCache = NaN, kurven = [];

  /** Lage der Logo-Punkte in Bühnen-Koordinaten (die Bühne klebt: gleiche Lage bei jedem Scroll-Stand). */
  function logoPunkte() {
    const br = buehne.getBoundingClientRect(), zr = zeichen.getBoundingClientRect();
    const vb = zeichen.viewBox && zeichen.viewBox.baseVal, s = vb && vb.width ? zr.width / vb.width : 1;
    const y = zr.top - br.top + 77.5 * s;
    return { x: zr.left - br.left + 154.84 * s, y, rotX: zr.left - br.left, gruenX: zr.left - br.left + 276.76 * s };
  }

  function vermessen() {
    handy = handyAbfrage.matches;
    W = buehne.clientWidth; H = buehne.clientHeight; vh = innerHeight;
    L.leinwand(canvas, W, H, handy ? 2 : 1.5);
    saatRot = L.fadenSaaten(handy ? 6 : 12, 3102026);
    saatGruen = L.fadenSaaten(handy ? 6 : 12, 2103026);
    knoten = logoPunkte();
    const oben = kapitel.map(k => k.offsetTop), hoch = kapitel.map(k => k.offsetHeight);
    const letzte = kapitel.length - 1;
    sRef = oben[letzte] - vh * 0.3;
    // Rechner: zwischen Textspalte und Bühne.
    const inhalt = kapitel[0] && kapitel[0].querySelector('.inhalt');
    const textRechts = inhalt ? inhalt.getBoundingClientRect().right - buehne.getBoundingClientRect().left : W * 0.45;
    const R = Math.min((H - 64) * 0.33, W * 0.165);
    const gx = Math.max(textRechts + 30, (textRechts + W * 0.72 - R) / 2);
    anker = { oben, hoch, letzte, gx };
    endeCache = NaN;
  }

  /** Anker der Leitkurven (Seiten-Koordinaten der Reise). `ende` = y des Knotens im Kontakt (folgt dem Scrollen). */
  function bauen(ende) {
    const { oben, hoch, letzte, gx } = anker;
    const A = (x, y, w) => ({ x, y, werte: w });
    if (handy) {
      // Handy: Rot am linken, Grün am rechten Rand — aus den Enden der Logo-Striche, im Kontakt zurück dorthin.
      const rand = (x0, xr) => {
        const a = [A(x0, knoten.y, [0, 0, 0.5, 0.2, 0]), A(x0 + (xr - x0) * 0.6, knoten.y + vh * 0.12, [0, 0, 1.5, 0.6, 0]), A(xr, knoten.y + vh * 0.3, charakter(0))];
        for (let i = 1; i < letzte; i++) for (const f of [0.08, 0.5, 0.92]) a.push(A(xr, oben[i] + hoch[i] * f, charakter(i, [1, 1, 0.45, 0.8, 1])));
        a.push(A(xr, oben[letzte] + hoch[letzte] * 0.1, charakter(letzte)), A(xr, ende - vh * 0.3, charakter(letzte)), A(x0 + (xr - x0) * 0.6, ende - vh * 0.12, [0, 0, 1.5, 0.6, 0]), A(x0, ende, [0, 0, 0.5, 0.2, 0]));
        return a;
      };
      return [{ farbe: GRANAT, saat: saatRot, seite: 0, anker: rand(knoten.rotX, 7) }, { farbe: SMARAGD, saat: saatGruen, seite: 0, anker: rand(knoten.gruenX, W - 7) }];
    }
    // Rechner: Die Bündel kommen aus dem Logo — Rot läuft hinter dem roten Strich nach links aus seinem Ende, Grün hinter
    // dem grünen nach rechts und in einem Bogen unter dem Logo zurück; unterhalb treffen sie sich und laufen gemeinsam an
    // EINER Leitkurve zwischen Text und Bühne, mit Abstand/Flechten je Kapitel. Im Kontakt dasselbe rückwärts in den Knoten.
    const still = [0, 0, 0.6, 0.2, 0];
    const kopfRot = y => [A(knoten.x, y, still), A(knoten.rotX + 12, y, still), A(knoten.rotX - 26, y + 34, [0, 0, 1.2, 0.55, 0])];
    const kopfGruen = y => [A(knoten.x, y, still), A(knoten.gruenX - 12, y, still), A(knoten.gruenX + 30, y + 40, [0, 0, 1.2, 0.55, 0]),
      A(knoten.gruenX - 10, y + 96, [0, 0, 1.6, 0.6, 0]), A(knoten.x, y + 104, [0, 0, 1.8, 0.65, 0]), A(knoten.rotX + 10, y + 110, [0, 0, 2, 0.7, 0])];
    const mitte = [A(gx, Math.min(knoten.y + vh * 0.42, oben[1] - 40), charakter(0))];
    for (let i = 1; i < letzte; i++) {
      const y = f => oben[i] + hoch[i] * f;
      if (formation[i] === 'pfad') {
        // Drei Stufen (Analyse, Aufbau, Skalierung): der Pfad rückt in weichen Stufen zur Bühne, wird mit jeder heller,
        // und Licht steigt in ihm auf (Pulse laufen gegen die Leserichtung nach oben).
        mitte.push(A(gx, y(0.05), charakter(i)));
        for (let k = 0; k < 3; k++) {
          const yk = y(0.22 + k * 0.27), hell = 0.85 + k * 0.2, st = 28;
          mitte.push(A(gx + k * st, yk - 70, charakter(i, [1, 1, 1, hell, 1])), A(gx + (k + 1) * st, yk + 70, charakter(i, [1, 1, 1.2, hell + 0.1, 1])));
        }
        mitte.push(A(gx + 84, y(0.9), charakter(i, [1, 1, 1, 1.25, 1])));
        continue;
      }
      for (const f of [0.06, 0.36, 0.66, 0.94]) mitte.push(A(gx, y(f), charakter(i)));
    }
    mitte.push(A(gx, oben[letzte] + hoch[letzte] * 0.06, charakter(letzte)), A(gx, ende - vh * 0.3, charakter(letzte, [0.6, 1, 0.8, 1, 1])));
    return [
      { farbe: GRANAT, saat: saatRot, seite: 1, anker: [...kopfRot(knoten.y), ...mitte, ...kopfRot(ende).reverse()] },
      { farbe: SMARAGD, saat: saatGruen, seite: -1, anker: [...kopfGruen(knoten.y), ...mitte, ...kopfGruen(ende).reverse()] },
    ];
  }

  function kurvenFuer(S) {
    const ende = Math.max(sRef, S) + knoten.y;
    if (Math.abs(ende - endeCache) < 0.5 && kurven.length) return kurven;
    endeCache = ende;
    const schritt = handy ? L.LICHTFAEDEN.schritt.handy : L.LICHTFAEDEN.schritt.rechner;
    const geteilt = new Map();
    kurven = bauen(ende).map(b => {
      let k = geteilt.get(b.anker); if (!k) { k = L.kurve(b.anker, schritt); geteilt.set(b.anker, k); }
      return { farbe: b.farbe, saat: b.saat, seite: b.seite, punkte: k };
    });
    return kurven;
  }

  function zeichne(t) {
    const rr = reise.getBoundingClientRect(); if (rr.bottom < -40 || rr.top > innerHeight + 40 || !anker) return;
    const br = buehne.getBoundingClientRect();
    const S = -rr.top, bTop = br.top - rr.top;
    ctx.setTransform(canvas.width / Math.max(1, W), 0, 0, canvas.height / Math.max(1, H), 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // Beim ersten Laden: der Faden kommt, nachdem sich das Logo eingezeichnet hat (Knoten bei ~1,4 s).
    ctx.globalAlpha = ruhig ? 1 : L.glatt(t, 1200, 2800);
    const von = bTop - 60, bis = bTop + H + 60;
    for (const b of kurvenFuer(S)) {
      const proben = [];
      const P = b.punkte;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (p.y < von || p.y > bis) { if (proben.length && p.y > bis) break; continue; }
        const [abstand, flechten, spreiz, hell, aufstieg] = p.werte;
        const off = b.seite * abstand * ((1 - flechten) + flechten * Math.sin(p.s * 0.011 - t * 0.0005));
        // Aufsteigendes Licht: helle Stellen wandern entlang des Fadens nach oben (Weg s nimmt mit der Zeit ab).
        const ph = ((p.s + t * 0.09) % 520 + 520) % 520 - 260, puls = aufstieg > 0 ? 1 + aufstieg * 1.4 * Math.exp(-(ph * ph) / 3600) : 1;
        proben.push({ x: p.x + p.nx * off, y: p.y - bTop + p.ny * off, nx: p.nx, ny: p.ny, s: p.s, spreizung: spreiz, hell: hell * puls });
      }
      if (proben.length < 2) continue;
      L.zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: [L.MITTE], deckkraft: handy ? 0.07 : 0.05, strich: handy ? 5 : 8 }, t);
      L.zeichneBuendel(ctx, proben, { farbe: b.farbe, saaten: b.saat, deckkraft: handy ? 0.3 : 0.17 }, t);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  vermessen();
  const lauf = L.starteLauf({ beobachte: reise, zeichne, ruhig });
  const neu = () => { vermessen(); lauf.einmal(); };
  addEventListener('resize', neu, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(neu).observe(reise);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
  if (ruhig) addEventListener('scroll', () => lauf.einmal(), { passive: true });
})();
