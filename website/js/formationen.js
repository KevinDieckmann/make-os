// MAKE Innovation · Landingpage: Formationen der Neuronen-Bühne (03.10.2026)
// Reine Geometrie, ohne DOM — dieselbe Datei läuft im Browser (js/neuronen.js) und in Node (website/standbild.mjs).
// Weiterentwickelt aus der Bühne der früheren Homepage (homepage/js/formationen.js, Durchgang 7: ruhige, dünne Linien,
// wenige Knoten, kein Glühen — Kevin: „wie ein Auge“, „das muss nur sauber sein“).
//
// Jedes Teilchen hat eine feste Herkunft (Familie): 0 = Rot (Malin, Strich unter MA), 1 = Grün (Kevin, Strich unter
// KE), 2 = Tinte (die Buchstaben MAKE). Jede Formation legt für N Teilchen fest: Zielpunkt im Einheitsraum (−1…1,
// y nach unten), Farbe (Index in FARBEN) und Kanten (k nächste Nachbarn innerhalb einer Gruppe, plus Brücken).
//
// Formationen je Kapitel (index.html, data-formation):
//   laerm    Die Lage        — zerfasertes Netz: viele kleine Inseln, grau, kaum verbunden
//   impuls   Innovation      — zwei Stränge (Rot, Grün) laufen zusammen, ein Impuls geht gemeinsam weiter
//   pfad     Beratung        — Struktur: drei wachsende Gitter (Analyse, Aufbau, Skalierung), ein Pfad darüber
//   kreise   Make.One        — Runden von Menschen, Rot und Grün gemischt, untereinander verbunden
//   fokus    Beteiligungen   — ein ruhiger Ring (der Markt), darin wenige, dichte, helle Knoten
//   kern     Warum wir       — Rot und Grün verschmelzen zu einem stabilen Kern (Phyllotaxis)
// Das Logo (Start, Kontakt) baut js/neuronen.js aus dem SVG der Seite — die Teilchen sitzen dort genau auf den Strichen.
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const TAU = Math.PI * 2, GOLD = Math.PI * (3 - Math.sqrt(5));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  /** Fester Zufall: gleiche Geometrie bei jedem Laden (die Standbilder passen zum Netz). */
  function zufallsquelle(saat) {
    let s = saat >>> 0;
    const z = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    z.gauss = () => (z() + z() + z() - 1.5) * 1.15;
    return z;
  }

  /** k nächste Nachbarn (einmalig), nur wo erlaubt(i, j). */
  function nachbarn(pos, k, erlaubt) {
    const n = pos.length / 2, kanten = [], gesehen = new Set();
    for (let i = 0; i < n; i++) {
      const best = [];
      for (let j = 0; j < n; j++) {
        if (i === j || (erlaubt && !erlaubt(i, j))) continue;
        const dx = pos[i * 2] - pos[j * 2], dy = pos[i * 2 + 1] - pos[j * 2 + 1], d = dx * dx + dy * dy;
        if (best.length < k) { best.push([d, j]); best.sort((a, b) => a[0] - b[0]); }
        else if (d < best[k - 1][0]) { best[k - 1] = [d, j]; best.sort((a, b) => a[0] - b[0]); }
      }
      for (const [, j] of best) { const key = i < j ? i * n + j : j * n + i; if (!gesehen.has(key)) { gesehen.add(key); kanten.push(i, j); } }
    }
    return kanten;
  }

  /** Farben "r,g,b" — wie css/seite.css und das Logo (Granat, Smaragd, Grau, Tinte). */
  const FARBEN = [[201, 70, 92], [47, 168, 120], [96, 108, 112], [236, 239, 237]];
  const ROT = 0, GRUEN = 1, GRAU = 2, TINTE = 3;

  /** Familie je Teilchen: 40 % Rot, 40 % Grün, 20 % Tinte, gleichmäßig verschränkt. */
  function familien(N) { const f = new Uint8Array(N); for (let i = 0; i < N; i++) { const m = i % 5; f[i] = m === 4 ? 2 : m % 2; } return f; }

  /** Punkt auf einer quadratischen Bézierkurve. */
  const bez = (p0, p1, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  /** Punkt entlang einer Polylinie (u ∈ 0…1, gleichmäßig nach Länge). */
  function entlang(linie, u) {
    let L = 0; const seg = []; for (let i = 1; i < linie.length; i++) { const l = Math.hypot(linie[i][0] - linie[i - 1][0], linie[i][1] - linie[i - 1][1]); seg.push(l); L += l; }
    let rest = clamp(u, 0, 1) * L;
    for (let i = 1; i < linie.length; i++) { const l = seg[i - 1]; if (rest <= l || i === linie.length - 1) { const t = l ? clamp(rest / l, 0, 1) : 0; return [linie[i - 1][0] + (linie[i][0] - linie[i - 1][0]) * t, linie[i - 1][1] + (linie[i][1] - linie[i - 1][1]) * t]; } rest -= l; }
    return linie[linie.length - 1];
  }
  /** Indizes je Familie. */
  const nachFamilie = (fam, f) => { const r = []; for (let i = 0; i < fam.length; i++) if (fam[i] === f) r.push(i); return r; };

  const FORM = {};

  // ── Die Lage: Lärm. Viele kleine Inseln, verstreut; meist grau, nur wenige Teilchen behalten ihre Farbe. ──
  FORM.laerm = (N, fam, z) => {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N), gruppe = new Uint16Array(N), inseln = [];
    for (let k = 0; k < 17; k++) { const a = z() * TAU, r = .25 + .8 * Math.sqrt(z()); inseln.push([Math.cos(a) * r * 1.12, Math.sin(a) * r * .86]); }
    for (let i = 0; i < N; i++) {
      const lose = z() < .14, g = lose ? 999 : Math.floor(z() * inseln.length);
      gruppe[i] = g;
      if (lose) { pos[i * 2] = (z() * 2 - 1) * 1.2; pos[i * 2 + 1] = (z() * 2 - 1) * .95; }
      else { pos[i * 2] = inseln[g][0] + z.gauss() * .085; pos[i * 2 + 1] = inseln[g][1] + z.gauss() * .07; }
      farbe[i] = fam[i] < 2 && z() < .22 ? fam[i] : GRAU;
    }
    return { pos, farbe, kanten: nachbarn(pos, 2, (i, j) => gruppe[i] === gruppe[j] && gruppe[i] !== 999), reichweite: .24, unruhe: 1 };
  };

  // ── Innovation: zwei Stränge laufen in einem Knoten zusammen, gemeinsam geht der Impuls weiter (verflochten). ──
  // u = Lage entlang des Wegs (0 Anfang … .5 Knoten … 1 Ende) — darauf läuft der Impuls.
  FORM.impuls = (N, fam, z) => {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N), u = new Float32Array(N), gruppe = new Uint8Array(N);
    const J = [-.08, .02], rotRein = [[-1.12, -.66], [-.55, -.66], J], gruenRein = [[-1.12, .7], [-.55, .7], J];
    const setze = (i, x, y, g, uu, f) => { pos[i * 2] = x; pos[i * 2 + 1] = y; gruppe[i] = g; u[i] = uu; farbe[i] = f; };
    for (const f of [0, 1]) {
      const idx = nachFamilie(fam, f), rein = Math.round(idx.length * .55);
      idx.forEach((i, k) => {
        if (k < rein) { const t = (k + .5) / rein, [x, y] = bez(...(f ? gruenRein : rotRein), t); setze(i, x + z.gauss() * .012, y + z.gauss() * .012, f, t * .5, f); }
        else { // verflochten weiter: zwei Sinus-Stränge um eine leicht steigende Linie
          const t = (k - rein + .5) / (idx.length - rein), x = J[0] + t * 1.2, mitte = J[1] - t * .18, phase = t * TAU * 1.6 + (f ? Math.PI : 0);
          setze(i, x + z.gauss() * .01, mitte + Math.sin(phase) * .085 * Math.min(1, t * 4) + z.gauss() * .01, 2 + f, .5 + t * .5, f);
        }
      });
    }
    // Tinte: der Funke im Knoten (eng) und ein leiser Hof darum.
    nachFamilie(fam, 2).forEach((i, k, alle) => {
      const eng = k < alle.length * .35, a = z() * TAU, r = eng ? .05 * Math.sqrt(z()) : .1 + .22 * Math.sqrt(z());
      setze(i, J[0] + Math.cos(a) * r, J[1] + Math.sin(a) * r * .9, eng ? 4 : 5, .5, eng ? TINTE : GRAU);
    });
    return { pos, farbe, kanten: nachbarn(pos, 2, (i, j) => gruppe[i] === gruppe[j] && gruppe[i] !== 5), reichweite: .3, extra: { u } };
  };

  // ── Beratung: Struktur. Drei Gitter wachsen von links nach rechts (Analyse, Aufbau, Skalierung); Spalten
  //    abwechselnd Rot und Grün — ein Team; die Tinte zeichnet den Pfad über die drei Stufen. ──
  FORM.pfad = (N, fam, z) => {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N), gruppe = new Uint8Array(N);
    const BL = [{ x: -.7, h: .55 }, { x: 0, h: .9 }, { x: .7, h: 1.25 }], breite = .34, boden = .66, spalten = 5;
    const gitter = Array.from({ length: N }, (_, i) => i).filter(i => fam[i] < 2), tinte = nachFamilie(fam, 2);
    // Plätze je Block anteilig zur Höhe; Zeilen von unten nach oben, Spalten abwechselnd Rot und Grün (ein Team).
    const summeH = BL.reduce((s, b) => s + b.h, 0), platz = new Map(), kanten = [];
    let k = 0;
    BL.forEach((b, bi) => {
      const n = bi === BL.length - 1 ? gitter.length - k : Math.round(gitter.length * b.h / summeH);
      const zeilen = Math.ceil(n / spalten), dy = b.h / zeilen;
      for (let j = 0; j < n; j++, k++) {
        const i = gitter[k], c = j % spalten, r = Math.floor(j / spalten);
        pos[i * 2] = b.x - breite / 2 + (c + .5) * breite / spalten + z.gauss() * .004; pos[i * 2 + 1] = boden - (r + .5) * dy + z.gauss() * .004;
        farbe[i] = c % 2; gruppe[i] = bi; platz.set(`${bi}|${c}|${r}`, i);
      }
    });
    // Kanten: ein sauberes Gitter (rechts und oben je Platz).
    for (const [schl, i] of platz) { const [bi, c, r] = schl.split('|').map(Number); const re = platz.get(`${bi}|${c + 1}|${r}`), ob = platz.get(`${bi}|${c}|${r + 1}`); if (re !== undefined) kanten.push(i, re); if (ob !== undefined) kanten.push(i, ob); }
    const weg = [[-1.1, boden + .02], [BL[0].x, boden - BL[0].h - .1], [BL[1].x, boden - BL[1].h - .1], [BL[2].x, boden - BL[2].h - .1], [1.08, boden - BL[2].h - .26]];
    tinte.forEach((i, j) => { const [x, y] = entlang(weg, (j + .5) / tinte.length); pos[i * 2] = x; pos[i * 2 + 1] = y; farbe[i] = TINTE; gruppe[i] = 9; });
    for (let j = 1; j < tinte.length; j++) kanten.push(tinte[j - 1], tinte[j]);
    return { pos, farbe, kanten, reichweite: .2 };
  };

  // ── Make.One: Runden von Menschen. Eine Runde in der Mitte, sechs darum; an jedem Tisch Rot und Grün gemischt
  //    (jung und erfahren). Zwischen den Runden Brücken — das Netzwerk. ──
  FORM.kreise = (N, fam, z) => {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N), gruppe = new Uint8Array(N);
    const Z = [[0, 0, .21]]; for (let k = 0; k < 6; k++) Z.push([Math.cos(k / 6 * TAU - Math.PI / 2) * .7, Math.sin(k / 6 * TAU - Math.PI / 2) * .66, .16]);
    // Plätze: je Runde gleichmäßig auf dem Umfang; Teilchen der Reihe nach, damit Rot und Grün sich abwechseln.
    const reihe = Array.from({ length: N }, (_, i) => i).filter(i => fam[i] < 2), tinte = nachFamilie(fam, 2);
    const proRunde = Z.map(([, , r]) => r), summe = proRunde.reduce((s, r) => s + r, 0);
    let k = 0;
    Z.forEach(([cx, cy, r], g) => {
      const n = g === Z.length - 1 ? reihe.length - k : Math.round(reihe.length * r / summe);
      for (let j = 0; j < n && k < reihe.length; j++, k++) {
        const i = reihe[k], a = j / n * TAU + g * .5, rr = r * (1 + z.gauss() * .025);
        pos[i * 2] = cx + Math.cos(a) * rr; pos[i * 2 + 1] = cy + Math.sin(a) * rr; farbe[i] = fam[i]; gruppe[i] = g;
      }
    });
    // Tinte: leise Mitte jeder Runde (der Tisch), hell nur in der mittleren Runde.
    tinte.forEach((i, j) => { const g = j % Z.length, [cx, cy, r] = Z[g], a = z() * TAU, rr = r * .45 * Math.sqrt(z()); pos[i * 2] = cx + Math.cos(a) * rr; pos[i * 2 + 1] = cy + Math.sin(a) * rr; farbe[i] = g === 0 ? TINTE : GRAU; gruppe[i] = 10 + g; });
    const kanten = nachbarn(pos, 2, (i, j) => gruppe[i] === gruppe[j] && gruppe[i] < 10);
    // Brücken: jede äußere Runde zur Mitte (2) und zur Nachbarrunde (1).
    const inRunde = g => reihe.filter(i => gruppe[i] === g);
    for (let g = 1; g < Z.length; g++) {
      const a = inRunde(g), m = inRunde(0), nb = inRunde(g === Z.length - 1 ? 1 : g + 1);
      const naechster = (von, zu) => { let best = zu[0], bd = 1e9; for (const j of zu) { const d = Math.hypot(pos[von * 2] - pos[j * 2], pos[von * 2 + 1] - pos[j * 2 + 1]); if (d < bd) { bd = d; best = j; } } return best; };
      const zuMitte = a.slice().sort((p, q) => Math.hypot(pos[p * 2], pos[p * 2 + 1]) - Math.hypot(pos[q * 2], pos[q * 2 + 1]));
      for (let b = 0; b < 2; b++) kanten.push(zuMitte[b * 2], naechster(zuMitte[b * 2], m));
      const zuNb = a.slice().sort((p, q) => Math.hypot(pos[p * 2] - Z[g === Z.length - 1 ? 1 : g + 1][0], pos[p * 2 + 1] - Z[g === Z.length - 1 ? 1 : g + 1][1]) - Math.hypot(pos[q * 2] - Z[g === Z.length - 1 ? 1 : g + 1][0], pos[q * 2 + 1] - Z[g === Z.length - 1 ? 1 : g + 1][1]));
      kanten.push(zuNb[0], naechster(zuNb[0], nb));
    }
    return { pos, farbe, kanten, reichweite: 1.1 };
  };

  // ── Beteiligungen: Fokus. Ein ruhiger Ring (der Markt), darin wenige dichte, helle Knoten — ausgewählt. ──
  FORM.fokus = (N, fam, z) => {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N), gruppe = new Uint8Array(N);
    const K = [[-.36, -.2, .13], [.3, -.32, .12], [.04, .34, .14]];
    let k = 0;
    for (let i = 0; i < N; i++) {
      const imKnoten = (i * 7) % 10 < 3;
      if (imKnoten) { const g = k++ % 3, [cx, cy, r] = K[g], a = z() * TAU, rr = r * Math.sqrt(z()); pos[i * 2] = cx + Math.cos(a) * rr; pos[i * 2 + 1] = cy + Math.sin(a) * rr; farbe[i] = fam[i] === 2 ? TINTE : fam[i]; gruppe[i] = g; }
      else { const a = z() * TAU, rr = .94 + z.gauss() * .035; pos[i * 2] = Math.cos(a) * rr * 1.08; pos[i * 2 + 1] = Math.sin(a) * rr * .92; farbe[i] = GRAU; gruppe[i] = 5; }
    }
    const kanten = nachbarn(pos, 2, (i, j) => gruppe[i] === gruppe[j]);
    // Wenige Fäden vom Ring zu den Knoten: Netzwerk und Sichtbarkeit fließen hinein.
    const ring = Array.from({ length: N }, (_, i) => i).filter(i => gruppe[i] === 5);
    for (let g = 0; g < 3; g++) { const kn = Array.from({ length: N }, (_, i) => i).filter(i => gruppe[i] === g); for (let b = 0; b < 2; b++) kanten.push(kn[(b * 5) % kn.length], ring[(g * 37 + b * 61) % ring.length]); }
    return { pos, farbe, kanten, reichweite: 1.25 };
  };

  // ── Warum wir: Rot und Grün verschmelzen zu einem stabilen Kern (Phyllotaxis, Farben verschränkt);
  //    innen ein heller Kern, außen eine leise Bahn. Dreht sich sehr langsam. ──
  FORM.kern = (N, fam, z) => {
    const pos = new Float32Array(N * 2), farbe = new Uint8Array(N), gruppe = new Uint8Array(N);
    const farbig = Array.from({ length: N }, (_, i) => i).filter(i => fam[i] < 2), tinte = nachFamilie(fam, 2);
    const rot = farbig.filter(i => fam[i] === 0), gruen = farbig.filter(i => fam[i] === 1), reihe = [];
    for (let k = 0; k < Math.max(rot.length, gruen.length); k++) { if (k < rot.length) reihe.push(rot[k]); if (k < gruen.length) reihe.push(gruen[k]); }
    const nKern = Math.round(tinte.length * .3), gesamt = reihe.length + nKern;
    // Innen der helle Kern (Tinte), dann Rot/Grün im Wechsel — Spirale nach dem goldenen Winkel.
    const spirale = [...tinte.slice(0, nKern), ...reihe];
    spirale.forEach((i, k) => { const r = .74 * Math.sqrt((k + .5) / gesamt), a = k * GOLD; pos[i * 2] = Math.cos(a) * r; pos[i * 2 + 1] = Math.sin(a) * r; farbe[i] = k < nKern ? TINTE : fam[i]; gruppe[i] = 0; });
    tinte.slice(nKern).forEach((i, k, alle) => { const a = (k + .5) / alle.length * TAU, r = .96 + z.gauss() * .012; pos[i * 2] = Math.cos(a) * r; pos[i * 2 + 1] = Math.sin(a) * r; farbe[i] = GRAU; gruppe[i] = 1; });
    return { pos, farbe, kanten: nachbarn(pos, 2, (i, j) => gruppe[i] === gruppe[j]), reichweite: .2, drehen: true };
  };

  function bauen(name, N, saat) {
    const f = FORM[name]; if (!f) return null;
    const fam = familien(N);
    return Object.assign({ name, fam }, f(N, fam, zufallsquelle(saat || 3102026)));
  }

  wurzel.MakeFormationen = { FARBEN, ROT, GRUEN, GRAU, TINTE, FORM, bauen, familien, nachbarn, zufallsquelle };
})(typeof globalThis !== 'undefined' ? globalThis : this);
