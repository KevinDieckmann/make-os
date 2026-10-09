// ─── Wächter Paket 4a: ZOE steuert die Heads, ZOE auf Threads, ≤ 20 Werkzeuge (09.10.; AGENTEN_KONZEPT.md C3/C8, „Paket 4 — so verdrahtet“) ─
//   • ZOE-Gespräch = Thread der Person: einmalige Übernahme des alten Verlaufs (Altbestand ohne Person → Inhaber), Verlauf NUR vom Server,
//     „fremd gelesen“ am Thread; ZoePanel, Empfang und Agenten-Seite sprechen in denselben Thread.
//   • `an_head` reiht ein (Thread beim Head, Eltern = ZOE-Thread, Warteschlange `faden`) — der Bericht kommt in den ZOE-Thread + Glocke.
//   • `head_fragen` = synchroner Head-Lauf NUR mit dem Kontext dieses Heads, nur lesend, Antwort als fremd('agent').
//   • Sicht: ein Konto „nur Business“ erreicht über ZOE keinen Privat-Head.
//   • ZOE bekommt je Zug höchstens 20 Werkzeuge; jedes bisherige Werkzeug bleibt über Kern, Bereich oder einen Head erreichbar.
// Eigener Datenordner, erfundene Konten (`@example.invalid`), Modell als Fake (kein Netz).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-agenten-p4a-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-agenten-p4a', MAKE_OS_KI_VORGABE: 'kompatibel', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_BRAIN_INDEX: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: p.join(o, 'vault') });
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  delete process.env.ANTHROPIC_MODEL;
  return o;
});
// Das Brain der Instanz ist hier leer — der Live-Zustand bleibt draußen (der Prompt-Aufbau ist nicht Gegenstand dieses Wächters).
vi.mock('@/lib/brain', async orig => ({ ...(await orig<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async orig => ({ ...(await orig<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));

import type { FadenKern } from '@/lib/agenten/faeden';
import { kontenSaeen, modellFake, rufe, sitzung, text, werkzeug, werkzeugNamen, type ModellFake } from './fixtures/agenten-kern';

type H = (r: Request) => Promise<Response>;
let kimmi: { POST: H };
let faden: { GET: H; POST: H };
let m: ModellFake;
let db: typeof import('@/lib/store/local-db');

const J = '2026-10-01T08:00:00.000Z';
const GEHEIM = 'MARKE-ANDERE-PERSON-7731';
const BROWSER = 'MARKE-AUS-DEM-BROWSER-2208';
const bestand = async (p: string) => (await db.loadJson<{ faeden: FadenKern[] }>(`agenten-faeden--${p}`))?.faeden ?? [];
const zoeFaeden = async (p: string) => (await bestand(p)).filter(f => f.agent.art === 'zoe');
const systemText = (b: Record<string, unknown>) => JSON.stringify(b.system ?? '');
const fragen = (person: string, body: Record<string, unknown>) => rufe(kimmi.POST, '/api/kimmi', sitzung(person), body);
const ergebnisse = (b: Record<string, unknown>): string[] => {
  const letzte = ((b.messages as { content?: unknown }[] | undefined) ?? []).at(-1);
  return Array.isArray(letzte?.content) ? (letzte!.content as { content?: unknown }[]).map(x => String(x.content ?? '')) : [];
};

beforeAll(async () => {
  await kontenSaeen();
  db = await import('@/lib/store/local-db');
  kimmi = (await import('@/app/api/kimmi/route')) as unknown as typeof kimmi;
  faden = (await import('@/app/api/agenten/faden/route')) as unknown as typeof faden;
  m = modellFake();
  // Alter ZOE-Verlauf: ein Gespräch ohne Person (aus der Zeit mit einem Konto → gehört dem Inhaber), eins mit Person und neuer Rolle,
  // eins der anderen Person (darf nie bei person-a auftauchen).
  await db.saveJson('zoe-verlauf', { gespraeche: [
    { id: 'g-alt', begonnen: J, zuletzt: J, titel: 'Altes Gespräch', nachrichten: [{ rolle: 'kevin', text: 'Frage aus dem Altbestand', zeit: J }, { rolle: 'zoe', text: 'Antwort alt', zeit: J, ran: [{ agent: 'lies_postfach', ok: true }] }] },
    { id: 'g-neu', person: 'person-a', begonnen: J, zuletzt: J, titel: 'Neues', nachrichten: [{ rolle: 'nutzer', text: 'Frage neu', zeit: J }, { rolle: 'zoe', text: 'Antwort neu', zeit: J }] },
    { id: 'g-b', person: 'person-b', begonnen: J, zuletzt: J, titel: GEHEIM, nachrichten: [{ rolle: 'nutzer', text: GEHEIM, zeit: J }] },
  ] });
});
afterAll(() => { m.zurueck(); rmSync(ordner, { recursive: true, force: true }); });

describe('ZOE auf Threads (C8)', () => {
  it('übernimmt den alten Verlauf EINMAL — Altbestand ohne Person beim Inhaber, je Person getrennt, idempotent, alter Bestand bleibt', async () => {
    const r = await rufe(faden.GET, '/api/agenten/faden?agent=zoe', sitzung('person-a'));
    expect(r.status).toBe(200);
    const liste = r.d.faeden as { id: string; agent: { art: string } }[];
    expect(liste.map(f => f.id).sort()).toEqual((await zoeFaeden('person-a')).map(f => f.id).sort());
    expect(liste).toHaveLength(2);
    expect(JSON.stringify(liste)).not.toContain(GEHEIM);
    const alt = (await zoeFaeden('person-a')).find(f => f.titel === 'Altes Gespräch')!;
    expect(alt.id).toMatch(/^fd-zv-[a-z0-9]+$/);
    expect(alt.nachrichten.map(n => [n.rolle, n.von])).toEqual([['person', 'person-a'], ['agent', 'zoe']]);
    expect(alt.fremdGelesen).toBe(true); // der alte Zug hatte das Postfach gelesen
    // zweites Lesen: nichts doppelt
    await rufe(faden.GET, '/api/agenten/faden?agent=zoe', sitzung('person-a'));
    expect(await zoeFaeden('person-a')).toHaveLength(2);
    // die andere Person sieht nur ihr eigenes Gespräch
    const b = await rufe(faden.GET, '/api/agenten/faden?agent=zoe', sitzung('person-b'));
    expect((b.d.faeden as unknown[]).length).toBe(1);
    expect(JSON.stringify(b.d)).toContain(GEHEIM);
    expect((await db.loadJson<{ gespraeche: unknown[] }>('zoe-verlauf'))!.gespraeche).toHaveLength(3);
  });

  it('kimmi mit zoeFaden: Verlauf NUR aus dem Thread (nie aus dem Browser), Antwort im Thread; „fremd gelesen“ vom Thread → Schreibendes nur Vorschlag', async () => {
    const alt = (await zoeFaeden('person-a')).find(f => f.titel === 'Altes Gespräch')!;
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['create_task', { title: 'Steuerunterlagen sortieren' }]), text('Liegt im Stapel.'));
    const r = await fragen('person-a', { message: 'Leg eine Aufgabe an: Steuerunterlagen sortieren.', zoeFaden: alt.id, verlauf: [{ rolle: 'nutzer', text: BROWSER, zeit: J }] });
    expect(r.status).toBe(200);
    expect(r.d.fadenId).toBe(alt.id);
    const anfrage = JSON.stringify(m.anfragen[0].messages);
    expect(anfrage).toContain('Frage aus dem Altbestand');
    expect(anfrage).not.toContain(BROWSER);
    expect(ergebnisse(m.anfragen[1])[0]).toMatch(/^VORGESCHLAGEN, NICHT AUSGEFÜHRT/);
    const f = (await zoeFaeden('person-a')).find(x => x.id === alt.id)!;
    expect(f.nachrichten.slice(-2).map(n => [n.rolle, n.text])).toEqual([['person', 'Leg eine Aufgabe an: Steuerunterlagen sortieren.'], ['agent', 'Liegt im Stapel.']]);
    expect(f.nachrichten.at(-1)).toMatchObject({ von: 'zoe', ki: true, werkzeuge: [{ name: 'create_task', ok: true, gestapelt: true }] });
    expect(r.d.ran).toEqual([{ agent: 'create_task', ok: true }]);
  });

  it('„neu“ legt einen ZOE-Thread an; ein fremder oder unbekannter Thread → 404, nichts geschrieben', async () => {
    m.antworten.push(text('Hallo.'));
    const r = await fragen('person-a', { message: 'Hallo ZOE', zoeFaden: 'neu', space: 'business' });
    expect(r.status).toBe(200);
    const neu = (await zoeFaeden('person-a')).find(f => f.id === r.d.fadenId)!;
    expect(neu).toMatchObject({ besitzer: 'person-a', bereich: 'business', fremdGelesen: false });
    const fremd = (await zoeFaeden('person-b'))[0];
    const x = await fragen('person-a', { message: 'Darf ich?', zoeFaden: fremd.id });
    expect(x.status).toBe(404);
    expect((await zoeFaeden('person-b'))[0].nachrichten).toHaveLength(fremd.nachrichten.length);
  });
});

describe('ZOE steuert die Heads (C3)', () => {
  let zoeId = '';
  let headFaden = '';
  it('an_head: Thread beim Head (Eltern = ZOE-Thread, Auftrag von ZOE), „gesendet“ im ZOE-Thread, Lauf in der Warteschlange', async () => {
    m.antworten.push(text('Gern.'));
    zoeId = String((await fragen('person-a', { message: 'Guten Morgen', zoeFaden: 'neu' })).d.fadenId);
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['an_head', { head: 'sales', auftrag: 'Bereite drei Nachfass-Entwürfe für offene Angebote vor.' }]), text('Ist bei Sales.'));
    const r = await fragen('person-a', { message: 'Gib das Nachfassen der Angebote an Sales.', zoeFaden: zoeId });
    expect(r.status).toBe(200);
    expect(werkzeugNamen(m.anfragen[0])).toEqual(expect.arrayContaining(['an_head', 'head_fragen']));
    expect(ergebnisse(m.anfragen[1])[0]).toMatch(/^An Head of Sales gesendet/);
    const head = (await bestand('person-a')).find(f => f.agent.art === 'head' && f.elternId === zoeId)!;
    headFaden = head.id;
    expect(head).toMatchObject({ agent: { art: 'head', headId: 'sales' }, kette: ['zoe', 'head:sales'], status: 'wartet' });
    expect(head.nachrichten[0]).toMatchObject({ rolle: 'agent', von: 'zoe', auftrag: { ziel: 'Bereite drei Nachfass-Entwürfe für offene Angebote vor.' } });
    const zoe = (await zoeFaeden('person-a')).find(f => f.id === zoeId)!;
    expect(zoe.nachrichten.find(n => n.verweis?.art === 'gesendet')).toMatchObject({ rolle: 'system', verweis: { fadenId: head.id } });
    // Reihenfolge: Frage → „gesendet“ → Antwort von ZOE
    expect(zoe.nachrichten.slice(-3).map(n => n.rolle)).toEqual(['person', 'system', 'agent']);
    const q = await db.loadJson<{ auftraege: { name: string; person: string; eingabe: { fadenId?: string } }[] }>('zoe-auftraege');
    expect(q!.auftraege.find(a => a.name === 'faden' && a.eingabe.fadenId === head.id)).toMatchObject({ person: 'person-a' });
  });
  it('der Lauf des Heads schreibt den Bericht als Verweis in den ZOE-Thread (gekapselt) — und eine neutrale Glocke', async () => {
    const d = await import('@/lib/agenten/delegation');
    m.antworten.push(text('Drei Entwürfe liegen als Vorschlag bereit.'));
    const r = await d.fadenLauf('person-a', { art: 'faden', fadenId: headFaden }, { origin: 'http://test', hintergrund: false });
    expect(r).toMatchObject({ ok: true, laufStatus: 'fertig' });
    const zoe = (await zoeFaeden('person-a')).find(f => f.id === zoeId)!;
    const bericht = zoe.nachrichten.at(-1)!;
    expect(bericht).toMatchObject({ rolle: 'system', verweis: { art: 'bericht', fadenId: headFaden }, fremd: 'agent' });
    expect(bericht.text).toMatch(/^Bericht von Head of Sales/);
    const glocke = await db.loadJson<{ eintraege?: { art: string; titel: string }[] }>('meldungen--person-a');
    expect(glocke?.eintraege?.some(x => x.art === 'agenten' && !x.titel.includes('Entwürfe'))).toBe(true);
    // Im nächsten Zug sieht ZOE den Bericht nur als gekapselte Daten.
    m.anfragen.length = 0;
    m.antworten.push(text('Sales ist fertig.'));
    await fragen('person-a', { message: 'Was hat Sales gemeldet?', zoeFaden: zoeId });
    expect(JSON.stringify(m.anfragen[0].messages)).toContain('<fremde_daten quelle=\\"agent\\">');
  });
  it('head_fragen: synchroner Head-Lauf NUR mit dem Kontext dieses Heads, nur lesende Werkzeuge, Antwort als fremd(agent), kein Thread', async () => {
    const vorher = (await bestand('person-a')).length;
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['head_fragen', { head: 'sales', frage: 'Wie steht die Pipeline?' }]), text('Zwei Deals offen.'), text('Laut Sales: zwei Deals offen.'));
    const r = await fragen('person-a', { message: 'Frag Sales, wie die Pipeline steht.', zoeFaden: zoeId });
    expect(r.status).toBe(200);
    const head = m.anfragen[1];
    expect(systemText(head)).toContain('Du bist Head of Sales');
    expect(systemText(head)).not.toContain('Du bist ZOE');
    const { LESEND } = await import('@/lib/zoe/gespraech-schutz');
    const tools = werkzeugNamen(head);
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) expect(LESEND.has(t) && t !== 'crm_vorschlag', t).toBe(true);
    expect(tools).not.toContain('an_mitarbeiter');
    expect(ergebnisse(m.anfragen[2])[0]).toMatch(/^<fremde_daten quelle="agent">\nANTWORT von Head of Sales/);
    expect((await bestand('person-a')).length).toBe(vorher);
    const { lies } = await import('@/lib/zoe/stapel');
    expect((await lies('offen')).filter(v => /Head of Sales/.test(v.anlass ?? ''))).toEqual([]);
  });
  it('Sicht: ein Konto „nur Business“ kann über ZOE keinen Privat-Head fragen oder beauftragen — und sieht keinen im Prompt', async () => {
    m.anfragen.length = 0;
    m.antworten.push(werkzeug(['head_fragen', { head: 'gesundheit', frage: 'Wie war der Schlaf?' }], ['an_head', { head: 'finanzen-privat', auftrag: 'Prüf das Budget.' }]), text('Geht nicht.'));
    const r = await fragen('team-c', { message: 'Frag den Gesundheits-Head und gib das Budget an Finanzen privat.', zoeFaden: 'neu' });
    expect(r.status).toBe(200);
    const { KATALOG } = await import('@/lib/agenten/katalog');
    const privat = KATALOG.filter(h => h.bereich === 'privat');
    const anHead = (m.anfragen[0].tools as { name: string; input_schema: { properties: { head: { enum: string[] } } } }[]).find(t => t.name === 'an_head')!;
    for (const h of privat) {
      expect(anHead.input_schema.properties.head.enum).not.toContain(h.id);
      expect(systemText(m.anfragen[0])).not.toContain(h.name);
    }
    for (const e of ergebnisse(m.anfragen[1])) expect(e).toMatch(/Nicht ausgeführt: Diesen Head gibt es für diese Person nicht/);
    expect((await bestand('team-c')).filter(f => f.agent.art === 'head')).toEqual([]);
    // Fremder Haushalt: gar kein Gespräch.
    expect((await fragen('gast', { message: 'Hallo', zoeFaden: 'neu' })).status).toBe(403);
  });
});

