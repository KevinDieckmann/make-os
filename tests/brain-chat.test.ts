// Der Chat mit dem Brain: Verlauf und Quellen sind reine Regeln — hier fest.
import { describe, it, expect } from 'vitest';
import { verlaufNachrichten, quellenAuswahl, systemText, type Quelle } from '../lib/jarvis/brain-chat';

describe('Chat mit dem Brain', () => {
  it('baut den Verlauf abwechselnd, beginnend mit einer Frage und endend mit einer Antwort', () => {
    const v = verlaufNachrichten([
      { rolle: 'brain', text: 'verwaiste Antwort' },
      { rolle: 'ich', text: 'Frage 1' },
      { rolle: 'ich', text: 'Nachtrag' },
      { rolle: 'brain', text: 'Antwort 1' },
      { rolle: 'ich', text: 'Frage ohne Antwort' },
    ]);
    expect(v).toEqual([
      { role: 'user', content: 'Frage 1\n\nNachtrag' },
      { role: 'assistant', content: 'Antwort 1' },
    ]);
  });

  it('nimmt höchstens die letzten Züge mit', () => {
    const lang = Array.from({ length: 20 }, (_, i) => ({ rolle: (i % 2 ? 'brain' : 'ich') as 'ich' | 'brain', text: `z${i}` }));
    expect(verlaufNachrichten(lang, 4).map(m => m.content)).toEqual(['z16', 'z17', 'z18', 'z19']);
  });

  it('stellt Gelesenes und Genanntes als Quellen unter die Antwort', () => {
    const bekannt = new Map<string, Quelle>([
      ['a', { id: 'a', titel: 'Ist-Stand', bereich: 'Business' }],
      ['b', { id: 'b', titel: 'Jarvis_Log', bereich: 'Fundament' }],
      ['c', { id: 'c', titel: 'Personen', bereich: 'Business' }],
    ]);
    expect(quellenAuswahl('Laut [[Personen]] …', ['a'], bekannt).map(q => q.id)).toEqual(['a', 'c']);
    // Nichts gelesen, nichts genannt („Dazu steht nichts im Brain."): keine Quellen
    expect(quellenAuswahl('Dazu steht nichts im Brain.', [], bekannt)).toEqual([]);
  });

  it('nennt die fragende Person und verbietet das Erfinden', () => {
    const s = systemText('malin', new Date('2026-09-24T10:00:00Z'));
    expect(s).toContain('Gerade chattet Malin');
    expect(s).toContain('erfinde nichts');
    expect(s).toContain('fremde_daten');
  });
});
