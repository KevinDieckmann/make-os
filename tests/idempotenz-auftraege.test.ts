// Paket D-A (29.09.): Idempotenz der Beleg-Übernahme (#19), Pacht-Token der Auftragswarteschlange (#20),
// Angebots-PDF außerhalb der CRM-Sperre mit Nummern-Reservierung und Stand-Prüfung (#13). Eigener Datenordner.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Angebot, Leistung } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-idem-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-idempotenz';
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); });

describe('einmalig (anfrageId, 24 h)', () => {
  it('Wiederholung liefert die erste Antwort, gleichzeitige Doppelklicks wirken einmal, Ablehnungen werden nicht gemerkt', async () => {
    const { einmalig } = await import('@/lib/store/anfragen');
    let n = 0;
    const wirkung = async () => { n++; await new Promise(r => setTimeout(r, 20)); return { status: 200, body: { ok: true, nr: n } }; };
    const [a, b] = await Promise.all([einmalig('probe', 'anf-12345678', wirkung), einmalig('probe', 'anf-12345678', wirkung)]);
    expect(n).toBe(1);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const c = await einmalig('probe', 'anf-12345678', wirkung);
    expect(c).toMatchObject({ status: 200, body: { ok: true, nr: 1 }, wiederholt: true });
    let m = 0;
    await einmalig('probe', 'anf-abgelehnt1', async () => { m++; return { status: 413, body: { ok: false } }; });
    await einmalig('probe', 'anf-abgelehnt1', async () => { m++; return { status: 200, body: { ok: true } }; });
    expect(m).toBe(2);
    // nach 24 h vergessen
    const spaeter = () => Date.now() + 25 * 3_600_000;
    expect((await einmalig('probe', 'anf-12345678', wirkung, spaeter)).wiederholt).toBeUndefined();
    expect(n).toBe(2);
  });
  it('Beleg-Übernahme: derselbe Klick zweimal (Netz-Retry) legt EINE Rechnung an', async () => {
    const route = await import('@/app/api/beleg/uebernehmen/route');
    const body = { ziel: 'rechnung', partner: 'Beispiel GmbH', betragBrutto: 119, betragNetto: 100, ustSatz: 19, anfrageId: 'anf-beleg-0001' };
    const schick = () => route.POST(new Request('http://t/api/beleg/uebernehmen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    const r1 = await (await schick()).json();
    const r2 = await (await schick()).json();
    expect(r1.ok).toBe(true);
    expect(r2).toMatchObject({ ok: true, wiederholt: true, angelegt: r1.angelegt });
    const plan = await db.loadJson<{ rechnungen: { id: string }[] }>('finanzplan');
    expect(plan!.rechnungen).toHaveLength(1);
    expect(plan!.rechnungen[0].id).toMatch(/^r-[0-9a-f-]{36}$/);
  });
});

describe('Auftragswarteschlange: Pacht-Token', () => {
  it('nur der aktuelle Halter meldet; nach Ablauf und Neuvergabe wirkt der alte Läufer nicht mehr', async () => {
    const q = await import('@/lib/zoe/auftraege');
    await q.reihe([{ art: 'agent', name: 'probe-lauf' }]);
    const [a] = await q.nimm(1, 60);
    expect(a.pachtToken).toMatch(/^pacht-/);
    expect(await q.melde(a.id, 'falscher-token', 'fertig', 'x')).toBe(false);
    expect((await q.pachtGueltig(a.id, a.pachtToken))?.id).toBe(a.id);
    // Pacht abgelaufen → neu vergeben
    await db.updateJson<{ auftraege: import('@/lib/zoe/auftraege').Auftrag[] }>('zoe-auftraege', c => ({ auftraege: c!.auftraege.map(x => (x.id === a.id ? { ...x, pachtBis: new Date(Date.now() - 1000).toISOString() } : x)) }));
    const [b] = await q.nimm(1, 60);
    expect(b.id).toBe(a.id);
    expect(b.pachtToken).not.toBe(a.pachtToken);
    expect(await q.melde(a.id, a.pachtToken!, 'fertig', 'alter Läufer')).toBe(false);
    expect(await q.pachtGueltig(a.id, a.pachtToken)).toBeNull();
    expect(await q.melde(b.id, b.pachtToken!, 'fertig', 'neuer Läufer')).toBe(true);
    const fertig = (await q.lies()).find(x => x.id === a.id)!;
    expect(fertig).toMatchObject({ status: 'fertig', ergebnis: 'neuer Läufer' });
    expect(fertig.pachtToken).toBeUndefined();
  });
  it('Lauf-Route: ohne gültigen Token 409, nichts ausgeführt', async () => {
    const q = await import('@/lib/zoe/auftraege');
    await q.reihe([{ art: 'agent', name: 'probe-zwei' }]);
    const [a] = await q.nimm(1, 60);
    const route = await import('@/app/api/zoe/auftraege/lauf/route');
    const r = await route.POST(new Request('http://t/api/zoe/auftraege/lauf', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! }, body: JSON.stringify({ id: a.id, token: 'alt' }) }));
    expect(r.status).toBe(409);
    expect((await q.lies()).find(x => x.id === a.id)?.status).toBe('laeuft');
  });
});

