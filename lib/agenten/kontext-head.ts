// ─── Chat je Bereich: welcher Ansprechpartner passt zur Seite? (10.10., Auftrag: „ZOE unten so einstellen, dass sie den Chat immer passend
// zur Maske annimmt: im Sales der Head of Sales, im Marketing der Head of Marketing usw. — und dann können wir immer zu ZOE umschalten.“) ──
// Rein und client-sicher (auch im Browser-Bündel: nur Katalog, Markttraktions-Adressen und der CRM-Bezug — kein Node-Modul).
//
// EINE Zuordnung Seite → Head (`SEITEN_REGELN` + Feinzuordnung der Markttraktion), getestet in tests/chat-je-bereich.test.ts. Die
// Zuordnung im Browser ist NUR ein Vorschlag: ob die Person den Head nutzen darf, entscheidet der SERVER (lib/agenten/sicht.ts —
// GET /api/agenten/chat liefert nur Heads, die die Person sieht; die Thread-Route lehnt alles andere mit 403 ab). Regeln:
//   • Was keinen Head hat (Heute, Inbox, Kalender, ZOE-Seiten, Konto …) → ZOE (null).
//   • Ein Head gehört nur in die Sicht seines Bereichs: Business-Heads nie in der Privat-Sicht, Privat-Heads nie in der Business-Sicht.
//   • Gesundheit nur für die eigene Ansicht (`?fuer=` = die Seite einer anderen Person → ZOE); ohne Einwilligung meldet der Server `fehlt`.
//   • Seitenwechsel tauscht den Ansprechpartner — das Panel wartet damit, bis eine laufende Antwort fertig ist (components/os/ZoePanel.tsx).
// Neue Seite mit eigenem Head = eine Zeile in `SEITEN_REGELN` (Kennung aus lib/agenten/katalog.ts; der Wächtertest prüft, dass es den Head
// gibt und sein Bereich zur Zeile passt).

import { headDef } from './katalog';
import { aufloesen } from '@/lib/crm/adresse';
import { crmBezugAus, zoeBezugFuer, type CrmBezug } from '@/lib/zoe/crm-bezug';
import type { Bereich, FarbToken } from './typen';

/** Einstellung je Person: „passender Head der Seite“ (Vorgabe) oder „immer ZOE“. Liegt im Index der Threads der Person (`chat`). */
export type ChatWahl = 'seite' | 'zoe';
export const CHAT_WAHL_VORGABE: ChatWahl = 'seite';
export const istChatWahl = (v: unknown): v is ChatWahl => v === 'seite' || v === 'zoe';
export const CHAT_WAHL_TEXT: Record<ChatWahl, string> = { seite: 'Passender Head', zoe: 'Immer ZOE' };

/** Ein Head, mit dem die Person im Chat unten sprechen darf (Antwort von GET /api/agenten/chat — nur sichtbare Heads der Sicht). */
export interface ChatHead {
  id: string;
  name: string;
  kurz: string;
  farbe: FarbToken;
  bereich: Bereich;
  auftrag: string;
  hinweis?: string;
  /** Gerade gesperrt (Not-Aus, ausgeschaltet) — der Satz dazu; dann antwortet ZOE. */
  gesperrt?: string;
}

/** Warum ein Head der Sicht für die Person fehlt — nur, was die Person selbst ändern kann (heute: die eigene Gesundheits-Einwilligung). */
export type ChatFehlt = 'einwilligung';
export const CHAT_FEHLT_TEXT: Record<ChatFehlt, (name: string) => string> = {
  einwilligung: name => `${name} antwortet erst mit deiner Einwilligung „Gesundheitsdaten an die KI“ — bis dahin antwortet hier ZOE.`,
};

/** Antwort von GET /api/agenten/chat. */
export interface ChatKontextAntwort { ok: true; heads: ChatHead[]; wahl: ChatWahl; fehlt: Partial<Record<string, ChatFehlt>> }

type Zuordnung = string | null | { privat?: string | null; business?: string | null };
export interface SeitenRegel { muster: string; head: Zuordnung }

/**
 * Seite → Head. Muster wie in lib/make-one/spaces.ts: Pfad (auch Unterpfade), `=` = genau dieser Pfad, `?k=v` = Parameter müssen passen.
 * Das genaueste (längste) Muster gewinnt. Die Markttraktion ordnet `markttraktionHead` fein zu (Reiter `s`).
 */
