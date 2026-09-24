// ─── CRM — Signale aus Mail und Kalender (rein, getestet) ──────────────────
// Wenn ein Kontakt schreibt oder ein Termin mit ihm im Kalender steht, gehört
// das in seinen Verlauf — sonst veraltet die Kartei, und die Power Hour sieht
// nicht, wer auf eine Antwort wartet. Nur GESCHÄFTLICHE Quellen (das private
// Postfach und private Kalender bleiben draußen), nur bekannte Personen der
// Kartei, nur Betreff/Titel — nie Mailtext. Wiederholbar über einen
// Bezugsschlüssel je Nachricht/Termin.

import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';

export interface MailEin { id: string; email: string; betreff: string; am: string }
export interface TerminEin { id: string; titel: string; start: string }
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
  for (const k of kontakte) if (k.email && !k.werbesperre && !ROLLENPOSTFACH.test(k.email) && (k.vorname || k.nachname)) nachMail.set(k.email.toLowerCase(), k);
  const raus: Signal[] = [];
  for (const m of mails) {
    const k = nachMail.get(m.email.toLowerCase());
    if (!k) continue;
    const bezug = bezugMail(m.id);
    if ((k.aktivitaeten ?? []).some(a => a.bezug === bezug) || raus.some(r => r.aktivitaet.bezug === bezug)) continue;
    raus.push({ kontaktId: k.id, aktivitaet: { am: m.am, art: 'antwort', text: `Mail: ${m.betreff.slice(0, 200)}`, von: 'system', bezug } });
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

export function terminSignale(kontakte: Kontakt[], termine: TerminEin[], jetzt: string): { vergangen: Signal[]; kommend: Record<string, { titel: string; start: string }> } {
  const vergangen: Signal[] = [];
  const kommend: Record<string, { titel: string; start: string }> = {};
  for (const t of termine) {
    const passend = kontakte.filter(k => !k.werbesperre && personImTitel(k, t.titel));
    if (passend.length !== 1) continue; // mehrdeutig → lieber nichts zuordnen
    const k = passend[0];
    if (t.start <= jetzt) {
      const bezug = bezugTermin(t.id);
      if ((k.aktivitaeten ?? []).some(a => a.bezug === bezug)) continue;
      vergangen.push({ kontaktId: k.id, aktivitaet: { am: t.start, art: 'termin', text: `Termin: ${t.titel.slice(0, 200)}`, von: 'system', bezug } });
    } else if (!kommend[k.id] || t.start < kommend[k.id].start) kommend[k.id] = { titel: t.titel, start: t.start };
  }
  return { vergangen, kommend };
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
