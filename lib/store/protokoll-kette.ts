// ─── Hash-Kette über die Protokolle (05.10., Paket „Verschlüsselung lückenlos + Protokolle nachweisfest“) ─────────────
// Art. 5 Abs. 2 / Art. 32 DSGVO: Protokolle müssen zeigen können, dass sie nicht nachträglich geändert, gekürzt oder
// vertauscht wurden. Drei Familien tragen eine fortlaufende Kette:
//   · Änderungsprotokoll  `aenderungsprotokoll--<haushalt>--<JJJJ-MM>` (lib/store/aenderungsprotokoll.ts)
//   · Lese-Protokoll      `leseprotokoll--<haushalt>--<JJJJ-MM>`       (lib/store/leseprotokoll.ts)
//   · Anmeldeprotokoll    `anmeldungen` (rollend, 300 Einträge)        (lib/zugang/anmeldungen.ts)
//
// Aufbau (nur zusätzliche Felder — alte Leser sehen weiter `eintraege`):
//   Datei   `kette: { v: 1, alg, vor, start, seit, nachversiegelt?, nachversiegeltAnzahl?, verworfen? }`
//           vor   = Kopf der Vorgänger-Monatsdatei (letzter Hash) bzw. `anfang` — so hängen die Monate aneinander
//           start = Hash VOR dem ersten Eintrag: H(anfang | Name | vor) — bindet den Dateinamen (ein unter fremdem Monat
//                   oder Haushalt zurückgelegtes Protokoll fällt auf); bei rollenden Dateien der Hash des zuletzt
//                   verworfenen Eintrags (`verworfen` zählt sie)
//   Eintrag `h` = H(vorheriger Hash ⏎ kanonisches JSON des Eintrags ohne `h`), 32 Hex-Zeichen
//   H       = HMAC-SHA-256 mit dem Pepper (MAKE_OS_PEPPER, lib/datenschutz/pepper.ts), ohne Pepper SHA-256 (`alg`)
// Siegel  Bestand `protokoll-siegel`: je Datei Anzahl aller je angehängten Einträge + letzter Hash, nur steigend — so fällt
//         auch ein abgeschnittenes Ende auf (die Kette allein sähe es nicht). Das Siegel steht in jeder Sicherung.
//
// Bewusste Ausnahmen (sonst würde jede rechtmäßige Änderung als Manipulation gemeldet):
//   · Kontakt-Fingerabdrücke (`c2#…`, `c#…`, `c#geloescht`) gehen nur als „c#“ in den Hash — Art. 17 (Tilgen), die
//     Umrechnung v1 → v2 und der Kennungs-Umzug schreiben sie um. Geschützt bleiben Zeit, Person, Bestand, Art, Felder,
//     Reihenfolge und Anzahl.
//   · Ein Eintrag, der nicht mehr passt, aber „[gelöscht]“ trägt, zählt als „getilgt“ (Art. 17), nicht als Bruch.
//   · Monate, die der Löschfristen-Lauf geleert hat (`bereinigt`), unterbrechen die Kette sichtbar, aber erlaubt.
//
// Was die Kette NICHT kann: wer Datenschlüssel UND Pepper hat (root auf dem Server), kann alles neu rechnen. Sie belegt
// Unverändertheit gegenüber der App selbst, Fehlern, vertauschten/zurückgespielten Dateien und Teil-Restores — das Siegel
// in den Sicherungen (Mac, 12 Monate) macht spätere Änderungen gegenüber einem älteren Stand sichtbar.

import { promises as fs } from 'fs';
import { createHash } from 'node:crypto';
import { loadJson, updateJson, updateJsonAsync, datenOrdner } from './local-db';
import { hmacHex, pepperGesetzt } from '@/lib/datenschutz/pepper';

export type KettenAlg = 'hmac-sha256' | 'sha256';
export interface KettenKopf {
  v: 1; alg: KettenAlg; vor: string; start: string; seit: string;
  /** Einträge, die ohne Kette geschrieben waren (Altbestand, Rückweg auf den alten Stand) und erst später versiegelt wurden. */
  nachversiegelt?: string; nachversiegeltAnzahl?: number;
  /** Rollende Dateien (Anmeldeprotokoll): so viele Einträge sind vorne herausgefallen. */
  verworfen?: number;
}
export type KettenEintrag = Record<string, unknown> & { h?: string };
export interface KettenDatei { eintraege: KettenEintrag[]; kette?: KettenKopf; bereinigt?: { am: string; eintraege: number; grund?: string }; [k: string]: unknown }

