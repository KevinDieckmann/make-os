// Wächter (22.10.): globale Knopf-Regeln dürfen in SVG keine CSS-Transformation setzen — dort ersetzt sie das `transform`-Attribut
// (die Lage eines `<g role="button">`), das Ziel springt beim Drücken weg und der Klick geht ins Leere („+“ auf dem Faden der Werkstatt).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('Knopf-Regeln und SVG', () => {
  it('jede Regel, die [role="button"] beim Drücken/Überfahren transformiert, schließt SVG aus', () => {
    const regeln = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /\btransform\s*:/.test(m[2]));
    const betroffen = regeln.flatMap(m => m[1].split(',').map(s => s.trim()))
      .filter(s => s.includes('[role="button"]') && /:(active|hover|focus)/.test(s));
    expect(betroffen.length).toBeGreaterThan(0);
    for (const s of betroffen) expect(s, s).toContain(':not(svg *)');
  });
});