describe('Angebot stellen: PDF außerhalb der CRM-Sperre', () => {
  const J = '2026-09-01T10:00:00.000Z';
  const L: Leistung = { id: 'l-probe', name: 'Probe-Retainer', typ: 'retainer', stufe: 'kern', preis: { betrag: 1000, einheit: 'Monat netto', basis: 'monat' }, laufzeitMonate: 3, lieferumfang: [], gesellschaft: 'kdv', status: 'aktiv', angebot: { leistungstext: 'Text.' }, geaendert: J };
  const k = (id: string): Kontakt => ({ id, vorname: 'Anna', nachname: `Probe ${id}`, email: `${id}@example.invalid`, eignung: '', prio: '', stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01' });
  let waehrendPdf: (() => Promise<void>) | null = null;
  let speicher: typeof import('@/lib/crm/speicher');
  let server: typeof import('@/lib/crm/angebot-server');
  beforeAll(async () => {
    vi.doMock('@/lib/crm/angebot-pdf', async (orig) => {
      const echt = await orig<typeof import('@/lib/crm/angebot-pdf')>();
      return { ...echt, angebotPdf: async (...a: Parameters<typeof echt.angebotPdf>) => { if (waehrendPdf) await waehrendPdf(); return echt.angebotPdf(...a); } };
    });
    speicher = await import('@/lib/crm/speicher');
    server = await import('@/lib/crm/angebot-server');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@test', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'probe-haus' }], einladungen: [] });
    await db.saveJson('kontakte', { kontakte: [k('c-probe1'), k('c-probe2')] });
    await db.saveJson('crm', { ...speicher.leererBestand(), leistungen: [L] });
    await db.saveJson('gesellschaften--probe-haus', { gesellschaften: [{ id: 'kdv', firmierung: 'Probe UG', strasse: 'Weg 1', plz: '12345', ort: 'Stadt', email: 'x@example.invalid' }] });
  });
  const entwurf = async (id: string, kontaktId: string): Promise<Angebot> => {
    const { standVon } = await import('@/lib/crm/crm-stand');
    await speicher.aendereCrm(b => ({ ...b, angebote: [...(b.angebote ?? []), { id, status: 'entwurf', version: 1, gesellschaft: 'kdv', kontaktId, titel: `Angebot ${id}`, einleitung: '', schluss: '', positionen: [{ id: 'p1', titel: 'Leistung', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: 100000, ustSatz: 19, basis: 'monat', laufzeitMonate: 3 }], gueltigBis: '2099-12-31', zahlungszielTage: 14, angelegt: J, geaendert: J, geaendertVon: 'kevin' } as unknown as Angebot] }));
    const a = (await speicher.ladeCrm()).angebote!.find(x => x.id === id)!;
    return { ...a, stand: standVon(a) } as Angebot & { stand: string };
  };

  it('während das PDF entsteht, schreibt ein anderer CRM-Weg ungehindert (keine Sperre gehalten)', async () => {
    const a = await entwurf('ang-probe-1', 'c-probe1');
    let geschrieben = false;
    waehrendPdf = async () => { await speicher.aendereCrm(b => ({ ...b, segmente: b.segmente })); geschrieben = true; };
    const r = await server.angebotStellen({ id: a.id, stand: (a as Angebot & { stand: string }).stand, person: 'kevin', haushalt: 'probe-haus' });
    waehrendPdf = null;
    expect(geschrieben).toBe(true);
    expect(r.angebot).toMatchObject({ status: 'gestellt', lauf: { nr: 1 } });
    expect(r.angebot.nummer).toMatch(/0001/);
  });
  it('ändert jemand den Entwurf, während das PDF entsteht: 409, PDF wieder weg, nichts gestellt; der nächste Versuch nimmt dieselbe Nummer', async () => {
    const a = await entwurf('ang-probe-2', 'c-probe2');
    const { ablageListe } = await import('@/lib/dateien/ablage');
    const vorher = (await ablageListe('probe-haus')).length;
    waehrendPdf = async () => { await speicher.aendereCrm(b => ({ ...b, angebote: b.angebote!.map(x => (x.id === 'ang-probe-2' ? { ...x, titel: 'anders' } : x)) })); };
    await expect(server.angebotStellen({ id: a.id, stand: (a as Angebot & { stand: string }).stand, person: 'kevin', haushalt: 'probe-haus' })).rejects.toMatchObject({ status: 409 });
    waehrendPdf = null;
    expect((await ablageListe('probe-haus')).length).toBe(vorher);
    const jetzt = (await speicher.ladeCrm()).angebote!.find(x => x.id === 'ang-probe-2')!;
    expect(jetzt.status).toBe('entwurf');
    const { standVon } = await import('@/lib/crm/crm-stand');
    const r = await server.angebotStellen({ id: a.id, stand: standVon(jetzt), person: 'kevin', haushalt: 'probe-haus' });
    expect(r.angebot.lauf?.nr).toBe(2);
    expect(r.angebot.nummer).toMatch(/0002/);
  });
});
