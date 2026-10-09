// ─── Agenten-Durchstich: jede Verbindung Ende zu Ende (09.10., Kevin: „Überprüfe und überarbeite das ganze Agenten-System … dass alles
// verbunden ist, die Agents sauber laufen und alles, was damit zu tun hat.“) ────────────────────────────────────────────────────────────
// Anders als die Einzel-Wächter läuft hier jede Kette über die ECHTE Warteschlange: ZOE-Chat → `an_head` → Warteschlange → Arbeiter
// (`/api/zoe/auftraege/nimm` + `/lauf`, wie worker.mjs) → `runAgent('faden')` → interner Aufruf `/api/agenten/faden/lauf` → Head-Lauf →
// `an_mitarbeiter` → Warteschlange → Arbeiter → Mitarbeiter-Lauf → Bericht zurück. Interne Aufrufe (`http://localhost…`) leitet ein
// Router in die Routen-Module dieses Prozesses; das Modell ist `tests/fixtures/ki-fake.ts` (kein Netz). Eigener Datenordner, erfundene
// Konten (`@example.invalid`).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { rmSync } from 'node:fs';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-durchstich-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-durchstich', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.MAKE_OS_KI_ANBIETER_TOR;
  delete process.env.MAKE_OS_KI_BUDGET_MONAT_EURO;
  delete process.env.MAKE_OS_KI_USD_EUR;
  delete process.env.MAKE_OS_INTERN;
  return o;
});
// Das Brain ist meist leer (der Live-Zustand ist nicht Gegenstand) — nur Kette (5) liest es echt (`echt.brain`).
const echt = vi.hoisted(() => ({ brain: false }));
vi.mock('@/lib/brain', async orig => {
  const o = await orig<typeof import('@/lib/brain')>();
  return { ...o, gatherBrain: vi.fn(async (...a: Parameters<typeof o.gatherBrain>) => (echt.brain ? o.gatherBrain(...a) : ({}))), promptBrain: (...a: Parameters<typeof o.promptBrain>) => (echt.brain ? o.promptBrain(...a) : '') };
});
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/agenten' }));

import type { FadenKern } from '@/lib/agenten/faeden';
import { kontenSaeen, rufe, sitzung, dienst, text, werkzeug } from './fixtures/agenten-kern';
import { kiFake, type KiFake } from './fixtures/ki-fake';

type H = (r: Request) => Promise<Response>;
let kimmi: { POST: H };
let faden: { GET: H; POST: H };
let agentenRoute: { GET: H; POST: H };
let laeufeRoute: { GET: H; POST: H };
let nimmRoute: { POST: H };
let auftragLaufRoute: { POST: H };
let fadenLaufRoute: { POST: H };
let db: typeof import('@/lib/store/local-db');
let anthropic: typeof import('@/lib/anthropic');
let ki: KiFake;
let altFetch: typeof fetch;

/** Interne Aufrufe (der Server ruft sich selbst, lib/innen.ts) in die Routen dieses Prozesses — alles andere geht an den KI-Fake. */
const INTERN: Record<string, () => { POST?: H; GET?: H }> = {
  '/api/agenten/faden/lauf': () => fadenLaufRoute,
};
const interneAufrufe: string[] = [];

const bestand = async (p: string) => (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen(p)); // E3: Index + je Thread
const fadenVon = async (p: string, id: unknown) => (await bestand(p)).find(f => f.id === id);
const auftraege = async () => (await db.loadJson<{ auftraege: { id: string; name: string; status: string; person?: string; eingabe: Record<string, unknown>; anlass?: string; fehler?: string; zeit: string }[] }>('zoe-auftraege'))?.auftraege ?? [];
const glocke = async (p: string) => (await db.loadJson<{ eintraege?: { art: string; titel: string; link?: string; gelesen?: boolean }[] }>(`meldungen--${p}`))?.eintraege ?? [];

/** Eine Runde des Arbeiters (worker.mjs `runde` ohne Takt): Aufträge übernehmen und je Auftrag `/api/zoe/auftraege/lauf` rufen. */
async function arbeiterRunde(nur?: (a: { name: string }) => boolean): Promise<{ id: string; name: string; status: number; d: Record<string, unknown> }[]> {
  const n = await rufe(nimmRoute.POST, '/api/zoe/auftraege/nimm', dienst(), { anzahl: 16, pacht: 300 });
  const liste = (n.d.auftraege as { id: string; name: string; pachtToken: string }[] | undefined) ?? [];
  const raus: { id: string; name: string; status: number; d: Record<string, unknown> }[] = [];
  for (const a of liste) {
    if (nur && !nur(a)) continue;
    const r = await rufe(auftragLaufRoute.POST, '/api/zoe/auftraege/lauf', dienst(), { id: a.id, token: a.pachtToken });
    raus.push({ id: a.id, name: a.name, status: r.status, d: r.d });
  }
  return raus;
}
const zoe = (person: string, body: Record<string, unknown>) => rufe(kimmi.POST, '/api/kimmi', sitzung(person), body);

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  anthropic = await import('@/lib/anthropic');
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  agentenRoute = (await import('@/app/api/agenten/route')) as unknown as typeof agentenRoute;
  laeufeRoute = (await import('@/app/api/agenten/laeufe/route')) as unknown as typeof laeufeRoute;
  nimmRoute = (await import('@/app/api/zoe/auftraege/nimm/route')) as unknown as typeof nimmRoute;
  auftragLaufRoute = (await import('@/app/api/zoe/auftraege/lauf/route')) as unknown as typeof auftragLaufRoute;
  fadenLaufRoute = (await import('@/app/api/agenten/faden/lauf/route')) as unknown as typeof fadenLaufRoute;
  ki = kiFake();
  const kiFetch = globalThis.fetch;
  altFetch = kiFetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('http://localhost')) {
      const pfad = new URL(u).pathname;
      interneAufrufe.push(pfad);
      const mod = INTERN[pfad]?.();
      const h = (init?.method ?? 'GET') === 'GET' ? mod?.GET : mod?.POST;
      if (!h) throw new Error(`Interner Aufruf ohne Route im Test: ${pfad}`);
      return h(new Request(u, init));
    }
    return kiFetch(url as string, init);
  }) as typeof fetch;
});
afterAll(async () => { await new Promise(r => setTimeout(r, 300)); globalThis.fetch = altFetch; ki.zurueck(); rmSync(ordner, { recursive: true, force: true }); });
beforeEach(async () => {
  ki.folge.length = 0; ki.anfragen.length = 0; interneAufrufe.length = 0;
  anthropic._guthabenSetzen(0);
  (await import('@/lib/zugang/modell-drossel')).modellDrosselZuruecksetzen();
});

