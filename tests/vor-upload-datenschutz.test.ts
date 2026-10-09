// ─── Wächter „Datenschutz vor dem Upload“ (08.10. spät) ─────────────────────────────────────────────────────────────
// Eiserne Regel 1 (keine echten Daten im Code), Plattform-Regel (keine festen Namen/Firmen), Trennung serverseitig, Art. 9:
//   1. Altbestände mit privatem Inhalt sind aus dem Repo (erstes Finanz-Cockpit, tote Daten-Dateien); öffentliche Texte neutral.
//   2. Feste Prompt-Texte von ZOE (Gespräch, Empfang, Morgen-/Abendlauf, Tageslauf, Grundauftrag) ohne Namen, ohne
//      Gesundheitsangaben einer Person, ohne Lebenspläne und ohne feste Firmen — Name aus dem Konto, Firmen aus den Einheiten.
//   3. Tageslauf, Arbeits- und Gesundheits-Schalter je Person: „Sicht Malin bekommt nichts aus Kevins Beständen“ (und umgekehrt).
//   4. Stammdaten: Steuer-ID, SV-Nummer, IBAN nur für die Person selbst — auf dem Server; Schreiben nur mit Stand, 403/413.
// Eigener Datenordner, erfundene Konten und Werte, Netz gesperrt, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WURZEL = path.resolve(__dirname, '..');
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-vor-upload-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-vor-upload';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

type Handler = (r: Request) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler; PUT?: Handler; PATCH?: Handler };
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) =>
  new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const lies = (rel: string) => readFileSync(path.join(WURZEL, rel), 'utf8');
/** Quelltext ohne Kommentarzeilen — die Wächter prüfen, was als Text an das Modell bzw. nach außen geht. */
const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(z => !/^\s*(\/\/|\*)/.test(z)).map(z => z.replace(/\s\/\/ .*$/, '')).join('\n');

const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt = 'haus-vu') =>
  ({ id, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });

let db: typeof import('@/lib/store/local-db');
const echtesFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'Kevin Pruef', 'inhaber'),
    konto('k2', 'malin', 'Malin Pruef', 'mitglied'),
    konto('k3', 'fremd', 'Fremd Pruef', 'mitglied', 'anderes-haus'),
  ], einladungen: [] });
});
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

