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
    expect(n).toMatchObject({ Konten: 3, Team: 4, 'CRM: Kontakte': 8, 'CRM: Deals': 4, Gesellschaften: 4, Meilensteine: 5, 'Wochenpläne festgehalten': 4, 'Wissen (Notizen)': 4, 'Körper-Profil': 1, Erholung: 1, 'Markttraktion-Planung': 5 });
    // Markttraktion › Planung (10.10.): zwei erfundene Leadkanäle, ein Umsatzziel, eine Challenge — im Bestand des Demo-Haushalts.
    const pl = await db.loadJson<{ kanaele: unknown[]; ziele: { gesellschaft: string }[]; challenges: unknown[] }>('markttraktion-planung--demo');
    expect(pl?.kanaele).toHaveLength(2);
    expect(pl?.ziele.map(z => z.gesellschaft)).toEqual(['ug']);
    expect(pl?.challenges).toHaveLength(1);

    expect(n).toMatchObject({ Konten: 3, Team: 4, 'CRM: Kontakte': 8, 'CRM: Deals': 4, Gesellschaften: 4, Meilensteine: 5, 'Wochenpläne festgehalten': 4, 'Wissen (Notizen)': 4, 'Körper-Profil': 1, Erholung: 1, 'Unternehmen › Schild': 1 });

    // Produkte · Leistungstreppe (10.10.): eine erfundene Beispiel-Treppe mit zwei Paketen auf derselben Ebene, Kundenreise, Roadmap, Positionierung.
    expect(n['Leistungstreppe']).toBe(4);
    const tp = await db.loadJson<{ stufen: { ebene: number }[]; kreislauf: unknown[]; roadmap: unknown[]; positionierung: { claim?: string }; kunden: Record<string, unknown> }>('produkt-treppe--demo');
    expect(tp?.stufen.map(s => s.ebene)).toEqual([1, 2, 3, 3]);
    expect(tp?.kreislauf).toHaveLength(5);
    expect(tp?.roadmap).toHaveLength(1);
    expect(tp?.positionierung.claim).toBeTruthy();
    expect(Object.keys(tp?.kunden ?? {})).toEqual(['m-demo-nordwerk']);
    // Erholung (10.10.): ein erfundenes Programm, eine Serie (2 von 6), ein Ziel, ein paar Einheiten — über die Erholungs-Route, mit Suffix.
    const eh = await db.loadJson<{ programme: { name: string }[]; behandlungen: { termine: { erledigt: boolean }[] }[]; einheiten: unknown[]; ziele: unknown[] }>('erholung--lena');
    expect(eh?.programme.map(p => p.name)).toEqual(['Mobility am Morgen (Beispiel)']);
    expect(eh?.behandlungen[0].termine.filter(t => t.erledigt)).toHaveLength(2);
    expect(eh?.einheiten).toHaveLength(4);
    expect(eh?.ziele).toHaveLength(1);
    // Heute (10.10.): zwei Freigaben von ZOE im Stapel und die Top 3 von Lena im Business (ZOEs Vorschlag übernommen) — Privat bleibt im Zustand „Vorschlag“.
    expect(n['Heute: Top 3 und Freigaben']).toBeGreaterThanOrEqual(4);
    const t3 = await db.loadJson<{ tage: Record<string, { business?: { ids: string[]; von: string }; privat?: unknown }> }>('heute-top3--lena');
    const heuteTag = Object.values(t3?.tage ?? {})[0];
    expect(heuteTag?.business?.ids.length).toBeGreaterThanOrEqual(2);
    expect(heuteTag?.business?.von).toBe('vorschlag');
    expect(heuteTag?.privat).toBeUndefined();
    const stapel = await db.loadJson<{ vorschlaege: { person?: string; status: string; nachher?: string }[] }>('zoe-stapel');
    const offenLena = (stapel?.vorschlaege ?? []).filter(v => v.person === 'lena' && v.status === 'offen');
    expect(offenLena.length).toBeGreaterThanOrEqual(2);
    expect(offenLena.some(v => v.nachher?.includes('Angebot Grünfeld Bau nachfassen'))).toBe(true);
    const crm = await db.loadJson<{ chancen: { id: string; stufe: string }[]; mandate: unknown[]; leistungen: { status: string }[]; firmen: unknown[]; angebote?: { status: string; dealId?: string; nummer?: string }[]; wertelisten?: { reihen?: { id: string; name: string }[] } }>('crm');
    expect(crm?.chancen).toHaveLength(4);
    // Abnahme 14.10. (B15): der Deal in Stufe „Angebot“ hat ein GESTELLTES Angebot (Nummer, über die Route) — keine neue Chance dafür.
    const gestellt = (crm?.angebote ?? []).filter(a => a.status === 'gestellt');
    expect(gestellt).toHaveLength(1);
    expect(gestellt[0].nummer).toBeTruthy();
    expect(crm?.chancen.find(c => c.id === gestellt[0].dealId)?.stufe).toBe('angebot');
    expect(n['Angebot (gestellt)']).toBe(1);
    // Reihen sind Instanz-Daten (14.10.): die Demo hat eine erfundene Reihe in den Wertelisten.
    expect(crm?.wertelisten?.reihen?.map(r => r.name)).toEqual(['Abendreihe Nord (Beispiel)']);
    // Drei Mandate: Nordwerk, Lumen und (17.10. abends) der Kunde des Beispiel-Falls in Ausführung (lib/demo/fulfillment-ablauf.ts).
    expect(crm?.mandate).toHaveLength(3);
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
    // KI-Beispiele (15.10., B13) nur mit MAKE_OS_DEMO=1 — diese Saat lief ohne: keine Berichte der Heads.
    expect(await db.loadJson('head-sales')).toBeNull();
  }, 240_000);

  // 15.10. (Abnahme 2 B10/B12): stimmige Finanzen und ein Unternehmen ohne Schieflage — dieselbe Saat, über die Routen.
  it('B10: Retainer im Liquiditätsplan, Jahresziel und Ist-Zahlen, Gehälter in der Finanzplanung, Steuern der Hauptgesellschaft', async () => {
    const heute = localDay();
    const lp = await db.loadJson<{ posten: { id: string; kategorie?: string; betrag: number; sicher: boolean; rhythmus: string }[] }>('liquiplan');
    // Die drei laufenden Retainer (17.10. abends: dazu der Kunde des Beispiel-Falls in Ausführung) — über den Vorschlagsweg „Mandat → Liquiplan“.
    // Seit 18.10. (N4) kommt für ein Mandat, das in diesem Monat mitten im Monat begann, der angebrochene Monat als eigener einmaliger Posten dazu.
    const mandatPosten = lp!.posten.filter(p => p.kategorie === 'mandat' && p.betrag > 0 && p.sicher);
    expect(mandatPosten.filter(p => p.rhythmus === 'monatlich')).toHaveLength(3);
    expect(mandatPosten.filter(p => p.rhythmus !== 'monatlich').every(p => p.rhythmus === 'einmalig' && p.id.includes('~'))).toBe(true);
    expect(lp!.posten.some(p => p.betrag < 0)).toBe(true);
    const crm = await db.loadJson<{ mandate: { planpostenId?: string }[] }>('crm');
    expect(crm!.mandate.every(m => !!m.planpostenId)).toBe(true);
    const fin = await db.loadJson<{ zielUmsatz: number; zielGewinn: number; jahr: number }>('finance');
    expect(fin).toMatchObject({ jahr: Number(heute.slice(0, 4)) });
    expect(fin!.zielUmsatz).toBeGreaterThan(0);
    const ab = await db.loadJson<{ eintraege: { firma: string; monat: string }[] }>('business-abschluesse');
    expect(ab?.eintraege.filter(e => e.firma === 'ug').length ?? 0).toBe(Number(heute.slice(5, 7)) - 1);
    const plan = await db.loadJson<{ annahmen: Record<string, unknown> }>('finanzen-plan--demo');
    expect(Object.entries(plan!.annahmen).filter(([k, v]) => k.endsWith('Brutto') && typeof v === 'number' && v > 0)).toHaveLength(2);
    const { steuernStand } = await import('@/lib/steuern/speicher');
    const st = await steuernStand(heute, 'business');
    expect(st.alleFristen.some(f => f.einheit === 'ug')).toBe(true);
    expect(st.alleFristen.filter(f => f.datum < heute && !f.erledigt)).toEqual([]);
    if (Number(heute.slice(5, 7)) > 1) expect(st.prognose.zeilen.find(z => z.id === 'kst-ug')?.betrag).toBeGreaterThan(0);
  });

  it('B12: keine verstrichene Pflicht, höchstens EINE offene Frist, Risiken unter der Tragfähigkeit, keine überfällige Aufgabe', async () => {
    const heute = localDay();
    const { unternehmenLage } = await import('@/lib/gesellschaften/schild-server');
    const lage = await unternehmenLage('demo', heute);
    const pflichten = lage.gesellschaften.flatMap(g => g.pflichten);
    expect(pflichten.filter(p => p.status === 'ueberfaellig')).toEqual([]);
    expect(pflichten.filter(p => p.status === 'faellig').length).toBeLessThanOrEqual(1);
    for (const g of lage.gesellschaften) expect(g.aggregation.warnung, g.name).toBe(false);
    const { lageBlick } = await import('@/lib/gesellschaften/schild/blick');
    const { ladeSchild } = await import('@/lib/gesellschaften/schild-server');
    expect(lageBlick(lage, (await ladeSchild('demo'))?.gesellschaften ?? []).zaehler.rot).toBe(0);
    const tasks = (await db.loadJson<{ tasks: { title: string; status: string; dueDate?: string; geloeschtAm?: string }[] }>('tasks'))!.tasks;
    expect(tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && !t.geloeschtAm && t.dueDate && t.dueDate < heute).map(t => t.title)).toEqual([]);
  });

  it('drittes Konto „nur Business“ (E4-Rest, 09.10.): der Partner sieht Business, aus dem Privat-Bereich nichts — Lena alles', async () => {
    const { DEMO_PARTNER } = await import('@/lib/demo/saat');
    const konten = await db.loadJson<{ konten: { speicher: string; finanzRecht?: string; rolle: string; haushalt: string; email: string }[] }>('konten');
    const p = konten?.konten.find(k => k.speicher === DEMO_PARTNER.speicher);
    expect(p).toMatchObject({ finanzRecht: 'business', rolle: 'mitglied', haushalt: 'demo' });
    expect(p?.email.endsWith('@example.invalid')).toBe(true);
    const sitzungVon = (wer: string) => ({ headers: { 'content-type': 'application/json', 'x-make-user': wer } });
    const ROUTEN = { ziele: () => import('@/app/api/state/ziele/route'), routinen: () => import('@/app/api/state/routinen/route'), meilensteine: () => import('@/app/api/state/meilensteine/route') };
    const lies = async (modul: keyof typeof ROUTEN, pfad: string, wer: string) => {
      const m = (await ROUTEN[modul]()) as unknown as { GET: (r: Request) => Promise<Response> };
      const r = await m.GET(new Request(`http://test${pfad}`, sitzungVon(wer)));
      expect(r.status, `${pfad} ${wer}`).toBe(200);
      return r.text();
    };
    const PRIVAT = ['Vier Wochen Urlaub ohne Laptop', 'Gemeinsames Abendessen ohne Handy', 'Spaziergang an der frischen Luft'];
    const partner = [await lies('ziele', '/api/state/ziele', DEMO_PARTNER.speicher), await lies('routinen', '/api/state/routinen', DEMO_PARTNER.speicher), await lies('meilensteine', '/api/state/meilensteine', DEMO_PARTNER.speicher)].join('\n');
    expect(PRIVAT.filter(t => partner.includes(t))).toEqual([]);
    expect(partner).toContain('Pipeline-Abgleich mit Lena'); // seine eigene Business-Routine
    expect(partner).toContain('Wiederkehrender Umsatz'); // Business-Ziel
    const lena = [await lies('ziele', '/api/state/ziele', 'lena'), await lies('routinen', '/api/state/routinen', 'lena')].join('\n');
    expect(PRIVAT.filter(t => !lena.includes(t))).toEqual([]);
  });

  // 14.10. (Abnahme A2/B4): die Demo zeigt keinen Betreiber-Schritt (Server, Repo-Dateien) — auch nicht mit MAKE_OS_BETREIBER=an (Demo-Riegel) —,
  // und „Einrichtung x von y“ ist an allen Orten dieselbe Zahl (Route/Heute/Einrichtung über `einrichtungStand`, Startfläche über `fortschritt`).
  it('Einrichtung in der Demo: kein Betreiber-Schritt, keine Betreiber-Befunde, eine Zählung', async () => {
    const vorher = { demo: process.env.MAKE_OS_DEMO, betreiber: process.env.MAKE_OS_BETREIBER };
    process.env.MAKE_OS_DEMO = '1'; process.env.MAKE_OS_BETREIBER = 'an';
    try {
      const route = (await import('@/app/api/onboarding/route')) as unknown as { GET: Handler; POST: Handler };
      const D = await import('@/lib/make-one/onboarding-data');
      const { fortschritt } = await import('@/lib/onboarding-status');
      for (const wer of ['lena', 'jonas']) {
        const r = await route.GET(new Request('http://test/api/onboarding', { headers: sitzung(wer) }));
        expect(r.status, wer).toBe(200);
        const d = (await r.json()) as { erledigt: Record<string, { at: string; von: string }>; befunde: Record<string, { erfuellt: boolean; wert: string }>; ich: import('@/lib/make-one/onboarding-data').Kontext };
        expect(d.ich.betreiber, wer).toBe(false);
        const meine = D.schritteFuer(d.ich);
        expect(meine.filter(s => s.betreiber).map(s => s.id), wer).toEqual([]);
        expect(Object.keys(d.befunde).filter(k => D.BETREIBER_PRUEFUNGEN.includes(k)), wer).toEqual([]);
        const texte = meine.flatMap(s => [s.titel, s.warum, ...s.wie, s.danach ?? '', s.befehl ?? '']).join('\n');
        expect(texte, wer).not.toMatch(/\b(?:git|docker)\s+[a-z]|\.env\b|\/srv\/|\b[A-Z][A-Z0-9_]+\.md\b/);
        const stand = D.einrichtungStand(d.ich, d);
        const start = await fortschritt(wer);
        expect({ fertig: start.fertig, gesamt: start.gesamt }, wer).toEqual({ fertig: stand.fertig, gesamt: stand.gesamt });
      }
      // Abhaken eines Betreiber-Schritts geht in der Demo nicht (403, nichts gespeichert).
      const post = await route.POST(new Request('http://test/api/onboarding', { method: 'POST', headers: sitzung('lena'), body: JSON.stringify({ id: 'update', an: true }) }));
      expect(post.status).toBe(403);
    } finally {
      if (vorher.demo === undefined) delete process.env.MAKE_OS_DEMO; else process.env.MAKE_OS_DEMO = vorher.demo;
      if (vorher.betreiber === undefined) delete process.env.MAKE_OS_BETREIBER; else process.env.MAKE_OS_BETREIBER = vorher.betreiber;
    }
  });

  it('nichts aus unserem Bestand: keine echten Namen, Firmen oder Adressen in den Dateien der Demo', () => {
    const VERBOTEN = new RegExp(['Kev' + 'in', 'Mal' + 'in', 'Dieck' + 'mann', 'KEM' + 'ARIS', 'POIN' + 'CAP', 'KD Ven' + 'tures', 'MAKE Inno' + 'vation', 'kemaris\\.de', 'makeinnovation\\.de'].join('|'), 'i');
    const funde: string[] = [];
    for (const f of alleDateien(ordner)) {
      if (/\.sqlite/.test(f)) continue;
      // Feldnamen des Rechenkerns (`kevinBrutto`, `malinAb` …) sind Schema, keine Daten — Plattform-Schuld, PLATTFORM_PLAN Paket 1.
      // 15.10.: dieselben Feldnamen stehen auch als Pfad im Protokoll der Finanzplanung (`/annahmen/kevinBrutto`) — die Demo setzt Gehälter (B10).
      const t = readFileSync(f, 'utf8').replace(/"[a-z]*(?:kevin|malin|Kevin|Malin)[A-Za-z]*":/g, '"_":').replace(/\/annahmen\/(?:kevin|malin)(?:Brutto|Ab)\b/g, '/annahmen/_');
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
    // Inbox (10.10.): Demo-Postfach mit erfundener Post, zwei Übergaben an Jonas (eine mit mitgegebenem PDF), Aufgaben-Vorschläge in Lenas
    // Freigaben, die Suche findet bei Jonas die Kopie über den Anhang-Namen — und nichts aus Lenas Postfach.
    const ub = await db.loadJson<{ uebergaben: { an: string; nachrichten: { anhaenge: { ablage?: string }[] }[] }[] }>('inbox-uebergaben--demo');
    expect(ub?.uebergaben.filter(u => u.an === 'jonas')).toHaveLength(2);
    expect(ub?.uebergaben.some(u => u.nachrichten.some(n => n.anhaenge.some(a => a.ablage)))).toBe(true);
    const { lies } = await import('@/lib/zoe/stapel');
    expect((await lies('offen')).filter(v => v.bezug?.art === 'inbox' && v.person === 'lena').length).toBeGreaterThan(0);
    const suche = (await import('@/app/api/inbox/suche/route')) as unknown as { GET: Handler };
    const treffer = async (q: string, p: string) => ((await (await suche.GET(new Request(`http://test/api/inbox/suche?q=${q}`, { headers: sitzung(p) }))).json()).treffer ?? []) as { art: string }[];
    expect((await treffer('Rechnung-2026', 'jonas')).map(t => t.art)).toEqual(['uebergabe']);
    expect(await treffer('Kooperationsanfrage', 'jonas')).toEqual([]);
    expect((await treffer('Kooperationsanfrage', 'lena')).length).toBe(1);
    // KI-Beispiele (15.10., B13): mit MAKE_OS_DEMO=1 zeigt die Demo Ergebnisse der Heads, des Head of Finance, von ZOE und der Analyse —
    // jedes als Beispiel markiert (Riegel und Einzelheiten: tests/demo-ki-beispiele.test.ts).
    const { istBeispiel } = await import('@/lib/demo/beispiel');
    for (const h of ['head-sales', 'head-marketing', 'head-event', 'haushalt-chef--demo']) {
      const sth = await db.loadJson<{ berichte: unknown[]; vorschlaege: unknown[] }>(h);
      expect(sth?.berichte.some(istBeispiel), h).toBe(true);
      expect(sth!.vorschlaege.filter(istBeispiel).length, h).toBeGreaterThanOrEqual(2);
    }
    expect((await lies('offen')).filter(v => v.person === 'lena' && istBeispiel(v)).length).toBeGreaterThanOrEqual(3);
    const ds = await db.loadJson<{ dossiers: Record<string, { beispiel?: true; laeufe: { beispiel?: true }[] }> }>('fulfillment-dossiers--demo');
    const dossier = Object.values(ds?.dossiers ?? {})[0];
    expect(dossier?.beispiel).toBe(true);
    expect(dossier!.laeufe.filter(istBeispiel).length).toBeGreaterThan(0);
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
