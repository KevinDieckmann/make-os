// ─── MAKE OS — Bank-Buchungen ───────────────────────────────────────────────
// Was auf den Konten wirklich passiert ist. Kommt aus dem Finanz-Dashboard,
// das Kevin und Malin gebaut haben — hier liegt es als eigener Bestand, damit
// das System damit rechnen kann statt nur anzuzeigen.

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Buchung {
  id: string;
  /** YYYY-MM-DD */
  datum: string;
  /** Wer — Empfänger oder Absender. */
  wer: string;
  /** Betrag in Euro; positiv = Eingang, negativ = Ausgang. */
  betrag: number;
  kategorie: string;
  /** Verwendungszweck, gekürzt. */
  zweck?: string;
  konto?: string;
  /**
   * Wo die Buchung hingehört. Kevins Ansage: „Privat bleibt immer privat, die
   * beiden Firmen kann man auch mal zusammenfassen." Genau dafür.
   */
  ort?: 'privat' | 'kdv' | 'kdc';
  /** Die Rechnung, deren Zahlungseingang diese Buchung ist (26.09.). */
  rechnungId?: string;
}

// Nicht exportieren: eine Route darf nur ihre Handler nach außen geben.
const ORTE = ['privat', 'kdv', 'kdc'] as const;
interface Datei { buchungen: Buchung[] }

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function sauber(b: Partial<Buchung>, i: number): Buchung | null {
  const wer = String(b.wer ?? '').trim().slice(0, 120);
  const betrag = Math.round(Number(b.betrag));
  if (!wer || !Number.isFinite(betrag)) return null;
  return {
    id: String(b.id ?? '').slice(0, 40) || `bu-${Date.now().toString(36)}-${i}`,
    datum: typeof b.datum === 'string' && DATUM.test(b.datum) ? b.datum : new Date().toISOString().slice(0, 10),
    wer,
    betrag,
    kategorie: String(b.kategorie ?? 'Sonstiges').trim().slice(0, 60) || 'Sonstiges',
    zweck: b.zweck ? String(b.zweck).slice(0, 200) : undefined,
    konto: b.konto ? String(b.konto).slice(0, 60) : undefined,
    // Ohne Angabe: privat — die Altbestände kommen alle vom Privatkonto.
    ort: (ORTE as readonly string[]).includes(String(b.ort)) ? b.ort as Buchung['ort'] : 'privat',
    ...(b.rechnungId ? { rechnungId: String(b.rechnungId).slice(0, 40) } : {}),
  };
}

export async function GET() {
  const f = await loadJson<Datei>('buchungen');
  const buchungen = Array.isArray(f?.buchungen) ? f.buchungen : [];
  return NextResponse.json({ buchungen, anzahl: buchungen.length });
}

export async function PUT(req: Request) {
  let body: Partial<Datei>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.buchungen)) return NextResponse.json({ ok: false, error: 'buchungen fehlt.' }, { status: 400 });

  const buchungen = body.buchungen.slice(0, 5000).map(sauber).filter((x): x is Buchung => !!x)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const { ok, next } = await updateGeschuetzt<Datei>('buchungen', { buchungen }, d => d.buchungen?.length ?? 0);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Buchungen gelöscht.' }, { status: 409 });
  return NextResponse.json({ ok: true, anzahl: next.buchungen.length });
}

/**
 * Einzelne Buchungen ändern statt der ganzen Liste.
 *
 * Das Zwei-Fenster-Fundament für die Finanzen: Malin führt die Buchhaltung,
 * Kevin bucht nebenher Belege über Jarvis — vorher schrieb jeder Weg ALLE
 * Buchungen zurück, und wer zuletzt speicherte, löschte still die Erfassung
 * des anderen. Jetzt geht nur noch raus, was ein Fenster selbst geändert hat.
 */
export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = Array.isArray(body.ops) ? body.ops.slice(0, 200) : null;
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });

  interface Op { op: 'upsert' | 'delete'; buchung?: Buchung; id?: string }
  const ops: Op[] = [];
  const liste = roh as Record<string, unknown>[];
  for (let i = 0; i < liste.length; i++) {
    const o = liste[i];
    if (o?.op === 'delete' && typeof o.id === 'string') ops.push({ op: 'delete', id: o.id });
    else if (o?.op === 'upsert' && o.buchung) {
      const s = sauber(o.buchung as Partial<Buchung>, i);
      if (s) ops.push({ op: 'upsert', buchung: s });
    }
  }
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  // Sicherung gegen Massenlöschung: auch über Einzel-Änderungen darf nicht die
  // halbe Buchhaltung verschwinden.
  const vorher = await loadJson<Datei>('buchungen');
  const bestand = Array.isArray(vorher?.buchungen) ? vorher.buchungen.length : 0;
  const loeschungen = ops.filter(o => o.op === 'delete').length;
  if (bestand >= 10 && loeschungen > bestand / 2) {
    return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Buchungen gelöscht.' }, { status: 409 });
  }

  let angewandt = 0;
  const next = await updateJson<Datei>('buchungen', current => {
    const liste = Array.isArray(current?.buchungen) ? current!.buchungen : [];
    const nachId = new Map(liste.map(b => [b.id, b]));
    for (const o of ops) {
      if (o.op === 'delete') { if (nachId.delete(o.id!)) angewandt++; }
      else { nachId.set(o.buchung!.id, o.buchung!); angewandt++; }
    }
    return { buchungen: Array.from(nachId.values()).sort((a, b) => b.datum.localeCompare(a.datum)) };
  });
  return NextResponse.json({ ok: true, angewandt, anzahl: next.buchungen.length });
}
