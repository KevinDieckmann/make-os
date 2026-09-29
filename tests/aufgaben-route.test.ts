// ─── Aufgaben-Routen (28.09. abends): Zugang, Stand/409, 413, Protokoll, Meldungen, Übernahme ──
// Eigener Datenordner, erfundene Konten und Aufgaben. melde() wird mitgeschnitten (Glocke ist eigenes Paket).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-aufgaben-route-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-aufgaben-route';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const gemeldet: { an: string; art: string; titel: string; von?: string; link: string }[] = [];
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string; von?: string; link: string }) => { gemeldet.push(m); } }));

type Handler = (r: Request) => Promise<Response>;
type Route = { GET: Handler; PATCH: Handler; PUT: Handler };
let route: Route;
let anlegen: { POST: Handler };
let db: typeof import('@/lib/store/local-db');

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'proj-kdm', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, ...extra });
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown, pfad = '/api/state/tasks') => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type Zeile = { id: string; stand: string; [k: string]: unknown };
const lesen = async (person = 'kevin') => (await (await route.GET(anfrage(sitzung(person)))).json()) as { state: { tasks: Zeile[]; projects: Zeile[]; listen: Zeile[]; statusEigen: Zeile[] }; spaces: { id: string; archiv?: boolean }[] };
const gespeichert = async () => (await db.loadJson<{ tasks: Record<string, unknown>[]; projects: Record<string, unknown>[]; listen?: unknown[] }>('tasks'))!;
const protokoll = async () => {
  const namen = (await import('node:fs')).readdirSync(ordner).filter(n => n.startsWith('aenderungsprotokoll--'));
  const alle: Record<string, unknown>[] = [];
  for (const n of namen) alle.push(...(((await db.loadJson<{ eintraege: Record<string, unknown>[] }>(n.replace(/\.json$/, '')))?.eintraege) ?? []));
  return alle;
};

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'),
    konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus'),
    konto('k3', 'fremd', 'Fremd', 'mitglied', 'test'),
    konto('k4', 'ohne', 'Ohne', 'mitglied'),
  ], einladungen: [] });
  await db.saveJson('crm', { firmen: [{ id: 'f-beispiel', name: 'Beispiel Mandant GmbH', rolle: 'kunde', geaendert: T0 }, { id: 'f-alt', name: 'Beispiel Alt AG', rolle: 'ex_kunde', geaendert: T0 }],
    mandate: [{ id: 'mandat-1', kunde: 'Beispiel Mandant GmbH', firmaId: 'f-beispiel', status: 'aktiv', kontaktIds: [], titel: 'Buchhaltung', art: 'retainer', gesellschaft: 'kdc', vertragUnterschrieben: true, verlaengerung: 'auto', honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: T0 },
      { id: 'mandat-2', kunde: 'Beispiel Alt AG', firmaId: 'f-alt', status: 'beendet', kontaktIds: [], titel: 'Alt', art: 'projekt', gesellschaft: 'kdv', vertragUnterschrieben: true, verlaengerung: 'manuell', honorar: { betrag: 0, basis: 'einmalig', netto: true }, ustSatz: 19, rechnungsrhythmus: 'einmalig', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], geaendert: T0 }] });
  route = (await import('@/app/api/state/tasks/route')) as unknown as Route;
  anlegen = (await import('@/app/api/tasks/create/route')) as unknown as { POST: Handler };
});
beforeEach(async () => {
  gemeldet.length = 0;
  // Altbestand: ohne spaceId, mit alten subTasks — die Übernahme passiert beim Lesen/Schreiben.
  await db.saveJson('tasks', { projects: [{ id: 'proj-kdm', title: 'KD Ventures', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0 }, { id: 'proj-privat', title: 'Zuhause', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0 }],
    tasks: [aufgabe('a1'), aufgabe('a2', { projectId: 'proj-privat', title: 'Keller', subTasks: [{ id: 's1', taskId: 'a2', title: 'Regal', completed: false, sortOrder: 0, createdAt: T0, updatedAt: T0 }] })] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Zugang: nur Haushalt des Inhabers', () => {
  it('GET: fremdes Konto / ohne Haushalt / unbekannt 403 · Inhaber-Haushalt 200 · Systemlauf 200 · Dienst mit fremder Person 403', async () => {
    for (const p of ['fremd', 'ohne', 'niemand']) expect((await route.GET(anfrage(sitzung(p)))).status).toBe(403);
    expect((await route.GET(anfrage(sitzung('malin')))).status).toBe(200);
    expect((await route.GET(anfrage(dienst()))).status).toBe(200);
    expect((await route.GET(anfrage(dienst('fremd')))).status).toBe(403);
    expect((await route.GET(anfrage({}))).status).toBe(403);
  });
  it('PATCH/PUT: fremdes Konto 403, Dienst ohne Person 403, Dienst mit Person des Haushalts 200', async () => {
    const b = { ops: [{ op: 'upsert', task: aufgabe('neu') }] };
    expect((await route.PATCH(anfrage(sitzung('fremd'), 'PATCH', b))).status).toBe(403);
    expect((await route.PATCH(anfrage(dienst(), 'PATCH', b))).status).toBe(403);
    expect((await route.PUT(anfrage(sitzung('ohne'), 'PUT', { projects: [], tasks: [] }))).status).toBe(403);
    expect((await route.PATCH(anfrage(dienst('malin'), 'PATCH', b))).status).toBe(200);
  });
  it('/api/tasks/create: fremdes Konto 403, Systemlauf darf (mit owner — S1: ohne → 400, kein Rückfall auf „kevin“)', async () => {
    expect((await anlegen.POST(anfrage(sitzung('fremd'), 'POST', { title: 'X' }, '/api/tasks/create'))).status).toBe(403);
    expect((await anlegen.POST(anfrage(dienst(), 'POST', { title: 'Vom Takt ohne owner' }, '/api/tasks/create'))).status).toBe(400);
    const r = await anlegen.POST(anfrage(dienst(), 'POST', { title: 'Vom Takt', owner: 'kevin' }, '/api/tasks/create'));
    expect(r.status).toBe(200);
  });
});

describe('Lesen: Übernahme + Spaces aus dem CRM', () => {
  it('liefert Space je Aufgabe, echte Unteraufgaben, Stand je Zeile und Mandanten-Spaces (aktiv + Archiv)', async () => {
    const d = await lesen();
    const t = Object.fromEntries(d.state.tasks.map(x => [x.id, x]));
    expect(t.a1).toMatchObject({ spaceId: 'kdv', space: 'business', einheit: 'KD Ventures' });
    expect(t.a2).toMatchObject({ spaceId: 'privat', subTasks: [] });
    expect(t['a2--s1']).toMatchObject({ parentId: 'a2', title: 'Regal', spaceId: 'privat' });
    expect(d.state.tasks.every(x => typeof x.stand === 'string' && x.stand.length > 5)).toBe(true);
    expect(d.spaces.map(s => s.id)).toEqual(['privat', 'kdc', 'kdv', 'ug', 'm-f-beispiel', 'm-f-alt']);
    expect(d.spaces.find(s => s.id === 'm-f-alt')!.archiv).toBe(true);
    // Lesen schreibt nichts.
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.spaceId).toBeUndefined();
  });
});

describe('Schreiben', () => {
  it('Stand: aktueller Stand geht durch, veralteter → 409 mit konflikte + aktuellem Bestand, nichts überschrieben', async () => {
    const d = await lesen();
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    const ok = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, title: 'Neu von Kevin' }, stand: a1.stand }] }));
    expect(ok.status).toBe(200);
    const okD = await ok.json() as { zeilen: { liste: string; id: string; stand: string }[] };
    expect(okD.zeilen.find(z => z.id === 'a1')!.stand).not.toBe(a1.stand);
    // Malin schreibt mit dem alten Stand → 409
    const alt = await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, title: 'Neu von Malin' }, stand: a1.stand }] }));
    expect(alt.status).toBe(409);
    const altD = await alt.json() as { konflikte: { id: string; grund: string }[]; state: { tasks: Zeile[] } };
    expect(altD.konflikte[0]).toMatchObject({ id: 'a1', grund: 'inzwischen geändert' });
    expect(altD.state.tasks.find(x => x.id === 'a1')!.title).toBe('Neu von Kevin');
    expect((await gespeichert()).tasks.find(x => x.id === 'a1')!.title).toBe('Neu von Kevin');
    // Stand im Eintrag (wie aufgabeStatusSetzen ihn zurückschickt) zählt genauso.
    const imEintrag = await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, status: 'done' } }] }));
    expect(imEintrag.status).toBe(409);
  });
  it('erster Schreibvorgang speichert die Übernahme mit (Space, Unteraufgaben) — nichts verloren', async () => {
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('b1', { spaceId: 'kdc', title: 'Neu im kdc' }) }] }));
    expect(r.status).toBe(200);
    const g = await gespeichert();
    expect(g.tasks.map(t => t.id).sort()).toEqual(['a1', 'a2', 'a2--s1', 'b1']);
    expect(g.tasks.find(t => t.id === 'a1')!.spaceId).toBe('kdv');
    expect(g.tasks.find(t => t.id === 'b1')).toMatchObject({ spaceId: 'kdc', projectId: 'proj-kdm', einheit: 'Selbstständigkeit', space: 'business' });
    expect(g.listen).toEqual([]);
  });
  it('Struktur: Projekt, Listen, eigener Status in einem Aufruf; Aufgabe mit eigenem Status trägt dessen Grundstatus', async () => {
    const r = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', {
      struktur: {
        projekte: [{ op: 'upsert', eintrag: { id: 'p-buch', title: 'Buchhaltung', spaceId: 'm-f-beispiel', color: '#6E7EF5' } }],
        listen: [{ op: 'upsert', eintrag: { id: 'l-jan', projektId: 'p-buch', titel: 'Januar', sortOrder: 0 } }, { op: 'upsert', eintrag: { id: 'l-feb', projektId: 'p-buch', titel: 'Februar', sortOrder: 1 } }],
        status: [{ op: 'upsert', eintrag: { id: 'st-stb', spaceId: 'm-f-beispiel', label: 'Beim Steuerbüro', farbe: '#A99BF5', basis: 'blocked', sortOrder: 0 } }],
      },
      ops: [
        { op: 'upsert', task: aufgabe('belege', { projectId: 'p-buch', listeId: 'l-jan', spaceId: 'm-f-beispiel', statusId: 'st-stb', title: 'Fehlende Belege', bezug: { firmaId: 'f-beispiel', mandatId: 'mandat-1' } }) },
        { op: 'upsert', task: aufgabe('beleg-1', { parentId: 'belege', title: 'Beleg Tankstelle', spaceId: 'privat', projectId: 'proj-privat' }) },
      ],
    }));
    expect(r.status).toBe(200);
    const d = await lesen();
    const t = Object.fromEntries(d.state.tasks.map(x => [x.id, x]));
    expect(t.belege).toMatchObject({ status: 'blocked', statusId: 'st-stb', einheit: 'Kunden', space: 'business', bezug: { firmaId: 'f-beispiel', mandatId: 'mandat-1' } });
    expect(t['beleg-1']).toMatchObject({ parentId: 'belege', spaceId: 'm-f-beispiel', projectId: 'p-buch', listeId: 'l-jan' });
    expect(d.state.listen.map(l => l.id).sort()).toEqual(['l-feb', 'l-jan']);
  });
  it('413 statt kürzen: zu viele Änderungen, zu viele Kommentare', async () => {
    const viele = Array.from({ length: 201 }, (_, i) => ({ op: 'upsert', task: aufgabe(`x${i}`) }));
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: viele }))).status).toBe(413);
    const kommentare = Array.from({ length: 501 }, (_, i) => ({ id: `k${i}`, von: 'kevin', text: 'x', am: T0 }));
    expect((await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('a1', { kommentare }) }] }))).status).toBe(413);
    expect((await gespeichert()).tasks.find(t => t.id === 'x0')).toBeUndefined();
  });
  it('Massenlöschung/-erledigung weiter nur mit Bestätigung', async () => {
    await db.saveJson('tasks', { projects: [], tasks: Array.from({ length: 20 }, (_, i) => aufgabe(`m${i}`)) });
    const loesch = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: Array.from({ length: 11 }, (_, i) => ({ op: 'delete', id: `m${i}` })) }));
    expect(loesch.status).toBe(409);
    expect((await loesch.json()).massenLoeschung).toBe(true);
    const fertig = await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: Array.from({ length: 13 }, (_, i) => ({ op: 'upsert', task: aufgabe(`m${i}`, { status: 'done' }) })) }));
    expect(fertig.status).toBe(409);
    expect((await gespeichert()).tasks).toHaveLength(20);
  });
  it('Änderungsprotokoll: Kennung + Feldnamen, nie Werte', async () => {
    const d = await lesen();
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, title: 'Geheimer Titel 4711', description: 'Betrag 1234 Euro' }, stand: a1.stand }] }));
    const p = await protokoll();
    const e = p.filter(x => x.bestand === 'tasks' && x.id === 'a1').at(-1)!;
    expect(e).toMatchObject({ op: 'geaendert', person: 'malin', wer: 'person', liste: 'tasks' });
    expect(e.felder).toEqual(expect.arrayContaining(['title', 'description']));
    expect(JSON.stringify(p)).not.toMatch(/Geheimer|4711|1234/);
  });
});

