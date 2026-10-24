// makeinnovation.de — das einzige Skript (24.10.2026). Das Handy-Menü ist ein <details> und geht ohne Skript; hier schließt es nur
// nach einem Klick auf einen Eintrag oder mit Esc wieder. Liest nichts aus, speichert nichts, sendet nichts.
(() => {
  const menue = document.querySelector('details.menue');
  if (!menue) return;
  menue.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('a')) menue.open = false; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menue.open) { menue.open = false; menue.querySelector('summary')?.focus(); }
  });
})();
