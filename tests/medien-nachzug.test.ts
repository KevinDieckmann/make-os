// ─── Medien unterwegs — Nachzug Recht & Betrieb (09.10., Paket 5/4c) ─────────────────────────────────────────────────────
// · Konto-Export: eigene Medien als Metadaten (Privat ganz, Business nur eigene/abgebildete/bewertete), eigene Einwilligungen, Dateien NUR als
//   Liste mit Download-Weg — nie Schlüssel, Objekt-Namen, Salze; der Weg führt wirklich zur Datei (dieselbe Sicht).
// · Instanz-Export: Kataloge ohne Schlüssel je Medium + Liste der Objekte im Medienspeicher (Abgleich „fehlt“).
// · Instanz löschen: S3 auflisten/leeren nur unter dem Präfix (Fake, kein Netz), fremde Namen nie, Fehler → Abbruch vor dem Datenordner;
//   Skript: Trockenlauf zeigt Medien, Kataloge ohne Speicher → Abbruch, `--ohne-medien`, `--env` liest nur MAKE_OS_MEDIEN*.
// · Empfänger Hetzner (Object Storage), VVT vv-medien (empfaengerIds, alte Fassungen gehoben), Art. 15 (vv-medien).
// · Head of IT: Ordner-Rückfall > 80 % von 2 GB → Befund. · Selbstprüfung „Medien: Einwilligungen und Freigaben“ — nur Zähler, nur mit Medien.
// Erfundene Konten (@example.invalid), eigene Temp-Ordner, kein Netz.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KONTEN, jpeg, png, rufe, routen, hochladen, type Routen } from './fixtures/medien-hilfen';
import { s3Fake } from './fixtures/s3-fake';
import { neuesMedium, type Lage } from '@/lib/medien/regeln';
import { leererKatalog, type Medium, type MedienKatalog, type MedienEinwilligung } from '@/lib/medien/typen';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-medien-nachzug-'));
  process.env.MAKE_OS_DATEN_DIR = p.join(o, 'daten');
  process.env.MAKE_OS_MEDIEN_DIR = p.join(o, 'medien');
  process.env.MAKE_OS_KEY = 'pruef-schluessel-medien-nachzug';
  process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-medien-nachzug-nur-test';
  for (const k of Object.keys(process.env)) if (k.startsWith('MAKE_OS_MEDIEN_S3') || k === 'MAKE_OS_MEDIEN_ORDNER_MB' || k === 'MAKE_OS_MEDIEN_PRAEFIX') delete process.env[k];
  delete process.env.MAKE_OS_ADRESSE;
  return o;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

let r: Routen;
type Modul = Record<string, (r: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>>;
let kontoDaten: Modul;
const tun = (p: string, j: Record<string, unknown>) => rufe(r.liste, 'POST', '/api/medien', p, { json: j });

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', KONTEN);
  await db.saveJson('datenschutz-einrichtung', { verantwortlicher: { name: 'Beispiel GmbH', anschrift: 'Musterweg 1, 12345 Musterstadt', mail: 'datenschutz@example.invalid' } });
  r = await routen();
  kontoDaten = await import('@/app/api/konto/daten/route') as unknown as Modul;
});

const J = '2026-10-09T10:00:00.000Z';
const md = (id: string, x: Partial<Medium> = {}): Medium => ({ ...neuesMedium({ id, art: 'bild', bereich: 'business', von: 'p-a', hochgeladen: J, typ: 'image/jpeg', groesse: 10, ortsdatenEntfernt: true, schluessel: { kid: 'k1', dek: 'GEHEIM-DEK' }, varianten: { original: { objekt: `m/${id}/original`, bytes: 10, typ: 'image/jpeg', salze: ['abcd1234'], sha256: 'f'.repeat(64) } }, jetzt: J }), ...x });
const lage = (x: Partial<Lage> = {}): Lage => ({ heute: '2026-10-09', einwilligungen: [], kontaktSperre: () => null, ...x });
const ew = (id: string, x: Partial<MedienEinwilligung> = {}): MedienEinwilligung => ({ id, am: J, erfasstVon: 'p-a', person: { kontaktId: 'c-1' }, zwecke: ['website'], wortlaut: 'Text', fassung: 'f1', ...x });
const s3Konfig = { modus: 's3' as const, endpunkt: 'https://nbg1.your-objectstorage.com', bucket: 'medien-test', zugang: 'z', geheimnis: 'g', region: 'nbg1', stil: 'pfad' as const, praefix: 'm' };
const S3_ENV = { MAKE_OS_MEDIEN_S3_ENDPUNKT: s3Konfig.endpunkt, MAKE_OS_MEDIEN_S3_BUCKET: s3Konfig.bucket, MAKE_OS_MEDIEN_S3_ZUGANG: 'zugang-nur-test', MAKE_OS_MEDIEN_S3_GEHEIMNIS: 'geheimnis-nur-test' };

// ── Speicher: Listen nur unter dem Präfix ─────────────────────────────────────────────────────────────────────────────

