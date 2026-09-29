// ─── CRM — Signale aus Mail und Kalender übernehmen ─────────────────────────
// POST → liest nur geschäftliche Quellen (M365-Postfach, Apple-Mail außer dem
//        privaten Konto, KEMARIS-Kalender, Holding-Kalender), hängt Mails und
//        vergangene Termine bekannter Personen an deren Verlauf und merkt sich
//        die kommenden Termine. Höchstens alle 5 Minuten (sonst „frisch“).
// GET  → die kommenden Termine je Person (für Karteikarte und Power Hour)
// Seit 30.09. (K3): Termine mit Bezug (`kalender-bezug`: Kontakt + Gäste aus dem CRM) zählen aus JEDEM Kalender —
// wer verknüpft, meint es. Für sie legt der Lauf je vergangenem Vorkommen genau EINE Aktivität „Meeting“ mit
// `terminUid` an (lib/crm/termin-aktivitaet.ts) und zieht den letzten Kontakt für inzwischen vergangene Meetings nach;
// der Name im Titel gilt nur noch für Termine ohne Bezug (Holding-Kalender).

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import { mailAdresse, mailSignale, terminSignale, signaleAnwenden, type MailEin, type TerminEin } from '@/lib/crm/signale';
import { terminAktivitaeten, terminKontaktNachziehen, terminVorbei, type TerminFuerCrm } from '@/lib/crm/termin-aktivitaet';
import { ladeBezuege } from '@/lib/kalender/bezug-server';
import { kontakteVon, type BezugBestand } from '@/lib/kalender/bezug';
import { localDay, tagePlus } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stand { letzter?: string; kommend?: Record<string, { titel: string; start: string }>; neu?: number }
const NAME = 'crm-signale';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const s = (await loadJson<Stand>(NAME)) ?? {};
  return NextResponse.json({ ok: true, letzter: s.letzter ?? null, kommend: s.kommend ?? {} });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const erzwingen = new URL(req.url).searchParams.get('jetzt') === '1';
  const alt = (await loadJson<Stand>(NAME)) ?? {};
  if (!erzwingen && alt.letzter && Date.now() - Date.parse(alt.letzter) < 5 * 60_000) return NextResponse.json({ ok: true, frisch: true, neu: 0 });

  const [ms, apple, kalender] = await Promise.all([
    loadJson<{ emails?: { id: string; senderEmail?: string; subject?: string; receivedAt?: string }[] }>('microsoft-inbox'),
    loadJson<{ daten?: { id: string; account?: string; sender?: string; subject?: string; receivedAt?: string }[] }>('apple-mail-cache'),
    loadJson<{ events?: { id: string; uid?: string; title?: string; startDate?: string; category?: string; privat?: boolean }[] }>('calendar-cache'),
  ]);
  const bezuege: BezugBestand | null = await ladeBezuege().catch(() => null);
  const bezugVon = (e: { id: string; uid?: string }) => bezuege?.bezuege[e.id] ?? (e.uid ? bezuege?.bezuege[e.uid] : undefined);
  const mails: MailEin[] = [
    ...(ms?.emails ?? []).filter(m => m.senderEmail && m.receivedAt).map(m => ({ id: `ms-${m.id}`, email: m.senderEmail!, betreff: m.subject ?? '', am: m.receivedAt! })),
    // Das private Apple-Postfach bleibt draußen — nur Geschäftskonten.
    ...(apple?.daten ?? []).filter(m => m.account && !/privat/i.test(m.account) && m.receivedAt).map(m => ({ id: `ap-${m.id}`, email: mailAdresse(m.sender ?? '') ?? '', betreff: m.subject ?? '', am: m.receivedAt! })).filter(m => m.email),
  ];
  const termine: TerminEin[] = [
    // KEMARIS/M365: bis zur echten Anbindung keine Termine (die Beispieldaten sind seit 29.09., K5, raus).
    // Apple-Kalender: mit Bezug aus jedem Kalender; über den Namen im Titel nur die geschäftliche Kategorie (Holding).
    ...(kalender?.events ?? []).filter(t => t.title && t.startDate).map(t => ({ t, k: kontakteVon(bezugVon(t)) })).filter(({ t, k }) => k.length || t.category === 'holding')
      .map(({ t, k }) => ({ id: k.length ? t.id : `ac-${t.id}`, titel: t.title!, start: t.startDate!, ...(t.uid ? { uid: t.uid } : {}), ...(k.length ? { kontaktIds: k } : {}) })),
  ];
  // Termine mit Bezug → Meeting-Aktivitäten (eine je Vorkommen) und Kontaktpflege für vergangene Meetings.
  const mitBezug: TerminFuerCrm[] = (kalender?.events ?? []).filter(t => t.title && t.startDate).flatMap(t => {
    const b = bezugVon(t), k = kontakteVon(b);
    return k.length ? [{ id: t.id, uid: t.uid ?? t.id, titel: t.title!, start: t.startDate!, ...(t.privat ? { privat: true } : {}), kontaktIds: k, ...(b?.dealId ? { dealId: b.dealId } : {}), von: b?.von ?? 'system' }] : [];
  });
  const jetzt = new Date().toISOString();
  const heute = localDay();
  let neu = 0, kommend: Stand['kommend'] = {};
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const t = terminSignale(f.kontakte, termine, jetzt);
    kommend = t.kommend;
    const r = signaleAnwenden(f.kontakte, [...mailSignale(f.kontakte, mails), ...t.vergangen]);
    let kontakte = r.kontakte;
    let n = r.neu;
    for (const m of mitBezug) {
      if (!terminVorbei(m.start, jetzt)) continue;
      const x = terminAktivitaeten(kontakte, m, heute, jetzt, tagePlus);
      kontakte = x.kontakte; n += x.neu.length;
    }
    const nach = terminKontaktNachziehen(kontakte, new Map(mitBezug.map(m => [m.id, { start: m.start }])), heute, jetzt);
    neu = n;
    return n || nach.geaendert ? { ...f, kontakte: nach.kontakte } : f;
  }, werAus(req));
  await saveJson<Stand>(NAME, { letzter: jetzt, kommend, neu });
  return NextResponse.json({ ok: true, neu, mails: mails.length, termine: termine.length, kommend: Object.keys(kommend ?? {}).length });
}
