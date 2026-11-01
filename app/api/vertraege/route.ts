// ─── Vertrieb › Verträge (01.11.) ────────────────────────────────────────────────────────────────────────────────────
// GET                       → { vertraege (mit stand), nurEntwuerfe? } · `?pdf=<id>` → PDF (Entwurf: Vorschau mit „ENTWURF“; fertig: festgeschriebene Fassung)
// POST { aktion, … }:
//   anlegen       { vorlageId, gesellschaft?, vorbelegung: { angebotId?, dealId?, mandatId?, kontaktId?, firmaId? } } → Entwurf aus der Vorlage
//   speichern     { id, stand, felder }           → Entwurf ändern (Stand/409, Grenzen 413, unbekannte Platzhalter 400)
//   fertigstellen { id, stand, trotzdem? }        → Nummer {KURZ}-V-{JAHR}-{NR4}, PDF + SHA-256 als Beleg; Pflichtfelder leer → 400, ungeprüfte/geänderte
//                                                    Vorlage oder abweichende Paragraphen → 409 `warnungen` bis `trotzdem: true`
//   version       { id }                          → neue Fassung als Entwurf (die alte bleibt festgeschrieben)
//   status        { id, stand, status }           → versendet · aktiv · beendet · gekuendigt („unterschrieben“ nur über /api/vertraege/unterschrift)
//   loeschen      { id, stand }                   → nur Entwürfe
// Zugang: Haushalt des Inhabers (Bestand je Haushalt über `businessHaushaltVon`). Rolle „nur Business“: lesen + Entwürfe — fertigstellen, version,
// status → 403. Der Dienstweg (ZOE, Takt, Skripte) stellt nie fertig und vermerkt nie „versendet“ (403). Nichts wird versendet.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { businessHaushaltVon } from '@/lib/zugang/konto-sicht-server';
import { istDienst } from '@/lib/zugang/dienst';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { VertragFehler, entwurfPdf, mitStand, vertraegeLaden, vertragAnlegen, vertragFertigstellen, vertragLoeschen, vertragSpeichern, vertragStatus, vertragVersion } from '@/lib/vertraege/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Verträge gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
function ausFehler(e: unknown) {
  if (e instanceof VertragFehler) return fehler(e.message, e.status, e.extra);
  console.error('[vertraege]', (e as Error)?.message);
  return fehler('Vertrag nicht gespeichert — interner Fehler.', 500);
}

async function zugang(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return null;
  return businessHaushaltVon(req);
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  try {
    const pdf = new URL(req.url).searchParams.get('pdf');
    if (pdf) {
      if (!/^vtr-[a-z0-9-]{4,60}$/.test(pdf)) return fehler('pdf: Kennung vtr-….', 400);
      leseZugriff(req, 'vertraege', { ids: [pdf] });
      const d = await entwurfPdf({ haushalt: z.haushalt, id: pdf });
      return new NextResponse(Buffer.from(d.bytes), { headers: {
        'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.name)}`,
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store',
      } });
    }
    const vertraege = await vertraegeLaden(z.haushalt);
    leseZugriff(req, 'vertraege', { anzahl: vertraege.length });
    return NextResponse.json({ ok: true, vertraege: vertraege.map(mitStand), ...(z.nurBusiness ? { nurEntwuerfe: true } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return ausFehler(e); }
}

const NUR_PERSON = new Set(['fertigstellen', 'status', 'version']);

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: string; id?: unknown; stand?: unknown; felder?: unknown; vorlageId?: unknown; gesellschaft?: unknown; vorbelegung?: unknown; trotzdem?: unknown; status?: unknown };
  try { b = await jsonBegrenzt(req, 256 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const aktion = String(b.aktion ?? '');
  if (NUR_PERSON.has(aktion) && istDienst(req)) return fehler('Fertigstellen, Status und Version nur per Klick einer Person — nie der Dienstweg.', 403);
  if (NUR_PERSON.has(aktion) && z.nurBusiness) return fehler('Für dieses Konto nur Entwürfe.', 403, { grund: 'nur-entwurf' });
  const wer = werAus(req);
  const id = typeof b.id === 'string' ? b.id : '';
  const basis = { haushalt: z.haushalt, person: z.person, wer };
  try {
    switch (aktion) {
      case 'anlegen': {
        const v = await vertragAnlegen({ ...basis, vorlageId: b.vorlageId, gesellschaft: b.gesellschaft, vorbelegung: b.vorbelegung && typeof b.vorbelegung === 'object' ? b.vorbelegung as Record<string, unknown> : {} });
        return NextResponse.json({ ok: true, vertrag: mitStand(v) });
      }
      case 'speichern': return NextResponse.json({ ok: true, vertrag: mitStand(await vertragSpeichern({ ...basis, id, stand: b.stand, felder: b.felder && typeof b.felder === 'object' ? b.felder as Record<string, unknown> : {} })) });
      case 'fertigstellen': {
        const r = await vertragFertigstellen({ ...basis, id, stand: b.stand, trotzdem: b.trotzdem === true });
        return NextResponse.json({ ok: true, vertrag: mitStand(r.vertrag), pdf: r.pdf, ...(r.mail ? { mail: r.mail } : {}) });
      }
      case 'version': return NextResponse.json({ ok: true, vertrag: mitStand(await vertragVersion({ ...basis, id })) });
      case 'status': return NextResponse.json({ ok: true, vertrag: mitStand(await vertragStatus({ ...basis, id, stand: b.stand, status: b.status })) });
      case 'loeschen': await vertragLoeschen({ haushalt: z.haushalt, id, stand: b.stand, wer }); return NextResponse.json({ ok: true });
      default: return fehler('aktion: anlegen, speichern, fertigstellen, version, status oder loeschen.', 400);
    }
  } catch (e) { return ausFehler(e); }
}
