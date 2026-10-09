// ─── Agenten: Sicherheit und Recht an den Nahtstellen der letzten Merges (09.10., Kevin: „Das muss perfekt laufen. Denke immer einen Schritt weiter.“) ──
// Die Gegenprüfung lief auf einem früheren Stand. Danach kamen Streaming, Feinschliff, Härtetest (anfrageId, verwaiste Läufe), die zweite gleichwertige
// Inhaberin, neutral-rest/-2, brain-neutral, gesundheit-module, medien-nachzug und die Nahtstellen Zugang/CRM/Finanzen. Dieser Wächter prüft, wo
// diese Teile sich treffen — mit erfundenen Konten (`@example.invalid`), eigenem Datenordner und einer nachgebauten Messages-API (kein Netz):
//   (A) Was an das MODELL geht: ZOE (JSON und Strom) und jeder sichtbare Head rufen in einem „Rundlauf“ JEDES angebotene Werkzeug auf
//       (generische Eingaben, Personen-Felder auf die andere Person) — keine Anfrage an das Modell, keine Antwort und kein Strom-Stück trägt eine
//       Marke aus den privaten Beständen der ANDEREN Person (zweite Person, zweite Inhaberin, Partner „nur Business“).
//   (B) Funde der Prüfung (je erst rot, dann grün) — siehe die einzelnen `describe`.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { rmSync } from 'node:fs';

vi.setConfig({ testTimeout: 600_000, hookTimeout: 120_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-sicher-naht-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-sicher-naht', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.ICLOUD_APPLE_ID;
  delete process.env.ICLOUD_APP_PASSWORT;
  return o;
});

import type { StromEreignis } from '@/lib/http/sse';
import { konto, rufe, sitzung, text, werkzeug, type ModellAntwort } from './fixtures/agenten-kern';
import { kiFake, type KiFake, type Vorlage } from './fixtures/ki-fake';

type H = (r: Request) => Promise<Response>;
const HAUS = 'haus-n';
let db: typeof import('@/lib/store/local-db');
let ki: KiFake;
let kimmi: { POST: H };
let faden: { GET: H; POST: H };
let agentenRoute: { GET: H };

/** Marken aus den PRIVATEN Beständen von person-a (Inhaberin). Keine davon darf je bei einer anderen Person ankommen — auch nicht im Prompt. */
const A = {
  vault: 'NAHT-A-VAULT-PRIVAT',
  nurIch: 'NAHT-A-AUFGABE-NURICH',
  fakt: 'NAHT-A-ZOE-FAKT',
  faden: 'NAHT-A-FADEN-PRIVAT',
  zoeFaden: 'NAHT-A-ZOE-FADEN',
  merksatz: 'NAHT-A-MERKSATZ-PRIVAT',
  skill: 'NAHT-A-SKILL-PRIVAT',
  privatNotiz: 'NAHT-A-PRIVATNOTIZ',
  vital: 'NAHT-A-VITAL',
  journal: 'NAHT-A-JOURNAL',
  familie: 'NAHT-A-FAMILIE-NURICH',
  ziel: 'NAHT-A-ZIEL-EIGEN',
  stapel: 'NAHT-A-STAPEL',
  einstellung: 'NAHT-A-EINSTELLUNG',
  termin: 'NAHT-A-TERMIN-PRIVAT',
  routine: 'NAHT-A-ROUTINE',
};
/** Privates des HAUSHALTS — volle Mitglieder dürfen es sehen, ein Konto „nur Business“ nie. */
const HH = { buchung: 'NAHT-HH-BUCHUNG', familie: 'NAHT-HH-FAMILIE' };

const sitzungStrom = (p: string) => ({ ...sitzung(p), accept: 'text/event-stream' });