describe('Medienspeicher: auflisten und offene Uploads (S3-Fake, seitenweise)', () => {
  it('nur unter <präfix>/, fremde Namen gekennzeichnet, Weiterblättern über Token und Marker', async () => {
    const { s3Speicher } = await import('@/lib/medien/speicher-s3');
    const fake = s3Fake({ seite: 2 });
    const s = s3Speicher(s3Konfig, fake.holen);
    for (let i = 0; i < 5; i++) await s.schreiben(`m/md-${i}/original`, Buffer.alloc(10 + i));
    await s.schreiben('x/md-9/original', Buffer.alloc(3)); // andere Instanz im selben Bucket
    fake.objekte.set('m/FREMD.txt', Buffer.alloc(1));    // passt nicht ins Muster
    for (let i = 0; i < 3; i++) await s.beginnen(`m/md-u${i}/original`);
    await s.beginnen('x/md-u9/original');
    const liste = []; for await (const o of s.auflisten!('m')) liste.push(o);
    expect(liste.filter(o => !o.fremd).map(o => o.objekt)).toEqual(['m/md-0/original', 'm/md-1/original', 'm/md-2/original', 'm/md-3/original', 'm/md-4/original']);
    expect(liste.filter(o => o.fremd).map(o => o.objekt)).toEqual(['m/FREMD.txt']);
    expect(liste.find(o => o.objekt === 'm/md-4/original')?.bytes).toBe(14);
    const ups = []; for await (const u of s.offeneUploads!('m')) ups.push(u.objekt);
    expect(ups.sort()).toEqual(['m/md-u0/original', 'm/md-u1/original', 'm/md-u2/original']);
    const listen = fake.aufrufe.filter(a => a.methode === 'GET' && !a.pfad);
    expect(listen.filter(a => a.abfrage['list-type'] === '2').length).toBeGreaterThanOrEqual(3); // 6 Treffer à 2 je Seite
    expect(listen.every(a => (a.abfrage.prefix ?? '') === 'm/')).toBe(true);
    await expect((async () => { for await (const _ of s.auflisten!('../x')) { /* nie */ } })()).rejects.toThrow(/Präfix/);
  });

  it('Ordner: auflisten über obj/<präfix>/, offene Uploads = Stück-Ordner', async () => {
    const { ordnerSpeicher } = await import('@/lib/medien/speicher-ordner');
    const d = mkdtempSync(path.join(tmpdir(), 'make-os-medien-ordner-'));
    const s = ordnerSpeicher({ modus: 'ordner', ordner: d, grenze: 10 * 1024 * 1024, praefix: 'm' });
    await s.schreiben('m/md-a/original', Buffer.alloc(7));
    await s.schreiben('m/md-a/raster', Buffer.alloc(2));
    await s.schreiben('n/md-b/original', Buffer.alloc(2));
    await s.beginnen('m/md-c/original');
    const liste = []; for await (const o of s.auflisten!('m')) liste.push(o);
    expect(liste).toEqual([{ objekt: 'm/md-a/original', bytes: 7 }, { objekt: 'm/md-a/raster', bytes: 2 }]);
    const ups = []; for await (const u of s.offeneUploads!('m')) ups.push(u);
    expect(ups).toHaveLength(1);
    rmSync(d, { recursive: true, force: true });
  });
});

describe('Instanz löschen: Inventur und Leeren (rein über den Speicher)', () => {
  it('Inventur zählt, Leeren löscht alles unter dem Präfix — fremde Namen und andere Präfixe bleiben; Fehler werden gezählt', async () => {
    const { s3Speicher } = await import('@/lib/medien/speicher-s3');
    const { medienInventur, medienLeeren } = await import('@/lib/medien/instanz.mjs');
    const fake = s3Fake({ seite: 3 });
    const s = s3Speicher(s3Konfig, fake.holen);
    for (let i = 0; i < 7; i++) await s.schreiben(`m/md-${i}/original`, Buffer.alloc(100));
    await s.schreiben('x/md-9/original', Buffer.alloc(3));
    fake.objekte.set('m/FREMD.txt', Buffer.alloc(1));
    await s.beginnen('m/md-u/original');
    const inv = await medienInventur(s, { modus: 's3', ort: 'o', praefix: 'm' });
    expect(inv).toMatchObject({ objekte: 7, bytes: 700, fremd: 1, offeneUploads: 1 });
    fake.fehlerBei(a => a.methode === 'DELETE' && a.pfad === 'm/md-3/original' && !a.abfrage.uploadId, 500, false);
    const r1 = await medienLeeren(s, 'm');
    expect(r1).toMatchObject({ geloescht: 6, abgebrochen: 1, fehler: 1, fremd: 1 });
    expect([...fake.objekte.keys()].sort()).toEqual(['m/FREMD.txt', 'm/md-3/original', 'x/md-9/original']);
    expect(fake.uploads.size).toBe(0);
  });
});

