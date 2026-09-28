// ─── MAKE OS — Planung: Business-Einheiten je Haushalt ──────────────────────
// Werteliste für Ziele und Meilensteine im Business (Kevin 27.09.): vorbelegt
// Selbstständigkeit · KD Ventures · Kunden, frei anlegbar. Speicher
// `planung-einheiten--<haushalt>`; ohne Haushalt am Konto der eigene Speicher.
// GET → { einheiten, eigene } · POST { name } → legt an (oder liefert die
// vorhandene Schreibweise). Umbenennen/Löschen bewusst nicht — Ziele tragen den
// Namen als Text; das käme mit einer Stammdaten-Pflege später.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { haushaltFuer, personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { einheitenListe, einheitHinzufuegen, sauberEinheitenDatei, type EinheitenDatei } from '@/lib/planung/einheiten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Speicher der ausdrücklich benannten Person bzw. ihres Haushalts — ohne Person null (Regel 5, kein Rückfall auf „kevin“). */
async function speicher(req: Request): Promise<string | null> {
  const person = personStreng(req);
  if (!person) return null;
  const h = await haushaltFuer(person);
  return h ? `planung-einheiten--${h.haushalt}` : speicherFuer('planung-einheiten', person);
}
const OHNE_PERSON = () => NextResponse.json({ ok: false, error: 'Ohne angemeldete Person keine Einheiten.' }, { status: 401 });

export async function GET(req: Request) {
  const name = await speicher(req);
  if (!name) return OHNE_PERSON();
  const f = sauberEinheitenDatei(await loadJson<EinheitenDatei>(name));
  return NextResponse.json({ einheiten: einheitenListe(f.eigene), eigene: f.eigene });
}

export async function POST(req: Request) {
  const name = await speicher(req);
  if (!name) return OHNE_PERSON();
  let b: { name?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  let einheit: string | null = null;
  const next = await updateJson<EinheitenDatei>(name, cur => {
    const f = sauberEinheitenDatei(cur);
    const r = einheitHinzufuegen(f.eigene, b.name);
    einheit = r.einheit;
    return { eigene: r.eigene };
  });
  if (!einheit) return NextResponse.json({ ok: false, error: 'Name: 2–40 Zeichen, höchstens 30 Einheiten.' }, { status: 400 });
  return NextResponse.json({ ok: true, einheit, einheiten: einheitenListe(next.eigene), eigene: next.eigene });
}
