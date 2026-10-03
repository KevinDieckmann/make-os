#!/usr/bin/env node
// ─── MAKE Innovation · Logo-Bau (v5 „Synapse“, 03.10.2026) ──────────────────────────────────────────
// Eine Quelle für das Logo der Landingpage. Kevin 03.10.: „Das Logo einfach bearbeiten und ein bisschen aufmotzen —
// das sieht noch nicht nach Innovation und Seriosität aus.“ Dieselbe Idee wie v4 (MAKE, Rot unter MA = Malin, Grün
// unter KE = Kevin, darunter INNOVATION), aber präzise gebaut:
//   · Buchstaben als Flächen (keine runden Strich-Enden mehr): Stämme, Diagonalen mit waagerechtem Anschnitt an
//     Versalhöhe und Grundlinie, optisch gleiche Strichstärke — eine eigene, ruhige Grotesk.
//   · INNOVATION aus derselben Konstruktion, klein und weit gesperrt (Blocksatz auf Breite von MAKE).
//   · Die zwei Personenstriche als Haarlinien in edleren Tönen; drei Entwürfe (logo-entwuerfe.html):
//       A „Präzision“ — die Striche genau unter MA und KE.
//       B „Synapse“   — die Striche laufen in der Fuge zwischen A und K auf einen Knoten zu, der Rot und Grün
//                        verbindet (der Impuls, aus dem auf der Seite die Neuronen wachsen). ← gewählt
//       C „Intarsie“  — keine Striche: der A-Querstrich rot, der E-Mittelstrich grün.
// Alles ist Fläche auf einem Raster (keine Schrift im SVG — sieht überall gleich aus, lädt nichts nach).
// Schreibt:
//   website/assets/logo/*.svg + favicon-32.png, apple-touch-icon.png, icon-512.png
//   website/favicon.svg                    (= Kachel)
//   website/logo-entwuerfe.html            (drei Entwürfe + alle Fassungen, wird nie ausgeliefert)
// Konstruktion, Farben, Schutzzone, Mindestgröße: website/assets/logo/LOGO.md.
//
//   node scripts/website-logo.mjs          (braucht `sharp` aus node_modules für die PNGs)
//   node scripts/website-logo.mjs --buehne (gibt den Inline-Block für die Bühne von website/index.html aus)
//
// website/pruefen.mjs prüft, dass das Bühnen-Zeichen in website/index.html dieselben Formen trägt wie
// assets/logo/wortmarke.svg — nach einer Änderung hier also auch den Bühnen-Block übernehmen.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEITE = join(WURZEL, 'website');
const LOGO = join(SEITE, 'assets', 'logo');

// ── Farben (CI wie website/css/seite.css) ──
// Rot und Grün edler als v4: weniger Neon, mehr Tiefe (Granat, Smaragd). Auf Dunkel hell genug für Haarlinien.
export const FARBEN = {
  dunkel: { grund: '#0B0E10', ink: '#ECEFED', zusatz: '#9AA5A8', rot: '#C9465C', gruen: '#2FA878' },
  hell: { grund: '#FFFFFF', ink: '#0B0E10', zusatz: '#4F5A5D', rot: '#A82E44', gruen: '#167A55' },
};

const r = n => Math.round(n * 100) / 100;

