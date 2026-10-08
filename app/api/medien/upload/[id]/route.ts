// ─── Medien: eine Upload-Sitzung (09.10., Paket 5) — Stand, Stücke, Vorschau, Abschluss, Abbruch ───────────────────────────
// GET     Stand (welche Stücke fehlen — Weitermachen nach Abbruch oder Neuladen)
// PUT     ?teil=<n>               ein Stück (roh, genau 8 MiB bzw. der Rest; Kopf `x-make-sha256`) — verschlüsselt weitergereicht
//         ?variante=raster|ansicht|poster   Vorschaubild (JPEG/PNG ≤ 2 MB)
// POST    { pruefsumme }          abschließen (SHA-256 über die Stück-Prüfsummen) → Eintrag im Katalog
// DELETE  abbrechen
// Nur die Person, der die Sitzung gehört (sonst 404 — fremde Sitzungen „gibt es nicht“), nie der Dienstweg (403).
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { MEDIEN_NUR_SELBST } from '@/lib/agenten/typen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { GRENZEN } from '@/lib/medien/typen';
import { uploadStand, teilAnnehmen, vorschauAnnehmen, uploadFertig, uploadAbbrechen } from '@/lib/medien/upload-server';
import { antwort, fehler, rohBegrenzt, AnfrageZuGross } from '@/lib/medien/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const z = await eigenePerson(req, false, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return antwort(await uploadStand(z.person, (await ctx.params).id) as Parameters<typeof antwort>[0]);
}

export async function PUT(req: Request, ctx: Ctx) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const variante = q.get('variante');
  try {
    if (variante) return antwort(await vorschauAnnehmen(z.person, id, variante, await rohBegrenzt(req, GRENZEN.vorschau)) as Parameters<typeof antwort>[0]);
    const nr = Number(q.get('teil'));
    if (!Number.isInteger(nr) || nr < 0) return fehler(400, 'Stück-Nummer fehlt (?teil=).');
    return antwort(await teilAnnehmen(z.person, id, nr, await rohBegrenzt(req, GRENZEN.teil), req.headers.get('x-make-sha256')) as Parameters<typeof antwort>[0]);
  } catch (e) {
    if (e instanceof AnfrageZuGross) return fehler(413, variante ? 'Vorschau höchstens 2 MB.' : 'Ein Stück hat höchstens 8 MiB.');
    console.error('[medien] Stück:', e instanceof Error ? e.message : e);
    return fehler(500, 'Das Stück konnte nicht gespeichert werden — es wird erneut versucht.');
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let a: Record<string, unknown>;
  try { a = await jsonBegrenzt(req, 16 * 1024); }
  catch (e) { return jsonZuGross(e) ?? fehler(400, 'Ungültige Anfrage.'); }
  return antwort(await uploadFertig(z.person, (await ctx.params).id, a ?? {}) as Parameters<typeof antwort>[0]);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return antwort(await uploadAbbrechen(z.person, (await ctx.params).id) as Parameters<typeof antwort>[0]);
}
