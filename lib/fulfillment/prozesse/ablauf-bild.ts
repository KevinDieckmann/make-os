// ─── Fulfillment · Prozesse — Ablauf-Bild: Lage der Stufen und Kanten je Zeichenform (C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6, 6.2) ──────
// Abläufe (früherer Vertrieb, als Wissen; der heutige Kreislauf der Markttraktion gilt) werden „schön visualisiert“ (Entscheidung 22:55):
//   trichter  — gestapelte, nach unten schmalere Scheiben; mehrere Stufen derselben Stufe nebeneinander; Ausstiege rechts daneben
//   fluss     — Spalten von links nach rechts (Stufe = längster Weg über „weiter“), Weichen-Texte an den Kanten, Rückwege als Bögen unterhalb
//   zeitachse — Kreise auf einer Linie, nach Phasen gruppiert; Rückwege als Bögen oberhalb, Schleifen als kleine Rundpfeile
//   kreis     — (Sales Circle, 11.10.) Stufen aus der Quelle im Uhrzeigersinn auf einem inneren Kreis ab 12 Uhr, „weiter“/„zurück an den Anfang“
//               als Bögen auf dem Kreis, Rückwege als Sehnen durch die Mitte; Ergänzungen (`beleg: 'ergaenzung'`, z. B. Empfehlung) auf einem
//               GESTRICHELTEN äußeren Ring neben ihrer Herkunftsstufe; Ausstiege außen (rot, gestrichelt)
//   baum      — eingerückte Liste (Ebenen)
// Alles mit `beleg: 'ergaenzung'` (nicht aus der Quelle) ist gestrichelt, ebenso Ausstiege. `kreislauf` führt zurück an den Anfang.
// Gerechnet wird NUR hier (die Komponente zeichnet), deterministisch. Rein und client-sicher.

import type { ProzessKnoten, ProzessVorlage, Uebergang } from '../typen';
import { ebeneVon, inReihenfolge, kinderVon } from '../regeln';

export interface AblaufStufe { id: string; x: number; y: number; b: number; h: number; titel: string; art: NonNullable<ProzessKnoten['art']>; gestrichelt: boolean; optional: boolean; heute?: string; phase?: string; rund?: boolean }
export interface AblaufPhase { id: string; x: number; y: number; b: number; h: number; titel: string }
export interface AblaufKante { von: string; nach: string; art: Uebergang['art']; pfad: string; weiche?: string; lx: number; ly: number; gestrichelt: boolean }
/** Ein Ring der Kreis-Form (innen = Führung, außen = Empfehlungsring, gestrichelt). Gezeichnet als Kreis; rechnet nur dieses Modul. */
export interface AblaufRing { cx: number; cy: number; r: number; gestrichelt: boolean; titel?: string; tx?: number; ty?: number; /** nur Lage (Mitte, Radius) — nicht zeichnen; die Bögen zeigen den Kreis */ nurLage?: boolean }
export interface AblaufLage { form: NonNullable<ProzessVorlage['form']>; breite: number; hoehe: number; stufen: AblaufStufe[]; phasen: AblaufPhase[]; kanten: AblaufKante[]; ringe?: AblaufRing[] }

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Die Stufen eines Ablaufs (tiefste Ebene unter der Wurzel bzw. den Phasen) und die Phasen (Ebene 2, wenn darunter Stufen hängen). */
export function stufenUndPhasen(v: Pick<ProzessVorlage, 'knoten'>): { stufen: ProzessKnoten[]; phasen: ProzessKnoten[] } {
  const wurzel = v.knoten.find(k => !k.elternId);
  if (!wurzel) return { stufen: [], phasen: [] };
  const e2 = kinderVon(wurzel.id, v.knoten);
  const mitKindern = e2.filter(k => kinderVon(k.id, v.knoten).length > 0);
  if (!mitKindern.length) return { stufen: e2, phasen: [] };
  const stufen: ProzessKnoten[] = [];
  for (const p of e2) { const k = kinderVon(p.id, v.knoten); stufen.push(...(k.length ? k : [p])); }
  return { stufen, phasen: mitKindern };
}

