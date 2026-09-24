// ─── MAKE OS — Der Freigabe-Stapel (Route) ──────────────────────────────────
// GET  liefert die offenen Vorschläge (und auf Wunsch die entschiedenen).
// POST entscheidet: freigeben · ändern und freigeben · ablehnen.
//
// Die Ausführung läuft über fuehreAus mit erzwingen:true — das ist der einzige
// Ort, an dem ein freigabepflichtiges Werkzeug wirklich wirkt, und auch er
// schreibt ins Protokoll.

import { NextResponse } from 'next/server';
import { lies, hole, entscheide } from '@/lib/jarvis/stapel';
import { fuehreAus } from '@/lib/jarvis/ausfuehren';
import { personAus } from '@/lib/jarvis/raum';
import { innenAdresse } from '@/lib/innen';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';

// Haushaltsfinanzen (24.09.): Vorschläge der Gruppe „haushalt“ sieht und
// entscheidet nur, wer einem Haushalt angehört — mit ausdrücklich benannter
// Person, nie über den Rückfall auf „kevin“.
const HAUSHALT = 'haushalt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const alle = new URL(req.url).searchParams.get('alle') === '1';
  const z = await haushaltVon(req);
  const liste = (await lies(alle ? undefined : 'offen')).filter(v => z || v.gruppe !== HAUSHALT);
  return NextResponse.json({ ok: true, vorschlaege: liste, offen: liste.filter(v => v.status === 'offen').length });
}

interface Eingang {
  id?: string;
  entscheidung?: 'freigeben' | 'ablehnen';
  /** Geänderte Eingabe — „ändern und freigeben". */
  eingabe?: Record<string, unknown>;
  grund?: string;
  /** Alles auf einmal freigeben; optional auf eine Gruppe beschränkt. */
  alle?: boolean;
  gruppe?: string;
}

export async function POST(req: Request) {
  let body: Eingang;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const origin = innenAdresse(req);
  const person = personAus(req);
  const z = await haushaltVon(req);

  // ── Sammel-Freigabe: „durcharbeiten" ──
  if (body.alle) {
    const offen = (await lies('offen')).filter(v => (!body.gruppe || v.gruppe === body.gruppe) && (z || v.gruppe !== HAUSHALT));
    if (!offen.length) return NextResponse.json({ ok: true, erledigt: 0, ergebnisse: [] });
    // Nacheinander, nicht parallel: mehrere Vorschläge fassen oft denselben
    // Bestand an (zwei Rechnungen desselben Kunden). Parallel würde der eine
    // den anderen überschreiben.
    const ergebnisse: { id: string; ok: boolean; text: string }[] = [];
    for (const v of offen) {
      const lauf = await fuehreAus(v.werkzeug, v.eingabe, origin, { erzwingen: true, person: v.gruppe === HAUSHALT ? z!.person : person });
      await entscheide(v.id, lauf.ok ? 'freigegeben' : 'fehlgeschlagen', { ergebnis: lauf.text });
      ergebnisse.push({ id: v.id, ok: lauf.ok, text: lauf.text });
    }
    return NextResponse.json({ ok: true, erledigt: ergebnisse.filter(e => e.ok).length, ergebnisse });
  }

  const id = String(body.id ?? '');
  const v = id ? await hole(id) : null;
  if (!v) return NextResponse.json({ ok: false, error: 'Vorschlag nicht gefunden.' }, { status: 404 });
  if (v.status !== 'offen') return NextResponse.json({ ok: false, error: `Schon entschieden (${v.status}).` }, { status: 409 });
  if (v.gruppe === HAUSHALT && !z) return NextResponse.json({ ok: false, error: 'Vorschlag nicht gefunden.' }, { status: 404 });

  if (body.entscheidung === 'ablehnen') {
    const raus = await entscheide(id, 'abgelehnt', { grund: String(body.grund ?? '').slice(0, 400) });
    return NextResponse.json({ ok: true, vorschlag: raus });
  }

  const eingabe = body.eingabe && typeof body.eingabe === 'object' ? body.eingabe : v.eingabe;
  const lauf = await fuehreAus(v.werkzeug, eingabe, origin, { erzwingen: true, person: v.gruppe === HAUSHALT ? z!.person : person });
  const raus = await entscheide(id, lauf.ok ? 'freigegeben' : 'fehlgeschlagen', { ergebnis: lauf.text, eingabe });
  return NextResponse.json({ ok: lauf.ok, ergebnis: lauf.text, vorschlag: raus });
}
