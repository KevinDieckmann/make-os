// ─── Demo-Instanz (05.10.): Schutzregeln, Saat über die Schreibwege, Zurücksetzen nur in der Demo (Wächter) ─────────────
// Eigener Datenordner (vi.hoisted — vor allen Imports), erfundene Daten. Nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const { ordner, wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-demo-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-demo', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
    NEXT_PUBLIC_MAKE_OS_CRM_TEAM: JSON.stringify([{ id: 'lena', name: 'Lena', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'jonas', name: 'Jonas', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]),
    NEXT_PUBLIC_MAKE_OS_EINHEITEN: JSON.stringify({ kdc: { label: 'Beispiel Beratung', kurz: 'Beratung' }, kdv: { label: 'Beispiel Holding', kurz: 'Holding' }, ug: { label: 'Beispiel Labs GmbH', kurz: 'Labs' } }),
  });
  delete process.env.MAKE_OS_DATENSCHLUESSEL; delete process.env.MAKE_OS_DEMO;
  for (const k of ['ICLOUD_APPLE_ID', 'ICLOUD_APP_PASSWORT', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TELEGRAM_BOT_TOKEN', 'WHOOP_CLIENT_ID', 'MS_CLIENT_ID']) delete process.env[k];
  return { ordner, wurzel };
});

import { ordnerGruende, leerGruende, zuruecksetzenGruende, umgebungGruende, demoUuid, istDemoInstanz, DEMO_MARKE } from '@/lib/demo/schutz';
import { createHash } from 'node:crypto';
import { localDay } from '@/lib/zeit';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('Schutzregeln (rein)', () => {
  it('nie <repo>/.data, nie ein Pfad mit „.data“, nie ohne MAKE_OS_DATEN_DIR', () => {
    expect(ordnerGruende({ env: {}, cwd: '/repo' })[0]).toMatch(/nicht gesetzt/);
    expect(ordnerGruende({ env: { MAKE_OS_DATEN_DIR: '/repo/.data' }, cwd: '/repo' }).length).toBeGreaterThan(0);
    expect(ordnerGruende({ env: { MAKE_OS_DATEN_DIR: '/srv/make/.data' }, cwd: '/app' }).join(' ')).toMatch(/\.data/);
    expect(ordnerGruende({ env: { MAKE_OS_DATEN_DIR: '/' }, cwd: '/app' }).join(' ')).toMatch(/Wurzel/);
    expect(ordnerGruende({ env: { MAKE_OS_DATEN_DIR: '/srv/demo/daten' }, cwd: '/app' })).toEqual([]);
  });
  it('säen nur in einen leeren Ordner', () => {
    expect(leerGruende([])).toEqual([]);
    expect(leerGruende(['.DS_Store'])).toEqual([]);
    expect(leerGruende(['konten.json'])[0]).toMatch(/nicht leer/);
  });
  it('zurücksetzen nur mit Demo-Marke und nur mit @example.invalid-Konten', () => {
    const demo = [{ email: 'a@example.invalid' }];
    expect(zuruecksetzenGruende({ marke: { saat: 1 }, konten: demo })).toEqual([]);
    expect(zuruecksetzenGruende({ marke: null, konten: demo })[0]).toMatch(/Demo-Marke/);
    expect(zuruecksetzenGruende({ marke: { saat: 1 }, konten: [{ email: 'jemand@firma-beispiel.de' }] })[0]).toMatch(/echte Konten/);
    expect(zuruecksetzenGruende({ marke: { saat: 1 }, konten: [{ email: 'a@example.invalid', weitereEmails: ['b@firma-beispiel.de'] }] }).length).toBe(1);
  });
  it('Umgebung: keine echten Quellen, interne Aufrufe bleiben in der Instanz', () => {
    const gut = { MAKE_OS_OHNE_APPLE: '1', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_VAULT_DIR: '/d/daten/wissen', PORT: '3300' };
    expect(umgebungGruende(gut, '/d/daten')).toEqual([]);
    expect(umgebungGruende({ ...gut, MAKE_VAULT_DIR: '/Users/x/Vault' }, '/d/daten').join(' ')).toMatch(/Vault|Datenordner/);
    expect(umgebungGruende({ ...gut, PORT: undefined }, '/d/daten').join(' ')).toMatch(/3001/);
    expect(umgebungGruende({ ...gut, ICLOUD_APPLE_ID: 'x' }, '/d/daten').join(' ')).toMatch(/ICLOUD/);
    expect(umgebungGruende({ ...gut, MAKE_OS_OHNE_APPLE: undefined }, '/d/daten').length).toBe(1);
  });
  it('Kennungen der Saat sind deterministisch und haben die Form einer UUID v4', () => {
    const a = demoUuid('x', sha), b = demoUuid('x', sha);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(demoUuid('y', sha)).not.toBe(a);
  });
});

