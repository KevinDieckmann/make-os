// Werkzeug-Menü: Gruppen links zuklappen (31.10., Rückmeldung: „Vertrieb, Marketing … zuklappbar, dann übersichtlicher“).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Users } from 'lucide-react';
import { gruppeAktiv, gruppeZu, gruppenLesen, gruppeUmschalten, gruppenSchluessel } from '@/lib/make-one/werkzeug-gruppen';
import type { PunktAnsicht } from '@/lib/make-one/werkzeuge';

const punkt = (id: string, gruppe: string | undefined, an = false, unter: PunktAnsicht[] = []): PunktAnsicht =>
  ({ id, label: id, icon: Users, titel: id, href: `/x/${id}`, aktion: null, an, unter, ...(gruppe ? { gruppe } : {}) });

describe('Gruppen zuklappen', () => {
  const punkte = [punkt('kontakte', 'CRM'), punkt('deals', 'Vertrieb', true), punkt('kampagnen', 'Marketing', false, [punkt('social', undefined, false)])];

  it('Vorgabe: alles offen; zugeklappt nur, was gemerkt ist', () => {
    expect(gruppeZu(new Set(), punkte, 'CRM')).toBe(false);
    expect(gruppeZu(new Set(['CRM']), punkte, 'CRM')).toBe(true);
  });

  it('die Gruppe mit dem aktiven Punkt bleibt immer offen — auch über ein aktives Kind', () => {
    expect(gruppeAktiv(punkte, 'Vertrieb')).toBe(true);
    expect(gruppeZu(new Set(['Vertrieb']), punkte, 'Vertrieb')).toBe(false);
    const mitKind = [punkt('kampagnen', 'Marketing', false, [punkt('social', undefined, true)])];
    expect(gruppeZu(new Set(['Marketing']), mitKind, 'Marketing')).toBe(false);
  });

  it('Umschalten ändert die alte Menge nicht', () => {
    const alt = new Set(['CRM']);
    expect([...gruppeUmschalten(alt, 'Marketing')].sort()).toEqual(['CRM', 'Marketing']);
    expect([...gruppeUmschalten(alt, 'CRM')]).toEqual([]);
    expect([...alt]).toEqual(['CRM']);
  });

  it('kaputter oder fremder Speicher = alles offen', () => {
    expect(gruppenLesen(null).size).toBe(0);
    expect(gruppenLesen('kein json').size).toBe(0);
    expect(gruppenLesen('{"a":1}').size).toBe(0);
    expect([...gruppenLesen('["Vertrieb", 3, ""]')]).toEqual(['Vertrieb']);
    expect(gruppenSchluessel('markttraktion')).toBe('make-wz-zu:markttraktion');
  });

  it('das Menü nutzt die Regel, merkt je Werkzeug und klappt nur mit Namen (nicht in der Symbol-Leiste)', () => {
    const m = readFileSync('components/os/werkzeug/menue.tsx', 'utf8');
    expect(m).toContain('gruppenSchluessel(werkzeug.id)');
    expect(m).toContain('aria-expanded={!geschlossen}');
    expect(m).toContain('!nurSymbole && gruppeZu(zu, alleSicht, p.gruppe)');
  });
});
