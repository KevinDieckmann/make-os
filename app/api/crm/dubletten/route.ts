// ─── CRM — Dubletten ────────────────────────────────────────────────────────
// GET  → Paare mit gleichem Namen und zweitem gemeinsamen Merkmal
// POST { behalten, weg } → zusammenführen (Verlauf, Einwilligungen, Sperre, private
//      Notiz nur paarweise — lib/crm/dubletten.ts) und ALLE Verweise umbiegen: CRM,
//      Dateiablage, Import-Konflikte, Heads, Termine, Aufgaben (lib/crm/person-bestaende.ts,
//      28.09.). Bewusste Handlung, einzeln.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
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
  // Regel 5 (28.09., K1): Zusammenführen nur mit ausdrücklicher Person — sie entscheidet über private Notizen und
  // steht im Verlauf. Kein Rückfall auf „kevin“ für einen Dienstaufruf ohne Person.
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, fehler: 'Zusammenführen nur mit angemeldeter Person.' }, { status: 401 });
  let body: { behalten?: string; weg?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!body.behalten || !body.weg || body.behalten === body.weg) return NextResponse.json({ ok: false, fehler: 'behalten und weg nötig.' }, { status: 400 });
  let ergebnis: Kontakt | null = null;
  let notizKonflikt = false;
  let eingeschraenkt = false;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    const a = f.kontakte.find(x => x.id === body.behalten), b = f.kontakte.find(x => x.id === body.weg);
    if (!a || !b) return f;
    if (privatNotizKonflikt(a, b)) { notizKonflikt = true; return f; }
    // Art. 18 (U2): eine eingeschränkte Person wird nicht bearbeitet — auch nicht zusammengeführt.
    if (a.eingeschraenkt || b.eingeschraenkt) { eingeschraenkt = true; return f; }
    ergebnis = zusammenfuehren(a, b, person, new Date().toISOString());
    return { ...f, kontakte: f.kontakte.filter(x => x.id !== b.id).map(x => (x.id === a.id ? ergebnis! : x)) };
  });
  if (notizKonflikt) return NextResponse.json({ ok: false, fehler: 'Beide Einträge haben eine private Notiz von verschiedenen Personen. Bitte zuerst eine davon übertragen oder leeren — sonst ginge sie beim Zusammenführen verloren.' }, { status: 409 });
  if (eingeschraenkt) return NextResponse.json({ ok: false, fehler: 'Die Verarbeitung einer der beiden Personen ist eingeschränkt (Art. 18) — erst aufheben (mit Grund), dann zusammenführen.' }, { status: 409 });
  if (!ergebnis) return NextResponse.json({ ok: false, fehler: 'Kontakt nicht gefunden.' }, { status: 404 });
  const umgebogen = await personUmbiegen(body.weg, body.behalten);
  return NextResponse.json({ ok: true, kontakt: fuerPerson(ergebnis, person), speicher: umgebogen.speicher });
}