// ── (1) ZOE → Head → Mitarbeiter → zurück ─────────────────────────────────────────────────────────────────────────────────

const AUFTRAG = { ziel: 'Drei Nachfass-Entwürfe für offene Angebote', format: 'Liste mit Entwurf je Angebot', grenzen: 'Nur Vorschläge, nichts senden', quellen: 'Angebote und Deals' };

describe('(1) ZOE → Head → Mitarbeiter → zurück — über die echte Warteschlange', () => {
  let zoeId = '';
  let headId = '';
  let kindId = '';

  it('ZOE gibt an Sales; der Arbeiter nimmt den Lauf; Sales delegiert an „Nachfassen“; der Arbeiter nimmt auch diesen; die Berichte kommen an', async () => {
    ki.folge.push(werkzeug(['an_head', { head: 'sales', auftrag: 'Bereite das Nachfassen der offenen Angebote vor.' }]), text('Ist bei Sales.'));
    const r = await zoe('person-a', { message: 'Gib das Nachfassen der Angebote an Sales.', zoeFaden: 'neu' });
    expect(r.status).toBe(200);
    zoeId = String(r.d.fadenId);
    const head = (await bestand('person-a')).find(f => f.agent.art === 'head' && f.elternId === zoeId)!;
    headId = head.id;
    expect(head.lauf?.status).toBe('wartet');
    expect((await auftraege()).find(a => a.eingabe.fadenId === headId)).toMatchObject({ name: 'faden', status: 'offen', person: 'person-a' });

    // Der Arbeiter nimmt den Head-Lauf → interner Aufruf → Sales delegiert an einen Mitarbeiter.
    ki.folge.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-nachfassen', auftrag: AUFTRAG }]), text('Ich habe Nachfassen beauftragt.'));
    const runde1 = await arbeiterRunde();
    expect(runde1.map(x => x.name)).toEqual(['faden']);
    expect(runde1[0].d.ok).toBe(true);
    expect(interneAufrufe).toContain('/api/agenten/faden/lauf');
    const kind = (await bestand('person-a')).find(f => f.agent.art === 'mitarbeiter' && f.elternId === headId)!;
    expect(kind).toBeDefined();
    kindId = kind.id;
    expect(kind.lauf?.status).toBe('wartet');
    expect((await fadenVon('person-a', headId))!.lauf?.status).toBe('fertig');

    // Zweite Runde: der Mitarbeiter-Lauf.
    ki.folge.push(text('BERICHT-MARKE-7: Drei Entwürfe liegen im Freigabe-Stapel.'));
    const runde2 = await arbeiterRunde();
    expect(runde2.map(x => x.name)).toEqual(['faden']);
    expect((await fadenVon('person-a', kindId))!.lauf?.status).toBe('fertig');
    // Head-Thread: „Bericht aus Thread …“ mit dem Text des Mitarbeiters.
    const h2 = (await fadenVon('person-a', headId))!;
    expect(h2.nachrichten.some(n => n.verweis?.art === 'bericht' && n.verweis.fadenId === kindId && n.text.includes('BERICHT-MARKE-7'))).toBe(true);
  });

  it('das Ergebnis des Mitarbeiters kommt auch im ZOE-Thread an (nicht nur der Zwischenstand des Heads)', async () => {
    const z = (await fadenVon('person-a', zoeId))!;
    const berichte = z.nachrichten.filter(n => n.verweis?.art === 'bericht');
    expect(berichte.some(n => n.text.includes('BERICHT-MARKE-7'))).toBe(true);
  });

  it('„Seit deinem letzten Besuch“ nennt beide Berichte; „in Arbeit“ ist leer; Glocke an die auslösende Person, keine an die andere', async () => {
    const r = await rufe(agentenRoute.GET, `/api/agenten?seit=${encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString())}`, sitzung('person-a'));
    const u = r.d.ueberblick as { passiert: { text: string }[]; inArbeit: unknown[]; briefing: string };
    expect(u.inArbeit).toEqual([]);
    // Je Lauf EINE Zeile: der Lauf des Heads und der des Mitarbeiters — nicht noch einmal aus dem ZOE-Thread.
    expect(u.passiert.length).toBe(2);
    expect((await glocke('person-a')).some(g => g.art === 'agenten')).toBe(true);
    expect((await glocke('person-b')).some(g => g.art === 'agenten')).toBe(false);
  });

  it('Läufe: beide fertig in „Fertig“, keiner mehr „wartet“; Kosten in Euro', async () => {
    const r = await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung('person-a'));
    const l = (r.d.laeufe as { fadenId?: string; status: string; kosten?: { cent: number } }[]);
    for (const id of [headId, kindId]) expect(l.find(x => x.fadenId === id)?.status, id).toBe('fertig');
  });
});

// ── (1c) Hilfe über den Head: Mitarbeiter fragt → Head antwortet im Arbeitsstand → Mitarbeiter setzt fort ─────────────────────

describe('(1c) Hilfe-Kette über die echte Warteschlange', () => {
  it('Mitarbeiter fragt (hilfe_anfragen) → Head-Lauf beantwortet (brett_antworten) → Mitarbeiter läuft weiter und berichtet', async () => {
    await db.saveJson('zoe-auftraege', { auftraege: [] });
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Lass die Angebote nachfassen.', hintergrund: true });
    const kopfId = String((r.d.faden as { id: string }).id);
    ki.folge.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-nachfassen', auftrag: AUFTRAG }]), text('Nachfassen beauftragt.'));
    await arbeiterRunde();
    const kind = (await bestand('person-a')).find(f => f.elternId === kopfId)!;
    // Mitarbeiter-Lauf: fragt um Hilfe → wartet.
    ki.folge.push(werkzeug(['hilfe_anfragen', { frage: 'Sie oder Du in der Anrede?', warum: 'für die Entwürfe' }]));
    await arbeiterRunde();
    expect((await fadenVon('person-a', kind.id))!.lauf?.status).toBe('wartet');
    // Der Head ist eingereiht und beantwortet die offene Frage aus dem Arbeitsstand.
    ki.folge.push((body: Record<string, unknown>) => {
      const id = /\[frage (be-[0-9a-f-]+) · offen\]/.exec(JSON.stringify(body.system))?.[1] ?? 'be-fehlt';
      return werkzeug(['brett_antworten', { frage_id: id, antwort: 'Sie — förmlich.' }]);
    }, text('Beantwortet.'));
    await arbeiterRunde();
    // Der Mitarbeiter ist wieder eingereiht und läuft zu Ende.
    ki.folge.push(text('HILFE-FERTIG-MARKE: drei Entwürfe in der Sie-Form.'));
    await arbeiterRunde();
    const k2 = (await fadenVon('person-a', kind.id))!;
    expect(k2.lauf?.status).toBe('fertig');
    expect(k2.nachrichten.some(n => n.text.includes('Sie — förmlich'))).toBe(true);
    expect((await fadenVon('person-a', kopfId))!.nachrichten.some(n => n.verweis?.art === 'bericht' && n.text.includes('HILFE-FERTIG-MARKE'))).toBe(true);
    expect((await auftraege()).filter(a => a.status === 'offen' || a.status === 'laeuft')).toEqual([]);
  });
});

