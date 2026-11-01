// ─── Prüfung C „vom Lead zum zahlenden Kunden“ (02.11.) — je Fund ein Fall: vorher kaputt → nachher richtig ─────────────────────────────
// Kevin: „Im Thema Kundengewinnung soll nichts dem Zufall überlassen werden.“ Eigener Datenordner, alles erfunden (@example.invalid), keine echten
// Namen oder Beträge. Rein: Verlust-Wiedervorlage, Laufzeit abgelaufen, Nachfassen schließen, Morgenlauf-Fehler, HOI. Server: Annahme an geparktem/
// verlorenem/fehlendem Deal, Werbesperre ≠ Art. 18, Follow-ups beim Annehmen/Ersetzen/Verlieren, Rechnungen vorbereiten (Gründe, Gesellschaft offen,
// drei Fehlschläge), Mahn-Lauf meldet Fehler, Verträge (Nachfassen, Mandat über den Deal, Register beendet, Absicht mit Abbruch nach jedem Schritt).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { ordner, flags, gemeldet } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-kg-abschluss-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-kg-abschluss', MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-nur-fuer-den-kg-abschluss-test' });
  return { ordner, flags: { entwurfWirft: false, mahnWirft: false }, gemeldet: [] as { an: string; art: string; titel: string; bezug?: { id: string } }[] };
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string; bezug?: { id: string } }) => { gemeldet.push(m); } }));
vi.mock('@/lib/finanzen/rechnung/server', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/finanzen/rechnung/server')>();
  return { ...echt, entwurfNeu: async (...a: Parameters<typeof echt.entwurfNeu>) => { if (flags.entwurfWirft) throw new Error('Testfehler beim Entwurf.'); return echt.entwurfNeu(...a); } };
});
vi.mock('@/lib/prozesse/ueberfuehrung-server', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/prozesse/ueberfuehrung-server')>();
  return { ...echt, wegFuer: async (...a: Parameters<typeof echt.wegFuer>) => { if (flags.mahnWirft) throw new Error('Testfehler im Mahn-Lauf.'); return echt.wegFuer(...a); } };
});

