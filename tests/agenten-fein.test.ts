// ─── Agenten-Bereich: Feinschliff nach der Gegenprüfung (09.10. nachts) — Wächter ──────────────────────────────────────────────────
//   1. Kontext Familie/Ernährung: Familie nur über die EINE Filterstelle (`familieFuerPerson`) — „nur ich“ und ungeteilte Reflexionen der
//      anderen Person nie, nie Gefühle; Ernährung: Profile nur über `profileFuerBetrachter`, Gesundheit nur mit Einwilligung.
//   2. Kennzahlen im Kopf: Traktion, Privat (nur mit privatem Finanzzugang), Gesundheit (nur eigene, nur mit (a)) — Fehler → Wert fehlt.
//   3. (a) voller Thread endet sichtbar · (b) Thread-Kosten (US-Cent) gegen Budget (Euro-Cent) über EINE Umrechnung · (c) Hintergrundaufgabe
//      bei ZOE → 400 · (d) meine_aufgaben / projekt_unterlagen / datei_lesen nur im Bereich des Heads.
//   4. Markttraktion-Takt mit Inhalte-Ausnahme bzw. Glocke; Prospect-Agent schreibt per PATCH mit Stand.
// Eigener Datenordner, erfundene Konten (`@example.invalid`), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-fein-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-fein', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel',
    MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault'),
    NEXT_PUBLIC_MAKE_OS_CRM_TEAM: JSON.stringify([{ id: 'person-a', name: 'Anna', verantwortet: ['sales'] }, { id: 'person-b', name: 'Bert', verantwortet: ['marketing', 'event'] }]),
  });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_MODEL', 'TELEGRAM_BOT_TOKEN', 'MAKE_OS_KI_ANBIETER_TOR', 'MAKE_OS_KI_USD_EUR']) delete process.env[k];
  return o;
});
const gesendet = vi.hoisted(() => [] as { person: string; text: string; opt: unknown }[]);
vi.mock('@/lib/brain', async orig => ({ ...(await orig<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})) }));
// Indizes: die vorhandenen Lesewege als Fake — geprüft wird, WER sie wann fragt (Sicht), nicht ihre Rechnung.
const idx = (id: string, anzeige: string) => ({ saeulen: [{ kennzahlen: [{ id, anzeige, ampel: 'gruen' as const }] }] });
vi.mock('@/lib/crm/traktion-index', async orig => ({ ...(await orig<typeof import('@/lib/crm/traktion-index')>()), traktionsIndex: vi.fn(() => ({ saeulen: [{ kennzahlen: [{ id: 'gespraeche', anzeige: '7', ampel: 'gruen' }, { id: 'win_rate', anzeige: '40 %', ampel: 'gelb' }] }] })) }));
vi.mock('@/lib/privat/speicher', async orig => ({ ...(await orig<typeof import('@/lib/privat/speicher')>()), privatIndexFuer: vi.fn(async () => ({ pi: idx('luft', '1.200 €'), frisch: true })) }));
vi.mock('@/lib/gesundheit/speicher', async orig => ({ ...(await orig<typeof import('@/lib/gesundheit/speicher')>()), gesundheitsIndexFuer: vi.fn(async () => idx('recovery', '72 %')) }));
// Der EINE Sendeweg bleibt echt (Glocke) — nur mitgeschrieben; die Inhalte-Ausnahme hat im Test nur person-a.
vi.mock('@/lib/zoe/an-person', async orig => {
  const o = await orig<typeof import('@/lib/zoe/an-person')>();
  return {
    ...o,
    inhalteErlaubtFuer: async (p: string) => p === 'person-a',
    anPersonMelden: async (p: string, art: Parameters<typeof o.anPersonMelden>[1], text: string, opt?: Parameters<typeof o.anPersonMelden>[3]) => { gesendet.push({ person: p, text, opt }); return o.anPersonMelden(p, art, text, opt); },
  };
});

import { kontenSaeen, HAUS } from './fixtures/agenten-kern';
import type { FadenKern } from '@/lib/agenten/faeden';
import type { KontoSicht } from '@/lib/agenten/sicht';
import type { LaufErgebnis } from '@/lib/agenten/gespraech';

