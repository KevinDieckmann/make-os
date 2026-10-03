// ─── Lichtfäden (03.10.): Dichte aus echten Daten, Mathematik, Markierungs-Layout, reduzierte Bewegung, Website-Kopie ─
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faedenDichte, lichtText, montag, DICHTE_GEWICHT, OHNE_ZIEL, MAX_ZIEL_BUENDEL, type DichteAufgabe } from '@/lib/lichtfaeden/dichte';
import { fadenSaaten, versatz, gauss, saettigen, wertBei, kurve, textSaat, zufall, spreizung, LICHTFAEDEN } from '@/lib/lichtfaeden/band';
import { starteLauf } from '@/lib/lichtfaeden/zeichnen';
import { ZEITBAND_MASSE, zeitbandMasse, hellBei, type ZeitbandDaten } from '@/lib/lichtfaeden/zeitband';
import { buendelFarben } from '@/lib/lichtfaeden/farben';
import { FADEN_FARBEN } from '@/lib/make-one/design';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import { stapeln } from '@/lib/planung/zeitstrahl';
import { erzeugen, ZIEL } from '../scripts/lichtfaeden-website.mjs';

const RAUM = { von: '2026-01-01', bis: '2027-12-31' };
const ZIELE = [
  { id: 'z-a', titel: 'Alpha', space: 'business' as const, rang: 2 },
  { id: 'z-b', titel: 'Beta', space: 'business' as const, rang: 1 },
  { id: 'z-p', titel: 'Privat eins', space: 'privat' as const, rang: 1 },
];
const MS = [
  { id: 'm-1', faellig: '2026-11-04', erledigt: false, zielId: 'z-a' },
  { id: 'm-2', faellig: '2026-03-02', erledigt: true, zielId: 'z-a' },
  { id: 'm-3', faellig: '2027-02-10', erledigt: false, zielId: 'z-b' },
  { id: 'm-4', faellig: '2026-11-20', erledigt: false },
];
const AUFG: DichteAufgabe[] = [
  { dueDate: '2026-11-02', status: 'todo', priority: 'high', listeId: meilensteinListeId('m-1') },
  { dueDate: '2026-11-03', status: 'todo', priority: 'medium', listeId: meilensteinListeId('m-1') },
  { dueDate: '2026-11-03', status: 'done', priority: 'medium', listeId: meilensteinListeId('m-1') },
  { dueDate: '2026-11-05', status: 'cancelled', priority: 'medium', listeId: meilensteinListeId('m-1') },
  { dueDate: '2026-07-01', status: 'todo', priority: 'low' },
];
const woche = (d: ReturnType<typeof faedenDichte>, tag: string) => d.wochen.indexOf(montag(tag));
const b = (d: ReturnType<typeof faedenDichte>, id: string) => d.buendel.find(x => x.id === id)!;

