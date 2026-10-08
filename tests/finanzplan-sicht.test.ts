// ─── Finanzplanung — Sichten Privat und Business (04.10.) ─────────────────────────────────────────
// Kevin 04.10.: „Business ist bei Business sichtbar, kein Privat. Bei Privat kann man alles sehen … Im Business-Bereich sieht man
// Privat nicht.“ Wächter: die Business-Sicht liefert keine private Zeile, kein privates Ziel, keine private Buchung und keinen privaten
// Betrag aus; Schreiben auf Privat-Pfade wird abgelehnt (403); die Business-Zahlen sind dieselben wie in der vollen Sicht.
// Erfundene Zahlen und Namen — nie echte.
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit } from '../lib/finanzen/szenarien';
import { businessSicht, businessPfadErlaubt, pfadIstBusiness, bereichAus, fuerSicht, nurBusinessPunkte, wirksameSicht } from '../lib/finanzen/plan/sicht';
import { bereicheFuer, unterseiteFuer, finanzplanAdresse, NUR_PRIVAT_UNTERSEITEN } from '../lib/finanzen/plan/hilfen';
import { wendeOperationenAn, pruefeDokument } from '../lib/finanzen/plan/operationen';
import { aktiverSpaceEintrag, leisteFuer } from '../lib/make-one/spaces';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fp-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-sicht';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzen' }));

const JETZT = '2026-10-04T10:00:00.000Z';
/** Private Merkmale, die nie in der Business-Sicht auftauchen dürfen (erfunden). */
const GEHEIM = ['Geheimmiete', 'Geheimjob', 'Geheimkredit', 'Privatempfaenger', 'Geheimnotiz', 'Geheimentscheidung', 'Geheimziel', 'Geheimposten', 'Geheimschuld', 'Geheimereignis', 'Geheimbaustein', 'Geheimcheck', '7777.77', '4321.09',
  // finanzplan-5 (05.10.): die Selbstständigkeit gehört zu Privat — ihre Merkmale dürfen ebenso nie in die Business-Sicht.
  'Geheimselbst', 'Geheimbuero', 'Geheimhonorar', 'Geheimkontoselbst', 'Selbstkunde', 'Geheimdarlehen', '6543.21', '8765.43'];

