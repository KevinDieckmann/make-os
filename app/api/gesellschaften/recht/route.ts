// ─── MAKE OS — Head of Recht (Unternehmen, 10.10.) ───────────────────────────────────────────────────────────────────
// Kevin 10.10.: „Head of Recht — wöchentlicher Recht-Check, Quartals-Risikorunde vorbereiten, neuer Vertrag → Checkliste, Anwalts-Mappe auf Knopfdruck
// (nichts geht raus ohne Klick).“ Grundlage research/unternehmen/FAKTEN_UNTERNEHMEN_RECHT.md › 6.
//
// GET                         → { hinweis, check (letzter Wochen-Check oder null), am, runden (vorbereitete Risikorunden des Quartals), mappen }
// GET  ?jetzt=1               → { check } — der Recht-Check JETZT (nur lesen, nichts gespeichert, keine Vorschläge)
// POST { aktion: 'mappe', thema: { art: gesellschaft|vertrag|risiko, gesellschaftId, vertragId|risikoId }, fragen?: string[] }
//                             → Anwalts-Mappe als PDF in die verschlüsselte Ablage der Gesellschaft (Unternehmen › Unterlagen) — verschickt NICHTS.
// Zugang wie Unternehmen › Schild: NUR der Haushalt des Inhabers mit vollem Haushaltszugang (Konto „nur Business“, Testkunde, fremder Haushalt → 403).
// Die Route liegt unter `gesellschaften` = Business (lib/zugang/sicht-bereich.ts): mit `?space=privat` antwortet die Middleware 403. Die Mappe nur
// per Sitzung (Dienstweg 403). Hinweis, keine Rechtsberatung.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { localDay } from '@/lib/zeit';
import { quartal } from '@/lib/gesellschaften/schild/zeit';
import { ladeRechtStand, mappeErstellen, rechtCheckJetzt, RechtFehler } from '@/lib/recht/server';
import { RECHT_BANNER } from '@/lib/recht/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Der Bereich Unternehmen gehört zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const KOPF = { headers: { 'Cache-Control': 'no-store' } };

async function zugang(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  const h = await haushaltVon(req);
  return h ? { person: h.person, haushalt: h.haushalt } : null;
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  leseZugriff(req, 'gesellschaften'); // Lese-Protokoll (Firmen-Akte)
  const heute = localDay();
  if (new URL(req.url).searchParams.get('jetzt') === '1') {
    const { check } = await rechtCheckJetzt(z.haushalt, heute);
    return NextResponse.json({ ok: true, hinweis: RECHT_BANNER, check, am: null, jetzt: true }, KOPF);
  }
  const s = await ladeRechtStand(z.haushalt);
  const q = quartal(heute);
  const runden = Object.values(s.runden ?? {}).filter((r): r is NonNullable<typeof r> => !!r && r.quartal === q).map(r => ({ am: r.am, ...r.vorbereitung }));
  return NextResponse.json({ ok: true, hinweis: RECHT_BANNER, check: s.woche?.check ?? null, am: s.woche?.am ?? null, runden, mappen: (s.mappen ?? []).slice(0, 10) }, KOPF);
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  // Die Mappe entsteht nur per Klick einer Person (Sitzung) — nie über den Dienstweg (ZOE, Takt, Skripte).
  if (istDienst(req)) return fehler('Die Anwalts-Mappe entsteht nur per Klick in der Oberfläche.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try {
    const roh = await jsonBegrenzt(req, 64 * 1024);
    if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return fehler('Kein gültiges JSON.', 400);
    b = roh as Record<string, unknown>;
  } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (b.aktion !== 'mappe') return fehler('aktion: mappe.', 400);
  try {
    const r = await mappeErstellen(z.haushalt, z.person, b.thema, b.fragen);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof RechtFehler) return fehler(e.message, e.status);
    console.error('[gesellschaften/recht]', e instanceof Error ? e.message : e);
    return fehler('Mappe nicht erstellt.', 500);
  }
}
