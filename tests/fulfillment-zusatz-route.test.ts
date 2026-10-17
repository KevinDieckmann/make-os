// ─── Fulfillment — Zusatzmodul und vollständiger Import über die Routen (17.10. spät) ──────────────────────────────────────────────────────
// Kevin: „Das Fulfillment soll maximal einfach für uns sein.“ Über die echten Routen in einem eigenen Datenordner (erfundene Konten @example.invalid, kein Netz):
//   · Import (Vorschau → Übernehmen): Bausteine mit „siehe auch“, Pakete mit Versuchen, Lage, Pfeil-Beschriftung und `zusatz`.
//   · „Starten“ eines Zusatzmoduls an einem Mandat mit laufendem Fall: KEIN zweiter Fall, kein zweites Onboarding — angehängt, Aufgabe für den ersten Schritt;
//     ohne laufenden Fall: ein Fall ohne Onboarding. GET zeigt Zusatzmodule, Abstimmungspunkte beider, kein Onboarding-Stand beim Modul-Fall.
//   · Neue Fassung des Moduls: Diff im Fall, Übernahme per Klick. Der Editor-Schalter „Zusatzmodul“ ist keine neue Fassung. Dienstweg startet nie.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ff-zusatz-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-zusatz';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
async function rufe(pfad: string, methode: string, kopf: Record<string, string>, body?: unknown, suche = ''): Promise<{ status: number; j: Record<string, unknown> }> {
  const m = await import(`@/app/api/${pfad}/route`) as Record<string, H>;
  const r = await m[methode](new Request(`http://test/api/${pfad}${suche}`, { method: methode, headers: kopf, ...(methode === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
  const j = (r.headers.get('content-type') ?? '').includes('json') ? await r.json() as Record<string, unknown> : {};
  return { status: r.status, j };
}
async function importiere(datei: string, inhalt: unknown): Promise<Record<string, unknown>> {
  const text = JSON.stringify(inhalt);
  const v = await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'vorschau', datei, inhalt: text });
  expect(v.status, JSON.stringify(v.j)).toBe(200);
  const u = await rufe('fulfillment/import', 'POST', sitzung('pia'), { aktion: 'uebernehmen', datei, inhalt: text, vorschauId: v.j.vorschauId, wahl: {} });
  expect(u.status, JSON.stringify(u.j)).toBe(200);
  return v.j.vorschau as Record<string, unknown>;
}

const J = '2026-10-01T08:00:00.000Z';
const mandat = (id: string) => ({
  id, kunde: `Probe ${id} GmbH`, kontaktIds: ['c-probe'], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'ug', status: 'aktiv', zustaendig: 'olaf',
  vertragUnterschrieben: true, start: '2026-09-20', verlaengerung: 'manuell', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19,
  rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null },
  leistungen: [], offen: [], geaendert: J,
});
const BAUSTEINE = { vorlagen: [
  { id: 'probe-leitfaden', art: 'skript', titel: 'Probe-Leitfaden', zweck: 'Erfunden.', siehe_auch: ['probe-einwand'] },
  { id: 'probe-einwand', art: 'dokument', titel: 'Probe-Einwände', zweck: 'Erfunden.', siehe_auch: ['probe-leitfaden'] },
] };
const PAKETE = { format: 'make-os/pakete', pakete: [
  { schluessel: 'probe-paket', titel: 'Probe-Paket', abstimmungen: [{ id: 'F0', titel: 'Rahmen', wer: 'beide' }],
    phasen: [{ id: 'p1', titel: 'Analyse', abstimmung: 'F0', fluss: [{ id: 'a1', titel: 'Außensicht', frist: 1 }] }] },
  { schluessel: 'probe-telefonie', titel: 'Probe-Telefonie', zusatz: true, abstimmungen: [{ id: 'T1', titel: 'Liste freigegeben', wer: 'beide' }],
    phasen: [{ id: 't1', titel: 'Liste vorbereiten', abstimmung: 'T1', dauerTage: 7, pos: { x: 0, y: 0, b: 600, h: 400 }, fluss: [
      { id: 'tl', titel: 'Liste aufbauen', frist: 0, bausteine: ['probe-leitfaden'] },
      { id: 'te', titel: 'Erreicht?', form: 'entscheidung', frist: 1, zweige: { nein: 'tv' }, pfeilText: { nein: 'nicht erreicht' } },
      { id: 'tv', titel: 'Nächster Versuch', form: 'erinnerung', versuche: 5, zweige: { ja: 'te' } },
    ] }] },
] };

interface Kn { id: string; titel: string; zusatz?: string; status: string; versuche?: number }
const db = () => import('@/lib/store/local-db');
const fallRoh = async (m: string) => (await (await import('@/lib/fulfillment/speicher')).fulfillmentLesen('faelle')).faelle[m];
let paketId = '', telefonId = '';

beforeAll(async () => {
  const d = await db();
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-z' });
  await d.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber'), konto('k2', 'olaf', 'mitglied')], einladungen: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await d.saveJson('crm', { ...leererBestand(), mandate: [mandat('m-haupt'), mandat('m-nur-modul')] });
  await d.saveJson('kontakte', { kontakte: [{ id: 'c-probe', vorname: 'Testa', nachname: 'Probe', email: 'testa@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await importiere('bausteine.json', BAUSTEINE);
  const v = await importiere('ablaeufe.json', PAKETE);
  expect((v.hinweise as string[]).some(h => /Zusatzmodul/.test(h))).toBe(true);
  const ue = await rufe('fulfillment', 'GET', sitzung('pia'));
  const prozesse = ue.j.prozesse as { id: string; titel: string; zusatz?: true; knoten: { titel: string; versuche?: number; pos?: unknown; pfeilText?: unknown }[] }[];
  paketId = prozesse.find(p => p.titel === 'Probe-Paket')!.id;
  const tel = prozesse.find(p => p.titel === 'Probe-Telefonie')!;
  telefonId = tel.id;
  expect(tel.zusatz).toBe(true);
  expect(tel.knoten.find(k => k.titel === 'Nächster Versuch')!.versuche).toBe(5);
  expect(tel.knoten.find(k => k.titel === 'Erreicht?')!.pfeilText).toEqual({ nein: 'nicht erreicht' });
  expect(tel.knoten.find(k => k.titel === 'Liste vorbereiten')!.pos).toEqual({ x: 0, y: 0, b: 600, h: 400 });
  const b = ue.j.bausteine as { id: string; sieheAuch?: string[] }[];
  expect(b.find(x => x.id === 'fb-imp-probe-leitfaden')!.sieheAuch).toEqual(['fb-imp-probe-einwand']);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Zusatzmodul über die Routen', () => {
  it('am Mandat mit laufendem Fall: angehängt — derselbe Fall, kein zweites Onboarding, Aufgabe für den ersten Schritt des Moduls', async () => {
    const a = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-haupt', vorlageId: paketId, anfrageId: 'z-start-haupt' });
    expect(a.status, JSON.stringify(a.j)).toBe(200);
    const vorher = await fallRoh('m-haupt');
    const ob = vorher.knoten.filter(k => k.id.startsWith('fk-ob-')).length;
    expect(ob).toBe(8);
    // Der Dienstweg startet nie.
    expect((await rufe('fulfillment/fall', 'POST', dienst('pia'), { aktion: 'starten', mandatId: 'm-haupt', vorlageId: telefonId, anfrageId: 'z-dienst' })).status).toBe(403);
    const z = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-haupt', vorlageId: telefonId, start: '2026-10-17', anfrageId: 'z-start-tel' });
    expect(z.status, JSON.stringify(z.j)).toBe(200);
    expect(z.j).toMatchObject({ angehaengt: true, text: expect.stringContaining('ohne zweites Onboarding') });
    const f = await fallRoh('m-haupt');
    expect(f.vorlageId).toBe(paketId);
    expect(f.knoten.filter(k => k.id.startsWith('fk-ob-')).length).toBe(ob);
    expect(f.zusaetze?.map(x => x.vorlageId)).toEqual([telefonId]);
    expect((f.knoten as Kn[]).filter(k => k.zusatz === telefonId).map(k => k.titel)).toEqual(['Liste vorbereiten']);
    expect((f.knoten as Kn[]).find(k => k.titel === 'Nächster Versuch')!.versuche).toBe(5);
    // Nichts vom bisherigen Fall ist verloren.
    for (const k of vorher.knoten) expect(f.knoten.some(x => x.id === k.id), k.titel).toBe(true);
    // Ein zweites Mal: abgelehnt.
    const noch = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-haupt', vorlageId: telefonId, anfrageId: 'z-start-tel-2' });
    expect(noch.status).toBe(409);
    // Ausführung: der erste Schritt des Moduls ist eine Aufgabe (der Abschnitt läuft neben dem Onboarding des Pakets).
    const tasks = ((await (await db()).loadJson<{ tasks: { id: string; title: string; bezug?: { mandatId?: string } }[] }>('tasks'))?.tasks ?? []).filter(t => t.id.startsWith('ff-ab-'));
    expect(tasks.map(t => t.title)).toContain('Liste aufbauen — Probe m-haupt GmbH');
  });
  it('GET: Zusatzmodule, Abstimmungspunkte beider, die Reise markiert den Abschnitt', async () => {
    const g = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-haupt');
    expect(g.status).toBe(200);
    expect((g.j.vorlage as { freigaben: { id: string }[] }).freigaben.map(x => x.id)).toEqual(['F0', 'T1']);
    expect(g.j.zusaetze).toEqual([{ vorlageId: telefonId, titel: 'Probe-Telefonie', startAm: '2026-10-17', fassung: expect.any(Number), diff: null }]);
    expect(g.j.onboarding).toBeTruthy();
    const { fallReise } = await import('@/lib/fulfillment/prozesse/reise');
    const fall = g.j.fall as Parameters<typeof fallReise>[0];
    const r = fallReise(fall, (g.j.vorlage as { freigaben: { id: string; titel: string; wer: 'beide' }[] }).freigaben, '2026-10-17');
    expect(r.phasen.filter(p => p.modul).map(p => [p.titel, p.zustand])).toEqual([['Liste vorbereiten', 'jetzt']]);
  });
  it('ohne laufenden Fall: ein Fall OHNE Onboarding — läuft sofort, GET ohne Onboarding-Stand', async () => {
    const a = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'starten', mandatId: 'm-nur-modul', vorlageId: telefonId, anfrageId: 'z-start-nur' });
    expect(a.status, JSON.stringify(a.j)).toBe(200);
    expect(a.j.angehaengt).toBeUndefined();
    const f = await fallRoh('m-nur-modul');
    expect(f).toMatchObject({ vorlageId: telefonId, status: 'laeuft', ohneOnboarding: true });
    expect(f.knoten.some(k => k.id.startsWith('fk-ob'))).toBe(false);
    const g = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-nur-modul');
    expect(g.j.onboarding).toBeUndefined();
    expect(g.j.zusaetze).toEqual([]);
  });
  it('neue Fassung des Moduls: Diff im Fall, Übernahme per Klick; der Schalter „Zusatzmodul“ allein ist keine neue Fassung', async () => {
    const ed = await rufe('fulfillment/editor', 'GET', sitzung('pia'), undefined, `?v=${telefonId}`);
    expect(ed.status, JSON.stringify(ed.j)).toBe(200);
    const v = ed.j.vorlage as { fassung: number; knoten: { id: string; titel: string; elternId?: string }[] };
    // Schalter aus und wieder an: Fassung bleibt.
    let st = ed.j.stand as string;
    for (const an of [false, true]) {
      const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: telefonId, stand: st, ops: [{ op: 'zusatz', an }] });
      expect(r.status, JSON.stringify(r.j)).toBe(200);
      expect((r.j.vorlage as { fassung: number }).fassung).toBe(v.fassung);
      st = r.j.stand as string;
    }
    const phase = v.knoten.find(k => k.titel === 'Liste vorbereiten')!;
    const r = await rufe('fulfillment/editor', 'PATCH', sitzung('pia'), { vorlageId: telefonId, stand: st, ops: [{ op: 'schritt-neu', id: 'fk-00000000-0000-4000-8000-000000000123', ziel: { phaseId: phase.id }, form: 'schritt', titel: 'Liste prüfen' }] });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const g = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-haupt');
    const z = (g.j.zusaetze as { diff: { neu: { titel: string }[] } | null }[])[0];
    expect(z.diff?.neu.map(x => x.titel)).toEqual(['Liste prüfen']);
    expect(g.j.diff).toBeNull();
    const u = await rufe('fulfillment/fall', 'POST', sitzung('pia'), { aktion: 'vorlage-uebernehmen', mandatId: 'm-haupt', vorlageId: telefonId });
    expect(u.status, JSON.stringify(u.j)).toBe(200);
    const f = await fallRoh('m-haupt');
    expect(f.knoten.some(k => k.titel === 'Liste prüfen')).toBe(true);
    const g2 = await rufe('fulfillment/fall', 'GET', sitzung('pia'), undefined, '?m=m-haupt');
    expect((g2.j.zusaetze as { diff: unknown }[])[0].diff).toBeNull();
  });
});
