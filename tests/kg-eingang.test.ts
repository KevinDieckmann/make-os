// ─── Kundengewinnung — Prüfung A „Eingänge und Datenbasis“ (02.11.): je Fund mindestens ein Fall ─────────────────────────────────────────
// Kevin: „Im Thema Kundengewinnung soll nichts dem Zufall überlassen werden.“ Eigener Datenordner, Datenschlüssel und Pepper, Konten mit
// Test-Haushalt, erfundene Daten (@example.invalid). Kein Netz, keine Mail (Website-Absender gibt es hier nicht), kein Modell.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-kg-eingang-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-kg-eingang';
process.env.SESSION_SECRET = 'pruef-sitzung-kg-eingang-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-kg-eingang';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-kg-eingang-0123456789abcdef';
delete process.env.MAKE_OS_ADRESSE;

type Meldung = { art: string; titel: string; link: string; bezug?: { art: string; id: string }; gelesen?: boolean };
let db: typeof import('@/lib/store/local-db');
let A: typeof import('@/lib/store/absichten');
let F: typeof import('@/lib/store/absichten-fortsetzen');
let AA: typeof import('@/lib/crm/anfrage-anlegen');
let AN: typeof import('@/lib/crm/anfragen');
const HAUS = 'test-haus';
const D = 'example.invalid';
const T0 = new Date('2026-11-03T09:00:00Z');
let uhr = T0.getTime();
const weiter = (min: number) => { uhr += min * 60_000; vi.setSystemTime(new Date(uhr)); };
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const crm = async () => (await db.loadJson<CrmBestand>('crm'))!;
const glocke = async (wer: string) => (await db.loadJson<{ eintraege: Meldung[] }>(`meldungen--${wer}`))?.eintraege ?? [];
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Muster ${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const sitzung = (wer = 'kevin') => ({ 'content-type': 'application/json', 'x-make-user': wer });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Testa Partnerin', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    k('c-eng', { email: `eng@${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
    k('c-bestand', { email: `bestand@${D}` }),
  ] });
  await db.saveJson('crm', { firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], followups: [], angebote: [],
    kampagnen: [{ id: 'kp-probe', name: 'Probe-Kampagne', playbook: 'eigen', ziel: '', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: [], ergebnisse: [], geaendert: T0.toISOString() }] });
  A = await import('@/lib/store/absichten');
  F = await import('@/lib/store/absichten-fortsetzen');
  AA = await import('@/lib/crm/anfrage-anlegen');
  AN = await import('@/lib/crm/anfragen');
});
afterEach(() => { A.absichtTest.vorAbhaken = null; A.absichtTest.nachAbhaken = null; A.absichtTest.vorSchritt = null; });
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

