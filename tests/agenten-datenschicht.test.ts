// ─── Agenten-Datenschicht (09.10.): zwei Welten angeglichen, Fristen, nie kürzen — je Fund ein Wächter (erst rot, dann grün) ─────────
// Funde der Datenschicht-Analyse unter dem Agenten-System (alter Heads-Takt ↔ neuer Agenten-Bereich):
//   (1) RAUSCHEN: Modellaufrufe und Lauf-Schritte machen gemerkte Indizes nicht ungültig; der tote Eintrag `verbrauch` ist weg
//   (2) D1 Not-Aus/„Head aus“/Budget gelten für den Hand-Lauf eines Heads (und des Head of Finance) — vorher nur `agents-config`
//   (3) D2 Autonomie: der alte Heads-Lauf übernimmt nichts selbst, wenn die Einstellung des Agenten-Bereichs „vorschlag“ sagt
//   (4) U1 „Rückgängig“ eines Heads legt die Aufgabe in den Papierkorb (samt Unteraufgaben) statt sie hart zu löschen
//   (5) D7 Skill-Erfolgsquote zählt angenommen/abgelehnt aus dem Stapel
//   (6) D8 Löschfrist der Threads aus der EINEN Fristen-Tabelle + Schritt im Löschfristen-Lauf
//   (7) Chat-Züge/Thread-Läufe schreiben nicht mehr in den Ring `agent-log`
//   (8) nie kürzen: ZOE-Gedächtnis (ablehnen statt aktive Fakten wegschneiden), Head of Finance (offene nie weg)
//   (9) `zoe-empfang`: der Gruß der anderen Person bleibt stehen
//  (10) Stapel: gleiche Wirkung zweier Personen = zwei Vorschläge
//  (11) HOI-Befund für große/langsame Agenten-Bestände
// Echte Routen und Bestände in einem eigenen Datenordner; Modell = tests/fixtures/ki-fake.ts (kein Netz). Erfundene Konten (`@example.invalid`).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-datenschicht-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-datenschicht', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.MAKE_OS_KI_USD_EUR;
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
import type { FadenKern } from '@/lib/agenten/faeden';

type H = (r: Request, p?: { params: Promise<{ head: string }> }) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let anthropic: typeof import('@/lib/anthropic');
let ki: KiFake;
const wurzel = process.cwd();
const quelle = (datei: string) => readFileSync(path.join(wurzel, datei), 'utf8');
const T = (tageZurueck: number) => new Date(Date.now() - tageZurueck * 864e5).toISOString();

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  anthropic = await import('@/lib/anthropic');
  ki = kiFake();
});
afterAll(async () => { await new Promise(r => setTimeout(r, 300)); ki.zurueck(); rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  ki.folge.length = 0; ki.anfragen.length = 0;
  anthropic._guthabenSetzen(0);
  (await import('@/lib/zugang/modell-drossel')).modellDrosselZuruecksetzen();
  await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {} });
});

const headRoute = async () => (await import('@/app/api/heads/[head]/route')) as unknown as { POST: H };
const headPost = async (person: string, head: string, body: Record<string, unknown>) => {
  const r = await (await headRoute()).POST(new Request(`http://test/api/heads/${head}`, { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }), { params: Promise.resolve({ head }) });
  return { status: r.status, d: (await r.json()) as Record<string, unknown> };
};

