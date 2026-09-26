// ─── MAKE OS — Ziele je Planungs-Horizont (lokal) ───────────────────────────
// { monat: Ziel[], quartal: Ziel[], jahr: Ziel[] } — die Zielebene über dem
// Taskmanagement. Aufgaben beantworten „was tue ich", Ziele beantworten
// „woran messe ich den Monat/das Quartal/das Jahr".

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, speicherFuer } from '@/lib/jarvis/raum';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';

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
type ZieleFile = Record<Horizont, Ziel[]> & { fokus?: Partial<Record<FokusHorizont | `prio:${string}`, string>> };

const LEER: ZieleFile = { monat: [], quartal: [], jahr: [], fokus: {} };
const HORIZONTE: Horizont[] = ['monat', 'quartal', 'jahr'];
/** Fokus je Priorität (Malin 26.09.: „die Kreise 1–4“): Schlüssel `prio:<thema>`. */
const FOKUS_SCHLUESSEL = /^(tag|woche|monat|quartal|jahr|prio:[a-z0-9-]{1,40})$/;

/**
 * Wessen Ziele/Fokus (26.09., Kevin: „Malin hat ihre eigenen Ziele, wir haben gemeinsame“):
 * `wir` (Standard, der geteilte Bestand) · `ich` (der eigene) · <speicher> einer Person im
 * Haushalt (nur lesen). Rückgabe: Speichername + ob geschrieben werden darf.
 */
async function speicherFuerAnfrage(req: Request, fuer: string | null): Promise<{ name: string; darfSchreiben: boolean; fuer: string } | null> {
  const ich = personAus(req);
  if (!fuer || fuer === 'wir') return { name: 'ziele', darfSchreiben: true, fuer: 'wir' };
  if (fuer === 'ich' || fuer === ich) return { name: speicherFuer('ziele-eigen', ich), darfSchreiben: true, fuer: ich };
  if (!/^[a-z0-9-]{1,40}$/.test(fuer)) return null;
  const z = await haushaltVon(req);
  if (!z) return null;
  return { name: speicherFuer('ziele-eigen', fuer), darfSchreiben: false, fuer };
}

export async function GET(req: Request) {
  const sp = await speicherFuerAnfrage(req, new URL(req.url).searchParams.get('fuer'));
  if (!sp) return NextResponse.json({ ok: false, error: 'Diese Person gehört nicht zu deinem Haushalt.' }, { status: 403 });
  const f = (await loadJson<ZieleFile>(sp.name)) ?? LEER;
  return NextResponse.json({
    fuer: sp.fuer, darfSchreiben: sp.darfSchreiben,
    monat: Array.isArray(f.monat) ? f.monat : [],
    quartal: Array.isArray(f.quartal) ? f.quartal : [],
    jahr: Array.isArray(f.jahr) ? f.jahr : [],
    // Der Fokus je Horizont — die eine Richtung, gegen die geplant wird.
    fokus: f.fokus && typeof f.fokus === 'object' ? f.fokus : {},
  });
}

/** Einen Horizont komplett setzen (die Seite verwaltet ihre Liste). */
export async function PUT(req: Request) {
  let body: { horizont?: string; ziele?: Ziel[]; fokus?: string; fuer?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sp = await speicherFuerAnfrage(req, body.fuer ?? null);
  if (!sp) return NextResponse.json({ ok: false, error: 'Diese Person gehört nicht zu deinem Haushalt.' }, { status: 403 });
  if (!sp.darfSchreiben) return NextResponse.json({ ok: false, error: 'Den Fokus einer anderen Person kannst du nur lesen.' }, { status: 403 });
  const h = body.horizont;
  const zieleOk = Array.isArray(body.ziele) && HORIZONTE.includes(h as Horizont);
  const fokusOk = typeof body.fokus === 'string' && !!h && FOKUS_SCHLUESSEL.test(h);
  if (!h || (!zieleOk && !fokusOk)) {
    return NextResponse.json({ ok: false, error: 'horizont + ziele (monat|quartal|jahr) oder fokus (tag|woche|monat|quartal|jahr|prio:<thema>) nötig.' }, { status: 400 });
  }
  const sauber = (body.ziele ?? []).slice(0, 20).map(z => ({
    id: z.id || `z-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    titel: String(z.titel ?? '').slice(0, 200),
    fortschritt: Math.max(0, Math.min(100, Math.round(Number(z.fortschritt) || 0))),
    notiz: z.notiz ? String(z.notiz).slice(0, 400) : undefined,
    erledigt: z.erledigt === true,
  })).filter(z => z.titel);

  const next = await updateJson<ZieleFile>(sp.name, current => {
    const basis: ZieleFile = {
      monat: Array.isArray(current?.monat) ? current.monat : [],
      quartal: Array.isArray(current?.quartal) ? current.quartal : [],
      jahr: Array.isArray(current?.jahr) ? current.jahr : [],
      fokus: current?.fokus && typeof current.fokus === 'object' ? current.fokus : {},
    };
    if (zieleOk) basis[h as Horizont] = sauber;
    if (fokusOk) basis.fokus = { ...basis.fokus, [h]: (body.fokus as string).slice(0, 300) } as ZieleFile['fokus'];
    return basis;
  });
  return NextResponse.json({ ok: true, fuer: sp.fuer, ...(zieleOk ? { [h]: next[h as Horizont] } : {}), fokus: next.fokus });
}
