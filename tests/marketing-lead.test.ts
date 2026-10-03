// ─── MQL nur aus dem Marketing (03.10.) ─────────────────────────────────────────────────────────────
// Kevin: „MQL sind nur die Leads, die aus dem Marketing kommen. Wenn jemand auf dem Event kommt, ist es ein Lead, bis es durch
// die Qualifragen gekommen ist.“ Hier: welche Quellen als Marketing gelten, dass der Kern und alle Leser dasselbe sehen
// (Scoring, Lifecycle, Leads-Zeile, Verteilung) und dass die neue Standard-Fassung gilt. Alles erfunden (@example.invalid).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-mql-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

import type { Kontakt, Einwilligung } from '@/lib/make-one/crm';
import type { CrmBestand, Event, Kampagne, Teilnahme } from '@/lib/crm/typen';
import { leererBestand } from '@/lib/crm/speicher';
import { istMarketingLead, marketingHerkunft, scoringRechnen, standardScoring, bisherigeRechnung, scoringOderStandard } from '@/lib/crm/scoring';
import { leadScore } from '@/lib/crm/score';
import { leads, mqlErreicht, qualiStand } from '@/lib/crm/leads';
import { lifecycleVorschlag, lifecycleVerteilung } from '@/lib/crm/vorschlaege';
import { scoringDateiAus } from '@/lib/crm/scoring-server';

