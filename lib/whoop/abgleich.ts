// ─── WHOOP — Abgleich je Person (Server, 08.10.2026) ─────────────────────────────────────────────────────────────────────
// Holt Recovery, Schlaf, Zyklen (Strain) und Workouts der Person über die API v2 (https://developer.whoop.com/api), hält den schlanken
// Spiegel `whoop-stand--<person>` und bildet ihn ab (lib/whoop/abbilden.ts): Vitalwerte (Handwert gewinnt) und Sport (idempotent).
//   · Art. 9: ohne Einwilligung (a) der Person (`gesundheitVerarbeitungErlaubt`) wird NICHTS abgefragt und nichts geschrieben.
//   · Erstabgleich: die letzten 90 Tage (seitenweise, 25 je Seite); danach ab dem letzten Erfolg − 3 Tage (Nachbewertungen).
//   · Ein Lauf je Person gleichzeitig. Fehler: 429 → Pause nach `X-RateLimit-Reset`; 5xx/Netz → Backoff 5 · 3^(n−1) min (höchstens 3 h);
//     Token abgelehnt → „getrennt“ + EINE Glocke (verbindung.ts). Nie ein Token oder ein Wert im Log.
//   · Spiegel-Löschfrist: Einträge älter als 400 Tage fallen beim nächsten Lauf heraus (`SPIEGEL_TAGE`); die übernommenen Werte in
//     Vitalwerten/Sport gehören der Person und bleiben.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import type { VitalsLog } from '@/lib/vitals';
import { saeubere, type SportStand } from '@/lib/sport/modell';
import { gesundheitVerarbeitungErlaubt } from '@/lib/datenschutz/gesundheit-einwilligung';
import { standName, whoopKonfig } from './konfig';
import { ladeVerbindung, userIdNachtragen, abgleichMoeglich, WhoopVerbindungsFehler } from './verbindung';
import { sammlungLesen, WhoopUeberlastet, vorlaeufig } from './api';
import { recoveryAus, schlafAus, zyklusAus, workoutAus, tageswerte, vitalsAnwenden, sportAnwenden, type WhoopSpiegelDaten, type WhoopTag } from './abbilden';

export const ERST_TAGE = 90;
export const UEBERLAPP_TAGE = 3;
export const SPIEGEL_TAGE = 400;
/** Ohne Webhook jede Stunde, mit kürzlich eingegangenem Webhook alle 6 Stunden (Rückfall; Strain hat keinen Webhook). */
export const TAKT_MIN = 60;
export const TAKT_MIT_WEBHOOK_MIN = 6 * 60;
/** Ein Webhook gilt als „aktiv“, wenn der letzte nicht älter ist als 48 h. */
const WEBHOOK_AKTIV_MS = 48 * 3_600_000;
/** Abgleich gilt als veraltet ab 26 h ohne Erfolg (Tageswerte kommen einmal am Morgen). */
export const VERALTET_MIN = 26 * 60;
export const SPUREN_MAX = 500;
const VOLL_ALLE_MS = 7 * 24 * 3_600_000;

export interface WhoopStand extends WhoopSpiegelDaten {
  v: 1;
  /** Ältester Tag, den der Spiegel vollständig abdeckt (nur ab hier entfernt der Abgleich gelöschte WHOOP-Werte). */
  abTag: string;
  letzterVersuch?: string;
  letzterErfolg?: string;
  /** Letzter voller Abgleich (90 Tage, Spiegel neu). */
  letzterVoll?: string;
  /** Kurzer Fehlertext ohne Werte/Token. */
  fehler?: string;
  fehlversuche?: number;
  /** ms — vorher kein neuer Versuch (429/Backoff). */
  pauseBis?: number;
  /** Letzter gültiger Webhook (Zeitpunkt). */
  webhookZuletzt?: string;
  /** `trace_id` der zuletzt verarbeiteten Webhooks (Doppelte erkennen), höchstens 500. */
  spuren?: string[];
  /** Fehlende Scopes (z. B. Workouts beim alten Token) — nur Namen. */
  hinweis?: string;
}

