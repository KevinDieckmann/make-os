// ─── Prüf-Funde 11.10. (CRM/Inbox/Unternehmen) — die reinen Regeln ────────────────────────────────────────────────────
// Je Fund ein Wächter. Erfundene Personen, Firmen und Beträge — nie echte Daten. Server-Wege stehen in pruef-funde-1110-server.test.ts.
import { describe, it, expect } from 'vitest';
import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import type { Chance, Mandat, CrmBestand, Leistung } from '@/lib/crm/typen';
import { leererBestand } from '@/lib/crm/speicher';
import { leads } from '@/lib/crm/leads';
import { TEAM } from '@/lib/crm/team-liste';
import { honorarAusPreis, mandatEntwurf, zuordnenFolge, firmaWirdExKunde } from '@/lib/crm/mandat-anlegen';
import { postfachRaum, bereichAnzeige } from '@/lib/postfach/bereich';
import { raumVonPostfach, bereichWechsel, ablageVorschlag, spaceFuer } from '@/lib/inbox/flows';
import { spaceVon, kontaktAnlegenErlaubt } from '@/lib/inbox/aus-gespraech';
import { raumVon, juengsteNachricht, uebergabenNachMailFrist, type Uebergabe, type UebergabeNachricht } from '@/lib/inbox/teilen';
import { neuerLeadAm, NEUER_LEAD_SPANNE_TAGE } from '@/lib/crm/neue-leads';
import { leadAngelegt, wochenIst, zielLage, kreislauf } from '@/lib/crm/planung';
import { wochenScoreboard } from '@/lib/crm/scoreboard';
import type { LeadKanal, UmsatzZiel, PlanungDatei } from '@/lib/crm/planung-daten';
import { planungOhnePerson, planungEintraegeVon, leerePlanung } from '@/lib/crm/planung-daten';
import { treppeOhnePerson, treppeEintraegeVon, leereTreppe, treppeAnwenden, type TreppeDatei, type AnwendenKontext } from '@/lib/crm/treppe-daten';
import { kundenZeilen, zielbild, imBusiness } from '@/lib/crm/treppe';
import { upsellAnsprechbar } from '@/lib/crm/treppe-server';
import { istBeleg } from '@/lib/dateien/regeln';
import { kontextVon } from '@/lib/gesellschaften/schild/kontext';
import { pflichtenFuer } from '@/lib/gesellschaften/schild/pflichten';
import { lageAus, faelligeSchildErinnerungen, NEUTRAL_BESCHREIBUNG } from '@/lib/gesellschaften/schild/ampel';
import {
  beschlussSaeubern, eintragVerweise, registerAufraeumen, faelligeErinnerungen, registerOhnePerson, registerEintraegeVon, GETILGT,
  type RegisterGesellschaft, type RegisterDatei, type Beschluss,
} from '@/lib/gesellschaften/modell';
import { eintragHandeln } from '@/lib/gesellschaften/server';
import { beteiligtName } from '@/lib/gesellschaften/beschluesse';
import { anhangPrivat } from '@/lib/inbox/anhaenge-server';
import { inboxNachher } from '@/lib/inbox/aufgaben-vorschlag-server';
import { anhaengeBeiSperrePruefen } from '@/lib/inbox/uebergaben-server';
import { gegenueberEingeschraenkt } from '@/lib/inbox/entwurf';

const HEUTE = '2026-10-12'; // Montag
const A = TEAM[0].id;
const J = `${HEUTE}T09:00:00.000Z`;
const akt = (von: string, am: string, x: Partial<Aktivitaet> = {}): Aktivitaet => ({ am: `${am}T10:00:00.000Z`, art: 'anruf', von, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Erfunden', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-01-01', geaendertAm: '2026-01-01', ...x });
const ch = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Deal', kontaktIds: [], art: 'projekt', wert: { betrag: 10_000, basis: 'einmalig' }, stufe: 'qualifiziert',
  historie: [{ stufe: 'qualifiziert', am: '2026-09-01T10:00:00.000Z', von: A }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'ug', besitzer: A, angelegt: '2026-09-01T10:00:00.000Z', geaendert: '2026-09-01T10:00:00.000Z', ...x,
});
const md = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispiel GmbH', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-06-01', verlaengerung: 'auto', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
});
const crmMit = (x: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), ...x });