// ── Flächen-Werkzeug ──────────────────────────────────────────────────────────────────────────────────
// Jede Form ist ein Polygon (im Uhrzeigersinn, SVG-Koordinaten). Überlappende Polygone gleicher Farbe ergeben eine
// saubere Vereinigung (nonzero) — so entstehen Buchstaben ohne Nähte.
const flaeche = pts => {
  let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
  return a < 0 ? pts.slice().reverse() : pts; // a > 0 = im Uhrzeigersinn (y nach unten)
};
const rechteck = (x, y, b, h) => flaeche([[x, y], [x + b, y], [x + b, y + h], [x, y + h]]);
/** Viereck mit waagerechter Ober- und Unterkante: oben [x0, x1] bei y0, unten [x2, x3] bei y1. */
const schraeg = (x0, x1, y0, x2, x3, y1) => flaeche([[x0, y0], [x1, y0], [x3, y1], [x2, y1]]);
const verschieben = (polys, dx, dy = 0) => polys.map(p => p.map(([x, y]) => [x + dx, y + dy]));
const skalieren = (polys, k) => polys.map(p => p.map(([x, y]) => [x * k, y * k]));
const dPoly = polys => polys.map(p => 'M' + p.map(([x, y], i) => `${i ? 'L' : ''}${r(x)} ${r(y)}`).join('') + 'Z').join('');
/** Kreisring (O) — außen im, innen gegen den Uhrzeigersinn: das Innere bleibt frei. */
const ringD = (cx, cy, ra, ri) => `M${r(cx)} ${r(cy - ra)}A${r(ra)} ${r(ra)} 0 1 1 ${r(cx)} ${r(cy + ra)}A${r(ra)} ${r(ra)} 0 1 1 ${r(cx)} ${r(cy - ra)}Z` +
  `M${r(cx)} ${r(cy - ri)}A${r(ri)} ${r(ri)} 0 1 0 ${r(cx)} ${r(cy + ri)}A${r(ri)} ${r(ri)} 0 1 0 ${r(cx)} ${r(cy - ri)}Z`;

/** Horizontale Dicke einer Diagonalen, damit sie quer gemessen `s` stark ist (dx über dy). */
const quer = (s, dx, dy) => s * Math.hypot(dx, dy) / dy;

// ── Die Schrift (Versalhöhe H, Strich s, Breite B) ──────────────────────────────────────────────────────
// Diagonalen sind optisch etwas leichter (92 %) als Stämme. Spitzen (A-Scheitel, M-Kerbe, V-Fuß) enden in einer
// schmalen Fläche (F) statt in einer Spitze — wirkt präzise und bleibt auch klein sauber.
const GLYPHEN = {
  M(H, s, B) {
    // Stämme + ein V als eine Fläche: Kerbe bis zur Grundlinie (architektonisch, ruhig), unten eine schmale Fläche F.
    const F = s * .5, b = (B - F) / 2, t = quer(s * .92, b, H), yi = (B / 2 - t) * H / b;
    const v = flaeche([[0, 0], [t, 0], [B / 2, yi], [B - t, 0], [B, 0], [B - b, H], [b, H]]);
    return { polys: [rechteck(0, 0, s, H), rechteck(B - s, 0, s, H), v], breite: B };
  },
  A(H, s, B, { querstrich = true } = {}) {
    // Zwei Schenkel als eine Fläche, oben eine schmale Fläche F statt Spitze.
    const F = s * .55, a = (B - F) / 2, t = quer(s * .92, a, H), yi = H * (1 - (B / 2 - t) / a);
    const dach = flaeche([[a, 0], [B - a, 0], [B, H], [B - t, H], [B / 2, yi], [t, H], [0, H]]);
    // Querstrich auf 64 % der Höhe, Enden in den Schenkeln verborgen (Mitte der Schenkel).
    const yq = H * .64, hq = s * .86, mitteL = y => t / 2 + a * (1 - y / H);
    const q = rechteck(mitteL(yq), yq, B - 2 * mitteL(yq), hq);
    return { polys: [dach], querstrich: querstrich ? [q] : [], q, breite: B };
  },
  K(H, s, B) {
    // Arm: ein Band von oben rechts bis in die Stammmitte (dort senkrecht angeschnitten, im Stamm verborgen).
    // Bein: zweigt auf 42 % der Höhe vom Arm ab und läuft zur Grundlinie.
    const yMitte = H * .6, ta = quer(s * .94, B - s, yMitte);
    const dx = B - ta / 2 - s / 2, xL = y => (B - ta) - y * dx / yMitte;
    const yL = (B - ta - s / 2) * yMitte / dx, yR = (B - s / 2) * yMitte / dx;
    const arm = flaeche([[B - ta, 0], [B, 0], [s / 2, yR], [s / 2, yL]]);
    const ys = H * .42;
    let tb = s * 1.3; for (let i = 0; i < 3; i++) { const lx0 = xL(ys) + (ta - tb) / 2; tb = quer(s * .96, B - tb - lx0, H - ys); }
    const lx = xL(ys) + (ta - tb) / 2;
    const bein = schraeg(lx, lx + tb, ys, B - tb, B, H);
    return { polys: [rechteck(0, 0, s, H), arm, bein], breite: B };
  },
  E(H, s, B, { mittelstrich = true } = {}) {
    const hm = s * .9, ym = H * .485 - hm / 2;
    const m = rechteck(0, ym, B * .86, hm);
    return { polys: [rechteck(0, 0, s, H), rechteck(0, 0, B, s), rechteck(0, H - s, B, s)], mittelstrich: mittelstrich ? [m] : [], m, breite: B };
  },
  I(H, s) { return { polys: [rechteck(0, 0, s, H)], breite: s }; },
  N(H, s, B) {
    const t = quer(s * .92, B - s, H);
    return { polys: [rechteck(0, 0, s, H), rechteck(B - s, 0, s, H), schraeg(0, t, 0, B - t, B, H)], breite: B };
  },
  V(H, s, B) {
    const F = s * .55, a = (B - F) / 2, t = quer(s * .92, a, H), yi = H * (B / 2 - t) / a;
    return { polys: [flaeche([[0, 0], [t, 0], [B / 2, yi], [B - t, 0], [B, 0], [B - a, H], [a, H]])], breite: B };
  },
  T(H, s, B) { return { polys: [rechteck(0, 0, B, s), rechteck(B / 2 - s / 2, 0, s, H)], breite: B }; },
  O(H, s) { const ra = H * .515, ri = ra - s * 1.04; return { ring: [ra, ri], breite: ra * 2 }; },
};
/** Breite je Buchstabe als Vielfaches der Versalhöhe. */
const BREITE = { M: 1.06, A: 1.0, K: .84, E: .69, N: .8, V: .9, T: .8 };

