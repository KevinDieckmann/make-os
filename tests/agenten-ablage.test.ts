// ─── E3 (09.10.): Gesprächs-Ablage geteilt — Index `agenten-faeden--<person>` + je Thread `agenten-faden--<person>--<id>`, KI-Protokoll je Tag ───
// Kevin 09.10.: „Ja, jetzt“ (ANALYSE_AGENTEN_DATEN.md 5 C, E3). Wächter:
//   (1) rein: der Kopf trägt keine Nachrichten, rechnet Zähler; Teilen verliert nichts; Lesemodell (ungelesen, Frist, Kurzform) gleich für Thread und Kopf
//   (2) eine Nachricht schreibt NUR den Index und ihren Thread (gemessen an den Schreibungen der Datenschicht)
//   (3) Takt, Läufe, „Als Nächstes“, Liste lesen NUR den Index (keine Thread-Datei wird geparst); ?id lädt genau den einen Thread
//   (4) Stand/409 je Thread, 413 statt kürzen, Löschen nimmt Kopf + Datei + Kinder
//   (5) Altbestand: Lesen schreibt nicht; das erste Schreiben zieht EINMAL um (Archivkopie, ohne Verlust, idempotent)
//   (6) Morgenlauf: abgelaufene Threads samt Datei, Waisen, Köpfe ohne Datei
//   (7) Register, Rauschen, HOI, Konto-Export/-Löschen, Art. 17 (in der Sperre des Index)
//   (8) KI-Protokoll je Tag: schreiben, lesen (Tage + alte Monatsdatei), Aufbewahrung, Konto-Export
// Eigener Datenordner, erfundene Konten (`@example.invalid`), Modell = tests/fixtures/ki-fake.ts (kein Netz, kein echter KI-Aufruf).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-ablage-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-ablage', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.MAKE_OS_INTERN;
  return o;
});
vi.mock('@/lib/brain', async orig => {
  const o = await orig<typeof import('@/lib/brain')>();
  return { ...o, gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' };
});
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

import { kontenSaeen, rufe, sitzung, text, HAUS } from './fixtures/agenten-kern';
import { kiFake, type KiFake } from './fixtures/ki-fake';
import { anhaengen, fadenStand, kopfVon, kurz, teilen, ungelesen, abgelaufen, type FadenKern, type NachrichtKern } from '@/lib/agenten/faeden';

let db: typeof import('@/lib/store/local-db');
let anthropic: typeof import('@/lib/anthropic');
let A: typeof import('@/lib/agenten/faeden-ablage');
let S: typeof import('@/lib/agenten/faeden-server');
let ki: KiFake;
type Handler = (r: Request) => Promise<Response>;

const J = new Date().toISOString();
const T = (tageZurueck: number) => new Date(Date.now() - tageZurueck * 864e5).toISOString();
const nr = (id: string, rolle: NachrichtKern['rolle'], textInhalt: string, zeit = J): NachrichtKern => ({ id, rolle, von: rolle === 'person' ? 'person-a' : rolle === 'agent' ? 'head:sales' : 'system', text: textInhalt, zeit });
const faden = (id: string, besitzer = 'person-a', extra: Partial<FadenKern> = {}): FadenKern => ({
  id, besitzer, agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: `Thread ${id}`, status: 'offen', fremdGelesen: false, vertraulich: false,
  nachrichten: [nr(`nr-${id}-1`, 'person', `MARKE-INHALT ${id} Frage`), nr(`nr-${id}-2`, 'agent', `MARKE-INHALT ${id} Antwort`)], erstellt: J, aktualisiert: J, ...extra,
});
/** Messwerte der Datenschicht (lib/store/messwerte.ts) — welche Bestände geparst bzw. geschrieben wurden (nur Namen). */
const mess = () => (globalThis as unknown as { __makeosMesswerte: { parse: Map<string, unknown>; schreib?: Map<string, unknown> } }).__makeosMesswerte;
const dateien = () => readdirSync(ordner).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5));
const threadDateien = (p: string) => dateien().filter(n => n.startsWith(`agenten-faden--${p}--`)).sort();
const saeen = async (p: string, fs: FadenKern[]) => {
  const r = await S.ablageAendernFuer(p, t => { for (const f of fs) { const x = t.hinzu(f); if (x) return x; } return { e: true }; });
  expect(r.ok).toBe(true);
};
const leeren = async (p: string) => { await S.ablageAendernFuer(p, t => { t.entferne(t.index().faeden.map(k => k.id)); return { e: true }; }); };

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  anthropic = await import('@/lib/anthropic');
  A = await import('@/lib/agenten/faeden-ablage');
  S = await import('@/lib/agenten/faeden-server');
  ki = kiFake();
});
afterAll(async () => { await new Promise(r => setTimeout(r, 300)); ki.zurueck(); rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  ki.folge.length = 0; ki.anfragen.length = 0;
  anthropic._guthabenSetzen(0);
  (await import('@/lib/zugang/modell-drossel')).modellDrosselZuruecksetzen();
  await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {} });
});