describe('Fund 1 — Jahrespreis wird Monatshonorar (÷ 12 auf den Cent), EINE Stelle für „+ Mandat“ und Deal', () => {
  it('honorarAusPreis: jahr ÷ 12 auf den Cent, monat bleibt, einmalig bleibt einmalig', () => {
    expect(honorarAusPreis({ betrag: 10_000, basis: 'jahr' })).toEqual({ honorar: { betrag: 833.33, basis: 'monat', netto: true }, rechnungsrhythmus: 'monatlich' });
    expect(honorarAusPreis({ betrag: 1200, basis: 'monat' })).toEqual({ honorar: { betrag: 1200, basis: 'monat', netto: true }, rechnungsrhythmus: 'monatlich' });
    expect(honorarAusPreis({ betrag: 5000, basis: 'einmalig' })).toEqual({ honorar: { betrag: 5000, basis: 'einmalig', netto: true }, rechnungsrhythmus: 'einmalig' });
    expect(honorarAusPreis(null).honorar.betrag).toBe(0);
  });
  it('„+ Mandat“ mit Produkt „je Jahr“ legt kein 12-fach zu hohes Monatshonorar an', () => {
    const m = mandatEntwurf({ id: 'm-neu', firma: { id: 'f-a', name: 'Beispiel GmbH' }, kontaktIds: ['c-a'], gesellschaft: 'ug', leistung: { id: 'l-j', name: 'Jahrespaket', preis: { betrag: 24_000, basis: 'jahr' } }, jetzt: J, person: A });
    expect(m.honorar).toEqual({ betrag: 2000, basis: 'monat', netto: true });
    expect(m.rechnungsrhythmus).toBe('monatlich');
  });
});

describe('Fund 2 — EINE Regel für Postfächer ohne Bereich: Privat', () => {
  it('postfachRaum, Flows, „aus Gespräch“, Teilen und die Anzeige sagen dasselbe', () => {
    for (const f of [postfachRaum, raumVonPostfach, raumVon, (b: string | null) => spaceVon({ bereich: b }), (b: string | null) => bereichAnzeige(b).raum]) {
      expect(f(null)).toBe('privat');
      expect(f('privat')).toBe('privat');
      expect(f('ug')).toBe('business');
    }
  });
  it('ohne Bereich: kein Lead aus dem Postfach, Business-Ablage nur mit Bereichswechsel, Aufgabe im Privat-Space', () => {
    expect(kontaktAnlegenErlaubt(null)).toBe(false);
    expect(kontaktAnlegenErlaubt('ug')).toBe(true);
    expect(bereichWechsel(null, 'business')).toBe(true);
    expect(bereichWechsel(null, 'privat')).toBe(false);
    expect(ablageVorschlag({ fach: 'alle', bereich: null, zuordnung: { kontaktId: 'c-a', firmaId: 'f-a' }, ausGespraech: 0 })).toBe('projekt');
    expect(spaceFuer({ gespraechId: 'gm~1', bereich: null, mandate: [], spaces: [], tasks: [], projects: [] }).spaceId).toBe('privat');
  });
});

