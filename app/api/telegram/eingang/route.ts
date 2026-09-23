// ─── MAKE OS — Telegram: eine Nachricht kommt an ────────────────────────────
// Der Bote (bote.mjs) reicht jedes Update hierher. Diese Route entscheidet:
//   · /start CODE     → Chat mit einer Person koppeln
//   · unbekannter Chat → ein Satz, sonst nichts. Keine Daten, kein Jarvis.
//   · gekoppelt        → die Nachricht geht an Jarvis (/api/kimmi) — mit der
//                        Person im Kopf, damit Werkzeuge in den richtigen
//                        Raum schreiben — und die Antwort zurück in den Chat.
//
// GET liefert dem Boten, wo er weitermachen soll (letzte update_id).
//
// Sprachnachrichten: noch nicht. Das braucht eine Transkription auf dem
// Server, die es hier nicht gibt. Die Antwort sagt das ehrlich, statt still
// zu schweigen.

import { NextResponse } from 'next/server';
import { ladeStand, aendereStand, loeseCode, personFuerChat, sendeAnChat } from '@/lib/telegram';
import { nameVon } from '@/lib/jarvis/raum';
import { nachrichtFuer } from '@/lib/gesundheit/lauf';
import { faelligeSlots, type TaktStand } from '@/lib/gesundheit/takt';
import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Update {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { first_name?: string; username?: string };
    text?: string;
    voice?: unknown; photo?: unknown; document?: unknown;
  };
}

const FREMD = 'Dieser Bot gehört Kevin und Malin. Kopplung nur über MAKE OS → Gesundheit → Telegram.';

export async function GET() {
  const s = await ladeStand();
  const je: Record<string, number> = {};
  for (const k of s.kopplungen) je[k.person] = (je[k.person] ?? 0) + 1;
  return NextResponse.json({ letzteUpdate: s.letzteUpdate ?? -1, gekoppelt: je });
}

export async function POST(req: Request) {
  let b: { update?: Update };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const u = b.update;
  if (!u || typeof u.update_id !== 'number') return NextResponse.json({ error: 'update fehlt.' }, { status: 400 });

  // Doppelte nach einem Neustart des Boten still schlucken.
  const vorher = await ladeStand();
  if (typeof vorher.letzteUpdate === 'number' && u.update_id <= vorher.letzteUpdate) {
    return NextResponse.json({ ok: true, was: 'doppelt' });
  }
  await aendereStand(s => ({ ...s, letzteUpdate: u.update_id }));

  const m = u.message;
  if (!m || m.chat.type !== 'private') return NextResponse.json({ ok: true, was: 'ignoriert' });
  const chatId = m.chat.id;
  const text = (m.text ?? '').trim();
  const jetzt = new Date();

  // ── Kopplung ──
  if (/^\/start\b/i.test(text)) {
    const code = text.replace(/^\/start\s*/i, '').trim();
    const schon = personFuerChat(vorher, chatId);
    if (!code) {
      await sendeAnChat(chatId, schon
        ? `Du bist gekoppelt als ${nameVon(schon)}. Schreib mir einfach.`
        : 'Zum Koppeln: in MAKE OS unter Gesundheit → Telegram einen Code holen und hier senden als: /start CODE');
      return NextResponse.json({ ok: true, was: 'start' });
    }
    let person: string | undefined; let grund: string | undefined;
    await aendereStand(s => { const r = loeseCode(s, code, chatId, jetzt, m.from?.first_name); person = r.person; grund = r.grund; return r.stand; });
    if (!person) { await sendeAnChat(chatId, grund ?? 'Code unbekannt.'); return NextResponse.json({ ok: true, was: 'code abgelehnt' }); }
    // Gekoppelt — und wenn heute gerade ein Slot offen ist, kommt er sofort.
    let gruss = `Gekoppelt als ${nameVon(person)}. Ich melde mich morgens, mittags und abends — und du kannst mir jederzeit schreiben.`;
    try {
      const st = (await loadJson<TaktStand>('gesundheit-takt')) ?? {};
      const slot = faelligeSlots(st, person, jetzt, localDay(jetzt))[0];
      if (slot) gruss += '\n\n' + await nachrichtFuer(person, slot, new URL(req.url).origin);
    } catch { /* der Gruß reicht */ }
    await sendeAnChat(chatId, gruss);
    return NextResponse.json({ ok: true, person, was: 'gekoppelt' });
  }

  // ── Wer schreibt? ──
  const person = personFuerChat(vorher, chatId);
  if (!person) {
    await sendeAnChat(chatId, FREMD);
    return NextResponse.json({ ok: true, was: 'fremd' });
  }

  if (!text) {
    const was = m.voice ? 'Sprachnachrichten kann ich hier noch nicht hören — schreib es mir kurz.'
      : m.photo || m.document ? 'Dokumente und Fotos nehme ich bald an (Prozesse, Phase 5). Bis dahin: kurz in Worten.'
      : 'Das konnte ich nicht lesen.';
    await sendeAnChat(chatId, was);
    return NextResponse.json({ ok: true, person, was: 'kein text' });
  }

  // ── An Jarvis ──
  // Derselbe Weg wie im Browser: /api/kimmi mit der Person im Kopf. Kein
  // zweiter Gesprächspfad, kein zweites Werkzeug-Register.
  const origin = new URL(req.url).origin;
  let antwort = '';
  try {
    const r = await fetch(`${origin}/api/kimmi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '', 'x-make-person': person },
      body: JSON.stringify({ message: text, context: 'telegram' }),
      signal: AbortSignal.timeout(170_000),
    });
    const d = await r.json();
    antwort = String(d.reply ?? '').trim() || 'Ich habe nichts zu sagen — frag mich anders.';
  } catch {
    antwort = 'Ich bin gerade nicht erreichbar. Versuch es gleich nochmal.';
  }
  const s = await sendeAnChat(chatId, antwort);
  return NextResponse.json({ ok: s.ok, person, was: s.ok ? 'beantwortet' : `senden: ${s.fehler}` });
}
