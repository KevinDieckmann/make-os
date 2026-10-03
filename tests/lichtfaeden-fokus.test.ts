// ─── Lichtfäden v2 — Engstellen: wo laufen zu viele Stränge zusammen? (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import { baueBaum, rechneAnsicht } from '@/lib/lichtfaeden/baum';
import { engstellen, engstelleText, MAX_ENGSTELLEN, SCHWELLE_MIN, TOP_STRAENGE } from '@/lib/lichtfaeden/fokus';
import { BEIDE, GESAMT, knotenId, themaPfad, type Knoten, type Strang } from '@/lib/lichtfaeden/modell';

const HEUTE = '2026-10-03';
const BIZ = themaPfad('business', 'planung');
const zk = (id: string): Knoten => ({ id: knotenId.ziel(id), art: 'ziel', name: id, farbe: '#FFC93C', eltern: BIZ.at(-1)!, rang: 1 });
let n = 0;
const s = (pfad: string[], tag: string, x: Partial<Strang> = {}): Strang => ({ id: `s${++n}`, quelle: 'aufgabe', titel: `Strang ${n}`, pfad, person: BEIDE, zeit: { tag }, gewicht: 1, status: 'offen', link: `/x/${n}`, ...x });

function rechne(st: Strang[], knoten: Knoten[] = [zk('a'), zk('b'), zk('c')]) {
  const e = rechneAnsicht(baueBaum(knoten, st), { wurzel: GESAMT, von: '2026-10-01', bis: '2027-03-31', heute: HEUTE, person: { art: 'alle' } })!;
  return engstellen(e.ansicht, e.straenge, e.buendelVon, HEUTE);
}

describe('Engstellen', () => {
  it('Text: Zahlen mit Einzahl/Mehrzahl, Nullen fallen weg', () => {
    expect(engstelleText(44, { ziele: 3, fristen: 9, termine: 4 })).toBe('KW 44: 3 Ziele · 9 Fristen · 4 Termine');
    expect(engstelleText(2, { ziele: 1, fristen: 0, termine: 1 })).toBe('KW 2: 1 Ziel · 1 Termin');
    expect(engstelleText(2, { ziele: 0, fristen: 0, termine: 0 })).toBe('KW 2: viel zugleich');
  });

  it('eine dichte Woche (KW 44) über dem eigenen Mittel → Engstelle mit Zählung und den schwersten Strängen', () => {
    n = 0;
    const st: Strang[] = [];
    // Grundrauschen: je Woche eine Aufgabe
    for (let w = 0; w < 20; w++) { const d = new Date(Date.UTC(2026, 9, 5 + w * 7)); st.push(s(BIZ, d.toISOString().slice(0, 10))); }
    // KW 44 (26.10.–01.11.): drei Ziele mit Meilensteinen, Fristen und Terminen
    for (const z of ['a', 'b', 'c']) st.push(s([...BIZ, `ziel:${z}`], '2026-10-28', { quelle: 'meilenstein', gewicht: 3, titel: `Meilenstein ${z}` }));
    st.push(s(themaPfad('business', 'finanzen'), '2026-10-27', { quelle: 'frist', gewicht: 2.5, titel: 'USt' }));
    for (let i = 0; i < 4; i++) st.push(s(themaPfad('privat', 'planung'), '2026-10-29', { quelle: 'termin', gewicht: 0.5 }));
    const e = rechne(st);
    expect(e.length).toBeGreaterThanOrEqual(1);
    const k = e.find(x => x.kw === 44)!;
    expect(k).toBeTruthy();
    expect(k.woche).toBe('2026-10-26');
    expect(k.ziele).toBe(3);
    expect(k.fristen).toBe(1 + 3 + 1); // USt + 3 Meilensteine + Grundrauschen-Aufgabe
    expect(k.termine).toBe(4);
    expect(k.text).toBe('KW 44: 3 Ziele · 5 Fristen · 4 Termine');
    expect(k.top.length).toBe(TOP_STRAENGE);
    expect(k.top[0].titel).toMatch(/^Meilenstein/);
    expect(k.top.every(t => t.link)).toBe(true);
    expect(e.some(x => x.kw === 41)).toBe(false); // ruhige Woche
  });

  it('nie in der Vergangenheit, nie unter der Mindestlast, höchstens MAX, nach Datum sortiert, deterministisch', () => {
    n = 0;
    const st: Strang[] = [s(BIZ, '2026-09-29', { gewicht: 20, status: 'erledigt' })]; // vor heute (erledigt, nicht überfällig)
    for (let w = 0; w < 8; w++) { const d = new Date(Date.UTC(2026, 9, 12 + w * 14)); for (let i = 0; i < 2 + w; i++) st.push(s([...BIZ, 'ziel:a'], d.toISOString().slice(0, 10), { gewicht: 2 })); }
    const e = rechne(st);
    expect(e.length).toBeLessThanOrEqual(MAX_ENGSTELLEN);
    expect(e.every(x => x.woche >= '2026-09-28' && x.last >= SCHWELLE_MIN)).toBe(true);
    expect(e.map(x => x.woche)).toEqual([...e.map(x => x.woche)].sort());
    expect(JSON.stringify(rechne(st))).toBe(JSON.stringify(e));
    expect(rechne([s(BIZ, '2026-11-01')])).toEqual([]); // eine einzelne Aufgabe ist keine Engstelle
  });

  it('überfällige Stränge zählen in der laufenden Woche (sie binden JETZT)', () => {
    n = 0;
    const st = Array.from({ length: 6 }, (_, i) => s([...BIZ, `ziel:${'abc'[i % 3]}`], '2026-09-10', { status: 'ueberfaellig', gewicht: 1.5 }));
    const e = rechne(st);
    expect(e[0]?.woche).toBe('2026-09-28');
    expect(e[0].top.every(t => t.ueberfaellig)).toBe(true);
  });
});
