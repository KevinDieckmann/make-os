// ─── Art. 17 / Art. 15 über die WEITEREN Speicher mit Personenbezug (29.09., Paket D-B #69/#74/#30/#48/#93) ─
// `lib/crm/person-bestaende.ts` kannte neun Speicher (Kartei, CRM, Ablage, Konflikte, Heads, Replay, Signale,
// Aufgaben, Import-Läufe). Eine gelöschte Person stand aber weiter im Altbestand `netzwerk` (Startfläche), in den
// Postfach- und Kalender-Zwischenspeichern, in ZOE-Verlauf, -Gedächtnis, -Protokoll und -Stapel, in den dauerhaften
// ZOE-Entscheidungen, im Änderungsprotokoll (Fingerabdruck), im Agenten-Log, in Meldungen und in der Umzugs-Kopie
// „CRM vor Brain-Umzug“ im Archiv. Diese Datei räumt genau diese Speicher — `personEntfernen` ruft sie am Ende.
//
// Zwei Behandlungen (Register: lib/crm/speicher-register.ts):
//   entfernen  Einträge, die die Person IDENTIFIZIEREN oder nennen, fallen ganz weg (Altbestände mit eigener Person,
//              Mail-Zwischenspeicher, ZOE-Gedächtnis/-Protokoll/-Stapel). Der Rest wird zusätzlich getilgt.
//   tilgen     der Eintrag bleibt (eure Arbeit, Kalender, Gespräche, Entscheidungen), aber Kennung, E-Mail-Adressen,
//              voller Name und Protokoll-Fingerabdrücke der Person werden „[gelöscht]“ bzw. `c#geloescht`;
//              Schlüssel eines Objekts, die genau die Kennung oder eine Adresse sind, fallen weg.
// Gesucht wird nach: Kennung (ganzes Wort), jeder E-Mail-Adresse (ohne Groß/klein), vollem Namen (ganze Wörter,
// nur wenn eindeutig genug: Vorname + Nachname ≥ 3 Zeichen) und den Fingerabdrücken (v2 und v1).
// Rein bis auf `weitereEntfernen`/`weitereAufzaehlen`; idempotent (ein zweiter Lauf findet nichts mehr).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { protokollKennungen, KENNUNG_GELOESCHT } from '@/lib/store/aenderungsprotokoll';
import { emailsVon } from './emails';
import type { EmailAdresse } from './emails';

export const GELOESCHT = '[gelöscht]';