describe('ZOE ≤ 20 Werkzeuge (Fragerunde Teil 1 Nr. 13)', () => {
  it('kein Zug bekommt mehr als 20 — der Kern ist immer dabei, der Bereich folgt der Frage', async () => {
    const fragenListe = [
      'Wen soll ich heute anrufen?', 'Kontostand 18.500 und die Rechnung ist bezahlt.', 'Was ist im Postfach, und plane mir morgen um 9 Uhr einen Fokusblock?',
      'Schreib eine Kampagne für LinkedIn, starte die Recherche, notier im Bauplan einen Fehler, wie war mein Schlaf, setz Milch auf die Einkaufsliste.', 'Hallo',
    ];
    for (const f of fragenListe) {
      m.anfragen.length = 0;
      m.antworten.push(text('Ok.'));
      expect((await fragen('person-a', { message: f, zoeFaden: 'neu' })).status, f).toBe(200);
      const namen = werkzeugNamen(m.anfragen[0]);
      expect(namen.length, f).toBeLessThanOrEqual(20);
      for (const k of ['an_head', 'head_fragen', 'suche_arbeit', 'create_task']) expect(namen, `${f}: ${k}`).toContain(k);
    }
  });
  it('rein: höchstens 20 auch bei allen Bereichen zugleich; Bereiche aus Frage, früheren Fragen und Bezug', async () => {
    const W = await import('@/lib/zoe/werkzeug-wahl');
    const alle = new Set([...W.ZOE_DIREKT]);
    const viel = W.zoeWerkzeugWahl({ text: 'Lead Kampagne Event Dublette Rechnung Haushalt Schlaf Einkauf Termin Aufgabe Ziel Notiz Mail Gesellschaft Bauplan Agent', verfuegbar: alle });
    expect(viel.namen).toHaveLength(20);
    expect(viel.bereiche.length).toBeGreaterThan(10);
    // Reihum: jeder getroffene Bereich bekommt erst sein wichtigstes Werkzeug.
    expect(viel.namen).toEqual(expect.arrayContaining(['crm_lage', 'marketing_lage', 'events_lage', 'business_index', 'haushalt_stand', 'gesundheits_index']));
    expect(W.bereicheFuer('und für Juli?', ['Wie hoch ist der Umsatz im Juni?'])).toEqual(['finanzen']);
    expect(W.bereicheFuer('Was steht an?', [], { art: 'kontakt' })[0]).toBe('vertrieb');
    expect(W.zoeWerkzeugWahl({ text: 'Was steht an?', bezug: { art: 'firma' }, verfuegbar: alle }).namen[W.ZOE_KERN.length]).toBe('firma_akte');
    // Nur Verfügbares (KI-Schalter, Einwilligung, Haushalt): ohne Gesundheit kein Gesundheits-Werkzeug, auch wenn die Frage passt.
    const ohne = new Set([...alle].filter(n => !['gesundheits_index', 'setze_vitalwerte'].includes(n)));
    expect(W.zoeWerkzeugWahl({ text: 'Wie war mein Schlaf?', verfuegbar: ohne }).namen).not.toContain('gesundheits_index');
    // „übergeben“ (Umlaut am Wortanfang) wird erkannt, „Postfach“ ist kein Beitrag
    expect(W.bereicheFuer('Bitte übergeben')).toContain('vertrieb');
    expect(W.bereicheFuer('Was ist im Postfach?')).not.toContain('marketing');
  });
  it('jedes bisherige Werkzeug ist erreichbar — über den Kern, einen Bereich (Platz neben dem Kern) oder einen Head', async () => {
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const W = await import('@/lib/zoe/werkzeug-wahl');
    const { KATALOG } = await import('@/lib/agenten/katalog');
    const BISHERIG = [...Object.keys(WERKZEUGE).filter(n => n !== 'an_head' && n !== 'head_fragen'), 'run_agent', 'open_agent'];
    expect(BISHERIG.length).toBeGreaterThanOrEqual(60);
    const platz = W.ZOE_GRENZE - W.ZOE_KERN.length;
    const imBereich = (n: string) => W.ZOE_BEREICHE.some(b => b.werkzeuge.indexOf(n) >= 0 && b.werkzeuge.indexOf(n) < platz);
    const ueberHead = (n: string) => KATALOG.some(h => h.werkzeuge.includes(n));
    const fehlt = BISHERIG.filter(n => !(W.ZOE_KERN as readonly string[]).includes(n) && !imBereich(n) && !ueberHead(n));
    expect(fehlt).toEqual([]);
    // Und jedes Werkzeug eines Bereichs gibt es wirklich (Register, run_agent, open_agent).
    for (const n of W.ZOE_DIREKT) expect(!!WERKZEUGE[n] || n === 'run_agent' || n === 'open_agent', n).toBe(true);
  });
});

