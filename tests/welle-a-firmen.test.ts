// ─── Welle A „Firmen als Ziel“ (01.11.2026, lib/crm/betrieb.ts) — Betriebe ohne Ansprechpartner als vollwertige Ziele ─────────────
// Rein: Schlüssel/Dubletten (gleicher Name an anderer Adresse = anderer Betrieb), Recht nur vom Server gestempelt, Säuberer behält die neuen
// Felder, Firmen-Ampel (rot bleibt rot), Segmente über Firmen + neue Kriterien, CSV mit Betrieben, Art. 15/17 des Inhabers.
// Mit Datenordner: Werbesperre an der Firma → Sperrliste (Fingerabdrücke, kein Klartext), Abmeldelink an die Firmen-Adresse.
// Erfundene Daten (@example.invalid).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Firma, CrmBestand } from '../lib/crm/typen';
import type { Kontakt } from '../lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-welle-a-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_PEPPER = 'pruef-pepper-welle-a-0123456789abcdef';
process.env.MAKE_OS_ADRESSE = 'https://os.example.invalid';

const D = 'example.invalid';
const J = '2026-11-01T10:00:00.000Z';
const HEUTE = '2026-11-01';
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id, name: 'Café Rosa', rolle: 'offen', geaendert: J, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Beispiel', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });

afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Schlüssel und Dubletten', () => {
  it('gleicher Name an verschiedenen Adressen verschmilzt nie — eigene Kennungen', async () => {
    const { gleicherBetrieb, betriebFirmenId, betriebFinden, betriebBekannt } = await import('../lib/crm/betrieb');
    const mitte = { name: 'Café Rosa', adresse: { strasse: 'Erfundene Straße', hausnummer: '1', plz: '10115', ort: 'Berlin' } };
    const nord = { name: 'Café Rosa', adresse: { strasse: 'Andere Straße', hausnummer: '9', plz: '12043', ort: 'Berlin' } };
    expect(gleicherBetrieb(mitte, nord)).toBe('nein');
    expect(betriebFirmenId(mitte)).not.toBe(betriebFirmenId(nord));
    expect(betriebFirmenId(mitte)).toBe(betriebFirmenId({ ...mitte })); // wiederholbar
    // gleiche Domain an verschiedenen Adressen: zwei Betriebe
    expect(gleicherBetrieb({ ...mitte, webseite: `https://rosa.${D}` }, { ...nord, webseite: `https://rosa.${D}` })).toBe('nein');
    // gleiche Adresse, anders geschrieben: derselbe
    expect(gleicherBetrieb(mitte, { name: 'Cafe Rosa', adresse: { strasse: 'Erfundene Str.', hausnummer: '1', plz: '10115' } })).toBe('ja');
    expect(gleicherBetrieb({ name: 'A', osmId: 'n5' }, { name: 'B', osmId: 'n5' })).toBe('ja');
    expect(gleicherBetrieb(mitte, { name: 'Café Rosa' })).toBe('vielleicht');
    const kartei = [firma('f-a', mitte)];
    expect(betriebFinden(kartei, nord)).toBeUndefined();
    expect(betriebFinden(kartei, { name: 'Café Rosa' })).toBeUndefined();
    expect(betriebBekannt(kartei, { name: 'Café Rosa' })?.id).toBe('f-a');
  });

  it('manuelles Anlegen unverändert: Kennung ohne Unterscheider = firmenId(name)', async () => {
    const { firmenId, firmenIdMit } = await import('../lib/crm/firmen');
    const { betriebFirmenId } = await import('../lib/crm/betrieb');
    expect(firmenIdMit('Muster GmbH', '')).toBe(firmenId('Muster GmbH'));
    expect(betriebFirmenId({ name: 'Muster GmbH' })).toBe(firmenId('Muster GmbH'));
  });

  it('Firmen-Dubletten-Prüfung berücksichtigt die Adresse', async () => {
    const { firmenDubletten } = await import('../lib/crm/firmen');
    const a = firma('f-a', { adresse: { strasse: 'Weg', hausnummer: '1', plz: '10115' } });
    const b = firma('f-b', { adresse: { strasse: 'Weg', hausnummer: '2', plz: '10115' } });
    const c = firma('f-c');
    expect(firmenDubletten([a, b])).toEqual([]);
    expect(firmenDubletten([a, c]).length).toBe(1);
    expect(firmenDubletten([firma('f-o1', { osmId: 'n1' }), firma('f-o2', { osmId: 'n2' })])).toEqual([]);
  });

  it('Merkmale: geteilte Plattform und Freemailer sind keine Domain des Betriebs', async () => {
    const { betriebMerkmale } = await import('../lib/crm/betrieb');
    expect(betriebMerkmale({ name: 'X', webseite: 'https://www.instagram.com/x', email: 'x@gmail.com' })).toEqual([]);
    expect(betriebMerkmale({ name: 'X', osmId: 'n7', webseite: `https://x.${D}/`, adresse: { plz: '10115', strasse: 'Weg 1' } })).toEqual(['o:n7', `d:x.${D}`, 'b:x|10115|weg1']);
  });
});

