// ─── Art. 15: Buchungen, Termin-Bezüge, Meetings und Termin-Follow-ups einer Person (S1 #5, 29.09.) ─
// Die Auskunft (GET /api/crm/datenschutz, `personAufzaehlen`) kannte die Buchungsseite, die Kalender-Bezüge und den
// Meeting-Verlauf nur als ZAHL je Speicher (`weitereSpeicher`). Art. 15 Abs. 3 verlangt eine KOPIE der Daten. Hier die
// reinen Teile (getestet); geladen wird in lib/crm/person-bestaende.ts.
//
//   buchungen     jede Buchung mit der Kontakt-Kennung oder einer Adresse der Person — als Kopie, OHNE Geheimnisse:
//                 kein `tokenHash` (Status-Link), vom Mail-Bestätigungslink nur Zeitpunkte (`mailLink.am/bis`, nie `hash`).
//   terminBezuege Einträge aus `kalender-bezug`, in denen die Person Kontakt oder Gast ist (nur Kennungen, Tag, Art,
//                 wer angelegt hat — Titel/Adressen stehen dort nie; der Termin selbst liegt in Apple).
//   meetings      Meeting-Protokolle (`meetings`), die an einem Termin der Person hängen (`terminId`) oder sie nennen.
//                 Der Wortlaut (`transcript`) enthält Äußerungen Dritter (Art. 15 Abs. 4) — er steht hier nicht, nur
//                 dass es ihn gibt; herausgegeben wird er nach Prüfung von Hand.
//   terminFollowups  Follow-ups, die über `terminUid` an einem Termin der Person hängen, ohne schon über die Person selbst
//                 in `followups` zu stehen (z. B. an einem Deal).
// Termine der Person = Schlüssel aus ihren Bezügen, ihren Buchungen (`terminUid`) und ihren Aktivitäten (`terminUid`).

import { schluesselPasst, type BezugBestand, type TerminBezug } from '@/lib/kalender/bezug';
import type { Buchung } from '@/lib/kalender/buchung';
import type { FollowUp } from './typen';
import { nenntPerson, type PersonMerkmale } from './person-weitere';

/** Eine Buchung, wie sie in die Auskunft geht — nie ein Token-Hash. */
export type BuchungAuskunft = Omit<Buchung, 'tokenHash' | 'mailLink'> & { mailLink?: { am: string; bis: string } };

/** Kopie einer Buchung ohne Geheimnisse (Status-Token-Hash, Hash des Mail-Links). Rein. */
export function buchungKopie(b: Buchung): BuchungAuskunft {
  const { tokenHash: _t, mailLink, ...rest } = b;
  return { ...rest, ...(mailLink ? { mailLink: { am: mailLink.am, bis: mailLink.bis } } : {}) };
}

/** Gehört die Buchung zur Person (Kontakt-Kennung oder eine ihrer Adressen)? */
export const buchungDerPerson = (b: Pick<Buchung, 'kontaktId' | 'email'>, m: Pick<PersonMerkmale, 'id' | 'emails'>): boolean =>
  (!!b.kontaktId && b.kontaktId === m.id) || (!!b.email && m.emails.includes(b.email.trim().toLowerCase()));

export function buchungenAuskunft(buchungen: readonly Buchung[] | undefined, m: Pick<PersonMerkmale, 'id' | 'emails'>): BuchungAuskunft[] {
  return (buchungen ?? []).filter(b => buchungDerPerson(b, m)).map(buchungKopie);
}

export interface BezugAuskunft { schluessel: string; rolle: ('kontakt' | 'gast')[]; eintrag: Omit<TerminBezug, 'gastKontakte'> & { gaeste?: number } }

/** Bezüge, in denen die Person Kontakt oder Gast ist — andere Gäste nur als Zahl (ihre Kennungen gehören nicht in diese Auskunft). */
export function bezuegeAuskunft(bestand: BezugBestand | null | undefined, id: string): BezugAuskunft[] {
  const raus: BezugAuskunft[] = [];
  for (const [schluessel, e] of Object.entries(bestand?.bezuege ?? {})) {
    const gast = Array.isArray(e?.gastKontakte) && e.gastKontakte.includes(id);
    if (e?.kontaktId !== id && !gast) continue;
    const { gastKontakte, ...rest } = e;
    raus.push({ schluessel, rolle: [...(e.kontaktId === id ? ['kontakt' as const] : []), ...(gast ? ['gast' as const] : [])], eintrag: { ...rest, ...(gastKontakte?.length ? { gaeste: gastKontakte.length } : {}) } });
  }
  return raus;
}

/** Die Termin-Schlüssel der Person (Bezüge, Buchungen, Aktivitäten) — ohne Doppelte. */
export function terminSchluesselDerPerson(bezuege: readonly BezugAuskunft[], buchungen: readonly Pick<Buchung, 'terminUid'>[], aktivitaeten: readonly { terminUid?: string }[] | undefined): string[] {
  return Array.from(new Set([...bezuege.map(b => b.schluessel), ...buchungen.map(b => b.terminUid ?? ''), ...(aktivitaeten ?? []).map(a => a.terminUid ?? '')].filter(Boolean)));
}

const amTermin = (ref: string | undefined, schluessel: readonly string[]) => !!ref && schluessel.some(s => schluesselPasst(ref, s, { serie: true }) || schluesselPasst(s, ref, { serie: true }));

export interface MeetingRoh { id: string; datum: string; titel: string; terminId?: string; terminTitel?: string; transcript?: string; zusammenfassung?: string; entscheidungen?: string[]; aufgaben?: { text: string; wer?: string; frist?: string }[]; angelegt: string }
export type MeetingAuskunft = Omit<MeetingRoh, 'transcript'> & { wortlautVorhanden?: true; grund: ('termin' | 'nennung')[] };

/** Meetings am Termin der Person oder mit Nennung — ohne Wortlaut (Rechte Dritter, s. Kopf). */
export function meetingsAuskunft(meetings: readonly MeetingRoh[] | undefined, m: PersonMerkmale, schluessel: readonly string[]): MeetingAuskunft[] {
  const raus: MeetingAuskunft[] = [];
  for (const x of meetings ?? []) {
    const termin = amTermin(x.terminId, schluessel);
    const nennung = nenntPerson(x, m);
    if (!termin && !nennung) continue;
    const { transcript, ...rest } = x;
    raus.push({ ...rest, ...(transcript ? { wortlautVorhanden: true as const } : {}), grund: [...(termin ? ['termin' as const] : []), ...(nennung ? ['nennung' as const] : [])] });
  }
  return raus;
}

/** Follow-ups an einem Termin der Person, die nicht schon über die Person selbst in der Auskunft stehen. */
export function terminFollowupsAuskunft(followups: readonly FollowUp[] | undefined, schluessel: readonly string[], schon: ReadonlySet<string>): FollowUp[] {
  return (followups ?? []).filter(f => !schon.has(f.id) && amTermin(f.terminUid, schluessel));
}
