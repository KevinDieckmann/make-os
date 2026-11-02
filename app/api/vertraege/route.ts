// ─── Vertrieb › Verträge (01.11.) ────────────────────────────────────────────────────────────────────────────────────
// GET                       → { vertraege (mit stand), nurEntwuerfe? } · `?pdf=<id>` → PDF (Entwurf: Vorschau mit „ENTWURF“; fertig: festgeschriebene Fassung)
//                             `?senden=<id>` → Adressen des Vertragspartners + Vorgabe-Text für den Dialog „Vertrag senden“ (sendet nichts)
//                             `?darlehen=<gesellschaft>` → Karte „Darlehen“ im Steckbrief (Rechte/Sicht der Finanzplanung, lib/vertraege/finanzen.ts)
// POST { aktion, … }:
//   anlegen       { vorlageId, gesellschaft?, vorbelegung: { angebotId?, dealId?, mandatId?, kontaktId?, firmaId? } } → Entwurf aus der Vorlage
//   speichern     { id, stand, felder }           → Entwurf ändern (Stand/409, Grenzen 413, unbekannte Platzhalter 400)
//   fertigstellen { id, stand, trotzdem? }        → Nummer {KURZ}-V-{JAHR}-{NR4}, PDF + SHA-256 als Beleg; Pflichtfelder leer → 400, ungeprüfte/geänderte
//                                                    Vorlage oder abweichende Paragraphen → 409 `warnungen` bis `trotzdem: true`
//   version       { id }                          → neue Fassung als Entwurf (die alte bleibt festgeschrieben)
//   status        { id, stand, status }           → versendet · aktiv · beendet · gekuendigt („unterschrieben“ nur über /api/vertraege/unterschrift)
//   loeschen      { id, stand }                   → nur Entwürfe
//   senden        { id, stand, postfach, an, betreff, text, uwgBestaetigt?, anfrageId } → per Mail aus einem EIGENEN Business-Postfach mit genau dem PDF
//                                                    dieses Vertrags (lib/vertraege/versand.ts); danach „versendet“, Akte, Follow-up +7 Tage. Einmal je anfrageId.
//   finanzen      { id, geber, nehmer, anfrageId? } → unterschriebenes Darlehen in die Finanzplanung übernehmen (lib/vertraege/finanzen.ts) — erst der Klick
// Zugang: Haushalt des Inhabers (Bestand je Haushalt über `businessHaushaltVon`). Rolle „nur Business“: lesen + Entwürfe — fertigstellen, version,
// status, senden, finanzen → 403. Der Dienstweg (ZOE, Takt, Skripte) stellt nie fertig, sendet nie und vermerkt nie „versendet“ (403). Gesendet wird nur per Klick.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { businessHaushaltVon } from '@/lib/zugang/konto-sicht-server';
import { istDienst } from '@/lib/zugang/dienst';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { einmalig } from '@/lib/store/anfragen';
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
    const such = new URL(req.url).searchParams;
    const darlehen = such.get('darlehen');
    if (darlehen !== null) {
      // Unternehmen › Steckbrief › „Darlehen“ (02.11.): Rechte und Sicht der FINANZPLANUNG (aus dem Konto) — serverseitig gefiltert.
      const { darlehenFuerGesellschaft } = await import('@/lib/vertraege/finanzen');
      const zeilen = await darlehenFuerGesellschaft({ haushalt: z.haushalt, gesellschaft: darlehen, req });
      if (!zeilen) return NextResponse.json({ ok: false, fehler: 'Kein Zugang zur Finanzplanung.' }, { status: 403 });
      leseZugriff(req, 'finanzplan', { anzahl: zeilen.length });
      return NextResponse.json({ ok: true, darlehen: zeilen }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const ziele = such.get('senden');
    if (ziele !== null) {
      // Dialog „Vertrag senden“: Adressen des Vertragspartners + Vorgabe-Text (sendet nichts).
      if (!/^vtr-[a-z0-9-]{4,60}$/.test(ziele)) return fehler('senden: Kennung vtr-….', 400);
      const { sendeZiele } = await import('@/lib/vertraege/versand');
      leseZugriff(req, 'vertraege', { ids: [ziele] });
      return NextResponse.json({ ok: true, ...(await sendeZiele(z.haushalt, ziele)) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const pdf = such.get('pdf');
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

const NUR_PERSON = new Set(['fertigstellen', 'status', 'version', 'senden', 'finanzen']);

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: string; id?: unknown; stand?: unknown; felder?: unknown; vorlageId?: unknown; gesellschaft?: unknown; vorbelegung?: unknown; trotzdem?: unknown; status?: unknown; postfach?: unknown; an?: unknown; betreff?: unknown; text?: unknown; uwgBestaetigt?: unknown; anfrageId?: unknown; geber?: unknown; nehmer?: unknown };
  try { b = await jsonBegrenzt(req, 256 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const aktion = String(b.aktion ?? '');
  if (NUR_PERSON.has(aktion) && istDienst(req)) return fehler('Fertigstellen, Senden, Status, Version und die Übernahme in die Finanzen nur per Klick einer Person — nie der Dienstweg.', 403);
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
      case 'status': {
        // 02.11.: beendet/gekündigt zieht den Register-Eintrag mit — klappt das nicht, sagt es der Hinweis.
        const hinweise: string[] = [];
        const v = await vertragStatus({ ...basis, id, stand: b.stand, status: b.status, hinweise });
        // Übernommenes Darlehen: beendet/gekündigt → offene Raten verschwinden aus der Liquidität (bezahlte bleiben).
        if (v.finanzen) { const { ratenAbgleichen } = await import('@/lib/vertraege/finanzen'); await ratenAbgleichen(v, wer).catch(e => { console.error('[vertraege] Raten', (e as Error)?.message); hinweise.push('Die offenen Raten in der Liquidität konnten nicht nachgezogen werden — bitte dort prüfen.'); }); }
        return NextResponse.json({ ok: true, vertrag: mitStand(v), ...(hinweise.length ? { hinweise } : {}) });
      }
      case 'loeschen': await vertragLoeschen({ haushalt: z.haushalt, id, stand: b.stand, wer }); return NextResponse.json({ ok: true });
      case 'senden': {
        const { vertragSenden } = await import('@/lib/vertraege/versand');
        const r = await einmalig('vertrag-senden', b.anfrageId, async () => {
          try { return await vertragSenden({ ...basis, id, stand: b.stand, postfach: b.postfach, an: b.an, betreff: b.betreff, text: b.text, uwgBestaetigt: b.uwgBestaetigt === true, wer }); }
          catch (e) { if (e instanceof VertragFehler) return { status: e.status, body: { ok: false, fehler: e.message, ...e.extra } }; throw e; }
        }, undefined, { wer: z.person });
        return NextResponse.json(r.body, { status: r.status });
      }
      case 'finanzen': {
        const { vertragInFinanzen } = await import('@/lib/vertraege/finanzen');
        const r = await einmalig<Record<string, unknown>>('vertrag-finanzen', b.anfrageId, async () => {
          try { return { status: 200, body: { ok: true, ...(await vertragInFinanzen({ ...basis, id, geber: b.geber, nehmer: b.nehmer, req, wer })) } }; }
          catch (e) { if (e instanceof VertragFehler) return { status: e.status, body: { ok: false, fehler: e.message, ...e.extra } }; throw e; }
        }, undefined, { wer: z.person });
        return NextResponse.json(r.body, { status: r.status });
      }
      default: return fehler('aktion: anlegen, speichern, fertigstellen, version, status, loeschen, senden oder finanzen.', 400);
    }
  } catch (e) { return ausFehler(e); }
}
