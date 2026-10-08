// ─── Malins Sicht, Teil 2 (08.10., Kevins Entscheidungen) ──────────────────────────────────────────────────────────────
// 1. Essensvorschläge personenneutral: keine Namen, keine Variante je Person in Gerichtnamen, Zutaten, Schritten, Tags, Begründung
//    (lib/ernaehrung/neutral.ts; Routen /api/ernaehrung/vorschlag + /rezept mit nachgebautem Modell).
// 2. Lese-Protokoll Ernährung: nur, wenn das Profil einer ANDEREN Person ausgeliefert wird (geteilt).
// 3. Wochenvorlage-Blöcke der anderen Person nur „Belegt“ (Zeiten, Tag, art bleiben; Titel weg); Schreiben darauf 403.
// Eigener Datenordner, erfundene Personen und Werte — nie .data/, nie ein echter Vault.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-malin-sicht-2-'));
process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, 'daten');
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

// Das Modell antwortet absichtlich regelwidrig — mit Namen und Varianten je Person. Der Server muss es neutralisieren.
const modell = vi.hoisted(() => ({ antwort: null as unknown }));
vi.mock('@/lib/anthropic', async orig => ({
  ...(await orig<typeof import('@/lib/anthropic')>()),
  hasAnthropicKey: () => true,
  askJson: async () => ({ ok: true, data: modell.antwort }),
}));

import { namenFuer, ohneNamen, schrittOhneNamen, begruendungNeutral, gerichtNeutral, nenntPerson } from '@/lib/ernaehrung/neutral';
import { bloeckeFuerBetrachter, blockBelegt, sauberBlock } from '@/lib/planung/routinen';
import type { Block } from '@/lib/planung/typen';

type Handler = (r: Request) => Promise<Response>;
const H = 'haus-sicht-2';
const kopf = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (pfad: string, person: string, method = 'GET', body?: unknown) =>
  new Request(`http://test${pfad}`, { method, headers: kopf(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const konto = (id: string, sp: string, name: string, rolle: 'inhaber' | 'mitglied', teilt: string[] = []) =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: teilt }, haushalt: H });
const profil = (person: string, name: string, konto: boolean, bedarf = '') => ({ person, name, bedarf, unvertraeglich: [], nie: [], gern: [], ziel: '', konto, stand: '2026-10-01' });

let db: typeof import('@/lib/store/local-db');
let lp: typeof import('@/lib/store/leseprotokoll');

beforeAll(async () => {
  await fs.mkdir(process.env.MAKE_OS_DATEN_DIR!, { recursive: true });
  db = await import('@/lib/store/local-db');
  lp = await import('@/lib/store/leseprotokoll');
});
afterAll(async () => {
  await lp.leseprotokollWarten();
  await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 });
});

