// ─── Lichtfäden-Quelle Finanzen & Fristen → Stränge (erfundene Daten, keine Beträge im Titel) ─
import { describe, it, expect } from 'vitest';
import { finanzStraenge } from '@/lib/lichtfaeden/quellen/finanzen';
import { BEIDE, GESAMT } from '@/lib/lichtfaeden/modell';

const HEUTE = '2026-10-03';
const ZIEL = [GESAMT, 'space:business', 'thema:business:mandate', 'ziel:z-1'];

describe('Finanzen → Stränge', () => {
  const l = finanzStraenge({
    heute: HEUTE,
    bezuege: { firma: new Map(), mandat: new Map([['md-1', ZIEL]]) },
    zahlungen: [{ id: 'z-1', titel: 'Miete Büro', faellig: '2026-10-15', status: 'offen', firmaId: 'kdv' }, { id: 'z-2', titel: 'Bezahlt', faellig: '2026-10-15', status: 'bezahlt' }],
    rechnungen: [
      { id: 'r-1', titel: 'Retainer Oktober', faellig: '2026-10-20', status: 'gestellt', firmaId: 'kdc', mandatId: 'md-1' },
      { id: 'r-2', titel: 'Retainer November', datum: '2026-11-01', status: 'geplant', firmaId: 'kdc' },
      { id: 'r-3', titel: 'Storniert', faellig: '2026-10-20', status: 'storniert' },
    ],
    posten: [{ id: 'p-1', name: 'Versicherung', art: 'rechnung', einheit: 'privat', status: 'offen', faellig: '2026-10-09', wer: 'malin' }, { id: 'p-2', name: 'Konto', art: 'konto', einheit: 'privat', status: 'offen', faellig: '2026-10-09' }],
    belege: [{ id: 'b-1', bezeichnung: 'Handwerker', faellig_am: '2026-10-12', einheit: 'privat', erledigt: false }],
    steuer: [{ id: 's-1', datum: '2026-10-10', einheit: 'kdv', titel: 'USt-Voranmeldung', erledigt: false, href: '/os/finanzen?s=steuern#fristen' }, { id: 's-2', datum: '2026-09-10', einheit: 'privat', titel: 'ESt', erledigt: true, href: '/x' }],
  });
  const st = (id: string) => l.find(x => x.id === id)!;

  it('Einheit → Space: Gesellschaft = Business, privat = Privat; Thema Finanzen', () => {
    expect(st('zahlung:z-1').pfad).toEqual([GESAMT, 'space:business', 'thema:business:finanzen']);
    expect(st('posten:p-1').pfad).toEqual([GESAMT, 'space:privat', 'thema:privat:finanzen']);
    expect(st('beleg:b-1').pfad).toEqual([GESAMT, 'space:privat', 'thema:privat:finanzen']);
  });
  it('nur Offenes; Rechnung gestellt → Zahlungseingang am Fälligkeitstag, geplant → stellen am Datum; Mandat → Ziel', () => {
    expect(l.some(x => ['zahlung:z-2', 'rechnung:r-3', 'posten:p-2'].includes(x.id))).toBe(false);
    expect(st('rechnung:r-1')).toMatchObject({ titel: 'Zahlungseingang: Retainer Oktober', zeit: { tag: '2026-10-20' }, pfad: ZIEL });
    expect(st('rechnung:r-2')).toMatchObject({ titel: 'Rechnung stellen: Retainer November', zeit: { tag: '2026-11-01' } });
  });
  it('Steuerfristen wiegen 2,5, abgehakte leise; Finanzen gehören beiden, außer ein Posten nennt „wer“', () => {
    expect(st('frist:s-1')).toMatchObject({ gewicht: 2.5, status: 'offen', person: BEIDE });
    expect(st('frist:s-2')).toMatchObject({ status: 'erledigt' });
    expect(st('frist:s-2').gewicht).toBeLessThan(1);
    expect(st('posten:p-1').person).toBe('malin');
  });
  it('kein Betrag im Titel', () => {
    for (const s of l) expect(s.titel).not.toMatch(/€|\d+,\d\d/);
  });
});
