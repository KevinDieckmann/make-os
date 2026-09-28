// ─── Glocke (28.09. abends): zeichnet ohne Fehler (Server-Render, erfundene Daten) ──
// Kein Browser, kein Netz: die Glocke im Grundzustand und die Liste mit allen Arten.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MeldungenSicht } from '@/lib/meldungen/regeln';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/heute' }));

const J = Date.parse('2026-09-28T12:00:00Z');
const sicht: MeldungenSicht = {
  heute: '2026-09-28', ungelesen: 5, einstellungen: { telegram: false },
  meldungen: [
    { id: 'm1', art: 'zuweisung', titel: 'Kevin hat dir „Belege Januar“ zugewiesen', link: '/os/aufgaben?offen=t-1', am: '2026-09-28T11:55:00Z', gelesen: false, von: 'kevin', bezug: { art: 'aufgabe', id: 't-1' } },
    { id: 'm2', art: 'erwaehnung', titel: 'Kevin hat dich in „Steuer“ erwähnt', link: '/os/aufgaben?offen=t-2', am: '2026-09-28T09:00:00Z', gelesen: false },
    { id: 'ueberfaellig:2026-09-28:t-3', art: 'ueberfaellig', titel: '„Miete“ ist überfällig — fällig seit 25.09.', link: '/os/aufgaben?offen=t-3', am: '2026-09-27T22:00:00Z', gelesen: false, virtuell: true },
    { id: 'faellig:2026-09-28:t-4', art: 'faellig', titel: '„Einkauf“ ist heute fällig', link: '/os/aufgaben?offen=t-4', am: '2026-09-27T22:00:00Z', gelesen: false, virtuell: true },
    { id: 'm3', art: 'kommentar', titel: 'Neuer Kommentar', link: '/os/aufgaben?offen=t-5', am: '2026-09-20T09:00:00Z', gelesen: true },
    { id: 'sammel-1-1', art: 'sammel', anzahl: 1, titel: '+1 weitere Meldungen', link: '/os/aufgaben', am: '2026-09-01T09:00:00Z', gelesen: false },
  ],
};

describe('Glocke zeichnet', () => {
  it('Grundzustand im Kopf: Knopf „Meldungen“, noch ohne Zahl, kein Panel', async () => {
    const { Glocke } = await import('@/components/os/Glocke');
    const html = renderToStaticMarkup(h(Glocke));
    expect(html).toContain('aria-label="Meldungen"');
    expect(html).toContain('>Meldungen<');
    expect(html).not.toContain('role="dialog"');
  });
  it('Liste: alle Arten, Zeiten, ungelesen markiert, „Alle gelesen“, Telegram-Schalter aus', async () => {
    const { GlockeListe } = await import('@/components/os/Glocke');
    const html = renderToStaticMarkup(h(GlockeListe, { sicht, jetzt: J, oeffnen: () => {}, alleGelesen: () => {}, telegram: () => {} }));
    for (const art of ['zuweisung', 'erwaehnung', 'ueberfaellig', 'faellig', 'kommentar', 'sammel']) expect(html).toContain(`data-meldung="${art}"`);
    expect(html).toContain('Meldungen · 5 neu');
    expect(html).toContain('Alle gelesen');
    expect(html).toContain('vor 5 Min');
    expect(html).toContain('Überfällig · überfällig');
    expect(html).toContain('Fällig · heute');
    expect(html).toContain('href="/os/aufgaben?offen=t-1"');
    expect(html.match(/aria-label="ungelesen"/g)).toHaveLength(5);
    expect(html).toContain('Auch per Telegram');
    expect(html).not.toMatch(/checked=""/);
  });
  it('leer: „Keine Meldungen.“', async () => {
    const { GlockeListe } = await import('@/components/os/Glocke');
    const html = renderToStaticMarkup(h(GlockeListe, { sicht: { ...sicht, meldungen: [], ungelesen: 0 }, jetzt: J, oeffnen: () => {}, alleGelesen: () => {}, telegram: () => {} }));
    expect(html).toContain('Keine Meldungen.');
    expect(html).toContain('disabled=""');
  });
});