import type { Angebot, Chance, CrmBestand, FollowUp, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { verlustWiedervorlage, VERLUST_WIEDERVORLAGE_TAGE } from '@/lib/crm/pipeline';
import { dealRegeln } from '@/lib/crm/speicher';
import { leads, brauchtQualifizierung } from '@/lib/crm/leads';
import { mandatLage, laufzeitAbgelaufen, LAUFZEIT_ABGELAUFEN } from '@/lib/crm/kunden';
import { laufzeitAnstehend } from '@/lib/heute/anstehend';
import { angebotFollowupsSchliessen } from '@/lib/crm/angebote';
import { angebotNachfassenBeiDealSchluss } from '@/lib/crm/bestand-folgen';
import { gescheiterteSchritte, morgenlaufFehler, NUR_HAUSHALT_INFO } from '@/lib/tagesstart/fehler';
import { taktRobustBefunde } from '@/lib/hoi/lage';

const J = '2026-09-01T10:00:00.000Z';
const Q = { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' } as const;
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: 'Sprint Muster', kontaktIds: ['c-anna1'], firmaId: 'f-muster', firma: 'Muster GmbH', art: 'projekt', wert: { betrag: 3000, basis: 'einmalig' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'pa' }], qualifizierung: { ...Q }, gesellschaft: 'kdv', besitzer: 'pa', geaendert: J, ...x } as unknown as Chance);
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({
  id, kunde: 'Muster GmbH', firmaId: 'f-muster', kontaktIds: ['c-anna1'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'kdv', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
const angebot = (id: string, x: Partial<Angebot> = {}): Angebot => ({ id, gesellschaft: 'kdv', kontaktId: 'c-anna1', firmaId: 'f-muster', titel: 'Strategie-Sprint', nummer: `KDV-A-2026-${id.slice(-4)}`, positionen: [{ id: 'p1', titel: 'Sprint', text: 'Analyse', menge: 1, einheit: 'pauschal', einzelpreisCent: 300000, ustSatz: 19, basis: 'einmalig' }], einleitung: '', schluss: '', gueltigBis: '2027-12-31', zahlungszielTage: 21, status: 'gestellt', version: 1, gestelltAm: J, angelegt: J, geaendert: J, ...x } as Angebot);
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id, bezug: { art: 'chance', id: 'd-1' }, kontaktId: 'c-anna1', art: 'anruf', text: 'Nachfassen', faellig: '2026-10-01', zustaendig: 'pa', status: 'offen', quelle: 'deal', angelegt: J, geaendert: J, ...x });

// ── Rein ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Fund 5 · verlorener Deal mit zeitbezogenem Grund kommt wieder', () => {
  it('Wiedervorlage +90 Tage nur bei „Zeitpunkt“, „Keine Rückmeldung“, „Keine Entscheidung“ (auch mit Ergänzung)', () => {
    expect(VERLUST_WIEDERVORLAGE_TAGE).toBe(90);
    expect(verlustWiedervorlage('Zeitpunkt', '2026-11-02')).toBe('2027-01-31');
    expect(verlustWiedervorlage('Keine Rückmeldung — kurz vor Weihnachten', '2026-11-02')).toBe('2027-01-31');
    expect(verlustWiedervorlage('Wettbewerb', '2026-11-02')).toBeUndefined();
  });
  it('Stufenwechsel von Hand: Vorgabe gesetzt, „leer“ heißt keine, anderer Grund räumt eine alte (vom Parken) ab', () => {
    const b = { chancen: [deal('d-1', { naechsterSchritt: { text: 'x', datum: '2026-12-01' }, wiedervorlage: '2026-12-24' })], mandate: [] } as unknown as CrmBestand;
    const jetzt = '2026-11-02T09:00:00.000Z';
    const wv = (felder: Record<string, unknown>) => (dealRegeln(b, [{ liste: 'chancen', op: 'teil', id: 'd-1', felder: { stufe: 'verloren', ...felder } }], jetzt, 'pa').ops[0] as { felder: Record<string, unknown> }).felder.wiedervorlage;
    expect(wv({ grund: 'Zeitpunkt' })).toBe('2027-01-31');
    expect(wv({ grund: 'Zeitpunkt', wiedervorlage: '' })).toBe('');
    expect(wv({ grund: 'Zeitpunkt', wiedervorlage: '2027-03-01' })).toBe('2027-03-01');
    // vorher: die alte Wiedervorlage des geparkten Deals blieb stehen
    expect(wv({ grund: 'Wettbewerb' })).toBe('');
  });
  it('der Lead „ruht“ mit dieser Wiedervorlage und kommt an dem Tag in die Qualifizierung', () => {
    const k: Kontakt = { id: 'c-anna1', vorname: 'Anna', nachname: 'Test', email: 'c-anna1@example.invalid', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH' } as Kontakt;
    const crm = { firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', geaendert: J, lead: { status: 'sql', kriterien: { ...Q }, chanceId: 'd-1' } }], chancen: [deal('d-1', { stufe: 'verloren', grund: 'Zeitpunkt', wiedervorlage: '2027-01-31' })], mandate: [], leistungen: [], events: [], teilnahmen: [], kampagnen: [], angebote: [] } as unknown as CrmBestand;
    const z = leads([k], crm, '2026-11-02').find(x => x.id === 'f-muster')!;
    expect(z).toMatchObject({ status: 'ruht', wiedervorlage: '2027-01-31' });
    expect(brauchtQualifizierung(z, '2026-12-01')).toBe(false);
    expect(brauchtQualifizierung(z, '2027-01-31')).toBe(true);
  });
});

describe('Fund 3 · Laufzeit abgelaufen, nichts entschieden', () => {
  const m = mandat('m-lz', { start: '2026-01-01', mindestlaufzeitMonate: 6, verlaengerung: 'offen', zustaendig: 'pa' });
  it('Ampel bleibt rot mit Grund (vorher: am Tag nach dem Ende keine Warnung mehr)', () => {
    expect(laufzeitAbgelaufen(m, '2026-11-02')).toBe(true);
    const l = mandatLage(m, '2026-11-02');
    expect(l.ampel).toBe('rot');
    expect(l.gruende).toContain(LAUFZEIT_ABGELAUFEN);
    // automatisch verlängert, beendet oder noch in der Laufzeit → nicht
    expect(laufzeitAbgelaufen({ ...m, verlaengerung: 'auto' }, '2026-11-02')).toBe(false);
    expect(laufzeitAbgelaufen({ ...m, status: 'beendet' }, '2026-11-02')).toBe(false);
    expect(laufzeitAbgelaufen(m, '2026-06-30')).toBe(false);
  });
  it('Steht an / Glocke: abgeleitet als überfällige Frist — nur für die zuständige Person', () => {
    const a = laufzeitAnstehend([m], 'pa', '2026-11-02');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ art: 'mandat', tag: '2026-06-30', business: true });
    expect(a[0].inTagen).toBeLessThan(0);
    expect(a[0].titel).toContain(LAUFZEIT_ABGELAUFEN);
    expect(laufzeitAnstehend([m], 'pb', '2026-11-02')).toEqual([]);
  });
});

