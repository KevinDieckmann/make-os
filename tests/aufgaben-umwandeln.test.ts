// ─── Umwandeln, Ziehen & Ablegen, Schnelleingabe (06.10., Malins Bauplan-Karte) ─────────────────────────
// Liste → Aufgabe, Aufgabe → Liste, Aufgabe ↔ Unteraufgabe — je mit „Rückgängig“ (genau der alte Stand); Ziehen & Ablegen (vor/
// hinter/in/ans Listenende, Reihenfolge, Grenzen); der Server prüft Ort, Tiefe, Kreise der Ops (400/409); die Schnelleingabe legt
// nie eine Liste an und versteht `#Projekt/Liste`. Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
import { listeZuAufgabe, aufgabeZuListe, umhaengen, zeilenAenderungen, istFehler, type Ergebnis } from '@/lib/aufgaben/umwandeln';
import { ablegen, ortPruefen } from '@/lib/aufgaben/ziehen';
import { AUFGABEN_EBENEN_MAX, nachIdKarte, ebeneVon } from '@/lib/aufgaben/ebenen';
import { aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { imEinzelArchiv } from '@/lib/aufgaben/archiv-einzeln';
import { parseSchnell, zielAmAnfang, zielKuerzel, type SchnellZiel } from '@/lib/make-one/schnell-anlegen';
import { elternZuerst, pakete, einzeln, type Op } from '@/lib/aufgaben/abgleich';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-umwandeln-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-umwandeln';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const T0 = '2026-09-01T08:00:00.000Z';
const J = '2026-10-06T10:00:00.000Z';
const a = (id: string, extra: Partial<Task> = {}): Task => ({ id, projectId: 'p1', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...extra });
const projekt = (id: string, spaceId = 'kdv') => ({ id, title: `Projekt ${id}`, category: 'business' as const, owner: 'both' as const, color: '#6E7EF5', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId });
const stand = (): TasksState => ({
  projects: [projekt('p1'), projekt('p2'), projekt('p-privat', 'privat')],
  listen: [
    { id: 'l-a', projektId: 'p1', titel: 'Offen', sortOrder: 0 },
    { id: 'l-b', projektId: 'p1', titel: 'Erledigt', sortOrder: 1 },
    { id: 'l-x', projektId: 'p2', titel: 'Fremd', sortOrder: 0 },
    { id: 'l-p', projektId: 'p-privat', titel: 'Privat', sortOrder: 0 },
  ],
  statusEigen: [], vorlagen: [],
  tasks: [
    a('t1', { listeId: 'l-a', sortOrder: 0 }), a('t2', { listeId: 'l-a', sortOrder: 1 }), a('t3', { listeId: 'l-a', sortOrder: 2 }),
    a('t1-u', { listeId: 'l-a', parentId: 't1' }),
    a('b1', { listeId: 'l-b', status: 'done', completedAt: T0 }),
    a('x1', { projectId: 'p2', listeId: 'l-x' }),
    a('pv', { projectId: 'p-privat', listeId: 'l-p', spaceId: 'privat' }),
  ],
});
const ok = (r: Ergebnis) => { if (istFehler(r)) throw new Error(r.fehler); return r; };
/** „Rückgängig“: die rück-Zeilen auf den neuen Stand legen = genau der alte. */
function rueck(vorher: TasksState, nachher: TasksState): TasksState {
  const d = zeilenAenderungen(vorher, nachher);
  const setze = <T extends { id: string }>(liste: T[], art: string) => {
    const m = new Map(liste.map(x => [x.id, x]));
    for (const z of d.rueck.filter(r => r.liste === art)) { if (z.eintrag) m.set(z.id, z.eintrag as unknown as T); else m.delete(z.id); }
    return [...m.values()];
  };
  return { ...nachher, tasks: setze(nachher.tasks, 'tasks'), listen: setze(nachher.listen ?? [], 'listen'), projects: setze(nachher.projects, 'projects') };
}
const sortiert = (s: TasksState) => ({ tasks: [...s.tasks].sort((x, y) => x.id.localeCompare(y.id)), listen: [...(s.listen ?? [])].sort((x, y) => x.id.localeCompare(y.id)) });

describe('Liste → Aufgabe', () => {
  it('die Liste wird Aufgabe in einer wählbaren Liste desselben Projekts, ihre Aufgaben deren Unteraufgaben; Rückgängig = alter Stand', () => {
    const s0 = stand();
    const r = ok(listeZuAufgabe(s0, 'l-a', 'l-b', { jetzt: J, ich: 'malin' }));
    const n = nachIdKarte(r.state.tasks);
    expect(r.state.listen!.map(l => l.id)).toEqual(['l-b', 'l-x', 'l-p']);
    expect(n.get('l-a')).toMatchObject({ title: 'Offen', listeId: 'l-b', projectId: 'p1', spaceId: 'kdv', status: 'todo', assignee: 'kevin' });
    expect(['t1', 't2', 't3'].map(id => n.get(id)!.parentId)).toEqual(['l-a', 'l-a', 'l-a']);
    expect(n.get('t1-u')).toMatchObject({ parentId: 't1', listeId: 'l-b' });
    expect(ebeneVon(n.get('t1-u')!, n)).toBe(3);
    expect(r.state.tasks[0].id).toBe('l-a'); // die neue Aufgabe reist vor ihren Unteraufgaben
    expect(r.text).toMatch(/ist jetzt eine Aufgabe in „Erledigt“ mit 3 Unteraufgaben/);
    expect(sortiert(rueck(s0, r.state))).toEqual(sortiert(s0));
    // Ziel „Sonstige“ (ohne Liste)
    const r2 = ok(listeZuAufgabe(s0, 'l-a', null, { jetzt: J }));
    expect(nachIdKarte(r2.state.tasks).get('l-a')!.listeId).toBeUndefined();
  });
  it('abgelehnt: fremdes Projekt, sich selbst, Meilenstein-Liste, zu tief, laufende Serie — nichts geändert', () => {
    expect(listeZuAufgabe(stand(), 'l-a', 'l-x', { jetzt: J })).toEqual({ fehler: expect.stringMatching(/nicht zu diesem Projekt/) });
    expect(listeZuAufgabe(stand(), 'l-a', 'l-a', { jetzt: J })).toEqual({ fehler: expect.stringMatching(/nicht in sich selbst/) });
    const ms = { ...stand(), listen: [...stand().listen!, { id: 'lm-ms-1', projektId: 'p1', titel: 'Q4', sortOrder: 3 }] };
    expect(listeZuAufgabe(ms, 'lm-ms-1', null, { jetzt: J })).toEqual({ fehler: expect.stringMatching(/Meilenstein-Listen bleiben Listen/) });
    const tief = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id, i, l) => a(id, { listeId: 'l-a', ...(i ? { parentId: l[i - 1] } : {}) }));
    const s = { ...stand(), tasks: [...stand().tasks, ...tief] };
    expect(listeZuAufgabe(s, 'l-a', null, { jetzt: J })).toEqual({ fehler: expect.stringMatching(new RegExp(`mehr als ${AUFGABEN_EBENEN_MAX}`)) });
    const serie = { ...stand(), tasks: [...stand().tasks, a('w', { listeId: 'l-a', wiederholung: { regel: 'taeglich' } })] };
    expect(listeZuAufgabe(serie, 'l-a', null, { jetzt: J })).toEqual({ fehler: expect.stringMatching(/Serie läuft nur an Hauptaufgaben/) });
  });
});