// ── (1) rein ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(1) Kopf und Teilen (rein)', () => {
  it('der Kopf trägt keine Nachrichten, Bretter, Pläne, Kurzfassung — aber Zähler, letzte Nachricht, letzte Antwort, Schreibzeit', () => {
    const f: FadenKern = { ...faden('fd-rein-00001'), bretter: [{ id: 'br-1', ziel: 'z', schreiber: 'fd-x', fadenIds: [], erstellt: J, eintraege: [{ id: 'be-1', art: 'frage', text: 'Frage?', von: 'x', fadenId: 'fd-x', fremd: false, am: J, status: 'offen' }] }],
      plaene: [{ id: 'pl-1', status: 'offen', grund: 'g', auftraege: [], am: J }, { id: 'pl-2', status: 'abgelehnt', grund: 'g', auftraege: [], am: J }], kurzfassung: 'alt' };
    const k = kopfVon(f, '2026-10-09T10:00:00.000Z');
    expect(Object.keys(k)).not.toEqual(expect.arrayContaining(['nachrichten']));
    for (const feld of ['nachrichten', 'bretter', 'plaene', 'kurzfassung']) expect(feld in k, feld).toBe(false);
    expect(JSON.stringify(k)).not.toMatch(/MARKE-INHALT|Frage\?/);
    expect(k.zaehler).toEqual({ nachrichten: 2, bretter: 1, plaeneOffen: 1, fragenOffen: 1 });
    expect(k.letzte).toEqual({ id: 'nr-fd-rein-00001-2', rolle: 'agent', zeit: J });
    expect(k.letzteAntwort).toBe(J);
    expect(k.geschrieben).toBe('2026-10-09T10:00:00.000Z');
  });
  it('Lesemodell gleich für Thread und Kopf: ungelesen, Löschfrist, Kurzform', () => {
    const f = { ...faden('fd-rein-00002'), gelesenAm: T(1) };
    const k = kopfVon(f, J);
    expect(ungelesen(k)).toBe(ungelesen(f));
    expect(kurz(k, 'person-a')).toEqual(kurz(f, 'person-a'));
    const alt = { ...faden('fd-rein-00003'), nachrichten: [nr('nr-a', 'person', 'x', T(400))], aktualisiert: T(400) };
    expect(abgelaufen(kopfVon(alt, J), J)).toBe(true);
    expect(abgelaufen(alt, J)).toBe(true);
  });
  it('Teilen verliert nichts: alle Nachrichten in den Threads, Gedächtnis und ZOE-Marke im Index, Reihenfolge bleibt', () => {
    const a = faden('fd-teil-00001'), b = { ...faden('fd-teil-00002'), elternId: 'fd-teil-00001' };
    const t = teilen({ v: 1, faeden: [a, b], gedaechtnis: { 'head:sales': [{ id: 'ms-1', text: 'Merk', am: J, von: 'head:sales', quelle: 'vorschlag' }] }, zoeUebernahme: { am: J, anzahl: 0 } }, J);
    expect(t.faeden).toEqual([a, b]);
    expect(t.index.faeden.map(k => k.id)).toEqual(['fd-teil-00001', 'fd-teil-00002']);
    expect(t.index.gedaechtnis?.['head:sales']).toHaveLength(1);
    expect(t.index.zoeUebernahme).toEqual({ am: J, anzahl: 0 });
    expect(t.index.teilung).toEqual({ am: J, anzahl: 2 });
  });
});

