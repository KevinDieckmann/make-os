// ─── Wächter: KI-Etiketten, Bereich je Einheit, feste Personen im Agentenpfad (09.10., Analyse 4 „Trennung & Plattform“ K1/K3/K4/K5/K6) ──
//   K1  Ergebnisse von `run_agent` tragen ihre KI-Kategorien — ohne Einwilligung (b) kein Recovery-Wert im nächsten Modellaufruf; mit (b) trägt
//       der nächste Aufruf das Etikett „gesundheit“; die Agentenliste bietet nur Agenten an, deren Bereiche für die Person frei sind.
//   K5  Systemläufe nennen dem KI-Tor die Person, für die gerechnet wird (Fokus mit Einwilligung nicht mehr fälschlich gesperrt).
//   K3  Die Selbstständigkeit (Privat-Einheit) zählt in keiner Business-Zahl (Kasse, Schilde, Mandate, Board) — mit der Instanz-Umstellung wieder.
//   K4  Head of Finance, Ist-Stand, Kalender-Vorschlag: Personen aus den Konten, keine festen Namen.
//   K6  Task-Agent „autonom“: Privates bleibt privat und „nur ich“, kein Warum (Gesundheit) im Text.
// Eigener Datenordner, erfundene Konten (`@example.invalid`), Modell als Fake (kein Netz), nie echte Daten.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ki-etiketten-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-ki-etiketten-0910', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_INTERN;
  delete process.env.ICLOUD_APPLE_ID;
  delete process.env.ICLOUD_APP_PASSWORT;
  delete process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN;
  return o;
});

// Der Live-Zustand des Gesprächs trägt hier KEIN Etikett „gesundheit“ — so zeigt das KI-Protokoll, was das Ergebnis eines Fach-Agenten
// selbst mitbringt (der Prompt-Aufbau bleibt echt).
vi.mock('@/lib/brain', async orig => {
  const o = await orig<typeof import('@/lib/brain')>();
  return { ...o, brainKategorien: (...a: Parameters<typeof o.brainKategorien>) => o.brainKategorien(...a).filter(k => k !== 'gesundheit') };
});

import { konto, modellFake, rufe, sitzung, text, werkzeug, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
const HAUS = 'haus-e';
const HEUTE_REC = 37;
let db: typeof import('@/lib/store/local-db');
let m: ModellFake;
let kimmi: { POST: H };
let fokus: { POST: H };
let board: { POST: H };
let finanzchef: { POST: H };

const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const istZoe = (b: Record<string, unknown>) => JSON.stringify(b.system ?? '').includes('Du bist ZOE');
const ohneB = 'person-a';  // volles Mitglied ohne Einwilligung (b)
const mitB = 'person-b';   // Inhaberin mit (a)+(b)

async function warteAuf<T>(f: () => Promise<T | null | undefined | false>, ms = 3000): Promise<T> {
  const bis = Date.now() + ms;
  for (;;) { const v = await f(); if (v) return v; if (Date.now() > bis) throw new Error('Zeit abgelaufen'); await new Promise(r => setTimeout(r, 25)); }
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k2', mitB, 'inhaber', { haushalt: HAUS, angelegt: '2026-10-07' }),
    konto('k1', ohneB, 'mitglied', { haushalt: HAUS, angelegt: '2026-10-07' }),
    konto('k3', 'team-c', 'mitglied', { haushalt: HAUS, finanzRecht: 'business', angelegt: '2026-10-07' }),
  ], einladungen: [] });
  const E = await import('@/lib/datenschutz/gesundheit-einwilligung');
  expect(await E.gesundheitErklaeren(mitB, 'verarbeiten', true, E.GESUNDHEIT_FASSUNG)).toMatchObject({ ok: true });
  expect(await E.gesundheitErklaeren(mitB, 'ki', true, E.GESUNDHEIT_FASSUNG)).toMatchObject({ ok: true });
  const { localDay } = await import('@/lib/zeit');
  const { speicherFuer } = await import('@/lib/zoe/raum');
  for (const p of [ohneB, mitB]) await db.saveJson(speicherFuer('vitals', p), { [localDay()]: { rec: HEUTE_REC, sleep: 5.9, hrv: 41, rhr: 58 } });
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  fokus = (await import('@/app/api/fokus/route')) as unknown as typeof fokus;
  board = (await import('@/app/api/board/route')) as unknown as typeof board;
  finanzchef = (await import('@/app/api/finanzchef/route')) as unknown as typeof finanzchef;
  m = modellFake();
  // Interne Hops (runAgent → /api/fokus) laufen im Prozess — alles andere geht an den Modell-Fake (der jedes andere Netz sperrt).
  const modell = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('http://localhost:3001/api/fokus')) return fokus.POST(new Request(u, init));
    return modell(url as string, init);
  }) as typeof fetch;
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

