// ─── Kundengewinnung — Prüfung R2-1 „ganze Wege von Anfang bis Ende“ (02.11.): je Fund mindestens ein Fall ─────────────────────────────────────
// Kevin: „Im Thema Kundengewinnung soll nichts dem Zufall überlassen werden.“ Eigener Datenordner, Datenschlüssel und Pepper, zwei Konten im
// Test-Haushalt, erfundene Daten (@example.invalid). iCloud nachgebaut (nie echte Aufrufe), Kalender-Zugang über `x-make-user`, kein Modell, keine Mail.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';
import type { BuchungBestand, Buchung } from '@/lib/kalender/buchung';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kg-wege-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kg-wege';
process.env.SESSION_SECRET = 'pruef-sitzung-kg-wege-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-kg-wege';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-kg-wege-0123456789abcdef';
delete process.env.MAKE_OS_ADRESSE;

const ic = vi.hoisted(() => ({ angelegt: 0 }));
const stand = () => ({ at: new Date().toISOString(), kalender: [], objekte: {} });
vi.mock('@/lib/kalender/icloud', async () => {
  const echt = await vi.importActual<typeof import('@/lib/kalender/icloud')>('@/lib/kalender/icloud');
  return {
    ...echt,
    verbunden: () => true,
    ladeStand: async () => stand(),
    frischerStand: async () => stand(),
    abgleichen: async () => stand(),
    termineImZeitraum: () => [],
    anlegen: async (e: { kalender: string }) => { ic.angelegt++; const uid = `UID-WEGE-${ic.angelegt}`; return { uid, schluessel: `testkal|${uid}`, kalender: e.kalender, gaeste: 0 }; },
  };
});
vi.mock('@/lib/kalender/zugang', () => ({
  KEIN_KALENDER: { ok: false, fehler: 'Kein Zugang.' },
  kalenderZugang: async (req: Request) => { const p = req.headers.get('x-make-user'); return p === 'kevin' || p === 'malin' ? { person: p, dienst: false } : null; },
}));

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let HAUS = '';
const D = 'example.invalid';
const T0 = new Date('2026-11-03T09:00:00Z'); // Di 10:00 Berlin
const HEUTE = '2026-11-03';
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;
const glocke = async (wer: string) => (await db.loadJson<{ eintraege: { art: string; titel: string; link: string }[] }>(`meldungen--${wer}`))?.eintraege ?? [];
const buchungen = async () => (await db.loadJson<BuchungBestand>(`buchung--${HAUS}`))!;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Muster ${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const SEITE = { id: 'bs-wege', slug: 'erstgespraech-0123456789abcdef01234567', titel: 'Erstgespräch', person: 'kevin', dauerMin: 30, fenster: [{ tage: [1, 2, 3, 4, 5], von: '09:00', bis: '17:00' }], tageVoraus: 30, vorlaufMin: 60, maxJeTag: 4, pufferMin: 0, rasterMin: 30, zielKalender: 'Testkalender', verantwortlich: 'Probe GmbH, Teststraße 1, 50667 Köln', fragen: { firma: true, anliegen: true }, aktiv: true, angelegt: '2026-10-01T08:00:00Z', geaendert: '2026-10-01T08:00:00Z' };
const buchung = (id: string, x: Partial<Buchung> = {}): Buchung => ({
  id, seiteId: SEITE.id, start: '2026-11-02T10:00:00', ende: '2026-11-02T10:30:00', status: 'angefragt', name: 'Gerda Gast', email: `gast-${id}@${D}`,
  einwilligung: { wortlaut: 'x', version: 'buchung-2026-10-05-4', am: '2026-10-30T08:00:00Z' }, tokenHash: 'a'.repeat(64), angelegt: '2026-10-30T08:00:00Z',
  reserviertBis: '2026-10-30T08:30:00Z', statusAm: '2026-10-30T08:00:00Z', angefragtAm: '2026-10-30T08:00:00Z', ...x,
} as Buchung);
type Verwaltung = { POST: (r: Request) => Promise<Response> };
let verwaltung: Verwaltung;
const verwalten = async (body: Record<string, unknown>, wer = 'kevin') => { const r = await verwaltung.POST(new Request('http://test/api/kalender/buchung', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': wer }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as J }; };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Testa Partnerin', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [k('c-eng', { email: `eng@${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } })] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', { ...leererBestand(), events: [{ id: 'ev-wege', titel: 'Stammtisch Probe', format: 'stammtisch', ziel: 'Gespräche', datum: HEUTE, status: 'geplant', geaendert: '2026-10-01' }] });
  await db.saveJson('tasks', { projects: [], tasks: [] });
  HAUS = await (await import('@/lib/kalender/buchung-speicher')).buchungHaushalt();
  await db.saveJson(`buchung--${HAUS}`, { seiten: [SEITE], buchungen: [] });
  verwaltung = (await import('@/app/api/kalender/buchung/route')) as unknown as Verwaltung;
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

// ── Fund 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 1 — verfallene Terminanfrage ist keine Sackgasse', () => {
  it('rein: das Panel kennt die verfallenen (ohne Kontakt), der Mail-Entwurf schlägt einen neuen Termin vor, der Hinweis sagt es (Fassung 5)', async () => {
    const B = await import('@/lib/kalender/buchung');
    const l = [buchung('bu-a', { status: 'abgelaufen', verfallen: true }), buchung('bu-b', { status: 'abgelaufen' }), buchung('bu-c', { status: 'abgelaufen', verfallen: true, kontaktId: 'c-x' })];
    expect(B.verfalleneOffen(l).map(x => x.id)).toEqual(['bu-a']);
    const m = B.neuerTerminMail({ name: 'Gerda Gast', titel: 'Erstgespräch', start: '2026-11-02T10:00:00', link: 'https://test.example.invalid/buchen/x', verantwortlich: 'Probe GmbH' });
    expect(m.text).toContain('https://test.example.invalid/buchen/x');
    expect(m.text).toContain('02.11.2026, 10:00 Uhr');
    expect(m.betreff).toContain('neuer Terminvorschlag');
    // Ohne aktive Buchungsseite kein Link — der Entwurf bittet um eine Antwort.
    const ohne = B.neuerTerminMail({ name: 'Gerda Gast', titel: 'Erstgespräch', start: '2026-11-02T10:00:00', verantwortlich: 'Probe GmbH' });
    expect(ohne.text).not.toMatch(/https?:/);
    expect(ohne.text).toContain('Antworten Sie einfach');
    const text = B.datenschutzHinweis(B.HINWEIS_FRISTEN_STANDARD).join(' ');
    expect(text).toContain('neuen Terminvorschlag');
    expect(text).toContain('Erst wenn wir den Termin bestätigen, legen wir Sie als Geschäftskontakt an');
    expect(text).toMatch(/Art\. 6 Abs\. 1 lit\. b DSGVO/);
    expect(B.EINWILLIGUNG_VERSION).toBe('buchung-2026-11-02-5');
  });

  it('„Als Anfrage übernehmen“: Person + Follow-up „Anfrage beantworten“ (feste Kennung), Buchung trägt den Kontakt; zweiter Klick legt nichts doppelt an', async () => {
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, buchungen: [...cur!.buchungen, buchung('bu-verfall-1', { firma: 'Probewerk Süd GmbH', anliegen: 'Nachfolge regeln' }), buchung('bu-abgelehnt-1', { status: 'abgelehnt' })] }));
    const r = await verwalten({ aktion: 'anfrage-uebernehmen', id: 'bu-verfall-1' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const person = (await kontakte()).find(x => x.email === `gast-bu-verfall-1@${D}`)!;
    expect(person).toBeTruthy();
    expect(r.d.kontaktId).toBe(person.id);
    expect(person.aktivitaeten.some(a => (a.text ?? '').includes('Wunschtermin 02.11.2026, 10:00 Uhr verstrichen'))).toBe(true);
    const fu = (await crm()).followups.find(f => f.id === 'fu-bu-verfall-1')!;
    expect(fu).toMatchObject({ status: 'offen', kontaktId: person.id, zustaendig: 'kevin' });
    const b = (await buchungen()).buchungen.find(x => x.id === 'bu-verfall-1')!;
    expect(b).toMatchObject({ status: 'abgelaufen', verfallen: true, kontaktId: person.id, followUpId: 'fu-bu-verfall-1' });
    const zwei = await verwalten({ aktion: 'anfrage-uebernehmen', id: 'bu-verfall-1' });
    expect(zwei.d).toMatchObject({ ok: true, schon: true, kontaktId: person.id });
    expect((await kontakte()).filter(x => x.email === `gast-bu-verfall-1@${D}`)).toHaveLength(1);
    expect((await crm()).followups.filter(f => f.id === 'fu-bu-verfall-1')).toHaveLength(1);
    // Nur verfallene: eine abgelehnte (oder offene) Anfrage geht nicht über diesen Weg.
    expect((await verwalten({ aktion: 'anfrage-uebernehmen', id: 'bu-abgelehnt-1' })).status).toBe(409);
  });

  it('Art. 18: eine eingeschränkte Person wird nicht verarbeitet (409, nichts an der Buchung)', async () => {
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, buchungen: [...cur!.buchungen, buchung('bu-verfall-eng', { email: `eng@${D}` })] }));
    const r = await verwalten({ aktion: 'anfrage-uebernehmen', id: 'bu-verfall-eng' });
    expect(r.status).toBe(409);
    expect((await buchungen()).buchungen.find(x => x.id === 'bu-verfall-eng')?.kontaktId).toBeUndefined();
  });
});

// ── Fund 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 2 — die Automatik nach „angenommen“ scheitert nicht unbemerkt', () => {
  it('ohne Gesellschaft: feste Aufgabe „Mandat anlegen“ mit Grund an die Sales-Verantwortung (einmal) — und die Prüfung ist ein Fehler', async () => {
    await db.updateJson<CrmBestand>('crm', c => ({ ...c!,
      chancen: [...c!.chancen, { id: 'ch-wege-1', titel: 'Probe-Deal', kontaktIds: [], stufe: 'gewonnen', wert: { betrag: 1000, basis: 'einmalig' }, historie: [], angelegt: '2026-10-01', geaendert: '2026-10-01' } as unknown as CrmBestand['chancen'][number]],
      angebote: [...(c!.angebote ?? []), { id: 'ang-wege-1', titel: 'Probeangebot', status: 'angenommen', dealId: 'ch-wege-1', gesellschaft: '', positionen: [], version: 1, angelegt: '2026-10-01', geaendert: '2026-10-01' } as unknown as NonNullable<CrmBestand['angebote']>[number]],
    }));
    const M = await import('@/lib/crm/mandat-automatik-server');
    const r = await M.mandatAusAngebotAutomatisch({ angebotId: 'ang-wege-1', person: 'kevin' });
    expect(r).toMatchObject({ angelegt: false });
    const { verantwortlichePerson } = await import('@/lib/crm/verantwortung-server');
    const t = ((await db.loadJson<{ tasks: { id: string; assignee: string; description?: string; status: string }[] }>('tasks'))!).tasks.filter(x => x.id === 'mfa-ang-wege-1');
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ assignee: await verantwortlichePerson('sales'), status: 'todo' });
    expect(t[0].description).toContain('keine Gesellschaft');
    await M.mandatAusAngebotAutomatisch({ angebotId: 'ang-wege-1', person: 'kevin' });
    expect(((await db.loadJson<{ tasks: { id: string }[] }>('tasks'))!).tasks.filter(x => x.id === 'mfa-ang-wege-1')).toHaveLength(1);
    const V = await import('@/lib/crm/verbindungen');
    expect(V.PRUEFUNGEN['angebot-angenommen-ohne-mandat'].schwere).toBe('fehler');
    const befunde = (await import('@/lib/crm/befunde')).befunde;
    const bf = befunde(await kontakte(), await crm(), HEUTE) as { titel: string; grund?: string }[];
    expect(bf.some(x => /Verbindungsfehler/.test(x.titel) && /noch kein Mandat/.test(x.grund ?? ''))).toBe(true);
    // Titel nennt nur die Nummer, nie den Angebotstitel (der kann einen Namen tragen).
    expect(((await db.loadJson<{ tasks: { id: string; title: string }[] }>('tasks'))!).tasks.find(x => x.id === 'mfa-ang-wege-1')!.title).not.toContain('Probeangebot');
    // Das Mandat entsteht von Hand (über den Deal) → die Aufgabe ist erledigt, nicht verwaist.
    await db.updateJson<CrmBestand>('crm', c => ({ ...c!, mandate: [...c!.mandate, { id: 'md-wege-1', kunde: 'Probe', chanceId: 'ch-wege-1', status: 'aktiv', angelegt: '2026-11-02' } as unknown as CrmBestand['mandate'][number]] }));
    expect(await M.mandatFehltAufgabenSchliessen()).toBe(1);
    expect(((await db.loadJson<{ tasks: { id: string; status: string }[] }>('tasks'))!).tasks.find(x => x.id === 'mfa-ang-wege-1')!.status).toBe('done');
    expect(await M.mandatFehltAufgabenSchliessen()).toBe(0);
  });
});

// ── Fund 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 3 — Angebots-Entwurf aus dem Netzwerken hat eine Erinnerung', () => {
  it('Follow-up „Angebot fertigstellen“ an die zuständige Person (auch wenn sie selbst erfasst), einmal; Papierkorb schließt, Zurückholen öffnet, Löschen schließt', async () => {
    const route = (await import('@/app/api/netzwerken/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9]).toString('base64');
    const e = { erfassungId: randomUUID(), erfasstAm: new Date().toISOString(), eventId: 'ev-wege', kontakt: { vorname: 'Nora', nachname: 'Netz', firma: 'Netzprobe GmbH', email: `nora@${D}` }, bilder: [{ name: 'karte.jpg', typ: 'image/jpeg', daten: JPEG }], schritt: 'angebot', zustaendig: 'kevin' };
    const senden = async () => { const r = await route.POST(new Request('http://test/api/netzwerken', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'kevin' }, body: JSON.stringify(e) })); return { status: r.status, d: await r.json() as J }; };
    const r = await senden();
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const ang = `ang-nw-${e.erfassungId}`, fid = `fu-${ang}-entwurf`;
    expect(r.d.angebotId).toBe(ang);
    const fu = () => crm().then(c => c.followups.filter(f => f.id === fid));
    expect(await fu()).toMatchObject([{ status: 'offen', zustaendig: 'kevin', kontaktId: r.d.kontaktId }]);
    expect((await fu())[0].text).toContain('Angebot fertigstellen');
    await senden();
    expect(await fu()).toHaveLength(1);
    const A = await import('@/lib/crm/angebot-server');
    await A.angebotAblage({ id: ang, art: 'papierkorb' });
    expect((await fu())[0].status).toBe('abgesagt');
    await A.angebotAblage({ id: ang, art: 'papierkorb', zurueck: true });
    expect((await fu())[0].status).toBe('offen');
    await A.angebotAblage({ id: ang, art: 'papierkorb' });
    const { standVon } = await import('@/lib/crm/crm-stand');
    await A.angebotLoeschen({ id: ang, stand: standVon((await crm()).angebote!.find(x => x.id === ang)!) });
    expect((await fu())[0].status).toBe('abgesagt');
  });
  it('rein: Stellen erledigt nur das „Angebot fertigstellen“ (nurEntwurf), Annehmen/Ablehnen schließen es mit', async () => {
    const { angebotFollowupsSchliessen, angebotEntwurfFollowupId } = await import('@/lib/crm/angebote');
    const f = (id: string) => ({ id, bezug: { art: 'kontakt' as const, id: 'c-x' }, art: 'sonstig' as const, text: 'x', faellig: HEUTE, zustaendig: 'kevin', status: 'offen' as const, quelle: 'hand' as const, angelegt: HEUTE, geaendert: HEUTE });
    const l = [f(angebotEntwurfFollowupId('ang-1')), f('fu-ang-1')];
    const nur = angebotFollowupsSchliessen(l, ['ang-1'], { status: 'erledigt', ergebnis: 'Angebot gestellt', jetzt: T0.toISOString(), person: 'kevin', nurEntwurf: true });
    expect(nur.map(x => x.status)).toEqual(['erledigt', 'offen']);
    expect(angebotFollowupsSchliessen(l, ['ang-1'], { status: 'abgesagt', ergebnis: 'x', jetzt: T0.toISOString(), person: 'kevin' }).map(x => x.status)).toEqual(['abgesagt', 'abgesagt']);
  });
});

// ── Fund 4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 4 — „Termin vorbereiten“ unterdrückt „Wie lief es?“ nicht', () => {
  it('Follow-up fällig VOR dem Termin zählt nicht als Nachbereitung, eines danach schon', async () => {
    const { nachbereitung } = await import('@/lib/crm/erfassen');
    const { zeitenAus } = await import('@/lib/crm/aktivitaeten');
    const zeiten = zeitenAus([{ id: 'kal1|u-vorbei', start: '2026-11-02T10:00:00', ende: '2026-11-02T11:00:00', titel: 'Erstgespräch' }] as never);
    const kk = [k('c-nb', { besitzer: 'kevin', aktivitaeten: [{ art: 'termin', am: '2026-10-30T08:00:00.000Z', von: 'kevin', text: 'Termin gebucht', terminUid: 'kal1|u-vorbei' }] } as Partial<Kontakt>)];
    const vorbereiten = { status: 'offen', terminUid: 'kal1|u-vorbei', faellig: '2026-11-01' };
    expect(nachbereitung(kk, HEUTE, 'kevin', zeiten, '2026-11-03T12:00:00', [vorbereiten])).toHaveLength(1);
    expect(nachbereitung(kk, HEUTE, 'kevin', zeiten, '2026-11-03T12:00:00', [{ ...vorbereiten, faellig: '2026-11-04' }])).toHaveLength(0);
  });
});

// ── Fund 5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 5 — Buchungsanfragen sehen alle, die steuern dürfen', () => {
  it('ab 24 h wartend: auch die andere Person sieht die Anfrage (neutral „eine Entscheidung“); frische nur die Person der Seite', async () => {
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, buchungen: [...cur!.buchungen,
      buchung('bu-lange-1', { start: '2026-11-10T10:00:00', ende: '2026-11-10T10:30:00', angefragtAm: '2026-11-01T08:00:00Z' }),
      buchung('bu-frisch-1', { start: '2026-11-11T10:00:00', ende: '2026-11-11T10:30:00', angefragtAm: '2026-11-03T08:30:00Z' }),
    ] }));
    const S = await import('@/lib/heute/anstehend-server');
    const malin = (await S.anstehendLesen('malin', T0)).buchungen;
    expect(malin.map(x => x.id)).toEqual(['bu-lange-1']);
    expect(malin[0]).toMatchObject({ fremd: true, lange: true });
    expect((await S.anstehendLesen('kevin', T0)).buchungen.map(x => x.id).sort()).toEqual(['bu-frisch-1', 'bu-lange-1']);
    const R = await import('@/lib/meldungen/regeln');
    const m = R.anstehendAbleiten({ termine: [], nachbereiten: [], fristen: [], followups: [], buchungen: malin }, { heute: HEUTE, jetztWand: '2026-11-03T10:00:00', am: T0.toISOString() });
    expect(m.map(x => x.titel)).toEqual(['Terminanfrage „Erstgespräch“ (10.11. 10:00) wartet seit über 24 Stunden auf eine Entscheidung']);
    expect(m[0].titel).not.toContain('Gerda');
  });
  it('verfallen: die Glocke geht auch an die andere Person, die steuern darf — ohne Namen', async () => {
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, buchungen: [...cur!.buchungen, buchung('bu-verfall-2', { start: '2026-11-02T14:00:00', ende: '2026-11-02T14:30:00' })] }));
    const S = await import('@/lib/kalender/buchung-speicher');
    expect(await S.buchungenVerfallenMelden(T0)).toBeGreaterThan(0);
    const g = (await glocke('malin')).filter(x => /verfallen, ohne Reaktion/.test(x.titel));
    expect(g).toHaveLength(1);
    expect(g[0].titel).not.toContain('Gerda');
    expect((await glocke('kevin')).filter(x => /verfallen, ohne Reaktion/.test(x.titel))).toHaveLength(1);
  });
});

// ── Fund 6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 6 — Wiedervorlage eines verlorenen Deals meldet sich', () => {
  it('„Für dich“ und „Steht an“ nennen „n Leads aus verlorenen Deals wieder dran“ an die Zuständige des Leads', async () => {
    await db.updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ kontakte: [...(cur?.kontakte ?? []), k('c-verl', { besitzer: 'kevin', firmaId: 'f-verl', firma: 'Verlust GmbH', stationen: [{ firmaId: 'f-verl', aktiv: true, haupt: true }] } as Partial<Kontakt>)] }));
    await db.updateJson<CrmBestand>('crm', c => ({ ...c!,
      firmen: [...c!.firmen, { id: 'f-verl', name: 'Verlust GmbH', lead: { status: 'sql', kriterien: {}, chanceId: 'ch-verl' } } as unknown as CrmBestand['firmen'][number]],
      chancen: [...c!.chancen, { id: 'ch-verl', titel: 'Verlorener Deal', kontaktIds: ['c-verl'], firmaId: 'f-verl', stufe: 'verloren', grund: 'Budget erst im neuen Jahr', wiedervorlage: '2026-11-01', wert: { betrag: 1000, basis: 'einmalig' }, historie: [], angelegt: '2026-09-01', geaendert: '2026-09-01' } as unknown as CrmBestand['chancen'][number]],
    }));
    const { fuerDich } = await import('@/lib/crm/team');
    const f = fuerDich('kevin', await kontakte(), await crm(), HEUTE).find(x => x.id === 'verloren-wieder');
    expect(f).toMatchObject({ anzahl: 1, welt: 'sales' });
    expect(fuerDich('malin', await kontakte(), await crm(), HEUTE).find(x => x.id === 'verloren-wieder')).toBeUndefined();
    const { anstehendLesen } = await import('@/lib/heute/anstehend-server');
    const w = (await anstehendLesen('kevin', T0)).motor?.find(x => x.id === 'wieder');
    expect(w).toMatchObject({ n: 1 });
    expect(w!.titel).toContain('1 Lead aus einem verlorenen Deal ist wieder dran');
    // Vor der Wiedervorlage: nichts.
    const { ausVerlorenWiederDran } = await import('@/lib/crm/leads');
    expect(ausVerlorenWiederDran({ status: 'ruht', wiedervorlage: '2026-11-20', deal: { id: 'x', titel: 'x', stufe: 'verloren', wert: 0, offen: false } }, HEUTE)).toBe(false);
  });
});

// ── Fund 7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 7 — Buchungsfreigabe setzt den Lead der Firma', () => {
  it('neue Person mit Firma: der Firmen-Lead steht nach der Freigabe auf „kontaktiert“ (einmal, Notiz nicht doppelt)', async () => {
    await db.updateJson<BuchungBestand>(`buchung--${HAUS}`, cur => ({ ...cur!, buchungen: [...cur!.buchungen, buchung('bu-freigabe-1', { start: '2026-11-12T10:00:00', ende: '2026-11-12T10:30:00', firma: 'Freigabewerk GmbH', email: `frei@${D}` })] }));
    const r = await verwalten({ aktion: 'freigeben', id: 'bu-freigabe-1', trotzKonflikt: true });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const person = (await kontakte()).find(x => x.email === `frei@${D}`)!;
    expect(person.firmaId).toBeTruthy();
    const f = (await crm()).firmen.find(x => x.id === person.firmaId)!;
    expect(f.lead?.status).toBe('kontaktiert');
    expect((f.lead?.notiz ?? '').split('\n').filter(z => z.startsWith('Anfrage über Website'))).toHaveLength(1);
  });
});

describe('Neuigkeit', () => {
  it('steht oben, neutral, nur Business', async () => {
    const { NEUIGKEITEN } = await import('@/lib/neuigkeiten/eintraege');
    // Per Kennung (spätere Updates stehen darüber), vor den älteren Einträgen desselben Tages.
    const i = NEUIGKEITEN.findIndex(n => n.id === 'u-2026-11-02-17');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(NEUIGKEITEN.findIndex(n => n.id === 'u-2026-11-02-16')).toBeGreaterThan(i);
    expect(JSON.stringify(NEUIGKEITEN[i])).not.toMatch(/Malin|Kevin/);
    expect(NEUIGKEITEN[i].abschnitte.flatMap(a => a.punkte).every(p => p.bereich === 'business')).toBe(true);
  });
});
