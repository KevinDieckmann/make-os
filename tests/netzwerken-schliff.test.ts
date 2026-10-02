// ─── Netzwerken · Schliff (03.10.): Abend-Zähler, drei leise Auftritte, Bewegung reduzieren ───
// Der Zähler rechnet nur aus den Teilnahmen des Events (dieselbe Quelle wie der Abendbericht). Die Auftritte sind reines CSS
// und stehen so, dass der Grundzustand der Endzustand ist — „Bewegung reduzieren“ schaltet alle Animationen ab, dann steht
// sofort das Ergebnis da. Das Vollbild legt den Schimmer hinter das QR-Feld (Code unberührt), ohne MAKE-Marke.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { abendZahlen } from '@/components/os/netzwerken/zaehler';
import type { Teilnahme } from '@/lib/crm/typen';
import type { Visitenkarte } from '@/lib/netzwerken/karte';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/netzwerken' }));

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8');
const t = (kontaktId: string, schritt: string | null, eventId = 'ev-1'): Teilnahme => ({ id: `t-${kontaktId}-${eventId}`, eventId, kontaktId, status: 'da', ...(schritt ? { netzwerken: { erfassungId: `e-${kontaktId}`, schritt, zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-10-03T10:00:00.000Z' } } : {}) } as unknown as Teilnahme);

describe('Abend-Zähler', () => {
  it('zählt Kontakte, Termine, Follow-ups und feste Folgeschritte — nur dieses Event, nur über Netzwerken erfasst', () => {
    const z = abendZahlen([t('a', 'termin'), t('b', 'followup'), t('c', 'followup'), t('d', 'nur-kontakt'), t('e', 'angebot'), t('f', null), t('g', 'termin', 'ev-2')], 'ev-1');
    expect(z).toEqual({ kontakte: 5, termine: 1, followups: 2, mitFolgeschritt: 4 });
  });
  it('dieselbe Person zählt nur einmal; leer = Nullen', () => {
    expect(abendZahlen([t('a', 'termin'), t('a', 'followup')], 'ev-1').kontakte).toBe(1);
    expect(abendZahlen([], 'ev-1')).toEqual({ kontakte: 0, termine: 0, followups: 0, mitFolgeschritt: 0 });
  });
});

describe('Auftritte: reines CSS, Grundzustand = Endzustand', () => {
  it('Bewegung reduzieren schaltet alle Animationen ab', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important; transition: none !important; \}/);
  });
  it('Karte landet in der Kartei: Karte und Bühne enden unsichtbar bzw. eingeklappt, der Chip steht sichtbar', () => {
    expect(css).toMatch(/\.netz-buehne \{[^}]*height: 0;/);
    expect(css).toMatch(/\.netz-karte-landet \{[^}]*opacity: 0;/);
    expect(css).not.toMatch(/\.netz-chip-ein \{[^}]*opacity: 0/);
    for (const k of ['netzBuehne', 'netzKarteLandet', 'netzChipEin', 'netzHaken']) expect(css).toContain(`@keyframes ${k}`);
  });
  it('alle drei Auftritte dauern unter einer Sekunde Gesamtlauf (Dauer + Verzögerung)', () => {
    const zeit = (klasse: string): number => {
      const m = new RegExp(`\\.${klasse} \\{[^}]*animation: \\w+ ([\\d.]+)s [^;]*?(?:([\\d.]+)s)? ?(?:both|backwards|forwards)?;`).exec(css);
      expect(m, klasse).not.toBeNull();
      return Number(m![1]) + Number(m![2] ?? 0);
    };
    expect(zeit('netz-buehne')).toBeLessThanOrEqual(1);
    expect(zeit('netz-karte-landet')).toBeLessThanOrEqual(1);
    expect(zeit('netz-chip-ein')).toBeLessThanOrEqual(1);
    expect(zeit("kvl-schimmer")).toBeLessThanOrEqual(1);
  });
});

describe('Vollbild: Schimmer hinter dem QR-Feld', () => {
  const profil: Visitenkarte = { id: 'v-3f2b9c1e-0000-4000-8000-000000000001', rang: 0, vorname: 'Erika', nachname: 'Muster', firma: 'Beispielbank AG', hintergrund: '#0f1919', textfarbe: '#f6f6f6', farbe: '#cff008' };
  it('Verlauf in den Profilfarben, Schimmer vor dem QR-Feld im Dokument und darunter gestapelt, Code bleibt dunkel auf weiß', async () => {
    const { QrVollbild } = await import('@/components/os/netzwerken/QrKarte');
    const html = renderToStaticMarkup(h(QrVollbild, { karte: profil, onZu: () => {} }));
    expect(html).toContain('background:#0f1919');
    expect(html).toMatch(/background-image:[^"]*color-mix\(in srgb, #0f1919/);
    const schimmer = html.indexOf('kvl-schimmer-huelle'), qr = html.indexOf('data-testid="qr"');
    expect(schimmer).toBeGreaterThan(0);
    expect(schimmer).toBeLessThan(qr);
    expect(html).toMatch(/kvl-schimmer-huelle[^>]*z-index:2/);
    expect(html).toMatch(/z-index:3[^>]*><div style="width:min\(90vw, ?62vh, ?560px\);max-width:100%;background:#ffffff/);
    expect(html).toContain('fill="#000000"');
    expect(html).not.toMatch(/make/i);
  });
});
