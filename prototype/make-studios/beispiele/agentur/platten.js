// Vier Platten, ein Bild: Das Beispielfoto wird im Browser in die Druckfarben Cyan, Magenta, Gelb und Schwarz zerlegt.
// Jede Leistung legt beim Scrollen ihre Platte dazu; liegen alle vier übereinander, ist das Bild scharf.
// Ohne Skript, ohne Canvas oder wenn das Foto nicht lädt, steht einfach das Foto da.

const NAMEN = { c: 'Cyan', m: 'Magenta', y: 'Gelb', k: 'Schwarz' };
const FARBEN = { c: [0, 167, 230], m: [236, 11, 141], y: [255, 229, 0], k: [16, 16, 17] };
const REIHE = ['c', 'm', 'y', 'k'];

export function plattenEinrichten() {
  const figur = document.querySelector('[data-platten]');
  if (!figur) return;
  const flaeche = figur.querySelector('[data-platten-flaeche]');
  const foto = flaeche.querySelector('img');
  const stand = figur.querySelector('[data-platten-stand]');
  const tasten = [...document.querySelectorAll('[data-platte]')];
  const posten = [...document.querySelectorAll('[data-leistung]')];
  const an = { c: true, m: true, y: true, k: true };
  let platten = null;
  let stufe = -1;

  function zeichnen() {
    const liste = REIHE.filter(n => an[n]);
    if (platten) for (const n of REIHE) platten[n].classList.toggle('aus', !an[n]);
    figur.classList.toggle('scharf', liste.length === 4);
    for (const t of tasten) t.setAttribute('aria-pressed', String(an[t.dataset.platte]));
    if (!platten) return;
    stand.textContent = liste.length === 4 ? 'Alle vier Platten · das Bild ist scharf'
      : liste.length ? `${liste.length} von 4 · ${liste.map(n => NAMEN[n]).join(' + ')}`
      : 'Keine Platte · leeres Papier';
  }

  function setzeStufe(i) {
    if (i === stufe) return;
    stufe = i;
    REIHE.forEach((n, nr) => { an[n] = nr <= i; });
    posten.forEach((p, nr) => p.classList.toggle('aktiv', nr === i));
    zeichnen();
  }

  function zerlegen() {
    const B = Math.min(900, foto.naturalWidth);
    const H = Math.round(B * foto.naturalHeight / foto.naturalWidth);
    const quelle = document.createElement('canvas');
    quelle.width = B; quelle.height = H;
    const stift = quelle.getContext('2d', { willReadFrequently: true });
    stift.drawImage(foto, 0, 0, B, H);
    const d = stift.getImageData(0, 0, B, H).data;
    const bilder = REIHE.map(() => new ImageData(B, H));
    const [zc, zm, zy, zk] = bilder.map(b => b.data);
    REIHE.forEach((n, nr) => {
      const z = bilder[nr].data, [r, g, b] = FARBEN[n];
      for (let i = 0; i < z.length; i += 4) { z[i] = r; z[i + 1] = g; z[i + 2] = b; }
    });
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const dunkel = 1 - Math.max(r, g, b);
      const k = dunkel * dunkel;                 // Schwarz nur in den Tiefen: so tragen die Farbplatten auch die Grautöne
      const f = k < 1 ? 255 / (1 - k) : 0;
      zc[i + 3] = (1 - r - k) * f;
      zm[i + 3] = (1 - g - k) * f;
      zy[i + 3] = (1 - b - k) * f;
      zk[i + 3] = k * 255;
    }
    platten = {};
    REIHE.forEach((n, nr) => {
      const cv = document.createElement('canvas');
      cv.width = B; cv.height = H;
      cv.className = `platte platte-${n}`;
      cv.setAttribute('aria-hidden', 'true');
      cv.getContext('2d').putImageData(bilder[nr], 0, 0);
      platten[n] = cv;
      flaeche.append(cv);
    });
    figur.classList.add('bereit');
    if (stufe < 0) setzeStufe(0); else zeichnen();
  }

  async function bauen() {
    try {
      foto.loading = 'eager';
      if (!foto.complete) await new Promise((ok, nein) => { foto.addEventListener('load', ok, { once: true }); foto.addEventListener('error', nein, { once: true }); });
      await foto.decode?.();
      if (foto.naturalWidth) zerlegen();
    } catch (_) { /* Foto lädt nicht oder Canvas gesperrt: das Foto bleibt, die Platten entfallen */ }
  }

  for (const t of tasten) t.addEventListener('click', () => { an[t.dataset.platte] = !an[t.dataset.platte]; zeichnen(); });

  if (!('IntersectionObserver' in window)) { bauen(); return; }
  // Erst bauen, wenn der Abschnitt näher kommt.
  const nah = new IntersectionObserver(([e]) => { if (e.isIntersecting) { nah.disconnect(); bauen(); } }, { rootMargin: '700px 0px' });
  nah.observe(figur);

  // Welche Leistung steht gerade auf der Leselinie? Auf schmalen Fenstern liegt sie tiefer, weil das Bild oben haftet.
  const schmal = matchMedia('(max-width: 899px)');
  let linie = null;
  function beobachten() {
    linie?.disconnect();
    linie = new IntersectionObserver(eintraege => {
      for (const e of eintraege) if (e.isIntersecting) setzeStufe(posten.indexOf(e.target));
    }, { rootMargin: schmal.matches ? '-74% 0px -25% 0px' : '-50% 0px -49% 0px' });
    posten.forEach(p => linie.observe(p));
  }
  beobachten();
  schmal.addEventListener?.('change', beobachten);
}
