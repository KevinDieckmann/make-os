// MAKE Innovation · Landingpage: Handy-Menü (01.10.2026)
// Das Menü ist ein <details> und funktioniert auch ohne dieses Skript. Hier wird es nur bequemer:
// nach einem Klick auf einen Abschnitt, mit Esc oder per Klick daneben schließt es sich.
// Speichert nichts, liest nichts aus, sendet nichts (website/pruefen.mjs prüft das).
const menue = document.querySelector('details.menue');
if (menue) {
  const zu = () => { menue.open = false; };
  menue.addEventListener('click', e => { if (e.target instanceof Element && e.target.closest('nav a')) zu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menue.open) { zu(); menue.querySelector('summary')?.focus(); }
  });
  document.addEventListener('click', e => { if (menue.open && e.target instanceof Node && !menue.contains(e.target)) zu(); });
}
