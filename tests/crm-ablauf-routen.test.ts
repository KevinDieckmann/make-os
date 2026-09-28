// Ablaufprüfung 28.09. — die Routen: Dubletten mit Vorschau und Rückgängig (W4), Import-Konflikt „Liste“ über den
// Kartei-Weg (W5/b), Import-Rückgängig mit neuen Firmen (W7) und Verknüpfung außerhalb des CRM (c), Aktivität am Deal
// und „Sperre“ (W1/f), Löschen mit Deals ohne Person (W3), Lead-Route Art. 18 + Mandat-Kunde (g/d), Sperrliste bei
// Neuanlage. Eigener Datenordner, Dienstaufruf per Schlüssel — nie der echte Bestand. Alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay } from '@/lib/zeit';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, FollowUp } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ablauf-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-28-09-ablauf';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

// Berliner Tag wie der Server (29.09., Paket D-B) — vorher UTC-Tag: zwischen 0 und 2 Uhr rot.
const H = localDay();
const J = new Date().toISOString();
const kopf = (person: string | null = 'kevin') => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const req = (url: string, body?: unknown, method = 'POST', person: string | null = 'kevin') => new Request(`http://test${url}`, { method, headers: kopf(person), ...(body ? { body: JSON.stringify(body) } : {}) });

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let dub: Route, imp: Route, akt: Route, ds: Route, lead: Route, karteiRoute: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');