/** Eine generische Eingabe aus dem Schema: Suchbegriff „NAHT“, Personen-Felder auf person-a (die andere Person), Aufzählungen der erste Wert. */
function eingabeFuer(t: { name: string; input_schema?: { properties?: Record<string, { type?: string; enum?: unknown[] }> } }): Record<string, unknown> {
  const raus: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(t.input_schema?.properties ?? {})) {
    if (/^(person|wer|fuer|owner|von|besitzer|zustaendig)$/.test(k)) { raus[k] = 'person-a'; continue; }
    if (Array.isArray(p?.enum) && p.enum.length) { raus[k] = p.enum[0]; continue; }
    if (p?.type === 'number' || p?.type === 'integer') raus[k] = 5;
    else if (p?.type === 'boolean') raus[k] = false;
    else if (p?.type === 'array') raus[k] = [];
    else if (p?.type === 'object') raus[k] = {};
    else raus[k] = 'NAHT';
  }
  return raus;
}

/** Rundlauf-Fake: liegt noch kein Werkzeug-Ergebnis vor, ruft das „Modell“ ALLE angebotenen Werkzeuge auf (höchstens `je`), sonst antwortet es. */
function rundlauf(gerufen: Set<string>, je = 12): Vorlage {
  return (body: Record<string, unknown>): Vorlage => {
    const tools = ((body.tools as { name: string; input_schema?: never }[] | undefined) ?? []).filter(t => !gerufen.has(t.name));
    const msgs = (body.messages as { content?: unknown }[] | undefined) ?? [];
    const letzte = msgs.at(-1);
    const nachErgebnis = Array.isArray(letzte?.content) && (letzte!.content as { type?: string }[]).some(c => c?.type === 'tool_result');
    if (!tools.length || nachErgebnis) return text('NAHT-ANTWORT: fertig.');
    const wahl = tools.slice(0, je);
    wahl.forEach(t => gerufen.add(t.name));
    return werkzeug(...wahl.map(t => [t.name, eingabeFuer(t)] as [string, Record<string, unknown>]));
  };
}

