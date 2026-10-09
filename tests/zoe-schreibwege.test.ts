// ─── ZOE-/Agenten-Schreibwege über die offiziellen Routen, Finanz-Trennung (09.10., Funde der Abdeckungs-Analyse) ─────────────
// Wächter: ZOE-Werkzeuge schreiben NUR über die Routen (lib/zoe/innen.ts) — Zugang, Fassung/409, Grenzen, Änderungsprotokoll, Buchung bei
// „bezahlt“, Anlass-Pflicht, Sperrliste, Kette/Bezüge; „Sicht Business bekommt nichts aus Privat“ (auch `finanzRecht: 'business'`); keine
// stille Selbstständigkeit; nichts doppelt bei Wiederholung derselben Freigabe. Eigener Datenordner, erfundene Konten und Daten, das
// Modell ist gemockt (kein echter KI-Aufruf).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-schreibwege-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
// Nie den echten Vault lesen (CLAUDE.md › Brain): eigener leerer Ordner, keine Doku-Wurzel.
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-schreibwege';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const mitschnitt: { tools: { name: string }[] }[] = [];
vi.mock('@/lib/anthropic', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/anthropic')>();
  return {
    ...echt,
    hasAnthropicKey: () => true,
    guthabenLeer: () => false,
    askText: vi.fn(async (o: { tools?: unknown[] }) => { mitschnitt.push({ tools: (o.tools ?? []) as never }); return { ok: true, status: 200, text: 'Gut.', stopReason: 'end_turn', raw: { content: [{ type: 'text', text: 'Gut.' }] } }; }),
  };
});
vi.mock('@/lib/brain', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
const vaultSuche: unknown[] = [];
vi.mock('@/lib/zoe/vault', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/zoe/vault')>()),
  brainAnweisung: async () => '',
  suche: vi.fn(async (...a: unknown[]) => { vaultSuche.push(a); return { treffer: [], durchsucht: 0 }; }),
}));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

const HAUS = 'haus-sw';
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt: string, extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

// Kanarienvögel: privat (Selbstständigkeit) — dürfen nie in einer Business-Sicht stehen.
const PRIVAT_STAND = 4711.13;
const PRIVAT_KUNDE = 'Kanarien-Kunde';