describe('Fund 12/13 · Nachfassen räumt sich auf (rein)', () => {
  it('`fu-<angebot>` und `fu-<angebot>-ablauf` werden geschlossen, erledigte bleiben', () => {
    const l = angebotFollowupsSchliessen([fu('fu-ang-1'), fu('fu-ang-1-ablauf'), fu('fu-ang-2'), fu('fu-ang-1-alt', { status: 'erledigt' })], ['ang-1'], { status: 'abgesagt', ergebnis: 'x', jetzt: J, person: 'pa' });
    expect(l.map(f => f.status)).toEqual(['abgesagt', 'abgesagt', 'offen', 'erledigt']);
  });
  it('Deal von Hand verloren → Nachfassen seiner offenen Angebote abgesagt (vorher blieb es stehen)', () => {
    const vorher = { chancen: [deal('d-1')], angebote: [angebot('ang-0001', { dealId: 'd-1' })], followups: [fu('fu-ang-0001')] } as unknown as CrmBestand;
    const nachher = { ...vorher, chancen: [deal('d-1', { stufe: 'verloren', grund: 'Preis' })] } as CrmBestand;
    expect(angebotNachfassenBeiDealSchluss(vorher, nachher, J, 'pa').followups![0]).toMatchObject({ status: 'abgesagt', ergebnis: 'Deal verloren' });
    // ohne Stufenwechsel: derselbe Bestand
    expect(angebotNachfassenBeiDealSchluss(vorher, vorher, J, 'pa')).toBe(vorher);
  });
});

describe('Fund 2 · Morgenlauf: gescheiterte Schritte (rein) und HOI', () => {
  it('✕ zählt, „nur im Haushalt des Inhabers“ (Zugang) nicht', () => {
    const s = [{ name: 'A', ok: true }, { name: 'B', ok: false, info: 'Fehler' }, { name: 'C', ok: false, info: NUR_HAUSHALT_INFO }];
    expect(gescheiterteSchritte(s)).toEqual(['B']);
    expect(morgenlaufFehler('2026-11-02', s)).toEqual({ tag: '2026-11-02', anzahl: 1, schritte: ['B'] });
    expect(morgenlaufFehler('2026-11-02', [{ name: 'A', ok: true }])).toBeUndefined();
  });
  it('HOI-Befund nur mit Zahl', () => {
    const basis = { warteschlange: { gesamt: 0, aktiv: 0, grenze: 100, abgelehntHeute: 0 }, sperreLesbar: true, tagesstart: null, headsVoll: [] };
    expect(taktRobustBefunde(basis).some(b => b.id === 'morgenlauf-schritte')).toBe(false);
    expect(taktRobustBefunde({ ...basis, schritteGescheitert: { tag: '2026-11-02', anzahl: 2 } }).find(b => b.id === 'morgenlauf-schritte')).toMatchObject({ ampel: 'gelb', wert: '2 Schritte gescheitert (02.11.)' });
  });
});

// ── Server (eigener Datenordner) ─────────────────────────────────────────────────────────────────────────────────────────────────

