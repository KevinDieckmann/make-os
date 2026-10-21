// ─── Prozesse — „Head fragen“ in der Werkstatt (22.10., Kundengewinnung; lib/prozesse/kundengewinnung/head-server.ts) ────────────────────────────────────────
// GET  [?prozess=<id>]  ob die KI da ist, welches Modell (Stufe des Heads), was ein Vorschlag ungefähr kostet (vor dem Klick) — und die OFFENEN Vorschläge des
//                       Heads für die eigene Person (je Prozess bzw. „neu“) mit dem Unterschied zum AKTUELLEN Entwurf. Lesen schreibt nie.
// POST { aktion: 'fragen', art: 'prozess'|'baustein', ziel, bereich?, fallArt?, prozessId?, phaseId?, ki?: boolean, anfrageId }
//                       → ein Vorschlag im ZOE-Stapel (Stapel-Art `prozess-entwurf`) — am Prozess ändert sich nichts. Mit KI zuerst `modellSchranke`.
//      { aktion: 'uebernehmen', id }  → dieselbe Freigabe wie im Stapel (nur die eigene Person, aus der Sitzung) — Antwort mit der Kennung des Prozesses.
// Tor: `werkstattZugang` (Haushalt des Inhabers, Sicht Privat 403); POST nur per Sitzung mit Bau-Kennung (Dienstweg 403); Entwürfe bauen = Recht „entwurf“.
// Ablehnen geht über den Stapel (/api/zoe/stapel `entscheidung: 'ablehnen'`) — eine Stelle.

import { NextResponse } from 'next/server';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { einmalig } from '@/lib/store/anfragen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });

export async function GET(req: Request) {
  const z = await werkstattZugang(req);
  if (z instanceof Response) return z;
  const prozess = new URL(req.url).searchParams.get('prozess') ?? undefined;
  if (prozess !== undefined && !/^[a-z0-9:~-]{1,80}$/i.test(prozess)) return nein(400, 'prozess: Kennung eines Prozesses.');
  const { headStand, headVorschlaege } = await import('@/lib/prozesse/kundengewinnung/head-server');
  const [stand, vorschlaege] = await Promise.all([headStand(), z.dienst ? Promise.resolve([]) : headVorschlaege(z.person, z.haushalt, prozess)]);
  return NextResponse.json({ ok: true, rechte: z.rechte, ...stand, vorschlaege }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await werkstattZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  if (!z.rechte.entwurf) return nein(403, 'Prozesse bauen nur Personen im Haushalt.');
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const srv = await import('@/lib/prozesse/kundengewinnung/head-server');

  if (b.aktion === 'uebernehmen') {
    const id = typeof b.id === 'string' ? b.id : '';
    const { hole } = await import('@/lib/zoe/stapel');
    const v = id ? await hole(id) : null;
    if (!v || v.bezug?.art !== srv.HEAD_STAPEL_ART || v.person !== z.person) return nein(404, 'Vorschlag nicht gefunden.');
    if (v.status !== 'offen') return nein(409, `Schon entschieden (${v.status}).`);
    const r = await srv.PROZESS_ENTWURF_STAPEL_ART.freigeben(v, z.person, { sitzung: !z.dienst });
    if (!r.ok) return nein(r.status, r.fehler);
    const nach = await hole(id);
    return NextResponse.json({ ok: true, ergebnis: r.text, prozessId: typeof nach?.eingabe._angelegt === 'string' ? nach.eingabe._angelegt : null });
  }
  if (b.aktion !== 'fragen') return nein(400, 'Unbekannte Aktion.');

  const { headAnfrageAus } = await import('@/lib/prozesse/kundengewinnung/head');
  const a = headAnfrageAus(b);
  if (!a.ok) return nein(a.status, a.fehler);
  const stand = await srv.headStand();
  // Mit KI nur, wenn die Person sie will und sie da ist — vorher die Schranke der Modellaufrufe (Umfang, Drossel).
  const mitKi = b.ki !== false && stand.ki;
  if (mitKi) { const s = modellSchranke(req); if (s) return s; }
  const fragen = async (): Promise<{ status: number; body: Record<string, unknown> }> => {
    const r = await srv.headFragen(a.anfrage, { person: z.person, haushalt: z.haushalt, ki: mitKi ? kiAus(req, ['allgemein'], { person: z.person }) : null });
    if (!r.ok) return { status: r.status, body: { ok: false, fehler: r.fehler } };
    return { status: 200, body: { ok: true, vorschlag: { id: r.vorschlag.id, titel: r.vorschlag.titel, nachher: r.vorschlag.nachher }, diff: r.diff, quelle: r.quelle } };
  };
  const r = await einmalig<Record<string, unknown>>('prozess-head', b.anfrageId, fragen, undefined, { wer: z.person });
  return NextResponse.json(r.body, { status: r.status });
}
