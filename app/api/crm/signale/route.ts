// ─── CRM — Signale aus Mail und Kalender übernehmen ─────────────────────────
// POST → liest nur geschäftliche Quellen (M365-Postfach, Apple-Mail außer dem
//        privaten Konto, KEMARIS-Kalender, Holding-Kalender), hängt Mails und
//        vergangene Termine bekannter Personen an deren Verlauf und merkt sich
//        die kommenden Termine. Höchstens alle 5 Minuten (sonst „frisch“).
// GET  → die kommenden Termine je Person (für Karteikarte und Power Hour)

import { NextResponse } from 'next/server';
import { loadJson, saveJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { mailAdresse, mailSignale, terminSignale, signaleAnwenden, type MailEin, type TerminEin } from '@/lib/crm/signale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stand { letzter?: string; kommend?: Record<string, { titel: string; start: string }>; neu?: number }
const NAME = 'crm-signale';

export async function GET() {
  const s = (await loadJson<Stand>(NAME)) ?? {};
  return NextResponse.json({ ok: true, letzter: s.letzter ?? null, kommend: s.kommend ?? {} });
}

export async function POST(req: Request) {
  const erzwingen = new URL(req.url).searchParams.get('jetzt') === '1';
  const alt = (await loadJson<Stand>(NAME)) ?? {};
  if (!erzwingen && alt.letzter && Date.now() - Date.parse(alt.letzter) < 5 * 60_000) return NextResponse.json({ ok: true, frisch: true, neu: 0 });

  const [ms, apple, kemaris, kalender] = await Promise.all([
    loadJson<{ emails?: { id: string; senderEmail?: string; subject?: string; receivedAt?: string }[] }>('microsoft-inbox'),
    loadJson<{ daten?: { id: string; account?: string; sender?: string; subject?: string; receivedAt?: string }[] }>('apple-mail-cache'),
    loadJson<{ events?: { id: string; title?: string; start?: string }[] }>('kemaris-calendar'),
    loadJson<{ events?: { id: string; title?: string; startDate?: string; category?: string }[] }>('calendar-cache'),
  ]);
  const mails: MailEin[] = [
    ...(ms?.emails ?? []).filter(m => m.senderEmail && m.receivedAt).map(m => ({ id: `ms-${m.id}`, email: m.senderEmail!, betreff: m.subject ?? '', am: m.receivedAt! })),
    // Das private Apple-Postfach bleibt draußen — nur Geschäftskonten.
    ...(apple?.daten ?? []).filter(m => m.account && !/privat/i.test(m.account) && m.receivedAt).map(m => ({ id: `ap-${m.id}`, email: mailAdresse(m.sender ?? '') ?? '', betreff: m.subject ?? '', am: m.receivedAt! })).filter(m => m.email),
  ];
  const termine: TerminEin[] = [
    ...(kemaris?.events ?? []).filter(t => t.title && t.start).map(t => ({ id: `km-${t.id}`, titel: t.title!, start: t.start! })),
    // Apple-Kalender: nur die geschäftliche Kategorie (Holding), keine privaten oder gemeinsamen.
    ...(kalender?.events ?? []).filter(t => t.category === 'holding' && t.title && t.startDate).map(t => ({ id: `ac-${t.id}`, titel: t.title!, start: t.startDate! })),
  ];
  const jetzt = new Date().toISOString();
  let neu = 0, kommend: Stand['kommend'] = {};
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    const t = terminSignale(f.kontakte, termine, jetzt);
    kommend = t.kommend;
    const r = signaleAnwenden(f.kontakte, [...mailSignale(f.kontakte, mails), ...t.vergangen]);
    neu = r.neu;
    return r.neu ? { ...f, kontakte: r.kontakte } : f;
  });
  await saveJson<Stand>(NAME, { letzter: jetzt, kommend, neu });
  return NextResponse.json({ ok: true, neu, mails: mails.length, termine: termine.length, kommend: Object.keys(kommend ?? {}).length });
}
