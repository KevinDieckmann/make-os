// ─── Markttraktion — Follow-up-Ebene (27.09.) ───────────────────────────────
// GET  → alle fälligen und bald fälligen Follow-ups (echte + virtuelle aus den alten
//        Feldern), Zahlen je Gruppe, Pünktlichkeit
// POST { aktion: 'anlegen', bezug, kontaktId?, art?, text, faellig, uhrzeit?, zustaendig?, notiz? }
//      { aktion: 'erledigen', id, ergebnis?, notiz?, naechster?: { text, faellig, art? } }
//      { aktion: 'verschieben', id, tage | faellig }     (nie in die Vergangenheit)
//      { aktion: 'absagen', id }                          (überfällig abgesagt = verpasst)
// Regeln (Prüfbericht 27.09.):
//   · Jede Änderung an echten Follow-ups liest den Eintrag IN der Schreibsperre — nie aus einem
//     vorab geladenen Stand (zu zweit gingen sonst Änderungen verloren).
//   · Erledigen schreibt eine Aktivität an die Person; die Felder der Person (nächster Schritt,
//     Wiedervorlage) werden NUR angefasst, wenn das Follow-up genau daraus entstanden ist.
//     Die Follow-up-Ebene führt: das Ergebnis setzt keine zweite Wiedervorlage am Kontakt.
//   · Deal-Schritt: das „Als Nächstes“ wird der nächste Schritt am Deal (die Deal-Regel bleibt erfüllt).
//   · Event-Nachfassen: nachgefasst am Gast + Lead-Hebung bei Gespräch/Termin (wie im Events-Reiter).
//   · Kadenz: verschieben/absagen legt ein echtes Follow-up an (nächster Anlauf) — vorher waren
//     die Knöpfe dort ohne Wirkung.
// Nichts wird versendet.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay, tagePlus } from '@/lib/zeit';
import { personAus } from '@/lib/jarvis/raum';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { wendeAktivitaetAn, ERGEBNISSE, type Kontakt, type Ergebnis, type AktivitaetArt } from '@/lib/make-one/crm';
import { folgeAus } from '@/lib/crm/heute';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { faellige, zaehlen, puenktlichkeit, neuesFollowUp, virtuell, tagPlus, taktVon, type Faellig } from '@/lib/crm/followup';
import { leadHebenNachGespraech, type LeadMeldung } from '@/lib/crm/lead-heben';
import { wer } from '@/lib/crm/team';
import type { CrmBestand, FollowUp, FollowUpArt, FollowUpBezugArt } from '@/lib/crm/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
const ARTEN: FollowUpArt[] = ['anruf', 'mail', 'linkedin', 'termin', 'nachricht', 'sonstig'];
const BEZUEGE: FollowUpBezugArt[] = ['kontakt', 'firma', 'chance', 'mandat', 'event'];
const AKT_ART: Record<FollowUpArt, AktivitaetArt> = { anruf: 'anruf', mail: 'mail', linkedin: 'linkedin', termin: 'termin', nachricht: 'mail', sonstig: 'notiz' };
const KEIN_ZUGANG = NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });

async function kontakteLaden(): Promise<Kontakt[]> { return (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []; }

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG;
  const etag = etagAus('fu', await speicherStand(['crm', 'kontakte']), localDay());
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const [kontakte, crm] = await Promise.all([kontakteLaden(), ladeCrm()]);
  const heute = localDay();
  const liste = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten });
  return jsonAntwort(req, { ok: true, heute, liste, zahlen: zaehlen(liste), puenktlich: puenktlichkeit(crm.followups ?? [], heute) }, etag);
}

type Herkunft = 'schritt' | 'wiedervorlage' | 'dealschritt' | 'nachfassen' | 'review' | 'kadenz' | 'echt';

/**
 * Aktivität an die Person — dieselben Regeln wie /api/crm/aktivitaet (letzter Kontakt, Stufe,
 * Werbesperre bei „Sperre“). Nächster Schritt und Wiedervorlage der Person bleiben, wie sie
 * sind; nur das Feld, aus dem das Follow-up stammt, wird geleert.
 */
