// ─── Geburtstage (29.09., K2): ein Format, eine Stelle je Person, Art. 18, Glocke, Familie ─
// Eigener Datenordner; alle Namen erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { geburtstagLesen, geburtstagSaeubern, geburtstagText, naechsterGeburtstag, alsTagesSchluessel, geburtstagImJahr } from '@/lib/kalender/geburtstag';
import { familieQuellen, crmQuellen, quellenVereinen, geburtstageAus, type GeburtstagQuelle } from '@/lib/kalender/quellen-geburtstage';
import { saeubereKontakt, PIPELINE_FELDER, type Kontakt } from '@/lib/make-one/crm';
import { EXPORT_SPALTEN, kontakteCsv } from '@/lib/crm/export';
import { wichtigeTage, tagDatum } from '@/lib/familie/logik';
import { wendeFamilieAn, startBestand } from '@/lib/familie/speicher';
import { geburtstagAbleiten, gelesenSetzen, leererBestand } from '@/lib/meldungen/regeln';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-geb-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k2';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-k2-nur-im-test';
const HAUS = 'test-haus';

describe('Format', () => {
  it('liest tolerant, speichert „TT.MM.“ oder „JJJJ-MM-TT“', () => {
    expect(geburtstagSaeubern('3.10.')).toBe('03.10.');
    expect(geburtstagSaeubern('03.10')).toBe('03.10.');
    expect(geburtstagSaeubern('3.10.1990')).toBe('1990-10-03');
    expect(geburtstagSaeubern('1990-10-03')).toBe('1990-10-03');
    expect(geburtstagSaeubern('10-03')).toBe('03.10.');
    expect(geburtstagSaeubern('--10-03')).toBe('03.10.');
    expect(geburtstagLesen('03.10.')).toEqual({ tag: 3, monat: 10 });
  });
  it('prüft den Kalender und lehnt Zukunft/Unsinn ab', () => {
    expect(geburtstagSaeubern('31.04.')).toBeUndefined();
    expect(geburtstagSaeubern('29.02.')).toBe('29.02.');
    expect(geburtstagSaeubern('29.02.2023')).toBeUndefined();
    expect(geburtstagSaeubern('29.02.2024')).toBe('2024-02-29');
    expect(geburtstagSaeubern('3.10.2030', '2026-09-29')).toBeUndefined();
    expect(geburtstagSaeubern('morgen')).toBeUndefined();
    expect(geburtstagSaeubern(42)).toBeUndefined();
  });
  it('Anzeige, nächster Geburtstag mit Alter, 29.02. außerhalb von Schaltjahren am 28.02.', () => {
    expect(geburtstagText('1990-10-03')).toBe('3. Oktober 1990');
    expect(naechsterGeburtstag('1990-10-03', '2026-09-29')).toEqual({ tag: '2026-10-03', inTagen: 4, alter: 36 });
    expect(naechsterGeburtstag('03.09.', '2026-09-29')).toEqual({ tag: '2027-09-03', inTagen: 339 });
    expect(geburtstagImJahr({ tag: 29, monat: 2 }, 2027)).toBe('2027-02-28');
    expect(alsTagesSchluessel('03.10.')).toBe('10-03');
    expect(alsTagesSchluessel('1990-10-03')).toBe('1990-10-03');
  });
});

