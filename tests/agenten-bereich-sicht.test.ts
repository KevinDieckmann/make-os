// ─── Wächter: Agenten-Seite und Empfang je Sicht (09.10. spät, Kevin: „Agenten-Seite und Empfang auch trennen“) ─────────────
// Der Kopf kennt Privat · Business. Heads, Threads, Läufe, Hintergrundaufgaben und „Als Nächstes“ kommen nur aus dem Bereich der Sicht —
// gefiltert auf dem SERVER an EINER Stelle (lib/agenten/sicht.ts), nie bloß in der Oberfläche: „Sicht Privat bekommt keinen Business-Thread/-Lauf“
// (und umgekehrt). Ohne erkennbaren Bereich (Systemlauf, ZOE-Plan) → in beiden. Eigener Datenordner, erfundene Konten — Netz gesperrt, Modell aus.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-bereich-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-bereich';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

import { fadenBestand, planBestand, LAUF_AGENT, type Faden } from '@/lib/agenten/typen';
import { imBereichDerSicht, fadenImBereich, laufImBereich, naechstesImBereich, planImBereich, headImBereich, sichtBereichAus } from '@/lib/agenten/sicht';

type H = (r: Request) => Promise<Response>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const JETZT = new Date();
const VOR = (min: number) => new Date(JETZT.getTime() - min * 60_000).toISOString();
const tag = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(JETZT);
const B = 'MARKE-BUSINESS', P = 'MARKE-PRIVAT';

const faden = (id: string, extra: Partial<Faden>): Faden => ({
  id, besitzer: 'person-a', agent: { art: 'zoe' }, bereich: 'privat', titel: `Thread ${id}`, status: 'offen',
  fremdGelesen: false, vertraulich: false, nachrichten: [], erstellt: VOR(30), aktualisiert: VOR(1), ...extra,
});

let routen: { agenten: { GET: H }; faden: { GET: H }; laeufe: { GET: H } };
const hole = async (r: { GET: H }, pfad: string) => { const a = await r.GET(new Request(`http://test${pfad}`, { headers: sitzung('person-a') })); return { status: a.status, text: await a.text() }; };

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  const db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-a' });
  await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber')], einladungen: [] });
  // Business-frei leer (sonst ruhen Business-Läufe am Abend — uhrzeitunabhängig, wie agenten-durchstich).
  await db.saveJson('familie--haus-a', { businessFrei: [] });
  await db.saveJson('zoe-auftraege', { auftraege: [
    { id: 'a-b', zeit: VOR(5), tag: tag(), art: 'agent', name: LAUF_AGENT, eingabe: { art: 'faden', fadenId: 'fd-head-business' }, auftrag: '{"art":"faden","fadenId":"fd-head-business"}', schluessel: 'sb', status: 'offen', versuche: 0, person: 'person-a' },
    { id: 'a-p', zeit: VOR(5), tag: tag(), art: 'agent', name: LAUF_AGENT, eingabe: { art: 'faden', fadenId: 'fd-head-privat' }, auftrag: '{"art":"faden","fadenId":"fd-head-privat"}', schluessel: 'sp', status: 'offen', versuche: 0, person: 'person-a' },
  ] });
  const lauf = (auftragId: string) => ({ auftragId, status: 'wartet' as const, schritte: [], start: VOR(5), kostenCent: 0 });
  await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [
    faden('fd-head-business', { agent: { art: 'head', headId: 'marketing' }, bereich: 'business', titel: `${B}-HEAD`, status: 'laeuft', lauf: lauf('a-b') }),
    faden('fd-head-privat', { agent: { art: 'head', headId: 'assistenz' }, bereich: 'privat', titel: `${P}-HEAD`, status: 'laeuft', lauf: lauf('a-p') }),
    faden('fd-zoe-business', { bereich: 'business', titel: `${B}-ZOE` }),
    faden('fd-zoe-privat', { bereich: 'privat', titel: `${P}-ZOE` }),
  ] });
  await db.saveJson(planBestand('person-a'), { v: 1, aufgaben: [
    { id: 'hg-b', besitzer: 'person-a', agent: { art: 'head', headId: 'operations' }, titel: `${B}-PLAN`, auftrag: 'Ziel: x', zeitplan: { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [1] }, aktiv: true, erstellt: VOR(100) },
    { id: 'hg-p', besitzer: 'person-a', agent: { art: 'head', headId: 'assistenz' }, titel: `${P}-PLAN`, auftrag: 'Ziel: y', zeitplan: { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [1] }, aktiv: true, erstellt: VOR(100) },
  ] });
  routen = {
    agenten: await import('@/app/api/agenten/route') as unknown as { GET: H },
    faden: await import('@/app/api/agenten/faden/route') as unknown as { GET: H },
    laeufe: await import('@/app/api/agenten/laeufe/route') as unknown as { GET: H },
  };
});