describe('Fund 3 — „Neue Leads“ zählt Importe nicht rückwirkend, System-Einträge nie (EINE Funktion)', () => {
  const vermerk = (am: string) => akt(A, am, { art: 'system', text: 'Von Hand angelegt' });
  it('neuerLeadAm: von Hand angelegt (Vermerk am Anlagetag) zählt; Import mit erster Ansprache Monate später nicht; nur System nicht; Liste nie', () => {
    expect(neuerLeadAm(k('hand', { importiertAm: '2026-10-05', aktivitaeten: [vermerk('2026-10-05')] }))).toBe('2026-10-05');
    expect(neuerLeadAm(k('kurz', { importiertAm: '2026-10-05', aktivitaeten: [akt(A, '2026-10-07')] }))).toBe('2026-10-05');
    expect(neuerLeadAm(k('import', { importiertAm: '2026-03-01', aktivitaeten: [akt(A, '2026-10-06')] }))).toBeNull();
    expect(neuerLeadAm(k('system', { importiertAm: '2026-10-05', aktivitaeten: [akt('system', '2026-10-05', { art: 'antwort' })] }))).toBeNull();
    expect(neuerLeadAm(k('liste', { importiertAm: '2026-10-05', quelle: 'Liste', aktivitaeten: [akt(A, '2026-10-05')] }))).toBeNull();
    expect(neuerLeadAm(k('spaet', { importiertAm: '2026-10-01', aktivitaeten: [akt(A, `2026-10-0${1 + NEUER_LEAD_SPANNE_TAGE + 1}`)] }))).toBeNull();
  });
  it('Scoreboard, Kreislauf (leadAngelegt) und Wochen-Ist nutzen dieselbe Regel', () => {
    const kontakte = [
      k('hand', { importiertAm: '2026-10-06', aktivitaeten: [vermerk('2026-10-06')], besitzer: A }),
      k('import', { importiertAm: '2026-10-06', aktivitaeten: [akt(A, '2026-10-30')] }),
    ];
    const ist = wochenIst(kontakte, { chancen: [], sitzungen: [], teilnahmen: [], events: [] }, '2026-10-05', '2026-10-11');
    expect(ist.team.leads).toBe(1);
    const nach = new Map(kontakte.map(x => [x.id, x]));
    expect(leadAngelegt({ personen: [{ id: 'c-import' }] } as never, nach)).toBeNull();
    expect(leadAngelegt({ personen: [{ id: 'c-import' }, { id: 'c-hand' }] } as never, nach)).toBe('2026-10-06');
    const sb = wochenScoreboard(kontakte, crmMit({}), '2026-10-08', 2, { leads: 5, gespraeche: 1, sql: 1, angebote: 1, quelle: 'Test' });
    const zeile = sb.zeilen.find(z => z.id === 'neue_leads')!;
    expect(zeile.werte[1]).toBe(1);
  });
});

describe('Fund 4 — Rückwärts-Trichter rechnet mit dem REST des Ziels', () => {
  const kanal: LeadKanal = { id: 'lk-netzwerk1', name: 'Netzwerk', herkunft: 'netzwerk', kanaele: ['netzwerk'], leadsMonat: 10, zyklusWochen: 8, quoten: { leadZuGespraech: 50, gespraechZuSql: 50, sqlZuAngebot: 50, angebotZuGewonnen: 50 }, aktiv: true, geaendert: J, geaendertVon: A };
  const ziel: UmsatzZiel = { id: 'uz-ziel1', gesellschaft: 'ug', von: HEUTE, bis: '2027-03-29', umsatz: 120_000, dealWert: 10_000, geaendert: J, geaendertVon: A };
  it('schon gewonnene 40.000 € → nur noch 8 Deals, Leads und Wochenziele für den Rest', () => {
    const ohne = zielLage(ziel, { heute: HEUTE, kanaele: [kanal], crm: crmMit({}) });
    expect(ohne.deals).toBe(12);
    const gewonnen = ch({ id: 'ch-g', stufe: 'gewonnen', wert: { betrag: 40_000, basis: 'einmalig' }, historie: [{ stufe: 'gewonnen', am: `${HEUTE}T11:00:00.000Z`, von: A }] });
    const mit = zielLage(ziel, { heute: HEUTE, kanaele: [kanal], crm: crmMit({ chancen: [gewonnen] }) });
    expect(mit.ist).toMatchObject({ umsatz: 40_000, rest: 80_000 });
    expect(mit.deals).toBe(8);
    expect(mit.kanaele[0].leads).toBeCloseTo(128);
    expect(mit.kanaele[0].jeWoche!.leads).toBeLessThan(ohne.kanaele[0].jeWoche!.leads);
  });
  it('Ziel übertroffen → Rest 0, keine Aktivitäten mehr nötig (nie negativ)', () => {
    const viel = ch({ id: 'ch-v', stufe: 'gewonnen', wert: { betrag: 200_000, basis: 'einmalig' }, historie: [{ stufe: 'gewonnen', am: `${HEUTE}T11:00:00.000Z`, von: A }] });
    const l = zielLage(ziel, { heute: HEUTE, kanaele: [kanal], crm: crmMit({ chancen: [viel] }) });
    expect(l.ist.rest).toBe(0);
    expect(l.deals).toBe(0);
    expect(l.summe.leads).toBe(0);
  });
});

