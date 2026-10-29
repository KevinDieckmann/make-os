// ─── MAKE OS — Social: Antwort-Agent für Kommentare und DMs (28.10.2026, Malin-Paket) ─────────────────────────────────────────────────
// Kevin 28.10.: „automatisiert bei unseren eigenen kommentieren … und nicht, dass wir geblockt oder gesperrt werden.“ Fakten mit Quelle:
// research/social/FAKTEN_AUTO_KOMMENTARE.md. Was daraus folgt — und hier fest eingebaut ist:
//   · NUR die offizielle Schnittstelle, nur das EIGENE Konto (Kommentare unter eigenen Beiträgen, DMs im 24-h-Fenster). Kein Browser-Bot, kein
//     Scraping, nie unter fremden Beiträgen automatisch (dort nur Entwürfe, gepostet wird von Hand — lib/social/community.ts `fremd…`).
//   · Modus je Kanal (`CommunityEinstellung`): aus · vorschlag (Entwurf, ein Mensch sendet) · auto. Auto antwortet nur auf FRAGEN und FREUND-
//     LICHE Kommentare (`antwortKlasse`); Kritik, Beschwerden, Beratungsthemen (Gesundheit/Geld/Recht), Preise/Werbung, Spam und alles Unklare
//     gehen IMMER als Entwurf an einen Menschen.
//   · Gegen Spam-Erkennung: keine gleichen oder fast gleichen Antworten (Ähnlichkeit zu den letzten 30 eigenen Antworten), Tageslimits des Kanals,
//     Mindestabstand zwischen automatischen Antworten, höchstens `LAUF_MAX` je Lauf, Not-Aus „Antworten“ hält alles an.
//   · Offenlegung (KI-VO Art. 50, Meta-Messaging-Doku): die erste automatische DM eines Gesprächs trägt den Hinweis-Satz, automatische
//     Kommentar-Antworten das Zeichen des Kanals.
//   · Hintergrund-KI-Schalter, Not-Aus und Budget des Head of Marketing gelten (`laufSperre`); ohne KI: nichts (kein Platzhalter-Text).

import { localDay } from '@/lib/zeit';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { updateJson } from '@/lib/store/local-db';
import { aehnlichkeit, BERATUNG } from './pruefer';
import { communityVon } from './daten';
import type { SocialKanal } from './typen';
import type { CommunityDatei, FadenSicht } from './community';

export type AntwortKlasse = 'spam' | 'heikel' | 'kritik' | 'frage' | 'freundlich' | 'sonst';
export const KLASSE_GRUND: Record<AntwortKlasse, string> = {
  spam: 'sieht nach Spam aus (Link, Werbung, „Follow for follow“) — ignorieren oder in Instagram löschen',
  heikel: 'Beratungs-, Preis- oder Geldthema — antwortet ein Mensch',
  kritik: 'Kritik oder Beschwerde — antwortet ein Mensch',
  frage: 'Frage', freundlich: 'freundlicher Kommentar', sonst: 'unklar, worum es geht — ein Mensch schaut drüber',
};
/** Höchstens so viele Fäden je Lauf, Mindestabstand zwischen automatischen Antworten eines Kanals, Ähnlichkeitsgrenze. */
export const LAUF_MAX = 5;
export const ABSTAND_SEK = 90;
export const AEHNLICH_MAX = 0.6;

const enthaelt = (t: string, l: readonly string[]) => l.some(w => t.includes(w));
const SPAM = ['http://', 'https://', 'www.', '.com/', 'follow for follow', 'f4f', 'l4l', 'dm me', 'dm for', 'check my', 'promo', 'gewinnspiel', 'giveaway', 'krypto', 'crypto', 'bitcoin', 'investment', 'onlyfans', 'collab?'];
const GELD = ['preis', 'kosten', 'kostet', 'rabatt', 'gutschein', '€', 'euro', 'zahlen', 'rechnung', 'vertrag', 'price', 'cost', 'discount'];
const KRITIK = ['schlecht', 'enttäusch', 'betrug', 'scam', 'fake', 'schade', 'nervt', 'unverschämt', 'beschwer', 'falsch', 'lüge', 'peinlich', 'schlimm', 'nie wieder', 'worst', 'terrible', 'disappoint', '👎', '😡', '🤮'];
const FREUNDLICH = ['danke', 'super', 'toll', 'cool', 'liebe', 'love', 'great', 'stark', 'wow', 'mega', 'genial', 'klasse', 'schön', 'inspir', 'motivier', '🔥', '❤', '👏', '😍', '💪', '🙌', '👍', '😊'];

