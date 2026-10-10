// ─── Inbox — Aufgaben-Vorschläge aus Mails/WhatsApp (10.10.2026, Roadmap Phase 1) ──────────────────────────────────
// GET                                   → { ok, automatisch, letzterLauf?, offen }  der EIGENE Stand (Schalter, letzter Lauf, offene Vorschläge)
// POST { aktion: 'holen' }              → { ok, geprueft, gelegt, text }  „Vorschläge holen“: das Regelwerk prüft die eigenen Gespräche jetzt
//                                         und legt Treffer in den EIGENEN Freigabe-Stapel (angelegt wird erst dort per Klick)
//      { aktion: 'automatisch', an }    → Schalter „automatisch vorschlagen“ (Takt alle 15 Min.) — nur für die eigene Person
// NUR die eigene Person aus der Sitzung (`eigenePerson`; Dienstweg 403) und nur im Haushalt des Inhabers (nur dort legt eine Freigabe eine
// Aufgabe an). Kein Mailtext in Antwort oder Protokoll — die Vorschläge stehen im Stapel (/api/zoe/stapel).
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { automatischSetzen, inboxVorschlaegeLauf, ladeVorschlagStand, INBOX_VORSCHLAG_WERKZEUG } from '@/lib/inbox/aufgaben-vorschlag-server';
import { lies } from '@/lib/zoe/stapel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_HAUSHALT = { ok: false, fehler: 'Aufgaben-Vorschläge gibt es nur im Haushalt des Inhabers.' };

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  if (!(await personImHaushaltDesInhabers(z.person))) return NextResponse.json(NUR_HAUSHALT, { status: 403 });
  const [s, offen] = await Promise.all([ladeVorschlagStand(z.person), lies('offen')]);
  return NextResponse.json({
    ok: true, automatisch: s.automatisch !== false, ...(s.letzterLauf ? { letzterLauf: s.letzterLauf } : {}),
    offen: offen.filter(v => v.person === z.person && v.werkzeug === INBOX_VORSCHLAG_WERKZEUG).length,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  if (!(await personImHaushaltDesInhabers(z.person))) return NextResponse.json(NUR_HAUSHALT, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 4 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'automatisch') {
    if (typeof b.an !== 'boolean') return NextResponse.json({ ok: false, fehler: 'an fehlt (true | false).' }, { status: 400 });
    await automatischSetzen(z.person, b.an);
    return NextResponse.json({ ok: true, text: b.an ? 'Vorschläge kommen jetzt automatisch (alle 15 Minuten).' : 'Automatisch aus — Vorschläge nur noch auf Klick.' });
  }
  if (b.aktion !== 'holen') return NextResponse.json({ ok: false, fehler: 'aktion = holen | automatisch.' }, { status: 400 });
  const r = await inboxVorschlaegeLauf(z.person, { quelle: 'klick' });
  if (r.uebersprungen === 'fehler') return NextResponse.json({ ok: false, fehler: 'Die Vorschläge ließen sich gerade nicht holen.' }, { status: 502 });
  const text = r.gelegt
    ? `${r.gelegt === 1 ? 'Ein Vorschlag liegt' : `${r.gelegt} Vorschläge liegen`} jetzt in deinen Freigaben — angelegt wird erst mit deinem Klick.`
    : r.geprueft ? `${r.geprueft === 1 ? 'Eine neue Nachricht' : `${r.geprueft} neue Nachrichten`} geprüft — keine Aufgabe darin erkannt.` : 'Nichts Neues zu prüfen.';
  return NextResponse.json({ ok: true, geprueft: r.geprueft, gelegt: r.gelegt, text });
}
