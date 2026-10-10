// ─── Lauf-Spur: schreiben, lesen, aufräumen (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md C9) — nur Server ──────────────
// Regeln und Form: lib/agenten/spur.ts (rein). Zusammenhang im Prozess: lib/ki/spur-kontext.ts (AsyncLocalStorage).
//
//   mitSpur            öffnet einen Abschnitt (ZOE-Zug, Head-/Mitarbeiter-Lauf): Kette und Eltern aus dem laufenden Zusammenhang, eigener
//                      Sammler; am Ende EIN Eintrag (Token/Kosten aus dem Sammler, Ausgang vom Aufrufer). Wirft der Abschnitt, wird er als
//                      „fehler“ vermerkt und der Fehler weitergereicht.
//   mitSpurBezug       stellt den Zusammenhang aus Auftrag bzw. Kopf wieder her (ohne Sammler — Kind-Abschnitte öffnen ihren eigenen).
//   modellAufruf       aus `kiAufruf` (lib/anthropic.ts): zählt in den Sammler des offenen Abschnitts; ohne offenen Abschnitt, aber mit Bezug
//                      (Sprung über die Warteschlange oder `x-make-spur`) wird der Aufruf ein eigener Abschnitt `modell`.
//   spurAusAnfrage     liest `x-make-spur` — NUR auf dem Dienstweg (ein Browser kann sich keiner fremden Kette anhängen).
//   spurLesen          die Monatsdateien der erlaubten Bereiche (die Route entscheidet, welche — lib/agenten/spur.ts `kostenSicht`).
//   spurAufraeumen     Monate älter als 12 Monate leeren (nächtliche Durchsicht; Vermerk `bereinigt` — die Kette erkennt die Löschfrist).
// Geschrieben wird nur über `anhaengenVerkettet` (Hash-Kette + Siegel, Familie `lauf-spur` in MONATS_FAMILIEN), nie gewartet im Antwortweg:
// ein Fehler beim Vermerken verhindert nie eine Antwort (`spurWarten` für Tests und Abschaltung).

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { anhaengenVerkettet, type KettenDatei } from '@/lib/store/protokoll-kette';
import { istDienst } from '@/lib/zugang/dienst';
import { neueKennung } from '@/lib/kennung';
import type { AnbieterId } from '@/lib/ki/anbieter';
import { imSpurKontext, neuerSammler, spurJetzt, type SpurKontext, type SpurSammler } from '@/lib/ki/spur-kontext';
import {
  SPUR_AUFBEWAHRUNG_MONATE, SPUR_KOPF, spurBestand, spurMonat as monatBerlin, spurBestandTeile, spurKopfLesen, spurSaeubern,
  type SpurArt, type SpurBereich, type SpurBezug, type SpurEintrag, type SpurErgebnis,
} from './spur';

// ── Schreiben ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const offen = new Set<Promise<void>>();
/** Auf alle noch laufenden Spur-Schreibungen warten (Tests, Abschaltung). */
export async function spurWarten(): Promise<void> { while (offen.size) await Promise.allSettled(Array.from(offen)); }

/** Einen Eintrag anhängen (gesäubert, verkettet) — wartet nicht im Antwortweg, wirft nie. */
export function spurSchreiben(roh: Partial<SpurEintrag> | Record<string, unknown>): void {
  const e = spurSaeubern(roh);
  if (!e) return;
  const p = (async () => {
    try {
      await anhaengenVerkettet(spurBestand(e.bereich, monatBerlin(new Date(e.zeit))), [e as unknown as Record<string, unknown>]);
    } catch (x) {
      console.error('[lauf-spur] nicht vermerkt —', x instanceof Error ? x.message.slice(0, 160) : x);
    }
  })();
  offen.add(p);
  void p.finally(() => offen.delete(p));
}

// ── Abschnitte ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SpurStart {
  art: Exclude<SpurArt, 'modell'>;
  /** `zoe` · `head:<id>` · `mitarbeiter:<head>:<id>`. */
  agent: string;
  person: string | null;
  bereich: SpurBereich;
  /** Kennung des Abschnitts (z. B. die `laufId` eines Head-Laufs, damit `LaufSpan.lauf_id` am Thread dieselbe ist). */
  lauf?: string;
  /** Ausdrücklicher Eltern-Bezug — sonst der laufende Zusammenhang (AsyncLocalStorage). */
  bezug?: SpurBezug | null;
}
export interface SpurEnde { ergebnis: SpurErgebnis; werkzeuge?: number; modell?: string }
/** Was der Aufrufer am offenen Abschnitt sieht. */
export interface OffeneSpur {
  lauf: string;
  kette: string;
  eltern?: string;
  /** Zeit bis zum ersten Wort vermerken (nur das erste zählt). */
  erstesWort: () => void;
  /** Hat ein Tor einen Modellaufruf gesperrt? (Datenschutz, Budget — der Ausgang heißt dann „gesperrt“.) */
  gesperrt: () => boolean;
}

