// Gesamtprüfung 17.10. (L1 A2): ein beendetes Mandat bekommt sein Ende (Server-Stempel), und der Liquiplan-Posten läuft nicht still weiter.
// Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { dealRegeln, wendeCrmAn, leererBestand } from '../lib/crm/speicher';
import { postenEnde, planpostenAus } from '../lib/crm/kunden';
import { mandatsEnde } from '../lib/fulfillment/regeln';
import type { Mandat } from '../lib/crm/typen';

const JETZT = '2026-10-17T19:30:00.000Z';
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispiel GmbH', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-05-01', verlaengerung: 'auto', honorar: { betrag: 4500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: JETZT, ...x,
} as unknown as Mandat);

describe('Mandat beenden', () => {
  it('stempelt das Ende am Tag des Wechsels, wenn keines gesetzt ist', () => {
    const b = { ...leererBestand(), mandate: [mandat()] };
    const r = dealRegeln(b, [{ liste: 'mandate', op: 'teil', id: 'm-1', felder: { status: 'beendet' } }], JETZT, 'pia');
    expect((r.ops[0] as { felder: Record<string, unknown> }).felder).toEqual({ status: 'beendet', ende: '2026-10-17' });
    const a = wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: 'm-1', felder: { status: 'beendet' } }], JETZT, 'pia');
    expect(a.bestand.mandate[0].ende).toBe('2026-10-17');
    expect(mandatsEnde(a.bestand.mandate[0])).toBe('2026-10-17');
  });

  it('ein mitgeschicktes oder schon gesetztes Ende gewinnt; ohne Wechsel nichts', () => {
    const b = { ...leererBestand(), mandate: [mandat(), mandat({ id: 'm-2', ende: '2026-12-31' }), mandat({ id: 'm-3', status: 'beendet' })] };
    const r = dealRegeln(b, [
      { liste: 'mandate', op: 'teil', id: 'm-1', felder: { status: 'beendet', ende: '2026-11-30' } },
      { liste: 'mandate', op: 'teil', id: 'm-2', felder: { status: 'beendet' } },
      { liste: 'mandate', op: 'teil', id: 'm-3', felder: { status: 'beendet', notiz: 'x' } },
    ], JETZT, 'pia');
    expect(r.ops.map(o => (o as { felder: Record<string, unknown> }).felder.ende)).toEqual(['2026-11-30', undefined, undefined]);
  });

  it('der Posten eines beendeten Mandats endet mit dem Zahlungsziel nach dem Ende; laufende Mandate kein Ende', () => {
    expect(postenEnde(mandat({ status: 'beendet', ende: '2026-10-17' }), '2026-10-20')).toBe('2026-10-31');
    expect(postenEnde(mandat({ status: 'beendet' }), '2026-10-20')).toBe('2026-11-03');
    expect(postenEnde(mandat(), '2026-10-20')).toBeNull();
    // ein beendetes Mandat schlägt keinen neuen Posten vor
    expect(planpostenAus(mandat({ status: 'beendet', ende: '2026-10-17' }), '2026-10-20')).toBeNull();
  });
});

describe('Liquiditäts-Posten beim Start (17.10., Gesamtprüfung L1 B8)', () => {
  it('erste Zahlung ab dem Beginn im laufenden Monat; ohne Verlängerung endet der Posten mit der Mindestlaufzeit', () => {
    const p = planpostenAus(mandat({ start: '2026-10-17', verlaengerung: 'manuell', mindestlaufzeitMonate: 6 }), '2026-10-17')!;
    expect(p.ab).toBe('2026-10-31');
    expect(p.bis).toBe('2027-04-30');
    expect(planpostenAus(mandat({ start: '2026-10-17' }), '2026-10-17')!.bis).toBeUndefined(); // auto: läuft weiter
    expect(planpostenAus(mandat({ start: '2026-05-01' }), '2026-10-17')!.ab).toBe('2026-10-15'); // laufendes Mandat: ab Monatsanfang
  });
});
