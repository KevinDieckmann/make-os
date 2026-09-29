// ─── Fenster in Karten (Gesamtprüfung Kalender, 29.09.) ──────────────────────
// Befund im Prüfbau: Ein Fenster (components/os/Fenster.tsx, position:fixed) in einer Karte mit `.os-auf` war so breit wie
// die Karte und lag unter den Nachbarkarten — Buchungsseite anlegen, „+ Meeting“ in der Kontaktakte, Termin-Vorschlag im
// Angebot, Reparatur-Vorschau der Verbindungsprüfung. Ursache: die Einblend-Animation lief mit `both` und galt nach dem
// Ende weiter (transform → Bezugsrahmen für fixed), dazu das Anheben der Karte beim Zeigen (`.karte:hover`).
// Dieser Test hält die zwei Regeln in app/globals.css fest.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const regel = (klasse: string): string => {
  const m = css.match(new RegExp(`\\.${klasse}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : '';
};

describe('Fenster in Karten', () => {
  it('Einblend-Animationen mit transform gelten nach dem Ende nicht weiter (kein both/forwards)', () => {
    for (const k of ['os-auf', 'zeile-auf']) {
      const r = regel(k);
      expect(r, k).toMatch(/animation:/);
      expect(r, k).not.toMatch(/\b(both|forwards)\b/);
      expect(r, k).toMatch(/\bbackwards\b/);
    }
  });

  it('eine Karte mit offenem Fenster bleibt flach (auch beim Zeigen)', () => {
    const m = css.match(/([^{}]*:has\(\[aria-modal="true"\]\)[^{}]*)\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('.karte:has([aria-modal="true"])');
    expect(m![1]).toContain('.os-auf:has([aria-modal="true"])');
    expect(m![2]).toMatch(/transform:\s*none\s*!important/);
  });

  it('das Fenster ist ein Dialog mit aria-modal (daran hängt die Regel)', () => {
    const f = readFileSync(join(__dirname, '..', 'components', 'os', 'Fenster.tsx'), 'utf8');
    expect(f).toContain('role="dialog" aria-modal="true"');
    expect(f).toContain("position: 'fixed'");
  });
});