let db: typeof import('@/lib/store/local-db');
const J = new Date().toISOString();
const { localDay } = await import('@/lib/zeit');
const HEUTE = localDay();
const tagPlus = (n: number) => { const d = new Date(`${HEUTE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const sicht = (person: string, x: Partial<KontoSicht> = {}): KontoSicht => ({ person, imHaushalt: true, vollesMitglied: true, privatFinanzen: true, gesundheit: { verarbeiten: false, ki: false }, ...x });

// Router für die Selbstaufrufe der Agenten (runAgent → fetch(origin + pfad)) — alles andere wirft (kein Netz).
const echtesFetch = globalThis.fetch;
let scoreHaken: (() => Promise<void>) | null = null;
beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  const prospects = await import('@/app/api/state/prospects/route');
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('http://intern/api/state/prospects')) {
      const req = new Request(u, { method: init?.method ?? 'GET', headers: init?.headers as HeadersInit, ...(init?.body ? { body: init.body as BodyInit } : {}) });
      return init?.method === 'PATCH' ? prospects.PATCH(req) : init?.method === 'PUT' ? prospects.PUT(req) : prospects.GET(req);
    }
    if (u.startsWith('http://intern/api/prospecting/score')) {
      if (scoreHaken) await scoreHaken();
      return new Response(JSON.stringify({ ok: true, score: 77, fit: 'Passt zum Profil', angle: 'Aufhänger' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Netz im Test gesperrt: ${u.slice(0, 80)}`);
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

// ── 1 · Kontext Familie & Ernährung ─────────────────────────────────────────────────────────────────────────────────────

const basis = (von: string, sichtbarkeit: 'paar' | 'nur-ich' = 'paar') => ({ von, am: J, sichtbarkeit });
async function familieSaeen(): Promise<void> {
  const mmtt = tagPlus(10).slice(5);
  await db.saveJson(`familie--${HAUS}`, {
    einstellungen: { gespraech: { wochentag: 0, uhrzeit: '19:00', dauerMin: 45 }, businessFrei: [], kinder: false, ausnahmeBis: null },
    gespraeche: [{ id: 'g-1', ...basis('person-a'), datum: tagPlus(-3), status: 'gehalten', wertschaetzungen: [{ von: 'person-a', text: 'GESPRAECH-DANKE' }], lief_gut: ['GESPRAECH-GUT'], orga: [], themenIds: [], wuensche: [{ von: 'person-a', text: 'GESPRAECH-WUNSCH' }], schoeneZeit: 'GESPRAECH-SCHOEN', businessGrenzeGehalten: true, notiz: 'GESPRAECH-NOTIZ' }],
    themen: [
      { id: 'th-1', ...basis('person-a', 'nur-ich'), titel: 'GEHEIM-THEMA-A', art: 'loesbar', status: 'offen', hut: 'privat' },
      { id: 'th-2', ...basis('person-a'), titel: 'Urlaubsplanung Sommer', art: 'loesbar', status: 'offen', hut: 'privat' },
    ],
    vereinbarungen: [{ id: 'v-1', ...basis('person-b'), text: 'Sonntags kein Laptop', wer: 'beide', faellig: null, status: 'offen' }],
    wertschaetzungen: [{ id: 'w-1', ...basis('person-a'), an: 'person-b', text: 'DANKE-TEXT', datum: tagPlus(-1) }],
    rituale: [], ritualtage: [], ideen: [{ id: 'i-1', ...basis('person-b'), titel: 'Picknick am See', tags: ['draußen'], aufwand: 1, kosten: 1, dauer: 'halbtag', neu: true }],
    dates: [
      { id: 'd-1', ...basis('person-a'), titel: 'Kinoabend', ideeId: null, datum: tagPlus(5), planer: 'person-a', status: 'geplant', neuesErlebnis: false, nachklang: [{ von: 'person-a', text: 'GEFUEHL-NACHKLANG' }] },
      { id: 'd-2', ...basis('person-a', 'nur-ich'), titel: 'GEHEIM-DATE-A', ideeId: null, datum: tagPlus(7), planer: 'person-a', status: 'geplant', neuesErlebnis: false, nachklang: [] },
    ],
    lovemap: [{ id: 'l-1', ...basis('person-a'), frageId: 'f1', person: 'person-a', antwort: 'LOVEMAP-ANTWORT' }],
    wuensche: [{ id: 'wu-1', ...basis('person-a'), text: 'WUNSCH-TEXT', kategorie: 'zeit', status: 'offen' }],
    profile: [{ person: 'person-a', stress: 'STRESS-A', traeume: 'TRAUM-A', wasMirGuttut: '', stand: J }],
    reparaturen: [{ id: 'r-1', ...basis('person-a'), datum: tagPlus(-2), pauseBis: null, reflexionen: [{ person: 'person-a', gefuehle: 'GEFUEHL-REFLEXION', meineSicht: 'SICHT-A', meinAnteil: '', wunsch: '', geteilt: false }], abgeschlossen: null, vereinbarung: '' }],
    visionen: [{ jahr: 2026, leitbild: 'LEITBILD-TEXT', ziele: [], traeume: [] }],
    tage: [{ id: 't-1', ...basis('person-b'), titel: 'Hochzeitstag', art: 'jahrestag', datum: mmtt, vorlaufTage: 7, wer: 'beide', aktion: 'feier', erledigt: [] }],
    karten: [], menschen: [{ id: 'm-1', ...basis('person-b'), name: 'Oma Beispiel', rolle: 'eltern', geburtstag: null, kontaktAlleTage: 14, letzterKontakt: tagPlus(-30), notiz: 'MENSCH-NOTIZ' }],
  });
}
const GEFUEHLE = ['GEFUEHL-NACHKLANG', 'GEFUEHL-REFLEXION', 'SICHT-A', 'DANKE-TEXT', 'LOVEMAP-ANTWORT', 'WUNSCH-TEXT', 'STRESS-A', 'TRAUM-A', 'LEITBILD-TEXT', 'MENSCH-NOTIZ', 'GESPRAECH-DANKE', 'GESPRAECH-GUT', 'GESPRAECH-WUNSCH', 'GESPRAECH-SCHOEN', 'GESPRAECH-NOTIZ'];

describe('1 · Familie: EINE Filterstelle, nur Titel/Datum/Art', () => {
  beforeAll(familieSaeen);

  it('familieAuszug: die zweite Person sieht nichts „nur ich“ der ersten — und niemand sieht Gefühle oder Reflexionen', async () => {
    const { familieAuszug, familieFuerPerson } = await import('@/lib/familie/logik');
    const roh = (await db.loadJson<import('@/lib/familie/typen').Familie>(`familie--${HAUS}`))!;
    const b = familieAuszug(roh, 'person-b', HEUTE).text;
    for (const x of ['Kinoabend', 'Urlaubsplanung Sommer', 'Hochzeitstag', 'Sonntags kein Laptop', 'Picknick am See', 'Oma Beispiel']) expect(b, x).toContain(x);
    for (const x of ['GEHEIM-THEMA-A', 'GEHEIM-DATE-A', ...GEFUEHLE]) expect(b, x).not.toContain(x);
    // Die Anlegerin sieht ihr eigenes „nur ich“ — Gefühle aber auch sie nicht im Auszug.
    const a = familieAuszug(roh, 'person-a', HEUTE).text;
    expect(a).toContain('GEHEIM-THEMA-A');
    for (const x of GEFUEHLE) expect(a, x).not.toContain(x);
    // Die Filterstelle selbst: ungeteilte Reflexion der anderen weg, eigene bleibt.
    expect(familieFuerPerson(roh, 'person-b').reparaturen[0].reflexionen).toEqual([]);
    expect(familieFuerPerson(roh, 'person-a').reparaturen[0].reflexionen).toHaveLength(1);
  });

  it('Head-Kontext: nur mit Bereich „Familie“ an und offenem EU-Weg; die Route nutzt dieselbe Filterstelle', async () => {
    const { kontextFuer } = await import('@/lib/agenten/kontext');
    const { headDef } = await import('@/lib/agenten/katalog');
    const head = headDef('familie')!;
    const k = await kontextFuer({ head, sicht: sicht('person-b'), kategorien: ['familie'] });
    expect(k.text).toContain('Kinoabend');
    expect(k.text).not.toContain('GEHEIM-THEMA-A');
    for (const x of GEFUEHLE) expect(k.text, x).not.toContain(x);
    expect(k.kategorien).toContain('familie');
    expect(k).toMatchObject({ vertraulich: true, fremd: true });
    // Bereich aus → kein Auszug, ruhiger Hinweis.
    const aus = await kontextFuer({ head, sicht: sicht('person-b'), kategorien: [] });
    expect(aus.text).not.toContain('Kinoabend');
    expect(aus.hinweis).toMatch(/ausgeschaltet/);
    expect(aus.kategorien).not.toContain('familie');
    // Anbieter-Tor an, aber kein EU-Weg eingerichtet → der Auszug bleibt draußen (statt den ganzen Aufruf zu sperren).
    process.env.MAKE_OS_KI_ANBIETER_TOR = 'an';
    try {
      const eu = await kontextFuer({ head, sicht: sicht('person-b'), kategorien: ['familie'] });
      expect(eu.text).not.toContain('Kinoabend');
      expect(eu.hinweis).toMatch(/EU/);
      expect(eu.kategorien).not.toContain('familie');
    } finally { delete process.env.MAKE_OS_KI_ANBIETER_TOR; }
    // Route: dieselbe Filterstelle.
    const route = await import('@/app/api/familie/route');
    const r = await route.GET(new Request('http://test/api/familie', { headers: { 'x-make-user': 'person-b' } }));
    const t = await r.text();
    expect(r.status).toBe(200);
    expect(t).toContain('Urlaubsplanung Sommer');
    expect(t).not.toContain('GEHEIM-THEMA-A');
    expect(t).not.toContain('GEFUEHL-REFLEXION');
  });
});

describe('1 · Ernährung: Plan, Einkauf, Gerichte — Profile nur über profileFuerBetrachter', () => {
  beforeAll(async () => {
    await db.saveJson('ernaehrung', {
      grundsaetze: 'Viel Gemüse', plan: { mo: { fruehstueck: 'Haferbrei', mittag: '', abend: 'Ofengemüse' } }, planGerichte: {},
      einkauf: [{ id: 'e-1', text: 'Äpfel', erledigt: false, menge: '1 kg' }, { id: 'e-2', text: 'Erledigtes', erledigt: true }],
      profile: [
        { person: 'person-a', name: 'Anna', bedarf: 'BEDARF-A', unvertraeglich: ['NUSS-A'], nie: [], gern: [], ziel: 'ZIEL-A', konto: true, stand: J },
        { person: 'person-b', name: 'Bert', bedarf: 'BEDARF-B', unvertraeglich: ['LAKTOSE-B'], nie: [], gern: ['Pasta'], ziel: '', konto: true, stand: J },
        { person: 'gast-1', name: 'Gastname', bedarf: 'BEDARF-GAST', unvertraeglich: ['GLUTEN-GAST'], nie: [], gern: [], ziel: '', konto: false, stand: J },
      ],
      lebensmittel: [], vorrat: [], gerichte: [{ id: 'g-1', name: 'Linsencurry', zutaten: [], zubereitung: [], dauerMin: 30, portionen: 2, fuer: [], tags: ['schnell'], quelle: 'hand', angelegt: J, favorit: true, notiz: 'GERICHT-NOTIZ', bild: '' }],
    });
  });

  it('ohne Teilen: das Profil der anderen Person fehlt ganz; eigenes und Gast nur als Küchenregel; keine Namen', async () => {
    const { kontextFuer } = await import('@/lib/agenten/kontext');
    const { headDef } = await import('@/lib/agenten/katalog');
    const k = await kontextFuer({ head: headDef('ernaehrung')!, sicht: sicht('person-b'), kategorien: ['allgemein'] });
    for (const x of ['Haferbrei', 'Äpfel', 'Linsencurry', 'LAKTOSE-B', 'GLUTEN-GAST', 'Viel Gemüse']) expect(k.text, x).toContain(x);
    for (const x of ['BEDARF-A', 'NUSS-A', 'ZIEL-A', 'BEDARF-B', 'BEDARF-GAST', 'Erledigtes', 'GERICHT-NOTIZ', 'Anna', 'Bert', 'Gastname']) expect(k.text, x).not.toContain(x);
    expect(k.kategorien).not.toContain('gesundheit');
  });

  it('mit Teilen: die andere Person erscheint — ohne ihre Einwilligung (b)/(c) nur als Küchenregel, nie Bedarf oder Ziel', async () => {
    const konten = (await db.loadJson<{ konten: { speicher: string; teilt: { gesundheit: string[] } }[] }>('konten'))!;
    await db.saveJson('konten', { ...konten, konten: konten.konten.map(k => (k.speicher === 'person-a' ? { ...k, teilt: { gesundheit: ['person-b'] } } : k)) });
    const { kontextFuer } = await import('@/lib/agenten/kontext');
    const { headDef } = await import('@/lib/agenten/katalog');
    const k = await kontextFuer({ head: headDef('ernaehrung')!, sicht: sicht('person-b', { gesundheit: { verarbeiten: true, ki: true } }), kategorien: ['allgemein', 'gesundheit'] });
    expect(k.text).toContain('NUSS-A');
    expect(k.text).toContain('geteiltes Profil');
    for (const x of ['BEDARF-A', 'ZIEL-A', 'BEDARF-B']) expect(k.text, x).not.toContain(x);
    expect(k.kategorien).not.toContain('gesundheit');
    // Mit eigener Einwilligung (a)+(b) kommt das EIGENE Profil vollständig — die andere Person weiter nur als Küchenregel.
    const E = await import('@/lib/datenschutz/gesundheit-einwilligung');
    expect(await E.gesundheitErklaeren('person-b', 'verarbeiten', true, E.GESUNDHEIT_FASSUNG)).toMatchObject({ ok: true });
    expect(await E.gesundheitErklaeren('person-b', 'ki', true, E.GESUNDHEIT_FASSUNG)).toMatchObject({ ok: true });
    const voll = await kontextFuer({ head: headDef('ernaehrung')!, sicht: sicht('person-b', { gesundheit: { verarbeiten: true, ki: true } }), kategorien: ['allgemein', 'gesundheit'] });
    expect(voll.text).toContain('BEDARF-B');
    expect(voll.text).not.toContain('BEDARF-A');
    expect(voll.kategorien).toContain('gesundheit');
    await db.saveJson('konten', konten);
  });
});

// ── 2 · Kennzahlen im Kopf ──────────────────────────────────────────────────────────────────────────────────────────────

describe('2 · Kennzahlen im Head-Kopf über die vorhandenen Lesewege', () => {
  it('Traktion für Sales; im fremden Haushalt nichts', async () => {
    const { kennzahlWerte } = await import('@/lib/agenten/kontext');
    const { headDef } = await import('@/lib/agenten/katalog');
    const w = await kennzahlWerte(headDef('sales')!, sicht('person-b'));
    expect(w.find(k => k.id === 'traktion:gespraeche')).toMatchObject({ wert: '7', ampel: 'gruen' });
    expect(w.find(k => k.id === 'traktion:win_rate')).toMatchObject({ wert: '40 %', ampel: 'gelb' });
    expect(w.find(k => k.id === 'traktion:ueberfaellig')).toMatchObject({ wert: null, ampel: 'grau' });
    expect((await kennzahlWerte(headDef('sales')!, sicht('gast', { imHaushalt: false }))).every(k => k.wert === null)).toBe(true);
  });

  it('Privat nur mit privatem Finanzzugang; Gesundheit nur mit Einwilligung (a); Fehler → Wert fehlt', async () => {
    const { kennzahlWerte } = await import('@/lib/agenten/kontext');
    const { headDef } = await import('@/lib/agenten/katalog');
    const P = await import('@/lib/privat/speicher');
    const G = await import('@/lib/gesundheit/speicher');
    vi.mocked(P.privatIndexFuer).mockClear();
    expect((await kennzahlWerte(headDef('finanzen-privat')!, sicht('team-c', { privatFinanzen: false }))).every(k => k.wert === null)).toBe(true);
    expect(P.privatIndexFuer).not.toHaveBeenCalled();
    expect((await kennzahlWerte(headDef('finanzen-privat')!, sicht('person-b'))).find(k => k.id === 'privat:luft')?.wert).toBe('1.200 €');
    vi.mocked(G.gesundheitsIndexFuer).mockClear();
    expect((await kennzahlWerte(headDef('gesundheit')!, sicht('person-b'))).every(k => k.wert === null)).toBe(true);
    expect(G.gesundheitsIndexFuer).not.toHaveBeenCalled();
    const mitA = sicht('person-b', { gesundheit: { verarbeiten: true, ki: true } });
    expect((await kennzahlWerte(headDef('gesundheit')!, mitA)).find(k => k.id === 'gesundheit:recovery')?.wert).toBe('72 %');
    expect(G.gesundheitsIndexFuer).toHaveBeenCalledWith('person-b');
    vi.mocked(G.gesundheitsIndexFuer).mockRejectedValueOnce(new Error('kaputt'));
    const w = await kennzahlWerte(headDef('gesundheit')!, sicht('person-a', { gesundheit: { verarbeiten: true, ki: true } }));
    expect(w.every(k => k.wert === null)).toBe(true);
  });

  it('GET /api/agenten: Sales trägt die Traktions-Werte; ein Konto „nur Business“ bekommt keinen Privat-Head', async () => {
    const route = await import('@/app/api/agenten/route');
    const a = await (await route.GET(new Request('http://test/api/agenten', { headers: { 'x-make-user': 'person-b' } }))).json() as import('@/lib/agenten/typen').AgentenAntwort;
    expect(a.heads.find(h => h.id === 'sales')?.kennzahlen.find(k => k.id === 'traktion:gespraeche')?.wert).toBe('7');
    const c = await (await route.GET(new Request('http://test/api/agenten', { headers: { 'x-make-user': 'team-c' } }))).json() as import('@/lib/agenten/typen').AgentenAntwort;
    expect(c.heads.some(h => h.bereich === 'privat')).toBe(false);
    expect(JSON.stringify(c)).not.toContain('1.200 €');
  });
});

// ── 3 · Gegenprüfung „nice“ ─────────────────────────────────────────────────────────────────────────────────────────────

const faden = (id: string, besitzer: string, headId: string, n: number, lauf: Partial<NonNullable<FadenKern['lauf']>> = {}): FadenKern => ({
  id, besitzer, agent: { art: 'head', headId }, bereich: 'business', titel: `Thread ${id}`, status: 'wartet', fremdGelesen: false, vertraulich: false,
  nachrichten: Array.from({ length: n }, (_, i) => ({ id: `nr-${id}-${i}`, rolle: 'person' as const, von: besitzer, text: `Nachricht ${i}`, zeit: J })), erstellt: J, aktualisiert: J,
  kette: [`head:${headId}`], lauf: { status: 'wartet', schritte: [], start: J, kostenCent: 0, ...lauf },
} as FadenKern);

describe('3a · Thread voll: der Lauf endet sichtbar, nie gekürzt', () => {
  it('ergebnisSchreiben auf 400 Nachrichten → Status „fehler“ mit Hinweis, keine Nachricht verloren oder gekürzt, Glocke', async () => {
    const { GRENZEN, fadenBestand } = await import('@/lib/agenten/typen');
    const D = await import('@/lib/agenten/delegation');
    const f = faden('fd-voll-1', 'person-a', 'sales', GRENZEN.fadenNachrichten, { status: 'laeuft' });
    await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [f] });
    const e = { ok: true, status: 'fertig', text: 'Das Ergebnis', ki: true, werkzeuge: [], fremdGelesen: false, vertraulich: false, schritte: [], kostenCent: 4, kategorien: [], span: { lauf_id: 'lauf-x', agent: 'head:sales', operation: 'invoke_agent', modell: 'm', runden: 1, werkzeug_aufrufe: 0, token: { ein: 1, aus: 1 }, cent: 4, dauer_ms: 1, ergebnis: 'ok' } } as unknown as LaufErgebnis;
    await D.ergebnisSchreiben('person-a', f, e, false);
    const x = (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-a'))[0];
    expect(x.status).toBe('fehler');
    expect(x.lauf).toMatchObject({ status: 'fehler', kostenCent: 4 });
    expect(x.lauf?.fehler).toMatch(/Thread voll .* neuen Thread anlegen/);
    expect(x.nachrichten).toHaveLength(GRENZEN.fadenNachrichten);
    expect(x.nachrichten[0].text).toBe('Nachricht 0');
    const m = await db.loadJson<{ meldungen?: { titel: string }[] }>('meldungen--person-a');
    expect(JSON.stringify(m)).toMatch(/Thread ist voll/);
  });

  it('ein voller Thread läuft gar nicht erst (kein Modell, keine Kosten) — Status „fehler“ statt „läuft“', async () => {
    const { GRENZEN, fadenBestand } = await import('@/lib/agenten/typen');
    const D = await import('@/lib/agenten/delegation');
    await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [faden('fd-voll-2', 'person-a', 'sales', GRENZEN.fadenNachrichten)] });
    const r = await D.fadenLauf('person-a', { art: 'faden', fadenId: 'fd-voll-2' }, { origin: 'http://intern', hintergrund: false });
    expect(r).toMatchObject({ status: 200, ok: false, laufStatus: 'fehler' });
    const x = (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-a'))[0];
    expect(x.lauf?.status).toBe('fehler');
    expect(x.lauf?.fehler).toMatch(/Thread voll/);
  });
});

