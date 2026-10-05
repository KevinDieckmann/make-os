// ─── Pannen-Register (Art. 33 Abs. 5 DSGVO, 05.10.) ─────────────────────────
// GET                                → { pannen, offen } — NUR der Inhaber (das Register ist vertraulich)
// POST { aktion: 'panne', panne }    → anlegen (ohne id) bzw. ändern (mit id)
// POST { aktion: 'panne-weg', id }   → löschen (Oberfläche fragt vorher; normal: abschließen, die Löschfrist räumt auf)
// Nur der Inhaber, nur von Hand (Dienstweg → 403), Bau-Prüfung, Protokoll nur mit Feldnamen. Prozess: datenschutz/DATENPANNEN.md.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { PANNEN_SPEICHER, panneSaeubern, panneOffen, type PannenDatei } from '@/lib/datenschutz/pannen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (fehler: string, status: number) => NextResponse.json({ ok: false, fehler }, { status });

async function nurInhaberPerson(req: Request): Promise<string | null> {
  const w = await imHaushaltDesInhabers(req);
  if (!w || w.dienst) return null;
  const p = personStreng(req);
  return p && (await istInhaber(p)) ? p : null;
}

const antwort = (d: PannenDatei | null) => {
  const jetzt = new Date().toISOString();
  const pannen = [...(d?.pannen ?? [])].sort((a, b) => b.kenntnisAm.localeCompare(a.kenntnisAm));
  return { ok: true, pannen, offen: Object.fromEntries(pannen.map(p => [p.id, panneOffen(p, jetzt)])) };
};

export async function GET(req: Request) {
  if (!(await nurInhaberPerson(req))) return nein('Nur der Inhaber sieht das Pannen-Register.', 403);
  return NextResponse.json(antwort(await loadJson<PannenDatei>(PANNEN_SPEICHER)), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (istDienst(req)) return nein('Nur von Hand — nie über ZOE oder Skripte.', 403);
  const von = await nurInhaberPerson(req);
  if (!von) return nein('Nur der Inhaber pflegt das Pannen-Register.', 403);
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  let b: { aktion?: string; panne?: Record<string, unknown>; id?: unknown };
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? nein('Kein JSON.', 400); }
  const jetzt = new Date().toISOString();
  if (b.aktion === 'panne') {
    const id = typeof b.panne?.id === 'string' && /^pn-[a-z0-9-]{4,60}$/.test(b.panne.id) ? b.panne.id : null;
    let fehler: { t: string; s: number } | null = null;
    let felder: string[] = [];
    let pid = id ?? '';
    const neu = await updateJson<PannenDatei>(PANNEN_SPEICHER, cur => {
      const d = cur ?? { pannen: [] };
      const alt = id ? d.pannen.find(p => p.id === id) : undefined;
      if (id && !alt) { fehler = { t: 'Panne nicht gefunden.', s: 404 }; return d; }
      if (!alt && d.pannen.length >= 500) { fehler = { t: 'Höchstens 500 Einträge.', s: 413 }; return d; }
      const r = panneSaeubern(b.panne, { id: alt?.id ?? neueKennung('pn'), jetzt, von, alt });
      if (!r.ok) { fehler = { t: r.fehler, s: 400 }; return d; }
      felder = Object.keys(r.p); pid = r.p.id;
      return { pannen: alt ? d.pannen.map(p => (p.id === alt.id ? r.p : p)) : [...d.pannen, r.p] };
    });
    if (fehler) return nein((fehler as { t: string }).t, (fehler as { s: number }).s);
    await protokolliere(PANNEN_SPEICHER, [{ op: id ? 'geaendert' : 'neu', id: pid, felder }], werAus(req));
    return NextResponse.json(antwort(neu));
  }
  if (b.aktion === 'panne-weg') {
    const id = String(b.id ?? '');
    let da = false;
    const neu = await updateJson<PannenDatei>(PANNEN_SPEICHER, cur => { const d = cur ?? { pannen: [] }; da = d.pannen.some(p => p.id === id); return da ? { pannen: d.pannen.filter(p => p.id !== id) } : d; });
    if (!da) return nein('Panne nicht gefunden.', 404);
    await protokolliere(PANNEN_SPEICHER, [{ op: 'geloescht', id }], werAus(req));
    return NextResponse.json(antwort(neu));
  }
  return nein('aktion unbekannt.', 400);
}
