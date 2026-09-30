// Querschnitt-Prüfung 28.09. — vier kleine, belegte Lücken:
// 1. Rechnung aus einem Mandat landet bei der Gesellschaft des Mandats (nicht immer kdc); der
//    Finanzplan kennt ein (leeres) UG-Konto.
// 2. Mandatsliste filtert nach Gesellschaft.
// 3. Meilensteine tragen ein echtes `space` (privat/business) — das Altfeld `bereich` wird gelesen und gespiegelt.
// 4. Blöcke der Wochenvorlage tragen optional eine Business-Einheit.

import { describe, expect, it } from 'vitest';
import { firmaFuerGesellschaft } from '@/lib/einheiten';
import { SEED, UG_FIRMA, ugFirmaNachziehen, type FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';
import { vorschau } from '@/lib/make-one/liquiditaet';
import { GESELLSCHAFT_FILTER, passtGesellschaft } from '@/lib/crm/kunden';
import { meilensteinSpace, bereichAusSpace, sauberMeilenstein, sauberMeilensteine } from '@/lib/planung/meilensteine';
import { meilensteineAbleiten } from '@/lib/planung/kaskade';
import { sauberBlock } from '@/lib/planung/routinen';

describe('Rechnung aus dem Mandat → Firma der Gesellschaft', () => {
  it('kdc · kdv · ug bleiben, wie sie sind', () => {
    expect(firmaFuerGesellschaft('kdc')).toBe('kdc');
    expect(firmaFuerGesellschaft('kdv')).toBe('kdv');
    expect(firmaFuerGesellschaft('ug')).toBe('ug');
  });
  it('„offen“, leer und Unbekanntes landen bei der Selbstständigkeit', () => {
    expect(firmaFuerGesellschaft('offen')).toBe('kdc');
    expect(firmaFuerGesellschaft(undefined)).toBe('kdc');
    expect(firmaFuerGesellschaft('irgendwas')).toBe('kdc');
  });
  it('Einheiten-Namen werden erkannt (eine Quelle mit lib/einheiten.ts)', () => {
    expect(firmaFuerGesellschaft('MAKE Innovation GmbH')).toBe('ug');
    expect(firmaFuerGesellschaft('KD Ventures')).toBe('kdv');
  });
});

describe('UG-Konto im Finanzplan', () => {
  it('ein neuer Plan startet mit drei leeren Konten (kdv, kdc, ug)', () => {
    expect(SEED.firmen.map(f => f.id)).toEqual(['kdv', 'kdc', 'ug']);
    const ug = SEED.firmen.find(f => f.id === 'ug')!;
    expect(ug).toEqual({ id: 'ug', name: 'MAKE Innovation GmbH', bank: '', kontostand: null, stand: null });
  });
  const plan = (firmen: FinanzplanFile['firmen'], rechnungen: FinanzplanFile['rechnungen'] = []): FinanzplanFile => ({ ...SEED, firmen, rechnungen });
  const alt = [
    { id: 'kdv', name: 'KD Ventures', bank: 'B1', kontostand: 1234, stand: '2026-09-01' },
    { id: 'kdc', name: 'Kevin Dieckmann Consulting', bank: 'B2', kontostand: -50, stand: '2026-09-02' },
  ];
  const ugRechnung = { id: 'r-ug', firmaId: 'ug', mandatId: 'm1', kunde: 'Beispiel GmbH', titel: 'Mandat', betrag: 1190, status: 'geplant' as const };
  it('erste UG-Rechnung in einem Plan ohne UG-Konto → leeres UG-Konto dazu, vorhandene Werte unverändert', () => {
    const neu = ugFirmaNachziehen(plan(alt, [ugRechnung]));
    expect(neu.firmen.slice(0, 2)).toEqual(alt);
    expect(neu.firmen[2]).toEqual(UG_FIRMA);
    expect(neu.rechnungen).toEqual([ugRechnung]);
  });
  it('ohne UG-Posten bleibt der Plan unangetastet (dasselbe Objekt)', () => {
    const p = plan(alt, [{ ...ugRechnung, firmaId: 'kdc' }]);
    expect(ugFirmaNachziehen(p)).toBe(p);
  });
  it('schon vorhanden → nichts doppelt; leerer Plan bleibt leer (dort greift SEED)', () => {
    const mit = plan([{ id: 'ug', name: 'Meine UG', bank: 'X', kontostand: 99, stand: null }], [ugRechnung]);
    expect(ugFirmaNachziehen(mit)).toBe(mit);
    const leer = plan([], [ugRechnung]);
    expect(ugFirmaNachziehen(leer).firmen).toEqual([]);
  });
  it('das leere UG-Konto zählt 0 € — die Liquidität der anderen Konten bleibt gleich', () => {
    const firmen = [{ id: 'kdc', name: 'K', kontostand: 1000, stand: null }];
    const mitUg = [...firmen, UG_FIRMA];
    const ohne = vorschau(firmen, [], [], [], '2026-09-28', 4);
    const mit = vorschau(mitUg, [], [], [], '2026-09-28', 4);
    expect(mit.start).toBe(ohne.start);
    expect(vorschau(mitUg, [], [], [], '2026-09-28', 4, false, [], 'real', 'ug').start).toBe(0);
  });
  it('eine UG-Rechnung zählt im Filter „ug“, nicht bei kdc', () => {
    const firmen = [{ id: 'kdc', name: 'K', kontostand: 0, stand: null }, UG_FIRMA];
    const r = [{ id: 'r1', kunde: 'A', titel: 'T', betrag: 500, status: 'gestellt', faellig: '2026-09-30', firmaId: 'ug' }];
    const ug = vorschau(firmen, r, [], [], '2026-09-28', 4, false, [], 'real', 'ug');
    const kdc = vorschau(firmen, r, [], [], '2026-09-28', 4, false, [], 'real', 'kdc');
    expect(ug.wochen[0].bewegungen.some(b => b.betrag === 500)).toBe(true);
    expect(kdc.wochen[0].bewegungen.some(b => b.betrag === 500)).toBe(false);
  });
});

describe('Mandate nach Gesellschaft filtern', () => {
  it('Alle · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH in fester Reihenfolge', () => {
    expect(GESELLSCHAFT_FILTER.map(g => g.label)).toEqual(['Alle', 'Selbstständigkeit', 'KD Ventures', 'MAKE Innovation GmbH']);
    expect(GESELLSCHAFT_FILTER.map(g => g.id)).toEqual(['alle', 'kdc', 'kdv', 'ug']);
  });
  it('„Alle“ lässt alles durch, auch „offen“; sonst nur die gewählte Gesellschaft', () => {
    const mandate = [{ g: 'kdc' }, { g: 'kdv' }, { g: 'ug' }, { g: 'offen' }];
    expect(mandate.filter(m => passtGesellschaft('alle', m.g))).toHaveLength(4);
    expect(mandate.filter(m => passtGesellschaft('ug', m.g)).map(m => m.g)).toEqual(['ug']);
    expect(mandate.filter(m => passtGesellschaft('kdc', m.g)).map(m => m.g)).toEqual(['kdc']);
  });
});

describe('Meilensteine: echtes space-Feld', () => {
  it('Altbestand wird gelesen: gesundheit → privat, business → business, ohne Angabe → business', () => {
    expect(meilensteinSpace({ bereich: 'gesundheit' })).toBe('privat');
    expect(meilensteinSpace({ bereich: 'business' })).toBe('business');
    expect(meilensteinSpace({})).toBe('business');
  });
  it('space ist führend, auch wenn das Altfeld widerspricht', () => {
    expect(meilensteinSpace({ space: 'privat', bereich: 'business' })).toBe('privat');
    expect(meilensteinSpace({ space: 'business', bereich: 'gesundheit' })).toBe('business');
    expect(meilensteinSpace({ space: 'quatsch', bereich: 'gesundheit' })).toBe('privat');
  });
  it('die Säuberung setzt beide Felder — bereich gespiegelt für ältere Leser', () => {
    const alt = sauberMeilenstein({ id: 'm1', titel: 'Reha fertig', bereich: 'gesundheit', fortschritt: 40, erledigt: false });
    expect(alt).toMatchObject({ id: 'm1', space: 'privat', bereich: 'gesundheit', fortschritt: 40 });
    const neu = sauberMeilenstein({ id: 'm2', titel: 'Launch', space: 'business', einheit: 'KDV', fortschritt: 0, erledigt: false });
    expect(neu).toMatchObject({ space: 'business', bereich: 'business', einheit: 'KD Ventures' });
    const umgestellt = sauberMeilenstein({ id: 'm3', titel: 'X', space: 'privat', bereich: 'business', einheit: 'KD Ventures', fortschritt: 0, erledigt: false });
    expect(umgestellt).toMatchObject({ space: 'privat', bereich: 'gesundheit' });
    expect(umgestellt).not.toHaveProperty('einheit'); // Privat kennt keine Einheiten
    expect(bereichAusSpace('privat')).toBe('gesundheit');
  });
  it('Einträge ohne Titel fallen weg, alles andere bleibt', () => {
    expect(sauberMeilensteine([{ titel: '' }, { titel: 'a', bereich: 'business' }, null]).map(m => m.titel)).toEqual(['a']);
  });
  it('aus einem Jahresziel abgeleitete Meilensteine tragen space und bereich', () => {
    const [m] = meilensteineAbleiten([{ id: 'z1', titel: 'Hyrox', fortschritt: 0, space: 'privat', termin: '2026-12-01' }], []);
    expect(m).toMatchObject({ space: 'privat', bereich: 'gesundheit', faellig: '2026-12-01' });
    const [b] = meilensteineAbleiten([{ id: 'z2', titel: 'Launch', fortschritt: 0, space: 'business', termin: '2026-11-01', einheit: 'MAKE Innovation GmbH' }], []);
    expect(b).toMatchObject({ space: 'business', bereich: 'business', einheit: 'MAKE Innovation GmbH' });
  });
});

describe('Wochenvorlage: Einheit am Block', () => {
  const basis = { owner: 'kevin', wochentag: 1, von: '09:00', bis: '18:00' };
  it('Business-Block behält die Einheit, in der festen Schreibweise', () => {
    expect(sauberBlock({ ...basis, art: 'business', einheit: 'UG' })).toMatchObject({ art: 'business', einheit: 'MAKE Innovation GmbH' });
    expect(sauberBlock({ ...basis, art: 'business', einheit: 'Kunden' })).toMatchObject({ einheit: 'Kunden' });
  });
  it('ohne Einheit bleibt der Block wie bisher (optional)', () => {
    expect(sauberBlock({ ...basis, art: 'business' })).not.toHaveProperty('einheit');
  });
  it('Privat verwirft die Einheit', () => {
    expect(sauberBlock({ ...basis, art: 'privat', einheit: 'KD Ventures' })).not.toHaveProperty('einheit');
  });
});
