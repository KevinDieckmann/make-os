// ─── MAKE OS — Kugel: Shader (WebGL 1, 05.10.2026 · Überarbeitung „Solaris“) ─
// Eigene, schlanke Shader statt three.js. Drei Programme:
//   1. PUNKTE  — die Wolke, additiv. Atmen (Simplex, zwei Oktaven, entlang der Normale), Wirbel (Denken), Puls (Sprechen),
//      Zeiger-Ausbruch (Punkte schießen hinaus, flackern, glühen Richtung `uGlut`), Fresnel-Ring mit heller Kante und hohler
//      dunkler Mitte (edgeFade = smoothstep(0.4, 0.9, rim) wie in der Vorlage), weißglühende Spitzen, Einstieg. Brain: Sterne
//      (helle Datensätze mit Halo) in einer dunklen Partikel-Hülle — `vStern` unterscheidet sie.
//   2. WEICH   — trennbarer Gauß (9 Abgriffe) für das Glühen (Bloom) in kleiner Auflösung.
//   3. MISCH   — legt das Glühen additiv über die Kugel (nur dort, wo Punkte sind — kein Matsch).
// Farben kommen als Uniform/Attribut aus den Token (lib/make-one/design.ts › KUGEL), nie als Literal.
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

/**
 * Attribute: aPos (Ort; Einheitsvektor bzw. bei der Hülle im Inneren < 1), aFarbe (rgb, Brain), aWert (x Größe · y Helligkeit ·
 * z Saat · w Verlaufskoordinate (ZOE) bzw. Stern 0/1 (Brain)).
 */
export const ECKEN_SHADER = `
precision highp float;
attribute vec3 aPos;
attribute vec3 aFarbe;
attribute vec4 aWert;
uniform mat4 uProj;
uniform mat4 uDreh;
uniform float uAbstand;
uniform float uBezug;
uniform float uPhase;
uniform float uUhr;
uniform float uAtem;
uniform float uWeite;
uniform float uVerschiebung;
uniform float uHell;
uniform float uWirbel;
uniform float uPuls;
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
uniform float uPunktPx;
uniform float uGrund;
uniform float uTiefe;
uniform float uMaske;
varying vec3 vFarbe;
varying float vAlpha;
varying float vStern;
${RAUSCHEN}
void main(){
  float lang = length(aPos);
  vec3 n = aPos / max(lang, 1e-4);
  // Denken: wirbelnde Wärme — ein langsamer Drall um die Hochachse, je Höhe verschieden (ruhig, nie hektisch).
  float dreh = uWirbel * (sin(n.y * 3.1 + uPhase * 0.9) * 0.55 + snoise(n * 1.3 + uPhase * 0.25) * 0.45);
  float cd = cos(dreh), sd = sin(dreh);
  n = vec3(n.x * cd + n.z * sd, n.y, -n.x * sd + n.z * cd);
  // Atmen: zwei Oktaven Simplex entlang der Normale.
  float r = snoise(n * 1.5 + vec3(0.0, uPhase * 0.22, uPhase * 0.1)) * 0.65 + snoise(n * 3.1 - vec3(uPhase * 0.31)) * 0.35;
  // Ausbruch unter dem Zeiger: Reichweite uZeigerRadius, flackert wie Plasma (eigene Phase je Punkt).
  float e = smoothstep(uZeigerRadius, 0.0, distance(n, uZeiger)) * uZeigerKraft;
  float flacker = 0.55 + 0.45 * sin(uUhr * 11.0 + aWert.z * 61.0);
  float puls = uPuls * sin(uUhr * 5.4);
  float aus = (1.0 + uWeite + puls + r * uAtem) * lang + e * uFlare * (0.4 + 0.6 * flacker) * (0.6 + aWert.z * 0.8);
  vec3 welt = (uDreh * vec4(n * aus, 1.0)).xyz;
  vec3 nWelt = (uDreh * vec4(n, 0.0)).xyz;
  vec3 sicht = welt - vec3(0.0, 0.0, uAbstand);
  gl_Position = uProj * vec4(sicht, 1.0);
  vec3 blick = normalize(-sicht);
  float zu = dot(nWelt, blick);
  // Fresnel: der Rand leuchtet, die Mitte bleibt dunkel (erst nach dem Einstieg — vorher ist die Kugel gefüllt).
  float rim = 1.0 - abs(zu);
  float rand = smoothstep(0.4, 0.9, rim);
  // Ring: die Kante leuchtet heller als die gefüllte Kugel; der Ausbruch hebt die hohle Mitte an der Stelle auf.
  float mitte = max(mix(1.0, mix(uGrund, 1.0, rand) * (1.0 + rand * 0.7), uHohl), e * 0.9);
  float hinten = mix(1.0 - uTiefe, 1.0, smoothstep(-0.35, 0.3, zu));
  float t = clamp(aWert.w + uVerschiebung, 0.0, 1.0);
  vec3 verlauf = mix(uFarbeA, uFarbeB, smoothstep(0.08, 0.92, t));
  vec3 f = mix(aFarbe, verlauf, uVerlauf);
  // Weißglühende Spitzen: wo das Atmen am weitesten ausschlägt und an der Kante.
  float spitze = smoothstep(0.35, 0.95, r) * uVerlauf * 0.45 + rand * rand * rand * 0.28 * uVerlauf;
  float glut = clamp(spitze + e * flacker * 0.75, 0.0, 0.9);
  vFarbe = mix(f, uGlut, glut);
  vStern = (1.0 - uVerlauf) * aWert.w;
  vAlpha = uSicht * (mitte * hinten * aWert.y * uHell * (1.0 + e * 1.6) + e * flacker * 0.55) * mix(1.0, step(0.5, aWert.w), uMaske);
  gl_PointSize = max(1.0, uPunktPx * aWert.x * (1.0 + e * 1.6) * (uBezug / max(0.1, -sicht.z)) * mix(0.55, 1.0, uSicht));
}
`;