export const KETTE_ANFANG = 'anfang';
export const SIEGEL_SPEICHER = 'protokoll-siegel';
export const PRUEFUNG_SPEICHER = 'protokoll-pruefung';
/** Monatsdateien mit Kette (Präfix--Haushalt--JJJJ-MM). */
export const MONATS_FAMILIEN = ['aenderungsprotokoll', 'leseprotokoll'] as const;
/** Rollende Einzeldateien mit Kette. */
export const ROLLENDE_FAMILIEN = ['anmeldungen'] as const;
const MONATS_DATEI = new RegExp(`^(${MONATS_FAMILIEN.join('|')})--([a-z0-9-]+)--(\\d{4}-\\d{2})$`);
const HASH_LAENGE = 32;

/** Fingerabdrücke von Kontakten (auch eingebettet, z. B. `c2#…:x`) — gehen nur als „c#“ in den Hash. */
const FINGERABDRUCK = /c2?#(?:geloescht|[0-9a-f]{8,})/g;
const GETILGT = '[gelöscht]';

/** Kanonisches JSON (Schlüssel sortiert, `h` weg, Fingerabdrücke normalisiert) — rein. */
export function kanon(wert: unknown): string {
  const lauf = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(FINGERABDRUCK, 'c#');
    if (Array.isArray(v)) return v.map(lauf);
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) if (k !== 'h' && (v as Record<string, unknown>)[k] !== undefined) o[k] = lauf((v as Record<string, unknown>)[k]);
      return o;
    }
    return v;
  };
  return JSON.stringify(lauf(wert));
}

/** Das Verfahren für NEUE Ketten: mit Pepper HMAC, sonst SHA-256. */
export const aktuellerAlg = (): KettenAlg => (pepperGesetzt() ? 'hmac-sha256' : 'sha256');

/** Ein Kettenglied (null: HMAC verlangt, aber kein Pepper gesetzt — dann nicht berechenbar). */
export function glied(alg: KettenAlg, vorher: string, text: string): string | null {
  if (alg === 'sha256') return createHash('sha256').update(`make-os-kette|${vorher}\n${text}`).digest('hex').slice(0, HASH_LAENGE);
  const h = hmacHex('make-os-kette', `${vorher}\n${text}`);
  return h ? h.slice(0, HASH_LAENGE) : null;
}
export const startHash = (alg: KettenAlg, name: string, vor: string) => glied(alg, KETTE_ANFANG, `${name}|${vor}`);
export const eintragHash = (alg: KettenAlg, vorher: string, e: KettenEintrag) => glied(alg, vorher, kanon(e));

/** Der Kopf einer Datei (letzter Hash; leer: der Start) — null ohne Kette. */
export function kopfVon(d: KettenDatei | null | undefined): string | null {
  if (!d?.kette) return null;
  const l = d.eintraege ?? [];
  for (let i = l.length - 1; i >= 0; i--) if (typeof l[i].h === 'string') return l[i].h as string;
  return d.kette.start;
}

/** Monatsdatei → Familie, Haushalt, Monat (null für andere Namen). */
export function monatsTeile(name: string): { familie: string; haushalt: string; monat: string } | null {
  const m = MONATS_DATEI.exec(name);
  return m ? { familie: m[1], haushalt: m[2], monat: m[3] } : null;
}

/** Alle Kettendateien im Datenordner (ohne .json), sortiert — Monatsdateien je Familie/Haushalt chronologisch. */
export async function kettenDateien(): Promise<string[]> {
  const namen = (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5));
  return namen.filter(n => !!monatsTeile(n) || (ROLLENDE_FAMILIEN as readonly string[]).includes(n)).sort();
}

/** Die Monatsdatei davor (derselbe Präfix und Haushalt) — oder null. */
async function vorgaengerName(name: string): Promise<string | null> {
  const t = monatsTeile(name);
  if (!t) return null;
  const praefix = `${t.familie}--${t.haushalt}--`;
  const davor = (await kettenDateien()).filter(n => n.startsWith(praefix) && monatsTeile(n)?.monat !== undefined && monatsTeile(n)!.monat < t.monat);
  return davor.length ? davor[davor.length - 1] : null;
}