describe('Instanz löschen: Plan des Skripts (medienPlan)', () => {
  const daten = () => { const d = mkdtempSync(path.join(tmpdir(), 'make-os-medien-plan-')); mkdirSync(path.join(d, 'system')); return d; };

  it('Object Storage: Trockenlauf mit Anzahl/Größe, Stand im Code, Ausführen leert — scheitert eins, Abbruch', async () => {
    const { medienPlan } = await import('@/lib/medien/instanz.mjs');
    const { s3Speicher } = await import('@/lib/medien/speicher-s3');
    const fake = s3Fake();
    const s = s3Speicher(s3Konfig, fake.holen);
    for (let i = 0; i < 3; i++) await s.schreiben(`m/md-${i}/original`, Buffer.alloc(1024));
    const d = daten();
    const p = await medienPlan({ env: S3_ENV, datenOrdner: d, holen: fake.holen });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.zeilen.join('\n')).toMatch(/Object Storage https:\/\/nbg1\.your-objectstorage\.com\/medien-test \(Präfix m\/\) — 3 Objekte/);
    expect(p.zeilen.join('\n')).not.toContain('geheimnis-nur-test');
    expect(p.stand).toBe('s3:3:3072:0:0');
    fake.fehlerBei(a => a.methode === 'DELETE' && a.pfad === 'm/md-1/original');
    const schief = await p.ausfuehren();
    expect(schief.ok).toBe(false);
    if (!schief.ok) expect(schief.abbruch).toMatch(/Datenordner bleibt/);
    const p2 = await medienPlan({ env: S3_ENV, datenOrdner: d, holen: fake.holen });
    if (!p2.ok) throw new Error(p2.abbruch);
    expect(p2.stand).toBe('s3:1:1024:0:0'); // anderer Stand → anderer Bestätigungs-Code
    const gut = await p2.ausfuehren();
    expect(gut.ok).toBe(true);
    if (gut.ok) expect(gut.zeilen.join(' ')).toMatch(/1 Objekte .* gelöscht.*Bucket und die S3-Zugangsdaten/);
    expect(fake.objekte.size).toBe(0);
    rmSync(d, { recursive: true, force: true });
  });

  it('halb eingerichtet, nicht erreichbar, Kataloge ohne Speicher → Abbruch; --ohne-medien geht bewusst', async () => {
    const { medienPlan } = await import('@/lib/medien/instanz.mjs');
    const d = daten();
    const halb = await medienPlan({ env: { MAKE_OS_MEDIEN_S3_BUCKET: 'b' }, datenOrdner: d });
    expect(halb).toMatchObject({ ok: false });
    if (!halb.ok) expect(halb.abbruch).toMatch(/halb eingerichtet/);
    const weg = await medienPlan({ env: S3_ENV, datenOrdner: d, holen: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch });
    expect(weg.ok).toBe(false);
    if (!weg.ok) expect(weg.abbruch).toMatch(/nicht erreichbar.*Nichts gelöscht/);
    writeFileSync(path.join(d, 'medien--haus.json'), '{}');
    const ohne = await medienPlan({ env: {}, datenOrdner: d });
    expect(ohne.ok).toBe(false);
    if (!ohne.ok) expect(ohne.abbruch).toMatch(/1 Medien-Kataloge .* weder Object Storage/);
    const bewusst = await medienPlan({ env: {}, datenOrdner: d, ohneMedien: true });
    expect(bewusst.ok).toBe(true);
    if (bewusst.ok) { expect(bewusst.zeilen[0]).toMatch(/NICHT geprüft und NICHT gelöscht/); expect(bewusst.stand).toBe('ohne-medien'); }
    rmSync(d, { recursive: true, force: true });
  });

  it('Ordner außerhalb des Datenordners: wird mit gelöscht — aber nie .data, nie ein fremder Ordner', async () => {
    const { medienPlan } = await import('@/lib/medien/instanz.mjs');
    const d = daten();
    const aussen = mkdtempSync(path.join(tmpdir(), 'make-os-medien-aussen-'));
    mkdirSync(path.join(aussen, 'obj', 'm', 'md-a'), { recursive: true });
    writeFileSync(path.join(aussen, 'obj', 'm', 'md-a', 'original.mkm'), Buffer.alloc(2048));
    const p = await medienPlan({ env: { MAKE_OS_MEDIEN_DIR: aussen }, datenOrdner: d });
    if (!p.ok) throw new Error(p.abbruch);
    expect(p.zeilen.join('\n')).toMatch(/1 Dateien, 2 KB \(außerhalb des Datenordners — wird mit gelöscht\)/);
    expect(p.stand).toBe('ordner:1:2048');
    expect((await p.ausfuehren()).ok).toBe(true);
    expect(existsSync(aussen)).toBe(false);
    // Fremder Inhalt → Abbruch; der lokale Datenordner .data → Abbruch.
    const fremd = mkdtempSync(path.join(tmpdir(), 'make-os-medien-fremd-'));
    writeFileSync(path.join(fremd, 'wichtig.txt'), 'x');
    const f = await medienPlan({ env: { MAKE_OS_MEDIEN_DIR: fremd }, datenOrdner: d });
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.abbruch).toMatch(/nicht wie ein Medien-Ordner/);
    expect(existsSync(path.join(fremd, 'wichtig.txt'))).toBe(true);
    const lokal = path.join(fremd, '.data');
    mkdirSync(path.join(lokal, 'medien'), { recursive: true });
    const l = await medienPlan({ env: { MAKE_OS_MEDIEN_DIR: path.join(lokal, 'medien') }, datenOrdner: d, lokal: (await import('node:fs')).realpathSync(lokal) });
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.abbruch).toMatch(/\.data/);
    rmSync(fremd, { recursive: true, force: true });
    rmSync(d, { recursive: true, force: true });
  });
});