// ── Saat und Zurücksetzen gegen einen echten (temporären) Datenordner ──

type Handler = (r: Request) => Promise<Response>;
let demoRoute: { GET: Handler; POST: Handler };
let server: typeof import('@/lib/demo/server');
let db: typeof import('@/lib/store/local-db');
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
const zuruecksetzen = (person: string, body: unknown = { aktion: 'zuruecksetzen', bestaetigt: true }) => new Request('http://test/api/demo', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) });

function alleDateien(d: string): string[] {
  const aus: string[] = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) aus.push(...alleDateien(p)); else aus.push(p);
  }
  return aus;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  server = await import('@/lib/demo/server');
  demoRoute = (await import('@/app/api/demo/route')) as unknown as typeof demoRoute;
}, 60_000);
afterAll(() => { rmSync(wurzel, { recursive: true, force: true }); });

describe('Wächter: ohne MAKE_OS_DEMO=1 gibt es den Weg nicht', () => {
  it('GET und POST /api/demo → 404, auch für den Inhaber', async () => {
    expect(istDemoInstanz()).toBe(false);
    expect((await demoRoute.GET(new Request('http://test/api/demo', { headers: sitzung('lena') }))).status).toBe(404);
    expect((await demoRoute.POST(zuruecksetzen('lena'))).status).toBe(404);
  });
});

describe('Saat', () => {
  it('bricht ab bei „.data“ im Pfad — vor jedem Schreiben', async () => {
    const vorher = process.env.MAKE_OS_DATEN_DIR;
    process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, '.data');
    await expect(server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo' })).rejects.toBeInstanceOf(server.DemoGesperrt);
    process.env.MAKE_OS_DATEN_DIR = vorher;
    expect(() => statSync(ordner)).toThrow();
  });

  it('sät eine vollständige, erfundene Demo über die Schreibwege', async () => {
    const b = await server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo', heute: localDay() }); // echtes Heute: die Deal-Prüfung vergleicht mit der Uhr
    const n = Object.fromEntries(b.schritte.map(s => [s.name, s.anzahl]));
    expect(n).toMatchObject({ Konten: 2, Team: 3, 'CRM: Kontakte': 8, 'CRM: Deals': 4, Gesellschaften: 4, Meilensteine: 5, 'Wochenpläne festgehalten': 4, 'Wissen (Notizen)': 4 });
    const crm = await db.loadJson<{ chancen: unknown[]; mandate: unknown[]; leistungen: { status: string }[]; firmen: unknown[] }>('crm');
    expect(crm?.chancen).toHaveLength(4);
    expect(crm?.mandate).toHaveLength(2);
    expect(crm?.leistungen.every(l => l.status === 'aktiv')).toBe(true);
    const konten = await db.loadJson<{ konten: { email: string; haushalt: string }[] }>('konten');
    expect(konten?.konten.every(k => k.email.endsWith('@example.invalid') && k.haushalt === 'demo')).toBe(true);
    const reg = await db.loadJson<{ gesellschaften: { id: string; rolle?: string; gesellschafter?: unknown[] }[] }>('gesellschaften--demo');
    expect(reg?.gesellschaften.find(g => g.id === 'kdv')?.rolle).toBe('holding');
    expect(reg?.gesellschaften.some(g => g.id.startsWith('g-') && (g.gesellschafter ?? []).length === 2)).toBe(true);
    const ms = await db.loadJson<{ meilensteine: { id: string }[] }>('meilensteine');
    expect(ms?.meilensteine.filter(m => m.id.startsWith('ms-fahrplan-')).length).toBe(9);
    // Plan-Treue aus festgehaltenen Wochen.
    const { kapaKennzahlenFuerIndex } = await import('@/lib/kapazitaet/server');
    const kz = await kapaKennzahlenFuerIndex(localDay());
    expect(kz?.planTreueQuelle).toBe('festgehalten');
    expect(kz?.treueWochen?.length).toBe(3);
    expect(kz?.planTreue).toBeGreaterThan(0);
    expect(await db.loadJson(DEMO_MARKE)).toMatchObject({ saat: 1, haushalt: 'demo' });
  }, 240_000);

  it('nichts aus unserem Bestand: keine echten Namen, Firmen oder Adressen in den Dateien der Demo', () => {
    const VERBOTEN = new RegExp(['Kev' + 'in', 'Mal' + 'in', 'Dieck' + 'mann', 'KEM' + 'ARIS', 'POIN' + 'CAP', 'KD Ven' + 'tures', 'MAKE Inno' + 'vation', 'kemaris\\.de', 'makeinnovation\\.de'].join('|'), 'i');
    const funde: string[] = [];
    for (const f of alleDateien(ordner)) {
      if (/\.sqlite/.test(f)) continue;
      // Feldnamen des Rechenkerns (`kevinBrutto`, `malinAb` …) sind Schema, keine Daten — Plattform-Schuld, PLATTFORM_PLAN Paket 1.
      const t = readFileSync(f, 'utf8').replace(/"[a-z]*(?:kevin|malin|Kevin|Malin)[A-Za-z]*":/g, '"_":');
      const m = t.match(VERBOTEN);
      if (m) funde.push(`${path.relative(ordner, f)}: „${m[0]}“ … ${t.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 60).replace(/\s+/g, ' ')}`);
      for (const a of t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g) ?? []) if (!/\.(invalid|example)$/i.test(a)) funde.push(`${path.relative(ordner, f)}: Adresse ${a}`);
    }
    expect(funde, funde.slice(0, 20).join('\n')).toEqual([]);
  });

  it('ein zweites Säen in den gefüllten Ordner bricht ab', async () => {
    await expect(server.demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo' })).rejects.toBeInstanceOf(server.DemoGesperrt);
  });
});

