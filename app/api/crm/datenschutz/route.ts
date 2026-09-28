// ─── CRM — Betroffenenrechte ────────────────────────────────────────────────
// GET  ?id=…  → Auskunft nach Art. 15: alles, was wir über die Person haben
//              (Kartei, Chancen, Mandate, Event-Teilnahmen) als JSON-Datei.
// POST { id, grund } → Löschen nach Art. 17: Person raus aus Kartei und aus ALLEN
//              CRM-Listen (lib/crm/person-verweise.ts). Ins Löschprotokoll kommt nur Kennung,
//              Datum und Grund — keine Personendaten. Eine Werbesperre ist
//              meist die bessere Wahl (Art. 21): dann bleibt „nicht anschreiben“
//              erhalten. Deshalb fragt die Oberfläche das vorher ab.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { fuerPerson } from '@/lib/make-one/crm';
import { zahlungMaskiert } from '@/lib/crm/zahlung';
import { personEntfernen, personVerweise } from '@/lib/crm/person-verweise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const k = ((await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []).find(x => x.id === id);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  const crm = await ladeCrm();
  const auskunft = {
    erstellt: new Date().toISOString(), verantwortlich: 'Kevin Dieckmann (KD Ventures / Kevin Dieckmann Consulting)',
    // Private Notizen sieht nur, wer sie schrieb — auch in der Auskunft (26.09.).
    // IBAN (Entscheidung 28.09., H4): Die Auskunft nach Art. 15 enthält die volle IBAN, wenn sie zur Person
    // gehört (Kontakt.zahlung — nur bei Personen ohne Firma). Die IBAN einer Firma ist kein Datum der Person:
    // sie steht hier nur maskiert, wie überall sonst im Browser.
    person: fuerPerson(k, personAus(req), { ibanVoll: true }), firma: (() => { const f = k.firmaId ? crm.firmen.find(x => x.id === k.firmaId) : undefined; return f ? { ...f, ...(f.zahlung ? { zahlung: zahlungMaskiert(f.zahlung) } : {}) } : null; })(),
    // Alle Listen aus einer Stelle (27.09.): Deals mit Rolle, Mandate, Events, Follow-ups, Kampagnen, Beiträge, Power-Hour-Karten, Anträge.
    ...personVerweise(crm, id),
  };
  return new Response(JSON.stringify(auskunft, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="Auskunft-Art15-${id}-${localDay()}.json"` } });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
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
  // Aus ALLEN Listen — eine Stelle kennt sie (lib/crm/person-verweise.ts, 27.09.): auch Follow-ups, Deal-Rollen, Power-Hour-Karten, Anträge.
  await aendereCrm(c => personEntfernen(c, id));
  await updateJson<{ eintraege: { id: string; datum: string; grund: string; von: string }[] }>('crm-loeschprotokoll', cur => ({ eintraege: [...(cur?.eintraege ?? []), { id, datum: localDay(), grund: String(b.grund ?? 'Art. 17 DSGVO').slice(0, 200), von: personAus(req) }] }));
  return NextResponse.json({ ok: true });
}
