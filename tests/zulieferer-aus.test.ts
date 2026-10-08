// ─── Mac-Zulieferer abschalten (08.10., Lücke 10 der Roadmap, Kevin R6) ─────────────────────────────────────────────────────
// Kevin: „alles nur auf dem Server führen; wir brauchen nachher im Mac nur noch die API zur Mail.“ Geprüft wird:
//   · die EINE Regel an/aus (Umgebung > Einstellung > Übernahme > Altbestand > neue Instanz),
//   · Vorschau und Übernahme der Apple-Erinnerungen als Aufgaben (idempotent, feste Kennungen, Inhaber verantwortlich, „nur ich“ in
//     Privat, Erledigte nur auf Wunsch), Abbruch nach jedem Schritt (Absichtsprotokoll),
//   · nur der Inhaber per Sitzung (Dienstweg 403), Schalter, 410 der Zulieferung, HOI ohne gelb, Kalender ohne Erinnerungen,
//   · neue Instanz ohne Zulieferer, Spiegel löschen, Art. 17 in eingefrorenen Spiegeln, Verzeichnis archiviert, Mac-Skript.
// Eigener Datenordner, erfundene Daten (@example.invalid) — nie der echte Bestand, nie echte Apple-Daten.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Vor allen Imports (die Datenschicht prüft den Ordner beim ersten Zugriff): eigener Datenordner, Test-Schlüssel, keine Apple-Umgebung.
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-zulieferer-aus-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-dienstschluessel-zulieferer-aus';
  for (const n of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_ZULIEFERER', 'MAKE_OS_ZULIEFERER_KEY', 'ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT']) delete process.env[n];
  return o;
});

import { zuliefererWirksam } from '@/lib/zulieferer/schalter';
import { zuliefererUmgebung } from '@/lib/zugang/intern';
import {
  erinnerungenLesen, vorschauBauen, zuUebernehmen, aufgabenBauen, wahlSauber, skriptZeileLesen, kennungAus, prioritaetAus, faelligkeitAus,
  NotizZuLang, WAHL_VORGABE, SKRIPT_FELD, type Erinnerung,
} from '@/lib/zulieferer/erinnerungen';
import { zugangBefunde } from '@/lib/hoi/lage';
import { zuliefererVerarbeitungArchivieren, verzeichnisVervollstaendigen, VV_MAC_ID } from '@/lib/crm/datenschutz';
import { verzeichnisDokument, verzeichnisHtml } from '@/lib/datenschutz/verzeichnis-export';
import { fristenWirksam } from '@/lib/crm/loeschfristen';
import { macSpiegelRaus, merkmaleVon } from '@/lib/crm/person-weitere';
import type { Task, TasksState } from '@/types/tasks';

const WAND = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d).replace(' ', 'T');
const HAUS = 'zl-haus';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });

/** Ein Spiegel in der neuen Form (mit UID) — erfundene Erinnerungen. */
const SPIEGEL_NEU = [
  { id: 'reminder-0', uid: 'x-apple-reminder://AAAA-1', list: 'Haushalt', title: 'Fahrrad zur Werkstatt', due: '2026-10-12T00:00', notes: 'Hinterrad\nSchlauch prüfen', completed: false, priority: 1 },
  { id: 'reminder-1', uid: 'x-apple-reminder://AAAA-2', list: 'Haushalt', title: 'Steuerunterlagen sortieren', due: '2026-10-14T18:30', completed: false, priority: 5 },
  { id: 'reminder-2', uid: 'x-apple-reminder://AAAA-3', list: 'Firma', title: 'Angebotsvorlage prüfen', completed: false, priority: 9 },
  { id: 'reminder-3', uid: 'x-apple-reminder://AAAA-4', list: 'Haushalt', title: 'Altglas wegbringen', completed: true, priority: 0 },
];
/** Die alte Form (vor 08.10.): ohne UID/Notiz/erledigt, Fälligkeit als ISO mit Zone oder gar nicht. */
const SPIEGEL_ALT = [
  { id: 'reminder-0', list: 'Haushalt', title: 'Fahrrad zur Werkstatt', due: '2026-10-12T08:00:00.000Z', priority: 0, source: 'apple-reminders' },
  { id: 'reminder-1', list: 'Haushalt', title: 'Fahrrad zur Werkstatt', priority: 0, source: 'apple-reminders' },
];

// ── 1. Die Regel ─────────────────────────────────────────────────────────────