// ── (1) RAUSCHEN ────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(1) RAUSCHEN: Agenten-Bestände machen gemerkte Indizes nicht ungültig', () => {
  it('Modellaufruf (ki-verbrauch, ki-protokoll), Threads, Werkstatt, Pläne, Einstellungen, Heads, Replay, Finanzchef, Empfang sind Rauschen — `verbrauch` nicht mehr', async () => {
    const { istRauschen } = await import('@/lib/store/memo');
    for (const n of ['ki-verbrauch', 'ki-protokoll--2026-10', 'agenten-faeden--person-a', 'agenten-skills--haus-a', 'agenten-skills-privat--person-a', 'agenten-plan--person-a',
      'agenten-einstellung--haus-a', 'head-sales', 'head-marketing', 'head-event', 'heads-replay-sales', 'zoe-auftraege', 'agent-log', 'finanzchef', 'haushalt-chef--haus-a', 'zoe-empfang']) {
      expect(istRauschen(n), n).toBe(true);
    }
    expect(istRauschen('verbrauch')).toBe(false); // gibt es nicht mehr
    for (const n of ['kontakte', 'crm', 'tasks', 'finanzchef-einstellung', 'agents-config', 'ziele']) expect(istRauschen(n), n).toBe(false);
  });
  it('ein Modellaufruf (Kosten + KI-Protokoll) und ein Thread-Schreiben lassen das Gemerkte stehen; eine Kartei-Schreibung nicht', async () => {
    const memo = await import('@/lib/store/memo');
    const alt = process.env.MAKE_OS_MEMO;
    process.env.MAKE_OS_MEMO = 'an';
    try {
      memo.memoLeeren();
      let n = 0;
      const rechne = async () => ++n;
      expect(await memo.merken('index-x', 60_000, rechne)).toBe(1);
      await db.saveJson('ki-verbrauch', { tage: [{ tag: '2026-10-09', posten: [{ zweck: 'test', cent: 1 }] }] });
      await db.saveJson('ki-protokoll--2026-10', { eintraege: [{ zeit: T(0), zweck: 'test' }] });
      await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [] });
      await db.saveJson('head-sales', { berichte: [], vorschlaege: [], letzte: {}, versuche: {} });
      expect(await memo.merken('index-x', 60_000, rechne)).toBe(1);
      await db.saveJson('kontakte', { kontakte: [] });
      expect(await memo.merken('index-x', 60_000, rechne)).toBe(2);
    } finally { if (alt === undefined) delete process.env.MAKE_OS_MEMO; else process.env.MAKE_OS_MEMO = alt; memo.memoLeeren(); }
  });
  it('die Traktion trägt den Stand der Head-Bestände im Memo-Schlüssel (eine Entscheidung zeigt sich sofort)', () => {
    expect(quelle('app/api/crm/traktion/route.ts')).toMatch(/speicherStand\(HEADS\.map\(h => standName\(h\)\)\)[\s\S]{0,200}merken\(`traktion:\$\{ich\}:\$\{localDay\(\)\}:\$\{headStand\}`/);
  });
});

// ── (2) D1 Not-Aus beim Hand-Lauf ────────────────────────────────────────────────────────────────────────────────────────────
describe('(2) D1: Not-Aus, „Head aus“ und Budget gelten für den Hand-Lauf eines Heads', () => {
  it('Not-Aus für alle → POST /api/heads/sales {aktion: lauf} 409, kein Modellaufruf, kein Bericht', async () => {
    await db.saveJson('head-sales', { berichte: [], vorschlaege: [], letzte: {}, versuche: {} });
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {}, notAus: { seit: T(0), von: 'person-a' } });
    const r = await headPost('person-a', 'sales', { aktion: 'lauf', modus: 'frage', frage: 'Wie steht es?' });
    expect(r.status, JSON.stringify(r.d)).toBe(409);
    expect(r.d).toMatchObject({ ok: false, gesperrt: 'not-aus' });
    expect(ki.anzahl).toBe(0);
    expect(((await db.loadJson<{ berichte: unknown[] }>('head-sales'))?.berichte ?? []).length).toBe(0);
  });
  it('Head aus (Einstellung des Agenten-Bereichs) → 409 „ausgeschaltet“', async () => {
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: { marketing: { aktiv: false } } });
    const r = await headPost('person-a', 'marketing', { aktion: 'lauf', modus: 'frage', frage: 'Was steht an?' });
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ gesperrt: 'aus' });
    expect(ki.anzahl).toBe(0);
  });
  it('Budget des Heads erreicht (0 €) → 409 „budget“', async () => {
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: { event: { budgetCentMonat: 0 } } });
    const r = await headPost('person-a', 'event', { aktion: 'lauf', modus: 'frage', frage: 'Was steht an?' });
    expect(r.status).toBe(409);
    expect(r.d).toMatchObject({ gesperrt: 'budget' });
  });
  it('Head of Finance: Not-Aus für den Head „finanzen“ → POST /api/finanzchef {aktion: lauf} 409, kein Modellaufruf', async () => {
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: { finanzen: { notAus: { seit: T(0), von: 'person-a' } } } });
    const route = (await import('@/app/api/finanzchef/route')) as unknown as { POST: H };
    const r = await route.POST(new Request('http://test/api/finanzchef', { method: 'POST', headers: sitzung('person-a'), body: JSON.stringify({ aktion: 'lauf', modus: 'frage', frage: 'Wie stehen wir?' }) }));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ok: false, gesperrt: 'not-aus' });
    expect(ki.anzahl).toBe(0);
  });
});

