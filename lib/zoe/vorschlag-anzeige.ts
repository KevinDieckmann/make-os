// ─── Freigaben: was ein Vorschlag im Stapel zeigt (rein, client-sicher; Abnahme 14.10., B10) ─────────────────────────────
// Befund: In Heute und im Hintergrund der Agenten standen Einträge wie „Aufgabe aus der Inbox — Frist 15.10.“ mit „Einzelheiten in der
// Inbox“ — worum es geht, war nicht zu erkennen. Regel: JEDER Eintrag zeigt vier Dinge — Titel (was es ist), Was (was die Freigabe
// bewirkt), Wofür (warum ZOE es vorschlägt) und einen Bezug-Link (Gespräch, Aufgabe, Kontakt … oder der Bereich). Ein leerer
// Alt-Eintrag wird lesbar beschriftet, nie leer gezeigt.
// Der gespeicherte Titel bleibt wie er ist (er steht dauerhaft in den ZOE-Entscheidungen — bei Inbox-Vorschlägen bewusst ohne Betreff
// und Namen); Betreff und Absender kommen nur hier, zur Anzeige, aus der Eingabe des Vorschlags (die liegt nur im Stapel, 90 Tage).

import { anlassText } from './stapel-aendern';
import { WEG } from '@/lib/wege';

/** Der Bereich, in den ein Vorschlag ohne eigenen Bezug führt — je Werkzeug-Gruppe (eine Stelle, auch für StapelView). */
export const GRUPPE_WEG: Readonly<Record<string, { text: string; href: string }>> = {
  finanzen: { text: 'Geld', href: '/os/finanzen' },
  meilensteine: { text: 'Meilensteine', href: WEG.jahr() },
  fokus: { text: 'Fokus & Ziele', href: WEG.fokus() },
  aufgaben: { text: 'Aufgaben', href: '/os/aufgaben' },
  kunden: { text: 'Mandate', href: '/os/mandate' },
  planer: { text: 'Planung', href: '/os/kalender?modus=planen' },
  inbox: { text: 'Postfach', href: '/os/inbox' },
  gesundheit: { text: 'Gesundheit', href: '/os/gesundheit' },
  kalender: { text: 'Kalender', href: '/os/kalender' },
};

export interface VorschlagAnzeige {
  /** Was es ist — nie leer. */
  titel: string;
  /** Was die Freigabe bewirkt. */
  was: string;
  /** Wofür bzw. warum ZOE es vorschlägt. */
  wofuer: string;
  /** Sprung zum Bezug (oder zum Bereich) — fehlt nur, wenn es wirklich keinen Ort gibt. */
  link?: { href: string; text: string };
  /** Alt-Eintrag ohne Inhalt — lesbar beschriftet. */
  leer?: true;
  /** Erfundenes Beispiel der Demo-Instanz (15.10., lib/demo/beispiel.ts) — die Oberfläche zeigt den Chip „Beispiel“. */
  beispiel?: true;
}

/** Was die Anzeige von einem Vorschlag braucht (Server-Form `Vorschlag` und Browser-Form passen beide). */
export interface VorschlagFuerAnzeige {
  titel?: unknown; nachher?: unknown; vorher?: unknown; anlass?: unknown; quelle?: 'gespraech' | 'lauf';
  eingabe?: Record<string, unknown> | null; bezug?: { art: string; id: string } | null; werkzeug?: unknown; gruppe?: unknown; beispiel?: unknown;
}

