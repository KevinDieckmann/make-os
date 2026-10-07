// ─── Google — wer darf die Verbindung verwalten? (Server, 03.10.2026) ────────
// Verbinden, Trennen, „Jetzt abgleichen“, Kalender wählen: NUR die Person selbst (Sitzung), im Haushalt des Inhabers —
// nie ein anderes Konto, nie der Dienstweg (ZOE, Takt, Skripte; 403). Kevin kann Malins Verbindung nicht trennen und
// Malin nicht Kevins. (Termine in den Google-Kalender EINER Person schreiben darf der Haushalt über die Termin-Route —
// wie bei iCloud; das Verwalten der Verbindung selbst nicht.)

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';

const PERSON = /^[a-z0-9-]{1,40}$/;
export const NUR_SELBST = { ok: false, fehler: 'Die Google-Verbindung verwaltet nur die Person selbst — angemeldet, nie über den Dienstweg.' } as const;
/** Inbox 2 (06.10.): die eigenen Postfächer — nur die Person selbst, nie der Dienstweg, nie ein anderes Konto. */
export const NUR_EIGENE_POST = { ok: false, fehler: 'Die Inbox zeigt nur die eigenen Postfächer — angemeldet, nie über den Dienstweg.' } as const;

/** Die Person der Sitzung — oder die fertige Antwort (403). `schreibend`: zusätzlich die Build-Prüfung (409 `neuLaden`). */
export async function eigenePerson(req: Request, schreibend = false, nurSelbst: { ok: false; fehler: string } = NUR_SELBST): Promise<{ person: string } | NextResponse> {
  if (istDienst(req)) return NextResponse.json(nurSelbst, { status: 403 });
  const person = req.headers.get('x-make-user');
  if (!person || !PERSON.test(person) || !(await personImHaushaltDesInhabers(person))) return NextResponse.json(nurSelbst, { status: 403 });
  if (schreibend) { const alt = bauPruefen(req); if (alt) return alt; }
  return { person };
}