/** Woran die Person in Freitexten und Schlüsseln zu erkennen ist. */
export interface PersonMerkmale {
  id: string;
  /** Voller Name (Vor- + Nachname) oder null, wenn zu unbestimmt. */
  name: string | null;
  /** Alle Adressen, klein. */
  emails: string[];
  /** Protokoll-Fingerabdrücke der Kennung (v2 und v1). */
  fingerabdruecke: string[];
}

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const kennungRe = (id: string, f = '') => new RegExp(`(?<![A-Za-z0-9_-])${esc(id)}(?![A-Za-z0-9_-])`, f);
const nameRe = (name: string, f = '') => new RegExp(`(?<![\\p{L}\\p{N}])${esc(name).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, `iu${f}`);
const mailRe = (m: string, f = '') => new RegExp(`(?<![A-Za-z0-9._%+-])${esc(m)}(?![A-Za-z0-9._%+-])`, `i${f}`);
const fpRe = (fp: string, f = '') => new RegExp(`${esc(fp)}(?![0-9a-f])`, f);

/** Merkmale aus Kennung und (falls noch bekannt) Kontakt. */
export function merkmaleVon(id: string, k?: { vorname?: string; nachname?: string; email?: string; emails?: EmailAdresse[] } | null): PersonMerkmale {
  const v = (k?.vorname ?? '').trim(), n = (k?.nachname ?? '').trim();
  const emails = k ? Array.from(new Set(emailsVon(k).map(a => a.adresse.trim().toLowerCase()).filter(a => a.includes('@')))) : [];
  return { id, name: v && n.length >= 3 ? `${v} ${n}` : null, emails, fingerabdruecke: protokollKennungen(id).filter(f => f !== id) };
}

/** Nennt dieser Text die Person? */
export function textNennt(t: string, m: PersonMerkmale): boolean {
  if (!t) return false;
  if (m.id && kennungRe(m.id).test(t)) return true;
  if (m.emails.some(a => mailRe(a).test(t))) return true;
  if (m.fingerabdruecke.some(f => fpRe(f).test(t))) return true;
  return !!m.name && nameRe(m.name).test(t);
}

/** Nennt dieser Wert (irgendwo, auch in Schlüsseln) die Person? */
export const nenntPerson = (wert: unknown, m: PersonMerkmale): boolean => textNennt(JSON.stringify(wert ?? null), m);

/** Kennung, Adressen, voller Name → „[gelöscht]“, Fingerabdrücke → `c#geloescht`. */
export function tilgeText(t: string, m: PersonMerkmale): string {
  let x = t;
  for (const f of m.fingerabdruecke) x = x.replace(fpRe(f, 'g'), KENNUNG_GELOESCHT);
  if (m.id) x = x.replace(kennungRe(m.id, 'g'), GELOESCHT);
  for (const a of m.emails) x = x.replace(mailRe(a, 'g'), GELOESCHT);
  if (m.name) x = x.replace(nameRe(m.name, 'g'), GELOESCHT);
  return x;
}

/** Schlüssel, die genau die Person meinen (Kennung, Adresse, Fingerabdruck), fallen weg. */
const schluesselDerPerson = (k: string, m: PersonMerkmale) => k === m.id || m.emails.includes(k.toLowerCase()) || m.fingerabdruecke.includes(k);

/** Tief tilgen — liefert denselben Wert (===), wenn nichts zu tun war. */
export function tilgeTief<T>(wert: T, m: PersonMerkmale): { wert: T; n: number } {
  let n = 0;
  const lauf = (v: unknown): unknown => {
    if (typeof v === 'string') { const t = tilgeText(v, m); if (t !== v) n++; return t; }
    if (Array.isArray(v)) { let anders = false; const l = v.map(x => { const y = lauf(x); if (y !== x) anders = true; return y; }); return anders ? l : v; }
    if (v && typeof v === 'object') {
      let anders = false;
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (schluesselDerPerson(k, m)) { anders = true; n++; continue; }
        const y = lauf(x); if (y !== x) anders = true; o[k] = y;
      }
      return anders ? o : v;
    }
    return v;
  };
  if (!nenntPerson(wert, m)) return { wert, n: 0 };
  return { wert: lauf(wert) as T, n };
}

/** Aus einer Liste alle Einträge, die die Person nennen, entfernen. */
export function ohneNennung<T>(liste: readonly T[] | undefined, m: PersonMerkmale): { liste: T[]; n: number } {
  const l = Array.isArray(liste) ? liste : [];
  const rest = l.filter(x => !nenntPerson(x, m));
  return { liste: rest.length === l.length ? (l as T[]) : rest, n: l.length - rest.length };
}

const normWort = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
/** Identifiziert ein Datensatz eines Altbestands die Person (Adresse gleich oder Name gleich)? */
export function identifiziert(x: { name?: unknown; email?: unknown; mail?: unknown; vorname?: unknown; nachname?: unknown } | null | undefined, m: PersonMerkmale): boolean {
  if (!x) return false;
  const mails = [x.email, x.mail].filter((v): v is string => typeof v === 'string').map(v => v.trim().toLowerCase());
  if (mails.some(a => m.emails.includes(a))) return true;
  if (!m.name) return false;
  const voll = typeof x.name === 'string' ? x.name : `${typeof x.vorname === 'string' ? x.vorname : ''} ${typeof x.nachname === 'string' ? x.nachname : ''}`;
  return !!voll.trim() && normWort(voll) === normWort(m.name);
}

// ── Behandlung je Speicher (rein) ────────────────────────────────────────────

type Obj = Record<string, unknown>;
/** Eine Wirkung auf einen Bestand (alle Bestände sind JSON-Objekte). */
type Wirkung = (cur: Obj, m: PersonMerkmale) => { neu: Obj; n: number };
const liste = (o: Obj, feld: string) => (Array.isArray(o?.[feld]) ? (o[feld] as unknown[]) : []);

/** Liste im Feld `feld`: Einträge, die die Person nennen, raus — der Rest getilgt. */
const eintraegeRaus = (feld: string): Wirkung => (cur, m) => {
  const r = ohneNennung(liste(cur, feld), m);
  const basis = r.n ? { ...cur, [feld]: r.liste } : cur;
  const t = tilgeTief(basis, m);
  return { neu: t.wert, n: r.n + t.n };
};
/** Eintrag bleibt, Person wird getilgt. */
const tilgen: Wirkung = (cur, m) => { const t = tilgeTief(cur, m); return { neu: t.wert, n: t.n }; };

