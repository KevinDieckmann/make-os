// ─── MAKE OS — Kugel: Shader (WebGL 1, 05.10.2026) ──────────────────────────
// Eigene, schlanke Shader statt three.js (nicht im Projekt; CSP und Bündelgröße). Ein Punkt je Datensatz bzw. je
// Wolkenpunkt, additiv. Alles, was sich bewegt, rechnet die Grafikkarte: Atmen (Simplex-Rauschen, zwei Oktaven,
// entlang der Normale), Zeiger-Ausbruch (Punkte nahe dem Zeiger schieben nach außen, flackern, werden heller und glühen
// Richtung `uGlut`), Fresnel-Rand mit hohler dunkler Mitte (edgeFade = smoothstep(0.4, 0.9, rim) wie in der Vorlage),
// Einstieg (gefüllt → Ring, Kamera fährt zurück, die Wolke blüht auf). Farben kommen als Uniform/Attribut aus den Token.
//
// Simplex-Rauschen 3D: Ashima Arts / Stefan Gustavson (MIT-Lizenz, github.com/ashima/webgl-noise) — unverändert.

const RAUSCHEN = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 nrm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nrm.x;p1*=nrm.y;p2*=nrm.z;p3*=nrm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

/** Attribute: aPos (Einheitsvektor), aFarbe (rgb, Brain), aWert (x Größe · y Helligkeit · z Saat · w Verlaufskoordinate). */
export const ECKEN_SHADER = `
precision highp float;
attribute vec3 aPos;
attribute vec3 aFarbe;
attribute vec4 aWert;
uniform mat4 uProj;
uniform mat4 uDreh;
uniform float uAbstand;
uniform float uPhase;
uniform float uUhr;
uniform float uAtem;
uniform float uWeite;
uniform float uVerschiebung;
uniform float uHell;
uniform float uVerlauf;
uniform vec3 uFarbeA;
uniform vec3 uFarbeB;
uniform vec3 uGlut;
uniform vec3 uZeiger;
uniform float uZeigerKraft;
uniform float uZeigerRadius;
uniform float uFlare;
uniform float uSicht;
uniform float uHohl;
uniform float uNaeher;
uniform float uPunktPx;
uniform float uGrund;
varying vec3 vFarbe;
varying float vAlpha;
${RAUSCHEN}
void main(){
  vec3 n = aPos;
  // Atmen: zwei Oktaven Simplex entlang der Normale.
  float r = snoise(n * 1.5 + vec3(0.0, uPhase * 0.22, uPhase * 0.1)) * 0.65 + snoise(n * 3.1 - vec3(uPhase * 0.31)) * 0.35;
  // Ausbruch unter dem Zeiger: Reichweite uZeigerRadius, flackert wie Plasma (eigene Phase je Punkt).
  float e = smoothstep(uZeigerRadius, 0.0, distance(n, uZeiger)) * uZeigerKraft;
  float flacker = 0.6 + 0.4 * sin(uUhr * 9.0 + aWert.z * 61.0);
  float aus = 1.0 + uWeite + r * uAtem + e * uFlare * flacker;
  vec3 welt = (uDreh * vec4(n * aus, 1.0)).xyz;
  vec3 nWelt = (uDreh * vec4(n, 0.0)).xyz;
  float abstand = uAbstand * (1.0 - 0.38 * uNaeher);
  vec3 sicht = welt - vec3(0.0, 0.0, abstand);
  gl_Position = uProj * vec4(sicht, 1.0);
  vec3 blick = normalize(-sicht);
  float zu = dot(nWelt, blick);
  // Fresnel: der Rand leuchtet, die Mitte bleibt dunkel (erst nach dem Einstieg — vorher ist die Kugel gefüllt).
  float rand = smoothstep(0.4, 0.9, 1.0 - abs(zu));
  float mitte = mix(1.0, mix(uGrund, 1.0, rand), uHohl);
  float hinten = mix(0.35, 1.0, smoothstep(-0.35, 0.25, zu));
  float t = clamp(aWert.w + uVerschiebung, 0.0, 1.0);
  vec3 verlauf = mix(uFarbeA, uFarbeB, smoothstep(0.0, 1.0, t));
  vec3 f = mix(aFarbe, verlauf, uVerlauf);
  vFarbe = mix(f, uGlut, clamp(e * flacker * 0.6, 0.0, 0.85));
  vAlpha = uSicht * mitte * hinten * aWert.y * uHell * (1.0 + e * 0.8);
  gl_PointSize = max(1.0, uPunktPx * aWert.x * (1.0 + e * 1.3) * (uAbstand / max(0.1, -sicht.z)) * mix(0.6, 1.0, uSicht));
}
`;

export const FLAECHEN_SHADER = `
precision mediump float;
varying vec3 vFarbe;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float w = exp(-r2 * 3.2) * (1.0 - r2);
  float a = clamp(vAlpha, 0.0, 1.5) * w;
  gl_FragColor = vec4(vFarbe * a, a);
}
`;

/** Namen der Uniforms — eine Liste, damit Motor und Prüfung dieselben kennen. */
export const UNIFORMS = [
  'uProj', 'uDreh', 'uAbstand', 'uPhase', 'uUhr', 'uAtem', 'uWeite', 'uVerschiebung', 'uHell', 'uVerlauf', 'uFarbeA', 'uFarbeB', 'uGlut',
  'uZeiger', 'uZeigerKraft', 'uZeigerRadius', 'uFlare', 'uSicht', 'uHohl', 'uNaeher', 'uPunktPx', 'uGrund',
] as const;
export type UniformName = typeof UNIFORMS[number];
