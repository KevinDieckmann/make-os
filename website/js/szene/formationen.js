// MAKE Innovation · Szene v5 — Formationen (04.10.2026)
// Reine Geometrie ohne DOM (Browser: js/szene/motor.js · Node: website/standbild.mjs). Jede Formation legt für N Teilchen
// einen Zielpunkt in Weltkoordinaten fest (x, y, z, w = Farbe + Helligkeit), dazu feine Linien (x, y, z, t, w, Phase;
// t = Lage entlang der Linie 0…1 für Aufbau von links und Lichtimpulse) und optional Marken (Beschriftungen im Bild).
// Formationen werden im Rahmen eines Pfad-Ankers gebaut: x rechts, y oben, z zur Kamera.
//
//   weg        Staub entlang des Lichtpfads (Start im Neuronennetz)
//   schriftzug eine SVG-Form als Teilchen (z. B. INNOVATION aus der Wortmarke) mit Synapse-Strich darunter
//   strom      zwei Stränge (Granat, Smaragd) verflechten sich und laufen zu einem Faden zusammen
//   huerde     eine Wand aus Grau mit einer Öffnung, durch die der Weg führt (Hürden lösen)
//   trichter   Sales: von vielen Kontakten links zu einem klaren Strahl rechts
//   signal     Sichtbarkeit: ein Leuchtpunkt, Ringe breiten sich aus, ein Lichtstrahl steigt auf
//   stufen     Umsetzung: drei wachsende Gitter (Analyse, Aufbau, Skalierung), ein Pfad darüber
//   runden     Netzwerk: Runden von Menschen auf einer Kugel, mit Brücken verbunden
//   karte      Deutschlandkarte (echte Koordinaten) mit Städten; Lichtfäden vom Start (Berlin) in jede Stadt
//   funken     Ideen: verstreute Funken
//   strahl     KI: ein Strahl aus vielen feinen Fäden, fließt von links nach rechts (Strahl v3 der App)
//   wirkung    Menschen in einer Runde, daraus drei Ströme (Umsetzung, Sichtbarkeit, Netzwerk)
//   zeichen    das Logo „Synapse“ (aus dem SVG der Seite) — alles fließt in den Knoten
//
// Schnittstelle für andere Seiten (fokus/): MakeSzene.formationen.bauen(drehbuch, { handy, logo }) — das Drehbuch nennt je
// Zustand die Formation und ihre Optionen, z. B. { formation: 'karte', optionen: { staedte: [{ name, lat, lon }], start: 'Berlin' } }.
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};
  const FARBE = { WEISS: 0, GRANAT: 1, SMARAGD: 2, GRAU: 3, HELL: 4 };
  /** Linear (0…1) wie im Shader; Granat und Smaragd = die Synapse im Logo, sonst kühles Weiß/Grau auf Tiefschwarz. */
  const PALETTE = [[.80, .86, .90], [.79, .27, .36], [.18, .66, .47], [.42, .47, .50], [1, 1, 1]];
  const { WEISS, GRANAT, SMARAGD, GRAU, HELL } = FARBE;

  /** Deutschland (Umriss vereinfacht, SVG-Koordinaten 362,8 × 489) und die Projektion dazu: x = ax·Länge + bx, y = ay·Breite + by. */
  const DEUTSCHLAND = {
    umriss: 'M114.7 20.4L144 25.2L158.7 27L166.6 34.2L172.9 49.2L197.4 53.4L206.8 46.2L198.5 73.2L206.8 77.4L220.3 75.6L233.1 66L244.4 64.2L259.4 48L274.5 52.2L285.7 37.8L294 34.2L305.3 48L304.5 60L309 69L323.3 72L324.1 79.2L326 90L330.8 108L332 120L321.4 144L339.1 160.2L336.5 174L344 190.8L340.2 207L343.3 222L353.4 240L346.6 262.8L332.7 255L317.7 264L298.9 273L285.7 285L274.5 291L253.8 300L244.4 295.8L248.1 306L257.5 318L259.4 333L266.9 348L276.3 357L291.4 366L298.9 378L309 388.8L297 400.8L294.4 417L272.6 426L275.6 438L280.1 453L278.2 463.2L268.8 454.2L248.1 454.8L229.3 460.2L218.1 468L202.3 471L182.3 462L172.9 478.2L164.3 462L154.1 462L145.9 456L135.3 453L123.3 454.2L112.8 450L107.1 459L94 460.2L75.2 461.4L73.3 447L74.4 429L82.7 405L94 387L98.9 376.8L86.5 372L67.7 364.2L54.5 367.8L45.1 363L28.6 346.8L33.8 330L19.9 315L19.9 307.2L30.1 295.8L24.4 285L16.9 270L10.2 252L18.8 243L22.6 225L13.2 204L30.1 201L41.4 192L54.5 183L52.6 168L43.2 156L55.6 144L60.2 123L54.5 114L56.4 102L71.4 94.2L90.2 93L94.7 103.8L99.6 111L110.9 102L116.5 82.8L131.6 81L122.2 72L113.5 57L127.8 46.2L116.5 33Z',
    ax: 37.6, bx: -210.6, ay: -60, by: 3315,
  };
  /** Städte von Fokus Innovation (echte Koordinaten, WGS 84). Andere Seiten geben ihre eigene Liste mit. */
  const STAEDTE = [
    { name: 'Berlin', lat: 52.520, lon: 13.405 },
    { name: 'Hamburg', lat: 53.551, lon: 9.994 },
    { name: 'Bielefeld', lat: 52.030, lon: 8.532 },
    { name: 'Köln', lat: 50.938, lon: 6.960 },
    { name: 'München', lat: 48.137, lon: 11.575 },
    { name: 'Dresden', lat: 51.050, lon: 13.738 },
  ];

  /** Baut Punkte und Linien im Rahmen f (Anker am Pfad); dreh = { y, x } in Grad dreht die Formation um ihren Anker. */
  function bauer(N, f, z, dreh) {
    const K = S.kern, punkte = [], linien = [], marken = [], ziele = [];
    const ay = (dreh && dreh.y || 0) * Math.PI / 180, ax = (dreh && dreh.x || 0) * Math.PI / 180;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const rot = (x, y, q) => { const x1 = x * cy + q * sy, q1 = -x * sy + q * cy; return [x1, y * cx - q1 * sx, y * sx + q1 * cx]; };
    const welt = (x, y, q) => { const r = rot(x, y, q); return K.lokal(f, r[0], r[1], r[2]); };
    const w = (farbe, hell) => farbe + Math.min(.99, Math.max(0, hell));
    const b = {
      N, z, f, welt,
      voll: () => punkte.length >= N * 4,
      rest: () => N - punkte.length / 4,
      punkt(x, y, q, farbe, hell) { if (punkte.length < N * 4) { const p = welt(x, y, q); punkte.push(p[0], p[1], p[2], w(farbe, hell)); } },
      /** Punkt am Pfad selbst (Stelle s, Versatz x/y im Rahmen dort) — für Formationen, die dem Weg folgen. */
      amPfad(s, x, y, farbe, hell) { if (punkte.length < N * 4) { const p = K.lokal(K.rahmen(s), x, y, 0); punkte.push(p[0], p[1], p[2], w(farbe, hell)); } },
      linieW(a, c, ta, tc, farbe, hell, phase) { linien.push(a[0], a[1], a[2], ta, w(farbe, hell), phase, c[0], c[1], c[2], tc, w(farbe, hell), phase); },
      linie(a, c, ta, tc, farbe, hell, phase) { b.linieW(welt(a[0], a[1], a[2]), welt(c[0], c[1], c[2]), ta, tc, farbe, hell, phase); },
      /** Polylinie aus lokalen Punkten [x, y, z, t]; farbe darf eine Funktion von t sein. */
      zug(pkt, farbe, hell, phase) {
        for (let i = 0; i + 1 < pkt.length; i++) {
          const a = pkt[i], c = pkt[i + 1], fa = typeof farbe === 'function' ? farbe(a[3]) : farbe;
          b.linie(a, c, a[3], c[3], fa, hell, phase);
        }
      },
      marke(x, y, q) { marken.push(welt(x, y, q)); },
      /** Die Lichtfäden des Pfads münden hier (lokal x, y; z = Tiefe) und tauchen nach `nach` wieder auf. */
      fadenZiel(x, y, q, vor, nach) { ziele.push({ s: f.s - q, x, y, vor, nach }); },
      fertig() {
        while (punkte.length < N * 4) { const p = welt((z() - .5) * 12, (z() - .5) * 8, (z() - .5) * 8); punkte.push(p[0], p[1], p[2], 0); }
        return { punkte: new Float32Array(punkte), linien: linien.length ? new Float32Array(linien) : null, marken, ziele };
      },
    };
    return b;
  }

  const TAU = Math.PI * 2;
  const gauss = (x, m, s) => Math.exp(-((x - m) / s) * ((x - m) / s));

  const FORMEN = {
    weg(b, o) {
      const { z, N } = b, von = o.von ?? o.s - 22, bis = o.bis ?? o.s + 50;
      for (let i = 0; i < N * .94; i++) {
        const s = von + z() * (bis - von), r = .3 + Math.abs(z.g()) * 1.1 + (z() < .2 ? z() * 3.2 : 0), a = z() * TAU, q = z();
        b.amPfad(s, Math.cos(a) * r, Math.sin(a) * r * .8 - .25, q < .38 ? GRANAT : q < .76 ? SMARAGD : WEISS, .1 + .5 * z() * z());
      }
    },

    schriftzug(b, o) {
      const K = S.kern, { z, N } = b, f = K.form(o.d || (o.logo && o.logo.zusatz) || 'M0 0L1 0L1 1Z'), B = o.breite ?? 26, k = B / (f.x1 - f.x0);
      const mx = (f.x0 + f.x1) / 2, my = (f.y0 + f.y1) / 2, h = (f.y1 - f.y0) * k / 2, uy = -h - .62;
      for (const [x, y] of K.abtasten(f, Math.floor(N * .8), z)) b.punkt((x - mx) * k, -(y - my) * k, z.g() * .03, z() < .06 ? HELL : WEISS, .5 + .45 * z());
      // Der Synapse-Strich darunter: Rot links, Grün rechts, der Knoten in der Mitte (wie im Logo).
      for (let i = 0; i < N * .1; i++) { const rechts = i % 2, x = (rechts ? .5 : -.5) + (rechts ? 1 : -1) * z() * (B / 2 - .5); b.punkt(x, uy + z.g() * .025, 0, rechts ? SMARAGD : GRANAT, .45 + .4 * z()); }
      for (let i = 0; i < N * .035; i++) { const r = .3 * Math.sqrt(z()), a = (z() - .5) * Math.PI, rechts = i % 2; b.punkt((rechts ? 1 : -1) * Math.cos(a) * r, uy + Math.sin(a) * r, 0, rechts ? SMARAGD : GRANAT, .9); }
      b.linie([-B / 2, uy, 0], [-.4, uy, 0], 0, .5, GRANAT, .5, 0);
      b.linie([.4, uy, 0], [B / 2, uy, 0], .5, 1, SMARAGD, .5, 0);
    },

    strom(b, o) {
      const K = S.kern, { z, N } = b, s0 = o.s - 14, s1 = o.s + 30, lauf = s => K.sanft((s - s0) / (s1 - s0));
      const lage = (s, strang) => { const r = 1.5 * (1 - lauf(s)) + .08, a = strang * Math.PI + s * .42; return [Math.cos(a) * r, Math.sin(a) * r * .9]; };
      for (let i = 0; i < N * .9; i++) {
        const strang = i % 2, s = s0 + z() * (s1 - s0), [x, y] = lage(s, strang), j = .05 + .1 * (1 - lauf(s));
        const weiss = z() < .1;
        b.amPfad(s, x + z.g() * j, y + z.g() * j, weiss ? WEISS : strang ? SMARAGD : GRANAT, (weiss ? .5 : .25) + .45 * z() * lauf(s) + .1);
      }
      for (let strang = 0; strang < 2; strang++) for (let s = s0; s < s1; s += .35) {
        const a = lage(s, strang), c = lage(s + .35, strang);
        b.linieW(K.lokal(K.rahmen(s), a[0], a[1], 0), K.lokal(K.rahmen(s + .35), c[0], c[1], 0), (s - s0) / (s1 - s0), (s + .35 - s0) / (s1 - s0), strang ? SMARAGD : GRANAT, .55, strang * .5);
      }
    },

    huerde(b) {
      const { z, N } = b, oeffnung = a => 2.3 + .32 * Math.sin(a * 5) + .18 * Math.sin(a * 3 + 1);
      const wand = [];
      while (wand.length < N * .7) {
        const x = (z() * 2 - 1) * 9, y = (z() * 2 - 1) * 6, r = Math.hypot(x, y);
        if (r < oeffnung(Math.atan2(y, x)) + Math.abs(z.g()) * .25) continue;
        const q = z.g() * .55 + (r < 4.5 ? (4.5 - r) * .25 : 0);
        wand.push([x, y, q]); b.punkt(x, y, q, z() < .75 ? GRAU : WEISS, .3 + .35 * z());
      }
      for (let i = 0; i < N * .22; i++) {
        const a = z() * TAU, r = oeffnung(a) + z.g() * .05;
        b.punkt(Math.cos(a) * r, Math.sin(a) * r, 1, Math.cos(a) < 0 ? GRANAT : SMARAGD, .55 + .4 * z());
      }
      for (let i = 0, n = 0; i < 4000 && n < 320; i++) {
        const p = wand[Math.floor(z() * wand.length)], q = wand[Math.floor(z() * wand.length)];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.3) continue;
        b.linie(p, q, 0, 0, GRAU, .45, z()); n++;
      }
      const ring = [];
      for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU - Math.PI, r = oeffnung(a); ring.push([Math.cos(a) * r, Math.sin(a) * r, 1, i / 120]); }
      b.zug(ring, t => (t < .25 || t > .75) ? GRANAT : SMARAGD, .6, 0);
    },

    trichter(b) {
      const { z, N } = b, arme = 7, R = u => .22 + 4.2 * Math.pow(1 - u, 1.7);
      for (let i = 0; i < N * .78; i++) {
        const u = Math.pow(z(), .85), x = -7 + u * 11, arm = i % arme, th = arm / arme * TAU + x * 1.15 + z.g() * .12, r = R(u);
        b.punkt(x, Math.cos(th) * r, Math.sin(th) * r, u < .45 ? (z() < .75 ? WEISS : GRAU) : arm % 2 ? SMARAGD : GRANAT, .22 + .55 * u);
      }
      for (let i = 0; i < N * .14; i++) b.punkt(4 + z() * 5, z.g() * .07, z.g() * .07, HELL, .45 + .4 * z());
      for (let arm = 0; arm < arme; arm++) {
        const pkt = [];
        for (let x = -7; x <= 4.001; x += .12) { const u = (x + 7) / 11, th = arm / arme * TAU + x * 1.15, r = R(u); pkt.push([x, Math.cos(th) * r, Math.sin(th) * r, (x + 7) / 16]); }
        b.zug(pkt, t => t < .3 ? WEISS : arm % 2 ? SMARAGD : GRANAT, .42, arm / arme);
      }
      b.linie([4, 0, 0], [9, 0, 0], 11 / 16, 1, HELL, .6, 0);
    },

    signal(b) {
      const { z, N } = b, ringe = 7, r = j => 1 + j * 1.05, boden = -1.6;
      const summe = Array.from({ length: ringe }, (_, j) => r(j)).reduce((a, c) => a + c, 0);
      for (let i = 0; i < N * .68; i++) {
        let q = z() * summe, j = 0; while (j < ringe - 1 && q > r(j)) { q -= r(j); j++; }
        const a = z() * TAU, rr = r(j) + z.g() * .04;
        b.punkt(Math.cos(a) * rr, boden + z.g() * .02, Math.sin(a) * rr, j === 0 ? GRANAT : j === 1 ? SMARAGD : z() < .8 ? WEISS : GRAU, .22 + .5 * (1 - j / ringe));
      }
      for (let i = 0; i < N * .14; i++) { const h = Math.pow(z(), 1.5); b.punkt(z.g() * .05, boden + h * 8.5, z.g() * .05, HELL, .35 + .55 * (1 - h)); }
      for (let i = 0; i < N * .08; i++) b.punkt(z.g() * .2, boden + z.g() * .2, z.g() * .2, HELL, .6 + .3 * z());
      for (let j = 0; j < ringe; j++) {
        const pkt = [];
        for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; pkt.push([Math.cos(a) * r(j), boden, Math.sin(a) * r(j), j / (ringe - 1)]); }
        b.zug(pkt, j === 0 ? GRANAT : j === 1 ? SMARAGD : WEISS, .5 - j * .04, 0);
      }
      const strahl = [];
      for (let y = boden; y <= 7; y += .25) strahl.push([0, y, 0, (y - boden) / (7 - boden)]);
      b.zug(strahl, HELL, .55, .3);
    },

    stufen(b) {
      const { z, N } = b, abstand = .62, boden = -2.4, mitten = [-5.2, -.6, 4.6], farben = [GRANAT, WEISS, SMARAGD], kanten = [];
      const knoten = [], obenAuf = [];
      mitten.forEach((cx, j) => {
        const n = 3 + j, P = (i, k, l) => [cx + (i - (n - 1) / 2) * abstand, boden + k * abstand, (l - (n - 1) / 2) * abstand];
        for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) {
          knoten.push(P(i, k, l));
          const oben = k === n - 1;
          if (i + 1 < n) kanten.push([P(i, k, l), P(i + 1, k, l), oben ? farben[j] : WEISS, oben]);
          if (k + 1 < n) kanten.push([P(i, k, l), P(i, k + 1, l), WEISS, false]);
          if (l + 1 < n) kanten.push([P(i, k, l), P(i, k, l + 1), oben ? farben[j] : WEISS, oben]);
        }
        obenAuf.push([cx, boden + (n - 1) * abstand]);
      });
      for (const p of knoten) b.punkt(p[0], p[1], p[2], HELL, .6);
      const proKante = Math.max(1, Math.floor((N * .78 - knoten.length) / kanten.length));
      for (const [a, c, fa, oben] of kanten) for (let m = 1; m <= proKante; m++) {
        const u = m / (proKante + 1);
        b.punkt(a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u, fa === WEISS ? (z() < .7 ? WEISS : GRAU) : fa, oben ? .5 : .22 + .15 * z());
      }
      for (const [a, c, fa, oben] of kanten) b.linie(a, c, (a[0] + 7) / 14, (c[0] + 7) / 14, fa, oben ? .45 : .2, z());
      // Der Pfad über die drei Stufen (Rot → Grün), Lichtimpulse nach rechts.
      const pkt = [];
      for (let x = -7; x <= 7.5; x += .15) {
        let y = boden + .3;
        for (const [cx, top] of obenAuf) y = Math.max(y, top + .85 - Math.pow(Math.max(0, Math.abs(x - cx) - 1.2), 2) * .5);
        pkt.push([x, y, 0, (x + 7) / 14.5]);
      }
      b.zug(pkt, t => t < .5 ? GRANAT : SMARAGD, .75, 0);
      for (let i = 0; i < N * .08; i++) { const p = pkt[Math.floor(z() * pkt.length)]; b.punkt(p[0], p[1] + z.g() * .03, z.g() * .03, p[3] < .5 ? GRANAT : SMARAGD, .6 + .3 * z()); }
      for (const [cx, top] of obenAuf) b.marke(cx, top + 1.5, 0);
    },

    runden(b) {
      const K = S.kern, { z, N } = b, C = 8, R = 4.8, mitten = [];
      for (let i = 0; i < C; i++) {
        const y = 1 - (i + .5) / C * 2, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
        mitten.push([Math.cos(a) * r * R, y * R * .75, Math.sin(a) * r * R]);
      }
      const personen = mitten.map((m, ci) => {
        const n = K.norm(m), e1 = K.norm(K.cross(n, [0, 1, 0.01])), e2 = K.cross(n, e1);
        return Array.from({ length: 7 }, (_, p) => { const a = p / 7 * TAU; return K.add(m, K.add(K.mul(e1, Math.cos(a) * .85), K.mul(e2, Math.sin(a) * .85))).concat([[GRANAT, SMARAGD, WEISS][(ci + p) % 3]]); });
      });
      for (const runde of personen) for (const p of runde) for (let i = 0; i < 12; i++) b.punkt(p[0] + z.g() * .06, p[1] + z.g() * .06, p[2] + z.g() * .06, p[3] === WEISS ? HELL : p[3], .65 + .3 * z());
      while (!b.voll() && b.rest() > N * .04) { const m = mitten[Math.floor(z() * C)]; b.punkt(m[0] + z.g() * .55, m[1] + z.g() * .55, m[2] + z.g() * .55, z() < .7 ? WEISS : GRAU, .12 + .25 * z()); }
      for (const runde of personen) runde.forEach((p, i) => { const q = runde[(i + 1) % runde.length]; b.linie(p, q, 0, 1, p[3], .5, z()); b.linie(p, runde[(i + 3) % runde.length], 0, 1, WEISS, .18, z()); });
      mitten.forEach((m, i) => {
        const nah = mitten.map((q, j) => [K.len(K.sub(q, m)), j]).filter(([, j]) => j > i).sort((a, c) => a[0] - c[0]).slice(0, 2);
        for (const [, j] of nah) {
          const q = mitten[j], pkt = [];
          for (let k = 0; k <= 24; k++) { const u = k / 24, p = K.add(K.mul(m, 1 - u), K.mul(q, u)), auf = 1 + .18 * Math.sin(u * Math.PI); pkt.push([p[0] * auf, p[1] * auf, p[2] * auf, u]); }
          b.zug(pkt, WEISS, .32, z());
        }
      });
    },

    karte(b, o) {
      const K = S.kern, { z, N } = b, D = o.deutschland || DEUTSCHLAND, staedte = o.staedte || STAEDTE, start = o.start || staedte[0].name;
      const f = K.form(D.umriss), B = (o.breite ?? 12) * 2, k = B / (f.x1 - f.x0), mx = (f.x0 + f.x1) / 2, my = (f.y0 + f.y1) / 2, y0 = o.y ?? -3;
      const L = (sx, sy) => [(sx - mx) * k, y0, (sy - my) * k];
      const ort = s => L(D.ax * s.lon + D.bx, D.ay * s.lat + D.by);
      // Umriss: Punkte gleichmäßig entlang der Kante, dazu eine ruhige Linie.
      const rand = f.polys[0], laengen = rand.map((p, i) => Math.hypot(rand[(i + 1) % rand.length][0] - p[0], rand[(i + 1) % rand.length][1] - p[1]));
      const gesamt = laengen.reduce((a, c) => a + c, 0), nRand = Math.floor(N * .16);
      for (let i = 0; i < nRand; i++) {
        let d = z() * gesamt, j = 0; while (d > laengen[j]) { d -= laengen[j]; j++; }
        const a = rand[j], c = rand[(j + 1) % rand.length], u = d / laengen[j];
        const p = L(a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u); b.punkt(p[0], p[1], p[2], z() < .7 ? WEISS : GRAU, .35 + .25 * z());
      }
      b.zug(rand.concat([rand[0]]).map(p => L(p[0], p[1]).concat([0])), WEISS, .5, 0);
      // Städte: der Start als Knoten (Rot/Grün), die anderen hell; Lichtfäden vom Start in jede Stadt.
      const s0 = staedte.find(s => s.name === start) || staedte[0], P0 = ort(s0);
      for (const s of staedte) {
        const p = ort(s), istStart = s === s0;
        for (let i = 0; i < Math.max(8, N * (istStart ? .02 : .012)); i++) b.punkt(p[0] + z.g() * .09, p[1] + Math.abs(z.g()) * .05, p[2] + z.g() * .09, istStart ? (i % 2 ? SMARAGD : GRANAT) : HELL, .7 + .25 * z());
        b.marke(p[0], p[1] + .75, p[2]);
      }
      const faeden = o.faeden ?? 8;
      for (const s of staedte) {
        if (s === s0) continue;
        const P1 = ort(s), d = Math.hypot(P1[0] - P0[0], P1[2] - P0[2]);
        for (let t = 0; t < faeden; t++) {
          const quer = (t / (faeden - 1) - .5) * 1.1, nx = -(P1[2] - P0[2]) / d, nz = (P1[0] - P0[0]) / d, pkt = [];
          for (let i = 0; i <= 40; i++) {
            const u = i / 40, bauch = Math.sin(u * Math.PI);
            pkt.push([P0[0] + (P1[0] - P0[0]) * u + nx * quer * bauch, y0 + d * .28 * bauch + quer * .3 * bauch, P0[2] + (P1[2] - P0[2]) * u + nz * quer * bauch, u]);
          }
          b.zug(pkt, t % 2 ? SMARAGD : GRANAT, .3, t / faeden);
          for (let i = 0; i < N * .012; i++) { const p = pkt[Math.floor(z() * pkt.length)]; b.punkt(p[0], p[1], p[2], t % 2 ? SMARAGD : GRANAT, .3 + .4 * z()); }
        }
      }
      // Fläche als Punktraster (Punkt-Textur wie im Strahl der App).
      const flaeche = K.flaeche(f), h = Math.sqrt(flaeche / (Math.max(1, b.rest()) * .92));
      for (let sy = f.y0 + h / 2; sy < f.y1; sy += h) for (let sx = f.x0 + h / 2; sx < f.x1; sx += h) {
        if (!K.innen(f, sx, sy)) continue;
        const p = L(sx, sy); b.punkt(p[0], p[1], p[2], z() < .85 ? WEISS : GRAU, .16 + .2 * z());
      }
      b.fadenZiel(P0[0], P0[1], P0[2], o.fadenVor ?? 30, o.fadenNach ?? 26);
    },

    funken(b) {
      const { z, N } = b;
      for (let i = 0; i < N * .96; i++) { const q = z(), r = Math.pow(z(), .6); const a = z() * TAU, c = z() * 2 - 1, sq = Math.sqrt(1 - c * c); b.punkt(Math.cos(a) * sq * r * 6.5, c * r * 4.2, Math.sin(a) * sq * r * 4, q < .7 ? WEISS : q < .85 ? GRANAT : SMARAGD, .3 + .69 * z()); }
    },

    strahl(b, o) {
      const { z, N } = b, R = o.reihen ?? (o.handy ? 18 : 30), M = Math.floor(N * .84 / R);
      const leit = x => 1.1 * Math.sin(.42 * x + .6) + 2.4 * gauss(x, -3, .9) - 1.7 * gauss(x, 2.8, .7) + .8 * gauss(x, 6.5, .6);
      const bauch = x => gauss(x, -3, 1.4) + gauss(x, 2.8, 1.2) + .6 * gauss(x, 6.5, 1);
      const lage = (x, j) => { const o2 = j / (R - 1) - .5; return [x, leit(x) * (1 + o2 * .35) + o2 * (.5 + 1.6 * bauch(x)), o2 * 1.4 + Math.sin(x * .7 + j * 1.3) * .12]; };
      const farbe = j => { const o2 = j / (R - 1) - .5; return o2 < -.22 ? SMARAGD : o2 > .22 ? GRANAT : WEISS; };
      for (let j = 0; j < R; j++) for (let i = 0; i < M; i++) {
        const x = -10 + z() * 20, p = lage(x, j);
        b.punkt(p[0], p[1] + z.g() * .02, p[2], z() < .5 ? farbe(j) : WEISS, .14 + .4 * bauch(x) + .1 * z());
      }
      for (let j = 0; j < R; j++) {
        const pkt = [];
        for (let x = -10; x <= 10.001; x += .12) pkt.push(lage(x, j).concat([(x + 10) / 20]));
        b.zug(pkt, farbe(j), .2, j / R);
      }
      b.linie([-10, 0, 0], [10, 0, 0], 0, 1, HELL, .3, 0);
      for (const y of [-3.4, 3.4]) for (let x = -10; x < 10; x += .6) b.linie([x, y, 0], [x + .3, y, 0], 0, 0, GRAU, .2, 0);
    },

    wirkung(b) {
      // Menschen in einer Runde (links), daraus drei Ströme nach rechts, die in einem Punkt zusammenlaufen.
      const { z, N } = b, menschen = [], ys = [1.8, 0, -1.8], farben = [GRANAT, WEISS, SMARAGD], x0 = .6, von = -2.4 + x0, bis = 7.4 + x0, lang = bis - von;
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; menschen.push([-4.3 + x0 + Math.cos(a) * 1.7, Math.sin(a) * 1.7, Math.sin(a * 2) * .4]); }
      for (const [i, m] of menschen.entries()) for (let k = 0; k < 16; k++) b.punkt(m[0] + z.g() * .07, m[1] + z.g() * .07, m[2] + z.g() * .07, i % 3 === 0 ? GRANAT : i % 3 === 1 ? SMARAGD : HELL, .7 + .25 * z());
      menschen.forEach((m, i) => { b.linie(m, menschen[(i + 1) % 9], 0, 0, WEISS, .4, z()); b.linie(m, menschen[(i + 4) % 9], 0, 0, GRAU, .2, z()); });
      const strom = (j, t, x) => { const u = (x - von) / lang, quer = (t / 9 - .5) * .7 * (1 - u); return [x, ys[j] * (1 - S.kern.sanft(u)) + quer, quer * .5]; };
      for (let j = 0; j < 3; j++) {
        for (let t = 0; t < 10; t++) {
          const pkt = [];
          for (let x = von; x <= bis + .001; x += .15) pkt.push(strom(j, t, x).concat([(x - von) / lang]));
          b.zug(pkt, farben[j], .32, t / 10);
          menschen.slice(j * 3, j * 3 + 3).forEach(m => b.linie(m, pkt[0], 0, 0, farben[j], .22, z()));
        }
        b.marke(von + lang * .36, ys[j] * (1 - S.kern.sanft(.36)) + .55, 0);
      }
      while (b.rest() > N * .05) { const j = Math.floor(z() * 3), x = von + z() * lang, p = strom(j, z() * 9, x); b.punkt(p[0], p[1] + z.g() * .04, p[2], z() < .6 ? farben[j] : WEISS, .2 + .45 * z()); }
      for (let i = 0; i < N * .03; i++) b.punkt(bis + z.g() * .12, z.g() * .12, z.g() * .12, HELL, .8);
    },

    zeichen(b, o) {
      const K = S.kern, { z, N } = b, L = o.logo;
      if (!L) return;
      const B = o.breite ?? 24, k = B / L.breite, mx = L.breite / 2, my = L.hoehe / 2;
      const teile = [
        [K.form(L.make), WEISS, .75, 1], [L.strichMa, GRANAT, .8, 2.2], [L.strichKe, SMARAGD, .8, 2.2],
        [K.form(L.knotenMa), GRANAT, .95, 3.5], [K.form(L.knotenKe), SMARAGD, .95, 3.5], [K.form(L.zusatz), GRAU, .55, 1.7],
      ];
      const gewicht = teile.map(t => K.flaeche(t[0]) * t[3]), summe = gewicht.reduce((a, c) => a + c, 0);
      teile.forEach((t, i) => { for (const [x, y] of K.abtasten(t[0], Math.floor(N * .9 * gewicht[i] / summe), z)) b.punkt((x - mx) * k, -(y - my) * k, z.g() * .03, t[1], t[2] * (.75 + .25 * z())); });
      const kx = (L.knoten[0] - mx) * k, ky = -(L.knoten[1] - my) * k;
      b.fadenZiel(kx, ky, 0, o.fadenVor ?? 34, 1e5);
      b.marke(-mx * k, my * k, 0); b.marke(mx * k, -my * k, 0);
    },
  };

  /**
   * Baut die ganze Szene aus einem Drehbuch: Netz (Neuronen + Kanten), Lichtfäden und Staub entlang des Pfads und je
   * Zustand eine Formation (N Teilchen — alle Formationen haben gleich viele, damit sie ineinander übergehen).
   */
  function bauen(drehbuch, opt) {
    const K = S.kern, o = opt || {}, handy = !!o.handy;
    const Z = K.zustaende(drehbuch.zustaende);
    const N = o.anzahl ?? (handy ? 1800 : 4200);
    const formationen = Z.map((zst, i) => {
      const fn = FORMEN[zst.formation];
      const r = K.rahmen(zst.s); r.s = zst.s;
      const b = bauer(N, r, K.zufall(1000 + i * 7919), zst.dreh);
      if (fn) fn(b, Object.assign({ s: zst.s, handy, logo: o.logo }, zst.optionen));
      return b.fertig();
    });
    const z = K.zufall(drehbuch.saat ?? 4102026);
    const saat = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { saat[i * 4] = z(); saat[i * 4 + 1] = z() * Math.PI * 2; saat[i * 4 + 2] = .65 + z() * z() * 1.1; saat[i * 4 + 3] = z(); }
    const ziele = formationen.flatMap(f => f.ziele).sort((a, c) => a.s - c.s);
    const von = (drehbuch.von ?? Z[0].s - 40), bis = Z[Z.length - 1].s + 12;
    return { Z, N, formationen, saat, ziele, von, bis, netz: netz(Z, drehbuch.netz || {}, handy, von, bis), faeden: faeden(handy, von, bis, o.faeden), staub: staub(handy, von, bis) };
  }

  /** Das Neuronennetz um den Pfad: dicht am Anfang, dünner später, frei um die Formationen und über der Karte. */
  function netz(Z, cfg, handy, von, bis) {
    const K = S.kern, z = K.zufall(cfg.saat ?? 52026), n = cfg.anzahl ?? (handy ? 1100 : 2600);
    const dichtBis = cfg.dichtBis ?? 140, anker = Z.filter(q => q.formation !== 'weg').map(q => q.s);
    const leer = Z.filter(q => q.netzLeer).map(q => [q.s - q.netzLeer[0], q.s + q.netzLeer[1]]);
    const pos = [], saat = [];
    let versuche = 0;
    while (pos.length < n * 4 && versuche++ < n * 60) {
      const s = von + 10 + z() * (bis - von + 10);
      let w = s < dichtBis ? 1 : .42;
      for (const [a, c] of leer) if (s > a && s < c) w *= .12;
      if (z() > w) continue;
      const rad = 1.7 + Math.abs(z.g()) * 7 + (z() < .15 ? z() * 16 : 0);
      const nah = anker.reduce((m, a) => Math.min(m, Math.abs(s - a)), 1e9);
      if (rad < 9 && nah < 13 && z() > Math.pow(nah / 13, 2)) continue;
      const a = z() * Math.PI * 2, p = K.lokal(K.rahmen(s), Math.cos(a) * rad, Math.sin(a) * rad * .8, 0), q = z();
      pos.push(p[0], p[1], p[2], (q < .82 ? (z() < .7 ? WEISS : GRAU) : q < .91 ? GRANAT : SMARAGD) + .2 + .55 * z() * z());
      saat.push(0, z() * Math.PI * 2, .7 + z() * .9, z());
    }
    // Kanten: je Knoten bis zu drei nächste Nachbarn (≤ 3,1), über ein Raster gesucht.
    const m = pos.length / 4, zelle = 3.1, gitter = new Map(), key = (x, y, q) => `${x},${y},${q}`;
    for (let i = 0; i < m; i++) {
      const k = key(Math.floor(pos[i * 4] / zelle), Math.floor(pos[i * 4 + 1] / zelle), Math.floor(pos[i * 4 + 2] / zelle));
      (gitter.get(k) || gitter.set(k, []).get(k)).push(i);
    }
    const kanten = [], gesehen = new Set();
    for (let i = 0; i < m; i++) {
      const x = pos[i * 4], y = pos[i * 4 + 1], q = pos[i * 4 + 2], gx = Math.floor(x / zelle), gy = Math.floor(y / zelle), gz = Math.floor(q / zelle), nah = [];
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (let d = -1; d <= 1; d++) for (const j of gitter.get(key(gx + a, gy + c, gz + d)) || []) {
        if (j === i) continue;
        const dd = Math.hypot(pos[j * 4] - x, pos[j * 4 + 1] - y, pos[j * 4 + 2] - q);
        if (dd < zelle) nah.push([dd, j]);
      }
      nah.sort((a, c) => a[0] - c[0]);
      for (const [, j] of nah.slice(0, 3)) {
        const k = i < j ? i * 100000 + j : j * 100000 + i;
        if (gesehen.has(k)) continue; gesehen.add(k);
        const ph = z(), wa = Math.floor(pos[i * 4 + 3]) + .45, wb = Math.floor(pos[j * 4 + 3]) + .45;
        kanten.push(x, y, q, 0, wa, ph, pos[j * 4], pos[j * 4 + 1], pos[j * 4 + 2], 1, wb, ph);
      }
    }
    return { punkte: new Float32Array(pos), saat: new Float32Array(saat), kanten: new Float32Array(kanten) };
  }

  /** Lichtfäden entlang des Pfads: Liniensegmente (s, Saat, Strang); die Lage rechnet der Shader (kern.faden). */
  function faeden(handy, von, bis, anzahl) {
    const z = S.kern.zufall(77), n = anzahl ?? (handy ? 22 : 44), schritt = handy ? 1.1 : .75, aus = [];
    for (let i = 0; i < n; i++) {
      const saat = z(), q = z(), strang = q < .45 ? 0 : q < .9 ? 1 : 2;
      for (let s = von; s < bis; s += schritt) aus.push(s, saat, strang, s + schritt, saat, strang);
    }
    return new Float32Array(aus);
  }
  /** Staub, der entlang der Fäden nach vorn fließt (s0, Saat, Strang). */
  function staub(handy, von, bis) {
    const z = S.kern.zufall(91), n = handy ? 700 : 1800, aus = [];
    for (let i = 0; i < n; i++) { const q = z(); aus.push(von + z() * (bis - von), z(), q < .45 ? 0 : q < .9 ? 1 : 2); }
    return new Float32Array(aus);
  }

  /** Das Logo aus seinem SVG-Text (Browser: svg.zeichen der Seite, Node: assets/logo/wortmarke.svg) — eine Quelle. */
  function logoAusSvg(svg) {
    const K = S.kern, attr = (t, n) => (new RegExp(`\\s${n}="([^"]*)"`).exec(t) || [])[1] || '';
    const vb = attr(/<svg\b[^>]*>/.exec(svg)[0], 'viewBox').trim().split(/\s+/).map(Number);
    const pfade = Array.from(svg.matchAll(/<path\b[^>]*>/g), m => ({ d: attr(m[0], 'd'), fill: attr(m[0], 'fill').toUpperCase() }));
    const rechtecke = Array.from(svg.matchAll(/<rect\b[^>]*>/g), m => ({ f: K.rechteck(+attr(m[0], 'x'), +attr(m[0], 'y'), +attr(m[0], 'width'), +attr(m[0], 'height')), fill: attr(m[0], 'fill').toUpperCase() }));
    const ROT = '#C9465C', GRUEN = '#2FA878', pf = fill => (pfade.find(p => p.fill === fill) || {}).d || '';
    const knotenMa = pf(ROT), fk = K.form(knotenMa);
    return {
      breite: vb[2], hoehe: vb[3], make: pf('#ECEFED'), zusatz: pf('#9AA5A8'), knotenMa, knotenKe: pf(GRUEN),
      strichMa: (rechtecke.find(r => r.fill === ROT) || {}).f, strichKe: (rechtecke.find(r => r.fill === GRUEN) || {}).f,
      knoten: [fk.x1, (fk.y0 + fk.y1) / 2],
    };
  }

  S.formationen = { FARBE, PALETTE, DEUTSCHLAND, STAEDTE, FORMEN, bauer, bauen, logoAusSvg };
})(typeof window !== 'undefined' ? window : globalThis);