describe('3b · Kosten: US-Cent der Threads gegen Euro-Cent der Budgets — EINE Umrechnung', () => {
  it('inEuroCent/inUsdCent mit demselben Kurs; Head-Budget eines Privat-Heads in Euro-Cent; Schätzung in Euro-Cent', async () => {
    const K = await import('@/lib/ki/kosten');
    const kurs = K.usdEurKurs();
    expect(K.inUsdCent(K.inEuroCent(100, kurs), kurs)).toBeCloseTo(100, 6);
    const { fadenBestand } = await import('@/lib/agenten/typen');
    const f = { ...faden('fd-kosten-1', 'person-b', 'assistenz', 2, { status: 'fertig', kostenCent: 100, start: J, ende: J }), bereich: 'privat' as const };
    const m = { ...faden('fd-kosten-2', 'person-b', 'sales', 2, { status: 'fertig', kostenCent: 50, start: J, ende: J }), agent: { art: 'mitarbeiter' as const, headId: 'sales', mitarbeiterId: 'sales-crm-pflege' } };
    await db.saveJson(fadenBestand('person-b'), { v: 1, faeden: [f, m] });
    const E = await import('@/lib/agenten/einstellung');
    const { headDef } = await import('@/lib/agenten/katalog');
    const kosten = await E.kostenHeadMonat(headDef('assistenz')!, 'person-b');
    expect(kosten).toBeCloseTo(100 * kurs, 1);
    // Budget 90 Euro-Cent: 100 US-Cent sind bei einem Kurs < 0,9 noch nicht erreicht — vorher sperrte der rohe US-Wert.
    const e = { v: 1 as const, heads: {}, personen: { 'person-b': { heads: { assistenz: { budgetCentMonat: 90 } } } } };
    expect(E.headSperre(e, headDef('assistenz')!, 'person-b', kosten)).toBeNull();
    expect(E.headSperre(e, headDef('assistenz')!, 'person-b', 100)?.grund).toBe('budget');
    const D = await import('@/lib/agenten/delegation');
    expect(D.schaetzungCent([m], 'sales', 0.5)).toBe(25);
    const L = await import('@/lib/agenten/leistung');
    expect(await L.gemesseneKosten('person-b', 'assistenz')).toEqual([100 * kurs]);
  });
});

