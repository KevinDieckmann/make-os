// ─── Netzwerken ↔ Events ↔ Make.One — die Verbindungen (03.10., Branch netz-verbind) ─────────
// Echter Datenordner (temporär), zwei Konten im Haushalt, erfundene Personen (@example.invalid). Geprüft je Punkt des Prüfberichts:
//   H1  gelöschtes Event: die Erfassung legt es aus `eventNeu` neu an (auch nach abgehaktem Schritt) · „Anderes Event wählen“ in der Warteschlange
//   H2  `lokal` live abgeleitet · „für wen“ wartender Erfassungen umschreiben
//   H3  Make.One bidirektional: Link, echter Stand, Herkunft, Werbesperre, Personen-Schranke für Funktions-Änderungen, ein `gastVormerken`
//   M7  Event-Dubletten · N4 abgesagtes Event, Datum
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-netz-verbind-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-netz-verbind';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Kontakt = import('@/lib/make-one/crm').Kontakt;
type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let route: Mod;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let test: typeof import('@/lib/crm/netzwerken-server').netzwerkenTest;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 1, 2, 3, 4, 5, 6, 7, 8]).toString('base64');
const kopf = (u: string) => ({ 'content-type': 'application/json', 'x-make-user': u });
type Antwort = Record<string, unknown> & { ok: boolean; kontaktId?: string; fehler?: string; hinweise?: string[]; schonDa?: boolean; eventId?: string; makeoneEventId?: string; eventFehler?: boolean; eventBesuch?: boolean };
const senden = async (body: unknown, user = 'kevin') => {
  const r = await route.POST(new Request('http://test/api/netzwerken', { method: 'POST', headers: kopf(user), body: JSON.stringify(body) }));
  return { status: r.status, d: await r.json() as Antwort };
};
const erfassung = (x: Record<string, unknown> = {}) => ({
  erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-test-1',
  kontakt: { vorname: 'Anna', nachname: 'Beispiel', firma: 'Beispielwerk Nord GmbH', email: 'anna.beispiel@example.invalid', anrede: 'Du' },
  bilder: [{ name: 'vorderseite.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'nur-kontakt', zustaendig: 'kevin', ...x,
});
const kontakte = async () => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []);
const crm = () => speicher.ladeCrm();
const EVENT = { id: 'ev-test-1', titel: 'Stammtisch Beispielstadt', format: 'sonstig', ziel: 'Gespräche', datum: '2026-10-02', status: 'geplant', marke: 'Netzwerken', geaendert: '2026-09-01' };
const MAKEONE = { id: 'ev-makeone-1', titel: 'Make.One Herbst', format: 'stammtisch', ziel: 'Gespräche', datum: '2026-10-20', status: 'geplant', geaendert: '2026-09-01' };

async function frisch(events: object[] = [EVENT, MAKEONE], extra: Record<string, unknown> = {}) {
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', { ...speicher.leererBestand(), events, ...extra });
  for (const n of ['crm-dateien--test-haus', 'netzwerken-erfassungen--test-haus', 'meldungen--malin', 'meldungen--kevin', 'tasks', 'absichten--test-haus']) {
    await db.saveJson(n, n.startsWith('crm-dateien') || n.startsWith('netzwerken') ? { eintraege: [] } : n.startsWith('meldungen') ? { eintraege: [], einstellungen: { telegram: false } } : n === 'tasks' ? { projects: [], tasks: [] } : { absichten: [] });
  }
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  test = (await import('@/lib/crm/netzwerken-server')).netzwerkenTest;
  route = (await import('@/app/api/netzwerken/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T09:00:00+02:00'));
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  const k = (id: string, s: string, rolle: string, haushalt: string) => ({ id, speicher: s, email: `${s}@test`, name: s === 'kevin' ? 'Kevin Test' : s === 'malin' ? 'Malin Test' : s, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'test-haus'), k('k2', 'malin', 'mitglied', 'test-haus')], einladungen: [] });
  test.nachSchritt = null; test.vorAbhaken = null;
  await frisch();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('H1 · gelöschtes Event hängt die Erfassung nicht mehr', () => {
  it('Event fehlt, `eventNeu` steht im Körper: der Server legt es neu an (Titel, Datum, Ort, für wen) und die Erfassung geht durch', async () => {
    await frisch([MAKEONE], { firmen: [{ id: 'f-kunde-a', name: 'Kunde A', rolle: 'kunde', geaendert: '2026-09-01' }] });
    const r = await senden(erfassung({ eventNeu: { titel: 'Stammtisch Beispielstadt', datum: '2026-10-02', ort: 'Köln', fuer: { art: 'kunde', firmaId: 'f-kunde-a' } } }));
    expect(r.status).toBe(200);
    const e = (await crm()).events.find(x => x.id === 'ev-test-1')!;
    expect(e).toMatchObject({ titel: 'Stammtisch Beispielstadt', ort: 'Köln', marke: 'Netzwerken', fuer: { art: 'kunde', firmaId: 'f-kunde-a' } });
    expect((await crm()).teilnahmen).toHaveLength(1);
    expect(r.d.eventBesuch).toBe(true);
  });

  it('Event nach abgehaktem Schritt „event“ gelöscht: Neuanlage aus `eventNeu`, Teilnahme entsteht trotzdem', async () => {
    const e = erfassung({ eventNeu: { titel: 'Stammtisch Beispielstadt', datum: '2026-10-02' } });
    // Abbruch nach dem Schritt „event“ …
    test.nachSchritt = s => { if (s === 'event') throw new Error('Testabbruch'); };
    expect((await senden(e)).status).toBe(500);
    test.nachSchritt = null;
    // … währenddessen wird das Event am Rechner gelöscht (Kaskade) …
    await db.saveJson('crm', { ...speicher.leererBestand(), events: [MAKEONE] });
    // … die Wiederholung legt es neu an und die Person hängt daran.
    const r = await senden(e);
    expect(r.status).toBe(200);
    expect(r.d.hinweise?.some(h => h.includes('neu angelegt'))).toBe(true);
    const c = await crm();
    expect(c.events.some(x => x.id === 'ev-test-1')).toBe(true);
    expect(c.teilnahmen.filter(t => t.eventId === 'ev-test-1')).toHaveLength(1);
  });

  it('ohne `eventNeu` (älterer Körper) bleibt es beim 404 — mit dem Merker `eventFehler` für „Anderes Event wählen“', async () => {
    await frisch([MAKEONE]);
    const r = await senden(erfassung());
    expect(r.status).toBe(404);
    expect(r.d.eventFehler).toBe(true);
  });
});