let db: typeof import('@/lib/store/local-db');
const crmLaden = async () => (await import('@/lib/crm/speicher')).ladeCrm();
const tasks = async () => (await db.loadJson<{ tasks: { id: string; status: string; title: string; description?: string }[] }>('tasks'))?.tasks ?? [];
async function dazu(f: (b: CrmBestand) => CrmBestand) { await (await import('@/lib/crm/speicher')).aendereCrm(f); }
async function annehmen(id: string) {
  const [{ angebotAnnehmen, mitStand }] = await Promise.all([import('@/lib/crm/angebot-server')]);
  const a = ((await crmLaden()).angebote ?? []).find(x => x.id === id)!;
  return angebotAnnehmen({ id, stand: mitStand(a).stand, person: 'pa' });
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'kg-haus' });
  await db.saveJson('konten', { konten: [konto('k1', 'pa', 'inhaber'), konto('k2', 'pb', 'mitglied')], einladungen: [] });
  const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Anna', nachname: 'Test', email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'angebot', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', firmaId: 'f-muster', firma: 'Muster GmbH', ...x });
  await db.saveJson('kontakte', { kontakte: [k('c-anna1'), k('c-sperre1', { nachname: 'Werbesperre', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } } as Partial<Kontakt>), k('c-art181', { nachname: 'Eingeschraenkt', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'pa' } } as Partial<Kontakt>)] });
  await db.saveJson('crm', { ...speicher.leererBestand(), firmen: [{ id: 'f-muster', name: 'Muster GmbH', rolle: 'zielkunde', stadt: 'Musterstadt', geaendert: J, zahlung: { empfaenger: { anschrift: 'Hauptstraße 5, 54321 Beispielstadt' }, zielTage: 30 } }] } as unknown as CrmBestand);
  const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
  const ges = (id: string) => ({ id, firmierung: `Beispiel ${id.toUpperCase()} GmbH`, strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', email: 'info@example.invalid', steuernummer: '12/345/67890', bank: { iban: IBAN }, geschaeftsfuehrung: 'Erika Beispiel', register: 'Amtsgericht Musterstadt HRB 1' });
  await db.saveJson('gesellschaften--kg-haus', { gesellschaften: [ges('kdv'), ges('kdc')] });
  const { SEED } = await import('@/lib/finanzen/finanzplan-bestand');
  await db.saveJson('finanzplan', SEED);
  await db.saveJson('liquiplan', { posten: [] });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Fund 1 · Angebot angenommen → immer gewonnener Deal und Mandat', () => {
  it('geparkter Deal wird gewonnen (Historie), das Mandat entsteht (vorher: übersprungen, kein Mandat)', async () => {
    await dazu(b => ({ ...b, chancen: [...b.chancen, deal('d-park', { stufe: 'geparkt', wiedervorlage: '2027-01-01', historie: [{ stufe: 'angebot', am: J, von: 'pa' }, { stufe: 'geparkt', am: J, von: 'pa' }] })], angebote: [...(b.angebote ?? []), angebot('ang-park-0001', { dealId: 'd-park' })] }));
    const r = await annehmen('ang-park-0001');
    expect(r.automatik).toMatchObject({ angelegt: true });
    const crm = await crmLaden();
    const c = crm.chancen.find(x => x.id === 'd-park')!;
    expect(c.stufe).toBe('gewonnen');
    expect(c.historie.map(h => h.stufe)).toEqual(['angebot', 'geparkt', 'gewonnen']);
    expect(c.wiedervorlage).toBeUndefined();
    expect(crm.mandate.some(m => m.chanceId === 'd-park')).toBe(true);
  }, 60_000);
  it('verlorener Deal wird gewonnen, alter Verlustgrund fällt weg', async () => {
    await dazu(b => ({ ...b, chancen: [...b.chancen, deal('d-weg1', { stufe: 'verloren', grund: 'Preis' })], angebote: [...(b.angebote ?? []), angebot('ang-weg1-0001', { dealId: 'd-weg1' })] }));
    const r = await annehmen('ang-weg1-0001');
    expect(r.automatik).toMatchObject({ angelegt: true });
    const c = (await crmLaden()).chancen.find(x => x.id === 'd-weg1')!;
    expect(c).toMatchObject({ stufe: 'gewonnen' });
    expect(c.grund).toBeUndefined();
  }, 60_000);
  it('ohne Deal: Deal entsteht über `dealAnlegen` (feste Kennung), gewonnen, am Angebot verknüpft — dann das Mandat; zweites Mal nichts doppelt', async () => {
    await dazu(b => ({ ...b, angebote: [...(b.angebote ?? []), angebot('ang-ohne-0001', { kontaktId: 'c-anna1' })] }));
    const r = await annehmen('ang-ohne-0001');
    const { dealIdFuerAngebot, dealFuerAngenommenes } = await import('@/lib/crm/angebot-server');
    const id = dealIdFuerAngebot('ang-ohne-0001');
    expect(r.dealId).toBe(id);
    expect(r.automatik).toMatchObject({ angelegt: true });
    const crm = await crmLaden();
    expect(crm.chancen.find(c => c.id === id)).toMatchObject({ stufe: 'gewonnen' });
    expect(crm.angebote!.find(a => a.id === 'ang-ohne-0001')!.dealId).toBe(id);
    expect(crm.mandate.filter(m => m.chanceId === id)).toHaveLength(1);
    expect(await dealFuerAngenommenes({ angebotId: 'ang-ohne-0001', person: 'pa' })).toEqual({});
    expect((await crmLaden()).chancen.filter(c => c.id === id)).toHaveLength(1);
  }, 60_000);
});

