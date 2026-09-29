// ─── Kalender — Termine, die MAKE OS SELBST schreibt (Server, 29.09., Paket K5) ─
// Derselbe Weg wie die Termin-Route (/api/kalender/termin), aber ohne Browser: für Vorgänge, die auf dem Server
// laufen — Blöcke von ZOE (`plan_block`) und vom Kalender-Agenten, die Übernahme der Wochenplan-Blöcke, die Spiegel
// von Make.One-Events und Familien-Terminen (lib/kalender/spiegel-server.ts). Reihenfolge wie in der Route:
//   1. iCloud (anlegen/ändern/löschen, mit ETag)  2. `kalender-bezug` (Kennungen + Sicherung von Art/privat, `von`)
//   3. Änderungsprotokoll (`kalender`/`termine`: UID + Feldnamen, nie Titel) — das ist das Audit-Log jeder
//      Kalender-Schreibaktion, auch der autonomen (KALENDER_VERBINDUNGEN.md 4h).
// Nie Teilnehmer (MAKE OS verschickt keine Einladungen). Ohne iCloud: KalenderFehler 409.

import { verbunden, anlegen, aendern, loeschen, KalenderFehler } from './icloud';
import { ladeEinstellungen, type Wer } from './einstellungen';
import { bezugSetzen } from './bezug-server';
import type { BezugKennungen } from './bezug';
import type { Aenderung } from './ics';
import type { IcsArt, BlockArt } from './arten';
import { protokolliere, type Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';

export interface ServerTermin {
  titel: string; start: string; ende: string; ganztags?: boolean;
  /** Wessen Kalender (Einstellungen) — oder `kalender` (Name) direkt. */
  wer: Wer; kalender?: string;
  art?: IcsArt; blockArt?: BlockArt; beschaeftigt?: boolean; ort?: string; notiz?: string;
  /** Feste, echte UID für idempotente Vorgänge (siehe icloud.ts `anlegen`). */
  uid?: string;
  /** Kennungen → `kalender-bezug` (nie in den Termin). */
  bezug?: BezugKennungen;
  /** Wer ihn in MAKE OS anlegt (Speichername) — Eigentümer im Neben-Bestand. */
  von: string;
}

function nurVerbunden() {
  if (!verbunden()) throw new KalenderFehler('iCloud ist noch nicht verbunden (deploy/icloud-verbinden.sh).', 409);
}

/** Anlegen + Bezug + Protokoll. `schonDa`: der Termin mit dieser festen UID lag schon in iCloud (nichts doppelt). */
export async function terminAnlegenServer(t: ServerTermin, wer: ProtokollWer): Promise<{ uid: string; kalender: string; schonDa?: true }> {
  nurVerbunden();
  const einst = await ladeEinstellungen();
  const art: IcsArt = t.art ?? 'termin';
  const r = await anlegen({
    titel: t.titel, kalender: t.kalender || einst.kalender[t.wer], start: t.start, ende: t.ende, ganztags: !!t.ganztags,
    art, ...(art === 'block' && t.blockArt ? { blockArt: t.blockArt } : {}),
    ...(t.beschaeftigt !== undefined ? { beschaeftigt: t.beschaeftigt } : {}),
    ...(t.ort ? { ort: t.ort } : {}), ...(t.notiz ? { notiz: t.notiz } : {}), ...(t.uid ? { uid: t.uid } : {}),
    erinnerungenMin: [],
  });
  await bezugSetzen(r.uid, { ...(t.bezug ?? {}), von: t.von, tag: t.start.slice(0, 10), ...(art !== 'termin' ? { art } : {}) });
  if (!r.schonDa) await protokolliere('kalender', [{ liste: 'termine', op: 'neu', id: r.uid, felder: ['art', ...Object.keys(t.bezug ?? {})] }], wer);
  return r;
}

/** Einzeltermin ändern (+ Sicherung der Art, Bezüge) und protokollieren. */
export async function terminAendernServer(uid: string, a: Aenderung, wer: ProtokollWer, bezug?: Record<string, string | null>): Promise<void> {
  nurVerbunden();
  const felder = Object.keys(a).filter(k => a[k as keyof Aenderung] !== undefined);
  if (felder.length) await aendern(uid, a);
  const teil: Record<string, unknown> = {
    ...(bezug ?? {}),
    ...(a.art !== undefined ? { art: a.art === 'termin' ? null : a.art } : {}),
    ...(a.start ? { tag: a.start.slice(0, 10) } : {}),
  };
  if (Object.keys(teil).length) await bezugSetzen(uid, teil);
  await protokolliere('kalender', [{ liste: 'termine', op: 'geaendert', id: uid, felder: [...felder, ...Object.keys(bezug ?? {})] }], wer);
}

/** Löschen (+ Bezug weg) und protokollieren. Schon weg → still ok. */
export async function terminLoeschenServer(uid: string, wer: ProtokollWer): Promise<void> {
  nurVerbunden();
  await loeschen(uid);
  await bezugSetzen(uid, null).catch(() => { /* die Verbindungsprüfung meldet den Rest */ });
  await protokolliere('kalender', [{ liste: 'termine', op: 'geloescht', id: uid }], wer);
}
