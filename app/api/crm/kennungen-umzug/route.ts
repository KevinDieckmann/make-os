// ─── CRM — Kennungs-Umzug (29.09., Paket D-C #35, Kevin: „auf zufällige Kennungen umstellen“) — NUR Inhaber ──
// POST { aktion: 'vorschau' }   → Anzahl, Vorkommen je Bestand, je Kennung die betroffenen Bestände, Fingerabdrücke,
//                                 laufender Umzug, letzter Umzug, ob der Rückweg geht — schreibt nichts
// POST { aktion: 'ausfuehren' } → Umzug (Absichtsprotokoll, Archivkopie, Weiterleitung alt → neu, alle Speicher über
//                                 `personenUmbiegen`, Kartei, Nachlese, Such-Index) — ein abgebrochener wird fortgesetzt
// POST { aktion: 'rueckweg' }   → letzten Umzug umkehren — 409 mit Gründen, wenn ein umgezogener Kontakt seitdem geändert,
//                                 gelöscht oder zusammengeführt wurde
// Nie automatisch: Kevin startet den Umzug nach dem Upload (DEPLOY.md „Kennungs-Umzug“). Logik: lib/crm/kennungen-umzug.ts.
// Zugang: angemeldete Person mit Rolle Inhaber (kein Dienstweg ohne Person — der Umzug steht mit Person im Protokoll).

import { NextResponse } from 'next/server';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { umzugVorschau, umzugAusfuehren, umzugRueckweg, UmzugAbgelehnt } from '@/lib/crm/kennungen-umzug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function zugang(req: Request): Promise<{ person: string } | NextResponse> {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, fehler: 'Nur mit angemeldeter Person.' }, { status: 401 });
  if (!(await istInhaber(person))) return NextResponse.json({ ok: false, fehler: 'Den Kennungs-Umzug startet nur der Inhaber.' }, { status: 403 });
  return { person };
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (z instanceof NextResponse) return z;
  const bau = bauPruefen(req);
  if (bau) return bau;
  let b: { aktion?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  try {
    if (b.aktion === 'vorschau') return NextResponse.json({ ok: true, ...(await umzugVorschau()) });
    if (b.aktion === 'ausfuehren') return NextResponse.json({ ok: true, ...(await umzugAusfuehren(z.person)), vorschau: await umzugVorschau() });
    if (b.aktion === 'rueckweg') return NextResponse.json({ ok: true, ...(await umzugRueckweg(z.person)), vorschau: await umzugVorschau() });
    return NextResponse.json({ ok: false, fehler: 'aktion ist vorschau, ausfuehren oder rueckweg.' }, { status: 400 });
  } catch (e) {
    if (e instanceof UmzugAbgelehnt) return NextResponse.json({ ok: false, fehler: e.message, gruende: e.gruende }, { status: 409 });
    console.error('[kennungen-umzug]', e);
    return NextResponse.json({ ok: false, fehler: `Nicht fertig geworden — die Absicht bleibt offen und wird fortgesetzt (Head of IT): ${e instanceof Error ? e.message.slice(0, 200) : 'Fehler'}` }, { status: 500 });
  }
}
