// ─── Meilenstein ↔ Aufgaben + Austausch (30.09.): Fortschritt-Regel, automatische Liste (Space je Einheit/Mandat),
// Verweis nur per Kennung, Ziel-Fortschritt, Verlauf (Erwähnung → Glocke, fremde Nachricht unveränderlich), Notiz 409,
// Links, Rückweg-Verträglichkeit, Register. Eigener Datenordner, erfundene Konten/Meilensteine.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { Task, TasksState } from '@/types/tasks';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';
import {
  meilensteinListeId, meilensteinProjektId, meilensteinAufgabenSpace, fortschrittAusAufgaben, wirksamerFortschritt, aufgabenVonMeilenstein,
  meilensteinVonAufgabe, strukturFuer, fortschrittAnwenden, zieleFortschrittAnwenden, zielFortschrittAusMeilensteinen, listenOhneMeilenstein,
  listeArchivieren, istMeilensteinListe,
} from '@/lib/planung/meilenstein-aufgaben';
import { anwenden, aktionLesen, leererRaum, linkGueltig, notizStand, RAUM_GRENZEN, raumFuerBrowser } from '@/lib/planung/meilenstein-raum';
import { listeSauber, projektSauber, taskSauber } from '@/lib/aufgaben/saeubern';
import { uebernehmen } from '@/lib/aufgaben/struktur';
import { sauberMeilenstein } from '@/lib/planung/meilensteine';
import { registerEintrag } from '@/lib/crm/speicher-register';
import { weitererSpeicher } from '@/lib/crm/person-weitere';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-meilensteine-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-meilensteine';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});

const gemeldet: { an: string; art: string; titel: string; link: string }[] = [];
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string; link: string }) => { gemeldet.push(m); } }));

const T0 = '2026-09-01T08:00:00.000Z';
const ms = (id: string, extra: Partial<Meilenstein> = {}): Meilenstein => ({ id, titel: `Etappe ${id}`, space: 'business', bereich: 'business', fortschritt: 0, erledigt: false, ...extra });
const t = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
const personen = [{ speicher: 'kevin', namen: ['Kevin', 'kevin'] }, { speicher: 'malin', namen: ['Malin', 'malin'] }];