/** Ein Wort aus der Schrift: Polygone (Tinte), Ringe (O) und Akzente (rot/grün), x ab 0. `sperr` = Abstände. */
function wort(text, H, s, sperr, akzent = {}) {
  let x = 0; const tinte = [], ringe = [], rot = [], gruen = [], kanten = [];
  [...text].forEach((b, i) => {
    const B = BREITE[b] ? BREITE[b] * H : 0;
    const g = GLYPHEN[b](H, s, B, b === 'A' ? { querstrich: !akzent.aRot } : b === 'E' ? { mittelstrich: !akzent.eGruen } : {});
    if (g.ring) ringe.push([x + g.breite / 2, H / 2, ...g.ring]);
    else tinte.push(...verschieben([...g.polys, ...(g.querstrich || []), ...(g.mittelstrich || [])], x));
    if (b === 'A' && akzent.aRot) rot.push(...verschieben([g.q], x));
    if (b === 'E' && akzent.eGruen) gruen.push(...verschieben([g.m], x));
    kanten.push([x, x + g.breite]);
    x += g.breite + (Array.isArray(sperr) ? (sperr[i] ?? 0) : sperr);
  });
  return { tinte, ringe, rot, gruen, kanten, breite: x - (Array.isArray(sperr) ? (sperr[text.length - 1] ?? 0) : sperr) };
}
/** Sperrung so, dass das Wort genau `breite` füllt (Blocksatz). */
function blocksatz(text, H, s, breite) {
  const ohne = wort(text, H, s, 0).breite;
  return wort(text, H, s, (breite - ohne) / (text.length - 1));
}

// ── Wortmarke ─────────────────────────────────────────────────────────────────────────────────────────
// MAKE: Versalhöhe 64, Strich 10.5. Sperrung optisch: M–A 11 (die Diagonale öffnet Raum), A–K 24 (die Fuge — hier
// sitzt der Knoten), K–E 12.
export const MASS = { H: 64, s: 10.5, sperr: [11, 24, 12], linie: 3, abstandLinie: 12, zusatzH: 13.5, zusatzS: 2.3, abstandZusatz: 12, knoten: 5, spalt: 3 };
const MAKE = wort('MAKE', MASS.H, MASS.s, MASS.sperr);
const MAKE_C = wort('MAKE', MASS.H, MASS.s, MASS.sperr, { aRot: true, eGruen: true });
export const BREITE_WORT = MAKE.breite;
const FUGE = (MAKE.kanten[1][1] + MAKE.kanten[2][0]) / 2; // Mitte zwischen A und K
const Y_LINIE = MASS.H + MASS.abstandLinie;
const Y_ZUSATZ = Y_LINIE + MASS.linie + MASS.abstandZusatz;
const HOEHE_BLOCK = Math.ceil(Y_ZUSATZ + MASS.zusatzH * 1.03 + 0.5);
const HOEHE_KOMPAKT = Y_LINIE + MASS.linie;

