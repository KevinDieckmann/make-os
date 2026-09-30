// ─── MAKE OS — Austausch am Meilenstein: Verlauf, Notiz, Links (rein, 30.09.) ─
// Kevin (30.09.): „Wir müssen dort Informationen teilen können … ein Chat mit Kommentarfunktion für mich und Malin.“
// Bestand `meilenstein-raum--<haushalt>` (lib/planung/meilenstein-raum-server.ts): je Meilenstein ein Raum mit
//   · nachrichten — dieselbe Form wie die Kommentare der Aufgaben (`AufgabeKommentar`: id, von, text, am, erwaehnt,
//     weich `entfernt`) plus `antwortAuf` (Antwort auf eine Nachricht), `bearbeitetAm` und `zoe` (von ZOE, gekennzeichnet).
//     Regeln wie bei den Kommentaren: neue tragen Person + Serverzeit, fremde sind unveränderlich, eigene dürfen
//     bearbeitet und nur WEICH entfernt werden (die Absprache bleibt belegbar). Erwähnungen rechnet der Server aus dem Text.
//   · notiz — Ziel, Hintergrund, Entscheidungen (beide bearbeiten; `stand` = Zeitpunkt der letzten Änderung → 409),
//     dazu ein kurzer Verlauf (wer, wann, wie lang — nie der Text).
//   · links — http(s)-Links mit Titel.
// Grenzen: darüber 413, nie gekürzt. Dateien liegen in der Aufgaben-Ablage (lib/dateien/aufgaben-ablage.ts) an der
// Liste des Meilensteins (`listeId`).

import type { AufgabeKommentar } from '@/types/tasks';
import { erwaehnungen } from '@/lib/aufgaben/struktur';

export const RAUM_PRAEFIX = 'meilenstein-raum--';

export const RAUM_GRENZEN = {
  /** Zeichen je Nachricht (wie Kommentare). */
  text: 4000,
  /** Nachrichten je Meilenstein. */
  nachrichten: 2000,
  /** Zeichen der Notiz (wie die Notizen der Aufgaben). */
  notiz: 50_000,
  links: 200,
  url: 2000,
  linkTitel: 200,
  /** Einträge im Notiz-Verlauf (ältere fallen als „+n ältere“ weg — reine Metadaten, kein Inhalt). */
  notizVerlauf: 100,
  /** Räume je Haushalt (= höchstens so viele Meilensteine, siehe Route). */
  raeume: 500,
} as const;

export interface RaumNachricht extends AufgabeKommentar {
  /** Antwort auf diese Nachricht (Kennung). */
  antwortAuf?: string;
  /** Zuletzt bearbeitet (nur die Verfasserin). */
  bearbeitetAm?: string;
  /** Von ZOE (vorgesehen für „ZOE: zusammenfassen“, noch nicht gebaut) — `von` wäre die auslösende Person; unveränderlich. */
  zoe?: true;
}
export interface RaumLink { id: string; url: string; titel: string; von: string; am: string }
export interface RaumNotiz { text: string; am: string; von: string }
export interface Raum {
  nachrichten: RaumNachricht[];
  notiz?: RaumNotiz;
  notizVerlauf?: { am: string; von: string; zeichen: number }[];
  links?: RaumLink[];
}
export interface RaumDatei { raeume: Record<string, Raum> }

export const leererRaum = (): Raum => ({ nachrichten: [] });

export type RaumAktion =
  | { art: 'senden'; text: string; antwortAuf?: string }
  | { art: 'bearbeiten'; id: string; text: string }
  | { art: 'entfernen'; id: string }
  | { art: 'notiz'; text: string; stand: string | null }
  | { art: 'link'; url: string; titel?: string }
  | { art: 'link-entfernen'; id: string };

export type RaumErgebnis =
  | { ok: true; raum: Raum; neu?: RaumNachricht; erwaehnt: string[]; antwortAn?: string }
  | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const ohneSteuer = (t: string) => t.replace(/\u0000/g, '');