// ── (3) D2 Autonomie aus der Einstellung ─────────────────────────────────────────────────────────────────────────────────────
describe('(3) D2: die strengere Autonomie gilt auch im alten Heads-Lauf', () => {
  const antwort = (titel: string, schluessel: string) => text(JSON.stringify({
    status: 'beobachten', zusammenfassung: 'Die Kartei hat Lücken.', antwort: '', befunde: [], fragen: [], datenluecken: [], verworfen: [],
    vorschlaege: [{ art: 'daten_pflegen', titel, begruendung: 'Angaben fehlen in der Kartei.', prioritaet: 'niedrig', dedup_schluessel: schluessel, quelle: [] }],
  }));
  it('ohne Einstellung übernimmt der Head die interne Kleinigkeit selbst; mit Einstellung „vorschlag“ bleibt sie zur Freigabe', async () => {
    const { headLauf } = await import('@/lib/heads/lauf');
    await db.saveJson('head-sales', { berichte: [], vorschlaege: [], letzte: {}, versuche: {} });
    await db.saveJson('kontakte', { kontakte: [] });
    ki.folge.push(antwort('Kartei-Lücken schließen A', 'kartei-a'));
    const r1 = await headLauf({ head: 'sales', modus: 'wochenreview', person: 'person-a', ausgeloest: 'hand' });
    expect(r1.ok, JSON.stringify(r1)).toBe(true);
    const v1 = (await db.loadJson<{ vorschlaege: { titel: string; status: string; auto?: unknown }[] }>('head-sales'))!.vorschlaege.find(v => v.titel === 'Kartei-Lücken schließen A')!;
    expect(v1).toMatchObject({ status: 'angenommen' });
    expect(v1.auto).toBeTruthy();
    // Einstellung des Agenten-Bereichs: „nur Vorschläge“ (per Klick oder automatisch zurückgestuft).
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: { sales: { autonomie: 'vorschlag', autonomieVon: 'person-a', autonomieGrund: 'hand' } } });
    ki.folge.push(antwort('Telefonnummern der Firmenliste ergänzen', 'telefon-b'));
    const r2 = await headLauf({ head: 'sales', modus: 'wochenreview', person: 'person-a', ausgeloest: 'hand' });
    expect(r2.ok).toBe(true);
    expect(r2.auto ?? 0).toBe(0);
    const v2 = (await db.loadJson<{ vorschlaege: { titel: string; status: string; auto?: unknown }[] }>('head-sales'))!.vorschlaege.find(v => v.titel === 'Telefonnummern der Firmenliste ergänzen')!;
    expect(v2).toMatchObject({ status: 'offen' });
    expect(v2.auto).toBeUndefined();
  });
  it('autonomieWirksam: Boden „intern“, Einstellung „vorschlag“ verschärft, schlechte Quote stuft sofort zurück', async () => {
    const { autonomieWirksam } = await import('@/lib/agenten/leistung');
    await db.saveJson('head-sales', { berichte: [], vorschlaege: [], letzte: {}, versuche: {} });
    expect(await autonomieWirksam('sales')).toBe('intern');
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: { sales: { autonomie: 'vorschlag' } } });
    expect(await autonomieWirksam('sales')).toBe('vorschlag');
    await db.saveJson(`agenten-einstellung--${HAUS}`, { v: 1, heads: {} });
    const abgelehnt = Array.from({ length: 10 }, (_, i) => ({ id: `hv-${i}`, status: 'abgelehnt', entschieden: T(1), aktualisiert: T(1), titel: `x${i}` }));
    await db.saveJson('head-sales', { berichte: [], vorschlaege: abgelehnt, letzte: {}, versuche: {} });
    expect(await autonomieWirksam('sales')).toBe('vorschlag');
  });
});

