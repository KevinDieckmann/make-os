// MAKE Innovation · Szene v5 — Motor (04.10.2026)
// Eine durchgehende WebGL-Szene hinter dem Text: Scrollen = Kamerafahrt entlang des Lichtpfads durch ein Neuronennetz;
// je Kapitel formen dieselben Teilchen ein Bild (js/szene/formationen.js nach dem Drehbuch js/drehbuch.js).
// Eigenes schlankes WebGL 1 statt einer Bibliothek: Punkte und feine Linien sind alles, was die Szene braucht — so bleibt
// sie klein (keine fremde Datei, kein Nachladen) und läuft unter der strengen CSP (script-src 'self', kein eval).
//
// Ablauf: Der Text steht sofort als HTML. Erst nach dem ersten Bild baut dieses Skript die Szene; gelingt das, bekommt
// <html> die Klasse „mit-szene“ (CSS blendet dann die Standbilder aus). Ohne WebGL, ohne Skript oder bei
// „Bewegung reduzieren“ bleiben die gestalteten Standbilder je Kapitel stehen (assets/szene/*.svg).
// Pausiert im verborgenen Tab, senkt bei Bedarf die Auflösung. Liest, speichert und sendet nichts.
(function () {
  'use strict';
  const S = window.MakeSzene;
  const html = document.documentElement;
  const huelle = document.querySelector('.szene');
  const leinwand = huelle && huelle.querySelector('canvas');
  if (!S || !S.kern || !S.formationen || !S.drehbuch || !leinwand) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const K = S.kern, FM = S.formationen;
  // Mit Skript blendet das CSS die Standbilder aus (@media (scripting: enabled)), solange die Szene kommt — scheitert
  // sie, holt „ohne-szene“ sie zurück.
  const aus = () => { html.classList.remove('mit-szene'); html.classList.add('ohne-szene'); };
  if (!('WebGLRenderingContext' in window)) { aus(); return; }
  requestAnimationFrame(() => setTimeout(() => { try { if (!los()) aus(); } catch (e) { aus(); } }, 40));

  function los() {
    const gl = leinwand.getContext('webgl', { antialias: true, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    const handy = window.innerWidth < 760 || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1100);
    const zeichen = document.querySelector('svg.zeichen');
    const welt = FM.bauen(S.drehbuch, { handy, logo: zeichen ? FM.logoAusSvg(zeichen.outerHTML) : null });
    const Z = welt.Z, n = Z.length;

    // ── Shader ──
    const P = FM.PALETTE.map(c => `vec3(${c.map(v => v.toFixed(3)).join(',')})`);
    const KOPF = `precision highp float;
uniform mat4 uM;uniform vec3 uAuge;uniform float uZeit;uniform vec2 uNebel;uniform float uPx;
varying vec3 vF;varying float vA;
vec3 farbe(float i){if(i<.5)return ${P[0]};if(i<1.5)return ${P[1]};if(i<2.5)return ${P[2]};if(i<3.5)return ${P[3]};return ${P[4]};}
float nebel(float d){return 1.-smoothstep(uNebel.x,uNebel.y,d);}
`;
    const PUNKT_FS = `precision mediump float;varying vec3 vF;varying float vA;
void main(){vec2 c=gl_PointCoord*2.-1.;float d=dot(c,c);if(d>1.)discard;float a=exp(-d*5.)*.8+exp(-d*24.)*.9;gl_FragColor=vec4(vF*a*vA,1.);}`;
    const LINIE_FS = `precision mediump float;varying vec3 vF;varying float vA;void main(){gl_FragColor=vec4(vF*vA,1.);}`;
    // Teilchen: gehen von Formation „Von“ zu „Nach“ (uMix), jedes mit eigener Verzögerung, auf einem kleinen Bogen.
    const PUNKTE_VS = KOPF + `attribute vec4 aVon;attribute vec4 aNach;attribute vec4 aSaat;
uniform float uMix;uniform float uFunkeln;uniform float uGewicht;
void main(){
float m=clamp((uMix-aSaat.x*.4)/.6,0.,1.);m=m*m*(3.-2.*m);
vec3 p=mix(aVon.xyz,aNach.xyz,m);float bogen=sin(m*3.14159);
p+=vec3(cos(aSaat.y),sin(aSaat.y),cos(aSaat.y*1.7))*bogen*(1.+aSaat.w*1.8);
p+=.035*vec3(sin(uZeit*.6+aSaat.y*7.),sin(uZeit*.5+aSaat.w*9.),sin(uZeit*.7+aSaat.x*5.));
float h=mix(fract(aVon.w),fract(aNach.w),m);
float tw=1.-uFunkeln*.85*(.5+.5*sin(uZeit*(1.5+aSaat.w*3.)+aSaat.y*13.));
gl_Position=uM*vec4(p,1.);float d=distance(p,uAuge);
gl_PointSize=clamp(uPx*aSaat.z/d*(1.+bogen*.6),1.2,24.);
vA=h*tw*nebel(d)*smoothstep(.6,3.5,d)*uGewicht*(1.+bogen*.4);
vF=mix(farbe(floor(aVon.w)),farbe(floor(aNach.w)),m);}`;
    // Feine Linien (Netz, Formationen): t = Lage entlang der Linie → Aufbau (uEnthuellt) und Lichtimpulse (uPuls).
    const LINIEN_VS = KOPF + `attribute vec3 aPos;attribute vec3 aDaten;
uniform float uGewicht;uniform float uEnthuellt;uniform float uPuls;uniform float uAnteil;uniform float uGrund;
void main(){gl_Position=uM*vec4(aPos,1.);float d=distance(aPos,uAuge);
float sicht=1.-smoothstep(uEnthuellt-.04,uEnthuellt,aDaten.x);
float q=fract(aDaten.x*1.4-uZeit*uPuls+aDaten.z);float puls=exp(-pow((q-.5)*14.,2.))*step(fract(aDaten.z*7.),uAnteil);
vA=fract(aDaten.y)*uGrund*sicht*uGewicht*nebel(d)*smoothstep(.8,4.,d)*(1.+puls*2.4);vF=farbe(floor(aDaten.y));}`;
    // Lichtfäden entlang des Pfads: die Lage rechnet der Shader (dieselbe Formel wie kern.faden).
    const PFAD = K.pfadGlsl() + K.fadenGlsl(welt.ziele);
    const FAEDEN_VS = KOPF + PFAD + `attribute vec3 aFaden;uniform float uGrund;uniform vec2 uNah;
void main(){float s=aFaden.x;vec3 p,r,u;rahmen(s,p,r,u);vec3 o=faden(s,aFaden.y,aFaden.z,uZeit);
vec3 w=p+r*o.x+u*o.y;gl_Position=uM*vec4(w,1.);float d=distance(w,uAuge);
float q=fract(s*.035-uZeit*.35+aFaden.y*3.);float puls=exp(-pow((q-.5)*18.,2.));
vF=farbe(aFaden.z<.5?1.:aFaden.z<1.5?2.:0.);vA=o.z*nebel(d)*smoothstep(uNah.x,uNah.y,d)*(.3+puls*1.3)*uGrund*(aFaden.z>1.5?.6:1.);}`;
    const STAUB_VS = KOPF + PFAD + `attribute vec3 aStaub;uniform vec2 uBereich;uniform vec2 uNah;uniform float uGrund;
void main(){float s=uBereich.x+mod(aStaub.x-uBereich.x+uZeit*(1.2+aStaub.y*1.4),uBereich.y);
vec3 p,r,u;rahmen(s,p,r,u);vec3 o=faden(s,aStaub.y,aStaub.z,uZeit);
vec3 w=p+r*o.x*1.15+u*o.y*1.15;gl_Position=uM*vec4(w,1.);float d=distance(w,uAuge);
gl_PointSize=clamp(uPx*.9/d,1.,9.);vF=farbe(aStaub.z<.5?1.:aStaub.z<1.5?2.:4.);vA=o.z*nebel(d)*smoothstep(uNah.x,uNah.y,d)*.9*uGrund;}`;

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
    }

    // ── Scroll → Zustand ──
    const abschnitte = Z.map(z => document.querySelector(`main [data-zustand="${z.name}"]`));
    if (abschnitte.some(a => !a)) throw new Error('Drehbuch und Seite passen nicht zusammen');
    const marken = Array.from(document.querySelectorAll('.szene .marke[data-zustand]'), el => ({ el, i: Z.findIndex(z => z.name === el.dataset.zustand), nr: +el.dataset.nr || 0 }));
    const leiste = Array.from(document.querySelectorAll('.kapitelleiste a[data-zustaende]'), a => ({ a, namen: a.dataset.zustaende.split(' ') }));
    let lagen = [], vh = window.innerHeight, kante = 0;
    const spalte = document.querySelector('main .station .inhalt');
    function messen() {
      const y = window.scrollY; vh = window.innerHeight;
      kante = spalte ? spalte.getBoundingClientRect().right / Math.max(1, window.innerWidth) * 2 - 1 : 0;
      lagen = abschnitte.map(el => { const r = el.getBoundingClientRect(); return { top: r.top + y, hoehe: Math.max(1, r.height) }; });
    }
    const zielT = y => { let T = 0; for (let j = 1; j < n; j++) T += K.clamp((y + vh * .8 - lagen[j].top) / (vh * .6), 0, 1); return T; };
    const lesen = (j, y) => K.clamp((y + vh * .5 - lagen[j].top) / lagen[j].hoehe, 0, 1) - .5;

    // ── Größe, Auflösung ──
    let dpr = Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 1.75), breite = 1, hoehe = 1;
    function groesse() {
      breite = Math.max(1, Math.round(leinwand.clientWidth * dpr)); hoehe = Math.max(1, Math.round(leinwand.clientHeight * dpr));
      if (leinwand.width !== breite || leinwand.height !== hoehe) { leinwand.width = breite; leinwand.height = hoehe; }
      messen();
    }
    groesse();
    let warten = 0;
    window.addEventListener('resize', () => { clearTimeout(warten); warten = setTimeout(groesse, 120); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { clearTimeout(warten); warten = setTimeout(groesse, 120); }).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(messen);
    window.addEventListener('load', messen);

    // ── Bild ──
    let T = zielT(window.scrollY), dolly = 0, laeuft = false, letzte = 0, zeit = 0, aktiv = -1, erstes = true;
    const dauer = []; let gesenkt = 0;
    function bild(jetzt) {
      if (!laeuft) return;
      const dt = Math.min(.1, letzte ? (jetzt - letzte) / 1000 : .016); letzte = jetzt; zeit += dt;
      if (dauer.push(dt) > 90) dauer.shift();
      if (dauer.length === 90 && dpr > 1 && gesenkt < 3) {
        const mittel = dauer.reduce((a, c) => a + c, 0) / 90;
        if (mittel > .024) { dpr = Math.max(1, dpr - .25); gesenkt++; dauer.length = 0; groesse(); }
      }
      const y = window.scrollY, ziel = zielT(y), glatt = 1 - Math.exp(-dt * 4.2);
      T += (ziel - T) * glatt;
      if (Math.abs(ziel - T) < 1e-4) T = ziel;
      const k = Math.min(Math.floor(T), n - 2), u = K.clamp(T - k, 0, 1);
      const dZiel = lesen(k, y) + (lesen(k + 1, y) - lesen(k, y)) * K.sanfter(u);
      dolly += (dZiel - dolly) * glatt;
      zeichnen(k, u);
      if (erstes) { erstes = false; html.classList.add('mit-szene'); }
      const neu = Math.round(T);
      if (neu !== aktiv) {
        aktiv = neu; html.dataset.kapitel = Z[aktiv].name; html.dataset.lage = Z[aktiv].schub > 0 ? 'rechts' : 'mitte';
        for (const l of leiste) { if (l.namen.includes(Z[aktiv].name)) l.a.setAttribute('aria-current', 'true'); else l.a.removeAttribute('aria-current'); }
      }
      requestAnimationFrame(bild);
    }
    function zeichnen(k, u) {
      const aspekt = breite / hoehe;
      const kam = K.kamera(Z, T, dolly, zeit, aspekt, { handy, kante });
      const M = K.mal(K.perspektive(kam.fov, aspekt, .1, 600, kam.schubX, kam.schubY), K.blick(kam.auge, kam.ziel, kam.oben));
      const g = { M, auge: new Float32Array(kam.auge), zeit, nebel: [kam.D * .9 + 6, kam.D + 80], px: hoehe / 2 / Math.tan(kam.fov / 2) * (handy ? .1 : .075) };
      gl.viewport(0, 0, breite, hoehe);
      gl.clearColor(.018, .024, .03, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      // Netz: Kanten, dann Knoten.
      let pr = PR.linien; nutze(pr, g);
      binde(pr, 'aPos', B.kanten, 3, 6, 0); binde(pr, 'aDaten', B.kanten, 3, 6, 3);
      gl.uniform1f(pr.u('uGewicht'), 1); gl.uniform1f(pr.u('uEnthuellt'), 2); gl.uniform1f(pr.u('uPuls'), .22); gl.uniform1f(pr.u('uAnteil'), .25); gl.uniform1f(pr.u('uGrund'), .26);
      gl.drawArrays(gl.LINES, 0, B.kantenN);
      // Linien der Formationen in der Nähe des Zustands (bauen sich von links auf).
      for (let i = 0; i < n; i++) {
        const L = B.linien[i]; if (!L) continue;
        const w = K.sanft((1 - Math.abs(T - i)) * 1.6); if (w <= .002) continue;
        binde(pr, 'aPos', L.b, 3, 6, 0); binde(pr, 'aDaten', L.b, 3, 6, 3);
        gl.uniform1f(pr.u('uGewicht'), w); gl.uniform1f(pr.u('uEnthuellt'), w * 1.1); gl.uniform1f(pr.u('uPuls'), .3); gl.uniform1f(pr.u('uAnteil'), 1); gl.uniform1f(pr.u('uGrund'), handy ? .85 : .7);
        gl.drawArrays(gl.LINES, 0, L.n);
      }
      // Lichtfäden entlang des Pfads.
      pr = PR.faeden; nutze(pr, g);
      const nah = kam.wert('nah') * kam.D, hell = kam.wert('faeden');
      binde(pr, 'aFaden', B.faeden, 3, 3, 0); gl.uniform1f(pr.u('uGrund'), (handy ? 1.1 : .85) * hell); gl.uniform2f(pr.u('uNah'), nah * .7 + 1.5, nah + 7);
      gl.drawArrays(gl.LINES, 0, B.faedenN);
      // Staub, der entlang der Fäden fließt.
      pr = PR.staub; nutze(pr, g);
      binde(pr, 'aStaub', B.staub, 3, 3, 0); gl.uniform2f(pr.u('uBereich'), welt.von, welt.bis - welt.von);
      gl.uniform2f(pr.u('uNah'), nah * .7 + 1, nah + 5); gl.uniform1f(pr.u('uGrund'), .15 + .85 * hell);
      gl.drawArrays(gl.POINTS, 0, B.staubN);
      // Neuronen (statisch) und die Teilchen der Formationen.
      pr = PR.punkte; nutze(pr, g);
      binde(pr, 'aVon', B.netz, 4, 4, 0); binde(pr, 'aNach', B.netz, 4, 4, 0); binde(pr, 'aSaat', B.netzSaat, 4, 4, 0);
      gl.uniform1f(pr.u('uMix'), 0); gl.uniform1f(pr.u('uFunkeln'), .45); gl.uniform1f(pr.u('uGewicht'), .9);
      gl.drawArrays(gl.POINTS, 0, B.netzN);
      binde(pr, 'aVon', B.formationen[k], 4, 4, 0); binde(pr, 'aNach', B.formationen[k + 1], 4, 4, 0); binde(pr, 'aSaat', B.saat, 4, 4, 0);
      gl.uniform1f(pr.u('uMix'), u); gl.uniform1f(pr.u('uFunkeln'), Z[k].funkeln + (Z[k + 1].funkeln - Z[k].funkeln) * u); gl.uniform1f(pr.u('uGewicht'), 1);
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
    }
    function start() { if (laeuft || document.hidden) return; laeuft = true; letzte = 0; requestAnimationFrame(bild); }
    function halt() { laeuft = false; }
    document.addEventListener('visibilitychange', () => document.hidden ? halt() : start());
    leinwand.addEventListener('webglcontextlost', e => { e.preventDefault(); halt(); aus(); });
    start();
    return true;
  }
})();
