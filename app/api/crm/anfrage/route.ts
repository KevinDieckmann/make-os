// ─── Markttraktion · Marketing — Anfragen-Eingang (27.09.) ──────────────────
// GET  → { ok, heute, liste, offen, kanaele } — Anfragen der letzten 30 Tage aus den
//        Verläufen, mit Follow-up-Stand und Deal derselben Person (lib/crm/anfragen.ts)
// POST { aktion: 'anlegen', kontaktId? | neu: { vorname, nachname, email, firma, telefon }, kanal, bezug?: { art, id }, text, datum? }
//      → Person (neu oder vorhanden) mit Aktivität „Anfrage über …“, Einwilligung
//        „Antwort auf Anfrage“, Wirkung am Beitrag bzw. Ergebnis an der Kampagne,
//        Follow-up „Anfrage beantworten“ (heute), Lead → „kontaktiert“.
// Beantwortet wird über /api/crm/followup { aktion: 'erledigen', id } — dieselbe
// Follow-up-Ebene wie überall. Versendet wird nichts.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { personAus } from '@/lib/jarvis/raum';
import { fuerPerson, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { anfrageBauen, anfragenListe, ANFRAGE_KANAELE, type AnfrageEingabe } from '@/lib/crm/anfragen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
  let b: Partial<AnfrageEingabe> & { aktion?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'anlegen') return NextResponse.json({ ok: false, fehler: 'aktion: anlegen.' }, { status: 400 });
  const person = personAus(req);
  const heute = localDay();
  const jetzt = new Date().toISOString();
  const [kontakte, crm] = await Promise.all([kontakteLaden(), ladeCrm()]);
  const r = anfrageBauen({ kontaktId: b.kontaktId, neu: b.neu, kanal: b.kanal as AnfrageEingabe['kanal'], bezug: b.bezug, text: String(b.text ?? ''), datum: b.datum }, { kontakte, crm, person, heute, jetzt, ids: { kontakt: neueId('c'), followUp: neueId('fu') } });
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler }, { status: 400 });
  const { bau } = r;

  // 1 · Kartei: die Person (neu oder mit Aktivität, Einwilligung, Stufe, Lead).
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === bau.kontakt.id);
    if (i < 0) return { ...f, kontakte: [...f.kontakte, bau.kontakt] };
    // Der Verlauf ist ein Anhänge-Log: was inzwischen dazukam, bleibt.
    const alt = f.kontakte[i];
    const neu = { ...bau.kontakt, aktivitaeten: [...alt.aktivitaeten.filter(a => !bau.kontakt.aktivitaeten.some(x => x.am === a.am && x.art === a.art && x.text === a.text)), ...bau.kontakt.aktivitaeten].sort((a, x) => a.am.localeCompare(x.am)) };
    return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
  });
  // 2 · CRM-Bestand: Follow-up, Wirkung am Beitrag, Ergebnis an der Kampagne, Lead der Firma.
  await aendereCrm(c => ({
    ...c,
    followups: [...(c.followups ?? []), { ...bau.followUp, geaendertVon: person }],
    ...(bau.wirkung ? { beitraege: c.beitraege.map(x => (x.id === bau.wirkung!.beitragId && !x.wirkung.some(w => w.kontaktId === bau.kontakt.id && w.art === 'anfrage') ? { ...x, wirkung: [...x.wirkung, bau.wirkung!.eintrag], geaendert: jetzt, geaendertVon: person } : x)) } : {}),
    ...(bau.kampagne ? { kampagnen: c.kampagnen.map(x => (x.id === bau.kampagne!.id ? { ...x, kontaktIds: bau.kampagne!.kontaktIds, ergebnisse: [...x.ergebnisse, bau.kampagne!.ergebnis], status: x.status === 'entwurf' ? 'aktiv' as const : x.status, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
    ...(bau.firmaLead ? { firmen: c.firmen.map(x => (x.id === bau.firmaLead!.firmaId ? { ...x, lead: bau.firmaLead!.lead, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
  }));
  const text = `${bau.neuePerson ? 'Neu in der Kartei: ' : ''}Anfrage bei ${bau.kontakt.vorname || bau.kontakt.nachname ? `${bau.kontakt.vorname} ${bau.kontakt.nachname}`.trim() : bau.kontakt.firma ?? bau.kontakt.email} festgehalten — Follow-up „${bau.followUp.text}“ steht heute bei ${bau.followUp.zustaendig}.`;
  return NextResponse.json({ ok: true, kontakt: fuerPerson(bau.kontakt, person), kontaktId: bau.kontakt.id, neuePerson: bau.neuePerson, followUpId: bau.followUp.id, ...(bau.hinweis ? { hinweis: bau.hinweis } : {}), text });
}
