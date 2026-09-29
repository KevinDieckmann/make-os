// ─── CRM — gehashte Sperrliste je Haushalt (28.09., K2 #60/#64) ─────────────
// Die Werbesperre hing nur am Kontakt: wurde die Person gelöscht (Art. 17),
// legte der nächste Import der Masterliste sie ungesperrt neu an. Ab jetzt
// merkt sich der Haushalt, WER nicht mehr hereinkommt — ohne zu speichern,
// wer das ist: nur Fingerabdrücke der Merkmale (HMAC-SHA-256 v2, früher SHA-256 v1; persönliche E-Mail, HubSpot-ID,
// Name+Firma, je normalisiert wie der Import-Schlüssel), Grund und Tag.
// Keine Klartexte. Der Bestand liegt wie jeder andere verschlüsselt.
//
//   Speicher   crm-sperrliste--<haushalt>   { eintraege: [{ h: [sha256…], grund, am }] }
//   entsteht   Werbesperre (Kartei, Aktivität „Sperre“, Follow-up; vor jedem Import nachgetragen)
//              und Art.-17-Löschung (lib/crm/person-bestaende.ts personEntfernen)
//   wirkt      importieren(): eine gesperrte Zeile wird NICHT neu angelegt (Vorschau „n gesperrt übersprungen“)
//   endet      nur „Werbesperre aufheben“ mit Einwilligungs-Nachweis im selben Schritt (PATCH /api/state/kontakte)
//
// 29.09. (Paket D-B #71): HMAC-SHA-256 mit geheimem Pepper (lib/datenschutz/pepper.ts, Version v2) statt des
// ungesalzenen SHA-256 (v1). Neue Einträge entstehen in der aktuellen Version; GEPRÜFT wird gegen beide — v1-Hashes
// bereits gelöschter Personen bleiben gültig, solange ihr Eintrag besteht. Existierende Kontakte werden einmal je Pepper
// umgerechnet (`sperrlisteMigrieren`, Löschfristen-Lauf): ihre v1-Hashes werden durch v2 ersetzt. Ohne Pepper bleibt
// alles v1 (Warnung im Head of IT).
//
// Kompatibilitätsmodus (29.09. abends, MAKE_OS_FORMAT — Standard „kompatibel“, lib/store/huelle.mjs): der alte Online-Stand
// aeb4964 prüft nur v1. Damit eine Sperre auch nach einem Rückweg dorthin greift, tragen NEUE Einträge dann BEIDE Werte
// (v2 und v1), und bestehende v1-Hashes werden NICHT umgerechnet (`sperrlisteUmrechnen` tut nichts; der Löschfristen-Lauf
// überspringt die Umrechnung und holt sie nach, sobald MAKE_OS_FORMAT=v2 gilt). Geprüft wird wie immer gegen beide.
//
// Der Haushalt ist der des Inhabers — die Kartei (`kontakte`) gehört genau ihm.
// Ohne eingetragenen Haushalt heißt er „haupt“; wird später einer eingetragen,
// liest `sperrlisteLaden` den alten Stand mit (nie ein stiller Verlust).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { hmacHex, shaHex } from '@/lib/datenschutz/pepper';
import { formatModus } from '@/lib/store/huelle.mjs';
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

/** v1 (bis 29.09.): ungesalzener SHA-256 mit festem Vorsatz — nur noch zum Prüfen und Migrieren. */
export const sperrHashV1 = (merkmal: string) => shaHex(`make-os-sperre-v1|${merkmal}`);
/** v2 (29.09.): HMAC-SHA-256 mit Pepper — null ohne Pepper. */
export const sperrHashV2 = (merkmal: string) => hmacHex('make-os-sperre-v2', merkmal);
/** Ein Merkmal in der AKTUELLEN Version gehasht (v2 mit Pepper, sonst v1). */
export const sperrHash = (merkmal: string) => sperrHashV2(merkmal) ?? sperrHashV1(merkmal);
/**
 * Alle Hashes einer Person für NEUE Einträge (Sperrliste, Grabsteine). Format v2: nur die aktuelle Version (v2 mit Pepper,
 * sonst v1). Kompatibel: v2 UND v1 — so greift die Sperre auch im alten Stand aeb4964, der nur v1 kennt.
 * Leer, wenn die Person kein Merkmal trägt.
 */
