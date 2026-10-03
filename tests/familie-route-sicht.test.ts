// ─── Familie & Partnerschaft — GET /api/familie: „nur ich“ bleibt privat in der GANZEN Antwort (Praxis-Fund 04.10.) ─
// Vorher bekamen `wichtigeTage`, die Agenda und der Rhythmus den ROHEN Bestand — ein „nur ich“-Tag der Partnerin stand im
// Klartext in `tage` (/os/menschen). Jetzt läuft der Sicht-Filter einmal am Anfang der Route. Erfundene Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-familie-sicht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-familie-sicht';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let route: { GET: (r: Request) => Promise<Response> };
const get = async (person: string) => {
  const r = await route.GET(new Request('http://test/api/familie', { headers: { 'x-make-user': person } }));
  expect(r.status).toBe(200);
  return r.text();
};
const GEHEIM = ['Überraschung planen', 'Ring abholen', 'Heimliches Thema', 'Geheimes Date', 'Geschenkwunsch', 'Danke heimlich'];
const md = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const { startBestand } = await import('@/lib/familie/speicher');
  const k = (id: string, speicher: string, rolle: string, name: string) => ({ id, speicher, email: `${speicher}@test`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' });
  await db.saveJson('konten', { konten: [k('k1', 'kevin', 'inhaber', 'Kevin'), k('k2', 'malin', 'mitglied', 'Malin')], einladungen: [] });
  const bald = new Date(Date.now() + 10 * 864e5);
  const b = (id: string, x: Record<string, unknown>) => ({ id, von: 'malin', am: '2026-09-01', sichtbarkeit: 'nur-ich', ...x });
  await db.saveJson('familie--test-haus', {
    ...startBestand('2026-09-01T00:00:00.000Z'),
    tage: [b('t-geheim', { titel: 'Überraschung planen', art: 'jahrestag', datum: md(bald), vorlaufTage: 14, wer: 'malin', aktion: 'feier', erledigt: [] }),
      { id: 't-offen', von: 'kevin', am: '2026-09-01', titel: 'Hochzeitstag', art: 'jahrestag', datum: md(bald), vorlaufTage: 14, wer: 'beide', aktion: 'feier', erledigt: [] }],
    vereinbarungen: [b('v-geheim', { text: 'Ring abholen', wer: 'malin', faellig: null, status: 'offen' })],
    themen: [b('th-geheim', { titel: 'Heimliches Thema', art: 'loesbar', status: 'offen', hut: 'privat' })],
    dates: [b('d-geheim', { titel: 'Geheimes Date', ideeId: null, datum: '2026-11-12', planer: 'malin', status: 'geplant', neuesErlebnis: true, nachklang: [] })],
    wuensche: [b('w-geheim', { text: 'Geschenkwunsch', kategorie: 'geschenk', status: 'offen' })],
    wertschaetzungen: [b('ws-geheim', { an: 'kevin', text: 'Danke heimlich', datum: '2026-10-01' })],
  });
  route = (await import('@/app/api/familie/route')) as unknown as typeof route;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('GET /api/familie — Sicht-Filter einmal am Anfang', () => {
  it('als Partner: kein Titel/Text privater Einträge der Partnerin — nirgends in der Antwort (tage, agenda, familie …)', async () => {
    const roh = await get('kevin');
    for (const g of GEHEIM) expect(roh, g).not.toContain(g);
    for (const id of ['t-geheim', 'v-geheim', 'th-geheim', 'd-geheim', 'w-geheim', 'ws-geheim']) expect(roh, id).not.toContain(id);
    expect(roh).toContain('Hochzeitstag'); // Gemeinsames bleibt sichtbar
  });
  it('die Anlegerin sieht ihre eigenen Einträge (auch in den wichtigen Tagen und der Agenda)', async () => {
    const d = JSON.parse(await get('malin')) as { tage: { titel: string }[]; agenda: unknown };
    expect(d.tage.map(t => t.titel)).toContain('Überraschung planen');
    expect(JSON.stringify(d.agenda)).toContain('Ring abholen');
  });
});
