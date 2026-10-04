// MAKE Innovation · makeinnovation.de — Drehbuch (04.10.2026, „Klar“)
// Nur diese Seite: was die Szene zeigt (MakeSzene.drehbuch, gelesen von js/szene/motor.js und website/standbild.mjs) und was im
// Showreel wann geschieht (MakeSzene.showreel, ausgeführt vom Baukasten js/szene/spur.js). Kevin 04.10.: 80 % Seriosität —
// Typografie, Weißraum, Haarlinien, ruhige Bewegung; die Lichter (Kugel, Aurora, Verläufe) nur an drei Stellen.
//
// Fortschritt p (0 → 1) über die Spur:
//   0,00–0,10  Titelkarte (dunkle Karte auf Off-White, ruhiger Verlauf): Buchstaben gleiten verschwommen nach unten weg
//   0,09–0,17  die Karte schrumpft und wird Teil eines Karussells aus vier Karten, dahinter das Laufband
//   0,17–0,37  Karussell (rotateY 0 → −270°, mit Rasten = Lesezeit): Beratung · Eigene Software · Tor
//   0,37–0,45  das Tor öffnet sich (Kreis aus dem Knoten) in den dunklen Raum: die Kugel aus Licht
//   0,44–0,60  „Wachstum scheitert selten an Ideen. Meist an der Umsetzung.“ steigt Buchstabe für Buchstabe auf
//   0,60–0,80  Band ruhiger Karten: Fokus Innovation (Städte), Make.One, belegte Zahlen (Trommel)
//   0,79–0,91  ruhiger Flug durch wenige typografische Kacheln
//   0,90–1,00  Schlussblock: Wortmarke über eigenem Verlauf, Erstgespräch; der Rahmen schnappt ein
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};

  // ── Szene (dunkler Raum): eine ruhige Kugel, ohne Netz und Pfad. Alle Zustände zeigen dieselbe Kugel — nur die Kamera fährt. ──
  //   p, bis   Lage im Showreel: von p bis bis steht der Zustand, dazwischen fährt die Kamera weich zum nächsten
  //   s        Anker am Pfad · abstand/hebung/seite/blick: Kamera · breite/hoehe: Mindestabstand (passt ins Bild)
  //   schub    Rechner: Kugel rechts neben dem Text · hoch: Hochkant: Kugel im oberen Teil · hell: Helligkeit der Kugel
  //   standbild  dieser Zustand bekommt ein Standbild (assets/szene/<name>.svg) für die ruhige Fassung und die Titelkarte
  S.drehbuch = {
    saat: 4102026,
    fortschritt: 'extern',
    netz: false,
    pfad: false,
    einstieg: false,
    text: false,
    folgen: .14,
    teilchen: { rechner: 9000, handy: 4200, standbild: 3200 },
    aurora: { staerke: .16, aufloesung: .25, oktaven: 4 },
    handy: () => S.spur ? S.spur.stufe(window.innerWidth, window.innerHeight) !== 'rechner' : window.innerWidth < 760,
    zustaende: [
      { name: 'raum', p: .44, bis: .585, formation: 'kugel', s: 40, abstand: 12, hebung: .4, breite: 3.8, hoehe: 3.8, schub: .42, hoch: .38, funkeln: .12, hell: 1, aurora: 1, standbild: true },
      { name: 'band', p: .635, bis: .745, formation: 'kugel', s: 40, abstand: 30, hebung: .6, blick: -5, breite: 3, hoehe: 3, schub: .5, hoch: .9, funkeln: .1, hell: .5, aurora: .8 },
      { name: 'flug', p: .87, formation: 'kugel', s: 40, abstand: 5.5, hebung: .2, breite: .5, hoehe: .5, schub: 0, hoch: 0, funkeln: .08, hell: .26, aurora: .6 },
    ],
  };

  if (typeof document === 'undefined') return;

  // ── Showreel ──
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  let E = null; // Elemente (nach dem Laden)
  const masse = { kb: 380, kh: 520, rand: 14, radius: 28, R: 274, bandB: 1, flugZ: 520 };

  /** Größen aus dem CSS (--sr-*), eine Quelle für Layout und Bewegung. */
  function messen(w) {
    const cs = getComputedStyle(document.documentElement), px = n => parseFloat(cs.getPropertyValue(n)) || 0;
    masse.kb = E.karten[1].offsetWidth; masse.kh = E.karten[1].offsetHeight;
    masse.rand = px('--sr-rand'); masse.radius = px('--sr-radius'); masse.R = masse.kb * .72;
    masse.bandB = E.bandZeile.scrollWidth;
    masse.kartenB = E.bandKarten[0].offsetWidth; masse.schritt = E.bandKarten.length > 1 ? E.bandKarten[1].offsetLeft - E.bandKarten[0].offsetLeft : masse.kartenB;
    masse.flugZ = w.stufe === 'handy' ? 380 : 520;
    // Tastatur-Fokus im Band: jede Karte fährt an die Stelle, an der sie mittig steht (Umkehrung von bandX).
    for (const k of E.bandKarten) {
      const ziel = w.vw / 2 - k.offsetLeft - k.offsetWidth / 2;
      let a = .61, b = .79;
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (bandX(m, w) > ziel) a = m; else b = m; }
      k.dataset.spurP = ((a + b) / 2).toFixed(4);
    }
  }
  /** Lage der Band-Zeile bei p: von rechts herein, links hinaus. Am Handy rastet jede Karte mittig ein (Lesezeit). */
  function bandX(p, w) {
    if (w.stufe !== 'handy') return w.lerp(w.vw * .75, -(masse.bandB - w.vw * .22), w.ph(p, .61, .79));
    const n = E.bandKarten.length, x0 = (w.vw - masse.kartenB) / 2;
    const k = w.rasten((p - .63) / (.765 - .63), n - 1, .5);
    return w.lerp(w.vw, x0, w.ph(p, .6, .63)) - k * masse.schritt - w.ph(p, .765, .79) * w.vw;
  }

  function vorbereiten(w) {
    E = {
      karten: $$('.karussell .karte'), held: $('.karte-held'), heldMikro: $('.held-mikro'), heldFuss: $('.held-fuss'), heldBild: $('.held-bild'), heldMarke: $('.held-marke'),
      titel: w.buchstaben($('[data-zerfall]')), papier: $('.papier'), laufband: $('.laufband'), ruf: $('.karussell-ruf'),
      torMa: $$('.tor-ma'), torKe: $$('.tor-ke'), torKnoten: $('.tor-knoten'),
      raum: $('.raum-text'), raumMikro: $('.raum-text .mikro'), raumTitel: w.buchstaben($('[data-aufstieg]')), raumText: $('.raum-text .einleitung'),
      band: $('.band'), bandKopf: $('.band-kopf'), bandZeile: $('.band-zeile'), bandKarten: $$('.band-karte'), trommeln: w.trommeln($('.band')),
      flug: $('.flug'), kacheln: $$('.flug .kacheln li'),
      ende: $('.ende'), endeKarte: $('.ende-karte'), endeRahmen: $('.ende-rahmen'), endeInhalt: $('.ende-inhalt'),
    };
    E.verlaufHeld = w.verlauf($('.karte-held canvas.verlauf'), { staerke: .3, lage: [.55, .5] });
    E.verlaufEnde = w.verlauf($('.ende canvas.verlauf'), { staerke: .34, lage: [.5, .45] });
  }

  function bild(p, w) {
    const { ph, lerp, sicht, stil } = w, vw = w.vw, vh = w.vh, handy = w.stufe === 'handy';
    // ── 1 · Titelkarte: Absender, Text und Knöpfe gehen ruhig, der Titel gleitet verschwommen nach unten weg ──
    const geht = ph(p, .02, .07);
    sicht(E.heldMikro, 1 - geht); sicht(E.heldFuss, 1 - geht); stil(E.heldFuss, `translate3d(0, ${(geht * 24).toFixed(1)}px, 0)`, 0);
    w.zerfall(E.titel, p, .03, .1);
    const bildGeht = ph(p, .03, .08);
    sicht(E.heldBild, 1 - bildGeht);
    stil(E.heldBild, `perspective(900px) rotateY(${(w.maus.x * 7).toFixed(2)}deg) rotateX(${(w.maus.y * 6).toFixed(2)}deg) translate3d(0, ${(bildGeht * 30).toFixed(1)}px, 0)`, 0);

    // ── 2 · Karussell: die Titelkarte (Layout = Bühne minus Rand) schrumpft auf Kartengröße, dann drehen vier Karten ──
    const { kb, kh, R } = masse, hoehe0 = vh - 2 * masse.rand, breite0 = vw - 2 * masse.rand;
    const schrumpf = ph(p, .09, .16), s1 = lerp(1, kh / hoehe0, schrumpf);
    const seite = lerp(0, Math.max(0, (breite0 - kb / s1) / 2), schrumpf), rund = lerp(masse.radius, 22 / s1, schrumpf);
    const drehung = -90 * w.rasten((p - .17) / .2, 3, .5), tief = R * ph(p, .12, .17);
    // In der kleinen Titelkarte steht die Wortmarke (die Karte wird zur Marken-Karte des Karussells).
    sicht(E.heldMarke, ph(p, .11, .16));
    stil(E.heldMarke, `translate(-50%, -50%) scale(${(lerp(.9, 1, ph(p, .11, .17)) / s1).toFixed(4)})`, 0);
    const tor = ph(p, .37, .45), kartenRaus = ph(p, .375, .41);
    E.karten.forEach((k, i) => {
      const c = w.karte(i, 4, drehung), auf = i === 0 ? 1 : ph(p, .13, .17);
      stil(k, `translate(-50%, -50%) translateZ(${(-tief).toFixed(1)}px) rotateY(${c.winkel.toFixed(2)}deg) translateZ(${tief.toFixed(1)}px) scale(${(i === 0 ? s1 : 1).toFixed(4)})`, 0);
      k.style.zIndex = String(c.stapel);
      const vorn = .25 + .75 * Math.max(0, c.cos);
      sicht(k, auf * vorn * (i === 3 ? 1 - ph(p, .378, .4) : 1 - kartenRaus));
      if (i === 0) k.style.clipPath = schrumpf > 0 ? `inset(0 ${seite.toFixed(1)}px round ${rund.toFixed(1)}px)` : '';
    });
    if (E.verlaufHeld) E.verlaufHeld.gebraucht(p < .38);
    sicht(E.laufband, ph(p, .12, .17) * (1 - ph(p, .36, .4)));
    E.laufband.classList.toggle('laeuft', p > .1 && p < .41);
    sicht(E.ruf, ph(p, .17, .2) * (1 - ph(p, .35, .38)));

    // ── 3 · Das Tor: der Knoten teilt sich, ein Kreis öffnet das Papier in den dunklen Raum (die Szene darunter) ──
    w.variable(E.papier, '--loch', tor > 0 ? `${(Math.hypot(vw, vh) * .56 * tor).toFixed(1)}px` : '-2px');
    E.torMa.forEach(el => stil(el, `translate3d(${(-tor * 3).toFixed(2)}px, 0, 0)`, 0));
    E.torKe.forEach(el => stil(el, `translate3d(${(tor * 3).toFixed(2)}px, 0, 0)`, 0));
    sicht(E.torKnoten, 1 - ph(p, .38, .42));

    // ── 4 · Dunkler Raum: Überschrift steigt Buchstabe für Buchstabe auf ──
    const raumAn = ph(p, .43, .46), raumAus = ph(p, .575, .6);
    sicht(E.raum, raumAn * (1 - raumAus));
    stil(E.raum, `translate3d(0, ${(-raumAus * 40).toFixed(1)}px, 0)`, raumAus * 6);
    sicht(E.raumMikro, ph(p, .44, .47));
    w.aufstieg(E.raumTitel, p, .45, .525);
    sicht(E.raumText, ph(p, .505, .535)); stil(E.raumText, `translate3d(0, ${((1 - ph(p, .505, .535)) * 16).toFixed(1)}px, 0)`, 0);

    // ── 5 · Band: ruhige Karten ziehen von rechts nach links vorbei; Zahlen zählen, wenn ihre Karte ankommt ──
    const bandAn = ph(p, .595, .62) * (1 - ph(p, .78, .8));
    sicht(E.band, bandAn);
    sicht(E.bandKopf, ph(p, .6, .625) * (1 - ph(p, .77, .79)));
    const x = bandX(p, w);
    stil(E.bandZeile, `translate3d(${x.toFixed(1)}px, 0, 0)`, 0);
    for (const t of E.trommeln) {
      const karte = t.el.closest('.band-karte'), links = x + karte.offsetLeft;
      w.trommel(t, (vw * .92 - links) / (vw * .45));
    }

    // ── 6 · Flug: wenige Kacheln kommen aus der Tiefe, links und rechts der Mitte ──
    const flug = ph(p, .795, .91);
    sicht(E.flug, ph(p, .79, .8) * (1 - ph(p, .9, .915)));
    const weg = flug * (E.kacheln.length * masse.flugZ + 600);
    E.kacheln.forEach((k, i) => {
      const seiteK = i % 2 ? 1 : -1, xk = seiteK * (handy ? .2 : .26 + ((i * 37) % 4) / 3 * .06) * vw, yk = ((((i * 53) % 5) / 4) - .5) * vh * (handy ? .55 : .42);
      const z = -(i + 1) * masse.flugZ + weg - 300;
      stil(k, `translate(-50%, -50%) translate3d(${xk.toFixed(1)}px, ${yk.toFixed(1)}px, ${z.toFixed(1)}px)`, 0);
      const nah = handy ? 160 : 380; // am Handy gehen die Kacheln früher, bevor sie zu groß werden
      sicht(k, w.clamp((z + 2400) / 1000, 0, 1) * w.clamp((nah - z) / (nah * .8), 0, 1));
    });

    // ── 7 · Schluss: eigener Verlauf, Wortmarke, Erstgespräch; der Rahmen schnappt ein ──
    sicht(E.ende, ph(p, .9, .93));
    if (E.verlaufEnde) E.verlaufEnde.gebraucht(p > .895);
    const steigt = ph(p, .91, .955);
    stil(E.endeInhalt, `translate3d(0, ${((1 - steigt) * 36).toFixed(1)}px, 0) scale(${lerp(.96, 1, steigt).toFixed(4)})`, 0);
    sicht(E.endeInhalt, steigt);
    const schnapp = ph(p, .955, .975), rand = masse.rand * schnapp;
    stil(E.endeKarte, '', 0);
    E.endeKarte.style.clipPath = `inset(${rand.toFixed(1)}px round ${(masse.radius * schnapp).toFixed(1)}px)`;
    stil(E.endeRahmen, `scale(${lerp(1.04, 1, schnapp).toFixed(4)})`, 0);
    sicht(E.endeRahmen, schnapp * .9);
  }

  S.showreel = {
    vorhang: { dauer: 1900, ruhig: 700 },
    szene: { zustaende: S.drehbuch.zustaende, ruht: p => p < .365 || p > .96 },
    // Karte 2 steht vorn bei p ≈ 0,237, Karte 3 bei ≈ 0,303 (Rasten der Drehung) — so steht es an den Blöcken (data-spur-p); die
    // Band-Karten setzt messen() aus ihrer Lage. Hier nur, was kein eigener Block ist.
    anker: { start: 0, weg: .237 },
    vorbereiten, messen, bild,
  };
  document.addEventListener('DOMContentLoaded', () => {
    const lauf = S.spur && S.spur.starten(S.showreel);
    if (!lauf) document.documentElement.classList.add('spur-aus');
  });
})(typeof window !== 'undefined' ? window : globalThis);
