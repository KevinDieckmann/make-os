// ─── Chat je Bereich: mit wem der Chat unten sprechen darf (10.10., Auftrag: „im Sales der Head of Sales, im Marketing der Head of Marketing
// — und dann können wir immer zu ZOE umschalten“; lib/agenten/kontext-head.ts) ──────────────────────────────────────────────────────────
// GET `?space=privat|business` → `ChatKontextAntwort`: die Heads DIESER Sicht, die die Person sehen darf (EINE Filterstelle
// lib/agenten/sicht.ts — Business-Heads nie in der Privat-Sicht, Privat-Heads nur volle Mitglieder, Gesundheit nur mit Einwilligung (a)+(b)
// der Person selbst), je Head ob er gerade gesperrt ist (Not-Aus, aus), `fehlt` (nur, was die Person selbst ändern kann: die eigene
// Gesundheits-Einwilligung) und die eigene Wahl „passender Head“ / „immer ZOE“. Leicht: keine Kennzahlen, keine Threads, kein Modell.
// POST `{ wahl: 'seite' | 'zoe' }` → die Wahl im Index der Threads der Person (`agenten-faeden--<person>` › `chat`, kein neuer Bestand).
// Gesprochen wird über die vorhandenen Wege (Head: POST /api/agenten/faden `senden`, ZOE: /api/kimmi) — hier nie.
// Nur die Person selbst (`eigenePerson`, Dienstweg 403), keine Personen-Parameter, Körper ≤ 2 KB, Bau-Kennung beim Schreiben.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';
import { KATALOG } from '@/lib/agenten/katalog';
import { headImBereich, headsFuer, sichtBereichAus } from '@/lib/agenten/sicht';
import { bestandLesen, indexAendern, sichtLaden } from '@/lib/agenten/faeden-server';
import { CHAT_WAHL_VORGABE, istChatWahl, type ChatFehlt, type ChatHead, type ChatKontextAntwort } from '@/lib/agenten/kontext-head';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler, error: fehler }, { status });

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const space = sichtBereichAus(new URL(req.url).searchParams.get('space'));
  if (!space) return nein(400, 'space ist privat oder business.');
  const sicht = await sichtLaden(z.person);
  const sichtbar = headsFuer(sicht).filter(h => headImBereich(h.id, space));
  const { chatSperren } = await import('@/lib/agenten/einstellung');
  const [sperren, index] = await Promise.all([chatSperren(z.person, sichtbar), bestandLesen(z.person).catch(() => null)]);
  const heads: ChatHead[] = sichtbar.map(h => {
    const gesperrt = sperren.get(h.id);
    return { id: h.id, name: h.name, kurz: h.kurz, farbe: h.farbe, bereich: h.bereich, auftrag: h.auftrag, ...(h.hinweis ? { hinweis: h.hinweis } : {}), ...(gesperrt ? { gesperrt } : {}) };
  });
  // Was fehlt — nur, was die Person SELBST ändern kann (die eigene Einwilligung); über andere Heads (Rechte, Finanzzugang) sagt die Antwort nichts.
  const fehlt: Partial<Record<string, ChatFehlt>> = {};
  if (sicht.imHaushalt && sicht.vollesMitglied && !(sicht.gesundheit.verarbeiten && sicht.gesundheit.ki)) {
    for (const h of KATALOG) if (h.voraussetzung === 'gesundheit-ki' && headImBereich(h.id, space) && !sichtbar.some(x => x.id === h.id)) fehlt[h.id] = 'einwilligung';
  }
  const gemerkt = index?.chat?.wahl;
  const wahl = istChatWahl(gemerkt) ? gemerkt : CHAT_WAHL_VORGABE;
  return NextResponse.json({ ok: true, heads, wahl, fehlt } satisfies ChatKontextAntwort, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 2_000); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  if (!b || typeof b !== 'object' || !istChatWahl(b.wahl)) return nein(400, 'wahl ist „seite“ (passender Head) oder „zoe“ (immer ZOE).');
  const wahl = b.wahl;
  const r = await indexAendern(z.person, () => ({ e: wahl, neu: { chat: { wahl, am: new Date().toISOString() } } }));
  return r.ok ? NextResponse.json({ ok: true, wahl: r.e }) : nein(r.status, r.fehler);
}
