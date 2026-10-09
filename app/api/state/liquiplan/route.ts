// ─── MAKE OS — Liquiditäts-Planung ──────────────────────────────────────────
// Was regelmäßig rein- und rausgeht, und was einmalig ansteht. Die Vorschau
// rechnet daraus zusammen mit Kontoständen, Rechnungen und Zahlungen.
//
// Bewusst getrennt vom Finanzplan: dort steht, was IST (offene Rechnungen,
// fällige Zahlungen) — hier steht, was ERWARTET wird.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { privatFinanzZugang, keinFinanzZugang } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt, updateJson } from '@/lib/store/local-db';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';

import { localDay } from '@/lib/zeit';
import { istFinanzOrt, istRegisterKennung } from '@/lib/einheiten';
import { neueKennung } from '@/lib/kennung';
import { werAus, protokolliereBestand } from '@/lib/store/aenderungsprotokoll';
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
  /** Wessen Geld — privat oder eine Gesellschaft (lib/einheiten.ts, auch `g-…` aus dem Register). Damit lässt sich je Firma planen. */
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
/**
 * Zulässige `firmaId`: privat, die festen Gesellschaften (09.10.: auch `ug` — vorher fiel sie hier still weg), eine
 * Register-Gesellschaft `g-…` — und ein Altwert früherer fester Zuordnungen (kurze Kennung aus Buchstaben/Ziffern): der bleibt
 * stehen und zählt wie jede unbekannte Firma als Business (`bereichVonFirma`). Keine Firma steht mehr als Text im Code.
 */
const ALTKENNUNG = /^[a-z][a-z0-9]{1,23}$/;
const firmaIdSauber = (v: unknown): string | undefined =>
  typeof v === 'string' && (istFinanzOrt(v) || istRegisterKennung(v) || ALTKENNUNG.test(v)) ? v : undefined;

function sauber(p: Partial<Planposten>, _i: number): Planposten | null {
  const titel = String(p.titel ?? '').trim().slice(0, 160);
  if (!titel) return null;
  const betrag = Math.round(Number(p.betrag));
  if (!Number.isFinite(betrag) || betrag === 0) return null;
  return {
    id: String(p.id ?? '').slice(0, 40) || neueKennung('lp'),
    titel,
    betrag,
    rhythmus: RHYTHMEN.includes(p.rhythmus as Rhythmus) ? p.rhythmus as Rhythmus : 'monatlich',
    ab: typeof p.ab === 'string' && DATUM.test(p.ab) ? p.ab : localDay(),
    bis: typeof p.bis === 'string' && DATUM.test(p.bis) ? p.bis : undefined,
    sicher: p.sicher !== false,
    notiz: p.notiz ? String(p.notiz).slice(0, 300) : undefined,
    firmaId: firmaIdSauber(p.firmaId),
    kategorie: p.kategorie ? String(p.kategorie).trim().slice(0, 40) : undefined,
    wahrscheinlich: Number.isFinite(Number(p.wahrscheinlich))
      ? Math.max(0, Math.min(100, Math.round(Number(p.wahrscheinlich))))
      : undefined,
    ersetzt: p.ersetzt ? String(p.ersetzt).slice(0, 60) : undefined,
  };
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  if (!(await privatFinanzZugang(req))) return keinFinanzZugang();
  const f = await loadJson<Datei>('liquiplan');
  return NextResponse.json({ posten: Array.isArray(f?.posten) ? f.posten : [] });
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  if (!(await privatFinanzZugang(req))) return keinFinanzZugang();
  let body: Partial<Datei>;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.posten)) return NextResponse.json({ ok: false, error: 'posten fehlt.' }, { status: 400 });

  if (body.posten.length > MAX_POSTEN) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_POSTEN} Planposten (geschickt: ${body.posten.length}) — gekürzt wird nie.` }, { status: 413 });
  const posten = body.posten.map(sauber).filter((x): x is Planposten => !!x);
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
  if (!(await privatFinanzZugang(req))) return keinFinanzZugang();
  let body: { ops?: ListenOp[] };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Nie still kürzen (09.10., „ZOE-Schreibwege“ — ZOE schreibt seither über diesen Weg): zu viele Änderungen bzw. Posten → 413, nichts geschrieben.
  const roh = (Array.isArray(body.ops) ? body.ops : []).filter(o => o.liste === 'posten');
  if (roh.length > MAX_OPS) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_OPS} Änderungen je Aufruf (geschickt: ${roh.length}).` }, { status: 413 });
  const ops = roh;
  if (!ops.length) return NextResponse.json({ ok: true, angewandt: 0 });
  let angewandt = 0;
  let zuViele = 0;
  let vorher: Datei | null = null;
  const next = await updateJson<Datei>('liquiplan', current => {
    vorher = current ?? null;
    const r = wendeAn((current?.posten ?? []) as unknown as Record<string, unknown>[], ops, 'id', roh => sauber(roh as Partial<Planposten>, 0) as unknown as Record<string, unknown> | null);
    const liste = r.liste as unknown as Planposten[];
    // Über der Grenze und gewachsen: ablehnen, den Bestand unverändert lassen (ein Altbestand darüber bleibt bearbeitbar).
    if (liste.length > MAX_POSTEN && liste.length > (current?.posten?.length ?? 0)) { zuViele = liste.length; return current ?? { posten: [] }; }
    angewandt = r.angewandt;
    return { posten: liste };
  });
  if (zuViele) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_POSTEN} Planposten (jetzt wären es ${zuViele}). Erst Erledigtes aufräumen — gekürzt wird nie.` }, { status: 413 });
  // Änderungsprotokoll (09.10.): Kennungen + Feldnamen, nie Werte.
  await protokolliereBestand('liquiplan', vorher, next, werAus(req));
  return NextResponse.json({ ok: true, angewandt, stand: next });
}

/** Höchstzahl Planposten — darüber wird abgelehnt (413), nie gekürzt (09.10.; vorher schnitt der PATCH still bei 200 ab). */
const MAX_POSTEN = 200;
/** Höchstzahl Einzeländerungen je PATCH — darüber 413 statt still nur die ersten 300. */
const MAX_OPS = 300;