/**
 * Einen Abschnitt öffnen, `fn` darin ausführen und am Ende EINEN Eintrag schreiben. Token und Kosten kommen aus dem Sammler (jeder
 * Modellaufruf darin, ohne Kind-Abschnitte), der Ausgang aus `ende`. Ein gesperrter Modellaufruf macht aus „fehler“ den Ausgang „gesperrt“.
 */
export async function mitSpur<T>(s: SpurStart, fn: (o: OffeneSpur) => Promise<T>, ende: (t: T, o: OffeneSpur) => SpurEnde | null): Promise<T> {
  const lauf = s.lauf && /^lauf-[0-9a-f-]{36}$/.test(s.lauf) ? s.lauf : neueKennung('lauf');
  const oben = s.bezug ?? (() => { const k = spurJetzt(); return k ? { kette: k.kette, eltern: k.lauf, bereich: k.bereich } : null; })();
  const kette = oben?.kette ?? lauf;
  const beginn = Date.now();
  const sammler: SpurSammler = neuerSammler();
  const k: SpurKontext = { kette, lauf, bereich: s.bereich, person: s.person, sammler, beginn };
  const o: OffeneSpur = {
    lauf, kette, ...(oben ? { eltern: oben.eltern } : {}),
    erstesWort: () => { if (sammler.ersteWortMs === undefined) sammler.ersteWortMs = Math.max(0, Date.now() - beginn); },
    gesperrt: () => sammler.gesperrt > 0,
  };
  const vermerken = (e: SpurEnde) => {
    const jetzt = Date.now();
    const ergebnis: SpurErgebnis = e.ergebnis === 'fehler' && sammler.gesperrt > 0 ? 'gesperrt' : e.ergebnis;
    spurSchreiben({
      zeit: new Date(jetzt).toISOString(), lauf, kette, ...(oben ? { eltern: oben.eltern } : {}), art: s.art, agent: s.agent, person: s.person, bereich: s.bereich,
      start: new Date(beginn).toISOString(), dauerMs: jetzt - beginn, ...(sammler.ersteWortMs !== undefined ? { ttftMs: sammler.ersteWortMs } : {}),
      ...(e.modell ?? sammler.modell ? { modell: e.modell ?? sammler.modell } : {}), aufrufe: sammler.aufrufe, token: { ...sammler.token }, cent: sammler.cent,
      werkzeuge: e.werkzeuge ?? 0, ergebnis,
    });
  };
  let t: T;
  try {
    t = await imSpurKontext(k, () => fn(o));
  } catch (x) {
    vermerken({ ergebnis: 'fehler' });
    throw x;
  }
  // `null` = der Abschnitt hat nicht stattgefunden (z. B. vor dem Modell abgelehnt) — kein Eintrag.
  try { const e = ende(t, o); if (e) vermerken(e); } catch { /* das Vermerken darf nie den Lauf stören */ }
  return t;
}

/** Den Zusammenhang aus Auftrag bzw. Kopf wiederherstellen — ohne eigenen Abschnitt (Kind-Abschnitte öffnen ihren eigenen). */
export function mitSpurBezug<T>(b: SpurBezug | null | undefined, person: string | null, fn: () => Promise<T>): Promise<T> {
  if (!b) return fn();
  return imSpurKontext({ kette: b.kette, lauf: b.eltern, bereich: b.bereich, person, beginn: Date.now() }, fn);
}

/** `x-make-spur` lesen — NUR auf dem Dienstweg (interne Sprünge); sonst null. */
export function spurAusAnfrage(req: Request): SpurBezug | null {
  if (!istDienst(req)) return null;
  return spurKopfLesen(req.headers.get(SPUR_KOPF));
}

/**
 * Ein Modellaufruf (aus `kiAufruf`): in den Sammler des offenen Abschnitts — oder, ohne offenen Abschnitt aber mit Bezug (Warteschlange,
 * Sprung), als eigener Abschnitt `modell`. Ohne Spur: nichts. Wirft nie.
 */
