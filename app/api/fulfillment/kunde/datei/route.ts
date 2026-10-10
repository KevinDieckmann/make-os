// ─── Fulfillment — interne Unterlagen (C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4, 9) ──────────────────────────────────────────────────────────────────
// Tor `fulfillmentZugang` (Haushalt des Inhabers, Sicht Privat 403; schreiben nur per Sitzung + Bau-Kennung).
// POST   multipart: `datei` (eine) + `mandatId` + optional `zweck` — dieselbe Prüfung wie über den Kunden-Link (Typ am INHALT, Metadaten weg, ≤ 25 MB),
//        verschlüsselt im Ordner `fulfillment-unterlagen`, Status „ungeprüft“.
// GET    ?id=ud-…  → Download NUR als Anhang (`nosniff`, CSP `sandbox`, nie inline) — Lese-Protokoll „fulfillment“.
// DELETE ?id=ud-…  → entfernen (Eintrag + Datei) — nicht, wenn als Beleg übernommen (409).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { begrenztLesen } from '@/lib/dateien/begrenzt-lesen';
import { dateinameAscii } from '@/lib/dateien/regeln';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import { UPLOAD_GRENZEN, UMSCHLAG_BYTES } from '@/lib/fulfillment/kunde/upload';
import { dateiPruefen, unterlageAblegen, unterlageLesen, unterlageEntfernen, businessMandat } from '@/lib/fulfillment/kunde/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const d = await unterlageLesen(id);
  if (!d) return fehler('Diese Unterlage gibt es nicht (mehr).', 404);
  leseZugriff(req, 'fulfillment', { ids: [d.eintrag.mandatId], anzahl: 1 });
  return new Response(new Uint8Array(d.bytes), {
    headers: {
      // Nie inline: der Browser bekommt einen neutralen Typ und einen Anhang — Kunden-Dateien werden nie im Kontext von MAKE OS geöffnet.
      'Content-Type': 'application/octet-stream', 'Content-Length': String(d.bytes.length),
      'Content-Disposition': `attachment; filename="${dateinameAscii(d.eintrag.name)}"; filename*=UTF-8''${encodeURIComponent(d.eintrag.name)}`,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store, private',
    },
  });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  const art = req.headers.get('content-type') ?? '';
  if (!art.startsWith('multipart/form-data')) return fehler('Bitte als Datei-Upload (multipart) senden.', 415);
  const roh = await begrenztLesen(req, UPLOAD_GRENZEN.dateiBytes + UMSCHLAG_BYTES);
  if (!roh) return fehler(`Datei zu groß (höchstens ${UPLOAD_GRENZEN.dateiBytes / 1024 / 1024} MB).`, 413);
  let form: FormData;
  try { form = await new Response(new Uint8Array(roh), { headers: { 'content-type': art } }).formData(); } catch { return fehler('Upload nicht lesbar.', 400); }
  const mandatId = String(form.get('mandatId') ?? '');
  if (!MANDAT_ID.test(mandatId)) return fehler('mandatId fehlt.', 400);
  const { ladeCrm } = await import('@/lib/crm/speicher');
  if (!businessMandat(await ladeCrm(), mandatId)) return fehler('Dieses Mandat gibt es nicht (mehr) — oder es gehört nicht zum Business.', 404);
  const dateien = form.getAll('datei');
  if (dateien.length !== 1 || typeof dateien[0] === 'string') return fehler('Bitte genau eine Datei je Upload.', 400);
  const datei = dateien[0] as File;
  const p = dateiPruefen(datei.name, Buffer.from(await datei.arrayBuffer()));
  if (!p.ok) return fehler(p.fehler, p.status);
  const zweck = form.get('zweck');
  const r = await unterlageAblegen({ mandatId, name: p.name, typ: p.typ, bytes: p.bytes, herkunft: 'intern', von: z.person, zweck: zweck === 'register' || zweck === 'playbook' || zweck === 'notiz' ? zweck : 'sonstig' });
  return NextResponse.json(r.body, { status: r.status });
}

export async function DELETE(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  const r = await unterlageEntfernen(new URL(req.url).searchParams.get('id') ?? '', z.person);
  return NextResponse.json(r.body, { status: r.status });
}
