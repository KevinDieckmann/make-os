// ─── Agenten-Bereich · Paket 2: Plattform-Wächter der Oberfläche (09.10., AGENTEN_KONZEPT.md C5 › Plattform) ─────────────
// Plattform-Regel (CLAUDE.md, Kevin 01.10.): nichts Persönliches fest einbauen — keine Namen, keine Firmen, kein fester
// Speichername in components/os/agenten/** und der Seite. Personen kommen aus der Sitzung, Heads aus dem Katalog/der Route,
// Firmen über lib/einheiten.ts bzw. das Register. Dazu: die Seite entscheidet nie selbst, wer was sieht (kein Rollen-/Personen-
// Sonderfall in der Oberfläche — die Trennung macht der Server).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { KERN_EINHEITEN } from '@/lib/einheiten';

const WURZEL = path.resolve(__dirname, '..');
function dateien(dir: string): string[] {
  return readdirSync(path.join(WURZEL, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(WURZEL, rel)).isDirectory() ? dateien(rel) : /\.tsx?$/.test(n) ? [rel] : [];
  });
}
const DATEIEN = [...dateien('components/os/agenten'), 'app/os/agenten/page.tsx'];
const lies = (p: string) => readFileSync(path.join(WURZEL, p), 'utf8');

describe('Plattform: nichts Persönliches in der Agenten-Oberfläche', () => {
  it('die Oberfläche hat ihre Dateien', () => {
    expect(DATEIEN.length).toBeGreaterThanOrEqual(10);
  });

  it('keine Personennamen, kein fester Speichername, keine Firmen', () => {
    const FIRMEN = KERN_EINHEITEN.filter(e => e.id !== 'kdc').flatMap(e => [e.label, e.kurz]);
    for (const d of DATEIEN) {
      const t = lies(d);
      expect(t, d).not.toMatch(/kevin|malin|marlene|kemaris|capos|dieckmann|make\.one|makeinnovation|kd ventures/i);
      for (const f of FIRMEN) expect(new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t), `${d}: ${f}`).toBe(false);
    }
  });

  it('keine Sonderfälle nach Person, Rolle oder Speichername — wer was sieht, entscheidet der Server', () => {
    for (const d of DATEIEN) {
      const t = lies(d);
      expect(t, d).not.toMatch(/===\s*'(inhaber|partner|owner|admin)'/);
      expect(t, d).not.toMatch(/person\s*===\s*['"]/);
      expect(t, d).not.toMatch(/finanzRecht/);
    }
  });

  it('keine Farbwerte, Firmenfarben oder festen Adressen außerhalb der eigenen Routen', () => {
    for (const d of DATEIEN) {
      const t = lies(d);
      expect(t, d).not.toMatch(/https?:\/\/(?!\/)/);
      expect(t, d).not.toMatch(/organisation-data|ORG_FARBE/);
    }
  });
});
