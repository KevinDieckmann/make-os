// MAKE Innovation · Szene v5 — Motor (04.10.2026, Standard 04.10.: Einstieg, Aurora, Feder, Text-Bühne)
// Eine durchgehende WebGL-Szene hinter dem Text: Scrollen = Kamerafahrt entlang des Lichtpfads durch ein Neuronennetz;
// je Kapitel formen dieselben Teilchen ein Bild (js/szene/formationen.js nach dem Drehbuch js/drehbuch.js).
// Eigenes schlankes WebGL 1 statt einer Bibliothek: Punkte und feine Linien sind alles, was die Szene braucht — so bleibt
// sie klein (keine fremde Datei, kein Nachladen) und läuft unter der strengen CSP (script-src 'self', kein eval).
//
// Ablauf: Der Text steht als HTML. Erst nach dem ersten Bild baut dieses Skript die Szene; gelingt das, bekommt
// <html> die Klasse „mit-szene“ (CSS blendet dann die Standbilder aus). Ohne WebGL, ohne Skript oder bei
// „Bewegung reduzieren“ bleiben die gestalteten Standbilder je Kapitel stehen (assets/szene/*.svg).
// Optional über das Drehbuch (kern.optionen, jedes abschaltbar):
//   einstieg  die Lichtwolke blüht beim Laden auf, die Kamera fährt leicht zurück (Wanduhr, easeOutCubic)
//   aurora    ruhiger Schleier aus Rauschen (fBm) in den Farben der Synapse, nur an den Bildrändern, in reduzierter Auflösung
//   text      Text-Bühne: Überschriften mit data-kaskade kommen Buchstabe für Buchstabe (für Vorleser ein Satz),
//             Bausteine mit data-auftritt blenden je Kapitel ein und aus (vorher · jetzt · nach) — am selben Fortschritt wie die Szene,
//             Zahlen in .trommel .wert zählen beim Aktivwerden hoch (Trommel), der Fuß hinter .aufdecken wird beim Scrollen aufgedeckt
// Das native Scrollen bleibt unberührt; die Szene folgt ihm über eine gedämpfte Feder (kern.feder).
// Fortschritt von außen (Drehbuch `fortschritt: 'extern'`, z. B. eine Showreel-Spur — js/szene/spur.js): dann misst der Motor keine
// Abschnitte, sondern folgt MakeSzene.fortschritt (0 … n−1), den die Seite in jedem Bild setzt.
// Ruhig stellen (Drehbuch): `netz: false` (kein Neuronennetz), `pfad: false` (keine Lichtfäden und kein Staub am Pfad), `teilchen`
// { rechner, handy } (Zahl der Teilchen), je Zustand `hell` (Helligkeit der Formation). Bleiben zwei Zustände in derselben Formation,
// gleiten die Teilchen nicht (nur die Kamera fährt).
// Pausiert im verborgenen Tab, senkt bei Bedarf die Auflösung. Trägt .szene das Attribut data-ruht (setzt eine Seite, solange
// sie die Szene verdeckt), rechnet der Motor den Fortschritt weiter, zeichnet aber nicht. Liest, speichert und sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};

  // ── Text-Bühne: reine Teile (ohne Seite testbar, tests/website-landingpage.test.ts) ──
  /** Zerlegt eine Überschrift in Wörter und Buchstaben (span.k-wort > span.k-b, Index in --i). Für Vorleser bleibt sie EIN
   *  Satz: vorn eine unsichtbare Kopie des Texts (Klasse `unsichtbar`), alle Wörter aria-hidden. Kindelemente (z. B. die
   *  ruhige zweite Zeile) bleiben erhalten. Gibt { buchstaben, zurueck } zurück — zurueck() stellt das Original wieder her. */
  function zerlegen(el, dok, unsichtbar) {
    const original = Array.from(el.childNodes), buchstaben = [];
    function teile(quelle, ziel) {
      for (const k of Array.from(quelle.childNodes)) {
        if (k.nodeType === 3) {
          for (const stueck of k.nodeValue.split(/(\s+)/)) {
            if (!stueck) continue;
            if (!stueck.trim()) { ziel.appendChild(dok.createTextNode(' ')); continue; }
            const wort = dok.createElement('span');
            wort.className = 'k-wort'; wort.setAttribute('aria-hidden', 'true');
            for (const z of Array.from(stueck)) {
              const b = dok.createElement('span');
              b.className = 'k-b'; b.textContent = z; b.style.setProperty('--i', String(buchstaben.length));
              buchstaben.push(b); wort.appendChild(b);
            }
            ziel.appendChild(wort);
          }
        } else if (k.nodeType === 1) { const kopie = k.cloneNode(false); teile(k, kopie); ziel.appendChild(kopie); }
      }
    }
    const lesen = dok.createElement('span');
    lesen.className = unsichtbar || 'unsichtbar'; lesen.textContent = el.textContent.replace(/\s+/g, ' ').trim();
    const neu = [lesen];
    const sammel = { appendChild: k => { neu.push(k); return k; }, childNodes: [] };
    teile(el, sammel);
    el.replaceChildren(...neu);
    return { buchstaben, zurueck: () => el.replaceChildren(...original) };
  }
  /** Zustand eines Text-Bausteins aus dem Fortschritt der Szene: 'vorher' (unten, unsichtbar) · 'jetzt' · 'nach' (oben,
   *  unsichtbar). i = Kapitel, T = Fortschritt (0 … n−1). Fließt der Baustein mit der Seite, zählt zusätzlich seine Lage
   *  (oben/unten im Dokument, y = Scroll, vh = Fensterhöhe): er erscheint erst im Bild und geht erst, wenn er oben hinausläuft —
   *  so verschwindet nie etwas, das noch mitten im Bild steht. Steht er (sticky), zählt nur T. Mit Hysterese gegen Flackern. */
  function auftritt(alt, T, i, lage, y, vh) {
    const h = alt === 'jetzt' ? 1 : 0, fliesst = !!lage;
    if (T < i - (fliesst ? .7 : .45) - .08 * h || (fliesst && lage.oben > y + vh * (.92 + .05 * h))) return 'vorher';
    if (T > i + (fliesst ? .6 : .55) + .08 * h && (!fliesst || lage.unten < y + vh * (.18 - .06 * h))) return 'nach';
    return 'jetzt';
  }
  /** Zahlen-Trommel: Stand nach ms Laufzeit (2,2 s, easeOutQuint) — Zahl und wie weit sie noch unscharf/abgesenkt ist (rest). */
  function trommel(wert, ms) {
    const e = Math.min(1, Math.max(0, ms / 2200)), q = 1 - Math.pow(1 - e, 5), zahl = Math.round(wert * q);
    return { zahl, rest: wert ? 1 - zahl / wert : 0, fertig: e >= 1 };
  }
  S.buehne = { zerlegen, auftritt, trommel };

  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const html = document.documentElement;
  const huelle = document.querySelector('.szene');
  const leinwand = huelle && huelle.querySelector('canvas');
  if (!S.kern || !S.formationen || !S.drehbuch || !leinwand) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const K = S.kern, FM = S.formationen;
  // Hochkant (Szene oben, Text darunter): die Seite darf das selbst entscheiden (Drehbuch `handy: () => …`, gleiche Stufe wie ihr CSS).
  const handy = typeof S.drehbuch.handy === 'function' ? !!S.drehbuch.handy() : window.innerWidth < 760 || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100);
  const OPT = K.optionen(S.drehbuch, handy);
  // Mit Skript blendet das CSS die Standbilder aus (@media (scripting: enabled)), solange die Szene kommt — scheitert
  // sie, holt „ohne-szene“ sie zurück. Die Text-Bühne läuft auch ohne Szene weiter.
  const aus = () => { html.classList.remove('mit-szene'); html.classList.add('ohne-szene'); szeneKommt = false; };

  // ── Scroll → Fortschritt (eine Quelle für Szene und Text) ──
  const Z = K.zustaende(S.drehbuch.zustaende), n = Z.length;
  const EXTERN = S.drehbuch.fortschritt === 'extern';
  const abschnitte = EXTERN ? [] : Z.map(z => document.querySelector(`main [data-zustand="${z.name}"]`));
  if (abschnitte.some(a => !a) || n < 2) { html.classList.add('ohne-szene'); return; } // Drehbuch und Seite passen nicht zusammen
  let lagen = [], vh = window.innerHeight, kante = 0;
  const spalte = document.querySelector('main .station .inhalt');
  function messen() {
    const y = window.scrollY; vh = window.innerHeight;
    kante = spalte ? spalte.getBoundingClientRect().right / Math.max(1, window.innerWidth) * 2 - 1 : 0;
    lagen = abschnitte.map(el => { const r = el.getBoundingClientRect(); return { top: r.top + y, hoehe: Math.max(1, r.height) }; });
    buehne.messen(y);
  }
  const zielT = y => { if (EXTERN) return K.clamp(+S.fortschritt || 0, 0, n - 1); let T = 0; for (let j = 1; j < n; j++) T += K.clamp((y + vh * .8 - lagen[j].top) / (vh * .6), 0, 1); return T; };
  const lesen = (j, y) => EXTERN ? 0 : K.clamp((y + vh * .5 - lagen[j].top) / lagen[j].hoehe, 0, 1) - .5;

  // ── Text-Bühne (Seite) ──
  const buehne = (function () {
    const leer = { messen() {}, setze() { return false; } };
    if (!OPT.text) return leer;
    const kapitelVon = el => { const a = el.closest('[data-zustand]'); return a ? Z.findIndex(z => z.name === a.dataset.zustand) : -1; };
    const kaskaden = OPT.text.kaskade ? Array.from(document.querySelectorAll('main [data-kaskade]'), el => ({ el, i: kapitelVon(el), los: false, lage: null })).filter(k => k.i >= 0) : [];
    const teile = OPT.text.auftritt ? Array.from(document.querySelectorAll('main [data-auftritt]'), el => ({ el, i: kapitelVon(el), z: '', lage: null })).filter(t => t.i >= 0) : [];
    // Zahlen-Trommel: „41 %“ → unsichtbare Kopie für Vorleser + Ziffer (aria-hidden), die beim Aktivwerden hochzählt.
    const trommeln = OPT.text.trommel === false ? [] : Array.from(document.querySelectorAll('main .trommel .wert'), el => {
      const t = el.firstChild, m = t && t.nodeType === 3 ? /^(\d+)([\s\S]*)$/.exec(t.nodeValue) : null;
      if (!m) return null;
      const lesen = document.createElement('span'), ziffer = document.createElement('span'), rest = document.createElement('span');
      lesen.className = 'unsichtbar'; lesen.textContent = t.nodeValue.replace(/\s+/g, ' ');
      ziffer.className = 'trommel-ziffer'; ziffer.setAttribute('aria-hidden', 'true'); ziffer.style.minWidth = `${m[1].length}ch`;
      rest.setAttribute('aria-hidden', 'true'); rest.textContent = m[2];
      el.insertBefore(lesen, t); el.insertBefore(ziffer, t); el.insertBefore(rest, t); el.removeChild(t);
      return { el, ziffer, wert: +m[1], i: kapitelVon(el), z: '', lage: null, t0: 0, zahl: -1 };
    }).filter(t => t && t.i >= 0);
    function zeigeZahl(t, stand) {
      if (stand.zahl === t.zahl) return;
      t.zahl = stand.zahl; t.ziffer.textContent = String(stand.zahl);
      t.ziffer.style.filter = stand.rest > .002 ? `blur(${(stand.rest * .5).toFixed(3)}rem)` : '';
      t.ziffer.style.transform = stand.rest > .002 ? `translateY(${(stand.rest * 1.25).toFixed(3)}rem)` : '';
    }
    for (const t of trommeln) zeigeZahl(t, { zahl: 0, rest: 1 });
    // Aufdeck-Fuß: der Fuß liegt (ab 768 px) fest hinter der Seite; der Abstandhalter .aufdecken deckt ihn auf (--aufdeckung 0…1).
    const abstand = OPT.text.fuss === false ? null : document.querySelector('.aufdecken'), fuss = abstand && document.querySelector('footer.fuss');
    const fussTitel = fuss && fuss.querySelector('[data-kaskade-fuss]');
    let fussAn = false, fussOben = 0, fussHoehe = 1, aufdeckung = -1;
    if (fussTitel) { zerlegen(fussTitel, document, 'unsichtbar'); fussTitel.classList.add('kaskade'); }
    // Tastatur: springt der Fokus in den noch verdeckten Fuß, scrollt die Seite ans Ende — er ist nie unerreichbar.
    if (fuss) fuss.addEventListener('focusin', () => { if (fussAn && aufdeckung < .98) window.scrollTo(0, document.documentElement.scrollHeight); });
    function fussMessen(y) {
      if (!fuss) return;
      html.classList.toggle('fuss-aufdecken', window.innerWidth >= 768);
      if (fuss.offsetHeight > window.innerHeight) html.classList.remove('fuss-aufdecken'); // passt er nicht ins Fenster, bleibt er normal
      fussAn = html.classList.contains('fuss-aufdecken');
      abstand.style.height = fussAn ? `${fuss.offsetHeight}px` : '';
      fussOben = abstand.getBoundingClientRect().top + y; fussHoehe = Math.max(1, fuss.offsetHeight); aufdeckung = -1;
    }
    function fussSetzen(y) {
      if (!fuss) return;
      const p = fussAn ? K.clamp((y + vh - fussOben) / fussHoehe, 0, 1) : 1;
      if (Math.abs(p - aufdeckung) < .0005) return;
      aufdeckung = p;
      fuss.style.setProperty('--aufdeckung', p.toFixed(4));
      const offen = p > 0 ? 'ja' : 'nein';
      if (fuss.dataset.offen !== offen) fuss.dataset.offen = offen;
      if (p > .15) html.dataset.fuss = 'offen'; else delete html.dataset.fuss;
      if (fussTitel) { if (p >= .2) fussTitel.classList.add('los'); else if (p < .05) fussTitel.classList.remove('los'); }
    }
    if (!kaskaden.length && !teile.length && !trommeln.length && !fuss) return leer;
    // Reihenfolge je Kapitel → leiser Versatz beim Erscheinen (Mikro-Pille, Unterzeile, Knöpfe).
    const folge = new Map();
    for (const t of teile) { const k = folge.get(t.i) || 0; folge.set(t.i, k + 1); t.el.style.setProperty('--folge', String(k)); }
    for (const k of kaskaden) {
      const z = zerlegen(k.el, document, 'unsichtbar');
      k.el.classList.add('kaskade'); k.zurueck = z.zurueck; k.dauer = 1200 + z.buchstaben.length * 15 + 150;
    }
    const steht = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'sticky') return true; return false; };
    for (const t of [...teile, ...kaskaden, ...trommeln]) t.steht = steht(t.el);
    // Anfang ohne Übergang setzen (Einstieg: das erste Kapitel beginnt „vorher“ und kommt dann herein).
    html.classList.add('text-bereit', 'text-sofort');
    for (const t of teile) { t.z = 'vorher'; t.el.dataset.auftritt = 'vorher'; }
    void html.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('text-sofort')));
    if (OPT.einstieg) { html.classList.add('einstieg'); setTimeout(() => html.classList.remove('einstieg'), 3200); }
    function zuende(k) { setTimeout(() => { k.zurueck(); k.el.classList.remove('kaskade', 'los'); }, k.dauer); }
    return {
      messen(y) {
        fussMessen(y);
        for (const t of [...teile, ...kaskaden, ...trommeln]) {
          if (t.steht) { t.lage = null; continue; }
          const r = t.el.getBoundingClientRect(), v = t.ziffer ? 0 : t.z === 'vorher' ? 30 : t.z === 'nach' ? -30 : 0; // ohne den eigenen Versatz
          t.lage = { oben: r.top + y - v, unten: r.bottom + y - v };
        }
      },
      /** gibt true zurück, solange eine Trommel läuft (die Bild-Schleife ruht dann nicht). */
      setze(T, y) {
        if (html.classList.contains('text-sofort')) return true;
        fussSetzen(y);
        const jetzt = performance.now();
        let laeuftNoch = false;
        for (const t of trommeln) {
          const z = auftritt(t.z, T, t.i, t.lage, y, vh);
          if (z !== t.z) { t.z = z; t.t0 = z === 'jetzt' ? jetzt : 0; if (!t.t0) zeigeZahl(t, { zahl: 0, rest: 1 }); } // verlassen: sofort auf 0
          if (t.t0) { const st = trommel(t.wert, jetzt - t.t0); zeigeZahl(t, st); if (st.fertig) t.t0 = 0; else laeuftNoch = true; }
        }
        for (const t of teile) {
          const z = auftritt(t.z, T, t.i, t.lage, y, vh);
          if (z !== t.z) { t.z = z; t.el.dataset.auftritt = z; }
        }
        for (const k of kaskaden) if (!k.los && auftritt('', T, k.i, k.lage, y, vh) === 'jetzt') { k.los = true; k.el.classList.add('los'); zuende(k); }
        return laeuftNoch;
      },
    };
  })();

  // ── Takt: ein Bild-Schleife für Fortschritt, Text und Szene ──
  const lauf = { wert: 0, v: 0 }, dolly = { wert: 0, v: 0 };
  let laeuft = false, letzte = 0, zeit = 0, aktiv = -1, szene = null, szeneKommt = true, einstieg = OPT.einstieg ? 0 : 1;
  messen(); lauf.wert = zielT(window.scrollY);
  const dauer = []; let gesenkt = 0;
  function bild(jetzt) {
    if (!laeuft) return;
    const dt = Math.min(.1, letzte ? (jetzt - letzte) / 1000 : .016); letzte = jetzt; zeit += dt;
    const y = window.scrollY, ziel = zielT(y);
    const T = K.feder(lauf, ziel, dt, OPT.folgen);
    const k = Math.min(Math.floor(T), n - 2), u = K.clamp(T - k, 0, 1);
    K.feder(dolly, lesen(k, y) + (lesen(k + 1, y) - lesen(k, y)) * K.sanfter(u), dt, OPT.folgen * 1.6);
    const textLaeuft = buehne.setze(T, y);
    const neu = Math.round(T);
    if (neu !== aktiv) {
      aktiv = neu; html.dataset.kapitel = Z[aktiv].name; html.dataset.lage = Z[aktiv].schub > 0 ? 'rechts' : 'mitte';
      for (const l of leiste) { if (l.namen.includes(Z[aktiv].name)) l.a.setAttribute('aria-current', 'true'); else l.a.removeAttribute('aria-current'); }
    }
    if (szene) {
      if (einstieg < 1) einstieg = Math.min(1, einstieg + dt * 1000 / OPT.einstieg.dauer * (T > .08 ? 3 : 1)); // frühes Scrollen: Einstieg beschleunigt fertig
      if (dauer.push(dt) > 90) dauer.shift();
      if (dauer.length === 90 && szene.dpr > 1 && gesenkt < 3) {
        const mittel = dauer.reduce((a, c) => a + c, 0) / 90;
        if (mittel > .024) { szene.dpr = Math.max(1, szene.dpr - .25); gesenkt++; dauer.length = 0; szene.groesse(); }
      }
      if (!huelle.hasAttribute('data-ruht') || !html.classList.contains('mit-szene')) szene.zeichnen(T, k, u);
    } else if (!szeneKommt && ziel === T && !textLaeuft) { laeuft = false; return; } // ohne Szene: ruhen, bis wieder gescrollt wird
    requestAnimationFrame(bild);
  }
  function start() { if (laeuft || document.hidden) return; laeuft = true; letzte = 0; requestAnimationFrame(bild); }
  function halt() { laeuft = false; }
  const leiste = Array.from(document.querySelectorAll('.kapitelleiste a[data-zustaende]'), a => ({ a, namen: a.dataset.zustaende.split(' ') }));
  let warten = 0;
  const neuMessen = () => { clearTimeout(warten); warten = setTimeout(() => { if (szene) szene.groesse(); else messen(); start(); }, 120); };
  window.addEventListener('resize', neuMessen);
  if ('ResizeObserver' in window) new ResizeObserver(neuMessen).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { messen(); start(); });
  window.addEventListener('load', messen);
  window.addEventListener('scroll', start, { passive: true });
  document.addEventListener('visibilitychange', () => document.hidden ? halt() : start());
  start();

  if (!('WebGLRenderingContext' in window)) { aus(); return; }
  requestAnimationFrame(() => setTimeout(() => { try { szene = los(); if (!szene) aus(); } catch (e) { aus(); } start(); }, 40));

  function los() {
    const gl = leinwand.getContext('webgl', { antialias: true, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const zeichen = document.querySelector('svg.zeichen');
    const teilchen = S.drehbuch.teilchen;
    const welt = FM.bauen(S.drehbuch, { handy, logo: zeichen ? FM.logoAusSvg(zeichen.outerHTML) : null, anzahl: teilchen ? teilchen[handy ? 'handy' : 'rechner'] : undefined });

    // ── Shader ──
    const P = FM.PALETTE.map(c => `vec3(${c.map(v => v.toFixed(3)).join(',')})`);
    const KOPF = `precision highp float;
uniform mat4 uM;uniform vec3 uAuge;uniform float uZeit;uniform vec2 uNebel;uniform float uPx;uniform float uAuf;
varying vec3 vF;varying float vA;
vec3 farbe(float i){if(i<.5)return ${P[0]};if(i<1.5)return ${P[1]};if(i<2.5)return ${P[2]};if(i<3.5)return ${P[3]};return ${P[4]};}
float nebel(float d){return 1.-smoothstep(uNebel.x,uNebel.y,d);}
float bluehen(float saat){float x=clamp((uAuf-saat*.5)/.5,0.,1.);x=1.-x;return 1.-x*x*x;}
`;
    const PUNKT_FS = `precision mediump float;varying vec3 vF;varying float vA;
void main(){vec2 c=gl_PointCoord*2.-1.;float d=dot(c,c);if(d>1.)discard;float a=exp(-d*5.)*.8+exp(-d*24.)*.9;gl_FragColor=vec4(vF*a*vA,1.);}`;
    const LINIE_FS = `precision mediump float;varying vec3 vF;varying float vA;void main(){gl_FragColor=vec4(vF*vA,1.);}`;
    // Teilchen: gehen von Formation „Von“ zu „Nach“ (uMix), jedes mit eigener Verzögerung, auf einem kleinen Bogen.
    // Einstieg (uAuf 0 → 1): jedes blüht zu seiner Zeit auf — wächst aus dem Nichts und wird hell.
    const PUNKTE_VS = KOPF + `attribute vec4 aVon;attribute vec4 aNach;attribute vec4 aSaat;
uniform float uMix;uniform float uFunkeln;uniform float uGewicht;
void main(){
float m=clamp((uMix-aSaat.x*.4)/.6,0.,1.);m=m*m*(3.-2.*m);
vec3 p=mix(aVon.xyz,aNach.xyz,m);float bogen=sin(m*3.14159)*min(1.,distance(aVon.xyz,aNach.xyz)*4.);
p+=vec3(cos(aSaat.y),sin(aSaat.y),cos(aSaat.y*1.7))*bogen*(1.+aSaat.w*1.8);
p+=.035*vec3(sin(uZeit*.6+aSaat.y*7.),sin(uZeit*.5+aSaat.w*9.),sin(uZeit*.7+aSaat.x*5.));
float h=mix(fract(aVon.w),fract(aNach.w),m);
float tw=1.-uFunkeln*.85*(.5+.5*sin(uZeit*(1.5+aSaat.w*3.)+aSaat.y*13.));
float b=bluehen(aSaat.w);
gl_Position=uM*vec4(p,1.);float d=distance(p,uAuge);
gl_PointSize=clamp(uPx*aSaat.z/d*(1.+bogen*.6),1.2,24.)*(.2+.8*b);
vA=h*tw*nebel(d)*smoothstep(.6,3.5,d)*uGewicht*(1.+bogen*.4)*b;
vF=mix(farbe(floor(aVon.w)),farbe(floor(aNach.w)),m);}`;
    // Feine Linien (Netz, Formationen): t = Lage entlang der Linie → Aufbau (uEnthuellt) und Lichtimpulse (uPuls).
    const LINIEN_VS = KOPF + `attribute vec3 aPos;attribute vec3 aDaten;
uniform float uGewicht;uniform float uEnthuellt;uniform float uPuls;uniform float uAnteil;uniform float uGrund;
void main(){gl_Position=uM*vec4(aPos,1.);float d=distance(aPos,uAuge);
float sicht=1.-smoothstep(uEnthuellt-.04,uEnthuellt,aDaten.x);
float q=fract(aDaten.x*1.4-uZeit*uPuls+aDaten.z);float puls=exp(-pow((q-.5)*14.,2.))*step(fract(aDaten.z*7.),uAnteil);
vA=fract(aDaten.y)*uGrund*sicht*uGewicht*nebel(d)*smoothstep(.8,4.,d)*(1.+puls*2.4)*bluehen(.35+.65*aDaten.z);vF=farbe(floor(aDaten.y));}`;
    // Lichtfäden entlang des Pfads: die Lage rechnet der Shader (dieselbe Formel wie kern.faden).
    const PFAD = K.pfadGlsl() + K.fadenGlsl(welt.ziele);
    const FAEDEN_VS = KOPF + PFAD + `attribute vec3 aFaden;uniform float uGrund;uniform vec2 uNah;
void main(){float s=aFaden.x;vec3 p,r,u;rahmen(s,p,r,u);vec3 o=faden(s,aFaden.y,aFaden.z,uZeit);
vec3 w=p+r*o.x+u*o.y;gl_Position=uM*vec4(w,1.);float d=distance(w,uAuge);
float q=fract(s*.035-uZeit*.35+aFaden.y*3.);float puls=exp(-pow((q-.5)*18.,2.));
vF=farbe(aFaden.z<.5?1.:aFaden.z<1.5?2.:0.);vA=o.z*nebel(d)*smoothstep(uNah.x,uNah.y,d)*(.3+puls*1.3)*uGrund*(aFaden.z>1.5?.6:1.)*bluehen(.2+.8*aFaden.y);}`;
    const STAUB_VS = KOPF + PFAD + `attribute vec3 aStaub;uniform vec2 uBereich;uniform vec2 uNah;uniform float uGrund;
void main(){float s=uBereich.x+mod(aStaub.x-uBereich.x+uZeit*(1.2+aStaub.y*1.4),uBereich.y);
vec3 p,r,u;rahmen(s,p,r,u);vec3 o=faden(s,aStaub.y,aStaub.z,uZeit);
vec3 w=p+r*o.x*1.15+u*o.y*1.15;gl_Position=uM*vec4(w,1.);float d=distance(w,uAuge);float b=bluehen(aStaub.y);
gl_PointSize=clamp(uPx*.9/d,1.,9.)*(.3+.7*b);vF=farbe(aStaub.z<.5?1.:aStaub.z<1.5?2.:4.);vA=o.z*nebel(d)*smoothstep(uNah.x,uNah.y,d)*.9*uGrund*b;}`;

    function programm(vs, fs) {
      const p = gl.createProgram();
      for (const [art, quelle] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(art); gl.shaderSource(sh, quelle); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'Shader');
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Programm');
      const u = {}, a = {};
      return { p, u: name => name in u ? u[name] : (u[name] = gl.getUniformLocation(p, name)), a: name => name in a ? a[name] : (a[name] = gl.getAttribLocation(p, name)) };
    }
    const PR = { punkte: programm(PUNKTE_VS, PUNKT_FS), linien: programm(LINIEN_VS, LINIE_FS), faeden: programm(FAEDEN_VS, LINIE_FS), staub: programm(STAUB_VS, PUNKT_FS) };
    const puffer = d => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); return b; };
    const B = {
      formationen: welt.formationen.map(f => puffer(f.punkte)),
      linien: welt.formationen.map(f => f.linien ? { b: puffer(f.linien), n: f.linien.length / 6 } : null),
      saat: puffer(welt.saat),
      netz: puffer(welt.netz.punkte), netzSaat: puffer(welt.netz.saat), netzN: welt.netz.punkte.length / 4,
      kanten: puffer(welt.netz.kanten), kantenN: welt.netz.kanten.length / 6,
      faeden: puffer(welt.faeden), faedenN: welt.faeden.length / 3,
      staub: puffer(welt.staub), staubN: welt.staub.length / 3,
    };
    const AN = new Set();
    function binde(pr, name, buf, groesse, schritt, versatz) {
      const loc = pr.a(name); if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); AN.add(loc);
      gl.vertexAttribPointer(loc, groesse, gl.FLOAT, false, schritt * 4, versatz * 4);
    }
    function nutze(pr, g) {
      for (const l of AN) gl.disableVertexAttribArray(l); AN.clear();
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u('uM'), false, g.M); gl.uniform3fv(pr.u('uAuge'), g.auge);
      gl.uniform1f(pr.u('uZeit'), g.zeit); gl.uniform2f(pr.u('uNebel'), g.nebel[0], g.nebel[1]); gl.uniform1f(pr.u('uPx'), g.px);
      gl.uniform1f(pr.u('uAuf'), g.auf);
    }
    const GRUND = [.018, .024, .03];
    const aurora = OPT.aurora ? auroraBauen() : null;

    // ── Aurora: Schleier in Granat und Smaragd nur an den Rändern (Mitte frei, Rand „atmet“, dreht leicht mit dem Scroll).
    // Gerechnet in reduzierter Auflösung (Anteil `aufloesung` der Leinwand) in einen eigenen Puffer, dann weich hochgezogen
    // (mit leisem Rauschen gegen Stufen im Verlauf) — er ist zugleich der Hintergrund der Szene.
    function auroraBauen() {
      const cfg = OPT.aurora, hoch = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
      const VS = 'attribute vec2 aEcke;varying vec2 vP;void main(){vP=aEcke;gl_Position=vec4(aEcke,0.,1.);}';
      const FS = hoch + `uniform sampler2D uRausch;uniform float uZeit;uniform float uDreh;uniform float uAspekt;uniform float uStaerke;varying vec2 vP;
float r(vec2 p){p=p*64.+.5;vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(uRausch,(i+f-.5)/64.).r;}
float fbm(vec2 p){float s=0.,a=.5,t=0.;for(int i=0;i<${Math.max(1, Math.min(6, cfg.oktaven | 0))};i++){s+=a*r(p);t+=a;p=mat2(1.6,1.2,-1.2,1.6)*p+.37;a*=.5;}return s/t;}
void main(){vec2 e=abs(vP);float rand=max(e.x,e.y)*.6+length(e)*.4;
vec2 p=vP*vec2(uAspekt,1.)*.022;vec2 wind=vec2(sin(uZeit*.013),cos(uZeit*.011))*.06;
float n=fbm(p+wind);float m=fbm(p*1.7-wind.yx+.5);
float grenze=.8+(n-.5)*.8+.035*sin(uZeit*.21);float schleier=smoothstep(grenze,grenze+.55,rand);
float c=cos(uDreh),s=sin(uDreh);vec2 q=mat2(c,s,-s,c)*vP;
float ton=smoothstep(-.5,.5,q.x*.75+q.y*.35+(m-.5)*1.6);
gl_FragColor=vec4(mix(${P[1]},${P[2]},ton)*schleier*(.25+1.1*m*m)*uStaerke,1.);}`;
      const ZFS = hoch + `uniform sampler2D uBild;uniform vec3 uGrund;varying vec2 vP;
void main(){float d=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
gl_FragColor=vec4(uGrund+texture2D(uBild,vP*.5+.5).rgb+(d-.5)/255.,1.);}`;
      const pr = programm(VS, FS), zu = programm(VS, ZFS), ecken = puffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
      // Rauschen: 64 × 64 feste Zufallswerte (gleich bei jedem Laden), weich gelesen (kein Kachelmuster sichtbar).
      const z = K.zufall(2026), werte = new Uint8Array(64 * 64);
      for (let i = 0; i < werte.length; i++) werte[i] = Math.floor(z() * 256);
      const textur = (breiteT, hoeheT, daten, format, wiederholen) => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, format, breiteT, hoeheT, 0, format, gl.UNSIGNED_BYTE, daten);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const w = wiederholen ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
        return t;
      };
      const rausch = textur(64, 64, werte, gl.LUMINANCE, true);
      let bild = null, rahmenP = null, bw = 0, bh = 0;
      function groesse(b, h) {
        const nb = Math.max(8, Math.round(b * cfg.aufloesung)), nh = Math.max(8, Math.round(h * cfg.aufloesung));
        if (nb === bw && nh === bh) return;
        bw = nb; bh = nh;
        if (bild) gl.deleteTexture(bild);
        bild = textur(bw, bh, null, gl.RGBA, false);
        if (!rahmenP) rahmenP = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, rahmenP);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bild, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Aurora');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      function quad(p) {
        for (const l of AN) gl.disableVertexAttribArray(l); AN.clear();
        gl.useProgram(p.p); binde(p, 'aEcke', ecken, 2, 2, 0);
      }
      return {
        groesse,
        /** zeichnet Hintergrund + Aurora über die ganze Leinwand (ersetzt das Löschen). */
        zeichnen(zeitA, dreh, staerke, aspekt, b, h) {
          gl.disable(gl.BLEND);
          gl.bindFramebuffer(gl.FRAMEBUFFER, rahmenP); gl.viewport(0, 0, bw, bh);
          quad(pr);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rausch); gl.uniform1i(pr.u('uRausch'), 0);
          gl.uniform1f(pr.u('uZeit'), cfg.bewegung ? zeitA : 0); gl.uniform1f(pr.u('uDreh'), dreh);
          gl.uniform1f(pr.u('uAspekt'), aspekt); gl.uniform1f(pr.u('uStaerke'), staerke);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, b, h);
          quad(zu);
          gl.bindTexture(gl.TEXTURE_2D, bild); gl.uniform1i(zu.u('uBild'), 0); gl.uniform3f(zu.u('uGrund'), GRUND[0], GRUND[1], GRUND[2]);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
      };
    }

    // ── Größe, Auflösung ──
    const sz = { dpr: Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 1.75), groesse, zeichnen };
    let breite = 1, hoehe = 1;
    function groesse() {
      breite = Math.max(1, Math.round(leinwand.clientWidth * sz.dpr)); hoehe = Math.max(1, Math.round(leinwand.clientHeight * sz.dpr));
      if (leinwand.width !== breite || leinwand.height !== hoehe) { leinwand.width = breite; leinwand.height = hoehe; }
      if (aurora) aurora.groesse(breite, hoehe);
      messen();
    }
    groesse();
    const marken = Array.from(document.querySelectorAll('.szene .marke[data-zustand]'), el => ({ el, i: Z.findIndex(z => z.name === el.dataset.zustand), nr: +el.dataset.nr || 0 }));
    let erstes = true;

    // ── Bild ──
    function zeichnen(T, k, u) {
      const aspekt = breite / hoehe;
      const kam = K.kamera(Z, T, dolly.wert, zeit, aspekt, { handy, kante, naeher: K.einstieg(einstieg, OPT.einstieg) });
      const M = K.mal(K.perspektive(kam.fov, aspekt, .1, 600, kam.schubX, kam.schubY), K.blick(kam.auge, kam.ziel, kam.oben));
      const g = { M, auge: new Float32Array(kam.auge), zeit, nebel: [kam.D * .9 + 6, kam.D + 80], px: hoehe / 2 / Math.tan(kam.fov / 2) * (handy ? .1 : .075), auf: einstieg };
      gl.viewport(0, 0, breite, hoehe);
      if (aurora) aurora.zeichnen(zeit, T * .11 + zeit * .004, OPT.aurora.staerke * kam.wert('aurora') * K.ausLaufen(einstieg * 1.4), aspekt, breite, hoehe);
      else { gl.clearColor(GRUND[0], GRUND[1], GRUND[2], 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      // Netz: Kanten, dann Knoten.
      let pr = PR.linien; nutze(pr, g);
      if (B.kantenN) {
        binde(pr, 'aPos', B.kanten, 3, 6, 0); binde(pr, 'aDaten', B.kanten, 3, 6, 3);
        gl.uniform1f(pr.u('uGewicht'), 1); gl.uniform1f(pr.u('uEnthuellt'), 2); gl.uniform1f(pr.u('uPuls'), .22); gl.uniform1f(pr.u('uAnteil'), .25); gl.uniform1f(pr.u('uGrund'), .26);
        gl.drawArrays(gl.LINES, 0, B.kantenN);
      }
      // Linien der Formationen in der Nähe des Zustands (bauen sich von links auf).
      for (let i = 0; i < n; i++) {
        const L = B.linien[i]; if (!L) continue;
        const w = K.sanft((1 - Math.abs(T - i)) * 1.6); if (w <= .002) continue;
        binde(pr, 'aPos', L.b, 3, 6, 0); binde(pr, 'aDaten', L.b, 3, 6, 3);
        gl.uniform1f(pr.u('uGewicht'), w * kam.wert('hell')); gl.uniform1f(pr.u('uEnthuellt'), w * 1.1); gl.uniform1f(pr.u('uPuls'), .3); gl.uniform1f(pr.u('uAnteil'), 1); gl.uniform1f(pr.u('uGrund'), handy ? .85 : .7);
        gl.drawArrays(gl.LINES, 0, L.n);
      }
      // Lichtfäden entlang des Pfads und Staub, der entlang der Fäden fließt (fehlen bei `pfad: false`).
      const nah = kam.wert('nah') * kam.D, hell = kam.wert('faeden');
      if (B.faedenN) {
        pr = PR.faeden; nutze(pr, g);
        binde(pr, 'aFaden', B.faeden, 3, 3, 0); gl.uniform1f(pr.u('uGrund'), (handy ? 1.1 : .85) * hell); gl.uniform2f(pr.u('uNah'), nah * .7 + 1.5, nah + 7);
        gl.drawArrays(gl.LINES, 0, B.faedenN);
      }
      if (B.staubN) {
        pr = PR.staub; nutze(pr, g);
        binde(pr, 'aStaub', B.staub, 3, 3, 0); gl.uniform2f(pr.u('uBereich'), welt.von, welt.bis - welt.von);
        gl.uniform2f(pr.u('uNah'), nah * .7 + 1, nah + 5); gl.uniform1f(pr.u('uGrund'), .15 + .85 * hell);
        gl.drawArrays(gl.POINTS, 0, B.staubN);
      }
      // Neuronen (statisch) und die Teilchen der Formationen.
      pr = PR.punkte; nutze(pr, g);
      if (B.netzN) {
        binde(pr, 'aVon', B.netz, 4, 4, 0); binde(pr, 'aNach', B.netz, 4, 4, 0); binde(pr, 'aSaat', B.netzSaat, 4, 4, 0);
        gl.uniform1f(pr.u('uMix'), 0); gl.uniform1f(pr.u('uFunkeln'), .45); gl.uniform1f(pr.u('uGewicht'), .9);
        gl.drawArrays(gl.POINTS, 0, B.netzN);
      }
      binde(pr, 'aVon', B.formationen[k], 4, 4, 0); binde(pr, 'aNach', B.formationen[k + 1], 4, 4, 0); binde(pr, 'aSaat', B.saat, 4, 4, 0);
      gl.uniform1f(pr.u('uMix'), u); gl.uniform1f(pr.u('uFunkeln'), Z[k].funkeln + (Z[k + 1].funkeln - Z[k].funkeln) * u); gl.uniform1f(pr.u('uGewicht'), kam.wert('hell'));
      gl.drawArrays(gl.POINTS, 0, welt.N);
      // Beschriftungen im Bild (Städte, Phasen, Ströme) und das Logo am Ende — echtes HTML/SVG über der Leinwand.
      const css = (p) => { const q = K.projiziere(M, p); return [(q[0] * .5 + .5) * leinwand.clientWidth, (.5 - q[1] * .5) * leinwand.clientHeight, q[2]]; };
      for (const m of marken) {
        const w = m.i < 0 ? 0 : K.sanft((1 - Math.abs(T - m.i)) * 2.2 - .9), p = m.i < 0 ? null : welt.formationen[m.i].marken[m.nr];
        if (!p || w <= .01) { if (m.el.style.opacity !== '0') m.el.style.opacity = '0'; continue; }
        const q = css(p);
        m.el.style.opacity = q[2] > 0 ? w.toFixed(3) : '0';
        m.el.style.transform = `translate3d(${q[0].toFixed(1)}px, ${q[1].toFixed(1)}px, 0)`;
      }
      if (zeichen) {
        const i = n - 1, w = K.sanft((T - (i - .25)) / .25), ecken = welt.formationen[i].marken;
        if (w > .01 && ecken.length === 2) {
          const a = css(ecken[0]), c = css(ecken[1]);
          zeichen.style.opacity = w.toFixed(3);
          zeichen.style.width = `${Math.max(1, c[0] - a[0]).toFixed(1)}px`;
          zeichen.style.transform = `translate3d(${a[0].toFixed(1)}px, ${a[1].toFixed(1)}px, 0)`;
        } else if (zeichen.style.opacity !== '0') zeichen.style.opacity = '0';
      }
      if (erstes) { erstes = false; html.classList.add('mit-szene'); }
    }
    leinwand.addEventListener('webglcontextlost', e => { e.preventDefault(); szene = null; aus(); });
    return sz;
  }
})(typeof window !== 'undefined' ? window : globalThis);
