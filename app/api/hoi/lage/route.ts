// ─── /api/hoi/lage — die Lage des Systems (Head of IT, 27.09.) ──────────────
// GET: alle Befunde mit Ampel, Gesamtampel und Kurztext. Sehen darf der Haushalt
// des Inhabers (Seite /os/hoi) und der eingeschränkte HOI-Schlüssel (Middleware
// setzt x-make-hoi) — keine Personen, keine Inhalte, nur Zähler und Zustände.

import { NextResponse } from 'next/server';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { lage } from '@/lib/hoi/innen';
import { betreiberNeutral } from '@/lib/betrieb/betreiber';
import { istBetreiberInstanz } from '@/lib/betrieb/betreiber-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Sicherheitslage nur für Inhaber (15.10., Abnahme 2 B8) — vorher jedes Konto im Haushalt, auch „nur Business“. Der HOI-Schlüssel bleibt.
  if (req.headers.get('x-make-hoi') !== '1' && !(await nurInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  try {
    const l = await lage();
    // Der Weg am Server (Befehle, Repo-Dateien, Pfade) nur in der Betreiber-Instanz bzw. für den HOI-Schlüssel (14.10., Abnahme A2) —
    // eine fremde Instanz liest „das richtet der Betreiber“. Ampel, Wert und Zähler bleiben gleich.
    const betreiber = req.headers.get('x-make-hoi') === '1' || await istBetreiberInstanz();
    const befunde = betreiber ? l.befunde : l.befunde.map(b => ({ ...b, satz: betreiberNeutral(b.satz) }));
    return NextResponse.json({ ok: true, ...l, befunde }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Lage nicht lesbar.' }, { status: 500 });
  }
}
