// ─── Markttraktion · Angebots-Tool (28.09.) ─────────────────────────────────
// GET                     → { angebote (mit stand), gesellschaften (nur Absender-Felder, IBAN maskiert, `luecken`), vorgabe } — zieht vorher den Ablauf nach
//                           `vorgabe` (08.10.): die operative Business-Gesellschaft aus dem Register oder null (dann wählt der Mensch).
// POST { aktion, … }:
//   speichern  { id?, felder, stand? }      → Entwurf anlegen/ändern (Stand/409, Grenzen 413)
//   stellen    { id, stand, nachfassenAm? } → Nummer, PDF in die Ablage, Deal/Follow-up/Aktivität (409 bei Sperre)
//   annehmen   { id, stand }                → Deal gewonnen; seit 29.10. Mandat + Liquiplan automatisch (`automatik`, mit Rückgängig)
//   mandat-zurueck { id }                   → Rückgängig der Automatik (nur ohne Rechnung/Fall; nie Dienstweg)
//   ablehnen   { id, stand, grund }         → Deal verloren mit Grund (Grund Pflicht)
//   version    { id }                       → neue Fassung als Entwurf mit Bezug
//   loeschen   { id, stand }                → nur Entwürfe, nur aus dem Papierkorb (endgültig, 04.10.)
//   ablage     { id, art: archiv|papierkorb, zurueck? } → Archiv (jeder Status) bzw. Papierkorb (nur Entwürfe), hinein/zurück (04.10.)
//   gesendet   { id }                       → „Mail ist raus“: Aktivität „Angebot <Nummer> gesendet“ am Kontakt (zählt als Kontakt) — nur per
//                                            Klick einer Person, nie der Dienstweg (08.10., Woche 2 · 3.15; beim Stellen steht nur „gestellt“)
// GET liefert seit 31.10. `automatikZurueck` (Angebot → Mandat, „Rückgängig“ noch möglich).
// GET liefert seit 04.10. `papierkorb` getrennt (Entwürfe im Papierkorb) — `angebote` enthält sie nicht mehr.
// Zugang: Haushalt des Inhabers (Default-Deny); Stellen braucht dazu eine benannte Person mit Haushalt
// (Dateiablage und Gesellschaften liegen je Haushalt). Nichts wird versendet — das Mail-Programm öffnet der Browser.
// Rolle „nur Business“ (13.10., Kevin: „Nur lesen + Entwürfe“; Regel lib/crm/nur-business.ts): liest nur Angebote einer Business-Gesellschaft
// (GET mit `nurEntwuerfe: true`, Absender nur Business), darf Entwürfe speichern und Entwürfe ablegen/löschen — stellen, annehmen, ablehnen,
// version, gesendet → 403 (NUR_ENTWURF). Haushalt über `businessHaushaltVon` (sonst bekäme sie keine Absender-Vorgaben).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { businessHaushaltVon } from '@/lib/zugang/konto-sicht-server';
import { angebotAktionNurBusiness, angebotFuerNurBusiness, gesellschaftenFuerNurBusiness } from '@/lib/crm/nur-business';
import { imBusiness } from '@/lib/crm/treppe';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ladeCrmMitPapierkorb } from '@/lib/crm/speicher';
import { absenderFuerAnzeige } from '@/lib/crm/gesellschaften';
import { absenderVorgabe } from '@/lib/gesellschaften/server';
import { AngebotFehler, ablaufNachziehen, angebotAblage, angebotEntwurfPdf, angebotGmailEntwurf, angebotAblehnen, angebotAnnehmen, angebotGesendet, angebotLoeschen, angebotSpeichern, angebotStellen, angebotVersion, gesellschaftenLaden, mitStand } from '@/lib/crm/angebot-server';
import { istDienst } from '@/lib/zugang/dienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = { ok: false, fehler: 'Nur im Haushalt des Inhabers.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
function ausFehler(e: unknown) {
  if (e instanceof AngebotFehler) return fehler(e.message, e.status, e.extra);
  const status = (e as { status?: number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 600) return fehler((e as Error).message, status);
  console.error('[crm/angebot]', (e as Error)?.message);
  return fehler('Angebot nicht gespeichert — interner Fehler.', 500);
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(GESPERRT, { status: 403 });
  try {
    await ablaufNachziehen();
    const h = await businessHaushaltVon(req);
    const nurBusiness = !!h?.nurBusiness;
    const crm = await ladeCrmMitPapierkorb();
    // Rolle „nur Business“ (13.10.): nur Angebote und Absender einer Business-Gesellschaft — serverseitig, nie nur ausgeblendet.
    const alle = (crm.angebote ?? []).filter(a => !nurBusiness || angebotFuerNurBusiness(a));
    // Absender mit `luecken` (08.10., Sofort-Paket 3.1): sonst erschien „Absender … fehlt“ nie und erst „Senden“ scheiterte. Nur Absender-Felder — nie Cap-Table/Verträge.
    const absender = (await gesellschaftenLaden(h?.haushalt)).map(absenderFuerAnzeige);
    const vorgabe = await absenderVorgabe(h?.haushalt);
    // 31.10.: angenommene Angebote, deren automatisch angelegtes Mandat „Rückgängig“ noch kann (Angebot → Mandat) — nicht für „nur Business“ (darf es nicht).
    const automatikZurueck = nurBusiness ? {} : await (await import('@/lib/crm/mandat-automatik-server')).zuruecknehmbareAngebote().catch(() => ({}));
    return NextResponse.json({
      ok: true, angebote: alle.filter(a => !a.geloeschtAm).map(mitStand), papierkorb: alle.filter(a => a.geloeschtAm).map(mitStand),
      gesellschaften: nurBusiness ? gesellschaftenFuerNurBusiness(absender) : absender,
      vorgabe: nurBusiness && vorgabe && !imBusiness({ gesellschaft: vorgabe }) ? null : vorgabe, haushalt: !!h, automatikZurueck, ...(nurBusiness ? { nurEntwuerfe: true } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return ausFehler(e); }
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(GESPERRT, { status: 403 });
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2)
  if (alterBau) return alterBau;
  let b: { aktion?: string; id?: unknown; felder?: unknown; stand?: unknown; grund?: unknown; nachfassenAm?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  // Person aus dem Zugang (Regel 5) — Sitzung oder Dienstweg mit Person.
  const person = z.person;
  const wer = werAus(req);
  const id = typeof b.id === 'string' ? b.id : '';
  const h = await businessHaushaltVon(req);
  // Rolle „nur Business“ (13.10.): nur Entwürfe einer Business-Gesellschaft — alles andere 403, BEVOR etwas geschrieben wird.
  if (h?.nurBusiness) {
    const alt = id ? (await ladeCrmMitPapierkorb()).angebote?.find(a => a.id === id) ?? null : null;
    const nein = angebotAktionNurBusiness(b.aktion, { alt, felder: b.felder && typeof b.felder === 'object' && !Array.isArray(b.felder) ? b.felder as Record<string, unknown> : null });
    if (nein) return fehler(nein, 403, { nurEntwuerfe: true });
  }
  try {
    switch (b.aktion) {
      case 'speichern': {
        const felder = b.felder && typeof b.felder === 'object' && !Array.isArray(b.felder) ? b.felder as Record<string, unknown> : null;
        if (!felder) return fehler('felder fehlen.', 400);
        const a = await angebotSpeichern({ id: b.id, felder, stand: b.stand, person, haushalt: h?.haushalt, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(a) });
      }
      case 'stellen': {
        if (!h || h.nurBusiness) return fehler('Stellen nur mit angemeldeter Person und Haushalt — PDF und Absender liegen je Haushalt.', 403);
        const r = await angebotStellen({ id, stand: b.stand, person: h.person, haushalt: h.haushalt, nachfassenAm: b.nachfassenAm, wer });
        return NextResponse.json({ ok: true, ...r });
      }
      case 'annehmen': {
        const r = await angebotAnnehmen({ id, stand: b.stand, person, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(r.angebot), dealId: r.dealId, ...(r.dealFehler ? { hinweis: r.dealFehler } : {}), ...(r.automatik ? { automatik: r.automatik } : {}) });
      }
      case 'mandat-zurueck': {
        // 29.10. (Kreislauf Geld P2a): „Rückgängig“ der Automatik nach „angenommen“ — nur von Hand, nur ein automatisch angelegtes Mandat ohne Rechnung/Fall.
        if (istDienst(req)) return fehler('„Rückgängig“ nur von Hand — nicht der Dienstweg.', 403);
        const { mandatAutomatikZurueck } = await import('@/lib/crm/mandat-automatik-server');
        const r = await mandatAutomatikZurueck({ angebotId: id, wer });
        if (!r.ok) return fehler(r.fehler, r.status, r.grund ? { grund: r.grund } : {});
        return NextResponse.json({ ...r, text: r.schonZurueck ? 'Schon zurückgenommen.' : `Mandat wieder entfernt${r.posten ? ` · ${r.posten} Posten aus dem Liquiplan genommen` : ''}.` });
      }
      case 'ablehnen': {
        const r = await angebotAblehnen({ id, stand: b.stand, person, grund: b.grund, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(r.angebot), dealId: r.dealId, ...(r.dealFehler ? { hinweis: r.dealFehler } : {}) });
      }
      case 'version': {
        const a = await angebotVersion({ id, person, haushalt: h?.haushalt, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(a) });
      }
      case 'loeschen': {
        await angebotLoeschen({ id, stand: b.stand, wer });
        return NextResponse.json({ ok: true });
      }
      case 'ablage': {
        const art = (b as { art?: unknown }).art;
        if (art !== 'archiv' && art !== 'papierkorb') return fehler('art: archiv oder papierkorb.', 400);
        const a = await angebotAblage({ id, art, zurueck: (b as { zurueck?: unknown }).zurueck === true, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(a) });
      }
      case 'gesendet': {
        if (istDienst(req)) return fehler('„Gesendet“ vermerkt nur ein Mensch per Klick — nicht der Dienstweg.', 403);
        const r = await angebotGesendet({ id, person, wer });
        return NextResponse.json({ ok: true, ...r, text: r.schonDa ? `Angebot ${r.nummer} war schon als gesendet vermerkt.` : `Angebot ${r.nummer} als gesendet vermerkt — steht im Verlauf der Person.` });
      }
      case 'entwurf-pdf': {
        // 26.10. (Kevin: „anzeigen und runterladen“): der Entwurf als PDF — nichts gespeichert, keine Nummer, volle IBAN wie im gestellten PDF.
        if (!h) return fehler('PDF nur mit angemeldeter Person und Haushalt — Absender und Logo liegen je Haushalt.', 403);
        const pdf = await angebotEntwurfPdf({ id, haushalt: h.haushalt });
        return new NextResponse(Buffer.from(pdf.bytes), { headers: {
          'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(pdf.name)}`,
          'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox; default-src 'none'",
        } });
      }
      case 'gmail-entwurf': {
        // 26.10.: Mail + PDF als Entwurf im EIGENEN Gmail — nur per Klick der Person (Dienstweg/ZOE nie), gesendet wird in Gmail.
        if (istDienst(req)) return fehler('Den Gmail-Entwurf legt nur ein Mensch per Klick an — nicht der Dienstweg.', 403);
        if (!h || h.nurBusiness) return fehler('Gmail-Entwurf nur mit angemeldeter Person und Haushalt.', 403);
        const m = b as { an?: unknown; betreff?: unknown; text?: unknown };
        const r = await angebotGmailEntwurf({ id, person: h.person, haushalt: h.haushalt, an: m.an, betreff: m.betreff, text: m.text });
        return NextResponse.json({ ok: true, ...r, text: `Die Mail mit dem PDF liegt als Entwurf in deinem Gmail (${r.von}) — dort öffnen und senden.` });
      }
      default: return fehler('aktion: speichern, stellen, annehmen, mandat-zurueck, ablehnen, version, ablage, gesendet, entwurf-pdf, gmail-entwurf oder loeschen.', 400);
    }
  } catch (e) { return ausFehler(e); }
}
