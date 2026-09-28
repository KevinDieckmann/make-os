// ─── Leiste (28.09.): „Problem oder Idee melden“ unten links ────────────────
// Der Eintrag steht zwischen Brain und System (Desktop) und in der Handy-Leiste,
// und ein Klick löst `make-idee` aus — das Fenster IdeeErfassen im /os-Layout
// lauscht darauf. Kein Browser: Server-Render + der Klick-Griff direkt.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));

afterEach(() => { vi.unstubAllGlobals(); });

describe('Leiste: Problem oder Idee melden', () => {
  it('steht in der Desktop-Leiste zwischen Brain und System und in der Handy-Leiste', async () => {
    const { Leiste, MELDEN_LABEL } = await import('@/components/os/Leiste');
    expect(MELDEN_LABEL).toBe('Problem oder Idee melden');
    const html = renderToStaticMarkup(h(Leiste));
    const [desktop, mobil] = html.split('class="leiste-mobil"');
    expect(mobil).toBeDefined();
    const brain = desktop.indexOf('title="Brain"');
    const melden = desktop.indexOf(`title="${MELDEN_LABEL}"`);
    const system = desktop.indexOf('title="System"');
    expect(brain).toBeGreaterThan(-1);
    expect(melden).toBeGreaterThan(brain);
    expect(system).toBeGreaterThan(melden);
    expect(desktop).toContain(`>${MELDEN_LABEL}</span>`);
    expect(mobil).toContain(`aria-label="${MELDEN_LABEL}"`);
    expect(mobil).toContain('>Melden</span>');
  });

  it('ein Klick löst make-idee aus — auch eingeklappt (nur Symbol, Name im Tooltip)', async () => {
    const { MeldenKnopf, MELDEN_LABEL } = await import('@/components/os/Leiste');
    const { IDEE_OEFFNEN } = await import('@/components/os/bauplan/IdeeErfassen');
    expect(IDEE_OEFFNEN).toBe('make-idee');
    const fenster = new EventTarget();
    vi.stubGlobal('window', fenster);
    let geoeffnet = 0;
    fenster.addEventListener('make-idee', () => { geoeffnet += 1; });
    const knopf = MeldenKnopf({ zu: true, stil: {} }) as ReactElement<{ onClick: () => void; title: string; type: string }>;
    expect(knopf.props.type).toBe('button');
    expect(knopf.props.title).toBe(MELDEN_LABEL);
    knopf.props.onClick();
    expect(geoeffnet).toBe(1);
    const eingeklappt = renderToStaticMarkup(knopf);
    expect(eingeklappt).not.toContain('<span');
  });
});
