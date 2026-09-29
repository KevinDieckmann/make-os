// ─── Markttraktion — Follow-up-Ebene (27.09.) ───────────────────────────────
// GET  → alle fälligen und bald fälligen Follow-ups (echte + virtuelle aus den alten
//        Feldern), Zahlen je Gruppe, Pünktlichkeit
// POST { aktion: 'anlegen', bezug, kontaktId?, art?, text, faellig, uhrzeit?, zustaendig?, notiz?, id? (nur `fu-v-…` aus einem ZOE-Vorschlag, idempotent) }
//      (+ terminUid? — Termin-Schlüssel `kalender|uid(::RID)`, z. B. „Nachbereiten“ aus der Akte, F2 M4: kein Titel im Text)
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
// S1 (29.09.): nie still gekürzt — Text über 300, Notiz über 1000 Zeichen (auch zusammen mit der bisherigen Notiz bzw.
// „Als Nächstes“) → 413; POST prüft die Bau-Kennung (`bauPruefen`, Dienstweg ausgenommen).

import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus, type Wer } from '@/lib/store/aenderungsprotokoll';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { localDay, tagePlus } from '@/lib/zeit';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';

/** Grenzen des Follow-ups (wie `neuesFollowUp`) — darüber 413, nie gekürzt. */
const TEXT_MAX = 300, NOTIZ_MAX = 1000;
const ZU_LANG = (was: string, max: number) => NextResponse.json({ ok: false, fehler: `${was} höchstens ${max} Zeichen.` }, { status: 413 });
import { wendeAktivitaetAn, ERGEBNISSE, type Kontakt, type Ergebnis, type AktivitaetArt } from '@/lib/make-one/crm';
import { folgeAus } from '@/lib/crm/heute';
import { sperren } from '@/lib/crm/sperrliste';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { faellige, zaehlen, puenktlichkeit, neuesFollowUp, virtuell, tagPlus, taktVon, werbesperreHinweis, type Faellig } from '@/lib/crm/followup';
import { leadHebenNachGespraech, type LeadMeldung } from '@/lib/crm/lead-heben';
import { wer } from '@/lib/crm/team';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import type { CrmBestand, FollowUp, FollowUpArt, FollowUpBezugArt } from '@/lib/crm/typen';
import { neueKennung } from '@/lib/kennung';
import { aufgabeErledigenNachFollowUp } from '@/lib/crm/followup-aufgabe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const neueId = (p: string) => neueKennung(p);
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
const ARTEN: FollowUpArt[] = ['anruf', 'mail', 'linkedin', 'termin', 'nachricht', 'sonstig'];
const BEZUEGE: FollowUpBezugArt[] = ['kontakt', 'firma', 'chance', 'mandat', 'event'];
const AKT_ART: Record<FollowUpArt, AktivitaetArt> = { anruf: 'anruf', mail: 'mail', linkedin: 'linkedin', termin: 'termin', nachricht: 'mail', sonstig: 'notiz' };
// Je Anfrage eine neue Antwort (28.09.): eine geteilte Response ließe sich nur einmal lesen.
const KEIN_ZUGANG = () => NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
const EINGESCHRAENKT = () => NextResponse.json({ ok: false, fehler: EINGESCHRAENKT_FEHLER }, { status: 409 });

async function kontakteLaden(): Promise<Kontakt[]> { return (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? []; }

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const etag = etagAus('fu', await speicherStand(['crm', 'kontakte']), localDay());
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const [kontakte, crm] = await Promise.all([kontakteLaden(), ladeCrm()]);
  const heute = localDay();
  let gesperrt = 0;
  const liste = faellige(kontakte, crm, heute, { wertelisten: crm.wertelisten, beiSperre: () => { gesperrt++; } });
  return jsonAntwort(req, { ok: true, heute, liste, zahlen: zaehlen(liste), puenktlich: puenktlichkeit(crm.followups ?? [], heute), ...(gesperrt ? { hinweis: werbesperreHinweis(gesperrt) } : {}) }, etag);
}

type Herkunft = 'schritt' | 'wiedervorlage' | 'dealschritt' | 'dealwiedervorlage' | 'nachfassen' | 'review' | 'kadenz' | 'echt';

