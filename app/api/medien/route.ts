// ─── Medien unterwegs: Bilder und Videos aus der Kamera (09.10., Paket 5 V1 — ersetzt den Stub aus Paket 0) ─────────────────
// Auftrag (Nachtrag 08.10. spät): „Über die App Bilder und Videos machen, wenn wir unterwegs sind … geordnet, z. B. über ein Event,
// direkt auf den Server, entweder Business oder Privat … wenn sie dazu freigegeben wurden … direkt an die Head ofs.“
// GET  → `MedienListeAntwort` (erfüllt `MedienAntwort` aus dem Vertrag): Business des Haushalts, Privat nur eigene bzw. Alben „Haushalt“ —
//        gefiltert an EINER Stelle (`medienFuerBetrachter`, lib/medien/regeln.ts). `?papierkorb=1` · `?vorlage=einwilligung|schild` · `?events=1`.
// POST → Aktionen (Album, ordnen, Personen, Freigabe nur per Klick eines Menschen, an Heads geben, Einwilligung mit Unterschrift, löschen).
// Hochladen: /api/medien/upload (in Stücken), Inhalt: /api/medien/inhalt (Range), Belege: /api/medien/beleg.
// Nur die Person selbst (`eigenePerson`, Dienstweg 403), keine Personen-Parameter.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { MEDIEN_NUR_SELBST } from '@/lib/agenten/typen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { medienListe, aktionAusfuehren, einwilligungAnlegen, einwilligungVorlage } from '@/lib/medien/server';
import { antwort, fehler } from '@/lib/medien/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const vorlage = q.get('vorlage');
  if (vorlage === 'einwilligung') {
    return NextResponse.json({ ok: true, ...(await einwilligungVorlage((q.get('zwecke') ?? '').split(','), q.get('anlass') ?? undefined, q.get('sorge') === '1')) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (vorlage === 'schild') {
    const { verantwortlicherLaden } = await import('@/lib/datenschutz/einrichtung-server');
    const { verantwortlicherText } = await import('@/lib/datenschutz/einrichtung');
    const { hinweisschild } = await import('@/lib/medien/einwilligung');
    const { KANAL_NAME, KANAELE } = await import('@/lib/medien/typen');
    const { v } = await verantwortlicherLaden();
    const kanaele = (q.get('kanaele') ?? '').split(',').filter((k): k is (typeof KANAELE)[number] => (KANAELE as readonly string[]).includes(k));
    return NextResponse.json({ ok: true, text: hinweisschild({ verantwortlicher: verantwortlicherText(v), kanaele: (kanaele.length ? kanaele : ['website', 'social'] as const).map(k => KANAL_NAME[k]).join(', '), weg: v ? (v.seite || v.mail) : verantwortlicherText(v) }), verantwortlicherFehlt: !v }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (q.get('events') === '1') {
    const { mediumEvents } = await import('@/lib/medien/bezuege');
    return NextResponse.json({ ok: true, events: await mediumEvents() }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const r = await medienListe(z.person, { papierkorb: q.get('papierkorb') === '1' });
  if (!r) return fehler(403, MEDIEN_NUR_SELBST.fehler);
  if (r.einwilligungen.length) leseZugriff(req, 'medien', { anzahl: r.einwilligungen.length });
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, MEDIEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let a: Record<string, unknown>;
  try { a = await jsonBegrenzt(req, 1_000_000); }
  catch (e) { return jsonZuGross(e) ?? fehler(400, 'Ungültige Anfrage.'); }
  if (!a || typeof a !== 'object' || Array.isArray(a)) return fehler(400, 'Ungültige Anfrage.');
  const r = a.aktion === 'einwilligung-anlegen' ? await einwilligungAnlegen(z.person, a) : await aktionAusfuehren(z.person, a);
  return antwort(r as Parameters<typeof antwort>[0]);
}
