// MAKE Innovation · die Szene der Startseite: vom Lärm zum Durchbruch (fünfte Fassung 10.11.2026, Kevin: „mehr, alles im Fluss,
// Durchbruch mit mehr Wucht, Endbild anders“).
// 1 Lärm: Punkte und Striche treiben in der Tiefe · 2 Fokus: sie schießen als Lichtstriche in den Kern, der aufleuchtet ·
// 3 Lücke: eine Wand wächst mit leuchtenden Kanten · 4 Momentum: die Spur wird zu Lichtfäden, Licht strömt in den Kern, er nimmt Fahrt auf ·
// 5 Durchbruch: er drückt gegen die Wand, sie reißt, ein Knall (Blitz, Welle, Splitter), er geht hindurch und kommt im Logo an ·
// Ende: das fertige Zeichen gleitet an seinen Platz im Endbild und lebt leise weiter (Puls, ein Licht je Schlag die Spur entlang).
// Eigenes WebGL, keine Bibliothek, keine Bilder. Farben aus den CSS-Variablen; Maße aus dem Logo (Raster 48, Mitte des Zeichens bei
// 21,7 | 24 = Nullpunkt der Szene). Im Ziel (Kern bei 8,8, ohne Glut und Risse) ist das Bild genau das Logo.

const FLAECHE_VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