/**
 * Kopf der Vorgängerdatei — eine noch ungesiegelte Vorgängerin (Altbestand) wird dabei versiegelt (in IHRER Sperre; die
 * Reihenfolge ist immer absteigend, also ohne Verklemmung). Geleert (Löschfrist) → `bereinigt:<name>`.
 */
async function vorgaengerKopf(name: string): Promise<string> {
  const vor = await vorgaengerName(name);
  if (!vor) return KETTE_ANFANG;
  const d = await loadJson<KettenDatei>(vor);
  if (d?.bereinigt && !d.kette) return `bereinigt:${vor}`;
  const k = kopfVon(d);
  if (k) return k;
  await anhaengenVerkettet(vor, []);
  return kopfVon(await loadJson<KettenDatei>(vor)) ?? KETTE_ANFANG;
}

/** Siegel nachziehen — nur steigend (zwei gleichzeitige Schreiber können sich nie zurücksetzen). */
async function siegeln(name: string, anzahl: number, kopf: string | null): Promise<void> {
  if (!kopf) return;
  await updateJson<{ dateien: Record<string, { anzahl: number; kopf: string; at: string }> }>(SIEGEL_SPEICHER, cur => {
    const dateien = { ...(cur?.dateien ?? {}) };
    const alt = dateien[name];
    if (alt && alt.anzahl >= anzahl) return cur ?? { dateien };
    dateien[name] = { anzahl, kopf, at: new Date().toISOString() };
    return { dateien };
  });
}

/**
 * Einträge anhängen und verketten — in der Schreibsperre der Datei. `max` (rollende Dateien): ältere fallen vorne heraus,
 * der Start rückt auf den Hash des letzten verworfenen. Ohne neue Einträge wird nur versiegelt (Altbestand). Alle anderen
 * Felder der Datei bleiben erhalten. Wirft wie updateJson (der Aufrufer entscheidet, ob ein Protokollfehler schluckt).
 */
export async function anhaengenVerkettet(name: string, neu: Record<string, unknown>[], opt: { max?: number; jetzt?: Date } = {}): Promise<void> {
  let siegel: { anzahl: number; kopf: string | null } | null = null;
  await updateJsonAsync<KettenDatei>(name, async cur => {
    const jetzt = (opt.jetzt ?? new Date()).toISOString();
    const d: KettenDatei = { ...(cur ?? {}), eintraege: Array.isArray(cur?.eintraege) ? [...cur!.eintraege] : [] };
    if (!neu.length && d.kette && d.eintraege.every(e => typeof e.h === 'string')) return cur ?? d; // schon versiegelt
    if (!neu.length && d.bereinigt && !d.eintraege.length) return cur ?? d; // geleert (Löschfrist): bleibt so
    let k: KettenKopf;
    if (d.kette?.v === 1) k = { ...d.kette };
    else {
      const alg = aktuellerAlg();
      const vor = await vorgaengerKopf(name);
      k = { v: 1, alg, vor, start: startHash(alg, name, vor) ?? '', seit: jetzt };
      // Altbestand ohne Kette: alle Einträge werden jetzt (sichtbar „nachversiegelt“) in die Kette genommen.
      d.eintraege = d.eintraege.map(e => { const { h: _h, ...rest } = e; return rest; });
    }
    // Einträge ohne Hash am Ende (Altbestand, oder der alte Stand schrieb nach einem Rückweg ohne Kette) — nachversiegeln.
    let i = d.eintraege.length;
    while (i > 0 && typeof d.eintraege[i - 1].h !== 'string') i--;
    const offen = d.eintraege.length - i;
    if (offen) { k.nachversiegelt = jetzt; k.nachversiegeltAnzahl = (k.nachversiegeltAnzahl ?? 0) + offen; }
    let vorher = i > 0 ? (d.eintraege[i - 1].h as string) : k.start;
    const versiegeln = (e: KettenEintrag): KettenEintrag => {
      const { h: _h, ...rest } = e;
      const h = eintragHash(k.alg, vorher, rest);
      if (!h) return rest; // HMAC-Kette ohne Pepper: nicht berechenbar — bleibt ungesiegelt, die Prüfung meldet es
      vorher = h;
      return { ...rest, h };
    };
    d.eintraege = [...d.eintraege.slice(0, i), ...d.eintraege.slice(i).map(versiegeln), ...neu.map(e => versiegeln(e as KettenEintrag))];
    if (opt.max && d.eintraege.length > opt.max) {
      const weg = d.eintraege.length - opt.max;
      const letzterWeg = d.eintraege[weg - 1].h;
      if (typeof letzterWeg === 'string') { k.start = letzterWeg; k.verworfen = (k.verworfen ?? 0) + weg; d.eintraege = d.eintraege.slice(weg); }
    }
    d.kette = k;
    siegel = { anzahl: (k.verworfen ?? 0) + d.eintraege.length, kopf: kopfVon(d) };
    return d;
  });
  const s = siegel as { anzahl: number; kopf: string | null } | null;
  if (s) await siegeln(name, s.anzahl, s.kopf);
}

