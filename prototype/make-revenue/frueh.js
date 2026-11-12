// MAKE Revenue · läuft vor dem ersten Bild: meldet „JavaScript ist da“, damit CSS Bewegung überhaupt erst zulässt.
// Kommt seite.js nicht an (Netz, Fehler), nimmt die Wache die Klasse nach drei Sekunden zurück: Dann steht alles sichtbar da.
(function () {
  var h = document.documentElement;
  h.classList.add('js');
  setTimeout(function () { if (!window.MAKE_REVENUE_BEREIT) h.classList.remove('js'); }, 3000);
})();