describe('Fund 10 · Werbesperre hält das Mandat nicht auf, Art. 18 schon', () => {
  it('Werbesperre → Mandat angelegt (vorher: abgebrochen); Art. 18 → kein Mandat', async () => {
    await dazu(b => ({ ...b, chancen: [...b.chancen, deal('d-sperre', { kontaktIds: ['c-sperre1'] }), deal('d-art18', { kontaktIds: ['c-art181'] })], angebote: [...(b.angebote ?? []), angebot('ang-sperr-0001', { dealId: 'd-sperre', kontaktId: 'c-sperre1' }), angebot('ang-art18-0001', { dealId: 'd-art18', kontaktId: 'c-anna1' })] }));
    expect((await annehmen('ang-sperr-0001')).automatik).toMatchObject({ angelegt: true });
    expect((await crmLaden()).mandate.some(m => m.chanceId === 'd-sperre')).toBe(true);
    expect((await annehmen('ang-art18-0001')).automatik).toMatchObject({ angelegt: false });
    expect((await crmLaden()).mandate.some(m => m.chanceId === 'd-art18')).toBe(false);
  }, 60_000);
});

describe('Fund 12 · Annehmen und Ersetzen schließen alle Follow-ups', () => {
  it('annehmen: eigenes `-ablauf` erledigt, Nachfassen des Geschwister-Angebots abgesagt (Status bleibt)', async () => {
    await dazu(b => ({ ...b, chancen: [...b.chancen, deal('d-geschw')],
      angebote: [...(b.angebote ?? []), angebot('ang-ga-0001', { dealId: 'd-geschw', status: 'abgelaufen' }), angebot('ang-gb-0001', { dealId: 'd-geschw' })],
      followups: [...(b.followups ?? []), fu('fu-ang-ga-0001-ablauf', { bezug: { art: 'chance', id: 'd-geschw' } }), fu('fu-ang-gb-0001', { bezug: { art: 'chance', id: 'd-geschw' } })] }));
    await annehmen('ang-ga-0001');
    const crm = await crmLaden();
    expect(crm.followups!.find(f => f.id === 'fu-ang-ga-0001-ablauf')!.status).toBe('erledigt');
    expect(crm.followups!.find(f => f.id === 'fu-ang-gb-0001')).toMatchObject({ status: 'abgesagt', ergebnis: 'Anderes Angebot zum Deal angenommen' });
    expect(crm.angebote!.find(a => a.id === 'ang-gb-0001')!.status).toBe('gestellt');
  }, 60_000);
  it('neue Version gestellt: Nachfassen der Vorversion (auch „-ablauf“) abgesagt, nur das neue bleibt offen', async () => {
    await dazu(b => ({ ...b, chancen: [...b.chancen, deal('d-vers', { kontaktIds: ['c-anna1'] })],
      angebote: [...(b.angebote ?? []), angebot('ang-vers-0001', { dealId: 'd-vers', status: 'abgelaufen' })],
      followups: [...(b.followups ?? []), fu('fu-ang-vers-0001', { bezug: { art: 'chance', id: 'd-vers' } }), fu('fu-ang-vers-0001-ablauf', { bezug: { art: 'chance', id: 'd-vers' } })] }));
    const { angebotVersion, angebotStellen, mitStand } = await import('@/lib/crm/angebot-server');
    const v2 = await angebotVersion({ id: 'ang-vers-0001', person: 'pa', haushalt: 'kg-haus' });
    const s = await angebotStellen({ id: v2.id, stand: mitStand(v2).stand, person: 'pa', haushalt: 'kg-haus' });
    expect(s.angebot.status).toBe('gestellt');
    const crm = await crmLaden();
    expect(crm.angebote!.find(a => a.id === 'ang-vers-0001')!.status).toBe('ersetzt');
    expect(crm.followups!.filter(f => f.id.startsWith('fu-ang-vers-0001')).map(f => f.status)).toEqual(['abgesagt', 'abgesagt']);
    expect(crm.followups!.find(f => f.id === `fu-${v2.id}`)!.status).toBe('offen');
  }, 60_000);
});