describe('scripts/instanz-loeschen.mjs mit Medien', () => {
  const sauber = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('MAKE_OS_MEDIEN') && k !== 'MAKE_OS_GRABSTEINE_DIR'));
  const lauf = (args: string[], env: Record<string, string> = {}) => {
    try { return { code: 0, out: execFileSync(process.execPath, ['scripts/instanz-loeschen.mjs', ...args], { encoding: 'utf8', env: { ...sauber, ...env } as NodeJS.ProcessEnv }) }; }
    catch (e) { const x = e as { status: number; stdout: string; stderr: string }; return { code: x.status, out: `${x.stdout}${x.stderr}` }; }
  };
  const instanz = () => {
    const basis = mkdtempSync(path.join(tmpdir(), 'make-os-instanz-medien-'));
    const daten = path.join(basis, 'daten');
    mkdirSync(path.join(daten, 'system'), { recursive: true });
    writeFileSync(path.join(daten, 'konten.json'), '{}');
    return { basis, daten, keine: path.join(basis, 'keine') };
  };

  it('Medien-Ordner im Datenordner: Trockenlauf nennt ihn, Ausführen löscht mit, Bericht nennt ihn', () => {
    const { basis, daten, keine } = instanz();
    mkdirSync(path.join(daten, 'medien', 'obj', 'm', 'md-a'), { recursive: true });
    writeFileSync(path.join(daten, 'medien', 'obj', 'm', 'md-a', 'original.mkm'), Buffer.alloc(100));
    writeFileSync(path.join(daten, 'medien--haus.json'), '{}');
    const t = lauf(['--ordner', daten, '--sicherungen', keine]);
    expect(t.code).toBe(0);
    expect(t.out).toMatch(/Medien-Ordner: .* — 1 Dateien, .* \(im Datenordner — geht mit ihm\)/);
    expect(t.out).toContain('(kein Object Storage angegeben');
    const code = /--code ([0-9A-F]{8})/.exec(t.out)![1];
    const a = lauf(['--ordner', daten, '--sicherungen', keine, '--ausfuehren', '--code', code]);
    expect(a.code).toBe(0);
    expect(a.out).toMatch(/Medien: Medien-Ordner im Datenordner \(1 Dateien/);
    expect(existsSync(daten)).toBe(false);
    rmSync(basis, { recursive: true, force: true });
  });

  it('Kataloge ohne Speicher → Abbruch (nichts gelöscht); --ohne-medien geht und steht im Aufruf und Bericht', () => {
    const { basis, daten, keine } = instanz();
    writeFileSync(path.join(daten, 'medien-privat--lena.json'), '{}');
    const t = lauf(['--ordner', daten, '--sicherungen', keine]);
    expect(t.code).toBe(2);
    expect(t.out).toMatch(/Medien-Kataloge .* weder Object Storage/);
    const o = lauf(['--ordner', daten, '--sicherungen', keine, '--ohne-medien']);
    expect(o.code).toBe(0);
    expect(o.out).toContain('NICHT geprüft und NICHT gelöscht');
    expect(o.out).toMatch(/--ohne-medien --ausfuehren --code/);
    const code = /--code ([0-9A-F]{8})/.exec(o.out)![1];
    expect(lauf(['--ordner', daten, '--sicherungen', keine, '--ausfuehren', '--code', code]).code).toBe(2); // ohne Schalter wieder Abbruch
    expect(existsSync(daten)).toBe(true);
    const a = lauf(['--ordner', daten, '--sicherungen', keine, '--ohne-medien', '--ausfuehren', '--code', code]);
    expect(a.code).toBe(0);
    expect(a.out).toMatch(/Medien: NICHT geprüft und NICHT gelöscht/);
    rmSync(basis, { recursive: true, force: true });
  });

  it('--env liest nur MAKE_OS_MEDIEN*; Object Storage nicht erreichbar bzw. halb → Abbruch ohne Geheimnis in der Ausgabe', () => {
    const { basis, daten, keine } = instanz();
    const env = path.join(basis, 'instanz.env');
    writeFileSync(env, ['MAKE_OS_KEY=nie-lesen-geheim', 'export MAKE_OS_MEDIEN_S3_ENDPUNKT="https://127.0.0.1:9"', `MAKE_OS_MEDIEN_S3_BUCKET='medien-test'`, 'MAKE_OS_MEDIEN_S3_ZUGANG=zugang-x', 'MAKE_OS_MEDIEN_S3_GEHEIMNIS=geheimnis-nie-zeigen', ''].join('\n'));
    const t = lauf(['--ordner', daten, '--sicherungen', keine, '--env', env]);
    expect(t.code).toBe(2);
    expect(t.out).toMatch(/nicht erreichbar.*Nichts gelöscht/);
    expect(t.out).not.toContain('geheimnis-nie-zeigen');
    expect(t.out).not.toContain('nie-lesen-geheim');
    expect(existsSync(daten)).toBe(true);
    const halb = lauf(['--ordner', daten, '--sicherungen', keine], { MAKE_OS_MEDIEN_S3_BUCKET: 'b' });
    expect(halb.code).toBe(2);
    expect(halb.out).toContain('halb eingerichtet');
    rmSync(basis, { recursive: true, force: true });
  });
});

