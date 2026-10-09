// ─── Sport · Plan-Baukasten in der Oberfläche + Kalender-Weg (09.10.2026) ───────────────────────────────────────────────
// Statisches Rendern mit erfundenen Werten; der Kalender-Block geht NUR über `blockAnlegen` (gemockt), nur per Klick der Person.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-sport-plan-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-sport-plan';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
const kal = vi.hoisted(() => ({ angelegt: [] as unknown[], vorhanden: [] as { date: string; titel: string; startMin: number }[] }));
vi.mock('@/lib/planung/bloecke-server', () => ({
  planBloeckeLesen: async () => kal.vorhanden,
  blockAnlegen: async (person: string, b: unknown, wer: unknown) => { kal.angelegt.push({ person, b, wer }); return { uid: 'uid-1' }; },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/sport' }));

import { localDay } from '@/lib/zeit';
import { tagPlus, montagVon } from '@/lib/sport/pace';
import { leererStand, type SportStand } from '@/lib/sport/modell';
import { tagAus } from '@/lib/sport/plan-bau';
import { taperTage } from '@/lib/sport/wettkampf';

const HEUTE = localDay();
const RENNEN = tagPlus(HEUTE, 8);
const ZIEL = { id: 'z-hm', art: 'lauf' as const, titel: 'Halbmarathon Prüfstadt', datum: RENNEN, distanzKm: 21.1, zielzeitSek: 7200, angelegt: 'x', referenz: { distanzKm: 10, sek: 3450 } };
const STAND: SportStand = {
  ...leererStand(), einstieg: { fertig: true }, ziele: [ZIEL],
  tage: { [HEUTE]: tagAus([{ id: 'h-1', sparte: 'lauf', typ: 'intervall', dauerMin: 45 }]) },
};

afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Ziele & Plan (statisch gerendert)', () => {
  it('Wettkampf zuerst: Countdown, Ziel und Prognose ehrlich nebeneinander, Taper zum Übernehmen', async () => {
    const { ZielePlan } = await import('@/components/os/sport/ZielePlan');
    const html = renderToStaticMarkup(createElement(ZielePlan, { stand: STAND, heute: HEUTE, vitals: {}, schicke: async () => true, onReiter: () => {} }));
    expect(html).toContain('Nächster Wettkampf');
    expect(html).toContain('Halbmarathon Prüfstadt');
    expect(html).toContain('8 Tage bis zum Start');
    expect(html).toContain('5:41 min/km');
    expect(html).toContain('Prognose 2:06:53');
    expect(html).toContain('sehr ambitioniert');
    expect(html).toContain('Taper-Woche übernehmen');
    expect(html).toContain('Diese Woche');
    expect(html).toContain('Wochenplan bauen');
    expect(html).not.toMatch(/Dein Ziel/); // die Ziel-Karte weicht dem Wettkampf (eine getönte Karte je Ansicht)
  });
  it('Tagesform rot → Hinweis an der Einheit von heute; „Erledigt“ als Hauptaktion', async () => {
    const { DieseWoche } = await import('@/components/os/sport/DieseWoche');
    const html = renderToStaticMarkup(createElement(DieseWoche, { stand: STAND, heute: HEUTE, vitals: { [HEUTE]: { recovery: 30 } }, schicke: async () => true }));
    expect(html).toContain('Lauf · Intervall · 45 min');
    expect(html).toContain('tauschen oder leichter');
    expect(html).toContain('Erledigt');
    const gruen = renderToStaticMarkup(createElement(DieseWoche, { stand: STAND, heute: HEUTE, vitals: { [HEUTE]: { recovery: 80 } }, schicke: async () => true }));
    expect(gruen).not.toContain('tauschen oder leichter');
  });
  it('Entlastung nach HRV-Trend erscheint als Vorschlag mit „Diese Woche leichter“', async () => {
    const { DieseWoche } = await import('@/components/os/sport/DieseWoche');
    const vitals = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [tagPlus(HEUTE, -i), i < 3 ? { hrv: 40, ruhepuls: 58 } : { hrv: 60, ruhepuls: 50 }]));
    const html = renderToStaticMarkup(createElement(DieseWoche, { stand: STAND, heute: HEUTE, vitals, schicke: async () => true }));
    expect(html).toContain('Entlastung vorschlagen');
    expect(html).toContain('Diese Woche leichter');
  });
  it('mit übernommenem Taper: „im Plan“ und zurücknehmen', async () => {
    const { WettkampfKarte } = await import('@/components/os/sport/WettkampfKarte');
    const mit = { ...STAND, tage: { ...STAND.tage, ...taperTage(ZIEL, HEUTE) } };
    const html = renderToStaticMarkup(createElement(WettkampfKarte, { stand: mit, heute: HEUTE, schicke: async () => true }));
    expect(html).toContain('im Plan');
    expect(html).toContain('Taper zurücknehmen');
  });
  it('Baukasten und Block rendern ohne Einheiten; Startvorlagen stehen zur Wahl', async () => {
    const { WochenBaukasten, BlockKarte } = await import('@/components/os/sport/PlanBaukasten');
    expect(renderToStaticMarkup(createElement(WochenBaukasten, { stand: leererStand(), heute: HEUTE, schicke: async () => true }))).toContain('Noch keine eigene Vorlage');
    expect(renderToStaticMarkup(createElement(BlockKarte, { stand: leererStand(), heute: HEUTE, schicke: async () => true }))).toContain('Ohne Block gilt jede Woche die Standardwoche');
    const mitBlock = { ...leererStand(), block: { id: 'b', start: montagVon(HEUTE), wochen: [{ vorlage: 'standard', phase: 'aufbau' as const }, { vorlage: 'standard', phase: 'taper' as const }] } };
    expect(renderToStaticMarkup(createElement(BlockKarte, { stand: mitBlock, heute: HEUTE, schicke: async () => true }))).toContain('Woche 1 von 2');
  });
});

