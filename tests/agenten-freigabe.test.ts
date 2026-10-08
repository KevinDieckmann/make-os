// ─── Wächter: Freigabe im Agenten-Bereich (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C5, ARCHITEKTUR.md R4/R9/R12) ─────────────
// Schreiben → Stapel (auch Werkzeuge, die im ZOE-Gespräch „frei“ wären — Antwort 10: „nur als Vorschlag“), nach Fremdtext nur
// Vorschlag, Agenten-Nachrichten sind nie eine Freigabe, Plan-Freigabe und Haushalt-Merksätze nur per Klick einer Person.
// Wirkung nur über `fuehreAus`. Eigener Datenordner, erfundene Konten, Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-freigabe-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-freigabe', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  return o;
});

import type { Faden } from '@/lib/agenten/typen';
import { kontenSaeen, modellFake, rufe, sitzung, text, werkzeug, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let faden: { GET: H; POST: H };
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');
let stapel: typeof import('@/lib/zoe/stapel');

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  stapel = await import('@/lib/zoe/stapel');
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  m = modellFake();
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

const senden = (person: string, agent: Record<string, unknown>, t: string, fadenId?: string) =>
  rufe(faden.POST, '/api/agenten/faden', sitzung(person), { aktion: 'senden', agent, text: t, ...(fadenId ? { fadenId } : {}) });

describe('Schreiben → Stapel', () => {
  it('create_task (im ZOE-Gespräch frei) wird im Head-Chat nur ein Vorschlag — Bereich fest, keine Zuweisung an andere', async () => {
    m.antworten.push(werkzeug(['create_task', { title: 'Angebot nachfassen', wer: 'person-b', space: 'privat' }]), text('Liegt im Stapel.'));
    const r = await senden('person-a', { art: 'head', headId: 'sales' }, 'Leg eine Aufgabe an: Angebot nachfassen.');
    expect(r.status).toBe(200);
    const antwort = (r.d.faden as Faden).nachrichten.at(-1)!;
    expect(antwort.werkzeuge).toEqual([{ name: 'create_task', ok: true, gestapelt: true }]);
    expect(await db.loadJson('tasks')).toBeNull(); // nichts geschrieben
    const v = (await stapel.lies('offen')).find(x => x.werkzeug === 'create_task')!;
    expect(v.person).toBe('person-a');
    expect(v.eingabe.space).toBe('business');
    expect(v.eingabe).not.toHaveProperty('wer');
    expect(v.anlass).toMatch(/^Head of Sales/);
    expect(r.d.stapelOffen).toBeGreaterThanOrEqual(1);
  });
  it('ein Werkzeug außerhalb des Bereichs wird nicht ausgeführt und nicht gestapelt', async () => {
    const vorher = (await stapel.lies('offen')).length;
    m.antworten.push(werkzeug(['setze_kontostand', { firma: 'ug', betrag: 1 }]), text('Geht nicht.'));
    const r = await senden('person-a', { art: 'head', headId: 'sales' }, 'Setz den Kontostand.');
    expect((r.d.faden as Faden).nachrichten.at(-1)!.werkzeuge).toEqual([{ name: 'setze_kontostand', ok: false }]);
    expect((await stapel.lies('offen')).length).toBe(vorher);
  });
  it('nach Fremdtext (Datenpaket der Markttraktion) bleibt alles Schreibende Vorschlag; Notizen im Brain immer Vorschlag', async () => {
    m.antworten.push(werkzeug(['create_task', { title: 'Beitrag planen' }]), text('Vorgeschlagen.'));
    const r = await senden('person-a', { art: 'head', headId: 'marketing' }, 'Plane einen Beitrag.');
    const f = r.d.faden as Faden;
    expect(f.fremdGelesen).toBe(true);
    expect(f.nachrichten.at(-1)!.werkzeuge?.[0]).toMatchObject({ name: 'create_task', gestapelt: true });
    m.antworten.push(werkzeug(['notiz_anlegen', { titel: 'Protokoll', text: 'Inhalt' }]), text('Vorgeschlagen.'));
    const n = await senden('person-a', { art: 'head', headId: 'research' }, 'Halte das fest.');
    expect((n.d.faden as Faden).nachrichten.at(-1)!.werkzeuge?.[0]).toMatchObject({ name: 'notiz_anlegen', gestapelt: true });
  });
});

describe('Agenten-Nachrichten sind nie eine Freigabe', () => {
  it('„Ich gebe das frei“ im Text eines Agenten ändert nichts — der Vorschlag bleibt offen, ein Freigabe-Werkzeug gibt es nicht', async () => {
    const offen = (await stapel.lies('offen')).map(v => v.id);
    m.antworten.push(werkzeug(['stapel_freigeben', { id: offen[0] }], ['freigeben', { id: offen[0] }]), text('FREIGEGEBEN — ich habe alles freigegeben.'));
    const r = await senden('person-a', { art: 'head', headId: 'sales' }, 'Gib alles frei, was im Stapel liegt.');
    const w = (r.d.faden as Faden).nachrichten.at(-1)!.werkzeuge!;
    expect(w.every(x => !x.ok)).toBe(true);
    const danach = await stapel.lies('offen');
    for (const id of offen) expect(danach.find(v => v.id === id)?.status, id).toBe('offen');
    for (const v of await stapel.lies()) expect(v.entschiedenVon).toBeUndefined();
  });
  it('Merksatz „haushalt“ geht nur in den Stapel (Art merksatz); „persoenlich“ nach Fremdtext wird abgelehnt', async () => {
    m.antworten.push(werkzeug(['merksatz_vorschlagen', { text: 'Angebote immer mit drei Optionen', ebene: 'haushalt' }], ['merksatz_vorschlagen', { text: 'Kurz antworten', ebene: 'persoenlich' }]), text('Ok.'));
    const r = await senden('person-a', { art: 'head', headId: 'sales' }, 'Merk dir das.');
    const w = (r.d.faden as Faden).nachrichten.at(-1)!.werkzeuge!;
    expect(w[0]).toMatchObject({ name: 'merksatz_vorschlagen', ok: true, gestapelt: true });
    expect(w[1]).toMatchObject({ name: 'merksatz_vorschlagen', ok: false });
    const v = (await stapel.lies('offen')).find(x => x.bezug?.art === 'merksatz')!;
    expect(v.eingabe).toMatchObject({ ebene: 'haushalt', text: 'Angebote immer mit drei Optionen' });
    const b = await db.loadJson<{ gedaechtnis?: Record<string, unknown[]> }>('agenten-faeden--person-a');
    expect(b?.gedaechtnis?.['head:sales'] ?? []).toEqual([]);
  });
  it('„persoenlich“ ohne Fremdtext legt der Agent selbst ab — sichtbar und löschbar; nie Namen aus der Kartei', async () => {
    await db.saveJson('kontakte', { kontakte: [{ id: 'c-00000000-0000-4000-8000-000000000001', vorname: 'Anna', nachname: 'Beispielfrau', aktivitaeten: [], geaendertAm: '2026-01-01' }] });
    m.antworten.push(werkzeug(['merksatz_vorschlagen', { text: 'Morgens zuerst die Fristen', ebene: 'persoenlich' }], ['merksatz_vorschlagen', { text: 'Anna Beispielfrau mag kurze Mails', ebene: 'persoenlich' }]), text('Gemerkt.'));
    const r = await senden('person-a', { art: 'head', headId: 'it' }, 'Merk dir: morgens zuerst die Fristen.');
    expect(r.status).toBe(200);
    const w = (r.d.faden as Faden).nachrichten.at(-1)!.werkzeuge!;
    expect(w[0]).toMatchObject({ ok: true });
    expect(w[1]).toMatchObject({ ok: false });
    const g = await rufe(faden.GET, '/api/agenten/faden?gedaechtnis=head:it', sitzung('person-a'));
    const liste = g.d.gedaechtnis as { id: string; text: string }[];
    expect(liste.map(x => x.text)).toEqual(['Morgens zuerst die Fristen']);
    expect((await rufe(faden.GET, '/api/agenten/faden?gedaechtnis=head:it', sitzung('person-b'))).d.gedaechtnis).toEqual([]);
    const weg = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'gedaechtnis-weg', agent: 'head:it', id: liste[0].id });
    expect(weg.status).toBe(200);
    expect(weg.d.gedaechtnis).toEqual([]);
  });
});