let db: typeof import('@/lib/store/local-db');
let W: typeof import('@/lib/zoe/werkzeuge');
type Plan = { firmen: { id: string; kontostand: number | null; stand: string | null }[]; rechnungen: { id: string; firmaId: string; kunde: string; status: string; bezahltAm?: string; betrag: number }[]; zahlungen: { id: string; firmaId: string; an: string; betrag: number }[] };
const plan = async () => (await db.loadJson<Plan>('finanzplan'))!;
const lauf = (name: string, eingabe: Record<string, unknown>, person?: string, kontext?: Record<string, unknown>) => W.WERKZEUGE[name].lauf(eingabe, 'http://test', person, kontext as never);
const protokoll = async () => {
  const { protokollMonat, monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
  return protokollMonat(HAUS, monatBerlin());
};
const heute = async () => (await import('@/lib/zeit')).localDay();

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'pia', 'inhaber', HAUS),
    konto('k2', 'olaf', 'mitglied', HAUS),
    konto('k3', 'bea', 'mitglied', HAUS, { finanzRecht: 'business' }),
    konto('k4', 'fremd', 'mitglied', 'anders-haus'),
  ], einladungen: [] });
  await db.saveJson('finanzplan', {
    firmen: [
      { id: 'kdv', name: 'Probe Ventures', bank: '', kontostand: 1000, stand: '2026-10-01' },
      { id: 'kdc', name: 'Probe Selbst', bank: '', kontostand: PRIVAT_STAND, stand: '2026-10-01' },
      { id: 'ug', name: 'Probe GmbH', bank: '', kontostand: null, stand: null },
    ],
    rechnungen: [
      { id: 'r-kdv-1', firmaId: 'kdv', kunde: 'Beispiel GmbH', titel: 'Beratung', betrag: 3000, status: 'gestellt', faellig: '2026-10-20' },
      { id: 'r-kdc-1', firmaId: 'kdc', kunde: PRIVAT_KUNDE, titel: 'Privatleistung', betrag: 999, status: 'gestellt' },
    ],
    zahlungen: [], merkposten: [],
  });
  await db.saveJson('liquiplan', { posten: [
    { id: 'lp-miete', titel: 'Miete Probe', betrag: -500, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdv' },
    { id: 'lp-privat', titel: 'Privat-Abo Probe', betrag: -10, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc' },
  ] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-tom-1', vorname: 'Tom', nachname: 'Probe', telefon: '+49 30 1111111', email: 'tom@example.invalid', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' },
    { id: 'c-uwe-1', vorname: 'Uwe', nachname: 'Probe', email: 'uwe@example.invalid', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' },
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  await db.saveJson('crm', leererBestand());
  await db.saveJson('ziele', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-privat-1', titel: 'Privatziel Probe', space: 'privat', fortschritt: 0, erledigt: false }], fokus: {} });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'ms-a', titel: 'Launch Probe', fortschritt: 0, erledigt: false, faellig: '2026-12-01', space: 'business', bereich: 'business' },
    { id: 'ms-b', titel: 'Vertrag Probe', fortschritt: 0, erledigt: false, faellig: '2026-11-01', space: 'business', bereich: 'business' },
  ] });
  W = await import('@/lib/zoe/werkzeuge');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Finanz-Werkzeuge schreiben nur über die Route (Funde #1)', () => {
  it('setze_kontostand: auf den Cent, Stand heute, Änderungsprotokoll mit ZOE + Person', async () => {
    expect(await lauf('setze_kontostand', { firma: 'kdv', betrag: 1234.56 }, 'pia')).toMatch(/^Erfasst: Kontostand/);
    const kdv = (await plan()).firmen.find(f => f.id === 'kdv')!;
    expect(kdv.kontostand).toBe(1234.56);
    expect(kdv.stand).toBe(await heute());
    expect((await protokoll()).some(e => e.bestand === 'finanzplan' && e.wer === 'zoe' && e.person === 'pia' && e.id === 'kdv')).toBe(true);
  });

  it('ein Konto „nur Business“ schreibt über ZOE NIE in die Finanzbestände (auch nicht Business-Firmen) — nichts gespeichert', async () => {
    const vorher = JSON.stringify(await plan());
    for (const [n, e] of [['setze_kontostand', { firma: 'kdv', betrag: 1 }], ['erfasse_rechnung', { kunde: 'Neu GmbH', firma: 'kdv', betrag: 5 }], ['erfasse_zahlung', { an: 'X', betrag: 1, firma: 'kdv' }]] as const) {
      expect(await lauf(n, e, 'bea'), n).toMatch(/^Nicht ausgeführt: .*Zugang/);
    }
    expect(await lauf('erfasse_planposten', { titel: 'Neu Probe', betrag: -5, firma: 'kdv' }, 'bea')).toMatch(/^Nicht ausgeführt: .*Zugang/);
    expect(JSON.stringify(await plan())).toBe(vorher);
    expect((await db.loadJson<{ posten: unknown[] }>('liquiplan'))!.posten).toHaveLength(2);
  });

  it('ohne Person (Systemlauf) und aus einem fremden Haushalt: nichts', async () => {
    const vorher = JSON.stringify(await plan());
    expect(await lauf('setze_kontostand', { firma: 'kdv', betrag: 7 })).toMatch(/^Nicht ausgeführt/);
    expect(await lauf('setze_kontostand', { firma: 'kdv', betrag: 7 }, 'fremd')).toMatch(/^Nicht ausgeführt/);
    expect(await lauf('setze_ziele', { zielUmsatz: 99 }, 'fremd')).toMatch(/^Nicht ausgeführt/);
    expect(JSON.stringify(await plan())).toBe(vorher);
    expect(await db.loadJson('finance')).toBeNull();
  });

  it('erfasse_rechnung „bezahlt“ wie der Klick: Status, bezahltAm und Buchung bu-re-<id> in einem Schritt', async () => {
    expect(await lauf('erfasse_rechnung', { kunde: 'Beispiel GmbH', firma: 'kdv', status: 'bezahlt' }, 'pia')).toMatch(/als bezahlt vermerkt/);
    const r = (await plan()).rechnungen.find(x => x.id === 'r-kdv-1')!;
    expect(r.status).toBe('bezahlt');
    expect(r.bezahltAm).toBe(await heute());
    const b = (await db.loadJson<{ buchungen: { id: string; rechnungId?: string; betrag: number }[] }>('buchungen'))!.buchungen;
    expect(b.filter(x => x.id === 'bu-re-r-kdv-1')).toHaveLength(1);
    // Noch einmal: schon bezahlt — keine zweite Buchung.
    expect(await lauf('erfasse_rechnung', { kunde: 'Beispiel GmbH', firma: 'kdv', status: 'bezahlt' }, 'pia')).toMatch(/schon bezahlt/);
    expect((await db.loadJson<{ buchungen: { id: string }[] }>('buchungen'))!.buchungen.filter(x => x.id === 'bu-re-r-kdv-1')).toHaveLength(1);
  });

  it('erfasse_rechnung fasst nie die Rechnung einer Privat-Einheit an; dieselbe Freigabe zweimal legt nichts doppelt an', async () => {
    const k = { vorschlagId: 'v-probe-rechnung-1' };
    expect(await lauf('erfasse_rechnung', { kunde: PRIVAT_KUNDE, firma: 'kdv', betrag: 12.5 }, 'pia', k)).toMatch(/^Erfasst: Neue Rechnung/);
    expect(await lauf('erfasse_rechnung', { kunde: PRIVAT_KUNDE, firma: 'kdv', betrag: 12.5 }, 'pia', k)).toMatch(/^Erfasst/);
    const p = await plan();
    expect(p.rechnungen.filter(x => x.kunde === PRIVAT_KUNDE && x.firmaId === 'kdv')).toHaveLength(1);
    expect(p.rechnungen.find(x => x.firmaId === 'kdv' && x.kunde === PRIVAT_KUNDE)!.betrag).toBe(12.5);
    expect(p.rechnungen.find(x => x.id === 'r-kdc-1')).toMatchObject({ betrag: 999, status: 'gestellt' });
  });

  it('erfasse_zahlung: auf den Cent, nur Business-Gesellschaft, idempotent je Vorschlag', async () => {
    const k = { vorschlagId: 'v-probe-zahlung-1' };
    expect(await lauf('erfasse_zahlung', { an: 'Vermieter Probe', betrag: 12.34, firma: 'kdv' }, 'pia', k)).toMatch(/^Erfasst: Zahlung/);
    expect(await lauf('erfasse_zahlung', { an: 'Vermieter Probe', betrag: 12.34, firma: 'kdv' }, 'pia', k)).toMatch(/schon da/);
    const z = (await plan()).zahlungen.filter(x => x.an === 'Vermieter Probe');
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ betrag: 12.34, firmaId: 'kdv' });
  });

  it('setze_ziele über die Controlling-Route: ein Business-Partner darf (Klasse „haushalt“), das Protokoll schreibt', async () => {
    expect(await lauf('setze_ziele', { zielUmsatz: 120000, startMonat: 'Juni' }, 'bea')).toMatch(/^Erfasst: Ziel-Umsatz/);
    const f = (await db.loadJson<{ zielUmsatz: number; startMonat?: number }>('finance'))!;
    expect(f).toMatchObject({ zielUmsatz: 120000, startMonat: 5 });
    expect((await protokoll()).some(e => e.bestand === 'finance' && e.person === 'bea')).toBe(true);
  });
});

