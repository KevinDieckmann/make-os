// ─── ZOE-Entscheidungen dauerhaft + keine Doppel-Ausführung (29.09., B1) ─────────────────────────
// Kevin: „Alle Infos müssen immer sauber gespeichert werden.“ Geprüft: jede Entscheidung trägt die Person und steht
// dauerhaft in `zoe-entscheidungen--<haushalt>--<monat>`; Stapel und Protokoll kürzen nur Festgehaltenes (Altbestand
// wird nachgetragen); Grund/Eingabe über der Grenze → 413 statt kürzen; paralleles Freigeben legt nichts doppelt an.
// Eigener Datenordner, erfundene Konten und Daten, kein Modellaufruf.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-entscheidungen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-entscheidungen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T = '2026-09-01T08:00:00.000Z';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const kontakt = (id: string, vorname: string, extra: Record<string, unknown> = {}) => ({ id, vorname, nachname: 'Beispiel', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...extra });
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

let db: typeof import('@/lib/store/local-db');
let stapel: typeof import('@/lib/zoe/stapel');
let E: typeof import('@/lib/zoe/entscheidungen');
let W: typeof import('@/lib/zoe/werkzeuge');
let speicher: typeof import('@/lib/crm/speicher');
let stapelRoute: { POST: (r: Request) => Promise<Response> };
const monat = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
const dauer = async () => E.entscheidungenMonat('haus', monat());
const entscheiden = async (id: string, person: string, entscheidung: 'freigeben' | 'ablehnen', extra: Record<string, unknown> = {}) =>
  stapelRoute.POST(anfrage('/api/zoe/stapel', sitzung(person), 'POST', { id, entscheidung, ...extra }));
const lauf = (name: string, eingabe: Record<string, unknown>, person?: string) => W.WERKZEUGE[name].lauf(eingabe, 'http://test', person);
const offeneCrm = async () => (await stapel.lies('offen')).filter(v => v.bezug?.art === 'crm');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [kontakt('c-anna-1', 'Anna', { besitzer: 'kevin', email: 'anna@beispiel.invalid' })] });
  speicher = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...speicher.leererBestand(), events: [] });
  stapel = await import('@/lib/zoe/stapel');
  E = await import('@/lib/zoe/entscheidungen');
  W = await import('@/lib/zoe/werkzeuge');
  stapelRoute = await import('@/app/api/zoe/stapel/route') as never;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Entscheidungen dauerhaft, mit Person', () => {
  it('Ablehnen über die Route: Person + Grund am Eintrag und dauerhaft; zweites Ablehnen → 409', async () => {
    const v = await stapel.lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Block setzen', nachher: 'x', eingabe: { tag: '2026-10-01' }, person: 'kevin' });
    const r = await entscheiden(v.id, 'kevin', 'ablehnen', { grund: 'passt diese Woche nicht' });
    expect(r.status).toBe(200);
    expect(await stapel.hole(v.id)).toMatchObject({ status: 'abgelehnt', entschiedenVon: 'kevin', grund: 'passt diese Woche nicht', protokolliert: true });
    const d = (await dauer()).find(x => x.quelleId === v.id)!;
    expect(d).toMatchObject({ typ: 'entscheidung', entscheidung: 'abgelehnt', person: 'kevin', fuer: 'kevin', grund: 'passt diese Woche nicht', werkzeug: 'plan_block' });
    expect((await entscheiden(v.id, 'kevin', 'ablehnen')).status).toBe(409);
  });
  it('zu langer Grund → 413 (nie gekürzt); zu lange geänderte Eingabe → 413', async () => {
    const v = await stapel.lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Block', nachher: 'x', eingabe: { tag: '2026-10-02', titel: 'a' }, person: 'kevin' });
    const lang = await entscheiden(v.id, 'kevin', 'ablehnen', { grund: 'x'.repeat(401) });
    expect(lang.status).toBe(413);
    expect((await stapel.hole(v.id))!.status).toBe('offen');
    const gross = await entscheiden(v.id, 'kevin', 'freigeben', { eingabe: { titel: 'y'.repeat(4001) } });
    expect(gross.status).toBe(413);
    expect(String(((await gross.json()) as { error?: string }).error)).toMatch(/länger als 4000/);
    expect((await entscheiden(v.id, 'kevin', 'freigeben', { eingabe: { 'böse-taste': 1 } })).status).toBe(400);
    expect((await stapel.hole(v.id))!.status).toBe('offen');
    await entscheiden(v.id, 'kevin', 'ablehnen');
  });
  it('„Ändern & freigeben“: ein Zahl-Feld bleibt Zahl — Text dort → 400, nichts übernommen (Gegenprüfung 08.10.)', async () => {
    const v = await stapel.lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Block mit Dauer', nachher: 'x', eingabe: { tag: '2026-10-06', dauer: 60 }, person: 'kevin' });
    const r = await entscheiden(v.id, 'kevin', 'freigeben', { eingabe: { tag: '2026-10-06', dauer: '1.500' } });
    expect(r.status).toBe(400);
    expect(String(((await r.json()) as { error?: string }).error)).toMatch(/„dauer“ ist ein Zahl-Feld/);
    expect(await stapel.hole(v.id)).toMatchObject({ status: 'offen', eingabe: { tag: '2026-10-06', dauer: 60 } });
    await entscheiden(v.id, 'kevin', 'ablehnen');
  });
  it('Kontakt-Kennungen im Bezug nur als Fingerabdruck', () => {
    const b = E.bezugFuerProtokoll({ art: 'crm', id: 'aktivitaet:c-anna-1' })!;
    expect(b.id).toMatch(/^aktivitaet:c#[0-9a-f]{12}$/);
  });
});

