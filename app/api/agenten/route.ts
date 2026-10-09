// ─── Agenten-Bereich: Heads und Überblick der Person (09.10., Paket 1 „Kern“) ──────────────────────────────────────────────────
// GET → `AgentenAntwort` (lib/agenten/typen.ts): ZOE, die Heads, die die Person sehen darf (serverseitig gefiltert:
// lib/agenten/sicht.ts), Überblick über dem ZOE-Chat (Antwort 1: passiert seit dem letzten Besuch, in Arbeit je Head, Freigaben als
// Zahl, Jahresziele, Kurz-Briefing regelbasiert). `?seit=<ISO>` = letzter Besuch (der Browser merkt ihn sich; Lesen schreibt nie),
// ohne Angabe die letzten 24 Stunden. Seit Paket 4b je Head die Einstellungen (wirksam, Kosten, Rechte, Stand), das Instanz-Budget und
// die wählbaren zuständigen Personen — Privat-Heads nur mit dem EIGENEN Abschnitt (lib/agenten/einstellung.ts `mitPerson`).
// POST (Paket 4b, `EinstellungAnfrage`):
//   einstellung  { headId, teil, stand } — Modell, Aufwand, Budget je Head, Autonomie (nur verschärfen), zuständige Person, an/aus, Foto,
//                Mitarbeiter aus; Haushalts-Heads nur volle Mitglieder, Privat-Heads nur die Person selbst (403), Stand → 409, Prüfung → 400
//   not-aus      { an, headId? } — für alle (nur volle Mitglieder) bzw. je Head (wer ihn sieht); Setzen hält laufende Läufe sofort an
// Nur die Person selbst (`eigenePerson`, Dienstweg 403), keine Personen-Parameter, Body ≤ 16 KB (`jsonBegrenzt`), Bau-Kennung beim Schreiben.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';
import { agentenAntwort } from '@/lib/agenten/faeden-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, error: fehler, ...extra }, { status });

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const roh = new URL(req.url).searchParams.get('seit');
  const t = roh ? Date.parse(roh) : NaN;
  const seit = new Date(Number.isFinite(t) && t <= Date.now() ? t : Date.now() - 24 * 3_600_000).toISOString();
  try {
    return NextResponse.json(await agentenAntwort(z.person, seit), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const fehler = `Agenten-Bereich gerade nicht lesbar (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}).`;
    return NextResponse.json({ ok: false, fehler, error: fehler }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  if (!b || typeof b !== 'object') return nein(400, 'Anfrage fehlt.');
  const { einstellungAendern, notAusSetzen } = await import('@/lib/agenten/einstellung');
  if (b.aktion === 'einstellung') {
    const r = await einstellungAendern(z.person, b.headId, b.teil, b.stand);
    return r.ok ? NextResponse.json({ ok: true, headId: r.headId, stand: r.stand, felder: r.felder }) : nein(r.status, r.fehler, r.stand ? { stand: r.stand } : {});
  }
  if (b.aktion === 'not-aus') {
    const r = await notAusSetzen(z.person, b.an, b.headId);
    return r.ok ? NextResponse.json(r) : nein(r.status, r.fehler);
  }
  return nein(400, 'Unbekannte Aktion — „einstellung“ oder „not-aus“.');
}
