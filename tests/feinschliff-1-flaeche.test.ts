// ─── Feinschliff 1 (23.10.) · Punkte 1, 3, 4 — Befunde der Sichtprüfung vom 22.10. (Demo, 1440 × 1000, Vollbild) ──────────────────────────────────────
// 1/4 „Alles zeigen“ kennt die schwebenden Leisten und das Seitenfeld (EINE Rechnung, lib/einpassen.ts) und klappt nur zu, was sonst nicht lesbar passt.
// 3   Ein Link mit Schritt wählt ihn in der Werkstatt (lib/prozesse/werkstatt-ziel.ts). Rein, dazu Quelltext-Wächter.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { raenderAus, freiesFeld, einpassen, OHNE_RAENDER, FREI_MIN_ANTEIL, SCHWEBE_LUFT, type Feld, type Raender } from '@/lib/einpassen';
import { allesZeigen, bildAus } from '@/components/os/ui/flaeche/kamera';
import { SCHWEBE_SELEKTOR } from '@/components/os/ui/flaeche/schwebe';
import { KUNDENGEWINNUNG_VORLAGEN } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { alleSchritte, phasen } from '@/lib/prozesse/fluss';
import { werkstattLage, kachelnFuerAlles, einpassZoom, einpassKamera, inhaltBox, startKamera, kameraZu, WERKSTATT_UEBERSICHT_MIN, type Box } from '@/lib/prozesse/werkstatt-lage';
import { werkstattZiel } from '@/lib/prozesse/werkstatt-ziel';
import type { ProzessDefinition } from '@/lib/prozesse/definition';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const ALLE: ProzessDefinition[] = KUNDENGEWINNUNG_VORLAGEN.flatMap(v => [v.definition, ...v.teile.map(t => t.definition)]);
const vorlage = (id: string) => ALLE.find(d => d.id === id)!;

/** Die Bühne im Vollbild bei 1440 × 1000 (ohne die Symbol-Leiste links, 64 px) mit ihren schwebenden Leisten (wie app/globals.css `.wz-*`). */
const BUEHNE: Feld = { x: 64, y: 0, b: 1376, h: 1000 };
const LEISTEN = {
  kopfLinks: { x: 76, y: 10, b: 620, h: 56 }, kopfRechts: { x: 1080, y: 10, b: 348, h: 56 },
  palette: { x: 76, y: 400, b: 56, h: 200 }, head: { x: 76, y: 936, b: 150, h: 52 }, zoom: { x: 1160, y: 936, b: 268, h: 52 },
  feld: { x: 1048, y: 86, b: 380, h: 838 },
} satisfies Record<string, Feld>;

