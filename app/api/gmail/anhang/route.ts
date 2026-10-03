// ─── Gmail — Anhang auf Klick (03.10.2026) ───────────────────────────────────
// GET ?id=<Nachrichten-Kennung>&teil=<Teil-Kennung> → die Bytes, IMMER als Download (`attachment`), nie als Seite:
//   · Content-Type `application/octet-stream` (kein HTML/SVG/PDF im Browser ausführen), `X-Content-Type-Options: nosniff`,
//     `Content-Security-Policy: sandbox`, kein Zwischenspeichern
//   · nur aus der EIGENEN Mail (Spiegel der Person), nur mit Sitzung (Dienstweg/andere Konten 403), Größe ≤ 25 MB (sonst 413)
// Der Inhalt liegt nie im Spiegel — er kommt jedes Mal frisch aus Gmail.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { gmailAnhang, AktionFehler } from '@/lib/gmail/aktion';
import { gmailFehlerAntwort, dateinameKopf } from '@/lib/gmail/antwort';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '', teil = q.get('teil') ?? '';
  if (!/^[A-Za-z0-9]{6,40}$/.test(id) || !/^[0-9.]{1,40}$/.test(teil)) return NextResponse.json({ ok: false, fehler: 'id und teil fehlen.' }, { status: 400 });
  try {
    const a = await gmailAnhang(z.person, id, teil);
    return new Response(new Uint8Array(a.bytes), { status: 200, headers: {
      'Content-Type': 'application/octet-stream', 'Content-Disposition': dateinameKopf(a.name), 'Content-Length': String(a.bytes.length),
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store',
    } });
  } catch (e) {
    if (e instanceof AktionFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
    return gmailFehlerAntwort(e);
  }
}
