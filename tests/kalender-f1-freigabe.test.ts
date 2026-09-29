// ─── F1 (Gesamtprüfung Prüfer 1, 29.09.): Freigabe einer Buchung — doppelt (#1) und gegen die Absage (#2) ───────────
// Belege des Prüfers als echte Tests, die nach dem Fix das RICHTIGE Verhalten prüfen:
//   #1 Zwei Freigaben gleichzeitig (Doppelklick, Kevin + Malin) → EIN Termin, die zweite bekommt 409; ein zweiter Klick
//      nach getaner Freigabe tut nichts; die feste UID (`buchungTerminUid`) macht auch eine Wiederaufnahme idempotent.
//   #2 Der Gast sagt ab, während die Freigabe läuft → Absicht „verworfen“, Status bleibt „abgesagt“, kein Termin, kein
//      Kontakt; lag der Termin schon in iCloud → Glocke „Termin entfernen?“, Verweis an der Buchung, nie automatisch
//      gelöscht. Die Wiederaufnahme im Takt prüft dasselbe.
// Eigener Datenordner, iCloud gemockt (mit echter If-None-Match-Logik für feste UIDs), alle Namen/Adressen erfunden.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { BuchungBestand } from '@/lib/kalender/buchung';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-freigabe-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-f1-freigabe';
process.env.SESSION_SECRET = 'pruef-sitzung-f1-freigabe-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-f1-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-f1-nur-im-test-0123456789abcdef';

const ic = vi.hoisted(() => ({
  termine: [] as { uid: string; id: string; titel: string; start: string; ende: string; ganztags: boolean; kalender: string; notiz?: string; art: string; beschaeftigt: boolean }[],
  puts: 0, angelegt: 0,
  /** Wird im erzwungenen Abgleich der Freigabe ausgeführt (dort sagt der Gast ab). */
  beimZwang: null as null | (() => Promise<void>),
  /** Wird direkt NACH dem Anlegen im iCloud-Mock ausgeführt (Absage zwischen Termin und Buchung). */
  nachAnlegen: null as null | (() => Promise<void>),
  meldungen: [] as { an: string; titel: string; bezug?: { art: string; id: string } }[],
}));
const stand = () => ({ at: new Date().toISOString(), kalender: [], objekte: {} });
vi.mock('@/lib/kalender/icloud', async () => ({
  CACHE: 'calendar-cache', SPEICHER: 'kalender-icloud',
  abgleichAlter: (await vi.importActual<typeof import('@/lib/kalender/icloud')>('@/lib/kalender/icloud')).abgleichAlter,
  holfenster: () => ({ von: '2026-07-01', bis: '2027-11-01' }),
  objekteKurz: () => ic.termine.map(t => ({ uid: t.uid, schluessel: t.id, tag: t.start.slice(0, 10), zusatz: null })),
  verbunden: () => true,
  ladeStand: async () => stand(), frischerStand: async () => stand(),
  abgleichen: async (opt: { erzwingen?: boolean } = {}) => { if (opt.erzwingen && ic.beimZwang) { const f = ic.beimZwang; ic.beimZwang = null; await f(); } return stand(); },
  termineImZeitraum: (_s: unknown, von: string, bis: string) => ic.termine.filter(t => t.start.slice(0, 10) < bis && t.ende.slice(0, 10) >= von).map(t => ({ ...t, href: '', kalenderId: '', serie: false, mitTeilnehmern: false, bearbeitbar: true })),
  // Wie iCloud: eine feste UID gibt es nur einmal (PUT mit If-None-Match → `schonDa`). Der PUT dauert (50 ms).
  anlegen: async (e: { uid?: string; titel: string; kalender: string; start: string; ende: string; notiz?: string; art?: string; beschaeftigt?: boolean }) => {
    ic.puts++;
    const da = e.uid ? ic.termine.find(t => t.uid === e.uid) : undefined;
    if (da) return { uid: da.uid, schluessel: da.id, kalender: da.kalender, gaeste: 0, schonDa: true };
    await new Promise(r => setTimeout(r, 50));
    const schon = e.uid ? ic.termine.find(t => t.uid === e.uid) : undefined;
    if (schon) return { uid: schon.uid, schluessel: schon.id, kalender: schon.kalender, gaeste: 0, schonDa: true };
    ic.angelegt++;
    const uid = e.uid ?? `UID-F1-${ic.angelegt}`, schluessel = `testkal|${uid}`;
    ic.termine.push({ uid, id: schluessel, titel: e.titel, start: e.start, ende: e.ende, ganztags: false, kalender: e.kalender, notiz: e.notiz, art: e.art ?? 'termin', beschaeftigt: e.beschaeftigt ?? true });
    if (ic.nachAnlegen) { const f = ic.nachAnlegen; ic.nachAnlegen = null; await f(); }
    return { uid, schluessel, kalender: e.kalender, gaeste: 0 };
  },
}));
vi.mock('@/lib/kalender/zugang', () => ({
  KEIN_KALENDER: { ok: false, fehler: 'Kein Zugang.' },
  kalenderZugang: async (req: Request) => { const p = req.headers.get('x-make-user'); return p === 'kevin' || p === 'malin' ? { person: p, dienst: false } : null; },
}));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; titel: string; bezug?: { art: string; id: string } }) => { ic.meldungen.push({ an: m.an, titel: m.titel, ...(m.bezug ? { bezug: m.bezug } : {}) }); } }));

