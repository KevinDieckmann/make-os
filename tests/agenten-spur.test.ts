// ─── Lauf-Spur (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md C9; Entscheidung 10.10.: eigene Spur im Server, nur Metadaten) ──
// Wächter: (a) EINE Kette über ZOE → Head → Mitarbeiter — im Prozess, über die Warteschlange (`Auftrag.spur`) und über einen Sprung
// (`x-make-spur`, nur Dienstweg); (b) nur Metadaten, nie Inhalte; (c) je Bereich ein Bestand, Hash-Kette, Löschfrist; (d) jeder Modellaufruf
// (`askText`) trägt die Spur ins KI-Protokoll und zählt in den Abschnitt; (e) Route „Sicht X bekommt nichts aus Y“; (f) HOI-Befunde;
// (g) Arbeiter-Wecker; (h) nie still kürzen (`inTeilen`). Eigener Datenordner, erfundene Konten, kein Netz (fetch gestellt).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-lauf-spur-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-lauf-spur', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'sk-ant-nur-test', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_KI_ANBIETER_TOR;

import {
  cacheQuote, kettenAus, kostenSicht, perzentil, spurBestand, spurKopfLesen, spurKopfWert, spurMonat, spurSaeubern, summeVon, zoeTempo,
  type SpurEintrag,
} from '@/lib/agenten/spur';
import { inTeilen } from '@/lib/agenten/faeden';

