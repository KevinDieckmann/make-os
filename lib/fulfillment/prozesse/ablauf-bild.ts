// ─── Fulfillment · Prozesse — Ablauf-Bild: Lage der Stufen und Kanten je Zeichenform (C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6, 6.2) ──────
// Abläufe (früherer Vertrieb, als Wissen; der heutige Kreislauf der Markttraktion gilt) werden „schön visualisiert“ (Kevin 22:55):
//   trichter  — gestapelte, nach unten schmalere Scheiben; mehrere Stufen derselben Stufe nebeneinander; Ausstiege rechts daneben
//   fluss     — Spalten von links nach rechts (Stufe = längster Weg über „weiter“), Weichen-Texte an den Kanten, Rückwege als Bögen unterhalb
//   zeitachse — Kreise auf einer Linie, nach Phasen gruppiert; Rückwege als Bögen oberhalb, Schleifen als kleine Rundpfeile
//   baum      — eingerückte Liste (Ebenen)
// Alles mit `beleg: 'ergaenzung'` (nicht aus der Quelle) ist gestrichelt, ebenso Ausstiege. `kreislauf` führt zurück an den Anfang.
// Gerechnet wird NUR hier (die Komponente zeichnet), deterministisch. Rein und client-sicher.

import type { ProzessKnoten, ProzessVorlage, Uebergang } from '../typen';
import { ebeneVon, inReihenfolge, kinderVon } from '../regeln';

export interface AblaufStufe { id: string; x: number; y: number; b: number; h: number; titel: string; art: NonNullable<ProzessKnoten['art']>; gestrichelt: boolean; optional: boolean; heute?: string; phase?: string; rund?: boolean }
export interface AblaufPhase { id: string; x: number; y: number; b: number; h: number; titel: string }
export interface AblaufKante { von: string; nach: string; art: Uebergang['art']; pfad: string; weiche?: string; lx: number; ly: number; gestrichelt: boolean }
export interface AblaufLage { form: NonNullable<ProzessVorlage['form']>; breite: number; hoehe: number; stufen: AblaufStufe[]; phasen: AblaufPhase[]; kanten: AblaufKante[] }

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