// ── Konto-Export ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Konto › Meine Daten: Medien', () => {
  it('rein: Privat ganz, Business nur eigene/abgebildete/bewertete (fremde Markierungen nur als Anzahl), eigene Einwilligungen, Wege', async () => {
    const { medienKontoExportRein } = await import('@/lib/medien/export');
    const business: MedienKatalog = { ...leererKatalog(), medien: [
      md('md-eigen', { von: 'lena', personen: [{ id: 'pb-1', art: 'kontakt', kontaktId: 'c-fremd', rolle: 'haupt', markiertVon: 'lena', am: J }] }),
      md('md-abgebildet', { von: 'jonas', personen: [{ id: 'pb-2', art: 'konto', konto: 'lena', rolle: 'beiwerk', markiertVon: 'jonas', am: J }, { id: 'pb-3', art: 'kontakt', kontaktId: 'c-x', rolle: 'haupt', markiertVon: 'jonas', am: J }] }),
      md('md-bewertet', { von: 'jonas', auswahl: { lena: 'favorit' } }),
      md('md-fremd', { von: 'jonas' }),
      md('md-papierkorb', { von: 'lena', geloeschtAm: J }),
      md('md-video', { von: 'lena', art: 'video', typ: 'video/mp4', ton: 'nicht-freigegeben' }),
    ], einwilligungen: [
      ew('ew-lena', { person: { konto: 'lena' }, unterschrift: { objekt: 'm/ew-lena/unterschrift', bytes: 50, typ: 'image/png', salze: ['x'], sha256: 'a', schluessel: { kid: 'k', dek: 'GEHEIM-DEK' } } }),
      ew('ew-gast', { erfasstVon: 'lena', person: { kontaktId: 'c-gast' } }),
    ] };
    const privat: MedienKatalog = { v: 1, alben: [{ id: 'al-ich', bereich: 'privat', art: 'frei', titel: 'Urlaub', sicht: 'nur-ich', von: 'lena', angelegt: J }], medien: [md('md-privat', { bereich: 'privat', von: 'lena', album: 'al-ich', personen: [{ id: 'pb-9', art: 'kontakt', kontaktId: 'c-freundin', rolle: 'haupt', markiertVon: 'lena', am: J }] })] };
    const x = medienKontoExportRein(business, privat, 'lena', 'https://instanz.example.invalid')!;
    expect(x.business.medien.map(m => m.id).sort()).toEqual(['md-abgebildet', 'md-bewertet', 'md-eigen', 'md-papierkorb', 'md-video']);
    const abg = x.business.medien.find(m => m.id === 'md-abgebildet')!;
    expect(abg.personen).toEqual([expect.objectContaining({ konto: 'lena' })]);
    expect(abg.personenAnzahl).toBe(2);
    expect(JSON.stringify(x.business)).not.toContain('c-fremd'); // Kennungen Dritter im Business nie
    expect(x.business.medien.find(m => m.id === 'md-bewertet')!.meineWahl).toBe('favorit');
    expect(x.privat.medien[0]).toMatchObject({ id: 'md-privat', albumTitel: 'Urlaub', personen: [expect.objectContaining({ kontaktId: 'c-freundin' })] });
    expect(x.privat.alben).toEqual([expect.objectContaining({ id: 'al-ich', sicht: 'nur-ich' })]);
    expect(x.einwilligungen.map(e => e.id)).toEqual(['ew-lena']);
    expect(x.einwilligungenErfasst).toBe(1);
    const text = JSON.stringify(x);
    expect(text).not.toMatch(/GEHEIM-DEK|"dek"|"salze"|"objekt"|"schluessel"/);
    const weg = (bezug: string, art: string) => x.dateien.find(d => d.bezug === bezug && d.art === art)!;
    expect(weg('md-eigen', 'original').weg).toBe('https://instanz.example.invalid/api/medien/inhalt?id=md-eigen&v=original&download=1');
    expect(weg('md-papierkorb', 'original')).toMatchObject({ hinweis: expect.stringMatching(/Papierkorb/) });
    expect(weg('md-papierkorb', 'original').weg).toBeUndefined();
    expect(weg('md-video', 'original').hinweis).toMatch(/Ton nicht freigegeben/);
    expect(weg('ew-lena', 'unterschrift').weg).toBe('https://instanz.example.invalid/api/medien/beleg?art=unterschrift&id=ew-lena');
    expect(x.dateien.some(d => d.bezug === 'md-fremd' || d.bezug === 'ew-gast')).toBe(false);
    expect(medienKontoExportRein(leererKatalog(), leererKatalog(), 'niemand')).toBeNull();
  });

  it('Route: Export ohne rohen Privat-Katalog und ohne Schlüssel; der Download-Weg liefert die Datei; fremde Medien fehlen', async () => {
    const privat = await hochladen(r, 'person-b', { bereich: 'privat', bytes: jpeg(3000) });
    const eigen = await hochladen(r, 'person-b', { bytes: jpeg(2000), anlegen: { erkennbarePersonen: 'nein' } });
    const vonA = await hochladen(r, 'person-a', { bytes: jpeg(2500), anlegen: { erkennbarePersonen: 'ja' } });
    const nurA = await hochladen(r, 'person-a', { bytes: jpeg(2100) });
    expect((await tun('person-a', { aktion: 'person-markieren', id: vonA.medium.id, person: { art: 'konto', konto: 'person-b', rolle: 'haupt' } })).status).toBe(200);
    const d = await (await kontoDaten.GET!(new Request('http://test/api/konto/daten', { headers: { 'x-make-user': 'person-b' } }))).json();
    expect(Object.keys(d.bestaende).some((n: string) => n.startsWith('medien-privat--'))).toBe(false);
    expect(d.medien.privat.medien.map((m: { id: string }) => m.id)).toEqual([privat.medium.id]);
    expect(d.medien.business.medien.map((m: { id: string }) => m.id).sort()).toEqual([eigen.medium.id, vonA.medium.id].sort());
    expect(JSON.stringify(d.medien)).not.toContain(String(nurA.medium.id));
    expect(JSON.stringify(d)).not.toMatch(/"dek"|"salze"|"objekt"|"schluessel"/);
    const w = d.medien.dateien.find((x: { bezug: string; art: string }) => x.bezug === privat.medium.id && x.art === 'original');
    expect(w.weg).toBe(`/api/medien/inhalt?id=${privat.medium.id}&v=original&download=1`);
    const datei = await rufe(r.inhalt, 'GET', w.weg, 'person-b');
    expect(datei.status).toBe(200);
    expect(datei.bytes.equals(privat.klar)).toBe(true);
    expect((await rufe(r.inhalt, 'GET', w.weg, 'person-a')).status).toBe(404); // „nur ich“ — der Weg öffnet nichts für andere
    // Die Inhaberin sieht im eigenen Export nichts aus dem Privat von person-b.
    const a = await (await kontoDaten.GET!(new Request('http://test/api/konto/daten', { headers: { 'x-make-user': 'person-a' } }))).json();
    expect(JSON.stringify(a.medien ?? {})).not.toContain(String(privat.medium.id));
  });

  it('eigene Unterschrift: die Person selbst lädt sie (Art. 15), fremde weiter nur, wer freigeben darf', async () => {
    const { EINWILLIGUNG_FASSUNG } = await import('@/lib/medien/einwilligung');
    const eigene = await tun('person-a', { aktion: 'einwilligung-anlegen', person: { konto: 'partner' }, zwecke: ['website'], fassung: EINWILLIGUNG_FASSUNG, unterschrift: png().toString('base64') });
    expect(eigene.status).toBe(200);
    const fremde = await tun('person-a', { aktion: 'einwilligung-anlegen', person: { name: 'Gast Beispiel' }, zwecke: ['website'], fassung: EINWILLIGUNG_FASSUNG, unterschrift: png().toString('base64') });
    const idEigen = String((eigene.json.einwilligung as { id: string }).id), idFremd = String((fremde.json.einwilligung as { id: string }).id);
    expect((await rufe(r.beleg, 'GET', `/api/medien/beleg?art=unterschrift&id=${idEigen}`, 'partner')).status).toBe(200);
    expect((await rufe(r.beleg, 'GET', `/api/medien/beleg?art=unterschrift&id=${idFremd}`, 'partner')).status).toBe(403);
    const d = await (await kontoDaten.GET!(new Request('http://test/api/konto/daten', { headers: { 'x-make-user': 'partner' } }))).json();
    expect(d.medien.einwilligungen.map((e: { id: string }) => e.id)).toEqual([idEigen]);
    expect(d.medien.dateien.find((x: { bezug: string }) => x.bezug === idEigen).weg).toBe(`/api/medien/beleg?art=unterschrift&id=${idEigen}`);
    expect(JSON.stringify(d.medien)).not.toContain('Gast Beispiel');
  });
});

