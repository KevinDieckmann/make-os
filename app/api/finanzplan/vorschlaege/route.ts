// ─── Finanzplanung jetzt: Vorschläge aus dem CRM (nur lesen) ─────────────────
// GET → { produkte, istBasis, inSzenarien } — Produkte des Katalogs, wie die
// Planung sie braucht (Preis, Basis, Laufzeit, was fehlt), aktive Mandate und
// gewonnene Deals als Ist-Basis für Umsatzbausteine, und je Produkt die
// Planszenarien, in denen es steckt (für die Produktseite). Schreibt nie ins
// CRM. Ohne CRM-Bestand kommen leere Listen — die Planung läuft auch ohne.
// Zugang wie die Finanzplanung selbst (19.10., Rundgang A5 — vorher nur volle Haushaltsmitglieder, ein Konto „nur Business“ bekam 403 und sah in
// Planen „Produkt (nicht im Katalog)“): `planZugangVon` entscheidet aus dem Konto, `wirksameSicht` wie `/api/finanzplan?sicht=business`. In der
// Business-Sicht nur, was die Business-Planung tragen kann (`BUSINESS_BAUSTEIN` — dieselbe Regel wie `businessSicht` für die Bausteine): keine Produkte,
// Mandate oder Deals der Selbstständigkeit (Privat), Szenarien nur aus dem gefilterten Dokument, Arbeitsplan des Business-Bereichs.

import { NextResponse } from 'next/server';
import { planZugangVon } from '@/lib/finanzen/haushalt/zugriff';
import { ladeCrm } from '@/lib/crm/speicher';
import { ladeFinanzplan } from '@/lib/finanzen/plan/speicher';
import { BUSINESS_BAUSTEIN, fuerSicht, wirksameSicht } from '@/lib/finanzen/plan/sicht';
import { produktVorschlaege, istBasisVorschlaege, produktInSzenarien, einheitAusGesellschaft } from '@/lib/finanzen/produkte';
import { arbeitsplanFuer, planszenarienVon } from '@/lib/finanzen/szenarien';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zur Finanzplanung. Der Inhaber trägt den Haushalt unter Einstellungen › Konto ein.' };

export async function GET(req: Request) {
  const z = await planZugangVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  leseZugriff(req, 'finanzplan');
  const sicht = wirksameSicht(z.sicht, new URL(req.url).searchParams.get('sicht'));
  const [crm, roh] = await Promise.all([ladeCrm().catch(() => null), ladeFinanzplan(z.haushalt)]);
  const plan = roh ? fuerSicht(roh, sicht) : null;
  const heute = plan?.einstellungen.heute ?? heuteBerlin();
  const business = sicht === 'business';
  const imBusiness = (g: Parameters<typeof einheitAusGesellschaft>[0]) => BUSINESS_BAUSTEIN(einheitAusGesellschaft(g));
  const produkte = crm ? produktVorschlaege(crm) : [];
  const istBasis = crm ? istBasisVorschlaege(crm, heute) : [];
  const arbeitsplan = plan ? (business ? arbeitsplanFuer(plan, 'business')?.id ?? null : plan.arbeitsplan ?? null) : null;
  return NextResponse.json({
    ok: true,
    produkte: business ? produkte.filter(p => BUSINESS_BAUSTEIN(p.planEinheit)) : produkte,
    istBasis: business ? istBasis.filter(b => imBusiness(b.gesellschaft)) : istBasis,
    inSzenarien: plan ? produktInSzenarien(planszenarienVon(plan), arbeitsplan) : {},
    arbeitsplan,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