// ── 1. Rein ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Personenneutral: reine Regeln', () => {
  const namen = namenFuer([profil('person-a', 'Anna Probe', true), profil('person-b', 'Bert', true), profil('gast-oma-ilse', 'Oma Ilse', false)]);

  it('Namen: Kennung, Anzeigename, Wortteile, Gast-Kennung', () => {
    expect(namen).toEqual(expect.arrayContaining(['person-a', 'anna probe', 'anna', 'probe', 'bert', 'oma ilse', 'ilse', 'oma']));
    expect(namen).not.toContain('gast');
  });

  it('Gerichtname: Klammer, Zusatz hinter Komma/Strich und „für <Name>“ fallen weg', () => {
    expect(ohneNamen('Ofengemüse mit Feta (für Anna ohne Feta)', namen)).toBe('Ofengemüse mit Feta');
    expect(ohneNamen('Linsensalat – Variante für Bert', namen)).toBe('Linsensalat');
    expect(ohneNamen('Bowl, Berts Portion ohne Ei', namen)).toBe('Bowl');
    expect(ohneNamen('Haferbrei für Anna', namen)).toBe('Haferbrei');
    expect(ohneNamen('Bertram-Kartoffeln', namen)).toBe('Bertram-Kartoffeln'); // nur ganze Wörter
    expect(ohneNamen('Pasta (vegan)', namen)).toBe('Pasta (vegan)');
  });

  it('Schritte: „für <Name>“ → „für eine Portion“, sonst nennt der Schritt eine Person → weg', () => {
    expect(schrittOhneNamen('Für Anna den Feta separat lassen.', namen)).toBe('Für eine Portion den Feta separat lassen.');
    expect(schrittOhneNamen('Anna mag es scharf, also Chili dazu.', namen)).toBeNull();
    expect(schrittOhneNamen('Zwiebeln anschwitzen.', namen)).toBe('Zwiebeln anschwitzen.');
  });

  it('Begründung: Sätze mit Namen fallen weg', () => {
    expect(begruendungNeutral('Eine leichte Woche mit viel Gemüse. Wegen Annas Ziel wenig Zucker. Freitag gibt es Pizza.', namen))
      .toBe('Eine leichte Woche mit viel Gemüse. Freitag gibt es Pizza.');
  });

  it('Gericht: fuer = alle, Tags/Zutaten ohne Namen', () => {
    const g = gerichtNeutral({ name: 'Curry (für Bert mild)', zutaten: [{ name: 'Chili (nicht für Bert)', menge: '1' }, { name: 'Reis', menge: '200 g' }], zubereitung: ['Kochen.', 'Bert bekommt seins ohne Chili.'], tags: ['schnell', 'für Bert'], fuer: ['Bert'] }, namen, ['Anna Probe', 'Bert']);
    expect(g).toMatchObject({ name: 'Curry', zutaten: [{ name: 'Chili', menge: '1' }, { name: 'Reis', menge: '200 g' }], zubereitung: ['Kochen.'], tags: ['schnell'], fuer: ['Anna Probe', 'Bert'] });
    expect(nenntPerson(JSON.stringify({ ...g, fuer: [] }), namen)).toBe(false);
  });
});

// ── 1. Routen ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('Wochenvorschlag und Rezept gehen personenneutral raus', () => {
  beforeAll(async () => {
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'Anna Probe', 'inhaber'), konto('k2', 'person-b', 'Bert Probe', 'mitglied')], einladungen: [] });
    await db.saveJson('ernaehrung', { profile: [profil('person-a', 'Anna', true, 'BEDARF-A'), profil('person-b', 'Bert', true, 'BEDARF-B'), profil('gast-ilse', 'Ilse', false)] });
  });

  it('/api/ernaehrung/vorschlag: kein Name in Plan, Gerichten, Einkauf, Begründung; Plan findet sein Rezept', async () => {
    const tag = { fruehstueck: 'Haferbrei (für Bert ohne Nüsse)', mittag: 'Linsensalat', abend: 'Suppe, Annas Variante ohne Sahne' };
    modell.antwort = {
      begruendung: 'Viel Gemüse diese Woche. Für Ilse und Bert milder gewürzt.',
      plan: { mo: tag, di: tag, mi: tag, do: tag, fr: tag, sa: tag, so: tag },
      gerichte: [
        { name: 'Haferbrei (für Bert ohne Nüsse)', zutaten: [{ name: 'Hafer', menge: '100 g' }, { name: 'Nüsse (nicht für Bert)', menge: '20 g' }], zubereitung: ['Aufkochen.', 'Für Bert die Nüsse weglassen.'], dauerMin: 10, portionen: 3, fuer: ['Bert'], tags: ['Bert'] },
      ],
      einkauf: [{ text: 'Nüsse für Anna', menge: '1 Tüte', kategorie: 'vorrat' }],
    };
    const { POST } = (await import('@/app/api/ernaehrung/vorschlag/route')) as unknown as { POST: Handler };
    const r = await POST(anfrage('/api/ernaehrung/vorschlag', 'person-b', 'POST', { gaeste: ['gast-ilse'] }));
    expect(r.status).toBe(200);
    const d = await r.json() as { begruendung: string; plan: Record<string, Record<string, string>>; planGerichte: Record<string, Record<string, string>>; gerichte: { id: string; name: string; fuer: string[] }[]; einkauf: { text: string }[] };
    const ohneFuer = JSON.stringify({ ...d, gerichte: d.gerichte.map(g => ({ ...g, fuer: [] })) });
    expect(ohneFuer).not.toMatch(/Anna|Bert|Ilse|BEDARF/);
    expect(d.plan.mo).toEqual({ fruehstueck: 'Haferbrei', mittag: 'Linsensalat', abend: 'Suppe' });
    expect(d.gerichte[0]).toMatchObject({ name: 'Haferbrei', fuer: ['Anna', 'Bert', 'Ilse'] });
    expect(d.planGerichte.mo.fruehstueck).toBe(d.gerichte[0].id);
    expect(d.begruendung).toBe('Viel Gemüse diese Woche.');
  });

  it('/api/ernaehrung/rezept: Name, Schritte, Tags ohne Personen', async () => {
    modell.antwort = { name: 'Pasta (Annas Version ohne Käse)', zutaten: [{ name: 'Pasta', menge: '250 g' }], zubereitung: ['Kochen.', 'Für Anna ohne Käse servieren.'], dauerMin: 15, portionen: 2, fuer: ['Anna'], tags: ['Anna', 'schnell'] };
    const { POST } = (await import('@/app/api/ernaehrung/rezept/route')) as unknown as { POST: Handler };
    const r = await POST(anfrage('/api/ernaehrung/rezept', 'person-b', 'POST', { name: 'Pasta' }));
    const d = await r.json() as { gericht: { name: string; zubereitung: string[]; tags: string[]; fuer: string[] } };
    expect(d.gericht).toMatchObject({ name: 'Pasta', zubereitung: ['Kochen.', 'Für eine Portion ohne Käse servieren.'], tags: ['schnell'], fuer: ['Anna', 'Bert'] });
  });
});

