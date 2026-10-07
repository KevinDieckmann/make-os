// ─── Inbox 2 — Fächer, Rundschreiben, Fristen (rein, client-sicher, 06.10.2026) ──────────────────────────────────
// Ohne Modell und ohne Mailtext entschieden — nur Kopf, Betreff, Ausschnitt, Anhang-Metadaten (INBOX_KONZEPT.md Abschnitt 12.2):
//   info       Rundschreiben: List-Unsubscribe/List-Id/Precedence (`liste`), Auto-Submitted (`automatisch`), noreply-Absender,
//              Gmail-Kategorien — nie, wenn die Gegenseite eine Person aus der Kartei ist
//   warten     die jüngste ECHTE Nachricht ist von uns (automatische Antworten zählen nicht) — ab 3 Tagen „Nachfassen fällig“,
//              nach 30 Tagen fällt das Gespräch aus der Liste
//   neu        Screener: unbekannte Adresse (keine Akte, nie zugelassen, nie von uns angeschrieben), kein Rundschreiben
//   termine    Kalenderdatei im Anhang oder Einladungs-Wort im Betreff
//   geld       Rechnung/Mahnung/Vertrag/Behörde im Betreff oder ein PDF mit solchem Namen
//   antworten  alles andere, dessen jüngste echte Nachricht von außen kommt
// Kein Paket, keine Server-Importe.

export const FAECHER = [
  { id: 'antworten', label: 'Antworten', satz: 'Menschen, die etwas von dir wollen.' },
  { id: 'warten', label: 'Warten auf', satz: 'Du hast geschrieben — noch keine Antwort.' },
  { id: 'termine', label: 'Termine', satz: 'Einladungen und Terminanfragen.' },
  { id: 'geld', label: 'Geld & Papier', satz: 'Rechnungen, Verträge, Behörden.' },
  { id: 'neu', label: 'Neue Absender', satz: 'Einmal entscheiden: zulassen oder blocken.' },
  { id: 'info', label: 'Info & Rundschreiben', satz: 'Newsletter und Automatisches — am Stück wegräumen.' },
] as const;
export type FachId = typeof FAECHER[number]['id'];
export const FACH_LABEL: Record<FachId, string> = Object.fromEntries(FAECHER.map(f => [f.id, f.label])) as Record<FachId, string>;

/** Ab so vielen Tagen ohne Antwort ist Nachfassen fällig; nach `WARTEN_MAX` fällt ein Gespräch aus „Warten auf“. */
export const NACHFASSEN_TAGE = 3;
export const WARTEN_MAX_TAGE = 30;

const NOREPLY = /^(no-?reply|do-?not-?reply|noreply|mailer-daemon|postmaster|bounce|bounces|notifications?|benachrichtigung(en)?)([+.-][^@]*)?@/i;
const GMAIL_RAUSCHEN = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'CATEGORY_UPDATES'];
const AUTO_BETREFF = /^(automatische antwort|automatic reply|auto(matic)?[- ]?reply|abwesend|abwesenheitsnotiz|out of (the )?office|ich bin (derzeit )?nicht im büro|undeliverable|unzustellbar|delivery status notification|mail delivery failed)\b/i;
const TERMIN = /\b(einladung|invitation|termin(anfrage|vorschlag|bestätigung)?|meeting|besprechung|call am|kalender|calendly|zoom|teams[- ]besprechung|verschoben|verlegt|abgesagt)\b/i;
const GELD = /\b(rechnung|invoice|mahnung|zahlungserinnerung|zahlung|gutschrift|beleg|quittung|vertrag|kündigung|steuer|finanzamt|behörde|bescheid|lastschrift|abrechnung|honorar|police|versicherung)\w*/i;
const GELD_DATEI = /(rechnung|invoice|beleg|quittung|mahnung|gutschrift|abrechnung|receipt)/i;

/** Eine Nachricht, wie die Fächer sie brauchen (Teil des Kopfs). */
export interface FachNachricht {
  am: string;
  von: { email: string; name?: string };
  betreff: string;
  ausschnitt?: string;
  labels: string[];
  liste?: boolean;
  automatisch?: boolean;
  anhaenge: { name: string; typ: string; eingebettet?: boolean }[];
  vonUns: boolean;
}

/** Ist diese Nachricht automatisch (Abwesenheit, Zustellbericht, noreply)? Rein. */
export const istAutoNachricht = (n: Pick<FachNachricht, 'automatisch' | 'betreff' | 'von'>): boolean =>
  !!n.automatisch || AUTO_BETREFF.test(n.betreff.trim().replace(/^(re|aw|antw|wg|fwd?)\s*:\s*/i, '')) || NOREPLY.test(n.von.email);

/** Rundschreiben (eine eingehende Nachricht)? Rein. */
export const istRundschreiben = (n: Pick<FachNachricht, 'liste' | 'automatisch' | 'labels' | 'von'>): boolean =>
  !!n.liste || !!n.automatisch || NOREPLY.test(n.von.email) || n.labels.some(l => GMAIL_RAUSCHEN.includes(l));

export const istTermin = (n: Pick<FachNachricht, 'betreff' | 'anhaenge'>): boolean =>
  n.anhaenge.some(a => /text\/calendar|application\/ics/i.test(a.typ) || /\.ics$/i.test(a.name)) || TERMIN.test(n.betreff);

