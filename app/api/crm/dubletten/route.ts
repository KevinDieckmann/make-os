// ─── CRM — Dubletten ────────────────────────────────────────────────────────
// GET  → Paare mit gleichem Namen und zweitem gemeinsamen Merkmal
// POST { behalten, weg } → zusammenführen (Verlauf, Einwilligungen, Sperre, private
//      Notiz nur paarweise — lib/crm/dubletten.ts) und ALLE Verweise umbiegen: CRM,
//      Dateiablage, Import-Konflikte, Heads, Termine, Aufgaben (lib/crm/person-bestaende.ts,
//      28.09.). Bewusste Handlung, einzeln.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/zoe/raum';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { dubletten, zusammenfuehren, privatNotizKonflikt } from '@/lib/crm/dubletten';
import { personUmbiegen } from '@/lib/crm/person-bestaende';
import { fuerPerson } from '@/lib/make-one/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const k = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  return NextResponse.json({ ok: true, paare: dubletten(k).map(([a, b]) => ({ a: { id: a.id, name: anzeigename(a), email: a.email, firma: a.firma, verlauf: a.aktivitaeten?.length ?? 0 }, b: { id: b.id, name: anzeigename(b), email: b.email, firma: b.firma, verlauf: b.aktivitaeten?.length ?? 0 } })) });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let body: { behalten?: string; weg?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!body.behalten || !body.weg || body.behalten === body.weg) return NextResponse.json({ ok: false, fehler: 'behalten und weg nötig.' }, { status: 400 });
  const person = personAus(req);
  let ergebnis: Kontakt | null = null;
  let notizKonflikt = false;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    const a = f.kontakte.find(x => x.id === body.behalten), b = f.kontakte.find(x => x.id === body.weg);
    if (!a || !b) return f;
    if (privatNotizKonflikt(a, b)) { notizKonflikt = true; return f; }
    ergebnis = zusammenfuehren(a, b, person, new Date().toISOString());
    return { ...f, kontakte: f.kontakte.filter(x => x.id !== b.id).map(x => (x.id === a.id ? ergebnis! : x)) };
  });
  if (notizKonflikt) return NextResponse.json({ ok: false, fehler: 'Beide Einträge haben eine private Notiz von verschiedenen Personen. Bitte zuerst eine davon übertragen oder leeren — sonst ginge sie beim Zusammenführen verloren.' }, { status: 409 });
  if (!ergebnis) return NextResponse.json({ ok: false, fehler: 'Kontakt nicht gefunden.' }, { status: 404 });
  const umgebogen = await personUmbiegen(body.weg, body.behalten);
  return NextResponse.json({ ok: true, kontakt: fuerPerson(ergebnis, person), speicher: umgebogen.speicher });
}
