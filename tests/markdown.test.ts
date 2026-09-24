import { describe, expect, it } from 'vitest';
import { bloecke, inline, sichererLink } from '@/lib/make-one/markdown';

describe('Markdown lesen', () => {
  it('erkennt Überschrift, Absatz, Liste mit Haken, Linie', () => {
    const b = bloecke('# Titel\n\nErste Zeile\nzweite Zeile\n\n- [x] erledigt\n- [ ] offen\n  - Unterpunkt\n\n---');
    expect(b.map(x => x.art)).toEqual(['titel', 'absatz', 'liste', 'linie']);
    const liste = b[2] as Extract<(typeof b)[number], { art: 'liste' }>;
    expect(liste.punkte).toEqual([{ text: 'erledigt', tiefe: 0, haken: true }, { text: 'offen', tiefe: 0, haken: false }, { text: 'Unterpunkt', tiefe: 1 }]);
  });

  it('liest Tabellen mit Kopf und Zeilen', () => {
    const b = bloecke('| Name | Rolle |\n|---|:--:|\n| Kevin | Inhaber |\n| Malin | Gesundheit |');
    expect(b).toEqual([{ art: 'tabelle', kopf: ['Name', 'Rolle'], zeilen: [['Kevin', 'Inhaber'], ['Malin', 'Gesundheit']] }]);
  });

  it('versteht Obsidian-Callouts und Code', () => {
    const b = bloecke('> [!warning] Achtung\n> nicht löschen\n\n```ts\nconst a = 1;\n```');
    expect(b[0]).toEqual({ art: 'zitat', callout: 'warning', titel: 'Achtung', zeilen: ['nicht löschen'] });
    expect(b[1]).toEqual({ art: 'code', sprache: 'ts', text: 'const a = 1;' });
  });

  it('zerlegt Wikilinks mit Alias und Anker, Links, Hervorhebungen', () => {
    const t = inline('Siehe [[Jarvis_Log#Heute|das Log]], **fett**, `code`, ![[bild.png]] und [Web](https://example.invalid).');
    expect(t).toContainEqual({ art: 'wiki', ziel: 'Jarvis_Log', text: 'das Log', einbettung: false });
    expect(t).toContainEqual({ art: 'wiki', ziel: 'bild.png', text: 'bild.png', einbettung: true });
    expect(t).toContainEqual({ art: 'fett', text: 'fett' });
    expect(t).toContainEqual({ art: 'code', text: 'code' });
    expect(t).toContainEqual({ art: 'link', ziel: 'https://example.invalid', text: 'Web' });
  });

  it('lässt nur sichere Adressen durch', () => {
    expect(sichererLink('javascript:alert(1)')).toBeNull();
    expect(sichererLink('https://kemaris.de')).toBe('https://kemaris.de');
    expect(sichererLink('obsidian://open?vault=MAKE')).toBe('obsidian://open?vault=MAKE');
  });
});
