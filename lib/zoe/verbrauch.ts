// ─── MAKE OS — Was die KI kostet ────────────────────────────────────────────
// Baustein-Nachtrag (07.09.). Seit heute laufen Agenten im Hintergrund, nachts,
// mehrere gleichzeitig. Ohne Mitschrift wüsste der Inhaber nach vier Wochen nicht,
// welcher davon die Rechnung treibt — und genau das ist der Moment, in dem man
// aus Unsicherheit alles wieder abschaltet.
//
// Bewusst an EINER Stelle erfasst: in lib/anthropic.ts, durch die jeder
// Modellaufruf geht. Eine Erfassung je Route wäre 21-mal dieselbe Zeile und
// beim zweiundzwanzigsten Mal vergessen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { kostenUsdCent, inEuroCent, usdEurKurs, type Mengen } from '@/lib/ki/kosten';
import type { AnbieterId } from '@/lib/ki/anbieter';
import { KATALOG } from '@/lib/agenten/katalog';

// Preise (09.10., Paket 6a): aus dem Modell-Katalog lib/ki/modelle.ts — mit Stand und Quelle je Zeile, auch Haiku/Sonnet 5.5 und die
// Medien-Einheiten (Bild, Sekunde Video, Minute Transkription, Aufgabe). Vorher stand hier eine eigene Tabelle (Stand 07.09.).
// Unbekanntes Modell: mit dem teuersten seiner Fähigkeit rechnen, nicht mit null. Gespeichert wird weiter in US-Cent (`cent`, wie der
// Altbestand); Euro rechnet die Übersicht mit dem Kurs der Instanz (lib/ki/kosten.ts).

export interface Posten {
  modell: string;
  zweck: string;
  ein: number;
  aus: number;
  /** Aus dem Prompt-Cache gelesen / in ihn geschrieben (Token). */
  cl?: number; cs?: number;
  /** Geschätzte Kosten in US-Cent. */
  cent: number;
  anzahl: number;
  /** Zugang (seit 09.10.; fehlt = Anthropic direkt, Altbestand). */
  anbieter?: AnbieterId;
  /** Nicht-Token-Einheiten (Bild, Sekunde, Minute, Aufgabe), aufsummiert. */
  mengen?: Mengen;
}
interface Tag { tag: string; posten: Posten[] }
/**
 * `summe` (09.10., Agenten-Bereich Paket 4b): fortlaufender Zähler aller Kosten in US-Cent — die Tage oben fallen nach `TAGE` heraus, der
 * Zähler nicht. Für die Gesamt-Grenze (Test-Budget) im Anbieter-Tor: verbraucht = Zähler jetzt − Zähler beim Setzen. Fehlt er (Altbestand),
 * beginnt er bei der Summe der vorhandenen Tage.
 */
interface Stand { tage: Tag[]; summe?: { usdCent: number; seit: string } }
const summeDer = (tage: readonly Tag[]): number => tage.reduce((a, t) => a + t.posten.reduce((b, p) => b + p.cent, 0), 0);

/** So viele Tage bleiben stehen — reicht für „was hat der Monat gekostet". */
const TAGE = 45;

/** Kosten eines Aufrufs in US-Cent (Token-Mengen; Preise aus dem Katalog). */
export function kosten(modell: string, ein: number, aus: number, cacheLesen = 0, cacheSchreiben = 0, anbieter?: AnbieterId): number {
  return kostenUsdCent(modell, { 'token-ein': ein, 'token-aus': aus, 'cache-lesen': cacheLesen, 'cache-schreiben': cacheSchreiben }, anbieter ? { anbieter } : {});
}

/**
 * Einen Aufruf mitschreiben. Je Tag, Modell, Zweck und Zugang EINE Zeile, die mitwächst —
 * sonst hätte die Datei nach einer Woche zehntausend Einträge und niemand
 * würde je hineinsehen. Seit 09.10. wachsen die Kosten je Aufruf (Haiku 5.5 hat eine Preisstaffel je Prompt-Länge —
 * aus den Summen nachgerechnet wäre sie falsch).
 */
