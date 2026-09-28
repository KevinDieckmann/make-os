// ─── MAKE OS — ZOE' Protokoll ────────────────────────────────────────────
// Baustein 1 (07.09.). Jede Werkzeug-Ausführung wird hier festgehalten: was
// ZOE getan hat, womit, was dabei herauskam — und wie man es zurücknimmt.
//
// Der Grund steht im Bauplan: ohne Protokoll kann Kevin weder nachvollziehen
// noch zurücknehmen. Und ohne die Rücknahme-Beschreibung, die beim Ausführen
// entsteht, kann man sie später nicht mehr rekonstruieren — der alte Wert ist
// dann längst überschrieben.

//
// 29.09. (B1): Die Liste hier bleibt eine Arbeitsliste (GRENZE Einträge, Rücknahme). Jede Ausführung geht in derselben
// Sperre zuerst dauerhaft nach `zoe-entscheidungen--<haushalt>--<JJJJ-MM>` (lib/zoe/entscheidungen.ts, nur Feldnamen,
// nie Werte); gekürzt wird nur, was dort steht (`dauerhaft`) — Altbestand wird vor dem Kürzen nachgetragen, scheitert
// das, bleibt er stehen. Nie still.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { ausfuehrungEintrag, haltFest } from './entscheidungen';
import type { Risiko } from './register';
import type { Person } from './raum';

/** Wie man eine Wirkung wieder aufhebt — als erneuter Werkzeug-Aufruf. */
export interface Ruecknahme {
  werkzeug: string;
  eingabe: Record<string, unknown>;
  /** Was passiert, wenn Kevin darauf klickt. Ein Satz. */
  text: string;
}

export interface Eintrag {
  id: string;
  zeit: string;
  tag: string;
  werkzeug: string;
  gruppe: string;
  risiko: Risiko;
  eingabe: Record<string, unknown>;
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

export async function notiere(e: Omit<Eintrag, 'id' | 'zeit' | 'tag'>): Promise<Eintrag> {
  const eintrag: Eintrag = {
    ...e,
    id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
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
