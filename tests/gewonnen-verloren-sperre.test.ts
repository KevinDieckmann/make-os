// Gewonnen → Verloren (Fund 12.10., Ende-zu-Ende-Test): ein gewonnener Deal wird nicht still „verloren“, solange ein laufendes Mandat
// oder ein angenommenes Angebot an ihm hängt (409 mit dem Weg); der Grund bleibt Pflicht; die Historie behält beides; Bestandsdaten bleiben.
// Eigener Datenordner, alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { wendeCrmAn, leererBestand } from '@/lib/crm/speicher';
import { gewonnenVerlorenSperre } from '@/lib/crm/pipeline';
import { standVon } from '@/lib/crm/crm-stand';
import type { Angebot, Chance, CrmBestand, Mandat } from '@/lib/crm/typen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-gewonnen-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-gewonnen-verloren';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const H = '2026-10-01T09:00:00.000Z';
const JETZT = '2026-10-12T10:00:00.000Z';
const gewonnen = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Muster AG · Retainer', kontaktIds: [], art: 'retainer', wert: { betrag: 2500, basis: 'monat' }, stufe: 'gewonnen',
  historie: [{ stufe: 'qualifiziert', am: '2026-09-01T09:00:00.000Z', von: 'kevin' }, { stufe: 'gewonnen', am: '2026-09-20T09:00:00.000Z', von: 'kevin' }],
  qualifizierung: { bedarf: 'offen', budget: 'offen', entscheider: 'offen', zeit: 'offen' } as unknown as Chance['qualifizierung'],
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: H, geaendert: H, geaendertVon: 'kevin', ...x,
} as unknown as Chance);
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Muster AG', kontaktIds: [], titel: 'Retainer Muster', art: 'retainer', chanceId: 'ch-1', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true,
  verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: H, ...x,
} as unknown as Mandat);
const angebot = (x: Partial<Angebot> = {}): Angebot => ({
  id: 'a-1', nummer: 'MK-A-2026-0001', gesellschaft: 'offen', dealId: 'ch-1', titel: 'Retainer', positionen: [], einleitung: '', schluss: '', gueltigBis: '2026-12-31', zahlungszielTage: 14,
  status: 'angenommen', version: 1, angenommenAm: '2026-09-20', angelegt: H, geaendert: H, ...x,
} as unknown as Angebot);
const bestand = (teile: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), ...teile });
const teil = (felder: Record<string, unknown>, id = 'ch-1') => ({ liste: 'chancen' as const, op: 'teil' as const, id, felder });
const verlieren = (b: CrmBestand, grund: string | null = 'Kunde ist abgesprungen') => wendeCrmAn(b, [teil({ stufe: 'verloren', ...(grund ? { grund } : {}) })], JETZT, 'malin');