async function strom(h: H, pfad: string, kopf: Record<string, string>, body: unknown): Promise<{ status: number; d: Record<string, unknown>; ereignisse: StromEreignis[] }> {
  const r = await h(new Request(`http://test${pfad}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) }));
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) return { status: r.status, d: await r.json() as Record<string, unknown>, ereignisse: [] };
  const { stromLesen } = await import('@/lib/http/strom-client');
  const ereignisse: StromEreignis[] = [];
  const ende = await stromLesen(r, e => ereignisse.push(e));
  return { status: ende?.status ?? 0, d: (ende?.body ?? {}) as Record<string, unknown>, ereignisse };
}

const funde = (text: string, marken: Record<string, string>): string[] => Object.entries(marken).filter(([, m]) => text.includes(m)).map(([n]) => n);

const ZOE_FRAGEN = [
  'NAHT Leads Kunden Kontakt Pipeline Angebot', 'NAHT Kampagne Newsletter Marketing', 'NAHT Events Gäste Einladung', 'NAHT Dublette Stammdaten Ablage',
  'NAHT Rechnung Kontostand Liquidität Finanzen', 'NAHT Haushalt Buchung privat Ausgaben', 'NAHT Gesundheit Schlaf Journal Routine Tagesform', 'NAHT Einkauf Rezept Essen',
  'NAHT Termin Kalender Block einplanen', 'NAHT Aufgabe Projekt Datei', 'NAHT Ziel Meilenstein Fokus', 'NAHT Notiz Brain Wissen merken', 'NAHT Mails Postfach Nachricht',
  'NAHT Gesellschaft Holding Beteiligung', 'NAHT Bauplan Fehler Idee', 'NAHT Agent Läufe Recherche Board starte',
];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await db.saveJson('konten', { konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: HAUS }),
    konto('k2', 'person-b', 'mitglied', { haushalt: HAUS }),
    konto('k3', 'partner', 'mitglied', { haushalt: HAUS, finanzRecht: 'business' }),
  ], einladungen: [] });

  // Vault: eine private Notiz von person-a (scope privat).
  const vault = process.env.MAKE_VAULT_DIR!;
  await fs.mkdir(path.join(vault, '02. MAKE Brain privat'), { recursive: true });
  await fs.mkdir(path.join(vault, '00. Fundament'), { recursive: true });
  await fs.writeFile(path.join(vault, '02. MAKE Brain privat', 'NAHT-Privat.md'), `---\ntype: notiz\nscope: privat\nowner: person-a\n---\n# NAHT Privat\n\n${A.vault} NAHT\n`);

  const J = new Date().toISOString();
  const { localDay } = await import('@/lib/zeit');
  const H = localDay();
  const T0 = '2026-10-01T08:00:00.000Z';
  const a = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, projectId: 'p-naht', title, status: 'todo', priority: 'high', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId: 'privat', dueDate: H, ...extra });
  await db.saveJson('tasks', {
    projects: [{ id: 'p-naht', title: 'NAHT Haus', category: 'joint', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId: 'privat' }],
    listen: [], statusEigen: [], vorlagen: [],
    tasks: [a('t-naht-geheim', `${A.nurIch} NAHT`, { sichtbarkeit: 'nur-ich', angelegtVon: 'person-a', description: A.nurIch }), a('t-naht-offen', 'NAHT gemeinsame Aufgabe')],
  });

  // ZOE-Gedächtnis: ein Fakt im Raum von person-a.
  const { merke } = await import('@/lib/zoe/gedaechtnis');
  await merke({ art: 'sonstiges', thema: 'NAHT', satz: `${A.fakt} NAHT`, raum: 'person-a' });

  // Threads von person-a: Privat-Head und ZOE (nicht geteilt).
  const fd = (id: string, agent: Record<string, unknown>, bereich: string, titel: string) => ({ id, besitzer: 'person-a', agent, bereich, titel, status: 'offen', fremdGelesen: false, vertraulich: false, erstellt: J, aktualisiert: J,
    nachrichten: [{ id: `nr-${id.slice(-4)}`, rolle: 'person', von: 'person-a', text: `${titel} NAHT`, zeit: J }] });
  await db.saveJson('agenten-faeden--person-a', { v: 1, zoeUebernahme: { am: J, anzahl: 0 }, faeden: [
    fd('fd-00000000-0000-4000-8000-0000000000a1', { art: 'head', headId: 'assistenz' }, 'privat', A.faden),
    fd('fd-00000000-0000-4000-8000-0000000000a2', { art: 'zoe' }, 'privat', A.zoeFaden),
  ] });
  // Werkstatt des Privat-Heads von person-a: Merksatz und Skill.
  await db.saveJson('agenten-skills-privat--person-a', { v: 1, mitarbeiter: [], gedaechtnis: { assistenz: [{ id: 'ms-naht-a', text: A.merksatz, am: J, von: 'person-a', quelle: 'hand' }] }, skills: [{
    id: 'sk-naht-a', headId: 'assistenz', name: 'naht-skill', beschreibung: A.skill, anleitung: A.skill, werkzeuge: [], ausloeser: { art: 'hand' },
    eingabeFelder: [], freigabePflicht: false, ergebnis: 'faden', stufe: 'schnell', tests: [], erfolg: { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 }, aktiv: true, version: 1, quelle: 'hand', angelegtVon: 'person-a',
  }] });
  await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {}, personen: { 'person-a': { heads: { assistenz: { zustaendig: A.einstellung, geaendertVon: 'person-a', geaendertAm: J } } } } });

  // Kartei: eine private Notiz von person-a an einem Kontakt.
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-naht-1', vorname: 'Nora', nachname: 'NAHT', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', privatNotiz: A.privatNotiz, privatNotizVon: 'person-a' }] });

  // Gesundheit von person-a (eigene Werte), Journal.
  const { speicherFuer } = await import('@/lib/zoe/raum');
  await db.saveJson(speicherFuer('vitals', 'person-a'), { [H]: { rec: 11, note: A.vital } });
  await db.saveJson(speicherFuer('journal', 'person-a'), { [H]: { text: A.journal } });

  // Familie: ein „nur ich“-Thema von person-a und ein Thema für den Haushalt (über die Route, wie im Betrieb).
  const familie = (await import('@/app/api/familie/route')) as unknown as { PATCH: H };
  const fa = await familie.PATCH(new Request('http://test/api/familie', { method: 'PATCH', headers: sitzung('person-a'), body: JSON.stringify({ ops: [
    { liste: 'themen', op: 'upsert', eintrag: { id: 'ft-naht-a', titel: A.familie, art: 'unklar', status: 'offen', hut: 'privat', sichtbarkeit: 'nur-ich' } },
    { liste: 'themen', op: 'upsert', eintrag: { id: 'ft-naht-h', titel: HH.familie, art: 'unklar', status: 'offen', hut: 'privat' } },
  ] }) }));
  expect(fa.status, await fa.clone().text()).toBe(200);
  // Eigenes Jahresziel von person-a (ziele-eigen, nicht geteilt).
  const ziele = (await import('@/app/api/state/ziele/route')) as unknown as { PATCH: H };
  const zr = await ziele.PATCH(new Request('http://test/api/state/ziele', { method: 'PATCH', headers: sitzung('person-a'), body: JSON.stringify({ horizont: 'jahr', fuer: 'ich', ops: [{ op: 'upsert', eintrag: { id: 'z-naht-eigen', titel: A.ziel, fortschritt: 10, space: 'privat' } }] }) }));
  expect(zr.status, await zr.clone().text()).toBe(200);
  // Eine Routine nur von person-a.
  await db.saveJson('routinen', { routinen: [{ id: 'r-naht-a', label: A.routine, wann: 'morgen', kategorie: 'gesundheit', dauerMin: 10, aktiv: true, owner: 'person-a' }], bloecke: [] });

  // Stapel: ein offener Vorschlag von person-a.
  const { lege } = await import('@/lib/zoe/stapel');
  await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: A.stapel, nachher: A.stapel, eingabe: { title: A.stapel }, anlass: A.stapel, person: 'person-a', quelle: 'gespraech' } as Parameters<typeof lege>[0]);

  // Kalender: ein privater Termin von person-a.
  await db.saveJson('calendar-cache', { at: J, quelle: 'mac', events: [
    { id: 'e-naht-privat', title: A.termin, location: A.termin, startDate: `${H}T10:00:00`, endDate: `${H}T11:00:00`, allDay: false, calendarName: 'Privat A' },
  ] });
  await db.saveJson('kalender-bezug', { bezuege: { 'e-naht-privat': { privat: true, von: 'person-a', geaendert: J, tag: H } } });

  // Haushalt: eine Buchung (Verwendungszweck) — Privates des Haushalts.
  await db.saveJson(`haushalt-buchungen--${HAUS}`, { einheiten: 2, buchungen: [{ id: 'hb-naht', stand: J, konto_id: 'hk-naht', datum: H, betrag: -1234, beschreibung: HH.buchung, empfaenger: HH.buchung, kategorie_id: null, ist_umbuchung: false, ist_fixkosten: false, turnus: 'einmalig', einheit: 'privat', zeilen_hash: null, notiz: null, import_id: null, erfasst_von: 'person-a', geaendert: J }] });
  await db.saveJson(`haushalt-stamm--${HAUS}`, { einheiten: 2, konten: [{ id: 'hk-naht', stand: J, name: 'NAHT Konto', inhaber: 'gemeinsam', einheit: 'privat', iban_suffix: null, bank: null, waehrung: 'EUR', aktiv: true }], kategorien: [], regeln: [], aliase: {} });

  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  agentenRoute = (await import('@/app/api/agenten/route')) as unknown as typeof agentenRoute;
  ki = kiFake();
});
afterAll(async () => {
  await new Promise(r => setTimeout(r, 300));
  ki?.zurueck();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});
