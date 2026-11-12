/* ─── MAKE Studios · Testseite: der Scroll-Film (Prototyp, nicht online) ──────────────────────────────
   EIN Fortschritt p (0 … 1) über die Spur .film steuert alles. Der Zeitplan (PLAN) legt fest, wie viel Scrollweg jede
   Szene bekommt: Intro → der Bildschirm wendet sich zur ersten Karte des Karussells → die Blende öffnet sich zur
   Analyse (ein Handy mit einer Beispielseite, daneben zwei Zahlen) → Streifen quer → Ergebnis: die fertigen Seiten als Bildschirme im Raum →
   Vorhang mit Chrom-Blende. Ohne Framework, ohne Bibliothek. Stile nur über CSSOM (style.setProperty): kein
   Inline-Stil im HTML, CSP-tauglich. Ein kleiner WebGL-Kontext (Chrom-Blende im Kontakt-Bild) mit CSS-Rückfall.
   Welche Aufnahme gerade läuft, sagt der Film an (regie); geladen und abgespielt wird in seite.js.
   „Bewegung reduzieren“, fehlende Teile oder ein Fehler → statisch.css (ruhige Seite). */
(function () {
  'use strict';

  const D = document, H = D.documentElement, W = window;
  const $ = (s, r) => (r || D).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || D).querySelectorAll(s));

  // ─── Rechnen ───
  const klemme = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const abschnitt = (x, a, b) => klemme((x - a) / (b - a));
  const mix = (a, b, t) => a + (b - a) * t;
  const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const aus = t => 1 - Math.pow(1 - t, 3);
  // n Haltepunkte mit weichen Übergängen; `halt` = Anteil je Stufe, der stehen bleibt (zum Lesen).
  const stufen = (t, n, halt) => { const s = t * (n - 1); const i = Math.min(Math.floor(s), n - 2); const f = s - i; return i + inOut(klemme((f - halt / 2) / (1 - halt))); };
  const zwischen = (liste, x) => { const i = Math.min(Math.floor(x), liste.length - 2); return mix(liste[i], liste[i + 1], x - i); };
  const r1 = x => Math.round(x * 10) / 10;
  const r3 = x => Math.round(x * 1000) / 1000;
  const zwei = n => (n < 10 ? '0' : '') + n;
  const RAD = Math.PI / 180;

  // ─── Teile der Seite ───
  const film = $('#film'), buehne = $('.buehne'), kopf = $('.kopf');
  const held = $('.szene-held'), zeilen = $$('.held-titel .zeile'), laufband = $('.laufband'), branchen = $('.szene-branchen');
  const rahmen = $('.karussell-rahmen'), karussell = $('.karussell'), karten = $$('.karte'), innen0 = $('.karte-0 .karte-innen'), schirm = $('.schirm');
  const blende = $('.blende'), analyse = $('.szene-analyse'), kennzahlen = $('.kennzahlen');
  const kennA = $('.kennzahl-a'), kennB = $('.kennzahl-b'), kennH = $('.kennzahl-handy'), zaehler = $$('.zaehler');
  const streifen = $('.streifen'), spur = $('.streifen-spur'), tafeln = $$('.tafel');
  const ergebnis = $('.ergebnis'), ergKopf = $('.ergebnis-kopf'), ergText = $('.ergebnis-text'), werke = $$('.werk'), werkTexte = $$('.werk-text');
  const vorhang = $('.vorhang'), chrom = $('canvas.chrom'), zielSzene = $('.szene-ziel');
  const anzeige = $('.anzeige'), kapNr = $('.anzeige-kapitel b'), balken = $('.anzeige-balken i');
  const zeitAnzeige = $('.anzeige-zeit'), pause = $('.anzeige-pause');
  const statischLink = $('link[href="statisch.css"]'), themaMeta = $('meta[name="theme-color"]');

  const noetig = [film, buehne, kopf, held, laufband, branchen, rahmen, karussell, innen0, schirm, blende, analyse, kennzahlen,
    kennA, kennB, kennH, streifen, spur, ergebnis, ergKopf, ergText, vorhang, chrom, zielSzene, anzeige, kapNr, balken, zeitAnzeige, pause, statischLink];
  if (noetig.some(e => !e) || karten.length !== 4 || zeilen.length !== 2 || tafeln.length < 2 || werke.length < 2 || werkTexte.length !== werke.length) {
    if (statischLink) statischLink.media = 'all';
    return;
  }
  const attrappen = tafeln.map(t => $('.attrappe', t));
  let kapName = kapNr.nextSibling;
  if (!kapName || kapName.nodeType !== 3) { kapName = D.createTextNode(' '); kapNr.parentNode.insertBefore(kapName, kapNr.nextSibling); }

  // Flächen für Aufnahmen: der Film sagt an, welche gerade laufen soll (höchstens zwei), seite.js spielt ab.
  const flSchirm = $('[data-aufnahme]', schirm);
  const flKarten = karten.map((k, i) => $((i === 0 ? '.karte-hinten' : '.karte-vorne') + ' [data-aufnahme]', k));
  const flAnalyse = $('[data-aufnahme]', kennH);
  const flTafeln = tafeln.map(t => $('[data-aufnahme]', t));
  const flWerke = werke.map(w => $$('[data-aufnahme]', w));
  const flAlle = [flSchirm, flAnalyse].concat(flKarten, flTafeln, [].concat.apply([], flWerke)).filter(Boolean);
  const regie = [], regieAlt = new Map();
  function regieSetzen() {
    const A = W.MAKE && W.MAKE.aufnahmen;
    if (!A) return;
    for (let i = 0; i < flAlle.length; i++) {
      const fl = flAlle[i], an = regie.indexOf(fl) >= 0;
      if (regieAlt.get(fl) !== an) { regieAlt.set(fl, an); A.spiele(fl, an); }
    }
  }
  function regieAus() { regie.length = 0; regieSetzen(); }

  // ─── Stil-Speicher: schreibt nur bei Änderung, räumt beim Wechsel in die ruhige Seite alles weg ───
  const gestylt = new Map();
  function setze(el, prop, wert) {
    let m = gestylt.get(el);
    if (!m) { m = {}; gestylt.set(el, m); }
    const w = String(wert);
    if (m[prop] === w) return;
    m[prop] = w;
    if (w === '') el.style.removeProperty(prop); else el.style.setProperty(prop, w);
  }
  const zeige = (el, ja) => setze(el, 'visibility', ja ? 'visible' : 'hidden');
  function allesZurueck() { gestylt.forEach((_, el) => el.removeAttribute('style')); gestylt.clear(); }

  const zaehlerDaten = zaehler.map(el => {
    const roh = el.getAttribute('data-ziel') || el.textContent;
    return { el, ziel: parseFloat(roh.replace(',', '.')) || 0, stellen: (roh.split(',')[1] || '').length, orig: el.textContent, text: el.textContent };
  });
  function zaehlerSetzen(e) {
    zaehlerDaten.forEach(z => {
      const t = e >= 1 ? z.orig : (z.ziel * e).toFixed(z.stellen).replace('.', ',');
      if (t !== z.text) { z.el.textContent = t; z.text = t; }
    });
  }

  // ─── Zeitplan: Scrollweg je Szene (Gewichte). Daraus entstehen die Grenzen G[name] = [von, bis] als Anteil p. ───
  // Die Gesamtlänge steht in studio.css (.film { height }); hier zählt nur das Verhältnis.
  const PLAN = [['intro', 30], ['wende', 58], ['branchen', 140], ['blende', 46], ['analyse', 96], ['maerkte', 205], ['ergebnis', 336], ['vorhang', 50], ['kontakt', 35]];
  const G = {};
  (function () { let s = 0; const summe = PLAN.reduce((x, e) => x + e[1], 0); PLAN.forEach(e => { G[e[0]] = [s / summe, (s + e[1]) / summe]; s += e[1]; }); })();
  const stelle = (name, t) => G[name][0] + (G[name][1] - G[name][0]) * t;
  const KAPITEL = [[0, '01', 'Intro'], [stelle('wende', .55), '02', 'Für wen'], [stelle('blende', .6), '03', 'Analyse'],
    [stelle('maerkte', .12), '04', 'Märkte'], [stelle('ergebnis', .04), '05', 'Ergebnis'], [stelle('vorhang', .6), '06', 'Kontakt']];
  const SPRUNG = { '#betriebe': stelle('branchen', .06), '#film': 0 };

  // ─── Zustand ───
  const START = performance.now();
  let aktiv = false, kaputt = false, angehalten = false, glGestartet = false;
  let p = 0, ziel = 0, sofort = true, messenNoetig = true, erstesBild = true;
  let laeuft = false, rafId = 0, letzte = 0, zeitGl = 0, filmSichtbar = true;
  const zg = { x: 0, y: 0 }, zgZiel = { x: 0, y: 0 };
  let dunkelAlt = null, flaecheAlt = null, anzeigeDunkelAlt = null, kapAlt = -1, zeitAlt = '';
  // lokaler Fortschritt einer Szene (optional nur ein Teilstück a … b davon)
  const lok = (name, a = 0, b = 1) => { const g = G[name], l = g[1] - g[0]; return klemme((p - g[0] - l * a) / (l * (b - a))); };

  // Maße (messen)
  let vw = 1, vh = 1, telefon = false, hochkant = false, kopfH = 72, spanne = 1, filmOben = 0;
  let kb = 1, kh = 1, kTop = 0, R = 1, laufOben = 0, hexMax = 1, dpr = 1;
  const hp = { x: 0, y: 0, ry: -14, rz: 3, s: 1 };
  let stops = [0, 0], txEin = 0;
  const erg = { x: 0, y: 0, schritt: 1, ry: -6 };

  // Werte eines Bildes für Kopf, Anzeige und WebGL
  const bz = { hexE: 0, blendeAn: false, eV: 0, chromOp: 0 };

  // ─── Messen ───
  function messen() {
    vw = H.clientWidth || W.innerWidth;
    vh = buehne.clientHeight || W.innerHeight;
    telefon = vw <= 640;
    hochkant = telefon || (vw <= 1024 && vh > vw);
    kopfH = kopf.offsetHeight;
    spanne = Math.max(1, film.offsetHeight - vh);
    filmOben = film.getBoundingClientRect().top + W.scrollY;

    kb = karten[0].offsetWidth; kh = karten[0].offsetHeight;
    kTop = karussell.offsetTop; R = kb * 1.3;
    laufOben = laufband.offsetTop;
    const rand = held.offsetLeft, sb = schirm.offsetWidth || kb;
    // Rechte Kante des Textes: die Kinder sind nur so breit wie ihr Inhalt
    let inhaltRechts = 0;
    for (const c of held.children) if (c.offsetWidth && !c.classList.contains('held-bild')) inhaltRechts = Math.max(inhaltRechts, c.offsetLeft + c.offsetWidth);
    inhaltRechts += rand;
    const luecke = klemme(vw * .035, 24, 64), frei = vw - rand - inhaltRechts - luecke;
    const sQuer = Math.min(frei / sb, (laufOben - kopfH - 44) / kh, 1.4);
    const heldUnten = held.offsetTop + held.offsetHeight, platz = laufOben - heldUnten;
    const sHoch = klemme(Math.min((vw - 2 * rand) / sb, (platz - 36) / kh), .3, 1.5);
    // Quer (auch Tablet und kleines Laptopfenster): Bildschirm neben den Titel. Hochkant: darunter. Es gewinnt, wo er größer wird.
    if (!telefon && vw >= vh * 1.12 && sQuer >= sHoch * .9) {
      // Der gekippte Bildschirm kommt mit der rechten Kante nach vorn und wird dort größer: so weit verkleinern, dass er im Fenster bleibt.
      const mitte = inhaltRechts + luecke + frei / 2 - vw / 2, tiefe = parseFloat(getComputedStyle(rahmen).perspective) || 1500;
      let s = sQuer;
      for (let i = 0; i < 16; i++) {
        const halb = sb * s / 2, kante = (mitte + halb * .97) * tiefe / (tiefe - halb * .242) + kh * s * .026;
        if (kante <= vw / 2 - rand * .45) break;
        s *= .97;
      }
      hp.s = s;
      hp.x = mitte;
      hp.y = (kopfH + laufOben) / 2 - kTop;
      hp.ry = -14; hp.rz = 3;
    } else {
      hp.s = sHoch;
      hp.x = 0;
      hp.y = (heldUnten + laufOben) / 2 - kTop;
      hp.ry = -8; hp.rz = 2;
    }
    hexMax = Math.sqrt(Math.pow(vw / 2, 2) + Math.pow(Math.max(kTop, vh - kTop), 2)) / .866 * 1.02;

    const pl = parseFloat(getComputedStyle(spur).paddingLeft) || 0, n = tafeln.length;
    stops = tafeln.map((t, k) => pl - t.offsetLeft);
    const letzt = tafeln[n - 1];
    stops[n - 1] = Math.min(stops[n - 2], vw - pl - (letzt.offsetLeft + letzt.offsetWidth));
    txEin = vw - tafeln[0].offsetLeft;

    // Ergebnis: der vordere Bildschirm steht rechts der Mitte (quer) bzw. oben in der Mitte (hochkant)
    erg.x = hochkant ? 0 : vw * .16;
    erg.y = hochkant ? -vh * (telefon ? .1 : .08) : vh * .025;
    erg.schritt = vw * (hochkant ? .9 : .5);
    erg.ry = hochkant ? -3 : -7;

    dpr = Math.min(W.devicePixelRatio || 1, telefon ? 1.5 : 1.25);
    glGroessen();
  }

  // ─── Blende (Sechseck) ───
  function hexPolygon(cx, cy, r, rot) {
    const pt = [];
    for (let j = 0; j < 6; j++) { const a = (rot + 30 + j * 60) * RAD; pt.push(r1(cx + Math.cos(a) * r) + 'px ' + r1(cy + Math.sin(a) * r) + 'px'); }
    return 'polygon(' + pt.join(',') + ')';
  }
  function inHex(x, y) {
    if (bz.hexE >= 1) return true;
    if (bz.hexE <= 0) return false;
    const r = bz.hexE * hexMax * .866, dx = x - vw / 2, dy = y - kTop;
    for (let k = 0; k < 3; k++) { const a = (30 * bz.hexE + k * 60) * RAD; if (Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) > r) return false; }
    return true;
  }

  // ─── Hell/Dunkel für Kopf und Anzeige ───
  const SEITE_DUNKEL = $$('.abschnitt-beispiele, .abschnitt-analysen, .abschnitt-kontakt, .fuss');
  const STATISCH_DUNKEL = $$('.blende, .streifen, .ergebnis, .abschnitt-beispiele, .abschnitt-analysen, .abschnitt-kontakt, .fuss');
  function flaecheDunkel(liste, y) {
    for (let i = 0; i < liste.length; i++) { const r = liste[i].getBoundingClientRect(); if (r.height > 0 && r.top <= y && r.bottom > y) return true; }
    return false;
  }
  function dunkelSetzen(d) {
    if (d === dunkelAlt) return;
    dunkelAlt = d;
    H.classList.toggle('dunkel', d);
    if (themaMeta) themaMeta.setAttribute('content', d ? '#0D0C0B' : '#F2EDE4');
  }
  // Unter dem Film läuft Inhalt unter dem Kopf durch: dann bekommt er eine Fläche.
  function kopfFlaeche(an) {
    if (an === flaecheAlt) return;
    flaecheAlt = an;
    H.classList.toggle('kopf-flaeche', an);
  }
  function kopfStatisch() { dunkelSetzen(flaecheDunkel(STATISCH_DUNKEL, kopf.offsetHeight / 2)); }

  // ─── Die Szenen ───
  function szene(jetzt, fr) {
    regie.length = 0;

    // 01 Intro: Text links, daneben der Bildschirm mit den laufenden Aufnahmen
    const eH = lok('wende', 0, .5);
    setze(held, 'opacity', r3(1 - eH));
    setze(held, 'pointer-events', eH >= 1 ? 'none' : '');
    setze(zeilen[0], 'translate', '0 ' + r1(-eH * vh * .16) + 'px');
    setze(zeilen[1], 'translate', '0 ' + r1(-eH * vh * .10) + 'px');
    const eL = lok('wende', 0, .45);
    zeige(laufband, eL < 1);
    setze(laufband, 'opacity', r3(1 - eL));
    setze(laufband, 'translate', '0 ' + r1(eL * 40) + 'px');

    // 02 Der Bildschirm wendet sich zur ersten Karte, die anderen kommen dazu, das Karussell dreht
    const eV = inOut(lok('vorhang'));
    const eBl = inOut(lok('blende'));
    const kartenAn = eBl < 1;
    zeige(rahmen, kartenAn);
    let vorn = -1;
    if (kartenAn) {
      const flip = inOut(lok('wende', .12, .92));
      const reise = inOut(lok('wende', .04, 1));
      const dreh = stufen(lok('branchen', .1, 1), 4, .44);
      const ein0 = aus(klemme((jetzt - START - 600) / 1100));
      for (let i = 0; i < 4; i++) {
        const th = (i - dreh) * 52;
        let x = Math.sin(th * RAD) * R, y = 0, z = (Math.cos(th * RAD) - 1) * R, ry = th, rx = 0, rz = 0, s = 1;
        let op = 1 - abschnitt(Math.abs(th), 70, 112);
        if (i === 0) {
          const schwebe = angehalten ? 0 : Math.sin(zeitGl * .9) * 6;
          x = mix(hp.x, x, reise);
          y = mix(hp.y + schwebe + (1 - ein0) * 70, y, reise);
          z = mix(0, z, reise);
          ry = mix(hp.ry - (1 - ein0) * 24 + zg.x * 8, ry, reise);
          rx = mix(-zg.y * 6, rx, reise);
          rz = mix(hp.rz, rz, reise);
          s = mix(hp.s * (.92 + .08 * ein0), s, reise);
          op *= ein0;
        } else {
          const e = aus(abschnitt(p, stelle('wende', .5 + i * .1), stelle('wende', 1.05 + i * .12)));
          x += (1 - e) * R * 1.1; z -= (1 - e) * R * .9; ry += (1 - e) * 30; op *= e;
        }
        setze(karten[i], 'transform', 'translate3d(' + r1(x) + 'px,' + r1(y) + 'px,' + r1(z) + 'px) rotateY(' + r1(ry) + 'deg) rotateX(' + r1(rx) + 'deg) rotateZ(' + r1(rz) + 'deg) scale(' + r3(s) + ')');
        setze(karten[i], 'opacity', r3(op));
        setze(karten[i], 'z-index', String(10 - Math.round(Math.abs(th) / 26)));
      }
      setze(innen0, 'transform', 'rotateY(' + r1(flip * 180) + 'deg)');
      if (flip < .5) { if (eBl <= 0) regie.push(flSchirm); }
      else if (eBl < .6) { vorn = Math.round(dreh); if (flKarten[vorn]) regie.push(flKarten[vorn]); }
    }
    const eB = lok('wende', .45, .95) * (1 - lok('blende', .1, .6));
    setze(branchen, 'opacity', r3(eB));
    setze(branchen, 'translate', '0 ' + r1((1 - eB) * 24) + 'px');

    // 03 Blende + Analyse
    bz.hexE = eBl; bz.eV = eV;
    setze(blende, 'clip-path', eBl >= 1 ? 'none' : hexPolygon(vw / 2, kTop, eBl * hexMax, 30 * eBl));
    const blendeAn = eBl > 0 && eV < 1;
    bz.blendeAn = blendeAn;
    zeige(blende, blendeAn);

    const n = stops.length;
    const eS = lok('maerkte', 0, .2);
    const tx = eS < 1 ? mix(txEin, stops[0], inOut(eS)) : zwischen(stops, stufen(lok('maerkte', .2, .97), n, .45));
    const dx = tx - txEin;
    const analyseAn = blendeAn && -dx < vw * 1.3;
    zeige(analyse, analyseAn); zeige(kennzahlen, analyseAn);
    if (analyseAn) {
      const eT = aus(lok('blende', .5, 1));
      setze(analyse, 'opacity', r3(eT));
      setze(analyse, 'transform', 'translate3d(' + r1(dx) + 'px,' + r1((1 - eT) * 34) + 'px,0)');
      setze(kennzahlen, 'transform', 'translate3d(' + r1(dx) + 'px,0,0)');
      const eA = aus(lok('analyse', 0, .26)), eK = aus(lok('analyse', .1, .36));
      setze(kennA, 'opacity', r3(eA)); setze(kennA, 'translate', '0 ' + r1((1 - eA) * 30) + 'px');
      setze(kennB, 'opacity', r3(eK)); setze(kennB, 'translate', '0 ' + r1((1 - eK) * 30) + 'px');
      zaehlerSetzen(aus(lok('analyse', .04, .5)));
      // das Handy steigt aus der Mitte auf, sobald die Blende offen ist; seine Aufnahme läuft, solange die Szene steht
      const eG = aus(lok('blende', .45, 1.15));
      setze(kennH, 'opacity', r3(eG));
      setze(kennH, 'transform', 'translate3d(0,' + r1((1 - eG) * vh * .09) + 'px,0) scale(' + r3(.94 + .06 * eG) + ')');
      if (eBl >= 1 && eS < .5) regie.push(flAnalyse);
    }

    // 04 Streifen quer
    const eX = lok('ergebnis', 0, .1);
    const streifenAn = p >= G.maerkte[0] && eX < 1 && eV < 1;
    zeige(streifen, streifenAn);
    if (streifenAn) {
      setze(spur, 'transform', 'translate3d(' + r1(tx) + 'px,0,0)');
      setze(streifen, 'opacity', r3(1 - eX));
      setze(streifen, 'transform', 'translateY(' + r1(-eX * vh * .05) + 'px) scale(' + r3(1 - eX * .14) + ')');
      for (let k = 1; k < n; k++) {
        const d = klemme((tx - stops[k]) / vw, -1.2, 1.2);
        if (attrappen[k]) setze(attrappen[k], 'translate', r1(-d * Math.min(90, vw * .06)) + 'px 0');
        if (flTafeln[k] && Math.abs(d) < .34 && eX <= 0) regie.push(flTafeln[k]);
      }
    }

    // 05 Ergebnis: von Bildschirm zu Bildschirm. Der vorderste spielt (quer und hochkant), der nächste schaut schon herein.
    const ergDa = p >= stelle('maerkte', .55) && eV < 1;          // früh anlegen: dann laden die Poster rechtzeitig
    setze(ergebnis, 'display', ergDa ? 'block' : '');
    const ergAn = ergDa && p >= stelle('ergebnis', .02);
    const fahrt = stufen(lok('ergebnis', .13, .98), werke.length, .5);
    if (ergDa) {
      zeige(ergebnis, ergAn);
      if (ergAn) {
        const eE = aus(lok('ergebnis', .04, .15));
        setze(ergKopf, 'opacity', r3(eE)); setze(ergKopf, 'translate', '0 ' + r1((1 - eE) * 26) + 'px');
        setze(ergText, 'opacity', r3(aus(lok('ergebnis', .08, .18))));
        const eR = aus(lok('ergebnis', .03, .16));               // Auftritt: die Reihe fährt aus der Tiefe heran
        for (let i = 0; i < werke.length; i++) {
          const d = i - fahrt, t = Math.abs(d);
          // hinten: deckend, aber abgedunkelt (nichts scheint durch); vorbei: zügig nach links und weg
          let x, z, ry, op, hell = 1;
          if (d >= 0) { x = erg.x + d * erg.schritt; z = -d * 520; ry = erg.ry - d * 30; hell = 1 - .58 * klemme(t); op = 1 - klemme((t - 1.15) / .7); }
          else { x = erg.x - t * erg.schritt * 1.2; z = -t * 300; ry = erg.ry + t * 36; hell = 1 - .35 * klemme(t / .5); op = 1 - klemme((t - .24) / .36); }
          z -= (1 - eR) * 900; op *= eR;
          const an = op > .004;
          zeige(werke[i], an);
          if (!an) continue;
          const y = erg.y + (angehalten ? 0 : Math.sin(zeitGl * .7 + i * 1.7) * 5) + (1 - eR) * vh * .12;
          setze(werke[i], 'transform', 'translate3d(' + r1(x) + 'px,' + r1(y) + 'px,' + r1(z) + 'px) rotateY(' + r1(ry + zg.x * 3) + 'deg) rotateX(' + r1(-zg.y * 2.4) + 'deg)');
          setze(werke[i], 'opacity', r3(op));
          setze(werke[i], 'filter', hell < .995 ? 'brightness(' + r3(hell) + ')' : '');
          setze(werke[i], 'z-index', String(10 - Math.round(t * 2)));
        }
        for (let k = 0; k < werkTexte.length; k++) {
          const a = klemme(1 - (Math.abs(fahrt - k) - .2) / .26);
          setze(werkTexte[k], 'opacity', r3(a));
          setze(werkTexte[k], 'translate', '0 ' + r1((k - fahrt) * 30) + 'px');
          setze(werkTexte[k], 'visibility', a > 0 ? 'visible' : 'hidden');
        }
        if (eR > .5 && eV < .5) { const f = flWerke[Math.round(fahrt)]; if (f) for (let j = 0; j < f.length; j++) regie.push(f[j]); }
      }
    }

    // 06 Vorhang
    const vorhangOben = (1 - eV) * vh * 1.01;
    setze(vorhang, 'transform', 'translate3d(0,' + r1(vorhangOben) + 'px,0)');
    const ecke = r1(44 * (1 - eV)) + 'px';
    setze(vorhang, 'border-radius', ecke + ' ' + ecke + ' 0 0');
    const eZ = aus(lok('vorhang', .5, 1.1));
    setze(zielSzene, 'opacity', r3(eZ));
    setze(zielSzene, 'translate', '0 ' + r1((1 - eZ) * 40) + 'px');
    bz.chromOp = lok('vorhang', .3, .95);
    setze(chrom, 'opacity', r3(bz.chromOp));

    // Kopf und Anzeige: hell oder dunkel darunter?
    let kd, ad;
    if (fr.bottom <= kopfH / 2) {
      kd = flaecheDunkel(SEITE_DUNKEL, kopfH / 2);
    } else {
      const y = kopfH / 2;
      kd = blendeAn && inHex(24, y) && inHex(vw - 24, y) && vorhangOben > y;
    }
    ad = blendeAn && inHex(24, vh - 20) && inHex(vw - 24, vh - 20) && vorhangOben > vh - 44;
    dunkelSetzen(kd);
    // Sobald der Film zu Ende ist und die Bühne nach oben wegläuft, schiebt sich ihr Inhalt unter den Kopf: ab da mit Fläche.
    kopfFlaeche(fr.bottom < vh - 2);
    if (ad !== anzeigeDunkelAlt) { anzeigeDunkelAlt = ad; anzeige.classList.toggle('auf-dunkel', ad); }

    // Anzeige: Kapitel, Balken, Zeitcode
    let ki = 0;
    for (let i = 0; i < KAPITEL.length; i++) if (p >= KAPITEL[i][0]) ki = i;
    if (ki !== kapAlt) { kapAlt = ki; kapNr.textContent = KAPITEL[ki][1]; kapName.nodeValue = ' ' + KAPITEL[ki][2]; }
    setze(balken, 'transform', 'scaleX(' + r3(p) + ')');
    const fz = Math.round(p * 60 * 25);
    const tc = '00:' + zwei(Math.floor(fz / 1500)) + ':' + zwei(Math.floor(fz / 25) % 60) + ':' + zwei(fz % 25);
    if (tc !== zeitAlt) { zeitAlt = tc; zeitAnzeige.textContent = tc; }
  }

  // ─── WebGL: gemeinsame Teile ───
  const GL_OPT = { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true };
  const PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const VS_VOLL = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
  const GLSL_FARBEN = 'const vec3 PAPIER=vec3(.949,.929,.894);const vec3 SIGNAL=vec3(1.,.353,.122);const vec3 VIOLETT=vec3(.486,.227,.929);const vec3 ROSA=vec3(1.,.561,.722);\n';

  function kontext(c, extra) { try { return c.getContext('webgl', Object.assign({}, GL_OPT, extra)) || null; } catch (e) { return null; } }
  function shader(gl, typ, quelle) {
    const s = gl.createShader(typ);
    gl.shaderSource(s, quelle); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) || 'Shader');
    return s;
  }
  function programm(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p) || 'Programm');
    return { p, u: n => gl.getUniformLocation(p, n), a: n => gl.getAttribLocation(p, n) };
  }
  function dreieck(gl) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return b;
  }
  function verlustBeobachten(c, modul, aufbauen, abschalten) {
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); modul.verloren = true; }, false);
    c.addEventListener('webglcontextrestored', () => {
      try { aufbauen(); modul.verloren = false; wecken(); } catch (e) { abschalten(); }
    }, false);
  }
  function sicher(fn, abschalten) {
    try { fn(); } catch (e) { abschalten(); if (W.console) console.warn('MAKE Studios: WebGL-Teil aus', e); }
  }

  // ─── Chrom-Blende: das Zeichen als Objekt, Raymarching, Umgebung als Studio-Licht ───
  const CHROM_FS = PREC + 'uniform vec2 uAuf;uniform vec3 uDreh;\n' + GLSL_FARBEN + `
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float sdHex(vec2 p,float r){const vec3 k=vec3(-.866025404,.5,.577350269);p=abs(p);p-=2.*min(dot(k.xy,p),0.)*k.xy;p-=vec2(clamp(p.x,-k.z*r,k.z*r),r);return length(p)*sign(p.y);}
float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float schlitze(vec2 p){float d=1e5;mat2 m=rot(1.0471976);for(int i=0;i<6;i++){d=min(d,sdSeg(p,vec2(0.,-.40),vec2(-.866,-.90)));p=m*p;}return d;}
float flach(vec2 p){float d=length(p)-.92;d=max(d,-sdHex(p.yx,.3464));return max(d,-(schlitze(p)-.06));}
float form(vec3 p){
p.xz=rot(uDreh.x)*p.xz;p.yz=rot(uDreh.y)*p.yz;p.xy=rot(uDreh.z)*p.xy;
vec2 w=vec2(flach(p.xy)+.05,abs(p.z)-.035);
return min(max(w.x,w.y),0.)+length(max(w,0.))-.05;}
vec3 normale(vec3 p){const vec2 e=vec2(1.,-1.)*.0012;return normalize(e.xyy*form(p+e.xyy)+e.yyx*form(p+e.yyx)+e.yxy*form(p+e.yxy)+e.xxx*form(p+e.xxx));}
vec3 umgebung(vec3 r){
vec3 c=mix(vec3(.035,.033,.031),vec3(.16,.15,.14),smoothstep(-.1,.8,r.y));
c=mix(c,PAPIER*.95,1.-smoothstep(-.42,-.04,r.y));
c+=vec3(1.8)*smoothstep(.86,.97,dot(r,normalize(vec3(-.5,.72,.48))));
float sx=(r.x-.58)/.05;
c+=vec3(.9)*exp(-sx*sx)*smoothstep(-.2,.3,r.y)*(1.-smoothstep(.6,.95,r.y));
c+=SIGNAL*1.4*pow(max(dot(r,normalize(vec3(.88,.05,-.47))),0.),6.);
c+=VIOLETT*1.2*pow(max(dot(r,normalize(vec3(-.82,-.15,-.55))),0.),5.);
c+=vec3(.6)*exp(-r.y*r.y*676.);
return c;}
void main(){
vec2 uv=(gl_FragCoord.xy-.5*uAuf)/(.5*min(uAuf.x,uAuf.y));
vec3 ro=vec3(0.,0.,3.4),rd=normalize(vec3(uv,-2.75));
float b=dot(ro,rd),h=b*b-(dot(ro,ro)-1.44);
if(h<0.){gl_FragColor=vec4(0.);return;}
h=sqrt(h);
float t=-b-h,tEnde=-b+h,m=1e5,tm=t;bool treffer=false;
for(int i=0;i<80;i++){vec3 q=ro+rd*t;float d=form(q);if(d<m){m=d;tm=t;}if(d<.0006){treffer=true;break;}t+=d*.92;if(t>tEnde)break;}
float px=2./min(uAuf.x,uAuf.y)*tm/2.75*1.5;
float a=treffer?1.:clamp(1.-m/px,0.,1.);
if(a<=0.){gl_FragColor=vec4(0.);return;}
vec3 p=ro+rd*tm,n=normale(p),r=reflect(rd,n);
float fres=pow(1.-max(dot(n,-rd),0.),5.);
vec3 col=umgebung(r)*(.72+.28*fres);
float ao=clamp(form(p+n*.06)/.06,0.,1.);
col*=(.55+.45*ao)*vec3(1.,.985,.96);
col=col/(1.+col*.35);
gl_FragColor=vec4(col*a,a);}`;

  const chr = { gl: null, aus: false, verloren: false };
  function chromAufbauen() {
    const gl = chr.gl, pr = programm(gl, VS_VOLL, CHROM_FS);
    chr.pr = pr;
    chr.u = { auf: pr.u('uAuf'), dreh: pr.u('uDreh') };
    chr.aPos = pr.a('aPos');
    chr.buf = dreieck(gl);
  }
  function chromAus() {
    chr.aus = true;
    H.classList.add('ohne-chrom');
    try { if (chr.gl && !chr.gl.isContextLost()) { chr.gl.clearColor(0, 0, 0, 0); chr.gl.clear(chr.gl.COLOR_BUFFER_BIT); } } catch (e) { /* egal */ }
  }
  function chromStarten() {
    const gl = kontext(chrom, { alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error('kein WebGL');
    chr.gl = gl;
    chromAufbauen();
    verlustBeobachten(chrom, chr, chromAufbauen, chromAus);
  }
  function chromZeichnen(probe) {
    if (!chr.gl || chr.aus || chr.verloren) return;
    const gl = chr.gl, w = probe ? 1 : chrom.width, h = probe ? 1 : chrom.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(chr.pr.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, chr.buf);
    gl.enableVertexAttribArray(chr.aPos);
    gl.vertexAttribPointer(chr.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(chr.u.auf, w, h);
    gl.uniform3f(chr.u.dreh,
      Math.sin(zeitGl * .35) * .5 + zg.x * .35,
      .22 + Math.sin(zeitGl * .27) * .12 + zg.y * .22,
      zeitGl * .1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function glStarten() {
    try { chromStarten(); } catch (e) { chromAus(); }
    // Vorwärmen, sobald die Seite steht: die Leinwand liegt dann noch verdeckt (Vorhang unten)
    const vorwaermen = () => {
      if (kaputt) return;
      sicher(() => chromZeichnen(true), chromAus);
    };
    if (W.requestIdleCallback) W.requestIdleCallback(vorwaermen, { timeout: 2500 }); else W.setTimeout(vorwaermen, 1200);
  }
  function glGroessen() {
    if (chr.gl && !chr.aus) {
      const s = Math.max(2, Math.round(chrom.clientWidth * dpr));
      if (chrom.width !== s || chrom.height !== s) { chrom.width = s; chrom.height = s; }
    }
  }

  // ─── Die Schleife: läuft nur, solange der Film sichtbar ist und sich etwas bewegt ───
  function bild(jetzt) {
    laeuft = false;
    if (!aktiv) return;
    try {
      const dt = Math.min(Math.max(jetzt - letzte, 0) / 1000, .1);
      letzte = jetzt;
      if (messenNoetig) { messenNoetig = false; messen(); }
      if (erstesBild) {
        erstesBild = false;
        const w = SPRUNG[W.location.hash];
        if (w > 0) springe(w);
      }
      const fr = film.getBoundingClientRect();
      filmSichtbar = fr.bottom > 0 && fr.top < vh;
      ziel = klemme(-fr.top / spanne);
      if (sofort) { p = ziel; sofort = false; }
      else { p += (ziel - p) * (1 - Math.exp(-dt * 10)); if (Math.abs(ziel - p) < 1e-5) p = ziel; }
      if (!angehalten) zeitGl += dt;
      const k = 1 - Math.exp(-dt * 4);
      zg.x += (zgZiel.x - zg.x) * k; zg.y += (zgZiel.y - zg.y) * k;

      szene(jetzt, fr);
      if (!filmSichtbar || D.hidden) regie.length = 0;
      regieSetzen();

      if (filmSichtbar) {
        if (bz.eV > 0 && bz.chromOp > 0) sicher(chromZeichnen, chromAus);
      }
    } catch (e) { fatal(e); return; }
    if (!D.hidden && ((filmSichtbar && !angehalten) || p !== ziel)) { laeuft = true; rafId = W.requestAnimationFrame(bild); }
  }
  function wecken() {
    if (laeuft || !aktiv || D.hidden) return;
    laeuft = true;
    letzte = performance.now();
    rafId = W.requestAnimationFrame(bild);
  }

  function fatal(e) {
    if (kaputt) return;
    kaputt = true; aktiv = false;
    W.cancelAnimationFrame(rafId); laeuft = false;
    try { regieAus(); allesZurueck(); zaehlerSetzen(1); anzeige.classList.remove('auf-dunkel'); } catch (_) { /* weiter */ }
    statischLink.media = 'all';
    kopfFlaeche(false);
    kopfStatisch();
    if (W.console) console.error('MAKE Studios: Film aus, ruhige Seite', e);
  }

  // ─── Bedienung ───
  function springe(w) {
    W.scrollTo(0, filmOben + w * spanne);
    sofort = true;
    wecken();
  }
  // Anhalten gilt für den Film UND für alle Aufnahmen; der Zustand liegt in seite.js (MAKE.halt), damit beide Knöpfe dasselbe tun.
  function haltSetzen(an) {
    angehalten = an;
    H.classList.toggle('angehalten', an);
    pause.setAttribute('aria-pressed', String(an));
    pause.setAttribute('aria-label', an ? 'Bewegung fortsetzen' : 'Bewegung anhalten');
    wecken();
  }
  const halt = W.MAKE && W.MAKE.halt;
  if (halt) halt.hoeren(haltSetzen);
  pause.addEventListener('click', () => { if (halt) halt.setze(!angehalten); else haltSetzen(!angehalten); });
  D.addEventListener('click', e => {
    if (!aktiv || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const h = a.getAttribute('href');
    if (!Object.prototype.hasOwnProperty.call(SPRUNG, h)) return;
    e.preventDefault();
    W.scrollTo({ top: filmOben + SPRUNG[h] * spanne, behavior: 'smooth' });
    if (W.location.hash !== h) W.history.pushState(null, '', h);
    const z = $(h);
    if (z) { if (!z.hasAttribute('tabindex')) z.setAttribute('tabindex', '-1'); z.focus({ preventScroll: true }); }
  });
  // Tastatur: Fokus im verdeckten Vorhang bzw. im ausgeblendeten Intro → dorthin springen, wo man ihn sieht.
  D.addEventListener('focusin', e => {
    if (!aktiv) return;
    const t = e.target;
    let w = null;
    if (vorhang.contains(t) && p < stelle('vorhang', .9)) w = stelle('kontakt', .5);
    else if (held.contains(t) && p > stelle('wende', .2)) w = 0;
    else if (ergebnis.contains(t) && (p < stelle('ergebnis', .16) || p > G.ergebnis[1])) w = stelle('ergebnis', .2);
    if (w === null) return;
    springe(w);
    W.requestAnimationFrame(() => { if (Math.abs(W.scrollY - (filmOben + w * spanne)) > 2) springe(w); });
  });
  W.addEventListener('scroll', () => { if (aktiv) wecken(); else kopfStatisch(); }, { passive: true });
  W.addEventListener('resize', () => { messenNoetig = true; if (aktiv) wecken(); else kopfStatisch(); });
  W.addEventListener('pointermove', e => {
    if (!aktiv || angehalten || !filmSichtbar || e.pointerType !== 'mouse') return;
    zgZiel.x = e.clientX / vw * 2 - 1; zgZiel.y = e.clientY / vh * 2 - 1;
    wecken();
  }, { passive: true });
  D.addEventListener('visibilitychange', () => { if (!D.hidden) wecken(); });
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { messenNoetig = true; wecken(); });

  // ─── Bewegung reduzieren: ruhige Seite, live umschaltbar ───
  const mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function starten() {
    aktiv = true; messenNoetig = true; sofort = true;
    if (!glGestartet) { glGestartet = true; glStarten(); }
    wecken();
  }
  function ruhig() {
    aktiv = false;
    W.cancelAnimationFrame(rafId); laeuft = false;
    regieAus();
    allesZurueck(); zaehlerSetzen(1);
    anzeige.classList.remove('auf-dunkel'); anzeigeDunkelAlt = null;
    kopfFlaeche(false);
    kapAlt = -1; zeitAlt = '';
    kopfStatisch();
  }
  function modusPruefen() { if (kaputt) return; if (mq && mq.matches) ruhig(); else starten(); }
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', modusPruefen); else if (mq.addListener) mq.addListener(modusPruefen); }
  modusPruefen();
})();