describe('3c · Hintergrundaufgabe bei ZOE wird beim Planen abgelehnt', () => {
  it('planen → 400 mit Grund; eine alte ZOE-Aufgabe wird nie eingereiht', async () => {
    const P = await import('@/lib/agenten/plan-server');
    const r = await P.planen('person-a', { agent: { art: 'zoe' }, titel: 'Wochenrückblick', auftrag: 'Fass die Woche zusammen.', zeitplan: { art: 'einmalig', wann: `${tagPlus(1)}T09:30:00` } });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect((r as { fehler: string }).fehler).toBe(P.ZOE_NICHT_GEPLANT);
    const { planKandidat } = await import('@/lib/agenten/zeitplan');
    expect(planKandidat({ id: 'hg-alt', besitzer: 'person-a', agent: { art: 'zoe' }, titel: 'x', auftrag: 'y', zeitplan: { art: 'wiederkehrend', rhythmus: 'taeglich', uhrzeit: '09:00' }, aktiv: true, erstellt: J })).toBeNull();
    expect(planKandidat({ id: 'hg-neu', besitzer: 'person-a', agent: { art: 'head', headId: 'sales' }, titel: 'x', auftrag: 'y', zeitplan: { art: 'wiederkehrend', rhythmus: 'taeglich', uhrzeit: '09:00' }, aktiv: true, erstellt: J })).not.toBeNull();
  });
});