// Grund, Wand, Spur und Kern. Gerechnet wird in Zeichen-Einheiten (1 = ein Kästchen des Logo-Rasters, y nach oben):
// Kern r 10,2 · Wand x −3,7 … 3,3, y ±18, Ecken 0,8, Öffnung r 12,8 um den Kern · Spur drei Striche (Stärke 2,6, runde Enden)
// bei y +5,5 | 0 | −5,5, Länge 8,5 | 10,5 | 6,5, Ende 16 hinter der Mitte des Kerns.
const FLAECHE_FS = `
precision highp float;
uniform vec2 uRes, uC, uKS;
uniform float uZeit, uR, uKern, uKX, uCam, uWand, uSpurA, uStreck, uPuls, uWeite, uBluete, uImpuls;
uniform float uEnergie, uRiss, uBeule, uGlut, uLoch, uKnall, uTempo, uFaden, uFahrt, uRuhe, uTiefe;
uniform vec3 uAkzent, uKernF, uHell, uNacht;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float kasten(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float strich(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
// Risse: Abstand zur nächsten Zellkante eines Voronoi-Netzes (0 = auf dem Riss)
float risse(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + hash2(i + g) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
// Ein Licht, das einen Strich entlang zum Kern läuft: hell an der Spitze, dahinter ein kurzer Schweif
float lichtLauf(float entlang, float phase) {
  float d = phase - entlang;
  return exp(-max(d, 0.0) * 6.0) * smoothstep(-0.09, 0.0, d) * smoothstep(0.0, 0.12, phase);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 q = vec2((uv.x - 0.5) * asp, uv.y);
  float k = uR / 16.0;
  float px = 1.25 / uRes.y;
  float pw = px / k;
  vec2 w = (q - uC) / k + vec2(uCam, 0.0);

  // Der Knall (nur in den ersten Sekunden nach dem Bruch): eine Stoßwelle läuft von der Bruchstelle aus und verbiegt kurz den Raum
  vec2 stoss = vec2(-3.7, 0.0);
  float welle2 = 0.0, blitz = 0.0;
  if (uKnall >= 0.0 && uKnall < 2.5) {
    vec2 dv = w - stoss;
    float dl = length(dv * vec2(1.0, 0.85));
    float rad = 2.0 + 78.0 * (1.0 - exp(-uKnall * 2.1));
    float dicke = 1.4 + rad * 0.07;
    float wq = (dl - rad) / dicke;
    welle2 = exp(-wq * wq) * exp(-uKnall * 1.8);
    w -= normalize(dv + 0.0001) * welle2 * 1.6;
    blitz = exp(-uKnall * 6.5);
  }

  vec2 kp = vec2(uKX, 0.0);
  vec2 ks = uC + (kp - vec2(uCam, 0.0)) * k;
  vec2 r = q - ks;
  float lr = length(r);

  vec3 col = uNacht;
  col += uKernF * 0.035 * exp(-lr / (uR * 3.0)) * uKern;

  // Puls des Kerns: ein kurzer Schlag alle 2,8 s, langsames Ausatmen, dazu eine leise Welle; uPuls = 0 im Standbild
  float takt = fract(uZeit / 2.8);
  float schlag = max(smoothstep(0.0, 0.1, takt) * (1.0 - smoothstep(0.1, 0.75, takt)) * uPuls, uImpuls);
  float kernW = 10.2 * uKern * (1.0 + 0.05 * schlag);
  float kernR = kernW * k;

  // Der Raum: ein großer, weicher Farbschein hinter dem Kern, dunkle Ränder, eine dunklere Masse oben links. Im Lärm kühl und
  // unruhig, mit dem Fokus violett auf den Kern gezogen, beim Durchbruch weit (uWeite).
  vec2 drift = vec2(sin(uZeit * 0.071), cos(uZeit * 0.053)) * uR * 0.55 * (1.0 - 0.8 * uKern);
  vec2 ra = (r - drift) * vec2(0.74, 1.0);
  float weite = uR * 3.1 * uWeite * (1.0 + 0.04 * schlag) * mix(0.3, 1.0, uBluete);
  float raum = exp(-dot(ra, ra) / (weite * weite));
  vec3 kuehl = vec3(0.075, 0.09, 0.27);
  vec3 violett = mix(kuehl, uKernF * 0.36, 0.6);
  col += mix(kuehl, violett, uKern) * raum * (0.62 + 0.18 * uKern) * uBluete * (1.0 + 0.22 * uImpuls + 0.35 * uGlut);
  vec2 masse = q - (uC + vec2(-uR * 2.3, uR * 1.3));
  col *= 1.0 - 0.3 * exp(-dot(masse, masse) / (uR * uR * 2.0));
  // Energie: der Kern strahlt, je mehr Fahrt er hat (nah kräftig, weit leise)
  float aussen = max(lr - kernR, 0.0);
  col += uKernF * (0.05 + 0.09 * schlag + 0.16 * uEnergie) * exp(-aussen / (uR * 0.34)) * uKern;
  col += mix(uKernF, uAkzent, 0.5) * 0.07 * uEnergie * exp(-aussen / (uR * 1.5)) * uKern;
  float welleT = clamp((takt - 0.04) / 0.9, 0.0, 1.0);
  float welleR = mix(kernR, uR * 1.15, 1.0 - (1.0 - welleT) * (1.0 - welleT));
  float wAbst = (lr - welleR) / (uR * 0.055);
  float welle = exp(-wAbst * wAbst) * pow(1.0 - welleT, 3.0) * step(0.001, welleT) * uKern * uPuls;
  col += mix(uAkzent, vec3(1.0), 0.2) * welle * 0.16;

  // Fahrt: feine Lichtstriche ziehen am Rand vorbei nach links (nur solange Tempo da ist, nicht hinter den Worten unten)
  if (uTempo > 0.01) {
    float zeilen = 44.0;
    float zy = floor(uv.y * zeilen);
    float hz = hash(vec2(zy, 3.1));
    if (hz > 0.5) {
      float s = fract(uv.x * 1.7 + hz * 13.0 + uFahrt * (0.9 + 1.2 * hz));
      float lang = 0.07 + 0.14 * hash(vec2(zy, 9.7));
      float form = step(s, lang) * (1.0 - s / lang);
      float dick = 1.0 - smoothstep(0.03, 0.11, abs(fract(uv.y * zeilen) - 0.5));
      float nahKern = 1.0 - exp(-lr / (uR * 1.3));
      col += mix(uAkzent, uHell, 0.35) * form * form * dick * uTempo * 0.16 * smoothstep(0.1, 0.32, uv.y) * nahKern;
    }
  }

  // Schein an der Öffnung, solange sie glüht
  vec2 oeff = (q - (uC + (vec2(-0.2, 0.0) - vec2(uCam, 0.0)) * k)) * vec2(1.0, 0.7);
  col += uKernF * 0.4 * uGlut * exp(-length(oeff) / (uR * 0.6));

  // Die Wand: wächst aus der Mitte mit leuchtenden Kanten, biegt sich, wo der Kern drückt, reißt und bricht auf.
  // Nach dem Bruch umgibt die Öffnung den Kern (im Ziel 12,8 um ihn, wie im Logo).
  if (uWand > 0.001) {
    float hoehe = 18.0 * uWand;
    vec2 wp = w - vec2(-0.2, 0.0);
    wp.x -= uBeule * exp(-w.y * w.y / 200.0);
    float wd0 = kasten(wp, vec2(3.5, hoehe), min(0.8, hoehe));
    float lochD = length(w - kp) - uLoch;
    float wd = uLoch > 0.0 ? max(wd0, -lochD) : wd0;
    float innen = smoothstep(pw, -pw, wd);
    // Die Wand steht im Raum: weicher Schatten auf dem Grund
    col *= 1.0 - 0.28 * exp(-max(wd, 0.0) / 2.2) * (1.0 - innen);
    // Leiser Schein um die Wand, wenn sie unter Druck steht oder glüht
    col += uAkzent * (0.22 * uRiss + 0.45 * uGlut) * exp(-max(wd, 0.0) / 1.8);
    // Material: oben etwas heller, zum Kern hin violett angestrahlt
    vec3 wf = uHell * (0.84 + 0.16 * smoothstep(-18.0, 18.0, w.y));
    float licht = exp(-max(length(w - kp) - 10.2, 0.0) / 7.0) * uKern;
    wf = mix(wf, mix(uHell, uAkzent, 0.7), 0.26 * licht * uTiefe);
    // Kanten: zum Kern hin hell und violett angestrahlt, abgewandt etwas dunkler; ein leiser Glanzstreifen
    float nahRand = smoothstep(-1.0, -0.05, abs(wp.x) - 3.5) * smoothstep(-0.2, -1.4, abs(wp.y) - hoehe);
    float links = smoothstep(0.8, -0.8, wp.x);
    wf += mix(vec3(1.0), uAkzent, 0.35 + 0.4 * licht) * nahRand * links * (0.07 + 0.12 * licht) * uTiefe;
    wf *= 1.0 - 0.1 * nahRand * (1.0 - links) * uTiefe;
    float glanzX = (wp.x + 1.3) / 0.8;
    wf += 0.045 * exp(-glanzX * glanzX) * uTiefe;
    // Fassung um die Öffnung: der Kern sitzt in der Wand
    if (uLoch > 0.0) wf *= 1.0 - 0.16 * exp(-max(lochD, 0.0) / 1.1) * uTiefe;
    if (uRiss > 0.001 && abs(w.x) < 8.0) {
      vec2 rp = w - stoss;
      float rr = length(rp);
      float reich = 3.0 + 20.0 * uRiss;
      // Strahlen: je Sektor ein gezackter Riss mit eigener Länge
      float a = atan(rp.y, rp.x) / 6.2832 * 13.0;
      float sek = floor(a);
      float zack = sin(rr * 1.3 + sek * 4.1) * 0.16 + sin(rr * 3.9 + sek * 2.3) * 0.06;
      float quer = abs(fract(a + zack) - 0.5) * 6.2832 / 13.0 * rr;
      float lang = reich * (0.45 + 0.55 * hash(vec2(sek, 1.7)));
      float strahl = (1.0 - smoothstep(0.08, 0.2 + 0.1 * uGlut, quer)) * (1.0 - smoothstep(lang * 0.7, lang, rr));
      // Mitte: zersplittert
      float e = risse(w * 0.75 + vec2(3.0, 1.0));
      float netz = (1.0 - smoothstep(0.0, 0.06, e)) * (1.0 - smoothstep(1.5, 2.5 + 3.5 * uRiss, rr));
      float riss = max(strahl, netz) * uRiss;
      wf = mix(wf, mix(uAkzent, vec3(1.0), 0.25 + 0.5 * uGlut), riss);
      wf += uAkzent * 0.25 * uRiss * exp(-rr / 2.5);
    }
    col = mix(col, wf, innen);
    // Die Bruchkante glüht
    float rand = exp(-abs(lochD) / 0.7) * smoothstep(0.6, -0.6, wd0) * step(0.001, uLoch);
    col += mix(uAkzent, vec3(1.0), 0.3) * rand * uGlut * 0.9;
    // Beim Wachsen laufen helle Kanten oben und unten mit
    float front = exp(-abs(abs(w.y) - hoehe) / 0.55) * step(abs(wp.x), 3.6) * (1.0 - smoothstep(0.82, 1.0, uWand));
    col += uAkzent * front * 0.85;
  }

  // Die Spur als Lichtfäden: in Fahrt laufen schnelle Lichter zum Kern (uFaden), im Ziel eins je Schlag – es kommt an, wenn der Kern schlägt
  if (uSpurA > 0.001) {
    float ende = uKX - 16.0;
    float l1 = 8.5 * uStreck, l2 = 10.5 * uStreck, l3 = 6.5 * uStreck;
    float s1 = strich(w, vec2(ende - l1, 5.5), vec2(ende, 5.5), 1.3);
    float s2 = strich(w, vec2(ende - l2, 0.0), vec2(ende, 0.0), 1.3);
    float s3 = strich(w, vec2(ende - l3, -5.5), vec2(ende, -5.5), 1.3);
    float sd = min(s1, min(s2, s3));
    float lang = l2, versatz = 0.0;
    if (s1 < s2 && s1 < s3) { lang = l1; versatz = 0.31; } else if (s3 < s2) { lang = l3; versatz = 0.63; }
    float entlang = clamp((w.x - (ende - lang)) / max(lang, 0.01), 0.0, 1.0);
    float puls = lichtLauf(entlang, fract(uFaden + versatz)) * uTempo
               + lichtLauf(entlang, fract(takt - versatz * 0.08)) * uRuhe * uPuls * 0.85;
    col += uAkzent * (0.16 * uTempo * exp(-max(sd, 0.0) / 1.5) + 0.3 * puls * exp(-max(sd, 0.0) / 0.8)) * uSpurA;
    col = mix(col, mix(uAkzent, vec3(1.0), 0.6 * puls), smoothstep(pw, -pw, sd) * uSpurA);
  }

  // Der Kern: Kugel mit Licht von oben links, gestaucht beim Drücken, gestreckt in voller Fahrt
  if (uKern > 0.001) {
    vec2 kd = (w - kp) / (kernW * uKS);
    float kl = length(kd);
    float kante = (kl - 1.0) * kernW * min(uKS.x, uKS.y);
    float a = smoothstep(pw, -pw, kante);
    vec3 n = vec3(kd, sqrt(max(0.0, 1.0 - kl * kl)));
    vec3 L = normalize(vec3(-0.5, 0.6, 0.75));
    float diff = max(dot(n, L), 0.0);
    float glanz = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
    vec3 kf = uKernF * mix(1.0, 0.6 + 0.58 * diff, uTiefe);
    kf += vec3(0.77, 0.71, 0.99) * glanz * 0.3 * uTiefe;
    kf += uAkzent * 0.18 * uEnergie * (1.0 - n.z) * uTiefe;
    kf += mix(uAkzent, vec3(1.0), 0.3) * 0.1 * pow(1.0 - n.z, 3.0) * uTiefe;
    col = mix(col, kf, a);
  }

  // Blitz und Stoßwelle des Knalls
  col += mix(uAkzent, uHell, 0.45) * welle2 * 0.5;
  col += vec3(0.85, 0.8, 1.0) * blitz * (0.22 + 1.1 * exp(-length(w - stoss) / 9.0));

  vec2 vm = mix(vec2(0.5, 0.56), vec2(uC.x / asp + 0.5, uC.y), 0.4);
  float vig = smoothstep(1.35, 0.2, length((uv - vm) * vec2(1.1, 1.0)));
  col *= 0.62 + 0.38 * vig;
  col += (hash(gl_FragCoord.xy + fract(uZeit) * 100.0) - 0.5) * 0.008;
  gl_FragColor = vec4(col, 1.0);
}`;