describe('K1 — Fach-Agenten-Ergebnisse tragen ihre KI-Kategorien', () => {
  it('jeder Fach-Agent, den ZOE starten kann, hat Kategorien; Gesundheit nur, wenn der Lauf sie hatte', async () => {
    const { AUSFUEHRBAR, SYSTEM_LAEUFE } = await import('@/lib/zoe/agenten');
    const { AGENT_KATEGORIEN, AGENT_MIT_GESUNDHEIT, agentKategorien } = await import('@/lib/zoe/agent-kategorien');
    const fach = AUSFUEHRBAR.filter(a => !(SYSTEM_LAEUFE as readonly string[]).includes(a));
    expect(fach.filter(a => !AGENT_KATEGORIEN[a])).toEqual([]);
    for (const a of ['fokus', 'performance', 'ernaehrung']) expect(AGENT_MIT_GESUNDHEIT.has(a)).toBe(true);
    expect(agentKategorien('controlling', true)).toEqual(['finanzen']);
    expect(agentKategorien('fokus', false)).not.toContain('gesundheit');
    expect(agentKategorien('fokus', true)).toContain('gesundheit');
    expect(agentKategorien('fokus', undefined)).toContain('gesundheit'); // ohne Rückmeldung: vorsichtig ja
  });

  it('/api/fokus ohne Einwilligung (b): kein Recovery, keine Zone in der Antwort — mit (b) schon', async () => {
    m.antworten.push(text('Tagesplan ohne Werte.'));
    const ohne = await rufe(fokus.POST, '/api/fokus', sitzung(ohneB), {});
    expect(ohne.status).toBe(200);
    expect(ohne.d).not.toHaveProperty('recovery');
    expect(ohne.d).not.toHaveProperty('zone');
    expect(ohne.d.gesundheit).toBe(false);
    m.antworten.push(text('Tagesplan mit Werten.'));
    const mit = await rufe(fokus.POST, '/api/fokus', sitzung(mitB), {});
    expect(mit.d).toMatchObject({ recovery: HEUTE_REC, gesundheit: true });
  });

  it('Person ohne (b) fragt nach der Tagesform: kein Recovery-Wert in der nächsten Modellanfrage', async () => {
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['run_agent', { agent: 'fokus' }]), text('Heute zuerst: Angebot fertig machen.'), text('Dein Tag steht.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung(ohneB), { message: 'Starte den Fokus-Agent für meine Tagesform.' });
    expect(r.status).toBe(200);
    const zoe = m.anfragen.filter(istZoe);
    expect(zoe.length).toBe(2);
    const naechste = JSON.stringify(zoe[1].messages);
    expect(naechste).toContain('TAGESFORM');                         // das Ergebnis kam zurück …
    expect(naechste).not.toMatch(new RegExp(`Recovery\\s*${HEUTE_REC}|${HEUTE_REC}\\s*%|\\(ROT|\\(GELB|\\(GRÜN`)); // … ohne Körperwert
  });

  it('mit (b): der NÄCHSTE Modellaufruf trägt das Etikett „gesundheit“ (KI-Protokoll), der erste nicht', async () => {
    const { kiProtokollLesen } = await import('@/lib/datenschutz/ki-protokoll');
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['run_agent', { agent: 'fokus' }]), text('Heute zuerst: Angebot fertig machen.'), text('Dein Tag steht.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung(mitB), { message: 'Starte den Fokus-Agent für meine Tagesform.' });
    expect(r.status).toBe(200);
    expect(JSON.stringify(m.anfragen.filter(istZoe)[1].messages)).toMatch(new RegExp(`Recovery ${HEUTE_REC}%`));
    const zeilen = await warteAuf(async () => { const z = (await kiProtokollLesen({ person: mitB, monate: 1 })).filter(x => x.zweck === 'zoe-gespraech'); return z.length >= 2 ? z : null; });
    expect(zeilen.filter(z => z.kategorien.includes('gesundheit'))).toHaveLength(1);
    expect(zeilen.filter(z => !z.kategorien.includes('gesundheit'))).toHaveLength(1);
  });

  it('Agentenliste: ein für ZOE ausgeschalteter Bereich bietet seine Fach-Agenten nicht an', async () => {
    const { aendereKiEinstellungen, kiEinstellungenVergessen } = await import('@/lib/datenschutz/ki-einstellungen');
    await aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), [ohneB]: { bereiche: { finanzen: false } } } }));
    kiEinstellungenVergessen();
    try {
      m.anfragen.length = 0;
      m.antworten.push(text('Gern.'));
      await rufe(kimmi.POST, '/api/kimmi', sitzung(ohneB), { message: 'Welche Agenten kann ich starten?' });
      const tools = (m.anfragen.filter(istZoe)[0].tools as { name: string; input_schema: { properties: { agent?: { enum?: string[] } } } }[]);
      const angebot = tools.find(t => t.name === 'run_agent')?.input_schema.properties.agent?.enum ?? [];
      expect(angebot).toContain('fokus');
      for (const a of ['controlling', 'board', 'okr', 'finanzchef', 'performance']) expect(angebot).not.toContain(a);
    } finally {
      await aendereKiEinstellungen(d => ({ ...d, personen: {} }));
      kiEinstellungenVergessen();
    }
  });
});

