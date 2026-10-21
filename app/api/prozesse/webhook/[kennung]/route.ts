// ─── Prozesse — Webhook von außen (Etappe B1, 21.10.; Entscheidung 21.10.: „Ja, abgesichert“) ────────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar — NUR `POST /api/prozesse/webhook/pw-<24 hex>` (Middleware `PROZESS_WEBHOOK`, eng gefasste Regex) — „offen, aber selbst geprüft“:
//   · Drossel je Netz (Fehlversuche) und je Adresse (angenommene Aufrufe) — lib/zugang/drossel.ts;
//   · Körper ≤ 64 KB (`jsonBegrenzt`, sonst 413), nur JSON-Objekt;
//   · Adresse unbekannt, nicht scharf, Schlüssel fehlt oder falsch (`Authorization: Bearer …` bzw. `X-Make-Webhook-Schluessel`) → dieselbe 404;
//   · nur die Felder des Schemas am Auslöser, der Rest wird verworfen; 400 nennt nur Feld-Kennungen, nie Werte;
//   · schreibt NUR einen Eingang (fremder Text) und EIN Ereignis `webhook` — gestartet wird ein Lauf erst vom Motor (Etappe C). Handelt für niemanden,
//     liefert nie Daten (202 mit der Kennung des Eingangs als Quittung).
// Nie der Dienstschlüssel: der Schlüssel öffnet nur diese eine Adresse.

import { NextResponse } from 'next/server';
import { adresseNetz, pruefe, fehlschlag } from '@/lib/zugang/drossel';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { PROZESS_GRENZEN, WEBHOOK_KENNUNG } from '@/lib/prozesse/definition';
import { schluesselAusKopf, WEBHOOK_UNBEKANNT } from '@/lib/prozesse/webhook';
import { webhookAnnehmen } from '@/lib/prozesse/webhook-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOPF = { 'Cache-Control': 'no-store' } as const;
const unbekannt = () => NextResponse.json({ ok: false, fehler: WEBHOOK_UNBEKANNT }, { status: 404, headers: KOPF });
/** Angenommene Aufrufe je Adresse frei im Fenster (15 Min.) — darüber wächst die Wartezeit (lib/zugang/drossel.ts). */
const JE_ADRESSE_FREI = 60;

export async function POST(req: Request, ctx: { params: Promise<{ kennung: string }> }) {
  const { kennung } = await ctx.params;
  const netz = `prozess-webhook:${adresseNetz(req)}`;
  if (!pruefe(netz).erlaubt) return NextResponse.json({ ok: false, fehler: 'Zu viele Versuche.' }, { status: 429, headers: KOPF });
  if (!WEBHOOK_KENNUNG.test(kennung)) { fehlschlag(netz, Date.now(), 20); return unbekannt(); }
  const adresse = `prozess-webhook-adresse:${kennung}`;
  if (!pruefe(adresse).erlaubt) return NextResponse.json({ ok: false, fehler: 'Zu viele Aufrufe.' }, { status: 429, headers: KOPF });
  let koerper: unknown;
  try { koerper = await jsonBegrenzt(req, PROZESS_GRENZEN.webhookKoerper); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400, headers: KOPF }); }
  const r = await webhookAnnehmen(kennung, schluesselAusKopf(req.headers), koerper).catch(() => ({ status: 503 as const }));
  if (r.status === 404) { fehlschlag(netz, Date.now(), 20); return unbekannt(); }
  if (r.status === 400) return NextResponse.json({ ok: false, fehler: 'Felder passen nicht zum Schema.', felder: r.fehler }, { status: 400, headers: KOPF });
  if (r.status === 503) return NextResponse.json({ ok: false, fehler: 'Gerade nicht annehmbar — bitte später noch einmal.' }, { status: 503, headers: { ...KOPF, 'Retry-After': '60' } });
  fehlschlag(adresse, Date.now(), JE_ADRESSE_FREI);
  return NextResponse.json({ ok: true, eingang: r.eingang }, { status: 202, headers: KOPF });
}
