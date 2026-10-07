// MAKE Innovation · Der Weg: die Linie zeichnet sich EINMAL, wenn sie zum ersten Mal ins Bild kommt („v3“, 07.10.2026).
// Ohne Skript und bei „Bewegung reduzieren“ steht jede Linie sofort fertig da. Kein Scroll-Binden: ein Beobachter, der jede Linie
// nach dem ersten Erscheinen wieder abmeldet. Versteckt wird nur, was beim Laden noch unter dem Bild liegt (kein Aufblitzen).
// Gemeinsame Datei für makeinnovation.de und fokusinnovation.de (Kopie: node scripts/fokus-seite.mjs).
// Liest nichts aus, speichert nichts, sendet nichts (website/pruefen.mjs prüft das).
const linien = document.querySelectorAll('.zeichnen');
const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (linien.length && !ruhig && 'IntersectionObserver' in window) {
  const beobachter = new IntersectionObserver(eintraege => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      e.target.classList.remove('wartet');
      beobachter.unobserve(e.target);
    }
  }, { threshold: 0.25 });
  for (const linie of linien) {
    if (linie.getBoundingClientRect().top < window.innerHeight) continue;
    linie.classList.add('wartet');
    beobachter.observe(linie);
  }
}