describe('Säuberer und Recht an der Firma', () => {
  it('neue Felder überleben das Speichern; Kampagne trägt firmaIds; Segment-Kriterien bleiben', async () => {
    const { saeubern } = await import('../lib/crm/speicher');
    const f = saeubern('firmen', {
      id: 'f-rosa-x1', name: 'Café Rosa', rolle: 'zielkunde', adresse: { strasse: 'Weg', hausnummer: '1', plz: '10115', ort: 'Berlin', boese: 'x' }, bezirk: 'Mitte', osmId: 'n12',
      quellen: { telefon: `https://www.openstreetmap.org/node/12`, kaputt: 'javascript:alert(1)' }, bewertung: { punkte: 130, gruende: ['keine Website'], gemessenAm: J },
      analyse: { niveau: 40, luecken: ['a'], aufhaenger: ['b'], unterNiveau: true, gemessenAm: J }, anreicherung: { am: J, quelle: 'osm' }, oeffnungszeiten: 'Mo-Fr 8-18',
      mobil: '+49 170 0000000', instagram: '@rosa.x', inhaber: 'Erika Beispiel', inhaberArt: 'person', labels: ['homepage-funnel', 'homepage-funnel'],
      herkunft: 'recherche', fremddaten: true, erfasstAm: HEUTE, werbesperre: { seit: HEUTE, grund: 'Nein am Telefon' },
    }, J, 'kevin') as unknown as Firma;
    expect(f).toMatchObject({ adresse: { strasse: 'Weg', hausnummer: '1', plz: '10115', ort: 'Berlin' }, bezirk: 'Mitte', osmId: 'n12', bewertung: { punkte: 100 }, analyse: { niveau: 40, unterNiveau: true },
      anreicherung: { quelle: 'osm' }, mobil: '+49 170 0000000', instagram: 'rosa.x', inhaber: 'Erika Beispiel', labels: ['homepage-funnel'], herkunft: 'recherche', werbesperre: { seit: HEUTE } });
    expect(f.quellen).toEqual({ telefon: 'https://www.openstreetmap.org/node/12' });
    expect((f.adresse as Record<string, unknown>).boese).toBeUndefined();
    const kamp = saeubern('kampagnen', { id: 'km-x', name: 'K', playbook: 'homepage-funde', ziel: '', kanal: 'mix', status: 'aktiv', schritte: [], kontaktIds: [], firmaIds: ['f-rosa-x1', 'f-rosa-x1', 'boese'], ergebnisse: [], von: 'hand' }, J, 'kevin') as Record<string, unknown>;
    expect(kamp.firmaIds).toEqual(['f-rosa-x1']);
    const seg = saeubern('segmente', { id: 'sg-x', name: 'S', kriterien: { bezirk: ['Mitte'], plz: ['10', '<x>'], websiteScore: { von: 50, bis: 400 }, hatWebsite: false, erreichbarkeit: ['handy', 'fax'], kampagne: ['km-x'], quelle: ['osm', 'google'] } }, J, 'kevin') as { kriterien: Record<string, unknown> };
    expect(seg.kriterien).toEqual({ bezirk: ['Mitte'], plz: ['10'], websiteScore: { von: 50, bis: 100 }, hatWebsite: false, erreichbarkeit: ['handy'], kampagne: ['km-x'], quelle: ['osm'] });
  });

  it('nur der Server stempelt: Werbesperre seit heute, nie über den Browser entfernt; geprüft = heute + Person; fremd → Art.-14-Uhr', async () => {
    const { wendeCrmAn, leererBestand } = await import('../lib/crm/speicher');
    const b: CrmBestand = { ...leererBestand(), firmen: [firma('f-rosa-x1')] };
    const r1 = wendeCrmAn(b, [{ liste: 'firmen', op: 'teil', id: 'f-rosa-x1', felder: { werbesperre: { seit: '2020-01-01', grund: 'Nein' }, geprueftAm: '2020-01-01', geprueftVon: 'jemand', herkunft: 'recherche' } }], J, 'kevin');
    const f1 = r1.bestand.firmen[0];
    expect(f1.werbesperre).toEqual({ seit: HEUTE, grund: 'Nein' });
    expect(f1).toMatchObject({ geprueftAm: HEUTE, geprueftVon: 'kevin', fremddaten: true, erfasstAm: HEUTE });
    const r2 = wendeCrmAn(r1.bestand, [{ liste: 'firmen', op: 'teil', id: 'f-rosa-x1', felder: { werbesperre: null, fremddaten: null, name: 'Café Rosa Neu' } }], '2026-11-05T10:00:00.000Z', 'malin');
    expect(r2.bestand.firmen[0]).toMatchObject({ name: 'Café Rosa Neu', werbesperre: { seit: HEUTE }, fremddaten: true, erfasstAm: HEUTE, geprueftVon: 'kevin' });
    const { art14Firma } = await import('../lib/crm/betrieb');
    expect(art14Firma(r2.bestand.firmen[0], '2026-11-27')).toEqual({ tage: 26, faellig: true });
    expect(art14Firma({ ...r2.bestand.firmen[0], art14InformiertAm: '2026-11-02' }, '2026-11-27')).toBeNull();
  });
});

