// ─── Leiste (28.09.): „Problem oder Idee melden“ unten links ────────────────
// Der Eintrag steht zwischen Brain und System (Desktop); am Handy (seit 02.10., Paket B) hat in der Leiste „Netzwerken“
// (Handschlag) seinen Platz übernommen — „Problem oder Idee melden“ bleibt dort als Zeile im Blatt von Privat/Business
// (MeldenZeile) und auf der System-Seite erreichbar. Ein Klick löst `make-idee` aus — das Fenster IdeeErfassen im
// /os-Layout lauscht darauf. Kein Browser: Server-Render + der Klick-Griff direkt.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));

afterEach(() => { vi.unstubAllGlobals(); });

describe('Leiste: Problem oder Idee melden', () => {
  it('steht in der Desktop-Leiste zwischen Brain und System; die Handy-Leiste zeigt Netzwerken statt Melden', async () => {
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
    // Handy: Netzwerken (Handschlag) → /os/netzwerken, „Melden“ steht nicht mehr in der Leiste.
    expect(mobil).toContain('href="/os/netzwerken"');
    expect(mobil).toContain('>Netzwerken</span>');
    expect(mobil).not.toContain('>Melden</span>');
    expect(mobil).toContain('lucide-handshake');
    // Am Rechner steht Netzwerken NICHT (Kevin 03.10.: „wirklich nur auf dem Handy“).
    expect(desktop).not.toContain('href="/os/netzwerken"');
    // Reihenfolge am Handy: Home · Privat · Business · ZOE · Netzwerken · System
    const reihe = ['>Home<', '>Privat<', '>Business<', '>ZOE<', '>Netzwerken<', '>System<'].map(t => mobil.indexOf(t));
    expect(reihe.every(i => i > -1)).toBe(true);
    expect([...reihe].sort((a, b) => a - b)).toEqual(reihe);
  });

  it('Melden bleibt am Handy erreichbar: Zeile im Blatt (≥ 44 px) löst make-idee aus und schließt das Blatt; auch auf der System-Seite', async () => {
    const { MeldenZeile, MELDEN_LABEL } = await import('@/components/os/Leiste');
    let zu = 0;
    const fenster = new EventTarget();
    vi.stubGlobal('window', fenster);
    let geoeffnet = 0;
    fenster.addEventListener('make-idee', () => { geoeffnet += 1; });
    const zeile = MeldenZeile({ onWeg: () => { zu += 1; } }) as ReactElement<{ onClick: () => void; style: { minHeight: number }; 'aria-label': string }>;
    expect(zeile.props['aria-label']).toBe(MELDEN_LABEL);
    expect(zeile.props.style.minHeight).toBeGreaterThanOrEqual(44);
    zeile.props.onClick();
    expect([zu, geoeffnet]).toEqual([1, 1]);
    const { SystemView } = await import('@/components/os/SystemView');
    const html = renderToStaticMarkup(h(SystemView));
    expect(html).toContain(MELDEN_LABEL);
    expect(html).not.toContain('href="/os/netzwerken"');
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
