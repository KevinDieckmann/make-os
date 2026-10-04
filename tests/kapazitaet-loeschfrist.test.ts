// ─── DSGVO-Nachtrag 04.10.: Kapazität deaktivierter Team-Personen — 30 Tage, dann gelöscht; Art.-15-Auskunft; Rechte ─
// Eigener Datenordner, erfundene Personen (@example.invalid), erfundene Werte — nie der echte Bestand.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kapa-frist-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kapa-frist';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
let team: { GET: Handler; PATCH: Handler };
let kapa: { GET: Handler; PATCH: Handler };
let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/kapazitaet/server');
let auf: typeof import('@/lib/kapazitaet/aufraeumen');
let speicher: typeof import('@/lib/make-one/team-speicher');

const HAUS = 'h-frist';
const TEAM = `team--${HAUS}`;
const KAPA = `kapazitaet--${HAUS}`;
const TAG = 86_400_000;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const teamPatch = (person: string, ops: unknown) => new Request('http://test/api/team', { method: 'PATCH', headers: sitzung(person), body: JSON.stringify({ ops }) });
const auskunft = (person: string, id: string) => new Request(`http://test/api/kapazitaet?auskunft=${id}`, { headers: sitzung(person) });
const konto = (id: string, sp: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });

const frei = { id: 't-frei', name: 'Frieda Erfunden', kurz: 'Frieda', rolle: 'Freie Mitarbeit', email: 'frieda@example.invalid', aktiv: true };
const bleibt = { id: 't-bleibt', name: 'Bruno Erfunden', kurz: 'Bruno', rolle: 'Kern', aktiv: true };
const kapaStart = {
  personen: {
    't-frei': { stundenWoche: 20, ausnahmen: [{ id: 'ka-u1', art: 'urlaub', von: '2026-12-21', bis: '2026-12-31', titel: 'Erfundener Urlaub' }], erholungAm: '2026-10-01T08:00:00.000Z' },
    't-bleibt': { stundenWoche: 30 },
    'konto-pa': { stundenWoche: 38, ausnahmen: [{ id: 'ka-pa', art: 'block', von: '2026-10-01', stundenWoche: 4, titel: 'Eigener Block' }] },
  },
  zuweisungen: [
    { id: 'kz-1', person: 't-frei', art: 'mandat', bezugId: 'm-erfunden', stundenWoche: 6 },
    { id: 'kz-2', person: 't-bleibt', art: 'mandat', bezugId: 'm-erfunden', stundenWoche: 4 },
  ],
};

