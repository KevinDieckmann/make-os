// ─── Medien: Upload in Stücken, Wiederaufnahme, Grenzen, Inhalt mit Range, Sicht je Person (09.10., Paket 5) ─────────────────
// Über die echten Routen (Sitzung per `x-make-user`), Datenordner und Medien-Ordner in Temp-Ordnern, Datenschlüssel gesetzt (die Schlüssel je
// Medium werden gewickelt), erfundene Konten. Kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GRENZEN } from '@/lib/medien/typen';
import { KONTEN, jpeg, sha, pruefsumme, rufe, routen, hochladen, type Routen } from './fixtures/medien-hilfen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-medien-upload-'));
  process.env.MAKE_OS_DATEN_DIR = p.join(o, 'daten');
  process.env.MAKE_OS_MEDIEN_DIR = p.join(o, 'medien');
  process.env.MAKE_OS_KEY = 'pruef-schluessel-medien-upload';
  process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-medien-upload-nur-test';
  delete process.env.MAKE_OS_MEDIEN_S3_ENDPUNKT;
  return o;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

let r: Routen;
beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', KONTEN);
  r = await routen();
});

const dateienUnter = (d: string): string[] => { try { return readdirSync(d, { recursive: true, withFileTypes: true }).filter(e => e.isFile()).map(e => path.join(e.parentPath ?? (e as unknown as { path: string }).path, e.name)); } catch { return []; } };

