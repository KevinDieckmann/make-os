// ─── Marketing-Trichter (27.09.): Reichweite → Resonanz → Anfragen → Übergabe, Kosten je Anfrage/SQL, Mindestmengen. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Beitrag, Chance, CrmBestand, FollowUp, Kampagne } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { marketingTrichter, quote, istAnfrage, istAnfrageFollowUp, MINDESTMENGE, ANFRAGE_PRAEFIX, ANFRAGE_FOLLOWUP, TRICHTER_QUELLEN } from '../lib/crm/marketing';

const HEUTE = '2026-09-27';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const b = (id: string, x: Partial<Beitrag> = {}): Beitrag => ({ id: `bt-${id}`, titel: id, kanal: 'linkedin', status: 'veroeffentlicht', datum: '2026-09-20', wirkung: [], quellen: [], geaendert: `${HEUTE}T09:00:00Z`, ...x });
const ch = (id: string, x: Partial<Chance> = {}): Chance => ({
  id: `ch-${id}`, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: `${HEUTE}T09:00:00.000Z`, geaendert: HEUTE, ...x,
});
const kp = (id: string, x: Partial<Kampagne> = {}): Kampagne => ({ id: `kp-${id}`, name: id, playbook: 'eigen', ziel: '', zielgruppe: {}, kanal: 'mail', status: 'aktiv', start: '2026-09-01', schritte: [], kontaktIds: [], ergebnisse: [], von: 'hand', geaendert: HEUTE, ...x });
const fu = (id: string, x: Partial<FollowUp> = {}): FollowUp => ({ id: `fu-${id}`, bezug: { art: 'kontakt', id: 'c-a' }, kontaktId: 'c-a', art: 'mail', text: `${ANFRAGE_FOLLOWUP} — Website`, faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: HEUTE, geaendert: HEUTE, ...x });
const anfrageAkt = (am: string, text = 'Bitte Rückruf') => ({ am: `${am}T10:00:00.000Z`, art: 'antwort' as const, text: `${ANFRAGE_PRAEFIX}Website: ${text}`, von: 'kevin' });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });

describe('Trichter — grau statt Null', () => {
  it('ohne Daten ist jede Stufe null, Kosten nicht messbar', () => {
    const t = marketingTrichter([], bestand(), HEUTE);
    expect(t.tage).toBe(90);
    expect(t.stufen.map(s => s.wert)).toEqual([null, null, null, null]);
    expect(t.kosten).toMatchObject({ gesamt: 0, jeAnfrage: null, jeSql: null, messbar: false });
    expect(t.stufen[0].umwandlung?.wert).toBeNull();
  });
  it('Marken: Anfrage-Aktivität und Anfrage-Follow-up werden am Text erkannt', () => {
    expect(istAnfrage({ art: 'antwort', text: 'Anfrage über Mail: Hallo' })).toBe(true);
    expect(istAnfrage({ art: 'antwort', text: 'Hat auf den Beitrag geantwortet' })).toBe(false);
    expect(istAnfrage({ art: 'gespraech', text: 'Anfrage über Mail: x' })).toBe(false);
    expect(istAnfrageFollowUp({ text: 'Anfrage beantworten — Mail' })).toBe(true);
    expect(istAnfrageFollowUp({ text: 'Angebot schicken' })).toBe(false);
    expect(TRICHTER_QUELLEN).toEqual(['content', 'inbound', 'kampagne']);
  });
  it('Quoten erst ab der Mindestmenge', () => {
    expect(MINDESTMENGE).toBe(5);
    expect(quote(2, 4)).toBeNull();
    expect(quote(2, 5)).toBe(0.4);
    expect(quote(1, 1, 1)).toBe(1);
  });
});