describe('Fund 5 — Offenlegung (§ 325 HGB) nur einmal: im Steuer-Modul geführte Gesellschaft ohne Schild-Pflicht', () => {
  const gmbh = (id: string): RegisterGesellschaft => ({ id: id as RegisterGesellschaft['id'], rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }] });
  it('kdv (Steuer-Modul) bekommt keine Schild-Offenlegung, ug (nicht im Modul) schon', () => {
    const im = pflichtenFuer(kontextVon(gmbh('kdv')), undefined, '2026-10-10');
    expect(im.some(p => p.regelId === 'ja-offenlegen')).toBe(false);
    expect(im.some(p => p.regelId === 'ja-aufstellen')).toBe(true);
    const nicht = pflichtenFuer(kontextVon(gmbh('ug')), undefined, '2026-10-10');
    expect(nicht.some(p => p.regelId === 'ja-offenlegen')).toBe(true);
  });
});

describe('Fund 6 — Verweise im Register: endgültig löschen gesperrt, Altbestand speicherbar, „(gelöscht)“', () => {
  const B: Beschluss = { id: 'bs-aaaa-0001', datum: '2026-05-01', art: 'sonstiges' as Beschluss['art'], titel: 'Beschluss', status: 'gefasst', beteiligte: ['gs-weg-0001'], abstimmung: [{ id: 'gs-weg-0001', stimme: 'ja', gewichtCent: 100 }], verweise: [{ art: 'vertrag', id: 'vt-weg-0001' }] };
  const g = (x: Partial<RegisterGesellschaft> = {}): RegisterGesellschaft => ({ id: 'ug', gesellschafter: [{ id: 'gs-weg-0001', wer: { art: 'person', id: 'person-a' }, nennbetragCent: 100, einlage: 'ja', geloeschtAm: '2026-01-01T00:00:00.000Z' }], vertraege: [], beschluesse: [B], fassungen: [{ id: 'fs-aaaa-0001', merkmal: 'sitz', ab: '2026-05-01', text: 'Ort', beschlussId: B.id, geloeschtAm: undefined }], ...x } as RegisterGesellschaft);
  it('eintragVerweise zählt Beschlüsse auf Gesellschafter/Verträge und Fassungen auf Beschlüsse', () => {
    expect(eintragVerweise(g(), 'gesellschafter', 'gs-weg-0001')).toBe(1);
    expect(eintragVerweise(g(), 'vertraege', 'vt-weg-0001')).toBe(1);
    expect(eintragVerweise(g(), 'beschluesse', B.id)).toBe(1);
    expect(eintragVerweise(g(), 'organe', 'og-frei-0001')).toBe(0);
  });
  it('endgültig löschen mit Verweis → 409 mit Anzahl; Schild-Ereignis auf einen Beschluss ebenso', () => {
    const r = eintragHandeln('gesellschafter', 'gs-weg-0001', 'endgueltig')(g(), []);
    expect(r).toMatchObject({ status: 409 });
    expect(JSON.stringify(r)).toContain('1 Beschluss');
    const fs = { ...g(), fassungen: [] } as RegisterGesellschaft;
    const b = { ...fs, beschluesse: [{ ...B, geloeschtAm: '2026-01-01T00:00:00.000Z' }] } as RegisterGesellschaft;
    expect(eintragHandeln('beschluesse', B.id, 'endgueltig', 1)(b, [])).toMatchObject({ status: 409 });
    expect(eintragHandeln('beschluesse', B.id, 'endgueltig', 0)(b, [])).toHaveProperty('g');
  });
  it('der Säuberer nimmt Kennungen, die schon im gespeicherten Beschluss stehen (Altbestand) — neue unbekannte nie', () => {
    const ohne = { ...g(), gesellschafter: [] } as RegisterGesellschaft;
    expect(beschlussSaeubern({ titel: 'Neuer Titel' }, B, ohne, { jetzt: J, heute: HEUTE }).fehler).toEqual([]);
    expect(beschlussSaeubern({ beteiligte: ['gs-weg-0001'], abstimmung: [{ id: 'gs-weg-0001', stimme: 'nein' }], verweise: [{ art: 'vertrag', id: 'vt-weg-0001' }] }, B, ohne, { jetzt: J, heute: HEUTE }).fehler).toEqual([]);
    expect(beschlussSaeubern({ beteiligte: ['gs-fremd-0001'] }, B, ohne, { jetzt: J, heute: HEUTE }).fehler.length).toBeGreaterThan(0);
    expect(beteiligtName('gs-weg-0001', ohne, {})).toBe('Gesellschafter (gelöscht)');
  });
  it('Morgenlauf-Papierkorb: abgelaufene Einträge MIT Verweis bleiben', () => {
    const alt = { ...g(), vertraege: [{ id: 'vt-weg-0001', art: 'sonstiges', titel: 'V', status: 'laufend', geloeschtAm: '2025-01-01T00:00:00.000Z' }] } as unknown as RegisterGesellschaft;
    const d: RegisterDatei = { gesellschaften: [{ ...alt, gesellschafter: [{ ...alt.gesellschafter![0], geloeschtAm: '2025-01-01T00:00:00.000Z' }] }] };
    const r = registerAufraeumen(d, { chancen: [], mandate: [], leistungen: [] } as never, J);
    const nach = r.d!.gesellschaften.find(x => x.id === 'ug')!;
    expect(nach.gesellschafter?.map(x => x.id)).toEqual(['gs-weg-0001']);
    expect(nach.vertraege?.map(x => x.id)).toEqual(['vt-weg-0001']);
  });
});

