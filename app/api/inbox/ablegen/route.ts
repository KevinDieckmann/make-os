// ─── Inbox — Anhang (oder die Mail als Text) aus einem Gespräch ablegen, NUR per Klick der Person (09.10.2026) ──────────
// POST { gespraech, nachricht, teil, ziel, bereichWechsel?, anfrageId? }
//   ziel = { art: 'crm', kontaktId?, firmaId?, dealId?, dateiArt?, titel? }   → CRM-Ablage (Firma/Kontakt/Deal)
//        | { art: 'projekt', projektId, aufgabeId? }                          → Projekt-Dateien (Projekt bzw. Aufgabe)
//   teil = Teil-Kennung des Anhangs („1.2“, WhatsApp „wa“) oder `mail` (die Nachricht als Textdatei, nur Projekt)
// → { ok, eintrag: { id, name }, ziel, text } · 409 { code: 'bereich' | 'bezug' | 'eingeschraenkt' } · 413 · 415 { code: 'typ' }
// Die Bytes holt der Server aus dem EIGENEN Spiegel (lib/inbox/ablegen-server.ts) — der Browser schickt nur Kennungen. Dienstweg 403
// (eigenePerson), Bau-Kennung geprüft, `anfrageId` macht einen Netz-Retry wirkungslos (einmalig, nur dieselbe Person).
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ablageEingabe, ausGespraechAblegen } from '@/lib/inbox/ablegen-server';
import { istGespraechId } from '@/lib/inbox/strom';
import { einmalig } from '@/lib/store/anfragen';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const e = ablageEingabe(b);
  if (!e || !istGespraechId(e.gespraech)) return NextResponse.json({ ok: false, fehler: 'gespraech, nachricht, teil und ziel fehlen.' }, { status: 400 });
  const r = await einmalig<Record<string, unknown>>('inbox-ablegen', b.anfrageId, async () => {
    const x = await ausGespraechAblegen(z.person, e);
    // Team-Postfach einer anderen Person: das Holen des Anhangs steht im Lese-Protokoll (wessen Postfach, Anzahl — nie Inhalt).
    if (x.betroffen) leseZugriff(req, 'inbox', { betroffen: x.betroffen, anzahl: 1 });
    return { status: x.status, body: x.body };
  }, undefined, { wer: z.person });
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