/**
 * Aktivität an die Person — dieselben Regeln wie /api/crm/aktivitaet (letzter Kontakt, Stufe,
 * Werbesperre bei „Sperre“). Nächster Schritt und Wiedervorlage der Person bleiben, wie sie
 * sind; nur das Feld, aus dem das Follow-up stammt, wird geleert.
 */
async function aktivitaet(kontaktId: string, art: AktivitaetArt, text: string, von: string, ergebnis: Ergebnis | undefined, bezug: string | undefined, herkunft: Herkunft, wer?: Wer): Promise<void> {
  const heute = localDay();
  let gesperrt: Kontakt | null = null;
  await aendereKontakte<{ kontakte: Kontakt[] }>(current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === kontaktId);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    // Art. 18 (U2): an einer eingeschränkten Person wird nichts festgehalten (das Follow-up selbst wird trotzdem erledigt).
    if (alt.eingeschraenkt) return f;
    const folge = ergebnis ? folgeAus(ergebnis, heute, alt.stufe) : null;
    // Anlass (U2 #58): ein vereinbartes Follow-up IST der konkrete Anlass eines Anrufs aus der Beziehung.
    const anlass = art === 'anruf' ? `Vereinbartes Follow-up${text ? `: ${text.slice(0, 200)}` : ''}` : undefined;
    let neu = wendeAktivitaetAn(alt, { art, text: text || undefined, von, ergebnis, bezug, stufe: folge?.stufe, ...(anlass ? { anlass } : {}) }, heute, new Date().toISOString(), tagePlus);
    // Die Follow-up-Ebene führt: keine zweite Wiedervorlage aus der Regel, keine fremde Zusage löschen.
    neu = { ...neu, wiedervorlage: herkunft === 'wiedervorlage' ? undefined : alt.wiedervorlage, naechsterSchritt: herkunft === 'schritt' ? undefined : alt.naechsterSchritt };
    if (folge?.werbesperre) { neu = { ...neu, werbesperre: { seit: heute, grund: text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined }; gesperrt = neu; }
    f.kontakte[i] = neu;
    return f;
  }, wer);
  // Werbesperre: auch auf die gehashte Sperrliste (K2 #60).
  const g = gesperrt as Kontakt | null;
  if (g) await sperren([g], 'werbesperre', heute);
}