describe('an oder aus — EINE Regel (rein)', () => {
  const basis = { umgebung: null, einstellung: null, uebernahmeAm: null, altbestand: false };
  it('neue Instanz: aus · Altbestand: an · nach der Übernahme: aus', () => {
    expect(zuliefererWirksam(basis)).toEqual({ aktiv: false, quelle: 'neu' });
    expect(zuliefererWirksam({ ...basis, altbestand: true })).toEqual({ aktiv: true, quelle: 'altbestand' });
    expect(zuliefererWirksam({ ...basis, altbestand: true, uebernahmeAm: '2026-10-09T10:00:00.000Z' })).toEqual({ aktiv: false, quelle: 'uebernommen' });
  });
  it('die Einstellung gewinnt vor der Vorgabe, die Umgebung vor allem', () => {
    expect(zuliefererWirksam({ ...basis, altbestand: true, einstellung: 'aus' })).toEqual({ aktiv: false, quelle: 'einstellung' });
    expect(zuliefererWirksam({ ...basis, uebernahmeAm: '2026-10-09', einstellung: 'an' })).toEqual({ aktiv: true, quelle: 'einstellung' });
    expect(zuliefererWirksam({ ...basis, einstellung: 'an', umgebung: 'aus' })).toEqual({ aktiv: false, quelle: 'umgebung' });
    expect(zuliefererWirksam({ ...basis, umgebung: 'an' })).toEqual({ aktiv: true, quelle: 'umgebung' });
  });
  it('Umgebung MAKE_OS_ZULIEFERER: aus/an in den üblichen Schreibweisen, sonst nicht gesetzt', () => {
    for (const w of ['aus', 'AUS', '0', 'nein', 'off']) expect(zuliefererUmgebung({ MAKE_OS_ZULIEFERER: w }), w).toBe('aus');
    for (const w of ['an', '1', 'ja', 'on']) expect(zuliefererUmgebung({ MAKE_OS_ZULIEFERER: w }), w).toBe('an');
    for (const w of ['', 'vielleicht', undefined]) expect(zuliefererUmgebung({ MAKE_OS_ZULIEFERER: w })).toBeNull();
  });
});

// ── 2. Erinnerungen lesen, Vorschau, Aufgaben bauen (rein) ───────────────────

