// ─── Kontakt öffnen · Schnellaktions-Leiste am Handy (02.10., Paket B) ───────────
// Server-Render der Leiste: alle Wege am Kunden da, Ziele ≥ 44 px, Anrufen als tel:-Link über die Ampel, Angebot als Link
// mit Person, Sperren (Art. 18, Werbesperre, kein Telefon) — und die Akte zeigt am Handy die Leiste, am Rechner die Spalte links.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ampel } from '@/lib/crm/recht';
import type { Kontakt } from '@/lib/make-one/crm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

const kontakt = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-test', vorname: 'Anna', nachname: 'Test', firmaId: 'f-1', email: 'anna@test.invalid', telefon: '+49 30 1234567', stufe: 'gespraech', kreis: 'B', aktivitaeten: [], geaendertAm: '2026-10-02', ...x } as Kontakt);
const api = { crm: null, kontakte: [], ich: 'kevin' } as unknown as import('@/components/os/crm/daten').CrmApi;
async function render(k: Kontakt) {
  const { SchnellLeiste } = await import('@/components/os/crm/kontakt/SchnellLeiste');
  return renderToStaticMarkup(h(SchnellLeiste, { k, api, heute: '2026-10-02', ampel: ampel(k, { hatMandat: true, hatChance: true }) }));
}

describe('Schnellleiste', () => {
  it('zeigt alle Wege am Kunden', async () => {
    const html = await render(kontakt());
    for (const t of ['Anrufen', 'Anruf festhalten', 'Mail', 'Termin', 'Notiz', 'Follow-up', 'Qualifizieren', 'Vermitteln', 'Angebot', 'Make.One einladen']) expect(html).toContain(`</span>${t}<`);
    expect(html).toContain('role="toolbar"');
    expect(html).toContain('position:sticky');
  });
  it('Anrufen ist ein tel:-Link, Angebot führt mit Person und Firma in den Entwurf', async () => {
    const html = await render(kontakt());
    expect(html).toMatch(/<a href="tel:[^"]+"/);
    expect(html).toMatch(/href="\/os\/markttraktion\?[^"]*s=angebot[^"]*kontakt=c-test[^"]*"/);
  });
  it('jedes Ziel ist mindestens 44 px hoch', async () => {
    const html = await render(kontakt());
    const ziele = html.match(/<(button|a)\b[^>]*style="[^"]*"/g) ?? [];
    expect(ziele.length).toBeGreaterThanOrEqual(10);
    for (const z of ziele) expect(z).toContain('min-height:44px');
  });
  it('Art. 18: alles gesperrt; Werbesperre: Mail und Anruf; ohne Telefon: kein tel:-Link', async () => {
    const eingeschraenkt = await render(kontakt({ eingeschraenkt: { seit: '2026-10-01' } } as Partial<Kontakt>));
    expect(eingeschraenkt).not.toContain('href="tel:');
    expect(eingeschraenkt).not.toMatch(/s=angebot/);
    expect((eingeschraenkt.match(/disabled=""/g) ?? []).length).toBeGreaterThanOrEqual(8);
    const werbesperre = await render(kontakt({ werbesperre: { seit: '2026-10-01' } } as Partial<Kontakt>));
    expect(werbesperre).not.toContain('href="tel:');
    expect(werbesperre).toMatch(/s=angebot/);
    const ohneTel = await render(kontakt({ telefon: undefined }));
    expect(ohneTel).not.toContain('href="tel:');
    expect(ohneTel).toContain('Kein Telefon eingetragen');
  });
  it('die Akte zeigt die Leiste unter 1180 px und die Spalte links nur am Rechner', () => {
    const akte = readFileSync(path.resolve(__dirname, '../components/os/crm/Akte.tsx'), 'utf8');
    expect(akte).toMatch(/\{!drei && <SchnellLeiste /);
    expect(akte).toContain('schnellaktionen={drei}');
  });
});
