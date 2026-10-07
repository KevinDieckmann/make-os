// ─── Inbox — aus einem Gespräch eine Aufgabe, ein Follow-up, einen Termin, einen Kontakt machen (rein, client-sicher) ──
// (03.10. für Gmail gebaut, seit 06.10. für JEDE Quelle der Inbox 2.) Die Inbox schreibt nie selbst in Aufgaben, CRM oder Kalender:
// sie bereitet vor (Titel aus dem Betreff, Bezug zu Kontakt/Firma/Deal, Link zurück zum Gespräch) und ruft auf Klick die VORHANDENEN
// Schreibwege — Aufgaben (`ADD_TASK`/`/api/tasks/create`), Follow-up (`/api/crm/followup`), Termin (`NeuerTermin` mit `kalenderZiel`:
// Business → Google Kalender der Person), Anfrage (`/api/crm/anfrage`, Kanal „Mail“: Herkunft „selbst“, Rechtsgrundlage Vertrag/
// Anbahnung, Einwilligung nur „Antwort auf Anfrage“). Der Link steht als Pfad im Text (`/os/inbox?offen=<Gespräch>`).
// Der Mailtext selbst geht nie in eine Aufgabe (nur Betreff + Absender); in die Anfrage nur eine Kurzfassung.

import type { AnfrageEingabe } from '@/lib/crm/anfragen';
import type { Vorgabe } from '@/lib/kalender/formular';
import type { Adr, Zuordnung } from '@/lib/gmail/typen';
import { bereichVon } from '@/lib/einheiten';
import { gespraechPfad } from './strom';

/** Was die Bausteine von einem Gespräch brauchen. */
export interface GespraechKurz { id: string; betreff: string; gegenueber: Adr; zuordnung?: Zuordnung | null; bereich: string | null }

/** `Re:`/`AW:`/`Fwd:` vorne weg, eine Zeile. */
export const betreffOhneRe = (b: string): string => b.replace(/\s+/g, ' ').trim().replace(/^((re|aw|antw|wg|fwd?)\s*:\s*)+/i, '').trim();

const absender = (a: Adr): string => `${a.name ? `${a.name} ` : ''}<${a.email}>`;
const kurz = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const herkunft = (g: GespraechKurz) => `Aus der Inbox · ${absender(g.gegenueber)}`;
/** Privat- oder Business-Bereich des Postfachs (ohne Bereich: Business, wie bisher bei Gmail). */
export const spaceVon = (g: Pick<GespraechKurz, 'bereich'>): 'privat' | 'business' => (g.bereich ? bereichVon(g.bereich) : 'business');
const bezugVon = (z: Zuordnung | null | undefined) => (z ? { kontaktId: z.kontaktId, ...(z.firmaId ? { firmaId: z.firmaId } : {}), ...(z.dealId ? { dealId: z.dealId } : {}) } : undefined);

export interface AufgabeAusGespraech {
  title: string;
  description: string;
  priority: 'medium';
  space: 'privat' | 'business';
  dueDate?: string;
  bezug?: { kontaktId?: string; firmaId?: string; dealId?: string };
}

/** Aufgabe: Titel = Betreff, Beschreibung = Herkunft + Link, Frist (optional), Bezug zu Kontakt/Firma/Deal (nur Kennungen). */
export function aufgabeAusGespraech(g: GespraechKurz, faellig?: string): AufgabeAusGespraech {
  const b = bezugVon(g.zuordnung);
  return {
    title: kurz(betreffOhneRe(g.betreff) || `Mail von ${g.gegenueber.name ?? g.gegenueber.email}`, 300), priority: 'medium', space: spaceVon(g),
    description: kurz(`${herkunft(g)}\n${gespraechPfad(g.id)}`, 4000),
    ...(faellig && /^\d{4}-\d{2}-\d{2}$/.test(faellig) ? { dueDate: faellig } : {}),
    ...(b ? { bezug: b } : {}),
  };
}

export interface FollowUpAusGespraech { aktion: 'anlegen'; bezug: { art: 'kontakt'; id: string }; kontaktId: string; art: 'mail'; text: string; faellig: string; notiz: string }

/** Follow-up (nur mit zugeordneter Person — ein Follow-up hängt immer an jemandem). */
export function followUpAusGespraech(g: GespraechKurz, faellig: string, text?: string): FollowUpAusGespraech | null {
  const z = g.zuordnung;
  if (!z) return null;
  return {
    aktion: 'anlegen', bezug: { art: 'kontakt', id: z.kontaktId }, kontaktId: z.kontaktId, art: 'mail',
    text: kurz(text ?? `Mail beantworten: ${betreffOhneRe(g.betreff) || '(kein Betreff)'}`, 300), faellig,
    notiz: kurz(`${herkunft(g)}\n${gespraechPfad(g.id)}`, 1000),
  };
}

/** Vorgabe für den Termin-Dialog. `ursprung` = `window.location.origin` für den Link im Termin. */
export function terminVorgabe(g: GespraechKurz, heute: string, person: string, ursprung = ''): Vorgabe {
  const b = bezugVon(g.zuordnung);
  return {
    tag: heute, wer: person as Vorgabe['wer'], titel: kurz(betreffOhneRe(g.betreff) || `Termin mit ${g.gegenueber.name ?? g.gegenueber.email}`, 200),
    notiz: kurz(`${herkunft(g)}\n${ursprung}${gespraechPfad(g.id)}`, 2000),
    ...(b ? { crm: b } : {}),
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

/** Eingabe für `/api/crm/anfrage` (Kanal Mail): zählt als Marketing-Lead („Anfrage über …“). Nur Betreff + Kurzfassung. */
export function kontaktAusGespraech(g: GespraechKurz, text: string, heute: string): AnfrageEingabe {
  const auszug = text.replace(/\s+/g, ' ').trim();
  return {
    kanal: 'mail', neu: { ...nameTeilen(g.gegenueber.name), email: g.gegenueber.email },
    text: kurz(`${betreffOhneRe(g.betreff) || '(kein Betreff)'}${auszug ? ` — ${auszug}` : ''}`, 600), datum: heute,
  };
}
