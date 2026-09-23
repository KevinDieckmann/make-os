// Schnell-Anlegen-Kürzel: was Kevin tippt, muss verlässlich dieselbe Aufgabe
// ergeben. Der Prioritäts-Zyklus hat einmal kritische Aufgaben auf „niedrig"
// gedreht — seitdem gilt: diese Sorte Logik wird getestet.

import { describe, expect, it } from 'vitest';
import { parseSchnell, tagInT } from '@/lib/make-one/schnell-anlegen';
import { localDay } from '@/lib/zeit';

const PROJEKTE = [
  { id: 'p-capos', title: 'CapOS Aufbau' },
  { id: 'p-privat', title: 'Privat & Familie' },
];

describe('parseSchnell', () => {
  it('liest !! als kritisch und räumt den Titel auf', () => {
    const p = parseSchnell('!! Steuerberater anrufen', PROJEKTE);
    expect(p.priority).toBe('critical');
    expect(p.title).toBe('Steuerberater anrufen');
  });

  it('liest ! als hoch — und ohne Kürzel mittel', () => {
    expect(parseSchnell('! Angebot schreiben', PROJEKTE).priority).toBe('high');
    expect(parseSchnell('Angebot schreiben', PROJEKTE).priority).toBe('medium');
  });

  it('weist @malin und @beide korrekt zu', () => {
    expect(parseSchnell('Rechnung prüfen @malin', PROJEKTE).assignee).toBe('malin');
    expect(parseSchnell('Wochenplanung @beide', PROJEKTE).assignee).toBe('both');
    expect(parseSchnell('Ohne Kürzel', PROJEKTE).assignee).toBe('kevin');
  });

  it('setzt heute/morgen als Datum', () => {
    expect(parseSchnell('Anruf heute', PROJEKTE).dueDate).toBe(localDay());
    expect(parseSchnell('Anruf morgen', PROJEKTE).dueDate).toBe(tagInT(1));
  });

  it('legt TT.MM. in der Vergangenheit ins nächste Jahr', () => {
    const p = parseSchnell('Jahresabschluss 01.01. vorbereiten', PROJEKTE);
    // Der 1. Januar liegt (außer am Neujahrstag) hinter uns → nächstes Jahr.
    const heute = localDay();
    const j = Number(heute.slice(0, 4));
    const erwartet = heute === `${j}-01-01` ? `${j}-01-01` : `${j + 1}-01-01`;
    expect(p.dueDate).toBe(erwartet);
    expect(p.title).toBe('Jahresabschluss vorbereiten');
  });

  it('ordnet #capos dem Projekt zu — unbekannte #tags bleiben im Titel', () => {
    expect(parseSchnell('KSI-Register #capos', PROJEKTE).projectId).toBe('p-capos');
    const p = parseSchnell('Notiz #unbekannt', PROJEKTE);
    expect(p.projectId).toBeUndefined();
    expect(p.title).toContain('#unbekannt');
  });

  it('kombiniert alles in einem Wurf', () => {
    const p = parseSchnell('!! Vertrag gegenlesen morgen @malin #capos', PROJEKTE);
    expect(p).toMatchObject({
      title: 'Vertrag gegenlesen', priority: 'critical',
      assignee: 'malin', projectId: 'p-capos', dueDate: tagInT(1),
    });
  });
});
