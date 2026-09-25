// ─── Kalender (25.09.) — alles an einem Ort ─────────────────────────────────
// GET ?von=YYYY-MM-DD&bis=YYYY-MM-DD (bis exklusiv, höchstens 120 Tage)
//   → Termine (iCloud direkt, sonst der zugelieferte Mac-Stand), Fristen aus
//     dem System, Apple-Erinnerungen (vom Mac), die Kalender und der Stand.
// POST { aktion: 'abgleichen' } → sofort mit iCloud abgleichen.
// Nur für den Haushalt (Kevin & Malin) und den Dienstweg.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, frischerStand, abgleichen, termineImZeitraum, kontoAnzeige, CACHE } from '@/lib/kalender/icloud';
import { fristen, erinnerungen, type Quellen } from '@/lib/kalender/eintraege';
import { ladeEinstellungen, wemGehoert } from '@/lib/kalender/einstellungen';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { SPEICHER as MAC, type Gemerkt } from '@/lib/mac';
import { ladeBauplan } from '@/lib/bauplan/speicher';
import { ladeCrm } from '@/lib/crm/speicher';
import { localDay } from '@/lib/zeit';
import type { Termin } from '@/lib/kalender/ics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

interface MacEv { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean; calendarName?: string; location?: string }

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const heute = localDay();
  const von = TAG.test(q.get('von') ?? '') ? q.get('von')! : tagPlus(heute, -1);
  let bis = TAG.test(q.get('bis') ?? '') ? q.get('bis')! : tagPlus(von, 14);
  if (bis <= von) bis = tagPlus(von, 1);
  if (bis > tagPlus(von, 120)) bis = tagPlus(von, 120);

  const einst = await ladeEinstellungen();
  let termine: Termin[] = [];
  let stand: string | null = null;
  let fehler: string | undefined;
  let quelle: 'icloud' | 'mac' | 'leer' = 'leer';
  let kalender: { name: string; farbe?: string; schreibbar: boolean; wer: string }[] = [];

  if (verbunden()) {
    const s = await frischerStand();
    termine = termineImZeitraum(s, von, bis);
    stand = s.at ?? null;
    fehler = s.fehler && (!s.at || (s.fehlerAt ?? '') > s.at) ? s.fehler : undefined;
    quelle = s.at ? 'icloud' : 'leer';
    kalender = s.kalender.map(k => ({ name: k.name, ...(k.farbe ? { farbe: k.farbe } : {}), schreibbar: k.schreibbar, wer: wemGehoert(einst, k.name) }));
  } else {
    // Ohne iCloud: der zuletzt vom Mac gelieferte Stand — nur lesen.
    const c = await loadJson<{ events?: MacEv[]; at?: string }>(CACHE);
    stand = c?.at ?? null;
    quelle = c?.at ? 'mac' : 'leer';
    termine = (c?.events ?? []).filter(e => e.title && e.startDate && e.startDate.slice(0, 10) < bis && (e.endDate ?? e.startDate).slice(0, 10) >= von).map((e, i) => ({
      id: e.id ?? `mac-${i}`, uid: e.id ?? `mac-${i}`, href: '', titel: e.title!, start: e.startDate!, ende: e.endDate ?? e.startDate!, ganztags: !!e.allDay,
      kalender: (e.calendarName ?? 'Kalender').trim(), kalenderId: '', ...(e.location ? { ort: e.location } : {}), serie: false, mitTeilnehmern: false, bearbeitbar: false,
    }));
    kalender = Array.from(new Set(termine.map(t => t.kalender))).map(name => ({ name, schreibbar: false, wer: wemGehoert(einst, name) }));
  }

  const [meilensteine, bauplan, crm, finanzplan, rem] = await Promise.all([
    loadJson<{ meilensteine?: Quellen['meilensteine'] }>('meilensteine').catch(() => null),
    ladeBauplan().catch(() => null),
    ladeCrm().catch(() => null),
    loadJson<{ zahlungen?: Quellen['zahlungen']; rechnungen?: Quellen['rechnungen'] }>('finanzplan').catch(() => null),
    loadJson<Gemerkt>(MAC.erinnerungen).catch(() => null),
  ]);
  const quellen: Quellen = {
    meilensteine: meilensteine?.meilensteine, etappen: bauplan?.etappen,
    mandate: crm?.mandate as Quellen['mandate'], zahlungen: finanzplan?.zahlungen, rechnungen: finanzplan?.rechnungen,
  };

  return NextResponse.json({
    ok: true, von, bis, quelle, stand, ...(fehler ? { fehler } : {}),
    icloud: verbunden(), konto: kontoAnzeige(),
    kalender, einstellungen: einst,
    termine: termine.map(t => ({ ...t, wer: wemGehoert(einst, t.kalender) })),
    fristen: fristen(quellen, von, bis),
    erinnerungen: erinnerungen(rem?.daten, von, bis, wandzeit),
    erinnerungenStand: rem?.at ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  let b: { aktion?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'abgleichen') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  if (!verbunden()) return NextResponse.json({ ok: false, fehler: 'iCloud ist noch nicht verbunden.' }, { status: 409 });
  try {
    const s = await abgleichen({ erzwingen: true });
    return NextResponse.json({ ok: true, stand: s.at, kalender: s.kalender.length });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'iCloud nicht erreichbar.' }, { status: 502 });
  }
}