describe('Struktur: Liste je Meilenstein, Space aus Einheit/Mandat', () => {
  it('Kennungen sind stabil, gültig (≤ 80, Form wie KENNUNG) und je Meilenstein verschieden', () => {
    const a = meilensteinListeId('ms-1'), b = meilensteinListeId('ms~z-1');
    expect(a).toBe(meilensteinListeId('ms-1'));
    expect(a).not.toBe(b);
    for (const k of [a, b, meilensteinListeId('x'.repeat(80)), meilensteinProjektId('m-f-firma-mit-langem-namen-0123456789-0123456789-0123456789')]) {
      expect(k).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/);
    }
    expect(istMeilensteinListe(a)).toBe(true);
  });
  it('Space: Privat → privat, Mandat → Mandant, Einheit → Gesellschaft, sonst KD Ventures', () => {
    expect(meilensteinAufgabenSpace(ms('a', { space: 'privat', bereich: 'gesundheit' }))).toBe('privat');
    expect(meilensteinAufgabenSpace(ms('b', { firmaId: 'f-beispiel' }))).toBe('m-f-beispiel');
    expect(meilensteinAufgabenSpace(ms('c', { einheit: 'Selbstständigkeit' }))).toBe('kdc');
    expect(meilensteinAufgabenSpace(ms('d'))).toBe('kdv');
    expect(meilensteinAufgabenSpace({ bereich: 'gesundheit' })).toBe('privat'); // Altbestand ohne `space`
  });
  it('legt Projekt + Liste an, ist idempotent und zieht bei Space-Wechsel Liste samt Aufgaben um', () => {
    const m = ms('m1', { faellig: '2026-12-31' });
    const r1 = strukturFuer([m], leer(), T0);
    expect(r1.projekte.map(p => p.id)).toEqual(['pm-kdv']);
    expect(r1.listen).toEqual([{ id: meilensteinListeId('m1'), projektId: 'pm-kdv', titel: 'Etappe m1', sortOrder: 20261231 }]);
    const st: TasksState = { ...leer(), projects: r1.projekte, listen: r1.listen, tasks: [t('a', { projectId: 'pm-kdv', listeId: meilensteinListeId('m1') })] };
    expect(strukturFuer([m], st, T0)).toEqual({ projekte: [], listen: [], umzug: [] });
    const r2 = strukturFuer([{ ...m, space: 'privat', bereich: 'gesundheit', titel: 'Umbenannt' }], st, T0);
    expect(r2.projekte.map(p => p.id)).toEqual(['pm-privat']);
    expect(r2.listen[0]).toMatchObject({ id: meilensteinListeId('m1'), projektId: 'pm-privat', titel: 'Umbenannt' });
    expect(r2.umzug).toEqual([{ id: 'a', felder: { projectId: 'pm-privat', spaceId: 'privat' } }]);
  });
  it('„Neu anfangen“-Archiv und Papierkorb-Projekt bleiben unberührt; von Hand archivierte Liste wird wieder aktiv', () => {
    const lid = meilensteinListeId('m1');
    const st: TasksState = { ...leer(), projects: strukturFuer([ms('m1')], leer(), T0).projekte, listen: [{ id: lid, projektId: 'pm-kdv', titel: 'Etappe m1', sortOrder: 99_999_999, archiviertAm: T0 }] };
    expect(strukturFuer([ms('m1')], st, T0).listen).toEqual([]);
    const st2: TasksState = { ...st, listen: [{ id: lid, projektId: 'pm-kdv', titel: 'Etappe m1', sortOrder: 99_999_999, archiviert: true }] };
    expect(strukturFuer([ms('m1')], st2, T0).listen[0].archiviert).toBeUndefined();
    expect(listeArchivieren('m1', { ...st2, listen: [{ ...st2.listen![0], archiviert: undefined }] })?.archiviert).toBe(true);
  });
  it('Verweis nur per Kennung: Aufgabe ↔ Meilenstein über die Liste, keine neuen Felder an der Aufgabe', () => {
    const lid = meilensteinListeId('m1');
    const a = t('a', { listeId: lid });
    expect(meilensteinVonAufgabe(a, [ms('m0'), ms('m1')])?.id).toBe('m1');
    expect(meilensteinVonAufgabe(t('b', { listeId: 'l-andere' }), [ms('m1')])).toBeNull();
    // Der Säuberer der Aufgaben kennt kein Meilenstein-Feld — die Aufgabe bleibt, wie sie ist.
    expect(Object.keys(taskSauber({ ...a, meilensteinId: 'm1' })!)).not.toContain('meilensteinId');
    expect(listenOhneMeilenstein({ ...leer(), listen: [{ id: lid, projektId: 'pm-kdv', titel: 'x', sortOrder: 0 }] }, [])).toHaveLength(1);
  });
});

describe('Fortschritt-Regel: sobald Aufgaben da sind, gilt der errechnete', () => {
  const lid = meilensteinListeId('m1');
  it('gewichtet: Hauptaufgabe erledigt = 1, sonst Anteil erledigter Unteraufgaben; abgebrochen/Papierkorb/Archiv zählen nicht', () => {
    const st = { tasks: [
      t('a', { listeId: lid, status: 'done' }),
      t('b', { listeId: lid }), t('b1', { listeId: lid, parentId: 'b', status: 'done' }), t('b2', { listeId: lid, parentId: 'b' }),
      t('c', { listeId: lid, status: 'cancelled' }),
      t('d', { listeId: lid, geloeschtAm: T0 }),
      t('e', { listeId: lid, archiviertAm: T0 }),
      t('fremd', { listeId: 'l-x', status: 'done' }),
    ] };
    expect(aufgabenVonMeilenstein(st, 'm1').map(x => x.id).sort()).toEqual(['a', 'b', 'b1', 'b2', 'c']);
    expect(fortschrittAusAufgaben(aufgabenVonMeilenstein(st, 'm1'))).toBe(75); // (1 + 0,5) / 2
    expect(wirksamerFortschritt(ms('m1', { fortschritt: 10 }), st)).toBe(75);
    expect(wirksamerFortschritt(ms('m1', { fortschritt: 10, erledigt: true }), st)).toBe(100);
  });
  it('ohne Aufgaben gilt der Wert von Hand; Anwenden ändert nur Abweichende, Erledigte nie', () => {
    expect(fortschrittAusAufgaben([])).toBeNull();
    expect(wirksamerFortschritt(ms('m9', { fortschritt: 40 }), { tasks: [] })).toBe(40);
    const st = { tasks: [t('a', { listeId: lid, status: 'done' }), t('b', { listeId: lid })] };
    const r = fortschrittAnwenden([ms('m1', { fortschritt: 5 }), ms('m2', { fortschritt: 30 }), ms('m1x', { erledigt: true, fortschritt: 100 })], st);
    expect(r.geaendert).toEqual(['m1']);
    expect(r.liste[0].fortschritt).toBe(50);
    expect(r.liste[1].fortschritt).toBe(30);
  });
  it('Ziel: Mittelwert seiner Meilensteine (zielId bzw. abgeleitetVon), erledigt = 100; ohne Meilensteine von Hand', () => {
    const l = [ms('a', { zielId: 'z1', fortschritt: 40 }), ms('b', { abgeleitetVon: 'z1', erledigt: true }), ms('c', { zielId: 'z2', fortschritt: 10 })];
    expect(zielFortschrittAusMeilensteinen('z1', l)).toBe(70);
    const ziele: Ziel[] = [{ id: 'z1', titel: 'Z1', fortschritt: 0 }, { id: 'z3', titel: 'Z3', fortschritt: 33 }, { id: 'z2', titel: 'Z2', fortschritt: 0, erledigt: true }];
    const r = zieleFortschrittAnwenden(ziele, l);
    expect(r.geaendert).toBe(1);
    expect(r.liste.map(z => z.fortschritt)).toEqual([70, 33, 0]);
  });
});

