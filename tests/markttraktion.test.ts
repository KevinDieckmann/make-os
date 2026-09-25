import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Event, Teilnahme, Beitrag, Chance, Kampagne } from '../lib/crm/typen';
import type { Kpi, KpiAmpel } from '../lib/crm/kennzahlen';
import { leererBestand } from '../lib/crm/speicher';
import { traktion, weltScore, eventKennzahlen, uebergaben, IM_SCORE, WELTEN } from '../lib/crm/traktion';
import { aufloesen, markttraktion } from '../lib/crm/adresse';

const HEUTE = '2026-09-25';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const kpi = (id: string, ampel: KpiAmpel): Kpi => ({ id, label: id, wert: ampel === 'grau' ? null : 1, anzeige: '1', ampel, ziel: '', quelle: '' });
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'drei Folgegespräche', datum: '2026-09-10', status: 'durchgefuehrt', geaendert: HEUTE, ...x });
const t = (kontakt: string, status: Teilnahme['status'], x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${kontakt}`, eventId: 'ev-1', kontaktId: `c-${kontakt}`, status, geaendert: HEUTE, ...x });

describe('Traction-Score', () => {
  it('Gewichte aus dem KEMARIS-Konzept: Sales 50 (Vertrieb 30 + Conversions 20), Marketing 40 (15 + 25), Event 10', () => {
    expect(WELTEN.map(w => [w.id, w.gewicht])).toEqual([['sales', 50], ['marketing', 40], ['event', 10]]);
    expect(WELTEN.reduce((a, w) => a + w.gewicht, 0)).toBe(100);
  });

  it('Welt = Mittel der Ampelpunkte, grau zählt nicht', () => {
    expect(weltScore([kpi('a', 'gruen'), kpi('b', 'rot'), kpi('c', 'grau')])).toEqual({ score: 60, gemessen: 2 });
    expect(weltScore([kpi('a', 'grau')])).toEqual({ score: null, gemessen: 0 });
  });

  it('nichts gemessen → kein Score, keine erfundene Null', () => {
    const r = traktion({ sales: [], marketing: [], event: [] });
    expect(r.score).toBeNull();
    expect(r.vorlaeufig).toBe(false);
  });

  it('fehlt einer Welt jede Messung, rechnet der Score über die übrigen — und sagt „vorläufig“', () => {
    const r = traktion({ sales: IM_SCORE.sales.map(id => kpi(id, 'gruen')), marketing: [], event: [] });
    expect(r.score).toBe(100);
    expect(r.vorlaeufig).toBe(true);
    expect(r.hinweis).toContain('Marketing und Event noch ohne Messung');
  });

  it('geometrisches Mittel bestraft Ungleichgewicht stärker als der Durchschnitt', () => {
    const r = traktion({ sales: IM_SCORE.sales.map(id => kpi(id, 'gruen')), marketing: IM_SCORE.marketing.map(id => kpi(id, 'rot')), event: IM_SCORE.event.map(id => kpi(id, 'gelb')) });
    const arithmetisch = (100 * 50 + 20 * 40 + 60 * 10) / 100;
    expect(r.score).toBeLessThan(arithmetisch);
    expect(r.score).toBe(Math.round(Math.exp((50 * Math.log(100) + 40 * Math.log(20) + 10 * Math.log(60)) / 100)));
  });

  it('Grundlage (Datenreife, Art. 14) zählt nicht in den Score', () => {
    const r = traktion({ sales: [kpi('reife', 'rot'), kpi('power_hours', 'gruen')], marketing: [kpi('art14', 'rot')], event: [] });
    expect(r.welten.find(w => w.id === 'sales')!.score).toBe(100);
    expect(r.welten.find(w => w.id === 'marketing')!.score).toBeNull();
  });
});

describe('Event-Kennzahlen', () => {
  it('ohne Event alles grau', () => {
    expect(eventKennzahlen([], leererBestand(), HEUTE).every(x => x.ampel === 'grau')).toBe(true);
  });

  it('Nachfassen binnen 48 h: pünktlich, zu spät und noch offen nach Fristablauf', () => {
    const crm = { ...leererBestand(), events: [ev()], teilnahmen: [t('a', 'da', { followUpAm: '2026-09-11' }), t('b', 'da', { followUpAm: '2026-09-15' }), t('c', 'da')] };
    const n = eventKennzahlen([k('a'), k('b'), k('c')], crm, HEUTE).find(x => x.id === 'nachfassen_48h')!;
    expect(n.anzeige).toBe('33 %');
    expect(n.ampel).toBe('rot');
  });

  it('Events · 90 Tage: gelb, wenn keins stattfand, aber eins geplant ist', () => {
    const crm = { ...leererBestand(), events: [ev({ datum: '2026-03-01' }), ev({ id: 'ev-2', datum: '2026-10-20', status: 'geplant' })] };
    expect(eventKennzahlen([], crm, HEUTE).find(x => x.id === 'events_90')!.ampel).toBe('gelb');
  });

  it('Folgegespräche je Event aus dem Verlauf der Gäste (30 Tage)', () => {
    const gast = k('a', { aktivitaeten: [{ am: '2026-09-12T10:00:00Z', art: 'gespraech', von: 'kevin' }] });
    const crm = { ...leererBestand(), events: [ev()], teilnahmen: [t('a', 'da')] };
    const f = eventKennzahlen([gast], crm, HEUTE).find(x => x.id === 'folgegespraeche')!;
    expect(f.wert).toBe(1);
    expect(f.ampel).toBe('gelb');
  });
});

describe('Übergaben zwischen den Welten', () => {
  it('Event → Sales: Gäste ohne Nachfassen, mit überschrittener Frist', () => {
    const crm = { ...leererBestand(), events: [ev()], teilnahmen: [t('a', 'da'), t('b', 'da', { followUpAm: '2026-09-11' })] };
    const u = uebergaben([k('a'), k('b')], crm, HEUTE).find(x => x.id === 'event-nachfassen')!;
    expect(u).toMatchObject({ von: 'event', an: 'sales', anzahl: 1, ziel: { s: 'sales', a: 'heute' } });
    expect(u.text).toContain('1 über der 48-Stunden-Frist');
  });

  it('Marketing → Sales: Anfrage aus Content nur ohne offene Chance und ohne Werbesperre', () => {
    const b: Beitrag = { id: 'b-1', titel: 'x', kanal: 'linkedin', status: 'veroeffentlicht', wirkung: [{ kontaktId: 'c-a', art: 'anfrage', am: '2026-09-20' }, { kontaktId: 'c-b', art: 'gespraech', am: '2026-09-20' }, { kontaktId: 'c-s', art: 'anfrage', am: '2026-09-20' }], quellen: [], geaendert: HEUTE };
    const ch: Chance = { id: 'ch-1', titel: 'y', kontaktIds: ['c-b'], stufe: 'qualifiziert', angelegt: '2026-09-21', historie: [] } as unknown as Chance;
    const crm = { ...leererBestand(), beitraege: [b], chancen: [ch] };
    const u = uebergaben([k('a'), k('b'), k('s', { werbesperre: { seit: '2026-09-01', grund: 'widerspruch' } as Kontakt['werbesperre'] })], crm, HEUTE).find(x => x.id === 'content-ohne-chance')!;
    expect(u.anzahl).toBe(1);
  });

  it('Sales → Marketing: Stimmen der Kunden, die noch kein Thema sind', () => {
    const mitStimme = k('a', { aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'gespraech', von: 'kevin', notiz: { bedarf: 'Liquiditätsplanung fehlt' } } as Kontakt['aktivitaeten'][number]] });
    const genutzt = k('b', { aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'gespraech', von: 'kevin', notiz: { bedarf: 'Reporting' } } as Kontakt['aktivitaeten'][number]] });
    const crm = { ...leererBestand(), beitraege: [{ id: 'b-1', titel: 'x', kanal: 'linkedin' as const, status: 'idee' as const, wirkung: [], quellen: ['c-b'], geaendert: HEUTE }] };
    expect(uebergaben([mitStimme, genutzt], crm, HEUTE).find(x => x.id === 'stimmen-ohne-thema')!.anzahl).toBe(1);
  });

  it('Kampagne → Power Hour: nur aktive Kampagnen, nur noch nicht angesprochene Personen', () => {
    const kp = (status: Kampagne['status']): Kampagne => ({ id: `kp-${status}`, name: 'n', playbook: 'empfehlung', ziel: '', zielgruppe: {}, kanal: 'persoenlich', status, schritte: [], kontaktIds: ['c-a', 'c-b'], ergebnisse: [{ kontaktId: 'c-a', ergebnis: 'gespraech', am: HEUTE }], von: 'head-sales', geaendert: HEUTE });
    const crm = { ...leererBestand(), kampagnen: [kp('aktiv'), kp('entwurf')] };
    expect(uebergaben([k('a'), k('b')], crm, HEUTE).find(x => x.id === 'kampagne-offen')!.anzahl).toBe(1);
  });

  it('leerer Bestand → keine Übergaben', () => {
    expect(uebergaben([], leererBestand(), HEUTE)).toEqual([]);
  });
});

describe('Adressen — alte CRM-Links bleiben gültig', () => {
  it('alte Bereiche landen in ihrer Welt', () => {
    expect(aufloesen('heute')).toEqual({ s: 'sales', a: 'heute' });
    expect(aufloesen('pipeline')).toEqual({ s: 'sales', a: 'pipeline' });
    expect(aufloesen('kunden')).toEqual({ s: 'sales', a: 'kunden' });
    expect(aufloesen('events')).toEqual({ s: 'event' });
    expect(aufloesen('kartei', 'dubletten')).toEqual({ s: 'kontakte', a: 'dubletten' });
    expect(aufloesen('marketing', 'kampagnen')).toEqual({ s: 'marketing', a: 'kampagnen' });
    expect(aufloesen(null)).toEqual({ s: 'ueberblick' });
    expect(aufloesen('quatsch')).toEqual({ s: 'ueberblick' });
    expect(aufloesen('sales', 'quatsch')).toEqual({ s: 'sales', a: 'heute' });
  });

  it('Links bauen: kurz und eindeutig', () => {
    expect(markttraktion()).toBe('/os/markttraktion');
    expect(markttraktion('heute')).toBe('/os/markttraktion?s=sales');
    expect(markttraktion('pipeline')).toBe('/os/markttraktion?s=sales&a=pipeline');
    expect(markttraktion('kontakte', undefined, 'c-1')).toBe('/os/markttraktion?s=kontakte&k=c-1');
    expect(markttraktion('events')).toBe('/os/markttraktion?s=event');
  });
});
