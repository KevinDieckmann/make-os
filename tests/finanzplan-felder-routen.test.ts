// ─── Finanzplanung jetzt — alle Felder anpassbar: Speichern über den Schreibweg (Stand/409) ──
// Steuern, Schwellen, Netto-Tabelle, Annahmen, Arbeitsplan + Produkt in EINER Änderung, Monats-Überschreibung —
// mit eigenem Datenordner, erfundenen Zahlen. Jede Änderung: neuer Stand, Protokoll, 409 bei fremdem Stand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-felder-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fp-felder';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
const req = (url: string, body?: unknown, method = 'GET', person = 'kevin') => new Request(`http://test${url}`, { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

type Dok = { stand: string; steuern?: Record<string, unknown>; schwellen?: Record<string, number>; annahmen: Record<string, unknown>; arbeitsplan?: string | null; planszenarien?: { id: string; bausteine: { id: string; preis: number; ueber?: Record<string, number> }[] }[]; protokoll: { feld: string; neu: string }[] };
type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let plan: Mod;
const lade = async (): Promise<Dok> => ((await (await plan.GET(req('/api/finanzplan'))).json()) as { dokument: Dok }).dokument;
const patch = async (ops: unknown[], stand?: string) => {
  const s = stand ?? (await lade()).stand;
  const r = await plan.PATCH(req('/api/finanzplan', { basisStand: s, ops }, 'PATCH'));
  return { status: r.status, body: (await r.json()) as { ok: boolean; stand?: string; fehler?: string; dokument?: Dok } };
};

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-felder' }], einladungen: [] });
  plan = (await import('@/app/api/finanzplan/route')) as unknown as Mod;
  const imp = (await import('@/app/api/finanzplan/import/route')) as unknown as { POST: (r: Request) => Promise<Response> };
  expect((await imp.POST(req('/api/finanzplan/import', { leer: true }, 'POST'))).status).toBe(200);
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Felder speichern', () => {
  it('Standard: ein leeres Dokument hat weder Steuerprofil noch Schwellen (sinnvolle leere Standards)', async () => {
    const d = await lade();
    expect(d.steuern).toBeUndefined(); expect(d.schwellen).toBeUndefined();
  });
  it('Steuerprofil: Rechtsform, Zeilen, Sätze — gespeichert, begrenzt, protokolliert', async () => {
    const vorher = await lade();
    const r = await patch([
      { pfad: '/steuern/ug/rechtsform', neu: 'kapital', feld: 'Rechtsform' },
      { pfad: '/steuern/ug/zeilen/ust/an', neu: false, feld: 'USt gilt nicht' },
      { pfad: '/steuern/ug/zeilen/kst/satz', neu: 7, feld: 'KSt Satz' },
    ]);
    expect(r.status).toBe(200); expect(r.body.stand! > vorher.stand).toBe(true);
    const d = await lade();
    expect(d.steuern).toEqual({ ug: { rechtsform: 'kapital', zeilen: { ust: { an: false }, kst: { satz: 1 } } } });
    expect(d.protokoll.slice(0, 3).map(p => p.feld)).toEqual(['KSt Satz', 'USt gilt nicht', 'Rechtsform']);
  });
  it('409: fremder Stand → nichts geschrieben, das aktuelle Dokument kommt mit', async () => {
    const d = await lade();
    const r = await patch([{ pfad: '/schwellen/freiGut', neu: 9999 }], 'veraltet');
    expect(r.status).toBe(409); expect(r.body.dokument?.stand).toBe(d.stand);
    expect((await lade()).schwellen).toBeUndefined();
  });
  it('Schwellen und Annahmen speichern; Zurücksetzen entfernt den Schlüssel', async () => {
    expect((await patch([{ pfad: '/schwellen/runwayWarnMonate', neu: 4 }, { pfad: '/annahmen/holdingKosten', neu: 250 }, { pfad: '/annahmen/steuerMonat', neu: 9 }])).status).toBe(200);
    let d = await lade();
    expect(d.schwellen).toEqual({ runwayWarnMonate: 4 }); expect(d.annahmen.holdingKosten).toBe(250); expect(d.annahmen.steuerMonat).toBe(9);
    expect((await patch([{ pfad: '/schwellen' }])).status).toBe(200);
    d = await lade(); expect(d.schwellen).toBeUndefined();
  });
  it('Netto-Tabelle: gültige Tabelle wird gespeichert, unsortierte abgelehnt (400, nichts geschrieben)', async () => {
    const stand = (await lade()).stand;
    expect((await patch([{ pfad: '/annahmen/nettoTabelle', neu: [[1000, 700], [2000, 1300], [4000, 2400]] }])).status).toBe(200);
    const d = await lade(); expect(d.annahmen.nettoTabelle).toEqual([[1000, 700], [2000, 1300], [4000, 2400]]);
    const falsch = await patch([{ pfad: '/annahmen/nettoTabelle', neu: [[2000, 1300], [1000, 700]] }], d.stand);
    expect(falsch.status).toBe(400); expect((await lade()).stand).toBe(d.stand); expect(stand < d.stand).toBe(true);
  });
  it('Arbeitsplan und erstes Produkt in EINER Änderung; Monat überschreiben und zurücksetzen', async () => {
    const ps = { id: 'psA', name: 'Arbeitsplan', basis: 'basis', bausteine: [], annahmen: {}, angelegt: '2026-10-02T10:00:00.000Z' };
    const b = { id: 'bA', art: 'umsatz', einheit: 'ug', name: 'Interim CSO', preis: 0, menge: 1, rhythmus: 'monatlich', start: 2, an: true };
    expect((await patch([{ pfad: '/planszenarien/-', neu: ps }, { pfad: '/arbeitsplan', neu: 'psA' }, { pfad: '/planszenarien/id=psA/bausteine/-', neu: b }])).status).toBe(200);
    let d = await lade();
    expect(d.arbeitsplan).toBe('psA'); expect(d.planszenarien?.[0].bausteine[0].id).toBe('bA');
    expect((await patch([{ pfad: '/planszenarien/id=psA/bausteine/id=bA/preis', neu: 6500 }, { pfad: '/planszenarien/id=psA/bausteine/id=bA/ueber/m4', neu: 7777 }])).status).toBe(200);
    d = await lade();
    expect(d.planszenarien?.[0].bausteine[0]).toMatchObject({ preis: 6500, ueber: { m4: 7777 } });
    expect((await patch([{ pfad: '/planszenarien/id=psA/bausteine/id=bA/ueber/m4' }])).status).toBe(200);
    expect((await lade()).planszenarien?.[0].bausteine[0].ueber).toBeUndefined();
  });
  it('ein gelöschter Arbeitsplan hebt die Auswahl auf; Steuerprofil bleibt', async () => {
    expect((await patch([{ pfad: '/planszenarien/id=psA' }])).status).toBe(200);
    const d = await lade(); expect(d.arbeitsplan).toBeNull(); expect(d.steuern?.ug).toBeDefined();
  });
});
