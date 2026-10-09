// ─── EINE Konto-Sicht (09.10., E4 — Kevin: „Ja, Privates bleibt privat“) ──────────────────────────────────────────────────────
// Wächter „Sicht Business bekommt nichts aus Privat“: ein Konto mit `finanzRecht: 'business'` (Partner) sieht den Privat-Bereich des
// Haushalts nirgends — Aufgaben-Route (Lesen und Schreiben), Anlegen, Export, Dateien, Glocke, Lichtfäden, Seil, Kapazität, Delegation,
// ZOE-Kontext (der Prompt an das Modell, nachgebaut über tests/fixtures/ki-fake.ts), `meine_aufgaben`, `projekt_unterlagen`, Suche
// (`suche_arbeit`), Stapel. Volle Mitglieder sehen unverändert alles (Gegenprobe). Dazu die reine Regel (lib/zugang/konto-sicht.ts) und
// die Agenten-Sicht (`sichtLaden`), die jetzt dieselbe Stelle nimmt — mit denselben Werten wie vorher.
// Eigener Datenordner, erfundene Konten (`@example.invalid`) und Marken, kein Netz, kein echter KI-Aufruf.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-konto-sicht-'));
Object.assign(process.env, {
  MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-konto-sicht', ANTHROPIC_API_KEY: 'test-schluessel', MAKE_OS_KI_VORGABE: 'kompatibel',
  MAKE_OS_BRAIN_INDEX: path.join(ordner, 'brain-index.sqlite'), MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: path.join(ordner, 'vault'),
});
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_MODEL;
delete process.env.MAKE_OS_KI_ANBIETER_TOR;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  // Der Zug von /api/kimmi verbucht seine Kosten nach der Antwort — erst danach den Ordner räumen.
  await new Promise(r => setTimeout(r, 800));
  rmSync(ordner, { recursive: true, force: true, maxRetries: 3 });
});