describe('1 · Einpassen mit Rand für die schwebenden Leisten (EINE Rechnung)', () => {
  const r = raenderAus(BUEHNE, Object.values(LEISTEN));
  it('jede Leiste zählt an der Seite, an der sie am wenigsten kostet: Kopf oben, Werkzeugleiste links, Ecken unten, Seitenfeld rechts', () => {
    expect(r.oben).toBe(10 + 56 + SCHWEBE_LUFT);
    expect(r.links).toBe(76 - 64 + 56 + SCHWEBE_LUFT);
    expect(r.unten).toBe(1000 - 936 + SCHWEBE_LUFT);
    expect(r.rechts).toBe(64 + 1376 - 1048 + SCHWEBE_LUFT);
  });
  it('Leisten außerhalb der Bühne bzw. ohne Fläche (leerer Ort) und mitten im Bild zählen nicht', () => {
    expect(raenderAus(BUEHNE, [{ x: 0, y: 0, b: 60, h: 1000 }, { x: 200, y: 200, b: 0, h: 0 }, { x: 600, y: 400, b: 100, h: 100 }])).toEqual(OHNE_RAENDER);
  });
  it('Landkarte: „Alles zeigen“ legt keine Kachel mehr unter die Werkzeugleiste — und ohne Ränder rechnet es wie bisher', () => {
    const box = { x: -12, y: -12, b: 2400, h: 900 };
    const k = allesZeigen(box, BUEHNE.b, BUEHNE.h, 20, 1, r);
    const [lx, ly] = bildAus(k, box.x, box.y), [rx, ry] = bildAus(k, box.x + box.b, box.y + box.h);
    expect(lx).toBeGreaterThanOrEqual(r.links);
    expect(ly).toBeGreaterThanOrEqual(r.oben);
    expect(rx).toBeLessThanOrEqual(BUEHNE.b - r.rechts + 1);
    expect(ry).toBeLessThanOrEqual(BUEHNE.h - r.unten + 1);
    // Ohne Ränder: dieselbe Formel wie vor dem Feinschliff (mittig in der ganzen Bühne).
    const alt = (b: Box, B: number, H: number, rand: number, max: number) => {
      const s = Math.min(2.5, Math.max(0.15, Math.min((B - 2 * rand) / b.b, (H - 2 * rand) / b.h, max)));
      return { s, x: Math.round((B - b.b * s) / 2 - b.x * s), y: Math.round((H - b.h * s) / 2 - b.y * s) };
    };
    for (const [b, B, H, rand, max] of [[box, 1376, 1000, 20, 1], [{ x: 0, y: 0, b: 100, h: 100 }, 1000, 600, 40, 1], [{ x: 50, y: 10, b: 900, h: 4000 }, 800, 700, 48, 1.2]] as const) {
      expect(allesZeigen(b, B, H, rand, max)).toEqual(alt(b, B, H, rand, max));
    }
  });
  it('bleibt zu wenig Platz (schmales Fenster), gilt in dieser Richtung die ganze Bühne — lieber etwas verdeckt als winzig', () => {
    const eng: Raender = { links: 300, oben: 0, rechts: 300, unten: 0 };
    expect(freiesFeld({ b: 800, h: 600 }, eng)).toEqual({ x: 0, y: 0, b: 800, h: 600 });
    expect(800 - 600).toBeLessThan(800 * FREI_MIN_ANTEIL);
    expect(freiesFeld({ b: 1376, h: 1000 }, r)).toEqual({ x: r.links, y: r.oben, b: 1376 - r.links - r.rechts, h: 1000 - r.oben - r.unten });
  });
  it('Werkstatt: Einpassen, Öffnen und „ins Bild“ rechnen im freien Feld — nichts unter dem Seitenfeld', () => {
    const d = vorlage('kg-v05');
    const l = werkstattLage(d);
    const box = inhaltBox(l, d.zettel ?? []);
    const k = einpassKamera(box, BUEHNE, 32, 1, r);
    expect(bildAus(k, box.x, box.y)[0]).toBeGreaterThanOrEqual(r.links);
    expect(bildAus(k, box.x + box.b, box.y + box.h)[0]).toBeLessThanOrEqual(BUEHNE.b - r.rechts + 1);
    // Öffnen: lesbar am Anfang — der Anfang steht rechts neben der Werkzeugleiste, unter der Kopfzeile.
    const st = startKamera(l.box, BUEHNE, 32, r);
    expect(bildAus(st, l.box.x, l.box.y)[0]).toBeGreaterThanOrEqual(r.links);
    expect(bildAus(st, l.box.x, l.box.y)[1]).toBeGreaterThanOrEqual(r.oben);
    expect(einpassKamera(box, BUEHNE, 32, 1, r)).toEqual(einpassen(box, BUEHNE, { raender: r, rand: 32, min: 0.15, max: 1 }));
    // Ein Knoten rechts unter dem Seitenfeld: die Kamera schiebt ihn ins freie Feld (der Zoom bleibt).
    const k0 = { s: 1, x: 0, y: 0 };
    const z = kameraZu(k0, { x: 1100, y: 300, b: 184, h: 150 }, BUEHNE, 48, r);
    expect(z.s).toBe(1);
    expect(1100 + 184 + z.x).toBeLessThanOrEqual(BUEHNE.b - r.rechts - 48);
    expect(kameraZu(k0, { x: 300, y: 300, b: 184, h: 150 }, BUEHNE, 48, r)).toBe(k0);
  });
  it('die Messung kennt alle schwebenden Leisten — Kopf, Orte des Rahmens, Seitenfeld, Knoten-Auswahl', () => {
    for (const c of ['.wz-kopf-teil', '.wz-schwebe', '.wz-feld', '.wz-feld-zu', '.pw-auswahl-leiste']) expect(SCHWEBE_SELEKTOR).toContain(c);
    expect(lies('components/os/prozesse/Buehne.tsx')).toContain('schwebeRaender(buehne.current)');
    expect(lies('components/os/prozesse/WerkstattFlaeche.tsx')).toContain('const raender = () => schwebeRaender(buehne.current);');
  });
});