describe('Fund 7 — Upsell nur mit ansprechbarer Person (Art. 18 / Werbesperre)', () => {
  const kartei = [k('frei'), k('sperre', { werbesperre: { seit: HEUTE, grund: 'Widerspruch' } }), k('art18', { eingeschraenkt: { seit: HEUTE, grund: 'x', von: A } as Kontakt['eingeschraenkt'] })];
  it('erste ansprechbare Person; alle ausgenommen → kein Vorschlag; ohne (vorhandene) Person → am Mandat', () => {
    expect(upsellAnsprechbar(['c-sperre', 'c-frei'], kartei)).toEqual({ erlaubt: true, kontaktId: 'c-frei' });
    expect(upsellAnsprechbar(['c-sperre', 'c-art18'], kartei)).toEqual({ erlaubt: false });
    expect(upsellAnsprechbar([], kartei)).toEqual({ erlaubt: true });
    expect(upsellAnsprechbar(['c-gibt-es-nicht'], kartei)).toEqual({ erlaubt: true });
  });
});

describe('Fund 8 — Fortschritts-Report ist kein Beleg', () => {
  it('istBeleg: Report mit Mandat löschbar, Rechnung/Angebot/Mandats-Unterlage bleiben Beleg', () => {
    expect(istBeleg({ mandatId: 'm-1', bericht: 'fortschritt' })).toBe(false);
    expect(istBeleg({ mandatId: 'm-1' })).toBe(true);
    expect(istBeleg({ mandatId: 'm-1', rechnungId: 'r-1', bericht: 'fortschritt' })).toBe(true);
    expect(istBeleg({ angebotId: 'a-1' } as never)).toBe(true);
  });
});