describe('3d · Aufgaben-Leser nur im Bereich des Heads', () => {
  beforeAll(async () => {
    const t = (id: string, title: string, spaceId: string, projectId: string) => ({ id, title, projectId, spaceId, status: 'todo', priority: 'medium', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: J, updatedAt: J, zoe: { status: 'offen', von: 'person-a' } });
    await db.saveJson('tasks', {
      projects: [
        { id: 'proj-b', title: 'Business-Projekt', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: J, updatedAt: J, spaceId: 'kdv', notiz: 'Business-Notiz' },
        { id: 'proj-p', title: 'PRIVATMARKE Projekt', category: 'private', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: J, updatedAt: J, spaceId: 'privat', notiz: 'PRIVATMARKE Notiz' },
      ],
      tasks: [t('zb-1', 'Business-Auftrag', 'kdv', 'proj-b'), t('zp-1', 'PRIVATMARKE Aufgabe', 'privat', 'proj-p')],
      listen: [], statusEigen: [], gruppen: [], vorlagen: [],
    });
  });

  it('eingabeImBereich setzt den Bereich fest — das Modell kann ihn nicht weiten', async () => {
    const { eingabeImBereich } = await import('@/lib/agenten/werkzeuge');
    const { headDef } = await import('@/lib/agenten/katalog');
    for (const w of ['meine_aufgaben', 'projekt_unterlagen', 'datei_lesen']) expect(eingabeImBereich(w, { space: 'privat' }, headDef('operations')!).space).toBe('business');
    expect(eingabeImBereich('meine_aufgaben', {}, headDef('assistenz')!).space).toBe('privat');
  });

  it('meine_aufgaben und projekt_unterlagen mit space=business finden nichts aus Privat', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const nurB = await WERKZEUGE.meine_aufgaben.lauf({ space: 'business' }, 'http://intern', 'person-a');
    expect(nurB).toContain('Business-Auftrag');
    expect(nurB).not.toContain('PRIVATMARKE');
    expect(await WERKZEUGE.meine_aufgaben.lauf({}, 'http://intern', 'person-a')).toContain('PRIVATMARKE');
    const u = await WERKZEUGE.projekt_unterlagen.lauf({ projekt: 'PRIVATMARKE Projekt', space: 'business' }, 'http://intern', 'person-a');
    expect(u).toMatch(/kein Projekt/);
    expect(u).not.toContain('PRIVATMARKE Notiz');
    expect(await WERKZEUGE.projekt_unterlagen.lauf({ projekt: 'Business-Projekt', space: 'business' }, 'http://intern', 'person-a')).toContain('Business-Notiz');
  });
});

