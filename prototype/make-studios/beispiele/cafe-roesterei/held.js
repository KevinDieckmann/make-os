// Startbild: Kaffeetüte und Becher in 3D. Sie neigen sich zur Maus, lassen sich drehen und heben sich, wenn man darüberfährt.
import * as THREE from '../vendor/three/build/three.module.js';
import { modelleLaden, aufdruckeLaden, aufdruckSetzen } from './modelle.js';
import { imTakt, wenn, Feder, glatt, gueteRegler, stufenAb } from './bewegung.js';

// Lage der Modelle im Bildausschnitt der Vorlage (Anteile der Bildfläche 1153 × 976)
const RAHMEN = { links: 0.2697, rechts: 0.8439, oben: 0.0502, unten: 0.7695 };
const BILD = { breite: 1153, hoehe: 976 };
const FUELLEN_AB = 1024;
const PLATZ = [
  { von: 1024, bis: 1280, mass: 0.928, x: 0.01, y: 0 },
  { von: 768, bis: 1024, mass: 1.02, x: 0.0454, y: 0.05 },
  { von: 0, bis: 640, mass: 0.95, x: -0.045, y: 0.0163 },
];
// Die Leinwand deckt nur den Bereich um die Modelle (Rand in Anteilen ihres Rahmens) und nie mehr als die Startfläche selbst.
// Früher war sie 144 % der ganzen Bildfläche: bei doppelter Pixeldichte über 9 Millionen Pixel je Bild.
const RAND = { seite: 0.3, oben: 0.24, unten: 0.42 };
const PIXEL_HOECHSTENS = 3.4e6;
const BLICKWINKEL = 8;
const HEBEN = { tuete: { hoch: 0.05, drehen: -0.14, rollen: 0.05 }, becher: { hoch: 0.1, drehen: 0.24, rollen: -0.08 } };
const NEIGEN = { tuete: 0.8, becher: 1.35 };
const ZEIGER = { gieren: 0.2, nicken: 0.11, jePixel: 0.009, gierGrenze: 0.6, nickGrenze: 0.3, reibung: 0.94 };
const AUFTRITT = { steigen: 0.35, drehen: 0.25, rollen: -0.05, dauer: 1400 };
const SCROLL_SINKEN = 0.22;
const LICHTER = [
  { ort: [-4.2, 3, 1.4], staerke: 4 },
  { ort: [3.9, 2.5, 1.3], staerke: 1 },
  { ort: [0.6, 3, -3.2], staerke: 0.6 },
];
const STUDIO = [
  { groesse: [7, 7], ort: [-2.6, 2.4, 2.6], hell: 11 },
  { groesse: [5, 5], ort: [3.4, 0.5, 2.2], hell: 2.4 },
  { groesse: [6, 3], ort: [0.6, 3, -3], hell: 3.2 },
  { groesse: [6, 6], ort: [0, -3, 1.6], hell: 0.5 },
];
const UMGEBUNG = 0.35;

function studioUmgebung(renderer) {
  const studio = new THREE.Scene();
  const ebene = new THREE.PlaneGeometry(1, 1);
  for (const s of STUDIO) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(s.hell), side: THREE.DoubleSide });
    const e = new THREE.Mesh(ebene, m);
    e.scale.set(s.groesse[0], s.groesse[1], 1);
    e.position.set(...s.ort);
    e.lookAt(0, 0, 0);
    studio.add(e);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ziel = pmrem.fromScene(studio, 0.04);
  pmrem.dispose();
  ebene.dispose();
  return ziel.texture;
}

