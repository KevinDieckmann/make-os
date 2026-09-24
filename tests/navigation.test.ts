// Links nur die Arbeitsräume, alles andere über den Kopf (Kevin, 24.09. abends).
import { describe, it, expect } from 'vitest';
import { HAUPT, HANDY, aktiverEintrag } from '../lib/make-one/navigation';

describe('Navigation', () => {
  it('links stehen genau Jarvis, Brain, CRM, Fokus, Aufgaben', () => {
    expect(HAUPT.map(e => e.label)).toEqual(['Jarvis', 'Brain', 'CRM', 'Fokus', 'Aufgaben']);
    expect(HANDY).toEqual(HAUPT.map(e => e.href));
  });
  it('markiert den richtigen Eintrag — auch für Unterseiten', () => {
    expect(aktiverEintrag('/os/prospecting')?.label).toBe('CRM');
    expect(aktiverEintrag('/os/kompass')?.label).toBe('Fokus');
    expect(aktiverEintrag('/os/planung/woche')?.label).toBe('Aufgaben');
    expect(aktiverEintrag('/os/agenten')?.label).toBe('System');
  });
  it('Bereiche aus dem Kopf markieren links nichts', () => {
    for (const p of ['/os', '/os/finanzen', '/os/gesundheit', '/os/inbox', '/os/familie']) expect(aktiverEintrag(p)).toBeNull();
  });
});