function planMitPrivat(): FinanzDaten {
  const d = planFix(14000);
  const ps = arbeitsplanFix();
  ps.bausteine.push({ id: 'bp', art: 'kosten', einheit: 'privat', kostenArt: 'miete', name: 'Geheimbaustein', preis: 4321.09, menge: 1, rhythmus: 'monatlich', start: 2, an: true });
  ps.annahmen.ausschuettungSteuer = 0.3;
  ps.bausteine.push({ id: 'bk', art: 'umsatz', einheit: 'kdc', name: 'Geheimselbst', kunde: 'Selbstkunde', preis: 6543.21, menge: 1, rhythmus: 'monatlich', start: 1, an: true });
  ps.annahmen.entnahme = { betrag: 8765.43, ab: 2 };
  ps.annahmen.steuern = { kdc: { param: { veranlagung: 'zusammen' } }, ug: { zeilen: { gewst: { hebesatz: 410 } } } };
  return {
    ...d,
    planszenarien: [ps], arbeitsplan: ps.id,
    privatBudget: [...d.privatBudget, { id: 'p.b.geheim', name: 'Geheimmiete', einheit: 'privat', gruppe: 'Fixkosten', soll: 7777.77, typ: 'fix' }],
    privatEinnahmen: [{ id: 'p.e.geheim', name: 'Geheimjob', einheit: 'privat', gruppe: 'Einnahmen', soll: 1234, ab: 1 }],
    privatSchulden: [{ id: 'p.d.geheim', name: 'Geheimkredit', einheit: 'privat', gruppe: 'Schulden', soll: 99, ab: 1 }],
    sachkosten: [...d.sachkosten, { id: 'sk-selbst', name: 'Geheimbuero', einheit: 'selbststaendigkeit', gruppe: 'Räume', soll: 6543.21, ab: 1 }],
    selbst: { ...d.selbst, posten: [{ id: 'sp-g', name: 'Geheimhonorar', art: 'einnahme', betrag: 6543.21, status: 'bezahlt' }], lohnVorPlan: 8765.43 },
    steuern: { kdc: { param: { werbungskosten: 6543.21 } }, ug: { zeilen: { gewst: { hebesatz: 400 } } } },
    darlehen: [
      { id: 'dl-p', name: 'Geheimdarlehen', geber: 'privat', nehmer: 'kdc', betrag: 8765.43, aus: 0, zurueck: 4 },
      { id: 'dl-k', name: 'Gesellschafterdarlehen an KDV', geber: 'privat', nehmer: 'kdv', betrag: 1500, aus: 0, zurueck: 6, notiz: 'Geheimnotiz' },
      { id: 'dl-b', name: 'Zwischen den Gesellschaften', geber: 'ug', nehmer: 'kdv', betrag: 2000, aus: 2, zurueck: 8 },
    ],
    buchungen: [
      { id: 'bp1', d: '2026-09-02', b: -7777.77, n: 'Privatempfaenger', k: 'giro', z: 'p.b.geheim' },
      { id: 'bb1', d: '2026-09-03', b: -250, n: 'Softwarehaus', k: 'firma', z: 'sk1', e: 'ug' },
      { id: 'bs1', d: '2026-09-04', b: -6543.21, n: 'Geheimbuero', k: 'selbst', z: 'sk-selbst', e: 'selbststaendigkeit' },
    ],
    regeln: { privatempfaenger: 'p.b.geheim' },
    ziele: [
      { id: 'zp', name: 'Geheimziel', quelle: 'privat.angespart', ziel: 7777.77, bis: '2027-12', einheit: 'privat' },
      { id: 'zg', name: 'Gruppe', quelle: 'gruppe', ziel: 50000, bis: '2028-12', einheit: 'privat' },
      { id: 'zb', name: 'MAKE frei', quelle: 'ug.frei', ziel: 5000, bis: '2028-06', einheit: 'ug' },
    ],
    check: { punkte: ['Geheimcheck'], eintraege: [{ datum: '2026-09-28', wer: ['kevin'], erledigt: [0], notiz: 'Geheimcheck' }] },
    notizen: { 'p.b.geheim:3': 'Geheimnotiz', 'sk1:3': 'Software-Notiz', 'p.luft:2': 'Geheimnotiz' },
    fokus: { saetze: ['Geheimentscheidung'], regeln: [], schritte: [], entscheidung: 'Geheimentscheidung' },
    posten: [
      { id: 'xp', art: 'konto', einheit: 'privat', name: 'Geheimposten', betrag: 7777.77, status: 'eintragen' },
      { id: 'xb', art: 'konto', einheit: 'ug', name: 'Firmenkonto', betrag: 5000, status: 'eintragen' },
      { id: 'xs', art: 'konto', einheit: 'selbststaendigkeit', name: 'Geheimkontoselbst', betrag: 6543.21, status: 'eintragen' },
    ],
    schulden: [
      { id: 'sp', name: 'Geheimschuld', einheit: 'privat', rest: 7777.77, rate: 100, zins: 3, start: 1, status: 'läuft' },
      { id: 'sb', name: 'Firmenkredit', einheit: 'ug', rest: 5000, rate: 200, zins: 4, start: 1, status: 'läuft' },
    ],
    szenarien: d.szenarien.map(s => ({ ...s, ereignisse: [...(s.ereignisse ?? []), { id: 'ep', name: 'Geheimereignis', einheit: 'privat', betrag: 7777.77, monat: 5 }] })),
    abschluesse: [{ idx: 8, wer: 'kevin', wann: JETZT, uebertrag: 7777.77 }],
    schwellen: { privatLuftGut: 4321.09 },
    plan: { ...d.plan, 'p.b.geheim:4': 7777.77, 'p.luft:3': 4321.09, 'g.frei:5': 1, 'p.kevinNetto:2': 4321.09, 'ug.konto:4': 10000, 'sk1:5': 300, 'ab.est:0': 50, 'kdc.konto:3': 6543.21, 'kdc.umsatz@ps1:2': 8765.43, 'sk-selbst:2': 6543.21 },
    ist: { 'p.b.geheim:1': 7777.77, 'sk1:1': 260 },
    meta: { 'p.b.geheim:4': { wer: 'malin', wann: JETZT }, 'ug.konto:4': { wer: 'kevin', wann: JETZT } },
    protokoll: [
      { wer: 'malin', wann: JETZT, feld: 'Geheimmiete · Jan 27', alt: '1', neu: '7777.77', pfad: '/plan/p.b.geheim:4' },
      { wer: 'kevin', wann: JETZT, feld: 'Kontostand · Jan 27', alt: '', neu: '10000', pfad: '/plan/ug.konto:4' },
      { wer: 'kevin', wann: JETZT, feld: 'Geheimmiete (alt, ohne Pfad)', alt: '', neu: '7777.77' },
      { wer: 'kevin', wann: JETZT, feld: 'Geheimbaustein gelöscht', alt: 'Geheimbaustein', neu: 'zurückgesetzt', pfad: '/planszenarien/id=ps1/bausteine/id=weg' },
    ],
  };
}

