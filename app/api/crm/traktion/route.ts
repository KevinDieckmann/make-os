// ─── Markttraktion — Überblick ──────────────────────────────────────────────
// GET → Traction-Score über Sales, Marketing, Event (lib/crm/traktion.ts),
//       die Kennzahlen je Welt, die Grundlage (zählt nicht in den Score),
//       die Übergaben zwischen den Welten, die Befunde („was jetzt zu tun
//       ist“) und je Head: letzter Lauf, Status, offene Vorschläge.
//       Zu zweit (25.09.): „für dich“ (nur das Eigene der angemeldeten Person),
//       „zuletzt im Team“ (14 Tage) und je Welt, wer sie verantwortet.
//       Rhythmus (25.09.): einmal je Tag ein Schnappschuss des Scores in
//       „traktion-verlauf“ (der letzte Stand des Tages gilt; geschrieben wird
//       nur, wenn er sich geändert hat), dazu `verlauf` (90 Tage), das
//       Wochen-Scoreboard (8 Kalenderwochen, lib/crm/scoreboard.ts) und ob der
//       Telegram-Bote für die angemeldete Person bereitsteht.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { kennzahlen } from '@/lib/crm/kennzahlen';
import { marketingKennzahlen } from '@/lib/crm/marketing';
import { eventKennzahlen, uebergaben, GRUNDLAGE } from '@/lib/crm/traktion';
import { traktionsIndex, alsTraktion, TRAKTION_KENNZAHLEN } from '@/lib/crm/traktion-index';
import { ladeIndexDatei, fortschreiben, speichereSchwelle } from '@/lib/kennzahlen/speicher';
import { befunde } from '@/lib/crm/befunde';
import { HEADS, HEAD_NAME } from '@/lib/heads/prompt';
import { leererStand, standName, type HeadStand } from '@/lib/heads/stand';
import { localDay } from '@/lib/zeit';
import { personAus } from '@/lib/jarvis/raum';
import { fuerDich, teamFeed, verantwortlich, TEAM } from '@/lib/crm/team';
import { wochenScoreboard, verlaufEintrag, verlaufFortschreiben, verlaufSeit, gleicherStand, jePersonSieben, VERLAUF_SPEICHER, type TraktionVerlauf, type VerlaufTag } from '@/lib/crm/scoreboard';
import { ladeStand as ladeTelegram, chatsFuerPerson, telegramKonfiguriert } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Schnappschuss des Tages schreiben und den Verlauf der letzten 90 Tage
 * liefern. Geschrieben wird nur, wenn sich der Tagesstand geändert hat — der
 * Überblick fragt jede Minute, die Datei soll nicht jede Minute neu entstehen.
 * Ein Fehler hier darf den Überblick nie kippen: dann eben ohne Verlauf.
 */
async function schnappschuss(eintrag: VerlaufTag, heute: string): Promise<VerlaufTag[]> {
  try {
    const alt = await loadJson<TraktionVerlauf>(VERLAUF_SPEICHER);
    const bisher = Array.isArray(alt?.tage) ? alt!.tage.find(t => t.tag === heute) : undefined;
    const stand = alt && gleicherStand(bisher, eintrag) ? alt : await updateJson<TraktionVerlauf>(VERLAUF_SPEICHER, cur => verlaufFortschreiben(cur, eintrag));
    return verlaufSeit(stand, heute, 90);
  } catch (err) {
    console.error('[MAKE OS] Traction-Verlauf nicht fortgeschrieben:', err);
    return [];
  }
}

export async function GET(req: Request) {
  const heute = localDay();
  const ich = personAus(req);
  const [roh, crm, ...staende] = await Promise.all([
    loadJson<{ kontakte: Kontakt[] }>('kontakte'), ladeCrm(),
    ...HEADS.map(h => loadJson<HeadStand>(standName(h))),
  ]);
  const kontakte = roh?.kontakte ?? [];
  const sales = kennzahlen(kontakte, crm, heute);
  const marketing = marketingKennzahlen(kontakte, crm, heute);
  const event = eventKennzahlen(kontakte, crm, heute);
  // Traktions-Index (26.09.): derselbe Kern wie Business und Privat — mit eigenen Schwellen und Verlauf.
  const datei = await ladeIndexDatei('traktion-index');
  const index = traktionsIndex({ kontakte, crm, heute, schwellen: datei.schwellen });
  void event;
  const heads = HEADS.map((h, i) => {
    const s = { ...leererStand(), ...(staende[i] ?? {}) };
    const b = s.berichte[s.berichte.length - 1];
    return { id: h, name: HEAD_NAME[h], verantwortlich: verantwortlich(h), offen: s.vorschlaege.filter(v => v.status === 'offen').length, status: b?.antwort.status ?? null, zeit: b?.zeit ?? null, zusammenfassung: b?.antwort.zusammenfassung ?? s.ruhig?.text ?? null };
  });
  const t = alsTraktion(index);
  const [verlauf, tg, indexVerlauf] = await Promise.all([
    schnappschuss(verlaufEintrag(t, heute, jePersonSieben(kontakte, crm, heute)), heute),
    ladeTelegram().catch(() => null),
    fortschreiben('traktion-index', datei, index, heute, kontakte.length > 0),
  ]);
  return NextResponse.json({
    ok: true, heute, ich, team: TEAM,
    fuerDich: fuerDich(ich, kontakte, crm, heute),
    teamFeed: teamFeed(kontakte, crm, new Date(Date.now() - 14 * 864e5).toISOString(), 14),
    traktion: t,
    index, indexVerlauf,
    verlauf,
    scoreboard: wochenScoreboard(kontakte, crm, heute),
    telegram: { konfiguriert: telegramKonfiguriert(), gekoppelt: !!tg && chatsFuerPerson(tg, ich).length > 0 },
    grundlage: [...sales, ...marketing].filter(k => GRUNDLAGE.includes(k.id)),
    uebergaben: uebergaben(kontakte, crm, heute),
    befunde: befunde(kontakte, crm, heute),
    heads,
    bestand: { kontakte: kontakte.length, firmen: crm.firmen.length, chancen: crm.chancen.length, mandate: crm.mandate.length, events: crm.events.length, kampagnen: (crm.kampagnen ?? []).length },
  });
}

/** Eigene Schwelle einer Traktions-Kennzahl setzen oder zurücksetzen (Team-weit). */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b.schwelle || typeof b.schwelle !== 'object') return NextResponse.json({ ok: false, fehler: 'Schwelle fehlt.' }, { status: 400 });
  const r = await speichereSchwelle('traktion-index', TRAKTION_KENNZAHLEN, b.schwelle as Record<string, unknown>);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