/** Stufe je Knoten = längster Weg über „weiter“ (und Ausstiege) — Rückwege, Schleifen und der Kreislauf zählen nicht. */
export function stufenTiefe(ids: readonly string[], kanten: readonly Uebergang[]): Map<string, number> {
  const tiefe = new Map(ids.map(i => [i, 0]));
  const vor = kanten.filter(k => (k.art === 'weiter' || k.art === 'ausstieg') && tiefe.has(k.von) && tiefe.has(k.nach) && k.von !== k.nach);
  // Höchstens n Runden (Bellman-Ford-artig): Kreise in „weiter“ (Datenfehler) laufen nicht endlos.
  for (let r = 0; r < ids.length; r++) {
    let anders = false;
    for (const k of vor) {
      const t = (tiefe.get(k.von) ?? 0) + 1;
      if (t > (tiefe.get(k.nach) ?? 0) && t < ids.length) { tiefe.set(k.nach, t); anders = true; }
    }
    if (!anders) break;
  }
  return tiefe;
}

const kurve = (x1: number, y1: number, cx1: number, cy1: number, cx2: number, cy2: number, x2: number, y2: number) =>
  `M ${r1(x1)} ${r1(y1)} C ${r1(cx1)} ${r1(cy1)} ${r1(cx2)} ${r1(cy2)} ${r1(x2)} ${r1(y2)}`;

function kantenFuer(v: Pick<ProzessVorlage, 'uebergaenge'>, st: Map<string, AblaufStufe>, form: AblaufLage['form'], hoehe: number): AblaufKante[] {
  return v.uebergaenge.filter(u => st.has(u.von) && st.has(u.nach)).map(u => {
    const a = st.get(u.von)!, b = st.get(u.nach)!;
    const ax = a.x + a.b / 2, ay = a.y + a.h / 2, bx = b.x + b.b / 2, by = b.y + b.h / 2;
    let pfad: string, lx = (ax + bx) / 2, ly = (ay + by) / 2;
    const gestrichelt = u.beleg === 'ergaenzung' || u.art === 'ausstieg';
    if (u.art === 'schleife') {
      const x = a.x + a.b, y = a.y + 6;
      pfad = `M ${r1(x)} ${r1(y)} c 22 -16 22 ${r1(a.h - 4)} 0 ${r1(a.h - 12)}`; lx = x + 18; ly = a.y - 4;
    } else if (u.art === 'rueckweg' || u.art === 'kreislauf') {
      if (form === 'fluss') {
        const tief = Math.max(a.y + a.h, b.y + b.h) + (u.art === 'kreislauf' ? 46 : 26);
        pfad = kurve(ax, a.y + a.h, ax, tief, bx, tief, bx, b.y + b.h); ly = Math.min(hoehe - 6, tief - 4);
      } else if (form === 'zeitachse') {
        const hoch = Math.min(a.y, b.y) - (u.art === 'kreislauf' ? 44 : 26);
        pfad = kurve(ax, a.y, ax, hoch, bx, hoch, bx, b.y); ly = hoch + 2;
      } else {
        const seite = Math.min(a.x, b.x) - (u.art === 'kreislauf' ? 40 : 22);
        pfad = kurve(a.x, ay, seite, ay, seite, by, b.x, by); lx = seite + 4;
      }
    } else if (form === 'fluss' || form === 'zeitachse') {
      pfad = `M ${r1(a.x + a.b)} ${r1(ay)} L ${r1(b.x)} ${r1(by)}`;
      if (b.x <= a.x) pfad = kurve(ax, a.y + a.h, ax, a.y + a.h + 18, bx, b.y - 18, bx, b.y);
    } else {
      pfad = by > ay ? `M ${r1(ax)} ${r1(a.y + a.h)} L ${r1(bx)} ${r1(b.y)}` : kurve(ax, a.y, ax, a.y - 20, bx, b.y + b.h + 20, bx, b.y + b.h);
      if (u.art === 'ausstieg') pfad = `M ${r1(a.x + a.b)} ${r1(ay)} L ${r1(b.x)} ${r1(by)}`;
    }
    return { von: u.von, nach: u.nach, art: u.art, pfad, ...(u.weiche ? { weiche: u.weiche } : {}), lx: r1(lx), ly: r1(ly), gestrichelt };
  });
}

