// ─── Finanzplanung jetzt: Startbestand hochladen oder leer beginnen ──────────
// POST multipart  datei=<finanzen-plan.json v3> [ersetzen=true]
// POST JSON       { dokument, ersetzen? }  oder  { leer: true, ersetzen? }
// Das Format wird strikt geprüft (version 3, szenarien, annahmen, Zeitachse).
// Ein vorhandenes Dokument wird nur mit ausdrücklichem `ersetzen` überschrieben,
// sonst 409. Echte Zahlen bleiben auf dem Server — nie im Repo.

import { NextResponse } from 'next/server';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { importieren } from '@/lib/finanzen/plan/speicher';
import { pruefeDokument, leeresDokument } from '@/lib/finanzen/plan/operationen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zur Finanzplanung. Der Inhaber trägt den Haushalt unter System → Konto ein.' };
const MAX_BYTES = 8_000_000;
const ja = (v: unknown) => v === true || v === 'true' || v === '1' || v === 1;

export async function POST(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (zuGross(req, MAX_BYTES)) return ZU_GROSS(MAX_BYTES);
  const url = new URL(req.url);
  let ersetzen = ja(url.searchParams.get('ersetzen'));
  let roh: unknown; let quelle = 'Datei';
  const art = req.headers.get('content-type') ?? '';
  try {
    if (art.includes('multipart/form-data')) {
      const form = await req.formData();
      const f = form.get('datei');
      ersetzen = ersetzen || ja(form.get('ersetzen'));
      if (!(f instanceof File)) return NextResponse.json({ ok: false, fehler: 'Keine Datei angekommen (Feld „datei“).' }, { status: 400 });
      if (f.size > MAX_BYTES) return ZU_GROSS(MAX_BYTES);
      quelle = f.name || 'Datei';
      roh = JSON.parse(await f.text());
    } else {
      const b = (await req.json()) as { dokument?: unknown; leer?: unknown; ersetzen?: unknown };
      ersetzen = ersetzen || ja(b.ersetzen);
      if (ja(b.leer)) { roh = leeresDokument(heuteBerlin()); quelle = 'leer begonnen'; }
      else { roh = b.dokument; quelle = 'Dokument'; }
    }
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Die Datei ist kein lesbares JSON.' }, { status: 400 });
  }
  const p = pruefeDokument(roh);
  if (!p.ok) return NextResponse.json({ ok: false, fehler: `Format passt nicht: ${p.fehler}` }, { status: 400 });
  const e = await importieren(z.haushalt, p.dokument, ersetzen, z.person, quelle);
  return NextResponse.json(e, { status: e.ok ? 200 : e.status });
}
