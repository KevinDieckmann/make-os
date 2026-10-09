// ─── Paket 4c: die Demo-Saat enthält den Agenten-Bereich und „Fotos & Videos“ (09.10.2026) ─────────────────────────────────────
// Eigener Datenordner (vi.hoisted — vor allen Imports), erfundene Daten, KEIN KI-Schlüssel: die Demo muss trotzdem vollständig aussehen
// (gespeicherte Antworten) und darf nie ein Modell aufrufen (fetch und KI-Adapter sind Fallen).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const { wurzel } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-p4c-demo-'));
  const ordner = p.join(wurzel, 'daten');
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: p.join(ordner, 'wissen'), MAKE_OS_KEY: 'pruef-schluessel-demo-4c', MAKE_OS_OHNE_APPLE: '1',
    MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_INTERN: 'http://localhost:3999',
  });
  for (const k of ['MAKE_OS_DATENSCHLUESSEL', 'MAKE_OS_DEMO', 'ANTHROPIC_API_KEY', 'GOOGLE_VERTEX_PROJEKT', 'GOOGLE_VERTEX_DIENSTKONTO', 'MAKE_OS_MEDIEN', 'ICLOUD_APPLE_ID', 'GOOGLE_CLIENT_ID', 'TELEGRAM_BOT_TOKEN']) delete process.env[k];
  return { wurzel };
});

import { localDay } from '@/lib/zeit';
import { headsIm } from '@/lib/agenten/katalog';

type Db = typeof import('@/lib/store/local-db');
let db: Db;
const netz: string[] = [];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  // Fallen: jeder Netz-Aufruf (Modell, Anbieter) wird notiert — die Demo darf keinen machen.
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (u: unknown) => { netz.push(String(u)); return new Response('{}', { status: 500 }); });
  (await import('@/lib/ki/adapter/http'))._kiFetchSetzen(async u => { netz.push(u); return new Response('{}', { status: 500 }); });
  const { demoSaenInLeerenOrdner } = await import('@/lib/demo/server');
  await demoSaenInLeerenOrdner({ passwort: 'pruef-passwort-demo-4c', heute: localDay() });
}, 240_000);
afterAll(async () => { (await import('@/lib/ki/adapter/http'))._kiFetchSetzen(null); vi.restoreAllMocks(); rmSync(wurzel, { recursive: true, force: true }); });

type Faden = import('@/lib/agenten/faeden').FadenKern;
const faeden = async (p: string) => (await (await import('@/lib/agenten/faeden-ablage')).alleFaedenLesen(p)); // E3: Index + je Thread

