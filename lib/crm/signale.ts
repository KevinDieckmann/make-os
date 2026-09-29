// ─── CRM — Signale aus Mail und Kalender (rein, getestet) ──────────────────
// Wenn ein Kontakt schreibt oder ein Termin mit ihm im Kalender steht, gehört
// das in seinen Verlauf — sonst veraltet die Kartei, und die Power Hour sieht
// nicht, wer auf eine Antwort wartet. Nur GESCHÄFTLICHE Quellen (das private
// Postfach und private Kalender bleiben draußen), nur bekannte Personen der
// Kartei, nur Betreff/Titel — nie Mailtext. Wiederholbar über einen
// Bezugsschlüssel je Nachricht/Termin.
// Seit 30.09. (K3): Termine ordnen sich über ihren BEZUG zu (`kalender-bezug`: Kontakt + Gäste aus dem CRM) — der
// Name im Titel ist nur noch Rückfall für Termine ohne Bezug. Für Termine mit Bezug legt dieses Signal NICHTS an: die
// Aktivität „Meeting“ mit `terminUid` entsteht in lib/crm/termin-aktivitaet.ts (eine Quelle, keine Doppelzählung —
// Verbindungskarte Befund 7). Zeitvergleich über `ausWandzeit` (Befund 11: Wandzeit gegen UTC war bis 2 h zu spät).

import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { ausWandzeit } from '@/lib/kalender/zeit';
import { uidVonSchluessel } from '@/lib/kalender/bezug';

export interface MailEin { id: string; email: string; betreff: string; am: string }
/**
 * Ein Termin für die Signale. `start`: Berliner Wandzeit (iCloud) oder ISO mit Zone (Beispiel-Quellen). `uid` = die
 * echte iCloud-UID (für „gibt es schon ein Meeting dazu?“), `kontaktIds` = Bezug + Gäste aus `kalender-bezug`.
 */
export interface TerminEin {
  id: string; titel: string; start: string; uid?: string; kontaktIds?: readonly string[];
  /** R-K1 #100: abgesagt (STATUS:CANCELLED) oder selbst abgelehnt — zählt nicht (kein Signal). */
  abgesagt?: boolean;
  /** S1 #10: privater Termin (CLASS bzw. Sicherung „privat“) — ohne Bezug nie über den Titel ins CRM. */
  privat?: boolean;
}

/** Zeitpunkt eines Terminbeginns in ms — Wandzeit über `ausWandzeit`, ISO mit Zone direkt. */
export function terminMs(start: string): number {
  if (/(Z|[+-]\d{2}:\d{2})$/.test(start)) return Date.parse(start);
  try { return ausWandzeit(start.slice(0, 19)).getTime(); } catch { return Number.NaN; }
}
export interface Signal { kontaktId: string; aktivitaet: Aktivitaet }

