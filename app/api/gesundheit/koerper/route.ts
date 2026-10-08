// ─── MAKE OS — Gesundheit › Körper: das eigene Körper-Profil (08.10. abends, Fragebogen Teil 3, Frage 2) ──────────────
// Kevin: „Körper-Reiter sieht nur die Person selbst.“ — deshalb NUR die Person der Sitzung (bzw. ausdrücklich benannt),
// kein `?fuer=`, kein Dienstweg (403) — auch wer seine Gesundheit teilt (Konto › teilt.gesundheit), teilt das Körper-Profil
// nicht. Bestand je Person über lib/gesundheit/koerper-server.ts.
// GET   → { ok, koerper | null, stand } (Lese-Protokoll Art. 9)
// PATCH { stand, ops } → Schritte (lib/gesundheit/koerper.ts) in EINER Sperre; Einwilligung (a) zuerst, veralteter Stand
//        → 409 mit dem aktuellen Profil, über einer Grenze → 413 (nie gekürzt), ungültig → 400 (nichts gespeichert).

import { NextResponse } from 'next/server';
import { istDienst, personStreng, ohnePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { koerperLaden, koerperAendern } from '@/lib/gesundheit/koerper-server';
import { KOERPER_GRENZEN } from '@/lib/gesundheit/koerper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 256_000;
/** 403 für den Dienstweg (ZOE, Takt, Skripte): das Körper-Profil liest und schreibt nur die Person selbst. */
const NUR_SELBST = () => NextResponse.json({ ok: false, error: 'Das Körper-Profil sieht und ändert nur die Person selbst — angemeldet, nie über den Dienstweg.' }, { status: 403 });

export async function GET(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9)
  const { koerper, stand } = await koerperLaden(person);
  return NextResponse.json({ ok: true, ich: person, koerper, stand, grenzen: KOERPER_GRENZEN }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  // Art. 9: erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(person); if (sperre) return sperre; }
  { const alt = bauPruefen(req); if (alt) return alt; }
  if (zuGross(req, MAX_BYTES)) return ZU_GROSS(MAX_BYTES);
  let body: { stand?: unknown; ops?: unknown };
  try { body = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const r = await koerperAendern(person, body?.stand, body?.ops);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.fehler, ...(r.status === 409 ? { konflikt: true, koerper: r.koerper ?? null, stand: r.stand } : {}) }, { status: r.status });
  }
  return NextResponse.json({ ok: true, koerper: r.koerper, stand: r.stand });
}
