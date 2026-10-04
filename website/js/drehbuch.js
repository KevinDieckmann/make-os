// MAKE Innovation · Landingpage v5: Drehbuch der Szene (04.10.2026)
// Was die Szene je Kapitel zeigt. Jeder Eintrag gehört zu genau einem Abschnitt der Seite mit gleichem data-zustand
// (index.html, in derselben Reihenfolge). Der Motor (js/szene/motor.js) und die Standbilder (website/standbild.mjs)
// lesen dieses Drehbuch — Kapitel ändern heißt: hier Formation/Kamera, in index.html den Text (website/LIESMICH.md).
//   s        Anker am Pfad (Tiefe; die Kamera fährt von Anker zu Anker)
//   abstand  Kamera hinter dem Anker · hebung: darüber · seite: seitlich · blick: Höhe des Blickziels
//   breite/hoehe  halbe Größe der Formation (Mindestabstand, damit sie ins Bild passt)
//   schub    Rechner: Szene steht rechts neben dem Text (0 = mittig) · funkeln: 0 ruhig … 1 Funken
//   faeden   Helligkeit der Lichtfäden des Pfads · nah: Anteil des Kameraabstands, ab dem die Fäden einblenden (0 = ganz nah)
//   netzLeer [vor, nach]: das Neuronennetz bleibt hier frei (Blick von oben auf die Karte)
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};
  S.drehbuch = {
    saat: 4102026,
    netz: { dichtBis: 140 },
    zustaende: [
      { name: 'weg', formation: 'weg', s: 24, abstand: 22, hebung: .6, blick: -.25, breite: 2.4, hoehe: 1.6, funkeln: .35, faeden: 1, nah: 0 },
      { name: 'innovation', formation: 'schriftzug', s: 64, abstand: 19, hebung: .15, breite: 13.6, hoehe: 2.6, faeden: .35, nah: .6, optionen: { breite: 26 } },
      { name: 'satz', formation: 'strom', s: 98, abstand: 9, hebung: .5, breite: 2.4, hoehe: 1.8, faeden: .8, nah: .15 },
      { name: 'beratung', formation: 'huerde', s: 134, abstand: 17, hebung: 1.2, seite: -1.2, breite: 9.2, hoehe: 6.2, schub: .5 },
      { name: 'sales', formation: 'trichter', dreh: { y: -18 }, s: 168, abstand: 16, hebung: 2.5, breite: 8.2, hoehe: 4.8, schub: .5 },
      { name: 'sichtbarkeit', formation: 'signal', s: 202, abstand: 16, hebung: 4.5, blick: 1.2, breite: 7.6, hoehe: 5.4, schub: .5 },
      { name: 'umsetzung', formation: 'stufen', dreh: { y: 24 }, s: 236, abstand: 17, hebung: 3.5, blick: -.6, breite: 8.4, hoehe: 4, schub: .5 },
      { name: 'netzwerk', formation: 'runden', s: 270, abstand: 15, hebung: 1.6, breite: 6.2, hoehe: 5, schub: .5 },
      { name: 'fokus', formation: 'karte', s: 314, abstand: 16, hebung: 21, blick: -3, breite: 12.5, hoehe: 13, schub: .5, netzLeer: [52, 20], faeden: .1, nah: .95,
        optionen: { breite: 12, start: 'Berlin' } },
      { name: 'funken', formation: 'funken', s: 360, abstand: 15, hebung: 1, breite: 7, hoehe: 5, schub: .5, funkeln: 1 },
      { name: 'ki', formation: 'strahl', s: 394, abstand: 16, hebung: 2, breite: 10.4, hoehe: 5, schub: .5 },
      { name: 'wirkung', formation: 'wirkung', s: 428, abstand: 16, hebung: 1.2, breite: 7.6, hoehe: 3.6, schub: .5 },
      { name: 'kontakt', formation: 'zeichen', s: 466, abstand: 20, hebung: 0, breite: 12.6, hoehe: 5, schub: .5, optionen: { breite: 24 } },
    ],
  };
})(typeof window !== 'undefined' ? window : globalThis);
