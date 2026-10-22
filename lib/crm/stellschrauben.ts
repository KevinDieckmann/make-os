// ─── CRM — Stellschrauben der festen Prozesse in den Wertelisten (22.10., Branch `prozesse-stellschrauben`) ───────────────────────────────────────
// Entscheidung 22.10.: „Alles muss anpassbar sein und immer mal wieder zu bearbeiten.“ Drei Werte, die bis heute fest im Code standen, sind jetzt Einstellungen
// des Haushalts — gespeichert NUR als Abweichung in `crm.wertelisten.stellschrauben` (Schreibweg wie jede Werteliste: POST /api/crm/stammdaten
// { aktion: 'wertelisten', wertelisten: { stellschrauben: { … } } }, geprüft in lib/crm/wertelisten.ts `wertelistenPruefen`). Ohne Eintrag gilt die Vorgabe —
// jede Stelle rechnet dann bit-gleich wie vorher. Gelesen wird JEDER Wert über genau EINE Funktion hier (Rückfall = Vorgabe):
//   nachfassWerktage        Event-Nachfassfrist in Werktagen (Entscheidung E-V7 „48 Stunden = Werktage überall“) — eigene Abende (lib/crm/events.ts
//                           `followUpBis`), besuchte Events (lib/crm/besuche.ts `besuchFollowupFrist`) und das Follow-up der Erfassung (lib/crm/netzwerken.ts
//                           `followupFrist`) — EIN Wert für alle drei
//   qualiWiedervorlageTage  Ruhe nach „Geprüft“ bzw. Wiedervorlage in der Qualifizierungsrunde (lib/crm/leads.ts `brauchtQualifizierung`, `ruheBis`)
//   verschobenGelb          Ab so vielen Verschiebungen von „Entscheidung bis“ wird die Deal-Ampel gelb (lib/crm/pipeline.ts `gesundheit`)
// Rein, ohne Importe (pipeline.ts, besuche.ts, events.ts und netzwerken.ts laden es — kein Kreis).

/** Die Form in `Wertelisten.stellschrauben` — jedes Feld fehlt, solange es der Vorgabe gleicht. */
export interface CrmStellschrauben { nachfassWerktage?: number; qualiWiedervorlageTage?: number; verschobenGelb?: number }
export type CrmStellschraubeId = keyof CrmStellschrauben;

/** Was eine Stellschraube der Wertelisten ausmacht (Prüfung, Anzeige, Prozess-Steckbrief). */
export interface CrmStellschraubeDef { id: CrmStellschraubeId; name: string; einheit: string; vorgabe: number; min: number; max: number; erklaerung: string }

export const CRM_STELLSCHRAUBEN: readonly CrmStellschraubeDef[] = [
  { id: 'nachfassWerktage', name: 'Nachfassen nach einem Event', einheit: 'Werktage', vorgabe: 2, min: 1, max: 10,
    erklaerung: 'So viele Werktage (Mo–Fr ohne Feiertage NRW) nach dem Event muss nachgefasst sein — gilt für eigene Abende, besuchte Events und das Follow-up beim Erfassen.' },
  { id: 'qualiWiedervorlageTage', name: 'Wiedervorlage in der Qualifizierung', einheit: 'Tage', vorgabe: 60, min: 7, max: 365,
    erklaerung: 'So lange hat ein geprüfter Lead Ruhe — danach kommt er wieder in die Qualifizierungsrunde.' },
  { id: 'verschobenGelb', name: 'Deal-Ampel gelb ab Verschiebungen', einheit: '× verschoben', vorgabe: 2, min: 1, max: 10,
    erklaerung: 'Wer „Entscheidung bis“ so oft nach hinten schiebt, hat keine Zusage mehr — die Ampel des Deals wird mindestens gelb.' },
];

const def = (id: CrmStellschraubeId): CrmStellschraubeDef => CRM_STELLSCHRAUBEN.find(d => d.id === id)!;
/** Der wirksame Wert: gespeichert und gültig, sonst die Vorgabe (ein kaputter Wert gilt nie). */
function wert(w: { stellschrauben?: CrmStellschrauben } | null | undefined, id: CrmStellschraubeId): number {
  const d = def(id);
  const v = w?.stellschrauben?.[id];
  return typeof v === 'number' && Number.isInteger(v) && v >= d.min && v <= d.max ? v : d.vorgabe;
}

/** Vorgaben (die Werte, die bis 22.10. fest im Code standen). */
export const NACHFASS_WERKTAGE_VORGABE = 2;
export const QUALI_WIEDERVORLAGE_VORGABE = 60;
export const VERSCHOBEN_GELB_VORGABE = 2;

/** Event-Nachfassfrist in Werktagen — EINE Lesefunktion für eigene Abende, besuchte Events und die Erfassung. */
export const nachfassWerktage = (w?: { stellschrauben?: CrmStellschrauben } | null): number => wert(w, 'nachfassWerktage');
/** Ruhe nach „Geprüft“ bzw. Wiedervorlage der Qualifizierungsrunde in Tagen. */
export const qualiWiedervorlageTage = (w?: { stellschrauben?: CrmStellschrauben } | null): number => wert(w, 'qualiWiedervorlageTage');
/** Ab so vielen Verschiebungen von „Entscheidung bis“ wird die Deal-Ampel gelb. */
export const verschobenGelbAb = (w?: { stellschrauben?: CrmStellschrauben } | null): number => wert(w, 'verschobenGelb');

/**
 * Teil-Update prüfen (für `wertelistenPruefen`): `null` bzw. leer = zurück auf die Vorgabe, gleich der Vorgabe = nicht gespeichert, sonst ganze Zahl in den
 * Grenzen (Fehlertext je Feld). Liefert die neue gespeicherte Form (ohne Felder der Vorgabe) — `undefined`, wenn nichts abweicht.
 */
export function crmStellschraubenPruefen(roh: unknown, alt: CrmStellschrauben | undefined, zahl: (v: unknown) => number): { neu: CrmStellschrauben | undefined; fehler: string[] } {
  const fehler: string[] = [];
  if (roh === null) return { neu: undefined, fehler };
  if (typeof roh !== 'object' || Array.isArray(roh)) return { neu: alt, fehler: ['Stellschrauben: Objekt erwartet.'] };
  const neu: CrmStellschrauben = { ...(alt ?? {}) };
  for (const [id, v] of Object.entries(roh as Record<string, unknown>)) {
    const d = CRM_STELLSCHRAUBEN.find(x => x.id === id);
    if (!d) { fehler.push(`Stellschraube „${id.slice(0, 40)}“ unbekannt.`); continue; }
    if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) { delete neu[d.id]; continue; }
    const n = zahl(v);
    if (!Number.isInteger(n) || n < d.min || n > d.max) { fehler.push(`${d.name}: ganze Zahl ${d.min}–${d.max} ${d.einheit}.`); continue; }
    if (n === d.vorgabe) delete neu[d.id]; else neu[d.id] = n;
  }
  return { neu: Object.keys(neu).length ? neu : undefined, fehler };
}