const text = (x: unknown): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');
const kurz = (t: string, n = 160): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const tagKurz = (d: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.` : d);
/** Die Werkzeug-Kennung lesbar („crm_vorschlag“ → „crm vorschlag“) — nur für Alt-Einträge ohne Titel. */
const werkzeugName = (w: unknown): string => text(w).replace(/[_-]+/g, ' ');

/** Absender aus der ersten Zeile der Aufgaben-Beschreibung („Aus der Inbox · Name <adresse>“ bzw. „Aus WhatsApp · …“). */
function herkunftAus(beschreibung: string): string {
  const erste = beschreibung.split('\n')[0]?.trim() ?? '';
  const mail = /^Aus der Inbox · (.+)$/.exec(erste);
  if (mail) { const name = mail[1].replace(/\s*<[^>]*>\s*$/, '').trim(); return `Mail von ${name || mail[1].replace(/[<>]/g, '').trim()}`; }
  const wa = /^Aus WhatsApp · (.+)$/.exec(erste);
  return wa ? `WhatsApp von ${wa[1].trim()}` : '';
}

/** Der Bezug-Link je Art — nur Pfade aus `WEG` bzw. die Inbox-Adresse; ohne Bezug der Bereich der Gruppe. */
function linkVon(v: VorschlagFuerAnzeige): VorschlagAnzeige['link'] {
  const e = v.eingabe ?? {};
  const b = v.bezug;
  if (b?.art === 'inbox' && typeof e.gespraech === 'string' && e.gespraech) return { href: `/os/inbox?offen=${encodeURIComponent(e.gespraech)}`, text: 'Zum Gespräch' };
  if (b?.art === 'aufgabe' && b.id) return { href: WEG.aufgabe(b.id), text: 'Zur Aufgabe' };
  if (typeof e.kontaktId === 'string' && e.kontaktId) return { href: WEG.kontakt(e.kontaktId), text: 'Zum Kontakt' };
  if (typeof e.dealId === 'string' && e.dealId) return { href: WEG.deal(e.dealId), text: 'Zum Deal' };
  const g = GRUPPE_WEG[text(v.gruppe)];
  return g ? { href: g.href, text: `Zu ${g.text}` } : undefined;
}

/** Die vier Angaben eines Vorschlags für jede Freigaben-Liste (Heute, Agenten › Hintergrund, Freigaben-Seite). Rein. */
export function vorschlagAnzeige(v: VorschlagFuerAnzeige): VorschlagAnzeige {
  const a = vorschlagAnzeigeOhneMarke(v);
  return v.beispiel === true ? { ...a, beispiel: true } : a;
}

function vorschlagAnzeigeOhneMarke(v: VorschlagFuerAnzeige): VorschlagAnzeige {
  const titel0 = text(v.titel), nachher = text(v.nachher), vorher = text(v.vorher);
  const link = linkVon(v);
  const grund = anlassText({ anlass: typeof v.anlass === 'string' ? v.anlass : null, ...(v.quelle ? { quelle: v.quelle } : {}), bezug: v.bezug ?? undefined });

  // Aufgabe aus einer Nachricht (Inbox): Titel = die vorbereitete Aufgabe (Betreff), Wofür = Absender + was erkannt wurde.
  if (v.bezug?.art === 'inbox') {
    const a = v.eingabe?.aufgabe && typeof v.eingabe.aufgabe === 'object' ? v.eingabe.aufgabe as Record<string, unknown> : {};
    const aufgabe = text(a.title);
    const faellig = typeof a.dueDate === 'string' ? a.dueDate : '';
    const von = herkunftAus(typeof a.description === 'string' ? a.description : '');
    const anlass = text(v.anlass);
    return {
      titel: aufgabe ? kurz(aufgabe, 120) : titel0 || 'Aufgabe aus einer Nachricht',
      was: `Legt die Aufgabe an${faellig ? ` · fällig ${tagKurz(faellig)}` : ''} — mit Link zurück ins Gespräch.`,
      wofuer: kurz([von, anlass].filter(Boolean).join(' — ') || 'In einer Nachricht erkannt (ohne KI).'),
      ...(link ? { link } : {}),
    };
  }

  const leer = !titel0 && !nachher;
  const titel = titel0 || (nachher ? kurz(nachher, 120) : `Älterer Vorschlag ohne Beschreibung${werkzeugName(v.werkzeug) ? ` (${werkzeugName(v.werkzeug)})` : ''}`);
  const was = leer
    ? 'Was die Freigabe bewirkt, ist in diesem älteren Eintrag nicht gespeichert — im Zweifel ablehnen.'
    : nachher && nachher !== titel0 ? kurz(vorher ? `${vorher} → ${nachher}` : nachher) : vorher ? kurz(`${vorher} → ${titel}`) : 'Übernimmt den Vorschlag so, wie er hier steht.';
  const wofuer = grund ? kurz(grund) : v.quelle === 'lauf' ? 'ZOE hat es in einem Hintergrundlauf vorbereitet.' : 'ZOE hat keinen Grund genannt.';
  return { titel, was, wofuer, ...(link ? { link } : {}), ...(leer ? { leer: true as const } : {}) };
}
