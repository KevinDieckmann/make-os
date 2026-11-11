// Haltung: Kaffeebohnen schweben ruhig im Raum, weichen der Maus aus und kreisen beim Scrollen um den Becher.
// Feste Physik-Schritte (1/120 s), Stöße zwischen den Bohnen und am Becher. Außerhalb des Bildes ruht alles.
// Der Aufbau läuft in kleinen Stücken über mehrere Bilder, damit er nie mitten im Scrollen einen Ruckler setzt.
import * as THREE from '../vendor/three/build/three.module.js';
import { RoomEnvironment } from '../vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { modelleLaden, aufdruckeLaden, aufdruckSetzen } from './modelle.js';
import { imTakt, gueteRegler, stufenAb } from './bewegung.js';

const SICHT = { winkel: 30, abstand: 20 };
const TIEFE = { nah: 2.5, fern: -12 };
const BOHNEN = { gross: 34, klein: 16, laenge: 0.07, mass: { min: 0.55, max: 1.7 } };
// drehen: ganzer Schwenk über den Abschnitt. In der Mitte (Abschnitt füllt das Fenster) zeigt der Aufdruck nach vorn.
const BECHER = { gieren: Math.PI + 1.2, neigen: 0.21, mass: 0.92, kapsel: 0.36, frei: 0.34, lehne: { gier: 0.26, nick: 0.1 }, folgen: 4, drehen: 1.7, drehFolgen: 6, steigen: 1.1, steigRate: 2.4 };
const LICHT = { belichtung: 1.15, umgebung: 0.55, haupt: { farbe: 0xfff1e0, staerke: 2.4, ort: [-5, 6, 7] }, kante: { farbe: 0xffd9b0, staerke: 1.6, ort: [5, 3, -6] } };
const WIRBEL = { staerke: 2.4, vollTempo: 1600, folgen: 3 };
const FELD = {
  schritt: 1 / 120, hoechstSchritte: 8, wandern: 0.16, wanderRate: { min: 0.12, max: 0.34 }, bremse: 0.42, drallBremse: 0.3,
  drallWandern: 0.22, wand: 4.5, rand: 0.6, abprall: 0.62, reibung: 0.35, zeigerReichweite: 0.16, zeigerStoss: 26, zeigerWecken: 1.8,
  zeigerDrall: 3.2, hoechstTempo: 7, hoechstDrall: 6, radius: 0.36, wirbelKern: 3, wirbelZug: 0.22, wirbelDrall: 0.35,
};
const SPAR_TAKT = 1000 / 30;
const DICHTE = { hoechstens: 1.5, stufen: [1.25, 1] };

// Ein Bild abwarten, damit der Aufbau die Seite nicht anhält
const luft = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));

const halbeHoehe = (tan, z) => (SICHT.abstand - z) * tan;

