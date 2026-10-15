// ─── Wächter „Konto nur Business bekommt nichts aus Privat, Selbstständigkeit oder Gründungsfahrplan“ (15.10., Abnahme 2 A1/B8) ─────────
// Erweitert die vorhandenen Wächter (tests/messlatte-malin.test.ts › Partner, tests/aufgaben-firmenakte-sicht.test.ts › Planung) um das,
// was die zweite unabhängige Abnahme (15.10.) noch durchließ: Fahrplan in „Für dich“ (Fluss) und in der Kapazität, Register-Gesellschaften
// und die Selbstständigkeit in der Brain-Kugel, in der Postfach-Verwaltung und bei den Visitenkarten.
// Regel (CLAUDE.md, Kevin: „Trennung serverseitig, nie nur versteckt“): ein Konto „nur Business“ (`finanzRecht: 'business'`) bekommt in KEINER
// Server-Antwort etwas aus Privat, aus der Selbstständigkeit (Privat-Einheit, `gehoertZuPrivat`) oder aus dem Gründungsfahrplan bzw. aus
// Gesellschaften des Registers (die Firmen-Akte sagt ihm „nicht freigegeben“). Business sieht es weiter (Gegenprobe).
// ALLE lesenden Routen aus dem Routen-Register mit der Sitzung „nur Business“ — ohne Parameter, mit `?space=privat` und mit `?space=business`.
// Dazu die Space-Wahl im Browser (nie „privat“) und die Umleitung der Seiten (Middleware). Eigener Datenordner, erfundene Werte, kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// Der Name der Selbstständigkeit (Privat-Einheit `kdc`) ist eine Marke — vor jedem Import (lib/einheiten.ts liest ihn beim Laden).
process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN = JSON.stringify({ kdc: { label: 'NB-SELBST-NAME', kurz: 'NBSELBSTKURZ' } });
const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-nur-business-'));
const daten = path.join(wurzel, 'daten');
const vault = path.join(wurzel, 'vault');
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_EMBEDDINGS = 'aus';
process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.MAKE_OS_KEY ??= 'pruef-schluessel-nur-business';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 });
});

const HAUS = 'haus-nb';
/** Marken, die ein Konto „nur Business“ nie bekommt. */
const GEHEIM = {
  privatAufgabe: 'NB-PRIVAT-AUFGABE',
  privatZiel: 'NB-PRIVAT-ZIEL',
  privatMeilenstein: 'NB-PRIVAT-MEILENSTEIN',
  selbstName: 'NB-SELBST-NAME',
  selbstKurz: 'NBSELBSTKURZ',
  selbstAufgabe: 'NB-SELBST-AUFGABE',
  selbstMeilenstein: 'NB-SELBST-MEILENSTEIN',
  selbstZiel: 'NB-SELBST-ZIEL',
  gruendung: 'NB-GRUENDUNG-GESELLSCHAFT',
  fahrplanMs: 'NB-FAHRPLAN-MEILENSTEIN',
  gruendungNotiz: 'NB-GRUENDUNG-NOTIZ',
};
/** Marken aus Business — die bekommt das Konto „nur Business“ (Gegenprobe: der Filter ist kein Komplett-Verbot). */
const BUSINESS = { ziel: 'NB-BUSINESS-ZIEL', meilenstein: 'NB-BUSINESS-MEILENSTEIN', aufgabe: 'NB-BUSINESS-AUFGABE' };