describe('Zurücksetzen (MAKE_OS_DEMO=1)', () => {
  it('alles bleibt bearbeitbar und löschbar — kein Sonderweg', async () => {
    process.env.MAKE_OS_DEMO = '1';
    const firmen = (await import('@/app/api/crm/bestand/route')) as unknown as { PATCH: Handler };
    const r = await firmen.PATCH(new Request('http://test/api/crm/bestand', { method: 'PATCH', headers: sitzung('lena'), body: JSON.stringify({ ops: [{ liste: 'firmen', op: 'teil', id: 'f-demo-atlas', felder: { name: 'Atlas Software GmbH (geändert)' } }] }) }));
    expect(r.status).toBe(200);
    const crm = await db.loadJson<{ firmen: { id: string; name: string }[] }>('crm');
    expect(crm?.firmen.find(f => f.id === 'f-demo-atlas')?.name).toBe('Atlas Software GmbH (geändert)');
  });

  it('nur der Inhaber, nur mit Bestätigung — dann Ausgangsstand, Anmeldung bleibt', async () => {
    process.env.MAKE_OS_DEMO = '1';
    expect((await demoRoute.POST(zuruecksetzen('jonas'))).status).toBe(403);
    expect((await demoRoute.POST(zuruecksetzen('lena', { aktion: 'zuruecksetzen' }))).status).toBe(400);
    const dienst = new Request('http://test/api/demo', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-demo', 'x-make-person': 'lena' }, body: JSON.stringify({ aktion: 'zuruecksetzen', bestaetigt: true }) });
    expect((await demoRoute.POST(dienst)).status).toBe(403);
    const g = await (await demoRoute.GET(new Request('http://test/api/demo', { headers: sitzung('lena') }))).json();
    expect(g).toMatchObject({ demo: true, inhaber: true, darf: true, gruende: [] });
    const vorher = (await db.loadJson<{ konten: { speicher: string; salz: string }[] }>('konten'))?.konten.find(k => k.speicher === 'lena')?.salz;
    const r = await demoRoute.POST(zuruecksetzen('lena'));
    expect(r.status).toBe(200);
    const crm = await db.loadJson<{ firmen: { id: string; name: string }[] }>('crm');
    expect(crm?.firmen.find(f => f.id === 'f-demo-atlas')?.name).toBe('Atlas Software GmbH');
    expect((await db.loadJson<{ konten: { speicher: string; salz: string }[] }>('konten'))?.konten.find(k => k.speicher === 'lena')?.salz).toBe(vorher);
  }, 240_000);

  it('gesperrt, sobald ein echtes Konto im Ordner steht (nichts wird gelöscht)', async () => {
    process.env.MAKE_OS_DEMO = '1';
    await db.updateJson<{ konten: { email: string }[] }>('konten', k => ({ ...(k as { konten: { email: string }[] }), konten: [...(k?.konten ?? []), { ...(k?.konten[1] ?? {}), email: 'jemand@firma-beispiel.de' }] }));
    const r = await demoRoute.POST(zuruecksetzen('lena'));
    expect(r.status).toBe(409);
    expect((await r.json()).gruende.join(' ')).toMatch(/echte Konten/);
    expect(await db.loadJson('crm')).not.toBeNull();
    delete process.env.MAKE_OS_DEMO;
  });
});
