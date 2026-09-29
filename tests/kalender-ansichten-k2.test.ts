// ─── Kalender K2 (29.09.): Jahr, 4 Tage, Quellen, Auswertung, Anlässe — Render-Tests ohne Browser ─
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/os/kalender', useSearchParams: () => new URLSearchParams() }));

import { Jahr, jahresTage } from '@/components/os/kalender/Jahr';
import { VierTage, vierTageAb } from '@/components/os/kalender/VierTage';
import { feiertagsTermine, geburtstagsTermine, istQuellTermin, FEIERTAGE_KALENDER } from '@/components/os/kalender/quellen';
import { AuswertungInhalt } from '@/components/os/kalender/Auswertung';
import { AnlaesseZeile, wannText } from '@/components/os/kalender/Anlaesse';
import { jahrVerdichten, letzterTag } from '@/lib/kalender/jahr';
import { zeitAuswertung } from '@/lib/kalender/auswertung';
import type { KTermin } from '@/components/os/kalender/teile';
import type { AuswertungAntwort } from '@/lib/kalender/auswertung-server';

const termin = (x: Partial<KTermin>): KTermin => ({ id: 't', uid: 't', titel: 'Termin', start: '2026-09-29T10:00:00', ende: '2026-09-29T11:00:00', ganztags: false, kalender: 'Privat Kevin', wer: 'kevin', serie: false, mitTeilnehmern: false, bearbeitbar: true, ...x });

describe('Quellen als Kalender-Einträge', () => {
  it('Feiertage NRW: ganztägig, schreibgeschützt, grün, eigener Kalender', () => {
    const f = feiertagsTermine('2026-10-01', '2026-11-02');
    expect(f.map(t => [t.start, t.ende, t.titel])).toEqual([['2026-10-03T00:00:00', '2026-10-04T00:00:00', 'Tag der Deutschen Einheit'], ['2026-11-01T00:00:00', '2026-11-02T00:00:00', 'Allerheiligen']]);
    expect(f.every(t => t.ganztags && !t.bearbeitbar && t.kalender === FEIERTAGE_KALENDER && istQuellTermin(t))).toBe(true);
    expect(istQuellTermin(termin({}))).toBe(false);
  });
  it('Geburtstage: Titel mit Alter, Klickziel, Space', () => {
    const g = geburtstagsTermine([{ id: 'crm-c-a-2026', name: 'Anna', tag: '2026-10-01', alter: 46, herkunft: 'crm', space: 'business', href: '/os/akte' }]);
    expect(g[0]).toMatchObject({ titel: '🎂 Anna (46)', href: '/os/akte', space: 'business', ganztags: true, quelle: 'geburtstag' });
  });
});

describe('Jahr (verdichtet, 12 Mini-Monate)', () => {
  const v = jahrVerdichten([
    { start: '2026-03-10T10:00:00', ende: '2026-03-10T11:00:00', ganztags: false, titel: 'A', kalender: 'Privat Kevin' },
    { start: '2026-03-10T12:00:00', ende: '2026-03-10T13:00:00', ganztags: false, titel: 'B', kalender: 'Privat Malin' },
    { start: '2026-07-20T00:00:00', ende: '2026-07-23T00:00:00', ganztags: true, titel: 'Urlaub', kalender: 'Gemeinsam' },
    { start: '2025-12-31T22:00:00', ende: '2026-01-01T01:00:00', ganztags: false, titel: 'Silvester', kalender: 'Gemeinsam' },
  ], 2026);
  it('jahrVerdichten: Zähler je Tag und Kalender, mehrtägige auf jedem Tag, nur das Jahr', () => {
    expect(v.tage['2026-03-10']).toEqual({ 'Privat Kevin': 1, 'Privat Malin': 1 });
    expect(Object.keys(v.tage).filter(t => t.startsWith('2026-07'))).toEqual(['2026-07-20', '2026-07-21', '2026-07-22']);
    expect(v.tage['2026-01-01']).toEqual({ Gemeinsam: 1 });
    expect(v.ganztags).toEqual([{ von: '2026-07-20', bis: '2026-07-22', titel: 'Urlaub', kalender: 'Gemeinsam' }]);
    expect(letzterTag({ start: '2026-01-01T10:00:00', ende: '2026-01-02T00:00:00', ganztags: false })).toBe('2026-01-01');
  });
  it('jahresTage: Sicht filtert (ausgeblendete Kalender zählen nicht), Feiertag und Geburtstag markiert', () => {
    const q = [...feiertagsTermine('2026-10-03', '2026-10-04'), ...geburtstagsTermine([{ id: 'x', name: 'Mama', tag: '2026-03-10', herkunft: 'familie', space: 'privat', href: '/os/menschen' }])];
    const t = jahresTage(v, q, k => k !== 'Privat Malin', () => '#fff');
    expect(t.get('2026-03-10')).toMatchObject({ termine: 1, geburtstage: ['Mama'] });
    expect(t.get('2026-10-03')?.feiertag).toBe('Tag der Deutschen Einheit');
    expect(t.get('2026-07-21')?.ganztags).toEqual(['Urlaub']);
  });
  it('rendert zwölf Monate, Tage als Knöpfe mit Hinweis', () => {
    const html = renderToStaticMarkup(h(Jahr, { jahr: 2026, heute: '2026-09-29', daten: v, quellen: feiertagsTermine('2026-01-01', '2027-01-01'), kalenderAn: () => true, farbe: () => '#4FC3F7', onTag: () => {} }));
    expect((html.match(/<section/g) ?? []).length).toBe(12);
    expect(html).toContain('aria-label="Oktober 2026"');
    expect(html).toContain('3. Oktober — Tag der Deutschen Einheit');
    expect(html).toContain('10. März — 2 Termine');
    expect((html.match(/<button/g) ?? []).length).toBe(365);
  });
});