describe('Aufgabe → Liste', () => {
  it('Hauptaufgabe wird Liste (gleich hinter ihrer Liste), Unteraufgaben deren Aufgaben, die Hülle ins Einzel-Archiv; Rückgängig = alter Stand', () => {
    const s0 = stand();
    const r = ok(aufgabeZuListe(s0, 't1', { jetzt: J }));
    const reihe = [...r.state.listen!].filter(l => l.projektId === 'p1').sort((x, y) => x.sortOrder - y.sortOrder).map(l => l.titel);
    expect(reihe).toEqual(['Offen', 'Aufgabe t1', 'Erledigt']);
    const n = nachIdKarte(r.state.tasks);
    expect(n.get('t1-u')).toMatchObject({ listeId: 't1', projectId: 'p1' });
    expect(n.get('t1-u')!.parentId).toBeUndefined();
    expect(imEinzelArchiv(n.get('t1'))).toBe(true);
    expect(aufgabenSicht(r.state).tasks.some(t => t.id === 't1')).toBe(false);
    expect(sortiert(rueck(s0, r.state))).toEqual(sortiert(s0));
    expect(aufgabeZuListe(s0, 't1-u', { jetzt: J })).toEqual({ fehler: expect.stringMatching(/Nur eine Hauptaufgabe/) });
  });
});