describe('1. Altbestände mit privatem Inhalt sind raus, öffentliche Texte neutral', () => {
  it('kein erstes Finanz-Cockpit, keine Zurufe-Datei, kein Datenteil in os-data', () => {
    expect(existsSync(path.join(WURZEL, 'public/finanz-dashboard.html'))).toBe(false);
    expect(existsSync(path.join(WURZEL, 'components/os/FinanzDashboardView.tsx'))).toBe(false);
    expect(existsSync(path.join(WURZEL, 'lib/make-one/zurufe-data.ts'))).toBe(false);
    expect(readdirSync(path.join(WURZEL, 'public')).filter(n => /\.html?$/i.test(n))).toEqual([]);
    expect(lies('lib/make-one/os-data.ts')).not.toMatch(/FOCUS_NOW|MSI_PILLARS|LIFE_WHEEL|export const [A-Z_]+ *(:|=) *\[/);
  });
  it('alte Adressen des Cockpits leiten zum Altbestand weiter', async () => {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    for (const q of ['/finanz-dashboard.html', '/os/finanzen/dashboard']) expect(regeln.find(r => r.source === q)?.destination, q).toMatch(/^\/os\/finanzen\?.*u=selbst/);
  });
  it('Manifest und Meta-Beschreibung nennen keine Personen', () => {
    for (const t of [lies('public/manifest.webmanifest'), lies('app/layout.tsx')]) expect(t).not.toMatch(/Kevin|Malin/);
    expect(JSON.parse(lies('public/manifest.webmanifest')).description).toBe('MAKE OS — Life & Business OS');
  });
});

describe('2. ZOE-Grundauftrag ohne Persönliches', () => {
  const VERBOTEN_IM_PROMPT = /\b(Kevin|Malin|Kevins|Malins)\b|\bSir\b|Rücken|Bandscheib|Psoria|Cannabis|\bReha\b|ASTARNA|POINCAP|CapOS|KD Management|KEMARIS|Ma\+Ke|Familien-KI|Roboter/;
  it('blockAuftrag (steht vor jedem Agenten-Prompt) nennt keine Person, keine Beschwerde, keine Lebenspläne', async () => {
    const { blockAuftrag } = await import('@/lib/brain');
    const t = blockAuftrag();
    expect(t).toMatch(/DEIN AUFTRAG/);
    expect(t).not.toMatch(VERBOTEN_IM_PROMPT);
    expect(t).not.toMatch(/Firmen zu kaufen|Maschinen/);
  });
  it('feste Prompt-Texte in Gespräch, Empfang, Morgen-/Abendlauf und Tageslauf: keine Namen, keine Gesundheit, keine festen Firmen', () => {
    // + Beleg lesen (09.10., Nahtstellen Finanzen: dort standen ein Personenname und feste Firmen im Prompt).
    for (const d of ['app/api/kimmi/route.ts', 'app/api/zoe/empfang/route.ts', 'app/api/zoe/morgen/route.ts', 'app/api/tageslauf/route.ts', 'app/api/fokus/route.ts', 'lib/zoe/grundauftrag.ts', 'app/api/beleg/route.ts']) {
      const t = ohneKommentare(lies(d));
      const fund = t.split('\n').filter(z => VERBOTEN_IM_PROMPT.test(z));
      expect(fund, d).toEqual([]);
    }
  });
  it('die Agenten-Liste im ZOE-Prompt (agentRoster) nennt keine Person und keine Beschwerde', async () => {
    const { agentRoster } = await import('@/lib/make-one/agents-data');
    expect(agentRoster().split('\n').filter(z => VERBOTEN_IM_PROMPT.test(z) || /\bHaut\b/.test(z))).toEqual([]);
  });
  it('keine Personen-Weiche „wer nicht X ist, heißt Y“ mehr in Gespräch, Empfang, Morgenlauf, Haushalts-Werkzeugen', () => {
    for (const d of ['app/api/kimmi/route.ts', 'app/api/zoe/empfang/route.ts', 'app/api/zoe/morgen/route.ts', 'app/api/tageslauf/route.ts', 'lib/zoe/werkzeuge.ts']) {
      expect(ohneKommentare(lies(d)), d).not.toMatch(/=== 'malin' \? '(Malin|MALIN)'|=== 'malin' \? .*'Kevin'/);
    }
  });
  it('Name aus dem Konto, Gesellschaften aus den Einheiten (Register als Daten gerahmt)', async () => {
    const g = await import('@/lib/zoe/grundauftrag');
    const { KERN_EINHEITEN } = await import('@/lib/einheiten');
    expect(await g.vornameVon('malin')).toBe('Malin');
    expect(await g.vornameVon('unbekannt-x')).toBe('Unbekannt-x');
    expect(g.anredeSatz('Malin')).toContain('Malin');
    const z = g.gesellschaftenZeilen(['Beispiel Holding GmbH', '<b>Böse</b>']);
    for (const e of KERN_EINHEITEN) expect(z).toContain(e.label);
    expect(z).toMatch(/<daten quelle="gesellschaften">Beispiel Holding GmbH · b Böse \/b<\/daten>/);
    expect(g.gesellschaftenZeilen()).not.toContain('<daten');
  });
});

describe('3. Tageslauf, Arbeits- und Gesundheits-Schalter je Person', () => {
  const MARKE_K = 'MARKE-TAGESLAUF-KEVIN';
  const MARKE_M = 'MARKE-TAGESLAUF-MALIN';
  const lauf = (marke: string) => ({ id: `lauf-${marke}`, art: 'kurz', gestartet: new Date().toISOString(), fertig: new Date().toISOString(), schritte: [], ausrichtung: { gruss: marke, tagesform: 'gelb' } });
  let tl: Route; let am: Route;
  beforeAll(async () => {
    await db.saveJson('tageslauf', { laeufe: [lauf(MARKE_K)] }); // Altbestand ohne Suffix = Inhaber
    await db.saveJson('tageslauf--malin', { laeufe: [lauf(MARKE_M)] });
    tl = (await import('@/app/api/tageslauf/route')) as unknown as Route;
    am = (await import('@/app/api/state/arbeitsmodus/route')) as unknown as Route;
  });

  it('eigenerSpeicher: Altbestand ohne Suffix nur beim Inhaber, sonst immer mit Suffix', async () => {
    const { eigenerSpeicher } = await import('@/lib/zoe/raum');
    expect(eigenerSpeicher('tageslauf', 'kevin', 'kevin')).toBe('tageslauf');
    expect(eigenerSpeicher('tageslauf', 'malin', 'kevin')).toBe('tageslauf--malin');
    expect(eigenerSpeicher('tageslauf', 'kevin', 'lena')).toBe('tageslauf--kevin');
    expect(eigenerSpeicher('tageslauf', 'lena', 'lena')).toBe('tageslauf--lena');
  });

  it('GET: jede Person nur ihre eigenen Läufe — Sicht Malin bekommt nichts aus Kevins Tageslauf (und umgekehrt)', async () => {
    const m = await (await tl.GET!(anfrage('/api/tageslauf?fuer=kevin', sitzung('malin')))).text();
    expect(m).toContain(MARKE_M);
    expect(m).not.toContain(MARKE_K);
    const k = await (await tl.GET!(anfrage('/api/tageslauf', sitzung('kevin')))).text();
    expect(k).toContain(MARKE_K);
    expect(k).not.toContain(MARKE_M);
    expect((await tl.GET!(anfrage('/api/tageslauf', sitzung('fremd')))).status).toBe(403);
    expect((await tl.GET!(anfrage('/api/tageslauf', dienst()))).status).toBe(403);
  });

  it('POST als Malin schreibt nur in ihren Bestand — Kevins bleibt bit-gleich', async () => {
    const vorher = JSON.stringify(await db.loadJson('tageslauf'));
    const r = await tl.POST!(anfrage('/api/tageslauf', sitzung('malin'), 'POST', { art: 'puls' }));
    expect(r.status).toBe(200);
    expect(JSON.stringify(await db.loadJson('tageslauf'))).toBe(vorher);
    expect(((await db.loadJson<{ laeufe: unknown[] }>('tageslauf--malin'))?.laeufe ?? []).length).toBe(2);
  }, 60_000);

  it('Arbeits- und Gesundheits-Schalter: je Person, die andere sieht nichts davon', async () => {
    const { localDay } = await import('@/lib/zeit');
    await db.saveJson('gesundheitszeit', { [localDay()]: { sessions: [{ von: '05:07', bis: null }] } });
    const m = await (await am.GET!(anfrage('/api/state/arbeitsmodus', sitzung('malin')))).json() as { gesundheit: { an: boolean; seit: string | null } };
    expect(m.gesundheit).toMatchObject({ an: false, seit: null });
    const k = await (await am.GET!(anfrage('/api/state/arbeitsmodus', sitzung('kevin')))).json() as { gesundheit: { an: boolean; seit: string | null } };
    expect(k.gesundheit).toMatchObject({ an: true, seit: '05:07' });
    expect((await am.POST!(anfrage('/api/state/arbeitsmodus', sitzung('malin'), 'POST', { aktion: 'an', was: 'gesundheit' }))).status).toBe(200);
    expect(await db.loadJson('gesundheitszeit--malin')).not.toBeNull();
    // Kevins Zähler blieb, wie er war.
    expect(JSON.stringify(await db.loadJson('gesundheitszeit'))).toContain('05:07');
    expect((await am.GET!(anfrage('/api/state/arbeitsmodus', sitzung('fremd')))).status).toBe(403);
  });

  it('Register, Konto-Daten und Messlatte kennen die neuen Bestände', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    for (const n of ['tageslauf', 'tageslauf--malin', 'gesundheitszeit--malin']) expect(registerEintrag(n)?.kategorie, n).toContain('art9');
    for (const n of ['arbeitsmodus', 'arbeitsmodus--malin']) expect(registerEintrag(n)?.bezug, n).toBe('haushalt');
    const { PERSON_BESTAENDE } = await import('@/lib/datenschutz/konto-daten');
    for (const b of ['tageslauf', 'arbeitsmodus', 'gesundheitszeit']) expect(PERSON_BESTAENDE.some(x => x.basis === b), b).toBe(true);
  });
});

