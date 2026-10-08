// ─── Inbox 2 — ein Gespräch öffnen (06.10.2026) ─────────────────────────────────────────────────────────────────
// GET ?id=<Gespräch>            → { ok, gespraech, nachrichten[{…, text}], antwort, kontext, vorschlaege }
// GET ?gmail=<Nachricht>        → { ok, id } (Link `?offen=gmail-<Nachricht>` aus dem Verlauf der Kontaktakte → das Gespräch)
// Nur aus den EIGENEN Spiegeln; der Text ist reiner Text (nie HTML). Öffnen markiert NICHT von selbst als gelesen — das tut die
// Oberfläche mit einem eigenen Aufruf (POST /api/inbox { aktion: 'gelesen' }), damit ein Abruf nie etwas ändert.
// Dienstweg und andere Konten: 403. Team-Postfach einer ANDEREN Person (08.10.): sichtbar nur über `postfachSichtbar`; das Lesen steht im
// Lese-Protokoll (Bereich „inbox“, wessen Postfach, Anzahl — nie Inhalt).
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { gespraechLesen, gespraechZuGmailNachricht } from '@/lib/inbox/gespraech-server';
import { istGespraechId } from '@/lib/inbox/strom';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const gmail = q.get('gmail');
  if (gmail !== null) {
    if (!/^[A-Za-z0-9]{6,40}$/.test(gmail)) return NextResponse.json({ ok: false, fehler: 'gmail fehlt.' }, { status: 400 });
    const id = await gespraechZuGmailNachricht(z.person, gmail);
    return id ? NextResponse.json({ ok: true, id }) : NextResponse.json({ ok: false, fehler: 'Diese Mail gibt es nicht (mehr).' }, { status: 404 });
  }
  const id = q.get('id') ?? '';
  if (!istGespraechId(id)) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
  const a = await gespraechLesen(z.person, id);
  if (!a) return NextResponse.json({ ok: false, fehler: 'Dieses Gespräch gibt es nicht (mehr).' }, { status: 404 });
  const tp = a.gespraech.team?.postfach;
  if (tp && !tp.eigenes) leseZugriff(req, 'inbox', { betroffen: tp.besitzer, anzahl: a.nachrichten.length });
  const { nachrichten: _n, ...g } = a.gespraech;
  return NextResponse.json({ ok: true, ...a, gespraech: g }, { headers: { 'Cache-Control': 'no-store' } });
}
