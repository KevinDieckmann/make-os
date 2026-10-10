// ─── ZOE-Prompt-Cache (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md S6) ──────────────────────────────────────────────
// Wächter: der System-Text des ZOE-Gesprächs hat einen STABILEN Anfang (Grundauftrag, Regeln, Heads, Werkzeug-Hinweise) ohne Uhrzeit,
// Live-Zustand, Gedächtnis oder Browser-Zusatz — er geht mit Cache-Marke hinaus (`cacheSystem`, `systemStabil`), der flüchtige Teil dahinter.
// Die Werkzeuge gehen in fester Reihenfolge hinaus (dieselbe Auswahl → dieselben Bytes vor dem System-Text). Inhaltlich unverändert: alle
// Sätze stehen weiter im ganzen `system`; die Datenschutz-Regeln (FREMD_REGEL, `fremd()` um den Browser-Zusatz) bleiben genau so.
// Messung: Anteil des stabilen Teils am Prompt (System + Werkzeuge) — Ausgabe im Testprotokoll (für den Bericht). Kein Netz, Modell gestellt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-cache-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_KEY: 'pruef-schluessel-zoe-cache', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Opts = { system: string; systemStabil?: string; cacheSystem?: boolean; tools?: { name: string }[] };
const aufrufe: Opts[] = [];
const askText = vi.fn(async (o: Opts) => { aufrufe.push(o); return { ok: true, status: 200, text: 'Fertig.', stopReason: 'end_turn', raw: { content: [{ type: 'text', text: 'Fertig.' }] }, usage: { ein: 10, aus: 2, cacheLesen: 0, cacheSchreiben: 0 } }; });
vi.mock('@/lib/anthropic', async orig => ({ ...(await orig<typeof import('@/lib/anthropic')>()), hasAnthropicKey: () => true, guthabenLeer: () => false, askText, askStream: askText }));
let zug = 0;
vi.mock('@/lib/zeit', async orig => ({ ...(await orig<typeof import('@/lib/zeit')>()), jetztSatz: () => `ZEITMARKE-${zug}` }));
vi.mock('@/lib/brain', async orig => ({ ...(await orig<typeof import('@/lib/brain')>()), gatherBrain: async () => ({}), promptBrain: () => `LIVEMARKE-${zug}`, kalenderImPrompt: () => false, brainKategorien: () => ['allgemein'] }));
vi.mock('@/lib/zoe/gedaechtnis', async orig => ({ ...(await orig<typeof import('@/lib/zoe/gedaechtnis')>()), lies: async () => [], fuerPrompt: () => `GEDAECHTNISMARKE-${zug}` }));
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => 'GRUNDLAGE AUS DEM BRAIN (fest).' }));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
});
afterAll(async () => {
  await (await import('@/lib/agenten/spur-server')).spurWarten();
  rmSync(ordner, { recursive: true, force: true });
});

async function frage(message: string, extra: Record<string, unknown> = {}): Promise<Opts> {
  zug++;
  const { POST } = await import('@/app/api/kimmi/route');
  const r = await POST(new Request('http://test/api/kimmi', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ message, space: 'business', ...extra }) }));
  expect(r.status).toBe(200);
  return aufrufe.at(-1)!;
}

