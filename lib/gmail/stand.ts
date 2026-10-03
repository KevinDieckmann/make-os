// ─── Gmail — Bestand je Person (Server, 03.10.2026) ──────────────────────────
// Je Person ZWEI verschlüsselte Bestände (lib/store/local-db.ts, wie jeder Bestand):
//   `gmail-stand--<person>`  Köpfe (Von/An/Cc/Betreff/Datum/Message-ID/Thread/Labels/Anhang-Metadaten) + Zustand des Abgleichs
//   `gmail-text--<person>`   Textkörper (reiner Text, nie HTML) — getrennt, damit die Liste nie die Texte mitliest
// Das Ganze ist ein SPIEGEL — Wahrheit ist Gmail. Aufbewahrung: Frist „Mail-Spiegel“ (Standard 180 Tage, Löschfristen), dazu
// höchstens `koepfeMax` Nachrichten je Person (die ältesten fallen zuerst). Art. 15/17: Köpfe und Texte, die eine Person nennen,
// fallen mit ihr weg (lib/crm/person-weitere.ts); das Original bleibt bei Google (Hinweis in der Auskunft).
// Kein Bestand einer Person ist je für eine andere lesbar: der Name trägt die Person, die Routen lesen nur die eigene.
// Neu und optional: ein Rückweg auf den alten Online-Stand liest diese Bestände nie.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { GMAIL_GRENZEN, PERSON_OK, gmailStandName, gmailTextName, type GmailKopf, type GmailStand, type GmailTexte } from './typen';

export async function ladeGmailStand(person: string): Promise<GmailStand | null> {
  if (!PERSON_OK.test(person)) return null;
  const s = await loadJson<GmailStand>(gmailStandName(person));
  return s && s.v === 1 && s.koepfe && typeof s.koepfe === 'object' && typeof s.email === 'string' ? s : null;
}

export async function ladeGmailTexte(person: string): Promise<GmailTexte> {
  if (!PERSON_OK.test(person)) return { v: 1, texte: {} };
  const t = await loadJson<GmailTexte>(gmailTextName(person));
  return t && t.v === 1 && t.texte && typeof t.texte === 'object' ? t : { v: 1, texte: {} };
}

/** Stand ändern (serialisiert). Ohne Bestand: nichts (`null`) — angelegt wird nur mit `setzeGmailStand`. */
export async function aendereGmailStand(person: string, mutate: (s: GmailStand) => GmailStand | null): Promise<GmailStand | null> {
  if (!PERSON_OK.test(person) || !(await ladeGmailStand(person))) return null;
  let ergebnis: GmailStand | null = null;
  await updateJson<GmailStand | { v: 0 } | null>(gmailStandName(person), cur => {
    const s = cur && (cur as GmailStand).v === 1 ? cur as GmailStand : null;
    if (!s) return cur as null;
    const neu = mutate(s);
    if (!neu) return cur as GmailStand;
    ergebnis = neu;
    return neu;
  });
  return ergebnis;
}

export async function setzeGmailStand(person: string, s: GmailStand): Promise<void> {
  if (!PERSON_OK.test(person)) return;
  await updateJson<GmailStand>(gmailStandName(person), () => s);
}

/** Texte ändern (serialisiert). */
export async function aendereGmailTexte(person: string, mutate: (t: GmailTexte) => GmailTexte): Promise<void> {
  if (!PERSON_OK.test(person)) return;
  await updateJson<GmailTexte>(gmailTextName(person), cur => mutate(cur && cur.v === 1 && cur.texte ? cur : { v: 1, texte: {} }));
}

/** Leeren: Grabstein statt Löschen (die Datenschicht kennt kein Löschen) — Köpfe und Texte sind weg, nichts bleibt hängen. */
export async function leereGmail(person: string): Promise<void> {
  if (!PERSON_OK.test(person)) return;
  await updateJson<unknown>(gmailStandName(person), () => ({ v: 0, getrenntAm: new Date().toISOString() }));
  await updateJson<unknown>(gmailTextName(person), () => ({ v: 0, getrenntAm: new Date().toISOString() }));
}

/** Die Adressen einer Nachricht als ein Text (für Art. 15/17 im Textbestand). */
export const adressenText = (k: Pick<GmailKopf, 'von' | 'an' | 'cc'>): string => [k.von, ...k.an, ...k.cc].map(a => a.email).join(', ');

/**
 * Aufbewahren (rein): Nachrichten vor der Grenze (`grenzeTag`, YYYY-MM-DD) fallen weg, danach höchstens `koepfeMax` (die
 * neuesten bleiben). Liefert die Kennungen, die wegfallen — der Aufrufer räumt die Texte mit.
 */
export function aufbewahren(koepfe: Record<string, GmailKopf>, grenzeTag: string, max: number = GMAIL_GRENZEN.koepfeMax): { rest: Record<string, GmailKopf>; weg: string[] } {
  const alle = Object.values(koepfe).sort((a, b) => b.am.localeCompare(a.am));
  const weg: string[] = [];
  const rest: Record<string, GmailKopf> = {};
  alle.forEach((k, i) => { if (k.am.slice(0, 10) < grenzeTag || i >= max) weg.push(k.id); else rest[k.id] = k; });
  return { rest, weg };
}

/** Texte auf die Kennungen der Köpfe beschränken. */
export const texteOhne = (t: GmailTexte, weg: readonly string[]): GmailTexte => {
  if (!weg.length) return t;
  const w = new Set(weg);
  return { v: 1, texte: Object.fromEntries(Object.entries(t.texte).filter(([id]) => !w.has(id))) };
};

/** Alle Nachrichten eines Threads, älteste zuerst. */
export const threadVon = (koepfe: Record<string, GmailKopf>, threadId: string): GmailKopf[] =>
  Object.values(koepfe).filter(k => k.threadId === threadId).sort((a, b) => a.am.localeCompare(b.am));

export const istUngelesen = (k: Pick<GmailKopf, 'labels'>): boolean => k.labels.includes('UNREAD');
export const imPosteingang = (k: Pick<GmailKopf, 'labels'>): boolean => k.labels.includes('INBOX');
export const istGesendet = (k: Pick<GmailKopf, 'labels'>): boolean => k.labels.includes('SENT');