// ── (2) eine Nachricht schreibt nur Index + Thread ───────────────────────────────────────────────────────────────────────────
describe('(2) Schreiben: nur der Index und der eine Thread', () => {
  it('Nachricht anhängen → geschrieben werden genau `agenten-faeden--<p>` und `agenten-faden--<p>--<id>`, keine andere Thread-Datei', async () => {
    const ids = [1, 2, 3, 4, 5].map(i => `fd-schreib-0000${i}`);
    await saeen('person-a', ids.map(id => faden(id)));
    const { messwerteLeeren } = await import('@/lib/store/messwerte');
    messwerteLeeren();
    const r = await S.fadenAendern('person-a', ids[2], f => { const x = anhaengen(f, [nr('nr-neu-1', 'person', 'Noch eine Frage')], new Date().toISOString()); return x.ok ? x.faden : x; });
    expect(r.ok).toBe(true);
    const geschrieben = Array.from(mess().schreib?.keys() ?? []).filter(n => n.startsWith('agenten-'));
    expect(geschrieben.sort()).toEqual([`agenten-faden--person-a--${ids[2]}`, 'agenten-faeden--person-a'].sort());
    // Der Index bleibt klein: nur Köpfe, kein Nachrichtentext.
    const idx = await db.loadJson<{ v: number; faeden: Record<string, unknown>[] }>('agenten-faeden--person-a');
    expect(idx?.v).toBe(2);
    expect(JSON.stringify(idx)).not.toMatch(/MARKE-INHALT|Noch eine Frage/);
    expect(idx!.faeden.find(k => k.id === ids[2])).toMatchObject({ zaehler: { nachrichten: 3 } });
    const datei = await db.loadJson<{ faden: FadenKern }>(`agenten-faden--person-a--${ids[2]}`);
    expect(datei!.faden.nachrichten.map(n => n.text)).toContain('Noch eine Frage');
    await leeren('person-a');
  });
  it('Head-Chat über die Route: ein neuer Thread = Index + eine Datei; der Index trägt keinen Text der Unterhaltung', async () => {
    ki.folge.push(text('MARKE-ANTWORT Die Pipeline ist ruhig.'));
    const route = (await import('@/app/api/agenten/faden/route')) as unknown as { POST: Handler };
    const r = await rufe(route.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'MARKE-FRAGE Wie steht die Pipeline?' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const id = String((r.d.faden as { id: string }).id);
    expect(threadDateien('person-a')).toEqual([`agenten-faden--person-a--${id}`]);
    // Im Index steht vom Gespräch nur der Titel (aus der ersten Frage) — keine Nachricht, keine Antwort.
    const idx = await db.loadJson<{ faeden: { titel: string }[] }>('agenten-faeden--person-a');
    expect(JSON.stringify(idx)).not.toMatch(/MARKE-ANTWORT/);
    expect(JSON.stringify({ ...idx, faeden: idx!.faeden.map(({ titel: _t, ...k }) => k) })).not.toMatch(/MARKE-FRAGE/);
    expect(JSON.stringify(await db.loadJson(`agenten-faden--person-a--${id}`))).toMatch(/MARKE-FRAGE[\s\S]*MARKE-ANTWORT/);
    await leeren('person-a');
  });
});

// ── (3) Leser des Takts und der Listen ───────────────────────────────────────────────────────────────────────────────────────
describe('(3) Takt, Läufe, „Als Nächstes“, Liste lesen NUR den Index', () => {
  it('keine Thread-Datei wird geparst — `?id=` lädt genau den einen Thread', async () => {
    const ids = [1, 2, 3].map(i => `fd-lesen-0000${i}`);
    await saeen('person-a', ids.map((id, i) => faden(id, 'person-a', i === 0 ? { status: 'wartet', lauf: { status: 'wartet', schritte: [], start: J, kostenCent: 0, wartetAuf: 'business-frei' } } : {})));
    const { messwerteLeeren } = await import('@/lib/store/messwerte');
    messwerteLeeren();
    const geparst = () => Array.from(mess().parse.keys()).filter(n => n.startsWith('agenten-faden--'));
    await (await import('@/lib/agenten/zeitplan')).zeitplaeneFaellig();
    await (await import('@/lib/agenten/laeufe')).laeufeLesen('person-a');
    await (await import('@/lib/agenten/naechstes')).naechstesLesen('person-a');
    await S.bestandLesen('person-a');
    await S.sichtbareFaeden(await S.sichtLaden('person-a'));
    const route = (await import('@/app/api/agenten/faden/route')) as unknown as { GET: Handler };
    const liste = await rufe(route.GET, '/api/agenten/faden', sitzung('person-a'));
    expect((liste.d.faeden as { id: string }[]).map(f => f.id).sort()).toEqual([...ids].sort());
    expect(geparst()).toEqual([]);
    const einer = await rufe(route.GET, `/api/agenten/faden?id=${ids[1]}`, sitzung('person-a'));
    expect((einer.d.faden as FadenKern).nachrichten).toHaveLength(2);
    expect(geparst()).toEqual([`agenten-faden--person-a--${ids[1]}`]);
    await leeren('person-a');
  });
});

// ── (4) Stand, Grenzen, Löschen ──────────────────────────────────────────────────────────────────────────────────────────────
describe('(4) Stand/409 je Thread, 413, Löschen samt Kindern und Dateien', () => {
  it('veralteter Stand → 409 mit dem aktuellen Thread; nichts geschrieben', async () => {
    await saeen('person-a', [faden('fd-stand-00001')]);
    const f = (await S.eigenerFaden('person-a', 'fd-stand-00001'))!;
    const stand = fadenStand(f);
    expect((await S.fadenAendern('person-a', f.id, x => ({ ...x, titel: 'Neu' }), { stand })).ok).toBe(true);
    const r = await S.fadenAendern('person-a', f.id, x => ({ ...x, titel: 'Noch neuer' }), { stand });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect((r as { aktuell?: FadenKern }).aktuell?.titel).toBe('Neu');
    expect((await S.eigenerFaden('person-a', f.id))!.titel).toBe('Neu');
    await leeren('person-a');
  });
  it('voller Thread → 413 (nichts gekürzt); Thread schon da → 409', async () => {
    const { GRENZEN } = await import('@/lib/agenten/typen');
    const voll = { ...faden('fd-voll-000001'), nachrichten: Array.from({ length: GRENZEN.fadenNachrichten }, (_, i) => nr(`nr-v-${i}`, 'person', `n${i}`)) };
    await saeen('person-a', [voll]);
    const r = await S.fadenAendern('person-a', voll.id, x => { const y = anhaengen(x, [nr('nr-zu-viel', 'person', 'x')], J); return y.ok ? y.faden : y; });
    expect(r).toMatchObject({ ok: false, status: 413 });
    expect((await S.eigenerFaden('person-a', voll.id))!.nachrichten).toHaveLength(GRENZEN.fadenNachrichten);
    expect(await S.fadenAnlegen('person-a', voll)).toMatchObject({ ok: false, status: 409 });
    await leeren('person-a');
  });
  it('Löschen über die Route: Kopf, Datei und alle Threads darunter (Kopf ohne Datei bleibt nie stehen)', async () => {
    await saeen('person-a', [faden('fd-weg-000001'), { ...faden('fd-weg-000002'), elternId: 'fd-weg-000001' }, { ...faden('fd-weg-000003'), elternId: 'fd-weg-000002' }, faden('fd-bleibt-0001')]);
    const f = (await S.eigenerFaden('person-a', 'fd-weg-000001'))!;
    const route = (await import('@/app/api/agenten/faden/route')) as unknown as { POST: Handler };
    const r = await rufe(route.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'loeschen', fadenId: f.id, stand: fadenStand(f) });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    expect((await S.bestandLesen('person-a')).faeden.map(k => k.id)).toEqual(['fd-bleibt-0001']);
    expect(threadDateien('person-a')).toEqual(['agenten-faden--person-a--fd-bleibt-0001']);
    await leeren('person-a');
    expect(threadDateien('person-a')).toEqual([]);
  });
});

