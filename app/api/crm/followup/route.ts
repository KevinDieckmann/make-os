// ─── Markttraktion — Follow-up-Ebene (27.09.) ───────────────────────────────
// GET  → alle fälligen und bald fälligen Follow-ups (echte + virtuelle aus den alten
//        Feldern), Zahlen je Gruppe, Pünktlichkeit
// POST { aktion: 'anlegen', bezug, kontaktId?, art?, text, faellig, uhrzeit?, zustaendig?, notiz?, alsAufgabe? }
//      { aktion: 'erledigen', id, ergebnis?, notiz?, naechster?: { text, faellig, art? } }
//      { aktion: 'verschieben', id, tage | faellig }
//      { aktion: 'absagen', id }
// Ein Erledigen an einer Person schreibt eine Aktivität an den Kontakt (letzter
// Kontakt, Stufe, Regel-Wiedervorlage wie in /api/crm/aktivitaet). Virtuelle
// Einträge (v:…) werden beim Erledigen zu echten, damit die Historie stimmt, und
// das alte Feld wird geleert. Nichts wird versendet.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay, tagePlus } from '@/lib/zeit';
import { personAus } from '@/lib/jarvis/raum';
import { wendeAktivitaetAn, ERGEBNISSE, type Kontakt, type Ergebnis, type AktivitaetArt } from '@/lib/make-one/crm';
import { folgeAus } from '@/lib/crm/heute';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { faellige, zaehlen, puenktlichkeit, neuesFollowUp, virtuell, tagPlus } from '@/lib/crm/followup';
import { wer } from '@/lib/crm/team';
import type { FollowUp, FollowUpArt, FollowUpBezugArt } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
const ARTEN: FollowUpArt[] = ['anruf', 'mail', 'linkedin', 'termin', 'nachricht', 'sonstig'];
const BEZUEGE: FollowUpBezugArt[] = ['kontakt', 'firma', 'chance', 'mandat', 'event'];
const AKT_ART: Record<FollowUpArt, AktivitaetArt> = { anruf: 'anruf', mail: 'mail', linkedin: 'linkedin', termin: 'termin', nachricht: 'mail', sonstig: 'notiz' };

async function kontakteLaden(): Promise<Kontakt[]> { return (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []; }

export async function GET(req: Request) {
  const etag = etagAus('fu', await speicherStand(['crm', 'kontakte']), localDay());
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const [kontakte, crm] = await Promise.all([kontakteLaden(), ladeCrm()]);
  const heute = localDay();
  const liste = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten });
  return jsonAntwort(req, { ok: true, heute, liste, zahlen: zaehlen(liste), puenktlich: puenktlichkeit(crm.followups ?? [], heute) }, etag);
}

