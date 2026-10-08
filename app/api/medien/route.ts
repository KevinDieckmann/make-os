// ─── Medien unterwegs: Bilder und Videos aus der Kamera (08.10. spät, Paket 0 „Vertrag“ — STUB, gebaut in Paket 5) ──────
// Auftrag (Nachtrag 08.10. spät): „Über die App Bilder und Videos machen, wenn wir unterwegs sind … geordnet, z. B. über ein Event,
// direkt auf den Server, entweder Business oder Privat … wenn sie dazu freigegeben wurden … direkt an die Head ofs.“
// GET → `MedienAntwort` (Business des Haushalts, Privat nur eigene), POST: hochladen (Typ aus dem INHALT, verschlüsselt über die
// Bild-Ablage), ordnen, fürs Marketing freigeben (nur per Klick), an Heads geben. Richtungsfragen offen (Speicherort, Ordnung,
// Recht am Bild, Videogrößen). Nur die Person selbst (`eigenePerson`, Dienstweg 403).
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { MEDIEN_NUR_SELBST } from '@/lib/agenten/typen';

export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'Kommt mit Paket 5 (Medien unterwegs) — AGENTEN_KONZEPT.md C11.', paket: 5 } as const;
const kommt = () => NextResponse.json({ ...KOMMT, error: KOMMT.fehler }, { status: 501 });

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return kommt();
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return kommt();
}
