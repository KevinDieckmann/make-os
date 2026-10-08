// ─── Medienspeicher: Signatur, Ordner, S3 gegen den Fake (09.10., Paket 5) ─────────────────────────────────────────────
// Signatur V4 gegen das veröffentlichte Beispiel „GET Object“ der AWS-Doku; Ordner-Adapter (Stücke, Zusammenfügen, Bereiche, Grenze);
// S3-Adapter gegen tests/fixtures/s3-fake.ts (mehrteilig, Range, Löschen, Fehler) — kein Netz. Konfiguration nur aus der Umgebung.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { signiere, zuSignierenFuer, awsKodieren, LEERER_HASH } from '@/lib/medien/s3-signatur';
import { medienKonfig, s3Unvollstaendig, objektOk, SpeicherFehler } from '@/lib/medien/speicher';
import { ordnerSpeicher } from '@/lib/medien/speicher-ordner';
import { s3Speicher } from '@/lib/medien/speicher-s3';
import { s3Fake } from './fixtures/s3-fake';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-medien-speicher-'));
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Signatur V4', () => {
  it('stimmt mit dem Beispiel „GET Object“ der AWS-Doku überein', () => {
    const e = { methode: 'GET', host: 'examplebucket.s3.amazonaws.com', pfad: '/test.txt', abfrage: {}, kopf: { range: 'bytes=0-9' }, nutzlast: LEERER_HASH, zugang: 'AKIAIOSFODNN7EXAMPLE', geheimnis: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', jetzt: new Date('2013-05-24T00:00:00Z') };
    expect(zuSignierenFuer(e).split('\n').pop()).toBe('7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972');
    expect(signiere(e).authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  });
  it('kodiert wie AWS (nur A–Z a–z 0–9 - . _ ~ bleiben)', () => {
    expect(awsKodieren('a b/c*~')).toBe('a%20b%2Fc%2A~');
    expect(awsKodieren('a b/c', true)).toBe('a%20b/c');
  });
});