export async function heldStarten({ reduziert }) {
  const held = document.querySelector('.held');
  const kasten = held.querySelector('.held-modell');
  const griff = held.querySelector('.held-griff');
  const kartenEbene = held.querySelector('.held-karten');
  const karten = { tuete: held.querySelector('[data-stueck="tuete"]'), becher: held.querySelector('[data-stueck="becher"]') };

  const [gltf, leinwaende] = await Promise.all([modelleLaden(), aufdruckeLaden()]);

  const leinwand = document.createElement('canvas');
  leinwand.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas: leinwand, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  kasten.append(leinwand);

  const szene = new THREE.Scene();
  szene.environment = studioUmgebung(renderer);
  szene.environmentIntensity = UMGEBUNG;
  for (const l of LICHTER) {
    const licht = new THREE.DirectionalLight(0xfcfff9, l.staerke);
    licht.position.set(...l.ort);
    szene.add(licht);
  }

  const modell = gltf.scenes[0];
  aufdruckSetzen(modell, leinwaende);
  modell.updateMatrixWorld(true);
  const gesamt = new THREE.Box3().setFromObject(modell);
  const mitte = gesamt.getCenter(new THREE.Vector3());
  const masse = gesamt.getSize(new THREE.Vector3());
  modell.position.sub(mitte);

  // Ebenen: Treiben (Scroll) > Bühne > Auftritt > Drehpunkt (Maus, Ziehen) > Modell mit je einer Hebegruppe pro Stück
  const treiben = new THREE.Group();
  const buehne = new THREE.Group();
  const auftritt = new THREE.Group();
  const dreh = new THREE.Group();
  szene.add(treiben);
  treiben.add(buehne);
  buehne.add(auftritt);
  auftritt.add(dreh);
  dreh.add(modell);
  modell.updateMatrixWorld(true);

  const [tuete, becher] = modell.children.slice(0, 2);
  const stuecke = {};
  for (const [name, obj] of [['tuete', tuete], ['becher', becher]]) {
    if (!obj) continue;
    const box = new THREE.Box3().setFromObject(obj);
    const z = box.getCenter(new THREE.Vector3());
    const gruppe = new THREE.Group();
    modell.add(gruppe);
    gruppe.position.copy(modell.worldToLocal(z.clone()));
    gruppe.updateMatrixWorld(true);
    gruppe.attach(obj);
    stuecke[name] = {
      gruppe, obj,
      hub: new Feder(0, 120, 18), dreh: new Feder(0, 120, 18), roll: new Feder(0, 120, 18),
      lehne: 0, karte: karten[name], sicht: new Feder(0, 160, 24),
    };
  }

  const kamera = new THREE.PerspectiveCamera(BLICKWINKEL, 1, 0.1, 1000);
  let breite = 0, hoehe = 0, cw = 0, ch = 0;
  let guete = null;
  let neuEinpassen = true;

  function einpassen() {
    const r = kasten.getBoundingClientRect();
    const hr = held.getBoundingClientRect();
    breite = r.width; hoehe = r.height;
    if (!breite || !hoehe) return;

    const vw = innerWidth;
    const fuellen = vw >= FUELLEN_AB;
    const a = fuellen ? Math.max(breite / BILD.breite, hoehe / BILD.hoehe) : Math.min(breite / BILD.breite, hoehe / BILD.hoehe);
    const ab = BILD.breite * a, ah = BILD.hoehe * a;
    const ax = (breite - ab) / 2, ay = fuellen ? 0 : (hoehe - ah) / 2;
    let fx0 = ax + RAHMEN.links * ab, fx1 = ax + RAHMEN.rechts * ab;
    let fy0 = ay + RAHMEN.oben * ah, fy1 = ay + RAHMEN.unten * ah;
    let fw = fx1 - fx0, fh = fy1 - fy0;
    let fcx = (fx0 + fx1) / 2, fcy = (fy0 + fy1) / 2;
    const band = PLATZ.find((p) => vw >= p.von && vw < p.bis);
    if (band) { fw *= band.mass; fh *= band.mass; fcx += band.x * fw; fcy += band.y * fh; }

    // Leinwand: Rahmen der Modelle plus Rand, beschnitten auf die Startfläche (alles in Koordinaten des Kastens)
    const lx0 = Math.max(fcx - fw / 2 - RAND.seite * fw, hr.left - r.left);
    const lx1 = Math.min(fcx + fw / 2 + RAND.seite * fw, hr.right - r.left);
    const ly0 = Math.max(fcy - fh / 2 - RAND.oben * fh, hr.top - r.top);
    const ly1 = Math.min(fcy + fh / 2 + RAND.unten * fh, hr.bottom - r.top);
    cw = Math.max(1, Math.round(lx1 - lx0));
    ch = Math.max(1, Math.round(ly1 - ly0));
    leinwand.style.left = `${Math.round(lx0)}px`;
    leinwand.style.top = `${Math.round(ly0)}px`;
    leinwand.style.width = `${cw}px`;
    leinwand.style.height = `${ch}px`;
    fcx -= Math.round(lx0);
    fcy -= Math.round(ly0);
    if (!guete) {
      const wunsch = Math.min(Math.max(devicePixelRatio || 1, 1.5), 2);
      const start = Math.max(1, Math.min(wunsch, Math.sqrt(PIXEL_HOECHSTENS / (cw * ch))));
      guete = gueteRegler({ stufen: stufenAb(start, [1.5, 1.25, 1]), setze: () => { neuEinpassen = true; } });
    }
    renderer.setPixelRatio(guete.wert());
    renderer.setSize(cw, ch, false);

    const k = Math.min(fw / masse.x, fh / masse.y);
    const tan = Math.tan(THREE.MathUtils.degToRad(BLICKWINKEL / 2));
    const abstand = ch / (2 * tan * k);
    kamera.aspect = cw / ch;
    kamera.position.set(0, 0, abstand);
    kamera.near = abstand * 0.5;
    kamera.far = abstand * 2 + masse.z * 4;
    kamera.lookAt(0, 0, 0);
    kamera.setViewOffset(cw, ch, cw / 2 - fcx, ch / 2 - fcy, cw, ch);
    kamera.updateProjectionMatrix();
  }

  // Zustand der Bewegung
  const zeiger = { x: 0, y: 0, hx: 0, hy: 0 };
  const ziehen = { aktiv: false, id: -1, lx: 0, ly: 0, gier: 0, nick: 0, vg: 0, vn: 0 };
  let sinken = 0;
  let schweben = 0;
  let sichtbar = true;
  let ueber = null;
  let auftrittWert = reduziert ? 1 : 0;
  const feinZeiger = matchMedia('(hover: hover) and (pointer: fine)').matches;

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    zeiger.x = (e.clientX / innerWidth) * 2 - 1;
    zeiger.y = (e.clientY / innerHeight) * 2 - 1;
    zeiger.hx = e.clientX; zeiger.hy = e.clientY;
  }, { passive: true });
  held.addEventListener('pointerleave', () => { zeiger.hx = -1; zeiger.hy = -1; });

  if (griff && !reduziert) {
    griff.addEventListener('pointerdown', (e) => {
      ziehen.aktiv = true; ziehen.id = e.pointerId; ziehen.lx = e.clientX; ziehen.ly = e.clientY; ziehen.vg = 0; ziehen.vn = 0;
      griff.setPointerCapture(e.pointerId);
    });
    griff.addEventListener('pointermove', (e) => {
      if (!ziehen.aktiv || e.pointerId !== ziehen.id) return;
      const dx = e.clientX - ziehen.lx, dy = e.clientY - ziehen.ly;
      ziehen.lx = e.clientX; ziehen.ly = e.clientY;
      ziehen.vg = dx * ZEIGER.jePixel; ziehen.vn = dy * ZEIGER.jePixel * 0.6;
      ziehen.gier = THREE.MathUtils.clamp(ziehen.gier + ziehen.vg, -ZEIGER.gierGrenze, ZEIGER.gierGrenze);
      ziehen.nick = THREE.MathUtils.clamp(ziehen.nick + ziehen.vn, -ZEIGER.nickGrenze, ZEIGER.nickGrenze);
    });
    const los = () => { ziehen.aktiv = false; };
    griff.addEventListener('pointerup', los);
    griff.addEventListener('pointercancel', los);
  }

  new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; }).observe(held);
  new ResizeObserver(() => { neuEinpassen = true; }).observe(kasten);
  new ResizeObserver(() => { neuEinpassen = true; }).observe(held);

  if (!reduziert) {
    auftritt.position.y = -AUFTRITT.steigen * masse.y;
    auftritt.rotation.y = AUFTRITT.drehen;
    auftritt.rotation.z = AUFTRITT.rollen;
    wenn('enthuellt', () => {
      const t0 = performance.now();
      const ab = imTakt(() => {
        const q = Math.min(1, (performance.now() - t0) / AUFTRITT.dauer);
        auftrittWert = glatt.aussenKubisch(q);
        if (q >= 1) ab();
      });
    });
  }

  // Rechteck eines Stücks auf dem Bildschirm (für Hover und Karte)
  const ecke = new THREE.Vector3();
  const kastenStueck = new THREE.Box3();
  function bildschirmRechteck(stueck, leinwandRect) {
    kastenStueck.setFromObject(stueck.obj);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      ecke.set(i & 1 ? kastenStueck.max.x : kastenStueck.min.x, i & 2 ? kastenStueck.max.y : kastenStueck.min.y, i & 4 ? kastenStueck.max.z : kastenStueck.min.z).project(kamera);
      const px = leinwandRect.left + (ecke.x * 0.5 + 0.5) * leinwandRect.width;
      const py = leinwandRect.top + (-ecke.y * 0.5 + 0.5) * leinwandRect.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { x0, y0, x1, y1 };
  }

  // Rechte Kante der Überschrift: Links davon steht nie eine Karte.
  const titel = held.querySelector('.held-titel');
  let textRechts = 0;
  const textMessen = () => { textRechts = titel ? titel.getBoundingClientRect().right : 0; for (const s of Object.values(stuecke)) { s.kb = 0; s.kh = 0; } };

  let ersterRahmen;
  const bereit = new Promise((ok) => { ersterRahmen = ok; });

  function zeichnen() {
    renderer.render(szene, kamera);
    if (ersterRahmen) { leinwand.classList.add('ist-bereit'); ersterRahmen(); ersterRahmen = null; }
  }

  function anwenden(dt) {
    const f = dt / 16.667;
    const nach = (wert, ziel, e) => wert + (ziel - wert) * (1 - Math.pow(1 - e, f));

    // Auftritt
    const q = auftrittWert;
    auftritt.position.y = -(1 - q) * AUFTRITT.steigen * masse.y;
    auftritt.rotation.y = (1 - q) * AUFTRITT.drehen;
    auftritt.rotation.z = (1 - q) * AUFTRITT.rollen;

    // Scroll: die Modelle sinken etwas langsamer als die Seite
    const rect = held.getBoundingClientRect();
    const p = THREE.MathUtils.clamp(-rect.top / Math.max(1, rect.height), 0, 1);
    sinken = nach(sinken, p, 0.14);
    treiben.position.y = -sinken * SCROLL_SINKEN * masse.y;
    treiben.rotation.x = sinken * 0.12;

    // Maus und Ziehen
    if (!ziehen.aktiv) {
      ziehen.vg *= Math.pow(ZEIGER.reibung, f);
      ziehen.vn *= Math.pow(ZEIGER.reibung, f);
      ziehen.gier = THREE.MathUtils.clamp(ziehen.gier + ziehen.vg * f, -ZEIGER.gierGrenze, ZEIGER.gierGrenze);
      ziehen.nick = THREE.MathUtils.clamp(ziehen.nick + ziehen.vn * f, -ZEIGER.nickGrenze, ZEIGER.nickGrenze);
      if (Math.abs(ziehen.vg) < 0.002) ziehen.gier = nach(ziehen.gier, 0, 0.04);
      if (Math.abs(ziehen.vn) < 0.002) ziehen.nick = nach(ziehen.nick, 0, 0.04);
    }
    const zielGier = (feinZeiger ? zeiger.x * ZEIGER.gieren : 0) + ziehen.gier;
    const zielNick = (feinZeiger ? zeiger.y * ZEIGER.nicken : 0) + ziehen.nick;
    dreh.rotation.y = nach(dreh.rotation.y, zielGier, 0.16);
    dreh.rotation.x = nach(dreh.rotation.x, zielNick, 0.16);

    // Leichtes Schweben
    schweben += dt * 0.001;
    buehne.position.y = Math.sin(schweben * 0.9) * masse.y * 0.006;
    buehne.rotation.z = Math.sin(schweben * 0.6) * 0.008;

    // Hover über einem Stück: anheben und Karte zeigen
    const lr = leinwand.getBoundingClientRect();
    const hr = rect;
    let treffer = null;
    const mitKarte = feinZeiger && innerWidth >= 1024 && !ziehen.aktiv;
    const rechtecke = {};
    for (const [name, s] of Object.entries(stuecke)) {
      rechtecke[name] = bildschirmRechteck(s, lr);
      const r = rechtecke[name];
      if (mitKarte && zeiger.hx >= r.x0 && zeiger.hx <= r.x1 && zeiger.hy >= r.y0 && zeiger.hy <= r.y1) treffer = name;
    }
    if (treffer !== ueber) ueber = treffer;
    for (const [name, s] of Object.entries(stuecke)) {
      const an = name === ueber ? 1 : 0;
      const h = HEBEN[name];
      s.hub.ziel = an * h.hoch * masse.y;
      s.dreh.ziel = an * h.drehen;
      s.roll.ziel = an * h.rollen;
      s.sicht.ziel = an;
      s.hub.schritt(dt); s.dreh.schritt(dt); s.roll.schritt(dt); s.sicht.schritt(dt);
      s.lehne = nach(s.lehne, (feinZeiger ? zeiger.x : 0) * NEIGEN[name] * 0.12, name === 'tuete' ? 0.06 : 0.15);
      s.gruppe.position.y = s.basisY + s.hub.wert + Math.sin(schweben * (name === 'tuete' ? 1.1 : 1.4) + (name === 'tuete' ? 0 : 1.7)) * masse.y * 0.004;
      s.gruppe.rotation.y = s.dreh.wert + s.lehne;
      s.gruppe.rotation.z = s.roll.wert;

      if (s.karte && kartenEbene) {
        const v = Math.min(1, Math.max(0, s.sicht.wert));
        if (v < 0.001) { if (s.karte.style.opacity !== '0') s.karte.style.opacity = '0'; continue; }
        // Die Karte steht über ihrem Stück: So deckt sie weder die Überschrift links noch das andere Stück.
        const r = rechtecke[name];
        const kb = s.kb || (s.kb = s.karte.offsetWidth), kh = s.kh || (s.kh = s.karte.offsetHeight);
        const mitteX = (r.x0 + r.x1) / 2;
        const x = Math.min(Math.max(mitteX - kb / 2, textRechts + 24), hr.right - kb - 40);
        const y = Math.max(r.y0 - kh - 18, hr.top + 84);
        s.karte.style.opacity = v.toFixed(3);
        s.karte.style.transform = `translate3d(${(x - hr.left).toFixed(1)}px, ${(y - hr.top + (1 - v) * 14).toFixed(1)}px, 0)`;
      }
    }
  }

  for (const s of Object.values(stuecke)) s.basisY = s.gruppe.position.y;

  einpassen();
  textMessen();
  neuEinpassen = false;
  await renderer.compileAsync(szene, kamera).catch(() => {});

  if (reduziert) {
    anwenden(16.667);
    zeichnen();
    new ResizeObserver(() => { einpassen(); anwenden(16.667); zeichnen(); }).observe(kasten);
    return bereit;
  }

  imTakt((dt) => {
    if (!sichtbar || document.hidden) return;
    if (neuEinpassen) { einpassen(); textMessen(); neuEinpassen = false; }
    if (!breite) return;
    anwenden(Math.min(dt, 50));
    zeichnen();
    if (auftrittWert >= 1) guete.bild(dt);
  });
  return bereit;
}