/** Aktivität an den Kontakt schreiben (dieselben Regeln wie /api/crm/aktivitaet). */
async function aktivitaet(kontaktId: string, art: AktivitaetArt, text: string, von: string, ergebnis?: Ergebnis, bezug?: string, naechster?: { text: string; datum: string }): Promise<void> {
  const heute = localDay();
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === kontaktId);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    const folge = ergebnis ? folgeAus(ergebnis, heute, alt.stufe) : null;
    let neu = wendeAktivitaetAn(alt, { art, text: text || undefined, von, ergebnis, bezug, stufe: folge?.stufe, wiedervorlage: naechster?.datum ?? folge?.wiedervorlage }, heute, new Date().toISOString(), tagePlus);
    // Das alte Feld ist mit dem Follow-up erledigt — die Follow-up-Ebene führt jetzt.
    neu = { ...neu, naechsterSchritt: naechster ?? undefined, ...(naechster ? {} : { wiedervorlage: folge?.wiedervorlage }) };
    if (folge?.werbesperre) neu = { ...neu, werbesperre: { seit: heute, grund: text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined };
    f.kontakte[i] = neu;
    return f;
  });
}

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  const heute = localDay();
  const kontakte = await kontakteLaden();
  const crm = await ladeCrm();
  const kontakt = (id?: string) => (id ? kontakte.find(k => k.id === id) : undefined);

  if (b.aktion === 'anlegen') {
    const bz = (b.bezug ?? {}) as Record<string, unknown>;
    const kontaktId = idOk(b.kontaktId) ? String(b.kontaktId) : undefined;
    const bezug = BEZUEGE.includes(bz.art as FollowUpBezugArt) && idOk(bz.id) ? { art: bz.art as FollowUpBezugArt, id: String(bz.id) } : kontaktId ? { art: 'kontakt' as const, id: kontaktId } : null;
    const text = String(b.text ?? '').trim();
    const faellig = tagOk(b.faellig);
    if (!bezug || !text || !faellig) return NextResponse.json({ ok: false, fehler: 'Bezug, Text und Datum sind Pflicht.' }, { status: 400 });
    const f = neuesFollowUp({
      id: neueId('fu'), bezug, kontaktId: kontaktId ?? (bezug.art === 'kontakt' ? bezug.id : undefined), art: ARTEN.includes(b.art as FollowUpArt) ? (b.art as FollowUpArt) : undefined, text, faellig,
      uhrzeit: typeof b.uhrzeit === 'string' && /^\d{2}:\d{2}$/.test(b.uhrzeit) ? b.uhrzeit : undefined, zustaendig: wer(b.zustaendig), notiz: typeof b.notiz === 'string' ? b.notiz : undefined,
      quelle: ['hand', 'jarvis', 'head', 'deal', 'event', 'kampagne', 'kadenz'].includes(String(b.quelle)) ? (b.quelle as FollowUp['quelle']) : 'hand',
    }, kontakt(kontaktId ?? bezug.id), person, jetzt);
    await aendereCrm(c => ({ ...c, followups: [...(c.followups ?? []), { ...f, geaendertVon: person }] }));
    return NextResponse.json({ ok: true, followup: f, text: `Follow-up „${f.text}“ am ${f.faellig} steht.` });
  }

  const id = String(b.id ?? '');
  const v = virtuell(id);
  const echt = (crm.followups ?? []).find(f => f.id === id);
  if (!v && !echt) return NextResponse.json({ ok: false, fehler: 'Follow-up nicht gefunden.' }, { status: 404 });

  // Der virtuelle Eintrag als echtes Follow-up — damit Erledigen und Verschieben eine Geschichte haben.
  const ausVirtuell = (): FollowUp | null => {
    if (!v) return null;
    const liste = faellige(kontakte, crm, heute, { horizont: 400, wertelisten: crm.wertelisten });
    const f = liste.find(x => x.id === id);
    if (!f) return null;
    const quelle: FollowUp['quelle'] = v.quelle === 'kadenz' ? 'kadenz' : v.quelle === 'nachfassen' ? 'event' : v.quelle === 'dealschritt' ? 'deal' : 'regel';
    return neuesFollowUp({ id: neueId('fu'), bezug: { art: f.bezug.art, id: f.bezug.id }, kontaktId: f.kontaktId, art: f.art, text: f.text, faellig: f.faellig, zustaendig: f.zustaendig, quelle }, kontakt(f.kontaktId), person, jetzt);
  };
  /** Das alte Feld hinter einem virtuellen Eintrag leeren bzw. weiterstellen. */
  const altesFeld = async (neuesDatum?: string) => {
    if (!v) return;
    if (v.quelle === 'schritt') await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === v.ziel ? { ...k, naechsterSchritt: neuesDatum && k.naechsterSchritt ? { ...k.naechsterSchritt, datum: neuesDatum } : undefined, geaendertAm: jetzt } : k)) }));
    if (v.quelle === 'wiedervorlage') await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === v.ziel ? { ...k, wiedervorlage: neuesDatum, geaendertAm: jetzt } : k)) }));
    if (v.quelle === 'dealschritt') await aendereCrm(c => ({ ...c, chancen: c.chancen.map(x => (x.id === v.ziel ? { ...x, naechsterSchritt: neuesDatum && x.naechsterSchritt ? { ...x.naechsterSchritt, datum: neuesDatum } : undefined, geaendert: jetzt, geaendertVon: person } : x)) }));
    if (v.quelle === 'nachfassen') await aendereCrm(c => ({ ...c, teilnahmen: c.teilnahmen.map(t => (t.id === v.ziel ? { ...t, ...(neuesDatum ? {} : { followUpAm: heute }), geaendert: jetzt, geaendertVon: person } : t)) }));
    if (v.quelle === 'review') await aendereCrm(c => ({ ...c, mandate: c.mandate.map(m => (m.id === v.ziel ? { ...m, naechstesReview: neuesDatum ?? tagPlus(heute, 90), geaendert: jetzt, geaendertVon: person } : m)) }));
  };

  if (b.aktion === 'erledigen') {
    const f = echt ?? ausVirtuell();
    if (!f) return NextResponse.json({ ok: false, fehler: 'Follow-up nicht gefunden.' }, { status: 404 });
    const ergebnis = ERGEBNISSE.includes(b.ergebnis as Ergebnis) ? (b.ergebnis as Ergebnis) : undefined;
    const n = b.naechster as { text?: unknown; faellig?: unknown; art?: unknown } | undefined;
    const naechster = n && String(n.text ?? '').trim() && tagOk(n.faellig) ? { text: String(n.text).trim().slice(0, 300), faellig: tagOk(n.faellig)!, art: ARTEN.includes(n.art as FollowUpArt) ? (n.art as FollowUpArt) : f.art } : undefined;
    const notiz = typeof b.notiz === 'string' ? b.notiz.trim().slice(0, 1000) : '';
    const erledigt: FollowUp = { ...f, status: 'erledigt', erledigtAm: jetzt, ...(ergebnis ? { ergebnis } : {}), ...(notiz ? { notiz: `${f.notiz ? `${f.notiz}\n` : ''}${notiz}` } : {}), geaendert: jetzt, geaendertVon: person };
    const folge = naechster ? { ...neuesFollowUp({ id: neueId('fu'), bezug: f.bezug, kontaktId: f.kontaktId, art: naechster.art, text: naechster.text, faellig: naechster.faellig, zustaendig: f.zustaendig, quelle: 'hand' }, kontakt(f.kontaktId), person, jetzt), geaendertVon: person } : null;
    await aendereCrm(c => ({ ...c, followups: [...(c.followups ?? []).filter(x => x.id !== f.id), erledigt, ...(folge ? [folge] : [])] }));
    if (f.kontaktId) await aktivitaet(f.kontaktId, AKT_ART[f.art], `${f.text}${notiz ? ` — ${notiz}` : ''}`, person, ergebnis, f.bezug.art === 'chance' || f.bezug.art === 'event' || f.bezug.art === 'mandat' ? f.bezug.id : undefined, naechster ? { text: naechster.text, datum: naechster.faellig } : undefined);
    await altesFeld();
    return NextResponse.json({ ok: true, followup: erledigt, ...(folge ? { naechstes: folge } : {}), text: folge ? `Erledigt — nächstes Follow-up am ${folge.faellig}.` : 'Erledigt.' });
  }

  if (b.aktion === 'verschieben') {
    const zielTag = tagOk(b.faellig) ?? (Number.isFinite(Number(b.tage)) ? tagPlus(heute, Math.max(1, Math.min(90, Math.round(Number(b.tage))))) : undefined);
    if (!zielTag) return NextResponse.json({ ok: false, fehler: 'tage oder faellig nötig.' }, { status: 400 });
    if (echt) {
      const neu: FollowUp = { ...echt, faellig: zielTag, verschoben: (echt.verschoben ?? 0) + 1, geaendert: jetzt, geaendertVon: person };
      await aendereCrm(c => ({ ...c, followups: (c.followups ?? []).map(x => (x.id === echt.id ? neu : x)) }));
      return NextResponse.json({ ok: true, followup: neu, hinweis: neu.verschoben! >= 3 ? 'Zum dritten Mal verschoben — ehrlicherweise ist das keine Zusage mehr. Absagen oder ansprechen.' : undefined });
    }
    await altesFeld(zielTag);
    return NextResponse.json({ ok: true, text: `Verschoben auf ${zielTag}.` });
  }

  if (b.aktion === 'absagen') {
    if (echt) {
      const neu: FollowUp = { ...echt, status: 'abgesagt', geaendert: jetzt, geaendertVon: person };
      await aendereCrm(c => ({ ...c, followups: (c.followups ?? []).map(x => (x.id === echt.id ? neu : x)) }));
      return NextResponse.json({ ok: true, followup: neu });
    }
    await altesFeld();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: anlegen, erledigen, verschieben oder absagen.' }, { status: 400 });
}
