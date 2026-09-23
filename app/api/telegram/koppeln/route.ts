// ─── MAKE OS — Telegram koppeln ─────────────────────────────────────────────
// GET    → Stand für die angemeldete Person: eingerichtet? gekoppelt? Bot-Name
// POST   → einen Kopplungscode erzeugen (15 Minuten gültig)
// DELETE → alle Chats dieser Person entkoppeln

import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { ladeStand, aendereStand, codeAnlegen, chatsFuerPerson, telegramKonfiguriert, CODE_MINUTEN } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function botName(): Promise<string | undefined> {
  if (!telegramKonfiguriert()) return undefined;
  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    return d?.result?.username ? String(d.result.username) : undefined;
  } catch { return undefined; }
}

export async function GET(req: Request) {
  const person = personAus(req);
  const s = await ladeStand();
  return NextResponse.json({
    konfiguriert: telegramKonfiguriert(),
    bot: await botName(),
    person,
    chats: chatsFuerPerson(s, person).length,
    seit: s.kopplungen.find(k => k.person === person)?.seit,
  });
}

export async function POST(req: Request) {
  if (!telegramKonfiguriert()) return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN fehlt in .env.local.' }, { status: 200 });
  const person = personAus(req);
  let code = '';
  await aendereStand(s => { const r = codeAnlegen(s, person, new Date()); code = r.code; return r.stand; });
  return NextResponse.json({ ok: true, code, minuten: CODE_MINUTEN, bot: await botName() });
}

export async function DELETE(req: Request) {
  const person = personAus(req);
  await aendereStand(s => ({ ...s, kopplungen: s.kopplungen.filter(k => k.person !== person) }));
  return NextResponse.json({ ok: true });
}
