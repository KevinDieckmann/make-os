// ─── Head of IT und Nachweise: Brain-Index, Protokoll-Kette, Format v2 (05.10.) — rein ──────────────────────────────
import { describe, it, expect } from 'vitest';
import { brainIndexBefunde, kettenBefunde, type BrainIndexLage, type KettenLage } from '@/lib/hoi/lage';
import { v2Bereitschaft, type V2Eingabe } from '@/lib/datenschutz/nachweise';

const index = (x: Partial<BrainIndexLage> = {}): BrainIndexLage => ({ ort: 'tmpfs', grund: 'tmpfs', klartextAufPlatte: false, altDateiDa: false, groesseMb: 24, grenzeMb: 256, notizen: 663, bereit: true, neubau: { fertig: '2026-10-05T10:00:00.000Z', dauerMs: 2100, fehler: null }, ...x });
const kette = (x: Partial<KettenLage> = {}): KettenLage => ({ zeit: '2026-10-05T04:10:00.000Z', ok: true, dateien: 12, eintraege: 4000, fehler: 0, warnungen: 0, getilgt: 0, namen: [], ...x });

describe('HOI: Brain-Index', () => {
  it('grün im tmpfs, rot bei Klartext auf der Platte (Notweg), gelb bei Altdatei, fast vollem tmpfs oder gescheitertem Neubau', () => {
    expect(brainIndexBefunde(index(), true, 5)[0].ampel).toBe('gruen');
    expect(brainIndexBefunde(index({ ort: 'platte', klartextAufPlatte: true }), true, 5)[0].ampel).toBe('rot');
    expect(brainIndexBefunde(index({ altDateiDa: true }), true, 5)[0].ampel).toBe('gelb');
    expect(brainIndexBefunde(index({ groesseMb: 230 }), true, 5)[0].ampel).toBe('gelb');
    expect(brainIndexBefunde(index({ neubau: { fertig: null, dauerMs: null, fehler: 'Vault fehlt' } }), true, 5)[0].ampel).toBe('gelb');
    expect(brainIndexBefunde(index({ bereit: false }), true, 0.1)[0].ampel).toBe('gruen'); // gerade gestartet: Neubau läuft noch
    expect(brainIndexBefunde(index({ bereit: false }), true, 2)[0].ampel).toBe('gelb');
    expect(brainIndexBefunde(null, true, 1)).toEqual([]);
  });
  it('keine Inhalte im Befund — nur Ort und Zahlen', () => {
    const b = brainIndexBefunde(index(), true, 5)[0];
    expect(b.wert).toMatch(/tmpfs .* 24,0 MB von 256 MB · 663 Notizen · Neubau 2,1 s/);
  });
});

describe('HOI: Protokoll-Kette', () => {
  it('„Protokoll unverändert ✓“ grün; Bruch rot; Warnung oder alte Prüfung gelb; nie geprüft grau', () => {
    const g = kettenBefunde(kette(), '2026-10-05T12:00:00.000Z')[0];
    expect(g.ampel).toBe('gruen');
    expect(g.wert).toMatch(/^Protokoll unverändert ✓/);
    expect(kettenBefunde(kette({ ok: false, fehler: 1, namen: ['leseprotokoll--h--2026-10'] }), '2026-10-05T12:00:00.000Z')[0]).toMatchObject({ ampel: 'rot', wert: expect.stringContaining('leseprotokoll--h--2026-10') });
    expect(kettenBefunde(kette({ warnungen: 2 }), '2026-10-05T12:00:00.000Z')[0].ampel).toBe('gelb');
    expect(kettenBefunde(kette(), '2026-10-07T12:00:00.000Z')[0].ampel).toBe('gelb');
    expect(kettenBefunde(null)[0].ampel).toBe('grau');
    expect(kettenBefunde(undefined)).toEqual([]);
  });
});

describe('Format v2 — Bereitschaft (Selbstprüfung)', () => {
  const basis: V2Eingabe = { modus: 'kompatibel', unbekannt: false, verschluesselt: true, schluesselQuelle: 'datei', pepper: true, brainIndexKlartext: false, bilderKlartext: 0, alteHuellen: 0, klartextBestaende: 0 };
  it('zeigt den Modus und ist bereit, wenn nichts mehr im Klartext liegt', () => {
    const b = v2Bereitschaft(basis);
    expect(b.modus).toBe('kompatibel');
    expect(b.bereit).toBe(true);
    expect(b.punkte.find(p => p.id === 'modus')).toMatchObject({ stand: 'hinweis', text: expect.stringContaining('Kompatibilitätsmodus') });
    expect(v2Bereitschaft({ ...basis, modus: 'v2' }).punkte.find(p => p.id === 'modus')?.stand).toBe('ok');
  });
  it('nennt, was fehlt: Klartext-Bilder, Klartext-Index, fehlender Pepper, Klartext-Bestände', () => {
    expect(v2Bereitschaft({ ...basis, bilderKlartext: 3 })).toMatchObject({ bereit: false });
    expect(v2Bereitschaft({ ...basis, brainIndexKlartext: true }).punkte.find(p => p.id === 'brain-index')?.stand).toBe('offen');
    expect(v2Bereitschaft({ ...basis, pepper: false }).punkte.find(p => p.id === 'pepper')?.stand).toBe('offen');
    expect(v2Bereitschaft({ ...basis, klartextBestaende: 2 }).bereit).toBe(false);
    expect(v2Bereitschaft({ ...basis, verschluesselt: false }).bereit).toBe(false);
  });
});
