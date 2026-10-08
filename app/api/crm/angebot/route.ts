// ─── Markttraktion · Angebots-Tool (28.09.) ─────────────────────────────────
// GET                     → { angebote (mit stand), gesellschaften (nur Absender-Felder, IBAN maskiert, `luecken`), vorgabe } — zieht vorher den Ablauf nach
//                           `vorgabe` (08.10.): die operative Business-Gesellschaft aus dem Register oder null (dann wählt der Mensch).
// POST { aktion, … }:
//   speichern  { id?, felder, stand? }      → Entwurf anlegen/ändern (Stand/409, Grenzen 413)
//   stellen    { id, stand, nachfassenAm? } → Nummer, PDF in die Ablage, Deal/Follow-up/Aktivität (409 bei Sperre)
//   annehmen   { id, stand }                → Deal gewonnen (danach „Mandat anlegen“, vorbelegt)
//   ablehnen   { id, stand, grund }         → Deal verloren mit Grund (Grund Pflicht)
//   version    { id }                       → neue Fassung als Entwurf mit Bezug
//   loeschen   { id, stand }                → nur Entwürfe, nur aus dem Papierkorb (endgültig, 04.10.)
//   ablage     { id, art: archiv|papierkorb, zurueck? } → Archiv (jeder Status) bzw. Papierkorb (nur Entwürfe), hinein/zurück (04.10.)
// GET liefert seit 04.10. `papierkorb` getrennt (Entwürfe im Papierkorb) — `angebote` enthält sie nicht mehr.
// Zugang: Haushalt des Inhabers (Default-Deny); Stellen braucht dazu eine benannte Person mit Haushalt
// (Dateiablage und Gesellschaften liegen je Haushalt). Nichts wird versendet — das Mail-Programm öffnet der Browser.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ladeCrmMitPapierkorb } from '@/lib/crm/speicher';
import { absenderFuerAnzeige } from '@/lib/crm/gesellschaften';
import { absenderVorgabe } from '@/lib/gesellschaften/server';
import { AngebotFehler, ablaufNachziehen, angebotAblage, angebotAblehnen, angebotAnnehmen, angebotLoeschen, angebotSpeichern, angebotStellen, angebotVersion, gesellschaftenLaden, mitStand } from '@/lib/crm/angebot-server';

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
    const h = await haushaltVon(req);
    const crm = await ladeCrmMitPapierkorb();
    const alle = crm.angebote ?? [];
    // Absender mit `luecken` (08.10., Sofort-Paket 3.1): sonst erschien „Absender … fehlt“ nie und erst „Senden“ scheiterte. Nur Absender-Felder — nie Cap-Table/Verträge.
    return NextResponse.json({ ok: true, angebote: alle.filter(a => !a.geloeschtAm).map(mitStand), papierkorb: alle.filter(a => a.geloeschtAm).map(mitStand), gesellschaften: (await gesellschaftenLaden(h?.haushalt)).map(absenderFuerAnzeige), vorgabe: await absenderVorgabe(h?.haushalt), haushalt: !!h }, { headers: { 'Cache-Control': 'no-store' } });
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
  try {
    switch (b.aktion) {
      case 'speichern': {
        const felder = b.felder && typeof b.felder === 'object' && !Array.isArray(b.felder) ? b.felder as Record<string, unknown> : null;
        if (!felder) return fehler('felder fehlen.', 400);
        const h = await haushaltVon(req);
        const a = await angebotSpeichern({ id: b.id, felder, stand: b.stand, person, haushalt: h?.haushalt, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(a) });
      }
      case 'stellen': {
        const h = await haushaltVon(req);
        if (!h) return fehler('Stellen nur mit angemeldeter Person und Haushalt — PDF und Absender liegen je Haushalt.', 403);
        const r = await angebotStellen({ id, stand: b.stand, person: h.person, haushalt: h.haushalt, nachfassenAm: b.nachfassenAm, wer });
        return NextResponse.json({ ok: true, ...r });
      }
      case 'annehmen': {
        const r = await angebotAnnehmen({ id, stand: b.stand, person, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(r.angebot), dealId: r.dealId, ...(r.dealFehler ? { hinweis: r.dealFehler } : {}) });
      }
      case 'ablehnen': {
        const r = await angebotAblehnen({ id, stand: b.stand, person, grund: b.grund, wer });
        return NextResponse.json({ ok: true, angebot: mitStand(r.angebot), dealId: r.dealId, ...(r.dealFehler ? { hinweis: r.dealFehler } : {}) });
      }
      case 'version': {
        const h = await haushaltVon(req);
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
      default: return fehler('aktion: speichern, stellen, annehmen, ablehnen, version, ablage oder loeschen.', 400);
    }
  } catch (e) { return ausFehler(e); }
}