describe('faedenDichte — Dichte je Woche aus echten Daten', () => {
  it('ist deterministisch: gleiche Daten = gleiche Zahlen (auch bei anderer Reihenfolge)', () => {
    const a = faedenDichte(ZIELE, MS, AUFG, undefined, RAUM);
    const c = faedenDichte([...ZIELE].reverse(), [...MS].reverse(), [...AUFG].reverse(), undefined, RAUM);
    expect(JSON.stringify(a)).toBe(JSON.stringify(faedenDichte(ZIELE, MS, AUFG, undefined, RAUM)));
    expect(c.buendel.map(x => x.id)).toEqual(a.buendel.map(x => x.id));
    expect(c.buendel.map(x => x.roh)).toEqual(a.buendel.map(x => x.roh));
  });

  it('Wochen: Montag bis Ende des Zeitraums, ein Bündel je Ziel (Rang, dann Titel) plus „ohne Ziel“ nur bei Bedarf', () => {
    const d = faedenDichte(ZIELE, MS, AUFG, undefined, RAUM);
    expect(d.wochen[0]).toBe('2025-12-29');
    expect(d.wochen.at(-1)! <= RAUM.bis).toBe(true);
    expect(d.wochen.length).toBe(105);
    expect(d.buendel.map(x => x.id)).toEqual(['z-b', 'z-p', 'z-a', OHNE_ZIEL]);
    expect(faedenDichte(ZIELE.slice(0, 1), [], [], undefined, RAUM).buendel.map(x => x.id)).toEqual(['z-a']);
  });

  it('Gewichtung: offener Meilenstein 3, erledigter 1, offene Aufgabe 1 (dringend 1,5) über die Liste des Meilensteins; erledigte/abgebrochene zählen nicht', () => {
    const d = faedenDichte(ZIELE, MS, AUFG, undefined, RAUM);
    const a = b(d, 'z-a');
    // Woche ab 02.11.2026: m-1 (3) + hohe Aufgabe (1,5) + mittlere (1) — die erledigte und die abgebrochene nicht.
    expect(a.roh[woche(d, '2026-11-04')]).toBe(DICHTE_GEWICHT.meilensteinOffen + DICHTE_GEWICHT.aufgabeDringend + DICHTE_GEWICHT.aufgabe);
    expect(a.roh[woche(d, '2026-03-02')]).toBe(DICHTE_GEWICHT.meilensteinErledigt);
    expect(a.summe).toBe(3 + 1.5 + 1 + 1);
    // Ohne Ziel: m-4 (3) + Aufgabe ohne Liste (1)
    expect(b(d, OHNE_ZIEL).summe).toBe(4);
    // Dichte: am Meilenstein höher als weit weg, geglättet in die Nachbarwochen, nie über 1
    const w = woche(d, '2026-11-04');
    expect(a.dichte[w]).toBeGreaterThan(0.5);
    expect(a.dichte[w + 1]).toBeGreaterThan(0.1);
    expect(a.dichte[w + 1]).toBeLessThan(a.dichte[w]);
    expect(a.dichte[woche(d, '2027-06-01')]).toBeLessThan(0.01);
    expect(Math.max(...d.buendel.flatMap(x => x.dichte))).toBeLessThanOrEqual(1);
    expect(d.gesamt[w]).toBe(a.roh[w] + b(d, 'z-b').roh[w] + b(d, 'z-p').roh[w] + b(d, OHNE_ZIEL).roh[w]);
  });

  it('Ziel-Frist zählt, außer ein Kaskaden-Meilenstein vertritt sie; Termine landen bei „ohne Ziel“', () => {
    const ziele = [{ id: 'z-f', titel: 'Frist', termin: '2026-06-10' }, { id: 'z-k', titel: 'Kaskade', termin: '2026-06-10' }];
    const ms = [{ id: 'ms~z-k', faellig: '2026-06-10', erledigt: false, abgeleitetVon: 'z-k' }];
    const d = faedenDichte(ziele, ms, [], [{ datum: '2026-06-11' }, { datum: '2026-06-12', gewicht: 2 }], RAUM);
    expect(b(d, 'z-f').summe).toBe(DICHTE_GEWICHT.zielFrist);
    expect(b(d, 'z-k').summe).toBe(DICHTE_GEWICHT.meilensteinOffen);
    expect(b(d, OHNE_ZIEL).summe).toBe(DICHTE_GEWICHT.termin + 2);
  });

  it('Zeitraum: nur was im Fenster liegt zählt — der Rand glättet aber hinein (kein harter Schnitt am Fensterrand)', () => {
    const raum = { von: '2026-10-01', bis: '2026-12-31' };
    const d = faedenDichte(ZIELE, [{ id: 'x', faellig: '2026-09-28', erledigt: false, zielId: 'z-a' }, { id: 'y', faellig: '2027-05-01', erledigt: false, zielId: 'z-a' }], [], undefined, raum);
    const a = b(d, 'z-a');
    expect(d.wochen[0]).toBe('2026-09-28');
    expect(a.summe).toBe(3); // die Woche ab 28.09. gehört zum Fenster, Mai 2027 nicht
    const d2 = faedenDichte(ZIELE, [{ id: 'x', faellig: '2026-09-14', erledigt: false, zielId: 'z-a' }], [], undefined, raum);
    expect(b(d2, 'z-a').summe).toBe(0);
    expect(b(d2, 'z-a').dichte[0]).toBeGreaterThan(0); // zwei Wochen vor dem Fenster — der Schein reicht hinein
    expect(faedenDichte(ZIELE, MS, [], undefined, { von: 'kaputt', bis: '2026-01-01' }).buendel).toEqual([]);
  });

  it(`höchstens ${MAX_ZIEL_BUENDEL} Ziel-Bündel — der Rest fließt in „Weitere & ohne Ziel“`, () => {
    const viele = Array.from({ length: 9 }, (_, i) => ({ id: `z${i}`, titel: `Ziel ${i}`, rang: i + 1 }));
    const ms = viele.map((z, i) => ({ id: `m${i}`, faellig: '2026-05-05', erledigt: false, zielId: z.id }));
    const d = faedenDichte(viele, ms, [], undefined, RAUM);
    expect(d.buendel.length).toBe(MAX_ZIEL_BUENDEL + 1);
    expect(d.buendel.at(-1)!.titel).toBe('Weitere & ohne Ziel');
    expect(d.buendel.at(-1)!.summe).toBe(3 * 3);
  });

  it('Textäquivalent nennt je Bündel die dichteste Woche', () => {
    const t = lichtText(faedenDichte(ZIELE, MS, AUFG, undefined, RAUM));
    expect(t).toContain('Ziel „Alpha“: am dichtesten in der Woche ab 02.11.2026');
    expect(t).toContain('Ziel „Privat eins“: ruhig');
  });

  it('Farben: je Space fortlaufend, erste = Markierungsfarbe von heute, „ohne Ziel“ in Zeit-Cyan', () => {
    const f = buendelFarben([{ id: 'a', space: 'business' }, { id: 'p', space: 'privat' }, { id: 'b', space: 'business' }, { id: OHNE_ZIEL }]);
    expect(f).toEqual({ a: FADEN_FARBEN.business[0], p: FADEN_FARBEN.privat[0], b: FADEN_FARBEN.business[1], [OHNE_ZIEL]: FADEN_FARBEN.ohne });
  });
});

