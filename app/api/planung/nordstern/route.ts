// ─── MAKE OS — Nordstern des Haushalts (Planung › Jahr) — 08.10. abends, Fragebogen Teil 3 ─────────────────────────────
// Kevin: „Nordstern als gemeinsames Ziel von uns beiden pflegbar (Planung › Jahr).“ Ein Text je Haushalt (`nordstern--<haushalt>`,
// Regeln lib/planung/nordstern.ts, Schreiben lib/planung/nordstern-server.ts).
//   GET  jedes Konto mit Haushalt liest den Nordstern SEINES Haushalts — auch Konten mit `finanzRecht: 'business'` (der Nordstern ist
//        das gemeinsame Business-Ziel; `planZugangVon` entscheidet aus dem Konto). Ohne Haushalt 403, ohne Person 401.
//   PUT  { text, stand } — nur volle Mitglieder des Haushalts per Sitzung (Business-Konten lesen nur, Dienstweg 403), Stand/409,
//        über der Grenze 413 (nie gekürzt), leer = entfernen. Protokoll ohne Text.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { istDienst, ohnePerson, personStreng, planZugangVon } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { nordsternEingabe } from '@/lib/planung/nordstern';
import { nordsternLaden, nordsternSchreiben } from '@/lib/planung/nordstern-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OHNE_HAUSHALT = () => NextResponse.json({ ok: false, error: 'Der Nordstern gehört zu einem Haushalt — dieses Konto hat keinen.', fehler: 'Kein Haushalt.' }, { status: 403 });
const NUR_LESEN = (grund: string) => NextResponse.json({ ok: false, error: grund, fehler: grund }, { status: 403 });

export async function GET(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  const z = await planZugangVon(req);
  if (!z) return OHNE_HAUSHALT();
  const s = await nordsternLaden(z.haushalt);
  return NextResponse.json({ ok: true, ...s, darfSchreiben: z.sicht === 'privat' && !istDienst(req) });
}

export async function PUT(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  const z = await planZugangVon(req);
  if (!z) return OHNE_HAUSHALT();
  if (istDienst(req)) return NUR_LESEN('Den Nordstern ändert nur eine Person per Klick — nicht ZOE, nicht der Takt.');
  if (z.sicht !== 'privat') return NUR_LESEN('Mit Business-Zugang liest du den Nordstern nur — ändern können ihn die Mitglieder des Haushalts.');
  const bau = bauPruefen(req); if (bau) return bau;
  let b: { text?: unknown; stand?: unknown };
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const e = nordsternEingabe(b.text);
  if (!e.ok) return NextResponse.json({ ok: false, error: e.fehler, fehler: e.fehler }, { status: e.status });
  if (typeof b.stand !== 'string' || !b.stand) return NextResponse.json({ ok: false, error: 'Stand fehlt — Seite neu laden.' }, { status: 400 });
  const r = await nordsternSchreiben(z.haushalt, e.text, b.stand, werAus(req));
  if (!r.ok) {
    const satz = 'Der Nordstern wurde inzwischen geändert — die neue Fassung ist geladen, deine Eingabe ist nicht gespeichert.';
    return NextResponse.json({ ok: false, konflikt: true, error: satz, fehler: satz, ...r.aktuell, darfSchreiben: true }, { status: 409 });
  }
  return NextResponse.json({ ok: true, geaendert: r.geaendert, ...r.aktuell, darfSchreiben: true });
}
