// ─── Gesamtprüfung 12.10.: Ernährung & Einkauf sind Privat-Bereich des Haushalts ─────────────────────────────────────────────
// Wächter „Sicht Business bekommt nichts aus Privat“: ein Konto „nur Business“ (`finanzRecht: 'business'`, im Haushalt der Inhaber) bekam
// über /api/state/ernaehrung Einkauf, Plan, Gerichte UND das Lebensmittel-Budget aus den Haushaltsfinanzen. Jetzt 403 — lesen wie schreiben,
// auch über Vorschlag, Rezept und Gericht-Bild. Volle Mitglieder unverändert. Eigener Datenordner, erfundene Personen und Werte.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ernaehrung-nb-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ernaehrung-nb';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

type Mod = Record<string, (r: Request) => Promise<Response>>;
const MARKE = 'ERNAEHRUNG-NB-HAFERFLOCKEN';
const anfrage = (pfad: string, person: string, methode = 'GET', body?: unknown) => new Request(`http://test${pfad}`, {
  method: methode, headers: { 'x-make-user': person, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
});

let state: Mod, vorschlag: Mod, rezept: Mod, bild: Mod;
beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '2', speicher: 'pb', email: 'pb@example.invalid', name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef' },
    { id: '3', speicher: 'pp', email: 'pp@example.invalid', name: 'Paul Partner', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-pruef', finanzRecht: 'business' },
  ], einladungen: [] });
  await db.saveJson('ernaehrung', { einkauf: [{ id: 'e-1', text: MARKE, erledigt: false }] });
  state = (await import('@/app/api/state/ernaehrung/route')) as unknown as Mod;
  vorschlag = (await import('@/app/api/ernaehrung/vorschlag/route')) as unknown as Mod;
  rezept = (await import('@/app/api/ernaehrung/rezept/route')) as unknown as Mod;
  bild = (await import('@/app/api/ernaehrung/bild/route')) as unknown as Mod;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Ernährung: Konto „nur Business“ bekommt nichts aus dem Privat-Bereich des Haushalts', () => {
  it('volle Mitglieder lesen den gemeinsamen Einkauf wie bisher', async () => {
    for (const p of ['pa', 'pb']) {
      const r = await state.GET(anfrage('/api/state/ernaehrung', p));
      expect(r.status, p).toBe(200);
      expect(await r.text()).toContain(MARKE);
    }
  });

  it('„nur Business“: 403 beim Lesen, ohne Einkauf, Plan oder Budget in der Antwort', async () => {
    const r = await state.GET(anfrage('/api/state/ernaehrung', 'pp'));
    expect(r.status).toBe(403);
    const t = await r.text();
    expect(t).not.toContain(MARKE);
    expect(t).not.toContain('budget');
  });

  it('„nur Business“: Schreiben (PATCH/PUT), Vorschlag, Rezept und Bild → 403, nichts gespeichert', async () => {
    const db = await import('@/lib/store/local-db');
    const vorher = JSON.stringify(await db.loadJson('ernaehrung'));
    expect((await state.PATCH(anfrage('/api/state/ernaehrung', 'pp', 'PATCH', { ops: [{ liste: 'einkauf', op: 'upsert', eintrag: { text: 'fremd' } }] }))).status).toBe(403);
    expect((await state.PUT(anfrage('/api/state/ernaehrung', 'pp', 'PUT', { einkauf: [] }))).status).toBe(403);
    expect((await vorschlag.GET(anfrage('/api/ernaehrung/vorschlag', 'pp'))).status).toBe(403);
    expect((await vorschlag.POST(anfrage('/api/ernaehrung/vorschlag', 'pp', 'POST', {}))).status).toBe(403);
    expect((await rezept.POST(anfrage('/api/ernaehrung/rezept', 'pp', 'POST', { name: 'X' }))).status).toBe(403);
    expect((await bild.GET(anfrage('/api/ernaehrung/bild?name=x', 'pp'))).status).toBe(403);
    expect(JSON.stringify(await db.loadJson('ernaehrung'))).toBe(vorher);
  });
});
