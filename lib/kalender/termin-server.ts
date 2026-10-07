// ─── Kalender — Termine, die MAKE OS SELBST schreibt (Server, 29.09., Paket K5) ─
// Derselbe Weg wie die Termin-Route (/api/kalender/termin), aber ohne Browser: für Vorgänge, die auf dem Server
// laufen — Blöcke von ZOE (`plan_block`) und vom Kalender-Agenten, die Übernahme der Wochenplan-Blöcke, die Spiegel
// von Make.One-Events und Familien-Terminen (lib/kalender/spiegel-server.ts). Reihenfolge wie in der Route:
//   1. iCloud (anlegen/ändern/löschen, mit ETag)  2. `kalender-bezug` (Kennungen + Sicherung von Art/privat, `von`)
//   3. Änderungsprotokoll (`kalender`/`termine`: UID + Feldnamen, nie Titel) — das ist das Audit-Log jeder
//      Kalender-Schreibaktion, auch der autonomen (KALENDER_VERBINDUNGEN.md 4h).
// Nie Teilnehmer (MAKE OS verschickt keine Einladungen). Ohne iCloud UND ohne Google: KalenderFehler 409.
// Google (03.10.): WOHIN ein neuer Termin kommt, entscheidet nur `kalenderZiel(person, bereich)` (lib/kalender/google/ziel.ts):
// `bereich: 'business'` → der Google Kalender der Person (wenn verbunden), sonst/„privat“/„gemeinsam“ → iCloud wie bisher.
// Geschrieben wird danach über dieselben Funktionen (`anlegen` verteilt nach Kalender an iCloud oder Google).
// Seit R-K1 (#46): Bezug und Protokoll unter dem Schlüssel `kalender|uid`; `uid` der Aufrufer darf auch die alte reine
// UID sein (die Spiegel tragen ihre feste UID) — der alte Bezug-Eintrag zieht dabei mit um, wenn die UID eindeutig ist.