async function teamEintrag(id: string) {
  return ((await db.loadJson<{ team: import('@/lib/make-one/team-typen').TeamEintrag[] }>(TEAM))?.team ?? []).find(e => e.id === id);
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('1', 'pa', 'Anna Prüf', 'inhaber', HAUS),
    konto('2', 'pb', 'Bert Prüf', 'mitglied', HAUS),
    konto('3', 'px', 'Testkunde', 'mitglied', 'h-fremd'),
  ], einladungen: [] });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'ms-frei', titel: 'Erfundener Schritt mit Frieda', space: 'business', bereich: 'business', faellig: '2026-12-01', fortschritt: 0, erledigt: false, aufwand: 40, personen: ['t-frei'] },
  ] });
  team = (await import('@/app/api/team/route')) as unknown as typeof team;
  kapa = (await import('@/app/api/kapazitaet/route')) as unknown as typeof kapa;
  server = await import('@/lib/kapazitaet/server');
  auf = await import('@/lib/kapazitaet/aufraeumen');
  speicher = await import('@/lib/make-one/team-speicher');
});
beforeEach(async () => {
  await db.saveJson(TEAM, { team: [frei, bleibt] });
  await db.saveJson(KAPA, structuredClone(kapaStart));
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Deaktivierungszeitpunkt — nur der Server setzt ihn', () => {
  it('deaktivieren über /api/team stempelt die Serverzeit; der Browser kann ihn weder setzen noch verschieben', async () => {
    const vor = Date.now();
    const r = await team.PATCH(teamPatch('pb', [{ op: 'teil', id: 't-frei', felder: { aktiv: false, deaktiviertAm: '2020-01-01T00:00:00.000Z' } }]));
    expect(r.status).toBe(200);
    const e = await teamEintrag('t-frei');
    expect(e?.aktiv).toBe(false);
    expect(Date.parse(e!.deaktiviertAm!)).toBeGreaterThanOrEqual(vor - 1000);
    // Ein zweites Speichern (z. B. Name ändern) verschiebt die Frist nicht — auch nicht mit einem Wert aus dem Netz.
    const stempel = e!.deaktiviertAm;
    await team.PATCH(teamPatch('pa', [{ op: 'upsert', eintrag: { ...frei, aktiv: false, name: 'Frieda E.', deaktiviertAm: new Date().toISOString() } }]));
    expect((await teamEintrag('t-frei'))?.deaktiviertAm).toBe(stempel);
    expect((await teamEintrag('t-frei'))?.name).toBe('Frieda E.');
  });

  it('reaktivieren nimmt den Zeitpunkt weg; neu angelegt als inaktiv → gestempelt; aktiv nie', async () => {
    await team.PATCH(teamPatch('pa', [{ op: 'teil', id: 't-frei', felder: { aktiv: false } }]));
    expect((await teamEintrag('t-frei'))?.deaktiviertAm).toBeTruthy();
    await team.PATCH(teamPatch('pa', [{ op: 'teil', id: 't-frei', felder: { aktiv: true } }]));
    expect((await teamEintrag('t-frei'))?.deaktiviertAm).toBeUndefined();
    await team.PATCH(teamPatch('pa', [{ op: 'upsert', eintrag: { id: 't-neu', name: 'Nora Neu', kurz: 'Nora', rolle: '', aktiv: false } }]));
    expect((await teamEintrag('t-neu'))?.deaktiviertAm).toBeTruthy();
    await team.PATCH(teamPatch('pa', [{ op: 'upsert', eintrag: { id: 't-neu2', name: 'Nils Neu', kurz: 'Nils', rolle: '', aktiv: true, deaktiviertAm: '2020-01-01T00:00:00.000Z' } }]));
    expect((await teamEintrag('t-neu2'))?.deaktiviertAm).toBeUndefined();
  });

  it('rein: deaktivierungStempeln (Konten nie, alter Zeitpunkt bleibt)', () => {
    const j = '2026-10-04T10:00:00.000Z';
    expect(speicher.deaktivierungStempeln({ ...frei, aktiv: false }, frei, j).deaktiviertAm).toBe(j);
    expect(speicher.deaktivierungStempeln({ ...frei, aktiv: false }, { ...frei, aktiv: false, deaktiviertAm: '2026-09-01T00:00:00.000Z' }, j).deaktiviertAm).toBe('2026-09-01T00:00:00.000Z');
    expect(speicher.deaktivierungStempeln({ ...frei, aktiv: false }, { ...frei, aktiv: false }, j).deaktiviertAm).toBeUndefined();
    expect(speicher.deaktivierungStempeln({ id: 'konto-pa', name: 'A', kurz: 'A', rolle: '', aktiv: false }, undefined, j).deaktiviertAm).toBeUndefined();
    expect(speicher.saeubereTeamEintrag({ ...frei, deaktiviertAm: j })).not.toHaveProperty('deaktiviertAm');
  });
});

