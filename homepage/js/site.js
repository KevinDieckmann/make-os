// ─── MAKE OS Homepage — Bewegung mit Maß, v3 (27.09.) ───────────────────────
// Zierde über einer Seite, die ohne JS vollständig lesbar ist. reduced-motion
// schaltet Zähler, Ring und Reveals auf „sofort da“. Das Brain lebt in brain.js.
(() => {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const maus = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // Fortschritt, Nach-oben, Kapitel-Anzeige (Rail rechts, Label im Handy-Kopf, Nav-Links)
  const fortschritt = $('.fortschritt'), nachoben = $('.nachoben'), links = $$('.nav nav a[href^="#"]'), railLinks = $$('.rail a'), kapLabel = $('.kap-label');
  const kapitelEls = $$('[data-kapitel]');
  const kapitelName = Object.fromEntries(railLinks.map(a => [a.dataset.nr, a.querySelector('span')?.textContent || '']));
  let letzteNr = null;
  const beimScrollen = () => {
    const h = document.documentElement; const max = h.scrollHeight - h.clientHeight;
    if (fortschritt) fortschritt.style.width = `${max > 0 ? (h.scrollTop / max) * 100 : 0}%`;
    if (nachoben) nachoben.classList.toggle('da', h.scrollTop > 700);
    const grenze = innerHeight * .45; let aktiv = null;
    for (const el of kapitelEls) if (el.getBoundingClientRect().top <= grenze) aktiv = el;
    const nr = aktiv ? aktiv.dataset.kapitel : '00';
    if (nr === letzteNr) return; letzteNr = nr;
    railLinks.forEach(a => a.classList.toggle('aktiv', a.dataset.nr === nr));
    links.forEach(a => { const ziel = $(a.getAttribute('href')); a.classList.toggle('aktiv', !!ziel && (ziel.dataset.kapitel === nr || ziel.closest('[data-kapitel]')?.dataset.kapitel === nr)); });
    if (kapLabel) kapLabel.textContent = nr === '00' ? '' : `${nr} · ${kapitelName[nr] || ''}`;
  };
  addEventListener('scroll', beimScrollen, { passive: true }); beimScrollen();
  nachoben?.addEventListener('click', () => scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' }));

  // Burger
  const burger = $('.burger'), menue = $('.mobilmenue');
  if (burger && menue) {
    const setze = offen => { menue.classList.toggle('offen', offen); burger.setAttribute('aria-expanded', String(offen)); document.body.style.overflow = offen ? 'hidden' : ''; };
    burger.addEventListener('click', () => setze(!menue.classList.contains('offen')));
    $$('a', menue).forEach(a => a.addEventListener('click', () => setze(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setze(false); });
  }

  // Reveal (einmalig)
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
  const bogen = $('#ring-bogen'), zahl = $('#ring-zahl'), label = $('#ring-label'), hinweis = $('#ring-hinweis'), chip = $('#score-chip');
  const UMFANG = 2 * Math.PI * 84;
  const MODI = {
    privat: { wert: 78, label: 'SOLIDE', farbe: '#58D9CD', hinweis: 'Schlaf vor Mitternacht', namen: ['Gesundheit', 'Beziehung', 'Finanzen', 'Fokus & Zeit'], werte: [74, 82, 71, 88] },
    business: { wert: 64, label: 'IM AUFBAU', farbe: '#FF9F43', hinweis: 'Zwei Follow-ups überfällig', namen: ['Financial Health', 'Management DNA', 'Markttraktion', 'Fokus & Zeit'], werte: [69, 58, 61, 61] },
  };
  const setzeModus = m => {
    const d = MODI[m];
    $$('.schalter button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modus === m)));
    if (bogen) { bogen.style.stroke = d.farbe; bogen.style.strokeDashoffset = String(UMFANG * (1 - d.wert / 100)); }
    if (label) label.textContent = d.label; if (hinweis) hinweis.textContent = d.hinweis; if (chip) chip.textContent = String(d.wert);
    if (zahl) zaehle(zahl, d.wert, 1200);
    $$('.saeule').forEach((s, i) => { s.querySelector('span').textContent = d.namen[i]; s.querySelector('i').style.width = `${d.werte[i]}%`; s.querySelector('b').textContent = String(d.werte[i]); });
  };
  $$('.schalter button').forEach(b => b.addEventListener('click', () => setzeModus(b.dataset.modus)));
  const scoreApp = $('#score-app');
  if (scoreApp) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { setzeModus('privat'); io.disconnect(); } }, { threshold: .3 }); io.observe(scoreApp); }

  // Chat Zug um Zug, danach der Weg eines Vorschlags
  const chat = $('#chat');
  if (chat) {
    const blasen = $$('.blase', chat);
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; blasen.forEach((b, i) => setTimeout(() => b.classList.add('da'), ruhig ? 0 : 300 + i * 600)); io.disconnect(); }, { threshold: .3 });
    io.observe(chat);
  }
  const weg = $('.weg');
  if (weg) {
    const stufen = $$('.schritt-w', weg), fuellung = $('.fuellung', weg);
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect(); stufen.forEach((s, i) => setTimeout(() => { s.classList.add('an'); if (fuellung) fuellung.style.width = `${(i / (stufen.length - 1)) * 84}%`; }, ruhig ? 0 : 200 + i * 500)); }, { threshold: .5 });
    io.observe(weg);
  }

  // Bereiche als Reiter (Pfeiltasten)
  const tabs = $$('.tabs [role=tab]');
  const waehle = t => { tabs.forEach(x => { x.setAttribute('aria-selected', String(x === t)); x.tabIndex = x === t ? 0 : -1; }); $$('.bereich').forEach(p => p.classList.toggle('aktiv', p.dataset.panel === t.dataset.tab)); };
  tabs.forEach((t, i) => { t.addEventListener('click', () => waehle(t)); t.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { waehle(tabs[(i + 1) % tabs.length]); tabs[(i + 1) % tabs.length].focus(); } if (e.key === 'ArrowLeft') { waehle(tabs[(i - 1 + tabs.length) % tabs.length]); tabs[(i - 1 + tabs.length) % tabs.length].focus(); } }); });

  // Kippen (nur Hero-Fenster), Magnet (nur Hero-CTA), Cursor-Licht
  if (!ruhig && maus) {
    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(1200px) rotateX(${(-y * 2.5).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    $$('.magnet').forEach(k => {
      k.addEventListener('pointermove', e => { const r = k.getBoundingClientRect(); k.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .28}px)`; });
      k.addEventListener('pointerleave', () => { k.style.transform = ''; });
    });
    $$('.raum,.garantie,.schritt,.zahl-karte,.person,.eintrag').forEach(k => k.addEventListener('pointermove', e => { const r = k.getBoundingClientRect(); k.style.setProperty('--x', `${e.clientX - r.left}px`); k.style.setProperty('--y', `${e.clientY - r.top}px`); }));
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

  // Anfrage: öffnet eine Mail — nichts wird gespeichert, bevor der Mensch sendet.
  const form = $('#anfrage');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(form);
    const name_ = String(f.get('name') || '').trim(), mail = String(f.get('mail') || '').trim(), warum = String(f.get('warum') || '').trim();
    if (!name_ || !/.+@.+\..+/.test(mail)) { form.querySelector('.fuss').textContent = 'Bitte Name und eine gültige E-Mail eintragen.'; return; }
    // EMPFÄNGER: Platzhalter — Kevin trägt die echte Adresse ein (Domain ist noch nicht entschieden, siehe PLAN.md).
    const EMPFAENGER = 'hallo@make-os.example';
    const body = `Hallo Malin, hallo Kevin,%0D%0A%0D%0Aich möchte MAKE OS einmal testen.%0D%0A%0D%0AName: ${encodeURIComponent(name_)}%0D%0AE-Mail: ${encodeURIComponent(mail)}%0D%0A%0D%0A${encodeURIComponent(warum)}`;
    window.location.href = `mailto:${EMPFAENGER}?subject=${encodeURIComponent('MAKE OS einmal testen')}&body=${body}`;
    const ok = document.createElement('div'); ok.className = 'fertig'; ok.textContent = 'Deine E-Mail ist vorbereitet — abschicken, dann melden wir uns persönlich.';
    form.replaceWith(ok);
  });
})();
