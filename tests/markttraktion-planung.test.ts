// ─── Markttraktion · Planung (Schnellknopf „Planung“, 10.10.) — die reine Rechnung ─────────────────────────────────
// Kevin: „Umsatzziele auf einzelne Aktivitäten runterplanen — mit Kapa“ · „Das Wochen-Scoreboard ist mega, aber nur, wenn ich weiß, was das
// Ziel war“ · „Pipeline in einem Bereich … planen pro Leadkanal … der Kunde bleibt immer in diesem Kreis“. Geprüft wird:
//   Adresse (Schnellknopf rechts neben „Angebot“), Daten (Einzel-Schritte mit Stand, 400/409/413, nie Privat), Zuordnung (nur abgeleitet),
//   Rückwärts-Trichter (Umsatz → Leads je Kanal und Woche, letzter Start), Kapazität, Wochenziele im Scoreboard, Challenges, Kreislauf.
import { describe, it, expect } from 'vitest';
import type { Kontakt, Aktivitaet } from '../lib/make-one/crm';
import type { Chance, Mandat, Kampagne, CrmBestand } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { leads } from '../lib/crm/leads';
import { TEAM, BEIDE } from '../lib/crm/team-liste';
import { aufloesen, markttraktion, planungLink, REITER_ZEILE } from '../lib/crm/adresse';
import { WEG } from '../lib/wege';
import { leerePlanung, planungAnwenden, planungAus, type LeadKanal, type UmsatzZiel, type PlanungDatei, type Challenge } from '../lib/crm/planung-daten';
import {
  zuordnen, zielLage, kanalAnteile, standardQuoten, bedarfJePerson, kapaVergleich, wochenziele, wochenIst, challengeStand, challengeVorschlaege,
  kreislauf, istQuoten, nachLeistungSchritte, kanalStaende, ruhendeKontakte,
} from '../lib/crm/planung';
import { wochenScoreboard } from '../lib/crm/scoreboard';
import { MACHBAR_BIS } from '../lib/kapazitaet/typen';
import { GEHOERT_ZU_PRIVAT } from '../lib/einheiten';

const HEUTE = '2026-10-12'; // Montag
const A = TEAM[0].id, B = TEAM[1]?.id ?? TEAM[0].id;
const J = `${HEUTE}T09:00:00.000Z`;
const akt = (von: string, am: string, x: Partial<Aktivitaet> = {}): Aktivitaet => ({ am: `${am}T10:00:00.000Z`, art: 'anruf', von, ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-01-01', geaendertAm: '2026-01-01', ...x });
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
const kanal = (x: Partial<LeadKanal> = {}): LeadKanal => ({
  id: 'lk-netzwerk1', name: 'Netzwerk', herkunft: 'netzwerk', kanaele: ['netzwerk'], leadsMonat: 10, zyklusWochen: 8, quoten: {}, aktiv: true, geaendert: J, geaendertVon: A, ...x,
});
const ziel = (x: Partial<UmsatzZiel> = {}): UmsatzZiel => ({ id: 'uz-ziel1', gesellschaft: 'ug', von: HEUTE, bis: '2027-03-29', umsatz: 120_000, dealWert: 10_000, geaendert: J, geaendertVon: A, ...x });
const crmMit = (x: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), ...x });
const ctx = (person = A) => ({ person, jetzt: J, heute: HEUTE, standVon: (o: object) => JSON.stringify(o), neueId: (p: string) => `${p}-neu${Math.random().toString(36).slice(2, 8)}` });

