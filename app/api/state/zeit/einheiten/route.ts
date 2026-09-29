// ─── MAKE OS — Zeit & Fokus: Zeit je Business-Einheit (27.09. spät) ─────────
// GET ?zeitraum=woche|monat&stichtag=YYYY-MM-DD → Stunden je Selbstständigkeit ·
// KD Ventures · MAKE OS UG · eigene · ohne Einheit, je Person des Haushalts und
// gesamt, dazu die Top-Aufgaben je Einheit. Nur bewusste Business-Blöcke.
// Rechnung rein in lib/zeitmessung/einheiten.ts. Ohne Haushalt nur die eigene Zeit.
// Tempo: einmal je Haushalt/Zeitraum rechnen und merken (`merken`); der Schlüssel
// trägt den Stand der Blöcke, weil `zeit` Memo-Rauschen ist.
// Wessen Zeit: lib/zeitmessung/personen.ts (auch für /api/state/zeit/mandate).

import { NextResponse } from 'next/server';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { merken } from '@/lib/store/memo';
import { ladeZeit, aufgabenKurz, zeitBloeckeStand } from '@/lib/zeitmessung/speicher';
import { zeitJeEinheit, berlinTag, brauchtMandate, type Zeitraum } from '@/lib/zeitmessung/einheiten';
import { mandateKurz } from '@/lib/planung/mandat-server';
import { zeitPersonenVon } from '@/lib/zeitmessung/personen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const zeitraum: Zeitraum = url.searchParams.get('zeitraum') === 'monat' ? 'monat' : 'woche';
  const s = url.searchParams.get('stichtag');
  const stichtag = s && TAG.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`)) ? s : berlinTag(new Date().toISOString());
  // Nur für eine ausdrücklich benannte Person (Regel 5) — kein Rückfall auf „kevin“.
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, error: 'Ohne angemeldete Person keine Zeitauswertung.' }, { status: 401 });
  const { schluessel, personen } = await zeitPersonenVon(person);
  const daten = await merken(`zeit-einheiten:${schluessel}:${zeitraum}:${stichtag}:${zeitBloeckeStand()}`, 60_000, async () => {
    const [aufgaben, dateien] = await Promise.all([aufgabenKurz(), Promise.all(personen.map(p => ladeZeit(p.person)))]);
    // Einheit eines Blocks mit Mandat live aus dem Mandat (29.09.) — das CRM nur lesen, wenn überhaupt ein Mandat vorkommt.
    const mandate = brauchtMandate(dateien, aufgaben) ? await mandateKurz() : null;
    return zeitJeEinheit(personen.map((p, i) => ({ ...p, datei: dateien[i] })), aufgaben, zeitraum, stichtag, mandate);
  });
  return NextResponse.json({ ok: true, ich: person, ...daten }, { headers: { 'Cache-Control': 'no-store' } });
}
