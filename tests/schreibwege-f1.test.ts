// ─── Prüfbericht 28.09., Paket F1 — Schreibwege repariert ──────────────────
// Jeder Befund mit einem Test, der ohne die Reparatur rot wäre. Eigener Datenordner,
// Dienstaufruf per Schlüssel (mit bzw. ohne ausdrückliche Person) — nie der echte
// Bestand. Alle Namen und Firmen sind erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, Firma, Mandat, Teilnahme } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-28-09-f1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const H = new Date().toISOString().slice(0, 10);
const JETZT = new Date().toISOString();
const kopf = (person: string | null) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const req = (url: string, body?: unknown, method = 'POST', person: string | null = 'kevin') => new Request(`http://test${url}`, { method, headers: kopf(person), ...(body ? { body: JSON.stringify(body) } : {}) });

type Route = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response>; PATCH?: (r: Request) => Promise<Response> };
let kontakte: Route, bestand: Route, akt: Route, netzwerk: Route, lead: Route, einheitenPlanung: Route, zeitEinheiten: Route, kontaktFrage: Route;
let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
let crmLib: typeof import('@/lib/make-one/crm');
let firmenLib: typeof import('@/lib/crm/firmen');

const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-28', geaendertAm: '2026-08-28', ...x });
const gespeichert = async (id: string) => ((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(k => k.id === id)!;
const ladeKontakte = async (p: string | null) => ((await (await kontakte.GET!(req('/api/state/kontakte?voll=1', undefined, 'GET', p))).json()) as { kontakte: (Kontakt & { stand: string })[] }).kontakte;
const teil = (id: string, felder: Record<string, unknown>, p: string | null = 'kevin') => kontakte.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'teil', id, felder }] }, 'PATCH', p));
const crmPatch = (ops: unknown[]) => bestand.PATCH!(req('/api/crm/bestand', { ops }, 'PATCH'));

