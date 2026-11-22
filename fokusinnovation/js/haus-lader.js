(() => {
  const meta = (n) => { const m = document.querySelector('meta[name="haus-' + n + '"]'); return m ? m.getAttribute('content') || '' : ''; };
  const css = meta('css'), lenis = meta('lenis');
  let js = meta('js');
  if (!css || !js) return;
  try { if (new URLSearchParams(location.search).has('kalt')) js += (js.includes('?') ? '&' : '?') + 'kalt=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); } catch (_) { /* dann eben warm */ }
  let weiter = false;
  try {
    const q = new URLSearchParams(location.search);
    weiter = localStorage.getItem('make-fahrt') === '1' && !['fahrt', 'etage', 'szene', 'p', 'y'].some((k) => q.has(k));
  } catch (_) { /* ohne Speicher läuft die Fahrt */ }
  if (!weiter) {
    document.write('<link rel="stylesheet" href="' + css + '">');
    if (lenis) document.write('<script src="' + lenis + '" defer><\/script>');
    document.write('<script type="module" src="' + js + '"><\/script>');
    return;
  }
  const held = meta('held'), sizes = meta('held-sizes');
  if (held) document.write('<link rel="preload" as="image" type="image/webp" fetchpriority="high" imagesrcset="' + held + '" imagesizes="' + sizes + '">');
  document.addEventListener('DOMContentLoaded', () => {
    if (document.documentElement.classList.contains('fahrt-aus')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.append(l);
    if (lenis) { const s = document.createElement('script'); s.src = lenis; s.onload = () => { const m = document.createElement('script'); m.type = 'module'; m.src = js; document.head.append(m); }; document.head.append(s); }
    else { const m = document.createElement('script'); m.type = 'module'; m.src = js; document.head.append(m); }
  }, { once: true });
})();