describe('Ampel für Firmen', () => {
  it('rot bleibt rot: Werbe-Mail und Kaltanruf an einen Betrieb ohne Einwilligung; Mandat erlaubt Telefon', async () => {
    const { firmaKanalStatus, firmaAmpel, kanalStatus } = await import('../lib/crm/recht');
    const f = firma('f-x', { email: `info@x.${D}`, mobil: '+49 170 0000000' });
    expect(firmaKanalStatus(f, 'mail').farbe).toBe('rot');
    expect(firmaKanalStatus(f, 'telefon').farbe).toBe('rot');
    expect(firmaKanalStatus({ ...f, rolle: 'kunde' }, 'telefon').farbe).toBe('gruen');
    expect(firmaKanalStatus({ ...f, rolle: 'kunde', werbesperre: { seit: HEUTE, grund: 'x' } }, 'telefon').farbe).toBe('rot');
    expect(firmaKanalStatus(firma('f-leer'), 'mail').grund).toBe('keine Adresse');
    expect(firmaAmpel(f).map(s => s.kanal)).toEqual(['telefon', 'mail']);
    // Person ohne eigene Nummer: Firmen-Telefon zählt als Adresse; Werbesperre der Firma sperrt die Person.
    const p = k('c-p1', { lebensphase: 'kunde' });
    expect(kanalStatus(p, 'telefon').grund).toBe('keine Adresse');
    expect(kanalStatus(p, 'telefon', { firma: f }).farbe).toBe('gruen');
    expect(kanalStatus(p, 'telefon', { firma: { ...f, werbesperre: { seit: HEUTE, grund: 'x' } } }).farbe).toBe('rot');
  });
});

