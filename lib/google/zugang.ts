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

/**
 * Die Person der Sitzung — oder die fertige Antwort (403). `schreibend`: zusätzlich die Build-Prüfung (409 `neuLaden`).
 * `verweigert`: eigener Text der 403-Antwort (06.10.: auch die iCloud-Verbindung je Person nutzt dieses Tor).
 */
export async function eigenePerson(req: Request, schreibend = false, verweigert: { ok: false; fehler: string } = NUR_SELBST): Promise<{ person: string } | NextResponse> {
  if (istDienst(req)) return NextResponse.json(verweigert, { status: 403 });
  const person = req.headers.get('x-make-user');
  if (!person || !PERSON.test(person) || !(await personImHaushaltDesInhabers(person))) return NextResponse.json(verweigert, { status: 403 });
  if (schreibend) { const alt = bauPruefen(req); if (alt) return alt; }
  return { person };
}
