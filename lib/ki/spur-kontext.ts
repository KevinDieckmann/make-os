// ─── Lauf-Spur: der Zusammenhang im Prozess (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md C9) — nur Server ──────────────
// Wie die Lauf-Art (lib/datenschutz/ki-lauf.ts) wandert die Spur im selben Prozess über AsyncLocalStorage: ein ZOE-Zug, ein Head- oder
// Mitarbeiter-Lauf öffnet einen Abschnitt (`mitSpur`, lib/agenten/spur-server.ts); jeder Modellaufruf darin (`askText`/`askStream` →
// `kiAufruf`) zählt in den Sammler dieses Abschnitts — Token, Cache, Kosten, Zahl der Aufrufe. Ein Kind-Abschnitt (ZOE fragt einen Head,
// ein Head-Lauf) bekommt seinen EIGENEN Sammler, damit nichts doppelt zählt. Über die Warteschlange wandert die Spur im Auftrag
// (`Auftrag.spur`), über interne Sprünge im Kopf `x-make-spur` (nur Dienstweg). Nie Inhalte — nur Kennungen und Zahlen.

import { AsyncLocalStorage } from 'node:async_hooks';
import { SPUR_KOPF, leereWerkzeugZaehler, spurKopfWert, type SpurBereich, type SpurBezug, type SpurToken, type SpurWerkzeuge } from '@/lib/agenten/spur';
import type { ErgebnisArt, Fehlerklasse } from '@/lib/werkzeuge/vertrag';

/** Was ein offener Abschnitt über seine Modellaufrufe sammelt. */
export interface SpurSammler {
  aufrufe: number;
  token: SpurToken;
  /** US-Cent, ungerundet. */
  cent: number;
  /** Das zuletzt gerufene Modell. */
  modell?: string;
  /** Aufrufe, die ein Tor gesperrt hat (Datenschutz, Budget) — der Abschnitt gilt dann als „gesperrt“, nicht als Fehler. */
  gesperrt: number;
  /** Zeit bis zum ersten Wort (ms seit Beginn), einmal gesetzt. */
  ersteWortMs?: number;
  /** Ausgänge der Werkzeug-Aufrufe in diesem Abschnitt (V3, `werkzeugAusgangVermerken`) — ohne Kind-Abschnitte. */
  wz?: SpurWerkzeuge;
}

export interface SpurKontext {
  kette: string;
  /** Der aktuelle Abschnitt (Eltern für alles, was darin beginnt). */
  lauf: string;
  bereich: SpurBereich;
  person: string | null;
  /** Nur in einem offenen Abschnitt; ohne Sammler (wiederhergestellt aus Auftrag oder Kopf) wird jeder Modellaufruf ein eigener Abschnitt `modell`. */
  sammler?: SpurSammler;
  /** Beginn des Abschnitts (ms). */
  beginn: number;
}

const speicher = new AsyncLocalStorage<SpurKontext>();

/** Die Spur des laufenden Codes — oder undefined. */
export const spurJetzt = (): SpurKontext | undefined => speicher.getStore();

/** `fn` in diesem Zusammenhang ausführen. */
export function imSpurKontext<T>(k: SpurKontext, fn: () => Promise<T>): Promise<T> { return speicher.run(k, fn); }

/** Der Bezug für Kinder (Warteschlange, Sprung): Kette, Eltern = aktueller Abschnitt, Bereich. */
export function spurBezugJetzt(): SpurBezug | null {
  const k = spurJetzt();
  return k ? { kette: k.kette, eltern: k.lauf, bereich: k.bereich } : null;
}

/** Kopf für interne Sprünge (`runAgent`, `lib/zoe/innen.ts`) — leer ohne Spur. Nur der Dienstweg glaubt ihn (`kiAus`, Lauf-Routen). */
export function spurKopfFuerSprung(): Record<string, string> {
  const b = spurBezugJetzt();
  return b ? { [SPUR_KOPF]: spurKopfWert(b) } : {};
}

/** Erstes Wort vermerken (nur das erste zählt) — der ZOE-Zug ruft das beim ersten Text-Stück im Strom. */
export function erstesWortVermerken(jetzt = Date.now()): void {
  const k = spurJetzt();
  if (k?.sammler && k.sammler.ersteWortMs === undefined) k.sammler.ersteWortMs = Math.max(0, jetzt - k.beginn);
}

export const neuerSammler = (): SpurSammler => ({ aufrufe: 0, token: { ein: 0, aus: 0, cacheLesen: 0, cacheSchreiben: 0 }, cent: 0, gesperrt: 0 });

/**
 * Ausgang EINES Werkzeug-Aufrufs vermerken (10.10., Paket V3): in den Sammler des offenen Abschnitts — Art, Fehlerklasse und ob der Text-Rückfall
 * griff (`rueckfall`, Ziel 0). Ohne offenen Abschnitt (Freigabe aus dem Stapel, Takt ohne Kette): nichts. Wirft nie. Nur Zahlen.
 */
export function werkzeugAusgangVermerken(art: ErgebnisArt, o: { klasse?: Fehlerklasse; rueckfall?: boolean } = {}): void {
  const s = spurJetzt()?.sammler;
  if (!s) return;
  const w = s.wz ?? (s.wz = leereWerkzeugZaehler());
  if (art === 'erfolg') w.erfolg++;
  else if (art === 'abgelehnt') w.abgelehnt++;
  else if (art === 'fehler') w.fehler++;
  else w.freigabe++;
  if (o.klasse) (w.klassen ??= {})[o.klasse] = ((w.klassen ?? {})[o.klasse] ?? 0) + 1;
  if (o.rueckfall) w.rueckfall++;
}
