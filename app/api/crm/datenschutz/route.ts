// ─── CRM — Betroffenenrechte ────────────────────────────────────────────────
// GET  ?id=…  → Auskunft nach Art. 15: alles, was wir über die Person haben
//              (Kartei, Chancen, Mandate, Event-Teilnahmen) als JSON-Datei.
// POST { id, grund } → Löschen nach Art. 17: Person raus aus Kartei, Chancen,
//              Mandaten, Gästelisten. Ins Löschprotokoll kommt nur Kennung,
//              Datum und Grund — keine Personendaten. Eine Werbesperre ist
//              meist die bessere Wahl (Art. 21): dann bleibt „nicht anschreiben“
//              erhalten. Deshalb fragt die Oberfläche das vorher ab.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const k = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === id);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  const crm = await ladeCrm();
  const auskunft = {
    erstellt: new Date().toISOString(), verantwortlich: 'Kevin Dieckmann (KD Ventures / Kevin Dieckmann Consulting)',
    person: k, firma: k.firmaId ? crm.firmen.find(f => f.id === k.firmaId) ?? null : null,
    chancen: crm.chancen.filter(c => c.kontaktIds.includes(id)), mandate: crm.mandate.filter(m => m.kontaktIds.includes(id)),
    events: crm.teilnahmen.filter(t => t.kontaktId === id).map(t => ({ ...t, event: crm.events.find(e => e.id === t.eventId)?.titel })),
  };
  return new Response(JSON.stringify(auskunft, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="Auskunft-Art15-${id}-${localDay()}.json"` } });
}

export async function POST(req: Request) {
  let b: { id?: string; grund?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const id = String(b.id ?? '');
  let gefunden = false;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    gefunden = f.kontakte.some(k => k.id === id);
    return { ...f, kontakte: f.kontakte.filter(k => k.id !== id) };
  });
  if (!gefunden) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  await aendereCrm(c => ({
    ...c,
    chancen: c.chancen.map(x => (x.kontaktIds.includes(id) ? { ...x, kontaktIds: x.kontaktIds.filter(y => y !== id) } : x)),
    mandate: c.mandate.map(x => (x.kontaktIds.includes(id) ? { ...x, kontaktIds: x.kontaktIds.filter(y => y !== id) } : x)),
    teilnahmen: c.teilnahmen.filter(t => t.kontaktId !== id),
    // Auch Kampagnen und Beiträge — sonst bliebe die Kennung nach der Löschung stehen.
    kampagnen: c.kampagnen.map(k => ({ ...k, kontaktIds: k.kontaktIds.filter(y => y !== id), ergebnisse: k.ergebnisse.filter(e => e.kontaktId !== id) })),
    beitraege: c.beitraege.map(b => ({ ...b, quellen: b.quellen.filter(y => y !== id), wirkung: b.wirkung.filter(w => w.kontaktId !== id) })),
  }));
  await updateJson<{ eintraege: { id: string; datum: string; grund: string; von: string }[] }>('crm-loeschprotokoll', cur => ({ eintraege: [...(cur?.eintraege ?? []), { id, datum: localDay(), grund: String(b.grund ?? 'Art. 17 DSGVO').slice(0, 200), von: personAus(req) }] }));
  return NextResponse.json({ ok: true });
}