describe('Erinnerungen → Vorschau → Aufgaben (rein)', () => {
  const liste = () => erinnerungenLesen(SPIEGEL_NEU, WAND);
  it('neue Form: UID → feste Kennung, Notiz, Fälligkeit als Berliner Tag (Mitternacht = ohne Uhrzeit), erledigt, Priorität', () => {
    const l = liste();
    expect(l).toHaveLength(4);
    expect(l[0]).toMatchObject({ kennung: kennungAus('uid:x-apple-reminder://AAAA-1'), liste: 'Haushalt', titel: 'Fahrrad zur Werkstatt', tag: '2026-10-12', notiz: 'Hinterrad\nSchlauch prüfen', erledigt: false, prioritaet: 'high' });
    expect(l[0].zeit).toBeUndefined();
    expect(l[1]).toMatchObject({ tag: '2026-10-14', zeit: '18:30', prioritaet: 'medium' });
    expect(l[2]).toMatchObject({ prioritaet: 'low' });
    expect(l[2].tag).toBeUndefined();
    expect(l[3].erledigt).toBe(true);
    // Kennung ist stabil und kennt auch die Rückfall-Kennung (für Spiegel ohne UID)
    expect(erinnerungenLesen(SPIEGEL_NEU, WAND)[0].kennungen).toEqual(l[0].kennungen);
    expect(l[0].kennungen).toHaveLength(2);
    expect(l.every(e => /^ar-[a-z0-9]+$/.test(e.kennung))).toBe(true);
  });
  it('alte Form: ISO mit Zone → Berliner Wandzeit; gleicher Titel in derselben Liste = zwei Erinnerungen (Vorkommen zählt)', () => {
    const l = erinnerungenLesen(SPIEGEL_ALT, WAND);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ tag: '2026-10-12', zeit: '10:00' });
    expect(l[0].kennung).not.toBe(l[1].kennung);
    expect(l[0].kennungen).toEqual([l[0].kennung]);
    // die Rückfall-Kennung der alten Form = die zweite Kennung der neuen Form (gleiche Liste, gleicher Titel, 1. Vorkommen)
    expect(liste()[0].kennungen[1]).toBe(l[0].kennung);
  });
  it('Unsinn fällt heraus, ohne Liste → „Erinnerungen“; Priorität und Fälligkeit tolerant', () => {
    expect(erinnerungenLesen([null, 7, { title: '' }, { title: '  Ohne Liste  ' }], WAND)).toMatchObject([{ liste: 'Erinnerungen', titel: 'Ohne Liste' }]);
    expect(erinnerungenLesen('kaputt', WAND)).toEqual([]);
    expect([prioritaetAus(0), prioritaetAus(3), prioritaetAus(5), prioritaetAus(7), prioritaetAus('x')]).toEqual(['medium', 'high', 'medium', 'low', 'medium']);
    expect(faelligkeitAus('2026-02-30T10:00', WAND)).toEqual({});
    expect(faelligkeitAus('missing value', WAND)).toEqual({});
  });
  it('Vorschau: Zähler, Listen mit vorgeschlagenem Space (privat), „schon übernommen“ über JEDE Kennung', () => {
    const l = liste();
    const v = vorschauBauen(l, new Set([l[1].kennungen[1]]));
    expect(v.zaehler).toEqual({ gesamt: 4, offen: 3, erledigt: 1, schon: 1, neuOffen: 2, neuErledigt: 1 });
    expect(v.listen).toEqual([{ name: 'Firma', anzahl: 1, offen: 1, erledigt: 0, schon: 0, space: 'privat' }, { name: 'Haushalt', anzahl: 3, offen: 2, erledigt: 1, schon: 1, space: 'privat' }]);
    expect(v.zeilen.find(z => z.titel === 'Steuerunterlagen sortieren')!.schon).toBe(true);
    expect(v.zeilen.find(z => z.titel === 'Fahrrad zur Werkstatt')!.notiz).toBe(true);
    expect(JSON.stringify(v)).not.toContain('Schlauch'); // Notiztexte erst in der Aufgabe, nicht in der Vorschau
  });
  it('Auswahl: abgewählte und schon übernommene nie, erledigte nur auf Wunsch', () => {
    const l = liste();
    const da = new Set([l[1].kennung]);
    expect(zuUebernehmen(l, da, WAHL_VORGABE).map(e => e.titel)).toEqual(['Fahrrad zur Werkstatt', 'Angebotsvorlage prüfen']);
    expect(zuUebernehmen(l, da, { ...WAHL_VORGABE, erledigte: true, ohne: [l[2].kennung] }).map(e => e.titel)).toEqual(['Fahrrad zur Werkstatt', 'Altglas wegbringen']);
  });
  it('Aufgaben: Inhaber verantwortlich, Space je Liste, „nur ich“ nur in Privat, Notiz + Fälligkeit, erledigt = done', () => {
    const l = liste();
    const wahl = { ...WAHL_VORGABE, erledigte: true, spaces: { Firma: 'ug' } };
    const a = aufgabenBauen(zuUebernehmen(l, new Set(), wahl), wahl, { inhaber: 'kevin', jetzt: '2026-10-09T10:00:00.000Z' });
    const nach = (t: string) => a.find(x => x.title === t)!;
    expect(nach('Fahrrad zur Werkstatt')).toMatchObject({ id: l[0].kennung, assignee: 'kevin', spaceId: 'privat', sichtbarkeit: 'nur-ich', dueDate: '2026-10-12', notiz: 'Hinterrad\nSchlauch prüfen', status: 'todo', priority: 'high', tags: ['apple-erinnerung'] });
    expect(nach('Fahrrad zur Werkstatt').dueTime).toBeUndefined();
    expect(nach('Steuerunterlagen sortieren')).toMatchObject({ dueDate: '2026-10-14', dueTime: '18:30' });
    expect(nach('Angebotsvorlage prüfen')).toMatchObject({ spaceId: 'ug' });
    expect(nach('Angebotsvorlage prüfen').sichtbarkeit).toBeUndefined();
    expect(nach('Altglas wegbringen')).toMatchObject({ status: 'done' });
    const ohneNurIch = aufgabenBauen([l[0]], { ...WAHL_VORGABE, nurIchPrivat: false }, { inhaber: 'kevin', jetzt: '2026-10-09T10:00:00.000Z' });
    expect(ohneNurIch[0].sichtbarkeit).toBeUndefined();
  });
  it('langer Titel: gekürzt, der volle Titel steht oben in der Notiz — eine zu lange Notiz wird abgelehnt, nie gekürzt', () => {
    const lang = 'Wort '.repeat(80).trim();
    const [e] = erinnerungenLesen([{ list: 'L', title: lang, notes: 'Rest' }], WAND);
    const [a] = aufgabenBauen([e], WAHL_VORGABE, { inhaber: 'kevin', jetzt: '2026-10-09T10:00:00.000Z' });
    expect(String(a.title).length).toBeLessThanOrEqual(300);
    expect(String(a.notiz)).toBe(`Voller Titel: ${lang}\n\nRest`);
    const [riesig] = erinnerungenLesen([{ list: 'L', title: 'Notiz', notes: 'x'.repeat(19_000) }], WAND);
    const zuLang: Erinnerung = { ...riesig, notiz: 'x'.repeat(50_001) };
    expect(() => aufgabenBauen([zuLang], WAHL_VORGABE, { inhaber: 'kevin', jetzt: 'x' })).toThrow(NotizZuLang);
  });
  it('Auswahl prüfen: Spaces nur aus der Liste, Kennungen nur ar-…, Grenzen → 413', () => {
    expect(wahlSauber(undefined, ['privat'])).toEqual({ ok: true, wahl: WAHL_VORGABE });
    expect(wahlSauber({ spaces: { Haushalt: 'm-fremd' } }, ['privat', 'ug'])).toMatchObject({ ok: false, status: 400 });
    expect(wahlSauber({ ohne: ['t-1'] }, ['privat'])).toMatchObject({ ok: false, status: 400 });
    expect(wahlSauber({ erledigte: 'ja' }, ['privat'])).toMatchObject({ ok: false, status: 400 });
    expect(wahlSauber({ ohne: Array.from({ length: 5001 }, (_, i) => `ar-${i.toString(36)}x`) }, ['privat'])).toMatchObject({ ok: false, status: 413 });
    expect(wahlSauber({ spaces: { Haushalt: 'ug' }, ohne: ['ar-abc123'], erledigte: true, nurIchPrivat: false }, ['privat', 'ug'])).toEqual({ ok: true, wahl: { spaces: { Haushalt: 'ug' }, ohne: ['ar-abc123'], erledigte: true, nurIchPrivat: false } });
  });
  it('Mac-Seite: eine Zeile des AppleScripts (Steuerzeichen-Trenner, Notiz mit Zeilenumbruch)', () => {
    const z = ['Haushalt', 'Fahrrad', '2026-10-12T09:15', '1', 'x-apple-reminder://AAAA-9', 'Zeile 1\nZeile 2', 'false'].join(SKRIPT_FELD);
    expect(skriptZeileLesen(z, 3)).toEqual({ id: 'reminder-3', uid: 'x-apple-reminder://AAAA-9', list: 'Haushalt', title: 'Fahrrad', due: '2026-10-12T09:15', notes: 'Zeile 1\nZeile 2', completed: false, priority: 1, source: 'apple-reminders' });
    expect(skriptZeileLesen(['L', 'Erledigt', '', '0', '', 'missing value', 'true'].join(SKRIPT_FELD), 0)).toEqual({ id: 'reminder-0', list: 'L', title: 'Erledigt', completed: true, priority: 0, source: 'apple-reminders' });
    expect(skriptZeileLesen('', 0)).toBeNull();
  });
});