export async function POST(req: Request) {
  // Person aus dem Zugang (28.09., Regel 5): Sitzung oder Dienstweg MIT Person im Haushalt — kein Rückfall auf „kevin“.
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return KEIN_ZUGANG();
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = zugang.person;
  if (typeof b.text === 'string' && b.text.trim().length > TEXT_MAX) return ZU_LANG('Text', TEXT_MAX);
  if (typeof b.notiz === 'string' && b.notiz.trim().length > NOTIZ_MAX) return ZU_LANG('Notiz', NOTIZ_MAX);
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
    // Art. 18 (28.09., W8): an einer eingeschränkten Person wird nichts Neues festgehalten.
    if (kontakt(kontaktId ?? (bezug.art === 'kontakt' ? bezug.id : undefined))?.eingeschraenkt) return EINGESCHRAENKT();
    // Aus einem ZOE-Vorschlag (29.09.): feste Kennung `fu-<vorschlag>` — eine zweite Freigabe legt nichts doppelt an.
    const wunschId = typeof b.id === 'string' && /^fu-v-[a-z0-9-]{4,40}$/.test(b.id) ? b.id : undefined;
    const f = neuesFollowUp({
      id: wunschId ?? neueId('fu'), bezug, kontaktId: kontaktId ?? (bezug.art === 'kontakt' ? bezug.id : undefined), art: ARTEN.includes(b.art as FollowUpArt) ? (b.art as FollowUpArt) : undefined, text, faellig,
      uhrzeit: typeof b.uhrzeit === 'string' && /^\d{2}:\d{2}$/.test(b.uhrzeit) ? b.uhrzeit : undefined, zustaendig: wer(b.zustaendig), notiz: typeof b.notiz === 'string' ? b.notiz : undefined,
      quelle: ['hand', 'zoe', 'head', 'deal', 'event', 'kampagne', 'kadenz'].includes(String(b.quelle)) ? (b.quelle as FollowUp['quelle']) : 'hand',
      // Termin-Verweis (F2 M4): dieselbe Prüfung wie beim Säubern des Bestands (lib/crm/speicher.ts).
      terminUid: typeof b.terminUid === 'string' && /^[^\u0000-\u001f\u007f]{1,300}$/.test(b.terminUid) ? b.terminUid : undefined,
    }, kontakt(kontaktId ?? bezug.id), person, jetzt);
    let schonDa = false;
    await aendereCrm(c => {
      if (wunschId && (c.followups ?? []).some(x => x.id === wunschId)) { schonDa = true; return c; }
      return { ...c, followups: [...(c.followups ?? []), { ...f, geaendertVon: person }] };
    });
    if (schonDa) return NextResponse.json({ ok: true, schonDa: true, text: 'Dieses Follow-up steht schon — nicht doppelt angelegt.' });
    return NextResponse.json({ ok: true, followup: f, text: `Follow-up „${f.text}“ am ${f.faellig} steht.` });
  }

  const id = String(b.id ?? '');
  const v = virtuell(id);
  const crm = await ladeCrm();
  if (!v && !(crm.followups ?? []).some(f => f.id === id)) return NextResponse.json({ ok: false, fehler: 'Follow-up nicht gefunden.' }, { status: 404 });

  /** Der virtuelle Eintrag (aus dem aktuellen Stand) — als Vorlage für ein echtes Follow-up. Nur der Ausschnitt, der ihn trägt,
   *  wird gerechnet — nicht die ganze Kartei in der Schreibsperre (Prüfbericht 27.09., Punkt 19). */
  const virtuellerEintrag = (c: CrmBestand): Faellig | undefined => {
    if (!v) return undefined;
    const ziel = v.ziel;
    const teil: CrmBestand = v.quelle === 'dealschritt' || v.quelle === 'dealwiedervorlage' ? { ...c, chancen: c.chancen.filter(x => x.id === ziel), teilnahmen: [], mandate: [] }
      : v.quelle === 'nachfassen' ? { ...c, chancen: [], mandate: [], teilnahmen: c.teilnahmen.filter(t => t.id === ziel) }
      : v.quelle === 'review' ? { ...c, chancen: [], teilnahmen: [], mandate: c.mandate.filter(m => m.id === ziel) }
      : { ...c, chancen: [], teilnahmen: [], mandate: [] };
    const ids = new Set([ziel, ...teil.chancen.flatMap(x => x.kontaktIds), ...teil.teilnahmen.map(t => t.kontaktId), ...teil.mandate.flatMap(m => m.kontaktIds)]);
    return faellige(kontakte.filter(k => ids.has(k.id)), { ...teil, followups: [] }, heute, { horizont: 400, wertelisten: c.wertelisten }).find(x => x.id === id);
  };
  const echtAus = (f: Faellig, quelle: FollowUp['quelle']): FollowUp =>
    neuesFollowUp({ id: neueId('fu'), bezug: { art: f.bezug.art, id: f.bezug.id }, kontaktId: f.kontaktId, art: f.art, text: f.text, faellig: f.faellig, zustaendig: f.zustaendig, quelle }, kontakt(f.kontaktId), person, jetzt);
  const quelleVon = (h: Herkunft): FollowUp['quelle'] => (h === 'kadenz' ? 'kadenz' : h === 'nachfassen' ? 'event' : h === 'dealschritt' ? 'deal' : 'regel');
  /** Das alte Feld hinter einem virtuellen Eintrag (Deal-Schritt, Teilnahme, Review) im CRM-Bestand — die Kontaktfelder erledigt `aktivitaet()`. */
  const altesFeldImCrm = (c: CrmBestand, neuesDatum?: string): CrmBestand => {
    if (!v) return c;
    if (v.quelle === 'dealschritt') return { ...c, chancen: c.chancen.map(x => (x.id === v.ziel ? { ...x, naechsterSchritt: neuesDatum && x.naechsterSchritt ? { ...x.naechsterSchritt, datum: neuesDatum } : undefined, geaendert: jetzt, geaendertVon: person } : x)) };
    if (v.quelle === 'review') return { ...c, mandate: c.mandate.map(m => (m.id === v.ziel ? { ...m, naechstesReview: neuesDatum ?? tagPlus(heute, 90), geaendert: jetzt, geaendertVon: person } : m)) };
    // Geparkter Deal (K6a): die Wiedervorlage IST das Feld am Deal — verschieben/erledigen setzt die nächste (Pflicht beim Parken).
    if (v.quelle === 'dealwiedervorlage') return { ...c, chancen: c.chancen.map(x => (x.id === v.ziel && x.stufe === 'geparkt' ? { ...x, wiedervorlage: neuesDatum ?? tagPlus(heute, 90), geaendert: jetzt, geaendertVon: person } : x)) };
    return c;
  };
  // `geaendertAm` der Kartei ist ein Berliner TAG (28.09., W8) — vorher stand hier der ISO-Zeitstempel.
  // Art. 18: eine eingeschränkte Person bleibt unberührt (auch IN der Sperre geprüft).
  const kontaktFeldVerschieben = async (neuesDatum: string) => {
    if (!v || (v.quelle !== 'schritt' && v.quelle !== 'wiedervorlage')) return;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id !== v.ziel || k.eingeschraenkt ? k : v.quelle === 'schritt' ? { ...k, ...(k.naechsterSchritt ? { naechsterSchritt: { ...k.naechsterSchritt, datum: neuesDatum } } : {}), geaendertAm: heute } : { ...k, wiedervorlage: neuesDatum, geaendertAm: heute })) }), werAus(req));
  };
  // Art. 18 (28.09., W8): Schritt/Wiedervorlage einer eingeschränkten Person nicht verschieben oder absagen.
  if (v && (v.quelle === 'schritt' || v.quelle === 'wiedervorlage') && kontakt(v.ziel)?.eingeschraenkt && (b.aktion === 'verschieben' || b.aktion === 'absagen')) return EINGESCHRAENKT();

  if (b.aktion === 'erledigen') {
    const ergebnis = ERGEBNISSE.includes(b.ergebnis as Ergebnis) ? (b.ergebnis as Ergebnis) : undefined;
    const n = b.naechster as { text?: unknown; faellig?: unknown; art?: unknown } | undefined;
    if (n && String(n.text ?? '').trim().length > TEXT_MAX) return ZU_LANG('„Als Nächstes“', TEXT_MAX);
    const naechsterRoh = n && String(n.text ?? '').trim() && tagOk(n.faellig) ? { text: String(n.text).trim(), faellig: tagOk(n.faellig)!, art: ARTEN.includes(n.art as FollowUpArt) ? (n.art as FollowUpArt) : undefined } : undefined;
    if (naechsterRoh && naechsterRoh.faellig < heute) return NextResponse.json({ ok: false, fehler: 'Der nächste Schritt liegt in der Vergangenheit.' }, { status: 400 });
    const notiz = typeof b.notiz === 'string' ? b.notiz.trim() : '';
    let erledigt: FollowUp | null = null, folge: FollowUp | null = null, herkunft: Herkunft = 'echt', hinweis = '', regelFehler = '', zuLang = false;
    await aendereCrm(c => {
      const echt = (c.followups ?? []).find(f => f.id === id);
      const vorlage = echt ? null : virtuellerEintrag(c);
      if (!echt && !vorlage) return c;
      herkunft = echt ? 'echt' : (v!.quelle as Herkunft);
      const f: FollowUp = echt ?? echtAus(vorlage!, quelleVon(herkunft));
      // Deal-Regel (Prüfbericht 27.09., Punkt 6): ein offener Deal braucht einen nächsten Schritt — auch über die Follow-up-Ebene.
      const deal = f.bezug.art === 'chance' ? c.chancen.find(x => x.id === f.bezug.id) : undefined;
      if (deal && OFFENE_STUFEN.includes(deal.stufe) && !naechsterRoh && (herkunft === 'dealschritt' || !deal.naechsterSchritt)) { regelFehler = 'Am Deal muss ein nächster Schritt stehen — bitte „Als Nächstes“ ausfüllen (die Deal-Regel gilt auch hier).'; return c; }
      const notizNeu = notiz ? `${f.notiz ? `${f.notiz}\n` : ''}${notiz}` : '';
      if (notizNeu.length > NOTIZ_MAX) { zuLang = true; return c; }
      erledigt = { ...f, status: 'erledigt', erledigtAm: jetzt, ...(ergebnis ? { ergebnis } : {}), ...(notizNeu ? { notiz: notizNeu } : {}), geaendert: jetzt, geaendertVon: person };
      // Geparkter Deal (K6a): „Als Nächstes“ ist die nächste Wiedervorlage am Deal — kein zweites Follow-up daneben.
      if (herkunft === 'dealwiedervorlage') {
        // F2 N8: am geparkten Deal gibt es kein Feld für den Text aus „Als Nächstes“ — er geht nicht verloren, sondern steht
        // in der Notiz dieses erledigten Follow-ups (und damit in der Aktivität am Kontakt); das Datum wird die Wiedervorlage.
        const alsNaechstes = naechsterRoh?.text ? `Als Nächstes: ${naechsterRoh.text}` : '';
        const notizGesamt = [notiz, alsNaechstes].filter(Boolean).join('\n');
        if (notizGesamt.length > NOTIZ_MAX) { zuLang = true; erledigt = null; return c; }
        erledigt = { ...f, status: 'erledigt', erledigtAm: jetzt, ...(ergebnis ? { ergebnis } : {}), ...(notizGesamt ? { notiz: notizGesamt } : {}), geaendert: jetzt, geaendertVon: person };
        const naechste = naechsterRoh?.faellig ?? tagPlus(heute, 90);
        hinweis = `Deal bleibt geparkt — nächste Wiedervorlage am ${naechste} (oder in der Deal-Akte wieder aufnehmen).${alsNaechstes ? ' Der Text aus „Als Nächstes“ steht in der Notiz dieses Follow-ups.' : ''}`;
        return altesFeldImCrm({ ...c, followups: [...(c.followups ?? []), erledigt] }, naechste);
      }
      folge = naechsterRoh ? { ...neuesFollowUp({ id: neueId('fu'), bezug: f.bezug, kontaktId: f.kontaktId, art: naechsterRoh.art ?? f.art, text: naechsterRoh.text, faellig: naechsterRoh.faellig, zustaendig: f.zustaendig, quelle: 'hand' }, kontakt(f.kontaktId), person, jetzt), geaendertVon: person } : null;
      let neu: CrmBestand = { ...c, followups: [...(c.followups ?? []).filter(x => x.id !== f.id), erledigt, ...(folge ? [folge] : [])] };
      // Deal: das „Als Nächstes“ ist der nächste Schritt am Deal — so bleibt die Deal-Regel erfüllt.
      if (f.bezug.art === 'chance') neu = { ...neu, chancen: neu.chancen.map(x => (x.id === f.bezug.id ? { ...x, naechsterSchritt: naechsterRoh ? { text: naechsterRoh.text, datum: naechsterRoh.faellig } : (herkunft === 'dealschritt' ? undefined : x.naechsterSchritt), letzteAktivitaet: heute, geaendert: jetzt, geaendertVon: person } : x)) };
      // Event: nachgefasst am Gast (auch für echte Event-Follow-ups, nicht nur den virtuellen).
      if (f.bezug.art === 'event' && f.kontaktId) neu = { ...neu, teilnahmen: neu.teilnahmen.map(t => (t.eventId === f.bezug.id && t.kontaktId === f.kontaktId && !t.followUpAm ? { ...t, followUpAm: heute, geaendert: jetzt, geaendertVon: person } : t)) };
      if (herkunft === 'review') { neu = altesFeldImCrm(neu); hinweis = 'Nächstes Review in 90 Tagen eingetragen.'; }
      return neu;
    });
    if (zuLang) return ZU_LANG('Notiz (mit der bisherigen Notiz bzw. „Als Nächstes“)', NOTIZ_MAX);
    if (regelFehler) return NextResponse.json({ ok: false, fehler: regelFehler }, { status: 400 });
    if (!erledigt) return NextResponse.json({ ok: false, fehler: 'Follow-up nicht gefunden.' }, { status: 404 });
    const e = erledigt as FollowUp;
    // Follow-up = Aufgabe (29.09., #99): die verknüpfte Aufgabe wird mit erledigt (idempotent, über den Aufgaben-Schreibweg).
    if (e.aufgabeId) await aufgabeErledigenNachFollowUp(e, person);
    let lead: LeadMeldung | null = null;
    if (e.kontaktId) {
      const aktNotiz = (herkunft as Herkunft) === 'dealwiedervorlage' ? (e.notiz ?? '') : notiz; // N8: dort mit „Als Nächstes“
      await aktivitaet(e.kontaktId, AKT_ART[e.art], `${e.text}${aktNotiz ? ` — ${aktNotiz.replace(/\n/g, ' · ')}` : ''}`, person, ergebnis, e.bezug.art === 'chance' || e.bezug.art === 'event' || e.bezug.art === 'mandat' ? e.bezug.id : undefined, herkunft, werAus(req));
      if (e.bezug.art === 'event' && (ergebnis === 'gespraech' || ergebnis === 'termin')) lead = await leadHebenNachGespraech(e.kontaktId, jetzt, person, heute, werAus(req));
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
      if (v?.quelle === 'kadenz' || v?.quelle === 'nachfassen') {
        // Kadenz und Event-Nachfassen: aus der Erinnerung wird ein echtes Follow-up mit neuem Datum — der virtuelle Eintrag tritt zurück
        // (Nachfassen vorher: „+3 Tage“ meldete „verschoben“, änderte aber nichts — Prüfbericht 27.09., Punkt 4).
        const vorlage = virtuellerEintrag(c);
        if (!vorlage) return c;
        neu = { ...echtAus({ ...vorlage, faellig: zielTag }, v.quelle === 'kadenz' ? 'kadenz' : 'event'), verschoben: 1, geaendertVon: person };
        return { ...c, followups: [...(c.followups ?? []), neu] };
      }
      return altesFeldImCrm(c, zielTag);
    });
    await kontaktFeldVerschieben(zielTag);
    const n = neu as FollowUp | null;
    return NextResponse.json({ ok: true, ...(n ? { followup: n } : {}), text: `Verschoben auf ${zielTag}.`, hinweis: n && (n.verschoben ?? 0) >= 3 ? 'Zum dritten Mal verschoben — ehrlicherweise ist das keine Zusage mehr. Absagen oder ansprechen.' : undefined });
  }

  if (b.aktion === 'absagen') {
    // Der nächste Schritt am Deal ist keine Zusage, die man absagt — er ist die Deal-Regel (Punkt 6).
    if (v?.quelle === 'dealschritt') return NextResponse.json({ ok: false, fehler: 'Der nächste Schritt am Deal lässt sich nicht absagen — verschieben oder in der Deal-Akte einen neuen setzen.' }, { status: 400 });
    if (v?.quelle === 'dealwiedervorlage') return NextResponse.json({ ok: false, fehler: 'Die Wiedervorlage am geparkten Deal lässt sich nicht absagen — verschieben, in der Deal-Akte wieder aufnehmen oder auf „verloren“ setzen.' }, { status: 400 });
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
      // Event-Nachfassen bewusst auslassen (Punkt 5): verschwindet aus der Liste, zählt aber NICHT als nachgefasst.
      if (v?.quelle === 'nachfassen') return { ...c, teilnahmen: c.teilnahmen.map(t => (t.id === v.ziel ? { ...t, nachfassenVerzichtet: heute, geaendert: jetzt, geaendertVon: person } : t)) };
      return altesFeldImCrm(c);
    });
    if (v && (v.quelle === 'schritt' || v.quelle === 'wiedervorlage')) {
      await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id !== v.ziel || k.eingeschraenkt ? k : v.quelle === 'schritt' ? { ...k, naechsterSchritt: undefined, geaendertAm: heute } : { ...k, wiedervorlage: undefined, geaendertAm: heute })) }), werAus(req));
    }
    const n = neu as FollowUp | null;
    return NextResponse.json({ ok: true, ...(n ? { followup: n } : {}), text: v?.quelle === 'kadenz' && n ? `Kadenz: nächster Anlauf am ${n.faellig}.` : v?.quelle === 'nachfassen' ? 'Nachfassen ausgelassen — zählt nicht als nachgefasst.' : n?.status === 'verpasst' ? 'Als verpasst gezählt.' : 'Abgesagt.' });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: anlegen, erledigen, verschieben oder absagen.' }, { status: 400 });
}
