// ─── Wer im Obsidian-Brain was sieht ────────────────────────────────────────
// Kevins eigene Regeln im Vault (Make.Claude/00. Fundament/Vertraulichkeits-
// regeln.md): „Agenten bekommen nie privat." Und AGENTS.md: Notizen ohne
// Kennzeichnung gelten mindestens als intern. Dieser Test hält fest, dass die
// Software genau das tut — und dass eine Notiz ihren gültigen Stand oben trägt.

import { describe, it, expect } from 'vitest';
import { darfSehen, leseKopf, obersterBlock, bereichVon, gekuerzt, AGENT } from '../lib/jarvis/vault';

describe('Sicht auf das Brain', () => {
  it('Agenten bekommen nie Privates', () => {
    expect(darfSehen({ scope: 'privat', owner: 'kevin' }, AGENT)).toBe(false);
    expect(darfSehen({ scope: 'intern' }, AGENT)).toBe(true);
    expect(darfSehen({}, AGENT)).toBe(true);
  });

  it('Kevin sieht im Gespräch alles aus seinem Brain', () => {
    expect(darfSehen({ scope: 'privat', owner: 'kevin' }, { person: 'kevin' })).toBe(true);
    expect(darfSehen({ scope: 'team' }, { person: 'kevin' })).toBe(true);
  });

  it('Malin sieht alles außer Kevins Privatem', () => {
    expect(darfSehen({ scope: 'privat', owner: 'kevin' }, { person: 'malin' })).toBe(false);
    expect(darfSehen({ scope: 'privat', owner: 'malin' }, { person: 'malin' })).toBe(true);
    expect(darfSehen({ scope: 'intern' }, { person: 'malin' })).toBe(true);
  });

  it('Andere Konten sehen nur Familie und Öffentliches', () => {
    const gast = { person: 'testmitglied' };
    expect(darfSehen({}, gast)).toBe(false);
    expect(darfSehen({ scope: 'intern' }, gast)).toBe(false);
    expect(darfSehen({ scope: 'familie' }, gast)).toBe(true);
    expect(darfSehen({ scope: 'oeffentlich' }, gast)).toBe(true);
  });
});

describe('Kopf und gültiger Stand', () => {
  const text = [
    '---', 'type: steckbrief', 'scope: Privat', 'owner: kevin', 'stand: 2026-09-21', 'tags: [firma, "kemaris"]', '---',
    '# Titel', '', '## 🔴 UPDATE 21.09.2026 · Jarvis für kevin — Neu', 'gilt jetzt', '', '## Alt', 'veraltet',
  ].join('\n');

  it('liest den YAML-Kopf ohne Zusatzpaket', () => {
    const { kopf, rumpf } = leseKopf(text);
    expect(kopf).toEqual({ typ: 'steckbrief', scope: 'privat', owner: 'kevin', stand: '2026-09-21', tags: ['firma', 'kemaris'] });
    expect(rumpf.startsWith('# Titel')).toBe(true);
  });

  it('der oberste 🔴-Block ist der gültige Stand', () => {
    const { rumpf } = leseKopf(text);
    expect(obersterBlock(rumpf)).toBe('## 🔴 UPDATE 21.09.2026 · Jarvis für kevin — Neu\ngilt jetzt');
    expect(obersterBlock('# ohne Update')).toBe('');
  });

  it('ordnet Bereiche nach dem Ordner', () => {
    expect(bereichVon('make/Make.Claude/01. KD Ventures Brain/X.md')).toBe('Business');
    expect(bereichVon('make/Make.Claude/00. Fundament/Y.md')).toBe('Fundament');
    expect(bereichVon('make/Make.Claude/02. MAKE Brain privat/Z.md')).toBe('Privat');
    expect(bereichVon('make/Make.Claude/03. Protokolle/P.md')).toBe('Protokolle');
    expect(bereichVon('makeos/05 Wissen/A.md')).toBe('MAKE OS');
  });
});

describe('Kürzen langer Notizen', () => {
  const lang = `ANFANG ${'x'.repeat(5000)} ENDE`;
  it('Wissensnotiz: der Anfang bleibt', () => {
    const k = gekuerzt(lang, 1000, false);
    expect(k.startsWith('ANFANG')).toBe(true);
    expect(k).not.toContain('ENDE');
  });
  it('Log: Anfang und vor allem das Ende bleiben', () => {
    const k = gekuerzt(lang, 1000, true);
    expect(k.startsWith('ANFANG')).toBe(true);
    expect(k.endsWith('ENDE')).toBe(true);
    expect(k).toContain('ältere Einträge ausgelassen');
  });
  it('Kurzes bleibt, wie es ist', () => expect(gekuerzt('kurz', 1000, true)).toBe('kurz'));
});
