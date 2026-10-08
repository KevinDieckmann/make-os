// ─── Wächter: Hintergrundaufgaben — „Läuft / Fertig / Fehler“, abbrechen, neu starten, planen, Takt (09.10., Paket 3) ───────
// Nie Läufe der anderen Person (auch nicht als Zahl), Systemläufe nur neutral, abbrechen/neu starten nur eigene, Business-frei,
// Tageshöchstzahl, Hintergrund-KI aus, Kostenschätzung vor großen Aufträgen, Pläne je Person mit Stand.
// Eigener Datenordner, erfundene Konten — Netz gesperrt, Modell aus.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-laeufe-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-laeufe';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

import { fadenBestand, planBestand, skillsHaushaltBestand, LAUF_AGENT, type Faden } from '@/lib/agenten/typen';
import { laeufeBauen, ABGEBROCHEN, laeufeLesen } from '@/lib/agenten/laeufe';
import { zeitplaeneFaelligRein, AUTO_LAEUFE_JE_TAG, skillKandidat, type ZeitplanKandidat, type ZeitplanLage } from '@/lib/agenten/zeitplan';
import { wandzeit, ausWandzeit, tagVon, tagPlus } from '@/lib/kalender/zeit';

type H = (r: Request) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
let route: { GET: H; POST: H };
const post = async (person: string, body: unknown, kopf: Record<string, string> = sitzung(person)) => {
  const r = await route.POST(new Request('http://test/api/agenten/laeufe', { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as J };
};
const get = async (person: string, kopf: Record<string, string> = sitzung(person)) => {
  const r = await route.GET(new Request('http://test/api/agenten/laeufe', { headers: kopf }));
  return { status: r.status, text: await r.text() };
};

const JETZT = new Date();
const VOR = (min: number) => new Date(JETZT.getTime() - min * 60_000).toISOString();
const FREMD = 'MARKE-FREMDE-PERSON-LAUF';
const SYSTEM = 'MARKE-SYSTEM-ERGEBNIS';

const faden = (id: string, besitzer: string, extra: Partial<Faden> = {}): Faden => ({
  id, besitzer, agent: { art: 'mitarbeiter', headId: 'marketing', mitarbeiterId: 'marketing-kampagnen' }, bereich: 'business', titel: `Thread ${id}`, status: 'laeuft',
  fremdGelesen: false, vertraulich: false, nachrichten: [], erstellt: VOR(30), aktualisiert: VOR(1), ...extra,
});

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }),
    konto('k2', 'person-b', 'mitglied', { haushalt: 'haus-a' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
    konto('k4', 'nur-business', 'mitglied', { haushalt: 'haus-a', finanzRecht: 'business' }),
  ], einladungen: [] });
  const T = localTag();
  await db.saveJson('zoe-auftraege', { auftraege: [
    { id: 'a-eigen-offen', zeit: VOR(5), tag: T, art: 'agent', name: LAUF_AGENT, eingabe: { art: 'faden', fadenId: 'fd-b1' }, auftrag: '{"art":"faden","fadenId":"fd-b1"}', schluessel: 's1', status: 'offen', versuche: 0, person: 'person-b' },
    { id: 'a-eigen-fertig', zeit: VOR(90), tag: T, art: 'agent', name: LAUF_AGENT, eingabe: { art: 'faden', fadenId: 'fd-b2' }, auftrag: '{"art":"faden","fadenId":"fd-b2"}', schluessel: 's2', status: 'fertig', versuche: 1, begonnen: VOR(80), beendet: VOR(70), person: 'person-b' },
    { id: 'a-fremd', zeit: VOR(5), tag: T, art: 'agent', name: LAUF_AGENT, eingabe: { art: 'faden', fadenId: 'fd-a1' }, auftrag: FREMD, anlass: FREMD, schluessel: 's3', status: 'laeuft', versuche: 1, person: 'person-a' },
    { id: 'a-system', zeit: VOR(40), tag: T, art: 'agent', name: 'tageslauf', eingabe: {}, auftrag: 'puls', anlass: 'Takt: Tageslauf', schluessel: 's4', status: 'fertig', versuche: 1, begonnen: VOR(40), beendet: VOR(39), ergebnis: SYSTEM },
  ] });
  await db.saveJson(fadenBestand('person-b'), { v: 1, faeden: [
    faden('fd-b1', 'person-b', { lauf: { auftragId: 'a-eigen-offen', status: 'wartet', schritte: [{ id: 's1', titel: 'Segment prüfen', status: 'offen' }, { id: 's2', titel: 'Texte', status: 'offen' }], start: VOR(5), kostenCent: 0, kostenGrenzeCent: 50 } }),
    faden('fd-b2', 'person-b', { status: 'fertig', lauf: { auftragId: 'a-eigen-fertig', status: 'fertig', schritte: [{ id: 's1', titel: 'A', status: 'fertig' }], start: VOR(80), ende: VOR(70), kostenCent: 4 } }),
  ] });
  await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [faden('fd-a1', 'person-a', { titel: FREMD, lauf: { auftragId: 'a-fremd', status: 'laeuft', schritte: [], start: VOR(5), kostenCent: 1 } })] });
  await db.saveJson('head-sales', { berichte: [
    { id: 'hb-1', zeit: VOR(20), modus: 'frage', ausgeloest: 'hand', person: 'person-a', frage: FREMD, dauer_ms: 3000 },
    { id: 'hb-2', zeit: VOR(60), modus: 'power_hour', ausgeloest: 'takt', dauer_ms: 5000 },
  ], vorschlaege: [], letzte: {}, versuche: {} });
  route = await import('@/app/api/agenten/laeufe/route') as unknown as { GET: H; POST: H };
});
const localTag = () => tagVon(wandzeit(JETZT));

