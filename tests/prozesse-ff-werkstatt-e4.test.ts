// ─── Fulfillment in die Werkstatt — E4 „Alter Editor nur lesen“ (22.10., Entscheidung F4; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md › E4) ───────────
// Marke `werkstatt:<paket>` (Feld `marken`, kein neues Feld) — gesetzt mit dem ersten Entwurf bzw. beim Anlegen aus der Werkstatt:
//   · rein: Marke/Prüfung/Link; Entwurf und Veröffentlichen setzen sie; die Baum-Ops lehnen markierte Pakete ab (409), unmarkierte laufen wie vorher (Gold);
//     ein Import legt für markierte Pakete nur einen ENTWURF an (Paket Byte für Byte, kein Import-Lauf), mit offenem Entwurf 409; Links (Landkarte, Werkstatt-Liste)
//   · Routen (eigener Datenordner, erfundene Konten @example.invalid): Editor GET nur ansehen + Weg in die Werkstatt, PATCH 409 (nichts geschrieben), unmarkiert
//     unverändert bedienbar; Übersicht nennt die markierten; „Neuer Ablauf“ aus der Werkstatt (paket-neu) mit Marke, einmalig, Rechte
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-werkstatt-e4-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-werkstatt-e4';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
import { leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { inWerkstatt, mitWerkstattMarke, paketBearbeitenLink, paketeInWerkstatt, werkstattMarke, IN_WERKSTATT_TEXT } from '@/lib/fulfillment/prozesse/werkstatt-marke';
import { paketEntwurfAnwenden, paketVeroeffentlichen } from '@/lib/prozesse/fulfillment-entwurf';
import { vorlagenAnwenden } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { importAnwenden, importVorschau } from '@/lib/fulfillment/prozesse/import';
import { kurzAusFulfillment } from '@/lib/prozesse/fulfillment-bruecke';
import { prozessAusVorlage, prozessAusVorlageMit } from '@/lib/prozesse/vorlagen';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import type { ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const J = '2026-10-22T08:00:00.000Z';
const st = (x: object) => fingerabdruck(x as Record<string, unknown>);
const k = { person: 'pia', jetzt: J, standVon: st };
let nr = 100;
const neueId = (p: string) => `${p}-00000000-0000-4000-8000-${String(++nr).padStart(12, '0')}`;
const PAKET: ProzessVorlage = {
  id: 'fp-e4', art: 'paket', titel: 'Probe-Paket', fassung: 2, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], freigaben: [],
  knoten: [
    { id: 'fk-w', titel: 'Probe-Paket', rang: 1 }, { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1, kundeSichtbar: true },
    { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off', rang: 1, form: 'termin' },
  ],
};
const datei = (marke = false): VorlagenDatei => {
  const d = vorlagenAus(JSON.parse(JSON.stringify({ ...leerVorlagen(), prozesse: [PAKET] })));
  return marke ? { ...d, marken: { ...d.marken, [werkstattMarke('fp-e4')]: '2026-10-21' } } : d;
};
const vk = { person: 'pia', jetzt: J, heute: '2026-10-22', standVon: st, neueId };

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Marke, Prüfung, Link (rein)', () => {
  it('Marke je Paket; der erste Tag bleibt; Liste der markierten; Link in die Werkstatt bzw. den Editor', () => {
    expect(werkstattMarke('fp-x')).toBe('werkstatt:fp-x');
    expect(inWerkstatt(datei(true), 'fp-e4')).toBe(true);
    expect(inWerkstatt(datei(), 'fp-e4')).toBe(false);
    expect(inWerkstatt(datei(true), 42)).toBe(false);
    expect(mitWerkstattMarke({ 'werkstatt:fp-x': '2026-10-01' }, 'fp-x', '2026-10-22')).toEqual({ 'werkstatt:fp-x': '2026-10-01' });
    expect(paketeInWerkstatt({ marken: { 'werkstatt:fp-a': '1', 'muster:p1': 'fp-b', 'werkstatt:fp-c': '2' } })).toEqual(['fp-a', 'fp-c']);
    expect(paketBearbeitenLink('fp-a', ['fp-a'])).toMatch(/^\/os\/prozesse\?p=fp-a&ansicht=werkstatt/);
    expect(paketBearbeitenLink('fp-b', ['fp-a'])).toMatch(/fulfillment\?.*e=fp-b/);
  });
  it('der erste Entwurf setzt die Marke; ein Entwurf gleich dem Paket nicht; Veröffentlichen setzt sie auch', () => {
    const d = datei();
    const v = { ...PAKET, titel: 'Probe-Paket neu' };
    const r = paketEntwurfAnwenden(d, { paketId: 'fp-e4', stand: st(PAKET), vorlage: v }, k);
    expect(r.ok && inWerkstatt(r.datei, 'fp-e4')).toBe(true);
    const gleich = paketEntwurfAnwenden(d, { paketId: 'fp-e4', stand: st(PAKET), vorlage: PAKET }, k);
    expect(gleich.ok && inWerkstatt(gleich.datei, 'fp-e4')).toBe(false);
    if (!r.ok) return;
    const p = paketVeroeffentlichen({ ...r.datei, marken: {} }, { paketId: 'fp-e4', stand: st(r.datei.entwuerfe!['fp-e4'].vorlage) }, k);
    expect(p.ok && inWerkstatt(p.datei, 'fp-e4')).toBe(true);
  });
  it('Baum-Ops: markiertes Paket → 409 (Struktur und Kopf), Zuordnung zum Produkt geht; unmarkiert wie vorher (Gold)', () => {
    const op = [{ op: 'knoten', vorlageId: 'fp-e4', eintrag: { elternId: 'fk-p1', titel: 'Neu' } }];
    const m = vorlagenAnwenden(datei(true), op, vk);
    expect(m).toMatchObject({ ok: false, status: 409, fehler: IN_WERKSTATT_TEXT });
    expect(vorlagenAnwenden(datei(true), [{ op: 'vorlage', eintrag: { id: 'fp-e4', titel: 'Anders' } }], vk)).toMatchObject({ ok: false, status: 409 });
    expect(vorlagenAnwenden(datei(true), [{ op: 'knoten-weg', vorlageId: 'fp-e4', id: 'fk-a' }], vk)).toMatchObject({ ok: false, status: 409 });
    expect(vorlagenAnwenden(datei(true), [{ op: 'zuordnung', leistungId: 'l-probe', vorlageId: 'fp-e4' }], vk).ok).toBe(true);
    nr = 500; const a = vorlagenAnwenden(datei(), op, vk);
    nr = 500; const b = vorlagenAnwenden(vorlagenAus(JSON.parse(JSON.stringify({ ...leerVorlagen(), prozesse: [PAKET] }))), op, vk);
    expect(a.ok, JSON.stringify(a)).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('Landkarte und Werkstatt-Liste: markiert → Werkstatt, sonst wie vorher (prozessAusVorlage unverändert)', () => {
    expect(prozessAusVorlageMit(PAKET, true)!.link).toMatchObject({ text: 'In der Werkstatt öffnen' });
    expect(prozessAusVorlage(PAKET)).toEqual(prozessAusVorlageMit(PAKET, false));
    expect(prozessAusVorlage(PAKET)!.link).toMatchObject({ text: 'Im Editor öffnen' });
    expect(kurzAusFulfillment(PAKET, true)).toMatchObject({ nurLesen: false, inWerkstatt: true });
    expect(kurzAusFulfillment(PAKET)).toMatchObject({ nurLesen: true });
    expect(kurzAusFulfillment(PAKET).inWerkstatt).toBeUndefined();
  });
});

describe('Import (rein): ein markiertes Paket bekommt nur einen Entwurf', () => {
  const datei1 = { pakete: [{ schluessel: 'probe-e4', titel: 'Probe E4', phasen: [{ id: 'p1', titel: 'Start', fluss: [{ id: 's1', titel: 'Schritt eins' }] }] }] };
  const datei2 = { pakete: [{ schluessel: 'probe-e4', titel: 'Probe E4', phasen: [{ id: 'p1', titel: 'Start', fluss: [{ id: 's1', titel: 'Schritt eins' }, { id: 's2', titel: 'Schritt zwei' }] }] }] };
  const ik = (laufId: string) => ({ person: 'pia', jetzt: J, heute: '2026-10-22', datei: 'probe.json', laufId, standVon: st });
  let n = 0; const kid = () => `fk-imp${++n}`;
  const basis = (): VorlagenDatei => { const r = importAnwenden(leerVorlagen(), datei1, {}, ik('fi-1'), kid); if (!r.ok) throw new Error(r.fehler); return r.datei; };
  it('unmarkiert: das Paket wird ersetzt (wie vorher); markiert: Paket Byte für Byte, Entwurf mit der neuen Fassung, kein Import-Lauf; Vorschau nennt es', () => {
    const d = basis();
    const id = 'fp-imp-pk-probe-e4';
    const ohne = importAnwenden(d, datei2, {}, ik('fi-2'), kid);
    expect(ohne.ok && ohne.datei.prozesse.find(p => p.id === id)!.knoten.some(x => x.titel === 'Schritt zwei')).toBe(true);
    const mit: VorlagenDatei = { ...d, marken: { ...d.marken, [werkstattMarke(id)]: '2026-10-21' } };
    expect(importVorschau(datei2, mit, 'probe.json').paketVorlagen[0]).toMatchObject({ id, werkstatt: true });
    const r = importAnwenden(mit, datei2, {}, ik('fi-3'), kid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.datei.prozesse.find(p => p.id === id))).toBe(JSON.stringify(mit.prozesse.find(p => p.id === id)));
    const e = r.datei.entwuerfe![id];
    expect(e.vorlage.knoten.some(x => x.titel === 'Schritt zwei')).toBe(true);
    expect(e).toMatchObject({ basisFassung: 1, basisStand: st(mit.prozesse.find(p => p.id === id)!), von: 'pia' });
    expect(e.vorlage.fassung).toBe(1);
    expect(r.datei.importLaeufe.map(l => l.id)).toEqual(mit.importLaeufe.map(l => l.id));
    // Liegt schon ein Entwurf, lehnt der Import ab — nichts geht still verloren.
    expect(importAnwenden(r.datei, { pakete: [{ ...datei2.pakete[0], titel: 'Probe E4 drei' }] }, {}, ik('fi-4'), kid)).toMatchObject({ ok: false, status: 409 });
  });
});

// ══ Routen ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type Hd = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, Hd>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const H = 'haus-e4';
const roh = () => readFileSync(path.join(ordner, `fulfillment--${H}.json`), 'utf8');
let alt = '', neu = '';

beforeAll(async () => {
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'partnerin', 'mitglied', { haushalt: H, finanzRecht: 'business' })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', leererBestand());
  await d.saveJson('kontakte', { kontakte: [] });
  const a = await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel: 'Alt-Paket', anfrageId: 'e4-alt' });
  alt = a.j.vorlageId as string;
  const b = await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel: 'Werkstatt-Paket', anfrageId: 'e4-neu' });
  neu = b.j.vorlageId as string;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Alter Editor: unmarkiert bedienbar, markiert nur ansehen', () => {
  it('Gold: ein Paket ohne Marke bleibt im Editor bedienbar (PATCH 200, GET darf bearbeiten)', async () => {
    const g = await rufe('fulfillment/editor', 'GET', sitzung('pia'), undefined, `?v=${alt}`);
    expect(g.j).toMatchObject({ darfBearbeiten: true });
    expect(g.j.inWerkstatt).toBeUndefined();
    const p = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: alt, stand: g.j.stand, ops: [{ op: 'titel', titel: 'Alt-Paket umbenannt' }] });
    expect(p.status, JSON.stringify(p.j)).toBe(200);
  });
  it('nach dem ersten Entwurf in der Werkstatt: GET nur ansehen + Weg in die Werkstatt; PATCH 409 und nichts geschrieben; Baum-Ops 409', async () => {
    const w = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, `?paket=${neu}&space=business`);
    const v = { ...(w.j.paket as ProzessVorlage), titel: 'Werkstatt-Paket neu' };
    const e = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-entwurf', paketId: neu, stand: w.j.arbeitsStand, vorlage: v }, '?space=business');
    expect(e.status, JSON.stringify(e.j)).toBe(200);
    const g = await rufe('fulfillment/editor', 'GET', sitzung('pia'), undefined, `?v=${neu}`);
    expect(g.j).toMatchObject({ darfBearbeiten: false, inWerkstatt: true });
    expect(String(g.j.werkstatt)).toMatch(new RegExp(`p=${neu}&ansicht=werkstatt`));
    const vorher = roh();
    const p = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: neu, stand: g.j.stand, ops: [{ op: 'titel', titel: 'Am Editor vorbei' }] });
    expect(p.status).toBe(409);
    expect(p.j).toMatchObject({ inWerkstatt: true, fehler: IN_WERKSTATT_TEXT });
    const b = await rufe('fulfillment', 'PATCH', sitzung('pia'), { ops: [{ op: 'vorlage', eintrag: { id: neu, titel: 'Am Baum vorbei' } }] });
    expect(b.status).toBe(409);
    expect(roh()).toBe(vorher);
  });
  it('Übersicht und Werkstatt-Liste nennen das markierte Paket; das andere nicht', async () => {
    const k = await rufe('fulfillment', 'GET', sitzung('pia'), undefined, '?nur=kurz');
    expect(k.j.werkstatt).toEqual([neu]);
    const l = await rufe('prozesse/werkstatt', 'GET', sitzung('pia'), undefined, '?space=business');
    const ff = (l.j.prozesse as { id: string; quelle: string; nurLesen: boolean; inWerkstatt?: boolean }[]).filter(p => p.quelle === 'fulfillment');
    expect(ff.find(p => p.id === neu)).toMatchObject({ nurLesen: false, inWerkstatt: true });
    expect(ff.find(p => p.id === alt)).toMatchObject({ nurLesen: true });
  });
});