// ── (1b) Ohne Arbeiter (nur `next start`) ─────────────────────────────────────────────────────────────────────────────────

describe('(1b) Ohne Arbeiter: ein Lauf wartet — und das sieht man', () => {
  it('der Takt-Anstoß aus dem Browser hält den Herzschlag des Arbeiters nicht am Leben (Lagebild „Arbeiter“ ehrlich)', async () => {
    const fs = await import('node:fs');
    const p = await import('node:path');
    const datei = p.join(ordner, 'system', 'takt.txt');
    rmSync(datei, { force: true });
    const takt = (await import('@/app/api/zoe/takt/route')) as unknown as { POST: H };
    await rufe(takt.POST, '/api/zoe/takt', sitzung('person-a'), {});
    await new Promise(r => setTimeout(r, 50));
    expect(fs.existsSync(datei)).toBe(false);
  });

  it('ein wartender Agenten-Lauf trägt einen Hinweis, wenn sich der Arbeiter nicht meldet', async () => {
    ki.folge.push(werkzeug(['an_head', { head: 'marketing', auftrag: 'Plane die nächste Kampagne.' }]), text('Ist bei Marketing.'));
    const r = await zoe('person-a', { message: 'Gib die Kampagne an Marketing.', zoeFaden: 'neu' });
    const kopf = (await bestand('person-a')).find(f => f.agent.art === 'head' && f.elternId === r.d.fadenId)!;
    // Kein Arbeiter: nichts nimmt den Auftrag. Drei Minuten später (nur die Uhr verschoben).
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 3 * 60_000);
      const l = await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung('person-a'));
      const lauf = (l.d.laeufe as { fadenId?: string; status: string; hinweis?: string }[]).find(x => x.fadenId === kopf.id)!;
      expect(lauf.status).toBe('wartet');
      expect(lauf.hinweis ?? '').toMatch(/Arbeiter/);
    } finally { vi.useRealTimers(); }
    // Aufräumen: Lauf abbrechen und die Schlange leeren, damit die folgenden Ketten frisch beginnen.
    await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'abbrechen', fadenId: kopf.id });
    await arbeiterRunde();
  });
});

// ── (2) Vorschlag → Freigabe → Wirkung ───────────────────────────────────────────────────────────────────────────────────

describe('(2) Vorschlag eines Heads → Freigabe → Wirkung dort, wo der Mensch sucht', () => {
  let stapelRoute: { GET: H; POST: H };
  let tasksCreate: { POST: H };
  beforeAll(async () => {
    stapelRoute = (await import('@/app/api/zoe/stapel/route')) as unknown as typeof stapelRoute;
    tasksCreate = (await import('@/app/api/tasks/create/route')) as unknown as typeof tasksCreate;
    INTERN['/api/tasks/create'] = () => tasksCreate;
  });

  it('Sales schlägt im Chat eine Aufgabe vor → Stapel (für die Person, beim Head gezählt) → Freigeben legt sie im Business an; Doppelklick einmal', async () => {
    ki.folge.push(werkzeug(['create_task', { title: 'AUFGABE-MARKE-3 Angebot nachfassen', priority: 'high', space: 'privat', wer: 'person-b' }]), text('Liegt als Vorschlag bereit.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Leg eine Aufgabe zum Nachfassen an.' });
    expect(r.status).toBe(200);
    const { lies } = await import('@/lib/zoe/stapel');
    const v = (await lies('offen')).find(x => x.werkzeug === 'create_task' && String(x.eingabe.title).includes('AUFGABE-MARKE-3'))!;
    expect(v).toMatchObject({ person: 'person-a', eingabe: { space: 'business' } });
    expect(String(v.anlass)).toMatch(/^Head of Sales/);
    // Zähler am Head (Kopfleiste/Team) und „Als Nächstes“ nennen denselben Head.
    const a = await rufe(agentenRoute.GET, '/api/agenten', sitzung('person-a'));
    expect((a.d.heads as { id: string; zaehler: { freigaben: number } }[]).find(h => h.id === 'sales')!.zaehler.freigaben).toBeGreaterThanOrEqual(1);
    const l = await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung('person-a'));
    expect((l.d.naechstes as { art: string; headId?: string }[]).some(n => n.art === 'freigabe' && n.headId === 'sales')).toBe(true);
    // Die andere Person sieht den Vorschlag nicht.
    const b = await rufe(stapelRoute.GET, '/api/zoe/stapel', sitzung('person-b'));
    expect((b.d.vorschlaege as { id: string }[]).some(x => x.id === v.id)).toBe(false);
    // Freigeben — zweimal gleichzeitig: genau eine Aufgabe.
    const [x, y] = await Promise.all([
      rufe(stapelRoute.POST, '/api/zoe/stapel', sitzung('person-a'), { id: v.id, entscheidung: 'freigeben' }),
      rufe(stapelRoute.POST, '/api/zoe/stapel', sitzung('person-a'), { id: v.id, entscheidung: 'freigeben' }),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    const tasks = (await db.loadJson<{ tasks: { title: string; space?: string; spaceId?: string; assignee?: string; projectId?: string }[] }>('tasks'))?.tasks ?? [];
    const t = tasks.filter(z => z.title.includes('AUFGABE-MARKE-3'));
    expect(t).toHaveLength(1);
    expect(t[0].assignee).toBe('person-a');
    const { spaceVonAufgabe } = await import('@/lib/make-one/space-regeln');
    expect(spaceVonAufgabe({ ...t[0], projectId: t[0].projectId ?? '' } as Parameters<typeof spaceVonAufgabe>[0])).toBe('business');
  });

  it('ein CRM-Vorschlag des Heads (crm_vorschlag legt selbst in den Stapel) zählt beim Head — Zähler und Annahmequote', async () => {
    ki.folge.push(werkzeug(['crm_vorschlag', { art: 'segment', name: 'SEGMENT-MARKE Bestandskunden', kriterien: {}, begruendung: 'Für die Herbst-Kampagne.' }]), text('Segment liegt bereit.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Bau mir ein Segment für die Bestandskunden.' });
    expect(r.status).toBe(200);
    const { lies } = await import('@/lib/zoe/stapel');
    const v = (await lies('offen')).find(x => x.bezug?.art === 'crm' && String(x.titel).includes('SEGMENT-MARKE'))!;
    expect(v).toBeDefined();
    const { headVonVorschlag } = await import('@/lib/agenten/katalog');
    expect(headVonVorschlag(v)).toBe('sales');
    expect(String(v.anlass)).toContain('Für die Herbst-Kampagne.');
  });

  it('Ablehnen mit Grund zählt in die Annahmequote des Heads (Lernen), Freigeben ebenso', async () => {
    const { lies, lege } = await import('@/lib/zoe/stapel');
    const { annahmeFuerHead } = await import('@/lib/agenten/leistung');
    const { headDef } = await import('@/lib/agenten/katalog');
    const vorher = await annahmeFuerHead(headDef('sales')!, 'haus-a');
    const v = await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: 'Aufgabe', nachher: 'x', eingabe: { title: 'Abzulehnen' }, anlass: 'Head of Sales: Test', person: 'person-a', quelle: 'gespraech' });
    const r = await rufe(stapelRoute.POST, '/api/zoe/stapel', sitzung('person-a'), { id: v.id, entscheidung: 'ablehnen', grund: 'passt gerade nicht' });
    expect(r.status).toBe(200);
    expect((await lies()).find(x => x.id === v.id)?.status).toBe('abgelehnt');
    const nachher = await annahmeFuerHead(headDef('sales')!, 'haus-a');
    expect(nachher.abgelehnt).toBe(vorher.abgelehnt + 1);
    expect(nachher.angenommen).toBeGreaterThanOrEqual(1); // die freigegebene Aufgabe aus dem Fall davor
  });
});

