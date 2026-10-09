// ─── Rechnungen schreiben mit PDF (08.10., ROADMAP_Q4 › Lücken Punkt 4) ──────
// GET                          → { rechnungen (mit fassung), gesellschaften (nur Absender-Felder, IBAN maskiert, luecken), vorgabe,
//                                  mahnTage, mahnvorschlaege, sicht } — serverseitig nach Sicht gefiltert
// GET ?pdf=<Rechnung>          → das PDF (attachment, nosniff, Sandbox)
// POST { aktion, … }:
//   neu       { quelle: frei|angebot|mandat, firmaId?, kontaktId?, kundeFirmaId?, mandatId?, angebotId?, monat?, nur?: 'einmalig', vorlage?, anfrageId? }
//             (`vorlage` bei quelle frei: { titel?, bruttoCent?, angebot?, angebotAm? } — abgelegtes Angebot → EINE Position, Woche 2 · 3.13)
//             (`nur: 'einmalig'` bei quelle angebot: nur die Einmalposten eines gemischten Angebots, feste Kennung — Woche 1 · 3.6)
//   speichern { id, felder, stand }          → Entwurf ändern (Stand/409, Grenzen 413)
//   loeschen  { id, stand }                  → nur Entwürfe ohne Nummer
//   stellen   { id, stand, anfrageId? }      → Nummer + PDF in einer Sperre (409 mit Pflichtangaben-Liste) — nie der Dienstweg
//   storno    { id, grund, stand?, anfrageId? } → Stornorechnung (eigene Nummer, eigenes PDF) — nie der Dienstweg
//   mahnung   { id, stufe, anfrageId? }      → Stufe vermerken + Mail-Entwurf (der Browser öffnet das Mail-Programm) — nie der Dienstweg
//   mahntage  { tage: [n, n, n] }            → Mahnstufen-Tage (nur volle Haushaltsmitglieder)
// Zugang wie die Rechnungen des Finanzplans: Haushalt des Inhabers. Konten mit `finanzRecht: 'business'` bekommen die Business-Sicht —
// nur Rechnungen der Business-Gesellschaften, Schreiben auf andere → 403/404 (lib/finanzen/rechnung/server.ts `inSicht`).
// Hinweis, keine Steuerberatung.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { planZugangVon, keinFinanzZugang } from '@/lib/zugang/tor';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { einmalig } from '@/lib/store/anfragen';
import { dateinameAscii } from '@/lib/dateien/regeln';
import {
  RechnungFehler, entwurfLoeschen, entwurfNeu, entwurfSpeichern, mahnTageSetzen, mahnungVermerken, rechnungPdf, rechnungStellen, rechnungStornieren, rechnungsStand,
  type Sicht,
} from '@/lib/finanzen/rechnung/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, error: text, ...extra }, { status });
function ausFehler(e: unknown) {
  if (e instanceof RechnungFehler) return fehler(e.message, e.status, e.extra);
  const status = (e as { status?: number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 600) return fehler((e as Error).message, status);
  console.error('[rechnung]', (e as Error)?.message);
  return fehler('Rechnung nicht gespeichert — interner Fehler.', 500);
}

/** Zugang: Konto mit Haushalt (Sicht aus dem Konto) UND Haushalt des Inhabers — der Finanzplan liegt nicht je Haushalt getrennt. */
async function zugang(req: Request): Promise<{ person: string; haushalt: string; sicht: Sicht } | null> {
  const z = await planZugangVon(req);
  if (!z) return null;
  return z.haushalt === (await haushaltDesInhabers()) ? z : null;
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return keinFinanzZugang();
  const url = new URL(req.url);
  try {
    const pdf = url.searchParams.get('pdf');
    if (pdf) {
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(pdf)) return fehler('Unzulässige Kennung.', 400);
      const d = await rechnungPdf(pdf, z);
      leseZugriff(req, 'rechnungen', { ids: [pdf] });
      return new Response(new Uint8Array(d.bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${dateinameAscii(d.name)}"; filename*=UTF-8''${encodeURIComponent(d.name)}`,
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'no-store, private',
        },
      });
    }
    const stand = await rechnungsStand(z);
    leseZugriff(req, 'rechnungen', { anzahl: stand.rechnungen.length });
    return NextResponse.json({ ok: true, sicht: z.sicht, ...stand }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return ausFehler(e); }
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return keinFinanzZugang();
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const wer = werAus(req);
  const id = typeof b.id === 'string' ? b.id.slice(0, 40) : '';
  const vonHand = () => (istDienst(req) ? fehler('Rechnungen stellen, stornieren und mahnen nur Menschen per Klick — nicht der Dienstweg.', 403) : null);
  try {
    switch (b.aktion) {
      case 'neu': {
        const r = await einmalig('rechnung-neu', b.anfrageId, async () => {
          const e = await entwurfNeu({ quelle: b.quelle, firmaId: b.firmaId, kontaktId: b.kontaktId, kundeFirmaId: b.kundeFirmaId, mandatId: b.mandatId, angebotId: b.angebotId, monat: b.monat, nur: b.nur, vorlage: b.vorlage, person: z.person, haushalt: z.haushalt, sicht: z.sicht, wer });
          return { status: 200, body: { ok: true, rechnung: e.rechnung, vorhanden: e.vorhanden } };
        });
        return NextResponse.json(r.body, { status: r.status });
      }
      case 'speichern': {
        const felder = b.felder && typeof b.felder === 'object' && !Array.isArray(b.felder) ? b.felder as Record<string, unknown> : null;
        if (!felder || !id) return fehler('id und felder fehlen.', 400);
        const r = await entwurfSpeichern({ id, felder, stand: b.stand, haushalt: z.haushalt, sicht: z.sicht, wer });
        return NextResponse.json({ ok: true, rechnung: r });
      }
      case 'loeschen': {
        if (!id) return fehler('id fehlt.', 400);
        await entwurfLoeschen({ id, stand: b.stand, sicht: z.sicht, wer });
        return NextResponse.json({ ok: true });
      }
      case 'stellen': {
        const nein = vonHand(); if (nein) return nein;
        if (!id) return fehler('id fehlt.', 400);
        const r = await einmalig('rechnung-stellen', b.anfrageId, async () => ({ status: 200, body: { ok: true, ...(await rechnungStellen({ id, stand: b.stand, person: z.person, haushalt: z.haushalt, sicht: z.sicht, wer })) } }));
        return NextResponse.json(r.body, { status: r.status });
      }
      case 'storno': {
        const nein = vonHand(); if (nein) return nein;
        if (!id) return fehler('id fehlt.', 400);
        const r = await einmalig('rechnung-storno', b.anfrageId, async () => ({ status: 200, body: { ok: true, ...(await rechnungStornieren({ id, grund: b.grund, ...(b.stand !== undefined ? { stand: b.stand } : {}), person: z.person, haushalt: z.haushalt, sicht: z.sicht, wer })) } }));
        return NextResponse.json(r.body, { status: r.status });
      }
      case 'mahnung': {
        const nein = vonHand(); if (nein) return nein;
        if (!id) return fehler('id fehlt.', 400);
        const r = await einmalig('rechnung-mahnung', b.anfrageId, async () => ({ status: 200, body: { ok: true, ...(await mahnungVermerken({ id, stufe: b.stufe, person: z.person, haushalt: z.haushalt, sicht: z.sicht, wer })) } }));
        return NextResponse.json(r.body, { status: r.status });
      }
      case 'mahntage': {
        if (z.sicht !== 'privat') return fehler('Die Mahnstufen stellt ein volles Haushaltsmitglied ein.', 403);
        return NextResponse.json({ ok: true, mahnTage: await mahnTageSetzen(b.tage) });
      }
      default: return fehler('aktion: neu, speichern, loeschen, stellen, storno, mahnung oder mahntage.', 400);
    }
  } catch (e) { return ausFehler(e); }
}