export const FLAECHEN_SHADER = `
precision mediump float;
varying vec3 vFarbe;
varying float vAlpha;
varying float vStern;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  // Feines Korn (Wolke) bzw. Stern mit hellem Kern und weichem Halo (Datensatz im Brain).
  float korn = exp(-r2 * 5.0) * (1.0 - r2);
  float stern = exp(-r2 * 26.0) * 1.6 + exp(-r2 * 3.2) * 0.42 * (1.0 - r2);
  float w = mix(korn, stern, vStern);
  float a = clamp(vAlpha, 0.0, 2.0) * w;
  vec3 kern = mix(vFarbe, vec3(1.0), vStern * exp(-r2 * 40.0) * 0.55);
  gl_FragColor = vec4(kern * a, min(a, 1.0));
}
`;

/** Bildschirmfüllendes Dreieck (Weich- und Misch-Durchgang). */
export const FLAECHE_ECKEN = `
attribute vec2 aEcke;
varying vec2 vUv;
void main(){ vUv = aEcke * 0.5 + 0.5; gl_Position = vec4(aEcke, 0.0, 1.0); }
`;

/** Trennbarer Gauß mit 9 Abgriffen; `uSchritt` = Texel-Abstand × Richtung × Weite. */
export const WEICH_SHADER = `
precision mediump float;
uniform sampler2D uBild;
uniform vec2 uSchritt;
varying vec2 vUv;
void main(){
  vec4 s = texture2D(uBild, vUv) * 0.2270270270;
  s += (texture2D(uBild, vUv + uSchritt * 1.3846153846) + texture2D(uBild, vUv - uSchritt * 1.3846153846)) * 0.3162162162;
  s += (texture2D(uBild, vUv + uSchritt * 3.2307692308) + texture2D(uBild, vUv - uSchritt * 3.2307692308)) * 0.0702702703;
  gl_FragColor = s;
}
`;

/** Glühen additiv über die Kugel; `uStaerke` 0 = aus. */
export const MISCH_SHADER = `
precision mediump float;
uniform sampler2D uBild;
uniform float uStaerke;
varying vec2 vUv;
void main(){
  // Zum Rand der Leinwand weich auslaufen — sonst zeichnet das Glühen ein Rechteck.
  float kante = smoothstep(0.0, 0.14, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  vec3 c = texture2D(uBild, vUv).rgb * uStaerke * kante;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}
`;

/** Namen der Uniforms der Punkte — eine Liste, damit Motor und Prüfung dieselben kennen. */
export const UNIFORMS = [
  'uProj', 'uDreh', 'uAbstand', 'uBezug', 'uPhase', 'uUhr', 'uAtem', 'uWeite', 'uVerschiebung', 'uHell', 'uWirbel', 'uPuls', 'uVerlauf',
  'uFarbeA', 'uFarbeB', 'uGlut', 'uZeiger', 'uZeigerKraft', 'uZeigerRadius', 'uFlare', 'uSicht', 'uHohl', 'uPunktPx', 'uGrund', 'uTiefe', 'uMaske',
] as const;
export type UniformName = typeof UNIFORMS[number];
