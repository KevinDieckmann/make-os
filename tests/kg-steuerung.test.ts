// ─── Prüfung D „Steuerung, Erinnerung, Rechte“ (02.11.) — je Fund mindestens ein Fall ────────────────────────────────────────────────
// Erfundene Daten (@example.invalid), eigener Datenordner, kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';
import type { Kontakt } from '../lib/make-one/crm';
import type { CrmBestand, Kampagne, FollowUp, Firma } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { sequenzFollowupId } from '../lib/crm/kampagnen-post';
import { firmenKarten, firmaErgebnisImCrm, kampagneZuFirmaFollowup } from '../lib/crm/firma-karte';
import { werIstDran } from '../lib/crm/heute';
import { motorDranFuer } from '../lib/crm/motor-dran';
import { fuerDich } from '../lib/crm/team';
import { anstehendAbleiten } from '../lib/meldungen/regeln';
import { anstehendFuerSpace, type Anstehend } from '../lib/heute/anstehend';
import { taktFiltern, nurKiGesperrt, type Sperre } from '../lib/agenten/einstellung';
import { marketingKennzahlenMitQuellen, traktionsIndex } from '../lib/crm/traktion-index';
import { ANFRAGE_PRAEFIX } from '../lib/crm/marketing';
import { faelligeRhythmen } from '../lib/crm/scoreboard';
import { mediumSichtbar } from '../lib/medien/regeln';
import { steuernAus } from '../lib/zugang/steuern';
import { NEUIGKEITEN } from '../lib/neuigkeiten/eintraege';
import { teamWieKonten } from './fixtures/team-konten';
teamWieKonten();

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-kg-steuerung-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-kg-steuerung', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});