// ── (5) Altbestand ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(5) Altbestand (eine Datei mit allen Threads): Lesen schreibt nicht, das erste Schreiben zieht EINMAL um', () => {
  it('ohne Verlust, mit Archivkopie, idempotent', async () => {
    const a = faden('fd-alt-0000001', 'person-b'), b = { ...faden('fd-alt-0000002', 'person-b'), elternId: 'fd-alt-0000001', bretter: [{ id: 'br-a', ziel: 'z', schreiber: 'fd-alt-0000002', fadenIds: ['fd-alt-0000002'], erstellt: J, eintraege: [] }] };
    const merk = { 'head:sales': [{ id: 'ms-alt-1', text: 'Kurz und knapp', am: J, von: 'head:sales', quelle: 'vorschlag' as const }] };
    await db.saveJson('agenten-faeden--person-b', { v: 1, faeden: [a, b], gedaechtnis: merk, zoeUebernahme: { am: J, anzahl: 0 } });
    const stat = () => db.speicherStand(['agenten-faeden--person-b']);
    const vorher = await stat();
    // Lesen versteht den Altbestand — ohne zu schreiben.
    expect((await S.bestandLesen('person-b')).faeden.map(k => k.id)).toEqual(['fd-alt-0000001', 'fd-alt-0000002']);
    expect((await S.eigenerFaden('person-b', 'fd-alt-0000002'))!.bretter).toHaveLength(1);
    expect(await stat()).toBe(vorher);
    expect(threadDateien('person-b')).toEqual([]);
    // Das erste Schreiben zieht um.
    expect((await S.fadenAendern('person-b', 'fd-alt-0000001', f => ({ ...f, gelesenAm: J }))).ok).toBe(true);
    const idx = await db.loadJson<{ v: number; faeden: { id: string }[]; gedaechtnis?: unknown; zoeUebernahme?: unknown; teilung?: { anzahl: number } }>('agenten-faeden--person-b');
    expect(idx).toMatchObject({ v: 2, gedaechtnis: merk, zoeUebernahme: { am: J, anzahl: 0 }, teilung: { anzahl: 2 } });
    expect(threadDateien('person-b')).toEqual(['agenten-faden--person-b--fd-alt-0000001', 'agenten-faden--person-b--fd-alt-0000002']);
    const ganz = await A.alleFaedenLesen('person-b');
    expect(ganz.map(f => f.nachrichten.map(n => n.text))).toEqual([a.nachrichten.map(n => n.text), b.nachrichten.map(n => n.text)]);
    expect(ganz[1].bretter).toEqual(b.bretter);
    const kopien = readdirSync(path.join(ordner, 'archiv')).filter(d => d.startsWith('agenten-vor-teilung-person-b-'));
    expect(kopien).toHaveLength(1);
    const { istUmzugsKopie } = await import('@/lib/crm/loeschfristen');
    expect(istUmzugsKopie(kopien[0])).toBe(true);
    // Idempotent: noch einmal → nichts zu tun, keine zweite Kopie.
    expect(await A.ablageUmziehen('person-b')).toBeNull();
    expect(readdirSync(path.join(ordner, 'archiv')).filter(d => d.startsWith('agenten-vor-teilung-person-b-'))).toHaveLength(1);
    await leeren('person-b');
  });
  it('wird ein Index als Altbestand zurückgeschrieben (Köpfe ohne Nachrichten), behalten die Threads ihre Nachrichten', async () => {
    await saeen('person-b', [faden('fd-zurueck-0001', 'person-b')]);
    const idx = await db.loadJson<{ faeden: Record<string, unknown>[] }>('agenten-faeden--person-b');
    await db.saveJson('agenten-faeden--person-b', { v: 1, faeden: [...idx!.faeden.map(k => ({ ...k, titel: 'Umbenannt' })), faden('fd-zurueck-0002', 'person-b')] });
    expect((await S.fadenAendern('person-b', 'fd-zurueck-0002', f => ({ ...f, gelesenAm: J }))).ok).toBe(true);
    const ganz = await A.alleFaedenLesen('person-b');
    expect(ganz.find(f => f.id === 'fd-zurueck-0001')).toMatchObject({ titel: 'Umbenannt' });
    expect(ganz.find(f => f.id === 'fd-zurueck-0001')!.nachrichten).toHaveLength(2);
    await leeren('person-b');
  });
});

