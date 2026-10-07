// WhatsApp-Bausteine (07.10.): Uhr für das 24-h-Fenster, Antworten (frei nur bei offenem Fenster, sonst Vorlage), Verbinden-Karte —
// serverseitig gerendert (kein Browser), dazu die Regeln des Design-Standards (Schrift ≥ 13 px außer Großbuchstaben-Beschriftung,
// kein eigenes h1) und: Links der Anleitung zeigen nur auf offizielle Meta-Seiten; kein Senden ohne Klick.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { FENSTER_MS } from '@/lib/whatsapp/typen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/verbindungen' }));

const h = (c: unknown, p: unknown) => createElement(c as never, p as never);
const wurzel = path.resolve(__dirname, '..');
const ORDNER = 'components/os/whatsapp';
const dateien = readdirSync(path.join(wurzel, ORDNER)).filter(n => n.endsWith('.tsx')).map(n => `${ORDNER}/${n}`);
const lies = (d: string) => readFileSync(path.join(wurzel, d), 'utf8');

describe('FensterUhr', () => {
  it('offen: Restzeit; zu: „nur genehmigte Vorlagen“; nie Daten Dritter', async () => {
    const { FensterUhr } = await import('@/components/os/whatsapp');
    const bis = new Date(Date.now() + 3 * 3600_000 + 5 * 60_000).toISOString();
    const offen = renderToStaticMarkup(h(FensterUhr, { fenster: { offen: true, bis, restMin: 185 } }));
    expect(offen).toContain('data-offen="1"'); expect(offen).toMatch(/Fenster offen · noch 3 Std\./);
    const zu = renderToStaticMarkup(h(FensterUhr, { fenster: { offen: false, bis: new Date(Date.now() - 1000).toISOString(), restMin: null } }));
    expect(zu).toContain('data-offen="0"'); expect(zu).toMatch(/nur genehmigte Vorlagen/);
  });
  it('rechnet aus „bis“ selbst nach (ein veraltetes „offen“ vom Server wird zu „zu“)', async () => {
    const { fensterJetzt } = await import('@/components/os/whatsapp');
    const bis = new Date(Date.now() - 60_000).toISOString();
    expect(fensterJetzt({ offen: true, bis, restMin: 10 }, Date.now()).offen).toBe(false);
    expect(fensterJetzt({ offen: false, bis: new Date(Date.now() + FENSTER_MS / 2).toISOString(), restMin: null }, Date.now()).offen).toBe(true);
  });
});

describe('WhatsappAntwort', () => {
  it('Fenster offen → Textfeld + „Senden“ (Wahl Nachricht/Vorlage); zu → nur der Vorlagen-Wähler', async () => {
    const { WhatsappAntwort } = await import('@/components/os/whatsapp');
    const bis = new Date(Date.now() + 3600_000).toISOString();
    const offen = renderToStaticMarkup(h(WhatsappAntwort, { gespraech: 'wa~pf-x~491', fenster: { offen: true, bis, restMin: 60 }, entwurf: 'Vorschlag von ZOE' }));
    expect(offen).toContain('<textarea'); expect(offen).toContain('Vorschlag von ZOE'); expect(offen).toMatch(/>Senden</); expect(offen).toMatch(/Vorlage/);
    const zu = renderToStaticMarkup(h(WhatsappAntwort, { gespraech: 'wa~pf-x~491', fenster: { offen: false, bis: null, restMin: null } }));
    expect(zu).not.toContain('<textarea'); expect(zu).toContain('data-whatsapp="vorlagen"'); expect(zu).toMatch(/Vorlage senden/);
  });
  it('gesendet wird nur im Klick-Handler (kein Senden beim Laden/Rendern)', () => {
    for (const d of ['WhatsappAntwort.tsx', 'VorlagenWaehler.tsx']) {
      const t = lies(`${ORDNER}/${d}`);
      const effekte = Array.from(t.matchAll(/useEffect\(([\s\S]*?)\}, \[/g)).map(m => m[1]);
      expect(effekte.some(e => e.includes('/api/whatsapp/senden'))).toBe(false);
    }
  });
});

describe('WhatsappKarte', () => {
  it('rendert ohne Daten (lädt), Überschrift und Satz zum 24-h-Fenster', async () => {
    const { WhatsappKarte } = await import('@/components/os/whatsapp');
    const x = renderToStaticMarkup(h(WhatsappKarte, {}));
    expect(x).toContain('WhatsApp Business'); expect(x).toMatch(/lädt/); expect(x).toMatch(/24 Stunden/);
  });
  it('die Anleitung verlinkt nur auf offizielle Meta-Seiten', () => {
    const t = lies(`${ORDNER}/WhatsappKarte.tsx`);
    const hosts = Array.from(t.matchAll(/https:\/\/([a-z0-9.-]+)/g)).map(m => m[1]).filter(x => x !== 'eure');
    expect(hosts.length).toBeGreaterThan(3);
    for (const x of hosts) expect(['developers.facebook.com', 'business.facebook.com'].includes(x), x).toBe(true);
  });
  it('liegt unter Verbindungen', () => { expect(lies('components/os/VerbindungenView.tsx')).toContain('<WhatsappKarte '); });
});

describe('Design-Standard in components/os/whatsapp', () => {
  it('Schrift nie unter 13 px (außer Großbuchstaben-Beschriftung), kein eigenes h1, Bausteine aus ui', () => {
    const funde: string[] = [];
    for (const f of dateien) {
      lies(f).split('\n').forEach((z, i) => { if (/fontSize: (10|10\.5|11|11\.5|12|12\.5)(?![\d.])/.test(z) && !/uppercase|MIKRO|TYP\.mikro/.test(z)) funde.push(`${f}:${i + 1}`); });
      expect(lies(f), f).not.toMatch(/<h1[ >]/);
      expect(lies(f), f).not.toMatch(/from '(\.\.\/)+schlank'/);
    }
    expect(funde).toEqual([]);
  });
});