describe('Morgenlauf: 30 Tage nach dem Deaktivieren gelöscht', () => {
  const ab = (tage: number) => new Date(Date.parse('2026-10-01T09:00:00.000Z') + tage * TAG);
  const deaktiviert = async () => db.saveJson(TEAM, { team: [{ ...frei, aktiv: false, deaktiviertAm: '2026-10-01T09:00:00.000Z' }, bleibt] });

  it('vorher (29 Tage, 30 Tage minus 1 min) bleibt alles — nichts geschrieben', async () => {
    await deaktiviert();
    for (const t of [0, 29, 30 - 1 / 1440]) {
      expect(await server.kapaDeaktivierteAufraeumen(HAUS, ab(t))).toEqual({ gestempelt: 0, personen: 0, teile: 0 });
    }
    expect(await db.loadJson(KAPA)).toEqual(kapaStart);
  });

  it('nach 30 Tagen: Grundwert, Ausnahmen, Einwilligung und Zuweisungen der Person weg — die anderen bleiben; idempotent', async () => {
    await deaktiviert();
    const r = await server.kapaDeaktivierteAufraeumen(HAUS, ab(30));
    expect(r).toEqual({ gestempelt: 0, personen: 1, teile: 2 });
    const d = await db.loadJson<typeof kapaStart>(KAPA);
    expect(d?.personen).not.toHaveProperty('t-frei');
    expect(d?.personen['t-bleibt']).toEqual({ stundenWoche: 30 });
    expect(d?.personen['konto-pa']).toEqual(kapaStart.personen['konto-pa']);
    expect(d?.zuweisungen.map(z => z.id)).toEqual(['kz-2']);
    expect(JSON.stringify(d)).not.toContain('Erfundener Urlaub');
    // Der Team-Eintrag selbst bleibt (alte Delegiert-Marker zeigen auf das Kurzwort).
    expect((await teamEintrag('t-frei'))?.aktiv).toBe(false);
    // Zweiter Lauf: nichts mehr fällig, nichts geschrieben.
    expect(await server.kapaDeaktivierteAufraeumen(HAUS, ab(31))).toEqual({ gestempelt: 0, personen: 0, teile: 0 });
  });

  it('reaktiviert vor Ablauf: nichts wird gelöscht, auch nicht später', async () => {
    await deaktiviert();
    await team.PATCH(teamPatch('pa', [{ op: 'teil', id: 't-frei', felder: { aktiv: true } }]));
    expect(await server.kapaDeaktivierteAufraeumen(HAUS, ab(45))).toEqual({ gestempelt: 0, personen: 0, teile: 0 });
    expect(await db.loadJson(KAPA)).toEqual(kapaStart);
  });

  it('Kompatibilität: alter deaktivierter Eintrag ohne Zeitpunkt → erster Lauf stempelt (Frist beginnt), gelöscht erst 30 Tage danach', async () => {
    await db.saveJson(TEAM, { team: [{ ...frei, aktiv: false }, bleibt] });
    const r = await server.kapaDeaktivierteAufraeumen(HAUS, ab(0));
    expect(r).toEqual({ gestempelt: 1, personen: 0, teile: 0 });
    expect((await teamEintrag('t-frei'))?.deaktiviertAm).toBe(ab(0).toISOString());
    expect(await db.loadJson(KAPA)).toEqual(kapaStart);
    expect((await server.kapaDeaktivierteAufraeumen(HAUS, ab(29))).personen).toBe(0);
    expect((await server.kapaDeaktivierteAufraeumen(HAUS, ab(30))).personen).toBe(1);
  });

  it('rein: Frist, Löschtag, Plan', () => {
    const e = { id: 't-x', aktiv: false, deaktiviertAm: '2026-10-01T09:00:00.000Z' };
    expect(auf.kapaLoeschFaellig(e, ab(29.99).toISOString())).toBe(false);
    expect(auf.kapaLoeschFaellig(e, ab(30).toISOString())).toBe(true);
    expect(auf.kapaLoeschFaellig({ ...e, aktiv: true }, ab(90).toISOString())).toBe(false);
    expect(auf.kapaLoeschFaellig({ ...e, id: 'konto-pa' }, ab(90).toISOString())).toBe(false);
    expect(auf.kapaLoeschTag(e)).toBe('2026-10-31');
    expect(auf.kapaLoeschPlan([{ ...frei, aktiv: false }, { ...bleibt }], ab(0).toISOString())).toEqual({ stempeln: ['t-frei'], faellig: [] });
  });
});

