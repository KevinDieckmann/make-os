// ─── MAKE OS — Netzwerk & Pipeline (Store) ──────────────────────────────────
// Kevins und Malins eigenes Netzwerk: Kontakte und die Chancen daran.
// Bewusst leer beim Start — hier gehören nur echte Menschen rein.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt, Chance, Naehe, Stufe } from '@/lib/make-one/netzwerk-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NetzFile { kontakte: Kontakt[]; chancen: Chance[] }

const NAEHEN: Naehe[] = ['eng', 'warm', 'kalt'];
const STUFEN: Stufe[] = ['kontakt', 'gespraech', 'angebot', 'verhandlung', 'gewonnen', 'verloren'];
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function sauberKontakt(k: Partial<Kontakt>, i: number): Kontakt | null {
  const name = txt(k.name, 120);
  if (!name) return null;
  return {
    id: txt(k.id, 40) || `k-${Date.now().toString(36)}-${i}`,
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

function sauberChance(c: Partial<Chance>, i: number): Chance | null {
  const titel = txt(c.titel, 200);
  const kontaktId = txt(c.kontaktId, 40);
  if (!titel || !kontaktId) return null;
  const wert = Number(c.wert);
  return {
    id: txt(c.id, 40) || `c-${Date.now().toString(36)}-${i}`,
    kontaktId,
    titel,
    stufe: STUFEN.includes(c.stufe as Stufe) ? c.stufe as Stufe : 'kontakt',
    wert: Number.isFinite(wert) && wert > 0 ? Math.round(wert) : undefined,
    naechsterSchritt: txt(c.naechsterSchritt, 300) || undefined,
    faellig: typeof c.faellig === 'string' && DATUM.test(c.faellig) ? c.faellig : undefined,
    notiz: txt(c.notiz, 1000) || undefined,
  };
}

export async function GET() {
  const f = await loadJson<NetzFile>('netzwerk');
  return NextResponse.json({
    kontakte: Array.isArray(f?.kontakte) ? f.kontakte : [],
    chancen: Array.isArray(f?.chancen) ? f.chancen : [],
  });
}

export async function PUT(req: Request) {
  let body: Partial<NetzFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  const next = await updateJson<NetzFile>('netzwerk', current => {
    const kontakte = Array.isArray(body.kontakte)
      ? body.kontakte.slice(0, 2000).map(sauberKontakt).filter((x): x is Kontakt => !!x)
      : (current?.kontakte ?? []);
    const chancen = Array.isArray(body.chancen)
      ? body.chancen.slice(0, 2000).map(sauberChance).filter((x): x is Chance => !!x)
      : (current?.chancen ?? []);

    // Schrumpf-Wächter wie bei Journal/Health: ein Client-Fehler darf das
    // mühsam gepflegte Netzwerk nicht halbieren.
    const alt = current?.kontakte?.length ?? 0;
    if (alt >= 10 && kontakte.length < alt / 2) throw new Error('schrumpf');

    return { kontakte, chancen };
  }).catch((e: Error) => {
    if (e.message === 'schrumpf') return null;
    throw e;
  });

  if (!next) return NextResponse.json({ ok: false, error: 'Das hätte über die Hälfte der Kontakte gelöscht — abgelehnt.' }, { status: 409 });
  return NextResponse.json({ ok: true, ...next });
}
