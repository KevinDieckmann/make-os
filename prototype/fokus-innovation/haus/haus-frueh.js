/* MAKE Innovation · „Das Haus“: läuft vor allem anderen, noch bevor die Fahrt gezeichnet wird.
   Wer die Fahrt schon beendet oder übersprungen hat (Marke „make-fahrt“ im localStorage, setzt haus.js), sieht die Fahrt nicht:
   die Klasse fahrt-aus blendet sie aus, die Kurz-Startseite steht ohne sichtbares Springen ganz oben. Mit ?fahrt=1 startet die Fahrt immer,
   ebenso bei einem Sprung an eine Etage (?etage=…, ?szene=…) und in den Standbildern (?p=…). localStorage kann fehlen: dann bleibt es bei der Fahrt. */
(() => {
  let weiter = false;
  try {
    const q = new URLSearchParams(location.search);
    weiter = localStorage.getItem('make-fahrt') === '1' && !['fahrt', 'etage', 'szene', 'p', 'y'].some((k) => q.has(k));
  } catch (_) { /* ohne localStorage: die Fahrt läuft */ }
  if (!weiter) return;
  document.documentElement.classList.add('fahrt-aus');
  const kopf = document.querySelector('.kopf');
  if (kopf) kopf.classList.remove('ueber-film', 'film-geht');
})();