describe('Art. 15 — Auskunft über die Kapazitätsdaten', () => {
  it('Inhaber: Team-Person (auch deaktiviert) als Datei — Grundwert, Ausnahmen mit Titel, Zuweisungen, Einwilligung, Löschtag, Verweise', async () => {
    await db.saveJson(TEAM, { team: [{ ...frei, aktiv: false, deaktiviertAm: '2026-10-01T09:00:00.000Z' }, bleibt] });
    const r = await kapa.GET(auskunft('pa', 't-frei'));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const j = await r.json();
    expect(j.person).toMatchObject({ id: 't-frei', aktiv: false, konto: false, kapazitaetLoeschungAb: '2026-10-31' });
    expect(j.grundwertStundenWoche).toBe(20);
    expect(j.ausnahmen[0].titel).toBe('Erfundener Urlaub');
    expect(j.zuweisungen.map((z: { id: string }) => z.id)).toEqual(['kz-1']);
    expect(j.erholungEinwilligungAm).toBe('2026-10-01T08:00:00.000Z');
    expect(j.arbeitetAn).toEqual([{ art: 'meilenstein', id: 'ms-frei', titel: 'Erfundener Schritt mit Frieda' }]);
    expect(JSON.stringify(j)).not.toContain('Eigener Block'); // nie Daten einer anderen Person
  });

  it('Rechte: Team-Person nur der Inhaber; Konto nur die Person selbst (auch nicht der Inhaber); fremder Haushalt 403; unbekannt 404', async () => {
    expect((await kapa.GET(auskunft('pb', 't-frei'))).status).toBe(403);
    const eigen = await kapa.GET(auskunft('pa', 'konto-pa'));
    expect(eigen.status).toBe(200);
    expect((await eigen.json()).ausnahmen[0].titel).toBe('Eigener Block');
    expect((await kapa.GET(auskunft('pb', 'konto-pa'))).status).toBe(403);
    expect((await kapa.GET(auskunft('pa', 'konto-pb'))).status).toBe(403);
    expect((await kapa.GET(auskunft('pb', 'konto-pb'))).status).toBe(200);
    const fremd = await kapa.GET(auskunft('px', 't-frei'));
    expect(fremd.status).toBe(403);
    expect(JSON.stringify(await fremd.json())).not.toContain('Frieda');
    expect((await kapa.GET(new Request('http://test/api/kapazitaet?auskunft=t-frei'))).status).toBe(403);
    expect((await kapa.GET(auskunft('pa', 't-gibtsnicht'))).status).toBe(404);
    expect((await kapa.GET(auskunft('pa', '../konten'))).status).toBe(400);
  });

  it('Kontakt-Auskunft: Team-Person ohne Konto über ihre E-Mail; Konten nie; nach der Löschung leer', async () => {
    const l = await server.kapaAuskunftFuerAdressen(['Frieda@example.invalid']);
    expect(l).toHaveLength(1);
    expect(l[0].grundwertStundenWoche).toBe(20);
    expect(await server.kapaAuskunftFuerAdressen(['pa@example.invalid'])).toEqual([]);
    await db.saveJson(TEAM, { team: [{ ...frei, aktiv: false, deaktiviertAm: '2026-01-01T00:00:00.000Z' }, bleibt] });
    await server.kapaDeaktivierteAufraeumen(HAUS, new Date('2026-10-04T00:00:00.000Z'));
    const nachher = await server.kapaAuskunftFuerAdressen(['frieda@example.invalid']);
    expect(nachher[0]).toMatchObject({ grundwertStundenWoche: null, ausnahmen: [], zuweisungen: [], erholungEinwilligungAm: null });
  });
});

describe('Verzeichnis (Art. 30): neue Fassung nur, wo die alte unverändert steht', () => {
  it('hebt die alte Löschfrist „offen: deaktivierte Team-Personen“ — von Hand Geändertes bleibt', async () => {
    const { verarbeitungenOrganisation, verarbeitungenOrganisationNachtragen } = await import('@/lib/crm/datenschutz');
    const alt = verarbeitungenOrganisation('2026-10-04T10:00:00.000Z').map(v => (v.id === 'vv-kapazitaet'
      ? { ...v, loeschfrist: 'bis zur Löschung durch Person bzw. Inhaber; Erholung wird nicht gespeichert (Rechnung im Speicher höchstens 60 s); offen: Einträge deaktivierter Team-Personen' } : v));
    const neu = verarbeitungenOrganisationNachtragen(alt, '2026-10-05T10:00:00.000Z');
    expect(neu.find(v => v.id === 'vv-kapazitaet')?.loeschfrist).toContain('30 Tage nach dem Deaktivieren');
    const hand = alt.map(v => (v.id === 'vv-kapazitaet' ? { ...v, loeschfrist: 'von Hand' } : v));
    expect(verarbeitungenOrganisationNachtragen(hand, '2026-10-05T10:00:00.000Z').find(v => v.id === 'vv-kapazitaet')?.loeschfrist).toBe('von Hand');
    // Unverändert neue Fassung → nichts zu tun (gleiche Liste).
    expect(verarbeitungenOrganisationNachtragen(neu, '2026-10-06T10:00:00.000Z')).toEqual(neu);
  });
});
