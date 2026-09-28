// ─── Paket D-B (29.09.): Art. 17/15 über ALLE Speicher, Grabsteine nach Restore, HMAC-Pepper, Löschklassen, Art. 18 zentral ─
// Eigener Datenordner (im Test liegen die Grabsteine in <daten>/.grabsteine-test), Dienstschlüssel + Person, gesetzter Daten-Schlüssel und Pepper.
// Alle Namen, Adressen und Kennungen erfunden — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-db-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_GRABSTEINE_DIR;
process.env.MAKE_OS_KEY = 'pruef-schluessel-d-b';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-d-b-nur-im-test';
const PEPPER = 'pruef-pepper-d-b-nur-im-test-0123456789abcdef';
process.env.MAKE_OS_PEPPER = PEPPER;

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');
let datenschutz: Route;
const HAUS = 'test-haus';
const kopf = (extra: Record<string, string> = {}) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin', 'content-type': 'application/json', ...extra });
const post = (body: unknown, h?: Record<string, string>) => new Request('http://test/api/crm/datenschutz', { method: 'POST', headers: h ?? kopf(), body: JSON.stringify(body) });

const ID = 'c-testa-weg-example-invalid';
const MAIL = 'testa.weg@example.invalid';
const NAME = 'Testa Wegmann';
const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x } as Kontakt);