const pfad = (d, farbe, k = '') => `<path${k} d="${d}" fill="${farbe}"/>`;
const wortInnen = (w, f, dx = 0, dy = 0) => {
  const tinte = verschieben(w.tinte, dx, dy);
  const ringe = w.ringe.map(([cx, cy, ra, ri]) => ringD(cx + dx, cy + dy, ra, ri)).join('');
  return { tinte: dPoly(tinte) + ringe, rot: dPoly(verschieben(w.rot, dx, dy)), gruen: dPoly(verschieben(w.gruen, dx, dy)) };
};

/** Die zwei Personenstriche je Entwurf. `klassen` = Klassen für die Einzeichnen-Animation der Bühne. */
function striche(variante, f, { klassen = false, y = Y_LINIE } = {}) {
  const h = MASS.linie, k = n => (klassen ? ` class="${n}"` : '');
  if (variante === 'C') return '';
  if (variante === 'A') {
    const [ma0, ma1] = [MAKE.kanten[0][0], MAKE.kanten[1][1]], [ke0, ke1] = [MAKE.kanten[2][0], MAKE.kanten[3][1]];
    return `<rect${k('strich strich-ma')} x="${r(ma0)}" y="${r(y)}" width="${r(ma1 - ma0)}" height="${h}" fill="${f.rot}"/>` +
      `<rect${k('strich strich-ke')} x="${r(ke0)}" y="${r(y)}" width="${r(ke1 - ke0)}" height="${h}" fill="${f.gruen}"/>`;
  }
  // B „Synapse“: Rot läuft von links, Grün von rechts auf den Knoten in der Fuge zu (mit schmalem Spalt —
  // wie an einer Synapse). Der Knoten: linke Hälfte Rot, rechte Grün — hier verbinden sich die beiden.
  const kn = MASS.knoten, sp = MASS.spalt, cy = y + h / 2;
  const rotEnde = FUGE - kn - sp, gruenStart = FUGE + kn + sp;
  return `<rect${k('strich strich-ma')} x="0" y="${r(y)}" width="${r(rotEnde)}" height="${h}" fill="${f.rot}"/>` +
    `<rect${k('strich strich-ke')} x="${r(gruenStart)}" y="${r(y)}" width="${r(BREITE_WORT - gruenStart)}" height="${h}" fill="${f.gruen}"/>` +
    `<g${k('knoten')}>` +
    `<path d="M${r(FUGE)} ${r(cy - kn)}A${kn} ${kn} 0 0 0 ${r(FUGE)} ${r(cy + kn)}Z" fill="${f.rot}"/>` +
    `<path d="M${r(FUGE)} ${r(cy - kn)}A${kn} ${kn} 0 0 1 ${r(FUGE)} ${r(cy + kn)}Z" fill="${f.gruen}"/></g>`;
}

/** Wortmarke gestapelt: MAKE · Striche · INNOVATION (Blocksatz auf Breite von MAKE). */
function blockInnen(variante, f, { mitZusatz = true, klassen = false } = {}) {
  const w = wortInnen(variante === 'C' ? MAKE_C : MAKE, f);
  let s = pfad(w.tinte, f.ink, klassen ? ' class="make"' : '');
  if (variante === 'C') s += pfad(w.rot, f.rot) + pfad(w.gruen, f.gruen);
  s += striche(variante, f, { klassen });
  if (mitZusatz) {
    const z = blocksatz('INNOVATION', MASS.zusatzH, MASS.zusatzS, BREITE_WORT);
    s += pfad(wortInnen(z, f, 0, Y_ZUSATZ).tinte, f.zusatz, klassen ? ' class="zusatz"' : '');
  }
  return s;
}