// ── 3. Mit Datenordner: Route, Übernahme, Schalter, Kalender, HOI ────────────

type H = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let srv: typeof import('@/lib/zulieferer/server');
let ab: typeof import('@/lib/store/absichten');
let route: { GET: H; POST: H };
let zulieferung: { GET: H; POST: H };

const anfrage = (pfad: string, kopf: Record<string, string>, methode = 'GET', body?: unknown) => new Request(`http://test/api/${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const tasks = async () => ((await db.loadJson<TasksState>('tasks'))?.tasks ?? []) as Task[];

async function grundzustand(o: { spiegel?: unknown; einstellungen?: Record<string, unknown> } = {}) {
  for (const n of ['tasks', 'zulieferer-uebernahme', 'apple-reminders-cache', 'apple-contacts-cache', `absichten--${HAUS}`]) await db.bestandEntfernen(n).catch(() => {});
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'gast', 'mitglied', { haushalt: 'anderer-haus' })], einladungen: [], ...(o.einstellungen ? { einstellungen: o.einstellungen } : {}) });
  if (o.spiegel !== undefined) await db.saveJson('apple-reminders-cache', { daten: o.spiegel, at: '2026-10-08T20:00:00.000Z', quelle: 'zulieferung' });
  ab.absichtTest.vorAbhaken = null; ab.absichtTest.nachAbhaken = null; ab.absichtTest.vorSchritt = null;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  srv = await import('@/lib/zulieferer/server');
  ab = await import('@/lib/store/absichten');
  route = await import('@/app/api/zulieferer/route') as unknown as { GET: H; POST: H };
  zulieferung = await import('@/app/api/zulieferung/route') as unknown as { GET: H; POST: H };
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => { delete process.env.MAKE_OS_ZULIEFERER; await grundzustand(); });

describe('nur der Inhaber per Sitzung', () => {
  it('Inhaber 200 · Mitglied 403 · fremder Haushalt 403 · ohne Sitzung 401 · Dienstweg (auch „im Auftrag“ des Inhabers) 403', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    expect((await route.GET(anfrage('zulieferer', sitzung('kevin')))).status).toBe(200);
    expect((await route.GET(anfrage('zulieferer', sitzung('malin')))).status).toBe(403);
    expect((await route.GET(anfrage('zulieferer', sitzung('gast')))).status).toBe(403);
    expect((await route.GET(anfrage('zulieferer', { 'content-type': 'application/json' }))).status).toBe(401);
    expect((await route.GET(anfrage('zulieferer', dienst()))).status).toBe(403);
    expect((await route.GET(anfrage('zulieferer', dienst('kevin')))).status).toBe(403);
    for (const k of [sitzung('malin'), dienst('kevin'), dienst()]) expect((await route.POST(anfrage('zulieferer', k, 'POST', { aktion: 'uebernehmen' }))).status).toBe(403);
    expect(await tasks()).toEqual([]);
  });
});

describe('Vorschau → Bestätigen (idempotent)', () => {
  it('GET zeigt Vorschau und wählbare Spaces; Altbestand → Zulieferer läuft noch', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    const d = await (await route.GET(anfrage('zulieferer', sitzung('kevin')))).json() as { lage: { aktiv: boolean; quelle: string }; spiegel: { erinnerungen: { anzahl: number } }; uebernahme: { vorschau: { zaehler: { neuOffen: number } }; spaces: { id: string }[] } };
    expect(d.lage).toMatchObject({ aktiv: true, quelle: 'altbestand' });
    expect(d.spiegel.erinnerungen.anzahl).toBe(4);
    expect(d.uebernahme.vorschau.zaehler.neuOffen).toBe(3);
    expect(d.uebernahme.spaces.map(s => s.id)).toEqual(expect.arrayContaining(['privat', 'kdc', 'kdv', 'ug']));
  });

  it('Bestätigen legt die Aufgaben an — zweimal bestätigen legt nichts doppelt an; danach ist der Zulieferer aus', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    const r = await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen', wahl: { spaces: { Firma: 'ug' } } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, neu: 3, schon: 0, lage: { aktiv: false, quelle: 'uebernommen' } });
    const t = await tasks();
    expect(t).toHaveLength(3);
    const fahrrad = t.find(x => x.title === 'Fahrrad zur Werkstatt')!;
    expect(fahrrad).toMatchObject({ assignee: 'kevin', angelegtVon: 'kevin', sichtbarkeit: 'nur-ich', spaceId: 'privat', dueDate: '2026-10-12', notiz: 'Hinterrad\nSchlauch prüfen', status: 'todo' });
    expect(fahrrad.id).toMatch(/^ar-/);
    expect(t.find(x => x.title === 'Angebotsvorlage prüfen')).toMatchObject({ spaceId: 'ug' });
    expect(t.find(x => x.title === 'Altglas wegbringen')).toBeUndefined(); // erledigt: nur auf Wunsch
    // zweimal
    const r2 = await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen', wahl: { erledigte: true } }));
    expect(await r2.json()).toMatchObject({ ok: true, neu: 1, schon: 3 }); // nur die erledigte kommt dazu
    expect((await tasks()).find(x => x.title === 'Altglas wegbringen')).toMatchObject({ status: 'done' });
    const r3 = await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen', wahl: { erledigte: true } }));
    expect(await r3.json()).toMatchObject({ ok: true, neu: 0, schon: 4 });
    expect(await tasks()).toHaveLength(4);
    const stand = await srv.ladeUebernahmeStand();
    expect(stand.bestaetigtAm).toBeTruthy();
    expect(JSON.stringify(stand)).not.toMatch(/Fahrrad|Haushalt|kevin/); // nur Zeitpunkte und Zahlen
    expect((await ab.absichtenLaden(HAUS)).filter(ab.istOffen)).toHaveLength(0);
  });

  it('ein späterer Spiegel MIT UID erkennt die aus einem Spiegel OHNE UID übernommenen Erinnerungen (keine Doppelten)', async () => {
    await grundzustand({ spiegel: [{ list: 'Haushalt', title: 'Fahrrad zur Werkstatt' }] });
    await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen' }));
    expect(await tasks()).toHaveLength(1);
    await db.saveJson('apple-reminders-cache', { daten: SPIEGEL_NEU, at: '2026-10-09T08:00:00.000Z', quelle: 'zulieferung' });
    const d = await (await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen' }))).json();
    expect(d).toMatchObject({ neu: 2, schon: 1 });
    expect((await tasks()).filter(x => x.title === 'Fahrrad zur Werkstatt')).toHaveLength(1);
  });

  it('„nur ich“: Privat-Aufgaben sieht die andere Person nicht, Business-Aufgaben schon', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen', wahl: { spaces: { Firma: 'ug' } } }));
    const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
    const malin = (await ladeAufgabenSicht('malin')).tasks.map(t => t.title);
    const kevin = (await ladeAufgabenSicht('kevin')).tasks.map(t => t.title);
    expect(malin).toEqual(['Angebotsvorlage prüfen']);
    expect(kevin).toHaveLength(3);
  });

  it('abgewählte bleiben weg; unbekannter Space → 400, nichts angelegt', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    expect((await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen', wahl: { spaces: { Haushalt: 'm-gibts-nicht' } } }))).status).toBe(400);
    expect(await tasks()).toEqual([]);
    const ohne = erinnerungenLesen(SPIEGEL_NEU, WAND).filter(e => e.liste === 'Haushalt').map(e => e.kennung);
    const d = await (await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'uebernehmen', wahl: { ohne } }))).json();
    expect(d).toMatchObject({ ok: true, neu: 1 });
    expect((await tasks()).map(t => t.title)).toEqual(['Angebotsvorlage prüfen']);
  });

  for (const [schritt, haken] of [['aufgaben', 'vorAbhaken'], ['aufgaben', 'nachAbhaken'], ['abschluss', 'vorAbhaken']] as const) {
    it(`Abbruch (${haken} „${schritt}“) → die Wiederaufnahme führt zu Ende, ohne Doppelte`, async () => {
      await grundzustand({ spiegel: SPIEGEL_NEU });
      ab.absichtTest[haken] = (art, s) => { if (art === 'erinnerungen-uebernahme' && s === schritt) throw new ab.TestAbbruch(s); };
      await expect(srv.erinnerungenUebernehmen({ person: 'kevin', wahl: WAHL_VORGABE })).rejects.toThrow(/Testabbruch/);
      ab.absichtTest[haken] = null;
      const offen = (await ab.absichtenLaden(HAUS)).filter(ab.istOffen);
      expect(offen).toHaveLength(1);
      expect(offen[0].art).toBe('erinnerungen-uebernahme');
      await srv.erinnerungenUebernahmeFortsetzen(HAUS, offen[0]);
      expect(await tasks()).toHaveLength(3);
      expect((await srv.ladeUebernahmeStand()).bestaetigtAm).toBeTruthy();
      expect((await ab.absichtenLaden(HAUS)).filter(ab.istOffen)).toHaveLength(0);
      const fertig = (await ab.absichtenLaden(HAUS)).find(a => a.id === offen[0].id)!;
      expect(JSON.stringify(fertig.daten)).not.toContain('Haushalt'); // Auswahl beim Abschluss geleert
    });
  }
});

describe('Schalter, 410, HOI, Kalender', () => {
  it('ausschalten vor der Übernahme: 409 mit der Zahl offener Erinnerungen — ausdrücklich ohne Übernahme geht es', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    const r = await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'schalten', an: false }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ offen: 3 });
    expect((await srv.zuliefererLage()).aktiv).toBe(true);
    const r2 = await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'schalten', an: false, ohneUebernahme: true }));
    expect(await r2.json()).toMatchObject({ ok: true, lage: { aktiv: false, quelle: 'einstellung' } });
    // Instanz-Einstellung in konten.json, im Änderungsprotokoll nur der Feldname
    const { ladeKonten } = await import('@/lib/zugang/konten');
    expect((await ladeKonten()).einstellungen).toMatchObject({ zulieferer: 'aus' });
    // wieder an
    expect(await (await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'schalten', an: true }))).json()).toMatchObject({ ok: true, lage: { aktiv: true } });
  });

  it('aus → POST /api/zulieferung antwortet 410 mit klarem Satz und schreibt nichts; an → nimmt an', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU, einstellungen: { zulieferer: 'aus' } });
    const kopf = { 'content-type': 'application/json', 'x-make-zulieferer': '1' };
    const r = await zulieferung.POST(anfrage('zulieferung', kopf, 'POST', { art: 'kontakte', daten: { kontakte: [] } }));
    expect(r.status).toBe(410);
    expect(await r.json()).toMatchObject({ abgeschaltet: true, fehler: expect.stringContaining('mac-zulieferer-entfernen.sh') });
    expect(await db.loadJson('apple-contacts-cache')).toBeNull();
    await grundzustand({ spiegel: SPIEGEL_NEU, einstellungen: { zulieferer: 'an' } });
    expect((await zulieferung.POST(anfrage('zulieferung', kopf, 'POST', { art: 'kontakte', daten: { kontakte: [] } }))).status).toBe(200);
  });

  it('Umgebung MAKE_OS_ZULIEFERER=aus: schon die Middleware antwortet 410 — auch mit Dienst- bzw. Zulieferer-Schlüssel', async () => {
    const { NextRequest } = await import('next/server');
    const { middleware } = await import('@/middleware');
    const lauf = (h: Record<string, string>) => middleware(new NextRequest('http://localhost:3001/api/zulieferung', { method: 'POST', headers: h } as never));
    process.env.MAKE_OS_ZULIEFERER = 'aus';
    try {
      for (const h of [{ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-forwarded-for': '203.0.113.7' }, {}] as Record<string, string>[]) {
        const r = await lauf(h);
        expect(r.status).toBe(410);
      }
      expect((await srv.zuliefererLage())).toMatchObject({ aktiv: false, quelle: 'umgebung' });
    } finally { delete process.env.MAKE_OS_ZULIEFERER; }
    // ohne Variable: der Übergang wie bisher (nicht 410 in der Middleware)
    expect((await lauf({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-forwarded-for': '203.0.113.7' })).headers.get('x-middleware-next')).toBe('1');
  });

  it('HOI: aus → kein gelb, sondern grau „abgeschaltet“ (wenn es je einen Zulieferer gab); neue Instanz → gar kein Befund', () => {
    const jetzt = '2026-10-09T12:00:00.000Z';
    const alt = { zuliefererSchluessel: false, zuliefererAltZuletzt: '2026-10-09T11:00:00.000Z' };
    expect(zugangBefunde(alt, jetzt)[0]).toMatchObject({ id: 'zulieferer', ampel: 'gelb' });
    expect(zugangBefunde({ ...alt, zulieferer: { aktiv: false, altbestand: true, uebernommen: true } }, jetzt)[0]).toMatchObject({ id: 'zulieferer', ampel: 'grau', wert: 'abgeschaltet' });
    expect(zugangBefunde({ zuliefererSchluessel: false, zuliefererAltZuletzt: null, zulieferer: { aktiv: false, altbestand: false, uebernommen: false } }, jetzt)).toEqual([]);
    expect(zugangBefunde({ ...alt, zulieferer: { aktiv: true, altbestand: true, uebernommen: false } }, jetzt)[0]).toMatchObject({ ampel: 'gelb' });
  });

  it('Kalender: aus → keine Apple-Erinnerungen, Hinweis „übernommen“; an → der Inhaber sieht die offenen (nie erledigte)', async () => {
    const kalender = await import('@/app/api/kalender/route') as unknown as { GET: H };
    await grundzustand({ spiegel: SPIEGEL_NEU });
    const an = await (await kalender.GET(anfrage('kalender?von=2026-10-10&bis=2026-10-20', sitzung('kevin')))).json() as { erinnerungen: { titel: string }[]; erinnerungenAus?: string };
    expect(an.erinnerungen.map(e => e.titel).sort()).toEqual(['Fahrrad zur Werkstatt', 'Steuerunterlagen sortieren']);
    expect(an.erinnerungenAus).toBeUndefined();
    await srv.erinnerungenUebernehmen({ person: 'kevin', wahl: WAHL_VORGABE });
    const aus = await (await kalender.GET(anfrage('kalender?von=2026-10-10&bis=2026-10-20', sitzung('kevin')))).json() as { erinnerungen: unknown[]; erinnerungenAus?: string; erinnerungenStand: unknown };
    expect(aus).toMatchObject({ erinnerungen: [], erinnerungenAus: 'uebernommen', erinnerungenStand: null });
  });

  it('Apple-Routen auf dem Server: aus → kein Leser des Spiegels mehr (leer, Hinweis)', async () => {
    const rem = await import('@/app/api/apple-reminders/route') as unknown as { GET: H };
    const kon = await import('@/app/api/apple-contacts/route') as unknown as { GET: H };
    await grundzustand({ spiegel: SPIEGEL_NEU });
    await db.saveJson('apple-contacts-cache', { daten: { kontakte: [{ id: 'mac-0', name: 'Vera Beispiel' }], anzahl: 1 }, at: '2026-10-08T20:00:00.000Z', quelle: 'zulieferung' });
    expect(await (await rem.GET(anfrage('apple-reminders', sitzung('kevin')))).json()).toHaveLength(4);
    await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'schalten', an: false, ohneUebernahme: true }));
    const r = await rem.GET(anfrage('apple-reminders', sitzung('kevin')));
    expect(r.headers.get('x-zulieferer')).toBe('aus');
    expect(await r.json()).toEqual([]);
    const k = await (await kon.GET(anfrage('apple-contacts', sitzung('kevin')))).json() as Record<string, unknown>;
    expect(k).toMatchObject({ kontakte: [], anzahl: 0, hinweis: expect.stringContaining('Kartei') });
    expect(JSON.stringify(k)).not.toContain('Vera');
  });
});

describe('neue Instanz, Spiegel löschen, Art. 17, Verzeichnis', () => {
  it('neue Instanz (leerer Datenordner, kein Spiegel): Zulieferer aus, Zulieferung 410, nichts zu übernehmen', async () => {
    expect(await srv.zuliefererLage()).toMatchObject({ aktiv: false, quelle: 'neu', altbestand: false });
    expect((await zulieferung.POST(anfrage('zulieferung', { 'x-make-zulieferer': '1' }, 'POST', { art: 'erinnerungen', daten: [] }))).status).toBe(410);
    const d = await (await route.GET(anfrage('zulieferer', sitzung('kevin')))).json() as { uebernahme: { vorschau: { zaehler: { gesamt: number } } } };
    expect(d.uebernahme.vorschau.zaehler.gesamt).toBe(0);
    const g = await (await zulieferung.GET(anfrage('zulieferung', sitzung('kevin')))).json();
    expect(g).toMatchObject({ aktiv: false, quelle: 'neu' });
  });

  it('Spiegel löschen: läuft der Zulieferer → 409; aus → ganz weg (samt Tageskopien), zweimal = nichts mehr da', async () => {
    await grundzustand({ spiegel: SPIEGEL_NEU });
    expect((await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'spiegel-loeschen', art: 'erinnerungen' }))).status).toBe(409);
    await srv.erinnerungenUebernehmen({ person: 'kevin', wahl: WAHL_VORGABE });
    expect(await (await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'spiegel-loeschen', art: 'erinnerungen' }))).json()).toMatchObject({ ok: true, war: true });
    expect(await db.loadJson('apple-reminders-cache')).toBeNull();
    expect(await (await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'spiegel-loeschen', art: 'erinnerungen' }))).json()).toMatchObject({ ok: true, war: false });
    expect((await srv.ladeUebernahmeStand()).cacheGeloescht?.erinnerungen).toBeTruthy();
    expect((await srv.zuliefererLage())).toMatchObject({ aktiv: false, quelle: 'uebernommen' }); // bleibt aus
    expect((await route.POST(anfrage('zulieferer', sitzung('kevin'), 'POST', { aktion: 'spiegel-loeschen', art: 'kalender' }))).status).toBe(400);
  });

  it('Art. 17: eingefrorener Spiegel (aus) — Einträge der Person fallen wirklich weg; läuft der Zulieferer, wird nur gezählt', async () => {
    const m = merkmaleVon('c-test1', { vorname: 'Vera', nachname: 'Beispiel', email: 'vera@example.invalid' });
    const kontakte = { daten: { kontakte: [{ id: 'mac-0', name: 'Vera Beispiel', email: 'vera@example.invalid', art: 'privat' }, { id: 'mac-1', name: 'Otto Muster', art: 'geschaeftlich' }], anzahl: 2, zaehl: { privat: 1, geschaeftlich: 1 } }, at: 'x', quelle: 'zulieferung' };
    const r = macSpiegelRaus(kontakte as unknown as Record<string, unknown>, m);
    expect(r.n).toBe(1);
    expect(r.neu).toMatchObject({ daten: { anzahl: 1, zaehl: { geschaeftlich: 1 } } });
    const { weitereEntfernen } = await import('@/lib/crm/person-weitere');
    await grundzustand({ spiegel: [{ list: 'L', title: 'Vera Beispiel anrufen' }, { list: 'L', title: 'Milch' }] });
    let erg = await weitereEntfernen(m);
    expect(erg.nurInApple['apple-reminders-cache']).toBe(1);
    expect(((await db.loadJson<{ daten: unknown[] }>('apple-reminders-cache'))!.daten)).toHaveLength(2); // läuft → nur zählen
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber')], einladungen: [], einstellungen: { zulieferer: 'aus' } });
    erg = await weitereEntfernen(m);
    expect(erg.speicher['apple-reminders-cache']).toBe(1);
    expect(((await db.loadJson<{ daten: { title: string }[] }>('apple-reminders-cache'))!.daten).map(x => x.title)).toEqual(['Milch']);
  });

  it('Verzeichnis (Art. 30): „Zulieferung vom Rechner“ wird bei „aus“ archiviert (nie gelöscht) — und bei „an“ wieder aktiv', () => {
    const jetzt = '2026-10-09T10:00:00.000Z';
    const { liste } = verzeichnisVervollstaendigen([], jetzt, { zuliefererAus: true });
    const vv = liste.find(v => v.id === VV_MAC_ID)!;
    expect(vv.archiviert).toMatchObject({ am: '2026-10-09', durch: 'zulieferer-aus' });
    expect(verzeichnisVervollstaendigen(liste, jetzt, { zuliefererAus: true }).geaendert).toBe(false); // idempotent
    const wieder = zuliefererVerarbeitungArchivieren(liste, false, jetzt).find(v => v.id === VV_MAC_ID)!;
    expect(wieder.archiviert).toBeUndefined();
    expect(wieder.zweck).toBe(vv.zweck);
    const vonHand = liste.map(v => (v.id === VV_MAC_ID ? { ...v, archiviert: { am: '2026-10-01', grund: 'von Hand', durch: 'hand' as const } } : v));
    expect(zuliefererVerarbeitungArchivieren(vonHand, false, jetzt).find(v => v.id === VV_MAC_ID)!.archiviert).toMatchObject({ durch: 'hand' });
    const html = verzeichnisHtml(verzeichnisDokument({ verarbeitungen: liste, verantwortlicher: null, empfaenger: [], fristen: fristenWirksam(undefined), jetzt }));
    expect(html).toContain('archiviert seit 2026-10-09');
  });
});

// ── 4. Am Mac: das Entfernen-Skript (Trockenlauf, dann ausführen) ────────────

describe('scripts/mac-zulieferer-entfernen.sh', () => {
  const skript = path.resolve(__dirname, '..', 'scripts', 'mac-zulieferer-entfernen.sh');
  it('Trockenlauf ändert nichts; --ausfuehren entlädt und entfernt NUR die Plist; Ausgabe ohne Werte', () => {
    const heim = mkdtempSync(path.join(tmpdir(), 'make-os-mac-'));
    try {
      const agenten = path.join(heim, 'Library', 'LaunchAgents');
      mkdirSync(agenten, { recursive: true });
      mkdirSync(path.join(heim, '.make-os'), { recursive: true });
      writeFileSync(path.join(agenten, 'de.makeos.zulieferer.plist'), '<plist/>');
      writeFileSync(path.join(agenten, 'de.makeos.sicherung.plist'), '<plist/>');
      writeFileSync(path.join(heim, '.make-os', 'zulieferer.env'), 'MAKE_OS_SERVER=https://beispiel.invalid\nMAKE_OS_SERVER_KEY=geheimer-wert-nur-test\n');
      const protokoll = path.join(heim, 'launchctl.log');
      const fake = path.join(heim, 'launchctl');
      writeFileSync(fake, `#!/bin/bash\necho "$@" >> "${protokoll}"\n[[ "$1" == "print" && "$2" == */de.makeos.zulieferer ]] && exit 0\n[[ "$1" == "bootout" ]] && exit 0\nexit 1\n`);
      chmodSync(fake, 0o755);
      const env = { ...process.env, HOME: heim, MAKE_OS_LAUNCHCTL: fake, MAKE_OS_PGREP: '/usr/bin/false', MAKE_OS_UNAME: 'Darwin' };
      const trocken = execFileSync('bash', [skript], { env, encoding: 'utf8' });
      expect(trocken).toContain('Trockenlauf');
      expect(trocken).toContain('würde den Dienst de.makeos.zulieferer entladen');
      expect(existsSync(path.join(agenten, 'de.makeos.zulieferer.plist'))).toBe(true);
      expect(readFileSync(protokoll, 'utf8')).not.toContain('bootout');
      const aus = execFileSync('bash', [skript, '--ausfuehren'], { env, encoding: 'utf8' });
      expect(aus).toContain('entladen');
      expect(readFileSync(protokoll, 'utf8')).toContain('bootout');
      expect(existsSync(path.join(agenten, 'de.makeos.zulieferer.plist'))).toBe(false);
      expect(existsSync(path.join(agenten, 'de.makeos.sicherung.plist'))).toBe(true);
      expect(existsSync(path.join(heim, '.make-os', 'zulieferer.env'))).toBe(true);
      expect(aus).toContain('MAKE_OS_SERVER_KEY'); // der Name …
      expect(aus + trocken).not.toContain('geheimer-wert-nur-test'); // … nie der Wert
      expect(aus + trocken).not.toContain('beispiel.invalid');
      expect(() => execFileSync('bash', [skript, '--unsinn'], { env, encoding: 'utf8', stdio: 'pipe' })).toThrow();
      expect(() => execFileSync('bash', [skript], { env: { ...env, MAKE_OS_UNAME: 'Linux' }, encoding: 'utf8', stdio: 'pipe' })).toThrow();
    } finally { rmSync(heim, { recursive: true, force: true }); }
  });
});