describe('Aufgabe ↔ Unteraufgabe', () => {
  it('unter eine andere hängen (Ort der Hauptaufgabe zieht mit), zurück zur Hauptaufgabe; Kreis/Space/Serie abgelehnt', () => {
    const s0 = stand();
    const r = ok(umhaengen(s0, 't2', 'b1', J));
    expect(nachIdKarte(r.state.tasks).get('t2')).toMatchObject({ parentId: 'b1', listeId: 'l-b' });
    expect(sortiert(rueck(s0, r.state))).toEqual(sortiert(s0));
    const zurueck = ok(umhaengen(s0, 't1-u', null, J));
    expect(nachIdKarte(zurueck.state.tasks).get('t1-u')!.parentId).toBeUndefined();
    expect(umhaengen(s0, 't1', 't1-u', J)).toEqual({ fehler: expect.stringMatching(/eigenen Unteraufgabe/) });
    expect(umhaengen(s0, 't1', 'pv', J)).toEqual({ fehler: expect.stringMatching(/selben Space/) });
    const serie = { ...s0, tasks: s0.tasks.map(t => (t.id === 't3' ? { ...t, wiederholung: { regel: 'taeglich' as const } } : t)) };
    expect(umhaengen(serie, 't3', 't2', J)).toEqual({ fehler: expect.stringMatching(/Serie/) });
  });
});

describe('Ziehen & Ablegen (rein)', () => {
  it('Reihenfolge in einer Liste: vor/hinter — lückenlos neu gezählt', () => {
    const r = ok(ablegen(stand(), 't3', { art: 'vor', zielId: 't1' }, J));
    const reihe = r.state.tasks.filter(t => t.listeId === 'l-a' && !t.parentId).sort((x, y) => x.sortOrder - y.sortOrder).map(t => t.id);
    expect(reihe).toEqual(['t3', 't1', 't2']);
    const r2 = ok(ablegen(stand(), 't1', { art: 'nach', zielId: 't3' }, J));
    expect(r2.state.tasks.filter(t => t.listeId === 'l-a' && !t.parentId).sort((x, y) => x.sortOrder - y.sortOrder).map(t => t.id)).toEqual(['t2', 't3', 't1']);
    expect(ablegen(stand(), 't1', { art: 'vor', zielId: 't2' }, J)).toEqual({ fehler: '' }); // schon da: still nichts
  });
  it('zwischen Listen (auch in ein anderes Projekt desselben Space), ans Ende; Unteraufgaben ziehen mit', () => {
    const r = ok(ablegen(stand(), 't1', { art: 'liste', projektId: 'p2', listeId: 'l-x' }, J));
    const n = nachIdKarte(r.state.tasks);
    expect(n.get('t1')).toMatchObject({ projectId: 'p2', listeId: 'l-x', sortOrder: 1 });
    expect(n.get('t1-u')).toMatchObject({ projectId: 'p2', listeId: 'l-x' });
    const sonst = ok(ablegen(stand(), 't2', { art: 'liste', projektId: 'p1', listeId: null }, J));
    expect(nachIdKarte(sonst.state.tasks).get('t2')!.listeId).toBeUndefined();
  });
  it('in eine Aufgabe = Unteraufgabe; Unteraufgabe zwischen Aufgaben; Grenzen: Kreis, Tiefe, anderer Space, falsche Liste', () => {
    const r = ok(ablegen(stand(), 't3', { art: 'in', zielId: 't2' }, J));
    expect(nachIdKarte(r.state.tasks).get('t3')!.parentId).toBe('t2');
    const u = ok(ablegen(stand(), 't1-u', { art: 'in', zielId: 'b1' }, J));
    expect(nachIdKarte(u.state.tasks).get('t1-u')).toMatchObject({ parentId: 'b1', listeId: 'l-b' });
    expect(ablegen(stand(), 't1', { art: 'in', zielId: 't1-u' }, J)).toEqual({ fehler: expect.stringMatching(/eigenen Unteraufgabe/) });
    expect(ablegen(stand(), 't1', { art: 'liste', projektId: 'p-privat', listeId: 'l-p' }, J)).toEqual({ fehler: expect.stringMatching(/innerhalb eines Space/) });
    expect(ablegen(stand(), 't1', { art: 'liste', projektId: 'p1', listeId: 'l-x' }, J)).toEqual({ fehler: expect.stringMatching(/gehört nicht zu dem Projekt/) });
    const tief = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id, i, l) => a(id, { listeId: 'l-b', ...(i ? { parentId: l[i - 1] } : {}) }));
    expect(ablegen({ ...stand(), tasks: [...stand().tasks, ...tief] }, 't1', { art: 'in', zielId: 'k5' }, J)).toEqual({ fehler: expect.stringMatching(/höchstens/) });
  });
  it('ortPruefen (Server): Liste eines anderen Projekts, Projekt eines anderen Space, Unteraufgabe in einen anderen Space → Grund; sonst null', () => {
    const s = stand();
    const n = nachIdKarte(s.tasks);
    const alt = n.get('t1')!;
    const s2 = { projekte: s.projects, listen: s.listen!, nachId: n };
    expect(ortPruefen({ ...alt, listeId: 'l-x' }, alt, s2)).toMatch(/anderen Projekt/);
    expect(ortPruefen({ ...alt, projectId: 'p-privat', listeId: undefined }, alt, s2)).toMatch(/anderen Space/);
    expect(ortPruefen({ ...alt, listeId: 'l-b' }, alt, s2)).toBeNull();
    expect(ortPruefen({ ...alt, listeId: 'l-gibts-nicht' }, alt, s2)).toBeNull(); // Rennen mit gelöschter Liste: „Sonstige“, keine Ablehnung
    const u = n.get('t1-u')!;
    const n2 = new Map(n); n2.set('t1-u', { ...u, parentId: 'pv' });
    expect(ortPruefen({ ...u, parentId: 'pv' }, u, { ...s2, nachId: n2 })).toMatch(/selben Space/);
  });
});