type Handler = (r: Request) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher: sp, email: `${sp}@example.invalid`, name: `${sp[0].toUpperCase()}${sp.slice(1)} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...extra });

const UEBERSPRUNGEN: Record<string, string> = { 'jarvis/[...pfad]': 'nur 308-Weiterleitung auf /api/zoe/* — die Ziele werden selbst geprüft' };
const ZUSATZ: Record<string, string> = { 'state/flaeche': 'seite=heute', 'agenten/skills': 'head=sales' };
const SEGMENTE: Record<string, string | string[]> = { head: 'sales', slug: 'nb-0123456789abcdef01234567', token: 'x', pfad: ['wissen'] };
const VARIANTEN = ['', '?space=privat&sicht=privat&bereich=privat', '?space=business&sicht=business&bereich=business'];
/** Weitere Abfragen je Route (Pflicht-Parameter bzw. Wege, die ohne Parameter nichts liefern) — zusätzlich zu den Varianten. */
const FLUSS = ['markttraktion', 'finanzen-privat', 'finanzen-business', 'planung', 'aufgaben', 'kalender', 'gesundheit', 'familie', 'netzwerken', 'inbox'];
const extra = (fm: string): Record<string, string[]> => ({
  fluss: [...FLUSS.map(b => `?bereich=${b}`), ...FLUSS.map(b => `?bereich=${b}&space=business`)],
  seil: ['?ebene=jahr&bereich=business', '?ebene=aufgaben', '?ebene=quartal', '?ebene=monat'],
  'planung/meilenstein': [`?id=${fm}`, '?id=ms-selbst', '?id=ms-privat'],
  'kalender/jahr': [`?jahr=${new Date().getFullYear()}`],
  'state/zeit/einheiten': ['?zeitraum=monat'],
});
type Ctx = { params: Promise<Record<string, string | string[]>> };
type GetHandler = (r: Request, ctx?: Ctx) => Promise<Response>;
const mitFrist = async <T,>(p: Promise<T>, ms: number): Promise<T | 'frist'> => {
  let t: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<'frist'>(res => { t = setTimeout(() => res('frist'), ms); })]); } finally { if (t) clearTimeout(t); }
};
async function rufeGet(pfad: string, query: string, person: string): Promise<{ status: number; text: string } | 'frist' | { fehler: string }> {
  try {
    const m = (await import(`@/app/api/${pfad}/route`)) as { GET?: GetHandler };
    if (!m.GET) return { fehler: 'kein GET' };
    const params: Record<string, string | string[]> = {};
    for (const [, name] of pfad.matchAll(/\[(?:\.\.\.)?([a-z]+)\]/g)) params[name] = SEGMENTE[name] ?? 'x';
    const z = ZUSATZ[pfad];
    const q = z ? (query ? `${query}&${z}` : `?${z}`) : query;
    const r = await mitFrist(m.GET(new Request(`http://test/api/${pfad}${q}`, { headers: sitzung(person) }), { params: Promise.resolve(params) }), 20_000);
    if (r === 'frist') return 'frist';
    const text = await mitFrist(r.text(), 10_000);
    if (text === 'frist') return 'frist';
    return { status: r.status, text };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
}

