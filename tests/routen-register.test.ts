// ─── Wächter: Routen-Register + Zugangs-Tore (05.10.) ──────────────────────────────────────────────────────
// (a) Jede app/api/**/route.ts steht im Register (lib/zugang/routen-register.ts) — mit genau ihren Methoden.
// (b) Jede Methode ruft die Tor-Funktion ihrer Klasse (statisch, lib/zugang/routen-analyse.ts) — und Stichproben je
//     Klasse prüfen zur Laufzeit: fremder Haushalt, Partner mit finanzRecht „business“, Testkunde ohne Haushalt,
//     Dienstweg ohne Person → 401/403.
// (c) Eine neue Route ohne Eintrag macht diesen Test rot. Lesende GETs, die schreiben, sind im Register begründet.
// Eigener Datenordner, alle Daten erfunden (@example.invalid), kein Modellaufruf, kein iCloud.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROUTEN_REGISTER, TORE, basisVon, ENTFERNTE_ROUTEN, type RoutenKlasse } from '@/lib/zugang/routen-register';
import { torAufrufe, exportierteMethoden, ohneKommentare, METHODEN, type Methode } from '@/lib/zugang/routen-analyse';

const WURZEL = path.resolve(__dirname, '..');
const API = path.join(WURZEL, 'app/api');

function alleRouten(): Map<string, string> {
  const aus = new Map<string, string>();
  const lauf = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) lauf(p);
      else if (e.name === 'route.ts') aus.set(path.relative(API, d).split(path.sep).join('/'), readFileSync(p, 'utf8'));
    }
  };
  lauf(API);
  return aus;
}
const ROUTEN = alleRouten();
const ALLE_TORE = [...new Set([...Object.values(TORE).flat(), ...Object.values(ROUTEN_REGISTER).flatMap(e => e.tor ? [e.tor] : [])])];
const SCHREIBEN = ['updateJson', 'saveJson', 'updateGeschuetzt', 'updateGeschuetztListen', 'updateJsonAsync', 'aendereCrm', 'aendereKonten', 'writeFile'];

/**
 * Wer ohne Prüfung bleiben darf, steht hier ausdrücklich (neben dem Register) — eine neue „offene“ Route verlangt eine
 * zweite, bewusste Änderung. Öffentlich laut middleware.ts: Anmeldung, Buchung, Google-Meldewege, CSP-Meldeweg.
 */
const OFFEN_ERLAUBT: Record<string, Methode[]> = {
  'abmelden/[token]': ['GET', 'POST'],
  'konto/status': ['GET'], 'konto/anmelden': ['POST'], 'konto/einrichten': ['POST'], 'konto/beitreten': ['POST'],
  'buchung/[slug]': ['GET', 'POST'], 'buchung/[slug]/status': ['POST'],
  'kalender/google/meldung': ['POST'], 'google/gmail/meldung': ['POST'], 'hoi/csp': ['POST'],
  'jarvis/[...pfad]': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // nur 308 → /api/zoe/*
  'kemaris-calendar': ['GET'], // fester Leerstand
  'state/aenderungen': ['POST'], // nur 405
};