/** Altbestand Netzwerk: Kontakte der Person (Adresse/Name) samt ihrer Chancen raus, Rest getilgt. */
export const netzwerkOhne: Wirkung = (cur, m) => {
  const kontakte = liste(cur, 'kontakte') as { id?: string; name?: string; email?: string }[];
  const weg = new Set(kontakte.filter(k => identifiziert(k, m)).map(k => String(k.id ?? '')));
  const chancen = liste(cur, 'chancen') as { kontaktId?: string }[];
  const n = weg.size + chancen.filter(c => weg.has(String(c.kontaktId ?? ''))).length;
  const basis = n ? { ...cur, kontakte: kontakte.filter(k => !weg.has(String(k.id ?? ''))), chancen: chancen.filter(c => !weg.has(String(c.kontaktId ?? ''))) } : cur;
  const t = tilgeTief(basis, m);
  return { neu: t.wert, n: n + t.n };
};
/** Datensätze, die die Person identifizieren, raus (Listen `felder`), Rest getilgt — Kunden, Stammdaten-Personen. */
const identRaus = (...felder: string[]): Wirkung => (cur, m) => {
  let n = 0;
  const neu: Obj = { ...cur };
  for (const f of felder) {
    const l = liste(cur, f) as Obj[];
    const rest = l.filter(x => !identifiziert(x as never, m));
    if (rest.length !== l.length) { n += l.length - rest.length; neu[f] = rest; }
  }
  const t = tilgeTief(n ? neu : cur, m);
  return { neu: t.wert, n: n + t.n };
};
/** Objekt-Map (Schlüssel → Eintrag, z. B. Mail-Einstufung): Einträge, die die Person nennen, raus. */
const mapRaus: Wirkung = (cur, m) => {
  let n = 0;
  const neu: Obj = {};
  for (const [k, v] of Object.entries(cur ?? {})) { if (schluesselDerPerson(k, m) || nenntPerson(v, m)) { n++; continue; } neu[k] = v; }
  return { neu: n ? neu : cur, n };
};

/**
 * Absichtsprotokoll (Paket D-C #17): in ANDEREN Absichten (Import, Umzug …) wird die Person getilgt; die eigene
 * Art.-17-Absicht der Person bleibt unberührt — sie braucht Name und Adressen bis zum letzten Schritt und wird beim
 * Abschluss ohnehin geleert.
 */
export const absichtenTilgen: Wirkung = (cur, m) => {
  const l = liste(cur, 'absichten') as { art?: string; daten?: { id?: unknown } }[];
  let n = 0;
  const neu = l.map(a => {
    if (a?.art === 'art17' && a.daten?.id === m.id) return a;
    const t = tilgeTief(a, m);
    n += t.n;
    return t.wert;
  });
  return { neu: n ? { ...cur, absichten: neu } : cur, n };
};

/**
 * Kalender-Bezüge (29.09., K1): nur Kennungen je Termin (`bezuege[uid] = { kontaktId?, … }`). Die Kontakt-Kennung der
 * Person fällt weg; der Eintrag bleibt (andere Bezüge, Sicherung von Art/privat). Titel stehen hier nie.
 */
export const kalenderBezugOhne: Wirkung = (cur, m) => {
  const alt = (cur?.bezuege && typeof cur.bezuege === 'object' ? cur.bezuege : {}) as Record<string, Obj>;
  let n = 0;
  const bezuege: Record<string, Obj> = {};
  for (const [k, e] of Object.entries(alt)) {
    if (e?.kontaktId === m.id) { n++; const { kontaktId: _weg, ...rest } = e; bezuege[k] = rest; } else bezuege[k] = e;
  }
  return { neu: n ? { ...cur, bezuege } : cur, n };
};

/**
 * `nur-in-apple` (29.09., K2): Spiegel einer Apple-Quelle (Kalender, Erinnerungen, Kontakte). Tilgen wäre Schein — der
 * Abgleich baut den Spiegel aus Apple neu. Der Löschlauf ändert ihn NICHT, sondern zählt die Einträge, die die Person
 * nennen (`nurInApple`), und meldet „n Einträge in Apple nennen die Person — dort löschen“. Register: „ausgenommen“.
 */
export interface WeitererSpeicher { name: string; muster: RegExp; behandlung: 'entfernen' | 'tilgen' | 'nur-in-apple'; wirkung: Wirkung }

