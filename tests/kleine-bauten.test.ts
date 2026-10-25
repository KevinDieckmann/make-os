// ─── Kleine Bauten (25.10., Übernahme echter Produkte) — die reinen Regeln je Punkt ─────────────────────────────────────────
// Alle Werte erfunden. Ohne neue Felder/Einstellungen bleibt alles bit-gleich (Gold in tests/kleine-bauten-gold.test.ts).
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import type { Leistung, Mandat } from '@/lib/crm/typen';
import { preisteilSaeubern, preisteilPruefen, angebotPositionenAusProdukt, artikelnummerSaeubern, PRODUKT_GRENZEN } from '@/lib/crm/produkt-karte';
import { teilFeldSetzen, PREIS_TEIL_FELDER } from '@/lib/crm/produkt-katalog';
import { positionSaeubern as angebotPositionSaeubern } from '@/lib/crm/angebote';
import { positionSaeubern as rechnungPositionSaeubern, positionenAusAngebot } from '@/lib/finanzen/rechnung/regeln';
import { monatsPositionen, abrechnenPositionen } from '@/lib/crm/mandat-zusatz';
import { angebotDokument } from '@/lib/crm/angebot-dokument';
import { angebotPdf } from '@/lib/crm/angebot-pdf';
import { rechnungDokument } from '@/lib/finanzen/rechnung/dokument';
import { importPlanen } from '@/lib/crm/produkt-import';
import { GOLD_ABSENDER, GOLD_ANGEBOT, GOLD_RECHNUNG } from './fixtures/kleine-bauten-gold';

