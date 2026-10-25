// ─── Prozesse × Fulfillment — Oberfläche (22.10.): Produktkarte „Ablauf“, „Prozess für dieses Produkt anlegen“, Landkarte und Steckbrief ────────────────
// Ohne Browser: der Dialog „Prozess für dieses Produkt“ (Name = Produkt, nur Fulfillment · Übergabe · Ausbau, Fall = Mandat), die Kachel nennt das Produkt,
// der Steckbrief verlinkt es (`WEG.produkt`), die Produktkarte wählt Pakete UND Werkstatt-Prozesse über EINE Regel (`ablaufWechsel`) und verlinkt in Editor bzw.
// Werkstatt; die reine Regel bleibt client-sicher (nur Typ-Importe).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate' }));

import { NeuerProzessFenster } from '@/components/os/prozesse/WerkstattUebersicht';
import { SteckbriefKarte } from '@/components/os/prozesse/Feld';
import type { ProzessDef } from '@/lib/prozesse/typen';

const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

describe('„Prozess für dieses Produkt anlegen“', () => {
  it('Name = „<Produkt> umsetzen“, Bereich nur Fulfillment · Übergabe · Ausbau, ein Lauf hängt am Mandat', () => {
    const html = renderToStaticMarkup(h(NeuerProzessFenster, { fuerProdukt: { name: 'Diagnose' }, onZu: () => {}, onAngelegt: () => {} }));
    expect(html).toContain('Prozess für dieses Produkt');
    // Kern-Runde 4 · 14 (25.10.): der Name trägt ein Verb (`produktProzessTitel`) — der Wächter zog dort nicht mit.
    expect(html).toContain('value="Diagnose umsetzen"');
    for (const b of ['Fulfillment', 'Übergabe', 'Ausbau']) expect(html, b).toContain(`>${b}<`);
    for (const b of ['Marketing', 'Sales', 'Führung', 'Unterstützung']) expect(html, b).not.toContain(`>${b}<`);
    expect(html).toContain('Am Mandat');
    expect(html).not.toContain('>Lead<');
  });
  it('ohne Produkt bleibt der Dialog wie bisher (alle Bereiche, Fall-Art wählbar)', () => {
    const html = renderToStaticMarkup(h(NeuerProzessFenster, { onZu: () => {}, onAngelegt: () => {} }));
    expect(html).toContain('Neuer Prozess');
    for (const b of ['Marketing', 'Sales', 'Fulfillment', 'Führung']) expect(html, b).toContain(`>${b}<`);
    expect(html).toContain('>Lead<');
  });
});

describe('Landkarte · Steckbrief', () => {
  const p: ProzessDef = {
    id: 'pz-00000000-0000-4000-8000-000000000001', titel: 'Diagnose liefern', quelle: 'werkstatt', band: 'kern', stufe: 'fulfillment',
    steckbrief: { ausloeser: 'Neues Mandat bzw. Zusatzmodul des Produkts · von Hand', eingang: 'x', ergebnis: 'y', empfaenger: 'Mandat', eigner: 'festgelegt' }, phasen: [],
    werkstatt: { status: 'aktiv', version: 1, schritte: 2 }, produkte: [{ id: 'p-1', name: 'Diagnose', href: '/os/mandate?s=produkte&k=p-1' }],
  };
  it('„Gehört zu Produkt“ mit Link auf die Produktkarte', () => {
    const html = renderToStaticMarkup(h(SteckbriefKarte, { p, zahl: undefined }));
    expect(html).toContain('Gehört zu Produkt');
    expect(html).toContain('href="/os/mandate?s=produkte&amp;k=p-1"');
    expect(html).toContain('Diagnose ›');
  });
  it('ohne Produkt keine Zeile', () => {
    expect(renderToStaticMarkup(h(SteckbriefKarte, { p: { ...p, produkte: undefined }, zahl: undefined }))).not.toContain('Gehört zu Produkt');
  });
  it('die Kachel nennt das Produkt unten (statt des Eigners) und im Vorlesetext', () => {
    const s = lies('components/os/prozesse/Bilder.tsx');
    expect(s).toContain('t.produkt ?? t.eigner');
    expect(s).toMatch(/t\.produkt \? `, \$\{t\.produkt\}`/);
  });
});

describe('Produktkarte „Ablauf“', () => {
  const s = lies('components/os/mandate/karte/Ablauf.tsx');
  it('eine Wahl für Pakete UND Werkstatt-Prozesse — der Wechsel nur über `ablaufWechsel`, wählbar nur über `fuerProduktWaehlbar`', () => {
    expect(s).toContain('ablaufWechsel(l, zuordnung,');
    expect(s).toContain('fuerProduktWaehlbar');
    expect(s).toContain("speichern({ prozessId: s.prozessId })");
    expect(s).toContain("op: 'zuordnung'");
    // Kein zweiter Schreibweg: Produkte nur über `speichern` (api.teil), Werkstatt nur über deren Dialog.
    expect(s).not.toMatch(/fetch\(/);
    expect(s).not.toContain("'/api/crm/bestand'");
  });
  it('Links: Paket → „Im Editor öffnen“, Prozess → „In der Werkstatt öffnen“; „Prozess für dieses Produkt anlegen“ nur mit dem Recht für Entwürfe', () => {
    // E4 (22.10.): ein Paket mit Marke `werkstatt:` öffnet sich in der Werkstatt — sonst wie vorher im Editor (EINE Stelle `paketBearbeitenLink`).
    expect(s).toContain('paketBearbeitenLink(paket.id, kurz.daten?.werkstatt)');
    expect(s).toContain('Im Editor öffnen ›');
    expect(s).toContain("WEG.prozesse({ p: wahl.id, ansicht: 'werkstatt' })");
    expect(s).toContain('In der Werkstatt öffnen ›');
    expect(s).toMatch(/darfAnlegen && <Knopf leise onClick=\{\(\) => setNeuOffen\(true\)\}>Prozess für dieses Produkt anlegen<\/Knopf>/);
    expect(s).toContain('<NeuerProzessFenster fuerProdukt=');
    expect(s).toContain('erklaerung="fulfillment.zuordnung"');
  });
  it('die Regel ist client-sicher: lib/prozesse/produkt-bindung.ts lädt nur Typen', () => {
    const r = lies('lib/prozesse/produkt-bindung.ts');
    const importe = [...r.matchAll(/^import\s+(.*?)\s+from\s+'([^']+)';$/gm)];
    expect(importe.length).toBeGreaterThan(0);
    for (const [, klausel, von] of importe) expect(klausel.startsWith('type '), von).toBe(true);
  });
});