// ── Anordnungen ───────────────────────────────────────────────────────────────────────────────────────
const svg = (b, h, innen, titel = 'MAKE Innovation') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(b)} ${r(h)}" width="${r(b)}" height="${r(h)}" role="img" aria-label="${titel}">${innen}</svg>`;
export const GEWAEHLT = 'B';

/** Wortmarke allein (gestapelt). */
export function wortmarke(ton, variante = GEWAEHLT) {
  return svg(BREITE_WORT, HOEHE_BLOCK, blockInnen(variante, FARBEN[ton]));
}
/** Kompakt (Kopf am Handy): MAKE + Striche, ohne INNOVATION. */
export function kompakt(ton, variante = GEWAEHLT) {
  return svg(BREITE_WORT, HOEHE_KOMPAKT, blockInnen(variante, FARBEN[ton], { mitZusatz: false }));
}
/** Quer (Kopf, Fuß): MAKE + Striche, rechts daneben INNOVATION auf Höhe der Versalmitte. */
export function querLogo(ton, variante = GEWAEHLT) {
  const f = FARBEN[ton], hz = 21, sz = 3.1, abstand = 34;
  const z = wort('INNOVATION', hz, sz, hz * .42);
  const x0 = BREITE_WORT + abstand, y0 = (MASS.H - hz) / 2;
  const b = x0 + z.breite + 1, h = HOEHE_KOMPAKT;
  return svg(b, h, blockInnen(variante, f, { mitZusatz: false }) + pfad(wortInnen(z, f, x0, y0).tinte, f.zusatz));
}
/** Groß (Titel, Druck): Wortmarke mit Schutzzone (rundum 40, transparent). */
export function gross(ton, variante = GEWAEHLT) {
  const rand = 40;
  return svg(BREITE_WORT + 2 * rand, HOEHE_BLOCK + 2 * rand, `<g transform="translate(${rand} ${rand})">${blockInnen(variante, FARBEN[ton])}</g>`);
}
/** Visitenkarten-Profil (zum Hochladen): eigener Grund, Rand 56. Reines SVG ohne Skript, Stil oder externe Verweise. */
export function visitenkarte(ton, variante = GEWAEHLT) {
  const f = FARBEN[ton], rand = 56, b = BREITE_WORT + 2 * rand, h = HOEHE_BLOCK + 2 * rand;
  return svg(b, h, `<rect width="${b}" height="${h}" fill="${f.grund}"/><g transform="translate(${rand} ${rand})">${blockInnen(variante, f)}</g>`);
}

// ── Bildmarke (Monogramm) und Kachel ──────────────────────────────────────────────────────────────────
// Das M aus der Wortmarke, darunter die zwei Striche mit dem Knoten — lesbar bis 16 px.
function monogrammInnen(f, { mitStrichen = true } = {}) {
  const H = 100, s = 17, B = BREITE.M * H, m = GLYPHEN.M(H, s, B);
  const lh = 8, ly = H + 16, kn = 7, sp = 4, mitte = B / 2;
  let innen = pfad(dPoly(m.polys), f.ink);
  if (mitStrichen) {
    innen += `<rect x="0" y="${ly}" width="${r(mitte - kn - sp)}" height="${lh}" fill="${f.rot}"/>` +
      `<rect x="${r(mitte + kn + sp)}" y="${ly}" width="${r(B - mitte - kn - sp)}" height="${lh}" fill="${f.gruen}"/>` +
      `<path d="M${r(mitte)} ${ly + lh / 2 - kn}A${kn} ${kn} 0 0 0 ${r(mitte)} ${ly + lh / 2 + kn}Z" fill="${f.rot}"/>` +
      `<path d="M${r(mitte)} ${ly + lh / 2 - kn}A${kn} ${kn} 0 0 1 ${r(mitte)} ${ly + lh / 2 + kn}Z" fill="${f.gruen}"/>`;
  }
  return { innen, b: B, h: ly + lh / 2 + kn };
}
export function bildmarke(ton) {
  const m = monogrammInnen(FARBEN[ton]);
  return svg(m.b, m.h, m.innen);
}
/** App-Kachel / Favicon: Monogramm auf dunklem Quadrat (Schutzzone eingebaut). */
export function kachel({ rund = true } = {}) {
  const f = FARBEN.dunkel, m = monogrammInnen(f), k = 128 / m.b;
  const grund = `<rect width="240" height="240"${rund ? ' rx="52"' : ''} fill="${f.grund}"/>`;
  return svg(240, 240, `${grund}<g transform="translate(${r(120 - m.b * k / 2)} ${r(120 - m.h * k / 2)}) scale(${r(k)})">${m.innen}</g>`);
}

