// ─── Mandanten überall klickbar (28.09.): Link-Bildung, Auflösen, Baustein ──
// Kevin: „Mach das ganze Thema mit Mandanten auch klickbar.“ Geprüft: Mandat vor
// Firma, gelöscht → Text, privat → nichts, kein CRM-Zugang → Text, Namensauflösung
// nur eindeutig, Liquiplan-Posten → Mandat, Kalender-Fristen direkt aufs Mandat —
// und der Baustein im Server-Render. Alles erfunden.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mandantZiel, mandateLink, markttraktion } from '../lib/crm/adresse';
import { WEG } from '../lib/wege';
import { mandantAusName, mandatAusPlanposten, mandantPruefung, mandantName, PLANPOSTEN_MANDAT } from '../lib/crm/mandant-link';
import { mandatKurzListe, type MandatKurz } from '../lib/planung/mandat';
import { fristen } from '../lib/kalender/eintraege';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));

const MANDATE: MandatKurz[] = mandatKurzListe({
  firmen: [{ id: 'f-nord', name: 'Nord GmbH' }, { id: 'f-sued', name: 'Süd AG' }, { id: 'f-west', name: 'West KG' }],
  mandate: [
    { id: 'm-nord', titel: 'Retainer', firmaId: 'f-nord', status: 'aktiv' },
    { id: 'm-sued-1', titel: 'Sprint', firmaId: 'f-sued', status: 'aktiv' },
    { id: 'm-sued-2', titel: 'Workshop', firmaId: 'f-sued', status: 'beendet', planpostenId: 'lp-eigen-7' },
    { id: 'm-west-1', titel: 'Alt 1', firmaId: 'f-west', status: 'beendet' },
    { id: 'm-west-2', titel: 'Alt 2', firmaId: 'f-west', status: 'beendet' },
    { id: 'm-doppelt-a', titel: 'A', kunde: 'Doppelt', status: 'beendet' },
    { id: 'm-doppelt-b', titel: 'B', kunde: 'Doppelt', status: 'beendet' },
  ],
});
const KARTE = new Map(MANDATE.map(m => [m.id, m]));
const GELADEN = { geladen: true, zugang: true, karte: KARTE };

describe('Mandant-Link: Mandat vor Firma, gelöscht, privat', () => {
  it('Mandat vor Firma — über dieselben Wege wie das CRM', () => {
    const z = mandantZiel({ mandatId: 'm-nord', firmaId: 'f-nord' });
    expect(z).toEqual({ art: 'mandat', href: mandateLink('mandate', 'm-nord') });
    expect(z.href).toBe(WEG.mandat('m-nord'));
    expect(mandantZiel({ firmaId: 'f-nord' })).toEqual({ art: 'firma', href: WEG.firma('f-nord'), mandatGeloescht: false });
    expect(WEG.firma('f-nord')).toBe(markttraktion('firmen', undefined, 'f-nord'));
  });

  it('Mandat gelöscht → Firmenakte (markiert); beides gelöscht → nur Text „(gelöscht)“', () => {
    expect(mandantZiel({ mandatId: 'm-weg', firmaId: 'f-nord', mandatDa: false })).toEqual({ art: 'firma', href: WEG.firma('f-nord'), mandatGeloescht: true });
    expect(mandantZiel({ mandatId: 'm-weg', mandatDa: false })).toEqual({ art: 'geloescht', href: null });
    expect(mandantZiel({ mandatId: 'm-weg', firmaId: 'f-weg', mandatDa: false, firmaDa: false })).toEqual({ art: 'geloescht', href: null });
    expect(mandantZiel({ firmaId: 'f-weg', firmaDa: false })).toEqual({ art: 'geloescht', href: null });
  });

  it('privat nie — auch mit Kennung; ohne CRM-Zugang nur Text; ohne Kennung Text', () => {
    expect(mandantZiel({ mandatId: 'm-nord', privat: true })).toEqual({ art: 'aus', href: null });
    expect(mandantZiel({ mandatId: 'm-nord', zugang: false })).toEqual({ art: 'text', href: null });
    expect(mandantZiel({})).toEqual({ art: 'text', href: null });
  });

  it('kaputte Kennungen werden nie zu einem Link', () => {
    expect(mandantZiel({ mandatId: '../boese?x=1' })).toEqual({ art: 'text', href: null });
    expect(mandantZiel({ mandatId: 'a b', firmaId: 'f-nord' }).href).toBe(WEG.firma('f-nord'));
  });
});

describe('Mandant-Link: was der Bestand weiß', () => {
  it('nicht geladen → vorläufig Link; geladen ohne Zugang → Text; Mandat da/weg; Firma da, wenn ein Mandat auf sie zeigt', () => {
    expect(mandantPruefung({ mandatId: 'm-nord' }, { geladen: false, zugang: false, karte: new Map() })).toEqual({});
    expect(mandantPruefung({ mandatId: 'm-nord' }, { geladen: true, zugang: false, karte: new Map() })).toEqual({ zugang: false });
    expect(mandantPruefung({ mandatId: 'm-nord', firmaId: 'f-nord' }, GELADEN)).toEqual({ zugang: true, mandatDa: true, firmaDa: true });
    expect(mandantPruefung({ mandatId: 'm-weg', firmaId: 'f-unbekannt' }, GELADEN)).toEqual({ zugang: true, mandatDa: false });
  });

  it('Name aus dem Bestand, wenn die Stelle keinen hat', () => {
    expect(mandantName({ mandatId: 'm-nord' }, KARTE)).toBe('Nord GmbH · Retainer');
    expect(mandantName({ firmaId: 'f-sued' }, KARTE)).toBe('Süd AG');
    expect(mandantName({ mandatId: 'm-weg' }, KARTE)).toBeUndefined();
  });
});

