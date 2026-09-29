// ─── W7 (28.09.) — alle Kartei-Schreibwege schreiben ins Änderungsprotokoll ─────────────────────────────
// `aendereKontakte` (lib/crm/kartei-schreiben.ts): eine Sperre über die Kartei, Protokoll über `listenDiff` — wer,
// wann, welche Kennungen/Felder, NIE Werte. Geprüft: der Helfer selbst, die umgestellten Routen/Werkzeuge an echten
// Aufrufen, eine Wache gegen neue ungeschützte Schreibwege und die Sperr-Reihenfolge crm → kontakte (keine
// Verklemmung, wenn `aendereCrm` mit Lead-Folge und `aendereKontakte` gleichzeitig laufen).
// Eigener Datenordner, erfundene Konten und Daten — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { localDay } from '@/lib/zeit';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, CrmBestand } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-w7-kartei-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-w7-kartei';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

// Berliner Tag wie der Server (29.09., Paket D-A #40) — vorher UTC-Tag: zwischen 0 und 2 Uhr rot.
const H = localDay();
const J = new Date().toISOString();
type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler; PATCH?: Handler };
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const anfrage = (pfad: string, kopf: Record<string, string>, body: unknown) => new Request(`http://test${pfad}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) });
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-w7' });
const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Testa', nachname: 'Beispielfrau', eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: H, geaendertAm: H, ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({
  id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, letzteAktivitaet: '2026-01-01', ...x,
});

let db: typeof import('@/lib/store/local-db');
let prot: typeof import('@/lib/store/aenderungsprotokoll');
let speicher: typeof import('@/lib/crm/speicher');
let kartei: typeof import('@/lib/crm/kartei-schreiben');
const setzeKartei = (k: Kontakt[]) => db.saveJson('kontakte', { kontakte: k });
const setzeCrm = (x: Partial<CrmBestand>) => db.saveJson('crm', { ...speicher.leererBestand(), ...x });
const protokoll = async () => prot.protokollMonat('haus-w7', prot.monatBerlin());
/** Die Kartei-Einträge, die seit `ab` hinzugekommen sind. */
const neueEintraege = async (ab: number) => (await protokoll()).slice(ab).filter(e => e.bestand === 'kontakte');
const zaehler = async () => (await protokoll()).length;

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  prot = await import('@/lib/store/aenderungsprotokoll');
  speicher = await import('@/lib/crm/speicher');
  kartei = await import('@/lib/crm/kartei-schreiben');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
  await setzeCrm({});
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('aendereKontakte — der Helfer', () => {
  it('protokolliert Kennung (als c#…) und Feldnamen, nie Werte — auch bei Änderung an Ort und Stelle', async () => {
    await setzeKartei([person('c-w7-anna'), person('c-w7-bert')]);
    const ab = await zaehler();
    await kartei.aendereKontakte(cur => {
      const f = cur ?? { kontakte: [] };
      // Wie viele alte Wege: die Liste wird an Ort und Stelle geändert.
      const i = f.kontakte.findIndex(k => k.id === 'c-w7-anna');
      f.kontakte[i] = { ...f.kontakte[i], notiz: 'Geheimer Inhalt 4711' };
      f.kontakte.push(person('c-w7-neu'));
      return f;
    }, { art: 'person', person: 'malin' });
    const e = await neueEintraege(ab);
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ wer: 'person', person: 'malin', bestand: 'kontakte', op: 'geaendert', id: prot.protokollKennung('c-w7-anna'), felder: ['notiz'] });
    expect(e[1]).toMatchObject({ op: 'neu', id: prot.protokollKennung('c-w7-neu') });
    const text = JSON.stringify(await protokoll());
    expect(text).not.toContain('Geheimer Inhalt');
    expect(text).not.toContain('c-w7-anna');
    expect(text).not.toContain('Beispielfrau');
  });
  it('unverändert → kein Eintrag; Löschung → „geloescht“; andere Felder → eine Zeile mit dem Feldnamen', async () => {
    const ab = await zaehler();
    await kartei.aendereKontakte(cur => cur ?? { kontakte: [] });
    expect(await zaehler()).toBe(ab);
    await kartei.aendereKontakte<{ kontakte: Kontakt[]; zusatz?: string }>(cur => ({ ...(cur ?? { kontakte: [] }), zusatz: 'Wert 12345', kontakte: (cur?.kontakte ?? []).filter(k => k.id !== 'c-w7-neu') }), { art: 'system' });
    const e = await neueEintraege(ab);
    expect(e.map(x => [x.op, x.liste ?? null])).toEqual([['geloescht', null], ['geaendert', 'zusatz']]);
    expect(JSON.stringify(e)).not.toContain('12345');
  });
  it('Async-Fassung und Standard-„wer“ außerhalb einer Anfrage (System)', async () => {
    const ab = await zaehler();
    await kartei.aendereKontakteAsync(async cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === 'c-w7-bert' ? { ...k, stufe: 'angebot' as const } : k)) }));
    expect((await neueEintraege(ab))[0]).toMatchObject({ wer: 'system', op: 'geaendert', felder: ['stufe'] });
  });
});

describe('Umgestellte Schreibwege erzeugen einen Protokolleintrag (ohne Werte)', () => {
  const pruefe = async (ab: number, id: string, wer: { wer: string; person?: string }, geheim: string[] = []) => {
    const e = (await neueEintraege(ab)).filter(x => x.id === prot.protokollKennung(id));
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]).toMatchObject(wer);
    const text = JSON.stringify(await neueEintraege(ab));
    expect(text).not.toContain(id);
    for (const g of geheim) expect(text).not.toContain(g);
    return e;
  };

  it('POST /api/crm/aktivitaet (Aktivität am Kontakt)', async () => {
    await setzeKartei([person('c-w7-akt')]);
    const akt = (await import('@/app/api/crm/aktivitaet/route')) as unknown as Route;
    const ab = await zaehler();
    const r = await akt.POST!(anfrage('/api/crm/aktivitaet', sitzung('malin'), { id: 'c-w7-akt', art: 'notiz', text: 'Notiztext Zebra 77' }));
    expect(r.status).toBe(200);
    const e = await pruefe(ab, 'c-w7-akt', { wer: 'person', person: 'malin' }, ['Zebra 77']);
    expect(e[0].felder).toContain('aktivitaeten');
  });

  it('POST /api/crm/anfrage (Anfrage an bestehender Person)', async () => {
    await setzeKartei([person('c-w7-anf', { email: 'anf@example.invalid' })]);
    const anf = (await import('@/app/api/crm/anfrage/route')) as unknown as Route;
    const ab = await zaehler();
    const r = await anf.POST!(anfrage('/api/crm/anfrage', sitzung('kevin'), { aktion: 'anlegen', kontaktId: 'c-w7-anf', kanal: 'empfehlung', text: 'Anfrage Walross 5' }));
    expect(r.status).toBe(200);
    await pruefe(ab, 'c-w7-anf', { wer: 'person', person: 'kevin' }, ['Walross 5']);
  });

  it('POST /api/crm/lead (Personen-Lead setzen)', async () => {
    await setzeKartei([person('c-w7-lead')]);
    const lead = (await import('@/app/api/crm/lead/route')) as unknown as Route;
    const ab = await zaehler();
    const r = await lead.POST!(anfrage('/api/crm/lead', sitzung('kevin'), { aktion: 'setze', id: 'c-w7-lead', felder: { notiz: 'Lead-Notiz Okapi 3' } }));
    expect(r.status).toBe(200);
    const e = await pruefe(ab, 'c-w7-lead', { wer: 'person', person: 'kevin' }, ['Okapi 3']);
    expect(e[0].felder).toContain('lead');
  });

  it('uebergeben (lib/crm/uebergabe.ts) — mit ausdrücklichem wer', async () => {
    await setzeKartei([person('c-w7-ueb')]);
    const { uebergeben } = await import('@/lib/crm/uebergabe');
    const ab = await zaehler();
    const r = await uebergeben({ art: 'kontakt', id: 'c-w7-ueb', an: 'malin', notiz: 'Übergabe Tapir 9' }, 'kevin', { art: 'person', person: 'kevin' });
    expect(r.ok).toBe(true);
    const e = await pruefe(ab, 'c-w7-ueb', { wer: 'person', person: 'kevin' }, ['Tapir 9']);
    expect(e[0].felder).toEqual(expect.arrayContaining(['besitzer', 'aktivitaeten']));
  });

  it('dealAnlegen (lib/crm/deal-anlegen.ts) — Personen-Lead wird SQL', async () => {
    await setzeKartei([person('c-w7-deal')]);
    await setzeCrm({});
    const { dealAnlegen } = await import('@/lib/crm/deal-anlegen');
    const ab = await zaehler();
    const r = await dealAnlegen({ titel: 'Deal Wels', kontaktIds: ['c-w7-deal'], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, schritt: { text: 'Anrufen', datum: H }, quelle: 'bestand' }, 'kevin', J, { art: 'zoe', person: 'kevin' });
    expect(r.ok).toBe(true);
    const e = await pruefe(ab, 'c-w7-deal', { wer: 'zoe', person: 'kevin' });
    expect(e[0].felder).toContain('lead');
  });

  it('leadHebenNachGespraech (lib/crm/lead-heben.ts) — Person ohne Firma', async () => {
    await setzeKartei([person('c-w7-heb', { stufe: 'neu' })]);
    await setzeCrm({});
    const { leadHebenNachGespraech } = await import('@/lib/crm/lead-heben');
    const ab = await zaehler();
    const r = await leadHebenNachGespraech('c-w7-heb', J, 'malin', H, { art: 'person', person: 'malin' });
    expect(r?.geaendert).toBe(true);
    await pruefe(ab, 'c-w7-heb', { wer: 'person', person: 'malin' });
  });

  it('ZOE notiere_kontakt (lib/zoe/werkzeuge.ts) — steht als zoe mit Person', async () => {
    await setzeKartei([person('c-w7-zoe', { vorname: 'Zora', nachname: 'Zoetest' })]);
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const ab = await zaehler();
    const t = await WERKZEUGE.notiere_kontakt.lauf({ kontakt: 'c-w7-zoe', art: 'anruf', text: 'Gespräch Pelikan 8' }, 'test', 'kevin');
    expect(String(t)).toMatch(/^Notiert/);
    await pruefe(ab, 'c-w7-zoe', { wer: 'zoe', person: 'kevin' }, ['Pelikan 8', 'Zoetest']);
  });
});

describe('Wache: kein Kartei-Schreibweg ohne Protokoll', () => {
  // Diese Stellen schreiben die Kartei direkt UND protokollieren selbst (bzw. sind der Helfer / die CRM-Sperre).
  const ERLAUBT = new Set([
    'lib/crm/kartei-schreiben.ts', // der Helfer
    'lib/crm/speicher.ts', // aendereCrm: Kartei IN der CRM-Sperre, protokolliert selbst
    'lib/crm/abgleich.ts', 'lib/crm/loeschfristen-lauf.ts', 'lib/crm/person-bestaende.ts',
    'app/api/crm/datenschutz/route.ts', 'app/api/crm/dubletten/route.ts', 'app/api/crm/import/route.ts',
    'lib/crm/kennungen-umzug.ts', // Kennungs-Umzug (D-C #35): je Kontakt „Kennung geändert“ unter der neuen Kennung
  ]);
  const wurzel = path.resolve(__dirname, '..');
  const dateien = (d: string): string[] => readdirSync(path.join(wurzel, d)).flatMap(n => {
    const rel = path.join(d, n);
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : /\.(ts|tsx)$/.test(n) ? [rel] : [];
  });
  it('updateJson/saveJson auf „kontakte“ nur in den bekannten, selbst protokollierenden Stellen', () => {
    const muster = /\b(?:updateJson|updateJsonAsync|saveJson)\s*(?:<[^()]*?(?:\([^()]*\)[^()]*?)*>)?\(\s*'kontakte'/;
    // Kommentarzeilen zählen nicht (lib/crm/bestand-folgen.ts beschreibt den Weg nur).
    const code = (f: string) => readFileSync(path.join(wurzel, f), 'utf8').split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
    const funde = [...dateien('app'), ...dateien('lib')].filter(f => muster.test(code(f)) && !ERLAUBT.has(f.split(path.sep).join('/')));
    expect(funde).toEqual([]);
  });
  it('die selbst protokollierenden Stellen rufen protokolliere auf', () => {
    for (const f of ERLAUBT) if (f !== 'lib/crm/kartei-schreiben.ts' && f !== 'lib/crm/person-bestaende.ts') expect(readFileSync(path.join(wurzel, f), 'utf8'), f).toMatch(/protokolliere\(/);
  });
});

describe('Sperr-Reihenfolge crm → kontakte: keine Verklemmung', () => {
  const mitFrist = <T>(p: Promise<T>, ms = 5000) => Promise.race([p, new Promise<never>((_, nein) => setTimeout(() => nein(new Error('Verklemmung: nicht fertig geworden')), ms))]);
  it('aendereCrm (gelöschter Deal → Personen-Lead zurück) und aendereKontakte gleichzeitig — beide laufen durch', async () => {
    const lead = { status: 'sql' as const, kriterien: deal('x').qualifizierung, chanceId: 'ch-w7-weg', sqlAm: J };
    await setzeKartei([person('c-w7-folge', { lead }), person('c-w7-parallel')]);
    await setzeCrm({ chancen: [deal('ch-w7-weg', { kontaktIds: ['c-w7-folge'] })] });
    const laeufe: Promise<unknown>[] = [];
    for (let i = 0; i < 5; i++) {
      laeufe.push(kartei.aendereKontakte(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === 'c-w7-parallel' ? { ...k, notiz: `Lauf ${i}` } : k)) }), { art: 'system' }));
      if (i === 2) laeufe.push(speicher.aendereCrm(b => ({ ...b, chancen: b.chancen.filter(c => c.id !== 'ch-w7-weg') }), { art: 'person', person: 'kevin' }));
    }
    // Erlaubte Richtung: die Kartei aus einer CRM-Änderung heraus (crm außen, kontakte innen).
    laeufe.push(speicher.aendereCrmAsync(async b => {
      await kartei.aendereKontakte(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === 'c-w7-parallel' ? { ...k, prio: 'A' } : k)) }), { art: 'system' });
      return b;
    }));
    await mitFrist(Promise.all(laeufe));
    const k = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte;
    expect(k.find(x => x.id === 'c-w7-folge')!.lead?.chanceId).toBeUndefined();
    expect(k.find(x => x.id === 'c-w7-parallel')).toMatchObject({ notiz: 'Lauf 4', prio: 'A' });
    expect((await db.loadJson<CrmBestand>('crm'))!.chancen.some(c => c.id === 'ch-w7-weg')).toBe(false);
  });
});