/** Einträge eines Apple-Spiegels, die die Person nennen — gezählt, nie geändert. `{events}`, `{daten}`, `{objekte: {kal: [...]}}`. */
export const inAppleZaehlen: Wirkung = (cur, m) => {
  const o = (cur ?? {}) as Obj;
  const eintraege: unknown[] = [];
  for (const feld of ['events', 'daten', 'eintraege']) if (Array.isArray(o[feld])) eintraege.push(...(o[feld] as unknown[]));
  if (o.objekte && typeof o.objekte === 'object') for (const l of Object.values(o.objekte as Obj)) if (Array.isArray(l)) eintraege.push(...l);
  if (o.daten && typeof o.daten === 'object' && !Array.isArray(o.daten)) for (const l of Object.values(o.daten as Obj)) if (Array.isArray(l)) eintraege.push(...l);
  return { neu: cur, n: eintraege.filter(e => nenntPerson(e, m)).length };
};

/**
 * Die weiteren Speicher — Name, Dateimuster, Behandlung. Das Register (lib/crm/speicher-register.ts) verweist hierher;
 * der Wächtertest prüft, dass jede Behandlung „entfernen“/„tilgen“ eine Wirkung hat.
 */
export const WEITERE_SPEICHER: readonly WeitererSpeicher[] = [
  { name: 'netzwerk', muster: /^netzwerk$/, behandlung: 'entfernen', wirkung: netzwerkOhne },
  { name: 'kunden', muster: /^kunden$/, behandlung: 'entfernen', wirkung: identRaus('kunden') },
  { name: 'stammdaten', muster: /^stammdaten$/, behandlung: 'entfernen', wirkung: identRaus('personen', 'partner', 'konten') },
  { name: 'prospects', muster: /^prospects$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'inbox-absender', muster: /^inbox-absender$/, behandlung: 'entfernen', wirkung: tilgen }, // Schlüssel = Adresse → fällt weg
  { name: 'inbox-triage', muster: /^inbox-triage$/, behandlung: 'entfernen', wirkung: mapRaus },
  { name: 'apple-mail-cache', muster: /^apple-mail-cache$/, behandlung: 'entfernen', wirkung: eintraegeRaus('daten') },
  { name: 'm365-postfach', muster: /^m365-postfach$/, behandlung: 'entfernen', wirkung: eintraegeRaus('mails') },
  { name: 'microsoft-inbox', muster: /^microsoft-inbox$/, behandlung: 'entfernen', wirkung: eintraegeRaus('emails') },
  { name: 'calendar-cache', muster: /^calendar-cache$/, behandlung: 'nur-in-apple', wirkung: inAppleZaehlen },
  { name: 'kalender-icloud', muster: /^kalender-icloud$/, behandlung: 'nur-in-apple', wirkung: inAppleZaehlen },
  { name: 'apple-reminders-cache', muster: /^apple-reminders-cache$/, behandlung: 'nur-in-apple', wirkung: inAppleZaehlen },
  { name: 'apple-contacts-cache', muster: /^apple-contacts-cache$/, behandlung: 'nur-in-apple', wirkung: inAppleZaehlen },
  { name: 'kemaris-calendar', muster: /^kemaris-calendar$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'kalender-bezug', muster: /^kalender-bezug$/, behandlung: 'entfernen', wirkung: kalenderBezugOhne },
  { name: 'meetings', muster: /^meetings$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'zoe-verlauf', muster: /^zoe-verlauf$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'zoe-gedaechtnis', muster: /^zoe-gedaechtnis$/, behandlung: 'entfernen', wirkung: eintraegeRaus('fakten') },
  { name: 'zoe-protokoll', muster: /^zoe-protokoll$/, behandlung: 'entfernen', wirkung: eintraegeRaus('eintraege') },
  { name: 'zoe-stapel', muster: /^zoe-stapel$/, behandlung: 'entfernen', wirkung: eintraegeRaus('vorschlaege') },
  { name: 'zoe-auftraege', muster: /^zoe-auftraege$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'zoe-empfang', muster: /^zoe-empfang$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'zoe-entscheidungen--*', muster: /^zoe-entscheidungen--[a-z0-9-]+--\d{4}-\d{2}$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'aenderungsprotokoll--*', muster: /^aenderungsprotokoll--[a-z0-9-]+--\d{4}-\d{2}$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'crm-import-laeufe--*', muster: /^crm-import-laeufe--[a-z0-9-]+$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'agent-log', muster: /^agent-log$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'client-fehler', muster: /^client-fehler$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'meldungen--*', muster: /^meldungen--[a-z0-9-]+$/, behandlung: 'tilgen', wirkung: tilgen },
  { name: 'absichten--*', muster: /^absichten--[a-z0-9-]+$/, behandlung: 'tilgen', wirkung: absichtenTilgen },
];

