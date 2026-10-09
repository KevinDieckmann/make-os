// ─── Sicht-Prüfung Malin (08.10., Kevin: „noch tiefer ausbauen“) — Wächter je geschlossener Lücke ─────────────────────
// „Sicht Malin bekommt nichts aus Kevin privat“ — und ändert es auch nicht: Papierkorb-Ketten nehmen fremde „nur ich“-
// Aufgaben nicht mit, Aufgaben-Dateien an fremden „nur ich“-Aufgaben gibt es nicht, der ZOE-Verlauf zählt je Person, den
// Willkommensgruß setzt man nur für sich zurück, Protokoll-Nachträge gehen nie in eine fremde private Notiz, die
// Konsolidierung macht persönliche Fakten nie „gemeinsam“. Eigener Datenordner + Test-Vault, erfundene Werte.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { Task, TasksState } from '@/types/tasks';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-sicht-malin-'));
const daten = path.join(wurzel, 'daten');
const vault = path.join(wurzel, 'Make.Claude');
process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 });
});

const HAUS = 'haus-sicht';
const T0 = '2026-10-01T08:00:00.000Z';
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS });
const aufgabe = (id: string, extra: Partial<Task> & Record<string, unknown> = {}) => ({ id, projectId: 'p-gemeinsam', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', ...extra });
const projekt = (id: string) => ({ id, title: `Projekt ${id}`, category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' });
const GEHEIM = 'SICHT-GEHEIM-KEVIN';
type Handler = (r: Request) => Promise<Response>;
const anfrage = (pfad: string, person: string, methode = 'GET', body?: unknown) =>
  new Request(`http://test${pfad}`, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  await fs.mkdir(daten, { recursive: true });
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
});

const bestandSetzen = (tasks: unknown[], projects = [projekt('p-gemeinsam')]) =>
  db.saveJson('tasks', { projects, listen: [], statusEigen: [], vorlagen: [], tasks });
const roh = async () => (await db.loadJson<TasksState>('tasks'))!;

describe('Papierkorb: fremde „nur ich“-Aufgaben gehen nie mit (lib/aufgaben/papierkorb.ts fremdeNurIchLoesen)', () => {
  it('rein: Projekt → nach „Sonstige“, Aufgabe → wird Hauptaufgabe; eigene und sichtbare bleiben in der Kette', async () => {
    const { fremdeNurIchLoesen } = await import('@/lib/aufgaben/papierkorb');
    const st = { projects: [projekt('p-gemeinsam')], listen: [], statusEigen: [], vorlagen: [], tasks: [
      aufgabe('a-offen', { listeId: 'l-1' }),
      aufgabe('a-geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', listeId: 'l-1' }),
      aufgabe('a-geheim-u', { parentId: 'a-geheim' }),
      aufgabe('a-malin', { sichtbarkeit: 'nur-ich', angelegtVon: 'malin' }),
      aufgabe('a-kind-geheim', { parentId: 'a-offen', sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }),
    ] } as unknown as TasksState;
    const p = fremdeNurIchLoesen(st, 'projekt', 'p-gemeinsam', 'malin', T0);
    const nach = new Map(p.tasks.map(t => [t.id, t]));
    for (const id of ['a-geheim', 'a-geheim-u', 'a-kind-geheim']) expect(nach.get(id)!.projectId, id).toBe('sonstige-privat');
    expect(nach.get('a-geheim')!.listeId).toBeUndefined();
    expect(nach.get('a-geheim-u')!.parentId).toBe('a-geheim');   // der verborgene Teilbaum bleibt beisammen
    expect(nach.get('a-kind-geheim')!.parentId).toBeUndefined(); // hing an einer sichtbaren Aufgabe der Kette
    expect(nach.get('a-offen')!.projectId).toBe('p-gemeinsam');
    expect(nach.get('a-malin')!.projectId).toBe('p-gemeinsam');  // ihre eigene geht mit
    const a = fremdeNurIchLoesen(st, 'aufgabe', 'a-offen', 'malin', T0);
    expect(a.tasks.find(t => t.id === 'a-kind-geheim')!.parentId).toBeUndefined();
    expect(fremdeNurIchLoesen(st, 'projekt', 'p-gemeinsam', 'kevin', T0).tasks.find(t => t.id === 'a-malin')!.projectId).toBe('sonstige-privat');
  });

  it('Schreibweg: Malin löscht das gemeinsame Projekt (Papierkorb, dann endgültig) — Kevins „nur ich“ bleibt erhalten', async () => {
    const { aufgabenAendern } = await import('@/lib/aufgaben/speicher');
    await bestandSetzen([aufgabe('a-offen'), aufgabe('a-geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', title: GEHEIM }), aufgabe('a-geheim-u', { parentId: 'a-geheim' })]);
    const leer = { tasks: [], projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] };
    const r1 = await aufgabenAendern({ ...leer, projects: [{ op: 'delete', id: 'p-gemeinsam' }] }, { person: 'malin' });
    expect(r1.ok).toBe(true);
    let t = (await roh()).tasks;
    expect(t.find(x => x.id === 'a-offen')!.geloeschtAm).toBeTruthy();
    expect(t.find(x => x.id === 'a-geheim')!.geloeschtAm).toBeUndefined();
    expect(t.find(x => x.id === 'a-geheim')!.projectId).toBe('sonstige-privat');
    const r2 = await aufgabenAendern({ ...leer, projects: [{ op: 'delete', id: 'p-gemeinsam' }] }, { person: 'malin' });
    expect(r2.ok).toBe(true);
    t = (await roh()).tasks;
    expect(t.map(x => x.id).sort()).toEqual(['a-geheim', 'a-geheim-u']);
  });

  it('auch schon mit im Papierkorb (Altbestand): endgültiges Löschen durch Malin lässt Kevins Aufgabe stehen', async () => {
    const { aufgabenAendern } = await import('@/lib/aufgaben/speicher');
    await bestandSetzen([aufgabe('a-eltern', { geloeschtAm: T0 }), aufgabe('a-geheim', { parentId: 'a-eltern', sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', geloeschtAm: T0, geloeschtMit: 'a-eltern' })]);
    const leer = { tasks: [], projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] };
    const r = await aufgabenAendern({ ...leer, tasks: [{ op: 'delete', id: 'a-eltern' }] }, { person: 'malin' });
    expect(r.ok).toBe(true);
    const g = (await roh()).tasks.find(x => x.id === 'a-geheim')!;
    expect(g).toBeTruthy();
    expect(g.geloeschtMit).toBeUndefined();   // eigener Papierkorb-Eintrag — Kevin kann ihn wiederherstellen
    expect(g.parentId).toBeUndefined();
  });
});

describe('Aufgaben-Dateien: an fremden „nur ich“-Aufgaben gibt es keine (Liste, Ändern, Löschen → 404)', () => {
  it('Malin sieht/ändert/löscht Kevins Datei nicht; Kevin sieht sie', async () => {
    await bestandSetzen([aufgabe('a-offen'), aufgabe('a-geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' })]);
    await db.saveJson(`aufgaben-dateien--${HAUS}`, { eintraege: [
      { id: 'd-offen-1', art: 'sonstiges', projektId: 'p-gemeinsam', aufgabeId: 'a-offen', bereich: 'privat', datei: { name: 'plan.pdf', typ: 'application/pdf', groesse: 10 }, hochgeladenAm: T0, hochgeladenVon: 'kevin' },
      { id: 'd-geheim-1', art: 'sonstiges', projektId: 'p-gemeinsam', aufgabeId: 'a-geheim', bereich: 'privat', datei: { name: `${GEHEIM}.pdf`, typ: 'application/pdf', groesse: 10 }, notiz: GEHEIM, hochgeladenAm: T0, hochgeladenVon: 'kevin' },
    ] });
    const R = (await import('@/app/api/aufgaben/dateien/route')) as unknown as Record<'GET' | 'PATCH' | 'DELETE', Handler>;
    for (const q of ['projektId=p-gemeinsam', 'aufgabeId=a-geheim']) {
      const r = await R.GET(anfrage(`/api/aufgaben/dateien?${q}`, 'malin'));
      expect(await r.text(), q).not.toContain(GEHEIM);
    }
    expect((await R.GET(anfrage('/api/aufgaben/dateien?id=d-geheim-1', 'malin'))).status).toBe(404);
    expect((await R.PATCH(anfrage('/api/aufgaben/dateien', 'malin', 'PATCH', { id: 'd-geheim-1', felder: { notiz: 'überschrieben' } }))).status).toBe(404);
    expect((await R.DELETE(anfrage('/api/aufgaben/dateien?id=d-geheim-1', 'malin', 'DELETE'))).status).toBe(404);
    expect(JSON.stringify(await db.loadJson(`aufgaben-dateien--${HAUS}`))).toContain(GEHEIM);
    expect(await (await R.GET(anfrage('/api/aufgaben/dateien?projektId=p-gemeinsam', 'kevin'))).text()).toContain(GEHEIM);
    expect(await (await R.GET(anfrage('/api/aufgaben/dateien?projektId=p-gemeinsam', 'malin'))).text()).toContain('plan.pdf');
  });
});

describe('ZOE-Verlauf: die Grenze gilt je Person — Malin verdrängt Kevins Gespräche nie', () => {
  it('81 Gespräche von Malin (in die Zukunft datiert) lassen Kevins Gespräch stehen', async () => {
    const J = new Date().toISOString();
    await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g-kevin', person: 'kevin', begonnen: J, zuletzt: J, titel: GEHEIM, nachrichten: [{ rolle: 'kevin', text: GEHEIM, zeit: J }] }] });
    const { PUT, GET } = (await import('@/app/api/state/zoe-verlauf/route')) as unknown as Record<'PUT' | 'GET', Handler>;
    const zukunft = '2099-01-01T00:00:00.000Z';
    for (let i = 0; i < 81; i++) {
      const r = await PUT(anfrage('/api/state/zoe-verlauf', 'malin', 'PUT', { gespraech: { id: `g-m-${i}`, nachrichten: [{ rolle: 'kevin', text: `Frage ${i}`, zeit: zukunft }] } }));
      expect(r.status).toBe(200);
    }
    const f = (await db.loadJson<{ gespraeche: { id: string; person?: string }[] }>('zoe-verlauf'))!;
    expect(f.gespraeche.some(g => g.id === 'g-kevin')).toBe(true);
    expect(f.gespraeche.filter(g => g.person === 'malin')).toHaveLength(80);
    expect(await (await GET(anfrage('/api/state/zoe-verlauf', 'malin'))).text()).not.toContain(GEHEIM);
  });
});

describe('Willkommen: Malin setzt nur ihren eigenen Gruß zurück, der Inhaber jeden', () => {
  it('DELETE ?person=kevin von Malin → 403; ohne Parameter nur ihr eigener', async () => {
    await db.saveJson('willkommen', { gesehen: { kevin: T0, malin: T0 } });
    const { DELETE } = (await import('@/app/api/state/willkommen/route')) as unknown as Record<'DELETE', Handler>;
    expect((await DELETE(anfrage('/api/state/willkommen?person=kevin', 'malin', 'DELETE'))).status).toBe(403);
    expect((await DELETE(anfrage('/api/state/willkommen', 'malin', 'DELETE'))).status).toBe(200);
    expect(await db.loadJson('willkommen')).toEqual({ gesehen: { kevin: T0 } });
    expect((await DELETE(anfrage('/api/state/willkommen?person=kevin', 'kevin', 'DELETE'))).status).toBe(200);
    expect(await db.loadJson('willkommen')).toEqual({ gesehen: {} });
  });
});

describe('Brain: Protokoll-Nachträge nie in eine fremde private Notiz (legeAn)', () => {
  it('gleicher Titel am selben Tag: Malins Nachtrag landet in einer eigenen Datei, Kevins private bleibt unberührt', async () => {
    const V = await import('@/lib/zoe/vault');
    const malin = await V.sichtAufloesen({ person: 'malin' }); // Sicht aus den Konten (09.10.)
    expect(V.anhaengenErlaubt({ scope: 'privat', owner: 'kevin' }, malin)).toBe(false);
    expect(V.anhaengenErlaubt({ scope: 'intern', owner: 'kevin' }, malin)).toBe(true);
    expect(V.anhaengenErlaubt({ scope: 'intern', owner: 'malin' }, malin, 'privat')).toBe(false); // Privates nie an Gemeinsames
    expect(V.anhaengenErlaubt({ scope: 'privat', owner: 'malin' }, malin, 'privat')).toBe(true);
    await fs.mkdir(path.join(vault, '03. Protokolle', 'Protokolle'), { recursive: true });
    const k = await V.legeAn('Abendrunde', GEHEIM, { person: 'kevin', scope: 'privat' });
    expect(k.ok).toBe(true);
    const m = await V.legeAn('Abendrunde', 'Malins Notiz', { person: 'malin' });
    expect(m.ok).toBe(true);
    expect(m.pfad).not.toBe(k.pfad);
    const ordner = path.join(vault, '03. Protokolle', 'Protokolle');
    const dateien = await fs.readdir(ordner);
    const kevinDatei = dateien.find(d => d.endsWith('Abendrunde.md'))!;
    expect(await fs.readFile(path.join(ordner, kevinDatei), 'utf8')).not.toContain('Malins Notiz');
    // Kevin selbst hängt weiter an sein eigenes an.
    const k2 = await V.legeAn('Abendrunde', 'Nachtrag Kevin', { person: 'kevin', scope: 'privat' });
    expect(k2.pfad).toBe(k.pfad);
  });
});