describe('Fund 2/4 · Morgenlauf: Rechnungen vorbereiten zählt Übersprungenes, Mahn-Lauf meldet Fehler', () => {
  it('Mandat mit Gesellschaft „offen“ bzw. g-…: übersprungen mit Grund + EINE feste Aufgabe (vorher: still nicht gezählt)', async () => {
    await db.saveJson('rechnungswesen', { kreislauf: { vorbereiten: { ab: '2026-08-01' } } });
    await dazu(b => ({ ...b, mandate: [...b.mandate, mandat('m-offen1', { gesellschaft: 'offen' }), mandat('m-reg1', { gesellschaft: 'g-00000000-0000-4000-8000-000000000001' as never })] }));
    const { rechnungenVorbereiten, gesellschaftAufgabeId, GESELLSCHAFT_OFFEN_GRUND } = await import('@/lib/finanzen/rechnung/kreislauf');
    const v = await rechnungenVorbereiten('kg-haus', '2026-11-03');
    expect(v.gruende).toEqual(expect.arrayContaining([{ mandatId: 'm-offen1', grund: GESELLSCHAFT_OFFEN_GRUND }, expect.objectContaining({ mandatId: 'm-reg1' })]));
    expect(v.uebersprungen).toBeGreaterThanOrEqual(2);
    const t = await tasks();
    expect(t.find(x => x.id === gesellschaftAufgabeId('m-offen1'))?.title).toBe('Gesellschaft am Mandat wählen');
    expect(t.find(x => x.id === gesellschaftAufgabeId('m-reg1'))).toBeTruthy();
    await rechnungenVorbereiten('kg-haus', '2026-11-04');
    expect((await tasks()).filter(x => x.id === gesellschaftAufgabeId('m-offen1'))).toHaveLength(1);
    await dazu(b => ({ ...b, mandate: b.mandate.filter(m => m.id !== 'm-offen1' && m.id !== 'm-reg1') }));
  }, 120_000);
  it('Entwurf scheitert an drei Läufen (Tagen) hintereinander → feste Aufgabe zum Mandat; derselbe Tag zählt nicht doppelt', async () => {
    // Nur dieses eine aktive Mandat (die automatisch angelegten oben beenden).
    await dazu(b => ({ ...b, mandate: [...b.mandate.map(m => ({ ...m, status: 'beendet' as const, ende: '2026-08-31' })), mandat('m-fehl1')] }));
    const { rechnungenVorbereiten, fehlAufgabeId, kreislaufLaden } = await import('@/lib/finanzen/rechnung/kreislauf');
    flags.entwurfWirft = true;
    try {
      for (const tag of ['2026-11-03', '2026-11-03', '2026-11-04']) await rechnungenVorbereiten('kg-haus', tag);
      expect((await kreislaufLaden()).vorbereiten?.fehlschlaege?.['m-fehl1']?.n).toBe(2);
      expect((await tasks()).some(x => x.id === fehlAufgabeId('m-fehl1'))).toBe(false);
      const v = await rechnungenVorbereiten('kg-haus', '2026-11-05');
      expect(v.gruende?.filter(g => g.mandatId === 'm-fehl1')).toEqual([{ mandatId: 'm-fehl1', grund: 'Testfehler beim Entwurf.' }]);
      expect((await tasks()).find(x => x.id === fehlAufgabeId('m-fehl1'))?.title).toMatch(/scheitert wiederholt/);
    } finally { flags.entwurfWirft = false; }
    // Gelingt es wieder, ist der Zähler weg.
    await rechnungenVorbereiten('kg-haus', '2026-11-06');
    expect((await kreislaufLaden()).vorbereiten?.fehlschlaege?.['m-fehl1']).toBeUndefined();
  }, 120_000);
  it('Mahn-Lauf gescheitert → `fehler` (vorher still „neu: 0“)', async () => {
    const { mahnAufgabenNachziehen } = await import('@/lib/finanzen/rechnung/server');
    flags.mahnWirft = true;
    try { expect(await mahnAufgabenNachziehen()).toMatchObject({ neu: 0, fehler: expect.stringMatching(/gescheitert/) }); } finally { flags.mahnWirft = false; }
    expect((await mahnAufgabenNachziehen()).fehler).toBeUndefined();
  });
  it('Glocke: EINE je Tag an den Haushalt, neutraler Titel', async () => {
    const { morgenlaufFehlerMelden, morgenlaufFehler } = await import('@/lib/tagesstart/fehler');
    gemeldet.length = 0;
    await morgenlaufFehlerMelden('2026-11-02', morgenlaufFehler('2026-11-02', [{ name: 'Mahnvorschläge', ok: false, info: 'x' }]));
    expect(gemeldet.map(g => g.an).sort()).toEqual(['pa', 'pb']);
    expect(gemeldet[0]).toMatchObject({ art: 'prozess', bezug: { id: 'morgenlauf-2026-11-02' } });
    expect(gemeldet[0].titel).toMatch(/^Morgenlauf: ein Schritt ist gescheitert/);
  });
  it('Fund 3 · Morgenlauf legt EINE Aufgabe „Laufzeit abgelaufen“ an (idempotent)', async () => {
    await dazu(b => ({ ...b, mandate: [...b.mandate, mandat('m-lz1', { start: '2026-01-01', mindestlaufzeitMonate: 6 })] }));
    const { laufzeitAufgabenNachziehen } = await import('@/lib/finanzen/rechnung/kreislauf');
    const { laufzeitAufgabeId } = await import('@/lib/crm/kunden');
    expect((await laufzeitAufgabenNachziehen('2026-11-02')).neu).toBe(1);
    expect((await laufzeitAufgabenNachziehen('2026-11-02')).neu).toBe(0);
    expect((await tasks()).find(x => x.id === laufzeitAufgabeId('m-lz1', '2026-06-30'))?.title).toContain(LAUFZEIT_ABGELAUFEN);
  });
});

