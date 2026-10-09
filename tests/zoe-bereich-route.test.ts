// ─── ZOE: Bereich je Vorschlag und je Merksatz — Server, Route, Gespräch (09.10. spät) ─────────────────────────────────────
// Befund live: unter „Privat“ stand „Fakt merken — … gibt es nicht mehr“ über eine Firma aus dem Business. Geprüft:
//   • `lege` ordnet zu (Bezug → Inhalt → Gespräch → unklar), der Hinweis an ZOE nennt den Ort und den Weg in die Markttraktion;
//   • GET /api/zoe/stapel?space=… trennt SERVERSEITIG (Wächter „Sicht Privat bekommt keinen Business-Vorschlag“); „unklar“ (auch Altbestand)
//     sehen beide Sichten — aber nur die Person, der der Vorschlag gehört (Kevin 09.10. spät: der Kopf kennt nur noch Privat · Business);
//   • Bereich von Hand setzen mit Stand (409 bei veraltetem Stand), Freigeben mit Stand, „alle freigeben“ je Sicht;
//   • der freigegebene Merksatz trägt den Bereich, das Gespräch bekommt nur Merksätze seines Bereichs und neutrale.
// Eigener Datenordner, erfundene Konten, Firmen und Personen; das Modell ist gemockt.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-bereich-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-zoe-bereich';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const modell: { antworten: unknown[][]; aufrufe: { system: string; tools?: { name: string }[] }[] } = { antworten: [], aufrufe: [] };
vi.mock('@/lib/anthropic', async importOriginal => {
  const echt = await importOriginal<typeof import('@/lib/anthropic')>();
  return {
    ...echt, hasAnthropicKey: () => true, guthabenLeer: () => false,
    askText: vi.fn(async (o: { system: string; tools?: { name: string }[] }) => {
      modell.aufrufe.push({ system: o.system, tools: o.tools });
      const c = modell.antworten.shift() ?? [{ type: 'text', text: 'Fertig.' }];
      const tool = (c as { type: string }[]).some(b => b.type === 'tool_use');
      return { ok: true, status: 200, text: tool ? '' : 'Fertig.', stopReason: tool ? 'tool_use' : 'end_turn', raw: { content: c } };
    }),
  };
});
vi.mock('@/lib/brain', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/brain')>()), gatherBrain: vi.fn(async () => ({})), promptBrain: () => '' }));
vi.mock('@/lib/zoe/vault', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/zoe/vault')>()), brainAnweisung: async () => '' }));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

type Handler = (r: Request) => Promise<Response>;
type V = { id: string; werkzeug: string; bereich?: string; bereichQuelle?: string; bereichNennt?: { art: string; id: string }[]; bereichVon?: string; stand: string; status: string; titel: string };
const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', haushalt = 'haus') => ({ id, speicher, email: `${speicher}@test.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const T = '2026-09-01T08:00:00.000Z';
let db: typeof import('@/lib/store/local-db');
let route: { GET: Handler; POST: Handler };
let stapel: typeof import('@/lib/zoe/stapel');
let ausfuehren: typeof import('@/lib/zoe/ausfuehren');

const holen = async (person: string, q = '') => {
  const r = await route.GET(new Request(`http://test/api/zoe/stapel${q}`, { headers: sitzung(person) }));
  return { status: r.status, d: await r.json() as { vorschlaege: V[]; offen: number; unklar: number; space: string } };
};
const senden = async (person: string, body: Record<string, unknown>) => {
  const r = await route.POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: r.status, d: await r.json() as { ok: boolean; error?: string; vorschlag?: V; ergebnis?: string; erledigt?: number } };
};
const merke = (satz: string, thema: string, bereich: 'privat' | 'business' | null) =>
  ausfuehren.fuehreAus('fakt_merken', { thema, satz, raum: 'gemeinsam' }, 'http://test', { person: 'kevin', vorschlagen: true, anlass: satz, bereich });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('crm', {
    ...speicher.leererBestand(),
    firmen: [
      { id: 'f-pelikan', name: 'Pelikanwerk GmbH', rolle: 'zielkunde', geaendert: T },
      { id: 'f-garten', name: 'Gartenhof Selbsthilfe', rolle: 'kunde', geaendert: T },
    ],
    // Die Firma „Gartenhof“ hat nur einen Deal der Selbstständigkeit (Privat-Einheit) → ihr Bereich ist Privat.
    chancen: [{ id: 'ch-garten', titel: 'Beratung', kontaktIds: [], firmaId: 'f-garten', firma: 'Gartenhof Selbsthilfe', art: 'retainer', wert: { betrag: 1, basis: 'monat' }, stufe: 'bedarf', historie: [], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'ja', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: T, geaendert: T }],
  });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-zora', vorname: 'Zora', nachname: 'Probestein', firmaId: 'f-pelikan', firma: 'Pelikanwerk GmbH', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' },
    { id: 'c-geheim', vorname: 'Gesine', nachname: 'Schutzmann', stufe: 'kalt', aktivitaeten: [], eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } },
  ] });
  route = (await import('@/app/api/zoe/stapel/route')) as unknown as typeof route;
  stapel = await import('@/lib/zoe/stapel');
  ausfuehren = await import('@/lib/zoe/ausfuehren');
});
beforeEach(async () => {
  await db.saveJson('zoe-stapel', { vorschlaege: [] });
  await db.saveJson('zoe-gedaechtnis', { fakten: [] });
  modell.antworten.length = 0; modell.aufrufe.length = 0;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('lege ordnet zu — der Befund', () => {
  it('im Gespräch „Privat“: ein Fakt über eine Business-Firma liegt unter Business; ZOE sagt, wo, und bietet den CRM-Weg an', async () => {
    const r = await merke('nein pelikanwerk gibts nicht mehr', 'Pelikanwerk', 'privat');
    expect(r.gestapelt).toBe(true);
    expect(r.text).toMatch(/unter „Business“ \(nicht unter „Privat“\)/);
    expect(r.text).toMatch(/crm_vorschlag/);
    expect(r.text).toContain('f-pelikan');
    const v = (await stapel.lies('offen'))[0];
    expect(v).toMatchObject({ bereich: 'business', bereichQuelle: 'inhalt', bereichNennt: [{ art: 'firma', id: 'f-pelikan' }] });
  });
  it('ohne bekannte Namen: der Bereich des Gesprächs; unter „Alles“ unklar (kein Feld)', async () => {
    await merke('keine Termine vor 10', 'Termine', 'privat');
    await merke('Montags immer Teamrunde', 'Teamrunde', null);
    const [b, a] = await stapel.lies('offen');
    expect(a).toMatchObject({ bereich: 'privat', bereichQuelle: 'gespraech' });
    expect(b.bereich).toBeUndefined();
  });
  it('Kontakt mit vollem Namen → Bereich seiner Firma; Firma einer Privat-Einheit → Privat; Art.-18-Personen zählen nie', async () => {
    await merke('Zora Probestein ist jetzt Geschäftsführerin', 'Zora Probestein', 'privat');
    await merke('Gartenhof Selbsthilfe zahlt jetzt per Lastschrift', 'Gartenhof', 'business');
    await merke('Gesine Schutzmann zieht nach Bremen', 'Gesine Schutzmann', null);
    const [geheim, garten, zora] = await stapel.lies('offen');
    expect(zora).toMatchObject({ bereich: 'business', bereichNennt: [{ art: 'kontakt', id: 'c-zora' }] });
    expect(garten).toMatchObject({ bereich: 'privat', bereichQuelle: 'inhalt' });
    expect(geheim.bereich).toBeUndefined();
    expect(geheim.bereichNennt).toBeUndefined();
  });
  it('ein Bereich, den der Aufrufer mitgibt, zählt nicht — die Regel entscheidet', async () => {
    const v = await stapel.lege({ werkzeug: 'notiz_anlegen', gruppe: 'gesundheit', titel: 'x', nachher: 'y', eingabe: {}, person: 'kevin', bereich: 'business', bereichQuelle: 'hand' });
    expect(v).toMatchObject({ bereich: 'privat', bereichQuelle: 'bezug' });
  });
  it('Vorschlag mit Bezug auf eine Aufgabe → Bereich ihres Space', async () => {
    await db.saveJson('tasks', {
      projects: [{ id: 'p1', title: 'Projekt', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T, updatedAt: T, spaceId: 'kdv' }],
      tasks: [{ id: 'a-kdv', projectId: 'p1', title: 'Angebot', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T, updatedAt: T, spaceId: 'kdv' }],
      listen: [], statusEigen: [], gruppen: [], vorlagen: [],
    });
    const v = await stapel.lege({ werkzeug: 'zoe_aufgabe', gruppe: 'aufgaben', titel: 'ZOE-Vorschlag', nachher: 'Entwurf', eingabe: {}, person: 'kevin', bezug: { art: 'aufgabe', id: 'a-kdv' } }, { gespraech: 'privat' });
    expect(v).toMatchObject({ bereich: 'business', bereichQuelle: 'bezug', bereichOrt: { id: 'kdv' } });
  });
});

describe('GET /api/zoe/stapel — Trennung serverseitig', () => {
  beforeEach(async () => {
    await merke('nein pelikanwerk gibts nicht mehr', 'Pelikanwerk', 'privat'); // business
    await merke('keine Termine vor 10', 'Termine', 'privat'); // privat
    // Altbestand ohne Bereich (wie vor dem Update)
    const s = (await db.loadJson<{ vorschlaege: Record<string, unknown>[] }>('zoe-stapel'))!;
    await db.saveJson('zoe-stapel', { vorschlaege: [...s.vorschlaege, { id: 'v-alt', zeit: T, tag: '2026-09-01', werkzeug: 'fakt_merken', gruppe: 'gedaechtnis', titel: 'Fakt merken', nachher: 'Alt: alt', eingabe: { thema: 'Alt', satz: 'alt' }, person: 'kevin', quelle: 'gespraech', status: 'offen' }] });
  });
  it('Wächter: Sicht Privat bekommt keinen Business-Vorschlag — und umgekehrt; unklare (Altbestand) sehen beide', async () => {
    const p = await holen('kevin', '?space=privat&alle=1');
    expect(p.status).toBe(200);
    expect(p.d.vorschlaege.map(v => v.bereich ?? 'unklar').sort()).toEqual(['privat', 'unklar']);
    expect(p.d.vorschlaege.some(v => v.bereich === 'business')).toBe(false);
    expect(JSON.stringify(p.d)).not.toMatch(/pelikanwerk/i);
    expect(p.d.unklar).toBe(1);
    const b = await holen('kevin', '?space=business');
    expect(b.d.vorschlaege.map(v => v.bereich ?? 'unklar').sort()).toEqual(['business', 'unklar']);
    expect(b.d.offen).toBe(2);
    expect(JSON.stringify(b.d)).not.toMatch(/Termine/);
    expect(b.d.vorschlaege.find(v => !v.bereich)?.id).toBe('v-alt');
  });
  it('ohne Sicht (älterer Aufruf, space=alles) alles, auch den Altbestand als unklar — jeder mit Stand', async () => {
    for (const q of ['', '?space=alles']) {
      const a = await holen('kevin', q);
      expect(a.d.vorschlaege.length).toBe(3);
      expect(a.d.unklar).toBe(1);
      expect(a.d.vorschlaege.every(v => typeof v.stand === 'string' && v.stand.length > 6)).toBe(true);
    }
  });
  it('ungültige Sicht → 400; die andere Person sieht die Vorschläge gar nicht', async () => {
    expect((await holen('kevin', '?space=irgendwas')).status).toBe(400);
    expect((await holen('malin', '?space=business')).d.vorschlaege).toEqual([]);
    expect((await holen('malin', '?space=privat')).d.vorschlaege).toEqual([]); // auch der unklare gehört nur seiner Person
    expect((await holen('malin')).d.vorschlaege).toEqual([]);
  });
  it('ein unklarer Vorschlag des Systems (ohne Person) steht für jede Person im Haushalt in beiden Sichten', async () => {
    await stapel.lege({ werkzeug: 'notiz_anlegen', gruppe: 'wissen', titel: 'Systemnotiz', nachher: 'Wochenlage', eingabe: { titel: 'Wochenlage' }, quelle: 'lauf' });
    for (const p of ['kevin', 'malin']) for (const q of ['?space=privat', '?space=business']) {
      expect((await holen(p, q)).d.vorschlaege.map(v => v.titel), `${p} ${q}`).toContain('Systemnotiz');
    }
  });
});

describe('Bereich wählen (POST aktion „bereich“) und Freigeben mit Stand', () => {
  it('unklar → Business von Hand; veralteter Stand 409; fremde Person 404; danach Freigabe nur mit aktuellem Stand; der Merksatz trägt den Bereich', async () => {
    await merke('Montags immer Teamrunde', 'Teamrunde', null);
    const [v] = (await holen('kevin')).d.vorschlaege;
    expect(v.bereich).toBeUndefined();
    expect((await senden('kevin', { aktion: 'bereich', id: v.id, bereich: 'business', stand: 'veraltet' })).status).toBe(409);
    expect((await senden('malin', { aktion: 'bereich', id: v.id, bereich: 'business', stand: v.stand })).status).toBe(404);
    expect((await senden('kevin', { aktion: 'bereich', id: v.id, bereich: 'irgendwo', stand: v.stand })).status).toBe(400);
    const r = await senden('kevin', { aktion: 'bereich', id: v.id, bereich: 'business', stand: v.stand });
    expect(r.status).toBe(200);
    expect(r.d.vorschlag).toMatchObject({ bereich: 'business', bereichQuelle: 'hand', bereichVon: 'kevin' });
    expect(r.d.vorschlag!.stand).not.toBe(v.stand);
    // Jetzt unter Business — und nicht mehr in der Sicht Privat.
    expect((await holen('kevin', '?space=business')).d.vorschlaege.map(x => x.id)).toEqual([v.id]);
    expect((await holen('kevin', '?space=privat')).d.vorschlaege).toEqual([]);
    // Freigeben mit dem ALTEN Stand → 409, nichts gemerkt.
    const alt = await senden('kevin', { id: v.id, entscheidung: 'freigeben', stand: v.stand });
    expect(alt.status).toBe(409);
    expect((await db.loadJson<{ fakten: unknown[] }>('zoe-gedaechtnis'))?.fakten ?? []).toEqual([]);
    // Mit dem neuen Stand → freigegeben, der Merksatz liegt im Bereich Business.
    const ok = await senden('kevin', { id: v.id, entscheidung: 'freigeben', stand: r.d.vorschlag!.stand });
    expect(ok.status).toBe(200);
    expect(ok.d.ergebnis).toMatch(/Gemerkt/);
    const f = (await db.loadJson<{ fakten: { thema: string; bereich?: string }[] }>('zoe-gedaechtnis'))!.fakten;
    expect(f).toEqual([expect.objectContaining({ thema: 'Teamrunde', bereich: 'business' })]);
    // Ein entschiedener Vorschlag bekommt keinen Bereich mehr.
    expect((await senden('kevin', { aktion: 'bereich', id: v.id, bereich: 'privat' })).status).toBe(409);
  });
  it('Freigeben ohne Stand geht wie bisher; ein unklarer Vorschlag wird ein neutraler Merksatz', async () => {
    await merke('Montags immer Teamrunde', 'Teamrunde', null);
    const [v] = (await holen('kevin')).d.vorschlaege;
    expect((await senden('kevin', { id: v.id, entscheidung: 'freigeben' })).status).toBe(200);
    const f = (await db.loadJson<{ fakten: { bereich?: string }[] }>('zoe-gedaechtnis'))!.fakten;
    expect(f).toHaveLength(1);
    expect(f[0].bereich).toBeUndefined();
  });
  it('„alle freigeben“ mit Sicht nimmt nur Vorschläge dieser Sicht', async () => {
    await db.saveJson('tasks', {
      projects: [{ id: 'p1', title: 'Projekt', category: 'business', owner: 'both', color: '#DE9E63', tags: [], archived: false, createdAt: T, updatedAt: T, spaceId: 'kdv' }],
      tasks: [
        { id: 'a-b', projectId: 'p1', title: 'Business', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T, updatedAt: T, spaceId: 'kdv', zoe: { status: 'wartet_freigabe', von: 'kevin' } },
        { id: 'a-p', projectId: 'sonstige-privat', title: 'Privat', status: 'todo', priority: 'medium', assignee: 'kevin', tags: [], subTasks: [], dependencies: [], sortOrder: 1, createdAt: T, updatedAt: T, spaceId: 'privat', zoe: { status: 'wartet_freigabe', von: 'kevin' } },
      ],
      listen: [], statusEigen: [], gruppen: [], vorlagen: [],
    });
    const { ZOE_AUFGABE_WERKZEUG } = await import('@/lib/aufgaben/zoe');
    for (const id of ['a-b', 'a-p']) await stapel.lege({ werkzeug: ZOE_AUFGABE_WERKZEUG, gruppe: 'aufgaben', titel: `Vorschlag ${id}`, nachher: 'Notiz', eingabe: { entwurf: `Ein Entwurf ${id}` }, person: 'kevin', quelle: 'lauf', bezug: { art: 'aufgabe', id } });
    const liste = await stapel.lies('offen');
    expect(Object.fromEntries(liste.map(v => [v.bezug!.id, v.bereich]))).toEqual({ 'a-b': 'business', 'a-p': 'privat' });
    const id = (a: string) => liste.find(v => v.bezug?.id === a)!.id;
    // Versucht wird nur, was in der Sicht liegt (ob die Art es übernimmt, prüft ihr eigener Test) — der Business-Vorschlag bleibt unberührt.
    const r = await senden('kevin', { alle: true, space: 'privat' }) as unknown as { status: number; d: { ergebnisse: { id: string }[] } };
    expect(r.status).toBe(200);
    expect(r.d.ergebnisse.map(e => e.id)).toEqual([id('a-p')]);
    const b = await senden('kevin', { alle: true, space: 'business' }) as unknown as { status: number; d: { ergebnisse: { id: string }[] } };
    expect(b.d.ergebnisse.map(e => e.id)).toEqual([id('a-b')]);
    expect((await senden('kevin', { alle: true, space: 'falsch' })).status).toBe(400);
  });
});

describe('Gedächtnis je Bereich — EINE Stelle (lies) für Prompt, frag_gedaechtnis und Route', () => {
  beforeEach(async () => {
    await db.saveJson('zoe-gedaechtnis', { fakten: [
      { id: 'f-p', zeit: T, tag: '2026-09-01', art: 'vorliebe', thema: 'Urlaub', satz: 'PRIVAT-MERKSATZ', raum: 'gemeinsam', bereich: 'privat' },
      { id: 'f-b', zeit: T, tag: '2026-09-01', art: 'firma', thema: 'Pelikanwerk', satz: 'BUSINESS-MERKSATZ', raum: 'gemeinsam', bereich: 'business' },
      { id: 'f-n', zeit: T, tag: '2026-09-01', art: 'sonstiges', thema: 'Allgemein', satz: 'NEUTRAL-MERKSATZ', raum: 'gemeinsam' },
    ] });
  });
  it('lies({ bereich }) und die Route ?space=', async () => {
    const g = await import('@/lib/zoe/gedaechtnis');
    expect((await g.lies({ raum: 'kevin', bereich: 'privat' })).map(f => f.id).sort()).toEqual(['f-n', 'f-p']);
    expect((await g.lies({ raum: 'kevin', bereich: 'business' })).map(f => f.id).sort()).toEqual(['f-b', 'f-n']);
    expect((await g.lies({ raum: 'kevin' })).length).toBe(3);
    const gr = await import('@/app/api/zoe/gedaechtnis/route');
    const r = await gr.GET(new Request('http://test/api/zoe/gedaechtnis?space=privat', { headers: sitzung('kevin') }));
    const t = await r.text();
    expect(t).toContain('PRIVAT-MERKSATZ');
    expect(t).not.toContain('BUSINESS-MERKSATZ');
    expect((await gr.GET(new Request('http://test/api/zoe/gedaechtnis?space=quatsch', { headers: sitzung('kevin') }))).status).toBe(400);
  });
  it('frag_gedaechtnis im Gespräch Privat findet keinen Business-Merksatz', async () => {
    const r = await ausfuehren.fuehreAus('frag_gedaechtnis', {}, 'http://test', { person: 'kevin', bereich: 'privat' });
    expect(r.text).toContain('PRIVAT-MERKSATZ');
    expect(r.text).toContain('NEUTRAL-MERKSATZ');
    expect(r.text).not.toContain('BUSINESS-MERKSATZ');
  });
  it('ZOE-Gespräch: der Prompt trägt nur Merksätze des Bereichs; ein Fakt über eine Firma landet unter Business und crm_vorschlag ist angeboten', async () => {
    modell.antworten.push([{ type: 'tool_use', id: 't1', name: 'fakt_merken', input: { thema: 'Pelikanwerk', satz: 'Pelikanwerk gibt es nicht mehr', art: 'firma', raum: 'gemeinsam' } }]);
    const { POST } = await import('@/app/api/kimmi/route');
    const r = await POST(new Request('http://test/api/kimmi', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ message: 'nein pelikanwerk gibts nicht mehr', space: 'privat', bereich: 'privat' }) }));
    expect(r.status).toBe(200);
    const erster = modell.aufrufe[0];
    expect(erster.system).toContain('PRIVAT-MERKSATZ');
    expect(erster.system).toContain('NEUTRAL-MERKSATZ');
    expect(erster.system).not.toContain('BUSINESS-MERKSATZ');
    expect(erster.system).toMatch(/WOHIN DAMIT/);
    expect((erster.tools ?? []).map(t => t.name)).toContain('crm_vorschlag');
    const v = (await stapel.lies('offen')).find(x => x.werkzeug === 'fakt_merken')!;
    expect(v).toMatchObject({ bereich: 'business', bereichQuelle: 'inhalt' });
    // Der Zähler der Antwort gilt für die Sicht des Gesprächs (Privat) — der Business-Vorschlag zählt dort nicht.
    const d = await r.json() as { stapelOffen?: number };
    expect(d.stapelOffen).toBe(0);
  });
  it('ZOE-Gespräch unter „Alles“ (bereich: alles): alle Merksätze; ohne `bereich` gilt `space` wie bisher', async () => {
    const { POST } = await import('@/app/api/kimmi/route');
    await POST(new Request('http://test/api/kimmi', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ message: 'Wie geht es weiter?', space: 'privat', bereich: 'alles' }) }));
    expect(modell.aufrufe[0].system).toContain('BUSINESS-MERKSATZ');
    expect(modell.aufrufe[0].system).toContain('PRIVAT-MERKSATZ');
    modell.aufrufe.length = 0;
    await POST(new Request('http://test/api/kimmi', { method: 'POST', headers: sitzung('kevin'), body: JSON.stringify({ message: 'Wie geht es weiter?', space: 'business' }) }));
    expect(modell.aufrufe[0].system).toContain('BUSINESS-MERKSATZ');
    expect(modell.aufrufe[0].system).not.toContain('PRIVAT-MERKSATZ');
  });
});

