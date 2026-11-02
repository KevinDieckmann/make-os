// ─── Bausteine bestellen — Verwaltung (31.10.) ────────────────────────────────────────────────────────────────────────────────────
// GET  → Haushalt des Inhabers mit Person: Einstellungen, was fehlt, Bestellungen (offen + erledigt, mit Rechnungs-Stand), Gesellschaften zur Wahl.
//        Lese-Protokoll Bereich „bausteine“ (nur Anzahl). Schreibt nichts.
// POST nur eine Person per Sitzung (Dienstweg 403), mit Bau-Kennung:
//   { aktion: 'einstellungen', aktiv?, gesellschaft?, zahlungszielTage?, bedingungenText? } — nur ein Inhaber (Einschalten nur, wenn alles da ist, sonst 409)
//   { aktion: 'freigeben', id }   — Rechnung stellen + Mail mit Rechnung und Download-Links (der EINE Klick; idempotent)
//   { aktion: 'ablehnen', id, grund?, absage? } — Entwurf weg, Status abgelehnt; nach außen nur mit `absage: true` (neutrale Absage)
//   { aktion: 'links-neu', id }   — neue Download-Links an die bestellende Person (abgelaufener Link)

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { darfSteuern, NUR_STEUERN } from '@/lib/zugang/steuern';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { BEDINGUNGEN_VORGABE, EINSTELLUNGEN } from '@/lib/bausteine/regeln';
import { BausteinFehler, bausteineLage, bestellungAblehnen, bestellungFreigeben, bestellungenStand, einstellungenSetzen, gesellschaftWahl, katalogLaden, linksNeuSenden } from '@/lib/bausteine/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });

async function stand(person: string) {
  const [l, liste, wahl, inhaber, katalog] = await Promise.all([bausteineLage(), bestellungenStand(), gesellschaftWahl(), darfSteuern(person), katalogLaden().catch(() => [])]);
  return {
    ok: true,
    einstellungen: { aktiv: l.e.aktiv, gesellschaft: l.e.gesellschaft ?? '', zahlungszielTage: l.zahlungszielTage, bedingungenText: l.e.bedingungenText ?? '', bedingungenVorgabe: BEDINGUNGEN_VORGABE.join('\n') },
    bereit: l.e.aktiv && !l.gruende.length, gruende: l.gruende, bedingungen: l.bedingungen, gesellschaften: wahl, istInhaber: inhaber,
    katalog: katalog.length, absender: l.lage?.ueber ?? null, ...liste,
  };
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const s = await stand(z.person);
  leseZugriff(req, 'bausteine', { anzahl: s.offen.length + s.erledigt.length });
  return NextResponse.json(s, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 8 * 1024); } catch (x) { return jsonZuGross(x) ?? fehler('Kein JSON.', 400); }
  const wer = werAus(req);
  const id = typeof b.id === 'string' ? b.id : '';
  try {
    if (b.aktion === 'einstellungen') {
      // Marketing steuern (02.11., Prüfung D): Inhaber ODER volles Mitglied des Haushalts (lib/zugang/steuern.ts).
      if (!(await darfSteuern(z.person))) return fehler(NUR_STEUERN, 403);
      const teil: Record<string, unknown> = {};
      for (const k of ['aktiv', 'gesellschaft', 'zahlungszielTage', 'bedingungenText']) if (k in b) teil[k] = b[k];
      await einstellungenSetzen(teil, z.person);
      await protokolliere(EINSTELLUNGEN, [{ op: 'geaendert', id: 'einstellungen', felder: Object.keys(teil) }], wer);
      return NextResponse.json(await stand(z.person));
    }
    if (b.aktion === 'freigeben') {
      const r = await bestellungFreigeben({ id, person: z.person, wer });
      return NextResponse.json({ ...(await stand(z.person)), schon: r.schon, ...(r.nummer ? { nummer: r.nummer } : {}) });
    }
    if (b.aktion === 'ablehnen') {
      await bestellungAblehnen({ id, person: z.person, wer, grund: b.grund, absage: b.absage === true });
      return NextResponse.json(await stand(z.person));
    }
    if (b.aktion === 'links-neu') {
      await linksNeuSenden({ id, person: z.person, wer });
      return NextResponse.json(await stand(z.person));
    }
    return fehler('aktion: einstellungen | freigeben | ablehnen | links-neu.', 400);
  } catch (x) {
    if (x instanceof BausteinFehler) return fehler(x.message, x.status);
    console.error('[bausteine] Verwaltung:', x instanceof Error ? x.message.slice(0, 200) : 'Fehler');
    return fehler('Das ging gerade nicht — bitte noch einmal.', 500);
  }
}
