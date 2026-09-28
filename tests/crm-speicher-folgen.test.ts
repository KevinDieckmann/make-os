// ─── CRM-Speicher (28.09. spät): Folgen in derselben Sperre, Personen-Schranke, Kriterien-Grenze ──
// 1 · Deal-Fehlanlage gelöscht → Firmen- und Personen-Lead zurück auf Qualifizierung (chanceId/sqlAm weg).
// 2 · Neue Verweise auf gesperrte Personen: Art. 18 nie (409), Werbesperre nicht in Kampagne/Einladung.
// 3 · Segment-Kriterien: über der Grenze 413, nie still gekürzt.
// 4 · Firma umbenannt → Mandat.kunde / Chance.firma ziehen nach, wenn sie den alten Namen trugen.
// Eigener Datenordner — nie der echte Bestand. Alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Chance, CrmBestand, Firma, Kampagne, Mandat, Teilnahme, Event } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import { personenSchranke, neuePersonenVerweise, type PersonSchranke } from '@/lib/crm/personen-schranke';
import { leadOhneDeal, crmFolgen, firmenNamenNachziehen, kontaktLeadsOhneDeals, karteiBetroffen } from '@/lib/crm/bestand-folgen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-folgen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
let speicher: typeof import('@/lib/crm/speicher');
beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  speicher = await import('@/lib/crm/speicher');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

const JETZT = '2026-09-28T18:00:00.000Z';
const H = '2026-09-20T08:00:00.000Z';
const KRIT = { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } as const;
const deal = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-fehl', titel: 'Beispiel Werke · Retainer', kontaktIds: [], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert',
  historie: [{ stufe: 'qualifiziert', am: H, von: 'kevin' }], naechsterSchritt: { text: 'Anrufen', datum: '2026-10-01' },
  qualifizierung: { ...KRIT }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: H, geaendert: H, ...x,
});
const firma = (x: Partial<Firma> = {}): Firma => ({ id: 'f-werke', name: 'Beispiel Werke GmbH', rolle: 'zielkunde', geaendert: H, ...x } as Firma);
const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-werke', kunde: 'Beispiel Werke GmbH', firmaId: 'f-werke', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft: 'offen', status: 'aktiv',
  vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: H, ...x,
});
const sqlLead = { status: 'sql' as const, kriterien: { ...KRIT }, sqlAm: H, chanceId: 'ch-fehl', qualifiziertAm: '2026-09-19' };
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...speicher.leererBestand(), ...x });
const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Test', nachname: 'Person', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], ...x } as unknown as Kontakt);
const GESPERRT = { seit: '2026-09-01', grund: 'Widerspruch' };
const EINGESCHR = { seit: '2026-09-01', grund: 'Antrag', von: 'kevin' };