// ── Prüfen ────────────────────────────────────────────────────────────────────

export type SiegelStand = 'ok' | 'fehlt' | 'gekuerzt' | 'abweichend' | 'hinkt';
export type VerbindungStand = 'ok' | 'anfang' | 'bruch' | 'nach-bereinigung' | 'nicht-pruefbar';
export interface DateiPruefung {
  name: string;
  anzahl: number;
  /** ok · fehler (Bruch, gekürzt, abweichend) · warnung (ungesiegelt, nicht prüfbar, Siegel fehlt) · bereinigt (Löschfrist) */
  stand: 'ok' | 'fehler' | 'warnung' | 'bereinigt';
  /** Positionen gebrochener Glieder (höchstens 10; -1 = Anfang). */
  brueche: number[];
  getilgt: number;
  ohneHash: number;
  verbindung: VerbindungStand;
  siegel: SiegelStand;
  nachversiegelt?: string;
  hinweis?: string;
}
export interface KettenPruefung {
  zeit: string; ok: boolean; dateien: number; eintraege: number; fehler: number; warnungen: number; getilgt: number;
  /** Nur Dateien, die nicht „ok“ sind (höchstens 30). */
  befunde: DateiPruefung[];
  familien: Record<string, { dateien: number; eintraege: number; fehler: number }>;
}

type SiegelDatei = { dateien?: Record<string, { anzahl: number; kopf: string; at: string }> };

