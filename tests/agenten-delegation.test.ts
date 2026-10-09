// ─── Wächter: Delegation an Mitarbeiter (09.10., Paket 1 „Kern“; Fragerunde Teil 1 Nr. 9–12, ARCHITEKTUR.md R1–R11) ─────────────
// Tiefe 2, Auftrag-Schema, ≤ 3 offene Läufe je Person, Warteschlange (EIN Lauf-Name `faden`), Lauf im Hintergrund mit Ergebnis
// (`fremd('agent')`) und Bericht zurück, Brett mit Herkunft, Hilfe über den Head („wartet“ → Antwort → Fortsetzung), Grenzen je Lauf
// (6 Runden, letzte ohne Werkzeuge; Abbruch nach 2 Runden ohne Fortschritt), Glocke neutral, Lauf-Route nur mit Lauf-Auftrag.
// Eigener Datenordner, erfundene Konten, Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-delegation-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-delegation', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  return o;
});

import type { FadenKern, NachrichtKern } from '@/lib/agenten/faeden';
import { kontenSaeen, modellFake, rufe, sitzung, dienst, text, werkzeug, werkzeugNamen, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let faden: { GET: H; POST: H };
let laufRoute: { POST: H };
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');
let d: typeof import('@/lib/agenten/delegation');
let fs: typeof import('@/lib/agenten/faeden-server');

const auftrag = (ziel: string, ohne: string[] = []) => Object.fromEntries(Object.entries({ ziel, format: 'zwei kurze Entwürfe mit Anlass', grenzen: 'nichts senden, nur Vorschläge', quellen: 'Pipeline und letzte Aktivitäten' }).filter(([k]) => !ohne.includes(k)));
const lesen = async (id: string) => (await fs.eigenerFaden('person-a', id))!;
const lauf = (id: string) => d.fadenLauf('person-a', { art: 'faden', fadenId: id }, { origin: 'http://test', hintergrund: false });

let headId = '';
let kindId = '';

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  d = await import('@/lib/agenten/delegation');
  fs = await import('@/lib/agenten/faeden-server');
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  laufRoute = (await import('@/app/api/agenten/faden/lauf/route')) as unknown as typeof laufRoute;
  m = modellFake();
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

describe('an_mitarbeiter', () => {
  it('neuer Thread mit Eltern, Kette, Brett und Auftragskarte; „An Thread … gesendet“ im Head-Thread; EIN Auftrag in der Warteschlange', async () => {
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-nachfassen', auftrag: auftrag('Nachfassen vorbereiten') }]), text('Ist beauftragt.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Bereite das Nachfassen vor.' });
    expect(r.status).toBe(200);
    headId = (r.d.faden as FadenKern).id;
    const head = await lesen(headId);
    const gesendet = head.nachrichten.find(n => n.verweis?.art === 'gesendet')!;
    expect(gesendet).toMatchObject({ rolle: 'system', auftrag: auftrag('Nachfassen vorbereiten') });
    kindId = gesendet.verweis!.fadenId;
    const kind = await lesen(kindId);
    expect(kind).toMatchObject({ elternId: headId, agent: { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-nachfassen' }, kette: ['head:sales', 'mitarbeiter:sales:sales-nachfassen'], status: 'wartet' });
    // Fremdtext-Marke vererbt sich vom Eltern- auf den Kind-Thread (R9).
    expect(head.fremdGelesen).toBe(true);
    expect(kind.fremdGelesen).toBe(true);
    expect(kind.nachrichten[0]).toMatchObject({ rolle: 'agent', von: 'head:sales', auftrag: auftrag('Nachfassen vorbereiten') });
    const brett = head.bretter!.find(b => b.id === kind.brettId)!;
    expect(brett.schreiber).toBe(kindId);
    expect(brett.eintraege[0]).toMatchObject({ art: 'aufgabe', von: 'head:sales', fadenId: headId });
    const a = (await db.loadJson<{ auftraege: { id: string; name: string; art: string; eingabe: unknown; auftrag: string; person: string }[] }>('zoe-auftraege'))!.auftraege;
    const job = a.find(x => x.id === kind.lauf!.auftragId)!;
    expect(job).toMatchObject({ art: 'agent', name: 'faden', eingabe: { art: 'faden', fadenId: kindId }, person: 'person-a' });
    expect(JSON.parse(job.auftrag)).toEqual({ art: 'faden', fadenId: kindId });
  });
  it('Auftrag ohne Format/Grenzen wird abgelehnt — kein Thread', async () => {
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-angebote', auftrag: auftrag('Angebot', ['format']) }]), text('Nicht gegangen.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, fadenId: headId, text: 'Und ein Angebot.' });
    expect((r.d.faden as FadenKern).nachrichten.at(-1)!.werkzeuge).toEqual([{ name: 'an_mitarbeiter', ok: false }]);
    expect((await fs.bestandLesen('person-a')).faeden.filter(f => f.elternId === headId)).toHaveLength(1);
  });
  it('Tiefe 2: ein Mitarbeiter bekommt kein an_mitarbeiter — ein Aufruf wird nicht ausgeführt', async () => {
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-angebote', auftrag: auftrag('Weiter') }]), text('Geht nicht.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-crm-pflege' }, text: 'Gib das weiter.' });
    expect(r.status).toBe(200);
    const anfrage = m.anfragen.at(-2)!;
    expect(werkzeugNamen(anfrage)).not.toContain('an_mitarbeiter');
    expect((r.d.faden as FadenKern).nachrichten.at(-1)!.werkzeuge).toEqual([{ name: 'an_mitarbeiter', ok: false }]);
  });
  it('höchstens 3 offene Mitarbeiter-Läufe je Person — der vierte wird abgelehnt', async () => {
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-recherche', auftrag: auftrag('B') }], ['an_mitarbeiter', { mitarbeiter: 'sales-angebote', auftrag: auftrag('C') }]), text('Zwei mehr.'));
    await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Zwei Aufträge.' });
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-qualifizierung', auftrag: auftrag('D') }]), text('Zu viele.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Noch einer.' });
    expect((r.d.faden as FadenKern).nachrichten.at(-1)!.werkzeuge).toEqual([{ name: 'an_mitarbeiter', ok: false }]);
    const { offeneLaeufe } = await import('@/lib/agenten/faeden');
    expect(offeneLaeufe(await fs.bestandLesen('person-a'))).toBe(3);
  });
});

describe('Lauf im Hintergrund', () => {
  it('Ergebnis als fremd(agent) im Mitarbeiter-Thread, Bericht + Fund zurück, Glocke neutral, Lauf-Protokoll ohne Inhalte', async () => {
    m.antworten.push(text('Zwei Entwürfe liegen bereit: kurze Mail und Leitfaden.'));
    const vorher = m.anfragen.length;
    const r = await lauf(kindId);
    expect(r).toMatchObject({ ok: true, laufStatus: 'fertig' });
    const anfrage = m.anfragen[vorher];
    expect(JSON.stringify(anfrage.system)).toMatch(/Mitarbeiter im Team von Head of Sales/);
    expect(JSON.stringify(anfrage.messages)).toMatch(/AUFTRAG von head:sales/);
    expect(werkzeugNamen(anfrage)).toEqual(expect.arrayContaining(['brett_eintragen', 'hilfe_anfragen']));
    expect(werkzeugNamen(anfrage)).not.toContain('an_mitarbeiter');
    const kind = await lesen(kindId);
    const ergebnis = kind.nachrichten.at(-1) as NachrichtKern;
    expect(ergebnis).toMatchObject({ rolle: 'agent', von: 'mitarbeiter:sales:sales-nachfassen', fremd: 'agent', ki: true });
    expect(ergebnis.lauf).toMatchObject({ operation: 'invoke_agent', agent: 'mitarbeiter:sales:sales-nachfassen', ergebnis: 'ok' });
    expect(kind.lauf).toMatchObject({ status: 'fertig' });
    expect(kind.status).toBe('fertig');
    const head = await lesen(headId);
    const bericht = head.nachrichten.find(n => n.verweis?.art === 'bericht')!;
    expect(bericht).toMatchObject({ rolle: 'system', fremd: 'agent', verweis: { fadenId: kindId } });
    expect(bericht.text).toMatch(/Zwei Entwürfe/);
    expect(head.bretter!.find(b => b.id === kind.brettId)!.eintraege.some(e => e.art === 'fund' && e.fremd)).toBe(true);
    const glocke = (await db.loadJson<{ eintraege: { art: string; titel: string; link: string }[] }>('meldungen--person-a'))!.eintraege;
    const g = glocke.find(x => x.art === 'agenten')!;
    expect(g.titel).toBe('Ein Agenten-Ergebnis liegt bereit');
    // Nachschliff 09.10.: das fertige Ergebnis verlinkt dorthin, wo der Auftrag gegeben wurde (hier der Head-Thread mit dem Bericht).
    expect(g.link).toContain(headId);
    const log = (await db.loadJson<{ entries: { agent: string; person?: string; payload: unknown }[] }>('agent-log'))!.entries.filter(e => e.agent === 'faden:sales');
    expect(log.length).toBeGreaterThan(0);
    expect(JSON.stringify(log)).not.toMatch(/Zwei Entwürfe/);
    expect(log.every(e => e.person === 'person-a')).toBe(true);
  });
  it('Abbruch nach 2 Runden ohne Fortschritt („festgefahren“) — Bericht trotzdem zurück', async () => {
    const id = (await fs.bestandLesen('person-a')).faeden.find(f => f.agent.art === 'mitarbeiter' && f.agent.mitarbeiterId === 'sales-recherche' && f.lauf?.status === 'wartet')!.id;
    m.antworten.push(werkzeug(['gibt_es_nicht', { a: 1 }]), werkzeug(['gibt_es_nicht', { a: 2 }]));
    const r = await lauf(id);
    expect(r.laufStatus).toBe('abgebrochen');
    const k = await lesen(id);
    expect(k.lauf).toMatchObject({ status: 'abgebrochen' });
    expect(k.lauf!.fehler).toMatch(/festgefahren/);
    expect((await lesen(k.elternId!)).nachrichten.some(n => n.verweis?.art === 'bericht' && n.verweis.fadenId === id)).toBe(true);
  });
  it('höchstens 6 Runden — die letzte ohne Werkzeuge; Kosten am Lauf', async () => {
    const id = (await fs.bestandLesen('person-a')).faeden.find(f => f.agent.art === 'mitarbeiter' && f.agent.mitarbeiterId === 'sales-angebote' && f.lauf?.status === 'wartet')!.id;
    const vorher = m.anfragen.length;
    for (const [n, e] of [['angebote_lage', {}], ['pipeline', {}], ['mandate_lage', {}], ['angebote_lage', { teil: 1 }], ['pipeline', { teil: 1 }]] as [string, Record<string, unknown>][]) m.antworten.push(werkzeug([n, e]));
    m.antworten.push(text('Fertig nach sechs Runden.'));
    const r = await lauf(id);
    expect(r.laufStatus).toBe('fertig');
    const anfragen = m.anfragen.slice(vorher);
    expect(anfragen).toHaveLength(6);
    expect(werkzeugNamen(anfragen[5])).toEqual([]);
    expect(werkzeugNamen(anfragen[0])).toContain('angebote_lage');
    const k = await lesen(id);
    expect(k.lauf!.kostenCent).toBeGreaterThan(0);
    expect(k.lauf!.schritte).toHaveLength(5);
  });
});

describe('Hilfe über den Head (Brett)', () => {
  let a = '';
  it('hilfe_anfragen: Lauf endet „wartet“, Frage im Brett, der Head wird eingereiht; eine zweite Frage im selben Lauf nicht', async () => {
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-angebote', auftrag: auftrag('Angebot Kunde A') }]), text('Beauftragt.'));
    await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, fadenId: headId, text: 'Angebot für Kunde A.' });
    a = (await fs.bestandLesen('person-a')).faeden.find(f => f.elternId === headId && f.agent.art === 'mitarbeiter' && f.agent.mitarbeiterId === 'sales-angebote' && f.lauf?.status === 'wartet')!.id;
    m.antworten.push(werkzeug(['hilfe_anfragen', { frage: 'Welcher Tagessatz gilt?', warum: 'für die Positionen' }], ['hilfe_anfragen', { frage: 'Und die Laufzeit?', warum: 'für die Summe' }]));
    const r = await lauf(a);
    expect(r.laufStatus).toBe('wartet');
    const kind = await lesen(a);
    expect(kind.status).toBe('wartet');
    expect(kind.nachrichten.at(-1)!.werkzeuge!.map(w => w.ok)).toEqual([true, false]);
    expect(kind.hilfeAnfragen).toBe(1);
    const head = await lesen(headId);
    const frage = head.bretter!.find(b => b.id === kind.brettId)!.eintraege.find(e => e.art === 'frage')!;
    expect(frage).toMatchObject({ status: 'offen', von: 'mitarbeiter:sales:sales-angebote', fadenId: a });
    expect(head.lauf).toMatchObject({ status: 'wartet' });
    const jobs = (await db.loadJson<{ auftraege: { id: string; eingabe: { fadenId?: string } }[] }>('zoe-auftraege'))!.auftraege;
    expect(jobs.some(j => j.id === head.lauf!.auftragId && j.eingabe.fadenId === headId)).toBe(true);
  });
  it('der Head vermittelt (brett_antworten) → Antwort im Brett, der Mitarbeiter bekommt sie und wird neu eingereiht', async () => {
    const head = await lesen(headId);
    const frage = head.bretter!.flatMap(b => b.eintraege).find(e => e.art === 'frage' && e.status === 'offen')!;
    m.antworten.push(werkzeug(['brett_antworten', { frage_id: frage.id, antwort: 'Der übliche Tagessatz aus dem Produkt.' }]), text('Beantwortet.'));
    const vorher = m.anfragen.length;
    const r = await lauf(headId);
    expect(r.laufStatus).toBe('fertig');
    expect(werkzeugNamen(m.anfragen[vorher])).toContain('brett_antworten');
    expect(JSON.stringify(m.anfragen[vorher].system)).toMatch(/OFFENE FRAGEN DEINER MITARBEITER/);
    const h = await lesen(headId);
    const eintraege = h.bretter!.flatMap(b => b.eintraege);
    expect(eintraege.find(e => e.id === frage.id)!.status).toBe('beantwortet');
    expect(eintraege.some(e => e.art === 'antwort' && e.frageId === frage.id)).toBe(true);
    const k = await lesen(a);
    expect(k.nachrichten.at(-1)).toMatchObject({ rolle: 'system', fremd: 'agent' });
    expect(k.lauf).toMatchObject({ status: 'wartet' });
  });
});

