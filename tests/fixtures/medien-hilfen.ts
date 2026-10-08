// ─── Hilfen für die Medien-Tests (09.10., Paket 5) — erfundene Konten, kleine Test-Bilder, Hochladen über die echten Routen ─────
// Der Datenordner, MAKE_OS_KEY und der Medien-Ordner setzt jede Testdatei selbst (vi.hoisted) — hier nur Werkzeuge.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { GRENZEN, teileVon, teilLaenge } from '@/lib/medien/typen';

export const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });

/** Inhaber + volles Mitglied + „nur Business“ im Haushalt, dazu ein fremder Haushalt und ein Konto ohne Haushalt. */
export const KONTEN = {
  konten: [
    konto('k1', 'person-a', 'inhaber', { haushalt: 'haus-a' }),
    konto('k2', 'person-b', 'mitglied', { haushalt: 'haus-a' }),
    konto('k3', 'partner', 'mitglied', { haushalt: 'haus-a', finanzRecht: 'business' }),
    konto('k4', 'gast', 'mitglied', { haushalt: 'haus-fremd' }),
    konto('k5', 'kunde', 'mitglied'),
  ],
  einladungen: [],
};

/** Ein gültiges JPEG beliebiger Länge (SOI, JFIF, SOS, Zufallsdaten, EOI); `exif` legt ein APP1 mit Ort davor. */
export function jpeg(laenge = 4000, o: { exif?: boolean } = {}): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const gps = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x40]), Buffer.from('Exif\0\0', 'binary'), Buffer.alloc(56, 0x47)]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]);
  const kopf = Buffer.concat([soi, ...(o.exif ? [gps] : []), app0, sos]);
  return Buffer.concat([kopf, randomBytes(Math.max(1, laenge - kopf.length - 2)), Buffer.from([0xff, 0xd9])]);
}

/** Ein kleines PNG (Signatur, IHDR, IDAT, IEND — Längen stimmen, Prüfsummen sind egal). */
export function png(): Buffer {
  const chunk = (typ: string, daten: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(daten.length); return Buffer.concat([l, Buffer.from(typ, 'ascii'), daten, Buffer.alloc(4)]); };
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13, 1)), chunk('IDAT', randomBytes(30)), chunk('IEND', Buffer.alloc(0))]);
}

export const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
export const pruefsumme = (hashes: string[]) => createHash('sha256').update(Buffer.concat(hashes.map(h => Buffer.from(h, 'hex')))).digest('hex');

type Handler = (r: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;
export type Modul = Record<string, Handler>;

export interface Antwort { status: number; json: Record<string, unknown>; text: string; kopf: Headers; bytes: Buffer }

export async function rufe(modul: Modul, methode: string, url: string, person: string | null, o: { json?: unknown; roh?: Buffer; kopf?: Record<string, string>; params?: Record<string, string>; dienst?: boolean } = {}): Promise<Antwort> {
  const kopf: Record<string, string> = { ...(o.json !== undefined ? { 'content-type': 'application/json' } : {}), ...(person ? { 'x-make-user': person } : {}), ...(o.dienst ? { 'x-make-key': process.env.MAKE_OS_KEY! } : {}), ...(o.kopf ?? {}) };
  const body = o.json !== undefined ? JSON.stringify(o.json) : o.roh ? new Uint8Array(o.roh) : undefined;
  const r = await modul[methode](new Request(`http://test${url}`, { method: methode, headers: kopf, ...(body !== undefined ? { body } : {}) }), { params: Promise.resolve(o.params ?? {}) });
  const bytes = Buffer.from(await r.arrayBuffer());
  const text = bytes.toString('utf8');
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { /* kein JSON */ }
  return { status: r.status, json, text, kopf: r.headers, bytes };
}

export interface Routen { liste: Modul; upload: Modul; sitzung: Modul; inhalt: Modul; beleg: Modul }
export async function routen(): Promise<Routen> {
  return {
    liste: await import('@/app/api/medien/route') as unknown as Modul,
    upload: await import('@/app/api/medien/upload/route') as unknown as Modul,
    sitzung: await import('@/app/api/medien/upload/[id]/route') as unknown as Modul,
    inhalt: await import('@/app/api/medien/inhalt/route') as unknown as Modul,
    beleg: await import('@/app/api/medien/beleg/route') as unknown as Modul,
  };
}

/** Ein Medium ganz hochladen (anlegen → Vorschau → Stücke → fertig) — liefert die Sicht und die Klartext-Bytes. */
export async function hochladen(r: Routen, person: string, o: { bytes?: Buffer; typ?: string; bereich?: 'business' | 'privat'; album?: string; anlegen?: Record<string, unknown> } = {}): Promise<{ medium: Record<string, unknown>; klar: Buffer; uuid: string }> {
  const klar = o.bytes ?? jpeg(5000);
  const uuid = randomUUID();
  const a = await rufe(r.upload, 'POST', '/api/medien/upload', person, { json: { id: uuid, typ: o.typ ?? 'image/jpeg', bytes: klar.length, bereich: o.bereich ?? 'business', ...(o.album ? { album: o.album } : {}), ortsdatenEntfernt: true, ...(o.anlegen ?? {}) } });
  if (a.status !== 200) throw new Error(`anlegen ${a.status}: ${a.text}`);
  const id = `up-${uuid}`;
  const v = await rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?variante=raster`, person, { roh: jpeg(800), params: { id } });
  if (v.status !== 200) throw new Error(`vorschau ${v.status}: ${v.text}`);
  const hashes: string[] = [];
  for (let nr = 0; nr < teileVon(klar.length); nr++) {
    const b = klar.subarray(nr * GRENZEN.teil, nr * GRENZEN.teil + teilLaenge(klar.length, nr));
    hashes.push(sha(b));
    const t = await rufe(r.sitzung, 'PUT', `/api/medien/upload/${id}?teil=${nr}`, person, { roh: Buffer.from(b), kopf: { 'x-make-sha256': sha(b) }, params: { id } });
    if (t.status !== 200) throw new Error(`teil ${nr} ${t.status}: ${t.text}`);
  }
  const f = await rufe(r.sitzung, 'POST', `/api/medien/upload/${id}`, person, { json: { pruefsumme: pruefsumme(hashes) }, params: { id } });
  if (f.status !== 200) throw new Error(`fertig ${f.status}: ${f.text}`);
  return { medium: f.json.medium as Record<string, unknown>, klar, uuid };
}
