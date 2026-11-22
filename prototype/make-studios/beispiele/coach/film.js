// Stummer Film in einer Schleife. Das Posterbild liegt immer darunter und ist sofort da.
// Das Video lädt erst, wenn es in Sichtnähe kommt, und hält an, sobald es aus dem Bild ist.
// Bei „weniger Bewegung“ oder im Datensparmodus bleibt es beim Poster. Lädt das Video nicht, bleibt das Poster stehen.

const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const sparsam = () => navigator.connection?.saveData === true;
const schmal = matchMedia('(max-width: 720px)');
// Der Film lädt erst nach der ersten Eingabe (Scrollen, Tippen, Taste, Maus): vorher steht nur das Poster, der erste Bildschirm bleibt leicht.
let eingabe = false;
const wartende = new Set();
['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((n) => addEventListener(n, () => { if (eingabe) return; eingabe = true; wartende.forEach((f) => f()); }, { passive: true }));

/**
 * @param {HTMLElement} rahmen  Element mit .film-poster, .film-video und .film-knopf
 * @returns {boolean} true, wenn der Film eingerichtet wurde
 */
export function filmEinrichten(rahmen) {
  const video = rahmen.querySelector('.film-video');
  const knopf = rahmen.querySelector('.film-knopf');
  if (!video || !('IntersectionObserver' in window)) return false;

  // Auf großen Fenstern die größere Fassung nehmen (nur wenn Daten nicht gespart werden sollen).
  const gross = video.dataset.gross;
  if (gross && matchMedia('(min-width: 1440px)').matches && !sparsam()) video.src = gross;

  let inSicht = false;   // im Bild oder kurz davor
  let vonHand = false;   // Besucherin oder Besucher hat angehalten
  let defekt = false;
  let liefSchon = false;

  // data-nur-rechner: der Film ist groß, am Handy bleibt es beim Poster
  const darf = () => eingabe && !wenigBewegung.matches && !sparsam() && !defekt && !(video.dataset.nurRechner !== undefined && schmal.matches);

  function knopfZeigen() {
    if (!knopf) return;
    knopf.hidden = !(darf() && liefSchon);
    knopf.classList.toggle('steht', vonHand);
    knopf.setAttribute('aria-label', vonHand ? 'Film abspielen' : 'Film anhalten');
  }

  function abgleichen() {
    const soll = darf() && inSicht && !vonHand;
    if (soll) {
      if (video.paused) video.play()?.catch(() => { /* Abspielen nicht erlaubt: das Poster bleibt */ });
    } else if (!video.paused) {
      video.pause();
    }
    if (!darf()) rahmen.classList.remove('laeuft', 'blende');
    knopfZeigen();
  }

  video.muted = true;
  wartende.add(abgleichen);
  video.addEventListener('playing', () => { liefSchon = true; rahmen.classList.add('laeuft'); knopfZeigen(); });
  video.addEventListener('error', () => { defekt = true; rahmen.classList.remove('laeuft', 'blende'); knopfZeigen(); });
  // Kurz vor dem Ende blendet das Video auf das Poster (= erstes Bild) über: Die Schleife springt nicht.
  video.addEventListener('timeupdate', () => {
    if (!Number.isFinite(video.duration)) return;
    rahmen.classList.toggle('blende', video.duration - video.currentTime < 1.1);
  });

  knopf?.addEventListener('click', () => { vonHand = !vonHand; abgleichen(); });

  new IntersectionObserver(([e]) => { inSicht = e.isIntersecting; abgleichen(); }, { rootMargin: '160px 0px' }).observe(rahmen);
  wenigBewegung.addEventListener?.('change', abgleichen);
  navigator.connection?.addEventListener?.('change', abgleichen);
  return true;
}