// ── (4) U1 Rücknahme über den Papierkorb ─────────────────────────────────────────────────────────────────────────────────────
describe('(4) U1: „Rückgängig“ legt die selbst angelegte Aufgabe in den Papierkorb — samt Unteraufgabe, nie hart gelöscht', () => {
  it('Aufgabe und Unteraufgabe stehen danach mit `geloeschtAm` im Bestand; der Vorschlag gilt als abgelehnt', async () => {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const jetzt = new Date().toISOString();
    await systemAufgabenAendern(() => ({ neu: [{ id: 'hd-hv-r1', title: 'Selbst angelegt', status: 'todo', priority: 'medium', assignee: 'person-a', tags: ['head-sales'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt }] }), { jetzt });
    await systemAufgabenAendern(() => ({ neu: [{ id: 'hd-hv-r1-u', parentId: 'hd-hv-r1', title: 'Teil davon', status: 'todo', priority: 'medium', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt }] }), { jetzt });
    await db.saveJson('head-sales', { berichte: [], letzte: {}, versuche: {}, vorschlaege: [
      { id: 'hv-r1', art: 'daten_pflegen', titel: 'Selbst angelegt', begruendung: 'x', kontakt_id: null, chance_id: null, mandat_id: null, event_id: null, frist: null, prioritaet: 'mittel', dedup_schluessel: 'r1', quelle: [], entwurf: null,
        status: 'angenommen', erstellt: jetzt, aktualisiert: jetzt, berichtId: 'hb-1', von: 'auto', auto: { am: jetzt, wirkung: 'Aufgabe für Person-a', rueckgaengig: { art: 'aufgabe', aufgabeId: 'hd-hv-r1' } } },
    ] });
    const r = await headPost('person-a', 'sales', { aktion: 'rueckgaengig', id: 'hv-r1' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const tasks = (await db.loadJson<{ tasks: { id: string; geloeschtAm?: string; geloeschtMit?: string }[] }>('tasks'))!.tasks;
    const haupt = tasks.find(t => t.id === 'hd-hv-r1');
    const unter = tasks.find(t => t.id === 'hd-hv-r1-u');
    expect(haupt?.geloeschtAm).toBeTruthy();
    expect(unter?.geloeschtAm).toBeTruthy();
    expect(unter?.geloeschtMit).toBe('hd-hv-r1');
    expect((await db.loadJson<{ vorschlaege: { id: string; status: string }[] }>('head-sales'))!.vorschlaege[0].status).toBe('abgelehnt');
    // Die Route liest `tasks` nie mehr roh und filtert nicht mehr hart.
    expect(quelle('app/api/heads/[head]/route.ts')).not.toMatch(/updateJson<[^>]*>\('tasks'/);
    expect(quelle('app/api/heads/[head]/route.ts')).not.toMatch(/loadJson<[^>]*>\('tasks'\)/);
  });
  it('inzwischen von Hand bearbeitet → 409, die Aufgabe bleibt unverändert', async () => {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const jetzt = new Date(Date.now() - 60_000).toISOString();
    await systemAufgabenAendern(() => ({ neu: [{ id: 'hd-hv-r2', title: 'Bearbeitet', status: 'todo', priority: 'medium', assignee: 'person-a', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt }] }), { jetzt });
    await systemAufgabenAendern(() => ({ teile: [{ id: 'hd-hv-r2', felder: { status: 'in_progress' } }] }));
    await db.saveJson('head-sales', { berichte: [], letzte: {}, versuche: {}, vorschlaege: [
      { id: 'hv-r2', art: 'daten_pflegen', titel: 'Bearbeitet', begruendung: 'x', kontakt_id: null, chance_id: null, mandat_id: null, event_id: null, frist: null, prioritaet: 'mittel', dedup_schluessel: 'r2', quelle: [], entwurf: null,
        status: 'angenommen', erstellt: jetzt, aktualisiert: jetzt, berichtId: 'hb-1', von: 'auto', auto: { am: jetzt, wirkung: 'Aufgabe', rueckgaengig: { art: 'aufgabe', aufgabeId: 'hd-hv-r2' } } },
    ] });
    const r = await headPost('person-a', 'sales', { aktion: 'rueckgaengig', id: 'hv-r2' });
    expect(r.status).toBe(409);
    const t = (await db.loadJson<{ tasks: { id: string; geloeschtAm?: string }[] }>('tasks'))!.tasks.find(x => x.id === 'hd-hv-r2');
    expect(t?.geloeschtAm).toBeUndefined();
  });
});

// ── (5) D7 Skill-Erfolgsquote ────────────────────────────────────────────────────────────────────────────────────────────────
describe('(5) D7: Stapel-Entscheidungen zu Vorschlägen eines Skill-Laufs zählen in der Erfolgsquote des Skills', () => {
  it('freigegeben → angenommen +1, abgelehnt → abgelehnt +1 (auch über einen Mitarbeiter-Thread unter dem Skill-Thread); fremde Vorschläge zählen nicht', async () => {
    const SK = 'sk-00000000-0000-4000-8000-0000000000aa';
    const leer = { laeufe: 1, angenommen: 0, abgelehnt: 0, fehler: 0 };
    await db.saveJson(`agenten-skills--${HAUS}`, { v: 1, skills: [{ id: SK, headId: 'sales', name: 'angebot-nachfassen', beschreibung: 'Bereitet das Nachfassen vor.', anleitung: 'Nur Vorschläge.', beispiele: [], werkzeuge: ['crm_vorschlag'], ausloeser: { art: 'hand' }, eingabeFelder: [], freigabePflicht: true, ergebnis: 'stapel', stufe: 'schnell', erfolg: leer, aktiv: true, version: 1, quelle: 'hand', angelegtVon: 'person-a', geaendertAm: T(1) }], mitarbeiter: [] });
    const nachricht = (id: string, vorschlagId: string) => ({ id, rolle: 'agent', von: 'head:sales', text: 'Entwurf liegt im Stapel.', zeit: T(0), werkzeuge: [{ name: 'crm_vorschlag', ok: true, gestapelt: true, vorschlagId }] });
    const kopf = { id: 'fd-skill-1', besitzer: 'person-a', agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: 'Skill „angebot-nachfassen“', status: 'fertig', fremdGelesen: false, vertraulich: false, skillId: SK, nachrichten: [nachricht('nr-1', 'v-skill-1')], erstellt: T(0), aktualisiert: T(0) };
    const kind = { id: 'fd-skill-2', besitzer: 'person-a', agent: { art: 'mitarbeiter', headId: 'sales', mitarbeiterId: 'sales-nachfassen' }, bereich: 'business', elternId: 'fd-skill-1', titel: 'Nachfassen', status: 'fertig', fremdGelesen: false, vertraulich: false, nachrichten: [nachricht('nr-2', 'v-skill-2')], erstellt: T(0), aktualisiert: T(0) };
    await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [kopf, kind] });
    const { lege, entscheide } = await import('@/lib/zoe/stapel');
    await db.saveJson('zoe-stapel', { vorschlaege: [] });
    const v1 = await lege({ werkzeug: 'crm_vorschlag', gruppe: 'crm', titel: 'Entwurf 1', nachher: 'x', eingabe: { n: 1 }, person: 'person-a', anlass: 'Head of Sales: Skill „angebot-nachfassen“' });
    const v2 = await lege({ werkzeug: 'crm_vorschlag', gruppe: 'crm', titel: 'Entwurf 2', nachher: 'x', eingabe: { n: 2 }, person: 'person-a', anlass: 'Head of Sales · Nachfassen: Nachfassen' });
    const v3 = await lege({ werkzeug: 'crm_vorschlag', gruppe: 'crm', titel: 'Ohne Skill', nachher: 'x', eingabe: { n: 3 }, person: 'person-a', anlass: 'Head of Sales: Pipeline' });
    // Die Kennungen, die die Läufe im Thread vermerkt haben, sind die der gelegten Vorschläge.
    await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [{ ...kopf, nachrichten: [nachricht('nr-1', v1.id)] }, { ...kind, nachrichten: [nachricht('nr-2', v2.id)] }] });
    await entscheide(v1.id, 'freigegeben', { von: 'person-a' });
    await entscheide(v2.id, 'abgelehnt', { von: 'person-a', grund: 'passt nicht' });
    await entscheide(v3.id, 'abgelehnt', { von: 'person-a' });
    const sk = (await db.loadJson<{ skills: { id: string; erfolg: typeof leer }[] }>(`agenten-skills--${HAUS}`))!.skills.find(s => s.id === SK)!;
    expect(sk.erfolg).toMatchObject({ laeufe: 1, angenommen: 1, abgelehnt: 1, fehler: 0 });
    // Eine zweite Entscheidung desselben Vorschlags zählt nicht doppelt (entscheide entscheidet nur Offenes).
    await entscheide(v1.id, 'abgelehnt', { von: 'person-a' });
    expect((await db.loadJson<{ skills: { id: string; erfolg: typeof leer }[] }>(`agenten-skills--${HAUS}`))!.skills[0].erfolg).toMatchObject({ angenommen: 1, abgelehnt: 1 });
    const { erfolgsquote } = await import('@/lib/agenten/skills');
    expect(erfolgsquote(sk.erfolg as never)).toBe(0.5);
  });
});

