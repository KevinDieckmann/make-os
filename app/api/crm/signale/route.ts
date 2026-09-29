// ─── CRM — Signale aus Mail und Kalender übernehmen ─────────────────────────
// POST → liest nur geschäftliche Quellen (M365-Postfach, Apple-Mail außer dem
//        privaten Konto, KEMARIS-Kalender, Holding-Kalender) und hängt Mails und
//        vergangene Termine bekannter Personen an deren Verlauf. Höchstens alle 5 Minuten (sonst „frisch“).
// GET  → wann der Lauf zuletzt lief.
// F3 (29.09.): Die kommenden Termine je Person (`kommend`) merkt sich der Lauf nicht mehr — der „nächste Termin“ kommt
// aus dem Kalender-Leser der Akte (GET /api/kalender/bezug, über den Bezug, abgesagte nie). Ein alter `kommend` im
// Bestand verschwindet beim nächsten Lauf (der Stand wird ganz geschrieben); bis dahin räumen Art. 17 und Umzug ihn mit.
// Seit 30.09. (K3): Termine mit Bezug (`kalender-bezug`: Kontakt + Gäste aus dem CRM) zählen aus JEDEM Kalender —
// wer verknüpft, meint es. Für sie legt der Lauf je vergangenem Vorkommen genau EINE Aktivität „Meeting“ mit
// `terminUid` an (lib/crm/termin-aktivitaet.ts) und zieht den letzten Kontakt für inzwischen vergangene Meetings nach;
// der Name im Titel gilt nur noch für Termine ohne Bezug (Holding-Kalender).
// Seit R-K1 (#46/#68/#100): Termin-Kennungen tragen den Kalender (`kalender|uid`) — Bezüge werden in beiden Formen
// gefunden (`bezugVon`), die Signal-Kennung der Titel-Termine bleibt die alte (sonst entstünden Doppelte). Abgesagte
// und abgelehnte Termine (STATUS:CANCELLED, eigene Antwort DECLINED) zählen nicht: kein Meeting, kein Kontakt.
// S1 (29.09.): private Termine ohne Bezug gehen nie über den Titel ins CRM (#10, `terminSignale`); POST prüft die
// Bau-Kennung (`bauPruefen`, Dienstweg ausgenommen).

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import { mailAdresse, mailSignale, terminSignale, signaleAnwenden, type MailEin, type TerminEin } from '@/lib/crm/signale';
import { terminAktivitaeten, terminKontaktNachziehen, terminVorbei, type TerminFuerCrm } from '@/lib/crm/termin-aktivitaet';
import { ladeBezuege } from '@/lib/kalender/bezug-server';
import { kontakteVon, bezugVon as bezugFuer, altSchluessel, type BezugBestand } from '@/lib/kalender/bezug';
import { localDay, tagePlus } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stand { letzter?: string; neu?: number }
const NAME = 'crm-signale';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const s = (await loadJson<Stand>(NAME)) ?? {};
  return NextResponse.json({ ok: true, letzter: s.letzter ?? null });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  const erzwingen = new URL(req.url).searchParams.get('jetzt') === '1';
  const alt = (await loadJson<Stand>(NAME)) ?? {};
  if (!erzwingen && alt.letzter && Date.now() - Date.parse(alt.letzter) < 5 * 60_000) return NextResponse.json({ ok: true, frisch: true, neu: 0 });

  const [ms, apple, kalender] = await Promise.all([
    loadJson<{ emails?: { id: string; senderEmail?: string; subject?: string; receivedAt?: string }[] }>('microsoft-inbox'),
    loadJson<{ daten?: { id: string; account?: string; sender?: string; subject?: string; receivedAt?: string }[] }>('apple-mail-cache'),
    loadJson<{ events?: { id: string; uid?: string; title?: string; startDate?: string; category?: string; privat?: boolean; abgesagt?: boolean }[] }>('calendar-cache'),
  ]);
  const bezuege: BezugBestand | null = await ladeBezuege().catch(() => null);
  const bezugVon = (e: { id: string; uid?: string }) => bezugFuer(bezuege, e);
  // Abgesagt/abgelehnt (R-K1 #100): fand nicht statt — weder Signal noch Meeting noch „letzter Kontakt“.
  const kalTermine = (kalender?.events ?? []).filter(t => t.title && t.startDate && !t.abgesagt);
  const mails: MailEin[] = [
    ...(ms?.emails ?? []).filter(m => m.senderEmail && m.receivedAt).map(m => ({ id: `ms-${m.id}`, email: m.senderEmail!, betreff: m.subject ?? '', am: m.receivedAt! })),
    // Das private Apple-Postfach bleibt draußen — nur Geschäftskonten.
    ...(apple?.daten ?? []).filter(m => m.account && !/privat/i.test(m.account) && m.receivedAt).map(m => ({ id: `ap-${m.id}`, email: mailAdresse(m.sender ?? '') ?? '', betreff: m.subject ?? '', am: m.receivedAt! })).filter(m => m.email),
  ];
  const termine: TerminEin[] = [
    // KEMARIS/M365: bis zur echten Anbindung keine Termine (die Beispieldaten sind seit 29.09., K5, raus).
    // Apple-Kalender: mit Bezug aus jedem Kalender; über den Namen im Titel nur die geschäftliche Kategorie (Holding).
    ...kalTermine.map(t => ({ t, k: kontakteVon(bezugVon(t)) })).filter(({ t, k }) => k.length || t.category === 'holding')
      .map(({ t, k }) => ({ id: k.length ? t.id : `ac-${altSchluessel(t.id)}`, titel: t.title!, start: t.startDate!, ...(t.uid ? { uid: t.uid } : {}), ...(k.length ? { kontaktIds: k } : {}), ...(t.privat ? { privat: true } : {}) })),
  ];
  // Termine mit Bezug → Meeting-Aktivitäten (eine je Vorkommen) und Kontaktpflege für vergangene Meetings.
  const mitBezug: TerminFuerCrm[] = kalTermine.flatMap(t => {
    const b = bezugVon(t), k = kontakteVon(b);
    return k.length ? [{ id: t.id, uid: t.uid ?? t.id, titel: t.title!, start: t.startDate!, ...(t.privat ? { privat: true } : {}), kontaktIds: k, ...(b?.dealId ? { dealId: b.dealId } : {}), von: b?.von ?? 'system' }] : [];
  });
  const jetzt = new Date().toISOString();
  const heute = localDay();
  let neu = 0;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const t = terminSignale(f.kontakte, termine, jetzt);
    const r = signaleAnwenden(f.kontakte, [...mailSignale(f.kontakte, mails), ...t.vergangen]);
    let kontakte = r.kontakte;
    let n = r.neu;
    for (const m of mitBezug) {
      if (!terminVorbei(m.start, jetzt)) continue;
      const x = terminAktivitaeten(kontakte, m, heute, jetzt, tagePlus);
      kontakte = x.kontakte; n += x.neu.length;
    }
    // Zeiten je Schlüssel — auch unter der alten Form (Aktivitäten vor R-K1 tragen `uid` bzw. `uid::RID`).
    const zeiten = new Map<string, { start: string }>();
    for (const m of mitBezug) { zeiten.set(m.id, { start: m.start }); if (!zeiten.has(altSchluessel(m.id))) zeiten.set(altSchluessel(m.id), { start: m.start }); }
    const nach = terminKontaktNachziehen(kontakte, zeiten, heute, jetzt);
    neu = n;
    return n || nach.geaendert ? { ...f, kontakte: nach.kontakte } : f;
  }, werAus(req));
  await saveJson<Stand>(NAME, { letzter: jetzt, neu });
  return NextResponse.json({ ok: true, neu, mails: mails.length, termine: termine.length });
}