describe('Business-Sicht: Privat wird gar nicht ausgeliefert', () => {
  const voll = planMitPrivat();
  const b = businessSicht(voll);
  it('Wächter: kein privates Merkmal (Name, Betrag, Notiz) in der gefilterten Antwort', () => {
    const json = JSON.stringify(b);
    for (const g of GEHEIM) expect(json.includes(g), g).toBe(false);
    // Das Original bleibt unverändert (rein).
    expect(JSON.stringify(voll)).toContain('Geheimmiete');
  });
  it('keine Privat-Zeile, kein privates Ziel, keine private Buchung, kein privater Plan-/IST-Schlüssel, Protokoll nur Business', () => {
    expect(b.privatEinnahmen).toEqual([]); expect(b.privatBudget).toEqual([]); expect(b.privatSchulden).toEqual([]);
    expect(b.ziele.map(z => z.id)).toEqual(['zb']);
    expect(b.buchungen.map(x => x.id)).toEqual(['bb1']);
    expect(b.posten.map(x => x.id)).toEqual(['xb']); expect(b.schulden.map(x => x.id)).toEqual(['sb']);
    // finanzplan-5: Selbstständigkeit weg — Sachkosten-Zeile, Bausteine, Abschluss, Steuerprofil, Entnahme, Szenario-Steuern der Selbstständigkeit.
    expect(b.sachkosten.map(z => z.id)).toEqual(['sk1', 'sk2']);
    expect(b.planszenarien?.[0].bausteine.some(x => x.einheit === 'kdc')).toBe(false);
    expect(b.selbst).toEqual({ posten: [], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 0 });
    expect(b.steuern).toEqual({ ug: { zeilen: { gewst: { hebesatz: 400 } } } });
    expect(b.planszenarien?.[0].annahmen.entnahme).toBeUndefined();
    expect(b.planszenarien?.[0].annahmen.steuern).toEqual({ ug: { zeilen: { gewst: { hebesatz: 410 } } } });
    // Darlehen: rein privat (Privat → Selbstständigkeit) fehlt ganz; Privat → KDV nur von der Gesellschaft aus (Geber „außerhalb“, ohne Notiz,
    // neutraler Name — Gegenprüfung 05.10., der frei gewählte Name ist privat); MAKE → KDV voll.
    expect(b.darlehen).toEqual([
      { id: 'dl-k', name: 'Darlehen (privat)', geber: 'extern', nehmer: 'kdv', betrag: 1500, aus: 0, zurueck: 6 },
      { id: 'dl-b', name: 'Zwischen den Gesellschaften', geber: 'ug', nehmer: 'kdv', betrag: 2000, aus: 2, zurueck: 8 },
    ]);
    // 05.10.: `ab.est:0` (Abschluss der Selbstständigkeit) und alle kdc-Werte sind privat.
    expect(Object.keys(b.plan).sort()).toEqual(['sk1:5', 'ug.events:9', 'ug.konto:4']);
    expect(Object.keys(b.ist)).toEqual(['sk1:1']); expect(Object.keys(b.notizen)).toEqual(['sk1:3']); expect(Object.keys(b.meta)).toEqual(['ug.konto:4']);
    expect(b.regeln).toEqual({}); expect(b.check.eintraege).toEqual([]); expect(b.fokus.entscheidung).toBeUndefined(); expect(b.abschluesse).toEqual([]);
    expect('schwellen' in b).toBe(false);
    expect(b.annahmen.nettoTabelle).toEqual([[0, 0], [1, 1]]);
    expect(b.planszenarien?.[0].bausteine.some(x => x.einheit === 'privat')).toBe(false);
    expect(b.planszenarien?.[0].annahmen.ausschuettungSteuer).toBeUndefined();
    expect(b.szenarien[0].ereignisse?.some(e => e.einheit === 'privat')).toBe(false);
    expect(b.protokoll.map(p => p.feld)).toEqual(['Kontostand · Jan 27']);
  });
  it('die Business-Zahlen sind dieselben wie in der vollen Sicht (MAKE, KD Ventures — die Selbstständigkeit gehört seit 05.10. zu Privat)', () => {
    const a = rechneMit(voll, voll.planszenarien![0]), c = rechneMit(b, b.planszenarien![0]);
    expect(JSON.stringify(c.ug)).toBe(JSON.stringify(a.ug));
    // Die Darlehen mit privater Seite wirken in der Business-Sicht genauso auf KD Ventures (Rückzahlung Monat 6, MAKE → KDV Monat 2/8).
    expect(c.ug[5].kdvDarlehenAus).toBe(1500); expect(c.ug[1].kdvDarlehenEin).toBe(2000); expect(c.ug[1].darlehen).toBe(2000);
    expect(c.ug[7].kdvDarlehenAus).toBe(2000); expect(c.ug[7].darlehenEin).toBe(2000);   // Rückzahlung: KDV gibt zurück, MAKE (Geber) bekommt zurück
  });
  it('bleibt ein gültiges Dokument (die Prüfung läuft durch) und ist idempotent', () => {
    expect(pruefeDokument(JSON.parse(JSON.stringify(b))).ok).toBe(true);
    expect(JSON.stringify(businessSicht(b))).toBe(JSON.stringify(b));
    expect(fuerSicht(voll, 'privat')).toBe(voll);
  });
  it('Handwerte je Szenario (Nachtrag 04.10.): Business-Schlüssel bleiben, private fallen weg; Schreiben ebenso geprüft', () => {
    const d = { ...voll, plan: { ...voll.plan, 'ug.konto@ps1:5': 1, 'p.luft@ps1:5': 4321.09, 'p.b.geheim@ps1:2': 7777.77 } };
    const bs = businessSicht(d);
    expect(bs.plan['ug.konto@ps1:5']).toBe(1);
    expect('p.luft@ps1:5' in bs.plan || 'p.b.geheim@ps1:2' in bs.plan).toBe(false);
    expect(businessPfadErlaubt('/plan/ug.konto@ps1:6', d, 2)).toBeNull();
    expect(businessPfadErlaubt('/plan/p.luft@ps1:6', d, 2)).not.toBeNull();
  });
  it('Punkte „Was jetzt zu entscheiden ist“ ohne Privat', () => {
    expect(nurBusinessPunkte([{ id: 'privat-minus' }, { id: 'ug-minus' }, { id: 'konten' }, { id: 'netto' }, { id: 'privat-runway' }, { id: 'steuer' }]).map(p => p.id)).toEqual(['ug-minus', 'steuer']);
  });
});