describe('Konto löschen: wer entschieden bzw. den Bereich gewählt hat, wird „[gelöscht]“', () => {
  it('eigene Vorschläge fallen weg; Vorschläge des Systems bleiben ohne den Speichernamen', async () => {
    await db.saveJson('zoe-stapel', { vorschlaege: [
      { id: 'v-sys', zeit: T, tag: '2026-09-01', werkzeug: 'notiz_anlegen', gruppe: 'wissen', titel: 'System', nachher: 'x', eingabe: {}, status: 'abgelehnt', entschiedenVon: 'malin', bereich: 'business', bereichQuelle: 'hand', bereichVon: 'malin' },
      { id: 'v-malin', zeit: T, tag: '2026-09-01', werkzeug: 'fakt_merken', gruppe: 'gedaechtnis', titel: 'Eigen', nachher: 'y', eingabe: {}, person: 'malin', status: 'offen' },
    ] });
    const kd = await import('@/lib/datenschutz/konto-daten');
    await kd.kontoLoeschen('malin');
    const l = (await db.loadJson<{ vorschlaege: Record<string, unknown>[] }>('zoe-stapel'))!.vorschlaege;
    expect(l.map(v => v.id)).toEqual(['v-sys']);
    expect(l[0]).toMatchObject({ entschiedenVon: '[gelöscht]', bereichVon: '[gelöscht]', bereich: 'business' });
    expect(JSON.stringify(l)).not.toContain('malin');
  });
});
