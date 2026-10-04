// ─── Gesellschafts-Register · DSGVO (Prüfung 04.10.): Art. 15 Kopie, Art. 17 tilgt auch Papierkorb/Archiv ─
// Ein CRM-Kontakt als Gesellschafter, als Organ (im Papierkorb) und als Vertragspartei (Vertrag beendet = Archiv).
// Eigener Datenordner, erfundene Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ges-dsgvo-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ges-dsgvo';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

import { registerAuskunft } from '@/lib/gesellschaften/auskunft';
import { gesellschafterSaeubern, organSaeubern, GETILGT, type RegisterDatei } from '@/lib/gesellschaften/modell';
import { GELOESCHT, merkmaleVon, weitereEntfernen, weitereAufzaehlen } from '@/lib/crm/person-weitere';

const G = 'g-11111111-1111-4111-8111-111111111111';
const K = 'c-erfunden-kontakt-1';
const ANDERER = 'c-erfunden-kontakt-2';
const register = (): RegisterDatei => ({ gesellschaften: [{
  id: G as never, name: 'Erfundene Beispiel GmbH', stammkapitalCent: 2_500_000,
  gesellschafter: [
    { id: 'gs-aaaa-1111', wer: { art: 'kontakt', id: K }, nennbetragCent: 1_000_000, einlage: 'ja', klauseln: 'Vorkaufsrecht', eingetretenAm: '2026-01-02' },
    { id: 'gs-bbbb-2222', wer: { art: 'kontakt', id: ANDERER }, nennbetragCent: 1_500_000, einlage: 'nein' },
  ],
  organe: [{ id: 'og-aaaa-1111', funktion: 'beirat', wer: { art: 'kontakt', id: K }, seit: '2026-02-01', geloeschtAm: '2026-10-01T10:00:00.000Z' }],
  vertraege: [{ id: 'vt-aaaa-1111', art: 'darlehen', titel: 'Gesellschafterdarlehen', parteien: [{ art: 'gesellschaft', id: G }, { art: 'kontakt', id: K }], status: 'beendet', notiz: 'Rückzahlung Max Erfunden' }],
}] });

describe('Art. 15 — Kopie der Register-Angaben (auch Papierkorb/Archiv, markiert)', () => {
  it('Gesellschafter, Organ (Papierkorb) und Vertragspartei (Archiv) — nur zu DIESER Kennung', () => {
    const a = registerAuskunft(register(), K);
    expect(a.map(x => x.rolle)).toEqual(['Gesellschafter', 'Organ', 'Vertragspartei']);
    expect(a[0]).toMatchObject({ gesellschaft: 'Erfundene Beispiel GmbH', seit: '2026-01-02' });
    expect(a[0].angaben).toContain('Vorkaufsrecht');
    expect(a[1]).toMatchObject({ angaben: 'Beirat', papierkorb: true });
    expect(a[2]).toMatchObject({ archiv: true });
    expect(JSON.stringify(a)).not.toContain('Rückzahlung'); // interne Notiz nicht in der Kopie
    expect(registerAuskunft(register(), 'c-niemand')).toEqual([]);
  });
});

describe('Art. 17 — die Kennung fällt überall im Register, auch im Papierkorb; der Eintrag bleibt änderbar', () => {
  it('weitereEntfernen tilgt Gesellschafter, Organ im Papierkorb und Vertragspartei — die andere Person bleibt', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('gesellschaften--h-pruef', register());
    const m = merkmaleVon(K, { vorname: 'Max', nachname: 'Erfunden', email: 'max@example.invalid' });
    expect((await weitereAufzaehlen(m))['gesellschaften--h-pruef']).toBeGreaterThan(0);
    const r = await weitereEntfernen(m);
    expect(r.speicher['gesellschaften--h-pruef']).toBeGreaterThan(0);
    const nach = await db.loadJson<RegisterDatei>('gesellschaften--h-pruef');
    const text = JSON.stringify(nach);
    expect(text).not.toContain(K);
    expect(text).not.toContain('Max Erfunden'); // auch im Freitext
    expect(text).toContain(ANDERER);
    const g = nach!.gesellschaften[0];
    expect(g.gesellschafter![0].wer).toEqual({ art: 'kontakt', id: GELOESCHT });
    expect(g.organe![0].wer.id).toBe(GELOESCHT);
    expect(g.vertraege![0].parteien[1].id).toBe(GELOESCHT);
    expect(registerAuskunft(nach, K)).toEqual([]);
    expect(await weitereAufzaehlen(m)).toEqual({}); // idempotent: nichts mehr zu finden
  });
  it('ein getilgter Eintrag lässt sich weiter speichern (Cap-Table bleibt), die Marke ist dieselbe wie im Löschlauf', () => {
    expect(GETILGT).toBe(GELOESCHT);
    const r = gesellschafterSaeubern({ id: 'gs-aaaa-1111', wer: { art: 'kontakt', id: GELOESCHT }, nennbetragCent: 1_000_000, einlage: 'ja' }, G as never);
    expect(r.fehler).toEqual([]);
    expect(organSaeubern({ id: 'og-aaaa-1111', funktion: 'beirat', wer: { art: 'kontakt', id: GELOESCHT } }).fehler).toEqual([]);
  });
});
