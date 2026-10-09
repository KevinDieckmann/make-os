// ─── Markttraktion — EIN Weg „Person anlegen“ (09.10., Woche 2 · 1.8) ──────────────────────────────────────────────────────────
// POST { aktion: 'anlegen', weg: 'kartei' | 'firmenkarte' | 'schnell' | 'prospecting' | 'makeone', person: { vorname, nachname, email,
//        telefon, mobil, position, linkedin, webseite, firma | firmaId, lebensphase, herkunft, anrede, zustaendig, naechsterSchritt: { text,
//        datum }, vonKarte, anlass }, id? }
//      → { ok, kontaktId, kontakt, firmaId?, followUpId?, hinweise[] } — Firma, Herkunft, Lebensphase, Zuständig, Follow-up entscheidet die
//        Regel des Wegs (lib/crm/person-anlegen.ts). 409 bei Dublette (`dublette: { id, name }`) und Art. 18; 413 bei zu langen Feldern.
// POST { aktion: 'firma', firma: { name, webseite?, branche?, stadt?, mitarbeiter? } }
//      → nur die Firma über denselben Weg (`firmaSichern`: vorhanden verknüpfen, neu, aus dem Papierkorb zurück) — Prospecting ohne
//        Ansprechpartner; ein Lead entsteht mit der ersten Person (Firmenkarte „+ neue Person“).
// Nur von Hand (Dienstweg 403), nur im Haushalt des Inhabers, Bau-Kennung. Versendet wird nichts.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { eingabeSaeubern, istPersonWeg } from '@/lib/crm/person-anlegen';
import { personAnlegen, firmaSichern } from '@/lib/crm/person-anlegen-server';
import { istKontaktKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  if (zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Personen legt nur eine angemeldete Person an, nicht der Dienstweg.' }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: string; weg?: string; person?: unknown; id?: string; firma?: Record<string, unknown> };
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'firma') {
    const f = b.firma ?? {};
    const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : '');
    const name = text(f.name), webseite = text(f.webseite);
    const zusatz: Record<string, string> = Object.fromEntries((['branche', 'stadt', 'mitarbeiter'] as const).map(k => [k, text(f[k])]).filter(([, v]) => v));
    if (!name) return NextResponse.json({ ok: false, fehler: 'Name der Firma fehlt.' }, { status: 400 });
    // Nie kürzen (28.09.): zu lange Angaben → 413, nichts gespeichert.
    if (name.length > 160 || webseite.length > 300 || Object.values(zusatz).some(v => v.length > 160)) return NextResponse.json({ ok: false, fehler: 'Zu lang (nichts gespeichert): Name, Webseite, Branche, Stadt oder Größe.' }, { status: 413 });
    const plan = await firmaSichern(name, { ...(webseite ? { webseite } : {}) }, werAus(req), zusatz);
    if (!plan) return NextResponse.json({ ok: false, fehler: 'Name der Firma fehlt.' }, { status: 400 });
    return NextResponse.json({ ok: true, firmaId: plan.firma.id, art: plan.art, hinweise: plan.art === 'zurueck' ? [`Die Firma „${plan.firma.name}“ lag im Papierkorb — sie ist zurückgeholt.`] : [] });
  }
  if (b.aktion !== 'anlegen') return NextResponse.json({ ok: false, fehler: 'aktion: anlegen oder firma.' }, { status: 400 });
  if (!istPersonWeg(b.weg)) return NextResponse.json({ ok: false, fehler: 'weg: kartei, firmenkarte, schnell, prospecting oder makeone.' }, { status: 400 });
  const e = eingabeSaeubern(b.person);
  if (!e.ok) return NextResponse.json({ ok: false, fehler: e.fehler }, { status: e.status });
  // Eine feste Kennung aus dem Browser (wiederholbar nach Netzfehler) — nur in der neuen Form `c-<uuid>`.
  const id = typeof b.id === 'string' && /^c-[0-9a-f-]{36}$/.test(b.id) && istKontaktKennung(b.id) ? b.id : undefined;
  const r = await personAnlegen(e.e, { weg: b.weg, person: zugang.person, wer: werAus(req), ...(id ? { id } : {}) });
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.dublette ? { dublette: r.dublette } : {}), ...(r.eingeschraenkt ? { eingeschraenkt: true } : {}) }, { status: r.status });
  return NextResponse.json({ ok: true, kontaktId: r.kontaktId, kontakt: r.kontakt, ...(r.firmaId ? { firmaId: r.firmaId } : {}), ...(r.firmaNeu ? { firmaNeu: true } : {}), ...(r.followUpId ? { followUpId: r.followUpId } : {}), hinweise: r.hinweise });
}