describe('Segmente über Firmen', () => {
  const crm = async (): Promise<CrmBestand> => {
    const { leererBestand } = await import('../lib/crm/speicher');
    return {
      ...leererBestand(),
      firmen: [
        firma('f-a1', { name: 'Betrieb A', bezirk: 'Mitte', adresse: { plz: '10115' }, bewertung: { punkte: 90, gruende: [], gemessenAm: J }, mobil: '+49 170 1', anreicherung: { am: J, quelle: 'osm' }, labels: ['homepage-funnel'], herkunft: 'recherche' }),
        firma('f-b2', { name: '=Betrieb B', bezirk: 'Neukölln', adresse: { plz: '12043' }, webseite: `https://b.${D}`, bewertung: { punkte: 55, gruende: [], gemessenAm: J }, telefon: '+49 30 1', anreicherung: { am: J, quelle: 'hand' } }),
        firma('f-c3', { name: 'Gesperrt C', bezirk: 'Mitte', werbesperre: { seit: HEUTE, grund: 'x' } }),
        firma('f-d4', { name: 'Mit Person D', bezirk: 'Mitte' }),
        firma('f-e5', { name: 'Nur gesperrte Person E', bezirk: 'Mitte' }),
      ],
      kampagnen: [{ id: 'km-1', name: 'K', playbook: 'homepage-funde', ziel: '', zielgruppe: {}, kanal: 'mix', status: 'aktiv', schritte: [], kontaktIds: [], firmaIds: ['f-a1'], ergebnisse: [], von: 'hand', geaendert: J }],
    };
  };
  const kontakte = [k('c-d4', { firmaId: 'f-d4', firma: 'Mit Person D' }), k('c-e5', { firmaId: 'f-e5', firma: 'Nur gesperrte Person E', werbesperre: { seit: HEUTE, grund: 'x' } })];

  it('Betriebe ohne Person zählen, gesperrte nie, Firmen mit Personen über ihre Personen', async () => {
    const { kontextAus, segmentFirmen, segmentZiele } = await import('../lib/crm/segmente');
    const c = await crm();
    const ctx = kontextAus(c, HEUTE);
    expect(segmentFirmen(c.firmen, kontakte, {}, ctx).map(f => f.id)).toEqual(['f-a1', 'f-b2']);
    expect(segmentFirmen(c.firmen, kontakte, { bezirk: ['mitte'] }, ctx).map(f => f.id)).toEqual(['f-a1']);
    expect(segmentFirmen(c.firmen, kontakte, { plz: ['120'] }, ctx).map(f => f.id)).toEqual(['f-b2']);
    expect(segmentFirmen(c.firmen, kontakte, { websiteScore: { von: 60 } }, ctx).map(f => f.id)).toEqual(['f-a1']);
    expect(segmentFirmen(c.firmen, kontakte, { hatWebsite: true }, ctx).map(f => f.id)).toEqual(['f-b2']);
    expect(segmentFirmen(c.firmen, kontakte, { erreichbarkeit: ['handy'] }, ctx).map(f => f.id)).toEqual(['f-a1']);
    expect(segmentFirmen(c.firmen, kontakte, { erreichbarkeit: ['festnetz'] }, ctx).map(f => f.id)).toEqual(['f-b2']);
    expect(segmentFirmen(c.firmen, kontakte, { kampagne: ['km-1'] }, ctx).map(f => f.id)).toEqual(['f-a1']);
    expect(segmentFirmen(c.firmen, kontakte, { quelle: ['hand'] }, ctx).map(f => f.id)).toEqual(['f-b2']);
    expect(segmentFirmen(c.firmen, kontakte, { herkunft: ['recherche'], label: ['homepage-funnel'] }, ctx).map(f => f.id)).toEqual(['f-a1']);
    // Personen-Kriterien erfüllt eine Firma ohne Person nie; Mail-Kanal an Betriebe ist rot.
    expect(segmentFirmen(c.firmen, kontakte, { kreis: ['A'] }, ctx)).toEqual([]);
    expect(segmentFirmen(c.firmen, kontakte, { kanal: 'mail' }, ctx)).toEqual([]);
    const z = segmentZiele(kontakte, c.firmen, { bezirk: ['Mitte'] }, ctx);
    expect(z.ziele).toEqual([{ art: 'kontakt', id: 'c-d4' }, { art: 'firma', id: 'f-a1' }]);
  });

  it('Personen: Betriebs-Kriterien über die Firma, Werbesperre der Firma sperrt die Person', async () => {
    const { kontextAus, imSegment } = await import('../lib/crm/segmente');
    const c = await crm();
    c.firmen = c.firmen.map(f => (f.id === 'f-d4' ? { ...f, adresse: { plz: '10115' } } : f));
    const ctx = kontextAus(c, HEUTE);
    expect(imSegment(kontakte[0], { plz: ['101'] }, ctx)).toBe(true);
    expect(imSegment(kontakte[0], { plz: ['120'] }, ctx)).toBe(false);
    const gesperrt = kontextAus({ ...c, firmen: c.firmen.map(f => (f.id === 'f-d4' ? { ...f, werbesperre: { seit: HEUTE, grund: 'x' } } : f)) }, HEUTE);
    expect(imSegment(kontakte[0], {}, gesperrt)).toBe(false);
  });

  it('CSV: Personen und Betriebe, nur Felder, Formel-Anfänge neutralisiert, Mail nur bei grüner Ampel', async () => {
    const { kontextAus } = await import('../lib/crm/segmente');
    const { segmentCsv, kriterienSauber, kriterienText } = await import('../lib/crm/marketing');
    const c = await crm();
    c.firmen = c.firmen.map(f => (f.id === 'f-a1' ? { ...f, email: `info@a.${D}`, notiz: 'GEHEIM-NOTIZ' } : f));
    const csv = segmentCsv(kontakte, {}, kontextAus(c, HEUTE), undefined, c.firmen);
    const zeilen = csv.replace(/^﻿/, '').split('\n');
    expect(zeilen[0]).toBe('name;firma;email;telefon;kreis;phase;kanal_status;art;anschrift;bezirk;website_bedarf;website');
    expect(zeilen.filter(z => z.includes(';betrieb;'))).toHaveLength(2);
    expect(csv).toContain("'=Betrieb B");
    expect(csv).not.toContain(`info@a.${D}`);
    expect(csv).not.toContain('GEHEIM-NOTIZ');
    expect(csv).not.toContain('Gesperrt C');
    // ohne Firmen (Alt-Aufrufer) wie bisher
    expect(segmentCsv(kontakte, {}, kontextAus(c, HEUTE)).replace(/^﻿/, '').split('\n')[0]).toBe('name;firma;email;telefon;kreis;phase;kanal_status');
    expect(kriterienSauber({ plz: ['12', '10', '10'], erreichbarkeit: ['mail', 'handy'], websiteScore: { bis: 80 } })).toEqual({ plz: ['10', '12'], websiteScore: { bis: 80 }, erreichbarkeit: ['handy', 'mail'] });
    expect(kriterienText({ bezirk: ['Mitte'], hatWebsite: false })).toBe('Bezirk Mitte · ohne Website');
  });
});

