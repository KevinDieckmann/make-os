// ─── Kontaktformular der Website — intern (31.10., Website-Anbau) ──────────────────────────────────────────────────────────────────────
// GET  → Haushalt des Inhabers mit Person: { aktiv, bereit, gruende, pfad, istInhaber } — keine Eingänge (die stehen als Anfragen im CRM).
// POST { aktiv: boolean } → nur ein Inhaber per Sitzung (Dienstweg 403), mit Bau-Kennung. Einschalten nur mit Verantwortlichem (sonst 409).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber, istDienst, nurHaushalt, nurDerInhaber } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { EINSTELLUNGEN } from '@/lib/kontaktformular/regeln';
import { kontaktformularSchalten, ladeKontaktformularEinstellungen } from '@/lib/kontaktformular/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
/** Öffentliche Adresse des Formulars (auch unter der Website, wenn Caddy den Pfad an die App gibt). */
const PFAD = '/anfrage';

async function gruendeVon(): Promise<string[]> {
  const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
  const { hinweisLaden } = await import('@/lib/check/server');
  return (await hinweisLaden(await ladeCheckEinstellungen())) ? [] : ['Verantwortlicher fehlt (Einstellungen › Datenschutz bzw. Abweichung in den Check-Einstellungen).'];
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const [e, gruende, inhaber] = await Promise.all([ladeKontaktformularEinstellungen(), gruendeVon(), istInhaber(z.person)]);
  return NextResponse.json({ ok: true, aktiv: e.aktiv, bereit: e.aktiv && !gruende.length, gruende, pfad: PFAD, istInhaber: inhaber }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  if (!(await istInhaber(z.person))) return nurDerInhaber();
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 4 * 1024); } catch (x) { return jsonZuGross(x) ?? fehler('Kein JSON.', 400); }
  if (typeof b.aktiv !== 'boolean') return fehler('aktiv: true oder false.', 400);
  if (b.aktiv) { const g = await gruendeVon(); if (g.length) return fehler(g.join(' '), 409); }
  const e = await kontaktformularSchalten(b.aktiv, z.person);
  await protokolliere(EINSTELLUNGEN, [{ op: 'geaendert', id: 'einstellungen', felder: ['aktiv'] }], werAus(req));
  return NextResponse.json({ ok: true, aktiv: e.aktiv, bereit: e.aktiv, gruende: [], pfad: PFAD });
}