describe('N4 · abgesagtes Event, unplausibles Datum', () => {
  it('Erfassung bei abgesagtem Event → 409 „abgesagt“, nichts angelegt', async () => {
    await frisch([{ ...EVENT, status: 'abgesagt', anmeldung: 'abgesagt' }]);
    const r = await senden(erfassung());
    expect(r.status).toBe(409);
    expect(r.d.fehler).toContain('abgesagt');
    expect(r.d.eventFehler).toBe(true);
    expect(await kontakte()).toHaveLength(0);
    expect((await crm()).teilnahmen).toHaveLength(0);
  });
  it('`eventNeu` mit Datum über ein Jahr entfernt wird nicht angelegt (400) — ein existierendes Event mit fernem Datum bleibt wählbar', async () => {
    await frisch([MAKEONE]);
    const r = await senden(erfassung({ eventNeu: { titel: 'Messe Irgendwo', datum: '2028-10-02' }, eventId: 'ev-fern-1' }));
    expect(r.status).toBe(400);
    expect((await crm()).events.some(x => x.id === 'ev-fern-1')).toBe(false);
    await frisch([MAKEONE, { ...EVENT, id: 'ev-fern-2', datum: '2028-10-02', status: 'geplant' }]);
    const ok = await senden(erfassung({ eventId: 'ev-fern-2', eventNeu: { titel: 'Stammtisch Beispielstadt', datum: '2028-10-02' } }));
    expect(ok.status).toBe(200);
  });
});

