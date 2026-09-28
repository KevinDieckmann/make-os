// ─── F2 (28.09.): Personenbezug über ALLE Speicher — Art. 15/17, Dubletten, Archiv verschlüsselt ─
// Eigener Datenordner, Dienstschlüssel + Person, Konten mit Haushalt, gesetzter Datenschlüssel.
// Alle Namen, Kennungen und Dateien erfunden — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import type { HeadStand } from '@/lib/heads/stand';
import type { KonfliktStand } from '@/lib/crm/import-konflikte';
import type { DateiEintrag } from '@/lib/dateien/regeln';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-f2';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-f2-nur-im-test';

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let pb: typeof import('@/lib/crm/person-bestaende');
let datenschutz: Route, dateien: Route, dubletten: Route, kontakteRoute: Route, importRoute: Route, umzug: Route;

const kopf = (extra: Record<string, string> = {}) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin', ...extra });
const json = (url: string, body?: unknown, method = 'POST') => new Request(`http://test${url}`, { method, headers: kopf({ 'content-type': 'application/json' }), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const HAUS = 'test-haus';

const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n%%EOF\n`);
async function hochladen(meta: unknown, text = 'Inhalt') {
  const f = new FormData();
  f.append('datei', new File([pdf(text) as BlobPart], 'vertrag.pdf', { type: 'application/pdf' }));
  f.append('meta', JSON.stringify(meta));
  const d = await (await dateien.POST!(new Request('http://test/api/crm/dateien', { method: 'POST', headers: kopf(), body: f }))).json();
  return d.eintrag as DateiEintrag;
}
const ablage = async () => (await db.loadJson<{ eintraege: DateiEintrag[] }>(`crm-dateien--${HAUS}`))?.eintraege ?? [];
/** Alle Bestände (entschlüsselt) als ein Text — für „die Kennung steht nirgends mehr“. */
async function alles(): Promise<string> {
  const namen = readdirSync(ordner).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).filter(n => n !== 'crm-loeschprotokoll' && n !== 'konten');
  const teile = await Promise.all(namen.map(async n => `${n}:${JSON.stringify(await db.loadJson(n))}`));
  return teile.join('\n');
}

function crmMit(id: string, andere: string): CrmBestand {
  return {
    firmen: [], leistungen: [], verarbeitungen: [], segmente: [], newsletter: [], beitraege: [], kampagnen: [], sitzungen: [], antraege: [],
    events: [{ id: 'ev1', titel: 'Abend', datum: '2026-09-20', status: 'durchgefuehrt' }],
    chancen: [{ id: 'ch1', titel: 'Deal', kontaktIds: [id, andere], stufe: 'angebot', historie: [], wert: { betrag: 1, basis: 'monat' }, art: 'retainer', gesellschaft: 'offen', besitzer: 'kevin', angelegt: 'x', geaendert: 'x' }],
    mandate: [], teilnahmen: [
      { id: 't1', eventId: 'ev1', kontaktId: id, status: 'da', notiz: 'kam spät', geaendert: '2026-09-21T10:00:00Z' },
      { id: 't2', eventId: 'ev1', kontaktId: andere, status: 'zugesagt', geaendert: '2026-09-10T10:00:00Z' },
    ],
    followups: [{ id: 'fu1', bezug: { art: 'kontakt', id }, kontaktId: id, art: 'anruf', text: 'Anrufen', faellig: '2026-10-01', zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: 'x', geaendert: 'x' }],
  } as unknown as CrmBestand;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  pb = await import('@/lib/crm/person-bestaende');
  datenschutz = (await import('@/app/api/crm/datenschutz/route')) as unknown as Route;
  dateien = (await import('@/app/api/crm/dateien/route')) as unknown as Route;
  dubletten = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
  kontakteRoute = (await import('@/app/api/state/kontakte/route')) as unknown as Route;
  importRoute = (await import('@/app/api/crm/import/route')) as unknown as Route;
  umzug = (await import('@/app/api/crm/umzug/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Reine Teile', () => {
  it('Kennung nur als ganzes Wort — c-1 trifft nicht c-10', () => {
    expect(pb.enthaeltKennung({ a: ['c-10'] }, 'c-1')).toBe(false);
    expect(pb.enthaeltKennung({ a: 'Link ?k=c-1' }, 'c-1')).toBe(true);
    expect(pb.kennungErsetzen({ ['c-1']: 'c-1 und c-10' }, 'c-1', 'c-2')).toEqual({ ['c-2']: 'c-2 und c-10' });
  });
  it('Ablage: nur Personen-Bezug → weg; mit Firma → nur der Personen-Bezug fällt', () => {
    const e = (id: string, x: Partial<DateiEintrag>) => ({ id, art: 'vertrag', hochgeladenAm: 'x', hochgeladenVon: 'kevin', ...x }) as DateiEintrag;
    const r = pb.ablageOhne([e('d-aaaa1', { kontaktId: 'c-1' }), e('d-aaaa2', { kontaktId: 'c-1', firmaId: 'f-1' }), e('d-aaaa3', { kontaktId: 'c-2' })], 'c-1');
    expect(r.weg.map(x => x.id)).toEqual(['d-aaaa1']);
    expect(r.eintraege.find(x => x.id === 'd-aaaa2')).not.toHaveProperty('kontaktId');
    expect(r.geloest).toBe(1);
    expect(pb.ablageUm(r.eintraege, 'c-2', 'c-3').eintraege.find(x => x.id === 'd-aaaa3')?.kontaktId).toBe('c-3');
  });
  it('Import-Konflikte umbiegen: ohne Doppelte, das zusammengeführte Paar fällt weg', () => {
    const st: KonfliktStand = { konflikte: [{ kontaktId: 'c-a', feld: 'notiz', online: 1, liste: 2 }, { kontaktId: 'c-b', feld: 'notiz', online: 3, liste: 4 }, { kontaktId: 'c-b', feld: 'firma', online: 5, liste: 6 }], moeglicheDubletten: [{ kontaktId: 'c-a', mitId: 'c-b', grund: 'Name' }], ohneBesitzer: 0, stand: '', quelle: '' };
    const r = pb.konflikteUm(st, 'c-b', 'c-a').stand;
    expect(r.konflikte).toEqual([{ kontaktId: 'c-a', feld: 'notiz', online: 1, liste: 2 }, { kontaktId: 'c-a', feld: 'firma', online: 5, liste: 6 }]);
    expect(r.moeglicheDubletten).toEqual([]);
    expect(pb.konflikteOhne(st, 'c-b').stand.konflikte).toHaveLength(1);
  });
  it('Aufgaben: eindeutig nur über hd-Vorschlag oder Link; Name allein wird nur gemeldet', () => {
    const tasks = [
      { id: 'hd-hs-1', title: 'Testa Beispielmann anrufen', description: 'Vorschlag' },
      { id: 't-link', title: 'Von Kevin: Übergabe', description: 'Bitte übernehmen\n\n/os/markttraktion?s=kontakte&a=akte&k=c-weg' },
      { id: 't-name', title: 'Testa Beispielmann Geburtstag', description: '' },
      { id: 't-anders', title: 'Link auf c-weg-2', description: '/os/markttraktion?k=c-weg-2' },
    ];
    const r = pb.aufgabenAnonymisieren(tasks, 'c-weg', ['hd-hs-1'], 'Testa Beispielmann');
    expect(r.n).toBe(2);
    expect(r.tasks[0].title).toBe('[gelöscht] anrufen');
    expect(r.tasks[1].description).not.toContain('c-weg');
    expect(r.tasks[2]).toEqual(tasks[2]);
    expect(r.tasks[3]).toEqual(tasks[3]);
    expect(r.pruefen).toEqual(['t-name']);
    expect(pb.aufgabenUm(tasks, 'c-weg', 'c-neu').tasks[1].description).toContain('k=c-neu');
  });
});

describe('Art. 15 und Art. 17 über alle Speicher', () => {
  let nurPerson: DateiEintrag, mitFirma: DateiEintrag;
  beforeAll(async () => {
    await db.saveJson('kontakte', { kontakte: [k('c-weg', 'Testa', 'Beispielmann', { email: 'testa@example.invalid' }), k('c-bleibt', 'Testo', 'Musterfrau')] });
    await db.saveJson('crm', crmMit('c-weg', 'c-bleibt'));
    nurPerson = await hochladen({ art: 'vertrag', titel: 'NDA Person', kontaktId: 'c-weg' }, 'GEHEIMER-INHALT-NDA');
    mitFirma = await hochladen({ art: 'vertrag', titel: 'Rahmen Firma', kontaktId: 'c-weg', firmaId: 'f-probe' });
    await db.saveJson<KonfliktStand>('crm-import-konflikte', { konflikte: [{ kontaktId: 'c-weg', feld: 'notiz', online: 'a', liste: 'b' }, { kontaktId: 'c-bleibt', feld: 'notiz', online: 'c', liste: 'd' }], moeglicheDubletten: [{ kontaktId: 'c-weg', mitId: 'c-bleibt', grund: 'Telefon' }], ohneBesitzer: 0, stand: 'x', quelle: 'x' });
    const v = (id: string, kontakt: string | null, titel: string) => ({ id, art: 'nachfassen', titel, begruendung: 'b', kontakt_id: kontakt, chance_id: null, mandat_id: null, event_id: null, frist: null, prioritaet: 'mittel', dedup_schluessel: id, quelle: [], entwurf: null, status: 'offen', erstellt: 'x', aktualisiert: 'x', berichtId: 'hb-1' });
    await db.saveJson<HeadStand>('head-sales', { berichte: [
      { id: 'hb-1', zeit: 'x', modus: 'power_hour', ausgeloest: 'hand', antwort: { status: 'handeln', zusammenfassung: 'Heute Testa Beispielmann anrufen.', befunde: [], vorschlaege: [v('hs-1', 'c-weg', 'Anrufen') as never], fragen: [], datenluecken: [], antwort: '' }, pruefung: { gestrichen: [], unbelegt: [], verstoesse: [], geprueft: 1, korrigiert: false }, modell: 'regelwerk', dauer_ms: 1 },
      { id: 'hb-2', zeit: 'x', modus: 'power_hour', ausgeloest: 'hand', antwort: { status: 'handeln', zusammenfassung: 'Ruhig.', befunde: [], vorschlaege: [v('hs-2', 'c-bleibt', 'Mail') as never], fragen: [], datenluecken: [], antwort: '' }, pruefung: { gestrichen: [], unbelegt: [], verstoesse: [], geprueft: 1, korrigiert: false }, modell: 'regelwerk', dauer_ms: 1 },
    ], vorschlaege: [v('hs-1', 'c-weg', 'Anrufen') as never, v('hs-2', 'c-bleibt', 'Mail') as never], letzte: {}, versuche: {} });
    await db.saveJson('heads-replay-sales', { faelle: [{ zeit: 'x', modus: 'm', person: 'kevin', heute: 'x', quelle: 'regelwerk', modell: 'x', daten: { karten: [{ id: 'c-weg' }] }, roh: {} }, { zeit: 'y', modus: 'm', person: 'kevin', heute: 'y', quelle: 'regelwerk', modell: 'y', daten: { karten: [{ id: 'c-bleibt' }] }, roh: {} }] });
    await db.saveJson('crm-signale', { letzter: 'x', kommend: { 'c-weg': { titel: 'Termin', start: '2026-10-01' }, 'c-bleibt': { titel: 'T2', start: '2026-10-02' } } });
    await db.saveJson('tasks', { projects: [], tasks: [
      { id: 'hd-hs-1', title: 'Testa Beispielmann anrufen', description: 'Vorschlag des Head of Sales', status: 'todo' },
      { id: 't-name', title: 'Testa Beispielmann: Geburtstag', status: 'todo' },
      { id: 't-frei', title: 'Steuer', status: 'todo' },
    ] });
  });

  it('Auskunft listet Dateiablage (nur Metadaten) und Import-Konflikte', async () => {
    const r = await datenschutz.GET!(new Request('http://test/api/crm/datenschutz?id=c-weg', { headers: kopf() }));
    expect(r.status).toBe(200);
    const text = await r.text();
    const a = JSON.parse(text);
    expect(a.dateien.map((d: { id: string }) => d.id).sort()).toEqual([nurPerson.id, mitFirma.id].sort());
    expect(a.dateien[0].datei).toMatchObject({ name: 'vertrag.pdf', typ: 'application/pdf' });
    expect(text).not.toContain('GEHEIMER-INHALT-NDA');
    expect(a.importKonflikte).toEqual({ konflikte: [{ feld: 'notiz', online: 'a', liste: 'b' }], moeglicheDubletten: 1 });
    expect(a.headVorschlaege).toHaveLength(1);
    expect(a.kommenderTermin).toMatchObject({ titel: 'Termin' });
    expect(a.aufgaben.map((t: { id: string }) => t.id)).toEqual(['hd-hs-1']);
    expect(a.chancen).toHaveLength(1);
  });

  it('Löschen: die Kennung steht in KEINEM Speicher mehr, Dateien sind physisch weg', async () => {
    const binNurPerson = path.join(ordner, 'dateien', HAUS, `${nurPerson.id}.bin`);
    expect(existsSync(binNurPerson)).toBe(true);
    const r = await datenschutz.POST!(json('/api/crm/datenschutz', { id: 'c-weg', grund: 'Test' }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.aufgabenPruefen).toEqual(['t-name']);
    expect(Object.keys(d.speicher)).toEqual(expect.arrayContaining(['kontakte', 'crm', `crm-dateien--${HAUS}`, 'crm-import-konflikte', 'head-sales', 'heads-replay-sales', 'crm-signale', 'tasks']));

    expect(await alles()).not.toMatch(/c-weg(?![A-Za-z0-9_-])/);
    expect(existsSync(binNurPerson)).toBe(false);
    expect(existsSync(path.join(ordner, 'dateien', HAUS, `${mitFirma.id}.bin`))).toBe(true);
    const l = await ablage();
    expect(l.map(e => e.id)).toEqual([mitFirma.id]);
    expect(l[0].firmaId).toBe('f-probe');

    const head = (await db.loadJson<HeadStand>('head-sales'))!;
    expect(head.vorschlaege.map(v => v.id)).toEqual(['hs-2']);
    expect(head.berichte.map(b => b.id)).toEqual(['hb-2']); // nannte die Person im Freitext
    const tasks = (await db.loadJson<{ tasks: { id: string; title: string }[] }>('tasks'))!.tasks;
    expect(tasks.find(t => t.id === 'hd-hs-1')?.title).toBe('[gelöscht] anrufen');
    expect(tasks.find(t => t.id === 't-name')?.title).toBe('Testa Beispielmann: Geburtstag'); // nur Name: gemeldet, nicht geändert
    // Die andere Person bleibt überall.
    expect((await db.loadJson<KonfliktStand>('crm-import-konflikte'))!.konflikte).toHaveLength(1);
    expect((await db.loadJson<{ kommend: Record<string, unknown> }>('crm-signale'))!.kommend).toHaveProperty('c-bleibt');
    // Ins Protokoll nur Kennung, Datum, Grund.
    const prot = (await db.loadJson<{ eintraege: Record<string, unknown>[] }>('crm-loeschprotokoll'))!.eintraege;
    expect(Object.keys(prot[0]).sort()).toEqual(['datum', 'grund', 'id', 'von']);
  });

  it('idempotent: ein zweiter Lauf ändert nichts mehr (404, kein zweiter Protokolleintrag)', async () => {
    const vorher = await alles();
    expect((await datenschutz.POST!(json('/api/crm/datenschutz', { id: 'c-weg' }))).status).toBe(404);
    expect(await alles()).toBe(vorher);
    expect((await db.loadJson<{ eintraege: unknown[] }>('crm-loeschprotokoll'))!.eintraege).toHaveLength(1);
  });

  it('PATCH /api/state/kontakte op:delete räumt ebenfalls alle Speicher', async () => {
    await db.saveJson('kontakte', { kontakte: [k('c-zwei', 'Tessa', 'Probefrau'), k('c-bleibt', 'Testo', 'Musterfrau')] });
    await db.saveJson('crm', crmMit('c-zwei', 'c-bleibt'));
    await db.saveJson('crm-signale', { kommend: { 'c-zwei': { titel: 'T', start: '2026-10-01' } } });
    const e = await hochladen({ art: 'sonstig', kontaktId: 'c-zwei' });
    const r = await kontakteRoute.PATCH!(json('/api/state/kontakte', { ops: [{ op: 'delete', id: 'c-zwei' }] }, 'PATCH'));
    expect(r.status).toBe(200);
    expect(await alles()).not.toContain('c-zwei');
    expect(existsSync(path.join(ordner, 'dateien', HAUS, `${e.id}.bin`))).toBe(false);
  });
});

describe('Dubletten zusammenführen', () => {
  it('private Notiz nur paarweise, Verlauf ohne Doppelte, Verweise überall umgebogen, Teilnahmen zusammengelegt', async () => {
    const gemeinsam = { am: '2026-09-01T10:00:00Z', art: 'mail' as const, von: 'kevin', text: 'Gleiche Mail' };
    const a = k('c-a', 'Tim', 'Probemann', { firma: 'Probe AG', privatNotiz: 'nur Kevin', privatNotizVon: 'kevin', aktivitaeten: [gemeinsam], vonHand: ['notiz'], netzwerk: { kevin: { status: 'angefragt', angefragtAm: '2026-09-01' } } as Kontakt['netzwerk'] });
    const b = k('c-b', 'Tim', 'Probemann', { firma: 'Probe AG', email: 'tim@example.invalid', privatNotiz: 'nur Malin', privatNotizVon: 'malin', aktivitaeten: [gemeinsam, { am: '2026-09-05T10:00:00Z', art: 'anruf', von: 'malin', text: 'Anruf' }], vonHand: ['firma'], phase: 'mql' as Kontakt['phase'], netzwerk: { malin: { status: 'vernetzt', vernetztAm: '2026-09-02' } } as Kontakt['netzwerk'] });
    await db.saveJson('kontakte', { kontakte: [a, b] });
    await db.saveJson('crm', crmMit('c-b', 'c-a'));
    const d1 = await hochladen({ art: 'vertrag', kontaktId: 'c-b' });
    await db.saveJson<KonfliktStand>('crm-import-konflikte', { konflikte: [{ kontaktId: 'c-b', feld: 'firma', online: 'x', liste: 'y' }], moeglicheDubletten: [{ kontaktId: 'c-a', mitId: 'c-b', grund: 'Name' }], ohneBesitzer: 0, stand: 'x', quelle: 'x' });

    const r = await dubletten.POST!(json('/api/crm/dubletten', { behalten: 'c-a', weg: 'c-b' }));
    expect(r.status).toBe(200);
    const kontakte = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(kontakte.map(x => x.id)).toEqual(['c-a']);
    const m = kontakte[0];
    expect([m.privatNotiz, m.privatNotizVon]).toEqual(['nur Kevin', 'kevin']);
    expect(m.aktivitaeten.filter(x => x.text === 'Gleiche Mail')).toHaveLength(1);
    expect(m.aktivitaeten.some(x => x.text === 'Anruf')).toBe(true);
    expect(m.vonHand?.sort()).toEqual(['firma', 'notiz']);
    expect(Object.keys(m.netzwerk ?? {}).sort()).toEqual(['kevin', 'malin']);
    expect(m.phase).toBe('mql');

    expect(await alles()).not.toMatch(/c-b(?![A-Za-z0-9_-])/);
    const crm = (await db.loadJson<CrmBestand>('crm'))!;
    expect(crm.teilnahmen).toHaveLength(1);
    expect(crm.teilnahmen[0]).toMatchObject({ id: 't2', kontaktId: 'c-a', status: 'da', notiz: 'kam spät' }); // jüngere Auskunft gewinnt, Lücken gefüllt
    expect((await ablage()).find(e => e.id === d1.id)?.kontaktId).toBe('c-a');
    const st = (await db.loadJson<KonfliktStand>('crm-import-konflikte'))!;
    expect(st.konflikte).toEqual([{ kontaktId: 'c-a', feld: 'firma', online: 'x', liste: 'y' }]);
    expect(st.moeglicheDubletten).toEqual([]);
  });

  it('nur b hat eine private Notiz → b\'s Paar; a hat eine ohne Verfasser → a\'s Paar bleibt ohne fremden Verfasser', async () => {
    const { zusammenfuehren } = await import('@/lib/crm/dubletten');
    const nurB = zusammenfuehren(k('c-1', 'A', 'Bcde'), k('c-2', 'A', 'Bcde', { privatNotiz: 'Malins', privatNotizVon: 'malin' }), 'kevin', '2026-09-28T10:00:00Z');
    expect([nurB.privatNotiz, nurB.privatNotizVon]).toEqual(['Malins', 'malin']);
    const altA = zusammenfuehren(k('c-1', 'A', 'Bcde', { privatNotiz: 'Kevins alt' }), k('c-2', 'A', 'Bcde', { privatNotiz: 'Malins', privatNotizVon: 'malin' }), 'kevin', '2026-09-28T10:00:00Z');
    expect(altA.privatNotiz).toBe('Kevins alt');
    expect(altA.privatNotizVon).toBeUndefined();
  });

  it('Import-Konflikt einer nicht mehr existierenden Kennung wird entfernt statt 404', async () => {
    await db.saveJson<KonfliktStand>('crm-import-konflikte', { konflikte: [{ kontaktId: 'c-gibtsnicht', feld: 'notiz', online: 'x', liste: 'y' }], moeglicheDubletten: [], ohneBesitzer: 0, stand: 'x', quelle: 'x' });
    const r = await importRoute.POST!(json('/api/crm/import', { aktion: 'konflikt', kontaktId: 'c-gibtsnicht', feld: 'notiz', wahl: 'online' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, offen: 0, entfernt: true });
  });
});

describe('Archiv-Kopien verschlüsselt', () => {
  it('mit Datenschlüssel liegt im Archiv kein Klartext; Lesen entschlüsselt', async () => {
    await db.saveJson('kontakte', { kontakte: [k('c-archiv', 'Klartextine', 'Archivmarke', { email: 'archivmarke@example.invalid' })] });
    const r = await umzug.POST!(json('/api/crm/umzug', { daten: { kunden: [], mandate: [], leistungen: [] } }));
    expect(r.status).toBe(200);
    const { archiv } = await r.json();
    const roh = readFileSync(path.join(ordner, 'archiv', archiv), 'utf8');
    expect(roh).toContain('__verschluesselt');
    expect(roh).not.toContain('Archivmarke');
    const { archivLesen } = await import('@/lib/store/archiv');
    const inhalt = await archivLesen<{ kontakte: { kontakte: Kontakt[] } }>(archiv);
    expect(inhalt.kontakte.kontakte.some(x => x.nachname === 'Archivmarke')).toBe(true);
  });
  it('ohne Schlüssel Klartext (lokale Entwicklung), unzulässige Namen werden abgelehnt', async () => {
    const alt = process.env.MAKE_OS_DATEN_SCHLUESSEL;
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
    try {
      const { archivSchreiben } = await import('@/lib/store/archiv');
      const n = await archivSchreiben('probe-klartext.json', { a: 1 });
      expect(readFileSync(path.join(ordner, 'archiv', n), 'utf8')).toBe('{"a":1}');
      await expect(archivSchreiben('../ausbruch.json', {})).rejects.toThrow();
    } finally { process.env.MAKE_OS_DATEN_SCHLUESSEL = alt; }
  });
});

describe('Dubletten: private Notizen verschiedener Personen (Kevin 28.09.)', () => {
  it('wird erkannt — dann kein Zusammenführen', async () => {
    const { privatNotizKonflikt } = await import('@/lib/crm/dubletten');
    expect(privatNotizKonflikt({ privatNotiz: 'a', privatNotizVon: 'kevin' }, { privatNotiz: 'b', privatNotizVon: 'malin' })).toBe(true);
    expect(privatNotizKonflikt({ privatNotiz: 'a', privatNotizVon: 'kevin' }, { privatNotiz: 'b', privatNotizVon: 'kevin' })).toBe(false);
    expect(privatNotizKonflikt({ privatNotiz: 'a' }, { privatNotiz: 'b', privatNotizVon: 'malin' })).toBe(true);
    expect(privatNotizKonflikt({}, { privatNotiz: 'b', privatNotizVon: 'malin' })).toBe(false);
  });
});

