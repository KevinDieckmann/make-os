// ─── Postfächer — der IMAP-Spiegel je Person × Postfach (Server, 06.10.2026) ──────────────────────────────────────
// Zwei Bestände je Person (verschlüsselte Hülle), in denen jedes Postfach seinen eigenen Abschnitt hat:
//   `imap-stand--<person>`  Köpfe (gleiche Form wie Gmail: Von/An/Cc/Betreff/Datum/Message-ID/References/Ausschnitt/Anhang-Metadaten
//                           + Postfach, Ordner, UIDVALIDITY, UID) und der Zustand des Abgleichs je Postfach
//   `imap-text--<person>`   Textkörper (nur Text, nie HTML), getrennt, damit die Liste nie Texte liest
// Wahrheit ist das Postfach beim Anbieter. Stabile Kennung je Nachricht: `<postfach>:<ordner>:<UIDVALIDITY>:<UID>` (ändert der Server
// UIDVALIDITY, wird der Abschnitt dieses Ordners verworfen und neu gelesen) + Message-ID für das Gespräch (References/In-Reply-To).
// Aufbewahrung: Frist „Mail-Spiegel“ (wie Gmail, Standard 180 Tage) und höchstens `koepfeMax` je Postfach. „Trennen“ löscht den Abschnitt.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { GmailKopf } from '@/lib/gmail/typen';
import { POSTFACH_GRENZEN, PERSON_OK, imapStandName, imapTextName } from './typen';

export type OrdnerArt = 'e' | 'g' | 'a';
export const ORDNER_WORT: Record<OrdnerArt, 'posteingang' | 'gesendet' | 'archiv'> = { e: 'posteingang', g: 'gesendet', a: 'archiv' };

/** Ein IMAP-Kopf: die Gmail-Form (damit Zuordnung, Liste, Antworten EINE Regel haben) + die IMAP-Stellen. */
export interface ImapKopf extends GmailKopf {
  postfachId: string;
  ordner: OrdnerArt;
  uidValidity: string;
  uid: number;
  /** Automatische Nachricht (Abwesenheit, Zustellbericht) — zählt nie als Antwort. */
  automatisch?: boolean;
  /** Der Wurzel-Bezug fürs Gespräch: erste References, sonst In-Reply-To, sonst die eigene Message-ID. */
  wurzel: string;
}

export interface PostfachSync {
  ordner: Partial<Record<'e' | 'g', { pfad: string; uidValidity: string }>>;
  /** Erster Tag des Fensters (Erstabgleich: heute − 30). */
  fensterAb?: string;
  at?: string;
  fehler?: string;
  fehlerAt?: string;
  fehlerAnmeldung?: boolean;
  fehlerFolge?: number;
  pauseBis?: string;
  getrenntGemeldet?: boolean;
  zuletzt?: { neu: number; geaendert: number; entfernt: number };
  /** IDLE-Wächter läuft (vom Prozess gemeldet; nur Anzeige). */
  idleSeit?: string;
}

export interface ImapStand { v: 1; person: string; postfaecher: Record<string, PostfachSync>; koepfe: Record<string, ImapKopf> }
export interface ImapTexte { v: 1; texte: Record<string, { adressen: string; t: string }> }

export const kopfId = (postfach: string, o: OrdnerArt, uidValidity: string, uid: number) => `${postfach}:${o}:${uidValidity}:${uid}`;
export const IMAP_ID = /^pf-[0-9a-f-]{36}:[ega]:\d{1,20}:\d{1,10}$/;

const leer = (person: string): ImapStand => ({ v: 1, person, postfaecher: {}, koepfe: {} });

export async function ladeImapStand(person: string): Promise<ImapStand> {
  if (!PERSON_OK.test(person)) return leer(person);
  const s = await loadJson<ImapStand>(imapStandName(person));
  return s && s.v === 1 && s.koepfe && s.postfaecher ? s : leer(person);
}

export async function ladeImapTexte(person: string): Promise<ImapTexte> {
  if (!PERSON_OK.test(person)) return { v: 1, texte: {} };
  const t = await loadJson<ImapTexte>(imapTextName(person));
  return t && t.v === 1 && t.texte ? t : { v: 1, texte: {} };
}

/** Stand ändern (serialisiert). `mutate` liefert den neuen Stand oder `null` (= nichts ändern). */
export async function aendereImapStand(person: string, mutate: (s: ImapStand) => ImapStand | null): Promise<ImapStand> {
  let ergebnis: ImapStand = leer(person);
  await updateJson<ImapStand>(imapStandName(person), cur => {
    const s = cur && cur.v === 1 && cur.koepfe ? cur : leer(person);
    const neu = mutate(s);
    ergebnis = neu ?? s;
    return neu ?? s;
  });
  return ergebnis;
}

export async function aendereImapTexte(person: string, mutate: (t: ImapTexte) => ImapTexte): Promise<void> {
  await updateJson<ImapTexte>(imapTextName(person), cur => mutate(cur && cur.v === 1 && cur.texte ? cur : { v: 1, texte: {} }));
}

/** Köpfe eines Postfachs. Rein. */
export const koepfeVon = (s: ImapStand, postfach: string): ImapKopf[] => Object.values(s.koepfe).filter(k => k.postfachId === postfach);

/**
 * Aufbewahren (rein): je Postfach Nachrichten vor `grenzeTag` weg, danach höchstens `max` (die neuesten bleiben).
 * Liefert die Kennungen, die wegfallen — der Aufrufer räumt die Texte mit.
 */
export function imapAufbewahren(koepfe: Record<string, ImapKopf>, grenzeTag: string, max: number = POSTFACH_GRENZEN.koepfeMax): { rest: Record<string, ImapKopf>; weg: string[] } {
  const je = new Map<string, ImapKopf[]>();
  for (const k of Object.values(koepfe)) { const l = je.get(k.postfachId); if (l) l.push(k); else je.set(k.postfachId, [k]); }
  const rest: Record<string, ImapKopf> = {};
  const weg: string[] = [];
  for (const l of je.values()) {
    l.sort((a, b) => b.am.localeCompare(a.am)).forEach((k, i) => { if (k.am.slice(0, 10) < grenzeTag || i >= max) weg.push(k.id); else rest[k.id] = k; });
  }
  return { rest, weg };
}

/** Ein Postfach aus dem Spiegel nehmen (Trennen): Köpfe, Texte, Zustand. */
export async function spiegelEntfernen(person: string, postfach: string): Promise<number> {
  let weg: string[] = [];
  await aendereImapStand(person, s => {
    weg = koepfeVon(s, postfach).map(k => k.id);
    const koepfe = Object.fromEntries(Object.entries(s.koepfe).filter(([, k]) => k.postfachId !== postfach));
    const { [postfach]: _alt, ...postfaecher } = s.postfaecher;
    return { ...s, koepfe, postfaecher };
  });
  if (weg.length) { const w = new Set(weg); await aendereImapTexte(person, t => ({ v: 1, texte: Object.fromEntries(Object.entries(t.texte).filter(([id]) => !w.has(id))) })); }
  return weg.length;
}
