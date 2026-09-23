// ─── MAKE OS — Jarvis-Verlauf (Bestand) ─────────────────────────────────────
// Jedes Gespräch mit Jarvis landet hier auf der Platte. Beim nächsten Öffnen
// ist derselbe Stand da — und die KI bekommt ihn mit in den Prompt.
//
// PUT schreibt IMMER nur ein Gespräch (upsert), nie die ganze Liste. Damit
// kann ein Client mit veraltetem Stand die Historie nicht überschreiben.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { GRENZEN, titelAus, type Gespraech, type VerlaufNachricht } from '@/lib/make-one/jarvis-verlauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Datei { gespraeche: Gespraech[] }

const istZeit = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);

function sauber(g: Partial<Gespraech>): Gespraech | null {
  const id = String(g.id ?? '').trim().slice(0, 48);
  if (!id) return null;
  const jetzt = new Date().toISOString();
  const nachrichten: VerlaufNachricht[] = (Array.isArray(g.nachrichten) ? g.nachrichten : [])
    .slice(-GRENZEN.nachrichtenProGespraech)
    .map(n => ({
      rolle: n?.rolle === 'jarvis' ? 'jarvis' as const : 'kevin' as const,
      text: String(n?.text ?? '').slice(0, GRENZEN.zeichenProNachricht),
      zeit: istZeit(n?.zeit) ? n.zeit : jetzt,
      ...(Array.isArray(n?.ran) && n.ran.length
        ? { ran: n.ran.slice(0, 8).map(r => ({ agent: String(r?.agent ?? '').slice(0, 40), ok: !!r?.ok })) }
        : {}),
    }))
    .filter(n => n.text.trim());
  const ersteFrage = nachrichten.find(n => n.rolle === 'kevin')?.text ?? '';
  return {
    id,
    begonnen: istZeit(g.begonnen) ? g.begonnen : (nachrichten[0]?.zeit ?? jetzt),
    zuletzt: nachrichten[nachrichten.length - 1]?.zeit ?? jetzt,
    titel: String(g.titel ?? '').trim().slice(0, 80) || titelAus(ersteFrage),
    nachrichten,
  };
}

export async function GET() {
  const f = await loadJson<Datei>('jarvis-verlauf');
  const gespraeche = (Array.isArray(f?.gespraeche) ? f.gespraeche : [])
    .slice()
    .sort((a, b) => (b.zuletzt ?? '').localeCompare(a.zuletzt ?? ''));
  return NextResponse.json({
    gespraeche,
    anzahl: gespraeche.length,
    nachrichten: gespraeche.reduce((s, g) => s + (g.nachrichten?.length ?? 0), 0),
  });
}

/** Ein Gespräch anlegen oder aktualisieren. Body: { gespraech: Gespraech }. */
export async function PUT(req: Request) {
  let body: { gespraech?: Partial<Gespraech> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const g = sauber(body.gespraech ?? {});
  if (!g) return NextResponse.json({ ok: false, error: 'gespraech.id fehlt.' }, { status: 400 });
  // Leeres Gespräch nicht anlegen — sonst füllt jeder Panel-Aufruf die Liste.
  if (!g.nachrichten.length) return NextResponse.json({ ok: true, uebersprungen: true });

  const next = await updateJson<Datei>('jarvis-verlauf', current => {
    const f = current ?? { gespraeche: [] };
    f.gespraeche = Array.isArray(f.gespraeche) ? f.gespraeche : [];
    const i = f.gespraeche.findIndex(x => x.id === g.id);
    // Kürzer als der gespeicherte Stand? Dann ist der Client hinterher —
    // die Historie wird nicht beschnitten.
    if (i >= 0 && (f.gespraeche[i].nachrichten?.length ?? 0) > g.nachrichten.length) return f;
    if (i >= 0) f.gespraeche[i] = { ...g, begonnen: f.gespraeche[i].begonnen ?? g.begonnen };
    else f.gespraeche.push(g);
    f.gespraeche.sort((a, b) => (b.zuletzt ?? '').localeCompare(a.zuletzt ?? ''));
    f.gespraeche = f.gespraeche.slice(0, GRENZEN.gespraeche);
    return f;
  });
  return NextResponse.json({ ok: true, anzahl: next.gespraeche.length });
}

/** Ein einzelnes Gespräch entfernen. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id fehlt.' }, { status: 400 });
  const next = await updateJson<Datei>('jarvis-verlauf', current => {
    const f = current ?? { gespraeche: [] };
    f.gespraeche = (f.gespraeche ?? []).filter(g => g.id !== id);
    return f;
  });
  return NextResponse.json({ ok: true, anzahl: next.gespraeche.length });
}
