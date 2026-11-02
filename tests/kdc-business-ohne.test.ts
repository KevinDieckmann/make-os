// ─── Selbstständigkeit im Business (02.11.) — Gegenstück OHNE Instanz-Einstellung ─────────────────
// Ohne `NEXT_PUBLIC_MAKE_OS_EINHEITEN` bleibt alles wie vor dem 02.11.: die Selbstständigkeit gehört zu Privat, die neuen Helfer ändern nichts.
import { describe, it, expect } from 'vitest';
import { bereichVon, selbstImBusiness, selbstArbeitsEinheit, privatArbeitsEinheit, BUSINESS_GESELLSCHAFTEN } from '../lib/einheiten';
import { gespeicherterSpace } from '../lib/make-one/space-regeln';
import { DARLEHEN_BUSINESS } from '../lib/finanzen/darlehen';
import { blaetterFuer } from '../lib/finanzen/plan/hilfen';
import { arbeitsPruefer, sichtPruefer } from '../lib/zeitmessung/einheiten';
import { finanzOrtName } from '../lib/einheiten';

describe('ohne Instanz-Einstellung: unverändert', () => {
  it('die Selbstständigkeit gehört zu Privat', () => {
    expect(process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN ?? '').toBe('');
    expect(selbstImBusiness()).toBe(false);
    expect(bereichVon('kdc')).toBe('privat');
    expect(BUSINESS_GESELLSCHAFTEN).not.toContain('kdc');
    expect(DARLEHEN_BUSINESS).not.toContain('kdc');
    expect(blaetterFuer('business').map(b => b.id)).not.toContain('selbst');
  });
  it('die neuen Helfer liefern dasselbe wie vorher', () => {
    expect(selbstArbeitsEinheit('kdc')).toBe(privatArbeitsEinheit('kdc'));
    for (const t of [{ space: 'privat', spaceId: 'kdc' }, { space: 'business', spaceId: 'kdv' }, { space: 'privat' }, {}]) expect(gespeicherterSpace(t)).toBe(t.space);
    const alt = { von: '2026-10-01T08:00:00.000Z', bis: '2026-10-01T09:00:00.000Z', schluessel: 'privat:fokuszeit', label: 'x', sek: 3600, einheit: finanzOrtName('kdc') };
    expect(arbeitsPruefer()(alt)).toBe(true);
    expect(sichtPruefer('privat')(alt)).toBe(true);
    expect(sichtPruefer('business')(alt)).toBe(false);
  });
});
