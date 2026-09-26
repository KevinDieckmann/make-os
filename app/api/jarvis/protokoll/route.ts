// ─── MAKE OS — Jarvis' Protokoll (Route) ────────────────────────────────────
// GET  zeigt, was Jarvis getan hat — neueste zuerst.
// POST nimmt einen Eintrag zurück, sofern er eine Rücknahme trägt.
//
// Rückgängig heißt hier: dasselbe Werkzeug noch einmal mit dem alten Wert.
// Kein Schnappschuss der Datei — das würde fremde Änderungen mitlöschen, die
// seitdem passiert sind (Malin arbeitet im zweiten Fenster).

import { NextResponse } from 'next/server';
import { lies, eintrag, stempleZurueckgenommen } from '@/lib/jarvis/protokoll';
import { fuehreAus } from '@/lib/jarvis/ausfuehren';
import { uebersicht } from '@/lib/jarvis/ausfuehren';
import { innenAdresse } from '@/lib/innen';
import { haushaltVon, personStreng } from '@/lib/finanzen/haushalt/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const anzahl = Math.max(1, Math.min(200, Number(p.get('anzahl')) || 60));
  // Einträge der Haushaltsfinanzen nur für Haushaltsmitglieder (24.09.).
  const z = await haushaltVon(req);
  // Nur die eigenen Einträge und die des Systems — Jarvis' Protokoll trägt
  // Journal, Gedächtnis und Mailinhalte der jeweiligen Person (26.09.).
  const person = personStreng(req);
  const eintraege = (await lies(anzahl)).filter(e => (z || e.gruppe !== 'haushalt') && (!e.person || e.person === person));
  return NextResponse.json({ ok: true, eintraege, werkzeuge: uebersicht() });
}

export async function POST(req: Request) {
  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(body.id ?? '');
  const e = id ? await eintrag(id) : null;
  if (!e) return NextResponse.json({ ok: false, error: 'Eintrag nicht gefunden.' }, { status: 404 });
  // Zurücknehmen darf nur, wessen Eintrag es ist (Systemeinträge: jede angemeldete Person).
  if (e.person && e.person !== personStreng(req)) return NextResponse.json({ ok: false, error: 'Eintrag nicht gefunden.' }, { status: 404 });
  if (e.zurueckgenommenAm) return NextResponse.json({ ok: false, error: 'Schon zurückgenommen.' }, { status: 409 });
  if (!e.ruecknahme) return NextResponse.json({ ok: false, error: 'Für diesen Schritt gibt es keine Rücknahme.' }, { status: 409 });

  const origin = innenAdresse(req);
  const lauf = await fuehreAus(e.ruecknahme.werkzeug, e.ruecknahme.eingabe, origin, { erzwingen: true, person: e.person ?? personStreng(req) ?? undefined });
  if (lauf.ok) await stempleZurueckgenommen(id);
  return NextResponse.json({ ok: lauf.ok, ergebnis: lauf.text });
}