type Ctx = { params: Promise<{ slug: string }> };
type Route = { GET?: (r: Request, c: Ctx) => Promise<Response>; POST?: (r: Request, c: Ctx) => Promise<Response> };
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let verwaltung: { POST: (r: Request) => Promise<Response> }, oeffentlich: Route, status: Route;
let SLUG = '';
const HAUS = 'test-haus-f1';
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const verwalten = async (body: Record<string, unknown>, wer = 'kevin') => { const r = await verwaltung.POST(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': wer }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as J }; };
const statusAktion = async (token: string, aktion: string) => { const r = await status.POST!(new Request(`http://test/api/buchung/${SLUG}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, aktion }) }), ctx(SLUG)); return { status: r.status, d: await r.json() as J }; };
const bestand = async () => (await db.loadJson<BuchungBestand>(`buchung--${HAUS}`))!;
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
let uhr = new Date('2026-10-05T06:00:00Z').getTime();
const weiter = (s: number) => { uhr += s * 1000; vi.setSystemTime(new Date(uhr)); };

/** Buchen + bestätigen → { id, token } einer angefragten Buchung. */
async function anfragen(start: string, email: string): Promise<{ id: string; token: string }> {
  const { stempel } = await (await oeffentlich.GET!(new Request(`http://test/api/buchung/${SLUG}`), ctx(SLUG))).json() as J;
  weiter(5);
  const r = await oeffentlich.POST!(new Request(`http://test/api/buchung/${SLUG}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start, name: 'Testa Gast', email, einwilligung: true, stempel }) }), ctx(SLUG));
  const d = await r.json() as J;
  expect(r.status, JSON.stringify(d)).toBe(201);
  drossel._zuruecksetzen();
  expect((await statusAktion(d.token, 'bestaetigen')).d.sicht.status).toBe('angefragt');
  return { id: (await bestand()).buchungen.find(x => x.email === email)!.id, token: d.token };
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(uhr));
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@example.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  verwaltung = await import('@/app/api/kalender/buchung/route');
  oeffentlich = await import('@/app/api/buchung/[slug]/route');
  status = await import('@/app/api/buchung/[slug]/status/route');
  const r = await verwalten({ aktion: 'seite', seite: { titel: 'Erstgespraech', person: 'kevin', dauerMin: 30, fenster: [{ tage: [1, 2, 3, 4, 5, 6, 7], von: '09:00', bis: '12:00' }], tageVoraus: 7, vorlaufMin: 0, maxJeTag: 10, pufferMin: 0, rasterMin: 30, zielKalender: 'Testkalender', verantwortlich: 'Probe GmbH, x@example.invalid' } });
  SLUG = r.d.seite.slug;
});
afterEach(() => { drossel._zuruecksetzen(); ic.beimZwang = null; ic.nachAnlegen = null; });
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('#1 Doppelte Freigabe → ein Termin, eine Einladung', () => {
  it('zwei Freigaben gleichzeitig (Kevin + Malin): ein Termin mit fester UID, die zweite 409 „läuft schon“', async () => {
    const { buchungTerminUid } = await import('@/lib/kalender/buchung');
    const { id } = await anfragen('2026-10-06T10:00:00', 'doppel@example.invalid');
    // Nachtrag F1: die Glocke „Neue Terminanfrage“ trägt den Bezug zur Buchung (wird nach der Entscheidung erledigt).
    expect(ic.meldungen.find(m => /Neue Terminanfrage/.test(m.titel))?.bezug).toEqual({ art: 'buchung', id });
    const vorher = ic.angelegt;
    const [a, b] = await Promise.all([verwalten({ aktion: 'freigeben', id }), verwalten({ aktion: 'freigeben', id }, 'malin')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((a.status === 409 ? a : b).d.laeuft).toBe(true);
    expect(ic.angelegt - vorher).toBe(1);
    const x = (await bestand()).buchungen.find(y => y.id === id)!;
    expect(x.status).toBe('bestaetigt');
    expect(x.terminUid).toBe(`testkal|${buchungTerminUid(id)}`);
  });

  it('zweiter Klick nach getaner Freigabe: 200, nichts doppelt (Termin, Aktivität, Follow-up)', async () => {
    const { id } = await anfragen('2026-10-06T11:00:00', 'nochmal@example.invalid');
    expect((await verwalten({ aktion: 'freigeben', id })).status).toBe(200);
    const puts = ic.puts, angelegt = ic.angelegt;
    const crmVorher = (await db.loadJson<{ followups: unknown[] }>('crm'))!.followups.length;
    expect((await verwalten({ aktion: 'freigeben', id })).status).toBe(200);
    expect(ic.angelegt).toBe(angelegt);
    expect(ic.puts).toBe(puts);
    expect((await db.loadJson<{ followups: unknown[] }>('crm'))!.followups.length).toBe(crmVorher);
    const kontaktId = (await bestand()).buchungen.find(z => z.id === id)!.kontaktId;
    const k = (await kontakte()).find(y => y.id === kontaktId)!;
    expect(k.aktivitaeten.filter(a => a.art === 'termin')).toHaveLength(1);
    // N10: mit Termin-Verweis kein kopiertes Datum im Text (die Akte liest die Zeit aus dem Termin).
    expect(k.aktivitaeten.find(a => a.art === 'termin')!.text).not.toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  it('Wiederaufnahme nach Absturz NACH dem PUT: dieselbe feste UID → `schonDa`, kein zweiter Termin', async () => {
    const ab = await import('@/lib/store/absichten');
    const fort = await import('@/lib/store/absichten-fortsetzen');
    const { id } = await anfragen('2026-10-07T09:00:00', 'absturz@example.invalid');
    const vorher = ic.angelegt;
    // Die Marke in der Notiz verschwindet (am iPhone bearbeitet) — wiedererkannt wird der Termin allein über die UID.
    ic.nachAnlegen = async () => { const t = ic.termine[ic.termine.length - 1]; t.notiz = 'am iPhone überschrieben'; };
    ab.absichtTest.vorAbhaken = (art, name) => { if (art === 'buchung' && name === 'termin') throw new ab.TestAbbruch(name); };
    const f = await verwalten({ aktion: 'freigeben', id });
    ab.absichtTest.vorAbhaken = null;
    expect(f.status).toBe(502);
    const puts = ic.puts;
    expect((await fort.offeneFertigstellen()).fehler).toEqual([]);
    expect(ic.puts).toBe(puts + 1); // noch einmal versucht …
    expect(ic.angelegt - vorher).toBe(1); // … aber nicht noch einmal angelegt
    expect((await bestand()).buchungen.find(y => y.id === id)!.status).toBe('bestaetigt');
  });
});

describe('#2 Freigabe gegen Absage / Ablehnung / Ablauf', () => {
  it('Gast sagt während des erzwungenen Abgleichs ab → 409 verworfen, Status bleibt „abgesagt“, kein Termin, kein Kontakt', async () => {
    const ab = await import('@/lib/store/absichten');
    const { id, token } = await anfragen('2026-10-08T09:00:00', 'absage.frueh@example.invalid');
    const vorher = ic.angelegt, kontakteVorher = (await kontakte()).length;
    ic.beimZwang = async () => { expect((await statusAktion(token, 'absagen')).d.sicht.status).toBe('abgesagt'); };
    const f = await verwalten({ aktion: 'freigeben', id });
    expect(f.status).toBe(409);
    expect(f.d.verworfen).toBe(true);
    const x = (await bestand()).buchungen.find(y => y.id === id)!;
    expect(x.status).toBe('abgesagt');
    expect(x.terminUid).toBeUndefined();
    expect(ic.angelegt).toBe(vorher);
    expect((await kontakte()).length).toBe(kontakteVorher);
    const a = (await ab.absichtenLaden(HAUS)).filter(y => y.art === 'buchung').pop()!;
    expect(a.status).toBe('verworfen');
  });

  it('Absage zwischen Termin und Statuswechsel → Termin bleibt stehen, Glocke „Termin entfernen?“, Verweis an der Buchung', async () => {
    const { id, token } = await anfragen('2026-10-08T10:00:00', 'absage.spaet@example.invalid');
    const vorher = ic.angelegt;
    ic.meldungen.length = 0;
    ic.nachAnlegen = async () => { expect((await statusAktion(token, 'absagen')).d.sicht.status).toBe('abgesagt'); };
    const f = await verwalten({ aktion: 'freigeben', id });
    expect(f.status).toBe(409);
    expect(ic.angelegt - vorher).toBe(1); // angelegt, bevor die Absage kam — und NICHT gelöscht
    const x = (await bestand()).buchungen.find(y => y.id === id)!;
    expect(x.status).toBe('abgesagt');
    expect(x.terminUid).toBeTruthy();
    expect(ic.meldungen.some(m => m.an === 'kevin' && /Termin entfernen\?/.test(m.titel))).toBe(true);
    // „Termin entfernen“ (#12): danach wird der Verweis gelöst; an einer bestätigten Buchung nie.
    expect((await verwalten({ aktion: 'termin-geloest', id })).status).toBe(200);
    expect((await bestand()).buchungen.find(y => y.id === id)!.terminUid).toBeUndefined();
    const best = (await bestand()).buchungen.find(y => y.status === 'bestaetigt')!;
    expect((await verwalten({ aktion: 'termin-geloest', id: best.id })).status).toBe(409);
  });

  it('abgelehnt, während die Wiederaufnahme wartet → Takt verwirft, kein Termin, Status bleibt', async () => {
    const ab = await import('@/lib/store/absichten');
    const fort = await import('@/lib/store/absichten-fortsetzen');
    const { id } = await anfragen('2026-10-08T11:00:00', 'abgelehnt@example.invalid');
    const vorher = ic.angelegt;
    ab.absichtTest.nachAbhaken = (art, name) => { if (art === 'buchung' && name === 'kontakt') throw new ab.TestAbbruch(name); };
    expect((await verwalten({ aktion: 'freigeben', id })).status).toBe(502);
    ab.absichtTest.nachAbhaken = null;
    // Malin lehnt ab, bevor der Takt die Freigabe fortsetzt.
    expect((await verwalten({ aktion: 'ablehnen', id }, 'malin')).status).toBe(200);
    expect((await fort.offeneFertigstellen()).fehler).toEqual([]);
    expect(ic.angelegt).toBe(vorher);
    expect((await bestand()).buchungen.find(y => y.id === id)!.status).toBe('abgelehnt');
    expect((await ab.absichtenLaden(HAUS)).filter(ab.istOffen)).toHaveLength(0);
  });
});
