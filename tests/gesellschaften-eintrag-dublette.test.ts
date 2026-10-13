// Gesellschafts-Register: nie still doppelt (Fund 12.10., Ende-zu-Ende-Test). PATCH /api/gesellschaften mit `liste` + `eintrag`, aber ohne
// `eintragId`, legt einen NEUEN Eintrag an (Kennung vom Server). Trägt der Körper dabei die Kennung eines schon vorhandenen Eintrags (auch im
// Papierkorb), war das ein gemeinter Änderungsversuch: jetzt 409 mit Hinweis, nichts angelegt. Mit `eintragId` ändert die Route wie bisher.
// Eigener Datenordner, erfundene Konten (@example.invalid) und Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-ges-dublette-'));
  process.env.MAKE_OS_DATEN_DIR = o;
  process.env.MAKE_OS_KEY = 'pruef-schluessel-ges-dublette';
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

type Route = { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
type G = { id: string; stand: string; gesellschafter?: { id: string; nennbetragCent: number; geloeschtAm?: string }[]; vertraege?: { id: string; titel: string }[] };

describe('Register: Listeneintrag mit vorhandener Kennung ohne eintragId', () => {
  let reg: Route;
  const kopf = { 'content-type': 'application/json', 'x-make-user': 'person-a' };
  const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied') => ({ id, speicher: sp, email: `${sp}@example.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' });
  const patch = (body: unknown) => reg.PATCH(new Request('http://test/api/gesellschaften', { method: 'PATCH', headers: kopf, body: JSON.stringify(body) }));
  const hole = async (id: string): Promise<G> => ((await (await reg.GET(new Request('http://test/api/gesellschaften?papierkorb=1', { headers: kopf }))).json()) as { gesellschaften: G[] }).gesellschaften.find(x => x.id === id)!;
  const anteil = (nennbetragCent: string) => ({ wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent, einlage: 'ja' });
  let id = '';

  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'person-a', 'inhaber')], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [] });
    reg = (await import('@/app/api/gesellschaften/route')) as unknown as Route;
    const neu = await (await reg.POST(new Request('http://test/api/gesellschaften', { method: 'POST', headers: kopf, body: JSON.stringify({ felder: { name: 'Beispiel Dublette GmbH', rechtsform: 'gmbh', status: 'gruendung', stammkapitalCent: '25.000' } }) }))).json();
    id = neu.gesellschaft.id as string;
  });

  it('ohne eintragId, aber mit der Kennung eines vorhandenen Eintrags → 409 mit Hinweis, nichts angehängt', async () => {
    let g = await hole(id);
    const erster = await (await patch({ id, stand: g.stand, liste: 'gesellschafter', eintrag: anteil('10.000') })).json();
    expect(erster.ok).toBe(true);
    g = await hole(id);
    expect(g.gesellschafter).toHaveLength(1);
    const vorhanden = g.gesellschafter![0].id;

    const r = await patch({ id, stand: g.stand, liste: 'gesellschafter', eintrag: { id: vorhanden, ...anteil('12.000') } });
    expect(r.status).toBe(409);
    const j = await r.json() as { ok: boolean; fehler: string; felder: { feld: string }[] };
    expect(j.ok).toBe(false);
    expect(j.fehler).toMatch(/gibt es schon/);
    expect(j.fehler).toMatch(/eintragId/);
    expect(j.felder[0].feld).toBe('eintragId');
    const nachher = await hole(id);
    expect(nachher.gesellschafter).toHaveLength(1);
    expect(nachher.gesellschafter![0]).toMatchObject({ id: vorhanden, nennbetragCent: 1_000_000 });
    expect(nachher.stand).toBe(g.stand); // gar nicht geschrieben

    // Mit eintragId ändert die Route wie bisher — derselbe Eintrag, keine Dublette.
    const ok = await patch({ id, stand: g.stand, liste: 'gesellschafter', eintragId: vorhanden, eintrag: anteil('12.000') });
    expect(ok.status).toBe(200);
    const geaendert = await hole(id);
    expect(geaendert.gesellschafter).toHaveLength(1);
    expect(geaendert.gesellschafter![0]).toMatchObject({ id: vorhanden, nennbetragCent: 1_200_000 });
  });

  it('ohne Kennung oder mit einer UNBEKANNTEN Kennung legt der Server einen neuen Eintrag mit eigener Kennung an', async () => {
    let g = await hole(id);
    const vorher = g.gesellschafter!.length;
    const a = await (await patch({ id, stand: g.stand, liste: 'gesellschafter', eintrag: anteil('1.000') })).json();
    expect(a.ok).toBe(true);
    g = await hole(id);
    const b = await (await patch({ id, stand: g.stand, liste: 'gesellschafter', eintrag: { id: 'gs-frei-erfunden-0001', ...anteil('2.000') } })).json();
    expect(b.ok).toBe(true);
    g = await hole(id);
    expect(g.gesellschafter).toHaveLength(vorher + 2);
    expect(g.gesellschafter!.some(x => x.id === 'gs-frei-erfunden-0001')).toBe(false); // die Kennung vergibt der Server
  });

  it('auch ein Eintrag im Papierkorb und andere Listen (Vertrag) zählen als „gibt es schon“', async () => {
    let g = await hole(id);
    const v = await (await patch({ id, stand: g.stand, liste: 'vertraege', eintrag: { art: 'gesellschaftsvertrag', titel: 'Satzung', status: 'entwurf', parteien: [] } })).json();
    expect(v.ok).toBe(true);
    g = await hole(id);
    const vid = g.vertraege![0].id;
    const doppelt = await patch({ id, stand: g.stand, liste: 'vertraege', eintrag: { id: vid, art: 'gesellschaftsvertrag', titel: 'Satzung (noch einmal)', status: 'entwurf', parteien: [] } });
    expect(doppelt.status).toBe(409);
    expect((await hole(id)).vertraege).toHaveLength(1);

    // im Papierkorb: weiterhin „gibt es schon“ (sonst entstünde neben dem Papierkorb-Eintrag ein zweiter)
    const korb = await (await patch({ id, stand: g.stand, liste: 'vertraege', eintragId: vid, aktion: 'loeschen' })).json();
    expect(korb.ok).toBe(true);
    g = await hole(id);
    expect(g.vertraege).toHaveLength(1);
    const imKorb = await patch({ id, stand: g.stand, liste: 'vertraege', eintrag: { id: vid, art: 'gesellschaftsvertrag', titel: 'Satzung', status: 'entwurf', parteien: [] } });
    expect(imKorb.status).toBe(409);
    expect((await hole(id)).vertraege).toHaveLength(1);
  });
});