// ── Kreis (Sales Circle) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Punkt auf dem Rand einer Stufe in Richtung (zx, zy) — damit Pfeile an der Kante enden, nicht unter dem Kasten. */
function randPunkt(s: Pick<AblaufStufe, 'x' | 'y' | 'b' | 'h'>, zx: number, zy: number, luft = 3): [number, number] {
  const mx = s.x + s.b / 2, my = s.y + s.h / 2, dx = zx - mx, dy = zy - my;
  if (!dx && !dy) return [mx, my];
  const f = Math.min(dx ? (s.b / 2 + luft) / Math.abs(dx) : 1e9, dy ? (s.h / 2 + luft) / Math.abs(dy) : 1e9);
  return [mx + dx * Math.min(1, f), my + dy * Math.min(1, f)];
}
/** Winkel-Abstand vom Mittelpunkt einer Stufe auf dem Kreis bis zu ihrem Rand (Schritte von 0,01 rad) — Bögen beginnen außerhalb des Kastens. */
function austritt(s: Pick<AblaufStufe, 'b' | 'h'>, cx: number, cy: number, r: number, theta: number, richtung: 1 | -1): number {
  const mx = cx + r * Math.cos(theta), my = cy + r * Math.sin(theta);
  for (let d = 0; d < Math.PI; d += 0.01) {
    const x = cx + r * Math.cos(theta + richtung * d), y = cy + r * Math.sin(theta + richtung * d);
    if (Math.abs(x - mx) > s.b / 2 + 4 || Math.abs(y - my) > s.h / 2 + 4) return d;
  }
  return 0.3;
}