describe('Pakete: Eltern reisen vor ihren Kindern', () => {
  it('elternZuerst ordnet neue/umgehängte Eltern nach vorn; pakete/einzeln behalten das (und Struktur vor Aufgaben)', () => {
    const op = (id: string, parentId?: string): Op => ({ op: 'upsert', eintrag: { id, ...(parentId ? { parentId } : {}) } });
    const ops = [op('kind-1', 'neu'), op('enkel', 'kind-1'), op('anderes'), op('neu')];
    expect(elternZuerst(ops).map(o => (o.op === 'upsert' ? o.eintrag.id : o.id))).toEqual(['anderes', 'neu', 'kind-1', 'enkel']);
    const viele = Array.from({ length: 160 }, (_, i) => op(`k${i}`, 'neu-eltern'));
    const p = pakete({ tasks: [...viele, op('neu-eltern')], projects: [], listen: [{ op: 'delete', id: 'l-alt' }], statusEigen: [], vorlagen: [] });
    expect(p[0].tasks[0]).toMatchObject({ eintrag: { id: 'neu-eltern' } });
    const e = einzeln({ tasks: [op('kind', 'x')], projects: [], listen: [{ op: 'upsert', eintrag: { id: 'l-neu' } }], statusEigen: [], vorlagen: [] });
    expect(e.map(x => (x.listen.length ? 'liste' : 'aufgabe'))).toEqual(['liste', 'aufgabe']);
  });
});

