/* ─── MAKE Studios · Seite unter dem Film ─────────────────────────────────────────────────────────────
   Unabhängig vom Film (studio.js): läuft auch mit „Bewegung reduzieren“ und wenn der Film ausfällt.
   Wird VOR studio.js geladen und stellt ihm zwei Dinge bereit (window.MAKE):
   · MAKE.halt       ein Zustand „angehalten“ für Film und Aufnahmen (beide Halteknöpfe tun dasselbe)
   · MAKE.aufnahmen  Regie für die stummen Bildschirmaufnahmen der Beispielseiten (referenzen/<name>.mp4)
   Ohne JavaScript bleibt der Filter verborgen, alle Entwürfe stehen untereinander, überall steht das Poster. */
(() => {
  'use strict';
  const D = document, H = D.documentElement, W = window;
  const M = W.MAKE = W.MAKE || {};
  const mq = (q) => (W.matchMedia ? W.matchMedia(q) : { matches: false });
  const ruhig = mq('(prefers-reduced-motion: reduce)');
  const fein = mq('(hover: hover) and (pointer: fine)').matches;

  // ═══ Anhalten: ein Zustand für alles, was sich von selbst bewegt ═══
  M.halt = (() => {
    let an = false;
    const hoerer = [];
    return {
      ist: () => an,
      setze(wert) { wert = !!wert; if (wert === an) return; an = wert; hoerer.forEach((f) => f(an)); },
      hoeren(f) { hoerer.push(f); },
    };
  })();

  // ═══ Aufnahmen ═══
  // Jede Fläche [data-aufnahme="name"] trägt ein Poster (<img>). Das <video> entsteht erst, wenn die Aufnahme wirklich
  // laufen soll (und der Wunsch einen Moment steht): stumm, ohne Bedienelemente, preload="none". Regeln: nie mehr als
  // zwei gleichzeitig, außerhalb des Bilds Pause, bei „Bewegung reduzieren“ oder Datensparmodus bleibt es beim Poster,
  // bei einem Ladefehler ebenso. Hinweis für später: Eine Content-Security-Policy braucht dafür „media-src 'self' blob:“.
  // data-regie="film"    studio.js sagt an (spiele)
  // data-regie="zeiger"  am Rechner beim Überfahren oder Fokus der Karte, ohne Maus sobald die Karte im Bild ist
  // data-folge="a,b,c"   mehrere Aufnahmen nacheinander auf derselben Fläche (der Bildschirm im Einstieg)
  M.aufnahmen = (() => {
    const HOECHSTENS = 2;
    const pfad = (name) => 'referenzen/' + name + '.mp4';
    const posterPfad = (name) => 'referenzen/' + name + '-poster.webp';
    const netz = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const sparen = () => !!(netz && (netz.saveData || /(^|-)2g$/.test(netz.effectiveType || ''))) || mq('(prefers-reduced-data: reduce)').matches;
    const erlaubt = () => !ruhig.matches && !sparen() && !M.halt.ist() && !D.hidden;
    const flaechen = new Map();
    let rang = 0;

    // Namen der Beispielseiten für die Beschriftung des Bildschirms: aus den Karten gelesen, nicht doppelt gepflegt
    const namen = {};
    D.querySelectorAll('.referenz-link').forEach((a) => {
      const m = /beispiele\/([a-z0-9-]+)\//.exec(a.getAttribute('href') || '');
      if (m) namen[m[1]] = a.textContent.trim();
    });

    D.querySelectorAll('[data-aufnahme]').forEach((el) => {
      const folge = (el.getAttribute('data-folge') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const z = { el, name: el.getAttribute('data-aufnahme'), poster: el.querySelector('.aufnahme-poster'), video: null, will: false, rang: 0,
        kaputt: false, gesperrt: false, folge: folge.length > 1 ? folge : null, index: 0, fehler: 0, wechselt: false,
        rahmen: el.closest('[data-folge-rahmen]'), lauf: el.querySelector('.referenz-lauf'), strich: null };
      flaechen.set(el, z);
      // Poster fehlt: der alte Seitenstreifen springt ein (dann ohne Aufnahme)
      const rueckfall = el.getAttribute('data-rueckfall');
      if (z.poster) {
        // ohne Streifen (neue Beispielseiten, deren Dateien noch fehlen): ruhige Fläche, keine Aufnahme
        const tauschen = () => { if (z.kaputt) return; z.kaputt = true; if (rueckfall) { el.classList.add('streifen-rueckfall'); z.poster.src = rueckfall; } else el.classList.add('ohne-poster'); };
        if (z.poster.complete && z.poster.naturalWidth === 0 && z.poster.currentSrc) tauschen();
        else z.poster.addEventListener('error', tauschen, { once: true });
      }
      if (z.folge) beschriften(z);
    });

    function beschriften(z) {
      if (!z.rahmen) return;
      const name = z.rahmen.querySelector('[data-folge-name]');
      if (name && namen[z.name]) name.textContent = namen[z.name];
      const striche = z.rahmen.querySelectorAll('[data-folge-striche] i');
      striche.forEach((s, i) => { s.classList.toggle('durch', i < z.index); s.style.removeProperty('--f'); });
      z.strich = striche[z.index] || null;
    }

    // Dateien: jede Aufnahme wird höchstens einmal geholt, ganz und am Stück (fetch → Blob). So bleibt keine halbe
    // Medienanfrage offen, wenn ein Video pausiert, und zwei Flächen mit derselben Aufnahme teilen sich die Datei.
    const dateien = new Map();
    function holen(name) {
      let d = dateien.get(name);
      if (!d) {
        d = W.fetch(pfad(name)).then((r) => { if (!r.ok) throw new Error('Aufnahme fehlt: ' + name); return r.blob(); }).then((b) => URL.createObjectURL(b));
        d.catch(() => { /* wird je Fläche behandelt */ });
        dateien.set(name, d);
      }
      return d;
    }

    function videoAnlegen(z) {
      const v = D.createElement('video');
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = !z.folge; v.preload = 'none';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.setAttribute('disablepictureinpicture', ''); v.setAttribute('disableremoteplayback', '');
      v.tabIndex = -1;
      v.addEventListener('playing', () => { if (z.will && !z.wechselt && z.video === v && !v.paused) z.el.classList.add('laeuft'); });
      v.addEventListener('error', () => { if (z.video === v && v.getAttribute('src')) fehler(z); });
      v.addEventListener('timeupdate', () => {
        const ziel = z.strich || z.lauf;
        if (ziel && v.duration > 0) ziel.style.setProperty('--f', (v.currentTime / v.duration).toFixed(3));
        if (z.folge && !z.vorgeladen && v.duration > 0 && v.currentTime / v.duration > .5) vorholen(z);
      });
      if (z.folge) v.addEventListener('ended', () => weiter(z));
      z.el.appendChild(v);
      z.video = v; z.geladen = null;
      quelle(z);
    }
    function quelle(z) {
      const v = z.video, name = z.name;
      holen(name).then((adresse) => {
        if (z.video !== v || z.name !== name) return;
        v.preload = 'auto';                                   // die Datei liegt schon im Speicher: ganz lesen, dann reißt beim Pausieren nichts ab
        v.src = adresse; z.geladen = name;
        ordnen();
      }, () => { if (z.video === v && z.name === name) fehler(z); });
    }
    // Datei fehlt oder ist nicht abspielbar: Video weg, Poster bleibt. In einer Folge geht es mit der nächsten weiter.
    function fehler(z) {
      z.el.classList.remove('laeuft');
      if (z.folge && ++z.fehler < z.folge.length) { z.wechselt = false; weiter(z); return; }
      z.kaputt = true;
      if (z.video) { const v = z.video; z.video = null; v.removeAttribute('src'); v.remove(); }
      ordnen();
    }
    // Folge: Poster und Datei der nächsten Aufnahme schon holen, während die laufende zu Ende geht.
    function vorholen(z) {
      z.vorgeladen = true;
      const naechste = z.folge[(z.index + 1) % z.folge.length];
      new Image().src = posterPfad(naechste);
      if (erlaubt()) holen(naechste);
    }
    // Wechsel: nächstes Poster unterlegen, Video ausblenden, Quelle tauschen, weiter.
    function weiter(z) {
      if (z.wechselt || !z.folge) return;
      z.wechselt = true; z.vorgeladen = false;
      z.index = (z.index + 1) % z.folge.length;
      z.name = z.folge[z.index];
      const bild = new Image();
      const los = () => {
        if (z.poster) z.poster.src = posterPfad(z.name);
        z.el.classList.remove('laeuft');
        beschriften(z);
        W.setTimeout(() => {
          z.wechselt = false;
          if (z.video) { z.geladen = null; quelle(z); }
        }, 520);
      };
      bild.onload = bild.onerror = los;
      bild.src = posterPfad(z.name);
    }

    function abspielen(z) {
      if (z.ruhe) { W.clearTimeout(z.ruhe); z.ruhe = 0; }
      if (z.kaputt || z.gesperrt || z.wechselt) return;
      if (!z.video) { videoAnlegen(z); return; }            // spielt los, sobald die Datei da ist (quelle → ordnen)
      const v = z.video;
      if (z.geladen !== z.name) return;
      if (!v.paused && !v.ended) { if (v.readyState > 2) z.el.classList.add('laeuft'); return; }
      const versuch = v.play();
      if (versuch && versuch.catch) versuch.catch((e) => { if (e && e.name === 'NotAllowedError') { z.gesperrt = true; z.el.classList.remove('laeuft'); } });
    }
    // Lange nicht gebraucht: Video wieder abbauen (gibt den Decoder frei), das Poster bleibt. Die Datei bleibt im Speicher.
    function abbauen(z) {
      if (!z.video || z.will) return;
      z.el.classList.remove('laeuft');
      const v = z.video; z.video = null; z.geladen = null;
      v.removeAttribute('src'); v.load(); v.remove();
    }
    function anhalten(z, zumPoster) {
      if (z.video && !z.will && !z.ruhe) z.ruhe = W.setTimeout(() => { z.ruhe = 0; abbauen(z); }, 25000);
      if (z.video && !z.video.paused) z.video.pause();
      if (zumPoster) z.el.classList.remove('laeuft');       // zurück zum Poster; beim nächsten Mal geht es an derselben Stelle weiter
    }
    // Wer spielt? Die zuletzt gewünschten zuerst, höchstens zwei.
    function ordnen() {
      const frei = erlaubt();
      const wunsch = [];
      flaechen.forEach((z) => { if (z.will && z.bereit && !z.kaputt && !z.gesperrt) wunsch.push(z); });
      wunsch.sort((a, b) => b.rang - a.rang);
      flaechen.forEach((z) => {
        const dran = frei && wunsch.indexOf(z) > -1 && wunsch.indexOf(z) < HOECHSTENS;
        if (dran) abspielen(z); else anhalten(z, false);
      });
    }

    function spiele(el, an, zumPoster) {
      const z = flaechen.get(el);
      if (!z || z.will === !!an) return;
      z.will = !!an;
      W.clearTimeout(z.warten);
      if (!an) { z.bereit = false; anhalten(z, !!zumPoster); ordnen(); return; }
      // Erst laden, wenn der Wunsch einen Moment steht: wer schnell durchscrollt oder die Karte nur streift, lädt nichts.
      z.rang = ++rang;
      z.warten = W.setTimeout(() => { z.bereit = true; ordnen(); }, z.video ? 0 : 260);
    }

    // Karten der Beispielseiten
    const zeiger = Array.from(flaechen.values()).filter((z) => z.el.getAttribute('data-regie') === 'zeiger');
    if (zeiger.length && 'IntersectionObserver' in W) {
      const sicht = new IntersectionObserver((liste) => {
        liste.forEach((e) => {
          const z = flaechen.get(e.target);
          if (!z) return;
          z.imBild = e.isIntersecting && e.intersectionRatio >= .6;
          if (!fein) spiele(z.el, z.imBild, true);          // ohne Maus: läuft, solange die Karte im Bild ist
          else if (!e.isIntersecting) spiele(z.el, false, true);
        });
      }, { threshold: [0, .6] });
      zeiger.forEach((z) => {
        sicht.observe(z.el);
        if (!fein) return;
        const karte = z.el.closest('.referenz') || z.el;
        const an = () => spiele(z.el, true);
        const aus = () => { if (!karte.matches(':hover') && !karte.contains(D.activeElement)) spiele(z.el, false, true); };
        karte.addEventListener('pointerenter', an);
        karte.addEventListener('pointerleave', aus);
        karte.addEventListener('focusin', an);
        karte.addEventListener('focusout', () => W.setTimeout(aus, 0));
      });
    }

    // Halteknopf im Abschnitt: nur dort, wo Aufnahmen von selbst laufen (ohne Maus)
    const knopf = D.querySelector('.aufnahmen-halt');
    if (knopf && zeiger.length && !fein) {
      const zeigen = () => { knopf.hidden = ruhig.matches || sparen(); };
      zeigen();
      if (ruhig.addEventListener) ruhig.addEventListener('change', zeigen);
      knopf.addEventListener('click', () => M.halt.setze(!M.halt.ist()));
      M.halt.hoeren((an) => { knopf.setAttribute('aria-pressed', String(an)); knopf.textContent = an ? 'Aufnahmen abspielen' : 'Aufnahmen anhalten'; });
    }

    M.halt.hoeren(ordnen);
    D.addEventListener('visibilitychange', ordnen);
    if (ruhig.addEventListener) ruhig.addEventListener('change', () => { if (ruhig.matches) flaechen.forEach((z) => anhalten(z, true)); ordnen(); });

    return { spiele };
  })();

  // ═══ Menü für schmale Fenster ═══
  // <dialog> mit showModal(): Fokusfalle und Escape bringt der Browser mit, der Rest der Seite ist währenddessen stumm.
  const menue = D.getElementById('menue');
  const menueKnopf = D.querySelector('.menue-knopf');
  if (menue && menueKnopf && typeof menue.showModal === 'function') {
    menueKnopf.hidden = false;
    const zu = () => { if (menue.open) menue.close(); };
    menueKnopf.addEventListener('click', () => {
      if (menue.open) { zu(); return; }
      H.classList.add('menue-offen');
      menueKnopf.setAttribute('aria-expanded', 'true');
      menue.showModal();
    });
    menue.addEventListener('close', () => {
      H.classList.remove('menue-offen');
      menueKnopf.setAttribute('aria-expanded', 'false');
    });
    // Ein Ziel gewählt (Sprungmarke, Buchen, E-Mail) oder „Schließen“: erst zu, dann läuft der Klick normal weiter.
    menue.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('a, .menue-zu');
      if (t) zu();
    }, true);
    // Wird das Fenster breit genug für die Leiste, braucht es das Menü nicht mehr.
    const breit = mq('(min-width: 1000px)');
    if (breit.addEventListener) breit.addEventListener('change', () => { if (breit.matches) zu(); });
  }

  // ═══ Leiste im Kopf: zeigt, in welchem Abschnitt man gerade liest ═══
  const leiste = Array.from(D.querySelectorAll('.kopf-nav a[href^="#"]'));
  if (leiste.length && 'IntersectionObserver' in W) {
    const ziele = new Map();
    leiste.forEach((a) => { const z = D.getElementById(a.getAttribute('href').slice(1)); if (z && !z.closest('.film')) ziele.set(z, a); });
    const wach = new Set();
    const spaeher = new IntersectionObserver((liste) => {
      liste.forEach((e) => { if (e.isIntersecting) wach.add(e.target); else wach.delete(e.target); });
      let aktuell = null;
      ziele.forEach((a, z) => { if (wach.has(z)) aktuell = a; });
      leiste.forEach((a) => { if (a === aktuell) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }, { rootMargin: '-45% 0px -54% 0px' });
    ziele.forEach((a, z) => spaeher.observe(z));
  }

  // ═══ Filter: Entwürfe nach Branche, Beispielseiten nach Art ═══
  // Ohne JavaScript bleiben die Filter verborgen und alles steht untereinander.
  D.querySelectorAll('.filter').forEach((filter) => {
    const galerie = filter.getAttribute('data-filter-fuer') === 'referenzen';
    const teile = Array.from(D.querySelectorAll(galerie ? '.referenz[data-art]' : '.entwurf[data-branche]'));
    if (!teile.length) return;
    const knoepfe = Array.from(filter.querySelectorAll('.filter-knopf'));
    filter.hidden = false;
    filter.addEventListener('click', (e) => {
      const knopf = e.target.closest && e.target.closest('.filter-knopf');
      if (!knopf) return;
      const wahl = knopf.dataset.filter;
      knoepfe.forEach((k) => k.setAttribute('aria-pressed', String(k === knopf)));
      teile.forEach((el) => { el.hidden = wahl !== 'alle' && (galerie ? el.dataset.art : el.dataset.branche) !== wahl; });
    });
  });

  if (fein) {
    // Licht folgt der Maus über den Analyse-Karten
    D.querySelectorAll('.analyse').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
        el.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
      }, { passive: true });
    });
    // Die großen Knöpfe ziehen den Zeiger leicht an (nur mit Maus, nicht bei „Bewegung reduzieren“)
    D.querySelectorAll('.knopf-gross, .held-aktionen .knopf, .aufruf .knopf').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        if (ruhig.matches) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--zx', ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px');
        el.style.setProperty('--zy', ((e.clientY - r.top - r.height / 2) * .34).toFixed(1) + 'px');
      }, { passive: true });
      el.addEventListener('pointerleave', () => { el.style.removeProperty('--zx'); el.style.removeProperty('--zy'); });
    });
  }
})();
