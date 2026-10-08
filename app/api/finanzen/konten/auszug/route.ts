// ─── Kontoauszug einlesen (09.10., ONBOARDING_PLAN.md › B9 d) — Bank-Übergang bis zur finAPI-Anbindung ─────────────────────────────────
// GET  ?konto=<kt-…>  → { ok, laeufe }  (die eingelesenen Auszüge dieses Kontos: nur Kennungen, Zahlen, Zeitraum — für „Rückgängig“)
// POST { aktion: 'vorschau', kontoId, datei: { inhalt: <base64> }, spalten? }            → Vorschau (schreibt nichts), mit `basis`
//      { aktion: 'uebernehmen', kontoId, datei, spalten?, basis, trotzAbweichung?, anfrageId? } → nur mit der `basis` dieser Vorschau (sonst 409)
//      { aktion: 'zuruecknehmen', laufId }                                                  → nur seitdem Unverändertes, sonst Konflikt-Liste
// Zugang wie das Konten-Register (Klasse finanz-business): die Sicht entscheidet der Server (`wirksameSicht`) — Business-Bereich und Konten mit
// Finanzrecht „nur Business“ lesen nur Konten der Business-Gesellschaften ein (sonst 403); der Dienstweg (ZOE, Takt) nie (403).
// Die Datei wird NICHT gespeichert (Auszüge tragen Namen Dritter): sie kommt zur Vorschau und zum Übernehmen je einmal, höchstens 5 MB.
// Regeln: lib/finanzen/kontoauszug/{lesen,camt,csv,plan}.ts · Server: lib/finanzen/kontoauszug/server.ts · Doku: KONTEN_REGISTER.md › 8.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { planZugangVon } from '@/lib/finanzen/haushalt/zugriff';
import { istDienst } from '@/lib/zugang/dienst';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { wirksameSicht } from '@/lib/finanzen/plan/sicht';
import { einmalig } from '@/lib/store/anfragen';
import { businessGeaendert } from '@/lib/business/speicher';
import { bytesAusBase64 } from '@/lib/finanzen/kontoauszug/lesen';
import { AUSZUG_GRENZEN } from '@/lib/finanzen/kontoauszug/typen';
import { auszugVorschau, auszugUebernehmen, auszugZuruecknehmen, laeufeFuerKonto } from '@/lib/finanzen/kontoauszug/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zu den Konten. Der Inhaber trägt den Haushalt unter System → Konto ein.' };
const NICHT_DIENSTWEG = { ok: false, fehler: 'Kontoauszüge liest ein Mensch in der App ein — nicht ZOE oder ein Hintergrundlauf.' };
/** base64 einer 5-MB-Datei (≈ 6,7 MB) + Spaltenzuordnung. */
const MAX_BODY = Math.ceil(AUSZUG_GRENZEN.bytes * 4 / 3) + 64_000;

async function zugang(req: Request) {
  if (istDienst(req)) return { fehler: NextResponse.json(NICHT_DIENSTWEG, { status: 403 }) } as const;
  const z = await planZugangVon(req);
  if (!z) return { fehler: NextResponse.json(KEIN_ZUGANG, { status: 403 }) } as const;
  return { z, sicht: wirksameSicht(z.sicht, new URL(req.url).searchParams.get('sicht')) } as const;
}

export async function GET(req: Request) {
  const a = await zugang(req);
  if ('fehler' in a) return a.fehler;
  const konto = new URL(req.url).searchParams.get('konto');
  if (!konto) return NextResponse.json({ ok: false, fehler: 'Konto fehlt (?konto=…).' }, { status: 400 });
  const laeufe = await laeufeFuerKonto(a.z.haushalt, konto, a.sicht);
  if (!laeufe) return NextResponse.json({ ok: false, fehler: 'Das Konto gibt es in dieser Sicht nicht.' }, { status: 404 });
  leseZugriff(req, 'konten', { anzahl: laeufe.length });
  return NextResponse.json({ ok: true, laeufe }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const a = await zugang(req);
  if ('fehler' in a) return a.fehler;
  const { z, sicht } = a;
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: unknown; kontoId?: unknown; datei?: { inhalt?: unknown }; spalten?: unknown; basis?: unknown; trotzAbweichung?: unknown; laufId?: unknown; anfrageId?: unknown };
  try { b = await jsonBegrenzt(req, MAX_BODY); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return NextResponse.json({ ok: false, fehler: 'Kein JSON-Objekt.' }, { status: 400 });
  const ctx = { haushalt: z.haushalt, person: z.person, sicht };

  if (b.aktion === 'zuruecknehmen') {
    // Ohne `einmalig`: Zurücknehmen ist selbst idempotent (schon Entferntes zählt als „schon weg“), und die Antwort trägt die Konflikt-Zeilen
    // mit Namen der Gegenseite — die gehören nicht für 24 h in die Idempotenz-Ablage.
    const e = await auszugZuruecknehmen(ctx, b.laufId);
    if (e.ok) businessGeaendert();
    return NextResponse.json(e, { status: e.ok ? 200 : e.status });
  }
  if (b.aktion !== 'vorschau' && b.aktion !== 'uebernehmen') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion (vorschau, uebernehmen, zuruecknehmen).' }, { status: 400 });
  const bytes = bytesAusBase64(b.datei?.inhalt);
  if (!bytes) return NextResponse.json({ ok: false, fehler: 'Datei fehlt oder ist nicht lesbar.' }, { status: 400 });
  if (bytes.length > AUSZUG_GRENZEN.bytes) return NextResponse.json({ ok: false, fehler: 'Die Datei ist größer als 5 MB — bitte einen kürzeren Zeitraum herunterladen. Nichts gelesen.' }, { status: 413 });

  if (b.aktion === 'vorschau') {
    const v = await auszugVorschau(ctx, b.kontoId, bytes, b.spalten);
    leseZugriff(req, 'konten', v.ok ? { anzahl: v.zeilen.length } : {});
    return NextResponse.json(v, { status: v.ok ? 200 : v.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const r = await einmalig('kontoauszug', b.anfrageId, async () => {
    const e = await auszugUebernehmen(ctx, b.kontoId, bytes, b.spalten, b.basis, { trotzAbweichung: b.trotzAbweichung === true });
    return { status: e.ok ? 200 : e.status, body: e };
  });
  if (r.status === 200) businessGeaendert();
  return NextResponse.json(r.wiederholt ? { ...(r.body as object), wiederholt: true } : r.body, { status: r.status });
}