describe('Konfiguration (nur aus der Umgebung)', () => {
  it('ohne Object Storage: Ordner mit Grenze; halb eingerichtet wird erkannt; aus ist aus', () => {
    const o = medienKonfig({ MAKE_OS_MEDIEN_DIR: ordner, MAKE_OS_MEDIEN_ORDNER_MB: '100' } as unknown as NodeJS.ProcessEnv);
    expect(o).toMatchObject({ modus: 'ordner', grenze: 100 * 1024 * 1024 });
    expect(s3Unvollstaendig({ MAKE_OS_MEDIEN_S3_BUCKET: 'x', MAKE_OS_MEDIEN_DIR: ordner } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(medienKonfig({ MAKE_OS_MEDIEN: 'aus' } as unknown as NodeJS.ProcessEnv).modus).toBe('aus');
    const s = medienKonfig({ MAKE_OS_MEDIEN_S3_ENDPUNKT: 'https://nbg1.your-objectstorage.com', MAKE_OS_MEDIEN_S3_BUCKET: 'make-medien', MAKE_OS_MEDIEN_S3_ZUGANG: 'z', MAKE_OS_MEDIEN_S3_GEHEIMNIS: 'g' } as unknown as NodeJS.ProcessEnv);
    expect(s).toMatchObject({ modus: 's3', region: 'nbg1', stil: 'pfad' });
    // Nur https — ein unverschlüsselter Endpunkt wird nicht angenommen.
    expect(medienKonfig({ MAKE_OS_MEDIEN_S3_ENDPUNKT: 'http://nbg1.example', MAKE_OS_MEDIEN_S3_BUCKET: 'b', MAKE_OS_MEDIEN_S3_ZUGANG: 'z', MAKE_OS_MEDIEN_S3_GEHEIMNIS: 'g', MAKE_OS_MEDIEN_DIR: ordner } as unknown as NodeJS.ProcessEnv).modus).toBe('ordner');
  });
  it('Objekt-Namen: nur Kennungen, keine Pfad-Tricks', () => {
    expect(objektOk('m/md-00000000-0000-4000-8000-00000000000a/original')).toBe(true);
    for (const x of ['../etc/passwd', 'm/../x', 'M/x', 'm', 'm/x.jpg', '/m/x']) expect(objektOk(x), x).toBe(false);
  });
});

describe('Ordner-Adapter', () => {
  const s = ordnerSpeicher({ modus: 'ordner', ordner: path.join(ordner, 'medien'), grenze: 40 * 1024 * 1024, praefix: 'm' });
  it('Stücke → zusammengefügt; Bereiche lesen; löschen; Abbrechen räumt die Stücke', async () => {
    const a = randomBytes(6 * 1024 * 1024), b = randomBytes(1000);
    const u = await s.beginnen('m/md-1/original');
    const e1 = await s.teil('m/md-1/original', u, 0, a), e2 = await s.teil('m/md-1/original', u, 1, b);
    await s.abschliessen('m/md-1/original', u, [{ nr: 1, etag: e2 }, { nr: 0, etag: e1 }]);
    expect((await s.lesen('m/md-1/original'))!.equals(Buffer.concat([a, b]))).toBe(true);
    expect((await s.lesen('m/md-1/original', { von: a.length - 2, bis: a.length + 1 }))!.equals(Buffer.concat([a.subarray(-2), b.subarray(0, 2)]))).toBe(true);
    expect(existsSync(path.join(ordner, 'medien', 'teile', u))).toBe(false);
    await s.loeschen('m/md-1/original');
    expect(await s.lesen('m/md-1/original')).toBeNull();
    const u2 = await s.beginnen('m/md-2/original');
    await s.teil('m/md-2/original', u2, 0, randomBytes(100));
    await s.abbrechen('m/md-2/original', u2);
    expect(existsSync(path.join(ordner, 'medien', 'teile', u2))).toBe(false);
  });
  it('Grenze: darüber 507 „voll“', async () => {
    const klein = ordnerSpeicher({ modus: 'ordner', ordner: path.join(ordner, 'klein'), grenze: 1000, praefix: 'm' });
    await expect(klein.schreiben('m/md-3/raster', randomBytes(2000))).rejects.toMatchObject({ status: 507 });
    await expect(klein.schreiben('m/../x', Buffer.from('x'))).rejects.toBeInstanceOf(SpeicherFehler);
  });
});

describe('S3-Adapter gegen den Fake', () => {
  const fake = s3Fake();
  const s = s3Speicher({ modus: 's3', endpunkt: 'https://nbg1.your-objectstorage.com', bucket: 'medien-test', zugang: 'zugang-test', geheimnis: 'geheimnis-test', region: 'nbg1', stil: 'pfad', praefix: 'm' }, fake.holen);
  it('mehrteilig hochladen, ganz und im Bereich lesen, löschen', async () => {
    const a = randomBytes(5 * 1024 * 1024 + 7), b = randomBytes(333);
    const u = await s.beginnen('m/md-4/original');
    const t0 = await s.teil('m/md-4/original', u, 0, a);
    const t1 = await s.teil('m/md-4/original', u, 1, b);
    await s.abschliessen('m/md-4/original', u, [{ nr: 0, etag: t0 }, { nr: 1, etag: t1 }]);
    expect(fake.aufrufe.find(x => x.methode === 'PUT' && x.abfrage.partNumber === '1')).toBeTruthy(); // Teile ab 1
    expect((await s.lesen('m/md-4/original'))!.equals(Buffer.concat([a, b]))).toBe(true);
    expect((await s.lesen('m/md-4/original', { von: 10, bis: 19 }))!.equals(a.subarray(10, 20))).toBe(true);
    await s.loeschen('m/md-4/original');
    expect(await s.lesen('m/md-4/original')).toBeNull();
  });
  it('Fehler kommen als SpeicherFehler mit Status (5xx → 503) — nie mit Schlüsseln im Text', async () => {
    fake.fehlerBei(a => a.methode === 'PUT' && a.pfad === 'm/md-5/raster', 500);
    const e = await s.schreiben('m/md-5/raster', Buffer.from('x')).catch(x => x);
    expect(e).toBeInstanceOf(SpeicherFehler);
    expect((e as SpeicherFehler).status).toBe(503);
    expect(String((e as Error).message)).not.toMatch(/geheimnis|zugang-test/);
    await s.schreiben('m/md-5/raster', Buffer.from('x')); // zweiter Versuch geht
    expect((await s.lesen('m/md-5/raster'))!.toString()).toBe('x');
  });
  it('abgebrochener Upload ist weg; ein zu kleines Stück vor dem letzten lehnt S3 ab', async () => {
    const u = await s.beginnen('m/md-6/original');
    await s.teil('m/md-6/original', u, 0, Buffer.alloc(10));
    const t1 = await s.teil('m/md-6/original', u, 1, Buffer.alloc(10));
    await expect(s.abschliessen('m/md-6/original', u, [{ nr: 0, etag: '"x"' }, { nr: 1, etag: t1 }])).rejects.toBeInstanceOf(SpeicherFehler);
    await s.abbrechen('m/md-6/original', u);
    expect(fake.uploads.has(u)).toBe(false);
  });
});
