// ─── Zählungen: EINE Wahrheit (17.10., L2-Teilprüfung „Zählungen“) ────────────────────────────────────────────────────────────────
// Je Fund ein Fall „vorher zwei Zahlen → jetzt eine“. Rein, erfundene Personen und Zahlen; die Selbstständigkeit (`kdc`) steht in dieser
// Instanz unter Privat (Vorgabe aus der Rechtsart).
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, Mandat, CrmBestand } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { leads, trichter, inArbeit, sqlEntscheidungOffen, passtLeadFilter, type LeadZeile } from '../lib/crm/leads';
import { datenpaket } from '../lib/heads/daten';
import { marketingTrichter } from '../lib/crm/marketing';
import { marketingHerkunft } from '../lib/crm/scoring';
import { schritteFuer, einrichtungStand, fortschrittVon, gruppeVon, istFertig } from '../lib/make-one/onboarding-data';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { kennzahlen } from '../lib/crm/kennzahlen';
import { wochenScoreboard } from '../lib/crm/scoreboard';
import { traktionsIndex } from '../lib/crm/traktion-index';
import { istQuoten, wochenIst, kanalStaende, kreislauf } from '../lib/crm/planung';
import { sqlZuGewonnen } from '../lib/crm/quoten';
import { winRate } from '../lib/crm/pipeline';
import { winLoss } from '../lib/crm/deal-auswertung';
import { nurBusinessGezaehlt } from '../lib/crm/zaehlung-business';
import { bereichVonGesellschaft } from '../lib/einheiten';
import type { LeadKanal } from '../lib/crm/planung-daten';
import { TEAM } from '../lib/crm/team-liste';