/** Worum geht es? (rein, bewusst vorsichtig — im Zweifel „sonst“ = Mensch) */
export function antwortKlasse(text: string): AntwortKlasse {
  const t = text.toLocaleLowerCase('de-DE').trim();
  if (!t) return 'sonst';
  if (enthaelt(t, SPAM) || (t.match(/@[a-z0-9._]+/g)?.length ?? 0) >= 3) return 'spam';
  if (enthaelt(t, GELD) || BERATUNG.some(w => t.includes(w))) return 'heikel';
  if (enthaelt(t, KRITIK)) return 'kritik';
  if (t.includes('?') || /^(wie|was|wo|wann|warum|wieso|weshalb|welche|kannst|könnt|gibt es|hast du|habt ihr|how|what|where|when|why|can you|do you)\b/.test(t)) return 'frage';
  if (enthaelt(t, FREUNDLICH)) return 'freundlich';
  return 'sonst';
}

/** Darf der Agent diesen Faden JETZT selbst beantworten? null = ja, sonst der Grund (dann wird es ein Entwurf). Rein. */
export function autoGrund(k: SocialKanal, f: Pick<FadenSicht, 'art' | 'fensterOffen'>, klasse: AntwortKlasse, o: { heuteSchon: number; letzteAutoMs?: number; jetzt: number }): string | null {
  const c = communityVon(k);
  if (c.modus !== 'auto') return 'Modus „Vorschlag“ — ein Mensch sendet';
  if (k.leitplanken.antwortenAus) return 'Not-Aus: Antworten angehalten';
  if (f.art === 'dm' && !c.dmsAuto) return 'DMs beantwortet ein Mensch (Einstellung)';
  if (f.art === 'dm' && !f.fensterOffen) return 'Die letzte Nachricht ist älter als 24 Stunden';
  if (klasse !== 'frage' && klasse !== 'freundlich') return KLASSE_GRUND[klasse];
  const limit = f.art === 'dm' ? k.leitplanken.dmsProTag : k.leitplanken.antwortenProTag;
  if (o.heuteSchon >= limit) return `Tageslimit erreicht (${limit})`;
  if (o.letzteAutoMs && o.jetzt - o.letzteAutoMs < ABSTAND_SEK * 1000) return 'Mindestabstand zur letzten automatischen Antwort';
  return null;
}

/** Fast gleich wie eine der letzten eigenen Antworten? (rein) */
export function zuAehnlich(text: string, eigene: readonly string[]): boolean {
  return eigene.slice(-30).some(x => aehnlichkeit(text, x) >= AEHNLICH_MAX);
}

/** Die automatische Antwort mit Offenlegung (rein): erste automatische DM eines Gesprächs mit Hinweis-Satz, Kommentare mit Zeichen. */
export function mitHinweis(text: string, k: SocialKanal, f: Pick<FadenSicht, 'art' | 'eintraege'>): string {
  const c = communityVon(k);
  if (f.art === 'dm') return f.eintraege.some(e => e.richtung === 'aus' && e.durch === AGENT) ? text : `${text}\n\n${c.hinweisDm}`;
  return `${text}${c.zeichen}`;
}

/** Kennung, unter der automatische Antworten stehen (`IgEintrag.durch`). */
export const AGENT = 'zoe';

export interface AgentErgebnis { gesendet: number; entwuerfe: number; gestoppt?: string }

