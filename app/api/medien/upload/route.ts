// ─── Medien: Upload-Sitzung anlegen (09.10., Paket 5) ─────────────────────────────────────────────────────────────────────
// POST { id: <UUID vom Gerät>, typ, bytes, bereich, album?, name?, aufgenommen?, breite?, hoehe?, dauerSek?, drehung?, ortsdatenEntfernt,
// ton?, tonBestaetigt?, original?, erkennbarePersonen?, urheber?, abgeleitetVon? } → Sitzung (Stückgröße 8 MiB, fehlende Stücke).
// Idempotent je UUID und Person; Grenzen (Foto 50 MB, Video 2 GB) → 413; Typ nur Foto/Video → 415. Nur die Person selbst (Dienstweg 403).
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { MEDIEN_NUR_SELBST } from '@/lib/agenten/typen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { uploadAnlegen } from '@/lib/medien/upload-server';
import { antwort, fehler } from '@/lib/medien/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let a: Record<string, unknown>;
  try { a = await jsonBegrenzt(req, 64 * 1024); }
  catch (e) { return jsonZuGross(e) ?? fehler(400, 'Ungültige Anfrage.'); }
  if (!a || typeof a !== 'object' || Array.isArray(a)) return fehler(400, 'Ungültige Anfrage.');
  return antwort(await uploadAnlegen(z.person, a) as Parameters<typeof antwort>[0]);
}