export const SEITEN_REGELN: readonly SeitenRegel[] = [
  // Gemeinsame Seiten und ZOE selbst → ZOE.
  { muster: '=/os', head: null },
  { muster: '/os/inbox', head: null },
  { muster: '/os/kalender', head: null },
  { muster: '/os/stapel', head: null },
  { muster: '/os/agenten', head: null }, // die Agenten-Seite hat ihre eigenen Head-Chats
  { muster: '/os/loop', head: null },
  { muster: '/os/wissen', head: null },
  { muster: '/os/konto', head: null },
  { muster: '/os/onboarding', head: null },
  { muster: '/os/menschen', head: null },
  // Business
  { muster: '/os/markttraktion', head: 'sales' },
  { muster: '/os/prospecting', head: 'sales' },
  { muster: '/os/netzwerken', head: 'event' },
  { muster: '/os/content', head: 'marketing' },
  { muster: '/os/medien', head: { business: 'marketing' } },
  { muster: '/os/mandate', head: 'kundenerfolg' },
  { muster: '/os/unternehmen', head: 'strategie' },
  { muster: '/os/board', head: 'strategie' },
  { muster: '/os/meeting', head: 'operations' },
  { muster: '/os/research', head: 'research' },
  { muster: '/os/hoi', head: 'it' },
  { muster: '/os/bauplan', head: 'it' },
  { muster: '/os/system', head: 'it' },
  { muster: '/os/verbindungen', head: 'it' },
  { muster: '/os/datenbasis', head: 'it' },
  { muster: '/os/datenschutz', head: 'recht' },
  // Beide Bereiche — der Head je Sicht
  { muster: '/os/finanzen', head: { privat: 'finanzen-privat', business: 'finanzen' } },
  { muster: '/os/aufgaben', head: { privat: 'assistenz', business: 'operations' } },
  { muster: '/os/planung', head: { privat: 'assistenz', business: 'strategie' } },
  { muster: '/os/planung/kapazitaet', head: { privat: null, business: 'operations' } },
  { muster: '/os/fokus', head: { privat: 'assistenz', business: 'strategie' } },
  { muster: '/os/kompass', head: { privat: 'assistenz', business: 'strategie' } },
  { muster: '/os/wachstum', head: { privat: 'assistenz', business: 'strategie' } },
  // Privat
  { muster: '/os/gesundheit', head: 'gesundheit' },
  { muster: '/os/gesundheit?s=ernaehrung', head: 'ernaehrung' },
  { muster: '/os/ernaehrung', head: 'ernaehrung' },
  { muster: '/os/sport', head: 'gesundheit' },
  { muster: '/os/familie', head: 'familie' },
];

const params = (suche: string) => new URLSearchParams(suche.startsWith('?') ? suche.slice(1) : suche);

/** Passt die Adresse zum Muster? (dieselbe Regel wie lib/make-one/spaces.ts `passtZu` — hier ohne dessen Symbol-Importe.) */
export function seitePasst(pfad: string, suche: string, muster: string): boolean {
  const genau = muster.startsWith('=');
  const [mp, mq] = (genau ? muster.slice(1) : muster).split('?');
  if (!(genau ? pfad === mp : pfad === mp || pfad.startsWith(`${mp}/`))) return false;
  if (!mq) return true;
  const q = params(suche);
  return Array.from(new URLSearchParams(mq).entries()).every(([k, v]) => q.get(k) === v);
}

/** Markttraktion fein (Reiter `s`, alte Adressen über `aufloesen`): Marketing → Marketing, besuchte und eigene Events → Event, sonst Sales. */
export function markttraktionHead(suche: string): string {
  const q = params(suche);
  const { s } = aufloesen(q.get('s'), q.get('a'));
  if (s === 'marketing') return 'marketing';
  if (s === 'besuche' || s === 'event') return 'event';
  return 'sales';
}

/** Gesundheit/Sport einer ANDEREN Person (`?fuer=`): der eigene Gesundheits-Head spräche über die eigenen Werte — dort antwortet ZOE. */
const fremdeGesundheit = (pfad: string, suche: string) =>
  ['/os/gesundheit', '/os/sport'].some(p => pfad === p || pfad.startsWith(`${p}/`)) && !!params(suche).get('fuer');

/**
 * Der Head, der zur Seite passt — oder null (ZOE). `space` = die Sicht des Kopfs (Privat · Business): ein Head anderen Bereichs gilt nie
 * (Business-Head in der Privat-Sicht → ZOE). Nur ein Vorschlag: der Server entscheidet, ob die Person den Head nutzen darf.
 */
export function kontextHeadFuer(pfad: string, suche: string, space: Bereich): string | null {
  if (fremdeGesundheit(pfad, suche)) return null;
  let best: { regel: SeitenRegel; l: number } | null = null;
  for (const r of SEITEN_REGELN) {
    if (!seitePasst(pfad, suche, r.muster)) continue;
    const l = r.muster.length + (r.muster.includes('?') ? 0.5 : 0);
    if (!best || l > best.l) best = { regel: r, l };
  }
  if (!best) return null;
  const z = best.regel.head;
  let id = typeof z === 'object' && z !== null ? z[space] ?? null : z;
  if (id === 'sales' && best.regel.muster === '/os/markttraktion') id = markttraktionHead(suche);
  const h = id ? headDef(id) : null;
  return h && h.bereich === space ? h.id : null;
}

export type PartnerSchluessel = 'zoe' | `head:${string}`;
export const partnerSchluessel = (headId: string | null | undefined): PartnerSchluessel => (headId ? `head:${headId}` : 'zoe');