const HEUTE = '2026-11-02', JETZT = `${HEUTE}T09:00:00.000Z`;
const D = 'example.invalid';
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Betrieb ${id}`, rolle: 'offen', telefon: '+49 30 0000001', geaendert: JETZT, ...x } as Firma);
const SCHRITT = { id: 'sch-anruf', tagAbstand: 0, kanal: 'anruf' as const, leitfaden: 'Kurz vorstellen.' };
const kp = (id: string, x: Partial<Kampagne> = {}): Kampagne => ({ id: `kp-${id}`, name: `Kampagne ${id}`, playbook: 'homepage-funde', ziel: '', zielgruppe: {}, kanal: 'telefon', status: 'aktiv', start: HEUTE, schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: JETZT, ...x } as Kampagne);
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'firma', id: 'f-a' }, art: 'anruf', text: 'Kampagne: Anrufen', faellig: HEUTE, zustaendig: 'malin', status: 'offen', quelle: 'kampagne', angelegt: JETZT, geaendert: JETZT, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });

function motorBestand(): CrmBestand {
  const k = kp('m', { firmaIds: ['f-a'], sequenz: [SCHRITT] });
  const id = sequenzFollowupId(k.id, { art: 'firma', id: 'f-a' }, SCHRITT.id);
  return bestand({ firmen: [firma('a')], kampagnen: [k], followups: [fu(id, { notiz: 'Leitfaden: kurz vorstellen.' })] });
}

describe('Fund 1 · Betriebe ohne Person in der Power Hour', () => {
  it('fällige Firmen-Follow-ups werden Karten der zuständigen Person — mit Telefon der Firma, Leitfaden, Kampagne', () => {
    const crm = motorBestand();
    const a = werIstDran([], crm, HEUTE, 'malin');
    expect(a.firmen).toHaveLength(1);
    expect(a.firmen[0]).toMatchObject({ firmaId: 'f-a', telefon: '+49 30 0000001', kampagneId: 'kp-m', leitfaden: expect.stringContaining('Leitfaden') });
    const b = werIstDran([], crm, HEUTE, 'kevin');
    expect(b.firmen).toHaveLength(0);
    expect(b.ausgefiltert.beiAnderen).toBeGreaterThanOrEqual(1);
  });
  it('Betrieb mit Werbesperre, im Papierkorb oder mit Person → keine Firmen-Karte', () => {
    const crm = motorBestand();
    expect(firmenKarten({ ...crm, firmen: [firma('a', { werbesperre: { seit: HEUTE, grund: 'x' } })] }, HEUTE, null).karten).toHaveLength(0);
    expect(firmenKarten({ ...crm, firmen: [firma('a', { geloeschtAm: JETZT })] }, HEUTE, null).karten).toHaveLength(0);
    expect(firmenKarten({ ...crm, followups: crm.followups!.map(f => ({ ...f, kontaktId: 'c-x' })) }, HEUTE, null).karten).toHaveLength(0);
  });
  it('Ergebnis: nicht erreicht → das Follow-up wandert; Gespräch → erledigt + Ergebnis am Betrieb; Sperre → Werbesperre am Betrieb', () => {
    const crm = motorBestand();
    const id = crm.followups![0].id;
    expect(kampagneZuFirmaFollowup(crm.kampagnen, crm.followups![0])?.id).toBe('kp-m');
    const n = firmaErgebnisImCrm(crm, { followupId: id, ergebnis: 'nicht_erreicht', heute: HEUTE, jetzt: JETZT, von: 'malin', nochmalAm: '2026-11-04' });
    expect('crm' in n && n.wie).toBe('verschoben');
    if (!('crm' in n)) throw new Error('erwartet');
    expect(n.crm.followups![0]).toMatchObject({ status: 'offen', faellig: '2026-11-04' });
    const g = firmaErgebnisImCrm(crm, { followupId: id, ergebnis: 'gespraech', heute: HEUTE, jetzt: JETZT, von: 'malin' });
    if (!('crm' in g)) throw new Error('erwartet');
    expect(g.crm.followups![0]).toMatchObject({ status: 'erledigt', ergebnis: 'gespraech' });
    expect(g.crm.kampagnen[0].firmenErgebnisse).toEqual([{ firmaId: 'f-a', ergebnis: 'gespraech', am: HEUTE, von: 'malin' }]);
    const s = firmaErgebnisImCrm(crm, { followupId: id, ergebnis: 'sperre', heute: HEUTE, jetzt: JETZT, von: 'malin' });
    if (!('crm' in s)) throw new Error('erwartet');
    expect(s.crm.firmen[0].werbesperre).toBeTruthy();
    expect(firmaErgebnisImCrm(crm, { followupId: 'fu-unbekannt', ergebnis: 'gespraech', heute: HEUTE, jetzt: JETZT, von: 'malin' })).toMatchObject({ status: 404 });
  });
});

describe('Fund 2 · Mail-Stapel, Druckliste, Funde melden sich im Tagesgeschäft', () => {
  const kampagnen = [kp('m', { zustaendig: 'malin' }), kp('k', { playbook: 'empfehlung', zustaendig: 'kevin' })];
  const post = [
    { kampagneId: 'kp-m', kanal: 'mail', status: 'entwurf' }, { kampagneId: 'kp-m', kanal: 'mail', status: 'entwurf' },
    { kampagneId: 'kp-m', kanal: 'brief', status: 'entwurf' }, { kampagneId: 'kp-m', kanal: 'mail', status: 'gesendet' },
    { kampagneId: 'kp-k', kanal: 'mail', status: 'entwurf' },
  ];
  it('je Person nur das Eigene — Zahl und neutraler Satz', () => {
    const m = motorDranFuer('malin', kampagnen, post, [{ status: 'vorbereitet' }, { status: 'gesendet' }], 'kp-m');
    expect(m.map(x => [x.id, x.n])).toEqual([['mails', 2], ['briefe', 1], ['funde', 1]]);
    expect(m[0].titel).toBe('2 Kampagnen-Mails warten auf Freigabe');
    expect(motorDranFuer('kevin', kampagnen, post, [{ status: 'vorbereitet' }], 'kp-m').map(x => [x.id, x.n])).toEqual([['mails', 1]]);
  });
  it('Glocke: abgeleitet, Zahl in der Kennung, Business; Heute › Privat zeigt nichts davon', () => {
    const m = motorDranFuer('malin', kampagnen, post, [], 'kp-m');
    const leer = { termine: [], nachbereiten: [], fristen: [], followups: [] };
    const g = anstehendAbleiten({ ...leer, motor: m }, { heute: HEUTE, jetztWand: `${HEUTE}T09:00:00`, am: JETZT });
    expect(g.map(x => x.art)).toEqual(['kampagne', 'kampagne']);
    expect(g[0]).toMatchObject({ business: true, virtuell: true });
    expect(g[0].id).toContain('mails-2');
    const a = { heute: HEUTE, termine: [], nachbereiten: [], fristen: [], followups: [], buchungen: [], vorschlaege: { kalender: 0, gesamt: 0 }, geburtstage: [], nachbereitZeiten: {}, motor: m } as Anstehend;
    expect(anstehendFuerSpace(a, 'privat').motor).toEqual([]);
    expect(anstehendFuerSpace(a, 'business').motor).toHaveLength(2);
  });
  it('„Für dich“ nimmt dieselben Zeilen', () => {
    const m = motorDranFuer('malin', kampagnen, post, [], 'kp-m');
    const l = fuerDich('malin', [], bestand({ kampagnen }), HEUTE, m);
    expect(l.filter(x => x.id.startsWith('motor-')).map(x => x.anzahl)).toEqual([2, 1]);
  });
});

describe('Fund 3 · Homepage-Funde ohne Hintergrund-KI', () => {
  it('der Takt reiht sie ein (Regelwerk), nicht mehr als reiner KI-Lauf', async () => {
    const { KI_LAEUFE } = await import('../lib/zoe/takt');
    expect(KI_LAEUFE.has('funde')).toBe(false);
    const { OHNE_HINTERGRUND_KI } = await import('../lib/funde/lauf');
    expect(OHNE_HINTERGRUND_KI).toMatch(/Regelwerk/);
  });
});

describe('Fund 4 · Head-Budget sperrt nur die KI', () => {
  const budget: Sperre = { grund: 'budget', text: 'Budget' };
  const auftrag = (name: string, eingabe?: Record<string, unknown>) => ({ auftrag: { name, ...(eingabe ? { eingabe } : {}) } });
  it('Takt-Lauf eines Markttraktions-Heads bleibt, Faden und Head of Finance nicht', () => {
    const raus = taktFiltern([auftrag('head-sales'), auftrag('faden', { headId: 'sales' }), auftrag('finanzchef'), auftrag('hoi')], {} as never, () => budget);
    expect(raus.map(f => f.auftrag.name)).toEqual(['head-sales', 'hoi']);
    expect(nurKiGesperrt(budget, 'marketing')).toBe(true);
    expect(nurKiGesperrt(budget, 'finanzen')).toBe(false);
    expect(nurKiGesperrt({ grund: 'not-aus' }, 'sales')).toBe(false);
    expect(taktFiltern([auftrag('head-sales')], {} as never, () => ({ grund: 'aus', text: '' }))).toEqual([]);
  });
});

describe('Fund 5 · EINE Rechnung für Marketing-Kennzahlen', () => {
  it('Übersicht/Head rechnen mit Website und Social dieselben Werte wie der Traktions-Index', () => {
    const anfrage = (am: string, kanal: string) => ({ am: `${am}T10:00:00.000Z`, art: 'antwort' as const, text: `${ANFRAGE_PRAEFIX}${kanal}: Bitte um Rückruf`, von: 'malin' });
    const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
    const kontakte = [k('w', { aktivitaeten: [anfrage('2026-10-30', 'Website')] }), k('m', { aktivitaeten: [anfrage('2026-10-29', 'Mail')] })];
    const crm = bestand();
    const quellen = { webseite: { aktiv: true, checks: [] }, social: { posts: [{ folgeId: 'sv-1', kanalName: 'Kanal', titel: 'Folge', tag: '2026-10-31', plattformen: ['instagram'] }] } };
    const mk = marketingKennzahlenMitQuellen({ kontakte, crm, heute: HEUTE, ...quellen });
    const idx = traktionsIndex({ kontakte, crm, heute: HEUTE, ...quellen }).saeulen.flatMap(s => s.kennzahlen);
    for (const id of ['anfragen_90', 'veroeffentlichungen']) expect(mk.find(x => x.id === id)!.wert, id).toBe(idx.find(x => x.id === id)!.wert);
    expect(mk.find(x => x.id === 'veroeffentlichungen')!.wert).toBe(1); // die Social-Folge zählt mit
    expect(mk.some(x => x.id === 'web_anfragen')).toBe(true);
  });
});

describe('Fund 6 · „Personen aus deinen Kampagnen“ ohne Motor-Kampagnen', () => {
  it('Kampagnen mit Sequenz zählen nicht als „noch nicht angesprochen“; fällige Schritte eigene Zeile', () => {
    const ohne = kp('a', { zustaendig: 'malin', kontaktIds: ['c-1', 'c-2'] });
    const mit = kp('b', { zustaendig: 'malin', kontaktIds: ['c-3'], sequenz: [SCHRITT], zielStaende: [{ art: 'kontakt', id: 'c-3', schritt: 0, schrittId: SCHRITT.id, faelligAm: HEUTE, status: 'offen', verlauf: [] }] });
    const l = fuerDich('malin', [], bestand({ kampagnen: [ohne, mit] }), HEUTE);
    expect(l.find(x => x.id === 'kampagnen')?.anzahl).toBe(2);
    expect(l.find(x => x.id === 'kampagnen-schritte')?.anzahl).toBe(1);
  });
});

describe('Fund 7 · Morgen-Nachricht nach Berliner Wandzeit', () => {
  it('auch wenn die Maschine in UTC läuft', () => {
    const alt = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      // Montag 02.11.2026, 07:45 Berlin = 06:45 UTC (Winterzeit) — fällig; 07:15 Berlin nicht.
      expect(faelligeRhythmen({}, ['malin'], new Date('2026-11-02T06:45:00Z'))).toEqual([{ person: 'malin', slot: 'morgen' }]);
      expect(faelligeRhythmen({}, ['malin'], new Date('2026-11-02T06:15:00Z'))).toEqual([]);
      // Sonntag 23:30 UTC ist schon Montag 00:30 Berlin — kein Morgen-Fenster.
      expect(faelligeRhythmen({}, ['malin'], new Date('2026-11-01T23:30:00Z'))).toEqual([]);
    } finally { process.env.TZ = alt; }
  });
});

describe('Fund 8 · Social-Medienlink (nicht bestätigt)', () => {
  it('ein Medium des Business-Katalogs sieht jede Person im Haushalt — auch der Haupt-Inhaber; private Bibliotheken liest der Link nie', () => {
    const m = { bereich: 'business' } as never;
    const q = { art: 'business', katalog: { medien: [], alben: [] } } as never;
    expect(mediumSichtbar(m, q, { person: 'kevin', haushalt: 'h', voll: true, marketing: false } as never)).toBe(true);
  });
});

describe('Fund 9 · EINE Regel fürs Steuern (rein)', () => {
  const st = { konten: [
    { speicher: 'kevin', rolle: 'inhaber', haushalt: 'h' }, { speicher: 'malin', rolle: 'mitglied', haushalt: 'h' },
    { speicher: 'partner', rolle: 'mitglied', haushalt: 'h', finanzRecht: 'business' }, { speicher: 'gast', rolle: 'mitglied', haushalt: 'anders' },
    { speicher: 'kunde', rolle: 'mitglied' },
  ] } as never;
  it('Inhaber und volles Mitglied ja — Konto „nur Business“, fremder Haushalt, Testkunde, niemand nein', () => {
    expect(steuernAus(st, 'kevin')).toBe(true);
    expect(steuernAus(st, 'malin')).toBe(true);
    expect(steuernAus(st, 'partner')).toBe(false);
    expect(steuernAus(st, 'gast')).toBe(false);
    expect(steuernAus(st, 'kunde')).toBe(false);
    expect(steuernAus(st, null)).toBe(false);
  });
});

// ── Laufzeit: die Routen ────────────────────────────────────────────────────────────────────────────────────────────────────────
type H = (r: Request) => Promise<Response>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
async function rufe(pfad: string, methode: 'POST' | 'PUT', kopf: Record<string, string>, body: unknown): Promise<number> {
  const m = await import(`@/app/api/${pfad}/route`) as unknown as Record<string, H>;
  return (await m[methode](new Request(`http://test/api/${pfad}`, { method: methode, headers: kopf, body: JSON.stringify(body) }))).status;
}
let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@${D}`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'inhaber', { haushalt: 'h' }), konto('k2', 'malin', 'mitglied', { haushalt: 'h' }),
    konto('k3', 'partner', 'mitglied', { haushalt: 'h', finanzRecht: 'business' }), konto('k4', 'gast', 'mitglied', { haushalt: 'anders' }), konto('k5', 'kunde', 'mitglied'),
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', leererBestand());
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Fund 9 · Laufzeit: volles Mitglied darf, Konto „nur Business“ / fremder Haushalt / Testkunde / Dienstweg nicht', () => {
  const FAELLE: [string, 'POST' | 'PUT', unknown][] = [
    ['crm/kampagnen/motor', 'POST', { aktion: 'einstellungen', tagesgrenze: 20 }],
    ['kontaktformular/intern', 'POST', { aktiv: false }],
    ['state/agents', 'PUT', {}],
  ];
  it.each(FAELLE)('%s %s', async (pfad, m, body) => {
    expect(await rufe(pfad, m, sitzung('malin'), body), 'volles Mitglied').toBe(200);
    expect(await rufe(pfad, m, sitzung('partner'), body), 'Konto „nur Business“').toBe(403);
    expect(await rufe(pfad, m, sitzung('gast'), body), 'fremder Haushalt').toBe(403);
    expect(await rufe(pfad, m, sitzung('kunde'), body), 'Testkunde').toBe(403);
  });
  it('Dienstweg (ZOE) setzt die Versand-Einstellungen nie', async () => {
    expect(await rufe('crm/kampagnen/motor', 'POST', dienst('malin'), { aktion: 'einstellungen', tagesgrenze: 20 })).toBe(403);
  });
  it('Selbstbild schreiben: Konto „nur Business“ → 403', async () => {
    expect(await rufe('zoe/selbstbild', 'POST', sitzung('partner'), {})).toBe(403);
  });
});

describe('Neuigkeit', () => {
  it('steht oben, neutral', () => {
    // Seit 02.11. stehen spätere Updates darüber — der Eintrag bleibt in der Liste.
    const n = NEUIGKEITEN.find(x => x.id === 'u-2026-11-02-13');
    expect(n).toBeTruthy();
    expect(JSON.stringify(n)).not.toMatch(/Malin|Kevin/);
  });
});