/** Eine Datei prüfen (rein bis auf den Pepper). `vorgaenger` = die Datei davor in derselben Reihe (oder null). */
export function dateiPruefen(name: string, d: KettenDatei | null, vorgaenger: { name: string; d: KettenDatei | null } | null, siegel: { anzahl: number; kopf: string } | undefined): DateiPruefung {
  const eintraege = Array.isArray(d?.eintraege) ? d!.eintraege : [];
  const p: DateiPruefung = { name, anzahl: eintraege.length, stand: 'ok', brueche: [], getilgt: 0, ohneHash: 0, verbindung: 'ok', siegel: 'ok' };
  if (d?.bereinigt && !eintraege.length) {
    p.stand = 'bereinigt'; p.verbindung = 'nicht-pruefbar';
    p.siegel = !siegel || d.bereinigt.eintraege >= siegel.anzahl ? 'ok' : 'gekuerzt';
    if (p.siegel === 'gekuerzt') { p.stand = 'fehler'; p.hinweis = `vor dem Leeren fehlten Einträge (${d.bereinigt.eintraege} von ${siegel!.anzahl})`; }
    return p;
  }
  const k = d?.kette;
  if (!k || k.v !== 1) {
    p.stand = eintraege.length ? 'warnung' : 'ok';
    p.verbindung = 'nicht-pruefbar'; p.siegel = siegel ? 'abweichend' : 'fehlt';
    if (siegel) { p.stand = 'fehler'; p.hinweis = 'Kette entfernt — das Siegel kennt diese Datei'; }
    else p.hinweis = 'noch nicht versiegelt (Altbestand — die nächtliche Durchsicht versiegelt)';
    return p;
  }
  if (k.alg === 'hmac-sha256' && !pepperGesetzt()) {
    p.stand = 'warnung'; p.verbindung = 'nicht-pruefbar'; p.siegel = siegel ? 'ok' : 'fehlt';
    p.hinweis = 'mit Pepper versiegelt, MAKE_OS_PEPPER fehlt jetzt — nicht prüfbar';
    return p;
  }
  // Anfang
  const verworfen = k.verworfen ?? 0;
  if (!verworfen && k.start !== startHash(k.alg, name, k.vor)) p.brueche.push(-1);
  // Glieder
  let vorher = k.start;
  let letzterMitHash = -1;
  eintraege.forEach((e, i) => { if (typeof e.h === 'string') letzterMitHash = i; });
  eintraege.forEach((e, i) => {
    if (typeof e.h !== 'string') {
      p.ohneHash++;
      if (i < letzterMitHash && p.brueche.length < 10) p.brueche.push(i); // ein Loch mitten in der Kette = eingeschoben
      return;
    }
    const soll = eintragHash(k.alg, vorher, e);
    if (soll !== e.h) {
      if (kanon(e).includes(GETILGT)) p.getilgt++;
      else if (p.brueche.length < 10) p.brueche.push(i);
    }
    vorher = e.h;
  });
  // Verbindung zur Vorgängerdatei
  if (verworfen) p.verbindung = 'ok';
  else if (k.vor === KETTE_ANFANG) p.verbindung = vorgaenger ? 'bruch' : 'anfang';
  else if (k.vor.startsWith('bereinigt:')) p.verbindung = 'nach-bereinigung';
  else if (!vorgaenger) p.verbindung = 'bruch';
  else if (vorgaenger.d?.bereinigt && !(vorgaenger.d.eintraege ?? []).length) p.verbindung = 'nach-bereinigung';
  else {
    const vk = vorgaenger.d?.kette;
    const hashes = new Set<string>([...(vk ? [vk.start] : []), ...(vorgaenger.d?.eintraege ?? []).map(e => e.h).filter((h): h is string => typeof h === 'string')]);
    p.verbindung = hashes.has(k.vor) ? 'ok' : 'bruch';
  }
  // Siegel
  const gesamt = verworfen + eintraege.length;
  const kopf = kopfVon(d);
  if (!siegel) p.siegel = 'fehlt';
  else if (siegel.anzahl > gesamt) p.siegel = 'gekuerzt';
  else if (siegel.anzahl === gesamt) p.siegel = siegel.kopf === kopf ? 'ok' : 'abweichend';
  else {
    const idx = siegel.anzahl - verworfen - 1;
    const h = idx >= 0 ? eintraege[idx]?.h : idx === -1 ? k.start : undefined;
    p.siegel = idx < -1 || h === siegel.kopf ? 'hinkt' : 'abweichend';
  }
  if (k.nachversiegelt) p.nachversiegelt = k.nachversiegelt;
  const fehler = p.brueche.length > 0 || p.verbindung === 'bruch' || p.siegel === 'gekuerzt' || p.siegel === 'abweichend';
  const warnung = p.ohneHash > 0 || p.siegel === 'fehlt';
  p.stand = fehler ? 'fehler' : warnung ? 'warnung' : 'ok';
  if (fehler) p.hinweis = [
    p.brueche.length ? `Eintrag ${p.brueche.map(b => (b < 0 ? 'Anfang' : `#${b + 1}`)).join(', ')} verändert oder eingeschoben` : '',
    p.verbindung === 'bruch' ? 'Verbindung zum Vormonat passt nicht (vertauscht, zurückgespielt oder Vormonat fehlt)' : '',
    p.siegel === 'gekuerzt' ? `gekürzt: Siegel kennt ${siegel!.anzahl}, da sind ${gesamt}` : '',
    p.siegel === 'abweichend' ? 'letzter Eintrag weicht vom Siegel ab' : '',
  ].filter(Boolean).join(' · ');
  else if (warnung) p.hinweis = p.ohneHash ? `${p.ohneHash} Einträge am Ende noch ohne Hash (werden beim nächsten Anhängen versiegelt)` : 'ohne Siegel';
  return p;
}

