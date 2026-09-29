// ─── F1 (Gesamtprüfung Prüfer 1, 29.09.) #7/#15: Zeit-Auswertung — Privates der anderen Person zählt nur als belegte
// Zeit (ohne Mandat, Kontakte, Gäste); Kontakte erscheinen mit Namen/Link statt nackter Kennung. Eigener Datenordner,
// die gelesenen Termine gemockt (kein iCloud), alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-auswertung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-f1-aw-nur-im-test';

const basis = { href: '', kalenderId: 'K-G', ganztags: false, serie: false, bearbeitbar: true, art: 'termin', beschaeftigt: true };
vi.mock('@/lib/kalender/termine-lesen', () => ({
  termineLesen: async () => ({
    quelle: 'icloud', kalender: [], termine: [
      // Malins privater Termin im gemeinsamen Kalender — mit Mandat, Kontakt und Gast.
      { ...basis, id: 'G|m-privat', uid: 'm-privat', titel: 'Arzt Malin', start: '2026-10-06T10:00:00', ende: '2026-10-06T11:00:00', kalender: 'Gemeinsam', wer: 'beide', von: 'malin', sichtbarkeit: 'privat', mitTeilnehmern: true, bezug: { mandatId: 'm-geheim', kontaktId: 'c-geheim' }, gastKontakte: ['c-gast'] },
      // Kevins eigener Termin mit Kontakt.
      { ...basis, id: 'G|k-eigen', uid: 'k-eigen', titel: 'Kunde', start: '2026-10-07T10:00:00', ende: '2026-10-07T11:00:00', kalender: 'Gemeinsam', wer: 'beide', von: 'kevin', sichtbarkeit: 'standard', mitTeilnehmern: false, bezug: { kontaktId: 'c-1' } },
    ],
  }),
}));

let aw: typeof import('@/lib/kalender/auswertung-server');
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-08T06:00:00Z'));
  aw = await import('@/lib/kalender/auswertung-server');
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('F1 #7 Zeit-Auswertung: Privates der anderen Person nur als belegt', () => {
  it('Kevin: Malins privater Termin zählt als Meeting-Zeit, aber ohne Mandat, Kontakte und Gäste', async () => {
    const a = await aw.zeitAuswertungFuer('kevin', '2026-10-08');
    expect(a.woche.minuten.meetings).toBe(120); // beide Termine belegen Zeit
    expect(a.woche.jeMandat).toEqual([]);
    expect(a.woche.kontakte.map(k => k.id)).toEqual(['c-1']);
    expect(JSON.stringify(a)).not.toMatch(/m-geheim|c-geheim|c-gast/);
  });

  it('Malin: ihr eigener privater Termin zählt voll (Mandat, Kontakt, Gast)', async () => {
    const a = await aw.zeitAuswertungFuer('malin', '2026-10-08');
    expect(a.woche.jeMandat.map(m => m.mandatId)).toEqual(['m-geheim']);
    expect(a.woche.kontakte.map(k => k.id).sort()).toEqual(['c-1', 'c-gast', 'c-geheim']);
  });
});

describe('F1 #15 Auswertung zeigt Kontakte als Namen/Link, nicht als Kennung', () => {
  it('Kontaktzeile verlinkt die Akte; die Kennung steht nicht als Text da', async () => {
    const { AuswertungInhalt } = await import('@/components/os/kalender/Auswertung');
    const { bezugLink } = await import('@/lib/aufgaben/crm-verweise');
    const a = await aw.zeitAuswertungFuer('kevin', '2026-10-08');
    const html = renderToStaticMarkup(h(AuswertungInhalt, { a }));
    expect(html).toContain(`href="${bezugLink('kontaktId', 'c-1').replace(/&/g, '&amp;')}"`);
    expect(html).not.toMatch(/>c-1</);
  });
});
