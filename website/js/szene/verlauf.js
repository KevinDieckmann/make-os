// MAKE Innovation · Szene — Verlauf: ruhiger Mesh-Gradient (04.10.2026)
// Ein kleiner WebGL-1-Shader auf einer eigenen Leinwand: tiefes Anthrazit, darin sehr dezente Lichter in Granat und Smaragd, die
// langsam wandern und der Maus leicht folgen. Auflösung 1 (CSS-Pixel, weich genug), höchstens `fps` Bilder pro Sekunde (Standard
// 36) und nur, solange die Leinwand zu sehen ist. Wiederverwendbar (Inhalte kennt er nicht): MakeSzene.verlauf.erstellen(canvas, opt)
//   opt.staerke   Helligkeit der Lichter (Standard .26 — dezent; 0 = nur Anthrazit)
//   opt.fps       Bildrate (Standard 36)
//   opt.lage      [x, y] Mitte der Lichter (0…1, Standard [.5, .5])
// Liest nichts, speichert nichts, sendet nichts.
(function (wurzel) {
  'use strict';
  const S = wurzel.MakeSzene = wurzel.MakeSzene || {};
  // Farben linear wie die Szene (js/szene/formationen.js › PALETTE): Granat, Smaragd; Grund = Anthrazit nahe --grund.
  const FS = `precision mediump float;varying vec2 v;uniform float t;uniform vec2 m;uniform vec2 g;uniform float st;uniform vec2 l;
const vec3 G=vec3(.79,.27,.36);const vec3 S=vec3(.18,.66,.47);
float f(vec2 p,vec2 c,float r){vec2 d=p-c;return exp(-dot(d,d)/(r*r));}
void main(){float a=g.x/g.y;vec2 p=vec2(v.x*a,v.y);vec2 o=vec2((l.x-.5)*a,l.y-.5);
vec2 c1=vec2(a*(.22+.06*sin(t*.07))+m.x*.05,.30+.06*cos(t*.09)+m.y*.04)+o;
vec2 c2=vec2(a*(.80+.05*cos(t*.06))-m.x*.04,.72+.06*sin(t*.08)-m.y*.03)+o;
vec2 c3=vec2(a*(.58+.08*sin(t*.05+1.)),.12+.05*sin(t*.1+2.))+o;
vec3 c=mix(vec3(.030,.036,.041),vec3(.052,.058,.064),v.y);
c+=st*(G*.55*f(p,c1,.5)+S*.5*f(p,c2,.55)+S*.18*f(p,c3,.32));
float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);c+=(n-.5)/255.*2.;
c*=.82+.18*smoothstep(1.25,.25,length((v-.5)*vec2(1.,1.1)));gl_FragColor=vec4(c,1.);}`;

  function erstellen(canvas, opt) {
    const o = Object.assign({ staerke: .26, fps: 36, lage: [.5, .5] }, opt || {});
    let gl = null;
    try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    const prog = gl.createProgram();
    for (const [art, q] of [[gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}'], [gl.FRAGMENT_SHADER, FS]]) {
      const sh = gl.createShader(art); gl.shaderSource(sh, q); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n), uT = u('t'), uM = u('m'), uG = u('g'), uS = u('st'), uL = u('l');
    let b = 1, h = 1, an = true, letzte = -1, sichtbar = true, noetig = true;
    // Nur zeichnen, wenn die Leinwand im Bild ist (IntersectionObserver; ohne ihn immer).
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { sichtbar = e[e.length - 1].isIntersecting; }).observe(canvas);
    return {
      /** Größe = CSS-Größe der Leinwand (Auflösung 1). */
      groesse() {
        b = Math.max(1, Math.round(canvas.clientWidth)); h = Math.max(1, Math.round(canvas.clientHeight));
        if (canvas.width !== b || canvas.height !== h) { canvas.width = b; canvas.height = h; letzte = -1; }
      },
      /** zeichnet höchstens fps-mal pro Sekunde; zeit in s, maus { x, y } in −1…1. */
      zeichnen(zeit, maus) {
        if (!an || !noetig || !sichtbar || document.hidden || canvas.offsetParent === null) return;
        if (letzte >= 0 && zeit - letzte < 1 / o.fps) return;
        letzte = zeit;
        gl.viewport(0, 0, b, h); gl.uniform1f(uT, zeit); gl.uniform2f(uM, maus ? maus.x : 0, maus ? maus.y : 0); gl.uniform2f(uG, b, h);
        gl.uniform1f(uS, o.staerke); gl.uniform2f(uL, o.lage[0], o.lage[1]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      /** Die Seite sagt, ob der Verlauf gerade zu sehen ist (z. B. nur in seiner Phase des Showreels). */
      gebraucht(ja) { noetig = !!ja; },
      halt() { an = false; },
    };
  }
  S.verlauf = { erstellen };
})(typeof window !== 'undefined' ? window : globalThis);
