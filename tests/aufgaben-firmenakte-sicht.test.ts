// ─── Aufgaben der Firmen-Akte nur mit Zugang zur Firmen-Akte (12.10.) ─────────────────────────────────────────────────────────────────────
// Befund: Aufgaben aus der Firmen-Akte (Schild-Erinnerungen `usp-`/`usd-`/`usm-`/`usr-`, Vertrags-Erinnerung `vte-`, Recht-Check `rcw-`,
// Beschluss-Folge `bfc-`) tragen seit 12.10. wieder Klartext-Titel. Zugewiesen werden sie nur Personen mit Zugang zur Firmen-Akte — ein Konto
// „nur Business“ (Schild/Register → 403) sah sie aber in seiner Business-Aufgabenliste. Wächter „Konto nur Business bekommt keine Firmen-Akte-
// Aufgabe“: Liste, Heute/Top 3, Briefing, Glocke, Lichtfäden (Kalender liest den Bestand über dieselbe Route), Schilde, Suche, Schreiben 404,
// Anlegen darunter 404, Zuständigkeit 400, Meldungen. Gegenprobe: Inhaberin und volles Mitglied sehen sie, der Systemlauf unverändert.
// Eigener Datenordner, erfundene Konten (`@example.invalid`) und Marken, kein Netz.
import { meldungVon } from '@/lib/werkzeuge/vertrag';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-firmenakte-sicht-'));
Object.assign(process.env, {
  MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-firmenakte', MAKE_OS_KI_VORGABE: 'kompatibel',
  MAKE_OS_BRAIN_INDEX: path.join(ordner, 'brain-index.sqlite'), MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: path.join(ordner, 'vault'),
  MAKE_OS_OHNE_APPLE: '1',
});
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true, maxRetries: 3 });
});

const HAUS = 'haus-fa';
/** Marken aus der Firmen-Akte — keine darf je bei `partner` ankommen. */
const AKTE = {
  pflicht: 'FIRMENAKTE-PFLICHT-JAHRESABSCHLUSS',
  altPflicht: 'FIRMENAKTE-ALT-DOKUMENT',
  vertrag: 'FIRMENAKTE-VERTRAG-KUENDIGEN',
  recht: 'FIRMENAKTE-RECHT-CHECK',
  beschluss: 'FIRMENAKTE-BESCHLUSS-CAPTABLE',
  unter: 'FIRMENAKTE-UNTERAUFGABE',
  // B17 (14.10.): Aufgaben und Listen des Gründungsfahrplans (freie Kennung, Liste `lm-ms-fahrplan-…`)
  fahrplan: 'FIRMENAKTE-FAHRPLAN-AUFGABE',
  fahrplanUnter: 'FIRMENAKTE-FAHRPLAN-UNTER',
  fahrplanListe: 'FIRMENAKTE-FAHRPLAN-LISTE',
};
// Die Liste eines Fahrplan-Meilensteins — genau wie die Erzeuger sie bilden.
const FP_MS = 'ms-fahrplan-register-11111111-1111-4111-8111-111111111111';
const FP_LISTE = `lm-${FP_MS.slice(0, 40)}-x`;
const BUSINESS = 'FIRMENAKTE-BUSINESS-SICHTBAR';
const lecks = (text: string) => Object.entries(AKTE).filter(([, m]) => text.includes(m)).map(([n]) => n);

const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Beispiel`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
const KONTEN = [
  konto('k1', 'inhaberin', 'inhaber', { haushalt: HAUS }),
  konto('k2', 'zweite', 'mitglied', { haushalt: HAUS }),
  konto('k3', 'partner', 'mitglied', { haushalt: HAUS, finanzRecht: 'business' }),
];
type H = (r: Request, ctx?: unknown) => Promise<Response>;
async function rufe(h: H, pfad: string, person: string, method = 'GET', body?: unknown): Promise<{ status: number; text: string; d: Record<string, unknown> }> {
  const r = await h(new Request(`http://test${pfad}`, { method, headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), { params: Promise.resolve({}) });
  const text = await r.text();
  let d: Record<string, unknown> = {};
  try { d = JSON.parse(text) as Record<string, unknown>; } catch { /* kein JSON */ }
  return { status: r.status, text, d };
}

