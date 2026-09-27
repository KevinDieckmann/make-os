// Brain-Index: Abschnitte (lib/brain/chunks.ts) — an Überschriften, mit Kontext, große geteilt, kleine zusammengelegt.
import { describe, it, expect } from 'vitest';
import { abschnitte, ftsAnfrage, verweise, MAX_ZEICHEN, ZIEL_ZEICHEN } from '@/lib/brain/chunks';

describe('abschnitte', () => {
  it('schneidet an Überschriften und stellt den Kontext voran', () => {
    const a = abschnitte('Ist-Stand', '# Lage\n\nEinleitung mit genug Text, damit es kein Krümel ist. '.repeat(20) + '\n\n## Zahlen\n\nUmsatz 12.000 €. '.repeat(60) + '\n\n### Details\n\nnoch mehr. '.repeat(60), ['business']);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a[0].kontext).toBe('Ist-Stand › Lage · business');
    expect(a.find(x => x.ueberschrift === 'Lage › Zahlen')?.kontext).toBe('Ist-Stand › Lage › Zahlen · business');
    expect(a.find(x => x.ueberschrift === 'Lage › Zahlen › Details')).toBeTruthy();
    for (const x of a) expect(x.text.length).toBeLessThanOrEqual(MAX_ZEICHEN);
    expect(a.map(x => x.position)).toEqual(a.map((_, i) => i));
  });
  it('legt kleine Nachbarn zusammen und teilt Riesenabschnitte mit Überlappung', () => {
    const klein = abschnitte('N', '## A\nkurz\n\n## B\nauch kurz\n\n## C\nnoch kürzer');
    expect(klein).toHaveLength(1);
    expect(klein[0].text).toContain('**B**');
    const gross = abschnitte('N', '## Lang\n\n' + Array.from({ length: 40 }, (_, i) => `Absatz ${i} ${'x'.repeat(120)}`).join('\n\n'));
    expect(gross.length).toBeGreaterThan(1);
    for (const x of gross) expect(x.text.length).toBeLessThanOrEqual(ZIEL_ZEICHEN + 200);
    // Überlappung: der Anfang des zweiten Stücks steht auch am Ende des ersten
    const ersteZeileZweites = gross[1].text.split('\n')[0];
    expect(gross[0].text).toContain(ersteZeileZweites.slice(0, 20));
  });
  it('lässt Codeblöcke zusammen und liest Wikilinks', () => {
    const a = abschnitte('N', 'Text\n\n```\n# kein Titel\ncode\n```\n\nEnde [[Frank Mathick]] und [[KEMARIS|Firma]] und [[Frank Mathick#Rolle]]');
    expect(a).toHaveLength(1);
    expect(a[0].text).toContain('# kein Titel');
    expect(verweise(a[0].text)).toEqual(['Frank Mathick', 'KEMARIS']);
  });
  it('baut eine FTS5-Anfrage mit Präfixsuche', () => {
    expect(ftsAnfrage('Wer ist Frank Mathick?')).toBe('"wer"* OR "ist"* OR "frank"* OR "mathick"*');
    expect(ftsAnfrage('"böse" (anfrage)')).toBe('"böse"* OR "anfrage"*');
  });
});
