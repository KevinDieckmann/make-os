// ─── Markttraktion · Marketing — Anfragen-Eingang (27.09.) ──────────────────
// GET  → { ok, heute, liste, offen, kanaele } — Anfragen der letzten 30 Tage aus den
//        Verläufen, mit Follow-up-Stand und Deal derselben Person (lib/crm/anfragen.ts)
// POST { aktion: 'anlegen', kontaktId? | neu: { vorname, nachname, email, firma, telefon }, kanal, bezug?: { art, id }, text, datum? }
//      → Person (neu oder vorhanden) mit Aktivität „Anfrage über …“, Einwilligung
//        „Antwort auf Anfrage“, Wirkung am Beitrag bzw. Ergebnis an der Kampagne,
//        Follow-up „Anfrage beantworten“ (heute), Lead → „kontaktiert“.
// Beantwortet wird über /api/crm/followup { aktion: 'erledigen', id } — dieselbe
// Follow-up-Ebene wie überall. Versendet wird nichts.
// Woche 2 (09.10.): · 1.8 — eine NEUE Person mit Firmennamen bekommt ihre Firma über denselben Weg wie „Person anlegen“ (`firmaSichern`:
//   vorhanden verknüpfen, sonst anlegen, aus dem Papierkorb zurückholen) — vorher blieb der Name nur Text und der Lead hing an der Person.
//   · 1.9 — aus der Inbox (`gespraechId`): nur, wenn das Postfach im Business-Bereich liegt (der Server liest das Gespräch der Person);
//   aus einem Privat-Postfach entsteht kein Business-Lead (403).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { personAus } from '@/lib/zoe/raum';
import { fuerPerson, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { anfragenListe, ANFRAGE_KANAELE, type AnfrageEingabe } from '@/lib/crm/anfragen';
import { anfrageAnlegen } from '@/lib/crm/anfrage-anlegen';
import { nameVon } from '@/lib/crm/team';
import { kontaktAnlegenErlaubt, KONTAKT_NUR_BUSINESS } from '@/lib/inbox/aus-gespraech';
import { istGespraechId } from '@/lib/inbox/strom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const kontakteLaden = async () => (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const etag = etagAus('anf', await speicherStand(['crm', 'kontakte']), localDay());
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const [kontakte, crm] = await Promise.all([kontakteLaden(), ladeCrm()]);
  const heute = localDay();
  const liste = anfragenListe(kontakte, crm, heute);
  return jsonAntwort(req, { ok: true, heute, liste, offen: liste.filter(z => z.offen).length, kanaele: ANFRAGE_KANAELE.map(k => ({ id: k.id, label: k.label })) }, etag);
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: Partial<AnfrageEingabe> & { aktion?: string; gespraechId?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'anlegen') return NextResponse.json({ ok: false, fehler: 'aktion: anlegen.' }, { status: 400 });
  const person = personAus(req);
  // 1.9: aus der Inbox nur im Business-Bereich — das Gespräch muss der Person gehören (gelesen aus IHREN Spiegeln).
  if (b.gespraechId !== undefined) {
    if (!istGespraechId(b.gespraechId) || !person) return NextResponse.json({ ok: false, fehler: 'Gespräch nicht gefunden.' }, { status: 404 });
    const { gespraechLesen } = await import('@/lib/inbox/gespraech-server');
    const g = await gespraechLesen(person, b.gespraechId);
    if (!g) return NextResponse.json({ ok: false, fehler: 'Gespräch nicht gefunden.' }, { status: 404 });
    if (!kontaktAnlegenErlaubt(g.gespraech.bereich)) return NextResponse.json({ ok: false, fehler: KONTAKT_NUR_BUSINESS }, { status: 403 });
  }
  const eingabe = { kontaktId: b.kontaktId, neu: b.neu, kanal: b.kanal as AnfrageEingabe['kanal'], bezug: b.bezug, text: String(b.text ?? ''), datum: b.datum };
  // Der EINE Schreibweg (24.10.): lib/crm/anfrage-anlegen.ts — Probe, Firma, Kartei-Sperre, CRM, Ereignis (auch für den Innovations-Check).
  const r = await anfrageAnlegen(eingabe, { person, wer: werAus(req) });
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler }, { status: 400 });
  const fertig = r.bau;
  const text = `${fertig.neuePerson ? 'Neu in der Kartei: ' : ''}Anfrage bei ${fertig.kontakt.vorname || fertig.kontakt.nachname ? `${fertig.kontakt.vorname} ${fertig.kontakt.nachname}`.trim() : fertig.kontakt.firma ?? fertig.kontakt.email ?? fertig.kontakt.telefon ?? 'der Person'} festgehalten — Follow-up „${fertig.followUp.text}“ steht heute bei ${nameVon(fertig.followUp.zustaendig)}.`;
  return NextResponse.json({ ok: true, kontakt: fuerPerson(fertig.kontakt, person), kontaktId: fertig.kontakt.id, neuePerson: fertig.neuePerson, followUpId: fertig.followUp.id, ...(fertig.hinweis ? { hinweis: fertig.hinweis } : {}), text });
}