describe('Business-Sicht: Schreibschutz für Privat-Pfade', () => {
  const d = planMitPrivat();
  const nein = (pfad: string, neu?: unknown) => expect(businessPfadErlaubt(pfad, d, neu), pfad).not.toBeNull();
  const ja = (pfad: string, neu?: unknown) => expect(businessPfadErlaubt(pfad, d, neu), pfad).toBeNull();
  it('Privat-Bereiche und -Zellen: abgelehnt', () => {
    nein('/privatBudget/id=pb1/soll', 1); nein('/privatEinnahmen/-', {}); nein('/privatSchulden/id=ps1'); nein('/check/eintraege/-', {}); nein('/fokus/entscheidung', 'x');
    nein('/regeln/rewe', 'pb1'); nein('/schwellen/privatLuftGut', 1); nein('/abschluesse/-', {});
    nein('/plan/pb1:3', 5); nein('/plan/p.luft:3', 5); nein('/plan/p.kevinNetto:3', 5); nein('/plan/g.frei:3', 5); nein('/ist/pb1:1', 5); nein('/notizen/pb1:3', 'x');
    nein('/annahmen/nettoTabelle', [[0, 0], [1, 1]]);
    nein('/planszenarien/id=ps1/bausteine/id=bp/preis', 1); nein('/planszenarien/id=ps1/bausteine/-', { id: 'n', einheit: 'privat' }); nein('/planszenarien/id=ps1/bausteine/id=b1/einheit', 'privat');
    nein('/planszenarien/id=ps1/annahmen/ausschuettungSteuer', 0.2);
    nein('/szenarien/id=s1/ereignisse/id=ep/betrag', 1); nein('/szenarien/id=s1/ereignisse/-', { id: 'n', einheit: 'privat' });
    nein('/buchungen/id=bp1/z', 'sk1'); nein('/buchungen/id=bb1/e', 'privat'); nein('/posten/id=xp/betrag', 1); nein('/schulden/id=sp/rest', 1);
    nein('/ziele/id=zp/ziel', 1); nein('/ziele/id=zb/quelle', 'privat.angespart'); nein('/ziele/-', { id: 'n', quelle: 'gruppe', einheit: 'privat' });
    nein('/steuern/privat/zeilen/ust/an', true); nein('/sachkosten/-', { id: 'x', einheit: 'privat' }); nein('/unbekannt', 1);
    // finanzplan-5: Selbstständigkeit = Privat.
    nein('/plan/kdc.est:3', 1); nein('/plan/ab.est:0', 1); nein('/plan/kdc.konto@ps1:4', 1); nein('/selbst/vorsorge', 1); nein('/selbst/posten/-', {});
    nein('/plan/sk-selbst:3', 1); nein('/sachkosten/id=sk-selbst/soll', 1); nein('/sachkosten/-', { id: 'x', einheit: 'selbststaendigkeit' }); nein('/sachkosten/id=sk1/einheit', 'selbststaendigkeit');
    nein('/planszenarien/id=ps1/bausteine/id=bk/preis', 1); nein('/planszenarien/id=ps1/bausteine/-', { id: 'n', einheit: 'kdc' }); nein('/planszenarien/id=ps1/bausteine/id=b1/einheit', 'kdc');
    nein('/planszenarien/id=ps1/annahmen/entnahme', { betrag: 1, ab: 1 }); nein('/planszenarien/id=ps1/annahmen/steuern/kdc/param/veranlagung', 'einzeln');
    nein('/steuern/kdc/param/werbungskosten', 1); nein('/posten/-', { id: 'n', einheit: 'selbststaendigkeit' }); nein('/buchungen/id=bs1/z', 'sk1');
    nein('/darlehen', []); nein('/darlehen/id=dl-p/betrag', 1); nein('/darlehen/id=dl-k/betrag', 1); nein('/darlehen/-', { id: 'dl-n', geber: 'privat', nehmer: 'kdv', betrag: 1 });
    nein('/darlehen/id=dl-b/geber', 'kdc'); nein('/darlehen/id=gibtsnicht/betrag', 1);
  });
  it('Business-Pfade: erlaubt', () => {
    ja('/plan/ug.konto:5', 1); ja('/plan/sk1:5', 1); ja('/ist/sk1:2', 3); ja('/notizen/ug.konto:5', 'x');
    ja('/darlehen/id=dl-b/betrag', 2500); ja('/darlehen/-', { id: 'dl-n', geber: 'extern', nehmer: 'kdv', betrag: 1 }); ja('/darlehen/id=dl-b/nehmer', 'extern');
    ja('/annahmen/kevinBrutto', 3000); ja('/sachkosten/id=sk1/soll', 300); ja('/sachkosten/-', { id: 'n', einheit: 'ug' });
    ja('/planszenarien/id=ps1/bausteine/id=b1/preis', 1); ja('/planszenarien/id=ps1/bausteine/-', { id: 'n', einheit: 'ug' }); ja('/planszenarien/id=ps1/annahmen/ausschuettung', { betrag: 1, ab: 2 });
    ja('/szenarien/id=s1/ob/betrag', 1); ja('/szenarien/id=s1/ereignisse/id=e2/betrag', 1); nein('/aktiv', 's1'); nein('/arbeitsplan', 'ps1'); // gemeinsame Wahl wirkt auf Privat (05.10. spät)
    ja('/steuern/ug/zeilen/kst/satz', 0.15); ja('/buchungen/id=bb1/z', 'sk2'); ja('/posten/id=xb/betrag', 1); ja('/schulden/id=sb/rate', 1);
    ja('/ziele/id=zb/ziel', 1); ja('/ziele/-', { id: 'n', quelle: 'ug.frei', einheit: 'ug' }); ja('/einstellungen/reserveMonate', 2); nein('/einstellungen', { heute: '2020-01-01', reserveMonate: 1 }); ja('/einstellungen/heute', heuteBerlin()); nein('/einstellungen/heute', '2020-01-01');
  });
  it('Protokoll: Business nur mit Pfad und auffindbarem Eintrag', () => {
    expect(pfadIstBusiness('/plan/ug.konto:4', d)).toBe(true);
    expect(pfadIstBusiness('/plan/p.b.geheim:4', d)).toBe(false);
    expect(pfadIstBusiness('/planszenarien/id=ps1/bausteine/id=weg', d)).toBe(false);
    const r = wendeOperationenAn(d, [{ pfad: '/plan/ug.konto:6', neu: 1 }], 'kevin', JETZT);
    expect(r.protokoll[0].pfad).toBe('/plan/ug.konto:6');
  });
});

