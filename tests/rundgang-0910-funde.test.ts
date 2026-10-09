// Funde aus dem Rundgang der Endprüfung 09.10. (Demo-Instanz, Bilder): deutsche Zahlform, „Als Nächstes“ verdrängt den Titel nicht,
// die ZOE-Kugel verdeckt am Handy die Reiter der Agenten-Seite nicht.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { restzeitText } from '@/lib/make-one/onboarding-data';

const lies = (p: string) => readFileSync(p, 'utf8');

describe('Rundgang 09.10. — Funde', () => {
  it('Restzeit der Einrichtung in deutscher Zahlform', () => {
    expect(restzeitText(45)).toBe('45 Min.');
    expect(restzeitText(528)).toBe('rund 8,8 Std.');
    expect(restzeitText(540)).toBe('rund 9 Std.');
    expect(restzeitText(78)).toBe('rund 1,3 Std.');
  });

  it('Übersicht und Heute-Widget nutzen dieselbe Stelle, keine englischen Dezimalzahlen in sichtbaren Texten', () => {
    for (const p of ['components/os/OnboardingView.tsx', 'components/os/flaeche/widgets.tsx']) {
      const s = lies(p);
      expect(s).toContain('restzeitText(');
      expect(s).not.toMatch(/\/ 60 \* 10\) \/ 10\}? Std/);
    }
    for (const p of ['components/os/BoardView.tsx', 'components/os/TageslaufView.tsx', 'components/os/datenschutz/Nachweise.tsx', 'components/os/sport/Einstieg.tsx']) {
      expect(lies(p)).not.toMatch(/toFixed\(1\)\}?( Mon\.|s<| MB)|\/ 60 \* 10\) \/ 10\} h/);
    }
  });

  it('„Als Nächstes“: Wiederholung steht unter dem Titel, nicht daneben', () => {
    const s = lies('components/os/agenten/Hintergrund.tsx');
    const zeile = s.slice(s.indexOf('function NaechstesZeile'), s.indexOf('export function AlsNaechstes'));
    expect(zeile).toContain("flexDirection: 'column'");
    expect(zeile.indexOf('{n.titel}')).toBeLessThan(zeile.indexOf('wiederholText(n, jetzt)'));
  });

  it('ZOE-Kugel am Handy auf der Agenten-Seite ausgeblendet (Reiter bleiben frei)', () => {
    expect(lies('components/os/agenten/AgentenSeite.tsx')).toContain('className="agenten-reiter-handy"');
    expect(lies('app/globals.css')).toMatch(/body:has\(\.agenten-reiter-handy\) \.zoe-fab \{ display: none; \}/);
  });
});
