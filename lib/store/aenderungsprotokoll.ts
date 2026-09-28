// ─── Änderungsprotokoll — serverseitig, nur anhängend (28.09., K1 #44) ───────
// Vorher meldete der Browser (components/os/Protokollant.tsx) jede Änderung selbst an
// /api/state/aenderungen: ohne Haushaltsprüfung, mit einer Person, die der Browser behauptete,
// und gekürzt auf 400 Einträge. Jetzt schreiben die Schreibwege selbst:
//   · lib/store/patch-liste.ts `listePatchen` (Kartei, Kunden, Ziele, Meilensteine, Routinen …)
//   · lib/crm/speicher.ts `aendereCrm` (der ganze CRM-Bestand — jede Route, jedes Werkzeug)
// Eintrag: WER (Person · ZOE im Auftrag einer Person · Import · System), WAS (Bestand, Liste,
// Kennung, Namen der geänderten Felder) und WANN — bewusst KEINE Inhalte und keine Werte; Kontakt-
// Kennungen (tragen die E-Mail) nur als Fingerabdruck (`protokollKennung`).
// Speicher: `aenderungsprotokoll--<haushalt>--<JJJJ-MM>` (Monatsdateien, Berliner Monat) —
// es wird nur angehängt, nie gekürzt, nie überschrieben. Ein Fehler beim Protokollieren bricht
// den eigentlichen Schreibvorgang nie ab (er ist dann schon geschehen).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { hmacHex, shaHex } from '@/lib/datenschutz/pepper';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';
import { gleich } from '@/lib/zugang/sitzung';

export type WerArt = 'person' | 'zoe' | 'import' | 'system';
export interface Wer { art: WerArt; person?: string }
export type ProtokollOp = 'neu' | 'geaendert' | 'geloescht';
/** Eine Änderung an einem Datensatz — ohne Inhalt. `liste` nur bei Beständen mit mehreren Listen (CRM). */
export interface Aenderung { liste?: string; op: ProtokollOp; id: string; felder?: string[] }
export interface ProtokollEintrag extends Aenderung { at: string; wer: WerArt; person?: string; bestand: string }
export interface ProtokollDatei { eintraege: ProtokollEintrag[] }

export const PROTOKOLL_PRAEFIX = 'aenderungsprotokoll';
const PERSON = /^[a-z0-9-]{1,40}$/;