function zufall(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export async function bohnenStarten({ reduziert }) {
  const ruhe = document.querySelector('.ruhe');
  const buehne = ruhe.querySelector('.ruhe-szene');
  const becherPlatz = ruhe.querySelector('[data-ruhe-becher]');
  const handy = innerWidth < 768 || matchMedia('(pointer: coarse)').matches;

  const [gltf, leinwaende] = await Promise.all([modelleLaden(), aufdruckeLaden()]);
  await luft();

  const leinwand = document.createElement('canvas');
  leinwand.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas: leinwand, alpha: true, antialias: !handy, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LICHT.belichtung;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  // Auflösung: höchstens 1,5-fach; reicht die Bildzeit nicht, geht sie stufenweise herunter, zuletzt auf halbe Bildrate.
  let neu = false;
  let sparTakt = false;
  const guete = gueteRegler({
    stufen: stufenAb(Math.min(devicePixelRatio || 1, DICHTE.hoechstens), DICHTE.stufen),
    setze: (w) => { renderer.setPixelRatio(w); neu = true; },
    amLimit: () => { sparTakt = true; },
  });
  renderer.setPixelRatio(guete.wert());
  buehne.append(leinwand);
  await luft();

  const szene = new THREE.Scene();
  szene.fog = new THREE.Fog(0x070707, 24, 44);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const raum = new RoomEnvironment();
  szene.environment = pmrem.fromScene(raum, 0.04).texture;
  szene.environmentIntensity = LICHT.umgebung;
  raum.dispose?.();
  pmrem.dispose();
  for (const l of [LICHT.haupt, LICHT.kante]) {
    const d = new THREE.DirectionalLight(l.farbe, l.staerke);
    d.position.set(...l.ort);
    szene.add(d);
  }

  await luft();

  const kamera = new THREE.PerspectiveCamera(SICHT.winkel, 1, 0.1, 100);
  kamera.position.set(0, 0, SICHT.abstand);
  const tan = Math.tan(THREE.MathUtils.degToRad(SICHT.winkel / 2));

  // Bohne: Form aus dem Modell, mittig und auf Länge 1 gebracht
  const bohnenQuelle = gltf.scenes[2];
  bohnenQuelle.updateMatrixWorld(true);
  let bohnenNetz = null;
  bohnenQuelle.traverse((o) => { if (o.isMesh && !bohnenNetz) bohnenNetz = o; });
  if (!bohnenNetz) throw new Error('Bohne fehlt im Modell');
  const form = bohnenNetz.geometry.clone();
  form.applyMatrix4(bohnenNetz.matrixWorld);
  form.computeBoundingBox();
  const fb = form.boundingBox;
  form.translate(...fb.getCenter(new THREE.Vector3()).negate().toArray());
  const fg = fb.getSize(new THREE.Vector3());
  const laengste = Math.max(fg.x, fg.y, fg.z);
  form.scale(1 / laengste, 1 / laengste, 1 / laengste);
  const bohnenStoff = Array.isArray(bohnenNetz.material) ? bohnenNetz.material[0] : bohnenNetz.material;

  const anzahl = handy ? BOHNEN.klein : BOHNEN.gross;
  const feld = new THREE.InstancedMesh(form, bohnenStoff, anzahl);
  feld.frustumCulled = false;
  feld.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  szene.add(feld);
  const grundLaenge = BOHNEN.laenge * 2 * SICHT.abstand * tan;

  // Becher
  const becherModell = gltf.scenes[1];
  aufdruckSetzen(becherModell, leinwaende);
  becherModell.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(becherModell);
  const bMitte = bb.getCenter(new THREE.Vector3());
  const bGroesse = bb.getSize(new THREE.Vector3());
  becherModell.position.sub(bMitte);
  const becherGruppe = new THREE.Group();
  const becherDreh = new THREE.Group();
  becherDreh.add(becherModell);
  becherGruppe.add(becherDreh);
  szene.add(becherGruppe);
  const becher = { x: 0, y: 0, hoehe: 1, radius: 0.4, gier: 0, nick: 0, dreh: 0, steigen: reduziert ? 1 : 0, sichtbarAb: 0 };

  let W = 0, H = 0, aspekt = 1;
  function einpassen() {
    const r = buehne.getBoundingClientRect();
    W = r.width; H = r.height;
    if (!W || !H) return;
    aspekt = W / H;
    renderer.setSize(W, H, false);
    kamera.aspect = aspekt;
    kamera.updateProjectionMatrix();
    const pr = becherPlatz.getBoundingClientRect();
    if (pr.width && pr.height && getComputedStyle(becherPlatz).display !== 'none') {
      const hh = halbeHoehe(tan, 0), hw = hh * aspekt;
      const cx = (pr.left + pr.width / 2 - r.left) / W, cy = (pr.top + pr.height / 2 - r.top) / H;
      becher.x = (cx * 2 - 1) * hw;
      becher.y = -(cy * 2 - 1) * hh;
      becher.hoehe = (pr.height / H) * 2 * hh * BECHER.mass;
      becherModell.scale.setScalar(becher.hoehe / bGroesse.y);
      becher.radius = becher.hoehe * BECHER.kapsel * 0.5;
      becherGruppe.visible = true;
    } else {
      becherGruppe.visible = false;
    }
  }

  // Bohnen verteilen: Ablehnungs-Stichprobe, damit keine zwei sich überlappen
  const zz = zufall(20250521);
  const bohnen = [];
  function raumBei(z) { const hh = halbeHoehe(tan, z); return { hh, hw: hh * aspekt }; }
  function verteilen() {
    bohnen.length = 0;
    for (let i = 0; i < anzahl; i++) {
      const mass = BOHNEN.mass.min * Math.pow(BOHNEN.mass.max / BOHNEN.mass.min, zz());
      const r = FELD.radius * mass * grundLaenge;
      let p = null;
      for (let versuch = 0; versuch < 40; versuch++) {
        const z = TIEFE.fern + (TIEFE.nah - TIEFE.fern) * zz();
        const { hh, hw } = raumBei(z);
        const kandidat = new THREE.Vector3((zz() * 2 - 1) * hw * 0.92, (zz() * 2 - 1) * hh * 0.88, z);
        const frei = bohnen.every((b) => b.p.distanceTo(kandidat) > b.r + r + 0.15)
          && Math.hypot(kandidat.x - becher.x, kandidat.y - becher.y) > becher.radius + r + 0.4;
        p = kandidat;
        if (frei) break;
      }
      const m = mass * mass * mass;
      bohnen.push({
        p, v: new THREE.Vector3(), w: new THREE.Vector3((zz() - 0.5) * 0.6, (zz() - 0.5) * 0.6, (zz() - 0.5) * 0.6),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(zz() * 6.28, zz() * 6.28, zz() * 6.28)),
        groesse: mass * grundLaenge, r, m, traeg: 0.4 * m * r * r,
        phase: [zz() * 6.28, zz() * 6.28, zz() * 6.28],
        rate: [0, 1, 2].map(() => FELD.wanderRate.min + (FELD.wanderRate.max - FELD.wanderRate.min) * zz()),
      });
    }
  }

  // Zeiger in Weltkoordinaten (auf der Ebene der Bohne)
  const zeiger = { x: 0, y: 0, vx: 0, vy: 0, da: false, nx: 0, ny: 0 };
  let letzteZeigerZeit = 0;
  addEventListener('pointermove', (e) => {
    const r = buehne.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
    const t = performance.now();
    const dt = Math.max(8, t - letzteZeigerZeit) / 1000;
    letzteZeigerZeit = t;
    zeiger.vx = Math.max(-24, Math.min(24, (nx - zeiger.nx) / dt));
    zeiger.vy = Math.max(-24, Math.min(24, (ny - zeiger.ny) / dt));
    zeiger.nx = nx; zeiger.ny = ny;
    zeiger.da = Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
  }, { passive: true });

  // Scrolltempo treibt den Wirbel
  let letzterScroll = scrollY, scrollZeit = performance.now(), wirbel = 0, wirbelZiel = 0;
  addEventListener('scroll', () => {
    const t = performance.now();
    const dt = Math.max(16, t - scrollZeit) / 1000;
    wirbelZiel = Math.min(1, Math.abs(scrollY - letzterScroll) / dt / WIRBEL.vollTempo);
    letzterScroll = scrollY; scrollZeit = t;
  }, { passive: true });

  const a = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3(), rel = new THREE.Vector3(), dq = new THREE.Quaternion(), achse = new THREE.Vector3();
  let zeit = 0;

  function physik(h) {
    zeit += h;
    for (const b of bohnen) {
      a.set(
        Math.sin(zeit * b.rate[0] + b.phase[0]) * FELD.wandern,
        Math.sin(zeit * b.rate[1] + b.phase[1]) * FELD.wandern,
        Math.sin(zeit * b.rate[2] + b.phase[2]) * FELD.wandern * 0.5,
      );
      // weiche Wände am Rand des Sichtfelds
      const { hh, hw } = raumBei(b.p.z);
      const gx = hw - FELD.rand, gy = hh - FELD.rand;
      if (b.p.x > gx) a.x -= (b.p.x - gx) * FELD.wand; else if (b.p.x < -gx) a.x -= (b.p.x + gx) * FELD.wand;
      if (b.p.y > gy) a.y -= (b.p.y - gy) * FELD.wand; else if (b.p.y < -gy) a.y -= (b.p.y + gy) * FELD.wand;
      if (b.p.z > TIEFE.nah) a.z -= (b.p.z - TIEFE.nah) * FELD.wand; else if (b.p.z < TIEFE.fern) a.z -= (b.p.z - TIEFE.fern) * FELD.wand;

      // Zeiger schiebt
      if (zeiger.da) {
        const zx = zeiger.nx * hw, zy = zeiger.ny * hh;
        const dx = b.p.x - zx, dy = b.p.y - zy;
        const reich = FELD.zeigerReichweite * 2 * hh * 1.6;
        const dist = Math.hypot(dx, dy);
        if (dist < reich && dist > 1e-4) {
          const k = (1 - dist / reich) ** 2;
          const tempo = Math.min(1, Math.hypot(zeiger.vx, zeiger.vy) / FELD.zeigerWecken);
          a.x += (dx / dist) * FELD.zeigerStoss * k * (0.25 + tempo) / b.m;
          a.y += (dy / dist) * FELD.zeigerStoss * k * (0.25 + tempo) / b.m;
          b.w.x += -dy / dist * k * FELD.zeigerDrall * h;
          b.w.y += dx / dist * k * FELD.zeigerDrall * h;
        }
      }

      // Wirbel um den Becher
      if (wirbel > 0.001) {
        const rx = b.p.x - becher.x, ry = b.p.y - becher.y;
        const rr = Math.hypot(rx, ry) + 1e-3;
        const kern = Math.min(1, rr / FELD.wirbelKern);
        a.x += (-ry / rr) * WIRBEL.staerke * wirbel * kern - (rx / rr) * FELD.wirbelZug * wirbel * rr;
        a.y += (rx / rr) * WIRBEL.staerke * wirbel * kern - (ry / rr) * FELD.wirbelZug * wirbel * rr;
        b.w.z += FELD.wirbelDrall * wirbel * h;
      }

      b.v.addScaledVector(a, h).multiplyScalar(Math.exp(-FELD.bremse * h));
      if (b.v.length() > FELD.hoechstTempo) b.v.setLength(FELD.hoechstTempo);
      b.p.addScaledVector(b.v, h);

      b.w.x += Math.sin(zeit * b.rate[0] * 1.3 + b.phase[1]) * FELD.drallWandern * h;
      b.w.y += Math.sin(zeit * b.rate[1] * 1.3 + b.phase[2]) * FELD.drallWandern * h;
      b.w.multiplyScalar(Math.exp(-FELD.drallBremse * h));
      if (b.w.length() > FELD.hoechstDrall) b.w.setLength(FELD.hoechstDrall);
      const wl = b.w.length();
      if (wl > 1e-6) { achse.copy(b.w).divideScalar(wl); dq.setFromAxisAngle(achse, wl * h); b.q.premultiply(dq); }
    }

    // Stöße zwischen Bohnen (elastisch mit etwas Reibung)
    for (let i = 0; i < bohnen.length; i++) {
      const A = bohnen[i];
      for (let j = i + 1; j < bohnen.length; j++) {
        const B = bohnen[j];
        d.subVectors(B.p, A.p);
        const dist = d.length(), min = A.r + B.r;
        if (dist >= min || dist < 1e-5) continue;
        n.copy(d).divideScalar(dist);
        const ueber = min - dist, summe = A.m + B.m;
        A.p.addScaledVector(n, -ueber * B.m / summe);
        B.p.addScaledVector(n, ueber * A.m / summe);
        rel.subVectors(B.v, A.v);
        const vn = rel.dot(n);
        if (vn > 0) continue;
        const j0 = -(1 + FELD.abprall) * vn / (1 / A.m + 1 / B.m);
        A.v.addScaledVector(n, -j0 / A.m);
        B.v.addScaledVector(n, j0 / B.m);
        rel.addScaledVector(n, -vn);
        const vt = rel.length();
        if (vt > 1e-5) {
          const jt = Math.min(FELD.reibung * j0, vt / (1 / A.m + 1 / B.m));
          rel.divideScalar(vt);
          A.v.addScaledVector(rel, jt / A.m);
          B.v.addScaledVector(rel, -jt / B.m);
          A.w.addScaledVector(n.clone().cross(rel), -jt * A.r / A.traeg * 0.02);
          B.w.addScaledVector(n.clone().cross(rel), -jt * B.r / B.traeg * 0.02);
        }
      }
      // Becher als Kapsel (senkrechte Achse) in der Ebene z = 0
      if (becherGruppe.visible && A.p.z > 0) {
        // Vor dem Becher weicht die Bohne in der Bildebene aus (mit Perspektive gerechnet): So verdeckt keine den Aufdruck.
        const k = SICHT.abstand / (SICHT.abstand - A.p.z);
        const rv = becher.hoehe * BECHER.frei;
        const halb = Math.max(0, becher.hoehe * 0.5 - rv);
        const px = A.p.x * k, py = A.p.y * k;
        const cy = Math.max(becher.y - halb, Math.min(becher.y + halb, py));
        const dx = px - becher.x, dy = py - cy;
        const dist = Math.hypot(dx, dy), min = A.r * k + rv;
        if (dist < min && dist > 1e-5) {
          const nx = dx / dist, ny = dy / dist;
          const schub = ((min - dist) / k) * 0.12;      // weich hinausschieben statt springen
          A.p.x += nx * schub;
          A.p.y += ny * schub;
          const vn = A.v.x * nx + A.v.y * ny;
          if (vn < 0) { A.v.x -= (1 + FELD.abprall) * vn * nx; A.v.y -= (1 + FELD.abprall) * vn * ny; }
        }
      } else if (becherGruppe.visible) {
        const halb = becher.hoehe * 0.5 - becher.radius;
        const cy = Math.max(becher.y - halb, Math.min(becher.y + halb, A.p.y));
        d.set(A.p.x - becher.x, A.p.y - cy, A.p.z);
        const dist = d.length(), min = A.r + becher.radius;
        if (dist < min && dist > 1e-5) {
          n.copy(d).divideScalar(dist);
          A.p.addScaledVector(n, min - dist);
          const vn = A.v.dot(n);
          if (vn < 0) A.v.addScaledVector(n, -(1 + FELD.abprall) * vn);
        }
      }
    }
  }

  const m4 = new THREE.Matrix4(), s3 = new THREE.Vector3();
  function bohnenSetzen() {
    for (let i = 0; i < bohnen.length; i++) {
      const b = bohnen[i];
      s3.setScalar(b.groesse);
      m4.compose(b.p, b.q, s3);
      feld.setMatrixAt(i, m4);
    }
    feld.instanceMatrix.needsUpdate = true;
  }

  // Becher: dreht mit dem Scroll, steigt beim Hereinkommen, neigt sich zur Maus
  function becherSetzen(dt) {
    const r = ruhe.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    const k = (rate) => 1 - Math.exp(-rate * dt);
    const drehZiel = reduziert ? 0 : (p - 0.5) * BECHER.drehen;
    becher.dreh += (drehZiel - becher.dreh) * k(BECHER.drehFolgen);
    if (!reduziert && r.top < innerHeight * 0.85) becher.steigen += (1 - becher.steigen) * k(BECHER.steigRate);
    const zielGier = zeiger.da ? zeiger.nx * BECHER.lehne.gier : 0;
    const zielNick = zeiger.da ? -zeiger.ny * BECHER.lehne.nick : 0;
    becher.gier += (zielGier - becher.gier) * k(BECHER.folgen);
    becher.nick += (zielNick - becher.nick) * k(BECHER.folgen);
    becherGruppe.position.set(becher.x, becher.y - (1 - becher.steigen) * BECHER.steigen * becher.hoehe, 0);
    becherGruppe.rotation.set(becher.nick, becher.gier, BECHER.neigen);
    becherDreh.rotation.y = BECHER.gieren + becher.dreh;
  }

  einpassen();
  verteilen();
  // Vorlauf ohne Bild: Bohnen, die vor dem Becher gelandet sind, haben ihn schon verlassen, wenn man den Abschnitt sieht.
  for (let i = 0; i < 360; i++) physik(FELD.schritt);
  for (const b of bohnen) b.v.multiplyScalar(0.25);
  bohnenSetzen();
  becherSetzen(1000);
  await luft();
  await renderer.compileAsync(szene, kamera).catch(() => {});
  await luft();
  renderer.render(szene, kamera);
  leinwand.classList.add('ist-bereit');

  new ResizeObserver(() => { neu = true; }).observe(buehne);
  if (reduziert) {
    new ResizeObserver(() => { einpassen(); becherSetzen(1); renderer.render(szene, kamera); }).observe(buehne);
    return;
  }

  let sichtbar = false;
  new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; }, { rootMargin: '10% 0px' }).observe(ruhe);
  let schuld = 0, seitBild = 0;
  imTakt((dt) => {
    if (!sichtbar || document.hidden) return;
    seitBild += dt;
    if (sparTakt && seitBild < SPAR_TAKT) return;
    const h = Math.min(seitBild, 64) / 1000;
    if (!sparTakt) guete.bild(seitBild);
    seitBild = 0;
    if (neu) { einpassen(); neu = false; }
    if (!W) return;
    wirbelZiel *= Math.exp(-4 * h);
    wirbel += (wirbelZiel - wirbel) * (1 - Math.exp(-WIRBEL.folgen * h));
    schuld = Math.min(schuld + h, FELD.schritt * FELD.hoechstSchritte);
    while (schuld >= FELD.schritt) { physik(FELD.schritt); schuld -= FELD.schritt; }
    bohnenSetzen();
    becherSetzen(h);
    renderer.render(szene, kamera);
  });
}
