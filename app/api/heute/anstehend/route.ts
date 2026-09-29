// ─── Heute: was ansteht (K6a, 29.09.) ───────────────────────────────────────
// GET → { ok, heute, termine, nachbereiten, fristen, followups, buchungen, vorschlaege, geburtstage } — nur Verweise und
//        abgeleitete Anzeige (lib/heute/anstehend.ts), nichts wird kopiert oder gespeichert. ETag über den Stand aller
//        Quellen + 10-Minuten-Uhr → 304, wenn nichts neu ist.
// Zugang wie die Glocke: angemeldete Person im Haushalt des Inhabers (streng), Dienstweg nur mit genau dieser Person.
// Es gibt nur die EIGENE Sicht — keine Abfrage für eine andere Person.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { etagAus, unveraendert, jsonAntwort } from '@/lib/http/json-antwort';
import { anstehendLesen, anstehendStand } from '@/lib/heute/anstehend-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = { ok: false, fehler: 'Nur für eine angemeldete Person im Haushalt des Inhabers.' } as const;

async function eigenePerson(req: Request): Promise<string | null> {
  const w = await imHaushaltDesInhabers(req);
  if (!w) return null;
  return personStreng(req) === w.person || (w.dienst && req.headers.get('x-make-person') === w.person) ? w.person : null;
}

export async function GET(req: Request) {
  const person = await eigenePerson(req);
  if (!person) return NextResponse.json(GESPERRT, { status: 403 });
  const jetzt = new Date();
  const etag = etagAus('anstehend1', person, await anstehendStand(jetzt));
  const nichts = unveraendert(req, etag);
  if (nichts) return nichts;
  return jsonAntwort(req, { ok: true, ...(await anstehendLesen(person, jetzt)) }, etag);
}