const leererStand = (abTag: string): WhoopStand => ({ v: 1, abTag, recovery: {}, schlaf: {}, zyklen: {}, workouts: {} });
export async function ladeWhoopStand(person: string): Promise<WhoopStand | null> {
  const s = await loadJson<WhoopStand>(standName(person));
  return s && s.v === 1 ? s : null;
}

const tagMinus = (tag: string, n: number) => { const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const kurz = (e: unknown) => (e instanceof Error ? e.message.replace(/Bearer\s+\S+/g, 'Bearer …').slice(0, 140) : 'Fehler');

/** Ist ein Lauf fällig? (rein) */
export function whoopFaellig(s: WhoopStand | null, jetzt = Date.now()): boolean {
  if (!s) return true;
  if (s.pauseBis && s.pauseBis > jetzt) return false;
  const webhook = !!s.webhookZuletzt && jetzt - Date.parse(s.webhookZuletzt) < WEBHOOK_AKTIV_MS;
  const takt = (webhook ? TAKT_MIT_WEBHOOK_MIN : TAKT_MIN) * 60_000;
  const zuletzt = Date.parse(s.letzterVersuch ?? '') || 0;
  return jetzt - zuletzt >= takt;
}

/** Wie alt ist der letzte gelungene Abgleich (Minuten)? null = noch nie. */
export function whoopAlter(s: WhoopStand | null, jetzt = Date.now()): { vorMin: number | null; veraltet: boolean; fehler?: string; webhook: boolean } {
  const t = s?.letzterErfolg ? Date.parse(s.letzterErfolg) : NaN;
  const vorMin = Number.isFinite(t) ? Math.max(0, Math.round((jetzt - t) / 60_000)) : null;
  return { vorMin, veraltet: vorMin === null || vorMin >= VERALTET_MIN, ...(s?.fehler ? { fehler: s.fehler } : {}), webhook: !!s?.webhookZuletzt && jetzt - Date.parse(s.webhookZuletzt) < WEBHOOK_AKTIV_MS };
}

/** Spiegel zurechtschneiden (rein): Einträge vor `ab` (Tag) fallen weg. */
export function spiegelSchneiden(s: WhoopStand, ab: string): WhoopStand {
  const behalte = <T>(o: Record<string, T>, zeit: (x: T) => string) => Object.fromEntries(Object.entries(o).filter(([, x]) => zeit(x).slice(0, 10) >= ab));
  return { ...s, abTag: s.abTag < ab ? ab : s.abTag, recovery: behalte(s.recovery, r => r.am), schlaf: behalte(s.schlaf, x => x.ende), zyklen: behalte(s.zyklen, z => z.start), workouts: behalte(s.workouts, w => w.start) };
}

/** Den Spiegel in Vitalwerte und Sport der Person abbilden (nur schreiben, was sich ändert). */
export async function abbildenFuer(person: string, s: WhoopStand): Promise<{ tage: number; trainings: number }> {
  const werte: Record<string, WhoopTag> = tageswerte(s);
  const vName = speicherFuer('vitals', person);
  const log = (await loadJson<VitalsLog>(vName)) ?? {};
  let tage = 0;
  if (vitalsAnwenden(log, werte, s.abTag).geaendert) {
    await updateJson<VitalsLog>(vName, cur => { const r = vitalsAnwenden(cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}, werte, s.abTag); tage = r.geaendert; return r.log; });
  }
  const sName = speicherFuer('sport', person);
  const roh = await loadJson<unknown>(sName);
  const workouts = Object.values(s.workouts);
  let trainings = 0;
  const probe = sportAnwenden(saeubere(roh), workouts, s.abTag);
  if (probe.neu + probe.geaendert + probe.entfernt) {
    await updateJson<SportStand>(sName, cur => { const r = sportAnwenden(saeubere(cur), workouts, s.abTag); trainings = r.neu + r.geaendert + r.entfernt; return r.stand; });
  }
  return { tage, trainings };
}