const HEUTE = '2026-10-12';
const A = TEAM[0].id;
const J = `${HEUTE}T09:00:00.000Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-01-01', geaendertAm: '2026-01-01', ...x });
const ch = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Deal', kontaktIds: [], art: 'projekt', wert: { betrag: 10_000, basis: 'einmalig' }, stufe: 'qualifiziert',
  historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'ug', besitzer: A, angelegt: '2026-10-08T10:00:00.000Z', geaendert: '2026-10-08T10:00:00.000Z', ...x,
});
const md = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Beispiel GmbH', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-06-01', verlaengerung: 'auto', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
});
const crmMit = (x: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), ...x });
const kanal = (x: Partial<LeadKanal> = {}): LeadKanal => ({ id: 'lk-netzwerk1', name: 'Netzwerk', herkunft: 'netzwerk', kanaele: ['netzwerk'], leadsMonat: 10, zyklusWochen: 8, quoten: {}, aktiv: true, geaendert: J, geaendertVon: A, ...x });

describe('B2 · Privat-Deals und -Mandate zählen in der Markttraktion nicht (EINE Filterstelle)', () => {
  // Business: ein offener Deal (MAKE), ein aktives Mandat. Privat (Selbstständigkeit): ein offener Deal, ein aktives Mandat.
  const crm = crmMit({
    chancen: [ch({ id: 'ch-biz', angelegt: J }), ch({ id: 'ch-privat', gesellschaft: 'kdc', angelegt: J, wert: { betrag: 99_000, basis: 'einmalig' } })],
    mandate: [md({ id: 'm-biz' }), md({ id: 'm-privat', gesellschaft: 'kdc', kunde: 'Privatkunde', honorar: { betrag: 7000, basis: 'monat', netto: true } })],
  });
  it('die Selbstständigkeit steht in dieser Instanz unter Privat', () => {
    expect(bereichVonGesellschaft('kdc')).toBe('privat');
    expect(nurBusinessGezaehlt(crm).chancen.map(c => c.id)).toEqual(['ch-biz']);
    expect(nurBusinessGezaehlt(nurBusinessGezaehlt(crm))).toEqual(nurBusinessGezaehlt(crm)); // idempotent
    const nurBiz = crmMit({ chancen: [ch()], mandate: [md()] });
    expect(nurBusinessGezaehlt(nurBiz)).toBe(nurBiz);
  });
  it('Trichter: „Deals offen“ 1 (vorher 2, mit 109 T€), „Kunden“ 1 (vorher 2)', () => {
    const t = trichter([], crm, HEUTE);
    const st = Object.fromEntries(t.stufen.map(s => [s.id, s]));
    expect([st.deals.anzahl, st.deals.wert, st.kunden.anzahl]).toEqual([1, 10_000, 1]);
  });
  it('Kennzahlen: „Neue SQL · 30 Tage“ und „Wiederkehrend je Monat“ ohne die Selbstständigkeit', () => {
    const kz = Object.fromEntries(kennzahlen([], crm, HEUTE).map(x => [x.id, x]));
    expect(kz.sql_30.wert).toBe(1);
    expect(kz.mrr.wert).toBe(3000);
  });
  it('Traktions-Index: derselbe Wert, ob mit dem vollen CRM (Business-Index, `ladeRoh`) oder dem gefilterten (Markttraktion)', () => {
    const voll = traktionsIndex({ kontakte: [], crm, heute: HEUTE });
    const biz = traktionsIndex({ kontakte: [], crm: nurBusinessGezaehlt(crm), heute: HEUTE });
    expect(JSON.stringify(voll)).toBe(JSON.stringify(biz));
  });
  it('Wochen-Scoreboard „Neue SQL → Deals“, Challenges (`wochenIst`) und Kanal-Stand: nur der Business-Deal', () => {
    const sb = wochenScoreboard([], crm, HEUTE, 1);
    expect(sb.zeilen.find(z => z.id === 'neue_chancen')!.werte.at(-1)).toBe(1);
    expect(wochenIst([], crm, HEUTE, HEUTE, []).team.deals).toBe(1);
    const st = kanalStaende({ kanaele: [kanal({ herkunft: 'netzwerk' })], zeilen: [], crm, kontaktNach: new Map(), heute: HEUTE });
    expect(st[0].dealsOffen).toBeLessThanOrEqual(1);
  });
});

describe('B3 · Gespräch → SQL und SQL → Gewonnen aus EINER Stelle', () => {
  const zeile = (id: string, status: LeadZeile['status'], x: Partial<LeadZeile> = {}) => ({
    id, art: 'firma', name: id, personen: [], status, gesetzt: true, kriterien: {}, kanal: 'netzwerk', ohneBesitzer: false, besitzer: A, bean: 'N',
    score: { punkte: 40, temperatur: 'warm', teile: [] }, ...x,
  }) as unknown as LeadZeile;
  // 2 SQL, 2 im Gespräch, 1 in Qualifizierung mit direkt angelegtem offenem Deal.
  const zeilen = [zeile('a', 'sql'), zeile('b', 'sql'), zeile('c', 'im_gespraech'), zeile('d', 'im_gespraech'),
    zeile('e', 'qualifizierung', { deal: { id: 'ch-e', titel: 'E', stufe: 'bedarf', wert: 1, offen: true } })];
  // 7 gewonnen + 3 verloren in den letzten 180 Tagen, 2 gewonnen vor 300 Tagen.
  const entschieden = (id: string, stufe: 'gewonnen' | 'verloren', am: string) => ch({ id, stufe, historie: [{ stufe, am: `${am}T10:00:00.000Z`, von: A }], geaendert: `${am}T10:00:00.000Z` });
  const deals = [
    ...Array.from({ length: 7 }, (_, i) => entschieden(`g${i}`, 'gewonnen', '2026-08-01')),
    ...Array.from({ length: 3 }, (_, i) => entschieden(`v${i}`, 'verloren', '2026-08-02')),
    entschieden('alt1', 'gewonnen', '2025-12-15'), entschieden('alt2', 'gewonnen', '2025-12-16'),
  ];
  it('vorher: Trichter 40 % / 75 %, Planung 60 % / Kennzahl 70 % — jetzt überall dieselbe Zahl', () => {
    const t = trichter(zeilen, crmMit({ chancen: deals }), HEUTE);
    expect(t.gespraechZuSql).toBe(istQuoten(zeilen, deals).werte.gespraechZuSql);
    expect(t.gespraechZuSql).toBe(60);
    expect(t.sqlZuGewonnen).toBe(winRate(deals, HEUTE).quote);
    expect(t.sqlZuGewonnen).toBe(70);
    expect(sqlZuGewonnen(deals, HEUTE).quote).toBe(70);
    // Win/Loss der Pipeline-Ansicht: derselbe Entscheidungstag wie die Win-Rate.
    expect(winLoss(deals, HEUTE).quote).toBe(70);
    const ohneHistorie = [...deals, ch({ id: 'ohne', stufe: 'verloren', historie: [], geaendert: '2026-09-01T10:00:00.000Z' })];
    expect(winLoss(ohneHistorie, HEUTE).quote).toBe(winRate(ohneHistorie, HEUTE).quote);
  });
  it('der Kreislauf der Planung nennt SQL → Gewonnen mit derselben Zahl', () => {
    const kontakte = [k('a')];
    const crm = crmMit({ chancen: deals });
    const kr = kreislauf({ heute: HEUTE, kanaele: [kanal()], zeilen: leads(kontakte, crm, HEUTE), crm, kontakte, nachLeistung: {}, followup: { faellig: 0, ueberfaellig: 0 } });
    const d = kr.stufen.find(s => s.id === 'deals')!;
    expect(d.ist).toContain('SQL → Gewonnen 70');
  });
});

describe('B4 · „Neue Leads“ je Lead-Zeile, ohne Art.-18-Personen — Scoreboard, Challenges, Kanal-Stand gleich', () => {
  const vermerk = (tag: string) => ({ am: `${tag}T09:00:00.000Z`, art: 'system' as const, text: 'Von Hand angelegt', von: A });
  // Eine Firma mit zwei frisch angelegten Personen, dazu eine eingeschränkte Person (Art. 18) — alle in dieser Woche angelegt.
  const kontakte = [
    k('a', { firmaId: 'f-acme', firma: 'Acme', importiertAm: HEUTE, aktivitaeten: [vermerk(HEUTE)], besitzer: A }),
    k('b', { firmaId: 'f-acme', firma: 'Acme', importiertAm: HEUTE, aktivitaeten: [vermerk(HEUTE)], besitzer: A }),
    k('c', { importiertAm: HEUTE, aktivitaeten: [vermerk(HEUTE)], besitzer: A, eingeschraenkt: { seit: HEUTE, grund: 'Antrag', von: A } } as Partial<Kontakt>),
  ];
  const crm = crmMit({ firmen: [{ id: 'f-acme', name: 'Acme', rolle: 'zielkunde', geaendert: J } as unknown as CrmBestand['firmen'][number]] });
  const zeilen = leads(kontakte, crm, HEUTE);
  it('vorher 3 (je Person, mit der eingeschränkten) gegen 1 (je Lead) — jetzt überall 1', () => {
    expect(zeilen.map(z => z.id)).toEqual(['f-acme']);
    const sb = wochenScoreboard(kontakte, crm, HEUTE, 1, { leads: 5, gespraeche: 1, sql: 1, angebote: 1, quelle: 'Test' });
    expect(sb.zeilen.find(z => z.id === 'neue_leads')!.werte.at(-1)).toBe(1);
    expect(wochenIst(kontakte, crm, HEUTE, HEUTE, zeilen).team.leads).toBe(1);
    expect(wochenIst(kontakte, crm, HEUTE, HEUTE, zeilen).je[A]?.leads).toBe(1);
  });
});

describe('B5 · Head of Sales: „Leads in Arbeit“ wie Liste und Runde', () => {
  const vermerk = (tag: string) => ({ am: `${tag}T09:00:00.000Z`, art: 'system' as const, text: 'Von Hand angelegt', von: A });
  // kalt: aus der Liste importiert, nie angesprochen, Status aus der Stufe „kontaktiert“; warm: frisch angelegt; deal: mit offenem Deal.
  const kontakte = [
    k('kalt', { stufe: 'angesprochen', importiertAm: '2026-01-01' }),
    k('warm', { stufe: 'angesprochen', importiertAm: HEUTE, aktivitaeten: [vermerk(HEUTE)] }),
    k('deal', { stufe: 'gespraech', importiertAm: HEUTE, aktivitaeten: [vermerk(HEUTE)] }),
  ];
  const crm = crmMit({ chancen: [ch({ id: 'ch-d', kontaktIds: ['c-deal'], stufe: 'bedarf' })] });
  it('vorher zählte der Head kalte Leads und Leads mit offenem Deal mit — jetzt dieselbe Menge wie „In Arbeit“ + „SQL-Entscheidung offen“', () => {
    const zeilen = leads(kontakte, crm, HEUTE);
    const daten = datenpaket('sales', 'lead_review', kontakte, crm, HEUTE, null, []) as { leads_in_arbeit: { lead_id: string }[] };
    const erwartet = zeilen.filter(z => inArbeit(z) || sqlEntscheidungOffen(z)).map(z => z.id);
    expect(daten.leads_in_arbeit.map(l => l.lead_id)).toEqual(erwartet);
    expect(erwartet).toEqual(zeilen.filter(z => passtLeadFilter(z, 'aktiv') || sqlEntscheidungOffen(z)).map(z => z.id));
    expect(erwartet).toEqual(['c-warm']);
  });
});

describe('B6 · Marketing-Trichter mit den Regeln des Scorings und der Leads-Liste', () => {
  const anfrage = (kanal: string, tag: string) => ({ am: `${tag}T09:00:00.000Z`, art: 'antwort' as const, text: `Anfrage über ${kanal}: Interesse`, von: A });
  const kontakte = [
    k('web', { importiertAm: '2026-10-01', aktivitaeten: [anfrage('Website', '2026-10-01')] }),
    k('empf', { importiertAm: '2026-10-01', aktivitaeten: [anfrage('Empfehlung', '2026-10-02')] }),
  ];
  const crm = crmMit({});
  it('eine Anfrage nach Empfehlung ist kein Marketing — vorher 2 Anfragen im Trichter, die Herkunft sagte 1; jetzt beide 1', () => {
    const t = marketingTrichter(kontakte, crm, HEUTE);
    expect(t.anfragen.gesamt).toBe(1);
    expect(kontakte.filter(x => marketingHerkunft([x]).length).length).toBe(1);
    // Leads im Prozess: die Lead-Zeile wie in der Liste („In Arbeit“) — die anfragende Person aus dem Marketing.
    const zeilen = leads(kontakte, crm, HEUTE);
    expect(t.uebergabe.leads).toBe(zeilen.filter(z => z.id === 'c-web' && inArbeit(z)).length);
  });
});

describe('B8 · Einrichtung: Gruppen und Etappen zählen wie die Gesamtzahl', () => {
  const kontext = { inhaber: true, haupt: true, personen: 2, privatFinanzen: true, betreiber: false };
  const schritte = schritteFuer(kontext);
  // Die Hälfte der Schritte abgehakt — darunter auch optionale.
  const erledigt = Object.fromEntries(schritte.filter((_, i) => i % 2 === 0).map(x => [x.id, { at: J, von: A }]));
  const z = { erledigt, befunde: {} };
  it('vorher „fertig von liste.length“ (mit Optionalem) — die Gruppen summierten sich nicht zur Gesamtzahl; jetzt schon', () => {
    const gesamt = einrichtungStand(kontext, z);
    const gruppen = Array.from(new Set(schritte.map(gruppeVon)));
    const summe = gruppen.map(g => fortschrittVon(schritte.filter(x => gruppeVon(x) === g), z, { alle: true })).reduce((a, f) => ({ fertig: a.fertig + f.fertig, gesamt: a.gesamt + f.gesamt }), { fertig: 0, gesamt: 0 });
    expect(summe).toEqual({ fertig: gesamt.fertig, gesamt: gesamt.gesamt });
    const etappen = Array.from(new Set(schritte.map(x => x.etappe)));
    const jeEtappe = etappen.map(e => fortschrittVon(schritte.filter(x => x.etappe === e), z, { alle: true })).reduce((a, f) => a + f.gesamt, 0);
    expect(jeEtappe).toBe(gesamt.gesamt);
    // Mit Optionalem im Nenner wäre die Summe größer gewesen (vorher).
    expect(schritte.length).toBeGreaterThanOrEqual(gesamt.gesamt);
    expect(schritte.filter(x => istFertig(x, z)).length).toBeGreaterThanOrEqual(gesamt.fertig);
  });
  it('die Einrichtungsseite zählt nur noch über fortschrittVon', () => {
    const quelle = readFileSync(path.resolve(__dirname, '..', 'components/os/OnboardingView.tsx'), 'utf8');
    expect(quelle).not.toMatch(/\$\{fertig\} von \$\{liste\.length\}/);
  });
});