describe('Route: Business-Bereich nie Privat (für jeden), Privat-Bereich alles; ohne Privat-Recht nie Privat (05.10.)', () => {
  type Mod = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
  let plan: Mod;
  const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person });
  const req = (url: string, body?: unknown, method = 'GET', person = 'kevin') => new Request(`http://test${url}`, { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const lade = async (url: string, person: string) => JSON.parse(await (await plan.GET(req(url, undefined, 'GET', person))).text()) as { sicht: string; dokument: FinanzDaten } & Record<string, unknown>;
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: string, extra: Record<string, unknown> = {}) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-sicht', ...extra });
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
    const sp = await import('@/lib/finanzen/plan/speicher');
    await sp.importieren('test-sicht', planMitPrivat(), false, 'kevin', 'Test');
    plan = (await import('@/app/api/finanzplan/route')) as unknown as Mod;
  });
  afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
  it('Wächter: die Business-Sicht enthält nie Privates — für jede Person (Dokument und Kennzahlen)', async () => {
    for (const person of ['kevin', 'malin', 'partner']) {
      const j = await lade('/api/finanzplan?sicht=business', person);
      expect(j.sicht, person).toBe('business');
      const text = JSON.stringify(j);
      for (const g of GEHEIM) expect(text.includes(g), `${person}: ${g}`).toBe(false);
      expect(j.dokument.privatBudget, person).toEqual([]);
      const k = await lade('/api/finanzplan?nur=kennzahlen&sicht=business', person);
      expect(Object.keys(k).filter(x => /privat|gruppe|kdc|selbst/i.test(x)), person).toEqual([]);
    }
  });
  it('Wächter: die Privat-Sicht enthält Business (und Privat) — für den Haushalt des Inhabers', async () => {
    for (const person of ['kevin', 'malin']) {
      const j = await lade('/api/finanzplan', person);
      expect(j.sicht).toBe('privat');
      expect(JSON.stringify(j.dokument)).toContain('Geheimmiete');
      expect(j.dokument.sachkosten.some(z => z.einheit === 'ug')).toBe(true);
      expect(j.dokument.planszenarien?.[0].bausteine.some(b => b.einheit === 'ug')).toBe(true);
      expect(j.dokument.plan['ug.konto:4']).toBe(10000);
      expect(await lade('/api/finanzplan?nur=kennzahlen', person)).toHaveProperty('runwayPrivat');
    }
  });
  it('ohne Privat-Recht gibt es Privat auch mit ?sicht=privat nicht; kein Zugang zu den Haushaltsfinanzen', async () => {
    for (const url of ['/api/finanzplan', '/api/finanzplan?sicht=privat']) {
      const j = await lade(url, 'partner');
      expect(j.sicht).toBe('business');
      for (const g of GEHEIM) expect(JSON.stringify(j).includes(g), g).toBe(false);
    }
    const { haushaltFuer, planZugangFuer } = await import('@/lib/finanzen/haushalt/zugriff');
    expect(await haushaltFuer('partner')).toBeNull();
    expect(await planZugangFuer('partner')).toMatchObject({ haushalt: 'test-sicht', sicht: 'business' });
  });
  it('Schreiben aus dem Business-Bereich auf Privat → 403 (auch für den Inhaber); Business geht; 409 nur Business; Privat-Bereich bearbeitet Business', async () => {
    const stand = (await lade('/api/finanzplan?sicht=business', 'kevin')).dokument.stand;
    const verboten = await plan.PATCH(req('/api/finanzplan?sicht=business', { basisStand: stand, ops: [{ pfad: '/plan/ug.konto:5', neu: 1 }, { pfad: '/privatBudget/id=pb1/soll', neu: 1 }] }, 'PATCH', 'kevin'));
    expect(verboten.status).toBe(403);
    const ok = await plan.PATCH(req('/api/finanzplan?sicht=business', { basisStand: stand, ops: [{ pfad: '/plan/ug.konto:5', neu: 4242 }] }, 'PATCH', 'kevin'));
    expect(ok.status).toBe(200);
    const alt = await plan.PATCH(req('/api/finanzplan?sicht=business', { basisStand: stand, ops: [{ pfad: '/plan/ug.konto:6', neu: 1 }] }, 'PATCH', 'malin'));
    expect(alt.status).toBe(409);
    const text = await alt.text();
    for (const g of GEHEIM) expect(text.includes(g), g).toBe(false);
    const partner = await plan.PATCH(req('/api/finanzplan?sicht=privat', { basisStand: (await lade('/api/finanzplan', 'partner')).dokument.stand, ops: [{ pfad: '/privatBudget/id=pb1/soll', neu: 2 }] }, 'PATCH', 'partner'));
    expect(partner.status).toBe(403);
    // Privat-Bereich: Privat UND Business bearbeitbar.
    const st2 = (await lade('/api/finanzplan', 'kevin')).dokument.stand;
    const privat = await plan.PATCH(req('/api/finanzplan', { basisStand: st2, ops: [{ pfad: '/privatBudget/id=pb1/soll', neu: 1300 }, { pfad: '/plan/ug.konto:7', neu: 777 }] }, 'PATCH', 'kevin'));
    expect(privat.status).toBe(200);
    const voll = (await lade('/api/finanzplan', 'kevin')).dokument;
    expect(voll.privatBudget.find(z => z.id === 'pb1')?.soll).toBe(1300);
    expect(voll.plan['ug.konto:5']).toBe(4242); expect(voll.plan['ug.konto:7']).toBe(777);
  });
});