const CHANCE = (x: Partial<Chance>): Chance => ({
  id: 'ch-gewonnen', titel: 'Retainer Beispiel', kontaktIds: [], art: 'retainer', wert: { betrag: 3000, basis: 'monat' }, stufe: 'gewonnen',
  historie: [{ stufe: 'gewonnen', am: JETZT, von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: JETZT, geaendert: JETZT, ...x,
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
  crmLib = await import('@/lib/make-one/crm');
  firmenLib = await import('@/lib/crm/firmen');
  kontakte = (await import('@/app/api/state/kontakte/route')) as unknown as Route;
  bestand = (await import('@/app/api/crm/bestand/route')) as unknown as Route;
  akt = (await import('@/app/api/crm/aktivitaet/route')) as unknown as Route;
  netzwerk = (await import('@/app/api/crm/netzwerk/route')) as unknown as Route;
  lead = (await import('@/app/api/crm/lead/route')) as unknown as Route;
  einheitenPlanung = (await import('@/app/api/planung/einheiten/route')) as unknown as Route;
  zeitEinheiten = (await import('@/app/api/state/zeit/einheiten/route')) as unknown as Route;
  kontaktFrage = (await import('@/app/api/crm/kontakt-frage/route')) as unknown as Route;
  // Kartei nur für den Haushalt des Inhabers (28.09., K1 #66/#67): erfundene Konten im selben Haushalt.
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@test.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
    { id: 'k2', speicher: 'malin', email: 'm@test.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    person('c-leeren', {
      firma: 'Beispiel Werke GmbH', firmaId: 'f-beispielwerke-abc', naechsterSchritt: { text: 'Angebot nachfassen', datum: H }, bean: 'A', kreis: 'B', anrede: 'Du',
      lebensphase: 'interessent', besitzer: 'malin', privatNotiz: 'nur für Kevin', privatNotizVon: 'kevin', herkunft: 'recherche', fremddaten: true,
      werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' }, vonHand: [],
    }),
    person('c-meeting', { stufe: 'angesprochen', letzterKontakt: '2026-09-01', wiedervorlage: '2026-10-15', kreis: 'A' }),
    person('c-linkedin', { vorname: 'Bert', nachname: 'Muster', vonHand: [] }),
    person('c-linkedin2', { vorname: 'Carla', nachname: 'Probe', vonHand: [] }),
    person('c-kunde-sql', { vorname: 'Dora', phase: 'sql' }),
    person('c-kunde-ohne', { vorname: 'Emil' }),
    person('c-kunde-follow', { vorname: 'Frida', phase: 'follow_up' }),
    person('c-privat', { vorname: 'Gerd', privatNotiz: 'Kevins Notiz', privatNotizVon: 'kevin' }),
  ] });
  const muster: Firma = {
    id: firmenLib.firmenId('Muster'), name: 'Muster', rolle: 'kunde', rolleVonHand: true, domain: 'muster.example', branchen: ['Handel'], notiz: 'Stammkunde', bean: 'B',
    lead: { status: 'qualifizierung', kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'ja', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, antworten: { schmerz: 'Liquidität' } },
    zahlung: { weg: 'ueberweisung', zielTage: 30 }, geaendert: JETZT,
  };
  const teilnahme: Teilnahme = { id: 't-gast', eventId: 'ev-abend', kontaktId: 'c-meeting', status: 'da', nachfassenVerzichtet: H, geaendert: JETZT };
  const mandatVorlage: Pick<CrmBestand, 'chancen' | 'mandate'> = {
    chancen: [CHANCE({ kontaktIds: ['c-kunde-sql', 'c-kunde-ohne', 'c-kunde-follow'] }), CHANCE({ id: 'ch-uebergabe', titel: 'Übergabe-Deal', stufe: 'bedarf', historie: [{ stufe: 'bedarf', am: JETZT, von: 'kevin' }] })],
    mandate: [] as Mandat[],
  };
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [muster], teilnahmen: [teilnahme], ...mandatVorlage });
}, 120_000); // viele Routen zu laden — auf einem ausgelasteten Rechner dauert das
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('1 · kontaktTeil leert Felder (null = entfernen)', () => {
  it('die Route leert jedes Feld, das die Oberfläche auf „leer“ setzt (undefined → null → entfernt)', async () => {
    // Genau der Weg der Oberfläche: `kontaktTeil` schickt `leerAlsNull(felder)` — vorher verwarf JSON die undefined-Schlüssel.
    const { leerAlsNull } = await import('@/components/os/crm/daten');
    const r = await teil('c-leeren', JSON.parse(JSON.stringify(leerAlsNull({
      naechsterSchritt: undefined, firmaId: undefined, firma: undefined, bean: undefined, kreis: undefined, anrede: undefined, lebensphase: undefined, besitzer: undefined,
      privatNotiz: undefined, fremddaten: undefined,
    }))));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-leeren');
    for (const f of ['naechsterSchritt', 'firmaId', 'firma', 'bean', 'kreis', 'anrede', 'lebensphase', 'besitzer', 'privatNotiz', 'privatNotizVon', 'fremddaten'] as const) expect(k[f], f).toBeUndefined();
    // K2 #64: die Werbesperre leert ein `null` allein NICHT mehr — nur zusammen mit neuer Einwilligung samt Nachweis (tests/crm-k2-routen.test.ts).
    expect((await teil('c-leeren', { werbesperre: null })).status).toBe(409);
    expect(k.werbesperre).toBeDefined();
    // Geleertes Stammdaten-Feld zählt als von Hand — der nächste Import füllt es nicht still wieder auf.
    expect(k.vonHand).toContain('firma');
    // Kennung, Stufe und Verlauf lassen sich nicht wegnullen.
    await teil('c-leeren', { stufe: null, aktivitaeten: null, id: null });
    expect(await gespeichert('c-leeren')).toMatchObject({ id: 'c-leeren', stufe: 'gespraech', aktivitaeten: [] });
  });
  it('der Browser übersetzt undefined in null (leerAlsNull), JSON verliert den Schlüssel nicht mehr', async () => {
    const { leerAlsNull } = await import('@/components/os/crm/daten');
    const felder = JSON.parse(JSON.stringify(leerAlsNull({ naechsterSchritt: undefined, notiz: 'bleibt' })));
    expect(felder).toEqual({ naechsterSchritt: null, notiz: 'bleibt' });
  });
});