describe('4. Stammdaten: persönliche Kennungen nur für die Person selbst (Server)', () => {
  const ST_K = 'MARKE-STEUERID-KEVIN', SV_K = 'MARKE-SVNR-KEVIN', ST_M = 'MARKE-STEUERID-MALIN';
  // Die bekannte Beispiel-IBAN, zur Laufzeit zusammengesetzt (tests/repo-sauber.test.ts sucht echte IBANs in versionierten Dateien).
  const IBAN = ['DE89', '3704', '0044', '0532', '0130', '00'].join('');
  let sd: Route;
  type Ansicht = { personen: (Record<string, string>)[]; konten: (Record<string, string>)[] };
  const holen = async (kopf: Record<string, string>) => (await sd.GET!(anfrage('/api/state/stammdaten', kopf))).text();
  const patch = (person: string, body: unknown) => sd.PATCH!(anfrage('/api/state/stammdaten', sitzung(person), 'PATCH', body));
  const standVon = async (person: string, liste: 'personen' | 'konten', id: string) => (JSON.parse(await holen(sitzung(person))) as Ansicht)[liste].find(x => x.id === id)!.stand;

  beforeAll(async () => {
    await db.saveJson('stammdaten', {
      firmen: [], partner: [],
      personen: [
        { id: 'p-k', name: 'Kevin Pruef', steuerId: ST_K, svNummer: SV_K, adresse: 'Musterweg 1' },
        { id: 'p-m', name: 'Malin Pruef', steuerId: ST_M },
      ],
      konten: [{ id: 'k-1', name: 'Konto Pruef', inhaber: 'Kevin Pruef', iban: IBAN }],
    });
    sd = (await import('@/app/api/state/stammdaten/route')) as unknown as Route;
  });

  it('GET: Malin bekommt Kevins Steuer-ID/SV-Nummer gar nicht und die IBAN nur maskiert — ihre eigenen schon', async () => {
    const t = await holen(sitzung('malin'));
    for (const m of [ST_K, SV_K, IBAN]) expect(t).not.toContain(m);
    expect(t).toContain(ST_M);
    expect(t).toContain('DE89 •••• •••• 3000');
    const a = JSON.parse(t) as Ansicht;
    expect(a.personen.find(x => x.id === 'p-k')).toMatchObject({ geschuetzt: 'steuerId,svNummer', adresse: 'Musterweg 1' });
    expect(a.personen.every(x => typeof x.stand === 'string')).toBe(true);
    // Gegenprobe: Kevin bekommt seine (und nicht Malins).
    const k = await holen(sitzung('kevin'));
    for (const m of [ST_K, SV_K, IBAN]) expect(k).toContain(m);
    expect(k).not.toContain(ST_M);
    // Systemlauf (Dienstweg ohne Person): niemandes Kennungen.
    const sys = await holen(dienst());
    for (const m of [ST_K, SV_K, ST_M, IBAN]) expect(sys).not.toContain(m);
  });

  it('PATCH: fremde Kennung ändern oder fremden Satz mit Kennungen löschen → 403, nichts geändert; Antwort ohne fremde Werte', async () => {
    const vorher = JSON.stringify(await db.loadJson('stammdaten'));
    const stand = await standVon('malin', 'personen', 'p-k');
    for (const body of [
      { liste: 'personen', ops: [{ op: 'teil', id: 'p-k', felder: { steuerId: 'ueberschrieben' }, stand }] },
      { liste: 'personen', ops: [{ op: 'teil', id: 'p-k', felder: { svNummer: null }, stand }] },
      { liste: 'personen', ops: [{ op: 'delete', id: 'p-k', stand }] },
      { liste: 'konten', ops: [{ op: 'teil', id: 'k-1', felder: { iban: ['DE02', '1203', '0000', '0000', '2020', '51'].join('') }, stand: await standVon('malin', 'konten', 'k-1') }] },
      { liste: 'personen', ops: [{ op: 'upsert', eintrag: { id: 'p-neu', name: 'Kevin Pruef', steuerId: 'untergeschoben' } }] },
    ]) {
      const r = await patch('malin', body);
      expect(r.status, JSON.stringify(body)).toBe(403);
      const t = await r.text();
      for (const m of [ST_K, SV_K, IBAN]) expect(t).not.toContain(m);
      expect(JSON.stringify(await db.loadJson('stammdaten'))).toBe(vorher);
    }
  });

  it('PATCH: gemeinsame Felder dürfen alle — Umbenennen ändert den Besitz nie (Kennungen bleiben bei der Person)', async () => {
    const r = await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-k', felder: { name: 'Malin Pruef Zwei', adresse: 'Neuer Weg 2' }, stand: await standVon('malin', 'personen', 'p-k') }] });
    expect(r.status).toBe(200);
    const t = await r.text();
    for (const m of [ST_K, SV_K]) expect(t).not.toContain(m);
    const gespeichert = (await db.loadJson<{ personen: Record<string, string>[] }>('stammdaten'))!.personen.find(x => x.id === 'p-k')!;
    expect(gespeichert).toMatchObject({ steuerId: ST_K, svNummer: SV_K, adresse: 'Neuer Weg 2', person: 'kevin' });
    expect(await holen(sitzung('malin'))).not.toContain(ST_K);
    expect(await holen(sitzung('kevin'))).toContain(ST_K);
  });

  it('PATCH: die eigene Kennung setzt die Person selbst; ohne Stand oder mit altem Stand 409; über der Grenze 413 (nie gekürzt)', async () => {
    const stand = await standVon('malin', 'personen', 'p-m');
    expect((await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-m', felder: { svNummer: 'MARKE-SVNR-MALIN' }, stand }] })).status).toBe(200);
    expect(await holen(sitzung('kevin'))).not.toContain('MARKE-SVNR-MALIN');
    expect(await holen(sitzung('malin'))).toContain('MARKE-SVNR-MALIN');
    // Ohne Stand und mit altem Stand: 409, die Antwort trägt keine fremden Werte.
    const ohne = await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-m', felder: { notiz: 'x' } }] });
    expect(ohne.status).toBe(409);
    const alt = await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-k', felder: { notiz: 'x' }, stand }] });
    expect(alt.status).toBe(409);
    expect(await alt.text()).not.toContain(ST_K);
    const vorher = JSON.stringify(await db.loadJson('stammdaten'));
    const lang = await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-m', felder: { notiz: 'x'.repeat(2001) }, stand: await standVon('malin', 'personen', 'p-m') }] });
    expect(lang.status).toBe(413);
    expect(JSON.stringify(await db.loadJson('stammdaten'))).toBe(vorher);
  });

  it('neue Karte: leer anlegen, benennen, dann die Kennung eintragen — sie gehört der Person, die sie einträgt', async () => {
    expect((await patch('malin', { liste: 'personen', ops: [{ op: 'upsert', eintrag: { id: 'p-neu-2', name: '' } }] })).status).toBe(200);
    expect((await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-neu-2', felder: { name: 'Angehörige Pruef' }, stand: await standVon('malin', 'personen', 'p-neu-2') }] })).status).toBe(200);
    expect((await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-neu-2', felder: { steuerId: 'MARKE-STEUERID-NEU' }, stand: await standVon('malin', 'personen', 'p-neu-2') }] })).status).toBe(200);
    expect(await holen(sitzung('malin'))).toContain('MARKE-STEUERID-NEU');
    expect(await holen(sitzung('kevin'))).not.toContain('MARKE-STEUERID-NEU');
    // Eine leere Karte auf den Namen einer anderen Person: die Kennung trägt nur diese Person ein.
    expect((await patch('malin', { liste: 'personen', ops: [{ op: 'upsert', eintrag: { id: 'p-neu-3', name: 'Kevin Pruef' } }] })).status).toBe(200);
    expect((await patch('malin', { liste: 'personen', ops: [{ op: 'teil', id: 'p-neu-3', felder: { steuerId: 'untergeschoben' }, stand: await standVon('malin', 'personen', 'p-neu-3') }] })).status).toBe(403);
  });

  it('Zugang: fremder Haushalt 403, Dienstweg ohne Person darf nicht schreiben, PUT gibt es nicht mehr', async () => {
    expect((await patch('fremd', { liste: 'firmen', ops: [{ op: 'upsert', eintrag: { id: 'f-x', name: 'X' } }] })).status).toBe(403);
    const sys = await sd.PATCH!(anfrage('/api/state/stammdaten', dienst(), 'PATCH', { liste: 'firmen', ops: [{ op: 'upsert', eintrag: { id: 'f-x', name: 'X' } }] }));
    expect([401, 403]).toContain(sys.status);
    expect(sd.PUT).toBeUndefined();
  });
});
