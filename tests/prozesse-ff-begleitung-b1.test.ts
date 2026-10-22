// ─── Fulfillment in die Werkstatt — B1 „Fall-Ereignisse als Auslöser“ (22.10.; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ────────────────────────────
// Begleit-Prozesse der Werkstatt starten NEBEN dem Fall auf Ereignisse des Falls — nur Kennungen, keine zweite Fristenrechnung:
//   · rein: `fallBegleitDiff` (Phase begonnen/abgeschlossen, Schritt wartet auf den Kunden, Bestätigung gegeben), `haengerEreignisse` (je Hänger einmal)
//   · über die Routen (eigener Datenordner, erfundene Konten @example.invalid, kein Netz): Fall starten → erste Phase „begonnen“; Onboarding entfällt → „abgeschlossen“
//     + nächste Phase + Kunden-Schritt wartet; Bestätigung → `abstimmung-bestaetigt`; Morgenlauf → `fall-haengt` aus `wasHaengt`, zweiter Lauf nichts doppelt
//   · Gold „Fall vorher = Fall nachher“: Ereignisse lesen nur — der Fall-Bestand bleibt Byte für Byte, auch bei erneutem Melden (Kennung = dasselbe Ereignis)
//   · Motor: Auslöser „Ereignis“ mit „nur wenn Paket = …“, Datums-Auslöser „nächster Termin mit dem Kunden“, Fall-Felder `fall.paket`/`fall.status`
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

// Der Datenordner VOR allen Importen (lib/ereignisse/quellen lädt local-db).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ff-begleitung-b1-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-begleitung';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
import { fallBegleitDiff, haengerEreignisse, type FallBegleitStand } from '@/lib/ereignisse/quellen';
import { EREIGNISSE_ANGEBUNDEN, EREIGNIS_NAME } from '@/lib/ereignisse/arten';
import { eingabeSauber } from '@/lib/ereignisse/typen';
import { istEreignisArt } from '@/lib/ereignisse/arten';
import { PROZESS_EREIGNISSE, ausloeserAus, ausloeserPasst, ereignisDaten, datumsFelderFuer } from '@/lib/prozesse/ausloeser';
import { DATUM_QUELLE } from '@/lib/prozesse/datum-start';


const ARTEN = ['fall-phase', 'fall-wartet-kunde', 'abstimmung-bestaetigt', 'fall-haengt', 'kunde-geliefert'] as const;
const M = { id: 'm-b1', firmaId: 'f-b1', gesellschaft: 'ug', kontaktIds: ['c-probe'] };
const stand = (x: Partial<FallBegleitStand>): FallBegleitStand => ({ vorlageId: 'fp-x', freigaben: [], phasen: new Map(), aktiv: [], knoten: [], ...x });

// ══ Rein ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Arten: angebunden, startet Prozesse, Bezug nur Kennungen', () => {
  it('die fünf Arten sind angebunden, haben einen Namen und starten Prozesse', () => {
    for (const a of ARTEN) {
      expect(EREIGNISSE_ANGEBUNDEN, a).toContain(a);
      expect(PROZESS_EREIGNISSE, a).toContain(a);
      expect(EREIGNIS_NAME[a], a).toBeTruthy();
    }
  });
  it('Paket und Bestätigung im Bezug bleiben beim Säubern, landen als Felder im Lauf (bezug.vorlageid, bezug.freigabeid)', () => {
    const e = eingabeSauber({ id: 'fall:m-b1:freigabe:F0', art: 'abstimmung-bestaetigt', quelle: 'fulfillment', bereich: 'business', bezug: { mandatId: 'm-b1', vorlageId: 'fp-x', freigabeId: 'F0' } }, istEreignisArt)!;
    expect(e.bezug).toEqual({ mandatId: 'm-b1', vorlageId: 'fp-x', freigabeId: 'F0' });
    expect(ereignisDaten({ ...e, stufe: undefined })).toMatchObject({ 'bezug.vorlageid': 'fp-x', 'bezug.freigabeid': 'F0', 'bezug.mandatid': 'm-b1' });
  });
});

