// ─── Löschen & Archivieren überall gleich (04.10., UMBAU_ABEND_0410.md › 5, DESIGN_STANDARD.md › Zeilen-Aktionen) ──────
// Kevin: „…nach links swiped: dann kommt da Löschen oder Archivieren. Alles andere macht da keinen Sinn.“ Der Wächter hält fest:
// der Baustein rendert beide Aktionen mit Vorleser-Beschriftung und nur mit Recht; Produkte und Aufgaben nutzen ihn; Löschen
// geht nie ohne Papierkorb (Server lehnt endgültiges Löschen außerhalb des Papierkorbs ab, Frist 30 Tage, Marke vom Server);
// Archiv ist zurückholbar und stört die Läufe von „Neu anfangen“ nicht; fremde Haushalte (Partner/Testkunde) bekommen 403.
// Eigener Datenordner, erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Task, TasksState } from '@/types/tasks';
import type { CrmBestand, Leistung, Mandat, Chance } from '@/lib/crm/typen';
import { PAPIERKORB_TAGE, imPapierkorb, inPapierkorb, ausPapierkorb, papierkorbBis, papierkorbAbgelaufen, ohnePapierkorb, papierkorbMarke, markeVomServer } from '@/lib/eintraege/sicher';
import { produktZustand, produktWaehlbar, produktVerweise, verweisSatz, produktePapierkorb, produkteAbgelaufen, portfolio } from '@/lib/crm/produkte';
import { katalog } from '@/lib/crm/angebote';
import { produktVorschlaege } from '@/lib/finanzen/produkte';
import { aufgabeArchivieren, aufgabeAusArchiv, einzelnArchiviert, archivMarkeSchuetzen, einzelMarke, imEinzelArchiv } from '@/lib/aufgaben/archiv-einzeln';
import { aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { aufgabenArchivieren, aufgabenZurueck } from '@/lib/aufgaben/neustart';
import { taskSauber } from '@/lib/aufgaben/saeubern';
import { serienAufgabenNachholen } from '@/lib/aufgaben/serie';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-zeile-aktionen-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-zeile-aktionen';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate' }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => { const rel = `${dir}/${n}`; return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : /\.tsx?$/.test(n) ? [rel] : []; });
}

const J = '2026-10-04T10:00:00.000Z';
const T0 = '2026-09-01T08:00:00.000Z';
const L = (id: string, x: Partial<Leistung> = {}): Leistung => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 1000, einheit: 'Monat netto', basis: 'monat' }, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', angebot: { leistungstext: 'Zwei Termine im Monat.' }, geaendert: T0, ...x });
const M = (id: string, leistungId: string, status: Mandat['status'] = 'aktiv'): Mandat => ({ id, kunde: `Kunde ${id}`, titel: `Mandat ${id}`, kontaktIds: [], art: 'retainer', gesellschaft: 'kdv', status, vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ziele: [], health: {}, leistungen: [], offen: [], leistungId, geaendert: T0 } as unknown as Mandat);
const D = (id: string, leistungId: string, stufe: Chance['stufe'] = 'angebot'): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], stufe, leistungId, wert: { betrag: 100, basis: 'monat' } } as unknown as Chance);
const A = (id: string, x: Partial<Task> = {}): Task => ({ id, projectId: 'p', title: `Aufgabe ${id}`, status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'kdv', ...x });
const stand = (): TasksState => ({
  projects: [{ id: 'p', title: 'Projekt', category: 'business', owner: 'both', color: '#000000', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'kdv' }],
  tasks: [A('a'), A('a-u', { parentId: 'a' }), A('a-u-u', { parentId: 'a-u' }), A('b')], listen: [], statusEigen: [], gruppen: [], vorlagen: [],
});