export const sperrHashes = (k: Person) => {
  const m = identitaetsMerkmale(k);
  const aktuell = m.map(sperrHash);
  return formatModus() === 'v2' ? aktuell : Array.from(new Set([...aktuell, ...m.map(sperrHashV1)]));
};
/** Alle Hashes einer Person in JEDER Version (v2 und v1) — geprüft wird immer gegen beide. */
export const sperrHashesAlle = (k: Person) => { const m = identitaetsMerkmale(k); return Array.from(new Set([...m.map(sperrHash), ...m.map(sperrHashV1)])); };

/** Person aufnehmen (idempotent): gleicher Grund + Überschneidung → Hashes vereinen (v1 der Person wird dabei zu v2), sonst neuer Eintrag. */
export function sperrlisteMit(eintraege: SperrEintrag[], k: Person, grund: SperrGrund, am: string): { eintraege: SperrEintrag[]; geaendert: boolean } {
  const h = sperrHashes(k);
  if (!h.length) return { eintraege, geaendert: false };
  const alle = new Set(sperrHashesAlle(k));
  const i = eintraege.findIndex(e => e.grund === grund && e.h.some(x => alle.has(x)));
  if (i < 0) return { eintraege: [...eintraege, { h, grund, am: am.slice(0, 10) }], geaendert: true };
  const veraltet = new Set(alle); for (const x of h) veraltet.delete(x); // v1-Hashes dieser Person, wenn jetzt v2 gilt
  const vereint = Array.from(new Set([...eintraege[i].h.filter(x => !veraltet.has(x)), ...h]));
  if (vereint.length === eintraege[i].h.length && vereint.every(x => eintraege[i].h.includes(x))) return { eintraege, geaendert: false };
  return { eintraege: eintraege.map((e, j) => (j === i ? { ...e, h: vereint } : e)), geaendert: true };
}

/** Person herausnehmen: jeder Eintrag, der eines ihrer Merkmale trägt (v1 oder v2), fällt (er beschreibt diese Person). */
export function sperrlisteOhne(eintraege: SperrEintrag[], k: Person): { eintraege: SperrEintrag[]; entfernt: number } {
  const h = new Set(sperrHashesAlle(k));
  const rest = eintraege.filter(e => !e.h.some(x => h.has(x)));
  return { eintraege: rest, entfernt: eintraege.length - rest.length };
}

/** Prüfer für den Import: steht eines der Merkmale auf der Liste (v1 oder v2)? */
export function sperrPruefer(eintraege: SperrEintrag[]): (k: Person) => boolean {
  const alle = new Set(eintraege.flatMap(e => e.h));
  return k => alle.size > 0 && sperrHashesAlle(k).some(x => alle.has(x));
}

/** Der passende Eintrag der Sperrliste (erster Treffer, v1 oder v2) oder null — für Neuanlagen (28.09., Ablaufprüfung). */
export function sperrTreffer(eintraege: SperrEintrag[], k: Person): SperrEintrag | null {
  if (!eintraege.length) return null;
  const h = new Set(sperrHashesAlle(k));
  return eintraege.find(e => e.h.some(x => h.has(x))) ?? null;
}

/**
 * Einmalige Umrechnung v1 → v2 (29.09., #71), solange die Kontakte existieren: trägt ein Eintrag v1-Hashes einer Person
 * der Kartei, werden sie durch deren v2-Hashes ersetzt. v1-Hashes, zu denen es keine Person mehr gibt (gelöschte),
 * bleiben stehen und werden weiter geprüft. Ohne Pepper oder im Kompatibilitätsmodus (der alte Stand prüft nur v1):
 * nichts zu tun. Rein bis auf den Modus; liefert die Zahl umgerechneter Einträge.
 */