describe('ZOE-System: stabiler Teil vorn (mit Cache-Marke), flüchtiger dahinter', () => {
  it('cacheSystem an; `system` beginnt mit dem stabilen Teil; der stabile Teil trägt keine Uhrzeit, keinen Live-Zustand, kein Gedächtnis, keinen Browser-Zusatz', async () => {
    const o = await frage('Was steht heute an?', { context: 'BROWSERMARKE' });
    expect(o.cacheSystem).toBe(true);
    expect(typeof o.systemStabil).toBe('string');
    expect(o.system.startsWith(o.systemStabil!)).toBe(true);
    for (const fluechtig of ['ZEITMARKE', 'LIVEMARKE', 'GEDAECHTNISMARKE', 'BROWSERMARKE', 'LIVE-ZUSTAND', 'WAS DU DIR GEMERKT HAST', 'Zusatz vom Client']) expect(o.systemStabil, fluechtig).not.toContain(fluechtig);
    expect(o.systemStabil).not.toMatch(/^ZEIT:/m); // („FREIE ZEIT:“ ist eine feste Regel und bleibt stabil)
    // Inhalt unverändert: alles steht weiter im ganzen Text — der Browser-Zusatz weiter gekapselt, die Fremd-Regel im stabilen Teil.
    for (const x of [`ZEITMARKE-${zug}`, `LIVEMARKE-${zug}`, `GEDAECHTNISMARKE-${zug}`, '<fremde_daten quelle="client">', 'BROWSERMARKE']) expect(o.system).toContain(x);
    expect(o.systemStabil).toContain('<fremde_daten>');
    expect(o.systemStabil).toContain('Du bist ZOE');
    expect(o.systemStabil).toContain('GRUNDLAGE AUS DEM BRAIN (fest).');
  });

  it('zwei Züge hintereinander: derselbe stabile Teil (Byte für Byte), obwohl Uhrzeit, Live-Zustand und Gedächtnis wechseln', async () => {
    const a = await frage('Was steht heute an?');
    const b = await frage('Was steht heute an?');
    expect(a.system).not.toBe(b.system);
    expect(a.systemStabil).toBe(b.systemStabil);
    expect(JSON.stringify(a.tools)).toBe(JSON.stringify(b.tools));
  });

  it('feste Werkzeug-Reihenfolge: gleiche Auswahl in anderer Wortfolge → dieselben Werkzeuge in derselben Reihenfolge', async () => {
    const { zoeWerkzeugWahl } = await import('@/lib/zoe/werkzeug-wahl');
    const a = await frage('Plane einen Termin und lege eine Aufgabe an');
    const b = await frage('Lege eine Aufgabe an und plane einen Termin');
    const namen = (o: Opts) => (o.tools ?? []).map(t => t.name);
    expect(new Set(namen(a))).toEqual(new Set(namen(b)));
    expect(namen(a)).toEqual(namen(b));
    // Vorher folgte die Reihenfolge der Wahl (Bereiche in der Reihenfolge des Textes) — die unterscheidet sich hier wirklich:
    const alle = new Set(namen(a));
    const wahlA = zoeWerkzeugWahl({ text: 'Plane einen Termin und lege eine Aufgabe an', verfuegbar: alle }).namen;
    const wahlB = zoeWerkzeugWahl({ text: 'Lege eine Aufgabe an und plane einen Termin', verfuegbar: alle }).namen;
    expect(wahlA).not.toEqual(wahlB);
    expect(a.systemStabil).toBe(b.systemStabil);
  });

  it('Messung: Anteil des stabilen Teils (System + Werkzeuge) an der Eingabe eines Zugs', async () => {
    const o = await frage('Was steht heute an?');
    const werkzeuge = JSON.stringify(o.tools ?? []).length;
    const stabil = o.systemStabil!.length;
    const variabel = o.system.length - stabil;
    // Grobe Schätzung ~3,5 Zeichen je Token (deutsch, gemischt mit JSON) — nur fürs Protokoll; der echte Wert kommt aus der Lauf-Spur.
    const t = (z: number) => Math.round(z / 3.5);
    console.info(`[zoe-cache] stabil ${stabil} Z. (~${t(stabil)} Tok.) · Werkzeuge ${werkzeuge} Z. (~${t(werkzeuge)} Tok.) · flüchtig ohne Live-Zustand ${variabel} Z. (~${t(variabel)} Tok.)`);
    expect(stabil + werkzeuge).toBeGreaterThan(variabel);
    // Der stabile Teil ist groß genug für den Prompt-Cache (Mindestlänge je Modell 512–1.024 Token, mit Werkzeugen davor).
    expect(t(stabil + werkzeuge)).toBeGreaterThan(1_024);
  });
});
