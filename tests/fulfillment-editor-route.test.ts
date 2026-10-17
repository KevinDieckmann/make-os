// ─── Fulfillment · Prozess-Editor — Route (17.10.) ──────────────────────────────────────────────────────────────────────────────────────────
// Rechte: sehen alle mit dem Fulfillment-Tor, bearbeiten nur volle Mitglieder (Rolle „nur Business“ 403 — auch auf dem alten Baum-Weg), fremder Haushalt,
// Testkunde, Dienstweg und `?space=privat` 403; Bau-Kennung. Stand der ganzen Vorlage → 409 mit aktueller Fassung; Kreis 409; Grenzen 413; „Neuer Ablauf“
// idempotent. Wirkung auf Fälle: neue Fälle nehmen die neue Fassung, laufende erst per Übernahme — Erledigtes bleibt.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fulfillment-editor-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-fulfillment-editor';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string, extra: Record<string, string> = {}) => ({ 'content-type': 'application/json', 'x-make-user': person, ...extra });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const j = (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {};
  return { status: r.status, j };
}
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
interface Vorlage { id: string; titel: string; fassung: number; knoten: { id: string; titel: string; elternId?: string; form?: string }[]; papierkorb?: unknown[] }

const J = '2026-10-01T08:00:00.000Z';
let paketId = '';
const knoten = (v: Vorlage, t: string) => v.knoten.find(x => x.titel === t)!.id;

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }),
    konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' }),
    konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ff', finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    konto('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...leererBestand(),
    leistungen: [{ id: 'l-probe', name: 'Probe-Paket', typ: 'retainer', status: 'aktiv', lieferumfang: [], geaendert: J }],
    mandate: [{
      id: 'm-biz', kunde: 'Probe GmbH', kontaktIds: [], titel: 'Mandat', art: 'retainer', leistungId: 'l-probe', gesellschaft: 'ug', status: 'aktiv',
      vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
      rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
      leistungen: [], offen: [], geaendert: J,
    }],
  });
  expect((await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'aus-muster', welche: ['p1'] }] })).status).toBe(200);
  const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
  paketId = (ue.j.prozesse as { id: string; art: string }[]).find(p => p.art === 'paket')!.id;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const lesen = async (person = 'pia') => {
  const r = await rufe('fulfillment/editor', 'GET', sitzung(person), undefined, `?v=${paketId}`);
  expect(r.status).toBe(200);
  return r.j as { vorlage: Vorlage; stand: string; darfBearbeiten: boolean; laufend: number; bausteine: unknown[] };
};