describe('K5 — Person im KI-Tor bei Systemläufen', () => {
  it('Fokus im Systemlauf (ohne Person): das KI-Tor sieht die Inhaberin — mit ihrer Einwilligung nicht gesperrt, die Zeile trägt sie', async () => {
    const { kiProtokollLesen } = await import('@/lib/datenschutz/ki-protokoll');
    m.antworten.push(text('Tagesplan.'));
    const r = await rufe(fokus.POST, '/api/fokus', dienst(), {});
    expect(r.status).toBe(200);
    expect(r.d.reply).toBe('Tagesplan.');
    // Systemlauf rechnet für die Inhaberin (laufPerson, mit (b)) — vorher ging `null` ans Tor: gesperrt, Zeile ohne Person (Art. 15).
    const z = await warteAuf(async () => (await kiProtokollLesen({ person: mitB, monate: 1 })).find(x => x.zweck === 'fokus' && x.lauf === 'hintergrund'));
    expect(z).toMatchObject({ ergebnis: 'ok', kategorien: expect.arrayContaining(['gesundheit']) });
  });

  it('Board, OKR, Fokus, Tageslauf, Planung: jeder kiAus nennt die Person', () => {
    for (const f of ['app/api/board/route.ts', 'app/api/okr/route.ts', 'app/api/fokus/route.ts', 'app/api/tageslauf/route.ts', 'app/api/planung/vorschlag/route.ts', 'app/api/controlling/analyse/route.ts']) {
      const t = readFileSync(f, 'utf8');
      const aufrufe = t.match(/kiAus\(req,[^\n]*/g) ?? [];
      expect(aufrufe.length, f).toBeGreaterThan(0);
      for (const a of aufrufe) expect(a, `${f}: ${a}`).toMatch(/person/);
    }
  });
});

describe('K3 — Bereich je Einheit im ZOE-/Agentenpfad', () => {
  const WIE_VORHER = JSON.stringify({ kdc: { bereich: 'business' } });
  async function mit<T>(vorher: boolean, laden: () => Promise<T>): Promise<T> {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_MAKE_OS_EINHEITEN', vorher ? WIE_VORHER : '');
    return laden();
  }
  afterEach(() => { vi.unstubAllEnvs(); });
  const konten = [{ id: 'kdc', kontostand: 50_000, stand: '2026-10-08' }, { id: 'ug', kontostand: 1_000, stand: '2026-10-08' }, { id: 'privat', kontostand: 9_999, stand: '2026-10-08' }];
  const mandat = (id: string, gesellschaft: string, betrag: number) => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft, status: 'aktiv', honorar: { betrag, basis: 'monat', netto: true } });

  it('Kasse (geschaeftsKasse/mitKasse): ohne das Konto der Selbstständigkeit — mit Instanz-Umstellung wieder mit', async () => {
    const nachher = await mit(false, () => import('@/lib/make-one/finance-data'));
    expect(nachher.geschaeftsKasse(konten, 0)).toMatchObject({ betrag: 1_000, konten: 1 });
    const vorher = await mit(true, () => import('@/lib/make-one/finance-data'));
    expect(vorher.geschaeftsKasse(konten, 0)).toMatchObject({ betrag: 51_000, konten: 2 });
  });

  it('Mandats-Cashflow (kundenAusMandaten): nur Business-Gesellschaften — mit Instanz-Umstellung wieder mit', async () => {
    const crm = { mandate: [mandat('m1', 'kdc', 8_000), mandat('m2', 'ug', 2_000)] } as never;
    const nachher = await mit(false, () => import('@/lib/crm/speicher'));
    expect(nachher.kundenAusMandaten(crm).kunden).toEqual([{ name: 'Kunde m2', status: 'aktiv', cashflow: 2_000 }]);
    const vorher = await mit(true, () => import('@/lib/crm/speicher'));
    expect(vorher.kundenAusMandaten(crm).kunden.map(k => k.cashflow)).toEqual([8_000, 2_000]);
  });

  it('Schilde: eine überfällige Forderung der Selbstständigkeit ist kein Business-Alarm, eine der Gesellschaft schon', async () => {
    vi.resetModules();
    const { computeShields } = await import('@/lib/risk');
    await db.saveJson('finanzplan', { firmen: konten, rechnungen: [
      { id: 'r1', kunde: 'X', status: 'gestellt', betrag: 777, faellig: '2026-01-05', firmaId: 'kdc' },
    ], zahlungen: [{ id: 'z1', an: 'Y', status: 'offen', betrag: 444, faellig: '2026-01-05', firmaId: 'kdc' }] });
    const nur = await computeShields('2026-10-09', ohneB);
    expect(nur.map(s => s.id)).not.toContain('forderungen');
    expect(nur.map(s => s.id)).not.toContain('zahlungen');
    await db.saveJson('finanzplan', { firmen: konten, rechnungen: [
      { id: 'r1', kunde: 'X', status: 'gestellt', betrag: 777, faellig: '2026-01-05', firmaId: 'kdc' },
      { id: 'r2', kunde: 'Z', status: 'gestellt', betrag: 1_111, faellig: '2026-01-05', firmaId: 'ug' },
    ], zahlungen: [] });
    const beide = await computeShields('2026-10-09', ohneB);
    const f = beide.find(s => s.id === 'forderungen');
    expect(f?.text).toMatch(/1\.111/);
    expect(f?.text).not.toMatch(/1\.888|777/);
    await db.saveJson('finanzplan', { firmen: [], rechnungen: [], zahlungen: [] });
  });

  it('Board: Aufgaben der Selbstständigkeit (Projekt-Kategorie noch „business“) gehen nicht ins Board-Pack', async () => {
    const T = '2026-09-01T10:00:00.000Z';
    const projekt = (id: string, spaceId: string) => ({ id, title: `Projekt ${id}`, category: 'business', owner: 'both', color: '#fff', tags: [], archived: false, spaceId, createdAt: T, updatedAt: T });
    const aufgabe = (id: string, projectId: string, spaceId: string, title: string) => ({ id, projectId, spaceId, title, status: 'todo', priority: 'critical', assignee: ohneB, tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T, updatedAt: T });
    await db.saveJson('tasks', { projects: [projekt('p-selbst', 'kdc'), projekt('p-make', 'ug')], tasks: [aufgabe('t1', 'p-selbst', 'kdc', 'GEHEIM-SELBST-AUFGABE'), aufgabe('t2', 'p-make', 'ug', 'SICHTBAR-MAKE-AUFGABE')], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
    m.anfragen.length = 0;
    m.antworten.push(text(JSON.stringify({ headline: 'Woche ok.', sektionen: [], risiken: [], naechsteWoche: [] })));
    const r = await rufe(board.POST, '/api/board', sitzung(ohneB), {});
    expect(r.status).toBe(200);
    const prompt = JSON.stringify(m.anfragen.at(-1));
    expect(prompt).toContain('SICHTBAR-MAKE-AUFGABE');
    expect(prompt).not.toContain('GEHEIM-SELBST-AUFGABE');
    await db.saveJson('tasks', { projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
  });
});

describe('K4 — Personen aus den Konten statt fester Namen', () => {
  it('Head of Finance: Schema und Prüfer kennen die Personen des Haushalts, keine festen Namen', async () => {
    const { schemaFuer, SYSTEM, werWerte } = await import('@/lib/finanzen/chef/prompt');
    const { normalisiere } = await import('@/lib/finanzen/chef/pruefer');
    expect(SYSTEM).not.toMatch(/\bkevin\b|\bmalin\b/i);
    expect(werWerte([ohneB, mitB])).toEqual([ohneB, mitB, 'beide', 'steuerberater']);
    const s = JSON.stringify(schemaFuer([ohneB, mitB]));
    expect(s).toContain(mitB);
    expect(s).not.toMatch(/"kevin"|"malin"/);
    const roh = (wer: string) => ({ modus: 'frage', status: 'ruhig', zusammenfassung: 'x', vorschlaege: [{ titel: 'T', begruendung: 'b', verantwortlich: wer, bereich: 'business', art: 'klaeren', quelle: [] }] });
    expect(normalisiere(roh(mitB), 'frage', [ohneB, mitB]).vorschlaege[0].verantwortlich).toBe(mitB);
    expect(normalisiere(roh('kevin'), 'frage', [ohneB, mitB]).vorschlaege[0].verantwortlich).toBe('beide');
    expect(normalisiere(roh('steuerberater'), 'frage', [ohneB]).vorschlaege[0].verantwortlich).toBe('steuerberater');
  });

  it('Head of Finance: ein angenommener Vorschlag wird Aufgabe der genannten bzw. der annehmenden Person — nie einer festen', async () => {
    const jetzt = '2026-10-09T08:00:00.000Z';
    const v = (id: string, wer: string) => ({ id, titel: `Vorschlag ${id}`, begruendung: 'b', betrag_eur: null, frist: null, prioritaet: 'mittel', verantwortlich: wer, bereich: 'business', art: 'klaeren', quelle: [], dedup_schluessel: id, status: 'offen', erstellt: jetzt, aktualisiert: jetzt, berichtId: 'hb-1' });
    await db.saveJson('finanzchef', { berichte: [], vorschlaege: [v('v1', 'beide'), v('v2', ohneB)], letzte: {}, versuche: {} });
    for (const id of ['v1', 'v2']) {
      const r = await rufe(finanzchef.POST, '/api/finanzchef', sitzung(mitB), { aktion: 'vorschlag', id, status: 'angenommen', umfang: 'business' });
      expect(r.status, JSON.stringify(r.d)).toBe(200);
    }
    const tasks = (await db.loadJson<{ tasks: { id: string; assignee: string }[] }>('tasks'))!.tasks;
    expect(tasks.find(t => t.id === 'hof-v1')?.assignee).toBe(mitB);   // „beide“ → die annehmende Person
    expect(tasks.find(t => t.id === 'hof-v2')?.assignee).toBe(ohneB);  // genannte Person des Haushalts
  });

  it('Ist-Stand: Zuständige aus den Konten, kein Schritt mit festem Namen', async () => {
    const { istStand } = await import('@/lib/finanzen/chef/ist-stand');
    const liste = istStand({
      heute: '2026-10-09', firmen: [], offeneRechnungen: [], leereControllingMonate: null, grundlageStand: null, planposten: 0, zuKlaeren: 0,
      rechtsform: { kdv: null, kdc: null }, inhaber: { kennung: ohneB, name: 'Person' },
      haushalt: { umzug: false, buchungen: 0, letzteBuchung: null, ohneKategorie: 0, pruefposten: 0, steuerquote: null, mitglieder: [ohneB], ohneHaushalt: 1 },
    });
    expect(JSON.stringify(liste)).not.toMatch(/kevin|malin/i);
    expect(new Set(liste.map(x => x.wer))).toEqual(new Set([ohneB, 'beide']));
    expect(liste.find(x => x.id === 'zugang')).toMatchObject({ erledigt: false, wer: ohneB, werName: 'Person' });
  });

  it('Kalender-Vorschlag: eigener Kalender aus Zuordnung/eigener iCloud — ohne beides nur der gemeinsame, nie ein fremder', async () => {
    const { vorschlagsKalender } = await import('@/lib/zoe/kalender-vorschlag');
    const einst = { kalender: { kevin: 'Kalender A', malin: 'Kalender B', beide: 'Gemeinsam' } };
    expect(vorschlagsKalender(einst, ohneB)).toMatchObject({ eigen: null, gemeinsam: 'Gemeinsam' });
    expect([...vorschlagsKalender(einst, ohneB).erlaubt]).toEqual(['Gemeinsam']);
    expect(vorschlagsKalender(einst, ohneB, 'iCloud Eigen').eigen).toBe('iCloud Eigen');
    // Altbestand: die Zuordnung je Speichername bleibt gültig.
    expect(vorschlagsKalender(einst, 'malin').eigen).toBe('Kalender B');
  });

  it('Kalender-Vorschlag freigeben: ein Block im Kalender einer anderen Person wird nicht angelegt (403)', async () => {
    const { legeKalenderVorschlaege, KALENDER_STAPEL_ART } = await import('@/lib/zoe/kalender-vorschlag');
    const stapel = await import('@/lib/zoe/stapel');
    const { localDay, tagePlus } = await import('@/lib/zeit');
    // Ein (alter) Vorschlag zielt auf den Standard-Kalender einer festen Person — person-a hat keinen eigenen Kalender zugeordnet.
    const [id] = await legeKalenderVorschlaege([{ title: 'Fokus', date: tagePlus(localDay(), 1), startHour: 9, durationMin: 60, calendar: 'Privat Kevin' }], ohneB);
    const r = await KALENDER_STAPEL_ART.freigeben((await stapel.hole(id))!, ohneB, {});
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect((await stapel.hole(id))?.status).toBe('offen');
  });

  it('keine festen Personen mehr in den angefassten Agentenpfaden', () => {
    for (const f of ['lib/finanzen/chef/prompt.ts', 'lib/finanzen/chef/pruefer.ts', 'lib/finanzen/chef/ist-stand.ts', 'app/api/finanzchef/route.ts', 'lib/zoe/kalender-vorschlag.ts', 'lib/aufgaben/serie.ts', 'lib/business/messen.ts', 'lib/performance.ts']) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toMatch(/['"](kevin|malin)['"]/);
    }
  });
});

describe('K6 — Task-Agent „autonom“: Privates bleibt privat', () => {
  it('Priorität ohne „business“ → Privat + „nur ich“; kein Warum (kann Gesundheit tragen) im Text', async () => {
    const { autoAufgabe } = await import('@/lib/tageslauf');
    const privat = autoAufgabe({ titel: 'Früh schlafen', warum: `Recovery ${HEUTE_REC} %`, wann: 'abends' })!;
    expect(privat).toMatchObject({ space: 'privat', sichtbarkeit: 'nur-ich' });
    expect(JSON.stringify(privat)).not.toMatch(/Recovery|37/);
    const business = autoAufgabe({ titel: 'Angebot fertig', warum: 'Kunde wartet', bereich: 'business' })!;
    expect(business.space).toBe('business');
    expect(business).not.toHaveProperty('sichtbarkeit');
    expect(business.description).not.toContain('Kunde wartet');
    expect(autoAufgabe({ titel: '  ' })).toBeNull();
  });
  it('die Route legt keine Aufgabe mehr mit festem Business-Space an', () => {
    const t = readFileSync('app/api/tageslauf/route.ts', 'utf8');
    expect(t).not.toMatch(/space: 'business'/);
    expect(t).toMatch(/autoAufgabe\(/);
  });
});