// ── (6) Morgenlauf ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(6) Löschfristen-Lauf über den Index', () => {
  it('abgelaufene Threads samt Datei; Waise (Datei ohne Kopf) und Kopf ohne Datei werden aufgeräumt; zweiter Lauf schreibt nichts', async () => {
    const alt = { ...faden('fd-frist-alt01', 'team-c'), nachrichten: [nr('nr-f1', 'person', 'alt', T(400))], aktualisiert: T(400), erstellt: T(400) };
    await saeen('team-c', [alt, faden('fd-frist-neu01', 'team-c'), faden('fd-frist-ohne1', 'team-c')]);
    await db.saveJson('agenten-faden--team-c--fd-frist-waise', { v: 1, faden: faden('fd-frist-waise', 'team-c') });
    rmSync(path.join(ordner, 'agenten-faden--team-c--fd-frist-ohne1.json'));
    const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
    const r = await loeschfristenLauf(new Date(), true);
    expect(r.bereinigt['agenten-faeden']).toBe(1);
    expect(r.bereinigt['agenten-faeden (Waisen)']).toBe(2);
    expect((await S.bestandLesen('team-c')).faeden.map(k => k.id)).toEqual(['fd-frist-neu01']);
    expect(threadDateien('team-c')).toEqual(['agenten-faden--team-c--fd-frist-neu01']);
    const vorher = await db.speicherStand(['agenten-faeden--team-c']);
    const r2 = await loeschfristenLauf(new Date(), true);
    expect(r2.bereinigt['agenten-faeden']).toBeUndefined();
    expect(r2.bereinigt['agenten-faeden (Waisen)']).toBeUndefined();
    expect(await db.speicherStand(['agenten-faeden--team-c'])).toBe(vorher);
    await leeren('team-c');
  });
});