// ── Instanz-Export ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Instanz-Export: Medien', () => {
  it('Kataloge ohne Schlüssel je Medium, Liste der Objekte mit Abgleich, Umfang zählt Medien', async () => {
    const { instanzExportTeile, instanzUmfang } = await import('@/lib/datenschutz/instanz-export');
    const { medienKonfig } = await import('@/lib/medien/speicher');
    const u = await instanzUmfang();
    expect(u.medien).toBeGreaterThanOrEqual(4);
    const lies = async () => { let t = ''; for await (const s of instanzExportTeile({ von: 'person-a' })) t += s; return JSON.parse(t); };
    const d = await lies();
    expect(d.fehler).toEqual([]);
    const text = JSON.stringify(d.bestaende['medien--haus-a']);
    expect(text).toContain('"kid"');
    expect(text).not.toContain('"dek"');
    expect(JSON.stringify(d.bestaende['medien-privat--person-b'])).not.toContain('"dek"');
    expect(d.kopf.nichtEnthalten.map((x: { was: string }) => x.was).join(' ')).toMatch(/Medien-Dateien/);
    expect(d.medien.speicher).toMatchObject({ modus: 'ordner', praefix: 'm' });
    expect(d.medien.summe.medien).toBe(u.medien);
    expect(d.medien.summe.fehlen).toBe(0);
    expect(d.medien.objekte.length).toBeGreaterThan(0);
    expect(d.medien.objekte.every((o: { imKatalog: boolean; kennung?: string }) => o.imKatalog && /^(md|ew)-/.test(o.kennung ?? ''))).toBe(true);
    // Eine Datei fehlt im Speicher → steht unter „fehlen“ (nie still).
    const obj = path.join(medienKonfig().modus === 'ordner' ? (medienKonfig() as { ordner: string }).ordner : '', 'obj', d.medien.objekte[0].objekt + '.mkm');
    rmSync(obj);
    const d2 = await lies();
    expect(d2.medien.fehlen).toEqual([d.medien.objekte[0].objekt]);
  });
});