// ── 4 · Markttraktion-Takt und Prospect-Agent ──────────────────────────────────────────────────────────────────────────

describe('4 · Markttraktion-Takt: Inhalte nur mit Ausnahme, ohne Boten die Glocke', () => {
  it('mit Ausnahme die Zahlen-Nachricht, ohne Ausnahme neutral — beide über den EINEN Sendeweg mit Glocke', async () => {
    const { runAgent } = await import('@/lib/zoe/agenten');
    gesendet.length = 0;
    const a = await runAgent('markttraktion', 'morgen', 'http://intern', 'person-a');
    const b = await runAgent('markttraktion', 'morgen', 'http://intern', 'person-b');
    expect(a.ok && b.ok).toBe(true);
    expect(a.text).toMatch(/Glocke/);
    const ta = gesendet.find(g => g.person === 'person-a')!, tb = gesendet.find(g => g.person === 'person-b')!;
    expect(ta.text).toMatch(/^Guten Morgen, Anna\./);
    expect(tb.text).toMatch(/Details in MAKE OS/);
    expect(tb.text).not.toMatch(/Guten Morgen/);
    expect(ta.opt).toMatchObject({ glocke: true });
    const m = await db.loadJson<{ meldungen?: { titel: string; link?: string }[] }>('meldungen--person-b');
    expect(JSON.stringify(m)).toContain('/os/markttraktion');
    // Riegel gesetzt — der Takt reiht den Slot heute nicht noch einmal ein.
    const S = await import('@/lib/crm/scoreboard');
    expect(S.faelligeRhythmen(S.rhythmusStand(await db.loadJson(S.RHYTHMUS_SPEICHER)), ['person-b'], new Date(`${HEUTE}T08:30:00+02:00`)).filter(d => d.slot === 'morgen')).toEqual([]);
  });
});