describe('Schnelleingabe: immer eine Aufgabe, `#Projekt/Liste`', () => {
  const ziele: SchnellZiel[] = [
    { spaceId: 'kdv', projektId: 'p-rw', projektTitel: 'Rechnungswesen', listeId: 'l-one', listeTitel: 'offene RE-Onebanking' },
    { spaceId: 'kdv', projektId: 'p-rw', projektTitel: 'Rechnungswesen', listeId: 'l-off', listeTitel: 'offene RE' },
    { spaceId: 'privat', projektId: 'p-haus', projektTitel: 'Haus', listeId: 'l-garten', listeTitel: 'Garten' },
  ];
  it('Groß/Klein egal, Leerzeichen bis zum Ende des Treffers, der längste Name gewinnt; Rest = Titel', () => {
    const p = parseSchnell('Rechnung Stadtwerke bezahlen #rechnungswesen/OFFENE re-onebanking morgen', [], '2026-10-06', [], ziele);
    expect(p.ziel).toMatchObject({ listeId: 'l-one', projektId: 'p-rw' });
    expect(p.title).toBe('Rechnung Stadtwerke bezahlen');
    expect(p.dueDate).toBe('2026-10-07');
    expect(parseSchnell('Mahnung #Rechnungswesen/offene RE', [], '2026-10-06', [], ziele).ziel!.listeId).toBe('l-off');
    expect(zielAmAnfang('Haus/Garten', ziele)!.ziel.listeId).toBe('l-garten');
    expect(zielAmAnfang('Haus/Gartenzaun streichen', ziele)).toBeNull(); // nur an einer Wortgrenze
  });
  it('unbekanntes Ziel: nicht anlegen — Hinweis mit Vorschlag; `#projekt` (ein Wort) gilt weiter', () => {
    const p = parseSchnell('Beleg #Rechnungswesen/offne RE-Onebanking', [], '2026-10-06', [], ziele);
    expect(p.ziel).toBeUndefined();
    expect(p.zielUnbekannt).toMatchObject({ text: '#Rechnungswesen/offne RE-Onebanking', vorschlag: { listeId: 'l-one' } }); // Tippfehler „offne“ → „offene RE-Onebanking“
    expect(zielKuerzel(ziele[0])).toBe('#Rechnungswesen/offene RE-Onebanking');
    const alt = parseSchnell('Steuer #rechnung', [{ id: 'p-rw', title: 'Rechnungswesen' }], '2026-10-06', [], ziele);
    expect(alt).toMatchObject({ projectId: 'p-rw', title: 'Steuer' });
    expect(alt.ziel).toBeUndefined();
  });
  it('die Schnelleingabe kann keine Liste, kein Projekt, keine Gruppe anlegen (Quelltext-Wächter)', () => {
    const q = readFileSync(path.resolve(__dirname, '../components/os/aufgaben/SchnellAnlegen.tsx'), 'utf8');
    expect(q).not.toMatch(/listeAnlegen|projektAnlegen|gruppeAnlegen|onNeu=|ADD_LISTE|ADD_PROJECT|ADD_GRUPPE/);
    expect(q).toContain('aufgabeAnlegen(');
  });
  it('nirgends in den Aufgaben wird noch eine Gruppe angelegt oder angezeigt (Quelltext-Wächter)', () => {
    const wurzel = path.resolve(__dirname, '..');
    for (const f of ['components/os/aufgaben/BaumAnsicht.tsx', 'components/os/aufgaben/Navigation.tsx', 'components/os/aufgaben/AufgabeDetail.tsx', 'components/os/aufgaben/VorlagenDialog.tsx', 'components/os/aufgaben/hilfe.ts', 'context/TasksContext.tsx', 'components/os/aufgaben/AufgabenRaum.tsx', 'components/os/aufgaben/AnsichtTabelle.tsx', 'components/os/aufgaben/AnsichtKalender.tsx']) {
      const q = readFileSync(path.join(wurzel, f), 'utf8');
      expect(q, f).not.toMatch(/gruppeAnlegen|ADD_GRUPPE|UPDATE_GRUPPE|state\.gruppen|\+ Gruppe/);
    }
    const baum = readFileSync(path.join(wurzel, 'components/os/aufgaben/BaumAnsicht.tsx'), 'utf8');
    // Pro Ebene genau ein Feld, klar beschriftet.
    expect(baum.match(/<NeueListeFeld /g)).toHaveLength(1);
    expect(baum.match(/<NeueAufgabeFeld /g)).toHaveLength(1);
    expect(baum.match(/<NeueUnteraufgabeFeld /g)).toHaveLength(1);
    expect(readFileSync(path.join(wurzel, 'components/os/aufgaben/NeuFelder.tsx'), 'utf8')).toMatch(/\+ Neue Liste[\s\S]*\+ Neue Aufgabe[\s\S]*\+ Unteraufgabe/);
  });
});

