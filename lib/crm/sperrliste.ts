// ─── CRM — gehashte Sperrliste je Haushalt (28.09., K2 #60/#64) ─────────────
// Die Werbesperre hing nur am Kontakt: wurde die Person gelöscht (Art. 17),
// legte der nächste Import der Masterliste sie ungesperrt neu an. Ab jetzt
// merkt sich der Haushalt, WER nicht mehr hereinkommt — ohne zu speichern,
// wer das ist: nur SHA-256 der Merkmale (persönliche E-Mail, HubSpot-ID,
// Name+Firma, je normalisiert wie der Import-Schlüssel), Grund und Tag.
// Keine Klartexte. Der Bestand liegt wie jeder andere verschlüsselt.
//
//   Speicher   crm-sperrliste--<haushalt>   { eintraege: [{ h: [sha256…], grund, am }] }
//   entsteht   Werbesperre (Kartei, Aktivität „Sperre“, Follow-up; vor jedem Import nachgetragen)
//              und Art.-17-Löschung (lib/crm/person-bestaende.ts personEntfernen)
//   wirkt      importieren(): eine gesperrte Zeile wird NICHT neu angelegt (Vorschau „n gesperrt übersprungen“)
//   endet      nur „Werbesperre aufheben“ mit Einwilligungs-Nachweis im selben Schritt (PATCH /api/state/kontakte)
//
// Der Haushalt ist der des Inhabers — die Kartei (`kontakte`) gehört genau ihm.
// Ohne eingetragenen Haushalt heißt er „haupt“; wird später einer eingetragen,
// liest `sperrlisteLaden` den alten Stand mit (nie ein stiller Verlust).

import { createHash } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { identitaetsMerkmale, type Kontakt } from '@/lib/make-one/crm';

export type SperrGrund = 'werbesperre' | 'loeschung';
export interface SperrEintrag { h: string[]; grund: SperrGrund; am: string }
export interface Sperrliste { eintraege: SperrEintrag[] }
type Person = Parameters<typeof identitaetsMerkmale>[0];

/** Ersatzname, solange der Inhaber keinen Haushalt eingetragen hat. */
export const HAUSHALT_ERSATZ = 'haupt';
/** Der Haushalt der Kartei (des Inhabers) — Sperrliste und Import-Läufe liegen darunter. */
export async function karteiHaushalt(): Promise<string> {
  const h = await haushaltDesInhabers().catch(() => null);
  return h && HAUSHALT_OK.test(h) ? h : HAUSHALT_ERSATZ;
}
export const sperrlisteName = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error('Unzulässiger Haushalt.');
  return `crm-sperrliste--${haushalt}`;
};

// ── Rein ─────────────────────────────────────────────────────────────────────

/** Ein Merkmal gehasht (mit festem Vorsatz, damit der Hash nur hier etwas bedeutet). */
export const sperrHash = (merkmal: string) => createHash('sha256').update(`make-os-sperre-v1|${merkmal}`).digest('hex');
/** Alle Hashes einer Person. Leer, wenn sie kein Merkmal trägt. */
export const sperrHashes = (k: Person) => identitaetsMerkmale(k).map(sperrHash);

/** Person aufnehmen (idempotent): gleicher Grund + Überschneidung → Hashes vereinen, sonst neuer Eintrag. */
export function sperrlisteMit(eintraege: SperrEintrag[], k: Person, grund: SperrGrund, am: string): { eintraege: SperrEintrag[]; geaendert: boolean } {
  const h = sperrHashes(k);
  if (!h.length) return { eintraege, geaendert: false };
  const i = eintraege.findIndex(e => e.grund === grund && e.h.some(x => h.includes(x)));
  if (i < 0) return { eintraege: [...eintraege, { h, grund, am: am.slice(0, 10) }], geaendert: true };
  const vereint = Array.from(new Set([...eintraege[i].h, ...h]));
  if (vereint.length === eintraege[i].h.length) return { eintraege, geaendert: false };
  return { eintraege: eintraege.map((e, j) => (j === i ? { ...e, h: vereint } : e)), geaendert: true };
}

