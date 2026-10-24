// ─── Feinschliff 1 (23.10.) · Punkte 2, 5 — Stellschrauben zugeklappt mit Ort in Worten; Filter der Knoten-Auswahl über der Liste ─────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { STELLSCHRAUBE_ORT, ortSatz } from '@/lib/prozesse/stellschrauben';
import { stellschraubenBauen, VORGABE_MAHNTAGE, VORGABE_FULFILLMENT } from '@/lib/prozesse/stellschrauben-bau';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('2 · Stellschrauben: Ort in Worten, zugeklappt', () => {
  const je = stellschraubenBauen({
    wertelisten: {}, loeschfristen: {}, mahnTage: [...VORGABE_MAHNTAGE], fulfillment: { ...VORGABE_FULFILLMENT, nachsorgeTage: [...VORGABE_FULFILLMENT.nachsorgeTage] },
    heads: { sales: {}, marketing: {}, event: {}, finanzen: {} }, werte: {},
  });
  it('jede Stellschraube nennt ihren Ort über EINE Abbildung — nie Dateipfade oder Bestandsnamen', () => {
    const alle = Object.values(je).flat();
    expect(alle.length).toBeGreaterThan(10);
    for (const s of alle) {
      expect(Object.keys(STELLSCHRAUBE_ORT), s.id).toContain(s.wo);
      expect(ortSatz(s.wo)).not.toMatch(/[()/]|\.ts\b|crm/);
    }
    expect(ortSatz('gibt-es-nicht')).toBe(STELLSCHRAUBE_ORT.system);
    expect(lies('lib/prozesse/stellschrauben-bau.ts')).not.toMatch(/im Code \(|\((crm|prozesse|agenten|markttraktion)[-.a-z]*\)/);
  });
  it('die Karte beginnt zugeklappt (Automationen & Head, Steckbrief) — nur, wer sie öffnet, sieht die Gruppen', () => {
    const k = lies('components/os/prozesse/Stellschrauben.tsx');
    expect(k).toContain('offen: offenAnfang = false');
    expect(k).toContain('<Klappbar id={`pz-schrauben-${p.id}`} titel="Stellschrauben"');
    expect(k).toContain('{ortSatz(s.wo)}');
    expect(k).not.toContain('Gespeichert in: ');
  });
});

describe('5 · Knoten-Auswahl: die Filter stehen über der Liste, umbrechend', () => {
  it('kein einzeiliger (wischbarer) Filter mehr; nur die Liste schrumpft und rollt', () => {
    const fa = lies('components/os/prozesse/WerkstattFormauswahl.tsx');
    expect(fa).not.toContain('<Pillen einzeilig');
    expect(fa).toContain('className="pw-auswahl-filter"');
    expect(lies('app/globals.css')).toContain('.pw-auswahl-leiste > :not(.pw-auswahl-liste) { flex: 0 0 auto; }');
  });
});