// ── Fund 1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 1 — Terminanfrage verfällt nicht still', () => {
  it('erinnert nach 24 h bzw. kurz vor dem Termin (abgeleitet, ohne Namen)', async () => {
    const B = await import('@/lib/kalender/buchung');
    const R = await import('@/lib/meldungen/regeln');
    const jetzt = new Date('2026-11-03T09:00:00Z'); // 10:00 Berlin
    expect(B.anfrageWartet('2026-11-02T08:00:00Z', '2026-11-10T10:00:00', jetzt)).toEqual({ lange: true, bald: false });
    expect(B.anfrageWartet('2026-11-03T08:00:00Z', '2026-11-04T09:00:00', jetzt)).toEqual({ lange: false, bald: true });
    expect(B.anfrageWartet('2026-11-01T08:00:00Z', '2026-11-03T09:00:00', jetzt)).toEqual({ lange: false, bald: false }); // schon begonnen
    const m = R.anstehendAbleiten({ termine: [], nachbereiten: [], fristen: [], followups: [], buchungen: [
      { id: 'b1', titel: 'Erstgespräch', start: '2026-11-04T09:00:00', href: '/os/kalender?buchungen=1', bald: true },
      { id: 'b2', titel: 'Erstgespräch', start: '2026-11-10T10:00:00', href: '/os/kalender?buchungen=1', lange: true },
      { id: 'b3', titel: 'Erstgespräch', start: '2026-11-10T11:00:00', href: '/os/kalender?buchungen=1' },
    ] }, { heute: '2026-11-03', jetztWand: '2026-11-03T10:00:00', am: jetzt.toISOString() });
    expect(m.map(x => x.titel)).toEqual([
      'Terminanfrage „Erstgespräch“ am 04.11. 09:00 noch nicht beantwortet — der Termin ist in unter 24 Stunden',
      'Terminanfrage „Erstgespräch“ (10.11. 10:00) wartet seit über 24 Stunden auf deine Entscheidung',
    ]);
    expect(m.every(x => x.business)).toBe(true);
  });
  it('verfallen ohne Reaktion → genau EINE Glocke an die Person der Seite (zweiter Lauf: nichts)', async () => {
    const S = await import('@/lib/kalender/buchung-speicher');
    const h = await S.buchungHaushalt();
    const b = { id: 'bu-verfall', seiteId: 's1', start: '2026-11-02T10:00:00', ende: '2026-11-02T10:30:00', status: 'angefragt', name: 'Gast Probe', email: `gast@${D}`,
      einwilligung: { wortlaut: 'x', version: '1', am: '2026-11-01T08:00:00Z' }, tokenHash: 'x', angelegt: '2026-11-01T08:00:00Z', reserviertBis: '2026-11-01T08:30:00Z', statusAm: '2026-11-01T08:10:00Z', angefragtAm: '2026-11-01T08:10:00Z' };
    await db.saveJson(`buchung--${h}`, { seiten: [{ id: 's1', person: 'kevin', titel: 'Erstgespräch' }], buchungen: [b] });
    expect(await S.buchungenVerfallenMelden(new Date(uhr))).toBe(1);
    expect(await S.buchungenVerfallenMelden(new Date(uhr))).toBe(0);
    const g = (await glocke('kevin')).filter(x => /verfallen, ohne Reaktion/.test(x.titel));
    expect(g).toHaveLength(1);
    expect(g[0].titel).not.toContain('Gast');
    const nach = (await db.loadJson<{ buchungen: { status: string; verfallen?: true; verfallGemeldet?: string }[] }>(`buchung--${h}`))!.buchungen[0];
    expect(nach).toMatchObject({ status: 'abgelaufen', verfallen: true });
    expect(nach.verfallGemeldet).toBeTruthy();
  });
});

// ── Fund 2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Fund 2 — Anfrage als Absicht (Abbruch nach jedem Schritt)', () => {
  const lauf = async (email: string) => AA.anfrageAnlegen({ neu: { vorname: 'Anna', nachname: 'Abbruch', email, firma: 'Abbruch Probe GmbH' }, kanal: 'website', text: 'Bitte um ein Gespräch.' }, { person: 'kevin', wer: { art: 'system' } });
  const endstand = async (email: string) => {
    const p = (await kontakte()).filter(x => x.email === email);
    const c = await crm();
    return { personen: p.length, anfragen: p[0]?.aktivitaeten.filter(a => (a.text ?? '').startsWith('Anfrage über Website')).length, followups: c.followups.filter(f => f.kontaktId === p[0]?.id && f.text.startsWith('Anfrage beantworten')).length, firma: !!p[0]?.firmaId };
  };
  for (const schritt of AA_SCHRITTE()) for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
    it(`Abbruch ${wann === 'vorAbhaken' ? 'vor' : 'nach'} dem Abhaken von „${schritt}“ → die Wiederaufnahme ergibt denselben Endstand`, async () => {
      const email = `abbruch-${schritt}-${wann.toLowerCase()}@${D}`;
      let einmal = true;
      A.absichtTest[wann] = (art, s) => { if (art === 'anfrage' && s === schritt && einmal) { einmal = false; throw new A.TestAbbruch(s); } };
      await expect(lauf(email)).rejects.toThrow(/Testabbruch/);
      A.absichtTest[wann] = null;
      const fr = await F.offeneFertigstellen();
      expect(fr.fehler).toEqual([]);
      expect(await endstand(email)).toEqual({ personen: 1, anfragen: 1, followups: 1, firma: true });
      expect((await A.absichtenLaden(HAUS)).filter(x => x.art === 'anfrage' && A.istOffen(x))).toHaveLength(0);
    });
  }
  it('ohne Abbruch: dieselbe Form; Liste „offen“ ohne Follow-up gilt nie als beantwortet', async () => {
    const email = `glatt@${D}`;
    const r0 = await lauf(email);
    expect(r0.ok ? 'ok' : r0.fehler).toBe('ok');
    expect(await endstand(email)).toEqual({ personen: 1, anfragen: 1, followups: 1, firma: true });
    const p = (await kontakte()).find(x => x.email === email)!;
    const c = await crm();
    const ohne = { ...c, followups: c.followups.filter(f => f.kontaktId !== p.id) };
    expect(AN.anfragenListe([p], ohne, '2026-11-03').every(z => z.offen)).toBe(true);
  });
});
function AA_SCHRITTE(): readonly string[] { return ['firma', 'kartei', 'crm', 'ereignis']; }