// ── 2. Lese-Protokoll Ernährung ─────────────────────────────────────────────────────────────────────────────────────────
describe('Lese-Protokoll: GET /api/state/ernaehrung', () => {
  const eintraege = async () => {
    await lp.leseprotokollWarten();
    const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
    return (await lp.leseprotokollMonat(H, monatBerlin())).filter(e => e.weg === '/api/state/ernaehrung');
  };

  it('nur eigenes Profil (nicht geteilt) → kein Eintrag; geteilt → „gesundheit“ mit der betroffenen Person, ohne Inhalte', async () => {
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'Anna Probe', 'inhaber'), konto('k2', 'person-b', 'Bert Probe', 'mitglied')], einladungen: [] });
    await db.saveJson('ernaehrung', { profile: [profil('person-a', 'Anna', true, 'GEHEIM-BEDARF-A'), profil('person-b', 'Bert', true, 'BEDARF-B'), profil('gast-ilse', 'Ilse', false)] });
    const { GET } = (await import('@/app/api/state/ernaehrung/route')) as unknown as { GET: Handler };
    lp.leseDrosselLeeren();
    const r1 = await GET(anfrage('/api/state/ernaehrung', 'person-b'));
    expect(await r1.text()).not.toContain('GEHEIM-BEDARF-A');
    expect(await eintraege()).toHaveLength(0);

    // person-a teilt Gesundheit mit person-b → ihr Profil wird ausgeliefert → genau ein Eintrag.
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'Anna Probe', 'inhaber', ['person-b']), konto('k2', 'person-b', 'Bert Probe', 'mitglied')], einladungen: [] });
    const r2 = await GET(anfrage('/api/state/ernaehrung', 'person-b'));
    expect(await r2.text()).toContain('GEHEIM-BEDARF-A');
    const e = await eintraege();
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ wer: 'person', person: 'person-b', bereich: 'gesundheit', betroffen: 'person-a' });
    expect(JSON.stringify(e)).not.toContain('GEHEIM-BEDARF-A');

    // Die Inhaberin selbst: eigenes Profil + Gäste → nichts notiert (person-b teilt nicht mit ihr).
    lp.leseDrosselLeeren();
    await GET(anfrage('/api/state/ernaehrung', 'person-a'));
    expect((await eintraege()).filter(x => x.person === 'person-a')).toHaveLength(0);
  });
});

