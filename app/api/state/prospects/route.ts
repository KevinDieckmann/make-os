// ─── MAKE OS — Prospecting: die Zielliste ───────────────────────────────────────────────────────────────────────────────────────
// GET   → { state: { icp, prospects } | null, icpQuelle } — jede Zeile mit `stand` (Fingerabdruck). `icp` ist das WIRKSAME Profil
//         (Marketing › Positionierung, sonst das eigene der Zielliste — lib/make-one/prospecting-data.ts `wirksamesIcp`); so liest es auch
//         der Prospect-Agent.
// PATCH { ops: [{ op: 'upsert' | 'teil' | 'delete', eintrag | id, felder?, stand? }], icp? }   (Woche 2 · 1.14, 09.10.)
//         → Einzeländerungen mit Stand (409 + `konflikte` bei fremder Änderung, nichts gespeichert); `icp` setzt das EIGENE Profil
//           (≤ 3000 Zeichen, sonst 413 — nie gekürzt). Antwort mit den neuen Ständen.
// PUT   → ICP + ganze Liste — nur noch für den Prospect-Agenten (lib/zoe/agenten.ts); der Browser schreibt per PATCH.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt, updateJson } from '@/lib/store/local-db';
import { prospectSaeubern, wirksamesIcp, ICP_MAX, type ProspectsState, type Prospect } from '@/lib/make-one/prospecting-data';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { karteiZugang, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { protokolliereBestand, werAus } from '@/lib/store/aenderungsprotokoll';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { ladeCrm } from '@/lib/crm/speicher';
import { einstellungAus } from '@/lib/crm/marketing';
import { bauPruefen } from '@/lib/bau/pruefen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bestand = { icp?: string; prospects?: Prospect[] };
const ohneStand = (p: Record<string, unknown>) => { const { stand: _s, ...rest } = p; return rest; };

async function antwort(state: Bestand | null) {
  const w = wirksamesIcp(einstellungAus(await ladeCrm()), state?.icp);
  return { state: state ? { icp: w.text, prospects: mitStand(state.prospects ?? []) } : null, icpQuelle: w.quelle, ...(w.quelle !== 'eigen' && state?.icp ? { eigenesIcp: state.icp } : {}) };
}

export async function GET(req: Request) {
  // Haushalt des Inhabers (28.09., K1 #66/#67).
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  return NextResponse.json(await antwort(await loadJson<Bestand>('prospects')));
}

export async function PATCH(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { ops?: unknown; icp?: unknown };
  try { b = await jsonBegrenzt(req, 2_000_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.icp !== undefined) {
    if (typeof b.icp !== 'string') return NextResponse.json({ ok: false, fehler: 'icp muss Text sein.' }, { status: 400 });
    if (b.icp.length > ICP_MAX) return NextResponse.json({ ok: false, fehler: `Das Profil ist zu lang (höchstens ${ICP_MAX} Zeichen) — nichts gespeichert.` }, { status: 413 });
    const vorher = await loadJson<Bestand>('prospects');
    const next = await updateJson<Bestand>('prospects', cur => ({ ...(cur ?? { prospects: [] }), icp: (b.icp as string).replace(/\u0000/g, '') }));
    await protokolliereBestand('prospects', vorher, next, werAus(req));
  }
  let zeilen: { id: string; stand: string }[] = [];
  if (b.ops !== undefined) {
    const ops = opsLesen<Prospect>(b.ops, prospectSaeubern);
    if (!ops) return NextResponse.json({ ok: false, fehler: opsFehler(b.ops) }, { status: Array.isArray(b.ops) ? 413 : 400 });
    if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine gültigen Änderungen (Kennung p-…, Firma Pflicht).' }, { status: 400 });
    const r = await listePatchen<Prospect, Bestand & Record<string, unknown>>('prospects', 'prospects', ops, 4, undefined, {
      wer: werAus(req),
      teil: (alt, felder) => prospectSaeubern({ ...alt, ...felder, id: alt.id }),
    });
    if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte } : {}) }, { status: 409 });
    zeilen = r.zeilen ?? [];
  }
  return NextResponse.json({ ok: true, zeilen, ...(await antwort(await loadJson<Bestand>('prospects'))) });
}

export async function PUT(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  if (zuGross(req, 2000000)) return ZU_GROSS(2000000);
  let body: unknown;
  try { body = await jsonBegrenzt(req, 2000000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const s = body as Partial<ProspectsState>;
  if (!s || !Array.isArray(s.prospects) || typeof s.icp !== 'string') {
    return NextResponse.json({ ok: false, error: 'Ungültiger Zustand: icp/prospects fehlen.' }, { status: 400 });
  }
  const vorher = await loadJson<{ icp: unknown; prospects: unknown[] }>('prospects');
  // Der Stand je Zeile (GET) gehört nicht in den Bestand.
  const prospects = s.prospects.map(p => (p && typeof p === 'object' ? ohneStand(p as unknown as Record<string, unknown>) : p));
  // Das wirksame Profil (GET) ist das aus Marketing, wenn es dort steht — dann bleibt das eigene, wie es war (nie überschrieben).
  const marketing = wirksamesIcp(einstellungAus(await ladeCrm()), undefined).quelle === 'marketing';
  const icp = marketing ? (vorher?.icp ?? '') : s.icp;
  const { ok, next } = await updateGeschuetzt<{ icp: unknown; prospects: unknown[] }>('prospects', { icp, prospects }, x => x.prospects?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Zielkunden geloescht.' }, { status: 409 });
  // Änderungsprotokoll (28.09., K1 #44): nur Kennungen und Feldnamen.
  await protokolliereBestand('prospects', vorher, next, werAus(req));
  return NextResponse.json({ ok: true });
}