beforeEach(async () => {
  ki.folge.length = 0; ki.anfragen.length = 0;
  (await import('@/lib/anthropic'))._guthabenSetzen(0);
  (await import('@/lib/zugang/modell-drossel')).modellDrosselZuruecksetzen();
});

/** Der Rundlauf einer Person: ZOE (JSON + Strom, alle Bereiche) und jeder sichtbare Head — gesammelt, was an das Modell ging und was zurückkam. */
async function rundlaufFuer(person: string): Promise<{ prompt: string; antworten: string; heads: string[]; gerufen: Set<string>; status: string[] }> {
  const gerufen = new Set<string>();
  const status: string[] = [];
  // Die Kostenbremse (40 Züge je 10 Minuten und Person) gilt im Betrieb — im Rundlauf vor jedem Zug zurückgesetzt, sonst liefe nichts.
  const { modellDrosselZuruecksetzen } = await import('@/lib/zugang/modell-drossel');
  const teile: string[] = [];
  const vorher = ki.anfragen.length;
  // ZOE: je Bereich ein Zug — die Werkzeug-Wahl (≤ 20) richtet sich nach der Frage.
  for (const [i, frage] of ZOE_FRAGEN.entries()) {
    const zug = new Set<string>();
    for (let n = 0; n < 12; n++) ki.folge.push(rundlauf(zug, 30));
    modellDrosselZuruecksetzen();
    const r = i % 2 ? await strom(kimmi.POST, '/api/kimmi', sitzungStrom(person), { message: frage, zoeFaden: 'neu', space: i % 3 ? 'privat' : 'business' })
      : await rufe(kimmi.POST, '/api/kimmi', sitzung(person), { message: frage, zoeFaden: 'neu', space: i % 3 ? 'privat' : 'business' });
    zug.forEach(z => gerufen.add(`zoe:${z}`));
    status.push(`zoe:${r.status}`);
    teile.push(JSON.stringify(r.d), JSON.stringify((r as { ereignisse?: unknown }).ereignisse ?? []));
    ki.folge.length = 0;
  }
  // Heads: jeder sichtbare, bis jedes angebotene Werkzeug einmal lief (12 je Zug, nacheinander).
  const g = await rufe(agentenRoute.GET, '/api/agenten?seit=2000-01-01T00:00:00.000Z', sitzung(person));
  teile.push(JSON.stringify(g.d));
  const heads = ((g.d.heads as { id: string }[] | undefined) ?? []).map(h => h.id);
  for (const [i, h] of heads.entries()) {
    const zug = new Set<string>();
    for (let runde = 0; runde < 4; runde++) {
      for (let n = 0; n < 8; n++) ki.folge.push(rundlauf(zug, 12));
      modellDrosselZuruecksetzen();
      const body = { aktion: 'senden', agent: { art: 'head', headId: h }, text: `NAHT Lage im Bereich ${h}` };
      const r = (i + runde) % 2 ? await strom(faden.POST, '/api/agenten/faden', sitzungStrom(person), body) : await rufe(faden.POST, '/api/agenten/faden', sitzung(person), body);
      teile.push(JSON.stringify(r.d), JSON.stringify((r as { ereignisse?: unknown }).ereignisse ?? []));
      status.push(`${h}:${r.status}`);
      ki.folge.length = 0;
    }
    zug.forEach(z => gerufen.add(`${h}:${z}`));
  }
  // Die Thread-Liste und „Seit deinem letzten Besuch“ nach dem Rundlauf.
  teile.push(JSON.stringify((await rufe(faden.GET, '/api/agenten/faden', sitzung(person))).d));
  const prompt = ki.anfragen.slice(vorher).map(b => JSON.stringify(b)).join('\n');
  return { prompt, antworten: teile.join('\n'), heads, gerufen, status };
}

