// ─── Netzwerken · Karte und Vollbild zeigen nur das Profil-Design (02.10., Paket B) ─
// Kevin: Auf einer Firmenkarte (z. B. eine fremde Firma) darf nichts von MAKE zu sehen sein — kein Logo, kein Name,
// keine Farben. Der Test rendert Karte und Vollbild eines Profils mit eigenem Design und prüft die ABWESENHEIT aller
// MAKE-Marken und App-Farben, sowie die Anwesenheit der Profil-Angaben und eines hellen QR-Feldes.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FARBE } from '@/lib/make-one/design';
import type { Visitenkarte } from '@/lib/netzwerken/karte';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/netzwerken/karte' }));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const profil: Visitenkarte = {
  id: 'v-3f2b9c1e-0000-4000-8000-000000000001', rang: 0, vorname: 'Erika', nachname: 'Muster', rolle: 'Chief of Staff', firma: 'Beispielbank AG', email: 'erika@beispielbank.invalid', handy: '+49 170 0000000',
  hintergrund: '#0f1919', textfarbe: '#f6f6f6', farbe: '#cff008', schrift: 'urbanist', logo: PNG,
};

/** Alles, woran man MAKE erkennt: Name, Marken, Kennungen, App-Farben (die Token aus dem Design-System). */
function enthaeltMake(html: string): string[] {
  const funde: string[] = [];
  if (/make/i.test(html)) funde.push('Text „make“');
  for (const [name, wert] of Object.entries(FARBE)) if (typeof wert === 'string' && wert.startsWith('#') && html.toLowerCase().includes(wert.toLowerCase())) funde.push(`App-Farbe ${name} ${wert}`);
  for (const t of ['MAKE OS', 'MAKE Innovation', 'KD Ventures', 'ZOE', 'Markttraktion', 'var(--schrift-']) if (html.includes(t)) funde.push(t);
  return funde;
}

describe('Karte und Vollbild: nur das Design des Profils', () => {
  it('Karte: Logo, Name, Rolle, Firma, QR, Profilfarben — keine MAKE-Marke', async () => {
    const { KartenAnsicht } = await import('@/components/os/netzwerken/QrKarte');
    const html = renderToStaticMarkup(h(KartenAnsicht, { karte: profil }));
    expect(enthaeltMake(html)).toEqual([]);
    expect(html).toContain('Erika Muster');
    expect(html).toContain('Chief of Staff · Beispielbank AG');
    expect(html).toContain(`src="${PNG}"`);
    expect(html).toContain('alt="Logo Beispielbank AG"');
    expect(html).toContain('background:#0f1919');
    expect(html).toContain('color:#f6f6f6');
    expect(html).toContain('&quot;Urbanist&quot;');
    expect(html).toContain('data-testid="qr"');
    // Der Code steht auf weißem Feld, auch bei dunklem Profil-Hintergrund.
    expect(html).toMatch(/background:#ffffff[^"]*border-radius:18px/);
    expect(html).toContain('fill="#ffffff"');
    expect(html).toContain('fill="#000000"');
  });
  it('Vollbild: dasselbe Design, voller Bildschirm über der App-Leiste, kein MAKE', async () => {
    const { QrVollbild } = await import('@/components/os/netzwerken/QrKarte');
    const html = renderToStaticMarkup(h(QrVollbild, { karte: profil, onZu: () => {} }));
    expect(enthaeltMake(html)).toEqual([]);
    expect(html).toContain('data-testid="qr-vollbild"');
    expect(html).toContain('position:fixed;inset:0;z-index:1000');
    expect(html).toContain('background:#0f1919');
    expect(html).toContain('Erika Muster');
    expect(html).toContain('Schließen');
    expect(html).toContain(`src="${PNG}"`);
    expect(html).toContain('data-testid="qr"');
  });
  it('Standard-Design (nichts gewählt): neutral weiß/schwarz, ebenfalls ohne MAKE', async () => {
    const { KartenAnsicht, QrVollbild } = await import('@/components/os/netzwerken/QrKarte');
    const nackt: Visitenkarte = { id: profil.id, rang: 0, vorname: 'Erika', nachname: 'Muster', firma: 'Beispiel GmbH' };
    for (const html of [renderToStaticMarkup(h(KartenAnsicht, { karte: nackt })), renderToStaticMarkup(h(QrVollbild, { karte: nackt, onZu: () => {} }))]) {
      expect(enthaeltMake(html)).toEqual([]);
      expect(html).toContain('background:#ffffff');
      expect(html).toContain('color:#111111');
      expect(html).not.toContain('<img');
    }
  });
});