/** Inline-Fassung für die Bühne (Klassen für die Einzeichnen-Animation, dekorativ: aria-hidden). */
export function buehne() {
  return `<svg class="zeichen" viewBox="0 0 ${r(BREITE_WORT)} ${HOEHE_BLOCK}" aria-hidden="true" focusable="false">${blockInnen(GEWAEHLT, FARBEN.dunkel, { klassen: true })}</svg>`;
}

// ── Übersicht (logo-entwuerfe.html) ───────────────────────────────────────────────────────────────────
const KOPF = '<?xml version="1.0" encoding="UTF-8"?>\n';
const ENTWUERFE = {
  A: ['Präzision', 'Die Idee aus v4, präzise gebaut: eigene Grotesk aus Flächen statt runder Linien, Haarlinien genau unter MA und KE, INNOVATION klein und weit gesperrt. Ruhig, seriös — aber ohne eigenes Zeichen.'],
  B: ['Synapse', 'Rot läuft von links, Grün von rechts auf einen Knoten in der Fuge zwischen A und K zu — mit schmalem Spalt, wie an einer Synapse. Der Knoten trägt beide Farben: hier verbinden sich Malin und Kevin, hier entsteht der Impuls. Auf der Seite wachsen aus genau diesem Knoten die Neuronen. Gewählt: seriös in der Schrift, eigen im Detail, und es erzählt die Seite.'],
  C: ['Intarsie', 'Keine Striche unter dem Wort: der Querstrich des A ist rot, der Mittelstrich des E grün — die Personen stecken in den Buchstaben. Sehr kompakt, aber klein schwer lesbar und weiter weg von der bisherigen Idee.'],
};
function uebersicht() {
  const zeile = (titel, inhalt) => `<div class="ent-zeile"><span class="mikro">${titel}</span><div class="ent-flaeche">${inhalt}</div></div>`;
  const entwurf = ([v, [name, text]]) => `
  <section class="ent" aria-labelledby="ent-${v}">
    <div class="ent-kopf"><h2 id="ent-${v}">Entwurf ${v} · ${name}</h2>${v === GEWAEHLT ? '<span class="abzeichen gewaehlt">Gewählt</span>' : ''}</div>
    <p class="ent-text">${text}</p>
    ${zeile('Wortmarke · dunkel und hell', `<div class="ent-dunkel ent-gestapelt">${wortmarke('dunkel', v)}</div><div class="ent-hell ent-gestapelt">${wortmarke('hell', v)}</div>`)}
    ${zeile('Quer (Kopf)', `<div class="ent-dunkel ent-quer">${querLogo('dunkel', v)}</div><div class="ent-hell ent-quer">${querLogo('hell', v)}</div>`)}
    ${zeile('Klein: 120 px und 64 px breit', `<div class="ent-dunkel ent-klein"><span class="b120">${wortmarke('dunkel', v)}</span><span class="b64">${kompakt('dunkel', v)}</span></div><div class="ent-hell ent-klein"><span class="b120">${wortmarke('hell', v)}</span><span class="b64">${kompakt('hell', v)}</span></div>`)}
  </section>`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Logo-Entwürfe — MAKE Innovation</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0B0E10">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/seite.css">
</head>
<body>
<!-- Erzeugt von scripts/website-logo.mjs — nicht von Hand ändern. Wird nie ausgeliefert (Caddy: @intern). -->
<main id="inhalt" class="recht entwuerfe">
  <div class="wrap">
    <span class="mikro">Arbeitsdatei · nur lokal</span>
    <h1>MAKE-Logo (v5) — drei Entwürfe</h1>
    <p>Dieselbe Idee wie bisher — MAKE, Rot unter MA (Malin), Grün unter KE (Kevin), darunter INNOVATION —, aber präzise gebaut: eine eigene Grotesk aus Flächen (keine runden Strich-Enden), optisch ausgeglichene Strichstärken und Abstände, Haarlinien in edleren Tönen, INNOVATION klein und weit gesperrt. Konstruktion, Schutzzone und Mindestgrößen: <code>assets/logo/LOGO.md</code>.</p>
${Object.entries(ENTWUERFE).map(entwurf).join('\n')}
  <section class="ent" aria-labelledby="ent-satz">
    <div class="ent-kopf"><h2 id="ent-satz">Gewählt (${GEWAEHLT}) — alle Fassungen</h2></div>
    ${zeile('Groß (Titel, Druck)', `<div class="ent-dunkel ent-quer">${gross('dunkel')}</div><div class="ent-hell ent-quer">${gross('hell')}</div>`)}
    ${zeile('Kompakt (Kopf am Handy)', `<div class="ent-dunkel ent-quer">${kompakt('dunkel')}</div><div class="ent-hell ent-quer">${kompakt('hell')}</div>`)}
    ${zeile('Monogramm (Bildmarke)', `<div class="ent-dunkel ent-gross">${bildmarke('dunkel')}</div><div class="ent-hell ent-gross">${bildmarke('hell')}</div>`)}
    ${zeile('Favicon · 64 / 32 / 16 px', `<div class="ent-dunkel ent-icons"><span class="i64">${kachel()}</span><span class="i32">${kachel()}</span><span class="i16">${kachel()}</span></div>`)}
    ${zeile('Visitenkarten-Profil (zum Hochladen)', `<div class="ent-dunkel ent-quer">${visitenkarte('dunkel')}</div><div class="ent-hell ent-quer">${visitenkarte('hell')}</div>`)}
  </section>
  </div>
</main>
</body>
</html>
`;
}

async function schreiben() {
  mkdirSync(LOGO, { recursive: true });
  const dateien = {
    'bildmarke.svg': bildmarke('dunkel'),
    'bildmarke-hell.svg': bildmarke('hell'),
    'wortmarke.svg': wortmarke('dunkel'),
    'wortmarke-hell.svg': wortmarke('hell'),
    'kachel.svg': kachel(),
    'quer.svg': querLogo('dunkel'),
    'quer-hell.svg': querLogo('hell'),
    'kompakt.svg': kompakt('dunkel'),
    'kompakt-hell.svg': kompakt('hell'),
    'gross.svg': gross('dunkel'),
    'gross-hell.svg': gross('hell'),
    'visitenkarte-make.svg': visitenkarte('dunkel'),
    'visitenkarte-make-hell.svg': visitenkarte('hell'),
  };
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(LOGO, name), KOPF + inhalt + '\n');
  writeFileSync(join(SEITE, 'favicon.svg'), KOPF + kachel() + '\n');
  writeFileSync(join(SEITE, 'logo-entwuerfe.html'), uebersicht());

  const { default: sharp } = await import('sharp');
  const png = async (inhalt, groesse, name) =>
    sharp(Buffer.from(inhalt), { density: Math.ceil(72 * groesse / 240) * 4 }).resize(groesse, groesse).png({ compressionLevel: 9 }).toFile(join(LOGO, name));
  await png(kachel(), 32, 'favicon-32.png');
  await png(kachel({ rund: false }), 180, 'apple-touch-icon.png'); // iOS rundet selbst ab
  await png(kachel(), 512, 'icon-512.png');
  console.log(`✓ ${Object.keys(dateien).length} SVG, 3 PNG, favicon.svg, logo-entwuerfe.html geschrieben (Wortmarke ${r(BREITE_WORT)} × ${HOEHE_BLOCK}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--buehne')) console.log(buehne());
  else await schreiben();
}
