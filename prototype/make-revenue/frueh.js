// MAKE Revenue · läuft vor dem ersten Bild: meldet „JavaScript ist da“, damit CSS Bewegung überhaupt erst zulässt,
// und schaltet den Film-Einstieg frei (html.film-an), wenn Bewegung erwünscht ist und das Fenster hoch genug ist.
// So steht die Bühne schon im ersten Bild richtig, und die Überschrift springt nicht.
// Kommt seite.js nicht an (Netz, Fehler), nimmt die Wache beide Klassen nach drei Sekunden zurück: Dann steht alles ruhig und sichtbar da.
// Dasselbe gilt für den Film allein, wenn film.js auf der Startseite nicht ankommt.
(function () {
  var h = document.documentElement, w = window;
  h.classList.add('js');
  var ruhig = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!ruhig && w.innerHeight >= 600 && w.innerWidth >= 340) h.classList.add('film-an');
  setTimeout(function () {
    if (!w.MAKE_REVENUE_BEREIT) h.classList.remove('js', 'film-an');
    else if (!w.MAKE_REVENUE_FILM && document.querySelector('[data-film]')) h.classList.remove('film-an');
  }, 3000);
})();
