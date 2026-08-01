// ─── MAKE OS — Ziele je Planungs-Horizont (lokal) ───────────────────────────
// { monat: Ziel[], quartal: Ziel[], jahr: Ziel[] } — die Zielebene über dem
// Taskmanagement. Aufgaben beantworten „was tue ich", Ziele beantworten
// „woran messe ich den Monat/das Quartal/das Jahr".

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Ziel {
  id: string;
  titel: string;
  /** 0–100, von Kevin gepflegt — ehrliche Selbsteinschätzung. */
  fortschritt: number;
  notiz?: string;
  erledigt?: boolean;
}
export type Horizont = 'monat' | 'quartal' | 'jahr';
/** Fokus gibt es feiner als Ziele: auch je Tag und Woche (Kevins Umschalter). */
export type FokusHorizont = 'tag' | 'woche' | 'monat' | 'quartal' | 'jahr';
type ZieleFile = Record<Horizont, Ziel[]> & { fokus?: Partial<Record<FokusHorizont, string>> };

const LEER: ZieleFile = { monat: [], quartal: [], jahr: [], fokus: {} };
const HORIZONTE: Horizont[] = ['monat', 'quartal', 'jahr'];
const FOKUS_HORIZONTE: FokusHorizont[] = ['tag', 'woche', 'monat', 'quartal', 'jahr'];

export async function GET() {
  const f = (await loadJson<ZieleFile>('ziele')) ?? LEER;
  return NextResponse.json({
    monat: Array.isArray(f.monat) ? f.monat : [],
    quartal: Array.isArray(f.quartal) ? f.quartal : [],
    jahr: Array.isArray(f.jahr) ? f.jahr : [],
    // Der Fokus je Horizont — die eine Richtung, gegen die geplant wird.
    fokus: f.fokus && typeof f.fokus === 'object' ? f.fokus : {},
  });
}

/** Einen Horizont komplett setzen (die Seite verwaltet ihre Liste). */
export async function PUT(req: Request) {
  let body: { horizont?: FokusHorizont; ziele?: Ziel[]; fokus?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const h = body.horizont;
  const zieleOk = Array.isArray(body.ziele) && HORIZONTE.includes(h as Horizont);
  const fokusOk = typeof body.fokus === 'string' && !!h && FOKUS_HORIZONTE.includes(h);
  if (!h || (!zieleOk && !fokusOk)) {
    return NextResponse.json({ ok: false, error: 'horizont + ziele (monat|quartal|jahr) oder fokus (tag|woche|monat|quartal|jahr) nötig.' }, { status: 400 });
  }
  const sauber = (body.ziele ?? []).slice(0, 20).map(z => ({
    id: z.id || `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    titel: String(z.titel ?? '').slice(0, 200),
    fortschritt: Math.max(0, Math.min(100, Math.round(Number(z.fortschritt) || 0))),
    notiz: z.notiz ? String(z.notiz).slice(0, 400) : undefined,
    erledigt: z.erledigt === true,
  })).filter(z => z.titel);

  const next = await updateJson<ZieleFile>('ziele', current => {
    const basis: ZieleFile = {
      monat: Array.isArray(current?.monat) ? current.monat : [],
      quartal: Array.isArray(current?.quartal) ? current.quartal : [],
      jahr: Array.isArray(current?.jahr) ? current.jahr : [],
      fokus: current?.fokus && typeof current.fokus === 'object' ? current.fokus : {},
    };
    if (zieleOk) basis[h as Horizont] = sauber;
    if (fokusOk) basis.fokus = { ...basis.fokus, [h]: (body.fokus as string).slice(0, 300) };
    return basis;
  });
  return NextResponse.json({ ok: true, ...(zieleOk ? { [h]: next[h as Horizont] } : {}), fokus: next.fokus });
}
