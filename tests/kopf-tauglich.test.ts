// ─── Was in einen HTTP-Header darf ──────────────────────────────────────────
// Der Fall vom 07.09.: der Apple-Kalender war kurz nicht erreichbar. Die Route
// wollte den letzten guten Stand ausliefern und den Grund als Header mitgeben —
// und starb an dem Gedankenstrich in der eigenen Fehlermeldung. Der Nutzer sah
// einen 500, obwohl die Daten fertig dalagen.

import { describe, it, expect } from 'vitest';
import { kopfTauglich } from '../lib/kopf-tauglich';

describe('Header-tauglicher Text', () => {
  it('entfernt den Gedankenstrich, der die Route zum Absturz brachte', () => {
    const echt = 'Kalender nicht erreichbar — osascript hat nicht geantwortet';
    const raus = kopfTauglich(echt);
    expect(raus).not.toContain('—');
    expect(raus).toContain('Kalender nicht erreichbar');
    // Und das Ergebnis muss wirklich in Latin-1 passen.
    expect(Array.from(raus).every(z => z.charCodeAt(0) <= 255)).toBe(true);
  });

  it('lässt Umlaute stehen — die sind Latin-1 und lesbar', () => {
    // Die typografischen Anführungszeichen ausdrücklich als Escape, nicht
    // getippt: beim ersten Versuch war das schließende ein ASCII-Zeichen und
    // der Test prüfte etwas anderes, als er behauptete.
    expect(kopfTauglich('Zugriff verweigert f\u00fcr Kalender \u201EPrivat\u201C'))
      .toBe('Zugriff verweigert für Kalender Privat');
  });

  it('behält gewöhnliche Anführungszeichen — die sind erlaubt', () => {
    expect(kopfTauglich('Kalender "Privat" fehlt')).toBe('Kalender "Privat" fehlt');
  });

  it('wirft alles raus, was über Latin-1 hinausgeht', () => {
    for (const zeichen of ['—', '–', '„', '"', '›', '✓', '🎯', '…']) {
      const raus = kopfTauglich(`Fehler ${zeichen} Ende`);
      expect(Array.from(raus).every(z => z.charCodeAt(0) <= 255), zeichen).toBe(true);
    }
  });

  it('zieht Leerraum zusammen und kürzt', () => {
    expect(kopfTauglich('a\n\n   b')).toBe('a b');
    expect(kopfTauglich('x'.repeat(300)).length).toBe(120);
    expect(kopfTauglich('x'.repeat(300), 20).length).toBe(20);
  });

  it('kommt mit leerem Text klar', () => {
    expect(kopfTauglich('')).toBe('');
    expect(kopfTauglich('———')).toBe('');
  });
});