// Die vielen Punkte: im Lärm treibend (die großen weich wie in der Tiefe), im Fokus schießen sie als Lichtstriche in den Kern,
// im Momentum strömen sie die drei Bahnen der Spur entlang in den Kern.
const PUNKTE_VS = `
attribute vec4 aZufall;
uniform vec2 uRes, uC;
uniform float uZeit, uR, uCam, uKX, uSammeln, uStrom, uStromP, uTempo, uDpr, uSichtbar;
varying float vA, vMisch, vStreck, vWeich, vStrich, vStrom;
varying vec2 vRicht;
vec2 bild(vec2 w) { return uC + (w - vec2(uCam, 0.0)) * (uR / 16.0); }
void main() {
  vec4 s = aZufall;
  float a = uRes.x / uRes.y;
  vec2 kern = bild(vec2(uKX, 0.0));
  // Lärm → Fokus: aus dem Feld auf einer Spirale in den Kern
  vec2 p0 = vec2((s.x - 0.5) * a * 1.1, s.y * 1.08 - 0.04);
  p0 += vec2(sin(uZeit * (0.05 + s.z * 0.08) + s.w * 40.0), cos(uZeit * (0.04 + s.w * 0.07) + s.z * 30.0)) * (0.03 + 0.05 * s.z);
  float start = s.z * 0.45;
  float e = smoothstep(start, start + 0.55, uSammeln);
  vec2 ziel = kern + uR * 0.55 * sqrt(s.w) * vec2(cos(s.y * 6.2832), sin(s.y * 6.2832));
  vec2 pos = mix(p0, ziel, e * e * (3.0 - 2.0 * e));
  float dreh = (1.0 - e) * e * 2.2;
  vec2 d = pos - kern;
  pos = kern + vec2(d.x * cos(dreh) - d.y * sin(dreh), d.x * sin(dreh) + d.y * cos(dreh));
  vec2 richt = normalize(kern - pos + 0.00001);
  float tempoS = clamp(e * (1.0 - e) * 4.0, 0.0, 1.0) * 0.85;
  float unten = mix(0.28, 1.0, smoothstep(0.08, 0.46, p0.y));
  float aS = (0.2 + 0.3 * s.w) * mix(unten, 1.0, e) * (1.0 - smoothstep(0.75, 1.0, e));
  // Momentum: drei Bahnen hinter dem Kern, das Licht strömt hinein
  float bahn = floor(s.z * 3.0);
  float by = 5.5 - 5.5 * bahn + (s.y - 0.5) * 1.8;
  float lauf = fract(s.x + uStromP * (0.7 + 0.6 * s.w));
  vec2 posS = bild(vec2(mix(uKX - 46.0, uKX - 9.5, lauf), by));
  float aStr = (0.3 + 0.45 * s.w) * smoothstep(0.0, 0.22, lauf) * (1.0 - smoothstep(0.8, 1.0, lauf));
  bool strom = uStrom > 0.001;
  pos = strom ? posS : pos;
  vA = (strom ? aStr * uStrom * mix(0.45, 1.0, uTempo) : aS) * uSichtbar;
  vRicht = strom ? vec2(1.0, 0.0) : vec2(richt.x, -richt.y);
  vStreck = strom ? max(uTempo, 0.55) : tempoS;
  vWeich = strom ? 0.0 : smoothstep(0.78, 1.0, s.w) * (1.0 - e);
  vStrich = strom ? 0.0 : step(s.z, 0.28) * (1.0 - smoothstep(0.15, 0.6, e));
  vStrom = strom ? 1.0 : 0.0;
  vMisch = s.z;
  gl_Position = vec4(pos.x * 2.0 / a, pos.y * 2.0 - 1.0, 0.0, 1.0);
  float basis = strom ? 3.0 + 2.0 * s.w : mix(5.0 + 13.0 * s.w * s.w, 3.0, e);
  gl_PointSize = basis * (1.0 + 2.6 * vStreck) * uDpr;
}`;
const PUNKTE_FS = `
precision mediump float;
uniform vec3 uAkzent, uKernF, uHell;
varying float vA, vMisch, vStreck, vWeich, vStrich, vStrom;
varying vec2 vRicht;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  vec2 d = normalize(mix(vRicht, vec2(1.0, 0.0), vStrich) + 0.00001);
  float faktor = 1.0 + 2.6 * vStreck;
  float r = mix(0.32 / faktor, 0.075, vStrich);
  float halb = max(max(0.0, 0.47 - r) * min(1.0, vStreck * 4.0), 0.3 * vStrich) + 0.001;
  float entlang = dot(c, d);
  float quer = dot(c, vec2(-d.y, d.x));
  float abst = length(vec2(max(abs(entlang) - halb, 0.0), quer));
  float form = 1.0 - smoothstep(r * mix(0.6, 0.05, vWeich), r, abst);
  float kopf = mix(1.0, 0.2 + 0.8 * smoothstep(-halb, halb, entlang), min(1.0, vStreck * 3.0));
  float a = form * kopf * vA * mix(1.0, 0.5, vWeich);
  vec3 f = vMisch < 0.28 ? uAkzent : (vMisch > 0.93 ? uKernF : uHell);
  float kopfPos = smoothstep(-halb, halb, entlang);
  vec3 strichF = mix(mix(uAkzent, uKernF, 0.35), vec3(1.0), 0.15 + 0.55 * kopfPos * kopfPos);
  f = mix(f, strichF, max(min(1.0, vStreck * 1.8) * (1.0 - vStrich), vStrom));
  gl_FragColor = vec4(f * a, a);
}`;

