// ─── ZOE auf WhatsApp — der eigene Kanal der angemeldeten Person (08.10.2026) ───────────────────────────────────────────
// GET  → ZoeWhatsappStatus: eingerichtet? (fehlende Variablen nur als NAMEN und nur für den Inhaber) · eigener Kanal (Nummer maskiert,
//        Einwilligung, Ausnahme, Fenster, Sprachnachrichten-Liste) · ZOE-Nummer + Vorlage aus dem Cache. Schreibt nie.
// POST { aktion: 'verbinden', nummer, fassung }  → Code (15 Min.) — die Person schickt ihn von DIESER Nummer an die ZOE-Nummer
//      { aktion: 'inhalte', an, fassung }        → Ausnahme „Inhalte senden“ an/aus (Nachweis)
//      { aktion: 'test' }                        → Test-Nachricht (im Fenster frei, sonst Vorlage „Briefing bereit“)
//      { aktion: 'trennen' }                     → Kanal beenden (wie „STOP“): Nummer, Sprachnachrichten weg, Nachweis bleibt
//      { aktion: 'pruefen' }                     → Nummer und Vorlage sofort bei Meta nachsehen
//      { aktion: 'registrieren', pin, speicherort } → die ZOE-Nummer einmalig registrieren (NUR der Inhaber; PIN nie gespeichert)
// NUR die Person selbst (`eigenePerson`: Sitzung im Haushalt des Inhabers; Dienstweg 403) — keine Personen-Parameter, auch der Inhaber
// verwaltet nie den Kanal einer anderen Person.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { inhalteSetzen, registrieren, testSenden, trennen, verbindenStarten, zoeWhatsappStatus } from '@/lib/zoe-whatsapp/verwalten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false, fehler: 'Den ZOE-Kanal auf WhatsApp verwaltet nur die Person selbst — angemeldet, nie über den Dienstweg.' } as const;
const KEIN_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return NextResponse.json(await zoeWhatsappStatus(z.person), { headers: KEIN_CACHE });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: unknown; nummer?: unknown; fassung?: unknown; an?: unknown; pin?: unknown; speicherort?: unknown };
  try { b = await jsonBegrenzt(req, 4 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const antwort = async (r: { ok: true } | { ok: false; status: number; fehler: string }, extra: Record<string, unknown> = {}) => (r.ok
    ? NextResponse.json({ ...(await zoeWhatsappStatus(z.person)), ...extra, ...r }, { headers: KEIN_CACHE })
    : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status, headers: KEIN_CACHE }));
  switch (b.aktion) {
    case 'verbinden': {
      const r = await verbindenStarten(z.person, b.nummer, b.fassung);
      // Der Code geht genau einmal hinaus (gespeichert ist nur sein Fingerabdruck).
      return r.ok ? antwort({ ok: true }, { verbinden: { code: r.code, bis: r.bis, nummer: r.nummer, ...(r.zoeNummer ? { zoeNummer: r.zoeNummer } : {}), ...(r.link ? { link: r.link } : {}) } }) : antwort(r);
    }
    case 'inhalte': return antwort(await inhalteSetzen(z.person, b.an, b.fassung));
    case 'test': { const r = await testSenden(z.person); return r.ok ? antwort({ ok: true }, { text: `Test gesendet ${r.wie}.` }) : antwort(r); }
    case 'trennen': { const r = await trennen(z.person, 'app'); return r.ok ? antwort({ ok: true }, { text: r.war ? 'Getrennt.' : 'War nicht verbunden.' }) : antwort(r); }
    case 'pruefen': return NextResponse.json(await zoeWhatsappStatus(z.person, { pruefen: true }), { headers: KEIN_CACHE });
    case 'registrieren': { const r = await registrieren(z.person, b.pin, b.speicherort); return r.ok ? antwort({ ok: true }, { text: 'ZOE-Nummer registriert.' }) : antwort(r); }
    default: return NextResponse.json({ ok: false, fehler: 'aktion: verbinden, inhalte, test, trennen, pruefen oder registrieren.' }, { status: 400 });
  }
}
