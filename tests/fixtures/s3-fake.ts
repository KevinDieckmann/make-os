// ─── S3-Fake für die Medien-Tests (09.10., Paket 5) — kein Netz ──────────────────────────────────────────────────────────
// Versteht genau die Aufrufe des Speicher-Adapters (lib/medien/speicher-s3.ts): CreateMultipartUpload, UploadPart, Complete,
// Abort, PutObject, GetObject (mit Range), DeleteObject — und auf Bucket-Ebene ListObjectsV2 und ListMultipartUploads (09.10., Nachzug;
// seitenweise, `seite` legt die Seitengröße fest, damit das Weiterblättern getestet wird). Prüft die Form der Signatur (Credential, SignedHeaders), dass
// `x-amz-content-sha256` zum Körper passt und dass nie ein Klartext-Kopf (Content-MD5, SSE-C, Metadaten) mitgeht. Fehler lassen
// sich einspielen (`fehlerBei`), damit Wiederholung und Abbruch getestet werden.
import { createHash } from 'node:crypto';

export interface S3Aufruf { methode: string; pfad: string; abfrage: Record<string, string>; bytes: number }

export function s3Fake(o: { bucket?: string; seite?: number } = {}) {
  const bucket = o.bucket ?? 'medien-test';
  const seite = o.seite ?? 1000;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const objekte = new Map<string, Buffer>();
  const uploads = new Map<string, { objekt: string; teile: Map<number, { bytes: Buffer; etag: string }> }>();
  const aufrufe: S3Aufruf[] = [];
  const fehler: { wann: (a: S3Aufruf) => boolean; status: number; einmal: boolean }[] = [];
  let nr = 0;
  const xml = (status: number, body: string, kopf: Record<string, string> = {}) => new Response(body, { status, headers: { 'content-type': 'application/xml', ...kopf } });

  const holen = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const methode = (init?.method ?? 'GET').toUpperCase();
    const kopf = new Headers(init?.headers);
    const body = init?.body ? Buffer.from(init.body as Uint8Array) : Buffer.alloc(0);
    const teile = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (teile[0] !== bucket) return xml(404, '<Error><Code>NoSuchBucket</Code></Error>');
    const objekt = teile.slice(1).join('/');
    const abfrage = Object.fromEntries(url.searchParams.entries());
    const a: S3Aufruf = { methode, pfad: objekt, abfrage, bytes: body.length };
    aufrufe.push(a);
    const auth = kopf.get('authorization') ?? '';
    if (!/^AWS4-HMAC-SHA256 Credential=[^/]+\/\d{8}\/[a-z0-9-]+\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]*host[a-z0-9;-]*x-amz-content-sha256;x-amz-date[a-z0-9;-]*, Signature=[0-9a-f]{64}$/.test(auth)) return xml(403, '<Error><Code>SignatureDoesNotMatch</Code></Error>');
    if (kopf.get('x-amz-content-sha256') !== createHash('sha256').update(body).digest('hex')) return xml(400, '<Error><Code>XAmzContentSHA256Mismatch</Code></Error>');
    if ([...kopf.keys()].some(k => k.startsWith('x-amz-server-side-encryption') || k.startsWith('x-amz-meta-'))) return xml(400, '<Error><Code>Unerwartet</Code></Error>');
    const f = fehler.findIndex(x => x.wann(a));
    if (f >= 0) { const s = fehler[f].status; if (fehler[f].einmal) fehler.splice(f, 1); return xml(s, `<Error><Code>Eingespielt${s}</Code></Error>`); }

    // Bucket-Ebene: ListObjectsV2 (Token = Index der nächsten Seite) und ListMultipartUploads (Marker = letzter Schlüssel + Kennung).
    if (methode === 'GET' && !objekt && abfrage['list-type'] === '2') {
      const p = abfrage.prefix ?? '';
      const alle = [...objekte.keys()].filter(x => x.startsWith(p)).sort();
      const ab = abfrage['continuation-token'] ? Number(abfrage['continuation-token'].replace('t-', '')) : 0;
      const max = Math.min(seite, Number(abfrage['max-keys'] ?? 1000));
      const stueck = alle.slice(ab, ab + max);
      const weiter = ab + max < alle.length;
      return xml(200, `<ListBucketResult><Name>${bucket}</Name><Prefix>${esc(p)}</Prefix><KeyCount>${stueck.length}</KeyCount>${stueck.map(x => `<Contents><Key>${esc(x)}</Key><Size>${objekte.get(x)!.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`).join('')}<IsTruncated>${weiter}</IsTruncated>${weiter ? `<NextContinuationToken>t-${ab + max}</NextContinuationToken>` : ''}</ListBucketResult>`);
    }
    if (methode === 'GET' && !objekt && 'uploads' in abfrage) {
      const p = abfrage.prefix ?? '';
      const alle = [...uploads.entries()].filter(([, u]) => u.objekt.startsWith(p)).map(([id, u]) => ({ id, key: u.objekt })).sort((a, b) => (a.key + a.id).localeCompare(b.key + b.id));
      const marke = abfrage['key-marker'] ? `${abfrage['key-marker']}${abfrage['upload-id-marker'] ?? ''}` : '';
      const rest = marke ? alle.filter(x => x.key + x.id > marke) : alle;
      const stueck = rest.slice(0, seite);
      const weiter = rest.length > seite;
      const letzte = stueck[stueck.length - 1];
      return xml(200, `<ListMultipartUploadsResult><Bucket>${bucket}</Bucket>${stueck.map(x => `<Upload><Key>${esc(x.key)}</Key><UploadId>${x.id}</UploadId></Upload>`).join('')}<IsTruncated>${weiter}</IsTruncated>${weiter && letzte ? `<NextKeyMarker>${esc(letzte.key)}</NextKeyMarker><NextUploadIdMarker>${letzte.id}</NextUploadIdMarker>` : ''}</ListMultipartUploadsResult>`);
    }
    if (methode === 'POST' && 'uploads' in abfrage) {
      const id = `fake-upload-${++nr}`;
      uploads.set(id, { objekt, teile: new Map() });
      return xml(200, `<InitiateMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${objekt}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    }
    if (methode === 'PUT' && abfrage.uploadId) {
      const u = uploads.get(abfrage.uploadId);
      if (!u || u.objekt !== objekt) return xml(404, '<Error><Code>NoSuchUpload</Code></Error>');
      const etag = `"${createHash('md5').update(body).digest('hex')}"`;
      u.teile.set(Number(abfrage.partNumber), { bytes: body, etag });
      return new Response(null, { status: 200, headers: { etag } });
    }
    if (methode === 'POST' && abfrage.uploadId) {
      const u = uploads.get(abfrage.uploadId);
      if (!u || u.objekt !== objekt) return xml(404, '<Error><Code>NoSuchUpload</Code></Error>');
      const liste = [...body.toString('utf8').matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>([^<]+)<\/ETag>/g)].map(m => ({ n: Number(m[1]), etag: m[2].replace(/&quot;/g, '"') }));
      const stuecke: Buffer[] = [];
      for (const [i, t] of liste.entries()) {
        const da = u.teile.get(t.n);
        if (!da || da.etag !== t.etag) return xml(400, '<Error><Code>InvalidPart</Code></Error>');
        if (i < liste.length - 1 && da.bytes.length < 5 * 1024 * 1024) return xml(400, '<Error><Code>EntityTooSmall</Code></Error>');
        stuecke.push(da.bytes);
      }
      objekte.set(objekt, Buffer.concat(stuecke));
      uploads.delete(abfrage.uploadId);
      return xml(200, `<CompleteMultipartUploadResult><Key>${objekt}</Key></CompleteMultipartUploadResult>`);
    }
    if (methode === 'DELETE' && abfrage.uploadId) { uploads.delete(abfrage.uploadId); return new Response(null, { status: 204 }); }
    if (methode === 'PUT') { objekte.set(objekt, body); return new Response(null, { status: 200, headers: { etag: '"x"' } }); }
    if (methode === 'GET') {
      const b = objekte.get(objekt);
      if (!b) return xml(404, '<Error><Code>NoSuchKey</Code></Error>');
      const r = /^bytes=(\d+)-(\d+)$/.exec(kopf.get('range') ?? '');
      if (r) { const von = Number(r[1]), bis = Math.min(Number(r[2]), b.length - 1); return new Response(new Uint8Array(b.subarray(von, bis + 1)), { status: 206, headers: { 'content-range': `bytes ${von}-${bis}/${b.length}` } }); }
      return new Response(new Uint8Array(b), { status: 200 });
    }
    if (methode === 'DELETE') { objekte.delete(objekt); return new Response(null, { status: 204 }); }
    return xml(405, '<Error><Code>MethodNotAllowed</Code></Error>');
  };
  return {
    holen: holen as unknown as typeof fetch, objekte, uploads, aufrufe,
    fehlerBei: (wann: (a: S3Aufruf) => boolean, status = 500, einmal = true) => { fehler.push({ wann, status, einmal }); },
  };
}
