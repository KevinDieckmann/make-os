// ─── Rechnungen schreiben mit PDF (08.10.) — Oberfläche ──────────────────────
// Der Editor zeichnet einen Entwurf (Pflicht-Hinweise, EINE Hauptaktion „Rechnung stellen“) und eine gestellte Rechnung (nur lesend,
// PDF, Storno). Die Dateien hängen am Design-Standard (Bausteine aus ../ui, Schrift ≥ 13 px außer Beschriftungen in Großbuchstaben).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzen' }));

const h = (c: unknown, props: unknown) => createElement(c as never, props as never);
const wurzel = path.resolve(__dirname, '..');
const ORDNER = 'components/os/rechnung';

const IBAN_MASKIERT = 'DE89 •••• •••• 3000';
const daten = (rechnungen: (Rechnung & { fassung: string })[]) => ({
  stand: { sicht: 'privat' as const, rechnungen, vorgabe: 'kdv' as const, mahnTage: [7, 14, 21] as [number, number, number], mahnvorschlaege: [],
    gesellschaften: [{ id: 'kdv' as const, firmierung: 'Beispiel Ventures UG', strasse: 'Beispielweg 1', plz: '12345', ort: 'Musterstadt', steuernummer: '12/345/67890', geschaeftsfuehrung: 'Erika Beispiel', register: 'HRB 1', bank: { iban: IBAN_MASKIERT, ibanGesetzt: true }, luecken: [] }] },
  fehler: null, gesperrt: false, laden: async () => {}, uebernehmen: () => {}, entfernen: () => {}, setFehler: () => {},
});
const entwurf: Rechnung & { fassung: string } = {
  id: 'r-ui-1', firmaId: 'kdv', kunde: 'Muster GmbH', titel: 'Beratung', betrag: 2975, status: 'geplant', fassung: 'f1', zahlungszielTage: 14,
  positionen: [{ id: 'p1', titel: 'Beratung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 250000, ustSatz: 19 }], empfaenger: { firma: 'Muster GmbH' },
};

describe('Editor', () => {
  it('Entwurf: Felder, Pflicht-Hinweis (Anschrift, Leistungsdatum) und EINE Hauptaktion', async () => {
    const { RechnungEditor } = await import('@/components/os/rechnung/Editor');
    const html = renderToStaticMarkup(h(RechnungEditor, { start: entwurf, daten: daten([entwurf]), onZu: () => {} }));
    expect(html).toContain('Rechnung stellen');
    expect(html).toContain('Bis zum Stellen fehlt noch');
    expect(html).toMatch(/Empfänger: vollständige Anschrift/);
    expect(html).toMatch(/Leistungsdatum/);
    expect(html.match(/ui-knopf-haupt/g)?.length).toBe(1);
    expect(html).toContain('Hinweis, keine Steuerberatung');
  });
  it('gestellte Rechnung: nur lesend, Blatt mit Nummer, PDF und Storno — kein „Rechnung stellen“', async () => {
    const { RechnungEditor } = await import('@/components/os/rechnung/Editor');
    const g = { ...entwurf, status: 'gestellt' as const, nummer: 'KDV-R-2026-0001', datum: '2026-10-08', faellig: '2026-10-22', leistungVon: '2026-10-01', pdfDateiId: 'd-ui-1', empfaenger: { firma: 'Muster GmbH', strasse: 'Hauptstraße 5', plz: '54321', ort: 'Beispielstadt' } };
    const html = renderToStaticMarkup(h(RechnungEditor, { start: g, daten: daten([g]), onZu: () => {} }));
    expect(html).toContain('KDV-R-2026-0001');
    expect(html).toContain('PDF herunterladen');
    expect(html).toContain('Stornorechnung anlegen');
    expect(html).not.toContain('Rechnung stellen');
    expect(html).toContain(IBAN_MASKIERT); // die Vorschau zeigt die IBAN nur maskiert
  });
});

describe('Design-Standard', () => {
  const dateien = readdirSync(path.join(wurzel, ORDNER)).filter(n => /\.tsx?$/.test(n)).map(n => `${ORDNER}/${n}`);
  it('Bausteine nur aus ../ui (nie schlank.tsx), kein eigenes h1', () => {
    for (const f of dateien) {
      const t = readFileSync(path.join(wurzel, f), 'utf8');
      expect(t, f).not.toMatch(/from '(\.\.\/)+schlank'/);
      expect(t, f).not.toMatch(/<h1[ >]/);
    }
  });
  it('Fließtext nicht unter 13 px — kleiner nur als Beschriftung in Großbuchstaben', () => {
    const funde: string[] = [];
    for (const f of dateien) readFileSync(path.join(wurzel, f), 'utf8').split('\n').forEach((z, i) => {
      if (/fontSize: (10|10\.5|11|11\.5|12|12\.5)(?![\d.])/.test(z) && !/uppercase/.test(z)) funde.push(`${f}:${i + 1}`);
    });
    expect(funde).toEqual([]);
  });
});