describe('„Neuer Ablauf“ aus der Werkstatt', () => {
  it('legt ein Paket mit Marke an (einmalig über anfrageId); „nur Business“ und Dienstweg 403', async () => {
    const a = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-neu', titel: 'Neu aus der Werkstatt', anfrageId: 'pza-00000000-0000-4000-8000-000000000001' }, '?space=business');
    expect(a.status, JSON.stringify(a.j)).toBe(200);
    const id = a.j.paketId as string;
    expect(id).toMatch(/^fp-/);
    const d = vorlagenAus(JSON.parse(roh()));
    expect(inWerkstatt(d, id)).toBe(true);
    expect(d.prozesse.find(p => p.id === id)).toMatchObject({ art: 'paket', titel: 'Neu aus der Werkstatt' });
    const b = await rufe('prozesse/werkstatt', 'POST', sitzung('pia'), { aktion: 'paket-neu', titel: 'Neu aus der Werkstatt', anfrageId: 'pza-00000000-0000-4000-8000-000000000001' }, '?space=business');
    expect(b.j.paketId).toBe(id);
    expect(vorlagenAus(JSON.parse(roh())).prozesse.filter(p => p.titel === 'Neu aus der Werkstatt')).toHaveLength(1);
    expect((await rufe('prozesse/werkstatt', 'POST', sitzung('partnerin'), { aktion: 'paket-neu', titel: 'X', anfrageId: 'pza-00000000-0000-4000-8000-000000000002' }, '?space=business')).status).toBe(403);
    expect((await rufe('prozesse/werkstatt', 'POST', { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' }, { aktion: 'paket-neu', titel: 'X' }, '?space=business')).status).toBe(403);
  });
});