describe('Austausch: Verlauf, Notiz, Links (rein)', () => {
  let n = 0;
  const id = () => `mn-${++n}`;
  it('Erwähnung aus dem Text (nie die schreibende Person), Antwort meldet die Verfasserin', () => {
    const r1 = anwenden(leererRaum(), { art: 'senden', text: 'Hallo @Malin, schau mal. @Kevin' }, 'kevin', T0, id, personen);
    expect(r1.ok && r1.erwaehnt).toEqual(['malin']);
    if (!r1.ok) throw new Error();
    const r2 = anwenden(r1.raum, { art: 'senden', text: 'Mach ich', antwortAuf: r1.neu!.id }, 'malin', T0, id, personen);
    expect(r2.ok && r2.antwortAn).toBe('kevin');
    expect(r2.ok && r2.neu?.antwortAuf).toBe(r1.neu!.id);
  });
  it('fremde Nachricht: bearbeiten/entfernen → 403; eigene bearbeiten, weich entfernen (Text geht nicht hinaus)', () => {
    const r = anwenden(leererRaum(), { art: 'senden', text: 'Stand?' }, 'kevin', T0, id, personen);
    if (!r.ok) throw new Error();
    const nid = r.neu!.id;
    expect(anwenden(r.raum, { art: 'bearbeiten', id: nid, text: 'gehackt' }, 'malin', T0, id, personen)).toMatchObject({ ok: false, status: 403 });
    expect(anwenden(r.raum, { art: 'entfernen', id: nid }, 'malin', T0, id, personen)).toMatchObject({ ok: false, status: 403 });
    const b = anwenden(r.raum, { art: 'bearbeiten', id: nid, text: 'Stand? @Malin' }, 'kevin', '2026-09-02T08:00:00.000Z', id, personen);
    expect(b.ok && b.raum.nachrichten[0]).toMatchObject({ text: 'Stand? @Malin', bearbeitetAm: '2026-09-02T08:00:00.000Z', erwaehnt: ['malin'] });
    expect(b.ok && b.erwaehnt).toEqual(['malin']);
    if (!b.ok) throw new Error();
    const e = anwenden(b.raum, { art: 'entfernen', id: nid }, 'kevin', T0, id, personen);
    expect(e.ok && e.raum.nachrichten[0].entfernt).toEqual({ am: T0, von: 'kevin' });
    if (!e.ok) throw new Error();
    expect(raumFuerBrowser(e.raum).nachrichten[0].text).toBe('');
  });
  it('Grenzen → 413 (nie gekürzt), leere Nachricht → 400', () => {
    expect(anwenden(leererRaum(), { art: 'senden', text: 'x'.repeat(RAUM_GRENZEN.text + 1) }, 'kevin', T0, id, personen)).toMatchObject({ ok: false, status: 413 });
    expect(anwenden(leererRaum(), { art: 'notiz', text: 'x'.repeat(RAUM_GRENZEN.notiz + 1), stand: 'leer' }, 'kevin', T0, id, personen)).toMatchObject({ ok: false, status: 413 });
    expect(anwenden(leererRaum(), { art: 'senden', text: '   ' }, 'kevin', T0, id, personen)).toMatchObject({ ok: false, status: 400 });
  });
  it('Notiz mit Stand: veraltet → 409, Verlauf ohne Text', () => {
    const r = anwenden(leererRaum(), { art: 'notiz', text: '## Ziel\nLaunch', stand: 'leer' }, 'kevin', T0, id, personen);
    if (!r.ok) throw new Error();
    expect(notizStand(r.raum)).toBe(T0);
    expect(r.raum.notizVerlauf).toEqual([{ am: T0, von: 'kevin', zeichen: 14 }]);
    expect(anwenden(r.raum, { art: 'notiz', text: 'anders', stand: 'leer' }, 'malin', T0, id, personen)).toMatchObject({ ok: false, status: 409 });
    expect(anwenden(r.raum, { art: 'notiz', text: 'anders', stand: T0 }, 'malin', '2026-09-03T08:00:00.000Z', id, personen).ok).toBe(true);
  });
  it('Links nur http(s); Aktionen aus dem Netz werden geprüft', () => {
    expect(linkGueltig('https://beispiel.invalid/x')).toBe(true);
    expect(linkGueltig('javascript:alert(1)')).toBe(false);
    expect(anwenden(leererRaum(), { art: 'link', url: 'data:text/html,x' }, 'kevin', T0, id, personen)).toMatchObject({ ok: false, status: 400 });
    expect(aktionLesen({ art: 'loeschen-alles' })).toBeNull();
    expect(aktionLesen({ art: 'entfernen', id: '../x' })).toBeNull();
  });
});