describe('1 · Deal-Fehlanlage löschen → Lead zurück auf Qualifizierung', () => {
  it('leadOhneDeal: SQL → qualifizierung, chanceId und sqlAm weg, Kernfragen bleiben', () => {
    const neu = leadOhneDeal(sqlLead, new Set(['ch-fehl']), JETZT, 'malin')!;
    expect(neu.status).toBe('qualifizierung');
    expect(neu.chanceId).toBeUndefined();
    expect(neu.sqlAm).toBeUndefined();
    expect(neu).toMatchObject({ kriterien: KRIT, qualifiziertAm: '2026-09-19', geaendert: JETZT, geaendertVon: 'malin' });
    expect(leadOhneDeal(sqlLead, new Set(['ch-andere']), JETZT)).toBeUndefined();
    // Anderer Status (kunde): nur der tote Verweis fällt, die Geschichte bleibt.
    const kunde = leadOhneDeal({ ...sqlLead, status: 'kunde' }, new Set(['ch-fehl']), JETZT)!;
    expect(kunde).toMatchObject({ status: 'kunde', sqlAm: H });
    expect(kunde.chanceId).toBeUndefined();
  });

  it('wendeCrmAn: gelöschte Fehlanlage setzt den Firmen-Lead in derselben Änderung zurück', () => {
    const b = bestand({ chancen: [deal({ firmaId: 'f-werke', firma: 'Beispiel Werke GmbH' })], firmen: [firma({ lead: sqlLead })] });
    const r = speicher.wendeCrmAn(b, [{ liste: 'chancen', op: 'delete', id: 'ch-fehl' }], JETZT, 'kevin');
    expect(r.fehler).toEqual([]);
    expect(r.bestand.chancen).toHaveLength(0);
    const lead = r.bestand.firmen[0].lead!;
    expect(lead.status).toBe('qualifizierung');
    expect(lead.chanceId).toBeUndefined();
    expect(lead.sqlAm).toBeUndefined();
  });

  it('ein Deal mit Geschichte wird nicht gelöscht — der Lead bleibt SQL', () => {
    const b = bestand({ chancen: [deal({ wert: { betrag: 900, basis: 'monat' } })], firmen: [firma({ lead: sqlLead })] });
    const r = speicher.wendeCrmAn(b, [{ liste: 'chancen', op: 'delete', id: 'ch-fehl' }], JETZT, 'kevin');
    expect(r.fehler).toHaveLength(1);
    expect(r.bestand.firmen[0].lead).toMatchObject({ status: 'sql', chanceId: 'ch-fehl' });
  });

  it('kontaktLeadsOhneDeals / karteiBetroffen: nur Personen mit Verweis auf den gelöschten Deal', () => {
    const k = [person('c-ohne-firma', { lead: sqlLead }), person('c-andere', { lead: { ...sqlLead, chanceId: 'ch-x' } })];
    expect(karteiBetroffen(k, new Set(['ch-fehl']))).toBe(true);
    expect(karteiBetroffen(k, new Set(['ch-y']))).toBe(false);
    const r = kontaktLeadsOhneDeals(k, new Set(['ch-fehl']), JETZT, '2026-09-28');
    expect(r.geaendert).toEqual(['c-ohne-firma']);
    expect(r.kontakte[0]).toMatchObject({ lead: { status: 'qualifizierung' }, geaendertAm: '2026-09-28' });
    expect(r.kontakte[1]).toBe(k[1]);
  });

  it('aendereCrm: Personen-Lead der Kartei geht in derselben Sperre mit zurück', async () => {
    await db.saveJson('crm', bestand({ chancen: [deal({ kontaktIds: ['c-solo'] })] }));
    await db.saveJson('kontakte', { kontakte: [person('c-solo', { lead: sqlLead }), person('c-fremd')] });
    const halter: { r?: ReturnType<typeof speicher.wendeCrmAn> } = {};
    await speicher.aendereCrm(cur => { halter.r = speicher.wendeCrmAn(cur, [{ liste: 'chancen', op: 'delete', id: 'ch-fehl' }], JETZT, 'kevin'); return halter.r.bestand; }, { art: 'person', person: 'kevin' });
    expect(halter.r!.fehler).toEqual([]);
    expect((await speicher.ladeCrm()).chancen).toHaveLength(0);
    const kartei = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    const solo = kartei.find(k => k.id === 'c-solo')!;
    expect(solo.lead).toMatchObject({ status: 'qualifizierung', geaendertVon: 'kevin' });
    expect(solo.lead!.chanceId).toBeUndefined();
    expect(solo.lead!.sqlAm).toBeUndefined();
    expect(kartei.find(k => k.id === 'c-fremd')!.lead).toBeUndefined();
  });

  it('aendereCrm ohne gelöschten Deal fasst die Kartei nicht an', async () => {
    await db.saveJson('kontakte', { kontakte: [person('c-solo', { lead: sqlLead })] });
    const vorher = await db.speicherStand(['kontakte']);
    await speicher.aendereCrm(cur => ({ ...cur, firmen: [...cur.firmen, firma({ id: 'f-neu', name: 'Neu GmbH' })] }));
    expect(await db.speicherStand(['kontakte'])).toBe(vorher);
  });
});