const HAUS = 'haus-ks';
/** Marken aus dem Privat-Bereich des Haushalts — keine darf je bei `partner` ankommen. */
const PRIVAT = {
  aufgabe: 'KONTOSICHT-PRIVAT-AUFGABE',
  notiz: 'KONTOSICHT-PRIVAT-NOTIZ',
  unter: 'KONTOSICHT-PRIVAT-UNTERAUFGABE',
  selbst: 'KONTOSICHT-SELBST-AUFGABE',
  projekt: 'KONTOSICHT-PRIVAT-PROJEKT',
  liste: 'KONTOSICHT-PRIVAT-LISTE',
  status: 'KONTOSICHT-PRIVAT-STATUS',
  vorlage: 'KONTOSICHT-PRIVAT-VORLAGE',
  datei: 'KONTOSICHT-PRIVAT-DATEI',
  vorschlag: 'KONTOSICHT-PRIVAT-VORSCHLAG',
};
const BUSINESS = { aufgabe: 'KONTOSICHT-BUSINESS-AUFGABE', datei: 'KONTOSICHT-BUSINESS-DATEI', vorschlag: 'KONTOSICHT-BUSINESS-VORSCHLAG' };
const lecks = (text: string) => Object.entries(PRIVAT).filter(([, m]) => text.includes(m)).map(([n]) => n);

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
const KONTEN = [
  konto('k1', 'inhaberin', 'inhaber', { haushalt: HAUS }),
  konto('k2', 'zweite', 'mitglied', { haushalt: HAUS }),
  konto('k3', 'partner', 'mitglied', { haushalt: HAUS, finanzRecht: 'business' }),
  konto('k4', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
  konto('k5', 'kunde', 'mitglied'),
];
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
type H = (r: Request, ctx?: unknown) => Promise<Response>;
async function rufe(h: H, pfad: string, person: string, method = 'GET', body?: unknown): Promise<{ status: number; text: string; d: Record<string, unknown> }> {
  const r = await h(new Request(`http://test${pfad}`, { method, headers: sitzung(person), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), { params: Promise.resolve({}) });
  const text = await r.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(text) as Record<string, unknown>; } catch { /* kein JSON */ }
  return { status: r.status, text, d };
}

let db: typeof import('@/lib/store/local-db');
let H0 = '';
const T0 = '2026-10-01T08:00:00.000Z';
const aufgabe = (id: string, title: string, projectId: string, spaceId: string, extra: Record<string, unknown> = {}) =>
  ({ id, projectId, title, status: 'todo', priority: 'critical', assignee: 'inhaberin', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, spaceId, ...extra });
const projekt = (id: string, title: string, spaceId: string) =>
  ({ id, title, category: spaceId === 'privat' ? 'joint' : 'business', owner: 'both', color: '#58D9CD', tags: [], archived: false, createdAt: T0, updatedAt: T0, spaceId });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  H0 = (await import('@/lib/zeit')).localDay();
  await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
  await db.saveJson('tasks', {
    projects: [projekt('p-privat', PRIVAT.projekt, 'privat'), projekt('p-biz', 'Kontosicht Geschäft', 'kdv'), projekt('p-selbst', 'Kontosicht Selbst', 'kdc')],
    listen: [{ id: 'l-privat', projektId: 'p-privat', titel: PRIVAT.liste, sortOrder: 0 }, { id: 'l-biz', projektId: 'p-biz', titel: 'Kontosicht Liste', sortOrder: 0 }],
    statusEigen: [{ id: 'st-privat', spaceId: 'privat', label: PRIVAT.status, farbe: '#123456', basis: 'todo', sortOrder: 0 }],
    vorlagen: [{ id: 'vl-privat', art: 'liste', titel: PRIVAT.vorlage, spaceId: 'privat', inhalt: {} }],
    tasks: [
      aufgabe('t-privat', PRIVAT.aufgabe, 'p-privat', 'privat', { listeId: 'l-privat', notiz: PRIVAT.notiz, dueDate: H0 }),
      aufgabe('t-privat-u', PRIVAT.unter, 'p-privat', 'privat', { parentId: 't-privat', listeId: 'l-privat' }),
      aufgabe('t-selbst', PRIVAT.selbst, 'p-selbst', 'kdc', { dueDate: H0 }),
      // Altbestand: eine Privat-Aufgabe, für die das Partner-Konto zuständig ist (heute lehnt der Schreibweg das ab) — die Glocke darf sie nie nennen.
      aufgabe('t-privat-alt', PRIVAT.aufgabe, 'p-privat', 'privat', { assignee: 'partner', dueDate: H0 }),
      aufgabe('t-biz', BUSINESS.aufgabe, 'p-biz', 'kdv', { listeId: 'l-biz', dueDate: H0 }),
    ],
  });
  await db.saveJson(`aufgaben-dateien--${HAUS}`, { eintraege: [
    { id: 'd-ks-privat', art: 'sonstig', projektId: 'p-privat', aufgabeId: 't-privat', bereich: 'privat', datei: { name: `${PRIVAT.datei}.pdf`, typ: 'application/pdf', groesse: 10, verschluesselt: false }, hochgeladenAm: T0, hochgeladenVon: 'inhaberin' },
    { id: 'd-ks-biz', art: 'sonstig', projektId: 'p-biz', bereich: 'business', datei: { name: `${BUSINESS.datei}.pdf`, typ: 'application/pdf', groesse: 10, verschluesselt: false }, hochgeladenAm: T0, hochgeladenVon: 'inhaberin' },
  ] });
  await db.saveJson('delegation-runde', { zeit: new Date().toISOString(), privatAnzahl: 0, vorschlaege: [
    { taskId: 't-privat', titel: PRIVAT.aufgabe, empfehlung: 'bleibt', warum: 'x' },
    { taskId: 't-biz', titel: BUSINESS.aufgabe, empfehlung: 'bleibt', warum: 'x' },
  ] });
  const { lege } = await import('@/lib/zoe/stapel');
  // Vorschläge des Systems (ohne Person): einer im Privat-Bereich, einer sicher geschäftlich (Markttraktion).
  await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: PRIVAT.vorschlag, nachher: PRIVAT.vorschlag, eingabe: { title: PRIVAT.vorschlag, space: 'privat' }, quelle: 'lauf' });
  await lege({ werkzeug: 'create_task', gruppe: 'aufgaben', titel: `${PRIVAT.vorschlag}-ohne-angabe`, nachher: PRIVAT.vorschlag, eingabe: { title: PRIVAT.vorschlag }, quelle: 'lauf' });
  await lege({ werkzeug: 'notiere_kontakt', gruppe: 'markttraktion', titel: BUSINESS.vorschlag, nachher: BUSINESS.vorschlag, eingabe: { text: BUSINESS.vorschlag }, quelle: 'lauf' });
}, 60_000);