// Die Splitter des Knalls: Stücke der Wand (drehend) und violette Funken (Striche in Flugrichtung), nach rechts weg, gebremst, sinkend.
const SPLITTER_VS = `
attribute vec4 aZufall;
uniform vec2 uRes, uC;
uniform float uR, uCam, uT;
varying float vA, vArt, vWinkel, vLang;
varying vec2 vRicht;
void main() {
  vec4 s = aZufall;
  float t = uT;
  vec2 p0 = vec2(-3.7 + 7.0 * s.x * s.x, (s.y - 0.5) * 24.0 * (0.35 + 0.65 * s.w));
  vec2 v = vec2(10.0 + 50.0 * s.x, (s.y - 0.5) * 64.0);
  if (s.z < 0.14) v.x = -(6.0 + 20.0 * s.w);
  float zug = 1.7;
  vec2 w = p0 + v * (1.0 - exp(-zug * t)) / zug + vec2(0.0, -9.0 * t * t);
  vec2 vel = v * exp(-zug * t) + vec2(0.0, -18.0 * t);
  vec2 q = uC + (w - vec2(uCam, 0.0)) * (uR / 16.0);
  float a = uRes.x / uRes.y;
  vArt = step(0.5, s.z);
  vA = exp(-t * 1.4) * (1.0 - smoothstep(1.3, 2.0, t)) * smoothstep(0.0, 0.03, t);
  vWinkel = s.w * 6.2832 + t * (4.0 + 8.0 * s.x) * (s.y > 0.5 ? 1.0 : -1.0);
  vRicht = normalize(vec2(vel.x, -vel.y) + 0.0001);
  vLang = clamp(length(vel) / 55.0, 0.0, 1.0) * vArt;
  gl_Position = vec4(q.x * 2.0 / a, q.y * 2.0 - 1.0, 0.0, 1.0);
  float basis = mix(7.0 + 17.0 * s.w * s.w, 3.5 + 3.5 * s.w, vArt);
  gl_PointSize = basis * (1.0 + 2.5 * vLang) * uRes.y * uR / 135.0;
}`;
const SPLITTER_FS = `
precision mediump float;
uniform vec3 uAkzent, uHell;
varying float vA, vArt, vWinkel, vLang;
varying vec2 vRicht;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a;
  vec3 f;
  if (vArt < 0.5) {
    float cs = cos(vWinkel), sn = sin(vWinkel);
    vec2 rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
    vec2 dd = abs(rc) - vec2(0.26, 0.13);
    float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0);
    a = 1.0 - smoothstep(-0.03, 0.03, sd);
    // Glühendes Bruchstück: heller Kern, violett glühende Kante, weicher Schein drumherum
    float kante = smoothstep(-0.09, 0.0, sd);
    f = mix(mix(uHell, vec3(1.0), 0.45) * (0.85 + 0.15 * rc.y / 0.13), mix(uAkzent, vec3(1.0), 0.35), kante * 0.85);
    float schein = exp(-max(sd, 0.0) * 14.0) * 0.55 * (1.0 - a);
    gl_FragColor = vec4((f * a + mix(uAkzent, vec3(1.0), 0.25) * schein) * vA, a * vA);
    return;
  } else {
    float faktor = 1.0 + 2.5 * vLang;
    float r = 0.3 / faktor;
    float halb = max(0.0, 0.47 - r) * min(1.0, vLang * 3.0) + 0.001;
    float entlang = dot(c, vRicht), quer = dot(c, vec2(-vRicht.y, vRicht.x));
    float abst = length(vec2(max(abs(entlang) - halb, 0.0), quer));
    a = (1.0 - smoothstep(r * 0.3, r, abst)) * (0.3 + 0.7 * smoothstep(-halb, halb, entlang));
    f = mix(uAkzent, vec3(1.0), 0.4);
  }
  a *= vA;
  gl_FragColor = vec4(f * a, a);
}`;

