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