describe('Die reine Regel (lib/zugang/konto-sicht.ts)', () => {
  it('Tabelle: volles Mitglied, Partner „nur Business“, Testkunde, fremder Haushalt, Haupt-Inhaber ohne Haushalt-Eintrag', async () => {
    const { kontoSichtAus, privatAusblenden, bereichErlaubt } = await import('@/lib/zugang/konto-sicht');
    const st = { konten: KONTEN as never[] };
    const voll = kontoSichtAus(st, 'zweite');
    expect(voll).toMatchObject({ imHaushalt: true, privat: true, business: true, nurBusiness: false, vollesMitglied: true, privatFinanzen: true, haushalt: HAUS, rolle: 'mitglied', inhaber: false });
    expect(voll.bereiche).toEqual(['privat', 'business']);
    const p = kontoSichtAus(st, 'partner');
    expect(p).toMatchObject({ imHaushalt: true, privat: false, business: true, nurBusiness: true, vollesMitglied: false, privatFinanzen: false, finanzRecht: 'business' });
    expect(p.bereiche).toEqual(['business']);
    expect(privatAusblenden(p)).toBe(true);
    expect(bereichErlaubt(p, 'privat')).toBe(false);
    expect(bereichErlaubt(p, 'business')).toBe(true);
    for (const x of ['gast', 'kunde', 'niemand']) expect(kontoSichtAus(st, x), x).toMatchObject({ imHaushalt: false, privat: false, business: false, bereiche: [], vollesMitglied: false, privatFinanzen: false });
    expect(kontoSichtAus(st, 'inhaberin')).toMatchObject({ inhaber: true, privat: true, vollesMitglied: true });
    // Haupt-Inhaber ohne Haushalt-Eintrag: einziger im Haushalt — sieht Privat (wie bisher seine Aufgaben), ist aber kein „volles Mitglied“
    // für Bestände je Haushalt (wie bisher `haushaltFuer`).
    const allein = kontoSichtAus({ konten: [konto('k9', 'solo', 'inhaber')] as never[] }, 'solo');
    expect(allein).toMatchObject({ imHaushalt: true, privat: true, nurBusiness: false, vollesMitglied: false, privatFinanzen: false });
    // Systemlauf ohne Konto-Sicht: nichts ausblenden.
    expect(privatAusblenden(null)).toBe(false);
  });

  it('Agenten-Bereich: `sichtLaden` nimmt die EINE Stelle — dieselben Werte wie vorher (Haushalt, volles Mitglied, Finanzzugang, Einwilligung)', async () => {
    const { sichtLaden } = await import('@/lib/agenten/faeden-server');
    const nichts = { imHaushalt: false, vollesMitglied: false, privatFinanzen: false, gesundheit: { verarbeiten: false, ki: false } };
    expect(await sichtLaden('zweite')).toMatchObject({ person: 'zweite', imHaushalt: true, vollesMitglied: true, privatFinanzen: true });
    expect((await sichtLaden('zweite')).gesundheit.ki).toBe(false); // ohne Einwilligung (b)
    expect(await sichtLaden('partner')).toMatchObject({ imHaushalt: true, vollesMitglied: false, privatFinanzen: false });
    for (const x of ['gast', 'kunde', 'UNGÜLTIG']) expect(await sichtLaden(x), x).toMatchObject(nichts);
    const { headsFuer } = await import('@/lib/agenten/sicht');
    expect(headsFuer(await sichtLaden('partner')).every(h => h.bereich === 'business')).toBe(true);
    expect(headsFuer(await sichtLaden('zweite')).some(h => h.bereich === 'privat')).toBe(true);
  });

  it('Aufgaben-Bestand ohne Privat-Bereich (rein): Aufgaben samt Kette, Selbstständigkeit, Projekte, Listen, Status, Vorlagen', async () => {
    const { ohnePrivatBereich, aufgabeImPrivat, listeImPrivat } = await import('@/lib/aufgaben/bereich-sicht');
    const roh = (await db.loadJson<import('@/types/tasks').TasksState>('tasks'))!;
    const o = ohnePrivatBereich(roh);
    expect(o.tasks.map(t => t.id)).toEqual(['t-biz']);
    expect(o.projects.map(p => p.id)).toEqual(['p-biz']);
    expect(o.listen!.map(l => l.id)).toEqual(['l-biz']);
    expect(o.statusEigen).toEqual([]);
    expect(o.vorlagen).toEqual([]);
    expect(lecks(JSON.stringify(o))).toEqual([]);
    // Unteraufgabe ohne eigenen Space erbt über die Kette; Liste eines unbekannten Projekts gilt als privat (nie auf Verdacht zeigen).
    const nachId = new Map([['a', { id: 'a', spaceId: 'privat' }], ['b', { id: 'b', parentId: 'a' }]]);
    expect(aufgabeImPrivat({ id: 'b', parentId: 'a' }, nachId)).toBe(true);
    expect(listeImPrivat({ projektId: 'p-weg' }, new Map())).toBe(true);
    expect(listeImPrivat({ projektId: 'sonstige-kdv' }, new Map())).toBe(false);
    expect(listeImPrivat({ projektId: 'sonstige-privat' }, new Map())).toBe(true);
  });

  it('Stapel (rein): Vorschläge des Systems sieht ein Konto „nur Business“ nur, wenn sie sicher geschäftlich sind', async () => {
    const { vorschlagPrivat, vorschlagSichtbar } = await import('@/lib/zoe/stapel');
    expect(vorschlagPrivat({ gruppe: 'markttraktion' })).toBe(false);
    expect(vorschlagPrivat({ gruppe: 'aufgaben', bezug: { art: 'crm' } })).toBe(false);
    expect(vorschlagPrivat({ gruppe: 'gesundheit' })).toBe(true);
    expect(vorschlagPrivat({ gruppe: 'haushalt' })).toBe(true);
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: { space: 'business' } })).toBe(false);
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: { spaceId: 'kdv' } })).toBe(false);
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: { spaceId: 'kdc' } })).toBe(true); // Selbstständigkeit = Privat
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: { einheit: 'Selbstständigkeit' } })).toBe(true);
    expect(vorschlagPrivat({ gruppe: 'aufgaben', eingabe: {} })).toBe(true); // ohne Angabe: im Zweifel privat
    const sys = { gruppe: 'aufgaben', eingabe: { space: 'privat' } };
    expect(vorschlagSichtbar(sys, 'p', true, false)).toBe(false);
    expect(vorschlagSichtbar(sys, 'p', true, true)).toBe(true);
    expect(vorschlagSichtbar(sys, 'p', true)).toBe(true); // ohne Angabe: Verhalten von vorher
    expect(vorschlagSichtbar({ gruppe: 'markttraktion' }, 'p', true, false)).toBe(true);
    expect(vorschlagSichtbar({ ...sys, person: 'p' }, 'p', true, false)).toBe(true); // eigene bleiben eigene
  });

  it('Meldungen (rein): ein Konto „nur Business“ erfährt nie etwas über eine Privat-Aufgabe', async () => {
    const { meldungenBerechnen } = await import('@/lib/aufgaben/speicher');
    const personen = [{ speicher: 'inhaberin', name: 'I' }, { speicher: 'partner', name: 'P', nurBusiness: true }, { speicher: 'zweite', name: 'Z' }];
    const leer = { projects: [], tasks: [] };
    const t = (id: string, spaceId: string, assignee: string) => aufgabe(id, `Titel ${id}`, 'p', spaceId, { assignee }) as never;
    const m = meldungenBerechnen(leer, { projects: [], tasks: [t('a', 'privat', 'partner'), t('b', 'kdv', 'partner'), t('c', 'privat', 'zweite')] }, [], 'inhaberin', personen);
    expect(m.map(x => `${x.an}:${x.bezug?.id ?? ''}`).sort()).toEqual(['partner:b', 'zweite:c']);
  });
});