describe('EINE Filterstelle (rein)', () => {
  it('Sicht aus ?space=, unklar in beiden, Thread/Lauf/Plan/„Als Nächstes“ nach ihrem Bereich', () => {
    expect([sichtBereichAus(null), sichtBereichAus('alles'), sichtBereichAus('privat'), sichtBereichAus('quatsch')]).toEqual([null, null, 'privat', undefined]);
    expect([imBereichDerSicht('privat', 'business'), imBereichDerSicht(undefined, 'business'), imBereichDerSicht('business', null)]).toEqual([false, true, true]);
    expect(headImBereich('marketing', 'privat')).toBe(false);
    expect(headImBereich('assistenz', 'privat')).toBe(true);
    expect(fadenImBereich({ bereich: 'business', agent: { art: 'zoe' } }, 'privat')).toBe(false);
    expect(fadenImBereich({ agent: { art: 'head', headId: 'marketing' } }, 'business')).toBe(true);
    const m = new Map<string, unknown>([['fd-1', 'privat']]);
    expect(laufImBereich({ fadenId: 'fd-1', headId: 'marketing' }, 'business', m)).toBe(false); // der Thread entscheidet
    expect(laufImBereich({ headId: 'marketing' }, 'privat', m)).toBe(false);
    expect(laufImBereich({}, 'privat', m)).toBe(true); // Systemlauf → beide
    expect(planImBereich({ agent: { art: 'zoe' } }, 'business')).toBe(true);
    expect(naechstesImBereich({ bereich: 'privat', headId: 'marketing' }, 'business')).toBe(false); // eigener Bereich vor dem Head
  });
});

describe('Wächter: Sicht Privat bekommt keinen Business-Thread/-Lauf — und umgekehrt', () => {
  it('Thread-Liste und einzelner Thread', async () => {
    const p = await hole(routen.faden, '/api/agenten/faden?space=privat');
    expect(p.status).toBe(200);
    expect(p.text).toContain(`${P}-HEAD`);
    expect(p.text).toContain(`${P}-ZOE`);
    expect(p.text).not.toContain(B);
    const b = await hole(routen.faden, '/api/agenten/faden?space=business');
    expect(b.text).toContain(`${B}-ZOE`);
    expect(b.text).not.toContain(P);
    expect((await hole(routen.faden, '/api/agenten/faden?space=privat&id=fd-zoe-business')).status).toBe(404);
    expect((await hole(routen.faden, '/api/agenten/faden?id=fd-zoe-business')).status).toBe(200); // ohne Sicht wie bisher
    expect((await hole(routen.faden, '/api/agenten/faden?space=quatsch')).status).toBe(400);
    // ZOE-Empfang: der jüngste ZOE-Thread dieses Bereichs.
    const z = await hole(routen.faden, '/api/agenten/faden?agent=zoe&space=business');
    expect(JSON.parse(z.text).faeden.map((f: { id: string }) => f.id)).toEqual(['fd-zoe-business']);
  });
  it('Heads, Threads und Überblick der Agenten-Seite', async () => {
    const p = await hole(routen.agenten, '/api/agenten?space=privat');
    expect(p.status).toBe(200);
    const d = JSON.parse(p.text) as { heads: { id: string; bereich: string }[] };
    expect(d.heads.length).toBeGreaterThan(0);
    expect(d.heads.every(h => h.bereich === 'privat')).toBe(true);
    expect(p.text).not.toContain(B);
    const b = JSON.parse((await hole(routen.agenten, '/api/agenten?space=business')).text) as { heads: { bereich: string }[] };
    expect(b.heads.every(h => h.bereich === 'business')).toBe(true);
    expect((await hole(routen.agenten, '/api/agenten?space=quatsch')).status).toBe(400);
  });
  it('Hintergrund: Läufe, geplante Aufgaben', async () => {
    const p = await hole(routen.laeufe, '/api/agenten/laeufe?space=privat');
    expect(p.status).toBe(200);
    const d = JSON.parse(p.text) as { laeufe: { fadenId?: string }[]; plan: { id: string }[]; planStaende: Record<string, string> };
    expect(d.laeufe.map(l => l.fadenId)).toContain('fd-head-privat');
    expect(d.laeufe.map(l => l.fadenId)).not.toContain('fd-head-business');
    expect(d.plan.map(x => x.id)).toEqual(['hg-p']);
    expect(Object.keys(d.planStaende)).toEqual(['hg-p']);
    expect(p.text).not.toContain(B);
    const b = await hole(routen.laeufe, '/api/agenten/laeufe?space=business');
    expect(b.text).not.toContain(P);
    expect((JSON.parse(b.text) as { plan: { id: string }[] }).plan.map(x => x.id)).toEqual(['hg-b']);
    // Ohne Sicht wie bisher alles.
    const alle = JSON.parse((await hole(routen.laeufe, '/api/agenten/laeufe')).text) as { plan: { id: string }[] };
    expect(alle.plan.map(x => x.id).sort()).toEqual(['hg-b', 'hg-p']);
  });
});