describe('(A) Was an das Modell geht: keine Marke aus den privaten Beständen der anderen Person — ZOE, Strom, jeder Head, jedes Werkzeug', () => {
  it('Gegenprobe person-a: ihre eigenen Marken kommen in ihrem eigenen Rundlauf an (die Saat ist lesbar)', async () => {
    const r = await rundlaufFuer('person-a');
    const gefunden = funde(`${r.prompt}\n${r.antworten}`, A);
    // Was ein eigener Rundlauf sicher erreicht: Gedächtnis (ZOE-Prompt), „nur ich“-Aufgabe, Kartei-Notiz, Vault, Merksatz/Skill (Privat-Head), Threads.
    for (const n of ['fakt', 'nurIch', 'privatNotiz', 'merksatz', 'skill', 'faden', 'zoeFaden']) expect(gefunden, n).toContain(n);
    expect(r.gerufen.size).toBeGreaterThan(60);
    expect(r.status.filter(x => !x.endsWith(':200')), 'jeder Zug lief').toEqual([]);
  });

  for (const [wer, aufbau] of [
    ['person-b (volles Mitglied)', async () => {}],
    ['person-b als zweite Inhaberin', async () => {
      await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber', { haushalt: HAUS }), konto('k2', 'person-b', 'inhaber', { haushalt: HAUS }), konto('k3', 'partner', 'mitglied', { haushalt: HAUS, finanzRecht: 'business' })], einladungen: [], einstellungen: { hauptInhaber: 'person-a' } });
    }],
  ] as const) {
    it(`${wer}: kein Prompt, keine Antwort, kein Strom-Stück trägt eine private Marke von person-a`, async () => {
      const vorher = await db.loadJson('konten');
      await aufbau();
      try {
        const r = await rundlaufFuer('person-b');
        expect(r.heads).toContain('assistenz');
        expect(r.status.filter(x => !x.endsWith(':200')), 'jeder Zug lief').toEqual([]);
        expect(funde(r.prompt, A), 'Prompt').toEqual([]);
        expect(funde(r.antworten, A), 'Antworten').toEqual([]);
      } finally { await db.saveJson('konten', vorher); }
    });
  }

  it('Partner „nur Business“: weder Privates von person-a noch Privates des Haushalts — im Prompt, in Antworten, im Strom', async () => {
    const r = await rundlaufFuer('partner');
    expect(r.heads.length).toBeGreaterThan(5);
    expect(r.heads).not.toContain('assistenz');
    expect(r.status.filter(x => !x.endsWith(':200')), 'jeder Zug lief').toEqual([]);
    expect(funde(r.prompt, { ...A, ...HH }), 'Prompt').toEqual([]);
    expect(funde(r.antworten, { ...A, ...HH }), 'Antworten').toEqual([]);
  });
});

