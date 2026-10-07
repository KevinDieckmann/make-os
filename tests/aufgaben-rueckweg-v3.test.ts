// ─── Rückweg Aufgaben-Umbau v3 (07.10.2026): scripts/aufgaben-rueckweg-v3.mjs ────────────────────────────────────────────────
// Wacht darüber, dass das Werkzeug nur eine echte Umbau-Kopie nimmt, im Trockenlauf nichts schreibt, beim Ausführen den heutigen
// Stand zuerst verschlüsselt ins Archiv legt und die Kopie als `tasks` (AAD `tasks`) neu verschlüsselt — nie Titel ausgibt.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { kopieWaehlen, zahlen } from '../scripts/aufgaben-rueckweg-v3.mjs';
import { schluesselRing, huelleImModus, huelleOeffnen } from '../lib/store/huelle.mjs';

describe('aufgaben-rueckweg-v3: rein', () => {
  it('nimmt nur echte Umbau-Kopien — die jüngste oder die genannte', () => {
    const d = ['tasks-vor-umbau-2026-09-01T00-00-00-000Z.json', 'tasks-vor-umbau-v3-2026-10-07T08-00-00-000Z.json', 'tasks-vor-umbau-v3-2026-10-08T08-00-00-000Z.json', 'tasks-umbau-v3-bericht-2026-10-08T08-00-00-000Z.json'];
    expect(kopieWaehlen(d)).toBe('tasks-vor-umbau-v3-2026-10-08T08-00-00-000Z.json');
    expect(kopieWaehlen(d, 'tasks-vor-umbau-v3-2026-10-07T08-00-00-000Z.json')).toBe('tasks-vor-umbau-v3-2026-10-07T08-00-00-000Z.json');
    expect(kopieWaehlen(d, 'tasks-umbau-v3-bericht-2026-10-08T08-00-00-000Z.json')).toBeNull();
    expect(kopieWaehlen(d, '../tasks.json')).toBeNull();
    expect(kopieWaehlen(['andere.json'])).toBeNull();
  });
  it('Zahlen: nur Längen und Umbau-Merker, nie Inhalte', () => {
    expect(zahlen({ projekte: [{ titel: 'Geheim' }], gruppen: [1, 2], umbauVersion: 2, name: 'x' })).toEqual({ projekte: 1, gruppen: 2, umbauVersion: 2 });
    expect(zahlen(null)).toEqual({ leer: true });
  });
});

describe('aufgaben-rueckweg-v3: Skript', () => {
  it('Trockenlauf schreibt nichts; --ausfuehren sichert heute und spielt die Kopie verschlüsselt zurück', () => {
    const d = mkdtempSync(join(tmpdir(), 'aufgaben-rueckweg-'));
    try {
      const SCHLUESSEL = 'b'.repeat(64);
      const env = { ...process.env, MAKE_OS_DATEN_DIR: d, MAKE_OS_DATEN_SCHLUESSEL: SCHLUESSEL, MAKE_OS_PRUEF_PORTE: '1' };
      const alt = process.env.MAKE_OS_DATEN_SCHLUESSEL;
      process.env.MAKE_OS_DATEN_SCHLUESSEL = SCHLUESSEL;
      const ring = schluesselRing();
      process.env.MAKE_OS_DATEN_SCHLUESSEL = alt;
      const aktiv = ring.aktiv!;
      mkdirSync(join(d, 'archiv'));
      const kopie = { projekte: [{ id: 'p1', titel: 'Rechnungswesen' }], gruppen: [{ id: 'g1', titel: 'Belege' }], listen: [{ id: 'l1', gruppeId: 'g1' }], umbauVersion: 2 };
      const heute = { projekte: [{ id: 'p1', titel: 'Rechnungswesen' }], listen: [{ id: 'g1' }], umbauVersion: 3 };
      const name = 'tasks-vor-umbau-v3-2026-10-08T08-00-00-000Z.json';
      writeFileSync(join(d, 'archiv', name), huelleImModus(JSON.stringify(kopie), aktiv, `archiv/${name}`));
      writeFileSync(join(d, 'tasks.json'), huelleImModus(JSON.stringify(heute), aktiv, 'tasks'));
      const vorher = readFileSync(join(d, 'tasks.json'), 'utf8');

      const trocken = execFileSync(process.execPath, ['scripts/aufgaben-rueckweg-v3.mjs'], { env, encoding: 'utf8' });
      expect(trocken).toMatch(/TROCKENLAUF/);
      expect(trocken).toMatch(/"gruppen":1/);
      expect(trocken).not.toMatch(/Rechnungswesen|Belege/);
      expect(readFileSync(join(d, 'tasks.json'), 'utf8')).toBe(vorher);

      execFileSync(process.execPath, ['scripts/aufgaben-rueckweg-v3.mjs', '--ausfuehren'], { env, encoding: 'utf8' });
      const roh = readFileSync(join(d, 'tasks.json'), 'utf8');
      expect(roh).not.toMatch(/Rechnungswesen/); // verschlüsselt
      expect(JSON.parse(huelleOeffnen(JSON.parse(roh), ring, 'tasks').text)).toEqual(kopie);
      const sicher = readdirSync(join(d, 'archiv')).find(f => f.startsWith('tasks-vor-rueckweg-v3-'))!;
      expect(sicher).toBeTruthy();
      expect(JSON.parse(huelleOeffnen(JSON.parse(readFileSync(join(d, 'archiv', sicher), 'utf8')), ring, `archiv/${sicher}`).text)).toEqual(heute);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('ohne Kopie: klare Meldung, Fehlercode, nichts geschrieben', () => {
    const d = mkdtempSync(join(tmpdir(), 'aufgaben-rueckweg-leer-'));
    try {
      const env = { ...process.env, MAKE_OS_DATEN_DIR: d, MAKE_OS_DATEN_SCHLUESSEL: 'c'.repeat(64), MAKE_OS_PRUEF_PORTE: '1' };
      let aus = '';
      try { execFileSync(process.execPath, ['scripts/aufgaben-rueckweg-v3.mjs', '--ausfuehren'], { env, encoding: 'utf8' }); } catch (e) { aus = String((e as { stdout?: string }).stdout ?? ''); }
      expect(aus).toMatch(/Keine Archiv-Kopie/);
      expect(readdirSync(d).filter(f => f !== '.schreiber')).toEqual([]);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
