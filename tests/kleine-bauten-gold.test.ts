// ─── Kleine Bauten (25.10.) — Gold: ohne neue Felder bleiben Dokument und PDF Byte für Byte, wie sie waren ───────────────
// Die Prüfsummen wurden mit dem Stand VOR den kleinen Bauten (Basis 3fad7515) gerechnet. Ändert sich eine davon, hat ein neues
// optionales Feld (Artikelnummer, Kundennummer, Annahmeblock, AGB-Link) den Aufbau auch ohne Wert verändert — das darf nicht sein.
// Alle Werte erfunden.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { angebotPdf } from '@/lib/crm/angebot-pdf';
import { goldDokumente } from './fixtures/kleine-bauten-gold';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ERSTELLT = new Date('2026-10-20T10:00:00.000Z');

// Prüfsummen vom Stand vor den kleinen Bauten (gerechnet am 25.10. auf 3fad7515).
const GOLD_DOKUMENT: Record<string, string> = {
  angebot: '4e16a4066e38389695150aa743de372cf1eb115859f062357a34a7e459803dfd',
  rechnung: '85fee1cc0dcd4c4439428027f1d9da4ae69c9ad764e9e7af89a71d61d3b934d8',
  storno: '04825862aa662ea3d8c7b7318cbe1c3cf0dd3acc2c9dd0d4f7852f9a06883c29',
};
const GOLD_PDF: Record<string, string> = {
  angebot: 'dfa4e8a924591472568e95167d2db0af6a586e0a7148c15158f79d5cae79f287',
  rechnung: 'fb6717f4242399d77f74d4fe2be024b6cc3fe741c16c5855b007583a40a359f8',
  storno: '7fab6f50765375f1816aff6635021e1dc8ae5e32d9730935aac9327bd953d3f1',
};

describe('Gold: ohne neue Felder bit-gleich (Dokument und PDF)', () => {
  for (const [name, d] of Object.entries(goldDokumente())) {
    it(`${name}: Dokument`, () => { expect(sha(Buffer.from(JSON.stringify(d)))).toBe(GOLD_DOKUMENT[name]); });
    it(`${name}: PDF`, async () => { expect(sha(await angebotPdf(d, { erstellt: ERSTELLT }))).toBe(GOLD_PDF[name]); });
  }
});

describe('Gold: Mail- und Vorlagentexte, Rechnungsnummer ohne neue Einstellung bit-gleich', () => {
  it('Einleitung/Schluss, Begleit-Mail (Sie, Du, leer), Rechnungs-Mail, nächste Rechnungsnummer', async () => {
    const { readFileSync } = await import('node:fs');
    const gold = JSON.parse(readFileSync('tests/fixtures/kleine-bauten-gold-texte.json', 'utf8'));
    const { angebotVorlage, mailVorlage } = await import('@/lib/crm/angebote');
    const { rechnungMail, naechsteNummer } = await import('@/lib/finanzen/rechnung/regeln');
    const e = { anrede: 'Sie' as const, vorname: 'Max', nachname: 'Muster', titel: 'Begleitung', absender: 'Beispiel Werkstatt GmbH', nummer: 'BW-A-2026-0007', gueltigBis: '2026-11-30', person: 'Erika Muster' };
    expect([angebotVorlage(e), mailVorlage(e)]).toEqual(gold.sie);
    expect([angebotVorlage({ ...e, anrede: 'Du' }), mailVorlage({ ...e, anrede: 'Du' })]).toEqual(gold.du);
    expect(mailVorlage({ titel: '' })).toEqual(gold.ohne);
    expect(rechnungMail({ nummer: 'BW-R-2026-0003', titel: 'Begleitung', betrag: 2975, faellig: '2026-11-03', empfaenger: { name: 'Max Muster' } }, 'Beispiel Werkstatt GmbH')).toEqual(gold.rechnung);
    expect(naechsteNummer([{ firmaId: 'ug', lauf: { jahr: 2026, nr: 4 }, nummer: 'BW-R-2026-0004' }] as never, 2, 'ug', 2026, 'BW')).toEqual(gold.nummer);
  });
});