describe('Fund 9 — „Firma zuordnen“ an beendetem/pausiertem Mandat macht keine Kunden', () => {
  it('nur aktiv → Kunde; beendet/pausiert → höchstens Ex-Kunde; Angebot → nichts', () => {
    expect(zuordnenFolge('aktiv')).toBe('kunde');
    expect(zuordnenFolge('beendet')).toBe('ex_kunde');
    expect(zuordnenFolge('pausiert')).toBe('ex_kunde');
    expect(zuordnenFolge('angebot' as Mandat['status'])).toBeNull();
    const f = { id: 'f-a', name: 'A', rolle: 'zielkunde', geaendert: J } as CrmBestand['firmen'][number];
    expect(firmaWirdExKunde(f).rolle).toBe('ex_kunde');
    expect(firmaWirdExKunde({ ...f, rolle: 'kunde' }).rolle).toBe('kunde');
    expect(firmaWirdExKunde({ ...f, rolleVonHand: true }).rolle).toBe('zielkunde');
  });
});

describe('Fund 10 — Wächter „Business bekommt nichts aus Privat“: Treppe, Zielbild, Kreislauf', () => {
  let n = 0;
  const K: AnwendenKontext = { person: A, jetzt: J, heute: HEUTE, standVon: x => JSON.stringify(x), neueId: p => `${p}-test${(++n).toString().padStart(4, '0')}` };
  const r = treppeAnwenden(leereTreppe(2026), [{ op: 'stufe', eintrag: { id: 'ts-paket', name: 'Paket', ebene: 1, preis: { art: 'monat', betrag: 1000 }, leistungIds: ['l-1'] } }], K);
  const datei = (r as { datei: TreppeDatei }).datei;
  const leistung = { id: 'l-1', name: 'Produkt', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, phasen: [{ id: 'p1', name: 'Start' }] } as unknown as Leistung;
  const business = md({ id: 'm-bus', leistungId: 'l-1', firmaId: 'f-b', start: '2026-01-01' });
  const privat = md({ id: 'm-priv', leistungId: 'l-1', firmaId: 'f-p', gesellschaft: 'kdc', start: '2026-01-01' });
  it('imBusiness: kdc (Selbstständigkeit, Privat-Einheit) nicht, ug und „offen“ schon', () => {
    expect(imBusiness({ gesellschaft: 'kdc' })).toBe(false);
    expect(imBusiness({ gesellschaft: 'ug' })).toBe(true);
    expect(imBusiness({ gesellschaft: 'offen' })).toBe(true);
  });
  it('Kundenzeilen und Zielbild zählen nur das Business-Mandat', () => {
    const z = kundenZeilen({ datei, crm: { mandate: [business, privat], leistungen: [leistung] }, heute: HEUTE });
    expect(z.map(x => x.mandatId)).toEqual(['m-bus']);
    const zb = zielbild({ datei, crm: { mandate: [business, privat], chancen: [ch({ id: 'ch-p', leistungId: 'l-1', gesellschaft: 'kdc', angelegt: '2026-05-01T00:00:00Z', firmaId: 'f-x' })] }, heute: HEUTE });
    expect(zb.zeilen[0].ist.kunden).toBe(1);
  });
  it('Kreislauf: Fulfillment und Deals ohne die Privat-Einheit', () => {
    const kontakte = [k('a', { firmaId: 'f-b' })];
    const crm = crmMit({ leistungen: [leistung], mandate: [business, privat], chancen: [ch({ id: 'ch-b', stufe: 'angebot' }), ch({ id: 'ch-p', stufe: 'angebot', gesellschaft: 'kdc' })] });
    const kr = kreislauf({ heute: HEUTE, kanaele: [], zeilen: leads(kontakte, crm, HEUTE), crm, kontakte, nachLeistung: {}, followup: { faellig: 0, ueberfaellig: 0 } });
    expect(kr.stufen.find(s => s.id === 'fulfillment')?.anzahl).toBe(1);
    expect(kr.stufen.find(s => s.id === 'deals')?.anzahl).toBe(1);
  });
});