describe('Eine Stelle je Person — Vorrang Familie, Mensch führt', () => {
  const links = { mensch: '/os/menschen', tag: '/os/familie' };
  const crm = crmQuellen([
    { id: 'c-tom-muell-test', vorname: 'Tom', nachname: 'Müller', geburtstag: '1985-05-05', besitzer: 'kevin' },
    { id: 'c-eva-eins-test', vorname: 'Eva', nachname: 'Einschränk', geburtstag: '01.01.', eingeschraenkt: { seit: '2026-09-01', grund: 'x', von: 'kevin' } },
    { id: 'c-ida-kund-test', vorname: 'Ida', nachname: 'Kundin', geburtstag: '12.12.', besitzer: 'malin' },
    { id: 'c-ohne-geb-test', vorname: 'Ohne', nachname: 'Tag' },
  ], id => `/akte/${id}`, k => k.besitzer);
  it('CRM: nur mit Geburtstag, nie eingeschränkte (Art. 18)', () => {
    expect(crm.map(c => c.name)).toEqual(['Tom Müller', 'Ida Kundin']);
    expect(crm[0]).toMatchObject({ herkunft: 'crm', space: 'business', href: '/akte/c-tom-muell-test', zustaendig: 'kevin' });
  });
  it('gleicher Name (ohne Umlaut-Unterschied) = dieselbe Person → einmal, Familie gewinnt', () => {
    const fam = familieQuellen({ menschen: [{ id: 'm1', name: 'Tom Mueller', geburtstag: '05.05.' }] }, links);
    const v = quellenVereinen(fam, crm);
    expect(v.filter(x => x.name.startsWith('Tom'))).toHaveLength(1);
    expect(v.find(x => x.name.startsWith('Tom'))).toMatchObject({ herkunft: 'familie', space: 'privat', geburtstag: '05.05.', kontaktId: 'c-tom-muell-test' });
  });
  it('gleicher Name ohne eigenen Tag → Tag vom Kontakt, Eintrag bleibt in der Familie (F2 N4: ohne `kontaktId`)', () => {
    const fam = familieQuellen({ menschen: [{ id: 'm2', name: 'Ida Kundin', geburtstag: null }, { id: 'm3', name: 'Niemand', geburtstag: null }] }, links);
    const v = quellenVereinen(fam, crm);
    expect(v.map(x => x.id).sort()).toEqual(['crm-c-tom-muell-test', 'fam-m2']);
    expect(v.find(x => x.id === 'fam-m2')).toMatchObject({ geburtstag: '12.12.', space: 'privat' });
  });
  it('Wichtiger Tag mit Verweis erscheint nie zusätzlich; alte ohne Verweis: gleicher Name → der Mensch', () => {
    const fam = familieQuellen({
      menschen: [{ id: 'm4', name: 'Oma Erika', geburtstag: '1940-03-01' }, { id: 'm5', name: 'Opa', geburtstag: null }],
      tage: [
        { id: 't1', titel: 'Geburtstag Oma', art: 'geburtstag', datum: '', menschId: 'm4' },
        { id: 't2', titel: 'Geburtstag Opa', art: 'geburtstag', datum: '02-02' },
        { id: 't3', titel: 'Geburtstag Patenkind', art: 'geburtstag', datum: '07-07' },
        { id: 't4', titel: 'Hochzeitstag', art: 'jahrestag', datum: '06-06' },
      ],
    }, links);
    const v = quellenVereinen(fam, []);
    expect(v.map(x => `${x.id}:${x.name}:${x.geburtstag}`).sort()).toEqual(['fam-m4:Oma Erika:1940-03-01', 'fam-m5:Opa:02-02', 'tag-t3:Patenkind:07-07']);
  });
  it('Vorkommen im Zeitraum, mit Alter, über den Jahreswechsel, nicht vor der Geburt', () => {
    const q: GeburtstagQuelle[] = [
      { id: 'a', name: 'A', geburtstag: '2000-12-31', herkunft: 'familie', space: 'privat', href: '/x' },
      { id: 'b', name: 'B', geburtstag: '02.01.', herkunft: 'crm', space: 'business', href: '/y' },
      { id: 'c', name: 'C', geburtstag: '2027-01-01', herkunft: 'familie', space: 'privat', href: '/z' },
    ];
    const g = geburtstageAus(q, '2026-12-30', '2027-01-03');
    expect(g.map(x => `${x.tag}:${x.name}:${x.alter ?? '-'}`)).toEqual(['2026-12-31:A:26', '2027-01-01:C:0', '2027-01-02:B:-']);
    expect(geburtstageAus(q, '2026-01-01', '2026-01-01')).toEqual([]);
  });
});

