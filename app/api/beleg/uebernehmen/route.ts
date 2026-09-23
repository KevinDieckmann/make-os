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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck: string; konto: string; ort?: string }
interface Rechnung { id: string; firmaId: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string }

export async function POST(req: Request) {
  let b: {
    ziel?: 'buchung' | 'rechnung';
    partner?: string; datum?: string; betrag?: number; kategorie?: string;
    zweck?: string; konto?: string; wer?: string; firma?: string; faellig?: string; rechnungsnummer?: string;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }

  const partner = String(b.partner ?? '').trim().slice(0, 140);
  const betrag = Number(b.betrag);
  if (!partner) return NextResponse.json({ ok: false, error: 'Ohne Partner wird nichts gebucht.' }, { status: 400 });
  if (!isFinite(betrag) || betrag <= 0) return NextResponse.json({ ok: false, error: 'Betrag fehlt oder ist nicht plausibel.' }, { status: 400 });

  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum ?? '')) ? String(b.datum) : localDay();
  const zweck = String(b.zweck ?? '').slice(0, 200) || partner;

  if (b.ziel === 'rechnung') {
    let angelegt = '';
    await updateJson<{ rechnungen: Rechnung[] }>('finanzplan', current => {
      const f = current ?? { rechnungen: [] };
      f.rechnungen = Array.isArray(f.rechnungen) ? f.rechnungen : [];
      const r: Rechnung = {
        id: `r-${Date.now().toString(36)}`,
        firmaId: String(b.firma ?? 'kdv').slice(0, 20),
        kunde: partner,
        titel: b.rechnungsnummer ? `${zweck} (${b.rechnungsnummer})` : zweck,
        betrag: Math.round(betrag),
        status: 'gestellt',
        ...(/^\d{4}-\d{2}-\d{2}$/.test(String(b.faellig ?? '')) ? { faellig: String(b.faellig) } : {}),
      };
      f.rechnungen.push(r);
      angelegt = `${r.kunde} · ${r.betrag} € · ${r.status}`;
      return f;
    });
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
      wer: String(b.wer ?? 'Kevin').slice(0, 40),
      // Ausgaben stehen im Bestand negativ — sonst zählt der Beleg als Einnahme.
      betrag: -Math.abs(Math.round(betrag * 100) / 100),
      kategorie: String(b.kategorie ?? 'Sonstiges').slice(0, 40),
      zweck,
      konto: String(b.konto ?? 'Geschäftskonto').slice(0, 40),
      ort: partner,
    };
    f.buchungen.push(neu);
    angelegt = `${neu.zweck} · ${neu.betrag} € · ${neu.kategorie}`;
    return f;
  });
  return NextResponse.json({ ok: true, ziel: 'buchung', angelegt, wo: '/os/finanzen/buchungen' });
}
