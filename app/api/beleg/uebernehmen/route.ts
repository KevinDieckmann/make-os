// ─── MAKE OS — gelesenen Beleg übernehmen ───────────────────────────────────
// Zweiter Schritt nach /api/beleg: Kevin hat die erkannten Zahlen gesehen und
// bestätigt. ERST jetzt wird geschrieben.
//
// Zwei Ziele, je nach Richtung des Belegs:
//   eingang  → Buchung (Kevin zahlt: Lieferantenrechnung, Quittung, Einkauf)
//   ausgang  → Rechnung im Finanzplan (jemand schuldet Kevin Geld)

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { GRENZEN } from '@/lib/finanzen/finanzplan-bestand';
import { belegBetrag, euroText } from '@/lib/finanzen/beleg-betrag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck: string; konto: string; ort?: string }
interface Rechnung { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string; netto?: number; ustSatz?: number }

export async function POST(req: Request) {
  let b: {
    ziel?: 'buchung' | 'rechnung';
    partner?: string; datum?: string; betrag?: number; betragBrutto?: number; betragNetto?: number; ustSatz?: number; kategorie?: string;
    zweck?: string; konto?: string; wer?: string; firma?: string; faellig?: string; rechnungsnummer?: string;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }

  const partner = String(b.partner ?? '').trim().slice(0, 140);
  // Auf den Cent, brutto/netto nur über lib/finanzen/ust.ts (28.09., K3) — vorher auf ganze Euro gerundet.
  const betrag = belegBetrag(b);
  if (!partner) return NextResponse.json({ ok: false, error: 'Ohne Partner wird nichts gebucht.' }, { status: 400 });
  if (!betrag) return NextResponse.json({ ok: false, error: 'Betrag fehlt oder ist nicht plausibel.' }, { status: 400 });

  // Belege aus dem Chat sind Firmen-Belege. Private gehören in den Haushalt
  // (Zahlen › Privat), nicht in die Business-Buchungen.
  if (String(b.firma ?? '').toLowerCase() === 'privat') return NextResponse.json({ ok: false, error: 'Private Belege bitte unter Zahlen › Privat erfassen — hier landen nur Firmen-Belege.' }, { status: 400 });
  // Die eine Einheitenliste (28.09.): kdc · kdv · ug; ohne Angabe wie bisher KD Ventures.
  const firma = b.firma === 'kdc' || b.firma === 'ug' ? b.firma : 'kdv';
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum ?? '')) ? String(b.datum) : localDay();
  const zweck = String(b.zweck ?? '').slice(0, 200) || partner;

  if (b.ziel === 'rechnung') {
    let angelegt = '';
    await updateJson<{ rechnungen: Rechnung[] }>('finanzplan', current => {
      const f = current ?? { rechnungen: [] };
      f.rechnungen = Array.isArray(f.rechnungen) ? f.rechnungen : [];
      // Grenze wie im Schreibweg der Finanzplanung: ablehnen, nie kürzen (28.09.).
      if (f.rechnungen.length >= GRENZEN.rechnungen) return f;
      const r: Rechnung = {
        id: `r-${Date.now().toString(36)}`,
        firmaId: firma,
        kunde: partner,
        titel: b.rechnungsnummer ? `${zweck} (${b.rechnungsnummer})` : zweck,
        betrag: betrag.brutto,
        ...(betrag.netto !== undefined ? { netto: betrag.netto, ustSatz: betrag.ustSatz } : {}),
        status: 'gestellt',
        ...(/^\d{4}-\d{2}-\d{2}$/.test(String(b.faellig ?? '')) ? { faellig: String(b.faellig) } : {}),
      };
      f.rechnungen.push(r);
      angelegt = `${r.kunde} · ${euroText(r.betrag)} · ${r.status}`;
      return f;
    });
    if (!angelegt) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${GRENZEN.rechnungen} Rechnungen im Finanzplan — erst Erledigtes aufräumen.` }, { status: 413 });
    return NextResponse.json({ ok: true, ziel: 'rechnung', angelegt, wo: '/os/finanzen/planung' });
  }

  // Standard: Buchung (Ausgabe)
  let angelegt = '';
  await updateJson<{ buchungen: Buchung[] }>('buchungen', current => {
    const f = current ?? { buchungen: [] };
    f.buchungen = Array.isArray(f.buchungen) ? f.buchungen : [];
    const neu: Buchung = {
      id: `b-${Date.now().toString(36)}-${f.buchungen.length}`,
      datum,
      // „wer“ ist der Geschäftspartner, „ort“ die Firma — früher stand der
      // Partner in „ort“, die Buchung fiel aus Zahlen heraus und wurde privat.
      wer: partner.slice(0, 80),
      // Ausgaben stehen im Bestand negativ — sonst zählt der Beleg als Einnahme.
      betrag: -betrag.brutto,
      kategorie: String(b.kategorie ?? 'Sonstiges').slice(0, 40),
      zweck,
      konto: String(b.konto ?? 'Geschäftskonto').slice(0, 40),
      ort: firma,
    };
    f.buchungen.push(neu);
    angelegt = `${neu.zweck} · ${euroText(neu.betrag)} · ${neu.kategorie}`;
    return f;
  });
  return NextResponse.json({ ok: true, ziel: 'buchung', angelegt, wo: '/os/finanzen/buchungen' });
}