// ── 1 · Der Baustein ─────────────────────────────────────────────────────────────────────────────────────────────
describe('Baustein ZeileAktionen (components/os/ui)', () => {
  it('rendert die Zeile, dahinter Archivieren + Löschen und am Rand dieselben zwei — mit Vorleser-Beschriftung', async () => {
    const { ZeileAktionen } = await import('@/components/os/ui');
    const html = renderToStaticMarkup(h(ZeileAktionen, { titel: 'Kickoff-Paket', onArchivieren: () => {}, onLoeschen: () => {} }, h('div', null, 'Zeile')));
    expect(html).toContain('class="ui-za"');
    expect(html).toContain('ui-za-inhalt');
    expect(html).toContain('Zeile');
    expect(html.match(/aria-label="„Kickoff-Paket“ archivieren"/g)).toHaveLength(2); // hinter der Zeile (Handy) + am Rand (Rechner)
    expect(html.match(/aria-label="„Kickoff-Paket“ löschen \(Papierkorb\)"/g)).toHaveLength(2);
    expect(html).toContain('role="group"');
    // Geschlossen: die Aktionen hinter der Zeile sind für Vorleser verborgen und nicht im Tab-Lauf (der Rand-Knopf ist es).
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('tabindex="-1"');
  });
  it('im Archiv heißt die ruhige Aktion „Zurückholen“', async () => {
    const { ZeileAktionen } = await import('@/components/os/ui');
    const html = renderToStaticMarkup(h(ZeileAktionen, { titel: 'X', archiviert: true, onArchivieren: () => {}, onLoeschen: () => {} }, 'z'));
    expect(html).toContain('„X“ aus dem Archiv zurückholen');
    expect(html).toContain('Zurückholen');
    expect(html).not.toContain('Archivieren<');
  });
  it('ohne Recht (darf=false) oder ohne Aktion: nur die Zeile — keine Aktion erscheint', async () => {
    const { ZeileAktionen } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(h(ZeileAktionen, { titel: 'X', darf: false, onLoeschen: () => {} }, h('i', null, 'z')))).toBe('<i>z</i>');
    expect(renderToStaticMarkup(h(ZeileAktionen, { titel: 'X' }, h('i', null, 'z')))).toBe('<i>z</i>');
  });
  it('Rückgängig-Leiste und Rückfrage: Rollen, Beschriftung, Abbrechen immer dabei', async () => {
    const { RueckgaengigLeiste, Rueckfrage, RUECKGAENGIG_MS } = await import('@/components/os/ui');
    expect(RUECKGAENGIG_MS).toBe(10_000);
    const l = renderToStaticMarkup(h(RueckgaengigLeiste, { text: '„X“ im Papierkorb', onRueck: () => {}, onZu: () => {} }));
    expect(l).toContain('role="status"');
    expect(l).toContain('Rückgängig');
    const f = renderToStaticMarkup(h(Rueckfrage, { frage: { titel: 'Wirklich?', text: 'Es hängt etwas daran.', wahl: [{ label: 'In den Papierkorb', ton: 'gefahr', tun: () => {} }] }, onZu: () => {} }));
    expect(f).toContain('role="alertdialog"');
    expect(f).toContain('aria-modal="true"');
    expect(f).toContain('In den Papierkorb');
    expect(f).toContain('Abbrechen');
  });
  it('nur Token-Farben, Wischen ohne Bibliothek (Pointer-Events, pan-y), Bewegung über CSS (reduced motion greift)', () => {
    const q = lies('components/os/ui/zeile-aktionen.tsx');
    expect(q).not.toMatch(/['"`]#[0-9A-Fa-f]{3,8}\b/);
    expect(q).not.toMatch(/rgba?\(/);
    expect(q).toContain('onPointerDown');
    expect(q).toContain('setPointerCapture');
    expect(q).not.toMatch(/from '(react-swipeable|framer-motion|@use-gesture)/);
    const css = lies('app/globals.css');
    expect(css).toContain('.ui-za-inhalt { position: relative; touch-action: pan-y;');
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important; transition: none !important; \}/);
    expect(css).toContain('@media (hover: none), (pointer: coarse) {\n  .ui-za-schnell:not(:focus-within)');
  });
});

// ── 2 · Wer ihn nutzt ───────────────────────────────────────────────────────────────────────────────────────────
describe('Produkte und Aufgaben nutzen den Baustein', () => {
  it('Produkte: jede Zeile in ZeileAktionen, Reiter Produkte · Archiv · Papierkorb, kein window.confirm', () => {
    const datei = lies('components/os/mandate/Produkte.tsx');
    // Die Liste (Archivieren/Löschen) — das Detail darunter (Phasen, Unterlagen) wird mit der Inventur umgestellt.
    const q = datei.slice(datei.indexOf('export function Produkte('), datei.indexOf('function ProduktDetail('));
    expect(q).toContain('<ZeileAktionen titel={l.name}');
    expect(datei).toMatch(/from '\.\.\/ui'/);
    expect(datei).not.toMatch(/from '\.\.\/schlank'/);
    expect(q).toContain("label: `Papierkorb · ${korb.length}`");
    expect(q).not.toContain('window.confirm');
    // Endgültig (api.weg) nur aus dem Papierkorb, hinter einer Rückfrage.
    expect(datei.match(/api\.weg\(/g)).toHaveLength(1);
    expect(q).toMatch(/const endgueltig = \(id: string, name: string\) => fragen\(/);
  });
  it('Aufgaben: Baum und Archiv nutzen den Baustein; Löschen/Archivieren laufen über den HandlungProvider mit Rückgängig', () => {
    expect(lies('components/os/aufgaben/BaumAnsicht.tsx')).toContain('<ZeileAktionen titel={t.title} onArchivieren={() => handlung.archivieren(t)}');
    expect(lies('components/os/aufgaben/EinzelArchiv.tsx')).toContain('<ZeileAktionen key={e.id} titel={e.titel} archiviert');
    const hd = lies('components/os/aufgaben/Handlung.tsx');
    expect(hd).not.toContain('window.confirm');
    expect(hd).toContain("dispatch({ type: 'ARCHIVIEREN'");
    expect(hd).toMatch(/melden\(`„\$\{t\.title\}“ im Papierkorb/);
    expect(hd).toMatch(/melden\(`„\$\{t\.title\}“ archiviert/);
  });
  it('Rückgängig hat EINE Quelle (ui) — Planung, Aufgaben und Produkte reichen nur durch', () => {
    expect(lies('components/os/planung/Rueckgaengig.tsx')).toContain("export { useRueckgaengig, type Rueckgaengig } from '../ui';");
    // Der Kalender (Termin verschieben, 8 s) hat noch seinen eigenen Hinweis — kommt mit der Inventur der übrigen Listen.
    const funde = [...dateien('components/os/aufgaben'), ...dateien('components/os/planung'), ...dateien('components/os/mandate')].filter(f => /export (const|function) (useRueckgaengig|RUECKGAENGIG_MS)\b|role="status" aria-live="polite" style=\{\{ position: 'fixed'/.test(lies(f)));
    expect(funde).toEqual([]);
  });
  it('DESIGN_STANDARD.md nennt Baustein und Regel', () => {
    const md = lies('DESIGN_STANDARD.md');
    expect(md).toContain('ZeileAktionen');
    expect(md).toMatch(/Jede Liste mit Einträgen nutzt/);
  });
});

// ── 3 · Sicher statt endgültig (rein) ──────────────────────────────────────────────────────────────────────────────
describe('lib/eintraege/sicher', () => {
  it('Papierkorb: hinein (Marke bleibt beim zweiten Mal), heraus, Frist 30 Tage', () => {
    expect(PAPIERKORB_TAGE).toBe(30);
    const x = inPapierkorb({ id: 'x' } as { id: string; geloeschtAm?: string }, J);
    expect(imPapierkorb(x)).toBe(true);
    expect(inPapierkorb(x, '2026-12-01T00:00:00.000Z').geloeschtAm).toBe(J);
    expect(ausPapierkorb(x)).toEqual({ id: 'x' });
    expect(papierkorbBis(J)).toBe('2026-11-03');
    expect(papierkorbAbgelaufen(x, '2026-11-02T10:00:00.000Z')).toBe(false);
    expect(papierkorbAbgelaufen(x, '2026-11-04T10:00:00.000Z')).toBe(true);
    expect(ohnePapierkorb([x, { id: 'y' }]).map(e => (e as { id: string }).id)).toEqual(['y']);
  });
  it('Marke: nur ISO; neu = Server-Zeit, bestehend bleibt (Frist nicht verschiebbar)', () => {
    expect(papierkorbMarke('2026-10-04T10:00:00.000Z')).toBe('2026-10-04T10:00:00.000Z');
    expect(papierkorbMarke('gestern')).toBeUndefined();
    expect(papierkorbMarke(null)).toBeUndefined();
    expect(markeVomServer(undefined, { geloeschtAm: '1999-01-01T00:00:00.000Z' }, J).geloeschtAm).toBe(J);
    expect(markeVomServer({ geloeschtAm: '2026-10-01T00:00:00.000Z' }, { geloeschtAm: J }, J).geloeschtAm).toBe('2026-10-01T00:00:00.000Z');
    expect(markeVomServer({ geloeschtAm: J }, {}, J)).toEqual({});
  });
});

describe('Produkte: Archiv = „eingestellt“, Papierkorb mit Verweis-Prüfung', () => {
  const crm = () => ({ leistungen: [L('l-a'), L('l-arch', { status: 'eingestellt' }), L('l-korb', { geloeschtAm: '2026-08-01T00:00:00.000Z' }), L('l-haengt', { geloeschtAm: '2026-08-01T00:00:00.000Z' }), L('l-neu-korb', { geloeschtAm: J })], mandate: [M('m1', 'l-a'), M('m2', 'l-a', 'beendet'), M('m3', 'l-haengt', 'beendet')], chancen: [D('d1', 'l-a'), D('d2', 'l-a', 'gewonnen')], angebote: [] } as unknown as CrmBestand);
  it('Zustand und Wählbarkeit', () => {
    const c = crm();
    expect(c.leistungen.map(produktZustand)).toEqual(['aktiv', 'archiv', 'papierkorb', 'papierkorb', 'papierkorb']);
    expect(c.leistungen.filter(produktWaehlbar).map(l => l.id)).toEqual(['l-a']);
  });
  it('Verweise: laufende Mandate und offene Deals werden genannt (Rückfrage statt stillem Löschen)', () => {
    const v = produktVerweise('l-a', crm());
    expect(v).toEqual({ mandateLaufend: 1, mandate: 2, dealsOffen: 1, deals: 2 });
    expect(verweisSatz(v)).toBe('1 laufendes Mandat und 1 offener Deal');
    expect(verweisSatz(produktVerweise('l-arch', crm()))).toBe('');
  });
  it('Papierkorb-Liste und Morgenlauf: nur abgelaufen UND ohne Verweise geht endgültig', () => {
    const k = produktePapierkorb(crm());
    expect(k.map(e => e.id)).toEqual(['l-neu-korb', 'l-korb', 'l-haengt']);
    expect(k.find(e => e.id === 'l-haengt')!.haengt).toBe(true);
    expect(produkteAbgelaufen(crm(), J)).toEqual(['l-korb']);
    const mitAngebot = { ...crm(), angebote: [{ positionen: [{ leistungId: 'l-korb' }] }] } as unknown as CrmBestand;
    expect(produkteAbgelaufen(mitAngebot, J)).toEqual([]);
  });
  it('Papierkorb und Archiv tauchen in Angebot, Planung und Zahl „aktive Produkte“ nicht auf', () => {
    const c = crm();
    expect(katalog(c.leistungen, 'kdv').map(x => x.l.id)).toEqual(['l-a']);
    expect(produktVorschlaege(c).map(p => p.id)).toEqual(['l-a']);
    expect(portfolio(c).produkteAktiv).toBe(1);
  });
});

describe('Aufgaben: einzeln archivieren (dieselbe Marke wie „Neu anfangen“, eigene Kennung)', () => {
  it('archivieren nimmt den Teilbaum mit, die Sicht blendet ihn aus; zurückholen holt genau diese Kette', () => {
    const s = aufgabeArchivieren(stand(), 'a-u', J);
    expect(s.tasks.filter(imEinzelArchiv).map(t => t.id)).toEqual(['a-u', 'a-u-u']);
    expect(s.tasks.find(t => t.id === 'a-u')!.archivId).toBe(einzelMarke('a-u'));
    expect(aufgabenSicht(s).tasks.map(t => t.id)).toEqual(['a', 'b']);
    expect(einzelnArchiviert(s)).toEqual([expect.objectContaining({ id: 'a-u', mit: 1, archiviertAm: J })]);
    const z = aufgabeAusArchiv(s, 'a-u', J);
    expect(aufgabenSicht(z).tasks.map(t => t.id)).toEqual(['a', 'a-u', 'a-u-u', 'b']);
    expect(z.tasks.find(t => t.id === 'a-u')!.parentId).toBe('a');
  });
  it('Elternteil inzwischen im Papierkorb → zurück als Hauptaufgabe; Papierkorb-Einträge bleiben unberührt', () => {
    let s = aufgabeArchivieren(stand(), 'a-u', J);
    s = { ...s, tasks: s.tasks.map(t => (t.id === 'a' ? { ...t, geloeschtAm: J } : t)) };
    const z = aufgabeAusArchiv(s, 'a-u', J);
    expect(z.tasks.find(t => t.id === 'a-u')!.parentId).toBeUndefined();
    expect(z.tasks.find(t => t.id === 'a')!.geloeschtAm).toBe(J);
  });
  it('„Neu anfangen“ und Einzel-Archiv stören sich nicht', () => {
    const einzeln = aufgabeArchivieren(stand(), 'b', J);
    const lauf = aufgabenArchivieren(einzeln, 'na-lauf-123456', J);
    expect(lauf.erfasst.aufgaben).not.toContain('b');
    const zurueck = aufgabenZurueck(lauf.state, 'na-lauf-123456', { art: 'alles' });
    expect(zurueck.state.tasks.find(t => t.id === 'b')!.archivId).toBe(einzelMarke('b'));
    expect(aufgabeAusArchiv(lauf.state, 'a', J)).toBe(lauf.state); // eine Lauf-Aufgabe holt das Einzel-Archiv nicht
  });
  it('Schreibweg: der Browser setzt nur die Einzel-Marke; Lauf-Marken bleiben, wie gespeichert', () => {
    const roh = { ...A('x'), archiviertAm: J, archivId: 'ea-x' };
    expect(taskSauber(roh)).toMatchObject({ archiviertAm: J, archivId: 'ea-x' });
    expect(taskSauber({ ...A('x'), archiviertAm: J, archivId: 'na-lauf-123456' })!.archiviertAm).toBeUndefined();
    const lauf = { ...A('y'), archiviertAm: J, archivId: 'na-lauf-123456' };
    expect(archivMarkeSchuetzen(A('y'), lauf)).toMatchObject({ archiviertAm: J, archivId: 'na-lauf-123456' });
    expect(archivMarkeSchuetzen({ ...A('y'), archivId: 'na-falsch' }, undefined).archivId).toBeUndefined();
    expect(archivMarkeSchuetzen({ ...A('y'), archiviertAm: J, archivId: 'ea-y' }, undefined).archivId).toBe('ea-y');
  });
  it('Serie ruht im Archiv: die offene Instanz zählt — keine neue entsteht', () => {
    const erledigt = A('w', { status: 'done', completedAt: '2026-09-27T10:00:00.000Z', dueDate: '2026-09-27', wiederholung: { regel: 'taeglich' } });
    const neu = serienAufgabenNachholen([erledigt], '2026-09-29', J);
    expect(neu).toHaveLength(1);
    const archiviert = { ...neu[0], archiviertAm: J, archivId: einzelMarke(neu[0].id) };
    expect(serienAufgabenNachholen([erledigt, archiviert], '2026-09-30', J)).toHaveLength(0);
  });
});

// ── 4 · Server: Rechte, Papierkorb-Pflicht, Server-Zeit ─────────────────────────────────────────────────────────────
describe('Server: nur wer darf — und Löschen nie ohne Papierkorb', () => {
  type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
  let crmRoute: Route, aufgabenRoute: Route;
  let db: typeof import('@/lib/store/local-db');
  let speicher: typeof import('@/lib/crm/speicher');
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const crmPatch = (person: string, ops: unknown[]) => crmRoute.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: kopf(person), body: JSON.stringify({ ops }) }));
  const aufgabenPatch = (person: string, body: unknown) => aufgabenRoute.PATCH(new Request('http://test/api/state/tasks', { method: 'PATCH', headers: kopf(person), body: JSON.stringify(body) }));
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });

  beforeAll(async () => {
    db = await import('@/lib/store/local-db');
    speicher = await import('@/lib/crm/speicher');
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus'), konto('k2', 'malin', 'mitglied', 'haus'), konto('k3', 'testkunde', 'inhaber', 'kunde-haus'), konto('k4', 'partner', 'mitglied', 'kunde-haus')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    await db.saveJson('crm', { ...speicher.leererBestand(), leistungen: [L('l-frei'), L('l-mandat'), L('l-alt', { geloeschtAm: '2026-08-01T00:00:00.000Z' })], mandate: [M('m1', 'l-mandat')] });
    const s0 = stand();
    // Kevins „nur ich“-Aufgabe: eine im Papierkorb, eine im Einzel-Archiv, eine aktiv — Malin darf keine davon sehen oder anfassen.
    s0.tasks.push(A('k-geheim', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin' }), A('k-korb', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', geloeschtAm: J }), A('k-archiv', { sichtbarkeit: 'nur-ich', angelegtVon: 'kevin', archiviertAm: J, archivId: 'ea-k-archiv' }));
    await db.saveJson('tasks', { ...s0, umbauVersion: 2 });
    crmRoute = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
    aufgabenRoute = (await import('@/app/api/state/tasks/route')) as unknown as Route;
  });
  const produkt = async (id: string) => (await speicher.ladeCrm()).leistungen.find(l => l.id === id);

  it('Testkunde und Partner (fremder Haushalt): 403 beim Lesen und Löschen — für Produkte und Aufgaben', async () => {
    for (const p of ['testkunde', 'partner']) {
      expect((await crmRoute.GET(new Request('http://test/api/crm/bestand', { headers: kopf(p) }))).status).toBe(403);
      expect((await crmPatch(p, [{ liste: 'leistungen', op: 'teil', id: 'l-frei', felder: { geloeschtAm: J } }])).status).toBe(403);
      expect((await crmPatch(p, [{ liste: 'leistungen', op: 'delete', id: 'l-alt' }])).status).toBe(403);
      expect((await aufgabenPatch(p, { ops: [{ op: 'delete', id: 'a' }] })).status).toBe(403);
    }
    expect(await produkt('l-frei')).toMatchObject({ id: 'l-frei' });
    expect((await produkt('l-frei'))!.geloeschtAm).toBeUndefined();
    expect(await produkt('l-alt')).toBeDefined();
  });

  it('Löschen ohne Papierkorb wird abgelehnt (409) — erst in den Papierkorb, die Marke setzt der Server', async () => {
    const r = await crmPatch('malin', [{ liste: 'leistungen', op: 'delete', id: 'l-frei' }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { fehler: string }).fehler).toMatch(/nicht im Papierkorb/);
    const vorher = Date.now();
    const r2 = await crmPatch('malin', [{ liste: 'leistungen', op: 'teil', id: 'l-frei', felder: { geloeschtAm: '1999-01-01T00:00:00.000Z' } }]);
    expect(r2.status).toBe(200);
    const am = (await produkt('l-frei'))!.geloeschtAm!;
    expect(Date.parse(am)).toBeGreaterThanOrEqual(vorher - 1000); // Server-Zeit, nicht die vom Browser
    // Frist nicht verschiebbar: eine andere Marke ändert nichts.
    await crmPatch('kevin', [{ liste: 'leistungen', op: 'teil', id: 'l-frei', felder: { geloeschtAm: '2030-01-01T00:00:00.000Z' } }]);
    expect((await produkt('l-frei'))!.geloeschtAm).toBe(am);
    // Rückgängig/Wiederherstellen: Marke weg.
    expect((await crmPatch('kevin', [{ liste: 'leistungen', op: 'teil', id: 'l-frei', felder: { geloeschtAm: null } }])).status).toBe(200);
    expect((await produkt('l-frei'))!.geloeschtAm).toBeUndefined();
  });

  it('Papierkorb mit laufendem Mandat geht (Verweis bleibt gültig) — endgültig erst, wenn nichts mehr daran hängt', async () => {
    expect((await crmPatch('kevin', [{ liste: 'leistungen', op: 'teil', id: 'l-mandat', felder: { geloeschtAm: J } }])).status).toBe(200);
    expect((await crmPatch('kevin', [{ liste: 'leistungen', op: 'delete', id: 'l-mandat' }])).status).toBe(409);
    expect(await produkt('l-mandat')).toBeDefined();
    // Aus dem Papierkorb, ohne Verweise: endgültig.
    expect((await crmPatch('kevin', [{ liste: 'leistungen', op: 'delete', id: 'l-alt' }])).status).toBe(200);
    expect(await produkt('l-alt')).toBeUndefined();
  });

  it('Morgenlauf: abgelaufen + ohne Verweise → weg; mit Mandat bleibt es im Papierkorb', async () => {
    await db.saveJson('crm', { ...(await speicher.ladeCrm()), leistungen: [L('l-x', { geloeschtAm: '2026-08-01T00:00:00.000Z' }), L('l-mandat', { geloeschtAm: '2026-08-01T00:00:00.000Z' })] });
    const { produktePapierkorbAufraeumen } = await import('@/lib/crm/produkte-server');
    expect(await produktePapierkorbAufraeumen(new Date(J))).toEqual({ produkte: 1 });
    expect((await speicher.ladeCrm()).leistungen.map(l => l.id)).toEqual(['l-mandat']);
  });

  it('Papierkorb und Archiv der Aufgaben: nur erlaubte Einträge — fremde „nur ich“ weder gelistet noch löschbar/archivierbar/wiederherstellbar (404)', async () => {
    const korbListe = async (p: string) => ((await (await aufgabenRoute.GET(new Request('http://test/api/state/tasks?papierkorb=1', { headers: kopf(p) }))).json()) as { state: { tasks: Task[] } }).state.tasks.map(t => t.id);
    const malin = await korbListe('malin');
    expect(malin).not.toContain('k-geheim');
    expect(malin).not.toContain('k-korb');
    expect(malin).not.toContain('k-archiv');
    expect(await korbListe('kevin')).toEqual(expect.arrayContaining(['k-geheim', 'k-korb', 'k-archiv']));
    const gesp = async (id: string) => (await db.loadJson<TasksState>('tasks'))!.tasks.find(t => t.id === id)!;
    expect((await aufgabenPatch('malin', { ops: [{ op: 'delete', id: 'k-geheim' }] })).status).toBe(404);
    expect((await aufgabenPatch('malin', { ops: [{ op: 'delete', id: 'k-korb' }] })).status).toBe(404); // endgültig
    const roh = await gesp('k-korb');
    expect((await aufgabenPatch('malin', { ops: [{ op: 'upsert', task: { ...roh, geloeschtAm: null } }] })).status).toBe(404); // wiederherstellen
    expect((await aufgabenPatch('malin', { ops: [{ op: 'upsert', task: { ...(await gesp('k-geheim')), archiviertAm: J, archivId: 'ea-k-geheim' } }] })).status).toBe(404); // archivieren
    expect((await gesp('k-geheim')).archiviertAm).toBeUndefined();
    expect((await gesp('k-korb')).geloeschtAm).toBe(J);
    expect((await gesp('k-archiv')).archivId).toBe('ea-k-archiv');
    // Die Besitzerin selbst darf: Kevin holt seine archivierte Aufgabe zurück.
    // Ohne Stand ist ein Upsert ein Teil-Merge — „leeren“ heißt null.
    expect((await aufgabenPatch('kevin', { ops: [{ op: 'upsert', task: { ...(await gesp('k-archiv')), archiviertAm: null, archivId: null } }] })).status).toBe(200);
    expect((await gesp('k-archiv')).archiviertAm).toBeUndefined();
  });

  it('Aufgaben: Mitglied archiviert einzeln (Marke bleibt gespeichert); eine Lauf-Marke vom Browser fällt weg', async () => {
    const lesen = async () => ((await (await aufgabenRoute.GET(new Request('http://test/api/state/tasks?papierkorb=1', { headers: kopf('malin') }))).json()) as { state: { tasks: (Task & { stand: string })[] } }).state.tasks;
    const b = (await lesen()).find(t => t.id === 'b')!;
    const { stand: st, ...ohne } = b;
    const r = await aufgabenPatch('malin', { ops: [{ op: 'upsert', task: { ...ohne, archiviertAm: J, archivId: 'ea-b' }, stand: st }] });
    expect(r.status).toBe(200);
    const gesp = (await db.loadJson<TasksState>('tasks'))!.tasks.find(t => t.id === 'b')!;
    expect(gesp).toMatchObject({ archiviertAm: J, archivId: 'ea-b' });
    const a = (await lesen()).find(t => t.id === 'a')!;
    const { stand: st2, ...ohneA } = a;
    expect((await aufgabenPatch('malin', { ops: [{ op: 'upsert', task: { ...ohneA, archiviertAm: J, archivId: 'na-gefaelscht-1' }, stand: st2 }] })).status).toBe(200);
    expect((await db.loadJson<TasksState>('tasks'))!.tasks.find(t => t.id === 'a')!.archiviertAm).toBeUndefined();
  });
});

describe('Produkt zurückholen (Kevin 04.10.: „wieder aktiv“)', () => {
  it('merkt den Status vor dem Archivieren und stellt ihn wieder her — „aktiv“ nur mit Leistungstext', async () => {
    const { produktArchivieren, produktZurueck } = await import('@/lib/crm/produkte');
    expect(produktArchivieren({ status: 'aktiv' })).toEqual({ status: 'eingestellt', statusVorArchiv: 'aktiv' });
    expect(produktArchivieren({ status: 'entwurf' })).toEqual({ status: 'eingestellt', statusVorArchiv: 'entwurf' });
    expect(produktZurueck({ statusVorArchiv: 'aktiv' }, true)).toEqual({ status: 'aktiv' });
    expect(produktZurueck({}, true)).toEqual({ status: 'aktiv' });
    expect(produktZurueck({ statusVorArchiv: 'entwurf' }, true)).toEqual({ status: 'entwurf' });
    expect(produktZurueck({ statusVorArchiv: 'aktiv' }, false)).toEqual({ status: 'entwurf' });
  });
});