describe('Navigation und Deep-Links', () => {
  it('Reiter „Finanzplanung“ hängt am richtigen Space; kein Eintrag mehr unter den Agenten', () => {
    expect(aktiverSpaceEintrag('/os/finanzen', '?s=finanzplanung&space=business&u=ug')).toMatchObject({ space: 'business', eintrag: { label: 'Finanzen' } });
    expect(aktiverSpaceEintrag('/os/finanzen', '?s=finanzplanung&space=privat&u=privat')).toMatchObject({ space: 'privat', eintrag: { label: 'Finanzen' } });
    expect(aktiverSpaceEintrag('/os/finanzplan', '?u=lage').space).toBe('privat');
    // 08.10. (Aufräumen Etappe 1): es gibt keine eigenen Knöpfe neben den Spaces mehr — Finanzplanung ist kein Leisten-Punkt.
    expect([...leisteFuer('privat'), ...leisteFuer('business')].some(e => e.href === '/os/finanzplan')).toBe(false);
  });
  it('alte Links /os/finanzplan?… landen mit allen Parametern in der Privat-Sicht', () => {
    expect(finanzplanAdresse('privat', new URLSearchParams('u=buchungen&monat=8&zeile=pb1'))).toBe('/os/finanzen?s=finanzplanung&space=privat&u=buchungen&monat=8&zeile=pb1');
    expect(finanzplanAdresse('business', { u: 'ug', steuern: '1', leer: '' })).toBe('/os/finanzen?s=finanzplanung&space=business&u=ug&steuern=1');
    expect(finanzplanAdresse('privat', new URLSearchParams('s=x&space=business&u=lage'))).toBe('/os/finanzen?s=finanzplanung&space=privat&u=lage');
  });
  it('Business-Sicht: keine privaten Bereiche; private Unterseite fällt auf die Lage zurück', () => {
    const alle = bereicheFuer('business').flatMap(b => b.unter.map(u => u.id));
    expect(bereicheFuer('business').some(b => b.id === 'privat')).toBe(false);
    for (const u of NUR_PRIVAT_UNTERSEITEN) expect(alle).not.toContain(u);
    expect(alle).toEqual(expect.arrayContaining(['lage', 'planen', 'szenarien', 'ug', 'kdv', 'gesamt', 'buchungen', 'posten', 'kalender', 'schulden', 'ziele', 'toepfe', 'protokoll']));
    // finanzplan-5 (05.10.): die Selbstständigkeit ist eine Unterseite von Privat — in Business gibt es sie nicht.
    expect(alle).not.toContain('selbst'); expect(unterseiteFuer('selbst', 'business')).toBe('lage');
    expect(bereicheFuer('privat').find(b => b.id === 'privat')?.unter.map(u => u.id)).toEqual(['privat', 'selbst']);
    expect(unterseiteFuer('privat', 'business')).toBe('lage'); expect(unterseiteFuer('budget', 'business')).toBe('lage'); expect(unterseiteFuer('ug', 'business')).toBe('ug');
    expect(unterseiteFuer('privat', 'privat')).toBe('privat'); expect(unterseiteFuer('quatsch', 'privat')).toBe('lage');
    expect(bereicheFuer('privat').length).toBe(8);
    expect(wirksameSicht('privat', 'business')).toBe('business'); expect(wirksameSicht('business', 'privat')).toBe('business'); expect(wirksameSicht('privat', null)).toBe('privat');
    expect(bereichAus('business')).toBe('business'); expect(bereichAus(null)).toBe('privat'); expect(bereichAus('admin')).toBe('privat');
  });
});