describe('Lichtfäden — Mathematik', () => {
  it('Saaten und Versatz sind deterministisch und begrenzt', () => {
    expect(fadenSaaten(22, 7)).toEqual(fadenSaaten(22, 7));
    expect(fadenSaaten(22, 7)).not.toEqual(fadenSaaten(22, 8));
    expect(textSaat('z-a')).toBe(textSaat('z-a'));
    const r = zufall(1); const werte = Array.from({ length: 1000 }, r);
    expect(Math.min(...werte)).toBeGreaterThanOrEqual(0); expect(Math.max(...werte)).toBeLessThan(1);
    for (const f of fadenSaaten(30, 3)) for (const s of [0, 100, 777]) for (const t of [0, 5000, 1e6]) expect(Math.abs(versatz(f, s, t))).toBeLessThan(1.4);
    // Standbild (t = 0) ist stabil, Bewegung verschiebt
    const f = fadenSaaten(1, 5)[0];
    expect(versatz(f, 50, 0)).toBe(versatz(f, 50, 0));
    expect(versatz(f, 50, 3000)).not.toBe(versatz(f, 50, 0));
  });

  it('Glättung erhält die Summe, Sättigung bleibt unter 1, Werte zwischen Feldern linear', () => {
    const g = gauss([0, 0, 0, 0, 6, 0, 0, 0, 0], 1);
    expect(g.reduce((a, c) => a + c, 0)).toBeCloseTo(6, 5);
    expect(g[4]).toBeGreaterThan(g[3]);
    expect(saettigen(0, 1)).toBe(0); expect(saettigen(1, 1)).toBeCloseTo(0.5); expect(saettigen(100, 1)).toBeLessThanOrEqual(1);
    expect(wertBei([0, 1], 0.5)).toBeCloseTo(0.5); expect(wertBei([0, 1], 0)).toBe(0); expect(wertBei([0, 1], 1)).toBe(1);
    expect(spreizung(1, 100)).toBeGreaterThan(spreizung(0, 100));
    expect(spreizung(0, 100)).toBeCloseTo(100 * LICHTFAEDEN.ruhe * 0.85);
  });

  it('Kurve: durch die Anker, Normalen Einheitslänge, Weg wächst, Werte gleiten', () => {
    const k = kurve([{ x: 0, y: 0, werte: [0] }, { x: 0, y: 100, werte: [10] }, { x: 50, y: 200, werte: [20] }], 5);
    expect(k[0]).toMatchObject({ x: 0, y: 0 });
    expect(k.at(-1)!.x).toBeCloseTo(50); expect(k.at(-1)!.y).toBeCloseTo(200);
    for (let i = 1; i < k.length; i++) { expect(k[i].s).toBeGreaterThan(k[i - 1].s); expect(Math.hypot(k[i].nx, k[i].ny)).toBeCloseTo(1); }
    expect(k.find(p => Math.abs(p.y - 100) < 0.01)?.werte[0]).toBeCloseTo(10);
  });

  it('Helligkeit: Vergangenheit gedämpft, HEUTE leuchtet, Dichte hebt', () => {
    const d = { heuteX: 500 } as ZeitbandDaten;
    expect(hellBei(100, d, 0)).toBeLessThan(hellBei(900, d, 0));
    expect(hellBei(500, d, 0)).toBeGreaterThan(hellBei(900, d, 0));
    expect(hellBei(900, d, 1)).toBeGreaterThan(hellBei(900, d, 0));
    expect(hellBei(100, { heuteX: null, heuteSeite: 'links' } as ZeitbandDaten, 0)).toBeGreaterThan(hellBei(100, { heuteX: null, heuteSeite: 'rechts' } as ZeitbandDaten, 0));
  });
});