// ── (7) Register, Rauschen, HOI, Konto, Art. 17 ──────────────────────────────────────────────────────────────────────────────
describe('(7) Register, Rauschen, HOI, Konto-Export/-Löschen, Art. 17', () => {
  it('Register mit Angaben und Frist; Rauschen; HOI zählt Thread-Dateien und Tages-Protokolle', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    const { fadenDateiBestand } = await import('@/lib/agenten/typen');
    const name = fadenDateiBestand('person-a', 'fd-register-001');
    const e = registerEintrag(name);
    expect(e?.muster).toBe('agenten-faden--*');
    expect(e).toMatchObject({ behandlung: 'tilgen', frist: 'zoe-verlauf' });
    expect(e?.rechtsgrundlage).toMatch(/Art\. 6/);
    expect(registerEintrag('ki-protokoll--2026-10-09')?.muster).toBe('ki-protokoll--*');
    const { istRauschen } = await import('@/lib/store/memo');
    expect(istRauschen(name)).toBe(true);
    expect(istRauschen('ki-protokoll--2026-10-09')).toBe(true);
    const { AGENTEN_BESTAND } = await import('@/lib/hoi/lage');
    expect(AGENTEN_BESTAND.test(name)).toBe(true);
    expect(AGENTEN_BESTAND.test('ki-protokoll--2026-10-09')).toBe(true);
    const { weitererSpeicher } = await import('@/lib/crm/person-weitere');
    const w = weitererSpeicher(name);
    expect(w).toMatchObject({ name: 'agenten-faden--*', behandlung: 'tilgen' });
    expect(w?.aussen?.(name)).toBe('agenten-faeden--person-a');
  });
  it('Art. 17: der Name einer Person im Thread wird getilgt — in der Sperre des Index, der Thread bleibt', async () => {
    await saeen('person-a', [{ ...faden('fd-art17-00001'), nachrichten: [nr('nr-17', 'person', 'Bitte Erika Musterfrau anrufen.')] }]);
    const { weitereEntfernen } = await import('@/lib/crm/person-weitere');
    const r = await weitereEntfernen({ id: 'c-00000000-0000-4000-8000-000000000017', name: 'Erika Musterfrau', emails: [], fingerabdruecke: [] });
    expect(r.speicher['agenten-faden--person-a--fd-art17-00001']).toBeGreaterThan(0);
    const f = (await S.eigenerFaden('person-a', 'fd-art17-00001'))!;
    expect(f.nachrichten[0].text).not.toMatch(/Erika Musterfrau/);
    await leeren('person-a');
  });
  it('Konto: Export enthält jeden Thread und den Index; Löschen entfernt alle Thread-Dateien und die Archivkopie', async () => {
    await saeen('person-b', [faden('fd-konto-00001', 'person-b'), faden('fd-konto-00002', 'person-b')]);
    writeFileSync(path.join(ordner, 'archiv', 'agenten-vor-teilung-person-b-2026-10-09T08-00-00-000Z.json'), '{}');
    const kd = await import('@/lib/datenschutz/konto-daten');
    const namen = kd.personBestandNamen('person-b', dateien()).map(b => b.name);
    expect(namen).toEqual(expect.arrayContaining(['agenten-faeden--person-b', 'agenten-faden--person-b--fd-konto-00001', 'agenten-faden--person-b--fd-konto-00002']));
    expect(kd.personBestandNamen('person-a', dateien()).some(b => b.name.includes('person-b'))).toBe(false);
    const ex = await kd.kontoExport('person-b');
    expect((ex!.bestaende['agenten-faden--person-b--fd-konto-00001'] as { faden: FadenKern }).faden.nachrichten).toHaveLength(2);
    const { teilungsKopienEntfernen } = A;
    expect(await teilungsKopienEntfernen('person-b')).toBeGreaterThanOrEqual(1);
    expect(readdirSync(path.join(ordner, 'archiv')).filter(d => d.startsWith('agenten-vor-teilung-person-b-'))).toEqual([]);
    for (const b of kd.personBestandNamen('person-b', dateien()).filter(x => x.name.startsWith('agenten-fa'))) await db.bestandEntfernen(b.name, { tageskopien: true });
    expect(threadDateien('person-b')).toEqual([]);
  });
});

