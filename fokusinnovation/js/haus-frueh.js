(() => {
  let weiter = false;
  try {
    const q = new URLSearchParams(location.search);
    weiter = localStorage.getItem('make-fahrt') === '1' && !['fahrt', 'etage', 'szene', 'p', 'y'].some((k) => q.has(k));
  } catch (_) {  }
  if (!weiter) return;
  document.documentElement.classList.add('fahrt-aus');
  const kopf = document.querySelector('.kopf');
  if (kopf) kopf.classList.remove('ueber-film', 'film-geht');
})();