describe('Kürzen nur nach dauerhaftem Festhalten', () => {
  it('Stapel: Altbestand über der Grenze wird nachgetragen, dann gekürzt — nichts geht verloren', async () => {
    const alt = Array.from({ length: 205 }, (_, i) => ({ id: `v-alt-${String(i).padStart(4, '0')}`, zeit: T, tag: '2026-09-01', werkzeug: 'plan_block', gruppe: 'planer', titel: `Alt ${i}`, nachher: 'x', eingabe: {}, status: 'freigegeben', entschiedenAm: T }));
    const jetzt = (await db.loadJson<{ vorschlaege: unknown[] }>('zoe-stapel'))!.vorschlaege;
    await db.saveJson('zoe-stapel', { vorschlaege: [...jetzt, ...alt] });
    await stapel.lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Neu', nachher: 'x', eingabe: { tag: '2026-10-03' }, person: 'kevin' });
    const liste = (await db.loadJson<{ vorschlaege: { id: string }[] }>('zoe-stapel'))!.vorschlaege;
    expect(liste.length).toBeLessThanOrEqual(200);
    const weg = alt.filter(a => !liste.some(x => x.id === a.id));
    expect(weg.length).toBeGreaterThan(0);
    // Alles, was aus der Arbeitsliste fiel, steht dauerhaft (Monat des Altbestands: September 2026).
    const sept = await E.entscheidungenMonat('haus', '2026-09');
    for (const w of weg) expect(sept.some(x => x.quelleId === w.id && x.nachgetragen), w.id).toBe(true);
  });
  it('Protokoll: jede Ausführung dauerhaft (nur Feldnamen); Altbestand über 500 wird vor dem Kürzen nachgetragen', async () => {
    const P = await import('@/lib/zoe/protokoll');
    const alt = Array.from({ length: 500 }, (_, i) => ({ id: `p-alt-${i}`, zeit: T, tag: '2026-09-01', werkzeug: 'plan_block', gruppe: 'planer', risiko: 'frei', eingabe: { geheim: 'WERT' }, ergebnis: 'ok', ok: true, quelle: 'zoe', person: 'kevin' }));
    await db.saveJson('zoe-protokoll', { eintraege: alt });
    const e = await P.notiere({ werkzeug: 'plan_block', gruppe: 'planer', risiko: 'frei', eingabe: { tag: 'GEHEIMER-WERT' }, ergebnis: 'Block gesetzt.', ok: true, quelle: 'zoe', person: 'kevin' });
    expect((await db.loadJson<{ eintraege: unknown[] }>('zoe-protokoll'))!.eintraege).toHaveLength(500);
    const neu = (await dauer()).find(x => x.quelleId === e.id)!;
    expect(neu).toMatchObject({ typ: 'ausfuehrung', felder: ['tag'], person: 'kevin' });
    expect(JSON.stringify(await dauer())).not.toContain('GEHEIMER-WERT');
    const sept = await E.entscheidungenMonat('haus', '2026-09');
    expect(sept.some(x => x.quelleId === 'p-alt-499' && x.nachgetragen)).toBe(true);
  });
});

