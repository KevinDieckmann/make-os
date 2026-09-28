// ─── Folgen einer Aktivität im CRM-Bestand (28.09., Ablaufprüfung W1/f) — rein, getestet ─
// POST /api/crm/aktivitaet schreibt die Aktivität an den Kontakt (Kartei). Was sie im CRM-Bestand bewirkt,
// rechnet diese Datei — die Route wendet es in EINER Sperre an (`aendereCrm`):
//
//  1. Kampagne: Karte aus einer Kampagne (`bezug` = kp-…) mit Ergebnis → Ergebnis in der Kampagne.
//  2. Deal-Ampel: Bezug auf einen offenen Deal (ch-…) — sonst genau EIN offener Deal der Person —
//     bekommt `letzteAktivitaet` = heute (Berlin). Vorher blieb der Deal „hängt“, obwohl gerade
//     telefoniert wurde. Ein erst geplantes Meeting zählt nicht; nie rückwärts.
//  3. Werbesperre (Ergebnis „Sperre“, Art. 21): offene werbliche Follow-ups der Person (Mail, LinkedIn,
//     Anruf) werden mit Grund abgesagt (nie gelöscht), und die Person verlässt aktive und Entwurfs-
//     Kampagnen — über die Reparatur `werbesperre-kampagne` der Verbindungsprüfung (EINE Regel).

import type { Kontakt, Ergebnis } from '@/lib/make-one/crm';
import type { CrmBestand, FollowUp, KampagnenErgebnis } from './typen';
import { OFFENE_STUFEN } from './pipeline';
import { verbindungenReparieren } from './verbindungen';

export interface AktivitaetFolgenEingabe {
  kontakt: Kontakt;
  bezug?: string;
  ergebnis?: Ergebnis;
  /** Wer (kevin/malin/zoe). */
  von: string;
  /** Berliner Tag YYYY-MM-DD. */
  heute: string;
  jetzt: string;
  /** Meeting in der Zukunft — noch keine Aktivität am Deal. */
  geplant?: boolean;
}

/** Werbliche Follow-up-Arten — bei Werbewiderspruch abgesagt. Termine/Nachrichten bleiben (Vertrag, eigene Anfrage). */
export const WERBLICHE_FOLLOWUPS: readonly FollowUp['art'][] = ['mail', 'linkedin', 'anruf'];
const OFFEN: readonly FollowUp['status'][] = ['offen', 'verpasst'];

/** Welcher offene Deal bekommt die Aktivität? Bezug auf einen offenen Deal, sonst der einzige offene Deal der Person. */
export function dealZurAktivitaet(crm: Pick<CrmBestand, 'chancen'>, kontaktId: string, bezug?: string): string | null {
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  if (bezug?.startsWith('ch-')) return offen.some(c => c.id === bezug) ? bezug : null;
  const eigene = offen.filter(c => c.kontaktIds.includes(kontaktId));
  return eigene.length === 1 ? eigene[0].id : null;
}

/** Ergebnis in die Kampagnen-Sprache (angesprochen · gespraech · kein_interesse). */
const kampagnenErgebnis = (erg: Ergebnis): KampagnenErgebnis => (erg === 'gespraech' || erg === 'termin' ? 'gespraech' : erg === 'kein_bedarf' || erg === 'sperre' ? 'kein_interesse' : 'angesprochen');

export function aktivitaetImCrm(crm: CrmBestand, e: AktivitaetFolgenEingabe): { crm: CrmBestand; geaendert: boolean; dealId: string | null; abgesagt: number; kampagnen: number } {
  const id = e.kontakt.id;
  let neu = crm;
  let geaendert = false;

  // 1. Kampagnen-Ergebnis (vor dem Herausnehmen bei Sperre — das Nein zählt noch in der Kampagne).
  if (e.bezug?.startsWith('kp-') && e.ergebnis) {
    const erg = kampagnenErgebnis(e.ergebnis);
    const kampagnen = neu.kampagnen.map(k => (k.id === e.bezug && k.kontaktIds.includes(id) ? { ...k, ergebnisse: [...k.ergebnisse, { kontaktId: id, ergebnis: erg, am: e.heute, ...(e.von !== 'zoe' ? { von: e.von } : {}) }], geaendert: e.jetzt, geaendertVon: e.von } : k));
    if (kampagnen.some((k, i) => k !== neu.kampagnen[i])) { neu = { ...neu, kampagnen }; geaendert = true; }
  }

  // 2. Letzte Aktivität am Deal.
  const dealId = e.geplant ? null : dealZurAktivitaet(neu, id, e.bezug);
  if (dealId) {
    const c = neu.chancen.find(x => x.id === dealId);
    if (c && (c.letzteAktivitaet ?? '') < e.heute) { neu = { ...neu, chancen: neu.chancen.map(x => (x.id === dealId ? { ...x, letzteAktivitaet: e.heute } : x)) }; geaendert = true; }
  }

  // 3. Werbesperre: werbliche Follow-ups absagen, raus aus laufenden/geplanten Kampagnen.
  let abgesagt = 0, kampagnen = 0;
  if (e.kontakt.werbesperre) {
    const vermerk = `Abgesagt am ${e.heute}: Werbewiderspruch (Art. 21 DSGVO).`;
    const followups = (neu.followups ?? []).map(f => {
      if (!OFFEN.includes(f.status) || !WERBLICHE_FOLLOWUPS.includes(f.art)) return f;
      if (f.kontaktId !== id && !(f.bezug.art === 'kontakt' && f.bezug.id === id)) return f;
      abgesagt++;
      return { ...f, status: 'abgesagt' as const, notiz: [f.notiz, vermerk].filter(Boolean).join(' · ').slice(0, 1000), geaendert: e.jetzt, geaendertVon: e.von };
    });
    if (abgesagt) { neu = { ...neu, followups }; geaendert = true; }
    const rep = verbindungenReparieren({ heute: e.heute, kontakte: [e.kontakt], crm: neu }, ['werbesperre-kampagne'], e.jetzt, e.von);
    const a = rep.aenderungen.find(x => x.befundId === 'werbesperre-kampagne');
    if (a) { neu = rep.bestaende.crm; kampagnen = a.anzahl; geaendert = true; }
  }
  return { crm: neu, geaendert, dealId, abgesagt, kampagnen };
}
