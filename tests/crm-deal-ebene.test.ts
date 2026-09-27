// Deal-Ebene (27.09.): Firma per Kennung, Stufenwechsel nur mit Regel auf dem Server,
// neue Adressen mit Übersetzung der alten. Nur erfundene Daten.
import { describe, it, expect } from 'vitest';
import { firmaIdsErgaenzen, firmaVonDeal, dealZuFirma, mandatZuFirma, firmenName } from '../lib/crm/firmen-bezug';
import { dealRegeln, wendeCrmAn, leererBestand, saeubern } from '../lib/crm/speicher';
import { aufloesen, markttraktion, dealAkte } from '../lib/crm/adresse';
import type { Chance, Firma, Mandat } from '../lib/crm/typen';

const JETZT = '2026-09-27T09:00:00.000Z';
const firma = (id: string, name: string): Firma => ({ id, name, rolle: 'zielkunde', geaendert: JETZT });
const deal = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Acme · Retainer', kontaktIds: ['c-a-1'], firma: 'Acme GmbH', art: 'retainer', wert: { betrag: 3000, basis: 'monat' },
  stufe: 'qualifiziert', historie: [{ stufe: 'qualifiziert', am: JETZT, von: 'kevin' }], naechsterSchritt: { text: 'Bedarfsgespräch', datum: '2026-10-02' },
  qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: JETZT, geaendert: JETZT, ...x,
});

describe('Firma per Kennung', () => {
  const firmen = [firma('f-acme', 'Acme GmbH'), firma('f-beta', 'Beta AG'), firma('f-beta2', 'beta ag')];
  it('trägt die Kennung nach, wenn der Name eindeutig ist — und lässt Mehrdeutiges leer', () => {
    const b = { firmen, chancen: [deal(), deal({ id: 'ch-2', firma: 'Beta AG' }), deal({ id: 'ch-3', firma: 'Unbekannt' })], mandate: [{ id: 'm-1', kunde: 'acme gmbh' } as Mandat] };
    const r = firmaIdsErgaenzen(b);
    expect(r.ergaenzt).toBe(2);
    expect(r.bestand.chancen[0].firmaId).toBe('f-acme');
    expect(r.bestand.chancen[1].firmaId).toBeUndefined(); // zwei Firmen heißen „Beta AG“ — nicht raten
    expect(r.bestand.chancen[2].firmaId).toBeUndefined();
    expect(r.bestand.mandate[0].firmaId).toBe('f-acme');
    // Nichts zu tun → derselbe Bestand (kein unnötiges Schreiben)
    expect(firmaIdsErgaenzen(r.bestand).bestand).toBe(r.bestand);
  });
  it('die Kennung gewinnt vor dem Namen — nach Umbenennung stimmt der Anzeigename wieder', () => {
    const c = deal({ firmaId: 'f-acme', firma: 'Alter Name' });
    expect(firmaVonDeal(c, firmen)?.id).toBe('f-acme');
    expect(firmenName(c, firmen)).toBe('Acme GmbH');
    expect(dealZuFirma(c, firmen[0])).toBe(true);
    expect(dealZuFirma(c, firmen[1])).toBe(false);
    expect(dealZuFirma(deal({ firma: 'Acme GmbH' }), firmen[0])).toBe(true); // Rückfall alter Einträge
    expect(mandatZuFirma({ kunde: 'Beta AG' }, firmen[1])).toBe(true);
  });
  it('der Säuberer nimmt firmaId und Personen-Rollen an, aber nur saubere', () => {
    const e = saeubern('chancen', { ...deal(), firmaId: 'f-acme', personenRollen: { 'c-a-1': 'entscheider', 'c-b-2': 'chef', 'x y': 'nutzer' } }, JETZT, 'kevin') as unknown as Chance;
    expect(e.firmaId).toBe('f-acme');
    expect(e.personenRollen).toEqual({ 'c-a-1': 'entscheider' });
    expect((saeubern('chancen', { ...deal(), firmaId: 'nix' }, JETZT, 'kevin') as unknown as Chance).firmaId).toBeUndefined();
  });
});

