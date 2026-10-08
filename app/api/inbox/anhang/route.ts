// ─── Inbox 2 — Anhang einer IMAP-Mail auf Klick (06.10.2026) ────────────────────────────────────────────────────
// GET ?nachricht=<pf-…:e:UIDVALIDITY:UID>&teil=<1.2> → die Bytes, IMMER als Download (`attachment`), nie als Seite — wie bei Gmail
// (/api/gmail/anhang): `application/octet-stream`, `nosniff`, `Content-Security-Policy: sandbox`, kein Zwischenspeichern, ≤ 25 MB.
// Nur aus dem EIGENEN Spiegel, nur mit Sitzung (Dienstweg/andere Konten 403). Der Inhalt kommt jedes Mal frisch vom Anbieter.
// Team-Postfach (08.10.): sieht die Person das Postfach (`postfachAufloesen` → `postfachSichtbar`), holt der Server den Anhang über den
// Zugang des Besitzers — sonst 404 wie bei einer Mail, die es nicht gibt. Übergaben haben keinen Weg hierher (Anhänge nur als Liste).
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { imapAnhang } from '@/lib/postfach/aktion';
import { IMAP_ID } from '@/lib/postfach/spiegel';
import { PostfachFehler } from '@/lib/postfach/transport';
import { dateinameKopf } from '@/lib/gmail/antwort';
import { postfachAufloesen } from '@/lib/inbox/teilen-server';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('nachricht') ?? '', teil = q.get('teil') ?? '';
  if (!IMAP_ID.test(id) || !/^[0-9]{1,3}(\.[0-9]{1,3}){0,8}$/.test(teil)) return NextResponse.json({ ok: false, fehler: 'nachricht und teil fehlen.' }, { status: 400 });
  const pf = await postfachAufloesen(z.person, id.split(':')[0]);
  if (!pf) return NextResponse.json({ ok: false, fehler: 'Diesen Anhang gibt es nicht.' }, { status: 404 });
  if (pf.besitzer !== z.person) leseZugriff(req, 'inbox', { betroffen: pf.besitzer, anzahl: 1 });
  try {
    const a = await imapAnhang(pf.besitzer, id, teil);
    return new Response(new Uint8Array(a.bytes), { status: 200, headers: {
      'Content-Type': 'application/octet-stream', 'Content-Disposition': dateinameKopf(a.name), 'Content-Length': String(a.bytes.length),
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store',
    } });
  } catch (e) {
    if (e instanceof PostfachFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status >= 400 && e.status < 600 ? e.status : 502 });
    return NextResponse.json({ ok: false, fehler: 'Der Anhang ließ sich nicht holen.' }, { status: 502 });
  }
}