// ── (8) KI-Protokoll je Tag ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('(8) KI-Protokoll je Tag', () => {
  it('ein Aufruf schreibt nur die Tagesdatei; gelesen werden Tage und die alte Monatsdatei; Aufbewahrung entfernt alte Tage, leert alte Monate', async () => {
    const P = await import('@/lib/datenschutz/ki-protokoll');
    const { messwerteLeeren } = await import('@/lib/store/messwerte');
    const jetzt = new Date();
    const tag = P.tagVon(jetzt), monat = P.monatVon(jetzt);
    // Altbestand: Monatsdatei des laufenden Monats (wird weiter gelesen).
    await db.saveJson(P.protokollMonatName(monat), { eintraege: [P.eintragSaeubern({ zweck: 'alt-monat', lauf: 'aufruf', person: 'person-a', kategorien: ['allgemein'], modell: 'm', ergebnis: 'ok', at: jetzt.toISOString() })] });
    messwerteLeeren();
    await P.kiProtokollieren({ zweck: 'neu-tag', lauf: 'gespraech', person: 'person-a', kategorien: ['crm'], modell: 'm', ergebnis: 'ok' });
    const geschrieben = Array.from(mess().schreib?.keys() ?? []).filter(n => n.startsWith('ki-protokoll--'));
    expect(geschrieben).toEqual([P.protokollTagName(tag)]);
    const zeilen = await P.kiProtokollLesen({ person: 'person-a', monate: 1 });
    expect(zeilen.map(z => z.zweck)).toEqual(expect.arrayContaining(['alt-monat', 'neu-tag']));
    expect(zeilen.every(z => z.person === 'person-a')).toBe(true);
    expect((await P.kiProtokollLesen({ person: 'person-b', monate: 1 })).some(z => z.zweck === 'neu-tag')).toBe(false);
    expect((await P.kiEmpfaengerFuerKontakte()).kategorien.find(k => k.kategorie === 'crm')?.aufrufe).toBeGreaterThanOrEqual(1);
    // Konto-Export: die eigenen Zeilen der Tagesdatei.
    const ex = await (await import('@/lib/datenschutz/konto-daten')).kontoExport('person-a');
    expect((ex!.protokolle[P.protokollTagName(tag)] as { zweck: string }[]).map(z => z.zweck)).toContain('neu-tag');
    // Aufbewahrung: ein Tag vor 14 Monaten geht ganz, ein alter Monat wird geleert (Marke), der laufende Tag bleibt.
    const alt = new Date(jetzt.getTime() - 425 * 864e5);
    const altTag = P.tagVon(alt), altMonat = P.monatVon(alt);
    await db.saveJson(P.protokollTagName(altTag), { eintraege: [{ at: alt.toISOString(), zweck: 'uralt', lauf: 'aufruf', person: 'person-a', kategorien: ['allgemein'], modell: 'm', ergebnis: 'ok' }] });
    await db.saveJson(P.protokollMonatName(altMonat), { eintraege: [{ at: alt.toISOString(), zweck: 'uralt-monat', lauf: 'aufruf', person: 'person-a', kategorien: ['allgemein'], modell: 'm', ergebnis: 'ok' }] });
    const morgen = new Date(jetzt.getTime() + 864e5);
    expect(await P.kiProtokollBereinigen(morgen)).toBe(2);
    expect(existsSync(path.join(ordner, `${P.protokollTagName(altTag)}.json`))).toBe(false);
    expect(await db.loadJson(P.protokollMonatName(altMonat))).toMatchObject({ eintraege: [], bereinigt: { eintraege: 1 } });
    expect(existsSync(path.join(ordner, `${P.protokollTagName(tag)}.json`))).toBe(true);
  });
});