/** Welcher weitere Speicher gilt für diesen Bestandsnamen? */
export const weitererSpeicher = (bestand: string) => WEITERE_SPEICHER.find(s => s.muster.test(bestand)) ?? null;

async function bestandsNamen(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).sort();
}

/**
 * Art. 17 über alle weiteren Speicher (nur solche, die es gibt — nie einen leeren anlegen). Je Speicher EINE Sperre.
 * Liefert je Speicher die Zahl der Änderungen. Fehler in einem Speicher halten die anderen nicht auf (Log); ein
 * zweiter Lauf räumt Reste.
 */
export async function weitereEntfernen(m: PersonMerkmale): Promise<{ speicher: Record<string, number>; fehler: string[]; nurInApple: Record<string, number> }> {
  const speicher: Record<string, number> = {};
  const nurInApple: Record<string, number> = {};
  const fehler: string[] = [];
  for (const name of await bestandsNamen()) {
    const s = weitererSpeicher(name);
    if (!s) continue;
    if (s.behandlung === 'nur-in-apple') {
      // Nie schreiben — nur zählen, damit der Mensch in Apple löschen kann (Register: „ausgenommen: Löschung nur in Apple“).
      const cur = await loadJson<Obj>(name).catch(() => null);
      const n = cur && typeof cur === 'object' ? s.wirkung(cur, m).n : 0;
      if (n) nurInApple[name] = n;
      continue;
    }
    try {
      let n = 0;
      await updateJson<Obj>(name, cur => {
        if (!cur || typeof cur !== 'object') return cur as unknown as Obj;
        const r = s.wirkung(cur, m);
        n = r.n;
        return r.n ? r.neu : cur;
      });
      if (n) speicher[name] = n;
    } catch (e) {
      fehler.push(name);
      console.error(`[art17] ${name}:`, e instanceof Error ? e.message : e);
    }
  }
  const a = await archivTilgen(m);
  for (const [k, v] of Object.entries(a.speicher)) speicher[k] = v;
  fehler.push(...a.fehler);
  return { speicher, fehler, nurInApple };
}

/** Art. 15: in welchen weiteren Speichern die Person vorkommt (nur Zahlen je Speicher, keine Inhalte). */
export async function weitereAufzaehlen(m: PersonMerkmale): Promise<Record<string, number>> {
  const raus: Record<string, number> = {};
  for (const name of await bestandsNamen()) {
    if (!weitererSpeicher(name)) continue;
    const cur = await loadJson<unknown>(name).catch(() => null);
    if (cur === null) continue;
    const t = tilgeTief(cur, m);
    if (t.n) raus[name] = t.n;
  }
  return raus;
}

// ── Archiv (<daten>/archiv): Umzugs-Kopien mit Personenbezug tilgen ───────────
// Die Kopie „CRM vor Brain-Umzug“ trägt Kartei und CRM — Art. 17 nimmt die Person auch dort heraus (Kartei-Eintrag
// weg, Rest getilgt); die Kopie bleibt, bis ihre Löschfrist (archiv-umzug, 30 Tage) sie entfernt.

async function archivTilgen(m: PersonMerkmale): Promise<{ speicher: Record<string, number>; fehler: string[] }> {
  const speicher: Record<string, number> = {};
  const fehler: string[] = [];
  const ordner = path.join(datenOrdner(), 'archiv');
  const dateien = (await fs.readdir(ordner).catch(() => [] as string[])).filter(d => d.endsWith('.json'));
  if (!dateien.length) return { speicher, fehler };
  const { archivLesen, archivSchreiben } = await import('@/lib/store/archiv');
  for (const d of dateien) {
    try {
      const inhalt = await archivLesen<Obj>(d);
      let n = 0;
      let neu: Obj = inhalt;
      const k = (inhalt?.kontakte as { kontakte?: { id?: string }[] } | null)?.kontakte;
      if (Array.isArray(k) && k.some(x => x?.id === m.id)) { neu = { ...inhalt, kontakte: { ...(inhalt.kontakte as Obj), kontakte: k.filter(x => x?.id !== m.id) } }; n++; }
      const t = tilgeTief(neu, m);
      n += t.n;
      if (n) { await archivSchreiben(d, t.wert); speicher[`archiv/${d}`] = n; }
    } catch (e) {
      fehler.push(`archiv/${d}`);
      console.error(`[art17] archiv/${d}:`, e instanceof Error ? e.message : e);
    }
  }
  return { speicher, fehler };
}