describe('Kein stiller Rückfall auf die Privat-Einheit (Funde #3)', () => {
  it('businessFirmaAus: ohne Angabe nur die einzige Business-Gesellschaft, Privat-Einheit abgelehnt, Unbekanntes abgelehnt', async () => {
    const { businessFirmaAus, BUSINESS_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    expect(BUSINESS_GESELLSCHAFTEN.length).toBeGreaterThan(1);
    expect(businessFirmaAus('')).toMatchObject({ ok: false });
    expect(businessFirmaAus('kdc')).toMatchObject({ ok: false });
    expect(businessFirmaAus('Pilot GmbH')).toMatchObject({ ok: false });
    expect(businessFirmaAus('kdv')).toEqual({ ok: true, firma: 'kdv' });
  });
  it('setze_kontostand/erfasse_zahlung/erfasse_planposten ohne bzw. mit Privat-Einheit: nichts gespeichert', async () => {
    const vorher = JSON.stringify(await plan());
    expect(await lauf('setze_kontostand', { betrag: 50 }, 'pia')).toMatch(/^Nicht erfasst: firma fehlt/);
    expect(await lauf('setze_kontostand', { betrag: 50, firma: 'kdc' }, 'pia')).toMatch(/^Nicht erfasst: .*gehört zu Privat/);
    expect(await lauf('erfasse_zahlung', { an: 'Ohne Firma', betrag: 5 }, 'pia')).toMatch(/^Nicht erfasst: firma fehlt/);
    expect(await lauf('erfasse_planposten', { titel: 'Selbst Probe', betrag: -5, firma: 'kdc' }, 'pia')).toMatch(/^Nicht erfasst/);
    expect(await lauf('erfasse_planposten', { titel: 'Privat-Abo Probe', betrag: -99, firma: 'kdv' }, 'pia')).toMatch(/gehört zu Privat/);
    expect(JSON.stringify(await plan())).toBe(vorher);
    const lp = (await db.loadJson<{ posten: { titel: string; betrag: number }[] }>('liquiplan'))!.posten;
    expect(lp.map(p => p.titel)).toEqual(['Miete Probe', 'Privat-Abo Probe']);
    expect(lp[1].betrag).toBe(-10);
  });
  it('Agenten-Schema: erfasse_zahlung trägt die Gesellschaft nur aus dem Business', async () => {
    const { REGISTER_DEFS } = await import('@/lib/agenten/werkzeuge');
    const props = (REGISTER_DEFS.get('erfasse_zahlung')!.input_schema as { properties: Record<string, { enum?: string[] }> }).properties;
    expect(props.firma?.enum).toEqual(['kdv', 'ug']);
  });
});

describe('Stapel, kimmi, Agenten: Konto „nur Business“ bekommt die Finanz-Altweg-Werkzeuge nicht (Funde #1)', () => {
  it('Vorschlag des Systems: „nur Business“ sieht ihn nicht und kann ihn nicht freigeben; die Vorschau zeigt ihm keinen Kontostand', async () => {
    const { lege, hole } = await import('@/lib/zoe/stapel');
    const v = await lege({ werkzeug: 'setze_kontostand', gruppe: 'finanzen', titel: 'Kontostand setzen', nachher: '2.222 €', eingabe: { firma: 'kdv', betrag: 2222 }, quelle: 'lauf' });
    const route = await import('@/app/api/zoe/stapel/route');
    const liste = async (p: string) => ((await (await route.GET(anfrage('/api/zoe/stapel', sitzung(p)))).json()) as { vorschlaege: { id: string }[] }).vorschlaege.map(x => x.id);
    expect(await liste('bea')).not.toContain(v.id);
    expect(await liste('pia')).toContain(v.id);
    const nein = await route.POST(anfrage('/api/zoe/stapel', sitzung('bea'), 'POST', { id: v.id, entscheidung: 'freigeben' }));
    expect(nein.status).toBe(404);
    expect((await hole(v.id))!.status).toBe('offen');
    const ja = await route.POST(anfrage('/api/zoe/stapel', sitzung('pia'), 'POST', { id: v.id, entscheidung: 'freigeben' }));
    expect(ja.status).toBe(200);
    expect((await plan()).firmen.find(f => f.id === 'kdv')!.kontostand).toBe(2222);
    const { vorschauVon } = await import('@/lib/zoe/register');
    const vs = await vorschauVon('setze_kontostand', { firma: 'kdv', betrag: 1 }, 'bea');
    expect(JSON.stringify(vs)).not.toMatch(/2\.222|2222/);
    expect(JSON.stringify(await vorschauVon('setze_kontostand', { firma: 'kdc', betrag: 1 }, 'pia'))).not.toContain('4.711');
  });

  it('kimmi bietet setze_kontostand nur mit privatem Finanzzugang an', async () => {
    const { POST } = await import('@/app/api/kimmi/route');
    const zug = async (p: string) => {
      mitschnitt.length = 0;
      const r = await POST(anfrage('/api/kimmi', sitzung(p), 'POST', { message: 'Setz den Kontostand und erfasse die Rechnung und den Planposten' }));
      expect(r.status).toBe(200);
      return mitschnitt[0].tools.map(t => t.name);
    };
    expect(await zug('pia')).toContain('setze_kontostand');
    const bea = await zug('bea');
    for (const n of ['setze_kontostand', 'erfasse_rechnung', 'erfasse_zahlung', 'erfasse_planposten']) expect(bea, n).not.toContain(n);
  });

  it('Agenten-Angebot: ohne privaten Finanzzugang fallen die Finanz-Altweg-Werkzeuge weg', async () => {
    const { werkzeugAngebot } = await import('@/lib/agenten/werkzeuge');
    const { headDef } = await import('@/lib/agenten/katalog');
    const { LESEND } = await import('@/lib/zoe/gespraech-schutz');
    const head = headDef('finanzen')!;
    const s = { hintergrund: true, websuche: true, bereiche: { crm: true, kalender: true, aufgaben: true, finanzen: true, brain: true, familie: true } };
    const basis = { art: 'head' as const, liste: head.werkzeuge, kategorien: head.kategorien, schalter: s, gesundheitKi: false, head, mitarbeiter: [], brett: false, helfer: false, offeneFragen: false, lesend: LESEND };
    expect(Array.from(werkzeugAngebot({ ...basis, privatFinanzen: true }).register)).toContain('setze_kontostand');
    const ohne = Array.from(werkzeugAngebot({ ...basis, privatFinanzen: false }).register);
    for (const n of ['setze_kontostand', 'erfasse_rechnung', 'erfasse_zahlung', 'erfasse_planposten']) expect(ohne, n).not.toContain(n);
    expect(ohne).toContain('setze_ziele');
  });
});

describe('Head of Finance Business: Sicht Business bekommt nichts aus Privat (Funde #2)', () => {
  const grundlageRoh = { s: { invOut: [
    { id: 'p1', dat: '2026-10-05', typ: 'ein', kunde: 'Kanarien-Grosskunde', leistung: 'Beratung', br: 11900, ne: 10000 },
    { id: 'p2', dat: '2026-10-20', typ: 'priv', kunde: 'Entnahme', br: 2000, ne: 2000 },
  ] } };

  it('Finanzbild ohne Haushalt: keine Grundlage der Privat-Einheit, keine Einkommensteuer; mit Haushalt wie bisher', async () => {
    const { baueFinanzbild } = await import('@/lib/finanzen/chef/finanzbild');
    const { lesen } = await import('@/lib/make-one/grundlage');
    const { STANDARD_EINSTELLUNG } = await import('@/lib/finanzen/chef/steuertermine');
    const { testHaushalt } = await import('@/lib/finanzen/haushalt/testdaten');
    const { leereMeta } = await import('@/lib/finanzen/haushalt/speicher');
    const e = {
      heute: '2026-11-01', finance: null, plan: { firmen: [{ id: 'kdv', name: 'Probe Ventures', kontostand: 1000, stand: '2026-10-30' }], rechnungen: [], zahlungen: [], merkposten: [] },
      planposten: [], grundlage: { g: lesen(grundlageRoh, '2026-10-31'), stand: '2026-10-31' }, steuer: { ...STANDARD_EINSTELLUNG, ruecklageQuote: null },
    };
    const business = baueFinanzbild({ ...e, haushalt: null });
    const text = JSON.stringify(business);
    expect(text).not.toContain('Kanarien-Grosskunde');
    expect(business.business.grundlage).toBeNull();
    expect(business.steuern.termine_60_tage.some(t => t.art === 'est')).toBe(false);
    expect(business.steuern.einstellung.estVorauszahlung).toBe(false);
    const voll = baueFinanzbild({ ...e, haushalt: { ...testHaushalt('2026-11-01'), meta: { ...leereMeta(), steuerquote: 30 } } });
    expect(JSON.stringify(voll)).toContain('Kanarien-Grosskunde');
    expect(voll.steuern.termine_60_tage.some(t => t.art === 'est')).toBe(true);
  });

  it('Kontext des Business-Heads (auch für ein Konto „nur Business“) und GET /api/finanzchef ohne Privates', async () => {
    await db.saveJson('grundlage', { roh: grundlageRoh, stand: '2026-10-31' });
    await db.saveJson('finanzchef-einstellung', { rechtsform: { kdv: 'UG', kdc: 'PRIVAT-RECHTSFORM' } });
    const { kontextFuer } = await import('@/lib/agenten/kontext');
    const { headDef } = await import('@/lib/agenten/katalog');
    const { sichtLaden } = await import('@/lib/agenten/faeden-server');
    const k = await kontextFuer({ head: headDef('finanzen')!, sicht: await sichtLaden('bea'), kategorien: ['finanzen', 'crm', 'aufgaben'] });
    expect(k.text).toContain('FINANZBILD BUSINESS');
    expect(k.text).not.toContain('Kanarien-Grosskunde');
    expect(k.text).not.toContain(String(PRIVAT_STAND));
    expect(k.text).not.toContain(PRIVAT_KUNDE);
    const { GET } = await import('@/app/api/finanzchef/route');
    const r = await GET(anfrage('/api/finanzchef', sitzung('bea')));
    expect(r.status).toBe(200);
    const t = JSON.stringify(await r.json());
    expect(t).not.toContain('Kanarien-Grosskunde');
    expect(t).not.toContain('PRIVAT-RECHTSFORM');
    expect(t).not.toContain(String(PRIVAT_STAND));
  });
});

describe('CRM-Altwerkzeuge auf dem einen Weg (Funde #4)', () => {
  const tom = async () => (await db.loadJson<{ kontakte: { id: string; aktivitaeten: { art: string; quelle?: string; anlass?: string; vorschlagId?: string; freigegebenVon?: string }[]; werbesperre?: unknown }[] }>('kontakte'))!.kontakte;
  it('notiere_kontakt: Anruf bei gelber Telefon-Ampel nur mit Anlass (§ 7 UWG); mit Anlass als ZOE-Eintrag; Wiederholung nichts doppelt', async () => {
    expect(await lauf('notiere_kontakt', { kontakt: 'c-tom-1', art: 'anruf', ergebnis: 'gespraech' }, 'pia', { vorschlagId: 'v-probe-notiz-1', freigegebenVon: 'pia' })).toMatch(/^Nicht notiert: Anruf/);
    expect((await tom()).find(k => k.id === 'c-tom-1')!.aktivitaeten).toHaveLength(0);
    const k = { vorschlagId: 'v-probe-notiz-2', freigegebenVon: 'pia' };
    expect(await lauf('notiere_kontakt', { kontakt: 'c-tom-1', art: 'anruf', ergebnis: 'gespraech', anlass: 'Rückfrage zu seiner Anfrage' }, 'pia', k)).toMatch(/^Notiert: Tom Probe · anruf/);
    expect(await lauf('notiere_kontakt', { kontakt: 'c-tom-1', art: 'anruf', ergebnis: 'gespraech', anlass: 'Rückfrage zu seiner Anfrage' }, 'pia', k)).toMatch(/schon da/);
    const a = (await tom()).find(x => x.id === 'c-tom-1')!.aktivitaeten;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ art: 'anruf', quelle: 'zoe', anlass: 'Rückfrage zu seiner Anfrage', vorschlagId: 'v-probe-notiz-2', freigegebenVon: 'pia' });
  });
  it('notiere_kontakt „sperre“ setzt die Werbesperre UND trägt die Person auf die Sperrliste', async () => {
    expect(await lauf('notiere_kontakt', { kontakt: 'c-uwe-1', art: 'gespraech', ergebnis: 'sperre', text: 'Will keine Werbung' }, 'pia', { vorschlagId: 'v-probe-sperre-1' })).toMatch(/WERBESPERRE/);
    expect((await tom()).find(k => k.id === 'c-uwe-1')!.werbesperre).toBeTruthy();
    const sl = await db.loadJson<{ eintraege: { grund: string }[] }>(`crm-sperrliste--${HAUS}`);
    expect(sl?.eintraege.some(e => e.grund === 'werbesperre')).toBe(true);
  });
  it('chance_anlegen über die Deal-Route: dieselbe Freigabe zweimal (auch mit „trotzdem“) ergibt EINEN Deal', async () => {
    const k = { vorschlagId: 'v-probe-deal-1' };
    const e = { kontakt: 'c-tom-1', naechster_schritt: 'Angebot schicken', faellig: '2026-12-01', wert_monat: 1000, trotzdem: true };
    expect(await lauf('chance_anlegen', e, 'pia', k)).toMatch(/^Deal angelegt/);
    expect(await lauf('chance_anlegen', e, 'pia', k)).toMatch(/schon da/);
    const crm = (await db.loadJson<{ chancen: { id: string }[] }>('crm'))!;
    expect(crm.chancen.filter(c => c.id === 'ch-v-probe-deal-1')).toHaveLength(1);
  });
});