const echtesFetch = globalThis.fetch;
let routen: string[] = [];
const GID = 'g-33333333-3333-4333-8333-333333333333';
let FM = '';

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ICLOUD_APPLE_ID;
  delete process.env.ICLOUD_APP_PASSWORT;
  await fs.mkdir(daten, { recursive: true });
  await fs.mkdir(path.join(vault, '01. Business'), { recursive: true });
  const db = await import('@/lib/store/local-db');
  const { localDay, tagePlus } = await import('@/lib/zeit');
  const H = localDay();
  const jahr = Number(H.slice(0, 4));
  await db.saveJson('konten', { konten: [konto('k1', 'inhaberin', 'inhaber'), konto('k2', 'zweite', 'mitglied'), konto('k3', 'partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });

  // Register: eine Gesellschaft in Gründung (nur Register) — und ein Eintrag der Selbstständigkeit (feste Kennung, Privat-Einheit).
  await db.saveJson(`gesellschaften--${HAUS}`, { gesellschaften: [
    { id: 'kdc', notizen: 'Steckbrief der Selbstständigkeit' },
    { id: GID, name: GEHEIM.gruendung, status: 'gruendung', rechtsform: 'gmbh', notizen: GEHEIM.gruendung, angelegt: `${H}T08:00:00.000Z` },
  ] });

  // Aufgaben: Privat, Selbstständigkeit (Privat-Einheit), Business.
  const T0 = '2026-10-01T08:00:00.000Z';
  const a = (id: string, title: string, spaceId: string, projectId: string) => ({ id, projectId, title, description: title, status: 'todo', priority: 'high', assignee: 'inhaberin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId, dueDate: H });
  await db.saveJson('tasks', {
    projects: [
      { id: 'p-privat', title: 'Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' },
      { id: 'p-business', title: 'Vertrieb', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'ug' },
    ],
    listen: [], statusEigen: [], vorlagen: [],
    tasks: [
      a('t-privat', GEHEIM.privatAufgabe, 'privat', 'p-privat'),
      a('t-selbst', GEHEIM.selbstAufgabe, 'kdc', 'sonstige-kdc'),
      { ...a('t-business', BUSINESS.aufgabe, 'ug', 'p-business'), assignee: 'partner' },
    ],
  });

  // Ziele (Jahr) und Meilensteine: Privat, Selbstständigkeit (gespeichert Business + Einheit kdc = Privat-Einheit), Business, Gründungsfahrplan.
  const { fahrplanFuer } = await import('@/lib/gesellschaften/fahrplan');
  const plan = fahrplanFuer(GID, { name: GEHEIM.gruendung, art: 'gruendung' }, GEHEIM.gruendung, H);
  FM = plan.meilensteine[0].id;
  const { KERN_EINHEITEN } = await import('@/lib/einheiten');
  const selbstName = KERN_EINHEITEN.find(e => e.id === 'kdc')!.label;
  expect(selbstName).toBe(GEHEIM.selbstName);
  await db.saveJson('ziele', {
    tag: [], woche: [], monat: [], quartal: [], fokus: {},
    jahr: [
      { id: 'z-privat', titel: GEHEIM.privatZiel, fortschritt: 10, space: 'privat', jahr },
      { id: 'z-selbst', titel: GEHEIM.selbstZiel, fortschritt: 10, space: 'business', einheit: selbstName, jahr, aufwand: 40, termin: tagePlus(H, 40) },
      { id: 'z-business', titel: BUSINESS.ziel, fortschritt: 10, space: 'business', einheit: 'ug', jahr, aufwand: 20, termin: tagePlus(H, 60) },
      { ...plan.ziel, aufwand: 30, termin: tagePlus(H, 50) },
    ],
  });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'ms-privat', titel: GEHEIM.privatMeilenstein, space: 'privat', faellig: tagePlus(H, 4), fortschritt: 0, erledigt: false, rang: 1 },
    { id: 'ms-selbst', titel: GEHEIM.selbstMeilenstein, space: 'business', bereich: 'business', einheit: selbstName, faellig: tagePlus(H, 5), fortschritt: 0, erledigt: false, rang: 2, aufwand: 12, zielId: 'z-selbst' },
    { id: 'ms-business', titel: BUSINESS.meilenstein, space: 'business', bereich: 'business', einheit: 'ug', faellig: tagePlus(H, 6), fortschritt: 0, erledigt: false, rang: 3, aufwand: 8, zielId: 'z-business' },
    ...plan.meilensteine.map((m, i) => ({ ...m, bereich: 'business', titel: `${m.titel} ${GEHEIM.fahrplanMs}`, ...(i === 0 ? { aufwand: 6 } : {}) })),
  ] });

  // Brain: eine Gründungs-Notiz nur für den Haushalt (`scope: intern` — wie die Demo-Notiz seit 15.10.).
  await fs.writeFile(path.join(vault, '01. Business', `${GEHEIM.gruendungNotiz}.md`),
    `---\ntitle: ${GEHEIM.gruendungNotiz}\ntype: notiz\nscope: intern\nowner: inhaberin\nstand: ${H}\n---\n\n# ${GEHEIM.gruendungNotiz}\n\nStammkapital, Gesellschafter.\n`);

  const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
  routen = Object.entries(ROUTEN_REGISTER)
    .filter(([pfad, e]) => e.methoden.GET && e.methoden.GET !== 'offen' && e.methoden.GET !== 'dienst' && !UEBERSPRUNGEN[pfad])
    .map(([pfad]) => pfad).sort();
}, 120_000);
afterAll(() => { globalThis.fetch = echtesFetch; });

