// Stummer Film in einer Schleife. Das Posterbild liegt immer darunter und ist sofort da.
// Das Video lädt erst, wenn es in Sichtnähe kommt, und hält an, sobald es aus dem Bild ist.
// Bei „weniger Bewegung“ oder im Datensparmodus bleibt es beim Poster. Lädt das Video nicht, bleibt das Poster stehen.

const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');
const sparsam = () => navigator.connection?.saveData === true;

/**
 * @param {HTMLElement} rahmen  Element mit .film-poster, .film-video und .film-knopf
 */
export function filmEinrichten(rahmen) {
  const video = rahmen.querySelector('.film-video');
  const knopf = rahmen.querySelector('.film-knopf');
  if (!video || !('IntersectionObserver' in window)) return;

  let inSicht = false;     // im Bild oder kurz davor
  let vonHand = false;     // Besucher hat angehalten
  let defekt = false;
  let liefSchon = false;
  let gewaehlt = false;

  const darf = () => !wenigBewegung.matches && !sparsam() && !defekt;

  // Auf breiten Fenstern die größere Fassung nehmen (nur vor dem ersten Laden)
  function quelleWaehlen() {
    if (gewaehlt) return;
    gewaehlt = true;
    const gross = video.dataset.gross;
    if (gross && innerWidth >= 1440) video.src = gross;
  }

  function knopfZeigen() {
    if (!knopf) return;
    knopf.hidden = !(darf() && liefSchon);
    knopf.classList.toggle('steht', vonHand);
    knopf.setAttribute('aria-label', vonHand ? 'Film abspielen' : 'Film anhalten');
  }

  function abgleichen() {
    const soll = darf() && inSicht && !vonHand;
    if (soll) {
      quelleWaehlen();
      if (video.paused) video.play()?.catch(() => { /* Abspielen nicht erlaubt: das Poster bleibt */ });
    } else if (!video.paused) {
      video.pause();
    }
    if (!darf()) rahmen.classList.remove('laeuft', 'blende');
    knopfZeigen();
  }

  video.muted = true;
  video.addEventListener('playing', () => { liefSchon = true; rahmen.classList.add('laeuft'); knopfZeigen(); });
  video.addEventListener('error', () => { defekt = true; rahmen.classList.remove('laeuft', 'blende'); knopfZeigen(); });
  // Kurz vor dem Ende blendet das Video auf das Poster (= erstes Bild) über: die Schleife springt nicht.
  video.addEventListener('timeupdate', () => {
    if (!Number.isFinite(video.duration)) return;
    rahmen.classList.toggle('blende', video.duration - video.currentTime < 1.1);
  });

  knopf?.addEventListener('click', () => { vonHand = !vonHand; abgleichen(); });

  new IntersectionObserver(([e]) => { inSicht = e.isIntersecting; abgleichen(); }, { rootMargin: '180px 0px' }).observe(rahmen);
  wenigBewegung.addEventListener?.('change', abgleichen);
  navigator.connection?.addEventListener?.('change', abgleichen);
}