describe('Demo-Saat: Agenten-Bereich', () => {
  it('je Business-Head mindestens ein Thread mit gespeicherter Antwort (KI-gekennzeichnet), zwei Mitarbeiter-Threads mit Bericht', async () => {
    const alle = [...(await faeden('lena')), ...(await faeden('jonas'))];
    for (const h of headsIm('business')) {
      const t = alle.filter(f => f.agent.art === 'head' && f.agent.headId === h.id);
      expect(t.length, h.id).toBeGreaterThanOrEqual(1);
      expect(t.some(f => f.nachrichten.some(n => n.rolle === 'agent' && n.ki === true)), h.id).toBe(true);
    }
    const kinder = alle.filter(f => f.agent.art === 'mitarbeiter');
    expect(kinder.map(f => f.agent.art === 'mitarbeiter' && f.agent.mitarbeiterId).sort()).toEqual(['marketing-bild-video', 'sales-recherche']);
    for (const k of kinder) {
      expect(k.status).toBe('fertig');
      const eltern = alle.find(f => f.id === k.elternId)!;
      expect(eltern.nachrichten.some(n => n.verweis?.art === 'bericht' && n.verweis.fadenId === k.id)).toBe(true);
      expect(eltern.nachrichten.some(n => n.verweis?.art === 'gesendet' && n.verweis.fadenId === k.id)).toBe(true);
    }
  });
  it('drei Skills (einer aktiv, mit Zeitplan), zwei geplante Hintergrundaufgaben, „Als Nächstes“ gefüllt', async () => {
    const w = await db.loadJson<{ skills: { name: string; aktiv: boolean; ausloeser: { art: string } }[] }>('agenten-skills--demo');
    expect(w?.skills).toHaveLength(3);
    expect(w?.skills.filter(s => s.aktiv).map(s => s.name)).toEqual(['wochenstart-pipeline']);
    const plan = await db.loadJson<{ aufgaben: unknown[] }>('agenten-plan--lena');
    expect(plan?.aufgaben).toHaveLength(2);
    const route = (await import('@/app/api/agenten/laeufe/route')) as unknown as { GET: (r: Request) => Promise<Response> };
    const r = await (await route.GET(new Request('http://demo.invalid/api/agenten/laeufe', { headers: { 'x-make-user': 'lena' } }))).json();
    expect(r.ok).toBe(true);
    expect(r.naechstes.length).toBeGreaterThanOrEqual(2);
    // Rundgang 09.10.: je wiederkehrendem Lauf nur das nächste Vorkommen (keine Serie doppelt).
    const serien = (r.naechstes as { serie?: string }[]).map(n => n.serie).filter(Boolean);
    expect(new Set(serien).size).toBe(serien.length);
  });
  it('Head-Kopf (Rundgang 09.10.): Head of Sales mit Werten aus dem Traktions-Index — eine Lücke trägt ihren Grund statt eines stummen „—“', async () => {
    const route = (await import('@/app/api/agenten/route')) as unknown as { GET: (r: Request) => Promise<Response> };
    for (const person of ['lena', 'jonas']) {
      const a = await (await route.GET(new Request('http://demo.invalid/api/agenten', { headers: { 'x-make-user': person } }))).json() as { heads: { id: string; kennzahlen: { id: string; label: string; wert: string | null; hinweis?: string }[] }[] };
      const sales = a.heads.find(h => h.id === 'sales')!;
      const k = Object.fromEntries(sales.kennzahlen.map(x => [x.id, x]));
      expect(Object.keys(k), person).toEqual(['traktion:gespraeche', 'traktion:win_rate', 'traktion:ueberfaellig']);
      // Gespräche (7 Tage) und überfällige Follow-ups hat die Demo — dieselbe Zahl wie im Markttraktion-Überblick.
      expect(k['traktion:gespraeche'].wert, person).not.toBeNull();
      expect(k['traktion:ueberfaellig'].wert, person).not.toBeNull();
      // Win Rate erst ab 10 Entscheidungen in 180 Tagen (WIN_RATE.mindestens) — die Demo hat nur offene Deals: Lücke mit Grund.
      const wr = k['traktion:win_rate'];
      if (wr.wert === null) expect(wr.hinweis, person).toMatch(/erst ab 10 Entscheidungen/);
      for (const x of sales.kennzahlen) expect(x.wert !== null || !!x.hinweis, `${person}: ${x.label}`).toBe(true);
    }
  });
});

describe('Demo-Saat: Fotos & Videos', () => {
  it('ein Album mit drei erzeugten Bildern: eins freigegeben, eins angefragt, eins beim Head of Marketing (+ Vorschlag im Stapel)', async () => {
    const k = await db.loadJson<import('@/lib/medien/typen').MedienKatalog>('medien--demo');
    expect(k?.alben.map(a => a.titel)).toEqual(['Sommerfest (Beispiel)']);
    expect(k?.medien).toHaveLength(3);
    expect(k?.medien.every(m => m.album === k.alben[0].id && m.erkennbarePersonen === 'nein' && m.typ === 'image/png')).toBe(true);
    expect(k?.medien.map(m => m.marketing.status).sort()).toEqual(['angefragt', 'freigegeben', 'intern']);
    expect(k?.medien.find(m => m.marketing.status === 'intern')?.heads.map(h => h.head)).toEqual(['marketing']);
    const { lies } = await import('@/lib/zoe/stapel');
    expect((await lies('offen')).some(v => v.bezug?.art === 'medien' && v.person === 'lena')).toBe(true);
    // Die Liste der Person (dieselbe Filterstelle wie die Oberfläche).
    const { medienListe } = await import('@/lib/medien/server');
    expect((await medienListe('jonas'))?.medien).toHaveLength(3);
  });
  it('kein Modellaufruf, kein Netz — die Demo sieht ohne KI-Schlüssel vollständig aus', () => {
    expect(netz).toEqual([]);
  });
});