// ── (3) Skill anlegen → Testlauf → einschalten → Head lädt ihn → Takt reiht zur Zeit EINMAL ein ───────────────────────────

describe('(3) Skills und Hintergrundaufgaben über Takt, Arbeiter und „Als Nächstes“', () => {
  let skills: { GET: H; POST: H };
  let skillId = '';
  const TESTS = [1, 2, 3].map(i => ({ eingabe: `Testfall ${i}: zwei offene Angebote`, erwartet: ['ein Entwurf je Angebot'] }));
  /** Eine Berliner Wandzeit an einem festen Tag als echte Zeit. */
  let wann: (tag: string, hhmm: string) => Date;
  /** Was der Takt jetzt für Agenten einreihen würde (dieselbe Funktion wie POST /api/zoe/takt, nur die Agenten-Läufe). */
  const taktAgenten = async (jetzt: Date) => (await (await import('@/lib/zoe/takt')).faellig(jetzt)).filter(f => f.auftrag.name === 'faden');
  const TAG1 = '2027-03-09'; // ein Dienstag (kein Feiertag)
  const TAG2 = '2027-03-10';

  beforeAll(async () => {
    skills = (await import('@/app/api/agenten/skills/route')) as unknown as typeof skills;
    const { ausWandzeit } = await import('@/lib/kalender/zeit');
    wann = (tag, hhmm) => ausWandzeit(`${tag}T${hhmm}:00`);
    await db.saveJson('zoe-auftraege', { auftraege: [] });
  });
  afterAll(() => { vi.useRealTimers(); });

  it('anlegen → Testlauf durch die echte Schleife (ohne Wirkung) → einschalten', async () => {
    const a = await rufe(skills.POST, '/api/agenten/skills', sitzung('person-a'), { aktion: 'anlegen', skill: {
      headId: 'sales', name: 'angebote-blick', beschreibung: 'Liest offene Angebote und schlägt Nachfass-Entwürfe vor — werktags morgens.',
      anleitung: 'SKILL-ANLEITUNG-MARKE: 1. Offene Angebote lesen. 2. Je Angebot einen Entwurf. 3. Nur Vorschlag.', werkzeuge: ['angebote_lage'],
      ausloeser: { art: 'zeitplan', rhythmus: 'taeglich', uhrzeit: '08:00' }, tests: TESTS,
    } });
    expect(a.status, JSON.stringify(a.d)).toBe(200);
    skillId = String((a.d.skill as { id: string }).id);
    for (let i = 0; i < 3; i++) {
      ki.folge.push(text('Würde die Angebote lesen und je einen Entwurf vorschlagen.'));
      ki.folge.push(text('{"erfuellt":[true],"notiz":"passt"}'));
    }
    const t = await rufe(skills.POST, '/api/agenten/skills', sitzung('person-a'), { aktion: 'testlauf', id: skillId, kostenBestaetigt: true });
    expect(t.status, JSON.stringify(t.d)).toBe(200);
    expect((t.d.skill as { testlauf: { ok: boolean } }).testlauf.ok).toBe(true);
    // Ohne Wirkung: nichts im Stapel, keine Aufgabe.
    const { lies } = await import('@/lib/zoe/stapel');
    expect((await lies('offen')).filter(v => String(v.anlass ?? '').includes('angebote-blick'))).toEqual([]);
    const ein = await rufe(skills.POST, '/api/agenten/skills', sitzung('person-a'), { aktion: 'aktivieren', id: skillId, stand: t.d.stand });
    expect(ein.status, JSON.stringify(ein.d)).toBe(200);
  });

  it('der Head kennt den eingeschalteten Skill und lädt seine Anleitung im Chat', async () => {
    ki.folge.push(werkzeug(['skill_laden', { skill: skillId }]), text('Mache ich nach Anleitung.'));
    const r = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'Nutz deinen Angebote-Skill.' });
    expect(r.status).toBe(200);
    expect(JSON.stringify(ki.anfragen[0].system)).toContain('angebote-blick');
    expect(JSON.stringify(ki.anfragen[1].messages)).toContain('SKILL-ANLEITUNG-MARKE');
  });

  it('Takt: zur Uhrzeit EINMAL eingereiht, der Arbeiter führt aus, der nächste Termin rückt weiter', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(wann(TAG1, '07:59'));
    expect(await taktAgenten(new Date())).toEqual([]);
    vi.setSystemTime(wann(TAG1, '08:01'));
    const dran = await taktAgenten(new Date());
    expect(dran.map(f => (f.auftrag.eingabe as { skillId?: string }).skillId)).toEqual([skillId]);
    const { reihe } = await import('@/lib/zoe/auftraege');
    await reihe(dran.map(f => f.auftrag));
    vi.setSystemTime(wann(TAG1, '08:02'));
    expect(await taktAgenten(new Date())).toEqual([]); // eingereiht — nicht noch einmal
    ki.folge.push(text('SKILL-LAUF-MARKE: zwei Entwürfe im Stapel.'));
    await arbeiterRunde();
    const f = (await bestand('person-a')).find(x => x.skillId === skillId && x.nachrichten.some(n => n.text.includes('SKILL-LAUF-MARKE')))!;
    expect(f.lauf?.status).toBe('fertig');
    vi.setSystemTime(wann(TAG1, '09:00'));
    expect(await taktAgenten(new Date())).toEqual([]); // gelaufen — heute nicht noch einmal
    const n = (await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung('person-a'))).d.naechstes as { art: string; wann: string; titel: string }[];
    const naechster = n.find(x => x.art === 'skill' && x.titel.includes('angebote-blick'));
    expect(naechster?.wann.slice(0, 10)).toBe(TAG2);
    vi.useRealTimers();
  });

  it('verpasst (App aus bis 15 Uhr) → am selben Tag EINMAL nachgeholt; 23 Uhr (Ruhezeit) nie', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(wann(TAG2, '23:10'));
      expect(await taktAgenten(new Date())).toEqual([]);
      vi.setSystemTime(wann(TAG2, '15:00'));
      const dran = await taktAgenten(new Date());
      expect(dran).toHaveLength(1);
      const { reihe } = await import('@/lib/zoe/auftraege');
      await reihe(dran.map(f => f.auftrag));
      vi.setSystemTime(wann(TAG2, '15:01'));
      expect(await taktAgenten(new Date())).toEqual([]);
    } finally { vi.useRealTimers(); }
    // Die Schlange für die nächsten Fälle leeren (nicht ausführen).
    await db.saveJson('zoe-auftraege', { auftraege: [] });
  });

  it('Not-Aus, Hintergrund-KI aus und Budget 100 % halten den Zeitplan an — und lösen sauber wieder', async () => {
    const ke = await import('@/lib/datenschutz/ki-einstellungen');
    const TAG3 = '2027-03-11';
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(wann(TAG3, '08:05'));
      // Not-Aus
      expect((await rufe(agentenRoute.POST, '/api/agenten', sitzung('person-a'), { aktion: 'not-aus', an: true })).status).toBe(200);
      expect(await taktAgenten(new Date())).toEqual([]);
      expect((await rufe(agentenRoute.POST, '/api/agenten', sitzung('person-a'), { aktion: 'not-aus', an: false })).status).toBe(200);
      expect(await taktAgenten(new Date())).toHaveLength(1);
      // Hintergrund-KI aus
      await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), hintergrund: false } }));
      expect(await taktAgenten(new Date())).toEqual([]);
      await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), hintergrund: true } }));
      // … auch, wenn nur die Person selbst ihre Hintergrund-KI ausschaltet (vorher reihte der Takt täglich ein, der Arbeiter verwarf still).
      await ke.aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), 'person-a': { ...(d.personen?.['person-a'] ?? {}), hintergrund: false } } }));
      expect(await taktAgenten(new Date())).toEqual([]);
      await ke.aendereKiEinstellungen(d => ({ ...d, personen: { ...(d.personen ?? {}), 'person-a': { ...(d.personen?.['person-a'] ?? {}), hintergrund: true } } }));
      expect(await taktAgenten(new Date())).toHaveLength(1);
      // Budget erreicht (Gesamt-Grenze 1 Cent, schon mehr verbraucht)
      await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), budget: { gesamtEuroCent: 1, gesamtAb: '2026-01-01T00:00:00.000Z', gesamtBasisUsdCent: 0 } } }));
      expect(await taktAgenten(new Date())).toEqual([]);
      await ke.aendereKiEinstellungen(d => ({ ...d, instanz: { ...(d.instanz ?? {}), budget: undefined } }));
      expect(await taktAgenten(new Date())).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});

