// ─── WhatsApp — ein Medium (Bild, Dokument, Audio) auf Klick (07.10.2026) ──────────────────────────────────────────────
// GET ?id=<WAMID> → die Bytes, IMMER als Download (`attachment`), nie als Seite — wie Mail-Anhänge (/api/inbox/anhang):
// `application/octet-stream`, `nosniff`, `Content-Security-Policy: sandbox`, kein Zwischenspeichern. Aus der verschlüsselten Ablage
// (lib/whatsapp/medien.ts); nur die Person selbst mit Zugang zur Business-Nummer (Dienstweg/andere Konten 403/404).
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { dateinameKopf } from '@/lib/gmail/antwort';
import { whatsappFuer } from '@/lib/whatsapp/server';
import { mediumOeffnen } from '@/lib/whatsapp/medien';
import { WA_ID } from '@/lib/whatsapp/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  if (!(await whatsappFuer(z.person))) return NextResponse.json({ ok: false, fehler: 'WhatsApp ist für dieses Konto nicht eingerichtet.' }, { status: 404 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!WA_ID.test(id)) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
  const m = await mediumOeffnen(id);
  if (!m) return NextResponse.json({ ok: false, fehler: 'Diese Datei liegt (noch) nicht vor — sie wird gerade geladen, ist zu groß oder ihre Frist ist abgelaufen.' }, { status: 404 });
  return new Response(new Uint8Array(m.bytes), { status: 200, headers: {
    'Content-Type': 'application/octet-stream', 'Content-Disposition': dateinameKopf(m.name), 'Content-Length': String(m.bytes.length),
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store',
  } });
}
