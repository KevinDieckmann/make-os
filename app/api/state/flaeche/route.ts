// ─── MAKE OS — Flächen-Layout je Person ─────────────────────────────────────
// GET  ?seite=heute        → gespeichertes Layout dieser Seite für die angemeldete Person (oder null)
// PUT  { seite, layout }   → Layout speichern (leer/Standard = Eintrag löschen)
// Jede Person hat ihr eigenes (speicherFuer): Kevin und Malin gestalten unabhängig.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, speicherFuer } from '@/lib/zoe/raum';
import { sauberDatei, sauberLayout, seiteOk, type FlaecheDatei } from '@/lib/flaeche/modell';
import { fremdePlaetze, layoutFuerSeite } from '@/lib/flaeche/sicht';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  const seite = new URL(req.url).searchParams.get('seite') ?? '';
  if (!seiteOk(seite)) return NextResponse.json({ ok: false, error: 'Seite fehlt.' }, { status: 400 });
  const d = sauberDatei(await loadJson<FlaecheDatei>(speicherFuer('flaeche', personAus(req))));
  // Sicht Privat · Business (Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat“): eine Fläche mit Bereich (Heute › Business,
  // Gesundheit, Markttraktion …) bekommt nur Widgets, die dorthin gehören (lib/flaeche/sicht.ts) — auch aus einem älteren gespeicherten Layout.
  const layout = d.seiten[seite];
  return NextResponse.json({ ok: true, seite, layout: layout ? layoutFuerSeite(seite, layout) : null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  let b: { seite?: string; layout?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const seite = String(b.seite ?? '');
  if (!seiteOk(seite)) return NextResponse.json({ ok: false, error: 'Seite fehlt.' }, { status: 400 });
  const layout = b.layout ? sauberLayout(b.layout) : null;
  // Ein Widget aus dem anderen Bereich (z. B. Familie & Partnerschaft auf Heute › Business) wird nie gespeichert — sichtbar abgelehnt.
  const fremd = layout ? fremdePlaetze(seite, layout.plaetze) : [];
  if (fremd.length) return NextResponse.json({ ok: false, error: `Abgelehnt: ${fremd.length === 1 ? 'dieses Widget gehört' : 'diese Widgets gehören'} nicht in diese Sicht (${fremd.map(p => p.art).join(', ')}). Nichts gespeichert.` }, { status: 400 });
  const next = await updateJson<FlaecheDatei>(speicherFuer('flaeche', personAus(req)), cur => {
    const d = sauberDatei(cur);
    if (!layout || (!layout.plaetze.length && !layout.versteckt.length)) delete d.seiten[seite]; else d.seiten[seite] = layout;
    return d;
  });
  const gespeichert = next.seiten[seite];
  return NextResponse.json({ ok: true, seite, layout: gespeichert ? layoutFuerSeite(seite, gespeichert) : null });
}