/** Der Berliner Monat (JJJJ-MM) — die Monatsdatei, in die ein Eintrag gehört. */
export function monatBerlin(d = new Date()): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(d);
  return `${t.find(x => x.type === 'year')!.value}-${t.find(x => x.type === 'month')!.value}`;
}
/** Der Monat davor (JJJJ-MM). */
export function vormonat(monat: string): string {
  const [j, m] = monat.split('-').map(Number);
  return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`;
}

export function protokollName(haushalt: string, monat: string): string {
  const h = haushalt.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '') || 'ohne-haushalt';
  if (!/^\d{4}-\d{2}$/.test(monat)) throw new Error(`[protokoll] Monat ungültig: ${monat}`);
  return `${PROTOKOLL_PRAEFIX}--${h}--${monat}`;
}

/** Wer schreibt — aus den Köpfen, die die Middleware setzt (x-make-user) bzw. der Dienstweg mitgibt (x-make-person). */
export function werAusKoepfen(h: { get(n: string): string | null }): Wer {
  const sitzung = h.get('x-make-user');
  if (sitzung && PERSON.test(sitzung)) return { art: 'person', person: sitzung };
  const schluessel = process.env.MAKE_OS_KEY;
  const kopf = h.get('x-make-key');
  const dienst = !!schluessel && !!kopf && gleich(kopf, schluessel);
  if (dienst) {
    const p = h.get('x-make-person');
    // Dienstweg im Auftrag einer Person = ZOE, Heads, Arbeiter; ohne Person = Systemlauf des Takts (Regel 7).
    return p && PERSON.test(p) ? { art: 'zoe', person: p } : { art: 'system' };
  }
  return { art: 'system' };
}
export const werAus = (req: Request): Wer => werAusKoepfen(req.headers);

/** Wer aus der laufenden Anfrage (next/headers) — außerhalb einer Anfrage (Tests, Skripte): System. */
export async function werAusAnfrage(): Promise<Wer> {
  try {
    const { headers } = await import('next/headers');
    return werAusKoepfen(await headers());
  } catch { return { art: 'system' }; }
}

/**
 * Kontakt-Kennungen tragen die E-Mail-Adresse (lib/make-one/crm.ts: `c-` + Schlüssel) — ins Protokoll kommen sie nur
 * als Fingerabdruck. Seit 29.09. (Paket D-B #68/#71) HMAC-SHA-256 mit Pepper: `c2#<16 hex>` (v2); ohne Pepper wie bisher
 * der ungesalzene `c#<12 hex>` (v1, Warnung im HOI). Solange es den Kontakt gibt, löst die Lese-Route beide Formen auf
 * (`protokollKennungen`); Art. 17 ersetzt die Fingerabdrücke der Person durch `c#geloescht` (lib/crm/person-weitere.ts) —
 * danach bleibt im Protokoll nichts, das auf die Person zeigt.
 */
export function protokollKennung(id: string): string {
  if (!/^c-/.test(id)) return id;
  const v2 = hmacHex('make-os-protokoll-v2', id);
  return v2 ? `c2#${v2.slice(0, 16)}` : protokollKennungV1(id);
}
/** Der alte, ungesalzene Fingerabdruck (v1) — nur zum Auflösen, Migrieren und Tilgen. */
export const protokollKennungV1 = (id: string): string => (/^c-/.test(id) ? `c#${shaHex(id).slice(0, 12)}` : id);
/** Alle Fingerabdrücke einer Kennung (aktuelle Version zuerst, dann v1) — zum Auflösen und für Art. 15/17. */
export function protokollKennungen(id: string): string[] {
  return /^c-/.test(id) ? Array.from(new Set([protokollKennung(id), protokollKennungV1(id)])) : [id];
}
/** Platzhalter für den Fingerabdruck einer gelöschten Person (Art. 17). */
export const KENNUNG_GELOESCHT = 'c#geloescht';

const gleichWert = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
/** Namen der Felder, die sich unterscheiden — nie die Werte. `stand` (Fingerabdruck) zählt nicht. */
export function feldDiff(alt: Record<string, unknown>, neu: Record<string, unknown>): string[] {
  const namen = new Set([...Object.keys(alt), ...Object.keys(neu)]);
  namen.delete('stand');
  return Array.from(namen).filter(n => !gleichWert(alt[n], neu[n])).sort();
}

type MitId = { id: string };
const istIdListe = (v: unknown): v is MitId[] => Array.isArray(v) && v.every(x => !!x && typeof x === 'object' && typeof (x as MitId).id === 'string');

/** Was sich in einer Liste mit Kennungen geändert hat — neu, geändert (mit Feldnamen), gelöscht. */
export function listenDiff(alt: MitId[], neu: MitId[], liste?: string): Aenderung[] {
  const vorher = new Map(alt.map(x => [x.id, x]));
  const raus: Aenderung[] = [];
  const gesehen = new Set<string>();
  for (const n of neu) {
    gesehen.add(n.id);
    const a = vorher.get(n.id);
    if (!a) { raus.push({ ...(liste ? { liste } : {}), op: 'neu', id: n.id }); continue; }
    if (a === n) continue;
    const felder = feldDiff(a as unknown as Record<string, unknown>, n as unknown as Record<string, unknown>);
    if (felder.length) raus.push({ ...(liste ? { liste } : {}), op: 'geaendert', id: n.id, felder });
  }
  for (const a of alt) if (!gesehen.has(a.id)) raus.push({ ...(liste ? { liste } : {}), op: 'geloescht', id: a.id });
  return raus;
}

/** Ein ganzer Bestand mit mehreren Listen (CRM): je Liste die Änderungen, sonstige Felder als eine Zeile je Feld. */
export function bestandDiff(alt: Record<string, unknown> | null | undefined, neu: Record<string, unknown> | null | undefined): Aenderung[] {
  const a = alt ?? {}, n = neu ?? {};
  const raus: Aenderung[] = [];
  for (const k of Array.from(new Set([...Object.keys(a), ...Object.keys(n)])).sort()) {
    if (a[k] === n[k]) continue;
    if ((istIdListe(a[k]) || a[k] === undefined) && (istIdListe(n[k]) || n[k] === undefined)) raus.push(...listenDiff((a[k] as MitId[]) ?? [], (n[k] as MitId[]) ?? [], k));
    else if (!gleichWert(a[k], n[k])) raus.push({ liste: k, op: 'geaendert', id: k });
  }
  return raus;
}

/**
 * Änderungen anhängen. `wer` fehlt → aus der laufenden Anfrage (`werAusAnfrage`). Wirft nie: das Protokoll
 * darf keinen Schreibvorgang scheitern lassen, der schon geschehen ist (Fehler landen im Server-Log).
 */
export async function protokolliere(bestand: string, aenderungen: Aenderung[], wer?: Wer, jetzt = new Date()): Promise<void> {
  if (!aenderungen.length) return;
  try {
    const w = wer ?? await werAusAnfrage();
    // In den Haushalt der schreibenden Person (Routinen, Ziele … eines anderen Haushalts landen nie im Protokoll
    // des Inhabers); ohne Person (Takt, Skript) in den des Inhabers — Kartei und CRM gehören ihm.
    const eigener = w.person ? (await ladeKonten()).konten.find(k => k.speicher === w.person)?.haushalt : undefined;
    const haushalt = eigener ?? (await haushaltDesInhabers()) ?? 'ohne-haushalt';
    const at = jetzt.toISOString();
    const neu: ProtokollEintrag[] = aenderungen.map(a => ({
      at, wer: w.art, ...(w.person ? { person: w.person } : {}), bestand,
      ...(a.liste ? { liste: a.liste } : {}), op: a.op, id: protokollKennung(a.id), ...(a.felder?.length ? { felder: a.felder } : {}),
    }));
    await updateJson<ProtokollDatei>(protokollName(haushalt, monatBerlin(jetzt)), cur => ({ eintraege: [...(Array.isArray(cur?.eintraege) ? cur.eintraege : []), ...neu] }));
  } catch (e) {
    console.error(`[protokoll] ${bestand}: nicht protokolliert —`, e instanceof Error ? e.message : e);
  }
}

/** Die Einträge eines Monats (älteste zuerst). */
export async function protokollMonat(haushalt: string, monat: string): Promise<ProtokollEintrag[]> {
  const f = await loadJson<ProtokollDatei>(protokollName(haushalt, monat));
  return Array.isArray(f?.eintraege) ? f.eintraege : [];
}

/** Ein ganzer Bestand wurde ersetzt (PUT-Wege): vorher/nachher vergleichen und die Unterschiede anhängen. */
export async function protokolliereBestand(bestand: string, vorher: unknown, nachher: unknown, wer?: Wer): Promise<void> {
  const r = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {});
  await protokolliere(bestand, bestandDiff(r(vorher), r(nachher)), wer);
}
