// Rundgang 19.10. B3 (21.10., Kevin: „höchstens N gleichzeitig“ — warnen, aber erlauben): vor dem Anlegen eines Mandats fragt die Oberfläche
// „Alle N Plätze belegt — trotzdem anlegen?“, ein Klick legt trotzdem an; der Server lehnt nie ab, er gibt einen Hinweis. EINE Regel
// (lib/crm/produkt-karte.ts `plaetzeVonProdukt`). Erfundene Produkte und Firmen.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { plaetzeVonProdukt, platzFrage, platzHinweis } from '../lib/crm/produkt-karte';
import type { Leistung, Mandat } from '../lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-platzgrenze-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const J = '2026-10-19T08:00:00.000Z';
const BEGLEITUNG = { id: 'l-begl', name: 'Begleitung', typ: 'retainer', stufe: 'kern', preis: { betrag: 2900, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, regeln: { maxGleichzeitig: 2 } } as unknown as Leistung;
const OHNE = { ...BEGLEITUNG, id: 'l-ohne', regeln: undefined } as unknown as Leistung;
const m = (id: string, x: Partial<Mandat> = {}) => ({ id, leistungId: 'l-begl', status: 'aktiv', ...x }) as Mandat;

describe('B3 · Platzgrenze', () => {
  it('belegt = aktive Mandate des Produkts außerhalb des Papierkorbs; voll ab N', () => {
    expect(plaetzeVonProdukt(BEGLEITUNG, [m('m-1')])).toEqual({ max: 2, belegt: 1, voll: false });
    const zwei = [m('m-1'), m('m-2'), m('m-3', { status: 'beendet' }), m('m-4', { geloeschtAm: J }), m('m-5', { leistungId: 'l-anders' })];
    expect(plaetzeVonProdukt(BEGLEITUNG, zwei)).toEqual({ max: 2, belegt: 2, voll: true });
    expect(platzFrage(plaetzeVonProdukt(BEGLEITUNG, zwei)!, 'Begleitung')).toBe('Alle 2 Plätze von „Begleitung“ belegt (2/2) — trotzdem anlegen?');
    expect(platzHinweis(plaetzeVonProdukt(BEGLEITUNG, zwei)!, 'Begleitung')).toBe('Über der Platzgrenze angelegt: „Begleitung“ hat jetzt 3 laufende Mandate, vorgesehen sind höchstens 2 gleichzeitig.');
  });
  it('ohne Grenze keine Lage; die Grenze der Treppen-Stufe gilt, wenn die Karte keine trägt (Karte gewinnt)', () => {
    expect(plaetzeVonProdukt(OHNE, [m('m-1', { leistungId: 'l-ohne' })])).toBeNull();
    expect(plaetzeVonProdukt(OHNE, [m('m-1', { leistungId: 'l-ohne' })], 1)).toEqual({ max: 1, belegt: 1, voll: true });
    expect(plaetzeVonProdukt(BEGLEITUNG, [], 9)?.max).toBe(2);
  });
  it('Server: angelegt wird trotzdem — die Antwort trägt den Hinweis (nur, wenn voll)', async () => {
    const { platzHinweisFuer } = await import('../lib/crm/mandat-anlegen-server');
    expect(await platzHinweisFuer('l-begl', { leistungen: [BEGLEITUNG], mandate: [m('m-1'), m('m-2')] })).toBe('Über der Platzgrenze angelegt: „Begleitung“ hat jetzt 3 laufende Mandate, vorgesehen sind höchstens 2 gleichzeitig.');
    expect(await platzHinweisFuer('l-begl', { leistungen: [BEGLEITUNG], mandate: [m('m-1')] })).toBeNull();
    expect(await platzHinweisFuer(undefined, { leistungen: [BEGLEITUNG], mandate: [] })).toBeNull();
  });
});