export const istGeld = (n: Pick<FachNachricht, 'betreff' | 'anhaenge'>): boolean =>
  GELD.test(n.betreff) || n.anhaenge.some(a => !a.eingebettet && /pdf/i.test(a.typ) && GELD_DATEI.test(a.name));

export interface FachEingabe {
  /** Nachrichten des Gesprächs, älteste zuerst. */
  nachrichten: FachNachricht[];
  /** Die Gegenseite ist eine Person aus der Kartei. */
  zugeordnet: boolean;
  /** Screener-Entscheidung zur Adresse der Gegenseite. */
  absender?: 'zugelassen' | 'geblockt';
  /** Wurde die Adresse je von uns angeschrieben (irgendein Postfach der Person)? */
  angeschrieben: boolean;
  /**
   * Kevin 07.10.: Quellen, über die Anfragen ausdrücklich kommen sollen (WhatsApp-Business-Nummer), überspringen den Screener —
   * eine unbekannte Nummer landet direkt in „Antworten“ (das 24-h-Fenster läuft ab der ersten Nachricht). Blocken bleibt möglich.
   */
  ohneScreener?: boolean;
  heute: string;
}

export interface FachErgebnis {
  fach: FachId | 'geblockt';
  /** Die jüngste echte Nachricht (Index in `nachrichten`). */
  massgeblich: number;
  /** Nur „warten“: ganze Tage seit unserer letzten Nachricht. */
  wartetTage?: number;
  nachfassen?: boolean;
  /** „warten“ älter als 30 Tage — nicht mehr in der Arbeitsliste. */
  verjaehrt?: boolean;
}

const tage = (vonIso: string, heute: string): number => Math.max(0, Math.floor((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${vonIso.slice(0, 10)}T12:00:00Z`)) / 86_400_000));

/** Das Fach eines Gesprächs (rein, getestet). */
export function fachVon(e: FachEingabe): FachErgebnis {
  const n = e.nachrichten;
  if (!n.length) return { fach: 'antworten', massgeblich: 0 };
  let i = n.length - 1;
  // Automatische Antworten von außen (Abwesenheit) zählen nicht — die davor zählt.
  while (i > 0 && !n[i].vonUns && istAutoNachricht(n[i])) i--;
  const m = n[i];
  const eingehend = n.filter(x => !x.vonUns);
  if (e.absender === 'geblockt' && !e.zugeordnet) return { fach: 'geblockt', massgeblich: i };
  if (m.vonUns) {
    const t = tage(m.am, e.heute);
    return { fach: 'warten', massgeblich: i, wartetTage: t, ...(t >= NACHFASSEN_TAGE ? { nachfassen: true } : {}), ...(t > WARTEN_MAX_TAGE ? { verjaehrt: true } : {}) };
  }
  if (!e.zugeordnet && eingehend.length && eingehend.every(istRundschreiben)) return { fach: 'info', massgeblich: i };
  if (!e.ohneScreener && !e.zugeordnet && e.absender !== 'zugelassen' && !e.angeschrieben && !n.some(x => x.vonUns)) return { fach: 'neu', massgeblich: i };
  if (istTermin(m)) return { fach: 'termine', massgeblich: i };
  if (istGeld(m)) return { fach: 'geld', massgeblich: i };
  return { fach: 'antworten', massgeblich: i };
}

// ── Fristen im Text („bis Freitag“, „bis 12.10.“) ──────────────────────────────

const WOCHENTAGE = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
const tagPlus = (tag: string, n: number): string => { const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Eine Frist aus dem Text (rein): Datum + das gefundene Stück. Nur Zukunft (oder heute). */
export function fristAus(text: string, heute: string): { datum: string; text: string } | null {
  const t = text.replace(/\s+/g, ' ');
  const wt = new Date(`${heute}T12:00:00Z`).getUTCDay();
  let m = /\b(bis|spätestens|bis spätestens)\s+(zum\s+|am\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/i.exec(t);
  if (m) {
    const jahrHeute = Number(heute.slice(0, 4));
    let jahr = m[5] ? Number(m[5].length === 2 ? `20${m[5]}` : m[5]) : jahrHeute;
    const tagS = `${jahr}-${m[4].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (!m[5] && tagS < heute) jahr++;
    const datum = `${jahr}-${m[4].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(`${datum}T12:00:00Z`)) && datum >= heute) return { datum, text: m[0].trim() };
  }
  m = /\b(bis|spätestens)\s+(zum\s+|am\s+|kommenden\s+|nächsten\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i.exec(t);
  if (m) {
    const ziel = WOCHENTAGE.indexOf(m[3].toLowerCase());
    let d = (ziel - wt + 7) % 7;
    if (/nächsten|kommenden/i.test(m[2] ?? '') && d === 0) d = 7;
    return { datum: tagPlus(heute, d), text: m[0].trim() };
  }
  if ((m = /\bbis\s+morgen\b/i.exec(t))) return { datum: tagPlus(heute, 1), text: m[0] };
  if ((m = /\bbis\s+(heute|heute abend|ende des tages)\b/i.exec(t))) return { datum: heute, text: m[0] };
  if ((m = /\bbis\s+ende\s+der\s+woche\b/i.exec(t))) return { datum: tagPlus(heute, (5 - wt + 7) % 7), text: m[0] };
  return null;
}
