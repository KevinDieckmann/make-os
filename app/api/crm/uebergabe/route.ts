// ─── Markttraktion — Übergabe an Kevin oder Malin ───────────────────────────
// POST { art, id | ids, an, notiz?, frist? }
//   art: kontakt · kontakte (bis 300, z. B. „Kevin verteilt an Malin“) · chance ·
//        mandat · event · kampagne · beitrag · newsletter
//   an:  kevin · malin · beide
// Wirkung: Zuständigkeit wechselt (Kontakt: „Hält die Beziehung“, Chance:
// besitzer, sonst zustaendig), am Kontakt steht die Übergabe im Verlauf, mit
// Notiz und Frist wird sie dort zum nächsten Schritt (→ Power Hour der
// anderen Person). Und die andere Person bekommt eine Aufgabe mit Link.
// Nichts wird versendet.

import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { uebergeben, type UebergabeEingabe } from '@/lib/crm/uebergabe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: UebergabeEingabe;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await uebergeben(b, personAus(req));
  return r.ok ? NextResponse.json(r) : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
}