/** Ein langer Text mit Absätzen (≈ 3 Nachrichten) und seine Teile. */
function inTeilenPruef(): { teile: string[]; ganz: string; max: number } {
  const max = 2_000;
  const absatz = (i: number) => `Absatz ${i}: ${'Wort '.repeat(60).trim()}.`;
  const ganz = Array.from({ length: 16 }, (_, i) => absatz(i + 1)).join('\n\n');
  expect(inTeilen('kurz', max)).toEqual(['kurz']);
  return { teile: inTeilen(ganz, max), ganz, max };
}

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', ...extra });
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': p });
const L = (n: number) => `lauf-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const jetztIso = () => new Date().toISOString();
const eintrag = (x: Partial<SpurEintrag> & { lauf: string; kette: string }): SpurEintrag => ({
  zeit: jetztIso(), start: jetztIso(), art: 'zug', agent: 'zoe', person: 'kevin', bereich: 'privat', dauerMs: 1000, aufrufe: 1,
  token: { ein: 100, aus: 50, cacheLesen: 0, cacheSchreiben: 0 }, cent: 1, werkzeuge: 0, ergebnis: 'ok', ...x,
});

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' }), konto('k4', 'kunde', 'mitglied', { haushalt: undefined })], einladungen: [] });
});
afterAll(async () => {
  await (await import('@/lib/agenten/spur-server')).spurWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('(b) nur Metadaten — Säubern, Kopf, Rechnen (rein)', () => {
  it('spurSaeubern lässt nur Kennwörter und Zahlen durch — kein Prompt, kein Titel, kein Name', () => {
    const roh = { ...eintrag({ lauf: L(1), kette: L(1) }), prompt: 'GEHEIM-PROMPT', antwort: 'GEHEIM-ANTWORT', titel: 'Angebot an Firma X', agent: 'Max Mustermann', person: 'Kevin D.', modell: 'claude sonnet 5 <script>' } as Record<string, unknown>;
    const s = spurSaeubern(roh)!;
    const t = JSON.stringify(s);
    for (const verboten of ['GEHEIM', 'Angebot', 'Mustermann', 'Kevin D.', '<script>']) expect(t).not.toContain(verboten);
    expect(s.agent).toBe('unbenannt');
    expect(s.person).toBeNull();
    expect(s.modell).toBeUndefined();
    expect(Object.keys(s).sort()).toEqual(['agent', 'art', 'aufrufe', 'bereich', 'cent', 'dauerMs', 'ergebnis', 'kette', 'lauf', 'person', 'start', 'token', 'werkzeuge', 'zeit'].sort());
    expect(spurSaeubern({ ...roh, lauf: 'lauf-1' })).toBeNull();
    // ohne Bereich: im Zweifel privat
    expect(spurSaeubern({ ...eintrag({ lauf: L(2), kette: L(2) }), bereich: 'egal' } as never)!.bereich).toBe('privat');
  });
  it('Kopf `x-make-spur`: hin und zurück, alles andere ist kein Bezug', () => {
    const b = { kette: L(3), eltern: L(4), bereich: 'business' as const };
    expect(spurKopfLesen(spurKopfWert(b))).toEqual(b);
    for (const x of [null, '', 'x;y;z', `${L(3)};${L(4)}`, `${L(3)};${L(4)};gemischt`, `${L(3)};${L(4)};privat;mehr`]) expect(spurKopfLesen(x)).toBeNull();
  });
  it('Bestand je Bereich und Berliner Monat — nie gemischt', () => {
    const m = spurMonat(new Date());
    expect(spurBestand('privat', m)).toBe(`lauf-spur--privat--${m}`);
    expect(spurBestand('business', m)).toBe(`lauf-spur--business--${m}`);
  });
  it('Ketten, Summen, Perzentile, Cache-Anteil', () => {
    const k = L(10);
    const l = [
      eintrag({ lauf: k, kette: k, art: 'zug', ttftMs: 900, token: { ein: 200, aus: 10, cacheLesen: 800, cacheSchreiben: 0 }, cent: 2, werkzeuge: 2 }),
      eintrag({ lauf: L(11), kette: k, eltern: k, art: 'invoke_agent', agent: 'head:sales', bereich: 'business', cent: 3, werkzeuge: 4, ergebnis: 'gestapelt' }),
      eintrag({ lauf: L(12), kette: k, eltern: L(11), art: 'invoke_agent', agent: 'mitarbeiter:sales:recherche', bereich: 'business', cent: 1, ergebnis: 'fehler' }),
      eintrag({ lauf: L(13), kette: L(13), art: 'chat', agent: 'head:sales', bereich: 'business', ergebnis: 'gesperrt' }),
    ];
    const ketten = kettenAus(l, 1);
    const z = ketten.find(x => x.kette === k)!;
    expect(z.agenten).toEqual(['zoe', 'head:sales', 'mitarbeiter:sales:recherche']);
    expect(z.cent).toBe(6);
    expect(z.werkzeuge).toBe(6);
    expect(z.ergebnis).toBe('fehler');
    expect(z.bereich).toBe('beide');
    expect(z.ttftMs).toBe(900);
    const s = summeVon(l, 1);
    expect(s.laeufe).toBe(4);
    expect(s.ketten).toBe(2);
    expect(s.fehlerQuote).toBeCloseTo(1 / 3, 3); // die Sperre zählt nicht
    expect(cacheQuote({ ein: 200, aus: 0, cacheLesen: 800, cacheSchreiben: 0 })).toBe(0.8);
    expect(cacheQuote({ ein: 0, aus: 5, cacheLesen: 0, cacheSchreiben: 0 })).toBeNull();
    expect(perzentil([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(perzentil([5, 1, 3, 2, 4], 95)).toBe(5);
    expect(perzentil([], 50)).toBeNull();
    expect(zoeTempo(l)).toMatchObject({ zuege: 1, ttftP50: 900, cacheQuote: 0.8 });
  });
  it('kostenSicht: eigene Abschnitte; der Inhaber zusätzlich NUR Summen der Instanz (keine fremden Kennungen, Personen, Agenten)', () => {
    const l = [
      eintrag({ lauf: L(20), kette: L(20), person: 'kevin', bereich: 'privat' }),
      eintrag({ lauf: L(21), kette: L(21), person: 'malin', bereich: 'privat', agent: 'head:gesundheit' }),
      eintrag({ lauf: L(22), kette: L(22), person: 'malin', bereich: 'business' }),
    ];
    const jetzt = new Date();
    const mitglied = kostenSicht(l, { person: 'malin', bereiche: ['business'], inhaber: false, jetzt, kurs: 1 });
    expect(mitglied.instanz).toBeUndefined();
    expect(JSON.stringify(mitglied)).not.toContain(L(20));
    expect(JSON.stringify(mitglied)).not.toContain(L(21)); // Privat gar nicht in dieser Sicht
    expect(mitglied.eigene.ketten.map(k => k.kette)).toEqual([L(22)]);
    const inhaber = kostenSicht(l, { person: 'kevin', bereiche: ['privat', 'business'], inhaber: true, jetzt, kurs: 1 });
    const t = JSON.stringify(inhaber);
    for (const fremd of [L(21), L(22), 'malin', 'gesundheit']) expect(t).not.toContain(fremd);
    expect(inhaber.instanz?.tage30.privat?.laeufe).toBe(2);
    expect(inhaber.instanz?.tage30.business?.laeufe).toBe(1);
  });
});

describe('(h) nie still kürzen — lange Antworten in Teilen', () => {
  it('innerhalb der Grenze unverändert; darüber Teile ≤ Grenze, die zusammen den ganzen Text tragen', () => {
    const { teile, ganz, max } = inTeilenPruef();
    expect(teile.length).toBeGreaterThan(1);
    for (const t of teile) expect(t.length).toBeLessThanOrEqual(max);
    expect(teile[0]).toContain(`Teil 1 von ${teile.length}`);
    expect(teile.at(-1)).toContain(`Teil ${teile.length} von ${teile.length}`);
    // Nichts verloren: ohne die Marken ergeben die Teile wieder den Text (bis auf Leerraum an den Schnitten).
    const zurueck = teile.map(t => t.replace(/_\(Teil \d+ von \d+[^)]*\)_/g, '')).join(' ').replace(/\s+/g, ' ').trim();
    expect(zurueck).toBe(ganz.replace(/\s+/g, ' ').trim());
  });
  it('delegation.ts, gespraech.ts und zoe-faden.ts kürzen Agenten-Antworten nicht mehr mit slice(0, nachrichtZeichen)', async () => {
    const fs = await import('node:fs');
    for (const d of ['lib/agenten/delegation.ts', 'lib/agenten/gespraech.ts']) {
      const t = fs.readFileSync(path.join(__dirname, '..', d), 'utf8').split('\n').filter(z => !z.trim().startsWith('//')).join('\n');
      expect(t, d).not.toMatch(/\.slice\(0,\s*GRENZEN\.nachrichtZeichen\)/);
    }
  });
});

describe('(a)(c) EINE Kette — im Prozess, über die Warteschlange und über einen Sprung; je Bereich ein Bestand', () => {
  it('Kind-Abschnitt hängt an den Eltern, jeder zählt nur seine eigenen Modellaufrufe; Bereiche getrennt abgelegt', async () => {
    const s = await import('@/lib/agenten/spur-server');
    const ids: { zug?: string; chat?: string; kette?: string } = {};
    await s.mitSpur({ art: 'zug', agent: 'zoe', person: 'kevin', bereich: 'privat' }, async o => {
      ids.zug = o.lauf; ids.kette = o.kette;
      await s.modellAufruf({ person: 'kevin', zweck: 'zoe-gespraech', modell: 'claude-sonnet-5', usage: { ein: 1000, aus: 100, cacheLesen: 4000, cacheSchreiben: 0 }, ergebnis: 'ok', beginn: Date.now() });
      await s.mitSpur({ art: 'chat', agent: 'head:sales', person: 'kevin', bereich: 'business' }, async k => {
        ids.chat = k.lauf;
        expect(k.kette).toBe(o.lauf);
        expect(k.eltern).toBe(o.lauf);
        await s.modellAufruf({ person: 'kevin', zweck: 'agent-sales', modell: 'claude-sonnet-5', usage: { ein: 300, aus: 30, cacheLesen: 0, cacheSchreiben: 0 }, ergebnis: 'ok', beginn: Date.now() });
      }, () => ({ ergebnis: 'ok', werkzeuge: 1 }));
    }, () => ({ ergebnis: 'gestapelt', werkzeuge: 2 }));
    await s.spurWarten();
    const alle = await s.spurLesen({ bereiche: ['privat', 'business'] });
    const zug = alle.find(e => e.lauf === ids.zug)!;
    const chat = alle.find(e => e.lauf === ids.chat)!;
    expect(zug).toMatchObject({ kette: ids.zug, art: 'zug', bereich: 'privat', aufrufe: 1, werkzeuge: 2, ergebnis: 'gestapelt', token: { ein: 1000, aus: 100, cacheLesen: 4000, cacheSchreiben: 0 } });
    expect(zug.eltern).toBeUndefined();
    expect(chat).toMatchObject({ kette: ids.zug, eltern: ids.zug, art: 'chat', bereich: 'business', aufrufe: 1, token: { ein: 300, aus: 30 } });
    expect(zug.cent).toBeGreaterThan(0);
    // je Bereich ein Bestand: der Business-Abschnitt steht NICHT im Privat-Bestand und umgekehrt
    const m = spurMonat(new Date());
    const privat = (await db.loadJson<{ eintraege: SpurEintrag[] }>(spurBestand('privat', m)))!.eintraege;
    const business = (await db.loadJson<{ eintraege: SpurEintrag[] }>(spurBestand('business', m)))!.eintraege;
    expect(privat.every(e => e.bereich === 'privat')).toBe(true);
    expect(business.every(e => e.bereich === 'business')).toBe(true);
    expect(privat.some(e => e.lauf === ids.chat)).toBe(false);
  });

  it('gesperrter Modellaufruf (Datenschutz/Budget) → Ausgang „gesperrt“, nicht „fehler“', async () => {
    const s = await import('@/lib/agenten/spur-server');
    let lauf = '';
    await s.mitSpur({ art: 'chat', agent: 'head:sales', person: 'kevin', bereich: 'business' }, async o => {
      lauf = o.lauf;
      await s.modellAufruf({ person: 'kevin', zweck: 'agent-sales', modell: 'claude-sonnet-5', ergebnis: 'gesperrt', beginn: Date.now() });
    }, () => ({ ergebnis: 'fehler' }));
    await s.spurWarten();
    expect((await s.spurLesen({ bereiche: ['business'] })).find(e => e.lauf === lauf)?.ergebnis).toBe('gesperrt');
  });

  it('Warteschlange: `reihe()` im Abschnitt merkt sich die Kette (nicht in der Eingabe/im Schlüssel); der Lauf stellt sie wieder her', async () => {
    const s = await import('@/lib/agenten/spur-server');
    const { reihe, lies } = await import('@/lib/zoe/auftraege');
    let zug = '';
    let auftragId = '';
    await s.mitSpur({ art: 'zug', agent: 'zoe', person: 'kevin', bereich: 'business' }, async o => {
      zug = o.lauf;
      const r = await reihe([{ art: 'agent', name: 'faden', auftrag: '{"art":"faden","fadenId":"fd-x"}', eingabe: { art: 'faden', fadenId: 'fd-x' }, person: 'kevin' }]);
      auftragId = r.angelegt[0].id;
    }, () => ({ ergebnis: 'ok' }));
    const a = (await lies()).find(x => x.id === auftragId)!;
    expect(a.spur).toEqual({ kette: zug, eltern: zug, bereich: 'business' });
    expect(JSON.stringify(a.eingabe)).not.toContain('lauf-');
    expect(a.schluessel).not.toContain('lauf-');
    // Ohne Abschnitt: kein Bezug (Takt).
    const ohne = await reihe([{ art: 'agent', name: 'faden', auftrag: '{"art":"faden","fadenId":"fd-y"}', eingabe: { art: 'faden', fadenId: 'fd-y' }, person: 'kevin' }]);
    expect(ohne.angelegt[0].spur).toBeUndefined();
    // Der Lauf aus der Warteschlange: Head-Lauf hängt sich an den ZOE-Zug.
    let head = { kette: '', eltern: '' as string | undefined };
    await s.mitSpurBezug(a.spur, 'kevin', () => s.mitSpur({ art: 'invoke_agent', agent: 'head:sales', person: 'kevin', bereich: 'business' }, async o => { head = { kette: o.kette, eltern: o.eltern }; }, () => ({ ergebnis: 'ok' })));
    expect(head).toEqual({ kette: zug, eltern: zug });
  });

  it('Sprung: `x-make-spur` gilt nur auf dem Dienstweg (`kiAus`, `spurAusAnfrage`); ein Modellaufruf ohne offenen Abschnitt wird ein Abschnitt „modell“', async () => {
    const s = await import('@/lib/agenten/spur-server');
    const { kiAus } = await import('@/lib/datenschutz/ki-lauf');
    const b = { kette: L(40), eltern: L(41), bereich: 'privat' as const };
    const kopf = { 'x-make-spur': spurKopfWert(b) };
    expect(s.spurAusAnfrage(new Request('http://innen/x', { headers: { ...dienst('kevin'), ...kopf } }))).toEqual(b);
    expect(s.spurAusAnfrage(new Request('http://innen/x', { headers: { ...sitzung('kevin'), ...kopf } }))).toBeNull();
    expect(kiAus(new Request('http://innen/x', { headers: { ...dienst('kevin'), ...kopf } }), ['allgemein']).spur).toEqual(b);
    expect(kiAus(new Request('http://innen/x', { headers: { ...sitzung('kevin'), ...kopf } }), ['allgemein']).spur).toBeUndefined();
    await s.modellAufruf({ bezug: b, person: 'kevin', zweck: 'research', modell: 'claude-sonnet-5', usage: { ein: 10, aus: 5, cacheLesen: 0, cacheSchreiben: 0 }, ergebnis: 'ok', beginn: Date.now() });
    await s.spurWarten();
    const e = (await s.spurLesen({ bereiche: ['privat'] })).find(x => x.kette === L(40))!;
    expect(e).toMatchObject({ art: 'modell', agent: 'research', eltern: L(41), aufrufe: 1, person: 'kevin' });
  });
});

describe('(d) askText: KI-Protokoll trägt die Spur, der Abschnitt zählt Token und Kosten; System in zwei Blöcken', () => {
  it('ein echter askText im Abschnitt (fetch gestellt)', async () => {
    const koerper: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: { body?: string }) => {
      koerper.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hallo.' }], stop_reason: 'end_turn', usage: { input_tokens: 120, output_tokens: 8, cache_read_input_tokens: 2400, cache_creation_input_tokens: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    try {
      const { askText } = await import('@/lib/anthropic');
      const s = await import('@/lib/agenten/spur-server');
      let lauf = '';
      const r = await s.mitSpur({ art: 'zug', agent: 'zoe', person: 'kevin', bereich: 'privat' }, async o => {
        lauf = o.lauf;
        return askText({ system: 'STABIL-GRUNDAUFTRAG\n\nZEIT: jetzt', systemStabil: 'STABIL-GRUNDAUFTRAG', cacheSystem: true, user: 'Hallo', zweck: 'zoe-gespraech', ki: { lauf: 'gespraech', person: 'kevin', kategorien: ['allgemein'] } });
      }, x => ({ ergebnis: x.ok ? 'ok' : 'fehler' }));
      expect(r.ok).toBe(true);
      // System in zwei Blöcken: der stabile mit Cache-Marke, der flüchtige ohne.
      expect(koerper[0].system).toEqual([{ type: 'text', text: 'STABIL-GRUNDAUFTRAG', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'ZEIT: jetzt' }]);
      await s.spurWarten();
      const e = (await s.spurLesen({ bereiche: ['privat'] })).find(x => x.lauf === lauf)!;
      expect(e).toMatchObject({ aufrufe: 1, token: { ein: 120, aus: 8, cacheLesen: 2400, cacheSchreiben: 0 }, modell: expect.any(String) });
      expect(e.cent).toBeGreaterThan(0);
      // KI-Protokoll: dieselben Kennungen (nur Metadaten).
      await new Promise(r2 => setTimeout(r2, 50));
      const tag = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const prot = await db.loadJson<{ eintraege: { spur?: string; kette?: string }[] }>(`ki-protokoll--${tag}`);
      expect(prot?.eintraege.some(z => z.spur === lauf && z.kette === lauf)).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
  it('systemFuerApi: ohne Cache ein Text; ohne passenden stabilen Anfang ein Block (wie bisher)', async () => {
    const { systemFuerApi } = await import('@/lib/anthropic');
    expect(systemFuerApi({ system: 'A\n\nB', systemStabil: 'A' })).toBe('A\n\nB');
    expect(systemFuerApi({ system: 'A\n\nB', cacheSystem: true })).toEqual([{ type: 'text', text: 'A\n\nB', cache_control: { type: 'ephemeral' } }]);
    expect(systemFuerApi({ system: 'X\n\nB', systemStabil: 'A', cacheSystem: true })).toEqual([{ type: 'text', text: 'X\n\nB', cache_control: { type: 'ephemeral' } }]);
    expect(systemFuerApi({ system: 'A', systemStabil: 'A', cacheSystem: true })).toEqual([{ type: 'text', text: 'A', cache_control: { type: 'ephemeral' } }]);
  });
});

describe('(c) Hash-Kette, Löschfrist, Register', () => {
  it('die Spur-Bestände hängen in der Protokoll-Kette (Familie lauf-spur) und sind unverändert', async () => {
    const k = await import('@/lib/store/protokoll-kette');
    expect(k.MONATS_FAMILIEN).toContain('lauf-spur');
    const p = await k.kettenPruefen();
    expect(p.familien['lauf-spur']?.dateien ?? 0).toBeGreaterThanOrEqual(2);
    expect(p.familien['lauf-spur']?.fehler).toBe(0);
  });
  it('Aufbewahrung 12 Monate: ältere Monate werden geleert, der Vermerk bleibt', async () => {
    const s = await import('@/lib/agenten/spur-server');
    const { anhaengenVerkettet } = await import('@/lib/store/protokoll-kette');
    await anhaengenVerkettet('lauf-spur--privat--2024-01', [eintrag({ lauf: L(50), kette: L(50), zeit: '2024-01-15T10:00:00.000Z', start: '2024-01-15T10:00:00.000Z' }) as unknown as Record<string, unknown>]);
    const geleert = await s.spurAufraeumen(new Date());
    expect(geleert).toContain('lauf-spur--privat--2024-01');
    const d = await db.loadJson<{ eintraege: unknown[]; bereinigt?: { eintraege: number } }>('lauf-spur--privat--2024-01');
    expect(d?.eintraege).toEqual([]);
    expect(d?.bereinigt?.eintraege).toBe(1);
  });
  it('Speicher-Register: je Bereich ein Bestand mit Angaben', async () => {
    const { bereichVonBestand, registerEintrag } = await import('@/lib/crm/speicher-register');
    expect(bereichVonBestand('lauf-spur--privat--2026-10')).toBe('privat');
    expect(bereichVonBestand('lauf-spur--business--2026-10')).toBe('business');
    for (const b of ['lauf-spur--privat--2026-10', 'lauf-spur--business--2026-10']) {
      const e = registerEintrag(b)!;
      expect(e.rechtsgrundlage).toMatch(/Art\. 6/);
      expect(e.loeschfrist).toMatch(/12 Monate/);
      expect(e.art15).toMatch(/\/api\/agenten\/kosten/);
    }
  });
});

describe('(e) GET /api/agenten/kosten — Sicht X bekommt nichts aus Y', () => {
  const K = { kp: L(60), kb: L(61), mp: L(62), mb: L(63) };
  beforeAll(async () => {
    const s = await import('@/lib/agenten/spur-server');
    s.spurSchreiben(eintrag({ lauf: K.kp, kette: K.kp, person: 'kevin', bereich: 'privat', agent: 'head:gesundheit', art: 'chat' }));
    s.spurSchreiben(eintrag({ lauf: K.kb, kette: K.kb, person: 'kevin', bereich: 'business' }));
    s.spurSchreiben(eintrag({ lauf: K.mp, kette: K.mp, person: 'malin', bereich: 'privat', ttftMs: 1200 }));
    s.spurSchreiben(eintrag({ lauf: K.mb, kette: K.mb, person: 'malin', bereich: 'business' }));
    await s.spurWarten();
  });
  const holen = async (wer: Record<string, string>, q = '') => {
    const { GET } = await import('@/app/api/agenten/kosten/route');
    const r = await GET(new Request(`http://test/api/agenten/kosten${q}`, { headers: wer }));
    return { status: r.status, text: await r.text() };
  };
  it('Mitglied sieht nur die eigenen Ketten — nichts vom Inhaber, keine Summen der Instanz', async () => {
    const r = await holen(sitzung('malin'));
    expect(r.status).toBe(200);
    expect(r.text).toContain(K.mp);
    expect(r.text).toContain(K.mb);
    for (const fremd of [K.kp, K.kb, 'gesundheit']) expect(r.text).not.toContain(fremd);
    expect(JSON.parse(r.text).instanz).toBeUndefined();
  });
  it('`space=business` liefert keinen Privat-Abschnitt, `space=privat` keinen Business-Abschnitt', async () => {
    const b = await holen(sitzung('malin'), '?space=business');
    expect(b.text).toContain(K.mb);
    expect(b.text).not.toContain(K.mp);
    expect(JSON.parse(b.text).bereiche).toEqual(['business']);
    const p = await holen(sitzung('malin'), '?space=privat');
    expect(p.text).toContain(K.mp);
    expect(p.text).not.toContain(K.mb);
    expect((await holen(sitzung('malin'), '?space=quatsch')).status).toBe(400);
  });
  it('Konto „nur Business“: Privat wird nicht einmal geladen — auch nicht mit space=privat', async () => {
    const r = await holen(sitzung('partner'));
    expect(JSON.parse(r.text).bereiche).toEqual(['business']);
    for (const fremd of Object.values(K)) expect(r.text).not.toContain(fremd);
    const p = await holen(sitzung('partner'), '?space=privat');
    expect(JSON.parse(p.text).bereiche).toEqual([]);
  });
  it('Inhaber: eigene Ketten + Summen der Instanz — ohne fremde Kennungen, Personen oder Agenten', async () => {
    const r = await holen(sitzung('kevin'));
    expect(r.text).toContain(K.kp);
    expect(r.text).toContain(K.kb);
    for (const fremd of [K.mp, K.mb, 'malin']) expect(r.text).not.toContain(fremd);
    const j = JSON.parse(r.text);
    expect(j.instanz.tage30.privat.laeufe).toBeGreaterThanOrEqual(2);
    expect(j.instanz.tage30.business.laeufe).toBeGreaterThanOrEqual(2);
  });
  it('Testkunde ohne Haushalt und Dienstweg: 403', async () => {
    expect((await holen(sitzung('kunde'))).status).toBe(403);
    expect((await holen(dienst('kevin'))).status).toBe(403);
  });
});