// ── (4) Alte Head-Läufe ↔ neuer Agenten-Bereich ───────────────────────────────────────────────────────────────────────────

describe('(4) Eingebaute Heads (Sales/Marketing/Event, Finance) im Agenten-Bereich', () => {
  it('ihre Freigabe-Liste zählt am Head, im Überblick und in „Als Nächstes“ gleich — und „Wartet auf dich“ verweist darauf', async () => {
    const jetzt = new Date().toISOString();
    const v = (id: string, fuer?: string) => ({ id, status: 'offen', erstellt: jetzt, aktualisiert: jetzt, berichtId: 'b-1', art: 'naechster_schritt', titel: `Vorschlag ${id}`, begruendung: 'x', kontakt_id: null, chance_id: null, mandat_id: null, event_id: null, frist: '2027-01-01', prioritaet: 'mittel', dedup_schluessel: id, quelle: ['crm'], ...(fuer ? { fuer } : {}) });
    await db.saveJson('head-sales', { berichte: [], letzte: {}, versuche: {}, vorschlaege: [v('hv-1', 'person-a'), v('hv-2', 'beide'), v('hv-3', 'person-b')] });
    const a = await rufe(agentenRoute.GET, '/api/agenten', sitzung('person-a'));
    const sales = (a.d.heads as { id: string; zaehler: { freigaben: number } }[]).find(h => h.id === 'sales')!;
    const l = await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung('person-a'));
    const zeile = (l.d.naechstes as { art: string; headId?: string; anzahl?: number }[]).find(n => n.art === 'freigabe' && n.headId === 'sales');
    // Zwei für person-a (eigene + „beide“), nicht die der anderen Person; dieselbe Zahl in Kopf und „Als Nächstes“.
    expect(sales.zaehler.freigaben).toBeGreaterThanOrEqual(2);
    expect(zeile?.anzahl).toBe(sales.zaehler.freigaben);
    const stapel = (await rufe((await import('@/app/api/zoe/stapel/route') as unknown as { GET: H }).GET, '/api/zoe/stapel', sitzung('person-a'))).d.offen as number;
    const { freigabenBeiHeads } = await import('@/components/os/agenten/regeln');
    expect(freigabenBeiHeads((a.d.ueberblick as { freigaben: { anzahl: number } }).freigaben.anzahl, stapel)).toBe(2);
    await db.saveJson('head-sales', { berichte: [], letzte: {}, versuche: {}, vorschlaege: [] });
  });

  it('Not-Aus hält auch die eingebauten Head-Läufe und den Finanzchef im Takt an — die Wartung läuft weiter', async () => {
    const { taktFiltern } = await import('@/lib/agenten/einstellung');
    const f = (name: string, eingabe?: Record<string, unknown>) => ({ auftrag: { name, ...(eingabe ? { eingabe } : {}) } });
    const raus = taktFiltern([f('head-sales'), f('finanzchef'), f('faden', { headId: 'sales' }), f('morgen'), f('durchsicht'), f('markttraktion')], { v: 1, heads: {}, notAus: { seit: new Date().toISOString(), von: 'person-a' } } as never, () => null);
    expect(raus.map(x => x.auftrag.name)).toEqual(['durchsicht', 'markttraktion']);
  });
});

