// ─── Kreislauf Runde 3 (02.11.): „Mandat beenden“ mit Ende in der Zukunft + Pausen ─────────────────────────────────────────────────────────────
// Fund 1: „Mandat beenden“ setzt den Status sofort auf „beendet“ — der Morgenlauf hörte damit sofort auf, obwohl der Dialog verspricht: Monatsrechnungen bis
//         zum Ende, der letzte Monat anteilig. Jetzt: beendet = bis einschließlich des Monats des Endes; Raten laufen weiter (wie der Liquiplan); nie danach.
// Fund 2: nach einer Pause legte der Morgenlauf die pausierten Monate nach. Jetzt hält der Server die Pausen fest (`pausen`), pausierte Tage zählen nicht;
//         Altbestand (pausiert ohne festgehaltene Pause): der Lauf merkt die Monate der Pause als übersprungen (`p:`).
// Eigener Datenordner, alles erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { ordner } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-kreislauf-r3-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-kreislauf-runde3', MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-nur-fuer-den-kreislauf-runde3-test' });
  return { ordner };
});
vi.mock('@/lib/zeitmessung/mandate-server', () => ({ zeitJeMandatFuer: async () => ({ gesamt: { zeilen: [] } }), stundenText: () => '' }));

import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import type { FinanzplanFile } from '@/lib/finanzen/finanzplan-bestand';
import type { Kontakt } from '@/lib/make-one/crm';
import { pauseUeberspringen, vorbereitenFaellig } from '@/lib/finanzen/rechnung/kreislauf-regeln';
import { anteilText, ausserhalbLaufzeit } from '@/lib/finanzen/rechnung/regeln';
import { leistungsmonat, mandatLaeuftIm, monatsHonorar } from '@/lib/crm/mandat-laufzeit';
import { beendenHinweise, mandatPosten } from '@/lib/crm/kunden';
import { pausenSaeubern, pausenStempeln, pausiertAm, PAUSEN_MAX } from '@/lib/crm/mandat-pausen';

const J = '2026-10-01T10:00:00.000Z';
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-10-01', verlaengerung: 'offen', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
const monate = (m: Mandat, heute: string, abgerechnet: string[], ab = '2026-10') => vorbereitenFaellig(m, heute, new Set(abgerechnet), ab).map(f => f.monat);

