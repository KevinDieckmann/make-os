// ─── Fulfillment — Personenteil der Dossiers (C3, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 9 / 4.5) ──────────────────────────────────────────
// Berufliche Personenkarten eines Mandats — GETRENNT vom Dossier (eigener Bestand, Löschfrist Mandatsende + 90 Tage, einstellbar).
// Tor `personenteilZugang`: nur der Inhaber oder ein Mitglied OHNE `finanzRecht: 'business'` — sonst 403 (der Rest von Fulfillment bleibt sichtbar).
// GET  `?m=` → Karten mit Stand, Art.-14-Uhr und fertigem Hinweistext, Mängel vor „geprüft“, Stand eines verknüpften CRM-Kontakts. Lese-Protokoll
//        „personenrecherche“ (nur Kennungen als Fingerabdruck und Anzahl).
// POST `{ aktion, mandatId, id, stand, … }` → pruefen · art14 (gegeben am · wie) · verknuepfen (Kontakt) · angabe-entfernen · loeschen — nur per Sitzung.
// Logik: lib/fulfillment/analyse/personen-server.ts.

import { NextResponse } from 'next/server';
import { personenteilZugang } from '@/lib/fulfillment/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff, leseKennung } from '@/lib/store/leseprotokoll';
import { personenLage, personenAktion } from '@/lib/fulfillment/analyse/personen-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await personenteilZugang(req);
  if (z instanceof Response) return z;
  const r = await personenLage(new URL(req.url).searchParams.get('m') ?? '');
  if (r.status === 200) leseZugriff(req, 'personenrecherche', { ids: (r.ids ?? []).map(leseKennung), anzahl: r.ids?.length ?? 0 }); // Lese-Protokoll: berufliche Personenkarten
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(req: Request) {
  const z = await personenteilZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return NextResponse.json({ ok: false, fehler: 'Kein JSON-Objekt.' }, { status: 400 });
  const r = await personenAktion(b, z.person, werAus(req));
  if (r.status === 200) leseZugriff(req, 'personenrecherche', { anzahl: Array.isArray(r.body.karten) ? r.body.karten.length : 0 }); // die Antwort trägt die Karten
  return NextResponse.json(r.body, { status: r.status });
}
