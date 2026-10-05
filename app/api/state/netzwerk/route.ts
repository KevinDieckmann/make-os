// ─── MAKE OS — Netzwerk & Pipeline (Store) ──────────────────────────────────
// Kevins und Malins eigenes Netzwerk: Kontakte und die Chancen daran.
// Bewusst leer beim Start — hier gehören nur echte Menschen rein.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt, Chance, Naehe, Stufe } from '@/lib/make-one/netzwerk-data';
import { karteiZugang, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { protokolliereBestand, werAus } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NetzFile { kontakte: Kontakt[]; chancen: Chance[] }

const NAEHEN: Naehe[] = ['eng', 'warm', 'kalt'];
const STUFEN: Stufe[] = ['kontakt', 'gespraech', 'angebot', 'verhandlung', 'gewonnen', 'verloren'];
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sauberKontakt(k: Partial<Kontakt>, _i: number): Kontakt | null {
  const name = txt(k.name, 120);
  if (!name) return null;
  return {
    id: txt(k.id, 40) || neueKennung('k'),
    name,
    firma: txt(k.firma, 120) || undefined,
    rolle: txt(k.rolle, 120) || undefined,
    email: txt(k.email, 160) || undefined,
    telefon: txt(k.telefon, 60) || undefined,
    naehe: NAEHEN.includes(k.naehe as Naehe) ? k.naehe as Naehe : 'kalt',
    quelle: txt(k.quelle, 160) || undefined,
    notizen: txt(k.notizen, 4000) || undefined,
    letzterKontakt: typeof k.letzterKontakt === 'string' && DATUM.test(k.letzterKontakt) ? k.letzterKontakt : undefined,
    besitzer: (['kevin', 'malin', 'beide'] as const).includes(k.besitzer as 'kevin') ? k.besitzer as Kontakt['besitzer'] : 'kevin',
    stichworte: Array.isArray(k.stichworte) ? k.stichworte.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 12) : undefined,
  };
}

function sauberChance(c: Partial<Chance>, _i: number): Chance | null {
  const titel = txt(c.titel, 200);
  const kontaktId = txt(c.kontaktId, 40);
  if (!titel || !kontaktId) return null;
  const wert = Number(c.wert);
  return {
    id: txt(c.id, 40) || neueKennung('c'),
    kontaktId,
    titel,
    stufe: STUFEN.includes(c.stufe as Stufe) ? c.stufe as Stufe : 'kontakt',
    wert: Number.isFinite(wert) && wert > 0 ? Math.round(wert) : undefined,
    naechsterSchritt: txt(c.naechsterSchritt, 300) || undefined,
    faellig: typeof c.faellig === 'string' && DATUM.test(c.faellig) ? c.faellig : undefined,
    notiz: txt(c.notiz, 1000) || undefined,
  };
}

export async function GET(req: Request) {
  // Haushalt des Inhabers (28.09., K1 #66/#67).
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const f = await loadJson<NetzFile>('netzwerk');
  return NextResponse.json({
    kontakte: Array.isArray(f?.kontakte) ? f.kontakte : [],
    chancen: Array.isArray(f?.chancen) ? f.chancen : [],
  });
}

export async function PUT(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  let body: Partial<NetzFile>;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Mehr als 2000 je Liste: ablehnen, nie still kürzen (28.09., K1).
  if ((Array.isArray(body.kontakte) && body.kontakte.length > 2000) || (Array.isArray(body.chancen) && body.chancen.length > 2000)) return NextResponse.json({ ok: false, error: 'Abgelehnt: höchstens 2000 Kontakte bzw. Chancen. Nichts gespeichert.' }, { status: 413 });

  let vorher: NetzFile | null = null;
  const next = await updateJson<NetzFile>('netzwerk', current => {
    vorher = current;
    const kontakte = Array.isArray(body.kontakte)
      ? body.kontakte.map(sauberKontakt).filter((x): x is Kontakt => !!x)
      : (current?.kontakte ?? []);
    const chancen = Array.isArray(body.chancen)
      ? body.chancen.map(sauberChance).filter((x): x is Chance => !!x)
      : (current?.chancen ?? []);

    // Schrumpf-Wächter: ein Client-Fehler darf weder das mühsam gepflegte
    // Netzwerk noch die Pipeline halbieren.
    const alt = current?.kontakte?.length ?? 0;
    if (alt >= 10 && kontakte.length < alt / 2) throw new Error('schrumpf');
    const altC = current?.chancen?.length ?? 0;
    if (altC >= 4 && chancen.length < altC / 2) throw new Error('schrumpf');

    return { kontakte, chancen };
  }).catch((e: Error) => {
    if (e.message === 'schrumpf') return null;
    throw e;
  });

  if (!next) return NextResponse.json({ ok: false, error: 'Das hätte über die Hälfte der Kontakte gelöscht — abgelehnt.' }, { status: 409 });
  // Änderungsprotokoll (28.09., K1 #44): nur Kennungen und Feldnamen.
  await protokolliereBestand('netzwerk', vorher, next, werAus(req));
  return NextResponse.json({ ok: true, ...next });
}

/**
 * Zu zweit (24.09.): Einzeländerungen statt ganzer Listen —
 * { ops: [{ liste: 'kontakte' | 'chancen', op: 'upsert' | 'delete', eintrag?, id? }] }.
 * Was der andere inzwischen an anderen Einträgen geändert hat, bleibt erhalten.
 */
export async function PATCH(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  let body: { ops?: ListenOp[] };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Mehr als 500 auf einmal: ablehnen, nie still kürzen (28.09., K1).
  if (Array.isArray(body.ops) && body.ops.length > 500) return NextResponse.json({ ok: false, error: `Abgelehnt: ${body.ops.length} Änderungen auf einmal — höchstens 500.` }, { status: 413 });
  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return NextResponse.json({ ok: true, angewandt: 0 });
  let angewandt = 0;
  let vorher: NetzFile | null = null;
  const next = await updateJson<NetzFile>('netzwerk', current => {
    vorher = current;
    const f = { kontakte: current?.kontakte ?? [], chancen: current?.chancen ?? [] };
    const k = wendeAn(f.kontakte as unknown as Record<string, unknown>[], ops.filter(o => o.liste === 'kontakte'), 'id', r => sauberKontakt(r as Partial<Kontakt>, 0) as unknown as Record<string, unknown> | null);
    const c = wendeAn(f.chancen as unknown as Record<string, unknown>[], ops.filter(o => o.liste === 'chancen'), 'id', r => sauberChance(r as Partial<Chance>, 0) as unknown as Record<string, unknown> | null);
    angewandt = k.angewandt + c.angewandt;
    return { kontakte: k.liste as unknown as Kontakt[], chancen: c.liste as unknown as Chance[] };
  });
  await protokolliereBestand('netzwerk', vorher, next, werAus(req));
  return NextResponse.json({ ok: true, angewandt, stand: next });
}
