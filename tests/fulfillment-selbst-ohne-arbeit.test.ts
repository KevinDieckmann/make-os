// ─── Fulfillment für die Selbstständigkeit — Gegenprobe: eine Privat-Einheit OHNE Arbeit (25.10., Branch `fulfillment-selbst`) ─────────────────────────
// Instanz `{"kdc":{"arbeit":false}}` (per `vi.hoisted`, wie die Mechanik-Tests der Selbstständigkeit): dann ist die Einheit nur Privat — kein Fulfillment wie bisher
// (Fall starten → 400 mit dem Satz „gehört zu Privat“), kein Kandidat, keine Arbeits-Marke an ihren Ereignissen, kein Kennzeichen. Erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const o = mkdtempSync(path.join(tmpdir(), 'make-os-ff-selbst-ohne-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ff-selbst-ohne', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus', NEXT_PUBLIC_MAKE_OS_EINHEITEN: JSON.stringify({ kdc: { arbeit: false } }) });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY', 'MAKE_OS_ADRESSE']) delete process.env[k];
  return o;
});

import { konto, J } from './fixtures/prozess-bau';

const H = 'haus-fso';
type HR = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown>; text: string }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, HR>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const text = (r.headers.get('content-type') ?? '').includes('json') ? await r.text() : '';
  return { status: r.status, j: text ? JSON.parse(text) as Record<string, unknown> : {}, text };
}
const mandat = (id: string, gesellschaft: string) => ({
  id, kunde: `Probe ${id} GmbH`, firmaId: 'f-1', kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', leistungId: 'l-1', gesellschaft, status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-06-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
  health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J,
});

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-1', name: 'Beispiel GmbH', geaendert: J }],
    leistungen: [{ id: 'l-1', name: 'Paket', typ: 'retainer', status: 'aktiv', lieferumfang: [], gesellschaft: 'ug', geaendert: J }],
    mandate: [mandat('m-biz', 'ug'), mandat('m-privat', 'kdc')] });
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [{
    id: 'fp-paket', art: 'paket', titel: 'Paket liefern', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w', titel: 'Paket liefern', rang: 0 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 0 }],
  }], bausteine: [], rituale: [], zuordnung: {}, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: {} });
}, 60_000);
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Privat-Einheit ohne Arbeit — kein Fulfillment wie bisher', () => {
  it('Regel: nur Business; keine Arbeits-Marke, kein Kennzeichen', async () => {
    const r = await import('@/lib/fulfillment/regeln');
    expect(r.istFulfillmentMandat('kdc')).toBe(false);
    expect(r.istPrivatArbeitsMandat('kdc')).toBe(false);
    expect(r.mandatInSicht('kdc', true)).toBe(false);
    expect(r.bereichsKennzeichen('kdc')).toBeNull();
    expect(r.istFulfillmentMandat('ug')).toBe(true);
    const { mandatEreignisBereich } = await import('@/lib/ereignisse/quellen');
    expect(mandatEreignisBereich('kdc')).toEqual({ bereich: 'privat' });
  });
  it('Fall starten → 400 mit dem Satz „gehört zu Privat“; kein Kandidat; nichts in der Übersicht', async () => {
    const { GEHOERT_ZU_PRIVAT } = await import('@/lib/einheiten');
    const s = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-privat', vorlageId: 'fp-paket', anfrageId: 'ff-ohne-start-1' });
    expect(s.status).toBe(400);
    expect(s.j.fehler).toBe(GEHOERT_ZU_PRIVAT('kdc'));
    expect((await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-privat')).status).toBe(404);
    const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
    expect(ue.text).not.toContain('m-privat');
    expect((ue.j.kandidaten as { mandatId: string }[]).map(k => k.mandatId)).toEqual(['m-biz']);
  }, 60_000);
});