describe('Datenhaltung: CRM-Kontakt, Export, Familie', () => {
  const k = (x: Partial<Kontakt>): Kontakt => ({ id: 'c-test-geb-person', vorname: 'Test', nachname: 'Person', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', eignung: '', prio: '', ...x } as Kontakt);
  it('saeubereKontakt: Geburtstag in einer Form, Unsinn fällt weg; Import fasst ihn nie an', () => {
    expect(saeubereKontakt(k({ geburtstag: '3.10.1990' }))?.geburtstag).toBe('1990-10-03');
    expect(saeubereKontakt(k({ geburtstag: '31.02.' }))?.geburtstag).toBeUndefined();
    expect(saeubereKontakt(k({}))).not.toHaveProperty('geburtstag');
    expect(PIPELINE_FELDER).toContain('geburtstag');
  });
  it('Export: Spalte GEBURTSTAG am Ende', () => {
    expect(EXPORT_SPALTEN.kontakte[EXPORT_SPALTEN.kontakte.length - 1]).toBe('GEBURTSTAG');
    const csv = kontakteCsv({ kontakte: [k({ geburtstag: '03.10.' })], crm: { firmen: [], chancen: [], mandate: [], produkte: [], events: [], teilnahmen: [], followups: [] } as never, heute: '2026-09-29' });
    expect(csv.split('\n')[1].endsWith(';03.10.')).toBe(true);
  });
  it('Familie: Mensch-Geburtstag gesäubert, Wichtiger Tag mit Verweis ohne eigenes Datum', () => {
    const f = startBestand('2026-09-29T08:00:00.000Z');
    const r = wendeFamilieAn(f, [
      { liste: 'menschen', op: 'set', eintrag: { id: 'm1', name: 'Oma', rolle: 'eltern', geburtstag: '1.3.1940', kontaktAlleTage: null, letzterKontakt: null, notiz: '', kontaktId: 'kaputt' } },
      { liste: 'tage', op: 'set', eintrag: { id: 't1', titel: 'Geburtstag Oma', art: 'geburtstag', datum: '03-01', menschId: 'm1', vorlaufTage: 7, wer: 'kevin', aktion: 'karte', erledigt: [] } },
    ] as never, 'kevin', '2026-09-29T08:00:00.000Z');
    const m = r.familie.menschen[0];
    expect(m.geburtstag).toBe('1940-03-01');
    expect(m).not.toHaveProperty('kontaktId');
    const t = r.familie.tage[0];
    expect([t.datum, t.menschId]).toEqual(['', 'm1']);
    expect(tagDatum(t, r.familie.menschen)).toBe('1940-03-01');
    expect(wichtigeTage(r.familie.tage, '2027-02-20', 60, r.familie.menschen)[0]).toMatchObject({ am: '2027-03-01', inTagen: 9 });
    expect(wichtigeTage(r.familie.tage, '2027-02-20', 60, [])).toEqual([]); // Mensch weg → kein Datum
  });
});

describe('Glocke: am Vortag und am Tag, nur für Zuständige', () => {
  const liste = [
    { id: 'fam-m1-2026', name: 'Malin', tag: '2026-09-30', alter: 34, href: '/os/menschen', zustaendig: 'kevin' },
    { id: 'crm-c-x-2026', name: 'Ida Kundin', tag: '2026-09-29', href: '/os/markttraktion?x', zustaendig: 'malin' },
    { id: 'crm-c-y-2026', name: 'Tom Müller', tag: '2026-09-29', href: '/os/markttraktion?y', zustaendig: 'beide' },
    { id: 'crm-c-z-2026', name: 'Später', tag: '2026-10-05', href: '/os/markttraktion?z' },
  ];
  it('Titel „hat morgen/heute Geburtstag“, heute zuerst, nichts für andere Zuständige', () => {
    const m = geburtstagAbleiten(liste, { person: 'kevin', heute: '2026-09-29', morgen: '2026-09-30', am: '2026-09-28T22:00:00.000Z' });
    expect(m.map(x => x.titel)).toEqual(['Tom Müller hat heute Geburtstag', 'Malin hat morgen Geburtstag (wird 34)']);
    expect(m.every(x => x.virtuell && x.art === 'geburtstag' && !x.gelesen)).toBe(true);
  });
  it('Gelesen-Merker je Tag (wie fällig/überfällig)', () => {
    const o = { person: 'kevin', heute: '2026-09-29', morgen: '2026-09-30', am: 'x' };
    const ids = geburtstagAbleiten(liste, o).map(x => x.id);
    const b = gelesenSetzen(leererBestand(), { alle: true }, '2026-09-29', ids);
    expect(geburtstagAbleiten(liste, { ...o, gelesen: b.faelligGelesen }).every(x => x.gelesen)).toBe(true);
    expect(geburtstagAbleiten(liste, { ...o, heute: '2026-09-30', morgen: '2026-10-01', gelesen: b.faelligGelesen })[0].gelesen).toBe(false);
  });
});

describe('geburtstageIm — die Lesefunktion für alle Module (Datenordner)', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [
      { id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
      { id: 'k2', speicher: 'malin', email: 'm@test', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    ], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [
      { id: 'c-anna-test-k2', vorname: 'Anna', nachname: 'Kundin', geburtstag: '1980-10-01', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', besitzer: 'kevin' },
      { id: 'c-eva-test-k2', vorname: 'Eva', nachname: 'Gesperrt', geburtstag: '02.10.', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', eingeschraenkt: { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' } },
    ] });
    await db.saveJson(`familie--${HAUS}`, { menschen: [
      { id: 'm1', von: 'kevin', am: '2026-09-01', name: 'Mama', rolle: 'eltern', geburtstag: '03.10.', kontaktAlleTage: null, letzterKontakt: null, notiz: '' },
      { id: 'm2', von: 'malin', am: '2026-09-01', sichtbarkeit: 'nur-ich', name: 'Beste Freundin', rolle: 'freund', geburtstag: '04.10.', kontaktAlleTage: null, letzterKontakt: null, notiz: '' },
    ], tage: [] });
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

  it('Familie (nach Sicht) + CRM ohne Art.-18-Kontakte, getrennt nach Space', async () => {
    const { geburtstageIm } = await import('@/lib/kalender/quellen-geburtstage-server');
    const kevin = await geburtstageIm({ von: '2026-09-29', bis: '2026-10-10' }, 'kevin');
    expect(kevin.map(g => `${g.tag} ${g.name} ${g.space}`)).toEqual(['2026-10-01 Anna Kundin business', '2026-10-03 Mama privat']);
    expect(kevin[0]).toMatchObject({ alter: 46, href: expect.stringContaining('c-anna-test-k2') });
    const malin = await geburtstageIm({ von: '2026-09-29', bis: '2026-10-10' }, 'malin');
    expect(malin.map(g => g.name)).toEqual(['Anna Kundin', 'Mama', 'Beste Freundin']); // „nur ich“ sieht nur Malin
    expect((await geburtstageIm({ von: '2026-09-29', bis: '2026-10-10' }, 'kevin', { nur: 'privat' })).map(g => g.name)).toEqual(['Mama']);
    expect(await geburtstageIm({ von: '2026-09-29', bis: '2026-10-10' }, 'fremd')).toEqual([]);
  });
  it('Glocke: am Vortag „morgen“ — über den echten Speicherweg', async () => {
    const { meldungenSicht } = await import('@/lib/meldungen/speicher');
    const s = await meldungenSicht('kevin', new Date('2026-09-30T08:00:00+02:00'));
    expect(s.meldungen.filter(m => m.art === 'geburtstag').map(m => m.titel)).toEqual(['Anna Kundin hat morgen Geburtstag (wird 46)']);
  });
});