// ── (5) Kontext der Heads und leere Instanz ──────────────────────────────────────────────────────────────────────────────

describe('(5) Leere Instanz und ohne KI-Schlüssel: alles startet, Leerzustände statt Ausnahmen', () => {
  it('ohne Schlüssel: Agenten-Seite, Läufe und Threads antworten; ZOE und Head sagen klar, dass der Schlüssel fehlt', async () => {
    const alt = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      ki.anfragen.length = 0;
      expect((await rufe(agentenRoute.GET, '/api/agenten', sitzung('team-c'))).status).toBe(200);
      expect((await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung('team-c'))).status).toBe(200);
      expect((await rufe(faden.GET, '/api/agenten/faden', sitzung('team-c'))).status).toBe(200);
      const z = await zoe('team-c', { message: 'Hallo', zoeFaden: 'neu' });
      expect(z.status).toBeLessThan(500);
      expect(JSON.stringify(z.d)).toMatch(/Schlüssel/);
      // Head-Chat: ohne Wirkung gescheitert → 503 mit Satz (Härtetest: die Eingabe bleibt im Feld, nichts Halbes im Thread).
      const h = await rufe(faden.POST, '/api/agenten/faden', sitzung('team-c'), { aktion: 'senden', agent: { art: 'head', headId: 'sales' }, text: 'MARKE-OHNE-SCHLUESSEL' });
      expect([200, 503]).toContain(h.status);
      expect(JSON.stringify(h.d)).toMatch(/Schlüssel/);
      expect(JSON.stringify(await bestand('team-c'))).not.toContain('MARKE-OHNE-SCHLUESSEL');
      expect(ki.anfragen.length).toBe(0);
    } finally { process.env.ANTHROPIC_API_KEY = alt; }
  });
});

describe('(5) Kontext: Jahresziele wie im Agenten-Überblick — bei ZOE und beim Head (Business nie Privat)', () => {
  beforeAll(async () => {
    const jahr = Number((await import('@/lib/zeit')).localDay().slice(0, 4));
    await db.saveJson('ziele', { jahr: [
      { id: 'z-business-1', titel: 'ZIEL-BUSINESS-MARKE Umsatz verdoppeln', space: 'business', jahr, fortschritt: 40, erledigt: false, rang: 1 },
      { id: 'z-privat-1', titel: 'ZIEL-PRIVAT-MARKE Halbmarathon', space: 'privat', jahr, fortschritt: 10, erledigt: false, rang: 2 },
      { id: 'z-alt', titel: 'ZIEL-ALT-MARKE', space: 'business', jahr: jahr - 1, erledigt: false, rang: 3 },
    ], quartal: [], monat: [], woche: [], tag: [] });
    echt.brain = true;
  });
  afterAll(() => { echt.brain = false; });

  it('Überblick, ZOE und Head lesen dieselben Jahresziele — der Business-Head und das Konto „nur Business“ ohne die privaten', async () => {
    const a = await rufe(agentenRoute.GET, '/api/agenten', sitzung('person-a'));
    const titel = ((a.d.ueberblick as { ziele: { titel: string }[] }).ziele).map(z => z.titel).join(' | ');
    expect(titel).toContain('ZIEL-BUSINESS-MARKE');
    expect(titel).toContain('ZIEL-PRIVAT-MARKE');
    expect(titel).not.toContain('ZIEL-ALT-MARKE');
    ki.folge.push(text('Ich kenne eure Ziele.'));
    await zoe('person-a', { message: 'Woran arbeiten wir dieses Jahr?', zoeFaden: 'neu' });
    const zoeSystem = JSON.stringify(ki.anfragen.at(-1)!.system);
    expect(zoeSystem).toContain('ZIEL-BUSINESS-MARKE');
    expect(zoeSystem).toContain('ZIEL-PRIVAT-MARKE');
    ki.folge.push(text('Strategie kennt die Business-Ziele.'));
    await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'senden', agent: { art: 'head', headId: 'strategie' }, text: 'Welche Ziele gelten?' });
    const headSystem = JSON.stringify(ki.anfragen.at(-1)!.system);
    expect(headSystem).toContain('ZIEL-BUSINESS-MARKE');
    expect(headSystem).not.toContain('ZIEL-PRIVAT-MARKE');
    ki.folge.push(text('Nur Business.'));
    await zoe('team-c', { message: 'Welche Ziele haben wir?', zoeFaden: 'neu' });
    const nurBusiness = JSON.stringify(ki.anfragen.at(-1)!.system);
    expect(nurBusiness).toContain('ZIEL-BUSINESS-MARKE');
    expect(nurBusiness).not.toContain('ZIEL-PRIVAT-MARKE');
  });
});

// ── (6) Einen Schritt weiter: abbrechen, neu starten, löschen, ausschalten, zweite Person, Kosten ────────────────────────────

/** „+ Hintergrundaufgabe jetzt“ an einen Head: Thread + Lauf in der Warteschlange. */
async function imHintergrund(person: string, headId: string, text: string): Promise<{ fadenId: string; auftragId: string }> {
  const r = await rufe(faden.POST, '/api/agenten/faden', sitzung(person), { aktion: 'senden', agent: { art: 'head', headId }, text, hintergrund: true });
  expect(r.status, JSON.stringify(r.d)).toBe(200);
  return { fadenId: String((r.d.faden as { id: string }).id), auftragId: String((r.d.lauf as { auftragId: string }).auftragId) };
}
const laeufe = async (person: string) => ((await rufe(laeufeRoute.GET, '/api/agenten/laeufe', sitzung(person))).d.laeufe as { id: string; fadenId?: string; status: string; hinweis?: string; aktionen: string[]; kosten?: { cent: number } }[]);