describe('M7 · Event-Dubletten', () => {
  it('gleicher Titel + Datum unter anderer Kennung: der Server hängt die Erfassung an das vorhandene Event und meldet dessen Kennung', async () => {
    const e = erfassung({ eventId: 'ev-lokal-neu', eventNeu: { titel: 'stammtisch  Beispielstadt', datum: '2026-10-02' } });
    const r = await senden(e);
    expect(r.status).toBe(200);
    expect(r.d.eventId).toBe('ev-test-1');
    const c = await crm();
    expect(c.events.filter(x => x.marke === 'Netzwerken')).toHaveLength(1);
    expect(c.teilnahmen[0].eventId).toBe('ev-test-1');
    // Wiederholung: dieselbe Kennung zurück, nichts doppelt.
    const w = await senden(e);
    expect(w.d).toMatchObject({ schonDa: true, eventId: 'ev-test-1' });
  });
  it('ein abgesagtes Event gleichen Namens zählt nicht als Dublette', async () => {
    await frisch([{ ...EVENT, status: 'abgesagt', anmeldung: 'abgesagt' }]);
    const r = await senden(erfassung({ eventId: 'ev-neu-1', eventNeu: { titel: 'Stammtisch Beispielstadt', datum: '2026-10-02' } }));
    expect(r.status).toBe(200);
    expect(r.d.eventId).toBe('ev-neu-1');
  });
});

