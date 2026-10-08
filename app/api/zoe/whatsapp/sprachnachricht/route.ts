// ─── ZOE auf WhatsApp — eine eigene Sprachnachricht anhören (08.10.2026) ────────────────────────────────────────────────
// GET ?id=sn-<uuid> → die Bytes aus der verschlüsselten Ablage (lib/zoe-whatsapp/medien.ts), IMMER als Download (`attachment`,
// `application/octet-stream`, `nosniff`, `sandbox`, kein Zwischenspeichern) — die Karte baut daraus eine Audio-Vorschau mit dem
// bekannten Typ. NUR die Person selbst (`eigenePerson`, Dienstweg 403); die Kennung wird nur in IHREM Kanal gesucht — eine fremde
// Kennung ist 404, nie die Datei einer anderen Person.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { dateinameKopf } from '@/lib/gmail/antwort';
import { sprachnachrichtOeffnen } from '@/lib/zoe-whatsapp/medien';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false, fehler: 'Sprachnachrichten an ZOE hört nur die Person selbst — angemeldet, nie über den Dienstweg.' } as const;

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const m = await sprachnachrichtOeffnen(z.person, id);
  if (!m) return NextResponse.json({ ok: false, fehler: 'Diese Sprachnachricht gibt es nicht (mehr).' }, { status: 404 });
  return new Response(new Uint8Array(m.bytes), { status: 200, headers: {
    'Content-Type': 'application/octet-stream', 'Content-Disposition': dateinameKopf(m.name), 'Content-Length': String(m.bytes.length),
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store',
  } });
}