let db: typeof import('@/lib/store/local-db');
let HEUTE = '';
let GESTERN = '';
const T0 = '2026-10-01T08:00:00.000Z';
const aufgabe = (id: string, title: string, extra: Record<string, unknown> = {}) =>
  ({ id, projectId: 'sonstige-ug', title, status: 'todo', priority: 'critical', assignee: 'inhaberin', tags: ['unternehmen'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: T0, updatedAt: T0, space: 'business', spaceId: 'ug', ...extra });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  HEUTE = (await import('@/lib/zeit')).localDay();
  GESTERN = (await import('@/lib/kalender/zeit')).tagPlus(HEUTE, -1);
  await db.saveJson('konten', { konten: KONTEN, einladungen: [] });
  await db.saveJson('tasks', {
    projects: [{ id: 'pm-ug', title: 'Meilensteine', spaceId: 'ug', space: 'business', createdAt: T0, updatedAt: T0 }],
    listen: [{ id: FP_LISTE, projektId: 'pm-ug', titel: AKTE.fahrplanListe, sortOrder: 0 }], statusEigen: [], gruppen: [], vorlagen: [],
    tasks: [
      aufgabe('usp-fa0001', AKTE.pflicht, { dueDate: HEUTE, beteiligte: ['zweite'] }),
      aufgabe('t-fa-unter', AKTE.unter, { parentId: 'usp-fa0001', dueDate: HEUTE }),
      // Altbestand (vor dem 11.10.): „beide“ machte auch das Konto „nur Business“ zuständig — sehen darf es sie trotzdem nie.
      aufgabe('usd-fa0002', AKTE.altPflicht, { assignee: 'partner', dueDate: GESTERN }),
      aufgabe('vte-fa0003-20261101', AKTE.vertrag, { dueDate: HEUTE, priority: 'high' }),
      aufgabe('rcw-fa0004', AKTE.recht, { priority: 'medium' }),
      aufgabe('bfc-fa0005', AKTE.beschluss, { priority: 'medium' }),
      aufgabe('t-fa-biz', BUSINESS, { assignee: 'partner', dueDate: HEUTE, tags: [] }),
      aufgabe('t-fa-fahrplan', AKTE.fahrplan, { projectId: 'pm-ug', listeId: FP_LISTE, tags: [] }),
      aufgabe('t-fa-fahrplan-u', AKTE.fahrplanUnter, { projectId: 'pm-ug', listeId: FP_LISTE, parentId: 't-fa-fahrplan', tags: [] }),
    ],
  });
}, 60_000);