describe('Meilenstein und Fokus über die Routen (Funde #5)', () => {
  it('setze_meilenstein: Bezugsprüfung der Route (Business-Meilenstein → Privat-Ziel abgelehnt), Kette, Protokoll', async () => {
    expect(await lauf('setze_meilenstein', { titel: 'Launch', ziel: 'Privatziel' }, 'pia')).toMatch(/^Fehlgeschlagen/);
    const ms = async () => (await db.loadJson<{ meilensteine: { id: string; zielId?: string; wartetAuf?: string[]; fortschritt: number }[] }>('meilensteine'))!.meilensteine;
    expect((await ms()).find(m => m.id === 'ms-a')!.zielId).toBeUndefined();
    expect(await lauf('setze_meilenstein', { titel: 'Launch', wartet_auf: ['Vertrag'], fortschritt: 40 }, 'pia')).toMatch(/^Erfasst: Meilenstein/);
    expect((await ms()).find(m => m.id === 'ms-a')).toMatchObject({ wartetAuf: ['ms-b'], fortschritt: 40 });
    // Kreis: der Vertrag wartet auf den Launch, der auf den Vertrag wartet → von der Route abgelehnt, nichts geändert.
    expect(await lauf('setze_meilenstein', { titel: 'Vertrag', wartet_auf: ['Launch'] }, 'pia')).toMatch(/^Fehlgeschlagen/);
    expect((await ms()).find(m => m.id === 'ms-b')!.wartetAuf).toBeUndefined();
    expect((await protokoll()).some(e => e.bestand === 'meilensteine' && e.id === 'ms-a')).toBe(true);
    // Die Liste je Meilenstein entsteht im Schreibweg der Route (meilensteinStrukturSichern).
    const tasks = await db.loadJson<{ listen?: { id: string }[] }>('tasks');
    expect((tasks?.listen ?? []).some(l => l.id.startsWith('lm-') && l.id.includes('ms-a'))).toBe(true);
  });
  it('setze_fokus über PUT /api/state/ziele: gemeinsamer Bestand, Protokoll ohne den Satz', async () => {
    expect(await lauf('setze_fokus', { horizont: 'woche', space: 'business', text: 'Fokus-Probe' }, 'pia')).toMatch(/^Erfasst: Fokus/);
    expect((await db.loadJson<{ fokus: Record<string, string> }>('ziele'))!.fokus['business:woche']).toBe('Fokus-Probe');
    const p = (await protokoll()).filter(e => e.bestand === 'ziele');
    expect(p.length).toBeGreaterThan(0);
    expect(JSON.stringify(p)).not.toContain('Fokus-Probe');
    expect(await lauf('setze_fokus', { horizont: 'woche', text: 'x' })).toMatch(/^Nicht ausgeführt/);
  });
});

