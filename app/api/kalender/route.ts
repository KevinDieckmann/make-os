// ─── Kalender (25.09.) — alles an einem Ort ─────────────────────────────────
// GET ?von=YYYY-MM-DD&bis=YYYY-MM-DD (bis exklusiv, höchstens 120 Tage)
//   → Termine (iCloud direkt, sonst der zugelieferte Mac-Stand), Fristen aus
//     dem System, Apple-Erinnerungen (vom Mac), die Kalender und der Stand.
// POST { aktion: 'abgleichen' } → sofort mit iCloud abgleichen.
// Nur für den Haushalt (Kevin & Malin) und den Dienstweg.
// Seit 29.09. (K1): Termine tragen Art, Farbe, frei/beschäftigt, Sichtbarkeit, Zone, Stand (ETag) und ihren Bezug
// (`kalender-bezug`, lib/kalender/bezug.ts); private Termine der ANDEREN Person kommen nur als „Belegt“ (`maskieren`).
// Fristen tragen `bereich` (privat/business) — die Oberfläche filtert nach Sicht und Bereich.
// Seit R-K1 (#51): `abgleich` = { letzter, vorMin, veraltet (ab 30 Min.), fehler?, anmeldung?, hinweise? } — „letzter
// Abgleich vor X Min.“; übersprungene Kalender (403, gekürzte Antwort) stehen in `hinweise`.
// S1 #20 (29.09.): Apple-Erinnerungen (Mac des Inhabers) nur für den Inhaber, private Fristen nur für Personen mit
// Haushalt — serverseitig (`fuerPersonFiltern`, lib/kalender/eintraege.ts), nicht erst im Browser.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, abgleichen, termineImZeitraum, kontoAnzeige, CACHE, ladeStand, naechsterVersuchFaellig, abgleichAlter } from '@/lib/kalender/icloud';
import { erinnerungen, fuerPersonFiltern } from '@/lib/kalender/eintraege';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { fristenLesen } from '@/lib/kalender/fristen-server';
import { macTermine, type MacEv } from '@/lib/kalender/termine-lesen';
import { ladeEinstellungen, wemGehoert } from '@/lib/kalender/einstellungen';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { SPEICHER as MAC, type Gemerkt } from '@/lib/mac';
import { localDay } from '@/lib/zeit';
import type { Termin } from '@/lib/kalender/ics';
import { ladeBezuege } from '@/lib/kalender/bezug-server';
import { mitBezug, maskieren, type BezugBestand } from '@/lib/kalender/bezug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
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
  let abgleich: ReturnType<typeof abgleichAlter> | undefined;

  if (verbunden()) {
    // Tempo (27.09.): nicht auf iCloud warten — Stand ausliefern, fälligen Abgleich im Hintergrund anstoßen (der Takt hält ihn alle 5 Min. frisch).
    const s0 = await ladeStand();
    let s = s0;
    if (naechsterVersuchFaellig(s0)) { const lauf = abgleichen().catch(() => ladeStand()); if (!s0.at) s = await lauf; else void lauf; }
    termine = termineImZeitraum(s, von, bis);
    stand = s.at ?? null;
    fehler = s.fehler && (!s.at || (s.fehlerAt ?? '') > s.at) ? s.fehler : undefined;
    quelle = s.at ? 'icloud' : 'leer';
    abgleich = abgleichAlter(s);
    kalender = s.kalender.map(k => ({ name: k.name, ...(k.farbe ? { farbe: k.farbe } : {}), schreibbar: k.schreibbar, wer: wemGehoert(einst, k.name) }));
  } else {
    // Ohne iCloud: der zuletzt vom Mac gelieferte Stand — nur lesen, EINE Abbildung (`macTermine`, K6a).
    const c = await loadJson<{ events?: MacEv[]; at?: string }>(CACHE);
    stand = c?.at ?? null;
    quelle = c?.at ? 'mac' : 'leer';
    termine = macTermine(c?.events, von, bis);
    kalender = Array.from(new Set(termine.map(t => t.kalender))).map(name => ({ name, schreibbar: false, wer: wemGehoert(einst, name) }));
  }

  const bezuege: BezugBestand | null = await ladeBezuege().catch(() => null);
  // Fristen: die Quellen lädt EINE Stelle (lib/kalender/fristen-server.ts, K6a) — dieselbe wie Glocke/Heute.
  const [fristenAlle, rem, inhaber, eigenerHaushalt] = await Promise.all([
    fristenLesen(von, bis, heute).catch(() => []),
    loadJson<Gemerkt>(MAC.erinnerungen).catch(() => null),
    istInhaber(zugang.person).catch(() => false),
    haushaltFuer(zugang.person).catch(() => null),
  ]);
  const sicht = fuerPersonFiltern({ fristen: fristenAlle, erinnerungen: erinnerungen(rem?.daten, von, bis, wandzeit) }, { inhaber, privat: !!eigenerHaushalt });

  return NextResponse.json({
    ok: true, von, bis, quelle, stand, ...(fehler ? { fehler } : {}), ...(abgleich ? { abgleich } : {}),
    icloud: verbunden(), konto: kontoAnzeige(),
    kalender, einstellungen: einst,
    // Bezug + Sicherung anwenden, dann für die ansehende Person maskieren (privat der anderen → „Belegt“).
    termine: termine.map(t => maskieren({ ...mitBezug(t, bezuege), wer: wemGehoert(einst, t.kalender) }, zugang.person)),
    fristen: sicht.fristen,
    erinnerungen: sicht.erinnerungen,
    erinnerungenStand: inhaber ? rem?.at ?? null : null,
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
    return NextResponse.json({ ok: true, stand: s.at, kalender: s.kalender.length, ...(s.hinweise?.length ? { hinweise: s.hinweise } : {}) });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'iCloud nicht erreichbar.' }, { status: 502 });
  }
}