/** Alle Kettendateien prüfen — nur lesen. */
export async function kettenPruefen(jetzt = new Date()): Promise<KettenPruefung> {
  const namen = await kettenDateien();
  const siegel = ((await loadJson<SiegelDatei>(SIEGEL_SPEICHER).catch(() => null))?.dateien) ?? {};
  const r: KettenPruefung = { zeit: jetzt.toISOString(), ok: true, dateien: 0, eintraege: 0, fehler: 0, warnungen: 0, getilgt: 0, befunde: [], familien: {} };
  let reihe = '';
  let vorgaenger: { name: string; d: KettenDatei | null } | null = null;
  for (const name of namen) {
    const t = monatsTeile(name);
    const dieseReihe = t ? `${t.familie}--${t.haushalt}` : name;
    if (dieseReihe !== reihe) { reihe = dieseReihe; vorgaenger = null; }
    let d: KettenDatei | null = null;
    let p: DateiPruefung;
    try {
      d = await loadJson<KettenDatei>(name);
      p = dateiPruefen(name, d, vorgaenger, siegel[name]);
    } catch (e) {
      p = { name, anzahl: 0, stand: 'fehler', brueche: [], getilgt: 0, ohneHash: 0, verbindung: 'nicht-pruefbar', siegel: 'fehlt', hinweis: `nicht lesbar: ${e instanceof Error ? e.message.slice(0, 80) : 'unbekannt'}` };
    }
    const familie = t?.familie ?? name;
    const f = (r.familien[familie] ??= { dateien: 0, eintraege: 0, fehler: 0 });
    f.dateien++; f.eintraege += p.anzahl; r.dateien++; r.eintraege += p.anzahl; r.getilgt += p.getilgt;
    if (p.stand === 'fehler') { r.fehler++; f.fehler++; }
    if (p.stand === 'warnung') r.warnungen++;
    if (p.stand !== 'ok' && p.stand !== 'bereinigt' && r.befunde.length < 30) r.befunde.push(p);
    vorgaenger = { name, d };
  }
  // Ein Siegel ohne Datei: die Datei wurde gelöscht.
  for (const name of Object.keys(siegel)) {
    if (namen.includes(name)) continue;
    r.fehler++;
    if (r.befunde.length < 30) r.befunde.push({ name, anzahl: 0, stand: 'fehler', brueche: [], getilgt: 0, ohneHash: 0, verbindung: 'nicht-pruefbar', siegel: 'gekuerzt', hinweis: `Datei fehlt — das Siegel kennt ${siegel[name].anzahl} Einträge` });
  }
  r.ok = r.fehler === 0;
  return r;
}

/** Ungesiegelte Altbestände versiegeln (nächtlich, vor der Prüfung) — ändert keine Einträge, ergänzt nur die Kette. */
export async function protokolleVersiegeln(): Promise<number> {
  let n = 0;
  for (const name of await kettenDateien()) {
    const d = await loadJson<KettenDatei>(name).catch(() => null);
    if (!d || (d.bereinigt && !(d.eintraege ?? []).length)) continue;
    if (d.kette && (d.eintraege ?? []).every(e => typeof e.h === 'string')) continue;
    try { await anhaengenVerkettet(name, []); n++; } catch (e) { console.error(`[kette] ${name} nicht versiegelt:`, e instanceof Error ? e.message : e); }
  }
  return n;
}

/** Versiegeln, prüfen, Ergebnis merken (Bestand `protokoll-pruefung`) — der Takt (Durchsicht) und System › Nachweise. */
export async function kettePruefenUndMerken(jetzt = new Date()): Promise<KettenPruefung> {
  await protokolleVersiegeln();
  const p = await kettenPruefen(jetzt);
  await updateJson<{ letzter?: KettenPruefung }>(PRUEFUNG_SPEICHER, () => ({ letzter: p }));
  if (!p.ok) console.error(`[kette] Protokoll-Kette: ${p.fehler} Datei(en) mit Bruch — ${p.befunde.filter(b => b.stand === 'fehler').map(b => b.name).slice(0, 5).join(', ')}`);
  return p;
}

/** Das letzte gemerkte Ergebnis (für den Head of IT). */
export async function letztePruefung(): Promise<KettenPruefung | null> {
  return (await loadJson<{ letzter?: KettenPruefung }>(PRUEFUNG_SPEICHER).catch(() => null))?.letzter ?? null;
}
