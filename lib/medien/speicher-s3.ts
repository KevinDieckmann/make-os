// ─── Medienspeicher „S3“ — Hetzner Object Storage (09.10., Paket 5) ───────────────────────────────────────────────────────────
// Sieben Aufrufe, selbst signiert: CreateMultipartUpload, UploadPart, CompleteMultipartUpload, AbortMultipartUpload, PutObject,
// GetObject (mit Range), DeleteObject — dazu (09.10., Nachzug Instanz-Export/-Löschen) zwei Listen auf Bucket-Ebene nur unter dem Präfix der
// Instanz: ListObjectsV2 und ListMultipartUploads. Signatur, Aufruf, Löschen, Abbrechen und die Listen kommen aus EINER Grundlage
// (lib/medien/s3-kern.mjs `s3Basis`), die auch das Löschskript nimmt. Grenzen laut Hetzner-Doku (research/agenten/MEDIEN.md B4):
// Teile 5 MiB–5 GB, höchstens 10.000 Teile — ein Stück = 8 MiB Klartext + 2 KiB Prüfwerte (+ 16 Byte Kopf beim ersten).
// Der Bucket bleibt privat; Zugangsdaten nur hier und nur an den Endpunkt. Fehler tragen nur Status und S3-Code, nie Schlüssel.
// Getestet gegen einen S3-Fake ohne Netz (tests/fixtures/s3-fake.ts).

import { s3Basis, xmlWert } from './s3-kern.mjs';
import { SpeicherFehler, type MedienSpeicher, type S3Konfig } from './speicher';

type Holen = typeof fetch;

const xmlText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function s3Speicher(k: S3Konfig, holen: Holen = (...a) => fetch(...a)): MedienSpeicher {
  const { rufe, loeschen, abbrechen, auflisten, offeneUploads } = s3Basis(k, holen, (text, status, code) => new SpeicherFehler(text, status, code));

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
    abbrechen,
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
    loeschen,
    auflisten,
    offeneUploads,
  };
}