export async function modellAufruf(a: {
  bezug?: SpurBezug | null; person: string | null; zweck: string; modell: string; anbieter?: AnbieterId;
  usage?: { ein: number; aus: number; cacheLesen: number; cacheSchreiben: number }; ergebnis: 'ok' | 'fehler' | 'gesperrt'; beginn: number;
}): Promise<void> {
  try {
    const k = spurJetzt();
    const u = a.usage ?? { ein: 0, aus: 0, cacheLesen: 0, cacheSchreiben: 0 };
    const { kosten } = await import('@/lib/zoe/verbrauch');
    const c = a.usage ? kosten(a.modell, u.ein, u.aus, u.cacheLesen, u.cacheSchreiben, a.anbieter && a.anbieter !== 'anthropic' ? a.anbieter : undefined) : 0;
    if (k?.sammler) {
      const s = k.sammler;
      s.aufrufe++; s.cent += c; s.modell = a.modell;
      s.token.ein += u.ein; s.token.aus += u.aus; s.token.cacheLesen += u.cacheLesen; s.token.cacheSchreiben += u.cacheSchreiben;
      if (a.ergebnis === 'gesperrt') s.gesperrt++;
      return;
    }
    const b: SpurBezug | null = k ? { kette: k.kette, eltern: k.lauf, bereich: k.bereich } : a.bezug ?? null;
    if (!b) return;
    const jetzt = Date.now();
    spurSchreiben({
      zeit: new Date(jetzt).toISOString(), lauf: neueKennung('lauf'), kette: b.kette, eltern: b.eltern, art: 'modell', agent: a.zweck, person: a.person ?? k?.person ?? null,
      bereich: b.bereich, start: new Date(a.beginn).toISOString(), dauerMs: jetzt - a.beginn, modell: a.modell, aufrufe: 1, token: u, cent: c, werkzeuge: 0,
      ergebnis: a.ergebnis === 'gesperrt' ? 'gesperrt' : a.ergebnis,
    });
  } catch { /* die Spur darf nie eine Antwort verhindern */ }
}

/** Kennungen des laufenden Abschnitts für das KI-Protokoll (`spur`, `kette`) — aus dem Zusammenhang oder dem Bezug des Aufrufs. */
export function spurFelder(bezug?: SpurBezug | null): { spur?: string; kette?: string } {
  const k = spurJetzt();
  if (k) return { spur: k.lauf, kette: k.kette };
  return bezug ? { spur: bezug.eltern, kette: bezug.kette } : {};
}

// ── Lesen und Aufräumen ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Monat (JJJJ-MM) minus n Monate (rein). */
function monatMinus(monat: string, n: number): string {
  const [j, m] = monat.split('-').map(Number);
  const z = j * 12 + (m - 1) - n;
  return `${Math.floor(z / 12)}-${String((z % 12) + 1).padStart(2, '0')}`;
}

/** Die Einträge der letzten `monate` Berliner Monate in den angegebenen Bereichen (andere Bereiche werden NICHT geladen). */
export async function spurLesen(o: { bereiche: readonly SpurBereich[]; monate?: number; jetzt?: Date }): Promise<SpurEintrag[]> {
  const jetzt = o.jetzt ?? new Date();
  const n = Math.min(Math.max(o.monate ?? 2, 1), SPUR_AUFBEWAHRUNG_MONATE);
  const heute = monatBerlin(jetzt);
  const raus: SpurEintrag[] = [];
  for (const bereich of o.bereiche) {
    for (let i = 0; i < n; i++) {
      const d = await loadJson<KettenDatei>(spurBestand(bereich, monatMinus(heute, i))).catch(() => null);
      for (const e of d?.eintraege ?? []) {
        const s = spurSaeubern(e as Record<string, unknown>);
        if (s && s.bereich === bereich) raus.push(s);
      }
    }
  }
  return raus;
}

/**
 * Aufbewahrung 12 Monate: Monate, die vollständig älter sind, werden geleert (Vermerk `bereinigt` mit Anzahl bleibt — Kette und Siegel
 * erkennen die Lücke als Löschfrist). Nächtliche Durchsicht. Liefert die geleerten Namen.
 */
export async function spurAufraeumen(jetzt = new Date()): Promise<string[]> {
  const grenze = monatMinus(monatBerlin(jetzt), SPUR_AUFBEWAHRUNG_MONATE);
  const raus: string[] = [];
  for (const d of await fs.readdir(datenOrdner()).catch(() => [] as string[])) {
    if (!d.endsWith('.json')) continue;
    const t = spurBestandTeile(d.slice(0, -5));
    if (!t || t.monat > grenze) continue;
    const name = d.slice(0, -5);
    let n = 0;
    await updateJson<KettenDatei>(name, cur => {
      n = cur?.eintraege?.length ?? 0;
      return n ? { eintraege: [], bereinigt: { am: jetzt.toISOString(), eintraege: n + (cur?.kette?.verworfen ?? 0), grund: `Aufbewahrung ${SPUR_AUFBEWAHRUNG_MONATE} Monate (System)` } } : (cur ?? { eintraege: [] });
    });
    if (n) raus.push(name);
  }
  return raus;
}

