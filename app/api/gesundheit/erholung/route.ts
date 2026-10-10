// ─── MAKE OS — Gesundheit › Erholung (Auftrag 10.10.: „Einen Erholungsbereich … überall mit einstellbar“) ─────────────────────────
// Bestand je Person `erholung--<person>` (lib/gesundheit/erholung*.ts). Art. 9 — Gesundheitsdaten.
// GET  [?fuer=<person>] → { ok, ich, fuer, eigene, erholung, stand?, sicht } — die EIGENE Erholung immer; die einer anderen Person nur,
//       wenn sie ihre Gesundheit mit der anfragenden Person teilt (`darfGesundheitSehen`) UND beide volle Mitglieder des Haushalts sind
//       (ein Konto „nur Business“, ein Testkunde oder ein fremder Haushalt bekommen nie etwas). Fremd: ohne Unterlagen- und
//       Kalender-Verweise (`erholungFuerBetrachter`), ohne Stand (nur lesen), Lese-Protokoll (Art. 9). Dienstweg → 403.
// PATCH { stand, ops } → NUR die Person selbst (kein ?fuer, Dienstweg 403). Einwilligung (a) zuerst — ausgenommen reines Entfernen;
//       Schritte in EINER Sperre, veralteter Stand → 409 mit dem aktuellen Bestand, über einer Grenze → 413, ungültig → 400.

import { NextResponse } from 'next/server';
import { istDienst, personStreng, ohnePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { darfGesundheitSehen } from '@/lib/zoe/raum';
import { planungsUmfangFuer } from '@/lib/planung/bereich-sicht-server';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { localDay } from '@/lib/zeit';
import { erholungLaden, erholungAendern, erholungSicht } from '@/lib/gesundheit/erholung-server';
import { ERHOLUNG_GRENZEN, erholungFuerBetrachter, leereErholung, nurEntfernen } from '@/lib/gesundheit/erholung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 256_000;
const PERSON = /^[a-z0-9-]{1,40}$/;
const NUR_SELBST = () => NextResponse.json({ ok: false, error: 'Die Erholung sieht und ändert nur die Person selbst (bzw. wem sie ihre Gesundheit zeigt) — angemeldet, nie über den Dienstweg.' }, { status: 403 });
const NICHT_GETEILT = () => NextResponse.json({ ok: false, error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });

export async function GET(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const ich = personStreng(req);
  if (!ich) return ohnePerson();
  const f = new URL(req.url).searchParams.get('fuer');
  const fuer = f && PERSON.test(f) ? f : ich;
  const eigene = fuer === ich;
  // Fremde Ansicht: geteilt UND beide volle Mitglieder des Haushalts (Konto „nur Business“, Testkunde, fremder Haushalt → nie).
  if (!eigene) {
    const [teilt, u1, u2] = await Promise.all([darfGesundheitSehen(req, fuer), planungsUmfangFuer(ich), planungsUmfangFuer(fuer)]);
    if (!teilt || u1 !== 'alles' || u2 !== 'alles') return NICHT_GETEILT();
  }
  leseZugriff(req, 'gesundheit', { betroffen: fuer }); // Lese-Protokoll (Art. 9)
  const { erholung, stand } = await erholungLaden(fuer);
  const voll = erholung ?? leereErholung();
  // Fremde Sicht: schon VOR dem Rechnen gefiltert — auch die gerechneten Behandlungen tragen dann keinen Kalender-Verweis.
  const s = eigene ? voll : erholungFuerBetrachter(voll);
  const sicht = await erholungSicht(fuer, ich, s, localDay());
  return NextResponse.json({
    ok: true, ich, fuer, eigene,
    erholung: s,
    ...(eigene ? { stand, grenzen: ERHOLUNG_GRENZEN } : {}),
    sicht,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  if (zuGross(req, MAX_BYTES)) return ZU_GROSS(MAX_BYTES);
  let body: { stand?: unknown; ops?: unknown };
  try { body = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Art. 9: erfasst wird nur mit Einwilligung (a) der Person. Entfernen geht immer — es verarbeitet nichts Neues.
  if (!nurEntfernen(body?.ops)) { const sperre = await gesundheitSchreibSperre(person); if (sperre) return sperre; }
  const r = await erholungAendern(person, body?.stand, body?.ops);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.fehler, ...(r.status === 409 ? { konflikt: true, erholung: r.erholung ?? null, stand: r.stand } : {}) }, { status: r.status });
  }
  return NextResponse.json({ ok: true, erholung: r.erholung, stand: r.stand, sicht: await erholungSicht(person, person, r.erholung, localDay()) });
}
