// ─── Funde — OpenStreetMap über die Overpass-API (Abfrage + Lesen rein, getestet; Holen nur Server) ─────────────────────────
// Quelle: OpenStreetMap-Mitwirkende, Open Database License 1.0 (kommerziell erlaubt, Namensnennung). Wir fragen EIN Gebiet und EINE Branche je
// Anfrage — weit unter der Richtlinie der öffentlichen Instanz (~10.000 Abfragen/Tag, < 1 GB/Tag). Eigene Instanz: `OVERPASS_URL`.
// Google Maps wird NICHT abgefragt (die Bedingungen verbieten Listen/Datenbanken aus Places-Daten) — von dort nur „Fund von Hand“.
// Ketten/Filialen (Tag `brand`) fallen heraus: die haben eine Website der Zentrale.

import type { FundAdresse, FundBranche } from './typen';

/** Vorlagen für Gebiete — reine Erdkunde, keine Instanz-Daten; die Instanz wählt in den Einstellungen. */
export const GEBIETS_VORLAGEN: { id: string; name: string; stadt: string; gebiete: string[] }[] = [
  { id: 'berlin', name: 'Berlin (12 Bezirke)', stadt: 'Berlin', gebiete: ['Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf', 'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln', 'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf'] },
];

/** OSM-Filter je Branche (Overpass-QL). */
const FILTER: Record<FundBranche, string[]> = {
  gastro: ['["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|biergarten)$"]'],
  handwerk: ['["craft"]', '["shop"~"^(hairdresser|beauty|tailor|shoe_repair|massage|tattoo|optician|dry_cleaning|bicycle)$"]'],
  einzelhandel: ['["shop"~"^(clothes|books|gift|florist|bakery|butcher|deli|wine|jewelry|shoes|toys|furniture|interior_decoration|stationery|art|music|sports|outdoor|cosmetics|tea|coffee|chocolate|confectionery|second_hand|boutique|fabric|hardware)$"]'],
};

/** Ein Wert in einer Overpass-Zeichenkette: Anführungszeichen und Backslash maskiert, Steuerzeichen weg, höchstens 80 Zeichen. */
export const qlText = (s: string): string => s.replace(/[\u0000-\u001f]/g, '').slice(0, 80).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Die Abfrage für ein Gebiet (Bezirk) einer Stadt und eine Branche. Nur Betriebe mit Namen, ohne Kette; Mittelpunkt + Tags. */
export function abfrage(stadt: string, gebiet: string, branche: FundBranche, max = 300): string {
  const teile = FILTER[branche].map(f => `nwr(area.a)${f}["name"][!"brand"][!"brand:wikidata"];`).join('\n  ');
  return [
    '[out:json][timeout:90];',
    `area["name"="${qlText(stadt)}"]["boundary"="administrative"]->.s;`,
    `rel(area.s)["boundary"="administrative"]["name"="${qlText(gebiet)}"];`,
    'map_to_area->.a;',
    `(\n  ${teile}\n);`,
    `out center tags ${Math.max(1, Math.min(5000, Math.floor(max)))};`,
  ].join('\n');
}

export interface OsmRoh {
  osmId: string; name: string; branche: FundBranche; kategorie?: string; adresse?: FundAdresse;
  website?: string; email?: string; telefon?: string; oeffnungszeiten?: string;
}

const t = (v: unknown, n: number): string | undefined => {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return s ? s.slice(0, n) : undefined;
};

/** Ein Element der Overpass-Antwort → Rohfund (oder null: ohne Name, mit Marke, unbekannter Typ). */
export function elementLesen(el: unknown, branche: FundBranche): OsmRoh | null {
  const e = el && typeof el === 'object' ? el as { type?: string; id?: number; tags?: Record<string, string> } : null;
  if (!e || !e.tags || typeof e.id !== 'number' || !['node', 'way', 'relation'].includes(String(e.type))) return null;
  const g = e.tags;
  const name = t(g.name, 120);
  if (!name || g.brand || g['brand:wikidata']) return null;
  const adresse: FundAdresse = {
    ...(t(g['addr:street'], 120) ? { strasse: t(g['addr:street'], 120) } : {}), ...(t(g['addr:housenumber'], 20) ? { hausnummer: t(g['addr:housenumber'], 20) } : {}),
    ...(t(g['addr:postcode'], 10) ? { plz: t(g['addr:postcode'], 10) } : {}), ...(t(g['addr:city'], 80) ? { ort: t(g['addr:city'], 80) } : {}),
  };
  const website = t(g.website ?? g['contact:website'] ?? g.url, 300);
  const email = t(g.email ?? g['contact:email'], 160)?.toLowerCase();
  const telefon = t(g.phone ?? g['contact:phone'], 60);
  const kategorie = t(g.amenity ?? g.shop ?? g.craft, 60);
  return {
    osmId: `${String(e.type)[0]}${e.id}`, name, branche, ...(kategorie ? { kategorie } : {}), ...(Object.keys(adresse).length ? { adresse } : {}),
    ...(website ? { website } : {}), ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}), ...(telefon ? { telefon } : {}),
    ...(t(g.opening_hours, 200) ? { oeffnungszeiten: t(g.opening_hours, 200) } : {}),
  };
}

/** Die ganze Antwort lesen (doppelte Kennungen einmal). */
export function antwortLesen(json: unknown, branche: FundBranche): OsmRoh[] {
  const els = json && typeof json === 'object' && Array.isArray((json as { elements?: unknown[] }).elements) ? (json as { elements: unknown[] }).elements : [];
  const seen = new Set<string>();
  const out: OsmRoh[] = [];
  for (const el of els) {
    const r = elementLesen(el, branche);
    if (r && !seen.has(r.osmId)) { seen.add(r.osmId); out.push(r); }
  }
  return out;
}

export const OSM_NAMENSNENNUNG = '© OpenStreetMap-Mitwirkende (ODbL)';
const OVERPASS_STANDARD = 'https://overpass-api.de/api/interpreter';

/** Overpass fragen (nur Server). Wirft bei Netz-/Statusfehlern mit kurzem Text. `fetchFn` für Tests. */
export async function osmHolen(stadt: string, gebiet: string, branche: FundBranche, o: { max?: number; fetchFn?: typeof fetch; pausen?: number[] } = {}): Promise<OsmRoh[]> {
  const url = (process.env.OVERPASS_URL ?? '').trim() || OVERPASS_STANDARD;
  const f = o.fetchFn ?? fetch;
  const anfrage = () => f(url, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MAKE-OS-Funde/1.0' },
    body: `data=${encodeURIComponent(abfrage(stadt, gebiet, branche, o.max ?? 300))}`, signal: AbortSignal.timeout(100_000),
  });
  let r = await anfrage();
  // Die öffentliche Instanz ist oft kurz überlastet (429/502/503/504) — höchstens zwei weitere Versuche mit Pause (15 s, 45 s), dann Fehler.
  for (const pause of o.pausen ?? [15_000, 45_000]) {
    if (r.ok || ![429, 502, 503, 504].includes(r.status)) break;
    await new Promise(res => setTimeout(res, pause));
    r = await anfrage();
  }
  if (!r.ok) throw new Error(`OpenStreetMap antwortet mit ${r.status}${r.status === 429 ? ' (zu viele Anfragen — später noch einmal)' : ''}.`);
  return antwortLesen(await r.json(), branche);
}
