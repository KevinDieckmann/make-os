// ─── MAKE OS Homepage — Bewegung mit Maß (27.09.) ───────────────────────────
// Alles hier ist Zierde über einer Seite, die ohne JS vollständig lesbar ist.
// prefers-reduced-motion schaltet Zähler, Ring und Reveals auf „sofort da“.
(() => {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Reveal beim Scrollen
  const reveal = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('da'); reveal.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: .12 });
  $$('[data-reveal]').forEach(el => reveal.observe(el));

  // Zähler
  const zaehle = (el, ziel, ms = 1400) => {
    if (ruhig) { el.textContent = String(ziel); return; }
    const t0 = performance.now();
    const tick = t => { const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3); el.textContent = String(Math.round(ziel * e)); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  const zaehler = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { zaehle(e.target, Number(e.target.dataset.count)); zaehler.unobserve(e.target); } }), { threshold: .4 });
  $$('[data-count]').forEach(el => zaehler.observe(el));

  // Score-Ring: Modus Privat/Business
  const bogen = $('#ring-bogen'), zahl = $('#ring-zahl'), label = $('#ring-label'), hinweis = $('#ring-hinweis');
  const UMFANG = 527.8;
  const MODI = {
    privat: { wert: 78, label: 'SOLIDE', farbe: '#58D9CD', hinweis: 'Größter Hebel: Schlaf vor Mitternacht', namen: ['Gesundheit', 'Beziehung', 'Finanzen', 'Fokus & Zeit'] },
    business: { wert: 64, label: 'IM AUFBAU', farbe: '#FF9F43', hinweis: 'Größter Hebel: 2 Follow-ups überfällig', namen: ['Financial Health', 'Management DNA', 'Markttraktion', 'Fokus & Zeit'] },
  };
  const werte = { business: [69, 58, 61, 61] };
  const setzeModus = (m) => {
    const d = MODI[m];
    $$('.schalter button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modus === m)));
    if (bogen) { bogen.style.stroke = d.farbe; bogen.style.strokeDashoffset = String(UMFANG * (1 - d.wert / 100)); }
    if (label) label.textContent = d.label;
    if (hinweis) hinweis.textContent = d.hinweis;
    if (zahl) zaehle(zahl, d.wert, 1200);
    $$('.saeule').forEach((s, i) => {
      const i_ = s.querySelector('i'); const b = s.querySelector('b'); const span = s.querySelector('span');
      const v = m === 'privat' ? Number(i_.dataset.privat) : werte.business[i];
      span.textContent = d.namen[i]; i_.style.width = `${v}%`; b.textContent = String(v);
    });
  };
  $$('.schalter button').forEach(b => b.addEventListener('click', () => setzeModus(b.dataset.modus)));
  const ringKarte = $('.ring-karte');
  if (ringKarte) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { setzeModus('privat'); io.disconnect(); } }, { threshold: .3 }); io.observe(ringKarte); }

  // Spotlight folgt der Maus im Hero
  const hero = $('#hero'), spot = $('.spot');
  if (hero && spot && !ruhig && matchMedia('(pointer:fine)').matches) {
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); spot.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`); spot.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`); });
  }

  // Sticky-Story: welcher Schritt ist in der Mitte?
  const schritte = $$('.story-schritt'), bilder = $$('.story-bild > div');
  if (schritte.length) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const n = e.target.dataset.schritt; schritte.forEach(s => s.classList.toggle('aktiv', s === e.target)); bilder.forEach(b => b.classList.toggle('aktiv', b.dataset.bild === n)); }), { rootMargin: '-45% 0px -45% 0px' });
    schritte.forEach(s => io.observe(s));
    schritte[0].classList.add('aktiv');
  }

  // Jarvis-Chat erscheint Zug um Zug
  const chat = $('#chat');
  if (chat) {
    const blasen = $$('.blase', chat);
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; blasen.forEach((b, i) => setTimeout(() => b.classList.add('da'), ruhig ? 0 : 350 + i * 650)); io.disconnect(); }, { threshold: .35 });
    io.observe(chat);
  }

  // Bereiche als Reiter
  $$('.tabs [role=tab]').forEach(t => t.addEventListener('click', () => {
    $$('.tabs [role=tab]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    $$('.bereich').forEach(p => p.classList.toggle('aktiv', p.dataset.panel === t.dataset.tab));
  }));

  // Sanftes Kippen der Produktkarten
  if (!ruhig && matchMedia('(pointer:fine)').matches) {
    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(1100px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-2px)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    // Magnetische Knöpfe
    $$('.magnet').forEach(k => {
      k.addEventListener('pointermove', e => { const r = k.getBoundingClientRect(); const x = (e.clientX - r.left - r.width / 2) * .18; const y = (e.clientY - r.top - r.height / 2) * .28; k.style.transform = `translate(${x}px, ${y}px)`; });
      k.addEventListener('pointerleave', () => { k.style.transform = ''; });
    });
  }

  // MALIN + KEVIN → MAKE
  const name = $('#name');
  if (name) {
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return; io.disconnect();
      const malin = $$('[data-wer=malin] .b', name), kevin = $$('[data-wer=kevin] .b', name);
      const schritt = (fn, ms) => setTimeout(fn, ruhig ? 0 : ms);
      schritt(() => { malin.slice(0, 2).forEach(b => b.classList.add('hell')); kevin.slice(0, 2).forEach(b => b.classList.add('hell')); }, 500);
      schritt(() => { malin.slice(2).forEach(b => b.classList.add('weg')); kevin.slice(2).forEach(b => b.classList.add('weg')); }, 1300);
      schritt(() => name.classList.add('fertig'), 2000);
    }, { threshold: .5 });
    io.observe(name);
  }

  // Vorher/Nachher-Regler (ARIA-Slider) — mit kurzer Intro-Bewegung
  const griff = $('.regler-griff'), nachher = $('.regler-buehne .nachher'), linie = $('.regler-linie');
  if (griff && nachher && linie) {
    const setze = v => { nachher.style.clipPath = `inset(0 0 0 ${v}%)`; linie.style.left = `${v}%`; griff.setAttribute('aria-valuetext', `${v} Prozent`); };
    griff.addEventListener('input', () => setze(Number(griff.value)));
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect(); if (ruhig) return; let v = 50, ziel = 72, dir = 1; const t0 = performance.now(); const tick = t => { const p = Math.min(1, (t - t0) / 1400); v = 50 + Math.sin(p * Math.PI) * 22 * dir; setze(Math.round(v)); griff.value = String(Math.round(v)); if (p < 1) requestAnimationFrame(tick); else { setze(50); griff.value = '50'; } }; void ziel; requestAnimationFrame(tick); }, { threshold: .5 });
    io.observe(griff);
  }

  // Cursor-Licht auf Karten
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.raum,.schirm,.garantie,.schritt').forEach(k => k.addEventListener('pointermove', e => { const r = k.getBoundingClientRect(); k.style.setProperty('--x', `${e.clientX - r.left}px`); k.style.setProperty('--y', `${e.clientY - r.top}px`); }));
  }

  // Anfrage: öffnet eine Mail — nichts wird gespeichert, bevor der Mensch sendet.
  const form = $('#anfrage');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    const name_ = String(f.get('name') || '').trim(), mail = String(f.get('mail') || '').trim(), warum = String(f.get('warum') || '').trim();
    if (!name_ || !/.+@.+\..+/.test(mail)) { form.querySelector('.fuss').textContent = 'Bitte Name und eine gültige E-Mail eintragen.'; return; }
    const body = `Hallo Malin, hallo Kevin,%0D%0A%0D%0Aich möchte MAKE OS einmal testen.%0D%0A%0D%0AName: ${encodeURIComponent(name_)}%0D%0AE-Mail: ${encodeURIComponent(mail)}%0D%0A%0D%0A${encodeURIComponent(warum)}`;
    // EMPFÄNGER: Platzhalter — Kevin trägt die echte Adresse ein (Domain ist noch nicht entschieden, siehe PLAN.md).
    const EMPFAENGER = 'hallo@make-os.example';
    window.location.href = `mailto:${EMPFAENGER}?subject=${encodeURIComponent('MAKE OS einmal testen')}&body=${body}`;
    const ok = document.createElement('div'); ok.className = 'fertig'; ok.textContent = 'Deine E-Mail ist vorbereitet — abschicken, dann melden wir uns persönlich.';
    form.replaceWith(ok);
  });
})();