describe('suche_arbeit nach KI-Schaltern und Mitgliedschaft (Funde #6)', () => {
  it('arbeitQuellen: Brain/Markttraktion aus → nicht gelesen und nicht im KI-Protokoll', async () => {
    const { arbeitQuellen } = await import('@/lib/zoe/arbeit-werkzeug');
    expect(arbeitQuellen({}, { aufgaben: true, crm: true, brain: true }).kategorien.sort()).toEqual(['aufgaben', 'brain', 'crm']);
    const ohne = arbeitQuellen({}, { aufgaben: true, crm: false, brain: false });
    expect(ohne).toMatchObject({ brain: false, kategorien: ['aufgaben'] });
    expect(ohne.arten).not.toContain('angebot');
    expect(ohne.arten).not.toContain('mandat');
    expect(arbeitQuellen({ art: 'mandat' }, { aufgaben: true, crm: false, brain: true }).arten).toEqual([]);
  });
  it('ein Konto „nur Business“ findet keine Treffer aus dem Privat-Space; ausgeschaltetes Brain wird nicht durchsucht', async () => {
    const A = await import('@/lib/brain/app-index');
    const aufrufe: { privat: boolean; arten?: readonly string[] }[] = [];
    const spy = vi.spyOn(A, 'appSuche').mockImplementation((_f, sicht, _n, arten) => { aufrufe.push({ privat: sicht.privat, arten }); return { treffer: [], durchsucht: 0 }; });
    vi.spyOn(A, 'appIndexAktualisieren').mockResolvedValue(undefined as never);
    await lauf('suche_arbeit', { frage: 'Probe' }, 'bea');
    await lauf('suche_arbeit', { frage: 'Probe' }, 'olaf');
    expect(aufrufe.map(a => a.privat)).toEqual([false, true]);
    expect(vaultSuche.length).toBe(2);
    const { aendereKiEinstellungen } = await import('@/lib/datenschutz/ki-einstellungen');
    await aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), olaf: { bereiche: { brain: false, crm: false } } } }));
    const text = await lauf('suche_arbeit', { frage: 'Probe' }, 'olaf');
    expect(text).toMatch(/nicht durchsucht: Brain, Angebote\/Mandate/);
    expect(aufrufe.at(-1)!.arten).toEqual(['aufgabe', 'kommentar', 'projekt']);
    expect(vaultSuche.length).toBe(2);
    const { arbeitKategorien } = await import('@/lib/zoe/arbeit-werkzeug');
    expect(await arbeitKategorien({ frage: 'Probe' }, 'olaf')).toEqual(['aufgaben']);
    spy.mockRestore();
    await aendereKiEinstellungen(d => ({ ...d, personen: {} }));
  });
});