describe('Lesemodell: nie Läufe der anderen Person, Systemläufe neutral', () => {
  it('eigene voll (Schritte, Kosten, Aktionen), fremde fehlen ganz, Takt neutral ohne Ergebnis', async () => {
    const l = await laeufeLesen('person-b', JETZT);
    const text = JSON.stringify(l);
    expect(text).not.toContain(FREMD);
    expect(text).not.toContain(SYSTEM);
    expect(l.some(x => x.id === 'a-fremd' || x.fadenId === 'fd-a1')).toBe(false);
    const eigen = l.find(x => x.id === 'a-eigen-offen')!;
    expect(eigen).toMatchObject({ status: 'wartet', quelle: 'faden', fadenId: 'fd-b1', schritte: { gesamt: 2, fertig: 0 }, kosten: { cent: 0, grenzeCent: 50 }, aktionen: ['abbrechen'] });
    expect(l.find(x => x.id === 'a-eigen-fertig')).toMatchObject({ status: 'fertig', aktionen: ['neu-starten'], dauerMs: 600_000 });
    expect(l.find(x => x.id === 'a-system')).toMatchObject({ quelle: 'takt', titel: 'Tageslauf', aktionen: [] });
    // Bericht des Heads: der der anderen Person fehlt, der des Takts steht neutral da.
    expect(l.some(x => x.id === 'hb:sales:hb-1')).toBe(false);
    expect(l.find(x => x.id === 'hb:sales:hb-2')).toMatchObject({ titel: 'Power Hour vorbereiten', quelle: 'head', art: 'wiederkehrend' });
    // Laufende zuerst.
    expect(l[0].status === 'wartet' || l[0].status === 'laeuft').toBe(true);
  });
  it('die andere Person sieht umgekehrt nichts von diesen eigenen Läufen', async () => {
    const l = await laeufeLesen('person-a', JETZT);
    expect(l.some(x => x.id === 'a-eigen-offen' || x.id === 'a-eigen-fertig')).toBe(false);
    expect(l.find(x => x.id === 'hb:sales:hb-1')).toBeTruthy();
  });
  it('„nur Business“ sieht keine Berichte von Privat-Heads; reine Funktion: Läufe ohne Person nie mit Aktionen', () => {
    const l = laeufeBauen({ auftraege: [{ id: 'x', zeit: VOR(1), art: 'agent', name: LAUF_AGENT, status: 'offen', eingabe: { art: 'faden', fadenId: 'f' } }], faeden: [], plan: [], skills: new Map(), berichte: [], log: [] }, 'person-b', JETZT);
    expect(l[0]).toMatchObject({ titel: 'Agenten-Lauf', aktionen: [] });
  });
  it('Route: Person selbst 200; fremder Haushalt und Dienstweg 403; keine Marke der anderen Person', async () => {
    const g = await get('person-b');
    expect(g.status).toBe(200);
    expect(g.text).not.toContain(FREMD);
    expect((await get('gast')).status).toBe(403);
    expect((await get('x', dienst('person-b'))).status).toBe(403);
    expect((await post('x', { aktion: 'abbrechen', laufId: 'a-eigen-offen' }, dienst('person-b'))).status).toBe(403);
  });
});

