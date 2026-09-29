// ─── Sichtprüfung 29.09., F1 — „Kunde“ setzen, danach „Titel“ ändern darf keinen 409 geben ──
// Verlust-Szenario nachgebaut: + Mandat → Kunde = vorhandener Firmenname (200) → Titel mit dem Stand aus der
// Antwort ändern. Vorher: der gespeicherte Eintrag trug keine `firmaId`, der gelesene (ladeCrm) schon → anderer
// Fingerabdruck → 409, der Titel sprang zurück. Eigener Datenordner, alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Chance, Firma, Mandat } from '@/lib/crm/typen';
import { firmaIdsNachziehen } from '@/lib/crm/firmen-bezug';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-firmaid-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-29-09-f1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = () => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' });
type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
type Stand = { mandate: (Mandat & { stand: string })[]; chancen: (Chance & { stand: string })[] };
let bestand: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');

const H = '2026-09-29T08:00:00.000Z';
const WERKE: Firma = { id: 'f-werke', name: 'Beispiel Werke GmbH', rolle: 'kunde', geaendert: H };
const HANDEL: Firma = { id: 'f-handel', name: 'Muster Handel AG', rolle: 'kunde', geaendert: H };

const patch = async (ops: unknown[]) => {
  const r = await bestand.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf(), body: JSON.stringify({ ops }) }));
  return { status: r.status, body: (await r.json()) as { stand?: Stand; konflikte?: unknown[] } };
};
const lade = async (): Promise<Stand> => ((await (await bestand.GET(new Request('http://test/api/crm/bestand', { headers: kopf() }))).json()) as { stand: Stand }).stand;

const neuesMandat = (id: string) => ({ id, kunde: 'Neuer Kunde', titel: 'Mandat', kontaktIds: [], art: 'retainer', gesellschaft: 'offen', status: 'verhandlung', vertragUnterschrieben: false, verlaengerung: 'offen', honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [] });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  speicher = await import('@/lib/crm/speicher');
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
  const deal = { id: 'ch-eins', titel: 'Deal', kontaktIds: [], art: 'projekt', wert: { betrag: 1000, basis: 'einmalig' }, stufe: 'qualifiziert', historie: [{ stufe: 'qualifiziert', am: H, von: 'kevin' }], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: H, geaendert: H };
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [WERKE, HANDEL], chancen: [deal] });
  await db.saveJson('kontakte', { kontakte: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('F1: Kunde setzen, dann Titel ändern', () => {
  it('Stand aus der PATCH-Antwort: Titel kommt an (kein 409, springt nicht zurück)', async () => {
    const anlegen = await patch([{ liste: 'mandate', op: 'upsert', eintrag: neuesMandat('m-eins') }]);
    expect(anlegen.status).toBe(200);
    let m = anlegen.body.stand!.mandate.find(x => x.id === 'm-eins')!;
    const kunde = await patch([{ liste: 'mandate', op: 'teil', id: 'm-eins', felder: { kunde: 'Beispiel Werke GmbH' }, stand: m.stand }]);
    expect(kunde.status).toBe(200);
    m = kunde.body.stand!.mandate.find(x => x.id === 'm-eins')!;
    expect(m.firmaId).toBe('f-werke');
    // Gespeichert = gelesen: derselbe Fingerabdruck in PATCH-Antwort und frischem GET.
    expect((await lade()).mandate.find(x => x.id === 'm-eins')!.stand).toBe(m.stand);
    const titel = await patch([{ liste: 'mandate', op: 'teil', id: 'm-eins', felder: { titel: 'Strategie-Retainer' }, stand: m.stand }]);
    expect(titel.status).toBe(200);
    expect((await speicher.ladeCrm()).mandate.find(x => x.id === 'm-eins')!.titel).toBe('Strategie-Retainer');
    // Und auf der Platte steht die Kennung wirklich (nicht nur beim Laden ergänzt).
    expect((await db.loadJson<{ mandate: Mandat[] }>('crm'))!.mandate.find(x => x.id === 'm-eins')!.firmaId).toBe('f-werke');
  });

  it('dasselbe für Deals (chancen.firma)', async () => {
    // Neue Deals nur über den Anlage-Dialog — hier liegt einer ohne Firma im Bestand (beforeAll).
    let c = (await lade()).chancen.find(x => x.id === 'ch-eins')!;
    const firma = await patch([{ liste: 'chancen', op: 'teil', id: 'ch-eins', felder: { firma: 'Muster Handel AG' }, stand: c.stand }]);
    expect(firma.status).toBe(200);
    c = firma.body.stand!.chancen.find(x => x.id === 'ch-eins')!;
    expect(c.firmaId).toBe('f-handel');
    expect((await lade()).chancen.find(x => x.id === 'ch-eins')!.stand).toBe(c.stand);
    const titel = await patch([{ liste: 'chancen', op: 'teil', id: 'ch-eins', felder: { titel: 'Deal Handel' }, stand: c.stand }]);
    expect(titel.status).toBe(200);
  });
});

describe('Nebenbefund: Namensänderung löst die Kennung neu auf', () => {
  it('Kunde auf eine andere Firma → neue Kennung; auf einen freien Namen → Kennung weg', async () => {
    let m = (await lade()).mandate.find(x => x.id === 'm-eins')!;
    const andere = await patch([{ liste: 'mandate', op: 'teil', id: 'm-eins', felder: { kunde: 'muster handel ag' }, stand: m.stand }]);
    expect(andere.status).toBe(200);
    m = andere.body.stand!.mandate.find(x => x.id === 'm-eins')!;
    expect(m.firmaId).toBe('f-handel');
    const frei = await patch([{ liste: 'mandate', op: 'teil', id: 'm-eins', felder: { kunde: 'Ganz Neu KG' }, stand: m.stand }]);
    expect(frei.status).toBe(200);
    m = frei.body.stand!.mandate.find(x => x.id === 'm-eins')!;
    expect(m.firmaId).toBeUndefined();
    expect((await lade()).mandate.find(x => x.id === 'm-eins')!.stand).toBe(m.stand);
  });

  it('Firma umbenannt → Anzeigename zieht nach, Kennung bleibt', async () => {
    const r = await patch([{ liste: 'firmen', op: 'teil', id: 'f-handel', felder: { name: 'Muster Handel SE' } }]);
    expect(r.status).toBe(200);
    const c = r.body.stand!.chancen.find(x => x.id === 'ch-eins')!;
    expect(c).toMatchObject({ firma: 'Muster Handel SE', firmaId: 'f-handel' });
  });

  it('rein: ausdrücklich mitgeschickte Kennung gewinnt; nichts zu tun → derselbe Bestand', () => {
    const firmen = [WERKE, HANDEL];
    const vorher = { chancen: [], mandate: [{ id: 'm-x', kunde: 'Beispiel Werke GmbH', firmaId: 'f-werke' }] as unknown as Mandat[] };
    const ausdruecklich = { firmen, chancen: [], mandate: [{ id: 'm-x', kunde: 'Etwas anderes', firmaId: 'f-handel' }] as unknown as Mandat[] };
    expect(firmaIdsNachziehen(vorher, ausdruecklich).mandate[0].firmaId).toBe('f-handel');
    const gleich = { firmen, chancen: [], mandate: vorher.mandate };
    expect(firmaIdsNachziehen(vorher, gleich)).toBe(gleich);
  });
});