function shader(gl, art, quelle) {
  const s = gl.createShader(art);
  gl.shaderSource(s, quelle);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'Shader');
  return s;
}
function programm(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'Programm');
  return p;
}
const orte = (gl, p, namen) => Object.fromEntries(namen.map((n) => [n, gl.getUniformLocation(p, n)]));
/** CSS-Farbe (#rrggbb) → [r, g, b] in 0..1 */
function farbe(hex) {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function zufallsPuffer(gl, anzahl) {
  const werte = new Float32Array(anzahl * 4);
  for (let i = 0; i < werte.length; i++) werte[i] = Math.random();
  const puffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
  gl.bufferData(gl.ARRAY_BUFFER, werte, gl.STATIC_DRAW);
  return puffer;
}

/** Lage des Zeichens im Film: Mitte bei 44 % von oben; R (= 16 Zeichen-Einheiten) höchstens 15 % der Höhe oder 24 % der Breite.
 *  Im Endbild steht es dort, wo `.ende-anker` liegt (film.css: --ende-x, --ende-y, --re). */
export const LAGE = { mitteY: 0.56, rHoehe: 0.15, rBreite: 0.24 };

/** Startet die Szene. null, wenn es kein WebGL gibt (dann zeigt die Seite das Zeichen als Bild). */
export function szeneStarten(canvas, { handy = false, anker = null } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'default' });
  if (!gl) return null;
  let flaeche, punkte, splitter;
  try {
    flaeche = programm(gl, FLAECHE_VS, FLAECHE_FS);
    punkte = programm(gl, PUNKTE_VS, PUNKTE_FS);
    splitter = programm(gl, SPLITTER_VS, SPLITTER_FS);
  } catch (fehler) {
    console.warn('Szene aus:', fehler.message);
    return null;
  }
  const uF = orte(gl, flaeche, ['uRes', 'uC', 'uKS', 'uZeit', 'uR', 'uKern', 'uKX', 'uCam', 'uWand', 'uSpurA', 'uStreck', 'uPuls', 'uWeite', 'uBluete', 'uImpuls',
    'uEnergie', 'uRiss', 'uBeule', 'uGlut', 'uLoch', 'uKnall', 'uTempo', 'uFaden', 'uFahrt', 'uRuhe', 'uTiefe', 'uAkzent', 'uKernF', 'uHell', 'uNacht']);
  const uP = orte(gl, punkte, ['uRes', 'uC', 'uZeit', 'uR', 'uCam', 'uKX', 'uSammeln', 'uStrom', 'uStromP', 'uTempo', 'uDpr', 'uSichtbar', 'uAkzent', 'uKernF', 'uHell']);
  const uS = orte(gl, splitter, ['uRes', 'uC', 'uR', 'uCam', 'uT', 'uAkzent', 'uHell']);

  const dreieck = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dreieck);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const anzahl = handy ? 70 : 150;
  const punktPuffer = zufallsPuffer(gl, anzahl);
  const anzahlSplitter = handy ? 44 : 80;
  const splitterPuffer = zufallsPuffer(gl, anzahlSplitter);
  const aF = gl.getAttribLocation(flaeche, 'a');
  const aZ = gl.getAttribLocation(punkte, 'aZufall');
  const aS = gl.getAttribLocation(splitter, 'aZufall');

  const stil = getComputedStyle(document.documentElement);
  const FARBEN = {
    akzent: farbe(stil.getPropertyValue('--akzent')), kern: farbe(stil.getPropertyValue('--kern-nacht')),
    hell: farbe(stil.getPropertyValue('--hell')), nacht: farbe(stil.getPropertyValue('--nacht')),
  };

  // Zustand, den der Film setzt (siehe geschichte); faden, fahrt und stromP zählt der Film mit der Uhr hoch, knall = Sekunden seit dem Bruch
  const z = {
    sammeln: 0, kern: 0, kx: KERN_START, cam: KERN_START, wand: 0, spurA: 0, streck: 1, punkteSichtbar: 1, puls: 1, weite: 1.5, bluete: 1, impuls: 0,
    energie: 0, riss: 0, beule: 0, glut: 0, loch: 0, knall: -1, tempo: 0, faden: 0, fahrt: 0, stromP: 0, strom: 0, ruhe: 0, tiefe: 1, ks: [1, 1],
    zoom: 1, wackel: [0, 0], ende: 0, geom: null,
  };
  let dpr = 1;

  function groesse() {
    // Der Schein ist weich: mehr als 1,25 (Rechner) bzw. 1,5 (Handy) Pixeldichte kostet nur Grafikleistung.
    dpr = Math.min(window.devicePixelRatio || 1, handy ? 1.5 : 1.25);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    const aspekt = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const g = { R0: Math.min(LAGE.rHoehe, aspekt * LAGE.rBreite), C0: [0, LAGE.mitteY] };
    g.Re = g.R0;
    g.Ce = g.C0;
    // Das Endbild: das Zeichen steht genau auf dem Anker (Mitte = Mitte des Zeichens, Breite = 2 R)
    if (anker) {
      const a = anker.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      if (a.width > 0 && c.width > 0 && c.height > 0) {
        g.Re = a.width / 2 / c.height;
        g.Ce = [((a.left + a.width / 2 - c.left) / c.width - 0.5) * (c.width / c.height), 1 - (a.top + a.height / 2 - c.top) / c.height];
      }
    }
    z.geom = g;
  }

  function malen(zeit) {
    const g = z.geom;
    const e = z.ende;
    const R = (g.R0 + (g.Re - g.R0) * e) * z.zoom;
    const k = R / 16;
    const C = [g.C0[0] + (g.Ce[0] - g.C0[0]) * e + z.wackel[0] * k, g.C0[1] + (g.Ce[1] - g.C0[1]) * e + z.wackel[1] * k];

    gl.disable(gl.BLEND);
    gl.useProgram(flaeche);
    gl.bindBuffer(gl.ARRAY_BUFFER, dreieck);
    gl.enableVertexAttribArray(aF);
    gl.vertexAttribPointer(aF, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uF.uRes, canvas.width, canvas.height);
    gl.uniform2f(uF.uC, C[0], C[1]);
    gl.uniform2f(uF.uKS, z.ks[0], z.ks[1]);
    gl.uniform1f(uF.uZeit, zeit);
    gl.uniform1f(uF.uR, R);
    gl.uniform1f(uF.uKern, z.kern);
    gl.uniform1f(uF.uKX, z.kx);
    gl.uniform1f(uF.uCam, z.cam);
    gl.uniform1f(uF.uWand, z.wand);
    gl.uniform1f(uF.uSpurA, z.spurA);
    gl.uniform1f(uF.uStreck, z.streck);
    gl.uniform1f(uF.uPuls, z.puls);
    gl.uniform1f(uF.uWeite, z.weite);
    gl.uniform1f(uF.uBluete, z.bluete);
    gl.uniform1f(uF.uImpuls, z.impuls);
    gl.uniform1f(uF.uEnergie, z.energie);
    gl.uniform1f(uF.uRiss, z.riss);
    gl.uniform1f(uF.uBeule, z.beule);
    gl.uniform1f(uF.uGlut, z.glut);
    gl.uniform1f(uF.uLoch, z.loch);
    gl.uniform1f(uF.uKnall, z.knall);
    gl.uniform1f(uF.uTempo, z.tempo);
    gl.uniform1f(uF.uFaden, z.faden);
    gl.uniform1f(uF.uFahrt, z.fahrt);
    gl.uniform1f(uF.uRuhe, z.ruhe);
    gl.uniform1f(uF.uTiefe, z.tiefe);
    gl.uniform3fv(uF.uAkzent, FARBEN.akzent);
    gl.uniform3fv(uF.uKernF, FARBEN.kern);
    gl.uniform3fv(uF.uHell, FARBEN.hell);
    gl.uniform3fv(uF.uNacht, FARBEN.nacht);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aF);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (z.punkteSichtbar > 0.001) {
      gl.useProgram(punkte);
      gl.bindBuffer(gl.ARRAY_BUFFER, punktPuffer);
      gl.enableVertexAttribArray(aZ);
      gl.vertexAttribPointer(aZ, 4, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uP.uRes, canvas.width, canvas.height);
      gl.uniform2f(uP.uC, C[0], C[1]);
      gl.uniform1f(uP.uZeit, zeit);
      gl.uniform1f(uP.uR, R);
      gl.uniform1f(uP.uCam, z.cam);
      gl.uniform1f(uP.uKX, z.kx);
      gl.uniform1f(uP.uSammeln, z.sammeln);
      gl.uniform1f(uP.uStrom, z.strom);
      gl.uniform1f(uP.uStromP, z.stromP);
      gl.uniform1f(uP.uTempo, z.tempo);
      gl.uniform1f(uP.uDpr, dpr);
      gl.uniform1f(uP.uSichtbar, z.punkteSichtbar);
      gl.uniform3fv(uP.uAkzent, FARBEN.akzent);
      gl.uniform3fv(uP.uKernF, FARBEN.kern);
      gl.uniform3fv(uP.uHell, FARBEN.hell);
      gl.drawArrays(gl.POINTS, 0, anzahl);
      gl.disableVertexAttribArray(aZ);
    }
    if (z.knall >= 0 && z.knall < 2.1) {
      gl.useProgram(splitter);
      gl.bindBuffer(gl.ARRAY_BUFFER, splitterPuffer);
      gl.enableVertexAttribArray(aS);
      gl.vertexAttribPointer(aS, 4, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uS.uRes, canvas.width, canvas.height);
      gl.uniform2f(uS.uC, C[0], C[1]);
      gl.uniform1f(uS.uR, R);
      gl.uniform1f(uS.uCam, z.cam);
      gl.uniform1f(uS.uT, z.knall);
      gl.uniform3fv(uS.uAkzent, FARBEN.akzent);
      gl.uniform3fv(uS.uHell, FARBEN.hell);
      gl.drawArrays(gl.POINTS, 0, anzahlSplitter);
      gl.disableVertexAttribArray(aS);
    }
  }

  groesse();
  return { zustand: z, groesse, malen };
}