describe('Art. 15/17 des Inhabers', () => {
  it('Betriebe der Person finden und den Inhaber-Namen tilgen (die Firma bleibt)', async () => {
    const { betriebeDerPerson, betriebeInhaberTilgen } = await import('../lib/crm/person-bestaende');
    const fs = [firma('f-1', { inhaber: 'Erika Beispiel' }), firma('f-2', { lead: { status: 'neu', kriterien: {} as never, hauptKontaktId: 'c-e' } }), firma('f-3', { inhaber: 'Erika Beispielhaft' })];
    expect(betriebeDerPerson(fs, 'c-e', 'Erika Beispiel').map(f => f.id)).toEqual(['f-1', 'f-2']);
    const neu = betriebeInhaberTilgen({ firmen: fs }, new Set(['f-1']));
    expect(neu.firmen.find(f => f.id === 'f-1')).not.toHaveProperty('inhaber');
    expect(neu.firmen).toHaveLength(3);
  });
});

describe('Sperrliste für Betriebe (Datenordner)', () => {
  let db: typeof import('../lib/store/local-db');
  beforeAll(async () => {
    db = await import('../lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' }], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    const { leererBestand } = await import('../lib/crm/speicher');
    await db.saveJson('crm', { ...leererBestand(), firmen: [
      firma('f-sp-1', { name: 'Betrieb Nein', osmId: 'n4711', adresse: { strasse: 'Weg', hausnummer: '3', plz: '10115' } }),
      firma('f-sp-2', { name: 'Betrieb Abmeldung', email: `info@abmeldung.${D}` }),
    ] });
  });

  it('Werbesperre an der Firma → Fingerabdrücke auf der Sperrliste (kein Klartext); der Betrieb gilt danach als gesperrt', async () => {
    const { aendereCrm } = await import('../lib/crm/speicher');
    const { sperrlisteLaden } = await import('../lib/crm/sperrliste');
    const { betriebGesperrt } = await import('../lib/crm/betrieb-sperre');
    expect(betriebGesperrt(await sperrlisteLaden(), { name: 'Betrieb Nein', osmId: 'n4711' })).toBe(false);
    await aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === 'f-sp-1' ? { ...f, werbesperre: { seit: HEUTE, grund: 'Nein am Telefon' } } : f)) }));
    const liste = await sperrlisteLaden();
    expect(betriebGesperrt(liste, { name: 'Betrieb Nein', osmId: 'n4711' })).toBe(true);
    // derselbe Betrieb über Name + Adresse (ohne OSM-ID) — ein anderer Betrieb gleichen Namens an anderer Adresse nicht
    expect(betriebGesperrt(liste, { name: 'Betrieb Nein', adresse: { strasse: 'Weg', hausnummer: '3', plz: '10115' } })).toBe(true);
    expect(betriebGesperrt(liste, { name: 'Betrieb Nein', adresse: { strasse: 'Weg', hausnummer: '4', plz: '10115' } })).toBe(false);
    const roh = readdirSync(ordner).filter(n => n.startsWith('crm-sperrliste--')).map(n => readFileSync(path.join(ordner, n), 'utf8')).join('');
    expect(roh).not.toContain('n4711');
    expect(roh).not.toContain('Betrieb Nein');
  });

  it('Abmeldelink an die Firmen-Adresse setzt die Werbesperre der Firma (und damit die Sperrliste)', async () => {
    const { abmeldeToken } = await import('../lib/datenschutz/abmelden');
    const { abmeldenAnwenden } = await import('../lib/datenschutz/abmelden-server');
    const { ladeCrm } = await import('../lib/crm/speicher');
    const t = abmeldeToken(`info@abmeldung.${D}`)!;
    expect(t).toBeTruthy();
    expect(await abmeldenAnwenden(t)).toBe(1);
    expect((await ladeCrm()).firmen.find(f => f.id === 'f-sp-2')?.werbesperre?.grund).toMatch(/Abmeldelink/);
    expect(await abmeldenAnwenden(t)).toBe(0); // idempotent
    const { sperrlisteLaden } = await import('../lib/crm/sperrliste');
    const { betriebGesperrt } = await import('../lib/crm/betrieb-sperre');
    expect(betriebGesperrt(await sperrlisteLaden(), { name: 'Betrieb Abmeldung', email: `info@abmeldung.${D}` })).toBe(true);
  });
});