describe('Meldungen', () => {
  it('Zuweisung an die andere Person → melde; an sich selbst nie', async () => {
    const d = await lesen('kevin');
    const a1 = d.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, assignee: 'malin', title: 'Belege Januar' }, stand: a1.stand }] }));
    expect(gemeldet).toEqual([expect.objectContaining({ an: 'malin', art: 'zuweisung', von: 'kevin', link: '/os/aufgaben?offen=a1' })]);
    expect(gemeldet[0].titel).toBe('Kevin hat dir „Belege Januar“ zugewiesen');
    gemeldet.length = 0;
    // Kevin nimmt sich selbst eine neue Aufgabe → keine Meldung; „beide“ → nur Malin
    await route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('selbst', { assignee: 'kevin' }) }, { op: 'upsert', task: aufgabe('zusammen', { assignee: 'both' }) }] }));
    expect(gemeldet.map(m => [m.an, m.art])).toEqual([['malin', 'zuweisung']]);
  });
  it('Kommentar mit @-Erwähnung → erwaehnung; Zuständige → kommentar; nie an die schreibende Person', async () => {
    const d = await lesen('malin');
    const a1 = d.state.tasks.find(x => x.id === 'a1')!; // zuständig: kevin
    await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...a1, kommentare: [{ id: 'k1', von: 'kevin', text: 'Schau mal @kevin', am: T0, erwaehnt: ['kevin', 'malin'] }] }, stand: a1.stand }] }));
    expect(gemeldet.map(m => [m.an, m.art, m.von])).toEqual([['kevin', 'erwaehnung', 'malin']]);
    const g = (await gespeichert()).tasks.find(t => t.id === 'a1')!;
    // Der Server trägt die schreibende Person ein (nicht die behauptete).
    expect((g.kommentare as { von: string }[])[0].von).toBe('malin');
    gemeldet.length = 0;
    const d2 = await lesen('malin');
    const b = d2.state.tasks.find(x => x.id === 'a1')!;
    await route.PATCH(anfrage(sitzung('malin'), 'PATCH', { ops: [{ op: 'upsert', task: { ...b, kommentare: [...(b.kommentare as unknown[]), { id: 'k2', von: 'malin', text: 'Erledigt?', am: T0 }] }, stand: b.stand }] }));
    expect(gemeldet.map(m => [m.an, m.art])).toEqual([['kevin', 'kommentar']]);
  });
  it('/api/tasks/create: Zuweisung an die andere Person meldet, Space/Sonstige werden gesetzt', async () => {
    const r = await (await anlegen.POST(anfrage(sitzung('kevin'), 'POST', { title: 'Beleg nachreichen', owner: 'malin', spaceId: 'm-f-beispiel' }, '/api/tasks/create'))).json() as { id: string };
    const t = (await gespeichert()).tasks.find(x => x.id === r.id)!;
    expect(t).toMatchObject({ spaceId: 'm-f-beispiel', projectId: 'sonstige-m-f-beispiel', einheit: 'Kunden', assignee: 'malin' });
    expect(gemeldet.map(m => [m.an, m.art])).toEqual([['malin', 'zuweisung']]);
  });
});
