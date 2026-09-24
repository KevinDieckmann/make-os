// Familie & Partnerschaft: Rhythmus des Paares, nie einer Person; Privates bleibt privat.
import { describe, it, expect } from 'vitest';
import { startBestand, wendeFamilieAn, setzeFelder } from '../lib/familie/speicher';
import { pflegeRhythmus, wichtigeTage, kontaktFaellig, naechstesGespraech, sichtFuer } from '../lib/familie/logik';

const HEUTE = '2026-09-24', J = '2026-09-24T10:00:00Z';
const basis = () => startBestand(J);

describe('Pflege-Rhythmus', () => {
  it('leer → keine Zahl, sondern der erste Schritt', () => {
    expect(pflegeRhythmus(basis(), HEUTE)).toMatchObject({ score: null, stufe: 'leer' });
  });
  it('vier Gespräche, vier Dates mit Neuem, tägliche Rituale → im Takt', () => {
    const f = basis();
    for (let i = 0; i < 4; i++) {
      const d = `2026-09-${String(3 + i * 7).padStart(2, '0')}`;
      f.gespraeche.push({ id: `g${i}`, von: 'kevin', am: J, datum: d, status: 'gehalten', wertschaetzungen: [], lief_gut: [], orga: [], themenIds: [], wuensche: [], schoeneZeit: '', businessGrenzeGehalten: true, notiz: '' });
      f.dates.push({ id: `d${i}`, von: 'malin', am: J, titel: 'Date', ideeId: null, datum: d, planer: 'malin', status: 'stattgefunden', neuesErlebnis: i === 0, nachklang: [] });
    }
    for (let t = 0; t < 28; t++) f.ritualtage.push({ datum: `2026-${t < 3 ? '08' : '09'}-${String(t < 3 ? 28 + t : t - 2).padStart(2, '0')}`, erledigt: ['rit-gutenacht'] });
    for (let t = 1; t <= 14; t++) f.wertschaetzungen.push({ id: `w${t}`, von: t % 2 ? 'kevin' : 'malin', am: J, an: 'x', text: 'danke', datum: `2026-09-${String(t + 5).padStart(2, '0')}` });
    const r = pflegeRhythmus(f, HEUTE);
    expect(r.stufe).toBe('im-takt');
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
  it('Ausnahmezeit pausiert statt zu strafen', () => {
    const f = basis(); f.einstellungen = { ...f.einstellungen, ausnahmeBis: '2026-10-01' };
    expect(pflegeRhythmus(f, HEUTE)).toMatchObject({ score: null, stufe: 'pause' });
  });
});

describe('Privates bleibt privat', () => {
  it('„nur-ich“ sieht nur, wer es schrieb — und der andere kann es nicht ändern', () => {
    let f = basis();
    f = wendeFamilieAn(f, [{ liste: 'wuensche', op: 'upsert', eintrag: { id: 'u1', text: 'Überraschung', kategorie: 'geschenk', status: 'offen', sichtbarkeit: 'nur-ich' } }], 'kevin', J).familie;
    expect(sichtFuer(f.wuensche, 'malin')).toEqual([]);
    expect(sichtFuer(f.wuensche, 'kevin')).toHaveLength(1);
    const r = wendeFamilieAn(f, [{ liste: 'wuensche', op: 'delete', id: 'u1' }], 'malin', J);
    expect(r.abgelehnt).toBe(1);
    expect(r.familie.wuensche).toHaveLength(1);
  });
  it('Reparatur: die ungeteilte Reflexion des anderen überlebt eine eigene Änderung', () => {
    const r = { id: 'r1', datum: HEUTE, pauseBis: null, abgeschlossen: null, vereinbarung: '' };
    let f = wendeFamilieAn(basis(), [{ liste: 'reparaturen', op: 'upsert', eintrag: { ...r, reflexionen: [{ person: 'malin', gefuehle: 'müde', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: false }] } }], 'malin', J).familie;
    // Kevin sieht Malins Reflexion nicht und schickt nur seine eigene (und versucht, ihre zu überschreiben).
    f = wendeFamilieAn(f, [{ liste: 'reparaturen', op: 'upsert', eintrag: { ...r, reflexionen: [{ person: 'kevin', gefuehle: 'ärger', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: true }, { person: 'malin', gefuehle: 'X', meineSicht: '', meinAnteil: '', wunsch: '', geteilt: true }] } }], 'kevin', J).familie;
    const refl = f.reparaturen[0].reflexionen;
    expect(refl.find(x => x.person === 'malin')).toMatchObject({ gefuehle: 'müde', geteilt: false });
    expect(refl.find(x => x.person === 'kevin')).toMatchObject({ gefuehle: 'ärger' });
  });
  it('Profil pflegt jeder nur für sich', () => {
    const f = setzeFelder(basis(), { profil: { stress: 'Umzug', person: 'malin' } }, 'kevin', J);
    expect(f.profile).toEqual([expect.objectContaining({ person: 'kevin', stress: 'Umzug' })]);
  });
  it('Rituale werden gemeinsam abgehakt, ohne Zähler je Person', () => {
    const f = setzeFelder(basis(), { ritual: { datum: HEUTE, id: 'rit-gutenacht', an: true } }, 'malin', J);
    expect(f.ritualtage).toEqual([{ datum: HEUTE, erledigt: ['rit-gutenacht'] }]);
  });
});

describe('Familie organisieren', () => {
  it('wichtige Tage: nächstes Vorkommen, Vorlauf, erledigt je Jahr', () => {
    const t = wichtigeTage([{ id: 't1', von: 'k', am: J, titel: 'Hochzeitstag', art: 'jahrestag', datum: '10-03', vorlaufTage: 14, wer: 'kevin', aktion: 'feier', erledigt: [] }], HEUTE);
    expect(t[0]).toMatchObject({ am: '2026-10-03', faelligAb: '2026-09-19', inTagen: 9, erledigt: false });
  });
  it('Kontakt-Rhythmus: wer ist dran', () => {
    const m = kontaktFaellig([
      { id: 'm1', von: 'k', am: J, name: 'Mama', rolle: 'eltern', geburtstag: null, kontaktAlleTage: 7, letzterKontakt: '2026-09-10', notiz: '' },
      { id: 'm2', von: 'k', am: J, name: 'Papa', rolle: 'eltern', geburtstag: null, kontaktAlleTage: 7, letzterKontakt: '2026-09-22', notiz: '' },
    ], HEUTE);
    expect(m.map(x => x.name)).toEqual(['Mama']);
  });
  it('nächstes Paar-Gespräch nach Wochentag', () => {
    expect(naechstesGespraech(basis().einstellungen, HEUTE, []).datum).toBe('2026-09-27'); // Sonntag
  });
});
