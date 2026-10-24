// ─── Prozesse · Werkstatt — „+ Teilprozess hier anlegen“ (Feinschliff 24.10., Bau-Test A2: „als Teilprozess nur Veröffentlichtes, eigene Entwürfe fehlen“) ──────
// Regel (Kevin, Runde 2): die Auswahl eines Teilprozesses zeigt auch Entwürfe (gekennzeichnet — der Probelauf nimmt deren Entwurf, scharf nur Veröffentlichtes), und
// direkt am Schritt lässt sich ein neuer Teilprozess anlegen — mit dem passenden Fall: eine Schleife „je Deal“ (CRM-Abfrage über Deals) bekommt einen Prozess am Deal,
// ein Teilprozess sonst den Fall des Elternprozesses. Rein und client-sicher.

import type { CrmAbfrageArt, FallArt, ProzessDefinition, ProzessForm, ProzessKnoten } from './definition';

type K = ProzessKnoten<ProzessForm>;

/** Woran ein Eintrag einer CRM-Abfrage hängt (lib/prozesse/kundengewinnung/abfrage.ts `abfrageFaelle` — dieselben Fälle). */
export const ABFRAGE_FALL: Readonly<Record<CrmAbfrageArt, FallArt>> = {
  leads: 'lead', 'neue-leads': 'lead', 'leads-wiedervorlage': 'lead', 'netzwerken-offen': 'lead', nachbereiten: 'lead', 'vernetzen-runde': 'lead', 'powerhour-karten': 'lead',
  'kampagne-personen': 'lead', 'firmen-ruhend': 'firma', 'deals-ohne-schritt': 'deal', 'deals-haengen': 'deal', 'deals-wiedervorlage': 'deal', 'angebote-ohne-antwort': 'deal',
  'mandate-laufzeitende': 'mandat',
};

/** Der Fall eines neuen Teilprozesses (rein): Schleife über eine CRM-Abfrage → deren Fall; sonst der Fall des Elternprozesses. */
export function teilprozessFall(d: Pick<ProzessDefinition, 'knoten' | 'fallArt'>, k: K): FallArt {
  const liste = k.schleife?.liste ?? (typeof k.katalog?.werte?.liste === 'string' ? k.katalog.werte.liste : undefined);
  if (k.form === 'schleife' && liste?.startsWith('abfrage:')) {
    const q = d.knoten.find(x => x.id === liste.slice(8));
    const art = q?.abfrage?.art ?? (typeof q?.katalog?.werte?.art === 'string' ? q.katalog.werte.art as CrmAbfrageArt : undefined);
    if (art && ABFRAGE_FALL[art]) return ABFRAGE_FALL[art];
  }
  return d.fallArt ?? 'mandat';
}

/** Der Name des neuen Teilprozesses: „<Schritt> — Teilprozess“ (höchstens so lang wie ein Titel; ändern lässt er sich im Steckbrief). */
export function teilprozessTitel(k: Pick<K, 'titel'>, max = 120): string {
  const t = `${k.titel.trim() || 'Schritt'} — Teilprozess`;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Wie ein Prozess in der Auswahl heißt: Entwürfe sind gekennzeichnet (Probelauf nimmt den Entwurf, scharf nur die veröffentlichte Version). */
export const ENTWURF_HINWEIS = 'Entwurf — läuft erst nach dem Veröffentlichen';

// ── Teilprozess einer Schleife nach Fall (Runde 3, Bau-Test 2: die Liste bot jeden Prozess an, auch solche an einem anderen Fall) ────────────────────────

/** Der Fall der Einträge einer Schleife (rein): über eine CRM-Abfrage deren Fall (`ABFRAGE_FALL`); sonst unbekannt (null). */
export function schleifenElementFall(d: Pick<ProzessDefinition, 'knoten'>, k: K): FallArt | null {
  const liste = k.schleife?.liste ?? (typeof k.katalog?.werte?.liste === 'string' ? k.katalog.werte.liste : undefined);
  if (k.form !== 'schleife' || !liste?.startsWith('abfrage:')) return null;
  const q = d.knoten.find(x => x.id === liste.slice(8));
  const art = q?.abfrage?.art ?? (typeof q?.katalog?.werte?.art === 'string' ? q.katalog.werte.art as CrmAbfrageArt : undefined);
  return art && ABFRAGE_FALL[art] ? ABFRAGE_FALL[art] : null;
}
/**
 * Passt ein Teilprozess zum Eintrag der Liste (rein)? Gleicher Fall, „ohne Fall“, und Lead ↔ Firma (ein Firmen-Lead läuft als Firma, eine Firma als Lead — dieselbe
 * Regel wie der Motor: lib/prozesse/kundengewinnung/abfrage.ts `fallFuerTeil`). Ohne bekannten Fall eines Prozesses gilt die Vorgabe Mandat.
 */
export function teilFallPasst(element: FallArt, teil: FallArt | undefined): boolean {
  const t = teil ?? 'mandat';
  return t === element || t === 'keiner' || (element === 'lead' && t === 'firma') || (element === 'firma' && t === 'lead');
}
export const PASST_NICHT_HINWEIS = 'passt nicht zum Fall';
/**
 * Die Teilprozesse, die eine Schleife anbietet (rein): nur passende (`teilFallPasst`); ein schon gewählter, der nicht passt, bleibt sichtbar mit „passt nicht zum
 * Fall“ (nie still entfernt). Ohne bekannten Fall der Einträge: alle wie bisher.
 */
export function teilprozessOptionen<O extends { id: string; label: string; hinweis?: string; fall?: FallArt }>(optionen: readonly O[], element: FallArt | null, gewaehlt?: string | null): (O & { hinweis?: string })[] {
  if (!element) return [...optionen];
  return optionen.flatMap(o => (teilFallPasst(element, o.fall) ? [o] : o.id === gewaehlt ? [{ ...o, hinweis: PASST_NICHT_HINWEIS }] : []));
}

/** Wie ein Eintrag einer Liste heißt (Einzahl, Mehrzahl) — „Schritt testen“ und Probelauf der Schleife. */
export const FALL_WORT: Readonly<Record<string, readonly [string, string]>> = { lead: ['Lead', 'Leads'], deal: ['Deal', 'Deals'], firma: ['Firma', 'Firmen'], mandat: ['Mandat', 'Mandate'], event: ['Event', 'Events'], kampagne: ['Kampagne', 'Kampagnen'] };
/**
 * Der Satz der Schleife im Probelauf (rein; Runde 3): „würde für 6 Deals je einen Teil-Lauf von „Deal klären“ starten (höchstens 50 je Lauf)“ — die Zahl aus der Abfrage
 * davor bzw. dem Probelauf-Fall, sonst ohne Zahl („je Deal“); ohne bekannten Teilprozess mit dem Namen des Schritts.
 */
export function schleifeSatz(o: { anzahl: number | null; element: FallArt | null; teil: string | null; hoechstens: number; titel: string }): string {
  const w = (o.element && FALL_WORT[o.element]) || (['Eintrag', 'Einträge'] as const);
  const wer = o.anzahl !== null && o.anzahl >= 0 ? `für ${o.anzahl} ${o.anzahl === 1 ? w[0] : w[1]} je` : `je ${w[0]}`;
  return o.teil
    ? `würde ${wer} einen Teil-Lauf von „${o.teil}“ starten (höchstens ${o.hoechstens} je Lauf)`
    : `würde ${wer} einen Teil-Lauf starten: ${o.titel} (höchstens ${o.hoechstens} je Lauf)`;
}