describe('2 · Server nimmt keine neuen Verweise auf gesperrte Personen an', () => {
  const personen: PersonSchranke[] = [
    { id: 'c-frei' }, { id: 'c-werbesperre', werbesperre: GESPERRT }, { id: 'c-art18', eingeschraenkt: EINGESCHR },
  ];
  const ev: Event = { id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'Kennenlernen', datum: '2026-10-10', status: 'geplant', geaendert: H };
  const tn = (kontaktId: string, id = 't-1'): Teilnahme => ({ id, eventId: 'ev-1', kontaktId, status: 'vorgemerkt', geaendert: H });
  const kampagne = (x: Partial<Kampagne> = {}): Kampagne => ({ id: 'k-1', name: 'Herbst', playbook: 'eigen', ziel: 'Termine', zielgruppe: {}, kanal: 'mail', status: 'entwurf', schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: H, ...x } as Kampagne);
  const up = (liste: string, eintrag: object): ListenOp => ({ liste, op: 'upsert', eintrag: eintrag as Record<string, unknown> });

  it('Einladung (Teilnahme): Art. 18 → EINGESCHRAENKT_FEHLER, Werbesperre → Grund, freie Person → ok', () => {
    const b = bestand({ events: [ev] });
    expect(personenSchranke(b, [up('teilnahmen', tn('c-art18'))], personen)).toEqual([EINGESCHRAENKT_FEHLER]);
    const ws = personenSchranke(b, [up('teilnahmen', tn('c-werbesperre'))], personen);
    expect(ws).toHaveLength(1);
    expect(ws[0]).toContain('Stammtisch');
    expect(ws[0]).toContain('Werbesperre');
    expect(ws[0]).not.toContain('c-werbesperre');
    expect(personenSchranke(b, [up('teilnahmen', tn('c-frei'))], personen)).toEqual([]);
  });

  it('bestehende Verweise werden nicht rückwirkend abgelehnt (Status ändern an einer Alt-Teilnahme geht)', () => {
    const b = bestand({ events: [ev], teilnahmen: [tn('c-werbesperre')] });
    expect(personenSchranke(b, [{ liste: 'teilnahmen', op: 'teil', id: 't-1', felder: { notiz: 'abgesagt per Telefon', kontaktId: 'c-werbesperre' } }], personen)).toEqual([]);
    const k = bestand({ kampagnen: [kampagne({ status: 'aktiv', kontaktIds: ['c-werbesperre', 'c-art18'] })] });
    expect(personenSchranke(k, [{ liste: 'kampagnen', op: 'teil', id: 'k-1', felder: { kontaktIds: ['c-werbesperre', 'c-art18', 'c-frei'] } }], personen)).toEqual([]);
  });

  it('Kampagne (aktiv/Entwurf): neue gesperrte Kontakte → abgelehnt; abgeschlossene Kampagnen prüft sie nicht', () => {
    const b = bestand({ kampagnen: [kampagne()] });
    const ws = personenSchranke(b, [{ liste: 'kampagnen', op: 'teil', id: 'k-1', felder: { kontaktIds: ['c-frei', 'c-werbesperre'] } }], personen);
    expect(ws).toHaveLength(1);
    expect(ws[0]).toContain('Kampagne „Herbst“');
    expect(personenSchranke(b, [{ liste: 'kampagnen', op: 'teil', id: 'k-1', felder: { kontaktIds: ['c-art18'] } }], personen)).toEqual([EINGESCHRAENKT_FEHLER]);
    const zu = bestand({ kampagnen: [kampagne({ status: 'abgeschlossen' })] });
    expect(personenSchranke(zu, [{ liste: 'kampagnen', op: 'teil', id: 'k-1', felder: { kontaktIds: ['c-werbesperre'] } }], personen)).toEqual([]);
  });

  it('Deals und Mandate: Werbesperre erlaubt (Vertragsbeziehung), Art. 18 nicht', () => {
    const b = bestand({ chancen: [deal()], mandate: [mandat()] });
    expect(personenSchranke(b, [{ liste: 'chancen', op: 'teil', id: 'ch-fehl', felder: { kontaktIds: ['c-werbesperre'] } }], personen)).toEqual([]);
    expect(personenSchranke(b, [{ liste: 'mandate', op: 'teil', id: 'm-werke', felder: { kontaktIds: ['c-werbesperre'] } }], personen)).toEqual([]);
    expect(personenSchranke(b, [{ liste: 'chancen', op: 'teil', id: 'ch-fehl', felder: { personenRollen: { 'c-art18': 'entscheider' } } }], personen)).toEqual([EINGESCHRAENKT_FEHLER]);
    expect(personenSchranke(b, [{ liste: 'mandate', op: 'teil', id: 'm-werke', felder: { kontaktIds: ['c-art18'] } }], personen)).toEqual([EINGESCHRAENKT_FEHLER]);
  });

  it('neuePersonenVerweise: teil auf einen fehlenden Eintrag zählt nicht (legt nichts an)', () => {
    expect(neuePersonenVerweise(bestand(), [{ liste: 'mandate', op: 'teil', id: 'm-gibt-es-nicht', felder: { kontaktIds: ['c-art18'] } }])).toEqual([]);
  });

  it('wendeCrmAn: die GANZE Änderung wird abgelehnt (abgelehnt → 409), der Bestand bleibt', () => {
    const b = bestand({ events: [ev], mandate: [mandat()] });
    const r = speicher.wendeCrmAn(b, [
      { liste: 'mandate', op: 'teil', id: 'm-werke', felder: { notiz: 'soll nicht ankommen' } },
      up('teilnahmen', tn('c-art18')),
    ], JETZT, 'kevin', undefined, personen);
    expect(r.abgelehnt).toEqual([EINGESCHRAENKT_FEHLER]);
    expect(r.angewandt).toBe(0);
    expect(r.bestand).toBe(b);
  });

  it('aendereCrm legt die Kartei für wendeCrmAn ab — ohne dass die Route sie durchreicht', async () => {
    await db.saveJson('crm', bestand({ events: [ev] }));
    await db.saveJson('kontakte', { kontakte: [person('c-art18', { eingeschraenkt: EINGESCHR }), person('c-werbesperre', { werbesperre: GESPERRT }), person('c-frei')] });
    const lauf = async (kontaktId: string, id: string) => {
      const halter: { r?: ReturnType<typeof speicher.wendeCrmAn> } = {};
      await speicher.aendereCrm(cur => { halter.r = speicher.wendeCrmAn(cur, [up('teilnahmen', tn(kontaktId, id))], JETZT, 'kevin'); return halter.r.bestand; });
      return halter.r!;
    };
    expect((await lauf('c-art18', 't-a')).abgelehnt).toEqual([EINGESCHRAENKT_FEHLER]);
    expect((await lauf('c-werbesperre', 't-b')).abgelehnt?.[0]).toContain('Werbesperre');
    expect((await lauf('c-frei', 't-c')).abgelehnt).toBeUndefined();
    expect((await speicher.ladeCrm()).teilnahmen.map(t => t.kontaktId)).toEqual(['c-frei']);
  });
});