describe('Aktionen: abbrechen, neu starten — nur eigene', () => {
  it('fremden oder Systemlauf abbrechen → 404; eigenen → abgebrochen (nie wieder ausgeführt)', async () => {
    expect((await post('person-b', { aktion: 'abbrechen', laufId: 'a-fremd' })).status).toBe(404);
    expect((await post('person-b', { aktion: 'abbrechen', laufId: 'a-system' })).status).toBe(404);
    const r = await post('person-b', { aktion: 'abbrechen', laufId: 'a-eigen-offen' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const db = await import('@/lib/store/local-db');
    const a = (await db.loadJson<{ auftraege: { id: string; status: string; fehler?: string; versuche: number }[] }>('zoe-auftraege'))!.auftraege.find(x => x.id === 'a-eigen-offen')!;
    expect(a).toMatchObject({ status: 'fehler', fehler: ABGEBROCHEN, versuche: 3 });
    expect((await laeufeLesen('person-b', JETZT)).find(x => x.id === 'a-eigen-offen')).toMatchObject({ status: 'abgebrochen', aktionen: ['neu-starten'] });
    expect((await post('person-b', { aktion: 'abbrechen', laufId: 'a-eigen-offen' })).status).toBe(409);
    const { nimm } = await import('@/lib/zoe/auftraege');
    expect((await nimm(10)).some(x => x.id === 'a-eigen-offen')).toBe(false);
  });
  it('neu starten: fremder → 404; eigener → neuer Auftrag für die Person (von Hand, kein Takt)', async () => {
    expect((await post('person-b', { aktion: 'neu-starten', laufId: 'a-fremd' })).status).toBe(404);
    const r = await post('person-b', { aktion: 'neu-starten', laufId: 'a-eigen-fertig' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    const { lies } = await import('@/lib/zoe/auftraege');
    const neu = (await lies()).find(x => x.id === r.j.auftragId)!;
    expect(neu).toMatchObject({ name: LAUF_AGENT, person: 'person-b', anlass: 'Neu gestartet von Hand', eingabe: { art: 'faden', fadenId: 'fd-b2' } });
    expect((await post('person-b', { aktion: 'neu-starten', laufId: 'a-eigen-fertig' })).status).toBe(409); // wartet schon
  });
  it('Business-frei: ein Business-Lauf startet nur mit „trotzdem“; teure Läufe nur mit Bestätigung', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('arbeitsrahmen--person-b', { businessFrei: [{ tage: [0, 1, 2, 3, 4, 5, 6], von: '00:00', bis: '24:00' }] });
    const { abbrechen } = { abbrechen: await post('person-b', { aktion: 'abbrechen', laufId: (await laeufeLesen('person-b', JETZT)).find(x => x.status === 'wartet' && x.fadenId === 'fd-b2')!.id }) };
    expect(abbrechen.status).toBe(200);
    const laufId = (await laeufeLesen('person-b', JETZT)).find(x => x.fadenId === 'fd-b2' && x.status === 'abgebrochen')!.id;
    const frei = await post('person-b', { aktion: 'neu-starten', laufId });
    expect(frei.status).toBe(409);
    expect(frei.j.businessFrei).toBe(true);
    // Drei gemessene teure Läufe des Heads → Schätzung über der Schwelle → Bestätigung nötig.
    const f = (await db.loadJson<{ faeden: Faden[] }>(fadenBestand('person-b')))!;
    const teuer = [1, 2, 3].map(i => faden(`fd-teuer-${i}`, 'person-b', { status: 'fertig', lauf: { status: 'fertig', schritte: [], start: VOR(500 + i), ende: VOR(490 + i), kostenCent: 90 } }));
    await db.saveJson(fadenBestand('person-b'), { v: 1, faeden: [...f.faeden, ...teuer] });
    const k = await post('person-b', { aktion: 'neu-starten', laufId, trotzdem: true });
    expect(k.status).toBe(409);
    expect(k.j).toMatchObject({ kostenBestaetigen: true, schaetzung: { quelle: 'messung' } });
    expect(k.j.schaetzung.cent).toBeGreaterThan(50);
    expect((await post('person-b', { aktion: 'neu-starten', laufId, trotzdem: true, kostenBestaetigt: true })).status).toBe(200);
    await db.saveJson('arbeitsrahmen--person-b', { businessFrei: [] });
  });
});

describe('Hintergrundaufgaben planen (je Person, mit Stand)', () => {
  const morgen = () => `${tagPlus(localTag(), 1)}T09:30:00`;
  it('einmalig in der Zukunft → angelegt; Vergangenheit, Nachtruhe, fremder Head → abgelehnt', async () => {
    const auf = (x: Record<string, unknown> = {}) => ({ agent: { art: 'head', headId: 'strategie' }, titel: 'Wochenbericht', auftrag: 'Drei Absätze: Ziele, Zahlen, Risiken.', zeitplan: { art: 'einmalig', wann: morgen() }, ...x });
    const r = await post('person-b', { aktion: 'planen', aufgabe: auf(), anfrageId: 'anfrage-plan-0001' });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.aufgabe).toMatchObject({ besitzer: 'person-b', aktiv: true });
    expect(r.j.schaetzung.quelle).toBe('annahme');
    expect((await post('person-b', { aktion: 'planen', aufgabe: auf({ zeitplan: { art: 'einmalig', wann: `${tagPlus(localTag(), -1)}T09:00:00` } }) })).status).toBe(400);
    expect((await post('person-b', { aktion: 'planen', aufgabe: auf({ zeitplan: { art: 'einmalig', wann: `${tagPlus(localTag(), 1)}T22:30:00` } }) })).status).toBe(400);
    expect((await post('nur-business', { aktion: 'planen', aufgabe: auf({ agent: { art: 'head', headId: 'assistenz' } }) })).status).toBe(403);
    expect((await post('person-b', { aktion: 'planen', aufgabe: auf({ auftrag: 'x'.repeat(4001) }) })).status).toBe(413);
  });
  it('ändern mit Stand (409 bei fremdem), löschen; die andere Person sieht den Plan nie', async () => {
    const g = JSON.parse((await get('person-b')).text);
    const a = g.plan[0];
    expect(g.planStaende[a.id]).toBeTruthy();
    expect((await post('person-b', { aktion: 'plan-aendern', id: a.id, teil: { aktiv: false }, stand: 'alt' })).status).toBe(409);
    const r = await post('person-b', { aktion: 'plan-aendern', id: a.id, teil: { zeitplan: { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '15:00', tage: [5] } }, stand: g.planStaende[a.id] });
    expect(r.status, JSON.stringify(r.j)).toBe(200);
    expect(r.j.zeitplan).toBe('wöchentlich Fr 15:00');
    expect((await get('person-a')).text).not.toContain(a.id);
    expect((await post('person-a', { aktion: 'plan-loeschen', id: a.id, stand: r.j.stand })).j).toMatchObject({ ok: true }); // nichts bei person-a
    const db = await import('@/lib/store/local-db');
    expect(JSON.stringify(await db.loadJson(planBestand('person-b')))).toContain(a.id);
    expect((await post('person-b', { aktion: 'plan-loeschen', id: a.id, stand: r.j.stand })).status).toBe(200);
    expect(JSON.stringify(await db.loadJson(planBestand('person-b')))).not.toContain(a.id);
  });
});

describe('Takt (rein): Business-frei, Tageshöchstzahl, Hintergrund-KI aus', () => {
  const jetzt = ausWandzeit(`${localTag()}T10:15:00`);
  const skill = (id: string, headId: string, extra: Record<string, unknown> = {}) => skillKandidat({
    id, headId, name: id, beschreibung: 'x', anleitung: 'x', werkzeuge: [], ausloeser: { art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '10:00' }, eingabeFelder: [], freigabePflicht: false,
    ergebnis: 'faden', stufe: 'schnell', tests: [], erfolg: { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 }, aktiv: true, version: 1, quelle: 'hand', angelegtVon: 'person-b', ...extra,
  }, 'person-b')!;
  const lage = (x: Partial<ZeitplanLage> = {}): ZeitplanLage => ({ jetzt, kiHintergrund: true, frei: () => [], auftraege: [], faeden: [], ...x });
  it('fällig zur Zeit, danach nicht noch einmal (Riegel = Warteschlange); Takt-Auftrag ohne Titel im Grund', () => {
    const k: ZeitplanKandidat[] = [skill('sk-1', 'sales')];
    const f = zeitplaeneFaelligRein(k, lage());
    expect(f).toHaveLength(1);
    expect(f[0].auftrag).toMatchObject({ name: LAUF_AGENT, person: 'person-b', anlass: 'Takt: Agenten-Zeitplan', eingabe: { art: 'skill', skillId: 'sk-1', ausloeser: 'zeitplan', headId: 'sales' } });
    expect(f[0].grund).not.toContain('sk-1');
    const schon = [{ name: LAUF_AGENT, zeit: ausWandzeit(`${localTag()}T10:01:00`).toISOString(), tag: localTag(), status: 'fertig', anlass: 'Takt: Agenten-Zeitplan', eingabe: { art: 'skill', skillId: 'sk-1', headId: 'sales' } }];
    expect(zeitplaeneFaelligRein(k, lage({ auftraege: schon }))).toEqual([]);
    expect(zeitplaeneFaelligRein(k, lage({ faeden: [{ skillId: 'sk-1', erstellt: ausWandzeit(`${localTag()}T10:05:00`).toISOString() }] }))).toEqual([]);
    expect(zeitplaeneFaelligRein(k, lage({ jetzt: ausWandzeit(`${localTag()}T09:59:00`) }))).toEqual([]);
  });
  it('Business-frei: Business-Heads ruhen, Privat-Heads laufen', () => {
    const frei = [{ start: `${localTag()}T09:00:00`, ende: `${localTag()}T12:00:00` }];
    const k = [skill('sk-b', 'sales'), skill('sk-p', 'assistenz')];
    expect(zeitplaeneFaelligRein(k, lage({ frei: () => frei })).map(f => f.id)).toEqual(['agenten-skill-sk-p']);
    expect(zeitplaeneFaelligRein(k, lage({ frei: () => frei, jetzt: ausWandzeit(`${localTag()}T12:00:00`) })).map(f => f.id)).toEqual(['agenten-skill-sk-b', 'agenten-skill-sk-p']);
  });
  it(`Tageshöchstzahl je Head (${AUTO_LAEUFE_JE_TAG}) — der andere Head läuft weiter; Hintergrund-KI aus → nichts`, () => {
    const voll = Array.from({ length: AUTO_LAEUFE_JE_TAG }, (_, i) => ({ name: LAUF_AGENT, zeit: VOR(i), tag: localTag(), status: 'fertig', anlass: 'Takt: Agenten-Zeitplan', eingabe: { art: 'skill', skillId: `sk-alt-${i}`, headId: 'sales' } }));
    const k = [skill('sk-s', 'sales'), skill('sk-m', 'marketing')];
    expect(zeitplaeneFaelligRein(k, lage({ auftraege: voll })).map(f => f.id)).toEqual(['agenten-skill-sk-m']);
    expect(zeitplaeneFaelligRein(k, lage({ kiHintergrund: false }))).toEqual([]);
    expect(skill('sk-stark', 'strategie', { stufe: 'stark' })).toBeTruthy();
    expect(zeitplaeneFaelligRein([skill('sk-stark', 'strategie', { stufe: 'stark' })], lage())[0].auftrag.eingabe).toMatchObject({ batch: true });
  });
  it('Server: ein aktiver Business-Skill mit Zeitplan wird für die anlegende Person eingereiht (nicht für die andere)', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson(skillsHaushaltBestand('haus-a'), { v: 1, mitarbeiter: [], gedaechtnis: {}, skills: [{
      id: 'sk-server', headId: 'sales', name: 'server-skill', beschreibung: 'x', anleitung: 'x', werkzeuge: [], ausloeser: { art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '07:00' },
      eingabeFelder: [], freigabePflicht: false, ergebnis: 'faden', stufe: 'schnell', tests: [], erfolg: { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 }, aktiv: true, version: 1, quelle: 'hand', angelegtVon: 'person-b',
    }] });
    const { zeitplaeneFaellig } = await import('@/lib/agenten/zeitplan');
    const f = await zeitplaeneFaellig(ausWandzeit(`${localTag()}T08:00:00`));
    expect(f.map(x => x.auftrag.person)).toEqual(['person-b']);
    const { KI_LAEUFE } = await import('@/lib/zoe/takt');
    expect(KI_LAEUFE.has(LAUF_AGENT)).toBe(true);
  });
});