/** Ein Lauf über alle Kanäle mit Modus „vorschlag“/„auto“ und Instagram-Verbindung (Takt nach dem Abholen). */
export async function communityAgentLauf(jetzt = new Date()): Promise<AgentErgebnis> {
  const erg: AgentErgebnis = { gesendet: 0, entwuerfe: 0 };
  const { ladeSocial } = await import('./server');
  const { ladeVerbindungen, aktiveVerbindung } = await import('./verbindungen');
  const { ladeCommunity, faedenAus, antwortVorschlag, communityAntworten, communitySpeicher, antwortenHeute, antwortTextPruefen } = await import('./community');
  const social = await ladeSocial();
  const verb = await ladeVerbindungen();
  const kanaele = social.kanaele.filter(k => !k.archiviertAm && k.status === 'aktiv' && communityVon(k).modus !== 'aus' && aktiveVerbindung(verb, k.id, 'instagram'));
  if (!kanaele.length) return erg;
  const { laufSperre } = await import('@/lib/agenten/einstellung');
  const sperre = await laufSperre(null, 'marketing', jetzt).catch(() => ({ text: 'Agenten-Einstellungen nicht lesbar' }));
  if (sperre) return { ...erg, gestoppt: sperre.text };
  const inhaber = await inhaberSpeicher().catch(() => null);
  let d = await ladeCommunity();
  for (const k of kanaele) {
    const person = (k.art === 'person' && k.person) || (k.sichtbarkeit === 'person' && k.person) || inhaber;
    if (!person) continue;
    const offen = faedenAus(d, new Set([k.id]), jetzt.getTime()).filter(f => f.offen).slice(0, 20);
    for (const f of offen) {
      if (erg.gesendet + erg.entwuerfe >= LAUF_MAX) return erg;
      const letzteEin = [...f.eintraege].reverse().find(e => e.richtung === 'ein');
      if (!letzteEin || d.entwuerfe?.[f.id]?.fuer === letzteEin.id) continue; // schon bearbeitet
      const klasse = antwortKlasse(letzteEin.text);
      const eigene = Object.values(d.eintraege).filter(e => e.kanalId === k.id && e.richtung === 'aus').sort((a, b) => a.am.localeCompare(b.am)).map(e => e.text);
      const letzteAuto = Object.values(d.eintraege).filter(e => e.kanalId === k.id && e.durch === AGENT).map(e => Date.parse(e.am)).sort((a, b) => b - a)[0];
      let grund = autoGrund(k, f, klasse, { heuteSchon: antwortenHeute(d, k.id, f.art, localDay(jetzt)), letzteAutoMs: letzteAuto, jetzt: jetzt.getTime() });
      let text = '';
      if (klasse !== 'spam') {
        const v = await antwortVorschlag(person, k, f, 'hintergrund');
        if (!v.ok) { erg.gestoppt = v.fehler; return erg; }
        text = v.text.trim();
        if (!text) grund = 'ZOE hat keine passende Antwort gefunden — ein Mensch schaut drüber';
        else if (!grund && zuAehnlich(text, eigene)) grund = 'zu ähnlich wie eine frühere Antwort (Spam-Schutz) — bitte persönlich formulieren';
        else if (!grund) grund = antwortTextPruefen(text, f.art, k);
      }
      if (!grund && text) {
        const r = await communityAntworten(k.art === 'person' && k.person ? k.person : person, k, f.id, mitHinweis(text, k, f), letzteEin.id, jetzt, AGENT);
        if (r.ok) { erg.gesendet++; d = await ladeCommunity(); continue; }
        grund = r.fehler;
      }
      const entwurf = { fuer: letzteEin.id, text, am: jetzt.toISOString(), grund: grund ?? 'Entwurf' };
      await updateJson<CommunityDatei>(await communitySpeicher(), cur => ({ ...(cur ?? { eintraege: {}, faeden: {} }), entwuerfe: { ...(cur?.entwuerfe ?? {}), [f.id]: entwurf } }));
      d = await ladeCommunity();
      erg.entwuerfe++;
    }
  }
  return erg;
}