/** Person herausnehmen: jeder Eintrag, der eines ihrer Merkmale trägt, fällt (er beschreibt diese Person). */
export function sperrlisteOhne(eintraege: SperrEintrag[], k: Person): { eintraege: SperrEintrag[]; entfernt: number } {
  const h = new Set(sperrHashes(k));
  const rest = eintraege.filter(e => !e.h.some(x => h.has(x)));
  return { eintraege: rest, entfernt: eintraege.length - rest.length };
}

/** Prüfer für den Import: steht eines der Merkmale auf der Liste? */
export function sperrPruefer(eintraege: SperrEintrag[]): (k: Person) => boolean {
  const alle = new Set(eintraege.flatMap(e => e.h));
  return k => alle.size > 0 && sperrHashes(k).some(x => alle.has(x));
}

/** Säubern beim Lesen: nur Hex-Hashes, bekannte Gründe, Tag. */
function saeubern(roh: unknown): SperrEintrag[] {
  const l = (roh as Sperrliste | null)?.eintraege;
  if (!Array.isArray(l)) return [];
  return l.flatMap(e => {
    const h = Array.isArray(e?.h) ? e.h.filter((x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x)) : [];
    const grund: SperrGrund = e?.grund === 'loeschung' ? 'loeschung' : 'werbesperre';
    return h.length ? [{ h, grund, am: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.am)) ? String(e.am) : '' }] : [];
  });
}

// ── Speicher ─────────────────────────────────────────────────────────────────

/** Die ganze Liste des Kartei-Haushalts (samt Ersatz-Haushalt „haupt“, falls es ihn noch gibt). */
export async function sperrlisteLaden(): Promise<SperrEintrag[]> {
  const h = await karteiHaushalt();
  const eigene = saeubern(await loadJson<Sperrliste>(sperrlisteName(h)));
  if (h === HAUSHALT_ERSATZ) return eigene;
  return [...eigene, ...saeubern(await loadJson<Sperrliste>(sperrlisteName(HAUSHALT_ERSATZ)))];
}

/** Personen aufnehmen (idempotent). Liefert, wie viele neu dazukamen oder ergänzt wurden. */
export async function sperren(personen: Person[], grund: SperrGrund, am: string): Promise<number> {
  const mitMerkmal = personen.filter(p => sperrHashes(p).length);
  if (!mitMerkmal.length) return 0;
  let n = 0;
  await updateJson<Sperrliste>(sperrlisteName(await karteiHaushalt()), cur => {
    let l = saeubern(cur);
    for (const p of mitMerkmal) { const r = sperrlisteMit(l, p, grund, am); if (r.geaendert) { l = r.eintraege; n++; } }
    return n ? { eintraege: l } : (cur ?? { eintraege: [] });
  });
  return n;
}

/** Person herausnehmen — NUR nach Werbesperre-Aufheben mit Einwilligungs-Nachweis (PATCH /api/state/kontakte). */
export async function entsperren(k: Person): Promise<number> {
  const h = await karteiHaushalt();
  let n = 0;
  for (const name of Array.from(new Set([sperrlisteName(h), sperrlisteName(HAUSHALT_ERSATZ)]))) {
    if ((await loadJson<Sperrliste>(name)) === null) continue;
    await updateJson<Sperrliste>(name, cur => { const r = sperrlisteOhne(saeubern(cur), k); n += r.entfernt; return r.entfernt ? { eintraege: r.eintraege } : (cur ?? { eintraege: [] }); });
  }
  return n;
}

/**
 * Nachtragen: jede Person mit Werbesperre gehört auf die Liste — auch wenn ein Schreibweg (ZOE, ältere Wege)
 * die Liste nicht selbst gepflegt hat. Läuft vor jedem Import; idempotent.
 */
export async function sperrlisteNachtragen(kontakte: Kontakt[]): Promise<number> {
  let n = 0;
  const gesperrt = kontakte.filter(k => k.werbesperre);
  const jeTag = new Map<string, Kontakt[]>();
  for (const k of gesperrt) { const t = k.werbesperre!.seit; jeTag.set(t, [...(jeTag.get(t) ?? []), k]); }
  for (const [tag, l] of Array.from(jeTag)) n += await sperren(l, 'werbesperre', tag);
  return n;
}