const HEUTE = '2026-10-03';
const J = '2026-10-01T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x } as Kontakt);
const ew = (x: Partial<Einwilligung> = {}): Einwilligung => ({ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'DOI', zeitpunkt: J, erfasstVon: 'kevin', wortlaut: 'Ja, Newsletter', belegRef: 'd-1', ...x });
const event = (id: string, x: Partial<Event> = {}): Event => ({ id, titel: `Event ${id}`, format: 'stammtisch', ziel: 'Z', datum: '2026-09-20', status: 'durchgefuehrt', geaendert: J, ...x } as Event);
const teilnahme = (eventId: string, kontaktId: string, x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${eventId}-${kontaktId}`, eventId, kontaktId, status: 'da', geaendert: J, ...x });
const kampagne = (id: string, kontaktIds: string[], x: Partial<Kampagne> = {}): Kampagne => ({ id, name: `Kampagne ${id}`, playbook: 'newsletter', ziel: 'Z', zielgruppe: {}, kanal: 'mail', status: 'aktiv', schritte: [], kontaktIds, ergebnisse: [], von: 'hand', geaendert: J, ...x } as Kampagne);
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
const quellen = (p: Kontakt[], ctx = {}) => marketingHerkunft(p, ctx).map(g => g.quelle);

describe('Welche Quellen sind Marketing', () => {
  it('Website-Anfrage: selbst angegeben oder eine Anfrage im Verlauf', () => {
    expect(quellen([k('a', { herkunft: 'selbst' })])).toContain('anfrage');
    expect(quellen([k('a', { aktivitaeten: [{ am: '2026-09-20T09:00:00Z', art: 'antwort', von: 'kevin', text: 'Anfrage über Webseite: Hallo' }] })])).toContain('anfrage');
    // Eine einfache Antwort ist noch keine Anfrage.
    expect(istMarketingLead([k('a', { aktivitaeten: [{ am: '2026-09-20T09:00:00Z', art: 'antwort', von: 'kevin' }] })])).toBe(false);
  });
  it('Newsletter nur mit nachgewiesenem Double-Opt-in und ohne Widerruf', () => {
    expect(quellen([k('a', { einwilligungen: [ew()] })])).toEqual(['newsletter']);
    expect(istMarketingLead([k('a', { einwilligungen: [ew({ belegRef: undefined })] })])).toBe(false);
    expect(istMarketingLead([k('a', { einwilligungen: [ew({ widerrufenAm: '2026-09-30' })] })])).toBe(false);
    expect(istMarketingLead([k('a', { einwilligungen: [ew({ kanal: 'mail' })] })])).toBe(false);
  });
  it('Kampagne: gestartete Kampagne des Marketings — nicht Entwurf, nicht LinkedIn-Vernetzen, nicht persönlich oder Telefon', () => {
    const p = [k('a')];
    expect(quellen(p, { kampagnen: [kampagne('k1', ['c-a'])] })).toEqual(['kampagne']);
    expect(istMarketingLead(p, { kampagnen: [kampagne('k1', ['c-a'], { status: 'entwurf' })] })).toBe(false);
    expect(istMarketingLead(p, { kampagnen: [kampagne('k1', ['c-a'], { playbook: 'vernetzen', kanal: 'linkedin' })] })).toBe(false);
    expect(istMarketingLead(p, { kampagnen: [kampagne('k1', ['c-a'], { kanal: 'persoenlich' })] })).toBe(false);
    expect(istMarketingLead(p, { kampagnen: [kampagne('k1', ['c-a'], { kanal: 'telefon' })] })).toBe(false);
    expect(istMarketingLead(p, { kampagnen: [kampagne('k1', ['c-andere'])] })).toBe(false);
    // Die Quelle aus der Liste zählt ebenfalls.
    expect(quellen([k('a', { quelle: 'Kampagne Herbst' })])).toEqual(['kampagne']);
  });
  it('Content und Leadmagnet: Quelle Content, Beitrag, Newsletter', () => {
    expect(quellen([k('a', { quelle: 'Content: Whitepaper' })])).toEqual(['inhalt']);
    expect(quellen([k('a', { quelle: 'Beitrag auf LinkedIn' })])).toEqual(['inhalt']);
  });
  it('Anmeldung zu einem EIGENEN Event — selbst angemeldet oder per Mail eingeladen; nicht persönlich, nicht Netzwerken', () => {
    const p = [k('a')];
    const events = [event('e1'), event('e2', { marke: 'Netzwerken' })];
    expect(quellen(p, { events, teilnahmen: [teilnahme('e1', 'c-a', { status: 'zugesagt' })] })).toEqual(['event']);
    expect(quellen(p, { events, teilnahmen: [teilnahme('e1', 'c-a', { einladungsweg: 'mail' })] })).toEqual(['event']);
    expect(istMarketingLead(p, { events, teilnahmen: [teilnahme('e1', 'c-a', { einladungsweg: 'persoenlich' })] })).toBe(false);
    expect(istMarketingLead(p, { events, teilnahmen: [teilnahme('e1', 'c-a', { einladungsweg: 'telefon' })] })).toBe(false);
    // Besuchtes Event (Netzwerken): eine Begegnung, kein Marketing — auch mit „da“.
    expect(istMarketingLead(p, { events, teilnahmen: [teilnahme('e2', 'c-a')] })).toBe(false);
    // Nur eingeladen oder vorgemerkt: noch keine Anmeldung.
    expect(istMarketingLead(p, { events, teilnahmen: [teilnahme('e1', 'c-a', { status: 'eingeladen' })] })).toBe(false);
  });
  it('Keine Marketing-Herkunft: Empfehlung, Direktansprache/Recherche, Netzwerk, Bestand (HubSpot, Auftrag)', () => {
    for (const herkunft of ['empfehlung', 'recherche', 'bekannt', 'hubspot', 'vertrag', 'veranstaltung'] as const) expect(istMarketingLead([k('a', { herkunft })]), herkunft).toBe(false);
    expect(istMarketingLead([k('a', { quelle: 'Leadliste Kaltakquise' })])).toBe(false);
    expect(istMarketingLead([k('a')])).toBe(false);
  });
  it('Eine Firma gilt als Marketing-Lead, sobald EINE Person aus dem Marketing kommt', () => {
    expect(istMarketingLead([k('a', { herkunft: 'empfehlung' }), k('b', { herkunft: 'selbst' })])).toBe(true);
  });
});

describe('Der Kern: das Marketing-Scoring gilt nur für Marketing-Leads', () => {
  const warm = (x: Partial<Kontakt> = {}) => k('a', { eignung: 'ja', email: 'a@example.invalid', telefon: '030 1', aktivitaeten: [{ am: '2026-09-28T09:00:00Z', art: 'gespraech', von: 'kevin' }], ...x });
  it('Begegnung: Punkte werden gerechnet (Wärme für die Reihenfolge), aber nie MQL — „gilt“ ist false', () => {
    const r = scoringRechnen([warm({ herkunft: 'veranstaltung' })], undefined, HEUTE);
    expect(r.marketingLead).toBe(false);
    expect(r.marketing.gilt).toBe(false);
    expect(r.marketing.punkte).toBeGreaterThanOrEqual(r.marketing.schwelle);
    expect(r.marketing.erreicht).toBe(false);
    expect(r.marketing.fehlt).toEqual([]);
    expect(r.gesamt).toBeGreaterThan(0);
  });
  it('Marketing-Lead mit denselben Signalen: MQL erreicht; Herkunft steht im Ergebnis', () => {
    const r = scoringRechnen([warm({ herkunft: 'selbst' })], undefined, HEUTE);
    expect(r.marketingLead).toBe(true);
    expect(r.marketing).toMatchObject({ gilt: true, erreicht: true });
    expect(r.marketingHerkunft.map(g => g.quelle)).toContain('anfrage');
  });
  it('gilt auch für die bisherige Rechnung (Schwelle 35) — die Herkunft entscheidet zuerst', () => {
    const e = bisherigeRechnung();
    expect(scoringRechnen([warm({ herkunft: 'empfehlung' })], undefined, HEUTE, { einstellungen: e }).marketing.erreicht).toBe(false);
    expect(scoringRechnen([warm({ herkunft: 'selbst' })], undefined, HEUTE, { einstellungen: e }).marketing.erreicht).toBe(true);
  });
  it('Kampagnen aus dem Bestand kommen über den Kontext in die Rechnung', () => {
    const r = scoringRechnen([warm()], undefined, HEUTE, { kampagnen: [kampagne('k1', ['c-a'])] });
    expect(r.marketingLead).toBe(true);
  });
});

describe('Alle Leser sehen dasselbe', () => {
  const e1 = event('e1', { marke: 'Netzwerken' });
  const crm = bestand({
    firmen: [{ id: 'f-b', name: 'Begegnung GmbH', rolle: 'zielkunde', geaendert: J }, { id: 'f-m', name: 'Marketing GmbH', rolle: 'zielkunde', geaendert: J }] as CrmBestand['firmen'],
    events: [e1], teilnahmen: [teilnahme('e1', 'c-b')],
  });
  const heiss = { eignung: 'ja' as const, email: 'x@example.invalid', telefon: '030 1', aktivitaeten: [{ am: '2026-09-28T09:00:00Z', art: 'gespraech' as const, von: 'kevin' }] };
  const kontakte = [k('b', { ...heiss, firmaId: 'f-b', firma: 'Begegnung GmbH', herkunft: 'veranstaltung' }), k('m', { ...heiss, firmaId: 'f-m', firma: 'Marketing GmbH', herkunft: 'selbst' })];
  it('Leads-Zeile: Begegnung bleibt „lead“ (noch zu qualifizieren), Marketing-Lead wird MQL; Kennzahl zählt nur Letzteren', () => {
    const z = leads(kontakte, crm, HEUTE);
    const b = z.find(x => x.id === 'f-b')!, m = z.find(x => x.id === 'f-m')!;
    expect(mqlErreicht(b)).toBe(false);
    expect(qualiStand(b)).toBe('lead');
    expect(b.score.scoring!.marketingLead).toBe(false);
    expect(mqlErreicht(m)).toBe(true);
    expect(qualiStand(m)).toBe('mql');
    expect(z.filter(mqlErreicht)).toHaveLength(1);
  });
  it('Lifecycle-Vorschlag und -Verteilung: nur der Marketing-Lead ist MQL', () => {
    expect(lifecycleVorschlag(kontakte[0], crm, HEUTE).id).toBe('lead');
    expect(lifecycleVorschlag(kontakte[1], crm, HEUTE).id).toBe('mql');
    const v = lifecycleVerteilung(kontakte, crm, HEUTE);
    expect(v.vorgeschlagen.mql).toBe(1);
    expect(v.je.mql).toBe(0); // ohne von Hand gesetzte Phase gilt „Lead“ — nichts wird still gespeichert
  });
  it('leadScore (Akte, Runde, Segmente) trägt das Ergebnis des Kerns', () => {
    expect(leadScore([kontakte[0]], undefined, HEUTE).scoring!.marketing.gilt).toBe(false);
    expect(leadScore([kontakte[1]], undefined, HEUTE).scoring!.marketing.gilt).toBe(true);
  });
});

describe('Standard seit 03.10.: der geschärfte Vorschlag; die alte Rechnung bleibt wählbar', () => {
  it('Standard = Vorschlag (Marketing 8, Sales 28, Muss, Temperatur 5/12/25); kaputte Einstellungen fallen darauf zurück', () => {
    const s = standardScoring();
    expect(s).toMatchObject({ quelle: 'standard', marketing: { schwelle: 8 }, sales: { schwelle: 28 }, temperaturAb: { lau: 5, warm: 12, heiss: 25 } });
    expect(s.sales.muss).toHaveLength(3);
    expect(scoringOderStandard({ marketing: 'kaputt' })).toEqual(s);
  });
  it('Bisherige Rechnung: Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbar 10, MQL 35, SQL 15, Temperatur 25/50/75', () => {
    expect(bisherigeRechnung()).toMatchObject({ quelle: 'bisherig', marketing: { schwelle: 35 }, sales: { schwelle: 15 }, temperaturAb: { lau: 25, warm: 50, heiss: 75 } });
  });
  it('Nichts gespeichert → Standard; gespeichert wird behalten; die als „Standard“ gespeicherte alte Rechnung heißt „bisherig“ (nur das Etikett)', () => {
    expect(scoringDateiAus(null).einstellungen).toEqual(standardScoring());
    const eigen = { ...standardScoring(), sales: { ...standardScoring().sales, schwelle: 40 }, quelle: 'eigen' as const };
    expect(scoringDateiAus({ einstellungen: eigen }).einstellungen.sales.schwelle).toBe(40);
    const alt = scoringDateiAus({ einstellungen: { ...bisherigeRechnung(), quelle: 'standard' } }).einstellungen;
    expect(alt.quelle).toBe('bisherig');
    expect(alt.sales.schwelle).toBe(15);
    expect(alt.marketing.schwelle).toBe(35);
  });
});
