// ─── KI-Protokoll lesen (05.10.) ────────────────────────────────────────────────────────────────────────────────────
// GET                → eigene Zeilen der letzten 3 Monate (?monate=1..12); der Inhaber zusätzlich die Systemläufe ohne Person
// GET ?auskunft=1    → Art.-15-Auskunft als Datei: Empfänger (Anthropic, USA), je Kategorie Aufrufe/Zeitraum, alle eigenen
//                      Zeilen der Aufbewahrung (12 Monate). Nur Metadaten — das Protokoll enthält nie Inhalte.
// Nur mit Sitzung (der Dienstweg liest hier nichts).

import { NextResponse } from 'next/server';
import { personDerSitzung } from '@/lib/zugang/tor';
import { istDienst } from '@/lib/zugang/dienst';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { KI_PROTOKOLL_MONATE, empfaengerAuskunft, kiProtokollLesen } from '@/lib/datenschutz/ki-protokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERSON = /^[a-z0-9-]{1,40}$/;

export async function GET(req: Request) {
  if (istDienst(req)) return NextResponse.json({ ok: false, error: 'Nur mit Anmeldung.' }, { status: 403 });
  const person = personDerSitzung(req);
  if (!person || !PERSON.test(person)) return NextResponse.json({ ok: false, error: 'Nur mit Anmeldung.' }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.get('auskunft') === '1') {
    const zeilen = await kiProtokollLesen({ person, monate: KI_PROTOKOLL_MONATE });
    const datei = { art: 'Auskunft nach Art. 15 DSGVO — KI-Verarbeitung', person, erstellt: new Date().toISOString(), ...empfaengerAuskunft(zeilen), zeilen };
    return new NextResponse(JSON.stringify(datei, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="ki-auskunft-${person}.json"`, 'Cache-Control': 'no-store' } });
  }
  const monate = Math.min(Math.max(Number(url.searchParams.get('monate') ?? 3) || 3, 1), KI_PROTOKOLL_MONATE);
  const mitSystem = await istInhaber(person);
  const zeilen = await kiProtokollLesen({ person, mitSystem, monate });
  return NextResponse.json({ ok: true, monate, mitSystem, zusammenfassung: empfaengerAuskunft(zeilen.filter(z => z.person === person)), zeilen: zeilen.slice(0, 500), gesamt: zeilen.length }, { headers: { 'Cache-Control': 'no-store' } });
}