describe('Trichter — Reichweite und Resonanz', () => {
  const beitraege = [
    b('a', { datum: '2026-09-25', wirkung: [{ kontaktId: 'c-x', art: 'reaktion', am: '2026-09-25' }, { kontaktId: 'c-x', art: 'reaktion', am: '2026-09-26' }, { kontaktId: 'c-y', art: 'reaktion', am: '2026-09-26' }] }),
    b('b', { datum: '2026-08-15', wirkung: [{ kontaktId: 'c-x', art: 'reaktion', am: '2026-08-15' }] }),
    b('c', { datum: '2026-06-01' }),                   // älter als 90 Tage
    b('d', { status: 'geplant', datum: HEUTE }),        // geplant zählt nicht
  ];
  it('zählt veröffentlichte Beiträge im Fenster, 30 und 90 Tage fest, Reaktionen je Person und Beitrag einmal', () => {
    const t = marketingTrichter([], bestand({ beitraege }), HEUTE);
    expect(t.reichweite).toMatchObject({ beitraege: 2, beitraege30: 1, beitraege90: 2, messbar: true });
    expect(t.resonanz).toMatchObject({ reaktionen: 3, personen: 2, jeBeitrag: null, messbar: true });
    const t30 = marketingTrichter([], bestand({ beitraege }), HEUTE, 30);
    expect(t30.reichweite.beitraege).toBe(1);
    expect(t30.resonanz.reaktionen).toBe(2);
  });
  it('Reaktionen je Beitrag erst ab fünf Beiträgen', () => {
    const viele = Array.from({ length: 5 }, (_, i) => b(`v${i}`, { datum: '2026-09-1' + i, wirkung: [{ kontaktId: `c-${i}`, art: 'reaktion', am: '2026-09-1' + i }] }));
    const t = marketingTrichter([], bestand({ beitraege: viele }), HEUTE);
    expect(t.resonanz.jeBeitrag).toBe(1);
    expect(t.stufen[0].umwandlung?.text).toContain('1 Reaktionen je Beitrag');
  });
});

describe('Trichter — Anfragen', () => {
  it('Wirkung „anfrage“ am Beitrag und Aktivität im Verlauf derselben Person am selben Tag zählen EINMAL', () => {
    const beitraege = [b('a', { wirkung: [{ kontaktId: 'c-a', art: 'anfrage', am: '2026-09-26' }] })];
    const kontakte = [k('a', { aktivitaeten: [anfrageAkt('2026-09-26')] }), k('b', { aktivitaeten: [anfrageAkt('2026-09-20')] })];
    const t = marketingTrichter(kontakte, bestand({ beitraege, followups: [fu('1'), fu('2', { status: 'erledigt', kontaktId: 'c-b' })] }), HEUTE);
    expect(t.anfragen).toMatchObject({ gesamt: 2, anBeitraegen: 1, ausEingang: 2, offen: 1, messbar: true });
    expect(t.anfragen.personen.sort()).toEqual(['c-a', 'c-b']);
    // Anfragen je reagierende Person erst ab fünf Reagierenden.
    expect(t.anfragen.quote).toBeNull();
  });
  it('Anfragen außerhalb des Fensters zählen nicht, Aktivitäten ohne Marke auch nicht', () => {
    const kontakte = [k('a', { aktivitaeten: [anfrageAkt('2026-05-01'), { am: '2026-09-20T10:00:00Z', art: 'antwort', text: 'Antwort auf meine Mail', von: 'kevin' }] })];
    const t = marketingTrichter(kontakte, bestand(), HEUTE);
    expect(t.anfragen.gesamt).toBe(0);
    expect(t.anfragen.messbar).toBe(true); // es gab je eine Anfrage — die Stufe ist messbar, nur leer im Fenster
  });
});