function kreisLage(v: Pick<ProzessVorlage, 'knoten' | 'uebergaenge'>, stufen: ProzessKnoten[], breite: number, roh: (s: ProzessKnoten) => Omit<AblaufStufe, 'x' | 'y' | 'b' | 'h'>): AblaufLage {
  const R = 16, H = 32;
  // Reihenfolge im Kreis = Lese-Reihenfolge der Stufen (Rang) — NICHT die Tiefe über „weiter“: in einem Kreis führen Wege (z. B. Empfehlung → Kontakt)
  // zurück an den Anfang, die Tiefe wäre dort bedeutungslos.
  const ordnung = new Map(stufen.map((s, i) => [s.id, i]));
  const nachReihe = (a: ProzessKnoten, b: ProzessKnoten) => (ordnung.get(a.id) ?? 0) - (ordnung.get(b.id) ?? 0);
  const innen = stufen.filter(s => s.art !== 'ausstieg' && s.beleg !== 'ergaenzung').sort(nachReihe);
  const aussen = stufen.filter(s => !innen.includes(s)).sort(nachReihe);
  const ring = aussen.some(s => s.beleg === 'ergaenzung');
  const n = Math.max(1, innen.length);
  const platz = Math.max(160, Math.min(breite - 2 * R, 760));
  const rI = r1(Math.max(90, platz / 2 - (aussen.length ? 120 : 70)));
  const rA = r1(rI + 84);
  const bI = r1(Math.max(76, Math.min(140, 2 * rI * Math.sin(Math.PI / n) - 14)));
  const cx = r1(Math.max(breite, platz + 2 * R) / 2), cy = r1(R + 20 + (aussen.length ? rA : rI) + H / 2);
  const winkel = new Map<string, number>();
  const st: AblaufStufe[] = [];
  innen.forEach((s, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
    winkel.set(s.id, t);
    st.push({ ...roh(s), x: r1(cx + rI * Math.cos(t) - bI / 2), y: r1(cy + rI * Math.sin(t) - H / 2), b: bI, h: H, rund: true });
  });
  // Außen: neben der Stufe, aus der sie kommt (sonst: zu der sie führt; sonst gleichmäßig) — mehrere am selben Anker gefächert.
  const proAnker = new Map<string, number>();
  aussen.forEach((s, i) => {
    const von = v.uebergaenge.find(u => u.nach === s.id && winkel.has(u.von))?.von ?? v.uebergaenge.find(u => u.von === s.id && winkel.has(u.nach))?.nach;
    const anker = von ? winkel.get(von)! : -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / Math.max(1, aussen.length);
    const k = von ?? `frei-${i}`;
    const nr = proAnker.get(k) ?? 0; proAnker.set(k, nr + 1);
    const t = anker + (nr === 0 ? 0.28 : nr % 2 ? -0.28 - 0.3 * nr : 0.28 + 0.3 * nr);
    winkel.set(s.id, t);
    const bA = r1(Math.min(130, Math.max(76, bI)));
    st.push({ ...roh(s), x: r1(cx + rA * Math.cos(t) - bA / 2), y: r1(cy + rA * Math.sin(t) - H / 2), b: bA, h: H, rund: true });
  });
  const nach = new Map(st.map(x => [x.id, x]));
  const kanten: AblaufKante[] = v.uebergaenge.filter(u => nach.has(u.von) && nach.has(u.nach)).map(u => {
    const a = nach.get(u.von)!, b = nach.get(u.nach)!;
    const gestrichelt = u.beleg === 'ergaenzung' || u.art === 'ausstieg' || a.gestrichelt || b.gestrichelt;
    const beideInnen = innen.some(x => x.id === a.id) && innen.some(x => x.id === b.id);
    const ta = winkel.get(a.id)!, tb = winkel.get(b.id)!;
    let pfad: string, lx: number, ly: number;
    if (u.art === 'schleife' || a.id === b.id) {
      const x = a.x + a.b, y = a.y + 6;
      pfad = `M ${r1(x)} ${r1(y)} c 22 -16 22 ${r1(a.h - 4)} 0 ${r1(a.h - 12)}`; lx = x + 18; ly = a.y - 4;
    } else if (beideInnen && (u.art === 'weiter' || u.art === 'kreislauf')) {
      // Bogen auf dem Kreis im Uhrzeigersinn (Sweep 1), vom Rand der einen bis zum Rand der anderen Stufe.
      let sweep = tb - ta; while (sweep <= 0) sweep += 2 * Math.PI;
      const s0 = ta + austritt(a, cx, cy, rI, ta, 1), s1 = tb - austritt(b, cx, cy, rI, tb, -1);
      const bogen = s1 > s0 ? s1 - s0 : s1 + 2 * Math.PI - s0;
      pfad = `M ${r1(cx + rI * Math.cos(s0))} ${r1(cy + rI * Math.sin(s0))} A ${rI} ${rI} 0 ${bogen > Math.PI ? 1 : 0} 1 ${r1(cx + rI * Math.cos(s1))} ${r1(cy + rI * Math.sin(s1))}`;
      const m = ta + sweep / 2;
      lx = cx + (rI + 18) * Math.cos(m); ly = cy + (rI + 18) * Math.sin(m);
    } else if (beideInnen) {
      // Rückweg (bzw. Abkürzung) als Sehne durch das Innere.
      const [x1, y1] = randPunkt(a, cx, cy), [x2, y2] = randPunkt(b, cx, cy);
      const kx = (x1 + x2) / 2 * 0.5 + cx * 0.5, ky = (y1 + y2) / 2 * 0.5 + cy * 0.5;
      pfad = `M ${r1(x1)} ${r1(y1)} Q ${r1(kx)} ${r1(ky)} ${r1(x2)} ${r1(y2)}`;
      lx = kx; ly = ky;
    } else {
      const [x1, y1] = randPunkt(a, b.x + b.b / 2, b.y + b.h / 2), [x2, y2] = randPunkt(b, a.x + a.b / 2, a.y + a.h / 2);
      pfad = `M ${r1(x1)} ${r1(y1)} L ${r1(x2)} ${r1(y2)}`;
      lx = (x1 + x2) / 2; ly = (y1 + y2) / 2;
    }
    return { von: u.von, nach: u.nach, art: u.art, pfad, ...(u.weiche ? { weiche: u.weiche } : {}), lx: r1(lx), ly: r1(ly), gestrichelt };
  });
  // Beschriftung des Empfehlungsrings dort, wo außen am wenigsten steht (acht Kandidaten, der mit dem größten Abstand gewinnt).
  const aussenWinkel = aussen.map(s => winkel.get(s.id)!);
  const abstand = (t: number) => Math.min(Math.PI, ...aussenWinkel.map(w => { const d = Math.abs(((t - w) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d; }));
  const tT = [0, 1, 2, 3, 4, 5, 6, 7].map(i => -Math.PI / 2 + (i * Math.PI) / 4).reduce((best, t) => (abstand(t) > abstand(best) + 1e-9 ? t : best));
  const ringe: AblaufRing[] = [
    { cx, cy, r: rI, gestrichelt: false, nurLage: true },
    ...(ring ? [{ cx, cy, r: rA, gestrichelt: true, titel: 'Empfehlungen', tx: r1(cx + (rA + 14) * Math.cos(tT)), ty: r1(cy + (rA + 14) * Math.sin(tT) + 4) }] : []),
  ];
  const hoehe = r1(cy + (aussen.length ? rA : rI) + H / 2 + 24 + R);
  return { form: 'kreis', breite: r1(Math.max(breite, platz + 2 * R)), hoehe, stufen: st, phasen: [], kanten, ringe };
}

/** Die Lage eines Ablaufs für eine Breite (px) in seiner Zeichenform (fehlt sie: Baum). */
export function ablaufLage(v: Pick<ProzessVorlage, 'knoten' | 'uebergaenge' | 'form'>, breite: number): AblaufLage {
  const form = v.form ?? 'baum';
  const { stufen, phasen } = stufenUndPhasen(v);
  const phaseVon = new Map(stufen.map(s => [s.id, s.elternId && phasen.some(p => p.id === s.elternId) ? s.elternId : undefined]));
  const roh = (s: ProzessKnoten) => ({ id: s.id, titel: s.titel, art: s.art ?? 'stufe' as const, gestrichelt: s.beleg === 'ergaenzung', optional: !!s.optional, ...(s.heute ? { heute: s.heute } : {}), ...(phaseVon.get(s.id) ? { phase: phaseVon.get(s.id) } : {}) });
  const R = 16;

  if (form === 'baum') {
    const l = inReihenfolge(v.knoten).filter(k => k.elternId);
    const st: AblaufStufe[] = l.map((k, i) => ({ ...roh(k), x: R + (ebeneVon(k, v.knoten) - 2) * 22, y: R + i * 40, b: Math.max(160, breite - 2 * R - (ebeneVon(k, v.knoten) - 2) * 22), h: 32 }));
    return { form, breite, hoehe: R * 2 + l.length * 40, stufen: st, phasen: [], kanten: [] };
  }

  if (form === 'kreis') return kreisLage(v, stufen, breite, roh);

  const tiefe = stufenTiefe(stufen.map(s => s.id), v.uebergaenge);
  const ebenen = Math.max(1, ...Array.from(tiefe.values()).map(x => x + 1));

  if (form === 'trichter') {
    const haupt = stufen.filter(s => s.art !== 'ausstieg');
    const aus = stufen.filter(s => s.art === 'ausstieg');
    const seitB = aus.length ? Math.min(150, breite * 0.24) : 0;
    const innen = breite - 2 * R - (seitB ? seitB + 14 : 0);
    const H = 46, L = 14;
    const st: AblaufStufe[] = [];
    for (let e = 0; e < ebenen; e++) {
      const reihe = haupt.filter(s => (tiefe.get(s.id) ?? 0) === e);
      if (!reihe.length) continue;
      const w = innen * (1 - (0.5 * e) / Math.max(1, ebenen - 1));
      const x0 = R + (innen - w) / 2;
      const b = (w - 8 * (reihe.length - 1)) / reihe.length;
      reihe.forEach((s, i) => st.push({ ...roh(s), x: r1(x0 + i * (b + 8)), y: R + 24 + e * (H + L), b: r1(b), h: H }));
    }
    aus.forEach((s, i) => {
      const quelle = v.uebergaenge.find(u => u.nach === s.id);
      const e = quelle ? (tiefe.get(quelle.von) ?? i) : i;
      st.push({ ...roh(s), x: r1(breite - R - seitB), y: R + 24 + Math.min(e, ebenen - 1) * (H + L) + (i % 2) * 6, b: r1(seitB), h: H - 8 });
    });
    const hoehe = R * 2 + 24 + ebenen * (H + L) + 30;
    return { form, breite, hoehe, stufen: st, phasen: [], kanten: kantenFuer(v, new Map(st.map(s => [s.id, s])), form, hoehe) };
  }

  if (form === 'zeitachse') {
    const reihe = phasen.length ? phasen.flatMap(p => stufen.filter(s => phaseVon.get(s.id) === p.id)).concat(stufen.filter(s => !phaseVon.get(s.id))) : stufen;
    const schritt = Math.max(84, (breite - 2 * R) / Math.max(1, reihe.length));
    const b = Math.min(schritt - 10, 120);
    const linieY = 120;
    const st: AblaufStufe[] = reihe.map((s, i) => ({ ...roh(s), x: r1(R + i * schritt + (schritt - b) / 2), y: linieY - 16 + (s.art === 'ausstieg' ? 70 : 0), b: r1(b), h: 32, rund: true }));
    const ph: AblaufPhase[] = phasen.map(p => {
      const meine = st.filter(s => s.phase === p.id);
      const x = meine.length ? Math.min(...meine.map(s => s.x)) - 4 : R, x2 = meine.length ? Math.max(...meine.map(s => s.x + s.b)) + 4 : R;
      return { id: p.id, x: r1(x), y: linieY + 40, b: r1(x2 - x), h: 26, titel: p.titel };
    });
    const brt = Math.max(breite, R * 2 + reihe.length * schritt);
    const hoehe = linieY + 40 + (ph.length ? 40 : 0) + 70;
    return { form, breite: r1(brt), hoehe, stufen: st, phasen: ph, kanten: kantenFuer(v, new Map(st.map(s => [s.id, s])), form, hoehe) };
  }

  // Fluss: Spalten nach Tiefe, darin untereinander (Rauten für Weichen zeichnet die Komponente an den Kanten mit `weiche`).
  const spaltenB = Math.max(150, (breite - 2 * R) / ebenen);
  const b = Math.min(spaltenB - 34, 190), H = 50, L = 22;
  const jeSpalte = new Map<number, number>();
  const st: AblaufStufe[] = [];
  for (const s of stufen) {
    const t = tiefe.get(s.id) ?? 0;
    const n = jeSpalte.get(t) ?? 0;
    jeSpalte.set(t, n + 1);
    st.push({ ...roh(s), x: r1(R + t * spaltenB + (spaltenB - b) / 2), y: R + 10 + n * (H + L), b: r1(b), h: H });
  }
  const zeilen = Math.max(1, ...Array.from(jeSpalte.values()));
  const hoehe = R * 2 + 10 + zeilen * (H + L) + 60;
  return { form, breite: r1(Math.max(breite, R * 2 + ebenen * spaltenB)), hoehe, stufen: st, phasen: [], kanten: kantenFuer(v, new Map(st.map(s => [s.id, s])), form, hoehe) };
}

/** Für das Handy (< 720 px): die Stufen als Liste in Lese-Reihenfolge mit ihren ausgehenden Wegen. */
export function ablaufListe(v: Pick<ProzessVorlage, 'knoten' | 'uebergaenge'>): { id: string; titel: string; art: string; gestrichelt: boolean; phase?: string; wege: { nach: string; art: Uebergang['art']; weiche?: string; gestrichelt: boolean }[] }[] {
  const { stufen, phasen } = stufenUndPhasen(v);
  const titel = new Map(v.knoten.map(k => [k.id, k.titel]));
  const phase = new Map(stufen.map(s => [s.id, phasen.find(p => p.id === s.elternId)?.titel]));
  return stufen.map(s => ({
    id: s.id, titel: s.titel, art: s.art ?? 'stufe', gestrichelt: s.beleg === 'ergaenzung', ...(phase.get(s.id) ? { phase: phase.get(s.id) } : {}),
    wege: v.uebergaenge.filter(u => u.von === s.id).map(u => ({ nach: titel.get(u.nach) ?? '?', art: u.art, ...(u.weiche ? { weiche: u.weiche } : {}), gestrichelt: u.beleg === 'ergaenzung' || u.art === 'ausstieg' })),
  }));
}
