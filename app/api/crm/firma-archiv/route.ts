// ─── CRM — Sicherungen aus „Firmen zusammenführen“ (03.10., Kevin: „Archivkopie 30 Tage“) — NUR Inhaber, nur von Hand ──
// POST { aktion: 'liste' }                    → die vorhandenen Sicherungen (Datei, Zeitpunkt, welche Firmen, wie viele Tage noch, ob die
//                                               Wiederherstellung jetzt geht — und wenn nicht, warum). Schreibt nichts.
// POST { aktion: 'wiederherstellen', datei }  → die Zusammenführung zurücknehmen: die weggeführte Firma kommt zurück, Personen, Deals,
//                                               Mandate, Angebote, Events und Follow-ups gehen auf den gesicherten Stand — NUR dort, wo
//                                               seitdem niemand etwas geändert hat; alles andere bleibt und wird genannt.
// Vor jedem Zusammenführen legt der Server die Sicherung selbst an (lib/crm/firma-umhaengen-server.ts, Schritt „archiv“): verschlüsselt
// wie die Bestände, `archiv/crm-vor-firmen-zusammenfuehren-<zeit>.json`, nach 30 Tagen weg (Löschfrist „archiv-umzug“). Art. 17 nimmt
// eine gelöschte Person auch daraus heraus — sie kommt beim Wiederherstellen nicht zurück.
// Zugang: angemeldete Person mit Rolle Inhaber (Dienstweg/ZOE → 403: wiederhergestellt wird nur von Hand, mit Person im Protokoll).

import { NextResponse } from 'next/server';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { firmenArchive, firmenWiederherstellen } from '@/lib/crm/firma-umhaengen-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function zugang(req: Request): Promise<{ person: string } | NextResponse> {
  const haus = await imHaushaltDesInhabers(req);
  if (!haus) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  if (haus.dienst) return NextResponse.json({ ok: false, fehler: 'Die Sicherungen sieht und nutzt nur eine angemeldete Person von Hand, nicht der Dienstweg.' }, { status: 403 });
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, fehler: 'Nur mit angemeldeter Person.' }, { status: 401 });
  if (!(await istInhaber(person))) return NextResponse.json({ ok: false, fehler: 'Eine Firmen-Zusammenführung nimmt nur der Inhaber zurück.' }, { status: 403 });
  return { person };
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (z instanceof NextResponse) return z;
  const bau = bauPruefen(req);
  if (bau) return bau;
  let b: { aktion?: unknown; datei?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  try {
    if (b.aktion === 'liste') return NextResponse.json({ ok: true, sicherungen: await firmenArchive() });
    if (b.aktion === 'wiederherstellen') {
      const r = await firmenWiederherstellen(String(b.datei ?? ''), z.person, werAus(req));
      return r.ok ? NextResponse.json({ ok: true, zurueck: r.zurueck, uebersprungen: r.uebersprungen, sicherungen: await firmenArchive() }) : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
    }
    return NextResponse.json({ ok: false, fehler: 'aktion ist liste oder wiederherstellen.' }, { status: 400 });
  } catch (e) {
    console.error('[firma-archiv]', e);
    return NextResponse.json({ ok: false, fehler: `Nicht fertig geworden — die Absicht bleibt offen und wird fortgesetzt (Head of IT): ${e instanceof Error ? e.message.slice(0, 200) : 'Fehler'}` }, { status: 500 });
  }
}
