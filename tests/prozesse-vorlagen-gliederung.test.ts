// ─── Prozesse · Kundengewinnung — Gliederung der 18 Vorlagen (Feinschliff 22.10., Sichtprüfung in der Testversion) ─────────────────────────────────────
// Befund 1: V02 hatte 25 Schritte in EINER Phase — die Werkstatt riet selbst „Teilprozess bilden?“, „Alles zeigen“ war ein einziger langer Strang. Jetzt
// höchstens `PROZESS_GRENZEN.schritteHinweis` Schritte je Phase, und zwar OHNE den Ablauf zu ändern: dieselben Schritte (Knoten, Schlösser, Enden) und dieselben
// Kanten wie vorher (tests/fixtures/vorlagen-ablauf-vorher.json, erzeugt vor der Gliederung). Einzige gewollte Änderung (Befund 2): mehrere Auslöser führen
// JEDER direkt in den ersten Schritt — vorher führte der erste in den zweiten Auslöser (die Werkstatt zeigte den Faden nicht, nur ein „+“).
import { describe, it, expect } from 'vitest';
import vorherJson from './fixtures/vorlagen-ablauf-vorher.json';
import { KUNDENGEWINNUNG_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { kantenVon, phasen, schritteDer, alleSchritte, startKnoten, flussPruefen } from '@/lib/prozesse/fluss';
import { hinweiseVon } from '@/lib/prozesse/werkstatt-hinweise';
import { werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import { PROZESS_GRENZEN, type ProzessDefinition } from '@/lib/prozesse/definition';

type Vorher = Record<string, { kanten: string[]; schritte: string[] }>;
const VORHER = vorherJson as Vorher;
const ALLE: ProzessDefinition[] = KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]);
const kantenText = (d: ProzessDefinition) => kantenVon(d).map(k => `${k.von}>${k.nach ?? '-'}:${k.ausgang}`);
const schrittIds = (d: ProzessDefinition) => d.knoten.map(k => k.id).filter(id => !id.includes(':~')).sort();

describe('Gliederung der Vorlagen (Befund 1)', () => {
  it('die Vorher-Aufnahme deckt jede Vorlage und jeden Teilprozess ab', () => {
    expect(Object.keys(VORHER).sort()).toEqual(ALLE.map(d => d.id).sort());
    expect(ALLE.length).toBe(24);
  });

  describe.each(ALLE.map(d => [d.id, d] as const))('%s', (id, d) => {
    it(`höchstens ${PROZESS_GRENZEN.schritteHinweis} Schritte je Phase — kein eigener Hinweis „Teilprozess bilden?“, keine leere Phase`, () => {
      for (const p of phasen(d)) {
        const n = schritteDer(d, p.id).length;
        expect(n, `${id} · „${p.titel}“`).toBeGreaterThan(0);
        expect(n, `${id} · „${p.titel}“`).toBeLessThanOrEqual(PROZESS_GRENZEN.schritteHinweis);
      }
      expect(hinweiseVon(d).filter(r => r.aktion === 'teilprozess')).toEqual([]);
      expect(flussPruefen(d, PROZESS_GRENZEN.schritteHinweis).filter(b => b.stufe !== 'hinweis' || /Teilprozess/.test(b.text))).toEqual([]);
    });

    it('derselbe Ablauf: gleiche Schritte, Schlösser und Enden, gleiche Kanten (außer den Auslösern, Befund 2)', () => {
      const v = VORHER[id];
      expect(schrittIds(d)).toEqual(v.schritte);
      const ausloeser = new Set(startKnoten(d).map(s => s.id));
      const ohneAusloeser = (l: string[]) => l.filter(k => !ausloeser.has(k.split('>')[0])).sort();
      expect(ohneAusloeser(kantenText(d))).toEqual(ohneAusloeser(v.kanten));
      // Die Auslöser: vorher eine Kette (Auslöser → Auslöser → erster Schritt) — jetzt führt jeder direkt in diesen ersten Schritt.
      const alt = new Map(v.kanten.map(k => { const [von, rest] = k.split('>'); return [von, rest.slice(0, rest.lastIndexOf(':'))]; }));
      let erster: string | undefined = startKnoten(d)[0]?.id;
      while (erster && ausloeser.has(erster)) erster = alt.get(erster);
      for (const a of ausloeser) expect(kantenText(d).filter(k => k.startsWith(`${a}>`)), a).toEqual([`${a}>${erster}:weiter`]);
    });
  });
});

describe('Auslöser (Befund 2): jeder Auslöser hat einen Ausgang — im Fluss UND sichtbar in der Werkstatt', () => {
  it.each(ALLE.map(d => [d.id, d] as const))('%s', (_id, d) => {
    const lage = werkstattLage(d);
    const ersterSchritt = alleSchritte(d).map(x => x.schritt).find(s => s.form !== 'ausloeser')!;
    for (const a of startKnoten(d)) {
      const k = kantenVon(d).filter(x => x.von === a.id);
      expect(k.map(x => x.nach), a.titel).toEqual([ersterSchritt.id]);
      // gezeichnet: ein Faden mit Weg vom Auslöser (kein freies „+“ am Ausgang)
      expect(lage.kanten.some(x => x.von === a.id && x.nach === ersterSchritt.id && x.punkte.length > 2), a.titel).toBe(true);
    }
  });
  it('zwei Auslöser nebeneinander (V02, V14): beide führen in denselben ersten Schritt, keiner in den anderen', () => {
    for (const id of ['kg-v02', 'kg-v14']) {
      const d = ALLE.find(x => x.id === id)!;
      const st = startKnoten(d);
      expect(st.length).toBe(2);
      const ziele = st.map(a => kantenVon(d).find(k => k.von === a.id)?.nach);
      expect(new Set(ziele).size).toBe(1);
      expect(st.some(a => ziele.includes(a.id))).toBe(false);
    }
  });
});
