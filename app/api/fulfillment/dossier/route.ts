// ─── Fulfillment — Dossier je Mandat (C3, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 9 / 4.4–4.6) ─────────────────────────────────────────────
// GET  `?m=` → Dossier OHNE Personenteil (Entwürfe der Personen-Läufe nur als Zähler; Tiefenbericht nur als Verweis, die Kennung nur für die
//        auslösende Person), Deckblatt (Version, Stand, Quellenstand, Löschtag des Personenteils), Beleg-Quote, Vorschlag fürs Anlegen aus der
//        CRM-Firmenakte. Lese-Protokoll „fulfillment“ (Mandate & Dossiers). Liest nur.
// POST `{ aktion, mandatId, stand?, … }` → anlegen · eingaben · lia · f1 · uebernehmen (Lauf → Abschnitte, nur angehakte) · verwerfen · pruefen
//        (deterministisch, in derselben Sperre) · ueberstimmen (nur Qualität, mit Grund) · f2 (nur mit bestandener Prüfung) · aussage-hand ·
//        aussage-entfernen · firma-uebernehmen / nach-fall (liefern den Schritt für den vorhandenen Schreibweg — der Browser schickt ihn per Klick).
// Tor: `fulfillmentZugang` (Haushalt des Inhabers, Sicht Privat 403, schreiben nur per Sitzung + Bau-Kennung). Fremder Stand → 409 mit Dossier.
// Logik: lib/fulfillment/analyse/dossier-server.ts.

import { NextResponse } from 'next/server';
import { fulfillmentZugang, mandatAusserSicht } from '@/lib/fulfillment/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { dossierLage, dossierAktion, dossierListe } from '@/lib/fulfillment/analyse/dossier-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Größe eines Schritts (Interessenabwägung, Aussage mit Text) — darüber 413. */
const MAX_BYTES = 64_000;

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const q = new URL(req.url).searchParams;
  if (q.get('alle') === '1') {
    const l = await dossierListe(z.privat);
    leseZugriff(req, 'fulfillment', { anzahl: Array.isArray(l.body.dossiers) ? l.body.dossiers.length : 0 }); // Lese-Protokoll: Übersicht der Dossiers (nur Zahlen)
    return NextResponse.json(l.body, { status: l.status });
  }
  const m = q.get('m') ?? '';
  { const nein = await mandatAusserSicht(z, m, 'lesen'); if (nein) return nein; }
  const r = await dossierLage(m, z.person);
  if (r.status === 200) leseZugriff(req, 'fulfillment', { ids: [m] }); // Lese-Protokoll: Dossier eines Mandats (Firma; Personen nur als Verweis)
  return NextResponse.json(r.body, { status: r.status });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return NextResponse.json({ ok: false, fehler: 'Kein JSON-Objekt.' }, { status: 400 });
  { const nein = await mandatAusserSicht(z, b.mandatId, 'schreiben'); if (nein) return nein; }
  const r = await dossierAktion(b, z.person, werAus(req));
  return NextResponse.json(r.body, { status: r.status });
}
