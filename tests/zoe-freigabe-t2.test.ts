// ─── ZOE-Freigabe (29.09., Paket T2 #94–#97): Stand + Diff, Häkchen, Datumsprüfung, Charge rückgängig ──
// Eigener Datenordner, erfundene Konten und Aufgaben; das Modell ist gemockt (kein echter Aufruf).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
import {
  vorschlagSauber, standAbweichung, vorschlagAenderungen, nurGewaehlt, risikoarm, heuteSatz, zoeStandVon, konfliktText,
} from '@/lib/aufgaben/zoe';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-t2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-t2';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
const modell = vi.hoisted(() => ({ antworten: [] as string[], aufrufe: [] as { user: string; system: string }[], frist: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10) }));
vi.mock('@/lib/anthropic', async orig => ({
  ...(await orig<typeof import('@/lib/anthropic')>()),
  hasAnthropicKey: () => true,
  guthabenLeer: () => false,
  askText: async (o: { system: string; user: string }) => {
    modell.aufrufe.push({ user: o.user, system: o.system });
    return { ok: true, status: 200, text: modell.antworten.shift() ?? JSON.stringify({ zusammenfassung: 'Vorbereitet.', entwurf: '## Entwurf', unteraufgaben: ['Eins', 'Zwei'], status: 'in-progress', deadline: modell.frist, begruendung: '' }) };
  },
}));

