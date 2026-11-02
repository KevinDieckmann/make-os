// ─── Buchhaltung — Regel-Bestände je Bereich (02.11., Trennungsregel) ────────────────────────────────────────────────────────────────────
// Wächter „Sicht X bekommt nichts aus Y“ auf der Platte: Regeln der Business-Gesellschaften liegen nur in `buchungs-regeln--<h>`, alle übrigen
// (privat, ohne Gesellschaft) nur in `buchungs-regeln-privat--<h>`; gelesen wird zusammengelegt, ein Altbestand wird beim Schreiben umgelegt.
import { describe, it, expect, vi, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-regeln-trennung-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
  return o;
});

import { loadJson, saveJson } from '@/lib/store/local-db';
import { regelnAendern, regelnLaden, regelnName, regelnNamePrivat, regelnStand, regelnTeilen } from '@/lib/finanzen/buchhaltung/server';
import type { BuchungsRegel, RegelBestand } from '@/lib/finanzen/buchhaltung/regeln';

afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const J = '2026-11-02T10:00:00.000Z';
const R = (id: string, ort?: string): BuchungsRegel => ({ id, ...(ort ? { ort } : {}), feld: 'wer', muster: `Beispiel ${id}`, kategorie: 'Sonstiges', angelegt: J });

describe('Regel-Bestände getrennt nach Bereich', () => {
  it('regelnTeilen: Business-Gesellschaft → Business, privat und ohne Gesellschaft → Privat; Kategorien beim Business', () => {
    const t = regelnTeilen({ regeln: [R('br-1', 'ug'), R('br-2', 'privat'), R('br-3')], kategorien: ['Eigene'] });
    expect(t.business.regeln.map(r => r.id)).toEqual(['br-1']);
    expect(t.privat.regeln.map(r => r.id)).toEqual(['br-2', 'br-3']);
    expect(t.business.kategorien).toEqual(['Eigene']);
    expect(t.privat.kategorien).toEqual([]);
  });

  it('Schreiben legt je Bereich ab, Lesen legt zusammen; Altbestand mit Privat-Regel im Business-Bestand wird umgelegt', async () => {
    const h = 'test';
    await saveJson(regelnName(h), { regeln: [R('br-alt-ug', 'ug'), R('br-alt-privat', 'privat')], kategorien: [] } satisfies RegelBestand);
    const vorher = await regelnLaden(h);
    expect(vorher.regeln.map(r => r.id).sort()).toEqual(['br-alt-privat', 'br-alt-ug']);

    const e = await regelnAendern(h, regelnStand(vorher), b => ({ ...b, regeln: [...b.regeln, R('br-neu-kdv', 'kdv'), R('br-neu-ohne')] }));
    expect(e.ok).toBe(true);

    const biz = await loadJson<RegelBestand>(regelnName(h));
    const priv = await loadJson<RegelBestand>(regelnNamePrivat(h));
    expect(biz!.regeln.map(r => r.id).sort()).toEqual(['br-alt-ug', 'br-neu-kdv']);
    expect(priv!.regeln.map(r => r.id).sort()).toEqual(['br-alt-privat', 'br-neu-ohne']);
    expect((await regelnLaden(h)).regeln).toHaveLength(4);

    // Veralteter Stand → Konflikt, nichts geschrieben.
    const k = await regelnAendern(h, regelnStand(vorher), b => ({ ...b, regeln: [] }));
    expect(k.ok).toBe(false);
    expect((await regelnLaden(h)).regeln).toHaveLength(4);
  });
});