describe('Routen-Register (statisch)', () => {
  it('(a)/(c) jede route.ts steht im Register, mit genau ihren Methoden — und nichts Verwaistes', () => {
    expect(ROUTEN.size).toBeGreaterThan(200);
    const fehlt = [...ROUTEN.keys()].filter(k => !ROUTEN_REGISTER[k]);
    expect(fehlt, 'Neue Route? → Eintrag in lib/zugang/routen-register.ts (Klasse + warum) und Tor-Zeile am Anfang').toEqual([]);
    expect(Object.keys(ROUTEN_REGISTER).filter(k => !ROUTEN.has(k)), 'Eintrag ohne Route').toEqual([]);
    const abweichend: string[] = [];
    for (const [k, q] of ROUTEN) {
      const im = new Set(Object.keys(ROUTEN_REGISTER[k]?.methoden ?? {}));
      const ex = new Set(exportierteMethoden(q).keys());
      for (const m of ex) if (!im.has(m)) abweichend.push(`${k} ${m} fehlt im Register`);
      for (const m of im) if (!ex.has(m as Methode)) abweichend.push(`${k} ${m} steht im Register, wird aber nicht exportiert`);
    }
    expect(abweichend).toEqual([]);
  });

  it('jeder Eintrag hat eine Begründung und nur bekannte Klassen', () => {
    for (const [k, e] of Object.entries(ROUTEN_REGISTER)) {
      expect(e.warum.length, k).toBeGreaterThan(5);
      for (const kl of Object.values(e.methoden) as RoutenKlasse[]) expect(['offen', ...Object.keys(TORE)].includes(basisVon(kl)), `${k}: ${kl}`).toBe(true);
    }
  });

  it('(b) jede Methode ruft die Tor-Funktion ihrer Klasse', () => {
    const fehlt: string[] = [];
    for (const [k, q] of ROUTEN) {
      const e = ROUTEN_REGISTER[k]; if (!e) continue;
      const auf = torAufrufe(q, ALLE_TORE);
      for (const [m, kl] of Object.entries(e.methoden) as [Methode, RoutenKlasse][]) {
        const b = basisVon(kl);
        if (b === 'offen') continue;
        const erlaubt = [...TORE[b], ...(e.tor ? [e.tor] : [])];
        const hat = auf.get(m) ?? new Set<string>();
        if (!erlaubt.some(t => hat.has(t))) fehlt.push(`${k} ${m} (${kl}) ruft keins von ${erlaubt.join(' | ')} — hat ${[...hat].join('+') || 'nichts'}`);
      }
    }
    expect(fehlt).toEqual([]);
  });

  it('„offen“ nur, wo es ausdrücklich erlaubt ist', () => {
    const offen: string[] = [];
    for (const [k, e] of Object.entries(ROUTEN_REGISTER)) for (const [m, kl] of Object.entries(e.methoden)) if (kl === 'offen' && !OFFEN_ERLAUBT[k]?.includes(m as Methode)) offen.push(`${k} ${m}`);
    expect(offen).toEqual([]);
  });

  it('öffentliche Wege der Middleware sind im Register „offen“ (und nur die)', () => {
    const mw = readFileSync(path.join(WURZEL, 'middleware.ts'), 'utf8');
    for (const p of ['konto\\/(status|anmelden|einrichten|beitreten)', 'hoi\\/csp', '(kalender\\/google|google\\/gmail)\\/meldung']) expect(mw).toContain(p);
    expect(ROUTEN_REGISTER['hoi/csp'].methoden.GET).toBe('haushalt');
  });

  it('lesende GETs schreiben nicht — sonst begründet (getSchreibt); keine Begründung ohne Schreiben', () => {
    const offen: string[] = [];
    for (const [k, q] of ROUTEN) {
      const e = ROUTEN_REGISTER[k]; if (!e) continue;
      const schreibt = (torAufrufe(q, SCHREIBEN).get('GET')?.size ?? 0) > 0;
      if (schreibt && !e.getSchreibt) offen.push(`${k}: GET schreibt ohne Begründung`);
      if (!schreibt && e.getSchreibt) offen.push(`${k}: getSchreibt ohne Schreiben im GET`);
    }
    expect(offen).toEqual([]);
  });

  it('die alten 410-Wege sind weg und kommen nicht wieder', () => {
    for (const r of ENTFERNTE_ROUTEN) expect(existsSync(path.join(API, r, 'route.ts')), r).toBe(false);
  });

  it('die neu abgesicherten Routen kennen keinen festen „kevin“-Rückfall mehr (risk, Startfläche)', () => {
    expect(ohneKommentare(readFileSync(path.join(WURZEL, 'lib/risk.ts'), 'utf8'))).not.toMatch(/person:\s*'kevin'/);
    expect(ohneKommentare(ROUTEN.get('startflaeche')!)).not.toMatch(/\?\s*'malin'\s*:\s*'kevin'/);
  });
});

