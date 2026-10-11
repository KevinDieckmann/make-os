// ─── Datenschutz-Prüfung 11.10. (N6): GET /api/kalender?space=… gibt nur die Kalendernamen der Sicht heraus ──────────────────────────────
// Vorher gingen mit `?space=business` alle `einstellungen` hinaus (Kalendernamen inkl. privater: „Familie“, iCloud je Person …). Die Route kürzt
// sie mit derselben Regel wie Termine und Kalender (`imBereich` → `spaceVonKalender`). Erfundene Namen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { einstellungenFuerBereich, EINSTELLUNGEN_LEER, type KalenderEinstellungen } from '@/lib/kalender/einstellungen';
import { spaceVonKalender } from '@/lib/kalender/space';

const E: KalenderEinstellungen = {
  ...EINSTELLUNGEN_LEER,
  kalender: { kevin: 'PRIVAT-PERSON-A', malin: 'PRIVAT-PERSON-B', beide: 'FAMILIE-GEMEINSAM' },
  space: { 'PRIVAT-PERSON-A': 'privat', 'FAMILIE-GEMEINSAM': 'privat', 'Firma Arbeit': 'business' },
  belegt: { 'FAMILIE-GEMEINSAM': true, 'Firma Arbeit': true },
  google: { 'Firma Arbeit': 'person-a' },
  persoenlich: { 'PRIVAT-ICLOUD-A': 'person-a' },
};

describe('N6: Einstellungen nur mit den Kalendern der Sicht', () => {
  it('Business: kein privater Kalendername in irgendeinem Feld; Privat: kein Business-Name', () => {
    const imBereich = (b: 'privat' | 'business') => (name: string) => spaceVonKalender(E, name) === b;
    const biz = einstellungenFuerBereich(E, imBereich('business'));
    const text = JSON.stringify(biz);
    for (const n of ['PRIVAT-PERSON-A', 'PRIVAT-PERSON-B', 'FAMILIE-GEMEINSAM', 'PRIVAT-ICLOUD-A']) expect(text, n).not.toContain(n);
    expect(biz.space).toEqual({ 'Firma Arbeit': 'business' });
    expect(biz.google).toEqual({ 'Firma Arbeit': 'person-a' });
    expect(biz.kalender).toEqual({ kevin: '', malin: '', beide: '' });
    expect(biz.dauer).toEqual(E.dauer); // Nicht-Namen bleiben
    const pv = einstellungenFuerBereich(E, imBereich('privat'));
    expect(JSON.stringify(pv)).not.toContain('Firma Arbeit');
    expect(pv.kalender.kevin).toBe('PRIVAT-PERSON-A');
  });
  it('die Route kürzt mit `?space=` (dieselbe Regel `imBereich`)', () => {
    const q = readFileSync(path.join(process.cwd(), 'app/api/kalender/route.ts'), 'utf8');
    expect(q).toContain('einstellungen: bereich ? einstellungenFuerBereich(einstellungenFuerPerson(einst, zugang.person), imBereich)');
  });
});