// ── Server: Ops aus Umwandeln/Ziehen gehen durch; ungültige werden abgelehnt ──────────────────────────────────
type Handler = (r: Request) => Promise<Response>;
let route: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request('http://test/api/state/tasks', { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
type MitStand = { id: string; stand: string } & Record<string, unknown>;
const lesen = async () => (await (await route.GET(anfrage(sitzung('kevin')))).json()) as { state: Record<'tasks' | 'listen' | 'projects', MitStand[]> };
/** Wie der Browser: aus dem Unterschied Einzeländerungen mit Stand bauen (lib/aufgaben/abgleich.ts). */
async function senden(neu: TasksState) {
  const { unterschied, koerper, ohneStand } = await import('@/lib/aufgaben/abgleich');
  const roh = (await lesen()).state as unknown as TasksState;
  const staende = new Map<string, string>();
  const basis = ohneStand(roh, staende);
  return route.PATCH(anfrage(sitzung('kevin'), 'PATCH', koerper(unterschied(basis, neu, staende))));
}
const serverStand = async () => { const { ohneStand } = await import('@/lib/aufgaben/abgleich'); return ohneStand((await lesen()).state as unknown as TasksState, new Map()); };

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'Kevin Beispiel', 'inhaber'), konto('k2', 'malin', 'Malin Beispiel', 'mitglied')], einladungen: [] });
  await db.saveJson('crm', { firmen: [], mandate: [] });
  await db.saveJson('tasks', { ...stand(), umbauVersion: 3 });
  route = (await import('@/app/api/state/tasks/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Server: Umwandeln und Ziehen über die bestehenden Ops', () => {
  it('Liste → Aufgabe geht durch (eine PATCH), Rückgängig auch — danach wieder der alte Stand', async () => {
    const vorher = await serverStand();
    const r = ok(listeZuAufgabe(vorher, 'l-a', 'l-b', { jetzt: J }));
    expect((await senden(r.state)).status).toBe(200);
    const nach = await serverStand();
    expect(nach.listen!.some(l => l.id === 'l-a')).toBe(false);
    expect(nach.tasks.find(t => t.id === 'l-a')).toMatchObject({ listeId: 'l-b' });
    expect(nach.tasks.find(t => t.id === 't1')).toMatchObject({ parentId: 'l-a', listeId: 'l-b' });
    // Rückgängig: die alten Zeilen zurück (die neue Aufgabe geht dabei in den Papierkorb — sie war ja gespeichert).
    const zurueck = rueck(vorher, r.state);
    expect((await senden(zurueck)).status).toBe(200);
    const wieder = await serverStand();
    expect(wieder.listen!.find(l => l.id === 'l-a')).toMatchObject({ titel: 'Offen' });
    expect(aufgabenSicht(wieder).tasks.find(t => t.id === 't1')).toMatchObject({ listeId: 'l-a' });
    expect(aufgabenSicht(wieder).tasks.find(t => t.id === 't1')!.parentId).toBeUndefined();
    expect(aufgabenSicht(wieder).tasks.some(t => t.id === 'l-a')).toBe(false);
  });
  it('Aufgabe → Liste und Ziehen gehen durch', async () => {
    const s = await serverStand();
    const r = ok(aufgabeZuListe(s, 't2', { jetzt: J }));
    expect((await senden(r.state)).status).toBe(200);
    expect((await serverStand()).listen!.some(l => l.id === 't2')).toBe(true);
    const s2 = await serverStand();
    const z = ok(ablegen(s2, 't3', { art: 'liste', projektId: 'p1', listeId: 'l-b' }, J));
    expect((await senden(z.state)).status).toBe(200);
    expect((await serverStand()).tasks.find(t => t.id === 't3')).toMatchObject({ listeId: 'l-b' });
  });
  it('der Server prüft selbst: Liste eines anderen Projekts → 400, anderer Space → 400, Kreis → 409, zu tief → 400', async () => {
    const roh = (await lesen()).state;
    const t3 = roh.tasks.find(t => t.id === 't3')!;
    const p = (task: Record<string, unknown>) => route.PATCH(anfrage(sitzung('kevin'), 'PATCH', { ops: [{ op: 'upsert', task, stand: task.stand }] }));
    const fremd = await p({ ...t3, listeId: 'l-x' });
    expect(fremd.status).toBe(400);
    expect(((await fremd.json()) as { error: string }).error).toMatch(/anderen Projekt/);
    expect((await p({ ...t3, projectId: 'p-privat', listeId: 'l-p' })).status).toBe(400);
    const u = roh.tasks.find(t => t.id === 't1-u')!;
    expect((await p({ ...u, parentId: 'pv' })).status).toBe(400);
    const t1 = roh.tasks.find(t => t.id === 't1')!;
    expect((await p({ ...t1, parentId: 't1-u' })).status).toBe(409);
    expect((await serverStand()).tasks.find(t => t.id === 't3')).toMatchObject({ listeId: 'l-b' });
  });
});
