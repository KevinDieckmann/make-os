// ─── Das Agentenverzeichnis muss die Wahrheit sagen ─────────────────────────
// Am 07.09. beim Nachsehen gefunden: „wissen" stand auf geplant, obwohl die
// Vault-Suche an dem Tag gebaut wurde. „brain" stand auf teil, obwohl das
// Gedächtnis lief. Und „outreach" war live, aber Jarvis kam nicht dran.
//
// Ein Verzeichnis, das mehr verspricht als da ist, ist schlimmer als keins:
// Kevin plant damit, und Jarvis liest es in jeden Prompt. Diese Tests halten
// es an der Wirklichkeit fest.

import { describe, it, expect } from 'vitest';
import { DEPARTMENTS } from '../lib/make-one/agents-data';
import { AUSFUEHRBAR, AGENT_ZWECK, SYSTEM_LAEUFE } from '../lib/jarvis/agenten';

const alle = DEPARTMENTS.flatMap(d => d.agents);
// Die Systemläufe kommen aus derselben Quelle wie im Code — eine Kopie hier
// wäre genau die Stelle, an der beide auseinanderlaufen. Beim Ergänzen von
// „selbstbild" ist das am 07.09. prompt passiert.
const SYSTEM: readonly string[] = SYSTEM_LAEUFE;

describe('Agentenverzeichnis', () => {
  it('kennt jeden Agenten nur einmal', () => {
    const ids = alle.map(a => a.id);
    expect(new Set(ids).size, `doppelte id: ${ids.filter((x, i) => ids.indexOf(x) !== i)}`).toBe(ids.length);
  });

  it('gibt jedem als live geführten Agenten auch einen Weg — Jarvis oder Oberfläche', () => {
    const ohneWeg = alle
      .filter(a => a.status === 'live')
      .filter(a => !(AUSFUEHRBAR as readonly string[]).includes(a.id) && !a.href);
    expect(ohneWeg.map(a => a.id), 'live, aber weder für Jarvis erreichbar noch mit eigener Seite').toEqual([]);
  });

  it('führt jeden Agenten, den Jarvis starten kann, auch im Verzeichnis', () => {
    const unbekannt = (AUSFUEHRBAR as readonly string[])
      .filter(id => !SYSTEM.includes(id))
      .filter(id => !alle.some(a => a.id === id));
    expect(unbekannt, 'Jarvis kann sie starten, im Verzeichnis stehen sie nicht').toEqual([]);
  });

  it('erklärt jedem ausführbaren Lauf seinen Zweck — das geht in jeden Prompt', () => {
    for (const id of AUSFUEHRBAR) {
      expect(AGENT_ZWECK[id], `${id} ohne Zweck`).toBeTruthy();
    }
  });

  it('sagt bei jedem nicht gebauten Agenten, was fehlt', () => {
    // Ein „geplant" ohne Begründung ist eine Ankündigung, kein Bauplan.
    for (const a of alle.filter(x => x.status === 'geplant')) {
      expect(a.bauplan, `${a.id} hat keinen Bauplan`).toBeTruthy();
      expect(a.bauplan.length, `${a.id}: Bauplan zu dünn`).toBeGreaterThan(60);
      expect(a.bauplan, `${a.id} sagt nicht, dass er nicht gebaut ist`).toMatch(/NICHT GEBAUT/);
    }
  });

  it('lässt keinen Agenten ohne Funktionen zurück', () => {
    for (const a of alle) {
      expect(a.funktionen.length, `${a.id} ohne Funktionen`).toBeGreaterThan(0);
    }
  });
});