describe('Die reine Regel (lib/aufgaben/firmenakte-sicht.ts)', () => {
  it('erkennt die Kennungen aller Erzeuger der Firmen-Akte — und nur sie', async () => {
    const R = await import('@/lib/aufgaben/firmenakte-sicht');
    const { SCHILD_AUFGABEN_PRAEFIXE, pflichtAufgabeId } = await import('@/lib/gesellschaften/schild/ampel');
    const { erinnerungAufgabeId } = await import('@/lib/gesellschaften/modell');
    const { checkAufgabeId } = await import('@/lib/recht/server');
    for (const p of SCHILD_AUFGABEN_PRAEFIXE) expect(R.FIRMEN_AKTE_PRAEFIXE, p).toContain(p);
    expect(R.istFirmenAkteAufgabe({ id: pflichtAufgabeId('ug', 'jahresabschluss') })).toBe(true);
    expect(R.istFirmenAkteAufgabe({ id: erinnerungAufgabeId('vt-abcd', '2026-11-01') })).toBe(true);
    expect(R.istFirmenAkteAufgabe({ id: checkAufgabeId('pflicht:ug:x') })).toBe(true);
    expect(R.istFirmenAkteAufgabe({ id: `${R.BESCHLUSS_CAPTABLE_PRAEFIX}abc` })).toBe(true);
    // Der Erzeuger der Beschluss-Folge nimmt die Kennung von HIER (eine Stelle).
    expect(readFileSync(path.join(process.cwd(), 'lib/gesellschaften/beschluss-server.ts'), 'utf8')).toMatch(/\$\{BESCHLUSS_CAPTABLE_PRAEFIX\}\$\{rechtHash/);
    for (const id of ['t-abc', 'mtg-20261001-abcd', 'steuer-ust-2026', 'w-abc-20261001', 'us-x', 'vt-x', 'rc-x', 'bf-x', '']) expect(R.istFirmenAkteAufgabe({ id }), id).toBe(false);
    expect(R.istFirmenAkteAufgabe(null)).toBe(false);
    // Gründungsfahrplan (B17, 14.10.): an der LISTE erkannt — die Erzeuger bilden genau dieses Präfix.
    const { fahrplanMeilensteinId } = await import('@/lib/gesellschaften/fahrplan');
    const { meilensteinListeId } = await import('@/lib/planung/meilenstein-aufgaben');
    const liste = meilensteinListeId(fahrplanMeilensteinId('g-11111111-1111-4111-8111-111111111111', 'register'));
    expect(R.istFahrplanListe(liste)).toBe(true);
    expect(R.istFirmenAkteAufgabe({ id: 't-frei', listeId: liste })).toBe(true);
    expect(R.istFirmenAkteAufgabe({ id: 't-frei', listeId: meilensteinListeId('ms-demo-pipeline') })).toBe(false);
    expect(R.istFahrplanListe(FP_LISTE)).toBe(true);
  });

  it('Unteraufgaben erben über die ganze Kette (kreisfest); ohne Firmen-Akte bleibt der Bestand dasselbe Objekt', async () => {
    const R = await import('@/lib/aufgaben/firmenakte-sicht');
    const tasks = [{ id: 'usp-a' }, { id: 'u1', parentId: 'usp-a' }, { id: 'u2', parentId: 'u1' }, { id: 'k1', parentId: 'k2' }, { id: 'k2', parentId: 'k1' }, { id: 'frei' }];
    const nachId = new Map(tasks.map(t => [t.id, t]));
    expect(tasks.filter(t => R.aufgabeInFirmenAkte(t, nachId)).map(t => t.id)).toEqual(['usp-a', 'u1', 'u2']);
    expect(R.aufgabenOhneFirmenAkte(tasks).map(t => t.id)).toEqual(['k1', 'k2', 'frei']);
    const ohne = { projects: [], tasks: [{ id: 'frei' }] } as never;
    expect(R.ohneFirmenAkte(ohne)).toBe(ohne);
  });

  it('Meldungen (rein): wer die Firmen-Akte nicht sieht, erfährt nichts über ihre Aufgaben — auch nicht per Erwähnung', async () => {
    const { meldungenBerechnen } = await import('@/lib/aufgaben/speicher');
    const personen = [{ speicher: 'inhaberin', name: 'I' }, { speicher: 'partner', name: 'P', nurBusiness: true, ohneFirmenAkte: true }, { speicher: 'zweite', name: 'Z' }];
    const leer = { projects: [], tasks: [] };
    const t = (id: string, assignee: string) => aufgabe(id, `Titel ${id}`, { assignee }) as never;
    const m = meldungenBerechnen(leer, { projects: [], tasks: [t('usp-m1', 'partner'), t('t-m2', 'partner'), t('vte-m3', 'zweite')] }, [], 'inhaberin', personen);
    expect(m.map(x => `${x.an}:${x.bezug?.id ?? ''}`).sort()).toEqual(['partner:t-m2', 'zweite:vte-m3']);
    const k = { task: aufgabe('rcw-m4', 'Kommentiert', { assignee: 'inhaberin' }) as never, k: { id: 'k1', von: 'inhaberin', text: '@partner @zweite', am: T0, erwaehnt: ['partner', 'zweite'] } };
    const e = meldungenBerechnen(leer, { projects: [], tasks: [k.task] }, [k as never], 'inhaberin', personen);
    expect(e.map(x => x.an)).toEqual(['zweite']);
  });
});

describe('Lesen: Konto „nur Business“ bekommt keine Firmen-Akte-Aufgabe', () => {
  it('ladeAufgabenSicht, verborgene Aufgaben — Systemlauf und Personen mit Zugang unverändert', async () => {
    const { ladeAufgabenSicht, verborgeneAufgabenFuer, firmenAkteAusgeblendetFuer } = await import('@/lib/aufgaben/sicht');
    expect(await firmenAkteAusgeblendetFuer('partner')).toBe(true);
    expect(await firmenAkteAusgeblendetFuer('inhaberin')).toBe(false);
    expect(await firmenAkteAusgeblendetFuer('zweite')).toBe(false);
    expect(await firmenAkteAusgeblendetFuer(null)).toBe(false);
    const p = JSON.stringify(await ladeAufgabenSicht('partner'));
    expect(lecks(p)).toEqual([]);
    expect(p).toContain(BUSINESS);
    for (const wer of ['inhaberin', 'zweite', null] as const) {
      const s = JSON.stringify(await ladeAufgabenSicht(wer));
      for (const m of Object.values(AKTE)) expect(s, `${wer}: ${m}`).toContain(m);
    }
    expect([...await verborgeneAufgabenFuer('partner')].sort()).toEqual(['bfc-fa0005', 'rcw-fa0004', 't-fa-fahrplan', 't-fa-fahrplan-u', 't-fa-unter', 'usd-fa0002', 'usp-fa0001', 'vte-fa0003-20261101']);
    expect([...await verborgeneAufgabenFuer('inhaberin')]).toEqual([]);
  });

  it('GET /api/state/tasks (auch ?space=business, Papierkorb — der Kalender liest hier): Partner nichts, Inhaberin alles', async () => {
    const R = (await import('@/app/api/state/tasks/route')) as unknown as { GET: H };
    for (const q of ['', '?space=business', '?papierkorb=1']) {
      const p = await rufe(R.GET, `/api/state/tasks${q}`, 'partner');
      expect(p.status, q).toBe(200);
      expect(lecks(p.text), q).toEqual([]);
      expect(p.text, q).toContain(BUSINESS);
    }
    const i = await rufe(R.GET, '/api/state/tasks', 'inhaberin');
    for (const m of Object.values(AKTE)) expect(i.text, m).toContain(m);
  });

  it('Heute (Top 3, Briefing, Steht an), Glocke, Lichtfäden, Seil, Export, Schilde: Partner nichts — Inhaberin sieht sie', async () => {
    const wege: [string, () => Promise<{ GET: H }>][] = [
      ['/api/heute/top3?space=business', () => import('@/app/api/heute/top3/route') as never],
      ['/api/heute/top3', () => import('@/app/api/heute/top3/route') as never],
      ['/api/heute/briefing?space=business', () => import('@/app/api/heute/briefing/route') as never],
      ['/api/heute/anstehend', () => import('@/app/api/heute/anstehend/route') as never],
      ['/api/meldungen', () => import('@/app/api/meldungen/route') as never],
      ['/api/lichtfaeden', () => import('@/app/api/lichtfaeden/route') as never],
      ['/api/seil', () => import('@/app/api/seil/route') as never],
      ['/api/aufgaben/export', () => import('@/app/api/aufgaben/export/route') as never],
    ];
    for (const [pfad, laden] of wege) {
      const { GET } = await laden();
      const p = await rufe(GET, pfad, 'partner');
      expect(lecks(p.text), `${pfad} (${p.status}) ${p.text.slice(0, 160)}`).toEqual([]);
    }
    // Gegenprobe: Lichtfäden (Engstellen zeigen die dichtesten — irgendeine) und Export (alle) zeigen der Inhaberin die Firmen-Akte.
    for (const [pfad, laden] of wege.filter(([p]) => ['/api/lichtfaeden', '/api/aufgaben/export'].includes(p))) {
      const { GET } = await laden();
      expect(lecks((await rufe(GET, pfad, 'inhaberin')).text).length, pfad).toBeGreaterThan(0);
    }
    const { GET: ex } = (await import('@/app/api/aufgaben/export/route')) as unknown as { GET: H };
    const exText = (await rufe(ex, '/api/aufgaben/export', 'inhaberin')).text;
    for (const m of Object.values(AKTE)) expect(exText, m).toContain(m);
    // Die Glocke (fällig/überfällig aus der Sicht): die Altbestands-Aufgabe, für die der Partner noch zuständig ist, nennt sie nie.
    const { GET: glocke } = (await import('@/app/api/meldungen/route')) as unknown as { GET: H };
    expect((await rufe(glocke, '/api/meldungen', 'partner')).text).not.toContain('usd-fa0002');
    // Schilde: „kritische Aufgabe überfällig“ nennt Titel — die der Firmen-Akte nur, wer sie sieht.
    const { computeShields } = await import('@/lib/risk');
    expect(lecks(JSON.stringify(await computeShields(HEUTE, 'partner')))).toEqual([]);
    expect(JSON.stringify(await computeShields(HEUTE, 'inhaberin'))).toContain(AKTE.altPflicht);
  });

  it('Suche (`suche_arbeit`): Partner findet nichts aus der Firmen-Akte (in der Abfrage), Inhaberin schon', async () => {
    const W = await import('@/lib/zoe/werkzeuge');
    const such = (p: string) => W.WERKZEUGE.suche_arbeit.lauf({ frage: 'FIRMENAKTE', nur: 'app', anzahl: 20 }, 'http://test', p).then(meldungVon);
    const p = await such('partner');
    expect(lecks(p)).toEqual([]);
    expect(p).toContain(BUSINESS);
    const i = await such('inhaberin');
    expect(i).toContain(AKTE.pflicht);
    expect(i).toContain(AKTE.unter);
    // Die Agenten-Suche im Bereich (Business-Heads) ebenso.
    const { arbeitImBereich } = await import('@/lib/agenten/werkzeuge');
    expect(lecks(meldungVon(await arbeitImBereich('partner', 'business', { frage: 'FIRMENAKTE', anzahl: 20 })))).toEqual([]);
    expect(meldungVon(await arbeitImBereich('inhaberin', 'business', { frage: 'FIRMENAKTE', anzahl: 20 }))).toContain(AKTE.recht);
  });
});

describe('Schreiben: Konto „nur Business“ → 404, wie „nur ich“', () => {
  const R = () => import('@/app/api/state/tasks/route') as unknown as Promise<{ PATCH: H }>;
  const stand = async () => JSON.stringify(await db.loadJson('tasks'));

  it('ändern, löschen, darunter anlegen, unter sie hängen, mit ihrer Kennung anlegen → 404; der Bestand bleibt bit-gleich', async () => {
    const { PATCH } = await R();
    const vorher = await stand();
    const faelle: [string, unknown][] = [
      ['Pflicht ändern', { ops: [{ op: 'upsert', task: aufgabe('usp-fa0001', 'umbenannt') }] }],
      ['eigene Altbestands-Pflicht erledigen', { ops: [{ op: 'upsert', task: aufgabe('usd-fa0002', AKTE.altPflicht, { assignee: 'partner', status: 'done', dueDate: GESTERN }) }] }],
      ['Unteraufgabe ändern', { ops: [{ op: 'upsert', task: aufgabe('t-fa-unter', 'umbenannt', { parentId: 'usp-fa0001' }) }] }],
      ['Vertrags-Erinnerung löschen', { ops: [{ op: 'delete', id: 'vte-fa0003-20261101' }] }],
      ['Recht-Aufgabe löschen', { ops: [{ op: 'delete', id: 'rcw-fa0004' }] }],
      ['neue Unteraufgabe darunter', { ops: [{ op: 'upsert', task: aufgabe('t-fa-neu', 'Neu', { parentId: 'bfc-fa0005', assignee: 'partner' }) }] }],
      ['eigene Business-Aufgabe darunter hängen', { ops: [{ op: 'upsert', task: aufgabe('t-fa-biz', BUSINESS, { parentId: 'usp-fa0001', assignee: 'partner', tags: [], dueDate: HEUTE }) }] }],
      ['mit einer Kennung der Firmen-Akte anlegen', { ops: [{ op: 'upsert', task: aufgabe('usm-fa9999', 'Neu', { assignee: 'partner' }) }] }],
    ];
    for (const [name, body] of faelle) {
      const r = await rufe(PATCH, '/api/state/tasks', 'partner', 'PATCH', body);
      expect(r.status, `${name}: ${r.text.slice(0, 200)}`).toBe(404);
      expect(lecks(r.text), name).toEqual([]);
    }
    expect(await stand()).toBe(vorher);
    // Anlegen per Route (ZOE, Meeting): Elternteil aus der Firmen-Akte gibt es nicht; kein „gibt es schon“ mit ihrer Kennung.
    const C = (await import('@/app/api/tasks/create/route')) as unknown as { POST: H };
    const unter = await rufe(C.POST, '/api/tasks/create', 'partner', 'POST', { title: 'Unter der Pflicht', parentId: 'usp-fa0001' });
    expect(unter.status, unter.text).toBe(404);
    expect(await stand()).toBe(vorher);
    // Gegenprobe: im Business schreibt der Partner wie bisher.
    const ok = await rufe(PATCH, '/api/state/tasks', 'partner', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-fa-neu-biz', 'Neu im Business', { assignee: 'partner', tags: [] }) }] });
    expect(ok.status, ok.text).toBe(200);
  });

  it('Inhaberin schreibt unverändert — zuständig oder beteiligt an einer Firmen-Akte-Aufgabe wird der Partner aber nicht (400)', async () => {
    const { PATCH } = await R();
    const ok = await rufe(PATCH, '/api/state/tasks', 'inhaberin', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('rcw-fa0004', `${AKTE.recht} geprüft`, { priority: 'medium' }) }] });
    expect(ok.status, ok.text).toBe(200);
    const unter = await rufe(PATCH, '/api/state/tasks', 'inhaberin', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-fa-unter2', 'Neu darunter', { parentId: 'rcw-fa0004' }) }] });
    expect(unter.status, unter.text).toBe(200);
    const zust = await rufe(PATCH, '/api/state/tasks', 'inhaberin', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('bfc-fa0005', AKTE.beschluss, { assignee: 'partner', priority: 'medium' }) }] });
    expect(zust.status, zust.text).toBe(400);
    const bet = await rufe(PATCH, '/api/state/tasks', 'inhaberin', 'PATCH', { ops: [{ op: 'upsert', task: aufgabe('t-fa-unter3', 'Neu darunter', { parentId: 'rcw-fa0004', beteiligte: ['partner'] }) }] });
    expect(bet.status, bet.text).toBe(400);
    // Keine Meldung über eine Firmen-Akte-Aufgabe an den Partner (nur seine eigene Business-Aufgabe ist ihm zugewiesen — von ihm selbst).
    const m = await db.loadJson<{ eintraege?: { bezug?: { id: string }; titel: string }[] }>('meldungen--partner');
    expect(lecks(JSON.stringify(m ?? {}))).toEqual([]);
  });
});

