// ─── MAKE OS — Liquiditäts-Planung ──────────────────────────────────────────
// Was regelmäßig rein- und rausgeht, und was einmalig ansteht. Die Vorschau
// rechnet daraus zusammen mit Kontoständen, Rechnungen und Zahlungen.
//
// Bewusst getrennt vom Finanzplan: dort steht, was IST (offene Rechnungen,
// fällige Zahlungen) — hier steht, was ERWARTET wird.

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt, updateJson } from '@/lib/store/local-db';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Business-Zahlen gehören zum Haushalt des Inhabers — wie der Business-Index (26.09.).
const KEIN_HAUSHALT = { ok: false, error: 'Kein Zugang zu den Business-Zahlen — sie gehören zum Haushalt des Inhabers (System → Konto).' };

export type Rhythmus = 'einmalig' | 'monatlich' | 'quartal' | 'jaehrlich';
export interface Planposten {
  id: string;
  titel: string;
  /** Positiv = kommt rein, negativ = geht raus. */
  betrag: number;
  rhythmus: Rhythmus;
  /** Ab wann er zählt (YYYY-MM-DD). Bei einmalig: das Datum selbst. */
  ab: string;
  /** Optional: ab wann er wegfällt. */
  bis?: string;
  /** Wie sicher ist der Posten? Unsicheres wird in der Vorschau getrennt gezeigt. */
  sicher: boolean;
  notiz?: string;
  /** Wessen Geld — kdv | kdc | privat. Damit lässt sich je Firma planen. */
  firmaId?: string;
  /** Wofür — Personal, Miete, Steuern … für die Aufschlüsselung. */
  kategorie?: string;
  /** Nur im schlechten Fall (0) bis sicher (100) — für die Szenarien. */
  wahrscheinlich?: number;
  /** Dieser (eigene) Posten ersetzt einen importierten Plan-Posten — der
   *  Excel-Import legt den ersetzten dann nicht wieder an. */
  ersetzt?: string;
}
interface Datei { posten: Planposten[] }

const RHYTHMEN: Rhythmus[] = ['einmalig', 'monatlich', 'quartal', 'jaehrlich'];
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const FIRMEN = ['kdv', 'kdc', 'kemaris', 'privat'];

function sauber(p: Partial<Planposten>, i: number): Planposten | null {
  const titel = String(p.titel ?? '').trim().slice(0, 160);
  if (!titel) return null;
  const betrag = Math.round(Number(p.betrag));
  if (!Number.isFinite(betrag) || betrag === 0) return null;
  return {
    id: String(p.id ?? '').slice(0, 40) || `lp-${Date.now().toString(36)}-${i}`,
    titel,
    betrag,
    rhythmus: RHYTHMEN.includes(p.rhythmus as Rhythmus) ? p.rhythmus as Rhythmus : 'monatlich',
    ab: typeof p.ab === 'string' && DATUM.test(p.ab) ? p.ab : new Date().toISOString().slice(0, 10),
    bis: typeof p.bis === 'string' && DATUM.test(p.bis) ? p.bis : undefined,
    sicher: p.sicher !== false,
    notiz: p.notiz ? String(p.notiz).slice(0, 300) : undefined,
    firmaId: FIRMEN.includes(String(p.firmaId)) ? String(p.firmaId) : undefined,
    kategorie: p.kategorie ? String(p.kategorie).trim().slice(0, 40) : undefined,
    wahrscheinlich: Number.isFinite(Number(p.wahrscheinlich))
      ? Math.max(0, Math.min(100, Math.round(Number(p.wahrscheinlich))))
      : undefined,
    ersetzt: p.ersetzt ? String(p.ersetzt).slice(0, 60) : undefined,
  };
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const f = await loadJson<Datei>('liquiplan');
  return NextResponse.json({ posten: Array.isArray(f?.posten) ? f.posten : [] });
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  let body: Partial<Datei>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.posten)) return NextResponse.json({ ok: false, error: 'posten fehlt.' }, { status: 400 });

  const posten = body.posten.slice(0, 200).map(sauber).filter((x): x is Planposten => !!x);
  const { ok, next } = await updateGeschuetzt<Datei>('liquiplan', { posten }, d => d.posten?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Planposten gelöscht.' }, { status: 409 });
  return NextResponse.json({ ok: true, ...next });
}

/**
 * Zu zweit (24.09.): Einzeländerungen — { ops: [{ liste: 'posten', op, eintrag?, id? }] }.
 * Vorher schrieb die Seite die ganze Liste; wer zuletzt tippte, überschrieb den anderen.
 */
export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  let body: { ops?: ListenOp[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = (Array.isArray(body.ops) ? body.ops : []).filter(o => o.liste === 'posten').slice(0, 300);
  if (!ops.length) return NextResponse.json({ ok: true, angewandt: 0 });
  let angewandt = 0;
  const next = await updateJson<Datei>('liquiplan', current => {
    const r = wendeAn((current?.posten ?? []) as unknown as Record<string, unknown>[], ops, 'id', roh => sauber(roh as Partial<Planposten>, 0) as unknown as Record<string, unknown> | null);
    angewandt = r.angewandt;
    return { posten: (r.liste as unknown as Planposten[]).slice(0, 200) };
  });
  return NextResponse.json({ ok: true, angewandt, stand: next });
}
