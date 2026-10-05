// Fokus Innovation · fokusinnovation.de — Drehbuch („Klar“, 05.10.2026)
// Nur diese Seite: was die Szene zeigt (MakeSzene.drehbuch, gelesen von js/szene/motor.js und website/standbild.mjs) und was im
// Showreel wann geschieht (MakeSzene.showreel, ausgeführt vom Baukasten js/szene/spur.js). Szene und Baukasten sind Byte-Kopien
// aus website/js/szene/ (makeinnovation.de) — nie hier ändern, sondern dort und dann `node scripts/fokus-seite.mjs`.
// Kevin 04.10.: 80 % Seriosität und Souveränität — Typografie, Weißraum, Haarlinien, ruhige Bewegung; die Lichter (die Szene,
// der Verlauf im Schluss) nur an zwei Stellen. Kein Laufband, kein Kachel-Flug, kein Vorhang.
//
// Fortschritt p (0 → 1) über die Spur:
//   0,00–0,15  Titelkarte auf Off-White: „Fokus Innovation“, rechts ein Fenster in den Abend (die Szene, live). Beim Scrollen
//              gleitet der Titel verschwommen nach unten weg, das Fenster öffnet sich zum dunklen Raum.
//   0,15–0,41  Der Abend: eine lange Tafel bei Nacht (Formation „tafel“), die Kamera fährt ruhig näher; die Überschrift steigt
//              Buchstabe für Buchstabe auf, der Ablauf kommt Zeile für Zeile.
//   0,41–0,60  Formate & Themen: die Tafel tritt zurück (von oben, gedimmt), die Themen stehen in einer Reihe.
//   0,60–0,83  Die Städte: aus der Tafel wird die Deutschlandkarte, feine Fäden von Berlin in die Städte; die Liste daneben.
//   0,83–1,00  Schluss: Wortmarke über eigenem Verlauf, „Auf Einladung — oder per Bewerbung.“; der Rahmen schnappt ein.
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};
  // STAEDTE_ANFANG: erzeugt mit node scripts/fokus-seite.mjs aus STAEDTE — nicht von Hand ändern
  const STAEDTE = [
    { name: 'Berlin', lat: 52.52, lon: 13.405 },
    { name: 'Hamburg', lat: 53.551, lon: 9.993 },
    { name: 'Bielefeld', lat: 52.03, lon: 8.532 },
    { name: 'Köln', lat: 50.938, lon: 6.96 },
    { name: 'München', lat: 48.137, lon: 11.575 },
    { name: 'Dresden', lat: 51.0504, lon: 13.7373 },
  ];
  // STAEDTE_ENDE

  // ── Szene (dunkler Raum): ohne Netz und Pfad. Drei Zustände zeigen dieselbe Tafel (Punkt für Punkt gleich — nur die Kamera
  //    fährt), erst zu den Städten gehen die Teilchen in die Karte über, gedimmt. ──
  //   p, bis     Lage im Showreel: von p bis bis steht der Zustand, dazwischen fährt die Kamera weich zum nächsten
  //   s          Anker am Pfad · abstand/hebung/seite/blick: Kamera · breite/hoehe: halbe Größe der Formation (passt ins Bild)
  //   dreh       Neigung der Formation um ihren Anker in Grad ({ x, y })
  //   schub      Rechner: Szene rechts neben dem Text · hoch: hochkant oben (+) oder mittig (0) · hell: Helligkeit der Formation
  //   standbild  dieser Zustand bekommt ein Standbild (assets/szene/<name>.svg) für die ruhige Fassung (node website/standbild.mjs fokus)
  // Die Tafel ist um ihren Anker geneigt (wir sehen von schräg oben auf den Tisch) — in allen drei Zuständen gleich, damit die
  // Teilchen stehen bleiben und nur die Kamera fährt.
  const TAFEL = { x: 30, y: -16 };
  S.drehbuch = {
    saat: 5102026,
    fortschritt: 'extern',
    netz: false,
    pfad: false,
    einstieg: false,
    text: false,
    folgen: .16,
    teilchen: { rechner: 6000, handy: 3200, standbild: 2600 },
    aurora: { staerke: .12, aufloesung: .25, oktaven: 4 },
    handy: () => S.spur ? S.spur.stufe(window.innerWidth, window.innerHeight) !== 'rechner' : window.innerWidth < 760,
    zustaende: [
      { name: 'abend', p: 0, bis: .1, formation: 'tafel', dreh: TAFEL, s: 40, abstand: 11, hebung: 2.4, seite: -1.5, blick: 1.2, breite: 6.8, hoehe: 3.6, schub: .6, hoch: .02, funkeln: .1, hell: 1, aurora: .6, standbild: true },
      { name: 'gespraech', p: .22, bis: .38, formation: 'tafel', dreh: TAFEL, s: 40, abstand: 9, hebung: 1.6, seite: 2, blick: 0, breite: 6, hoehe: 3.4, schub: .44, hoch: .38, funkeln: .1, hell: 1, aurora: .8 },
      { name: 'themen', p: .47, bis: .55, formation: 'tafel', dreh: TAFEL, s: 40, abstand: 22, hebung: 10, seite: -2, blick: -.6, breite: 8, hoehe: 5, schub: .5, hoch: .06, funkeln: .08, hell: .3, aurora: .5 },
      { name: 'staedte', p: .67, bis: .8, formation: 'karte', s: 40, abstand: 16, hebung: 21, blick: -5.5, breite: 13.5, hoehe: 13, schub: .42, hoch: .36, funkeln: .12, hell: .9, aurora: .7, optionen: { breite: 12, start: 'Berlin', staedte: STAEDTE, faeden: 4 } },
    ],
  };

  if (typeof document === 'undefined') return;

  // ── Showreel ──
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  let E = null; // Elemente (nach dem Laden)
  const masse = { rand: 14, radius: 28, fenster: { t: 0, r: 0, u: 0, l: 0, rund: 24 } };

  /** Größen aus dem CSS (--sr-*) und die Lage des Fensters in der Titelkarte (Layout-Box, nie transformiert). */
  function messen() {
    const cs = getComputedStyle(document.documentElement), px = n => parseFloat(cs.getPropertyValue(n)) || 0;
    masse.rand = px('--sr-rand'); masse.radius = px('--sr-radius');
    const b = E.buehne.getBoundingClientRect(), f = E.fenster.getBoundingClientRect();
    masse.fenster = { t: f.top - b.top, l: f.left - b.left, r: b.right - f.right, u: b.bottom - f.bottom, rund: parseFloat(getComputedStyle(E.fenster).borderTopLeftRadius) || 0 };
  }

  function vorbereiten(w) {
    E = {
      buehne: $('.buehne'), szene: $('.szene'), fenster: $('.fenster'),
      titelMikro: $('.titel-mikro'), titel: w.buchstaben($('[data-zerfall]')), titelFuss: $('.titel-fuss'), fakten: $('.titel .fakten'),
      abend: $('.abend'), abendMikro: $('.abend .mikro'), abendTitel: w.buchstaben($('[data-aufstieg]')), abendText: $('.abend .einleitung'),
      ablauf: $$('.abend .ablauf li'), abendHinweis: $('.abend .hinweis'),
      themen: $('.themen'), themenKopf: $('.themen-kopf'), themenListe: $$('.themen-liste li'),
      staedte: $('.staedte-block'), staedteKopf: $('.staedte-block .raum-inhalt'), staedteZeilen: $$('.staedte-block .staedte li'),
      ende: $('.ende'), endeKarte: $('.ende-karte'), endeRahmen: $('.ende-rahmen'), endeInhalt: $('.ende-inhalt'),
    };
    E.verlaufEnde = w.verlauf($('.ende canvas.verlauf'), { staerke: .3, lage: [.5, .45] });
  }

  /** Ein Block kommt (u 0 → 1) von leicht unten herein. */
  function herein(w, el, u, weg) {
    w.sicht(el, u);
    w.stil(el, `translate3d(0, ${((1 - u) * (weg || 14)).toFixed(1)}px, 0)`, 0);
  }

  function bild(p, w) {
    const { ph, lerp, sicht, stil } = w;

    // ── 1 · Titelkarte: Absender, Satz und Knöpfe gehen ruhig, der Titel gleitet verschwommen nach unten weg ──
    const geht = ph(p, .015, .065);
    sicht(E.titelMikro, 1 - geht);
    sicht(E.fakten, 1 - ph(p, .01, .05));
    sicht(E.titelFuss, 1 - geht); stil(E.titelFuss, `translate3d(0, ${(geht * 24).toFixed(1)}px, 0)`, 0);
    w.zerfall(E.titel, p, .025, .095);
    // Das Fenster in den Abend öffnet sich zum ganzen Raum (die Szene liegt darunter, ihr Ausschnitt wächst).
    const auf = ph(p, .05, .15), f = masse.fenster;
    sicht(E.szene, 1);
    E.szene.style.clipPath = auf >= 1 ? 'none'
      : `inset(${lerp(f.t, 0, auf).toFixed(1)}px ${lerp(f.r, 0, auf).toFixed(1)}px ${lerp(f.u, 0, auf).toFixed(1)}px ${lerp(f.l, 0, auf).toFixed(1)}px round ${lerp(f.rund, 0, auf).toFixed(1)}px)`;

    // ── 2 · Der Abend: Überschrift steigt Buchstabe für Buchstabe auf, dann Text und Ablauf ──
    const aAus = ph(p, .385, .41);
    sicht(E.abend, ph(p, .15, .18) * (1 - aAus));
    stil(E.abend, `translate3d(0, ${(-aAus * 40).toFixed(1)}px, 0)`, aAus * 6);
    sicht(E.abendMikro, ph(p, .155, .185));
    w.aufstieg(E.abendTitel, p, .16, .235);
    herein(w, E.abendText, ph(p, .21, .245), 16);
    E.ablauf.forEach((li, i) => herein(w, li, ph(p, .235 + i * .014, .262 + i * .014), 12));
    sicht(E.abendHinweis, ph(p, .31, .34));

    // ── 3 · Formate & Themen: die Tafel tritt zurück, die Themen kommen nacheinander ──
    const tAus = ph(p, .575, .6);
    sicht(E.themen, ph(p, .41, .44) * (1 - tAus));
    stil(E.themen, `translate3d(0, ${(-tAus * 40).toFixed(1)}px, 0)`, tAus * 6);
    herein(w, E.themenKopf, ph(p, .415, .45), 18);
    E.themenListe.forEach((li, i) => herein(w, li, ph(p, .44 + i * .012, .468 + i * .012), 16));

    // ── 4 · Die Städte: Karte der Szene rechts (hochkant oben), Liste links (hochkant unten) ──
    const sAus = ph(p, .805, .83);
    sicht(E.staedte, ph(p, .6, .635) * (1 - sAus));
    stil(E.staedte, `translate3d(0, ${(-sAus * 40).toFixed(1)}px, 0)`, sAus * 6);
    herein(w, E.staedteKopf, ph(p, .605, .64), 18);
    E.staedteZeilen.forEach((li, i) => w.sicht(li, ph(p, .635 + i * .012, .66 + i * .012)));

    // ── 5 · Schluss: eigener Verlauf, Wortmarke, Teilnahme; der Rahmen aus Papier schnappt ein ──
    sicht(E.ende, ph(p, .83, .86));
    if (E.verlaufEnde) E.verlaufEnde.gebraucht(p > .825);
    const steigt = ph(p, .85, .91);
    stil(E.endeInhalt, `translate3d(0, ${((1 - steigt) * 36).toFixed(1)}px, 0) scale(${lerp(.96, 1, steigt).toFixed(4)})`, 0);
    sicht(E.endeInhalt, steigt);
    const schnapp = ph(p, .93, .96), rand = masse.rand * schnapp;
    stil(E.endeKarte, '', 0);
    E.endeKarte.style.clipPath = `inset(${rand.toFixed(1)}px round ${(masse.radius * schnapp).toFixed(1)}px)`;
    stil(E.endeRahmen, `scale(${lerp(1.04, 1, schnapp).toFixed(4)})`, 0);
    sicht(E.endeRahmen, schnapp * .9);
  }

  S.showreel = {
    vorhang: false,
    // Die Szene ist von Anfang an zu sehen (Fenster der Titelkarte); sie ruht erst, wenn der Schluss sie ganz verdeckt.
    szene: { zustaende: S.drehbuch.zustaende, ruht: p => p > .9 },
    // Die Blöcke der Bühne wissen selbst, wo sie stehen (data-spur-p); hier nur, was kein eigener Block ist.
    anker: { start: 0 },
    vorbereiten, messen, bild,
  };
  document.addEventListener('DOMContentLoaded', () => {
    const lauf = S.spur && S.spur.starten(S.showreel);
    if (!lauf) document.documentElement.classList.add('spur-aus');
  });
})(typeof window !== 'undefined' ? window : globalThis);
