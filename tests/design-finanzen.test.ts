// ─── Design-Standard · Zahlen & Finanzen (03.10., DESIGN_STANDARD.md) ───────
// Der Bereich „Zahlen“ (Zahlen privat/business/steuern/gesamt, Head of Finance, Liquidität, Buchungen, Rechnungen, Controlling, Grundlage und die
// Finanzplanung jetzt) hängt an den gemeinsamen Bausteinen aus components/os/ui. Der Test hält fest, was umgestellt wurde — und dass nichts zurückfällt.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { FARBE, LEUCHT } from '@/lib/make-one/design';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzen' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

/** Alle Dateien des Bereichs Zahlen & Finanzen. */
const ORDNER = ['components/os/finanzplan', 'components/os/haushalt', 'components/os/steuern', 'components/os/business', 'components/os/kennzahlen', 'components/os/privat'];
const EINZELN = ['ZahlenView', 'FinanzenView', 'FinanzchefView', 'FinanzDashboardView', 'FinanzplanungView', 'LiquiditaetView', 'ControllingView', 'BuchungenView', 'GrundlageView', 'HaushaltZuordnung'].map(n => `components/os/${n}.tsx`);
const ALLE = [...ORDNER.flatMap(d => dateien(d)), ...EINZELN];

describe('Zahlen & Finanzen hängen am Standard', () => {
  it('der Bereich hat die erwarteten 51 Dateien', () => {
    expect(ALLE.length).toBeGreaterThanOrEqual(51);
  });

  it('keine Datei holt Bausteine mehr aus schlank.tsx (alles über ../ui)', () => {
    const direkt = ALLE.filter(f => /from '(\.\.\/|\.\/)schlank'/.test(lies(f)));
    expect(direkt).toEqual([]);
  });

  it('Fließtext steht nicht unter 13 px — kleinere Schrift nur als Beschriftung in Großbuchstaben', () => {
    const funde: string[] = [];
    for (const f of ALLE) {
      lies(f).split('\n').forEach((z, i) => {
        if (/fontSize: (10|10\.5|11|11\.5|12|12\.5)(?![\d.])/.test(z) && !/uppercase|MIKRO/.test(z)) funde.push(`${f}:${i + 1}`);
      });
    }
    expect(funde).toEqual([]);
  });

  it('Seitenkopf über den Baustein `Seite` (kein eigenes h1)', () => {
    const eigen = ALLE.filter(f => /<h1[ >]/.test(lies(f)));
    expect(eigen).toEqual([]);
  });

  it('Eingaben und Knöpfe der Finanzplanung kommen aus dem Standard (feld, Knopf, Pillen)', () => {
    const t = lies('components/os/finanzplan/teile.tsx');
    expect(t).toMatch(/from '\.\.\/ui'/);
    expect(t).toContain('<Knopf ');
    expect(t).toContain('UiPillen');
    expect(t).toContain('ui-tabelle');
  });
});

describe('Bausteine der Finanzplanung (teile.tsx)', () => {
  it('Tabelle: eigener wischbarer Container mit Rolle region, Zahlen mit festen Ziffern', async () => {
    const { Tabelle } = await import('@/components/os/finanzplan/teile');
    const html = renderToStaticMarkup(h(Tabelle, null, h('tbody', null, h('tr', null, h('td', null, '1.234')))));
    expect(html).toContain('class="ui-tabelle"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabular-nums');
  });

  it('Chips (Etikett, StatusPille) sind Anzeige-Pillen des Standards', async () => {
    const { Etikett, StatusPille } = await import('@/components/os/finanzplan/teile');
    expect(renderToStaticMarkup(h(Etikett, { einheit: 'privat' }))).toContain('ui-chip');
    const s = renderToStaticMarkup(h(StatusPille, { status: 'verfehlt' }));
    expect(s).toContain('ui-chip');
    expect(s).toContain(LEUCHT.kritisch);
  });

  it('KnopfKlein ist der Standard-Knopf (ui-knopf, 40/44 px)', async () => {
    const { KnopfKlein } = await import('@/components/os/finanzplan/teile');
    expect(renderToStaticMarkup(h(KnopfKlein, { onClick: () => {}, children: 'Los' }))).toContain('ui-knopf');
  });

  it('Hinweis: Notiz in Fließtext — mit Zustandsfarbe eine Hinweis-Karte', async () => {
    const { Hinweis } = await import('@/components/os/finanzplan/teile');
    expect(renderToStaticMarkup(h(Hinweis, null, 'Eine Erklärung.'))).not.toContain('ui-hinweis');
    const k = renderToStaticMarkup(h(Hinweis, { farbe: LEUCHT.kritisch }, 'Das passt nicht.'));
    expect(k).toContain('ui-hinweis');
    expect(k).toContain('role="alert"');
  });

  it('Kachel: flache Fläche des Standards, Zahl mit festen Ziffern, nicht umbrechend', async () => {
    const { Kachel } = await import('@/components/os/finanzplan/teile');
    const html = renderToStaticMarkup(h(Kachel, { label: 'Frei verfügbar', wert: '59.570 €', unter: 'Stand heute' }));
    expect(html).toContain('59.570 €');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('rgba(255,255,255,.04)');
  });

  it('Eingabestil: Rechner 40 px, Schrift 13 px (am Handy erzwingt .ui-seite 44 px und 16 px)', async () => {
    const { eingabeStil } = await import('@/components/os/finanzplan/teile');
    expect(eingabeStil.minHeight).toBe(40);
    expect(eingabeStil.fontSize).toBe(13);
  });
});

describe('Handy-Regeln', () => {
  it('Tabellen-Container und Reiter-Zähler stehen in globals.css', () => {
    const css = lies('app/globals.css');
    expect(css).toContain('.ui-tabelle { overflow-x: auto');
    expect(css).toContain('.fp-zaehler');
  });

  it('Kopf der Finanzplanung: Aktionen als Standard-Knöpfe mit Text nur am Rechner (ui-nur-breit)', () => {
    const f = lies('components/os/finanzplan/Finanzplan.tsx');
    expect(f).toContain('ui-nur-breit');
    // 08.10. (Aufräumen Etappe 2): die Blätter stehen in EINER Pillenreihe (Ebene 2 unter dem Reiter „Planung“).
    expect(f).toContain('<nav aria-label="Blätter der Finanzplanung">');
    expect(f).toContain('<Pillen einzeilig');
    expect(f).not.toContain('<Reiter ');
    expect(f).toContain('ariaLabel="Letzte Änderung rückgängig"');
  });

  it('Finanzen: eine wischbare Reiterleiste je Bereich statt Segment-Umschalter im Kopf', () => {
    const f = lies('components/os/FinanzenView.tsx');
    expect(f).toContain("<Reiter ariaLabel={bereich === 'privat' ? 'Finanzen Privat' : 'Finanzen Business'}");
    expect(f).not.toContain('<Segmente');
  });
});

describe('Farben bleiben Zustand', () => {
  it('Zustandsfarben sind unverändert grün, gelb, rot', () => {
    expect([FARBE.gut, FARBE.achtung, FARBE.kritisch]).toEqual([LEUCHT.gut, LEUCHT.achtung, LEUCHT.kritisch]);
  });
});