// ── Gründungsfahrplan in der Planung (14.10., Abnahme-Reste 2) ─────────────────────────────────────────────────────────────────────────────
// Befund: der Partner („nur Business“) sah die Aufgaben des Fahrplans nicht mehr (B17), aber noch dessen Ziel und Meilensteine — in Planung,
// Seil, Lichtfäden und der Brain-Kugel. Jetzt dieselbe Regel (`firmenAkteAusgeblendetFuer`) für Ziele und Meilensteine, serverseitig.
describe('Planung: Ziel und Meilensteine des Gründungsfahrplans nur mit Zugang zur Firmen-Akte', () => {
  const PLAN = { ziel: 'FAHRPLAN-ZIEL-GRUENDUNG', ms: 'FAHRPLAN-MEILENSTEIN-REGISTER', amZiel: 'FAHRPLAN-MEILENSTEIN-AM-ZIEL' };
  const BIZ_ZIEL = 'PLANUNG-BUSINESS-ZIEL-SICHTBAR', BIZ_MS = 'PLANUNG-BUSINESS-MEILENSTEIN-SICHTBAR';
  const planLecks = (text: string) => Object.entries(PLAN).filter(([, m]) => text.includes(m)).map(([n]) => n);
  const GID = 'g-22222222-2222-4222-8222-222222222222';
  let FZ = '', FM = '';
  const stand = async () => JSON.stringify([await db.loadJson('ziele'), await db.loadJson('meilensteine')]);

  beforeAll(async () => {
    const { fahrplanZielId, fahrplanMeilensteinId } = await import('@/lib/gesellschaften/fahrplan');
    FZ = fahrplanZielId(GID); FM = fahrplanMeilensteinId(GID, 'register');
    const jahr = Number(HEUTE.slice(0, 4));
    const bald = (await import('@/lib/kalender/zeit')).tagPlus(HEUTE, 30);
    await db.saveJson('ziele', {
      tag: [], woche: [], monat: [], quartal: [], fokus: {},
      jahr: [
        { id: FZ, titel: PLAN.ziel, fortschritt: 0, space: 'business', einheit: 'ug', jahr },
        { id: 'z-biz-plan', titel: BIZ_ZIEL, fortschritt: 0, space: 'business', einheit: 'ug', jahr },
      ],
    });
    await db.saveJson('meilensteine', { meilensteine: [
      { id: FM, titel: PLAN.ms, space: 'business', bereich: 'business', einheit: 'ug', faellig: bald, fortschritt: 0, erledigt: false, zielId: FZ, rang: 1 },
      { id: 'ms-frei-am-fahrplan', titel: PLAN.amZiel, space: 'business', bereich: 'business', faellig: bald, fortschritt: 0, erledigt: false, zielId: FZ, rang: 2 },
      { id: 'ms-biz-plan', titel: BIZ_MS, space: 'business', bereich: 'business', faellig: bald, fortschritt: 0, erledigt: false, zielId: 'z-biz-plan', rang: 3 },
    ] });
  }, 60_000);

  it('die reine Regel erkennt Ziel, Abgeleitetes und Meilensteine des Fahrplans — die Kennungen bildet nur lib/gesellschaften/fahrplan.ts', async () => {
    const R = await import('@/lib/aufgaben/firmenakte-sicht');
    const { meilensteinId } = await import('@/lib/planung/kaskade');
    expect(R.istFahrplanZiel({ id: FZ })).toBe(true);
    expect(R.istFahrplanZiel({ id: `${FZ}~quartal`, abgeleitetVon: FZ })).toBe(true);
    expect(R.istFahrplanZiel({ id: 'z-biz-plan' })).toBe(false);
    expect(R.istFahrplanMeilenstein({ id: FM })).toBe(true);
    expect(R.istFahrplanMeilenstein({ id: 'ms-x', zielId: FZ })).toBe(true);
    expect(R.istFahrplanMeilenstein({ id: meilensteinId(FZ), abgeleitetVon: FZ })).toBe(true);
    expect(R.istFahrplanMeilenstein({ id: 'ms-biz-plan', zielId: 'z-biz-plan' })).toBe(false);
    expect(R.istFahrplanMeilenstein(null)).toBe(false);
  });

  it('Ziele, Meilensteine, Seil, Lichtfäden, Brain-Kugel, Detail, Kalender: Partner nichts — Inhaberin sieht es', async () => {
    const wege: [string, () => Promise<{ GET: H }>][] = [
      ['/api/state/ziele', () => import('@/app/api/state/ziele/route') as never],
      ['/api/state/ziele?space=business', () => import('@/app/api/state/ziele/route') as never],
      ['/api/state/meilensteine', () => import('@/app/api/state/meilensteine/route') as never],
      ['/api/seil?ebene=jahr&bereich=business', () => import('@/app/api/seil/route') as never],
      ['/api/seil?ebene=aufgaben', () => import('@/app/api/seil/route') as never],
      ['/api/lichtfaeden', () => import('@/app/api/lichtfaeden/route') as never],
      ['/api/brain/punkte', () => import('@/app/api/brain/punkte/route') as never],
      [`/api/planung/meilenstein?id=${FM}`, () => import('@/app/api/planung/meilenstein/route') as never],
      ['/api/kalender', () => import('@/app/api/kalender/route') as never],
      ['/api/agenten', () => import('@/app/api/agenten/route') as never],
    ];
    for (const [pfad, laden] of wege) {
      const { GET } = await laden();
      const p = await rufe(GET, pfad, 'partner');
      expect(planLecks(p.text), `${pfad} (${p.status}) ${p.text.slice(0, 160)}`).toEqual([]);
    }
    const { GET: ziele } = (await import('@/app/api/state/ziele/route')) as unknown as { GET: H };
    expect((await rufe(ziele, '/api/state/ziele', 'partner')).text).toContain(BIZ_ZIEL);
    const { GET: ms } = (await import('@/app/api/state/meilensteine/route')) as unknown as { GET: H };
    expect((await rufe(ms, '/api/state/meilensteine', 'partner')).text).toContain(BIZ_MS);
    // Gegenprobe: Inhaberin und volles Mitglied sehen Ziel und Meilensteine (Ziele, Meilensteine, Seil, Brain-Kugel).
    for (const wer of ['inhaberin', 'zweite']) {
      expect(planLecks((await rufe(ziele, '/api/state/ziele', wer)).text), wer).toEqual(['ziel']);
      expect(planLecks((await rufe(ms, '/api/state/meilensteine', wer)).text).sort(), wer).toEqual(['amZiel', 'ms']);
    }
    const { GET: seil } = (await import('@/app/api/seil/route')) as unknown as { GET: H };
    expect(planLecks((await rufe(seil, '/api/seil?ebene=jahr', 'inhaberin')).text).length).toBeGreaterThan(0);
    const { GET: kugel } = (await import('@/app/api/brain/punkte/route')) as unknown as { GET: H };
    expect(planLecks((await rufe(kugel, '/api/brain/punkte', 'inhaberin')).text).length).toBeGreaterThan(0);
  });

  it('ZOE und Heads (Jahresziele im Kontext) und die Lesestelle der Meilensteine: Partner nichts', async () => {
    const { jahreszieleFuer, zieleFuerHead } = await import('@/lib/planung/jahresziele-sicht');
    expect(planLecks(JSON.stringify(await jahreszieleFuer({ privat: false, person: 'partner' })))).toEqual([]);
    expect(JSON.stringify(await jahreszieleFuer({ privat: false, person: 'partner' }))).toContain(BIZ_ZIEL);
    expect(planLecks(JSON.stringify(await jahreszieleFuer({ privat: true, person: 'inhaberin' })))).toEqual(['ziel']);
    expect(planLecks(JSON.stringify(await zieleFuerHead({ person: 'partner', privat: false })))).toEqual([]);
    const { meilensteineSichtbarFuer } = await import('@/lib/planung/eigene-ziele-sicht-server');
    const alle = (await db.loadJson<{ meilensteine: { id: string; zielId?: string }[] }>('meilensteine'))!.meilensteine;
    expect((await meilensteineSichtbarFuer(alle, 'partner')).map(m => m.id)).toEqual(['ms-biz-plan']);
    expect((await meilensteineSichtbarFuer(alle, 'inhaberin')).length).toBe(3);
    expect((await meilensteineSichtbarFuer(alle, null)).length).toBe(3);
  });

  it('Schreiben: ändern, löschen, mit seiner Kennung anlegen, an sein Ziel hängen → 404; der Bestand bleibt bit-gleich', async () => {
    const Z = (await import('@/app/api/state/ziele/route')) as unknown as { PATCH: H; GET: H };
    const M = (await import('@/app/api/state/meilensteine/route')) as unknown as { PATCH: H; PUT: H };
    const vorher = await stand();
    const jahr = Number(HEUTE.slice(0, 4));
    const faelle: [string, H, string, unknown][] = [
      ['Fahrplan-Ziel löschen', Z.PATCH, '/api/state/ziele', { horizont: 'jahr', ops: [{ op: 'delete', id: FZ }] }],
      ['Fahrplan-Ziel ändern', Z.PATCH, '/api/state/ziele', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: FZ, titel: 'neu', fortschritt: 0, space: 'business', jahr } }] }],
      ['mit Fahrplan-Kennung anlegen', Z.PATCH, '/api/state/ziele', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: `${FZ}x`, titel: 'neu', fortschritt: 0, space: 'business', jahr } }] }],
      ['Fahrplan-Meilenstein löschen', M.PATCH, '/api/state/meilensteine', { ops: [{ op: 'delete', id: FM }] }],
      ['Fahrplan-Meilenstein ändern', M.PATCH, '/api/state/meilensteine', { ops: [{ op: 'teil', id: FM, felder: { titel: 'neu' } }] }],
      ['eigenen Meilenstein an das Fahrplan-Ziel hängen', M.PATCH, '/api/state/meilensteine', { ops: [{ op: 'teil', id: 'ms-biz-plan', felder: { zielId: FZ } }] }],
    ];
    for (const [name, h, pfad, body] of faelle) {
      const r = await rufe(h, pfad, 'partner', 'PATCH', body);
      expect(r.status, `${name}: ${r.text.slice(0, 200)}`).toBe(404);
      expect(planLecks(r.text), name).toEqual([]);
    }
    // Altweg PUT: die Fahrplan-Meilensteine kennt der Partner nicht — sie bleiben; nennt der Körper einen davon → 404.
    const put = await rufe(M.PUT, '/api/state/meilensteine', 'partner', 'PUT', { meilensteine: [{ id: FM, titel: 'neu', space: 'business', faellig: HEUTE, fortschritt: 0, erledigt: false }] });
    expect(put.status, put.text).toBe(404);
    expect(await stand()).toBe(vorher);
    // Gegenprobe: im Business schreibt der Partner weiter; die Inhaberin ändert das Fahrplan-Ziel wie bisher.
    const ok = await rufe(M.PATCH, '/api/state/meilensteine', 'partner', 'PATCH', { ops: [{ op: 'teil', id: 'ms-biz-plan', felder: { fortschritt: 10 } }] });
    expect(ok.status, ok.text).toBe(200);
    expect(planLecks(ok.text)).toEqual([]);
    const ms = (await db.loadJson<{ meilensteine: { id: string }[] }>('meilensteine'))!.meilensteine.map(m => m.id).sort();
    expect(ms).toEqual([FM, 'ms-biz-plan', 'ms-frei-am-fahrplan'].sort());
    const inh = await rufe(Z.PATCH, '/api/state/ziele', 'inhaberin', 'PATCH', { horizont: 'jahr', ops: [{ op: 'upsert', eintrag: { id: FZ, titel: `${PLAN.ziel} geprüft`, fortschritt: 0, space: 'business', einheit: 'ug', jahr } }] });
    expect(inh.status, inh.text).toBe(200);
  });
});