describe('Aufgaben-Route: lesen', () => {
  it('GET /api/state/tasks — Partner: kein Privat (Aufgaben, Projekte, Listen, Status, Vorlagen, Spaces); volle Mitglieder unverändert', async () => {
    const R = (await import('@/app/api/state/tasks/route')) as unknown as { GET: H };
    for (const q of ['', '?papierkorb=1']) {
      const p = await rufe(R.GET, `/api/state/tasks${q}`, 'partner');
      expect(p.status).toBe(200);
      expect(lecks(p.text), q).toEqual([]);
      expect(p.text).toContain(BUSINESS.aufgabe);
      const spaces = (p.d.spaces as { id: string; bereich: string }[]).map(s => s.id);
      expect(spaces).not.toContain('privat');
      expect(spaces).not.toContain('kdc');
      expect(spaces).toContain('kdv');
    }
    const z = await rufe(R.GET, '/api/state/tasks', 'zweite');
    for (const m of [PRIVAT.aufgabe, PRIVAT.unter, PRIVAT.selbst, PRIVAT.projekt, PRIVAT.liste, PRIVAT.status, PRIVAT.vorlage]) expect(z.text, m).toContain(m);
    expect((z.d.spaces as { id: string }[]).map(s => s.id)).toEqual(expect.arrayContaining(['privat', 'kdc', 'kdv']));
  });

  it('ladeAufgabenSicht, verborgene Aufgaben, Export, Glocke, Lichtfäden, Seil, Kapazität, Delegation, Heute', async () => {
    const { ladeAufgabenSicht, verborgeneAufgabenFuer } = await import('@/lib/aufgaben/sicht');
    expect(lecks(JSON.stringify(await ladeAufgabenSicht('partner')))).toEqual([]);
    expect(JSON.stringify(await ladeAufgabenSicht('zweite'))).toContain(PRIVAT.aufgabe);
    expect(JSON.stringify(await ladeAufgabenSicht(null))).toContain(PRIVAT.aufgabe); // Systemlauf: unverändert
    expect([...await verborgeneAufgabenFuer('partner')].sort()).toEqual(['t-privat', 't-privat-alt', 't-privat-u', 't-selbst']);
    expect([...await verborgeneAufgabenFuer('zweite')]).toEqual([]);
    const wege: [string, () => Promise<{ GET: H }>][] = [
      ['/api/aufgaben/export', () => import('@/app/api/aufgaben/export/route') as never],
      ['/api/meldungen', () => import('@/app/api/meldungen/route') as never],
      ['/api/lichtfaeden', () => import('@/app/api/lichtfaeden/route') as never],
      ['/api/seil', () => import('@/app/api/seil/route') as never],
      ['/api/kapazitaet', () => import('@/app/api/kapazitaet/route') as never],
      ['/api/delegation', () => import('@/app/api/delegation/route') as never],
      ['/api/heute/anstehend', () => import('@/app/api/heute/anstehend/route') as never],
    ];
    for (const [pfad, laden] of wege) {
      const { GET } = await laden();
      const p = await rufe(GET, pfad, 'partner');
      expect(lecks(p.text), `${pfad} (${p.status})`).toEqual([]);
    }
    // Gegenprobe: dieselben Wege zeigen volle Mitglieder das Private (Export, Lichtfäden, Delegation).
    for (const [pfad, laden] of wege.filter(([p]) => ['/api/aufgaben/export', '/api/lichtfaeden', '/api/delegation'].includes(p))) {
      const { GET } = await laden();
      expect((await rufe(GET, pfad, 'zweite')).text, pfad).toContain(PRIVAT.aufgabe);
    }
    // Die Delegations-Runde zeigt dem Partner nur die Business-Aufgabe.
    const { GET } = (await import('@/app/api/delegation/route')) as unknown as { GET: H };
    const d = await rufe(GET, '/api/delegation', 'partner');
    expect(((d.d.runde as { vorschlaege: { taskId: string }[] }).vorschlaege).map(v => v.taskId)).toEqual(['t-biz']);
  });

  it('Aufgaben-Dateien: der Partner sieht die des Business (vorher gar keine), Privat nie — Liste, Download, Export, ZOE-Unterlagen', async () => {
    const R = (await import('@/app/api/aufgaben/dateien/route')) as unknown as { GET: H };
    const biz = await rufe(R.GET, '/api/aufgaben/dateien?projektId=p-biz', 'partner');
    expect(biz.status).toBe(200);
    expect(biz.text).toContain(BUSINESS.datei);
    const priv = await rufe(R.GET, '/api/aufgaben/dateien?projektId=p-privat', 'partner');
    expect(lecks(priv.text)).toEqual([]);
    expect((await rufe(R.GET, '/api/aufgaben/dateien?id=d-ks-privat', 'partner')).status).toBe(404);
    expect((await rufe(R.GET, '/api/aufgaben/dateien?projektId=p-privat', 'zweite')).text).toContain(PRIVAT.datei);
    const E = (await import('@/app/api/aufgaben/export/route')) as unknown as { GET: H };
    const ex = await rufe(E.GET, '/api/aufgaben/export', 'partner');
    expect(ex.text).toContain(BUSINESS.datei);
    expect(lecks(ex.text)).toEqual([]);
    const W = await import('@/lib/zoe/werkzeuge');
    const u = (input: Record<string, unknown>, p: string) => W.WERKZEUGE.projekt_unterlagen.lauf(input, 'http://test', p);
    expect(await u({ projekt: 'p-biz' }, 'partner')).toContain(BUSINESS.datei);
    const pu = await u({ projekt: 'p-privat' }, 'partner');
    expect(lecks(pu)).toEqual([]);
    expect(pu).toMatch(/kein Projekt/);
    expect(lecks(await W.WERKZEUGE.datei_lesen.lauf({ datei: 'd-ks-privat' }, 'http://test', 'partner'))).toEqual([]);
    expect(await u({ projekt: 'p-privat' }, 'zweite')).toContain(PRIVAT.datei);
  });
});