async function aktivitaet(kontaktId: string, art: AktivitaetArt, text: string, von: string, ergebnis: Ergebnis | undefined, bezug: string | undefined, herkunft: Herkunft): Promise<void> {
  const heute = localDay();
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === kontaktId);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    const folge = ergebnis ? folgeAus(ergebnis, heute, alt.stufe) : null;
    let neu = wendeAktivitaetAn(alt, { art, text: text || undefined, von, ergebnis, bezug, stufe: folge?.stufe }, heute, new Date().toISOString(), tagePlus);
    // Die Follow-up-Ebene führt: keine zweite Wiedervorlage aus der Regel, keine fremde Zusage löschen.
    neu = { ...neu, wiedervorlage: herkunft === 'wiedervorlage' ? undefined : alt.wiedervorlage, naechsterSchritt: herkunft === 'schritt' ? undefined : alt.naechsterSchritt };
    if (folge?.werbesperre) neu = { ...neu, werbesperre: { seit: heute, grund: text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined };
    f.kontakte[i] = neu;
    return f;
  });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  const heute = localDay();
  const kontakte = await kontakteLaden();
  const kontakt = (id?: string) => (id ? kontakte.find(k => k.id === id) : undefined);

  if (b.aktion === 'anlegen') {
    const bz = (b.bezug ?? {}) as Record<string, unknown>;
    const kontaktId = idOk(b.kontaktId) ? String(b.kontaktId) : undefined;
    const bezug = BEZUEGE.includes(bz.art as FollowUpBezugArt) && idOk(bz.id) ? { art: bz.art as FollowUpBezugArt, id: String(bz.id) } : kontaktId ? { art: 'kontakt' as const, id: kontaktId } : null;
    const text = String(b.text ?? '').trim();
    const faellig = tagOk(b.faellig);
    if (!bezug || !text || !faellig) return NextResponse.json({ ok: false, fehler: 'Bezug, Text und Datum sind Pflicht.' }, { status: 400 });
    if (faellig < heute) return NextResponse.json({ ok: false, fehler: 'Das Datum liegt in der Vergangenheit.' }, { status: 400 });
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
  const crm = await ladeCrm();
  if (!v && !(crm.followups ?? []).some(f => f.id === id)) return NextResponse.json({ ok: false, fehler: 'Follow-up nicht gefunden.' }, { status: 404 });

  /** Der virtuelle Eintrag (aus dem aktuellen Stand) — als Vorlage für ein echtes Follow-up. */
  const virtuellerEintrag = (c: CrmBestand): Faellig | undefined => (v ? faellige(kontakte, c, heute, { horizont: 400, wertelisten: c.wertelisten }).find(x => x.id === id) : undefined);
  const echtAus = (f: Faellig, quelle: FollowUp['quelle']): FollowUp =>
    neuesFollowUp({ id: neueId('fu'), bezug: { art: f.bezug.art, id: f.bezug.id }, kontaktId: f.kontaktId, art: f.art, text: f.text, faellig: f.faellig, zustaendig: f.zustaendig, quelle }, kontakt(f.kontaktId), person, jetzt);
  const quelleVon = (h: Herkunft): FollowUp['quelle'] => (h === 'kadenz' ? 'kadenz' : h === 'nachfassen' ? 'event' : h === 'dealschritt' ? 'deal' : 'regel');
  /** Das alte Feld hinter einem virtuellen Eintrag (Deal-Schritt, Teilnahme, Review) im CRM-Bestand — die Kontaktfelder erledigt `aktivitaet()`. */
  const altesFeldImCrm = (c: CrmBestand, neuesDatum?: string): CrmBestand => {
    if (!v) return c;
    if (v.quelle === 'dealschritt') return { ...c, chancen: c.chancen.map(x => (x.id === v.ziel ? { ...x, naechsterSchritt: neuesDatum && x.naechsterSchritt ? { ...x.naechsterSchritt, datum: neuesDatum } : undefined, geaendert: jetzt, geaendertVon: person } : x)) };
    if (v.quelle === 'nachfassen') return { ...c, teilnahmen: c.teilnahmen.map(t => (t.id === v.ziel ? { ...t, ...(neuesDatum ? {} : { followUpAm: heute }), geaendert: jetzt, geaendertVon: person } : t)) };
    if (v.quelle === 'review') return { ...c, mandate: c.mandate.map(m => (m.id === v.ziel ? { ...m, naechstesReview: neuesDatum ?? tagPlus(heute, 90), geaendert: jetzt, geaendertVon: person } : m)) };
    return c;
  };
  const kontaktFeldVerschieben = async (neuesDatum: string) => {
    if (!v || (v.quelle !== 'schritt' && v.quelle !== 'wiedervorlage')) return;
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id !== v.ziel ? k : v.quelle === 'schritt' ? { ...k, ...(k.naechsterSchritt ? { naechsterSchritt: { ...k.naechsterSchritt, datum: neuesDatum } } : {}), geaendertAm: jetzt } : { ...k, wiedervorlage: neuesDatum, geaendertAm: jetzt })) }));
  };

  if (b.aktion === 'erledigen') {
    const ergebnis = ERGEBNISSE.includes(b.ergebnis as Ergebnis) ? (b.ergebnis as Ergebnis) : undefined;
    const n = b.naechster as { text?: unknown; faellig?: unknown; art?: unknown } | undefined;
    const naechsterRoh = n && String(n.text ?? '').trim() && tagOk(n.faellig) ? { text: String(n.text).trim().slice(0, 300), faellig: tagOk(n.faellig)!, art: ARTEN.includes(n.art as FollowUpArt) ? (n.art as FollowUpArt) : undefined } : undefined;
    if (naechsterRoh && naechsterRoh.faellig < heute) return NextResponse.json({ ok: false, fehler: 'Der nächste Schritt liegt in der Vergangenheit.' }, { status: 400 });
    const notiz = typeof b.notiz === 'string' ? b.notiz.trim().slice(0, 1000) : '';
    let erledigt: FollowUp | null = null, folge: FollowUp | null = null, herkunft: Herkunft = 'echt', hinweis = '';
    await aendereCrm(c => {
      const echt = (c.followups ?? []).find(f => f.id === id);
      const vorlage = echt ? null : virtuellerEintrag(c);
      if (!echt && !vorlage) return c;
      herkunft = echt ? 'echt' : (v!.quelle as Herkunft);
      const f: FollowUp = echt ?? echtAus(vorlage!, quelleVon(herkunft));
      erledigt = { ...f, status: 'erledigt', erledigtAm: jetzt, ...(ergebnis ? { ergebnis } : {}), ...(notiz ? { notiz: `${f.notiz ? `${f.notiz}\n` : ''}${notiz}` } : {}), geaendert: jetzt, geaendertVon: person };
      folge = naechsterRoh ? { ...neuesFollowUp({ id: neueId('fu'), bezug: f.bezug, kontaktId: f.kontaktId, art: naechsterRoh.art ?? f.art, text: naechsterRoh.text, faellig: naechsterRoh.faellig, zustaendig: f.zustaendig, quelle: 'hand' }, kontakt(f.kontaktId), person, jetzt), geaendertVon: person } : null;
      let neu: CrmBestand = { ...c, followups: [...(c.followups ?? []).filter(x => x.id !== f.id), erledigt, ...(folge ? [folge] : [])] };
      // Deal: das „Als Nächstes“ ist der nächste Schritt am Deal — so bleibt die Deal-Regel erfüllt.
      if (f.bezug.art === 'chance') neu = { ...neu, chancen: neu.chancen.map(x => (x.id === f.bezug.id ? { ...x, naechsterSchritt: naechsterRoh ? { text: naechsterRoh.text, datum: naechsterRoh.faellig } : (herkunft === 'dealschritt' ? undefined : x.naechsterSchritt), letzteAktivitaet: heute, geaendert: jetzt, geaendertVon: person } : x)) };
      // Event: nachgefasst am Gast (auch für echte Event-Follow-ups, nicht nur den virtuellen).
      if (f.bezug.art === 'event' && f.kontaktId) neu = { ...neu, teilnahmen: neu.teilnahmen.map(t => (t.eventId === f.bezug.id && t.kontaktId === f.kontaktId && !t.followUpAm ? { ...t, followUpAm: heute, geaendert: jetzt, geaendertVon: person } : t)) };
      if (herkunft === 'review') { neu = altesFeldImCrm(neu); hinweis = 'Nächstes Review in 90 Tagen eingetragen.'; }
      return neu;
    });
    if (!erledigt) return NextResponse.json({ ok: false, fehler: 'Follow-up nicht gefunden.' }, { status: 404 });
    const e = erledigt as FollowUp;
    let lead: LeadMeldung | null = null;
    if (e.kontaktId) {
      await aktivitaet(e.kontaktId, AKT_ART[e.art], `${e.text}${notiz ? ` — ${notiz}` : ''}`, person, ergebnis, e.bezug.art === 'chance' || e.bezug.art === 'event' || e.bezug.art === 'mandat' ? e.bezug.id : undefined, herkunft);
      if (e.bezug.art === 'event' && (ergebnis === 'gespraech' || ergebnis === 'termin')) lead = await leadHebenNachGespraech(e.kontaktId, jetzt, person, heute);
    }
    const f2 = folge as FollowUp | null;
    return NextResponse.json({ ok: true, followup: e, ...(f2 ? { naechstes: f2 } : {}), ...(lead ? { lead } : {}), text: [f2 ? `Erledigt — nächstes Follow-up am ${f2.faellig}.` : 'Erledigt.', lead?.geaendert ? `Lead „${lead.ziel.name}“ jetzt „${lead.nach}“.` : '', hinweis].filter(Boolean).join(' ') });
  }

  if (b.aktion === 'verschieben') {
    const zielTag = tagOk(b.faellig) ?? (Number.isFinite(Number(b.tage)) ? tagPlus(heute, Math.max(1, Math.min(90, Math.round(Number(b.tage))))) : undefined);
    if (!zielTag) return NextResponse.json({ ok: false, fehler: 'tage oder faellig nötig.' }, { status: 400 });
    if (zielTag < heute) return NextResponse.json({ ok: false, fehler: 'Nicht in die Vergangenheit verschieben.' }, { status: 400 });
    let neu: FollowUp | null = null;
    await aendereCrm(c => {
      const echt = (c.followups ?? []).find(f => f.id === id);
      if (echt) { neu = { ...echt, faellig: zielTag, verschoben: (echt.verschoben ?? 0) + 1, geaendert: jetzt, geaendertVon: person }; return { ...c, followups: (c.followups ?? []).map(x => (x.id === echt.id ? neu! : x)) }; }
      if (v?.quelle === 'kadenz') {
        // Kadenz: aus der Erinnerung wird ein echtes Follow-up mit neuem Datum — der virtuelle Eintrag tritt zurück.
        const vorlage = virtuellerEintrag(c);
        if (!vorlage) return c;
        neu = { ...echtAus({ ...vorlage, faellig: zielTag }, 'kadenz'), verschoben: 1, geaendertVon: person };
        return { ...c, followups: [...(c.followups ?? []), neu] };
      }
      return altesFeldImCrm(c, zielTag);
    });
    await kontaktFeldVerschieben(zielTag);
    const n = neu as FollowUp | null;
    return NextResponse.json({ ok: true, ...(n ? { followup: n } : {}), text: `Verschoben auf ${zielTag}.`, hinweis: n && (n.verschoben ?? 0) >= 3 ? 'Zum dritten Mal verschoben — ehrlicherweise ist das keine Zusage mehr. Absagen oder ansprechen.' : undefined });
  }

  if (b.aktion === 'absagen') {
    let neu: FollowUp | null = null;
    await aendereCrm(c => {
      const echt = (c.followups ?? []).find(f => f.id === id);
      // Überfällig abgesagt = verpasst (zählt in der Pünktlichkeit); vor dem Termin abgesagt = abgesagt.
      if (echt) { neu = { ...echt, status: echt.faellig < heute ? 'verpasst' : 'abgesagt', geaendert: jetzt, geaendertVon: person }; return { ...c, followups: (c.followups ?? []).map(x => (x.id === echt.id ? neu! : x)) }; }
      if (v?.quelle === 'kadenz') {
        // Kadenz lässt sich nicht absagen, nur einen Takt weiterschieben: nächster Anlauf nach dem Takt der Person.
        const vorlage = virtuellerEintrag(c);
        const k = kontakt(v.ziel);
        if (!vorlage || !k) return c;
        neu = { ...echtAus({ ...vorlage, faellig: tagPlus(heute, taktVon(k, c.wertelisten) ?? 30), text: `Kadenz: nächster Anlauf` }, 'kadenz'), geaendertVon: person };
        return { ...c, followups: [...(c.followups ?? []), neu] };
      }
      return altesFeldImCrm(c);
    });
    if (v && (v.quelle === 'schritt' || v.quelle === 'wiedervorlage')) {
      await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id !== v.ziel ? k : v.quelle === 'schritt' ? { ...k, naechsterSchritt: undefined, geaendertAm: jetzt } : { ...k, wiedervorlage: undefined, geaendertAm: jetzt })) }));
    }
    const n = neu as FollowUp | null;
    return NextResponse.json({ ok: true, ...(n ? { followup: n } : {}), text: v?.quelle === 'kadenz' && n ? `Kadenz: nächster Anlauf am ${n.faellig}.` : n?.status === 'verpasst' ? 'Als verpasst gezählt.' : 'Abgesagt.' });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: anlegen, erledigen, verschieben oder absagen.' }, { status: 400 });
}
