// ─── Inbox teilen — „In der Inbox suchen“ (08.10.2026, Lücke 6) ─────────────────────────────────────────────────────
// GET ?q=<Suchbegriff>&bereich=<id>|space=privat|business&ab=<n>
//   → { ok, treffer[{ art, id, quelle, bereich, betreff, name, gegenueber, am, wo, ausschnitt, anzahl, von? }], gesamt, ab, seite }
// Gesucht wird nur in dem, was die Person sieht (lib/inbox/suche-server.ts): eigene Spiegel, sichtbare Team-Postfächer, WhatsApp mit
// Zugang, Übergaben an bzw. von ihr — mit demselben Bereichsfilter wie der Strom. Höchstens eine Seite je Antwort, dazu `gesamt`
// („mehr …“ = nächste Seite über `ab`), nie still gekürzt. Der Suchbegriff steht NIE in einem Protokoll: das Lese-Protokoll notiert
// nur Bereich „inbox“ und die Zahl der Treffer (Pfad ohne Abfrage). Nur die eigene Person aus der Sitzung (Dienstweg 403).
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { inboxSuchen } from '@/lib/inbox/suche-server';
import { frageSauber, TeilenFehler } from '@/lib/inbox/teilen';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BEREICH = /^(privat|kdc|kdv|ug|g-[a-z0-9][a-z0-9-]{3,62})$/;

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const bereich = q.get('bereich');
  const space = q.get('space');
  if ((bereich && !BEREICH.test(bereich)) || (space && space !== 'privat' && space !== 'business')) return NextResponse.json({ ok: false, fehler: 'bereich bzw. space ist ungültig.' }, { status: 400 });
  const ab = Number(q.get('ab') ?? 0);
  if (!Number.isInteger(ab) || ab < 0 || ab > 100_000) return NextResponse.json({ ok: false, fehler: 'ab ist ungültig.' }, { status: 400 });
  let frage: string | null;
  try { frage = frageSauber(q.get('q')); } catch (e) { return NextResponse.json({ ok: false, fehler: e instanceof TeilenFehler ? e.message : 'Suchbegriff ungültig.' }, { status: 400 }); }
  if (!frage) return NextResponse.json({ ok: true, treffer: [], gesamt: 0, ab: 0, seite: 0, hinweis: 'Bitte mindestens zwei Zeichen eingeben.' }, { headers: { 'Cache-Control': 'no-store' } });
  const f = { ...(bereich ? { bereich } : {}), ...(space ? { space: space as 'privat' | 'business' } : {}) };
  const r = await inboxSuchen(z.person, frage, f, ab);
  leseZugriff(req, 'inbox', { anzahl: r.gesamt });
  return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
}