// ── (6) D8 Löschfrist der Threads ────────────────────────────────────────────────────────────────────────────────────────────
describe('(6) D8: Threads folgen der EINEN Fristen-Tabelle und der Löschfristen-Lauf räumt sie täglich', () => {
  const faden = (id: string, letzte: string, lauf?: Record<string, unknown>): FadenKern => ({
    id, besitzer: 'person-a', agent: { art: 'head', headId: 'sales' }, bereich: 'business', titel: `Thread ${id}`, status: 'offen', fremdGelesen: false, vertraulich: false,
    nachrichten: [{ id: `${id}-n`, rolle: 'person', von: 'person-a', text: 'GEHEIM-INHALT-THREAD', zeit: letzte }], erstellt: letzte, aktualisiert: letzte, ...(lauf ? { lauf } : {}),
  } as unknown as FadenKern);
  it('Frist aus der Tabelle (zoe-verlauf): 24 Monate eingestellt → ein 14 Monate alter Thread bleibt; Vorgabe 12 → er fällt (beim Lesen)', async () => {
    const fs = await import('@/lib/agenten/faeden-server');
    await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [faden('fd-alt', T(14 * 31)), faden('fd-neu', T(3))] });
    await db.saveJson('crm-loeschfristen', { fristen: { 'zoe-verlauf': 24 } });
    expect(await fs.fadenFristMonate()).toBe(24);
    expect((await fs.bestandLesen('person-a')).faeden.map(f => f.id).sort()).toEqual(['fd-alt', 'fd-neu']);
    await db.saveJson('crm-loeschfristen', {});
    expect(await fs.fadenFristMonate()).toBe(12);
    expect((await fs.bestandLesen('person-a')).faeden.map(f => f.id)).toEqual(['fd-neu']);
  });
  it('der tägliche Lauf entfernt abgelaufene Threads aus dem Bestand (laufende bleiben), protokolliert ohne Inhalte und ist idempotent', async () => {
    await db.saveJson('crm-loeschfristen', {});
    await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [faden('fd-alt', T(400)), faden('fd-laeuft', T(400), { status: 'laeuft', start: T(0) }), faden('fd-neu', T(3))] });
    await db.saveJson('agenten-faeden--person-b', { v: 1, faeden: [faden('fd-b-neu', T(5))] });
    const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
    const r = await loeschfristenLauf(new Date(), true);
    expect(r.bereinigt['agenten-faeden']).toBe(1);
    expect(((await db.loadJson<{ faeden: { id: string }[] }>('agenten-faeden--person-a'))!.faeden).map(f => f.id).sort()).toEqual(['fd-laeuft', 'fd-neu']);
    expect(((await db.loadJson<{ faeden: { id: string }[] }>('agenten-faeden--person-b'))!.faeden).map(f => f.id)).toEqual(['fd-b-neu']);
    // Protokoll: nur Bestand/Feldnamen, nie Inhalte.
    const prot = readdirSync(ordner).filter(f => f.startsWith('aenderungsprotokoll--')).map(f => readFileSync(path.join(ordner, f), 'utf8')).join('\n');
    expect(prot).toContain('agenten-faeden--person-a');
    expect(prot).not.toContain('GEHEIM-INHALT-THREAD');
    // Idempotent: ein zweiter Lauf schreibt den Bestand nicht neu.
    const vorher = statSync(path.join(ordner, 'agenten-faeden--person-a.json')).mtimeMs;
    const r2 = await loeschfristenLauf(new Date(), true);
    expect(r2.bereinigt['agenten-faeden']).toBeUndefined();
    expect(statSync(path.join(ordner, 'agenten-faeden--person-a.json')).mtimeMs).toBe(vorher);
  });
  it('Register: `agenten-faeden--*` trägt die Frist „zoe-verlauf“ und keine „offene“ Frist mehr; die Tabelle nennt die Threads', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    const e = registerEintrag('agenten-faeden--*');
    expect(e?.frist).toBe('zoe-verlauf');
    expect(e?.loeschfrist ?? '').not.toMatch(/offen/);
    const { LOESCHFRISTEN } = await import('@/lib/crm/loeschfristen');
    expect(LOESCHFRISTEN.find(f => f.id === 'zoe-verlauf')?.titel).toMatch(/Agenten/);
  });
});