describe('Upload in Stücken', () => {
  it('Stücke mit Prüfsumme, gleiches Stück erneut = ohne Arbeit, anderer Inhalt = 409, falsche Länge/Prüfsumme = 400', async () => {
    const klar = jpeg(GRENZEN.teil + 5000); // zwei Stücke
    const uuid = randomUUID(), id = `up-${uuid}`;
    const a = await rufe(r.upload, 'POST', '/api/medien/upload', 'person-b', { json: { id: uuid, typ: 'image/jpeg', bytes: klar.length, bereich: 'business', ortsdatenEntfernt: true } });
    expect(a.status).toBe(200);
    expect(a.json.sitzung).toMatchObject({ teile: 2, fehlend: [0, 1], teilGroesse: GRENZEN.teil });
    const t0 = klar.subarray(0, GRENZEN.teil), t1 = klar.subarray(GRENZEN.teil);
    const put = (nr: number, b: Buffer, h = sha(b)) => rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?teil=${nr}`, 'person-b', { roh: b, kopf: { 'x-make-sha256': h }, params: { id } });
    expect((await put(0, Buffer.from(t0), sha(t1))).status).toBe(400);           // Prüfsumme passt nicht
    expect((await put(1, Buffer.from(t1.subarray(1)))).status).toBe(400);         // Länge passt nicht
    expect((await put(0, Buffer.from(t0))).status).toBe(200);
    const nochmal = await put(0, Buffer.from(t0));
    expect(nochmal.status).toBe(200); expect(nochmal.json.schon).toBe(true);
    const anders = Buffer.from(t0); anders[100] ^= 1;
    expect((await put(0, anders)).status).toBe(409);
    // Abbruch (Seite neu geladen): dieselbe UUID legt nichts Neues an — der Stand sagt, was fehlt.
    const wieder = await rufe(r.upload, 'POST', '/api/medien/upload', 'person-b', { json: { id: uuid, typ: 'image/jpeg', bytes: klar.length, bereich: 'business', ortsdatenEntfernt: true } });
    expect(wieder.json.sitzung).toMatchObject({ fehlend: [1] });
    expect((await rufe(r.sitzung, 'GET', `/api/medien/upload/${id}`, 'person-b', { params: { id } })).json.sitzung).toMatchObject({ erhalten: [0], fehlend: [1] });
    // Fremde Sitzung „gibt es nicht“; der Dienstweg bekommt 403.
    expect((await rufe(r.sitzung, 'GET', `/api/medien/upload/${id}`, 'person-a', { params: { id } })).status).toBe(404);
    expect((await rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?teil=1`, null, { roh: Buffer.from(t1), kopf: { 'x-make-sha256': sha(t1) }, params: { id }, dienst: true })).status).toBe(403);
    // Abschließen geht erst mit allen Stücken und der Vorschau; dann nur mit der richtigen Prüfsumme.
    expect((await rufe(r.sitzung, 'POST', `/api/medien/upload/${id}`, 'person-b', { json: { pruefsumme: 'x' }, params: { id } })).status).toBe(409);
    expect((await put(1, Buffer.from(t1))).status).toBe(200);
    expect((await rufe(r.sitzung, 'POST', `/api/medien/upload/${id}`, 'person-b', { json: { pruefsumme: pruefsumme([sha(t0), sha(t1)]) }, params: { id } })).status).toBe(409); // Vorschau fehlt
    expect((await rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?variante=raster`, 'person-b', { roh: jpeg(900), params: { id } })).status).toBe(200);
    expect((await rufe(r.sitzung, 'POST', `/api/medien/upload/${id}`, 'person-b', { json: { pruefsumme: 'f'.repeat(64) }, params: { id } })).status).toBe(400);
    const f = await rufe(r.sitzung, 'POST', `/api/medien/upload/${id}`, 'person-b', { json: { pruefsumme: pruefsumme([sha(t0), sha(t1)]) }, params: { id } });
    expect(f.status).toBe(200);
    expect(f.json.medium).toMatchObject({ id: `md-${uuid}`, art: 'bild', bereich: 'business', groesse: klar.length, ortsdatenEntfernt: true });
    // Wiederholung nach abgerissener Antwort: derselbe Eintrag.
    expect((await rufe(r.sitzung, 'POST', `/api/medien/upload/${id}`, 'person-b', { json: { pruefsumme: pruefsumme([sha(t0), sha(t1)]) }, params: { id } })).json.medium).toMatchObject({ id: `md-${uuid}` });
    // Inhalt: ganz, im Bereich (206 — Safari), Vorschau privat zwischengespeichert (ETag → 304).
    const ganz = await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=md-${uuid}&v=original`, 'person-b');
    expect(ganz.status).toBe(200); expect(ganz.bytes.equals(klar)).toBe(true);
    expect(ganz.kopf.get('cache-control')).toBe('private, no-store');
    const teil = await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=md-${uuid}&v=original`, 'person-b', { kopf: { range: `bytes=${GRENZEN.teil - 3}-${GRENZEN.teil + 3}` } });
    expect(teil.status).toBe(206);
    expect(teil.kopf.get('content-range')).toBe(`bytes ${GRENZEN.teil - 3}-${GRENZEN.teil + 3}/${klar.length}`);
    expect(teil.bytes.equals(klar.subarray(GRENZEN.teil - 3, GRENZEN.teil + 4))).toBe(true);
    expect((await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=md-${uuid}&v=original`, 'person-b', { kopf: { range: `bytes=${klar.length + 5}-` } })).status).toBe(416);
    const vorschau = await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=md-${uuid}&v=raster`, 'person-b');
    expect(vorschau.status).toBe(200); expect(vorschau.kopf.get('cache-control')).toMatch(/^private, max-age/);
    expect((await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=md-${uuid}&v=raster`, 'person-b', { kopf: { 'if-none-match': vorschau.kopf.get('etag')! } })).status).toBe(304);
  });

  it('auf der Platte nur Chiffrat: kein Klartext im Medien-Ordner, kein Schlüssel im Katalog', async () => {
    const { klar, medium } = await hochladen(r, 'person-b', { bytes: jpeg(70_000) });
    const probe = klar.subarray(30_000, 30_064);
    for (const d of dateienUnter(process.env.MAKE_OS_MEDIEN_DIR!)) expect(readFileSync(d).includes(probe), d).toBe(false);
    const katalog = readFileSync(path.join(process.env.MAKE_OS_DATEN_DIR!, 'medien--haus-a.json'), 'utf8');
    expect(katalog).toContain('__verschluesselt');
    expect(katalog).not.toContain(String(medium.id));
    // Die Liste an den Browser trägt keine Schlüssel, Objekt-Namen oder Salze.
    const l = await rufe(r.liste, 'GET', '/api/medien', 'person-b');
    expect(l.text).not.toMatch(/"dek"|"salze"|"objekt"|"schluessel"/);
  });

  it('Grenzen: Video über 2 GB und Foto über 50 MB → 413; kein Foto/Video → 415; 4K ohne „Original“ → 400', async () => {
    const neu = (j: Record<string, unknown>) => rufe(r.upload, 'POST', '/api/medien/upload', 'person-b', { json: { id: randomUUID(), bereich: 'business', ortsdatenEntfernt: true, ...j } });
    expect((await neu({ typ: 'video/mp4', bytes: GRENZEN.video + 1 })).status).toBe(413);
    expect((await neu({ typ: 'image/jpeg', bytes: GRENZEN.bild + 1 })).status).toBe(413);
    expect((await neu({ typ: 'image/heic', bytes: 100 })).status).toBe(415);
    expect((await neu({ typ: 'video/quicktime', bytes: 1000, breite: 3840, hoehe: 2160 })).status).toBe(400);
    expect((await neu({ typ: 'video/quicktime', bytes: 1000, breite: 3840, hoehe: 2160, original: true })).status).toBe(200);
    // Erstes Stück ohne JPEG-Kopf → 415 (Typ aus dem INHALT, nie aus der Angabe).
    const uuid = randomUUID(), id = `up-${uuid}`;
    await rufe(r.upload, 'POST', '/api/medien/upload', 'person-b', { json: { id: uuid, typ: 'image/jpeg', bytes: 100, bereich: 'business', ortsdatenEntfernt: true } });
    const falsch = Buffer.alloc(100, 7);
    expect((await rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?teil=0`, 'person-b', { roh: falsch, kopf: { 'x-make-sha256': sha(falsch) }, params: { id } })).status).toBe(415);
    // Ein Stück über 8 MiB → 413 (nie gekürzt).
    expect((await rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?teil=0`, 'person-b', { roh: Buffer.alloc(GRENZEN.teil + 1), params: { id } })).status).toBe(413);
    // Abbrechen räumt die Sitzung.
    expect((await rufe(r.sitzung, 'DELETE', `/api/medien/upload/${id}`, 'person-b', { params: { id } })).status).toBe(200);
    expect((await rufe(r.sitzung, 'GET', `/api/medien/upload/${id}`, 'person-b', { params: { id } })).status).toBe(404);
  });

  it('der Server traut „Ortsdaten entfernt“ nicht blind: ein JPEG mit Exif gilt als nicht gesäubert', async () => {
    const { medium } = await hochladen(r, 'person-b', { bytes: jpeg(3000, { exif: true }) });
    expect(medium.ortsdatenEntfernt).toBe(false);
  });
});

