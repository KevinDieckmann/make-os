// ─── Kern-Bau-Test 24.10. — Fulfillment-Kleinkram: Kopf der Kunden-Seite ohne Doppelungen, gewählte Phase am Handy aufgeklappt (rein) ──────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { kundenKopf, ohneFirma } from '@/lib/fulfillment/kunde/kopf';
import { phaseBegonnen } from '@/lib/reise/bild';

describe('Kopf der Kunden-Seite: Firma und Ablauf je nur einmal', () => {
  it('„<Firma> · <Produkt>“ als Mandat: Überschrift ohne Firma, „für <Firma>“ darunter, das Produkt nicht noch einmal', () => {
    expect(kundenKopf({ mandat: 'Hafenkontor Beispiel GmbH · Bau-Test Vertriebssprint', firma: 'Hafenkontor Beispiel GmbH', paket: 'Bau-Test Vertriebssprint' }))
      .toEqual({ titel: 'Bau-Test Vertriebssprint', firma: 'Hafenkontor Beispiel GmbH' });
  });
  it('ein Titel ohne Firma bleibt; ein anderer Ablauf steht dabei; Firma am Ende wird ebenso gekürzt; nur die Firma bleibt stehen', () => {
    expect(kundenKopf({ mandat: 'Vertriebssprint', firma: 'Probe GmbH', paket: 'Vertriebsaufbau' })).toEqual({ titel: 'Vertriebssprint', firma: 'Probe GmbH', paket: 'Vertriebsaufbau' });
    expect(ohneFirma('Sprint – Probe GmbH', 'Probe GmbH')).toBe('Sprint');
    expect(ohneFirma('Probe GmbH', 'Probe GmbH')).toBe('Probe GmbH');
    expect(ohneFirma('Probe GmbH · ', 'Probe GmbH')).toBe('Probe GmbH ·');
    expect(kundenKopf({ firma: 'Probe GmbH' })).toEqual({ titel: 'Probe GmbH' });
  });
});

describe('Reise am Handy: die gewählte bzw. begonnene Phase ist aufgeklappt', () => {
  it('begonnen = kommt noch, schon etwas erledigt, noch etwas offen', () => {
    expect(phaseBegonnen({ zustand: 'offen', kaestchen: [{ id: 'a', titel: 'A', zustand: 'erledigt' }, { id: 'b', titel: 'B', zustand: 'offen' }] })).toBe(true);
    expect(phaseBegonnen({ zustand: 'offen', kaestchen: [{ id: 'b', titel: 'B', zustand: 'offen' }] })).toBe(false);
    expect(phaseBegonnen({ zustand: 'jetzt', kaestchen: [{ id: 'a', titel: 'A', zustand: 'erledigt' }, { id: 'b', titel: 'B', zustand: 'offen' }] })).toBe(false);
  });
  it('CSS: offene und fertige Phasen klappen am Handy nur zu, wenn sie weder gewählt noch begonnen sind', () => {
    const css = readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');
    expect(css).toContain('.ff-reise-offen:not(.ff-reise-aktiv):not(.ff-reise-begonnen) .ff-reise-kaestchen');
    expect(css).toContain('.ff-reise-fertig:not(.ff-reise-aktiv) .ff-reise-kaestchen');
    expect(css).not.toMatch(/\.ff-reise-offen \.ff-reise-kaestchen/);
    const bild = readFileSync(path.join(process.cwd(), 'components/os/ui/reise/ReiseBild.tsx'), 'utf8');
    expect(bild).toContain("ff-reise-begonnen");
  });
});