describe('Konto „nur Business“: ALLE lesenden Routen ohne Privat, Selbstständigkeit, Gründungsfahrplan', () => {
  it('keine Antwort an das Konto „nur Business“ trägt eine Marke — in keiner Sicht', async () => {
    expect(routen.length).toBeGreaterThan(100);
    const lecks: string[] = [];
    const ohne: string[] = [];
    let erreicht = 0;
    for (const pfad of routen) {
      for (const v of [...VARIANTEN, ...(extra(FM)[pfad] ?? [])]) {
        const r = await rufeGet(pfad, v, 'partner');
        if (r === 'frist' || 'fehler' in r) { ohne.push(`${pfad}${v}: ${r === 'frist' ? 'Zeitüberschreitung' : r.fehler}`); continue; }
        if (v === '' && r.status === 200) erreicht++;
        for (const [name, marke] of Object.entries(GEHEIM)) if (r.text.includes(marke)) lecks.push(`${pfad}${v} (${r.status}) → ${name}`);
      }
    }
    if (ohne.length) console.warn(`[nur-business] ohne Antwort (${ohne.length}):\n${ohne.join('\n')}`);
    if (process.env.NB_LECKS) await fs.writeFile(process.env.NB_LECKS, `${lecks.join('\n')}\n--- ohne\n${ohne.join('\n')}\n`);
    // Gegenprobe der Rolle: das Konto kommt durch viele Tore (Haushalt des Inhabers).
    expect(erreicht).toBeGreaterThan(100);
    expect(lecks).toEqual([]);
  }, 900_000);

  it('Gegenprobe: jede Marke kommt bei der Inhaberin an, Business auch beim Konto „nur Business“ (die Saat ist lesbar)', async () => {
    const gefunden = new Set<string>();
    const business = new Set<string>();
    for (const pfad of routen) {
      for (const v of ['', ...(extra(FM)[pfad] ?? [])]) {
        const r = await rufeGet(pfad, v, 'inhaberin');
        if (r !== 'frist' && !('fehler' in r)) for (const [name, marke] of Object.entries(GEHEIM)) if (r.text.includes(marke)) gefunden.add(name);
        const p = await rufeGet(pfad, v, 'partner');
        if (p !== 'frist' && !('fehler' in p)) for (const [name, marke] of Object.entries(BUSINESS)) if (p.text.includes(marke)) business.add(name);
      }
    }
    // Der Kurzname der Selbstständigkeit steht nur in wenigen Ansichten (Chips) — er bleibt Marke für die Lecks, die Gegenprobe braucht ihn nicht.
    expect(Object.keys(GEHEIM).filter(n => n !== 'selbstKurz' && !gefunden.has(n))).toEqual([]);
    expect(Object.keys(BUSINESS).filter(n => !business.has(n))).toEqual([]);
  }, 900_000);

  it('Postfächer und Visitenkarten: keine Bereiche „Privat“, keine Privat-Einheit, keine Register-Gesellschaft', async () => {
    const pf = (await import('@/app/api/inbox/postfaecher/route')) as unknown as { GET: Handler };
    for (const q of ['', '?space=privat', '?space=business']) {
      const r = await pf.GET(new Request(`http://test/api/inbox/postfaecher${q}`, { headers: sitzung('partner') }));
      const d = await r.json() as { bereiche?: { id: string }[]; waehlbar?: { id: string }[] };
      const ids = [...(d.bereiche ?? []), ...(d.waehlbar ?? [])].map(b => b.id);
      expect(ids, q).not.toContain('privat');
      expect(ids, q).not.toContain('kdc');
      expect(ids.filter(id => id.startsWith('g-')), q).toEqual([]);
      expect(ids, q).toContain('ug');
    }
    // Gegenprobe: die Inhaberin wählt weiter alle Bereiche (ohne Sicht).
    const inh = await (await pf.GET(new Request('http://test/api/inbox/postfaecher', { headers: sitzung('inhaberin') }))).json() as { bereiche: { id: string }[] };
    expect(inh.bereiche.map(b => b.id)).toEqual(expect.arrayContaining(['privat', 'kdc', GID]));
    const vk = (await import('@/app/api/netzwerken/karten/route')) as unknown as { GET: Handler };
    const k = await (await vk.GET(new Request('http://test/api/netzwerken/karten', { headers: sitzung('partner') }))).json() as { gesellschaften?: { id: string }[] };
    expect((k.gesellschaften ?? []).map(g => g.id)).not.toContain('kdc');
  });
});