describe('3 · Segment-Kriterien: nie still kürzen', () => {
  const werte = (n: number) => Array.from({ length: n }, (_, i) => `Wert ${i}`);
  it('bis zur Grenze bleibt alles (vorher nach 50 abgeschnitten)', () => {
    const r = speicher.wendeCrmAn(bestand(), [{ liste: 'segmente', op: 'upsert', eintrag: { id: 'seg-gross', name: 'Groß', kriterien: { label: werte(120) } } }], JETZT, 'kevin');
    expect(r.grenze).toEqual([]);
    expect(r.bestand.segmente[0].kriterien.label).toHaveLength(120);
  });
  it('über der Grenze → 413 (grenze), nichts geschrieben — auch in der Zielgruppe einer Kampagne', () => {
    const zuViel = werte(speicher.KRITERIEN_WERTE_MAX + 1);
    const s = speicher.wendeCrmAn(bestand(), [{ liste: 'segmente', op: 'upsert', eintrag: { id: 'seg-zu', name: 'Zu groß', kriterien: { typ: zuViel } } }], JETZT, 'kevin');
    expect(s.grenze[0]).toContain('„typ“');
    expect(s.bestand.segmente).toHaveLength(0);
    const k = speicher.crmGrenzen([{ liste: 'kampagnen', op: 'upsert', eintrag: { id: 'k-zu', name: 'Zu groß', zielgruppe: { kreis: zuViel } } }]);
    expect(k).toHaveLength(1);
  });
});

describe('4 · Firma umbenannt → Anzeigenamen an Mandaten und Deals', () => {
  it('ziehen nach, wenn sie den alten Namen trugen; ein bewusst anderer Name bleibt', () => {
    const b = bestand({
      firmen: [firma()],
      mandate: [mandat(), mandat({ id: 'm-eigen', kunde: 'Werke Projekt Nord' }), mandat({ id: 'm-fremd', firmaId: 'f-andere' })],
      chancen: [deal({ firmaId: 'f-werke', firma: 'Beispiel Werke GmbH' }), deal({ id: 'ch-2', firmaId: 'f-werke', firma: 'Anderer Anzeigename' })],
    });
    const r = speicher.wendeCrmAn(b, [{ liste: 'firmen', op: 'teil', id: 'f-werke', felder: { name: 'Beispiel Werke Holding GmbH' } }], JETZT, 'malin');
    expect(r.bestand.firmen[0].name).toBe('Beispiel Werke Holding GmbH');
    const m = Object.fromEntries(r.bestand.mandate.map(x => [x.id, x]));
    expect(m['m-werke']).toMatchObject({ kunde: 'Beispiel Werke Holding GmbH', geaendertVon: 'malin' });
    expect(m['m-eigen'].kunde).toBe('Werke Projekt Nord');
    expect(m['m-fremd'].kunde).toBe('Beispiel Werke GmbH');
    const c = Object.fromEntries(r.bestand.chancen.map(x => [x.id, x]));
    expect(c['ch-fehl'].firma).toBe('Beispiel Werke Holding GmbH');
    expect(c['ch-2'].firma).toBe('Anderer Anzeigename');
  });
  it('idempotent und ohne Umbenennung unverändert', () => {
    const b = bestand({ firmen: [firma()], mandate: [mandat()] });
    expect(firmenNamenNachziehen(b, b, JETZT)).toBe(b);
    expect(crmFolgen(b, b, JETZT)).toBe(b);
    const umbenannt = { ...b, firmen: [firma({ name: 'Neu GmbH' })] };
    const einmal = crmFolgen(b, umbenannt, JETZT);
    expect(einmal.mandate[0].kunde).toBe('Neu GmbH');
    expect(crmFolgen(b, einmal, JETZT).mandate[0]).toEqual(einmal.mandate[0]);
  });
});