// ── Empfänger, VVT, Art. 15 ────────────────────────────────────────────────────────────────────────────────────────────

describe('Empfänger-Register, Verzeichnis und Auskunft', () => {
  it('Hetzner nennt den Object Storage; unveränderte alte Fassung wird gehoben, von Hand Geändertes bleibt', async () => {
    const { EMPFAENGER_START, empfaengerHeben } = await import('@/lib/datenschutz/einrichtung');
    const h = EMPFAENGER_START.find(e => e.id === 'hetzner')!;
    expect(h.zweck).toMatch(/Object Storage für Fotos und Videos/);
    expect(h.daten).toMatch(/nur als Chiffrat/);
    expect(h.notiz).toMatch(/Object Storage/);
    const alt = { ...h, zweck: 'Betrieb des Servers in Deutschland, nächtliche Sicherungen, Server-Abbilder', daten: 'alle Bestände der Instanz (auf der Platte verschlüsselt), Sicherungen (verschlüsselt), Server-Protokolle (IP-Adressen)', notiz: 'AVV in der Hetzner-Konsole abschließen und als PDF ablegen.' };
    expect(empfaengerHeben([alt])[0]).toMatchObject({ zweck: h.zweck, daten: h.daten, notiz: h.notiz });
    const eigen = { ...alt, zweck: 'Unser eigener Satz' };
    expect(empfaengerHeben([eigen])[0].zweck).toBe('Unser eigener Satz');
  });

  it('vv-medien: Empfänger Hetzner, Anthropic, Google Vertex; alte Fassung gehoben, eigene Liste bleibt', async () => {
    const { verarbeitungenPlattform, alteFassungenHeben } = await import('@/lib/crm/datenschutz');
    const v = verarbeitungenPlattform(J).find(x => x.id === 'vv-medien')!;
    expect(v.empfaengerIds).toEqual(['hetzner', 'anthropic', 'google-vertex']);
    expect(v.empfaenger).toMatch(/Google Cloud Vertex AI nur auf Klick/);
    const alt = { ...v, empfaengerIds: ['hetzner', 'anthropic'], empfaenger: 'Haushalt/Team (Privat nur die Person bzw. Alben „Haushalt“); Hetzner (Server und Object Storage, Deutschland — nur Chiffrat); Anthropic nur für Medien, die ausdrücklich einem Head gegeben sind (Vorschaubild ≤ 1568 px, nie Minderjährige)', drittland: 'Speicher keines (Hetzner, Deutschland); Anthropic: USA — Standardvertragsklauseln, prüfen' };
    const g = alteFassungenHeben([alt])[0];
    expect(g).toMatchObject({ empfaengerIds: v.empfaengerIds, empfaenger: v.empfaenger, drittland: v.drittland });
    const eigen = { ...alt, empfaengerIds: ['hetzner'] };
    expect(alteFassungenHeben([eigen])[0].empfaengerIds).toEqual(['hetzner']);
    expect(alteFassungenHeben([g])).toEqual([g]); // idempotent
  });

  it('Art. 15: Konto-Auskunft nennt vv-medien, Kontakt-Auskunft nur mit Medien bzw. Einwilligungen', async () => {
    const { KONTO_VERARBEITUNGEN, kontaktBereiche, verarbeitungenFuer } = await import('@/lib/datenschutz/art15');
    expect(KONTO_VERARBEITUNGEN).toContain('vv-medien');
    expect(kontaktBereiche({ medien: { medien: [{ id: 'md-1' }], einwilligungen: [] } })).toContain('medien');
    expect(kontaktBereiche({ medien: { medien: [], einwilligungen: [{ id: 'ew-1' }] } })).toContain('medien');
    expect(kontaktBereiche({ medien: { medien: [], einwilligungen: [] } })).not.toContain('medien');
    expect(verarbeitungenFuer('kontakt', ['medien'])).toContain('vv-medien');
  });
});

// ── Head of IT ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Head of IT: Ordner-Rückfall fast voll', () => {
  it('über 80 % von 2 GB → gelb (über 95 % rot), darunter kein Voll-Befund — nur Zahlen', async () => {
    const { speicherSetzen } = await import('@/lib/medien/speicher');
    const { medienLage, medienBefunde } = await import('@/lib/medien/hoi');
    const GB2 = 2048 * 1024 * 1024;
    const fake = (belegt: number) => ({ modus: 'ordner' as const, belegt: async () => belegt, beginnen: async () => '', teil: async () => '', abschliessen: async () => {}, abbrechen: async () => {}, schreiben: async () => {}, lesen: async () => null, loeschen: async () => {} });
    try {
      speicherSetzen(fake(Math.round(GB2 * 0.85)));
      const l = await medienLage();
      expect(l).toMatchObject({ modus: 'ordner', grenze: GB2 });
      const b = medienBefunde(l, false).find(x => x.id === 'medien-voll')!;
      expect(b).toMatchObject({ ampel: 'gelb' });
      expect(b.wert).toBe('Speicher fast voll (1,7 GB von 2,0 GB)');
      expect(b.wert).not.toMatch(/md-|@/);
      speicherSetzen(fake(Math.round(GB2 * 0.96)));
      expect(medienBefunde(await medienLage(), false).find(x => x.id === 'medien-voll')?.ampel).toBe('rot');
      speicherSetzen(fake(Math.round(GB2 * 0.5)));
      expect(medienBefunde(await medienLage(), false).some(x => x.id === 'medien-voll')).toBe(false);
    } finally { speicherSetzen(null); }
  });
});

