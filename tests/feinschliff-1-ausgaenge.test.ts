// ─── Feinschliff 1 (23.10.) · Punkte 6, 7 — die Ausgänge der Werkstatt-Knoten (Sichtprüfung 22.10.) ─────────────────────────────────────────────────────
// 6 Die „+“ liegen nie auf Beschriftungen, ein Ausgang mit beschriftetem Faden trägt keinen zweiten Namen. 7 Die „+“ ragen nie in die Trefferfläche des Knotens.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { KUNDENGEWINNUNG_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { werkstattLage, ausgangMarke, ausgangChips, knotenTreffer, anschluesse, knotenMass, ueberlappt, gestaltVon, AUSGAENGE, WS, type Box } from '@/lib/prozesse/werkstatt-lage';
import type { ProzessDefinition, ProzessForm } from '@/lib/prozesse/definition';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const ALLE: ProzessDefinition[] = KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]);

describe('6/7 · Ausgänge: „+“ nie auf einer Beschriftung, nie im Knoten; kein doppelter Name', () => {
  const kreis = (m: { plus: [number, number]; r: number }): Box => ({ x: m.plus[0] - m.r, y: m.plus[1] - m.r, b: 2 * m.r, h: 2 * m.r });
  it('jede Form: die „+“ freier Ausgänge ragen nicht in Körper und Namen (Trefferfläche des Knotens) und berühren sich nicht', () => {
    for (const form of Object.keys(AUSGAENGE) as ProzessForm[]) {
      const m0 = knotenMass({ form });
      const treffer = knotenTreffer({ b: m0.b, gestalt: gestaltVon(form), koerper: m0.koerper });
      const aus = anschluesse({ form }).filter(a => a.art !== 'ein');
      const rechts = aus.filter(a => a.richtung === 'rechts').length;
      const ms = aus.map(a => ausgangMarke(a, { rechtsAnzahl: rechts, mitPlus: true }));
      for (const m of ms) for (const t of treffer) expect(ueberlappt(kreis(m), t), form).toBe(false);
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) expect(ueberlappt(kreis(ms[i]), kreis(ms[j])), form).toBe(false);
    }
  });
  it('Raute: das „+“ unten steht rechts neben dem Körper (nicht zwischen Körper und Name), der Name links vom Stummel', () => {
    const m0 = knotenMass({ form: 'entscheidung' });
    const unten = anschluesse({ form: 'entscheidung' }).find(a => a.richtung === 'unten')!;
    const m = ausgangMarke(unten, { rechtsAnzahl: 1, mitPlus: true });
    expect(m.plus[0] - m.r).toBeGreaterThanOrEqual(m0.koerper.x + m0.koerper.b);
    expect(m.anker).toBe('end');
    expect(m.text[0]).toBeLessThan(unten.x);
    expect(m.knick).toEqual([unten.x, unten.y + WS.stummel]);
  });
  it.each(ALLE.map(d => [d.id, d] as const))('%s (gewählt, alle Fäden beschriftet): kein „+“ auf einer Beschriftung oder im Knoten, kein zweiter Name', (_id, d) => {
    const l = werkstattLage(d);
    const chips = ausgangChips(l);
    for (const lk of l.knoten.values()) {
      if (lk.zu) continue;
      const c = chips.get(lk.id) ?? [];
      const treffer = knotenTreffer(lk);
      const rechts = lk.anschluesse.filter(a => a.richtung === 'rechts' && a.art !== 'ein').length;
      for (const a of lk.anschluesse.filter(x => x.art !== 'ein')) {
        const eigen = c.find(x => x.art === a.art)?.box ?? null;
        const m = ausgangMarke(a, { rechtsAnzahl: rechts, mitPlus: true, chip: eigen, chips: c.map(x => x.box) });
        for (const x of c) expect(ueberlappt(kreis(m), x.box), `${lk.id}|${a.art} „+“ auf Beschriftung`).toBe(false);
        for (const t of treffer) expect(ueberlappt(kreis(m), t), `${lk.id}|${a.art} „+“ im Knoten`).toBe(false);
        if (eigen) expect(m.name, `${lk.id}|${a.art}`).toBe(false);
      }
    }
  });
  it('die Zeichnung: Trefferflächen des Knotens, Beschriftungen je Knoten an die Zeichnung, Name nur ohne Beschriftung', () => {
    const kn = lies('components/os/prozesse/WerkstattKnoten.tsx');
    expect(kn).toContain('knotenTreffer(l).map(');
    expect(kn).toContain('&& m.name &&');
    expect(kn).toContain('textAnchor={m.anker}');
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('chips={chips.get(lk.id)}');
    // Maße nur in der Lage (WS): keine Zahlen-Literale für die Marken in der Zeichnung.
    expect(kn).not.toMatch(/ausgangMarke\([^)]*\d/);
  });
});