// ── Verträge (Funde 6–9) ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Funde 6–9 · Verträge: Nachfassen, Mandat über den Deal, Register beendet, Absicht', () => {
  type V = import('@/lib/vertraege/modell').Vertrag;
  let vorlageId = '';
  const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46]);
  const vs = () => import('@/lib/vertraege/server');
  async function fertigerVertrag(vorbelegung: Record<string, unknown>): Promise<V & { stand: string }> {
    const s = await vs();
    const v = await s.vertragAnlegen({ haushalt: 'kg-haus', person: 'pa', vorlageId, gesellschaft: 'kdv', vorbelegung: { firmaId: 'f-muster', kontaktId: 'c-anna1', ...vorbelegung } });
    const v2 = await s.vertragSpeichern({ haushalt: 'kg-haus', person: 'pa', id: v.id, stand: s.mitStand(v).stand, felder: { werte: { stundensatz: '100 €', kuendigen_bis: '2027-09-30', beginn: '2026-12-01' } } });
    const f = await s.vertragFertigstellen({ haushalt: 'kg-haus', person: 'pa', id: v2.id, stand: s.mitStand(v2).stand, trotzdem: true });
    return s.mitStand(f.vertrag);
  }
  const unterschreiben = async (v: V & { stand: string }) => (await vs()).vertragUnterschrieben({ haushalt: 'kg-haus', person: 'pa', id: v.id, stand: v.stand, datei: { bytes: PDF, name: 'unterschrieben.pdf' } });
  const belege = async (id: string, pdf?: string) => (await (await import('@/lib/dateien/ablage')).ablageListe('kg-haus')).filter(e => e.vertragId === id && e.id !== pdf);
  const registerVertraege = async () => ((await db.loadJson<{ gesellschaften: { id: string; vertraege?: { id: string; status: string; titel: string }[] }[] }>('gesellschaften--kg-haus'))!.gesellschaften.find(g => g.id === 'kdv')!.vertraege ?? []);

  beforeAll(async () => {
    const s = await vs();
    const v = await s.vorlageSpeichern({ haushalt: 'kg-haus', person: 'pa', felder: {
      titel: 'Beispielvertrag', art: 'dienstleistung', felder: [{ schluessel: 'stundensatz', label: 'Stundensatz', typ: 'text', pflicht: true }],
      paragraphen: [{ id: 'p-1', nr: '§ 1', titel: 'Gegenstand', text: '{{absender.firmierung}} erbringt für {{partner.name}} Leistungen.' }, { id: 'p-2', nr: '§ 2', titel: 'Vergütung', text: 'Je Stunde {{stundensatz}}.' }],
    } });
    vorlageId = v.id;
    await dazu(b => ({ ...b, chancen: [...b.chancen, deal('d-vtr', { stufe: 'gewonnen' })], mandate: [...b.mandate, mandat('m-vtr', { chanceId: 'd-vtr', vertragUnterschrieben: false })] }));
  });

  it('Fund 6/8 · fertig → Follow-up „Unterschrift nachfassen“; versendet → noch eins; unterschrieben → erledigt; Mandat über den Deal „unterschrieben“', async () => {
    const s = await vs();
    const v = await fertigerVertrag({ dealId: 'd-vtr' });
    const fuId = s.vertragFollowupId(v.id);
    expect((await crmLaden()).followups!.find(f => f.id === fuId)).toMatchObject({ status: 'offen', bezug: { art: 'chance', id: 'd-vtr' }, zustaendig: 'pa' });
    const ver = await s.vertragStatus({ haushalt: 'kg-haus', person: 'pa', id: v.id, stand: v.stand, status: 'versendet' });
    expect((await crmLaden()).followups!.filter(f => f.id === fuId)).toHaveLength(1);
    const u = await unterschreiben(s.mitStand(ver));
    expect(u.vertrag.status).toBe('unterschrieben');
    const crm = await crmLaden();
    expect(crm.followups!.find(f => f.id === fuId)!.status).toBe('erledigt');
    // vorher: nur `v.mandatId` — ein Vertrag aus dem Deal setzte das Mandat nie
    expect(crm.mandate.find(m => m.id === 'm-vtr')!.vertragUnterschrieben).toBe(true);
  }, 60_000);

  it('Fund 9 · beendet/gekündigt zieht den Register-Eintrag auf „beendet“ (vorher liefen Fristen weiter)', async () => {
    const s = await vs();
    const v = await fertigerVertrag({});
    const u = await unterschreiben(v);
    expect(u.vertrag.registerVertragId).toMatch(/^vt-/);
    await s.vertragStatus({ haushalt: 'kg-haus', person: 'pa', id: v.id, stand: s.mitStand(u.vertrag).stand, status: 'gekuendigt' });
    expect((await registerVertraege()).find(x => x.id === u.vertrag.registerVertragId)!.status).toBe('beendet');
  }, 60_000);

  it('Fund 7 · Absicht: Abbruch nach JEDEM Schritt → Wiederaufnahme ergibt denselben Endzustand (ein Beleg, ein Register-Eintrag)', async () => {
    const ab = await import('@/lib/store/absichten');
    const fort = await import('@/lib/store/absichten-fortsetzen');
    const s = await vs();
    for (const schritt of s.UNTERSCHRIFT_SCHRITTE) for (const wann of ['vorAbhaken', 'nachAbhaken'] as const) {
      const v = await fertigerVertrag({});
      ab.absichtTest[wann] = (art, x) => { if (art === 'vertrag-unterschrieben' && x === schritt) throw new ab.TestAbbruch(x); };
      try { await expect(unterschreiben(v)).rejects.toThrow(/Testabbruch/); } finally { ab.absichtTest[wann] = null; }
      await fort.offeneFertigstellen();
      const nach = (await s.vertraegeLaden('kg-haus')).find(x => x.id === v.id)!;
      expect(nach.status, `${schritt}/${wann}`).toBe('unterschrieben');
      expect(await belege(v.id, v.pdfDateiId), `${schritt}/${wann}`).toHaveLength(1);
      expect((await registerVertraege()).filter(x => x.titel.includes(v.nummer!)), `${schritt}/${wann}`).toHaveLength(1);
      expect((await crmLaden()).followups!.find(f => f.id === s.vertragFollowupId(v.id))!.status, `${schritt}/${wann}`).toBe('erledigt');
    }
  }, 240_000);

  it('Fund 7 · zweiter Upload nach Abbruch hinter dem Beleg legt keinen zweiten Beleg an', async () => {
    const ab = await import('@/lib/store/absichten');
    const v = await fertigerVertrag({});
    ab.absichtTest.nachAbhaken = (art, x) => { if (art === 'vertrag-unterschrieben' && x === 'beleg') throw new ab.TestAbbruch(x); };
    try { await expect(unterschreiben(v)).rejects.toThrow(/Testabbruch/); } finally { ab.absichtTest.nachAbhaken = null; }
    const u = await unterschreiben(v);
    expect(u.vertrag.status).toBe('unterschrieben');
    expect(await belege(v.id, v.pdfDateiId)).toHaveLength(1);
  }, 60_000);
});