describe('Kleines (Funde klein)', () => {
  it('haushalt_* tragen „finanzen-privat“ und hängen am Schalter Finanzen; hake_routine ist neutral (prüft je Routine selbst)', async () => {
    const { kategorieVonWerkzeug, werkzeugSperre } = await import('@/lib/datenschutz/ki-werkzeuge');
    expect(kategorieVonWerkzeug('haushalt_stand', 'haushalt')).toBe('finanzen-privat');
    const aus = { hintergrund: true, websuche: true, bereiche: { crm: true, kalender: true, aufgaben: true, finanzen: false, brain: true, familie: true } };
    expect(werkzeugSperre('finanzen-privat', aus, false)).toMatch(/Finanzen/);
    expect(kategorieVonWerkzeug('hake_routine', 'gesundheit')).toBeNull();
  });
  it('hake_routine: eine Business-Routine ohne Gesundheits-Einwilligung „an die KI“ — Privat-Routinen nicht', async () => {
    await db.saveJson('routinen', { routinen: [
      { id: 'r-biz', label: 'Wochenplanung Probe', aktiv: true, space: 'business', owner: 'pia' },
      { id: 'r-priv', label: 'Dehnen Probe', aktiv: true, space: 'privat', owner: 'pia' },
    ] });
    const { fuehreAus } = await import('@/lib/zoe/ausfuehren');
    const ok = await fuehreAus('hake_routine', { routine: 'Wochenplanung' }, 'http://test', { person: 'pia' });
    expect(ok.text).toMatch(/^Abgehakt: Wochenplanung Probe/);
    const priv = await fuehreAus('hake_routine', { routine: 'Dehnen' }, 'http://test', { person: 'pia' });
    expect(priv.text).toMatch(/Keine Routine passt/);
    expect(priv.text).not.toContain('Dehnen Probe');
  });
  it('der Brain-Block der Prospecting-Firmen heißt nicht mehr „PIPELINE“ (die Deals liest ZOE über `pipeline`)', async () => {
    const { blockPipeline } = await import('@/lib/brain');
    const t = blockPipeline({ pipeline: { gesamt: 2, hot: 1, kontaktiert: 0 } } as never);
    expect(t).toContain('PROSPECTING');
    expect(t).not.toMatch(/PIPELINE:/);
  });
});

describe('Wächter: kein ZOE-Werkzeug schreibt an den Routen vorbei', () => {
  it('lib/zoe schreibt finanzplan/liquiplan/finance/meilensteine/ziele und die Kartei nie direkt', () => {
    const wurzel = path.join(__dirname, '..', 'lib', 'zoe');
    const funde: string[] = [];
    for (const d of readdirSync(wurzel).filter(x => x.endsWith('.ts'))) {
      const t = readFileSync(path.join(wurzel, d), 'utf8');
      if (/update(?:Json|JsonAsync)\s*(?:<[^>]*>)?\(\s*'(?:finanzplan|liquiplan|finance|meilensteine|ziele)'/.test(t)) funde.push(`${d}: updateJson auf Finanz-/Planungsbestand`);
      if (/aendereKontakte\s*(?:<[^>]*>)?\(/.test(t) && d === 'werkzeuge.ts') funde.push(`${d}: aendereKontakte direkt`);
    }
    expect(funde).toEqual([]);
  });
});