describe('11 · Private Notizen nur mit ausdrücklicher Person', () => {
  it('GET ohne Person liefert keine privaten Notizen, mit Kevin seine eigene', async () => {
    expect((await ladeKontakte(null)).find(k => k.id === 'c-privat')?.privatNotiz).toBeUndefined();
    expect((await ladeKontakte('malin')).find(k => k.id === 'c-privat')?.privatNotiz).toBeUndefined();
    expect((await ladeKontakte('kevin')).find(k => k.id === 'c-privat')?.privatNotiz).toBe('Kevins Notiz');
  });
  it('ein Dienstaufruf ohne Person schreibt den Kontakt zurück, ohne die Notiz zu löschen oder zu ändern', async () => {
    const k = (await ladeKontakte(null)).find(x => x.id === 'c-privat')!;
    const r = await kontakte.PATCH!(req('/api/state/kontakte', { ops: [{ op: 'upsert', eintrag: { ...k, notiz: 'vom Dienst' } }] }, 'PATCH', null));
    expect(r.status).toBe(200);
    await teil('c-privat', { privatNotiz: 'überschrieben', jobtitel: 'CFO' }, null);
    expect(await gespeichert('c-privat')).toMatchObject({ privatNotiz: 'Kevins Notiz', notiz: 'vom Dienst', jobtitel: 'CFO' });
  });
});

describe('2 · Neue Firma überschreibt keine bestehende', () => {
  it('gleiche Kennung: „Muster GmbH“ nach „Muster“', () => {
    expect(firmenLib.firmenId('Muster GmbH')).toBe(firmenLib.firmenId('Muster'));
    const firmen = [{ id: firmenLib.firmenId('Muster'), name: 'Muster' }];
    expect(firmenLib.bestehendeFirma(firmen, 'Muster GmbH')?.name).toBe('Muster');
    expect(firmenLib.bestehendeFirma(firmen, 'Andere AG')).toBeUndefined();
  });
  it('der Server führt zusammen: lead, zahlung, bean, notiz, domain, branchen und Rolle bleiben', async () => {
    const neu = { id: firmenLib.firmenId('Muster GmbH'), name: 'Muster GmbH', rolle: 'offen', webseite: 'https://muster.example', geaendert: JETZT };
    await crmPatch([{ liste: 'firmen', op: 'upsert', eintrag: neu }]);
    const f = (await speicher.ladeCrm()).firmen.find(x => x.id === neu.id)!;
    expect(f).toMatchObject({ name: 'Muster', rolle: 'kunde', rolleVonHand: true, domain: 'muster.example', branchen: ['Handel'], notiz: 'Stammkunde', bean: 'B', webseite: 'https://muster.example' });
    expect(f.lead).toMatchObject({ status: 'qualifizierung', antworten: { schmerz: 'Liquidität' } });
    expect(f.zahlung).toMatchObject({ zielTage: 30 });
  });
});

describe('3 · Firmen-Karte schreibt nur Felder (teil)', () => {
  it('eine Lead-Qualifizierung dazwischen bleibt erhalten', async () => {
    const id = firmenLib.firmenId('Muster');
    const browserStand = (await speicher.ladeCrm()).firmen.find(x => x.id === id)!;
    // Malin qualifiziert gleichzeitig (so schreibt /api/crm/lead `setze` den Lead der Firma).
    await speicher.aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === id && f.lead ? { ...f, lead: { ...f.lead, kriterien: { ...f.lead.kriterien, entscheider: 'ja' as const } } } : f)) }));
    const { nurFelder } = await import('@/components/os/crm/daten');
    await crmPatch([{ liste: 'firmen', op: 'teil', id, felder: nurFelder({ stadt: 'Musterstadt', rechtsform: undefined }) }]);
    const f = (await speicher.ladeCrm()).firmen.find(x => x.id === id)!;
    expect(f.lead?.kriterien.entscheider).toBe('ja');
    expect(f.stadt).toBe('Musterstadt');
    // Auch ein ganzer Eintrag aus dem alten Browser-Stand löscht die Qualifizierung nicht mehr (Zusammenführen).
    await crmPatch([{ liste: 'firmen', op: 'upsert', eintrag: browserStand }]);
    expect((await speicher.ladeCrm()).firmen.find(x => x.id === id)!.lead?.kriterien.entscheider).toBe('ja');
  });
});

