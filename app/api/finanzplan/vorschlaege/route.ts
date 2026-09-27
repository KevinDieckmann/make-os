// ─── Finanzplanung jetzt: Vorschläge aus dem CRM (nur lesen) ─────────────────
// GET → { produkte, istBasis, inSzenarien } — Produkte des Katalogs, wie die
// Planung sie braucht (Preis, Basis, Laufzeit, was fehlt), aktive Mandate und
// gewonnene Deals als Ist-Basis für Umsatzbausteine, und je Produkt die
// Planszenarien, in denen es steckt (für die Produktseite). Schreibt nie ins
// CRM. Zugang wie der Plan: nur mit Haushalt am Konto. Ohne CRM-Bestand kommen
// leere Listen — die Planung läuft auch ohne.

import { NextResponse } from 'next/server';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ladeCrm } from '@/lib/crm/speicher';
import { ladeFinanzplan } from '@/lib/finanzen/plan/speicher';
import { produktVorschlaege, istBasisVorschlaege, produktInSzenarien } from '@/lib/finanzen/produkte';
import { planszenarienVon } from '@/lib/finanzen/szenarien';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zur Finanzplanung. Der Inhaber trägt den Haushalt unter System → Konto ein.' };

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const [crm, plan] = await Promise.all([ladeCrm().catch(() => null), ladeFinanzplan(z.haushalt)]);
  const heute = plan?.einstellungen.heute ?? heuteBerlin();
  return NextResponse.json({
    ok: true,
    produkte: crm ? produktVorschlaege(crm) : [],
    istBasis: crm ? istBasisVorschlaege(crm, heute) : [],
    inSzenarien: plan ? produktInSzenarien(planszenarienVon(plan), plan.arbeitsplan) : {},
    arbeitsplan: plan?.arbeitsplan ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