// ─── (B) Funde der Prüfung — je erst rot, dann grün ──────────────────────────────────────────────────────────────────────────

describe('(B1) anfrageId gehört der Person: eine fremde Kennung liefert nie die gemerkte Antwort einer anderen Person', () => {
  it('ZOE: person-b mit der anfrageId von person-a bekommt nicht deren Antwort (JSON und Strom)', async () => {
    const id = 'naht-zoe-anfrage-00000001';
    ki.folge.push(text('NAHT-A-EINMALIG-ANTWORT'));
    const a = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Hallo', zoeFaden: 'neu', anfrageId: id });
    expect(a.d.reply).toBe('NAHT-A-EINMALIG-ANTWORT');
    for (const mitStrom of [false, true]) {
      ki.folge.push(text('Hallo B.'));
      const b = mitStrom ? await strom(kimmi.POST, '/api/kimmi', sitzungStrom('person-b'), { message: 'Hallo', zoeFaden: 'neu', anfrageId: id })
        : await rufe(kimmi.POST, '/api/kimmi', sitzung('person-b'), { message: 'Hallo', zoeFaden: 'neu', anfrageId: id });
      expect(JSON.stringify(b.d), `Strom ${mitStrom}`).not.toContain('NAHT-A-EINMALIG-ANTWORT');
      expect(JSON.stringify(b.d)).not.toContain('fd-');
      ki.folge.length = 0;
    }
    // Die eigene Wiederholung bekommt person-a weiter (Idempotenz bleibt).
    const nochmal = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Hallo', zoeFaden: 'neu', anfrageId: id });
    expect(nochmal.d.reply).toBe('NAHT-A-EINMALIG-ANTWORT');
  });

  it('Head-Chat: person-b mit der anfrageId von person-a bekommt nicht deren Thread', async () => {
    const id = 'naht-faden-anfrage-0000001';
    ki.folge.push(text('NAHT-A-HEAD-EINMALIG'));
    const a = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'NAHT-A-FRAGE-EINMALIG', anfrageId: id });
    expect(a.status).toBe(200);
    ki.folge.push(text('Antwort für B.'));
    const b = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-b'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Frage von B', anfrageId: id });
    expect(JSON.stringify(b.d)).not.toContain('NAHT-A-HEAD-EINMALIG');
    expect(JSON.stringify(b.d)).not.toContain('NAHT-A-FRAGE-EINMALIG');
  });
});

