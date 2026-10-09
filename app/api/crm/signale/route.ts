// ─── CRM — Signale aus Mail und Kalender übernehmen ─────────────────────────
// POST → liest die Kalender (KEMARIS, Holding, Termine mit Bezug) und hängt vergangene Termine bekannter Personen an deren
//        Verlauf. Höchstens alle 5 Minuten (sonst „frisch“). Mails seit 06.10. (Inbox 2) NICHT mehr hier: ein Gespräch kommt erst
//        nach „Zuordnen“ in der Inbox in den Verlauf (lib/inbox/verlauf.ts — Kevin: „jede Übernahme braucht einen Klick“); die alten
//        Quellen (M365-Bestand, Apple-Mail-Zwischenspeicher) gibt es nicht mehr.
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
// 09.10. (Takt robust): der Lauf selbst steht in lib/crm/signale-server.ts (`signaleLauf`) — dieselbe Stelle ruft der Takt alle 10 Minuten
// (`crmSignaleImTakt`), damit der „letzte Kontakt“ auch ohne offene Markttraktion frisch ist.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { signaleLauf, SIGNALE_BESTAND, type SignaleStand } from '@/lib/crm/signale-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const s = (await loadJson<SignaleStand>(SIGNALE_BESTAND)) ?? {};
  return NextResponse.json({ ok: true, letzter: s.letzter ?? null });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  const erzwingen = new URL(req.url).searchParams.get('jetzt') === '1';
  const r = await signaleLauf({ wer: werAus(req), erzwingen });
  if (r.frisch) return NextResponse.json({ ok: true, frisch: true, neu: 0 });
  return NextResponse.json({ ok: true, neu: r.neu, mails: 0, termine: r.termine });
}
