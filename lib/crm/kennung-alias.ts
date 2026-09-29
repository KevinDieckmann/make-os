// ─── Weiterleitung alter Kontakt-Kennungen (29.09., Paket D-C #35/#33) ────────
// Der Kennungs-Umzug (lib/crm/kennungen-umzug.ts) gibt jedem Kontakt mit alter Kennung (`c-<mail>-<hash>`,
// `c-neu-<zeit>`) eine zufällige (`c-<uuid>`). Links, die draußen weiterleben — Notizen im Vault, Lesezeichen,
// geteilte Adressen (`kontaktAkte`, `WEG.akte/kontakt`, `?k=`, `?kontakt=`) —, zeigen danach auf die alte Kennung.
// Diese Tabelle `kennung-alias--<haushalt>` (verschlüsselt über local-db) hält alt → neu; `app/os/markttraktion/page.tsx`
// leitet damit weiter, der Rückweg des Umzugs kehrt sie um.
//
// Datenschutz: die alte Kennung trägt die E-Mail-Adresse — Art. 17 nimmt die Einträge der Person heraus
// (`aliasOhnePerson`, aufgerufen aus `personEntfernen`); ihre alten Kennungen bekommen vorher einen eigenen Grabstein.
// Keine Frist: Links in Notizen leben lange; die Tabelle wächst nur mit dem Altbestand (einmalig).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { karteiHaushalt } from './sperrliste';

export const aliasName = (haushalt: string): string => {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error('Unzulässiger Haushalt.');
  return `kennung-alias--${haushalt}`;
};

export interface AliasEintrag {
  alt: string;
  neu: string;
  /** Kennung des Umzugs (Absicht), der den Eintrag anlegte. */
  umzug: string;
  am: string;
}
export interface UmzugVermerk {
  id: string;
  /** Fehlt = Umzug (Altbestand). Ein Rückweg bekommt einen eigenen Vermerk. */
  art?: 'umzug' | 'rueckweg';
  am: string;
  person: string;
  anzahl: number;
  status: 'laeuft' | 'fertig' | 'zurueck';
  /** Archivkopie vor dem Umzug (lib/store/archiv.ts). */
  archiv?: string;
  /** Fingerabdruck je NEUER Kennung direkt nach dem Umzug — der Rückweg prüft damit „seitdem geändert?“. */
  abdruecke?: Record<string, string>;
  zurueck?: { am: string; von: string };
}
export interface AliasDatei { eintraege: AliasEintrag[]; umzuege?: UmzugVermerk[] }

// ── Rein ─────────────────────────────────────────────────────────────────────

/** alt → neu über die ganze Kette (alt → zwischen → neu), ohne Kreis. null = kein Eintrag. */
export function aliasFolgen(eintraege: readonly AliasEintrag[], id: string): string | null {
  const nach = new Map(eintraege.map(e => [e.alt, e.neu]));
  let x = id;
  const gesehen = new Set<string>([x]);
  while (nach.has(x)) {
    const n = nach.get(x)!;
    if (gesehen.has(n)) return null; // Kreis (darf nie entstehen) → lieber nicht weiterleiten
    gesehen.add(n);
    x = n;
  }
  return x === id ? null : x;
}

/** Alle alten Kennungen, die (auch über Zwischenschritte) auf `id` zeigen. */
export function alteKennungen(eintraege: readonly AliasEintrag[], id: string): string[] {
  const raus: string[] = [];
  let rand = [id];
  const gesehen = new Set(rand);
  while (rand.length) {
    const naechste = eintraege.filter(e => rand.includes(e.neu) && !gesehen.has(e.alt)).map(e => e.alt);
    for (const a of naechste) { gesehen.add(a); raus.push(a); }
    rand = naechste;
  }
  return raus;
}

