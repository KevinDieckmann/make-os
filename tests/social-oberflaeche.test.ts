// ─── Social — Oberfläche rendert mit echter Lage (ohne Browser) ─────────────────────────────────────────────────────────────────────
// Die Lage kommt aus denselben Funktionen wie auf dem Server (`lageAus`), die Ansichten werden statisch gerendert: keine Laufzeitfehler,
// die Leitplanken-Entscheidung und die Analyse stehen sichtbar da, nichts aus einem anderen Kanal taucht auf.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

import { socialAnwenden, type AnwendenKontext } from '@/lib/social/daten';
import { lageAus } from '@/lib/social/server';
import { leereSocial, type SocialDatei } from '@/lib/social/typen';
import type { SocialApi, Lage } from '@/components/os/crm/social/daten';
import { Folgen } from '@/components/os/crm/social/Folgen';
import { Analyse, Formate, Import } from '@/components/os/crm/social/Analyse';

let n = 0;
const ctx: AnwendenKontext = { person: 'pa', jetzt: '2026-10-26T20:00:00.000Z', standVon: x => String(JSON.stringify(x).length), neueId: p => `${p}-o${++n}` };
const schritt = (d: SocialDatei, ops: unknown[]) => { const r = socialAnwenden(d, ops, ctx); if (!r.ok) throw new Error(r.fehler); return r.datei; };

function aufbau(): Lage {
  let d = schritt(leereSocial(), [{ op: 'kanal', eintrag: { name: 'Kanal Eins', kiKanal: true, plattformen: ['tiktok'], leitplanken: { autonomie: 2 } } }, { op: 'kanal', eintrag: { name: 'Kanal Zwei' } }]);
  const [k1, k2] = d.kanaele;
  d = schritt(d, [{ op: 'format', eintrag: { kanalId: k1.id, name: 'Day X', laengeSek: 30 } }]);
  d = schritt(d, [{ op: 'format-freigeben', id: d.formate[0].id, freigeben: true, stand: ctx.standVon(d.formate[0]) }]);
  d = schritt(d, [
    { op: 'folge', eintrag: { kanalId: k1.id, formatId: d.formate[0].id, titel: 'Saubere Folge', status: 'entwurf', skript: 'A short honest episode about building a channel in public with one idea.', hooks: [{ text: 'Day one.' }], cta: 'Follow' } },
    { op: 'folge', eintrag: { kanalId: k1.id, titel: 'Mit Platzhalter', status: 'entwurf', skript: 'We have {{followers}} followers.', hooks: [{ text: 'Numbers.' }] } },
    { op: 'folge', eintrag: { kanalId: k2.id, titel: 'Fremde Folge', skript: 'x', hooks: [{ text: 'y' }] } },
  ]);
  const f = d.folgen[0];
  d = schritt(d, [{ op: 'veroeffentlicht', folgeId: f.id, plattform: 'tiktok', am: '2026-10-25' }, { op: 'messung', folgeId: f.id, messung: { plattform: 'tiktok', am: '2026-10-26', views: 800, halte3s: 40 } }]);
  return lageAus(d, '2026-10-26') as unknown as Lage;
}

const apiAus = (lage: Lage): SocialApi => ({ lage, fehler: null, laden: async () => {}, schreiben: async () => lage, importieren: async () => null, setFehler: () => {} });

describe('Social — Oberfläche', () => {
  const lage = aufbau();
  const api = apiAus(lage);
  const k1 = lage.datei.kanaele[0];
  it('Folgen: zeigt nur den eigenen Kanal, Leitplanken-Entscheidung und Befunde', () => {
    const html = renderToStaticMarkup(createElement(Folgen, { api, kanal: k1 }));
    expect(html).toContain('Mit Platzhalter');
    expect(html).toContain('gesperrt');
    expect(html).not.toContain('Fremde Folge');
    expect(html).not.toContain('Saubere Folge'); // veröffentlicht → nicht unter „In Arbeit“
  });
  it('Analyse: Hook-Signal und Empfehlung bei wenigen Daten', () => {
    const html = renderToStaticMarkup(createElement(Analyse, { api, kanal: k1 }));
    expect(html).toContain('Hook umbauen');
    expect(html).toContain('von 5 Folgen mit Zahlen');
  });
  it('Formate und Import rendern', () => {
    expect(renderToStaticMarkup(createElement(Formate, { api, kanal: k1 }))).toContain('Freigabe zurücknehmen');
    expect(renderToStaticMarkup(createElement(Import, { api, kanal: k1 }))).toContain('Zahlen aus der Plattform importieren');
  });
});