describe('fallBegleitDiff (rein)', () => {
  it('Phase „jetzt“ neu → begonnen, „fertig“ neu → abgeschlossen; „läuft“ → „jetzt“ meldet nicht erneut', () => {
    const l = fallBegleitDiff(stand({ phasen: new Map([['p1', 'jetzt'], ['p2', 'offen'], ['p3', 'fertig']]) }), stand({ phasen: new Map([['p1', 'fertig'], ['p2', 'jetzt'], ['p3', 'fertig']]) }), M, '2026-10-22');
    expect(l.map(e => [e.art, e.stufe, e.bezug.knotenId])).toEqual([['fall-phase', 'abgeschlossen', 'p1'], ['fall-phase', 'begonnen', 'p2']]);
    expect(l[0]).toMatchObject({ bereich: 'business', quelle: 'fulfillment', bezug: { mandatId: 'm-b1', firmaId: 'f-b1', kontaktId: 'c-probe', vorlageId: 'fp-x' } });
    expect(fallBegleitDiff(stand({ phasen: new Map([['p1', 'fertig']]) }), stand({ phasen: new Map([['p1', 'jetzt']]) }), M, '2026-10-22')).toEqual([]);
  });
  it('ein Schritt des Kunden wird aktuell bzw. steht neu auf „wartet auf Kunde“ — einmal, nicht noch einmal', () => {
    const vorher = stand({ aktiv: [{ id: 's1', kunde: false }] });
    const nachher = stand({ aktiv: [{ id: 's2', kunde: true }], knoten: [{ id: 's3', status: 'wartet_kunde' }] });
    const l = fallBegleitDiff(vorher, nachher, M, '2026-10-22');
    expect(l.map(e => [e.art, e.bezug.knotenId]).sort()).toEqual([['fall-wartet-kunde', 's2'], ['fall-wartet-kunde', 's3']]);
    expect(fallBegleitDiff(nachher, nachher, M, '2026-10-22')).toEqual([]);
  });
  it('Bestätigung neu → abstimmung-bestaetigt an der Phase, die sie trägt; Kennung je Bestätigung einmal (ohne Tag)', () => {
    const l = fallBegleitDiff(stand({}), stand({ freigaben: ['F0'], knoten: [{ id: 'p1', status: 'erledigt', freigabe: 'F0' }] }), M, '2026-10-22');
    expect(l).toEqual([expect.objectContaining({ art: 'abstimmung-bestaetigt', id: 'fall:m-b1:freigabe:F0', bezug: expect.objectContaining({ freigabeId: 'F0', knotenId: 'p1' }) })]);
  });
  it('Privat-Einheit → Bereich privat (Business-Prozesse hören nie darauf)', () => {
    const l = fallBegleitDiff(stand({}), stand({ freigaben: ['F0'] }), { ...M, gesellschaft: 'kdc' }, '2026-10-22');
    expect(l[0].bereich).toBe('privat');
  });
});

describe('haengerEreignisse (rein): je Hänger genau einmal', () => {
  it('Kennung aus Fall, Art, Knoten und „seit“ — ein neuer Report bzw. eine neue Frist ist ein neuer Hänger', () => {
    const a = haengerEreignisse([{ m: M, vorlageId: 'fp-x', haengt: [{ art: 'wartet', knotenId: 's2', seit: '2026-10-01' }, { art: 'report', seit: '2026-10-05T10:00:00.000Z' }] }]);
    expect(a.map(e => [e.art, e.stufe, e.id])).toEqual([
      ['fall-haengt', 'wartet', 'fall:m-b1:haengt:wartet:s2:2026-10-01'], ['fall-haengt', 'report', 'fall:m-b1:haengt:report:-:2026-10-05'],
    ]);
    const b = haengerEreignisse([{ m: M, vorlageId: 'fp-x', haengt: [{ art: 'report', seit: '2026-10-19' }] }]);
    expect(b[0].id).not.toBe(a[1].id);
  });
});