/** Aktion aus dem Netz lesen — null, wenn sie keine gültige Form hat (→ 400). Längen prüft `anwenden` (→ 413). */
export function aktionLesen(o: unknown): RaumAktion | null {
  if (!o || typeof o !== 'object') return null;
  const a = o as Record<string, unknown>;
  const text = typeof a.text === 'string' ? ohneSteuer(a.text) : undefined;
  const id = typeof a.id === 'string' && KENNUNG.test(a.id) ? a.id : undefined;
  switch (a.art) {
    case 'senden': return text !== undefined ? { art: 'senden', text, ...(typeof a.antwortAuf === 'string' && KENNUNG.test(a.antwortAuf) ? { antwortAuf: a.antwortAuf } : {}) } : null;
    case 'bearbeiten': return id && text !== undefined ? { art: 'bearbeiten', id, text } : null;
    case 'entfernen': return id ? { art: 'entfernen', id } : null;
    case 'notiz': return text !== undefined ? { art: 'notiz', text, stand: typeof a.stand === 'string' ? a.stand : null } : null;
    case 'link': return typeof a.url === 'string' ? { art: 'link', url: a.url.trim(), ...(typeof a.titel === 'string' ? { titel: ohneSteuer(a.titel) } : {}) } : null;
    case 'link-entfernen': return id ? { art: 'link-entfernen', id } : null;
    default: return null;
  }
}

/** Nur http(s) — alles andere (javascript:, data:, Dateipfade) lehnt der Server ab. */
export function linkGueltig(url: string): boolean {
  if (url.length > RAUM_GRENZEN.url) return false;
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
}

/** Stand der Notiz (für 409): der Zeitpunkt der letzten Änderung, ohne Notiz „leer“. */
export const notizStand = (r: Raum): string => r.notiz?.am ?? 'leer';

/**
 * Eine Aktion auf einen Raum anwenden (rein). `person` = schreibende Person (Pflicht), `kennung` für neue Einträge,
 * `personen` = Haushalt (Speichername + Namen) für die Erwähnungen.
 */