describe('(f) Head of IT: Befunde aus der Lauf-Spur (nur Zahlen, nur gelb)', () => {
  it('Fehlerquote über 3 %, langsames erstes Wort, wenig Zwischenspeicher → gelb; zu wenig Läufe → grün', async () => {
    const { laufSpurBefunde } = await import('@/lib/hoi/lage');
    expect(laufSpurBefunde(null)).toEqual([]);
    expect(laufSpurBefunde({ laeufe7d: 0, fehlerQuote7d: null, zoeZuege7d: 0, zoeTtftP95Ms: null, zoeDauerP95Ms: null, zoeCacheQuote: null })).toEqual([]);
    const gut = laufSpurBefunde({ laeufe7d: 50, fehlerQuote7d: 0.02, zoeZuege7d: 30, zoeTtftP95Ms: 2000, zoeDauerP95Ms: 9000, zoeCacheQuote: 0.7 });
    expect(gut.map(b => b.ampel)).toEqual(['gruen', 'gruen']);
    const schlecht = laufSpurBefunde({ laeufe7d: 50, fehlerQuote7d: 0.1, zoeZuege7d: 30, zoeTtftP95Ms: 8000, zoeDauerP95Ms: 9000, zoeCacheQuote: 0.2 });
    expect(schlecht.map(b => b.ampel)).toEqual(['gelb', 'gelb']);
    expect(laufSpurBefunde({ laeufe7d: 5, fehlerQuote7d: 0.6, zoeZuege7d: 3, zoeTtftP95Ms: 9000, zoeDauerP95Ms: 9000, zoeCacheQuote: 0 }).map(b => b.ampel)).toEqual(['gruen', 'gruen']);
  });
});

