// Fokus Innovation · Seite: Abschnitte erscheinen einmal beim Scrollen, das Menü schließt nach einem Klick und mit Esc,
// der Knopf zum Check zeigt sich erst nach dem Einstieg und tritt über dem Schlussakt zurück. Liest nichts, speichert nichts, sendet nichts.
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
    menue.addEventListener('toggle', () => document.documentElement.classList.toggle('menue-offen', menue.open));
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && menue.open) { menue.open = false; menue.querySelector('summary').focus(); }
    });
  }

  const knopf = document.querySelector('.check-knopf');
  if (knopf && beobachten) {
    const einstieg = document.querySelector('.film') ?? document.querySelector('.held');
    const ende = document.querySelectorAll('.schlussakt, .fuss');
    const sichtbar = new Set();
    const setzen = () => knopf.classList.toggle('versteckt', sichtbar.size > 0 || document.documentElement.classList.contains('menue-offen'));
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) e.isIntersecting ? sichtbar.add(e.target) : sichtbar.delete(e.target);
      setzen();
    }, { threshold: 0 });
    if (einstieg) io.observe(einstieg);
    ende.forEach((el) => io.observe(el));
    menue?.addEventListener('toggle', setzen);
    knopf.classList.add('versteckt');
  }
})();
