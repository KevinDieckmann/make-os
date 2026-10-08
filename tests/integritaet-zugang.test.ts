// ─── Integritätsprüfung 28.09. abends — K1 und Regel 5 ──────────────────────
// ZOE und Dienstweg umgehen die Haushaltsprüfung nicht mehr: `imHaushaltDesInhabers`
// ist beim Dienstweg so streng wie `karteiZugang` (ohne Person → null, fremde Person →
// null), die CRM-Werkzeuge prüfen selbst, kimmi bietet sie nur im Haushalt an, die
// Heads-Routen sind geschützt. Eigener Datenordner, erfundene Konten und Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-integritaet-zugang-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-integritaet';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

// kimmi ohne echtes Modell: die angebotenen Werkzeuge werden mitgeschnitten.
const mitschnitt: { tools: { name: string; input_schema?: { properties?: { agent?: { enum?: string[] }; auftraege?: { items?: { properties?: { agent?: { enum?: string[] } } } } } } }[] }[] = [];
vi.mock('@/lib/anthropic', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/anthropic')>();
  return {
    ...echt,
    hasAnthropicKey: () => true,
    askText: vi.fn(async (o: { tools?: unknown[] }) => { mitschnitt.push({ tools: (o.tools ?? []) as never }); return { ok: true, status: 200, text: 'Gut.', stopReason: 'end_turn', raw: { content: [{ type: 'text', text: 'Gut.' }] } }; }),
  };
});
vi.mock('@/lib/brain', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

const KEY = process.env.MAKE_OS_KEY!;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': KEY, ...(p ? { 'x-make-person': p } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });

let db: typeof import('@/lib/store/local-db');
let zugang: typeof import('@/lib/zugang/haushalt-inhaber');
let W: typeof import('@/lib/zoe/werkzeuge');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus'), konto('k3', 'fremd', 'mitglied', 'test'), konto('k4', 'ohne', 'mitglied')], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-anna', vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' }] });
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('crm', speicher.leererBestand());
  zugang = await import('@/lib/zugang/haushalt-inhaber');
  W = await import('@/lib/zoe/werkzeuge');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('imHaushaltDesInhabers: Dienstweg so streng wie karteiZugang (Regel 5)', () => {
  it('Dienstweg ohne Person → null (kein Rückfall auf „kevin“), fremde Person → null, Person im Haushalt → ja', async () => {
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', dienst()))).toBeNull();
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', dienst('fremd')))).toBeNull();
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', dienst('ohne')))).toBeNull();
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', dienst('niemand')))).toBeNull();
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', dienst('malin')))).toEqual({ person: 'malin', dienst: true });
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', sitzung('fremd')))).toBeNull();
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', sitzung('kevin')))).toEqual({ person: 'kevin', dienst: false });
    // Falscher Schlüssel ist kein Dienstweg.
    expect(await zugang.imHaushaltDesInhabers(anfrage('/', { 'x-make-key': 'falsch', 'x-make-person': 'kevin' }))).toBeNull();
  });
  it('Systemlauf ohne Person nur, wo die Route ihn trägt (Kalender lesen, Erinnerungen, Kartei) — mit person null', async () => {
    expect(await zugang.imHaushaltOderSystemlauf(anfrage('/', dienst()))).toEqual({ person: null, dienst: true });
    expect(await zugang.imHaushaltOderSystemlauf(anfrage('/', dienst('fremd')))).toBeNull();
    expect(await zugang.karteiZugang(anfrage('/', dienst()))).toEqual({ person: null, dienst: true });
    expect(await zugang.karteiZugang(anfrage('/', dienst('fremd')))).toBeNull();
    // nurInhaber: Systemlauf (Zulieferer) darf weiter, eine Person nur als Inhaber.
    expect(await zugang.nurInhaber(anfrage('/', dienst()))).toBe(true);
    expect(await zugang.nurInhaber(anfrage('/', dienst('kevin')))).toBe(true);
    expect(await zugang.nurInhaber(anfrage('/', dienst('malin')))).toBe(false);
    expect(await zugang.nurInhaber(anfrage('/', dienst('fremd')))).toBe(false);
  });
});

describe('ZOE-Werkzeuge der Markttraktion prüfen selbst (K1)', () => {
  it('jedes CRM-Werkzeug: fremdes Konto → KEIN_CRM, ohne Person → KEINE_PERSON, nichts gelesen oder geschrieben', async () => {
    const vorher = JSON.stringify([await db.loadJson('kontakte'), await db.loadJson('crm')]);
    for (const name of W.CRM_WERKZEUGE) {
      const eingabe = { kontakt: 'Anna', frage: 'Anna', name: 'Beispiel AG', art: 'notiz', an: 'malin', naechster_schritt: 'x', faellig: '2026-10-01' };
      expect(await W.WERKZEUGE[name].lauf(eingabe, 'http://test', 'fremd'), name).toBe(W.KEIN_CRM);
      expect(await W.WERKZEUGE[name].lauf(eingabe, 'http://test', 'ohne'), name).toBe(W.KEIN_CRM);
      expect(await W.WERKZEUGE[name].lauf(eingabe, 'http://test', undefined), name).toMatch(/^Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person/);
    }
    expect(JSON.stringify([await db.loadJson('kontakte'), await db.loadJson('crm')])).toBe(vorher);
  });
  it('im Haushalt des Inhabers läuft das Werkzeug', async () => {
    expect(await W.WERKZEUGE.suche_kontakt.lauf({ frage: 'Anna' }, 'http://test', 'malin')).toContain('c-anna');
  });
  it('auch über fuehreAus (Stapel-Freigabe, Aufträge) — fremde Person bekommt nichts', async () => {
    const { fuehreAus } = await import('@/lib/zoe/ausfuehren');
    const r = await fuehreAus('suche_kontakt', { frage: 'Anna' }, 'http://test', { person: 'fremd', erzwingen: true });
    expect(r.ok).toBe(false);
    expect(r.text).not.toContain('c-anna');
  });
  it('starte_auftraege: Agenten, die die Kartei lesen, nicht für fremde Konten', async () => {
    expect(await W.WERKZEUGE.starte_auftraege.lauf({ auftraege: [{ agent: 'crm' }] }, 'http://test', 'fremd')).toBe(W.KEIN_CRM);
    expect(await W.crmWerkzeugErlaubt('malin')).toBe(true);
    expect(await W.crmWerkzeugErlaubt(null)).toBe(false);
  });
});

describe('kimmi bietet CRM-Werkzeuge und -Agenten nur im Haushalt des Inhabers an (K1)', () => {
  const zug = async (kopf: Record<string, string>) => {
    const { POST } = await import('@/app/api/kimmi/route');
    mitschnitt.length = 0;
    const r = await POST(anfrage('/api/kimmi', kopf, 'POST', { message: 'Wen soll ich heute anrufen?' }));
    expect(r.status).toBe(200);
    const tools = mitschnitt[0]?.tools ?? [];
    const namen = tools.map(t => t.name);
    const agenten = tools.find(t => t.name === 'run_agent')?.input_schema?.properties?.agent?.enum ?? [];
    const auftraege = tools.find(t => t.name === 'starte_auftraege')?.input_schema?.properties?.auftraege?.items?.properties?.agent?.enum ?? [];
    return { namen, agenten, auftraege };
  };
  it('fremdes Konto bzw. Konto ohne Haushalt: kein Gespräch überhaupt (403, kein Modellaufruf — Routen-Register 05.10.)', async () => {
    const { POST } = await import('@/app/api/kimmi/route');
    for (const p of ['fremd', 'ohne']) {
      mitschnitt.length = 0;
      const r = await POST(anfrage('/api/kimmi', sitzung(p), 'POST', { message: 'Wen soll ich heute anrufen?' }));
      expect(r.status, p).toBe(403);
      expect(mitschnitt.length, p).toBe(0);
    }
  });
  it('Dienstweg ohne Person (fiele früher auf „kevin“): kein Gespräch überhaupt (S1: 400, kein Modellaufruf)', async () => {
    const { POST } = await import('@/app/api/kimmi/route');
    mitschnitt.length = 0;
    const r = await POST(anfrage('/api/kimmi', dienst(), 'POST', { message: 'Wen soll ich heute anrufen?' }));
    expect(r.status).toBe(400);
    expect(mitschnitt.length).toBe(0);
  });
  it('Kevin/Malin: CRM-Werkzeuge und -Agenten sind da', async () => {
    const z = await zug(sitzung('malin'));
    for (const n of W.CRM_WERKZEUGE) expect(z.namen, n).toContain(n);
    expect(z.agenten).toContain('crm');
  });
});

describe('Routen: Heads und CRM-Routen nur mit Person im Haushalt (K1, Regel 5)', () => {
  it('Heads GET/POST: fremdes Konto und Dienstweg ohne Person → 403', async () => {
    const heads = await import('@/app/api/heads/[head]/route');
    const p = { params: Promise.resolve({ head: 'sales' }) };
    expect((await heads.GET(anfrage('/api/heads/sales', sitzung('fremd')), p)).status).toBe(403);
    expect((await heads.GET(anfrage('/api/heads/sales', dienst()), { params: Promise.resolve({ head: 'sales' }) })).status).toBe(403);
    expect((await heads.POST(anfrage('/api/heads/sales', dienst('fremd'), 'POST', { aktion: 'daten', modus: 'power_hour' }), { params: Promise.resolve({ head: 'sales' }) })).status).toBe(403);
    expect((await heads.POST(anfrage('/api/heads/sales', dienst(), 'POST', { aktion: 'daten', modus: 'power_hour' }), { params: Promise.resolve({ head: 'sales' }) })).status).toBe(403);
    const ev = await import('@/app/api/heads/eval/route');
    expect((await ev.GET(anfrage('/api/heads/eval?head=sales', sitzung('fremd')))).status).toBe(403);
  });
  // Begründete Änderung (08.10., Markttraktion Sofort-Paket 6.1): Der Takt ruft die Heads als Systemlauf OHNE Person (Dienstweg) — bis
  // hierher war das 403, und Wochen-, Lead-, Kundenreview, alle Marketing- und Event-Läufe liefen nie (still pausiert). Jetzt trägt die
  // Route GENAU diesen einen Weg (`imHaushaltOderSystemlauf`): `lauf` + `ausgeloest: 'takt'` + ein Modus ohne Person. Alles andere ohne
  // Person bleibt 403 (oben: `daten`), ebenso jeder fremde Haushalt, Testkunde und Dienstweg im Auftrag einer fremden Person.
  it('Heads POST: nur der Takt-Lauf ohne Person geht (6.1) — alles andere ohne Person und jeder Fremde bleibt 403', async () => {
    const heads = await import('@/app/api/heads/[head]/route');
    const p = (head = 'marketing') => ({ params: Promise.resolve({ head }) });
    const lauf = { aktion: 'lauf', modus: 'netzwerk', ausgeloest: 'takt' };
    const r = await heads.POST(anfrage('/api/heads/marketing', dienst(), 'POST', lauf), p());
    expect(r.status).toBe(200);
    const d = await r.json() as { ok: boolean; bericht?: { person?: string } };
    expect(d.ok).toBe(true);
    expect(d.bericht?.person).toBeUndefined(); // kein Rückfall auf ein Kürzel (Regel 5)
    for (const body of [{ ...lauf, ausgeloest: 'hand' }, { ...lauf, ausgeloest: 'zoe' }, { aktion: 'lauf', modus: 'frage', frage: 'x', ausgeloest: 'takt' }, { aktion: 'entscheiden', id: 'x', status: 'abgelehnt' }, { aktion: 'merken', text: 'x' }, { aktion: 'autonomie', an: false }]) {
      expect((await heads.POST(anfrage('/api/heads/marketing', dienst(), 'POST', body), p())).status, JSON.stringify(body)).toBe(403);
    }
    // Power Hour braucht immer eine Person (ihre Karten).
    expect((await heads.POST(anfrage('/api/heads/sales', dienst(), 'POST', { aktion: 'lauf', modus: 'power_hour', ausgeloest: 'takt' }), p('sales'))).status).toBe(403);
    for (const kopf of [sitzung('fremd'), sitzung('ohne'), dienst('fremd'), dienst('ohne'), dienst('niemand')]) {
      expect((await heads.POST(anfrage('/api/heads/marketing', kopf, 'POST', lauf), p())).status).toBe(403);
    }
  });
  it('deal, followup, kampagnen, netzwerk, bestand: Dienstweg ohne Person → 403, nichts geschrieben', async () => {
    const vorher = JSON.stringify([await db.loadJson('kontakte'), await db.loadJson('crm')]);
    const deal = await import('@/app/api/crm/deal/route');
    const fu = await import('@/app/api/crm/followup/route');
    const kp = await import('@/app/api/crm/kampagnen/route');
    const nw = await import('@/app/api/crm/netzwerk/route');
    const bestand = await import('@/app/api/crm/bestand/route');
    for (const kopf of [dienst(), dienst('fremd'), sitzung('ohne')]) {
      expect((await deal.POST(anfrage('/api/crm/deal', kopf, 'POST', { aktion: 'anlegen', kontaktIds: ['c-anna'], schritt: { text: 'x', datum: '2026-10-01' } }))).status).toBe(403);
      expect((await fu.POST(anfrage('/api/crm/followup', kopf, 'POST', { aktion: 'anlegen', kontaktId: 'c-anna', text: 'x', faellig: '2030-01-01' }))).status).toBe(403);
      expect((await kp.POST(anfrage('/api/crm/kampagnen', kopf, 'POST', { aktion: 'planen', playbook: 'vernetzen' }))).status).toBe(403);
      expect((await nw.POST(anfrage('/api/crm/netzwerk', kopf, 'POST', { aktion: 'nicht_gefunden', id: 'c-anna' }))).status).toBe(403);
      expect((await nw.GET(anfrage('/api/crm/netzwerk', kopf))).status).toBe(403);
      expect((await bestand.GET(anfrage('/api/crm/bestand', kopf))).status).toBe(403);
      expect((await bestand.PATCH(anfrage('/api/crm/bestand', kopf, 'PATCH', { ops: [{ liste: 'firmen', op: 'upsert', eintrag: { id: 'f-x1', name: 'X', rolle: 'offen' } }] }))).status).toBe(403);
    }
    expect(JSON.stringify([await db.loadJson('kontakte'), await db.loadJson('crm')])).toBe(vorher);
    // Mit Person im Haushalt geht es — und die Person ist die benannte (nicht „kevin“).
    const r = await fu.POST(anfrage('/api/crm/followup', dienst('malin'), 'POST', { aktion: 'anlegen', kontaktId: 'c-anna', text: 'Anrufen', faellig: '2030-01-01' }));
    expect(r.status).toBe(200);
    expect((await r.json()).followup).toMatchObject({ kontaktId: 'c-anna' });
    const crm = await db.loadJson<{ followups: { geaendertVon?: string }[] }>('crm');
    expect(crm!.followups.at(-1)!.geaendertVon).toBe('malin');
  });
});
