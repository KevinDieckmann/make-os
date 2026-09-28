// ─── Paket K4 (28.09.) — Pipeline & CRM-Bestand, reine Logik ────────────────
// Deal-Historie nicht kürzen (#83), Stand/409 für teil/upsert (#35/#42/#107), Löschsperre bei Verweisen (#49),
// Verschiebungen von „Entscheidung bis“, gewichtet ohne hängende, gemessene Quoten (#84–#86), Wärme verfällt,
// Quoten je Temperatur (#93/#95), Doppelklick-Sperre (#19). Alle Daten erfunden.
process.env.TZ = 'Europe/Berlin';
import { describe, it, expect } from 'vitest';
import { wendeCrmAn, leererBestand, HISTORIE_MAX } from '@/lib/crm/speicher';
import { crmMitStand, crmKonflikte, loeschSperren, standVon } from '@/lib/crm/crm-stand';
import { OFFENE_STUFEN, gesundheit, prognose, wechsleStufe, erwartetVerschiebung, VERSCHOBEN_GELB } from '@/lib/crm/pipeline';
import { gemesseneQuoten, MINDESTMENGE } from '@/lib/crm/deal-auswertung';
import { leadScore, temperaturLeistung, WAERME_VERFALL_TAGEN, type LeadScore } from '@/lib/crm/score';
import { klickSperren } from '@/lib/make-one/klick-sperre';
import type { Chance, CrmBestand, Firma, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';

const JETZT = '2026-09-28T10:00:00.000Z';
const HEUTE = '2026-09-28';
const [ERSTE, ZWEITE] = OFFENE_STUFEN;
const deal = (x: Partial<Chance> = {}): Chance => ({
  id: 'ch-1', titel: 'Beispiel AG · Retainer', kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: ERSTE,
  historie: [{ stufe: ERSTE, am: '2026-09-01T09:00:00.000Z', von: 'kevin' }], naechsterSchritt: { text: 'Angebot schicken', datum: '2026-10-05' },
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: '2026-09-01T09:00:00.000Z', geaendert: '2026-09-01T09:00:00.000Z', letzteAktivitaet: '2026-09-27', ...x,
});
const mit = (x: Partial<CrmBestand>): CrmBestand => ({ ...leererBestand(), ...x });
const teil = (liste: string, id: string, felder: Record<string, unknown>, stand?: string): ListenOp => ({ liste, op: 'teil', id, felder, ...(stand ? { stand } : {}) });

describe('#83 Deal-Historie wird nicht gekürzt', () => {
  const lang = Array.from({ length: 100 }, (_, i) => ({ stufe: i % 2 ? ZWEITE : ERSTE, am: `2026-0${1 + Math.floor(i / 20)}-${String(1 + (i % 20)).padStart(2, '0')}T09:00:00.000Z`, von: 'kevin' }));
  it('eine Änderung ohne Stufenwechsel behält alle 100 Einträge', () => {
    const r = wendeCrmAn(mit({ chancen: [deal({ historie: lang })] }), [teil('chancen', 'ch-1', { notiz: 'Hallo' })], JETZT, 'kevin');
    expect(r.bestand.chancen[0].historie).toHaveLength(100);
    expect(r.bestand.chancen[0].historie[0]).toEqual(lang[0]);
  });
  it('ein Stufenwechsel hängt an, statt die ältesten abzuschneiden', () => {
    const r = wendeCrmAn(mit({ chancen: [deal({ historie: lang, stufe: ERSTE })] }), [teil('chancen', 'ch-1', { stufe: ZWEITE })], JETZT, 'kevin');
    expect(r.fehler).toEqual([]);
    expect(r.bestand.chancen[0].historie).toHaveLength(101);
    expect(r.bestand.chancen[0].historie[0]).toEqual(lang[0]);
  });
  it('über der Grenze: abgelehnt mit Text (413 in der Route), nichts geändert', () => {
    const voll = Array.from({ length: HISTORIE_MAX }, () => ({ stufe: ERSTE, am: JETZT, von: 'kevin' }));
    const b = mit({ chancen: [deal({ historie: voll })] });
    const r = wendeCrmAn(b, [teil('chancen', 'ch-1', { stufe: ZWEITE })], JETZT, 'kevin');
    expect(r.grenze[0]).toContain(String(HISTORIE_MAX));
    expect(r.bestand).toBe(b);
  });
});

describe('#35/#42 Stand je Eintrag — 409 statt stillem Überschreiben', () => {
  const firma: Firma = { id: 'f-werke', name: 'Beispiel Werke GmbH', rolle: 'offen', geaendert: '2026-09-01T00:00:00.000Z' };
  const b0 = mit({ firmen: [firma] });
  const stand0 = standVon(firma);
  it('jeder Eintrag bekommt seinen Fingerabdruck', () => {
    expect((crmMitStand(b0).firmen[0] as Firma & { stand: string }).stand).toBe(stand0);
  });
  it('zwei Schreiber mit demselben Stand auf dasselbe Feld: der zweite bekommt einen Konflikt mit dem aktuellen Eintrag', () => {
    const r1 = wendeCrmAn(b0, [teil('firmen', 'f-werke', { stadt: 'Köln' }, stand0)], JETZT, 'kevin');
    expect(r1.konflikte).toEqual([]);
    expect(r1.bestand.firmen[0].stadt).toBe('Köln');
    const r2 = wendeCrmAn(r1.bestand, [teil('firmen', 'f-werke', { stadt: 'Bonn' }, stand0)], JETZT, 'malin');
    expect(r2.konflikte).toHaveLength(1);
    expect(r2.konflikte[0]).toMatchObject({ liste: 'firmen', id: 'f-werke', grund: 'inzwischen geändert', aktuell: { stadt: 'Köln' } });
    expect(r2.bestand.firmen[0].stadt).toBe('Köln');
  });
  it('ohne Stand bleibt teil erlaubt: verschiedene Felder kommen beide an', () => {
    const r1 = wendeCrmAn(b0, [teil('firmen', 'f-werke', { stadt: 'Köln' })], JETZT, 'kevin');
    const r2 = wendeCrmAn(r1.bestand, [teil('firmen', 'f-werke', { branche: 'Maschinenbau' })], JETZT, 'malin');
    expect(r2.konflikte).toEqual([]);
    expect(r2.bestand.firmen[0]).toMatchObject({ stadt: 'Köln', branche: 'Maschinenbau' });
  });
  it('ein ganzer Eintrag über einen bestehenden braucht den Stand — Firmen-Upsert füllt ohne Stand nur Lücken', () => {
    const m: Mandat = { id: 'm-1', kunde: 'Beispiel Werke', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 100, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: JETZT };
    const b = mit({ mandate: [m], firmen: [firma] });
    const ohne = crmKonflikte(b, [{ liste: 'mandate', op: 'upsert', eintrag: { ...m, titel: 'Neu' } }]);
    expect(ohne[0]).toMatchObject({ grund: 'ohne Stand', aktuell: { titel: 'Retainer' } });
    expect(crmKonflikte(b, [{ liste: 'mandate', op: 'upsert', eintrag: { ...m, titel: 'Neu' }, stand: standVon(m) }])).toEqual([]);
    expect(crmKonflikte(b, [{ liste: 'firmen', op: 'upsert', eintrag: { ...firma, notiz: 'x' } }])).toEqual([]);
    // Ein ganz neuer Eintrag braucht keinen Stand; ein Stand auf einen verschwundenen Eintrag ist ein Konflikt.
    expect(crmKonflikte(b, [{ liste: 'mandate', op: 'upsert', eintrag: { ...m, id: 'm-2' } }])).toEqual([]);
    expect(crmKonflikte(b, [teil('mandate', 'm-weg', { titel: 'x' }, 'abc')])[0].grund).toBe('inzwischen gelöscht');
  });
});

describe('#49 Firmen und Mandate mit Verweisen werden nicht gelöscht', () => {
  const f: Firma = { id: 'f-werke', name: 'Beispiel Werke GmbH', rolle: 'kunde', geaendert: JETZT };
  const leer: Firma = { id: 'f-leer', name: 'Leere Hülle GmbH', rolle: 'offen', geaendert: JETZT };
  const m = { id: 'm-1', kunde: 'Beispiel Werke', firmaId: 'f-werke', titel: 'Retainer', kontaktIds: [] } as unknown as Mandat;
  const b = mit({ firmen: [f, leer], chancen: [deal({ firmaId: 'f-werke' })], mandate: [m] });
  const kontext = { kontakte: [{ id: 'c-anna', firmaId: 'f-werke' }, { id: 'c-bert', firmaId: 'f-werke' }], rechnungen: [{ kunde: 'Beispiel Werke', status: 'gestellt', mandatId: 'm-1' }] };
  it('Firma mit Personen, Deal, Mandat und Rechnung: Sperre mit Anzahlen, nichts gelöscht', () => {
    const r = wendeCrmAn(b, [{ liste: 'firmen', op: 'delete', id: 'f-werke' }], JETZT, 'kevin', kontext);
    expect(r.sperren).toHaveLength(1);
    expect(r.sperren[0].anzahl).toEqual({ personen: 2, deals: 1, mandate: 1, rechnungen: 1 });
    expect(r.sperren[0].text).toContain('2 Personen · 1 Deal · 1 Mandat · 1 Rechnung');
    expect(r.bestand.firmen).toHaveLength(2);
  });
  it('Mandat mit Rechnung: Sperre; ohne Rechnung und leere Firma: gelöscht', () => {
    expect(loeschSperren(b, [{ liste: 'mandate', op: 'delete', id: 'm-1' }], kontext)[0].anzahl.rechnungen).toBe(1);
    expect(loeschSperren(b, [{ liste: 'mandate', op: 'delete', id: 'm-1' }], { ...kontext, rechnungen: [] })).toEqual([]);
    const r = wendeCrmAn(b, [{ liste: 'firmen', op: 'delete', id: 'f-leer' }], JETZT, 'kevin', kontext);
    expect(r.sperren).toEqual([]);
    expect(r.bestand.firmen.map(x => x.id)).toEqual(['f-werke']);
  });
});

describe('#84–#86 Pipeline ehrlicher', () => {
  it('„Entscheidung bis“ nach hinten: Ursprung einmal gemerkt, Zähler hoch; früher oder erstmals zählt nicht', () => {
    let b = mit({ chancen: [deal({ erwartetAm: '2026-10-15' })] });
    b = wendeCrmAn(b, [teil('chancen', 'ch-1', { erwartetAm: '2026-11-15' })], JETZT, 'kevin').bestand;
    expect(b.chancen[0]).toMatchObject({ erwartetAm: '2026-11-15', erwartetUrsprung: '2026-10-15', erwartetVerschoben: 1 });
    b = wendeCrmAn(b, [teil('chancen', 'ch-1', { erwartetAm: '2026-12-15' })], JETZT, 'kevin').bestand;
    expect(b.chancen[0]).toMatchObject({ erwartetUrsprung: '2026-10-15', erwartetVerschoben: 2 });
    b = wendeCrmAn(b, [teil('chancen', 'ch-1', { erwartetAm: '2026-12-01' })], JETZT, 'kevin').bestand;
    expect(b.chancen[0].erwartetVerschoben).toBe(2);
    expect(erwartetVerschiebung({}, { erwartetAm: '2026-12-01' })).toEqual({});
  });
  it('der Browser kann Zähler und Ursprung nicht setzen', () => {
    const b = wendeCrmAn(mit({ chancen: [deal({ erwartetAm: '2026-10-15', erwartetVerschoben: 3, erwartetUrsprung: '2026-09-15' })] }), [teil('chancen', 'ch-1', { erwartetVerschoben: 0, erwartetUrsprung: '2026-10-01' })], JETZT, 'kevin').bestand;
    expect(b.chancen[0]).toMatchObject({ erwartetVerschoben: 3, erwartetUrsprung: '2026-09-15' });
  });
  it(`ab ${VERSCHOBEN_GELB} Verschiebungen ist die Ampel gelb, mit Grund`, () => {
    expect(gesundheit(deal({ erwartetVerschoben: 1 }), HEUTE).ampel).toBe('gruen');
    const g = gesundheit(deal({ erwartetVerschoben: 2, erwartetUrsprung: '2026-10-01' }), HEUTE);
    expect(g.ampel).toBe('gelb');
    expect(g.gruende.join(' ')).toContain('2× verschoben');
  });
  it('Prognose weist „gewichtet ohne hängende“ aus', () => {
    const haengt = deal({ id: 'ch-2', naechsterSchritt: { text: 'x', datum: '2026-09-01' } });
    const p = prognose([deal(), haengt], HEUTE);
    expect(gesundheit(haengt, HEUTE).ampel).toBe('rot');
    expect(p.gewichtet).toBe(2 * Math.round((12_000 * 30) / 100) / 1);
    expect(p.gewichtetOhneHaengende).toBe(Math.round((12_000 * 30) / 100));
  });
  it('letzteAktivitaet beim Stufenwechsel ist der Berliner Tag, nicht der UTC-Tag', () => {
    const r = wechsleStufe(deal(), ZWEITE, 'kevin', '2026-09-27T22:30:00.000Z');
    expect(r.ok && r.chance.letzteAktivitaet).toBe('2026-09-28');
  });
  it(`gemessene Quote je Stufe erst ab ${MINDESTMENGE} Entscheidungen`, () => {
    const entschieden = (id: string, stufe: 'gewonnen' | 'verloren') => deal({ id, stufe, historie: [{ stufe: ERSTE, am: JETZT, von: 'k' }, { stufe: ZWEITE, am: JETZT, von: 'k' }, { stufe, am: JETZT, von: 'k' }] });
    const vier = [entschieden('a1', 'gewonnen'), entschieden('a2', 'gewonnen'), entschieden('a3', 'verloren'), entschieden('a4', 'verloren')];
    expect(gemesseneQuoten(vier).find(q => q.stufe === ZWEITE)).toMatchObject({ n: 4, quote: null });
    const fuenf = [...vier, entschieden('a5', 'gewonnen')];
    expect(gemesseneQuoten(fuenf).find(q => q.stufe === ZWEITE)).toMatchObject({ n: 5, gewonnen: 3, quote: 60 });
    // Eine Stufe, die keiner erreicht hat, misst nichts.
    expect(gemesseneQuoten(fuenf).find(q => q.stufe === OFFENE_STUFEN[3])).toMatchObject({ n: 0, quote: null });
  });
});

describe('#93/#95 Lead-Score: Wärme verfällt, Quoten je Temperatur', () => {
  const person = (o: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-1', vorname: 'Test', nachname: 'Person', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], ...o } as Kontakt);
  const vorTagen = (n: number) => { const d = new Date(`${HEUTE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString(); };
  const waerme = (k: Kontakt) => leadScore([k], undefined, HEUTE).teile.find(t => t.id === 'waerme')!;
  it(`„hat geantwortet“ zählt bis ${WAERME_VERFALL_TAGEN} Tage voll, danach abgekühlt`, () => {
    expect(waerme(person({ aktivitaeten: [{ am: vorTagen(100), art: 'antwort', von: 'kevin' }] })).punkte).toBe(12);
    const alt = waerme(person({ aktivitaeten: [{ am: vorTagen(200), art: 'antwort', von: 'kevin' }] }));
    expect(alt.punkte).toBe(5);
    expect(alt.grund).toContain('200 Tage');
  });
  it('„angesprochen“ ebenso; ein warmer Typ schlägt das Abgekühlte', () => {
    expect(waerme(person({ aktivitaeten: [{ am: vorTagen(30), art: 'mail', von: 'kevin' }] })).punkte).toBe(8);
    expect(waerme(person({ aktivitaeten: [{ am: vorTagen(400), art: 'mail', von: 'kevin' }] })).punkte).toBe(3);
    expect(waerme(person({ typ: 'Netzwerk', aktivitaeten: [{ am: vorTagen(400), art: 'antwort', von: 'kevin' }] })).punkte).toBe(10);
  });
  it(`SQL- und Gewinnquote je Temperatur erst ab ${MINDESTMENGE} Leads`, () => {
    const s = (temperatur: LeadScore['temperatur']): LeadScore => ({ punkte: 0, temperatur, teile: [] });
    const zeilen = [
      ...Array.from({ length: 5 }, (_, i) => ({ score: s('warm'), status: i < 2 ? 'sql' : i < 3 ? 'kunde' : 'neu', ...(i === 0 ? { deal: { stufe: 'gewonnen' } } : {}) })),
      ...Array.from({ length: 3 }, () => ({ score: s('kalt'), status: 'sql' })),
    ];
    const t = temperaturLeistung(zeilen);
    expect(t.find(x => x.temperatur === 'warm')).toMatchObject({ anzahl: 5, sql: 3, gewonnen: 2, sqlQuote: 60, gewinnQuote: 40 });
    expect(t.find(x => x.temperatur === 'kalt')).toMatchObject({ anzahl: 3, sql: 3, sqlQuote: null, gewinnQuote: null });
  });
});

describe('#19 Doppelklick-Sperre', () => {
  it('eine async Handlung läuft nur einmal, bis sie fertig ist — auch bei Fehler wieder frei', async () => {
    const sperre = { laeuft: false };
    let n = 0;
    let fertig!: () => void;
    const handlung = () => { n++; return new Promise<void>(r => { fertig = r; }); };
    const meldungen: boolean[] = [];
    const ende = klickSperren(sperre, handlung, l => meldungen.push(l));
    void klickSperren(sperre, handlung);
    void klickSperren(sperre, handlung);
    expect(n).toBe(1);
    expect(sperre.laeuft).toBe(true);
    fertig();
    await ende;
    expect(sperre.laeuft).toBe(false);
    expect(meldungen).toEqual([true, false]);
    await klickSperren(sperre, () => { n++; return Promise.reject(new Error('x')); });
    expect(n).toBe(2);
    expect(sperre.laeuft).toBe(false);
  });
  it('synchrone Handlungen sperren nicht', async () => {
    const sperre = { laeuft: false };
    let n = 0;
    await klickSperren(sperre, () => { n++; });
    await klickSperren(sperre, () => { n++; });
    expect(n).toBe(2);
  });
});