describe('Trichter — Übergabe und Kosten', () => {
  const kontakte = [
    k('a', { firmaId: 'f-1', aktivitaeten: [anfrageAkt('2026-09-10')] }),  // Anfrage, Firma in Qualifizierung → Lead im Prozess
    k('b', { aktivitaeten: [anfrageAkt('2026-09-12')] }),                    // Anfrage, kein Status → zählt als im Prozess
    k('c', { aktivitaeten: [anfrageAkt('2026-09-15')] }),                    // Anfrage → Deal (Attribution über die Person)
    k('d', { firmaId: 'f-2', aktivitaeten: [anfrageAkt('2026-09-16')] }),   // Firma schon SQL → kein Lead im Prozess
  ];
  const crm = bestand({
    firmen: [
      { id: 'f-1', name: 'Eins GmbH', rolle: 'zielkunde', lead: { status: 'qualifizierung', kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } }, geaendert: HEUTE },
      { id: 'f-2', name: 'Zwei AG', rolle: 'zielkunde', lead: { status: 'sql', kriterien: { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } }, geaendert: HEUTE },
    ],
    chancen: [
      ch('kampagne', { quelle: 'kampagne', kontaktIds: ['c-z'] }),                                   // Quelle Kampagne → zählt
      ch('anfrage', { kontaktIds: ['c-c'], angelegt: '2026-09-20T09:00:00.000Z' }),                   // ohne Quelle, aber Anfrage der Person 5 Tage vorher → zählt
      ch('empfehlung', { quelle: 'empfehlung', kontaktIds: ['c-q'] }),                                // Sales-Quelle → zählt nicht
      ch('alt', { quelle: 'content', angelegt: '2026-01-01T09:00:00.000Z' }),                          // außerhalb des Fensters
    ],
    beitraege: [b('a', { datum: '2026-09-20', kostenEuro: 300 }), b('b', { datum: '2026-05-01', kostenEuro: 999 }), b('c', { status: 'idee', kostenEuro: 50, geaendert: `${HEUTE}T08:00:00Z` })],
    kampagnen: [kp('laeuft', { kostenEuro: 200, start: '2026-06-01' }), kp('vorbei', { kostenEuro: 500, start: '2026-01-01', ende: '2026-02-01', status: 'abgeschlossen' })],
  });
  it('Deals aus Marketing: Quelle Content/Anfrage/Kampagne oder Attribution über die Person; ein Deal ist das SQL', () => {
    const t = marketingTrichter(kontakte, crm, HEUTE);
    expect(t.uebergabe.dealIds.sort()).toEqual(['ch-anfrage', 'ch-kampagne']);
    expect(t.uebergabe).toMatchObject({ deals: 2, sql: 2, leads: 2, messbar: true });
    expect(t.uebergabe.quote).toBeNull(); // 4 Anfragen < Mindestmenge
    expect(t.stufen[3]).toMatchObject({ wert: 2, umwandlung: null });
  });
  it('Kosten: Beiträge mit Datum im Fenster (Ideen über „geändert“), Kampagnen, deren Zeitraum das Fenster schneidet', () => {
    const t = marketingTrichter(kontakte, crm, HEUTE);
    expect(t.kosten).toMatchObject({ beitraege: 350, kampagnen: 200, gesamt: 550, messbar: true });
    // 4 Anfragen und 2 SQL — unter der Mindestmenge keine Kosten je Stück.
    expect(t.kosten.jeAnfrage).toBeNull();
    expect(t.kosten.jeSql).toBeNull();
  });
  it('Kosten je Anfrage und je SQL ab fünf Fällen', () => {
    const viele = Array.from({ length: 5 }, (_, i) => k(`n${i}`, { aktivitaeten: [anfrageAkt('2026-09-2' + i)] }));
    const deals = Array.from({ length: 5 }, (_, i) => ch(`d${i}`, { quelle: 'inbound', kontaktIds: [`c-n${i}`] }));
    const t = marketingTrichter(viele, bestand({ chancen: deals, kampagnen: [kp('x', { kostenEuro: 1000 })] }), HEUTE);
    expect(t.kosten.jeAnfrage).toBe(200);
    expect(t.kosten.jeSql).toBe(200);
    expect(t.uebergabe.quote).toBe(1);
    expect(t.stufen[2].umwandlung?.text).toBe('100 % der Anfragen werden SQL');
  });
  it('ohne Kostenangaben bleiben die Kosten grau — auch bei genug Anfragen', () => {
    const viele = Array.from({ length: 6 }, (_, i) => k(`n${i}`, { aktivitaeten: [anfrageAkt('2026-09-2' + i)] }));
    const t = marketingTrichter(viele, bestand(), HEUTE);
    expect(t.anfragen.gesamt).toBe(6);
    expect(t.kosten).toMatchObject({ messbar: false, jeAnfrage: null });
  });
});
