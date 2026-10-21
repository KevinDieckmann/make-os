// ─── Sales · Lead parken bzw. ausscheiden — EINE Stelle (Server; 03.10., herausgelöst am 22.10. für die Vorlagen der Kundengewinnung, N5) ─────────────
// Parken: Status „ruht“ mit Wiedervorlage (am Tag kommt der Lead in die Runde zurück) + Follow-up „Wiedervorlage Qualifizierung“. Raus: „Kein Fit“ mit fester
// Grund-Art (Auswertung, lib/crm/lead-grund.ts). Beides nie bei einem Lead mit offenem Deal (`ausscheidenGesperrt`), nie bei einer eingeschränkten Person.
// Bis 22.10. stand die Regel nur in der Route (app/api/crm/lead/route.ts, nur von Hand). Jetzt rufen sie zwei Wege — mit DERSELBEN Regel:
//   · die Route (`parken`/`raus` von Hand; der Dienstweg bleibt dort gesperrt — ZOE, Takt und Skripte parken nie selbst)
//   · die Freigabe eines Vorschlags „Lead parken“ im Stapel (lib/zoe/crm-vorschlag.ts Art `lead_parken`) — der Klick der Person IST die Hand.
// Nur Server.

import { loadJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { leads, ausscheidenGesperrt } from '@/lib/crm/leads';
import { leadSaeubern } from '@/lib/crm/lead-form';
import { istGrundParken, istGrundRaus } from '@/lib/crm/lead-grund';
import { neuesFollowUp } from '@/lib/crm/followup';
import { wer as werTeam, BEIDE } from '@/lib/crm/team';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import { localDay, tagVon } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Lead } from '@/lib/crm/typen';

const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Lead an Firma oder Person schreiben — der Rest des Eintrags bleibt, wie er ist. */
export async function leadSchreiben(id: string, mut: (alt: Lead | undefined) => Lead | undefined, wer?: Wer): Promise<Lead | undefined> {
  let neu: Lead | undefined;
  if (id.startsWith('f-')) {
    await aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === id ? (() => { neu = leadSaeubern(mut(f.lead)); return { ...f, ...(neu ? { lead: neu } : {}) }; })() : f)) }), wer);
  } else {
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === id ? (() => { neu = leadSaeubern(mut(k.lead)); return { ...k, ...(neu ? { lead: neu } : {}), geaendertAm: localDay() }; })() : k)) }), wer);
  }
  return neu;
}

export interface ParkenEingabe { aktion: 'parken' | 'raus'; id: string; bis?: unknown; grundArt?: unknown; grund?: unknown }
export type ParkenErgebnis =
  | { ok: true; lead: Lead | undefined; followup: boolean; text: string }
  | { ok: false; status: 400 | 404 | 409 | 413; fehler: string; eingeschraenkt?: true };

/** Parken bzw. ausscheiden (Server) — prüft alles vor dem ersten Schreiben. `person` = wer handelt (Sitzung bzw. die freigebende Person). */
export async function leadParkenOderRaus(e: ParkenEingabe, person: string, wer?: Wer, jetzt = new Date().toISOString()): Promise<ParkenErgebnis> {
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const id = String(e.id ?? '');
  if (!id.startsWith('f-') && kontakte.find(k => k.id === id)?.eingeschraenkt) return { ok: false, status: 409, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true };
  const zeile = leads(kontakte, crm, localDay()).find(z => z.id === id);
  if (!zeile) return { ok: false, status: 404, fehler: 'Lead nicht gefunden.' };
  const gesperrt = ausscheidenGesperrt(zeile);
  if (gesperrt) return { ok: false, status: 409, fehler: gesperrt };
  const grund = String(e.grund ?? '').trim();
  if (grund.length > 300) return { ok: false, status: 413, fehler: 'Der Grund ist länger als 300 Zeichen.' };
  const parken = e.aktion === 'parken';
  if (parken ? e.grundArt !== undefined && !istGrundParken(e.grundArt) : !istGrundRaus(e.grundArt)) return { ok: false, status: 400, fehler: parken ? 'grundArt passt nicht zu „Parken“.' : 'Für „Kein Fit“ braucht es einen Grund aus der Liste.' };
  const heute = localDay();
  const bis = tagOk(e.bis);
  if (parken && (!bis || bis < heute)) return { ok: false, status: 400, fehler: 'Wiedervorlage: ein Datum ab heute.' };
  const basis = (alt: Lead | undefined): Lead => alt ?? { status: zeile.status, kriterien: zeile.kriterien };
  const lead = await leadSchreiben(id, alt => {
    const { wiedervorlage: _w, grundArt: _g, ...l } = basis(alt);
    return { ...l, status: parken ? 'ruht' : 'kein_fit', ...(parken ? { wiedervorlage: bis! } : {}), grundArt: String(e.grundArt ?? 'spaeter'), ...(grund ? { grund } : { grund: undefined }), qualifiziertAm: tagVon(jetzt), geaendert: jetzt, geaendertVon: person };
  }, wer);
  let followup = false;
  if (parken) {
    try {
      const haupt = zeile.personen[0] ? kontakte.find(k => k.id === zeile.personen[0].id) : undefined;
      const f = neuesFollowUp({ id: neueKennung('fu'), bezug: zeile.art === 'firma' ? { art: 'firma', id: zeile.id } : { art: 'kontakt', id: zeile.id }, ...(haupt ? { kontaktId: haupt.id } : {}), art: 'sonstig', text: `Wiedervorlage Qualifizierung: ${zeile.name}`.slice(0, 300), faellig: bis!, ...(werTeam(zeile.besitzer) && zeile.besitzer !== BEIDE ? { zustaendig: zeile.besitzer } : {}) }, haupt, person, jetzt);
      await aendereCrm(c => ({ ...c, followups: [...(c.followups ?? []), { ...f, geaendertVon: person }] }), wer);
      followup = true;
    } catch { /* die Wiedervorlage am Lead trägt allein — die Runde holt ihn zurück */ }
  }
  return { ok: true, lead, followup, text: parken ? `Geparkt bis ${bis} — dann kommt „${zeile.name}“ in die Runde zurück.` : `„${zeile.name}“ ist raus (Kein Fit) — der Grund steht in der Auswertung.` };
}