describe('Stufenwechsel nur mit Regel (Server)', () => {
  const b = { ...leererBestand(), chancen: [deal()] };
  it('verloren ohne Grund und geparkt ohne Wiedervorlage werden abgelehnt', () => {
    const r = dealRegeln(b, [{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'verloren' } }, { liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'geparkt' } }], JETZT, 'malin');
    expect(r.ops).toEqual([]);
    expect(r.fehler).toHaveLength(2);
    expect(r.fehler[0]).toContain('Grund');
  });
  it('eine offene Zielstufe braucht einen nächsten Schritt mit Datum in der Zukunft', () => {
    const ohne = { ...b, chancen: [deal({ naechsterSchritt: undefined })] };
    const r = dealRegeln(ohne, [{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'bedarf' } }], JETZT, 'kevin');
    expect(r.ops).toEqual([]);
    expect(r.fehler[0]).toContain('nächsten Schritt');
    const mit = dealRegeln(ohne, [{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'bedarf', naechsterSchritt: { text: 'Diagnose-Termin', datum: '2026-10-05' } } }], JETZT, 'kevin');
    expect(mit.fehler).toEqual([]);
    expect(mit.ops[0].felder?.stufe).toBe('bedarf');
  });
  it('die Historie hängt der Server an — was der Browser schickt, zählt nicht', () => {
    const r = wendeCrmAn(b, [{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'bedarf', historie: [{ stufe: 'gewonnen', am: '2020-01-01', von: 'x' }] } }], JETZT, 'malin');
    const c = r.bestand.chancen[0];
    expect(r.fehler).toEqual([]);
    expect(c.stufe).toBe('bedarf');
    expect(c.historie.map(h => h.stufe)).toEqual(['qualifiziert', 'bedarf']);
    expect(c.historie[1].von).toBe('malin');
    // Ohne Stufenwechsel bleibt die Historie ebenfalls unangetastet.
    const r2 = wendeCrmAn(r.bestand, [{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { titel: 'Neu', historie: [] } }], JETZT, 'kevin');
    expect(r2.bestand.chancen[0].historie).toHaveLength(2);
    expect(r2.bestand.chancen[0].titel).toBe('Neu');
  });
  it('verloren mit Grund geht durch und trägt den Grund', () => {
    const r = wendeCrmAn(b, [{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'verloren', grund: 'Preis' } }], JETZT, 'kevin');
    expect(r.fehler).toEqual([]);
    expect(r.bestand.chancen[0]).toMatchObject({ stufe: 'verloren', grund: 'Preis' });
  });
});

describe('Adressen: neue Reiter, alte Links laufen weiter', () => {
  it('der alte Sales-Reiter wird übersetzt', () => {
    expect(aufloesen('sales', 'pipeline')).toEqual({ s: 'deals' });
    // 27.09. abends: „Sales“ ist wieder ein Reiter (rechts) — Heute/Power Hour lebt dort, ohne Ansicht öffnet der Head of Sales.
    expect(aufloesen('sales', 'heute')).toEqual({ s: 'sales', a: 'powerhour' });
    expect(aufloesen('sales')).toEqual({ s: 'sales' });
    expect(aufloesen('sales', 'leads')).toEqual({ s: 'firmen', a: 'leads' });
    expect(aufloesen('sales', 'kunden')).toEqual({ s: 'deals', a: 'kunden' });
    expect(aufloesen('sales', 'kampagnen')).toEqual({ s: 'sales', a: 'kampagnen' });
    expect(aufloesen('pipeline')).toEqual({ s: 'deals' });
    expect(aufloesen('heute')).toEqual({ s: 'sales', a: 'powerhour' });
  });
  it('Standard-Ansichten stehen nicht in der Adresse', () => {
    expect(markttraktion('deals', 'board')).toBe('/os/markttraktion?s=deals');
    expect(markttraktion('followup', 'faellig')).toBe('/os/markttraktion?s=followup');
    expect(markttraktion('sales', 'pipeline', 'ch-1')).toBe('/os/markttraktion?s=deals&k=ch-1');
    expect(dealAkte('ch-1')).toBe('/os/markttraktion?s=deals&a=akte&k=ch-1');
    expect(aufloesen('deals', 'quatsch')).toEqual({ s: 'deals' });
    expect(aufloesen('followup', 'woche')).toEqual({ s: 'followup', a: 'woche' });
  });
});
