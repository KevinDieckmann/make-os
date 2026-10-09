// ─── Wächter: Agenten-Bereich Paket 4b — Einstellungen, Not-Aus, Budget, Takt (09.10., AGENTEN_KONZEPT.md C11 Entscheidung 10) ─────
// Rechte je Sicht beim Schreiben (volles Mitglied · Business-Partner · fremder Haushalt · Dienstweg; Privat-Heads nur die Person selbst,
// „Sicht X bekommt nichts aus Y“), Not-Aus stoppt Lauf UND Takt (je Head und für alle), Budget 80/95/100 % und die 50-€-Grenze (Monat
// und gesamt), Budget je Head, Daumen (`bewerten`), Geplant pausieren mit Stand, Plan-Freigabe über den Stapel, Probelauf eines
// Mitarbeiters, Business-frei-Nachholen, Heads im Takt ohne festes Kürzel, KI-Schalter `familie`, `finanzen-privat` nur mit privatem
// Finanzzugang, Konto löschen. Eigener Datenordner, erfundene Konten — Netz gesperrt, kein Modell.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rmSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-p4b-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-agenten-p4b';
  process.env.MAKE_OS_KI_VORGABE = 'kompatibel';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.MAKE_OS_KI_BUDGET_EURO;
  return o;
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/agenten' }));

const echtesFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

import { einstellungBestand, fadenBestand, planBestand, LAUF_AGENT, type AgentenEinstellung, type Faden, type HeadKarte } from '@/lib/agenten/typen';
import { wandzeit, tagVon } from '@/lib/kalender/zeit';

