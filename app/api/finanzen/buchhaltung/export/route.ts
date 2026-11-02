// ─── /api/finanzen/buchhaltung/export — Buchungen als CSV je Gesellschaft und Zeitraum (02.11.) ───────────────────────────────────────
// GET ?orte=kdv,ug&von=YYYY-MM-DD&bis=YYYY-MM-DD → CSV (Semikolon + BOM, lib/finanzen/buchhaltung/export.ts). Nur Buchungen von Gesellschaften
// der Sicht (Business-Konto: nur Business-Gesellschaften, serverseitig); Konto nur mit maskierter IBAN. Bewusst KEIN DATEV-Format. Nie der
// Dienstweg (403). Lese-Protokoll Bereich `export` (nur Anzahl).

import { NextResponse } from 'next/server';
import { istDienst, planZugangVon } from '@/lib/zugang/tor';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { istBusinessGesellschaft, istGesellschaft } from '@/lib/einheiten';
import { wirksameSicht } from '@/lib/finanzen/plan/sicht';
import { istKalendertag } from '@/lib/zeit';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { loadJson } from '@/lib/store/local-db';
import { ladeRegister } from '@/lib/finanzen/konten/server';
import { sichtbarIn } from '@/lib/finanzen/konten/register';
import { exportCsv, exportName } from '@/lib/finanzen/buchhaltung/export';
import { buchungenLaden, sichtbarFuer } from '@/lib/finanzen/buchhaltung/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request) {
  if (istDienst(req)) return nein(403, 'Der Export geht nur mit der eigenen Sitzung.');
  const z = await planZugangVon(req);
  if (!z || z.haushalt !== (await haushaltDesInhabers())) return nein(403, 'Kein Zugang zu den Business-Buchungen — sie gehören zum Haushalt des Inhabers.');
  const q = new URL(req.url).searchParams;
  const sicht = wirksameSicht(z.sicht, q.get('sicht'));
  const erlaubt = (o: string) => istGesellschaft(o) && (sicht === 'privat' || istBusinessGesellschaft(o));
  const gewuenscht = (q.get('orte') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (gewuenscht.some(o => !erlaubt(o))) return nein(403, 'Nicht erlaubt: diese Gesellschaft gehört nicht zu deiner Sicht.');
  const von = q.get('von') || undefined, bis = q.get('bis') || undefined;
  if ((von && !istKalendertag(von)) || (bis && !istKalendertag(bis))) return nein(400, 'Zeitraum bitte als YYYY-MM-DD.');
  const orte = new Set(gewuenscht);
  const liste = (await buchungenLaden())
    .filter(b => sichtbarFuer(b, sicht) && !!b.ort && erlaubt(b.ort) && (!orte.size || orte.has(b.ort)) && (!von || b.datum >= von) && (!bis || b.datum <= bis))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const register = await ladeRegister(z.haushalt);
  const kontoIban = new Map(register.konten.filter(k => sichtbarIn(k, sicht) && k.iban).map(k => [k.name, k.iban!]));
  const fp = await loadJson<{ rechnungen?: { id?: string; nummer?: string }[] }>('finanzplan');
  const rechnungNummer = new Map((fp?.rechnungen ?? []).filter(r => r?.id && r.nummer).map(r => [r.id!, r.nummer!]));
  leseZugriff(req, 'export', { anzahl: liste.length });
  const csv = exportCsv(liste, { kontoIban, rechnungNummer });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportName(Array.from(orte), von, bis)}"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    },
  });
}
