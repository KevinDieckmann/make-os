// ─── MAKE OS — Telegram: eine Nachricht kommt an ────────────────────────────
// Der Bote (bote.mjs) reicht jedes Update hierher. Diese Route entscheidet:
//   · /start CODE     → Chat mit einer Person koppeln
//   · unbekannter Chat → ein Satz, sonst nichts. Keine Daten, kein ZOE.
//   · gekoppelt        → die Nachricht geht an ZOE (/api/kimmi) — mit der
//                        Person im Kopf, damit Werkzeuge in den richtigen
//                        Raum schreiben. Die Antwort landet seit 05.10. (DSGVO)
//                        im ZOE-Verlauf der Person in MAKE OS; in den Chat geht nur
//                        „Neue Nachricht in MAKE OS“ mit Link — außer die Person hat
//                        die Ausnahme „ZOE-Antworten vollständig über Telegram“ an.
//
// GET liefert dem Boten, wo er weitermachen soll (letzte update_id).
//
// Sprachnachrichten: noch nicht. Das braucht eine Transkription auf dem
// Server, die es hier nicht gibt. Die Antwort sagt das ehrlich, statt still
// zu schweigen.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { nurDienstweg } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeStand, aendereStand, loeseCode, personFuerChat, sendeAnChat } from '@/lib/telegram';
import { nameVon } from '@/lib/zoe/raum';
import { nachrichtFuer } from '@/lib/gesundheit/lauf';
import { faelligeSlots, type TaktStand } from '@/lib/gesundheit/takt';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { istDienst } from '@/lib/zugang/dienst';
import { localDay } from '@/lib/zeit';
import { innenAdresse, aussenAdresse } from '@/lib/innen';
import { GRENZEN, titelAus, type Gespraech } from '@/lib/make-one/zoe-verlauf';
import { telegramVollFuer } from '@/lib/datenschutz/ki-einstellungen';
import { TELEGRAM_FREMD, appLink, hinweisNeueNachricht } from '@/lib/datenschutz/telegram-text';

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

// Neutral (Plattform-Regel, 05.10.): kein Name, kein Haushalt — ein fremder Chat erfährt nur, dass es eine private Instanz ist.
const FREMD = TELEGRAM_FREMD;

/** Frage und Antwort aus Telegram in den ZOE-Verlauf der Person (ein Gespräch je Tag) — dort liest sie die Antwort. */
async function inDenVerlauf(person: string, frage: string, antwort: string, jetzt: Date): Promise<string> {
  const tag = localDay(jetzt);
  const id = `tg-${tag}`;
  const zeit = jetzt.toISOString();
  await updateJson<{ gespraeche: Gespraech[] }>('zoe-verlauf', cur => {
    const f = { gespraeche: Array.isArray(cur?.gespraeche) ? cur!.gespraeche : [] };
    const i = f.gespraeche.findIndex(g => g.id === id && (g.person ?? 'kevin') === person);
    const neu = [{ rolle: 'kevin' as const, text: frage.slice(0, GRENZEN.zeichenProNachricht), zeit }, { rolle: 'zoe' as const, text: antwort.slice(0, GRENZEN.zeichenProNachricht), zeit }];
    if (i >= 0) {
      const g = f.gespraeche[i];
      f.gespraeche[i] = { ...g, zuletzt: zeit, nachrichten: [...g.nachrichten, ...neu].slice(-GRENZEN.nachrichtenProGespraech) };
    } else {
      f.gespraeche.push({ id, begonnen: zeit, zuletzt: zeit, titel: `Telegram · ${titelAus(frage)}`, nachrichten: neu, person });
    }
    f.gespraeche.sort((a, b) => (b.zuletzt ?? '').localeCompare(a.zuletzt ?? ''));
    f.gespraeche = f.gespraeche.slice(0, GRENZEN.gespraeche);
    return f;
  });
  return id;
}

export async function GET(req: Request) {
  if (!istDienst(req)) return nurDienstweg();
  const s = await ladeStand();
  const je: Record<string, number> = {};
  for (const k of s.kopplungen) je[k.person] = (je[k.person] ?? 0) + 1;
  return NextResponse.json({ letzteUpdate: s.letzteUpdate ?? -1, gekoppelt: je });
}

export async function POST(req: Request) {
  // Nur der Bote (Dienstschlüssel) liefert Telegram-Updates an — sonst könnte jede Sitzung als gekoppelte Person schreiben (26.09.).
  if (!istDienst(req)) return NextResponse.json({ error: 'Nur der Bote.' }, { status: 403 });
  let b: { update?: Update };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
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
    let gruss = `Gekoppelt als ${nameVon(person)}. Ich melde mich morgens, mittags und abends — und du kannst mir jederzeit schreiben. Meine Antworten liegen in MAKE OS; hier kommt nur ein Hinweis (außer du schaltest unter System › Datenschutz die Telegram-Ausnahme ein).`;
    try {
      const st = (await loadJson<TaktStand>('gesundheit-takt')) ?? {};
      const slot = faelligeSlots(st, person, jetzt, localDay(jetzt))[0];
      // Direkt in den Telegram-Chat → es zählt die Telegram-Ausnahme (nicht die des ZOE-Kanals auf WhatsApp, 08.10.).
      if (slot) gruss += '\n\n' + await nachrichtFuer(person, slot, innenAdresse(req), { voll: await telegramVollFuer(person).catch(() => false) });
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

  // ── An ZOE ──
  // Derselbe Weg wie im Browser: /api/kimmi mit der Person im Kopf. Kein
  // zweiter Gesprächspfad, kein zweites Werkzeug-Register.
  const origin = innenAdresse(req);
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
  // Datenschutz (05.10.): die Antwort bleibt in MAKE OS (ZOE-Verlauf); über Telegram nur der Hinweis mit Link — außer die
  // Person hat die Ausnahme „ZOE-Antworten vollständig über Telegram“ ausdrücklich eingeschaltet (System › Datenschutz).
  const voll = await telegramVollFuer(person).catch(() => false);
  await inDenVerlauf(person, text, antwort, jetzt).catch(() => undefined);
  const s = await sendeAnChat(chatId, voll ? antwort : hinweisNeueNachricht(appLink(aussenAdresse(), '/os')));
  return NextResponse.json({ ok: s.ok, person, was: s.ok ? (voll ? 'beantwortet' : 'hinweis') : `senden: ${s.fehler}` });
}