describe('Sicht: wer bekommt was (serverseitig gefiltert)', () => {
  it('Business: jedes Konto im Haushalt; fremder Haushalt, Konto ohne Haushalt und Dienstweg → 403', async () => {
    const { medium } = await hochladen(r, 'person-b');
    for (const p of ['person-a', 'person-b', 'partner']) expect((await rufe(r.liste, 'GET', '/api/medien', p)).text, p).toContain(String(medium.id));
    for (const p of ['gast', 'kunde']) expect((await rufe(r.liste, 'GET', '/api/medien', p)).status, p).toBe(403);
    expect((await rufe(r.liste, 'GET', '/api/medien', null, { dienst: true })).status).toBe(403);
    expect((await rufe(r.liste, 'GET', '/api/medien', 'person-b', { dienst: true })).status).toBe(403);
    expect((await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=${medium.id}&v=raster`, 'gast')).status).toBe(403);
  });

  it('Privat „nur ich“ sieht nur die Person — nicht einmal das volle Mitglied; „Haushalt“ nur volle Mitglieder, nie „nur Business“', async () => {
    const nurIch = await hochladen(r, 'person-b', { bereich: 'privat' });
    const alb = await rufe(r.liste, 'POST', '/api/medien', 'person-b', { json: { aktion: 'album-anlegen', bereich: 'privat', art: 'frei', titel: 'Familienalbum', sicht: 'haushalt' } });
    expect(alb.status).toBe(200);
    const albumId = String((alb.json.album as { id: string }).id);
    const haus = await hochladen(r, 'person-b', { bereich: 'privat', album: albumId });
    const sicht = async (p: string) => (await rufe(r.liste, 'GET', '/api/medien', p)).text;
    expect(await sicht('person-b')).toContain(String(nurIch.medium.id));
    expect(await sicht('person-a')).not.toContain(String(nurIch.medium.id));
    expect(await sicht('person-a')).toContain(String(haus.medium.id));
    expect(await sicht('partner')).not.toContain(String(haus.medium.id));
    expect(await sicht('partner')).not.toContain('Familienalbum');
    expect((await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=${nurIch.medium.id}&v=original`, 'person-a')).status).toBe(404);
    expect((await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=${haus.medium.id}&v=original`, 'partner')).status).toBe(404);
    // Ändern darf nur die Person selbst; Favorit setzen darf, wer sieht.
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-a', { json: { aktion: 'aendern', id: haus.medium.id, name: 'x' } })).status).toBe(403);
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-a', { json: { aktion: 'auswahl', id: haus.medium.id, wahl: 'favorit' } })).status).toBe(200);
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-a', { json: { aktion: 'auswahl', id: nurIch.medium.id, wahl: 'favorit' } })).status).toBe(404);
    // „Nur Business“ legt nichts Privates an.
    expect((await rufe(r.upload, 'POST', '/api/medien/upload', 'partner', { json: { id: randomUUID(), typ: 'image/jpeg', bytes: 100, bereich: 'privat', ortsdatenEntfernt: true } })).status).toBe(403);
  });

  it('Papierkorb: löschen, wiederherstellen, endgültig (Objekte weg)', async () => {
    const { medium } = await hochladen(r, 'person-b', { bytes: jpeg(10_000) });
    const vorher = dateienUnter(process.env.MAKE_OS_MEDIEN_DIR!).filter(d => d.includes(String(medium.id))).length;
    expect(vorher).toBe(2);
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-b', { json: { aktion: 'loeschen', id: medium.id } })).status).toBe(200);
    expect((await rufe(r.liste, 'GET', '/api/medien', 'person-b')).text).not.toContain(String(medium.id));
    expect((await rufe(r.liste, 'GET', '/api/medien?papierkorb=1', 'person-b')).text).toContain(String(medium.id));
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-b', { json: { aktion: 'wiederherstellen', id: medium.id } })).status).toBe(200);
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-b', { json: { aktion: 'endgueltig', id: medium.id } })).status).toBe(409);
    await rufe(r.liste, 'POST', '/api/medien', 'person-b', { json: { aktion: 'loeschen', id: medium.id } });
    expect((await rufe(r.liste, 'POST', '/api/medien', 'partner', { json: { aktion: 'endgueltig', id: medium.id } })).status).toBe(403);
    expect((await rufe(r.liste, 'POST', '/api/medien', 'person-b', { json: { aktion: 'endgueltig', id: medium.id } })).status).toBe(200);
    expect(dateienUnter(process.env.MAKE_OS_MEDIEN_DIR!).filter(d => d.includes(String(medium.id)))).toEqual([]);
    expect(statSync(process.env.MAKE_OS_MEDIEN_DIR!).isDirectory()).toBe(true);
  });
});

describe('mit Object Storage (S3-Fake statt Ordner)', () => {
  it('derselbe Weg: Stücke als S3-Teile, nur Chiffrat im Bucket, Range über S3', async () => {
    const { s3Fake } = await import('./fixtures/s3-fake');
    const { s3Speicher } = await import('@/lib/medien/speicher-s3');
    const { speicherSetzen } = await import('@/lib/medien/speicher');
    const fake = s3Fake();
    speicherSetzen(s3Speicher({ modus: 's3', endpunkt: 'https://nbg1.your-objectstorage.com', bucket: 'medien-test', zugang: 'z', geheimnis: 'g', region: 'nbg1', stil: 'pfad', praefix: 'm' }, fake.holen));
    try {
      const klar = jpeg(GRENZEN.teil + 1234);
      const { medium } = await hochladen(r, 'person-b', { bytes: klar });
      expect(fake.aufrufe.filter(a => a.methode === 'PUT' && a.abfrage.partNumber).length).toBe(2);
      const probe = klar.subarray(4000, 4064);
      for (const [, b] of fake.objekte) expect(b.includes(probe)).toBe(false);
      const teil = await rufe(r.inhalt, 'GET', `/api/medien/inhalt?id=${medium.id}&v=original`, 'person-b', { kopf: { range: 'bytes=100-199' } });
      expect(teil.status).toBe(206);
      expect(teil.bytes.equals(klar.subarray(100, 200))).toBe(true);
    } finally { speicherSetzen(null); }
  });
});