describe('Gewonnen → Verloren', () => {
  it('ohne Mandat und ohne angenommenes Angebot geht es — mit Grund; die Historie behält Gewonnen und Verloren', () => {
    const r = verlieren(bestand({ chancen: [gewonnen()] }));
    expect(r.abgelehnt).toBeUndefined();
    expect(r.fehler).toEqual([]);
    expect(r.bestand.chancen[0]).toMatchObject({ stufe: 'verloren', grund: 'Kunde ist abgesprungen' });
    expect(r.bestand.chancen[0].historie.map(h => h.stufe)).toEqual(['qualifiziert', 'gewonnen', 'verloren']);
  });

  it('der Grund bleibt Pflicht (ohne Grund: Fehler, Deal bleibt gewonnen)', () => {
    const r = verlieren(bestand({ chancen: [gewonnen()] }), null);
    expect(r.fehler).toHaveLength(1);
    expect(r.fehler[0]).toMatch(/Grund/);
    expect(r.bestand.chancen[0].stufe).toBe('gewonnen');
  });

  it('mit laufendem Mandat: abgelehnt (409-Weg) mit Text „Mandat beenden“, nichts geändert — auch mit Grund', () => {
    const b = bestand({ chancen: [gewonnen()], mandate: [mandat()] });
    const r = verlieren(b);
    expect(r.abgelehnt).toHaveLength(1);
    expect(r.abgelehnt![0]).toMatch(/erst das Mandat „Retainer Muster“ beenden/);
    expect(r.angewandt).toBe(0);
    expect(r.bestand.chancen[0].stufe).toBe('gewonnen');
    expect(r.bestand.chancen[0].historie).toHaveLength(2);
  });

  it('auch ein pausiertes Mandat zählt (nur „beendet“ und Papierkorb geben frei)', () => {
    expect(verlieren(bestand({ chancen: [gewonnen()], mandate: [mandat({ status: 'pausiert' })] })).abgelehnt).toHaveLength(1);
    expect(verlieren(bestand({ chancen: [gewonnen()], mandate: [mandat({ status: 'beendet' })] })).abgelehnt).toBeUndefined();
    expect(verlieren(bestand({ chancen: [gewonnen()], mandate: [mandat({ geloeschtAm: H })] })).abgelehnt).toBeUndefined();
    expect(verlieren(bestand({ chancen: [gewonnen()], mandate: [mandat({ chanceId: 'ch-anderer' })] })).abgelehnt).toBeUndefined();
  });

  it('mit angenommenem Angebot: abgelehnt mit Text „Angebot archivieren“; gestellt/abgelehnt/archiviert sperren nicht', () => {
    const r = verlieren(bestand({ chancen: [gewonnen()], angebote: [angebot()] }));
    expect(r.abgelehnt).toHaveLength(1);
    expect(r.abgelehnt![0]).toMatch(/das angenommene Angebot MK-A-2026-0001 archivieren/);
    expect(r.bestand.chancen[0].stufe).toBe('gewonnen');
    for (const a of [angebot({ status: 'gestellt' }), angebot({ status: 'abgelehnt' }), angebot({ archiviertAm: H }), angebot({ dealId: 'ch-anderer' })]) {
      expect(verlieren(bestand({ chancen: [gewonnen()], angebote: [a] })).abgelehnt).toBeUndefined();
    }
  });

  it('Mandat UND Angebot: der Text nennt beides', () => {
    const t = gewonnenVerlorenSperre({ id: 'ch-1', titel: 'Muster AG · Retainer' }, { mandate: [mandat()], angebote: [angebot()] });
    expect(t).toMatch(/Mandat „Retainer Muster“ beenden und das angenommene Angebot MK-A-2026-0001 archivieren/);
  });

  it('als ganzer Eintrag (Upsert) gilt dieselbe Regel', () => {
    const b = bestand({ chancen: [gewonnen()], mandate: [mandat()] });
    const r = wendeCrmAn(b, [{ liste: 'chancen', op: 'upsert', stand: standVon(b.chancen[0]), eintrag: { ...gewonnen(), stufe: 'verloren', grund: 'weg' } as unknown as Record<string, unknown> }], JETZT, 'kevin');
    expect(r.abgelehnt).toHaveLength(1);
    expect(r.bestand.chancen[0].stufe).toBe('gewonnen');
  });

  it('andere Wechsel bleiben frei: offene Deals mit Mandat-Verweis, Mandat selbst beenden, gewonnen → Geparkt, bereits Verlorenes', () => {
    // offener Deal (Mandat mit seiner Kennung ist irrelevant) → verloren
    const offen = gewonnen({ stufe: 'angebot', historie: [{ stufe: 'angebot', am: H, von: 'kevin' }], naechsterSchritt: { text: 'Nachfassen', datum: '2026-10-20' } });
    expect(verlieren(bestand({ chancen: [offen], mandate: [mandat()] })).abgelehnt).toBeUndefined();
    // das Mandat beenden ist erlaubt (das ist der Weg, den der Text nennt)
    const beenden = wendeCrmAn(bestand({ chancen: [gewonnen()], mandate: [mandat()] }), [{ liste: 'mandate', op: 'teil', id: 'm-1', felder: { status: 'beendet' } }], JETZT, 'kevin');
    expect(beenden.abgelehnt).toBeUndefined();
    expect(beenden.bestand.mandate[0].status).toBe('beendet');
    // Bestandsdaten: ein Deal, der schon „verloren“ ist, bleibt es (kein Wechsel, nichts zu prüfen)
    const schonVerloren = gewonnen({ stufe: 'verloren', grund: 'alt' });
    const r = wendeCrmAn(bestand({ chancen: [schonVerloren], mandate: [mandat()] }), [teil({ notiz: 'Hinweis' })], JETZT, 'kevin');
    expect(r.abgelehnt).toBeUndefined();
    expect(r.bestand.chancen[0]).toMatchObject({ stufe: 'verloren', notiz: 'Hinweis' });
  });

  it('nach dem Beenden des Mandats geht Verloren mit Grund (Reihenfolge wie im Text)', () => {
    let b = bestand({ chancen: [gewonnen()], mandate: [mandat()] });
    expect(verlieren(b).abgelehnt).toHaveLength(1);
    b = wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: 'm-1', felder: { status: 'beendet' } }], JETZT, 'kevin').bestand;
    const r = verlieren(b);
    expect(r.abgelehnt).toBeUndefined();
    expect(r.bestand.chancen[0].stufe).toBe('verloren');
  });
});

describe('Route PATCH /api/crm/bestand: 409 mit Text', () => {
  type Route = { PATCH: (r: Request) => Promise<Response> };
  let route: Route;
  let speicher: typeof import('@/lib/crm/speicher');
  const kopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-gewonnen-verloren', 'x-make-person': 'kevin' };
  const patch = (ops: unknown[]) => route.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf, body: JSON.stringify({ ops }) }));

  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' }], einladungen: [] });
    speicher = await import('@/lib/crm/speicher');
    route = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
    await db.saveJson('crm', { ...speicher.leererBestand(), chancen: [gewonnen()], mandate: [mandat()] });
    await db.saveJson('kontakte', { kontakte: [] });
  });

  it('409 + Text + abgelehnt[]; danach Mandat beenden, dann geht Verloren — Historie behält beides', async () => {
    const r = await patch([{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'verloren', grund: 'Kunde ist abgesprungen' } }]);
    expect(r.status).toBe(409);
    const j = await r.json() as { ok: boolean; fehler: string; abgelehnt: string[] };
    expect(j.ok).toBe(false);
    expect(j.fehler).toMatch(/erst das Mandat „Retainer Muster“ beenden/);
    expect(j.abgelehnt).toHaveLength(1);
    expect((await speicher.ladeCrm()).chancen[0].stufe).toBe('gewonnen');

    expect((await patch([{ liste: 'mandate', op: 'teil', id: 'm-1', felder: { status: 'beendet' } }])).status).toBe(200);
    const r2 = await patch([{ liste: 'chancen', op: 'teil', id: 'ch-1', felder: { stufe: 'verloren', grund: 'Kunde ist abgesprungen' } }]);
    expect(r2.status).toBe(200);
    const d = (await speicher.ladeCrm()).chancen[0];
    expect(d.stufe).toBe('verloren');
    expect(d.historie.map(h => h.stufe)).toEqual(['qualifiziert', 'gewonnen', 'verloren']);
  });
});
