// ─── Markttraktion zählt nur Business (17.10., L2 B2) ──────────────────────────────────────────────────────────────────────────────
// Kevins Regel „Business-Sicht nie Privates“: Deals, Mandate und Angebote einer Privat-Einheit (die Selbstständigkeit, solange sie unter
// Privat steht) zählten in Trichter, Kennzahlen, Wochen-Scoreboard, Traktions-Index und Kanal-Stand mit — der Business-Index (`ladeRoh`)
// dagegen nicht. EINE Filterstelle für alle Zählungen: jede Zähl-Funktion ruft sie am Eingang. Gespeichert und in den Listen (Deals,
// Mandate) bleibt alles; nur gezählt wird Business. Idempotent (zweimal angewandt = einmal). Rein, Server und Browser.
// Die Regel ist `bereichVonGesellschaft` (lib/einheiten.ts) — dieselbe wie `imBusiness` in Leistungstreppe, Planung und Rolle „nur Business“;
// hier direkt, weil lib/crm/treppe.ts über kunden → team wieder lib/crm/leads.ts lädt (kein Kreis-Import).

import type { CrmBestand } from './typen';
import { bereichVonGesellschaft } from '@/lib/einheiten';

/** Gehört der Eintrag (Deal, Mandat, Angebot) zum Business? „offen“ und Register-Gesellschaften g-… ja, eine Privat-Einheit nein. */
const imBusiness = (x: { gesellschaft?: string | null }): boolean => bereichVonGesellschaft(x.gesellschaft) === 'business';

type Zaehlbar = Pick<CrmBestand, 'chancen'> & { mandate?: CrmBestand['mandate']; angebote?: CrmBestand['angebote'] };

/** Derselbe Bestand ohne Deals, Mandate und Angebote einer Privat-Einheit. Nichts herausgefallen → dasselbe Objekt. */
export function nurBusinessGezaehlt<T extends Zaehlbar>(crm: T): T {
  const chancen = (crm.chancen ?? []).filter(imBusiness);
  const mandate = crm.mandate?.filter(imBusiness);
  const angebote = crm.angebote?.filter(imBusiness);
  const gleich = chancen.length === (crm.chancen ?? []).length && (mandate?.length ?? 0) === (crm.mandate?.length ?? 0) && (angebote?.length ?? 0) === (crm.angebote?.length ?? 0);
  return gleich ? crm : { ...crm, chancen, ...(crm.mandate ? { mandate } : {}), ...(crm.angebote ? { angebote } : {}) };
}
