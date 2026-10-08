// ─── Konten-Register (08.10.) — Konten und Kontostände des Haushalts ───────────────────────────────────────────────────────────────────
// GET  → { ok, konten (IBAN nur maskiert), gesellschaften (Kasse je Gesellschaft, die das Register führt), privat?, ruecklage?, sicht, darf }
//        ?nur=kasse → ohne Konten (für Ansichten, die nur rechnen) · ?uebernahme=1 → Vorschau der Übernahme (schreibt nichts)
// POST { ops: [{ op: 'konto-neu', konto, stand0? } | { op: 'konto-aendern', id, stand, felder } | { op: 'stand-neu', id, betrag, datum, notiz?, stand? }
//        | { op: 'stand-zuruecknehmen', id, standId, stand? } | { op: 'archivieren', id, stand, aus? }] }  → alles oder nichts, Stand je Konto (409)
//      { aktion: 'uebernahme', basis }  → die bisherigen Stände übernehmen (nur mit der Kennung der gesehenen Vorschau, sonst 409)
// Trennung serverseitig (Plattform-Regel): die Sicht entscheidet der Server — `wirksameSicht(Konto, ?sicht)`: Konten mit Finanzrecht „nur
// Business“ und der Business-Bereich (`?sicht=business`) bekommen NUR die Konten der Business-Gesellschaften; Privat- und gemeinsame Konten
// sehen und ändern nur volle Haushaltsmitglieder. Schreiben auf Konten außerhalb der Sicht → 403, der Dienstweg (ZOE, Takt) → 403.
// Regeln: lib/finanzen/konten/register.ts · Server: lib/finanzen/konten/server.ts · Befund: KONTEN_REGISTER.md.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { planZugangVon } from '@/lib/finanzen/haushalt/zugriff';
import { istDienst } from '@/lib/zugang/dienst';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { wirksameSicht } from '@/lib/finanzen/plan/sicht';
import { kontostaendeFuer, registerAendern, uebernahmeVorschau, uebernahmeAusfuehren } from '@/lib/finanzen/konten/server';
import { GRENZEN, type KontoOp } from '@/lib/finanzen/konten/register';
import { businessGeaendert } from '@/lib/business/speicher';
import { ladeKonten } from '@/lib/zugang/konten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zu den Konten. Der Inhaber trägt den Haushalt unter System → Konto ein.' };
const NICHT_DIENSTWEG = { ok: false, fehler: 'Konten und Kontostände trägt ein Mensch in der App ein — nicht ZOE oder ein Hintergrundlauf.' };
const MAX_BODY = 256_000;

/** Zugang + Sicht. Der Dienstweg nie (Human-in-the-Loop); ohne Haushalt kein Register. */
async function zugang(req: Request) {
  if (istDienst(req)) return { fehler: NextResponse.json(NICHT_DIENSTWEG, { status: 403 }) } as const;
  const z = await planZugangVon(req);
  if (!z) return { fehler: NextResponse.json(KEIN_ZUGANG, { status: 403 }) } as const;
  return { z, sicht: wirksameSicht(z.sicht, new URL(req.url).searchParams.get('sicht')) } as const;
}

export async function GET(req: Request) {
  const a = await zugang(req);
  if ('fehler' in a) return a.fehler;
  const { z, sicht } = a;
  const q = new URL(req.url).searchParams;
  if (q.get('uebernahme') === '1') {
    leseZugriff(req, 'konten');
    return NextResponse.json({ ok: true, sicht, ...(await uebernahmeVorschau(z.haushalt, sicht)) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const lage = await kontostaendeFuer(z.haushalt, sicht);
  leseZugriff(req, 'konten', { anzahl: lage.konten.length });
  const { konten, ...kassen } = lage;
  if (q.get('nur') === 'kasse') return NextResponse.json({ ok: true, ...kassen }, { headers: { 'Cache-Control': 'no-store' } });
  // Wessen Konto (nur Privat-Sicht): die Personen des Haushalts mit Namen — für die Auswahl am Privat-Konto.
  const personen = sicht === 'privat' ? (await ladeKonten()).konten.filter(k => k.haushalt === z.haushalt).map(k => ({ speicher: k.speicher, name: k.name })) : undefined;
  return NextResponse.json({ ok: true, ...kassen, konten, ...(personen ? { personen } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const a = await zugang(req);
  if ('fehler' in a) return a.fehler;
  const { z, sicht } = a;
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { ops?: unknown; aktion?: unknown; basis?: unknown };
  try { b = await jsonBegrenzt(req, MAX_BODY); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return NextResponse.json({ ok: false, fehler: 'Kein JSON-Objekt.' }, { status: 400 });

  if (b.aktion === 'uebernahme') {
    const r = await uebernahmeAusfuehren(z.haushalt, sicht, z.person, b.basis);
    if (!r.ok) return NextResponse.json(r, { status: r.status });
    if (r.konten || r.staende) businessGeaendert();
    return NextResponse.json(r);
  }
  if (b.aktion !== undefined) return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion (uebernahme).' }, { status: 400 });
  if (!Array.isArray(b.ops) || !b.ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  if (b.ops.length > GRENZEN.ops) return NextResponse.json({ ok: false, fehler: `Höchstens ${GRENZEN.ops} Schritte auf einmal — nichts gespeichert.` }, { status: 413 });
  const r = await registerAendern(z.haushalt, b.ops as KontoOp[], z.person, sicht);
  if (!r.ok) return NextResponse.json(r, { status: r.status });
  businessGeaendert();
  return NextResponse.json(r);
}
