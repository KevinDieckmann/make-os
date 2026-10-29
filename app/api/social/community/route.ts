// ─── MAKE OS — Social: Kommentare und DMs von Instagram (28.10.2026, Malin-Paket) ───────────────────────────────────────────────────────
// GET  → Fäden der Kanäle, die diese Person sieht (Kommentare je Beitrag, DMs je Gegenüber), mit Stand des letzten Abholens.
// POST { aktion } — nur eine angemeldete Person (Dienstweg 403), Bau-Kennung:
//   abholen { kanalId } · antworten { kanalId, faden, text, antwortAuf? } (per Klick; Not-Aus, Tageslimits, Personenmarke nur die Person,
//   DM nur im 24-h-Fenster) · vorschlag { kanalId, faden } (ZOE, `modellSchranke`, Text Dritter gekapselt) · gelesen/erledigt { kanalId, faden }
//   · fremd-entwurf { kanalId, link, text? } (Kommentar-Entwurf für den Beitrag eines ANDEREN Accounts — gepostet wird von Hand) · fremd-erledigt/-weg { kanalId, id }.
// Automatische Antworten schickt nur der Takt (lib/social/community-agent.ts, Modus „auto“ am Kanal).
// Nichts geht automatisch raus.
import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { modellSchranke } from '@/lib/zugang/umfang';
import { ladeSocial } from '@/lib/social/server';
import { socialFuerPerson } from '@/lib/social/daten';
import { antwortVorschlag, communityAbholen, communityAntworten, fadenMarkieren, faedenAus, ladeCommunity, fremdEntwurf, fremdMarkieren } from '@/lib/social/community';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (status: number, text: string) => NextResponse.json({ ok: false, fehler: text }, { status });

async function lage(person: string) {
  const sicht = socialFuerPerson(await ladeSocial(), person);
  const ids = new Set(sicht.kanaele.filter(k => k.plattformen.includes('instagram')).map(k => k.id));
  const d = await ladeCommunity();
  const faeden = faedenAus(d, ids);
  const sichtbar = new Set(faeden.map(f => f.id));
  const alle = new Set(sicht.kanaele.map(k => k.id));
  return {
    faeden, abgeholt: Object.fromEntries(Object.entries(d.abgeholt ?? {}).filter(([k]) => ids.has(k))),
    entwuerfe: Object.fromEntries(Object.entries(d.entwuerfe ?? {}).filter(([f]) => sichtbar.has(f))),
    fremd: (d.fremd ?? []).filter(f => alle.has(f.kanalId)),
  };
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  return NextResponse.json({ ok: true, ...(await lage(z.person)) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (z.dienst) return fehler(403, 'Antworten gibt nur eine angemeldete Person — nicht ZOE, nicht der Takt.');
  const bau = bauPruefen(req); if (bau) return bau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? fehler(400, 'Kein JSON.'); }
  const sicht = socialFuerPerson(await ladeSocial(), z.person);
  const kanal = sicht.kanaele.find(k => k.id === b.kanalId);
  if (!kanal) return fehler(404, 'Kanal nicht gefunden.');
  if (b.aktion === 'fremd-entwurf') {
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const r = await fremdEntwurf(z.person, kanal, String(b.link ?? '').trim(), typeof b.text === 'string' ? b.text : '');
    return r.ok ? NextResponse.json({ ok: true, ki: true, ...(await lage(z.person)) }) : fehler(r.status, r.fehler);
  }
  if (b.aktion === 'fremd-erledigt' || b.aktion === 'fremd-weg') {
    const ok = await fremdMarkieren(String(b.id ?? ''), kanal.id, b.aktion === 'fremd-weg' ? 'weg' : 'erledigt');
    return ok ? NextResponse.json({ ok: true, ...(await lage(z.person)) }) : fehler(404, 'Eintrag nicht gefunden.');
  }
  const fadenId = typeof b.faden === 'string' ? b.faden : '';
  const meinFaden = fadenId.startsWith(`dm~${kanal.id}~`) || fadenId.startsWith(`km~${kanal.id}~`);
  if (b.aktion === 'abholen') {
    const r = await communityAbholen(kanal.id);
    if (r.fehler) return fehler(502, `Instagram: ${r.fehler}`);
    return NextResponse.json({ ok: true, neu: r.neu, ...(await lage(z.person)) });
  }
  if (!meinFaden) return fehler(404, 'Gespräch nicht gefunden.');
  if (b.aktion === 'gelesen' || b.aktion === 'erledigt') {
    await fadenMarkieren(fadenId, b.aktion);
    return NextResponse.json({ ok: true, ...(await lage(z.person)) });
  }
  if (b.aktion === 'vorschlag') {
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const faden = faedenAus(await ladeCommunity(), new Set([kanal.id])).find(f => f.id === fadenId);
    if (!faden) return fehler(404, 'Gespräch nicht gefunden.');
    const r = await antwortVorschlag(z.person, kanal, faden);
    return r.ok ? NextResponse.json({ ok: true, text: r.text, ki: true }) : fehler(409, r.fehler);
  }
  if (b.aktion === 'antworten') {
    if (typeof b.text !== 'string') return fehler(400, 'Text fehlt.');
    const r = await communityAntworten(z.person, kanal, fadenId, b.text, typeof b.antwortAuf === 'string' ? b.antwortAuf : undefined);
    if (!r.ok) return fehler(r.status, r.fehler);
    await protokolliere('social', [{ liste: 'community', op: 'neu', id: fadenId.split('~')[0] }], werAus(req)).catch(() => {});
    return NextResponse.json({ ok: true, ...(await lage(z.person)) });
  }
  return fehler(400, 'aktion: abholen, antworten, vorschlag, gelesen, erledigt, fremd-entwurf, fremd-erledigt, fremd-weg.');
}