/** Alle Bestände (entschlüsselt) und das Archiv als ein Text. */
async function alles(ohne: string[] = []): Promise<string> {
  const namen = readdirSync(ordner).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).filter(n => !ohne.includes(n));
  const teile = await Promise.all(namen.map(async n => `${n}:${JSON.stringify(await db.loadJson(n))}`));
  const { archivLesen } = await import('@/lib/store/archiv');
  const archiv = existsSync(path.join(ordner, 'archiv')) ? await Promise.all(readdirSync(path.join(ordner, 'archiv')).map(async d => `archiv/${d}:${JSON.stringify(await archivLesen(d))}`)) : [];
  return [...teile, ...archiv].join('\n');
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  datenschutz = (await import('@/app/api/crm/datenschutz/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Pepper und HMAC (#71/#68)', () => {
  it('ohne Pepper v1, mit Pepper v2 — geprüft wird gegen beide', async () => {
    const pep = await import('@/lib/datenschutz/pepper');
    const sp = await import('@/lib/crm/sperrliste');
    const ap = await import('@/lib/store/aenderungsprotokoll');
    const person = { email: MAIL, vorname: 'Testa', nachname: 'Wegmann' };
    delete process.env.MAKE_OS_PEPPER;
    expect(pep.pepperGesetzt()).toBe(false);
    const v1 = sp.sperrHashes(person);
    expect(ap.protokollKennung(ID)).toMatch(/^c#[0-9a-f]{12}$/);
    const altListe = sp.sperrlisteMit([], person, 'loeschung', '2026-09-01').eintraege;
    process.env.MAKE_OS_PEPPER = 'zu-kurz';
    expect(pep.pepperGesetzt()).toBe(false); // < 32 Zeichen gilt nicht
    process.env.MAKE_OS_PEPPER = PEPPER;
    expect(pep.pepperGesetzt()).toBe(true);
    const v2 = sp.sperrHashes(person);
    expect(v2).not.toEqual(v1);
    expect(ap.protokollKennung(ID)).toMatch(/^c2#[0-9a-f]{16}$/);
    expect(ap.protokollKennungen(ID)).toEqual([ap.protokollKennung(ID), ap.protokollKennungV1(ID)]);
    // v1-Eintrag einer (gelöschten) Person wird weiter erkannt
    expect(sp.sperrPruefer(altListe)(person)).toBe(true);
    // Umrechnung, solange die Person existiert: v1 → v2, danach erkennt v2 sie
    const um = sp.sperrlisteUmrechnen(altListe, [person]);
    expect(um.umgerechnet).toBe(1);
    expect(um.eintraege[0].h.sort()).toEqual([...v2].sort());
    expect(sp.sperrPruefer(um.eintraege)(person)).toBe(true);
    // gelöschte (nicht mehr in der Kartei) bleiben v1
    expect(sp.sperrlisteUmrechnen(altListe, []).umgerechnet).toBe(0);
  });
  it('Pepper aus Datei (MAKE_OS_PEPPER_DATEI), Umgebung gewinnt', async () => {
    const pep = await import('@/lib/datenschutz/pepper');
    const { writeFileSync } = await import('node:fs');
    const datei = path.join(ordner, '..', `${path.basename(ordner)}-pepper.txt`);
    writeFileSync(datei, `${'d'.repeat(40)}\n`);
    delete process.env.MAKE_OS_PEPPER;
    process.env.MAKE_OS_PEPPER_DATEI = datei;
    pep.pepperVergessen();
    expect(pep.pepperQuelle()).toBe('datei');
    process.env.MAKE_OS_PEPPER = PEPPER;
    expect(pep.pepperQuelle()).toBe('umgebung');
    delete process.env.MAKE_OS_PEPPER_DATEI;
    rmSync(datei, { force: true });
  });
});

describe('Art. 17 über alle weiteren Speicher (#69/#30/#93)', () => {
  let fp: string[] = [];
  beforeAll(async () => {
    const ap = await import('@/lib/store/aenderungsprotokoll');
    fp = ap.protokollKennungen(ID);
    await db.saveJson('kontakte', { kontakte: [k(ID, 'Testa', 'Wegmann', { email: MAIL }), k('c-bleibt', 'Testo', 'Bleiber', { email: 'bleibt@example.invalid' })] });
    await db.saveJson('netzwerk', { kontakte: [{ id: 'k-1', name: NAME, email: MAIL, naehe: 'warm' }, { id: 'k-2', name: 'Testo Bleiber', naehe: 'kalt', notizen: `kennt ${NAME}` }], chancen: [{ id: 'nc-1', kontaktId: 'k-1', titel: 'Beratung', stufe: 'kontakt' }] });
    await db.saveJson('kunden', { kunden: [{ id: 'ku-1', name: NAME, status: 'aktiv' }, { id: 'ku-2', name: 'Firma GmbH', status: 'aktiv', notizen: `Ansprechpartnerin ${NAME}` }] });
    await db.saveJson('inbox-absender', { bekannt: { [MAIL]: { status: 'durchgelassen', seit: '2026-09-01' }, 'x@example.invalid': { status: 'geblockt', seit: '2026-09-01' } } });
    await db.saveJson('inbox-triage', { fp1: { stufe: 'wichtig', zeile: `Mail von ${NAME}`, grund: 'x', at: '2026-09-28T10:00:00Z' }, fp2: { stufe: 'rauschen', zeile: 'Newsletter', grund: 'x', at: '2026-09-28T10:00:00Z' } });
    await db.saveJson('m365-postfach', { stand: '2026-09-28T10:00:00Z', mails: [{ id: 'm1', subject: 'Hallo', senderEmail: MAIL, receivedAt: '2026-09-28T09:00:00Z', isRead: false }, { id: 'm2', subject: 'Rechnung', senderEmail: 'x@example.invalid', receivedAt: '2026-09-28T09:00:00Z', isRead: true }] });
    await db.saveJson('microsoft-inbox', { emails: [{ id: 'm1', senderEmail: MAIL, subject: 'Hallo', receivedAt: '2026-09-28T09:00:00Z' }], at: '2026-09-28T10:00:00Z' });
    await db.saveJson('apple-mail-cache', { daten: [{ id: 'a1', sender: `${NAME} <${MAIL}>`, subject: 'Termin', receivedAt: '2026-09-28T09:00:00Z' }] });
    await db.saveJson('calendar-cache', { events: [{ id: 'e1', title: `Kaffee mit ${NAME}`, startDate: '2026-09-30T10:00:00' }, { id: 'e2', title: 'Zahnarzt', startDate: '2026-09-30T12:00:00' }] });
    await db.saveJson('meetings', { meetings: [{ id: 'mt1', datum: '2026-09-20', titel: 'Kennenlernen', notizen: `${NAME} will ein Angebot` }] });
    await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g1', begonnen: '2026-09-28T10:00:00Z', zuletzt: '2026-09-28T10:01:00Z', titel: 'CRM', nachrichten: [{ rolle: 'kevin', text: `Notiere für ${NAME}: Anruf`, zeit: '2026-09-28T10:00:00Z' }] }] });
    await db.saveJson('zoe-gedaechtnis', { fakten: [{ id: 'f1', zeit: '2026-09-28T10:00:00Z', tag: '2026-09-28', art: 'person', thema: NAME, satz: 'mag Tee', raum: 'kevin' }, { id: 'f2', zeit: '2026-09-28T10:00:00Z', tag: '2026-09-28', art: 'vorliebe', thema: 'Kevin', satz: 'mag Kaffee', raum: 'kevin' }] });
    await db.saveJson('zoe-protokoll', { eintraege: [{ id: 'p-1', zeit: '2026-09-28T10:00:00Z', tag: '2026-09-28', werkzeug: 'notiere_kontakt', gruppe: 'kontakte', risiko: 'freigabe', eingabe: { kontakt_id: fp[0] }, ergebnis: `Notiert: ${NAME}`, ok: true, quelle: 'stapel', dauerhaft: true }, { id: 'p-2', zeit: '2026-09-28T10:00:00Z', tag: '2026-09-28', werkzeug: 'plan_block', gruppe: 'planer', risiko: 'frei', eingabe: {}, ergebnis: 'ok', ok: true, quelle: 'zoe', dauerhaft: true }] });
    await db.saveJson('zoe-stapel', { vorschlaege: [{ id: 'v-abcd-1', zeit: '2026-09-28T10:00:00Z', tag: '2026-09-28', werkzeug: 'notiere_kontakt', gruppe: 'kontakte', titel: 'Aktivität am Kontakt notieren', nachher: NAME, eingabe: { kontakt: ID, text: 'Anruf' }, status: 'offen' }] });
    await db.saveJson(`zoe-entscheidungen--${HAUS}--2026-09`, { eintraege: [{ at: '2026-09-28T10:00:00Z', typ: 'entscheidung', quelleId: 'v-x', werkzeug: 'crm_vorschlag', gruppe: 'crm', entscheidung: 'freigegeben', bezug: { art: 'crm', id: `aktivitaet:${fp[0]}` }, titel: `Aktivität: anruf · ${NAME}`, person: 'kevin' }] });
    await db.saveJson(`aenderungsprotokoll--${HAUS}--2026-09`, { eintraege: [{ at: '2026-09-28T10:00:00Z', wer: 'person', person: 'kevin', bestand: 'kontakte', op: 'geaendert', id: fp[0], felder: ['notiz'] }, { at: '2026-09-28T10:00:00Z', wer: 'person', person: 'kevin', bestand: 'kontakte', op: 'geaendert', id: fp[1], felder: ['stufe'] }] });
    await db.saveJson('agent-log', { entries: [{ ts: '2026-09-28T10:00:00Z', agent: 'crm', title: `Heute: ${NAME} anrufen` }] });
    const { archivSchreiben } = await import('@/lib/store/archiv');
    await archivSchreiben('crm-vor-brain-umzug-2026-09-25T10-00-00-000Z.json', { crm: {}, kontakte: { kontakte: [k(ID, 'Testa', 'Wegmann', { email: MAIL }), k('c-bleibt', 'Testo', 'Bleiber')] } });
  });

  it('Auskunft (Art. 15) nennt ZOE-Protokoll, -Stapel, Änderungsprotokoll und die weiteren Speicher — ohne Inhalte', async () => {
    const r = await datenschutz.GET!(new Request(`http://test/api/crm/datenschutz?id=${ID}`, { headers: kopf() }));
    expect(r.status).toBe(200);
    const a = await r.json();
    expect(a.zoeProtokoll).toEqual([{ zeit: '2026-09-28T10:00:00Z', werkzeug: 'notiere_kontakt', ok: true, quelle: 'stapel' }]);
    expect(a.zoeStapel).toHaveLength(1);
    expect(a.aenderungsprotokoll).toHaveLength(2);
    expect(a.aenderungsprotokoll[0]).not.toHaveProperty('id');
    expect(Object.keys(a.weitereSpeicher)).toEqual(expect.arrayContaining(['netzwerk', 'kunden', 'm365-postfach', 'calendar-cache', 'zoe-verlauf', 'zoe-gedaechtnis', `aenderungsprotokoll--${HAUS}--2026-09`]));
  });

  it('Löschen: Kennung, Adresse, Name und Fingerabdrücke stehen in KEINEM Speicher mehr — Protokoll nur mit lp-ID, Grabstein neben den Daten', async () => {
    const r = await datenschutz.POST!(post({ id: ID, grund: 'Test' }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.protokollId).toMatch(/^lp-/);
    expect(d.warnung).toBeUndefined();
    expect(Object.keys(d.speicher)).toEqual(expect.arrayContaining(['kontakte', 'netzwerk', 'kunden', 'inbox-absender', 'inbox-triage', 'm365-postfach', 'microsoft-inbox', 'apple-mail-cache', 'calendar-cache', 'meetings', 'zoe-verlauf', 'zoe-gedaechtnis', 'zoe-protokoll', 'zoe-stapel', `zoe-entscheidungen--${HAUS}--2026-09`, `aenderungsprotokoll--${HAUS}--2026-09`, 'agent-log']));
    const text = await alles(['konten']);
    for (const x of [ID, MAIL, NAME, ...fp]) expect(text, x).not.toContain(x);
    // Andere bleiben
    expect(text).toContain('Testo Bleiber');
    expect(text).toContain('Zahnarzt');
    expect(text).toContain('mag Kaffee');
    // Termin bleibt, Name getilgt; Entscheidung bleibt (Rechenschaft), Fingerabdruck → c#geloescht
    const kal = (await db.loadJson<{ events: { title: string }[] }>('calendar-cache'))!.events;
    expect(kal.map(e => e.title)).toEqual(['Kaffee mit [gelöscht]', 'Zahnarzt']);
    const ent = (await db.loadJson<{ eintraege: { bezug: { id: string } }[] }>(`zoe-entscheidungen--${HAUS}--2026-09`))!.eintraege;
    expect(ent[0].bezug.id).toBe('aktivitaet:c#geloescht');
    // Löschprotokoll: nur lp-ID, Tag, Grund, wer
    const prot = (await db.loadJson<{ eintraege: Record<string, string>[] }>('crm-loeschprotokoll'))!.eintraege;
    expect(prot).toHaveLength(1);
    expect(Object.keys(prot[0]).sort()).toEqual(['datum', 'grund', 'id', 'von']);
    expect(prot[0].id).toMatch(/^lp-/);
    // Grabstein außerhalb des Datenordners — nur Fingerabdrücke
    const g = readFileSync(path.join(ordner, '.grabsteine-test', 'grabsteine.json'), 'utf8');
    expect(JSON.parse(g).eintraege).toHaveLength(1);
    for (const x of [ID, MAIL, 'Testa', 'Wegmann']) expect(g).not.toContain(x);
  });

  it('Restore holt die Person nicht zurück: die Grabsteine entfernen sie erneut, auch die Sperrliste kommt wieder', async () => {
    // „Restore“ eines alten Stands: Kartei mit der Person, Sperrliste und Grabstein-Marke leer
    await db.saveJson('kontakte', { kontakte: [k(ID, 'Testa', 'Wegmann', { email: MAIL }), k('c-bleibt', 'Testo', 'Bleiber')] });
    await db.saveJson(`crm-sperrliste--${HAUS}`, { eintraege: [] });
    await db.saveJson('datenschutz-grabsteine', {});
    await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g2', begonnen: '2026-09-27T10:00:00Z', zuletzt: '2026-09-27T10:00:00Z', titel: 'alt', nachrichten: [{ rolle: 'kevin', text: `Mail an ${MAIL}`, zeit: '2026-09-27T10:00:00Z' }] }] });
    const gs = await import('@/lib/datenschutz/grabsteine');
    expect(await gs.grabsteineOffen()).toBe(true);
    // Dienstweg OHNE Person (Restore-Skript)
    const r = await datenschutz.POST!(post({ aktion: 'grabsteine' }, { 'x-make-key': process.env.MAKE_OS_KEY!, 'content-type': 'application/json' }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d).toMatchObject({ ok: true, entfernt: 1, grabsteine: 1 });
    const text = await alles(['konten']);
    for (const x of [ID, MAIL]) expect(text).not.toContain(x);
    const sp = await import('@/lib/crm/sperrliste');
    expect(sp.sperrPruefer(await sp.sperrlisteLaden())({ email: MAIL })).toBe(true);
    expect(await gs.grabsteineOffen()).toBe(false);
    // Nochmal: nichts mehr zu tun
    expect((await gs.grabsteineAnwenden()).uebersprungen).toBe(true);
    // Das erneute Anwenden schreibt KEIN zweites Löschprotokoll
    expect((await db.loadJson<{ eintraege: unknown[] }>('crm-loeschprotokoll'))!.eintraege).toHaveLength(1);
  });

  it('auch das Löschen über die Kartei (PATCH op:delete) setzt einen Grabstein', async () => {
    const vorher = JSON.parse(readFileSync(path.join(ordner, '.grabsteine-test', 'grabsteine.json'), 'utf8')).eintraege.length;
    await db.saveJson('kontakte', { kontakte: [k('c-kartei-weg', 'Karla', 'Weggeklickt', { email: 'karla@example.invalid' }), k('c-bleibt', 'Testo', 'Bleiber')] });
    const route = (await import('@/app/api/state/kontakte/route')) as unknown as { PATCH: (r: Request) => Promise<Response> };
    const r = await route.PATCH(new Request('http://test/api/state/kontakte', { method: 'PATCH', headers: kopf(), body: JSON.stringify({ ops: [{ op: 'delete', id: 'c-kartei-weg' }] }) }));
    expect(r.status).toBe(200);
    const nachher = JSON.parse(readFileSync(path.join(ordner, '.grabsteine-test', 'grabsteine.json'), 'utf8')).eintraege.length;
    expect(nachher).toBe(vorher + 1);
  });

  it('Löschprotokoll-Altbestand mit Klartext-Kennung wird umgeschrieben', async () => {
    await db.saveJson('crm-loeschprotokoll', { eintraege: [{ id: 'c-alt-klartext-example-invalid', datum: '2026-09-01', grund: 'x', von: 'kevin' }] });
    const { loeschprotokollBereinigen } = await import('@/lib/crm/loeschprotokoll');
    expect(await loeschprotokollBereinigen()).toBe(1);
    const e = (await db.loadJson<{ eintraege: { id: string; datum: string }[] }>('crm-loeschprotokoll'))!.eintraege;
    expect(e[0].id).toMatch(/^lp-/);
    expect(e[0].datum).toBe('2026-09-01');
  });
});

describe('Löschklassen (#73/#93)', () => {
  it('ZOE-Arbeitslisten, Postfach, Kalender, Umzugs-Kopien — nur Altes, nur Festgehaltenes', async () => {
    await db.saveJson('zoe-protokoll', { eintraege: [
      { id: 'p-alt', zeit: '2026-05-01T10:00:00Z', tag: '2026-05-01', werkzeug: 'plan_block', gruppe: 'planer', risiko: 'frei', eingabe: {}, ergebnis: 'ok', ok: true, quelle: 'zoe', dauerhaft: true },
      { id: 'p-alt-nicht-fest', zeit: '2026-05-01T10:00:00Z', tag: '2026-05-01', werkzeug: 'plan_block', gruppe: 'planer', risiko: 'frei', eingabe: { titel: 'x' }, ergebnis: 'ok', ok: true, quelle: 'zoe' },
      { id: 'p-neu', zeit: '2026-09-28T10:00:00Z', tag: '2026-09-28', werkzeug: 'plan_block', gruppe: 'planer', risiko: 'frei', eingabe: {}, ergebnis: 'ok', ok: true, quelle: 'zoe', dauerhaft: true },
    ] });
    await db.saveJson('zoe-stapel', { vorschlaege: [
      { id: 'v-alt-1', zeit: '2026-05-01T10:00:00Z', tag: '2026-05-01', werkzeug: 'x', gruppe: 'g', titel: 't', nachher: 'n', eingabe: {}, status: 'freigegeben', entschiedenAm: '2026-05-01T11:00:00Z', protokolliert: true },
      { id: 'v-alt-offen', zeit: '2026-05-01T10:00:00Z', tag: '2026-05-01', werkzeug: 'x', gruppe: 'g', titel: 't', nachher: 'n', eingabe: {}, status: 'offen' },
    ] });
    await db.saveJson('m365-postfach', { stand: '2026-09-28T10:00:00Z', mails: [{ id: 'm-alt', subject: 'a', receivedAt: '2026-07-01T09:00:00Z', isRead: true }, { id: 'm-neu', subject: 'b', receivedAt: '2026-09-28T09:00:00Z', isRead: true }] });
    await db.saveJson('calendar-cache', { events: [{ id: 'e-alt', title: 'a', startDate: '2025-01-01T10:00:00' }, { id: 'e-neu', title: 'b', startDate: '2026-09-30T10:00:00' }] });
    const { archivSchreiben } = await import('@/lib/store/archiv');
    await archivSchreiben('kategorien-vor-aufraeumen-test-haus-1756684800000.json', { a: 1 }); // 01.09.2025
    await archivSchreiben('sonstiges-bleibt.json', { a: 1 });
    const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
    const r = await loeschfristenLauf(new Date('2026-09-29T08:00:00.000Z'), true);
    expect(r.ok).toBe(true);
    const prot = (await db.loadJson<{ eintraege: { id: string }[] }>('zoe-protokoll'))!.eintraege.map(e => e.id);
    expect(prot).toEqual(['p-neu']); // nicht Festgehaltenes wurde vorher nachgetragen, dann gekürzt
    const ent = (await db.loadJson<{ eintraege: { quelleId: string; nachgetragen?: boolean }[] }>(`zoe-entscheidungen--${HAUS}--2026-05`))!.eintraege;
    expect(ent.some(e => e.quelleId === 'p-alt-nicht-fest' && e.nachgetragen)).toBe(true);
    expect((await db.loadJson<{ vorschlaege: { id: string }[] }>('zoe-stapel'))!.vorschlaege.map(v => v.id)).toEqual(['v-alt-offen']);
    expect((await db.loadJson<{ mails: { id: string }[] }>('m365-postfach'))!.mails.map(m => m.id)).toEqual(['m-neu']);
    expect((await db.loadJson<{ events: { id: string }[] }>('calendar-cache'))!.events.map(e => e.id)).toEqual(['e-neu']);
    expect(readdirSync(path.join(ordner, 'archiv')).sort()).toEqual(['crm-vor-brain-umzug-2026-09-25T10-00-00-000Z.json', 'sonstiges-bleibt.json']);
    // Pepper-Migration lief einmal und ist vermerkt
    expect((await db.loadJson<{ v2?: { pepper: string } }>('datenschutz-migration'))?.v2?.pepper).toMatch(/^[0-9a-f]{12}$/);
  });
  it('die Tabelle kennt die neuen Klassen; „Sicherungen“ ist fest (14 Tage)', async () => {
    const lf = await import('@/lib/crm/loeschfristen');
    for (const id of ['zoe-arbeitslisten', 'zoe-entscheidungen', 'zoe-verlauf', 'zoe-gedaechtnis', 'postfach-caches', 'kalender-caches', 'archiv-umzug', 'netzwerk', 'grabsteine', 'sicherungen'] as const) expect(lf.LOESCHFRISTEN.some(f => f.id === id)).toBe(true);
    expect(lf.fristenWirksam({})['zoe-arbeitslisten']).toBe(90);
    expect(lf.fristText('sicherungen', 14)).toBe('14 Tage');
    expect(lf.fristText('aktivitaeten-geloeschte', 0)).toBe('sofort');
    expect(lf.fristenSpeichern({}, { sicherungen: 20 }).ok).toBe(false);
    expect(lf.istUmzugsKopie('crm-vor-brain-umzug-x.json')).toBe(true);
    expect(lf.istUmzugsKopie('etwas-anderes.json')).toBe(false);
    expect(lf.archivTag('crm-vor-brain-umzug-2026-09-25T10-00-00-000Z.json')).toBe('2026-09-25');
  });
});

describe('Art. 18 zentral (#72)', () => {
  it('kontakteFuerVerarbeitung lässt eingeschränkte Personen weg (außer ausdrücklich)', async () => {
    await db.saveJson('kontakte', { kontakte: [k('c-frei', 'Frei', 'Person'), k('c-gesperrt', 'Einge', 'Schraenkt', { eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } } as Partial<Kontakt>)] });
    const v = await import('@/lib/crm/verarbeitung');
    expect((await v.kontakteFuerVerarbeitung()).map(x => x.id)).toEqual(['c-frei']);
    expect((await v.kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).map(x => x.id)).toEqual(['c-frei', 'c-gesperrt']);
  });
  it('Export-Route: ohne Schalter fehlt die eingeschränkte Person, mit Schalter markiert', async () => {
    const route = (await import('@/app/api/crm/export/route')) as unknown as Route;
    const ohne = await (await route.GET!(new Request('http://test/api/crm/export?was=kontakte', { headers: kopf() }))).text();
    expect(ohne).not.toContain('c-gesperrt');
    expect(ohne).toContain('c-frei');
    const mit = await (await route.GET!(new Request('http://test/api/crm/export?was=kontakte&mitEingeschraenkten=1', { headers: kopf() }))).text();
    expect(mit).toContain('c-gesperrt');
    expect(mit).toMatch(/seit 2026-09-01/);
  });
});
