// ─── WhatsApp — Zustand der Verbindung für die Karte unter Verbindungen (07.10.2026) ────────────────────────────────────
// GET  → WhatsappStatus: eingerichtet? (sonst nur die NAMEN fehlender Variablen + Webhook-Adresse für die Anleitung) · Nummer,
//        Anzeigename, Qualität, Durchsatz (Cache 15 Min.) · Webhook zuletzt empfangen · Zustand des Schlüssels. Nie Schlüssel/Geheimnisse.
// POST { aktion: 'pruefen' } → sofort bei Meta nachsehen („Verbindung prüfen“).
// Nur die angemeldete Person im Haushalt des Inhabers (`eigenePerson`, Dienstweg 403); Einzelheiten nur mit Zugang zur Nummer.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { whatsappStatus } from '@/lib/whatsapp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false, fehler: 'Die WhatsApp-Verbindung sieht nur eine angemeldete Person — nie der Dienstweg.' } as const;

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return NextResponse.json(await whatsappStatus(z.person), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: unknown };
  try { b = await jsonBegrenzt(req, 4 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'pruefen') return NextResponse.json({ ok: false, fehler: 'aktion: pruefen.' }, { status: 400 });
  return NextResponse.json(await whatsappStatus(z.person, { pruefen: true }), { headers: { 'Cache-Control': 'no-store' } });
}