describe('4 · Prospect-Agent schreibt per PATCH mit Stand', () => {
  it('bewertet und speichert nur die bewerteten Zeilen; bei fremder Änderung dazwischen wird nichts überschrieben', async () => {
    await db.saveJson('prospects', { icp: 'Mittelstand', prospects: [
      { id: 'p-beispiel-1', company: 'Beispiel AG', status: 'neu', addedAt: J },
      { id: 'p-beispiel-2', company: 'Muster GmbH', status: 'neu', addedAt: J, score: 50 },
    ] });
    const { runAgent } = await import('@/lib/zoe/agenten');
    const r = await runAgent('prospect', '', 'http://intern', 'person-a');
    expect(r.ok, r.text).toBe(true);
    expect(r.text).toMatch(/1 Werte in der Zielliste gespeichert/);
    let roh = (await db.loadJson<{ prospects: Record<string, unknown>[] }>('prospects'))!.prospects;
    expect(roh.find(p => p.id === 'p-beispiel-1')).toMatchObject({ score: 77, fit: 'Passt zum Profil', angle: 'Aufhänger', status: 'neu' });
    expect(roh.find(p => p.id === 'p-beispiel-2')).toMatchObject({ score: 50 });
    // Zwischen Lesen und Schreiben ändert jemand die Zeile → 409, nichts überschrieben.
    await db.saveJson('prospects', { icp: 'Mittelstand', prospects: [{ id: 'p-beispiel-3', company: 'Neu KG', status: 'neu', addedAt: J }] });
    scoreHaken = async () => { await db.saveJson('prospects', { icp: 'Mittelstand', prospects: [{ id: 'p-beispiel-3', company: 'Neu KG', status: 'verworfen', addedAt: J }] }); };
    try {
      const k = await runAgent('prospect', '', 'http://intern', 'person-a');
      expect(k.text).toMatch(/Nicht gespeichert: die Zielliste wurde inzwischen geändert/);
    } finally { scoreHaken = null; }
    roh = (await db.loadJson<{ prospects: Record<string, unknown>[] }>('prospects'))!.prospects;
    expect(roh[0]).toMatchObject({ status: 'verworfen' });
    expect(roh[0].score).toBeUndefined();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('lib/zoe/agenten.ts', 'utf8')).not.toMatch(/api\/state\/prospects`, \{ method: 'PUT'/);
  });
});
