// MAKE Innovation · Seite: Abschnitte erscheinen einmal beim Scrollen, das Menü schließt nach einem Klick und mit Esc,
// Liest nichts, speichert nichts, sendet nichts.
(() => {
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beobachten = 'IntersectionObserver' in window;

  const erscheint = document.querySelectorAll('.erscheint');
  if (ruhig || !beobachten) erscheint.forEach((el) => el.classList.add('sichtbar'));
  else {
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) if (e.isIntersecting) { e.target.classList.add('sichtbar'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    erscheint.forEach((el) => io.observe(el));
  }

  const menue = document.querySelector('.menue');
  if (menue) {
    menue.addEventListener('click', (ev) => { if (ev.target.closest('a')) menue.open = false; });
    const rest = () => [...document.body.children, ...(menue.closest('.kopf-innen')?.children ?? [])].filter((el) => !el.contains(menue));
    menue.addEventListener('toggle', () => {
      document.documentElement.classList.toggle('menue-offen', menue.open);
      for (const el of rest()) el.inert = menue.open;
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && menue.open) { menue.open = false; menue.querySelector('summary').focus(); }
    });
  }

  // Ausklappmenü am Rechner: Esc blendet es aus, bis Maus oder Fokus den Punkt verlassen.
  const punkte = document.querySelectorAll('.nav-punkt');
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    for (const p of punkte) if (p.matches(':hover, :focus-within')) { p.classList.add('zu'); if (p.contains(document.activeElement)) p.querySelector('a')?.focus(); }
  });
  for (const p of punkte) {
    p.addEventListener('mouseleave', () => p.classList.remove('zu'));
    p.addEventListener('focusout', (ev) => { if (!p.contains(ev.relatedTarget)) p.classList.remove('zu'); });
  }

})();
