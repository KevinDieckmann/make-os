// 01.10. (Kevin: „wenn ich einen Meilenstein anlege, fehlt, dass dahinter etwas ist“):
// erste Aufgaben direkt beim Anlegen, „Speichern & öffnen“ führt ins Detail; Duplikat-Schutz nur in der Meilenstein-Liste.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ersteAufgaben } from '@/components/os/planung/MeilensteinFenster';

describe('Meilenstein anlegen mit ersten Aufgaben', () => {
  it('eine Aufgabe je Zeile, Spiegelstriche weg, leer und doppelt raus', () => {
    expect(ersteAufgaben('- Vertrag entwerfen\n\n• Konto eröffnen\nvertrag entwerfen\n  Termin Steuerberater  ')).toEqual(['Vertrag entwerfen', 'Konto eröffnen', 'Termin Steuerberater']);
  });
  it('höchstens 30, zu lange Zeilen werden weggelassen statt gekürzt', () => {
    const viele = Array.from({ length: 40 }, (_, i) => `Aufgabe ${i}`).join('\n');
    expect(ersteAufgaben(viele)).toHaveLength(30);
    expect(ersteAufgaben('x'.repeat(301))).toEqual([]);
  });
  it('Duplikat-Schutz beim Anlegen am Meilenstein gilt nur in seiner Liste', () => {
    const route = readFileSync(path.resolve(__dirname, '../app/api/tasks/create/route.ts'), 'utf8');
    expect(route).toMatch(/body\.meilensteinId === undefined \|\| t\.listeId === body\.listeId/);
  });
  it('neuer Meilenstein: „Speichern & öffnen“ führt ins Detail (Reiter Aufgaben)', () => {
    const f = readFileSync(path.resolve(__dirname, '../components/os/planung/MeilensteinFenster.tsx'), 'utf8');
    expect(f).toMatch(/WEG\.meilenstein\(neu\.id, 'aufgaben'\)/);
    expect(f).toMatch(/Speichern & öffnen/);
  });
});