export interface AbgleichErgebnis { ok: boolean; grund?: 'nicht-konfiguriert' | 'nicht-verbunden' | 'getrennt' | 'einwilligung' | 'pause' | 'laeuft' | 'fehler'; tage?: number; trainings?: number; eintraege?: number; fehler?: string }

const laufend = new Map<string, Promise<AbgleichErgebnis>>();
export const whoopAbgleichLaeuft = (person: string): boolean => laufend.has(person);

/** Einen Abgleich für die Person — höchstens einer gleichzeitig (ein zweiter Aufruf bekommt denselben Lauf). */
export function whoopAbgleichen(person: string, opt: { voll?: boolean; jetzt?: number; trotzPause?: boolean } = {}): Promise<AbgleichErgebnis> {
  const l = laufend.get(person);
  if (l) return l;
  const p = abgleichLauf(person, opt).finally(() => laufend.delete(person));
  laufend.set(person, p);
  return p;
}

async function abgleichLauf(person: string, opt: { voll?: boolean; jetzt?: number; trotzPause?: boolean }): Promise<AbgleichErgebnis> {
  const jetzt = opt.jetzt ?? Date.now();
  if (!whoopKonfig()) return { ok: false, grund: 'nicht-konfiguriert' };
  const v = await ladeVerbindung(person);
  if (!v) return { ok: false, grund: 'nicht-verbunden' };
  if (v.status !== 'verbunden') return { ok: false, grund: 'getrennt' };
  // Art. 9 (05.10.): ohne Einwilligung (a) wird nichts abgefragt und nichts geschrieben.
  if (!(await gesundheitVerarbeitungErlaubt(person))) return { ok: false, grund: 'einwilligung' };
  const alt = await ladeWhoopStand(person);
  if (!opt.trotzPause && alt?.pauseBis && alt.pauseBis > jetzt) return { ok: false, grund: 'pause' };
  const heute = localDay(new Date(jetzt));
  // Voll (90 Tage, Spiegel neu) beim ersten Mal und einmal je Woche — so kommen auch Löschungen ohne Webhook an. Dazwischen nur
  // ab dem letzten Erfolg − 3 Tage (Teil-Läufe entfernen nichts: welches Zeitfeld `start` je Sammlung filtert, ist nicht belegt).
  const voll = opt.voll || !alt || !alt.letzterErfolg || !alt.letzterVoll || jetzt - Date.parse(alt.letzterVoll) > VOLL_ALLE_MS;
  const abTagLauf = voll ? tagMinus(heute, ERST_TAGE) : tagMinus(alt!.letzterErfolg!.slice(0, 10), UEBERLAPP_TAGE);
  const start = `${abTagLauf}T00:00:00.000Z`;
  await updateJson<WhoopStand>(standName(person), cur => ({ ...(cur && cur.v === 1 ? cur : leererStand(abTagLauf)), letzterVersuch: new Date(jetzt).toISOString() }));
  try {
    if (v.userId === null) await userIdNachtragen(person).catch(() => { /* Webhooks warten, der Abgleich läuft trotzdem */ });
    const rec = await sammlungLesen(person, '/v2/recovery', start);
    const schlaf = await sammlungLesen(person, '/v2/activity/sleep', start);
    const zyklen = await sammlungLesen(person, '/v2/cycle', start);
    const workouts = abgleichMoeglich(v) ? await sammlungLesen(person, '/v2/activity/workout', start) : { records: [], status: 403 };
    const fehlend = [rec, schlaf, zyklen, workouts].some(x => x.status === 403) ? 'WHOOP gewährt nicht alle Freigaben — bitte neu verbinden und alle Häkchen setzen.' : undefined;
    let eintraege = 0;
    const neu = await updateJson<WhoopStand>(standName(person), cur => {
      const basis = cur && cur.v === 1 && !voll ? cur : { ...leererStand(abTagLauf), ...(cur && cur.v === 1 ? { webhookZuletzt: cur.webhookZuletzt, spuren: cur.spuren, letzterVoll: cur.letzterVoll } : {}) };
      const s: WhoopStand = { ...basis, recovery: { ...basis.recovery }, schlaf: { ...basis.schlaf }, zyklen: { ...basis.zyklen }, workouts: { ...basis.workouts } };
      for (const r of rec.records) { const x = recoveryAus(r); if (x) { s.recovery[x.sleepId] = x; eintraege++; } }
      for (const r of schlaf.records) { const x = schlafAus(r); if (x) { s.schlaf[x.id] = x; eintraege++; } }
      for (const r of zyklen.records) { const x = zyklusAus(r); if (x) { s.zyklen[String(x.id)] = x; eintraege++; } }
      for (const r of workouts.records) { const x = workoutAus(r); if (x) { s.workouts[x.id] = x; eintraege++; } }
      const geschnitten = spiegelSchneiden(s, tagMinus(heute, SPIEGEL_TAGE));
      const { fehler: _f, fehlversuche: _n, pauseBis: _p, hinweis: _h, ...rest } = geschnitten;
      return { ...rest, ...(voll ? { abTag: abTagLauf < geschnitten.abTag ? geschnitten.abTag : abTagLauf } : {}), letzterVersuch: new Date(jetzt).toISOString(), letzterErfolg: new Date(jetzt).toISOString(), ...(voll ? { letzterVoll: new Date(jetzt).toISOString() } : {}), ...(fehlend ? { hinweis: fehlend } : {}) };
    });
    const a = await abbildenFuer(person, neu);
    return { ok: true, ...a, eintraege };
  } catch (e) {
    if (e instanceof WhoopVerbindungsFehler && e.code === 'getrennt') return { ok: false, grund: 'getrennt' };
    const ueber = e instanceof WhoopUeberlastet;
    await updateJson<WhoopStand>(standName(person), cur => {
      const s = cur && cur.v === 1 ? cur : leererStand(abTagLauf);
      const n = (s.fehlversuche ?? 0) + 1;
      const pause = ueber && e.sekunden ? e.sekunden * 1000 : Math.min(3 * 3_600_000, 5 * 60_000 * 3 ** (n - 1));
      return { ...s, fehler: kurz(e), fehlversuche: n, pauseBis: jetzt + pause };
    }).catch(() => { /* Stand nicht schreibbar — der nächste Takt versucht es */ });
    if (!ueber && !vorlaeufig(e)) console.warn(`[whoop] Abgleich: ${kurz(e)}`);
    return { ok: false, grund: 'fehler', fehler: kurz(e) };
  }
}

/** Ein von WHOOP gelöschtes Objekt (Webhook `*.deleted`) aus dem Spiegel nehmen und neu abbilden. */
export async function whoopEntfernen(person: string, art: 'sleep' | 'workout' | 'recovery', id: string): Promise<boolean> {
  if (!(await gesundheitVerarbeitungErlaubt(person))) return false;
  if (!(await ladeWhoopStand(person))) return false;
  let weg = false;
  const s = await updateJson<WhoopStand>(standName(person), cur => {
    if (!cur || cur.v !== 1) return cur as unknown as WhoopStand;
    const feld = art === 'sleep' ? 'schlaf' : art === 'workout' ? 'workouts' : 'recovery';
    if (!cur[feld][id]) return cur;
    weg = true;
    const o = { ...cur[feld] } as Record<string, unknown>;
    delete o[id];
    return { ...cur, [feld]: o } as WhoopStand;
  });
  if (weg && s?.v === 1) await abbildenFuer(person, s);
  return weg;
}