describe('Analyse der Tor-Aufrufe (rein)', () => {
  it('erkennt Tore direkt, über Hilfsfunktionen und Generics — Kommentare zählen nicht', () => {
    const q = [
      "import { imHaushaltDesInhabers } from '@/lib/zugang/tor';",
      '// imHaushaltDesInhabers(req) — nur ein Kommentar',
      'async function zugang(req: Request) { return imHaushaltDesInhabers(req); }',
      'const gesperrt = () => 1;',
      'export async function GET(req: Request) {',
      '  if (!(await zugang(req))) return gesperrt();',
      '  return 1;',
      '}',
      'export async function POST(req: Request) {',
      "  /* imHaushaltDesInhabers(req) */ const s = 'x // imHaushaltDesInhabers(req)';",
      '  return updateJson<{ a: number }>(s, () => ({ a: 1 }));',
      '}',
      'export const PUT = weiter;',
      'function weiter(req: Request) { return personStreng(req); }',
    ].join('\n');
    const r = torAufrufe(q, ['imHaushaltDesInhabers', 'personStreng', 'updateJson']);
    expect([...r.get('GET')!]).toEqual(['imHaushaltDesInhabers']);
    expect([...r.get('POST')!]).toEqual(['updateJson']);
    expect([...r.get('PUT')!]).toEqual(['personStreng']);
    expect([...exportierteMethoden(q).keys()].sort()).toEqual(['GET', 'POST', 'PUT']);
    expect(METHODEN).toContain('DELETE');
  });
});

// ── Laufzeit-Stichproben ─────────────────────────────────────────────────────────────────────────────────────
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-routen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-routen';
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;
delete process.env.ANTHROPIC_API_KEY;

type H = (r: Request, ctx?: unknown) => Promise<Response>;
type Modul = Partial<Record<Methode, H>>;
let db: typeof import('@/lib/store/local-db');

