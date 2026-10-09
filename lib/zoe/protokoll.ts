// ─── MAKE OS — ZOE' Protokoll ────────────────────────────────────────────
// Baustein 1 (07.09.). Jede Werkzeug-Ausführung wird hier festgehalten: was
// ZOE getan hat, womit, was dabei herauskam — und wie man es zurücknimmt.
//
// Der Grund steht im Bauplan: ohne Protokoll kann niemand nachvollziehen
// noch zurücknehmen. Und ohne die Rücknahme-Beschreibung, die beim Ausführen
// entsteht, kann man sie später nicht mehr rekonstruieren — der alte Wert ist
// dann längst überschrieben.

//
// 29.09. (B1): Die Liste hier bleibt eine Arbeitsliste (GRENZE Einträge, Rücknahme). Jede Ausführung geht in derselben
// Sperre zuerst dauerhaft nach `zoe-entscheidungen--<haushalt>--<JJJJ-MM>` (lib/zoe/entscheidungen.ts, nur Feldnamen,
// nie Werte); gekürzt wird nur, was dort steht (`dauerhaft`) — Altbestand wird vor dem Kürzen nachgetragen, scheitert
// das, bleibt er stehen. Nie still.

//
// 29.09. (Paket D-B #93): Ins Protokoll kommt NICHT mehr die volle Eingabe (Gesprächsnotizen, Beträge, Texte), sondern
// nur, was eine Wirkung wiederfindbar macht: die Feldnamen (`felder`) und Kennungen (`eingabeKurz` — Kontakt-Kennungen
// als Fingerabdruck). Das Ergebnis höchstens 300 Zeichen. Die Rücknahme (alter Wert für „zurück“) bleibt — sie gehört zu
// Finanzen/Fokus/Zielen des Haushalts. Frist 90 Tage (Löschklasse „zoe-arbeitslisten“, `protokollFrist`), Art. 15/17 über
// lib/crm/person-bestaende.ts.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { protokollKennung } from '@/lib/store/aenderungsprotokoll';
import { ausfuehrungEintrag, haltFest } from './entscheidungen';
import type { Risiko } from './register';
import type { Person } from './raum';
import { neueKennung } from '@/lib/kennung';

/** Wie man eine Wirkung wieder aufhebt — als erneuter Werkzeug-Aufruf. */
export interface Ruecknahme {
  werkzeug: string;
  eingabe: Record<string, unknown>;
  /** Was passiert, wenn die Person darauf klickt. Ein Satz. */
  text: string;
}

export interface Eintrag {
  id: string;
  zeit: string;
  tag: string;
  werkzeug: string;
  gruppe: string;
  risiko: Risiko;
  /** Seit 29.09. nur Kennungen (`eingabeKurz`) — nie Texte, Beträge oder Notizen. */
  eingabe: Record<string, unknown>;
  /** Namen der Eingabe-Felder (29.09.). */
  felder?: string[];
  ergebnis: string;
  ok: boolean;
  /** Direkt von ZOE ausgeführt, oder nach deiner Freigabe aus dem Stapel. */
  quelle: 'zoe' | 'stapel';
  /** Für wen gehandelt wurde. Seit 07.09. trägt jede Wirkung das mit — ohne
   *  das ließe sich später nicht sagen, wessen Zahl da geändert wurde. */
  person?: Person;
  ruecknahme?: Ruecknahme | null;
  /** Gesetzt, sobald zurückgenommen — dann ist die Rücknahme verbraucht. */
  zurueckgenommenAm?: string;
  /** Steht dauerhaft in `zoe-entscheidungen` (29.09.) — erst dann darf die Arbeitsliste ihn kürzen. */
  dauerhaft?: true;
}

interface Stand { eintraege: Eintrag[] }

/** So viele Einträge bleiben stehen (Arbeitsliste) — Älteres steht dauerhaft in `zoe-entscheidungen`. */
const GRENZE = 500;

/** Sieht der Wert wie eine Kennung aus (c-…, ch-…, v-…, fu-…)? Nur solche bleiben im Protokoll. */
const KENNUNG = /^[a-z]{1,4}[-_][A-Za-z0-9][A-Za-z0-9._@+-]{1,120}$/;
const ID_FELD = /(^id$|_id$|Id$|_ids$|Ids$)/;
/**
 * Eingabe fürs Protokoll (rein): nur Felder, die Kennungen tragen (Feldname auf -id/-Id oder Wert in Kennungsform),
 * Kontakt-Kennungen als Fingerabdruck (`protokollKennung`). Alles andere fällt weg — die Feldnamen stehen in `felder`.
 */