// ══ Über die Routen ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  return { status: r.status, j: (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {} };
}
const J = '2026-10-01T08:00:00.000Z';
const mandat = (id: string, x: Record<string, unknown> = {}) => ({
  id, kunde: `Probe ${id} GmbH`, firmaId: 'f-b1', kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'ug', status: 'aktiv', zustaendig: 'olaf',
  vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
  leistungen: [], offen: [], geaendert: J, ...x,
});
const u = (n: number) => `fk-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let vorlageId = '';
let heute = '';
const ereignisse = async () => (await (await import('@/lib/ereignisse/server')).ereignisseLaden()).eintraege.filter(e => e.bezug.mandatId === 'm-b1');
const faelleRoh = () => readFileSync(path.join(ordner, 'fulfillment-faelle--haus-b1.json'), 'utf8');

beforeAll(async () => {
  heute = (await import('@/lib/zeit')).localDay();
  const { tagPlus } = await import('@/lib/kalender/zeit');
  const d = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: 'haus-b1' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-b1' })], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-b1')] });
  await d.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  const neu = await rufe('fulfillment/editor', 'POST', sitzung('pia'), { aktion: 'neu', titel: 'Probe-Begleitung', phase: 'Start', anfrageId: 'b1-neu' });
  vorlageId = neu.j.vorlageId as string;
  const kn = (neu.j.vorlage as { knoten: { id: string; elternId?: string }[] }).knoten;
  const start = kn.find(x => x.elternId === kn.find(y => !y.elternId)!.id)!.id;
  const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId, stand: neu.j.stand, ops: [
    { op: 'schritt-neu', id: u(1), ziel: { phaseId: start }, form: 'schritt', titel: 'Unterlagen schicken', zustaendig: 'kunde', frist: 3 },
    { op: 'schritt-neu', id: u(2), ziel: { phaseId: start, nach: u(1) }, form: 'schritt', titel: 'Unterlagen prüfen' },
    { op: 'abstimmung', phaseId: start, an: true, titel: 'Freigabe', wer: 'kunde' },
    { op: 'phase-neu', id: u(3), titel: 'Umsetzung', nach: start },
    { op: 'schritt-neu', id: u(4), ziel: { phaseId: u(3) }, form: 'schritt', titel: 'Umsetzen' },
  ] });
  if (r.status !== 200) throw new Error(`Editor: ${r.status} ${JSON.stringify(r.j)}`);
  const st = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-b1', vorlageId, start: tagPlus(heute, -20), anfrageId: 'b1-start' });
  if (st.status !== 200) throw new Error(`Start: ${st.status} ${JSON.stringify(st.j)}`);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Fall-Ereignisse über die Schreibwege des Falls', () => {
  it('Fall starten → die erste Phase „begonnen“ (mit Paket im Bezug)', async () => {
    const l = await ereignisse();
    const b = l.filter(e => e.art === 'fall-phase' && e.stufe === 'begonnen');
    expect(b).toHaveLength(1);
    expect(b[0].bezug).toMatchObject({ mandatId: 'm-b1', vorlageId });
  });
  it('Onboarding entfällt → Onboarding „abgeschlossen“, Start „begonnen“, der Kunden-Schritt wartet auf den Kunden', async () => {
    const { MUSTER_ONBOARDING } = await import('@/lib/fulfillment/muster');
    const { obKnotenId } = await import('@/lib/fulfillment/prozesse/onboarding');
    const r = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-b1', ops: MUSTER_ONBOARDING.map(s => ({ op: 'knoten-status', id: obKnotenId(s.schluessel), status: 'entfaellt', grund: 'Probe ohne Onboarding' })) });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const l = await ereignisse();
    expect(l.filter(e => e.art === 'fall-phase' && e.stufe === 'abgeschlossen')).toHaveLength(1);
    expect(l.filter(e => e.art === 'fall-phase' && e.stufe === 'begonnen')).toHaveLength(2);
    expect(l.filter(e => e.art === 'fall-wartet-kunde').map(e => e.bezug.knotenId)).toEqual([u(1)]);
  });
  it('Schritte erledigt + Bestätigung → abstimmung-bestaetigt, Start abgeschlossen, Umsetzung begonnen', async () => {
    const r = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-b1', ops: [
      { op: 'knoten-status', id: u(1), status: 'erledigt' }, { op: 'knoten-status', id: u(2), status: 'erledigt' },
    ] });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const fall = (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle['m-b1'];
    const fg = fall.knoten.find(k => k.freigabe)!.freigabe!;
    const b = await rufe('fulfillment/fall', 'PATCH', sitzung('pia'), { mandatId: 'm-b1', ops: [{ op: 'freigabe', id: fg, kunde: { wie: 'mail' } }] });
    expect(b.status, JSON.stringify(b.j)).toBe(200);
    const l = await ereignisse();
    expect(l.filter(e => e.art === 'abstimmung-bestaetigt').map(e => e.bezug.freigabeId)).toEqual([fg]);
    expect(l.filter(e => e.art === 'fall-phase' && e.stufe === 'abgeschlossen').map(e => e.bezug.knotenId)).toContain(fall.knoten.find(k => k.freigabe === fg)!.id);
    expect(l.filter(e => e.art === 'fall-phase' && e.stufe === 'begonnen').map(e => e.bezug.knotenId)).toContain(u(3));
  });
  it('Morgenlauf → `fall-haengt` aus den Hängern des Cockpits; ein zweiter Lauf meldet nichts doppelt und lässt den Fall Byte für Byte (Gold)', async () => {
    const { prozesseMorgenlauf, cockpitDaten } = await import('@/lib/fulfillment/prozesse/server');
    const { zeilen } = await cockpitDaten(heute);
    const haenger = zeilen.find(z => z.mandatId === 'm-b1')!.haengt;
    expect(haenger.length).toBeGreaterThan(0);
    await prozesseMorgenlauf('haus-b1', heute);
    const n1 = (await ereignisse()).filter(e => e.art === 'fall-haengt');
    expect(n1.map(e => e.stufe).sort()).toEqual(haenger.map(h => h.art).sort());
    const fallVorher = faelleRoh();
    const alle = (await ereignisse()).length;
    await prozesseMorgenlauf('haus-b1', heute);
    expect((await ereignisse()).length).toBe(alle);
    expect(faelleRoh()).toBe(fallVorher);
  });
  it('Gold „Fall vorher = Fall nachher“: erneutes Melden ändert weder Fall noch Ereignisse (Kennung = dasselbe Ereignis)', async () => {
    const { fallEreignisse } = await import('@/lib/ereignisse/quellen');
    const fall = (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle['m-b1'];
    const vorher = faelleRoh();
    const json = JSON.stringify(fall);
    const n = (await ereignisse()).length;
    const leer = { ...fall, knoten: [], freigaben: {} };
    expect(await fallEreignisse(leer, fall, M, { vorher: leer, nachher: fall, heute })).toBe(0);
    expect(JSON.stringify(fall)).toBe(json);
    expect(faelleRoh()).toBe(vorher);
    expect((await ereignisse()).length).toBe(n);
  });
  it('kunde-geliefert: einmal je Eintrag; die vier Wege des Kunden-Links melden über EINE Stelle', async () => {
    const { kundeGeliefertEreignis } = await import('@/lib/ereignisse/quellen');
    expect(await kundeGeliefertEreignis(M, 'unterlage', 'ud-probe-1', vorlageId)).toBe(1);
    expect(await kundeGeliefertEreignis(M, 'unterlage', 'ud-probe-1', vorlageId)).toBe(0);
    expect((await ereignisse()).filter(e => e.art === 'kunde-geliefert')).toEqual([expect.objectContaining({ stufe: 'unterlage', bezug: expect.objectContaining({ vorlageId }) })]);
    const q = readFileSync(path.join(__dirname, '../lib/fulfillment/kunde/server.ts'), 'utf8');
    for (const was of ["geliefert(z.mandat, 'formular'", "geliefert(x.m, 'formular'", "geliefert(z.mandat, 'unterlage'", "geliefert(z.mandat, 'puls'"]) expect(q, was).toContain(was);
  });
});

describe('Motor: Begleit-Prozesse hören auf den Fall', () => {
  it('Ereignis-Auslöser „nur wenn Paket = …“: gültig, passt auf das Ereignis des Pakets, nicht auf ein anderes', async () => {
    const r = ausloeserAus({ art: 'ereignis', ereignis: 'fall-wartet-kunde', bedingungen: [{ feld: 'bezug.vorlageid', op: 'gleich', wert: vorlageId }] }, 'mandat');
    expect(r.befunde).toEqual([]);
    const e = (await ereignisse()).find(x => x.art === 'fall-wartet-kunde')!;
    expect(ausloeserPasst(r.ausloeser!, 'pz-egal', e, ereignisDaten(e))).toBe(true);
    const anders = ausloeserAus({ art: 'ereignis', ereignis: 'fall-wartet-kunde', bedingungen: [{ feld: 'bezug.vorlageid', op: 'gleich', wert: 'fp-anderes' }] }, 'mandat');
    expect(ausloeserPasst(anders.ausloeser!, 'pz-egal', e, ereignisDaten(e))).toBe(false);
  });
  it('Datums-Auslöser „nächster Termin mit dem Kunden“ (n Werktage vorher) mit „nur wenn Paket = …“ — ehrliche Quelle', () => {
    expect(datumsFelderFuer('mandat')).toContain('fall.termin');
    expect(DATUM_QUELLE['fall.termin']).toContain('Cockpit');
    const r = ausloeserAus({ art: 'datum', feld: 'fall.termin', versatzTage: -2, werktage: true, bedingungen: [{ feld: 'fall.paket', op: 'gleich', wert: vorlageId }] }, 'mandat');
    expect(r.befunde).toEqual([]);
  });
  it('Fall-Felder aus der Rechnung des Cockpits: Paket und Status je laufendem Business-Fall', async () => {
    const { faelleFuerProzesse } = await import('@/lib/fulfillment/prozesse/server');
    expect((await faelleFuerProzesse(heute))['m-b1']).toMatchObject({ paket: vorlageId, status: 'laeuft' });
  });
});