// ── Fund 3 / 9 / 5 (Check) ────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Check: Fehler melden und nachholen (3), Herkunft → Kampagne (9), Art. 18 → Antrag (5)', () => {
  const sitzungVon = (id: string, email: string, x: Record<string, unknown> = {}) => ({ id, vorlage: 'gibt-es-nicht', tokenHash: 'x', gestartet: T0.toISOString(), geaendert: T0.toISOString(), antworten: {}, uebersprungen: [], kontaktStand: 'erfasst',
    kontakt: { vorname: 'Chris', email, firma: 'Check Probe GmbH', newsletterWunsch: false, hinweisFassung: '1', am: T0.toISOString() }, anfrageIds: { kontakt: `c-${id.slice(3)}-k`, followUp: `fu-${id.slice(3)}` }, ...x });
  it('Lead mit „fehler“ holt der Morgenlauf nach — mit den festen Kennungen der Sitzung, nur einmal', async () => {
    await db.saveJson('check-sitzungen', { sitzungen: [sitzungVon('ck-nachholen-0001', `check.nach@${D}`, { crm: { status: 'fehler', am: T0.toISOString(), grund: 'Probe' } })] });
    weiter(15);
    const E = await import('@/lib/oeffentlich/eingang-server');
    const lage = await E.websiteEingangLage(new Date(uhr));
    expect(lage.ohneCrm).toBe(1);
    const r = await E.websiteEingaengeNachholen(new Date(uhr));
    expect(r.nachgeholt).toBeGreaterThanOrEqual(1);
    const s = (await db.loadJson<{ sitzungen: { crm?: { status: string; followUpId?: string } }[] }>('check-sitzungen'))!.sitzungen[0];
    expect(s.crm).toMatchObject({ status: 'ok', followUpId: 'fu-nachholen-0001' });
    await E.websiteEingaengeNachholen(new Date(uhr));
    expect((await kontakte()).filter(x => x.email === `check.nach@${D}`)).toHaveLength(1);
    expect((await crm()).followups.filter(f => f.id === 'fu-nachholen-0001')).toHaveLength(1);
    expect((await E.websiteEingangLage(new Date(uhr))).ohneCrm).toBe(0);
  });
  it('Herkunft = bekannte Kampagne → „reagiert“ an der Kampagne; unbekannte Herkunft steht nur im Text', async () => {
    const C = await import('@/lib/check/server');
    const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
    const e = await ladeCheckEinstellungen();
    const r1 = await C.leadAnlegen(sitzungVon('ck-kampagne-0001', `check.kamp@${D}`, { quelle: 'kp-probe' }) as never, e, 'Check auf der Website: Kurzcheck ausgefüllt.');
    expect(r1?.status).toBe('ok');
    const kp = (await crm()).kampagnen.find(x => x.id === 'kp-probe')!;
    expect(kp.ergebnisse.some(x => x.kontaktId === r1!.kontaktId && x.ergebnis === 'reagiert')).toBe(true);
    const r2 = await C.leadAnlegen(sitzungVon('ck-quelle-00001', `check.quelle@${D}`, { quelle: 'homepage_hero' }) as never, e, 'Check auf der Website: Kurzcheck ausgefüllt.');
    const p = (await kontakte()).find(x => x.id === r2!.kontaktId)!;
    expect(p.aktivitaeten.some(a => (a.text ?? '').includes('Herkunft: homepage_hero'))).toBe(true);
  });
  it('eingeschränkte Person (Art. 18): keine Verarbeitung, aber ein Betroffenenantrag + Glocke an den Inhaber', async () => {
    const C = await import('@/lib/check/server');
    const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
    const r = await C.leadAnlegen(sitzungVon('ck-eng-0000001', `eng@${D}`) as never, await ladeCheckEinstellungen(), 'Check auf der Website: Kurzcheck ausgefüllt.');
    expect(r).toMatchObject({ status: 'abgelehnt', eingeschraenkt: true });
    expect((await kontakte()).find(x => x.id === 'c-eng')!.aktivitaeten).toHaveLength(0);
    const a = (await crm()).antraege.filter(x => x.kontaktId === 'c-eng');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ art: 'einschraenkung', status: 'offen' });
    expect(a[0].nachricht).toContain('Kurzcheck');
    const g = (await glocke('kevin')).filter(x => x.art === 'sicherheit');
    expect(g.at(-1)?.titel).toBe('Nachricht einer eingeschränkten Person — unter Datenschutz prüfen');
  });
  it('EINE neutrale Glocke an die Marketing-Verantwortliche (Rückfall Inhaber), ohne Namen — eine ungelesene je Anlass', async () => {
    const E = await import('@/lib/oeffentlich/eingang-server');
    await E.websiteHinweisMelden('eingang');
    await E.websiteHinweisMelden('eingang');
    const alle = [...await glocke('kevin'), ...await glocke('malin')].filter(x => x.bezug?.id === 'website-eingang-eingang' && !x.gelesen);
    expect(alle).toHaveLength(1);
    expect(alle[0].titel).not.toMatch(/@|Chris|Probe/);
  });
  it('Head of IT: Befund nur mit Zahlen', async () => {
    const { websiteEingangBefunde } = await import('@/lib/hoi/lage');
    expect(websiteEingangBefunde({ ohneCrm: 0, wartend: 0, gescheitert: 0 })).toEqual([]);
    expect(websiteEingangBefunde({ ohneCrm: 2, wartend: 1, gescheitert: 0 })[0]).toMatchObject({ id: 'website-eingang', ampel: 'rot', wert: '2 ohne CRM · 1 wartend' });
    expect(websiteEingangBefunde({ ohneCrm: 0, wartend: 3, gescheitert: 0 })[0].ampel).toBe('gelb');
  });
});