describe('4 · Werkstatt „Alles zeigen“: zuklappen nur, wenn es sonst nicht lesbar passt (Mindestmaßstab)', () => {
  const B = { b: 1376, h: 1000 };
  const r: Raender = { links: 76, oben: 74, rechts: 400, unten: 72 };
  it('passt der Prozess lesbar ins freie Feld, bleibt alles offen', () => {
    const d = vorlage('kg-v05');
    expect(einpassZoom(werkstattLage(d), d.zettel ?? [], B, r)).toBeGreaterThanOrEqual(WERKSTATT_UEBERSICHT_MIN);
    expect(kachelnFuerAlles(d, B, { raender: r }).size).toBe(0);
  });
  it('sonst nur so viele Phasen wie nötig (die breitesten zuerst) — danach lesbar; die Phase der Auswahl bleibt offen', () => {
    const d = vorlage('kg-v10');
    const alle = phasen(d).map(p => p.id);
    const zu = kachelnFuerAlles(d, B, { raender: r });
    expect(zu.size).toBeGreaterThan(0);
    expect(zu.size).toBeLessThan(alle.length);
    expect(einpassZoom(werkstattLage(d, { zu }), d.zettel ?? [], B, r)).toBeGreaterThanOrEqual(WERKSTATT_UEBERSICHT_MIN);
    for (const behalten of alle) expect(kachelnFuerAlles(d, B, { raender: r, behalten }).has(behalten)).toBe(false);
  });
  it('das Seitenfeld zählt: mit ihm muss eher zugeklappt werden als ohne; eine einzige Phase klappt nie zu', () => {
    const d = vorlage('kg-v10');
    expect(kachelnFuerAlles(d, B, { raender: r }).size).toBeGreaterThanOrEqual(kachelnFuerAlles(d, B).size);
    expect(kachelnFuerAlles(vorlage('kg-v01'), { b: 400, h: 300 }, { raender: r }).size).toBe(0);
  });
  it('die Werkstatt fragt die Regel mit den gemessenen Rändern — keine eigene Rechnung', () => {
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain('kachelnFuerAlles(d, g, { raender: flaeche.current?.raender(), team, zu, behalten })');
    expect(w).not.toContain('allesAlsKacheln');
  });
});

describe('3 · Link mit Schritt wählt ihn in der Werkstatt', () => {
  const d = vorlage('kg-v10');
  const t = alleSchritte(d).find(x => x.schritt.form !== 'ausloeser')!;
  it('Schritt → wählen (mit seiner Phase); ist die Phase zu, klappt sie auf', () => {
    expect(werkstattZiel(d, { ph: t.phase.id, s: t.schritt.id })).toEqual({ art: 'schritt', id: t.schritt.id, phase: t.phase.id, aufklappen: false });
    expect(werkstattZiel(d, { s: t.schritt.id }, new Set([t.phase.id]))?.aufklappen).toBe(true);
  });
  it('unbekannter Schritt → seine Phase; unbekannt beides → nichts', () => {
    expect(werkstattZiel(d, { ph: t.phase.id, s: 'fk-gibt-es-nicht' })).toEqual({ art: 'phase', id: t.phase.id, phase: t.phase.id, aufklappen: false });
    expect(werkstattZiel(d, { ph: 'x', s: 'y' })).toBeNull();
    expect(werkstattZiel(d, {})).toBeNull();
  });
  it('die Werkstatt hört auf die Adresse (auch ohne Neuladen), wählt, klappt auf und fährt hin', () => {
    const w = lies('components/os/prozesse/Werkstatt.tsx');
    expect(w).toContain('werkstattZiel(d, { ph: adr.ph, s: adr.s }, zuWirksam)');
    expect(w).toContain('[prozessId, adr.ph, adr.s, d, lage, reiter, versionAnsicht, zu, zuWirksam]');
    expect(w).toContain('flaeche.current?.zeige(z.id)');
  });
});