describe('Eine Quelle der Werkzeug-Beschreibungen', () => {
  it('die Agenten lesen dieselbe Stelle wie ZOE (abgeleitet, nicht abgeschrieben) — ohne Personen-Kürzel', async () => {
    const { werkzeugDefs } = await import('@/lib/zoe/werkzeug-defs');
    const { REGISTER_DEFS, agentenDef } = await import('@/lib/agenten/werkzeuge');
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const quelle = werkzeugDefs();
    for (const [n, d] of REGISTER_DEFS) {
      expect(quelle.has(n), n).toBe(true);
      expect(d.description.startsWith(quelle.get(n)!.description), n).toBe(true);
      expect(d).toEqual(agentenDef(quelle.get(n)!));
    }
    // Jedes Register-Werkzeug hat genau eine Beschreibung (an_head/head_fragen nur mit Heads).
    const mitHeads = werkzeugDefs({ heads: [{ id: 'sales', kurz: 'Sales', name: 'Head of Sales' }] });
    for (const n of Object.keys(WERKZEUGE)) expect(mitHeads.has(n), n).toBe(true);
    // Im Agenten-Bereich legt der Head den Bereich fest — Felder dafür gibt es dort nicht.
    expect(Object.keys((REGISTER_DEFS.get('create_task')!.input_schema as { properties: object }).properties)).not.toEqual(expect.arrayContaining(['wer']));
    // Keine Personen-Kürzel im Code der Beschreibungen — Zuständige sind die Kennungen des CRM-Teams DER INSTANZ (lib/crm/team.ts).
    const { readFileSync: rf } = await import('node:fs');
    for (const d of ['lib/zoe/werkzeug-defs.ts', 'lib/zoe/crm-werkzeug-defs.ts', 'lib/zoe/werkzeug-wahl.ts', 'lib/agenten/werkzeuge.ts']) expect(rf(d, 'utf8'), d).not.toMatch(/'(kevin|malin)'|\b(Kevin|Malin)\b/);
    const { TEAM, BEIDE } = await import('@/lib/crm/team');
    expect((mitHeads.get('uebergeben')!.input_schema as { properties: { an: { enum: string[] } } }).properties.an.enum).toEqual([...TEAM.map(t => t.id), BEIDE]);
    // Personen kommen zur Laufzeit (Speichernamen des Haushalts), nie fest.
    const mitPersonen = werkzeugDefs({ personen: ['person-a', 'person-b'] });
    expect((mitPersonen.get('freie_zeit')!.input_schema as { properties: { personen: { items: { enum: string[] } } } }).properties.personen.items.enum).toEqual(['person-a', 'person-b']);
    // Das ZOE-Gespräch hat keine eigenen Beschreibungen mehr.
    const { readFileSync } = await import('node:fs');
    const route = readFileSync('app/api/kimmi/route.ts', 'utf8');
    expect(route).not.toMatch(/input_schema/);
    expect(route).not.toMatch(/agentRoster/);
  });
});
