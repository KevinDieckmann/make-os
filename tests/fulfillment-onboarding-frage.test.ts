// Rundgang 19.10. B6 (21.10.): Nach „Mandat aus diesem Produkt anlegen“ (bzw. jedem neuen Mandat, dessen Produkt einen Ablauf hat) fragt die Oberfläche
// „Kundenonboarding jetzt starten?“ — über den VORHANDENEN Start-Dialog (kein zweiter Weg zum Fall-Start), nichts automatisch.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const frage = readFileSync('components/os/fulfillment/prozesse/OnboardingFrage.tsx', 'utf8');
const kunden = readFileSync('components/os/crm/Kunden.tsx', 'utf8');

describe('B6 · Kundenonboarding nach dem Anlegen', () => {
  it('fragt nur mit zugeordnetem Ablauf (kein Zusatzmodul), nur Business, nicht bei laufendem Fall', () => {
    expect(frage).toContain('Kundenonboarding jetzt starten?');
    expect(frage).toMatch(/d\.zuordnung\[m\.leistungId\]/);
    expect(frage).toMatch(/p\.art === 'paket' && !p\.zusatz/);
    expect(frage).toMatch(/istBusinessMandat\(m\.gesellschaft\)/);
    expect(frage).toMatch(/d\.faelle\[m\.id\]/);
  });
  it('startet über den vorhandenen Start-Dialog — nie selbst (kein fallAktion, kein Automatismus)', () => {
    expect(frage).toContain('<StartDialog');
    expect(frage).not.toMatch(/fallAktion|vorlagenOps|useEffect/);
    expect(frage).toContain('Später');
  });
  it('„+ Mandat“ (auch aus der Produkt-Karte) fragt nach dem Anlegen', () => {
    expect(kunden).toMatch(/onFertig=\{id => \{[^}]*setOnboardingFuer\(id\);/);
    expect(kunden).toContain('<OnboardingFrage');
  });
});