describe('H4 — Erinnerungs-Aufgaben im Business-Space nennen weder Pflicht, Norm noch Folge', () => {
  it('Schild: neutraler Titel und Beschreibung', () => {
    const g: RegisterGesellschaft = { id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }] };
    const e = faelligeSchildErinnerungen(lageAus({ gesellschaften: [g] }, null, '2026-10-10')).filter(x => !x.erledigt);
    expect(e.length).toBeGreaterThan(0);
    for (const x of e) {
      expect(x.titel).not.toMatch(/§|Pflicht:|Folge|Insolvenz|Jahresabschluss/);
      expect(x.beschreibung).toContain(NEUTRAL_BESCHREIBUNG);
      expect(x.beschreibung).not.toMatch(/§|Folge bei Versäumnis/);
    }
  });
  it('Vertrag: kein eigener Vertragstitel und keine Kündigungsfrist im Aufgabentitel', () => {
    const g = { id: 'ug', vertraege: [{ id: 'vt-aaaa-0001', art: 'sonstiges', titel: 'Geheimer Darlehensvertrag', status: 'laufend', kuendigenBis: '2026-10-20', kuendigungsfrist: '3 Monate' }] } as unknown as RegisterGesellschaft;
    const e = faelligeErinnerungen([g], '2026-10-10');
    expect(e).toHaveLength(1);
    expect(e[0].titel).not.toContain('Geheimer');
    expect(e[0].beschreibung).not.toContain('3 Monate');
  });
});

describe('H2 — Anhänge mit Privat-Bezug gehen nicht aus der Ablage hinaus', () => {
  it('anhangPrivat', () => {
    expect(anhangPrivat({ bereich: 'privat' })).toBe(true);
    expect(anhangPrivat({ projektId: 'p-1' })).toBe(true);
    expect(anhangPrivat({ gesellschaft: 'kdc' })).toBe(true);
    expect(anhangPrivat({ gesellschaft: 'ug' })).toBe(false);
    expect(anhangPrivat({})).toBe(false);
  });
});

describe('M4 — Inbox-Vorschlag: `nachher` ohne Betreff und Absender (geht in Prompts)', () => {
  it('inboxNachher ist neutral', () => {
    expect(inboxNachher()).toBe('Aufgabe aus einer Nachricht — Einzelheiten in der Inbox');
    expect(inboxNachher('2026-10-20')).toMatch(/^Aufgabe aus einer Nachricht · fällig 20\.10\./);
  });
});

describe('M5 — Mail-Frist der Übergabe zählt ab der jüngsten Nachricht, nicht ab der Kopie', () => {
  const n = (am: string): UebergabeNachricht => ({ id: `n-${am}`, am, von: { email: 'a@example.invalid' }, an: [], cc: [], betreff: 'B', text: 'T', vonUns: false, anhaenge: [] });
  it('realistisch: Kopie Wochen NACH den Nachrichten — Stichtag nach der Nachricht → weg', () => {
    const u = { id: 'ub-1', kopieAm: '2026-09-30T10:00:00.000Z', nachrichten: [n('2026-03-01T10:00:00.000Z'), n('2026-03-20T10:00:00.000Z')] } as Uebergabe;
    expect(juengsteNachricht(u)).toBe('2026-03-20T10:00:00.000Z');
    expect(uebergabenNachMailFrist([u], '2026-04-13')).toEqual([]);
    expect(uebergabenNachMailFrist([u], '2026-03-15').map(x => x.id)).toEqual(['ub-1']);
    expect(juengsteNachricht({ kopieAm: '2026-09-30T10:00:00.000Z', nachrichten: [] })).toBe('2026-09-30T10:00:00.000Z');
  });
});

describe('M6 — Art. 18: keine Anhang-Kopien bei der Übergabe', () => {
  it('eingeschränkt + Anhänge → 409; ohne Anhänge oder ohne Sperre erlaubt', () => {
    expect(() => anhaengeBeiSperrePruefen('eingeschraenkt', 1)).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => anhaengeBeiSperrePruefen('eingeschraenkt', 0)).not.toThrow();
    expect(() => anhaengeBeiSperrePruefen('werbesperre', 2)).not.toThrow();
    expect(() => anhaengeBeiSperrePruefen(undefined, 2)).not.toThrow();
  });
});

