// ─── Buchhaltung — Oberfläche (02.11.) ─────────────────────────────────────────────────────────────────────────────────────────
// Prüfmodus zählt richtig („Alle ohne Frage bestätigen (n)“: nur ohne offene Frage und ohne fehlende Bewirtung), Bearbeiten zeigt nur Rechnungen und
// Mandate derselben Gesellschaft, die Arbeitsliste hat Seiten statt einer festen Grenze. Erfundene Werte.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzen' }));

const h = (c: unknown, props: unknown) => createElement(c as never, props as never);
const b = (x: Partial<BhBuchung> & { id: string }): BhBuchung => ({ datum: '2026-10-10', wer: 'Laden Beispiel', betrag: -20, kategorie: 'Büro', ort: 'ug', stand: 's', ...x });

describe('Zu prüfen', () => {
  it('gruppiert nach Gegenseite und bestätigt in einem Zug nur, was keine Frage offen hat', async () => {
    const { Pruefen } = await import('@/components/os/buchhaltung/Pruefen');
    const alle = [
      b({ id: '1', pruefung: { status: 'offen', vorschlag: 'Büro' } }),
      b({ id: '2', pruefung: { status: 'offen', vorschlag: 'Büro', frage: { text: 'Wofür war das?', optionen: ['Büro', 'Privat'] } } }),
      b({ id: '3', wer: 'Gasthaus Beispiel', kategorie: 'Bewirtung', pruefung: { status: 'offen', vorschlag: 'Bewirtung' } }),
      b({ id: '4', pruefung: { status: 'bestaetigt' } }),
    ];
    const html = renderToStaticMarkup(h(Pruefen, { alle, onTeil: async () => true, onAendern: () => {} }));
    expect(html).toContain('Alle ohne Frage bestätigen (1)');
    expect(html).toContain('Laden Beispiel · 2');
    expect(html).toContain('Gasthaus Beispiel · 1');
    expect(html).toContain('Wofür war das?');
    expect(html).toContain('Anlass');
  });
  it('nichts offen → Leerzustand', async () => {
    const { Pruefen } = await import('@/components/os/buchhaltung/Pruefen');
    expect(renderToStaticMarkup(h(Pruefen, { alle: [b({ id: '1' })], onTeil: async () => true, onAendern: () => {} }))).toContain('Nichts zu prüfen');
  });
});

describe('Buchung bearbeiten', () => {
  it('Rechnungen und Mandate nur derselben Gesellschaft', async () => {
    const { BuchungBearbeiten } = await import('@/components/os/buchhaltung/BuchungBearbeiten');
    const html = renderToStaticMarkup(h(BuchungBearbeiten, {
      b: b({ id: '1', betrag: 500, kategorie: 'Erlöse' }), kategorien: ['Erlöse', 'Büro'], orte: ['ug', 'kdv'],
      rechnungen: [{ id: 're-ug', firmaId: 'ug', nummer: 'RE-UG-1', betrag: 500, status: 'gestellt' }, { id: 're-kdv', firmaId: 'kdv', nummer: 'RE-KDV-1', betrag: 500, status: 'gestellt' }],
      mandate: [{ id: 'm-ug', titel: 'Begleitung', firma: 'Kunde Eins', aktiv: true, einheit: 'ug' }, { id: 'm-kdv', titel: 'Beteiligung', firma: 'Kunde Zwei', aktiv: true, einheit: 'kdv' }],
      gegen: new Set<string>(), onSpeichern: async () => true, onRegel: async () => {}, onZu: () => {},
    }));
    expect(html).toContain('RE-UG-1');
    expect(html).not.toContain('RE-KDV-1');
    expect(html).toContain('Kunde Eins');
    expect(html).not.toContain('Kunde Zwei');
    expect(html).toContain('Regel lernen');
  });
});

describe('Arbeitsliste', () => {
  it('keine feste 300er-Grenze mehr, Seiten und Sicht des Bereichs', () => {
    const t = readFileSync(path.resolve(__dirname, '../components/os/BuchungenView.tsx'), 'utf8');
    expect(t).not.toContain('slice(0, 300)');
    expect(t).toContain('seiteVon(');
    expect(t).toContain('buchungenLaden(bereich)');
    expect(readFileSync(path.resolve(__dirname, '../components/os/buchhaltung/daten.ts'), 'utf8')).toContain('/api/state/buchungen?${sichtParam(b)}');
  });
});
