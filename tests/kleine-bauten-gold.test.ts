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
// 02.11. neuer PDF-Stil: Dokument und PDF bewusst neu gesetzt — die Überschrift trägt jetzt die Nummer („Angebot Nr. …“,
// „Rechnung Nr. …“, „Stornorechnung Nr. …“) mit dem Titel bzw. „zu Rechnung …“ als `unterzeile`, und das PDF hat den neuen Aufbau
// (Band, rechte Spalte, Flächen). Die Absicht bleibt: die neuen optionalen Felder `leiste`/`akzent` OHNE Wert (der Gold-Absender
// trägt sie nicht) ändern nichts — sie fehlen im Dokument, und das PDF zeichnet dann Tinte und die `fuss`-Zeilen (tests/pdf-stil.test.ts).
const GOLD_DOKUMENT: Record<string, string> = {
  angebot: 'fd0b59c364200dedcc2dd4977604b39e59762019d9f6bf610ff69b9d0b113acb',
  rechnung: '2701a85b00c9b927a9d1dbcbe11b740c20d6197098dae39a781bb38875f26433',
  storno: '1a12a426d55b8dcf40a75dcf22c935bf4a505038e77a030b4a3e537a2463dc8f',
};
const GOLD_PDF: Record<string, string> = {
  angebot: '068b48293a2cbd67151ebdef22190d4bc608878d945767bd3a916b7600b02363',
  rechnung: 'f51abb3c02be0a46ec10e8fc34d5d92cce293d6090a23055c799b709e8a03fb1',
  storno: 'faf297311b6990281cfe36d49fe57434b1a6fc37b545643ab2344c7e7a340e84',
};

describe('Gold: ohne neue Felder bit-gleich (Dokument und PDF)', () => {
  for (const [name, d] of Object.entries(goldDokumente())) {
    it(`${name}: Dokument`, () => { expect(d.absender).not.toHaveProperty('leiste'); expect(d.absender).not.toHaveProperty('akzent'); expect(sha(Buffer.from(JSON.stringify(d)))).toBe(GOLD_DOKUMENT[name]); });
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