describe('(g) Arbeiter-Wecker: lange Abfrage statt bis zu 30 s Pause', () => {
  it('`reihe()` weckt eine wartende Abfrage sofort; ohne Auftrag endet sie nach der Wartezeit', async () => {
    const { POST } = await import('@/app/api/zoe/auftraege/nimm/route');
    const { reihe, nimm } = await import('@/lib/zoe/auftraege');
    await nimm(16, 60); // alles Offene aus den Tests oben weg
    const nimmLang = (ms: number) => POST(new Request('http://innen/api/zoe/auftraege/nimm', { method: 'POST', headers: dienst('kevin'), body: JSON.stringify({ anzahl: 2, pacht: 60, wartenMs: ms }) }));
    const t0 = Date.now();
    const leer = await (await nimmLang(150)).json() as { auftraege: unknown[]; gewartet?: boolean };
    expect(leer).toMatchObject({ auftraege: [], gewartet: true });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(120);
    const t1 = Date.now();
    const offen = nimmLang(10_000);
    setTimeout(() => { void reihe([{ art: 'agent', name: 'faden', auftrag: '{"art":"faden","fadenId":"fd-wecker"}', eingabe: { art: 'faden', fadenId: 'fd-wecker' }, person: 'kevin' }]); }, 60);
    const j = await (await offen).json() as { auftraege: { eingabe: { fadenId: string } }[] };
    expect(j.auftraege.map(a => a.eingabe.fadenId)).toEqual(['fd-wecker']);
    expect(Date.now() - t1).toBeLessThan(5_000);
  });
  it('ohne `wartenMs` wie bisher (sofort, ohne `gewartet`); der Wecker liegt am globalThis', async () => {
    const { POST } = await import('@/app/api/zoe/auftraege/nimm/route');
    const r = await (await POST(new Request('http://innen/api/zoe/auftraege/nimm', { method: 'POST', headers: dienst('kevin'), body: JSON.stringify({ anzahl: 1 }) }))).json() as { gewartet?: boolean };
    expect(r.gewartet).toBeUndefined();
    expect((globalThis as { __makeosArbeiterWecker?: unknown }).__makeosArbeiterWecker).toBeTruthy();
    expect((await POST(new Request('http://innen/api/zoe/auftraege/nimm', { method: 'POST', headers: sitzung('kevin'), body: '{}' }))).status).toBe(403);
  });
});

describe('Datenordner: keine Inhalte in der Spur', () => {
  it('kein Spur-Bestand trägt Text — nur Kennungen, Kennwörter, Zahlen', async () => {
    await (await import('@/lib/agenten/spur-server')).spurWarten();
    const namen = readdirSync(ordner).filter(n => /^lauf-spur--/.test(n)).map(n => n.slice(0, -5));
    expect(namen.length).toBeGreaterThan(0);
    for (const n of namen) {
      const d = await db.loadJson<{ eintraege: Record<string, unknown>[] }>(n);
      for (const e of d?.eintraege ?? []) {
        for (const [k, v] of Object.entries(e)) {
          if (typeof v === 'string') expect(v, `${n}.${k}`).toMatch(/^[a-z0-9:_.@/T+-]{1,120}$|^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/i);
        }
      }
    }
  });
});