// ── Fund 7 / 10 / 4 / 5 (Unterlage, Newsletter) ───────────────────────────────────────────────────────────────────────────────────
describe('Eingangszeile vor der Antwort (7), Unterlage ohne Absender (10)', () => {
  it('Zeile steht fest, bevor gearbeitet wird; ein abgebrochener Lauf wird im Takt nachgeholt, danach ohne Daten', async () => {
    const E = await import('@/lib/oeffentlich/eingang-server');
    const id = await E.eingangFesthalten('newsletter', { email: `nl.zeile@${D}`, vorname: 'Nele' }, new Date(uhr));
    const zeile = async () => (await db.loadJson<{ eintraege: { id: string; status: string; daten?: unknown }[] }>('website-eingang'))!.eintraege.find(x => x.id === id)!;
    expect(await zeile()).toMatchObject({ status: 'offen' });
    expect((await zeile()).daten).toBeTruthy();
    // Kein Lauf nach der Antwort (Neustart) — der Takt holt nach der Wartezeit nach (Newsletter hier aus: die Zeile ist trotzdem erledigt).
    weiter(3);
    await E.eingaengeImTakt(new Date(uhr));
    const z = await zeile();
    expect(z.status).toBe('fertig');
    expect(z.daten).toBeUndefined();
  });
  it('Unterlage ohne Website-Absender: keine Mail, aber die Anfrage mit Vermerk und Glocke „nicht verschickt“; vorhandene Person nur „Adresse unbestätigt“ (4)', async () => {
    const U = await import('@/lib/unterlagen/server');
    const u = { id: 'probe-heft', titel: 'Probe-Heft', seite: '/kostenlos/probe/', dateien: [{ art: 'pdf' as const, datei: 'probe.pdf', name: 'Probe.pdf' }] };
    expect(await U.anforderungVerarbeiten({ email: `ohne.absender@${D}`, vorname: 'Olga', firma: '', newsletter: false }, u as never, null, new Date(uhr))).toBe('ohneAbsender');
    const p = (await kontakte()).find(x => x.email === `ohne.absender@${D}`)!;
    expect(p.aktivitaeten.some(a => /kein Website-Absender eingerichtet/.test(a.text ?? ''))).toBe(true);
    expect([...await glocke('kevin'), ...await glocke('malin')].some(x => x.bezug?.id === 'website-eingang-unterlage')).toBe(true);
    // Vorhandene Person: öffentliche Strecke → nur ein Vermerk, keine Einwilligung.
    await U.anforderungVerarbeiten({ email: `bestand@${D}`, vorname: 'Vera', firma: '', newsletter: false }, u as never, null, new Date(uhr));
    const b = (await kontakte()).find(x => x.id === 'c-bestand')!;
    expect(b.aktivitaeten.some(a => a.art === 'system' && (a.text ?? '').startsWith('Anfrage (Adresse unbestätigt) über Website'))).toBe(true);
    expect(b.einwilligungen ?? []).toHaveLength(0);
  });
});

