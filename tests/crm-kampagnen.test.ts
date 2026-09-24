import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { leererBestand } from '../lib/crm/speicher';
import { PLAYBOOKS, kundenprofil, aehnlicheFirmen, zielgruppe, planen, kampagnenZahlen } from '../lib/crm/kampagnen';
import type { Mandat } from '../lib/crm/typen';

const HEUTE = '2026-09-24', J = `${HEUTE}T10:00:00Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const md = (x: Partial<Mandat>): Mandat => ({ id: 'm-1', kunde: 'Kunde GmbH', kontaktIds: ['c-kd'], titel: 'R', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'manuell', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });

const crm = {
  ...leererBestand(),
  firmen: [
    { id: 'f-kd', name: 'Kunde GmbH', branche: 'Maschinenbau Anlagen', stadt: 'Berlin', mitarbeiter: '80', rolle: 'kunde' as const, geaendert: J },
    { id: 'f-ae', name: 'Ähnlich AG', branche: 'Anlagen Maschinenbau', stadt: 'Berlin', mitarbeiter: '120', rolle: 'zielkunde' as const, geaendert: J },
    { id: 'f-an', name: 'Anders KG', branche: 'Gastronomie', stadt: 'Köln', rolle: 'zielkunde' as const, geaendert: J },
  ],
  mandate: [md({})],
};

describe('Kampagnen', () => {
  it('acht Playbooks, jedes mit Begründung, Schritten und Rechtshinweis', () => {
    expect(PLAYBOOKS.length).toBe(8);
    for (const p of PLAYBOOKS) { expect(p.warum.length).toBeGreaterThan(40); expect(p.schritte.length).toBeGreaterThan(1); expect(p.recht).toBeTruthy(); expect(p.fuer.length).toBeGreaterThan(0); }
  });
  it('Kundenprofil aus aktiven Mandaten; ähnliche Firmen nach Branche, Ort, Größe', () => {
    const p = kundenprofil(crm, HEUTE);
    expect(p.firmen.map(f => f.id)).toEqual(['f-kd']);
    expect(p.mrrJeKunde[0]).toMatchObject({ kunde: 'Kunde GmbH', mrr: 3000 });
    const a = aehnlicheFirmen(crm, HEUTE);
    expect(a.map(x => x.firma.id)).toEqual(['f-ae']);
    expect(a[0].gruende.join(' ')).toContain('Berlin');
  });
  it('Zielgruppe und Planung: Lookalike nimmt Personen ähnlicher Firmen, Gesperrte nie', () => {
    const kontakte = [k('ae', { firmaId: 'f-ae' }), k('an', { firmaId: 'f-an' }), k('sp', { firmaId: 'f-ae', werbesperre: { seit: HEUTE, grund: 'x' } })];
    const pb = PLAYBOOKS.find(p => p.id === 'lookalike')!;
    expect(zielgruppe(kontakte, crm, pb, HEUTE).map(x => x.id)).toEqual(['c-ae']);
    const kp = planen(pb, kontakte, crm, HEUTE, 'kp-1');
    expect(kp).toMatchObject({ status: 'entwurf', playbook: 'lookalike', kontaktIds: ['c-ae'], start: HEUTE });
    expect(kp.schritte.length).toBe(pb.schritte.length);
  });
  it('Zahlen: letztes Ergebnis je Person zählt, fällige Schritte ab Start', () => {
    const kp = { ...planen(PLAYBOOKS[0], [], crm, '2026-09-10', 'kp-2'), kontaktIds: ['c-a', 'c-b', 'c-c'], ergebnisse: [
      { kontaktId: 'c-a', ergebnis: 'angesprochen' as const, am: '2026-09-11' }, { kontaktId: 'c-a', ergebnis: 'gespraech' as const, am: '2026-09-15' }, { kontaktId: 'c-b', ergebnis: 'kein_interesse' as const, am: '2026-09-12' },
    ] };
    expect(kampagnenZahlen(kp, HEUTE)).toMatchObject({ personen: 3, angesprochen: 2, gespraeche: 1, keinInteresse: 1, offen: 1, schritteFaellig: 4 });
  });
});

import { werIstDran } from '../lib/crm/heute';
describe('Kampagne ↔ Power Hour', () => {
  it('offene Personen einer aktiven Kampagne erscheinen als „Neu“ mit Bezug', () => {
    const kontakte = [k('x', { telefon: '030', kreis: 'B', letzterKontakt: '2026-09-01' })];
    const crm2 = { ...leererBestand(), kampagnen: [{ ...planen(PLAYBOOKS[1], [], leererBestand(), HEUTE, 'kp-1'), status: 'aktiv' as const, kontaktIds: ['c-x'] }] };
    const a = werIstDran(kontakte, crm2, HEUTE, 'kevin');
    const karte = a.karten.find(c => c.kontakt.id === 'c-x');
    expect(karte?.gruende.some(g => g.includes('Kampagne'))).toBe(true);
  });
});