export function eingabeKurz(eingabe: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const raus: Record<string, unknown> = {};
  const kennung = (v: unknown) => (typeof v === 'string' && v.length <= 160 && !/\s/.test(v) && KENNUNG.test(v) ? protokollKennung(v) : null);
  for (const [k, v] of Object.entries(eingabe ?? {})) {
    if (!ID_FELD.test(k) && !(typeof v === 'string' && KENNUNG.test(v) && /^c-/.test(v))) continue;
    if (Array.isArray(v)) { const l = v.map(kennung).filter((x): x is string => !!x); if (l.length) raus[k.slice(0, 40)] = l.slice(0, 50); continue; }
    const x = kennung(v);
    if (x) raus[k.slice(0, 40)] = x;
  }
  return raus;
}

export async function notiere(e: Omit<Eintrag, 'id' | 'zeit' | 'tag'>): Promise<Eintrag> {
  const eintrag: Eintrag = {
    ...e,
    eingabe: eingabeKurz(e.eingabe),
    felder: e.felder ?? Object.keys(e.eingabe ?? {}).slice(0, 40).map(k => k.slice(0, 40)),
    ergebnis: String(e.ergebnis ?? '').slice(0, 300),
    id: neueKennung('p'), // Paket D-C: zufällig, ohne Zeitanteil (lib/kennung.ts)
    zeit: new Date().toISOString(),
    tag: localDay(),
  };
  await updateJsonAsync<Stand>('zoe-protokoll', async current => {
    try { await haltFest([ausfuehrungEintrag(eintrag)]); eintrag.dauerhaft = true; }
    catch (err) { console.error('[zoe-protokoll] nicht dauerhaft festgehalten (wird vor dem Kürzen nachgetragen):', err instanceof Error ? err.message : err); }
    const liste = [eintrag, ...(current?.eintraege ?? [])];
    if (liste.length <= GRENZE) return { eintraege: liste };
    const ueber = liste.slice(GRENZE);
    const nach = ueber.filter(x => !x.dauerhaft);
    if (nach.length) {
      try { await haltFest(nach.map(x => ausfuehrungEintrag(x, true))); }
      catch (err) {
        console.error('[zoe-protokoll] Nachtragen vor dem Kürzen fehlgeschlagen — nichts gekürzt:', err instanceof Error ? err.message : err);
        return { eintraege: [...liste.slice(0, GRENZE), ...nach] };
      }
    }
    return { eintraege: liste.slice(0, GRENZE) };
  });
  return eintrag;
}

/** Neueste zuerst. */
export async function lies(anzahl = 60): Promise<Eintrag[]> {
  const s = await loadJson<Stand>('zoe-protokoll');
  return (s?.eintraege ?? []).slice(0, Math.max(1, Math.min(GRENZE, anzahl)));
}

export async function eintrag(id: string): Promise<Eintrag | null> {
  const s = await loadJson<Stand>('zoe-protokoll');
  return (s?.eintraege ?? []).find(x => x.id === id) ?? null;
}

/** Nach erfolgreicher Rücknahme: den Eintrag stempeln, damit es kein zweites
 *  Mal geht. Zweimal zurücknehmen würde sonst den alten Wert erneut setzen. */
export async function stempleZurueckgenommen(id: string): Promise<void> {
  await updateJson<Stand>('zoe-protokoll', current => {
    const liste = current?.eintraege ?? [];
    return { eintraege: liste.map(x => x.id === id ? { ...x, zurueckgenommenAm: new Date().toISOString() } : x) };
  });
}

/**
 * Frist (29.09., Löschklasse „zoe-arbeitslisten“, 90 Tage): Einträge vor `grenze` (Tag) fallen weg — nur, was dauerhaft
 * in zoe-entscheidungen steht; Altbestand wird vorher nachgetragen, scheitert das, bleibt er stehen. Liefert die Zahl.
 */
export async function protokollFrist(grenze: string): Promise<number> {
  if ((await loadJson<Stand>('zoe-protokoll')) === null) return 0;
  let n = 0;
  await updateJsonAsync<Stand>('zoe-protokoll', async current => {
    const liste = current?.eintraege ?? [];
    const alt = liste.filter(x => (x.tag || x.zeit?.slice(0, 10) || '') < grenze);
    if (!alt.length) return current as Stand;
    const nach = alt.filter(x => !x.dauerhaft);
    if (nach.length) {
      try { await haltFest(nach.map(x => ausfuehrungEintrag(x, true))); }
      catch (err) { console.error('[zoe-protokoll] Frist: Nachtragen fehlgeschlagen — nichts gekürzt:', err instanceof Error ? err.message : err); return current as Stand; }
    }
    const weg = new Set(alt.map(x => x.id));
    n = weg.size;
    return { eintraege: liste.filter(x => !weg.has(x.id)) };
  });
  return n;
}
