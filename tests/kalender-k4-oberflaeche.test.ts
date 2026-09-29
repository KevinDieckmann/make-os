// ─── K4 (29.09.): Oberfläche „Mit … planen“, Freie Zeiten, Buchungsseiten, öffentliche Seite — Render ohne Browser ─
// Serverseitig gerendert (keine Effekte): die Bauteile rendern ohne Fehler, zeigen nur Zeiten, und die Überlagerung ist rein.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KTermin } from '@/components/os/kalender/teile';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/kalender' }));

const T = (x: Partial<KTermin>): KTermin => ({ id: 'u-1', uid: 'u-1', titel: 'Zahnarzt', start: '2026-10-05T10:00:00', ende: '2026-10-05T11:00:00', ganztags: false, kalender: 'Malin-Kalender', wer: 'malin', serie: false, mitTeilnehmern: false, bearbeitbar: true, ...x });

describe('Mit … planen', () => {
  it('gedimmt mischt eine Farbe mit dem Grund (6-stellig bleibt 6-stellig)', async () => {
    const { gedimmt } = await import('@/components/os/kalender/MitPlanen');
    expect(gedimmt('#ffffff', 1)).toBe('#ffffff');
    expect(gedimmt('#ffffff', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(gedimmt('rot')).toBe('rot');
  });

  it('die Karten rendern; ohne Wahl bleibt das Raster unverändert', async () => {
    const { useTermineFinden } = await import('@/components/os/kalender/MitPlanen');
    let raster: KTermin[] = [];
    function Probe() {
      const k4 = useTermineFinden({ alle: [T({}), T({ id: 'u-2', uid: 'u-2', titel: 'Belegt', maskiert: true } as Partial<KTermin>)], onVorschlag: () => {} });
      raster = k4.raster([T({ id: 'k-1', uid: 'k-1', wer: 'kevin', titel: 'Eigen' })]);
      return h('div', null, k4.karten);
    }
    const html = renderToStaticMarkup(h(Probe));
    expect(html).toContain('Mit … planen');
    expect(html).toContain('Buchungsseiten');
    expect(raster.map(t => t.titel)).toEqual(['Eigen']);
  });
});

describe('Freie Zeiten', () => {
  it('zeigt nur Uhrzeiten, gruppiert nach Tag, und Feiertage als Hinweis', async () => {
    const { FreieZeiten } = await import('@/components/os/kalender/FreieZeiten');
    const html = renderToStaticMarkup(h(FreieZeiten, { vorschlaege: [{ start: '2026-10-05T09:00:00', ende: '2026-10-05T09:30:00', tag: '2026-10-05' }, { start: '2026-10-05T10:00:00', ende: '2026-10-05T10:30:00', tag: '2026-10-05' }], feiertage: { '2026-10-03': 'Tag der Deutschen Einheit' }, onWahl: () => {} }));
    expect(html).toContain('09:00');
    expect(html).toContain('10:00');
    expect(html).toContain('Mo 05.10.');
    expect(html).toContain('Tag der Deutschen Einheit');
    const leer = renderToStaticMarkup(h(FreieZeiten, { vorschlaege: [], onWahl: () => {} }));
    expect(leer).toContain('Keine gemeinsame Lücke');
  });
});

describe('Öffentliche Seite', () => {
  it('Buchen und Status rendern ohne Daten (Laden) ohne Fehler', async () => {
    const { Buchen } = await import('@/components/buchen/Buchen');
    const { BuchungStatus } = await import('@/components/buchen/BuchungStatus');
    expect(renderToStaticMarkup(h(Buchen, { slug: 'test-0123456789abcdef01234567' }))).toContain('Freie Zeiten werden geladen');
    expect(renderToStaticMarkup(h(BuchungStatus, { slug: 'test-0123456789abcdef01234567' }))).toContain('Ihre Terminanfrage');
  });
});