describe('(B2) Offene Freigaben als Zahl: nur die, die die Person sieht (ZOE-Antwort, Empfang)', () => {
  it('ZOE und Empfang zählen nur eigene und System-Vorschläge — nie die der anderen Person', async () => {
    const { lies, vorschlagSichtbar } = await import('@/lib/zoe/stapel');
    const offen = await lies('offen');
    const fuerB = offen.filter(v => vorschlagSichtbar(v, 'person-b', true)).length;
    expect(offen.length).toBeGreaterThan(fuerB); // person-a hat eigene offene Vorschläge (Saat)
    ki.folge.push(text('Gern.'));
    const r = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-b'), { message: 'Hallo', zoeFaden: 'neu' });
    expect(r.d.stapelOffen).toBe(fuerB);
    // Empfang: der Satz an das Modell nennt nur die Zahl, die person-b sieht.
    const empfang = (await import('@/app/api/zoe/empfang/route')) as unknown as { GET: H };
    ki.anfragen.length = 0;
    ki.folge.push(text('Willkommen.'));
    const e = await empfang.GET(new Request('http://test/api/zoe/empfang', { headers: sitzung('person-b') }));
    expect(e.status).toBe(200);
    const system = JSON.stringify(ki.anfragen.at(-1)?.system ?? '');
    if (fuerB) expect(system).toContain(`${fuerB} Vorschläge`);
    expect(system).not.toContain(`${offen.length} Vorschläge`);
  });
});

describe('(B3) Not-Aus gilt auch für Fach-Agenten, die ZOE direkt startet (run_agent)', () => {
  it('Not-Aus gesetzt → run_agent startet keinen Fach-Agenten (kein Aufruf seiner Route), ZOE sagt es', async () => {
    const { notAusSetzen } = await import('@/lib/agenten/einstellung');
    expect((await notAusSetzen('person-a', true)).ok).toBe(true);
    const vorher = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (u: unknown, i?: RequestInit) => { urls.push(String(u)); return vorher(u as string, i); }) as typeof fetch;
    try {
      // `board` liest nur (läuft auch nach fremdem Text frei, lib/zoe/gespraech-schutz.ts AGENTEN_LESEND) — der Fall, in dem run_agent wirklich startet.
      ki.folge.push(werkzeug(['run_agent', { agent: 'board', auftrag: 'NAHT Lage' }]), text('Erledigt.'));
      const r = await rufe(kimmi.POST, '/api/kimmi', sitzung('person-a'), { message: 'Starte den Agent board für die Wochenlage', zoeFaden: 'neu' });
      expect(r.status).toBe(200);
      expect(urls.filter(u => u.includes('/api/board')), 'Fach-Agent lief trotz Not-Aus').toEqual([]);
      const ergebnis = JSON.stringify(ki.anfragen.at(-1)?.messages ?? []);
      expect(ergebnis).toMatch(/Not-Aus|Angehalten/);
    } finally {
      globalThis.fetch = vorher;
      await notAusSetzen('person-a', false);
    }
  });
});