// ── Fund 6 / 12 (Route /api/crm/anfrage) ──────────────────────────────────────────────────────────────────────────────────────────
describe('Route /api/crm/anfrage: anfrageId (12) und Social nur einmal (6)', () => {
  let route: { POST: (r: Request) => Promise<Response> };
  beforeAll(async () => { route = await import('@/app/api/crm/anfrage/route') as never; });
  const post = async (body: Record<string, unknown>) => { const r = await route.POST(new Request('http://test/api/crm/anfrage', { method: 'POST', headers: sitzung(), body: JSON.stringify(body) })); return { status: r.status, d: await r.json() as Record<string, unknown> }; };
  it('dieselbe anfrageId zweimal → dieselbe Antwort, nichts doppelt', async () => {
    const body = { aktion: 'anlegen', anfrageId: 'anf-probe-doppel-1', kanal: 'mail', text: 'Bitte um Angebot.', neu: { vorname: 'Doris', nachname: 'Doppel', email: `doppel@${D}` } };
    const a = await post(body), b = await post(body);
    expect(a.status).toBe(200);
    expect(b.d.followUpId).toBe(a.d.followUpId);
    expect((await kontakte()).filter(x => x.email === `doppel@${D}`)).toHaveLength(1);
    expect((await crm()).followups.filter(f => f.id === a.d.followUpId)).toHaveLength(1);
  });
  it('Instagram-Eintrag: die Akte steht am Faden, ein zweiter Klick legt nichts an; fremder Eintrag → 404', async () => {
    const { communitySpeicher } = await import('@/lib/social/community');
    await db.saveJson(await communitySpeicher(), { eintraege: { 'ig-1': { id: 'ig-1', art: 'dm', kanalId: 'kanal-1', richtung: 'ein', gegen: { id: 'g1', name: 'probe_handle' }, text: 'Was kostet das?', am: T0.toISOString() } }, faeden: {}, abgeholt: {} });
    const body = (x: Record<string, unknown> = {}) => ({ aktion: 'anlegen', kanal: 'instagram', social: { faden: 'dm~kanal-1~g1', eintrag: 'ig-1' }, text: 'Instagram-Direktnachricht von @probe_handle: Was kostet das?', neu: { vorname: 'Ines' }, ...x });
    const a = await post(body({ anfrageId: 'anf-social-1-aaaa' }));
    expect(a.status).toBe(200);
    const b = await post(body({ anfrageId: 'anf-social-2-bbbb' }));
    expect(b.d).toMatchObject({ ok: true, schon: true, kontaktId: a.d.kontaktId });
    expect((await kontakte()).filter(x => x.vorname === 'Ines')).toHaveLength(1);
    const { ladeCommunity, faedenAus } = await import('@/lib/social/community');
    expect(faedenAus(await ladeCommunity(), new Set(['kanal-1']))[0].anfragen?.['ig-1']?.kontaktId).toBe(a.d.kontaktId);
    expect((await post(body({ social: { faden: 'dm~kanal-1~g1', eintrag: 'gibt-es-nicht' } }))).status).toBe(404);
  });
});