describe('4 Tage', () => {
  it('Raster wie die Woche mit vier Spalten ab dem Tag', () => {
    expect(vierTageAb('2026-09-30')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
    const html = renderToStaticMarkup(h(VierTage, {
      start: '2026-09-30', heute: '2026-09-29', termine: [termin({ start: '2026-10-01T10:00:00', ende: '2026-10-01T11:00:00', titel: 'Kaffee mit Anna' }), ...feiertagsTermine('2026-09-30', '2026-10-04')],
      fristen: [], erinnerungen: [], aufgaben: [], farbe: () => '#4FC3F7', onOeffnen: () => {}, onNeu: () => {}, onVerschieben: () => {}, onAufgabe: () => {},
    }));
    expect(html).toContain('Kaffee mit Anna');
    expect(html).toContain('Tag der Deutschen Einheit'); // Ganztags-Zeile
    expect(html).toContain('#33B679'); // grün wie Google
    expect(html).not.toContain('Sa 4');
  });
});

describe('Zeit-Auswertung und Anlässe', () => {
  it('ausführliche Ansicht: Kennzahlen, je Tag, je Firma/Mandat, Kontakte-Platzhalter, Vorwochen', () => {
    const a = zeitAuswertung({ termine: [{ start: '2026-09-29T10:00:00', ende: '2026-09-29T12:00:00', ganztags: false, space: 'business' }], bloecke: [], arbeitszeit: { vonStunde: 9, bisStunde: 17 } }, '2026-09-29');
    const antwort: AuswertungAntwort = { ...a, quelle: 'icloud', namen: { einheiten: {}, mandate: {} } };
    const html = renderToStaticMarkup(h(AuswertungInhalt, { a: antwort }));
    expect(html).toContain('Meetings');
    expect(html).toContain('2 h');
    expect(html).toContain('Je Firma');
    expect(html).toContain('Erscheint, sobald Termine mit CRM-Kontakten verknüpft sind.');
    expect(html).toContain('KW 36');
    expect(html).toContain('KW 40');
  });
  it('Anlässe: Feiertag und Geburtstag „morgen“, nichts da → nichts', () => {
    expect(wannText('2026-09-30', '2026-09-29')).toBe('morgen');
    expect(wannText('2026-10-02', '2026-09-29')).toBe('Fr 2.10.');
    const html = renderToStaticMarkup(h(AnlaesseZeile, { heute: '2026-10-02', feiertage: [{ tag: '2026-10-03', name: 'Tag der Deutschen Einheit' }], geburtstage: [{ id: 'g', name: 'Malin', tag: '2026-10-03', alter: 34, herkunft: 'familie', space: 'privat', href: '/os/menschen' }] }));
    expect(html).toContain('morgen: Tag der Deutschen Einheit');
    expect(html).toContain('Malin hat morgen Geburtstag (wird 34)');
    expect(html).toContain('href="/os/menschen"');
    expect(renderToStaticMarkup(h(AnlaesseZeile, { heute: '2026-10-02', feiertage: [], geburtstage: [] }))).toBe('');
  });
});
