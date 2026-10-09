// ─── MAKE OS — ZOE-Verlauf (Bestand) ─────────────────────────────────────
// Jedes Gespräch mit ZOE landet hier auf der Platte. Beim nächsten Öffnen
// ist derselbe Stand da — und die KI bekommt ihn mit in den Prompt.
//
// PUT schreibt IMMER nur ein Gespräch (upsert), nie die ganze Liste. Damit
// kann ein Client mit veraltetem Stand die Historie nicht überschreiben.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { GRENZEN, titelAus, type Gespraech, type VerlaufNachricht } from '@/lib/make-one/zoe-verlauf';
import { personAus } from '@/lib/zoe/raum';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';

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
      // Neu geschrieben nur noch `nutzer` (Paket 4a); alte Einträge (mit der alten, personenbezogenen Kennung) bleiben lesbar (lib/make-one/zoe-verlauf.ts `istNutzer`).
      rolle: n?.rolle === 'zoe' ? 'zoe' as const : 'nutzer' as const,
      text: String(n?.text ?? '').slice(0, GRENZEN.zeichenProNachricht),
      zeit: istZeit(n?.zeit) ? n.zeit : jetzt,
      ...(Array.isArray(n?.ran) && n.ran.length
        ? { ran: n.ran.slice(0, 8).map(r => ({ agent: String(r?.agent ?? '').slice(0, 40), ok: !!r?.ok })) }
        : {}),
    }))
    .filter(n => n.text.trim());
  const ersteFrage = nachrichten.find(n => n.rolle !== 'zoe')?.text ?? '';
  return {
    id,
    begonnen: istZeit(g.begonnen) ? g.begonnen : (nachrichten[0]?.zeit ?? jetzt),
    zuletzt: nachrichten[nachrichten.length - 1]?.zeit ?? jetzt,
    titel: String(g.titel ?? '').trim().slice(0, 80) || titelAus(ersteFrage),
    nachrichten,
  };
}

/**
 * Gespräche gehören der Person, die sie geführt hat (24.09.). Vorher sah jedes
 * Konto jedes Gespräch — seit ZOE auch private Finanzen kennt, geht das
 * nicht mehr. Gespräche ohne Zuordnung stammen aus der Zeit mit nur einem Konto
 * und gehören dem Inhaber der Instanz (`alt` = dessen Speichername, nie ein fester Name — Paket 4a).
 * Seit 09.10. (Paket 4a) liest die Oberfläche ZOE-Threads (lib/agenten/zoe-faden.ts übernimmt diesen Bestand einmal); die Route bleibt
 * für ältere Fenster und den Rückweg.
 */
const gehoert = (g: { person?: string }, person: string, alt: string | null) => (g.person ?? alt) === person;

export async function GET(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  const person = personAus(req);
  const alt = await inhaberSpeicher();
  const f = await loadJson<Datei>('zoe-verlauf');
  const gespraeche = (Array.isArray(f?.gespraeche) ? f.gespraeche : []).filter(g => gehoert(g, person, alt))
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
  if (!personStreng(req)) return ohnePerson();
  let body: { gespraech?: Partial<Gespraech> };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const g = sauber(body.gespraech ?? {});
  if (!g) return NextResponse.json({ ok: false, error: 'gespraech.id fehlt.' }, { status: 400 });
  // Leeres Gespräch nicht anlegen — sonst füllt jeder Panel-Aufruf die Liste.
  if (!g.nachrichten.length) return NextResponse.json({ ok: true, uebersprungen: true });

  const person = personAus(req);
  const alt = await inhaberSpeicher();
  let fremd = false;
  const next = await updateJson<Datei>('zoe-verlauf', current => {
    const f = current ?? { gespraeche: [] };
    f.gespraeche = Array.isArray(f.gespraeche) ? f.gespraeche : [];
    const i = f.gespraeche.findIndex(x => x.id === g.id);
    if (i >= 0 && !gehoert(f.gespraeche[i], person, alt)) { fremd = true; return f; }
    g.person = person;
    // Kürzer als der gespeicherte Stand? Dann ist der Client hinterher —
    // die Historie wird nicht beschnitten.
    if (i >= 0 && (f.gespraeche[i].nachrichten?.length ?? 0) > g.nachrichten.length) return f;
    if (i >= 0) f.gespraeche[i] = { ...g, begonnen: f.gespraeche[i].begonnen ?? g.begonnen };
    else f.gespraeche.push(g);
    f.gespraeche.sort((a, b) => (b.zuletzt ?? '').localeCompare(a.zuletzt ?? ''));
    // Sicht-Prüfung 08.10.: die Grenze gilt JE PERSON — vorher schnitt ein gemeinsames `slice` ab, und wer viele (oder in
    // die Zukunft datierte) Gespräche anlegte, verdrängte die der anderen Person endgültig.
    const zaehler = new Map<string, number>();
    f.gespraeche = f.gespraeche.filter(x => {
      const wer = x.person ?? alt ?? ''; // Altbestand ohne Person = Inhaber (wie `gehoert`)
      const n = (zaehler.get(wer) ?? 0) + 1;
      zaehler.set(wer, n);
      return n <= GRENZEN.gespraeche;
    });
    return f;
  });
  if (fremd) return NextResponse.json({ ok: false, error: 'Nicht dein Gespräch.' }, { status: 403 });
  return NextResponse.json({ ok: true, anzahl: next.gespraeche.filter(x => gehoert(x, person, alt)).length });
}

/** Ein einzelnes Gespräch entfernen. */
export async function DELETE(req: Request) {
  if (!personStreng(req)) return ohnePerson();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id fehlt.' }, { status: 400 });
  const person = personAus(req);
  const alt = await inhaberSpeicher();
  const next = await updateJson<Datei>('zoe-verlauf', current => {
    const f = current ?? { gespraeche: [] };
    f.gespraeche = (f.gespraeche ?? []).filter(g => g.id !== id || !gehoert(g, person, alt));
    return f;
  });
  return NextResponse.json({ ok: true, anzahl: next.gespraeche.length });
}
