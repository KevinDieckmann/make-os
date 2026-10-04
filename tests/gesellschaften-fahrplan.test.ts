// Gründungsfahrplan (04.10., Paket 4): Vorlage „GmbH-Gründung / Umfirmierung“ — Ziel + neun Meilensteine mit Kette + Aufgaben,
// feste Kennungen (wiederholbar), Säuberer der Planung nehmen alles unverändert an, keine echten Namen/Daten im Code.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fahrplanFuer, fahrplanZielId, fahrplanMeilensteinId, FAHRPLAN_SCHRITTE } from '@/lib/gesellschaften/fahrplan';
import { kettePruefen, datumVorVorgaenger } from '@/lib/planung/meilenstein-kette';
import { sauberMeilenstein, sauberWartetAuf } from '@/lib/planung/meilensteine';
import { sauberZiel } from '@/lib/planung/ziele';
import { meilensteinAufgabenSpace } from '@/lib/planung/meilenstein-aufgaben';

const G = 'g-11111111-1111-4111-8111-111111111111';

describe('Gründungsfahrplan', () => {
  const f = fahrplanFuer(G, { name: 'Neue Beispiel GmbH', vorgaenger: 'Alte Beispiel GmbH', art: 'umfirmierung' }, 'Neue Beispiel GmbH', '2026-10-05');
  it('ein Ziel (Business, Einheit = Gesellschaft, laufendes Jahr) + neun Meilensteine am Ziel', () => {
    expect(f.ziel).toMatchObject({ id: fahrplanZielId(G), space: 'business', einheit: 'Neue Beispiel GmbH', jahr: 2026, titel: 'Umfirmierung Alte Beispiel GmbH → Neue Beispiel GmbH' });
    expect(f.meilensteine).toHaveLength(9);
    expect(f.meilensteine.every(m => m.zielId === f.ziel.id && m.space === 'business')).toBe(true);
    expect(f.meilensteine.find(m => m.id === fahrplanMeilensteinId(G, 'register'))?.titel).toBe('Handelsregister: Umfirmierung Alte Beispiel GmbH → Neue Beispiel GmbH');
    expect(f.meilensteine.find(m => m.id === fahrplanMeilensteinId(G, 'website'))?.titel).toMatch(/erst nach Eintragung/);
  });
  it('die Kette ist gültig (kein Kreis, Vorgänger vorhanden, kein Termin vor seinem Vorgänger)', () => {
    expect(kettePruefen(f.meilensteine, f.meilensteine.map(m => m.id))).toBeNull();
    for (const m of f.meilensteine) expect(datumVorVorgaenger(m, f.meilensteine)).toEqual([]);
    expect(f.meilensteine.find(m => m.id.includes('-register-'))?.wartetAuf).toEqual([fahrplanMeilensteinId(G, 'notar'), fahrplanMeilensteinId(G, 'konto')]);
  });
  it('die Säuberer der Planung nehmen Ziel und Meilensteine unverändert an (Kennungen, Kette, Einheit)', () => {
    const z = sauberZiel(f.ziel)!;
    expect(z.id).toBe(f.ziel.id);
    expect(z.einheit).toBe('Neue Beispiel GmbH');
    for (const m of f.meilensteine) {
      const s = sauberMeilenstein(m)!;
      expect(s.id).toBe(m.id);
      expect(s.zielId).toBe(f.ziel.id);
      expect(sauberWartetAuf(m.wartetAuf, m.id)).toEqual(m.wartetAuf);
    }
  });
  it('Aufgaben je Meilenstein; die feste Gesellschaft ug bekommt ihren Aufgaben-Space', () => {
    expect(f.aufgaben.length).toBe(FAHRPLAN_SCHRITTE.reduce((s, x) => s + x.aufgaben.length, 0));
    expect(new Set(f.aufgaben.map(a => a.meilensteinId)).size).toBe(9);
    const ug = fahrplanFuer('ug', { name: 'MAKE', art: 'gruendung' }, 'MAKE Innovation GmbH', '2026-10-05');
    expect(ug.ziel.titel).toBe('Gründung MAKE');
    expect(meilensteinAufgabenSpace(ug.meilensteine[0])).toBe('ug');
  });
  it('feste Kennungen: derselbe Fahrplan zweimal ergibt dieselben Kennungen (wiederholbar)', () => {
    const zwei = fahrplanFuer(G, { name: 'Neue Beispiel GmbH', art: 'gruendung' }, 'Neue Beispiel GmbH', '2026-11-01');
    expect(zwei.meilensteine.map(m => m.id)).toEqual(f.meilensteine.map(m => m.id));
  });
  it('keine echten Namen in der Vorlage', () => {
    const text = readFileSync(path.resolve(__dirname, '../lib/gesellschaften/fahrplan.ts'), 'utf8');
    expect(text).not.toMatch(/KEMARIS|KD Ventures|MAKE Innovation|Dieckmann/);
  });
});