describe('Adresse — Schnellknopf „Planung“ rechts neben „Angebot“', () => {
  it('steht in der Mitte nach dem Angebot und löst seine Ansichten auf', () => {
    expect(REITER_ZEILE.mitte).toEqual(['qualifizierung', 'angebot', 'planung']);
    expect(aufloesen('planung')).toEqual({ s: 'planung' });
    expect(aufloesen('planung', 'ziele')).toEqual({ s: 'planung', a: 'ziele' });
    expect(aufloesen('planung', 'kreislauf')).toEqual({ s: 'planung' });
    expect(aufloesen('planung', 'quatsch')).toEqual({ s: 'planung' });
    expect(markttraktion('planung', 'challenges')).toBe('/os/markttraktion?s=planung&a=challenges');
    expect(planungLink()).toBe('/os/markttraktion?s=planung');
    expect(planungLink('kanaele', 'lk-abcd1234')).toBe('/os/markttraktion?s=planung&a=kanaele&kanal=lk-abcd1234');
    expect(planungLink(undefined, '<b>')).toBe('/os/markttraktion?s=planung');
    expect(WEG.vertriebsplanung('ziele')).toBe('/os/markttraktion?s=planung&a=ziele');
  });
});

describe('Daten — Einzel-Schritte mit Stand, nie still gekürzt, nie Privat', () => {
  it('neuer Kanal ohne Stand; Herkunft belegt die Herkunftskanäle vor; Ändern nur mit Stand (sonst 409); null entfernt', () => {
    const r = planungAnwenden(leerePlanung(), [{ op: 'kanal', eintrag: { id: 'lk-reihe1', name: 'Eigene Reihe', herkunft: 'eventreihe', leadsMonat: 6, verantwortlich: B } }], ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const k1 = r.datei.kanaele[0];
    expect(k1).toMatchObject({ id: 'lk-reihe1', kanaele: ['event'], leadsMonat: 6, zyklusWochen: 8, aktiv: true, verantwortlich: B, geaendertVon: A });
    const ohneStand = planungAnwenden(r.datei, [{ op: 'kanal', eintrag: { id: 'lk-reihe1', leadsMonat: 9 } }], ctx());
    expect(ohneStand).toMatchObject({ ok: false, status: 409, konflikte: [{ op: 0, id: 'lk-reihe1' }] });
    const mit = planungAnwenden(r.datei, [{ op: 'kanal', stand: JSON.stringify(k1), eintrag: { id: 'lk-reihe1', leadsMonat: 9, verantwortlich: null, quoten: { leadZuGespraech: 40 } } }], ctx(B));
    expect(mit.ok).toBe(true);
    if (!mit.ok) return;
    expect(mit.datei.kanaele[0].leadsMonat).toBe(9);
    expect(mit.datei.kanaele[0].verantwortlich).toBeUndefined();
    expect(mit.datei.kanaele[0].quoten).toEqual({ leadZuGespraech: 40 });
    expect(mit.datei.kanaele[0].geaendertVon).toBe(B);
    const weg = planungAnwenden(mit.datei, [{ op: 'kanal-weg', id: 'lk-reihe1', stand: JSON.stringify(mit.datei.kanaele[0]) }], ctx());
    expect(weg.ok && weg.datei.kanaele.length).toBe(0);
  });

  it('Unsinn → 400, zu viel → 413 — alles oder nichts', () => {
    const d = leerePlanung();
    expect(planungAnwenden(d, [{ op: 'kanal', eintrag: { name: 'x', herkunft: 'quatsch' } }], ctx())).toMatchObject({ ok: false, status: 400 });
    expect(planungAnwenden(d, [{ op: 'kanal', eintrag: { name: 'x', herkunft: 'netzwerk', quoten: { leadZuGespraech: 140 } } }], ctx())).toMatchObject({ ok: false, status: 400 });
    expect(planungAnwenden(d, [{ op: 'kanal', eintrag: { name: 'x'.repeat(61), herkunft: 'netzwerk' } }], ctx())).toMatchObject({ ok: false, status: 400 });
    expect(planungAnwenden(d, Array.from({ length: 61 }, () => ({ op: 'kanal', eintrag: { name: 'x', herkunft: 'netzwerk' } })), ctx())).toMatchObject({ ok: false, status: 413 });
    const voll: PlanungDatei = { ...d, kanaele: Array.from({ length: 40 }, (_, i) => kanal({ id: `lk-voll${String(i).padStart(4, '0')}` })) };
    expect(planungAnwenden(voll, [{ op: 'kanal', eintrag: { name: 'noch einer', herkunft: 'frei' } }], ctx())).toMatchObject({ ok: false, status: 413 });
    // Der zweite Schritt scheitert → der erste wird nicht gespeichert.
    const halb = planungAnwenden(d, [{ op: 'kanal', eintrag: { name: 'gut', herkunft: 'frei' } }, { op: 'ziel', eintrag: { gesellschaft: 'ug', von: HEUTE, bis: HEUTE, umsatz: -1 } }], ctx());
    expect(halb).toMatchObject({ ok: false, status: 400 });
  });

  it('Umsatzziele nur für Business-Gesellschaften — die Selbstständigkeit (Privat) wird abgelehnt', () => {
    const privat = planungAnwenden(leerePlanung(), [{ op: 'ziel', eintrag: { gesellschaft: 'kdc', von: HEUTE, bis: '2026-12-31', umsatz: 50_000 } }], ctx());
    expect(privat).toMatchObject({ ok: false, status: 400, fehler: GEHOERT_ZU_PRIVAT('kdc') });
    const ok = planungAnwenden(leerePlanung(), [{ op: 'ziel', eintrag: { gesellschaft: 'ug', von: HEUTE, bis: '2026-12-31', umsatz: 50_000 } }, { op: 'ziel', eintrag: { gesellschaft: 'g-0123456789ab', von: HEUTE, bis: '2026-12-31', umsatz: 10 } }], ctx());
    expect(ok.ok).toBe(true);
    expect(planungAnwenden(leerePlanung(), [{ op: 'ziel', eintrag: { gesellschaft: 'ug', von: '2026-12-31', bis: HEUTE, umsatz: 5 } }], ctx())).toMatchObject({ status: 400 });
    // Beim Lesen fällt ein Ziel einer Privat-Einheit weg (falls es je von Hand in den Bestand käme).
    expect(planungAus({ ziele: [{ ...ziel(), gesellschaft: 'kdc' }] }).ziele).toEqual([]);
  });

  it('Challenges nur am Montag; Schritte nach der Leistung haken an und ab (idempotent)', () => {
    expect(planungAnwenden(leerePlanung(), [{ op: 'challenge', eintrag: { woche: '2026-10-13', art: 'gespraeche', titel: 'x', ziel: 3 } }], ctx())).toMatchObject({ status: 400 });
    const c = planungAnwenden(leerePlanung(), [{ op: 'challenge', eintrag: { woche: HEUTE, art: 'gespraeche', titel: '8 Gespräche', ziel: 8 } }], ctx());
    expect(c.ok && c.datei.challenges[0]).toMatchObject({ woche: HEUTE, person: BEIDE, ziel: 8 });
    const an = planungAnwenden(leerePlanung(), [{ op: 'schritt', mandatId: 'm-1', schritt: 'bewertung', erledigt: true }, { op: 'schritt', mandatId: 'm-1', schritt: 'bewertung', erledigt: true }], ctx());
    expect(an.ok && an.datei.nachLeistung).toEqual({ 'm-1': { bewertung: { am: HEUTE, von: A } } });
    const ab = an.ok ? planungAnwenden(an.datei, [{ op: 'schritt', mandatId: 'm-1', schritt: 'bewertung', erledigt: false }], ctx()) : null;
    expect(ab?.ok && ab.datei.nachLeistung).toEqual({});
  });
});

describe('Zuordnung — nur abgeleitet, genauer Bezug zuerst', () => {
  const kontakte = [
    k('ev', { herkunft: 'veranstaltung', firmaId: undefined }), k('netz', { herkunft: 'bekannt' }), k('kamp', { herkunft: 'bekannt' }), k('frei', {}),
  ];
  const kp: Kampagne = { id: 'kp-1', name: 'K', playbook: 'eigen', ziel: '', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds: ['c-kamp'], ergebnisse: [], von: 'hand', geaendert: J };
  const crm = crmMit({ kampagnen: [kp], chancen: [ch({ id: 'ch-ev', kontaktIds: ['c-ev'] }), ch({ id: 'ch-q', kontaktIds: ['c-unbekannt'], quelle: 'empfehlung' })] });
  const zeilen = leads(kontakte, crm, HEUTE);
  const kanaele = [
    kanal({ id: 'lk-netz0001', herkunft: 'netzwerk', kanaele: ['netzwerk'], rang: 2 }),
    kanal({ id: 'lk-kamp0001', name: 'Kampagne', herkunft: 'kampagne', bezug: 'kp-1', kanaele: [], rang: 1 }),
    kanal({ id: 'lk-reih0001', name: 'Reihe', herkunft: 'eventreihe', kanaele: ['event'] }),
    kanal({ id: 'lk-empf0001', name: 'Empfehlung', herkunft: 'empfehlung', kanaele: ['empfehlung'] }),
    kanal({ id: 'lk-aus00001', name: 'Aus', herkunft: 'frei', kanaele: ['unbekannt'], aktiv: false }),
  ];
  const zo = zuordnen(kanaele, zeilen, crm);
  it('Herkunft → Kanal; Kampagnen-Bezug schlägt die Herkunft; inaktive zählen nicht', () => {
    expect(zo.lead.get('c-ev')).toBe('lk-reih0001');
    expect(zo.lead.get('c-netz')).toBe('lk-netz0001');
    expect(zo.lead.get('c-kamp')).toBe('lk-kamp0001');
    expect(zo.lead.get('c-frei')).toBeNull();
  });
  it('Deals über ihren Lead, sonst über die Deal-Quelle — die Daten selbst bleiben unverändert', () => {
    expect(zo.deal.get('ch-ev')).toBe('lk-reih0001');
    expect(zo.deal.get('ch-q')).toBe('lk-empf0001');
    expect(crm.chancen.every(c => !('kanal' in c))).toBe(true);
  });
});

describe('Rückwärts-Trichter — Umsatz → Deals → Angebote → SQL → Gespräche → Leads je Kanal und Woche', () => {
  const crm = crmMit({});
  const kn = kanal({ quoten: { leadZuGespraech: 50, gespraechZuSql: 50, sqlZuAngebot: 50, angebotZuGewonnen: 50 }, zyklusWochen: 8 });
  // 24 Wochen Zeitraum, 8 Wochen Zyklus → 16 Wochen Lead-Fenster.
  const z = ziel({ von: HEUTE, bis: '2027-03-29' });
  const l = zielLage(z, { heute: HEUTE, kanaele: [kn], crm });
  it('rechnet rückwärts mit den Plan-Quoten', () => {
    expect(l.deals).toBe(12);
    const r = l.kanaele[0];
    expect(r.gewonnen).toBeCloseTo(12); expect(r.angebote).toBeCloseTo(24); expect(r.sql).toBeCloseTo(48); expect(r.gespraeche).toBeCloseTo(96); expect(r.leads).toBeCloseTo(192);
    expect(r.letzterStart).toBe('2027-02-01');
    expect(r.wochen).toBe(16);
    expect(r.jeWoche?.leads).toBeCloseTo(12);
    expect(r.jeWoche?.gespraeche).toBeCloseTo(6);
    expect(r.imFenster).toBe(true);
    expect(r.leadsMonatNoetig).toBeCloseTo(52.2, 0);
    expect(l.fehlt).toEqual([]);
  });
  it('zu spät: der letzte Start (Ende − Sales Cycle) liegt vor heute', () => {
    const spaet = zielLage(ziel({ bis: '2026-11-30' }), { heute: HEUTE, kanaele: [kanal({ zyklusWochen: 12 })], crm });
    expect(spaet.kanaele[0].zuSpaet).toBe(true);
    expect(spaet.kanaele[0].jeWoche).toBeNull();
    expect(spaet.fehlt.join(' ')).toContain('zu spät');
  });
  it('ohne Deal-Wert: gemessen (Ø gewonnener Deals ab drei), sonst „fehlt“', () => {
    const ohne = zielLage(ziel({ dealWert: undefined }), { heute: HEUTE, kanaele: [kn], crm });
    expect(ohne.deals).toBeNull();
    expect(ohne.fehlt[0]).toContain('Deal-Wert');
    const gewonnen = [1, 2, 3].map(i => ch({ id: `ch-g${i}`, stufe: 'gewonnen', wert: { betrag: 6000, basis: 'einmalig' }, historie: [{ stufe: 'gewonnen', am: i === 3 ? '2026-10-01T10:00:00.000Z' : J, von: A }] }));
    const gem = zielLage(ziel({ dealWert: undefined }), { heute: HEUTE, kanaele: [kn], crm: crmMit({ chancen: gewonnen }) });
    expect(gem.dealWert).toEqual({ wert: 6000, quelle: 'gemessen' });
    expect(gem.ist.umsatz).toBe(12_000); // nur die im Zeitraum gewonnenen
    expect(gem.deals).toBe(18); // Rest 108.000 € ÷ 6.000 € (Prüf-Fund 11.10.: der Trichter rechnet mit dem Rest)
  });
  it('Anteile: eigene des Ziels, sonst nach geplanter Leistung (Leads × Quoten), Annahme aus den Pipeline-Wahrscheinlichkeiten', () => {
    const std = standardQuoten();
    expect(std.angebotZuGewonnen).toBe(75);
    expect(std.sqlZuAngebot).toBe(40);
    const a = kanalAnteile([kanal({ id: 'lk-aaaa0001', leadsMonat: 30 }), kanal({ id: 'lk-bbbb0001', leadsMonat: 10 })], {}, std);
    expect(a.get('lk-aaaa0001')).toBeCloseTo(0.75);
    const b = kanalAnteile([kanal({ id: 'lk-aaaa0001' }), kanal({ id: 'lk-bbbb0001' })], { anteile: { 'lk-aaaa0001': 20, 'lk-bbbb0001': 60 } }, std);
    expect(b.get('lk-bbbb0001')).toBeCloseTo(0.75);
  });
});

describe('Kapazität — Bedarf je Person gegen die freie Zeit (Schwellen wie die Kapazität)', () => {
  const kn = kanal({ quoten: { leadZuGespraech: 50, gespraechZuSql: 50, sqlZuAngebot: 50, angebotZuGewonnen: 50 }, verantwortlich: B, vertrieb: A, minutenJeLead: 20, beitraegeWoche: 2 });
  const l = zielLage(ziel(), { heute: HEUTE, kanaele: [kn], crm: crmMit({}) });
  const zeiten = { gespraech: 45, angebot: 120, nachfassen: 15, beitrag: 30 };
  const bedarf = bedarfJePerson([l], [kn], zeiten, [A, B]);
  it('Leads und Beiträge bei der Verantwortlichen, Gespräche und Angebote im Vertrieb', () => {
    const a = bedarf.find(x => x.person === A)!, b = bedarf.find(x => x.person === B)!;
    // 12 Leads × 20 min + 2 Beiträge × 30 min = 300 min
    expect(b.stunden).toBe(5);
    // 6 Gespräche × (45 + 15) min + 1,5 Angebote × 120 min = 540 min
    expect(a.stunden).toBe(9);
  });
  it('machbar · eng · nicht machbar — bräuchte X h/Woche', () => {
    const v = kapaVergleich(bedarf, { [A]: 9 / MACHBAR_BIS, [B]: 4 });
    expect(v.find(x => x.person === A)?.status).toBe('machbar');
    expect(v.find(x => x.person === B)).toMatchObject({ status: 'nicht-machbar' });
    expect(v.find(x => x.person === B)?.text).toContain('bräuchte 5 h/Woche');
    expect(kapaVergleich(bedarf, null)[0].status).toBe('unbekannt');
  });
});

describe('Wochen-Scoreboard mit Ziel aus der Planung — erweitert, nicht ersetzt', () => {
  const kontakte = [k('x', { importiertAm: HEUTE, aktivitaeten: [akt(A, HEUTE, { art: 'gespraech' })] })];
  const crm = crmMit({ chancen: [ch({ historie: [{ stufe: 'qualifiziert', am: '2026-09-01T10:00:00.000Z', von: A }, { stufe: 'angebot', am: J, von: A }] })] });
  it('ohne Plan wie bisher (keine Plan-Zeilen)', () => {
    const sb = wochenScoreboard(kontakte, crm, HEUTE, 2);
    expect(sb.zeilen.some(z => z.id === 'neue_leads' || z.id === 'angebote')).toBe(false);
    expect(sb.zeilen.some(z => z.plan)).toBe(false);
  });
  it('mit Plan: Ziele für Gespräche und SQL aus dem Plan, dazu neue Leads und Angebote mit Soll/Ist', () => {
    const l = zielLage(ziel(), { heute: HEUTE, kanaele: [kanal({ quoten: { leadZuGespraech: 50, gespraechZuSql: 50, sqlZuAngebot: 50, angebotZuGewonnen: 50 } })], crm: crmMit({}) });
    const plan = wochenziele([l]);
    expect(plan).toMatchObject({ leads: 12, gespraeche: 6, sql: 3, angebote: 2 });
    const sb = wochenScoreboard(kontakte, crm, HEUTE, 2, plan);
    const z = (id: string) => sb.zeilen.find(x => x.id === id)!;
    expect(z('gespraeche')).toMatchObject({ ziel: 6, plan: true });
    expect(z('neue_chancen')).toMatchObject({ ziel: 3, plan: true });
    expect(z('neue_leads')).toMatchObject({ ziel: 12, plan: true });
    expect(z('neue_leads').werte[1]).toBe(1);
    expect(z('angebote').werte[1]).toBe(1);
    expect(z('gespraeche').quelle).toContain('Planung');
  });
});

describe('Challenges — Fortschritt aus echten Aktivitäten, Vorschläge aus den Lücken', () => {
  const kontakte = [
    k('a', { aktivitaeten: [akt(A, '2026-10-12', { art: 'gespraech' }), akt(A, '2026-10-13', { ergebnis: 'gespraech' })] }),
    k('ruhig', { letzterKontakt: '2026-05-01', aktivitaeten: [akt(B, '2026-05-01'), akt(B, '2026-10-14', { art: 'mail' })] }),
    k('sys', { aktivitaeten: [akt('system', '2026-10-12', { art: 'gespraech' })] }),
  ];
  const crm = crmMit({ sitzungen: [{ id: 's1', person: A, datum: '2026-10-12', karten: [] } as unknown as CrmBestand['sitzungen'][number]] });
  const ist = wochenIst(kontakte, crm, HEUTE, '2026-10-18');
  it('zählt echte Gespräche je Person (System nie), Power Hours, Reaktivieren nach ≥ 90 Tagen Stille', () => {
    expect(ist.team.gespraeche).toBe(2);
    expect(ist.je[A].gespraeche).toBe(2);
    expect(ist.team.powerhours).toBe(1);
    expect(ist.je[B].reaktivieren).toBe(1);
  });
  it('Stand: je Person bzw. gemeinsam, mit Link zur passenden Liste', () => {
    const c: Challenge = { id: 'chl-aaaa', woche: HEUTE, art: 'gespraeche', titel: '3 Gespräche', ziel: 3, person: A, geaendert: J, geaendertVon: A };
    const s = challengeStand(c, ist, []);
    expect(s).toMatchObject({ ist: 2, erreicht: false, href: WEG.powerHour() });
    expect(challengeStand({ ...c, person: BEIDE, ziel: 2 }, ist, []).erreicht).toBe(true);
  });
  it('Vorschläge: größte Lücke zuerst, höchstens drei, vorhandene Arten fallen weg, ruhende Kontakte füllen auf', () => {
    const l = zielLage(ziel(), { heute: HEUTE, kanaele: [kanal({ quoten: { leadZuGespraech: 50, gespraechZuSql: 50, sqlZuAngebot: 50, angebotZuGewonnen: 50 } })], crm: crmMit({}) });
    const plan = wochenziele([l]);
    const v = challengeVorschlaege({ woche: HEUTE, plan, lagen: [l], kanaele: [kanal()], vorwoche: { ...ist.team, gespraeche: 5 }, vorhanden: [], ruhend: 9, startwerte: { gespraeche: 8, powerhours: 4 } });
    expect(v.length).toBe(3);
    expect(v[0].art).not.toBe('gespraeche'); // 5 von 6 — kleinste Lücke
    expect(v.some(x => x.art === 'leads' && x.href === WEG.netzwerken())).toBe(true);
    const ohne = challengeVorschlaege({ woche: HEUTE, plan: null, lagen: [], kanaele: [], vorwoche: ist.team, vorhanden: [{ id: 'chl-x', woche: HEUTE, art: 'gespraeche', titel: 'x', ziel: 8, person: BEIDE, geaendert: J, geaendertVon: A }], ruhend: 9, startwerte: { gespraeche: 8, powerhours: 4 } });
    expect(ohne.map(x => x.art)).toEqual(['powerhours', 'reaktivieren']);
    expect(ruhendeKontakte(kontakte, HEUTE)).toBe(1);
  });
});

describe('Kreislauf — vom Leadkanal bis zum Wiederkauf, der Kunde bleibt im Kreis', () => {
  const kontakte = [k('a', { herkunft: 'bekannt', firmaId: 'f-acme', einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', am: '2026-07-01' } as unknown as NonNullable<Kontakt['einwilligungen']>[number]] })];
  const firmen = [{ id: 'f-acme', name: 'Acme', geaendert: J } as unknown as CrmBestand['firmen'][number]];
  const crm = crmMit({
    firmen,
    leistungen: [{ id: 'l-1', name: 'Produkt Eins', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, phasen: [{ id: 'p1', name: 'Start' }] }],
    mandate: [md({ firmaId: 'f-acme', kontaktIds: ['c-a'], leistungId: 'l-1', phase: 'p1', chanceId: 'ch-1' })],
    chancen: [
      ch({ id: 'ch-1', firmaId: 'f-acme', kontaktIds: ['c-a'], stufe: 'gewonnen', leistungId: 'l-1', historie: [{ stufe: 'gewonnen', am: '2026-05-20T10:00:00.000Z', von: A }], angelegt: '2026-05-01T10:00:00.000Z' }),
      ch({ id: 'ch-2', firmaId: 'f-acme', kontaktIds: ['c-a'], stufe: 'angebot', leistungId: 'l-2', angelegt: '2026-09-01T10:00:00.000Z' }),
    ],
  });
  const zeilen = leads(kontakte, crm, HEUTE);
  const kanaele = [kanal({ kanaele: ['netzwerk'] })];
  const kr = kreislauf({ heute: HEUTE, kanaele, zeilen, crm, kontakte, nachLeistung: { 'm-1': { testimonial: { am: HEUTE, von: A } } }, followup: { faellig: 3, ueberfaellig: 1 } });
  it('alle sieben Stufen mit Zahl und Ziel', () => {
    expect(kr.stufen.map(s => s.id)).toEqual(['kanaele', 'leads', 'deals', 'followup', 'fulfillment', 'nachher', 'wiederkauf']);
    expect(kr.stufen.find(s => s.id === 'deals')?.anzahl).toBe(1);
    expect(kr.stufen.find(s => s.id === 'followup')).toMatchObject({ anzahl: 3, href: WEG.followup() });
    expect(kr.stufen.find(s => s.id === 'fulfillment')?.anzahl).toBe(1);
    expect(kr.fulfillment[0]).toMatchObject({ produkt: 'Produkt Eins', phase: 'Start', anzahl: 1 });
    expect(kr.stufen.find(s => s.id === 'leads')?.annahme).toBe(true);
  });
  it('nach der Leistung: Cross-Selling und Newsletter abgeleitet, Testimonial von Hand, Bewertung offen — schon während des Fulfillments', () => {
    const s = Object.fromEntries(kr.kunden[0].schritte.map(x => [x.id, x]));
    expect(s.crossselling).toMatchObject({ erledigt: true, quelle: 'abgeleitet' });
    expect(s.newsletter).toMatchObject({ erledigt: true, quelle: 'abgeleitet' });
    expect(s.testimonial).toMatchObject({ erledigt: true, quelle: 'hand', von: A });
    expect(s.bewertung.erledigt).toBe(false);
    expect(s.ende.erledigt).toBe(false);
    expect(kr.kunden[0].offen).toBe(2); // Bewertung, Upselling (Ende zählt erst nach der Leistung)
    expect(nachLeistungSchritte(md({ status: 'beendet', ende: '2026-10-01' }), crm, [], undefined).find(x => x.id === 'ende')).toMatchObject({ erledigt: true, quelle: 'abgeleitet' });
  });
  it('Filter je Kanal: ohne Kanal-Zuordnung bleiben die Stufen leer', () => {
    const leer = kreislauf({ heute: HEUTE, kanaele, zeilen, crm, kontakte, nachLeistung: {}, followup: { faellig: 0, ueberfaellig: 0 } }, 'ohne');
    expect(leer.stufen.find(s => s.id === 'deals')?.anzahl).toBe(0);
  });
});

describe('Ist-Quoten — erst ab Mindestmenge, sonst „—“', () => {
  it('Lead → Gespräch und Gespräch → SQL aus den Leads', () => {
    const z = Array.from({ length: 10 }, (_, i) => ({ status: i < 5 ? 'im_gespraech' : i < 7 ? 'sql' : 'kontaktiert', deal: undefined, sqlAm: undefined } as const));
    const q = istQuoten(z as never, []);
    expect(q.werte.leadZuGespraech).toBe(70);
    expect(q.werte.gespraechZuSql).toBe(29);
    expect(q.werte.angebotZuGewonnen).toBeNull();
    expect(istQuoten(z.slice(0, 3) as never, []).werte.leadZuGespraech).toBeNull();
  });
  it('Kanal-Stände tragen Plan (mit Herkunft „plan“/„annahme“) und Ist je Quote', () => {
    const kontakte = [k('a', { herkunft: 'bekannt' })];
    const crm = crmMit({});
    const st = kanalStaende({ kanaele: [kanal({ quoten: { leadZuGespraech: 25 }, kostenJeLead: 50 })], zeilen: leads(kontakte, crm, HEUTE), crm, kontaktNach: new Map(kontakte.map(x => [x.id, x])), heute: HEUTE });
    expect(st[0].leads).toBe(1);
    expect(st[0].quoten.leadZuGespraech.plan).toEqual({ wert: 25, quelle: 'plan' });
    expect(st[0].quoten.gespraechZuSql.plan.quelle).toBe('annahme');
    expect(st[0].kostenJeSql).toBe(500); // 50 € ÷ (25 % × 40 %)
  });
});