const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
const anfrage = (pfad: string, kopf: Record<string, string>, methode: Methode = 'GET', body?: unknown) =>
  new Request(`http://test/api/${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const route = async (pfad: string) => await import(`@/app/api/${pfad}/route`) as unknown as Modul;
async function status(pfad: string, kopf: Record<string, string>, methode: Methode = 'GET', body?: unknown): Promise<number> {
  const m = await route(pfad);
  const h = m[methode];
  if (!h) throw new Error(`${pfad} hat kein ${methode}`);
  return (await h(anfrage(pfad, kopf, methode, body))).status;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [
    konto('k1', 'kevin', 'inhaber', { haushalt: 'test-haus' }),
    konto('k2', 'malin', 'mitglied', { haushalt: 'test-haus' }),
    konto('k3', 'partner', 'mitglied', { haushalt: 'test-haus', finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }),
    konto('k5', 'kunde', 'mitglied'), // Testkunde ohne Haushalt
  ], einladungen: [] });
  await db.saveJson('buchungen', { buchungen: [{ id: 'b-privat-1', datum: '2026-10-01', betrag: -12.5, text: 'Privat Beispiel', ort: 'privat' }] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Laufzeit: Haushalt des Inhabers (fremder Haushalt, Testkunde, Dienstweg ohne Person → 403)', () => {
  const STICHPROBE: [string, Methode, unknown?][] = [
    ['state/meetings', 'GET'], ['state/ziele', 'GET'], ['state/labels', 'GET'], ['state/backlog', 'GET'], ['zoe/protokoll', 'GET'],
    ['zoe/gedaechtnis', 'GET'], ['zoe/verbrauch', 'GET'], ['delegation', 'GET'], ['onboarding', 'GET'], ['risk', 'GET'],
    ['bauplan', 'GET'], ['state/routinen', 'GET'], ['state/meilensteine', 'GET'],
    ['zoe/selbstbild', 'GET'], ['state/agent-log', 'GET'],
    ['state/meetings', 'POST', { titel: 'Fremd', zusammenfassung: 'x' }], ['state/backlog', 'POST', { titel: 'Fremd' }],
    ['zoe/protokoll', 'POST', { id: 'x' }],
  ];
  it.each(STICHPROBE)('%s %s', async (pfad, m, body) => {
    expect(await status(pfad, sitzung('gast'), m, body), 'fremder Haushalt').toBe(403);
    expect(await status(pfad, sitzung('kunde'), m, body), 'Testkunde ohne Haushalt').toBe(403);
  });
  it('ZOE-Gespräch (kimmi): fremder Haushalt und Testkunde → 403 (Schlüssel nur gesetzt, um bis zur Prüfung zu kommen)', async () => {
    process.env.ANTHROPIC_API_KEY = 'nur-bis-zur-personen-pruefung';
    try {
      expect(await status('kimmi', sitzung('gast'), 'POST', { message: 'Hallo' })).toBe(403);
      expect(await status('kimmi', sitzung('kunde'), 'POST', { message: 'Hallo' })).toBe(403);
      expect(await status('kimmi', dienst('gast'), 'POST', { message: 'Hallo' })).toBe(403);
    } finally { delete process.env.ANTHROPIC_API_KEY; }
  });
  it('Dienstweg ohne Person kommt an Haushalts-Bestände nicht heran (nur wo der Systemlauf getragen ist)', async () => {
    for (const p of ['state/meetings', 'state/ziele', 'zoe/protokoll', 'bauplan', 'onboarding']) expect(await status(p, dienst()), p).toBe(403);
    expect(await status('state/labels', dienst('gast')), 'Dienstweg im Auftrag einer fremden Person').toBe(403);
  });
  it('im Haushalt geht es — und der lesende GET des Bauplan-Altbestands schreibt nichts', async () => {
    expect(await status('state/labels', sitzung('malin'))).toBe(200);
    expect(await status('state/meetings', sitzung('partner'))).toBe(200);
    const r = await (await route('state/backlog')).GET!(anfrage('state/backlog', sitzung('malin')));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { items: unknown[] }).items.length).toBeGreaterThan(0);
    expect(await db.loadJson('backlog')).toBeNull();
  });
});

describe('Laufzeit: Modul Markttraktion (bis zur Lizenz = Haushalts-Tor)', () => {
  it.each([['content', 'GET'], ['prospecting/score', 'POST'], ['outreach', 'POST'], ['state/prospects', 'GET']] as [string, Methode][])('%s %s', async (pfad, m) => {
    const body = m === 'POST' ? { prospect: { company: 'Beispiel GmbH' } } : undefined;
    expect(await status(pfad, sitzung('gast'), m, body)).toBe(403);
    expect(await status(pfad, sitzung('kunde'), m, body)).toBe(403);
  });
});

describe('Laufzeit: private Finanzen (Partner mit finanzRecht business, fremder Haushalt → 403)', () => {
  it.each([['state/buchungen', 'GET'], ['state/liquiplan', 'GET'], ['state/finanzplan', 'GET'], ['haushalt/pruefliste', 'GET']] as [string, Methode][])('%s %s', async (pfad, m) => {
    expect(await status(pfad, sitzung('partner'), m), 'Partner (business)').toBe(403);
    expect(await status(pfad, sitzung('gast'), m), 'fremder Haushalt').toBe(403);
    expect(await status(pfad, sitzung('kunde'), m), 'Testkunde').toBe(403);
  });
  it('Beleg übernehmen schreibt für den Partner keine Buchung', async () => {
    const vorher = JSON.stringify(await db.loadJson('buchungen'));
    const body = { richtung: 'eingang', beleg: { betrag: 10, datum: '2026-10-02', lieferant: 'Beispiel' } };
    expect(await status('beleg/uebernehmen', sitzung('partner'), 'POST', body)).toBe(403);
    expect(await status('beleg/uebernehmen', sitzung('gast'), 'POST', body)).toBe(403);
    expect(await status('beleg', sitzung('partner'), 'POST', { bild: 'data:image/png;base64,AAAA' })).toBe(403);
    expect(JSON.stringify(await db.loadJson('buchungen'))).toBe(vorher);
  });
  it('im Haushalt mit vollem Recht: die Buchungen sind da', async () => {
    const r = await (await route('state/buchungen')).GET!(anfrage('state/buchungen', sitzung('malin')));
    expect(r.status).toBe(200);
    expect(JSON.stringify(await r.json())).toContain('b-privat-1');
  });
});

describe('Laufzeit: Finanzplanung (Sicht aus dem Konto)', () => {
  it('Testkunde ohne Haushalt → 403; Partner bekommt die Business-Sicht', async () => {
    expect(await status('finanzplan', sitzung('kunde'))).toBe(403);
    const r = await (await route('finanzplan')).GET!(anfrage('finanzplan', sitzung('partner')));
    expect(r.status).toBe(200);
  });
});

describe('Laufzeit: nur der Inhaber', () => {
  it.each([['apple-contacts', 'GET'], ['client-fehler', 'GET']] as [string, Methode][])('%s %s', async (pfad, m) => {
    expect(await status(pfad, sitzung('malin'), m)).toBe(403);
    expect(await status(pfad, sitzung('gast'), m)).toBe(403);
    expect(await status(pfad, sitzung('kevin'), m)).toBe(200);
  });
  it('Einladen nur per Sitzung des Inhabers (Dienstweg „im Auftrag“ → 401)', async () => {
    expect(await status('konto/einladen', dienst('kevin'), 'POST', {})).toBe(401);
    expect(await status('konto/einladen', sitzung('malin'), 'POST', {})).toBe(403);
  });
  it('Selbstbild in den Vault schreiben: Mitglied → 403', async () => {
    expect(await status('zoe/selbstbild', sitzung('malin'), 'POST')).toBe(403);
  });
});

describe('Laufzeit: eigene Daten der Person (kein Rückfall auf „kevin“)', () => {
  it.each([['state/flaeche', 'GET'], ['state/rituale', 'GET'], ['state/zoe-verlauf', 'GET'], ['telegram/koppeln', 'GET'], ['konto/ich', 'GET']] as [string, Methode][])('%s %s: Dienstweg ohne Person → 401', async (pfad, m) => {
    const p = pfad === 'state/flaeche' ? `${pfad}?seite=heute` : pfad;
    const mod = await route(pfad);
    expect((await mod[m]!(new Request(`http://test/api/${p}`, { headers: dienst() }))).status).toBe(401);
  });
  it('Gesundheit schreiben ohne Person → 401', async () => {
    expect(await status('state/vitals', dienst(), 'PUT', { date: '2026-10-05', vitals: { rec: 50 } })).toBe(401);
    expect(await status('gesundheit/index', dienst(), 'POST', { schwelle: {} })).toBe(401);
  });
  it('Fehler melden: nur mit Person; lesen nur der Inhaber', async () => {
    expect(await status('client-fehler', dienst(), 'POST', { text: 'x' })).toBe(401);
    expect(await status('client-fehler', sitzung('gast'), 'POST', { text: 'Beispielfehler' })).toBe(200);
    expect(await status('client-fehler', sitzung('gast'), 'GET')).toBe(403);
  });
});

describe('Laufzeit: nur der Dienstweg', () => {
  it('Telegram-Eingang (Stand) liest nur der Bote', async () => {
    expect(await status('telegram/eingang', sitzung('kevin'))).toBe(403);
    expect(await status('telegram/eingang', dienst())).toBe(200);
  });
});
