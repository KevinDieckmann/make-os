// ─── MAKE OS — Meilensteine (lokal, pflegbar) ───────────────────────────────
// Vorher eine feste Konstante — jetzt DIE Datenbasis: jeder Meilenstein hat
// Fälligkeit, Messlatte („woran erkennen wir fertig?") und Fortschritt.
// bereich='business' fließt in Brain + Business-Säule, 'gesundheit' in die
// Gesundheits-Säule — und bleibt aus Business-Kontexten draußen (Privatsphäre).

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Meilenstein {
  id: string;
  titel: string;
  bereich: 'business' | 'gesundheit';
  /** Fester Tag YYYY-MM-DD … */
  faellig?: string;
  /** … oder freies Zeitfenster („Q3", „2028"). */
  zeitfenster?: string;
  /** Woran wird „fertig" gemessen? Macht den Meilenstein überprüfbar. */
  messlatte?: string;
  /** 0–100, ehrlich gepflegt. */
  fortschritt: number;
  erledigt: boolean;
  erledigtAm?: string;
}
interface MeilensteinFile { meilensteine: Meilenstein[] }

// Startbestand: Miro „Kevin & Frank" (Business) + Kevins echte Gesundheits-
// Etappen. Erledigtes bleibt sichtbar — der Weg zählt.
const SEED: Meilenstein[] = [
  { id: 'ms-kdm-ug', titel: 'KD Management UG gegründet', bereich: 'business', faellig: '2026-06-25', fortschritt: 100, erledigt: true, erledigtAm: '2026-06-25' },
  { id: 'ms-capos-v1', titel: 'CapOS v1.0 live', bereich: 'business', faellig: '2026-06-25', fortschritt: 100, erledigt: true, erledigtAm: '2026-06-25' },
  { id: 'ms-landingpage', titel: 'Landingpage F&F live', bereich: 'business', faellig: '2026-07-03', fortschritt: 100, erledigt: true, erledigtAm: '2026-07-03' },
  { id: 'ms-ig', titel: 'KEMARIS Innovation GmbH / IG gegründet', bereich: 'business', faellig: '2026-07-28', fortschritt: 100, erledigt: true, erledigtAm: '2026-07-28' },
  { id: 'ms-ff-launch', titel: 'F&F-Launch', bereich: 'business', faellig: '2026-08-01', messlatte: '30 Testkunden onboarded', fortschritt: 60, erledigt: false },
  { id: 'ms-capos-gmbh', titel: 'CapOS GmbH Gründung', bereich: 'business', faellig: '2026-09-30', fortschritt: 0, erledigt: false },
  { id: 'ms-volllaunch', titel: 'Volllaunch + Pressekonferenz Zoo Palais', bereich: 'business', faellig: '2026-10-01', fortschritt: 0, erledigt: false },
  { id: 'ms-podcast', titel: 'KEMARIS Podcast', bereich: 'business', zeitfenster: 'Q3', fortschritt: 0, erledigt: false },
  { id: 'ms-magazin', titel: 'KEMARIS Magazin', bereich: 'business', zeitfenster: 'Q4', fortschritt: 0, erledigt: false },
  { id: 'ms-breakeven', titel: 'Break-even CapOS', bereich: 'business', zeitfenster: '2028', fortschritt: 0, erledigt: false },
  { id: 'ms-g-infiltration', titel: 'Rücken: Infiltration wahrgenommen', bereich: 'gesundheit', faellig: '2026-07-31', messlatte: 'Termin wahrgenommen, Plan mit Arzt besprochen', fortschritt: 0, erledigt: false },
  { id: 'ms-g-cannabis', titel: 'Cannabis-Cut durchgehalten', bereich: 'gesundheit', faellig: '2026-08-30', messlatte: '30 Tage ohne — Start 31.07', fortschritt: 0, erledigt: false },
  { id: 'ms-g-reha', titel: 'Reha Stufe 1 etabliert', bereich: 'gesundheit', faellig: '2026-08-14', messlatte: '14 Tage in Folge täglich ein Reha-Block', fortschritt: 0, erledigt: false },
  { id: 'ms-g-schlaf', titel: 'Schlaf stabil', bereich: 'gesundheit', zeitfenster: 'August', messlatte: 'Ø ≥ 7 h über 14 Tage (Whoop)', fortschritt: 0, erledigt: false },
];

function sauberListe(rein: unknown): Meilenstein[] {
  return (Array.isArray(rein) ? rein : []).slice(0, 60).map((m: Partial<Meilenstein>) => ({
    id: String(m.id ?? '').slice(0, 40) || `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    titel: String(m.titel ?? '').slice(0, 200),
    bereich: (m.bereich === 'gesundheit' ? 'gesundheit' : 'business') as Meilenstein['bereich'],
    faellig: typeof m.faellig === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.faellig) ? m.faellig : undefined,
    zeitfenster: m.zeitfenster ? String(m.zeitfenster).slice(0, 40) : undefined,
    messlatte: m.messlatte ? String(m.messlatte).slice(0, 300) : undefined,
    fortschritt: isFinite(Number(m.fortschritt)) ? Math.max(0, Math.min(100, Math.round(Number(m.fortschritt)))) : 0,
    erledigt: m.erledigt === true,
    erledigtAm: typeof m.erledigtAm === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.erledigtAm) ? m.erledigtAm : undefined,
  })).filter(m => m.titel);
}

export async function GET() {
  let f = await loadJson<MeilensteinFile>('meilensteine');
  if (!f || !Array.isArray(f.meilensteine) || !f.meilensteine.length) {
    f = await updateJson<MeilensteinFile>('meilensteine', () => ({ meilensteine: SEED }));
  }
  return NextResponse.json({ meilensteine: f.meilensteine });
}

export async function PUT(req: Request) {
  let body: { meilensteine?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sauber = sauberListe(body.meilensteine);
  if (!sauber.length) return NextResponse.json({ ok: false, error: 'meilensteine darf nicht leer sein.' }, { status: 400 });
  const next = await updateJson<MeilensteinFile>('meilensteine', () => ({ meilensteine: sauber }));
  return NextResponse.json({ ok: true, meilensteine: next.meilensteine });
}