describe('POST /api/sport/kalender — nur die Person, nur über blockAnlegen', () => {
  type Mod = { POST: (r: Request) => Promise<Response> };
  let route: Mod;
  const post = (body: unknown, kopf: Record<string, string>) => route.POST(new Request('http://test/api/sport/kalender', { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body: JSON.stringify(body) }));
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const { speicherFuer } = await import('@/lib/zoe/raum');
    await db.saveJson(speicherFuer('sport', 'pia'), STAND);
    route = (await import('@/app/api/sport/kalender/route')) as unknown as Mod;
  });
  it('ohne Person 401, Dienstweg 403 (ZOE/Takt legen nie Trainings-Blöcke an)', async () => {
    expect((await post({ datum: HEUTE, einheitId: 'h-1', startMin: 420 }, {})).status).toBe(401);
    expect((await post({ datum: HEUTE, einheitId: 'h-1', startMin: 420 }, { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'pia' })).status).toBe(403);
    expect(kal.angelegt).toHaveLength(0);
  });
  it('unbekannte Einheit 404, kaputte Eingabe 400', async () => {
    expect((await post({ datum: HEUTE, einheitId: 'gibts-nicht', startMin: 420 }, { 'x-make-user': 'pia' })).status).toBe(404);
    expect((await post({ datum: 'heute', einheitId: 'h-1', startMin: 420 }, { 'x-make-user': 'pia' })).status).toBe(400);
    expect((await post({ datum: HEUTE, einheitId: 'h-1', startMin: 9999 }, { 'x-make-user': 'pia' })).status).toBe(400);
  });
  it('legt EINEN Block der Art „routine“ im Kalender der Person an — neutraler Titel, Dauer aus dem Plan; doppelt → 409', async () => {
    const r = await post({ datum: HEUTE, einheitId: 'h-1', startMin: 420 }, { 'x-make-user': 'pia' });
    expect(r.status).toBe(200);
    expect(kal.angelegt).toEqual([{ person: 'pia', b: { date: HEUTE, startMin: 420, dauerMin: 45, titel: 'Training · Lauf · Intervall', art: 'routine' }, wer: { art: 'person', person: 'pia' } }]);
    kal.vorhanden = [{ date: HEUTE, titel: 'Training · Lauf · Intervall', startMin: 420 }];
    expect((await post({ datum: HEUTE, einheitId: 'h-1', startMin: 420 }, { 'x-make-user': 'pia' })).status).toBe(409);
    expect(kal.angelegt).toHaveLength(1);
  });
  it('eine andere Person findet die Einheit nicht (eigener Bestand)', async () => {
    expect((await post({ datum: HEUTE, einheitId: 'h-1', startMin: 420 }, { 'x-make-user': 'olaf' })).status).toBe(404);
  });
});
