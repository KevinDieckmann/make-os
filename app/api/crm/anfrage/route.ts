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
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { personAus } from '@/lib/zoe/raum';
import { fuerPerson, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { anfrageBauen, anfragenListe, ANFRAGE_KANAELE, type AnfrageEingabe } from '@/lib/crm/anfragen';
import { sperrlisteLaden, neuanlageSperre, sperren } from '@/lib/crm/sperrliste';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => neueKennung(p);
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
  const crm = await ladeCrm();
  const eingabe = { kontaktId: b.kontaktId, neu: b.neu, kanal: b.kanal as AnfrageEingabe['kanal'], bezug: b.bezug, text: String(b.text ?? ''), datum: b.datum };
  const ids = { kontakt: neueId('c'), followUp: neueId('fu') };
  // Sperrliste (28.09., Ablaufprüfung): eine NEUE Person darauf bekommt die Werbesperre — nicht blockiert.
  const sperrEintraege = await sperrlisteLaden();
  const sperre = (k: Kontakt) => neuanlageSperre(k, sperrEintraege, heute);
  type Bau = Extract<ReturnType<typeof anfrageBauen>, { ok: true }>['bau'];
  // Prüfen und Schreiben in EINER Sperre auf dem frischen Stand (Prüfbericht 27.09., Punkt 10) — vorher wurde ein vorab
  // geladener Kontakt zurückgeschrieben, und was die andere Person inzwischen geändert hatte, ging verloren.
  let bau: Bau | null = null; let fehler = '';
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const r = anfrageBauen(eingabe, { kontakte: f.kontakte, crm, person, heute, jetzt, ids, sperre });
    if (!r.ok) { fehler = r.fehler; return f; }
    bau = r.bau;
    const i = f.kontakte.findIndex(x => x.id === r.bau.kontakt.id);
    if (i < 0) return { ...f, kontakte: [...f.kontakte, r.bau.kontakt] };
    // Der Verlauf ist ein Anhänge-Log: was inzwischen dazukam, bleibt.
    const alt = f.kontakte[i];
    const neu = { ...r.bau.kontakt, aktivitaeten: [...alt.aktivitaeten.filter(a => !r.bau.kontakt.aktivitaeten.some(x => x.am === a.am && x.art === a.art && x.text === a.text)), ...r.bau.kontakt.aktivitaeten].sort((a, x) => a.am.localeCompare(x.am)) };
    return { ...f, kontakte: f.kontakte.map((x, j) => (j === i ? neu : x)) };
  }, werAus(req));
  if (fehler || !bau) return NextResponse.json({ ok: false, fehler: fehler || 'Anfrage nicht angelegt.' }, { status: 400 });
  const fertig = bau as Bau;
  // Neue Person mit Werbesperre aus der Sperrliste: auch die Liste trägt sie (idempotent).
  if (fertig.neuePerson && fertig.kontakt.werbesperre) await sperren([fertig.kontakt], 'werbesperre', heute);
  // 2 · CRM-Bestand: Follow-up, Wirkung am Beitrag, Ergebnis an der Kampagne, Lead der Firma.
  await aendereCrm(c => ({
    ...c,
    followups: [...(c.followups ?? []), { ...fertig.followUp, geaendertVon: person }],
    ...(fertig.wirkung ? { beitraege: c.beitraege.map(x => (x.id === fertig.wirkung!.beitragId && !x.wirkung.some(w => w.kontaktId === fertig.kontakt.id && w.art === 'anfrage') ? { ...x, wirkung: [...x.wirkung, fertig.wirkung!.eintrag], geaendert: jetzt, geaendertVon: person } : x)) } : {}),
    ...(fertig.kampagne ? { kampagnen: c.kampagnen.map(x => (x.id === fertig.kampagne!.id ? { ...x, kontaktIds: fertig.kampagne!.kontaktIds, ergebnisse: [...x.ergebnisse, fertig.kampagne!.ergebnis], status: x.status === 'entwurf' ? 'aktiv' as const : x.status, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
    ...(fertig.firmaLead ? { firmen: c.firmen.map(x => (x.id === fertig.firmaLead!.firmaId ? { ...x, lead: fertig.firmaLead!.lead, geaendert: jetzt, geaendertVon: person } : x)) } : {}),
  }));
  const text = `${fertig.neuePerson ? 'Neu in der Kartei: ' : ''}Anfrage bei ${fertig.kontakt.vorname || fertig.kontakt.nachname ? `${fertig.kontakt.vorname} ${fertig.kontakt.nachname}`.trim() : fertig.kontakt.firma ?? fertig.kontakt.email} festgehalten — Follow-up „${fertig.followUp.text}“ steht heute bei ${fertig.followUp.zustaendig}.`;
  return NextResponse.json({ ok: true, kontakt: fuerPerson(fertig.kontakt, person), kontaktId: fertig.kontakt.id, neuePerson: fertig.neuePerson, followUpId: fertig.followUp.id, ...(fertig.hinweis ? { hinweis: fertig.hinweis } : {}), text });
}