describe('Rückweg zu af4679a und Register', () => {
  it('Liste und Projekt des Meilensteins bestehen die (unveränderten) Säuberer — der alte Stand kennt beide Formen', () => {
    const r = strukturFuer([ms('m1', { faellig: '2026-10-01' })], leer(), T0);
    expect(listeSauber(r.listen[0])).toEqual(r.listen[0]);
    const p = projektSauber(r.projekte[0])!;
    expect(p).toMatchObject({ id: 'pm-kdv', title: 'Meilensteine', spaceId: 'kdv' });
    // Die Übernahme lässt Aufgaben in der Liste stehen (Liste gehört zum Projekt).
    const st = uebernehmen({ ...leer(), projects: [p], listen: r.listen, tasks: [t('a', { projectId: 'pm-kdv', listeId: r.listen[0].id })] }).state;
    expect(st.tasks[0].listeId).toBe(r.listen[0].id);
  });
  it('Meilenstein: `zielId` ist optional (fällt beim alten Stand weg), alles andere wie bisher', () => {
    const m = sauberMeilenstein({ ...ms('m1'), zielId: 'z-1', faellig: '2026-10-01' })!;
    expect(m.zielId).toBe('z-1');
    expect(sauberMeilenstein({ ...ms('m1'), zielId: 'böse id' })!.zielId).toBeUndefined();
  });
  it('Register: Austausch-Bestand ist „tilgen“ mit Umsetzung', () => {
    expect(registerEintrag('meilenstein-raum--haus')).toMatchObject({ bezug: 'dritte', behandlung: 'tilgen' });
    expect(weitererSpeicher('meilenstein-raum--haus')?.behandlung).toBe('tilgen');
  });
});

