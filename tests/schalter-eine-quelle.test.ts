// ─── EIN Schalter (Review 03.10., Wächter) ──────────────────────────────────
// Vorher: zwei `Schalter` (ui: `onChange: () => void`, Finanzplanung: `onChange(v: boolean)` + Beschriftung) und vier
// handgebaute `role="switch"` (CRM-Einwilligung, Aktivitäten-Filter, Netzwerken × 2). Jetzt gibt es genau einen —
// components/os/ui › Schalter: `onChange(v)` bekommt den NEUEN Zustand, Beschriftung optional, ohne Beschriftung ist
// `ariaLabel` Pflicht (der Typ erzwingt es), `karte` für ganze Entscheidungszeilen.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Schalter, type SchalterProps } from '@/components/os/ui/knoepfe';

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}
const zeichne = (p: SchalterProps) => renderToStaticMarkup(createElement(Schalter, p));

describe('EIN Schalter', () => {
  it('kein `role="switch"` außerhalb von components/os/ui', () => {
    const fremd = [...dateien('components'), ...dateien('app')]
      .filter(f => !f.startsWith('components/os/ui/'))
      .filter(f => /role=["{']+switch|role:\s*['"]switch/.test(lies(f)));
    expect(fremd).toEqual([]);
  });

  it('keine zweite Schalter-Funktion — die Finanzplanung reicht den Standard nur durch', () => {
    const eigene = [...dateien('components'), ...dateien('app')].filter(f => /export function Schalter\b|const Schalter\s*=/.test(lies(f)));
    expect(eigene).toEqual(['components/os/ui/knoepfe.tsx']);
    expect(lies('components/os/finanzplan/teile.tsx')).toMatch(/export \{ Schalter \};/);
  });

  it('ohne Beschriftung ist ariaLabel Pflicht — der Typ erzwingt es', () => {
    // @ts-expect-error — weder Beschriftung noch ariaLabel
    const ohne: SchalterProps = { an: true, onChange: () => {} };
    const mitLabel: SchalterProps = { an: true, onChange: () => {}, ariaLabel: 'Routine aktiv' };
    const mitText: SchalterProps = { an: false, onChange: () => {}, children: 'nur offene' };
    expect([ohne, mitLabel, mitText]).toHaveLength(3);
  });

  it('die drei Formen: Rolle switch, aria-checked, Name, 44 px Tippfläche', () => {
    const blank = zeichne({ an: true, onChange: () => {}, ariaLabel: 'Baustein rechnet mit' });
    expect(blank).toContain('role="switch"');
    expect(blank).toContain('aria-checked="true"');
    expect(blank).toContain('aria-label="Baustein rechnet mit"');
    expect(blank).toContain('height:44px');
    const text = zeichne({ an: false, onChange: () => {}, children: 'Systemereignisse zeigen' });
    expect(text).toContain('aria-checked="false"');
    expect(text).toContain('Systemereignisse zeigen');
    expect(text).toContain('min-height:44px');
    const karte = zeichne({ an: true, onChange: () => {}, karte: true, children: 'Wir haben persönlich gesprochen', beschreibung: 'Danke-Entwurf ab morgen.', testId: 'gespraech-schalter', aus: true });
    expect(karte).toContain('data-testid="gespraech-schalter"');
    expect(karte).toContain('Danke-Entwurf ab morgen.');
    expect(karte).toContain('disabled=""');
  });

  it('onChange bekommt den neuen Zustand', () => {
    let gesetzt: boolean | null = null;
    const el = Schalter({ an: false, onChange: v => { gesetzt = v; }, ariaLabel: 'x' }) as unknown as { props: { onClick: () => void } };
    el.props.onClick();
    expect(gesetzt).toBe(true);
  });
});