describe('(6) Einen Schritt weiter', () => {
  beforeEach(async () => { await db.saveJson('zoe-auftraege', { auftraege: [] }); });

  it('Abbrechen → „Neu starten“ läuft wirklich (vorher blieb der Thread „abgebrochen“ und der Arbeiter übersprang ihn)', async () => {
    const { fadenId, auftragId } = await imHintergrund('person-a', 'sales', 'Prüf die offenen Deals.');
    const ab = await rufe(laeufeRoute.POST, '/api/agenten/laeufe', sitzung('person-a'), { aktion: 'abbrechen', laufId: auftragId });
    expect(ab.status).toBe(200);
    expect((await fadenVon('person-a', fadenId))!.lauf?.status).toBe('abgebrochen');
    const neu = await rufe(laeufeRoute.POST, '/api/agenten/laeufe', sitzung('person-a'), { aktion: 'neu-starten', laufId: auftragId, kostenBestaetigt: true });
    expect(neu.status, JSON.stringify(neu.d)).toBe(200);
    ki.folge.push(text('NEUSTART-MARKE: zwei Deals hängen.'));
    await arbeiterRunde();
    const f = (await fadenVon('person-a', fadenId))!;
    expect(f.lauf?.status).toBe('fertig');
    expect(f.nachrichten.some(n => n.text.includes('NEUSTART-MARKE'))).toBe(true);
    expect(ki.anfragen.length).toBe(1);
  });

  it('Thread löschen nimmt ALLE Threads darunter mit (ZOE → Head → Mitarbeiter) — und ihre wartenden Läufe laufen nicht mehr', async () => {
    ki.folge.push(werkzeug(['an_head', { head: 'sales', auftrag: 'Bereite das Nachfassen vor.' }]), text('Ist bei Sales.'));
    const z = await zoe('person-a', { message: 'Nachfassen an Sales.', zoeFaden: 'neu' });
    const zoeId = String(z.d.fadenId);
    ki.folge.push(werkzeug(['an_mitarbeiter', { mitarbeiter: 'sales-nachfassen', auftrag: AUFTRAG }]), text('Nachfassen beauftragt.'));
    await arbeiterRunde();
    const kopf = (await bestand('person-a')).find(f => f.elternId === zoeId)!;
    const kind = (await bestand('person-a')).find(f => f.elternId === kopf.id)!;
    expect(kind.lauf?.status).toBe('wartet');
    // Eine offene Plan-Freigabe des Head-Threads im Stapel (wie sie planStapeln ablegt).
    const { lege, hole } = await import('@/lib/zoe/stapel');
    const { planBezug, PLAN_WERKZEUG, AGENTEN_GRUPPE_PLAN } = await import('@/lib/agenten/plan-stapel');
    const plan = await lege({ werkzeug: PLAN_WERKZEUG, gruppe: AGENTEN_GRUPPE_PLAN, titel: 'Plan von Head of Sales', nachher: '• x', eingabe: { fadenId: kopf.id, planId: 'pl-test-0001' }, anlass: 'Head of Sales: mehr als 2 Mitarbeiter', person: 'person-a', quelle: 'lauf', bezug: planBezug(kopf.id, 'pl-test-0001') });
    const { fadenStand } = await import('@/lib/agenten/faeden');
    const zf = (await fadenVon('person-a', zoeId))!;
    const weg = await rufe(faden.POST, '/api/agenten/faden', sitzung('person-a'), { aktion: 'loeschen', fadenId: zoeId, stand: fadenStand(zf) });
    expect(weg.status).toBe(200);
    expect((await hole(plan.id))?.status).toBe('fehlgeschlagen');
    const rest = (await bestand('person-a')).map(f => f.id);
    expect(rest).not.toContain(kopf.id);
    expect(rest).not.toContain(kind.id);
    ki.anfragen.length = 0;
    await arbeiterRunde();
    expect(ki.anfragen.length).toBe(0);
    expect((await auftraege()).filter(a => a.eingabe.fadenId === kind.id && (a.status === 'offen' || a.status === 'laeuft'))).toEqual([]);
  });

  it('ein Lauf, dessen Ziel es nicht mehr gibt (Skill gelöscht), endet EINMAL — kein dreifaches Neueinreihen', async () => {
    const { reihe } = await import('@/lib/zoe/auftraege');
    const e = { art: 'skill', skillId: 'sk-00000000-0000-4000-8000-00000000dead', headId: 'sales', ausloeser: 'hand' };
    await reihe([{ art: 'agent', name: 'faden', auftrag: JSON.stringify(e), eingabe: e, person: 'person-a', anlass: 'Agenten-Lauf' }]);
    await arbeiterRunde();
    const a = (await auftraege()).find(x => x.eingabe.skillId === e.skillId)!;
    expect(a.status).toBe('fehler');
    expect((a as unknown as { versuche: number }).versuche).toBe(1);
  });

  it('ein abgebrochener Lauf legt nicht ALLE geplanten Agenten-Läufe still (Pause nach Fehlschlag je Ziel)', async () => {
    const { wartenNachFehler } = await import('@/lib/zoe/takt');
    const heute = (await import('@/lib/zeit')).localDay();
    const jetzt = new Date();
    const spur = [{ name: 'faden', tag: heute, status: 'fehler', zeit: jetzt.toISOString(), beendet: jetzt.toISOString(), eingabe: { art: 'faden', fadenId: 'fd-anderer' } }];
    expect(wartenNachFehler(spur, 'faden', heute, jetzt, 'sk-mein-skill')).toBe(0);
    expect(wartenNachFehler(spur, 'faden', heute, jetzt, 'fd-anderer')).toBeGreaterThan(0);
    expect(wartenNachFehler(spur, 'faden', heute, jetzt)).toBeGreaterThan(0); // ohne Ziel wie bisher (andere Läufe)
  });

  it('Kostengrenze einer Hintergrundaufgabe gilt im Lauf (vorher still ignoriert)', async () => {
    const { wandzeit } = await import('@/lib/kalender/zeit');
    const morgen = wandzeit(new Date(Date.now() + 86_400_000)).slice(0, 10);
    const p = await rufe(laeufeRoute.POST, '/api/agenten/laeufe', sitzung('person-a'), { aktion: 'planen', kostenBestaetigt: true, aufgabe: { agent: { art: 'head', headId: 'strategie' }, titel: 'Wochenblick', auftrag: 'Fass die Woche zusammen.', zeitplan: { art: 'einmalig', wann: `${morgen}T10:00:00` }, kostenGrenzeCent: 7 } });
    expect(p.status, JSON.stringify(p.d)).toBe(200);
    const planId = String((p.d.aufgabe as { id: string }).id);
    const { reihe } = await import('@/lib/zoe/auftraege');
    const e = { art: 'plan', planId, headId: 'strategie' };
    await reihe([{ art: 'agent', name: 'faden', auftrag: JSON.stringify(e), eingabe: e, person: 'person-a', anlass: 'Takt: Agenten-Zeitplan' }]);
    ki.folge.push(text('Woche zusammengefasst.'));
    await arbeiterRunde();
    const f = (await bestand('person-a')).find(x => x.planId === planId)!;
    expect(f.lauf?.kostenGrenzeCent).toBe(7);
  });

  it('Head ausgeschaltet, während ein Lauf wartet: „Läuft“ zeigt „wartet“ mit Grund — nicht „fertig“', async () => {
    const { fadenId } = await imHintergrund('person-a', 'event', 'Bereite die Gästeliste vor.');
    const eb = 'agenten-einstellung--haus-a';
    const alt = await db.loadJson<{ v: 1; heads?: Record<string, Record<string, unknown>> }>(eb);
    await db.saveJson(eb, { ...(alt ?? { v: 1 }), heads: { ...(alt?.heads ?? {}), event: { ...(alt?.heads?.event ?? {}), aktiv: false } } });
    try {
      await arbeiterRunde();
      const l = (await laeufe('person-a')).find(x => x.fadenId === fadenId)!;
      expect(l.status).toBe('wartet');
      expect(l.hinweis ?? '').toMatch(/ausgeschaltet/);
    } finally { await db.saveJson(eb, alt ?? { v: 1, heads: {} }); }
  });

  it('die zweite Person sieht keinen Lauf und keinen Thread der ersten', async () => {
    const meine = await laeufe('person-a');
    const ihre = await laeufe('person-b');
    const ids = new Set(meine.map(l => l.fadenId).filter(Boolean));
    expect(ihre.some(l => l.fadenId && ids.has(l.fadenId))).toBe(false);
    const g = await rufe(faden.GET, '/api/agenten/faden?agent=head:sales', sitzung('person-b'));
    expect(JSON.stringify(g.d)).not.toContain('NEUSTART-MARKE');
  });

  it('Kosten eines Laufs: Thread misst US-Cent, „Läuft“ zeigt dieselben Kosten in Euro, die Instanz zählt sie mit', async () => {
    const vorher = ((await db.loadJson<{ summe?: { usdCent?: number } }>('ki-verbrauch'))?.summe?.usdCent) ?? null;
    const { fadenId } = await imHintergrund('person-a', 'strategie', 'Kurzer Blick auf die Ziele.');
    ki.folge.push({ ...text('Ziele im Plan.'), usage: { input_tokens: 10_000, output_tokens: 1_000 } });
    await arbeiterRunde();
    const f = (await fadenVon('person-a', fadenId))!;
    expect(f.lauf!.kostenCent).toBeGreaterThan(0);
    const { inEuroCent } = await import('@/lib/ki/kosten');
    const l = (await laeufe('person-a')).find(x => x.fadenId === fadenId)!;
    expect(l.kosten!.cent).toBeCloseTo(Math.round(inEuroCent(f.lauf!.kostenCent) * 100) / 100, 2);
    const nachher = ((await db.loadJson<{ summe?: { usdCent?: number } }>('ki-verbrauch'))?.summe?.usdCent) ?? null;
    if (vorher !== null && nachher !== null) expect(nachher - vorher).toBeCloseTo(f.lauf!.kostenCent, 1);
  });
});