describe('4 · Teilnahme.nachfassenVerzichtet überlebt die Säuberung', () => {
  it('überlebt `teil`', async () => {
    await crmPatch([{ liste: 'teilnahmen', op: 'teil', id: 't-gast', felder: { notiz: 'war gut' } }]);
    expect((await speicher.ladeCrm()).teilnahmen.find(t => t.id === 't-gast')).toMatchObject({ notiz: 'war gut', nachfassenVerzichtet: H });
  });
});

describe('5 · Lead → SQL behält Antworten und qualifiziertAm', () => {
  it('leadWirdSql', async () => {
    const { leadWirdSql } = await import('@/lib/crm/deal-anlegen');
    const alt = { status: 'ruht' as const, grund: 'später', kriterien: { schmerz: 'ja' as const, entscheider: 'ja' as const, budget: 'ja' as const, zeitpunkt: 'unklar' as const, wirkung: 'unklar' as const, alternative: 'unklar' as const }, antworten: { schmerz: 'Liquidität' }, qualifiziertAm: '2026-09-20', fit: 'ja' as const, notiz: 'n' };
    const l = leadWirdSql(alt, { id: 'ch-x', qualifizierung: alt.kriterien }, JETZT, 'malin');
    expect(l).toMatchObject({ status: 'sql', antworten: { schmerz: 'Liquidität' }, qualifiziertAm: '2026-09-20', fit: 'ja', notiz: 'n', sqlAm: JETZT, chanceId: 'ch-x', geaendertVon: 'malin' });
    expect(l.grund).toBeUndefined();
  });
});

describe('6 · LinkedIn gilt als von Hand („Online gewinnt“)', () => {
  it('Profil von Hand: der nächste Masterlisten-Import überschreibt es nicht', async () => {
    const r = await netzwerk.POST!(req('/api/crm/netzwerk', { aktion: 'profil', id: 'c-linkedin', url: 'https://www.linkedin.com/in/bert-muster' }));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-linkedin');
    expect(k.vonHand).toContain('linkedin');
    const z = crmLib.zusammenfuehren(k, { ...k, linkedin: 'https://www.linkedin.com/in/jemand-anders' }, H);
    expect(z.kontakt.linkedin).toBe('https://www.linkedin.com/in/bert-muster');
    expect(z.konflikte.map(x => x.feld)).toContain('linkedin');
  });
  it('Profil aus dem LinkedIn-Export zählt ebenso', async () => {
    const csv = 'First Name,Last Name,URL\nCarla,Probe,https://www.linkedin.com/in/carla-probe\n';
    const r = await netzwerk.POST!(req('/api/crm/netzwerk', { aktion: 'import', csv, uebernehmen: true }));
    expect(r.status).toBe(200);
    const k = await gespeichert('c-linkedin2');
    expect(k.linkedin).toBe('https://www.linkedin.com/in/carla-probe');
    expect(k.vonHand).toContain('linkedin');
  });
});