describe('Fund 1 · beendet mit Ende in der Zukunft (rein)', () => {
  const m = mandat('m-b', { status: 'beendet', ende: '2027-01-15' });
  it('der Dialog verspricht es — und der Morgenlauf hält es: Dezember, dann Januar anteilig, danach nichts', () => {
    expect(beendenHinweise(m, '2027-01-15', '2026-11-02').hinweise.join(' ')).toMatch(/Monatsrechnungen gehen bis dahin/);
    expect(monate(m, '2026-12-01', ['2026-10', '2026-11'])).toEqual(['2026-12']);
    expect(monate(m, '2027-01-02', ['2026-10', '2026-11', '2026-12'])).toEqual(['2027-01']);
    expect(monate(m, '2027-02-01', ['2026-10', '2026-11', '2026-12', '2027-01'])).toEqual([]);
    expect(monate(m, '2027-06-01', ['2026-10', '2026-11', '2026-12'])).toEqual(['2027-01']);
    const jan = leistungsmonat(m, '2027-01')!;
    expect(jan).toMatchObject({ tage: 15, monatsTage: 31, anteilig: true, bis: '2027-01-15' });
    expect(monatsHonorar(m, jan)).toBe(Math.round((3000 * 15 / 31) * 100) / 100);
  });
  it('EINE Regel mit dem Liquiplan: der letzte Monat ist auch dort der Januar (anteilig), danach kein Posten', () => {
    const posten = mandatPosten(m, '2026-12-01', { beendet: true });
    const letzter = posten.map(p => p.leistungsmonat!).sort().pop();
    expect(letzter).toBe('2027-01');
    expect(posten.find(p => p.leistungsmonat === '2027-01')!.titel).toContain('anteilig');
  });
  it('beendet ohne Ende = sofort beendet: keine neuen Monate; pausiert nie', () => {
    expect(monate(mandat('m-x', { status: 'beendet' }), '2026-12-01', ['2026-10', '2026-11'])).toEqual([]);
    expect(monate(mandat('m-p', { status: 'pausiert' }), '2026-12-01', ['2026-10', '2026-11'])).toEqual([]);
    expect(monate(mandat('m-e', { status: 'beendet', ende: '2026-11-20' }), '2026-12-01', ['2026-10'])).toEqual(['2026-11']);
  });
  it('Tagessatz: November am 01.12. nach dem Beenden zum 30.11. — Dezember nie', () => {
    const t = mandat('m-t', { status: 'beendet', start: '2026-11-01', ende: '2026-11-30', honorar: { betrag: 1200, basis: 'tag', netto: true } });
    expect(vorbereitenFaellig(t, '2026-12-01', new Set(), '2026-11')).toEqual([{ monat: '2026-11', art: 'tag' }]);
    expect(vorbereitenFaellig(t, '2027-01-04', new Set(['2026-11']), '2026-11')).toEqual([]);
  });
  it('Raten: Rate 3 von 6 kommt auch nach dem Beenden — wie im Liquiplan', () => {
    const r = mandat('m-r', { status: 'beendet', honorar: { betrag: 6000, basis: 'einmalig', netto: true }, ende: '2026-11-30', raten: { anzahl: 6, abstandMonate: 1 }, rechnungsrhythmus: 'einmalig' });
    expect(vorbereitenFaellig(r, '2026-12-01', new Set(['2026-10', '2026-11']), '2026-10')).toEqual([{ monat: '2026-12', art: 'rate' }]);
    expect(mandatPosten(r, '2026-12-01').length).toBeGreaterThan(0);
  });
  it('Quartal und einmalig enden mit dem Ende', () => {
    const q = mandat('m-q', { status: 'beendet', rechnungsrhythmus: 'quartal', start: '2026-11-01', ende: '2027-03-10' });
    expect(vorbereitenFaellig(q, '2027-02-03', new Set(['2026-11', '2026-12', '2027-01']), '2026-11')).toEqual([{ monat: '2027-02', art: 'quartal' }]);
    expect(vorbereitenFaellig(q, '2027-05-03', new Set(['2026-11', '2026-12', '2027-01', '2027-02']), '2026-11')).toEqual([]);
    const e = mandat('m-ei', { status: 'beendet', honorar: { betrag: 2000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig', start: '2026-11-10', ende: '2026-12-20' });
    expect(vorbereitenFaellig(e, '2026-11-12', new Set(), '2026-11')).toEqual([{ monat: '2026-11', art: 'einmalig' }]);
  });
});

describe('Fund 2 · Pausen (rein)', () => {
  it('Pause Dezember–Januar: nach der Pause nur Februar', () => {
    const m = mandat('m-pa', { start: '2026-11-01', pausen: [{ von: '2026-12-01', bis: '2027-01-31' }] });
    expect(monate(m, '2027-02-01', ['2026-11'], '2026-11')).toEqual(['2027-02']);
    expect(mandatLaeuftIm(m, '2026-12')).toBe(false);
    expect(ausserhalbLaufzeit(m, '2027-01')).toBe('Das Mandat war in Januar 2027 pausiert — keine Monatsrechnung.');
  });
  it('angebrochene Monate anteilig — Zeitraum ohne die pausierten Tage', () => {
    const m = mandat('m-pt', { start: '2026-11-01', pausen: [{ von: '2026-12-10', bis: '2027-01-19' }] });
    expect(monate(m, '2027-02-01', ['2026-11'], '2026-11')).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(leistungsmonat(m, '2026-12')).toMatchObject({ von: '2026-12-01', bis: '2026-12-09', tage: 9, anteilig: true });
    const jan = leistungsmonat(m, '2027-01')!;
    expect(jan).toMatchObject({ von: '2027-01-20', bis: '2027-01-31', tage: 12, anteilig: true });
    expect(anteilText(jan)).toBe('anteilig ab 20.01., 12 von 31 Tagen');
    const mitte = leistungsmonat(mandat('m-pm', { pausen: [{ von: '2026-11-10', bis: '2026-11-19' }] }), '2026-11')!;
    expect(mitte).toMatchObject({ von: '2026-11-01', bis: '2026-11-30', tage: 20 });
    expect(anteilText(mitte)).toBe('anteilig 01.11.–30.11. ohne Pause, 20 von 30 Tagen');
    // Eine laufende Pause gilt ab ihrem Beginn.
    expect(mandatLaeuftIm(mandat('m-po', { pausen: [{ von: '2026-12-01' }] }), '2027-03')).toBe(false);
  });
  it('bit-gleich ohne Pause und ohne Ende', () => {
    const ohne = mandat('m-o', { start: '2026-10-17' });
    const leer = { ...ohne, pausen: [] };
    const anders = { ...ohne, pausen: [{ von: '2025-01-01', bis: '2025-02-01' }] };
    for (const mo of ['2026-10', '2026-11', '2027-03']) {
      expect(leistungsmonat(leer, mo)).toEqual(leistungsmonat(ohne, mo));
      expect(leistungsmonat(anders, mo)).toEqual(leistungsmonat(ohne, mo));
    }
    expect(monate(leer, '2027-01-02', [])).toEqual(monate(ohne, '2027-01-02', []));
    expect(monate(ohne, '2027-01-02', [])).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
  });
  it('Stempeln: aktiv → pausiert → aktiv, am selben Tag zurück, → beendet, Altbestand, Grenze', () => {
    expect(pausenStempeln({ status: 'aktiv' }, 'pausiert', '2026-12-01').pausen).toEqual([{ von: '2026-12-01' }]);
    expect(pausenStempeln({ status: 'pausiert', pausen: [{ von: '2026-12-01' }] }, 'aktiv', '2027-02-01').pausen).toEqual([{ von: '2026-12-01', bis: '2027-01-31' }]);
    expect(pausenStempeln({ status: 'pausiert', pausen: [{ von: '2026-12-01' }] }, 'aktiv', '2026-12-01').pausen).toBeUndefined();
    expect(pausenStempeln({ status: 'pausiert', pausen: [{ von: '2026-12-01' }] }, 'beendet', '2027-01-10').pausen).toEqual([{ von: '2026-12-01' }]);
    expect(pausenStempeln({ status: 'pausiert', pausen: [{ von: '2026-12-01' }] }, 'pausiert', '2027-01-10').pausen).toEqual([{ von: '2026-12-01' }]);
    expect(pausenStempeln({ status: 'pausiert' }, 'aktiv', '2027-01-10').pausen).toBeUndefined();
    expect(pausenStempeln(undefined, 'pausiert', '2027-01-10').pausen).toEqual([{ von: '2027-01-10' }]);
    const voll = Array.from({ length: PAUSEN_MAX }, (_, i) => ({ von: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`, bis: `2020-01-${String((i % 28) + 1).padStart(2, '0')}` }));
    expect(pausenStempeln({ status: 'aktiv', pausen: voll }, 'pausiert', '2027-01-10').grenze).toContain(String(PAUSEN_MAX));
    expect(pausenSaeubern([{ von: 'kaputt' }, { von: '2026-12-05', bis: '2026-12-01' }, { von: '2026-11-01' }, { von: '2026-12-10' }])).toEqual([{ von: '2026-11-01', bis: '2026-12-09' }, { von: '2026-12-10' }]);
    expect(pausiertAm([{ von: '2026-12-01', bis: '2026-12-31' }], '2026-12-31')).toBe(true);
  });
  it('Altbestand: pausiert ohne festgehaltene Pause → Monat bzw. Quartal als übersprungen; nie bei Raten oder mit festgehaltener Pause', () => {
    expect(pauseUeberspringen(mandat('m-a', { status: 'pausiert' }), '2026-12-03')).toEqual(['2026-12']);
    expect(pauseUeberspringen(mandat('m-a', { status: 'pausiert', pausen: [{ von: '2026-12-01' }] }), '2026-12-03')).toEqual([]);
    expect(pauseUeberspringen(mandat('m-a', { status: 'pausiert', rechnungsrhythmus: 'quartal', start: '2026-11-01' }), '2027-01-03')).toEqual(['2026-11']);
    expect(pauseUeberspringen(mandat('m-a', { status: 'pausiert', honorar: { betrag: 6000, basis: 'einmalig', netto: true }, raten: { anzahl: 6, abstandMonate: 1 }, rechnungsrhythmus: 'einmalig' }), '2026-12-03')).toEqual([]);
    expect(pauseUeberspringen(mandat('m-a'), '2026-12-03')).toEqual([]);
  });
});

// ── Server (eigener Datenordner) ─────────────────────────────────────────────────────────────────────────────────────────────

let db: typeof import('@/lib/store/local-db');
const plan = async () => (await db.loadJson<FinanzplanFile>('finanzplan'))!;
const entwuerfe = async (mandatId: string) => (await plan()).rechnungen.filter(r => r.mandatId === mandatId && !r.angebotId);
const lauf = async (tag: string) => (await import('@/lib/finanzen/rechnung/kreislauf')).rechnungenVorbereiten('kg-haus', tag, new Date(`${tag}T10:00:00Z`));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'kg-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pa')], einladungen: [] });
  const k: Kontakt = { id: 'c-anna1', vorname: 'Anna', nachname: 'Test', email: 'c-anna1@example.invalid', eignung: '', prio: '', stufe: 'gewonnen', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH' };
  await db.saveJson('kontakte', { kontakte: [k] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'kunde', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, zielTage: 30 } }] } as unknown as CrmBestand);
  const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
  await db.saveJson('gesellschaften--kg-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Beispiel KDV', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', bank: { iban: IBAN }, geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' }] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  await db.saveJson('liquiplan', { posten: [] });
  await db.saveJson('rechnungswesen', { kreislauf: { vorbereiten: { ab: '2026-10-30' } } });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Server · Schreibweg stempelt die Pausen, der Browser nie', () => {
  it('teil „pausiert“ → { von: heute }; „aktiv“ → bis gestern; mitgeschickte Pausen zählen nicht', async () => {
    const { wendeCrmAn, leererBestand } = await import('@/lib/crm/speicher');
    const b0 = { ...leererBestand(), mandate: [mandat('m-s', { start: '2026-11-01' })] };
    const b1 = wendeCrmAn(b0, [{ liste: 'mandate', op: 'teil', id: 'm-s', felder: { status: 'pausiert', pausen: [{ von: '2020-01-01', bis: '2020-01-02' }] } }], '2026-12-01T10:00:00.000Z', 'pa', undefined, []);
    expect(b1.grenze).toEqual([]);
    expect(b1.bestand.mandate[0].pausen).toEqual([{ von: '2026-12-01' }]);
    const b2 = wendeCrmAn(b1.bestand, [{ liste: 'mandate', op: 'teil', id: 'm-s', felder: { status: 'aktiv', pausen: [] } }], '2027-02-01T10:00:00.000Z', 'pa', undefined, []);
    expect(b2.bestand.mandate[0].pausen).toEqual([{ von: '2026-12-01', bis: '2027-01-31' }]);
    // Eine andere Änderung (Titel) lässt die Pausen, wie sie sind — auch wenn der Browser sie leer schickt.
    const b3 = wendeCrmAn(b2.bestand, [{ liste: 'mandate', op: 'teil', id: 'm-s', felder: { titel: 'Neu', pausen: null } }], '2027-02-02T10:00:00.000Z', 'pa', undefined, []);
    expect(b3.bestand.mandate[0].pausen).toEqual([{ von: '2026-12-01', bis: '2027-01-31' }]);
    // Ohne Status-Wechsel kein Feld (bit-gleich).
    const b4 = wendeCrmAn(b0, [{ liste: 'mandate', op: 'teil', id: 'm-s', felder: { titel: 'Neu' } }], '2026-12-01T10:00:00.000Z', 'pa', undefined, []);
    expect('pausen' in b4.bestand.mandate[0]).toBe(false);
  });
});

describe('Server · Morgenlauf', () => {
  it('beendet zum 15.01.: Dezember, Januar anteilig, danach nichts — zwei Läufe am selben Tag ergeben EINEN Entwurf', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-ende', { start: '2026-11-01', status: 'beendet', ende: '2027-01-15' })] }));
    await lauf('2026-11-02');
    await lauf('2026-11-02');
    expect((await entwuerfe('m-ende')).map(r => r.leistungVon)).toEqual(['2026-11-01']);
    await lauf('2026-12-01');
    await lauf('2026-12-01');
    await lauf('2027-01-04');
    await lauf('2027-01-04');
    await lauf('2027-02-02');
    await lauf('2027-03-02');
    const l = await entwuerfe('m-ende');
    expect(l.map(r => `${r.leistungVon}…${r.leistungBis}`).sort()).toEqual(['2026-11-01…2026-11-30', '2026-12-01…2026-12-31', '2027-01-01…2027-01-15']);
    expect(l.find(r => r.leistungVon === '2027-01-01')!.netto).toBe(Math.round((3000 * 15 / 31) * 100) / 100);
  }, 120_000);
  it('Pause Dezember–Januar (festgehalten): nur November und Februar', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-pause', { start: '2026-11-01', pausen: [{ von: '2026-12-01', bis: '2027-01-31' }] })] }));
    await lauf('2026-11-02');
    await lauf('2027-02-02');
    await lauf('2027-02-02');
    await lauf('2027-02-03');
    expect((await entwuerfe('m-pause')).map(r => r.leistungVon).sort()).toEqual(['2026-11-01', '2027-02-01']);
  }, 120_000);
  it('Altbestand: pausiert ohne Pausen-Eintrag — die Monate, die der Lauf pausiert sah, kommen nach dem Zurück nie', async () => {
    const { aendereCrm } = await import('@/lib/crm/speicher');
    await aendereCrm(b => ({ ...b, mandate: [...b.mandate, mandat('m-alt', { start: '2026-11-01' })] }));
    await lauf('2026-11-02');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === 'm-alt' ? { ...m, status: 'pausiert' as const } : m)) }));
    await lauf('2026-12-02');
    await lauf('2027-01-04');
    const merker = (await db.loadJson<{ kreislauf?: { vorbereiten?: { erledigt?: Record<string, string> } } }>('rechnungswesen'))?.kreislauf?.vorbereiten?.erledigt ?? {};
    expect(merker['m-alt|2026-12']).toBe('p:2026-12-02');
    expect(merker['m-alt|2027-01']).toBe('p:2027-01-04');
    await aendereCrm(b => ({ ...b, mandate: b.mandate.map(m => (m.id === 'm-alt' ? { ...m, status: 'aktiv' as const } : m)) }));
    await lauf('2027-02-02');
    await lauf('2027-02-03');
    await lauf('2027-02-04');
    expect((await entwuerfe('m-alt')).map(r => r.leistungVon).sort()).toEqual(['2026-11-01', '2027-02-01']);
  }, 120_000);
});
