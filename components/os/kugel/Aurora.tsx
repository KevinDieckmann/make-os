'use client';

// ─── MAKE OS — Aurora im ZOE-Empfang (05.10.2026, Vorlage „Solaris“) ─────────
// Ein ruhiger Schleier aus Rauschen (fBm) in Granat und Smaragd NUR in den Ecken — die Mitte bleibt frei für die Kugel.
// Gerechnet in sehr kleiner Auflösung (⅙ der Kantenlänge, weich hochgezogen), 20 Bilder je Sekunde, pausiert außer Sicht
// und im Hintergrund; „Bewegung reduzieren“ = ein Standbild; ohne WebGL einfach nichts (der Hof aus CSS bleibt).
// Farben nur aus den Token (KUGEL). Dekorativ: aria-hidden.

import { useEffect, useRef } from 'react';
import { KUGEL } from '@/lib/make-one/design';
import { alsRgb } from './geometrie';
import { useRuhig } from './Kugel';

const ECKEN = 'attribute vec2 aEcke;varying vec2 vUv;void main(){vUv=aEcke*.5+.5;gl_Position=vec4(aEcke,0.,1.);}';
const FLAECHE = `precision mediump float;
uniform vec2 uAufl;uniform float uZeit;uniform vec3 uA;uniform vec3 uB;uniform float uStaerke;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p=mat2(1.6,1.2,-1.2,1.6)*p+.37;a*=.5;}return s;}
void main(){
  vec2 q=vUv*2.-1.;vec2 p=q;p.x*=uAufl.x/uAufl.y;
  float rand=smoothstep(.9,1.5,length(q));
  float t=uZeit*.035;
  float m=fbm(p*1.25+vec2(t,-t*.7));
  float k=fbm(p*2.1-vec2(t*.6,t)+m);
  float schleier=rand*smoothstep(.3,.85,m*.75+k*.45);
  float ton=smoothstep(-.6,.6,q.y*.7+(k-.5)*1.2);
  vec3 c=mix(uA,uB,ton)*schleier*uStaerke;
  gl_FragColor=vec4(c,max(c.r,max(c.g,c.b)));
}`;

/** Anteil der Kantenlänge, in dem gerechnet wird (weich hochgezogen — der Schleier hat keine Kanten). */
export const AURORA_AUFLOESUNG = 1 / 6;
const AURORA_FPS = 20;

export function Aurora({ staerke = 0.24 }: { staerke?: number }) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const ruhig = useRuhig();

  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    const gl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' }) as WebGLRenderingContext | null;
    if (!gl) return;
    const sh = (art: number, q: string) => { const s = gl.createShader(art)!; gl.shaderSource(s, q); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, ECKEN), f = sh(gl.FRAGMENT_SHADER, FLAECHE);
    if (!v || !f) return;
    const p = gl.createProgram()!;
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return;
    gl.useProgram(p);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'aEcke');
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(p, n);
    gl.uniform3fv(u('uA'), alsRgb(KUGEL.smaragd)); gl.uniform3fv(u('uB'), alsRgb(KUGEL.granat)); gl.uniform1f(u('uStaerke'), staerke);
    const uAufl = u('uAufl'), uZeit = u('uZeit');
    const start = performance.now() - Math.random() * 60_000;
    let bild = 0, laeuft = false, imBild = true, naechstes = 0;
    const zeichne = (jetzt: number) => {
      const r = c.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width * AURORA_AUFLOESUNG)), h = Math.max(2, Math.round(r.height * AURORA_AUFLOESUNG));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uAufl, w, h); gl.uniform1f(uZeit, (jetzt - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const schritt = (jetzt: number) => {
      bild = 0;
      if (!laeuft) return;
      if (jetzt >= naechstes - 1) { zeichne(jetzt); naechstes = Math.max(naechstes + 1000 / AURORA_FPS, jetzt); }
      bild = requestAnimationFrame(schritt);
    };
    const an = () => { if (ruhig) { zeichne(performance.now()); return; } if (laeuft || !imBild || document.hidden) return; laeuft = true; bild = requestAnimationFrame(schritt); };
    const aus = () => { laeuft = false; if (bild) cancelAnimationFrame(bild); bild = 0; };
    const io = new IntersectionObserver(e => { imBild = e.some(x => x.isIntersecting); if (imBild) an(); else aus(); });
    io.observe(c);
    const sicht = () => (document.hidden ? aus() : an());
    document.addEventListener('visibilitychange', sicht);
    an();
    return () => {
      aus(); io.disconnect(); document.removeEventListener('visibilitychange', sicht);
      gl.deleteBuffer(b); gl.deleteProgram(p);
      setTimeout(() => { if (!c.isConnected) gl.getExtension('WEBGL_lose_context')?.loseContext(); }, 0);
    };
  }, [ruhig, staerke]);

  return <canvas ref={leinwand} aria-hidden="true" data-aurora="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, filter: 'blur(18px)' }} />;
}