describe('Aufgaben-Route: schreiben', () => {
  const R = () => import('@/app/api/state/tasks/route') as unknown as Promise<{ PATCH: H }>;
  const stand = async () => JSON.stringify(await db.loadJson('tasks'));

  it('Partner: Privates ändern/löschen → 404, nach Privat anlegen/verschieben → 403 — der Bestand bleibt bit-gleich', async () => {
    const { PATCH } = await R();
    const vorher = await stand();
    const faelle: [string, unknown, number][] = [
      ['Privat-Aufgabe ändern', { ops: [{ op: 'upsert', task: { ...aufgabe('t-privat', 'umbenannt', 'p-privat', 'privat') } }] }, 404],
      ['Unteraufgabe ändern', { ops: [{ op: 'upsert', task: { ...aufgabe('t-privat-u', 'umbenannt', 'p-privat', 'privat', { parentId: 't-privat' }) } }] }, 404],
      ['Selbstständigkeit ändern', { ops: [{ op: 'upsert', task: { ...aufgabe('t-selbst', 'umbenannt', 'p-selbst', 'kdc') } }] }, 404],
      ['Privat-Aufgabe löschen', { ops: [{ op: 'delete', id: 't-privat' }] }, 404],
      ['Privat-Projekt ändern', { struktur: { projekte: [{ op: 'upsert', eintrag: projekt('p-privat', 'umbenannt', 'privat') }] } }, 404],
      ['Privat-Liste ändern', { struktur: { listen: [{ op: 'upsert', eintrag: { id: 'l-privat', projektId: 'p-privat', titel: 'x', sortOrder: 0 } }] } }, 404],
      ['neu in Privat', { ops: [{ op: 'upsert', task: aufgabe('t-neu-privat', 'Neu', 'sonstige-privat', 'privat') }] }, 403],
      ['neu in der Selbstständigkeit', { ops: [{ op: 'upsert', task: aufgabe('t-neu-selbst', 'Neu', 'sonstige-kdc', 'kdc') }] }, 403],
      ['Business nach Privat verschieben', { ops: [{ op: 'upsert', task: aufgabe('t-biz', BUSINESS.aufgabe, 'sonstige-privat', 'privat', { listeId: null }) }] }, 403],
      ['unter eine Privat-Aufgabe hängen', { ops: [{ op: 'upsert', task: aufgabe('t-neu-u', 'Neu', 'p-privat', 'privat', { parentId: 't-privat' }) }] }, 403],
      ['neues Projekt in Privat', { struktur: { projekte: [{ op: 'upsert', eintrag: projekt('p-neu-privat', 'x', 'privat') }] } }, 403],
    ];
    for (const [name, body, status] of faelle) {
      const r = await rufe(PATCH, '/api/state/tasks', 'partner', 'PATCH', body);
      expect(r.status, `${name}: ${r.text.slice(0, 200)}`).toBe(status);
      expect(lecks(r.text), name).toEqual([]);
    }
    expect(await stand()).toBe(vorher);
    // Gegenprobe: im Business schreibt der Partner wie bisher.
    const ok = await rufe(PATCH, '/api/state/tasks', 'partner', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-neu-biz', 'Neu im Business', 'p-biz', 'kdv', { assignee: 'partner' }) }] });
    expect(ok.status, ok.text).toBe(200);
  });

  it('volle Mitglieder schreiben unverändert — aber zuständig für eine Privat-Aufgabe wird der Partner nicht (400)', async () => {
    const { PATCH } = await R();
    const ok = await rufe(PATCH, '/api/state/tasks', 'zweite', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-neu-privat-z', 'Neu privat', 'p-privat', 'privat', { assignee: 'zweite' }) }] });
    expect(ok.status, ok.text).toBe(200);
    const nein = await rufe(PATCH, '/api/state/tasks', 'zweite', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-neu-privat-p', 'Neu privat', 'p-privat', 'privat', { assignee: 'partner' }) }] });
    expect(nein.status, nein.text).toBe(400);
    const beteiligt = await rufe(PATCH, '/api/state/tasks', 'zweite', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-neu-privat-b', 'Neu privat', 'p-privat', 'privat', { assignee: 'zweite', beteiligte: ['partner'] }) }] });
    expect(beteiligt.status, beteiligt.text).toBe(400);
  });

  it('Anlegen (/api/tasks/create, ZOE, Meeting): Privat-Elternteil 404, kein Duplikat-Verrat, ohne Ort im Business', async () => {
    const C = (await import('@/app/api/tasks/create/route')) as unknown as { POST: H };
    const unter = await rufe(C.POST, '/api/tasks/create', 'partner', 'POST', { title: 'Unter Privat', parentId: 't-privat' });
    expect(unter.status).toBe(404);
    // Gleiches Wort wie eine offene Privat-Aufgabe: kein „gibt es schon“ mit deren Kennung — es entsteht eine eigene Business-Aufgabe.
    const dup = await rufe(C.POST, '/api/tasks/create', 'partner', 'POST', { title: PRIVAT.aufgabe });
    expect(dup.status, dup.text).toBe(200);
    expect(dup.d.duplikat).toBeUndefined();
    expect(dup.d.id).not.toBe('t-privat');
    const neu = (await db.loadJson<{ tasks: { id: string; spaceId?: string }[] }>('tasks'))!.tasks.find(t => t.id === dup.d.id);
    const { bereichVonSpace } = await import('@/lib/aufgaben/struktur');
    expect(bereichVonSpace(neu?.spaceId)).toBe('business');
    const privat = await rufe(C.POST, '/api/tasks/create', 'partner', 'POST', { title: 'Ausdrücklich privat', space: 'privat' });
    expect(privat.status).toBe(403);
    // Aufräumen: die angelegte Business-Aufgabe (eine Kopie des Markentitels) wieder weg — sonst zählte sie unten als „Leck“.
    const { PATCH } = await R();
    await rufe(PATCH, '/api/state/tasks', 'zweite', 'PATCH', { ops: [{ op: 'delete', id: dup.d.id }] });
    await rufe(PATCH, '/api/state/tasks', 'zweite', 'PATCH', { ops: [{ op: 'delete', id: dup.d.id }] });
  });
});

describe('ZOE-Kern', () => {
  it('gatherBrain und Schilde des Partners tragen nichts aus Privat; die des vollen Mitglieds schon', async () => {
    const { gatherBrain, blockAufgaben } = await import('@/lib/brain');
    const p = await gatherBrain(H0, 'partner');
    expect(lecks(JSON.stringify({ t: p.tasks, s: p.shields, b: blockAufgaben(p, 30) }))).toEqual([]);
    expect(JSON.stringify(p.tasks.alle)).toContain(BUSINESS.aufgabe);
    const z = await gatherBrain(H0, 'zweite');
    expect(JSON.stringify(z.tasks.alle)).toContain(PRIVAT.aufgabe);
  });

  it('Stapel: Vorschläge des Systems aus dem Privat-Bereich sieht und entscheidet der Partner nicht', async () => {
    const S = (await import('@/app/api/zoe/stapel/route')) as unknown as { GET: H; POST: H };
    const p = await rufe(S.GET, '/api/zoe/stapel', 'partner');
    expect(p.status).toBe(200);
    expect(lecks(p.text)).toEqual([]);
    expect(p.text).toContain(BUSINESS.vorschlag);
    const z = await rufe(S.GET, '/api/zoe/stapel', 'zweite');
    expect(z.text).toContain(PRIVAT.vorschlag);
    const privatId = (z.d.vorschlaege as { id: string; titel: string }[]).find(v => v.titel === PRIVAT.vorschlag)!.id;
    expect((await rufe(S.POST, '/api/zoe/stapel', 'partner', 'POST', { id: privatId, entscheidung: 'ablehnen', grund: 'x' })).status).toBe(404);
    const { offeneAnzahlFuer, vorschlaegeFuer } = await import('@/lib/zoe/stapel');
    expect(await offeneAnzahlFuer('partner')).toBe(1);
    expect(lecks(JSON.stringify(await vorschlaegeFuer('partner', 'offen')))).toEqual([]);
    expect(await offeneAnzahlFuer('zweite')).toBe(3);
  });

  it('Suche (`suche_arbeit`) und `meine_aufgaben`: der Partner findet nichts aus Privat', async () => {
    const W = await import('@/lib/zoe/werkzeuge');
    const such = (p: string) => W.WERKZEUGE.suche_arbeit.lauf({ frage: 'KONTOSICHT', nur: 'app' }, 'http://test', p);
    const p = await such('partner');
    expect(lecks(p)).toEqual([]);
    expect(p).toContain(BUSINESS.aufgabe);
    expect(await such('zweite')).toContain(PRIVAT.aufgabe);
    expect(lecks(await W.WERKZEUGE.meine_aufgaben.lauf({}, 'http://test', 'partner'))).toEqual([]);
  });

  it('ZOE-Gespräch (/api/kimmi): der Prompt an das Modell trägt beim Partner nichts aus Privat, beim vollen Mitglied schon; kein Privat-Agent im Angebot', async () => {
    const { kiFake } = await import('./fixtures/ki-fake');
    const ki = kiFake();
    try {
      const K = (await import('@/app/api/kimmi/route')) as unknown as { POST: H };
      const p = await rufe(K.POST, '/api/kimmi', 'partner', 'POST', { message: 'Was steht heute an?' });
      expect(p.status, p.text).toBe(200);
      expect(ki.anfragen.length).toBeGreaterThan(0);
      const prompt = JSON.stringify(ki.anfragen);
      expect(lecks(prompt)).toEqual([]);
      expect(prompt).toContain(BUSINESS.aufgabe);
      ki.anfragen.length = 0;
      await rufe(K.POST, '/api/kimmi', 'zweite', 'POST', { message: 'Was steht heute an?' });
      expect(JSON.stringify(ki.anfragen)).toContain(PRIVAT.aufgabe);
    } finally { ki.zurueck(); }
    const { agentFuerKonto } = await import('@/lib/zoe/agent-kategorien');
    expect(agentFuerKonto('ernaehrung', true)).toBe(false);
    expect(agentFuerKonto('ernaehrung', false)).toBe(true);
    expect(agentFuerKonto('board', true)).toBe(true);
    const { runAgent } = await import('@/lib/zoe/agenten');
    const l = await runAgent('ernaehrung', '', 'http://test', 'partner');
    expect(l.ok).toBe(false);
  });
});
