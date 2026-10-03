// ─── Gmail — aus einer Mail eine Aufgabe, ein Follow-up, einen Termin, einen Kontakt machen (rein, 03.10.2026) ──
// Die Inbox schreibt nie selbst in Aufgaben, CRM oder Kalender: sie bereitet vor (Titel aus dem Betreff, Bezug zu Kontakt/Firma/
// Deal, Link zurück zur Mail) und ruft die VORHANDENEN Schreibwege — Aufgaben (`ADD_TASK`/`/api/tasks/create`), Follow-up
// (`/api/crm/followup`), Termin (`NeuerTermin` mit `kalenderZiel`: Business → Google Kalender der Person), Anfrage
// (`/api/crm/anfrage`, Kanal „Mail“: Herkunft „selbst“, Rechtsgrundlage Vertrag/Anbahnung, Einwilligung nur „Antwort auf Anfrage“).
// Ein Link steht als Pfad im Text (`/os/inbox?offen=gmail-<Kennung>`) — `TextMitLinks` macht daraus „Öffnen ›“.
// Hier steht nur, was Browser UND Tests brauchen; der Mailtext selbst geht nie in eine Aufgabe (nur Betreff + Absender).

import type { AnfrageEingabe } from '@/lib/crm/anfragen';
import type { Vorgabe } from '@/lib/kalender/formular';
import type { GmailKopf, Zuordnung } from './typen';

/** `Re:`/`AW:`/`Fwd:` vorne weg, eine Zeile. */
export const betreffOhneRe = (b: string): string => b.replace(/\s+/g, ' ').trim().replace(/^((re|aw|antw|wg|fwd?)\s*:\s*)+/i, '').trim();

/** Der Link zur Mail (Pfad in MAKE OS). */
export const mailPfad = (id: string): string => `/os/inbox?offen=gmail-${id}`;

const absender = (k: GmailKopf): string => `${k.von.name ? `${k.von.name} ` : ''}<${k.von.email}>`;
const kurz = (t: string, n: number) => t.length > n ? `${t.slice(0, n - 1)}…` : t;

export interface AufgabeAusMail {
  title: string;
  description: string;
  priority: 'medium';
  space: 'business';
  bezug?: { kontaktId?: string; firmaId?: string; dealId?: string };
}

/** Aufgabe zu einer Mail: Titel = Betreff, Beschreibung = „Aus Gmail · Absender“ + Link, Bezug zu Kontakt/Firma/Deal (nur Kennungen). */
export function aufgabeAusMail(k: GmailKopf, z: Zuordnung | null): AufgabeAusMail {
  const betreff = betreffOhneRe(k.betreff) || `Mail von ${k.von.name ?? k.von.email}`;
  const bezug = z ? { kontaktId: z.kontaktId, ...(z.firmaId ? { firmaId: z.firmaId } : {}), ...(z.dealId ? { dealId: z.dealId } : {}) } : undefined;
  return {
    title: kurz(betreff, 300), priority: 'medium', space: 'business',
    description: kurz(`Aus Gmail · ${absender(k)}\n${mailPfad(k.id)}`, 4000),
    ...(bezug ? { bezug } : {}),
  };
}

export interface FollowUpAusMail { aktion: 'anlegen'; bezug: { art: 'kontakt'; id: string }; kontaktId: string; art: 'mail'; text: string; faellig: string; notiz: string }

/** Follow-up zu einer Mail (nur mit zugeordneter Person — ein Follow-up hängt immer an jemandem). */
export function followUpAusMail(k: GmailKopf, z: Zuordnung | null, faellig: string): FollowUpAusMail | null {
  if (!z) return null;
  return {
    aktion: 'anlegen', bezug: { art: 'kontakt', id: z.kontaktId }, kontaktId: z.kontaktId, art: 'mail',
    text: kurz(`Mail beantworten: ${betreffOhneRe(k.betreff) || '(kein Betreff)'}`, 300), faellig,
    notiz: kurz(`Aus Gmail · ${absender(k)}\n${mailPfad(k.id)}`, 1000),
  };
}

/** Vorgabe für den Termin-Dialog (Business → Google Kalender der Person über `kalenderZiel`). `ursprung` = `window.location.origin` für den Link im Termin. */
export function terminVorgabe(k: GmailKopf, z: Zuordnung | null, heute: string, person: string, ursprung = ''): Vorgabe {
  return {
    tag: heute, wer: person as Vorgabe['wer'], titel: kurz(betreffOhneRe(k.betreff) || `Termin mit ${k.von.name ?? k.von.email}`, 200),
    notiz: kurz(`Aus Gmail · ${absender(k)}\n${ursprung}${mailPfad(k.id)}`, 2000),
    ...(z ? { crm: { kontaktId: z.kontaktId, ...(z.firmaId ? { firmaId: z.firmaId } : {}), ...(z.dealId ? { dealId: z.dealId } : {}) } } : {}),
  };
}

/** „Vorname Nachname“ / „Nachname, Vorname“ aus dem Anzeigenamen; ohne Namen leer (die Adresse trägt die Person). */
export function nameTeilen(name?: string): { vorname: string; nachname: string } {
  const n = (name ?? '').replace(/["<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!n || n.includes('@')) return { vorname: '', nachname: '' };
  if (n.includes(',')) { const [nach, vor] = n.split(',').map(x => x.trim()); return { vorname: vor ?? '', nachname: nach ?? '' }; }
  const teile = n.split(' ');
  return teile.length === 1 ? { vorname: '', nachname: teile[0] } : { vorname: teile.slice(0, -1).join(' '), nachname: teile[teile.length - 1] };
}

/** Eingabe für `/api/crm/anfrage` (Kanal Mail): eine Website-/Inbound-Anfrage zählt als Marketing-Lead (`istMarketingLead`: Aktivität „Anfrage über …“). */
export function kontaktAusMail(k: GmailKopf, heute: string): AnfrageEingabe {
  return {
    kanal: 'mail', neu: { ...nameTeilen(k.von.name), email: k.von.email },
    // Nur Betreff + eine Kurzfassung des Ausschnitts — nie der ganze Text.
    text: kurz(`${betreffOhneRe(k.betreff) || '(kein Betreff)'}${k.ausschnitt ? ` — ${k.ausschnitt}` : ''}`, 600), datum: heute,
  };
}
