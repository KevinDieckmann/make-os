// ─── MAKE OS — Eigene Meilensteine an eigenen Zielen (10.10., Kevin: „Ja, eigene Meilensteine“) ───────────────────────────────────
// Bestand je Person `meilensteine-eigen--<person>` (lib/planung/eigene-meilensteine.ts) — getrennt vom gemeinsamen `meilensteine`, immer Privat.
//   GET   [?fuer=ich|<speicher>] → { fuer, darfSchreiben, meilensteine (mit `stand`) }. Ohne `fuer` bzw. `ich`: die eigenen. Eine andere Person
//         des Haushalts NUR, was sie über ihre eigenen Ziele teilt (ganz geteilt: alle; einzeln geteilt: nur die Meilensteine der geteilten
//         Ziele) — gefiltert auf dem SERVER an EINER Stelle (lib/planung/eigene-ziele-sicht.ts `eigeneMeilensteineSicht`/`…FuerBetrachter`).
//         Nichts geteilt, Konto „nur Business“, fremder Haushalt → 403 ohne Inhalt.
//   PATCH { ops } — Einzeländerungen mit Stand (409 + aktueller Bestand), nur der EIGENE Bestand per Sitzung (fremd → 403, Dienstweg → 403),
//         Grenzen → 413 (nie gekürzt), Ziel-Bezug nur auf ein eigenes Ziel im Privat-Bereich (400). Danach zieht der Fortschritt der eigenen
//         Ziele nach (Mittelwert der Meilensteine).

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { opsFehler, opsLesen } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';
import { NUR_BUSINESS_PRIVAT } from '@/lib/planung/bereich-sicht';
import { EIGENE_MS_OPS_MAX, EIGENER_MS_UNGUELTIG, sauberEigenerMeilenstein, type EigenerMeilenstein } from '@/lib/planung/eigene-meilensteine';
import { eigeneMeilensteineFuer, eigeneMeilensteinePatchen } from '@/lib/planung/eigene-meilensteine-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERSON = /^[a-z0-9-]{1,40}$/;
const NICHT_GETEILT = 'Diese Person teilt keine eigenen Ziele mit dir.';
const fehler = (error: string, status: number, mehr: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...mehr }, { status });

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const fuer = new URL(req.url).searchParams.get('fuer');
  const eigentuemer = !fuer || fuer === 'ich' ? z.person : fuer;
  if (!PERSON.test(eigentuemer)) return fehler('fuer: ich oder eine Person deines Haushalts.', 400);
  const eigen = eigentuemer === z.person;
  const r = await eigeneMeilensteineFuer(eigentuemer, z.person);
  // Nichts sichtbar: dieselbe Antwort, ob es etwas gibt oder nicht (kein Titel, keine Kennung, kein Zähler).
  if (r.sicht === 'nichts') return eigen ? fehler(NUR_BUSINESS_PRIVAT, 403) : fehler(NICHT_GETEILT, 403, { geteilt: false });
  return NextResponse.json({ ok: true, fuer: eigen ? 'ich' : eigentuemer, darfSchreiben: eigen && !z.dienst, ...(r.sicht === 'geteilte' ? { nurGeteilte: true } : {}), meilensteine: mitStand(r.meilensteine) });
}

export async function PATCH(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  // Eigene Meilensteine schreibt nur die Person selbst am eigenen Gerät — kein Dienstweg (ZOE, Takt, Skripte).
  if (z.dienst) return fehler('Eigene Meilensteine ändert nur die Person selbst.', 403);
  const bau = bauPruefen(req); if (bau) return bau;
  let body: { ops?: unknown; fuer?: unknown };
  try { body = await jsonBegrenzt(req, 256_000); } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (body.fuer !== undefined && body.fuer !== 'ich' && body.fuer !== z.person) return fehler('Die Meilensteine einer anderen Person kannst du nur lesen.', 403);
  // Konto „nur Business“: Privates ist für dieses Konto nicht da — auch keine eigenen Meilensteine (immer Privat). Unlesbar → zu (fail-closed).
  if (await privatAusgeblendetFuer(z.person).catch(() => true)) return fehler(NUR_BUSINESS_PRIVAT, 403);
  const zuViel = opsFehler(body.ops, EIGENE_MS_OPS_MAX);
  if (zuViel) return fehler(zuViel, Array.isArray(body.ops) ? 413 : 400);
  // Nie still verwerfen: ein ungültiger ganzer Eintrag lehnt die Änderung ab (opsLesen ließe ihn sonst fallen).
  const roh = body.ops as Record<string, unknown>[];
  if (roh.some(o => o?.op === 'upsert' && !sauberEigenerMeilenstein(o.eintrag))) return fehler(EIGENER_MS_UNGUELTIG, 400);
  const ops = opsLesen<EigenerMeilenstein>(roh, sauberEigenerMeilenstein, EIGENE_MS_OPS_MAX);
  if (!ops || ops.length !== roh.length) return fehler('Abgelehnt: unbekannte Änderung (upsert, teil oder delete mit Kennung). Nichts gespeichert.', 400);
  const r = await eigeneMeilensteinePatchen(z.person, ops, werAus(req));
  if (!r.ok) return fehler(r.fehler, r.status, { konflikte: r.konflikte, meilensteine: mitStand(r.meilensteine) });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, zieleGeaendert: r.zieleGeaendert, meilensteine: mitStand(r.meilensteine) });
}