describe('Space-Wahl und Seiten für das Konto „nur Business“', () => {
  it('die Wahl im Kopf ist nie „privat“ — auch nicht über die Adresse oder eine Privat-Seite', async () => {
    const { wahlVon, gemerkteWahlAus } = await import('@/lib/make-one/spaces');
    for (const [pfad, suche] of [['/os', '?space=privat'], ['/os/gesundheit', ''], ['/os/sport', ''], ['/os/journal', ''], ['/os/familie', ''], ['/os/menschen', ''], ['/os/aufgaben', '?space=privat'], ['/os/finanzen', '?s=privat']]) {
      expect(wahlVon(pfad, suche, 'privat', true), `${pfad}${suche}`).toBe('business');
      expect(wahlVon(pfad, suche, gemerkteWahlAus('privat', 'privat', true), true)).toBe('business');
    }
    // Volle Mitglieder: unverändert.
    expect(wahlVon('/os/gesundheit', '', 'business')).toBe('privat');
    expect(wahlVon('/os', '?space=privat', 'business')).toBe('privat');
  });

  it('Seiten des Privat-Bereichs leiten für „nur Business“ nach Business-Heute (rein; die Middleware fragt hier)', async () => {
    const { privatSeite, NUR_BUSINESS_START, AUCH_NUR_BUSINESS } = await import('@/lib/zugang/privat-seite');
    expect(NUR_BUSINESS_START).toBe('/os?space=business');
    for (const [pfad, suche] of [['/os', '?space=privat'], ['/os/gesundheit', ''], ['/os/sport', '?s=lauf'], ['/os/journal', ''], ['/os/familie', '?b=rahmen'], ['/os/menschen', ''], ['/os/aufgaben', '?space=privat'], ['/os/finanzen', '?s=privat'], ['/os/finanzen', '?s=gesamt']]) {
      expect(privatSeite(pfad, suche), `${pfad}${suche}`).toBe(true);
    }
    for (const [pfad, suche] of [['/os', ''], ['/os', '?space=business'], ['/os/aufgaben', ''], ['/os/finanzen', '?s=business'], ['/os/markttraktion', ''], ['/os/ritual', '?modus=morgen'], ['/api/familie', ''], ['/anmelden', '']]) {
      expect(privatSeite(pfad, suche), `${pfad}${suche}`).toBe(false);
    }
    // Jede Seite, die die Leiste dem Privat-Bereich zuordnet, gilt hier als Privat-Seite (eine Liste, kein zweites Wissen).
    const { SPACES, aktiverSpaceEintrag } = await import('@/lib/make-one/spaces');
    for (const e of SPACES.find(s => s.id === 'privat')!.eintraege) {
      for (const m of e.passt) {
        const [p, q] = m.replace(/^=/, '').split('?');
        if (aktiverSpaceEintrag(p, q ? `?${q}` : '').space !== 'privat' || AUCH_NUR_BUSINESS.includes(p)) continue;
        expect(privatSeite(p, q ? `?${q}` : ''), m).toBe(true);
      }
    }
  });
});