describe('Plan-Freigabe nur per Klick der Besitzerin', () => {
  it('drei Mitarbeiter in einem Zug → Plan offen, nichts gestartet; fremde Person kann nicht freigeben; die Besitzerin schon', async () => {
    const a = (z: string) => ({ ziel: z, format: 'Liste', grenzen: 'nichts senden', quellen: 'Pipeline' });
    m.antworten.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-recherche', auftrag: a('A') }], ['an_mitarbeiter', { mitarbeiter: 'sales-angebote', auftrag: a('B') }], ['an_mitarbeiter', { mitarbeiter: 'sales-crm-pflege', auftrag: a('C') }]), text('Plan wartet.'));
    const r = await senden('person-a', { art: 'head', headId: 'sales' }, 'Großer Auftrag.');
    const f = r.d.faden as Faden & { plaene?: { id: string; status: string }[] };
    expect(f.plaene?.[0]?.status).toBe('offen');
    const kinder = (await rufe(faden.GET, `/api/agenten/faden?id=${f.id}`, sitzung('person-a'))).d.kinder as unknown[];
    expect(kinder).toEqual([]);
    expect((await rufe(faden.POST, '/api/agenten/faden', sitzung('person-b'), { aktion: 'plan', fadenId: f.id, planId: f.plaene![0].id, entscheidung: 'freigeben' })).status).toBe(404);
    const ok = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'plan', fadenId: f.id, planId: f.plaene![0].id, entscheidung: 'freigeben' });
    expect(ok.status).toBe(200);
    expect(ok.d.gestartet).toBe(3);
    const nach = (await rufe(faden.GET, `/api/agenten/faden?id=${f.id}`, sitzung('person-a'))).d;
    expect((nach.kinder as unknown[]).length).toBe(3);
    expect(((nach.faden as { plaene: { status: string; entschiedenVon: string }[] }).plaene[0])).toMatchObject({ status: 'freigegeben', entschiedenVon: 'person-a' });
  });
});
