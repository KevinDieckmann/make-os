// ─── Prozesse · Werkstatt — Feinschliff nach der Sichtprüfung der Vorlagen (22.10.; Bilder research/prozesse/bilder/) ────────────────────────────────────
// Befund 5: die Galerie filtert nach Bereich und „mit Agenten“ / „nur Regeln“ statt nach der internen Welle. Befund 3: der Notiz-Zettel lag über dem Kopf der ersten Phase und den Namen der Bahnen. Befund 4: der Name einer Raute lag unter dem „nein“-Chip bzw. dem
// „+“ des Ausgangs. Befund 6: „Alles zeigen“ machte große Prozesse unlesbar — dann zeigt es die Phasen als Kacheln (EINE Regel `zoomStufe`). Alles reine Lage.
import { describe, it, expect } from 'vitest';
import { KUNDENGEWINNUNG_VORLAGEN, vorlageKurz } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { galerieBereiche, vorlagenFiltern, VORLAGEN_ARTEN } from '@/lib/prozesse/kundengewinnung/galerie';
import fs from 'node:fs';
import path from 'node:path';
import { phasen } from '@/lib/prozesse/fluss';
import {
  werkstattLage, zettelVerdeckt, zettelFreiLegen, zettelObenPlatz, titelBox, chipBox, ueberlappt, ausgangMarke, kachelnFuerAlles, einpassZoom, WS, type Box,
} from '@/lib/prozesse/werkstatt-lage';
import { zoomStufe } from '@/components/os/ui/flaeche/stufe';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

const ALLE: ProzessDefinition[] = KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]);
const vorlage = (id: string) => ALLE.find(d => d.id === id)!;
/** Eine Linie (Folge von Punkten) läuft durch eine Fläche? — jede Strecke fein abgetastet. */
function durch(punkte: readonly [number, number][], b: Box): boolean {
  for (let i = 1; i < punkte.length; i++) {
    const [x0, y0] = punkte[i - 1], [x1, y1] = punkte[i];
    for (let t = 0; t <= 1; t += 0.05) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (x > b.x && x < b.x + b.b && y > b.y && y < b.y + b.h) return true; }
  }
  return false;
}

describe('Befund 3: Zettel verdecken nichts', () => {
  it.each(ALLE.map(d => [d.id, d] as const))('%s: kein Zettel liegt über einem Phasen-Kopf, einer Bahn-Beschriftung oder einem Knoten', (_id, d) => {
    const l = werkstattLage(d);
    expect(d.zettel?.length).toBeGreaterThan(0);
    for (const z of d.zettel ?? []) expect(zettelVerdeckt(l, z)).toEqual([]);
    // Der ganze Text hat Platz (keine „…“): Höhe nach der Länge des Textes.
    for (const z of d.zettel ?? []) expect(z.pos.h ?? WS.zettel.h).toBeGreaterThanOrEqual(WS.zettel.h);
  });
  it('ein Zettel an der alten Stelle (40/40) verdeckt Phasen-Kopf und Bahn — „Ordnen“ legt ihn über die Rahmen, freie bleiben, zweimal = dasselbe', () => {
    const d = vorlage('kg-v02');
    const alt = { ...d, zettel: [{ ...d.zettel![0], pos: { x: 40, y: 40 } }, { id: 'kg-v02:~frei', text: 'frei', pos: { x: 4000, y: -600 } }] };
    const vorher = zettelVerdeckt(werkstattLage(alt), alt.zettel[0]);
    expect(vorher.some(v => v.startsWith('phase:'))).toBe(true);
    expect(vorher.some(v => v.startsWith('bahn:'))).toBe(true);
    const neu = zettelFreiLegen(alt);
    expect(zettelVerdeckt(werkstattLage(neu), neu.zettel![0])).toEqual([]);
    expect(neu.zettel![0].pos).toMatchObject(zettelObenPlatz(0));
    expect(neu.zettel![0].pos.y).toBeLessThan(0);
    expect(neu.zettel![1]).toBe(alt.zettel[1]);
    expect(zettelFreiLegen(neu)).toBe(neu);
    expect(zettelFreiLegen(d)).toBe(d);
  });
  it('mehrere verdeckende Zettel bekommen nebeneinander je einen eigenen Platz über den Rahmen', () => {
    const d = vorlage('kg-v07');
    const z = (i: number) => ({ id: `kg-v07:~z${i}`, text: 'x', pos: { x: 200, y: 200 } });
    const neu = zettelFreiLegen({ ...d, zettel: [z(1), z(2), z(3)] });
    const boxen = neu.zettel!.map(x => ({ x: x.pos.x, y: x.pos.y, b: WS.zettel.b, h: WS.zettel.h }));
    for (let i = 0; i < boxen.length; i++) for (let j = i + 1; j < boxen.length; j++) expect(ueberlappt(boxen[i], boxen[j])).toBe(false);
    for (const x of neu.zettel!) expect(zettelVerdeckt(werkstattLage(neu), x)).toEqual([]);
  });
});