describe('Keine Doppel-Ausführung', () => {
  it('beanspruche: von zwei gleichzeitigen gewinnt genau einer', async () => {
    const v = await stapel.lege({ werkzeug: 'plan_block', gruppe: 'planer', titel: 'Parallel', nachher: 'x', eingabe: { tag: '2026-10-04' }, person: 'kevin' });
    const [a, b] = await Promise.all([stapel.beanspruche(v.id, 'kevin'), stapel.beanspruche(v.id, 'kevin')]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect((await stapel.hole(v.id))!.status).toBe('in_arbeit');
    // Ablehnen, während jemand übernimmt → nichts entschieden.
    expect(await stapel.entscheide(v.id, 'abgelehnt', { von: 'malin' })).toBeNull();
    await stapel.loslassen(v.id);
    expect((await stapel.hole(v.id))!.status).toBe('offen');
    await stapel.entscheide(v.id, 'abgelehnt', { von: 'kevin' });
  });
  it('CRM: Aktivität, Follow-up, Beitrag — doppelt freigeben (parallel) legt je genau einen an', async () => {
    expect(await lauf('crm_vorschlag', { art: 'aktivitaet', kontakt: 'c-anna-1', aktivitaet_art: 'notiz', text: 'Einmal notiert' }, 'kevin')).toMatch(/^VORGESCHLAGEN/);
    expect(await lauf('crm_vorschlag', { art: 'followup', kontakt: 'c-anna-1', text: 'Einmal nachfassen', faellig: '2099-10-12', followup_art: 'sonstig' }, 'kevin')).toMatch(/^VORGESCHLAGEN/);
    const offen = await offeneCrm();
    expect(offen).toHaveLength(2);
    for (const v of offen) {
      const [r1, r2] = await Promise.all([entscheiden(v.id, 'kevin', 'freigeben'), entscheiden(v.id, 'kevin', 'freigeben')]);
      expect([r1.status, r2.status].sort(), v.titel).toEqual([200, 409]);
      expect((await stapel.hole(v.id))).toMatchObject({ status: 'freigegeben', entschiedenVon: 'kevin' });
    }
    // „Alle freigeben“ und ein Einzelklick gleichzeitig.
    await lauf('crm_vorschlag', { art: 'beitrag_entwurf', titel: 'Einmal-Beitrag', kanal: 'linkedin', text: 'Text' }, 'kevin');
    const [b] = await offeneCrm();
    expect(b).toBeDefined();
    const [einzeln, alle] = await Promise.all([entscheiden(b.id, 'kevin', 'freigeben'), stapelRoute.POST(anfrage('/api/zoe/stapel', sitzung('kevin'), 'POST', { alle: true }))]);
    const erledigt = ((await alle.json()) as { erledigt: number }).erledigt;
    expect((einzeln.status === 200 ? 1 : 0) + erledigt).toBe(1);
    expect((await stapel.hole(b.id))!.status).toBe('freigegeben');
    const anna = (await db.loadJson<{ kontakte: { id: string; aktivitaeten: { text?: string }[] }[] }>('kontakte'))!.kontakte[0];
    expect(anna.aktivitaeten.filter(a => a.text === 'Einmal notiert')).toHaveLength(1);
    const crm = await speicher.ladeCrm();
    expect(crm.followups.filter(f => f.text === 'Einmal nachfassen')).toHaveLength(1);
    expect(crm.beitraege.filter(b => b.titel === 'Einmal-Beitrag')).toHaveLength(1);
    const d = (await dauer()).filter(x => x.entscheidung === 'freigegeben' && x.vorschlagArt);
    expect(d.map(x => x.vorschlagArt).sort()).toEqual(['aktivitaet', 'beitrag_entwurf', 'followup']);
  });
  it('CRM: nach einem Absturz (Anspruch verwaist, schon ausgeführt) legt die zweite Freigabe nichts doppelt an', async () => {
    await lauf('crm_vorschlag', { art: 'aktivitaet', kontakt: 'c-anna-1', aktivitaet_art: 'notiz', text: 'Nach Absturz' }, 'kevin');
    const [v] = await offeneCrm();
    const C = await import('@/lib/zoe/crm-vorschlag');
    // Erste Ausführung gelingt, aber das Entscheiden „stürzt ab“: der Eintrag steht noch in_arbeit mit altem Anspruch.
    expect((await stapel.beanspruche(v.id, 'kevin')).ok).toBe(true);
    const { innen } = C;
    await innen('/api/crm/aktivitaet', 'POST', { id: 'c-anna-1', art: 'notiz', text: 'Nach Absturz', vorschlagId: v.id }, 'kevin');
    await db.updateJson<{ vorschlaege: { id: string; inArbeit?: { seit: string } }[] }>('zoe-stapel', c => ({ vorschlaege: c!.vorschlaege.map(x => (x.id === v.id ? { ...x, inArbeit: { seit: '2026-01-01T00:00:00.000Z', von: 'kevin' } } : x)) }));
    expect((await stapel.hole(v.id))!.status).toBe('offen');
    const r = await entscheiden(v.id, 'kevin', 'freigeben');
    expect(r.status).toBe(200);
    expect(String(((await r.json()) as { ergebnis?: string }).ergebnis)).toMatch(/nichts doppelt/);
    const anna = (await db.loadJson<{ kontakte: { aktivitaeten: { text?: string }[] }[] }>('kontakte'))!.kontakte[0];
    expect(anna.aktivitaeten.filter(a => a.text === 'Nach Absturz')).toHaveLength(1);
  });
});