// ── (7) agent-log ────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(7) Chat-Züge schreiben nicht mehr in den Ring `agent-log`', () => {
  it('ein Head-Chat (POST /api/agenten/faden senden) lässt `agent-log` unberührt — der Span steht an der Nachricht', async () => {
    await db.saveJson('agent-log', { entries: [{ id: 'loop-1', agent: 'loop-morgen', title: 'Morgen-Loop', ts: T(0), payload: null, person: 'person-a' }] });
    await db.saveJson('agenten-faeden--person-a', { v: 1, faeden: [] });
    ki.folge.push(text('Die Pipeline ist ruhig.'));
    const faden = (await import('@/app/api/agenten/faden/route')) as unknown as { POST: (r: Request) => Promise<Response> };
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Wie steht die Pipeline?' });
    expect(r.status, JSON.stringify(r.d)).toBe(200);
    const log = (await db.loadJson<{ entries: { agent: string }[] }>('agent-log'))!.entries;
    expect(log.map(e => e.agent)).toEqual(['loop-morgen']);
    const f = (await db.loadJson<{ faeden: FadenKern[] }>('agenten-faeden--person-a'))!.faeden[0];
    expect(f.nachrichten.some(n => (n as { lauf?: { operation?: string } }).lauf?.operation === 'chat')).toBe(true);
    for (const d of ['lib/agenten/gespraech.ts', 'lib/agenten/delegation.ts', 'lib/agenten/zoe-heads.ts']) expect(quelle(d), d).not.toMatch(/logRun\(`faden:/);
  });
});

// ── (8) nie kürzen ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(8) Über der Grenze ablehnen statt still kürzen', () => {
  const fakt = (i: number, x: Record<string, unknown> = {}) => ({ id: `f-${i}`, zeit: T(i), tag: T(i).slice(0, 10), art: 'sonstiges', thema: `Thema ${i}`, satz: `Satz ${i}`, raum: 'person-a', ...x });
  it('ZOE-Gedächtnis voll mit aktiven Fakten → GedaechtnisVoll, kein Fakt geht verloren', async () => {
    const g = await import('@/lib/zoe/gedaechtnis');
    const alle = Array.from({ length: g.GRENZE }, (_, i) => fakt(i));
    await db.saveJson('zoe-gedaechtnis', { fakten: alle });
    await expect(g.merke({ art: 'sonstiges', thema: 'Neu', satz: 'Ganz neu', raum: 'person-a' })).rejects.toBeInstanceOf(g.GedaechtnisVoll);
    const nachher = (await db.loadJson<{ fakten: { id: string }[] }>('zoe-gedaechtnis'))!.fakten;
    expect(nachher.length).toBe(g.GRENZE);
    expect(nachher.some(f => f.id === `f-${g.GRENZE - 1}`)).toBe(true); // der älteste aktive bleibt
  });
  it('… mit vergessenen Nachweisen bzw. abgelaufenen Fakten macht der neue Fakt Platz — nur diese fallen weg (älteste zuerst)', async () => {
    const g = await import('@/lib/zoe/gedaechtnis');
    const alle = Array.from({ length: g.GRENZE }, (_, i) => fakt(i, i === 10 ? { thema: '', satz: '', geloeschtAm: T(1) } : i === 20 ? { bis: '2020-01-01' } : {}));
    await db.saveJson('zoe-gedaechtnis', { fakten: alle });
    expect((await g.merke({ art: 'sonstiges', thema: 'Neu', satz: 'Ganz neu', raum: 'person-a' })).neu).toBe(true);
    const ids = (await db.loadJson<{ fakten: { id: string }[] }>('zoe-gedaechtnis'))!.fakten.map(f => f.id);
    expect(ids.length).toBe(g.GRENZE);
    expect(ids).not.toContain('f-10');
    expect(ids).toContain('f-20');
    expect(ids).toContain(`f-${g.GRENZE - 1}`);
    // rein: erst Vergessene, dann Abgelaufene, nie Aktive
    const p = g.platzMachen([fakt(0), fakt(1, { bis: '2020-01-01' }), fakt(2)] as never, '2026-10-09', 2);
    expect(p?.map(f => f.id)).toEqual(['f-0', 'f-2']);
    expect(g.platzMachen([fakt(0), fakt(1), fakt(2)] as never, '2026-10-09', 2)).toBeNull();
  });
  it('Head of Finance: offene Vorschläge fallen nie heraus; über der Grenze gehen erst Entschiedene, volle Liste weist Neues ab', async () => {
    const { vorschlaegeMischen, VORSCHLAEGE_GRENZE } = await import('@/lib/finanzen/chef/stand');
    const J = '2026-10-09T08:00:00Z';
    const roh = (i: number) => ({ art: 'mahnung', titel: `Rechnung ${i} anmahnen bitte jetzt`, begruendung: 'x', dedup_schluessel: `m-${i}`, prioritaet: 'mittel', quelle: [] }) as never;
    const offen = Array.from({ length: VORSCHLAEGE_GRENZE }, (_, i) => ({ ...(roh(i) as object), titel: `Offen Nummer ${i} alpha${i}`, id: `hv-o${i}`, status: 'offen', erstellt: J, aktualisiert: J, berichtId: 'b0' })) as never[];
    const m = vorschlaegeMischen(offen as never, [{ ...(roh(999) as object), titel: 'Ganz neuer Punkt omega' } as never], 'b1', J);
    expect(m.liste.filter(v => v.status === 'offen').length).toBe(VORSCHLAEGE_GRENZE);
    expect(m.liste.some(v => v.id === 'hv-o0')).toBe(true);
    expect(m.abgewiesen).toBe(1);
    const gemischt = [
      ...Array.from({ length: 100 }, (_, i) => ({ id: `hv-a${i}`, art: 'mahnung', titel: `Offen ${i} gamma${i}`, begruendung: 'x', dedup_schluessel: `a-${i}`, prioritaet: 'mittel', quelle: [], status: 'offen', erstellt: J, aktualisiert: J, berichtId: 'b0' })),
      ...Array.from({ length: 30 }, (_, i) => ({ id: `hv-x${i}`, art: 'mahnung', titel: `Abgelehnt ${i} delta${i}`, begruendung: 'x', dedup_schluessel: `x-${i}`, prioritaet: 'mittel', quelle: [], status: 'abgelehnt', erstellt: J, aktualisiert: J, entschieden: J, berichtId: 'b0' })),
    ];
    const m2 = vorschlaegeMischen(gemischt as never, [], 'b2', J);
    expect(m2.liste.length).toBe(VORSCHLAEGE_GRENZE);
    expect(m2.liste.filter(v => v.status === 'offen').length).toBe(100);
    expect(quelle('lib/finanzen/chef/stand.ts')).not.toMatch(/\.slice\(-120\)/);
  });
});

// ── (9) zoe-empfang ──────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(9) zoe-empfang: je Person ändern, der Gruß der anderen Person bleibt', () => {
  it('person-a holt ihren Gruß — der von person-b in derselben Stunde bleibt stehen; ältere Stunden fallen weg', async () => {
    const stunde = new Date().toISOString().slice(0, 13);
    await db.saveJson('zoe-empfang', { je: { [`person-b:${stunde}`]: { stunde, text: 'GRUSS-B' }, 'person-b:2020-01-01T00': { stunde: '2020-01-01T00', text: 'ALT' } } });
    ki.folge.push(text('Hallo, schön dass du da bist.'));
    const route = (await import('@/app/api/zoe/empfang/route')) as unknown as { GET: (r: Request) => Promise<Response> };
    const r = await route.GET(new Request('http://test/api/zoe/empfang', { headers: sitzung('person-a') }));
    expect(r.status).toBe(200);
    const je = (await db.loadJson<{ je: Record<string, { text: string }> }>('zoe-empfang'))!.je;
    expect(je[`person-b:${stunde}`]?.text).toBe('GRUSS-B');
    expect(je[`person-a:${stunde}`]?.text).toBeTruthy();
    expect(je['person-b:2020-01-01T00']).toBeUndefined();
  });
});

// ── (10) Stapel je Person ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(10) Stapel: dieselbe Wirkung zweier Personen sind zwei Vorschläge', () => {
  it('person-b verliert ihren Vorschlag nicht an den gleichen offenen von person-a — und bekommt nie dessen Kennung zurück', async () => {
    const { lege } = await import('@/lib/zoe/stapel');
    await db.saveJson('zoe-stapel', { vorschlaege: [] });
    const a = await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe', nachher: 'x', eingabe: { titel: 'Gleich' }, person: 'person-a' });
    const b = await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe', nachher: 'x', eingabe: { titel: 'Gleich' }, person: 'person-b' });
    const a2 = await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe', nachher: 'x', eingabe: { titel: 'Gleich' }, person: 'person-a' });
    expect(b.id).not.toBe(a.id);
    expect(b.person).toBe('person-b');
    expect(a2.id).toBe(a.id); // dieselbe Person: weiter nur einmal
    expect((await db.loadJson<{ vorschlaege: unknown[] }>('zoe-stapel'))!.vorschlaege.length).toBe(2);
  });
});

// ── (11) HOI ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('(11) HOI: Befund, wenn ein Agenten-Bestand groß oder langsam wird — nur Zahlen', () => {
  it('über 5 MB oder Schreiben über 200 ms → gelb; sonst grün; ohne Bestände kein Befund; nie ein Bestandsname', async () => {
    const { agentenBestandBefunde, AGENTEN_BESTAND } = await import('@/lib/hoi/lage');
    expect(agentenBestandBefunde(null)).toEqual([]);
    expect(agentenBestandBefunde({ anzahl: 0, groesstesMb: 0, ueberGrenze: 0, schreibenMaxMs: null })).toEqual([]);
    expect(agentenBestandBefunde({ anzahl: 4, groesstesMb: 1.2, ueberGrenze: 0, schreibenMaxMs: 40 })[0]).toMatchObject({ id: 'agenten-bestaende', ampel: 'gruen' });
    const gross = agentenBestandBefunde({ anzahl: 4, groesstesMb: 7.5, ueberGrenze: 1, schreibenMaxMs: 40 })[0];
    expect(gross.ampel).toBe('gelb');
    expect(agentenBestandBefunde({ anzahl: 4, groesstesMb: 1, ueberGrenze: 0, schreibenMaxMs: 350 })[0].ampel).toBe('gelb');
    expect(JSON.stringify(gross)).not.toMatch(/person-|agenten-faeden--/);
    for (const n of ['agenten-faeden--person-a', 'ki-protokoll--2026-10', 'ki-verbrauch', 'head-sales', 'zoe-stapel']) expect(AGENTEN_BESTAND.test(n), n).toBe(true);
    expect(AGENTEN_BESTAND.test('kontakte')).toBe(false);
    const { innenLage } = await import('@/lib/hoi/innen');
    const l = await innenLage();
    expect(l.agentenBestaende?.anzahl).toBeGreaterThan(0);
    expect(typeof l.agentenBestaende?.schreibenMaxMs).toBe('number');
  });
});