const T0 = '2026-09-01T08:00:00.000Z';
const aufgabe = (id: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'proj-a', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', notiz: 'Alt', ...extra }) as unknown as Task;
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt?: string) => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; POST: Handler };
let stapelRoute: { GET: Handler; POST: Handler };
let db: typeof import('@/lib/store/local-db');
let stapel: typeof import('@/lib/zoe/stapel');
const anfrage = (person: string, method = 'GET', body?: unknown, pfad = '/api/aufgaben/zoe') => new Request(`http://test${pfad}`, { method, headers: sitzung(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const post = async (body: Record<string, unknown>, pfad = '/api/aufgaben/zoe') => { const r = await (pfad === '/api/aufgaben/zoe' ? route : stapelRoute).POST(anfrage('kevin', 'POST', body, pfad)); return { status: r.status, d: await r.json() as Record<string, unknown> }; };
const bestand = async () => (await db.loadJson<TasksState>('tasks'))!;
const task = async (id: string) => (await bestand()).tasks.find(t => t.id === id)!;
/** Von Hand ändern (wie Malin im Browser) — direkt im Bestand. */
const vonHand = async (id: string, teil: Partial<Task>) => { const s = await bestand(); await db.saveJson('tasks', { ...s, tasks: s.tasks.map(t => (t.id === id ? { ...t, ...teil } : t)) }); };
const vorbereiten = async (id: string) => { await post({ aktion: 'geben', id }); await post({ aktion: 'arbeiten', id }); return (await task(id)).zoe!.stapelId!; };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber', 'haus'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied', 'haus')], einladungen: [] });
  route = (await import('@/app/api/aufgaben/zoe/route')) as unknown as typeof route;
  stapelRoute = (await import('@/app/api/zoe/stapel/route')) as unknown as typeof stapelRoute;
  stapel = await import('@/lib/zoe/stapel');
});
beforeEach(async () => {
  modell.antworten.length = 0; modell.aufrufe.length = 0;
  await db.saveJson('zoe-stapel', { vorschlaege: [] });
  await db.saveJson('zoe-protokoll', { eintraege: [] });
  await db.saveJson('tasks', {
    projects: [{ id: 'proj-a', title: 'Beispielprojekt', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }],
    tasks: [aufgabe('a1', { dueDate: '2026-12-01' }), aufgabe('a2'), aufgabe('a3')], listen: [], statusEigen: [], gruppen: [], vorlagen: [],
  });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('rein (#94/#96)', () => {
  it('Deadline nur als echter Kalendertag und — mit heute — nicht in der Vergangenheit', () => {
    expect(vorschlagSauber({ zusammenfassung: 'x', deadline: '2026-02-31' }, 't')).toBeNull();
    expect(vorschlagSauber({ zusammenfassung: 'x', deadline: '2026-09-01', entwurf: 'E' }, 't', '2026-09-29')!.deadline).toBeUndefined();
    expect(vorschlagSauber({ zusammenfassung: 'x', deadline: '2026-10-02' }, 't', '2026-09-29')!.deadline).toBe('2026-10-02');
    expect(heuteSatz('2026-09-29')).toBe('Heute ist Dienstag, 29.09.2026 (Zeitzone Europe/Berlin).');
  });
  it('alt → neu je Feld, Abweichung seit dem Vorschlag, Häkchen, risikoarm', () => {
    const t = aufgabe('x', { dueDate: '2026-10-03', status: 'todo' });
    const v = { aufgabeId: 'x', zusammenfassung: 'z', entwurf: 'E', unteraufgaben: ['a'], status: 'in-progress' as const, deadline: '2026-10-10' };
    expect(vorschlagAenderungen(t, v).map(z => [z.feld, z.alt, z.neu])).toEqual([
      ['notiz', '3 Zeichen', '+ Entwurf (1 Zeichen) angehängt'], ['unteraufgaben', '', '+ 1: a'], ['status', 'Offen', 'In Arbeit'], ['deadline', '03.10.2026', '10.10.2026'],
    ]);
    const k = standAbweichung({ status: 'todo', dueDate: '2026-10-08' }, t, v);
    expect(k.map(x => x.feld)).toEqual(['deadline']);
    expect(konfliktText(k)).toBe('Deadline: beim Vorschlag 08.10.2026, inzwischen 03.10.2026 — ZOE wollte 10.10.2026');
    expect(standAbweichung(zoeStandVon(t), t, v)).toEqual([]);
    expect(nurGewaehlt(v, new Set(['notiz']))).toEqual({ entwurf: 'E', unteraufgaben: [], status: '', deadline: '' });
    expect(risikoarm(v)).toBe(false);
    expect(risikoarm({ status: undefined, deadline: undefined })).toBe(true);
  });
});

describe('Freigabe mit Stand (#95), Häkchen (#94), Prompt (#96)', () => {
  it('der Lauf legt Stand und Charge in den Vorschlag; der Auftrag nennt Wochentag und Zeitzone', async () => {
    const id = await vorbereiten('a1');
    const v = (await stapel.hole(id))!;
    expect(v.eingabe._stand).toEqual({ status: 'todo', dueDate: '2026-12-01' });
    expect(String(v.eingabe._charge)).toMatch(/^ch-/);
    expect(modell.aufrufe[0].user).toMatch(/^Heute ist (Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d\d\.\d\d\.\d{4} \(Zeitzone Europe\/Berlin\)\./);
  });

  it('Deadline inzwischen von Hand geändert → 409 mit Diff, nichts überschrieben; „trotzdem“ übernimmt bewusst', async () => {
    const id = await vorbereiten('a1');
    await vonHand('a1', { dueDate: '2026-10-03' });
    const r = await post({ aktion: 'freigeben', id: 'a1', stapelId: id });
    expect(r.status).toBe(409);
    expect(r.d.diff).toEqual([expect.objectContaining({ feld: 'deadline', damals: '01.12.2026', jetzt: '03.10.2026' })]);
    expect((await task('a1')).dueDate).toBe('2026-10-03');
    expect((await stapel.hole(id))!.status).toBe('offen');
    // Deadline abwählen → der Rest geht durch, die Deadline bleibt Malins.
    const ohne = await post({ aktion: 'freigeben', id: 'a1', stapelId: id, eingabe: { entwurf: '## Entwurf', unteraufgaben: ['Eins', 'Zwei'], status: 'in-progress', deadline: '' } });
    expect(ohne.status).toBe(200);
    const t = await task('a1');
    expect(t).toMatchObject({ dueDate: '2026-10-03', status: 'in-progress' });
    expect(t.notiz).toMatch(/## Entwurf$/);
  });

  it('„trotzdem übernehmen“ überschreibt ausdrücklich; nur Notiz gewählt → nur Notiz', async () => {
    const id = await vorbereiten('a1');
    await vonHand('a1', { dueDate: '2026-10-03' });
    expect((await post({ aktion: 'freigeben', id: 'a1', stapelId: id, trotzdem: true })).status).toBe(200);
    expect((await task('a1')).dueDate).toBe(modell.frist);
    const id2 = await vorbereiten('a2');
    expect((await post({ aktion: 'freigeben', id: 'a2', stapelId: id2, eingabe: { entwurf: '## Entwurf', unteraufgaben: [], status: '', deadline: '' } })).status).toBe(200);
    const t2 = await task('a2');
    expect(t2.status).toBe('todo');
    expect(t2.dueDate).toBeUndefined();
    expect((await bestand()).tasks.filter(x => x.parentId === 'a2')).toHaveLength(0);
    // Häkchen können keine Charge von außen setzen („_“-Schlüssel kommen nur aus dem gespeicherten Eintrag).
    const id3 = await vorbereiten('a3');
    const vorher = (await stapel.hole(id3))!.eingabe._charge;
    expect((await post({ id: id3, entscheidung: 'freigeben', eingabe: { _charge: 'ch-gefaelscht-123', entwurf: '## Entwurf' } }, '/api/zoe/stapel')).status).toBe(200);
    expect((await stapel.hole(id3))!.eingabe._charge).toBe(vorher);
  });

  it('nichts gewählt → 400, der Vorschlag bleibt offen', async () => {
    const id = await vorbereiten('a1');
    const r = await post({ aktion: 'freigeben', id: 'a1', stapelId: id, eingabe: { entwurf: '', unteraufgaben: [], status: '', deadline: '' } });
    expect(r.status).toBe(400);
    expect((await stapel.hole(id))!.status).toBe('offen');
  });
});

describe('Charge rückgängig (#97)', () => {
  it('nimmt Status, Deadline, Notiz und unberührte Unteraufgaben zurück — Geändertes bleibt; idempotent', async () => {
    await post({ aktion: 'geben', id: 'a1' }); await post({ aktion: 'geben', id: 'a2' });
    await post({ aktion: 'arbeiten' }); // EIN Lauf → eine Charge für beide
    const s1 = (await task('a1')).zoe!.stapelId!, s2 = (await task('a2')).zoe!.stapelId!;
    expect((await stapel.hole(s1))!.eingabe._charge).toBe((await stapel.hole(s2))!.eingabe._charge);
    expect((await post({ aktion: 'freigeben', id: 'a1', stapelId: s1 })).status).toBe(200);
    expect((await post({ aktion: 'freigeben', id: 'a2', stapelId: s2 })).status).toBe(200);
    // Malin ändert danach die Deadline von a2 von Hand.
    await vonHand('a2', { dueDate: '2026-11-11' });
    const g = await (await route.GET(anfrage('kevin', 'GET', undefined, '/api/aufgaben/zoe?chargen=1'))).json() as { chargen: { charge: string; eintraege: unknown[] }[] };
    expect(g.chargen).toHaveLength(1);
    expect(g.chargen[0].eintraege).toHaveLength(2);
    const r = await post({ aktion: 'charge-zurueck', charge: g.chargen[0].charge });
    expect(r.status).toBe(200);
    const b = r.d.bericht as { zurueck: number; teilweise: { titel: string; grund: string }[] };
    expect(b.zurueck).toBe(2);
    expect(b.teilweise).toEqual([expect.objectContaining({ titel: expect.stringContaining('Aufgabe a2'), grund: expect.stringContaining('Deadline') })]);
    const t1 = await task('a1'), t2 = await task('a2');
    expect(t1).toMatchObject({ status: 'todo', dueDate: '2026-12-01', notiz: 'Alt' });
    expect(t2).toMatchObject({ status: 'todo', dueDate: '2026-11-11', notiz: 'Alt' });
    const unter = (await bestand()).tasks.filter(x => x.parentId === 'a1' || x.parentId === 'a2');
    expect(unter.every(u => !!u.geloeschtAm)).toBe(true);
    // Zweimal: nichts mehr.
    const r2 = await post({ aktion: 'charge-zurueck', charge: g.chargen[0].charge });
    expect((r2.d.bericht as { schon: number }).schon).toBe(2);
  });

  it('Sammelfreigabe hat ihre eigene Charge', async () => {
    modell.antworten.push(JSON.stringify({ zusammenfassung: 'Nur Notiz.', entwurf: '## N', unteraufgaben: [], status: '', deadline: '', begruendung: '' }));
    await vorbereiten('a3');
    const r = await post({ alle: true }, '/api/zoe/stapel');
    expect(r.d).toMatchObject({ erledigt: 1, einzeln: 0 });
    expect(String(r.d.sammel)).toMatch(/^ch-/);
    const g = await (await route.GET(anfrage('kevin', 'GET', undefined, '/api/aufgaben/zoe?chargen=1'))).json() as { chargen: { charge: string; art: string }[] };
    expect(g.chargen[0]).toMatchObject({ charge: r.d.sammel, art: 'sammel' });
  });
});
