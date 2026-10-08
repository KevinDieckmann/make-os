// ─── Wächter: Buchungen werden nie still gekürzt (09.10., Befund des Kontoauszug-Pakets) ─────────────────────────────
// Vorher schnitt PUT /api/state/buchungen nach 5.000 Einträgen ab und PATCH nach 200 Änderungen. Jetzt: darüber 413 mit Satz.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const quelle = readFileSync(join(__dirname, '..', 'app', 'api', 'state', 'buchungen', 'route.ts'), 'utf8');

describe('Buchungen: Grenzen statt Kürzen', () => {
  it('kein slice über die Liste der Buchungen oder Änderungen', () => {
    expect(quelle).not.toMatch(/body\.buchungen\.slice\(/);
    expect(quelle).not.toMatch(/body\.ops\.slice\(/);
  });
  it('über der Grenze antwortet die Route mit 413 und „nichts gespeichert“', () => {
    expect(quelle).toMatch(/BUCHUNGEN_MAX[\s\S]*status: 413/);
    expect(quelle).toMatch(/BUCHUNGEN_OPS_MAX[\s\S]*status: 413/);
    expect(quelle).toMatch(/nichts gespeichert/);
  });
});
