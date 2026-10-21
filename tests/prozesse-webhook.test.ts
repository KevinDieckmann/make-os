// ─── Prozesse B1 — der abgesicherte Webhook von außen (21.10.; Entscheidung „Ja, abgesichert“) ────────────────────────────────────────────────────────
// Eigene Adresse und eigener Schlüssel je Prozess (nur der Fingerabdruck gespeichert, einmal angezeigt), erst nach Klick scharf, gedrosselt, ≤ 64 KB,
// nur bekannte Felder, alles fremder Text; der Webhook schreibt NUR Eingang + Ereignis `webhook`. Offene Route nur über die enge Regex der Middleware.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { koerperFiltern, schluesselAusKopf, webhookAnwenden, WEBHOOK_PFAD, annahmeLage, eingangAblegen, eingaengeFrist } from '@/lib/prozesse/webhook';
import { leerWebhooks, neuerProzess } from '@/lib/prozesse/bestand';
import { prozessRechte } from '@/lib/prozesse/rollen';
import type { WebhookEingang } from '@/lib/prozesse/definition';
import { fk, PZ, J, konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-webhook-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-webhook';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const VOLL = prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: false, nurBusiness: false });
const BUSINESS = prozessRechte({ imHaushalt: true, vollesMitglied: false, inhaber: false, nurBusiness: true });

describe('Körper filtern: nur Felder des Schemas, nie gekürzt, nie Werte in Fehlern', () => {
  const schema = [
    { id: 'email', art: 'email' as const, pflicht: true }, { id: 'nachricht', art: 'text' as const, max: 20 }, { id: 'menge', art: 'zahl' as const },
    { id: 'zustimmung', art: 'ja-nein' as const }, { id: 'tag', art: 'datum' as const }, { id: 'kennung', art: 'kennung' as const }, { id: 'quelle', art: 'auswahl' as const, optionen: ['web', 'messe'] },
  ];
  it('bekannte Felder angenommen und gesäubert, unbekannte verworfen und gezählt', () => {
    const r = koerperFiltern(schema, { email: ' Ada@Example.invalid ', nachricht: 'Hallo\u0000 da', menge: '3,5', zustimmung: 'ja', tag: '2026-10-21', kennung: 'c-1', quelle: 'web', boese: 'x', noch: { tief: 1 } });
    expect(r).toEqual({ ok: true, verworfen: 2, felder: { email: 'ada@example.invalid', nachricht: 'Hallo da', menge: 3.5, zustimmung: true, tag: '2026-10-21', kennung: 'c-1', quelle: 'web' } });
  });
  it('zu langer Text wird abgelehnt (nie gekürzt); Pflicht fehlt; falsche Art — Fehler nennen nur die Feld-Kennung', () => {
    const r = koerperFiltern(schema, { nachricht: 'x'.repeat(21), quelle: 'fax', tag: '2026-02-30', email: 'geheim-ohne-at' });
    expect(r.ok).toBe(false);
    const t = (r as { fehler: string[] }).fehler.join(' ');
    expect(t).toMatch(/„email“/); expect(t).toMatch(/„nachricht“: höchstens 20/); expect(t).toMatch(/„quelle“/); expect(t).toMatch(/„tag“/);
    expect(t).not.toMatch(/geheim-ohne-at|fax/);
    expect(koerperFiltern(schema, [1, 2]).ok).toBe(false);
  });
  it('Schlüssel nur aus dem Kopf und nur in der richtigen Form', () => {
    const s = 'A'.repeat(43);
    expect(schluesselAusKopf(new Headers({ authorization: `Bearer ${s}` }))).toBe(s);
    expect(schluesselAusKopf(new Headers({ 'x-make-webhook-schluessel': s }))).toBe(s);
    expect(schluesselAusKopf(new Headers({ authorization: 'Bearer kurz' }))).toBeNull();
    expect(schluesselAusKopf(new Headers({}))).toBeNull();
  });
  it('dieselbe enge Regex wie die Middleware', () => {
    const mw = readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8');
    expect(mw).toContain(`const PROZESS_WEBHOOK = ${WEBHOOK_PFAD.toString()};`);
    expect(WEBHOOK_PFAD.test('/api/prozesse/webhook/pw-0123456789abcdef01234567')).toBe(true);
    for (const p of ['/api/prozesse/webhook/pw-0123', '/api/prozesse/webhook/pw-0123456789abcdef01234567/x', '/api/prozesse/werkstatt', '/api/prozesse/webhook/PW-0123456789abcdef01234567']) expect(WEBHOOK_PFAD.test(p), p).toBe(false);
  });
});

describe('Verwalten (rein): nur volle Mitglieder, erst mit Webhook-Auslöser, scharf erst nach Veröffentlichen', () => {
  const kennung = () => { let i = 10; return () => fk(i++); };
  const mitWebhook = () => {
    const e = neuerProzess({ id: PZ, titel: 'Formular', bereich: 'marketing', fallArt: 'lead', von: 'pia', jetzt: J, kennung: kennung() });
    const start = e.entwurf.knoten.find(k => k.form === 'ausloeser')!;
    start.ausloeser = { art: 'webhook', felder: [{ id: 'email', art: 'email' }] };
    start.katalog = { id: 'ausloeser.webhook' };
    return e;
  };
  const neu = { kennung: 'pw-0123456789abcdef01234567', schluessel: 'S'.repeat(43), hash: 'a'.repeat(64) };
  it('ohne Recht 403, ohne Webhook-Auslöser 409, neu → nicht scharf, Schlüssel genau einmal', () => {
    const ohne = neuerProzess({ id: PZ, titel: 'X', bereich: 'sales', fallArt: 'deal', von: 'pia', jetzt: J, kennung: kennung() });
    expect(webhookAnwenden(leerWebhooks(), { aktion: 'webhook-schluessel', id: PZ }, { person: 'olaf', jetzt: J, rechte: BUSINESS, prozess: mitWebhook(), neu })).toMatchObject({ ok: false, status: 403 });
    expect(webhookAnwenden(leerWebhooks(), { aktion: 'webhook-schluessel', id: PZ }, { person: 'pia', jetzt: J, rechte: VOLL, prozess: ohne, neu })).toMatchObject({ ok: false, status: 409 });
    const r = webhookAnwenden(leerWebhooks(), { aktion: 'webhook-schluessel', id: PZ }, { person: 'pia', jetzt: J, rechte: VOLL, prozess: mitWebhook(), neu });
    expect(r).toMatchObject({ ok: true, geheim: { schluessel: neu.schluessel, adresse: '/api/prozesse/webhook/pw-0123456789abcdef01234567' } });
    if (!r.ok) return;
    expect(r.datei.webhooks[0]).toMatchObject({ scharf: false, schluesselHash: neu.hash });
    expect(JSON.stringify(r.datei)).not.toContain(neu.schluessel);
    // Scharf erst mit einer veröffentlichten Version mit Webhook-Auslöser.
    expect(webhookAnwenden(r.datei, { aktion: 'webhook-scharf', id: PZ, an: true }, { person: 'pia', jetzt: J, rechte: VOLL, prozess: mitWebhook() })).toMatchObject({ ok: false, status: 409 });
    const p = mitWebhook();
    p.versionen = [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: p.entwurf }];
    const s = webhookAnwenden(r.datei, { aktion: 'webhook-scharf', id: PZ, an: true }, { person: 'pia', jetzt: J, rechte: VOLL, prozess: p });
    expect(s).toMatchObject({ ok: true, eintrag: { scharf: true } });
    // Erneuern behält die Adresse, ersetzt den Fingerabdruck.
    if (!s.ok) return;
    const e2 = webhookAnwenden(s.datei, { aktion: 'webhook-schluessel', id: PZ }, { person: 'pia', jetzt: J, rechte: VOLL, prozess: p, neu: { ...neu, kennung: 'pw-ffffffffffffffffffffffff', hash: 'b'.repeat(64) } });
    expect(e2).toMatchObject({ ok: true, eintrag: { kennung: neu.kennung, schluesselHash: 'b'.repeat(64), scharf: true } });
  });
  it('Eingänge: über der Grenze abgelehnt (nie gekürzt), Frist räumt, Entfernen nimmt die Eingänge mit', () => {
    const eingang = (i: number, am = J): WebhookEingang => ({ id: `we-00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, prozessId: PZ, version: 1, am, felder: { email: 'a@example.invalid' }, fremd: true });
    const d = { ...leerWebhooks(), eingaenge: Array.from({ length: 2000 }, (_, i) => eingang(i)) };
    expect(eingangAblegen(d, eingang(9999), '2026-01-01T00:00:00.000Z')).toEqual({ ok: false, voll: true });
    expect(eingaengeFrist({ ...leerWebhooks(), eingaenge: [eingang(1, '2026-01-01T00:00:00.000Z'), eingang(2)] }, '2026-06-01T00:00:00.000Z').n).toBe(1);
    const p = mitWebhook();
    const mitEintrag = { ...leerWebhooks(), webhooks: [{ prozessId: PZ, kennung: neu.kennung, schluesselHash: neu.hash, scharf: true, angelegtAm: J, angelegtVon: 'pia' }], eingaenge: [eingang(1)] };
    const w = webhookAnwenden(mitEintrag, { aktion: 'webhook-entfernen', id: PZ }, { person: 'pia', jetzt: J, rechte: VOLL, prozess: p });
    expect(w).toMatchObject({ ok: true, eintrag: null, datei: { webhooks: [], eingaenge: [] } });
    // Nicht scharf bzw. archiviert → keine Annahme.
    expect(annahmeLage({ ...mitEintrag, webhooks: [{ ...mitEintrag.webhooks[0], scharf: false }] }, neu.kennung, [p])).toBeNull();
  });
});

// ── Von Ende zu Ende über die Routen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
type H = (r: Request, ctx?: unknown) => Promise<Response>;
const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
async function werkstatt(person: string, body: Record<string, unknown>) {
  const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>;
  const r = await m.POST(new Request('http://test/api/prozesse/werkstatt', { method: 'POST', headers: sitzung(person), body: JSON.stringify(body) }));
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function aufrufen(kennung: string, body: unknown, kopf: Record<string, string> = {}) {
  const m = await import('@/app/api/prozesse/webhook/[kennung]/route') as unknown as Record<string, H>;
  const roh = typeof body === 'string' ? body : JSON.stringify(body);
  const r = await m.POST(new Request(`http://test/api/prozesse/webhook/${kennung}`, { method: 'POST', headers: { 'content-type': 'application/json', ...kopf }, body: roh }), { params: Promise.resolve({ kennung }) });
  return { status: r.status, j: await r.json() as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('Webhook über die Routen', () => {
  let id = '', stand = '', adresse = '', schluessel = '';
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: 'haus-wh' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-wh', finanzRecht: 'business' })], einladungen: [] });
    const a = await werkstatt('pia', { aktion: 'anlegen', titel: 'Kontaktformular', bereich: 'marketing', fallArt: 'lead' });
    expect(a.status).toBe(200);
    id = a.j.eintrag.id; stand = a.j.stand;
    const knoten = a.j.eintrag.entwurf.knoten.map((k: Record<string, unknown>) => (k.form === 'ausloeser'
      ? { ...k, ausloeser: { art: 'webhook', felder: [{ id: 'email', art: 'email', pflicht: true }, { id: 'nachricht', art: 'text', max: 200 }] }, katalog: { id: 'ausloeser.webhook' } }
      : k));
    const e = await werkstatt('pia', { aktion: 'entwurf', id, stand, knoten });
    expect(e.status).toBe(200);
    stand = e.j.stand;
  });

  it('Schlüssel: nur volle Mitglieder; genau einmal in der Antwort, gespeichert nur der Fingerabdruck', async () => {
    expect((await werkstatt('olaf', { aktion: 'webhook-schluessel', id })).status).toBe(403);
    const r = await werkstatt('pia', { aktion: 'webhook-schluessel', id });
    expect(r.status).toBe(200);
    expect(r.j.webhook).toMatchObject({ scharf: false });
    adresse = r.j.geheim.adresse; schluessel = r.j.geheim.schluessel;
    expect(schluessel).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const db = await import('@/lib/store/local-db');
    const roh = JSON.stringify(await db.loadJson('prozesse-webhook--haus-wh'));
    expect(roh).not.toContain(schluessel);
    const g = await (await import('@/app/api/prozesse/werkstatt/route') as unknown as Record<string, H>).GET(new Request(`http://test/api/prozesse/werkstatt?id=${id}`, { headers: sitzung('pia') }));
    expect(await g.text()).not.toContain(schluessel);
  });

  it('nicht scharf → 404; scharf erst nach Veröffentlichen', async () => {
    const kennung = adresse.split('/').pop()!;
    expect((await aufrufen(kennung, { email: 'ada@example.invalid' }, { authorization: `Bearer ${schluessel}` })).status).toBe(404);
    expect((await werkstatt('pia', { aktion: 'webhook-scharf', id, an: true })).status).toBe(409);
    const v = await werkstatt('pia', { aktion: 'veroeffentlichen', id, stand, name: 'Erste Fassung' });
    expect(v.status).toBe(200);
    stand = v.j.stand;
    expect((await werkstatt('pia', { aktion: 'webhook-scharf', id, an: true })).status).toBe(200);
  });

  it('angenommen: nur Schema-Felder, fremder Text, EIN Ereignis `webhook` mit Kennungen — gestartet wird nichts', async () => {
    const kennung = adresse.split('/').pop()!;
    const r = await aufrufen(kennung, { email: 'ada@example.invalid', nachricht: 'Bitte Rückruf', unbekannt: 'weg damit' }, { authorization: `Bearer ${schluessel}` });
    expect(r.status).toBe(202);
    const db = await import('@/lib/store/local-db');
    const w = await db.loadJson<{ eingaenge: { id: string; felder: Record<string, unknown>; fremd: boolean }[]; webhooks: { anzahl?: number }[] }>('prozesse-webhook--haus-wh');
    expect(w!.eingaenge).toHaveLength(1);
    expect(w!.eingaenge[0]).toMatchObject({ id: r.j.eingang, fremd: true, felder: { email: 'ada@example.invalid', nachricht: 'Bitte Rückruf' } });
    expect(w!.eingaenge[0].felder).not.toHaveProperty('unbekannt');
    expect(w!.webhooks[0].anzahl).toBe(1);
    const ev = await db.loadJson<{ eintraege: { art: string; quelle: string; bezug: Record<string, string>; bereich: string; person?: string }[] }>('ereignisse--haus-wh');
    expect(ev!.eintraege).toEqual([expect.objectContaining({ art: 'webhook', quelle: 'webhook', bezug: { prozessId: id, eingangId: r.j.eingang }, bereich: 'business' })]);
    expect(JSON.stringify(ev)).not.toContain('Bitte Rückruf');
    // Kein Lauf, keine Aufgabe, kein Vorschlag: Etappe C startet erst.
    expect(await db.loadJson('tasks')).toBeNull();
  });

  it('falscher bzw. fehlender Schlüssel, unbekannte Adresse → dieselbe 404; Schema verletzt → 400 ohne Werte; zu groß → 413', async () => {
    const kennung = adresse.split('/').pop()!;
    const falsch = await aufrufen(kennung, { email: 'ada@example.invalid' }, { authorization: `Bearer ${'Z'.repeat(43)}` });
    const ohne = await aufrufen(kennung, { email: 'ada@example.invalid' });
    const fremd = await aufrufen('pw-ffffffffffffffffffffffff', { email: 'ada@example.invalid' }, { authorization: `Bearer ${schluessel}` });
    expect([falsch.status, ohne.status, fremd.status]).toEqual([404, 404, 404]);
    expect(falsch.j).toEqual(fremd.j);
    const b = await aufrufen(kennung, { email: 'kaputt-geheim' }, { authorization: `Bearer ${schluessel}` });
    expect(b.status).toBe(400);
    expect(JSON.stringify(b.j)).not.toContain('kaputt-geheim');
    expect((await aufrufen(kennung, JSON.stringify({ nachricht: 'x'.repeat(70_000) }), { authorization: `Bearer ${schluessel}` })).status).toBe(413);
  });

  it('erneuerter Schlüssel: der alte gilt sofort nicht mehr', async () => {
    const r = await werkstatt('pia', { aktion: 'webhook-schluessel', id });
    const kennung = adresse.split('/').pop()!;
    expect(r.j.geheim.adresse).toBe(adresse);
    expect((await aufrufen(kennung, { email: 'ada@example.invalid' }, { authorization: `Bearer ${schluessel}` })).status).toBe(404);
    expect((await aufrufen(kennung, { email: 'ada@example.invalid' }, { authorization: `Bearer ${r.j.geheim.schluessel}` })).status).toBe(202);
  });

  it('Middleware: NUR POST auf genau diese Form ist ohne Sitzung offen', async () => {
    const { middleware } = await import('@/middleware');
    const mw = (p: string, methode = 'GET') => middleware(new NextRequest(`https://app.beispiel.test${p}`, { method: methode, headers: { 'content-type': 'application/json', origin: 'https://fremd.example.invalid' } }));
    expect((await mw(adresse, 'POST')).status).not.toBe(401);
    expect((await mw(adresse)).status).toBe(401);
    expect((await mw('/api/prozesse/webhook/pw-kurz', 'POST')).status).toBe(401);
    expect((await mw('/api/prozesse/werkstatt', 'POST')).status).toBe(401);
  });
});