describe('(B4) Konto löschen und Konto-Export: auch das ZOE-Gedächtnis, offene Vorschläge, Läufe der Warteschlange und gemerkte Antworten', () => {
  it('Export nennt die eigenen Einträge, Löschen entfernt sie — die der anderen Person bleiben', async () => {
    const kontenVorher = await db.loadJson<{ konten: unknown[] }>('konten');
    await db.saveJson('konten', { ...kontenVorher, konten: [...(kontenVorher?.konten ?? []), konto('k9', 'person-d', 'mitglied', { haushalt: HAUS })] });
    const { merke } = await import('@/lib/zoe/gedaechtnis');
    await merke({ art: 'sonstiges', thema: 'NAHT', satz: 'NAHT-D-FAKT', raum: 'person-d' });
    await merke({ art: 'sonstiges', thema: 'NAHT', satz: 'NAHT-A-FAKT-BLEIBT', raum: 'person-a' });
    const { lege } = await import('@/lib/zoe/stapel');
    await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'NAHT-D-STAPEL', nachher: 'NAHT-D-STAPEL', eingabe: { title: 'NAHT-D-STAPEL' }, anlass: 'NAHT-D-STAPEL', person: 'person-d', quelle: 'gespraech' } as Parameters<typeof lege>[0]);
    const { reihe } = await import('@/lib/zoe/auftraege');
    await reihe([{ art: 'agent', name: 'research', auftrag: 'NAHT-D-AUFTRAG', eingabe: {}, person: 'person-d', anlass: 'NAHT-D-AUFTRAG' }] as Parameters<typeof reihe>[0]);
    const { einmalig } = await import('@/lib/store/anfragen');
    await einmalig('zoe-zug', 'naht-d-anfrage-000000001', async () => ({ status: 200, body: { reply: 'NAHT-D-GEMERKT' } }), undefined, { wer: 'person-d' } as Parameters<typeof einmalig>[4]);

    const { kontoExport, kontoLoeschen } = await import('@/lib/datenschutz/konto-daten');
    const ex = JSON.stringify(await kontoExport('person-d'));
    for (const m of ['NAHT-D-FAKT', 'NAHT-D-STAPEL', 'NAHT-D-AUFTRAG']) expect(ex, m).toContain(m);
    expect(ex).not.toContain('NAHT-A-FAKT-BLEIBT');

    await kontoLoeschen('person-d');
    const rest = JSON.stringify([await db.loadJson('zoe-gedaechtnis'), await db.loadJson('zoe-stapel'), await db.loadJson('zoe-auftraege'), await db.loadJson('anfragen-ergebnis')]);
    for (const m of ['NAHT-D-FAKT', 'NAHT-D-STAPEL', 'NAHT-D-AUFTRAG', 'NAHT-D-GEMERKT']) expect(rest, m).not.toContain(m);
    expect(rest).toContain('NAHT-A-FAKT-BLEIBT');
    expect(rest).toContain(A.stapel);
  });
});

describe('(B5) Kosten je Zweck: ein Konto „nur Business“ sieht keine Kosten der Privat-Heads', () => {
  it('GET /api/zoe/verbrauch: Partner ohne agent-<Privat-Head>, volles Mitglied mit', async () => {
    const { notiere } = await import('@/lib/zoe/verbrauch');
    await notiere('claude-sonnet-4-5', 'agent-gesundheit', 1000, 100);
    await notiere('claude-sonnet-4-5', 'agent-familie', 1000, 100);
    await notiere('claude-sonnet-4-5', 'agent-sales', 1000, 100);
    const route = (await import('@/app/api/zoe/verbrauch/route')) as unknown as { GET: H };
    const p = await (await route.GET(new Request('http://test/api/zoe/verbrauch', { headers: sitzung('partner') }))).text();
    expect(p).toContain('agent-sales');
    expect(p).not.toContain('agent-gesundheit');
    expect(p).not.toContain('agent-familie');
    const b = await (await route.GET(new Request('http://test/api/zoe/verbrauch', { headers: sitzung('person-b') }))).text();
    expect(b).toContain('agent-gesundheit');
  });
});