export async function notiere(modell: string, zweck: string, ein: number, aus: number, cacheLesen = 0, cacheSchreiben = 0, anbieter?: AnbieterId): Promise<void> {
  if (!ein && !aus && !cacheLesen && !cacheSchreiben) return;
  await buche({ modell, zweck, anbieter, ein, aus, cl: cacheLesen, cs: cacheSchreiben, cent: kosten(modell, ein, aus, cacheLesen, cacheSchreiben, anbieter) });
}

/** Medien-Einheiten mitschreiben (Bild, Sekunde Video, Minute, Aufgabe) — Kosten aus dem Katalog. */
export async function notiereMengen(modell: string, zweck: string, mengen: Mengen, anbieter: AnbieterId): Promise<void> {
  const sauber = Object.fromEntries(Object.entries(mengen).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n > 0)) as Mengen;
  if (!Object.keys(sauber).length) return;
  await buche({ modell, zweck, anbieter, ein: 0, aus: 0, cl: 0, cs: 0, mengen: sauber, cent: kostenUsdCent(modell, sauber, { anbieter }) });
}

async function buche(z: { modell: string; zweck: string; anbieter?: AnbieterId; ein: number; aus: number; cl: number; cs: number; mengen?: Mengen; cent: number }): Promise<void> {
  const heute = localDay();
  // Anthropic direkt ohne Feld (wie der Altbestand) — so bleibt die Zeile je Tag/Modell/Zweck dieselbe wie vor dem Anbieter-Tor.
  const anbieter = z.anbieter && z.anbieter !== 'anthropic' ? z.anbieter : undefined;
  await updateJson<Stand>('ki-verbrauch', current => {
    const tage = current?.tage ?? [];
    // Zähler VOR dieser Buchung (ohne Zähler: die Summe der vorhandenen Tage) — vor dem Ändern der Posten gelesen.
    const summe = { usdCent: (current?.summe?.usdCent ?? summeDer(tage)) + z.cent, seit: current?.summe?.seit ?? new Date().toISOString() };
    const tag = tage.find(t => t.tag === heute) ?? { tag: heute, posten: [] };
    const rest = tage.filter(t => t.tag !== heute);
    const da = tag.posten.find(p => p.modell === z.modell && p.zweck === z.zweck && p.anbieter === anbieter);
    if (da) {
      da.ein += z.ein; da.aus += z.aus; da.anzahl += 1;
      if (z.cl) da.cl = (da.cl ?? 0) + z.cl;
      if (z.cs) da.cs = (da.cs ?? 0) + z.cs;
      if (z.mengen) { const m: Mengen = { ...(da.mengen ?? {}) }; for (const [k, n] of Object.entries(z.mengen) as [keyof Mengen, number][]) m[k] = (m[k] ?? 0) + n; da.mengen = m; }
      da.cent += z.cent;
    } else {
      tag.posten.push({ modell: z.modell, zweck: z.zweck, ein: z.ein, aus: z.aus, anzahl: 1, ...(z.cl ? { cl: z.cl } : {}), ...(z.cs ? { cs: z.cs } : {}), ...(anbieter ? { anbieter } : {}), ...(z.mengen ? { mengen: z.mengen } : {}), cent: z.cent });
    }
    return { tage: [tag, ...rest].slice(0, TAGE), summe };
  });
}

/** Fortlaufender Zähler aller Kosten (US-Cent) — für die Gesamt-Grenze im Anbieter-Tor (lib/ki/tor.ts). */
export async function gesamtUsdCent(vorgeladen?: Stand | null): Promise<number> {
  const s = vorgeladen !== undefined ? vorgeladen : await loadJson<Stand>('ki-verbrauch');
  return s?.summe?.usdCent ?? summeDer(s?.tage ?? []);
}

