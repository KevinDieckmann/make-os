// ─── MAKE OS — Gesundheit: der Stand auf einen Blick ────────────────────────
// Ein Aufruf für die Seite: Vitalwerte, Routinen, Journal, Telegram und die Tagebücher der eingeschalteten Module
// (Symptom-Tagebuch, Zähler „Sauber geblieben“ — lib/gesundheit/module.ts) — für die angemeldete Person oder per ?fuer=
// für eine Person, die ihre Gesundheit mit ihr teilt. `module` = wirksamer Stand (an/aus); ein ausgeschaltetes Modul
// liefert für JEDEN leere Werte (serverseitig, nicht nur ausgeblendet).

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { ansichtPerson, personAus, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { resolveVitals } from '@/lib/vitals';
import { localDay } from '@/lib/zeit';
import { hautTrend, streakStand, routineQuote, tageZurueck, type HautLog, type StreakLog, type RoutinenLog } from '@/lib/gesundheit/eintraege';
import { ladeStand, chatsFuerPerson, telegramKonfiguriert } from '@/lib/telegram';
import type { TaktStand } from '@/lib/gesundheit/takt';
import { routinenImUmfang, routinenSichtbarFuer } from '@/lib/planung/bereich-sicht-server';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { moduleWirksam, hatEintraege } from '@/lib/gesundheit/module';
import { koerperLaden } from '@/lib/gesundheit/koerper-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Routine { id: string; label: string; wann: string; aktiv: boolean; kategorie?: string; owner?: string; space?: string; einheit?: string }

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9, 05.10.)
  const ich = personAus(req);
  const heute = localDay();
  const [vitals, hautRoh, streakRoh, hl, journal, routinenF, tg, takt, koerper] = await Promise.all([
    resolveVitals(heute, person),
    loadJson<HautLog>(speicherFuer('haut', person)),
    loadJson<StreakLog>(speicherFuer('streak', person)),
    loadJson<RoutinenLog>(speicherFuer('health-log', person)),
    loadJson<Record<string, { text?: string; gut?: string; dankbar?: string; hart?: string; mood?: number; energy?: number; stress?: number }>>(speicherFuer('journal', person)),
    loadJson<{ routinen?: Routine[] }>('routinen'),
    ladeStand(),
    loadJson<TaktStand>('gesundheit-takt'),
    koerperLaden(person).then(r => r.koerper),
  ]);
  // Module der Person (09.10.): nur die wirksamen an/aus gehen raus — nie das Körper-Profil selbst (das sieht nur sie).
  const modulStand = moduleWirksam(koerper, { haut: hatEintraege(hautRoh), serie: hatEintraege(streakRoh) });
  const haut = modulStand.haut ? hautRoh : null;
  const streak = modulStand.serie ? streakRoh : null;
  // Nur, was diese Person sieht: eigene und gemeinsame Routinen (27.09.). Seit 09.10. (E4-Rest) im Umfang der Person UND der anfragenden
  // Person (lib/planung/bereich-sicht-server.ts): ein Konto „nur Business“ ohne den Privat-Bereich, außerhalb des Haushalts keine — vorher
  // bekamen auch Testkunde und fremder Haushalt die Routinen „für beide“ (Messlatte 09.10.).
  const routinen = await routinenImUmfang(await routinenSichtbarFuer((routinenF?.routinen ?? []).filter(r => r.aktiv), person), ich);
  const t14 = tageZurueck(heute, 14);
  const q = routineQuote(hl ?? {}, routinen.map(r => r.id), heute, 7);
  const je = (id: string) => routineQuote(hl ?? {}, [id], heute, 7).quote;

  return NextResponse.json({
    person, ich, heute,
    vitals,
    module: modulStand,
    haut: { trend: hautTrend(haut ?? {}, heute), tage: t14.map(d => ({ d, e: haut?.[d] ?? null })) },
    streak: streakStand(streak ?? {}, heute),
    routinen: {
      liste: routinen.map(r => ({ ...r, quote7: je(r.id), heute: (hl?.[heute] ?? []).includes(r.id) })),
      quote7: q.quote, tage7: q.tage,
      tage: t14.map(d => ({ d, n: (hl?.[d] ?? []).length })),
    },
    journal: { tage7: tageZurueck(heute, 7).filter(d => journal?.[d]).length, heute: journal?.[heute] ?? null },
    telegram: { konfiguriert: telegramKonfiguriert(), gekoppelt: chatsFuerPerson(tg, person).length > 0, zuletzt: takt?.[person] ?? {} },
  });
}
