// MAKE Innovation · Seite: Abschnitte erscheinen einmal beim Scrollen, das Menü schließt nach einem Klick und mit Esc,
// Belegzahlen zählen einmal hoch, die neun Situationen der Startseite lassen sich wählen und antippen.
// Liest nichts, speichert nichts, sendet nichts.
(() => {
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beobachten = 'IntersectionObserver' in window;

  // Lokale Vorschau: Auf dem eigenen Rechner führen die Verweise zu den Marken auf deren lokale Vorschauen (sonst unverändert).
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    const lokal = { 'makestudios.de': 'http://localhost:3022', 'makerevenue.de': 'http://localhost:3023' };
    document.querySelectorAll('a[href^="https://make"]').forEach((a) => {
      const u = new URL(a.href);
      if (lokal[u.hostname]) a.href = lokal[u.hostname] + u.pathname + u.search + u.hash;
    });
  }

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

  // Belegzahlen (11.11.): die Zahl zählt einmal hoch, ihre Kugel läuft die Bahn mit. Der Endstand steht im HTML; ohne Skript und bei
  // „Bewegung reduzieren“ bleibt er einfach stehen.
  const belege = [...document.querySelectorAll('[data-beleg]')];
  if (belege.length && !ruhig && beobachten) {
    const laeufe = new Map();
    for (const el of belege) {
      const zahl = el.querySelector('[data-zahl]');
      const m = zahl?.textContent.trim().match(/^(\d+)(?:,(\d+))?$/);
      if (!m) continue;
      const ziel = parseFloat(`${m[1]}.${m[2] ?? 0}`);
      const stellen = (m[2] ?? '').length;
      const text = zahl.textContent;
      const linie = el.querySelector('.beleg-strecke');
      const kugel = el.querySelector('.beleg-kugel');
      const x0 = linie ? +linie.getAttribute('x1') : 0;
      const x1 = linie ? +linie.getAttribute('x2') : 0;
      const setzen = (q) => {
        zahl.textContent = q >= 1 ? text : (ziel * q).toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
        if (linie && kugel) { const x = (x0 + (x1 - x0) * q).toFixed(1); linie.setAttribute('x2', x); kugel.setAttribute('cx', x); }
      };
      setzen(0);
      laeufe.set(el, setzen);
    }
    const dauer = 1700;
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const setzen = laeufe.get(e.target);
        const warten = 250 + 180 * belege.indexOf(e.target);
        let t0 = null;
        const takt = (jetzt) => {
          if (t0 === null) t0 = jetzt + warten;
          const q = Math.min(1, Math.max(0, (jetzt - t0) / dauer));
          setzen(1 - Math.pow(1 - q, 3));
          if (q < 1) requestAnimationFrame(takt);
        };
        requestAnimationFrame(takt);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 });
    for (const el of laeufe.keys()) io.observe(el);
  }

  // Die neun Situationen (11.11.): je Bereich ein Reiter mit drei Karten; jede Karte lässt sich antippen („Kenne ich“), der Stand steht
  // beim Schluss-Satz. Ohne Skript stehen alle neun untereinander. Nichts davon wird gespeichert oder gesendet.
  const wahl = document.querySelector('[data-wahl]');
  if (wahl) {
    const leiste = wahl.querySelector('[data-wahl-leiste]');
    const reiter = [...wahl.querySelectorAll('[role="tab"]')];
    const felder = [...wahl.querySelectorAll('[data-wahl-feld]')];
    const schluss = document.querySelector('[data-wahl-schluss]');
    const stand = document.querySelector('[data-wahl-stand]');
    const zeigen = (i, fokus) => {
      reiter.forEach((r, n) => { r.setAttribute('aria-selected', String(n === i)); r.tabIndex = n === i ? 0 : -1; });
      felder.forEach((f, n) => { f.hidden = n !== i; });
      if (fokus) reiter[i].focus();
    };
    reiter.forEach((r, i) => {
      r.addEventListener('click', () => zeigen(i));
      r.addEventListener('keydown', (ev) => {
        const ziel = { ArrowRight: (i + 1) % reiter.length, ArrowLeft: (i - 1 + reiter.length) % reiter.length, Home: 0, End: reiter.length - 1 }[ev.key];
        if (ziel === undefined) return;
        ev.preventDefault();
        zeigen(ziel, true);
      });
    });
    felder.forEach((f, i) => { f.setAttribute('role', 'tabpanel'); f.setAttribute('aria-labelledby', reiter[i].id); });
    const knoepfe = [];
    const zaehlen = () => {
      const an = knoepfe.filter((k) => k.getAttribute('aria-pressed') === 'true');
      felder.forEach((f, i) => { const n = an.filter((k) => f.contains(k)).length; const marke = reiter[i].querySelector('.wahl-marke'); if (marke) marke.textContent = n ? String(n) : ''; });
      if (stand) { stand.hidden = !an.length; stand.textContent = an.length ? `${an.length} von ${knoepfe.length} markiert` : ''; }
      if (schluss) schluss.classList.toggle('trifft', an.length >= 2);
    };
    for (const li of wahl.querySelectorAll('.momente li')) {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'moment';
      k.setAttribute('aria-pressed', 'false');
      while (li.firstChild) k.appendChild(li.firstChild);
      const fuss = document.createElement('span');
      fuss.className = 'moment-fuss';
      const kugel = document.createElement('span');
      kugel.className = 'moment-kugel';
      kugel.setAttribute('aria-hidden', 'true');
      fuss.append(kugel, 'Kenne ich');
      k.appendChild(fuss);
      k.addEventListener('click', () => { k.setAttribute('aria-pressed', String(k.getAttribute('aria-pressed') !== 'true')); zaehlen(); });
      li.appendChild(k);
      knoepfe.push(k);
    }
    if (leiste) leiste.hidden = false;
    wahl.classList.add('an');
    zeigen(0);
  }

})();
