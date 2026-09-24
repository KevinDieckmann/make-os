// Umzug aus Dateien: Sicherung bis zur Naht, V1 danach — erfundene Daten.
import { describe, it, expect } from 'vitest';
import { ausDateien, v1Nacharbeiten, GRENZE_SUPABASE } from '../lib/finanzen/haushalt/datei-umzug';
import { umwandeln } from '../lib/finanzen/haushalt/supabase-umzug';

const konten = [{ id: 'k1', name: 'Privatkonto Kevin', inhaber: 'Kevin', einheit: 'privat' }, { id: 'k3', name: 'Gemeinsames Konto', inhaber: 'gemeinsam', einheit: 'privat' }];
const kategorien = [
  { id: 'c-leb', name: 'Lebensmittel', typ: 'ausgabe' }, { id: 'c-mob', name: 'Mobilität', typ: 'ausgabe' }, { id: 'c-son', name: 'Sonstiges', typ: 'ausgabe' },
  { id: 'c-umb', name: 'Umbuchung', typ: 'umbuchung' }, { id: 'c-off', name: 'Noch einzuordnen', typ: 'einnahme' }, { id: 'c-geh', name: 'Gehalt', typ: 'einnahme' },
];
const regeln = [{ id: 'r1', muster: 'Bäckerei Beispiel', empfaenger: 'Bäckerei Beispiel', kategorie_id: 'c-leb', ganzes_wort: true, prioritaet: 1 }];
const zeile = (i: number, datum: string) => ({ id: `s${i}`, konto_id: 'k1', datum, betrag: -10, beschreibung: 'x', empfaenger: 'Laden Beispiel', kategorie_id: 'c-leb', einheit: 'privat' });

describe('Umzug aus Dateien', () => {
  const gekappt = Array.from({ length: GRENZE_SUPABASE }, (_, i) => zeile(i, i < 990 ? '2026-05-15' : '2026-05-16'));
  const sich = { _typ: 'make-orga-sicherung', konten, kategorien, zuordnungsregeln: regeln, schulden: [], planwerte: [], belege: [], buchungen: gekappt };
  const v1 = { _typ: 'kd-finanz-backup', p: { bank: [
    { id: 'a', dat: '2026-05-15', nm: 'schon drin', bt: 10, kat: 'Lebensmittel', typ: 'var', konto: 'kevin', _n26t: 'out' },
    { id: 'b', dat: '2026-05-16', nm: 'Tag der Naht', bt: 20, kat: 'Fahrten & Verkehr', typ: 'var', konto: 'kevin', _n26t: 'out' },
    { id: 'c', dat: '2026-06-01', nm: 'Bäckerei Beispiel', bt: 5, kat: 'Sonstiges', typ: 'var', konto: 'gemeinsam', _n26t: 'out' },
    { id: 'd', dat: '2026-06-02', nm: 'Unbekannt GmbH', bt: 99, kat: 'Sonstiges', typ: 'ein', konto: 'kevin', _n26t: 'in' },
    { id: 'e', dat: '2026-06-03', nm: 'Übertrag', bt: 300, kat: 'Interner Transfer', typ: 'skip', konto: 'kevin', _n26t: 'out' },
    { id: 'f', dat: '2026-06-04', nm: 'Wer?', bt: 7, kat: 'Lebensmittel', typ: 'var', konto: 'oma', _n26t: 'out' },
  ] } };

  it('gekappte Sicherung: letzter Tag kommt ganz aus V1, davor aus der Sicherung', () => {
    const { roh, bericht } = ausDateien(sich, v1);
    expect(bericht).toMatchObject({ naht: '2026-05-16', gekappt: true, ausSicherung: 990, ausV1: 4 });
    expect(bericht.v1Ohne).toEqual([{ grund: 'Konto „oma“ unbekannt', anzahl: 1 }]);
    const v = roh.buchungen.zeilen.filter(z => String(z.id).startsWith('v1-'));
    expect(v.map(z => [z.datum, z.betrag, z.kategorie_id, z.ist_umbuchung])).toEqual([
      ['2026-05-16', -20, 'c-mob', false], ['2026-06-01', -5, null, false], ['2026-06-02', 99, null, false], ['2026-06-03', -300, 'c-umb', true],
    ]);
  });
  it('danach: Malins Regeln, sonst „Sonstiges“ bzw. „Noch einzuordnen“', () => {
    const { roh } = ausDateien(sich, v1);
    const { haushalt, bericht } = umwandeln(roh);
    expect(bericht.abgewiesen).toEqual([]);
    const n = v1Nacharbeiten(haushalt);
    expect(n).toMatchObject({ regelTreffer: 1, offenEin: 1, sonstiges: 0 });
    const kat = (id: string) => n.haushalt.buchungen.find(b => b.id === id)?.kategorie_id;
    expect([kat('v1-c'), kat('v1-d')]).toEqual(['c-leb', 'c-off']);
  });
  it('ohne V1 bleibt alles aus der Sicherung — mit ehrlichem Hinweis', () => {
    const { bericht } = ausDateien(sich, null);
    expect(bericht.ausSicherung).toBe(1000);
    expect(bericht.hinweise[0]).toMatch(/fehlt alles danach/);
  });
  it('falsche Datei wird abgewiesen', () => {
    expect(() => ausDateien({ ...sich, _typ: 'etwas-anderes' }, v1)).toThrow(/keine Sicherung/);
  });
});
