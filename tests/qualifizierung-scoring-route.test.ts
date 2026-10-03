// ─── Qualifizierung & Scoring — Routen (03.10.): Einstellungen mit Stand/409, Lead-Aktionen (Stufen, Parken, Raus, Abgeben) ────
// Eigener Datenordner, erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-quali-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-quali';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Handler = (r: Request) => Promise<Response>;
type Kontakt = import('@/lib/make-one/crm').Kontakt;
const HAUS = 'quali-haus';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt = HAUS) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
const kopf = (user: string | null) => ({ 'content-type': 'application/json', ...(user ? { 'x-make-user': user } : {}) });
const dienstKopf = { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-quali', 'x-make-person': 'kevin' };
const k = (id: string, x: Partial<Kontakt>): Kontakt => ({ id, vorname: 'Vera', nachname: id.slice(2), eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const firma = (id: string) => ({ id, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: '2026-09-01T10:00:00.000Z' });

let db: typeof import('@/lib/store/local-db');
let scoring: { GET: Handler; PATCH: Handler };
let lead: { GET: Handler; POST: Handler };
let sc: typeof import('@/lib/crm/scoring');
let ls: typeof import('@/lib/crm/leads');
let speicher: typeof import('@/lib/crm/speicher');

const scGet = async (user: string | null = 'kevin') => { const r = await scoring.GET(new Request('http://test/api/crm/scoring', { headers: user ? kopf(user) : dienstKopf })); return { status: r.status, d: await r.json() }; };
const scPatch = async (body: unknown, user: string | null = 'kevin') => { const r = await scoring.PATCH(new Request('http://test/api/crm/scoring', { method: 'PATCH', headers: user ? kopf(user) : dienstKopf, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const post = async (body: unknown, user: string | null = 'kevin') => { const r = await lead.POST(new Request('http://test/api/crm/lead', { method: 'POST', headers: user ? kopf(user) : dienstKopf, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const zeile = async (id: string) => ls.leads((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte, await speicher.ladeCrm(), '2026-10-03').find(z => z.id === id)!;
const leadVon = async (id: string) => (await speicher.ladeCrm()).firmen.find(f => f.id === id)?.lead;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  sc = await import('@/lib/crm/scoring');
  ls = await import('@/lib/crm/leads');
  speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'fremd', 'mitglied', 'anderes-haus')], einladungen: [] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [firma('f-alpha'), firma('f-beta'), firma('f-leer')] });
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna1', { firmaId: 'f-alpha', firma: 'Firma f-alpha', besitzer: 'kevin', email: 'anna@example.invalid' }),
    k('c-bert1', { firmaId: 'f-alpha', firma: 'Firma f-alpha', besitzer: 'kevin' }),
    k('c-cora1', { firmaId: 'f-beta', firma: 'Firma f-beta', besitzer: 'malin' }),
  ] });
  scoring = (await import('@/app/api/crm/scoring/route')) as unknown as { GET: Handler; PATCH: Handler };
  lead = (await import('@/app/api/crm/lead/route')) as unknown as { GET: Handler; POST: Handler };
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Scoring-Einstellungen — Route mit Stand/409', () => {
  it('GET: Standard (seit 03.10. der geschärfte Vorschlag), Stand, bisherige Rechnung und der Katalog der Messungen; fremder Haushalt → 403', async () => {
    const r = await scGet();
    expect(r.status).toBe(200);
    expect(r.d.einstellungen).toEqual(sc.standardScoring());
    expect(r.d.stand).toBeTypeOf('string');
    expect(r.d.einstellungen.quelle).toBe('standard');
    expect(r.d.einstellungen.sales.schwelle).toBe(28);
    expect(r.d.bisherig.sales.schwelle).toBe(15);
    expect(r.d.bisherig.quelle).toBe('bisherig');
    expect(r.d.messungen.map((m: { id: string }) => m.id)).toContain('makeone');
    expect(r.d.zurueckMoeglich).toBe(false);
    expect((await scGet('fremd')).status).toBe(403);
  });

  it('Dienstweg (ZOE) darf lesen, nie schreiben', async () => {
    expect((await scGet(null)).status).toBe(200);
    const { d } = await scGet();
    expect((await scPatch({ aktion: 'bisherig', stand: d.stand }, null)).status).toBe(403);
  });

  it('Speichern mit Stand → gilt sofort für ladeCrm und die Lead-Rechnung; veralteter Stand → 409 mit dem aktuellen', async () => {
    const { d } = await scGet();
    const e = JSON.parse(JSON.stringify(d.einstellungen));
    e.sales.schwelle = 100; // höher als jede mögliche Summe (70)
    const r = await scPatch({ aktion: 'speichern', einstellungen: e, stand: d.stand });
    expect(r.status).toBe(200);
    expect((await speicher.ladeCrm()).scoring!.sales.schwelle).toBe(100);
    // alle Kernfragen „ja“ → mit Schwelle 28 wäre es SQL-bereit, mit 100 nicht
    await post({ aktion: 'setze', id: 'f-alpha', felder: { kriterien: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' } } });
    const z = await zeile('f-alpha');
    expect(z.score.scoring!.sales.erreicht).toBe(false);
    expect(ls.salesBereit(z)).toBe(false);
    expect(ls.fehltBisSqlZeile(z)[0]).toMatch(/^Punkte \(/);
    const alt = await scPatch({ aktion: 'speichern', einstellungen: e, stand: d.stand }); // der Stand von vorhin
    expect(alt.status).toBe(409);
    expect(alt.d.konflikt).toBe(true);
    expect(alt.d.einstellungen.sales.schwelle).toBe(100);
    expect(alt.d.stand).toBe(r.d.stand);
  });

  it('„Zurück“ legt die vorige Fassung wieder auf; danach merkt sich der Verlauf beide Schritte', async () => {
    const { d } = await scGet();
    expect(d.zurueckMoeglich).toBe(true);
    const r = await scPatch({ aktion: 'zurueck', stand: d.stand });
    expect(r.status).toBe(200);
    expect(r.d.einstellungen.sales.schwelle).toBe(28);
    expect((await scGet()).d.verlauf.map((v: { was: string }) => v.was)).toEqual(['Letzte Änderung zurückgenommen', 'Einstellungen geändert']);
  });

  it('Bisherige Rechnung wählen und auf Standard zurück — mit Quelle und Verlauf; der alte Aufruf „vorschlag“ ist ein Alias von „standard“', async () => {
    let { d } = await scGet();
    const v = await scPatch({ aktion: 'bisherig', stand: d.stand });
    expect(v.status).toBe(200);
    expect(v.d.einstellungen.quelle).toBe('bisherig');
    expect(v.d.einstellungen.sales.teile.map((t: { id: string }) => t.id)).toEqual(['fit', 'qualifizierung']);
    expect(v.d.einstellungen.marketing.schwelle).toBe(35);
    ({ d } = await scGet());
    const s = await scPatch({ aktion: 'standard', stand: d.stand });
    expect(s.status).toBe(200);
    expect(s.d.einstellungen.quelle).toBe('standard');
    expect(s.d.einstellungen.sales.teile.map((t: { id: string }) => t.id)).toEqual(['fit', 'qualifikation', 'potenzial']);
    ({ d } = await scGet());
    expect((await scGet()).d.verlauf.map((x: { was: string }) => x.was).slice(0, 2)).toEqual(['Auf Standard zurückgesetzt', 'Bisherige Rechnung (bis 03.10.) übernommen']);
    await scPatch({ aktion: 'bisherig', stand: d.stand });
    ({ d } = await scGet());
    const alias = await scPatch({ aktion: 'vorschlag', stand: d.stand });
    expect(alias.status).toBe(200);
    expect(alias.d.einstellungen.quelle).toBe('standard');
    // derselbe Auftrag noch einmal: nichts ändert sich, nichts wird neu protokolliert
    const n = (await scGet()).d.verlauf.length;
    ({ d } = await scGet());
    expect((await scPatch({ aktion: 'standard', stand: d.stand })).status).toBe(200);
    expect((await scGet()).d.verlauf.length).toBe(n);
  });

  it('ungültig → 400 mit Pfad je Fehler und NICHTS gespeichert; zu groß → 413; ohne Stand → 409', async () => {
    const { d } = await scGet();
    const kaputt = JSON.parse(JSON.stringify(d.einstellungen));
    kaputt.sales.teile[0].kriterien[0].stufen[0].punkte = 1000;
    kaputt.temperaturAb = { lau: 90, warm: 50, heiss: 10 };
    const r = await scPatch({ aktion: 'speichern', einstellungen: kaputt, stand: d.stand });
    expect(r.status).toBe(400);
    expect(r.d.felder.map((f: { pfad: string }) => f.pfad)).toEqual(expect.arrayContaining(['temperaturAb', 'sales.teile[0].kriterien[0].stufen[0].punkte']));
    expect((await scGet()).d.stand).toBe(d.stand);
    const gross = JSON.parse(JSON.stringify(d.einstellungen));
    gross.sales.teile[1].kriterien = Array.from({ length: 31 }, (_, i) => ({ ...gross.sales.teile[1].kriterien[0], id: `frage${i}` }));
    gross.sales.muss = [];
    expect((await scPatch({ aktion: 'speichern', einstellungen: gross, stand: d.stand })).status).toBe(413);
    expect((await scPatch({ aktion: 'speichern', einstellungen: d.einstellungen })).status).toBe(409);
    expect((await scPatch({ aktion: 'gibtsnicht', stand: d.stand })).status).toBe(400);
  });

  it('beschädigter Bestand → der Standard gilt, nichts stürzt ab', async () => {
    await db.saveJson('crm-scoring', { einstellungen: { marketing: 'kaputt' } });
    expect((await speicher.ladeCrm()).scoring).toEqual(sc.standardScoring());
    expect((await scGet()).d.einstellungen).toEqual(sc.standardScoring());
    await db.saveJson('crm-scoring', { version: 1, einstellungen: sc.standardScoring(), vorherige: [], verlauf: [] });
  });
});

describe('Lead — Stufen je Frage (Standard aktiv)', () => {
  beforeAll(async () => { const { d } = await scGet(); await scPatch({ aktion: 'standard', stand: d.stand }); });

  it('eine Stufe wählen schreibt die Stufe UND spiegelt das alte Feld; Fit-Stufe spiegelt `fit`', async () => {
    const r = await post({ aktion: 'setze', id: 'f-beta', felder: { stufen: { schmerz: 's5', entscheider: 's3', budget: 's0', fit: 'ja' } } });
    expect(r.status).toBe(200);
    const l = (await leadVon('f-beta'))!;
    expect(l.stufen).toEqual({ schmerz: 's5', entscheider: 's3', budget: 's0', fit: 'ja' });
    expect(l.kriterien).toMatchObject({ schmerz: 'ja', entscheider: 'ja', budget: 'nein' });
    expect(l.fit).toBe('ja');
    expect(l.qualifiziertAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const z = await zeile('f-beta');
    expect(z.score.scoring!.sales.teile.find(t => t.id === 'qualifikation')!.kriterien.find(c => c.id === 'schmerz')).toMatchObject({ punkte: 10, herkunft: 'lead' });
  });

  it('null nimmt die Antwort zurück (offen), ungültige Frage oder Stufe → 400, nichts geändert', async () => {
    const vor = await leadVon('f-beta');
    expect((await post({ aktion: 'setze', id: 'f-beta', felder: { stufen: { gibtsnicht: 's5' } } })).status).toBe(400);
    expect((await post({ aktion: 'setze', id: 'f-beta', felder: { stufen: { schmerz: 'ja' } } })).status).toBe(400); // „ja“ ist eine Stufe der bisherigen Rechnung, nicht des Standards
    expect(await leadVon('f-beta')).toEqual(vor);
    const r = await post({ aktion: 'setze', id: 'f-beta', felder: { stufen: { budget: null } } });
    expect(r.status).toBe(200);
    const l = (await leadVon('f-beta'))!;
    expect(l.stufen!.budget).toBeUndefined();
    expect(l.kriterien.budget).toBe('unklar');
  });

  it('Freitext-Antworten je beliebiger Frage; zu viele → 413 statt stilles Kürzen', async () => {
    expect((await post({ aktion: 'setze', id: 'f-beta', felder: { antworten: { champion: 'Frau Muster treibt es', schmerz: 'Angebote dauern zu lang' } } })).status).toBe(200);
    expect((await leadVon('f-beta'))!.antworten).toMatchObject({ champion: 'Frau Muster treibt es', schmerz: 'Angebote dauern zu lang' });
    const viele = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`frage${i}`, 'x']));
    expect((await post({ aktion: 'setze', id: 'f-beta', felder: { antworten: viele } })).status).toBe(413);
    expect((await post({ aktion: 'setze', id: 'f-beta', felder: { antworten: { schmerz: 'x'.repeat(1001) } } })).status).toBe(413);
  });

  it('SQL: die Schwelle und die Muss-Kriterien der Einstellungen entscheiden (ohne „trotzdem“ → 400 mit „fehlt“)', async () => {
    const r = await post({ aktion: 'sql', id: 'f-beta', deal: { titel: 'Test', schritt: { text: 'Anrufen', datum: '2099-01-01' } } });
    expect(r.status).toBe(400);
    expect(r.d.fehlt.length).toBeGreaterThan(0);
    expect(r.d.fehler).toContain('Noch kein SQL');
  });
});

describe('Lead — Parken, Raus, Abgeben', () => {
  it('Parken: Status ruht, Wiedervorlage, Grund-Art und ein Follow-up; vergangenes Datum → 400', async () => {
    expect((await post({ aktion: 'parken', id: 'f-alpha', bis: '2020-01-01' })).status).toBe(400);
    const r = await post({ aktion: 'parken', id: 'f-alpha', bis: '2099-03-01', grundArt: 'budget_spaeter', grund: 'Budget kommt im Frühjahr' });
    expect(r.status).toBe(200);
    expect(r.d.followup).toBe(true);
    const l = (await leadVon('f-alpha'))!;
    expect(l).toMatchObject({ status: 'ruht', wiedervorlage: '2099-03-01', grundArt: 'budget_spaeter', grund: 'Budget kommt im Frühjahr' });
    expect(((await speicher.ladeCrm()).followups ?? []).some(f => f.bezug.id === 'f-alpha' && f.faellig === '2099-03-01')).toBe(true);
    // ruht → nicht in der Runde, bis der Tag da ist
    const z = await zeile('f-alpha');
    expect(ls.brauchtQualifizierung(z, '2026-10-03')).toBe(false);
    expect(ls.brauchtQualifizierung(z, '2099-03-01')).toBe(true);
  });

  it('Wieder aktiv setzen räumt Wiedervorlage und Grund-Art weg', async () => {
    await post({ aktion: 'setze', id: 'f-alpha', felder: { status: 'qualifizierung' } });
    const l = (await leadVon('f-alpha'))!;
    expect(l.status).toBe('qualifizierung');
    expect(l.wiedervorlage).toBeUndefined();
    expect(l.grundArt).toBeUndefined();
  });

  it('Raus: Grund aus der Liste ist Pflicht; steht in der Auswertung', async () => {
    expect((await post({ aktion: 'raus', id: 'f-beta' })).status).toBe(400);
    expect((await post({ aktion: 'raus', id: 'f-beta', grundArt: 'spaeter' })).status).toBe(400); // „spaeter“ ist ein Park-Grund
    const r = await post({ aktion: 'raus', id: 'f-beta', grundArt: 'zu_klein', grund: 'Nur zwei Personen' });
    expect(r.status).toBe(200);
    expect(await leadVon('f-beta')).toMatchObject({ status: 'kein_fit', grundArt: 'zu_klein' });
    const { leadGruende } = await import('@/lib/crm/lead-grund');
    const g = leadGruende((await post({ aktion: 'setze', id: 'f-beta', felder: {} }), (await ls.leads((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte, await speicher.ladeCrm(), '2026-10-03'))));
    expect(g.ausgeschieden).toEqual([expect.objectContaining({ art: 'zu_klein', anzahl: 1 })]);
  });

  it('Parken/Raus an einem Lead mit offenem Deal → 409', async () => {
    const c = await speicher.ladeCrm();
    await db.saveJson('crm', { ...c, scoring: undefined, chancen: [{ id: 'ch-x', titel: 'Läuft', kontaktIds: ['c-cora1'], firmaId: 'f-beta', stufe: 'bedarf', art: 'retainer', wert: { betrag: 0, basis: 'monat' }, naechsterSchritt: { text: 'x', datum: '2099-01-01' }, qualifizierung: {}, historie: [], erstellt: '2026-09-01', geaendert: '2026-09-01' }] });
    expect((await post({ aktion: 'parken', id: 'f-beta', bis: '2099-01-01' })).status).toBe(409);
    expect((await post({ aktion: 'raus', id: 'f-beta', grundArt: 'zu_klein' })).status).toBe(409);
    await db.saveJson('crm', { ...c, scoring: undefined });
  });

  it('Abgeben: alle Personen gehen an die andere Person, im Verlauf steht die Übergabe', async () => {
    const r = await post({ aktion: 'abgeben', id: 'f-alpha', an: 'malin', notiz: 'Malin kennt den Chef' });
    expect(r.status).toBe(200);
    const kont = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(kont.filter(x => x.firmaId === 'f-alpha').map(x => x.besitzer)).toEqual(['malin', 'malin']);
    expect(kont.find(x => x.id === 'c-anna1')!.aktivitaeten.some(a => a.art === 'uebergabe' && /malin/i.test(a.text ?? ''))).toBe(true);
    expect((await post({ aktion: 'abgeben', id: 'f-alpha', an: 'beide' })).status).toBe(400);
  });

  it('Die neuen Schreib-Aktionen gehen nie über den Dienstweg (403) — Lesen und Setzen wie bisher', async () => {
    for (const a of [{ aktion: 'parken', id: 'f-alpha', bis: '2099-01-01' }, { aktion: 'raus', id: 'f-alpha', grundArt: 'zu_klein' }, { aktion: 'abgeben', id: 'f-alpha', an: 'kevin' }, { aktion: 'firma-folgen', personIds: ['c-anna1'], nach: 'f-beta', leadMit: true, dealsMit: true }, { aktion: 'firmen-zusammen', behalten: 'f-alpha', weg: 'f-leer' }]) {
      expect((await post(a, null)).status, a.aktion).toBe(403);
    }
    expect((await post({ aktion: 'setze', id: 'f-alpha', felder: { notiz: 'Dienst darf Notizen setzen' } }, null)).status).toBe(200);
  });
});