describe('M7 — ZOE-Entwurf prüft Art. 18 live gegen die Kartei', () => {
  const kartei = [k('frei', { email: 'frei@example.invalid' }), k('art18', { email: 'gesperrt@example.invalid', eingeschraenkt: { seit: HEUTE, grund: 'x', von: A } as Kontakt['eingeschraenkt'] })];
  it('über die Kennung oder die Adresse (auch weitere Adressen) erkannt', () => {
    expect(gegenueberEingeschraenkt('c-art18', undefined, kartei)).toBe(true);
    expect(gegenueberEingeschraenkt(undefined, 'Gesperrt@Example.invalid', kartei)).toBe(true);
    expect(gegenueberEingeschraenkt('c-frei', 'frei@example.invalid', kartei)).toBe(false);
    expect(gegenueberEingeschraenkt(undefined, undefined, kartei)).toBe(false);
  });
});

describe('M8 — Konto löschen/Export: Treppe, Vertriebsplanung, Register-Fassungen', () => {
  it('treppeOhnePerson tilgt alle Stempel, Einträge bleiben; Export nennt sie', () => {
    const d: TreppeDatei = {
      ...leereTreppe(2026),
      stufen: [{ id: 'ts-aaaa', name: 'S', ebene: 1, lieferobjekte: [], preis: { art: 'fest', betrag: 1 }, regeln: {}, leistungIds: [], geaendert: J, geaendertVon: 'person-weg' }],
      positionierung: { claim: 'C', geaendert: J, geaendertVon: 'person-weg' },
      kunden: { 'm-1': { erledigt: [{ was: 'Befund', am: HEUTE, von: 'person-weg' }, { was: 'Plan', am: HEUTE, von: 'person-bleibt' }], verlauf: [], geaendert: J, geaendertVon: 'person-bleibt' } },
      reports: { 'm-1': { gesendetAm: HEUTE, gesendetVon: 'person-weg' } },
    };
    expect(treppeEintraegeVon(d, 'person-weg').map(x => x.art).sort()).toEqual(['lieferung erledigt', 'positionierung geändert', 'report gesendet', 'stufe geändert']);
    const r = treppeOhnePerson(d, 'person-weg');
    expect(r.n).toBe(4);
    expect(JSON.stringify(r.neu)).not.toContain('person-weg');
    expect(JSON.stringify(r.neu)).toContain('person-bleibt');
    expect(r.neu.stufen).toHaveLength(1);
  });
  it('planungOhnePerson tilgt Stempel und Häkchen', () => {
    const d: PlanungDatei = { ...leerePlanung(), challenges: [{ id: 'chl-a', woche: HEUTE, art: 'gespraeche', titel: 'T', ziel: 3, person: A, geaendert: J, geaendertVon: 'person-weg' }], nachLeistung: { 'm-1': { testimonial: { am: HEUTE, von: 'person-weg' } } } };
    expect(planungEintraegeVon(d, 'person-weg')).toHaveLength(2);
    const r = planungOhnePerson(d, 'person-weg');
    expect(r.n).toBe(2);
    expect(JSON.stringify(r.neu)).not.toContain('person-weg');
  });
  it('registerOhnePerson tilgt Fassung „von“ und Absender „geändert von“; Export ohne Wortlaut', () => {
    const d = { gesellschaften: [{ id: 'ug', geaendertVon: 'person-weg', fassungen: [{ id: 'fs-aaaa-0001', merkmal: 'sitz', ab: '2026-01-01', text: 'Wortlaut', von: 'person-weg', angelegt: J }] }] } as unknown as RegisterDatei;
    expect(registerEintraegeVon(d, 'person-weg')).toEqual([{ gesellschaftId: 'ug', id: 'fs-aaaa-0001', merkmal: 'sitz', ab: '2026-01-01', angelegt: J }]);
    const r = registerOhnePerson(d, 'person-weg');
    expect(r.n).toBe(2);
    expect(r.neu.gesellschaften[0].fassungen![0].von).toBe(GETILGT);
    expect(JSON.stringify(r.neu)).not.toContain('person-weg');
  });
});