export interface Ansprechpartner {
  /** Wer gerade antwortet. */
  partner: PartnerSchluessel;
  /** Der Head, der zur Seite passt UND für die Person nutzbar ist (für den Umschalter „↔“) — sonst null. */
  angebot: ChatHead | null;
  /** Warum hier ZOE statt des passenden Heads antwortet (nur, wenn die Wahl „passender Head“ ist). */
  hinweis?: string;
  /** Der Hinweis betrifft die eigene Gesundheits-Einwilligung (die Oberfläche verlinkt dorthin). */
  einwilligung?: boolean;
}

/**
 * Wer antwortet (rein): `wahl` „zoe“ → ZOE; sonst der vorgeschlagene Head, wenn der Server ihn liefert und er nicht gesperrt ist — sonst ZOE
 * mit Hinweis. `manuell` = Umschalter im Chat-Kopf („↔ ZOE“ bzw. „↔ <Head>“) — er gilt nur für den Head, für den er gesetzt wurde.
 */
export function ansprechpartnerFuer(o: {
  vorschlag: string | null;
  heads: readonly ChatHead[];
  wahl: ChatWahl;
  fehlt?: Partial<Record<string, ChatFehlt>>;
  manuell?: { ziel: 'zoe' | 'head'; fuer: string | null } | null;
}): Ansprechpartner {
  if (!o.vorschlag) return { partner: 'zoe', angebot: null };
  const h = o.heads.find(x => x.id === o.vorschlag) ?? null;
  const angebot = h && !h.gesperrt ? h : null;
  const manuell = o.manuell && o.manuell.fuer === o.vorschlag ? o.manuell.ziel : null;
  const willHead = manuell ? manuell === 'head' : o.wahl === 'seite';
  if (angebot) return { partner: willHead ? partnerSchluessel(angebot.id) : 'zoe', angebot };
  if (!willHead) return { partner: 'zoe', angebot: null };
  const name = h?.name ?? headDef(o.vorschlag)?.name ?? 'Der passende Head';
  const grund = o.fehlt?.[o.vorschlag];
  if (grund) return { partner: 'zoe', angebot: null, hinweis: CHAT_FEHLT_TEXT[grund](name), einwilligung: grund === 'einwilligung' };
  if (h?.gesperrt) return { partner: 'zoe', angebot: null, hinweis: `${h.gesperrt} Hier antwortet ZOE.` };
  return { partner: 'zoe', angebot: null, hinweis: `${name} ist für dich hier nicht freigeschaltet — es antwortet ZOE.` };
}

/**
 * Der Kontext der Seite für den Chat — NUR eine geprüfte Kennung, nie Text Dritter (wie „ZOE fragen“, lib/zoe/crm-bezug.ts): ein offener
 * Kontakt, eine Firma, ein Deal oder ein Angebot in der Markttraktion bzw. ein offenes Mandat. Reiter allein tragen keinen Bezug.
 */
export function seitenBezug(pfad: string, suche: string): CrmBezug | null {
  const q = params(suche);
  if (pfad === '/os/markttraktion' || pfad.startsWith('/os/markttraktion/')) {
    const { s, a } = aufloesen(q.get('s'), q.get('a'));
    const b = zoeBezugFuer(s, a, q.get('k'));
    return b.id ? b : null;
  }
  if (pfad === '/os/mandate' && q.get('s') !== 'produkte') return crmBezugAus({ art: 'mandat', id: q.get('k') });
  return null;
}

/** Welche Leseweg nennt der Hinweis an einen Head (nur Werkzeuge, die er hat)? */
const LESEN: Partial<Record<CrmBezug['art'], readonly string[]>> = {
  kontakt: ['kontakt_akte'], firma: ['firma_akte'], deal: ['pipeline'], angebot: ['angebote_lage'], mandat: ['mandate_lage'], event: ['events_lage', 'besuche_lage'],
};
const LABEL: Partial<Record<CrmBezug['art'], string>> = { kontakt: 'Kontakt', firma: 'Firma', deal: 'Deal', angebot: 'Angebot', mandat: 'Mandat', event: 'Event' };

/**
 * Satz für den System-Text eines Heads (Server): wo die Person den Chat geöffnet hat. Nur Art + Kennung (kein Text Dritter, das Gespräch
 * wird dadurch nicht „fremd gelesen“); nachgelesen wird nur mit den eigenen Werkzeugen des Heads. Ohne Bezug bzw. ohne CRM-Kategorie → ''.
 */
export function bezugSatzFuerHead(b: CrmBezug | null, head: { kategorien: readonly string[]; werkzeuge: readonly string[] }): string {
  if (!b?.id || !head.kategorien.includes('crm')) return '';
  const werkzeug = (LESEN[b.art] ?? []).find(w => head.werkzeuge.includes(w));
  return `SEITE: Die Person schreibt dir aus ${LABEL[b.art] ?? b.art} ${b.id}. Bezieht sich die Frage darauf („hier“, „dieser Kontakt“, „das Angebot“), lies zuerst ${werkzeug ? `mit ${werkzeug} (Kennung ${b.id})` : 'mit deinen Werkzeugen'} nach — was du nicht lesen kannst, sagst du offen.`;
}