// ── Selbstprüfung ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Selbstprüfung: Medien — Einwilligungen und Freigaben (nur Zähler)', () => {
  const frei = (id: string, x: Partial<Medium> = {}) => md(id, { erkennbarePersonen: 'nein', marketing: { status: 'freigegeben', kanaele: ['website', 'social'], bis: '2026-12-31', freigegebenVon: 'p-a', verlauf: [] }, ...x });
  it('rein: trägt / trägt nicht / gesperrt / abgelaufen / Rohmaterial', async () => {
    const { medienPruefZahlenRein } = await import('@/lib/medien/datenschutz');
    const { medienPruefpunkt } = await import('@/lib/crm/datenschutz');
    const einw = [ew('ew-web', { zwecke: ['website'] }), ew('ew-weg', { zwecke: ['website', 'social'], widerruf: { am: J, von: 'p-a' } })];
    const person = (e: string) => [{ id: `pb-${e}`, art: 'kontakt' as const, kontaktId: 'c-1', rolle: 'haupt' as const, einwilligungId: e, markiertVon: 'p-a', am: J }];
    const k: MedienKatalog = { ...leererKatalog(), einwilligungen: einw, medien: [
      frei('md-gut'),
      frei('md-deckt-nicht', { erkennbarePersonen: 'ja', personen: person('ew-web') }),
      frei('md-widerruf', { erkennbarePersonen: 'ja', personen: person('ew-weg') }),
      frei('md-alt', { marketing: { status: 'freigegeben', kanaele: ['website'], bis: '2026-10-01', verlauf: [] } }),
      md('md-roh', { erkennbarePersonen: 'ja', hochgeladen: '2025-01-01T10:00:00.000Z' }),
      md('md-unklar', { erkennbarePersonen: 'unklar' }),
      md('md-papierkorb', { geloeschtAm: J }),
    ] };
    const z = medienPruefZahlenRein(k, lage({ einwilligungen: einw }), '2025-10-09');
    expect(z).toEqual({ medien: 6, freigegeben: 2, angefragt: 0, ohneDeckung: 1, gesperrtFreigegeben: 1, abgelaufen: 1, personenOffen: 1, roh: 1, einwilligungen: 2, widerrufen: 1 });
    const p = medienPruefpunkt(z);
    expect(p).toMatchObject({ id: 'medien', status: 'offen', weg: { href: expect.stringContaining('filter=freigegeben') } });
    expect(p.befund).not.toMatch(/md-|ew-|c-1|@/);
    expect(medienPruefpunkt({ ...z, ohneDeckung: 0 }).status).toBe('teilweise');
    expect(medienPruefpunkt({ ...z, ohneDeckung: 0, gesperrtFreigegeben: 0, abgelaufen: 0, roh: 0 }).status).toBe('erfuellt');
    // Am letzten Tag der Freigabe trägt sie noch (kein Fehlalarm „Datum in der Zukunft“).
    expect(medienPruefZahlenRein({ ...leererKatalog(), medien: [frei('md-heute', { marketing: { status: 'freigegeben', kanaele: ['website'], bis: '2026-10-09', verlauf: [] } })] }, lage(), '2025-10-09').ohneDeckung).toBe(0);
  });

  it('Prüfpunkt nur mit Medien; über das Umfeld der Instanz (Server)', async () => {
    const { selbstpruefung } = await import('@/lib/crm/datenschutz');
    const { EMPFAENGER_START } = await import('@/lib/datenschutz/einrichtung');
    const { datenschutzUmfeld } = await import('@/lib/datenschutz/umfeld');
    const crm = { antraege: [], verarbeitungen: [], mandate: [] } as unknown as Parameters<typeof selbstpruefung>[1];
    const basis = { verantwortlicher: { gesetzt: true, quelle: 'einrichtung' as const, luecken: [] }, empfaenger: EMPFAENGER_START, zweiterFaktor: { konten: 1, mit: 1 }, sicherung: null, agenten: { aktiv: 0, gesamt: 0 } };
    const ids = (medien: unknown) => selbstpruefung([], crm, '2026-10-09', { konten: 1, mitPasswort: 1 }, 24, { ...basis, medien } as never).map(p => p.id);
    expect(ids(undefined)).not.toContain('medien');
    expect(ids(null)).not.toContain('medien');
    expect(ids({ medien: 0, freigegeben: 0, angefragt: 0, ohneDeckung: 0, gesperrtFreigegeben: 0, abgelaufen: 0, personenOffen: 0, roh: 0, einwilligungen: 0, widerrufen: 0 })).not.toContain('medien');
    const u = await datenschutzUmfeld();
    expect(u.medien).toMatchObject({ medien: expect.any(Number), einwilligungen: 2 });
    expect(ids(u.medien)).toContain('medien');
  });
});

