// ─── Business-Zahlen auf 0 (05.10.2026): scripts/business-auf-null.mjs ──────────────────────────────────────────────────────
// Wacht darüber, dass das Einmal-Werkzeug genau den Business-Bereich trifft — gleiche Einordnung wie die App (`bereichVonFirma`)
// — und Privat/Selbstständigkeit sowie Unbekanntes nie anfasst.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { einordnen, aufNull } from '../scripts/business-auf-null.mjs';
import { bereichVonFirma, finanzOrtAus } from '@/lib/einheiten';

describe('business-auf-null: Einordnung wie die App', () => {
  it('jede bekannte Kennung landet im selben Bereich wie bereichVonFirma', () => {
    for (const id of ['kdv', 'ug', 'kdc', 'privat', 'g-acme', 'g-make-holding']) expect(einordnen(id), id).toBe(bereichVonFirma(id));
    for (const alt of ['KD Ventures UG', 'kd management', 'kdm', 'Consulting', 'selbst']) expect(einordnen(alt), alt).toBe(bereichVonFirma(finanzOrtAus(alt) ?? alt));
  });
  it('leer oder unbekannt wird nie angefasst', () => {
    for (const id of ['', null, undefined, 'irgendwas', 'offen']) expect(einordnen(id as string)).toBe('unbekannt');
  });
});

describe('business-auf-null: was passiert', () => {
  const daten = () => ({
    finanzplan: {
      firmen: [{ id: 'kdv', name: 'KD Ventures', kontostand: 1200 }, { id: 'ug', name: 'MAKE', kontostand: 800 }, { id: 'kdc', name: 'Selbst', kontostand: 5000 }],
      rechnungen: [{ id: 'r1', firmaId: 'kdv', betrag: 100 }, { id: 'r2', firmaId: 'kdc', betrag: 200 }, { id: 'r3', firmaId: 'g-acme', betrag: 50 }],
      zahlungen: [{ id: 'z1', firmaId: 'ug', betrag: 30 }, { id: 'z2', firmaId: 'privat', betrag: 40 }],
      merkposten: [{ id: 'm1', firmaId: 'irgendwas', betrag: 9 }],
      produkte: [{ id: 'p1' }],
    },
    liquiplan: { posten: [{ id: 'l1', firmaId: 'kdv', betrag: 10 }, { id: 'l2' }, { id: 'l3', firmaId: 'privat', betrag: 5 }] },
    buchungen: { buchungen: [{ id: 'b1', ort: 'ug', betrag: -20 }, { id: 'b2', betrag: -3 }, { id: 'b3', ort: 'kdc', betrag: 7 }] },
  });

  it('Business auf 0, Privat/Selbstständigkeit/Unbekanntes und andere Felder unverändert', () => {
    const { neu, bericht } = aufNull(daten(), '2026-10-05');
    expect(neu.finanzplan.firmen).toEqual([
      { id: 'kdv', name: 'KD Ventures', kontostand: 0, stand: '2026-10-05' },
      { id: 'ug', name: 'MAKE', kontostand: 0, stand: '2026-10-05' },
      { id: 'kdc', name: 'Selbst', kontostand: 5000 },
    ]);
    expect(neu.finanzplan.rechnungen.map((r: { id: string }) => r.id)).toEqual(['r2']);
    expect(neu.finanzplan.zahlungen.map((r: { id: string }) => r.id)).toEqual(['z2']);
    expect(neu.finanzplan.merkposten.map((r: { id: string }) => r.id)).toEqual(['m1']);
    expect(neu.finanzplan.produkte).toEqual([{ id: 'p1' }]);
    expect(neu.liquiplan.posten.map((r: { id: string }) => r.id)).toEqual(['l2', 'l3']);
    expect(neu.buchungen.buchungen.map((r: { id: string }) => r.id)).toEqual(['b2', 'b3']);
    expect(bericht.entfernt).toEqual({ rechnungen: 2, zahlungen: 1, merkposten: 0, planposten: 1, buchungen: 1 });
    expect(bericht.unbekannt).toEqual({ 'merkposten:irgendwas': 1, 'planposten:(leer)': 1 });
  });

  it('zweiter Lauf ändert nichts mehr (idempotent bis auf den Stand-Tag)', () => {
    const eins = aufNull(daten(), '2026-10-05').neu;
    const zwei = aufNull(eins, '2026-10-05');
    expect(zwei.neu).toEqual(eins);
    expect(Object.values(zwei.bericht.entfernt).every(n => n === 0)).toBe(true);
  });

  it('Skript: Trockenlauf schreibt nichts, --ausfuehren schreibt verschlüsselt und lesbar', () => {
    const d = mkdtempSync(join(tmpdir(), 'business-null-'));
    try {
      const env = { ...process.env, MAKE_OS_DATEN_DIR: d, MAKE_OS_DATEN_SCHLUESSEL: 'a'.repeat(64), MAKE_OS_PRUEF_PORTE: '1' };
      for (const [n, v] of Object.entries(daten())) writeFileSync(join(d, `${n}.json`), JSON.stringify(v));
      const vorher = readFileSync(join(d, 'finanzplan.json'), 'utf8');
      const aus = execFileSync(process.execPath, ['scripts/business-auf-null.mjs'], { env, encoding: 'utf8' });
      expect(aus).toMatch(/TROCKENLAUF/);
      expect(readFileSync(join(d, 'finanzplan.json'), 'utf8')).toBe(vorher);
      execFileSync(process.execPath, ['scripts/business-auf-null.mjs', '--ausfuehren'], { env, encoding: 'utf8' });
      const roh = readFileSync(join(d, 'finanzplan.json'), 'utf8');
      expect(roh).not.toMatch(/KD Ventures/); // verschlüsselt
      const zweiter = execFileSync(process.execPath, ['scripts/business-auf-null.mjs'], { env, encoding: 'utf8' });
      expect(zweiter).toMatch(/rechnungen: 0 entfernt/);
      expect(zweiter).toMatch(/kdv \(vorher 0\)/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
