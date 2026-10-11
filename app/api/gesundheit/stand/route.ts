// ─── MAKE OS — Gesundheit: der Stand auf einen Blick ────────────────────────
// Ein Aufruf für die Seite: Vitalwerte, Routinen, Journal, Telegram und die Tagebücher der eingeschalteten Module
// (Symptom-Tagebuch, Zähler „Sauber geblieben“ — lib/gesundheit/module.ts) — für die angemeldete Person oder per ?fuer=
// für eine Person, die ihre Gesundheit mit ihr teilt. `module` = wirksamer Stand (an/aus); ein ausgeschaltetes Modul
// liefert für JEDEN leere Werte (serverseitig, nicht nur ausgeblendet).
// 09.10.: `koerperwerte` = die weiteren WHOOP-Tageswerte des Morgen-Check-Tages (Strain, Schlaf, Körper gegen den eigenen 7-Tage-Bezug —
// lib/gesundheit/koerperwerte.ts). Dasselbe Tor wie die Vitalwerte: die Person selbst oder wer ihre Gesundheit geteilt bekommt (Art. 9).

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { ansichtPerson, personAus, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { resolveVitals, type VitalsLog } from '@/lib/vitals';
import { koerperwerteAus } from '@/lib/gesundheit/koerperwerte';
import { localDay } from '@/lib/zeit';
import { hautTrend, streakStand, rhythmusQuote, tageZurueck, type HautLog, type StreakLog, type RoutinenLog } from '@/lib/gesundheit/eintraege';
import { ladeStand, chatsFuerPerson, telegramKonfiguriert } from '@/lib/telegram';
import type { TaktStand } from '@/lib/gesundheit/takt';
import { routinenImUmfang, routinenSichtbarFuer } from '@/lib/planung/bereich-sicht-server';
import { routineImPrivat } from '@/lib/planung/bereich-sicht';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { moduleWirksam, hatEintraege } from '@/lib/gesundheit/module';
import { koerperLaden } from '@/lib/gesundheit/koerper-server';
import { heuteFaellig, erledigtTage } from '@/lib/planung/routinen';
import { routineRhythmusKurz, routineStatistik } from '@/lib/planung/rhythmus';
import { zaehlerVon } from '@/lib/planung/routinen-haken-server';
import type { Routine as PlanRoutine } from '@/lib/planung/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Routine = PlanRoutine;

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9, 05.10.)
  const ich = personAus(req);
  const heute = localDay();
  const [vitals, vitalsLog, hautRoh, streakRoh, hl, journal, routinenF, tg, takt, koerper, zaehler] = await Promise.all([
    resolveVitals(heute, person),
    loadJson<VitalsLog>(speicherFuer('vitals', person)),
    loadJson<HautLog>(speicherFuer('haut', person)),
    loadJson<StreakLog>(speicherFuer('streak', person)),
    loadJson<RoutinenLog>(speicherFuer('health-log', person)),
    loadJson<Record<string, { text?: string; gut?: string; dankbar?: string; hart?: string; mood?: number; energy?: number; stress?: number }>>(speicherFuer('journal', person)),
    loadJson<{ routinen?: Routine[] }>('routinen'),
    ladeStand(),
    loadJson<TaktStand>('gesundheit-takt'),
    koerperLaden(person).then(r => r.koerper),
    // Routinen 2 (10.10.): Zähler je Tag („5 von 8“) der angezeigten Person — dasselbe Tor wie ihr Log.
    zaehlerVon(person),
  ]);
  // Module der Person (09.10.): nur die wirksamen an/aus gehen raus — nie das Körper-Profil selbst (das sieht nur sie).
  const modulStand = moduleWirksam(koerper, { haut: hatEintraege(hautRoh), serie: hatEintraege(streakRoh) });
  const haut = modulStand.haut ? hautRoh : null;
  const streak = modulStand.serie ? streakRoh : null;
  // Nur, was diese Person sieht: eigene und gemeinsame Routinen (27.09.). Seit 09.10. (E4-Rest) im Umfang der Person UND der anfragenden
  // Person (lib/planung/bereich-sicht-server.ts): ein Konto „nur Business“ ohne den Privat-Bereich, außerhalb des Haushalts keine — vorher
  // bekamen auch Testkunde und fremder Haushalt die Routinen „für beide“ (Messlatte 09.10.).
  // Gesundheit gehört zu Privat (Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat“): nur Routinen des Privat-Bereichs —
  // eine Business-Routine (z. B. Wochenplanung) steht nicht unter Körper & Routinen.
  const routinen = (await routinenImUmfang(await routinenSichtbarFuer((routinenF?.routinen ?? []).filter(r => r.aktiv), person), ich)).filter(r => routineImPrivat(r as Parameters<typeof routineImPrivat>[0]));
  const t14 = tageZurueck(heute, 14);
  // Prüf-Fund 11.10.: die 7-Tage-Quote nach Rhythmus je Routine (nur fällige Tage, Pausen/Zeitraum zählen nicht gegen), gemittelt —
  // früher „alle Routinen an jedem Tag“ (eine Routine 3×/Woche machte sie rot). null = nichts zu messen.
  const q = rhythmusQuote(hl ?? {}, routinen as Parameters<typeof rhythmusQuote>[1], heute, 7);
  const je = (id: string) => q.je.find(x => x.id === id)?.quote ?? null;
  // Routinen 2 (10.10.): „Heute“ nach Rhythmus — nur, was heute dran ist (oder schon erledigt), mit Zähler, Streak und Quote je Regel
  // (lib/planung/rhythmus.ts). Pausen und Zeitraum nimmt die Fälligkeit mit. `alle` = jede aktive Routine (für „Sätze unter Routinen“).
  const heuteListe = heuteFaellig(routinen, person, hl ?? {}, heute, 'alle', zaehler).map(x => {
    const st = routineStatistik(x.routine, erledigtTage(hl ?? {}, x.routine.id), heute);
    return {
      ...x.routine, quote7: je(x.routine.id), heute: x.heuteErledigt, ziel: x.ziel, ist: x.ist, ueberfaellig: x.f.ueberfaellig,
      rhythmus: routineRhythmusKurz(x.routine), streak: st.streak, streakEinheit: st.einheit, quote: st.quote,
      ...(x.f.proWoche ? { dieseWoche: x.f.dieseWoche ?? 0, proWoche: x.f.proWoche } : {}),
    };
  });

  return NextResponse.json({
    person, ich, heute,
    vitals,
    ...(!vitals.fallback ? { koerperwerte: koerperwerteAus(vitalsLog ?? {}, vitals.stand) } : {}),
    module: modulStand,
    haut: { trend: hautTrend(haut ?? {}, heute), tage: t14.map(d => ({ d, e: haut?.[d] ?? null })) },
    streak: streakStand(streak ?? {}, heute),
    routinen: {
      liste: heuteListe,
      alle: routinen.map(r => ({ id: r.id, label: r.label })),
      quote7: q.quote, tage7: q.tage,
      tage: t14.map(d => ({ d, n: (hl?.[d] ?? []).length })),
    },
    journal: { tage7: tageZurueck(heute, 7).filter(d => journal?.[d]).length, heute: journal?.[heute] ?? null },
    telegram: { konfiguriert: telegramKonfiguriert(), gekoppelt: chatsFuerPerson(tg, person).length > 0, zuletzt: takt?.[person] ?? {} },
  });
}