describe('Teilen: das ganze Gespräch', () => {
  it('ein geteilter Head-Thread nimmt seine Mitarbeiter-Threads mit — die zweite Person liest beide, „nur Business“ ebenso, fremde nie', async () => {
    const g = await rufe(faden.GET, `/api/agenten/faden?id=${headId}`, sitzung('person-a'));
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'teilen', fadenId: headId, geteilt: true, stand: g.d.stand })).status).toBe(200);
    const b = await rufe(faden.GET, `/api/agenten/faden?id=${headId}`, sitzung('person-b'));
    expect(b.status).toBe(200);
    expect((b.d.kinder as unknown[]).length).toBeGreaterThan(0);
    expect((await rufe(faden.GET, `/api/agenten/faden?id=${kindId}`, sitzung('team-c'))).status).toBe(200);
    expect((await rufe(faden.GET, `/api/agenten/faden?id=${kindId}`, sitzung('gast'))).status).toBe(403);
    const z = await rufe(faden.GET, `/api/agenten/faden?id=${headId}`, sitzung('person-a'));
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'teilen', fadenId: headId, geteilt: false, stand: z.d.stand })).status).toBe(200);
    expect((await rufe(faden.GET, `/api/agenten/faden?id=${kindId}`, sitzung('person-b'))).status).toBe(404);
  });
});

