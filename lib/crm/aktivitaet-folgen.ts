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
//  0. Follow-up der Karte (08.10., Sofort-Paket 4.1): kommt die Aktivität aus einer Power-Hour-Karte mit echtem Follow-up
//     (`followupId`), wird es mitgeführt — vorher blieb es offen, kam täglich wieder, und das Ergebnis setzte daneben eine
//     zweite Wiedervorlage. Nicht erreicht / Mailbox / Rückruf → das Follow-up wandert auf den Tag der Regel (es bleibt die
//     EINE Erinnerung, mit seinem Text; die Route setzt dann keine Wiedervorlage am Kontakt). Jedes andere Ergebnis → erledigt
//     (mit Ergebnis; Event-Follow-up: der Gast gilt als nachgefasst — wie beim Erledigen in der Follow-up-Liste).
//     Deal-Follow-up erledigt (08.10., Woche 1 · 4.4): ein „nächster Schritt“ aus der Karte wird der Schritt am Deal; sonst wird der
//     Schritt am Deal geleert, wenn er genau dieser war (`dealSchrittErledigt`) — er stünde sonst sofort wieder als überfällig da. Die
//     Deal-Ampel zeigt dann „ohne nächsten Schritt“, bis jemand einen setzt.

import type { Kontakt, Ergebnis } from '@/lib/make-one/crm';
import type { CrmBestand, FollowUp, KampagnenErgebnis } from './typen';
import { OFFENE_STUFEN } from './pipeline';
import { verbindungenReparieren } from './verbindungen';
import { dealSchrittErledigt } from './followup';

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
  /** Das echte Follow-up hinter der Power-Hour-Karte (`fu-…`), siehe Schritt 0. */
  followupId?: string;
  /** Neuer Tag für das Follow-up, wenn das Ergebnis „noch einmal“ heißt (`FOLLOWUP_NOCHMAL`) — der Tag aus `folgeAus`. */
  followupNochmalAm?: string;
  /** Der nächste Schritt aus der Karte (4.4) — bei einem erledigten Deal-Follow-up wird er der Schritt am Deal. */
  naechster?: { text: string; datum: string };
}

/** Ergebnisse, nach denen ein Follow-up nicht erledigt ist, sondern wiederkommt (Anlauf ohne Gespräch). */
export const FOLLOWUP_NOCHMAL: readonly Ergebnis[] = ['nicht_erreicht', 'mailbox', 'rueckruf'];

/** Gehört dieses offene Follow-up zu der Person der Aktivität? Nur dann wird es mitgeführt. */
export const followupDerPerson = (f: Pick<FollowUp, 'status' | 'kontaktId' | 'bezug'>, kontaktId: string): boolean =>
  f.status === 'offen' && (f.kontaktId === kontaktId || (!f.kontaktId && f.bezug.art === 'kontakt' && f.bezug.id === kontaktId));

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

export function aktivitaetImCrm(crm: CrmBestand, e: AktivitaetFolgenEingabe): { crm: CrmBestand; geaendert: boolean; dealId: string | null; abgesagt: number; kampagnen: number; followup: { id: string; wie: 'erledigt' | 'verschoben'; faellig?: string; aufgabeId?: string } | null } {
  const id = e.kontakt.id;
  let neu = crm;
  let geaendert = false;

  // 0. Follow-up der Power-Hour-Karte mitführen (vor der Werbesperre: ein „Sperre“-Ergebnis erledigt es mit diesem Ergebnis).
  let followup: { id: string; wie: 'erledigt' | 'verschoben'; faellig?: string; aufgabeId?: string } | null = null;
  const fu = e.followupId && !e.geplant ? (neu.followups ?? []).find(f => f.id === e.followupId) : undefined;
  if (fu && followupDerPerson(fu, id)) {
    const nochmal = e.ergebnis && FOLLOWUP_NOCHMAL.includes(e.ergebnis) && e.followupNochmalAm ? e.followupNochmalAm : undefined;
    const fNeu: FollowUp = nochmal
      ? { ...fu, faellig: nochmal > fu.faellig ? nochmal : fu.faellig, geaendert: e.jetzt, geaendertVon: e.von }
      : { ...fu, status: 'erledigt', erledigtAm: e.jetzt, ...(e.ergebnis ? { ergebnis: e.ergebnis } : {}), geaendert: e.jetzt, geaendertVon: e.von };
    neu = { ...neu, followups: (neu.followups ?? []).map(f => (f.id === fu.id ? fNeu : f)) };
    // Deal-Follow-up erledigt (4.4): „nächster Schritt“ aus der Karte → Schritt am Deal; sonst denselben Schritt leeren (nie einen späteren, anderen).
    if (!nochmal && fu.bezug.art === 'chance') {
      const deal = neu.chancen.find(c => c.id === fu.bezug.id && OFFENE_STUFEN.includes(c.stufe));
      if (deal && (e.naechster || dealSchrittErledigt(deal.naechsterSchritt, fu, e.heute))) {
        neu = { ...neu, chancen: neu.chancen.map(c => (c.id === deal.id ? (({ naechsterSchritt: _alt, ...rest }) => ({ ...rest, ...(e.naechster ? { naechsterSchritt: e.naechster } : {}), geaendert: e.jetzt, geaendertVon: e.von }))(c) : c)) };
      }
    }
    // Event-Follow-up erledigt: der Gast gilt als nachgefasst (wie „Erledigen“ in der Follow-up-Liste) — nur, wenn es noch fehlt.
    if (!nochmal && fu.bezug.art === 'event') neu = { ...neu, teilnahmen: neu.teilnahmen.map(t => (t.eventId === fu.bezug.id && t.kontaktId === id && !t.followUpAm ? { ...t, followUpAm: e.heute, geaendert: e.jetzt, geaendertVon: e.von } : t)) };
    followup = { id: fu.id, wie: nochmal ? 'verschoben' : 'erledigt', ...(nochmal ? { faellig: fNeu.faellig } : {}), ...(fu.aufgabeId ? { aufgabeId: fu.aufgabeId } : {}) };
    geaendert = true;
  }

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
  return { crm: neu, geaendert, dealId, abgesagt, kampagnen, followup };
}