type H = (r: Request) => Promise<Response>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(p ? { 'x-make-person': p } : {}) });
const anfrage = async (h: H, url: string, methode: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${url}`, { method: methode, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  const text = await r.text();
  let j: J = {};
  try { j = JSON.parse(text); } catch { /* kein JSON */ }
  return { status: r.status, j, text };
};
let agenten: { GET: H; POST: H };
let faden: { POST: H };
let lauf: { POST: H };
let laeufe: { GET: H; POST: H };
let ki: { GET: H; PUT: H };
let skills: { POST: H };

const JETZT = new Date();
const VOR = (min: number) => new Date(JETZT.getTime() - min * 60_000).toISOString();
const HEUTE = tagVon(wandzeit(JETZT));
const FREMD_MARKE = 4321;
const fd = (id: string, besitzer: string, extra: Partial<Faden> = {}): Faden => ({
  id, besitzer, agent: { art: 'mitarbeiter', headId: 'marketing', mitarbeiterId: 'marketing-kampagnen' }, bereich: 'business', titel: `Thread ${id}`, status: 'laeuft',
  fremdGelesen: false, vertraulich: false, nachrichten: [], erstellt: VOR(30), aktualisiert: VOR(1), ...extra,
});
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `Name ${speicher}`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }),
    konto('k2', 'person-b', 'mitglied', { haushalt: 'haus-a' }),
    konto('k3', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
    konto('k4', 'nur-business', 'mitglied', { haushalt: 'haus-a', finanzRecht: 'business' }),
  ], einladungen: [] });
  agenten = await import('@/app/api/agenten/route') as unknown as typeof agenten;
  faden = await import('@/app/api/agenten/faden/route') as unknown as typeof faden;
  lauf = await import('@/app/api/agenten/faden/lauf/route') as unknown as typeof lauf;
  laeufe = await import('@/app/api/agenten/laeufe/route') as unknown as typeof laeufe;
  ki = await import('@/app/api/datenschutz/ki/route') as unknown as typeof ki;
  skills = await import('@/app/api/agenten/skills/route') as unknown as typeof skills;
});

const getAgenten = (p: string) => anfrage(agenten.GET, '/api/agenten', 'GET', sitzung(p));
const postAgenten = (p: string, body: unknown, kopf: Record<string, string> = sitzung(p)) => anfrage(agenten.POST, '/api/agenten', 'POST', kopf, body);
const kopfVon = (j: J, id: string): HeadKarte | undefined => (j.heads as HeadKarte[] | undefined)?.find(h => h.id === id);

// ── Einstellungen schreiben: Rechte je Sicht ─────────────────────────────────────────────────────────────────────────────

describe('Einstellungen je Head — Rechte je Sicht beim Schreiben', () => {
  it('GET liefert je Head die Einstellungen (Stand, Rechte), das Budget und die wählbaren Personen', async () => {
    const r = await getAgenten('person-b');
    expect(r.status).toBe(200);
    const sales = kopfVon(r.j, 'sales')!;
    expect(sales.einstellung?.aendern).toBe(true);
    expect(sales.einstellung?.stand).toMatch(/^es-/);
    expect(sales.einstellung?.vorgabe.stufe).toBe('ausgewogen');
    expect(r.j.budget?.monat.grenzeCent).toBeNull();
    expect(r.j.budget?.setzen).toBe(false);
    expect(r.j.notAusAendern).toBe(true);
    expect((r.j.personen as { id: string }[]).map(p => p.id)).toEqual(['person-a', 'person-b', 'nur-business']);
  });

  it('volles Mitglied ändert einen Business-Head mit Stand — veralteter Stand 409, nichts überschrieben', async () => {
    const stand = kopfVon((await getAgenten('person-b')).j, 'sales')!.einstellung!.stand;
    const ok = await postAgenten('person-b', { aktion: 'einstellung', headId: 'sales', teil: { stufe: 'stark', aufwand: 'high' }, stand });
    expect(ok.status).toBe(200);
    expect(ok.j.felder).toEqual(['stufe', 'aufwand']);
    const alt = await postAgenten('person-a', { aktion: 'einstellung', headId: 'sales', teil: { stufe: 'schnell' }, stand });
    expect(alt.status).toBe(409);
    const e = await db.loadJson<AgentenEinstellung>(einstellungBestand('haus-a'));
    expect(e?.heads.sales?.stufe).toBe('stark');
    expect(e?.heads.sales?.geaendertVon).toBe('person-b');
    const sicht = kopfVon((await getAgenten('person-a')).j, 'sales')!.einstellung!;
    expect(sicht.stufe).toBe('stark');
    expect(sicht.aufwand).toBe('high');
  });

  it('Business-Partner: Einstellungen eines Business-Heads nein, Privat-Head nein, Not-Aus für alle nein — Not-Aus des Business-Heads ja', async () => {
    const sales = kopfVon((await getAgenten('nur-business')).j, 'sales')!;
    expect(sales.einstellung?.aendern).toBe(false);
    const r1 = await postAgenten('nur-business', { aktion: 'einstellung', headId: 'sales', teil: { stufe: 'schnell' }, stand: sales.einstellung!.stand });
    expect(r1.status).toBe(403);
    const r2 = await postAgenten('nur-business', { aktion: 'einstellung', headId: 'assistenz', teil: { stufe: 'schnell' }, stand: 'es-0' });
    expect(r2.status).toBe(403);
    const r3 = await postAgenten('nur-business', { aktion: 'not-aus', an: true });
    expect(r3.status).toBe(403);
    const r4 = await postAgenten('nur-business', { aktion: 'not-aus', an: true, headId: 'assistenz' });
    expect(r4.status).toBe(403);
    const r5 = await postAgenten('nur-business', { aktion: 'not-aus', an: true, headId: 'research' });
    expect(r5.status).toBe(200);
    expect((await db.loadJson<AgentenEinstellung>(einstellungBestand('haus-a')))?.heads.research?.notAus?.von).toBe('nur-business');
    expect((await postAgenten('nur-business', { aktion: 'not-aus', an: false, headId: 'research' })).status).toBe(200);
    expect((await getAgenten('nur-business')).j.notAusAendern).toBe(false);
  });

  it('fremder Haushalt und Dienstweg: 403 — auch mit Person', async () => {
    expect((await postAgenten('gast', { aktion: 'not-aus', an: true })).status).toBe(403);
    expect((await getAgenten('gast')).status).toBe(403);
    expect((await postAgenten('person-a', { aktion: 'not-aus', an: true }, dienst('person-a'))).status).toBe(403);
    expect((await anfrage(agenten.GET, '/api/agenten', 'GET', dienst('person-a'))).status).toBe(403);
  });

  it('Privat-Head (Ebene Person): nur die Person selbst, in IHREM Abschnitt — Sicht B bekommt nichts aus A', async () => {
    const stand = kopfVon((await getAgenten('person-a')).j, 'assistenz')!.einstellung!.stand;
    const r = await postAgenten('person-a', { aktion: 'einstellung', headId: 'assistenz', teil: { budgetCentMonat: FREMD_MARKE, zustaendig: 'person-b' }, stand });
    expect(r.status).toBe(200);
    const e = await db.loadJson<AgentenEinstellung>(einstellungBestand('haus-a'));
    expect(e?.personen?.['person-a']?.heads.assistenz?.budgetCentMonat).toBe(FREMD_MARKE);
    expect(e?.heads.assistenz).toBeUndefined();
    const a = kopfVon((await getAgenten('person-a')).j, 'assistenz')!;
    expect(a.einstellung?.budgetCentMonat).toBe(FREMD_MARKE);
    const b = await getAgenten('person-b');
    expect(kopfVon(b.j, 'assistenz')!.einstellung?.budgetCentMonat).toBeNull();
    expect(b.text).not.toContain(String(FREMD_MARKE));
    const nb = await getAgenten('nur-business');
    expect(kopfVon(nb.j, 'assistenz')).toBeUndefined();
    expect(nb.text).not.toContain(String(FREMD_MARKE));
    // Lesen ohne Person (Paket-0-Signatur) gibt die Abschnitte nie heraus.
    const { einstellungFuer } = await import('@/lib/agenten/skills-lesen');
    const ohne = await einstellungFuer('haus-a');
    expect(JSON.stringify(ohne)).not.toContain(String(FREMD_MARKE));
    expect((await einstellungFuer('haus-a', 'person-a')).heads.assistenz?.budgetCentMonat).toBe(FREMD_MARKE);
    expect((await einstellungFuer('haus-a', 'person-b')).heads.assistenz).toBeUndefined();
  });

  it('Not-Aus eines Privat-Heads gilt nur für die Person selbst (eigener Abschnitt) — die andere sieht ihren Head frei', async () => {
    expect((await postAgenten('person-a', { aktion: 'not-aus', an: true, headId: 'assistenz' })).status).toBe(200);
    expect(kopfVon((await getAgenten('person-a')).j, 'assistenz')!.gesperrt?.grund).toBe('not-aus');
    expect(kopfVon((await getAgenten('person-b')).j, 'assistenz')!.gesperrt).toBeUndefined();
    const { laufSperre } = await import('@/lib/agenten/einstellung');
    expect((await laufSperre('person-a', 'assistenz'))?.grund).toBe('not-aus');
    expect(await laufSperre('person-b', 'assistenz')).toBeNull();
    expect((await postAgenten('person-a', { aktion: 'not-aus', an: false, headId: 'assistenz' })).status).toBe(200);
    expect(kopfVon((await getAgenten('person-a')).j, 'assistenz')!.gesperrt).toBeUndefined();
  });

  it('Prüfung: unbekanntes Feld, fremde Person als zuständig, Business-Partner für einen Privat-Head, Autonomie lockern, Unsinn → 400/409', async () => {
    const stand = (id: string, p = 'person-b') => getAgenten(p).then(r => kopfVon(r.j, id)!.einstellung!.stand);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { geheim: 1 }, stand: await stand('operations') })).status).toBe(400);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { zustaendig: 'gast' }, stand: await stand('operations') })).status).toBe(400);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'familie', teil: { zustaendig: 'nur-business' }, stand: await stand('familie') })).status).toBe(400);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { autonomie: 'intern' }, stand: await stand('operations') })).status).toBe(409);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { budgetCentMonat: -5 }, stand: await stand('operations') })).status).toBe(400);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { stufe: 'riesig' }, stand: await stand('operations') })).status).toBe(400);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { foto: 'md-00000000-0000-4000-8000-000000000000' }, stand: await stand('operations') })).status).toBe(400);
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'operations', teil: { mitarbeiterAus: ['gibt-es-nicht'] }, stand: await stand('operations') })).status).toBe(400);
    // Verschärfen geht immer: ein Head mit Boden „intern“ (Sales) auf „nur Vorschlag“.
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'sales', teil: { autonomie: 'vorschlag' }, stand: await stand('sales') })).status).toBe(200);
    expect(kopfVon((await getAgenten('person-b')).j, 'sales')!.einstellung!.autonomie).toBe('vorschlag');
  });
});

// ── Not-Aus: Lauf UND Takt ─────────────────────────────────────────────────────────────────────────────────────────────

describe('Not-Aus stoppt Lauf und Takt', () => {
  beforeAll(async () => {
    await db.saveJson(fadenBestand('person-b'), { v: 1, faeden: [
      fd('fd-p4b-laeuft-0001', 'person-b', { lauf: { auftragId: 'a-p4b-1', status: 'laeuft', schritte: [], start: VOR(3), kostenCent: 0 } }),
      fd('fd-p4b-sales-0001', 'person-b', { agent: { art: 'head', headId: 'sales' }, status: 'offen' }),
      fd('fd-p4b-mark-0002', 'person-b', { agent: { art: 'head', headId: 'marketing' }, status: 'offen' }),
    ] });
    await db.saveJson('zoe-auftraege', { auftraege: [
      { id: 'a-p4b-1', zeit: VOR(3), tag: HEUTE, art: 'agent', name: LAUF_AGENT, eingabe: { art: 'faden', fadenId: 'fd-p4b-laeuft-0001' }, auftrag: '{}', schluessel: 'p1', status: 'offen', versuche: 0, person: 'person-b' },
      { id: 'a-p4b-2', zeit: VOR(2), tag: HEUTE, art: 'agent', name: 'head-marketing', eingabe: {}, auftrag: 'modus:wochenplan', schluessel: 'p2', status: 'offen', versuche: 0 },
      { id: 'a-p4b-3', zeit: VOR(2), tag: HEUTE, art: 'agent', name: 'head-sales', eingabe: {}, auftrag: 'modus:wochenreview', schluessel: 'p3', status: 'offen', versuche: 0 },
    ] });
  });

  it('Not-Aus je Head: laufende Threads „abgebrochen“, offene Aufträge des Heads raus, andere Heads laufen weiter', async () => {
    const r = await postAgenten('person-b', { aktion: 'not-aus', an: true, headId: 'marketing' });
    expect(r.status).toBe(200);
    expect(r.j.angehalten).toBe(1);
    const f = (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-b')).find(x => x.id === 'fd-p4b-laeuft-0001')!;
    expect(f.status).toBe('abgebrochen');
    expect(f.lauf?.status).toBe('abgebrochen');
    const a = (await db.loadJson<{ auftraege: J[] }>('zoe-auftraege'))!.auftraege;
    expect(a.find(x => x.id === 'a-p4b-1')!.status).toBe('fehler');
    expect(a.find(x => x.id === 'a-p4b-2')!.fehler).toBe('Angehalten (Not-Aus).');
    expect(a.find(x => x.id === 'a-p4b-3')!.status).toBe('offen');
    const k = kopfVon((await getAgenten('person-a')).j, 'marketing')!;
    expect(k.gesperrt?.grund).toBe('not-aus');
    expect(k.einstellung?.notAus).not.toBeNull();
  });

  it('Takt reiht nichts ein, der Arbeiter führt nichts aus (je Head)', async () => {
    const { taktSperreFiltern, auftragGesperrt, ANGEHALTEN } = await import('@/lib/agenten/einstellung');
    const faellig = [
      { id: 'x1', grund: '', auftrag: { art: 'agent' as const, name: 'head-marketing' } },
      { id: 'x2', grund: '', auftrag: { art: 'agent' as const, name: 'head-sales' } },
      { id: 'x3', grund: '', auftrag: { art: 'agent' as const, name: LAUF_AGENT, eingabe: { art: 'skill', skillId: 'sk-x', headId: 'marketing' } } },
      { id: 'x4', grund: '', auftrag: { art: 'agent' as const, name: 'tagesstart' } },
    ];
    expect((await taktSperreFiltern(faellig)).map(f => f.id)).toEqual(['x2', 'x4']);
    expect(await auftragGesperrt({ name: 'head-marketing' })).toBe(ANGEHALTEN);
    expect(await auftragGesperrt({ name: 'head-sales' })).toBeNull();
    // Die EINE Zeile in lib/zoe/takt.ts ruft den Filter.
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('lib/zoe/takt.ts', 'utf8')).toMatch(/taktSperreFiltern\(roh1, jetzt\)/);
    expect(readFileSync('app/api/zoe/auftraege/lauf/route.ts', 'utf8')).toMatch(/auftragGesperrt\(a\)/);
  });

  it('Thread-Lauf und Senden an den Head: abgelehnt, ohne Modell', async () => {
    const r = await anfrage(lauf.POST, '/api/agenten/faden/lauf', 'POST', dienst('person-b'), { art: 'faden', fadenId: 'fd-p4b-mark-0002' });
    expect(r.status).toBe(200);
    expect(r.j.laufStatus).toBe('abgebrochen');
    const f = (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-b')).find(x => x.id === 'fd-p4b-mark-0002')!;
    expect(f.lauf?.status).toBe('abgebrochen');
    const s = await anfrage(faden.POST, '/api/agenten/faden', 'POST', sitzung('person-b'), { aktion: 'senden', agent: { art: 'head', headId: 'marketing' }, text: 'Hallo' });
    expect(s.status).toBe(409);
    expect(s.j.gesperrt).toBe('not-aus');
    expect((await postAgenten('person-b', { aktion: 'not-aus', an: false, headId: 'marketing' })).status).toBe(200);
  });

  it('Not-Aus für alle: alle Agenten-Läufe ruhen, die Wartung des Systems nicht; Lösen nur volle Mitglieder', async () => {
    expect((await postAgenten('person-b', { aktion: 'not-aus', an: true })).status).toBe(200);
    const { taktSperreFiltern } = await import('@/lib/agenten/einstellung');
    const namen = ['research', 'head-sales', LAUF_AGENT, 'tageslauf', 'tagesstart', 'loeschfristen', 'durchsicht', 'hoi'];
    const raus = await taktSperreFiltern(namen.map(n => ({ id: n, grund: '', auftrag: { art: 'agent' as const, name: n } })));
    expect(raus.map(f => f.id)).toEqual(['tagesstart', 'loeschfristen', 'durchsicht', 'hoi']);
    expect((await getAgenten('person-a')).j.notAus).toBe(true);
    const s = await anfrage(faden.POST, '/api/agenten/faden', 'POST', sitzung('person-b'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Hallo', hintergrund: true });
    expect(s.status).toBe(409);
    expect((await postAgenten('nur-business', { aktion: 'not-aus', an: false })).status).toBe(403);
    expect((await postAgenten('person-a', { aktion: 'not-aus', an: false })).status).toBe(200);
    expect((await getAgenten('person-a')).j.notAus).toBe(false);
  });
});

// ── Budget: Instanz (Monat und gesamt), 80/95/100 %, 50-€-Grenze, Budget je Head ───────────────────────────────────────────

describe('Budget 80/95/100 % und die 50-€-Grenze', () => {
  const kurs = () => 0.86;
  /** Verbrauch so setzen, dass seit dem Setzen `euroCent` verbraucht sind (Gesamt) bzw. im Monat (Tage). */
  const verbrauch = async (o: { summeUsdCent?: number; monatUsdCent?: number; zweck?: string }) => {
    const cur = (await db.loadJson<J>('ki-verbrauch')) ?? {};
    await db.saveJson('ki-verbrauch', {
      tage: o.monatUsdCent !== undefined ? [{ tag: HEUTE, posten: [{ modell: 'claude-sonnet-5', zweck: o.zweck ?? 'kimmi', ein: 1, aus: 1, anzahl: 1, cent: o.monatUsdCent }] }] : cur.tage ?? [],
      summe: { usdCent: o.summeUsdCent ?? cur.summe?.usdCent ?? 0, seit: VOR(60 * 24) },
    });
  };
  const kiStand = () => db.loadJson<J>('ki-stand');

  it('setzen nur der Inhaber (403 sonst); gesamt beginnt JETZT mit dem Zählerstand, Monat ist die Vorgabe', async () => {
    await verbrauch({ summeUsdCent: 10_000, monatUsdCent: 0 });
    const nein = await anfrage(ki.PUT, '/api/datenschutz/ki', 'PUT', sitzung('person-b'), { ebene: 'instanz', anbieter: { budget: { gesamtEuroCent: 5000 } } });
    expect(nein.status).toBe(403);
    const ja = await anfrage(ki.PUT, '/api/datenschutz/ki', 'PUT', sitzung('person-a'), { ebene: 'instanz', anbieter: { budget: { gesamtEuroCent: 5000 } } });
    expect(ja.status).toBe(200);
    const { kiEinstellungenVergessen, ladeKiEinstellungen } = await import('@/lib/datenschutz/ki-einstellungen');
    kiEinstellungenVergessen();
    const b = (await ladeKiEinstellungen()).instanz?.budget;
    expect(b?.gesamtEuroCent).toBe(5000);
    expect(b?.gesamtBasisUsdCent).toBe(10_000);
    expect(typeof b?.gesamtAb).toBe('string');
    expect(b?.monatEuroCent).toBeUndefined();
    const g = (await getAgenten('person-a')).j.budget;
    expect(g.setzen).toBe(true);
    expect(g.gesamt.grenzeCent).toBe(5000);
    expect(g.gesamt.verbrauchtCent).toBe(0);
    expect(g.monat.grenzeCent).toBeNull();
    expect((await getAgenten('person-b')).j.budget.setzen).toBe(false);
  });

  it('80 % → Glocke einmal, 95 % → Glocke, 100 % → gesperrt (Regelwerk) + Glocke — je Stufe nur einmal', async () => {
    const { budgetSperre, budgetStand, budgetLageGesamt, kostenPruefen } = await import('@/lib/ki/tor');
    const usd = (euroCent: number) => 10_000 + euroCent / kurs();
    await verbrauch({ summeUsdCent: usd(4_010) });
    expect(budgetLageGesamt((await budgetStand()).gesamt!).stufe).toBe(80);
    expect(await budgetSperre()).toBeNull();
    await new Promise(r => setTimeout(r, 50));
    expect((await kiStand())?.budgetGesamtMeldungen?.stufen).toEqual([80]);
    expect(await budgetSperre()).toBeNull();
    await new Promise(r => setTimeout(r, 50));
    expect((await kiStand())?.budgetGesamtMeldungen?.stufen).toEqual([80]);
    await verbrauch({ summeUsdCent: usd(4_810) });
    expect(budgetLageGesamt((await budgetStand()).gesamt!).stufe).toBe(95);
    await budgetSperre(); await new Promise(r => setTimeout(r, 50));
    expect((await kiStand())?.budgetGesamtMeldungen?.stufen).toEqual([80, 95]);
    await verbrauch({ summeUsdCent: usd(5_010) });
    expect(await budgetSperre()).toBe('budget');
    expect(kostenPruefen({ budget: await budgetStand(), faehigkeit: 'text' })).toBe('budget');
    await new Promise(r => setTimeout(r, 50));
    expect((await kiStand())?.budgetGesamtMeldungen?.stufen).toEqual([80, 95, 100]);
    const meldungen = await db.loadJson<{ meldungen?: { titel: string }[] }>('meldungen--person-a');
    expect(JSON.stringify(meldungen)).toMatch(/Gesamtbudget ist erreicht/);
    expect(JSON.stringify(meldungen)).not.toMatch(/€|\d+,\d\d/);
    // Höhe ändern: Beginn und Basis bleiben (es zählt weiter, was seit dem Beginn verbraucht ist); aus → gelöscht.
    const { budgetAnwenden } = await import('@/lib/datenschutz/ki-einstellungen');
    const alt = { gesamtEuroCent: 5000, gesamtAb: '2026-10-09T00:00:00.000Z', gesamtBasisUsdCent: 7 };
    expect(budgetAnwenden(alt, { gesamtEuroCent: 8000 }, { jetzt: 'x', basisUsdCent: 99 })).toEqual({ gesamtEuroCent: 8000, gesamtAb: '2026-10-09T00:00:00.000Z', gesamtBasisUsdCent: 7 });
    expect(budgetAnwenden(alt, { gesamtEuroCent: null }, { jetzt: 'x', basisUsdCent: 99 })).toEqual({});
    await anfrage(ki.PUT, '/api/datenschutz/ki', 'PUT', sitzung('person-a'), { ebene: 'instanz', anbieter: { budget: { gesamtEuroCent: null } } });
  });

  it('50 € je Monat: Balken aus dem Server, 100 % gesperrt', async () => {
    const r = await anfrage(ki.PUT, '/api/datenschutz/ki', 'PUT', sitzung('person-a'), { ebene: 'instanz', anbieter: { budget: { monatEuroCent: 5000 } } });
    expect(r.status).toBe(200);
    await verbrauch({ monatUsdCent: 4_100 / kurs() });
    const g = (await getAgenten('person-a')).j.budget;
    expect(g.monat.grenzeCent).toBe(5000);
    expect(g.gesamt).toBeUndefined();
    expect(g.stufe).toBe(80);
    const { budgetSperre } = await import('@/lib/ki/tor');
    await verbrauch({ monatUsdCent: 5_010 / kurs() });
    expect(await budgetSperre()).toBe('budget');
    await anfrage(ki.PUT, '/api/datenschutz/ki', 'PUT', sitzung('person-a'), { ebene: 'instanz', anbieter: { budget: { monatEuroCent: null } } });
    expect(await budgetSperre()).toBeNull();
  });

  it('Budget je Head: Kosten aus der Kostenmessung, 100 % → pausiert (Chat 409, Lauf wartet) + eine Glocke', async () => {
    const stand = kopfVon((await getAgenten('person-b')).j, 'kundenerfolg')!.einstellung!.stand;
    expect((await postAgenten('person-b', { aktion: 'einstellung', headId: 'kundenerfolg', teil: { budgetCentMonat: 100, zustaendig: 'person-b' }, stand })).status).toBe(200);
    await verbrauch({ monatUsdCent: 200, zweck: 'agent-kundenerfolg' });
    const k = kopfVon((await getAgenten('person-a')).j, 'kundenerfolg')!;
    const standVorher = kopfVon((await getAgenten('person-b')).j, 'kundenerfolg')!.einstellung!.stand;
    expect(k.einstellung?.kostenCentMonat).toBeCloseTo(172, 0);
    expect(k.gesperrt?.grund).toBe('budget');
    const s = await anfrage(faden.POST, '/api/agenten/faden', 'POST', sitzung('person-b'), { aktion: 'senden', agent: { art: 'head', headId: 'kundenerfolg' }, text: 'Hallo' });
    expect(s.status).toBe(409);
    expect(s.j.gesperrt).toBe('budget');
    const e = await db.loadJson<J>(einstellungBestand('haus-a'));
    expect(e?.heads.kundenerfolg.budgetGemeldet.stufen).toEqual([100]);
    // Die Glocken-Marke ändert den Stand nicht (keine 409 für eine Änderung von Hand).
    expect(kopfVon((await getAgenten('person-b')).j, 'kundenerfolg')!.einstellung!.stand).toBe(standVorher);
    const { kostenJeHeadAusVerbrauch, headVonZweck } = await import('@/lib/agenten/einstellung');
    expect(headVonZweck('agent-sales')).toBe('sales');
    expect(headVonZweck('agent-sales-skill-test')).toBe('sales');
    expect(headVonZweck('head-marketing-wochenplan')).toBe('marketing');
    expect(headVonZweck('finanzchef-korrektur')).toBe('finanzen');
    expect(headVonZweck('kimmi')).toBeNull();
    expect(kostenJeHeadAusVerbrauch([{ tag: '2026-10-01', posten: [{ zweck: 'agent-sales', cent: 100 }, { zweck: 'kimmi', cent: 50 }] }, { tag: '2026-09-30', posten: [{ zweck: 'agent-sales', cent: 999 }] }], '2026-10', 0.5)).toEqual({ sales: 50 });
    await postAgenten('person-b', { aktion: 'einstellung', headId: 'kundenerfolg', teil: { budgetCentMonat: null }, stand: kopfVon((await getAgenten('person-b')).j, 'kundenerfolg')!.einstellung!.stand });
    await verbrauch({ monatUsdCent: 0 });
  });
});

// ── Daumen, Geplant, Plan-Stapel, Probelauf ───────────────────────────────────────────────────────────────────────────────

describe('bewerten: Daumen an Antworten und Berichten — nur die Besitzerin, nur Metadaten', () => {
  beforeAll(async () => {
    await db.saveJson(fadenBestand('person-a'), { v: 1, faeden: [
      fd('fd-p4b-daumen-001', 'person-a', { agent: { art: 'head', headId: 'sales' }, status: 'fertig', nachrichten: [
        { id: 'nr-person-1', rolle: 'person', von: 'person-a', text: 'Frage', zeit: VOR(10) },
        { id: 'nr-agent-1', rolle: 'agent', von: 'head:sales', text: 'Antwort', zeit: VOR(9), ki: true },
        { id: 'nr-bericht-1', rolle: 'system', von: 'system', text: 'Bericht aus Thread „x“: …', zeit: VOR(8), verweis: { art: 'bericht', fadenId: 'fd-p4b-kind-0001', titel: 'x' } },
      ] }),
    ] });
  });
  const bewerte = (p: string, body: J) => anfrage(faden.POST, '/api/agenten/faden', 'POST', sitzung(p), { aktion: 'bewerten', fadenId: 'fd-p4b-daumen-001', ...body });

  it('hoch an der Antwort, runter mit Grund am Bericht, zurücknehmen; Person-Nachricht 400, Grund nur aus der Liste', async () => {
    expect((await bewerte('person-a', { nachrichtId: 'nr-agent-1', wert: 'hoch' })).status).toBe(200);
    expect((await bewerte('person-a', { nachrichtId: 'nr-bericht-1', wert: 'runter', grund: 'vage' })).status).toBe(200);
    expect((await bewerte('person-a', { nachrichtId: 'nr-person-1', wert: 'hoch' })).status).toBe(400);
    expect((await bewerte('person-a', { nachrichtId: 'nr-agent-1', wert: 'hoch', grund: 'vage' })).status).toBe(400);
    expect((await bewerte('person-a', { nachrichtId: 'nr-agent-1', wert: 'runter', grund: 'freitext' })).status).toBe(400);
    const f = (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-a'))[0];
    expect(f.nachrichten.find(n => n.id === 'nr-agent-1')!.daumen?.wert).toBe('hoch');
    expect(f.nachrichten.find(n => n.id === 'nr-bericht-1')!.daumen).toMatchObject({ wert: 'runter', grund: 'vage' });
    const { fadenZahlen } = await import('@/lib/agenten/leistung');
    expect(fadenZahlen([f], 'sales', VOR(60), new Date(JETZT.getTime() + 60_000).toISOString()).daumen).toEqual({ hoch: 1, runter: 1 });
    expect((await bewerte('person-a', { nachrichtId: 'nr-agent-1', wert: null })).status).toBe(200);
    expect((await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-a'))[0].nachrichten.find(n => n.id === 'nr-agent-1')!.daumen).toBeUndefined();
  });

  it('fremder Thread → 404 (nie bewertet), Dienstweg 403', async () => {
    expect((await bewerte('person-b', { nachrichtId: 'nr-agent-1', wert: 'hoch' })).status).toBe(404);
    expect((await anfrage(faden.POST, '/api/agenten/faden', 'POST', dienst('person-a'), { aktion: 'bewerten', fadenId: 'fd-p4b-daumen-001', nachrichtId: 'nr-agent-1', wert: 'hoch' })).status).toBe(403);
  });
});

describe('Geplant: pausieren und löschen mit Stand', () => {
  it('GET liefert planStaende, Pausieren mit Stand, veralteter Stand 409', async () => {
    await db.saveJson(planBestand('person-b'), { v: 1, aufgaben: [{ id: 'hg-p4b-00000001', besitzer: 'person-b', agent: { art: 'head', headId: 'operations' }, titel: 'Wochenblick', auftrag: 'Ziel: x', zeitplan: { art: 'wiederkehrend', rhythmus: 'woechentlich', uhrzeit: '08:00', tage: [1] }, aktiv: true, erstellt: VOR(100) }] });
    const g = await anfrage(laeufe.GET, '/api/agenten/laeufe', 'GET', sitzung('person-b'));
    const stand = g.j.planStaende['hg-p4b-00000001'];
    expect(typeof stand).toBe('string');
    const r = await anfrage(laeufe.POST, '/api/agenten/laeufe', 'POST', sitzung('person-b'), { aktion: 'plan-aendern', id: 'hg-p4b-00000001', teil: { aktiv: false }, stand });
    expect(r.status).toBe(200);
    expect(r.j.aufgabe.aktiv).toBe(false);
    expect((await anfrage(laeufe.POST, '/api/agenten/laeufe', 'POST', sitzung('person-b'), { aktion: 'plan-loeschen', id: 'hg-p4b-00000001', stand })).status).toBe(409);
  });
});

describe('Plan-Freigabe über den Stapel (Art „plan“)', () => {
  it('offene Pläne einmal in den Stapel; nur die Besitzerin; im Thread entschieden → Eintrag erledigt', async () => {
    await db.saveJson(fadenBestand('person-b'), { v: 1, faeden: [fd('fd-p4b-plan-0001', 'person-b', { agent: { art: 'head', headId: 'marketing' }, status: 'offen', plaene: [
      { id: 'pl-p4b-1', status: 'offen', grund: 'Drei Mitarbeiter in einem Zug', am: VOR(5), auftraege: [{ mitarbeiterId: 'marketing-kampagnen', auftrag: { ziel: 'Kampagne planen', format: 'Liste', grenzen: 'nur Vorschlag', quellen: 'CRM' } }] },
    ] })] });
    const { planStapeln, planStapelErledigen, PLAN_STAPEL_ART, planBezug } = await import('@/lib/agenten/plan-stapel');
    expect(await planStapeln('person-b', 'fd-p4b-plan-0001')).toBe(1);
    expect(await planStapeln('person-b', 'fd-p4b-plan-0001')).toBe(0);
    expect(await planStapeln('person-a', 'fd-p4b-plan-0001')).toBe(0);
    const { lies } = await import('@/lib/zoe/stapel');
    const v = (await lies('offen')).find(x => x.bezug?.art === 'plan')!;
    expect(v.bezug).toEqual(planBezug('fd-p4b-plan-0001', 'pl-p4b-1'));
    expect(v.person).toBe('person-b');
    expect(v.nachher).toContain('Kampagne planen');
    const fremd = await PLAN_STAPEL_ART.freigeben(v, 'person-a', {});
    expect(fremd.ok).toBe(false);
    await planStapelErledigen('person-b', 'fd-p4b-plan-0001', 'pl-p4b-1', 'ablehnen');
    expect((await lies()).find(x => x.id === v.id)!.status).toBe('abgelehnt');
  });
});

describe('Probelauf eines Mitarbeiters — ohne Wirkung, Ergebnis nur im Thread', () => {
  it('ein Lauf mit Testeingabe → eigener Thread, Werkstatt unverändert; gesperrter Head 409', async () => {
    const SK = await import('@/lib/agenten/skills-server');
    SK.mitarbeiterProbelaeuferVerdrahten(async a => ({ ok: true, text: `Probe: ${a.eingabe.length} Zeichen`, werkzeuge: ['kampagnen_lage'] }));
    const r = await anfrage(skills.POST, '/api/agenten/skills', 'POST', sitzung('person-b'), { aktion: 'mitarbeiter-probelauf', headId: 'marketing', id: 'marketing-kampagnen', eingabe: 'Plane eine Kampagne' });
    expect(r.status).toBe(200);
    const f = (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen('person-b')).find(x => x.id === r.j.fadenId)!;
    expect(f.titel).toMatch(/^Probelauf/);
    expect(f.status).toBe('fertig');
    expect(f.nachrichten.map(n => n.rolle)).toEqual(['person', 'agent', 'system']);
    expect(f.nachrichten[1].werkzeuge?.[0].name).toBe('kampagnen_lage');
    expect(await db.loadJson('agenten-skills--haus-a')).toBeNull();
    await postAgenten('person-b', { aktion: 'not-aus', an: true, headId: 'marketing' });
    const g = await anfrage(skills.POST, '/api/agenten/skills', 'POST', sitzung('person-b'), { aktion: 'mitarbeiter-probelauf', headId: 'marketing', id: 'marketing-kampagnen', eingabe: 'x' });
    expect(g.status).toBe(409);
    await postAgenten('person-b', { aktion: 'not-aus', an: false, headId: 'marketing' });
    expect((await anfrage(skills.POST, '/api/agenten/skills', 'POST', sitzung('nur-business'), { aktion: 'mitarbeiter-probelauf', headId: 'assistenz', eingabe: 'x', entwurf: { name: 'A', rolle: 'b', werkzeuge: [], stufe: 'schnell' } })).status).toBe(403);
  });
});

// ── Takt: Business-frei nachholen, Heads ohne festes Kürzel ─────────────────────────────────────────────────────────────

describe('Business-frei vorbei: wartende Läufe laufen EINMAL weiter', () => {
  const wartend = (extra: Partial<Faden> = {}) => fd('fd-p4b-bf-00001', 'person-b', { status: 'wartet', aktualisiert: VOR(30), lauf: { status: 'wartet', schritte: [], start: VOR(40), kostenCent: 0, fehler: 'ruht in der Business-freien Zeit — danach neu starten.' }, ...extra });
  const lage = (o: { frei?: boolean; auftraege?: J[]; ki?: boolean; jetzt?: Date } = {}) => ({
    jetzt: o.jetzt ?? new Date('2026-10-14T10:00:00+02:00'), kiHintergrund: o.ki ?? true,
    frei: () => (o.frei ? [{ start: '2026-10-14T08:00:00', ende: '2026-10-14T12:00:00' }] : []), auftraege: (o.auftraege ?? []) as never[],
  });

  it('Rahmen vorbei → ein Auftrag; noch frei, schon eingereiht, Privat-Head, Hintergrund-KI aus → keiner', async () => {
    const { businessFreiNachholenRein, wartetAufBusinessFrei, NACHHOLEN_ANLASS } = await import('@/lib/agenten/zeitplan');
    expect(wartetAufBusinessFrei(wartend())).toBe(true);
    expect(wartetAufBusinessFrei(wartend({ lauf: { status: 'wartet', schritte: [], start: VOR(1), kostenCent: 0, wartetAuf: 'business-frei' } }))).toBe(true);
    expect(wartetAufBusinessFrei(wartend({ lauf: { status: 'wartet', schritte: [], start: VOR(1), kostenCent: 0, fehler: 'Not-Aus' } }))).toBe(false);
    const eins = businessFreiNachholenRein([{ person: 'person-b', faden: wartend() }], lage());
    expect(eins).toHaveLength(1);
    expect(eins[0].auftrag).toMatchObject({ name: LAUF_AGENT, person: 'person-b', anlass: NACHHOLEN_ANLASS, eingabe: { art: 'faden', fadenId: 'fd-p4b-bf-00001' } });
    expect(businessFreiNachholenRein([{ person: 'person-b', faden: wartend() }], lage({ frei: true }))).toHaveLength(0);
    expect(businessFreiNachholenRein([{ person: 'person-b', faden: wartend() }], lage({ ki: false }))).toHaveLength(0);
    const offen = { name: LAUF_AGENT, zeit: VOR(1), tag: '2026-10-14', status: 'offen', eingabe: { fadenId: 'fd-p4b-bf-00001' } };
    expect(businessFreiNachholenRein([{ person: 'person-b', faden: wartend() }], lage({ auftraege: [offen] }))).toHaveLength(0);
    const schon = { ...offen, status: 'fertig', anlass: NACHHOLEN_ANLASS, zeit: VOR(5) };
    expect(businessFreiNachholenRein([{ person: 'person-b', faden: wartend() }], lage({ auftraege: [schon] }))).toHaveLength(0);
    const privat = wartend({ agent: { art: 'head', headId: 'assistenz' }, bereich: 'privat' });
    expect(businessFreiNachholenRein([{ person: 'person-b', faden: privat }], lage())).toHaveLength(0);
    expect(businessFreiNachholenRein([{ person: 'person-a', faden: wartend() }], lage())).toHaveLength(0); // nicht ihr Thread
  });
});

describe('Heads im Takt ohne festes Kürzel (neue Instanz mit anderen Speichernamen)', () => {
  it('ohne Team-Konto: die Konten im Haushalt des Inhabers (Inhaber zuerst) — der Takt läuft', async () => {
    const { powerHourPersonen, headsFaellig } = await import('@/lib/heads/takt');
    const konten = [{ speicher: 'person-a', rolle: 'inhaber', haushalt: 'haus-a' }, { speicher: 'person-b', rolle: 'mitglied', haushalt: 'haus-a' }, { speicher: 'gast', rolle: 'mitglied', haushalt: 'haus-fremd' }];
    expect(powerHourPersonen([{ id: 'team-x' }, { id: 'team-y' }], konten)).toEqual(['person-a', 'person-b']);
    expect(powerHourPersonen([{ id: 'person-b' }], konten)).toEqual(['person-b']);
    expect(powerHourPersonen([], [])).toEqual([]);
    // Werktag 9 Uhr: Power Hour für die Konten der Instanz, nie für ein Kürzel aus dem Code.
    const werktag = new Date(2026, 9, 13, 9, 30);
    const f = await headsFaellig(werktag);
    const ph = f.filter(x => x.auftrag.name === 'head-sales' && /power_hour/.test(String(x.auftrag.auftrag)));
    expect(ph.length).toBeGreaterThan(0);
    expect(String(ph[0].auftrag.auftrag)).toMatch(/person:person-a$/);
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('lib/heads/takt.ts', 'utf8')).not.toMatch(/'kevin'|"kevin"/);
  });
});

// ── KI: Bereich `familie`, `finanzen-privat` nur mit privatem Finanzzugang ─────────────────────────────────────────────────

describe('KI-Schalter: Familie ein-/ausschaltbar, private Finanzen nur mit privatem Finanzzugang', () => {
  it('familie ist ein Bereich wie die anderen — je Person ausschaltbar, das Tor sperrt', async () => {
    const { KI_BEREICHE, wirksameSchalter, vorgabeSchalter } = await import('@/lib/datenschutz/ki-einstellungen');
    const { torEntscheiden } = await import('@/lib/datenschutz/ki-tor');
    expect(KI_BEREICHE).toContain('familie');
    expect(vorgabeSchalter('sparsam').bereiche.familie).toBe(true);
    const d = { vorgabe: 'kompatibel' as const, festgelegtAm: '2026-10-10T00:00:00.000Z', personen: { 'person-b': { bereiche: { familie: false } } } };
    const b = wirksameSchalter(d, 'person-b'), a = wirksameSchalter(d, 'person-a');
    expect(torEntscheiden(b, true, { lauf: 'aufruf', person: 'person-b', kategorien: ['familie'] }, false)).toMatchObject({ ok: false, grund: 'bereich-familie' });
    expect(torEntscheiden(a, true, { lauf: 'aufruf', person: 'person-a', kategorien: ['familie'] }, false).ok).toBe(true);
  });

  it('finanzen-privat: volles Mitglied im Haushalt des Inhabers ja; „nur Business“, fremder Haushalt, Systemlauf nein', async () => {
    const { kiTor } = await import('@/lib/datenschutz/ki-tor');
    const k = (person: string | null) => kiTor({ lauf: 'aufruf', person, kategorien: ['finanzen', 'finanzen-privat'] }, false);
    expect((await k('person-b')).ok).toBe(true);
    expect(await k('nur-business')).toMatchObject({ ok: false, grund: 'finanzen-privat' });
    expect(await k('gast')).toMatchObject({ ok: false, grund: 'finanzen-privat' });
    expect(await k(null)).toMatchObject({ ok: false, grund: 'finanzen-privat' });
    expect((await kiTor({ lauf: 'aufruf', person: 'nur-business', kategorien: ['finanzen'] }, false)).ok).toBe(true);
    const { kiSperrText } = await import('@/lib/anthropic');
    expect(kiSperrText({ error: 'ki-gesperrt:finanzen-privat' })).toMatch(/privatem Finanzzugang/);
  });
});

// ── Konto: Export und Löschen ─────────────────────────────────────────────────────────────────────────────────────────

describe('Konto löschen und exportieren (Art. 15/17)', () => {
  it('der eigene Abschnitt fällt weg, Zuständigkeit entfällt, Speichername „[gelöscht]“; der Export nennt nur Eigenes', async () => {
    const { einstellungOhnePerson, einstellungEintraegeVon, mitPerson } = await import('@/lib/agenten/einstellung');
    const e: AgentenEinstellung = {
      v: 1, notAus: { seit: 'x', von: 'person-a' },
      heads: { sales: { zustaendig: 'person-a', geaendertVon: 'person-a' }, marketing: { notAus: { seit: 'y', von: 'person-b' } } },
      personen: { 'person-a': { heads: { assistenz: { budgetCentMonat: 1 } } }, 'person-b': { heads: { assistenz: { zustaendig: 'person-a' } } } },
    };
    const r = einstellungOhnePerson(e, 'person-a');
    expect(r.neu.personen?.['person-a']).toBeUndefined();
    expect(r.neu.heads.sales).toEqual({ geaendertVon: '[gelöscht]' });
    expect(r.neu.notAus?.von).toBe('[gelöscht]');
    expect(r.neu.personen?.['person-b']?.heads.assistenz?.zustaendig).toBeUndefined();
    expect(r.neu.heads.marketing?.notAus?.von).toBe('person-b');
    expect(JSON.stringify(r.neu)).not.toContain('person-a');
    const x = einstellungEintraegeVon(e, 'person-b');
    expect(JSON.stringify(x)).toContain('marketing');
    expect(JSON.stringify(x)).not.toContain('budgetCentMonat');
    expect(mitPerson(e, 'person-b').heads.assistenz).toEqual({ zustaendig: 'person-a' });
    expect(mitPerson(e, null).heads.assistenz).toBeUndefined();
    expect('personen' in mitPerson(e, 'person-a')).toBe(false);
  });
});

// ── Oberfläche: Einstellungen schreiben, Budget setzen ───────────────────────────────────────────────────────────────

describe('Oberfläche: Einstellungen und Budget schreiben wirklich', () => {
  const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
  const wert = async (teil: J = {}) => {
    const FIX = await import('./fixtures/agenten-api');
    const sales = { ...FIX.HEADS.find(x => x.id === 'sales')!, einstellung: { stufe: 'ausgewogen', aufwand: 'medium', autonomie: 'intern', vorgabe: { stufe: 'ausgewogen', aufwand: 'medium', autonomie: 'intern' }, modelle: { schnell: 'Modell S', ausgewogen: 'Modell A', stark: 'Modell X' }, budgetCentMonat: 2000, kostenCentMonat: 1500, zustaendig: 'person-b', notAus: null, foto: null, aendern: true, stand: 'es-1' } };
    const daten = { ...FIX.AGENTEN, heads: FIX.HEADS.map(x => (x.id === 'sales' ? sales : x)), budget: { monat: { verbrauchtCent: 4000, grenzeCent: null, prozent: null, stufe: 0, text: '' }, gesamt: { verbrauchtCent: 4000, grenzeCent: 5000, prozent: 80, stufe: 80, text: '40,00 € von 50,00 € (80 %) seit 09.10.2026', ab: '2026-10-09T00:00:00.000Z' }, stufe: 80, setzen: true }, personen: [{ id: 'person-b', name: 'Name B' }], notAusAendern: true, ...teil };
    return {
      agenten: { zustand: 'da', daten }, faeden: { zustand: 'da', daten: FIX.FADEN_LISTE }, laeufe: { zustand: 'da', daten: FIX.LAEUFE }, stapel: { zustand: 'da', daten: { ok: true, offen: 0, vorschlaege: [] } },
      form: 'breit', auswahl: { art: 'head', headId: 'sales' }, entwurf: null, starteEntwurf: () => {}, jetzt: new Date('2026-10-09T08:00:00.000Z'), space: 'business', bereich: 'alle',
      oeffne: () => {}, dialog: () => {}, bestaetigen: async () => true, melde: () => {}, vorlage: { skills: { sales: FIX.SKILLS } },
    };
  };
  it('Reiter Einstellungen: Modell, Aufwand, Autonomie, Budget, Zuständig, an/aus, Foto, Not-Aus — wenn die Person darf', async () => {
    const { AgentenKontext } = await import('@/components/os/agenten/kontext');
    const { HeadMitte } = await import('@/components/os/agenten/HeadMitte');
    const html = renderToStaticMarkup(h(AgentenKontext, { wert: await wert() }, h(HeadMitte, { headId: 'sales', startReiter: 'einstellungen' })));
    expect(html).toContain('Modell — Modell A (Vorgabe)');
    expect(html).toContain('Risikoarm selbst');
    expect(html).toContain('nur verschärfen');
    expect(html).toContain('Budget je Monat in Euro');
    expect(html).toContain('20,00');
    expect(html).toContain('Name B');
    expect(html).toContain('Head ist an');
    expect(html).toContain('Bild wählen');
    expect(html).toContain('anhalten (Not-Aus)');
  });
  it('Budget-Fenster: Monat ODER gesamt setzen (Inhaber), klar beschriftet; Balken zeigt den Server-Stand', async () => {
    const { AgentenKontext } = await import('@/components/os/agenten/kontext');
    const { BudgetFenster } = await import('@/components/os/agenten/Dialoge');
    const { BudgetBalken } = await import('@/components/os/agenten/Kopfleiste');
    const html = renderToStaticMarkup(h(AgentenKontext, { wert: await wert() }, h(BudgetFenster, { onZu: () => {} })));
    expect(html).toContain('Je Kalendermonat');
    expect(html).toContain('Gesamt ab jetzt');
    expect(html).toContain('seit 09.10.2026');
    expect(html).toContain('Grenze speichern');
    const balken = renderToStaticMarkup(h(AgentenKontext, { wert: await wert() }, h(BudgetBalken, {})));
    expect(balken).toMatch(/50,00\s€ gesamt/);
    const ohne = renderToStaticMarkup(h(AgentenKontext, { wert: await wert({ budget: { monat: { verbrauchtCent: 100, grenzeCent: null, prozent: null, stufe: 0, text: '' }, stufe: 0, setzen: false } }) }, h(BudgetFenster, { onZu: () => {} })));
    expect(ohne).not.toContain('Grenze speichern');
    expect(ohne).toContain('Die Grenze setzt der Inhaber');
  });
});