function hash(t: string): string { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
export const bezugMail = (id: string) => `mail-${hash(id)}`;
export const bezugTermin = (id: string) => `termin-${hash(id)}`;
const norm = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Absender „Name <mail@x.de>“ → mail@x.de */
export function mailAdresse(absender: string): string | null {
  const m = absender.match(/<([^>]+)>/) ?? absender.match(/([^\s<>"]+@[^\s<>"]+)/);
  return m ? m[1].trim().toLowerCase() : null;
}

/** Funktionspostfächer (info@, events@, newsletter@ …) sind keine Person, die auf uns wartet. */
export const ROLLENPOSTFACH = /^(no-?reply|do-?not-?reply|newsletter|news|info|events?|marketing|mailer|support|service|hello|hallo|kontakt|contact|office|team|presse|press|buchhaltung|rechnung|billing|notifications?)@/i;

export function mailSignale(kontakte: Kontakt[], mails: MailEin[]): Signal[] {
  const nachMail = new Map<string, Kontakt>();
  for (const k of kontakte) if (k.email && !ausgenommen(k) && !ROLLENPOSTFACH.test(k.email) && (k.vorname || k.nachname)) nachMail.set(k.email.toLowerCase(), k);
  const raus: Signal[] = [];
  for (const m of mails) {
    const k = nachMail.get(m.email.toLowerCase());
    if (!k) continue;
    const bezug = bezugMail(m.id);
    if ((k.aktivitaeten ?? []).some(a => a.bezug === bezug) || raus.some(r => r.aktivitaet.bezug === bezug)) continue;
    // Betreff ist Text eines Dritten: gekürzt, in einer Zeile, als „Betreff“ gekennzeichnet (26.09.).
    raus.push({ kontaktId: k.id, aktivitaet: { am: m.am, art: 'antwort', text: `Betreff: ${m.betreff.replace(/\s+/g, ' ').trim().slice(0, 120)}`, von: 'system', bezug } });
  }
  return raus;
}

/** Person im Termintitel: Vor- UND Nachname (Nachname ≥ 3 Zeichen) als ganze Wörter. */
export function personImTitel(k: Kontakt, titel: string): boolean {
  const vn = norm(k.vorname ?? ''), nn = norm(k.nachname ?? '');
  if (!vn || nn.length < 3) return false;
  const t = ` ${norm(titel)} `;
  return t.includes(` ${vn} `) && t.includes(` ${nn} `);
}

/**
 * Vergangene Termine → Signale im Verlauf (nur Termine OHNE Bezug, über den Namen im Titel). Kommende Termine merkt sich
 * der Lauf seit F3 (29.09.) nicht mehr: der „nächste Termin“ kommt aus dem Kalender-Leser der Akte (über den Bezug,
 * lib/kalender/termine-zu.ts `naechsterTermin`) — eine Quelle statt eines zweiten Zwischenspeichers.
 */
export function terminSignale(kontakte: Kontakt[], termine: TerminEin[], jetzt: string): { vergangen: Signal[] } {
  const vergangen: Signal[] = [];
  const jetztMs = Date.parse(jetzt);
  for (const t of termine) {
    if (t.abgesagt) continue;
    // Bezug gewinnt: zugeordnet über `kalender-bezug`, die Aktivität legt lib/crm/termin-aktivitaet.ts an.
    if (t.kontaktIds?.length) continue;
    // S1 #10 (29.09.): private Termine OHNE Bezug gehen nie ins CRM — weder mit Titel noch als „Termin (privat)“: die
    // Zuordnung liefe nur über den Namen im (privaten) Titel. Wer einen privaten Termin im CRM will, verknüpft ihn
    // (Bezug) — dann entsteht „Meeting (privat)“ ohne Titel (`meetingTextAusTermin`).
    if (t.privat) continue;
    if (terminMs(t.start) > jetztMs) continue; // kommt noch — kein Signal
    const passend = kontakte.filter(k => !ausgenommen(k) && personImTitel(k, t.titel));
    if (passend.length !== 1) continue; // mehrdeutig → lieber nichts zuordnen
    const k = passend[0];
    const bezug = bezugTermin(t.id);
    if ((k.aktivitaeten ?? []).some(a => a.bezug === bezug || (!!t.uid && ((!!a.terminUid && uidVonSchluessel(a.terminUid) === t.uid) || a.bezug === bezugTermin(t.uid))))) continue;
    vergangen.push({ kontaktId: k.id, aktivitaet: { am: t.start, art: 'termin', text: `Termin: ${t.titel.slice(0, 200)}`, von: 'system', bezug } });
  }
  return { vergangen };
}

/** Signale auf die Kartei anwenden: Verlauf ergänzen, letzter Kontakt nur vorwärts. */
export function signaleAnwenden(kontakte: Kontakt[], signale: Signal[]): { kontakte: Kontakt[]; neu: number } {
  const je = new Map<string, Aktivitaet[]>();
  for (const s of signale) je.set(s.kontaktId, [...(je.get(s.kontaktId) ?? []), s.aktivitaet]);
  let neu = 0;
  return {
    kontakte: kontakte.map(k => {
      const l = je.get(k.id);
      if (!l) return k;
      const dazu = l.filter(a => !(k.aktivitaeten ?? []).some(x => x.bezug === a.bezug));
      if (!dazu.length) return k;
      neu += dazu.length;
      const letzte = dazu.map(a => a.am.slice(0, 10)).sort().pop()!;
      return { ...k, aktivitaeten: [...(k.aktivitaeten ?? []), ...dazu].sort((a, b) => a.am.localeCompare(b.am)), ...(!k.letzterKontakt || letzte > k.letzterKontakt ? { letzterKontakt: letzte } : {}) };
    }),
    neu,
  };
}