describe('Markierungen über dem Band — ohne Überlappung', () => {
  for (const [name, m] of Object.entries(ZEITBAND_MASSE)) {
    it(`${name}: gleiche Reihe nie überlappend, Reihen nie übereinander, Knopf passt in die Reihe${name === 'handy' ? ', Tippziel ≥ 44 px' : ''}`, () => {
      const r = zufall(42);
      const breite = name === 'handy' ? 320 : 1100;
      for (let lauf = 0; lauf < 50; lauf++) {
        const items = Array.from({ length: 4 + Math.floor(r() * 20) }, () => ({ x: r() * breite, w: 40 + r() * 140 })).sort((a, c) => a.x - c.x);
        const st = stapeln(items, breite, m.maxReihen);
        const lagen = st.lagen.map((l, i) => ('reihe' in l ? { ...l, w: Math.min(items[i].w, breite) } : null)).filter(Boolean) as { reihe: number; links: number; w: number }[];
        for (const a of lagen) {
          expect(a.links).toBeGreaterThanOrEqual(0); expect(a.links + a.w).toBeLessThanOrEqual(breite + 0.001);
          expect(a.reihe).toBeLessThan(m.maxReihen);
          for (const c of lagen) if (a !== c && a.reihe === c.reihe) expect(a.links + a.w <= c.links || c.links + c.w <= a.links).toBe(true);
        }
        // jede Eingabe hat eine Lage (Reihe oder „+n“)
        expect(st.lagen.length).toBe(items.length);
      }
      expect(m.knopf).toBeLessThanOrEqual(m.reihe);
      expect(m.chip).toBeLessThanOrEqual(m.knopf);
      if (name === 'handy') expect(m.knopf).toBeGreaterThanOrEqual(44);
    });
  }
  it('Handy-Maße unter 520 px Breite', () => {
    expect(zeitbandMasse(375)).toBe(ZEITBAND_MASSE.handy);
    expect(zeitbandMasse(1000)).toBe(ZEITBAND_MASSE.rechner);
  });
});

describe('Lauf — Bewegung und reduzierte Bewegung', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  function falscheUhr() {
    const warte: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { warte.push(f); return warte.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    return { tick: (t: number) => { const f = warte.splice(0); f.forEach(x => x(t)); return f.length; } };
  }

  it('reduzierte Bewegung: genau ein Standbild (t = 0), danach nur auf Zuruf — keine Eigenbewegung', () => {
    const uhr = falscheUhr();
    const zeiten: number[] = [];
    const lauf = starteLauf({ beobachte: null, zeichne: t => zeiten.push(t), ruhig: true });
    uhr.tick(1000); uhr.tick(2000); uhr.tick(3000);
    expect(zeiten).toEqual([0]);
    lauf.einmal(); uhr.tick(9000);
    expect(zeiten).toEqual([0, 0]);
    lauf.stop(); lauf.einmal(); uhr.tick(10000);
    expect(zeiten).toEqual([0, 0]);
  });

  it('mit Bewegung: zeichnet je Bild mit wachsender Zeit, stoppt sauber und misst', () => {
    const uhr = falscheUhr();
    const zeiten: number[] = [];
    const lauf = starteLauf({ beobachte: null, zeichne: t => zeiten.push(t), ruhig: false });
    uhr.tick(1000); uhr.tick(1016); uhr.tick(1033);
    expect(zeiten).toEqual([0, 16, 33]);
    lauf.stop();
    uhr.tick(1050); uhr.tick(1066);
    expect(zeiten).toEqual([0, 16, 33]);
    expect(lauf.messung().bilder).toBe(3);
  });
});

describe('Website-Kopie der Lichtfäden', () => {
  it(`${ZIEL} entspricht band.ts + zeichnen.ts (sonst: node scripts/lichtfaeden-website.mjs)`, () => {
    expect(readFileSync(join(__dirname, '..', ZIEL), 'utf8')).toBe(erzeugen());
  });
  it('dieselben Parameter wie in der App, ohne Verbotenes', () => {
    const js = readFileSync(join(__dirname, '..', ZIEL), 'utf8');
    expect(js).toContain(`tempo: ${LICHTFAEDEN.tempo}`);
    expect(js).toContain(`rechner: ${LICHTFAEDEN.faeden.rechner}`);
    expect(js).not.toMatch(/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|eval|Function)\b|innerHTML|import\s*\(/);
    expect(js).not.toMatch(/MAKE[ ]?O[S]/i);
    expect(js.length).toBeLessThan(20000);
  });
});