// ── (7) Die Verbindungen in der Oberfläche ───────────────────────────────────────────────────────────────────────────────

describe('(7) Oberfläche: was die Verbindungen sichtbar macht', () => {
  const hEl = async (c: unknown, props: unknown) => (await import('react')).createElement(c as never, props as never);
  async function rendere(kind: unknown, teil: Record<string, unknown> = {}): Promise<string> {
    const FIX = await import('./fixtures/agenten-api');
    const { AgentenKontext } = await import('@/components/os/agenten/kontext');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const stapel = { ok: true, offen: 1, vorschlaege: [{ id: 'v-beispiel-1', titel: 'Entwurf ablegen', werkzeug: 'crm_vorschlag', gruppe: 'markttraktion', bezug: { art: 'crm', id: 'nachricht_entwurf:c-1' }, status: 'offen', zeit: '2026-10-08T07:40:00.000Z' }] };
    const wert = {
      agenten: { zustand: 'da', daten: FIX.AGENTEN }, faeden: { zustand: 'da', daten: FIX.FADEN_LISTE }, laeufe: { zustand: 'da', daten: FIX.LAEUFE },
      stapel: { zustand: 'da', daten: stapel }, form: 'breit', auswahl: { art: 'zoe' }, entwurf: null, starteEntwurf: () => {}, jetzt: new Date('2026-10-08T08:00:00.000Z'),
      space: 'business', bereich: 'alle', oeffne: () => {}, dialog: () => {}, bestaetigen: async () => true, melde: () => {}, vorlage: { faeden: {}, skills: {} }, ...teil,
    };
    return renderToStaticMarkup((await import('react')).createElement(AgentenKontext as never, { wert } as never, kind as never));
  }

  it('„Wartet auf dich“ nennt die Freigaben der eingebauten Heads mit Sprung zur Freigaben-Seite (vorher: „Nichts wartet“)', async () => {
    const FIX = await import('./fixtures/agenten-api');
    const { WartetAufDich } = await import('@/components/os/agenten/Hintergrund');
    const agenten = { ...FIX.AGENTEN, ueberblick: { ...FIX.AGENTEN.ueberblick, freigaben: { ...FIX.AGENTEN.ueberblick.freigaben, anzahl: 4 } } };
    const html = await rendere(await hEl(WartetAufDich, {}), { agenten: { zustand: 'da', daten: agenten }, faeden: { zustand: 'da', daten: { ok: true, faeden: [] } } });
    expect(html).toContain('3 Freigaben liegen bei den Heads');
    expect(html).toContain('Wartet auf dich (4)');
  });

  it('„Läuft“ zeigt, warum ein Lauf wartet (Arbeiter still, Head aus, Business-frei)', async () => {
    const FIX = await import('./fixtures/agenten-api');
    const { Laeuft } = await import('@/components/os/agenten/Hintergrund');
    const lauf = { ...FIX.LAEUFE.laeufe[0], status: 'wartet', hinweis: 'Der Hintergrund-Arbeiter meldet sich nicht (noch nie gemeldet) — der Lauf startet, sobald er wieder läuft.' };
    const html = await rendere(await hEl(Laeuft, {}), { laeufe: { zustand: 'da', daten: { ...FIX.LAEUFE, laeufe: [lauf] } } });
    expect(html).toContain('Hintergrund-Arbeiter meldet sich nicht');
  });

  it('der Skill-Editor sagt ehrlich, welche Ereignis-Auslöser noch nicht angebunden sind (seit E1 09.10. nur noch die übrigen)', async () => {
    const { SkillEditor } = await import('@/components/os/agenten/Dialoge');
    const mail = await rendere(await hEl(SkillEditor, { headId: 'sales', start: { ausloeser: { art: 'ereignis', ereignis: 'neue-mail' } }, onZu: () => {} }));
    expect(mail).not.toContain('noch nicht angebunden');
    const frist = await rendere(await hEl(SkillEditor, { headId: 'sales', start: { ausloeser: { art: 'ereignis', ereignis: 'frist-naht' } }, onZu: () => {} }));
    expect(frist).toContain('noch nicht angebunden');
  });
});
