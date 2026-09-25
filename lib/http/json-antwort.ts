// ─── Große JSON-Antworten: gepackt und nur, wenn sich etwas geändert hat ────
// 25.09., Kevin: „die Ladegeschwindigkeit ist nicht wirklich gut“. Kontakte
// (750 KB) und CRM-Bestand (270 KB) gingen ungepackt über die Leitung — und
// der Abgleich holte beide alle 20 Sekunden neu, auch wenn sich nichts
// geändert hatte. Das sind am Handy über Tailscale rund 3 MB pro Minute.
// Jetzt:
//   · ETag aus dem Stand der Speicher (lib/store/local-db.ts speicherStand):
//     schickt der Browser ihn als If-None-Match mit und nichts hat sich
//     geändert, kommt 304 ohne Inhalt.
//   · Ab 16 KB gzip, wenn der Browser es annimmt (Next packt Antworten von
//     Routen nicht von selbst).

import { gzipSync } from 'node:zlib';

const AB_BYTES = 16 * 1024;

/** ETag aus Speicherstand und allem, was die Antwort sonst bestimmt (Person, Tag). */
export const etagAus = (...teile: string[]) => `"${teile.join('|').replace(/"/g, '')}"`;

const KOPF = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-cache', Vary: 'Accept-Encoding' };

/** 304, wenn der Browser genau diesen Stand schon hat — vor dem Laden prüfen, dann spart es auch das Rechnen. */
export function unveraendert(req: Request, etag: string): Response | null {
  return req.headers.get('if-none-match') === etag ? new Response(null, { status: 304, headers: { ...KOPF, ETag: etag } }) : null;
}

export function jsonAntwort(req: Request, daten: unknown, etag?: string): Response {
  const kopf: Record<string, string> = { ...KOPF, ...(etag ? { ETag: etag } : {}) };
  const text = JSON.stringify(daten);
  if (text.length >= AB_BYTES && /\bgzip\b/.test(req.headers.get('accept-encoding') ?? '')) {
    return new Response(gzipSync(text, { level: 6 }), { status: 200, headers: { ...kopf, 'Content-Encoding': 'gzip' } });
  }
  return new Response(text, { status: 200, headers: kopf });
}
