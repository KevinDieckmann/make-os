// ─── /api/hoi/lage — die Lage des Systems (Head of IT, 27.09.) ──────────────
// GET: alle Befunde mit Ampel, Gesamtampel und Kurztext. Sehen darf der Haushalt
// des Inhabers (Seite /os/hoi) und der eingeschränkte HOI-Schlüssel (Middleware
// setzt x-make-hoi) — keine Personen, keine Inhalte, nur Zähler und Zustände.

import { NextResponse } from 'next/server';
import { hoiSehen } from '@/lib/hoi/zugang';
import { lage } from '@/lib/hoi/innen';
import { istBetreiberInstanz } from '@/lib/betrieb/betreiber-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Volle Mitglieder im Haushalt des Inhabers (15.10., Abnahme 2 B8 — nie „nur Business“, fremder Haushalt, Testkunde). Der HOI-Schlüssel bleibt.
  if (!(await hoiSehen(req))) return NextResponse.json({ ok: false, fehler: 'Nur für volle Mitglieder des Haushalts.' }, { status: 403 });
  try {
    // Der Weg am Server (Befehle, Repo-Dateien, Pfade, Umgebungswerte, GitHub) nur in der Betreiber-Instanz bzw. für den HOI-Schlüssel
    // (14.10./15.10., Abnahme A2) — eine fremde Instanz bekommt Befunde, Gesamtampel und Kurzbericht nur neutral (lib/hoi/lage.ts
    // `befundeFuerInstanz`): was die Inhaberin selbst tun kann, rote Betreiber-Befunde mit neutralem Satz.
    const betreiber = req.headers.get('x-make-hoi') === '1' || await istBetreiberInstanz();
    const l = await lage(undefined, { betreiber });
    return NextResponse.json({ ok: true, ...l }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Lage nicht lesbar.' }, { status: 500 });
  }
}