// Die Geschichte als reine Rechnung: Fortschritt der Schritte → Zustand der Szene (auch für das Standbild).
// Weg des Kerns in Zeichen-Einheiten (Mitte des Zeichens = 0): er entsteht in der Bildmitte (der Blick folgt ihm, cam), die Wand
// wächst rechts von ihm, er nimmt Anlauf, drückt gegen die Wand (Kontakt bei −13,9), bricht durch und kommt an seinem Platz im Logo an.
const KERN_START = -22;
const KERN_ANLAUF = -16;
const KONTAKT = -13.9;
const KERN_DURCH = 2.5;
const KERN_ZIEL = 8.8;
const BLICK_LUECKE = -10;
const BLICK_ANLAUF = -7;
// Der Durchbruch in drei Takten (Anteile am Schritt): andrücken bis 0,32 · durchbrechen bis 0,46 · ankommen bis 1
const DRUCK_BIS = 0.32;
const BRUCH_BIS = 0.46;
/** Ab hier (Anteil am Durchbruch) ist die Wand gebrochen: der Film löst den Knall aus (Blitz, Welle, Splitter, Stoß). */
export const BRUCH = 0.36;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const glatt = (t) => t * t * (3 - 2 * t);
const aus3 = (t) => 1 - (1 - t) ** 3;