describe('Befund 4: der Name der Raute kollidiert mit nichts', () => {
  it.each(ALLE.map(d => [d.id, d] as const))('%s: Name ≠ Chip, „+“, Ausgangs-Name — und der „nein“-Faden läuft am Namen vorbei', (_id, d) => {
    const l = werkstattLage(d);
    const chips = l.kanten.map(k => ({ k, box: chipBox(k) })).filter((x): x is { k: typeof x.k; box: Box } => !!x.box);
    for (const lk of l.knoten.values()) {
      if (lk.gestalt !== 'raute') continue;
      const name = titelBox(lk)!;
      // Beschriftungen der Fäden (jede, nicht nur die eigenen) liegen nie auf dem Namen.
      for (const c of chips) expect(ueberlappt(c.box, name), `${lk.id}: Chip „${c.k.text}“`).toBe(false);
      // „+“ und Name des freien Ausgangs unten (am gewählten Knoten auch am belegten).
      const unten = lk.anschluesse.find(a => a.richtung === 'unten')!;
      const m = ausgangMarke(unten, { rechtsAnzahl: 1, mitPlus: true });
      expect(ueberlappt({ x: lk.x + m.plus[0] - m.r, y: lk.y + m.plus[1] - m.r, b: 2 * m.r, h: 2 * m.r }, name), `${lk.id}: „+“`).toBe(false);
      expect(ueberlappt({ x: lk.x + m.text[0], y: lk.y + m.text[1] - 11, b: 80, h: 14 }, name), `${lk.id}: Ausgangs-Name`).toBe(false);
      // Der Faden aus dem Ausgang unten kreuzt den eigenen Namen nicht.
      for (const k of l.kanten.filter(x => x.von === lk.id && x.ausgang === 'nein')) expect(durch(k.punkte, name), `${lk.id} → ${k.nach}`).toBe(false);
    }
  });
  it('die Raute aus dem Befund (V02 „Lead schon in der Kartei?“): Chip „Formular“ steht über dem Namen; das „+“ (gewählt) rückt hinter ihn (Feinschliff 1)', () => {
    const d = vorlage('kg-v02');
    const l = werkstattLage(d);
    const r = l.knoten.get('kg-v02:s0')!;
    const k = l.kanten.find(x => x.von === r.id && x.ausgang === 'nein')!;
    expect(k.text).toBe('Formular');
    const chip = chipBox(k)!;
    const name = titelBox(r)!;
    expect(chip.y + chip.h).toBeLessThanOrEqual(name.y);
    const unten = r.anschluesse.find(a => a.richtung === 'unten')!;
    const eigen = { x: chip.x - r.x, y: chip.y - r.y, b: chip.b, h: chip.h };
    const m = ausgangMarke(unten, { rechtsAnzahl: 1, mitPlus: true, chip: eigen, chips: [eigen] });
    expect(r.x + m.plus[0] - m.r).toBeGreaterThanOrEqual(chip.x + chip.b);
    expect(m.name).toBe(false);
  });
});