describe('Oberfläche der Business-Sicht zeigt kein Privat', () => {
  it('Lage, Gesamt, Planen, Treiber, Ziele, Kalender, Schulden, Zu erledigen, Protokoll, Blätter: kein privates Merkmal, keine Privat-Kennzahl', async () => {
    const { FinanzplanKontext, rechne } = await import('@/components/os/finanzplan/daten');
    const { LageBusiness } = await import('@/components/os/finanzplan/Ueberblick');
    const { Gesamt } = await import('@/components/os/finanzplan/Gesamt');
    const { Baukasten } = await import('@/components/os/finanzplan/Baukasten');
    const { Szenarien, Ziele, UG, KDV, Toepfe } = await import('@/components/os/finanzplan/Planen');   // Selbst (Selbstständigkeit) ist seit 05.10. eine Privat-Unterseite
    const { Kalender, Schulden, ZuErledigen } = await import('@/components/os/finanzplan/Verpflichtungen');
    const { Protokoll } = await import('@/components/os/finanzplan/Auswerten');
    const { Buchungen } = await import('@/components/os/finanzplan/Monat');
    const d = businessSicht(planMitPrivat());
    const kontext = { d, ...rechne(d), sicht: 'business' as const, person: 'kevin', verbergen: false, aendere: async () => true, melde: () => {}, geh: () => {}, params: new URLSearchParams() };
    for (const [name, k] of [['Lage', LageBusiness], ['Gesamt', Gesamt], ['Planen', Baukasten], ['Treiber', Szenarien], ['Ziele', Ziele], ['MAKE', UG], ['KDV', KDV], ['Töpfe', Toepfe], ['Kalender', Kalender], ['Schulden', Schulden], ['Zu erledigen', ZuErledigen], ['Protokoll', Protokoll], ['Buchungen', Buchungen]] as const) {
      const html = renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: kontext }, h(k as () => JSX.Element)));
      for (const g of GEHEIM) expect(html.includes(g), `${name}: ${g}`).toBe(false);
      for (const t of ['Privat angespart', 'Privat Luft', 'Runway Privat', 'Notgroschen', 'Gruppe Dez 28', 'Privat schuldenfrei', 'Privat-Konto', 'Netto-Tabelle fehlt', 'Selbstständigkeit', 'Selbst.', 'Entnahme']) expect(html.includes(t), `${name}: ${t}`).toBe(false);
    }
  });
});