describe('Rechte', () => {
  it('sehen: Fulfillment-Tor (auch „nur Business“) — fremder Haushalt, Testkunde, ?space=privat 403', async () => {
    expect((await lesen('pia')).darfBearbeiten).toBe(true);
    expect((await lesen('olaf')).darfBearbeiten).toBe(true);
    expect((await lesen('partnerin')).darfBearbeiten).toBe(false);
    for (const p of ['gast', 'kunde']) expect((await rufe('fulfillment/editor', 'GET', sitzung(p), undefined, `?v=${paketId}`)).status, p).toBe(403);
    expect((await rufe('fulfillment/editor', 'GET', sitzung('pia'), undefined, `?v=${paketId}&space=privat`)).status).toBe(403);
    expect((await rufe('fulfillment/editor', 'GET', sitzung('pia'), undefined, '?v=fp-gibtsnicht')).status).toBe(404);
    expect((await rufe('fulfillment', 'GET', sitzung('partnerin'))).j.darfBearbeiten).toBe(false);
  });
  it('schreiben: „nur Business“ 403 (Editor UND alter Baum-Weg), Dienstweg 403, fremde 403', async () => {
    const { stand, vorlage } = await lesen();
    const op = { vorlageId: paketId, stand, ops: [{ op: 'titel', titel: 'Geändert' }] };
    expect((await rufe('fulfillment/editor', 'PATCH', sitzung('partnerin'), op)).status).toBe(403);
    expect((await rufe('fulfillment/editor', 'POST', sitzung('partnerin'), { aktion: 'neu', titel: 'X' })).status).toBe(403);
    expect((await rufe('fulfillment/editor', 'PATCH', dienst('pia'), op)).status).toBe(403);
    for (const p of ['gast', 'kunde']) expect((await rufe('fulfillment/editor', 'PATCH', sitzung(p), op)).status, p).toBe(403);
    const baum = await rufe('fulfillment', 'PATCH', sitzung('partnerin'), { ops: [{ op: 'knoten', vorlageId: paketId, eintrag: { elternId: vorlage.knoten[1].id, titel: 'Neu' } }] });
    expect(baum.status).toBe(403);
    expect((await lesen()).stand).toBe(stand);
  });
  it('Bau-Kennung: ein alter Tab schreibt nicht (409 neu laden)', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', 'bau-neu');
    const { stand } = await lesen();
    const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia', { 'x-make-bau': 'bau-alt' }), { vorlageId: paketId, stand, ops: [{ op: 'titel', titel: 'Alt' }] });
    expect(r.status).toBe(409);
    expect(r.j.neuLaden).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe('Schreiben mit Stand, Regeln, Grenzen', () => {
  it('Schritt anlegen → neue Fassung und neuer Stand; veralteter Stand → 409 mit aktueller Fassung', async () => {
    const a = await lesen();
    const analyse = knoten(a.vorlage, 'Analyse');
    const r = await rufe('fulfillment/editor', 'PATCH', sitzung('olaf'), { vorlageId: paketId, stand: a.stand, ops: [{ op: 'schritt-neu', id: u(1), ziel: { phaseId: analyse, anfang: true }, form: 'nachricht', titel: 'Fragen senden', frist: 2 }] });
    expect(r.status).toBe(200);
    expect((r.j.vorlage as Vorlage).fassung).toBe(a.vorlage.fassung + 1);
    expect(r.j.stand).not.toBe(a.stand);
    expect((r.j.vorlage as Vorlage).knoten.find(x => x.id === u(1))).toMatchObject({ form: 'nachricht', elternId: analyse });
    const alt = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: paketId, stand: a.stand, ops: [{ op: 'titel', titel: 'Zu spät' }] });
    expect(alt.status).toBe(409);
    expect(alt.j.konflikte).toEqual([{ id: paketId, stand: r.j.stand }]);
    expect((alt.j.vorlage as Vorlage).knoten.some(x => x.id === u(1))).toBe(true);
    expect(alt.j.stand).toBe(r.j.stand);
  });
  it('Kreis → 409, Grenzen → 413, Unsinn → 400 — nichts gespeichert', async () => {
    const a = await lesen();
    const crm = knoten(a.vorlage, 'CRM'), prozess = knoten(a.vorlage, 'Prozess');
    const kreis = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: paketId, stand: a.stand, ops: [{ op: 'schritt', id: crm, form: 'entscheidung' }, { op: 'zweig', id: crm, ja: prozess }] });
    expect(kreis.status).toBe(409);
    const viele = Array.from({ length: 61 }, () => ({ op: 'titel', titel: 'x' }));
    expect((await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: paketId, stand: a.stand, ops: viele })).status).toBe(413);
    expect((await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: paketId, stand: a.stand, ops: [{ op: 'titel', titel: 'x'.repeat(200) }] })).status).toBe(413);
    expect((await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: paketId, stand: a.stand, ops: [{ op: 'zaubern' }] })).status).toBe(400);
    expect((await lesen()).stand).toBe(a.stand);
  });
  it('„Neuer Ablauf“: leere Vorlage mit einer Phase, idempotent über anfrageId', async () => {
    const vorher = ((await rufe('fulfillment', 'GET', sitzung('pia'))).j.prozesse as unknown[]).length;
    const a = await rufe('fulfillment/editor', 'POST', sitzung('olaf'), { aktion: 'neu', titel: 'Eigener Ablauf', anfrageId: 'ff-neu-ablauf-1' });
    expect(a.status).toBe(200);
    const b = await rufe('fulfillment/editor', 'POST', sitzung('olaf'), { aktion: 'neu', titel: 'Eigener Ablauf', anfrageId: 'ff-neu-ablauf-1' });
    expect(b.j.vorlageId).toBe(a.j.vorlageId);
    const nachher = ((await rufe('fulfillment', 'GET', sitzung('pia'))).j.prozesse as unknown[]).length;
    expect(nachher).toBe(vorher + 1);
    expect((a.j.vorlage as Vorlage).knoten).toHaveLength(2);
    expect((await rufe('fulfillment/editor', 'POST', sitzung('olaf'), { aktion: 'neu', titel: '' })).status).toBe(400);
  });
});

describe('Wirkung auf Fälle', () => {
  it('laufender Fall: „Vorlage geändert“ mit Vorschau, erst die Übernahme schreibt — erledigt bleibt erledigt', async () => {
    expect((await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-biz', vorlageId: paketId, anfrageId: 'ff-editor-start-1' })).status).toBe(200);
    const f0 = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    const fall0 = f0.j.fall as { knoten: { id: string; titel: string; stand: string; status: string }[] };
    const dossier = fall0.knoten.find(x => x.titel === 'Dossier')!;
    expect((await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-biz', ops: [{ op: 'knoten-status', id: dossier.id, status: 'erledigt', stand: dossier.stand }] })).status).toBe(200);
    expect(f0.j.diff).toBeNull();
    const a = await lesen();
    const e = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: paketId, stand: a.stand, ops: [
      { op: 'schritt', id: dossier.id, titel: 'Dossier prüfen' },
      { op: 'schritt-neu', id: u(5), ziel: { phaseId: knoten(a.vorlage, 'Analyse'), nach: dossier.id }, form: 'termin', titel: 'Abstimmungstermin' },
    ] });
    expect(e.status).toBe(200);
    const f1 = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    const diff = f1.j.diff as { neu: { titel: string }[]; geaendert: { titel: string; felder: string[] }[]; reihenfolge: unknown[] };
    expect(diff.neu.map(x => x.titel)).toEqual(['Abstimmungstermin']);
    expect(diff.geaendert.find(x => x.titel === 'Dossier prüfen')!.felder).toEqual(['titel']);
    // Nichts automatisch: der Fall hat den neuen Schritt noch nicht.
    expect((f1.j.fall as { knoten: { id: string }[] }).knoten.some(x => x.id === u(5))).toBe(false);
    expect((await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'vorlage-uebernehmen', mandatId: 'm-biz' })).status).toBe(200);
    const f2 = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-biz');
    const kn = (f2.j.fall as { knoten: { id: string; titel: string; status: string; form?: string }[] }).knoten;
    expect(kn.find(x => x.id === dossier.id)).toMatchObject({ titel: 'Dossier prüfen', status: 'erledigt' });
    expect(kn.find(x => x.id === u(5))).toMatchObject({ status: 'offen', form: 'termin' });
    for (const x of fall0.knoten) expect(kn.some(y => y.id === x.id), x.titel).toBe(true);
    expect(f2.j.diff).toBeNull();
  });
});