export function sperrlisteUmrechnen(eintraege: SperrEintrag[], kontakte: readonly Person[]): { eintraege: SperrEintrag[]; umgerechnet: number } {
  if (formatModus() !== 'v2' || !kontakte.length || !eintraege.length || sperrHashV2('probe') === null) return { eintraege, umgerechnet: 0 };
  const v1zuV2 = new Map<string, string>();
  for (const k of kontakte) for (const m of identitaetsMerkmale(k)) v1zuV2.set(sperrHashV1(m), sperrHash(m));
  let umgerechnet = 0;
  const neu = eintraege.map(e => {
    if (!e.h.some(x => v1zuV2.has(x))) return e;
    umgerechnet++;
    return { ...e, h: Array.from(new Set(e.h.map(x => v1zuV2.get(x) ?? x))) };
  });
  return { eintraege: umgerechnet ? neu : eintraege, umgerechnet };
}

/** Hinweistext, wenn eine Neuanlage auf der Sperrliste steht — ohne Namen (die Liste kennt keine). */
export const SPERR_HINWEIS = 'Diese Person steht auf der Sperrliste (früherer Werbewiderspruch oder Löschung) — angelegt, aber mit Werbesperre: nicht werblich ansprechen.';

/**
 * Neuanlage per Hand (Kartei, Visitenkarte, Einlass, Anfrage — 28.09., Ablaufprüfung): wie der Import prüfen, aber
 * nicht blockieren. Treffer → Werbesperre gesetzt (Grund aus der Liste) + Hinweis; sonst unverändert.
 */
export function neuanlageSperre<K extends Kontakt>(k: K, eintraege: SperrEintrag[], heute: string): { kontakt: K; hinweis?: string } {
  if (k.werbesperre) return { kontakt: k };
  const t = sperrTreffer(eintraege, k);
  if (!t) return { kontakt: k };
  const grund = t.grund === 'loeschung' ? 'Sperrliste: früher gelöscht (Art. 17)' : 'Sperrliste: früherer Werbewiderspruch (Art. 21)';
  return { kontakt: { ...k, werbesperre: { seit: heute, grund } }, hinweis: SPERR_HINWEIS };
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

/** Umrechnung v1 → v2 für alle Listen des Kartei-Haushalts (samt „haupt“) — idempotent, Zahl der umgerechneten Einträge. */
export async function sperrlisteMigrieren(kontakte: readonly Person[]): Promise<number> {
  const h = await karteiHaushalt();
  let n = 0;
  for (const name of Array.from(new Set([sperrlisteName(h), sperrlisteName(HAUSHALT_ERSATZ)]))) {
    if ((await loadJson<Sperrliste>(name)) === null) continue;
    await updateJson<Sperrliste>(name, cur => { const r = sperrlisteUmrechnen(saeubern(cur), kontakte); n += r.umgerechnet; return r.umgerechnet ? { eintraege: r.eintraege } : (cur ?? { eintraege: [] }); });
  }
  return n;
}

/**
 * Fertige Hashes aufnehmen (Grabsteine nach einem Restore, lib/datenschutz/grabsteine.ts): Eintrag mit Überschneidung
 * wird ergänzt, sonst neu. Idempotent. Liefert 1, wenn etwas geändert wurde.
 */
export async function sperrHashesAufnehmen(hashes: readonly string[], grund: SperrGrund, am: string): Promise<number> {
  const h = hashes.filter(x => /^[0-9a-f]{64}$/.test(x));
  if (!h.length) return 0;
  let n = 0;
  await updateJson<Sperrliste>(sperrlisteName(await karteiHaushalt()), cur => {
    const l = saeubern(cur);
    const i = l.findIndex(e => e.grund === grund && e.h.some(x => h.includes(x)));
    if (i < 0) { n = 1; return { eintraege: [...l, { h: Array.from(new Set(h)), grund, am: am.slice(0, 10) }] }; }
    const vereint = Array.from(new Set([...l[i].h, ...h]));
    if (vereint.length === l[i].h.length) return cur ?? { eintraege: l };
    n = 1;
    return { eintraege: l.map((e, j) => (j === i ? { ...e, h: vereint } : e)) };
  });
  return n;
}