describe('Befund 6: „Alles zeigen“ bei großen Prozessen — Phasen als Kacheln (EINE Regel zoomStufe)', () => {
  const buehne = { b: 960, h: 600 };
  const lesbar = (s: number) => zoomStufe(s) !== 'fern';
  it('V02 voll eingepasst wäre unlesbar (fern) → Kacheln; mit ihnen eingepasst ist es lesbar', () => {
    const d = vorlage('kg-v02');
    expect(zoomStufe(einpassZoom(werkstattLage(d), d.zettel ?? [], buehne))).toBe('fern');
    const zu = kachelnFuerAlles(d, buehne, { lesbar });
    expect(zu.size).toBeGreaterThan(0);
    const kacheln = werkstattLage(d, { zu });
    expect([...kacheln.knoten.values()].some(k => k.zu)).toBe(true);
    expect(zoomStufe(einpassZoom(kacheln, d.zettel ?? [], buehne))).not.toBe('fern');
  });
  it('ein kleiner Prozess bleibt offen; eine einzige Phase klappt nie zu; schon zugeklappte zählen nicht', () => {
    const v07 = vorlage('kg-v07');
    expect(phasen(v07)).toHaveLength(1);
    expect(kachelnFuerAlles(v07, { b: 200, h: 120 }, { lesbar }).size).toBe(0);
    const v13 = vorlage('kg-v13');
    expect(kachelnFuerAlles(v13, { b: 4000, h: 2400 }, { lesbar }).size).toBe(0);
    const v02 = vorlage('kg-v02');
    const alleBisAufEine = new Set(phasen(v02).slice(1).map(p => p.id));
    expect(kachelnFuerAlles(v02, buehne, { lesbar, zu: alleBisAufEine }).size).toBe(0);
  });
});

describe('Befund 5: Galerie „Aus Vorlage anlegen“ filtert nach Bereich und Art, nicht nach der Welle', () => {
  const kurz = KUNDENGEWINNUNG_VORLAGEN.map(vorlageKurz);
  it('Bereiche in der Reihenfolge der Landkarte, mit Anzahl — zusammen alle 18', () => {
    const b = galerieBereiche(kurz);
    expect(b.map(x => x.titel)).toEqual(['Marketing', 'Sales', 'Übergabe', 'Ausbau']);
    expect(b.reduce((n, x) => n + x.anzahl, 0)).toBe(18);
    for (const x of b) expect(vorlagenFiltern(kurz, { bereich: x.id, art: 'alle' })).toHaveLength(x.anzahl);
  });
  it('„Mit Agenten“ und „Nur Regeln“ teilen die Vorlagen ohne Rest (Teilprozesse zählen mit); beides lässt sich mit dem Bereich kombinieren', () => {
    const mit = vorlagenFiltern(kurz, { bereich: 'alle', art: 'agenten' }), ohne = vorlagenFiltern(kurz, { bereich: 'alle', art: 'regeln' });
    expect(mit.length + ohne.length).toBe(18);
    expect(mit.length).toBeGreaterThan(0);
    expect(ohne.length).toBeGreaterThan(0);
    expect(mit.every(v => v.agenten > 0) && ohne.every(v => v.agenten === 0)).toBe(true);
    const salesMit = vorlagenFiltern(kurz, { bereich: 'sales', art: 'agenten' });
    expect(salesMit.every(v => v.bereich === 'sales' && v.agenten > 0)).toBe(true);
    expect(VORLAGEN_ARTEN.map(a => a.label)).toEqual(['Mit und ohne Agenten', 'Mit Agenten', 'Nur Regeln']);
  });
  it('die Oberfläche nennt keine „Welle“ mehr und lädt die Bibliothek nicht ins Browser-Bündel', () => {
    const quelle = fs.readFileSync(path.resolve(__dirname, '../components/os/prozesse/VorlagenGalerie.tsx'), 'utf8');
    expect(quelle).not.toMatch(/Welle \d/);
    expect(quelle).not.toMatch(/import \{[^}]*\} from '@\/lib\/prozesse\/kundengewinnung\/bibliothek'/);
    const galerie = fs.readFileSync(path.resolve(__dirname, '../lib/prozesse/kundengewinnung/galerie.ts'), 'utf8');
    expect(galerie).not.toMatch(/^import \{[^}]*\} from '\.\/(bibliothek|welle\d)'/m);
  });
});