// ── 3. Blöcke der Wochenvorlage ─────────────────────────────────────────────────────────────────────────────────────────
describe('Wochenvorlage: fremde Blöcke nur „Belegt“', () => {
  const blockA: Block = { id: 'bl-a', owner: 'person-a', wochentag: 2, von: '09:00', bis: '12:00', art: 'business', titel: 'GEHEIM-BLOCK-TITEL', einheit: 'kdv', rang: 1 };
  const blockB: Block = { id: 'bl-b', owner: 'person-b', wochentag: 2, von: '13:00', bis: '17:00', art: 'privat', titel: 'Eigener Titel' };

  it('rein: eigene voll, fremde ohne Titel/Business-Einheit, Zeiten/Tag/art bleiben; Systemlauf unverändert', () => {
    const sicht = bloeckeFuerBetrachter([blockA, blockB], 'person-b');
    expect(sicht[0]).toEqual({ id: 'bl-a', owner: 'person-a', wochentag: 2, von: '09:00', bis: '12:00', art: 'business', rang: 1, belegt: true });
    expect(sicht[1]).toBe(blockB);
    expect(bloeckeFuerBetrachter([blockA], null)[0]).toEqual(blockA);
    // Der Schreibweg übernimmt `belegt` nie.
    expect(sauberBlock(blockBelegt(blockA))).not.toHaveProperty('belegt');
  });

  it('Route: GET/PATCH verdecken fremde Blöcke; Schreiben auf einen fremden Block → 403, nichts geändert', async () => {
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'Anna Probe', 'inhaber'), konto('k2', 'person-b', 'Bert Probe', 'mitglied')], einladungen: [] });
    await db.saveJson('routinen', { routinen: [{ id: 'r1', label: 'Gemeinsam', wann: 'morgen', kategorie: 'leben', dauerMin: 10, aktiv: true, owner: 'beide' }], bloecke: [blockA, blockB] });
    const { GET, PATCH } = (await import('@/app/api/state/routinen/route')) as unknown as { GET: Handler; PATCH: Handler };

    for (const pfad of ['/api/state/routinen', '/api/state/routinen?sicht=ich']) {
      const t = await (await GET(anfrage(pfad, 'person-b'))).text();
      expect(t).not.toContain('GEHEIM-BLOCK-TITEL');
      const d = JSON.parse(t) as { bloecke: (Block & { stand?: string })[] };
      expect(d.bloecke.find(b => b.id === 'bl-a')).toMatchObject({ von: '09:00', bis: '12:00', wochentag: 2, art: 'business', belegt: true });
      expect(d.bloecke.find(b => b.id === 'bl-b')!.titel).toBe('Eigener Titel');
    }
    // Die Besitzerin sieht ihren Titel.
    expect(await (await GET(anfrage('/api/state/routinen', 'person-a'))).text()).toContain('GEHEIM-BLOCK-TITEL');

    const vorher = JSON.stringify(await db.loadJson('routinen'));
    const fremd = await PATCH(anfrage('/api/state/routinen', 'person-b', 'PATCH', { bloecke: [{ op: 'upsert', eintrag: { ...blockA, titel: 'Überschrieben' } }] }));
    expect(fremd.status).toBe(403);
    const fremdText = await fremd.text();
    expect(fremdText).not.toContain('GEHEIM-BLOCK-TITEL');
    expect(JSON.stringify(await db.loadJson('routinen'))).toBe(vorher);
    const weg = await PATCH(anfrage('/api/state/routinen', 'person-b', 'PATCH', { bloecke: [{ op: 'delete', id: 'bl-a' }] }));
    expect(weg.status).toBe(403);
    expect(JSON.stringify(await db.loadJson('routinen'))).toBe(vorher);

    // Eigener Block: geht, und die Antwort verdeckt den fremden weiter.
    const standB = (JSON.parse(await (await GET(anfrage('/api/state/routinen', 'person-b'))).text()) as { bloecke: (Block & { stand: string })[] }).bloecke.find(x => x.id === 'bl-b')!.stand;
    const eigen = await PATCH(anfrage('/api/state/routinen', 'person-b', 'PATCH', { bloecke: [{ op: 'upsert', eintrag: { ...blockB, titel: 'Neu' }, stand: standB }] }));
    const et = await eigen.text();
    expect(eigen.status).toBe(200);
    expect(et).toContain('Neu');
    expect(et).not.toContain('GEHEIM-BLOCK-TITEL');
  });
});