describe('H3 · Make.One bidirektional', () => {
  it('Vormerkung für ein kommendes Make.One-Event: Herkunft, einladenDurch, nachgefasst, Antwort mit Event; Abendbericht liest den echten Stand', async () => {
    const e = erfassung({ schritt: 'makeone', makeone: { eventId: 'ev-makeone-1' } });
    const r = await senden(e);
    expect(r.status).toBe(200);
    expect(r.d.makeoneEventId).toBe('ev-makeone-1');
    const c = await crm();
    const gast = c.teilnahmen.find(t => t.eventId === 'ev-makeone-1')!;
    expect(gast).toMatchObject({ id: `t-nwm-${e.erfassungId}`, status: 'vorgemerkt', einladenDurch: 'kevin', herkunft: { art: 'netzwerken', eventId: 'ev-test-1', erfassungId: e.erfassungId } });
    const begegnung = c.teilnahmen.find(t => t.eventId === 'ev-test-1')!;
    expect(begegnung.followUpAm).toBe('2026-10-02');
    expect(begegnung.netzwerken?.makeone).toEqual({ eventId: 'ev-makeone-1' });

    const { berichtAus } = await import('@/lib/crm/netzwerken');
    const bericht = () => berichtAus({ event: c2.events.find(x => x.id === 'ev-test-1')!, teilnahmen: c2.teilnahmen, kontakte: k2, heute: '2026-10-03' });
    let c2 = await crm(); const k2 = await kontakte();
    let z = bericht().zeilen[0];
    expect(z.offen.some(o => o.includes('Einladung offen'))).toBe(true);
    expect(z.links.find(l => l.id === 'makeone')?.href).toContain('ev-makeone-1');
    expect(z.links.find(l => l.id === 'makeone')?.href).toContain('gaeste');
    // Eingeladen → nicht mehr offen.
    c2 = { ...c2, teilnahmen: c2.teilnahmen.map(t => (t.id === gast.id ? { ...t, status: 'eingeladen' as const } : t)) };
    z = bericht().zeilen[0];
    expect(z.offen.some(o => o.includes('Einladung offen'))).toBe(false);
  });

  it('Werbesperre: keine Vormerkung, kein Label, keine Aufgabe — Hinweis; die Begegnung selbst bleibt erfasst', async () => {
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-sperre-1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna.beispiel@example.invalid', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' }, importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
    const r = await senden(erfassung({ schritt: 'makeone', makeone: { eventId: 'ev-makeone-1' } }));
    expect(r.status).toBe(200);
    expect(r.d.hinweise?.some(h => h.startsWith('Werbesperre'))).toBe(true);
    const c = await crm();
    expect(c.teilnahmen.filter(t => t.eventId === 'ev-makeone-1')).toHaveLength(0);
    expect(c.teilnahmen.filter(t => t.eventId === 'ev-test-1')).toHaveLength(1);
    expect(c.teilnahmen[0].followUpAm).toBeUndefined();
    expect(((await db.loadJson<{ tasks: unknown[] }>('tasks'))?.tasks ?? [])).toHaveLength(0);
    expect((await kontakte())[0].labels ?? []).not.toContain('Make.One-Einladung');
  });

  it('Make.One ohne Event: Aufgabe + Label wie bisher, Link „Aufgabe öffnen“ im Bericht', async () => {
    const e = erfassung({ schritt: 'makeone' });
    expect((await senden(e)).status).toBe(200);
    const { berichtAus } = await import('@/lib/crm/netzwerken');
    const c = await crm();
    const z = berichtAus({ event: c.events.find(x => x.id === 'ev-test-1')!, teilnahmen: c.teilnahmen, kontakte: await kontakte(), heute: '2026-10-03' }).zeilen[0];
    expect(z.links.find(l => l.id === 'aufgabe')?.href).toContain(`nw-${e.erfassungId}`);
    expect(z.offen.some(o => o.includes('Aufgabe'))).toBe(true);
  });

  it('`herkunft` überlebt das Speichern (Säuberer) und das Zusammenführen zweier Personen', async () => {
    const herkunft = { art: 'netzwerken', eventId: 'ev-test-1', erfassungId: randomUUID() };
    const t = { id: 't-h-1', eventId: 'ev-makeone-1', kontaktId: 'c-alt-1', status: 'vorgemerkt', herkunft, geaendert: '2026-10-02' };
    const r = speicher.wendeCrmAn(await crm(), [{ liste: 'teilnahmen', op: 'upsert', eintrag: t }], '2026-10-02T08:00:00.000Z', 'kevin');
    expect(r.bestand.teilnahmen[0].herkunft).toEqual(herkunft);
    const { personUmbiegen } = await import('@/lib/crm/person-verweise');
    const um = personUmbiegen({ ...r.bestand, teilnahmen: [...r.bestand.teilnahmen, { id: 't-h-2', eventId: 'ev-makeone-1', kontaktId: 'c-neu-1', status: 'vorgemerkt', geaendert: '2026-10-01' }] }, 'c-alt-1', 'c-neu-1');
    expect(um.teilnahmen).toHaveLength(1);
    expect(um.teilnahmen[0].herkunft).toEqual(herkunft);
  });

  it('Personen-Schranke gilt auch für Funktions-Änderungen: Werbesperre nicht in Einladung/Kampagne, Art. 18 nie, „da“ bleibt erlaubt', async () => {
    const { PersonenSchrankeFehler } = await import('@/lib/crm/personen-schranke');
    const p = (id: string, x: object) => ({ id, vorname: 'T', nachname: 'P', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x });
    await db.saveJson('kontakte', { kontakte: [p('c-ws-1', { werbesperre: { seit: '2026-09-01', grund: 'W' } }), p('c-a18-1', { eingeschraenkt: { seit: '2026-09-01', grund: 'A', von: 'kevin' } }), p('c-frei-1', {})] });
    const tn = (kontaktId: string, status: 'vorgemerkt' | 'da') => ({ id: `t-${kontaktId}-${status}`, eventId: 'ev-makeone-1', kontaktId, status, geaendert: '2026-10-02' });
    await expect(speicher.aendereCrm(b => ({ ...b, teilnahmen: [...b.teilnahmen, tn('c-ws-1', 'vorgemerkt')] }))).rejects.toBeInstanceOf(PersonenSchrankeFehler);
    await expect(speicher.aendereCrm(b => ({ ...b, teilnahmen: [...b.teilnahmen, tn('c-a18-1', 'da')] }))).rejects.toBeInstanceOf(PersonenSchrankeFehler);
    await expect(speicher.aendereCrm(b => ({ ...b, kampagnen: [...(b.kampagnen ?? []), { id: 'k-1', name: 'X', playbook: 'eigen', ziel: 'T', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-ws-1'], ergebnisse: [], von: 'hand', geaendert: '2026-10-02' } as never] }))).rejects.toBeInstanceOf(PersonenSchrankeFehler);
    expect((await crm()).teilnahmen).toHaveLength(0);
    await speicher.aendereCrm(b => ({ ...b, teilnahmen: [...b.teilnahmen, tn('c-ws-1', 'da'), tn('c-frei-1', 'vorgemerkt')] }));
    expect((await crm()).teilnahmen).toHaveLength(2);
  });

  it('`gastVormerken`: eine Stelle für Server und Kontaktakte — einmal je Event+Person, Nachfass-Stempel nur an Begegnungen bei besuchten Events', async () => {
    const { gastVormerken, begegnungenNachgefasst, einladungswegAus } = await import('@/lib/crm/eventplanung');
    const herkunft = { art: 'netzwerken' as const, eventId: 'ev-test-1', erfassungId: randomUUID() };
    const b = { ...speicher.leererBestand(), events: [EVENT, MAKEONE] as never,
      teilnahmen: [{ id: 't-b-1', eventId: 'ev-test-1', kontaktId: 'c-x-1', status: 'da' as const, netzwerken: { erfassungId: herkunft.erfassungId, schritt: 'makeone' as const, zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-02T07:00:00.000Z' }, geaendert: '2026-10-02' }] };
    const a = { id: 't-nwm-1', eventId: 'ev-makeone-1', kontaktId: 'c-x-1', weg: einladungswegAus('rot'), einladenDurch: 'kevin', jetztIso: '2026-10-02T08:00:00.000Z', person: 'kevin', nachgefasst: '2026-10-02' };
    const r = gastVormerken(b, a);
    expect(r.angelegt).toBe(true);
    expect(r.bestand.teilnahmen.find(t => t.id === 't-nwm-1')).toMatchObject({ status: 'vorgemerkt', einladungsweg: 'persoenlich', einladenDurch: 'kevin', herkunft });
    expect(r.bestand.teilnahmen.find(t => t.id === 't-b-1')?.followUpAm).toBe('2026-10-02');
    const nochmal = gastVormerken(r.bestand, a);
    expect(nochmal.angelegt).toBe(false);
    expect(nochmal.bestand.teilnahmen).toHaveLength(2);
    expect(einladungswegAus('gruen')).toBe('mail');
    expect(begegnungenNachgefasst({ events: b.events, teilnahmen: [{ ...b.teilnahmen[0], nachfassenVerzichtet: '2026-10-02' }] }, 'c-x-1', '2026-10-02', 'kevin', 'x')).toEqual([]);
  });
});

describe('H1/H2 · Warteschlange: anderes Event, „für wen“, umgehängtes Event', () => {
  const koerper = (id: string, extra: Record<string, unknown> = {}) => ({ erfassungId: id, eventId: 'ev-alt-1', eventNeu: { titel: 'Alt', datum: '2026-10-02' }, erfasstVon: 'kevin', ...extra });
  const anzeige = { name: 'Anna', schritt: 'Follow-up', eventTitel: 'Alt' };
  it('Antwort „Event gelöscht“ → Fehler mit eventFehler; `eventWechseln` schreibt Körper + Anzeige um und gibt neue Versuche frei', async () => {
    const { Warteschlange, ramSpeicher, bewerten } = await import('@/lib/netzwerken/warteschlange');
    expect(bewerten(404, { ok: false, fehler: 'weg', eventFehler: true })).toMatchObject({ art: 'fehler', eventFehler: true });
    let gesendet: Record<string, unknown> | null = null;
    const antworten = [{ status: 404, daten: { ok: false, fehler: 'Das Event gibt es nicht (mehr)', eventFehler: true } }, { status: 200, daten: { ok: true, eventId: 'ev-neu-9' } }];
    const q = new Warteschlange(ramSpeicher(), async k => { gesendet = k; return antworten.shift()!; });
    await q.ablegen(koerper('11111111-1111-4111-8111-111111111111'), anzeige);
    await q.senden();
    let e = (await q.alle())[0];
    expect(e).toMatchObject({ status: 'fehler', eventFehler: true });
    await q.eventWechseln(e.id, { eventId: 'ev-neu-9', titel: 'Neu', datum: '2026-10-03', ort: 'Köln', fuer: { art: 'kunde', firmaId: 'f-kunde-a' } });
    e = (await q.alle())[0];
    expect(e).toMatchObject({ status: 'wartet', versuche: 0, anzeige: { eventTitel: 'Neu' } });
    expect(e.eventFehler).toBeUndefined();
    expect(e.koerper).toMatchObject({ eventId: 'ev-neu-9', eventNeu: { titel: 'Neu', datum: '2026-10-03', ort: 'Köln', fuer: { art: 'kunde', firmaId: 'f-kunde-a' } } });
    await q.senden();
    expect((gesendet as unknown as Record<string, unknown>).eventId).toBe('ev-neu-9');
    expect(await q.alle()).toHaveLength(0);
  });
  it('`fuerUmschreiben` ändert `eventNeu.fuer` aller wartenden Körper dieses Events (und nur dieses)', async () => {
    const { Warteschlange, ramSpeicher } = await import('@/lib/netzwerken/warteschlange');
    const q = new Warteschlange(ramSpeicher(), async () => ({ status: 0, daten: null }));
    await q.ablegen(koerper('21111111-1111-4111-8111-111111111111'), anzeige);
    await q.ablegen(koerper('22222222-2222-4222-8222-222222222222', { eventId: 'ev-anders-1' }), anzeige);
    expect(await q.fuerUmschreiben('ev-alt-1', { art: 'kunde', firmaId: 'f-kunde-b' })).toBe(1);
    const l = await q.alle();
    expect((l.find(x => x.id.startsWith('2111'))!.koerper.eventNeu as { fuer?: unknown }).fuer).toEqual({ art: 'kunde', firmaId: 'f-kunde-b' });
    expect((l.find(x => x.id.startsWith('2222'))!.koerper.eventNeu as { fuer?: unknown }).fuer).toBeUndefined();
    await q.fuerUmschreiben('ev-alt-1', { art: 'make' });
    expect(((await q.alle()).find(x => x.id.startsWith('2111'))!.koerper.eventNeu as { fuer?: unknown }).fuer).toBeUndefined();
  });
  it('Server meldet eine andere Event-Kennung → die Warteschlange merkt `umgehaengt` (die Auswahl „Heute bei“ zieht um)', async () => {
    const { Warteschlange, ramSpeicher } = await import('@/lib/netzwerken/warteschlange');
    const q = new Warteschlange(ramSpeicher(), async () => ({ status: 200, daten: { ok: true, eventId: 'ev-test-1' } }));
    await q.ablegen(koerper('31111111-1111-4111-8111-111111111111'), anzeige);
    await q.senden();
    expect(q.umgehaengt).toEqual({ 'ev-alt-1': 'ev-test-1' });
  });
  it('H2: `lokal` live abgeleitet — erst wenn das Event im Bestand steht, ist es nicht mehr lokal', async () => {
    const { lokalAbleiten } = await import('@/lib/netzwerken/wahl');
    const w = { eventId: 'ev-x-1', titel: 'X', lokal: true };
    expect(lokalAbleiten(w, undefined)).toBe(w);               // offline: Merker gilt
    expect(lokalAbleiten(w, [{ id: 'ev-y-1' }])).toBe(w);      // Bestand geladen, Event fehlt noch
    expect(lokalAbleiten(w, [{ id: 'ev-x-1' }]).lokal).toBeUndefined();
  });
});

describe('Event-Titel: gleichesBesuchEvent', () => {
  it('Umlaute, Satzzeichen, Groß-/Kleinschreibung egal; nur Netzwerken-Events; nur gleicher Tag', async () => {
    const { gleichesBesuchEvent, eventTitelSchluessel } = await import('@/lib/crm/netzwerken');
    expect(eventTitelSchluessel('Unternehmer-Stammtisch Köln')).toBe(eventTitelSchluessel('unternehmer stammtisch koeln'));
    const evs = [EVENT, MAKEONE] as never;
    expect(gleichesBesuchEvent(evs, 'STAMMTISCH beispielstadt!', '2026-10-02')?.id).toBe('ev-test-1');
    expect(gleichesBesuchEvent(evs, 'Stammtisch Beispielstadt', '2026-10-03')).toBeUndefined();
    expect(gleichesBesuchEvent(evs, 'Make.One Herbst', '2026-10-20')).toBeUndefined();
  });
});
