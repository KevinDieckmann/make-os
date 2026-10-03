// ─── Netzwerken · Meine Visitenkarten, Route + Speicher (02.10., Paket B; 03.10.: echte Sitzung statt Dienstweg) ───
// Eigener Datenordner; die Anfragen tragen `x-make-user` wie nach der Middleware bei angemeldeter Person (die Middleware setzt den Kopf
// aus dem Sitzungs-Cookie). Der Dienstweg (Schlüssel + Person) bekommt 403 — eigener Test unten. Erfundene Konten: Inhaber (kevin), Mitglied (malin) im selben Haushalt, ein
// Fremder (fritz) in einem anderen Haushalt, ein Konto ohne Haushalt (gast).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-karten-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-02-10';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

const ID = (n: number) => `v-3f2b9c1e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SVG = (inhalt: string) => `data:image/svg+xml;base64,${Buffer.from(inhalt, 'utf8').toString('base64')}`;
const req = (person: string, methode: 'GET' | 'PATCH', body?: unknown, query = '') =>
  new Request(`http://test/api/netzwerken/karten${query}`, { method: methode, headers: { 'content-type': 'application/json', 'x-make-user': person }, ...(body ? { body: JSON.stringify(body) } : {}) });
/** Der Dienstweg: Schlüssel und eine Person (so riefen ZOE, Takt und Skripte früher auf). */
const dienstReq = (person: string | null, methode: 'GET' | 'PATCH', body?: unknown) =>
  new Request('http://test/api/netzwerken/karten', { method: methode, headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
type Antwort = { ok: boolean; fehler?: string; karten?: { id: string; stand: string; [k: string]: unknown }[]; konflikte?: unknown[]; personen?: { person: string }[]; person?: string; fuerAndere?: boolean; konto?: { name: string } | null; gesellschaften?: unknown[] };
let route: { GET: (r: Request) => Promise<Response>; PATCH: (r: Request) => Promise<Response> };
let db: typeof import('@/lib/store/local-db');

const holen = async (person: string, query = '') => { const r = await route.GET(req(person, 'GET', undefined, query)); return { status: r.status, d: (await r.json()) as Antwort }; };
const schreibe = async (person: string, ops: unknown, query = '') => { const r = await route.PATCH(req(person, 'PATCH', { ops }, query)); return { status: r.status, d: (await r.json()) as Antwort }; };
const neu = (n: number, extra: Record<string, unknown> = {}) => ({ op: 'upsert', eintrag: { id: ID(n), rang: n, vorname: 'Erika', nachname: 'Muster', firma: `Firma ${n}`, ...extra } });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const konto = (speicher: string, name: string, rolle: string, haushalt?: string) => ({ id: `k-${speicher}`, speicher, email: `${speicher}@test.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...(haushalt ? { haushalt } : {}) });
  await db.saveJson('konten', { konten: [
    konto('kevin', 'Kevin Test', 'inhaber', 'test-haus'), konto('malin', 'Malin Test', 'mitglied', 'test-haus'),
    konto('fritz', 'Fritz Fremd', 'mitglied', 'anderes-haus'), konto('gast', 'Gast Ohne', 'mitglied'),
  ], einladungen: [] });
  route = (await import('@/app/api/netzwerken/karten/route')) as unknown as typeof route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Dienstweg: 403 (03.10.)', () => {
  it('Schlüssel + Person des Inhabers lesen und schreiben NICHT — Visitenkarten sind persönlich, nie für Hintergrundläufe', async () => {
    for (const p of ['kevin', 'malin', null]) {
      expect((await route.GET(dienstReq(p, 'GET'))).status).toBe(403);
      expect((await route.PATCH(dienstReq(p, 'PATCH', { ops: [neu(1)] }))).status).toBe(403);
    }
    // Nichts wurde geschrieben.
    expect(await db.loadJson('visitenkarten--kevin')).toBeNull();
    // Dieselbe Person mit echter Sitzung (x-make-user) kommt durch.
    expect((await holen('kevin')).status).toBe(200);
  });
});

describe('Haushalts-Tor und eigener Bestand', () => {
  it('ohne Haushalt oder ohne Person: 403', async () => {
    expect((await holen('gast')).status).toBe(403);
    expect((await schreibe('gast', [neu(1)])).status).toBe(403);
    const ohne = await route.GET(new Request('http://test/api/netzwerken/karten', { headers: { 'x-make-key': process.env.MAKE_OS_KEY! } }));
    expect(ohne.status).toBe(403);
  });
  it('leer starten, anlegen, lesen — mit Stand je Profil und dem Namen aus dem Konto', async () => {
    const a = await holen('malin');
    expect(a.status).toBe(200);
    expect(a.d.karten).toEqual([]);
    expect(a.d.konto?.name).toBe('Malin Test');
    const s = await schreibe('malin', [neu(1, { logo: SVG('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h1v1z" onload="x()"/></svg>') })]);
    expect(s.status).toBe(200);
    expect(s.d.karten).toHaveLength(1);
    expect(s.d.karten![0].stand).toBeTruthy();
    // Das Logo ist beim Speichern gesäubert worden — der Server vertraut dem Browser nicht.
    const gespeichert = await db.loadJson<{ karten: { logo: string }[] }>('visitenkarten--malin');
    const svg = Buffer.from(gespeichert!.karten[0].logo.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<path d="M0 0h1v1z"/>');
    expect(svg).not.toMatch(/script|onload|alert/);
  });
  it('jede Person sieht nur ihren Bestand — Kevin sieht Malins Profile nicht ohne ?fuer', async () => {
    expect((await holen('kevin')).d.karten).toEqual([]);
    expect((await holen('malin')).d.karten).toHaveLength(1);
    // Ein Mitglied kann den Bestand des Inhabers nicht ansteuern: der Body kennt keine Person, nur ?fuer — und das darf nur der Inhaber.
    const r = await schreibe('malin', [neu(2)], '?fuer=kevin');
    expect(r.status).toBe(403);
    expect((await holen('kevin')).d.karten).toEqual([]);
  });
});

describe('Anlegen für andere (nur Inhaber, nur im Haushalt)', () => {
  it('der Inhaber legt für Malin an — es steht in Malins Bestand, das Protokoll nennt kevin als Schreibenden und keine Werte', async () => {
    const g = await holen('kevin', '?fuer=malin');
    expect(g.status).toBe(200);
    expect(g.d).toMatchObject({ person: 'malin', fuerAndere: true });
    expect(g.d.personen?.map(p => p.person).sort()).toEqual(['kevin', 'malin']);
    expect(g.d.konto?.name).toBe('Malin Test');
    const r = await schreibe('kevin', [neu(2, { firma: 'Geheime Firma AG' })], '?fuer=malin');
    expect(r.status).toBe(200);
    expect(r.d.karten).toHaveLength(2);
    expect((await holen('malin')).d.karten).toHaveLength(2);
    expect((await holen('kevin')).d.karten).toEqual([]);
    const { monatBerlin, protokollName } = await import('@/lib/store/aenderungsprotokoll');
    const p = await db.loadJson<{ eintraege: { bestand: string; wer: string; person?: string; op: string; id?: string }[] }>(protokollName('test-haus', monatBerlin()));
    const mine = (p?.eintraege ?? []).filter(e => e.bestand === 'visitenkarten--malin');
    expect(mine.length).toBeGreaterThan(0);
    // (Im Test läuft der Dienstweg mit Person — das Protokoll nennt dann die Person, am Gerät mit Sitzung `wer: person`.)
    expect(mine.some(e => e.person === 'kevin' && (e as { id?: string }).id === ID(2))).toBe(true);
    expect(JSON.stringify(p)).not.toContain('Geheime Firma');
  });
  it('Mitglied: 403; Person aus anderem Haushalt: 403; unbekannte/ungültige Person: 403/400', async () => {
    expect((await holen('malin', '?fuer=kevin')).status).toBe(403);
    expect((await schreibe('malin', [neu(3)], '?fuer=kevin')).status).toBe(403);
    expect((await holen('kevin', '?fuer=fritz')).status).toBe(403);
    expect((await schreibe('kevin', [neu(3)], '?fuer=fritz')).status).toBe(403);
    expect((await holen('kevin', '?fuer=gast')).status).toBe(403);
    expect((await holen('kevin', '?fuer=nie-gehoert')).status).toBe(403);
    expect((await holen('kevin', '?fuer=../x')).status).toBe(400);
    // eine eigene Anfrage mit ?fuer=<ich> ist einfach die eigene
    expect((await holen('kevin', '?fuer=kevin')).d.fuerAndere).toBe(false);
  });
  it('Mitglieder sehen keine Personenliste', async () => {
    expect((await holen('malin')).d.personen).toEqual([]);
  });
});

describe('Stand und 409, Teiländerung, Löschen, Grenzen', () => {
  it('veralteter Stand → 409 mit aktuellem Stand, nichts überschrieben; mit aktuellem Stand klappt es', async () => {
    const a = (await holen('malin')).d.karten!.find(k => k.id === ID(1))!;
    const ok = await schreibe('malin', [{ op: 'teil', id: ID(1), felder: { rolle: 'Erste Änderung' }, stand: a.stand }]);
    expect(ok.status).toBe(200);
    const alt = await schreibe('malin', [{ op: 'teil', id: ID(1), felder: { rolle: 'Zweites Gerät' }, stand: a.stand }]);
    expect(alt.status).toBe(409);
    expect(alt.d.konflikte).toHaveLength(1);
    expect(alt.d.karten!.find(k => k.id === ID(1))!.rolle).toBe('Erste Änderung');
    // upsert mit altem Stand: ebenso
    const alt2 = await schreibe('malin', [{ op: 'upsert', eintrag: { id: ID(1), rang: 0, vorname: 'X' }, stand: a.stand }]);
    expect(alt2.status).toBe(409);
  });
  it('Teiländerung: Feld leeren, Design setzen; ungültiges Feld → 400 mit Satz', async () => {
    const a = (await holen('malin')).d.karten!.find(k => k.id === ID(1))!;
    const r = await schreibe('malin', [{ op: 'teil', id: ID(1), felder: { rolle: '', hintergrund: '#0F1919', schrift: 'urbanist' }, stand: a.stand }]);
    expect(r.status).toBe(200);
    const k = r.d.karten!.find(x => x.id === ID(1))!;
    expect(k.rolle).toBeUndefined();
    expect(k).toMatchObject({ hintergrund: '#0f1919', schrift: 'urbanist' });
    const schlecht = await schreibe('malin', [{ op: 'teil', id: ID(1), felder: { email: 'kein-at' }, stand: k.stand }]);
    expect(schlecht.status).toBe(400);
    expect(schlecht.d.fehler).toMatch(/E-Mail/);
    const schlecht2 = await schreibe('malin', [{ op: 'upsert', eintrag: { id: ID(9), rang: 9, vorname: 'E', logo: 'data:image/png;base64,' + Buffer.from('kein bild').toString('base64') } }]);
    expect(schlecht2.status).toBe(400);
  });
  it('Reihenfolge über rang; Löschen mit Stand', async () => {
    const liste = (await holen('malin')).d.karten!;
    const a = liste.find(k => k.id === ID(1))!, b = liste.find(k => k.id === ID(2))!;
    const r = await schreibe('malin', [{ op: 'teil', id: ID(1), felder: { rang: 5 }, stand: a.stand }, { op: 'teil', id: ID(2), felder: { rang: 1 }, stand: b.stand }]);
    expect(r.d.karten!.map(k => k.id)).toEqual([ID(2), ID(1)]);
    const del = await schreibe('malin', [{ op: 'delete', id: ID(2), stand: r.d.karten![0].stand }]);
    expect(del.status).toBe(200);
    expect(del.d.karten).toHaveLength(1);
  });
  it('413 statt Kürzen: zu viele Änderungen und mehr als 20 Profile — nichts gespeichert', async () => {
    const viele = Array.from({ length: 41 }, (_, i) => neu(100 + i));
    expect((await schreibe('malin', viele)).status).toBe(413);
    expect((await holen('malin')).d.karten).toHaveLength(1);
    const zwanzig = Array.from({ length: 20 }, (_, i) => neu(200 + i));
    const r = await schreibe('malin', zwanzig);
    expect(r.status).toBe(413);
    expect(r.d.fehler).toMatch(/Höchstens 20/);
    expect((await holen('malin')).d.karten).toHaveLength(1);
    expect((await schreibe('malin', Array.from({ length: 19 }, (_, i) => neu(300 + i)))).status).toBe(200);
    expect((await holen('malin')).d.karten).toHaveLength(20);
    expect((await schreibe('malin', [neu(400)])).status).toBe(413);
  });
  it('kaputte Eingaben: kein JSON, keine Liste, leere Liste', async () => {
    const r = await route.PATCH(new Request('http://test/api/netzwerken/karten', { method: 'PATCH', headers: { 'x-make-user': 'malin' }, body: '{' }));
    expect(r.status).toBe(400);
    expect((await schreibe('malin', 'x')).status).toBe(400);
    expect((await schreibe('malin', [])).status).toBe(400);
  });
});

describe('Speicher-Register', () => {
  it('der Bestand ist eingetragen (eigene Daten des Haushalts) und der Name folgt dem Muster', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    const e = registerEintrag('visitenkarten--malin');
    expect(e).toMatchObject({ bezug: 'haushalt', behandlung: 'ausgenommen', muster: 'visitenkarten--*' });
    expect(e!.grund).toMatch(/Art\. 17/);
    const { visitenkartenName } = await import('@/lib/netzwerken/karte-speicher');
    expect(visitenkartenName('malin')).toBe('visitenkarten--malin');
    expect(() => visitenkartenName('../x')).toThrow();
  });
});

describe('Körpergröße der Änderung (Prüfung 03.10.)', () => {
  it('über der Grenze (40 Profile × Logo-Limit + Text) → 413 — nach Header UND nach gemessenem Text; nichts geschrieben', async () => {
    const vorher = await db.loadJson('visitenkarten--malin');
    // 1. Content-Length zuerst: ohne den Body zu lesen
    const kopf = { 'content-type': 'application/json', 'x-make-user': 'malin', 'content-length': '99000000' };
    const a = await route.PATCH(new Request('http://test/api/netzwerken/karten', { method: 'PATCH', headers: kopf, body: JSON.stringify({ ops: [neu(1)] }) }));
    expect(a.status).toBe(413);
    expect(((await a.json()) as Antwort).fehler).toMatch(/zu groß/);
    // 2. Ohne ehrlichen Header (chunked): der gelesene Text wird gemessen
    const riesig = JSON.stringify({ ops: [neu(1, { bezeichnung: 'x'.repeat(12_000_000) })] });
    const b = await route.PATCH(new Request('http://test/api/netzwerken/karten', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-make-user': 'malin' }, body: riesig }));
    expect(b.status).toBe(413);
    expect(await db.loadJson('visitenkarten--malin')).toEqual(vorher);
  });
  it('ein Körper mit vollen Logos im erlaubten Rahmen geht weiter durch die normale Prüfung', async () => {
    const r = await schreibe('malin', [neu(1, { logo: SVG('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>') })]);
    expect(r.d.fehler ?? '').not.toMatch(/zu groß/);
    expect(r.status).not.toBe(413);
  });
});