const J = '2026-10-25T08:00:00.000Z';
const produkt = (x: Partial<Leistung> = {}): Leistung => ({
  id: 'l-beispiel', name: 'Beispiel-Begleitung', typ: 'retainer', stufe: 'kern', preis: { betrag: 2000, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: [],
  gesellschaft: 'ug', status: 'aktiv', angebot: { leistungstext: 'Monatliche Begleitung.' }, geaendert: J,
  preise: [
    { id: 'pt-1', art: 'monatlich', betragCent: 200_000, rolle: 'grund', artikelnummer: 'BSP-BEG-06' },
    { id: 'pt-2', art: 'tagessatz', betragCent: 120_000, rolle: 'option', artikelnummer: 'BSP-TAG' },
  ],
  vertrag: { mindestlaufzeitMonate: 6 }, ...x,
} as Leistung);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

describe('1 · Artikelnummer am Preis-Teil → Angebots- und Rechnungsposition → PDF', () => {
  it('Säuberer behält sie (Leerraum zusammengezogen), fremde Form fällt weg; Prüfung: zu lang 413, fremde Form 400', () => {
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 100, artikelnummer: '  AB-12/3  ' }, 'pt-x')?.artikelnummer).toBe('AB-12/3');
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 100, artikelnummer: '<script>' }, 'pt-x')).not.toHaveProperty('artikelnummer');
    expect(preisteilSaeubern({ id: 'pt-1', art: 'fest', betragCent: 100 }, 'pt-x')).not.toHaveProperty('artikelnummer');
    expect(preisteilPruefen({ art: 'fest', artikelnummer: 'X'.repeat(PRODUKT_GRENZEN.artikelnummer + 1) }).map(f => f.status)).toContain(413);
    expect(preisteilPruefen({ art: 'fest', artikelnummer: '-A' }).map(f => f.status)).toContain(400);
    expect(preisteilPruefen({ art: 'fest', artikelnummer: 'A-1' })).toEqual([]);
    expect(artikelnummerSaeubern('Ä-1 .x')).toBe('Ä-1 .x');
  });
  it('Karte: Feld „Artikelnummer“ je Form (außer kostenlos), setzen/leeren/ablehnen', () => {
    expect(PREIS_TEIL_FELDER.monatlich).toContain('artikelnummer');
    expect(PREIS_TEIL_FELDER.kostenlos).toEqual(['text']);
    const t = { id: 'pt-1', art: 'fest' as const, rolle: 'grund' as const };
    const r = teilFeldSetzen(t, 'artikelnummer', ' AB 1 ');
    expect(r.ok && r.teil.artikelnummer).toBe('AB 1');
    const leer = teilFeldSetzen({ ...t, artikelnummer: 'AB' }, 'artikelnummer', '');
    expect(leer.ok && 'artikelnummer' in leer.teil).toBe(false);
    expect(teilFeldSetzen(t, 'artikelnummer', '#1').ok).toBe(false);
  });
  it('Angebotsposition aus dem Preis-Teil trägt sie, der Entwurf-Säuberer behält sie; ohne Nummer am Teil kein Feld', () => {
    const pos = angebotPositionenAusProdukt(produkt(), ['pt-2']);
    expect(pos.map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', 'BSP-TAG']);
    expect(angebotPositionSaeubern(pos[0] as unknown as Record<string, unknown>, 0)?.artikelnummer).toBe('BSP-BEG-06');
    const ohne = angebotPositionenAusProdukt(produkt({ preise: [{ id: 'pt-1', art: 'monatlich', betragCent: 200_000, rolle: 'grund' }] }));
    expect(ohne[0]).not.toHaveProperty('artikelnummer');
  });
  it('Rechnung aus dem Angebot und aus dem Mandat (Monatshonorar, Zusatzmodul, abrechnen) trägt die Nummer des Preis-Teils', () => {
    expect(positionenAusAngebot({ positionen: angebotPositionenAusProdukt(produkt(), ['pt-2']) }).map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', 'BSP-TAG']);
    expect(rechnungPositionSaeubern({ titel: 'x', artikelnummer: 'R-1', menge: 1, einzelpreisCent: 1 }, 0)?.artikelnummer).toBe('R-1');
    const modul = produkt({ id: 'l-modul', name: 'Beispiel-Modul', rolle: 'zusatz', preise: [{ id: 'pt-m', art: 'monatlich', betragCent: 30_000, rolle: 'grund', artikelnummer: 'BSP-MOD' }] });
    const m = {
      id: 'm-1', titel: 'Begleitung', honorar: { betrag: 2000, basis: 'monat', netto: true }, ustSatz: 19, leistungen: [], start: '2026-10-01', leistungId: 'l-beispiel',
      zusatz: [{ id: 'mz-a', leistungId: 'l-modul', honorar: { betragCent: 30_000, basis: 'monat' } }, { id: 'mz-e-2', leistungId: 'l-beispiel', preisTeilId: 'pt-2', honorar: { betragCent: 120_000, basis: 'tag' } }],
    } as unknown as Mandat;
    const ctx = { katalog: [produkt(), modul], nettoAusBrutto: (b: number) => b };
    const pos = monatsPositionen(m, '2026-11', ctx);
    expect(pos.map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', 'BSP-MOD']);
    const ab = abrechnenPositionen(m, '2026-11', [{ zusatzId: 'mz-e-2', menge: 2 }], ctx);
    expect(ab.ok && ab.positionen[0].artikelnummer).toBe('BSP-TAG');
    // Ohne Katalog (bzw. ohne Nummer): bit-gleich wie bisher — kein Feld.
    expect(monatsPositionen(m, '2026-11', { nettoAusBrutto: (b: number) => b }).some(p => 'artikelnummer' in p)).toBe(false);
  });
  it('Dokument, Vorschau und PDF: Spalte „Art.-Nr.“ nur mit Nummer; mit Nummer ändert sich das PDF', async () => {
    const mit = { ...GOLD_ANGEBOT, positionen: GOLD_ANGEBOT.positionen.map((p, i) => (i === 0 ? { ...p, artikelnummer: 'BSP-BEG-06' } : p)) };
    const d = angebotDokument(mit, GOLD_ABSENDER, { name: 'Max Muster', zeilen: ['Beispielkunde GmbH'] }, '2026-10-20');
    expect(d.positionen.map(p => p.artikelnummer)).toEqual(['BSP-BEG-06', undefined]);
    const { Blatt } = await import('@/components/os/crm/angebot/Blatt');
    expect(renderToStaticMarkup(createElement(Blatt, { d }))).toContain('Art.-Nr.');
    const ohne = angebotDokument(GOLD_ANGEBOT, GOLD_ABSENDER, { name: 'Max Muster', zeilen: ['Beispielkunde GmbH'] }, '2026-10-20');
    expect(renderToStaticMarkup(createElement(Blatt, { d: ohne }))).not.toContain('Art.-Nr.');
    const erstellt = new Date(J);
    expect(sha(await angebotPdf(d, { erstellt }))).not.toBe(sha(await angebotPdf(ohne, { erstellt })));
    const r = rechnungDokument({ ...GOLD_RECHNUNG, positionen: GOLD_RECHNUNG.positionen!.map(p => ({ ...p, artikelnummer: 'X'.repeat(40) })) }, GOLD_ABSENDER, { datum: '2026-10-20' });
    expect(r.positionen[0].artikelnummer).toHaveLength(40);
    expect((await angebotPdf(r, { erstellt })).length).toBeGreaterThan(1000);
  });
  it('Import: Artikelnummer je Preis-Teil (auch aus der Tabelle), zu lang → 413, zweiter Lauf „gleich“', async () => {
    const k = { neueId: () => 'l-neu-1' };
    const p = importPlanen({ leistungen: [] }, [{ name: 'Beispiel-Begleitung', leistungstext: 'x', gesellschaft: 'ug', preise: [{ art: 'monatlich', betrag: 2000, artikelnummer: 'BSP-1' }] }], k);
    expect(p.status).toBe(200);
    const eintrag = (p.ops[0] as { eintrag: Record<string, unknown> }).eintrag;
    expect((eintrag.preise as { artikelnummer?: string }[])[0].artikelnummer).toBe('BSP-1');
    expect(p.zeilen[0].felder.find(f => f.feld === 'preise')?.neu).toContain('Art.-Nr. BSP-1');
    const bestand = { leistungen: [produkt({ id: 'l-neu-1', name: 'Beispiel-Begleitung', angebot: { leistungstext: 'x' }, preise: eintrag.preise as Leistung['preise'] })] };
    const zweiter = importPlanen(bestand, [{ name: 'Beispiel-Begleitung', preise: [{ art: 'monatlich', betrag: 2000, artikelnummer: 'BSP-1' }] }], k);
    expect(zweiter.zeilen[0].art).toBe('gleich');
    const anders = importPlanen(bestand, [{ name: 'Beispiel-Begleitung', preise: [{ art: 'monatlich', betrag: 2000, artikelnummer: 'BSP-2' }] }], k);
    expect(anders.zeilen[0]).toMatchObject({ art: 'aendert' });
    expect(anders.zeilen[0].felder[0]).toMatchObject({ alt: expect.stringContaining('BSP-1'), neu: expect.stringContaining('BSP-2') });
    const lang = importPlanen({ leistungen: [] }, [{ name: 'Y', preise: [{ art: 'fest', betrag: 1, artikelnummer: 'X'.repeat(41) }] }], k);
    expect(lang.status).toBe(413);
    const { importAusTabelle } = await import('@/lib/crm/produkt-import');
    expect(importAusTabelle('Name;Preis-Art;Betrag;Artikelnummer\nBeispiel;monatlich;100;BSP-9').produkte[0].preise?.[0]).toMatchObject({ artikelnummer: 'BSP-9' });
  });
});

describe('2 · Rechnungsnummer-Format je Gesellschaft (Vorgabe wie heute, ein Kreis mit Storno)', () => {
  it('Vorgabe ohne Einstellung = {KURZ}-R-{JAHR}-{NR4}, Storno wie Rechnung', async () => {
    const { mitVorgaben } = await import('@/lib/crm/gesellschaften');
    const v = mitVorgaben({ id: 'kdv' });
    expect(v.rechnungsformat).toBe('{KURZ}-R-{JAHR}-{NR4}');
    expect(v.stornoformat).toBe('{KURZ}-R-{JAHR}-{NR4}');
    expect(mitVorgaben({ id: 'kdv', rechnungsformat: 'RE-{JJ}-{NR5}' }).stornoformat).toBe('RE-{JJ}-{NR5}');
    expect(mitVorgaben({ id: 'kdv', rechnungsformat: 'RE-{NR5}' }).rechnungsformat).toBe('{KURZ}-R-{JAHR}-{NR4}');
  });
  it('Speichern: gültig → übernommen, ohne Jahr bzw. ohne laufende Nummer → Fehler (nichts still verworfen), leer → Vorgabe', async () => {
    const { gesellschaftAnwenden } = await import('@/lib/crm/gesellschaften');
    const a = gesellschaftAnwenden({ id: 'kdv' }, { rechnungsformat: 'RE-{JJ}-{NR5}', stornoformat: 'ST-{JAHR}-{NR4}' }, J, 'pa');
    expect(a.fehler).toEqual([]);
    expect(a.g).toMatchObject({ rechnungsformat: 'RE-{JJ}-{NR5}', stornoformat: 'ST-{JAHR}-{NR4}' });
    const b = gesellschaftAnwenden(a.g, { rechnungsformat: 'RE-{NR5}' }, J, 'pa');
    expect(b.fehler.map(f => f.feld)).toEqual(['rechnungsformat']);
    expect(gesellschaftAnwenden(a.g, { stornoformat: 'ST-{JAHR}' }, J, 'pa').fehler.map(f => f.feld)).toEqual(['stornoformat']);
    expect(gesellschaftAnwenden(a.g, { rechnungsformat: '' }, J, 'pa').g).not.toHaveProperty('rechnungsformat');
  });
  it('Nächste Nummer im eigenen Format — derselbe Zähler für Rechnung und Storno, lückenlos; ungültiges Format → Vorgabe', async () => {
    const { naechsteNummer } = await import('@/lib/finanzen/rechnung/regeln');
    const l = [{ firmaId: 'kdv', lauf: { jahr: 2026, nr: 4 }, nummer: 'RE-26-00004' }] as never;
    expect(naechsteNummer(l, 4, 'kdv', 2026, 'BW', 'RE-{JJ}-{NR5}')).toEqual({ lauf: { jahr: 2026, nr: 5 }, nummer: 'RE-26-00005' });
    expect(naechsteNummer(l, 4, 'kdv', 2026, 'BW', 'ST-{JAHR}-{NR4}')).toEqual({ lauf: { jahr: 2026, nr: 5 }, nummer: 'ST-2026-0005' });
    expect(naechsteNummer(l, 4, 'kdv', 2026, 'BW', 'kaputt')).toEqual({ lauf: { jahr: 2026, nr: 5 }, nummer: 'BW-R-2026-0005' });
  });
});
