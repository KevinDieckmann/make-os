// ─── Markttraktion · Wann zählt eine Person als NEUER Lead? (rein, client-sicher — Prüf-Fund 11.10.) ─────────────────
// Vorher zählten „Neue Leads“ (Wochen-Scoreboard, Kreislauf der Planung, Kanal-Stand, Wochen-Ist der Challenges) jeden Kontakt mit
// irgendeiner Aktivität am Tag `importiertAm` — auch Kontakte aus der Masterliste, die Monate später zum ersten Mal angesprochen wurden
// (rückwirkend in der Import-Woche), und solche, an denen nur System-Einträge hängen. EINE Regel für alle Stellen:
//   · die Person wurde von Hand bzw. aus einem Kanal angelegt — erkennbar daran, dass die erste Aktivität eines MENSCHEN (`von` ≠ „system“;
//     der Anlege-Vermerk von lib/crm/person-anlegen.ts zählt, er trägt die anlegende Person) am Anlagetag oder kurz danach liegt
//     (`NEUER_LEAD_SPANNE_TAGE`);
//   · ein Import aus einer Liste (Weg „Import“, Quelle `Liste`) ist nie ein neuer Lead.
// Gezählt wird am Anlagetag (`importiertAm`). Nichts wird gespeichert.

import type { Kontakt } from '@/lib/make-one/crm';
import { tagVon } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';

/** Wie viele Tage nach der Anlage die erste Aktivität eines Menschen liegen darf, damit die Person als neuer Lead zählt. */
export const NEUER_LEAD_SPANNE_TAGE = 3;
/** Quelle des Wegs „Import (Liste)“ (lib/crm/person-anlegen.ts `ANLEGE_REGELN.import.quelle`). */
export const IMPORT_QUELLE = 'Liste';
const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Der Tag, an dem die Person als neuer Lead zählt — sonst null (Import, nur System-Einträge, erste Ansprache lange nach der Anlage). */
export function neuerLeadAm(k: Pick<Kontakt, 'importiertAm' | 'aktivitaeten'> & { quelle?: string }): string | null {
  const angelegt = (k.importiertAm ?? '').slice(0, 10);
  if (!TAG.test(angelegt)) return null;
  if ((k.quelle ?? '').trim() === IMPORT_QUELLE) return null;
  const erste = (k.aktivitaeten ?? []).filter(a => !!a.von && a.von !== 'system' && typeof a.am === 'string').map(a => tagVon(a.am)).filter(t => TAG.test(t)).sort()[0];
  if (!erste) return null;
  return erste >= angelegt && erste <= tagPlus(angelegt, NEUER_LEAD_SPANNE_TAGE) ? angelegt : null;
}

/** Wie lange ein neuer Lead „neu“ ist (Überblick „Neue Leads ohne nächsten Schritt“) — dieselbe Spanne wie „frisch angelegt“ (lib/crm/leads.ts). */
export const NEUER_LEAD_FENSTER_TAGE = 14;
/**
 * Ist die Person ein NEUER Lead der letzten `tage` Tage? (Abnahme 14.10., C8: „neuer Lead“ hatte zwei Regeln — „14 Tage frisch angelegt“ im
 * Überblick gegen `neuerLeadAm` im Kreislauf-Ist; die Demo zeigte „3 neue Leads, angelegt heute“ neben „IST 0 neue Leads/Monat“.) EINE Regel:
 * `neuerLeadAm`, dazu nur das Zeitfenster. Rein.
 */
export function neuerLeadSeit(k: Pick<Kontakt, 'importiertAm' | 'aktivitaeten'> & { quelle?: string }, heute: string, tage = NEUER_LEAD_FENSTER_TAGE): boolean {
  const am = neuerLeadAm(k);
  return !!am && am <= heute && am >= tagPlus(heute, -tage);
}

/** Was die Zählung je Person braucht (Anlage, Verlauf, wer die Beziehung hält). */
export type NeuerLeadKontakt = Pick<Kontakt, 'importiertAm' | 'aktivitaeten'> & { quelle?: string; besitzer?: string };

/**
 * Der NEUE Lead einer Lead-Zeile (17.10., L2 B4): EINE Zählung „neue Leads“ für Wochen-Scoreboard, Challenges (`wochenIst`), Kanal-Stand und
 * Kreislauf — je Lead-Zeile (Firma bzw. Person ohne Firma, wie `leads()` sie bildet: ohne Personen mit Art.-18-Einschränkung oder Werbesperre)
 * der früheste Tag, an dem eine ihrer Personen als neuer Lead zählt (`neuerLeadAm`), und wer ihn gebracht hat (die Person, die die Beziehung
 * hält, sonst der erste Mensch im Verlauf). Vorher zählten Scoreboard und Challenges je PERSON aus der rohen Kartei (zwei neue Personen einer
 * Firma = 2, eine eingeschränkte Person zählte mit), Kanal-Stand und Kreislauf je Lead-Zeile. Rein.
 */
export function neuerLead(z: { personen: readonly { id: string }[] }, kontaktNach: ReadonlyMap<string, NeuerLeadKontakt>): { tag: string; wer?: string } | null {
  let raus: { tag: string; wer?: string } | null = null;
  for (const p of z.personen) {
    const k = kontaktNach.get(p.id);
    const tag = k ? neuerLeadAm(k) : null;
    if (!k || !tag || (raus && raus.tag <= tag)) continue;
    const mensch = (k.aktivitaeten ?? []).filter(a => !!a.von && a.von !== 'system' && typeof a.am === 'string').sort((a, b) => tagVon(a.am).localeCompare(tagVon(b.am)))[0]?.von;
    const wer = k.besitzer ?? mensch;
    raus = { tag, ...(wer ? { wer } : {}) };
  }
  return raus;
}