const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Testa', nachname: 'Beispielfrau', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: H, geaendertAm: H, ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, letzteAktivitaet: '2026-01-01', ...x,
});
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'kontakt', id: 'c-sperr-1' }, kontaktId: 'c-sperr-1', art: 'mail', text: 'Nachfassen', faellig: H, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: J, geaendert: J, ...x });
const kartei = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const setzeKartei = (k: Kontakt[]) => db.saveJson('kontakte', { kontakte: k });
const setzeCrm = (x: Partial<CrmBestand>) => db.saveJson('crm', { ...speicher.leererBestand(), ...x });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  // Regel 5: der Dienstweg braucht eine Person im Haushalt des Inhabers — erfundene Konten.
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  speicher = await import('@/lib/crm/speicher');
  dub = (await import('@/app/api/crm/dubletten/route')) as unknown as Route;
  imp = (await import('@/app/api/crm/import/route')) as unknown as Route;
  akt = (await import('@/app/api/crm/aktivitaet/route')) as unknown as Route;
  ds = (await import('@/app/api/crm/datenschutz/route')) as unknown as Route;
  lead = (await import('@/app/api/crm/lead/route')) as unknown as Route;
  karteiRoute = (await import('@/app/api/state/kontakte/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('W4 · Dubletten: Vorschau, Zusammenführen, Rückgängig', () => {
  it('zeigt was wandert, führt zusammen, nimmt exakt zurück — und verweigert nach einer späteren Änderung', async () => {
    const a = person('c-dub-a', { email: 'dub@example.invalid', firma: 'Acme' });
    const b = person('c-dub-b', { email: 'dub2@example.invalid', firma: 'Acme', einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Gespräch' }] });
    await setzeKartei([a, b]);
    await setzeCrm({ chancen: [deal('ch-dub-1', { kontaktIds: ['c-dub-b'] }), deal('ch-dub-2', { kontaktIds: ['c-dub-a', 'c-dub-b'] })] });
    const v = await (await dub.GET!(req('/api/crm/dubletten?behalten=c-dub-a&weg=c-dub-b', undefined, 'GET'))).json();
    expect(v.wandert).toMatchObject({ deals: 2, einwilligungen: 1 });

    const r = await dub.POST!(req('/api/crm/dubletten', { behalten: 'c-dub-a', weg: 'c-dub-b' }));
    expect(r.status).toBe(200);
    const { laufId } = await r.json();
    expect((await kartei()).map(k => k.id)).toEqual(['c-dub-a']);
    expect((await speicher.ladeCrm()).chancen.map(c => c.kontaktIds)).toEqual([['c-dub-a'], ['c-dub-a']]);
    const g = await (await dub.GET!(req('/api/crm/dubletten', undefined, 'GET'))).json();
    expect(g.zusammenfuehrungen.map((z: { id: string }) => z.id)).toEqual([laufId]);

    const zurueck = await dub.POST!(req('/api/crm/dubletten', { aktion: 'rueckgaengig', laufId }));
    expect(zurueck.status).toBe(200);
    expect((await kartei()).map(k => k.id).sort()).toEqual(['c-dub-a', 'c-dub-b']);
    expect((await kartei()).find(k => k.id === 'c-dub-a')).toEqual(a);
    expect((await speicher.ladeCrm()).chancen.map(c => c.kontaktIds)).toEqual([['c-dub-b'], ['c-dub-a', 'c-dub-b']]);
    expect((await dub.POST!(req('/api/crm/dubletten', { aktion: 'rueckgaengig', laufId }))).status).toBe(409);

    // Nochmals zusammenführen, danach den Deal ändern → Rückgängig 409 mit Grund, nichts angefasst.
    const r2 = await (await dub.POST!(req('/api/crm/dubletten', { behalten: 'c-dub-a', weg: 'c-dub-b' }))).json();
    await speicher.aendereCrm(c => ({ ...c, chancen: c.chancen.map(x => (x.id === 'ch-dub-1' ? { ...x, notiz: 'danach geändert' } : x)) }));
    const nein = await dub.POST!(req('/api/crm/dubletten', { aktion: 'rueckgaengig', laufId: r2.laufId }));
    expect(nein.status).toBe(409);
    expect((await nein.json()).fehler).toMatch(/seitdem geändert/);
    expect((await kartei()).map(k => k.id)).toEqual(['c-dub-a']);
  });

  it('(h) zusammen zu lange private Notiz → 409, nichts geändert', async () => {
    const a = person('c-lang-a', { email: 'l@example.invalid', privatNotiz: 'x'.repeat(1500), privatNotizVon: 'kevin' });
    const b = person('c-lang-b', { email: 'l@example.invalid', privatNotiz: 'y'.repeat(1500), privatNotizVon: 'kevin' });
    await setzeKartei([a, b]);
    const r = await dub.POST!(req('/api/crm/dubletten', { behalten: 'c-lang-a', weg: 'c-lang-b' }));
    expect(r.status).toBe(409);
    expect((await kartei()).length).toBe(2);
  });
});

describe('W5/(b) · Import-Konflikt „Liste übernehmen“ über den Kartei-Weg', () => {
  it('Typ zieht Typen[0] nach, Position wird Rolle der Hauptstation; eingeschränkt → 409', async () => {
    const k = person('c-konf-1', { email: 'konf@example.invalid', typ: 'Kunde', typen: ['Kunde', 'Partner'], firmaId: 'f-konf', firma: 'Konf GmbH', position: 'CFO', stationen: [{ firmaId: 'f-konf', rolle: 'CFO', aktiv: true, haupt: true }] });
    const e = person('c-konf-2', { eingeschraenkt: { seit: H, grund: 'Richtigkeit bestritten', von: 'kevin' } });
    await setzeKartei([k, e]);
    await setzeCrm({ firmen: [{ id: 'f-konf', name: 'Konf GmbH', rolle: 'zielkunde', geaendert: J }] });
    await db.saveJson('crm-import-konflikte', { konflikte: [
      { kontaktId: 'c-konf-1', feld: 'typ', online: 'Kunde', liste: 'Investor' },
      { kontaktId: 'c-konf-1', feld: 'position', online: 'CFO', liste: 'CEO' },
      { kontaktId: 'c-konf-2', feld: 'notiz', online: '', liste: 'x' },
    ], moeglicheDubletten: [], ohneBesitzer: 0, stand: J, quelle: 'Test' });
    expect((await imp.POST!(req('/api/crm/import', { aktion: 'konflikt', kontaktId: 'c-konf-1', feld: 'typ', wahl: 'liste' }))).status).toBe(200);
    expect((await imp.POST!(req('/api/crm/import', { aktion: 'konflikt', kontaktId: 'c-konf-1', feld: 'position', wahl: 'liste' }))).status).toBe(200);
    const nachher = (await kartei()).find(x => x.id === 'c-konf-1')!;
    expect(nachher.typ).toBe('Investor');
    expect(nachher.typen?.[0]).toBe('Investor');
    expect(nachher.position).toBe('CEO');
    expect(nachher.stationen?.find(s => s.haupt)?.rolle).toBe('CEO');
    expect(nachher.vonHand).toEqual(expect.arrayContaining(['typ', 'position']));
    const r = await imp.POST!(req('/api/crm/import', { aktion: 'konflikt', kontaktId: 'c-konf-2', feld: 'notiz', wahl: 'liste' }));
    expect(r.status).toBe(409);
    const offen = await db.loadJson<{ konflikte: unknown[] }>('crm-import-konflikte');
    expect(offen?.konflikte).toHaveLength(1);
  });
});

describe('W7/(c) · Import rückgängig: neue Firmen und Verknüpfungen außerhalb des CRM', () => {
  it('nimmt die neue, freie Firma mit; ein Neuer mit Aufgaben-Link ist „verknüpft“', async () => {
    await setzeKartei([]);
    await setzeCrm({});
    const csv = ['VORNAME;NACHNAME;EMAIL;FIRMA', 'Testa;Rueck;rueck@example.invalid;Rueckfirma GmbH', 'Testo;Link;link@example.invalid;'].join('\n');
    const r = await (await imp.POST!(req('/api/crm/import', { csv, name: 'rueck.csv' }))).json();
    expect(r.ok).toBe(true);
    const firmen = (await speicher.ladeCrm()).firmen;
    expect(firmen.map(f => f.name)).toEqual(['Rueckfirma GmbH']);
    const link = (await kartei()).find(k => k.email === 'link@example.invalid')!;
    await db.saveJson('tasks', { tasks: [{ id: 't-1', title: 'Anrufen', description: `/os/markttraktion?s=kontakte&a=akte&k=${link.id}`, projectId: 'p', status: 'offen' }] });
    const z = await (await imp.POST!(req('/api/crm/import', { aktion: 'rueckgaengig', laufId: r.laufId }))).json();
    expect(z).toMatchObject({ ok: true, zurueck: 1, firmen: 1 });
    expect(z.konflikte).toEqual([{ id: link.id, grund: 'inzwischen verknüpft' }]);
    expect((await speicher.ladeCrm()).firmen).toEqual([]);
    expect((await kartei()).map(k => k.id)).toEqual([link.id]);
  });
});

describe('W1/(f) · Aktivität: Deal-Ampel und Sperre', () => {
  it('Aktivität mit Bezug setzt letzteAktivitaet; „Sperre“ sagt werbliche Follow-ups ab und nimmt aus Kampagnen', async () => {
    await setzeKartei([person('c-sperr-1', { telefon: '+49 30 1234567', einwilligungen: [{ kanal: 'telefon', grundlage: 'einwilligung', erteiltAm: '2026-01-01', nachweis: 'x' }] })]);
    await setzeCrm({ chancen: [deal('ch-akt-1', { kontaktIds: ['c-sperr-1'] })], followups: [fu('fu-a'), fu('fu-b', { art: 'termin' })],
      kampagnen: [{ id: 'kp-s', name: 'K', playbook: 'x', ziel: 'y', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-sperr-1'], ergebnisse: [], von: 'hand', geaendert: J }] });
    const r = await akt.POST!(req('/api/crm/aktivitaet', { id: 'c-sperr-1', art: 'notiz', text: 'kurz notiert', bezug: 'ch-akt-1' }));
    expect(r.status).toBe(200);
    const crm1 = await speicher.ladeCrm();
    expect(crm1.chancen[0].letzteAktivitaet).not.toBe('2026-01-01');
    const s = await akt.POST!(req('/api/crm/aktivitaet', { id: 'c-sperr-1', art: 'anruf', ergebnis: 'sperre', anlass: 'Rückruf erbeten' }));
    expect(s.status).toBe(200);
    const crm2 = await speicher.ladeCrm();
    expect(Object.fromEntries(crm2.followups.map(f => [f.id, f.status]))).toEqual({ 'fu-a': 'abgesagt', 'fu-b': 'offen' });
    expect(crm2.kampagnen[0].kontaktIds).toEqual([]);
  });
});

describe('W3 · Löschen (Art. 17) meldet Deals ohne Person', () => {
  it('liefert dealsOhnePerson und aufgabenPruefen', async () => {
    await setzeKartei([person('c-loe-1'), person('c-loe-2')]);
    await setzeCrm({ chancen: [deal('ch-loe-1', { kontaktIds: ['c-loe-1'], titel: 'Nur sie' }), deal('ch-loe-2', { kontaktIds: ['c-loe-1', 'c-loe-2'] })] });
    const r = await (await ds.POST!(req('/api/crm/datenschutz', { id: 'c-loe-1', grund: 'Löschverlangen' }))).json();
    expect(r.ok).toBe(true);
    expect(r.dealsOhnePerson.map((d: { id: string }) => d.id)).toEqual(['ch-loe-1']);
    expect(Array.isArray(r.aufgabenPruefen)).toBe(true);
  });
});

describe('(g)/(d) · Lead-Route', () => {
  it('Mandat mit eingeschränkter Person → 409; ohne Firma heißt der Kunde „Privatkunde“', async () => {
    await setzeKartei([person('c-m-1', { eingeschraenkt: { seit: H, grund: 'Richtigkeit bestritten', von: 'kevin' } }), person('c-m-2')]);
    await setzeCrm({ chancen: [deal('ch-m-1', { kontaktIds: ['c-m-1'], stufe: 'gewonnen' }), deal('ch-m-2', { kontaktIds: ['c-m-2'], stufe: 'gewonnen', titel: 'Testa Beispielfrau · Deal' })] });
    expect((await lead.POST!(req('/api/crm/lead', { aktion: 'mandat', chanceId: 'ch-m-1' }))).status).toBe(409);
    expect((await lead.POST!(req('/api/crm/lead', { aktion: 'mandat', chanceId: 'ch-m-2' }))).status).toBe(200);
    expect((await speicher.ladeCrm()).mandate.map(m => m.kunde)).toEqual(['Privatkunde']);
    expect((await lead.POST!(req('/api/crm/lead', { aktion: 'setze', id: 'c-m-1', felder: { notiz: 'x' } }))).status).toBe(409);
  });
});

describe('Sperrliste bei Neuanlage über die Kartei', () => {
  it('eine neue Person von der Sperrliste bekommt die Werbesperre und die Antwort einen Hinweis', async () => {
    const { sperren } = await import('@/lib/crm/sperrliste');
    await sperren([{ id: 'c-alt', email: 'widerspruch@example.invalid' } as Kontakt], 'werbesperre', '2026-01-01');
    await setzeKartei([]);
    const r = await (await karteiRoute.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'upsert', eintrag: person('c-neu-sperr', { email: 'widerspruch@example.invalid' }) }] }, 'PATCH'))).json();
    expect(r.ok).toBe(true);
    expect(r.hinweis).toMatch(/Sperrliste/);
    expect((await kartei())[0].werbesperre).toMatchObject({ grund: expect.stringMatching(/Sperrliste/) });
  });
});
