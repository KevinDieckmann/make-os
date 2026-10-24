// ─── Feinschliff 1 (23.10.) · Punkte 8, 9 — „Marken & Versicherungen“; das Menü „Unternehmen“ blitzt für ein Konto „nur Business“ nicht auf ─────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DIMENSIONEN } from '@/lib/gesellschaften/schild/blick';
import { LAGE_REITER } from '@/lib/gesellschaften/schild/adresse';
import { KontoVorab, useNurBusiness } from '@/components/os/useInhaber';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('8 · Unternehmen: „Marken & Versicherungen“ statt „Schutz“ (Kennung bleibt)', () => {
  it('Teil im Überblick heißt wie der Reiter; Seitenkopf und Check ohne „Schutz“', () => {
    expect(DIMENSIONEN.find(x => x.id === 'schutz')?.label).toBe(LAGE_REITER.find(x => x.id === 'schutz')?.label);
    expect(DIMENSIONEN.find(x => x.id === 'schutz')?.label).toBe('Marken & Versicherungen');
    expect(lies('components/os/unternehmen/UnternehmenView.tsx')).not.toContain('Schutzrechte');
    expect(lies('lib/recht/check.ts')).toContain('· Marken & Versicherungen ${AMPEL_WORT[g.teile.schutz]}');
    expect(lies('lib/gesellschaften/schild/blick.ts')).not.toContain("label: 'Schutz'");
  });
});

describe('9 · Das Menü „Unternehmen“ blitzt für ein Konto „nur Business“ nicht auf', () => {
  const Zeig = () => h('span', null, String(useNurBusiness()));
  it('mit dem Vorwissen des Rahmens steht „nur Business“ schon im ersten Bild fest — ohne bleibt es unbekannt', () => {
    expect(renderToStaticMarkup(h(KontoVorab, { wert: { nurBusiness: true }, children: h(Zeig) }))).toBe('<span>true</span>');
    expect(renderToStaticMarkup(h(KontoVorab, { wert: { nurBusiness: false }, children: h(Zeig) }))).toBe('<span>false</span>');
    expect(renderToStaticMarkup(h(Zeig))).toBe('<span>null</span>');
  });
  it('der OS-Rahmen rechnet es mit derselben Regel wie /api/konto/ich und legt es um die Leiste', () => {
    const l = lies('app/os/layout.tsx');
    expect(l).toContain('kontoSichtAus(konten, konto.speicher).nurBusiness');
    expect(l.indexOf('<KontoVorab wert={vorab}>')).toBeLessThan(l.indexOf('<Leiste />'));
    expect(l).toContain('</KontoVorab>');
  });
});