describe('Mandant-Link: Auflösen ohne Kennung', () => {
  it('Text-Kunde nur bei eindeutigem Treffer (Schreibweise egal), sonst Text', () => {
    expect(mandantAusName('  nord   gmbh ', MANDATE)).toEqual({ mandatId: 'm-nord', firmaId: 'f-nord' });
    // Zwei Mandate, eins aktiv → das aktive.
    expect(mandantAusName('Süd AG', MANDATE)).toEqual({ mandatId: 'm-sued-1', firmaId: 'f-sued' });
    // Zwei beendete bei derselben Firma → die Firma.
    expect(mandantAusName('West KG', MANDATE)).toEqual({ firmaId: 'f-west' });
    // Zwei ohne Firma → mehrdeutig.
    expect(mandantAusName('Doppelt', MANDATE)).toBeNull();
    expect(mandantAusName('Nord', MANDATE)).toBeNull();
    expect(mandantAusName('', MANDATE)).toBeNull();
  });

  it('Liquiplan-Posten → Mandat: von Hand verknüpft oder lp-mandat-<id>', () => {
    expect(mandatAusPlanposten('lp-eigen-7', MANDATE)).toBe('m-sued-2');
    expect(mandatAusPlanposten(`${PLANPOSTEN_MANDAT}m-nord`, MANDATE)).toBe('m-nord');
    expect(mandatAusPlanposten(PLANPOSTEN_MANDAT, MANDATE)).toBeNull();
    expect(mandatAusPlanposten('lp-miete', MANDATE)).toBeNull();
    expect(mandatAusPlanposten(undefined, MANDATE)).toBeNull();
  });
});

describe('Kalender: Mandatsfristen führen direkt ins Mandat', () => {
  it('Ende, Kündigungsfrist und Review verlinken WEG.mandat(id)', () => {
    const f = fristen({ mandate: [{ id: 'm-nord', kunde: 'Nord GmbH', status: 'aktiv', ende: '2026-12-31', kuendigungsfristTage: 90, naechstesReview: '2026-10-01' }] }, '2026-09-28', '2027-01-15');
    expect(f.filter(x => x.art === 'mandat').map(x => x.href)).toEqual([WEG.mandat('m-nord'), WEG.mandat('m-nord'), WEG.mandat('m-nord')]);
  });
});

describe('MandantLink (Server-Render)', () => {
  it('Ansicht: Mandat als Link mit Punkt, Firma mit 🏢, gelöscht als Text, privat leer', async () => {
    const { MandantLinkAnsicht } = await import('@/components/os/crm/MandantLink');
    const mandat = renderToStaticMarkup(h(MandantLinkAnsicht, { ziel: mandantZiel({ mandatId: 'm-nord' }), name: 'Nord GmbH · Retainer' }));
    expect(mandat).toContain(`href="${WEG.mandat('m-nord').replace(/&/g, '&amp;')}"`);
    expect(mandat).toContain('data-mandant="mandat"');
    expect(mandat).toContain('Nord GmbH · Retainer');
    const firma = renderToStaticMarkup(h(MandantLinkAnsicht, { ziel: mandantZiel({ mandatId: 'm-weg', firmaId: 'f-nord', mandatDa: false }), name: 'Nord GmbH' }));
    expect(firma).toContain(`href="${WEG.firma('f-nord').replace(/&/g, '&amp;')}"`);
    expect(firma).toContain('🏢');
    expect(firma).toContain('Mandat gelöscht');
    const weg = renderToStaticMarkup(h(MandantLinkAnsicht, { ziel: mandantZiel({ mandatId: 'm-weg', mandatDa: false }), name: 'Mandat' }));
    expect(weg).not.toContain('href');
    expect(weg).toContain('Mandat (gelöscht)');
    expect(renderToStaticMarkup(h(MandantLinkAnsicht, { ziel: mandantZiel({ mandatId: 'm-nord', privat: true }), name: 'x' }))).toBe('');
    // Eigener Inhalt („›“ am Chip) erscheint nur als Link.
    expect(renderToStaticMarkup(h(MandantLinkAnsicht, { ziel: mandantZiel({ mandatId: 'm-weg', mandatDa: false }), name: 'x' }, '›'))).toBe('');
    expect(renderToStaticMarkup(h(MandantLinkAnsicht, { ziel: mandantZiel({ mandatId: 'm-nord' }), name: 'x', klein: true }))).not.toContain('border-radius:50%');
  });

  it('Baustein: vor dem Abruf vorläufig Link, privat nichts, Stelle kann „gelöscht“ selbst sagen', async () => {
    const { MandantLink } = await import('@/components/os/crm/MandantLink');
    expect(renderToStaticMarkup(h(MandantLink, { mandatId: 'm-nord', name: 'Nord GmbH' }))).toContain('data-mandant="mandat"');
    expect(renderToStaticMarkup(h(MandantLink, { mandatId: 'm-nord', firmaId: 'f-nord', name: 'Nord GmbH', privat: true }))).toBe('');
    const tot = renderToStaticMarkup(h(MandantLink, { mandatId: 'm-weg', mandatDa: false, name: 'Mandat' }));
    expect(tot).toContain('Mandat (gelöscht)');
    expect(tot).not.toContain('href');
    // Nur Text-Kunde ohne geladenen Bestand bleibt Text.
    expect(renderToStaticMarkup(h(MandantLink, { name: 'Nord GmbH', nachName: true }))).toBe('<span>Nord GmbH</span>');
  });
});