/** Einträge ohne die Person (alt oder neu = eine ihrer Kennungen). */
export function aliasOhne(d: AliasDatei, ids: readonly string[]): { datei: AliasDatei; n: number } {
  const weg = new Set(ids);
  const eintraege = d.eintraege.filter(e => !weg.has(e.alt) && !weg.has(e.neu));
  const n = d.eintraege.length - eintraege.length;
  // Fingerabdrücke der Person aus den Umzugs-Vermerken (Rückweg-Prüfung) — sonst verriete der Schlüssel nichts, aber er
  // wäre ein Verweis auf eine gelöschte Kennung.
  let m = 0;
  const umzuege = (d.umzuege ?? []).map(u => {
    if (!u.abdruecke || !ids.some(i => i in u.abdruecke!)) return u;
    const abdruecke = Object.fromEntries(Object.entries(u.abdruecke).filter(([k]) => !weg.has(k)));
    m++;
    return { ...u, abdruecke };
  });
  return { datei: n || m ? { ...d, eintraege, umzuege } : d, n: n + m };
}

// ── Speicher ─────────────────────────────────────────────────────────────────

export async function aliasLaden(haushalt?: string): Promise<AliasDatei> {
  const d = await loadJson<AliasDatei>(aliasName(haushalt ?? await karteiHaushalt()));
  return { eintraege: Array.isArray(d?.eintraege) ? d!.eintraege : [], ...(Array.isArray(d?.umzuege) ? { umzuege: d!.umzuege } : {}) };
}

/**
 * Eine Kontakt-Kennung auflösen (Weiterleitung alter Links) — nach einem Umzug alt → neu, nach einem Rückweg neu → alt.
 * Nachgeschlagen wird nur, was wie eine Kontakt-Kennung aussieht; liegt kein Eintrag vor, bleibt es bei null.
 */
export async function kennungAufloesen(id: string | null | undefined): Promise<string | null> {
  if (!id || !/^c-[a-z0-9-]{1,62}$/.test(id)) return null;
  try { return aliasFolgen((await aliasLaden()).eintraege, id); }
  catch { return null; } // Weiterleitung ist Komfort — ein unlesbarer Bestand darf keine Seite brechen
}

/** Alte Kennungen einer (neuen) Kennung — für Grabsteine bei Art. 17. */
export async function alteKennungenVon(id: string): Promise<string[]> {
  try { return alteKennungen((await aliasLaden()).eintraege, id); }
  catch { return []; }
}

/** Art. 17: alle Einträge der Person (alte und neue Kennung) entfernen. Liefert die Zahl. Legt nie einen Bestand an. */
export async function aliasOhnePerson(ids: readonly string[]): Promise<number> {
  const name = aliasName(await karteiHaushalt());
  if ((await loadJson<AliasDatei>(name)) === null) return 0;
  let n = 0;
  await updateJson<AliasDatei>(name, cur => {
    const r = aliasOhne({ eintraege: cur?.eintraege ?? [], ...(cur?.umzuege ? { umzuege: cur.umzuege } : {}) }, ids);
    n = r.n;
    return r.n ? r.datei : (cur ?? { eintraege: [] });
  });
  return n;
}

/**
 * Weiterleitung einer Markttraktion-Adresse (`?k=`, `?kontakt=`): trägt sie eine umgezogene Kontakt-Kennung, liefert
 * die Funktion dieselbe Adresse mit der neuen Kennung (alle übrigen Parameter bleiben) — sonst null. `aufloesen` ist
 * im Betrieb `kennungAufloesen`, im Test eine Tabelle.
 */
export async function aliasWeiterleitung(pfad: string, params: Record<string, string | string[] | undefined>, aufloesen: (id: string) => Promise<string | null> = kennungAufloesen): Promise<string | null> {
  const q = new URLSearchParams();
  let anders = false;
  for (const [k, v] of Object.entries(params)) {
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) {
      const neu = (k === 'k' || k === 'kontakt') ? await aufloesen(x) : null;
      if (neu) anders = true;
      q.append(k, neu ?? x);
    }
  }
  return anders ? `${pfad}?${q.toString()}` : null;
}