export function anwenden(raum: Raum, a: RaumAktion, person: string, jetzt: string, kennung: () => string, personen: readonly { speicher: string; namen: readonly string[] }[]): RaumErgebnis {
  const r: Raum = { ...raum, nachrichten: [...raum.nachrichten] };
  const zuLang = (n: number, max: number, was: string) => ({ ok: false as const, status: 413 as const, fehler: `Abgelehnt: ${was} hat ${n} Zeichen — höchstens ${max}. Nichts gespeichert.` });
  if (a.art === 'senden' || a.art === 'bearbeiten') {
    const text = a.text.trim();
    if (!text) return { ok: false, status: 400, fehler: 'Leere Nachricht.' };
    if (text.length > RAUM_GRENZEN.text) return zuLang(text.length, RAUM_GRENZEN.text, 'Die Nachricht');
    const erwaehnt = erwaehnungen(text, personen).filter(p => p !== person);
    if (a.art === 'senden') {
      if (r.nachrichten.length >= RAUM_GRENZEN.nachrichten) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${RAUM_GRENZEN.nachrichten} Nachrichten je Meilenstein. Nichts gespeichert.` };
      const bezug = a.antwortAuf ? r.nachrichten.find(n => n.id === a.antwortAuf) : undefined;
      if (a.antwortAuf && !bezug) return { ok: false, status: 404, fehler: 'Die Nachricht, auf die du antwortest, gibt es nicht (mehr).' };
      const neu: RaumNachricht = { id: kennung(), von: person, text, am: jetzt, ...(erwaehnt.length ? { erwaehnt } : {}), ...(bezug ? { antwortAuf: bezug.id } : {}) };
      r.nachrichten.push(neu);
      return { ok: true, raum: r, neu, erwaehnt, ...(bezug && bezug.von !== person && !bezug.zoe ? { antwortAn: bezug.von } : {}) };
    }
    const i = r.nachrichten.findIndex(n => n.id === a.id);
    if (i < 0) return { ok: false, status: 404, fehler: 'Diese Nachricht gibt es nicht (mehr).' };
    const alt = r.nachrichten[i];
    // Fremde Nachrichten (und ZOE-Nachrichten) sind unveränderlich — wie die Kommentare der Aufgaben.
    if (alt.von !== person || alt.zoe) return { ok: false, status: 403, fehler: 'Nur eigene Nachrichten lassen sich bearbeiten.' };
    if (alt.entfernt) return { ok: false, status: 409, fehler: 'Diese Nachricht ist entfernt.' };
    const neuErwaehnt = erwaehnt.filter(p => !(alt.erwaehnt ?? []).includes(p));
    const n: RaumNachricht = { ...alt, text, bearbeitetAm: jetzt, ...(erwaehnt.length ? { erwaehnt } : {}) };
    if (!erwaehnt.length) delete n.erwaehnt;
    r.nachrichten[i] = n;
    return { ok: true, raum: r, erwaehnt: neuErwaehnt };
  }
  if (a.art === 'entfernen') {
    const i = r.nachrichten.findIndex(n => n.id === a.id);
    if (i < 0) return { ok: false, status: 404, fehler: 'Diese Nachricht gibt es nicht (mehr).' };
    const alt = r.nachrichten[i];
    // ZOE-Nachrichten darf die auslösende Person entfernen; sonst nur eigene. Immer weich.
    if (alt.von !== person) return { ok: false, status: 403, fehler: 'Nur eigene Nachrichten lassen sich entfernen.' };
    if (!alt.entfernt) r.nachrichten[i] = { ...alt, entfernt: { am: jetzt, von: person } };
    return { ok: true, raum: r, erwaehnt: [] };
  }
  if (a.art === 'notiz') {
    if (a.text.length > RAUM_GRENZEN.notiz) return zuLang(a.text.length, RAUM_GRENZEN.notiz, 'Die Notiz');
    if (a.stand !== notizStand(raum)) return { ok: false, status: 409, fehler: 'Die Notiz wurde inzwischen geändert — der aktuelle Stand ist geladen.' };
    if ((raum.notiz?.text ?? '') === a.text) return { ok: true, raum, erwaehnt: [] };
    r.notiz = { text: a.text, am: jetzt, von: person };
    const v = [...(raum.notizVerlauf ?? []), { am: jetzt, von: person, zeichen: a.text.length }];
    r.notizVerlauf = v.slice(-RAUM_GRENZEN.notizVerlauf);
    return { ok: true, raum: r, erwaehnt: [] };
  }
  if (a.art === 'link') {
    if (!linkGueltig(a.url)) return { ok: false, status: a.url.length > RAUM_GRENZEN.url ? 413 : 400, fehler: 'Nur Links mit http:// oder https:// (höchstens 2000 Zeichen).' };
    const titel = (a.titel ?? '').trim();
    if (titel.length > RAUM_GRENZEN.linkTitel) return zuLang(titel.length, RAUM_GRENZEN.linkTitel, 'Der Titel');
    const links = raum.links ?? [];
    if (links.length >= RAUM_GRENZEN.links) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${RAUM_GRENZEN.links} Links je Meilenstein.` };
    r.links = [...links, { id: kennung(), url: a.url, titel: titel || a.url, von: person, am: jetzt }];
    return { ok: true, raum: r, erwaehnt: [] };
  }
  // link-entfernen: beide dürfen (geteilte Linkliste, wie Dateien).
  const links = raum.links ?? [];
  if (!links.some(l => l.id === a.id)) return { ok: false, status: 404, fehler: 'Diesen Link gibt es nicht (mehr).' };
  r.links = links.filter(l => l.id !== a.id);
  return { ok: true, raum: r, erwaehnt: [] };
}

/** Die Sicht für den Browser: sichtbare Texte entfernter Nachrichten gehen nicht hinaus. */
export function raumFuerBrowser(r: Raum): Raum & { notizStand: string } {
  return { ...r, nachrichten: r.nachrichten.map(n => (n.entfernt ? { ...n, text: '' } : n)), notizStand: notizStand(r) };
}