export async function uebersicht(tage = 30): Promise<{
  tage: Tag[];
  heuteCent: number;
  summeCent: number;
  jeZweck: { zweck: string; cent: number; anzahl: number }[];
  /** Euro (seit 09.10., Kurs der Instanz). */
  euro: { kurs: number; heuteCent: number; summeCent: number; monatCent: number };
  jeAnbieter: { anbieter: AnbieterId; cent: number; anzahl: number }[];
}> {
  const s = await loadJson<Stand>('ki-verbrauch');
  const liste = (s?.tage ?? []).slice(0, tage);
  const heute = localDay();
  const summe = (t: Tag) => t.posten.reduce((a, p) => a + p.cent, 0);
  const jeZweck = new Map<string, { cent: number; anzahl: number }>();
  const jeAnbieter = new Map<AnbieterId, { cent: number; anzahl: number }>();
  for (const t of liste) {
    for (const p of t.posten) {
      const e = jeZweck.get(p.zweck) ?? { cent: 0, anzahl: 0 };
      e.cent += p.cent; e.anzahl += p.anzahl;
      jeZweck.set(p.zweck, e);
      const a = jeAnbieter.get(p.anbieter ?? 'anthropic') ?? { cent: 0, anzahl: 0 };
      a.cent += p.cent; a.anzahl += p.anzahl;
      jeAnbieter.set(p.anbieter ?? 'anthropic', a);
    }
  }
  const heuteCent = liste.filter(t => t.tag === heute).reduce((a, t) => a + summe(t), 0);
  const summeCent = liste.reduce((a, t) => a + summe(t), 0);
  const kurs = usdEurKurs();
  return {
    tage: liste,
    heuteCent,
    summeCent,
    jeZweck: Array.from(jeZweck.entries())
      .map(([zweck, e]) => ({ zweck, ...e }))
      .sort((a, b) => b.cent - a.cent),
    euro: { kurs, heuteCent: inEuroCent(heuteCent, kurs), summeCent: inEuroCent(summeCent, kurs), monatCent: inEuroCent(await monatUsdCent(heute, s), kurs) },
    jeAnbieter: Array.from(jeAnbieter.entries()).map(([anbieter, e]) => ({ anbieter, ...e })).sort((a, b) => b.cent - a.cent),
  };
}

/** Verbrauch des laufenden Monats (Berliner Tag) in US-Cent — für das Budget im Anbieter-Tor. */
export async function monatUsdCent(heute = localDay(), vorgeladen?: Stand | null): Promise<number> {
  const s = vorgeladen !== undefined ? vorgeladen : await loadJson<Stand>('ki-verbrauch');
  const monat = heute.slice(0, 7);
  return (s?.tage ?? []).filter(t => t.tag.startsWith(monat)).reduce((a, t) => a + t.posten.reduce((b, p) => b + p.cent, 0), 0);
}

// ── Sicht je Konto (Sicherheitsprüfung 09.10.) ────────────────────────────────────────────────────────────────────────────
/** Private Systemläufe (Ernährung, Leistung mit Körperwerten) — wie `PRIVAT_SYSTEMLAEUFE` der Läufe-Sicht. */
const PRIVAT_ZWECKE = new Set(['ernaehrung-vorschlag', 'ernaehrung-rezept', 'performance']);
const PRIVAT_HEADS = KATALOG.filter(h => h.bereich === 'privat').map(h => h.id).sort((a, b) => b.length - a.length);

/** Gehört dieser Zweck in den Privat-Bereich? (`agent-<head>` bzw. `agent-<head>-…` eines Privat-Heads, private Systemläufe.) Rein. */
export function zweckPrivat(zweck: string): boolean {
  if (PRIVAT_ZWECKE.has(zweck)) return true;
  if (!zweck.startsWith('agent-')) return false;
  const rest = zweck.slice(6);
  return PRIVAT_HEADS.some(h => rest === h || rest.startsWith(`${h}-`));
}
