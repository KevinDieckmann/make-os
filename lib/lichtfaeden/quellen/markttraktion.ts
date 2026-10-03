// ─── Lichtfäden-Quelle: Markttraktion (Follow-ups, Deals, Events/Besuche, Make.One-Abende) — rein ─
// Alles hier ist Business › Markttraktion — außer ein Ziel trägt dieselbe Firma bzw. dasselbe Mandat (`ZielBezuege` aus
// der Planung): dann läuft der Strang in DIESES Ziel („alles läuft auf das größte Ziel zusammen“).
// Eingang: Follow-ups aus `faellige` (lib/crm/followup.ts — echte und abgeleitete, EINE Rechnung), Deals (`chancen`,
// offen, mit „Entscheidung bis“ `erwartetAm`), Events (geplant/Einladung/durchgeführt; Spanne bis `bisDatum`).
// Die Schnittstelle ist bewusst schmal (Plattform-Regel: Markttraktion einzeln verkaufbar) — nur Felder, keine Importe aus lib/crm.

import { WEG } from '@/lib/wege';
import { BEIDE, gewichtVon, statusVon, tagAus, themaPfad, type Strang } from '../modell';
import { KEINE_BEZUEGE, type ZielBezuege } from './planung';

export interface MtFollowup { id: string; text: string; name?: string; faellig: string; zustaendig?: string; kontaktId?: string; bezug?: { art: string; id: string } }
export interface MtDeal { id: string; titel: string; erwartetAm?: string; offen: boolean; besitzer?: string; firmaId?: string }
export interface MtEvent { id: string; titel: string; datum: string; bisDatum?: string; status: string; zustaendig?: string; link: string; firmaId?: string }
export interface MarkttraktionDaten { followups: MtFollowup[]; deals: MtDeal[]; events: MtEvent[]; heute: string; bezuege?: ZielBezuege }

const person = (v: string | undefined) => (!v || v === BEIDE ? BEIDE : v);

export function markttraktionStraenge(d: MarkttraktionDaten): Strang[] {
  const bez = d.bezuege ?? KEINE_BEZUEGE;
  const basis = themaPfad('business', 'markttraktion');
  const pfadFuer = (firmaId?: string, mandatId?: string) => (mandatId && bez.mandat.get(mandatId)) || (firmaId && bez.firma.get(firmaId)) || basis;
  const aus: Strang[] = [];
  for (const f of d.followups) {
    const tag = tagAus(f.faellig);
    if (!tag) continue;
    const firma = f.bezug?.art === 'firma' ? f.bezug.id : undefined, mandat = f.bezug?.art === 'mandat' ? f.bezug.id : undefined;
    aus.push({
      id: `followup:${f.id}`, quelle: 'followup', titel: f.name ? `${f.text} · ${f.name}` : f.text, pfad: pfadFuer(firma, mandat), person: person(f.zustaendig),
      zeit: { tag }, gewicht: gewichtVon('followup'), status: statusVon(false, tag, d.heute),
      link: f.kontaktId ? WEG.akte(f.kontaktId) : f.bezug?.art === 'chance' ? WEG.deal(f.bezug.id) : f.bezug?.art === 'mandat' ? WEG.mandat(f.bezug.id) : WEG.followup(),
    });
  }
  for (const c of d.deals) {
    const tag = tagAus(c.erwartetAm);
    if (!tag || !c.offen) continue;
    aus.push({ id: `deal:${c.id}`, quelle: 'deal', titel: c.titel, pfad: pfadFuer(c.firmaId), person: person(c.besitzer), zeit: { tag }, gewicht: gewichtVon('deal'), status: statusVon(false, tag, d.heute), link: WEG.deal(c.id) });
  }
  for (const e of d.events) {
    const tag = tagAus(e.datum);
    if (!tag || e.status === 'abgesagt' || e.status === 'idee') continue;
    const bis = tagAus(e.bisDatum);
    const vorbei = (bis ?? tag) < d.heute || e.status === 'durchgefuehrt';
    aus.push({
      id: `event:${e.id}`, quelle: 'event', titel: e.titel, pfad: pfadFuer(e.firmaId), person: person(e.zustaendig),
      zeit: { tag, ...(bis && bis > tag ? { bis } : {}) }, gewicht: gewichtVon('event', { erledigt: vorbei }), status: vorbei ? 'erledigt' : 'offen', link: e.link,
    });
  }
  return aus;
}