import { verbunden, anlegen, aendern, loeschen, terminAufloesen, ladeStand, kalenderNachName, KalenderFehler, type KalenderEintrag } from './icloud';
import { persoenlichFremd, eigenesBlockZiel } from './icloud-person';
import { kalenderZiel, googleKalenderNamen } from './google/ziel';
import type { KalenderBereich } from './bereich';
import { ladeEinstellungen, type Wer } from './einstellungen';
import { bezugSetzen } from './bezug-server';
import { uidVonSchluessel, type BezugKennungen } from './bezug';
import type { Aenderung } from './ics';
import type { IcsArt, BlockArt } from './arten';
import { protokolliere, type Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';

export interface ServerTermin {
  titel: string; start: string; ende: string; ganztags?: boolean;
  /** Wessen Kalender (Einstellungen) — oder `kalender` (Name) direkt. */
  wer: Wer; kalender?: string;
  /**
   * Wohin gehört der Termin (03.10., Google): `business` = Kalender der Person bei Google (sobald verbunden), `privat`
   * (Standard, wie bisher) und `gemeinsam` = iCloud. Ohne Wirkung, wenn `kalender` (Name) gesetzt ist — diese Wahl gilt.
   */
  bereich?: KalenderBereich;
  art?: IcsArt; blockArt?: BlockArt; beschaeftigt?: boolean; ort?: string; notiz?: string;
  /** Feste, echte UID für idempotente Vorgänge (siehe icloud.ts `anlegen`). */
  uid?: string;
  /**
   * Kevin 07.10.: Blöcke (Planen, ZOE, Wochenplan) einer Person mit EIGENER iCloud-Verbindung gehen in deren eigenes Konto
   * (`eigenesBlockZiel`) statt in den Haushalts-Kalender. Nur ohne `kalender` und im Bereich privat; sonst wie bisher.
   */
  eigenesIcloud?: boolean;
  /** Kennungen → `kalender-bezug` (nie in den Termin). */
  bezug?: BezugKennungen;
  /** Wer ihn in MAKE OS anlegt (Speichername) — Eigentümer im Neben-Bestand. */
  von: string;
}

/** Der Kalender (Eintrag im Stand) zu einem Namen — Lesefehler → unbekannt (das Anlegen selbst scheitert dann ohnehin). */
async function zielKalender(name: string): Promise<KalenderEintrag | undefined> {
  try { return kalenderNachName(await ladeStand(), name); } catch { return undefined; }
}

/** Mindestens eine Quelle da: iCloud oder ein verbundener Google-Kalender (03.10.). */
async function nurVerbunden(): Promise<void> {
  if (verbunden()) return;
  if (Object.keys(await googleKalenderNamen()).length) return;
  // iCloud je Person (06.10.): eine eigene Verbindung reicht auch.
  if ((await import('./icloud-person').then(m => m.personenMitIcloud()).catch(() => [] as string[])).length) return;
  throw new KalenderFehler('Kein Kalender verbunden — iCloud (deploy/icloud-verbinden.sh) oder Google (Kalender › Einstellungen).', 409);
}

/** Anlegen + Bezug + Protokoll. `schonDa`: der Termin mit dieser festen UID lag schon in iCloud (nichts doppelt). */
export async function terminAnlegenServer(t: ServerTermin, wer: ProtokollWer): Promise<{ uid: string; schluessel: string; kalender: string; schonDa?: true }> {
  await nurVerbunden();
  const einst = await ladeEinstellungen();
  const art: IcsArt = t.art ?? 'termin';
  const eigen = !t.kalender && t.eigenesIcloud && (t.bereich ?? 'privat') === 'privat' && t.wer !== 'beide' ? await eigenesBlockZiel(t.wer).catch(() => undefined) : undefined;
  const ziel = t.kalender || eigen ? null : await kalenderZiel(t.wer, t.bereich ?? 'privat', einst);
  const kalender = t.kalender || eigen || ziel?.kalender;
  if (!kalender) throw new KalenderFehler('Für diese Person ist kein Kalender hinterlegt — der Termin wurde nicht angelegt.', 409);
  // iCloud je Person (06.10.): in den Kalender aus der eigenen Verbindung einer Person schreibt nur sie selbst (auch kein Systemlauf für andere).
  if (persoenlichFremd(await zielKalender(kalender), t.von)) throw new KalenderFehler('Dieser Kalender gehört zur iCloud-Verbindung einer anderen Person — dort legt MAKE OS nichts an.', 403);
  // Liegt der Zielkalender in iCloud, braucht es iCloud (ein Google-Ziel braucht es nicht).
  if (!verbunden() && ziel?.quelle !== 'google' && !Object.values(await googleKalenderNamen()).includes(kalender) && (await zielKalender(kalender))?.quelle !== 'icloud') throw new KalenderFehler('iCloud ist noch nicht verbunden (Kalender › Einstellungen › iCloud).', 409);
  const r = await anlegen({
    titel: t.titel, kalender, start: t.start, ende: t.ende, ganztags: !!t.ganztags,
    art, ...(art === 'block' && t.blockArt ? { blockArt: t.blockArt } : {}),
    ...(t.beschaeftigt !== undefined ? { beschaeftigt: t.beschaeftigt } : {}),
    ...(t.ort ? { ort: t.ort } : {}), ...(t.notiz ? { notiz: t.notiz } : {}), ...(t.uid ? { uid: t.uid } : {}),
    erinnerungenMin: [],
  });
  await bezugSetzen(r.schluessel, { ...(t.bezug ?? {}), von: t.von, tag: t.start.slice(0, 10), ...(art !== 'termin' ? { art } : {}) }, undefined, { altSchluessel: r.uid });
  if (!r.schonDa) await protokolliere('kalender', [{ liste: 'termine', op: 'neu', id: r.schluessel, felder: ['art', ...Object.keys(t.bezug ?? {})] }], wer);
  return r;
}

/** Einzeltermin ändern (+ Sicherung der Art, Bezüge) und protokollieren. */
export async function terminAendernServer(uid: string, a: Aenderung, wer: ProtokollWer, bezug?: Record<string, string | null>): Promise<void> {
  await nurVerbunden();
  const felder = Object.keys(a).filter(k => a[k as keyof Aenderung] !== undefined);
  // Schlüssel des Objekts; nur-Bezug-Änderungen an einem (noch) unbekannten Termin bleiben wie bisher beim Verweis.
  const ziel = (felder.length ? await aendern(uid, a) : null) ?? await terminAufloesen(uid) ?? { schluessel: uid, uid: uidVonSchluessel(uid), eindeutig: false };
  const teil: Record<string, unknown> = {
    ...(bezug ?? {}),
    ...(a.art !== undefined ? { art: a.art === 'termin' ? null : a.art } : {}),
    ...(a.start ? { tag: a.start.slice(0, 10) } : {}),
  };
  if (Object.keys(teil).length) await bezugSetzen(ziel.schluessel, teil, undefined, { altSchluessel: ziel.uid, altBehalten: !ziel.eindeutig });
  await protokolliere('kalender', [{ liste: 'termine', op: 'geaendert', id: ziel.schluessel, felder: [...felder, ...Object.keys(bezug ?? {})] }], wer);
}

/** Löschen (+ Bezug weg) und protokollieren. Schon weg → still ok. */
export async function terminLoeschenServer(uid: string, wer: ProtokollWer): Promise<void> {
  await nurVerbunden();
  const r = await loeschen(uid);
  await bezugSetzen(r.schluessel ?? uid, null, undefined, r.uid ? { altSchluessel: r.uid, altBehalten: !r.eindeutig } : {}).catch(() => { /* die Verbindungsprüfung meldet den Rest */ });
  await protokolliere('kalender', [{ liste: 'termine', op: 'geloescht', id: r.schluessel ?? uid }], wer);
}