// ── Server: Schreibweg des Meilensteins legt die Liste an, Aufgaben ziehen den Fortschritt nach, Verlauf meldet ──
type Handler = (r: Request) => Promise<Response>;
let msRoute: { GET: Handler; PATCH: Handler };
let raumRoute: { GET: Handler; POST: Handler };
let tasksRoute: { PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt = 'haus') => ({ id, speicher, email: `${speicher}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const req = (pfad: string, person: string, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied'), konto('k3', 'fremd', 'Fremd Beispiel', 'mitglied', 'anders')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  msRoute = (await import('@/app/api/state/meilensteine/route')) as unknown as typeof msRoute;
  raumRoute = (await import('@/app/api/planung/meilenstein/route')) as unknown as typeof raumRoute;
  tasksRoute = (await import('@/app/api/state/tasks/route')) as unknown as typeof tasksRoute;
});
beforeEach(async () => {
  gemeldet.length = 0;
  await db.saveJson('tasks', { ...leer(), umbauVersion: 2 });
  await db.saveJson('meilensteine', { meilensteine: [] });
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-jahr', titel: 'Jahresziel', fortschritt: 0 }], fokus: {} });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Server: automatische Liste + Fortschritt + Ziel', () => {
  it('PATCH legt die Liste im richtigen Space an; Aufgaben abhaken zieht Meilenstein und Ziel nach', async () => {
    const r = await msRoute.PATCH(req('/api/state/meilensteine', 'kevin', 'PATCH', { ops: [{ op: 'upsert', eintrag: ms('m-test', { einheit: 'Selbstständigkeit', zielId: 'z-jahr' }) }] }));
    expect(r.status).toBe(200);
    const lid = meilensteinListeId('m-test');
    let st = (await db.loadJson<TasksState>('tasks'))!;
    expect(st.listen?.find(l => l.id === lid)).toMatchObject({ projektId: 'pm-kdc', titel: 'Etappe m-test' });
    expect(st.projects.find(p => p.id === 'pm-kdc')?.spaceId).toBe('kdc');
    // Drei Aufgaben (eine mit zwei Unteraufgaben) in der Liste, eine erledigt.
    const neu = (id: string, extra: Partial<Task> = {}) => ({ op: 'upsert', task: t(id, { projectId: 'pm-kdc', spaceId: 'kdc', listeId: lid, ...extra }) });
    const p1 = await tasksRoute.PATCH(req('/api/state/tasks', 'kevin', 'PATCH', { ops: [neu('a1', { status: 'done' }), neu('a2'), neu('a3'), neu('a3-1', { parentId: 'a3', status: 'done' }), neu('a3-2', { parentId: 'a3' })] }));
    expect(p1.status).toBe(200);
    const m1 = (await db.loadJson<{ meilensteine: Meilenstein[] }>('meilensteine'))!.meilensteine[0];
    expect(m1.fortschritt).toBe(50); // (1 + 0 + 0,5) / 3
    expect((await db.loadJson<{ jahr: Ziel[] }>('ziele'))!.jahr[0].fortschritt).toBe(50);
    // Von Hand gesetzter Wert wird überschrieben, solange es Aufgaben gibt.
    await msRoute.PATCH(req('/api/state/meilensteine', 'kevin', 'PATCH', { ops: [{ op: 'upsert', eintrag: { ...m1, fortschritt: 5 } }] }));
    expect((await db.loadJson<{ meilensteine: Meilenstein[] }>('meilensteine'))!.meilensteine[0].fortschritt).toBe(50);
    // Löschen archiviert die Liste, die Aufgaben bleiben.
    await msRoute.PATCH(req('/api/state/meilensteine', 'kevin', 'PATCH', { ops: [{ op: 'delete', id: 'm-test' }] }));
    st = (await db.loadJson<TasksState>('tasks'))!;
    expect(st.listen?.find(l => l.id === lid)?.archiviert).toBe(true);
    expect(st.tasks.filter(x => x.listeId === lid)).toHaveLength(5);
  });
});

describe('Server: Verlauf am Meilenstein', () => {
  beforeEach(async () => { await db.saveJson('meilensteine', { meilensteine: [ms('m-chat', { titel: 'Launch' })] }); });
  it('Erwähnung von Malin → Glocke bei Kevin mit Link; fremdes Konto → 403; Malin darf Kevins Nachricht nicht ändern', async () => {
    const g = await raumRoute.GET(req('/api/planung/meilenstein?id=m-chat', 'malin'));
    expect(g.status).toBe(200);
    expect(((await g.json()) as { listeId: string }).listeId).toBe(meilensteinListeId('m-chat'));
    const s = await raumRoute.POST(req('/api/planung/meilenstein', 'malin', 'POST', { id: 'm-chat', aktion: { art: 'senden', text: 'Kannst du @Kevin die Zahlen prüfen?' } }));
    expect(s.status).toBe(200);
    expect(gemeldet).toEqual([expect.objectContaining({ an: 'kevin', art: 'erwaehnung', link: '/os/planung/meilenstein/m-chat?r=verlauf' })]);
    expect(gemeldet[0].titel).toContain('„Launch“');
    const raum = ((await s.json()) as { raum: { nachrichten: { id: string }[] } }).raum;
    const nid = raum.nachrichten[0].id;
    expect((await raumRoute.POST(req('/api/planung/meilenstein', 'kevin', 'POST', { id: 'm-chat', aktion: { art: 'bearbeiten', id: nid, text: 'anders' } }))).status).toBe(403);
    expect((await raumRoute.GET(req('/api/planung/meilenstein?id=m-chat', 'fremd'))).status).toBe(403);
    expect((await raumRoute.POST(req('/api/planung/meilenstein', 'kevin', 'POST', { id: 'gibt-es-nicht', aktion: { art: 'senden', text: 'x' } }))).status).toBe(404);
    // Protokoll ohne Werte: der Text steht nirgends im Änderungsprotokoll.
    const namen = (await import('node:fs')).readdirSync(ordner).filter(f => f.startsWith('aenderungsprotokoll'));
    for (const f of namen) expect((await import('node:fs')).readFileSync(`${ordner}/${f}`, 'utf8')).not.toContain('Zahlen prüfen');
  });
});