/** fokus, luecke, momentum, durchbruch, ende je 0..1 → Kern, Wand, Spur, Licht und Blick */
export function geschichte(z, { fokus, luecke = 1, momentum, durchbruch, ende = 0 }) {
  z.sammeln = fokus;
  z.kern = glatt(clamp01((fokus - 0.4) / 0.6));
  // Raum: breit im Lärm (1,5), eng im Fokus (0,85), weiter beim Durchbruch (1,2)
  z.weite = 1.5 - 0.65 * glatt(fokus) + 0.35 * glatt(clamp01(durchbruch));
  const w = glatt(clamp01(luecke));
  const m = glatt(clamp01(momentum));
  const db = clamp01(durchbruch);
  const druck = clamp01(db / DRUCK_BIS);
  const bruch = clamp01((db - DRUCK_BIS) / (BRUCH_BIS - DRUCK_BIS));
  const an = clamp01((db - BRUCH_BIS) / (1 - BRUCH_BIS));
  z.wand = w;

  if (db > 0) {
    if (bruch <= 0) {
      // heran bis zum Kontakt, dann langsam hineindrücken
      z.kx = KERN_ANLAUF + (KONTAKT - KERN_ANLAUF) * glatt(clamp01(druck / 0.35)) + 0.8 * aus3(clamp01((druck - 0.35) / 0.65));
    } else if (an <= 0) {
      z.kx = KONTAKT + 0.8 + (KERN_DURCH - KONTAKT - 0.8) * bruch * bruch;
    } else {
      z.kx = KERN_DURCH + (KERN_ZIEL - KERN_DURCH) * aus3(an);
    }
    z.cam = BLICK_ANLAUF * (1 - glatt(clamp01((db - 0.3) / 0.6)));
  } else if (momentum > 0) {
    z.kx = KERN_START + (KERN_ANLAUF - KERN_START) * m;
    z.cam = BLICK_LUECKE + (BLICK_ANLAUF - BLICK_LUECKE) * m;
  } else {
    z.kx = KERN_START;
    z.cam = KERN_START + (BLICK_LUECKE - KERN_START) * w;
  }

  // Druck auf die Wand: Risse wachsen, die Wand biegt sich; nach dem Bruch glüht die Kante und alles heilt zum Logo
  const rissDruck = glatt(clamp01((druck - 0.35) / 0.65));
  z.riss = rissDruck * (1 - glatt(clamp01(an / 0.55)));
  z.beule = 1.2 * rissDruck * (1 - bruch);
  z.glut = bruch > 0 ? glatt(bruch) * (1 - glatt(clamp01(an / 0.7))) : 0;
  const kontakt = z.kx - KONTAKT;
  z.loch = kontakt > 0 ? 10.2 + 2.6 * glatt(clamp01(kontakt / 12)) : 0;

  // Tempo (Lichtstriche, Strom, schnelle Lichter), Energie (Schein des Kerns), Länge der Spur
  if (db <= 0) {
    z.tempo = 0.7 * m;
    z.energie = 0.35 * z.kern + 0.35 * m;
    z.streck = 1 + 0.8 * m;
  } else if (bruch <= 0) {
    const d = glatt(druck);
    z.tempo = 0.7 * (1 - 0.65 * d);
    z.energie = 0.7 + 0.3 * d;
    z.streck = 1.8 - 0.6 * d;
  } else if (an <= 0) {
    z.tempo = 0.245 + 0.755 * glatt(bruch);
    z.energie = 1 + 0.3 * bruch;
    z.streck = 1.2 + 1.2 * bruch;
  } else {
    const a = aus3(an);
    z.tempo = 1 - glatt(clamp01(an / 0.6));
    z.energie = 1.3 - a;
    z.streck = 2.4 - 1.4 * a;
  }
  z.spurA = glatt(clamp01(momentum / 0.35));
  z.strom = db > 0 ? 1 - 0.65 * glatt(an) : glatt(clamp01((momentum - 0.1) / 0.6));
  z.ruhe = glatt(clamp01((an - 0.4) / 0.6));
  z.tiefe = 1 - 0.4 * glatt(an);
  // Blick: in Fahrt etwas näher, beim Drücken noch näher, beim Ankommen zurück
  z.zoom = db > 0 ? 1 + (0.08 + 0.1 * glatt(druck)) * (1 - glatt(an)) : 1 + 0.08 * m;
  // Form des Kerns: gestaucht beim Drücken, gestreckt in voller Fahrt
  const v = db > 0 ? (bruch > 0 ? (an > 0 ? (1 - an) ** 3 : 1) : 0.2 * (1 - glatt(druck))) : 0.2 * m;
  const rp = rissDruck * (1 - bruch);
  z.ks = [(1 - 0.08 * rp) * (1 + 0.32 * v), (1 + 0.05 * rp) / Math.sqrt(1 + 0.32 * v)];
  z.ende = glatt(clamp01(ende));
  // Im Endbild strömt nur noch wenig Licht nach (das Zeichen steht neben dem Text)
  z.strom *= 1 - 0.92 * z.ende;
}
