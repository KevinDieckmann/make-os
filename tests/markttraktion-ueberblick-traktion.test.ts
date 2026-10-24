// ─── Markttraktion › Überblick: der Traktions-Index als kompakte Kennzahl (24.10., Kevin) ──────────────────────────────────────────────────
// Kevin 24.10.: Der Traktions-Index steht seit dem Hub-Umbau nur in der Auswertung — er soll AUCH oben im Überblick stehen, kompakt (Ring/Zahl
// mit Ampel, „vorläufig“, wenn Welten fehlen), ein Klick führt in die Auswertung. Geprüft wird: dieselbe Quelle (die Antwort von
// /api/crm/traktion = `traktionsIndex` + `alsTraktion`, keine zweite Rechnung), der Link nur über `WEG.auswertung()`, „vorläufig“ bei fehlenden
// Welten, der Leerzustand ohne Daten (nie eine erfundene Null) und die Stelle im Überblick (ERSTE Kachel, die Details bleiben in der Auswertung).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand, PowerHourSitzung } from '@/lib/crm/typen';
import { leererBestand } from '@/lib/crm/speicher';
import { traktionsIndex, alsTraktion } from '@/lib/crm/traktion-index';
import { auswertungLink, hubOrtFuer, PFAD } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

const HEUTE = '2026-09-25';
const J = `${HEUTE}T10:00:00.000Z`;
const tag = (i: number) => { const d = new Date(`${HEUTE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const gespraech = (i: number) => ({ am: `${tag(i)}T09:00:00.000Z`, art: 'gespraech' as const, von: 'kevin' as const, text: `Gespräch vor ${i} Tagen` });
const chance = (id: string): Chance => ({
  id: `ch-${id}`, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'ug', besitzer: 'kevin', angelegt: J, geaendert: HEUTE,
} as Chance);
const sitzung = (i: number): PowerHourSitzung => ({ id: `ph-${i}`, person: 'kevin', datum: tag(i), start: `${tag(i)}T08:00:00.000Z`, ziel: { gespraeche: 5, termine: 1 }, karten: [] });
const crm = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });

// Antwort wie /api/crm/traktion sie für den Überblick liefert: `index` und `traktion` aus denselben Funktionen.
function antwort(kontakte: Kontakt[], bestand: CrmBestand) {
  const index = traktionsIndex({ kontakte, crm: bestand, heute: HEUTE });
  return { index, traktion: alsTraktion(index) };
}
async function rendere(d: ReturnType<typeof antwort>): Promise<string> {
  const { TraktionKurz } = await import('@/components/os/crm/Ueberblick');
  return renderToStaticMarkup(createElement(TraktionKurz, { d }));
}

const mitSales = [k('anna', { aktivitaeten: [gespraech(1), gespraech(3)] }), k('ben', { aktivitaeten: [gespraech(2), gespraech(5)] }), k('cara', { aktivitaeten: [gespraech(0), gespraech(6)] })];
const salesBestand = crm({ sitzungen: [sitzung(0), sitzung(2), sitzung(4), sitzung(6)], chancen: [chance('a'), chance('b')] });

describe('Überblick · Traktions-Index kompakt', () => {
  it('zeigt dieselbe Zahl wie der Index (Ring + Status), mit Weg in die Auswertung', async () => {
    const d = antwort(mitSales, salesBestand);
    const html = await rendere(d);
    expect(d.index.index, 'Fixture rechnet einen Wert').not.toBeNull();
    expect(html).toContain(`>${d.index.index}<`);
    expect(html).toContain(`>${d.index.label}<`);
    // Ring UND Textlink führen über WEG.auswertung() in die Auswertung — derselbe Pfad wie der Hub-Punkt „Auswertung“.
    expect(WEG.auswertung()).toBe(auswertungLink());
    const ziel = WEG.auswertung().replace(/&/g, '&amp;');
    expect((html.match(new RegExp(`href="${ziel.replace(/[?]/g, '\\?')}"`, 'g')) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Auswertung öffnen');
    expect(hubOrtFuer(PFAD, `?${WEG.auswertung().split('?')[1]}`)).toBe('auswertung');
  });

  it('„vorläufig“, wenn Welten noch ohne Messung sind — mit den Werten der Welten, ohne Welt-Wert ein Strich', async () => {
    const d = antwort(mitSales, salesBestand);
    expect(d.traktion.vorlaeufig, 'Event misst nicht, Sales/Marketing schon').toBe(true);
    const html = await rendere(d);
    expect(html).toContain('vorläufig');
    for (const w of d.traktion.welten) expect(html).toContain(`${w.label} ${w.score ?? '—'}`);
    expect(html).toContain(d.traktion.hinweis);
  });

  it('ohne Daten: Leerzustand mit dem Status des Index, keine erfundene Null und kein „vorläufig“ aus dem Nichts', async () => {
    const d = antwort([], crm());
    expect(d.index.index).toBeNull();
    const html = await rendere(d);
    expect(html).toContain('Noch keine Daten');
    expect(html).not.toMatch(/>0</);
    expect(html).not.toContain('vorläufig');
    expect(html).toContain('Auswertung öffnen');
  });

  it('im Überblick als ERSTE Kachel, Daten nur aus useTraktion; der volle Index bleibt in der Auswertung', () => {
    const u = lies('components/os/crm/Ueberblick.tsx');
    const kurz = u.indexOf('<Kachel id="traktion-kurz"');
    expect(kurz).toBeGreaterThan(-1);
    expect(kurz).toBeLessThan(u.indexOf('<Kachel id="fuer-dich"'));
    expect(u).toContain('<TraktionKurz d={d} />');
    // Keine zweite Rechnung und keine zweite Abfrage: nur die Antwort von useTraktion; der Link nie als Pfad von Hand.
    const komponente = u.slice(u.indexOf('export function TraktionKurz'), u.indexOf('export function TraktionsIndex'));
    expect(komponente).toContain('WEG.auswertung()');
    expect(komponente).not.toMatch(/fetch\(|traktionsIndex\(|alsTraktion\(|\/os\/markttraktion/);
    const a = lies('components/os/crm/Auswertung.tsx');
    expect(a).toContain('<TraktionsIndex');
    expect(a).not.toContain('TraktionKurz');
  });
});