describe('Lauf-Route (Dienstweg mit Person)', () => {
  type R = { POST: H };
  const post = (r: R, kopf: Record<string, string>, body: unknown) => rufe(r.POST, '/api/agenten/faden/lauf', kopf, body);
  it('freier Text ist kein Lauf (400); fremder Thread 404; Sitzung statt Dienstweg 403', async () => {
    expect((await post(laufRoute, dienst('person-a'), 'Mach irgendwas')).status).toBe(400);
    expect((await post(laufRoute, dienst('person-a'), { art: 'faden', fadenId: 'Mach irgendwas' })).status).toBe(400);
    expect((await post(laufRoute, dienst('person-b'), { art: 'faden', fadenId: kindId })).status).toBe(404);
    expect((await post(laufRoute, sitzung('person-a'), { art: 'faden', fadenId: kindId })).status).toBe(403);
    expect((await post(laufRoute, dienst(), { art: 'faden', fadenId: kindId })).status).toBe(401);
  });
  it('abgebrochen läuft nicht', async () => {
    const id = (await fs.bestandLesen('person-a')).faeden.find(f => f.lauf?.status === 'wartet' && f.agent.art === 'mitarbeiter')!.id;
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'abbrechen', fadenId: id })).status).toBe(200);
    const vorher = m.anfragen.length;
    const r = await post(laufRoute, dienst('person-a'), { art: 'faden', fadenId: id });
    expect(r.status).toBe(200);
    expect(r.d.laufStatus).toBe('abgebrochen');
    expect(m.anfragen.length).toBe(vorher);
  });
});