describe('7 · Geplantes Meeting ist noch kein Kontakt', () => {
  it('Route: wann in der Zukunft ändert weder letzten Kontakt noch Stufe noch Wiedervorlage', async () => {
    const r = await akt.POST!(req('/api/crm/aktivitaet', { id: 'c-meeting', art: 'termin', wann: '2099-10-02T14:00', text: 'Diagnose' }));
    expect(r.status).toBe(200);
    expect(await gespeichert('c-meeting')).toMatchObject({ letzterKontakt: '2026-09-01', stufe: 'angesprochen', wiedervorlage: '2026-10-15' });
  });
  it('rein: ein vergangenes Meeting zählt sofort; die Kadenz zählt ein geplantes ab seinem Tag', async () => {
    const k = person('c-rein', { stufe: 'angesprochen', letzterKontakt: '2026-09-01' });
    const vorbei = crmLib.wendeAktivitaetAn(k, { art: 'termin', von: 'kevin', wann: '2026-09-20T10:00' }, '2026-09-28', '2026-09-28T08:00:00.000Z', d => d);
    // Ereigniszeit (U2 #46): ein nachgetragenes Meeting zählt mit SEINEM Tag, nicht mit dem Tag des Festhaltens.
    expect(vorbei.letzterKontakt).toBe('2026-09-20');
    const geplant = crmLib.wendeAktivitaetAn(k, { art: 'termin', von: 'kevin', wann: '2026-10-05' }, '2026-09-28', '2026-09-28T08:00:00.000Z', d => d);
    expect(geplant.letzterKontakt).toBe('2026-09-01');
    expect(crmLib.letzterKontaktVon(geplant, '2026-09-30')).toBe('2026-09-01');
    expect(crmLib.letzterKontaktVon(geplant, '2026-10-06')).toBe('2026-10-05');
    expect(crmLib.wannInZukunft('2026-09-28T09:30', '2026-09-28T08:00:00.000Z')).toBe(false); // 10:00 Berlin ist schon vorbei
    expect(crmLib.wannInZukunft('2026-09-28T10:30', '2026-09-28T08:00:00.000Z')).toBe(true);
    expect(crmLib.wannInZukunft('2026-09-28', '2026-09-28T08:00:00.000Z')).toBe(false);
  });
});

describe('8 · Deal gewonnen → Mandat hebt die Lifecycle-Phase', () => {
  it('SQL wird Kunde, Follow Up bleibt, ohne Phase wird nichts gespeichert', async () => {
    const r = await lead.POST!(req('/api/crm/lead', { aktion: 'mandat', chanceId: 'ch-gewonnen' }));
    expect(r.status).toBe(200);
    expect((await gespeichert('c-kunde-sql')).phase).toBe('kunde');
    expect((await gespeichert('c-kunde-follow')).phase).toBe('follow_up');
    expect((await gespeichert('c-kunde-ohne')).phase).toBeUndefined();
  });
});

describe('10 · Übergabe-Aufgaben tragen die Einheit', () => {
  it('Deal mit Gesellschaft → Aufgabe mit Einheit im Business', async () => {
    const { uebergeben } = await import('@/lib/crm/uebergabe');
    const { einheitAusGesellschaft } = await import('@/lib/einheiten');
    const r = await uebergeben({ art: 'chance', id: 'ch-uebergabe', an: 'malin' }, 'kevin');
    expect(r.ok).toBe(true);
    const tasks = (await db.loadJson<{ tasks: Record<string, unknown>[] }>('tasks'))?.tasks ?? [];
    const t = tasks.find(x => String(x.title).includes('Übergabe-Deal'))!;
    expect(einheitAusGesellschaft('kdc')).toBeTruthy();
    expect(t).toMatchObject({ space: 'business', einheit: einheitAusGesellschaft('kdc'), assignee: 'malin' });
  });
});

describe('11 · Kein Rückfall auf „kevin“ (401 ohne Person)', () => {
  it('Planung · Einheiten', async () => {
    expect((await einheitenPlanung.GET!(req('/api/planung/einheiten', undefined, 'GET', null))).status).toBe(401);
    expect((await einheitenPlanung.POST!(req('/api/planung/einheiten', { name: 'Testeinheit' }, 'POST', null))).status).toBe(401);
    expect((await einheitenPlanung.GET!(req('/api/planung/einheiten', undefined, 'GET', 'kevin'))).status).toBe(200);
  });
  it('Zeit je Einheit', async () => {
    expect((await zeitEinheiten.GET!(req('/api/state/zeit/einheiten?zeitraum=woche', undefined, 'GET', null))).status).toBe(401);
  });
  it('Kontakt-Frage an ZOE', async () => {
    expect((await kontaktFrage.GET!(req('/api/crm/kontakt-frage', undefined, 'GET', null))).status).toBe(401);
    expect((await kontaktFrage.POST!(req('/api/crm/kontakt-frage', { id: 'c-privat' }, 'POST', null))).status).toBe(401);
  });
});