// ── Fund 13 / 14 (rein bzw. Anfrage-Weg) ──────────────────────────────────────────────────────────────────────────────────────────
describe('Anfrage übernehmen ohne Kürzen (13), Empfehlung (14)', () => {
  it('„Anfrage übernehmen“ nimmt den vollen Text aus dem Vermerk (2.500 Zeichen, nicht 1.000)', async () => {
    const lang = `Langer Text ${'x'.repeat(2480)}`;
    const r = await AA.anfrageAnlegen({ neu: { vorname: 'Vera', email: `bestand@${D}` }, kanal: 'website', text: lang }, { person: 'kevin', wer: { art: 'system' }, oeffentlich: true });
    expect(r.ok && r.bau.unbestaetigt).toBe(true);
    const fuId = r.ok ? r.bau.followUp.id : '';
    expect(((await crm()).followups.find(f => f.id === fuId)?.notiz ?? '').length).toBeLessThanOrEqual(1000);
    weiter(1);
    const u = await AA.anfrageUebernehmen(fuId, { person: 'kevin', wer: { art: 'person', person: 'kevin' } });
    expect(u.ok ? 'ok' : u.fehler).toBe('ok');
    const akt = (await kontakte()).find(x => x.id === 'c-bestand')!.aktivitaeten.filter(a => (a.text ?? '').startsWith('Anfrage über Website: Langer Text'));
    expect(akt).toHaveLength(1);
    expect(akt[0].text).toContain(lang);
  });
  it('Kanal „Empfehlung“: Herkunft Empfehlung (fremd → Art.-14-Uhr), nicht „selbst“', () => {
    const r = AN.anfrageBauen({ neu: { vorname: 'Emil', nachname: 'Empfohlen', email: `emil@${D}` }, kanal: 'empfehlung', text: 'Kam über eine Empfehlung.' },
      { kontakte: [], crm: { firmen: [], chancen: [], kampagnen: [], beitraege: [], events: [] } as never, person: 'kevin', heute: '2026-11-03', jetzt: T0.toISOString(), ids: { kontakt: 'c-emil-0001', followUp: 'fu-emil-0001' } });
    expect(r.ok && r.bau.kontakt).toMatchObject({ herkunft: 'empfehlung', fremddaten: true });
    const w = AN.anfrageBauen({ neu: { vorname: 'Wera', email: `wera@${D}` }, kanal: 'website', text: 'Über die Website.' },
      { kontakte: [], crm: { firmen: [], chancen: [], kampagnen: [], beitraege: [], events: [] } as never, person: 'kevin', heute: '2026-11-03', jetzt: T0.toISOString(), ids: { kontakt: 'c-wera-0001', followUp: 'fu-wera-0001' } });
    expect(w.ok && w.bau.kontakt.herkunft).toBe('selbst');
  });
});

// ── Fund 11 (Bestellung) ──────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Bestellung: nachholen (3) und Follow-up schließen (11)', () => {
  it('ohne Vorbereitung → der Morgenlauf legt die Anfrage an, die Glocke kommt genau einmal; Ablehnen schließt „Anfrage beantworten“', async () => {
    const BS = await import('@/lib/bausteine/server');
    await db.saveJson('baustein-bestellungen', { bestellungen: [{ id: 'bb-probe-0001', am: new Date(uhr - 20 * 60_000).toISOString(), bausteinId: 'probe', titel: 'Probe-Baustein', preisCent: 1000, ustSatz: 19, teile: ['probe'],
      besteller: { vorname: 'Bert', nachname: 'Besteller', firma: 'Bestell Probe GmbH', email: `bert@${D}`, strasse: 'Probeweg 1', plz: '12345', ort: 'Probestadt', land: 'DE' }, unternehmer: true, bedingungen: { fassung: '1', am: T0.toISOString() }, status: 'neu',
      anfrageIds: { kontakt: 'c-bert-0000001', followUp: 'fu-bert-0000001' } }] });
    await BS.bestellungenNachholen(new Date(uhr));
    await BS.bestellungenNachholen(new Date(uhr));
    const b = (await BS.bestellungenLaden())[0];
    expect(b.kontaktId).toBeTruthy();
    expect(b.followUpId).toBe('fu-bert-0000001');
    expect([...await glocke('kevin')].filter(x => x.titel.startsWith('Neue Baustein-Bestellung'))).toHaveLength(1);
    expect((await crm()).followups.find(f => f.id === 'fu-bert-0000001')?.status).toBe('offen');
    await BS.bestellungAblehnen({ id: 'bb-probe-0001', person: 'kevin', wer: { art: 'person', person: 'kevin' }, jetzt: new Date(uhr) });
    expect((await crm()).followups.find(f => f.id === 'fu-bert-0000001')?.status).toBe('erledigt');
  });
});
