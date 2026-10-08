// ─── Medienspeicher „S3“ — Hetzner Object Storage (09.10., Paket 5) ───────────────────────────────────────────────────────────
// Sieben Aufrufe, selbst signiert (lib/medien/s3-signatur.ts): CreateMultipartUpload, UploadPart, CompleteMultipartUpload,
// AbortMultipartUpload, PutObject, GetObject (mit Range), DeleteObject. Grenzen laut Hetzner-Doku (research/agenten/MEDIEN.md B4):
// Teile 5 MiB–5 GB, höchstens 10.000 Teile — ein Stück = 8 MiB Klartext + 2 KiB Prüfwerte (+ 16 Byte Kopf beim ersten).
// Der Bucket bleibt privat; Zugangsdaten nur hier und nur an den Endpunkt. Fehler tragen nur Status und S3-Code, nie Schlüssel.
// Getestet gegen einen S3-Fake ohne Netz (tests/fixtures/s3-fake.ts).

import { createHash } from 'node:crypto';
import { awsKodieren, signiere, LEERER_HASH } from './s3-signatur';
import { objektOk, SpeicherFehler, type MedienSpeicher, type S3Konfig } from './speicher';

type Holen = typeof fetch;
const ZEIT_MS = 120_000;

const xmlWert = (xml: string, tag: string): string | null => {
  const m = new RegExp(`<${tag}>([^<]{0,2048})</${tag}>`).exec(xml);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
};
const xmlText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function s3Speicher(k: S3Konfig, holen: Holen = (...a) => fetch(...a)): MedienSpeicher {
  const basis = new URL(k.endpunkt);
  const host = k.stil === 'host' ? `${k.bucket}.${basis.host}` : basis.host;
  const pfadVon = (objekt: string) => {
    if (!objektOk(objekt)) throw new SpeicherFehler('Unzulässiger Objekt-Name.', 400);
    return k.stil === 'host' ? `/${awsKodieren(objekt, true)}` : `/${awsKodieren(k.bucket)}/${awsKodieren(objekt, true)}`;
  };

  async function rufe(methode: string, objekt: string, o: { abfrage?: Record<string, string>; koerper?: Buffer; kopf?: Record<string, string>; ok?: number[] } = {}): Promise<Response> {
    const pfad = pfadVon(objekt);
    const abfrage = o.abfrage ?? {};
    const koerper = o.koerper;
    const nutzlast = koerper ? createHash('sha256').update(koerper).digest('hex') : LEERER_HASH;
    const signiert = signiere({ methode, host, pfad, abfrage, kopf: o.kopf, nutzlast, zugang: k.zugang, geheimnis: k.geheimnis, region: k.region, jetzt: new Date() });
    const q = Object.keys(abfrage).sort().map(x => `${awsKodieren(x)}=${awsKodieren(abfrage[x])}`).join('&');
    const url = `${basis.protocol}//${host}${pfad}${q ? `?${q}` : ''}`;
    const ctrl = new AbortController();
    const uhr = setTimeout(() => ctrl.abort(), ZEIT_MS);
    let r: Response;
    try {
      r = await holen(url, {
        method: methode, signal: ctrl.signal, redirect: 'error',
        headers: { ...signiert, ...(o.kopf ?? {}), ...(koerper ? { 'content-type': 'application/octet-stream' } : {}) },
        ...(koerper ? { body: new Uint8Array(koerper.buffer, koerper.byteOffset, koerper.byteLength) as unknown as BodyInit } : {}),
      });
    } catch (e) {
      throw new SpeicherFehler(`Medienspeicher nicht erreichbar (${e instanceof Error && e.name === 'AbortError' ? 'Zeitüberschreitung' : 'Netz'}).`, 503);
    } finally { clearTimeout(uhr); }
    if ((o.ok ?? [200]).includes(r.status)) return r;
    const text = await r.text().catch(() => '');
    const code = xmlWert(text, 'Code') ?? undefined;
    throw new SpeicherFehler(`Medienspeicher antwortet ${r.status}${code ? ` (${code})` : ''}.`, r.status >= 500 || r.status === 429 ? 503 : 502, code);
  }

  return {
    modus: 's3',
    async beginnen(objekt) {
      const r = await rufe('POST', objekt, { abfrage: { uploads: '' } });
      const id = xmlWert(await r.text(), 'UploadId');
      if (!id) throw new SpeicherFehler('Medienspeicher: keine Upload-Kennung erhalten.', 502);
      return id;
    },
    async teil(objekt, upload, nr, bytes) {
      const r = await rufe('PUT', objekt, { abfrage: { partNumber: String(nr + 1), uploadId: upload }, koerper: bytes });
      const etag = r.headers.get('etag');
      if (!etag) throw new SpeicherFehler('Medienspeicher: Stück ohne ETag.', 502);
      return etag;
    },
    async abschliessen(objekt, upload, teile) {
      const xml = `<CompleteMultipartUpload>${[...teile].sort((a, b) => a.nr - b.nr).map(t => `<Part><PartNumber>${t.nr + 1}</PartNumber><ETag>${xmlText(t.etag)}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
      const r = await rufe('POST', objekt, { abfrage: { uploadId: upload }, koerper: Buffer.from(xml, 'utf8') });
      // S3 kann mit 200 antworten und den Fehler im Körper tragen.
      const text = await r.text().catch(() => '');
      if (/<Error>/.test(text)) throw new SpeicherFehler(`Medienspeicher: Zusammenfügen gescheitert (${xmlWert(text, 'Code') ?? 'Fehler'}).`, 502, xmlWert(text, 'Code') ?? undefined);
    },
    async abbrechen(objekt, upload) {
      await rufe('DELETE', objekt, { abfrage: { uploadId: upload }, ok: [200, 204, 404] });
    },
    async schreiben(objekt, bytes) {
      await rufe('PUT', objekt, { koerper: bytes });
    },
    async lesen(objekt, bereich) {
      const r = await rufe('GET', objekt, { ...(bereich ? { kopf: { range: `bytes=${bereich.von}-${bereich.bis}` } } : {}), ok: [200, 206, 404] });
      if (r.status === 404) return null;
      const b = Buffer.from(await r.arrayBuffer());
      // Ein Speicher, der Range nicht kann, schickt alles (200) — dann selbst schneiden.
      return bereich && r.status === 200 ? b.subarray(bereich.von, bereich.bis + 1) : b;
    },
    async loeschen(objekt) {
      await rufe('DELETE', objekt, { ok: [200, 204, 404] });
    },
  };
}
